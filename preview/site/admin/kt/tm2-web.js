// TOY MACHINE V2 in the KILLTOY 2 DAW (26 Nov): a web engine on TOY MACHINE's lanes, like TOY GTR / TOY KEYS.
// A V2 preset is { engine: "tm2", name, tree } where tree is the Serum 2 module tree as JSON (the V2 format,
// big arrays as base64 floats, see tools/toymachine2/serum2.py). Init Saw = an empty tree (all defaults).
//
//   TM2Web.load(ctx).create({ preset }) -> same calls as ToyMachine's create() (noteOn/Off, schedule, requeue,
//   flush, setPreset, meter...). The wasm loads in the background; calls made before it is ready are kept and
//   played once it is (so create() can stay synchronous like the other web engines).
//   TM2Web.fromSerumPreset(arrayBuffer, name) -> Promise of a V2 preset (decodes .SerumPreset in the page:
//   XferJson header + zstd + CBOR; zstd comes from fzstd, loaded on first use).
//   window.KT2_TM2_OFF hides the tile in the synth picker.
(function () {
  const DEFAULT = "Init Saw";
  const isTm2 = (p) => !!p && p.engine === "tm2";
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const INIT = { engine: "tm2", name: DEFAULT, tree: { presetName: DEFAULT, tm2: { format: 1, init: true } } };
  const preset = (name) => (name && typeof name === "object" && isTm2(name) ? copy(name) : !name || name === DEFAULT ? copy(INIT) : null);

  // ---------- engine ----------
  const apis = new WeakMap();   // ctx -> { create }
  function load(ctx) {
    if (apis.has(ctx)) return apis.get(ctx);
    let real = null;
    const ready = window.ToyMachine2 && ctx.audioWorklet
      ? window.ToyMachine2.load(ctx, "toy-machine-v2.wasm").then((a) => (real = a), (e) => { console.warn("TOY MACHINE V2 did not load", e); return null; })
      : Promise.resolve(null);
    function create(opts = {}) {
      const out = ctx.createGain();
      let s = null, dead = false, cur = isTm2(opts.preset) ? opts.preset : INIT;
      const queue = [];
      const make = (api) => {
        if (!api || s) return;
        s = api.create({ ...opts, preset: cur.tree });
        s.output.connect(out);
        for (const [fn, args] of queue) if (s[fn]) s[fn](...args);
        queue.length = 0;
      };
      if (real) make(real); else ready.then(make);
      const call = (fn) => (...args) => {
        if (fn === "setPreset") { if (!isTm2(args[0])) return; cur = args[0]; args = [cur.tree]; }
        if (s) return s[fn] && s[fn](...args);
        if (fn === "flush" || fn === "requeue") { for (let i = queue.length - 1; i >= 0; i--) if (queue[i][0] === "noteOn" || queue[i][0] === "schedule") queue.splice(i, 1); return; }
        queue.push([fn, args]);
      };
      const api = { output: out, isToyKeys: true, isTm2: true };   // isToyKeys: a web engine (playground.js keeps it apart from the TOY MACHINE wasm)
      for (const fn of ["setPreset", "setMacro", "setPad", "setPadStar", "setSample", "setDropSample", "noteOn", "noteOff", "bend", "wheel", "schedule", "requeue", "flush", "sendTransport"]) api[fn] = call(fn);
      api.meter = () => (s ? s.meter() : { peak: 0, voices: 0, dice: null, arp: -1 });
      api.close = () => { dead = true; if (s) s.close(); out.disconnect(); };
      Object.defineProperty(api, "dead", { get: () => dead || (!!s && s.dead) });
      return api;
    }
    const a = { create, ready, preload: () => ready };
    apis.set(ctx, a);
    return a;
  }

  // ---------- .SerumPreset decode ----------
  function cbor(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let o = 0;
    const half = (h) => { const e = (h >> 10) & 31, f = h & 1023, s = h & 0x8000 ? -1 : 1; return e === 0 ? s * f * 2 ** -24 : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * 2 ** (e - 15); };
    function len(ai) {
      if (ai < 24) return ai;
      if (ai === 24) return dv.getUint8(o++);
      if (ai === 25) { const v = dv.getUint16(o); o += 2; return v; }
      if (ai === 26) { const v = dv.getUint32(o); o += 4; return v; }
      if (ai === 27) { const v = Number(dv.getBigUint64(o)); o += 8; return v; }
      return -1;   // indefinite
    }
    function item() {
      const b = dv.getUint8(o++), mt = b >> 5, ai = b & 31;
      if (mt === 7) {
        if (ai === 20) return false; if (ai === 21) return true; if (ai === 22 || ai === 23) return null;
        if (ai === 25) { const v = half(dv.getUint16(o)); o += 2; return v; }
        if (ai === 26) { const v = dv.getFloat32(o); o += 4; return v; }
        if (ai === 27) { const v = dv.getFloat64(o); o += 8; return v; }
        if (ai === 24) { o++; return null; }
        return null;
      }
      const n = len(ai);
      if (mt === 0) return n;
      if (mt === 1) return -1 - n;
      if (mt === 2 || mt === 3) {
        let parts = [];
        if (n < 0) { while (dv.getUint8(o) !== 0xff) parts.push(item()); o++; }
        else { parts = [bytes.subarray(o, o + n)]; o += n; }
        if (mt === 3) return parts.map((p) => (typeof p === "string" ? p : new TextDecoder().decode(p))).join("");
        const tot = parts.reduce((a, p) => a + p.length, 0), r = new Uint8Array(tot); let k = 0; for (const p of parts) { r.set(p, k); k += p.length; }
        return { __bytes: r };
      }
      if (mt === 4) { const a = []; if (n < 0) { while (dv.getUint8(o) !== 0xff) a.push(item()); o++; } else for (let i = 0; i < n; i++) a.push(item()); return a; }
      if (mt === 5) { const m = {}; const kv = () => { const k = item(); m[k] = item(); }; if (n < 0) { while (dv.getUint8(o) !== 0xff) kv(); o++; } else for (let i = 0; i < n; i++) kv(); return m; }
      if (mt === 6) return item();   // tags: keep the value
      return null;
    }
    return item();
  }
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const f32b64 = (arr) => { const f = new Float32Array(arr); return b64(new Uint8Array(f.buffer)); };
  const BIG = new Set(["embeddedWTData", "embeddedNoiseData", "embeddedSampleData"]);
  function toTm2(t) {   // = serum2.py to_tm2_tree
    if (Array.isArray(t)) return t.map(toTm2);
    if (t && typeof t === "object") {
      if (t.__bytes) return { __bytesB64: b64(t.__bytes) };
      const out = {};
      for (const k in t) {
        const v = t[k];
        if (BIG.has(k) && Array.isArray(v) && v.length) out[k + "B64"] = Array.isArray(v[0]) ? v.map(f32b64) : f32b64(v);
        else out[k] = toTm2(v);
      }
      return out;
    }
    return t;
  }
  let fz = null;
  function fzstd() {
    if (window.fzstd) return Promise.resolve(window.fzstd);
    if (!fz) fz = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js"; s.onload = () => res(window.fzstd); s.onerror = () => { fz = null; rej(new Error("zstd decoder did not load")); }; document.head.appendChild(s); });
    return fz;
  }
  async function fromSerumPreset(buf, name) {
    const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (new TextDecoder().decode(b.subarray(0, 8)) !== "XferJson" || b[8] !== 0) throw new Error("Not a Serum 2 preset");
    const n = Number(dv.getBigUint64(9, true)); let o = 17;
    let meta = {}; try { meta = JSON.parse(new TextDecoder().decode(b.subarray(o, o + n))); } catch (e) {}
    o += n;
    const ver = dv.getUint32(o + 4, true); o += 8;
    const Z = await fzstd();
    const tree = toTm2(cbor(Z.decompress(b.subarray(o))));
    tree.meta = meta; tree.tm2 = { format: 1, from: "SerumPreset", serumContainerVersion: ver };
    const nm = name || meta.presetName || tree.presetName || "Serum preset";
    return { engine: "tm2", name: nm, tree };
  }

  window.TM2Web = { load, preset, DEFAULT, PRESETS: [INIT], isTm2, fromSerumPreset, version: 1 };
})();
