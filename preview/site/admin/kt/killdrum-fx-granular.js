// KILLDRUM FX, group 1: GRANULAR & TIME (spec 01-06): GRAIN CLOUD, GRAIN FREEZE, STUTTER,
// TAPE STOP, REVERSE ECHO, SLICE SHUFFLE. Each effect registers with KdFx (ui/killdrum-fx-core.js,
// interface in /mnt/project-files/killdrum/FX-MODULE.md) and runs one small AudioWorklet per drum
// voice. The grain engine follows TEXTURE's (Source/dsp/fx/Texture.h): cubic Hermite reads, windows
// that start and end at zero, energy-normalised overlap, a DC-blocked soft-clipped feedback path and
// seeded random numbers, so a loop always plays back the same.
//
// This first block is shared by the six effects below (window.KdFx.granular):
//   G.LIB   worklet code every processor starts with: clamp, rng, hash, hermite, softClip and
//           KdBase (options, the stop message, the song clock, hits from the "trig" param)
//   G.make  builds one instance: input -> AudioWorkletNode -> output, set() -> AudioParams,
//           trigger() -> a two-sample pulse on the a-rate "trig" param at the hit's time,
//           destroy(). Without the worklet it passes the voice through (the effect is off).
(function () {
  "use strict";
  const K = window.KdFx;
  if (!K) return;
  const G = (K.granular = K.granular || {});

  G.LIB = `
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// the same generator and hash as KdFx.rng / KdFx.hash on the page
const mkRng = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash = (...xs) => { let h = 2166136261; for (const c of xs.join("|")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// cubic Hermite read from a power-of-two ring buffer (mask = size - 1); pos may be fractional
const hermite = (b, mask, pos) => {
  const i = Math.floor(pos), f = pos - i;
  const xm1 = b[(i - 1) & mask], x0 = b[i & mask], x1 = b[(i + 1) & mask], x2 = b[(i + 2) & mask];
  const c1 = 0.5 * (x1 - xm1), c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2, c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
  return ((c3 * f + c2) * f + c1) * f + x0;
};
// tanh-like soft clip, |y| < 1
const softClip = (x) => { x = x < -3 ? -3 : x > 3 ? 3 : x; return (x * (27 + x * x)) / (27 + 9 * x * x); };
// one-pole smoothing coefficient for a time constant in seconds
const onePole = (sec) => 1 - Math.exp(-1 / Math.max(1, sec * sampleRate));
const pow2Above = (n) => { let s = 1; while (s < n) s <<= 1; return s; };

class KdBase extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.opts = p;
    this.alive = true;
    this.seed = p.seed >>> 0;
    this.clock = { bpm: p.bpm || 120, t0: p.t0 || 0, b0: p.b0 || 0, playing: !!p.playing };
    this.lastTrig = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.stop) this.alive = false;
      if (d.clock) Object.assign(this.clock, d.clock);
      if (this.onMessage) this.onMessage(d);
    };
  }
  // the song position in beats at sample i of this block (a free clock when the song isn't playing)
  beat(i) { const c = this.clock; return c.b0 + ((currentTime + i / sampleRate - c.t0) * c.bpm) / 60; }
  spb() { return (60 / this.clock.bpm) * sampleRate; }   // samples per beat
  // the hits in this block (rising edges of the a-rate "trig" param): fn(sampleIndex, gain)
  hits(arr, fn) {
    if (!arr) return;
    if (arr.length === 1) { const v = arr[0]; if (v > 0 && this.lastTrig <= 0) fn(0, v); this.lastTrig = v; return; }
    for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (v > 0 && this.lastTrig <= 0) fn(i, v); this.lastTrig = v; }
  }
}
`;

  // spec = {
  //   proc: the processor name (its source is in the effect's `worklets`),
  //   map(s, env) -> { paramName: value } for the processor's AudioParams (s = the host's set() object),
  //   options?: extra processorOptions,
  //   route?(ctx, input, node, output): wire it yourself (default input -> node -> output),
  //   onSet?(s, inst): after the params are set (for native nodes around the worklet),
  // }
  // Params jump to their new value (the processor smooths what needs smoothing), so a preset is in
  // place from the first sample, offline too.
  G.make = (ctx, env, spec) => {
    env = env || {};
    const input = ctx.createGain(), output = ctx.createGain();
    const off = (n) => { try { n.disconnect(); } catch (e) { /* already gone */ } };
    if (typeof AudioWorkletNode === "undefined" || !K.hasWorklet(ctx, spec.proc)) {
      input.connect(output);
      return { input, output, set() {}, trigger() {}, destroy() { off(input); off(output); } };
    }
    const bpm0 = env.bpm || 120, t0 = ctx.currentTime, b0 = env.beatAt ? env.beatAt(t0) : null;
    const node = new AudioWorkletNode(ctx, spec.proc, {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { seed: (env.seed >>> 0) || 1, bpm: bpm0, t0, b0: b0 == null ? 0 : b0, playing: b0 != null, ...(spec.options || {}) },
    });
    if (spec.route) spec.route(ctx, input, node, output); else { input.connect(node); node.connect(output); }
    // the free clock (song stopped) keeps counting from where it was when the tempo changes
    let clk = { bpm: bpm0, t0, b0: b0 == null ? 0 : b0 };
    const inst = {
      input, output, node,
      set(s) {
        s = s || {};
        const v = spec.map(s, env) || {};
        for (const k in v) { const p = node.parameters.get(k); if (p && isFinite(v[k])) p.setValueAtTime(v[k], ctx.currentTime); }
        if (s.bpm > 0 && Math.abs(s.bpm - clk.bpm) > 1e-6) {
          const t = ctx.currentTime, b = env.beatAt ? env.beatAt(t) : null;
          const free = clk.b0 + ((t - clk.t0) * clk.bpm) / 60;
          clk = { bpm: s.bpm, t0: t, b0: b != null ? b : free };
          node.port.postMessage({ clock: { ...clk, playing: b != null } });
        }
        if (spec.onSet) spec.onSet(s, inst);
      },
      trigger(hit) {
        const p = node.parameters.get("trig");
        if (!p || !hit) return;
        const at = Math.max(hit.at || 0, ctx.currentTime);
        p.setValueAtTime(Math.max(0.001, hit.gain || 1), at);
        p.setValueAtTime(0, at + 2 / ctx.sampleRate);
      },
      destroy() { node.port.postMessage({ stop: 1 }); off(input); off(node); off(output); },
    };
    return inst;
  };

  // small helpers for the effects' maps and dial texts
  G.bip = (v) => (K.clamp(v) - 0.5) * 2;                             // 0..1 -> -1..1 (0.5 = centre)
  G.lerp = (a, b, t) => a + (b - a) * K.clamp(t);
  G.expo = (lo, hi, t) => lo * Math.pow(hi / lo, K.clamp(t));        // log sweep lo..hi
  G.step = (v, n) => Math.min(n - 1, Math.floor(K.clamp(v) * n));    // 0..1 -> 0..n-1
})();

