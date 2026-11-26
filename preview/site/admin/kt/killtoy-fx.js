// KILLTOY's own effects (Pump, Chop Pitch, Space, Crush, Loud, SC Clip, TUNR, Texture) in the browser.
// The DSP is the app's own C++ (Source/dsp/fx), compiled to killtoy-fx.wasm by
// scripts/build-fx-wasm.sh, and run here in an AudioWorklet. So what you hear in the
// playground is what the app plays.
//
//   const fx = await KillToyFx.load(ctx, "killtoy-fx.wasm");
//   const node = fx.create("ktspace", { getTransport })  // -> { input, output, set(paramId, 0..1) -> text, meter() }
//   TUNR's node.pitch holds { in, out }: the sung note and the corrected one (MIDI numbers, 0 = no pitch).
(function () {
  // Same knobs, ranges and order as the C++ (Source/dsp/fx/*.h). Keep them in step.
  const TYPES = {
    ktpump: { kind: 0, name: "Pump", params: [
      { id: "depth", name: "Depth", min: 0, max: 100, def: 70, unit: "%" },
      { id: "rate", name: "Rate", min: 0, max: 4, def: 2, unit: "", choices: ["1/1", "1/2", "1/4", "1/8", "1/16"] },
      { id: "release", name: "Release", min: 5, max: 100, def: 55, unit: "%" }] },
    ktchoppitch: { kind: 1, name: "Chop Pitch", params: [
      { id: "pitch", name: "Pitch", min: -12, max: 12, def: 0, unit: "st" },
      { id: "formant", name: "Formant", min: -12, max: 12, def: 0, unit: "st" },
      { id: "mix", name: "Mix", min: 0, max: 100, def: 100, unit: "%" }] },
    ktspace: { kind: 2, name: "Space", params: [
      { id: "size", name: "Size", min: 0, max: 100, def: 60, unit: "%" },
      { id: "decay", name: "Decay", min: 0.3, max: 15, def: 2.8, unit: "s", centre: 3 },
      { id: "mix", name: "Mix", min: 0, max: 100, def: 30, unit: "%" }] },
    ktcrush: { kind: 3, name: "Crush", params: [
      { id: "bits", name: "Bits", min: 2, max: 16, def: 8, unit: "bits" },
      { id: "rate", name: "Rate", min: 500, max: 44100, def: 11000, unit: "Hz", centre: 6000 },
      { id: "mix", name: "Mix", min: 0, max: 100, def: 100, unit: "%" }] },
    ktloud: { kind: 4, name: "Loud", params: [
      { id: "push", name: "Push", min: 0, max: 24, def: 6, unit: "dB" },
      { id: "ceiling", name: "Ceiling", min: -12, max: 0, def: -1, unit: "dB" },
      { id: "clip", name: "Clip", min: 0, max: 100, def: 40, unit: "%" }] },
    ktscclip: { kind: 5, name: "SC Clip", meter: true, params: [
      { id: "drive", name: "Drive", min: 0, max: 24, def: 4, unit: "dB" },
      { id: "shape", name: "Shape", min: 0, max: 100, def: 40, unit: "%" },
      { id: "ceiling", name: "Ceiling", min: -24, max: 0, def: -1, unit: "dB" }] },
    // latency: the delay the C++ reports (SnapTune::latencySamples), in seconds.
    ktsnaptune: { kind: 6, name: "TUNR", pitch: true, latency: (sr) => { const p = Math.ceil(sr / 75); return (2 * p + 4 + Math.floor(p / 8)) / sr; }, params: [
      { id: "speed", name: "Speed", min: 0, max: 100, def: 50, unit: "%", top: "Robot" },
      { id: "humanize", name: "Humanize", min: 0, max: 100, def: 25, unit: "%" },
      { id: "formant", name: "Formant", min: -6, max: 6, def: 0, unit: "st" },
      { id: "key", name: "Key", min: 0, max: 11, def: 9, unit: "", choices: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] },
      { id: "scale", name: "Scale", min: 0, max: 2, def: 0, unit: "", choices: ["Major", "Minor", "Chromatic"] }] },
    // Texture: granular. Size and Density scale the mode (50% = the mode as made). synced: it gets the song position.
    kttexture: { kind: 7, name: "Texture", synced: true, params: [
      { id: "size", name: "Size", min: 0, max: 100, def: 50, unit: "%" },
      { id: "density", name: "Density", min: 0, max: 100, def: 50, unit: "%" },
      { id: "mix", name: "Mix", min: 0, max: 100, def: 50, unit: "%" },
      { id: "mode", name: "Mode", min: 0, max: 7, def: 0, unit: "", choices: ["Shimmer", "Stutter", "Cloud", "Reverse Bloom", "Glitch Spray", "Octave Down Rumble", "Freeze Pad", "Crushed Grains"] }] },
  };

  // Knob position (0..1) <-> value, the way juce::NormalisableRange does it.
  const skewOf = (p) => (p.centre ? Math.log(0.5) / Math.log((p.centre - p.min) / (p.max - p.min)) : 1);
  function fromKnob(p, v) {
    v = Math.max(0, Math.min(1, v));
    const s = skewOf(p);
    if (s !== 1 && v > 0) v = Math.exp(Math.log(v) / s);
    let x = p.min + (p.max - p.min) * v;
    if (p.choices) x = Math.round(x);
    return x;
  }
  function toKnob(p, x) {
    let v = (x - p.min) / (p.max - p.min);
    const s = skewOf(p);
    if (s !== 1 && v > 0) v = Math.pow(v, s);
    return Math.max(0, Math.min(1, v));
  }
  function text(p, x) {
    if (p.top && x >= p.max - 0.5) return p.top;
    if (p.choices) return p.choices[Math.max(0, Math.min(p.choices.length - 1, Math.round(x)))];
    const sign = x > 0.05 ? "+" : "";
    switch (p.unit) {
      case "%": return Math.round(x) + "%";
      case "dB": return sign + x.toFixed(1) + " dB";
      case "st": return sign + x.toFixed(1) + " st";
      case "s": return x.toFixed(x < 10 ? 1 : 0) + " s";
      case "bits": return x.toFixed(1) + " bits";
      case "Hz": return x >= 1000 ? (x / 1000).toFixed(1) + " kHz" : Math.round(x) + " Hz";
      default: return x.toFixed(2);
    }
  }

  // The worklet: one wasm instance per effect, 128 samples at a time.
  const WORKLET = `
  const stub = () => 0;
  registerProcessor("killtoy-fx", class extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const o = options.processorOptions;
      // Spare instances (stress test 11 Nov): every edit while the song plays rebuilds every effect, and each new
      // processor used to make its own WebAssembly instance. The audio thread frees old ones only now and then, so
      // after ~150 edits new instances could not get memory and effects (and the lanes through them) went silent.
      // A closed effect now hands its instance back and the next effect reuses it. o.pool false = old (KT2_FX_POOL_OFF).
      const pool = o.pool ? (globalThis.__ktfxPool = globalThis.__ktfxPool || []) : null;
      this.pool = pool;
      this.inst = (pool && pool.pop()) || null;
      const fresh = !this.inst;
      if (fresh) this.inst = new WebAssembly.Instance(o.module, { wasi_snapshot_preview1: { fd_close: stub, fd_seek: stub, fd_write: stub } });
      const e = this.e = this.inst.exports;
      if (fresh && e._initialize) e._initialize();
      this.h = e.fx_create(o.kind, sampleRate, 128);
      this.pump = o.synced;   // Pump and Texture follow the song position
      this.metered = o.meter && !!e.fx_meter;   // SC Clip: send the dB shaved off ~30 times a second
      this.most = 0; this.blocks = 0;
      this.pitch = !!o.pitch;   // TUNR: send the sung and corrected notes
      this.tick = 0;
      this.t = { bpm: 120, songAt: 0, ctxAt: 0, playing: false };
      o.values.forEach((v, i) => e.fx_set(this.h, i, v));
      this.port.onmessage = (m) => {
        const d = m.data;
        if (d.set && this.h) e.fx_set(this.h, d.set[0], d.set[1]);
        if (d.transport) this.t = d.transport;
        if (d.keyed !== undefined && this.h) { this.keyed = d.keyed; e.fx_use_key(this.h, d.keyed ? 1 : 0); }
        if (d.close && this.h) { e.fx_destroy(this.h); this.h = 0; if (this.pool && this.pool.length < 64) this.pool.push(this.inst); this.inst = null; }
      };
    }
    views() {
      const buf = this.e.memory.buffer;
      if (this.buf !== buf) {
        this.buf = buf;
        this.l = new Float32Array(buf, this.e.fx_left(this.h), 128);
        this.r = new Float32Array(buf, this.e.fx_right(this.h), 128);
        this.k = this.e.fx_key ? new Float32Array(buf, this.e.fx_key(this.h), 128) : null;
      }
    }
    process(inputs, outputs) {
      if (!this.h) return false;
      const x = inputs[0], y = outputs[0];
      const n = y[0].length;
      this.views();
      if (x && x.length) {
        this.l.set(x[0]);
        this.r.set(x[1] || x[0]);
      } else {
        this.l.fill(0); this.r.fill(0);
      }
      // Pump's sidechain: the picked lane arrives on the second input, summed to mono.
      if (this.keyed && this.k) {
        const kx = inputs[1];
        if (kx && kx.length) {
          const a = kx[0], b = kx[1] || kx[0];
          for (let i = 0; i < n; i++) this.k[i] = (a[i] + b[i]) * 0.5;
        } else this.k.fill(0);
      }
      if (this.pump) {
        const t = this.t;
        const beat = (t.songAt + (currentTime - t.ctxAt)) * t.bpm / 60;
        this.e.fx_transport(this.h, t.bpm, beat, t.playing ? 1 : 0);
      }
      this.e.fx_process(this.h, n);
      if (this.metered) {
        this.most = Math.max(this.most, this.e.fx_meter(this.h));
        if (++this.blocks >= 12) { this.port.postMessage({ meter: this.most }); this.most = 0; this.blocks = 0; }
      }
      if (this.pitch && ++this.tick >= 8) {   // about 40 times a second
        this.tick = 0;
        this.port.postMessage({ pitch: [this.e.fx_pitch(this.h, 0), this.e.fx_pitch(this.h, 1)] });
      }
      this.views();   // memory may have grown
      y[0].set(this.l.subarray(0, n));
      if (y[1]) y[1].set(this.r.subarray(0, n));
      return true;
    }
  });`;

  async function load(ctx, url) {
    const bytes = await (await fetch(url)).arrayBuffer();
    const module = await WebAssembly.compile(bytes);
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));

    function create(type, opts = {}) {
      const T = TYPES[type];
      const values = T.params.map((p) => p.def);
      const node = new AudioWorkletNode(ctx, "killtoy-fx", {
        numberOfInputs: T.kind === 0 ? 2 : 1, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { module, pool: !window.KT2_FX_POOL_OFF, kind: T.kind, values, meter: !!T.meter, pitch: !!T.pitch, synced: T.kind === 0 || !!T.synced },
      });
      // The most dB shaved off since the last look (SC Clip's card picture).
      let most = 0;
      const pitch = T.pitch ? { in: 0, out: 0, at: 0 } : null;
      node.port.onmessage = (m) => {
        if (m.data.meter !== undefined) most = Math.max(most, m.data.meter);
        if (m.data.pitch) { pitch.in = m.data.pitch[0]; pitch.out = m.data.pitch[1]; pitch.at = ctx.currentTime; }
      };
      const meter = T.meter ? () => { const v = most; most = 0; return v; } : null;
      const sendTransport = () => opts.getTransport && node.port.postMessage({ transport: { ...opts.getTransport(), ctxAt: ctx.currentTime } });
      sendTransport();
      const set = (pid, v) => {
        const i = T.params.findIndex((p) => p.id === pid);
        if (i < 0) return null;
        const x = fromKnob(T.params[i], v);
        node.port.postMessage({ set: [i, x] });
        return text(T.params[i], x);
      };
      // Pump only: key(sourceNode) ducks to that sound's hits; key(null) goes back to the tempo.
      let keySrc = null;
      const key = T.kind === 0 ? (src) => {
        if (keySrc) { try { keySrc.disconnect(node, 0, 1); } catch (e) { /* already gone */ } }
        keySrc = src;
        if (src) src.connect(node, 0, 1);
        node.port.postMessage({ keyed: !!src });
      } : null;
      return { input: node, output: node, set, sendTransport, meter, pitch, key, close: () => node.port.postMessage({ close: true }) };
    }

    return { create, types: Object.keys(TYPES) };
  }

  // The device-card knobs for a freshly added effect: id, name, knob position, text.
  function defaultParams(type) {
    const T = TYPES[type];
    return T ? T.params.map((p) => ({ id: p.id, name: p.name, value: toKnob(p, p.def), text: text(p, p.def) })) : [];
  }

  window.KillToyFx = { load, TYPES, defaultParams, fromKnob, toKnob, text };
})();
