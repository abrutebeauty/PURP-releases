// Stem splitter, BS-RoFormer half (module worker, or imported on the page when workers can't start).
// The model is BS-RoFormer "SW" (6 stems: bass, drums, other, vocals, guitar, piano), cut into 31
// small ONNX graphs by scripts/stemsplit-rof/ so a browser never has to hold the whole attention
// matrix (the full graph peaks near 10 GB, the pieces near 1.7 GB):
//   bandsplit [1,T,4100] -> [1,T,62,256]
//   time_i    [BB,T,256]  12 of them, run a few bands at a time
//   freq_i    [FB,62,256] 12 of them, run a few frames at a time
//   mask_<stem> [1,MT,62,256] -> [1,MT,4100]   only for the stems that were asked for
// The STFT (n_fft 2048, hop 512, periodic hann, centred with reflect padding, like torch.stft) and
// the inverse run here in JS. The song goes through 13.35 s windows, half overlapping, with 10%
// linear fades, padded at both ends by reflection (scripts/stemsplit-rof/pipe.py is the reference).
// Weights ship as int8 in blocks of 64 with fp16 scales, inside 8-bit grey PNGs (the only binary
// type the artifact's asset store takes); the graphs ride at the end of the same blob.
//
// JOINED GRAPHS (7 Nov, quicker): stemsplit-rof-fused.json holds the same pieces joined into one
// "core" graph (bandsplit + all 24 layers, the band / frame groups inside) and one graph per stem
// mask (scripts/stemsplit-rof/fuse.py). They use the same weights in the same pack, so nothing new
// is downloaded except ~0.5 MB of graph. One window = 1 core run + 1 run per stem instead of ~210
// runs, and on the graphics chip the core's output stays on the chip for the masks (no copies to
// and from the chip between pieces, no reshuffling in JS). Same numbers as the pieces, bit for bit.
// If a joined graph can't start or fails, the pieces above take over by themselves.
"use strict";

let ort = null, backend = "", man = null, sessions = null, pack = null, fusedSrc = null, FJ = null, epNow = "wasm";
const onCpu = new Set();   // pieces that failed on the GPU and now run on the CPU

