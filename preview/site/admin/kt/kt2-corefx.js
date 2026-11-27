// KILLTOY 2 CORE FX (Eman, 16 Nov: "see if there is any core FX we dont have now that is MANDATORY to have in a DAW,
// since i want to have all things you need NATIVE"). The everyday effects every DAW ships with, missing from
// ADD AN EFFECT until now: EQ, compressor, filter, chorus / flanger / phaser, drive, de-esser and a utility
// (gain, pan, width, bass mono). KILLTIME, the creative delay, lives in killtime.js and plugs in the same way.
//
// Each effect: build(ctx, p, env) -> { input, output, set(paramId, 0..1) -> shown text, close? }, its knobs
// (PARAMS for app.js), a picture you drag (FxView), and an optional MODE row of small picture buttons under the
// picture (the twin of KILLCHAIN's SHAPES row). playground.js asks install(BUILD, ctx, env) to add them.
// window.KT2_COREFX_OFF = true: none of them in ADD AN EFFECT (the old list). Saved projects still play them.
(function () {
  "use strict";
  const off = () => !!window.KT2_COREFX_OFF;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dBg = (db) => Math.pow(10, db / 20);
  const logMap = (v, lo, hi) => lo * Math.pow(hi / lo, clamp(v, 0, 1));
  const logInv = (x, lo, hi) => clamp(Math.log(x / lo) / Math.log(hi / lo), 0, 1);
  const fHz = (f) => (f >= 1000 ? (f / 1000).toFixed(f >= 9950 ? 0 : 1) + " kHz" : Math.round(f) + " Hz");
  const fDb = (g) => (g >= 0 ? "+" : "") + g.toFixed(1) + " dB";
  const pct = (v) => Math.round(v * 100) + "%";
  const step = (v, n) => Math.round(clamp(v, 0, 1) * (n - 1));
  const prm = (id, name, value, text) => ({ id, name, value, text, def: value });

  // ------------------------------------------------------------------ the audio-thread code
  const WORKLETS = [];
  // Chorus / flanger / phaser in one. mode 0 chorus, 1 flanger, 2 phaser.
  WORKLETS.push(`registerProcessor("kt-mod", class extends AudioWorkletProcessor {
    static get parameterDescriptors() { return [{ name: "mode", defaultValue: 0 }, { name: "rate", defaultValue: 0.6 }, { name: "depth", defaultValue: 0.5 },
      { name: "color", defaultValue: 0.3 }, { name: "mix", defaultValue: 0.5 }]; }
    constructor() { super(); this.N = 8192; this.buf = [new Float32Array(this.N), new Float32Array(this.N)]; this.w = 0; this.ph = 0;
      this.ap = [new Float32Array(6), new Float32Array(6)]; this.fb = [0, 0]; this.dc = [0, 0]; this.sm = [-1, -1]; }
    read(b, d) { const N = this.N, pos = this.w - d, i = Math.floor(pos), f = pos - i; const a = b[(i + N * 4) % N], c = b[(i + 1 + N * 4) % N]; return a + (c - a) * f; }
    process(ins, outs, P) {
      const x = ins[0], y = outs[0]; if (!y || !y.length) return true;
      const n = y[0].length, sr = sampleRate, mode = Math.round(P.mode[0]), rate = P.rate[0], depth = P.depth[0], color = P.color[0], mix = P.mix[0];
      const inc = rate / sr;
      for (let i = 0; i < n; i++) {
        this.ph += inc; if (this.ph >= 1) this.ph -= 1;
        for (let c = 0; c < 2; c++) {
          const xi = x && x.length ? x[Math.min(c, x.length - 1)][i] : 0;
          const lfo = Math.sin(2 * Math.PI * (this.ph + (c ? 0.25 : 0)));
          let wet;
          if (mode === 2) {
            // phaser: 6 first-order all-passes swept between 150 Hz and up to ~4 kHz
            const f = 150 * Math.pow(2, (0.5 + 0.5 * lfo) * (1 + depth * 4.6));
            const t = Math.tan(Math.PI * Math.min(f, sr * 0.45) / sr), a = (t - 1) / (t + 1);
            let v = xi + this.fb[c] * color * 0.85;
            const s = this.ap[c];
            for (let k = 0; k < 6; k++) { const o = a * v + s[k]; s[k] = v - a * o; v = o; }
            this.fb[c] = v; wet = v;
          } else {
            const b = this.buf[c];
            const d = mode === 1 ? (0.0006 + depth * 0.0045 * (0.5 + 0.5 * lfo)) * sr : (0.011 + depth * 0.009 * (0.5 + 0.5 * lfo)) * sr;
            wet = this.read(b, d);
            const fbk = mode === 1 ? color * 0.92 : color * 0.55;
            b[this.w] = xi + wet * fbk;
          }
          y[c][i] = (xi * (mix <= 0.5 ? 1 : 2 * (1 - mix)) + wet * (mix <= 0.5 ? 2 * mix : 1)) * (mode === 0 ? 0.85 : 0.7);
        }
        this.w = (this.w + 1) % this.N;
      }
      return true;
    }
  });`);
  // De-esser: the band above freq is turned down only while it's loud (split band, the rest is untouched).
  WORKLETS.push(`registerProcessor("kt-deess", class extends AudioWorkletProcessor {
    static get parameterDescriptors() { return [{ name: "freq", defaultValue: 6500 }, { name: "thr", defaultValue: -30 }, { name: "range", defaultValue: 12 }]; }
    constructor() { super(); this.z = [[0, 0, 0, 0], [0, 0, 0, 0]]; this.env = 0; this.g = 1; this.minG = 1; this.cnt = 0; this.f = 0; this.k = null; }
    coef(f) { const w = 2 * Math.PI * Math.min(f, sampleRate * 0.45) / sampleRate, cs = Math.cos(w), al = Math.sin(w) / (2 * 0.707), a0 = 1 + al;
      this.k = [(1 + cs) / 2 / a0, -(1 + cs) / a0, (1 + cs) / 2 / a0, -2 * cs / a0, (1 - al) / a0]; this.f = f; }
    process(ins, outs, P) {
      const x = ins[0], y = outs[0]; if (!y || !y.length) return true;
      if (P.freq[0] !== this.f) this.coef(P.freq[0]);
      const [b0, b1, b2, a1, a2] = this.k, n = y[0].length, sr = sampleRate;
      const thr = P.thr[0], range = P.range[0], att = Math.exp(-1 / (0.0008 * sr)), rel = Math.exp(-1 / (0.06 * sr)), gs = Math.exp(-1 / (0.002 * sr));
      for (let i = 0; i < n; i++) {
        const hp = [0, 0];
        let lvl = 0;
        for (let c = 0; c < 2; c++) {
          const xi = x && x.length ? x[Math.min(c, x.length - 1)][i] : 0, z = this.z[c];
          const o = b0 * xi + b1 * z[0] + b2 * z[1] - a1 * z[2] - a2 * z[3];
          z[1] = z[0]; z[0] = xi; z[3] = z[2]; z[2] = o; hp[c] = o; lvl = Math.max(lvl, Math.abs(o));
        }
        this.env = lvl > this.env ? att * this.env + (1 - att) * lvl : rel * this.env + (1 - rel) * lvl;
        const over = 20 * Math.log10(this.env + 1e-9) - thr;
        const want = over > 0 ? Math.pow(10, -Math.min(range, over * 0.75) / 20) : 1;
        this.g = gs * this.g + (1 - gs) * want;
        if (this.g < this.minG) this.minG = this.g;
        for (let c = 0; c < 2; c++) { const xi = x && x.length ? x[Math.min(c, x.length - 1)][i] : 0; y[c][i] = xi - hp[c] + hp[c] * this.g; }
      }
      if ((this.cnt += n) >= 1536) { this.port.postMessage(20 * Math.log10(this.minG)); this.cnt = 0; this.minG = 1; }
      return true;
    }
  });`);

  const loaded = new WeakMap();
  function load(ctx) {
    if (loaded.has(ctx)) return loaded.get(ctx).p;
    const st = { ok: false };
    const code = WORKLETS.concat(window.KillTime && KillTime.WORKLET ? [KillTime.WORKLET] : []).join("\n");
    st.p = ctx.audioWorklet
      ? ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: "application/javascript" }))).then(() => (st.ok = true), (e) => { console.warn("core FX did not load", e); return false; })
      : Promise.resolve(false);
    loaded.set(ctx, st);
    return st.p;
  }
  // An AudioWorklet effect that plays straight through until its code has loaded, then slots itself in.
  function lazyNode(ctx, name, opts, onNode) {
    const input = ctx.createGain(), output = ctx.createGain(), pend = {};
    let node = null, closed = false;
    input.connect(output);
    const attach = () => {
      if (closed || node) return;
      try { node = new AudioWorkletNode(ctx, name, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], ...opts }); } catch (e) { return; }
      for (const [k, v] of Object.entries(pend)) { const a = node.parameters.get(k); if (a) a.value = v; }
      input.disconnect(); input.connect(node); node.connect(output);
      if (onNode) onNode(node);
    };
    const st = loaded.get(ctx);
    if (st && st.ok) attach(); else load(ctx).then((ok) => ok && attach());
    return {
      input, output,
      param(k, v, tc = 0.015) { pend[k] = v; if (node) { const a = node.parameters.get(k); if (a) a.setTargetAtTime(v, ctx.currentTime, tc); } },
      get node() { return node; },
      close() { closed = true; if (node) { node.port.onmessage = null; try { node.disconnect(); } catch (e) { /* gone */ } } },
    };
  }
  // Live numbers for a card's picture (gain reduction...), at most ~20 a second.
  function liveTo(p, data) {
    if (!window.FxView || !p || !p.id) return;
    const old = FxView.live.get(p.id);
    FxView.live.set(p.id, data);
    if (!old || JSON.stringify(old) !== JSON.stringify(data)) FxView.redraw(p.id);
  }
  const passIn = (ctx) => { const g = ctx.createGain(); g.channelCount = 2; g.channelCountMode = "explicit"; g.channelInterpretation = "speakers"; return g; };

  // ------------------------------------------------------------------ the effects
  const FX = {};

  // EQ: low cut, low shelf, a bell, high shelf, high cut. Every point is a dot on the curve.
  const EQR = { lowcut: [20, 1000], highcut: [1000, 20000], lowf: [40, 500], midf: [150, 8000], highf: [2000, 16000], q: [0.3, 5] };
  FX.kteq = {
    name: "Toy EQ", pick: "EQ", toy: "ToyEQ", cat: "TONE", color: "#b79cff", knobs: 4, what: "shape the tone, cut the mud",
    search: "eq equalizer equaliser parametric low cut high cut shelf bell pro-q tone",
    params: () => [prm("low", "Low", 0.5, "+0.0 dB"), prm("mid", "Mid", 0.5, "+0.0 dB"), prm("high", "High", 0.5, "+0.0 dB"), prm("lowcut", "Low cut", 0, "off"),
      prm("highcut", "High cut", 1, "off"), prm("lowf", "Low freq", logInv(120, 40, 500), "120 Hz"), prm("midf", "Mid freq", logInv(1000, 150, 8000), "1.0 kHz"),
      prm("highf", "High freq", logInv(8000, 2000, 16000), "8.0 kHz"), prm("q", "Mid width", logInv(1, 0.3, 5), "1.0")],
    build(ctx) {
      const mk = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
      const hp1 = mk("highpass", 5, 0.54), hp2 = mk("highpass", 5, 1.31), ls = mk("lowshelf", 120), pk = mk("peaking", 1000, 1), hs = mk("highshelf", 8000), lp1 = mk("lowpass", 22000, 0.54), lp2 = mk("lowpass", 22000, 1.31);
      [hp1, hp2, ls, pk, hs, lp1, lp2].reduce((a, b) => (a.connect(b), b));
      const T = (a, v) => a.setTargetAtTime(v, ctx.currentTime, 0.012);
      const set = (pid, v) => {
        const g = (v - 0.5) * 30;
        if (pid === "low") { T(ls.gain, g); return fDb(g); }
        if (pid === "mid") { T(pk.gain, g); return fDb(g); }
        if (pid === "high") { T(hs.gain, g); return fDb(g); }
        if (pid === "lowcut") { const f = v < 0.01 ? 5 : logMap(v, ...EQR.lowcut); T(hp1.frequency, f); T(hp2.frequency, f); return v < 0.01 ? "off" : fHz(f); }
        if (pid === "highcut") { const f = v > 0.99 ? 22000 : logMap(v, ...EQR.highcut); T(lp1.frequency, Math.min(f, ctx.sampleRate * 0.45)); T(lp2.frequency, Math.min(f, ctx.sampleRate * 0.45)); return v > 0.99 ? "off" : fHz(f); }
        if (pid === "lowf") { const f = logMap(v, ...EQR.lowf); T(ls.frequency, f); return fHz(f); }
        if (pid === "midf") { const f = logMap(v, ...EQR.midf); T(pk.frequency, f); return fHz(f); }
        if (pid === "highf") { const f = logMap(v, ...EQR.highf); T(hs.frequency, f); return fHz(f); }
        if (pid === "q") { const q = logMap(v, ...EQR.q); T(pk.Q, q); return q.toFixed(1); }
      };
      return { input: hp1, output: lp2, set };
    },
  };

  // Compressor: threshold, ratio, attack, release; it makes up the level it takes away (Gain trims on top).
  FX.ktcomp = {
    name: "Toy Comp", pick: "Comp", toy: "ToyComp", cat: "DYNAMICS", color: "#3dd6f5", knobs: 4, what: "even out the level",
    search: "compressor compression glue vocal comp 1176 la-2a dynamics",
    params: () => [prm("threshold", "Threshold", 0.6, "-24.0 dB"), prm("ratio", "Ratio", 0.25, "4.0 : 1"), prm("attack", "Attack", 0.5, "5.0 ms"),
      prm("release", "Release", 0.45, "120 ms"), prm("gain", "Gain", 0.5, "+0.0 dB")],
    build(ctx, p) {
      const c = ctx.createDynamicsCompressor(), out = ctx.createGain();
      c.knee.value = 6; c.connect(out);
      let thr = -24, ratio = 4, trim = 0;
      const make = () => out.gain.setTargetAtTime(dBg(trim + Math.min(10, -thr * (1 - 1 / ratio) * 0.22)), ctx.currentTime, 0.02);
      const set = (pid, v) => {
        if (pid === "threshold") { thr = -60 + v * 60; c.threshold.value = thr; make(); return fDb(thr); }
        if (pid === "ratio") { ratio = 1 + v * v * 19; c.ratio.value = ratio; make(); return ratio.toFixed(1) + " : 1"; }
        if (pid === "attack") { const s = logMap(v, 0.0001, 0.25); c.attack.value = s; return s < 0.001 ? (s * 1000).toFixed(2) + " ms" : (s * 1000).toFixed(1) + " ms"; }
        if (pid === "release") { const s = logMap(v, 0.02, 1.5); c.release.value = s; return Math.round(s * 1000) + " ms"; }
        if (pid === "gain") { trim = (v - 0.5) * 24; make(); return fDb(trim); }
      };
      const tick = setInterval(() => liveTo(p, { gr: c.reduction }), 50);
      return { input: c, output: out, set, close: () => clearInterval(tick) };
    },
  };

  // Filter: low-pass / high-pass / band / notch with a resonant peak, and an LFO that moves it in time with the song.
  const RATES = [[16, "4 bars"], [8, "2 bars"], [4, "1 bar"], [2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"]];
  const FMODES = ["lowpass", "highpass", "bandpass", "notch"];
  FX.ktfilter = {
    name: "Toy Filter", pick: "Filter", toy: "ToyFilter", cat: "TONE", color: "#b79cff", knobs: 4, what: "sweep, wobble, open it up",
    search: "filter lowpass low pass highpass high pass band notch resonance cutoff sweep auto filter wobble lfo",
    modes: [{ name: "LOW PASS" }, { name: "HIGH PASS" }, { name: "BAND" }, { name: "NOTCH" }], modeId: "mode",
    params: () => [prm("cutoff", "Cutoff", 0.7, fHz(logMap(0.7, 20, 20000))), prm("reso", "Reso", 0.3, "30%"), prm("lfo", "LFO", 0, "off"), prm("rate", "Rate", 4 / 6, "1/4"), prm("mode", "Mode", 0, "LOW PASS")],
    build(ctx, p, env) {
      const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), out = ctx.createGain();
      f1.connect(f2); f2.connect(out);
      f2.Q.value = 0.707;
      const osc = ctx.createOscillator(), amt = ctx.createGain();
      osc.connect(amt); amt.connect(f1.detune); amt.connect(f2.detune); amt.gain.value = 0; osc.start();
      let mode = 0, reso = 0.3, beats = 1, bpm = 0;
      const typeSet = () => { f1.type = f2.type = FMODES[mode]; qSet(); };
      const qSet = () => { const q = 0.5 + Math.pow(reso, 1.6) * 14; f1.Q.value = mode >= 2 ? Math.max(0.5, q * 0.6) : q; out.gain.value = mode < 2 ? 1 / Math.sqrt(1 + reso * 2) : 1; };
      const rate = () => { const b = (env && env().bpm) || 120; if (b !== bpm) bpm = b; osc.frequency.setTargetAtTime(bpm / 60 / beats, ctx.currentTime, 0.05); };
      const tick = setInterval(rate, 500);
      typeSet();
      const set = (pid, v) => {
        if (pid === "cutoff") { const f = logMap(v, 20, 20000); f1.frequency.setTargetAtTime(Math.min(f, ctx.sampleRate * 0.45), ctx.currentTime, 0.01); f2.frequency.setTargetAtTime(Math.min(f, ctx.sampleRate * 0.45), ctx.currentTime, 0.01); return fHz(f); }
        if (pid === "reso") { reso = v; qSet(); return pct(v); }
        if (pid === "lfo") { amt.gain.setTargetAtTime(v * 3600, ctx.currentTime, 0.02); return v < 0.01 ? "off" : "\u00b1" + (v * 3).toFixed(1) + " oct"; }
        if (pid === "rate") { const r = RATES[step(v, RATES.length)]; beats = r[0]; rate(); return r[1]; }
        if (pid === "mode") { mode = step(v, 4); typeSet(); return FX.ktfilter.modes[mode].name; }
      };
      return { input: f1, output: out, set, close: () => { clearInterval(tick); try { osc.stop(); } catch (e) { /* stopped */ } } };
    },
  };

  // Mod: chorus, flanger or phaser (one card, three modes).
  FX.ktmod = {
    name: "Toy Mod", pick: "Mod", toy: "ToyMod", cat: "SPACE", color: "#ff4fb8", knobs: 4, what: "chorus, flanger, phaser",
    search: "chorus flanger flange phaser phase modulation mod juno wide vibrato",
    modes: [{ name: "CHORUS" }, { name: "FLANGER" }, { name: "PHASER" }], modeId: "mode",
    params: () => [prm("rate", "Rate", 0.35, "0.5 Hz"), prm("depth", "Depth", 0.5, "50%"), prm("color", "Color", 0.3, "30%"), prm("mix", "Mix", 0.5, "50%"), prm("mode", "Mode", 0, "CHORUS")],
    build(ctx) {
      const L = lazyNode(ctx, "kt-mod", {});
      const set = (pid, v) => {
        if (pid === "rate") { const hz = logMap(v, 0.05, 10); L.param("rate", hz); return hz < 1 ? hz.toFixed(2) + " Hz" : hz.toFixed(1) + " Hz"; }
        if (pid === "depth") { L.param("depth", v); return pct(v); }
        if (pid === "color") { L.param("color", v); return pct(v); }
        if (pid === "mix") { L.param("mix", v); return pct(v); }
        if (pid === "mode") { const m = step(v, 3); L.param("mode", m, 0.0001); return FX.ktmod.modes[m].name; }
      };
      return { input: L.input, output: L.output, set, close: L.close };
    },
  };

  // Drive: tape (smooth), tube (warm, uneven) or fuzz (hard). It keeps the level about where it was.
  const curveOf = (mode, k) => {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, u = k * x;
      c[i] = mode === 0 ? Math.tanh(u)
        : mode === 1 ? (Math.tanh(u + 0.3) - 0.2913) * 1.15   // a bias = uneven (warm) harmonics; the DC is filtered out after
        : Math.max(-1, Math.min(1, Math.tanh(u * 3) * 1.08));
    }
    return c;
  };
  FX.ktdrive = {
    name: "Toy Drive", pick: "Drive", toy: "ToyDrive", cat: "DIRT", color: "#ff7a45", knobs: 4, what: "tape, tube or fuzz",
    search: "drive distortion saturation saturator overdrive tape tube fuzz decapitator dirt warm",
    modes: [{ name: "TAPE" }, { name: "TUBE" }, { name: "FUZZ" }], modeId: "mode",
    params: () => [prm("drive", "Drive", 0.35, "+13 dB"), prm("tone", "Tone", 0.7, "70%"), prm("mix", "Mix", 1, "100%"), prm("out", "Out", 0.5, "+0.0 dB"), prm("mode", "Mode", 0, "TAPE")],
    build(ctx) {
      const input = passIn(ctx), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
      const ws = ctx.createWaveShaper(), tone = ctx.createBiquadFilter(), dc = ctx.createBiquadFilter(), comp = ctx.createGain();
      ws.oversample = "4x"; tone.type = "lowpass"; tone.Q.value = 0.5; dc.type = "highpass"; dc.frequency.value = 12;
      input.connect(ws); ws.connect(dc); dc.connect(tone); tone.connect(comp); comp.connect(wet); wet.connect(output);
      input.connect(dry); dry.connect(output);
      let mode = 0, drive = 0.35, mix = 1, outDb = 0, curveT = 0;
      const k = () => dBg(drive * 36);
      const curve = () => { ws.curve = curveOf(mode, k()); comp.gain.setTargetAtTime(1 / Math.pow(k(), mode === 2 ? 0.75 : 0.62), ctx.currentTime, 0.02); };
      const later = () => { if (!curveT) curveT = setTimeout(() => { curveT = 0; curve(); }, 30); };
      const levels = () => { wet.gain.value = mix; dry.gain.value = 1 - mix; output.gain.setTargetAtTime(dBg(outDb), ctx.currentTime, 0.02); };
      curve(); levels();
      const set = (pid, v) => {
        if (pid === "drive") { drive = v; later(); return "+" + Math.round(v * 36) + " dB"; }
        if (pid === "tone") { tone.frequency.setTargetAtTime(logMap(v, 1200, 22000), ctx.currentTime, 0.02); return pct(v); }
        if (pid === "mix") { mix = v; levels(); return pct(v); }
        if (pid === "out") { outDb = (v - 0.5) * 24; levels(); return fDb(outDb); }
        if (pid === "mode") { mode = step(v, 3); curve(); return FX.ktdrive.modes[mode].name; }
      };
      return { input, output, set, close: () => clearTimeout(curveT) };
    },
  };

  // De-esser: only the hiss band ducks, only while it's loud.
  FX.ktdeess = {
    name: "Toy DeEss", pick: "De-Ess", toy: "ToyDeEss", cat: "DYNAMICS", color: "#3dd6f5", knobs: 3, what: "tames the S sounds",
    search: "de-esser deesser de esser sibilance ess s sounds vocal harsh",
    params: () => [prm("freq", "Freq", logInv(6500, 3000, 12000), "6.5 kHz"), prm("amount", "Amount", 0.5, "50%"), prm("range", "Range", 0.5, "-12 dB")],
    build(ctx, p) {
      const L = lazyNode(ctx, "kt-deess", {}, (node) => (node.port.onmessage = (e) => liveTo(p, { gr: Math.round(e.data * 10) / 10 })));
      const set = (pid, v) => {
        if (pid === "freq") { const f = logMap(v, 3000, 12000); L.param("freq", f, 0.0001); return fHz(f); }
        if (pid === "amount") { L.param("thr", -12 - v * 38); return pct(v); }
        if (pid === "range") { L.param("range", v * 24); return "-" + Math.round(v * 24) + " dB"; }
      };
      return { input: L.input, output: L.output, set, close: L.close };
    },
  };

  // Utility: gain, pan, stereo width (0 = mono, 200% = extra wide) and bass mono (lows in the middle).
  FX.ktutil = {
    name: "Toy Utility", pick: "Utility", toy: "ToyUtility", cat: "TONE", color: "#8b5cf6", knobs: 4, what: "gain, pan, width, bass mono",
    search: "utility gain volume trim pan panning width stereo mono imager bass mono phase",
    params: () => [prm("gain", "Gain", 0.75, "+0.0 dB"), prm("pan", "Pan", 0.5, "C"), prm("width", "Width", 0.5, "100%"), prm("bassmono", "Mono", 0, "off")],
    build(ctx) {
      const input = passIn(ctx), sp = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2);
      const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
      const lm = g(0.5), rm = g(0.5), ls = g(0.5), rs = g(-0.5), mid = g(1), side = g(1), w = g(1), inv = g(-1);
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5; hp.Q.value = 0.707;
      const pan = ctx.createStereoPanner(), out = g(1);
      input.connect(sp);
      sp.connect(lm, 0); sp.connect(rm, 1); lm.connect(mid); rm.connect(mid);
      sp.connect(ls, 0); sp.connect(rs, 1); ls.connect(side); rs.connect(side);
      side.connect(hp); hp.connect(w); w.connect(inv);
      mid.connect(mg, 0, 0); mid.connect(mg, 0, 1); w.connect(mg, 0, 0); inv.connect(mg, 0, 1);
      mg.connect(pan); pan.connect(out);
      const set = (pid, v) => {
        if (pid === "gain") { const d = v * 48 - 36; out.gain.setTargetAtTime(v < 0.005 ? 0 : dBg(d), ctx.currentTime, 0.015); return v < 0.005 ? "-inf" : fDb(d); }
        if (pid === "pan") { const x = (v - 0.5) * 2; pan.pan.setTargetAtTime(x, ctx.currentTime, 0.015); return Math.abs(x) < 0.01 ? "C" : Math.round(Math.abs(x) * 100) + (x < 0 ? " L" : " R"); }
        if (pid === "width") { w.gain.setTargetAtTime(v * 2, ctx.currentTime, 0.015); return v < 0.005 ? "mono" : Math.round(v * 200) + "%"; }
        if (pid === "bassmono") { const f = v < 0.01 ? 5 : logMap(v, 40, 400); hp.frequency.setTargetAtTime(f, ctx.currentTime, 0.02); return v < 0.01 ? "off" : fHz(f); }
      };
      return { input, output: out, set };
    },
  };

  // ------------------------------------------------------------------ hooks for app.js / playground.js / the picker
  const all = () => { const o = { ...FX }; if (window.KillTime && KillTime.FX) Object.assign(o, KillTime.FX); return o; };
  function install(BUILD, ctx, env) {
    load(ctx);
    for (const [type, fx] of Object.entries(all())) BUILD[type] = (p) => fx.build(ctx, p, env, { lazyNode, liveTo, passIn });
  }
  const params = () => Object.fromEntries(Object.entries(all()).map(([t, fx]) => [t, fx.params]));
  const of = (p) => { const t = String((p && (p.type || p.key)) || "").replace(/^builtin:/, ""); return all()[t] || null; };
  const knobs = (p) => { const fx = of(p); return fx ? fx.knobs || 3 : 0; };
  const color = (p) => { const fx = of(p); return fx ? fx.color : null; };
  const pickerItems = () => (off() ? [] : Object.entries(all()).filter(([, fx]) => !fx.hidden || !fx.hidden()).map(([t, fx]) => ({ key: "builtin:" + t, name: fx.pick || fx.name, cat: fx.cat, img: "pick/fx-" + t + ".jpg", what: fx.what, core: true })));
  const pluginList = () => Object.entries(all()).map(([t, fx]) => ({ key: "builtin:" + t, name: fx.name, group: "KILLTOY" }));
  const types = () => Object.fromEntries(Object.entries(all()).map(([t, fx]) => [fx.name, t]));
  const toyNames = () => Object.fromEntries(Object.entries(all()).map(([t, fx]) => [t, fx.toy || fx.name]));
  const search = () => Object.fromEntries(Object.entries(all()).map(([, fx]) => [fx.name, fx.search || ""]));

  // MODE row under the picture: small picture buttons, the twin of KILLCHAIN's SHAPES (same size, look and ON state).
  const ICONS = {
    "LOW PASS": "M1,6 H24 C32,6 34,3 37,4 C39,5 41,16 43,17",
    "HIGH PASS": "M1,17 C3,16 5,5 7,4 C10,3 12,6 20,6 H43",
    BAND: "M1,17 C10,16 16,4 22,4 C28,4 34,16 43,17",
    NOTCH: "M1,6 H14 C18,6 20,17 22,17 C24,17 26,6 30,6 H43",
    CHORUS: "M1,11 C6,4 10,4 15,11 C20,18 24,18 29,11 C34,4 38,4 43,11 M1,13 C6,6 10,6 15,13 C20,20 24,20 29,13 C34,6 38,6 43,13",
    FLANGER: "M1,11 C4,3 6,3 8,11 C10,19 12,19 14,11 C17,3 19,3 22,11 C26,19 30,19 34,11 C37,5 40,5 43,11",
    PHASER: "M1,11 C5,4 9,4 12,11 S20,18 23,11 M23,11 C27,4 31,4 34,11 S40,18 43,11 M12,4 V18 M34,4 V18",
    TAPE: "M1,17 C10,17 14,15 22,11 C30,7 34,5 43,5",
    TUBE: "M1,15 C8,15 14,14 22,11 C28,8 32,4 43,4",
    FUZZ: "M1,17 H14 L30,5 H43",
    DIGITAL: "M1,17 V5 H7 V17 M12,17 V8 H18 V17 M23,17 V11 H29 V17 M34,17 V14 H40 V17",
    REVERSE: "M1,17 V15 H5 V17 M11,17 V12 H15 V17 M21,17 V9 H25 V17 M31,17 V5 H35 V17 M38,11 L43,11 M40,8 L43,11 L40,14",
    FREEZE: "M22,3 V19 M15,7 L29,15 M29,7 L15,15 M19,3 L22,6 L25,3 M19,19 L22,16 L25,19",
  };
  function modeRow(clip, p) {
    const fx = of(p);
    if (!fx || !fx.modes) return null;
    const q = p.params.find((x) => x.id === (fx.modeId || "mode"));
    if (!q) return null;
    const n = fx.modes.length, cur = step(Number(q.value), n);
    const row = document.createElement("div");
    row.className = "kfx-modes";
    row.dataset.fx = p.type;
    fx.modes.forEach((m, i) => {
      const b = document.createElement("button");
      b.className = "kfx-mode" + (i === cur ? " on" : "");
      b.title = m.name;
      b.dataset.mode = m.name;
      b.innerHTML = `<svg viewBox="0 0 44 22" aria-hidden="true"><path class="l" d="${m.icon || ICONS[m.name] || "M1,11 H43"}"/></svg>`;
      b.onclick = (e) => {
        e.stopPropagation();
        row.querySelectorAll(".kfx-mode").forEach((x) => x.classList.toggle("on", x === b));
        run("setParam", { pluginId: p.id, paramId: q.id, value: n > 1 ? i / (n - 1) : 0 });
      };
      row.append(b);
    });
    // on / off switches after the modes (KILLTIME's FREEZE), same button, acid when on
    for (const t of fx.toggles || []) {
      const tq = p.params.find((x) => x.id === t.id);
      if (!tq) continue;
      const b = document.createElement("button");
      b.className = "kfx-mode kfx-toggle" + (Number(tq.value) > 0.5 ? " on" : "");
      b.title = t.name; b.dataset.mode = t.name;
      b.innerHTML = `<svg viewBox="0 0 44 22" aria-hidden="true"><path class="l" d="${t.icon || ICONS[t.name] || "M1,11 H43"}"/></svg>`;
      b.onclick = (e) => { e.stopPropagation(); const on = !b.classList.contains("on"); b.classList.toggle("on", on); run("setParam", { pluginId: p.id, paramId: t.id, value: on ? 1 : 0 }); };
      row.append(b);
    }
    return row;
  }
  const css = document.createElement("style");
  css.textContent = `
  .card .kfx-modes { display: flex; gap: 6px; margin: 6px 0 2px; }
  .card .kfx-mode { flex: 1 1 0; min-width: 0; height: 24px; padding: 2px 3px; border: 0; background: rgba(255,255,255,.05); cursor: pointer; display: block; }
  .card .kfx-mode svg { width: 100%; height: 100%; display: block; }
  .card .kfx-mode .l { fill: none; stroke: var(--dc, #8b6cf6); stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .card .kfx-mode:hover { background: rgba(255,255,255,.1); }
  .card .kfx-mode.on { background: rgba(228,255,58,.1); box-shadow: inset 0 0 0 1px rgba(228,255,58,.6); }
  .card .kfx-mode.on .l { stroke: #e4ff3a; }`;
  (document.head || document.documentElement).append(css);

  // ------------------------------------------------------------------ the pictures (FxView)
  // A frequency-response helper: real filter curves from the browser's own biquads, so the picture is the sound.
  let rctx = null;
  const respCache = { n: 0 };
  function response(spec, freqs) {
    try { rctx = rctx || new OfflineAudioContext(1, 128, 48000); } catch (e) { return null; }
    const mag = new Float32Array(freqs.length).fill(1), m = new Float32Array(freqs.length), ph = new Float32Array(freqs.length);
    for (const s of spec) {
      const b = rctx.createBiquadFilter();
      b.type = s.type; b.frequency.value = Math.min(s.f, 23900); if (s.q != null) b.Q.value = s.q; if (s.g != null) b.gain.value = s.g;
      b.getFrequencyResponse(freqs, m, ph);
      for (let i = 0; i < freqs.length; i++) mag[i] *= m[i];
    }
    respCache.n++;
    return mag;
  }
  const xOfHz = (d, f) => d.X(Math.log(f / 20) / Math.log(1000));
  const hzOfX = (d, x) => 20 * Math.pow(1000, d.U(x));
  const freqGrid = (d) => {
    d.grid([100, 1000, 10000].map((f) => xOfHz(d, f)), []);
    [["100", 100], ["1k", 1000], ["10k", 10000]].forEach(([t, f]) => d.label(t, xOfHz(d, f) + 3, d.y0 + 12, "left"));
  };
  const curveOfSpec = (d, spec, dbRange, mid) => {
    const xs = [], fs = [];
    for (let x = d.x0; x <= d.x1; x += 2) { xs.push(x); fs.push(hzOfX(d, x)); }
    const mag = response(spec, Float32Array.from(fs));
    if (!mag) return [];
    const amp = (d.y0 - d.y1) / 2 - 4;
    return xs.map((x, i) => [x, clamp(mid - (20 * Math.log10(Math.max(1e-6, mag[i])) / dbRange) * amp, d.y1 - 2, d.y0)]);
  };
  function registerViews() {
    if (!window.FxView || registerViews.done) return;
    registerViews.done = true;
    const R = FxView.register;

    R("kteq", {
      match: /^kteq\b/i,
      spec(d) {
        const lc = d.v("lowcut", 0), hc = d.v("highcut", 1), g = (id) => (d.v(id, 0.5) - 0.5) * 30;
        const lcf = lc < 0.01 ? 5 : logMap(lc, ...EQR.lowcut), hcf = hc > 0.99 ? 24000 : logMap(hc, ...EQR.highcut);
        return { lcf, hcf, lf: logMap(d.v("lowf"), ...EQR.lowf), mf: logMap(d.v("midf"), ...EQR.midf), hf: logMap(d.v("highf"), ...EQR.highf), q: logMap(d.v("q"), ...EQR.q), lg: g("low"), mg: g("mid"), hg: g("high") };
      },
      list(s) {
        return [{ type: "highpass", f: s.lcf, q: 0.54 }, { type: "highpass", f: s.lcf, q: 1.31 }, { type: "lowshelf", f: s.lf, g: s.lg }, { type: "peaking", f: s.mf, q: s.q, g: s.mg },
          { type: "highshelf", f: s.hf, g: s.hg }, { type: "lowpass", f: s.hcf, q: 0.54 }, { type: "lowpass", f: s.hcf, q: 1.31 }];
      },
      draw(d) {
        const mid = (d.y0 + d.y1) / 2;
        freqGrid(d);
        d.grid([], [mid]);
        const pts = curveOfSpec(d, this.list(this.spec(d)), 18, mid);
        d.fill(pts, mid, 0.2);
        d.line(pts, d.col, 2);
      },
      handles(d) {
        const s = this.spec(d), mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2 - 4, yOf = (g) => mid - (g / 18) * amp, gOf = (y) => 0.5 + ((mid - y) / amp) * 18 / 30;
        const lcx = s.lcf < 19 ? d.x0 : xOfHz(d, s.lcf), hcx = s.hcf > 20500 ? d.x1 : xOfHz(d, s.hcf);
        return [
          { x: lcx, y: mid, label: () => "low cut " + d.t("lowcut"), drag: (px) => { const u = px <= d.x0 + 2 ? 0 : logInv(hzOfX(d, px), ...EQR.lowcut); return { lowcut: u < 0.02 ? 0 : u }; } },
          { x: xOfHz(d, s.lf), y: yOf(s.lg), label: () => "low " + d.t("low") + " \u00b7 " + d.t("lowf"), drag: (px, py) => ({ lowf: logInv(hzOfX(d, px), ...EQR.lowf), low: gOf(py) }) },
          { x: xOfHz(d, s.mf), y: yOf(s.mg), label: () => "mid " + d.t("mid") + " \u00b7 " + d.t("midf"), drag: (px, py) => ({ midf: logInv(hzOfX(d, px), ...EQR.midf), mid: gOf(py) }) },
          { x: xOfHz(d, s.hf), y: yOf(s.hg), label: () => "high " + d.t("high") + " \u00b7 " + d.t("highf"), drag: (px, py) => ({ highf: logInv(hzOfX(d, px), ...EQR.highf), high: gOf(py) }) },
          { x: hcx, y: mid, label: () => "high cut " + d.t("highcut"), drag: (px) => { const u = px >= d.x1 - 2 ? 1 : logInv(hzOfX(d, px), ...EQR.highcut); return { highcut: u > 0.98 ? 1 : u }; } },
        ];
      },
    });

    R("ktcomp", {
      match: /^ktcomp\b/i,
      draw(d) {
        const thr = d.v("threshold", 0.6), ratio = 1 + Math.pow(d.v("ratio", 0.25), 2) * 19, mx = d.x1 - 16;
        const X = (u) => d.x0 + u * (mx - d.x0);
        d.grid([0.25, 0.5, 0.75].map(X), [0.25, 0.5, 0.75].map(d.Y));
        d.g.setLineDash([3, 4]); d.line([[d.x0, d.y0], [mx, d.y1]], d.ink3, 1); d.g.setLineDash([]);
        const pts = [];
        for (let i = 0; i <= 60; i++) { const u = i / 60, k = 0.05; let o = u;
          if (u > thr + k) o = thr + (u - thr) / ratio; else if (u > thr - k) { const z = u - thr + k; o = u + (1 / ratio - 1) * z * z / (4 * k); }
          pts.push([X(u), d.Y(o)]); }
        d.fill(pts, d.y0, 0.16);
        d.line(pts, d.col, 2);
        // gain reduction right now: a bar on the right, hanging from the top
        const gr = Math.min(24, Math.max(0, -((d.live && d.live.gr) || 0)));
        d.g.fillStyle = d.rgba(0.12); d.g.fillRect(d.x1 - 8, d.y1, 8, d.y0 - d.y1);
        d.g.fillStyle = d.col; d.g.fillRect(d.x1 - 8, d.y1, 8, (gr / 24) * (d.y0 - d.y1));
        d.label("in \u2192", mx, d.y0 + 12, "right");
        d.label("out", d.x0, d.y1 + 2);
        if (gr > 0.05) d.label("-" + gr.toFixed(1), d.x1 - 11, d.y1 + 10, "right", d.ink, 10);
      },
      handles(d) {
        const thr = d.v("threshold", 0.6), ratio = 1 + Math.pow(d.v("ratio", 0.25), 2) * 19, mx = d.x1 - 16;
        const X = (u) => d.x0 + u * (mx - d.x0), U = (x) => clamp((x - d.x0) / (mx - d.x0), 0, 1);
        return [
          { x: X(thr), y: d.Y(thr), label: () => "threshold " + d.t("threshold"), drag: (px) => ({ threshold: U(px) }) },
          { x: mx, y: d.Y(thr + (1 - thr) / ratio), label: () => "ratio " + d.t("ratio"),
            drag: (px, py) => { const k = (d.V(py) - thr) / Math.max(0.02, 1 - thr), r = 1 / Math.max(0.05, k); return { ratio: Math.sqrt(clamp((r - 1) / 19, 0, 1)) }; } },
        ];
      },
    });

    R("ktfilter", {
      match: /^ktfilter\b/i,
      list(d) {
        const f = logMap(d.v("cutoff", 0.7), 20, 20000), reso = d.v("reso", 0.3), mode = step(d.v("mode", 0), 4), q = 0.5 + Math.pow(reso, 1.6) * 14;
        return [{ type: FMODES[mode], f, q: mode >= 2 ? Math.max(0.5, q * 0.6) : q }, { type: FMODES[mode], f, q: 0.707 }];
      },
      draw(d) {
        const mid = d.y1 + (d.y0 - d.y1) * 0.35;
        freqGrid(d);
        const f = logMap(d.v("cutoff", 0.7), 20, 20000), lfo = d.v("lfo", 0);
        if (lfo > 0.01) { const a = xOfHz(d, Math.max(20, f / Math.pow(2, lfo * 3))), b = xOfHz(d, Math.min(20000, f * Math.pow(2, lfo * 3))); d.g.fillStyle = d.rgba(0.1); d.g.fillRect(a, d.y1 - 4, b - a, d.y0 - d.y1 + 4); }
        const pts = curveOfSpec(d, this.list(d), 30, mid);
        d.fill(pts, d.y0, 0.2);
        d.line(pts, d.col, 2);
      },
      handles(d) {
        const f = logMap(d.v("cutoff", 0.7), 20, 20000), reso = d.v("reso", 0.3), lfo = d.v("lfo", 0);
        const hs = [{ x: xOfHz(d, f), y: d.Y(0.45 + reso * 0.5), label: () => d.t("cutoff") + " \u00b7 reso " + d.t("reso"),
          drag: (px, py) => ({ cutoff: logInv(hzOfX(d, px), 20, 20000), reso: clamp((d.V(py) - 0.45) / 0.5, 0, 1) }) }];
        hs.push({ x: Math.min(d.x1, xOfHz(d, Math.min(20000, f * Math.pow(2, Math.max(0.08, lfo) * 3)))), y: d.Y(0.08), label: () => "LFO " + d.t("lfo"),
          drag: (px) => { const oct = Math.log2(Math.max(1, hzOfX(d, px) / f)) / 3; return { lfo: oct < 0.1 ? 0 : clamp(oct, 0, 1) }; } });
        return hs;
      },
    });

    R("ktmod", {
      match: /^ktmod\b/i,
      draw(d) {
        const rate = logMap(d.v("rate", 0.35), 0.05, 10), depth = d.v("depth", 0.5), color = d.v("color", 0.3), mode = step(d.v("mode", 0), 3), mid = (d.y0 + d.y1) / 2;
        d.grid([0.25, 0.5, 0.75].map(d.X), [mid]);
        const cyc = clamp(rate * 2, 1, 8), amp = ((d.y0 - d.y1) / 2 - 6) * (0.15 + depth * 0.85);
        const wave = (off, a) => { const pts = []; for (let x = d.x0; x <= d.x1; x += 2) { const u = d.U(x); pts.push([x, mid - Math.sin(2 * Math.PI * (u * cyc + off)) * a]); } return pts; };
        const n = mode === 0 ? 3 : mode === 1 ? 1 : 2;
        for (let k = n; k >= 1; k--) d.line(wave(k * 0.08, amp * (1 - k * 0.12)), d.rgba(0.25 + color * 0.3), 1.2);
        const main = wave(0, amp);
        d.fill(main, mid, 0.14);
        d.line(main, d.col, 2);
      },
      handles(d) {
        const rate = d.v("rate", 0.35), depth = d.v("depth", 0.5), mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2 - 6;
        return [
          { x: d.X(0.15 + rate * 0.8), y: mid - amp * (0.15 + depth * 0.85), label: () => d.t("rate") + " \u00b7 depth " + d.t("depth"),
            drag: (px, py) => ({ rate: clamp((d.U(px) - 0.15) / 0.8, 0, 1), depth: clamp(((mid - py) / amp - 0.15) / 0.85, 0, 1) }) },
          { x: d.X(0.06), y: d.Y(0.1 + d.v("color", 0.3) * 0.8), label: () => "color " + d.t("color"), drag: (px, py) => ({ color: clamp((d.V(py) - 0.1) / 0.8, 0, 1) }) },
        ];
      },
    });

    R("ktdrive", {
      match: /^ktdrive\b/i,
      draw(d) {
        const mode = step(d.v("mode", 0), 3), k = dBg(d.v("drive", 0.35) * 36), c = curveOf(mode, k), mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2 - 4;
        d.grid([d.X(0.5)], [mid]);
        // a sine going through it, before (faint) and after
        const sin = [], shaped = [];
        for (let x = d.x0; x <= d.x1; x += 2) { const u = d.U(x), s = Math.sin(u * Math.PI * 4) * 0.8; sin.push([x, mid - s * amp * 0.5]); shaped.push([x, mid - c[Math.round(((s + 1) / 2) * (c.length - 1))] * amp * 0.5]); }
        d.line(sin, d.rgba(0.25), 1);
        const pts = [];
        for (let x = d.x0; x <= d.x1; x += 2) { const u = d.U(x); pts.push([x, mid - c[Math.round(u * (c.length - 1))] * amp]); }
        d.line(shaped, d.rgba(0.55), 1.2);
        d.line(pts, d.col, 2);
      },
      handles(d) {
        const drive = d.v("drive", 0.35), mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2 - 4;
        const x = d.X(0.5 + 0.06 + (1 - drive) * 0.38), c = curveOf(step(d.v("mode", 0), 3), dBg(drive * 36));
        return [{ x, y: mid - c[Math.round(d.U(x) * (c.length - 1))] * amp, label: () => "drive " + d.t("drive"), drag: (px) => ({ drive: clamp(1 - (d.U(px) - 0.56) / 0.38, 0, 1) }) }];
      },
    });

    R("ktdeess", {
      match: /^ktdeess\b/i,
      draw(d) {
        const f = logMap(d.v("freq", 0.5), 3000, 12000), range = d.v("range", 0.5) * 24, gr = Math.max(-range, (d.live && d.live.gr) || 0), top = d.y1 + 14;
        freqGrid(d);
        const yOf = (db) => top + (-db / 24) * (d.y0 - top - 6);
        const curve = (db) => { const pts = []; for (let x = d.x0; x <= d.x1; x += 2) { const hz = hzOfX(d, x), k = 1 / (1 + Math.pow(f / hz, 4)); pts.push([x, yOf(db * k)]); } return pts; };
        d.g.setLineDash([3, 4]); d.line(curve(-range), d.ink3, 1); d.g.setLineDash([]);
        const now = curve(gr);
        d.fill(now, d.y0, 0.16);
        d.line(now, d.col, 2);
        if (gr < -0.1) d.label(gr.toFixed(1) + " dB", d.x1, top - 4, "right", d.ink, 10);
      },
      handles(d) {
        const f = logMap(d.v("freq", 0.5), 3000, 12000), am = d.v("amount", 0.5), top = d.y1 + 14;
        return [{ x: xOfHz(d, f), y: top + (1 - am) * (d.y0 - top - 10), label: () => d.t("freq") + " \u00b7 amount " + d.t("amount"),
          drag: (px, py) => ({ freq: logInv(clamp(hzOfX(d, px), 3000, 12000), 3000, 12000), amount: clamp(1 - (py - top) / (d.y0 - top - 10), 0, 1) }) }];
      },
    });

    R("ktutil", {
      match: /^ktutil\b/i,
      draw(d) {
        const pan = (d.v("pan", 0.5) - 0.5) * 2, width = d.v("width", 0.5) * 2, gain = d.v("gain", 0.75), cx = (d.x0 + d.x1 - 20) / 2, base = d.y0, R0 = Math.min((d.x1 - 20 - d.x0) / 2, d.y0 - d.y1) - 2;
        // the stereo picture: a half circle (left .. right), the sound as a fan; narrow = mono, wide = past the speakers
        d.g.strokeStyle = d.rgba(0.2); d.g.lineWidth = 1; d.g.beginPath(); d.g.arc(cx, base, R0, Math.PI, 0); d.g.stroke();
        d.g.beginPath(); d.g.moveTo(cx, base); d.g.lineTo(cx, base - R0); d.g.stroke();
        const ang = -Math.PI / 2 + pan * Math.PI / 4, spread = Math.min(Math.PI * 0.49, (Math.PI / 4) * width) + 0.02, r = R0 * (0.3 + gain * 0.7);
        d.g.beginPath(); d.g.moveTo(cx, base); d.g.arc(cx, base, r, ang - spread, ang + spread); d.g.closePath();
        d.g.fillStyle = d.rgba(0.22); d.g.fill(); d.g.strokeStyle = d.col; d.g.lineWidth = 2; d.g.stroke();
        d.label("L", d.x0, base - 2); d.label("R", d.x1 - 26, base - 2, "right");
        // level bar
        d.g.fillStyle = d.rgba(0.12); d.g.fillRect(d.x1 - 8, d.y1, 8, d.y0 - d.y1);
        d.g.fillStyle = d.col; const hgt = gain * (d.y0 - d.y1); d.g.fillRect(d.x1 - 8, d.y0 - hgt, 8, hgt);
      },
      handles(d) {
        const pan = (d.v("pan", 0.5) - 0.5) * 2, width = d.v("width", 0.5) * 2, gain = d.v("gain", 0.75), cx = (d.x0 + d.x1 - 20) / 2, base = d.y0, R0 = Math.min((d.x1 - 20 - d.x0) / 2, d.y0 - d.y1) - 2;
        const ang = -Math.PI / 2 + pan * Math.PI / 4, spread = Math.min(Math.PI * 0.49, (Math.PI / 4) * width) + 0.02, r = R0 * (0.3 + gain * 0.7);
        return [
          { x: cx + Math.cos(ang) * r * 0.75, y: base + Math.sin(ang) * r * 0.75, label: () => "pan " + d.t("pan"), drag: (px) => { const x = clamp((px - cx) / (R0 * 0.7), -1, 1); return { pan: Math.abs(x) < 0.04 ? 0.5 : 0.5 + x / 2 }; } },
          { x: cx + Math.cos(ang + spread) * r, y: base + Math.sin(ang + spread) * r, label: () => "width " + d.t("width"),
            drag: (px, py) => { const a = Math.atan2(py - base, px - cx) - ang; const w = clamp(a / (Math.PI / 4), 0, 2); return { width: Math.abs(w - 1) < 0.04 ? 0.5 : w / 2 }; } },
          { x: d.x1 - 4, y: d.y0 - gain * (d.y0 - d.y1), label: () => "gain " + d.t("gain"), drag: (px, py) => { const v = d.V(py); return { gain: Math.abs(v - 0.75) < 0.012 ? 0.75 : v }; } },
        ];
      },
    });
    if (window.KillTime && KillTime.views) KillTime.views(R, { xOfHz, hzOfX, freqGrid, curveOfSpec, logMap, logInv, clamp, step });
  }
  registerViews();
  addEventListener("DOMContentLoaded", registerViews);

  window.KT2CoreFx = { FX, all, load, install, params, knobs, color, of, modeRow, pickerItems, pluginList, types, toyNames, search, off, lazyNode, liveTo, response, curveOf };
})();
