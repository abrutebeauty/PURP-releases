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
  const waiting = new Map(), cache = new WeakMap(), byKey = new Map();
  let loadProgress = null;

  // In a Web Worker when the page allows it; otherwise the same module runs on the page itself
  // (the page then pauses for a moment on every 7.8 s window, but it still works).
  let direct = null;
  function start() {
    if (ready) return ready;
    ready = startWorker().catch((e) => {
      console.warn("[stemsplit] no worker, splitting on the page:", e);
      if (worker) { worker.terminate(); worker = null; }
      return startDirect();
    });
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
      worker.postMessage({ type: "load", base: BASE() });
    });
  }
  async function startDirect() {
    direct = await import(new URL("stemsplit-worker.js", document.baseURI).href);
    backend = await direct.load({ base: BASE(), onProgress: (m) => loadProgress && loadProgress(m) });
    return backend;
  }
  function runSplit(left, right, onProgress) {
    if (direct) return direct.separate(left, right, { onProgress: (p) => onProgress({ ...p, backend }) });
    const id = nextId++;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject, onProgress });
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

  return { split, start, get backend() { return backend; }, SOURCES: ["drums", "bass", "other", "vocals"] };
})();