// ------------------------------------------------------------------ 01 GRAIN CLOUD
// Smears every hit into a haze of short overlapping grains read from a rolling 1.5 s buffer:
// random read offsets (SCATTER), per-grain pitch by resampling (PITCH SPRAY, snapped to fifths and
// octaves once it gets wide), random pan, and the grains fed back into the buffer so the haze
// lingers. Energy-normalised overlap and a fast wet leveller keep dense clouds at an even level.
(function () {
  "use strict";
  const K = window.KdFx, G = K && K.granular;
  if (!G) return;

  const sizeMs = (v) => G.expo(10, 200, v);                 // GRAIN SIZE dial: 10..200 ms (log)
  const density = (x) => G.expo(4, 160, x);                 // X: grains per second (log)

  K.register({
    id: "grain-cloud", num: 1, name: "GRAIN CLOUD", group: "GRANULAR & TIME",
    caption: "Smears hits into shimmering haze.",
    axes: { x: "DENSITY", y: "PITCH SPRAY" },
    fmtX: (x) => Math.round(density(x)) + " /s",
    fmtY: (y) => K.fmt.st(Math.round(G.bip(y) * 12 * 10) / 10),
    dials: [
      { id: "size", name: "GRAIN SIZE", def: 0.45, fmt: (v) => Math.round(sizeMs(v)) + " ms" },
      { id: "scatter", name: "SCATTER", def: 0.3, fmt: K.fmt.pct },
    ],
    toggles: [
      { id: "reverse", name: "REVERSE", def: false },
      { id: "window", name: "WINDOW", options: ["HANN", "GAUSS", "SQUARE"], def: 0 },
    ],
    presets: [
      { name: "Dust Halo", voice: "hats", x: 0.85, y: 0.6, wet: 0.6, dials: { size: 0.135, scatter: 0.15 }, toggles: {} },
      { name: "Snare Nebula", voice: "snare", x: 0.65, y: 0.79, wet: 0.6, dials: { size: 0.694, scatter: 0.8 }, toggles: {} },
      { name: "Kick Fog", voice: "kick", x: 0.2, y: 0.5, wet: 0.45, strength: 0.6, dials: { size: 0.965, scatter: 0.3 }, toggles: {} },
      { name: "Static Bloom", voice: "perc", x: 1, y: 0.5, wet: 0.5, dials: { size: 0.05, scatter: 0.5 }, toggles: { window: 2 } },
    ],
    worklets: { "kdfx-grain-cloud": G.LIB + `
const MAXG = 32, TAB = 1024;
const UP = [0, 7, 12], DOWN = [0, 5, 12];          // wide sprays snap to fifths / fourths and octaves
class P extends KdBase {
  static get parameterDescriptors() {
    return [
      { name: "amount", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "density", defaultValue: 20, minValue: 1, maxValue: 400, automationRate: "k-rate" },
      { name: "spray", defaultValue: 0, minValue: -24, maxValue: 24, automationRate: "k-rate" },
      { name: "size", defaultValue: 80, minValue: 5, maxValue: 500, automationRate: "k-rate" },
      { name: "scatter", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "reverse", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "win", defaultValue: 0, minValue: 0, maxValue: 2, automationRate: "k-rate" },
      { name: "trig", defaultValue: 0, minValue: 0, automationRate: "a-rate" },
    ];
  }
  constructor(o) {
    super(o);
    const n = pow2Above(Math.ceil(sampleRate * 1.45));
    this.buf = new Float32Array(n); this.mask = n - 1; this.w = 0;
    this.on = new Uint8Array(MAXG); this.pos = new Float64Array(MAXG); this.inc = new Float64Array(MAXG);
    this.len = new Float32Array(MAXG); this.age = new Float32Array(MAXG); this.gl = new Float32Array(MAXG);
    this.gr = new Float32Array(MAXG); this.edge = new Float32Array(MAXG); this.wt = new Uint8Array(MAXG);
    // windows that start and end at 0: Hann, and a Gauss pulled down to 0 at its ends
    this.hann = new Float32Array(TAB + 1); this.gauss = new Float32Array(TAB + 1);
    const e = Math.exp(-0.5 * Math.pow(0.5 / 0.16, 2));
    let ph = 0, pg = 0;
    for (let i = 0; i <= TAB; i++) {
      const u = i / TAB, g = (Math.exp(-0.5 * Math.pow((u - 0.5) / 0.16, 2)) - e) / (1 - e);
      this.hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * u); this.gauss[i] = g;
      if (i < TAB) { ph += this.hann[i] * this.hann[i]; pg += g * g; }
    }
    this.power = [ph / TAB, pg / TAB, 0.98];
    this.rng = mkRng(this.seed ^ 0x9e3779b9);
    this.until = 0; this.am = 0; this.dens = 20; this.sz = 80; this.sc = 0;
    this.dc = 0; this.lp = 0; this.hl = 0; this.hr = 0; this.kHp = onePole(1 / (2 * Math.PI * 20)); this.fbv = 0; this.env = 0; this.lg = 1;
    this.quiet = 1e9; this.idleAfter = n + sampleRate * 0.5;
    this.hitIdx = new Int32Array(16); this.nHits = 0;
    this.kS = onePole(0.03); this.kDc = onePole(1 / (2 * Math.PI * 25)); this.kLp = onePole(1 / (2 * Math.PI * 5000));
    this.kA = onePole(0.001); this.kR = onePole(0.15); this.envRel = Math.exp(-1 / (2 * sampleRate));
  }
  spawn(P, decor) {
    let k = -1;
    for (let j = 0; j < MAXG; j++) if (!this.on[j]) { k = j; break; }
    if (k < 0) return;
    const r = this.rng, spray = P.spray[0], N = Math.abs(spray);
    let st = r() * N;
    if (N >= 4.5) {                                    // musical steps: 0 / +7 / +12 or 0 / -5 / -12
      const steps = spray > 0 ? UP : DOWN; let best = 0;
      for (const s of steps) if (s <= N + 2.5 && Math.abs(s - st) < Math.abs(best - st)) best = s;
      st = best;
    }
    if (spray < 0) st = -st;
    const rate = Math.pow(2, st / 12), back = P.reverse[0] > 0.5;
    const len = Math.max(32, Math.round(this.sz * 0.001 * sampleRate));
    const size = this.mask + 1;
    let d = 4 + decor * r() + this.sc * 0.4 * sampleRate * r();
    const dMin = 4 + (back ? 0 : Math.max(0, len * (rate - 1))), dMax = size - len * (rate + 1) - 16;
    d = clamp(d, dMin, Math.max(dMin, dMax));
    let p = this.w - 1 - d; while (p < 0) p += size;
    const pan = 0.55 * (2 * r() - 1), ang = (pan + 1) * 0.25 * Math.PI;
    const wt = Math.round(P.win[0]);
    this.on[k] = 1; this.pos[k] = p; this.inc[k] = back ? -rate : rate; this.len[k] = len; this.age[k] = 0;
    this.gl[k] = Math.cos(ang) * Math.SQRT2; this.gr[k] = Math.sin(ang) * Math.SQRT2; this.wt[k] = wt;
    this.edge[k] = Math.max(2, Math.min(len / 2, 0.0003 * sampleRate));    // SQUARE: ~0.3 ms edges
  }
  process(inputs, outputs, P) {
    if (!this.alive) return false;
    const inp = inputs[0] || [], out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length;
    const i0 = inp[0], i1 = inp[1] || inp[0];
    const amT = P.amount[0];
    this.nHits = 0;
    this.hits(P.trig, (i) => { if (this.nHits < 16) this.hitIdx[this.nHits++] = i; });
    if (amT < 0.01 && this.am < 0.01) {               // centre: the voice as it is
      for (let i = 0; i < n; i++) { L[i] = i0 ? i0[i] : 0; R[i] = i1 ? i1[i] : 0; }
      this.am = amT; this.on.fill(0); return true;
    }
    let peak = 0;
    if (i0) for (let i = 0; i < n; i++) { const a = Math.abs(i0[i]) + Math.abs(i1[i]); if (a > peak) peak = a; }
    this.quiet = peak > 1e-5 ? 0 : this.quiet + n;
    let live = 0; for (let j = 0; j < MAXG; j++) live += this.on[j];
    if (this.quiet > this.idleAfter && live === 0 && Math.abs(this.fbv) < 1e-7) {   // nothing left to play
      L.fill(0); R.fill(0); this.am += (amT - this.am) * Math.min(1, this.kS * n); return true;
    }
    // block constants (density, size and scatter only matter when a grain starts)
    const kb = Math.min(1, this.kS * n);
    this.sz += (P.size[0] - this.sz) * kb; this.sc += (P.scatter[0] - this.sc) * kb;
    this.dens += (Math.min(P.density[0], 28 / (this.sz * 0.001)) - this.dens) * kb;   // at most ~28 live grains
    const wt = Math.round(P.win[0]), overlap = this.dens * this.sz * 0.001;
    const og = 1 / Math.sqrt(Math.max(overlap * this.power[wt], 0.35));
    const decor = clamp((overlap - 1) * 3, 0, 25) * 0.001 * sampleRate;
    const interval = sampleRate / this.dens, jit = 0.9 * this.sc;
    const buf = this.buf, mask = this.mask, hann = this.hann, gauss = this.gauss;
    let h = 0;
    for (let i = 0; i < n; i++) {
      if (h < this.nHits && this.hitIdx[h] === i) {   // a hit: its cloud replays the same every loop
        h++; this.rng = mkRng(hash(this.seed, Math.round(this.beat(i) * 96)));
        this.until = Math.min(this.until, 1);
      }
      this.am += (amT - this.am) * this.kS;
      const a = this.am, xl = i0 ? i0[i] : 0, xr = i1 ? i1[i] : 0, x = 0.5 * (xl + xr);
      if (this.quiet <= this.idleAfter) {
        this.until -= 1;
        while (this.until <= 0) { this.spawn(P, decor); this.until += Math.max(1, interval * (1 + jit * (2 * this.rng() - 1))); }
      }
      let sl = 0, sr = 0;
      for (let k = 0; k < MAXG; k++) {
        if (!this.on[k]) continue;
        const ln = this.len[k], ag = this.age[k];
        let wv;
        if (this.wt[k] === 2) { const e = this.edge[k]; wv = Math.min(1, ag / e, (ln - ag) / e); }
        else { const u = (ag / ln) * TAB, t = this.wt[k] ? gauss : hann, j = u | 0; wv = t[j] + (t[j + 1] - t[j]) * (u - j); }
        const v = hermite(buf, mask, this.pos[k]) * wv;
        sl += v * this.gl[k]; sr += v * this.gr[k];
        let p = this.pos[k] + this.inc[k]; if (p >= mask + 1) p -= mask + 1; else if (p < 0) p += mask + 1;
        this.pos[k] = p;
        if ((this.age[k] = ag + 1) >= ln) this.on[k] = 0;
      }
      sl *= og; sr *= og;
      // short grains of a kick's sub carry DC: a 20 Hz high-pass on the cloud takes it out
      this.hl += (sl - this.hl) * this.kHp; this.hr += (sr - this.hr) * this.kHp; sl -= this.hl; sr -= this.hr;
      // feedback into the buffer: DC-blocked, low-passed ~5 kHz, soft clipped
      const m = 0.5 * (sl + sr);
      this.dc += (m - this.dc) * this.kDc; this.lp += (m - this.dc - this.lp) * this.kLp;
      this.fbv = softClip(this.lp * 0.45 * a * 1.1) * 0.91;
      let wv = x + this.fbv; if (Math.abs(wv) < 1e-20) wv = 0;
      buf[this.w] = wv; this.w = (this.w + 1) & mask;
      // wet leveller: never much over the input's recent peak
      const ax = Math.abs(x); this.env = ax > this.env ? ax : this.env * this.envRel;
      const cg = 1.1 * a, lvl = Math.max(Math.abs(sl), Math.abs(sr)) * cg, thr = this.env * 1.3 + 1e-6;
      const want = lvl > thr ? thr / lvl : 1;
      this.lg += (want - this.lg) * (want < this.lg ? this.kA : this.kR);
      const dg = 1 - 0.62 * a, wg = cg * this.lg;
      L[i] = xl * dg + sl * wg; R[i] = xr * dg + sr * wg;
    }
    return true;
  }
}
registerProcessor("kdfx-grain-cloud", P);` },
    create: (ctx, env) => G.make(ctx, env, {
      proc: "kdfx-grain-cloud",
      map: (s) => {
        const d = s.dials || {}, t = s.toggles || {};
        return {
          amount: K.clamp(s.amount || 0),
          density: density(s.x != null ? s.x : 0.5),
          spray: G.bip(s.y != null ? s.y : 0.5) * 12,
          size: sizeMs(d.size != null ? d.size : 0.45),
          scatter: K.clamp(d.scatter != null ? d.scatter : 0.3),
          reverse: t.reverse ? 1 : 0,
          win: Math.max(0, Math.min(2, Math.round(t.window || 0))),
        };
      },
    }),
  });
})();

