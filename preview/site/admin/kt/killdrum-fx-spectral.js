// KILLDRUM FX, group 3: SPECTRAL & FILTER (11-15) and DYNAMICS & MOVEMENT (20-23) from Eman's
// DRUM_PORTAL_SPEC_V1. Each effect registers with KdFx (ui/killdrum-fx-core.js; interface in
// /mnt/project-files/killdrum/FX-MODULE.md) and runs one instance per drum voice.
//
// For the FX tab (all optional):
// - instance.latency (seconds): the STFT effects (FFT size) and TRANSIENT (lookahead) lag the
//   input; their wet is aligned inside (at amount 0 it is the input delayed by `latency`), so a
//   DelayNode(latency) on that dot's dry path removes the flam at mid wet. Read it after set().
// - PUMP's KEY FROM KICK listens to K.onKick(fn) -> unsubscribe, fn({ at, gain, note, beat }) once
//   per kick hit of the pass, ahead of time. Without K.onKick it ducks on the beat grid.
// - GATE SEQUENCER: with PATTERN EDIT on, set(s) can carry s.pattern (16 x 0/1); the descriptor has
//   patternSteps: 16 and patternOf(toggles) -> the named pattern, for the 16-step grid.
// Test: node tests/killdrum-fx/render-test.js (renders every preset offline in headless Chromium).
(function () {
  "use strict";
  const K = window.KdFx;
  if (!K || !K.register) return;

  // ---------------------------------------------------------------- shared by this file's effects
  // (The whole file is one IIFE: `K` = window.KdFx; FFT_SRC, COMMON_SRC and SP are seen by every
  // effect below.)

  // Worklet side, pasted in front of a processor's source: a radix-2 FFT, a streaming STFT
  // (overlap-add, hop = n/4, Hann in and out, so an untouched spectrum comes back exactly),
  // and small helpers. Worklet sources can't see this file's scope, so they get it as text.
  const FFT_SRC = `
  class KdFFT {
    constructor(n) {
      this.n = n; let lg = 0; while ((1 << lg) < n) lg++;
      this.rev = new Uint32Array(n);
      for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < lg; b++) r |= ((i >> b) & 1) << (lg - 1 - b); this.rev[i] = r; }
      this.c = new Float64Array(n >> 1); this.s = new Float64Array(n >> 1);
      for (let i = 0; i < n >> 1; i++) { this.c[i] = Math.cos((2 * Math.PI * i) / n); this.s[i] = Math.sin((2 * Math.PI * i) / n); }
    }
    // in place on re/im (length n); inv = true is the inverse, scaled by 1/n
    run(re, im, inv) {
      const n = this.n, rev = this.rev, C = this.c, S = this.s;
      for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let i = 0; i < n; i += size) for (let j = 0, k = 0; j < half; j++, k += step) {
          const c = C[k], s = inv ? S[k] : -S[k], a = i + j, b = a + half;
          const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
      if (inv) { const g = 1 / n; for (let i = 0; i < n; i++) { re[i] *= g; im[i] *= g; } }
    }
  }
  // Streaming STFT for 1-2 channels. Call process(inCh, outCh, dryCh, len) once per block:
  // inCh = input channel arrays (may be empty = silence), outCh = 2 output arrays to WRITE,
  // dryCh = 2 arrays that get the input delayed by the same latency (for an aligned blend).
  // onFrame(re, im, nch) edits the spectra (re[ch], im[ch]: Float64Array(n), bins 0..n/2 used;
  // keep bins n/2+1.. as the mirror (conjugate) or call KdStft.mirror(re, im, n) after editing).
  // Latency = n samples (this.latency): the output (and dryCh) lag the input by one frame.
  class KdStft {
    constructor(n, onFrame) {
      this.n = n; this.hop = n >> 2; this.latency = n; this.onFrame = onFrame;
      this.fft = new KdFFT(n); this.win = new Float64Array(n);
      for (let i = 0; i < n; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
      this.inF = [new Float64Array(n), new Float64Array(n)];
      this.outF = [new Float64Array(n), new Float64Array(n)];
      this.acc = [new Float64Array(2 * n), new Float64Array(2 * n)];
      this.re = [new Float64Array(n), new Float64Array(n)]; this.im = [new Float64Array(n), new Float64Array(n)];
      this.dry = [new Float64Array(n), new Float64Array(n)]; this.di = 0;
      this.rover = n - this.hop; this.nch = 1;
    }
    static mirror(re, im, n) { for (let k = 1; k < n >> 1; k++) { re[n - k] = re[k]; im[n - k] = -im[k]; } im[0] = 0; im[n >> 1] = 0; }
    process(inCh, outCh, dryCh, len) {
      if (inCh.length > 1) this.nch = 2;
      const n = this.n, hop = this.hop, lat = n - hop, nch = this.nch, norm = 1 / 1.5, di = this.di;
      for (let i = 0; i < len; i++) {
        const r = this.rover, j = (di + i) % n;
        for (let ch = 0; ch < nch; ch++) {
          const src = inCh[ch] || inCh[0], x = src ? src[i] : 0;
          this.inF[ch][r] = x;
          const o = this.outF[ch][r - lat], d = this.dry[ch][j];
          this.dry[ch][j] = x;
          outCh[ch][i] = o; if (dryCh) dryCh[ch][i] = d;
          if (nch === 1) { outCh[1][i] = o; if (dryCh) dryCh[1][i] = d; }
        }
        this.rover = r + 1;
        if (this.rover >= n) {
          this.rover = lat;
          for (let ch = 0; ch < nch; ch++) {
            const re = this.re[ch], im = this.im[ch], w = this.win, x = this.inF[ch];
            for (let k = 0; k < n; k++) { re[k] = x[k] * w[k]; im[k] = 0; }
            this.fft.run(re, im, false);
          }
          this.onFrame(this.re, this.im, nch);
          for (let ch = 0; ch < nch; ch++) {
            const re = this.re[ch], im = this.im[ch], w = this.win, acc = this.acc[ch], x = this.inF[ch], of = this.outF[ch];
            this.fft.run(re, im, true);
            for (let k = 0; k < n; k++) acc[k] += re[k] * w[k] * norm;
            for (let k = 0; k < hop; k++) of[k] = acc[k];
            acc.copyWithin(0, hop, 2 * n); acc.fill(0, 2 * n - hop);
            x.copyWithin(0, hop, n);
          }
        }
      }
      this.di = (di + len) % n;
    }
  }
  `;

  // Worklet side helpers every processor here can paste in (seeded random, song clock, hit pulses).
  const COMMON_SRC = `
  function kdRng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function kdHash(a, b, c) { let h = 2166136261 ^ (a | 0); h = Math.imul(h, 16777619) ^ (b | 0); h = Math.imul(h, 16777619) ^ (c | 0); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; }
  // processorOptions.clock = { t0, b0 }: the song beat at audio time t is b0 + (t - t0) * bpm / 60
  function kdBeat(clock, t, bpm) { return clock.b0 + (t - clock.t0) * bpm / 60; }
  // one-pole smoothing coefficient for a time constant in seconds
  function kdCoef(sec) { return sec <= 0 ? 0 : Math.exp(-1 / (sec * sampleRate)); }
  // a-rate "trig" param: > 0 for a few ms at each hit (the value = the hit's gain). Edge detector:
  // returns the hit's gain on the first sample of a pulse, else 0.
  class KdTrig { constructor() { this.last = 0; } step(v) { const hit = v > 0 && this.last <= 0 ? v : 0; this.last = v; return hit; } }
  `;

  // Main thread helpers.
  const SP = {
    db: (d) => Math.pow(10, d / 20),
    lerp: (a, b, t) => a + (b - a) * t,
    // exponential blend, for frequencies and times (a, b > 0)
    elerp: (a, b, t) => a * Math.pow(b / a, t),
    // the dot as a disc position: u, v -1..1 (v up), r = distance from the centre 0..1
    disc(x, y) { const d = K.xyToDisc(x, y); return { u: d.u, v: d.v, r: Math.min(1, Math.hypot(d.u, d.v)) }; },
    // STRENGTH as the host folded it into amount (1 at the centre, where it can't be told)
    strength(x, y, amount) { const r = SP.disc(x, y).r; return r > 1e-4 ? K.clamp(amount / r, 0, 2) : 1; },
    // song clock for a worklet: { t0, b0 } so beat(t) = b0 + (t - t0) * bpm / 60. When not playing
    // (beatAt -> null) the clock runs from audio time 0, so it is still steady.
    clock(ctx, env) {
      const t0 = ctx.currentTime, b = env && typeof env.beatAt === "function" ? env.beatAt(t0) : null;
      return { t0, b0: b != null && isFinite(b) ? b : (t0 * ((env && env.bpm) || 120)) / 60 };
    },
    // a stereo-out worklet node (1 input). params = { name: initial value }.
    node(ctx, name, params, processorOptions) {
      return new AudioWorkletNode(ctx, name, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], parameterData: params || {}, processorOptions: processorOptions || {} });
    },
    // set() helper: the first call jumps straight to the value (so the first hit already sounds
    // right), later calls glide (KdFx.ramp). const put = SP.setter(ctx); put(node.frequency, 800);
    setter(ctx) {
      const seen = new WeakSet();
      return (param, v, tc = 0.02) => {
        if (!param || !isFinite(v)) return;
        if (!seen.has(param)) { seen.add(param); param.cancelScheduledValues(0); param.setValueAtTime(v, ctx.currentTime); param.value = v; return; }
        K.ramp(param, v, ctx, tc);
      };
    },
    // a hit pulse on an a-rate "trig" param at audio time `at` (value = gain, > 0), 4 ms long
    pulse(param, at, gain = 1) {
      if (!param || !isFinite(at)) return;
      const g = Math.max(1e-3, gain || 1);
      param.setValueAtTime(g, Math.max(0, at));
      param.setValueAtTime(0, Math.max(0, at) + 0.004);
    },
    // an instance that just passes the sound (a worklet that isn't loaded yet)
    passthrough(ctx) { const g = ctx.createGain(); return { input: g, output: g, latency: 0, set() {}, destroy() { try { g.disconnect(); } catch (e) { /* gone */ } } }; },
    // stop a worklet node for good (its process() returns false after "bye")
    bye(node) { try { node.port.postMessage("bye"); } catch (e) { /* gone */ } try { node.disconnect(); } catch (e) { /* gone */ } },
    off(...nodes) { for (const n of nodes) if (n) try { n.disconnect(); } catch (e) { /* gone */ } },
  };
  // for effect files loaded after this one (ui/killdrum-fx-more.js): the worklet FFT/STFT and helpers
  K.shared = { FFT_SRC, COMMON_SRC, SP };

  // 13 - FORMANT: makes drums talk. Five parallel band-passes (TPT state-variable filters, steady
  // under fast moves) tuned to vowel formant tables and morphed A-E-I-O-U along X, shifted by Y.
  // A soft-saturated copy of the hit feeds the bank so tonal drums (kick, perc) have harmonics to
  // shape; an auto makeup keeps the level near the input and the sub stays under the formants.
  (function () {
    const NAME = "kdfx-formant";
    // [set][vowel A E I O U] = [F1..F5 Hz], [gain dB], [bandwidth Hz]. MALE = tenor and FEMALE =
    // soprano (the classic singing tables); CREATURE = made up: wider vowel contrast, stacked
    // metallic upper formants, flatter gains, narrower bands.
    const T = [
      [[[650, 1080, 2650, 2900, 3250], [0, -6, -7, -8, -22], [80, 90, 120, 130, 140]],
        [[400, 1700, 2600, 3200, 3580], [0, -14, -12, -14, -20], [70, 80, 100, 120, 120]],
        [[290, 1870, 2800, 3250, 3540], [0, -15, -18, -20, -30], [40, 90, 100, 120, 120]],
        [[400, 800, 2600, 2800, 3000], [0, -10, -12, -12, -26], [40, 80, 100, 120, 120]],
        [[350, 600, 2700, 2900, 3300], [0, -20, -17, -14, -26], [40, 60, 100, 120, 120]]],
      [[[800, 1150, 2900, 3900, 4950], [0, -6, -32, -20, -50], [80, 90, 120, 130, 140]],
        [[350, 2000, 2800, 3600, 4950], [0, -20, -15, -40, -56], [60, 100, 120, 150, 200]],
        [[270, 2140, 2950, 3900, 4950], [0, -12, -26, -26, -44], [60, 90, 100, 120, 120]],
        [[450, 800, 2830, 3800, 4950], [0, -11, -22, -22, -50], [40, 80, 100, 120, 120]],
        [[325, 700, 2700, 3800, 4950], [0, -16, -35, -40, -60], [50, 60, 170, 180, 200]]],
      [[[520, 1150, 1850, 2950, 4300], [0, -2, -5, -8, -10], [40, 45, 55, 70, 90]],
        [[320, 2100, 3350, 4700, 6400], [0, -4, -6, -9, -12], [35, 50, 60, 75, 95]],
        [[220, 2500, 4000, 5600, 7600], [0, -5, -6, -9, -12], [30, 45, 60, 75, 95]],
        [[330, 620, 1650, 2650, 3900], [0, -2, -7, -9, -11], [30, 35, 50, 65, 85]],
        [[260, 480, 1300, 2300, 3500], [0, -4, -8, -10, -12], [25, 30, 45, 60, 80]]],
    ];
    const DBK = 0.6;                                   // table gains x0.6 in dB: upper formants a bit louder on drums
    const bwOf = (res) => SP.elerp(2.5, 0.25, res);    // RESONANCE: bandwidths x2.5 (soft) .. x0.25 (whistle)
    // LFO RATE: 0 = off; lower part GLIDE (each hit slides from the X vowel to the one three steps
    // on, A to O, over that note); upper part STEP (the vowel steps through a beat-locked pattern)
    const GLIDES = [[2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"]];
    const STEPS = [[8, "2 bars"], [4, "1 bar"], [2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"], [0.125, "1/32"]];
    const lfoOf = (v) => {
      v = K.clamp(v || 0);
      if (v < 0.05) return { mode: 0, len: 1, label: "OFF" };
      if (v < 0.45) { const g = GLIDES[Math.min(3, Math.floor((v - 0.05) / 0.1))]; return { mode: 1, len: g[0], label: "GLIDE " + g[1] }; }
      const s = STEPS[Math.min(6, Math.floor((v - 0.45) / (0.55 / 7)))];
      return { mode: 2, len: s[0], label: "STEP " + s[1] };
    };
    // the dot and dials as settings: x = vowel, y = shift (x0.5 .. x2, scaled by amount), amount = mix
    const map = (s) => {
      const a = K.clamp(s.amount || 0), d = s.dials || {}, t = s.toggles || {};
      return {
        x: K.clamp(s.x != null ? s.x : 0.5), mix: 1 - (1 - a) * (1 - a),
        shift: SP.elerp(1, Math.pow(2, 2 * K.clamp(s.y != null ? s.y : 0.5) - 1), a),
        res: K.clamp(d.res != null ? d.res : 0.5), set: Math.max(0, Math.min(2, Math.round(Number(t.set) || 0))), lfo: lfoOf(d.lfo),
      };
    };
    // per voice: how much of the saturated copy feeds the bank, and a first guess at the makeup
    const EXC = { kick: 0.85, perc: 0.7, snare: 0.35, clap: 0.2, hats: 0.2 };

    const SRC = COMMON_SRC + `
    const FT = ${JSON.stringify(T)}, DBK = ${DBK};
    const PATH = [-1, 0, -0.5, 0.5, 1, 0, 0.5, -0.5];   // STEP pattern around X (at the centre: A I E O U I O E)
    const CB = 16;                                      // coefficients update every 16 samples
    function refl(p) { for (let k = 0; k < 3; k++) { if (p < 0) p = -p; if (p > 4) p = 8 - p; } return p < 0 ? 0 : p > 4 ? 4 : p; }
    function sat(z) { return z > 3 ? 1 : z < -3 ? -1 : (z * (27 + z * z)) / (27 + 9 * z * z); }   // cheap tanh
    registerProcessor("${NAME}", class extends AudioWorkletProcessor {
      static get parameterDescriptors() {
        const k = (name, defaultValue, minValue, maxValue) => ({ name, defaultValue, minValue, maxValue, automationRate: "k-rate" });
        return [k("vowel", 0.5, 0, 1), k("shift", 1, 0.25, 4), k("res", 0.5, 0, 1), k("mix", 0, 0, 1), k("set", 0, 0, 2),
          k("mode", 0, 0, 2), k("len", 1, 0.03, 16), k("bpm", 120, 20, 400),
          { name: "trig", defaultValue: 0, minValue: 0, maxValue: 16, automationRate: "a-rate" }];
      }
      constructor(o) {
        super();
        const p = (o && o.processorOptions) || {};
        this.clock = p.clock || { t0: 0, b0: 0 }; this.exc = p.exc != null ? p.exc : 0.5;
        this.alive = true; this.port.onmessage = (e) => { if (e.data === "bye") this.alive = false; };
        // tables as log f, dB, log bw at [set * 25 + vowel * 5 + formant]
        this.tf = new Float64Array(75); this.td = new Float64Array(75); this.tb = new Float64Array(75);
        for (let s = 0; s < 3; s++) for (let v = 0; v < 5; v++) for (let j = 0; j < 5; j++) {
          const i = s * 25 + v * 5 + j;
          this.tf[i] = Math.log(FT[s][v][0][j]); this.td[i] = FT[s][v][1][j] * DBK; this.tb[i] = Math.log(FT[s][v][2][j]);
        }
        this.vA = new Float64Array(15); this.vB = new Float64Array(15);
        this.lf = new Float64Array(5); this.ld = new Float64Array(5); this.lb = new Float64Array(5);   // smoothed targets
        this.a1 = new Float64Array(5); this.a2 = new Float64Array(5); this.a3 = new Float64Array(5); this.amp = new Float64Array(5);
        this.s1 = [new Float64Array(5), new Float64Array(5)]; this.s2 = [new Float64Array(5), new Float64Array(5)];
        this.q1 = [0, 0]; this.q2 = [0, 0];               // the sub kept under the formants (2-pole low-pass, 110 Hz)
        const g = Math.tan((Math.PI * 110) / sampleRate); this.la1 = 1 / (1 + g * (g + 1.4)); this.la2 = g * this.la1; this.la3 = g * this.la2;
        this.trig = new KdTrig(); this.gt = 1e9; this.snap = true; this.init = false;
        this.env = 0; this.pf = 0; this.pIn = 0; this.pB = 0; this.lg = Math.log(5);
        this.cEnv = kdCoef(0.04); this.cLag = 1 - kdCoef(0.004); this.cP = 1 - kdCoef(0.12); this.cMix = 1 - kdCoef(0.02);
        const blk = (sec) => 1 - Math.exp(-CB / (sec * sampleRate));
        this.cCtl = blk(0.015); this.cTgt = blk(0.003); this.cG = blk(0.04);
      }
      // formant targets at chain position p (0 = A .. 4 = U) of set s: out = [log f x5, dB x5, log bw x5]
      vowel(s, p, out) {
        const i = Math.min(3, Math.floor(p)), f = p - i, b = s * 25 + i * 5, tf = this.tf, td = this.td, tb = this.tb;
        for (let j = 0; j < 5; j++) {
          const a = b + j, c = a + 5;
          out[j] = tf[a] + (tf[c] - tf[a]) * f; out[5 + j] = td[a] + (td[c] - td[a]) * f; out[10 + j] = tb[a] + (tb[c] - tb[a]) * f;
        }
      }
      tick(t, set, mode, len, bpm, vowelT, shiftT, resT) {
        const c = this.cCtl;
        this.vw += (vowelT - this.vw) * c; this.sh += (shiftT - this.sh) * c; this.rs += (resT - this.rs) * c;
        const ctr = this.vw * 4;
        let pa = ctr, pb = ctr, w = 0;
        if (mode === 2) {          // STEP: the vowel for each beat-locked step (9 ms early, so it is in place at the hit)
          const k = Math.floor(kdBeat(this.clock, t + 0.009, bpm) / len);
          pa = refl(ctr + 2 * PATH[((k % 8) + 8) % 8]);
        } else if (mode === 1) {   // GLIDE: from the X vowel to three steps on, eased, over the note after each hit
          const u = Math.max(0, Math.min(1, this.gt / (((len * 60) / bpm) * sampleRate)));
          pb = refl(ctr + 3); w = 1 - (1 - u) * (1 - u);
        }
        const A = this.vA, B = this.vB;
        this.vowel(set, pa, A); if (w > 0) this.vowel(set, pb, B);
        const lbw = Math.log(2.5) + Math.log(0.1) * this.rs, ct = this.snap ? 1 : this.cTgt, nyq = 0.45 * sampleRate;
        this.snap = false;
        for (let j = 0; j < 5; j++) {
          let f = A[j], d = A[5 + j], b = A[10 + j];
          if (w > 0) { f += (B[j] - f) * w; d += (B[5 + j] - d) * w; b += (B[10 + j] - b) * w; }
          this.lf[j] += (f + this.sh - this.lf[j]) * ct; this.ld[j] += (d - this.ld[j]) * ct; this.lb[j] += (b + this.sh + lbw - this.lb[j]) * ct;
          const fr = Math.min(nyq, Math.max(30, Math.exp(this.lf[j]))), kq = Math.min(1.4, Math.max(0.0125, Math.exp(this.lb[j]) / fr));
          const g = Math.tan((Math.PI * fr) / sampleRate), a1 = 1 / (1 + g * (g + kq));
          this.a1[j] = a1; this.a2[j] = g * a1; this.a3[j] = g * g * a1;
          this.amp[j] = (j & 1 ? -kq : kq) * Math.pow(10, this.ld[j] / 20);   // unit-peak band-pass, alternate signs (no deep notches between formants)
        }
        // auto makeup: the bank's level matched to the input's (only while there is sound, so it holds through silences)
        if (this.pIn > 1e-10) {
          const gT = Math.min(40, Math.max(0.5, Math.sqrt((this.pIn + 1e-14) / (this.pB + 1e-14))));
          this.lg += (Math.log(gT) - this.lg) * this.cG;
        }
        // flush tiny values (denormals) after long silences
        for (let ch = 0; ch < 2; ch++) {
          const s1 = this.s1[ch], s2 = this.s2[ch];
          for (let j = 0; j < 5; j++) { if (Math.abs(s1[j]) < 1e-15) s1[j] = 0; if (Math.abs(s2[j]) < 1e-15) s2[j] = 0; }
          if (Math.abs(this.q1[ch]) < 1e-15) this.q1[ch] = 0; if (Math.abs(this.q2[ch]) < 1e-15) this.q2[ch] = 0;
        }
        if (this.env < 1e-20) this.env = 0; if (this.pf < 1e-30) this.pf = 0; if (this.pIn < 1e-30) this.pIn = 0; if (this.pB < 1e-30) this.pB = 0;
      }
      process(inputs, outputs, P) {
        const inp = inputs[0] || [], out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length;
        const x0 = inp[0] || null, x1 = inp.length > 1 ? inp[1] : null, nch = x1 ? 2 : 1;
        const set = Math.max(0, Math.min(2, Math.round(P.set[0]))), mode = Math.round(P.mode[0]), len = Math.max(0.03, P.len[0]), bpm = Math.max(20, P.bpm[0]);
        const vowelT = P.vowel[0], shiftT = Math.log(Math.max(0.25, P.shift[0])), resT = P.res[0], mixT = P.mix[0], tr = P.trig;
        if (!this.init) { this.init = true; this.vw = vowelT; this.sh = shiftT; this.rs = resT; this.mx = mixT; }
        const exc = this.exc, cEnv = this.cEnv, cLag = this.cLag, cP = this.cP, cMix = this.cMix, la1 = this.la1, la2 = this.la2, la3 = this.la3;
        const a1 = this.a1, a2 = this.a2, a3 = this.a3, amp = this.amp, q1 = this.q1, q2 = this.q2;
        for (let b0 = 0; b0 < n; b0 += CB) {
          const b1 = Math.min(n, b0 + CB);
          for (let i = b0; i < b1; i++) if (this.trig.step(tr.length > 1 ? tr[i] : tr[0]) > 0 && mode === 1) { this.gt = b0 - i; this.snap = true; }
          this.tick(currentTime + b0 / sampleRate, set, mode, len, bpm, vowelT, shiftT, resT);
          const G = Math.exp(this.lg);
          for (let i = b0; i < b1; i++) {
            const xa = x0 ? x0[i] : 0, xb = x1 ? x1[i] : xa, xm = nch > 1 ? 0.5 * (xa + xb) : xa, ax = xm < 0 ? -xm : xm;
            this.env = ax > this.env ? ax : this.env * cEnv;
            const m = this.env + 0.002, dm = 6 / m;
            this.mx += (mixT - this.mx) * cMix;
            const mx = this.mx;
            let ym = 0;
            for (let ch = 0; ch < nch; ch++) {
              const x = ch ? xb : xa, s1 = this.s1[ch], s2 = this.s2[ch];
              const u = x + exc * (m * sat(x * dm) - x);    // part of the hit through a level-following soft clip
              let y = 0;
              for (let j = 0; j < 5; j++) {
                const v3 = u - s2[j], v1 = a1[j] * s1[j] + a2[j] * v3, v2 = s2[j] + a2[j] * s1[j] + a3[j] * v3;
                s1[j] = 2 * v1 - s1[j]; s2[j] = 2 * v2 - s2[j]; y += amp[j] * v1;
              }
              const w3 = x - q2[ch], w1 = la1 * q1[ch] + la2 * w3, w2 = q2[ch] + la2 * q1[ch] + la3 * w3;
              q1[ch] = 2 * w1 - q1[ch]; q2[ch] = 2 * w2 - q2[ch];
              ym = ch ? 0.5 * (ym + y) : y;
              let F = y * G + 0.5 * w2;                       // formants (made up to the input level) + half the sub
              const aF = F < 0 ? -F : F;
              if (aF > 1.2) F = (F < 0 ? -1 : 1) * (1.2 + 0.6 * Math.tanh((aF - 1.2) / 0.6));
              const o = x + mx * (F - x);
              if (ch) R[i] = o; else L[i] = o;
            }
            if (nch === 1) R[i] = L[i];
            this.pf += (xm * xm - this.pf) * cLag;            // input level, lagged like the bank's build-up
            this.pIn += (this.pf - this.pIn) * cP; this.pB += (ym * ym - this.pB) * cP;
          }
          if ((this.gt += b1 - b0) > 1e9) this.gt = 1e9;
        }
        return this.alive;
      }
    });`;

    // without the worklet: the five band-passes at the X vowel (no LFO), mixed with the dry
    const vowelAt = (set, p) => {
      const V = T[set], i = Math.min(3, Math.floor(p)), fr = p - i, f = [], d = [], b = [];
      for (let j = 0; j < 5; j++) {
        f.push(SP.elerp(V[i][0][j], V[i + 1][0][j], fr)); d.push(SP.lerp(V[i][1][j], V[i + 1][1][j], fr)); b.push(SP.elerp(V[i][2][j], V[i + 1][2][j], fr));
      }
      return { f, d, b };
    };
    function nativeFormant(ctx) {
      const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), low = ctx.createBiquadFilter(), lowG = ctx.createGain();
      input.connect(dry); dry.connect(output); wet.connect(output);
      low.type = "lowpass"; low.frequency.value = 110; low.Q.value = 0.7; lowG.gain.value = 0.5;
      input.connect(low); low.connect(lowG); lowG.connect(wet);
      const bands = [0, 1, 2, 3, 4].map(() => {
        const f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = "bandpass"; input.connect(f); f.connect(g); g.connect(wet);
        return { f, g };
      });
      const put = SP.setter(ctx);
      return {
        input, output, latency: 0,
        set(s) {
          const m = map(s), V = vowelAt(m.set, m.x * 4), bw = bwOf(m.res);
          bands.forEach((b, j) => {
            const fr = Math.min(0.45 * ctx.sampleRate, V.f[j] * m.shift);
            put(b.f.frequency, fr); put(b.f.Q, Math.min(80, Math.max(0.7, fr / (V.b[j] * m.shift * bw))));
            put(b.g.gain, (j & 1 ? -1 : 1) * SP.db(V.d[j] * DBK) * 6);
          });
          put(dry.gain, 1 - m.mix); put(wet.gain, m.mix);
        },
        destroy() { SP.off(input, dry, wet, low, lowG, output, ...bands.flatMap((b) => [b.f, b.g])); },
      };
    }

    K.register({
      id: "formant", num: 13, name: "FORMANT", group: "SPECTRAL & FILTER",
      caption: "Makes drums talk.",
      axes: { x: "VOWEL A-E-I-O-U", y: "FORMANT SHIFT" },
      dials: [
        { id: "res", name: "RESONANCE", def: 0.5, fmt: (v) => "Q " + Math.round(8 / bwOf(v)) },
        { id: "lfo", name: "LFO RATE", def: 0, fmt: (v) => lfoOf(v).label },
      ],
      toggles: [{ id: "set", name: "SET", options: ["MALE", "FEMALE", "CREATURE"], def: 0 }],
      presets: [
        // O vowel, shifted down ~11% for warmth, male set, no LFO
        { name: "Ooh Snare", voice: "snare", x: 0.75, y: 0.35, wet: 0.85, dials: { res: 0.45, lfo: 0 }, toggles: { set: 0 } },
        // STEP 1/16: a new vowel every 16th step (A I E O U I O E), female set shifted up ~x1.55
        { name: "Talking Hats", voice: "hats", x: 0.5, y: 0.9, wet: 0.8, dials: { res: 0.55, lfo: 0.88 }, toggles: { set: 1 } },
        // GLIDE 1/4: each kick starts on A and slides to O over a quarter note
        { name: "Yawn Kick", voice: "kick", x: 0, y: 0.4, wet: 0.7, dials: { res: 0.6, lfo: 0.2 }, toggles: { set: 0 } },
        // creature set, formants down ~x0.55, narrow, vowel steps every 8th
        { name: "Creature", voice: "perc", x: 0.9, y: 0.05, wet: 0.9, dials: { res: 0.8, lfo: 0.8 }, toggles: { set: 2 } },
      ],
      worklets: { [NAME]: SRC },
      create(ctx, env) {
        if (!K.hasWorklet(ctx, NAME)) return nativeFormant(ctx);
        const kind = (env && env.kind) || "snare";
        const node = SP.node(ctx, NAME, { vowel: 0.5, shift: 1, res: 0.5, mix: 0, set: 0, mode: 0, len: 1, bpm: (env && env.bpm) || 120 },
          { clock: SP.clock(ctx, env), seed: env && env.seed, exc: EXC[kind] != null ? EXC[kind] : 0.5 });
        const P = (id) => node.parameters.get(id), put = SP.setter(ctx);
        const hard = (p, v) => { if (p && isFinite(v)) p.setValueAtTime(v, ctx.currentTime); };   // stepped settings jump
        return {
          input: node, output: node, latency: 0,
          set(s) {
            const m = map(s);
            put(P("vowel"), m.x); put(P("shift"), m.shift); put(P("res"), m.res); put(P("mix"), m.mix);
            hard(P("set"), m.set); hard(P("mode"), m.lfo.mode); hard(P("len"), m.lfo.len); hard(P("bpm"), s.bpm || 120);
          },
          trigger(hit) { if (hit) SP.pulse(P("trig"), hit.at, hit.gain); },
          destroy() { SP.bye(node); },
        };
      },
    });
  })();

  // 14 - ACID FILTER: a resonant zero-delay state-variable filter (LP / BP / HP / NOTCH) with soft
  // drive in front and a soft limit inside the resonance (set by the input's own level), so it
  // squelches but never blows up. The cutoff can follow each hit's envelope (303 squelch), step
  // through a seeded 2-bar pattern on the 1/16 grid, or sweep open over 2/4/8 bars (a build-up),
  // all locked to the song beat.
  (function () {
    const NAME = "kdfx-acid-filter";
    const LO = 40, HI = 18000;                          // X: cutoff target range (Hz)
    const MODES = ["LP", "BP", "HP", "NOTCH"];
    const modeOf = (v) => Math.min(3, Math.floor(K.clamp(v) * 4));
    const cutOf = (x) => SP.elerp(LO, HI, K.clamp(x));
    // how far the output moves from dry at this amount (LP/HP also blend the cutoff, so they get there sooner)
    const wetOf = (m, a) => Math.min(1, a * (m === 1 || m === 3 ? 1.25 : 5));
    const qOf = (r) => 0.6 * Math.pow(50 / 0.6, r);   // resonance 0..1 -> Q 0.6..50 (just under self-oscillation)

    const SRC = COMMON_SRC + `
    const NLP = 20000, NHP = 20, QLO = 0.6, QHI = 50, BARS = [0, 2, 4, 8];
    const RC = 0.4, BPX = 0.6;                          // LP/HP passband trim at full resonance, BP makeup (Q^BPX)
    registerProcessor("${NAME}", class extends AudioWorkletProcessor {
      static get parameterDescriptors() {
        const k = (name, defaultValue, minValue, maxValue) => ({ name, defaultValue, minValue, maxValue, automationRate: "k-rate" });
        return [k("amount", 0, 0, 1), k("cut", 850, 10, 22000), k("res", 0, 0, 1), k("env", 0.5, 0, 1), k("mode", 0, 0, 3),
          k("follow", 0, 0, 1), k("step", 0, 0, 1), k("sweep", 0, 0, 3), k("bpm", 120, 20, 400)];
      }
      constructor(o) {
        super();
        const po = (o && o.processorOptions) || {};
        this.clock = po.clock || { t0: 0, b0: 0 };
        this.alive = true; this.port.onmessage = (e) => { if (e.data === "bye") this.alive = false; };
        this.s1 = new Float64Array(2); this.s2 = new Float64Array(2);   // filter state per channel
        this.first = true; this.lc = 0; this.k = 1; this.w = 0; this.a = 0; this.t = new Float64Array(4);
        this.ef = 0; this.pe = 0; this.hc = 0; this.pk = 0; this.mo = 0;   // follower, its slow peak, hold; slow input peak; step/sweep offset (oct)
        // the step pattern: 32 steps = 2 bars of 1/16. The 4 steps at the same spot of each half bar
        // (e.g. the 4 backbeats) get the levels -1, -1/3, 1/3, 1 in a seeded order (+ a small offset per
        // spot), so hits on the same beat position always get clearly different cutoffs.
        const r = kdRng(((po.seed | 0) + 1414) >>> 0); this.pat = new Float64Array(32);
        for (let ph = 0; ph < 8; ph++) {
          const lv = [-1, -1 / 3, 1 / 3, 1], off = (r() - 0.5) * 0.3;
          for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = lv[i]; lv[i] = lv[j]; lv[j] = t; }
          for (let s = 0; s < 4; s++) this.pat[ph + 8 * s] = Math.max(-1, Math.min(1, lv[s] + off));
        }
        this.cS = kdCoef(0.005); this.cG = kdCoef(0.003); this.cA = kdCoef(0.001); this.cR = kdCoef(0.15); this.cP = kdCoef(2); this.hold = Math.round(0.01 * sampleRate);
      }
      process(ins, outs, p) {
        const inp = ins[0] || [], out = outs[0], oL = out[0], oR = out[1] || out[0], n = oL.length;
        const iL = inp[0] || null, iR = inp[1] || null, nc = iR ? 2 : 1;
        const a = p.amount[0], mode = Math.max(0, Math.min(3, Math.round(p.mode[0]))), cut = p.cut[0], res = p.res[0];
        const depth = p.env[0], follow = p.follow[0] > 0.5, step = p.step[0] > 0.5, bars = BARS[Math.round(p.sweep[0])] || 0, bpm = p.bpm[0];
        // this block's targets: cutoff (log2 Hz, from neutral toward X by amount), damping, wet, output taps
        const r = res * a, kT = 1 / (QLO * Math.pow(QHI / QLO, r)), rc = 1 / (1 + RC * r), bpg = Math.pow(kT, 1 - BPX);
        const lcT = Math.log2(mode === 0 ? NLP * Math.pow(cut / NLP, a) : mode === 2 ? NHP * Math.pow(cut / NHP, a) : cut);
        const wT = Math.min(1, a * (mode === 1 || mode === 3 ? 1.25 : 5));
        const T0 = mode === 0 ? rc : 0, T1 = mode === 1 ? bpg : 0, T2 = mode === 2 ? rc : 0, T3 = mode === 3 ? 1 : 0;
        // resonance limit: the band state may ring up to ~2x (+6 dB) the input's recent peak at the output
        const tg = mode === 1 ? bpg : mode === 3 ? kT : 1;
        const t = this.t, init = this.first;
        if (this.first) { this.first = false; this.lc = lcT; this.k = kT; this.w = wT; this.a = a; t[0] = T0; t[1] = T1; t[2] = T2; t[3] = T3; }
        const cS = this.cS, cG = this.cG, cA = this.cA, cR = this.cR, cP = this.cP, s1 = this.s1, s2 = this.s2, pat = this.pat, clock = this.clock;
        const nyq = 0.45 * sampleRate, piSr = Math.PI / sampleRate, lead = (0.006 * bpm) / 60, useBeat = step || bars > 0, lk = 4 / tg;
        let lc = this.lc, k = this.k, w = this.w, as = this.a, t0 = t[0], t1 = t[1], t2 = t[2], t3 = t[3], ef = this.ef, pe = this.pe, hc = this.hc, pk = this.pk, mo = this.mo;
        const hold = this.hold;
        for (let i = 0; i < n; i++) {
          lc = lcT + (lc - lcT) * cS; k = kT + (k - kT) * cS; w = wT + (w - wT) * cS; as = a + (as - a) * cS;
          t0 = T0 + (t0 - T0) * cS; t1 = T1 + (t1 - T1) * cS; t2 = T2 + (t2 - T2) * cS; t3 = T3 + (t3 - T3) * cS;
          const xl = iL ? iL[i] : 0, xr = iR ? iR[i] : xl, lv = Math.max(xl < 0 ? -xl : xl, xr < 0 ? -xr : xr);
          pk = lv > pk ? lv : pk * cP;
          let oct = 0;
          if (follow) {                                  // 1 ms attack, 10 ms hold, 150 ms release, scaled by its own slow peak
            if (lv >= ef) { ef = lv + (ef - lv) * cA; hc = hold; } else if (hc > 0) hc--; else ef = lv + (ef - lv) * cR;
            pe = ef > pe ? ef : pe * cP;
            const f = ef / (pe > 0.02 ? pe : 0.02);
            oct += 5 * depth * as * f * f;
          }
          let m = 0;
          if (useBeat) {
            const b = kdBeat(clock, currentTime + i / sampleRate, bpm);
            if (step) { const s = Math.floor((b + lead) * 4) % 32; m += pat[s < 0 ? s + 32 : s] * 3 * depth * as; }
            if (bars) { const len = 4 * bars, ph = b / len - Math.floor(b / len); m -= 7 * as * (1 - ph); }
          }
          mo = init && i === 0 ? m : m + (mo - m) * cG; oct += mo;
          let fc = Math.pow(2, lc + oct);
          fc = fc < 16 ? 16 : fc > nyq ? nyq : fc;
          const g = Math.tan(fc * piSr), a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2, dr = 1 + 1.2 * as;
          const lim = lk * (pk > 0.03 ? pk : 0.03), il = 1 / lim;
          for (let c = 0; c < nc; c++) {
            const x = c ? xr : xl, v0 = Math.tanh(dr * x) / dr;
            const v3 = v0 - s2[c], v1 = a1 * s1[c] + a2 * v3, v2 = s2[c] + a2 * s1[c] + a3 * v3;
            s1[c] = lim * Math.tanh((2 * v1 - s1[c]) * il);  // soft-limited band state: the resonance squelches, never explodes
            s2[c] = 2 * v2 - s2[c];
            let y = t0 * v2 + t1 * v1 + t2 * (v0 - k * v1 - v2) + t3 * (v0 - k * v1);
            const ay = y < 0 ? -y : y;
            if (ay > 1) y = (y < 0 ? -1 : 1) * (1 + 0.8 * Math.tanh((ay - 1) * 1.25));   // peaks stay under 1.8
            const o = x + w * (y - x);
            if (c) oR[i] = o; else oL[i] = o;
          }
          if (nc === 1) oR[i] = oL[i];
        }
        for (let c = 0; c < 2; c++) { if (Math.abs(s1[c]) < 1e-20) s1[c] = 0; if (Math.abs(s2[c]) < 1e-20) s2[c] = 0; }
        this.lc = lc; this.k = k; this.w = w; this.a = as; t[0] = t0; t[1] = t1; t[2] = t2; t[3] = t3;
        this.ef = ef < 1e-20 ? 0 : ef; this.pe = pe < 1e-20 ? 0 : pe; this.hc = hc; this.pk = pk < 1e-20 ? 0 : pk; this.mo = Math.abs(mo) < 1e-20 ? 0 : mo;
        return this.alive;
      }
    });`;

    K.register({
      id: "acid-filter", num: 14, name: "ACID FILTER", group: "SPECTRAL & FILTER",
      caption: "The classic sweep on a drum bus.",
      axes: { x: "CUTOFF", y: "RESONANCE" },
      dials: [
        { id: "env", name: "ENV AMOUNT", def: 0.5, fmt: (v) => "+" + (K.clamp(v) * 5).toFixed(1) + " oct" },
        { id: "mode", name: "MODE", def: 0, fmt: (v) => MODES[modeOf(v)] },
      ],
      toggles: [
        { id: "follow", name: "ENV FOLLOW", def: false },
        { id: "step", name: "STEP SEQ MOD", def: false },
        { id: "sweep", name: "SWEEP", options: ["OFF", "2 BARS", "4 BARS", "8 BARS"], def: 0 },
      ],
      presets: [
        // LP ~140 Hz near self-oscillation; each kick throws it ~4 octaves up and it falls back: the 303 zap
        { name: "Squelch Kick", voice: "kick", x: 0.17, y: 0.96, wet: 0.9, dials: { env: 0.9, mode: 0.1 }, toggles: { follow: true, step: false, sweep: 0 } },
        // LP rising from ~160 Hz to ~12 kHz over 4 bars, then it starts again: a build-up on the whole kit
        { name: "Opening", voice: "all", sync: true, x: 0.92, y: 0.75, wet: 1, dials: { env: 0, mode: 0.1 }, toggles: { follow: false, step: false, sweep: 2 } },
        // narrow band-pass around 7.5 kHz: a thin, glassy tick
        { name: "Thin Hats", voice: "hats", x: 0.86, y: 0.9, wet: 0.85, dials: { env: 0, mode: 0.375 }, toggles: { follow: false, step: false, sweep: 0 } },
        // resonant LP around 1.8 kHz, stepped up to +-2.4 octaves per 1/16 by a 2-bar pattern: every hit its own colour
        { name: "Step Snare", voice: "snare", x: 0.6, y: 0.97, wet: 0.9, dials: { env: 0.85, mode: 0.1 }, toggles: { follow: false, step: true, sweep: 0 } },
      ],
      worklets: { [NAME]: SRC },
      create(ctx, env) {
        const put = SP.setter(ctx);
        if (!K.hasWorklet(ctx, NAME)) {
          // native fallback: one biquad, blended with the dry by amount (no envelope / steps / sweep)
          const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), bq = ctx.createBiquadFilter();
          input.connect(dry); dry.connect(output); input.connect(bq); bq.connect(wet); wet.connect(output); wet.gain.value = 0;
          return {
            input, output, latency: 0,
            set(s) {
              const a = K.clamp(s.amount), m = modeOf((s.dials || {}).mode), cut = cutOf(s.x), r = K.clamp(s.y) * a, q = Math.min(12, qOf(r)), w = wetOf(m, a);
              const f = m === 0 ? SP.elerp(20000, cut, a) : m === 2 ? SP.elerp(20, cut, a) : cut;
              bq.type = ["lowpass", "bandpass", "highpass", "notch"][m];
              put(bq.frequency, Math.min(f, ctx.sampleRate * 0.45));
              put(bq.Q, m === 0 || m === 2 ? 20 * Math.log10(q) : q);   // Web Audio's LP/HP Q is in dB
              put(dry.gain, 1 - w); put(wet.gain, w * (m === 1 ? Math.pow(q, 0.6) : m === 3 ? 1 : 1 / (1 + 0.4 * r)));
            },
            destroy() { SP.off(input, dry, bq, wet, output); },
          };
        }
        const node = SP.node(ctx, NAME, { amount: 0, bpm: env.bpm || 120 }, { clock: SP.clock(ctx, env), seed: env.seed });
        const P = (id) => node.parameters.get(id), last = {};
        const jump = (id, v) => { if (last[id] !== v) { last[id] = v; P(id).setValueAtTime(v, ctx.currentTime); } };   // stepped values: no glide
        return {
          input: node, output: node, latency: 0,
          set(s) {
            const d = s.dials || {}, t = s.toggles || {};
            put(P("amount"), K.clamp(s.amount));
            put(P("cut"), cutOf(s.x));
            put(P("res"), K.clamp(s.y));
            put(P("env"), K.clamp(d.env != null ? d.env : 0.5));
            jump("mode", modeOf(d.mode != null ? d.mode : 0));
            jump("follow", t.follow ? 1 : 0);
            jump("step", t.step ? 1 : 0);
            jump("sweep", Math.max(0, Math.min(3, t.sweep | 0)));
            jump("bpm", s.bpm || env.bpm || 120);
          },
          destroy() { SP.bye(node); },
        };
      },
    });
  })();

  // 15 PHASER: slow swirling notches. 4-12 first-order all-pass stages share one coefficient that
  // an LFO sweeps around CENTER FREQ (exponentially, up to +-2 octaves); the last stage feeds back to
  // the input through a band-pass that follows the sweep (so a kick's low end and the top never pile
  // up), and the chain is summed with the dry, so the notches move through every hit.
  (function () {
    const NAME = "kdfx-phaser";
    // X with TEMPO SYNC on: one LFO cycle per note value, slow (left) to fast (right)
    const CYCLES = [[32, "8 bars"], [16, "4 bars"], [8, "2 bars"], [4, "1 bar"], [2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"]];
    const cycleOf = (x) => CYCLES[Math.min(CYCLES.length - 1, Math.floor(K.clamp(x) * CYCLES.length))];
    const stagesOf = (v) => 4 + 2 * Math.min(4, Math.floor(K.clamp(v) * 5)); // 4, 6, 8, 10, 12
    const centerOf = (v) => SP.elerp(100, 4000, K.clamp(v));
    const FB = 0.85;
    // the dot -> the phaser. Neutral (amount 0) = no notch mix, no sweep, no feedback = the input.
    function settings(s) {
      const a = K.clamp(s.amount || 0), x = K.clamp(s.x != null ? s.x : 0.5), y = K.clamp(s.y != null ? s.y : 0.5);
      const d = s.dials || {}, t = s.toggles || {}, mix = Math.min(1, 1.5 * a);
      return {
        sync: !!t.sync, cycle: cycleOf(x)[0], rate: SP.elerp(0.03, 6, x), // free LFO 0.03..6 Hz
        stages: stagesOf(d.stages != null ? d.stages : 0.5), center: centerOf(d.center != null ? d.center : 0.65),
        depth: 2 * a, // sweep, octaves either side of the centre
        fb: (y - 0.5) * 2 * FB * a, // bottom half negative, top half positive feedback
        mix, spread: !!t.spread, bpm: s.bpm || 120,
      };
    }

    const SRC = COMMON_SRC + `
  const kdFrac = (v) => v - Math.floor(v);
  const kdGlide = (v, t, k) => { const d = (v - t) * k; return Math.abs(d) < 1e-9 ? t : t + d; }; // one-pole step that lands
  registerProcessor("${NAME}", class extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      const k = (name, defaultValue, minValue, maxValue) => ({ name, defaultValue, minValue, maxValue, automationRate: "k-rate" });
      return [k("rate", 0.4, 0.001, 50), k("sync", 0, 0, 1), k("cycle", 4, 0.01, 64), k("stages", 8, 2, 12), k("center", 1000, 10, 20000),
        k("depth", 0, 0, 4), k("fb", 0, -0.95, 0.95), k("mix", 0, 0, 1), k("spread", 0, 0, 1), k("bpm", 120, 20, 999)];
    }
    constructor(options) {
      super();
      this.clock = (options.processorOptions || {}).clock || { t0: 0, b0: 0 };
      this.alive = true;
      this.port.onmessage = (e) => { if (e.data === "bye") this.alive = false; };
      const z = () => new Float64Array(2);
      this.st = [new Float64Array(12), new Float64Array(12)]; // all-pass states, per channel
      this.y1 = z(); this.y2 = z(); this.lo = z(); this.hi = z(); // feedback: last two outputs, band-pass states
      this.co = z(); this.oc = z(); // all-pass coefficient, sweep (octaves around the centre)
      this.n = 8; this.nA = 8; this.nRun = 8; this.xf = 1; // stage count (a change crossfades from nA over 20 ms)
      this.ph = -1; this.off = 0; this.sync = false; this.cyc = 4; this.sp = 0; this.mix = 0; this.fb = 0;
    }
    process(inputs, outputs, p) {
      const inp = inputs[0] || [], out = outputs[0], len = out[0].length, sr = sampleRate, nch = out.length > 1 ? 2 : 1;
      const bpm = p.bpm[0], sync = p.sync[0] > 0.5, cyc = Math.max(0.01, p.cycle[0]), rate = p.rate[0], ctr = p.center[0], depth = p.depth[0];
      const spT = p.spread[0] > 0.5 ? 0.25 : 0, n = Math.max(2, Math.min(12, 2 * Math.round(p.stages[0] / 2)));
      if (n !== this.n) { // new stage count: fade over from the old tap; stages that sat idle start empty
        if (n > this.nRun) for (const s of this.st) s.fill(0, this.nRun, n);
        this.nA = this.n; this.n = n; this.xf = 0;
      }
      const SEG = 16, sm = Math.exp(-SEG / (0.008 * sr)), mm = Math.exp(-SEG / (0.01 * sr)), om = Math.exp(-SEG / (0.15 * sr)), pm = Math.exp(-SEG / (0.1 * sr));
      const lfo = (c) => -depth * Math.cos(2 * Math.PI * (this.ph - (c ? this.sp : 0))); // R lags by sp (a quarter cycle = STEREO SPREAD)
      const fcOf = (oct) => Math.min(0.45 * sr, Math.max(10, ctr * Math.pow(2, oct)));
      const apOf = (fc) => { const t = Math.tan((Math.PI * fc) / sr); return (t - 1) / (t + 1); };
      if (this.ph < 0) { // first block: in step with the song clock, settings already in place
        const b = kdBeat(this.clock, currentTime, bpm);
        this.ph = kdFrac(sync ? b / cyc : (rate * b * 60) / bpm);
        this.sync = sync; this.cyc = cyc; this.sp = spT; this.mix = p.mix[0]; this.fb = p.fb[0];
        for (let c = 0; c < 2; c++) { this.oc[c] = lfo(c); this.co[c] = apOf(fcOf(this.oc[c])); }
      }
      for (let i0 = 0; i0 < len; i0 += SEG) {
        const i1 = Math.min(len, i0 + SEG), m0 = this.mix, f0 = this.fb, x0 = this.xf;
        // the LFO: free running (glides when the rate moves), or locked to the song beat with TEMPO SYNC
        // (turning it on, or a new note value, slides onto the beat instead of jumping)
        if (sync) {
          const pl = kdFrac(kdBeat(this.clock, currentTime + i0 / sr, bpm) / cyc);
          if (!this.sync || cyc !== this.cyc) { const d = this.ph - pl; this.off = d - Math.round(d); }
          this.off = kdGlide(this.off, 0, om); this.ph = kdFrac(pl + this.off);
        } else this.ph = kdFrac(this.ph + (rate * (i1 - i0)) / sr);
        this.sync = sync; this.cyc = cyc;
        this.sp = kdGlide(this.sp, spT, pm); this.mix = kdGlide(m0, p.mix[0], mm); this.fb = kdGlide(f0, p.fb[0], mm);
        for (let c = 0; c < nch; c++) {
          const tg = lfo(c);
          this.oc[c] = tg + (this.oc[c] - tg) * sm; // smoothed: a jump never clicks
          const fc = fcOf(this.oc[c]), w = (-2 * Math.PI) / sr;
          // feedback band: low-pass at 6x and high-pass at 1/4 of the sweep, so nothing piles up at either end
          this.run(c, inp[c] || inp[0], out[c], i0, i1, apOf(fc), 1 - Math.exp(w * Math.min(0.45 * sr, 6 * fc)), 1 - Math.exp(w * 0.25 * fc), f0, m0, x0);
        }
        this.xf = Math.min(1, x0 + (i1 - i0) / (0.02 * sr));
      }
      this.nRun = this.xf < 1 ? Math.max(this.n, this.nA) : this.n;
      return this.alive;
    }
    // one channel, samples i0..i1; the coefficient, feedback and mix glide across the segment
    run(c, src, dst, i0, i1, a1, gl, gh, f0, m0, x0) {
      const s = this.st[c], nB = this.n, nA = this.nA, nr = Math.max(nA, nB), k = 1 / (i1 - i0), dx = 1 / (0.02 * sampleRate);
      const da = (a1 - this.co[c]) * k, df = (this.fb - f0) * k, dm = (this.mix - m0) * k;
      let a = this.co[c], fb = f0, m = m0, xf = x0, y1 = this.y1[c], y2 = this.y2[c], lo = this.lo[c], hi = this.hi[c];
      for (let i = i0; i < i1; i++) {
        a += da; fb += df; m += dm;
        const x = src ? src[i] : 0;
        lo += gl * (0.5 * (y1 + y2) - lo); hi += gh * (lo - hi); // the last stage, averaged and band-passed
        let v = x + Math.tanh(fb * (lo - hi)) + 1e-18; // tanh: the loop can never run away
        if (xf >= 1 || nA === nB) for (let j = 0; j < nB; j++) { const y = a * v + s[j]; s[j] = v - a * y; v = y; }
        else { // stage count crossfade: tap the chain at both counts
          let va = 0, vb = 0;
          for (let j = 0; j < nr; j++) { const y = a * v + s[j]; s[j] = v - a * y; v = y; if (j === nA - 1) va = v; if (j === nB - 1) vb = v; }
          xf = Math.min(1, xf + dx); v = va + (vb - va) * xf;
        }
        y2 = y1; y1 = v;
        dst[i] = (1 + 0.25 * m) * (x + 0.5 * m * (v - x)); // notch mix (m 1 = (dry + all-passed) / 2) + makeup
      }
      this.co[c] = a1; this.y1[c] = y1; this.y2[c] = y2; this.lo[c] = lo; this.hi[c] = hi;
    }
  });
  `;

    // before the worklet is loaded: 4 native all-pass biquads (about 8 stages) swept by an oscillator
    function native(ctx) {
      const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
      const lfo = ctx.createOscillator(), dep = ctx.createGain(), put = SP.setter(ctx);
      dry.gain.value = 1; wet.gain.value = 0;
      let last = input;
      const aps = [0, 1, 2, 3].map(() => { const b = ctx.createBiquadFilter(); b.type = "allpass"; b.Q.value = 0.5; dep.connect(b.detune); last.connect(b); return (last = b); });
      last.connect(wet); input.connect(dry); dry.connect(output); wet.connect(output);
      lfo.connect(dep); lfo.start();
      return {
        input, output, latency: 0,
        set(s) {
          const e = settings(s), mk = 1 + 0.25 * e.mix;
          put(lfo.frequency, e.sync ? e.bpm / 60 / e.cycle : e.rate);
          put(dep.gain, e.depth * 1200);
          for (const b of aps) put(b.frequency, e.center);
          put(dry.gain, (1 - 0.5 * e.mix) * mk); put(wet.gain, 0.5 * e.mix * mk);
        },
        destroy() { try { lfo.stop(); } catch (e) { /* gone */ } SP.off(lfo, dep, input, dry, wet, output, ...aps); },
      };
    }

    K.register({
      id: "phaser", num: 15, name: "PHASER", group: "SPECTRAL & FILTER",
      caption: "Slow swirling liquid motion.",
      axes: { x: "RATE", y: "FEEDBACK" },
      dials: [
        { id: "stages", name: "STAGES", def: 0.5, fmt: (v) => String(stagesOf(v)) },
        { id: "center", name: "CENTER FREQ", def: 0.65, fmt: (v) => K.fmt.hz(centerOf(v)) },
      ],
      toggles: [
        { id: "spread", name: "STEREO SPREAD", def: false },
        { id: "sync", name: "TEMPO SYNC", def: false },
      ],
      presets: [
        // 8 stages around 2.5 kHz, a slow free sweep (about 4.5 s a cycle), a little feedback, wide
        { name: "Liquid Hats", voice: "hats", x: 0.38, y: 0.8, wet: 0.9, dials: { stages: 0.5, center: 0.87 }, toggles: { spread: true, sync: false } },
        // locked to the bar: one sweep up and down per bar, so beat 2 swirls up and beat 4 swirls down
        { name: "Swirl Snare", voice: "snare", x: 0.44, y: 0.76, wet: 0.85, strength: 1.6, dials: { stages: 0.5, center: 0.67 }, toggles: { spread: true, sync: true } },
        // 4 stages around 150 Hz, a small slow sweep and a light mix: the kick's body breathes
        { name: "Deep Kick", voice: "kick", x: 0.4, y: 0.62, wet: 0.8, dials: { stages: 0.1, center: 0.11 }, toggles: { spread: false, sync: false } },
        // 12 stages around 700 Hz, high feedback: ringing, bubbling notches
        { name: "Underwater", voice: "perc", x: 0.42, y: 0.95, wet: 0.9, dials: { stages: 0.9, center: 0.53 }, toggles: { spread: true, sync: false } },
      ],
      worklets: { [NAME]: SRC },
      create(ctx, env) {
        if (!K.hasWorklet(ctx, NAME)) return native(ctx);
        const node = SP.node(ctx, NAME, { mix: 0 }, { clock: SP.clock(ctx, env), seed: env.seed });
        const P = (id) => node.parameters.get(id), put = SP.setter(ctx);
        const jump = (param, v) => { param.cancelScheduledValues(0); param.setValueAtTime(v, ctx.currentTime); }; // stepped settings
        return {
          input: node, output: node, latency: 0,
          set(s) {
            const e = settings(s);
            jump(P("sync"), e.sync ? 1 : 0); jump(P("cycle"), e.cycle); jump(P("stages"), e.stages); jump(P("spread"), e.spread ? 1 : 0); jump(P("bpm"), e.bpm);
            put(P("rate"), e.rate); put(P("center"), e.center); put(P("depth"), e.depth); put(P("fb"), e.fb); put(P("mix"), e.mix);
          },
          destroy() { SP.bye(node); },
        };
      },
    });
  })();

  // 20 - TRANSIENT: snappier or softer hits, no compressor. Two followers of the hit's level, a fast
  // one and a slow one: while the fast one is ahead, that's the attack (X turns it up or down in dB),
  // the rest is the sustain (Y). The gains are dB x amount, so the centre is exactly dry.
  (function () {
    const NAME = "kdfx-transient";
    // a dot position -> gain in dB: 0.5 = 0 dB, 1 = +12 dB; below the centre it fades out like a
    // fader (amplitude 2v), down to -40 dB (= gone) at the edge
    const dbAt = (v) => (v >= 0.5 ? 24 * (Math.min(1, v) - 0.5) : Math.max(-40, 20 * Math.log10(Math.max(1e-3, 2 * v))));
    const LOOK = 0.01; // the LOOKAHEAD dial: 0..10 ms
    const SRC = COMMON_SRC + `
  registerProcessor("${NAME}", class extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      const k = (name, defaultValue, minValue, maxValue) => ({ name, defaultValue, minValue, maxValue, automationRate: "k-rate" });
      // att / sus: dB on the attack / on the rest; look: lookahead in samples; safe: CLIP SAFE on
      return [k("att", 0, -60, 24), k("sus", 0, -60, 24), k("sens", 0.5, 0, 1), k("look", 0, 0, 8192), k("safe", 1, 0, 1)];
    }
    constructor() {
      super();
      this.alive = true;
      this.port.onmessage = (e) => { if (e.data === "bye") this.alive = false; };
      this.maxD = Math.round(0.01 * sampleRate);
      let n = 64; while (n < this.maxD + 2) n <<= 1;
      // ring buffers for the lookahead: the audio (L, R) and the attack curve
      this.m = n - 1; this.bl = new Float32Array(n); this.br = new Float32Array(n); this.bw = new Float32Array(n); this.w = 0;
      this.d = -1; this.d0 = 0; this.xf = 1; this.xs = 1 / Math.round(0.005 * sampleRate); this.dG = -1;
      this.f = 0; this.s = 0; this.at = 0; this.su = 0; this.G = 0; this.Gp = 0; this.g = 1;
      this.pk = 0; this.hold = 0; this.hd = Math.round(0.002 * sampleRate); this.eD = 0; this.eW = 0; this.gs = 1;
      this.sens = -1; this.first = true;
      this.cFa = kdCoef(0.0002); this.cFr = kdCoef(0.03); this.cSr = kdCoef(0.15); this.cP = kdCoef(0.008);
      this.cPk = kdCoef(0.06); this.kE = 1 - kdCoef(0.4); this.cGa = kdCoef(0.02); this.cGr = kdCoef(0.3);
    }
    process(inputs, outputs, p) {
      const inp = inputs[0], o = outputs[0], oL = o[0], oR = o[1] || o[0], len = oL.length;
      const a = inp && inp.length ? inp[0] : null, b = inp && inp.length > 1 ? inp[1] : a;
      const att = p.att[0], sus = p.sus[0], safe = p.safe[0] > 0.5, sens = p.sens[0];
      if (this.first) { this.first = false; this.at = att; this.su = sus; }
      if (sens !== this.sens) {
        // SENSITIVITY: how long the slow follower lags (= the attack window) and how small a jump counts
        this.sens = sens;
        this.cSa = kdCoef(0.004 * Math.pow(8, sens));
        this.lo = 0.04 + 0.16 * (1 - sens);
        this.isp = 1 / (0.2 + 0.4 * (1 - sens));
      }
      // LOOKAHEAD: a new delay crossfades in over 5 ms
      const D = Math.max(0, Math.min(this.maxD, Math.round(p.look[0])));
      if (this.d < 0) this.d = D;
      else if (D !== this.d && this.xf >= 1) { this.d0 = this.d; this.d = D; this.xf = 0; }
      const d = this.d, d0 = this.d0, m = this.m, bl = this.bl, br = this.br, bw = this.bw, xs = this.xs, hd = d + this.hd;
      if (this.dG !== d) { this.dG = d; this.cG = kdCoef(0.0003 + d / (6 * sampleRate)); }
      const cFa = this.cFa, cFr = this.cFr, cSa = this.cSa, cSr = this.cSr, lo = this.lo, isp = this.isp, cP = this.cP, cG = this.cG;
      const cPk = this.cPk, kE = this.kE, cGa = this.cGa, cGr = this.cGr;
      let w = this.w, xf = this.xf, f = this.f, s = this.s, at = this.at, su = this.su, G = this.G, Gp = this.Gp, g = this.g;
      let pk = this.pk, hold = this.hold, eD = this.eD, eW = this.eW, gs = this.gs;
      for (let i = 0; i < len; i++) {
        const xl = a ? a[i] : 0, xr = b ? b[i] : 0, v = Math.max(Math.abs(xl), Math.abs(xr));
        // detection (both channels linked): a fast follower of the peak and a slow follower of the
        // fast one; while the fast one is ahead it's the attack (0..1, with a small dead zone so a
        // ringing tail never counts as a hit)
        f = v > f ? v + (f - v) * cFa : v + (f - v) * cFr;
        s = f > s ? f + (s - f) * cSa : f + (s - f) * cSr;
        let wa = ((f - s) / (f + 1e-4) - lo) * isp;
        wa = wa <= 0 ? 0 : wa >= 1 ? 1 : wa * wa * (3 - 2 * wa);
        // lookahead: the audio and the attack curve come out d samples late; the gain follows the
        // larger of "now" (so it moves before the hit) and the aligned one (so it lets go on time)
        bl[w] = xl; br[w] = xr; bw[w] = wa;
        const j = (w - d) & m, we = Math.max(wa, bw[j]);
        let dl = bl[j], dr = br[j];
        if (xf < 1) { const j0 = (w - d0) & m; dl = bl[j0] + (dl - bl[j0]) * xf; dr = br[j0] + (dr - br[j0]) * xf; xf += xs; }
        w = (w + 1) & m;
        // the gain in dB: the sustain's, moving to the attack's while it's the attack (all smoothed)
        at = att + (at - att) * cP; su = sus + (su - sus) * cP;
        const T = su + (at - su) * we;
        G = T + (G - T) * cG; if (Math.abs(G - T) < 1e-6) G = T;
        if (G !== Gp) { Gp = G; g = Math.exp(G * 0.11512925464970229); }
        // CLIP SAFE: the peak level (held through the lookahead, so it sees the hit coming) caps a
        // boost under -0.6 dBFS with a soft knee; it never turns the hit below its dry level
        if (v >= pk) { pk = v; hold = hd; } else if (hold > 0) hold--; else pk *= cPk;
        let k = g;
        if (safe && g > 1) {
          const e = g * pk;
          if (e > 0.75) { const u = (e - 0.75) * 5.5556; k = Math.max(1, (g * (0.75 + (0.18 * u) / (1 + u))) / e); }
        }
        let yl = dl * k, yr = dr * k;
        if (safe && k > 1) {
          // and a soft ceiling at -0.3 dBFS for anything still over
          let q = Math.abs(yl);
          if (q > 0.9) { const u = (q - 0.9) * 15.15; q = Math.max(0.9 + (0.066 * u) / (1 + u), Math.abs(dl)); yl = yl < 0 ? -q : q; }
          q = Math.abs(yr);
          if (q > 0.9) { const u = (q - 0.9) * 15.15; q = Math.max(0.9 + (0.066 * u) / (1 + u), Math.abs(dr)); yr = yr < 0 ? -q : q; }
        }
        // level guard: a slow loudness match keeps the wet under about +5.5 dB over the input
        eD += (dl * dl + dr * dr - eD) * kE; eW += (yl * yl + yr * yr - eW) * kE;
        const tg = eD > 1e-12 && eW > 3.55 * eD ? Math.sqrt((3.55 * eD) / eW) : 1;
        gs = tg < gs ? tg + (gs - tg) * cGa : tg + (gs - tg) * cGr;
        oL[i] = yl * gs; oR[i] = yr * gs;
      }
      if (f < 1e-15) f = 0; if (s < 1e-15) s = 0; if (pk < 1e-15) pk = 0; if (eD < 1e-30) eD = 0; if (eW < 1e-30) eW = 0;
      this.w = w; this.xf = xf; this.f = f; this.s = s; this.at = at; this.su = su; this.G = G; this.Gp = Gp; this.g = g;
      this.pk = pk; this.hold = hold; this.eD = eD; this.eW = eW; this.gs = gs;
      return this.alive;
    }
  });`;
    K.register({
      id: "transient", num: 20, name: "TRANSIENT", group: "DYNAMICS & MOVEMENT",
      caption: "Snappier or softer hits, no compressor.",
      axes: { x: "ATTACK GAIN", y: "SUSTAIN GAIN" },
      dials: [
        { id: "sens", name: "SENSITIVITY", def: 0.5, fmt: K.fmt.pct },
        { id: "look", name: "LOOKAHEAD", def: 0.2, fmt: (v) => (K.clamp(v) * 10).toFixed(1) + " ms" },
      ],
      toggles: [{ id: "safe", name: "CLIP SAFE", def: true }],
      presets: [
        { name: "Punch", voice: "kick", x: 0.82, y: 0.38, wet: 1, dials: { sens: 0.5, look: 0.2 }, toggles: { safe: true } },
        { name: "Crack", voice: "snare", x: 0.908, y: 0.5, wet: 1, dials: { sens: 0.5, look: 0.15 }, toggles: { safe: true } },
        { name: "Room Up", voice: "snare", x: 0.5, y: 0.854, wet: 1, dials: { sens: 0.5, look: 0.2 }, toggles: { safe: true } },
        { name: "Tight Hats", voice: "hats", x: 0.5, y: 0.113, wet: 1, dials: { sens: 0.3, look: 0.1 }, toggles: { safe: true } },
      ],
      worklets: { [NAME]: SRC },
      create(ctx, env) {
        if (!K.hasWorklet(ctx, NAME)) return SP.passthrough(ctx);
        const node = SP.node(ctx, NAME, { att: 0, sus: 0, sens: 0.5, look: 0, safe: 1 });
        const put = SP.setter(ctx), P = (n) => node.parameters.get(n);
        let lat = 0;
        return {
          input: node, output: node,
          // the wet comes out LOOKAHEAD late (the whole wet, so it stays in line with itself)
          get latency() { return lat; },
          set(s) {
            const amt = K.clamp(s.amount || 0), dl = s.dials || {}, tg = s.toggles || {};
            put(P("att"), dbAt(s.x != null ? s.x : 0.5) * amt);
            put(P("sus"), dbAt(s.y != null ? s.y : 0.5) * amt);
            put(P("sens"), K.clamp(dl.sens != null ? dl.sens : 0.5));
            const n = Math.round(K.clamp(dl.look != null ? dl.look : 0.2) * LOOK * ctx.sampleRate);
            P("look").value = n; lat = n / ctx.sampleRate;
            P("safe").value = tg.safe === false || tg.safe === 0 ? 0 : 1;
          },
          destroy() { SP.bye(node); },
        };
      },
    });
  })();

  // 21 - PUMP: the breathing duck (KILLTOY's Pump.h as a worklet). On every RATE step of the song
  // grid, or on each real kick hit (KEY FROM KICK), the gain dips in ~4 ms and swells back; CURVE
  // shapes the swell. Only ever turns the sound down, so the centre (depth 0) is the exact input.
  (function () {
    const NAME = "kdfx-pump";
    // RATE: one grid step (key mode: how long one dip lasts). 1/8. runs 3+3+2 in each half bar.
    const RATES = [[4, "1 bar"], [2, "1/2"], [1, "1/4"], [0.75, "1/8."], [0.5, "1/8"], [1 / 3, "1/8T"], [0.25, "1/16"], [0.125, "1/32"]];
    const rateOf = (v) => RATES[Math.min(RATES.length - 1, Math.floor(K.clamp(v) * RATES.length))];
    const rateV = (i) => (i + 0.5) / RATES.length;   // dial value in the middle of a RATE step
    const SHAPES = ["FAST", "QUICK", "CLASSIC", "HOLD", "SNAP"];
    K.register({
      id: "pump", num: 21, name: "PUMP", group: "DYNAMICS & MOVEMENT",
      caption: "The breathing effect.",
      axes: { x: "DEPTH", y: "RELEASE" },
      dials: [
        // 0 = springs back fast, 0.5 = the classic raised-cosine swell, 1 = holds low, then snaps back
        { id: "curve", name: "CURVE", def: 0.5, fmt: (v) => SHAPES[Math.min(4, Math.floor(K.clamp(v) * 5))] },
        { id: "rate", name: "RATE", def: rateV(2), fmt: (v) => rateOf(v)[1] },
      ],
      toggles: [
        { id: "key", name: "KEY FROM KICK", def: false },   // duck on the kick's real hits, not the grid
        { id: "tempo", name: "TEMPO SYNC", def: true },     // off: the grid runs on its own clock at 120 BPM
      ],
      presets: [
        // depth 62% (-8 dB) on each kick, swell back over half a beat
        { name: "Breath", voice: "hats", x: 0.85, y: 0.47, wet: 1, dials: { curve: 0.5, rate: rateV(2) }, toggles: { key: true, tempo: true } },
        // every beat, 92% (-22 dB) dip, swell over 2/3 of the beat; every voice but the kick
        { name: "Heavy Pump", voice: "all", except: ["kick"], sync: false, x: 0.97, y: 0.64, wet: 1, dials: { curve: 0.5, rate: rateV(2) }, toggles: { key: false, tempo: true } },
        // dotted 1/8 (3+3+2 sixteenths per half bar): 67% dip that holds, then springs back by
        // mid-step, so hits on the dips drop ~7 dB and the ones between stay up
        { name: "Swing Pump", voice: "perc", x: 0.87, y: 0.42, wet: 1, dials: { curve: 0.72, rate: rateV(3) }, toggles: { key: false, tempo: true } },
        // 1/32 (16 Hz at 120 BPM), 69% dip, smooth full-step swell: a tremolo
        { name: "Pulse", voice: "snare", x: 0.65, y: 0.98, wet: 1, dials: { curve: 0.5, rate: rateV(7) }, toggles: { key: false, tempo: true } },
      ],
      worklets: {
        [NAME]: COMMON_SRC + `
  registerProcessor("${NAME}", class extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      const k = (name, defaultValue, minValue, maxValue) => ({ name, defaultValue, minValue, maxValue, automationRate: "k-rate" });
      return [k("depth", 0, 0, 1), k("release", 0.55, 0.05, 1), k("curve", 0.5, 0, 1), k("step", 1, 0.125, 4),
        k("key", 0, 0, 1), k("tempo", 1, 0, 1), k("bpm", 120, 20, 400),
        { name: "trig", defaultValue: 0, minValue: 0, maxValue: 8, automationRate: "a-rate" }];
    }
    constructor(o) {
      super();
      const po = (o && o.processorOptions) || {};
      this.clock = po.clock || { t0: 0, b0: 0 }; this.feed = !!po.feed;
      this.alive = true; this.port.onmessage = (e) => { if (e.data === "bye") this.alive = false; };
      this.tr = new KdTrig(); this.c = kdCoef(0.0007);    // 0.7 ms gain smoothing, as in Pump.h
      this.g = 1; this.d = 0;                              // gain now, dip now (0 none .. 1 full)
      this.ph = 1; this.from = 0; this.s = 1;              // key: phase of the running dip (1 = none), its start level, its strength
      this.loud = 0; this.lt = 0; this.bi = null;          // loudest kick lately, beat index (grid fallback)
    }
    process(inputs, outputs, P) {
      const inp = inputs[0] || [], A = inp[0], B = inp[1] || A, L = outputs[0][0], R = outputs[0][1], n = L.length;
      const depth = P.depth[0], rel = P.release[0], ex = Math.pow(16, P.curve[0] - 0.5), step = Math.max(0.1, P.step[0]);
      const key = P.key[0] > 0.5, sync = P.tempo[0] > 0.5, bpm = sync ? Math.max(20, P.bpm[0]) : 120;
      const tr = P.trig, ta = tr.length > 1, bps = bpm / (60 * sampleRate), attB = (0.004 * bpm) / 60, cyc = Math.max(2, step);
      // song beat (synced) or the instance's own beat at 120 BPM (free)
      let beat = sync ? kdBeat(this.clock, currentTime, bpm) : (currentTime - this.clock.t0) * 2;
      if (this.bi === null) this.bi = Math.ceil(beat) - 1;
      for (let i = 0; i < n; i++, beat += bps) {
        const h = this.tr.step(tr[ta ? i : 0]), bi = Math.floor(beat);
        let p, len = step, from = 0, s = 1;
        if (key) {
          // each kick (or, with no kick feed, each beat) restarts the dip; softer hits dip less
          let hit = this.feed ? h : 0;
          if (bi !== this.bi && !this.feed) hit = 1;
          if (hit > 0) {
            const t = currentTime + i / sampleRate;
            this.loud = Math.max(hit, this.loud * Math.exp((this.lt - t) / 2.5)); this.lt = t;
            this.s = Math.min(1, Math.max(0.3, Math.sqrt(hit / this.loud)));
            this.from = this.d; this.ph = 0;
          }
          p = this.ph; from = this.from; s = this.s;
          if (p < 1) this.ph = p + bps / step;
        } else {
          // the grid restarts every half bar, so a step that doesn't fit (1/8.) ends short
          const pos = beat - Math.floor(beat / cyc) * cyc, s0 = Math.floor(pos / step) * step;
          len = Math.min(step, cyc - s0);
          p = len > 1e-9 ? Math.min(1, (pos - s0) / len) : 1;
        }
        this.bi = bi;
        let d = 0;
        if (p < 1) {
          const att = Math.min(attB / len, 0.2);
          if (p < att) d = from + (s - from) * (p / att);
          else {
            const q = (p - att) / Math.max(rel * (1 - att), 0.02);
            if (q < 1) d = s * 0.5 * (1 + Math.cos(Math.PI * (ex === 1 ? q : Math.pow(q, ex))));
          }
        }
        this.d = d;
        const tg = 1 - depth * d;
        let g = tg + (this.g - tg) * this.c;
        if (Math.abs(g - tg) < 1e-9) g = tg;
        this.g = g;
        L[i] = A ? A[i] * g : 0; R[i] = B ? B[i] * g : 0;
      }
      return this.alive;
    }
  });`,
      },
      create(ctx, env) {
        if (!K.hasWorklet(ctx, NAME)) return SP.passthrough(ctx);   // a gain can't follow the grid without it
        const feed = typeof K.onKick === "function";
        const node = SP.node(ctx, NAME, { depth: 0 }, { clock: SP.clock(ctx, env), seed: env.seed, feed });
        const P = (k) => node.parameters.get(k), put = SP.setter(ctx), trig = P("trig"), last = {};
        // the kick's hits of this pass, ahead of time: pulses on trig (used only while KEY FROM KICK is
        // on), 5 ms early so the dip is all the way down when the kick lands
        let unsub = null;
        if (feed) try {
          unsub = K.onKick((k) => {
            if (!k || !isFinite(k.at) || (k.pluginId != null && env.pluginId != null && k.pluginId !== env.pluginId)) return;
            SP.pulse(trig, k.at - 0.005, k.gain);
          });
        } catch (e) { unsub = null; }
        // stepped settings jump (a glide would pass through other steps)
        const jump = (k, v) => { if (last[k] === v) return; last[k] = v; const p = P(k); p.cancelScheduledValues(ctx.currentTime); p.setValueAtTime(v, ctx.currentTime); };
        return {
          input: node, output: node, latency: 0,
          set(s) {
            const d = s.dials || {}, t = s.toggles || {}, amt = K.clamp(s.amount || 0);
            put(P("depth"), SP.lerp(0.2, 1, K.clamp(s.x != null ? s.x : 0.5)) * amt);   // X: 20..100% dip, x amount
            put(P("release"), SP.lerp(0.05, 1, K.clamp(s.y != null ? s.y : 0.5)));     // Y: swell = 5..100% of a step
            put(P("curve"), K.clamp(d.curve != null ? d.curve : 0.5));
            jump("step", rateOf(d.rate != null ? d.rate : rateV(2))[0]);
            jump("key", t.key ? 1 : 0);
            jump("tempo", t.tempo === false || t.tempo === 0 ? 0 : 1);
            jump("bpm", s.bpm || env.bpm || 120);
          },
          destroy() { if (unsub) try { unsub(); } catch (e) { /* gone */ } SP.bye(node); },
        };
      },
    });
  })();

  // 22 - GATE SEQUENCER: a 16-step on/off gate locked to the song's 1/16 grid. Each closed run fades
  // out at its start and back in before the next open step (SMOOTHING), so hits on open steps keep
  // their attack and the tails get chopped. The gain is worked out from the song position, so a loop
  // replays exactly. Closed steps go to (1 - amount): the centre is the input, untouched.
  (function () {
    const NAME = "kdfx-gate-sequencer";
    // PATTERN's named patterns ("x" = open step). RANDOM is seeded per voice.
    const PATS = [
      ["TRANCE", "x.x.x.x.x.x.x.x."], ["MORSE", "x..xxx.x..x.xxx."], ["STOMP", "xx..xx..xx..xx.."],
      ["BREATH", "xxxxxxxx........"], ["OFFBEAT", "..xx..xx..xx..xx"], ["TRIPLET", "x..x..x.x..x..x."], ["RANDOM", ""],
    ];
    const bits = (str) => [...str].map((c) => (c === "x" ? 1 : 0));
    // the 16 steps a PATTERN option plays (seed = the voice's env.seed, only RANDOM uses it)
    const patternOf = (toggles, seed) => {
      const i = K.clamp(Math.round((toggles && toggles.pattern) || 0), 0, PATS.length - 1);
      if (PATS[i][1]) return bits(PATS[i][1]);
      const r = K.rng(K.hash("gate", seed || 0));
      return Array.from({ length: 16 }, (_, k) => (k === 0 || r() < 0.45 ? 1 : 0));
    };
    const isOn = (v) => v === true || v > 0.5;
    const maskOf = (p) => p.reduce((m, v, i) => (i < 16 && isOn(v) ? m | (1 << i) : m), 0);
    const lenOf = (x) => 2 + Math.round(K.clamp(x) * 14);

    const SRC = COMMON_SRC + `
  registerProcessor("${NAME}", class extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      const k = (name, defaultValue, minValue, maxValue, automationRate = "k-rate") => ({ name, defaultValue, minValue, maxValue, automationRate });
      return [k("depth", 0, 0, 1), k("len", 16, 2, 16), k("mask", 21845, 0, 65535), k("smooth", 0.3, 0, 1),
        k("swing", 0, 0, 0.5), k("prob", 1, 0, 1), k("bpm", 120, 20, 999), k("trig", 0, 0, 1000, "a-rate")];
    }
    constructor(o) {
      super();
      const po = (o && o.processorOptions) || {};
      this.clock = po.clock || { t0: 0, b0: 0 }; this.seed = po.seed | 0;
      this.alive = true; this.port.onmessage = (e) => { if (e.data === "bye") this.alive = false; };
      this.trig = new KdTrig(); this.cd = kdCoef(0.01);
      this.n = NaN; this.open = true; this.a = 0; this.b = 0; this.ha = false; this.hb = false; this.T = 1;
      this.g = 1; this.dep = -1; this.len = 16; this.mask = 0; this.prob = 1; this.sw = 0; this.h0 = 0.0024; this.ys = 0;
    }
    // is global step n open? The pattern's bit (the first len steps loop), then PROBABILITY's dice,
    // seeded per bar + step so it changes bar to bar but replays the same.
    on(n) {
      const L = this.len, i = ((n % L) + L) % L;
      if (!((this.mask >> i) & 1)) return false;
      if (this.prob > 0.999) return true;
      const bar = Math.floor(n / 16);
      return kdHash(this.seed, bar, n - bar * 16) < this.prob;
    }
    // where step n starts, in steps (SWING delays every second step)
    st(n) { return n + (n & 1 ? this.sw : 0); }
    // edge time in steps for the closed run a..b: 0.3 ms (hard) up to half the run (soft)
    ramp() { const half = Math.max(this.h0, Math.min(16, this.st(this.b + 1) - this.st(this.a)) / 2); return this.h0 * Math.pow(half / this.h0, this.ys); }
    // entering step n: if it is closed, find the closed run it sits in (up to 32 steps each way)
    enter(n) {
      this.n = n; this.open = this.on(n);
      if (this.open) return;
      let a = n, b = n, k = 0;
      while (k < 32 && !this.on(a - 1)) { a--; k++; }
      this.ha = k < 32; k = 0;
      while (k < 32 && !this.on(b + 1)) { b++; k++; }
      this.hb = k < 32; this.a = a; this.b = b; this.T = this.ramp();
    }
    process(inputs, outputs, P) {
      const out = outputs[0], oL = out[0], oR = out[1] || out[0], N = oL.length, inp = inputs[0];
      const x0 = inp && inp.length ? inp[0] : null, x1 = inp && inp.length > 1 ? inp[1] : x0;
      const bpm = Math.max(20, P.bpm[0] || 120), sw = Math.min(0.5, Math.max(0, P.swing[0])), dT = P.depth[0];
      const len = Math.max(2, Math.min(16, Math.round(P.len[0]))), mask = Math.round(P.mask[0]) & 65535, prob = P.prob[0];
      if (len !== this.len || mask !== this.mask || prob !== this.prob || sw !== this.sw) { this.len = len; this.mask = mask; this.prob = prob; this.sw = sw; this.n = NaN; }
      const stepSec = 15 / bpm;
      this.h0 = 0.0003 / stepSec; this.ys = Math.min(1, Math.max(0, P.smooth[0]));
      if (!this.open && this.n === this.n) this.T = this.ramp();
      // a pattern change under the playhead (dragging) glides no harder than a 1-step edge
      const slew = 1 / (Math.max(0.00015, 0.5 * this.h0 * Math.pow(0.5 / this.h0, this.ys) * stepSec) * sampleRate);
      if (this.dep < 0) this.dep = dT;
      const tr = P.trig, cd = this.cd, dp = (4 * bpm) / 60 / sampleRate;
      let p = 4 * kdBeat(this.clock, currentTime, bpm);
      for (let i = 0; i < N; i++, p += dp) {
        // a pad hit while the song is stopped starts the pattern on the hit
        if (this.trig.step(tr.length > 1 ? tr[i] : tr[0])) { this.clock.t0 = currentTime + i / sampleRate; this.clock.b0 = 0; p = 0; this.n = NaN; }
        const pair = Math.floor(p / 2), n = 2 * pair + (p - 2 * pair >= 1 + sw ? 1 : 0);
        if (n !== this.n) this.enter(n);
        let g = 1;
        if (!this.open) {
          const T = this.T, tau = p - this.st(this.a), sig = this.st(this.b + 1) - p;
          g = this.ha && tau < T ? 0.5 + 0.5 * Math.cos((Math.PI * tau) / T) : this.hb && sig < T ? 0.5 + 0.5 * Math.cos((Math.PI * sig) / T) : 0;
        }
        const dg = g - this.g;
        this.g += dg > slew ? slew : dg < -slew ? -slew : dg;
        this.dep = dT + (this.dep - dT) * cd;
        const gain = 1 - this.dep * (1 - this.g);
        oL[i] = x0 ? x0[i] * gain : 0; oR[i] = x1 ? x1[i] * gain : 0;
      }
      if (Math.abs(this.dep - dT) < 1e-6) this.dep = dT;
      return this.alive;
    }
  });`;

    K.register({
      id: "gate-sequencer", num: 22, name: "GATE SEQUENCER", group: "DYNAMICS & MOVEMENT",
      caption: "Chops tails into rhythmic patterns.",
      axes: { x: "PATTERN LENGTH", y: "SMOOTHING" },
      axisFmt: { x: (x) => lenOf(x) + " steps", y: (y) => K.fmt.pct(y) },
      dials: [
        // MPC-style: 50% = straight, 66% = triplet feel, 75% = the second 1/16 half a step late
        { id: "swing", name: "SWING", def: 0, fmt: (v) => (v < 0.01 ? "OFF" : Math.round(50 + 25 * K.clamp(v)) + "%") },
        { id: "prob", name: "PROBABILITY", def: 1, fmt: K.fmt.pct },
      ],
      toggles: [
        { id: "pattern", name: "PATTERN", options: PATS.map((p) => p[0]), def: 0 },
        // PATTERN EDIT ({ id: "edit", name: "PATTERN EDIT", def: false }) comes back once the FX tab has the 16-step grid
      ],
      // The host's 16-step grid: with PATTERN EDIT on, set(s) plays s.pattern ([16] of 0/1) instead
      // of the PATTERN option. patternOf(toggles, seed) gives the option's steps to start the grid from.
      patternSteps: 16, patternOf,
      presets: [
        { name: "Trance Gate", voice: "snare", x: 1, y: 0.4, wet: 0.9, dials: { swing: 0, prob: 1 }, toggles: { pattern: 0 }, pattern: bits(PATS[0][1]) },
        { name: "Morse Hats", voice: "hats", x: 1, y: 0.22, wet: 1, dials: { swing: 0, prob: 0.8 }, toggles: { pattern: 1 }, pattern: bits(PATS[1][1]) },
        { name: "Stomp", voice: "kick", x: 0.143, y: 0.03, wet: 1, dials: { swing: 0, prob: 1 }, toggles: { pattern: 2 }, pattern: bits(PATS[2][1]) },
        { name: "Breather", voice: "perc", x: 1, y: 0.9, wet: 0.9, dials: { swing: 0, prob: 1 }, toggles: { pattern: 3 }, pattern: bits(PATS[3][1]) },
      ],
      worklets: { [NAME]: SRC },
      create(ctx, env) {
        if (!K.hasWorklet(ctx, NAME)) return SP.passthrough(ctx);
        const node = SP.node(ctx, NAME, { depth: 0, bpm: env.bpm || 120 }, { clock: SP.clock(ctx, env), seed: env.seed | 0 });
        const P = (id) => node.parameters.get(id), put = SP.setter(ctx), last = {};
        // stepped values jump (a glide would pass through other patterns)
        const jump = (id, v) => { if (last[id] !== v) { last[id] = v; P(id).setValueAtTime(v, ctx.currentTime); } };
        let pat = patternOf({}, env.seed);
        return {
          input: node, output: node, latency: 0,
          get pattern() { return pat.slice(); }, // the 16 steps this dot plays now (for the grid)
          set(s) {
            const t = s.toggles || {}, d = s.dials || {};
            pat = t.edit && Array.isArray(s.pattern) ? Array.from({ length: 16 }, (_, i) => (isOn(s.pattern[i]) ? 1 : 0)) : patternOf(t, env.seed);
            jump("mask", maskOf(pat)); jump("len", lenOf(s.x != null ? s.x : 0.5)); jump("bpm", s.bpm || env.bpm || 120);
            put(P("depth"), K.clamp(s.amount || 0)); put(P("smooth"), K.clamp(s.y != null ? s.y : 0.5));
            put(P("swing"), 0.5 * K.clamp(d.swing != null ? d.swing : 0)); put(P("prob"), K.clamp(d.prob != null ? d.prob : 1));
          },
          // a pad hit while the song is stopped (no song beat) restarts the pattern on that hit
          trigger(hit) { if (hit && hit.beat == null) SP.pulse(P("trig"), hit.at, 1); },
          destroy() { SP.bye(node); },
        };
      },
    });
  })();

  // 23 - ORBIT: the voice circles your head. A beat-locked LFO moves everything above ~120 Hz
  // round the listener while the low end stays centred. 3D = ear delay (ITD, up to 0.66 ms) + head
  // shadow per ear, a darker sound behind, an elevation peak/notch; STEREO = equal-power auto-pan
  // that squares up into hard L/R at full width. DISTANCE = quieter + air low-pass. Centre = dry.
  (function () {
    const NAME = "kdfx-orbit";
    // beats per orbit; X picks one (slow on the left, fast on the right), locked to the song beat
    const RATES = [[32, "8 bars"], [16, "4 bars"], [8, "2 bars"], [4, "1 bar"], [2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"]];
    const rateOf = (x) => RATES[Math.min(RATES.length - 1, Math.floor(K.clamp(x) * RATES.length))];
    const elevOf = (v) => Math.round((K.clamp(v) * 2 - 1) * 45); // degrees, 0 = ear level
    const distOf = (v) => SP.elerp(0.5, 20, K.clamp(v)); // metres (the label; really level + air)
    // the dot -> worklet settings. amount moves everything from "no effect" toward the target.
    function settings(s) {
      const a = K.clamp(s.amount || 0), d = s.dials || {}, t = s.toggles || {};
      return {
        rate: rateOf(s.x != null ? s.x : 0.5)[0],
        w: K.clamp(s.y != null ? s.y : 0.5) * a, // swing: 0 = centre, 1 = full circle / hard L-R
        mode: t.mode === 1 || t.mode === true ? 1 : 0, // 0 = 3D, 1 = STEREO
        el: (K.clamp(d.elev != null ? d.elev : 0.5) * 2 - 1) * a, // -1 below .. +1 above
        dist: K.clamp(d.dist || 0) * a, // 0 near .. 1 far
        mono: a, // how much of a stereo input's side folds to mono (the orbit replaces it)
        bpm: s.bpm || 120,
      };
    }

    const SRC = COMMON_SRC + `
  function kdFl(v) { return v > 1e-20 || v < -1e-20 ? v : 0; }
  registerProcessor("${NAME}", class extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      const k = (name, def, lo, hi) => ({ name, defaultValue: def, minValue: lo, maxValue: hi, automationRate: "k-rate" });
      return [k("w", 0, 0, 1), k("rate", 2, 0.0625, 64), k("mode", 0, 0, 1), k("el", 0, -1, 1), k("dist", 0, 0, 1), k("mono", 0, 0, 1), k("bpm", 120, 20, 400)];
    }
    constructor(options) {
      super();
      const o = (options && options.processorOptions) || {}, fs = sampleRate;
      this.clock = o.clock || { t0: 0, b0: 0 };
      this.alive = true;
      this.port.onmessage = (e) => { if (e.data === "bye") this.alive = false; };
      // crossover: 2-pole Butterworth low-pass at 120 Hz. The lows stay centred, (input - lows) orbits.
      const w0 = (2 * Math.PI * 120) / fs, c = Math.cos(w0), al = Math.sin(w0) / (2 * Math.SQRT1_2), a0 = 1 + al;
      this.xb0 = (1 - c) / 2 / a0; this.xb1 = (1 - c) / a0; this.xa1 = (-2 * c) / a0; this.xa2 = (1 - al) / a0;
      this.x1 = 0; this.x2 = 0;
      // head shadow: first-order high shelf per ear (corner 1.6 kHz, gain at the top = a)
      this.K = Math.tan((Math.PI * 1600) / fs); this.ik = 1 / (this.K + 1); this.sa1 = (this.K - 1) * this.ik;
      this.sxl = 0; this.syl = 0; this.sxr = 0; this.syr = 0;
      // elevation peak/notch (biquad on the orbiting part)
      this.lastEl = NaN; this.e1 = 0; this.e2 = 0; this.elev(0);
      // ear delay line, air low-pass states
      this.buf = new Float64Array(256); this.wi = 0; this.lpl = 0; this.lpr = 0;
      // smoothed controls (6 ms glide, so rate/mode switches and the square L/R never click)
      this.kc = kdCoef(0.006); this.first = true;
      this.gL = 1; this.gR = 1; this.dL = 0; this.dR = 0; this.aL = 1; this.aR = 1; this.ac = 1; this.am = 0; this.dg = 1; this.eg = 1; this.m = 0;
      this.tgL = 1; this.tgR = 1; this.tdL = 0; this.tdR = 0; this.taL = 1; this.taR = 1; this.tac = 1; this.tam = 0;
    }
    // elevation: -1 below (a notch near 6 kHz) .. +1 above (a peak near 10 kHz); 0 = no filter at all
    elev(el) {
      this.lastEl = el;
      const fs = sampleRate, f0 = Math.min(0.42 * fs, 6000 * Math.pow(10 / 6, (el + 1) / 2));
      const g = el >= 0 ? 6 * el : 12 * el, Q = el >= 0 ? 1 : 2.5, A = Math.pow(10, g / 40);
      const w0 = (2 * Math.PI * f0) / fs, c = Math.cos(w0), al = Math.sin(w0) / (2 * Q), a0 = 1 + al / A;
      this.eb0 = (1 + al * A) / a0; this.eb1 = (-2 * c) / a0; this.eb2 = (1 - al * A) / a0; this.ea1 = this.eb1; this.ea2 = (1 - al / A) / a0;
    }
    // the delay line read d samples back (cubic Lagrange; quadratic for d < 1, which needs no future sample)
    read(d) {
      const b = this.buf, w = this.wi, i0 = Math.floor(d), f = d - i0;
      const y0 = b[(w - i0) & 255];
      if (f === 0) return y0;
      const y1 = b[(w - i0 - 1) & 255], y2 = b[(w - i0 - 2) & 255];
      if (i0 === 0) return 0.5 * y0 * (f - 1) * (f - 2) - y1 * f * (f - 2) + 0.5 * y2 * f * (f - 1);
      const ym = b[(w - i0 + 1) & 255];
      return (-ym * f * (f - 1) * (f - 2) + y2 * (f + 1) * f * (f - 1)) / 6 + 0.5 * (y0 * (f + 1) * (f - 1) * (f - 2) - y1 * (f + 1) * f * (f - 2));
    }
    process(inputs, outputs, P) {
      const out = outputs[0], oL = out[0], oR = out[1] || out[0], n = oL.length, inp = inputs[0] || [];
      const iL = inp[0], iR = inp[1] || inp[0], fs = sampleRate;
      const w = P.w[0], rate = Math.max(0.0625, P.rate[0]), stereo = P.mode[0] >= 0.5, el = P.el[0], dist = P.dist[0];
      const bpm = P.bpm[0] > 0 ? P.bpm[0] : 120;
      if (el !== this.lastEl) this.elev(el);
      // higher up / further away = less side to side; fast orbits get less ITD (no Doppler warble)
      const lat = Math.cos((el * Math.PI) / 4) * (1 - 0.3 * dist), fOrb = bpm / 60 / rate;
      const itdMax = Math.min(0.00066 * fs, (0.012 * fs) / (2 * Math.PI * fOrb));
      const tdg = Math.pow(10, (-9 * dist) / 20), teg = Math.pow(10, (-2 * Math.abs(el)) / 20), tm = P.mono[0];
      const fAir = 20000 * Math.pow(0.15, dist); // air absorption: 20 kHz (near) -> 3 kHz (far)
      const K = this.K, ik = this.ik, sa1 = this.sa1, kc = this.first ? 0 : this.kc, buf = this.buf;
      const xb0 = this.xb0, xb1 = this.xb1, xa1 = this.xa1, xa2 = this.xa2;
      const eb0 = this.eb0, eb1 = this.eb1, eb2 = this.eb2, ea1 = this.ea1, ea2 = this.ea2;
      let { gL, gR, dL, dR, aL, aR, ac, am, dg, eg, m, tgL, tgR, tdL, tdR, taL, taR, tac, tam } = this;
      for (let i = 0; i < n; i++) {
        if ((i & 15) === 0) {
          // where the source is: phase of the orbit from the song beat (so a loop replays the same)
          let ph = kdBeat(this.clock, currentTime + i / fs, bpm) / rate;
          ph -= Math.floor(ph);
          const cs = Math.cos(2 * Math.PI * ph), sn = Math.sin(2 * Math.PI * ph);
          let bk = 0;
          if (stereo) {
            // pan -1..1, the sine squares up past 70 % width (hard L/R at 100 %)
            const h = Math.min(1, Math.max(0, (w - 0.7) / 0.3)), k = 24 * h * h;
            const p = (w * lat * (1 + k) * cs) / (1 + k * Math.abs(cs)), th = ((p + 1) * Math.PI) / 4;
            tgL = Math.SQRT2 * Math.cos(th); tgR = Math.SQRT2 * Math.sin(th); tdL = 0; tdR = 0; taL = 1; taR = 1;
          } else {
            // lateral position p (+ = right): far ear delayed (Woodworth) and shadowed, near ear a bit brighter
            const p = w * lat * cs, q = Math.min(1, Math.abs(p)), d = (itdMax * (Math.asin(q) + q)) / (Math.PI / 2 + 1);
            const near = Math.pow(10, (3 * q) / 20), far = Math.pow(10, (-16 * q) / 20);
            tdL = p > 0 ? d : 0; tdR = p < 0 ? d : 0; taL = p > 0 ? far : near; taR = p > 0 ? near : far; tgL = 1; tgR = 1;
            bk = w * lat * Math.max(0, sn); // behind the head: a little darker
          }
          tac = 1 - Math.exp((-2 * Math.PI * Math.min(0.45 * fs, fAir * Math.pow(0.45, bk))) / fs);
          tam = Math.min(1, 8 * Math.max(dist, bk));
          if (this.first) { gL = tgL; gR = tgR; dL = tdL; dR = tdR; aL = taL; aR = taR; ac = tac; am = tam; dg = tdg; eg = teg; m = tm; this.first = false; }
        }
        gL = tgL + (gL - tgL) * kc; gR = tgR + (gR - tgR) * kc; dL = tdL + (dL - tdL) * kc; dR = tdR + (dR - tdR) * kc;
        aL = taL + (aL - taL) * kc; aR = taR + (aR - taR) * kc; ac = tac + (ac - tac) * kc; am = tam + (am - tam) * kc;
        dg = tdg + (dg - tdg) * kc; eg = teg + (eg - teg) * kc; m = tm + (m - tm) * kc;
        const xl = iL ? iL[i] : 0, xr = iR ? iR[i] : xl, M = 0.5 * (xl + xr), S = 0.5 * (xl - xr);
        // crossover (TDF2): low stays put, H orbits
        const low = xb0 * M + this.x1;
        this.x1 = xb1 * M - xa1 * low + this.x2; this.x2 = xb0 * M - xa2 * low;
        const H = M - low;
        // elevation filter + level, into the ear delay line
        const he = eb0 * H + this.e1;
        this.e1 = eb1 * H - ea1 * he + this.e2; this.e2 = eb2 * H - ea2 * he;
        this.wi = (this.wi + 1) & 255; buf[this.wi] = he * eg;
        const yl = this.read(dL), yr = this.read(dR);
        // head shadow shelves (a = 1: exactly no filter)
        const zl = ((K + aL) * yl + (K - aL) * this.sxl) * ik - sa1 * this.syl; this.sxl = yl; this.syl = zl;
        const zr = ((K + aR) * yr + (K - aR) * this.sxr) * ik - sa1 * this.syr; this.sxr = yr; this.syr = zr;
        let ol = low + (1 - m) * S + gL * zl, or = low - (1 - m) * S + gR * zr;
        // air absorption + distance level (same on both ears, so the lows stay centred)
        this.lpl += ac * (ol - this.lpl); this.lpr += ac * (or - this.lpr);
        ol += am * (this.lpl - ol); or += am * (this.lpr - or);
        oL[i] = ol * dg; oR[i] = or * dg;
      }
      Object.assign(this, { gL, gR, dL: kdFl(dL), dR: kdFl(dR), aL, aR, ac, am: kdFl(am), dg, eg, m, tgL, tgR, tdL, tdR, taL, taR, tac, tam });
      this.gL = kdFl(this.gL); this.gR = kdFl(this.gR);
      this.x1 = kdFl(this.x1); this.x2 = kdFl(this.x2); this.e1 = kdFl(this.e1); this.e2 = kdFl(this.e2);
      this.sxl = kdFl(this.sxl); this.syl = kdFl(this.syl); this.sxr = kdFl(this.sxr); this.syr = kdFl(this.syr);
      this.lpl = kdFl(this.lpl); this.lpr = kdFl(this.lpr);
      return this.alive;
    }
  });
  `;

    // no worklet yet: a StereoPanner swung by an LFO (not beat-locked, low end not split)
    function native(ctx) {
      const input = ctx.createGain(), pan = ctx.createStereoPanner(), lfo = ctx.createOscillator(), dep = ctx.createGain(), put = SP.setter(ctx);
      input.channelCount = 2; input.channelCountMode = "explicit"; input.channelInterpretation = "speakers"; // mono -> L = R, so pan 0 = dry
      dep.gain.value = 0; input.connect(pan); lfo.connect(dep); dep.connect(pan.pan); lfo.start();
      return {
        input, output: pan, latency: 0,
        set(s) { const e = settings(s); put(lfo.frequency, e.bpm / 60 / e.rate); put(dep.gain, 0.8 * e.w); },
        destroy() { try { lfo.stop(); } catch (e) { /* gone */ } SP.off(input, pan, lfo, dep); },
      };
    }

    K.register({
      id: "orbit", num: 23, name: "ORBIT", group: "DYNAMICS & MOVEMENT",
      caption: "Hats circling your head.",
      axes: { x: "RATE", y: "WIDTH" },
      // optional for the tab: what the axes mean at a dot position (X = time per orbit)
      axisFmt: { x: (v) => rateOf(v)[1], y: (v) => Math.round(K.clamp(v) * 100) + "%" },
      dials: [
        { id: "elev", name: "ELEVATION", def: 0.5, fmt: (v) => { const d = elevOf(v); return d === 0 ? "ear level" : (d > 0 ? "+" : "") + d + " deg"; } },
        { id: "dist", name: "DISTANCE", def: 0, fmt: (v) => { const m = distOf(v); return (m < 10 ? m.toFixed(1) : Math.round(m)) + " m"; } },
      ],
      toggles: [{ id: "mode", name: "MODE", options: ["3D", "STEREO"], def: 0 }],
      presets: [
        // 2 bars per orbit, full circle round the head, a little above it (+22 deg), close
        { name: "Halo Hats", voice: "hats", x: 0.31, y: 1, wet: 1, dials: { elev: 0.75, dist: 0.15 }, toggles: { mode: 0 } },
        // 1/8 per swing cycle, full width: squared into hard left / right (16ths alternate sides)
        { name: "Bounce", voice: "perc", x: 0.8, y: 1, wet: 1, dials: { elev: 0.5, dist: 0 }, toggles: { mode: 1 } },
        // 4 bars per orbit, 70 % swing: each snare a little further round, right -> behind -> left
        { name: "Wide Snare", voice: "snare", x: 0.2, y: 0.7, strength: 1.5, wet: 1, dials: { elev: 0.5, dist: 0.2 }, toggles: { mode: 0 } },
        // width 0 at the bottom rim: no movement, a stereo kick folds to mono, low end dead centre
        { name: "Center Kick", voice: "kick", x: 0.5, y: 0, wet: 1, dials: { elev: 0.5, dist: 0 }, toggles: { mode: 1 } },
      ],
      worklets: { [NAME]: SRC },
      create(ctx, env) {
        if (!K.hasWorklet(ctx, NAME)) return native(ctx);
        const node = SP.node(ctx, NAME, { bpm: (env && env.bpm) || 120 }, { clock: SP.clock(ctx, env), seed: env && env.seed });
        const P = (id) => node.parameters.get(id), put = SP.setter(ctx), last = {};
        const jump = (id, v) => { if (last[id] === v) return; last[id] = v; const p = P(id); p.cancelScheduledValues(0); p.setValueAtTime(v, ctx.currentTime); }; // stepped settings
        return {
          input: node, output: node, latency: 0,
          set(s) {
            const e = settings(s);
            jump("rate", e.rate); jump("mode", e.mode); jump("bpm", e.bpm);
            put(P("w"), e.w); put(P("el"), e.el); put(P("dist"), e.dist); put(P("mono"), e.mono);
          },
          destroy() { SP.bye(node); },
        };
      },
    });
  })();
})();
