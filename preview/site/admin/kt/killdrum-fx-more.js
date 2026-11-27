// KILLDRUM FX: the last two effects of Eman's DRUM_PORTAL_SPEC_V1, built in the night pass:
// 11 SPECTRAL FREEZE and 12 BIN CRUSH (SPECTRAL & FILTER). Same interface as the group files (/mnt/project-files/killdrum/FX-MODULE.md); loaded
// after ui/killdrum-fx-spectral.js, whose worklet FFT/STFT (K.shared.FFT_SRC) the two spectral
// effects reuse. Every output here is the whole processed voice (amount 0 = the input, delayed
// by `latency`), like the other effects.
// Test: node scripts/kdfx-test.js spectral-freeze bin-crush
(function () {
  "use strict";
  const K = window.KdFx;
  if (!K || !K.register) return;
  const clamp = K.clamp;

  // ---------------------------------------------------------------- worklet side, shared
  // A stereo ring buffer with a cubic (Catmull-Rom) read at any fractional position, a rising-edge
  // detector for the hit pulses the main thread writes on the a-rate "trig" param, and "bye".
  const RING_SRC = `
  class KdRing {
    constructor(sec) { this.n = 1 << Math.ceil(Math.log2(sec * sampleRate)); this.m = this.n - 1; this.b = [new Float32Array(this.n), new Float32Array(this.n)]; this.t = 0; }
    push(l, r) { const i = this.t & this.m; this.b[0][i] = l; this.b[1][i] = r; this.t++; }
    read(ch, pos) {
      const b = this.b[ch], m = this.m, i = Math.floor(pos), f = pos - i;
      const xm = b[(i - 1) & m], x0 = b[i & m], x1 = b[(i + 1) & m], x2 = b[(i + 2) & m];
      return x0 + 0.5 * f * (x1 - xm + f * (2 * xm - 5 * x0 + 4 * x1 - x2 + f * (3 * (x0 - x1) + x2 - xm)));
    }
  }
  class KdEdge { constructor() { this.last = 0; } step(v) { const hit = v > 0 && this.last <= 0 ? v : 0; this.last = v; return hit; } }
  const kp = (name, defaultValue, minValue, maxValue) => ({ name, defaultValue, minValue, maxValue, automationRate: "k-rate" });
  const TRIG = { name: "trig", defaultValue: 0, minValue: 0, maxValue: 64, automationRate: "a-rate" };
  `;

  // ---------------------------------------------------------------- main thread helpers
  const H = {
    node: (ctx, name, params, opts) => new AudioWorkletNode(ctx, name, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], parameterData: params || {}, processorOptions: opts || {} }),
    // first value jumps (so the first hit already sounds right), later ones glide
    setter(ctx) {
      const seen = new WeakSet();
      return (param, v, tc = 0.02) => {
        if (!param || !isFinite(v)) return;
        if (!seen.has(param)) { seen.add(param); param.cancelScheduledValues(0); param.setValueAtTime(v, ctx.currentTime); return; }
        K.ramp(param, v, ctx, tc);
      };
    },
    pulse(param, at, g = 1) { if (!param || !isFinite(at)) return; at = Math.max(0, at); param.setValueAtTime(Math.max(1e-3, g), at); param.setValueAtTime(0, at + 0.004); },
    passthrough(ctx) { const g = ctx.createGain(); return { input: g, output: g, latency: 0, set() {}, destroy() { try { g.disconnect(); } catch (e) { /* gone */ } } }; },
    bye(node) { try { node.port.postMessage("bye"); } catch (e) { /* gone */ } try { node.disconnect(); } catch (e) { /* gone */ } },
    // the song beat of a hit (or its time on a steady grid when the song isn't playing)
    beatOf: (hit, bpm) => (hit.beat != null && isFinite(hit.beat) ? hit.beat : (hit.at * (bpm || 120)) / 60),
    step: (v, n) => Math.min(n - 1, Math.floor(clamp(v) * n)),
  };

  // 03 STUTTER and 04 TAPE STOP: the granular group's versions (ui/killdrum-fx-granular.js) are the
  // ones in use; a night-pass copy here was dropped after an A/B (theirs moved the sound more).

  // ---------------------------------------------------------------- the STFT effects
  const SH = K.shared;
  if (!SH || !SH.FFT_SRC) { console.warn("KILLDRUM FX: spectral freeze / bin crush need killdrum-fx-spectral.js first"); return; }
  const SIZES = [512, 1024, 2048, 4096, 8192];
  // one STFT per FFT size, made when the size is first used; a size change starts the new one clean
  const STFT_HEAD = SH.FFT_SRC + RING_SRC + `
  function kdStftFor(self, n, onFrame) {
    if (!self.stfts) self.stfts = {};
    if (!self.stfts[n]) self.stfts[n] = new KdStft(n, onFrame);
    return self.stfts[n];
  }
  class KdLcg { constructor(s) { this.s = (s >>> 0) || 1; } next() { this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0; return this.s / 4294967296; } }
  `;

  // ================================================================ 11 SPECTRAL FREEZE
  // STFT; each bin's magnitude is held and let go slowly (X = smear time), its phase scrambled by Y
  // (glassy shimmer), mixed over the original by BLEND x distance. FREEZE grabs the spectrum at each
  // hit and holds it (only the next hit replaces it); TRANSIENT KEEP lets each attack through clean.
  (function () {
    const NAME = "kdfx-spectral-freeze";
    const smearOf = (x) => 0.02 * Math.pow(2, clamp(x) * 7.6);   // 20 ms .. ~4 s
    const sizeOf = (v) => SIZES[H.step(v, SIZES.length)];
    const SRC = STFT_HEAD + `
    registerProcessor("${NAME}", class extends AudioWorkletProcessor {
      static get parameterDescriptors() { return [kp("amount", 0, 0, 1), kp("smear", 0.3, 0.005, 10), kp("phase", 0, 0, 1), kp("size", 2048, 256, 8192), kp("blend", 0.7, 0, 1), kp("freeze", 0, 0, 1), kp("keep", 0, 0, 1)]; }
      constructor(o) {
        super(); const po = (o && o.processorOptions) || {};
        this.rnd = new KdLcg(((po.seed | 0) + 911) >>> 0); this.pe = 0; this.keepN = 0; this.cap = 0; this.held = {}; this.p = null;
        this.alive = true; this.port.onmessage = (ev) => { if (ev.data === "bye") this.alive = false; };
        this.outs = [new Float32Array(128), new Float32Array(128)];
      }
      frame(re, im, nch) {
        const p = this.p, n = this.cur, h = n >> 1, hop = n >> 2;
        let H = this.held[n]; if (!H) H = this.held[n] = [new Float64Array(h + 1), new Float64Array(h + 1)];
        let e = 0; for (let k = 1; k <= h; k++) e += re[0][k] * re[0][k] + im[0][k] * im[0][k];
        const onset = e > 1e-6 && e > this.pe * 4; this.pe = Math.max(e, this.pe * 0.6);
        if (onset) { if (p.keep) this.keepN = 2; if (p.freeze) this.cap = 2; }
        const a = p.amount, wb = Math.min(1, p.blend * a * 1.2), ph = p.phase * Math.min(1, a * 1.5) * 2 * Math.PI;
        const s = Math.exp(-hop / (Math.max(0.005, p.smear * (0.25 + 0.75 * a)) * sampleRate));
        if (a < 0.002) return;
        if (this.keepN > 0) { this.keepN--; return; }            // the attack goes through untouched
        const trim = 1 / (1 + 0.6 * wb * Math.min(4, p.smear));  // long holds pile up level: give some back
        for (let c = 0; c < nch; c++) {
          const R = re[c], I = im[c], Hc = H[c];
          for (let k = 0; k <= h; k++) {
            const mag = Math.hypot(R[k], I[k]);
            if (p.freeze) Hc[k] = this.cap > 0 ? (this.cap === 2 ? mag : Math.max(Hc[k], mag)) : Hc[k] * s;
            else Hc[k] = Math.max(mag, Hc[k] * s);
            const M = (mag + (Hc[k] - mag) * wb) * (Hc[k] > mag ? trim : 1);
            let phi = Math.atan2(I[k], R[k]);
            if (ph > 0 && k > 0 && k < h) phi += (this.rnd.next() - 0.5) * ph;
            R[k] = M * Math.cos(phi); I[k] = M * Math.sin(phi);
          }
          KdStft.mirror(R, I, n);
        }
        if (this.cap > 0) this.cap--;
      }
      process(inputs, outputs, P) {
        if (!this.alive) return false;
        const inp = inputs[0] || [], L = outputs[0][0], R = outputs[0][1] || L, len = L.length;
        const n = Math.round(P.size[0]);
        this.p = { amount: P.amount[0], smear: P.smear[0], phase: P.phase[0], blend: P.blend[0], freeze: P.freeze[0] > 0.5, keep: P.keep[0] > 0.5 };
        this.cur = n;
        const st = kdStftFor(this, n, (re, im, nch) => this.frame(re, im, nch));
        st.process(inp.length ? [inp[0], inp[1] || inp[0]] : [], [L, R], null, len);
        return true;
      }
    });`;
    K.register({
      id: "spectral-freeze", num: 11, name: "SPECTRAL FREEZE", group: "SPECTRAL & FILTER",
      caption: "Holds a hit's frequency fingerprint like glass.",
      axes: { x: "SMEAR TIME", y: "PHASE RANDOM" },
      fmtX: (x) => { const t = smearOf(x); return t < 1 ? Math.round(t * 1000) + " ms" : t.toFixed(1) + " s"; },
      fmtY: (y) => K.fmt.pct(y),
      dials: [
        { id: "size", name: "FFT SIZE", def: 0.5, fmt: (v) => String(sizeOf(v)) },
        { id: "blend", name: "BLEND", def: 0.75, fmt: K.fmt.pct },
      ],
      toggles: [{ id: "freeze", name: "FREEZE", def: false }, { id: "keep", name: "TRANSIENT KEEP", def: true }],
      presets: [
        { name: "Crystal Snare", voice: "snare", x: 0.74, y: 0.3, wet: 0.7, dials: { size: 0.5, blend: 0.85 }, toggles: { freeze: true, keep: true } },
        { name: "Hat Haze", voice: "hats", x: 0.9, y: 0.62, wet: 0.6, dials: { size: 0.3, blend: 0.7 }, toggles: { freeze: false, keep: false } },
        { name: "Kick Ghost", voice: "kick", x: 0.3, y: 0.22, wet: 0.5, dials: { size: 0.75, blend: 0.6 }, toggles: { freeze: false, keep: true } },
        { name: "Prism", voice: "perc", x: 0.62, y: 0.96, wet: 0.7, dials: { size: 0.5, blend: 0.9 }, toggles: { freeze: false, keep: true } },
        { name: "Glass Clap", voice: "clap", x: 0.8, y: 0.7, wet: 0.6, dials: { size: 0.5, blend: 0.8 }, toggles: { freeze: true, keep: true } },
      ],
      worklets: { [NAME]: SRC },
      create(ctx, env) {
        if (!K.hasWorklet(ctx, NAME)) return H.passthrough(ctx);
        const node = H.node(ctx, NAME, { size: 2048 }, { seed: env.seed || 1 }), put = H.setter(ctx);
        const inst = {
          input: node, output: node, latency: 2048 / ctx.sampleRate,
          set(v) {
            const d = v.dials || {}, t = v.toggles || {}, n = sizeOf(d.size != null ? d.size : 0.5);
            node.parameters.get("size").setValueAtTime(n, ctx.currentTime);
            inst.latency = n / ctx.sampleRate;
            put(node.parameters.get("amount"), clamp(v.amount));
            put(node.parameters.get("smear"), smearOf(v.x));
            put(node.parameters.get("phase"), clamp(v.y));
            put(node.parameters.get("blend"), d.blend != null ? d.blend : 0.75);
            put(node.parameters.get("freeze"), t.freeze ? 1 : 0, 0.001);
            put(node.parameters.get("keep"), t.keep === false ? 0 : 1, 0.001);
          },
          destroy() { H.bye(node); },
        };
        return inst;
      },
    });
  })();

  // ================================================================ 12 BIN CRUSH
  // STFT; only the loudest bins are kept: those above the threshold (X, relative to the frame's
  // peak) and among the top N (Y, 2..512). INVERT keeps the rest instead (all noise, no tone), TONAL
  // SNAP keeps only bins on the song key's scale. ATTACK/RELEASE smooths each bin's on/off, and a
  // gentle makeup gain brings the thin result back near the input level.
  (function () {
    const NAME = "kdfx-bin-crush";
    const keepOf = (y) => Math.max(1, Math.round(Math.pow(2, 1 + clamp(1 - y) * 8)));  // top = few bins
    const thrDb = (x) => -54 + 48 * clamp(x);                                              // vs the frame peak
    const sizeOf = (v) => SIZES.slice(0, 4)[H.step(v, 4)];
    const arOf = (v) => 0.2 * clamp(v) * clamp(v);                                         // 0..200 ms
    const SRC = STFT_HEAD + `
    registerProcessor("${NAME}", class extends AudioWorkletProcessor {
      static get parameterDescriptors() { return [kp("amount", 0, 0, 1), kp("thr", -30, -80, 0), kp("keep", 32, 1, 4096), kp("size", 1024, 256, 8192), kp("ar", 0, 0, 1), kp("invert", 0, 0, 1), kp("snap", 0, 0, 1)]; }
      constructor(o) {
        super(); const po = (o && o.processorOptions) || {};
        this.key = po.key || { tonic: 9, minor: true }; this.g = {}; this.scale = {}; this.mk = 1; this.p = null;
        this.alive = true; this.port.onmessage = (ev) => { if (ev.data === "bye") this.alive = false; };
      }
      scaleBins(n) {
        if (this.scale[n]) return this.scale[n];
        const h = n >> 1, on = new Uint8Array(h + 1), k0 = this.key, steps = k0.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
        for (let k = 1; k <= h; k++) {
          const f = (k * sampleRate) / n, m = 69 + 12 * Math.log2(f / 440), r = Math.round(m), pc = (((r - k0.tonic) % 12) + 12) % 12;
          const binSt = 12 * Math.log2((k + 0.5) / Math.max(0.5, k - 0.5));        // how many semitones one bin spans here
          on[k] = steps.indexOf(pc) >= 0 && (Math.abs(m - r) < 0.3 || binSt > 0.6) ? 1 : 0;
        }
        return (this.scale[n] = on);
      }
      frame(re, im, nch) {
        const p = this.p, n = this.cur, h = n >> 1, hop = n >> 2, a = p.amount;
        if (a < 0.002) return;
        let G = this.g[n]; if (!G) { G = this.g[n] = new Float64Array(h + 1); G.fill(1); }
        if (!this.mag || this.mag.length < h + 1) { this.mag = new Float64Array(h + 1); this.tmp = new Float64Array(h + 1); }
        const mag = this.mag, tmp = this.tmp;
        let peak = 0, etot = 0;
        for (let k = 0; k <= h; k++) {
          let m2 = 0; for (let c = 0; c < nch; c++) m2 += re[c][k] * re[c][k] + im[c][k] * im[c][k];
          mag[k] = Math.sqrt(m2); etot += m2; if (mag[k] > peak) peak = mag[k];
        }
        if (peak < 1e-9) return;
        tmp.set(mag.subarray(0, h + 1)); const tv = tmp.subarray(0, h + 1); tv.sort();
        const nth = tv[Math.max(0, h + 1 - Math.min(h + 1, Math.round(p.keep)))];
        const thr = peak * Math.pow(10, p.thr / 20), sc = p.snap ? this.scaleBins(n) : null;
        const c0 = p.ar > 0 ? Math.exp(-hop / (p.ar * sampleRate)) : 0;
        let ekeep = 0;
        for (let k = 0; k <= h; k++) {
          let on = mag[k] >= thr && mag[k] >= nth;
          if (sc && !sc[k]) on = false;
          if (p.invert) on = !on;
          const t = on ? 1 : 0;
          G[k] = t + (G[k] - t) * c0;
          ekeep += G[k] * G[k] * mag[k] * mag[k];
        }
        const mk = Math.min(2, Math.sqrt(etot / Math.max(1e-12, ekeep)));
        this.mk = this.mk * 0.6 + mk * 0.4;
        for (let k = 0; k <= h; k++) {
          const g = 1 - a + a * G[k] * this.mk;
          for (let c = 0; c < nch; c++) { re[c][k] *= g; im[c][k] *= g; }
        }
        for (let c = 0; c < nch; c++) KdStft.mirror(re[c], im[c], n);
      }
      process(inputs, outputs, P) {
        if (!this.alive) return false;
        const inp = inputs[0] || [], L = outputs[0][0], R = outputs[0][1] || L, len = L.length;
        const n = Math.round(P.size[0]);
        this.p = { amount: P.amount[0], thr: P.thr[0], keep: P.keep[0], ar: P.ar[0], invert: P.invert[0] > 0.5, snap: P.snap[0] > 0.5 };
        this.cur = n;
        kdStftFor(this, n, (re, im, nch) => this.frame(re, im, nch)).process(inp.length ? [inp[0], inp[1] || inp[0]] : [], [L, R], null, len);
        return true;
      }
    });`;
    K.register({
      id: "bin-crush", num: 12, name: "BIN CRUSH", group: "SPECTRAL & FILTER",
      caption: "Keeps only the loudest frequencies. Robotic, skeletal drums.",
      axes: { x: "THRESHOLD", y: "BIN KEEP COUNT" },
      fmtX: (x) => Math.round(thrDb(x)) + " dB",
      fmtY: (y) => keepOf(y) + " bins",
      dials: [
        { id: "size", name: "FFT SIZE", def: 0.4, fmt: (v) => String(sizeOf(v)) },
        { id: "ar", name: "ATTACK/RELEASE", def: 0.25, fmt: (v) => Math.round(arOf(v) * 1000) + " ms" },
      ],
      toggles: [{ id: "invert", name: "INVERT", def: false }, { id: "snap", name: "TONAL SNAP", def: false }],
      presets: [
        { name: "Skeleton", voice: "snare", x: 0.55, y: 0.75, wet: 0.7, dials: { size: 0.4, ar: 0.2 }, toggles: {} },
        { name: "Robo Hat", voice: "hats", x: 0.6, y: 0.5, wet: 0.7, dials: { size: 0.4, ar: 0.15 }, toggles: { snap: true } },
        { name: "Sine Kick", voice: "kick", x: 0.8, y: 0.98, wet: 0.6, dials: { size: 0.9, ar: 0.3 }, toggles: {} },
        { name: "Negative", voice: "perc", x: 0.7, y: 0.3, wet: 0.7, dials: { size: 0.4, ar: 0.25 }, toggles: { invert: true } },
        { name: "Paper Clap", voice: "clap", x: 0.6, y: 0.62, wet: 0.7, dials: { size: 0.4, ar: 0.3 }, toggles: {} },
      ],
      worklets: { [NAME]: SRC },
      create(ctx, env) {
        if (!K.hasWorklet(ctx, NAME)) return H.passthrough(ctx);
        const key = (K.songKey && K.songKey()) || null;
        const node = H.node(ctx, NAME, { size: 1024 }, { key: key || { tonic: 9, minor: true } }), put = H.setter(ctx);
        const inst = {
          input: node, output: node, latency: 1024 / ctx.sampleRate,
          set(v) {
            const d = v.dials || {}, t = v.toggles || {}, n = sizeOf(d.size != null ? d.size : 0.4);
            node.parameters.get("size").setValueAtTime(n, ctx.currentTime);
            inst.latency = n / ctx.sampleRate;
            put(node.parameters.get("amount"), clamp(v.amount * 1.3));
            put(node.parameters.get("thr"), thrDb(v.x), 0.01);
            put(node.parameters.get("keep"), keepOf(v.y), 0.001);
            put(node.parameters.get("ar"), arOf(d.ar != null ? d.ar : 0.25), 0.001);
            put(node.parameters.get("invert"), t.invert ? 1 : 0, 0.001);
            put(node.parameters.get("snap"), t.snap ? 1 : 0, 0.001);
          },
          destroy() { H.bye(node); },
        };
        return inst;
      },
    });
  })();
})();