// ------------------------------------------------------------------ 02 GRAIN FREEZE
// Catches a hit and holds it as a drone. The voice is recorded into a mono ring; on a chosen hit the
// sound around its body (the freeze point) is copied out and 4-6 overlapping Hann grains loop around
// that point (X = how far they wander, Y = pitch by read rate), panned by STEREO SCATTER. The dry
// voice always passes untouched; the drone is added on top, levelled under the hit's own peak.
(function () {
  "use strict";
  const K = window.KdFx, G = K && K.granular;
  if (!G) return;
  // HOLD TIME steps in beats (0 = forever) and their names
  const HOLD = [[0.25, "1/16"], [0.5, "1/8"], [1, "1/4"], [2, "1/2"], [4, "1 bar"], [8, "2 bars"], [16, "4 bars"], [32, "8 bars"], [0, "\u221e"]];
  // where the body of each kind of hit sits after its start (a kick's body is later than a hat's)
  const BODY = { kick: 0.025, snare: 0.015, clap: 0.015, hats: 0.006, perc: 0.01 };

  const SRC = G.LIB + `
const HOLD = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 0];
const EVERY = [0, 1, 2, 4];
class P extends KdBase {
  static get parameterDescriptors() {
    const k = (name, def, min, max) => ({ name, defaultValue: def, minValue: min, maxValue: max, automationRate: "k-rate" });
    return [{ name: "trig", defaultValue: 0, minValue: 0, maxValue: 1000, automationRate: "a-rate" },
      k("amount", 0, 0, 1), k("spread", 0.5, 0, 1), k("pitch", 0, -24, 24), k("hold", 4, 0, 8),
      k("scatter", 0.5, 0, 1), k("mode", 1, 0, 3), k("manual", 0, 0, 1)];
  }
  constructor(o) {
    super(o);
    const sr = sampleRate;
    this.body = Math.round((this.opts.body || 0.015) * sr);
    this.size = pow2Above(sr * 2); this.mask = this.size - 1; this.ring = new Float32Array(this.size);
    this.pre = Math.round(0.06 * sr); this.capN = pow2Above(sr * 0.62); this.cmask = this.capN - 1;
    // two drone slots, so a new capture crossfades from the old one
    this.slots = [0, 1].map(() => ({ buf: new Float32Array(this.capN), on: false, ready: false, env: 0, tgt: 0, step: 0,
      start: 0, filled: 0, point: 0, hit: 0, end: 0, fade: 1, peak: 0, next: 0, rng: mkRng(1),
      g: Array.from({ length: 10 }, () => ({ on: false, pos: 0, inc: 1, age: 0, len: 1, k: 0, gain: 1, gl: 1, gr: 1 })) }));
    this.cur = -1; this.w = 0; this.count = 0; this.amt = 0; this.lg = 1; this.thr = 1; this.inPk = 0; this.wasManual = false;
    this.sm = onePole(0.03); this.att = onePole(0.001); this.rel = onePole(0.15);
    this.dcC = onePole(1 / (2 * Math.PI * 20)); this.dl = 0; this.dr = 0;
  }
  pending() { return (this.slots[0].on && !this.slots[0].ready) || (this.slots[1].on && !this.slots[1].ready); }
  // plan a capture of the hit at absolute sample "hit": it starts once enough of it is recorded
  plan(hit, beat, holdIdx) {
    const k = this.cur === 0 ? 1 : 0, s = this.slots[k];
    for (let j = 0; j < s.g.length; j++) s.g[j].on = false;
    s.on = true; s.ready = false; s.env = 0; s.tgt = 0; s.next = 0; s.peak = 0;
    s.hit = hit; s.point = hit + this.body; s.start = s.point - this.pre; s.filled = s.start;
    const beats = HOLD[holdIdx] || 0, len = beats * this.spb();
    s.end = beats > 0 ? hit + len : 0;
    s.fade = beats > 0 ? Math.max(0.02 * sampleRate, Math.min(len * 0.25, sampleRate)) : 0.3 * sampleRate;
    s.rng = mkRng(hash(this.seed, Math.round(beat * 96)));
  }
  spawn(s, spread, r, scatter) {
    const sr = sampleRate, rng = s.rng, N = 4 + 2 * spread;
    // grains: shorter when tight, longer when pitched down (so a low drone keeps its low end)
    const L = Math.round((0.05 + 0.07 * spread) * sr * (r < 1 ? 1 / r : 1));
    s.next = Math.max(16, Math.round((L / N) * (1 + (0.3 + 0.2 * spread) * (2 * rng() - 1))));
    let g = null;
    for (let j = 0; j < s.g.length; j++) if (!s.g[j].on) { g = s.g[j]; break; }
    if (!g) return;
    const fp = L * r, spr = (0.0015 + spread * spread * 0.2) * sr, avail = s.filled - s.start;
    let p = s.point - s.start + spr * (rng() * 1.25 - 0.25) + rng() * (0.001 + 0.004 * spread) * sr - fp / 2;
    p = clamp(p, 2, Math.max(2, avail - fp - 4));
    const pan = scatter * (2 * rng() - 1), ang = ((pan + 1) * Math.PI) / 4;
    g.on = true; g.pos = p; g.inc = r; g.age = 0; g.len = L; g.k = (2 * Math.PI) / L;
    g.gain = 1 / Math.sqrt(Math.max(N * 0.375, 0.35));
    g.gl = Math.cos(ang) * Math.SQRT2; g.gr = Math.sin(ang) * Math.SQRT2;
  }
  process(inputs, outputs, P) {
    if (!this.alive) return false;
    const inp = inputs[0], out = outputs[0], oL = out[0], oR = out[1] || out[0], n = oL.length;
    const a = inp && inp.length ? inp[0] : null, b = inp && inp.length > 1 ? inp[1] : a;
    const amt = P.amount[0], mode = Math.round(P.mode[0]), manual = P.manual[0] > 0.5, holdIdx = Math.round(P.hold[0]);
    const spread = P.spread[0], r = Math.pow(2, Math.round(P.pitch[0]) / 12), scatter = P.scatter[0];
    const w0 = this.w, sr = sampleRate, mask = this.mask;
    this.lastSpread = spread; this.lastRate = r;
    // hits: count them (per pass) and capture where FREEZE ON TRANSIENT / MANUAL FREEZE say
    this.hits(P.trig, (i) => {
      const k = this.count++, every = EVERY[mode] || 0;
      const want = manual ? this.cur < 0 && !this.pending() : every > 0 && k % every === 0;
      if (want) this.plan(w0 + i, this.beat(i), holdIdx);
    });
    if (manual !== this.wasManual) {
      this.wasManual = manual;
      // on with nothing held: grab the last ~200 ms if something is sounding, else the next hit
      if (manual && this.cur < 0 && !this.pending() && this.inPk > 0.003) this.plan(w0 - Math.round(0.2 * sr), this.beat(0), 8);
      if (!manual && this.cur >= 0) { const s = this.slots[this.cur]; s.tgt = 0; s.step = 1 / (0.3 * sr); }
    }
    // the centre: just the dry voice (keep recording, so a drag outwards has something to catch)
    const idle = (amt < 0.01 && this.amt < 1e-4) || (!this.slots[0].on && !this.slots[1].on);
    let pk = 0;
    if (idle) {
      for (let i = 0; i < n; i++) {
        const xl = a ? a[i] : 0, xr = b ? b[i] : 0, x = 0.5 * (xl + xr);
        this.ring[(w0 + i) & mask] = x; oL[i] = xl; oR[i] = xr;
        const ax = x < 0 ? -x : x; if (ax > pk) pk = ax;
      }
      this.w = w0 + n; this.amt += (amt - this.amt) * Math.min(1, this.sm * n);
      this.inPk = Math.max(pk, this.inPk * 0.97);
      if (amt < 0.01) { for (const s of this.slots) s.on = s.ready = false; this.cur = -1; }
      else this.fill();
      return true;
    }
    for (let i = 0; i < n; i++) {
      const xl = a ? a[i] : 0, xr = b ? b[i] : 0, x = 0.5 * (xl + xr);
      this.ring[(w0 + i) & mask] = x;
      const ax = x < 0 ? -x : x; if (ax > pk) pk = ax;
      let yl = 0, yr = 0;
      for (let q = 0; q < 2; q++) {
        const s = this.slots[q];
        if (!s.ready) continue;
        if (s.env < s.tgt) { s.env += s.step; if (s.env > s.tgt) s.env = s.tgt; }
        else if (s.env > s.tgt) {
          s.env -= s.step;
          if (s.env <= 0) { s.env = 0; s.on = s.ready = false; if (this.cur === q) this.cur = -1; continue; }
        }
        if (--s.next <= 0) this.spawn(s, spread, r, scatter);
        let sl = 0, sR = 0;
        for (let j = 0; j < s.g.length; j++) {
          const g = s.g[j];
          if (!g.on) continue;
          const v = hermite(s.buf, this.cmask, g.pos) * (0.5 - 0.5 * Math.cos(g.age * g.k)) * g.gain;
          sl += v * g.gl; sR += v * g.gr;
          g.pos += g.inc;
          if (++g.age >= g.len) g.on = false;
        }
        yl += sl * s.env; yr += sR * s.env;
      }
      this.amt += (amt - this.amt) * this.sm;
      yl *= this.amt; yr *= this.amt;
      // DC blocker: a pitched-down kick body carries a lot of near-DC
      this.dl += (yl - this.dl) * this.dcC; this.dr += (yr - this.dr) * this.dcC; yl -= this.dl; yr -= this.dr;
      // leveller: the drone never gets louder than about the captured hit's peak
      const lev = Math.max(yl < 0 ? -yl : yl, yr < 0 ? -yr : yr), want = lev > this.thr ? this.thr / lev : 1;
      this.lg += (want - this.lg) * (want < this.lg ? this.att : this.rel);
      oL[i] = xl + yl * this.lg; oR[i] = xr + yr * this.lg;
    }
    this.w = w0 + n;
    this.inPk = Math.max(pk, this.inPk * 0.97);
    this.fill();
    // hold over: fade out over a quarter of the hold (at most ~1 s); MANUAL FREEZE holds forever
    if (this.cur >= 0 && !manual) {
      const s = this.slots[this.cur];
      if (s.end > 0 && this.w >= s.end && s.tgt > 0) { s.tgt = 0; s.step = 1 / s.fade; }
    }
    return true;
  }
  // copy newly recorded audio into capturing slots; start a slot once its grains have what they need
  fill() {
    const sr = sampleRate, sp = this.lastSpread || 0, r = this.lastRate || 1;
    // what the grains read past the freeze point: the spread plus half a grain's footprint
    const L = (0.05 + 0.07 * sp) * sr * (r < 1 ? 1 / r : 1), need = Math.round((0.0015 + sp * sp * 0.2 + 0.005 * sp) * sr + 0.5 * L * r + 8);
    for (let q = 0; q < 2; q++) {
      const s = this.slots[q];
      if (!s.on) continue;
      const to = Math.min(this.w, s.start + this.capN);
      for (let p = s.filled; p < to; p++) {
        const v = this.ring[p & this.mask];
        s.buf[p - s.start] = v;
        if (p >= s.hit) { const av = v < 0 ? -v : v; if (av > s.peak) s.peak = av; }
      }
      if (to > s.filled) s.filled = to;
      if (!s.ready && s.filled >= s.point + Math.round(0.004 * sr) && s.filled >= Math.min(s.start + this.capN, s.point + need)) {
        s.ready = true; s.tgt = 1; s.step = 1 / ((0.04 + 0.08 * sp) * sr);
        if (this.cur >= 0 && this.cur !== q) { const o = this.slots[this.cur]; o.tgt = 0; o.step = 1 / (0.04 * sr); }
        this.cur = q; this.thr = Math.max(1e-4, s.peak * 0.9);
        if (s.end > 0) s.end = this.w + (s.end - s.hit);   // the hold counts from when the drone starts
      }
    }
  }
}
registerProcessor("kdfx-grain-freeze", P);
`;
  K.register({
    id: "grain-freeze", num: 2, name: "GRAIN FREEZE", group: "GRANULAR & TIME",
    caption: "Catches one hit and holds it as an endless drone.",
    axes: { x: "SPREAD", y: "PITCH" },
    fmtX: (x) => Math.round(1.5 + K.clamp(x) * K.clamp(x) * 200) + " ms",
    fmtY: (y) => K.fmt.st(Math.round(G.bip(y) * 24)),
    dials: [
      { id: "hold", name: "HOLD TIME", def: 0.5, fmt: (v) => HOLD[G.step(v, HOLD.length)][1] },
      { id: "scatter", name: "STEREO SCATTER", def: 0.4, fmt: K.fmt.pct },
    ],
    toggles: [
      { id: "transient", name: "FREEZE ON TRANSIENT", options: ["OFF", "EVERY HIT", "EVERY 2ND", "EVERY 4TH"], def: 1 },
      { id: "manual", name: "MANUAL FREEZE", def: false },
    ],
    presets: [
      { name: "Ice Snare", voice: "snare", x: 0.8, y: 0.5, wet: 0.8, strength: 1.15, dials: { hold: 0.5, scatter: 0.5 }, toggles: { transient: 3, manual: false } },
      { name: "Sub Pillar", voice: "kick", x: 0.3, y: 0.25, wet: 0.8, strength: 1.3, dials: { hold: 0.38, scatter: 0 }, toggles: { transient: 1, manual: false } },
      { name: "Glass Hat", voice: "hats", x: 0.65, y: 0.75, wet: 0.7, dials: { hold: 0.38, scatter: 0.95 }, toggles: { transient: 3, manual: false } },
      { name: "Ghost Note", voice: "perc", x: 0.62, y: 0.5, wet: 0.4, strength: 2, dials: { hold: 0.16, scatter: 0.4 }, toggles: { transient: 1, manual: false } },
    ],
    worklets: { "kdfx-grain-freeze": SRC },
    create: (ctx, env) => G.make(ctx, env, {
      proc: "kdfx-grain-freeze",
      options: { body: BODY[(env && env.kind) || "perc"] || 0.012 },
      map: (s) => {
        const d = s.dials || {}, t = s.toggles || {};
        return {
          amount: K.clamp(s.amount || 0), spread: K.clamp(s.x == null ? 0.5 : s.x), pitch: Math.round(G.bip(s.y == null ? 0.5 : s.y) * 24),
          hold: G.step(d.hold == null ? 0.5 : d.hold, HOLD.length), scatter: K.clamp(d.scatter == null ? 0.4 : d.scatter),
          mode: t.transient == null ? 1 : t.transient | 0, manual: t.manual ? 1 : 0,
        };
      },
    }),
  });
})();

