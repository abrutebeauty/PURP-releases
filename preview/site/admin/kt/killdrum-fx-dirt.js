// KILLDRUM FX, group 4: DISTORTION & DESTRUCTION (16 BITCRUSH, 17 WAVEFOLD, 18 TAPE DRIVE, 19 RING MOD)
// and GLITCH & CHAOS (28 CHANCE ENGINE, 29 LO-FI, 30 MORPH), from Eman's DRUM_PORTAL_SPEC_V1.
// Each effect registers itself with KdFx (ui/killdrum-fx-core.js); the FX tab (ui/killdrum-fx.js) runs
// one instance per drum voice. Interface: /mnt/project-files/killdrum/FX-MODULE.md.
// Test: node scripts/killdrum-fx-dirt-test.js (renders every preset offline, checks level, NaN, DC).

// 16 BITCRUSH: crunchy 8-bit and SP-1200 grit. X = bit depth (24 -> 1), Y = downsample (the
// context rate -> 800 Hz). Both are pulled back to clean by the dot's amount (in log space, so the
// middle of the circle already crunches). The per-sample work (sample-and-hold, rounding) runs in
// the "kdfx-bitcrush" AudioWorklet; without it a WaveShaper does the bit rounding only.
(function () {
  "use strict";
  const K = window.KdFx;
  const clamp = K.clamp;
  const SP_RATE = 26040; // the SP-1200's sample rate
  const MIN_RATE = 800;

  // The processor. Stringified below, so it runs in the worklet scope (no window, no KdFx).
  function proc() {
    const TAU = 2 * Math.PI;
    // 2-pole low-pass (Simper's state-variable filter, Q 0.707): coefficients for fc at sr
    const svf = (fc, sr, o) => {
      const g = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr), k = Math.SQRT2;
      o.a1 = 1 / (1 + g * (g + k)); o.a2 = g * o.a1; o.a3 = g * o.a2;
    };
    // how much of a filter at fc to use: none when it would sit at the top of the band anyway
    const fadeIn = (fc, sr) => Math.max(0, Math.min(1, (sr * 0.45 - fc) / (sr * 0.1)));
    class BitcrushProc extends AudioWorkletProcessor {
      static get parameterDescriptors() {
        const p = (name, def, min, max) => ({ name, defaultValue: def, minValue: min, maxValue: max, automationRate: "k-rate" });
        return [
          p("bits", 24, 1, 24),        // bit depth, fractional bits glide
          p("rate", 192000, 50, 192000), // hold rate in Hz (>= the context rate = no downsample)
          p("jitter", 0, 0, 1),        // random wobble of each hold period (0.6 = +-60 %)
          p("dither", 0, 0, 4),        // TPDF noise before rounding, in LSB (peak)
          p("aa", 0, 0, 1),            // anti-alias filters (before the hold, gentle one after)
          p("sat", 0, 0, 1),           // SP mode: saturating input (mix)
          p("dark", 96000, 20, 96000), // SP mode: output low-pass in Hz (above ~0.45 x rate = off)
          p("dc", 0, 0, 1),            // DC blocker strength (follows the amount)
        ];
      }
      constructor(opt) {
        super();
        const o = (opt && opt.processorOptions) || {};
        this.seed = (o.seed >>> 0) || 1;
        this.closed = false;
        this.port.onmessage = (e) => { if (e.data && e.data.close) this.closed = true; };
        this.phase = 0; this.stepCur = 1;
        this.held = [0, 0]; this.prev = [0, 0];
        this.pre = [[0, 0], [0, 0]]; this.dk = [[0, 0], [0, 0]]; this.post = [0, 0];
        this.dcx = [0, 0]; this.dcy = [0, 0]; this.xs = [0, 0];
        this.states = [this.pre[0], this.pre[1], this.dk[0], this.dk[1]];
        this.env = 0; this.pin = 0; this.pout = 0; this.gain = 1;
        this.cPre = { a1: 1, a2: 0, a3: 0 }; this.cDark = { a1: 1, a2: 0, a3: 0 };
        this.relEnv = Math.exp(-1 / (0.15 * sampleRate));
        this.cPow = 1 - Math.exp(-1 / (0.05 * sampleRate));
      }
      rnd() { // xorshift32, seeded: the same loop crunches the same way every pass
        let s = this.seed; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.seed = s >>> 0;
        return this.seed / 4294967296;
      }
      process(inputs, outputs, P) {
        if (this.closed) return false;
        const inp = inputs[0], out = outputs[0], n = out[0].length, sr = sampleRate;
        if (!inp || !inp.length) { for (const ch of out) ch.fill(0); return true; }
        const nIn = Math.min(2, inp.length), nOut = Math.min(2, out.length);
        const bits = Math.max(1, Math.min(24, P.bits[0]));
        const steps = Math.pow(2, bits - 1);
        // below ~8 bits round relative to a slow peak follower, so tails crunch instead of vanishing
        let rel = Math.max(0, Math.min(1, (8 - bits) / 4)); rel = rel * rel * (3 - 2 * rel);
        const rate = P.rate[0], step = rate / sr, jit = Math.min(0.6, P.jitter[0]);
        const dith = P.dither[0], aa = P.aa[0], sat = P.sat[0];
        const fPre = rate * 0.45, wPre = aa * fadeIn(fPre, sr);
        if (wPre > 0) svf(fPre, sr, this.cPre);
        const fPost = rate * 0.5, wPost = aa * fadeIn(fPost, sr), cPost = 1 - Math.exp(-TAU * Math.min(fPost, sr * 0.45) / sr);
        const fDark = P.dark[0], wDark = fadeIn(fDark, sr);
        if (wDark > 0) svf(fDark, sr, this.cDark);
        const R = 1 - (TAU * 5 / sr) * P.dc[0];
        // makeup: match the input's loudness below 8 bits (fewer bits = square waves = louder)
        let gT = Math.sqrt((this.pin + 1e-8) / (this.pout + 1e-8));
        gT = 1 + (Math.max(0.3, Math.min(1.3, gT)) - 1) * rel;
        const g0 = this.gain, g1 = (this.gain += (gT - this.gain) * 0.12);
        const relEnv = this.relEnv, cPow = this.cPow;
        const cp = this.cPre, cd = this.cDark;
        for (let i = 0; i < n; i++) {
          // input (+ SP saturation), anti-alias pre-filter, peak follower
          let xin = 0, ePk = 0;
          const xs = this.xs;
          for (let c = 0; c < nIn; c++) {
            const x0 = inp[c][i];
            xin += x0 * x0;
            let x = sat > 0 ? x0 + (Math.tanh(x0) - x0) * sat : x0;
            if (wPre > 0) {
              const s = this.pre[c], v3 = x - s[1], v1 = cp.a1 * s[0] + cp.a2 * v3, v2 = s[1] + cp.a2 * s[0] + cp.a3 * v3;
              s[0] = 2 * v1 - s[0]; s[1] = 2 * v2 - s[1];
              x += (v2 - x) * wPre;
            }
            xs[c] = x;
            const a = Math.abs(x); if (a > ePk) ePk = a;
          }
          this.env = Math.max(ePk, this.env * relEnv);
          const env = this.env < 1e-12 ? 0 : this.env;
          // sample-and-hold that can sit between samples (Crush.h / DeRez), so the rate glides
          this.phase += this.stepCur;
          let grab = false, frac = 0;
          if (this.phase >= 1) {
            grab = true;
            const w = Math.floor(this.phase);
            frac = Math.min(1, (this.phase - w) / this.stepCur);
            this.phase -= w;
            this.stepCur = jit > 0 ? step / (1 + jit * (2 * this.rnd() - 1)) : step;
          }
          const ref = 1 + (Math.max(env, 1e-5) - 1) * rel, lsb = ref / steps, lim = Math.max(env, ref);
          const dAmp = dith > 0 ? dith * lsb * (env / (env + 0.25 * lsb)) : 0;
          const g = g0 + (g1 - g0) * (i / n);
          let yout = 0;
          for (let c = 0; c < nIn; c++) {
            const x = xs[c];
            if (grab) {
              let at = x + (this.prev[c] - x) * frac;
              if (dAmp > 0) at += (this.rnd() - this.rnd()) * dAmp;
              const q = Math.round(at / lsb) * lsb; // never past the input's own peak (dither at 1-2 bits)
              this.held[c] = q > lim ? lim : q < -lim ? -lim : q;
            }
            this.prev[c] = x;
            let y = this.held[c];
            if (wPost > 0) { this.post[c] += (y - this.post[c]) * cPost; y += (this.post[c] - y) * wPost; } else this.post[c] = y;
            if (wDark > 0) {
              const s = this.dk[c], v3 = y - s[1], v1 = cd.a1 * s[0] + cd.a2 * v3, v2 = s[1] + cd.a2 * s[0] + cd.a3 * v3;
              s[0] = 2 * v1 - s[0]; s[1] = 2 * v2 - s[1];
              y += (v2 - y) * wDark;
            }
            const d = y - this.dcx[c] + R * this.dcy[c];
            this.dcx[c] = y; this.dcy[c] = Math.abs(d) < 1e-20 ? 0 : d;
            yout += d * d;
            let o = d * g;
            o = o !== o ? 0 : o > 1.95 ? 1.95 : o < -1.95 ? -1.95 : o; // NaN guard + last-resort limit
            if (c < nOut) out[c][i] = o;
          }
          this.pin += (xin / nIn - this.pin) * cPow;
          this.pout += (yout / nIn - this.pout) * cPow;
          if (nIn === 1 && nOut > 1) out[1][i] = out[0][i];
        }
        // flush the filter states (denormals)
        for (let j = 0; j < 4; j++) { const s = this.states[j]; if (Math.abs(s[0]) < 1e-20) s[0] = 0; if (Math.abs(s[1]) < 1e-20) s[1] = 0; }
        if (this.pin < 1e-20) this.pin = 0;
        if (this.pout < 1e-20) this.pout = 0;
        return true;
      }
    }
    registerProcessor("kdfx-bitcrush", BitcrushProc);
  }

  // the musical mapping: dot -> bits, hold rate, jitter...
  function settings(s, sr) {
    const a = clamp(s.amount), x = clamp(s.x), y = clamp(s.y), d = s.dials || {}, t = s.toggles || {};
    const sp = !!t.sp;
    let bits, rate;
    if (sp) { // SP-1200 curve: X runs 12 -> 1 bits, Y starts at 26.04 kHz
      bits = 24 * Math.pow((12 * Math.pow(1 / 12, x)) / 24, a);
      rate = sr * Math.pow((SP_RATE * Math.pow(MIN_RATE / SP_RATE, y)) / sr, a);
    } else {
      bits = 24 * Math.pow(1 / 24, x * a);
      rate = sr * Math.pow(MIN_RATE / sr, y * a);
    }
    return {
      bits, rate,
      jitter: clamp(d.jitter != null ? d.jitter : 0) * 0.6 * a,
      dither: clamp(d.dither != null ? d.dither : 0) * 2,
      aa: t.antialias ? 1 : 0,
      sat: sp ? a : 0,
      dark: sp ? Math.exp(Math.log(sr * 0.5) + (Math.log(12000) - Math.log(sr * 0.5)) * a) : sr * 0.5,
      dc: a,
    };
  }

  // fallback (no worklet): a WaveShaper that rounds to the bit depth (no downsample). The curve
  // covers -2..2 (input scaled by 0.5), so hot hits pass instead of clipping.
  const curves = new Map();
  function bitCurve(bits) {
    const b = Math.round(bits * 2) / 2;
    if (b >= 11) return null; // finer than the table can show: pass through
    if (curves.has(b)) return curves.get(b);
    const n = 8192, c = new Float32Array(n), steps = Math.pow(2, b - 1);
    for (let i = 0; i < n; i++) { const v = ((i / (n - 1)) * 2 - 1) * 2; c[i] = Math.round(v * steps) / steps; }
    curves.set(b, c);
    return c;
  }
  const IDENT = new Float32Array([-2, 2]); // u -> 2u: undoes the 0.5 input scaling
  const UNITY = new Float32Array([-1, 1]);

  K.register({
    id: "bitcrush", num: 16, name: "BITCRUSH", group: "DISTORTION & DESTRUCTION",
    caption: "Crunchy 8-bit and SP-1200 grit.",
    axes: { x: "BIT DEPTH", y: "DOWNSAMPLE" },
    dials: [
      { id: "jitter", name: "JITTER", def: 0, fmt: (v) => "+-" + Math.round(clamp(v) * 60) + "%" },
      { id: "dither", name: "DITHER", def: 0, fmt: (v) => (clamp(v) * 2).toFixed(1) + " LSB" },
    ],
    toggles: [
      { id: "antialias", name: "ANTI-ALIAS", def: false },
      { id: "sp", name: "SP MODE", def: false },
    ],
    presets: [
      // where they land: SP Snare 12-bit 26.04 kHz (SP mode: the bottom-left rim is the SP-1200 itself),
      // Nintendo Hats 4.1-bit 4.2 kHz, Grit Kick 10-bit 11.8 kHz (STRENGTH 0.37: turn it up for more), Broken Radio 2-bit 4.9 kHz +-38 % jitter
      { name: "SP Snare", voice: "snare", x: 0, y: 0, wet: 0.9, dials: { jitter: 0, dither: 0 }, toggles: { antialias: false, sp: true } },
      { name: "Nintendo Hats", voice: "hats", x: 0.76, y: 0.8, wet: 0.85, dials: { jitter: 0, dither: 0 }, toggles: { antialias: false, sp: false } },
      { name: "Grit Kick", voice: "kick", x: 0.8, y: 0.95, strength: 0.37, wet: 0.8, dials: { jitter: 0, dither: 0.4 }, toggles: { antialias: false, sp: false } },
      { name: "Broken Radio", voice: "perc", x: 0.92, y: 0.64, wet: 0.85, dials: { jitter: 0.75, dither: 0.5 }, toggles: { antialias: true, sp: false } },
    ],
    worklets: { "kdfx-bitcrush": "(" + proc.toString() + ")();" },

    create(ctx, env) {
      const sr = ctx.sampleRate;
      const input = ctx.createGain(), output = ctx.createGain();
      let first = true;
      const put = (param, v) => {
        if (!param || !isFinite(v)) return;
        if (first) { param.cancelScheduledValues(0); param.setValueAtTime(v, ctx.currentTime); } else K.ramp(param, v, ctx);
      };

      if (K.hasWorklet(ctx, "kdfx-bitcrush")) {
        const node = new AudioWorkletNode(ctx, "kdfx-bitcrush", {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
          processorOptions: { seed: ((env && env.seed) >>> 0) + 16 },
        });
        input.connect(node); node.connect(output);
        return {
          input, output, latency: 0,
          set(s) {
            const v = settings(s, sr);
            for (const k of ["bits", "rate", "jitter", "dither", "aa", "sat", "dark", "dc"]) put(node.parameters.get(k), v[k]);
            first = false;
          },
          destroy() {
            try { node.port.postMessage({ close: true }); } catch (e) { /* already gone */ }
            for (const nd of [input, node, output]) try { nd.disconnect(); } catch (e) { /* not connected */ }
          },
        };
      }

      // fallback: bit rounding (WaveShaper), SP mode's soft input and darker top (no downsample)
      const pre = ctx.createGain(), sat = ctx.createWaveShaper(), shaper = ctx.createWaveShaper();
      const dark = ctx.createBiquadFilter();
      pre.gain.value = 0.5;
      sat.curve = UNITY; shaper.curve = IDENT;
      dark.type = "lowpass"; dark.Q.value = 0.707; dark.frequency.value = sr * 0.5;
      input.connect(pre); pre.connect(sat); sat.connect(shaper); shaper.connect(dark); dark.connect(output);
      let lastCurve = IDENT, lastSat = UNITY;
      const satCurve = (m) => { // tanh blended by m; works on the half-scaled signal u = x / 2
        const k = Math.round(m * 10) / 10, key = "s" + k;
        if (curves.has(key)) return curves.get(key);
        const n = 2048, c = new Float32Array(n);
        for (let i = 0; i < n; i++) { const v = ((i / (n - 1)) * 2 - 1) * 2; c[i] = (v + (Math.tanh(v) - v) * k) / 2; }
        curves.set(key, c);
        return c;
      };
      return {
        input, output, latency: 0,
        set(s) {
          const v = settings(s, sr);
          const c = bitCurve(v.bits) || IDENT;
          if (c !== lastCurve) { shaper.curve = c; lastCurve = c; }
          const sc = v.sat > 0.05 ? satCurve(v.sat) : UNITY;
          if (sc !== lastSat) { sat.curve = sc; lastSat = sc; }
          put(dark.frequency, Math.min(v.dark, sr * 0.5));
          first = false;
        },
        destroy() { for (const nd of [input, pre, sat, shaper, dark, output]) try { nd.disconnect(); } catch (e) { /* not connected */ } },
      };
    },
  });
})();

