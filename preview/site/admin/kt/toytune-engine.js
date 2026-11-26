// TOYTUNE's sound in KILLTOY 2 web: the engine's C++ (Source/dsp/toytune) compiled to toytune.wasm
// (scripts/build-toytune-wasm.sh), run in an AudioWorklet, so it plays in real time like the plugin.
//
//   const eng = await ToyTuneEngine.load(ctx, "toytune.wasm");
//   const n = eng.create({ values: { "tune.speed": 0.8, ... }, getTransport })
//     n.input / n.output          Web Audio nodes
//     n.set(id, value)            one setting (ids from Source/dsp/toytune/ToyTuneParams.h)
//     n.setNotes([[startSec, endSec, pitch]])   MIDI notes in song seconds (MIDI follow, vocoder carrier, choir)
//     n.setChords([[startSec, endSec, mask]])   PG MATCH chords in song seconds (bit 0 = C)
//     n.live(pitch, on)           a note from the window's keyboard
//     n.ttMeter -> { in, out, target, level, singing, bands[] }   (updated ~40x a second)
//     n.close()
// ASCII only.
(function () {
  "use strict";
  // keep in step with ToyTuneParams.h (index = place in this list)
  const IDS = ["key", "scale", "custom", "midi", "bypass",
    "tune.on", "tune.speed", "tune.human", "tune.flex", "tune.formant", "tune.vibrato", "tune.breath", "tune.noflip", "tune.chordtones",
    "choir.on", "choir.mode", "choir.voices", "choir.width", "choir.loose", "choir.mix",
    "vocoder.on", "vocoder.mode", "vocoder.carrier", "vocoder.bands", "vocoder.tone", "vocoder.glide", "vocoder.mix",
    "fx.gate.on", "fx.eq.on", "fx.comp.on", "fx.drive.on", "fx.double.on", "fx.delay.on", "fx.verb.on",
    "fx.gate.thresh", "fx.eq.low", "fx.eq.body", "fx.eq.presence", "fx.eq.air",
    "fx.comp.amount", "fx.comp.speed", "fx.comp.deess",
    "fx.drive.amount", "fx.drive.tone", "fx.drive.kind", "fx.drive.mix",
    "fx.double.amount", "fx.double.width", "fx.double.tight",
    "fx.delay.mix", "fx.delay.time", "fx.delay.feedback", "fx.delay.tone", "fx.delay.trig",
    "fx.verb.mix", "fx.verb.size", "fx.verb.tone", "fx.verb.trig",
    "fx.mix", "out",
    "prefs.voice", "prefs.mode", "prefs.a4"];
  const INDEX = Object.fromEntries(IDS.map((id, i) => [id, i]));
  // the delay TUNE adds (ToyTune::lowestHzFor + PitchVoices::latencySamples), in seconds
  function latency(sr, voice, mode) {
    const low = (mode ? [110, 70, 55, 40] : [160, 90, 70, 50])[Math.max(0, Math.min(3, voice | 0))];
    const p = Math.ceil(sr / low);
    return (2 * p + 4 + Math.floor(p / 8)) / sr;
  }

  const WORKLET = `
  const stub = () => 0;
  registerProcessor("toytune", class extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const o = options.processorOptions;
      const pool = (globalThis.__ttPool = globalThis.__ttPool || []);
      this.pool = pool;
      this.inst = pool.pop() || null;
      const fresh = !this.inst;
      if (fresh) this.inst = new WebAssembly.Instance(o.module, { wasi_snapshot_preview1: { fd_close: stub, fd_seek: stub, fd_write: stub } });
      const e = this.e = this.inst.exports;
      if (fresh && e._initialize) e._initialize();
      this.h = e.tt_create(sampleRate, 128);
      o.values.forEach((v, i) => { if (v != null) e.tt_set(this.h, i, v); });
      this.t = { bpm: 120, songAt: 0, ctxAt: 0, playing: false };
      this.notes = []; this.chords = []; this.held = new Set(); this.live = new Set(); this.chord = -1;
      this.tick = 0;
      this.port.onmessage = (m) => {
        const d = m.data;
        if (!this.h) return;
        if (d.set) e.tt_set(this.h, d.set[0], d.set[1]);
        if (d.all) d.all.forEach((v, i) => { if (v != null) e.tt_set(this.h, i, v); });
        if (d.transport) { this.t = d.transport; e.tt_tempo(this.h, this.t.bpm || 120); }
        if (d.notes) this.notes = d.notes;
        if (d.chords) this.chords = d.chords;
        if (d.live) { if (d.live[1]) this.live.add(d.live[0]); else this.live.delete(d.live[0]); }
        if (d.close) { e.tt_destroy(this.h); this.h = 0; if (this.pool.length < 16) this.pool.push(this.inst); this.inst = null; }
      };
    }
    views() {
      const buf = this.e.memory.buffer;
      if (this.buf !== buf) {
        this.buf = buf;
        this.l = new Float32Array(buf, this.e.tt_left(this.h), 128);
        this.r = new Float32Array(buf, this.e.tt_right(this.h), 128);
        this.b = new Float32Array(buf, this.e.tt_bands(this.h), 32);
      }
    }
    follow() {
      // which MIDI notes are held right now (song time), plus the window's keyboard
      const t = this.t, now = t.songAt + (currentTime - t.ctxAt);
      const want = new Set(this.live);
      if (t.playing) for (const n of this.notes) if (now >= n[0] && now < n[1]) want.add(n[2]);
      for (const p of this.held) if (!want.has(p)) this.e.tt_note(this.h, p, 0);
      for (const p of want) if (!this.held.has(p)) this.e.tt_note(this.h, p, 1);
      this.held = want;
      let mask = 0;
      if (t.playing) for (const c of this.chords) if (now >= c[0] && now < c[1]) { mask = c[2]; break; }
      if (mask !== this.chord) { this.chord = mask; this.e.tt_chord(this.h, mask); }
    }
    process(inputs, outputs) {
      if (!this.h) return false;
      const x = inputs[0], y = outputs[0], n = y[0].length;
      this.views();
      if (x && x.length) { this.l.set(x[0]); this.r.set(x[1] || x[0]); } else { this.l.fill(0); this.r.fill(0); }
      this.follow();
      this.e.tt_process(this.h, n);
      this.views();
      y[0].set(this.l.subarray(0, n));
      if (y[1]) y[1].set(this.r.subarray(0, n));
      if (++this.tick >= 9) {
        this.tick = 0;
        const e = this.e, h = this.h;
        this.port.postMessage({ m: [e.tt_meter(h, 0), e.tt_meter(h, 1), e.tt_meter(h, 2), e.tt_meter(h, 3), e.tt_meter(h, 4)], b: Array.from(this.b) });
      }
      return true;
    }
  });`;

  async function load(ctx, url) {
    const bytes = await (await fetch(url)).arrayBuffer();
    const module = await WebAssembly.compile(bytes);
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));

    function create(opts = {}) {
      const values = IDS.map((id) => (opts.values && opts.values[id] != null ? +opts.values[id] : null));
      const node = new AudioWorkletNode(ctx, "toytune", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { module, values } });
      const meter = { in: 0, out: 0, target: -1, level: 0, singing: 0, bands: [], at: 0 };
      node.port.onmessage = (m) => {
        const d = m.data;
        if (d.m) { meter.in = d.m[0]; meter.out = d.m[1]; meter.target = d.m[2]; meter.level = d.m[3]; meter.singing = d.m[4]; meter.bands = d.b; meter.at = ctx.currentTime; }
      };
      const sendTransport = () => opts.getTransport && node.port.postMessage({ transport: { ...opts.getTransport(), ctxAt: ctx.currentTime } });
      sendTransport();
      return {
        input: node, output: node, ttMeter: meter, sendTransport,
        set: (id, v) => { const i = INDEX[id]; if (i != null) node.port.postMessage({ set: [i, +v] }); return null; },
        setAll: (vals) => node.port.postMessage({ all: IDS.map((id) => (vals[id] != null ? +vals[id] : null)) }),
        setNotes: (notes) => node.port.postMessage({ notes }),
        setChords: (chords) => node.port.postMessage({ chords }),
        live: (pitch, on) => node.port.postMessage({ live: [pitch, !!on] }),
        close: () => node.port.postMessage({ close: true }),
      };
    }
    return { create };
  }

  window.ToyTuneEngine = { load, IDS, INDEX, latency };
})();