// ------------------------------------------------------------------ 03 STUTTER
// Machine-gun retriggers on the beat grid. On a hit the worklet rolls the dice (PROBABILITY, keyed on
// the song position); a rolled hit plays live for one slice while it is captured, then that slice
// repeats every slice length (gain x DECAY per repeat, read faster/slower for the pitch ramp) until the
// next hit of the voice or the roll length (amount). The roll replaces the hit's tail.
(function () {
  "use strict";
  const K = window.KdFx, G = K && K.granular;
  if (!G) return;

  // X: four slice zones, left to right; TRIPLET GRID makes each 2/3 as long (1/12, 1/24, 1/48, 1/96)
  const SLICES = [[0.5, "1/8", "1/12"], [0.25, "1/16", "1/24"], [0.125, "1/32", "1/48"], [0.0625, "1/64", "1/96"]];
  const zone = (x) => SLICES[G.step(x, 4)];
  const sliceBeats = (x, tri) => zone(x)[0] * (tri ? 2 / 3 : 1);
  const stepOf = (y) => G.bip(y) * 3;                       // semitones per repeat, -3..+3
  const fmtSt = (v) => (Math.abs(v) < 0.05 ? "0 st" : (v > 0 ? "+" : "") + v.toFixed(1) + " st") + " / rep";

  const SRC = G.LIB + `
const NP = 6;
// integer hash (no strings in the audio thread): the dice for a hit at song tick t
const ihash = (a, b) => { let h = (a ^ Math.imul(b | 0, 0x9e3779b1)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };
class P extends KdBase {
  static get parameterDescriptors() {
    return [
      { name: "amount", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "slice", defaultValue: 0.125, minValue: 0.01, maxValue: 1, automationRate: "k-rate" },
      { name: "pitch", defaultValue: 0, minValue: -12, maxValue: 12, automationRate: "k-rate" },
      { name: "prob", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "decay", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "gate", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "trig", defaultValue: 0, minValue: 0, automationRate: "a-rate" },
    ];
  }
  constructor(o) {
    super(o);
    const sr = sampleRate;
    this.F = Math.max(8, Math.round(0.0025 * sr));       // fade at every slice edge
    this.FE = Math.max(16, Math.round(0.005 * sr));      // fade at the end of a roll
    this.pre = this.F * 4 + 8;                           // audio kept from just before the hit (pre-roll, up to 4x fast reads)
    this.hsz = pow2Above(this.pre + 16); this.hmask = this.hsz - 1;
    this.hist = [new Float32Array(this.hsz), new Float32Array(this.hsz)];
    this.csz = pow2Above(this.pre + Math.ceil(sr * 0.6) + 16); this.cmask = this.csz - 1;   // a 1/8 slice down to 50 BPM
    this.cap = [[new Float32Array(this.csz), new Float32Array(this.csz)], [new Float32Array(this.csz), new Float32Array(this.csz)]];
    this.recPos = new Int32Array(2); this.recEnd = new Int32Array(2);
    this.cur = 1;
    // players: one per sounding repeat (onset, read rate, gain, window end and fade, release)
    this.pa = new Uint8Array(NP); this.pb = new Uint8Array(NP);
    this.pon = new Float64Array(NP); this.prate = new Float64Array(NP); this.pg = new Float64Array(NP);
    this.pend = new Float64Array(NP); this.pfo = new Float64Array(NP); this.prel = new Float64Array(NP); this.prl = new Float64Array(NP);
    this.hitAt = new Int32Array(128); this.nHits = 0;
    this.hw = 0; this.n = 0; this.lvl = 0; this.first = true; this.idle = true;
    this.roll = false; this.rh = 0; this.rP = 0; this.rCap = 0; this.rR = 1; this.rNext = 0; this.rOff = 0; this.rG = 1; this.rB = 0;
    this.m = 0; this.mT = 0; this.mStep = 1; this.mAt = 0; this.mHold = -1;
    // DC blocker on the repeats (a short low slice of a kick repeated fast is mostly DC)
    this.dcR = 1 - (2 * Math.PI * 20) / sr; this.dx0 = 0; this.dy0 = 0; this.dx1 = 0; this.dy1 = 0;
  }
  releaseAll(n) {
    for (let k = 0; k < NP; k++) if (this.pa[k] && this.prel[k] < 0) {
      const tau = n - this.pon[k];
      this.prel[k] = n; this.prl[k] = tau < 0 ? Math.max(1, -tau) : this.FE;   // still in its pre-roll: gone by its onset
    }
  }
  spawn(on, rate, g, end, fo, b) {
    let k = 0;
    for (; k < NP; k++) if (!this.pa[k]) break;
    if (k === NP) return;
    this.pa[k] = 1; this.pb[k] = b; this.pon[k] = on; this.prate[k] = rate; this.pg[k] = g;
    this.pend[k] = end; this.pfo[k] = fo; this.prel[k] = -1; this.prl[k] = 1;
  }
  startRoll(n, bt, gate) {
    const b = (this.cur = 1 - this.cur);
    for (let k = 0; k < NP; k++) if (this.pa[k] && this.pb[k] === b) this.pa[k] = 0;   // only on flams under 5 ms
    for (let c = 0; c < 2; c++) {
      const h = this.hist[c], d = this.cap[b][c];
      for (let k = 0; k < this.pre; k++) d[k] = h[(this.hw - this.pre + k) & this.hmask];
    }
    const P = Math.max(this.F * 3, bt * this.spb());
    this.roll = true; this.rh = n; this.rP = P; this.rCap = Math.min(P, this.csz - this.pre - 8);
    this.rR = 1; this.rNext = n + P; this.rOff = 0; this.rG = 1; this.rB = b; this.rBeats = bt;
    this.recPos[b] = this.pre; this.recEnd[b] = this.pre + Math.ceil(this.rCap) + 4;
    // the live hit plays its slice (half of it with GATE), then the repeats take over
    const pg = gate ? P / 2 : P;
    this.mT = 1; this.mStep = 1 / this.F; this.mAt = n + Math.max(1, pg - this.F); this.mHold = -1;
  }
  process(inputs, outputs, P) {
    if (!this.alive) return false;
    const inp = inputs[0] || [], out = outputs[0], N = out[0].length;
    const nc = inp.length > 1 ? 2 : 1, x0 = inp[0], x1 = inp[1] || inp[0];
    const a = P.amount[0], tgt = a < 0.01 ? 0 : Math.min(1, (a - 0.01) / 0.09);
    if (this.first) { this.lvl = tgt; this.first = false; }
    // hits in this block
    this.nHits = 0;
    this.hits(P.trig, (i) => { if (this.nHits < 128) this.hitAt[this.nHits++] = i; });
    let busy = this.roll || this.m > 0 || this.lvl > 1e-4 || tgt > 0;
    if (!busy) for (let k = 0; k < NP; k++) if (this.pa[k]) { busy = true; break; }
    if (!busy || !x0) {
      // idle: the voice passes through untouched
      for (let i = 0; i < N; i++) { out[0][i] = x0 ? x0[i] : 0; out[1][i] = x1 ? x1[i] : 0; }
      this.n += N; this.idle = true;
      return true;
    }
    if (this.idle) { this.hist[0].fill(0); this.hist[1].fill(0); this.idle = false; }
    const sliceB = P.slice[0], step = P.pitch[0], prob = P.prob[0], f = 1 - 0.5 * P.decay[0], gate = P.gate[0] > 0.5;
    const lc = onePole(0.02), F = this.F, FE = this.FE, pre = this.pre, cm = this.cmask, spb = this.spb();
    if (a < 0.01 && this.roll) { this.roll = false; this.releaseAll(this.n); }
    if (a < 0.01 && this.mT > 0) { this.mT = 0; this.mStep = 1 / FE; this.mAt = this.n; }
    let hi = 0;
    for (let i = 0; i < N; i++) {
      const n = this.n + i;
      if (hi < this.nHits && this.hitAt[hi] === i) {
        hi++;
        // a new hit ends the roll (5 ms fade) and passes through dry, or rolls again
        if (this.roll || this.mT > 0) { this.roll = false; this.releaseAll(n); }
        this.m = 0; this.mT = 0;
        if (a >= 0.01) {
          const u = ihash(this.seed, Math.round(this.beat(i) * 96)) / 4294967296;
          if (u < prob) this.startRoll(n, sliceB, gate);
        }
      }
      // next repeat: spawn it a fade length ahead so its attack lands on the grid at full gain
      if (this.roll && n >= this.rNext - F) {
        const maxSl = Math.max(2, Math.round(2 / this.rBeats));
        const nRep = Math.max(1, Math.round(a * (maxSl - 1)));
        if (this.rR > nRep) { this.roll = false; this.mHold = n + Math.round(8 * spb); }
        else {
          this.rOff = clamp(this.rOff + step, -24, 24); this.rG *= f;
          const rate = Math.pow(2, this.rOff / 12), Pp = this.rP;
          const end = Math.min(gate ? Pp / 2 : Pp, this.rCap / rate);
          const last = this.rR === nRep;
          this.spawn(this.rNext, rate, this.rG, end, Math.min(last ? FE : F, end / 2), this.rB);
          this.rR++; this.rNext += Pp;
          if (last) { this.roll = false; this.mHold = n + Math.round(8 * spb); }
        }
      }
      if (this.mHold >= 0 && n >= this.mHold) { this.mHold = -1; this.mT = 0; this.mStep = 1 / FE; this.mAt = n; }
      if (n >= this.mAt) { const d = this.mT - this.m; this.m += d > this.mStep ? this.mStep : d < -this.mStep ? -this.mStep : d; }
      this.lvl += (tgt - this.lvl) * lc;
      const s0 = x0[i], s1 = nc > 1 ? x1[i] : s0;
      // keep a short history (pre-roll) and record the live slice of the rolls being captured
      const w = this.hw & this.hmask;
      this.hist[0][w] = s0; this.hist[1][w] = s1; this.hw++;
      for (let b = 0; b < 2; b++) if (this.recPos[b] < this.recEnd[b]) { const p = this.recPos[b]++; this.cap[b][0][p] = s0; this.cap[b][1][p] = s1; }
      let w0 = 0, w1 = 0;
      for (let k = 0; k < NP; k++) {
        if (!this.pa[k]) continue;
        const tau = n - this.pon[k], end = this.pend[k];
        if (tau >= end) { this.pa[k] = 0; continue; }
        let e = tau < 0 ? (tau + F) / F : tau > end - this.pfo[k] ? (end - tau) / this.pfo[k] : 1;
        if (this.prel[k] >= 0) {
          const r = 1 - (n - this.prel[k]) / this.prl[k];
          if (r <= 0) { this.pa[k] = 0; continue; }
          e *= r;
        }
        if (e <= 0) continue;
        const g = e * this.pg[k], pos = pre + tau * this.prate[k], c = this.cap[this.pb[k]];
        w0 += g * hermite(c[0], cm, pos);
        if (nc > 1) w1 += g * hermite(c[1], cm, pos);
      }
      const R = this.dcR;
      this.dy0 = w0 - this.dx0 + R * this.dy0; this.dx0 = w0; w0 = this.dy0;
      if (nc > 1) { this.dy1 = w1 - this.dx1 + R * this.dy1; this.dx1 = w1; w1 = this.dy1; }
      const live = 1 - this.m * this.lvl, L = this.lvl;
      out[0][i] = s0 * live + w0 * L;
      out[1][i] = nc > 1 ? s1 * live + w1 * L : out[0][i];
    }
    this.n += N;
    return true;
  }
}
registerProcessor("kdfx-stutter", P);`;

  K.register({
    id: "stutter", num: 3, name: "STUTTER", group: "GRANULAR & TIME", caption: "Machine-gun retriggers synced to tempo.",
    axes: { x: "SLICE", y: "PITCH RAMP" },
    fmtX: (x, s) => zone(x)[s && s.toggles && s.toggles.triplet ? 2 : 1],
    fmtY: (y) => fmtSt(stepOf(y)),
    dials: [
      { id: "prob", name: "PROBABILITY", def: 1, fmt: K.fmt.pct },
      { id: "decay", name: "DECAY", def: 0.2, fmt: (v) => (v < 0.01 ? "constant" : (20 * Math.log10(1 - 0.5 * K.clamp(v))).toFixed(1) + " dB / rep") },
    ],
    toggles: [
      { id: "gate", name: "GATE", def: false },
      { id: "triplet", name: "TRIPLET GRID", def: false },
    ],
    presets: [
      { name: "Rattle", voice: "snare", x: 0.72, y: 0.5, wet: 1, dials: { prob: 0.4, decay: 0.3 }, toggles: { gate: false, triplet: false } },
      { name: "Hat Drill", voice: "hats", x: 0.97, y: 0.5, wet: 0.6, dials: { prob: 1, decay: 0.35 }, toggles: { gate: false, triplet: false } },
      { name: "Kick Drop", voice: "kick", x: 0.3, y: 0.12, wet: 1, strength: 0.6, dials: { prob: 1, decay: 0.25 }, toggles: { gate: false, triplet: false } },
      { name: "Glitch Skip", voice: "perc", x: 0.15, y: 0.5, wet: 1, strength: 0.5, dials: { prob: 0.2, decay: 0.2 }, toggles: { gate: false, triplet: true } },
    ],
    worklets: { "kdfx-stutter": SRC },
    create: (ctx, env) => G.make(ctx, env, {
      proc: "kdfx-stutter",
      map: (s) => ({
        amount: s.amount,
        slice: sliceBeats(s.x, s.toggles && s.toggles.triplet),
        pitch: stepOf(s.y),
        prob: s.dials ? s.dials.prob : 1,
        decay: s.dials ? s.dials.decay : 0,
        gate: s.toggles && s.toggles.gate ? 1 : 0,
      }),
    }),
  });
})();