// KILLDRUM FX 17 WAVEFOLD: folds the wave back on itself. A soft-knee triangle fold (gain from X,
// offset from Y for asymmetry), then up to 3 more sine-fold stages, all at 2x/4x/8x oversampling
// (the 47-tap Kaiser halfband from TmOversample.h, cascaded). A level follower keeps the folded
// sound about as loud as the dry, a DC blocker removes what the asymmetry leaves, then POST FILTER.
(function () {
  "use strict";
  const K = window.KdFx;
  const clamp = K.clamp;
  const LAT = 30;          // samples of delay, the same for 2X, 4X and 8X (see the worklet)
  const BMAX = 1.0;        // symmetry offset at the Y edges (1 = the fold point)
  const CMAX = 2.6;        // how hard each extra stage folds at amount 1
  const KNEE = 0.2;        // rounded corners on the triangle fold

  // the triangle fold with rounded corners: straight in -0.8..0.8, reflects at +-1
  function softTri(u) {
    let q = u + 1; q -= 4 * Math.floor(q * 0.25);
    let t = q < 2 ? q - 1 : 3 - q;
    const dt = Math.abs(q - 2);
    if (dt < KNEE) t = 1 - (dt * dt + KNEE * KNEE) / (2 * KNEE);
    else { const db = q < 2 ? q : 4 - q; if (db < KNEE) t = -1 + (db * db + KNEE * KNEE) / (2 * KNEE); }
    return t;
  }

  // ------------------------------------------------------------------ the worklet
  function proc() {
    const KNEE = 0.2, HALF_PI = Math.PI / 2;
    // Kaiser halfband (same math as Source/dsp/toymachine/TmOversample.h), any 4k+3 taps
    function halfband(taps) {
      const centre = (taps - 1) >> 1, sides = (centre + 1) >> 1, beta = 7.857;
      const i0 = (x) => { let s = 1, t = 1; for (let k = 1; k < 40; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; } return s; };
      const d = new Float64Array(sides);
      let norm = 0;
      for (let j = 0; j < sides; j++) {
        const n = 2 * j + 1, r = n / centre;
        d[j] = (Math.sin(0.5 * Math.PI * n) / (Math.PI * n)) * (i0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / i0(beta));
        norm += 2 * d[j];
      }
      const h = new Float64Array(sides);
      for (let j = 0; j < sides; j++) h[j] = (d[j] * 0.5) / norm;
      return { taps, centre, sides, h };
    }
    // base<->2x gets the full 47 taps; the inner stages only guard the base band, so they are shorter.
    // An up+down pair delays by (centre - 0.5) samples at its lower rate: 2X 22.5, 4X 27.75,
    // 8X 29.875 base samples. A plain delay at the top rate pads each to 30: 15 / 9 / 1 samples.
    const HB = [halfband(47), halfband(23), halfband(19)];
    const FAC = [2, 4, 8], PAD = [15, 9, 1], LAT = 30, MAXN = 128;

    class Up2 {
      constructor(D) { this.D = D; this.len = 2 * D.sides; this.buf = new Float64Array(2 * this.len); this.w = 0; }
      reset() { this.buf.fill(0); this.w = 0; }
      run(src, dst, n) {
        const h = this.D.h, S = this.D.sides, len = this.len, buf = this.buf;
        let w = this.w;
        for (let i = 0; i < n; i++) {
          const x = src[i];
          buf[w] = x; buf[w + len] = x;
          if (++w === len) w = 0;
          let s = 0;
          for (let j = 0; j < S; j++) s += h[j] * (buf[w + S + j] + buf[w + S - 1 - j]);
          dst[2 * i] = 2 * s;
          dst[2 * i + 1] = buf[w + S];
        }
        this.w = w;
      }
    }
    class Down2 {
      constructor(D) { this.D = D; this.buf = new Float64Array(2 * D.taps); this.w = 0; }
      reset() { this.buf.fill(0); this.w = 0; }
      run(src, dst, n) {
        const h = this.D.h, S = this.D.sides, T = this.D.taps, C = this.D.centre, buf = this.buf;
        let w = this.w;
        for (let i = 0; i < n; i++) {
          const a = src[2 * i], b = src[2 * i + 1];
          buf[w] = a; buf[w + T] = a; if (++w === T) w = 0;
          buf[w] = b; buf[w + T] = b; if (++w === T) w = 0;
          const x0 = w + C;
          let y = 0.5 * buf[x0];
          for (let j = 0; j < S; j++) y += h[j] * (buf[x0 + 2 * j + 1] + buf[x0 - 2 * j - 1]);
          dst[i] = y;
        }
        this.w = w;
      }
    }
    function softTri(u) {
      let q = u + 1; q -= 4 * Math.floor(q * 0.25);
      let t = q < 2 ? q - 1 : 3 - q;
      const dt = q < 2 ? 2 - q : q - 2;
      if (dt < KNEE) t = 1 - (dt * dt + KNEE * KNEE) / (2 * KNEE);
      else { const db = q < 2 ? q : 4 - q; if (db < KNEE) t = -1 + (db * db + KNEE * KNEE) / (2 * KNEE); }
      return t;
    }

    class P extends AudioWorkletProcessor {
      static get parameterDescriptors() {
        return [
          { name: "gain", defaultValue: 1, minValue: 1, maxValue: 16, automationRate: "k-rate" },
          { name: "bias", defaultValue: 0, minValue: -1.5, maxValue: 1.5, automationRate: "k-rate" },
          { name: "stages", defaultValue: 1, minValue: 1, maxValue: 4, automationRate: "k-rate" },
          { name: "shape", defaultValue: 0, minValue: 0, maxValue: 4, automationRate: "k-rate" },
          { name: "post", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
          { name: "amount", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
          { name: "os", defaultValue: 1, minValue: 0, maxValue: 2, automationRate: "k-rate" },
        ];
      }
      constructor() {
        super();
        this.alive = true;
        this.port.onmessage = (e) => { if (e.data && e.data.close) this.alive = false; };
        this.ch = [0, 1].map(() => ({
          up: HB.map((D) => new Up2(D)), down: HB.map((D) => new Down2(D)),
          pad: new Float64Array(16), pw: 0, dry: new Float64Array(LAT), dw: 0,
          eIn: 0, eOut: 0, dx: 0, dy: 0, s1: 0, s2: 0,
        }));
        this.b1 = new Float64Array(MAXN); this.b2 = new Float64Array(2 * MAXN);
        this.b4 = new Float64Array(4 * MAXN); this.b8 = new Float64Array(8 * MAXN);
        this.os = 1; this.fade = 1; this.quiet = 0; this.asleep = false;
        this.pg = 1; this.pb = 0; this.pc = 0; this.po = 0; this.pm = 0;
      }
      resetCh(c) {
        for (const u of c.up) u.reset();
        for (const d of c.down) d.reset();
        c.pad.fill(0); c.pw = 0; c.eIn = c.eOut = c.dx = c.dy = c.s1 = c.s2 = 0;
      }
      // the folder with no input: what the offset alone makes (subtracted, so silence stays silent)
      chain0(b, c, S) {
        let y = softTri(b), prev = y;
        const n = Math.floor(S), fr = S - n, sc = c > 1e-4 ? 1 / Math.sin(Math.min(c, HALF_PI)) : 1;
        for (let k = 1; k < n; k++) { prev = y; y = c > 1e-4 ? Math.sin(c * y) * sc : y; }
        if (fr > 0 && n < 4) { const nx = c > 1e-4 ? Math.sin(c * y) * sc : y; return y + fr * (nx - y); }
        return y;
      }
      process(inputs, outputs, params) {
        if (!this.alive) return false;
        const inp = inputs[0], out = outputs[0], n = out[0].length;
        const nIn = inp ? inp.length : 0;
        let peak = 0;
        for (let c = 0; c < nIn; c++) { const a = inp[c]; for (let i = 0; i < n; i++) { const v = a[i] < 0 ? -a[i] : a[i]; if (v > peak) peak = v; } }
        if (peak < 1e-6) { if (++this.quiet > 2 && !this.asleep) { this.asleep = true; for (const c of this.ch) { this.resetCh(c); c.dry.fill(0); } } }
        else { this.quiet = 0; this.asleep = false; }
        if (this.asleep || n > MAXN) { for (const o of out) o.fill(0); return true; }

        const g1 = params.gain[0], b1 = params.bias[0], S = params.stages[0], c1 = params.shape[0];
        const amt = params.amount[0], post = params.post[0] * 1, osWant = Math.round(params.os[0]);
        // dry/fold crossfade near amount 0, so the centre of the circle is exactly the dry sound
        const m1 = Math.min(1, amt * 10), m0 = this.pm;
        const o1 = this.chain0(b1, c1, S);
        const nStage = Math.floor(S), fr = S - nStage;
        // small-signal gain of the whole chain (the level follower starts from 1/G)
        const sg = c1 > 1e-4 ? c1 / Math.sin(Math.min(c1, HALF_PI)) : 1;
        const Gm = g1 * (Math.pow(sg, nStage - 1) * (1 - fr) + Math.pow(sg, Math.min(3, nStage)) * fr);
        const compMax = 4 / Math.max(1, Gm);
        // oversampling change: fade out, switch, fade back in
        let fadeTo = 1;
        if (osWant !== this.os) { if (this.fade <= 0) { this.os = osWant; for (const c of this.ch) this.resetCh(c); } else fadeTo = 0; }
        const os = this.os, F = FAC[os], P = PAD[os];
        const sr = sampleRate, atk = 1 - Math.exp(-1 / (0.002 * sr * F)), rel = 1 - Math.exp(-1 / (0.03 * sr * F));
        // DC blocker: higher when the offset is big, so a rectified fold doesn't thump
        const R = 1 - (2 * Math.PI * (2 + 18 * amt + 80 * Math.abs(b1))) / sr;
        // post filter: 2-pole low-pass, 20 kHz (open) down to 400 Hz; faded in over the first 5 %
        const fc = Math.min(0.45 * sr, 20000 * Math.pow(0.02, post));
        const pmix = Math.min(1, post * 20), pgain = 1 + post;   // makeup for what the low-pass takes away
        const gq = Math.tan((Math.PI * fc) / sr), kq = 1 / 0.8, a1 = 1 / (1 + gq * (gq + kq)), a2 = gq * a1, a3 = gq * a2;
        const doFold = m1 > 0 || m0 > 0;
        const nCh = nIn >= 2 ? 2 : 1;
        for (let ci = 0; ci < nCh; ci++) {
          const c = this.ch[ci], src = nIn ? inp[ci] : null, dst = out[ci];
          const b1x = this.b1;
          for (let i = 0; i < n; i++) b1x[i] = src ? src[i] : 0;
          if (!doFold) {
            for (let i = 0; i < n; i++) { const v = c.dry[c.dw]; c.dry[c.dw] = b1x[i]; if (++c.dw === LAT) c.dw = 0; dst[i] = v; }
            this.resetCh(c);
            continue;
          }
          // up to the folding rate
          const top = F === 2 ? this.b2 : F === 4 ? this.b4 : this.b8;
          c.up[0].run(b1x, this.b2, n);
          if (F >= 4) c.up[1].run(this.b2, this.b4, 2 * n);
          if (F === 8) c.up[2].run(this.b4, this.b8, 4 * n);
          // fold, per base sample the parameters glide from the last block's values
          let g = this.pg, b = this.pb, cc = this.pc, o = this.po;
          const dg = (g1 - g) / n, dbb = (b1 - b) / n, dc = (c1 - cc) / n, dO = (o1 - o) / n;
          let eIn = c.eIn, eOut = c.eOut, pw = c.pw;
          const pad = c.pad;
          for (let i = 0, k = 0; i < n; i++) {
            g += dg; b += dbb; cc += dc; o += dO;
            const live = cc > 1e-4, sc = live ? 1 / Math.sin(Math.min(cc, HALF_PI)) : 1;
            const comp = eIn > 1e-9 ? Math.min(compMax, eIn / (eOut + 1e-9)) : 1 / Math.max(1, Gm);
            for (let s = 0; s < F; s++, k++) {
              const v = top[k];
              let y = softTri(g * v + b);
              for (let st = 1; st < nStage; st++) y = live ? Math.sin(cc * y) * sc : y;
              if (fr > 0 && nStage < 4) { const nx = live ? Math.sin(cc * y) * sc : y; y += fr * (nx - y); }
              y -= o;
              const av = v < 0 ? -v : v, ay = y < 0 ? -y : y;
              eIn += (av - eIn) * (av > eIn ? atk : rel);
              eOut += (ay - eOut) * (ay > eOut ? atk : rel);
              const w = y * comp;
              top[k] = pad[pw]; pad[pw] = w; if (++pw >= P) pw = 0;
            }
          }
          c.eIn = eIn; c.eOut = eOut; c.pw = pw;
          // back down to the base rate
          if (F === 8) c.down[2].run(this.b8, this.b4, 4 * n);
          if (F >= 4) c.down[1].run(this.b4, this.b2, 2 * n);
          c.down[0].run(this.b2, b1x, n);
          // DC blocker, post filter, dry crossfade, safety soft limit
          let dx = c.dx, dy = c.dy, s1 = c.s1, s2 = c.s2, fd = this.fade;
          const fstep = (fadeTo - fd) / n, mstep = (m1 - m0) / n;
          let m = m0;
          for (let i = 0; i < n; i++) {
            const x = b1x[i];
            dy = x - dx + R * dy; dx = x;
            const v3 = dy - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
            s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
            let wv = (dy + pmix * (v2 - dy)) * pgain;
            const dryv = c.dry[c.dw]; c.dry[c.dw] = src ? src[i] : 0; if (++c.dw === LAT) c.dw = 0;
            fd += fstep; m += mstep;
            wv = dryv + m * (wv * fd - dryv);
            const aw = wv < 0 ? -wv : wv;
            if (aw > 1.2) wv = (wv < 0 ? -1 : 1) * (1.2 + 0.6 * Math.tanh((aw - 1.2) / 0.6));
            dst[i] = wv;
          }
          if (Math.abs(s1) < 1e-20) s1 = 0;
          if (Math.abs(s2) < 1e-20) s2 = 0;
          if (Math.abs(dy) < 1e-20) dy = 0;
          c.dx = dx; c.dy = dy; c.s1 = s1; c.s2 = s2;
        }
        if (nCh === 1 && out.length > 1) out[1].set(out[0]);
        this.fade = fadeTo; this.pm = m1;
        this.pg = g1; this.pb = b1; this.pc = c1; this.po = o1;
        return true;
      }
    }
    registerProcessor("kdfx-wavefold", P);
  }

  // ------------------------------------------------------------------ the fallback curve (native WaveShaper)
  const FB_R = 24;
  let fbCurve = null;
  const foldCurve = () => {
    if (fbCurve) return fbCurve;
    const n = 8193, c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = softTri(((i / (n - 1)) * 2 - 1) * FB_R);
    return (fbCurve = c);
  };

  // everything X/Y/amount/dials mean, in one place (both paths use it)
  function mapSettings(s) {
    const a = clamp(s.amount || 0), x = clamp(s.x == null ? 0.5 : s.x), y = clamp(s.y == null ? 0.5 : s.y);
    const d = s.dials || {}, t = s.toggles || {};
    const gx = 1.5 * Math.pow(8, x);                       // fold gain at full amount: 1.5 .. 12
    return {
      a,
      gain: Math.pow(gx, a),                               // 1 (no fold) at the centre
      bias: (y - 0.5) * 2 * BMAX * a,                      // symmetry: 0 at y = 0.5
      stages: 1 + 3 * clamp(d.stages == null ? 0 : d.stages),
      shape: CMAX * a,
      post: clamp(d.post == null ? 0 : d.post) * a,
      os: Math.max(0, Math.min(2, Math.round(t.oversample == null ? 1 : +t.oversample))),
    };
  }

  K.register({
    id: "wavefold", num: 17, name: "WAVEFOLD", group: "DISTORTION & DESTRUCTION",
    caption: "Folds the wave back on itself. Harsh, buzzy harmonics.",
    axes: { x: "FOLD", y: "SYMMETRY" },
    dials: [
      { id: "stages", name: "STAGES", def: 0, fmt: (v) => { const s = Math.round((1 + 3 * clamp(v)) * 10) / 10; return s + (s === 1 ? " stage" : " stages"); } },
      { id: "post", name: "POST FILTER", def: 0, fmt: (v) => (v < 0.02 ? "open" : K.fmt.hz(20000 * Math.pow(0.02, clamp(v))) + " LP") },
    ],
    toggles: [{ id: "oversample", name: "OVERSAMPLE", options: ["2X", "4X", "8X"], def: 1 }],
    presets: [
      { name: "Fold Kick", voice: "kick", x: 0.2, y: 0.4, wet: 0.7, dials: { stages: 0, post: 0.25 }, toggles: { oversample: 1 } },
      { name: "Razor Snare", voice: "snare", x: 0.88, y: 0.62, wet: 0.75, dials: { stages: 2 / 3, post: 0 }, toggles: { oversample: 1 } },
      { name: "Buzz Hats", voice: "hats", x: 0.62, y: 0.92, wet: 0.65, dials: { stages: 1 / 3, post: 0.1 }, toggles: { oversample: 0 } },
      { name: "Melt", voice: "perc", x: 1, y: 0.5, wet: 0.8, dials: { stages: 1 / 3, post: 0.85 }, toggles: { oversample: 1 } },
    ],
    worklets: { "kdfx-wavefold": "(" + proc.toString() + ")();" },
    create(ctx, env) {
      if (K.hasWorklet(ctx, "kdfx-wavefold")) {
        const node = new AudioWorkletNode(ctx, "kdfx-wavefold", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
        const P = (n) => node.parameters.get(n);
        let osNow = -1;
        return {
          input: node, output: node, latency: LAT / ctx.sampleRate,
          set(s) {
            const m = mapSettings(s);
            K.ramp(P("gain"), m.gain, ctx); K.ramp(P("bias"), m.bias, ctx); K.ramp(P("stages"), m.stages, ctx);
            K.ramp(P("shape"), m.shape, ctx); K.ramp(P("post"), m.post, ctx); K.ramp(P("amount"), m.a, ctx);
            if (m.os !== osNow) { osNow = m.os; P("os").setValueAtTime(m.os, ctx.currentTime); }
          },
          destroy() { try { node.port.postMessage({ close: true }); node.disconnect(); } catch (e) { /* gone */ } },
        };
      }
      // fallback: one fold stage in a WaveShaper (4x oversampled by the browser)
      const input = ctx.createGain(), output = ctx.createGain();
      const pre = ctx.createGain(), sh = ctx.createWaveShaper(), off = ctx.createConstantSource(), bias = ctx.createConstantSource();
      const make = ctx.createGain(), dc = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), wet = ctx.createGain(), dry = ctx.createGain();
      sh.curve = foldCurve(); sh.oversample = "4x";
      pre.gain.value = 1 / FB_R; bias.offset.value = 0; off.offset.value = 0;
      dc.type = "highpass"; dc.frequency.value = 5; dc.Q.value = 0.5;
      lp.type = "lowpass"; lp.frequency.value = 20000; lp.Q.value = 0.7;
      wet.gain.value = 0; dry.gain.value = 1;
      input.connect(pre); pre.connect(sh); bias.connect(sh); sh.connect(make); off.connect(make);
      make.connect(dc); dc.connect(lp); lp.connect(wet); wet.connect(output);
      input.connect(dry); dry.connect(output);
      bias.start(); off.start();
      return {
        input, output, latency: 0,
        set(s) {
          const m = mapSettings(s);
          const g = m.gain * (1 + 0.5 * (m.stages - 1) * m.a), mx = Math.min(1, m.a * 10);
          K.ramp(pre.gain, g / FB_R, ctx);
          K.ramp(bias.offset, m.bias / FB_R, ctx);
          K.ramp(off.offset, -softTri(m.bias), ctx);
          K.ramp(make.gain, 1 / Math.sqrt(g), ctx);
          K.ramp(dc.frequency, 2 + 18 * m.a + 80 * Math.abs(m.bias), ctx);
          K.ramp(lp.frequency, Math.min(20000, 20000 * Math.pow(0.02, m.post)), ctx);
          K.ramp(wet.gain, mx, ctx); K.ramp(dry.gain, 1 - mx, ctx);
        },
        destroy() { try { bias.stop(); off.stop(); } catch (e) { /* stopped */ } for (const n of [input, pre, sh, bias, off, make, dc, lp, wet, dry, output]) n.disconnect(); },
      };
    },
  });
})();

// KILLDRUM FX 18: TAPE DRIVE. Fatter, warmer, glued drums: each voice is printed to a tape machine.
// X = DRIVE: 0..+24 dB into an asymmetric tanh (anti-aliased, run at 2x with TOY MACHINE's 47-tap
// halfband), with a little hysteresis (coming back from saturation the tape lags behind).
// Y = WOW / FLUTTER: a short delay whose length wanders (smoothed random + sine, ported from
// TOY MACHINE's TmTape), so the pitch drifts like a stretched tape.
// Dials: BIAS (asymmetry = even harmonics), HEAD BUMP (the low peak a tape head adds, with a small
// dip above it). TAPE SPEED moves the bump and the top end: 7.5 IPS low, dark and fluttery, 30 IPS tight.
// amount 0 = the plain signal, delayed by a constant 25 samples (reported as `latency`).
(function () {
  "use strict";
  const K = window.KdFx;

  // per tape speed: head bump Hz, top roll-off Hz (worklet: wow/flutter rates live in the processor)
  const SPEEDS = [
    { bump: 40, top: 9000, wow: 0.9, flut: 9.5, flutAmt: 1.4 },  // 7.5 IPS
    { bump: 60, top: 14000, wow: 0.6, flut: 7.5, flutAmt: 1 },   // 15 IPS
    { bump: 100, top: 18000, wow: 0.4, flut: 6, flutAmt: 0.7 },  // 30 IPS
  ];
  const WOW_CENTS = 45, FLUT_CENTS = 10, BIAS_MAX = 0.9, MAKEUP = 0.5;

  // ------------------------------------------------------------------ the tape, per sample (AudioWorklet)
  function proc() {
    // 47-tap Kaiser halfband from TmOversample.h: SIDE[j] = the tap at centre +- (2j + 1)
    const TAPS = 47, CENTRE = 23, SIDES = 12, ULEN = 24, BASE = 2;
    const SIDE = (() => {
      const beta = 7.857, i0 = (x) => { let sum = 1, term = 1; for (let k = 1; k < 40; k++) { term *= (x / (2 * k)) * (x / (2 * k)); sum += term; } return sum; };
      const d = []; let norm = 0;
      for (let j = 0; j < SIDES; j++) {
        const n = 2 * j + 1, r = n / CENTRE, w = i0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / i0(beta);
        d.push((Math.sin(0.5 * Math.PI * n) / (Math.PI * n)) * w); norm += 2 * d[j];
      }
      return Float64Array.from(d, (v) => (v * 0.5) / norm);  // DC gain exactly 1
    })();
    // wow Hz, flutter Hz, flutter depth per tape speed (7.5 / 15 / 30 IPS)
    const RATES = [[0.9, 9.5, 1.4], [0.6, 7.5, 1], [0.4, 6, 0.7]];
    const WOW_CENTS = 45, FLUT_CENTS = 10;
    const logCosh = (x) => { x = Math.abs(x); return x + Math.log1p(Math.exp(-2 * x)) - Math.LN2; };

    class Chan {
      constructor(size) {
        this.up = new Float64Array(2 * ULEN); this.uw = 0;      // 2x up: base-rate history
        this.dn = new Float64Array(2 * TAPS); this.dw = 0;      // 2x down: 2x-rate history
        this.vp = 0; this.lcp = 0; this.m = 0;                  // tanh antiderivative memory, magnetisation
        this.hx = 0; this.hy = 0;                               // DC blocker on the distortion
        this.dry = new Float64Array(32);                        // dry, delayed to match the 2x round trip
        this.ring = new Float32Array(size);                     // the wow delay
      }
    }

    class TapeDrive extends AudioWorkletProcessor {
      static get parameterDescriptors() {
        return [
          { name: "gain", defaultValue: 1, minValue: 0, maxValue: 64, automationRate: "k-rate" },  // drive, linear
          { name: "sat", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "a-rate" },    // dry -> tape (per sample)
          { name: "bias", defaultValue: 0, minValue: -2, maxValue: 2, automationRate: "k-rate" },  // DC into the curve
          { name: "hyst", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
          { name: "wow", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
          { name: "speed", defaultValue: 1, minValue: 0, maxValue: 2, automationRate: "k-rate" },
        ];
      }
      constructor(opts) {
        super();
        const o = (opts && opts.processorOptions) || {};
        let size = 1; const need = Math.ceil(sampleRate * 0.07) + 16; while (size < need) size <<= 1;
        this.mask = size - 1; this.w = 0;
        this.ch = [new Chan(size), new Chan(size)];
        this.zero = new Float32Array(128); this.del = new Float64Array(128);
        this.rng = (o.seed >>> 0) || 0x9e3779b9;
        const ph = () => 2 * Math.PI * this.uni();
        let a = ph(); this.wc = Math.cos(a); this.ws = Math.sin(a);
        a = ph(); this.fc = Math.cos(a); this.fs = Math.sin(a);
        this.wW = { hold: this.bi(), s1: 0, s2: 0, ph: 0 }; this.wW.s1 = this.wW.s2 = this.wW.hold;
        this.wF = { hold: this.bi(), s1: 0, s2: 0, ph: 0 }; this.wF.s1 = this.wF.s2 = this.wF.hold;
        this.depth = 0; this.frames = 0; this.snap = Math.floor(sampleRate * 0.15);
        this.prev = null; this.alive = true;
        this.port.onmessage = (e) => { if (e.data && e.data.close) this.alive = false; };
      }
      uni() { let r = this.rng; r ^= r << 13; r ^= r >>> 17; r ^= r << 5; this.rng = r >>> 0; return (this.rng >>> 8) / 16777216; }
      bi() { return this.uni() * 2 - 1; }
      // a smoothed random walk: a new level every period, eased in by two one-poles
      wander(m, inc, a) {
        m.ph += inc;
        if (m.ph >= 1) { m.ph -= 1; m.hold = this.bi(); }
        m.s1 += (m.hold - m.s1) * a; m.s2 += (m.s1 - m.s2) * a;
        return m.s2;
      }
      // block-rate values the sample loop slides between
      values(p) {
        const g = Math.max(1e-3, p.gain[0]), b = p.bias[0], tb = Math.tanh(b), sech2 = 1 - tb * tb;
        // small signals pass at unity, then come up by half the drive (loud parts get squashed): tape makeup
        return { g, b, tb, sc: Math.pow(g, 0.5) / (g * sech2), sat: p.sat[p.sat.length - 1], hk: 0.8 * p.hyst[0] };
      }
      process(inputs, outputs, params) {
        if (!this.alive) return false;
        const inp = inputs[0] || [], out = outputs[0], n = out[0].length;
        if (this.del.length < n) this.del = new Float64Array(n);
        if (this.zero.length < n) this.zero = new Float32Array(n);
        const cur = this.values(params), pv = this.prev || cur;
        this.prev = cur;
        const mask = this.mask, w0 = this.w, R = 1 - (2 * Math.PI * 8) / sampleRate, sa = params.sat, sa1 = sa.length > 1;
        const nch = inp.length >= 2 ? 2 : 1;
        for (let c = 0; c < nch; c++) {
          const x = inp.length ? inp[c] : this.zero, st = this.ch[c], up = st.up, dn = st.dn, dry = st.dry, ring = st.ring;
          let uw = st.uw, dw = st.dw, vp = st.vp, lcp = st.lcp, m = st.m, hx = st.hx, hy = st.hy;
          const idle = cur.sat <= 0 && pv.sat <= 0 && sa[0] <= 0;
          for (let i = 0; i < n; i++) {
            const xin = x[i], t = (i + 1) / n, pos = (w0 + 1 + i) & mask;
            dry[pos & 31] = xin;
            const dryD = dry[(pos - 23) & 31];
            // up 2x: the even sample is the side taps, the odd one the centre tap (a plain delay)
            up[uw] = xin; up[uw + ULEN] = xin; uw = uw + 1 === ULEN ? 0 : uw + 1;
            if (idle) { dn[dw] = dn[dw + TAPS] = 0; dw = dw + 1 === TAPS ? 0 : dw + 1; dn[dw] = dn[dw + TAPS] = 0; dw = dw + 1 === TAPS ? 0 : dw + 1; ring[pos] = dryD; continue; }
            let s = 0;
            for (let j = 0; j < SIDES; j++) s += SIDE[j] * (up[uw + SIDES + j] + up[uw + SIDES - 1 - j]);
            const g = pv.g + (cur.g - pv.g) * t, b = pv.b + (cur.b - pv.b) * t, tb = pv.tb + (cur.tb - pv.tb) * t;
            const sc = pv.sc + (cur.sc - pv.sc) * t, hk = pv.hk + (cur.hk - pv.hk) * t, mix = sa1 ? sa[i] : sa[0];
            for (let k = 0; k < 2; k++) {
              const v = g * (k === 0 ? 2 * s : up[uw + SIDES]) + b;
              // tanh as the slope of its antiderivative (anti-aliased)
              const d = v - vp, lc = logCosh(v);
              const T = Math.abs(d) > 1e-5 ? (lc - lcp) / d : Math.tanh(0.5 * (v + vp));
              vp = v; lcp = lc;
              // hysteresis: coming back from saturation the magnetisation lingers
              if (Math.abs(T) < Math.abs(m)) m += (T - m) * (1 - hk * Math.abs(m)); else m = T;
              const y = (m - tb) * sc;
              dn[dw] = y; dn[dw + TAPS] = y; dw = dw + 1 === TAPS ? 0 : dw + 1;
            }
            // down 2x
            let yd = 0.5 * dn[dw + CENTRE];
            for (let j = 0; j < SIDES; j++) yd += SIDE[j] * (dn[dw + CENTRE + 2 * j + 1] + dn[dw + CENTRE - 2 * j - 1]);
            // only the tape's change is DC-blocked, so the dry keeps its lows and phase
            const e = yd - dryD;
            hy = e - hx + R * hy; hx = e;
            ring[pos] = dryD + mix * hy;
          }
          if (Math.abs(hy) < 1e-20) hy = 0;
          if (Math.abs(m) < 1e-20) m = 0;
          st.uw = uw; st.dw = dw; st.vp = vp; st.lcp = lcp; st.m = m; st.hx = hx; st.hy = hy;
        }
        // wow and flutter: one wobble for both channels (TmTape's modulators)
        const sp = RATES[Math.max(0, Math.min(2, Math.round(params.speed[0])))], wowAmt = Math.max(0, Math.min(1, params.wow[0]));
        const wowHz = sp[0], flutHz = sp[1];
        const swing = (cents, hz) => ((Math.pow(2, cents / 1200) - 1) / (2 * Math.PI * hz)) * sampleRate;
        const aWow = swing(WOW_CENTS * wowAmt, wowHz), aFlut = swing(FLUT_CENTS * sp[2] * wowAmt, flutHz);
        const target = aWow + aFlut, share = target > 0 ? aWow / target : 1;
        const wi = wowHz / sampleRate, fi = flutHz / sampleRate;
        const cw = Math.cos(2 * Math.PI * wi), sw = Math.sin(2 * Math.PI * wi), cf = Math.cos(2 * Math.PI * fi), sf = Math.sin(2 * Math.PI * fi);
        const aw = 1 - Math.exp((-2 * Math.PI * wowHz * 1.5) / sampleRate), af = 1 - Math.exp((-2 * Math.PI * flutHz * 1.5) / sampleRate);
        const del = this.del;
        let depth = this.depth;
        for (let i = 0; i < n; i++) {
          // a delay moving faster than 0.008 samples per sample would zip: slide like a tape speeding up
          if (this.frames + i < this.snap) depth = target; else depth += Math.max(-0.008, Math.min(0.008, target - depth));
          if (depth <= 0) { del[i] = BASE; continue; }
          let c = this.wc * cw - this.ws * sw, s = this.wc * sw + this.ws * cw, k = 1.5 - 0.5 * (c * c + s * s);
          this.wc = c * k; this.ws = s * k;
          c = this.fc * cf - this.fs * sf; s = this.fc * sf + this.fs * cf; k = 1.5 - 0.5 * (c * c + s * s);
          this.fc = c * k; this.fs = s * k;
          const sWow = 0.65 * Math.max(-1, Math.min(1, 1.7 * this.wander(this.wW, wi, aw))) + 0.35 * this.ws;
          const sFlut = 0.5 * Math.max(-1, Math.min(1, 1.7 * this.wander(this.wF, fi, af))) + 0.5 * this.fs;
          del[i] = BASE + depth * (1 + share * sWow + (1 - share) * sFlut);
        }
        this.depth = depth < 1e-9 ? 0 : depth;
        for (let c = 0; c < 2; c++) {
          const ring = this.ch[Math.min(c, nch - 1)].ring, y = out[c];
          for (let i = 0; i < n; i++) {
            const p = w0 + 1 + i - del[i], i0 = Math.floor(p), f = p - i0;
            const xm = ring[(i0 - 1) & mask], x0 = ring[i0 & mask], x1 = ring[(i0 + 1) & mask], x2 = ring[(i0 + 2) & mask];
            const c1 = 0.5 * (x1 - xm), c2 = xm - 2.5 * x0 + 2 * x1 - 0.5 * x2, c3 = 0.5 * (x2 - xm) + 1.5 * (x0 - x1);
            y[i] = ((c3 * f + c2) * f + c1) * f + x0;
          }
        }
        this.w = (w0 + n) & mask;
        this.frames += n;
        return true;
      }
    }
    registerProcessor("kdfx-tape-drive", TapeDrive);
  }

  // the fallback's curve: tanh over +-24 (the shaper's input is pre-scaled by 1/24)
  const CURVE_K = 24;
  let curve = null;
  const fallbackCurve = () => {
    if (curve) return curve;
    curve = new Float32Array(8193);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 4096) - 1) * CURVE_K);
    return curve;
  };

  const speedOf = (v) => (v == null || !isFinite(+v) ? 1 : Math.max(0, Math.min(2, Math.round(+v))));

  K.register({
    id: "tape-drive", num: 18, name: "TAPE DRIVE", group: "DISTORTION & DESTRUCTION",
    caption: "Fatter, warmer, glued drums.",
    axes: { x: "DRIVE", y: "WOW / FLUTTER" },
    dials: [
      { id: "bias", name: "BIAS", def: 0.2, fmt: (v) => (v < 0.02 ? "SYM" : Math.round(v * 100) + "% ASYM") },
      { id: "bump", name: "HEAD BUMP", def: 0.4, fmt: (v) => "+" + (6 * K.clamp(v)).toFixed(1) + " dB" },
    ],
    toggles: [{ id: "speed", name: "TAPE SPEED", options: ["7.5 IPS", "15 IPS", "30 IPS"], def: 1 }],
    presets: [
      { name: "Glue", voice: "all", sync: true, x: 0.42, y: 0.1, wet: 1, dials: { bias: 0.2, bump: 0.35 }, toggles: { speed: 1 } },
      { name: "Fat Kick", voice: "kick", x: 0.66, y: 0.14, wet: 1, dials: { bias: 0.3, bump: 0.9 }, toggles: { speed: 1 } },
      { name: "Wobbly Snare", voice: "snare", x: 0.6, y: 0.97, wet: 1, dials: { bias: 0.45, bump: 0.3 }, toggles: { speed: 0 } },
      { name: "Soft Hats", voice: "hats", x: 0.3, y: 0.12, wet: 1, dials: { bias: 0.05, bump: 0.1 }, toggles: { speed: 0 } },
    ],
    worklets: { "kdfx-tape-drive": "(" + proc.toString() + ")();" },

    create(ctx, env) {
      const nyq = ctx.sampleRate / 2;
      const input = ctx.createGain(), output = ctx.createGain();
      // head bump (a low peak), the small dip above it, then the top rolls off
      const bump = ctx.createBiquadFilter(), dip = ctx.createBiquadFilter(), top = ctx.createBiquadFilter();
      bump.type = "peaking"; bump.Q.value = 0.9; bump.gain.value = 0; bump.frequency.value = 60;
      dip.type = "peaking"; dip.Q.value = 1.2; dip.gain.value = 0; dip.frequency.value = 140;
      top.type = "lowpass"; top.Q.value = 0.707; top.frequency.value = nyq;
      bump.connect(dip); dip.connect(top); top.connect(output);

      let node = null, fb = null, latency = 0;
      if (K.hasWorklet(ctx, "kdfx-tape-drive")) {
        node = new AudioWorkletNode(ctx, "kdfx-tape-drive", {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
          processorOptions: { seed: ((env && env.seed) || 1) * 2654435761 + 18 },
        });
        input.connect(node); node.connect(bump);
        latency = 25 / ctx.sampleRate;   // 23 samples of 2x round trip + 2 of wow base delay
      } else {
        // plain Web Audio: drive -> tanh shaper (+ a DC bias into it), crossfaded with the dry, a wobbling delay
        const pre = ctx.createGain(), shaper = ctx.createWaveShaper(), biasIn = ctx.createConstantSource(), biasOut = ctx.createConstantSource();
        const post = ctx.createGain(), hp = ctx.createBiquadFilter(), dryG = ctx.createGain(), sum = ctx.createGain();
        const wobble = ctx.createDelay(0.1), oscW = ctx.createOscillator(), oscF = ctx.createOscillator(), gW = ctx.createGain(), gF = ctx.createGain();
        shaper.curve = fallbackCurve(); shaper.oversample = "none";
        pre.gain.value = 1 / CURVE_K; biasIn.offset.value = 0; biasOut.offset.value = 0;
        post.gain.value = 0; dryG.gain.value = 1;
        hp.type = "highpass"; hp.frequency.value = 6; hp.Q.value = 0.6;
        wobble.delayTime.value = 0; gW.gain.value = 0; gF.gain.value = 0;
        oscW.frequency.value = 0.6; oscF.frequency.value = 7.5;
        input.connect(pre); pre.connect(shaper); biasIn.connect(shaper);
        shaper.connect(post); biasOut.connect(post); post.connect(hp); hp.connect(sum);
        input.connect(dryG); dryG.connect(sum);
        sum.connect(wobble); wobble.connect(bump);
        oscW.connect(gW); gW.connect(wobble.delayTime); oscF.connect(gF); gF.connect(wobble.delayTime);
        const t0 = ctx.currentTime;
        biasIn.start(t0); biasOut.start(t0); oscW.start(t0); oscF.start(t0);
        fb = { pre, shaper, biasIn, biasOut, post, hp, dryG, sum, wobble, oscW, oscF, gW, gF };
      }

      let first = true;
      const put = (p, v) => { if (!p || !isFinite(v)) return; if (first) p.setValueAtTime(v, ctx.currentTime); else K.ramp(p, v, ctx); };

      return {
        input, output, latency,
        set(s) {
          const a = K.clamp(s.amount || 0), x = K.clamp(s.x == null ? 0.5 : s.x), y = K.clamp(s.y == null ? 0.5 : s.y);
          const d = s.dials || {}, tg = s.toggles || {};
          const biasV = K.clamp(d.bias == null ? 0.2 : d.bias), bumpV = K.clamp(d.bump == null ? 0.4 : d.bump);
          const si = speedOf(tg.speed), sp = SPEEDS[si];
          const sat = Math.min(1, a / 0.2);                 // the tape comes in over the first fifth of the circle
          const tone = Math.min(1, a / 0.35);               // its colour (bump, top roll-off) a little slower
          const g = Math.pow(10, (24 * x * a) / 20);        // X: drive 0..+24 dB
          const b = BIAS_MAX * biasV * sat;                 // BIAS: DC into the curve
          const wow = Math.pow(y, 1.5) * a;                 // Y: wow / flutter depth
          const hyst = sat * (0.3 + 0.7 * x);
          const bumpDb = 6 * bumpV * tone;
          put(bump.frequency, sp.bump); put(bump.gain, bumpDb);
          put(dip.frequency, sp.bump * 2.3); put(dip.gain, -0.35 * bumpDb);
          put(top.frequency, nyq * Math.pow(Math.min(1, sp.top / nyq), tone));
          // a little trim so the bump doesn't just make it louder
          put(output.gain, Math.pow(10, (-0.5 * bumpDb) / 20));
          if (node) {
            const P = node.parameters;
            put(P.get("gain"), g); put(P.get("sat"), sat); put(P.get("bias"), b); put(P.get("hyst"), hyst); put(P.get("wow"), wow);
            P.get("speed").setValueAtTime(si, ctx.currentTime);
          } else if (fb) {
            const tb = Math.tanh(b), sech2 = 1 - tb * tb, sc = Math.pow(g, MAKEUP) / (g * sech2);
            put(fb.pre.gain, g / CURVE_K); put(fb.biasIn.offset, b / CURVE_K); put(fb.biasOut.offset, -tb);
            put(fb.post.gain, sc * sat); put(fb.dryG.gain, 1 - sat);
            // the delay swings 0 .. 2 x depth (seconds) around depth, like the worklet's wander
            const sw = (cents, hz) => (Math.pow(2, cents / 1200) - 1) / (2 * Math.PI * hz);
            const dW = sw(WOW_CENTS * wow, sp.wow), dF = sw(FLUT_CENTS * sp.flutAmt * wow, sp.flut);
            put(fb.wobble.delayTime, dW + dF); put(fb.gW.gain, dW); put(fb.gF.gain, dF);
            put(fb.oscW.frequency, sp.wow); put(fb.oscF.frequency, sp.flut);
          }
          first = false;
        },
        destroy() {
          try { input.disconnect(); output.disconnect(); bump.disconnect(); dip.disconnect(); top.disconnect(); } catch (e) { /* already gone */ }
          if (node) { try { node.disconnect(); node.port.postMessage({ close: true }); } catch (e) { /* already gone */ } }
          if (fb) for (const k of Object.keys(fb)) {
            const nd = fb[k];
            try { if (nd.stop) nd.stop(); } catch (e) { /* not started */ }
            try { nd.disconnect(); } catch (e) { /* already gone */ }
          }
        },
      };
    },
  });
})();

// 19 RING MOD: the hit is multiplied by a carrier tone, giving sum and difference frequencies.
// All native nodes: the carrier (a sine and a soft band-limited square, crossfaded by Y) drives the
// gain of a GainNode. out = (1 - m) * in + m * in * carrier, m = amount x MIX. AM MODE uses
// 0.5 + 0.5 * carrier instead (the dry stays in, softer). LFO DEPTH: on every hit the carrier starts
// up to 4 octaves higher and falls back to X (a falling ramp, repeating each 1/8 note): the zap.
(function () {
  "use strict";
  const K = window.KdFx;
  const clamp = K.clamp;
  const F_LO = 30, F_HI = 5000;        // X: carrier 30 Hz .. 5 kHz, exponential
  const SWEEP_OCT = 4, SWEEP_TOP = 12000; // LFO DEPTH 1 = start 4 octaves up (never above 12 kHz)
  const NH = 16;                       // square carrier: odd harmonics 1..31, Lanczos-softened
  const MAX_MAKEUP = 1.41;             // level makeup, at most +3 dB
  const carrierHz = (x) => F_LO * Math.pow(F_HI / F_LO, clamp(x));

  // the square's harmonic weights (sine phase, so it lines up with the sine oscillator)
  const W = [];
  for (let j = 0; j < NH; j++) { const k = 2 * j + 1, z = (Math.PI * k) / (2 * NH); W.push(((4 / Math.PI) / k) * (Math.sin(z) / z)); }
  const SQ_POW = W.reduce((s, w) => s + (w * w) / 2, 0); // mean square of the square carrier
  const waves = new WeakMap();
  function squareWave(ctx) {
    let w = waves.get(ctx);
    if (!w) {
      const n = 2 * NH + 1, re = new Float32Array(n), im = new Float32Array(n);
      W.forEach((v, j) => { im[2 * j + 1] = v; });
      waves.set(ctx, (w = ctx.createPeriodicWave(re, im)));
    }
    return w;
  }
  // mean square of the carrier at shape y (sine -> square crossfade)
  const carrierPow = (y) => ((1 - y) * (1 - y)) / 2 + y * y * SQ_POW + y * (1 - y) * W[0];

  K.register({
    id: "ring-mod", num: 19, name: "RING MOD", group: "DISTORTION & DESTRUCTION",
    caption: "Metallic, alien, bell-like.",
    axes: { x: "CARRIER FREQ", y: "CARRIER SHAPE" },
    dials: [
      { id: "mix", name: "MIX", def: 1, fmt: K.fmt.pct },
      { id: "lfo", name: "LFO DEPTH", def: 0, fmt: (v) => (v <= 0.005 ? "OFF" : "+" + (v * SWEEP_OCT).toFixed(1) + " oct") },
    ],
    toggles: [
      { id: "keytrack", name: "KEY TRACK", def: false },
      { id: "am", name: "AM MODE", def: false },
    ],
    presets: [
      // 400 Hz pure sine (x = 0.506), bottom rim
      { name: "Robot Snare", voice: "snare", x: 0.506, y: 0.0, wet: 1, dials: { mix: 0.9, lfo: 0 }, toggles: { keytrack: false, am: false } },
      // ~3 kHz, a third of the way to square: extra clangy sidebands
      { name: "Bell Hats", voice: "hats", x: 0.9, y: 0.3, wet: 0.9, dials: { mix: 1, lfo: 0 }, toggles: { keytrack: false, am: false } },
      // home ~140 Hz, each kick starts ~3.6 octaves up and falls: a laser zap
      { name: "Kick Laser", voice: "kick", x: 0.3, y: 0.12, wet: 0.85, dials: { mix: 0.8, lfo: 0.9 }, toggles: { keytrack: false, am: false } },
      // ~720 Hz full square, harsh
      { name: "Clang", voice: "perc", x: 0.62, y: 1.0, wet: 0.9, dials: { mix: 1, lfo: 0 }, toggles: { keytrack: true, am: false } },
    ],
    create(ctx, env) {
      const input = ctx.createGain(), output = ctx.createGain();
      const thru = ctx.createGain();   // the dry-through part, (1 - m)
      const vca = ctx.createGain();    // in x carrier: its gain is driven by the carrier only
      vca.gain.value = 0;
      // keeps sub-audio difference tones (near DC) out of the ring part
      const R = 1 - (2 * Math.PI * 15) / ctx.sampleRate;
      const dc = ctx.createIIRFilter([1, -1], [1, -R]);
      input.connect(thru).connect(output);
      input.connect(vca).connect(dc).connect(output);

      // the carrier: sine + square, crossfaded, into the vca's gain
      const t0 = ctx.currentTime;
      const sine = ctx.createOscillator(), sq = ctx.createOscillator();
      sine.type = "sine"; sq.setPeriodicWave(squareWave(ctx));
      const gSin = ctx.createGain(), gSq = ctx.createGain(), depth = ctx.createGain();
      gSq.gain.value = 0; depth.gain.value = 0;
      sine.connect(gSin).connect(depth); sq.connect(gSq).connect(depth);
      depth.connect(vca.gain);
      // detune bus (cents): KEY TRACK (the hit's playback rate) + the per-hit falling sweep
      const det = ctx.createGain();
      det.connect(sine.detune); det.connect(sq.detune);
      const keySrc = ctx.createConstantSource(), keyAmt = ctx.createGain();
      keySrc.offset.value = 0; keyAmt.gain.value = 0;
      keySrc.connect(keyAmt).connect(det);
      const sweepSrc = ctx.createConstantSource(), sweepAmt = ctx.createGain();
      sweepSrc.offset.value = 0; sweepAmt.gain.value = 0;
      sweepSrc.connect(sweepAmt).connect(det);
      for (const o of [sine, sq, keySrc, sweepSrc]) o.start(t0);

      let first = true, bpm = env.bpm || 120;
      const put = (p, v) => { if (!isFinite(v)) return; if (first) p.setValueAtTime(v, ctx.currentTime); else K.ramp(p, v, ctx); };
      return {
        input, output,
        set(s) {
          const d = s.dials || {}, tg = s.toggles || {};
          const mix = d.mix != null ? clamp(d.mix) : 1, lfo = d.lfo != null ? clamp(d.lfo) : 0;
          const f = carrierHz(s.x != null ? s.x : 0.5), y = clamp(s.y != null ? s.y : 0);
          const m = clamp(s.amount || 0) * mix, am = !!tg.am;
          const a = am ? 1 - m / 2 : 1 - m, b = am ? m / 2 : m;
          // makeup: keep the level near the input; less of it for slow carriers (they act like a tremolo)
          const pw = a * a + b * b * carrierPow(y);
          const slow = clamp(Math.log2(f / F_LO) / Math.log2(150 / F_LO));
          const mu = 1 + (clamp(1 / Math.sqrt(Math.max(pw, 1e-6)), 1, MAX_MAKEUP) - 1) * slow;
          const oct = Math.min(lfo * SWEEP_OCT, Math.max(0, Math.log2(SWEEP_TOP / f)));
          if (s.bpm) bpm = s.bpm;
          put(sine.frequency, f); put(sq.frequency, f);
          put(gSin.gain, 1 - y); put(gSq.gain, y);
          put(thru.gain, a); put(depth.gain, b); put(output.gain, mu);
          put(keyAmt.gain, tg.keytrack ? 1 : 0);
          put(sweepAmt.gain, oct * 1200);
          first = false;
        },
        trigger(hit) {
          const t = Math.max(hit.at || 0, ctx.currentTime);
          const rate = hit.rate > 0 ? hit.rate : 1;
          keySrc.offset.setValueAtTime(1200 * Math.log2(rate), t);
          // the falling sweep: restarts on each hit, repeats every 1/8 note for a bar
          const P = K.beats(bpm, 0.5), o = sweepSrc.offset;
          o.cancelScheduledValues(t);
          for (let k = 0; k < 8; k++) { o.setValueAtTime(1, t + k * P); o.setTargetAtTime(0, t + k * P, P / 6); }
        },
        destroy() {
          for (const o of [sine, sq, keySrc, sweepSrc]) { try { o.stop(); } catch (e) { /* not started */ } }
          for (const n of [input, output, thru, vca, dc, sine, sq, gSin, gSq, depth, det, keySrc, keyAmt, sweepSrc, sweepAmt]) { try { n.disconnect(); } catch (e) { /* already */ } }
        },
      };
    },
  });
})();

// 28 CHANCE ENGINE: random glitches sometimes, so the loop never repeats exactly.
// The voice passes through untouched; on some hits (seeded dice per song position) an event
// replaces the start of the hit: STUTTER (first slice repeated on the grid), REVERSE (the hit's
// first part played backwards), PITCH (the hit replayed up/down), SKIP (the hit muted).
(function () {
  "use strict";
  const K = window.KdFx;
  if (!K) return;
  const clamp = K.clamp;
  const KINDS = ["stutter", "reverse", "pitch", "skip"];
  const SHORT = ["STUT", "REV", "PITCH", "SKIP"];
  const F = 0.004; // fade used for ducks and cuts (never clicks)

  // EVENT WEIGHTS: one dial slides the odds stutter (0) -> reverse -> pitch -> skip (1);
  // the middle keeps every kind possible
  const weights = (w) => {
    w = clamp(w);
    const floor = 0.12 * (1 - Math.abs(2 * w - 1));
    const out = KINDS.map((_, i) => { const d = (w - i / 3) / 0.22; return Math.exp(-d * d) + floor; });
    const sum = out.reduce((a, b) => a + b, 0);
    return out.map((v) => v / sum);
  };
  const mixText = (w) => weights(w).map((v, i) => [Math.round(v * 100), i]).sort((a, b) => b[0] - a[0])
    .slice(0, 2).filter((q) => q[0] > 0).map((q) => SHORT[q[1]] + " " + q[0]).join(" ");
  // X: chance per hit (scaled by amount, so amount 0 = never)
  const chanceOf = (x, amount) => (0.06 + 0.86 * Math.pow(clamp(x), 1.4)) * clamp(amount);
  // Y: event length 1/64 .. 1/4 note (in beats)
  const LENS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];
  const lenBeats = (y) => LENS[Math.min(4, Math.floor(clamp(y) * 5))];
  const mod = (a, n) => ((a % n) + n) % n;
  const T = (t) => Math.max(0, t);
  const pickW = (u, vals, ws) => { let s = 0; for (const w of ws) s += w; u *= s; for (let i = 0; i < vals.length; i++) { if (u < ws[i]) return vals[i]; u -= ws[i]; } return vals[vals.length - 1]; };

  K.register({
    id: "chance-engine", num: 28, name: "CHANCE ENGINE", group: "GLITCH & CHAOS",
    caption: "Random glitches sometimes, so the loop never repeats exactly.",
    axes: { x: "CHAOS", y: "EVENT LENGTH" },
    dials: [
      { id: "weights", name: "EVENT WEIGHTS", def: 0.35, fmt: mixText },
      { id: "seed", name: "SEED", def: 0.042, fmt: (v) => String(Math.round(clamp(v) * 999)) },
    ],
    toggles: [
      { id: "lock", name: "LOCK SEED", def: false },
      { id: "bar4", name: "ONLY ON BAR 4", def: false },
    ],
    presets: [
      { name: "Nervous", voice: "hats", x: 0.86, y: 0.12, wet: 1, dials: { weights: 0.12, seed: 0.042 }, toggles: { lock: false, bar4: false } },
      { name: "Twitch", voice: "snare", x: 0.2, y: 0.88, wet: 1, dials: { weights: 0.4, seed: 0.021 }, toggles: { lock: false, bar4: false } },
      { name: "Skip Kick", voice: "kick", x: 0.24, y: 0.18, wet: 1, dials: { weights: 1, seed: 0.017 }, toggles: { lock: false, bar4: false } },
      { name: "Chaos Kit", voice: "all", sync: true, x: 0.88, y: 0.7, wet: 1, dials: { weights: 0.5, seed: 0.042 }, toggles: { lock: false, bar4: false } },
    ],
    create(ctx, env) {
      const input = ctx.createGain(), pass = ctx.createGain(), output = ctx.createGain();
      input.connect(pass); pass.connect(output);
      let st = { x: 0.5, y: 0.5, amount: 0, dials: {}, toggles: {}, bpm: env.bpm || 120 };
      let count = 0, live = [], dead = false;

      // pulls the pass gain to 0 between t0 and t1 (a ConstantSource summed into pass.gain);
      // cut(t) lets it go by t through a fresh gain, so nothing scheduled is ever cancelled
      function duck(t0, t1, fIn, fOut) {
        const cs = ctx.createConstantSource(), cg = ctx.createGain();
        const o = cs.offset;
        o.setValueAtTime(0, T(t0 - fIn)); o.linearRampToValueAtTime(-1, T(t0));
        o.setValueAtTime(-1, T(t1 - fOut)); o.linearRampToValueAtTime(0, T(t1));
        cs.connect(cg); cg.connect(pass.gain);
        cs.start(T(t0 - fIn)); cs.stop(T(t1) + 0.01);
        return { nodes: [cs, cg], srcs: [cs], cg };
      }
      // an event's own output: sources -> eg (envelope) -> cg (cut) -> output
      function bus() { const eg = ctx.createGain(), cg = ctx.createGain(); eg.gain.value = 0; eg.connect(cg); cg.connect(output); return { eg, cg }; }
      function src(buf, rate, t, off, dur, to) {
        const s = ctx.createBufferSource();
        s.buffer = buf; s.playbackRate.value = rate; s.connect(to);
        s.start(T(t), Math.max(0, off)); s.stop(T(t + dur) + 0.002);
        return s;
      }
      function addEvent(start, end, parts) {
        const ev = { start, end, parts };
        ev.cut = (t) => {
          for (const p of parts) {
            if (p.cg) { p.cg.gain.setValueAtTime(1, T(t - F)); p.cg.gain.linearRampToValueAtTime(0, T(t)); }
            for (const s of p.srcs || []) { try { s.stop(T(t) + 0.001); } catch (e) { /* already done */ } }
          }
          ev.end = t;
        };
        live.push(ev);
      }

      function stutter(hit, at, L, r) {
        const rate = hit.rate || 1, g = hit.gain == null ? 1 : hit.gain;
        const opts = [2, 4, 3, 8, 6].filter((n) => L / n >= 0.008);
        const N = opts.length ? pickW(r(), opts, [3, 3, 1, 1.5, 0.7].slice(0, 5).filter((_, i) => L / [2, 4, 3, 8, 6][i] >= 0.008)) : 2;
        const S = L / N, dec = 0.7 + 0.22 * r();
        const step = r() < 0.7 ? 0 : (r() < 0.5 ? 1 : -1) * (1 + Math.floor(r() * 2));
        const fi = Math.min(0.001, S / 8), fo = Math.min(0.003, S / 4);
        const b = bus(), srcs = [];
        for (let k = 1; k < N; k++) {
          const t = at + k * S, gk = g * Math.pow(dec, k);
          srcs.push(src(hit.buf, rate * Math.pow(2, (step * k) / 12), t, 0, S, b.eg));
          b.eg.gain.setValueAtTime(0, T(t)); b.eg.gain.linearRampToValueAtTime(gk, T(t + fi));
          b.eg.gain.setValueAtTime(gk, T(t + S - fo)); b.eg.gain.linearRampToValueAtTime(0, T(t + S));
        }
        const d = duck(at + S, at + L, fo, fo); // the dry plays the first slice, then ducks under the repeats
        addEvent(at, at + L, [{ cg: b.cg, srcs }, d]);
      }
      function reverse(hit, at, L) {
        const rate = hit.rate || 1, g = hit.gain == null ? 1 : hit.gain, buf = hit.buf;
        const R = Math.min(L, buf.duration / rate), fi = Math.min(0.004, R / 4);
        const b = bus();
        const s = src(K.reverseBuffer(ctx, buf), rate, at, buf.duration - R * rate, R, b.eg);
        b.eg.gain.setValueAtTime(0, T(at)); b.eg.gain.linearRampToValueAtTime(g, T(at + fi));
        b.eg.gain.setValueAtTime(g, T(at + R - 0.0015)); b.eg.gain.linearRampToValueAtTime(0, T(at + R));
        const d = duck(at, at + R, F, F);
        addEvent(at, at + R, [{ cg: b.cg, srcs: [s] }, d]);
      }
      function pitch(hit, at, L, r) {
        const rate = hit.rate || 1, g = hit.gain == null ? 1 : hit.gain, buf = hit.buf;
        const k = pickW(r(), [-12, -7, -5, 5, 7, 12], [3, 2, 1, 1, 2, 3]);
        const bend = r() < 0.35; // a dive/rise instead of a fixed interval
        const r0 = bend ? rate : rate * Math.pow(2, k / 12), r1 = rate * Math.pow(2, k / 12);
        const P = Math.min(L, buf.duration / Math.max(r0, r1)), fo = clamp(0.15 * P, 0.003, 0.025);
        const b = bus();
        const s = src(buf, r0, at, 0, P, b.eg);
        if (bend) { s.playbackRate.setValueAtTime(r0, T(at)); s.playbackRate.exponentialRampToValueAtTime(r1, T(at + P)); }
        b.eg.gain.setValueAtTime(0, T(at)); b.eg.gain.linearRampToValueAtTime(g, T(at + 0.001));
        b.eg.gain.setValueAtTime(g, T(at + P - fo)); b.eg.gain.linearRampToValueAtTime(0, T(at + P));
        const d = duck(at, at + P, F, fo);
        addEvent(at, at + P, [{ cg: b.cg, srcs: [s] }, d]);
      }
      function skip(hit, at, L, bpm) {
        const len = hit.buf ? hit.buf.duration / (hit.rate || 1) : L;
        const end = at + Math.min(Math.max(L, len), K.beats(bpm, 4));
        addEvent(at, end, [duck(at, end, F, 0.006)]);
      }

      // the dice: same seed + same song position = same result
      function trigger(hit) {
        if (dead || !hit) return;
        const at = Math.max(0, hit.at || 0), s = st, amt = clamp(s.amount || 0);
        // the next hit always plays clean: cut what the last event still plays
        // (hits can arrive out of time order, e.g. several sounds on one dot: keep the recent events)
        for (const ev of live) if (ev.start < at && ev.end > at) ev.cut(at);
        if (live.length > 48) live = live.filter((ev) => ev.end > ctx.currentTime).slice(-48);
        const n = count++;
        if (amt <= 0) return;
        const beat = typeof hit.beat === "number" && isFinite(hit.beat) ? hit.beat : null;
        if (s.toggles.bar4 && (beat != null ? mod(beat, 16) < 12 - 1e-6 : n % 4 !== 3)) return;
        const seedN = Math.round(clamp(s.dials.seed == null ? 0.042 : s.dials.seed) * 999);
        let key;
        if (beat != null) { const step = Math.round(beat * 12); key = s.toggles.lock ? "L" + mod(step, 192) : "S" + step; }
        else key = s.toggles.lock ? "L" + (n % 16) : "N" + n;
        const r = K.rng(K.hash(env.seed, seedN, key));
        if (r() >= chanceOf(s.x, amt)) return;
        const w = weights(s.dials.weights == null ? 0.35 : s.dials.weights);
        let u = r(), kind = 3;
        for (let i = 0; i < 4; i++) { if (u < w[i]) { kind = i; break; } u -= w[i]; }
        if (kind < 3 && !hit.buf) return;
        const bpm = s.bpm || env.bpm || 120;
        const lb = clamp(lenBeats(s.y) * [0.5, 1, 1, 2][Math.floor(r() * 4)], 1 / 16, 2);
        const L = K.beats(bpm, lb);
        // one event at a time: never overlap another event (no stacked ducks or replays)
        const span = Math.max(L, hit.buf ? hit.buf.duration / (hit.rate || 1) : L);
        for (const ev of live) if (ev.start < at + span && ev.end > at - F) return;
        if (kind === 0) stutter(hit, at, L, r);
        else if (kind === 1) reverse(hit, at, L);
        else if (kind === 2) pitch(hit, at, L, r);
        else skip(hit, at, L, bpm);
        K.emit({ t: at, note: env.note, kind: "chance", type: KINDS[kind] });
      }

      return {
        input, output, latency: 0,
        set(s) { st = { x: s.x, y: s.y, amount: s.amount, dials: Object.assign({}, s.dials), toggles: Object.assign({}, s.toggles), bpm: s.bpm }; },
        trigger,
        destroy() {
          dead = true;
          for (const ev of live) for (const p of ev.parts) {
            for (const sn of p.srcs || []) { try { sn.stop(); } catch (e) { /* not started */ } try { sn.disconnect(); } catch (e) { /* gone */ } }
            if (p.cg) try { p.cg.disconnect(); } catch (e) { /* gone */ }
          }
          live = [];
          for (const nd of [input, pass, output]) try { nd.disconnect(); } catch (e) { /* gone */ }
        },
      };
    },
  });
})();

