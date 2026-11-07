// Stem splitter, BS-RoFormer page half: hands audio to ui/stemsplit-rof-worker.js and gives back
// AudioBuffers for the stems that were asked for (bass, drums, other, vocals, guitar, piano).
//
//   if (await StemSplitRof.available()) {
//     const stems = await StemSplitRof.split(audioBuffer, { stems: ["vocals", "drums"], onProgress });
//   }
//   StemSplitRof.estimate(seconds, nStems)   // rough minutes, for the pick box
//   StemSplitRof.hasDetail("drums" | "vocals")  // parts inside a stem: drum kit pieces, lead vs backing
//   const parts = await StemSplitRof.splitDetail("drums", drumStemBuffer, { onProgress })
//     drums -> kick, snare, toms, hh, ride, crash (MDX23C DrumSep); vocals -> lead, backing (UVR karaoke 2)
//
// Where the files are: stemsplit-rof/assets.json (written when the page is published) maps each
// model file name to its asset-store URL, e.g. { "bsrof.json": "/_blob/...", "bsrof.0.png": ... }.
// Without it the files are looked for in stemsplit-rof/ next to the page. ONNX Runtime itself comes
// from stemsplit/ (the same engine files the Demucs splitter uses).
// Needs WebGPU to be quick: on the CPU it is far slower than the song (about 30x on a laptop core),
// so without WebGPU `available()` says no and the app falls back to Demucs.
"use strict";

