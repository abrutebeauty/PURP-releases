// TOY MACHINE: EARS for CREATE SOUND (approved by Eman 10 Nov: an ~80 MB download the first time).
//
// The audio half of CLAP (Xenova/larger_clap_general, quantized) turns any sound into 512 numbers
// that describe how it sounds. CREATE SOUND renders each offspring A-D and asks: which one still
// sounds most like the sounds you dropped? That one is picked first and gets a dot.
// Only the audio side is loaded (the text side would be a second, bigger download): the words
// already shape the synth, the ears check that your sounds are still heard.
//
//   ToyMachineEars.warm()               // start the download in the background (first CREATE SOUND open)
//   ToyMachineEars.ready                // true once loaded
//   await ToyMachineEars.embed(f32, sr) // -> Float32Array(512), unit length (null if not ready / failed)
//   ToyMachineEars.cos(a, b)
// Everything fails quietly: without the ears CREATE SOUND works exactly as before.
// Plain browser JS, ASCII only. KT2_TM_EARS_OFF = never download.
//
// WHERE THE FILES COME FROM: only the artifact's asset store (the page may not fetch other hosts, one asset
// is at most 20 MiB, and the store only takes web types). Big files (model, wasm) are cut into parts and each
// part is packed into an 8-bit grey PNG (width 4096, filter 0: the same packing as stemsplit-rof).
// window.TM_EARS_FILES maps each file name to its asset: a URL, or { png: url, bytes: n } for a packed part, e.g.
//   { "transformers.min.js": "/_blob/..", "config.json": "/_blob/..", "preprocessor_config.json": "/_blob/..",
//     "audio_model_quantized.onnx.0.png": { png: "/_blob/..", bytes: 18000000 }, ... }
// (or is the URL of a JSON file holding that map). Template + checks: project files toy-machine/ears/.
// Without TM_EARS_FILES the ears stay off. Parts are joined in memory in number order; /_blob/ assets are
// kept in Cache Storage ("tm-ears-v1") so the download happens once per browser.
(function () {
  "use strict";
  if (window.KT2_TM_EARS_OFF) return;
  const MODEL = "Xenova/larger_clap_general";
  // the files transformers.js asks for; each is one asset of the same name or parts "<name>.<i>.png" / ".bin"
  const FILES = ["transformers.min.js", "config.json", "preprocessor_config.json", "onnx/audio_model_quantized.onnx", "ort-wasm-simd-threaded.jsep.wasm"];
  const CACHE = "tm-ears-v1";
  let loading = null, proc = null, model = null, failed = null, map = null;

  async function getMap() {
    let m = window.TM_EARS_FILES;
    if (typeof m === "string") m = await (await fetch(m)).json();
    if (!m || typeof m !== "object") throw new Error("TM_EARS_FILES not set: ears stay off");
    const abs = {}, full = (u) => new URL(u, location.href).href;   // import() needs a full address
    for (const k in m) abs[k] = typeof m[k] === "string" ? full(m[k]) : { png: full(m[k].png), bytes: m[k].bytes };
    return abs;
  }
  /** The asset names that make up a file, in order. */
  function partsOf(file) {
    const base = file.split("/").pop();
    if (map[base]) return [base];
    const re = new RegExp("^" + base.replace(/[.]/g, "\\.") + "\\.(\\d+)\\.(png|bin)$"), ps = [];
    for (const k in map) { const m = re.exec(k); if (m) ps[+m[1]] = k; }
    if (!ps.length || ps.includes(undefined) || ps.length !== Object.keys(ps).length) throw new Error("missing parts for " + file);
    return ps;
  }
  async function inflate(bytes) {
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  /** Our packed PNGs: 8-bit grey, any width, every row filter 0 -> the first `length` raw bytes. */
  async function pngBytes(png, length) {
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
  async function getPart(name) {
    const a = map[name];
    if (!a) throw new Error("no asset for " + name);
    if (typeof a === "object") return pngBytes(await getRaw(a.png, name), a.bytes);
    return getRaw(a, name);
  }
  async function getRaw(url, name) {
    const keep = /\/_blob\//.test(url) && typeof caches !== "undefined";
    let cache = null;
    if (keep) {
      try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) return new Uint8Array(await hit.arrayBuffer()); } catch (e) { cache = null; }
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(name + ": HTTP " + r.status);
    const b = new Uint8Array(await r.arrayBuffer());
    if (cache) { try { await cache.put(url, new Response(b)); } catch (e) {} }
    return b;
  }
  /** One whole file, its parts fetched side by side and joined in order. */
  async function getFile(file) {
    const bufs = await Promise.all(partsOf(file).map(getPart));
    if (bufs.length === 1) return bufs[0];
    let n = 0; for (const b of bufs) n += b.length;
    const all = new Uint8Array(n); let o = 0;
    for (const b of bufs) { all.set(b, o); o += b.length; }
    return all;
  }
  /** Which of our files a URL transformers.js asks for is (by its ending), or null. */
  function fileOf(u) {
    u = String(u && u.url ? u.url : u).split("?")[0];
    for (const f of FILES) if (f !== "transformers.min.js" && (u === f || u.endsWith("/" + f))) return f;
    return null;
  }

  function warm() {
    if (loading) return loading;
    loading = (async () => {
      try {
        map = await getMap();
        let T;
        try { T = await import(map["transformers.min.js"]); }
        catch (e) { T = await import(URL.createObjectURL(new Blob([await getFile("transformers.min.js")], { type: "text/javascript" }))); }
        const env = T.env;
        env.allowLocalModels = false;
        env.allowRemoteModels = true;           // asked through the cache below, never really fetched
        env.useBrowserCache = false;
        env.useFSCache = false;
        env.useCustomCache = true;
        const held = {};
        env.customCache = {
          match: async (req) => {
            const f = fileOf(req);
            if (!f) return undefined;
            if (!held[f]) held[f] = getFile(f);
            const b = await held[f];
            return new Response(b, { headers: { "content-length": String(b.length) } });
          },
          put: async () => {},
        };
        const wasm = await getFile("ort-wasm-simd-threaded.jsep.wasm");
        const onnx = env.backends && env.backends.onnx;
        if (onnx && onnx.wasm) {
          onnx.wasm.wasmBinary = wasm.buffer;
          const wurl = URL.createObjectURL(new Blob([wasm], { type: "application/wasm" }));
          onnx.wasm.wasmPaths = { wasm: wurl };
          onnx.wasm.proxy = false;
        }
        proc = await T.AutoProcessor.from_pretrained(MODEL);
        model = await T.ClapAudioModelWithProjection.from_pretrained(MODEL, { dtype: "q8", device: "wasm" });
        for (const k in held) delete held[k];   // the model keeps its own copy
        api.ready = true;
        return true;
      } catch (e) {
        failed = e; console.warn("[Ears] not available", e);
        return false;
      }
    })();
    return loading;
  }
  /** Any rate -> 48 kHz mono (what CLAP listens at). */
  async function to48k(data, sr) {
    if (sr === 48000) return data;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    const n = Math.ceil(data.length * 48000 / sr), ctx = new OAC(1, n, 48000);
    const buf = ctx.createBuffer(1, data.length, sr);
    buf.copyToChannel(data, 0);
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start();
    return (await ctx.startRendering()).getChannelData(0);
  }
  async function embed(data, sr) {
    if (!api.ready || !data || !data.length) return null;
    try {
      const a = await to48k(data, sr);
      if (!a) return null;
      const inp = await proc(a.length > 48000 * 10 ? a.subarray(0, 48000 * 10) : a);
      const out = await model(inp);
      const v = Float32Array.from(out.audio_embeds.data);
      let m = 0; for (const x of v) m += x * x; m = Math.sqrt(m) || 1;
      for (let i = 0; i < v.length; i++) v[i] /= m;
      return v;
    } catch (e) { console.warn("[Ears] embed", e); return null; }
  }
  function cos(a, b) { if (!a || !b) return 0; let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

  const api = { warm, embed, cos, ready: false, get failed() { return failed; }, version: 3 };
  window.ToyMachineEars = api;
})();
