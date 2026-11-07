// Stem splitter: Demucs v4 (htdemucs, Meta, MIT licence) running in the browser on ONNX Runtime Web.
// Splits a song into drums, bass, other and vocals. Runs as a module Web Worker (ui/stemsplit.js starts
// it); the same functions also load in a page or in Node for the tests.
//
// The network itself is the htdemucs "core" exported to ONNX with the STFT/iSTFT moved out of it
// (scripts/stemsplit/export.py, after github.com/sevagh/demucs.onnx). This file does those parts:
//   - the spectrogram exactly as torch.stft does it in Demucs (hann 4096, hop 1024, normalized, reflect pads)
//   - the inverse (torch.istft), and the time branch is added back on
//   - the song in 7.8 s windows with 25% overlap and triangle cross-fades (demucs.apply.apply_model, shifts=0)
// The weights ship as int8 with one scale per output row (42 MB instead of 167 MB); they are
// expanded to float32 here before the session starts. Measured against the float32 model: 20-38 dB
// below the stems, far under the model's own separation error.
//
// Messages in: { type: "load", base, files? } then { type: "split", id, left, right } (Float32Array, 44.1 kHz).
// Messages out: { type: "progress", id?, stage, done, total }, { type: "ready", backend },
//               { type: "result", id, stems: { drums: [L, R], bass, other, vocals } }, { type: "error", id?, message }.

export const SR = 44100, L = 343980, NFFT = 4096, HL = 1024, BINS = 2048, FRAMES = 336;
export const SOURCES = ["drums", "bass", "other", "vocals"];
export const FILES = { ort: "ort.wasm.bundle.min.mjs", wasm: "ort-wasm-simd-threaded.wasm", graph: "htdemucs.onnx", manifest: "htdemucs.json",
                       ortGpu: "ort.webgpu.bundle.min.mjs", wasmGpu: ["ort-wasm-simd-threaded.asyncify.0.bin", "ort-wasm-simd-threaded.asyncify.1.bin"] };

// ------------------------------------------------------------------ FFT (radix-2, size 4096)
const N = NFFT, LOG = 12;
const rev = new Uint16Array(N);
for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < LOG; b++) r |= ((i >> b) & 1) << (LOG - 1 - b); rev[i] = r; }
const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = Math.sin(2 * Math.PI * i / N); }
// periodic hann, like torch.hann_window(4096)
const WIN = new Float64Array(N);
for (let i = 0; i < N; i++) WIN[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);

