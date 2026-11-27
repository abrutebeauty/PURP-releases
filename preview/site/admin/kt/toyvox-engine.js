// TOY VOX's sound in KILLTOY 2 web: the engine's C++ (Source/dsp/toyvox) compiled to toyvox.wasm
// (scripts/build-toyvox-wasm.sh), run in an AudioWorklet, so it plays in real time like the plugin.
//
//   const eng = await ToyVoxEngine.load(ctx, "toyvox.wasm");
//   const n = eng.create({ values: { "tune.speed": 0.9, ... }, getTransport })
//     n.input / n.output          Web Audio nodes
//     n.set(id, value)            one setting (ids from Source/dsp/toyvox/ToyVoxParams.h)
//     n.setAll({ id: value })     every setting at once
//     n.tvMeter -> { in, out, level, floor, dirt, comp, hush }   (updated ~40x a second)
//     n.close()
// ASCII only.
(function () {
  "use strict";
  // keep in step with ToyVoxParams.h (index = place in this list)
  const IDS = ["bypass", "mix", "out", "xy.x", "xy.y", "key", "scale",
    "tune.on", "tune.speed", "tune.human",
    "boy.on", "boy.pitch", "boy.formant", "boy.mix",
    "hush.on", "hush.amount",
    "eq.on", "eq.low", "eq.mud", "eq.presence", "eq.air",
    "comp.on", "comp.punch", "comp.level", "comp.deess",
    "heat.on", "heat.amount", "heat.kind", "heat.tone",
    "air.on", "air.mid", "air.high",
    "dirt.on", "dirt.amount", "dirt.kind", "dirt.sense",
    "wide.on", "wide.amount", "wide.rate",
    "echo.on", "echo.mix", "echo.time", "echo.feedback", "echo.tone", "echo.trig",
    "hall.on", "hall.mix", "hall.size", "hall.tone", "hall.lowcut",
    "tune.live", "choir.on", "choir.mode", "choir.voices", "choir.mix"];
  const INDEX = Object.fromEntries(IDS.map((id, i) => [id, i]));
  // the delay TOY VOX adds, in seconds: PitchVoices at 80 Hz (2 cycles + an eighth), or LIVE tune (half of a
  // 12 ms window) when the settings allow it (keep in step with ToyVox::run and ZeroTune::latencySamples)
  function latency(sr, v) {
    v = v || {};
    const on = (id) => +v[id] > 0.5;
    const boyWork = on("boy.on") && (Math.abs(+v["boy.pitch"] || 0) > 0.01 || Math.abs(+v["boy.formant"] || 0) > 0.01);
    if (on("tune.live") && !boyWork && !on("choir.on")) return (Math.floor(Math.max(64, Math.round(sr * 0.012)) / 2) + 2) / sr;
    const p = Math.ceil(sr / 80);
    return (2 * p + 4 + Math.floor(p / 8)) / sr;
  }

  const WORKLET = `
  const stub = () => 0;
  registerProcessor("toyvox", class extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const o = options.processorOptions;
      const pool = (globalThis.__tvPool = globalThis.__tvPool || []);
      this.pool = pool;
      this.inst = pool.pop() || null;
      const fresh = !this.inst;
      if (fresh) this.inst = new WebAssembly.Instance(o.module, { wasi_snapshot_preview1: { fd_close: stub, fd_seek: stub, fd_write: stub } });
      const e = this.e = this.inst.exports;
      if (fresh && e._initialize) e._initialize();
      this.h = e.tv_create(sampleRate, 128);
      o.values.forEach((v, i) => { if (v != null) e.tv_set(this.h, i, v); });
      this.tick = 0;
      this.port.onmessage = (m) => {
        const d = m.data;
        if (!this.h) return;
        if (d.set) e.tv_set(this.h, d.set[0], d.set[1]);
        if (d.all) d.all.forEach((v, i) => { if (v != null) e.tv_set(this.h, i, v); });
        if (d.bpm) e.tv_tempo(this.h, d.bpm);
        if (d.close) { e.tv_destroy(this.h); this.h = 0; if (this.pool.length < 16) this.pool.push(this.inst); this.inst = null; }
      };
    }
    views() {
      const buf = this.e.memory.buffer;
      if (this.buf !== buf) {
        this.buf = buf;
        this.l = new Float32Array(buf, this.e.tv_left(this.h), 128);
        this.r = new Float32Array(buf, this.e.tv_right(this.h), 128);
      }
    }
    process(inputs, outputs) {
      if (!this.h) return false;
      const x = inputs[0], y = outputs[0], n = y[0].length;
      this.views();
      if (x && x.length) { this.l.set(x[0]); this.r.set(x[1] || x[0]); } else { this.l.fill(0); this.r.fill(0); }
      this.e.tv_process(this.h, n);
      this.views();
      y[0].set(this.l.subarray(0, n));
      if (y[1]) y[1].set(this.r.subarray(0, n));
      if (++this.tick >= 9) {
        this.tick = 0;
        const e = this.e, h = this.h;
        this.port.postMessage({ m: [0, 1, 2, 3, 4, 5, 6].map((i) => e.tv_meter(h, i)) });
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
      const node = new AudioWorkletNode(ctx, "toyvox", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { module, values } });
      const meter = { in: 0, out: 0, level: -96, floor: -70, dirt: 0, comp: 1, hush: 1, at: 0 };
      node.port.onmessage = (m) => {
        const d = m.data;
        if (d.m) { [meter.in, meter.out, meter.level, meter.floor, meter.dirt, meter.comp, meter.hush] = d.m; meter.at = ctx.currentTime; }
      };
      const sendTransport = () => { const t = opts.getTransport && opts.getTransport(); if (t && t.bpm) node.port.postMessage({ bpm: t.bpm }); };
      sendTransport();
      return {
        input: node, output: node, tvMeter: meter, sendTransport,
        set: (id, v) => { const i = INDEX[id]; if (i != null) node.port.postMessage({ set: [i, +v] }); return null; },
        setAll: (vals) => node.port.postMessage({ all: IDS.map((id) => (vals[id] != null ? +vals[id] : null)) }),
        close: () => node.port.postMessage({ close: true }),
      };
    }
    return { create };
  }

  window.ToyVoxEngine = { load, IDS, INDEX, latency };
})();
