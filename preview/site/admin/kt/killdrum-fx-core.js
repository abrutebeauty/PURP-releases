// KILLDRUM FX: the effect registry and shared helpers. Loaded before the effect files and the FX
// tab (ui/killdrum-fx.js). Every effect is one module that registers itself here; the FX tab
// puts one instance of the chosen effect on each drum voice ("a dot in the portal circle").
// The interface is written up in /mnt/project-files/killdrum/FX-MODULE.md.
//
//   KdFx.register({
//     id: "grain-cloud", num: 1, name: "GRAIN CLOUD", group: "GRANULAR & TIME",
//     caption: "Smears hits into shimmering haze.",
//     axes: { x: "DENSITY", y: "PITCH SPRAY" },
//     dials: [{ id: "size", name: "GRAIN SIZE", def: 0.3, fmt: (v) => ... }, { id: "scatter", name: "SCATTER", def: 0.5 }],
//     toggles: [{ id: "reverse", name: "REVERSE", def: false }, { id: "window", name: "WINDOW", options: ["HANN", "GAUSS", "SQUARE"], def: 0 }],
//     presets: [{ name: "Dust Halo", voice: "hats", x: 0.8, y: 0.6, wet: 0.6, dials: { size: 0.03 }, toggles: {} }],
//     worklets: { "kdfx-grain": "class P extends AudioWorkletProcessor { ... } registerProcessor('kdfx-grain', P);" },
//     create(ctx, env) -> { input, output, set(s), trigger?(hit), destroy() },
//   });
(function () {
  "use strict";
  const KdFx = (window.KdFx = window.KdFx || {});
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  KdFx.clamp = clamp;

  // ------------------------------------------------------------------ registry
  KdFx.effects = KdFx.effects || [];
  KdFx.byId = KdFx.byId || {};
  const listeners = new Set();
  KdFx.register = (d) => {
    if (!d || !d.id || typeof d.create !== "function") { console.error("KdFx.register: an effect needs an id and create()", d); return; }
    d.dials = (d.dials || []).slice(0, 2);
    d.toggles = d.toggles || [];
    d.presets = d.presets || [];
    d.axes = d.axes || { x: "X", y: "Y" };
    const i = KdFx.effects.findIndex((e) => e.id === d.id);
    if (i >= 0) KdFx.effects[i] = d; else KdFx.effects.push(d);
    KdFx.effects.sort((a, b) => (a.num || 99) - (b.num || 99));
    KdFx.byId[d.id] = d;
    for (const fn of listeners) try { fn(d); } catch (e) { console.error(e); }
  };
  KdFx.onRegister = (fn) => (listeners.add(fn), () => listeners.delete(fn));

  // AudioWorklets: effects list theirs in `worklets` ({ name: source }); the host loads them once
  // per AudioContext (KdFx.prepare) before calling create(). Inside create(), KdFx.hasWorklet(ctx,
  // name) says whether it is ready (if not, fall back to plain Web Audio nodes or a pass-through).
  const loaded = new WeakMap();
  KdFx.prepare = (ctx) => {
    if (!ctx || !ctx.audioWorklet) return Promise.resolve();
    let st = loaded.get(ctx);
    if (!st) loaded.set(ctx, (st = { names: new Set(), pending: new Map() }));
    const jobs = [];
    for (const d of KdFx.effects) for (const [name, src] of Object.entries(d.worklets || {})) {
      if (st.names.has(name)) continue;
      if (!st.pending.has(name)) {
        const url = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
        st.pending.set(name, ctx.audioWorklet.addModule(url).then(() => st.names.add(name), (e) => console.error("KILLDRUM FX worklet " + name, e)));
      }
      jobs.push(st.pending.get(name));
    }
    return Promise.all(jobs);
  };
  KdFx.hasWorklet = (ctx, name) => { const st = loaded.get(ctx); return !!(st && st.names.has(name)); };

  // ------------------------------------------------------------------ voices
  // KILLDRUM's pads as FX voices, with the colours from Eman's spec (KICK red, SNARE cyan, HATS
  // yellow, PERC purple, CLAP pink, TOM orange). `kind` is what presets name in `voice`.
  KdFx.VOICES = [
    { slot: "kick", note: 36, label: "KICK", kind: "kick", color: "#ff3b4e" },
    { slot: "808", note: 35, label: "808", kind: "kick", color: "#ff7a2f" },
    { slot: "snare", note: 38, label: "SNARE", kind: "snare", color: "#2fe6ff" },
    { slot: "clap", note: 39, label: "CLAP", kind: "clap", color: "#ff5fc8" },
    { slot: "hat_closed", note: 42, label: "HATS", kind: "hats", color: "#e4ff3a" },
    { slot: "hat_open", note: 46, label: "OPEN HAT", kind: "hats", color: "#f3ff9a" },
    { slot: "perc", note: 37, label: "PERC", kind: "perc", color: "#8b5cf6" },
    { slot: "fx", note: 49, label: "FX", kind: "perc", color: "#b79cff" },
    { slot: "texture", note: 51, label: "TEXTURE", kind: "perc", color: "#cfcfd6" },
  ];
  KdFx.voiceByNote = Object.fromEntries(KdFx.VOICES.map((v) => [v.note, v]));
  KdFx.voiceBySlot = Object.fromEntries(KdFx.VOICES.map((v) => [v.slot, v]));

  // ------------------------------------------------------------------ randomness (seeded, so loops repeat)
  KdFx.hash = (...xs) => { let h = 2166136261; for (const c of xs.join("|")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  KdFx.rng = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // smooth value noise 0..1: same seed and time, same value
  KdFx.noise = (seed, t) => {
    const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
    const v = (k) => (KdFx.hash(seed, k) % 100000) / 100000;
    return v(i) * (1 - u) + v(i + 1) * u;
  };

  // ------------------------------------------------------------------ DSP helpers for effect files
  const curves = new Map();
  // tanh soft clip; drive 1 = clean-ish, 30 = very hot (normalised so +-1 stays +-1)
  KdFx.tanhCurve = (drive) => {
    const k = Math.round(drive * 10) / 10;
    if (curves.has("t" + k)) return curves.get("t" + k);
    const c = new Float32Array(4096);
    for (let i = 0; i < c.length; i++) { const v = (i / 4095) * 2 - 1; c[i] = Math.tanh(k * v) / Math.tanh(Math.max(k, 1e-3)); }
    curves.set("t" + k, c);
    return c;
  };
  const revCache = new WeakMap();
  KdFx.reverseBuffer = (ctx, buf) => {
    let r = revCache.get(buf);
    if (r) return r;
    r = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const s = buf.getChannelData(ch), d = r.getChannelData(ch); for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i]; }
    revCache.set(buf, r);
    return r;
  };
  const noiseCache = new WeakMap();
  KdFx.noiseBuffer = (ctx, sec = 2) => {
    let m = noiseCache.get(ctx);
    if (!m) noiseCache.set(ctx, (m = {}));
    if (m[sec]) return m[sec];
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate), r = KdFx.rng(4242);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = r() * 2 - 1; }
    return (m[sec] = b);
  };
  // a reverb impulse: noise with an exponential fade; gate = cut off hard at that many seconds
  KdFx.impulse = (ctx, { sec = 2, decay = 3, seed = 7, gate = 0, bright = 1 } = {}) => {
    const n = Math.max(1, Math.floor(ctx.sampleRate * sec)), b = ctx.createBuffer(2, n, ctx.sampleRate), r = KdFx.rng(seed);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n, env = gate ? (i / ctx.sampleRate < gate ? 1 : Math.max(0, 1 - (i / ctx.sampleRate - gate) / 0.01)) : Math.pow(1 - t, decay);
        const w = r() * 2 - 1; lp += (w - lp) * clamp(bright); d[i] = lp * env;
      }
    }
    return b;
  };
  // tempo: seconds of `beats` at `bpm`; note values for synced dials
  KdFx.beats = (bpm, beats) => (60 / (bpm || 120)) * beats;
  KdFx.NOTES = [[4, "1 bar"], [2, "1/2"], [1, "1/4"], [0.75, "1/8."], [0.5, "1/8"], [1 / 3, "1/8T"], [0.25, "1/16"], [1 / 6, "1/16T"], [0.125, "1/32"], [0.0625, "1/64"]];
  KdFx.pickNote = (v, from = 0, to = KdFx.NOTES.length - 1) => KdFx.NOTES[from + Math.min(to - from, Math.floor(clamp(v) * (to - from + 1)))];
  // ramp an AudioParam smoothly (dragging a dot sends set() up to 60 times a second)
  KdFx.ramp = (param, v, ctx, tc = 0.02) => { if (param && isFinite(v)) param.setTargetAtTime(v, ctx.currentTime, tc); };
  KdFx.fmt = {
    pct: (v) => Math.round(clamp(v) * 100) + "%",
    ms: (lo, hi) => (v) => Math.round(lo + clamp(v) * (hi - lo)) + " ms",
    hz: (f) => (f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1) + " kHz" : Math.round(f) + " Hz"),
    st: (v) => (v > 0 ? "+" : "") + (Math.round(v * 10) / 10) + " st",
  };

  // ------------------------------------------------------------------ the circle
  // A dot sits in a round circle; its x/y are a square's (elliptical grid mapping), so every corner
  // value can be reached on the rim. u, v: -1..1 inside the unit disc (v up). x, y: 0..1.
  KdFx.discToXY = (u, v) => {
    const r = Math.hypot(u, v);
    if (r > 1) { u /= r; v /= r; }
    const s2 = 2 * Math.SQRT2, uu = u * u, vv = v * v, sq = (z) => Math.sqrt(Math.max(0, z));
    const X = 0.5 * sq(2 + uu - vv + s2 * u) - 0.5 * sq(2 + uu - vv - s2 * u);
    const Y = 0.5 * sq(2 - uu + vv + s2 * v) - 0.5 * sq(2 - uu + vv - s2 * v);
    return { x: clamp((X + 1) / 2), y: clamp((Y + 1) / 2) };
  };
  KdFx.xyToDisc = (x, y) => {
    const X = clamp(x) * 2 - 1, Y = clamp(y) * 2 - 1;
    return { u: X * Math.sqrt(1 - (Y * Y) / 2), v: Y * Math.sqrt(1 - (X * X) / 2) };
  };
  // how hard a dot hits: distance from the centre (0..1) x STRENGTH
  KdFx.amountOf = (x, y, strength = 1) => { const d = KdFx.xyToDisc(x, y); return clamp(Math.hypot(d.u, d.v) * clamp(strength, 0, 2)); };

  // ------------------------------------------------------------------ the FX state (lane's kitVoid)
  // kitVoid = { v: 2, on, effect: id, sync, gravity: "off"|"drift"|"orbit", seed,
  //             fx: { [effectId]: { dots: { [note]: Dot }, syncDot: Dot, ab: { a, b, mix } } } }
  // Dot = { x, y (0..1, centre 0.5), wet (dot size), strength, preset, dials: {id: 0..1},
  //         toggles: {id: bool|index}, drive (0..1 = 0..24 dB), cutoff (-1 LP .. 0 off .. +1 HP),
  //         res (0..1), on (the voice goes through the effect), motion: { bars, path: [[x, y]...] } | null }
  KdFx.presetFor = (desc, kind) => {
    const ps = (desc && desc.presets) || [];
    return ps.find((p) => p.voice === kind) || ps.find((p) => p.voice === "all") || ps[0] || null;
  };
  KdFx.dotFromPreset = (desc, preset, prev) => {
    const d = { x: 0.5, y: 0.5, wet: 0.5, strength: 1, preset: "", dials: {}, toggles: {}, drive: 0, cutoff: 0, res: 0.2, on: true, motion: null };
    if (prev) Object.assign(d, { on: prev.on !== false, motion: prev.motion || null });
    for (const k of (desc && desc.dials) || []) d.dials[k.id] = k.def != null ? k.def : 0.5;
    for (const t of (desc && desc.toggles) || []) d.toggles[t.id] = t.def != null ? t.def : (t.options ? 0 : false);
    if (preset) {
      d.preset = preset.name || "";
      for (const k of ["x", "y", "wet", "strength", "drive", "cutoff", "res"]) if (preset[k] != null) d[k] = preset[k];
      Object.assign(d.dials, preset.dials || {});
      Object.assign(d.toggles, preset.toggles || {});
    }
    return d;
  };
  // FX starts off (Eman, 27 Oct: the beat plays dry until FX is turned on). `pw` marks a state whose
  // power the person set; older saves without it (the tab used to switch itself on) count as off.
  KdFx.isOn = (kv) => !!(kv && kv.v === 2 && kv.on === true && kv.pw);
  KdFx.defaultFx = () => ({ v: 2, on: false, pw: 1, effect: (KdFx.effects[0] && KdFx.effects[0].id) || "", sync: false, gravity: "off", seed: 1, fx: {} });
  // Roll dots of the current effect: new spots and presets for `targets` (pad notes, or "sync"; default
  // every voice). Used by the FX tab's dice and by BEAT's ROLL while FX is on. Changes kv in place.
  KdFx.rollDots = (kv, targets) => {
    const d = KdFx.byId[kv && kv.effect];
    if (!d) return false;
    const s = KdFx.space(kv, kv.effect);
    const n = (v, x) => (typeof v === "number" && isFinite(v) ? v : x);
    kv.seed = (n(kv.seed, 1) >>> 0) || 1;
    const r = KdFx.rng(kv.seed++);
    const list = targets && targets.length ? targets : kv.sync ? ["sync"] : KdFx.VOICES.map((v) => v.note);
    for (const t of list) {
      const prev = t === "sync" ? s.syncDot : s.dots[t], kind = t === "sync" ? "all" : (KdFx.voiceByNote[t] || {}).kind || "all";
      const ps = d.presets || [], mine = ps.filter((p) => p.voice === kind);
      // half the time a preset made for this voice, so most rolls sound right
      const pool = mine.length && r() < 0.5 ? mine : ps;
      const nd = KdFx.dotFromPreset(d, pool.length ? pool[Math.floor(r() * pool.length)] : null, prev);
      const a = r() * Math.PI * 2, rad = 0.2 + 0.75 * Math.sqrt(r());
      Object.assign(nd, KdFx.discToXY(Math.cos(a) * rad, Math.sin(a) * rad));
      nd.wet = Math.max(0.15, Math.min(1, n(nd.wet, 0.5) * (0.75 + r() * 0.5)));
      if (t === "sync") s.syncDot = nd; else s.dots[t] = nd;
    }
    return true;
  };
  // The constellation of one effect (made from the presets the first time it is opened).
  KdFx.space = (kv, effectId) => {
    const desc = KdFx.byId[effectId];
    kv.fx = kv.fx || {};
    let sp = kv.fx[effectId];
    if (!sp) {
      sp = kv.fx[effectId] = { dots: {}, syncDot: KdFx.dotFromPreset(desc, (desc && desc.presets || []).find((p) => p.sync) || KdFx.presetFor(desc, "all")), ab: { a: null, b: null, mix: 0 } };
      for (const v of KdFx.VOICES) sp.dots[v.note] = KdFx.dotFromPreset(desc, KdFx.presetFor(desc, v.kind));
    }
    for (const v of KdFx.VOICES) if (!sp.dots[v.note]) sp.dots[v.note] = KdFx.dotFromPreset(desc, KdFx.presetFor(desc, v.kind));
    return sp;
  };
  // Where a dot is at song beat `beat` (null = stopped): its motion path, else gravity.
  // Gravity settings (Eman, 28 Oct): kv.grav = { speed (x, 0.25..4), amount (0..1, how far), rand (0..1:
  // each pad its own speed and start, from `key` = the pad's note) }. Left out = 1x, full, all together.
  KdFx.grav = (kv) => Object.assign({ speed: 1, amount: 1, rand: 0 }, (kv && kv.grav) || {});
  const hash01 = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; };
  KdFx.dotAt = (dot, beat, gravity, seed = 1, g, key) => {
    if (!dot) return { x: 0.5, y: 0.5 };
    const m = dot.motion;
    if (beat != null && m && m.path && m.path.length > 1) {
      const len = (m.bars || 1) * 4, f = ((((beat % len) + len) % len) / len) * m.path.length;
      const i = Math.floor(f) % m.path.length, j = (i + 1) % m.path.length, u = f - Math.floor(f);
      return { x: clamp(m.path[i][0] * (1 - u) + m.path[j][0] * u), y: clamp(m.path[i][1] * (1 - u) + m.path[j][1] * u) };
    }
    if (beat == null || !gravity || gravity === "off") return { x: dot.x, y: dot.y };
    const d = KdFx.xyToDisc(dot.x, dot.y), G = g || { speed: 1, amount: 1, rand: 0 };
    const amt = Math.max(0, Math.min(1, G.amount != null ? +G.amount : 1)), rnd = Math.max(0, Math.min(1, +G.rand || 0));
    const r1 = key != null ? hash01(seed + ":g:" + key) : 0.5, r2 = key != null ? hash01(seed + ":p:" + key) : 0;
    const spd = Math.max(0.05, (+G.speed || 1) * (1 + rnd * (r1 * 2 - 1) * 0.8)), ph0 = rnd * r2 * 2 * Math.PI;
    if (gravity === "drift") { // breathes in to the centre and back out (8 bars at 1x); Amount = how far in
      const k = 1 - amt * (0.5 - 0.5 * Math.cos((2 * Math.PI * beat * spd) / 32 + ph0));
      return KdFx.discToXY(d.u * k, d.v * k);
    }
    // orbit: once round every 4 bars at 1x; under full Amount it swings back and forth instead of going round
    const ph = (2 * Math.PI * beat * spd) / 16 + ph0, off = amt >= 0.995 ? ph : Math.PI * amt * Math.sin(ph);
    const a = Math.atan2(d.v, d.u) - off, r = Math.hypot(d.u, d.v);
    return KdFx.discToXY(r * Math.cos(a), r * Math.sin(a));
  };
  // What one voice runs right now: { desc, dot } or null (FX off, no effect, voice not in it).
  KdFx.voiceState = (kv, note) => {
    if (!KdFx.isOn(kv)) return null;
    const desc = KdFx.byId[kv.effect];
    if (!desc) return null;
    const sp = kv.fx && kv.fx[kv.effect];
    const own = sp && sp.dots && sp.dots[note];
    if (!own || own.on === false) return null;
    const dot = kv.sync && sp.syncDot ? Object.assign({}, sp.syncDot, { on: true }) : own;
    return { desc, dot };
  };
  // The numbers an effect instance gets for a dot at song beat `beat`.
  KdFx.params = (kv, dot, beat, bpm, key) => {
    const p = KdFx.dotAt(dot, beat, kv.gravity, kv.seed, KdFx.grav(kv), key);
    return { x: p.x, y: p.y, amount: KdFx.amountOf(p.x, p.y, dot.strength != null ? dot.strength : 1), dials: dot.dials || {}, toggles: dot.toggles || {}, bpm };
  };

  // The playground's audio context and song key (RESONATOR's KEY TRACK, CONVOLUTION's drag-in IR).
  const dbg = () => window.purpPlaygroundDebug || {};
  KdFx.audioCtx = () => dbg().ctx || null;
  KdFx.songKey = () => { const k = dbg().S && dbg().S.key; return k && k.tonic != null ? { tonic: k.tonic, minor: !!k.minor } : null; };

  // Picture events: the engine pushes { t (audio time), note, kind: "hit" | "grain" | ..., gain }
  // and the tab draws them as the audio clock passes them. now() = the audio clock.
  KdFx.events = KdFx.events || [];
  KdFx.now = KdFx.now || (() => null);
  KdFx.emit = (e) => { KdFx.events.push(e); if (KdFx.events.length > 3000) KdFx.events.splice(0, 1500); };
})();