// In place complex FFT; sign -1 forward, +1 inverse (no scaling).
function fft(re, im, sign) {
  for (let i = 0; i < N; i++) {
    const j = rev[i];
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let s = 0; s < N; s += size) {
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const c = cosT[t], d = sign * sinT[t];
        const a = s + k, b = a + half;
        const xr = re[b] * c - im[b] * d, xi = re[b] * d + im[b] * c;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}

// Reflect padding (numpy/torch "reflect": the edge sample is not repeated).
function reflectPad(x, left, right) {
  const n = x.length, out = new Float64Array(n + left + right);
  for (let i = 0; i < out.length; i++) {
    let k = i - left;
    while (k < 0 || k >= n) { if (k < 0) k = -k; if (k >= n) k = 2 * (n - 1) - k; }
    out[i] = x[k];
  }
  return out;
}

// Demucs' _spec for one window of both channels: returns the "mag" input [4, 2048, 336]
// (channels L.re, L.im, R.re, R.im), complex-as-channels.
export function spec(left, right) {
  const le = Math.ceil(L / HL), pad = (HL / 2) * 3;              // 336, 1536
  const chans = [left, right].map((x) => reflectPad(reflectPad(x, pad, pad + le * HL - L), N / 2, N / 2));
  const out = new Float32Array(4 * BINS * FRAMES);
  const re = new Float64Array(N), im = new Float64Array(N), norm = 1 / Math.sqrt(N);
  for (let t = 0; t < FRAMES; t++) {
    const at = (t + 2) * HL;                                         // frames [2, 2 + le) of the stft
    const a = chans[0], b = chans[1];
    for (let i = 0; i < N; i++) { re[i] = a[at + i] * WIN[i]; im[i] = b[at + i] * WIN[i]; }
    fft(re, im, -1);
    // two real signals in one FFT: A[k] = (Z[k] + conj Z[N-k]) / 2, B[k] = (Z[k] - conj Z[N-k]) / 2i
    for (let k = 0; k < BINS; k++) {
      const j = (N - k) & (N - 1);
      const ar = (re[k] + re[j]) / 2, ai = (im[k] - im[j]) / 2;
      const br = (im[k] + im[j]) / 2, bi = -(re[k] - re[j]) / 2;
      const o = k * FRAMES + t;
      out[o] = ar * norm; out[BINS * FRAMES + o] = ai * norm;
      out[2 * BINS * FRAMES + o] = br * norm; out[3 * BINS * FRAMES + o] = bi * norm;
    }
  }
  return out;
}

// Demucs' _ispec for one source: z = [4, 2048, 336] (L.re, L.im, R.re, R.im) -> [left, right] of length L.
const ENV = (() => {   // the istft window envelope (sum of squared windows), for the full 340-frame signal
  const len = (FRAMES + 4 - 1) * HL + N, env = new Float64Array(len);
  for (let t = 0; t < FRAMES + 4; t++) for (let i = 0; i < N; i++) env[t * HL + i] += WIN[i] * WIN[i];
  return env;
})();
export function ispec(z, zOff = 0) {
  const pad = (HL / 2) * 3, frames = FRAMES + 4, len = (frames - 1) * HL + N;
  const yl = new Float64Array(len), yr = new Float64Array(len);
  const re = new Float64Array(N), im = new Float64Array(N), scale = Math.sqrt(N) / N;
  const P = BINS * FRAMES;
  for (let f = 2; f < frames - 2; f++) {                            // frames 0, 1 and the last two are zero
    const t = f - 2;
    // Hermitian spectrum of L in re/im parts combined with R as the imaginary signal: Z = A + iB
    re.fill(0); im.fill(0);
    for (let k = 0; k < BINS; k++) {
      const o = zOff + k * FRAMES + t;
      const ar = z[o], ai = z[P + o], br = z[2 * P + o], bi = z[3 * P + o];
      // Z[k] = A[k] + i B[k] (irfft ignores the imaginary part of the DC bin)
      if (k === 0) { re[0] = ar; im[0] = br; continue; }
      re[k] += ar - bi; im[k] += ai + br;
      {
        // Z[N-k] = conj(A[k]) + i conj(B[k])
        const j = N - k;
        re[j] += ar + bi; im[j] += -ai + br;
      }
    }
    // bin 2048 (Nyquist) is the zero row Demucs pads on
    fft(re, im, +1);
    const at = f * HL;
    for (let i = 0; i < N; i++) { yl[at + i] += re[i] * scale * WIN[i]; yr[at + i] += im[i] * scale * WIN[i]; }
  }
  const start = N / 2 + pad, outL = new Float32Array(L), outR = new Float32Array(L);
  for (let i = 0; i < L; i++) { const e = ENV[start + i]; outL[i] = yl[start + i] / e; outR[i] = yr[start + i] / e; }
  return [outL, outR];
}

// ------------------------------------------------------------------ model
let ort = null, session = null, backend = "";

async function fetchBytes(url, onBytes) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't load ${url.split("/").pop()} (${r.status})`);
  const b = new Uint8Array(await r.arrayBuffer());
  if (onBytes) onBytes(b.length);
  return b;
}

// Expand the int8 weights (+ per-row scales) to the float32 external-data file the graph points at.
export function dequantize(manifest, q8) {
  const scales = new Float32Array(q8.buffer, q8.byteOffset, manifest.scales);
  const data = new Int8Array(q8.buffer, q8.byteOffset + manifest.scales * 4, manifest.floats);
  const out = new Float32Array(manifest.floats);
  let i = 0, r = 0;
  for (const t of manifest.tensors) {
    const per = t.n / t.rows;
    for (let row = 0; row < t.rows; row++, r++) {
      const s = scales[r];
      for (let k = 0; k < per; k++, i++) out[i] = data[i] * s;
    }
  }
  return out;
}