// ------------------------------------------------------------------ 04 TAPE STOP
// A varispeed read head over a ring buffer of the voice. At each event (a hit, or the bar line with
// BAR END ONLY) the head's speed ramps down to a floor (STOP), up from it (SPIN-UP) or dips and comes
// back (SAG), so pitch and time bend together (cubic Hermite reads). Afterwards the head crossfades
// back to the live input (or, after a SAG, runs a touch fast until it has caught up): nothing stays late.
(function () {
  "use strict";
  const K = window.KdFx, G = K && K.granular;
  if (!G) return;

  const rampBeats = (x) => Math.pow(2, -6 + 7 * K.clamp(x));          // X: 1/64 beat .. 2 beats (log)
  const dirOf = (y) => { const b = G.bip(y); return b < -0.25 ? -1 : b > 0.25 ? 1 : 0; };   // Y: STOP / SAG / SPIN-UP
  const EVERY = [8, 4, 2, 1], EVERY_TXT = ["1 in 8", "1 in 4", "1 in 2", "every"];
  const fmtRamp = (x, s) => {
    const b = rampBeats(x), n = K.NOTES.find(([v]) => Math.abs(v - b) / v < 0.04);
    return n ? n[1] : Math.round((b * 60000) / ((s && s.bpm) || 120)) + " ms";
  };

  K.register({
    id: "tape-stop", num: 4, name: "TAPE STOP", group: "GRANULAR & TIME",
    caption: "Drums slow down and drop like a dying turntable.",
    axes: { x: "RAMP TIME", y: "DIRECTION" },
    fmtX: fmtRamp,
    fmtY: (y) => ["STOP", "SAG", "SPIN-UP"][dirOf(y) + 1],
    dials: [
      { id: "curve", name: "CURVE", def: 0.3, fmt: (v) => (v < 0.03 ? "linear" : v > 0.97 ? "exponential" : Math.round(v * 100) + "% exp") },
      { id: "rate", name: "RETRIGGER RATE", def: 1, fmt: (v) => EVERY_TXT[G.step(v, 4)] },
    ],
    toggles: [
      { id: "bar", name: "BAR END ONLY", def: false },
      { id: "latch", name: "LATCH", def: false },
    ],
    presets: [
      // full stop over the last beat of every 4th bar, back on the downbeat
      { name: "Power Cut", voice: "all", x: 0.857, y: 0, wet: 1, dials: { curve: 0.35, rate: 0.375 }, toggles: { bar: true, latch: true } },
      // every kick dips ~20 % in speed and comes back over 1/4 beat
      { name: "Slow Kick", voice: "kick", x: 0.571, y: 0.4, wet: 1, strength: 0.85, dials: { curve: 0.3, rate: 1 }, toggles: { bar: false, latch: false } },
      // each snare winds up from almost stopped over 1/8 beat
      { name: "Wind-up", voice: "snare", x: 0.43, y: 1, wet: 1, strength: 0.9, dials: { curve: 0.6, rate: 1 }, toggles: { bar: false, latch: false } },
      // tiny fast stops on every hat
      { name: "Wobble Deck", voice: "hats", x: 0.2, y: 0.3, wet: 1, strength: 0.7, dials: { curve: 0.2, rate: 1 }, toggles: { bar: false, latch: false } },
    ],
    worklets: { "kdfx-tape-stop": G.LIB + `
// head gain from its speed: a stopped head goes quiet (no DC, no buzz)
const gainOf = (r) => { if (r >= 0.3) return 1; if (r <= 0.02) return 0; const t = (r - 0.02) / 0.28; return t * t * (3 - 2 * t); };
// ramp shape 0..1: k = 0 linear, larger k = exponential (fast, then slow)
const shape = (u, k) => (k < 0.01 ? u : (1 - Math.exp(-k * u)) / (1 - Math.exp(-k)));
// read d samples behind the write index w (linear in the last sample, Hermite further back)
const rd = (b, mask, w, d) => { if (d < 1) { const a = b[(w - 1) & mask], c = b[w & mask]; return c + (a - c) * d; } return hermite(b, mask, w - d); };

class P extends KdBase {
  static get parameterDescriptors() {
    const k = (name, defaultValue, minValue, maxValue) => ({ name, defaultValue, minValue, maxValue, automationRate: "k-rate" });
    return [
      { name: "trig", defaultValue: 0, minValue: 0, automationRate: "a-rate" },
      k("amount", 0, 0, 1), k("ramp", 0.25, 0.001, 8), k("dir", -1, -1, 1), k("curve", 0.3, 0, 1),
      k("every", 1, 1, 8), k("bar", 0, 0, 1), k("latch", 0, 0, 1),
    ];
  }
  constructor(o) {
    super(o);
    this.N = pow2Above(Math.ceil(4 * sampleRate)); this.mask = this.N - 1; this.cap = this.N - 8;
    this.bl = new Float32Array(this.N); this.br = new Float32Array(this.N);   // R only written for stereo input
    this.w = 0; this.stereo = false; this.started = false;
    this.depth = 0; this.sm = onePole(0.02);
    this.xf = Math.round(0.006 * sampleRate);       // crossfade back to the live input
    this.tau = 0.005 * sampleRate; this.cs = onePole(0.01);
    // the main head: live = reading the input as it comes; phase 1 ramp, 2 hold at the floor, 3 catch-up
    this.live = true; this.delay = 0; this.rate = 1; this.win = 1; this.winStep = 0;
    this.phase = 0; this.u = 0; this.du = 0; this.dir = -1; this.k = 0; this.hold = 0; this.land = -1;
    this.excess = 0; this.cmax = 0.05; this.rs = 1; this.latch = 0;
    // fading copies of the head after a snap (2 slots)
    this.gd = new Float64Array(2); this.gr = new Float64Array(2); this.gg = new Float64Array(2); this.gs = new Float64Array(2);
    this.hitAt = new Int32Array(32); this.nHits = 0; this.count = 0; this.lastBar = 0;
  }
  // hand the current head to a ghost slot that fades out over len samples (rate: how it keeps moving)
  ghost(rate, len) {
    const gain = (this.live ? 1 : gainOf(this.rate)) * this.win;
    if (gain < 1e-5) return;
    let j = this.gg[0] <= 0 ? 0 : this.gg[1] <= 0 ? 1 : this.gg[0] < this.gg[1] ? 0 : 1;
    this.gd[j] = this.live ? 0 : this.delay; this.gr[j] = rate; this.gg[j] = gain; this.gs[j] = gain / Math.max(1, len);
  }
  // back to the live input with an equal-gain crossfade of len samples
  snapLive(len) {
    if (this.live) return;
    this.ghost(this.rate, len);
    this.live = true; this.delay = 0; this.rate = 1; this.phase = 0; this.excess = 0; this.land = -1;
    this.win = 0; this.winStep = 1 / Math.max(1, len);
  }
  // an event: hard = at a hit (the hit's attack comes in at once, the old head fades under it)
  start(hard, dir, rs, land, k, latch) {
    const f = 1 - this.depth, contLive = this.live && dir <= 0;
    if (!contLive) this.ghost(hard && (this.live || this.delay < this.xf) ? 0 : this.rate, this.xf);
    this.live = false; this.delay = 0; this.dir = dir; this.u = 0; this.rs = rs; this.du = 1 / rs;
    this.phase = 1; this.k = k; this.latch = latch; this.land = land; this.excess = 0;
    this.cmax = Math.max(0.03, 0.35 * this.depth);
    this.rate = dir > 0 ? f : 1;
    if (!contLive) { if (hard) { this.win = 1; this.winStep = 0; } else { this.win = 0; this.winStep = 1 / this.xf; } }
  }
  process(inputs, outputs, P) {
    if (!this.alive) return false;
    const inp = inputs[0] || [], out = outputs[0], oL = out[0], oR = out[1] || out[0], n = oL.length;
    const iL = inp[0], st = inp.length > 1, iR = st ? inp[1] : null;
    if (st && !this.stereo) { this.br.set(this.bl); this.stereo = true; }
    if (!st) this.stereo = false;
    const amt = clamp(P.amount[0], 0, 1);
    if (!this.started) { this.depth = amt; this.started = true; }
    this.nHits = 0;
    this.hits(P.trig, (i) => { if (this.nHits < 32) this.hitAt[this.nHits++] = i; });
    const off = amt < 0.01 && this.depth < 0.01;
    if (off && !this.live) this.snapLive(this.xf);
    const spb = this.spb(), bpb = 1 / spb, dirP = Math.round(P.dir[0]), rampB = clamp(P.ramp[0], 0.001, 8);
    const k = clamp(P.curve[0], 0, 1) * 6, every = Math.max(1, Math.round(P.every[0])), bar = P.bar[0] > 0.5, latch = P.latch[0] > 0.5;
    const rsHit = Math.max(16, Math.round(rampB * spb));
    // BAR END ONLY: a STOP lands on the counted bar line (starts ramp time before it), the others start on it
    let barI = -1, barRs = 0, barK = 0;
    if (bar && !off) {
      const b0 = this.beat(0), lead = dirP < 0 ? rampB : 0;
      let kk = Math.max(Math.ceil((b0 + lead) / 4 - 1e-9), this.lastBar + 1, 1);
      kk = Math.ceil(kk / every) * every;
      const i = Math.ceil((4 * kk - lead - b0) * spb - 1e-6);
      if (i >= 0 && i < n) { barI = i; barK = kk; barRs = Math.max(16, Math.round(lead * spb)); }
    }
    const bl = this.bl, br = this.br, mask = this.mask, xf = this.xf, sm = this.sm;
    let w = this.w, hi = 0;
    for (let i = 0; i < n; i++) {
      // events at this sample
      while (hi < this.nHits && this.hitAt[hi] === i) {
        hi++;
        const idx = this.count++;
        if (!bar && !off && idx % every === 0) this.start(true, dirP, rsHit, -1, k, latch);
      }
      if (i === barI) { this.lastBar = barK; this.start(false, dirP, dirP < 0 ? barRs : rsHit, dirP < 0 ? barRs : -1, k, latch); }
      const xl = iL ? iL[i] : 0, xr = iR ? iR[i] : xl;
      bl[w] = xl; if (st) br[w] = xr;
      this.depth += (amt - this.depth) * sm;
      const f = 1 - this.depth;
      let ol = 0, or = 0;
      if (!this.live) {
        // the head's speed for this sample
        if (this.phase === 1) {
          const u = this.u, s = this.dir === 0 ? (u < 0.5 ? shape(2 * u, this.k) : 1 - shape(2 * u - 1, this.k)) : shape(u, this.k);
          this.rate = this.dir > 0 ? f + (1 - f) * s : 1 - (1 - f) * s;
          this.u += this.du;
          if (this.u >= 1) {
            if (this.dir < 0) { this.phase = 2; this.hold = this.latch || this.land >= 0 ? 1e15 : this.rs; }
            else if (this.dir > 0) this.snapLive(xf);
            else this.phase = 3;
          }
        } else if (this.phase === 2) {
          this.rate = f;
          if (--this.hold <= 0) this.snapLive(Math.max(xf, Math.min(0.03 * sampleRate, this.rs / 4)));
        } else if (this.phase === 3) {
          // after a SAG: run slightly fast until the head is back on time
          this.excess += (Math.min(this.cmax, this.delay / this.tau) - this.excess) * this.cs;
          this.rate = 1 + this.excess;
          if (this.delay - this.excess <= 1e-3) { this.live = true; this.delay = 0; this.rate = 1; this.phase = 0; }
        }
        if (this.land >= 0 && --this.land <= Math.min(xf, this.rs >> 1)) this.snapLive(Math.max(1, this.land));
      }
      if (this.live) { ol = xl * this.win; or = xr * this.win; }
      else {
        const g = gainOf(this.rate) * this.win, d = this.delay;
        if (g > 1e-6) { ol = rd(bl, mask, w, d) * g; or = st ? rd(br, mask, w, d) * g : ol; }
        this.delay = Math.min(this.cap, Math.max(0, d + 1 - this.rate));
      }
      if (this.winStep > 0) { this.win += this.winStep; if (this.win >= 1) { this.win = 1; this.winStep = 0; } }
      for (let j = 0; j < 2; j++) {
        const gg = this.gg[j];
        if (gg <= 0) continue;
        const d = this.gd[j];
        const vl = rd(bl, mask, w, d) * gg;
        ol += vl; or += st ? rd(br, mask, w, d) * gg : vl;
        this.gd[j] = Math.min(this.cap, d + 1 - this.gr[j]);
        this.gg[j] = gg - this.gs[j];
      }
      oL[i] = ol; oR[i] = or;
      w = (w + 1) & mask;
    }
    this.w = w;
    return true;
  }
}
registerProcessor("kdfx-tape-stop", P);` },
    create: (ctx, env) => G.make(ctx, env, {
      proc: "kdfx-tape-stop",
      map: (s) => ({
        amount: s.amount || 0,
        ramp: rampBeats(s.x == null ? 0.5 : s.x),
        dir: dirOf(s.y == null ? 0.5 : s.y),
        curve: K.clamp((s.dials && s.dials.curve) != null ? s.dials.curve : 0.3),
        every: EVERY[G.step((s.dials && s.dials.rate) != null ? s.dials.rate : 1, 4)],
        bar: s.toggles && s.toggles.bar ? 1 : 0,
        latch: s.toggles && s.toggles.latch ? 1 : 0,
      }),
    }),
  });
})();