// ------------------------------------------------------------------ files
async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't load ${url.split("/").pop()} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}
async function inflate(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
// our PNGs: 8-bit grey, width 4096, every row filter 0 -> the raw bytes
export async function pngBytes(png, length) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let p = 8, W = 0, H = 0; const idat = [];
  while (p < png.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
    if (type === "IHDR") { W = dv.getUint32(p + 8); H = dv.getUint32(p + 12); }
    if (type === "IDAT") idat.push(png.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const rows = await inflate(idat.length === 1 ? idat[0] : new Uint8Array(await new Blob(idat).arrayBuffer()));
  const out = new Uint8Array(length);
  for (let y = 0, o = 0; y < H && o < length; y++, o += W) out.set(rows.subarray(y * (W + 1) + 1, y * (W + 1) + 1 + Math.min(W, length - o)), o);
  return out;
}
function half2float(h) {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 5.960464477539063e-8;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * Math.pow(2, e - 15);
}

// ------------------------------------------------------------------ packed models
// a packed model (scripts/stemsplit-rof/pack_rof.py): manifest + PNG parts -> one blob, and a way to get any
// graph's bytes and float32 weights back out of it
async function readPack(man, at, onProgress) {
  const blob = new Uint8Array(man.total);
  let o = 0, done = 0;
  for (const part of man.parts) {
    const b = await pngBytes(await fetchBytes(at(part.file)), part.bytes);
    blob.set(b, o); o += b.length;
    onProgress({ stage: "model", done: ++done, total: man.parts.length });
  }
  const L = man.lens, q8 = new Int8Array(blob.buffer, 0, L.q8);
  const sc = new Uint16Array(blob.buffer.slice(L.q8, L.q8 + L.scales * 2));
  const raw = new Float32Array(blob.buffer.slice(L.q8 + L.scales * 2, L.q8 + L.scales * 2 + L.raw * 4));
  const gOff = L.q8 + L.scales * 2 + L.raw * 4;
  const scales = new Float32Array(sc.length); for (let i = 0; i < sc.length; i++) scales[i] = half2float(sc[i]);
  // where each graph's weights and bytes sit in the blob, so any piece can be (re)built on its own
  const where = []; { let qi = 0, si = 0, ri = 0, ti = 0, gg = gOff;
    for (let g = 0; g < man.graphs.length; g++) {
      const w0 = { qi, si, ri, ti, gg }; for (; ti < man.tensors.length && man.tensors[ti].g === g; ti++) {
        const t = man.tensors[ti]; if (t.q) { qi += t.n; si += Math.ceil(t.n / man.block); } else ri += t.n; }
      gg += man.graphs[g].graph; where.push(w0);
    } }
  const weightsOf = (g) => {
    const G = man.graphs[g], w = new Float32Array(G.bytes / 4), B = man.block;
    let { qi, si, ri, ti } = where[g], wo = 0;
    for (; ti < man.tensors.length && man.tensors[ti].g === g; ti++) {
      const t = man.tensors[ti];
      if (t.q) {
        // each tensor was cut into its own blocks of B (the last one padded), one scale each
        for (let i = 0; i < t.n; i++) w[wo + i] = q8[qi + i] * scales[si + ((i / B) | 0)];
        qi += t.n; si += Math.ceil(t.n / B);
      } else { w.set(raw.subarray(ri, ri + t.n), wo); ri += t.n; }
      wo += t.n;
    }
    return w;
  };
  const graph = (g) => blob.subarray(where[g].gg, where[g].gg + man.graphs[g].graph);
  return { weightsOf, graph };
}
const sessionOf = (pack, g, ep) => ort.InferenceSession.create(pack.graph(g), {
  executionProviders: [ep], graphOptimizationLevel: "all",
  externalData: [{ path: "w", data: new Uint8Array(pack.weightsOf(g).buffer) }],
  ...(ep === "wasm" ? { enableCpuMemArena: false, enableMemPattern: false } : {}) });

// ------------------------------------------------------------------ model
// urls: { manifest, parts: { "bsrof.0.png": url, ... } } or base (a folder with the same names).
// opts.backend: "auto" (WebGPU when the browser has it, else wasm) | "webgpu" | "wasm"
let at = null;
export async function load({ base, urls = null, ortUrls = {}, ortModule = null, backend: want = "auto", fusedUrl = null, noFused = false, onProgress = () => {} }) {
  if (sessions || FJ) return backend;
  at = (name) => (urls && urls.parts && urls.parts[name]) || new URL(name, base).href;
  man = await (await fetch((urls && urls.manifest) || at("bsrof.json"))).json();
  pack = await readPack(man, at, onProgress);
  // the joined graphs, when they're on the page and fit this pack
  fusedSrc = null;
  if (!noFused && fusedUrl) {
    try {
      const j = await (await fetch(fusedUrl)).json();
      if (j.pack !== man.total) throw new Error("made for another model pack");
      fusedSrc = {};
      for (const [k, v] of Object.entries(j.graphs)) fusedSrc[k] = { pieces: v.pieces, graph: await gunzipB64(v.gz) };
    } catch (e) { console.warn("[stemsplit-rof] no joined graphs, using the pieces:", (e && e.message) || e); fusedSrc = null; }
  }
  // ONNX Runtime: WebGPU first where there is one
  let gpu = false;
  if (!ortModule && want !== "wasm" && globalThis.navigator && navigator.gpu) {
    try { gpu = !!(await navigator.gpu.requestAdapter()); } catch (e) { gpu = false; }
  }
  const makeOne = (g, ep) => sessionOf(pack, g, ep);
  const make = async (useGpu) => {
    ort = ortModule || await import(useGpu ? ortUrls.gpuModule : ortUrls.module);
    ort.env.wasm.proxy = false;
    ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, (globalThis.navigator && navigator.hardwareConcurrency) || 1) : 1;
    if (!ortModule && (useGpu ? ortUrls.gpuWasm : ortUrls.wasm)) {
      const parts = [].concat(useGpu ? ortUrls.gpuWasm : ortUrls.wasm);
      // a part is a url, or { png, bytes } for one packed into a PNG (asset store)
      const bufs = []; for (const u of parts) bufs.push(typeof u === "string" ? await fetchBytes(u) : await pngBytes(await fetchBytes(u.png), u.bytes));
      const all = new Uint8Array(bufs.reduce((n, b) => n + b.length, 0)); let k = 0; for (const b of bufs) { all.set(b, k); k += b.length; }
      ort.env.wasm.wasmBinary = all.buffer;
    }
    const ep = useGpu ? "webgpu" : "wasm";
    epNow = ep;
    if (fusedSrc) {
      try {
        onProgress({ stage: "prepare", done: 0, total: 1 });
        FJ = { core: await fusedSession("core", ep), masks: {}, ep };
        onProgress({ stage: "prepare", done: 1, total: 1 });
        return {};
      } catch (e) { console.warn(`[stemsplit-rof] joined graph didn't start on ${ep}, using the pieces:`, e); FJ = null; }
    }
    return makePieces(ep, onProgress);
  };
  makePieces = async (ep, onProgress = () => {}) => {
    const out = {};
    for (let g = 0; g < man.graphs.length; g++) {
      out[man.graphs[g].name] = await makeOne(g, ep);
      onProgress({ stage: "prepare", done: g + 1, total: man.graphs.length });
    }
    return out;
  };
  if (gpu) {
    try { sessions = await make(true); backend = "webgpu"; }
    catch (e) { console.warn("[stemsplit-rof] WebGPU didn't start, using wasm:", e); sessions = null; FJ = null; ort = null; }
  }
  if (!sessions) { sessions = await make(false); backend = "wasm"; }
  // a piece the graphics chip can't run moves to the CPU on its own; the rest stay on the GPU
  load.toCpu = async (name) => {
    const g = man.graphs.findIndex((x) => x.name === name);
    if (sessions[name] && sessions[name].release) await sessions[name].release().catch(() => {});
    sessions[name] = await makeOne(g, "wasm"); onCpu.add(name);
  };
  load.reset = async () => { await dropFused(); for (const s of Object.values(sessions || {})) if (s.release) await s.release().catch(() => {}); sessions = null; };
  load.retryWasm = async () => { await load.reset(); ort = null; sessions = await make(false); backend = "wasm"; onCpu.clear(); return backend; };
  return backend;
}
export const info = () => ({ backend, joined: !!FJ, onCpu: [...onCpu], stems: man ? man.stems : [], chunk: man ? man.chunk : 0 });

// ------------------------------------------------------------------ joined graphs
let makePieces = null;
async function gunzipB64(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const st = new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
// the weights of a joined graph = its pieces' weights one after the other
function joinedWeights(pieces) {
  const ws = pieces.map((name) => pack.weightsOf(man.graphs.findIndex((g) => g.name === name)));
  const all = new Float32Array(ws.reduce((n, w) => n + w.length, 0)); let o = 0;
  for (const w of ws) { all.set(w, o); o += w.length; }
  return new Uint8Array(all.buffer);
}
function fusedSession(name, ep) {
  const src = fusedSrc[name];
  return ort.InferenceSession.create(src.graph, {
    executionProviders: [ep], graphOptimizationLevel: "all",
    externalData: [{ path: "w", data: joinedWeights(src.pieces) }],
    // the core's output stays on the graphics chip: the masks read it from there
    ...(ep === "webgpu" && name === "core" ? { preferredOutputLocation: "gpu-buffer" } : {}),
    ...(ep === "wasm" ? { enableCpuMemArena: false, enableMemPattern: false } : {}) });
}
async function maskSession(s) {
  if (!FJ.masks[s]) {
    try { FJ.masks[s] = await fusedSession("mask_" + s + "F", FJ.ep); FJ.masks[s].ep = FJ.ep; }
    catch (e) { if (FJ.ep !== "webgpu") throw e; console.warn(`[stemsplit-rof] mask ${s} didn't start on the GPU, using the CPU:`, e); FJ.masks[s] = await fusedSession("mask_" + s + "F", "wasm"); FJ.masks[s].ep = "wasm"; }
  }
  return FJ.masks[s];
}
async function dropFused() {
  if (!FJ) return;
  for (const s of [FJ.core, ...Object.values(FJ.masks)]) if (s && s.release) await s.release().catch(() => {});
  FJ = null;
}
async function coreJoined(spec, T, stems) {
  const r = await FJ.core.run({ x: new ort.Tensor("float32", spec, [1, T, 4100]) });
  const h = r.h, masks = {};
  try {
    let hCpu = null;
    for (const s of stems) {
      const ms = await maskSession(s);
      let feed = h;
      if (ms.ep === "wasm" && h.location === "gpu-buffer") feed = hCpu || (hCpu = new ort.Tensor("float32", await h.getData(), h.dims));
      const o = await ms.run({ h: feed });
      const d = o.y.data;
      for (let i = 0; i < 64; i++) if (!Number.isFinite(d[(i * 7919) % d.length])) throw new Error(`mask ${s} gave NaN`);
      masks[s] = d;
      if (o.y.dispose) o.y.dispose();
    }
  } finally { if (h.dispose) h.dispose(); }
  return masks;
}


// ------------------------------------------------------------------ STFT
const N = 2048, HOP = 512, F = 1025;
const WIN = new Float32Array(N); for (let i = 0; i < N; i++) WIN[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
const REV = new Uint32Array(N), COS = new Float32Array(N / 2), SIN = new Float32Array(N / 2);
for (let i = 0, j = 0; i < N; i++) { REV[i] = j; let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; }
for (let i = 0; i < N / 2; i++) { COS[i] = Math.cos(-2 * Math.PI * i / N); SIN[i] = Math.sin(-2 * Math.PI * i / N); }
function fft(re, im, inv) {
  for (let i = 0; i < N; i++) { const j = REV[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= N; len <<= 1) {
    const h = len >> 1, step = N / len;
    for (let i = 0; i < N; i += len) for (let k = 0; k < h; k++) {
      const wr = COS[k * step], wi = inv ? -SIN[k * step] : SIN[k * step], p = i + k, q = p + h;
      const tr = re[q] * wr - im[q] * wi, ti = re[q] * wi + im[q] * wr;
      re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
    }
  }
}
const reflect = (i, n) => { while (i < 0 || i >= n) i = i < 0 ? -i : 2 * (n - 1) - i; return i; };
// x: one channel of the window (length chunk). Writes into spec [T, 4100] at channel s.
function stftInto(x, spec, s, T) {
  const re = new Float32Array(N), im = new Float32Array(N), n = x.length;
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < N; i++) { re[i] = x[reflect(t * HOP + i - N / 2, n)] * WIN[i]; im[i] = 0; }
    fft(re, im, false);
    const o = t * 4100;
    for (let f = 0; f < F; f++) { const k = o + (f * 2 + s) * 2; spec[k] = re[f]; spec[k + 1] = im[f]; }
  }
}
// masked spectrum of channel s back to audio (length n)
function istftFrom(spec, mask, s, T, n) {
  const re = new Float32Array(N), im = new Float32Array(N);
  const out = new Float32Array(N + HOP * (T - 1)), env = new Float32Array(out.length);
  for (let t = 0; t < T; t++) {
    const o = t * 4100;
    for (let f = 0; f < F; f++) {
      const k = o + (f * 2 + s) * 2, a = spec[k], b = spec[k + 1], c = mask[k], d = mask[k + 1];
      re[f] = a * c - b * d; im[f] = a * d + b * c;
    }
    for (let f = 1; f < N / 2; f++) { re[N - f] = re[f]; im[N - f] = -im[f]; }
    im[0] = 0; im[N / 2] = 0;
    fft(re, im, true);
    const p = t * HOP;
    for (let i = 0; i < N; i++) { out[p + i] += re[i] / N * WIN[i]; env[p + i] += WIN[i] * WIN[i]; }
  }
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const e = env[i + N / 2]; y[i] = e > 1e-8 ? out[i + N / 2] / e : 0; }
  return y;
}

// ------------------------------------------------------------------ the network, in pieces
// run one piece; a failing run says which one (ONNX Runtime's own errors can be a bare number)
async function runPiece(name, feeds) {
  try { return await sessions[name].run(feeds); }
  catch (e) {
    if (backend === "webgpu" && !onCpu.has(name)) {
      console.warn(`[stemsplit-rof] ${name} failed on the GPU (${(e && e.message) || e}), moving it to the CPU`);
      await load.toCpu(name);
      return sessions[name].run(feeds);
    }
    throw new Error(`${name} failed on ${backend}: ${(e && e.message) || e}`);
  }
}
async function core(spec, T, stems) {
  const { BB, FB, MT } = man, D = 256, NB = man.bands;
  let x = (await runPiece("bandsplit", { x: new ort.Tensor("float32", spec, [1, T, 4100]) })).y.data;   // [T,62,256]
  x = new Float32Array(x);
  const nbP = Math.ceil(NB / BB) * BB, tP = Math.ceil(T / FB) * FB;
  const xb = new Float32Array(nbP * T * D), xf = new Float32Array(tP * NB * D);
  for (let L = 0; L < 12; L++) {
    // [T,62,D] -> [62,T,D]
    for (let t = 0; t < T; t++) for (let b = 0; b < NB; b++) xb.set(x.subarray((t * NB + b) * D, (t * NB + b + 1) * D), (b * T + t) * D);
    for (let a = 0; a < NB; a += BB) {
      const r = await runPiece("time_" + L, { x: new ort.Tensor("float32", xb.subarray(a * T * D, (a + BB) * T * D), [BB, T, D]) });
      xb.set(r.y.data, a * T * D); if (r.y.dispose) r.y.dispose();
    }
    for (let b = 0; b < NB; b++) for (let t = 0; t < T; t++) xf.set(xb.subarray((b * T + t) * D, (b * T + t + 1) * D), (t * NB + b) * D);
    for (let a = 0; a < T; a += FB) {
      const r = await runPiece("freq_" + L, { x: new ort.Tensor("float32", xf.subarray(a * NB * D, (a + FB) * NB * D), [FB, NB, D]) });
      xf.set(r.y.data, a * NB * D); if (r.y.dispose) r.y.dispose();
    }
    x = xf.subarray(0, T * NB * D);
  }
  const tm = Math.ceil(T / MT) * MT, xm = new Float32Array(tm * NB * D); xm.set(x);
  const masks = {};
  for (const s of stems) {
    const m = new Float32Array(tm * 4100);
    for (let a = 0; a < T; a += MT) {
      const r = await runPiece("mask_" + s, { x: new ort.Tensor("float32", xm.subarray(a * NB * D, (a + MT) * NB * D), [1, MT, NB, D]) });
      m.set(r.y.data, a * 4100); if (r.y.dispose) r.y.dispose();
    }
    masks[s] = m;
  }
  return masks;
}

// left/right: Float32Array at 44.1 kHz. stems: which to make (default all six).
// Returns { <stem>: [L, R] }.
export async function separate(left, right, { stems = null, overlap = 2, onProgress = () => {} } = {}) {
  if (!sessions && !FJ) throw new Error("The stem splitter isn't loaded.");
  stems = (stems || man.stems).filter((s) => man.stems.includes(s));
  const chunk = man.chunk, T = man.T, step = Math.floor(chunk / overlap), border = chunk - step, n = left.length;
  const padded = n > 2 * border;
  const tot = padded ? n + 2 * border : n;
  const src = (ch, i) => { const j = padded ? i - border : i; return ch[padded ? reflect(j, n) : j]; };
  const fl = Math.floor(chunk / 10), fade = new Float32Array(chunk).fill(1);
  for (let i = 0; i < fl; i++) { fade[i] = i / (fl - 1); fade[chunk - 1 - i] = i / (fl - 1); }
  const acc = {}; for (const s of stems) acc[s] = [new Float32Array(tot), new Float32Array(tot)];
  const cnt = new Float32Array(tot);
  const starts = []; for (let i = 0; i < tot; i += step) starts.push(i);
  const wl = new Float32Array(chunk), wr = new Float32Array(chunk), spec = new Float32Array(T * 4100);
  // say how many pieces there are before the first one (it can take a while), not "Starting" all that time
  onProgress({ stage: "split", done: 0, total: starts.length, backend });
  for (let k = 0; k < starts.length; k++) {
    const i = starts[k], len = Math.min(chunk, tot - i);
    wl.fill(0); wr.fill(0);
    for (let j = 0; j < len; j++) { wl[j] = src(left, i + j); wr[j] = src(right, i + j); }
    stftInto(wl, spec, 0, T); stftInto(wr, spec, 1, T);
    const t0 = performance.now();
    let masks;
    if (FJ) {
      try { masks = await coreJoined(spec, T, stems); }
      catch (e) {
        // the joined graph didn't work here: the pieces take over (same sound), on the same chip
        console.warn(`[stemsplit-rof] joined graph failed on ${FJ.ep} (${(e && e.message) || e}), using the pieces`);
        const ep = FJ.ep; await dropFused(); fusedSrc = null;
        sessions = await makePieces(ep);
        masks = await core(spec, T, stems);
      }
    } else masks = await core(spec, T, stems);
    const ms = performance.now() - t0;
    const w = fade.slice(); if (i === 0) w.fill(1, 0, fl); if (i + step >= tot) w.fill(1, chunk - fl);
    for (const s of stems) for (let c = 0; c < 2; c++) {
      const y = istftFrom(spec, masks[s], c, T, chunk), a = acc[s][c];
      for (let j = 0; j < len; j++) a[i + j] += y[j] * w[j];
    }
    for (let j = 0; j < len; j++) cnt[i + j] += w[j];
    onProgress({ stage: "split", done: k + 1, total: starts.length, backend, joined: !!FJ, ms: Math.round(ms) });
  }
  const off = padded ? border : 0, out = {};
  for (const s of stems) out[s] = acc[s].map((a) => { const y = new Float32Array(n); for (let j = 0; j < n; j++) y[j] = a[off + j] / Math.max(cnt[off + j], 1e-8); return y; });
  return out;
}

// ------------------------------------------------------------------ detail splitters
// Run on one stem after the main split, when the pick box asks for parts:
//   drums: MDX23C DrumSep (kick, snare, toms, hh, ride, crash) on the drum stem
//   vocals: UVR MDX-Net karaoke 2 on the vocal stem: gives the backing; lead = vocal - backing
// Both take a cut spectrum [1, 4 (L re, L im, R re, R im), dim_f, dim_t] and give the same shape per
// part, so one runner does both. The manifest (<kind>.json, same pack format) carries the settings:
// n_fft, hop, dim_f, dim_t, overlap, zero (low bins cleared first), stems, invert ({ name, scale }).
// scripts/stemsplit-rof/detail_ref.py is the reference.
const detail = {};   // kind -> { man, session }
function makeFFT(N) {
  let P = 1; while (N % (P * 2) === 0) P *= 2;
  const R = N / P, rev = new Uint32Array(P), cs = new Float32Array(P / 2), sn = new Float32Array(P / 2);
  for (let i = 0, j = 0; i < P; i++) { rev[i] = j; let bit = P >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; }
  for (let i = 0; i < P / 2; i++) { cs[i] = Math.cos(-2 * Math.PI * i / P); sn[i] = Math.sin(-2 * Math.PI * i / P); }
  const p2 = (re, im, inv) => {
    for (let i = 0; i < P; i++) { const j = rev[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= P; len <<= 1) {
      const h = len >> 1, step = P / len;
      for (let i = 0; i < P; i += len) for (let k = 0; k < h; k++) {
        const wr = cs[k * step], wi = inv ? -sn[k * step] : sn[k * step], p = i + k, q = p + h;
        const tr = re[q] * wr - im[q] * wi, ti = re[q] * wi + im[q] * wr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
      }
    }
  };
  if (R === 1) return p2;
  // N = R * P: R power-of-two transforms on every R-th sample, then joined with twiddles
  const sr = [], si = []; for (let r = 0; r < R; r++) { sr.push(new Float32Array(P)); si.push(new Float32Array(P)); }
  const tw = new Float64Array(2 * N); for (let k = 0; k < N; k++) { tw[2 * k] = Math.cos(-2 * Math.PI * k / N); tw[2 * k + 1] = Math.sin(-2 * Math.PI * k / N); }
  return (re, im, inv) => {
    for (let r = 0; r < R; r++) { const a = sr[r], b = si[r]; for (let m = 0; m < P; m++) { a[m] = re[m * R + r]; b[m] = im[m * R + r]; } p2(a, b, inv); }
    for (let k = 0; k < N; k++) {
      const km = k % P; let xr = sr[0][km], xi = si[0][km];
      for (let r = 1; r < R; r++) {
        const w = (r * k) % N, c = tw[2 * w], d = inv ? -tw[2 * w + 1] : tw[2 * w + 1], a = sr[r][km], b = si[r][km];
        xr += a * c - b * d; xi += a * d + b * c;
      }
      re[k] = xr; im[k] = xi;
    }
  };
}
function mdxSpec(m) {
  const N = m.n_fft, H = m.hop, F = m.dim_f, T = m.dim_t, fft = makeFFT(N), K = N / 2 + 1;
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const re = new Float32Array(N), im = new Float32Array(N), len = H * (T - 1);
  return {
    // x: one channel (length len) -> spec[(c*2+ri)*F*T + f*T + t]
    forward(x, spec, c) {
      for (let t = 0; t < T; t++) {
        for (let i = 0; i < N; i++) { re[i] = x[reflect(t * H + i - N / 2, len)] * win[i]; im[i] = 0; }
        fft(re, im, false);
        for (let f = 0; f < F; f++) { spec[((c * 2) * F + f) * T + t] = re[f]; spec[((c * 2 + 1) * F + f) * T + t] = im[f]; }
      }
    },
    // y: one part's [4, F, T] -> channel c, length len
    inverse(y, c) {
      const out = new Float32Array(N + H * (T - 1)), env = new Float32Array(out.length);
      for (let t = 0; t < T; t++) {
        re.fill(0); im.fill(0);
        for (let f = 0; f < F; f++) { re[f] = y[((c * 2) * F + f) * T + t]; im[f] = y[((c * 2 + 1) * F + f) * T + t]; }
        for (let f = 1; f < N / 2; f++) { re[N - f] = re[f]; im[N - f] = -im[f]; }
        im[0] = 0; im[N / 2] = 0;
        fft(re, im, true);
        const p = t * H;
        for (let i = 0; i < N; i++) { out[p + i] += re[i] / N * win[i]; env[p + i] += win[i] * win[i]; }
      }
      const r = new Float32Array(len);
      for (let i = 0; i < len; i++) { const e = env[i + N / 2]; r[i] = e > 1e-8 ? out[i + N / 2] / e : 0; }
      return r;
    },
    len, K,
  };
}
export async function loadDetail(kind, onProgress = () => {}) {
  if (detail[kind]) return detail[kind];
  if (!ort) throw new Error("Load the main splitter first.");
  const dm = await (await fetch(at(kind + ".json"))).json();
  const pack = await readPack(dm, at, (p) => onProgress({ ...p, stage: "model", kind }));
  let session = null, ep = backend === "webgpu" ? "webgpu" : "wasm";
  try { session = await sessionOf(pack, 0, ep); }
  catch (e) { if (ep !== "webgpu") throw e; console.warn(`[stemsplit-rof] ${kind} didn't start on the GPU, using the CPU:`, e); ep = "wasm"; session = await sessionOf(pack, 0, ep); }
  detail[kind] = { man: dm, session, ep, pack };
  return detail[kind];
}
export async function separateDetail(kind, left, right, { overlap = null, onProgress = () => {} } = {}) {
  const d = await loadDetail(kind, onProgress), m = d.man, S = m.stems.length, F = m.dim_f, T = m.dim_t;
  const sp = mdxSpec(m), chunk = sp.len, step = Math.floor(chunk / (overlap || m.overlap || 2)), lead = chunk - step, n = left.length;
  const tot = lead + n + chunk;
  const at2 = (ch, i) => { const j = i - lead; return j >= 0 && j < n ? ch[j] : 0; };
  const w = new Float32Array(chunk); for (let i = 0; i < chunk; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (chunk - 1));
  const acc = m.stems.map(() => [new Float32Array(tot), new Float32Array(tot)]), div = new Float32Array(tot);
  const xl = new Float32Array(chunk), xr = new Float32Array(chunk), spec = new Float32Array(4 * F * T);
  const starts = []; for (let i = 0; i < lead + n; i += step) starts.push(i);
  const inName = d.session.inputNames[0], outName = d.session.outputNames[0];
  for (let k = 0; k < starts.length; k++) {
    const i = starts[k];
    for (let j = 0; j < chunk; j++) { xl[j] = at2(left, i + j); xr[j] = at2(right, i + j); }
    sp.forward(xl, spec, 0); sp.forward(xr, spec, 1);
    if (m.zero) for (let c = 0; c < 4; c++) for (let f = 0; f < m.zero; f++) spec.fill(0, (c * F + f) * T, (c * F + f + 1) * T);
    let r;
    try { r = await d.session.run({ [inName]: new ort.Tensor("float32", spec.slice(), [1, 4, F, T]) }); }
    catch (e) {
      if (d.ep !== "webgpu") throw e;
      console.warn(`[stemsplit-rof] ${kind} failed on the GPU, moving it to the CPU:`, e);
      d.session = await sessionOf(d.pack, 0, "wasm"); d.ep = "wasm";
      r = await d.session.run({ [inName]: new ort.Tensor("float32", spec.slice(), [1, 4, F, T]) });
    }
    const y = r[outName].data;
    for (let s = 0; s < S; s++) for (let c = 0; c < 2; c++) {
      const a = sp.inverse(y.subarray(s * 4 * F * T, (s + 1) * 4 * F * T), c), o = acc[s][c];
      for (let j = 0; j < chunk; j++) o[i + j] += a[j] * w[j];
    }
    for (let j = 0; j < chunk; j++) div[i + j] += w[j];
    if (r[outName].dispose) r[outName].dispose();
    onProgress({ stage: "detail", kind, done: k + 1, total: starts.length, backend: d.ep });
  }
  const out = {};
  m.stems.forEach((s, si) => { out[s] = acc[si].map((a) => { const y = new Float32Array(n); for (let j = 0; j < n; j++) y[j] = a[lead + j] / Math.max(div[lead + j], 1e-8); return y; }); });
  // a karaoke model gives the backing; the lead is what's left of the vocal
  if (m.invert) { const b = out[m.stems[0]], sc = m.invert.scale || 1; out[m.invert.name] = [left, right].map((x, c) => { const y = new Float32Array(n); for (let j = 0; j < n; j++) y[j] = x[j] - b[c][j] * sc; return y; }); }
  return out;
}

// for tests: run one piece as it is set up now, or move it to the CPU
export async function _piece(name, data, dims) { const r = await sessions[name].run({ x: new ort.Tensor("float32", data, dims) }); return new Float32Array(r.y.data); }
export const _toCpu = (name) => load.toCpu(name);

// ------------------------------------------------------------------ worker glue
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  let queue = Promise.resolve();
  self.onmessage = (e) => {
    const m = e.data;
    queue = queue.then(async () => {
      try {
        if (m.type === "load") {
          const b = await load({ ...m.opts, onProgress: (p) => self.postMessage({ type: "progress", ...p }) });
          self.postMessage({ type: "ready", backend: b, stems: man.stems });
        } else if (m.type === "detail") {
          const onProgress = (p) => self.postMessage({ type: "progress", id: m.id, ...p });
          const stems = await separateDetail(m.kind, m.left, m.right, { onProgress });
          self.postMessage({ type: "result", id: m.id, stems }, Object.values(stems).flat().map((a) => a.buffer).filter((b, i, all) => all.indexOf(b) === i));
        } else if (m.type === "split") {
          const onProgress = (p) => self.postMessage({ type: "progress", id: m.id, ...p });
          let stems;
          try { stems = await separate(m.left, m.right, { stems: m.stems, onProgress }); }
          catch (err) {
            if (backend !== "webgpu") throw err;
            console.warn("[stemsplit-rof] WebGPU run failed, again on wasm:", err);
            self.postMessage({ type: "ready", backend: await load.retryWasm(), stems: man.stems });
            stems = await separate(m.left, m.right, { stems: m.stems, onProgress });
          }
          self.postMessage({ type: "result", id: m.id, stems }, Object.values(stems).flat().map((a) => a.buffer));
        }
      } catch (err) {
        self.postMessage({ type: "error", id: m.id, message: (err && err.message) || String(err) });
      }
    });
  };
}