window.StemSplitRof = (function () {
  const SR = 44100;
  const base = (p) => new URL(p, document.baseURI).href;
  const ORT = {
    module: base("stemsplit/ort.wasm.bundle.min.mjs"), wasm: base("stemsplit/ort-wasm-simd-threaded.wasm"),
    gpuModule: base("stemsplit/ort.webgpu.bundle.min.mjs"),
    gpuWasm: [base("stemsplit/ort-wasm-simd-threaded.asyncify.0.bin"), base("stemsplit/ort-wasm-simd-threaded.asyncify.1.bin")],
  };
  const DETAIL = { drums: "drumsep", vocals: "karaoke" };   // kind -> model file name
  const detailOn = new Set();
  let urls = null, hasGpu = null, worker = null, ready = null, backend = "", nextId = 1, stemsAll = [];
  const waiting = new Map(), byKey = new Map();
  let loadProgress = null;

  async function findFiles() {
    if (urls) return urls;
    try {
      const r = await fetch(base("stemsplit-rof/assets.json"));
      if (r.ok) {
        const m = await r.json(); urls = { manifest: base(m["bsrof.json"]), parts: Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, base(v)])) };
        // the ONNX Runtime engine can sit in the asset store too: the .mjs as JS, each wasm part as a
        // PNG like the weights ({ png, bytes }), since the page version has no room for 37 MB more
        const eng = (k) => m[k] && (typeof m[k] === "string" ? base(m[k]) : { png: base(m[k].png), bytes: m[k].bytes });
        if (m["ort.wasm.bundle.min.mjs"]) { ORT.module = eng("ort.wasm.bundle.min.mjs"); ORT.wasm = eng("ort-wasm-simd-threaded.wasm"); }
        if (m["ort.webgpu.bundle.min.mjs"]) { ORT.gpuModule = eng("ort.webgpu.bundle.min.mjs"); ORT.gpuWasm = [eng("ort-wasm-simd-threaded.asyncify.0.bin"), eng("ort-wasm-simd-threaded.asyncify.1.bin")]; }
        for (const [kind, file] of Object.entries(DETAIL)) if (m[file + ".json"]) detailOn.add(kind);
        return urls;
      }
    } catch (e) { /* not published that way */ }
    const r = await fetch(base("stemsplit-rof/bsrof.json"), { method: "HEAD" }).catch(() => null);
    if (r && r.ok) {
      urls = { manifest: base("stemsplit-rof/bsrof.json"), parts: {}, base: base("stemsplit-rof/") };
      for (const [kind, file] of Object.entries(DETAIL)) {
        const h = await fetch(base(`stemsplit-rof/${file}.json`), { method: "HEAD" }).catch(() => null);
        if (h && h.ok) detailOn.add(kind);
      }
      return urls;
    }
    return null;
  }
  async function gpuOk() {
    if (hasGpu != null) return hasGpu;
    try { hasGpu = !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) { hasGpu = false; }
    return hasGpu;
  }
  // true when the model files are on this page and the browser has a graphics chip to run them
  async function available() {
    if (window.KT2_ROF_OFF) return false;
    if (!(await gpuOk()) && !window.KT2_ROF_CPU) return false;
    return !!(await findFiles());
  }
  // rough wait in minutes: measured ~200 s per 13 s window on one cloud CPU core in wasm; WebGPU on
  // a Mac is expected ~10-20x quicker (not measured yet). Windows half overlap -> 2 per 13.35 s.
  let lastWindow = 0;   // seconds the last window took on this computer (measured while splitting)
  function estimate(seconds, nStems = 6) {
    const windows = Math.ceil((seconds + 13.35) / 6.675);
    const perWindow = lastWindow || ((backend === "wasm" || hasGpu === false) ? 200 : 15);
    const stemShare = 0.75 + 0.25 * (nStems / 6);
    return Math.max(1, Math.round(windows * perWindow * stemShare / 60));
  }

  function start() {
    if (ready) return ready;
    ready = (async () => {
      const files = await findFiles();
      if (!files) throw new Error("The RoFormer model isn't on this page.");
      // fusedUrl: the joined graphs (one core + one per stem, same weights): far fewer trips to the
      // graphics chip. KT2_ROF_PIECES = true runs the 31 pieces as before.
      const opts = { base: files.base || base("stemsplit-rof/"), urls: files.base ? null : files, ortUrls: ORT, backend: window.KT2_ROF_CPU ? "wasm" : "auto",
        fusedUrl: base("stemsplit-rof-fused.json"), noFused: !!window.KT2_ROF_PIECES };
      worker = new Worker(base("stemsplit-rof-worker.js"), { type: "module" });
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "progress") { if (m.ms) lastWindow = m.ms / 1000; if (m.id && waiting.has(m.id)) waiting.get(m.id).onProgress(m); else if (loadProgress) loadProgress(m); }
        else if (m.type === "ready") { backend = m.backend; stemsAll = m.stems; if (waiting.has("load")) waiting.get("load").resolve(); }
        else if (m.type === "result") { const w = waiting.get(m.id); waiting.delete(m.id); if (w) w.resolve(m.stems); }
        else if (m.type === "error") {
          const w = waiting.get(m.id || "load"); waiting.delete(m.id || "load");
          if (w) w.reject(new Error(m.message));
        }
      };
      worker.onerror = (e) => { for (const w of waiting.values()) w.reject(new Error(e.message || "The splitter stopped")); waiting.clear(); };
      await new Promise((resolve, reject) => { waiting.set("load", { resolve, reject }); worker.postMessage({ type: "load", opts }); });
      waiting.delete("load");
      return backend;
    })().catch((e) => { ready = null; if (worker) { worker.terminate(); worker = null; } throw e; });
    return ready;
  }

  function toBuffers(out, sr, length, ctxSr) {
    const res = {};
    for (const [k, [l, r]] of Object.entries(out)) {
      const b = new AudioBuffer({ numberOfChannels: 2, length: l.length, sampleRate: SR });
      b.copyToChannel(l, 0); b.copyToChannel(r, 1);
      res[k] = b;
    }
    return res;
  }
  async function resampled(buf) {
    if (buf.sampleRate === SR && buf.numberOfChannels === 2) return [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()];
    const len = Math.round(buf.duration * SR), oc = new OfflineAudioContext(2, len, SR), s = oc.createBufferSource();
    s.buffer = buf; s.connect(oc.destination); s.start();
    const r = await oc.startRendering();
    return [r.getChannelData(0).slice(), r.getChannelData(1).slice()];
  }

  // buf: AudioBuffer. stems: names to make (default all). key: same key = same result, kept.
  async function split(buf, { stems = null, key = null, onProgress = () => {} } = {}) {
    const k = key && JSON.stringify([key, stems]);
    if (k && byKey.has(k)) return byKey.get(k);
    loadProgress = (p) => onProgress({ ...p, stage: p.stage === "model" ? "model" : "engine" });
    onProgress({ stage: "start" });
    await start();
    const [left, right] = await resampled(buf);
    const id = nextId++;
    const out = await new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject, onProgress: (p) => onProgress({ ...p, backend }) });
      worker.postMessage({ type: "split", id, left, right, stems }, [left.buffer, right.buffer]);
    });
    let res = toBuffers(out);
    if (buf.sampleRate !== SR) {
      const conv = {};
      for (const [name, b] of Object.entries(res)) {
        const oc = new OfflineAudioContext(2, buf.length, buf.sampleRate), s = oc.createBufferSource();
        s.buffer = b; s.connect(oc.destination); s.start(); conv[name] = await oc.startRendering();
      }
      res = conv;
    }
    if (k) byKey.set(k, res);
    return res;
  }

  // parts inside one stem (buf = that stem). Runs after the main split, in the same worker.
  const hasDetail = (kind) => !window.KT2_DETAIL_OFF && detailOn.has(kind);
  async function splitDetail(kind, buf, { onProgress = () => {} } = {}) {
    if (!hasDetail(kind)) throw new Error(`No ${kind} parts model on this page.`);
    loadProgress = (p) => onProgress({ ...p, stage: p.stage === "model" ? "model" : "engine" });
    await start();
    const [left, right] = await resampled(buf);
    const id = nextId++;
    const out = await new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject, onProgress: (p) => onProgress({ ...p }) });
      worker.postMessage({ type: "detail", id, kind: DETAIL[kind], left, right }, [left.buffer, right.buffer]);
    });
    let res = toBuffers(out);
    if (buf.sampleRate !== SR) {
      const conv = {};
      for (const [name, b] of Object.entries(res)) {
        const oc = new OfflineAudioContext(2, buf.length, buf.sampleRate), s = oc.createBufferSource();
        s.buffer = b; s.connect(oc.destination); s.start(); conv[name] = await oc.startRendering();
      }
      res = conv;
    }
    return res;
  }
  // rough extra minutes for the parts (DrumSep is the slow one)
  function estimateDetail(kind, seconds) {
    const perMin = (backend === "wasm" || hasGpu === false) ? (kind === "drums" ? 6 : 2) : (kind === "drums" ? 0.6 : 0.2);
    return Math.max(1, Math.round(seconds / 60 * perMin));
  }

  return { available, split, estimate, hasDetail, splitDetail, estimateDetail, get backend() { return backend; }, get stems() { return stemsAll.slice(); } };
})();
