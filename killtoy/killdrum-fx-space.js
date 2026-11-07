// KILLDRUM FX, group 2: DELAY PORTALS (07 PITCH DELAY, 08 DIFFUSE DELAY, 09 RESONATOR, 10 FLANGER)
// and REVERB PORTALS (24 SHIMMER, 25 GATED VERB, 26 CONVOLUTION, 27 INFINITE VERB) from Eman's
// DRUM_PORTAL_SPEC_V1. Interface: /mnt/project-files/killdrum/FX-MODULE.md (ui/killdrum-fx-core.js).
//
// Every effect but CONVOLUTION runs per sample in an AudioWorklet (the browser's audio thread):
// their delays are shorter than Web Audio's 128-sample minimum for a feedback loop, or they need a
// pitch shifter or a feedback delay network inside the loop. PRELUDE holds the shared building
// blocks; each effect's worklet source is PRELUDE + its own processor class.
//
// Shared rules for these eight:
// - output = the voice's own sound (fading out as `amount` grows, by how much depends on the effect)
//   + the effect. amount 0 sounds like the dry voice; amount 1 is the extreme.
// - every feedback loop has a filter and the soft limiter `soft()` in it, so nothing can run away;
//   the base processor also resets itself if a block ever comes out NaN or louder than 4.
// - a processor skips its DSP while nothing comes in and its tail has died (9 voices at once).
// - no Math.random(): noise and modulation come from fixed seeds, so a loop replays the same.
// Test: node scripts/killdrum/fx-space-test.js renders every preset offline and checks levels.
(function () {
  "use strict";
  const K = window.KdFx;
  if (!K) return;
  const clamp = K.clamp;

  // ------------------------------------------------------------------ worklet building blocks
  const PRELUDE = String.raw`
const TAU = Math.PI * 2;
const clampv = (v, a, b) => (v < a ? a : v > b ? b : v);
// soft limiter for feedback loops and outputs: about linear below 0.5, never past +-1
const soft = (x) => { if (x >= 3) return 1; if (x <= -3) return -1; const x2 = x * x; return (x * (27 + x2)) / (27 + 9 * x2); };
const dbToGain = (db) => Math.pow(10, db / 20);
// output limiter: untouched up to 0.9, then bends softly so the voice never passes ~1.25
const lim = (x) => (x > 0.9 ? 0.9 + 0.35 * soft((x - 0.9) / 0.35) : x < -0.9 ? -0.9 - 0.35 * soft((-x - 0.9) / 0.35) : x);
// one-pole coefficient for a time constant in seconds (per-sample smoothing, envelopes)
const coefT = (sec) => (sec <= 0 ? 0 : Math.exp(-1 / (sec * sampleRate)));
// one-pole low-pass coefficient for a cutoff in Hz: y += a * (x - y)
const coefHz = (hz) => 1 - Math.exp((-TAU * clampv(hz, 1, sampleRate * 0.49)) / sampleRate);

// A ring buffer. read(d) = the sample written d writes ago (d >= 1, fractional ok, linear).
// Call read() BEFORE write() in a sample loop for a d-sample delay (a comb: y = read(d); write(x + g * y)).
class Delay {
  constructor(maxSamples) { let n = 4; while (n < maxSamples + 8) n <<= 1; this.b = new Float32Array(n); this.m = n - 1; this.w = 0; }
  write(x) { this.b[this.w] = x; this.w = (this.w + 1) & this.m; }
  read(d) {
    if (d < 1) d = 1; else if (d > this.m - 4) d = this.m - 4;
    const p = this.w - d, i = Math.floor(p), f = p - i, a = this.b[i & this.m];
    return a + (this.b[(i + 1) & this.m] - a) * f;
  }
  // 4-point Hermite (cleaner for pitch shifting and slow sweeps); d >= 2
  read3(d) {
    if (d < 2) d = 2; else if (d > this.m - 4) d = this.m - 4;
    const p = this.w - d, i = Math.floor(p), f = p - i, m = this.m, b = this.b;
    const x0 = b[(i - 1) & m], x1 = b[i & m], x2 = b[(i + 1) & m], x3 = b[(i + 2) & m];
    const c1 = 0.5 * (x2 - x0), c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3, c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
    return ((c3 * f + c2) * f + c1) * f + x1;
  }
  clear() { this.b.fill(0); }
}
// Schroeder all-pass (a diffuser): smears a click into a burst without colouring it much.
class Allpass {
  constructor(maxSamples) { this.d = new Delay(maxSamples); }
  run(x, len, g) { const z = this.d.read(len), v = x + g * z; this.d.write(v); return z - g * v; }
  clear() { this.d.clear(); }
}
// One-pole low-pass with its own state; hp(x) = x - lp(x).
class OnePole {
  constructor() { this.y = 0; }
  lp(x, a) { this.y += a * (x - this.y); return this.y; }
  hp(x, a) { this.y += a * (x - this.y); return x - this.y; }
  clear() { this.y = 0; }
}
// Peak envelope follower (attack / release in seconds).
class Env {
  constructor() { this.e = 0; }
  run(x, att, rel) { const a = Math.abs(x); this.e = a > this.e ? att * this.e + (1 - att) * a : rel * this.e + (1 - rel) * a; return this.e; }
}
// Granular pitch shifter: two taps sweep through a short window, crossfaded (sin^2 + cos^2 = 1).
// ratio = playback speed (2 = +12 st, 0.5 = -12). win = window in samples (~25-60 ms for drums).
// Latency is about win / 2 + 2 samples.
class Shifter {
  constructor(maxWin) { this.d = new Delay(maxWin * 2 + 16); this.ph = 0; }
  run(x, ratio, win) {
    this.d.write(x);
    this.ph += (1 - ratio) / win;
    this.ph -= Math.floor(this.ph);
    const p2 = this.ph + 0.5 - (this.ph >= 0.5 ? 1 : 0);
    const s1 = Math.sin(Math.PI * this.ph), s2 = Math.sin(Math.PI * p2);
    return this.d.read3(2 + this.ph * win) * s1 * s1 + this.d.read3(2 + p2 * win) * s2 * s2;
  }
  clear() { this.d.clear(); this.ph = 0; }
}
// 8-line feedback delay network (a reverb tank): Hadamard mixing (lossless), a damping low-pass and a
// decay gain per line, optional slow wobble of the line lengths (kills metallic ringing).
// set(scale, t60, dampHz, modDepthSamples, modRateHz). run(inL, inR) -> this.l / this.r.
// t60 = Infinity (or freeze) -> the tank holds forever (gain exactly 1, no damping).
const FDN_LENS = [1031, 1327, 1523, 1801, 2029, 2311, 2633, 2953];
class FDN {
  constructor(maxScale, seed) {
    const k = sampleRate / 44100;
    this.base = FDN_LENS.map((n) => n * k);
    this.lines = this.base.map((n) => new Delay(Math.ceil(n * maxScale + 400 * k)));
    this.lp = this.base.map(() => new OnePole());
    this.g = new Float32Array(8); this.len = new Float32Array(8); this.v = new Float32Array(8);
    this.ph = this.base.map((_, i) => ((seed || 1) * 0.618 + i * 0.37) % 1);
    this.rate = this.base.map((_, i) => 0.6 + 0.11 * i);
    this.scale = 1; this.damp = 1; this.mod = 0; this.modHz = 0.5; this.l = 0; this.r = 0;
    this.set(1, 2, 8000, 0, 0.5);
  }
  set(scale, t60, dampHz, mod, modHz) {
    this.scale = scale; this.damp = !isFinite(t60) || dampHz >= sampleRate * 0.45 ? 1 : coefHz(dampHz); this.mod = mod || 0; this.modHz = modHz || 0.5;
    for (let i = 0; i < 8; i++) {
      this.len[i] = Math.max(1, Math.round(this.base[i] * scale));
      this.g[i] = !isFinite(t60) ? 1 : Math.pow(10, (-3 * this.len[i]) / (Math.max(0.05, t60) * sampleRate));
    }
  }
  run(inL, inR) {
    const v = this.v, inc = this.modHz / sampleRate;
    for (let i = 0; i < 8; i++) {
      let d = this.len[i];
      if (this.mod > 0) { this.ph[i] += inc * this.rate[i]; if (this.ph[i] >= 1) this.ph[i] -= 1; const q = this.ph[i], t = q < 0.5 ? q : q - 0.5, w = 16 * t * (0.5 - t); d += this.mod * (1 + (q < 0.5 ? w : -w)); } // parabolic sine: cheaper than Math.sin per sample per line
      let s = this.mod > 0 ? this.lines[i].read3(d) : this.lines[i].read(d);
      if (this.damp < 1) s = this.lp[i].lp(s, this.damp);
      v[i] = s * this.g[i];
    }
    // fast Walsh-Hadamard, scaled by 1/sqrt(8): orthogonal, so it neither adds nor loses energy
    for (let h = 1; h < 8; h <<= 1) for (let i = 0; i < 8; i += h << 1) for (let j = i; j < i + h; j++) { const a = v[j], b = v[j + h]; v[j] = a + b; v[j + h] = a - b; }
    const k = 0.35355339059327373;
    this.l = 0; this.r = 0;
    for (let i = 0; i < 8; i++) {
      const out = v[i] * k;
      if (i & 1) this.r += out * (i & 2 ? -1 : 1); else this.l += out * (i & 4 ? -1 : 1);
      this.lines[i].write(out + (i & 1 ? inR : inL) * (i & 2 ? -1 : 1));
    }
    this.l *= 0.5; this.r *= 0.5;
  }
  clear() { for (const d of this.lines) d.clear(); for (const f of this.lp) f.clear(); this.l = this.r = 0; }
}
// Deterministic noise (no Math.random in the sound).
const rngOf = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const ZERO = new Float32Array(128);

// Base processor: hit queue (from the voice's trigger()), song beat, idle skip (after ~1.5 s of silence)
// and a NaN/blow-up guard.
// Subclasses implement run(L, R, oL, oR, n, p) and may override busy() (true = keep running while
// silent, e.g. a frozen tank) and reset().
class KdBase extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.opts = (o && o.processorOptions) || {};
    this.q = []; this.alive = true; this.quiet = 0; this.beatRef = null;
    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "hit") { this.q.push(m); this.q.sort((a, b) => a.at - b.at); }
      else if (m.type === "bye") this.alive = false;
      else if (m.type === "beat") this.beatRef = m;
      else if (this.msg) this.msg(m);
    };
  }
  // hits that land in this block -> [[frame, hit], ...] (late ones land on frame 0)
  hits(n) {
    const out = [], t1 = currentTime + n / sampleRate;
    while (this.q.length && this.q[0].at < t1) { const h = this.q.shift(); out.push([Math.max(0, Math.min(n - 1, Math.round((h.at - currentTime) * sampleRate))), h]); }
    return out;
  }
  // song position in beats at frame i (free-running from 0 when the song isn't playing)
  beatAt(i, bpm) {
    const b = this.beatRef, t = currentTime + i / sampleRate;
    if (b && b.beat != null) return b.beat + ((t - b.t) * (b.bpm || bpm)) / 60;
    return (t * bpm) / 60;
  }
  busy() { return false; }
  process(ins, outs, p) {
    if (!this.alive) return false;
    const x = ins[0], y = outs[0], n = y[0].length, oR = y[1] || y[0];
    const L = x && x[0] ? x[0] : ZERO, R = x && x[1] ? x[1] : L;
    let pk = 0;
    for (let i = 0; i < n; i++) { const a = Math.abs(L[i]) + Math.abs(R[i]); if (a > pk) pk = a; }
    // idle only after ~1.5 s of silence in and out: an echo or a predelayed burst can still be on its way
    if (pk < 1e-7 && this.quiet > (this.idleAfter || (this.idleAfter = Math.ceil((1.5 * sampleRate) / n))) && !this.q.length && !this.busy()) { y[0].fill(0); oR.fill(0); return true; }
    this.run(L, R, y[0], oR, n, p);
    let o = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(y[0][i]) + Math.abs(oR[i]);
      if (!(a < 8)) { if (this.reset) this.reset(); y[0].fill(0); oR.fill(0); o = 0; break; }
      if (a > o) o = a;
    }
    this.quiet = pk < 1e-7 && o < 2e-6 ? this.quiet + 1 : 0;
    return true;
  }
}
`;

  // ------------------------------------------------------------------ main-thread helpers
  // A stereo AudioWorkletNode for one voice (a mono voice is spread to both sides), or null while
  // the worklet isn't loaded in this context yet.
  const workletNode = (ctx, name, opts) => {
    if (!K.hasWorklet(ctx, name)) return null;
    try {
      return new AudioWorkletNode(ctx, name, {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
        channelCount: 2, channelCountMode: "explicit", channelInterpretation: "speakers",
        processorOptions: opts || {},
      });
    } catch (e) { console.error("KILLDRUM FX " + name, e); return null; }
  };
  // Param setter: the first set() lands at once (a hit can follow straight away), later ones glide.
  const paramSetter = (ctx, node) => {
    let first = true;
    const P = (name, v, tc) => {
      const p = node && node.parameters.get(name);
      if (!p || !isFinite(v)) return;
      if (first) { p.cancelScheduledValues(0); p.setValueAtTime(v, ctx.currentTime); } else K.ramp(p, v, ctx, tc);
    };
    P.done = () => (first = false);
    return P;
  };
  // k-rate AudioParam descriptors for a processor: kp({ mix: 0.5, fb: [0, -1, 1] }) -> source text
  const kp = (o) => "static get parameterDescriptors() { return " + JSON.stringify(Object.entries(o).map(([name, v]) => {
    const [def, min, max] = Array.isArray(v) ? v : [v];
    const d = { name, defaultValue: def, automationRate: "k-rate" };
    if (min != null) d.minValue = min;
    if (max != null) d.maxValue = max;
    return d;
  })) + "; }";
  // The usual instance: input -> worklet -> output (pass-through until the worklet is loaded).
  // onSet(s, P, node) maps the dot to the processor's params with P(name, value).
  // Hits go to the processor as { type: "hit", at, gain }; the song beat as { type: "beat", t, beat, bpm }.
  const workletInstance = (ctx, env, name, onSet, opts) => {
    const input = ctx.createGain(), output = ctx.createGain();
    const node = workletNode(ctx, name, Object.assign({ seed: env.seed || 1, voice: env.voice, kind: env.kind }, opts));
    if (node) { input.connect(node); node.connect(output); } else input.connect(output);
    const P = paramSetter(ctx, node);
    const beat = (bpm) => {
      if (!node) return;
      const b = env.beatAt ? env.beatAt(ctx.currentTime) : null;
      node.port.postMessage({ type: "beat", t: ctx.currentTime, beat: b == null ? null : b, bpm: bpm || env.bpm || 120 });
    };
    beat(env.bpm);
    return {
      input, output, node,
      set(s) { if (!node) return; onSet(s, P, node); P.done(); beat(s.bpm); },
      trigger(hit) { if (node && hit && isFinite(hit.at)) node.port.postMessage({ type: "hit", at: hit.at, gain: hit.gain == null ? 1 : hit.gain }); },
      destroy() {
        try { input.disconnect(); } catch (e) { /* gone */ }
        if (node) { try { node.port.postMessage({ type: "bye" }); node.disconnect(); } catch (e) { /* gone */ } }
        try { output.disconnect(); } catch (e) { /* gone */ }
      },
    };
  };
  // the dot's dial / toggle values with defaults (the host may leave some out)
  const dv = (s, id, def) => (s && s.dials && s.dials[id] != null && isFinite(s.dials[id]) ? clamp(+s.dials[id]) : def);
  const tv = (s, id, def) => (s && s.toggles && s.toggles[id] != null ? s.toggles[id] : def);
  // dial/axis value 0..1 -> exponential range lo..hi
  const expo = (v, lo, hi) => lo * Math.pow(hi / lo, clamp(v));
  const lerp = (v, lo, hi) => lo + (hi - lo) * clamp(v);
  // synced time dial: v 0..1 -> [beats, label] from short to long (from/to = indexes in K.NOTES, long..short)
  const noteOf = (v, longest = 1, shortest = 8) => K.pickNote(1 - clamp(v), longest, shortest);
  const fmtHz = K.fmt.hz;
  const fmtMs = (s) => (s >= 1 ? s.toFixed(s >= 10 ? 0 : 1) + " s" : Math.round(s * 1000) + " ms");

  // ------------------------------------------------------------------ 07 PITCH DELAY
  // An echo whose pitch shifter sits inside the feedback loop: every repeat goes through the shifter
  // again, so with +5 the echoes climb +5, +10, +15... (a spiral) and with -12 each one drops an octave.
  // X = the interval per echo (-12..+12 st). Near the centre line the two sides detune a hair (L up,
  // R down, +-0.3 st, gone by 1 st), so the middle gives chorus-like ghost echoes. Y = feedback.
  // TIME = the echo spacing, synced to the song (1/32..1/2). LOOP FILTER = a band in the loop: middle
  // is gentle (80 Hz..9 kHz), left darker (down to 900 Hz), right thinner (up to 1.5 kHz).
  // ALGO: GRANULAR = 2 grains of 40 ms (gritty, tight); SPECTRAL = 4 overlapped grains of 90 ms
  // (smoother, glassier). FREEZE stops new sound coming in and holds the loop (0.995 feedback), so
  // what's inside keeps climbing or falling for ever without getting louder.
  // amount = how loud the echoes are, how much the dry dips, and how far the feedback can go.
  const pdInterval = (x) => (clamp(x) * 2 - 1) * 12;
  K.register({
    id: "pitch-delay", num: 7, name: "PITCH DELAY", group: "DELAY PORTALS",
    caption: "Each echo climbs or falls in pitch into infinity.",
    axes: { x: "INTERVAL", y: "FEEDBACK" },
    dials: [
      { id: "time", name: "TIME", def: 0.56, fmt: (v) => noteOf(v, 1, 8)[1] },
      { id: "filter", name: "LOOP FILTER", def: 0.5, fmt: (v) => (v < 0.5 ? "LP " + fmtHz(expo(v * 2, 900, 9000)) : v > 0.5 ? "HP " + fmtHz(expo(v * 2 - 1, 80, 1500)) : "80 Hz-9 kHz") },
    ],
    toggles: [
      { id: "algo", name: "ALGO", options: ["GRANULAR", "SPECTRAL"], def: 0 },
      { id: "freeze", name: "FREEZE", def: false },
    ],
    presets: [
      { name: "Stairway", voice: "snare", x: 0.5 + 5 / 24, y: 0.8, wet: 0.65, dials: { time: 0.56, filter: 0.5 }, toggles: { algo: 0, freeze: false } },
      { name: "Descent", voice: "kick", x: 0, y: 0.7, wet: 0.6, dials: { time: 0.81, filter: 0.35 }, toggles: { algo: 0, freeze: false } },
      { name: "Arp Hats", voice: "hats", x: 0.5 + 7 / 24, y: 0.75, wet: 0.6, dials: { time: 0.31, filter: 0.6 }, toggles: { algo: 0, freeze: false } },
      { name: "Detune Ghost", voice: "perc", x: 0.5, y: 0.85, wet: 0.55, dials: { time: 0.06, filter: 0.5 }, toggles: { algo: 0, freeze: false } },
    ],
    fmtX: (x) => { const st = pdInterval(x); return Math.abs(st) < 1 ? "\u00b1" + (0.3 * (1 - Math.abs(st)) + Math.abs(st)).toFixed(1) + " st" : K.fmt.st(st); },
    fmtY: (y, s) => Math.round(clamp(y) * 92 * Math.min(1, 0.35 + clamp((s && s.amount) || 0))) + "%",
    worklets: {
      "kdfx-pitch-delay": PRELUDE + `
// Pitch shifter with 2 grains (GRANULAR, sin^2 windows) or 4 grains a quarter apart (SPECTRAL, smoother);
// both read the same buffer so ALGO can switch without a gap. Latency about win / 2 + 2 samples.
class PdShift {
  constructor(maxWin) { this.d = new Delay(maxWin * 2 + 16); this.ph = 0; }
  run(x, ratio, win, four) {
    this.d.write(x);
    this.ph += (1 - ratio) / win;
    this.ph -= Math.floor(this.ph);
    const ph = this.ph, c = Math.cos(TAU * ph), w0 = 0.5 - 0.5 * c, d = this.d;
    if (!four) { const p2 = ph < 0.5 ? ph + 0.5 : ph - 0.5; return d.read3(2 + ph * win) * w0 + d.read3(2 + p2 * win) * (1 - w0); }
    const s = Math.sin(TAU * ph), p1 = ph < 0.75 ? ph + 0.25 : ph - 0.75, p2 = ph < 0.5 ? ph + 0.5 : ph - 0.5, p3 = ph < 0.25 ? ph + 0.75 : ph - 0.25;
    return 0.5 * (d.read3(2 + ph * win) * w0 + d.read3(2 + p1 * win) * (0.5 + 0.5 * s) + d.read3(2 + p2 * win) * (1 - w0) + d.read3(2 + p3 * win) * (0.5 - 0.5 * s));
  }
  clear() { this.d.clear(); this.ph = 0; }
}
class PitchDelay extends KdBase {
  ${kp({ time: 0.25, rL: 1, rR: 1, fb: 0, wet: 0, dry: 1, hp: 80, lp: 9000, algo: 0, frz: 0 })}
  constructor(o) {
    super(o);
    this.wG = Math.round(sampleRate * 0.04); this.wS = Math.round(sampleRate * 0.09);
    this.dl = [new Delay(Math.ceil(sampleRate * 2.3)), new Delay(Math.ceil(sampleRate * 2.3))];
    this.sh = [new PdShift(this.wS), new PdShift(this.wS)];
    this.hpf = [new OnePole(), new OnePole()]; this.lpf = [new OnePole(), new OnePole()];
    this.init = false; this.t = 0.25; this.rl = 1; this.rr = 1; this.fb = 0; this.wet = 0; this.dry = 1; this.inG = 1; this.win = this.wG;
    this.hz1 = 80; this.hz2 = 9000; this.hold = 0; this.frozen = false;
    // FREEZE level hold: the grains lose a little level each pass, so while frozen the loop gain is
    // nudged (0.8..1.41) to keep the echo level where it was when FREEZE went on, never above it
    this.eMean = 0; this.target = 0; this.agc = 1;
  }
  busy() { return this.frozen || this.hold > 0; }
  reset() { for (const d of this.dl) d.clear(); for (const s of this.sh) s.clear(); for (const f of this.hpf) f.clear(); for (const f of this.lpf) f.clear(); this.hold = 0; this.eMean = 0; this.agc = 1; }
  run(L, R, oL, oR, n, p) {
    const tT = clampv(p.time[0], 0.01, 2.2), tL = p.rL[0], tR = p.rR[0], tFb = p.fb[0], tWet = p.wet[0], tDry = p.dry[0];
    const four = p.algo[0] > 0.5, frz = p.frz[0] > 0.5, tWin = four ? this.wS : this.wG;
    if (frz && !this.frozen) this.target = this.eMean;
    this.frozen = frz;
    if (!this.init) { this.init = true; this.t = tT; this.rl = tL; this.rr = tR; this.fb = tFb; this.wet = tWet; this.dry = tDry; this.inG = frz ? 0 : 1; this.win = tWin; this.hz1 = p.hp[0]; this.hz2 = p.lp[0]; }
    this.hz1 += 0.3 * (p.hp[0] - this.hz1); this.hz2 += 0.3 * (p.lp[0] - this.hz2);
    const aH = coefHz(this.hz1), aL = coefHz(this.hz2), a = 1 - coefT(0.03), aT = 1 - coefT(0.08), tIn = frz ? 0 : 1;
    const d0 = this.dl[0], d1 = this.dl[1], s0 = this.sh[0], s1 = this.sh[1], h0 = this.hpf[0], h1 = this.hpf[1], l0 = this.lpf[0], l1 = this.lpf[1];
    let loud = 0, eSum = 0;
    const g = frz ? this.agc : 1;
    for (let i = 0; i < n; i++) {
      this.t += aT * (tT - this.t); this.rl += a * (tL - this.rl); this.rr += a * (tR - this.rr);
      this.fb += a * (tFb - this.fb); this.wet += a * (tWet - this.wet); this.dry += a * (tDry - this.dry);
      this.inG += a * (tIn - this.inG); this.win += a * (tWin - this.win);
      const win = this.win, dT = Math.max(1, this.t * sampleRate - win * 0.5 - 2), fb = this.fb * g, ig = this.inG;
      const xl = L[i], xr = R[i];
      // left: tap the loop, shift it, filter it -> the echo; write input + feedback * echo back in
      let e = s0.run(d0.read(dT), this.rl, win, four);
      e = l0.lp(h0.hp(e, aH), aL); eSum += e * e;
      let w = soft(xl * ig + fb * e); d0.write(w);
      if (w < 0) w = -w; if (w > loud) loud = w;
      oL[i] = lim(xl * this.dry + e * this.wet);
      e = s1.run(d1.read(dT), this.rr, win, four);
      e = l1.lp(h1.hp(e, aH), aL); eSum += e * e;
      w = soft(xr * ig + fb * e); d1.write(w);
      if (w < 0) w = -w; if (w > loud) loud = w;
      oR[i] = lim(xr * this.dry + e * this.wet);
    }
    // echo level, averaged over ~2 echoes (the FREEZE level hold steers the loop gain toward its target)
    this.eMean += (eSum / n - this.eMean) * Math.min(1, n / (Math.max(0.05, this.t) * 2 * sampleRate));
    if (frz && this.target > 1e-12) this.agc += 0.05 * (clampv(Math.sqrt(this.target / Math.max(1e-12, this.eMean)), 0.8, 1.41) - this.agc); else this.agc = 1;
    // keep running while the loop still holds sound (a long TIME has silent gaps between echoes)
    if (loud > 1e-6) this.hold = Math.ceil(this.t * sampleRate + this.win + 512); else this.hold -= n;
  }
}
registerProcessor("kdfx-pitch-delay", PitchDelay);
`,
    },
    create(ctx, env) {
      return workletInstance(ctx, env, "kdfx-pitch-delay", (s, P) => {
        const a = clamp(s.amount || 0), st = pdInterval(s.x), det = 0.3 * Math.max(0, 1 - Math.abs(st));
        const frz = !!tv(s, "freeze", false), f = dv(s, "filter", 0.5);
        P("time", K.beats(s.bpm || env.bpm || 120, noteOf(dv(s, "time", 0.56), 1, 8)[0]), 0.05);
        P("rL", Math.pow(2, (st + det) / 12));
        P("rR", Math.pow(2, (st - det) / 12));
        P("fb", frz ? 0.995 : clamp(s.y) * 0.92 * Math.min(1, 0.35 + a));
        P("wet", Math.min(0.85, a * 1.2));
        P("dry", 1 - 0.4 * a);
        P("hp", f > 0.5 ? expo(f * 2 - 1, 80, 1500) : 80);
        P("lp", f < 0.5 ? expo(f * 2, 900, 9000) : 9000);
        P("algo", tv(s, "algo", 0) ? 1 : 0);
        P("frz", frz ? 1 : 0);
      });
    },
  });

  // ------------------------------------------------------------------ 08 DIFFUSE DELAY
  // An echo whose repeats get blurrier every time round: the feedback path runs through four all-pass
  // diffusers, so a click comes back as a click, then a smear, then a wash (echoes turn into reverb).
  // X = diffusion (how hard the all-passes smear; past ~80% the input is smeared on the way in too,
  // so even the first echo is soft), Y = feedback (how many repeats). WIDTH: 0 = mono echoes,
  // 1 = left/right times ~9% apart and the diffusers different per side. DAMPING = a low-pass in the
  // loop (16 kHz .. 1.2 kHz), each repeat darker; a gentle 60 Hz high-pass stops the lows piling up.
  // PING-PONG bounces the echoes L -> R -> L. DUCK pushes the echoes down ~18 dB while the voice
  // plays, so they bloom in the gaps. TIME = the echo time as a note value from the song tempo (the
  // spec has no time dial, but the presets need different times, so it rides in the toggles).
  // amount = how loud the echoes are and how long the feedback can run.
  const DD_TIMES = [[0.25, "1/16"], [0.5, "1/8"], [0.75, "1/8."], [1, "1/4"], [2, "1/2"]];
  const ddTime = (s) => DD_TIMES[Math.round(clamp(+tv(s, "time", 2) || 0, 0, DD_TIMES.length - 1))];
  const ddDamp = (v) => expo(v, 16000, 1200);
  K.register({
    id: "diffuse-delay", num: 8, name: "DIFFUSE DELAY", group: "DELAY PORTALS",
    caption: "Echoes that bloom from clicks into wash.",
    axes: { x: "DIFFUSION", y: "FEEDBACK" },
    dials: [
      { id: "width", name: "WIDTH", def: 0.5 },
      { id: "damping", name: "DAMPING", def: 0.4, fmt: (v) => fmtHz(ddDamp(v)) },
    ],
    toggles: [
      { id: "pingpong", name: "PING-PONG", def: false },
      { id: "duck", name: "DUCK", def: false },
      { id: "time", name: "TIME", options: DD_TIMES.map((t) => t[1]), def: 2 },
    ],
    presets: [
      { name: "Cave Snare", voice: "snare", x: 0.7, y: 0.85, wet: 0.7, dials: { width: 0.6, damping: 0.45 }, toggles: { pingpong: false, duck: false, time: 3 } },
      { name: "Hat Rain", voice: "hats", x: 0.62, y: 0.82, wet: 0.65, dials: { width: 1, damping: 0.3 }, toggles: { pingpong: true, duck: false, time: 0 } },
      { name: "Dub Kick", voice: "kick", x: 0.35, y: 0.8, wet: 0.6, dials: { width: 0.4, damping: 0.75 }, toggles: { pingpong: false, duck: true, time: 2 } },
      { name: "Soft Focus", voice: "perc", x: 1, y: 0.3, wet: 0.65, dials: { width: 0.7, damping: 0.35 }, toggles: { pingpong: false, duck: false, time: 0 } },
    ],
    fmtX: (x) => Math.round(clamp(x) * 100) + "%",
    fmtY: (y, s) => Math.round(clamp(y) * 93 * Math.min(1, 0.35 + clamp((s && s.amount) || 0))) + "%",
    worklets: {
      "kdfx-diffuse-delay": PRELUDE + `
const DD_AP = [3.1, 4.7, 7.3, 11.3], DD_PRE = [2.3, 4.1, 6.7, 9.9];
// all-pass with a whole-sample length (cheaper than Allpass; lengths only move with WIDTH, per block)
class DdAp {
  constructor(max) { let n = 4; while (n < max + 2) n <<= 1; this.b = new Float32Array(n); this.m = n - 1; this.w = 0; this.len = 1; }
  run(x, g) { const z = this.b[(this.w - this.len) & this.m], v = x + g * z; this.b[this.w] = v; this.w = (this.w + 1) & this.m; return z - g * v; }
  clear() { this.b.fill(0); }
}
class DiffuseDelay extends KdBase {
  ${kp({ beats: 0.75, diff: 0.36, pre: 0, fb: 0.3, width: 0.5, damp: 5000, pp: 0, duck: 0, wet: 0, dry: 1 })}
  constructor(o) {
    super(o);
    const ms = sampleRate / 1000;
    this.dl = [new Delay(Math.ceil(sampleRate * 2.7)), new Delay(Math.ceil(sampleRate * 2.7))];
    this.ap = []; for (let i = 0; i < 8; i++) this.ap.push(new DdAp(Math.ceil(13 * ms)));
    this.pd = []; for (let i = 0; i < 8; i++) this.pd.push(new DdAp(Math.ceil(11 * ms)));
    this.id = [new Delay(Math.ceil(32 * ms)), new Delay(Math.ceil(32 * ms))];
    this.apLen = new Float32Array(DD_AP.map((m) => m * ms)); this.pdLen = new Float32Array(DD_PRE.map((m) => m * ms));
    this.lp = [new OnePole(), new OnePole()]; this.hp = [new OnePole(), new OnePole()]; this.env = new Env();
    this.hpA = coefHz(60); this.eAtt = coefT(0.002); this.eRel = coefT(0.15);
    this.init = false; this.preOn = false; this.left = 0;
  }
  // keep running while the loop still holds echoes (a short hat can go quiet long before its echo is due)
  busy() { return this.left > 0; }
  reset() { for (const d of this.id) d.clear(); for (const d of this.dl) d.clear(); for (const d of this.ap) d.clear(); for (const d of this.pd) d.clear(); for (const f of this.lp) f.clear(); for (const f of this.hp) f.clear(); }
  run(L, R, oL, oR, n, p) {
    const bpm = (this.beatRef && this.beatRef.bpm) || 120;
    const tT = clampv((p.beats[0] * 60) / bpm, 0.02, 2.4) * sampleRate, tG = p.diff[0], tPre = p.pre[0], tFb = p.fb[0];
    const tW = p.width[0], tDa = coefHz(p.damp[0]), tWet = p.wet[0], tDry = p.dry[0];
    if (!this.init) { this.init = true; this.t = tT; this.g = tG; this.pg = tPre; this.fb = tFb; this.w = tW; this.da = tDa; this.wet = tWet; this.dry = tDry; }
    const a = 1 - coefT(0.02), at = 1 - coefT(0.08), pp = p.pp[0] > 0.5, duck = p.duck[0] > 0.5;
    const usePre = tPre > 1e-3 || this.pg > 1e-3;
    if (usePre && !this.preOn) for (const d of this.pd) d.clear();
    this.preOn = usePre;
    const dl0 = this.dl[0], dl1 = this.dl[1], ap = this.ap, pd = this.pd, apLen = this.apLen, pdLen = this.pdLen;
    const lp0 = this.lp[0], lp1 = this.lp[1], hp0 = this.hp[0], hp1 = this.hp[1], hpA = this.hpA, env = this.env;
    // diffuser lengths for this block: WIDTH pulls the two sides apart (7%), 0 = identical (mono)
    const sp = 0.07 * this.w, kl = 1 - sp, kr = 1 + sp;
    for (let k = 0; k < 4; k++) { ap[k].len = Math.max(1, Math.round(apLen[k] * kl)); ap[k + 4].len = Math.max(1, Math.round(apLen[k] * kr)); }
    for (let k = 0; k < 4; k++) { pd[k].len = Math.max(1, Math.round(pdLen[k] * kl)); pd[k + 4].len = Math.max(1, Math.round(pdLen[k] * kr)); }
    const ap0 = ap[0], ap1 = ap[1], ap2 = ap[2], ap3 = ap[3], ap4 = ap[4], ap5 = ap[5], ap6 = ap[6], ap7 = ap[7];
    // keep the echoes on the beat: the diffusers delay each repeat by the sum of their lengths (their
    // energy centre), so the loop reads that much earlier and the input waits that long going in
    const dL = ap0.len + ap1.len + ap2.len + ap3.len, dR = ap4.len + ap5.len + ap6.len + ap7.len;
    const offL = pp ? dR : dL, offR = pp ? dL : dR, id0 = this.id[0], id1 = this.id[1];
    const inL = Math.max(1, offL - (usePre ? pd[0].len + pd[1].len + pd[2].len + pd[3].len : 0)), inR = Math.max(1, dR - (usePre ? pd[4].len + pd[5].len + pd[6].len + pd[7].len : 0));
    let live = false;
    for (let i = 0; i < n; i++) {
      this.t += at * (tT - this.t); this.g += a * (tG - this.g); this.pg += a * (tPre - this.pg); this.fb += a * (tFb - this.fb);
      this.w += a * (tW - this.w); this.da += a * (tDa - this.da); this.wet += a * (tWet - this.wet); this.dry += a * (tDry - this.dry);
      const w = this.w, xl = L[i], xr = R[i], mid = 0.5 * (xl + xr), side = 0.5 * (xl - xr) * w;
      let il = mid + side, ir = mid - side;
      // pre-diffusion: the first echo already arrives as a soft burst ("instant diffusion")
      if (usePre) {
        const pg = this.pg * 0.72;
        il = pd[3].run(pd[2].run(pd[1].run(pd[0].run(il, pg), pg), pg), pg);
        ir = pd[7].run(pd[6].run(pd[5].run(pd[4].run(ir, pg), pg), pg), pg);
      }
      const jl = id0.read(inL), jr = id1.read(inR);
      id0.write(il); id1.write(ir);
      // the echoes (L/R times apart by WIDTH)
      const el = dl0.read(Math.max(1, this.t * (1 - 0.09 * w) - offL)), er = dl1.read(Math.max(1, this.t * (1 + 0.09 * w) - offR));
      // feedback path: 4 diffusers -> damping low-pass -> 60 Hz high-pass -> soft limit
      const g = this.g;
      const fl = hp0.hp(lp0.lp(ap3.run(ap2.run(ap1.run(ap0.run(el, g), g), g), g), this.da), hpA);
      const fr = hp1.hp(lp1.lp(ap7.run(ap6.run(ap5.run(ap4.run(er, g), g), g), g), this.da), hpA);
      const fb = this.fb;
      const wl = pp ? soft(0.5 * (jl + jr) + fb * fr) : soft(jl + fb * fl), wr = pp ? soft(fb * fl) : soft(jr + fb * fr);
      dl0.write(wl); dl1.write(wr);
      if (Math.abs(wl) + Math.abs(wr) + Math.abs(jl) > 1e-7) live = true;
      // DUCK: the voice's own level pushes the echoes down (up to ~18 dB), 150 ms release
      let wg = this.wet;
      if (duck) wg *= 1 - 0.874 * Math.min(1, env.run(mid, this.eAtt, this.eRel) * 5);
      oL[i] = lim(xl * this.dry + el * wg); oR[i] = lim(xr * this.dry + er * wg);
    }
    this.left = live ? this.t * 1.2 + 4096 : this.left - n;
  }
}
registerProcessor("kdfx-diffuse-delay", DiffuseDelay);
`,
    },
    create(ctx, env) {
      return workletInstance(ctx, env, "kdfx-diffuse-delay", (s, P) => {
        const a = clamp(s.amount || 0), x = clamp(s.x), y = clamp(s.y);
        P("beats", ddTime(s)[0]);
        P("diff", x * 0.72);
        P("pre", clamp((x - 0.8) / 0.2));
        P("fb", y * 0.93 * Math.min(1, 0.35 + a));
        P("width", dv(s, "width", 0.5));
        P("damp", ddDamp(dv(s, "damping", 0.4)));
        P("pp", tv(s, "pingpong", false) ? 1 : 0);
        P("duck", tv(s, "duck", false) ? 1 : 0);
        P("wet", Math.min(1, a * 1.3) * 0.85);
        P("dry", 1 - 0.35 * a);
      });
    },
  });

  // ------------------------------------------------------------------ 09 RESONATOR
  // Turns hats and snares into pitched metal: the hit rings a bank of very short feedback delays
  // (combs, 1-25 ms), each one singing at 1/delay Hz. X = the note (E1..E7, in semitones; KEY TRACK
  // snaps it into the song's scale, and down in the kick's octave it locks to the key's root).
  // Y = how long it rings (0.05 s .. 4 s). CHORD stacks up to 4 combs: a quiet octave, a 5th, a minor
  // or major triad, or METAL (bell/bar partials, not in tune with each other: gamelan). DAMPING = how
  // fast the highs die inside the loop. KARPLUS MODE = a plucked string (Karplus-Strong): the loop
  // averages two samples and filters harder (bright pluck, dark sustain) and only the first ~15 ms
  // of each hit plucks it. L and R are detuned 3 cents for width.
  // amount = how much of the ringing replaces the dry hit (1 = nearly all metal), and a little longer.
  const RES_CHORDS = ["UNISON", "5TH", "MINOR", "MAJOR", "METAL"];
  const RES_SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  const RES_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const resKey = (env) => {
    const k = (env && env.key) || (K.songKey && K.songKey()) || null;
    return k && k.tonic != null && k.tonic >= 0 ? { tonic: ((Math.round(k.tonic) % 12) + 12) % 12, minor: !!k.minor } : { tonic: 0, minor: true };
  };
  // x -> MIDI note 28..100; KEY TRACK: nearest note of the scale, kick zone (< 41) = the key's root in 28..40
  const resNote = (x, track, key) => {
    let m = Math.round(28 + clamp(x) * 72);
    if (!track) return m;
    if (m < 41) { let r = 28 + ((key.tonic - 28 + 120) % 12); if (r + 12 <= 40 && m - r > 6) r += 12; return r; }
    const sc = RES_SCALES[key.minor ? "minor" : "major"];
    for (let d = 0; d <= 2; d++) for (const s of [-1, 1]) { const n = m + s * d; if (sc.includes((((n - key.tonic) % 12) + 12) % 12)) return Math.min(100, n); }
    return m;
  };
  const resName = (m) => RES_NAMES[m % 12] + (Math.floor(m / 12) - 1);
  const resT60 = (y, a) => expo(y, 0.05, 4) * (0.7 + 0.3 * clamp(a));
  K.register({
    id: "resonator", num: 9, name: "RESONATOR", group: "DELAY PORTALS",
    caption: "Turns hats and snares into pitched metal.",
    axes: { x: "TUNING", y: "DECAY" },
    dials: [
      { id: "damp", name: "DAMPING", def: 0.3, fmt: (v) => fmtHz(expo(v, 16000, 800)) },
      { id: "chord", name: "CHORD", def: 0, fmt: (v) => RES_CHORDS[Math.min(4, Math.floor(clamp(v) * 5))] },
    ],
    toggles: [
      { id: "track", name: "KEY TRACK", def: false },
      { id: "ks", name: "KARPLUS MODE", def: false },
    ],
    presets: [
      { name: "Steel Snare", voice: "snare", x: 0.32, y: 0.85, wet: 0.7, dials: { damp: 0.3, chord: 0.5 }, toggles: { track: true, ks: false } },
      { name: "Bell Hats", voice: "hats", x: 0.9, y: 0.65, wet: 0.6, dials: { damp: 0.1, chord: 0.3 }, toggles: { track: false, ks: false } },
      { name: "Tuned Kick", voice: "kick", x: 0.12, y: 0.55, wet: 0.6, dials: { damp: 0.5, chord: 0 }, toggles: { track: true, ks: true } },
      { name: "Gamelan", voice: "perc", x: 0.6, y: 0.8, wet: 0.7, dials: { damp: 0.25, chord: 0.9 }, toggles: { track: false, ks: false } },
    ],
    fmtX: (x, s) => resName(resNote(x, !!tv(s, "track", false), resKey(null))),
    fmtY: (y, s) => fmtMs(resT60(y, s && s.amount != null ? s.amount : 0.5)),
    worklets: {
      "kdfx-resonator": PRELUDE + `
const RES_R = [[1, 2], [1, 1.5, 2], [1, Math.pow(2, 3 / 12), Math.pow(2, 7 / 12)], [1, Math.pow(2, 4 / 12), Math.pow(2, 7 / 12)], [1, 2.756, 5.404, 8.933]];
const RES_W = [[1, 0.3], [1, 0.75, 0.35], [1, 0.8, 0.8], [1, 0.8, 0.8], [1, 0.8, 0.6, 0.45]];
class Resonator extends KdBase {
  ${kp({ note: 60, t60: 1, damp: 0.3, chord: 0, ks: 0, wet: 0, dry: 1 })}
  constructor(o) {
    super(o);
    const max = Math.ceil(sampleRate / 38) + 8;
    this.dl = []; this.lpf = []; this.prev = new Float32Array(8); this.D = new Float32Array(8); this.g = new Float32Array(8);
    this.a = new Float32Array(8); this.ig = new Float32Array(8); this.on = new Uint8Array(8);
    for (let i = 0; i < 8; i++) { this.dl.push(new Delay(max)); this.lpf.push(new OnePole()); }
    this.hpIn = [new OnePole(), new OnePole()]; this.hpOut = [new OnePole(), new OnePole()];
    this.init = false; this.note = 60; this.wet = 0; this.dry = 1; this.ex = 1; this.hold = 0; this.gated = false;
  }
  reset() { for (const d of this.dl) d.clear(); for (const f of this.lpf) f.clear(); this.prev.fill(0); }
  coefs(t60, damp, chord, ks) {
    const R = RES_R[chord], W = RES_W[chord], det = Math.pow(2, 3 / 1200);
    const lpHz = ks ? 16000 * Math.pow(0.05, damp) : 16000 * Math.pow(0.16, damp);
    let wn = 0; for (let c = 0; c < R.length; c++) wn += W[c] * W[c];
    // high notes lose more of the hit to the loop's filters: lift them (x1 below 700 Hz .. x2.6)
    const lift = clampv(440 * Math.pow(2, (this.note - 69) / 12) / 700, 1, 2.6);
    wn = 1 / Math.sqrt(wn);
    for (let ch = 0; ch < 2; ch++) for (let c = 0; c < 4; c++) {
      const k = ch * 4 + c;
      if (c >= R.length) { this.on[k] = 0; continue; }
      const f = 440 * Math.pow(2, (this.note - 69) / 12) * R[c] * (ch ? det : 1 / det);
      if (f > sampleRate * 0.42) { this.on[k] = 0; continue; }
      this.on[k] = 1;
      const w = TAU * f / sampleRate, a = coefHz(Math.max(lpHz, f * 1.3)), b = 1 - a;
      // the loop filters delay and quieten the note a little: shorten the line and lift the gain to match
      const lpDel = Math.atan2(b * Math.sin(w), 1 - b * Math.cos(w)) / w, lpMag = a / Math.sqrt(1 - 2 * b * Math.cos(w) + b * b);
      const mag = lpMag * (ks ? Math.cos(w / 2) : 1), P = sampleRate / f;
      this.D[k] = Math.max(2, P - lpDel - (ks ? 0.5 : 0));
      this.g[k] = Math.min(0.9995, Math.pow(10, (-3 * P) / (t60 * sampleRate)) / Math.max(0.05, mag));
      this.a[k] = a;
      // input gain: a comb adds the hit back once per period, so higher notes pile up more
      this.ig[k] = Math.min(1, Math.pow(P / (0.05 * sampleRate), 0.3)) * W[c] * wn * 0.85 * lift;
    }
  }
  run(L, R, oL, oR, n, p) {
    const tNote = p.note[0], tWet = p.wet[0], tDry = p.dry[0], ks = p.ks[0] > 0.5;
    const chord = Math.max(0, Math.min(4, Math.round(p.chord[0])));
    if (!this.init) { this.init = true; this.note = tNote; this.wet = tWet; this.dry = tDry; }
    this.note += 0.35 * (tNote - this.note);
    this.coefs(Math.max(0.03, p.t60[0]), clampv(p.damp[0], 0, 1), chord, ks);
    const sm = 1 - coefT(0.02), hpA = coefHz(25), exRel = coefT(0.012), holdN = Math.round(sampleRate * 0.015);
    const hs = this.hits(n); let hi = 0;
    if (hs.length) this.gated = true;
    for (let i = 0; i < n; i++) {
      while (hi < hs.length && hs[hi][0] <= i) { this.ex = 1; this.hold = holdN; hi++; }
      this.wet += sm * (tWet - this.wet); this.dry += sm * (tDry - this.dry);
      let ex = 1;
      if (ks && this.gated) { if (this.hold > 0) this.hold--; else this.ex = 0.12 + (this.ex - 0.12) * exRel; ex = this.ex; }
      for (let ch = 0; ch < 2; ch++) {
        const x = ch ? R[i] : L[i], xin = this.hpIn[ch].hp(x, hpA) * ex;
        let sum = 0;
        for (let c = 0; c < 4; c++) {
          const k = ch * 4 + c;
          if (!this.on[k]) continue;
          let z = this.dl[k].read(this.D[k]);
          if (ks) { const av = 0.5 * (z + this.prev[k]); this.prev[k] = z; z = av; }
          const s = this.lpf[k].lp(z, this.a[k]);
          this.dl[k].write(soft(xin * this.ig[k] + this.g[k] * s));
          sum += z;
        }
        sum = this.hpOut[ch].hp(sum, hpA);
        (ch ? oR : oL)[i] = lim(x * this.dry + sum * this.wet);
      }
    }
  }
}
registerProcessor("kdfx-resonator", Resonator);
`,
    },
    create(ctx, env) {
      return workletInstance(ctx, env, "kdfx-resonator", (s, P) => {
        const a = clamp(s.amount || 0);
        P("note", resNote(s.x, !!tv(s, "track", false), resKey(env)), 0.01);
        P("t60", resT60(s.y, a));
        P("damp", dv(s, "damp", 0.3));
        P("chord", Math.min(4, Math.floor(dv(s, "chord", 0) * 5)));
        P("ks", tv(s, "ks", false) ? 1 : 0);
        P("wet", Math.min(1, a * 1.5) * (1 - 0.55 * a)); // night pass: was +8.7 dB over the dry at the rim
        P("dry", 1 - 0.85 * a);
      });
    },
  });

  // ------------------------------------------------------------------ 10 FLANGER
  // A short delay (0.1-10 ms) swept by an LFO and added to the dry voice, so the comb's notches sweep
  // (the jet). Y = feedback, below the middle negative (hollow), above positive (ringing metal).
  // THROUGH-ZERO delays the dry too (0.5-3 ms, so the hit stays in time), and the swept copy
  // (flipped) crosses it: the notches dive to nothing and the sound cancels for a moment. TEMPO SYNC locks the sweep to the song (X: 4 bars
  // .. 1/16), so "Snare Whoosh" sweeps once a bar. DEPTH 0 = LFO off, a fixed comb (MANUAL DELAY).
  // amount = how much of the swept copy is mixed in, and how hard the feedback rings.
  const FLANGE_SYNC = [[16, "4 bars"], [8, "2 bars"], [4, "1 bar"], [2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"]];
  const flangeSync = (x) => FLANGE_SYNC[Math.min(FLANGE_SYNC.length - 1, Math.floor(clamp(x) * FLANGE_SYNC.length))];
  K.register({
    id: "flanger", num: 10, name: "FLANGER", group: "DELAY PORTALS",
    caption: "Jet-plane swoosh, brutal on breaks.",
    axes: { x: "LFO RATE", y: "FEEDBACK" },
    dials: [
      { id: "manual", name: "MANUAL DELAY", def: 0.45, fmt: (v) => (0.1 * Math.pow(100, clamp(v))).toFixed(v < 0.5 ? 2 : 1) + " ms" },
      { id: "depth", name: "DEPTH", def: 0.7 },
    ],
    toggles: [
      { id: "tz", name: "THROUGH-ZERO", def: false },
      { id: "sync", name: "TEMPO SYNC", def: false },
    ],
    presets: [
      { name: "Jet Break", voice: "all", sync: true, x: 0.22, y: 0.92, wet: 0.75, dials: { manual: 0.35, depth: 0.85 }, toggles: { tz: false, sync: true } },
      { name: "Metal Hats", voice: "hats", x: 0.85, y: 0.1, wet: 0.7, dials: { manual: 0.22, depth: 0.45 }, toggles: { tz: false, sync: false } },
      { name: "Snare Whoosh", voice: "snare", x: 0.36, y: 0.78, wet: 0.8, dials: { manual: 0.5, depth: 1 }, toggles: { tz: true, sync: true } },
      { name: "Static Comb", voice: "kick", x: 0.5, y: 0.82, wet: 0.6, dials: { manual: 0.55, depth: 0 }, toggles: { tz: false, sync: false } },
    ],
    // readouts for the XY numbers (optional extra: the host may show them)
    fmtX: (x, s) => (tv(s, "sync", false) ? flangeSync(x)[1] : expo(x, 0.04, 9).toFixed(2) + " Hz"),
    fmtY: (y) => { const f = Math.round((clamp(y) * 2 - 1) * 92); return (f > 0 ? "+" : "") + f + "%"; },
    worklets: {
      "kdfx-flanger": PRELUDE + `
class Flanger extends KdBase {
  ${kp({ rate: 0.3, beats: 4, sync: 0, manual: 1, depth: 0.7, fb: 0, wet: 0, tz: 0 })}
  constructor(o) {
    super(o);
    const max = Math.ceil(sampleRate * 0.03);
    this.dl = [new Delay(max), new Delay(max)]; this.dd = [new Delay(max), new Delay(max)];
    this.ph = 0; this.init = false; this.man = 1; this.dep = 0.7; this.fb = 0; this.wet = 0;
  }
  reset() { for (const d of this.dl) d.clear(); for (const d of this.dd) d.clear(); }
  run(L, R, oL, oR, n, p) {
    const tMan = p.manual[0], tDep = p.depth[0], tFb = p.fb[0], tWet = p.wet[0];
    if (!this.init) { this.init = true; this.man = tMan; this.dep = tDep; this.fb = tFb; this.wet = tWet; }
    const a = 1 - coefT(0.02), sync = p.sync[0] > 0.5, tz = p.tz[0] > 0.5;
    const bpm = (this.beatRef && this.beatRef.bpm) || 120, beats = Math.max(0.25, p.beats[0]);
    const b0 = sync ? this.beatAt(0, bpm) : 0, bInc = bpm / 60 / sampleRate, inc = p.rate[0] / sampleRate, ms = sampleRate / 1000;
    for (let i = 0; i < n; i++) {
      this.man += a * (tMan - this.man); this.dep += a * (tDep - this.dep); this.fb += a * (tFb - this.fb); this.wet += a * (tWet - this.wet);
      let ph;
      if (sync) { const b = (b0 + i * bInc) / beats; ph = b - Math.floor(b); } else { this.ph += inc; if (this.ph >= 1) this.ph -= 1; ph = this.ph; }
      const fb = this.fb, wet = tz ? -this.wet : this.wet, inGain = 1 - Math.abs(fb) * 0.5, norm = 1 / (1 + this.wet * 0.55);
      for (let c = 0; c < 2; c++) {
        const lfo = 0.5 - 0.5 * Math.cos(TAU * (ph + c * 0.25)), x = c ? R[i] : L[i];
        let d, dry;
        if (tz) { const dc = clampv(this.man, 0.5, 3) * ms; d = dc * (1 + (lfo * 2 - 1) * this.dep); dry = this.dd[c].read(dc); this.dd[c].write(x); }
        else { d = this.man * ms * Math.pow(2, (lfo * 2 - 1) * this.dep * 1.5); dry = x; }
        const tap = this.dl[c].read3(Math.max(2, d));
        this.dl[c].write(soft(x * inGain + fb * tap));
        (c ? oR : oL)[i] = lim((dry + wet * tap) * norm);
      }
    }
  }
}
registerProcessor("kdfx-flanger", Flanger);
`,
    },
    create(ctx, env) {
      return workletInstance(ctx, env, "kdfx-flanger", (s, P) => {
        const a = clamp(s.amount || 0), sync = !!tv(s, "sync", false);
        P("sync", sync ? 1 : 0);
        P("rate", expo(s.x, 0.04, 9));
        P("beats", flangeSync(s.x)[0]);
        P("manual", 0.1 * Math.pow(100, dv(s, "manual", 0.45)));
        P("depth", dv(s, "depth", 0.7));
        P("fb", (clamp(s.y) * 2 - 1) * 0.92 * Math.min(1, 0.3 + a));
        P("wet", Math.min(1, a * 1.6));
        P("tz", tv(s, "tz", false) ? 1 : 0);
      });
    },
  });

  // ------------------------------------------------------------------ 24 SHIMMER
  // A reverb whose tail climbs in pitch. The hit is smeared by 4 all-pass diffusers into an 8-line
  // reverb tank; the tank's own output is pitch-shifted up by INTERVAL (+7 / +12 / +19 st),
  // high-passed (250 Hz) and fed back in, so every trip round the loop comes back an interval higher:
  // a snare turns into a rising octave cloud. X = how much shifted tail is fed back (0 = plain
  // reverb), Y = decay time (0.4 s .. 12 s). DAMPING darkens the tank (16 kHz .. 1.5 kHz).
  // FREEZE mutes the input and holds the tail forever (the tank loses what the shimmer adds, so the
  // level never grows). DUCK pushes the tail down ~15 dB while the voice itself plays.
  // amount = how loud the tail is (the dry voice fades to half), how much shimmer, a longer decay.
  const SHIM_ST = [7, 12, 19];
  const shimSt = (v) => SHIM_ST[Math.min(2, Math.floor(clamp(v) * 3))];
  const shimT60 = (y, a) => expo(y, 0.4, 12) * (0.6 + 0.4 * clamp(a));
  K.register({
    id: "shimmer", num: 24, name: "SHIMMER", group: "REVERB PORTALS",
    caption: "Snares become heavenly octave clouds.",
    axes: { x: "SHIMMER", y: "DECAY" },
    dials: [
      { id: "interval", name: "INTERVAL", def: 0.5, fmt: (v) => "+" + shimSt(v) + " st" },
      { id: "damping", name: "DAMPING", def: 0.3, fmt: (v) => fmtHz(expo(v, 16000, 1500)) },
    ],
    toggles: [
      { id: "freeze", name: "FREEZE", def: false },
      { id: "duck", name: "DUCK", def: false },
    ],
    presets: [
      { name: "Heaven Snare", voice: "snare", x: 0.75, y: 0.85, wet: 0.7, dials: { interval: 0.5, damping: 0.3 }, toggles: { freeze: false, duck: false } },
      { name: "Angel Hats", voice: "hats", x: 0.7, y: 0.7, wet: 0.65, dials: { interval: 0.85, damping: 0.15 }, toggles: { freeze: false, duck: false } },
      { name: "Organ Perc", voice: "perc", x: 0.66, y: 0.7, wet: 0.6, dials: { interval: 0.15, damping: 0.35 }, toggles: { freeze: false, duck: false } },
      { name: "Floor", voice: "kick", x: 0.5, y: 0.08, wet: 0.5, dials: { interval: 0.5, damping: 0.6 }, toggles: { freeze: false, duck: false } },
    ],
    fmtX: (x, s) => Math.round(clamp(x) * 60 * Math.min(1, 0.3 + clamp((s && s.amount) || 1))) + "% shimmer",
    fmtY: (y, s) => fmtMs(shimT60(y, s && s.amount != null ? s.amount : 1)),
    worklets: {
      "kdfx-shimmer": PRELUDE + `
const SHIM_AP = [142, 107, 379, 277], SHIM_APG = [0.75, 0.75, 0.625, 0.625];
// the head's Shifter with a cheaper window: w = (4p(1-p))^2 ~ sin^2(pi p), the other tap gets 1 - w
class ShimShift {
  constructor(maxWin) { this.d = new Delay(maxWin * 2 + 16); this.ph = 0; }
  run(x, ratio, win) {
    this.d.write(x);
    this.ph += (1 - ratio) / win;
    this.ph -= Math.floor(this.ph);
    const ph = this.ph, p2 = ph + 0.5 - (ph >= 0.5 ? 1 : 0), q = 4 * ph * (1 - ph), w = q * q;
    return this.d.read3(2 + ph * win) * w + this.d.read3(2 + p2 * win) * (1 - w);
  }
  clear() { this.d.clear(); this.ph = 0; }
}
class Shimmer extends KdBase {
  ${kp({ shim: [0, 0, 0.7], t60: [2, 0.05, 60], damp: [8000, 20, 22000], ratio: [2, 0.25, 4], freeze: 0, duck: 0, dry: 1, wet: 0 })}
  constructor(o) {
    super(o);
    const k = sampleRate / 44100;
    this.apLen = SHIM_AP.map((n) => n * k);
    this.ap = this.apLen.map((n) => new Allpass(Math.ceil(n) + 4));
    this.fdn = new FDN(1.3, this.opts.seed || 1);
    this.win = Math.round(0.08 * sampleRate);
    this.sh = [new ShimShift(this.win), new ShimShift(this.win)];
    this.hp = [new OnePole(), new OnePole()];
    this.ef = new Env();
    this.init = false; this.shim = 0; this.dry = 1; this.wet = 0; this.inG = 1; this.dk = 1; this.t60 = 2; this.dmp = 8000; this.fz = false; this.lev = 0; this.pw = 0; this.fzOn = false; this.fzT = 0; this.ref = 0; this.gz = 1;
  }
  reset() { for (const a of this.ap) a.clear(); this.fdn.clear(); for (const s of this.sh) s.clear(); for (const h of this.hp) h.clear(); }
  busy() { return this.fz && this.lev > 1e-5; }
  run(L, R, oL, oR, n, p) {
    const tShim = p.shim[0], tDry = p.dry[0], tWet = p.wet[0], fz = p.freeze[0] > 0.5, duck = p.duck[0] > 0.5, ratio = p.ratio[0];
    if (!this.init) { this.init = true; this.shim = tShim; this.dry = tDry; this.wet = tWet; this.t60 = p.t60[0]; this.dmp = p.damp[0]; }
    this.fz = fz;
    // decay and damping glide per block (the tank recomputes its line gains)
    const ab = 1 - Math.exp(-n / (0.05 * sampleRate)), fdn = this.fdn;
    this.t60 += ab * (p.t60[0] - this.t60); this.dmp += ab * (p.damp[0] - this.dmp);
    fdn.set(1.15, fz ? Infinity : this.t60, fz ? sampleRate : this.dmp, 0, 0.4);
    // the tank gives up about as much per pass as the shimmer feeds back in, so the loop can't run away.
    // Frozen: a slow level-hold nudges the tank gain so the tail stays at the level it had when frozen.
    const gc = Math.sqrt(Math.max(0.3, 1 - SHIM_LOSS * tShim * tShim)), g = fdn.g;
    if (fz) {
      if (!this.fzOn) { this.fzOn = true; this.fzT = 0; this.ref = 0; this.gz = gc; }
      this.fzT += n;
      if (this.fzT < 0.12 * sampleRate) this.ref = this.pw;
      if (this.ref > 1e-10) this.gz = clampv(this.gz * Math.pow(this.ref / Math.max(1e-12, this.pw), 0.03), 0.8, 1);
      for (let i = 0; i < 8; i++) g[i] = this.gz;
    } else { this.fzOn = false; for (let i = 0; i < 8; i++) g[i] *= gc; }
    const a = 1 - coefT(0.02), hpA = coefHz(250), win = this.win, att = coefT(0.002), rel = coefT(0.25);
    const ap = this.ap, apl = this.apLen, sh = this.sh, hp = this.hp;
    let lev = 0, pw = 0;
    for (let i = 0; i < n; i++) {
      this.shim += a * (tShim - this.shim); this.dry += a * (tDry - this.dry); this.wet += a * (tWet - this.wet);
      this.inG += a * ((fz ? 0 : 1) - this.inG);
      const xl = L[i], xr = R[i];
      // the hit, diffused into a dense burst
      let d = (xl + xr) * 0.5 * this.inG;
      d = ap[0].run(d, apl[0], SHIM_APG[0]); d = ap[1].run(d, apl[1], SHIM_APG[1]);
      d = ap[2].run(d, apl[2], SHIM_APG[2]); d = ap[3].run(d, apl[3], SHIM_APG[3]);
      // the shimmer: the tank's output, pitched up, high-passed, fed back in (each pass climbs again)
      const sl = hp[0].hp(sh[0].run(fdn.l, ratio, win), hpA), sr = hp[1].hp(sh[1].run(fdn.r, ratio, win), hpA);
      fdn.run(d + soft(sl * this.shim), d + soft(sr * this.shim));
      // DUCK: the voice's own level pushes the tail down to about -15 dB, back up in ~250 ms
      const e = duck ? this.ef.run((Math.abs(xl) + Math.abs(xr)) * 0.5, att, rel) : 0;
      this.dk += a * ((duck ? 1 - 0.82 * Math.min(1, e * 6) : 1) - this.dk);
      const w = this.wet * this.dk, wl = fdn.l, wr = fdn.r;
      oL[i] = lim(this.dry * xl + w * wl);
      oR[i] = lim(this.dry * xr + w * wr);
      const m = Math.abs(wl) + Math.abs(wr); if (m > lev) lev = m;
      pw += wl * wl + wr * wr;
    }
    this.lev = lev; this.pw += (1 - Math.exp(-n / (0.15 * sampleRate))) * (pw / n - this.pw);
  }
}
const SHIM_LOSS = 0.25;
registerProcessor("kdfx-shimmer", Shimmer);
`,
    },
    create(ctx, env) {
      return workletInstance(ctx, env, "kdfx-shimmer", (s, P) => {
        const a = clamp(s.amount || 0), t60 = shimT60(s.y, a);
        P("shim", clamp(s.x) * 0.6 * Math.min(1, 0.3 + a));
        P("t60", t60);
        P("damp", expo(dv(s, "damping", 0.3), 16000, 1500));
        P("ratio", Math.pow(2, shimSt(dv(s, "interval", 0.5)) / 12));
        P("freeze", tv(s, "freeze", false) ? 1 : 0);
        P("duck", tv(s, "duck", false) ? 1 : 0);
        P("dry", 1 - 0.5 * a);
        P("wet", (Math.min(1, a * 1.4) * 0.75) / Math.sqrt(1 + t60 * 0.4)); // night pass: was 1.6 (+8.8 dB at the rim)
      });
    },
  });

  // ------------------------------------------------------------------ 25 GATED VERB
  // The '80s big snare: a large, bright, long reverb (predelay -> diffusers -> the FDN tank) whose
  // output goes through a hard noise gate. The gate opens on each hit, stays fully open for the gate
  // time (Y, counted from the hit), then slams shut in ~10 ms: a dense, flat burst of room that stops
  // dead. X = room size (bigger tank, longer decay, so the burst is denser and flatter).
  // KEY FROM DRY (on): the gate listens to the dry hit (its level and the hit messages, so it opens
  // exactly on the hit; a hit quieter than GATE THRESHOLD doesn't open it). Off: a classic noise gate
  // on the reverb itself (it closes once the tail falls under the threshold, plus the gate time).
  // The dry hit always stays; amount adds the room (and dips the dry a little, at most 30%).
  const gvPeaks = new WeakMap();
  const gvPeak = (buf) => {
    if (!buf || !buf.getChannelData) return 1;
    let pk = gvPeaks.get(buf);
    if (pk != null) return pk;
    pk = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; } }
    gvPeaks.set(buf, pk);
    return pk;
  };
  const gvHold = (y) => 0.04 * Math.pow(700 / 40, clamp(y));
  const gvRoom = (x) => ["TINY", "SMALL", "ROOM", "BIG", "HUGE"][Math.min(4, Math.floor(clamp(x) * 5))];
  K.register({
    id: "gated-verb", num: 25, name: "GATED VERB", group: "REVERB PORTALS",
    caption: "The '80s big snare.",
    axes: { x: "ROOM SIZE", y: "GATE TIME" },
    dials: [
      { id: "predelay", name: "PREDELAY", def: 0.07, fmt: (v) => Math.round(clamp(v) * 120) + " ms" },
      { id: "thresh", name: "GATE THRESHOLD", def: 0.556, fmt: (v) => Math.round(-60 + 54 * clamp(v)) + " dB" },
    ],
    toggles: [
      { id: "key", name: "KEY FROM DRY", def: true },
    ],
    presets: [
      { name: "1984", voice: "snare", x: 0.9, y: 0.64, wet: 0.8, dials: { predelay: 0.07, thresh: 0.556 }, toggles: { key: true } },
      { name: "Tom Thunder", voice: "perc", x: 0.8, y: 0.85, wet: 0.75, dials: { predelay: 0.12, thresh: 0.5 }, toggles: { key: true } },
      { name: "Gated Kick", voice: "kick", x: 0.2, y: 0.35, wet: 0.65, dials: { predelay: 0, thresh: 0.556 }, toggles: { key: true } },
      { name: "Hat Burst", voice: "hats", x: 0.1, y: 0.08, wet: 0.7, dials: { predelay: 0, thresh: 0.45 }, toggles: { key: true } },
    ],
    fmtX: (x) => gvRoom(x),
    fmtY: (y) => Math.round(gvHold(y) * 1000) + " ms",
    worklets: {
      "kdfx-gated-verb": PRELUDE + `
const GV_AP = [113, 337, 509];
class GatedVerb extends KdBase {
  ${kp({ pre: 0.008, scale: 1, t60: 3, hold: 0.25, thr: 0.0316, key: 1, wet: 0, dry: 1 })}
  constructor(o) {
    super(o);
    const k = sampleRate / 44100;
    this.pd = new Delay(Math.ceil(sampleRate * 0.13));
    this.apLen = GV_AP.map((n) => n * k);
    this.ap = this.apLen.map((n) => new Allpass(Math.ceil(n) + 4));
    this.fdn = new FDN(1.7, ((this.opts.seed || 1) % 997) + 1);
    this.env = new Env();
    this.sc = -1; this.t6 = 3; this.init = false; this.pre = 0; this.wet = 0; this.dry = 1;
    this.g = 0; this.hold = 0; this.armed = true; this.dirty = false;
    this.pend = new Float64Array(8); this.np = 0;
  }
  dump() { this.pd.clear(); for (const a of this.ap) a.clear(); this.fdn.clear(); this.dirty = false; }
  reset() { this.dump(); this.g = 0; this.hold = 0; this.np = 0; this.armed = true; this.env.e = 0; }
  busy() { return this.g > 0 || this.hold > 0 || this.np > 0; }
  run(L, R, oL, oR, n, p) {
    const tPre = p.pre[0] * sampleRate, tWet = p.wet[0], tDry = p.dry[0], sc = p.scale[0], t6 = p.t60[0];
    if (!this.init) { this.init = true; this.pre = tPre; this.wet = tWet; this.dry = tDry; }
    // room size glides block by block (re-tuning the tank in one jump would click)
    if (this.sc < 0) { this.sc = sc; this.t6 = t6; this.fdn.set(sc, t6, 9000, 0, 0.5); }
    else if (Math.abs(sc - this.sc) > 1e-4 || Math.abs(t6 - this.t6) > 1e-4) {
      this.sc += 0.3 * (sc - this.sc); this.t6 += 0.3 * (t6 - this.t6); this.fdn.set(this.sc, this.t6, 9000, 0, 0.5);
    }
    const a = 1 - coefT(0.02), up = 1 / (0.0005 * sampleRate), down = 1 / (0.01 * sampleRate);
    const holdS = Math.max(1, Math.round(p.hold[0] * sampleRate)), thr = p.thr[0], keyDry = p.key[0] > 0.5;
    const att = coefT(0.0005), rel = coefT(0.04), nrm = 0.55 * Math.sqrt(this.t6);
    const t0 = Math.round(currentTime * sampleRate), hs = this.hits(n);
    // hit messages: open exactly on the hit (+ predelay), if the hit is louder than the threshold
    for (let j = 0; j < hs.length; j++) if (keyDry && hs[j][1].gain >= thr && this.np < 8) this.pend[this.np++] = t0 + hs[j][0] + Math.round(tPre);
    const pd = this.pd, ap = this.ap, l0 = this.apLen[0], l1 = this.apLen[1], l2 = this.apLen[2], fdn = this.fdn, env = this.env;
    for (let i = 0; i < n; i++) {
      this.pre += a * (tPre - this.pre); this.wet += a * (tWet - this.wet); this.dry += a * (tDry - this.dry);
      const xd = pd.read(this.pre); pd.write((L[i] + R[i]) * 0.5);
      if (keyDry) {
        const kv = env.run(xd, att, rel);
        if (kv > thr) { if (this.armed) { this.armed = false; this.hold = holdS; } } else if (kv < thr * 0.5) this.armed = true;
        if (this.np && t0 + i >= this.pend[0]) { this.hold = holdS; this.armed = false; for (let q = 1; q < this.np; q++) this.pend[q - 1] = this.pend[q]; this.np--; }
      }
      // keyed from the dry, the tank only runs while the gate is open (it starts fresh on each hit)
      let vl = 0, vr = 0;
      if (!keyDry || this.hold > 0 || this.g > 0) {
        let v = ap[0].run(xd, l0, 0.6); v = ap[1].run(v, l1, 0.6); v = ap[2].run(v, l2, 0.55);
        fdn.run(v, v); vl = fdn.l; vr = fdn.r;
        if (!keyDry && env.run((Math.abs(vl) + Math.abs(vr)) * 0.5 * nrm, att, rel) > thr) this.hold = holdS;
      }
      if (this.hold > 0) { this.hold--; this.g += up; if (this.g > 1) this.g = 1; this.dirty = true; }
      else if (this.g > 0) { this.g -= down; if (this.g < 0) this.g = 0; }
      else if (keyDry && this.dirty) this.dump();
      const w = this.wet * this.g * nrm;
      oL[i] = lim(L[i] * this.dry + vl * w); oR[i] = lim(R[i] * this.dry + vr * w);
    }
  }
}
registerProcessor("kdfx-gated-verb", GatedVerb);
`,
    },
    create(ctx, env) {
      const inst = workletInstance(ctx, env, "kdfx-gated-verb", (s, P) => {
        const a = clamp(s.amount || 0), x = clamp(s.x);
        P("pre", dv(s, "predelay", 0.07) * 0.12);
        P("scale", expo(x, 0.35, 1.6));
        P("t60", expo(x, 0.8, 4.5) * (0.6 + 0.4 * a));
        P("hold", gvHold(s.y));
        P("thr", Math.pow(10, (-60 + 54 * dv(s, "thresh", 0.556)) / 20));
        P("key", tv(s, "key", true) ? 1 : 0);
        P("wet", Math.min(1, a * 1.4) * (1 - 0.5 * a)); // night pass: was +7.9 dB at the rim
        P("dry", 1 - 0.3 * a);
      });
      // the hit messages carry the hit's real level (gain x the sample's peak) for the threshold
      const node = inst.node;
      inst.trigger = (hit) => { if (node && hit && isFinite(hit.at)) node.port.postMessage({ type: "hit", at: hit.at, gain: (hit.gain == null ? 1 : hit.gain) * gvPeak(hit.buf) }); };
      return inst;
    },
  });

  // ------------------------------------------------------------------ 26 CONVOLUTION
  // Puts the drum inside a recorded-style space: every sample of the hit is smeared through an
  // "impulse response" (the sound a space makes when you clap in it). Chrome's ConvolverNode does the
  // partitioned FFT convolution (long tails run off the audio thread), so no worklet here.
  // The four spaces are built in code (same seed, same space): TUNNEL (concrete, flutter echoes),
  // TIN CAN (tiny metal box), CATHEDRAL (huge stone room, lows ring longest), BODY (a human chest).
  // X stretches the space (0.4x .. 2.5x, time and pitch together: bigger = darker), Y = predelay
  // (0 .. 250 ms). IR EQ tilts the space dark .. bright. REVERSE IR plays the space backwards (it
  // swells into the hit). DRAG-IN IR uses any dropped sound as the space (loadIR / dropTarget).
  // amount: the dry hit fades to 10% and the space comes in, so at the rim the drum is fully inside.
  const CV_IRS = ["TUNNEL", "TIN CAN", "CATHEDRAL", "BODY"];
  const CV_STEPS = 16, CV_MAX = 3.5; // night pass: 6 s spaces cost ~400 ms per voice pass (9 voices)
  // per-space trim (dB) after energy normalising, so all four sit about as loud as the dry hit
  const CV_TRIM = { TUNNEL: 0, "TIN CAN": 1.5, CATHEDRAL: -0.5, BODY: -19, DROPPED: 0 };
  const cvIdx = (v) => Math.min(4, Math.floor(clamp(v) * 5)); // 5 zones: the 4 spaces + DROPPED (= BODY until a sound is dropped)
  const cvStretch = (step) => expo(step / CV_STEPS, 0.4, 2.5);
  let cvDrop = null; // { name, sr, ch: [Float32Array, Float32Array], ver }
  let cvDropVer = 0, cvRestored = false;
  const cvLive = new Set();
  const cvBase = new Map(), cvBufs = new Map();
  const cvLp = (hz, sr) => 1 - Math.exp((-2 * Math.PI * hz) / sr);
  // the four spaces at 1x: [L, R] Float32Arrays at sample rate sr
  const cvMake = (name, sr) => {
    const k = sr + "|" + name;
    if (cvBase.has(k)) return cvBase.get(k);
    const out = [0, 1].map((c) => {
      const r = K.rng(K.hash("cv", name, c)), T = (s) => Math.floor(s * sr);
      let d;
      if (name === "TUNNEL") {
        d = new Float32Array(T(2.6));
        // flutter echoes every ~27 ms (jittered per side), fading into a dense, darkening wash
        const gap = 0.027 + c * 0.0013;
        for (let t = 0.004 + c * 0.002, j = 0; t < 2.6; t += gap * (0.93 + 0.14 * r()), j++) {
          const i = T(t); if (i < d.length) d[i] += (r() < 0.5 ? -1 : 1) * 1.6 * Math.exp(-t / 0.5);
        }
        let lp = 0, lp2 = 0, hp = 0;
        for (let i = 0; i < d.length; i++) {
          const t = i / sr, env = Math.pow(10, (-3 * t) / 2.6), dens = Math.min(1, 0.12 + t / 0.5);
          const x = d[i] * env + (r() * 2 - 1) * 0.35 * dens * env;
          const a = cvLp(5000 - 3600 * Math.min(1, t / 1.6), sr);
          lp += a * (x - lp); lp2 += a * (lp - lp2); hp += cvLp(150, sr) * (lp2 - hp);
          d[i] = lp2 - hp;
        }
      } else if (name === "TIN CAN") {
        d = new Float32Array(T(0.18));
        // a few dense early reflections (1-3 ms) + inharmonic metal modes ringing 60-150 ms
        for (let j = 0; j < 14; j++) { const i = T(0.0008 + 0.0024 * r()); d[i] += (r() < 0.5 ? -1 : 1) * (0.4 + 0.6 * r()); }
        d[0] += 0.6;
        const modes = [];
        for (let j = 0; j < 11; j++) modes.push([700 * Math.pow(10, r()) * (1 + c * 0.004), 0.06 + 0.09 * r(), 0.25 + 0.5 * r(), r() * 6.283]);
        for (let i = 0; i < d.length; i++) {
          const t = i / sr; let s = 0;
          for (let m = 0; m < modes.length; m++) { const md = modes[m]; s += Math.sin(6.283185307 * md[0] * t + md[3]) * md[2] * Math.exp((-6.9 * t) / md[1]); }
          d[i] += s * 0.2 + (r() * 2 - 1) * 0.25 * Math.exp(-t / 0.004);
        }
      } else if (name === "CATHEDRAL") {
        d = new Float32Array(T(4.5));
        // sparse early reflections 20-120 ms, then a slowly building tail: lows 6 s, mids 4 s, highs 2 s
        for (let j = 0; j < 9; j++) { const t = 0.02 + 0.1 * Math.pow(r(), 0.8) + c * 0.003; d[T(t)] += (r() < 0.5 ? -1 : 1) * (0.25 + 0.35 * r()); }
        let l1 = 0, l2 = 0, l3 = 0, e1 = 0;
        const aLo = cvLp(350, sr), aHi = cvLp(2200, sr), aAir = cvLp(6000, sr);
        for (let i = 0; i < d.length; i++) {
          const t = i / sr, w = r() * 2 - 1;
          l1 += aLo * (w - l1); l2 += aHi * (w - l2); l3 += aAir * (w - l3);
          const lo = l1, mid = l2 - l1, hi = l3 - l2; // stone + air: nothing much above ~6 kHz
          const build = t < 0.03 ? 0 : 1 - Math.exp(-(t - 0.03) / 0.12);
          const tail = (lo * 2.2 * Math.pow(10, (-3 * t) / 6) + mid * 1.1 * Math.pow(10, (-3 * t) / 4) + hi * 0.55 * Math.pow(10, (-3 * t) / 2)) * build * 0.12;
          e1 += cvLp(5000, sr) * (d[i] - e1);
          d[i] = e1 + tail;
        }
      } else {
        d = new Float32Array(T(0.25));
        // a human chest: thump modes ~85 / 140 Hz (~120 ms), a ~400 Hz ribcage mode, 40 ms of muffled noise
        let lp = 0;
        const f1 = 85 * (1 + c * 0.01), f2 = 140 * (1 - c * 0.008), f3 = 400 * (1 + c * 0.012);
        for (let i = 0; i < d.length; i++) {
          const t = i / sr, w = r() * 2 - 1;
          lp += cvLp(700, sr) * (w - lp);
          d[i] = Math.sin(6.2832 * f1 * t) * Math.exp(-t / 0.04) + Math.sin(6.2832 * f2 * t + 0.4) * 0.7 * Math.exp(-t / 0.03)
            + Math.sin(6.2832 * f3 * t + 1.1) * 0.35 * Math.exp(-t / 0.018) + lp * 1.4 * (t < 0.04 ? 1 - t / 0.04 : 0);
        }
        d[0] += 0.3;
      }
      return d;
    });
    cvBase.set(k, out);
    return out;
  };
  // resample to `str` (time and pitch together), cap, fade the end, normalise the energy -> AudioBuffer
  const cvBuild = (ctx, src, srcSr, str, trimDb) => {
    const sr = ctx.sampleRate, rate = (srcSr / sr) / str, n0 = src[0].length;
    const n = Math.max(32, Math.min(Math.floor(CV_MAX * sr), Math.floor(n0 / rate)));
    const b = ctx.createBuffer(2, n, sr), fade = Math.min(Math.floor(0.08 * sr), n >> 2);
    let e = 0;
    for (let c = 0; c < 2; c++) {
      let s = src[Math.min(c, src.length - 1)];
      const d = b.getChannelData(c);
      if (rate > 1.1) {
        // squeezing: low-pass the source first so it doesn't alias
        const aa = cvLp((0.42 * srcSr) / rate, srcSr), t = new Float32Array(n0);
        let y1 = 0, y2 = 0;
        for (let i = 0; i < n0; i++) { y1 += aa * (s[i] - y1); y2 += aa * (y1 - y2); t[i] = y2; }
        s = t;
      }
      for (let i = 0; i < n; i++) {
        const p = i * rate, j = Math.floor(p), f = p - j;
        const a0 = j < n0 ? s[j] : 0, a1 = j + 1 < n0 ? s[j + 1] : 0;
        let v = a0 + (a1 - a0) * f;
        if (i >= n - fade) v *= (n - i) / fade;
        d[i] = v; e += v * v;
      }
    }
    const g = Math.pow(10, (trimDb || 0) / 20) / Math.sqrt(Math.max(1e-9, e / 2));
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= g; }
    return b;
  };
  // the buffer for a state (cached per sample rate + space + stretch step + reverse; LRU of 24)
  const cvBuffer = (ctx, name, step, rev) => {
    const drop = name === "DROPPED" && cvDrop;
    const key = ctx.sampleRate + "|" + name + (drop ? "#" + cvDrop.ver : "") + "|" + step + "|" + (rev ? 1 : 0);
    let b = cvBufs.get(key);
    if (b) { cvBufs.delete(key); cvBufs.set(key, b); return b; }
    const fwdKey = ctx.sampleRate + "|" + name + (drop ? "#" + cvDrop.ver : "") + "|" + step + "|0";
    let fwd = cvBufs.get(fwdKey);
    if (!fwd) {
      fwd = drop ? cvBuild(ctx, cvDrop.ch, cvDrop.sr, cvStretch(step), CV_TRIM.DROPPED) : cvBuild(ctx, cvMake(name, ctx.sampleRate), ctx.sampleRate, cvStretch(step), CV_TRIM[name]);
      cvBufs.set(fwdKey, fwd);
    }
    b = rev ? K.reverseBuffer(ctx, fwd) : fwd;
    cvBufs.set(key, b);
    while (cvBufs.size > 24) cvBufs.delete(cvBufs.keys().next().value);
    return b;
  };
  // remember the dropped sound across reloads (IndexedDB "killdrum-fx" / "ir"); all optional
  const cvDb = (mode, fn) => {
    try {
      const rq = indexedDB.open("killdrum-fx", 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore("ir"); } catch (e) { /* exists */ } };
      rq.onsuccess = () => { try { const tx = rq.result.transaction("ir", mode); fn(tx.objectStore("ir")); } catch (e) { /* no store */ } };
      rq.onerror = () => {};
    } catch (e) { /* no IndexedDB */ }
  };
  const cvSetDrop = (name, sr, ch, save) => {
    cvDrop = { name: name || "DROPPED", sr, ch, ver: ++cvDropVer };
    if (save) cvDb("readwrite", (st) => st.put({ name: cvDrop.name, sr, L: ch[0], R: ch[1] }, "dropped"));
    for (const inst of cvLive) try { inst.refresh(); } catch (e) { console.error(e); }
  };
  const cvRestore = () => {
    if (cvRestored) return;
    cvRestored = true;
    cvDb("readonly", (st) => { const g = st.get("dropped"); g.onsuccess = () => { const v = g.result; if (v && !cvDrop && v.L && v.sr) cvSetDrop(v.name, v.sr, [v.L, v.R || v.L], false); }; });
  };
  // a decoded sound -> an impulse: trim leading silence, cap at 6 s, fade the end (normalised in cvBuild)
  const cvPrep = (buf) => {
    const sr = buf.sampleRate, chs = [0, Math.min(1, buf.numberOfChannels - 1)].map((c) => buf.getChannelData(c));
    let pk = 0;
    for (const d of chs) for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    if (!(pk > 1e-6)) throw new Error("that sound is silent");
    let st = chs[0].length;
    for (const d of chs) for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > pk * 0.02) { if (i < st) st = i; break; }
    st = Math.max(0, st - 16);
    const n = Math.max(32, Math.min(Math.floor(CV_MAX * sr), chs[0].length - st)), fade = Math.min(Math.floor(0.05 * sr), n >> 2);
    return { sr, n, ch: chs.map((d) => { const o = d.slice(st, st + n); for (let i = n - fade; i < n; i++) o[i] *= (n - i) / fade; return o; }) };
  };
  const cvLoadIR = (ctx, src, name) => {
    const dec = (ab) => {
      const c = ctx || new OfflineAudioContext(1, 1, 44100);
      return new Promise((ok, no) => { const p = c.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); });
    };
    let p;
    if (src && typeof src.getChannelData === "function") p = Promise.resolve(src);
    else if (src instanceof ArrayBuffer) p = dec(src.slice(0));
    else if (src && typeof src.arrayBuffer === "function") p = src.arrayBuffer().then(dec);
    else return Promise.reject(new Error("loadIR: give it a File, Blob, ArrayBuffer or AudioBuffer"));
    return p.then((buf) => {
      const r = cvPrep(buf), nm = String(name || (src && src.name) || "DROPPED").replace(/\.[a-z0-9]+$/i, "").slice(0, 24);
      cvSetDrop(nm, r.sr, r.ch, true);
      return { name: nm, seconds: r.n / r.sr };
    });
  };
  K.register({
    id: "convolution", num: 26, name: "CONVOLUTION", group: "REVERB PORTALS",
    caption: "Drums inside a real or weird space.",
    axes: { x: "IR STRETCH", y: "PREDELAY" },
    dials: [
      { id: "ir", name: "IR SELECT", def: 0.5, fmt: (v) => { const i = cvIdx(v); return i === 4 ? (cvDrop ? cvDrop.name.toUpperCase() : "BODY") : CV_IRS[i]; } },
      { id: "eq", name: "IR EQ", def: 0.5, fmt: (v) => (Math.abs(v - 0.5) < 0.02 ? "FLAT" : v < 0.5 ? "DARK " + Math.round((0.5 - v) * 200) + "%" : "BRIGHT " + Math.round((v - 0.5) * 200) + "%") },
    ],
    toggles: [
      { id: "reverse", name: "REVERSE IR", def: false },
      { id: "drag", name: "DRAG-IN IR", def: false },
    ],
    presets: [
      { name: "Tunnel", voice: "snare", x: 0.82, y: 0.16, wet: 0.7, dials: { ir: 0.1, eq: 0.45 }, toggles: { reverse: false, drag: false } },
      { name: "Tin Can", voice: "hats", x: 0.14, y: 0.24, wet: 0.65, dials: { ir: 0.3, eq: 0.62 }, toggles: { reverse: false, drag: false } },
      { name: "Cathedral", voice: "perc", x: 0.84, y: 0.8, wet: 0.75, dials: { ir: 0.5, eq: 0.42 }, toggles: { reverse: false, drag: false } },
      { name: "Body", voice: "kick", x: 0.2, y: 0.22, wet: 0.6, dials: { ir: 0.7, eq: 0.4 }, toggles: { reverse: false, drag: false } },
    ],
    fmtX: (x) => cvStretch(Math.round(clamp(x) * CV_STEPS)).toFixed(2) + "x",
    fmtY: (y) => Math.round(clamp(y) * 250) + " ms",
    // drag-in: loadIR(ctx, File | Blob | ArrayBuffer | AudioBuffer, name) -> Promise<{ name, seconds }>
    loadIR: cvLoadIR,
    // wire drag-and-drop on an element to loadIR; returns an unbind function
    dropTarget(el, ctxGetter) {
      if (!el || !el.addEventListener) return () => {};
      const over = (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
      const drop = (e) => {
        e.preventDefault();
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        const get = ctxGetter || (() => (K.audioCtx ? K.audioCtx() : null));
        if (f) cvLoadIR(get(), f, f.name).catch((err) => console.error("KILLDRUM FX drag-in", err));
      };
      el.addEventListener("dragover", over); el.addEventListener("drop", drop);
      return () => { el.removeEventListener("dragover", over); el.removeEventListener("drop", drop); };
    },
    dropped: () => (cvDrop ? { name: cvDrop.name, seconds: cvDrop.ch[0].length / cvDrop.sr } : null),
    create(ctx, env) {
      cvRestore();
      const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
      const pre = ctx.createDelay(0.3), lo = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter();
      lo.type = "lowshelf"; lo.frequency.value = 300; hi.type = "highshelf"; hi.frequency.value = 3000;
      input.connect(dry); dry.connect(output); input.connect(pre);
      lo.connect(hi); hi.connect(wet); wet.connect(output);
      wet.gain.value = 0;
      let cur = null, last = null, first = true, lastSwap = -1e9, timer = null, dead = false;
      const old = new Set();
      const P = (param, v) => { if (!isFinite(v)) return; if (first) { param.cancelScheduledValues(0); param.setValueAtTime(v, ctx.currentTime); } else K.ramp(param, v, ctx); };
      const nameOf = (st) => (st.drag && cvDrop ? "DROPPED" : st.idx === 4 ? (cvDrop ? "DROPPED" : "BODY") : CV_IRS[st.idx]);
      const keyOf = (st) => nameOf(st) + (nameOf(st) === "DROPPED" ? "#" + cvDrop.ver : "") + "|" + st.step + "|" + (st.rev ? 1 : 0);
      // put the wanted space in: the first time at once, later crossfaded (40 ms) into a fresh convolver
      const swap = () => {
        if (dead || !last) return;
        const k = keyOf(last);
        if (cur && cur.key === k) return;
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (cur && now - lastSwap < 125) { if (!timer) timer = setTimeout(() => { timer = null; swap(); }, 125 - (now - lastSwap)); return; }
        lastSwap = now;
        let buf;
        try { buf = cvBuffer(ctx, nameOf(last), last.step, last.rev); } catch (e) { console.error("KILLDRUM FX convolution", e); return; }
        const conv = ctx.createConvolver(), g = ctx.createGain();
        conv.normalize = false; conv.buffer = buf;
        pre.connect(conv); conv.connect(g); g.connect(lo);
        const t = ctx.currentTime;
        if (cur) {
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.04);
          const o = cur; o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value, t); o.g.gain.linearRampToValueAtTime(0, t + 0.04);
          old.add(o);
          setTimeout(() => { try { pre.disconnect(o.conv); o.conv.disconnect(); o.g.disconnect(); } catch (e) { /* gone */ } old.delete(o); }, 150);
        } else g.gain.value = 1;
        cur = { conv, g, key: k };
      };
      const inst = {
        input, output,
        set(s) {
          const a = clamp(s.amount || 0), eq = dv(s, "eq", 0.5);
          last = { step: Math.round(clamp(s.x) * CV_STEPS), idx: cvIdx(dv(s, "ir", 0.5)), rev: !!tv(s, "reverse", false), drag: !!tv(s, "drag", false) };
          P(pre.delayTime, clamp(s.y) * 0.25);
          P(lo.gain, eq < 0.5 ? (0.5 - eq) * 6 : (0.5 - eq) * 12);
          P(hi.gain, eq < 0.5 ? (eq - 0.5) * 24 : (eq - 0.5) * 16);
          P(dry.gain, 1 - 0.9 * a);
          P(wet.gain, Math.min(1, a * 1.25) * 0.3); // night pass: the normalised space sat +12 dB over the dry
          swap();
          first = false;
        },
        refresh() { if (last && last.drag) swap(); },
        destroy() {
          dead = true; cvLive.delete(inst);
          if (timer) clearTimeout(timer);
          for (const n of [input, dry, pre, lo, hi, wet, output]) try { n.disconnect(); } catch (e) { /* gone */ }
          for (const o of [cur, ...old]) if (o) try { o.conv.disconnect(); o.g.disconnect(); } catch (e) { /* gone */ }
        },
      };
      cvLive.add(inst);
      return inst;
    },
  });

  // ------------------------------------------------------------------ 27 INFINITE VERB
  // A huge reverb that can hold a hit forever. The voice goes through a tone filter and three
  // diffusers (they smear the click into a wash) into an 8-line feedback tank whose line lengths
  // wobble slowly (no metallic ring). X = size: the room's scale and, unfrozen, a 4-40 s tail.
  // Y = modulation: how far and fast the lines wobble (0-4 ms, 0.15-1.2 Hz); high = chorusy hiss.
  // FREEZE shuts the tank's input (over FREEZE FADE) and makes the loop lossless, so what's in there
  // rings forever without growing (a guard trims it if it ever creeps up). CAPTURE ON HIT: each hit
  // of this voice opens the input for a short window (120-250 ms, bigger rooms longer), then the
  // tank freezes again. The input has a 40 ms pre-delay, and in those 40 ms the old drone fades at
  // FREEZE FADE speed: a short fade replaces it with the new hit, a long fade layers on top. With no
  // hits from the host for 2 s it listens for transients itself. DAMPING darkens the loop (16 kHz ..
  // 600 Hz); when frozen it filters what goes in instead (the loop must stay lossless).
  // amount = wet level, tail length and wobble depth; the dry voice dips a little (1 - 0.6 x amount).
  const IV_WET = 0.55;
  K.register({
    id: "infinite-verb", num: 27, name: "INFINITE VERB", group: "REVERB PORTALS",
    caption: "Sustains a hit forever.",
    axes: { x: "SIZE", y: "MODULATION" },
    dials: [
      { id: "damp", name: "DAMPING", def: 0.3, fmt: (v) => (v < 0.02 ? "OFF" : fmtHz(expo(v, 16000, 600))) },
      { id: "fade", name: "FREEZE FADE", def: 0.3, fmt: (v) => fmtMs(expo(v, 0.01, 6)) },
    ],
    toggles: [
      { id: "freeze", name: "FREEZE", def: false },
      { id: "capture", name: "CAPTURE ON HIT", def: false },
    ],
    presets: [
      { name: "Eternal Snare", voice: "snare", x: 0.64, y: 0.26, wet: 0.7, dials: { damp: 0.35, fade: 0.3 }, toggles: { freeze: false, capture: true } },
      { name: "Pad Maker", voice: "all", sync: true, x: 0.92, y: 0.7, wet: 0.75, dials: { damp: 0.4, fade: 0.5 }, toggles: { freeze: false, capture: false } },
      { name: "Dark Matter", voice: "kick", x: 0.7, y: 0.26, wet: 0.7, dials: { damp: 0.9, fade: 0.3 }, toggles: { freeze: false, capture: true } },
      { name: "Static Air", voice: "hats", x: 0.5, y: 0.82, wet: 0.65, dials: { damp: 0, fade: 0.4 }, toggles: { freeze: false, capture: false } },
    ],
    fmtX: (x) => fmtMs(expo(x, 4, 40)) + " tail",
    fmtY: (y) => (clamp(y) * 4).toFixed(1) + " ms wobble",
    worklets: {
      "kdfx-infinite-verb": PRELUDE + `
class InfVerb extends KdBase {
  ${kp({ scale: 1, t60: 10, damp: 8000, mod: 0, modHz: 0.5, fade: 0.3, freeze: 0, capture: 0, win: 0.15, dry: 1, wet: 0 })}
  constructor(o) {
    super(o);
    const k = sampleRate / 44100;
    this.fdn = new FDN(2.05, (this.opts.seed || 1) % 997);
    this.g0 = this.fdn.g; this.gD = new Float32Array(8);
    this.ap = [new Allpass(Math.ceil(400 * k)), new Allpass(Math.ceil(400 * k)), new Allpass(Math.ceil(400 * k))];
    this.apL = [142 * k, 107 * k, 379 * k];
    this.preN = Math.round(sampleRate * 0.04); this.pre = new Delay(this.preN + 8);
    this.hpIn = new OnePole(); this.lp1 = new OnePole(); this.lp2 = new OnePole(); this.hpL = new OnePole(); this.hpR = new OnePole();
    this.fast = new Env(); this.slow = new Env();
    this.gin = 1; this.duck = 0; this.open = 0; this.lastHit = -10; this.lastDet = -10;
    this.e = 0; this.ref = 0; this.sealAt = -1; this.trim = 1; this.sc = 1; this.dryS = 1; this.wetS = 0; this.init = false; this.frozen = false;
  }
  reset() { this.fdn.clear(); for (const a of this.ap) a.clear(); this.pre.clear(); this.e = 0; this.trim = 1; }
  busy() { return this.frozen && this.e > 1e-12; }
  run(L, R, oL, oR, n, p) {
    const fz = p.freeze[0] > 0.5, cap = p.capture[0] > 0.5, frozen = fz || cap, fade = Math.max(0.01, p.fade[0]);
    if (!this.init) { this.init = true; this.sc = p.scale[0]; this.dryS = p.dry[0]; this.wetS = p.wet[0]; this.gin = frozen ? 0 : 1; }
    this.frozen = frozen;
    this.sc += (1 - Math.exp(-n / (0.08 * sampleRate))) * (p.scale[0] - this.sc);
    const f = this.fdn, dampHz = p.damp[0];
    f.g = this.g0;
    f.set(this.sc, frozen ? Infinity : p.t60[0], frozen ? sampleRate : dampHz, p.mod[0], p.modHz[0]);
    for (let i = 0; i < 8; i++) { if (frozen) this.g0[i] = this.trim; this.gD[i] = Math.pow(10, (-3 * f.len[i]) / (fade * sampleRate)); }
    const hs = this.hits(n);
    if (hs.length) this.lastHit = currentTime;
    const det = cap && !this.q.length && currentTime - this.lastHit > 2;
    const preN = this.preN, winN = Math.round(clampv(p.win[0], 0.05, 0.4) * sampleRate);
    const aFade = 1 - coefT(fade / 3), aOpen = 1 - coefT(0.003), aClose = 1 - coefT(0.02);
    const aLp = coefHz(frozen ? dampHz : 18000), aHp = coefHz(30), aOut = coefHz(15), as = 1 - coefT(0.02);
    const fA = coefT(0.0005), fR = coefT(0.01), sA = coefT(0.03), sR = coefT(0.3);
    const tD = p.dry[0], tW = p.wet[0], l0 = this.apL[0], l1 = this.apL[1], l2 = this.apL[2];
    let hi = 0, e = 0;
    for (let i = 0; i < n; i++) {
      const x = 0.5 * (L[i] + R[i]);
      let start = false;
      while (hi < hs.length && hs[hi][0] <= i) { hi++; start = true; }
      if (det) {
        const fe = this.fast.run(x, fA, fR), se = this.slow.run(x, sA, sR), t = currentTime + i / sampleRate;
        if (fe > 2 * se + 0.01 && t - this.lastDet > 0.1) { this.lastDet = t; start = true; }
      }
      if (start && cap) { this.duck = preN; this.open = preN + winN; }
      const tgt = !frozen ? 1 : this.open > 0 && this.duck <= 0 ? 1 : 0;
      this.gin += (!cap ? aFade : tgt > this.gin ? aOpen : aClose) * (tgt - this.gin);
      if (tgt === 0 && this.gin < 1e-4) this.gin = 0;
      if (this.open > 0) this.open--;
      if (this.duck > 0) { this.duck--; f.g = this.gD; } else f.g = this.g0;
      let s = this.hpIn.hp(x, aHp);
      s = this.lp2.lp(this.lp1.lp(s, aLp), aLp);
      s = this.ap[2].run(this.ap[1].run(this.ap[0].run(s, l0, 0.62), l1, 0.62), l2, 0.55);
      const d = this.pre.read(preN);
      this.pre.write(s);
      const tin = soft(d * this.gin);
      f.run(tin, tin);
      const wl = this.hpL.hp(f.l, aOut), wr = this.hpR.hp(f.r, aOut);
      e += wl * wl + wr * wr;
      this.dryS += as * (tD - this.dryS); this.wetS += as * (tW - this.wetS);
      oL[i] = lim(this.dryS * L[i] + this.wetS * wl);
      oR[i] = lim(this.dryS * R[i] + this.wetS * wr);
    }
    f.g = this.g0;
    this.e += (1 - Math.exp(-n / (0.15 * sampleRate))) * (e / n - this.e);
    // guard: once sealed (frozen, input shut), the tank may never get louder than it settled at
    const sealed = frozen && this.open <= 0 && this.duck <= 0 && this.gin === 0;
    if (!sealed) { this.sealAt = -1; this.trim = 1; }
    else {
      if (this.sealAt < 0) { this.sealAt = currentTime; this.ref = 0; }
      if (currentTime - this.sealAt < 0.3) this.ref = Math.max(this.ref, this.e);
      else if (this.e > this.ref * 1.12) this.trim = Math.max(0.97, this.trim * 0.9995);
      else if (this.trim < 1) this.trim = Math.min(1, this.trim * 1.0002);
    }
  }
}
registerProcessor("kdfx-infinite-verb", InfVerb);
`,
    },
    create(ctx, env) {
      return workletInstance(ctx, env, "kdfx-infinite-verb", (s, P) => {
        const a = clamp(s.amount || 0), size = expo(s.x, 0.3, 2);
        P("scale", size);
        P("t60", expo(s.x, 4, 40) * (0.3 + 0.7 * a));
        const dmp = dv(s, "damp", 0.3);
        P("damp", dmp < 0.02 ? 24000 : expo(dmp, 16000, 600));
        P("mod", clamp(s.y) * 0.002 * ctx.sampleRate * (0.4 + 0.6 * a)); // the tank wobbles 0..2x this: up to 4 ms
        P("modHz", expo(s.y, 0.15, 1.2));
        P("fade", expo(dv(s, "fade", 0.3), 0.01, 6));
        P("freeze", tv(s, "freeze", false) ? 1 : 0);
        P("capture", tv(s, "capture", false) ? 1 : 0);
        P("win", 0.12 + 0.13 * clamp((size - 0.3) / 1.7));
        P("dry", 1 - 0.6 * a);
        P("wet", IV_WET * a * (tv(s, "capture", false) ? 0.7 : 1)); // a captured hit holds all its energy: sit it lower
      });
    },
  });
})();