// base: the folder with the files (URL string). files: optional overrides of FILES (a list = parts joined).
// backend: "auto" tries WebGPU first (much faster where the browser has it) and falls back to wasm.
let graphBytes = null, weightBytes = null, manifestFile = "";
export async function load({ base, files = {}, ortModule = null, backend: want = "auto", onProgress = () => {} }) {
  if (session) return backend;
  const pick = (k) => files[k] || FILES[k];
  const url = (k) => new URL(pick(k), base).href;
  const many = async (list, label) => {
    const parts = [];
    for (const u of list) { parts.push(await fetchBytes(new URL(u, base).href)); onProgress({ stage: label, done: parts.length, total: list.length }); }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };
  if (!graphBytes) {
    const manifest = await (await fetch(url("manifest"))).json();
    graphBytes = await fetchBytes(url("graph"));
    onProgress({ stage: "model", done: 0, total: manifest.parts.length });
    weightBytes = new Uint8Array(dequantize(manifest, await many(manifest.parts, "model")).buffer);
    manifestFile = manifest.file;
  }
  const opts = { graphOptimizationLevel: "all", externalData: [{ path: manifestFile, data: weightBytes }] };
  let gpu = false;
  if (!ortModule && want !== "wasm" && globalThis.navigator && navigator.gpu) {
    try { gpu = !!(await navigator.gpu.requestAdapter()); } catch (e) { gpu = false; }
  }
  if (gpu) {
    try {
      ort = await import(url("ortGpu"));
      ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
      ort.env.wasm.wasmBinary = (await many([].concat(pick("wasmGpu")), "engine")).buffer;
      session = await ort.InferenceSession.create(graphBytes, { ...opts, executionProviders: ["webgpu"] });
      backend = "webgpu";
      return backend;
    } catch (e) {
      console.warn("[stemsplit] WebGPU didn't start, using wasm:", e);
      session = null;
    }
  }
  ort = ortModule || await import(url("ort"));
  ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, (globalThis.navigator && navigator.hardwareConcurrency) || 1) : 1;
  ort.env.wasm.proxy = false;
  if (!ortModule) ort.env.wasm.wasmBinary = (await many([].concat(pick("wasm")), "engine")).buffer;
  session = await ort.InferenceSession.create(graphBytes, { ...opts, executionProviders: ["wasm"], enableCpuMemArena: false, enableMemPattern: false });
  backend = "wasm";
  return backend;
}

// The GPU path can fail on the first real run (out of GPU memory, a driver bug): start over on wasm.
async function fallBack(base, files) {
  if (session && session.release) await session.release().catch(() => {});
  session = null;
  return load({ base, files, backend: "wasm" });
}

async function runWindow(wl, wr) {
  const mag = spec(wl, wr);
  const mix = new Float32Array(2 * L); mix.set(wl, 0); mix.set(wr, L);
  const r = await session.run({ mix: new ort.Tensor("float32", mix, [1, 2, L]), mag: new ort.Tensor("float32", mag, [1, 4, BINS, FRAMES]) });
  const sp = r.spec.data, wave = r.wave.data, out = [];
  for (let s = 0; s < SOURCES.length; s++) {
    const [l, rr] = ispec(sp, s * 4 * BINS * FRAMES);
    for (let i = 0; i < L; i++) { l[i] += wave[(s * 2) * L + i]; rr[i] += wave[(s * 2 + 1) * L + i]; }
    out.push([l, rr]);
  }
  if (r.spec.dispose) { r.spec.dispose(); r.wave.dispose(); }
  return out;
}