// ------------------------------------------------------------------ 05 REVERSE ECHO
// Grid-locked reverse delay: what is recorded during one chunk [k*C, (k+1)*C) of the song grid plays
// backwards during the next one, so a hit swells in reverse and peaks right at the following chunk line.
// Two read heads cross-fade at every line (the outgoing one keeps reading backwards past its chunk).
// The dry passes natively (zero latency); the worklet adds the echoes only. Feedback re-records them.
(function () {
  "use strict";
  const K = window.KdFx, G = K && K.granular;
  if (!G) return;
  const ZONES = [[0.125, "1/32"], [0.25, "1/16"], [0.5, "1/8"], [1, "1/4"], [2, "1/2"], [4, "1 bar"]];
  const FB_MAX = 0.85;
  const dampHz = (v) => G.expo(20000, 700, v);
  const zx = (z) => (z + 0.5) / 6;            // a preset's x for a zone
  const fy = (fb) => fb / FB_MAX;             // a preset's y for a feedback amount

  const SRC = G.LIB + `
const ZB = [0.125, 0.25, 0.5, 1, 2, 4];
class P extends KdBase {
  static get parameterDescriptors() {
    return [
      { name: "level", defaultValue: 0, minValue: 0, maxValue: 2, automationRate: "k-rate" },
      { name: "fb", defaultValue: 0, minValue: 0, maxValue: 0.9, automationRate: "k-rate" },
      { name: "damp", defaultValue: 20000, minValue: 50, maxValue: 22000, automationRate: "k-rate" },
      { name: "zone", defaultValue: 3, minValue: 0, maxValue: 5, automationRate: "k-rate" },
      { name: "xf", defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "ping", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor(o) {
    super(o);
    // 2 chunks of 1 bar at 60 BPM (8 s) plus the cross-fade tail
    this.size = pow2Above(Math.ceil(sampleRate * 8.2));
    this.mask = this.size - 1;
    this.bL = new Float32Array(this.size); this.bR = new Float32Array(this.size);
    this.w = 0;
    this.cStart = 0; this.cEnd = -1;            // the current chunk, in song beats (forces a start)
    this.j = 0; this.fi = 0; this.xi = 1;       // current head: samples since its chunk start, fade-in
    this.jo = 0; this.ko = 1e9; this.xo = 1;    // old head: its j, samples since the line, fade length
    this.pc = [1, 1]; this.po = [1, 1];         // pan gains (current, old)
    this.level = 0; this.fbv = 0; this.dampA = 1;
    this.lpL = 0; this.lpR = 0; this.qL = 0; this.qR = 0; this.dcL = 0; this.dcR = 0; this.dcY = 0;
    this.lim = 1; this.env = 0; this.quiet = 1e9;
    this.kS = onePole(0.02); this.dcA = onePole(1 / (2 * Math.PI * 25));
    this.limA = onePole(0.001); this.limR = onePole(0.15); this.envR = Math.exp(-1 / (3 * sampleRate));
  }
  // a chunk line: the current head becomes the old one (it reads on backwards while fading out)
  line(b, spb, zone, xf, ping) {
    const C = ZB[zone], start = Math.floor(b / C + 1e-7) * C;
    this.jo = this.j; this.ko = 0;
    this.xo = Math.max(1, Math.min(this.xi, (this.size - 16) / 2 - this.j));
    this.po[0] = this.pc[0]; this.po[1] = this.pc[1];
    this.cStart = start; this.cEnd = start + C;
    this.j = Math.max(0, (b - start) * spb); this.fi = 0;
    this.xi = Math.max(0.002 * sampleRate, xf * 0.5 * C * spb);
    if (ping) {
      // successive chunks alternate left / right (equal power), keyed on the grid so loops repeat
      const side = Math.round(start / C) & 1 ? 1 : -1, th = (Math.PI / 4) * (1 + 0.85 * side);
      this.pc[0] = Math.cos(th) * Math.SQRT2; this.pc[1] = Math.sin(th) * Math.SQRT2;
    } else { this.pc[0] = 1; this.pc[1] = 1; }
  }
  process(inputs, outputs, P) {
    if (!this.alive) return false;
    const inp = inputs[0] || [], out = outputs[0], oL = out[0], oR = out[1] || out[0], n = oL.length;
    const xL = inp[0], xR = inp.length > 1 ? inp[1] : null, st = !!xR;
    const spb = this.spb(), db = 1 / spb, zone = Math.round(P.zone[0]), xf = P.xf[0], ping = P.ping[0] > 0.5;
    const tLev = P.level[0], tFb = P.fb[0], tDamp = 1 - Math.exp((-2 * Math.PI * Math.min(P.damp[0], 0.45 * sampleRate)) / sampleRate);
    const bL = this.bL, bR = this.bR, m = this.mask, kS = this.kS, HP = Math.PI / 2;
    let b = this.beat(0), w = this.w;
    for (let i = 0; i < n; i++, b += db) {
      if (b >= this.cEnd || b < this.cStart - 1e-6) this.line(b, spb, zone, xf, ping);
      this.level += (tLev - this.level) * kS; this.fbv += (tFb - this.fbv) * kS; this.dampA += (tDamp - this.dampA) * kS;
      const inL = xL ? xL[i] : 0, inR = st ? xR[i] : inL, a = Math.abs(inL) + Math.abs(inR);
      this.env = Math.max(a * 0.5, this.env * this.envR);
      this.quiet = a > 1e-5 ? 0 : this.quiet + 1;
      const idle = this.quiet > 2.2 * (this.cEnd - this.cStart) * spb + this.xo + this.xi + 1024;
      let yL = 0, yR = 0, fL = 0, fR = 0;
      if (!idle && (tLev > 0.005 || this.level > 0.001)) {
        // current head: reads the last chunk backwards (delay grows 2 samples per sample)
        const gi = this.fi < this.xi ? Math.sin(HP * this.fi / this.xi) : 1;
        const p1 = w - 3 - 2 * this.j;
        let eL = hermite(bL, m, p1) * gi, eR = st ? hermite(bR, m, p1) * gi : eL;
        let sL = eL * this.pc[0], sR = eR * this.pc[1];
        if (this.ko < this.xo) {
          // old head: keeps reading backwards past the line while it fades out
          const go = Math.cos(HP * this.ko / this.xo), p2 = w - 3 - 2 * this.jo;
          const oLv = hermite(bL, m, p2) * go, oRv = st ? hermite(bR, m, p2) * go : oLv;
          eL += oLv; eR += oRv; sL += oLv * this.po[0]; sR += oRv * this.po[1];
        }
        // DAMPING low-pass on the echoes (same filter state feeds the loop, so repeats get darker)
        const da = this.dampA, nL = this.lpL + (eL - this.lpL) * da, nR = this.lpR + (eR - this.lpR) * da;
        this.lpL = nL; this.lpR = nR;
        this.qL += (sL - this.qL) * da; this.qR += (sR - this.qR) * da;   // the panned output, same filter
        // feedback: DC-blocked, soft clipped, so it can never grow
        this.dcL += (nL - this.dcL) * this.dcA; this.dcR += (nR - this.dcR) * this.dcA;
        const f = this.fbv * 1.1;
        fL = f > 1e-4 ? softClip((nL - this.dcL) * f) * 0.91 : 0;
        fR = f > 1e-4 ? (st ? softClip((nR - this.dcR) * f) * 0.91 : fL) : 0;
        // output: echo level, a leveller that keeps the echoes under the recent input peak
        yL = this.qL * this.level; yR = this.qR * this.level;
        const pk = Math.max(Math.abs(yL), Math.abs(yR)), thr = Math.max(this.env, 0.02) * 1.05;
        const want = pk > thr ? thr / pk : 1;
        this.lim += (want - this.lim) * (want < this.lim ? this.limA : this.limR);
        yL = softClip(yL * this.lim * 0.9) / 0.9; yR = softClip(yR * this.lim * 0.9) / 0.9;
        if (fL !== 0 || fR !== 0) this.quiet = 0;
      } else { this.lpL = this.lpR = this.qL = this.qR = 0; }
      oL[i] = yL; if (oR !== oL) oR[i] = yR;
      bL[w & m] = inL + fL; if (st) bR[w & m] = inR + fR; else bR[w & m] = inL + fL;
      w++; this.j++; this.fi++; this.ko++;
    }
    this.w = w & 0x3fffffff;
    return true;
  }
}
registerProcessor("kdfx-reverse-echo", P);`;

  K.register({
    id: "reverse-echo", num: 5, name: "REVERSE ECHO", group: "GRANULAR & TIME",
    caption: "Hits get backwards \"suck-in\" tails.",
    axes: { x: "CHUNK", y: "FEEDBACK" },
    fmtX: (x) => ZONES[G.step(x, 6)][1],
    fmtY: (y) => Math.round(K.clamp(y) * FB_MAX * 100) + "%",
    dials: [
      { id: "xfade", name: "CROSSFADE", def: 0.3, fmt: (v) => (v < 0.04 ? "2 ms" : Math.round(v * 50) + "% fade") },
      { id: "damp", name: "DAMPING", def: 0.2, fmt: (v) => K.fmt.hz(dampHz(v)) },
    ],
    toggles: [{ id: "preverb", name: "PRE-VERB", def: false }, { id: "pingpong", name: "PING-PONG", def: false }],
    presets: [
      { name: "Inhale", voice: "snare", x: zx(3), y: fy(0.25), wet: 1, strength: 1.8, dials: { xfade: 0.25, damp: 0.15 }, toggles: { preverb: false, pingpong: false } },
      { name: "Rewind Hats", voice: "hats", x: zx(1), y: fy(0.4), wet: 1, strength: 1.4, dials: { xfade: 0.3, damp: 0.1 }, toggles: { preverb: false, pingpong: true } },
      { name: "Kick Suck", voice: "kick", x: zx(2), y: 0, wet: 1, strength: 0.85, dials: { xfade: 0.05, damp: 0.35 }, toggles: { preverb: false, pingpong: false } },
      { name: "Dream Loop", voice: "perc", x: zx(4), y: fy(0.78), wet: 1, strength: 0.9, dials: { xfade: 0.8, damp: 0.4 }, toggles: { preverb: true, pingpong: false } },
    ],
    worklets: { "kdfx-reverse-echo": SRC },
    create(ctx, env) {
      const io = {};
      const inst = G.make(ctx, env, {
        proc: "kdfx-reverse-echo",
        map: (s) => {
          const d = s.dials || {}, t = s.toggles || {}, y = s.y != null ? s.y : 0.5;
          return { level: K.clamp(s.amount || 0) * Math.sqrt(1 - 0.5 * Math.pow(K.clamp(y) * FB_MAX, 2)), fb: K.clamp(y) * FB_MAX,
            damp: dampHz(d.damp != null ? d.damp : 0.2), zone: G.step(s.x != null ? s.x : 0.5, 6), xf: d.xfade != null ? d.xfade : 0.3, ping: t.pingpong ? 1 : 0 };
        },
        // the dry goes straight to the output (zero latency); the worklet only adds the echoes
        route: (c, input, node, output) => { input.connect(output); input.connect(node); node.connect(output); io.input = input; io.node = node; },
        // PRE-VERB: a short reverb in front of the recorder only, so the reversed tails swell longer
        onSet: (s) => {
          const on = !!(s.toggles && s.toggles.preverb);
          if (on && !io.conv && io.node) {
            io.conv = ctx.createConvolver(); io.conv.buffer = K.impulse(ctx, { sec: 0.8, decay: 3, seed: 55 });
            io.pv = ctx.createGain(); io.pv.gain.value = 0;
            io.input.connect(io.conv); io.conv.connect(io.pv); io.pv.connect(io.node);
          }
          if (io.pv) { io.pv.gain.cancelScheduledValues(ctx.currentTime); io.pv.gain.setTargetAtTime(on && s.amount > 0.01 ? 1.6 : 0, ctx.currentTime, 0.02); if (on && ctx.currentTime === 0) io.pv.gain.value = s.amount > 0.01 ? 1.6 : 0; }
        },
      });
      const destroy = inst.destroy;
      inst.destroy = () => { destroy(); for (const k of ["conv", "pv"]) if (io[k]) try { io[k].disconnect(); } catch (e) { /* gone */ } };
      return inst;
    },
  });
})();

