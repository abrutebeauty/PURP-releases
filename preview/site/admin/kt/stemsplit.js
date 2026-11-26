// Stem splitter, page half: hands audio to ui/stemsplit-worker.js (Demucs v4 in ONNX Runtime Web)
// and gives back four AudioBuffers: drums, bass, other (everything melodic that isn't bass) and vocals.
//
//   const stems = await StemSplit.split(audioBuffer, { onProgress: ({ stage, done, total, backend }) => ... });
//   stems.drums, stems.bass, stems.other, stems.vocals   // AudioBuffers at the input's sample rate
//
// The model files sit in stemsplit/ next to the page (made by scripts/stemsplit/, about 86 MB with
// both engines; the browser caches them after the first split). The first split loads them, so it
// takes longer. Splitting runs in a Web Worker so the page keeps playing; it uses the graphics chip
// (WebGPU) where the browser has it, else the CPU (about 2-3x the song's length on a laptop).
// The same audio is only split once (results are kept per buffer, or per `key`).
"use strict";

window.StemSplit = (function () {
  const BASE = () => new URL("stemsplit/", document.baseURI).href;
  const SR = 44100;
  let worker = null, ready = null, backend = "", nextId = 1;
  let direct = null;   // deep debug 16 Nov: was never declared, so "if (direct)" below threw "direct is not defined" on every split with this engine
  const waiting = new Map(), cache = new WeakMap(), byKey = new Map();
  let loadProgress = null;

  // Where the files are. On the published page the model sits in the artifact's asset store, listed in
  // stemsplit-rof/assets.json next to the RoFormer's (keys htdemucs.onnx, htdemucs.q8.N.bin, each
  // { png, bytes }), with the manifest in stemsplit-demucs.json and the ONNX Runtime engine shared with
  // the RoFormer. Otherwise everything is looked for in stemsplit/ (local builds).
  let files = null;
  async function findFiles() {
    if (files) return files;
    const abs = (u) => new URL(u, document.baseURI).href;
    try {
      const r = await fetch(abs("stemsplit-rof/assets.json"));
      if (r.ok) {
        const m = await r.json();
        if (m["htdemucs.onnx"]) {
          const at = (v) => typeof v === "string" ? abs(v) : { png: abs(v.png), bytes: v.bytes };
          const f = { manifest: abs("stemsplit-demucs.json"), graph: at(m["htdemucs.onnx"]), parts: {} };
          for (const [k, v] of Object.entries(m)) if (/^htdemucs\.q8\.\d+\.bin$/.test(k)) f.parts[k] = at(v);
          if (m["ort.wasm.bundle.min.mjs"]) { f.ort = at(m["ort.wasm.bundle.min.mjs"]); f.wasm = at(m["ort-wasm-simd-threaded.wasm"]); }
          if (m["ort.webgpu.bundle.min.mjs"]) { f.ortGpu = at(m["ort.webgpu.bundle.min.mjs"]); f.wasmGpu = [at(m["ort-wasm-simd-threaded.asyncify.0.bin"]), at(m["ort-wasm-simd-threaded.asyncify.1.bin"])]; }
          return (files = f);
        }
      }
    } catch (e) { /* not published that way */ }
    const h = await fetch(BASE() + "htdemucs.json", { method: "HEAD" }).catch(() => null);
    return (files = h && h.ok ? {} : false);
  }
  // true when the Demucs model is on this page (asset store or stemsplit/)
  const available = async () => !!(await findFiles().catch(() => false));
  // rough minutes: Demucs windows are 7.8 s with 25% overlap. Measured 11 Nov: ~13 s per window on the
  // CPU (headless Chromium, 4 threads); the graphics chip is guessed at ~3 s. The speed of the last
  // split on this computer wins once there is one.
  let lastWindow = 0;
  function estimate(seconds) {
    const windows = Math.max(1, Math.ceil(seconds / (7.8 * 0.75)));
    const per = lastWindow || (backend === "webgpu" || (backend === "" && navigator.gpu) ? 3 : 13);
    return Math.max(1, Math.round(windows * per / 60));
  }
  function start() {
    if (ready) return ready;
    ready = findFiles().then((f) => { if (f === false) throw new Error("The Demucs model isn't on this page."); }).then(() => startWorker().catch((e) => {
      console.warn("[stemsplit] no worker, splitting on the page:", e);
      if (worker) { worker.terminate(); worker = null; }
      return startDirect();
    }));
    ready.catch(() => { ready = null; });
    return ready;
  }
  function startWorker() {
    return new Promise((resolve, reject) => {
      try {
        worker = new Worker(new URL("stemsplit-worker.js", document.baseURI), { type: "module" });
      } catch (e) { reject(e); return; }
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "ready") { backend = m.backend; resolve(m.backend); return; }
        if (m.type === "progress") {
          if (m.id && waiting.has(m.id)) waiting.get(m.id).onProgress({ ...m, backend: m.backend || backend });
          else if (loadProgress) loadProgress(m);
          return;
        }
        if (m.type === "result" && waiting.has(m.id)) { waiting.get(m.id).resolve(m.stems); waiting.delete(m.id); return; }
        if (m.type === "error") {
          if (m.id && waiting.has(m.id)) { waiting.get(m.id).reject(new Error(m.message)); waiting.delete(m.id); }
          else reject(new Error(m.message));
        }
      };
      worker.onerror = (e) => {
        e.preventDefault && e.preventDefault();
        const err = new Error("The stem splitter stopped: " + (e.message || "worker error"));
        reject(err);
        for (const w of waiting.values()) w.reject(err);
        waiting.clear();
        if (worker) worker.terminate();
        worker = null; ready = null;
      };
      worker.postMessage({ type: "load", base: BASE(), files: files || {} });
    });
  }
  async function startDirect() {
    direct = await import(new URL("stemsplit-worker.js", document.baseURI).href);
    backend = await direct.load({ base: BASE(), files: files || {}, onProgress: (m) => loadProgress && loadProgress(m) });
    return backend;
  }
  function runSplit(left, right, onProgress) {
    // time each window, for estimate()
    let t0 = 0;
    const timed = (p) => { if (p.stage === "split" && p.done) { if (t0) lastWindow = (performance.now() - t0) / 1000; t0 = performance.now(); } else if (p.stage === "split") t0 = performance.now(); onProgress(p); };
    if (direct) return direct.separate(left, right, { onProgress: (p) => timed({ ...p, backend }) });
    const id = nextId++;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject, onProgress: timed });
      worker.postMessage({ type: "split", id, left, right }, [left.buffer, right.buffer]);
    });
  }

  // Any buffer -> two Float32Arrays at 44.1 kHz.
  async function to44k(buf) {
    let b = buf;
    if (buf.sampleRate !== SR) {
      const off = new OfflineAudioContext(2, Math.ceil(buf.duration * SR), SR);
      const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start();
      b = await off.startRendering();
    }
    const l = b.getChannelData(0), r = b.numberOfChannels > 1 ? b.getChannelData(1) : l;
    return [new Float32Array(l), new Float32Array(r)];
  }
  // Two Float32Arrays at 44.1 kHz -> an AudioBuffer at `rate`, `length` samples long.
  async function fromStems([l, r], rate, length) {
    const src = new AudioBuffer({ numberOfChannels: 2, length: l.length, sampleRate: SR });
    src.copyToChannel(l, 0); src.copyToChannel(r, 1);
    if (rate === SR) return src;
    const off = new OfflineAudioContext(2, length, rate);
    const s = off.createBufferSource(); s.buffer = src; s.connect(off.destination); s.start();
    return off.startRendering();
  }

  // key: optional name for this audio (e.g. the clip's file + span), so the same sound isn't split twice
  async function split(buf, { onProgress = () => {}, key = null } = {}) {
    if (cache.has(buf)) return cache.get(buf);
    if (key && byKey.has(key)) return byKey.get(key);
    const p = (async () => {
      loadProgress = (m) => onProgress({ ...m, stage: m.stage === "split" ? "split" : "loading" });
      onProgress({ stage: "loading", done: 0, total: 1 });
      await start();
      loadProgress = null;
      const [left, right] = await to44k(buf);
      const raw = await runSplit(left, right, onProgress);
      const out = {};
      for (const [k, v] of Object.entries(raw)) out[k] = await fromStems(v, buf.sampleRate, buf.length);
      return out;
    })();
    cache.set(buf, p);
    if (key) byKey.set(key, p);
    p.catch(() => { cache.delete(buf); if (key) byKey.delete(key); });
    return p;
  }

  return { split, start, available, estimate, get backend() { return backend; }, SOURCES: ["drums", "bass", "other", "vocals"] };
})();