// left/right: Float32Array at 44.1 kHz. Returns { drums: [L, R], bass, other, vocals }.
export async function separate(left, right, { onProgress = () => {}, overlap = 0.25 } = {}) {
  if (!session) throw new Error("The stem splitter isn't loaded.");
  const n = left.length;
  // Demucs normalises the song by the mean and (unbiased) std of its mono mix
  let sum = 0; for (let i = 0; i < n; i++) sum += (left[i] + right[i]) / 2;
  const mean = sum / n; let v = 0;
  for (let i = 0; i < n; i++) { const d = (left[i] + right[i]) / 2 - mean; v += d * d; }
  const std = Math.sqrt(v / Math.max(1, n - 1)) || 1;
  const stride = Math.floor((1 - overlap) * L);
  const w = new Float32Array(L), half = L >> 1;
  for (let i = 0; i < half; i++) w[i] = (i + 1) / half;
  for (let i = half; i < L; i++) w[i] = (L - i) / half;
  const out = SOURCES.map(() => [new Float32Array(n), new Float32Array(n)]), wsum = new Float32Array(n);
  const offsets = []; for (let o = 0; o < n; o += stride) offsets.push(o);
  for (let k = 0; k < offsets.length; k++) {
    const off = offsets[k], len = Math.min(L, n - off), delta = L - len, start = off - (delta >> 1);
    const wl = new Float32Array(L), wr = new Float32Array(L);
    for (let i = Math.max(0, -start); i < L && start + i < n; i++) { wl[i] = (left[start + i] - mean) / std; wr[i] = (right[start + i] - mean) / std; }
    const y = await runWindow(wl, wr), c = delta >> 1;
    // WebGPU can't be tested in the cloud: check its first window instead. Demucs' four stems add
    // up to the input (normally within 15-30 dB); if they don't, the GPU result is wrong -> wasm.
    if (k === 0 && backend === "webgpu") {
      let pw = 0, err = 0;
      for (let i = 0; i < L; i += 3) { const sum = y[0][0][i] + y[1][0][i] + y[2][0][i] + y[3][0][i]; pw += wl[i] * wl[i]; err += (wl[i] - sum) * (wl[i] - sum); }
      const snr = 10 * Math.log10(pw / err);
      if (!(snr > 6) && pw > 0) throw new Error(`WebGPU result failed the check (${snr.toFixed(1)} dB)`);
    }
    for (let s = 0; s < SOURCES.length; s++) for (let ch = 0; ch < 2; ch++) {
      const src = y[s][ch], dst = out[s][ch];
      for (let i = 0; i < len; i++) dst[off + i] += src[c + i] * w[i];
    }
    for (let i = 0; i < len; i++) wsum[off + i] += w[i];
    onProgress({ stage: "split", done: k + 1, total: offsets.length });
  }
  const stems = {};
  SOURCES.forEach((s, i) => {
    for (const ch of out[i]) for (let j = 0; j < n; j++) ch[j] = ch[j] / wsum[j] * std + mean;
    stems[s] = out[i];
  });
  return stems;
}

// ------------------------------------------------------------------ worker glue
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  let queue = Promise.resolve(), where = null;
  self.onmessage = (e) => {
    const m = e.data;
    queue = queue.then(async () => {
      try {
        if (m.type === "load") {
          where = { base: m.base, files: m.files };
          const b = await load({ ...where, backend: m.backend || "auto", onProgress: (p) => self.postMessage({ type: "progress", ...p }) });
          self.postMessage({ type: "ready", backend: b });
        } else if (m.type === "split") {
          const onProgress = (p) => self.postMessage({ type: "progress", id: m.id, backend, ...p });
          let stems;
          try { stems = await separate(m.left, m.right, { onProgress }); }
          catch (err) {
            if (backend !== "webgpu") throw err;
            console.warn("[stemsplit] WebGPU run failed, again on wasm:", err);
            self.postMessage({ type: "ready", backend: await fallBack(where.base, where.files) });
            stems = await separate(m.left, m.right, { onProgress });
          }
          const transfer = Object.values(stems).flat().map((a) => a.buffer);
          self.postMessage({ type: "result", id: m.id, stems }, transfer);
        }
      } catch (err) {
        self.postMessage({ type: "error", id: m.id, message: (err && err.message) || String(err) });
      }
    });
  };
}