// ------------------------------------------------------------------ 06 SLICE SHUFFLE
// Re-orders the beat like a broken MPC. Each bar is cut into 1/4..1/32 slices; a touched slice plays
// another slice instead (an earlier one of this bar, or one of the bar before), maybe reversed, or it
// repeats the slice before it. The dice are keyed on the song position, not the voice, so voices with
// the same settings (SYNC) move together and a loop replays the same. Untouched slices = the live input.
(function () {
  "use strict";
  const K = window.KdFx, G = K && K.granular;
  if (!G) return;
  const GRID_TXT = ["1/4", "1/8", "1/16", "1/32"];

  const SRC = G.LIB + `
const GRIDS = [4, 8, 16, 32];
class P extends KdBase {
  static get parameterDescriptors() {
    const k = (name, def, max) => ({ name, defaultValue: def, minValue: 0, maxValue: max || 1, automationRate: "k-rate" });
    return [k("amount", 0), k("shuffle", 0.5), k("reverse", 0.5), k("grid", 2, 3), k("repeat", 0), k("lock", 0), k("reset", 0)];
  }
  constructor(o) {
    super(o);
    this.size = pow2Above(Math.ceil(8 * sampleRate) + 4096);    // 2 bars at 60 BPM
    this.mask = this.size - 1;
    this.bufL = new Float32Array(this.size);
    this.bufR = new Float32Array(this.size);
    this.w = 0;                                  // absolute write index (samples since start)
    this.F = Math.round(0.0025 * sampleRate);     // crossfade at slice edges
    this.pos = 0; this.dir = 1;                  // the reader now playing (pos = w, dir 1: the live input)
    this.oPos = 0; this.oDir = 1; this.fade = 0; // the reader fading out
    this.slice = -1; this.N = 16;
    this.kPrev = 0; this.revPrev = false;
    this.quiet = 0;
  }
  // a new slice starts (or the grid changed): pick its source. k = how many slices back it reads.
  decide(sp, P) {
    const N = this.N, L = (this.spb() * 4) / N, F = this.F;
    const abs = Math.floor(sp), bar = Math.floor(abs / N), idx = abs - bar * N, p = (sp - abs) * L;
    const amt = P.amount[0];
    let k = 0, rev = false;
    if (amt >= 0.01 && !(P.reset[0] > 0.5 && idx === 0)) {
      const r = mkRng(hash("kdss", P.lock[0] > 0.5 ? "lock" : bar, N, idx));
      const touch = r(), mv = r(), rv = r(), rp = r();
      if (touch < amt) {
        if (rp < P.repeat[0] && this.kPrev + 1 <= N) { k = this.kPrev + 1; rev = this.revPrev; }
        else {
          const M = Math.round(P.shuffle[0] * N * 0.5);
          if (M > 0) {
            const t = Math.floor(mv * 2 * M), m = t < M ? -(t + 1) : t - M + 1;   // -M..-1, 1..M
            k = (((-m) % N) + N) % N;
          }
          rev = rv < P.reverse[0];
          if (k === 0 && rev) k = N;           // reversed in place: the same slice of the bar before
        }
      }
    }
    // not recorded yet, or longer than the buffer: play it straight
    if (k > 0 && ((rev ? (k + 1) * L + F + 2 : k * L) > this.w || (k + 1) * L + F + 256 > this.size)) { k = 0; rev = false; }
    this.kPrev = k; this.revPrev = rev;
    const D = Math.round(k * L);
    const pos = rev ? this.w - D + Math.round(L) - 1 - 2 * Math.round(p) : this.w - D, dir = rev ? -1 : 1;
    if (pos !== this.pos || dir !== this.dir) {
      this.oPos = this.pos; this.oDir = this.dir; this.fade = F;
      this.pos = pos; this.dir = dir;
    }
  }
  process(inputs, outputs, P) {
    if (!this.alive) return false;
    const inp = inputs[0] || [], out = outputs[0], oL = out[0], oR = out[1] || out[0];
    const n = oL.length, stereo = inp.length > 1, iL = inp[0], iR = stereo ? inp[1] : null;
    const bL = this.bufL, bR = this.bufR, mask = this.mask, F = this.F;
    this.N = GRIDS[clamp(Math.round(P.grid[0]), 0, 3)];
    const q = this.N / 4, b0 = this.beat(0) * q, db = (this.clock.bpm / 60 / sampleRate) * q;
    const idle = this.spb() * 8;
    for (let i = 0; i < n; i++) {
      const xl = iL ? iL[i] : 0, xr = iR ? iR[i] : xl;
      const w = this.w;
      bL[w & mask] = xl; if (stereo) bR[w & mask] = xr;
      if (xl > 1e-4 || xl < -1e-4 || xr > 1e-4 || xr < -1e-4) this.quiet = 0; else this.quiet++;
      const sp = b0 + i * db, abs = Math.floor(sp);
      if (abs !== this.slice || this.N !== this.lastN) { this.slice = abs; this.lastN = this.N; this.decide(sp, P); }
      let yl, yr;
      if (this.quiet > idle && this.fade === 0) { yl = xl; yr = xr; }   // silent for 2 bars: nothing to move
      else {
        const pi = this.pos & mask;
        yl = bL[pi]; yr = stereo ? bR[pi] : yl;
        if (this.fade > 0) {
          const g = this.fade / F, po = this.oPos & mask;
          yl = yl * (1 - g) + bL[po] * g;
          yr = stereo ? yr * (1 - g) + bR[po] * g : yl;
          this.oPos += this.oDir; this.fade--;
        }
      }
      this.pos += this.dir; this.w++;
      oL[i] = yl; if (oR !== oL) oR[i] = yr;
    }
    return true;
  }
}
registerProcessor("kdfx-slice-shuffle", P);
`;

  K.register({
    id: "slice-shuffle", num: 6, name: "SLICE SHUFFLE", group: "GRANULAR & TIME",
    caption: "Re-orders the beat on the fly, like a broken MPC.",
    axes: { x: "SHUFFLE", y: "REVERSE" },
    dials: [
      { id: "grid", name: "SLICE GRID", def: 0.6, fmt: (v) => GRID_TXT[G.step(v, 4)] },
      { id: "repeat", name: "REPEAT CHANCE", def: 0.2, fmt: K.fmt.pct },
    ],
    toggles: [
      { id: "lock", name: "LOCK SEED", def: false },
      { id: "reset", name: "BAR RESET", def: true },
    ],
    fmtX: (x) => Math.round(K.clamp(x) * 100) + "% shuffle",
    fmtY: (y) => Math.round(K.clamp(y) * 100) + "% reverse",
    presets: [
      { name: "Jungle Chop", voice: "all", sync: true, x: 0.92, y: 0.3, wet: 1, dials: { grid: 0.6, repeat: 0.2 }, toggles: { lock: false, reset: true } },
      { name: "Lost Snare", voice: "snare", x: 0.95, y: 0.15, wet: 1, dials: { grid: 0.35, repeat: 0.1 }, toggles: { lock: false, reset: false } },
      { name: "Scatter Hats", voice: "hats", x: 0.72, y: 0.3, wet: 1, dials: { grid: 0.6, repeat: 0.15 }, toggles: { lock: false, reset: false } },
      { name: "Tight Edit", voice: "kick", x: 0.15, y: 0.08, wet: 1, strength: 0.3, dials: { grid: 0.6, repeat: 0.35 }, toggles: { lock: false, reset: true } },
    ],
    worklets: { "kdfx-slice-shuffle": SRC },
    create: (ctx, env) => G.make(ctx, env, {
      proc: "kdfx-slice-shuffle",
      map: (s) => ({
        amount: K.clamp(s.amount || 0),
        shuffle: K.clamp(s.x == null ? 0.5 : s.x),
        reverse: K.clamp(s.y == null ? 0.5 : s.y),
        grid: G.step((s.dials || {}).grid != null ? s.dials.grid : 0.6, 4),
        repeat: K.clamp((s.dials || {}).repeat || 0),
        lock: (s.toggles || {}).lock ? 1 : 0,
        reset: (s.toggles || {}).reset ? 1 : 0,
      }),
    }),
  });
})();