// 29 LO-FI: dusty, old, warped drums. X = age (top rolls off, soft tape squash, hiss, a little
// grit), Y = wow depth (a wobbling tape delay, up to about +-40 cents). CRACKLE = vinyl clicks and
// pops, BANDWIDTH = full band down to a 300 Hz - 3 kHz radio band. RPM DRIFT adds a 33 rpm record's
// off-centre warble and a slow speed wander, MONO sums to mono. Hiss and crackle follow the playing
// and fade about a second after the tails, so a resting voice is silent.
(function () {
  "use strict";
  const K = window.KdFx;
  const BASE = 2; // samples of fixed delay in the wow line (reported as latency)
  const RPM_HZ = 0.5556; // 33 1/3 turns a minute
  const hpOf = (narrow) => 300 * Math.pow(narrow, 2.5); // low cut of the band, 0 = off
  const lpOf = (fmax, age, narrow) => fmax * Math.pow(3000 / fmax, 1 - (1 - narrow) * (1 - age)); // top roll-off
  const swing = (cents, hz) => (Math.pow(2, cents / 1200) - 1) / (2 * Math.PI * hz); // delay swing (s) for that pitch wobble

  // ------------------------------------------------------------------ the worklet (per sample)
  function proc() {
    const PI = Math.PI;
    const swingS = (cents, hz) => ((Math.pow(2, cents / 1200) - 1) / (2 * PI * hz)) * sampleRate;
    class LoFi extends AudioWorkletProcessor {
      static get parameterDescriptors() {
        const p = (name) => ({ name, defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" });
        return [p("age"), p("wow"), p("crackle"), p("narrow"), p("drift"), p("mono")];
      }
      constructor(options) {
        super();
        const o = (options && options.processorOptions) || {};
        const sr = sampleRate;
        this.base = Math.max(2, o.base || 2);
        let size = 1;
        while (size < sr * 0.03 + 16) size <<= 1;
        this.mask = size - 1;
        this.bL = new Float32Array(size);
        this.bR = new Float32Array(size);
        this.w = 0;
        this.zero = new Float32Array(128);
        // seeded generators: modulation, hiss, crackle (so one never shifts another's draws)
        let h = ((o.seed >>> 0) ^ 0x9e3779b9) | 0;
        const mix = () => { h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16; return h | 1; };
        this.rM = mix(); this.rH = mix(); this.rC = mix();
        const uni = () => { let x = this.rM; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rM = x; return (x >>> 0) / 4294967296; };
        // modulators: [cos, sin] sines kept by rotation, and smoothed random wanders [hold, s1, s2, phase]
        const sine = () => { const a = 2 * PI * uni(); return [Math.cos(a), Math.sin(a)]; };
        this.sw = sine(); this.sf = sine(); this.sr2 = sine();
        const wan = () => { const v = uni() * 2 - 1; return [v, v, v, uni()]; };
        this.ww = wan(); this.wf = wan(); this.wd = wan();
        this.dep = [0, 0, 0, 0]; // slewed swings (samples): wow, flutter, rpm, drift
        this.snap = true;
        this.st = new Float64Array(40); // filter states
        this.env = 0; this.g = 1; this.refP = 0; this.wetP = 0;
        // fixed crackle filters: ticks = band-pass 3.5 kHz, pops = low-pass 900 Hz then a 150 Hz low cut
        this.gT = Math.tan((PI * 3500) / sr); this.kT = 1.0;
        this.gP = Math.tan((PI * 900) / sr); this.kP = 1.1;
        this.aPh = 1 - Math.exp((-2 * PI * 150) / sr);
        this.nT = this.peakOf(this.gT, this.kT, 1); this.nP = this.peakOf(this.gP, this.kP, 0);
        this.rel = Math.exp(-1 / (0.25 * sr));
        this.aEnv = 1 - Math.exp(-1 / (0.04 * sr));
        this.aG = 1 - Math.exp(-1 / (0.03 * sr));
        this.alive = true;
        this.port.onmessage = (e) => { if (e.data && e.data.close) this.alive = false; };
      }
      // 1 / the peak of a filter's impulse response, so a click of height A comes out about A
      peakOf(g, k, band) {
        let ic1 = 0, ic2 = 0, pk = 1e-9;
        const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
        for (let i = 0; i < 400; i++) {
          const x = i === 0 ? 1 : 0, v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
          ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
          pk = Math.max(pk, Math.abs(band ? v1 : v2));
        }
        return 1 / pk;
      }
      process(inputs, outputs, P) {
        if (!this.alive) return false;
        const out = outputs[0], oL = out[0], oR = out[1] || out[0], n = oL.length;
        const inp = inputs[0];
        let iL = inp && inp[0], iR = inp && (inp[1] || inp[0]);
        if (!iL) { iL = iR = this.zero.length === n ? this.zero : (this.zero = new Float32Array(n)); }
        const sr = sampleRate;
        const age = P.age[0], wow = P.wow[0], crk = P.crackle[0], nar = P.narrow[0], drift = P.drift[0], mono = P.mono[0];

        // ---- per block: coefficients
        const fLP = lpOf(0.45 * sr, age, nar), gL = Math.tan((PI * fLP) / sr), mixL = Math.min(1, (1 - (1 - nar) * (1 - age)) * 10);
        const fHP = 300 * Math.pow(nar, 2.5), gH = Math.tan((PI * fHP) / sr);
        const k1 = 1.8478, k2 = 0.7654 / (1 + 0.5 * nar); // 4th-order Butterworth, a little radio honk when narrow
        const la1 = 1 / (1 + gL * (gL + k1)), la2 = gL * la1, la3 = gL * la2;
        const lb1 = 1 / (1 + gL * (gL + k2)), lb2 = gL * lb1, lb3 = gL * lb2;
        const ha1 = 1 / (1 + gH * (gH + k1)), ha2 = gH * ha1, ha3 = gH * ha2;
        const hb1 = 1 / (1 + gH * (gH + k2)), hb2 = gH * hb1, hb3 = gH * hb2;
        const drv = 0.01 + 3 * Math.pow(age, 1.5), mk = (1 + 0.2 * (drv - 0.01)) / drv;
        const bits = 24 - 13 * Math.pow(age, 1.5), q = bits < 22 ? Math.pow(2, bits - 1) : 0;
        const cap = 12 * Math.max(nar, age), gMax = Math.pow(10, cap / 20), gMin = Math.pow(10, -cap / 40);
        const lvlH = age > 0 ? Math.pow(10, (-70 + 34 * Math.sqrt(age)) / 20) * Math.min(1, age * 8) * 2.7 : 0;
        const aHl = 1 - Math.exp((-2 * PI * Math.min(7000, fLP * 1.5)) / sr), aHh = 1 - Math.exp((-2 * PI * Math.max(300, fHP)) / sr);
        const pEv = crk > 0 ? (crk * (4 + 56 * crk)) / sr : 0, cAmp = 0.3 * Math.sqrt(crk);
        // wow swings in samples: tape wow 0.7 Hz (40 cents), flutter 7.5 Hz (8 cents), record 0.56 Hz (6 cents), slow wander 0.1 Hz (5 cents)
        const T0 = swingS(40 * wow, 0.7), T1 = swingS(8 * wow, 7.5), T2 = swingS(6 * drift, 0.5556), T3 = swingS(5 * drift, 0.1);
        const dep = this.dep;
        if (this.snap) { dep[0] = T0; dep[1] = T1; dep[2] = T2; dep[3] = T3; this.snap = false; }
        let d0 = dep[0], d1 = dep[1], d2 = dep[2], d3 = dep[3];
        const SL = 0.004;
        const modOn = d0 + d1 + d2 + d3 + T0 + T1 + T2 + T3 > 0;
        const rot = (q2, hz) => { const a = (2 * PI * hz) / sr; return [Math.cos(a), Math.sin(a)]; };
        const [cw, sw] = rot(0, 0.7), [cf, sf] = rot(0, 7.5), [cr, sr_] = rot(0, 0.5556);
        const aw = 1 - Math.exp((-2 * PI * 0.7 * 1.5) / sr), af = 1 - Math.exp((-2 * PI * 7.5 * 1.5) / sr), ad = 1 - Math.exp((-2 * PI * 0.1 * 1.5) / sr);
        const iw = 0.7 / sr, ifl = 7.5 / sr, idr = 0.1 / sr;
        const SW = this.sw, SF = this.sf, SR = this.sr2, WW = this.ww, WF = this.wf, WD = this.wd;
        let swc = SW[0], sws = SW[1], sfc = SF[0], sfs = SF[1], src = SR[0], srs = SR[1];
        let rM = this.rM, rH = this.rH, rC = this.rC;

        const st = this.st, bL = this.bL, bR = this.bR, mask = this.mask, base = this.base;
        let w = this.w, env = this.env, g = this.g, refP = this.refP, wetP = this.wetP;
        const rel = this.rel, aEnv = this.aEnv, aG = this.aG;
        const gT = this.gT, kT = this.kT, gP = this.gP, kP = this.kP, aPh = this.aPh, nT = this.nT, nP = this.nP;
        const ta1 = 1 / (1 + gT * (gT + kT)), ta2 = gT * ta1, ta3 = gT * ta2;
        const pa1 = 1 / (1 + gP * (gP + kP)), pa2 = gP * pa1, pa3 = gP * pa2;
        const maxD = mask - 4;

        for (let i = 0; i < n; i++) {
          const inL = iL[i], inR = iR[i];
          w = (w + 1) & mask;
          bL[w] = inL; bR[w] = inR;
          // ---- the tape transport: a short delay whose length wobbles (pitch wow/flutter/drift)
          let delay = base;
          if (modOn) {
            d0 += Math.max(-SL, Math.min(SL, T0 - d0)); d1 += Math.max(-SL, Math.min(SL, T1 - d1));
            d2 += Math.max(-SL, Math.min(SL, T2 - d2)); d3 += Math.max(-SL, Math.min(SL, T3 - d3));
            let c = swc * cw - sws * sw; sws = swc * sw + sws * cw; swc = c;
            c = sfc * cf - sfs * sf; sfs = sfc * sf + sfs * cf; sfc = c;
            c = src * cr - srs * sr_; srs = src * sr_ + srs * cr; src = c;
            WW[3] += iw; if (WW[3] >= 1) { WW[3] -= 1; rM ^= rM << 13; rM ^= rM >>> 17; rM ^= rM << 5; WW[0] = (rM >>> 0) / 2147483648 - 1; }
            WW[1] += (WW[0] - WW[1]) * aw; WW[2] += (WW[1] - WW[2]) * aw;
            WF[3] += ifl; if (WF[3] >= 1) { WF[3] -= 1; rM ^= rM << 13; rM ^= rM >>> 17; rM ^= rM << 5; WF[0] = (rM >>> 0) / 2147483648 - 1; }
            WF[1] += (WF[0] - WF[1]) * af; WF[2] += (WF[1] - WF[2]) * af;
            WD[3] += idr; if (WD[3] >= 1) { WD[3] -= 1; rM ^= rM << 13; rM ^= rM >>> 17; rM ^= rM << 5; WD[0] = (rM >>> 0) / 2147483648 - 1; }
            WD[1] += (WD[0] - WD[1]) * ad; WD[2] += (WD[1] - WD[2]) * ad;
            const sWow = 0.65 * Math.max(-1, Math.min(1, 1.7 * WW[2])) + 0.35 * sws;
            const sFl = 0.5 * Math.max(-1, Math.min(1, 1.7 * WF[2])) + 0.5 * sfs;
            const sDr = Math.max(-1, Math.min(1, 1.7 * WD[2]));
            delay = base + d0 * (1 + sWow) + d1 * (1 + sFl) + d2 * (1 + srs) + d3 * (1 + sDr);
            if (delay > maxD) delay = maxD;
          }
          const pos = w - delay, ip = Math.floor(pos), t = pos - ip;
          const im = (ip - 1) & mask, i0 = ip & mask, i1 = (ip + 1) & mask, i2 = (ip + 2) & mask;
          let xm = bL[im], x0 = bL[i0], x1 = bL[i1], x2 = bL[i2];
          let xl = ((((0.5 * (x2 - xm) + 1.5 * (x0 - x1)) * t + (xm - 2.5 * x0 + 2 * x1 - 0.5 * x2)) * t + 0.5 * (x1 - xm)) * t) + x0;
          xm = bR[im]; x0 = bR[i0]; x1 = bR[i1]; x2 = bR[i2];
          let xr = ((((0.5 * (x2 - xm) + 1.5 * (x0 - x1)) * t + (xm - 2.5 * x0 + 2 * x1 - 0.5 * x2)) * t + 0.5 * (x1 - xm)) * t) + x0;
          refP += (0.5 * (xl * xl + xr * xr) - refP) * aEnv;

          // ---- age + band: top roll-off (2 sections), tape squash, grit, low cut (2 sections)
          let v3, v1, v2;
          const dl = xl, dr = xr; // blended back in near "off", where a bilinear low-pass still dulls the very top
          v3 = xl - st[1]; v1 = la1 * st[0] + la2 * v3; v2 = st[1] + la2 * st[0] + la3 * v3; st[0] = 2 * v1 - st[0]; st[1] = 2 * v2 - st[1]; xl = v2;
          v3 = xl - st[3]; v1 = lb1 * st[2] + lb2 * v3; v2 = st[3] + lb2 * st[2] + lb3 * v3; st[2] = 2 * v1 - st[2]; st[3] = 2 * v2 - st[3]; xl = v2;
          v3 = xr - st[5]; v1 = la1 * st[4] + la2 * v3; v2 = st[5] + la2 * st[4] + la3 * v3; st[4] = 2 * v1 - st[4]; st[5] = 2 * v2 - st[5]; xr = v2;
          v3 = xr - st[7]; v1 = lb1 * st[6] + lb2 * v3; v2 = st[7] + lb2 * st[6] + lb3 * v3; st[6] = 2 * v1 - st[6]; st[7] = 2 * v2 - st[7]; xr = v2;
          if (mixL < 1) { xl = dl + (xl - dl) * mixL; xr = dr + (xr - dr) * mixL; }
          let z = drv * xl; z = z > 3 ? 1 : z < -3 ? -1 : (z * (27 + z * z)) / (27 + 9 * z * z); xl = z * mk;
          z = drv * xr; z = z > 3 ? 1 : z < -3 ? -1 : (z * (27 + z * z)) / (27 + 9 * z * z); xr = z * mk;
          if (q) { xl = Math.round(xl * q) / q; xr = Math.round(xr * q) / q; }
          v3 = xl - st[9]; v1 = ha1 * st[8] + ha2 * v3; v2 = st[9] + ha2 * st[8] + ha3 * v3; st[8] = 2 * v1 - st[8]; st[9] = 2 * v2 - st[9]; xl = xl - k1 * v1 - v2;
          v3 = xl - st[11]; v1 = hb1 * st[10] + hb2 * v3; v2 = st[11] + hb2 * st[10] + hb3 * v3; st[10] = 2 * v1 - st[10]; st[11] = 2 * v2 - st[11]; xl = xl - k2 * v1 - v2;
          v3 = xr - st[13]; v1 = ha1 * st[12] + ha2 * v3; v2 = st[13] + ha2 * st[12] + ha3 * v3; st[12] = 2 * v1 - st[12]; st[13] = 2 * v2 - st[13]; xr = xr - k1 * v1 - v2;
          v3 = xr - st[15]; v1 = hb1 * st[14] + hb2 * v3; v2 = st[15] + hb2 * st[14] + hb3 * v3; st[14] = 2 * v1 - st[14]; st[15] = 2 * v2 - st[15]; xr = xr - k2 * v1 - v2;
          // ---- level match: a slow gain that keeps the coloured sound near the uncoloured one (bounded)
          wetP += (0.5 * (xl * xl + xr * xr) - wetP) * aEnv;
          let tg = Math.sqrt((refP + 1e-7) / (wetP + 1e-7));
          tg = tg > gMax ? gMax : tg < gMin ? gMin : tg;
          g += (tg - g) * aG;
          xl *= g; xr *= g;

          // ---- hiss and crackle, gated by the playing (fades about a second after the tails)
          const a = Math.max(Math.abs(inL), Math.abs(inR));
          env = a > env ? a : env * rel;
          const gate = Math.min(1, env * 80);
          if (lvlH > 0) {
            rH ^= rH << 13; rH ^= rH >>> 17; rH ^= rH << 5; const nl = (rH >>> 0) / 2147483648 - 1;
            rH ^= rH << 13; rH ^= rH >>> 17; rH ^= rH << 5; const nr = (rH >>> 0) / 2147483648 - 1;
            st[16] += (nl - st[16]) * aHl; st[17] += (st[16] - st[17]) * aHh;
            st[18] += (nr - st[18]) * aHl; st[19] += (st[18] - st[19]) * aHh;
            const k = lvlH * gate;
            xl += (st[16] - st[17]) * k; xr += (st[18] - st[19]) * k;
          }
          if (crk > 0 || st[30] !== 0) {
            let eTl = 0, eTr = 0, ePl = 0, ePr = 0;
            if (pEv > 0) {
              rC ^= rC << 13; rC ^= rC >>> 17; rC ^= rC << 5;
              if ((rC >>> 0) / 4294967296 < pEv) {
                rC ^= rC << 13; rC ^= rC >>> 17; rC ^= rC << 5; const r1 = (rC >>> 0) / 4294967296;
                rC ^= rC << 13; rC ^= rC >>> 17; rC ^= rC << 5; const r2 = (rC >>> 0) / 4294967296;
                rC ^= rC << 13; rC ^= rC >>> 17; rC ^= rC << 5; const r3 = (rC >>> 0) / 4294967296;
                const sg = r3 < 0.5 ? -1 : 1, gl = 1 - 0.75 * r2, gr = 0.25 + 0.75 * r2;
                if (r3 > 0.46 && r3 < 0.54) { const A = cAmp * (0.5 + 0.5 * r1) * sg; ePl = A * gl; ePr = A * gr; } // a pop (8 %)
                else { const A = cAmp * (0.04 + 0.96 * r1 * r1 * r1 * r1) * sg; eTl = A * gl; eTr = A * gr; } // a tick, mostly tiny
              }
            }
            let ck = 0, cr2 = 0;
            v3 = eTl - st[21]; v1 = ta1 * st[20] + ta2 * v3; v2 = st[21] + ta2 * st[20] + ta3 * v3; st[20] = 2 * v1 - st[20]; st[21] = 2 * v2 - st[21]; ck = v1 * nT;
            v3 = eTr - st[23]; v1 = ta1 * st[22] + ta2 * v3; v2 = st[23] + ta2 * st[22] + ta3 * v3; st[22] = 2 * v1 - st[22]; st[23] = 2 * v2 - st[23]; cr2 = v1 * nT;
            v3 = ePl - st[25]; v1 = pa1 * st[24] + pa2 * v3; v2 = st[25] + pa2 * st[24] + pa3 * v3; st[24] = 2 * v1 - st[24]; st[25] = 2 * v2 - st[25];
            st[28] += (v2 * nP - st[28]) * aPh; ck += v2 * nP - st[28];
            v3 = ePr - st[27]; v1 = pa1 * st[26] + pa2 * v3; v2 = st[27] + pa2 * st[26] + pa3 * v3; st[26] = 2 * v1 - st[26]; st[27] = 2 * v2 - st[27];
            st[29] += (v2 * nP - st[29]) * aPh; cr2 += v2 * nP - st[29];
            st[30] = Math.abs(ck) + Math.abs(cr2) > 1e-9 ? 1 : 0;
            xl += ck * gate; xr += cr2 * gate;
          }
          // ---- mono, then a soft safety ceiling (never reached in normal use)
          if (mono > 0) { const m = 0.5 * (xl + xr); xl += (m - xl) * mono; xr += (m - xr) * mono; }
          if (xl > 1.5) xl = 1.5 + 0.45 * Math.tanh((xl - 1.5) / 0.45); else if (xl < -1.5) xl = -1.5 - 0.45 * Math.tanh((-xl - 1.5) / 0.45);
          if (xr > 1.5) xr = 1.5 + 0.45 * Math.tanh((xr - 1.5) / 0.45); else if (xr < -1.5) xr = -1.5 - 0.45 * Math.tanh((-xr - 1.5) / 0.45);
          oL[i] = xl; if (oR !== oL) oR[i] = xr;
        }
        // keep the sines unit length, flush tiny values, recover from a NaN
        let k = 1.5 - 0.5 * (swc * swc + sws * sws); SW[0] = swc * k; SW[1] = sws * k;
        k = 1.5 - 0.5 * (sfc * sfc + sfs * sfs); SF[0] = sfc * k; SF[1] = sfs * k;
        k = 1.5 - 0.5 * (src * src + srs * srs); SR[0] = src * k; SR[1] = srs * k;
        let bad = !(g === g) || !(refP === refP) || !(wetP === wetP);
        for (let j = 0; j < 30; j++) { const v = st[j]; if (!(v === v) || !isFinite(v)) bad = true; else if (Math.abs(v) < 1e-25) st[j] = 0; }
        if (bad) { st.fill(0); g = 1; refP = wetP = 0; }
        if (refP < 1e-25) refP = 0;
        if (wetP < 1e-25) wetP = 0;
        if (env < 1e-25) env = 0;
        dep[0] = d0; dep[1] = d1; dep[2] = d2; dep[3] = d3;
        this.w = w; this.env = env; this.g = g; this.refP = refP; this.wetP = wetP;
        this.rM = rM; this.rH = rH; this.rC = rC;
        return true;
      }
    }
    function lpOf(fmax, age, narrow) { return fmax * Math.pow(3000 / fmax, 1 - (1 - narrow) * (1 - age)); }
    registerProcessor("kdfx-lo-fi", LoFi);
  }

  // ------------------------------------------------------------------ the effect
  K.register({
    id: "lo-fi", num: 29, name: "LO-FI", group: "GLITCH & CHAOS",
    caption: "Dusty, old, warped drums.",
    axes: { x: "AGE", y: "WOW DEPTH" },
    dials: [
      { id: "crackle", name: "CRACKLE", def: 0.35, fmt: (v) => (v < 0.01 ? "OFF" : Math.max(1, Math.round(v * (4 + 56 * v))) + " /s") },
      { id: "bandwidth", name: "BANDWIDTH", def: 0.7, fmt: (v) => (v > 0.99 ? "FULL" : K.fmt.hz(Math.max(20, hpOf(1 - v))) + "-" + K.fmt.hz(lpOf(22050, 0, 1 - v))) },
    ],
    toggles: [
      { id: "drift", name: "RPM DRIFT", def: false },
      { id: "mono", name: "MONO", def: false },
    ],
    presets: [
      { name: "Dusty Break", voice: "all", sync: true, x: 0.85, y: 0.25, wet: 0.9, dials: { crackle: 0.75, bandwidth: 0.3 }, toggles: { drift: true, mono: true } },
      { name: "Cassette Snare", voice: "snare", x: 0.8, y: 0.88, wet: 0.9, dials: { crackle: 0, bandwidth: 0.75 }, toggles: { drift: false, mono: false } },
      { name: "Old Radio Hats", voice: "hats", x: 0.64, y: 0.02, wet: 1, dials: { crackle: 0.15, bandwidth: 0 }, toggles: { drift: false, mono: true } },
      { name: "Warm Kick", voice: "kick", x: 0.3, y: 0.15, wet: 0.85, dials: { crackle: 0.1, bandwidth: 1 }, toggles: { drift: false, mono: false } },
    ],
    worklets: { "kdfx-lo-fi": "(" + proc.toString() + ")();" },

    create(ctx, env) {
      const sr = ctx.sampleRate, nyq = sr / 2;
      const input = ctx.createGain(), output = ctx.createGain();
      const parts = [input, output];
      let node = null, fb = null;
      if (K.hasWorklet(ctx, "kdfx-lo-fi")) {
        node = new AudioWorkletNode(ctx, "kdfx-lo-fi", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { seed: (env && env.seed) || 1, base: BASE } });
        input.connect(node); node.connect(output); parts.push(node);
      } else {
        // fallback: a wobbling delay (oscillators on delayTime) into a 4th-order band, no noise
        const delay = ctx.createDelay(0.1);
        delay.delayTime.value = BASE / sr;
        const wowOsc = ctx.createOscillator(), wowAmt = ctx.createGain(), rpmOsc = ctx.createOscillator(), rpmAmt = ctx.createGain();
        wowOsc.frequency.value = 0.7; rpmOsc.frequency.value = RPM_HZ; wowAmt.gain.value = 0; rpmAmt.gain.value = 0;
        wowOsc.connect(wowAmt); wowAmt.connect(delay.delayTime); rpmOsc.connect(rpmAmt); rpmAmt.connect(delay.delayTime);
        const bq = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
        const hp1 = bq("highpass", 0, -5.33), hp2 = bq("highpass", 0, 2.32), lp1 = bq("lowpass", nyq, -5.33), lp2 = bq("lowpass", nyq, 2.32);
        const makeup = ctx.createGain(), stereo = ctx.createGain(), mono = ctx.createGain();
        mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.gain.value = 0;
        input.connect(delay); delay.connect(hp1); hp1.connect(hp2); hp2.connect(lp1); lp1.connect(lp2); lp2.connect(makeup);
        makeup.connect(stereo); makeup.connect(mono); stereo.connect(output); mono.connect(output);
        wowOsc.start(); rpmOsc.start();
        fb = { delay, wowOsc, wowAmt, rpmOsc, rpmAmt, hp1, hp2, lp1, lp2, makeup, stereo, mono };
        parts.push(delay, wowOsc, wowAmt, rpmOsc, rpmAmt, hp1, hp2, lp1, lp2, makeup, stereo, mono);
      }
      let first = true;
      const put = (param, v) => { if (!param || !isFinite(v)) return; if (first) param.setValueAtTime(v, ctx.currentTime); else K.ramp(param, v, ctx); };

      return {
        input, output, latency: BASE / sr,
        set(s) {
          const a = K.clamp(s.amount || 0), x = K.clamp(s.x == null ? 0.5 : s.x), y = K.clamp(s.y == null ? 0.5 : s.y);
          const d = s.dials || {}, t = s.toggles || {};
          const v = {
            age: x * a,
            wow: y * a,
            crackle: K.clamp(d.crackle == null ? 0.35 : d.crackle) * a,
            narrow: (1 - K.clamp(d.bandwidth == null ? 0.7 : d.bandwidth)) * a,
            drift: t.drift ? a : 0,
            mono: t.mono ? Math.min(1, a * 3) : 0,
          };
          if (node) {
            for (const k of Object.keys(v)) put(node.parameters.get(k), v[k]);
          } else {
            const wowS = swing(40 * v.wow, 0.7), rpmS = swing(6 * v.drift, RPM_HZ);
            put(fb.delay.delayTime, BASE / sr + wowS + rpmS);
            put(fb.wowAmt.gain, wowS); put(fb.rpmAmt.gain, rpmS);
            const hp = hpOf(v.narrow), lp = Math.min(nyq, lpOf(nyq, v.age, v.narrow)), q2 = 20 * Math.log10(1.307 * (1 + 0.5 * v.narrow));
            put(fb.hp1.frequency, hp); put(fb.hp2.frequency, hp); put(fb.lp1.frequency, lp); put(fb.lp2.frequency, lp);
            put(fb.hp2.Q, q2); put(fb.lp2.Q, q2);
            put(fb.makeup.gain, Math.pow(10, (4 * v.narrow + 2 * v.age) / 20));
            put(fb.stereo.gain, 1 - v.mono); put(fb.mono.gain, v.mono);
          }
          first = false;
        },
        destroy() {
          if (node) try { node.port.postMessage({ close: true }); } catch (e) { /* gone */ }
          if (fb) for (const o of [fb.wowOsc, fb.rpmOsc]) try { o.stop(); } catch (e) { /* not started */ }
          for (const p of parts) try { p.disconnect(); } catch (e) { /* already */ }
        },
      };
    },
  });
})();

// KILLDRUM FX 30 MORPH: one move transforms the whole sound. MORPH runs a short chain of the other
// FX-tab effects (found by spec number) and keeps five settings of it: CLEAN in the centre and four
// edge states A (left), B (right), C (bottom), D (top). The dot's direction picks the blend
// (bilinear around the rim, a corner = both its edge states) and amount says how far it goes.
// Each stage is mixed dry/wet inside the chain. Missing effects get a small native stand-in.
(function () {
  "use strict";
  const K = window.KdFx;
  if (!K) return;
  const clamp = K.clamp;
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const elerp = (a, b, t) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * clamp(t));
  const LAT = 0.003; // every chain is padded to this, so the latency the host sees never changes

  // ------------------------------------------------------------------ native helpers
  const gain = (ctx, v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const biq = (ctx, type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
  const stereo = (g) => { g.channelCount = 2; g.channelCountMode = "explicit"; g.channelInterpretation = "speakers"; return g; };
  const osc = (ctx, f, type = "sine") => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  const cache = new Map();
  const cached = (k, make) => { let c = cache.get(k); if (!c) cache.set(k, (c = make())); return c; };
  const curveOf = (k, n, fn) => cached(k, () => { const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1); return c; });
  const stairs = (bits) => { const L = Math.pow(2, bits - 1); return curveOf("s" + bits, 16385, (v) => Math.round(v * L) / L); };
  const FOLDR = 8;
  const fold = () => curveOf("fold", 8193, (v) => { const m = ((((v * FOLDR + 1) % 4) + 4) % 4); return 1 - Math.abs(m - 2); });
  const lim = () => curveOf("lim", 4096, (v) => 0.6 * Math.tanh(v / 0.6));
  const irs = new WeakMap();
  const verb = (ctx) => { let b = irs.get(ctx); if (!b) irs.set(ctx, (b = K.impulse(ctx, { sec: 2.2, decay: 2.6, seed: 2424, bright: 0.9 }))); return b; };

  // a stand-in's shell: stereo in/out, nodes to drop on destroy
  function shell(ctx) {
    const s = { input: stereo(gain(ctx)), output: gain(ctx), latency: 0, nodes: [], set() {} };
    s.keep = (n) => (s.nodes.push(n), n);
    s.r = (p, v) => K.ramp(p, v, ctx);
    s.destroy = () => { for (const n of [s.input, s.output, ...s.nodes]) { try { if (n.stop) n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} } };
    return s;
  }
  // Stand-ins read the numbers the real effect would get: x, y, amount, d (dials), t (toggles).
  const STAND = {};
  STAND[1] = (ctx) => { // grain cloud: three wobbling short delays smear the hit into a haze
    const s = shell(ctx), dry = s.keep(gain(ctx, 1)), wet = s.keep(gain(ctx, 0)), lp = s.keep(biq(ctx, "lowpass", 7000, -3));
    s.input.connect(dry).connect(s.output);
    const taps = [0, 1, 2].map((k) => {
      const d = s.keep(ctx.createDelay(0.5)), lfo = s.keep(osc(ctx, 0.37 + 0.29 * k)), dep = s.keep(gain(ctx, 0)), tg = s.keep(gain(ctx, 0.4));
      d.delayTime.value = 0.03; lfo.connect(dep).connect(d.delayTime); s.input.connect(d).connect(tg).connect(lp);
      return { d, dep };
    });
    lp.connect(wet).connect(s.output);
    s.set = (v) => {
      const a = v.amount;
      taps.forEach((t, k) => { s.r(t.d.delayTime, (0.012 + 0.09 * clamp(v.d[0])) * (1 + 0.8 * k)); s.r(t.dep.gain, 0.0035 * clamp(v.y) * a); });
      s.r(wet.gain, a * (0.3 + 0.5 * clamp(v.x))); s.r(dry.gain, 1 - 0.4 * a);
    };
    return s;
  };
  const freeze = (t1, t2) => (ctx) => { // grain/spectral freeze: two long limited feedback echoes hold the hit
    const s = shell(ctx), dry = s.keep(gain(ctx, 1)), wet = s.keep(gain(ctx, 0));
    s.input.connect(dry).connect(s.output);
    const combs = [t1, t2].map((t) => {
      const d = s.keep(ctx.createDelay(1)), lp = s.keep(biq(ctx, "lowpass", 4200, -3)), hp = s.keep(biq(ctx, "highpass", 140, -3)), sh = s.keep(ctx.createWaveShaper()), fb = s.keep(gain(ctx, 0));
      sh.curve = lim(); d.delayTime.value = t;
      s.input.connect(d); d.connect(lp).connect(hp).connect(sh).connect(fb).connect(d); sh.connect(wet);
      return { d, fb, t };
    });
    wet.connect(s.output);
    s.set = (v) => {
      const a = v.amount, f = Math.min(0.92, a * (0.55 + 0.37 * clamp(v.d[0])));
      for (const c of combs) { s.r(c.fb.gain, f); s.r(c.d.delayTime, c.t * (0.6 + 0.8 * clamp(v.x))); }
      s.r(wet.gain, 0.5 * a * Math.sqrt(1 - f * f) * 1.6); s.r(dry.gain, 1 - 0.55 * a);
    };
    return s;
  };
  STAND[2] = freeze(0.083, 0.121);
  STAND[11] = freeze(0.047, 0.067);
  STAND[7] = (ctx) => { // pitch delay: a tempo echo with a filter in its loop (no pitch shift)
    const s = shell(ctx), d = s.keep(ctx.createDelay(2)), lp = s.keep(biq(ctx, "lowpass", 5000, -3)), fb = s.keep(gain(ctx, 0)), wet = s.keep(gain(ctx, 0));
    s.input.connect(s.output); s.input.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(wet).connect(s.output);
    s.set = (v) => {
      const a = v.amount, f = 0.78 * clamp(v.y) * a;
      s.r(d.delayTime, K.beats(v.bpm, K.pickNote(clamp(v.d[0]), 2, 6)[0])); s.r(fb.gain, f);
      s.r(wet.gain, 0.6 * a * Math.sqrt(1 - f * f)); s.r(lp.frequency, 900 + 6000 * clamp(v.d[1]) * (0.5 + clamp(v.x)));
    };
    return s;
  };
  STAND[14] = (ctx) => { // acid filter: resonant LP (or HP when MODE >= half) sweeping toward the X cutoff
    const s = shell(ctx), f = s.keep(biq(ctx, "lowpass", 20000, -3)), comp = s.keep(gain(ctx, 1));
    s.input.connect(f).connect(comp).connect(s.output);
    s.set = (v) => {
      const a = v.amount, hp = v.d[1] >= 0.5, fx = 40 * Math.pow(2, 8.6 * clamp(v.x)), q = -3 + 15 * clamp(v.y) * a;
      if (f.type !== (hp ? "highpass" : "lowpass")) f.type = hp ? "highpass" : "lowpass";
      s.r(f.frequency, hp ? elerp(12, fx, a) : elerp(20000, fx, a)); s.r(f.Q, q); s.r(comp.gain, Math.pow(10, -Math.max(0, q) / 40));
    };
    return s;
  };
  STAND[15] = (ctx) => { // phaser: four LFO-swept all-passes mixed with the dry
    const s = shell(ctx), dry = s.keep(gain(ctx, 1)), wet = s.keep(gain(ctx, 0)), lfo = s.keep(osc(ctx, 0.3)), dep = s.keep(gain(ctx, 0));
    s.input.connect(dry).connect(s.output);
    let n = s.input; const aps = [];
    for (let k = 0; k < 4; k++) { const ap = s.keep(biq(ctx, "allpass", 600, 0.7)); n.connect(ap); n = ap; aps.push(ap); dep.connect(ap.detune); }
    lfo.connect(dep); n.connect(wet).connect(s.output);
    s.set = (v) => {
      const a = v.amount, c = 250 * Math.pow(2, 3.6 * clamp(v.d[1]));
      s.r(lfo.frequency, 0.05 * Math.pow(2, 7 * clamp(v.x)));
      aps.forEach((ap, k) => { s.r(ap.frequency, c * [0.5, 0.8, 1.3, 2.1][k]); s.r(ap.Q, 0.5 + 2.5 * clamp(v.y)); });
      s.r(dep.gain, 2000 * a); s.r(wet.gain, 0.5 * a); s.r(dry.gain, 1 - 0.5 * a);
    };
    return s;
  };
  STAND[16] = (ctx) => { // bitcrush: stair-step curve
    const s = shell(ctx), ws = s.keep(ctx.createWaveShaper());
    s.input.connect(ws).connect(s.output);
    s.set = (v) => { const bits = Math.round(24 - 23 * clamp(v.x) * v.amount); ws.curve = bits >= 13 ? null : stairs(Math.max(1, bits)); };
    return s;
  };
  STAND[17] = (ctx) => { // wavefold: drive into a triangle fold, offset for asymmetry, DC blocked
    const s = shell(ctx), pre = s.keep(gain(ctx, 1 / FOLDR)), ws = s.keep(ctx.createWaveShaper()), post = s.keep(gain(ctx, 1)), dc = s.keep(biq(ctx, "highpass", 15, -3)),
      bias = s.keep(ctx.createConstantSource()), bg = s.keep(gain(ctx, 0));
    ws.curve = fold(); bias.start();
    s.input.connect(pre).connect(ws); bias.connect(bg).connect(ws); ws.connect(post).connect(dc).connect(s.output);
    s.set = (v) => { const a = v.amount, g = 1 + 6 * clamp(v.x) * a; s.r(pre.gain, g / FOLDR); s.r(post.gain, 1 / Math.sqrt(g)); s.r(bg.gain, ((clamp(v.y) - 0.5) * 0.8 * a) / FOLDR); };
    return s;
  };
  STAND[18] = (ctx) => { // tape drive: tanh drive, head bump shelf, softer highs
    const s = shell(ctx), ws = s.keep(ctx.createWaveShaper()), bump = s.keep(biq(ctx, "lowshelf", 75)), hi = s.keep(biq(ctx, "lowpass", 20000, -3)), post = s.keep(gain(ctx, 1));
    bump.gain.value = 0;
    s.input.connect(ws).connect(bump).connect(hi).connect(post).connect(s.output);
    s.set = (v) => {
      const a = v.amount, k = 1 + 7 * clamp(v.x) * a;
      ws.curve = k < 1.05 ? null : K.tanhCurve(k);
      s.r(post.gain, k < 1.05 ? 1 : Math.pow(Math.tanh(k) / k, 0.6)); s.r(bump.gain, 7 * clamp(v.d[1]) * a); s.r(hi.frequency, elerp(20000, 7000, a));
    };
    return s;
  };
  STAND[19] = (ctx) => { // ring mod: the hit times a carrier (square past half of Y)
    const s = shell(ctx), vca = s.keep(gain(ctx, 1)), car = s.keep(osc(ctx, 400)), amt = s.keep(gain(ctx, 0));
    car.connect(amt).connect(vca.gain); s.input.connect(vca).connect(s.output);
    s.set = (v) => {
      const sq = clamp(v.y) > 0.5, m = v.amount * (0.4 + 0.6 * clamp(v.d[0]));
      if (car.type !== (sq ? "square" : "sine")) car.type = sq ? "square" : "sine";
      s.r(car.frequency, 40 * Math.pow(2, 7.5 * clamp(v.x))); s.r(amt.gain, m * (sq ? 0.75 : 1)); s.r(vca.gain, 1 - m);
    };
    return s;
  };
  STAND[19].def = [1, 0.2];
  STAND[23] = (ctx) => { // orbit: an LFO swings the pan
    const s = shell(ctx), p = s.keep(ctx.createStereoPanner()), lfo = s.keep(osc(ctx, 0.5)), dep = s.keep(gain(ctx, 0));
    p.channelCount = 1; p.channelCountMode = "explicit"; // mono in, equal-power pan: a hard side never stacks both channels
    lfo.connect(dep).connect(p.pan); s.input.connect(p).connect(s.output);
    s.set = (v) => { s.r(lfo.frequency, 0.08 * Math.pow(2, 7 * clamp(v.x))); s.r(dep.gain, clamp(v.y) * v.amount); };
    return s;
  };
  STAND[24] = (ctx) => { // shimmer: a bright reverb wash
    const s = shell(ctx), dry = s.keep(gain(ctx, 1)), cv = s.keep(ctx.createConvolver()), hp = s.keep(biq(ctx, "highpass", 300, -3)), wet = s.keep(gain(ctx, 0));
    cv.buffer = verb(ctx);
    s.input.connect(dry).connect(s.output); s.input.connect(hp).connect(cv).connect(wet).connect(s.output);
    s.set = (v) => { const a = v.amount; s.r(wet.gain, a * (0.3 + 0.7 * clamp(v.x)) * 0.8); s.r(dry.gain, 1 - 0.3 * a); };
    return s;
  };
  STAND[29] = (ctx) => { // lo-fi: band-limited, gently saturated
    const s = shell(ctx), hp = s.keep(biq(ctx, "highpass", 10, -3)), lp = s.keep(biq(ctx, "lowpass", 20000, -3)), ws = s.keep(ctx.createWaveShaper()), post = s.keep(gain(ctx, 1));
    s.input.connect(hp).connect(lp).connect(ws).connect(post).connect(s.output);
    s.set = (v) => {
      const a = v.amount * (0.4 + 0.6 * clamp(v.x)), nar = 1 - clamp(v.d[1]), k = 1 + 2.5 * a;
      s.r(hp.frequency, elerp(10, 80 + 320 * nar, a)); s.r(lp.frequency, elerp(20000, 9000 - 6500 * nar, a));
      ws.curve = k < 1.05 ? null : K.tanhCurve(k); s.r(post.gain, k < 1.05 ? 1 : Math.pow(Math.tanh(k) / k, 0.7));
    };
    return s;
  };

  // ------------------------------------------------------------------ the chains
  // stages: spec numbers, curve > 1 = comes in later along the morph. In a state each stage is
  // { preset (the effect's own preset to borrow when it is loaded), wet, amount, x, y, dials, toggles }
  // (x/y/dials are used when the preset is missing or a stand-in runs); null = stage not used.
  // CLEAN (centre) = every stage off. trim = dB makeup for LEARN when the AGC worklet is missing.
  const HP = [0, 0.62]; // acid filter dials: no env, MODE = HP
  const CHAINS = [
    { name: "RISE", stages: [{ num: 1, curve: 0.8 }, { num: 24, curve: 1.5 }, { num: 14, curve: 1 }], trim: { A: -1, B: -1, C: -1, D: -1.5 },
      states: {
        A: [{ preset: "Snare Nebula", wet: 0.45, x: 0.5, y: 0.6, dials: [0.4, 0.6] }, { preset: "Heaven Snare", wet: 0.55, x: 0.8, y: 0.8 }, { wet: 1, x: 0.36, y: 0.45, dials: HP }],
        B: [{ preset: "Dust Halo", wet: 0.6, x: 0.85, y: 0.4, dials: [0.05, 0.3] }, { preset: "Angel Hats", wet: 0.4, x: 0.6, y: 0.6 }, { wet: 1, x: 0.5, y: 0.55, dials: HP }],
        C: [{ preset: "Kick Fog", wet: 0.5, x: 0.3, y: 0.2, dials: [0.9, 0.3] }, { preset: "Organ Perc", wet: 0.5, x: 0.6, y: 0.5 }, { wet: 1, x: 0.3, y: 0.7, dials: HP }],
        D: [{ preset: "Snare Nebula", wet: 0.5, x: 0.6, y: 0.7, dials: [0.4, 0.7] }, { preset: "Heaven Snare", wet: 0.6, x: 0.9, y: 0.85 }, { wet: 1, x: 0.62, y: 0.65, dials: HP }],
      } },
    { name: "COLLAPSE", stages: [{ num: 20, curve: 0.5 }, { num: 16, curve: 1.2 }, { num: 17, curve: 1.8 }], trim: { A: -2, B: -2, C: -2, D: -2 },
      states: {
        A: [{ preset: "Punch", wet: 1, x: 0.8, y: 0.35 }, { preset: "Grit Kick", wet: 1, x: 0.62, y: 0.3 }, { preset: "Fold Kick", wet: 0.5, x: 0.35, y: 0.5 }],
        B: [{ preset: "Punch", wet: 1, x: 0.8, y: 0.35 }, { preset: "SP Snare", wet: 0.6, x: 0.5, y: 0.4 }, { preset: "Melt", wet: 0.9, x: 0.85, y: 0.5 }],
        C: [{ preset: "Punch", wet: 0.8, x: 0.75, y: 0.4 }, { preset: "Nintendo Hats", wet: 0.8, x: 0.85, y: 0.6 }, null],
        D: [{ preset: "Crack", wet: 1, x: 0.85, y: 0.5 }, { preset: "SP Snare", wet: 0.4, x: 0.5, y: 0.4 }, { preset: "Razor Snare", wet: 0.8, x: 0.7, y: 0.5 }],
      } },
    { name: "DISSOLVE", stages: [{ num: 1, curve: 0.6 }, { num: 2, curve: 2 }, { num: 11, curve: 2 }], trim: { A: -1, B: -1, C: -1, D: -1 },
      states: {
        A: [{ preset: "Snare Nebula", wet: 0.6, x: 0.6, y: 0.6, dials: [0.4, 0.7] }, { preset: "Ice Snare", wet: 0.7, x: 0.5, y: 0.5, dials: [0.8, 0.5] }, null],
        B: [{ preset: "Snare Nebula", wet: 0.6, x: 0.6, y: 0.6, dials: [0.4, 0.7] }, null, { preset: "Crystal Snare", wet: 0.7, x: 0.6, y: 0.4, dials: [0.8, 0.5] }],
        C: [{ preset: "Kick Fog", wet: 0.6, x: 0.3, y: 0.2, dials: [0.9, 0.3] }, { preset: "Ghost Note", wet: 0.5, x: 0.4, y: 0.3 }, { preset: "Hat Haze", wet: 0.4, x: 0.8, y: 0.5 }],
        D: [{ preset: "Dust Halo", wet: 0.6, x: 0.85, y: 0.5, dials: [0.05, 0.4] }, null, { preset: "Prism", wet: 0.6, x: 0.5, y: 0.9, dials: [0.6, 0.6] }],
      } },
    { name: "SPACESHIP", stages: [{ num: 23, curve: 1 }, { num: 15, curve: 1 }, { num: 7, curve: 1.3 }], trim: { A: 0, B: -1, C: -1, D: -1 },
      states: {
        A: [{ preset: "Halo Hats", wet: 1, x: 0.35, y: 1 }, { preset: "Liquid Hats", wet: 0.6, x: 0.3, y: 0.5 }, null],
        B: [{ preset: "Bounce", wet: 0.8, x: 0.75, y: 0.9 }, { preset: "Underwater", wet: 0.9, x: 0.6, y: 0.8, dials: [1, 0.35] }, null],
        C: [null, null, { preset: "Descent", wet: 0.55, x: 0.1, y: 0.55, dials: [0.5, 0.4] }],
        D: [null, null, { preset: "Arp Hats", wet: 0.55, x: 0.8, y: 0.5, dials: [0.85, 0.7] }],
      } },
    { name: "DIRT", stages: [{ num: 18, curve: 0.7 }, { num: 17, curve: 1.4 }, { num: 16, curve: 1.2 }], trim: { A: -2, B: -2, C: -1, D: -3 },
      states: {
        A: [{ preset: "Fat Kick", wet: 1, x: 0.55, y: 0.1, dials: [0.3, 0.8] }, null, null],
        B: [{ preset: "Glue", wet: 1, x: 0.35, y: 0.05 }, { preset: "Buzz Hats", wet: 0.8, x: 0.6, y: 0.75 }, null],
        C: [{ preset: "Glue", wet: 0.8, x: 0.35, y: 0.05 }, null, { preset: "SP Snare", wet: 1, x: 0.52, y: 0.45 }],
        D: [{ preset: "Wobbly Snare", wet: 1, x: 0.5, y: 0.8 }, { preset: "Melt", wet: 0.5, x: 0.9, y: 0.5 }, { preset: "Broken Radio", wet: 0.6, x: 0.95, y: 0.6 }],
      } },
    { name: "DUST", stages: [{ num: 28, curve: 1 }, { num: 29, curve: 0.8 }, { num: 19, curve: 1.3 }], trim: { A: -1, B: -1, C: 0, D: -1 },
      states: {
        A: [null, { preset: "Dusty Break", wet: 1, x: 0.7, y: 0.4, dials: [0.6, 0.35] }, null],
        B: [null, { preset: "Warm Kick", wet: 0.7, x: 0.3, y: 0.2, dials: [0.2, 0.8] }, { preset: "Bell Hats", wet: 0.55, x: 0.8, y: 0.2 }],
        C: [{ preset: "Nervous", wet: 1, x: 0.7, y: 0.2 }, { preset: "Cassette Snare", wet: 0.7, x: 0.5, y: 0.7, dials: [0.3, 0.6] }, null],
        D: [{ preset: "Twitch", wet: 1, x: 0.35, y: 0.7 }, { preset: "Old Radio Hats", wet: 1, x: 0.6, y: 0.3, dials: [0.2, 0.05] }, { preset: "Robot Snare", wet: 0.35, x: 0.45, y: 0.1 }],
      } },
  ];
  K.morphChains = CHAINS;
  const chains = () => (Array.isArray(K.morphChains) && K.morphChains.length ? K.morphChains : CHAINS);

  // one stage's numbers in one state: from the real effect's own preset, else the table
  function fill(st, e) {
    const dd = st.desc ? st.desc.dials : null, td = st.desc ? st.desc.toggles : null;
    const sdef = (STAND[st.num] && STAND[st.num].def) || [0.5, 0.5];
    const defD = (k) => (dd ? num(dd[k].def, 0.5) : sdef[k]);
    const defT = (k) => (td ? (td[k].def != null ? td[k].def : td[k].options ? 0 : false) : false);
    const nd = dd ? dd.length : 2, nt = td ? td.length : 2;
    const o = { wet: 0, amount: 0, x: 0.5, y: 0.5, dials: [], toggles: [] };
    const pr = e && e.preset && st.desc ? (st.desc.presets || []).find((p) => p.name === e.preset) : null;
    if (pr) {
      o.x = num(pr.x, 0.5); o.y = num(pr.y, 0.5);
      o.amount = num(e.amount, K.amountOf(o.x, o.y, num(pr.strength, 1)));
      o.wet = num(e.wet, num(pr.wet, 1));
    } else if (e) {
      o.x = num(e.x, 0.5); o.y = num(e.y, 0.5); o.amount = num(e.amount, 1); o.wet = num(e.wet, 1);
    }
    for (let k = 0; k < nd; k++) { const v = pr ? pr.dials && pr.dials[dd[k].id] : e && e.dials && e.dials[k]; o.dials[k] = clamp(num(v, defD(k))); }
    for (let k = 0; k < nt; k++) { const v = pr ? pr.toggles && pr.toggles[td[k].id] : e && e.toggles && e.toggles[k]; o.toggles[k] = v != null ? v : defT(k); }
    return o;
  }

  // the edge states' weights for a dot: on the rim it is exactly bilinear (corner = both), inside
  // it is the rim blend scaled by amount^curve
  function dir(s) {
    const x = clamp(num(s.x, 0.5)), y = clamp(num(s.y, 0.5)), ax = Math.abs(2 * x - 1), ay = Math.abs(2 * y - 1), m = Math.max(ax, ay);
    return { X: x < 0.5 ? "A" : "B", Y: y < 0.5 ? "C" : "D", dx: m > 1e-3 ? ax / m : 0, dy: m > 1e-3 ? ay / m : 0,
      amt: clamp(num(s.amount, 0)), pg: Math.pow(3, 1 - 2 * clamp(num(s.dials && s.dials.curve, 0.5))) };
  }
  function mixAt(ch, s) {
    const w = dir(s), SX = ch.states[w.X], SY = ch.states[w.Y], C = ch.states.clean;
    return ch.stages.map((st, j) => {
      const p = Math.pow(w.amt, w.pg * st.curve), wx = p * w.dx, wy = p * w.dy, c = C[j], a = SX[j], b = SY[j];
      const or = (f) => { if (c[f] >= 1) return 1; const va = c[f] + wx * (a[f] - c[f]), vb = c[f] + wy * (b[f] - c[f]); return clamp(1 - ((1 - va) * (1 - vb)) / (1 - c[f])); };
      const ka = wx * a.wet, kb = wy * b.wet, kc = Math.max(0, 1 - wx - wy) * c.wet, kt = ka + kb + kc;
      const avg = (va, vb, vc) => (kt > 1e-6 ? (ka * va + kb * vb + kc * vc) / kt : vc);
      const pick = ka >= kb ? (wx >= 0.5 && a.wet > 0 ? a : null) : (wy >= 0.5 && b.wet > 0 ? b : null);
      return { wet: or("wet"), amount: or("amount"), x: avg(a.x, b.x, c.x), y: avg(a.y, b.y, c.y),
        dials: c.dials.map((v, k) => avg(a.dials[k], b.dials[k], v)), toggles: (pick || c).toggles.slice() };
    });
  }

  // LEARN: keeps the morph's output as loud as its input (slow loudness match, about 1 s)
  function agcProc() {
    class P extends AudioWorkletProcessor {
      static get parameterDescriptors() { return [{ name: "on", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" }]; }
      constructor() {
        super();
        this.alive = true; this.r = 0; this.w = 0; this.g = 1;
        this.kms = 1 - Math.exp(-128 / (1.0 * sampleRate)); this.kg = 1 - Math.exp(-128 / (0.35 * sampleRate));
        this.port.onmessage = (e) => { if (e.data && e.data.close) this.alive = false; };
      }
      process(inputs, outputs, params) {
        if (!this.alive) return false;
        const ref = inputs[0] || [], wet = inputs[1] || [], out = outputs[0], n = out[0].length;
        let er = 0, ew = 0;
        for (let c = 0; c < ref.length; c++) { const d = ref[c]; for (let i = 0; i < n; i++) er += d[i] * d[i]; }
        for (let c = 0; c < wet.length; c++) { const d = wet[c]; for (let i = 0; i < n; i++) ew += d[i] * d[i]; }
        er /= n * Math.max(1, ref.length); ew /= n * Math.max(1, wet.length);
        this.r += (er - this.r) * this.kms; this.w += (ew - this.w) * this.kms;
        if (this.r < 1e-20) this.r = 0; if (this.w < 1e-20) this.w = 0;
        let tg = 1;
        if (params.on[0] > 0.5) tg = this.r > 1e-8 && this.w > 1e-10 ? Math.min(1.6, Math.max(0.18, Math.sqrt(this.r / this.w))) : this.g;
        const g0 = this.g, g1 = g0 + (tg - g0) * this.kg;
        this.g = g1;
        for (let c = 0; c < out.length; c++) {
          const o = out[c], d = wet[c] || wet[0];
          if (!d) { o.fill(0); continue; }
          for (let i = 0; i < n; i++) o[i] = d[i] * (g0 + ((g1 - g0) * i) / n);
        }
        return true;
      }
    }
    registerProcessor("kdfx-morph-agc", P);
  }

  // ------------------------------------------------------------------ an instance
  function create(ctx, env) {
    env = env || {};
    const offline = typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext;
    const input = stereo(gain(ctx)), output = gain(ctx), sum = gain(ctx), trimG = gain(ctx);
    const LATS = Math.round(LAT * ctx.sampleRate) / ctx.sampleRate; // whole samples: no blur in the pad delay
    let agc = null;
    if (K.hasWorklet(ctx, "kdfx-morph-agc")) {
      try { agc = new AudioWorkletNode(ctx, "kdfx-morph-agc", { numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit", channelInterpretation: "speakers" }); } catch (e) { agc = null; }
    }
    sum.connect(trimG);
    if (agc) { input.connect(agc, 0, 0); trimG.connect(agc, 0, 1); agc.connect(output); } else trimG.connect(output);
    let chain = null, last = null, cur = null, tgt = null, timer = 0, tickAt = 0, dead = false;
    const fading = new Set();
    const inst = { input, output, latency: LATS, set, trigger, destroy, getState, setState };

    function makeStage(sd, i) {
      const senv = Object.assign({}, env, { seed: ((env.seed >>> 0) || 1) + 7919 * (i + 1) });
      const desc = K.effects.find((e) => e.num === sd.num && e.id !== "morph");
      let it = null;
      if (desc) try { it = desc.create(ctx, senv); } catch (e) { console.error("MORPH stage " + desc.id, e); it = null; }
      const real = !!it;
      if (!it && STAND[sd.num]) it = STAND[sd.num](ctx, senv);
      if (!it || !it.input || !it.output) return null;
      return { i, num: sd.num, curve: num(sd.curve, 1), desc: real ? desc : null, inst: it, lat: Math.max(0, num(it.latency, 0)) };
    }
    function build(ci) {
      const def = chains()[ci] || chains()[0], out = gain(ctx, 0), nodes = [out], stages = [];
      let prev = input, lat = 0;
      def.stages.forEach((sd, i) => {
        const st = makeStage(sd, i);
        if (!st) return;
        const dry = gain(ctx, 1), wet = gain(ctx, 0), sn = stereo(gain(ctx));
        prev.connect(st.inst.input); st.inst.output.connect(wet).connect(sn);
        if (st.lat > 0) { const d = ctx.createDelay(Math.max(0.01, st.lat * 2)); d.delayTime.value = st.lat; prev.connect(d).connect(dry); nodes.push(d); } else prev.connect(dry);
        dry.connect(sn); nodes.push(dry, wet, sn);
        Object.assign(st, { dry, wet, at: lat }); lat += st.lat; prev = sn; stages.push(st);
      });
      if (lat < LATS - 1e-6) { const pad = ctx.createDelay(LATS + 0.01); pad.delayTime.value = LATS - lat; prev.connect(pad).connect(out); nodes.push(pad); } else prev.connect(out);
      if (lat > inst.latency) inst.latency = lat; // a chain longer than the budget (rare)
      out.connect(sum);
      const states = { clean: stages.map((st) => fill(st, null)) };
      for (const k of ["A", "B", "C", "D"]) states[k] = stages.map((st) => fill(st, def.states && def.states[k] && def.states[k][st.i]));
      return { idx: ci, def, stages, states, out, nodes, fresh: true };
    }
    function drop(ch) {
      if (!ch) return;
      fading.delete(ch);
      for (const st of ch.stages) try { st.inst.destroy(); } catch (e) {}
      for (const n of ch.nodes) try { n.disconnect(); } catch (e) {}
    }
    function sendStage(st, v) {
      const bpm = num(last && last.bpm, env.bpm || 120);
      try {
        if (st.desc) {
          const dials = {}, toggles = {};
          st.desc.dials.forEach((d, k) => (dials[d.id] = v.dials[k]));
          st.desc.toggles.forEach((d, k) => (toggles[d.id] = d.options ? Math.max(0, Math.min(d.options.length - 1, Math.round(+v.toggles[k] || 0))) : !!v.toggles[k]));
          st.inst.set({ x: v.x, y: v.y, amount: v.amount, dials, toggles, bpm });
        } else st.inst.set({ x: v.x, y: v.y, amount: v.amount, d: v.dials, t: v.toggles, bpm });
      } catch (e) { console.error("MORPH set " + st.num, e); }
    }
    const setGain = (p, v, tc, now) => { if (now) { p.cancelScheduledValues(ctx.currentTime); p.setValueAtTime(v, ctx.currentTime); } else K.ramp(p, v, ctx, tc); };
    const copy = (vals) => vals.map((v) => Object.assign({}, v, { dials: v.dials.slice(), toggles: v.toggles.slice() }));
    // SMOOTH in a live context: the stage numbers glide toward the target on a ~30 Hz timer
    function tick() {
      timer = 0;
      if (dead || !chain || !cur || !tgt || cur.length !== tgt.length) return;
      const now = ctx.currentTime, dt = Math.max(0.005, now - tickAt), tc = glideTc();
      tickAt = now;
      const k = 1 - Math.exp(-dt / tc);
      let far = false;
      const step = (c, g) => { const v = c + (g - c) * k; if (Math.abs(g - v) > 0.002) { far = true; return v; } return g; };
      cur.forEach((c, j) => {
        const g = tgt[j];
        c.amount = step(c.amount, g.amount); c.x = step(c.x, g.x); c.y = step(c.y, g.y); c.wet = g.wet;
        c.dials = c.dials.map((v, i) => step(v, g.dials[i])); c.toggles = g.toggles.slice();
        sendStage(chain.stages[j], c);
      });
      if (far) timer = setTimeout(tick, 33);
    }
    const glideTc = () => Math.max(0.02, (clamp(num(last && last.dials && last.dials.smooth, 0)) * 1.5) / 3);
    function set(s) {
      if (dead) return;
      last = s || {};
      const list = chains(), ci = Math.max(0, Math.min(list.length - 1, Math.round(num(last.toggles && last.toggles.chain, 0))));
      if (!chain) { chain = build(ci); chain.out.gain.value = 1; }
      else if (chain.idx !== ci) { // a deliberate chain change: 20 ms crossfade to a fresh chain
        const t = ctx.currentTime, o = chain, g = o.out.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.02);
        fading.add(o); if (!offline) setTimeout(() => drop(o), 150);
        chain = build(ci); chain.out.gain.setValueAtTime(0, t); chain.out.gain.linearRampToValueAtTime(1, t + 0.02);
        cur = null;
      }
      const vals = mixAt(chain, last), tc = glideTc(), fresh = chain.fresh;
      chain.stages.forEach((st, j) => { setGain(st.wet.gain, vals[j].wet, tc, fresh); setGain(st.dry.gain, 1 - vals[j].wet, tc, fresh); });
      tgt = vals;
      if (fresh || offline || tc <= 0.021 || !cur || cur.length !== vals.length) { cur = copy(vals); chain.stages.forEach((st, j) => sendStage(st, cur[j])); }
      else if (!timer) { tickAt = ctx.currentTime - 0.033; tick(); }
      chain.fresh = false;
      const learn = !!(last.toggles && last.toggles.learn);
      if (agc) K.ramp(agc.parameters.get("on"), learn ? 1 : 0, ctx, 0.01);
      else {
        const w = dir(last), tr = chain.def.trim || {}, p = Math.pow(w.amt, w.pg);
        setGain(trimG.gain, learn ? Math.pow(10, (p * (w.dx * num(tr[w.X], 0) + w.dy * num(tr[w.Y], 0))) / 20) : 1, tc, fresh);
      }
    }
    function trigger(hit) {
      if (!chain) set(last || { x: 0.5, y: 0.5, amount: 0, dials: {}, toggles: {}, bpm: env.bpm });
      if (!chain || !hit) return;
      for (const st of chain.stages) if (typeof st.inst.trigger === "function") try { st.inst.trigger(Object.assign({}, hit, { at: hit.at + st.at })); } catch (e) { console.error("MORPH trigger " + st.num, e); }
    }
    function destroy() {
      dead = true;
      if (timer) clearTimeout(timer);
      drop(chain); for (const o of [...fading]) drop(o);
      for (const n of [input, output, sum, trimG]) try { n.disconnect(); } catch (e) {}
      if (agc) { try { agc.port.postMessage({ close: true }); agc.disconnect(); } catch (e) {} }
    }
    // for a future CHAIN EDIT / LEARN-into-corner panel: read and replace the five states
    function getState() {
      if (!chain) set(last || {});
      const deep = (o) => JSON.parse(JSON.stringify(o));
      return { chain: chain.def.name, index: chain.idx, latency: inst.latency, states: deep(chain.states), current: cur ? deep(cur) : null,
        stages: chain.stages.map((st) => ({ num: st.num, id: st.desc ? st.desc.id : null, standIn: !st.desc, latency: st.lat })) };
    }
    function setState(s) {
      if (!s || dead) return;
      if (!chain) set(last || {});
      if (s.chain != null) {
        const ci = typeof s.chain === "number" ? s.chain : chains().findIndex((c) => c.name === s.chain);
        if (ci >= 0 && ci !== chain.idx) set(Object.assign({}, last, { toggles: Object.assign({}, last.toggles, { chain: ci }) }));
      }
      if (s.states) for (const k of ["clean", "A", "B", "C", "D"]) {
        const arr = s.states[k];
        if (!Array.isArray(arr) || arr.length !== chain.stages.length) continue;
        chain.states[k] = arr.map((v, j) => {
          const r = chain.states.clean[j];
          v = v || {};
          return { wet: clamp(num(v.wet, 0)), amount: clamp(num(v.amount, 0)), x: clamp(num(v.x, 0.5)), y: clamp(num(v.y, 0.5)),
            dials: r.dials.map((d, i) => clamp(num(v.dials && v.dials[i], d))), toggles: r.toggles.map((t, i) => (v.toggles && v.toggles[i] != null ? v.toggles[i] : t)) };
        });
      }
      set(last);
    }
    return inst;
  }

  K.register({
    id: "morph", num: 30, name: "MORPH", group: "GLITCH & CHAOS",
    caption: "One knob transforms the whole sound. The real portal trick.",
    axes: { x: "MORPH A-B", y: "MORPH C-D" },
    dials: [
      { id: "curve", name: "CURVE", def: 0.5, fmt: (v) => { const p = Math.pow(3, 1 - 2 * clamp(v)); return Math.abs(p - 1) < 0.07 ? "LINEAR" : p > 1 ? "EXP " + p.toFixed(1) : "LOG " + (1 / p).toFixed(1); } },
      { id: "smooth", name: "SMOOTH", def: 0.1, fmt: (v) => { const t = clamp(v) * 1.5; return t < 1 ? Math.round(t * 1000) + " ms" : t.toFixed(2) + " s"; } },
    ],
    toggles: [
      { id: "chain", name: "CHAIN EDIT", options: CHAINS.map((c) => c.name), def: 0 },
      { id: "learn", name: "LEARN", def: false },
    ],
    presets: [
      { name: "Rise", voice: "all", sync: true, x: 0.56, y: 0.93, wet: 1, dials: { curve: 0.35, smooth: 0.45 }, toggles: { chain: 0, learn: false } },
      { name: "Collapse", voice: "kick", x: 0.9, y: 0.24, wet: 1, dials: { curve: 0.6, smooth: 0.1 }, toggles: { chain: 1, learn: false } },
      { name: "Dissolve", voice: "snare", x: 0.84, y: 0.8, wet: 1, dials: { curve: 0.5, smooth: 0.3 }, toggles: { chain: 2, learn: false } },
      { name: "Spaceship", voice: "hats", x: 0.16, y: 0.85, wet: 0.9, dials: { curve: 0.5, smooth: 0.35 }, toggles: { chain: 3, learn: false } },
    ],
    worklets: { "kdfx-morph-agc": "(" + agcProc.toString() + ")();" },
    create,
  });
})();
