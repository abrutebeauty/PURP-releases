// TOY MACHINE in the browser: KILLTOY's synth engine (Source/dsp/toymachine, the same C++ the
// app runs) compiled to toy-machine.wasm by scripts/build-toymachine-wasm.sh and played here in
// an AudioWorklet. Offline renders (scripts/toymachine.py) null against it.
//
//   const TM = await ToyMachine.load(ctx, "toy-machine.wasm");
//   const synth = TM.create({ preset, getTransport });   // getTransport() -> { bpm, songAt, ctxAt, playing }
//   synth.output.connect(ctx.destination);
//   synth.noteOn(60, 100, ctx.currentTime + 0.1); synth.noteOff(60, ctx.currentTime + 0.5);
//   synth.setPreset(p); synth.setMacro(0, 0.7); synth.setPad(2, 0.4, 0.8); synth.flush();
//   synth.setDropSample(slot, { data, sampleRate });   // drop zone sounds (Source/dsp/toymachine/TmDrops.h)
//   const y = await TM.render(preset, notes, { bpm, seconds })   // main-thread offline render -> [Float32Array L, R]
(function () {
  const WORKLET = `
  const stub = () => 0;
  const IMPORTS = { wasi_snapshot_preview1: { fd_close: stub, fd_seek: stub, fd_write: stub, proc_exit: stub, environ_get: stub, environ_sizes_get: stub } };
  registerProcessor("toy-machine", class extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const o = options.processorOptions;
      this.guardOff = !!o.guardOff;
      this.inst = new WebAssembly.Instance(o.module, IMPORTS);
      const e = this.e = this.inst.exports;
      if (e._initialize) e._initialize();
      this.h = e.tm_create(sampleRate, 128);
      this.queue = [];           // { frame, fn: [name, ...args] }, sorted by frame
      this.t = { bpm: 120, songAt: 0, ctxAt: 0, playing: false };
      this.peak = 0; this.blocks = 0;
      this.dice = []; this.diceTick = 0;   // dice: macros / points wandering around their own spot
      if (o.preset) this.str("tm_set_preset", o.preset);
      if (o.first) this.message(o.first);   // messages sent before the worklet started (offline renders)
      if (o.firstList) for (const m of o.firstList) this.message(m);   // more of them (WAVE PEEK: its sample + drop sounds)
      this.port.onmessage = (m) => this.message(m.data);
    }
    str(fn, b) {   // b: UTF-8 bytes (there's no TextEncoder in a worklet)
      const e = this.e, p = e.tm_alloc(b.length + 1);
      const mem = new Uint8Array(e.memory.buffer, p, b.length + 1);
      mem.set(b); mem[b.length] = 0;
      const r = e[fn](this.h, p);
      e.tm_free(p);
      return r;
    }
    message(d) {
      const e = this.e;
      if (!this.h) return;
      // SOUND GUARD: a macro or point set to NaN (a knob or the dice gone wrong) is ignored instead of breaking the synth
      const ok = (v) => v - v === 0;
      if (!this.guardOff) { if (d.macro && !ok(d.macro[1])) d.macro = null; if (d.pad && !(ok(d.pad[1]) && ok(d.pad[2]))) d.pad = null; }
      if (d.preset !== undefined) this.str("tm_set_preset", d.preset);
      if (d.dice) { // a new list: put the old ones back on their spot first
        for (const x of this.dice) this.diceSet(x, null);
        this.dice = d.dice;
        this.diceHome = false;
      }
      if (d.macro) { e.tm_set_macro(this.h, d.macro[0], d.macro[1]); for (const x of this.dice) if (x.t === "m" && x.i === d.macro[0]) x.bx = x.cx = d.macro[1]; }
      if (d.pad) { e.tm_set_pad(this.h, d.pad[0], d.pad[1], d.pad[2]); for (const x of this.dice) if (x.t === "p" && x.i === d.pad[0]) { x.bx = x.cx = d.pad[1]; x.by = x.cy = d.pad[2]; } }
      if (d.padStar && e.tm_set_pad_star) e.tm_set_pad_star(this.h, d.padStar[0], d.padStar[1], d.padStar[2]);   // [point, spike (-1 = inside), depth]
      if (d.transport) this.t = d.transport;
      if (d.sample) {
        const s = d.sample.data, p = e.tm_alloc(s.length * 4);
        new Float32Array(e.memory.buffer, p, s.length).set(s);
        e.tm_set_sample(this.h, p, s.length, d.sample.sampleRate);
        e.tm_free(p);
      }
      if (d.drop) {   // a drop zone sound: { slot, data, sampleRate }
        const s = d.drop.data, p = e.tm_alloc(s.length * 4);
        new Float32Array(e.memory.buffer, p, s.length).set(s);
        e.tm_set_drop_sample(this.h, d.drop.slot, p, s.length, d.drop.sampleRate);
        e.tm_free(p);
      }
      if (d.events) {
        for (const ev of d.events) this.queue.push(ev);
        this.queue.sort((a, b) => a.frame - b.frame || a.order - b.order);
      }
      if (d.requeue) this.queue = [];   // drop what's scheduled, keep what sounds (a note added while playing)
      if (d.flush) { this.queue = []; e.tm_all_notes_off(this.h); if (d.flush === "hard") e.tm_reset(this.h); }
      if (d.close) { e.tm_destroy(this.h); this.h = 0; }
    }
    // The dice: smooth random wander, one new spot per step (step = x.rate beats, so it moves
    // with the song's pace) and a little drift so it never feels locked to the grid.
    diceNoise(beat, x, salt) {
      const ph = beat / x.rate + 0.15 * Math.sin(beat / x.rate * 0.37 + x.seed), k = Math.floor(ph), f = ph - k;
      const h = (n) => { const v = Math.sin(n * 12.9898 + x.seed * 78.233 + salt * 37.719) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
      const s = f * f * (3 - 2 * f);
      return h(k) + (h(k + 1) - h(k)) * s;
    }
    diceSet(x, beat) {   // beat null = back on its own spot
      const e = this.e, c = (v) => (v < 0 ? 0 : v > 1 ? 1 : v > 0 ? v : this.guardOff ? v : 0), off = (salt) => (beat == null ? 0 : x.amt * 0.5 * this.diceNoise(beat, x, salt));
      if (x.t === "s") { x.cx = off(0) * 2 * [1.5, 3, 1][x.i]; if (!this.guardOff && !(x.cx - x.cx === 0)) x.cx = 0; if (e.tm_set_nudge) e.tm_set_nudge(this.h, x.i, x.cx); return; }   // release ±1.5 oct, cutoff ±3 oct, pan ±1 at 100%
      x.cx = c(x.bx + off(0));
      if (x.t === "m") { e.tm_set_macro(this.h, x.i, x.cx); return; }
      let py = c(x.by + off(1));
      // the dice never switches a rhythm on or off: an Arp stays on its side of "off" (x 0.1),
      // a Gate on its side of depth 0, so an idle point can't start a du-du-du pattern
      if (x.kind === "arp") x.cx = x.bx < 0.1 ? x.bx : Math.max(0.1, x.cx);
      if (x.kind === "gate") py = x.by <= 0.001 ? x.by : Math.max(0.002, py);
      e.tm_set_pad(this.h, x.i, x.cx, x.cy = py);
    }
    run(ev) {
      const e = this.e, a = ev.args;
      if (!this.guardOff && a && a.some((v) => typeof v === "number" && !(v - v === 0))) return;   // SOUND GUARD: no NaN into the engine
      switch (ev.type) {
        case "on": e.tm_note_on(this.h, a[0], a[1]); break;
        case "off": e.tm_note_off(this.h, a[0]); break;
        case "slide": // [from, to, seconds]; an engine without slides plays it as a new note
          if (a[4] && a[4] !== 1 && e.tm_note_slide_curve) e.tm_note_slide_curve(this.h, a[0], a[1], a[2], a[4]);
          else if (e.tm_note_slide) e.tm_note_slide(this.h, a[0], a[1], a[2]);
          else { e.tm_note_off(this.h, a[0]); e.tm_note_on(this.h, a[1], a[3] || 100); }
          break;
        case "bend": e.tm_pitch_bend(this.h, a[0]); break;
        case "nbend": if (e.tm_note_bend) e.tm_note_bend(this.h, a[0], a[1], a[2], a[3] || 1); break;   // Advanced MIDI pitch line: [note, semis, seconds, curve]
        case "wob": if (e.tm_note_wobble) e.tm_note_wobble(this.h, a[0], a[1], a[2], a[3], a[4] || 0); break;   // Advanced MIDI wobble: [note, depth, hz, fadeSec, shape]
        case "wobl": if (e.tm_note_wobble_level) e.tm_note_wobble_level(this.h, a[0], a[1], a[2]); break;   // its intensity curve: [note, level 0..1, seconds]
        case "wheel": e.tm_mod_wheel(this.h, a[0]); break;
        case "macro": e.tm_set_macro(this.h, a[0], a[1]); break;
        case "pad": e.tm_set_pad(this.h, a[0], a[1], a[2]); break;
      }
    }
    // SOUND GUARD (Eman, 22 Nov: "TOY MACHINE randomly stopped giving sound", in every project, even a new one).
    // One NaN out of a synth latches the master's safety limiter at NaN, and from then on the whole page is silent
    // until a reload; a crash inside the engine leaves a dead synth that the lane pool kept reusing. The guard zeroes
    // a broken block and resets the engine (posted as { nan }), and a crash is posted as { dead } so the lane makes a
    // new engine. processorOptions.guardOff (window.KT2_TM_GUARD_OFF) = old.
    process(inputs, outputs) {
      if (!this.h) return false;
      if (this.guardOff) return this.process0(inputs, outputs);
      try { return this.process0(inputs, outputs); }
      catch (err) {
        try { this.port.postMessage({ dead: String(err && err.message || err) }); } catch (e2) { /* port gone */ }
        this.h = 0;
        for (const ch of outputs[0]) ch.fill(0);
        return false;
      }
    }
    process0(inputs, outputs) {
      const y = outputs[0], n = y[0].length, e = this.e, t = this.t;
      let beat = (t.songAt + (currentTime - t.ctxAt)) * t.bpm / 60, bpm = t.bpm;
      if (!this.guardOff && !(beat - beat === 0 && bpm > 0)) { bpm = bpm > 0 ? bpm : 120; beat = 0; }   // SOUND GUARD: a missing tempo or song time never reaches the engine as NaN
      e.tm_set_transport(this.h, bpm, beat, t.playing ? 1 : 0);
      // the dice only roll while something plays (the song, or keys held); stopped and silent, every
      // dice sits on its own spot, the one you set, and rolls around THAT spot next time (Eman, 31 Oct)
      if (this.dice.length && ++this.diceTick >= 8) {
        this.diceTick = 0;
        const live = t.playing || e.tm_active_voices(this.h) > 0;
        if (live) { for (const x of this.dice) this.diceSet(x, beat); this.diceHome = false; }
        else if (!this.diceHome) { for (const x of this.dice) this.diceSet(x, null); this.diceHome = true; }
      }
      let done = 0;
      while (done < n) {
        const now = currentFrame + done;
        while (this.queue.length && this.queue[0].frame <= now) this.run(this.queue.shift());
        const next = this.queue.length ? this.queue[0].frame : Infinity;
        const m = Math.max(1, Math.min(n - done, next - now));
        e.tm_process(this.h, m);
        const buf = e.memory.buffer;
        y[0].set(new Float32Array(buf, e.tm_left(this.h), m), done);
        if (y[1]) y[1].set(new Float32Array(buf, e.tm_right(this.h), m), done);
        done += m;
      }
      if (!this.guardOff) {
        let bad = false;
        for (const ch of y) for (let i = 0; i < n; i++) { const v = ch[i]; if (!(v - v === 0)) { bad = true; break; } }   // NaN or Infinity
        if (bad) { for (const ch of y) ch.fill(0); e.tm_reset(this.h); this.nans = (this.nans || 0) + 1; this.port.postMessage({ nan: this.nans }); }
      }
      this.peak = Math.max(this.peak, e.tm_peak(this.h));
      if (!(this.peak - this.peak === 0)) this.peak = 0;
      if (++this.blocks >= 12) { this.port.postMessage({ peak: this.peak, voices: e.tm_active_voices(this.h), arp: e.tm_arp_step ? e.tm_arp_step(this.h) : -1, dice: this.dice.length ? this.dice.map((x) => [x.t, x.i, x.cx, x.cy]) : null }); this.peak = 0; this.blocks = 0; }
      return true;
    }
  });`;

  // FL Studio-style slide notes. A note marked slide that starts while another note still sounds
  // doesn't start a voice: it glides that note's voice to its own pitch over the overlap (more
  // overlap = slower slide), and the voice then lasts to whichever of the two ends later. When a
  // chord slides into a chord, each note takes the nearest-pitched note of the chord before.
  // notes: [{ pitch, velocity, on, off, slide }] (any time unit) -> the same with from/secs set
  // on slides and noOff on the notes they took over.
  // Chords (Eman, 4 Nov 19:50): slide notes starting together (within CHORD_TOL) are one chord, and
  // the notes they come from are paired by order: top to top, middle to middle, bottom to bottom,
  // never crossing. Notes of the same chord never slide into each other. A note told which pitch it
  // comes from (slideFrom, picked by hand) keeps that.
  const CHORD_TOL = 0.08;
  function pairChord(G, S) {
    const out = new Map(), used = new Set();
    for (const s of G) if (s.slideFrom != null) { const q = S.find((x) => !used.has(x) && x.pitch === s.slideFrom); if (q) { out.set(s, q); used.add(q); } }
    // picks that cross each other (top note from a lower one than the next) came from the old
    // pairing: drop them and pair by order
    // (picks made by hand, slideHand, stay even when they cross: the MIDI tab's tags and Tab)
    const ex = [...out].sort((a, b) => a[0].pitch - b[0].pitch), hand = ex.length && ex.every((e) => e[0].slideHand);
    if (!hand && ex.some((e, i) => i && e[1].pitch < ex[i - 1][1].pitch)) { out.clear(); used.clear(); }
    const g = G.filter((s) => !out.has(s)).sort((a, b) => a.pitch - b.pitch);
    let src = S.filter((q) => !used.has(q));
    if (!g.length || !src.length) return out;
    // the chord just before: the latest-starting sources, unless they're too few
    const latest = Math.max(...src.map((q) => q.on)), near = src.filter((q) => q.on >= latest - CHORD_TOL);
    if (near.length >= g.length) src = near;
    src.sort((a, b) => a.pitch - b.pitch);
    if (g.length === 1) { out.set(g[0], src.reduce((b, q) => (Math.abs(q.pitch - g[0].pitch) < Math.abs(b.pitch - g[0].pitch) ? q : b))); return out; }
    g.forEach((s, i) => out.set(s, src[Math.round(i * (src.length - 1) / (g.length - 1))]));
    // more notes than before: only one target per source, the rest start fresh
    const seen = new Set();
    for (const [s, q] of [...out]) { if (seen.has(q)) out.delete(s); else seen.add(q); }
    return out;
  }
  function planSlides(notes) {
    const list = notes.map((n) => ({ ...n })).sort((a, b) => a.on - b.on);
    const slides = list.filter((s) => s.slide);
    for (let i = 0; i < slides.length;) {
      const t0 = slides[i].on, G = [];
      while (i < slides.length && slides[i].on <= t0 + CHORD_TOL) G.push(slides[i++]);
      const S = list.filter((q) => !q.gone && !G.includes(q) && q.on < t0 - 1e-9 && q.off > t0 && !(q.slide && q.on > t0 - CHORD_TOL));
      for (const [s, p] of pairChord(G, S)) {
        s.from = p.pitch; s.secs = Math.max(0.001, Math.min(p.off, s.off) - s.on);
        s.off = Math.max(p.off, s.off);
        p.noOff = true; p.gone = true;
      }
    }
    // a slid voice that lasts past its own note must stop where that pitch is played again, or the
    // next chord gets it twice and hits louder for a moment (Eman's recording, 4 Nov)
    for (const s of list) {
      if (s.from == null) continue;
      const again = list.find((q) => q !== s && !q.gone && q.pitch === s.pitch && q.on > s.on + 1e-6 && q.on < s.off);
      if (again) s.off = Math.max(s.on + 0.001, again.on);
    }
    return planPulls(list);
  }

  // Pull up (Eman, 4 Nov): a long note marked pull is a magnet over the chords under it. Each note
  // below it that overlaps plays normally, then over its last stretch (pullAt of it, 0.5 = the
  // second half) bends up into the long note on a curve (slow first, fast at the end). The long
  // note itself sounds while each chord bends into it and stops when that chord ends, so it comes
  // back with every chord. Adds slide entries ({ from, secs, curve, noOff }) and the long note's
  // pieces; the long note's own entry is dropped.
  const PULL_CURVE = 2.5;
  function planPulls(list) {
    if (!list.some((n) => n.pull)) return list;
    const out = [];
    for (const t of list) {
      if (!t.pull) continue;
      const at = Math.max(0.05, Math.min(1, t.pullAt || 0.5)), segs = [];
      for (const q of list) {
        if (q === t || q.pull || q.gone || q.pitch >= t.pitch || !(q.on < t.off && q.off > t.on)) continue;
        const be = Math.min(q.off, t.off), bs = Math.max(t.on, be - (be - q.on) * at);
        if (be - bs < 0.005) continue;
        q.noOff = true; q.pulled = true;
        out.push({ pitch: t.pitch, velocity: q.velocity, on: bs, off: be, from: q.pitch, secs: be - bs, curve: PULL_CURVE, noOff: true, bend: true });
        segs.push([bs, be]);
      }
      t.skip = true;
      segs.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const g of segs) { const m = merged[merged.length - 1]; if (m && g[0] < m[1]) m[1] = Math.max(m[1], g[1]); else merged.push([...g]); }
      // no chord under it: it just plays
      if (!merged.length) { out.push({ ...t, pull: false, skip: false }); continue; }
      for (const [a, b] of merged) out.push({ pitch: t.pitch, velocity: t.velocity, on: a, off: b, piece: true });
    }
    return list.filter((n) => !n.skip).concat(out).sort((a, b) => a.on - b.on || (a.from != null) - (b.from != null));
  }

  // Advanced MIDI (Eman, 7 Nov): a note can carry its own pitch line and wobble, played by the engine on
  // top of slides. bend: [[tSec, semis, curve?], ...] from the note's start (before the first point the
  // offset is the first point's; after the last it holds). wob: { d: semitones, hz, fade: seconds, sh }.
  // Returns [[secondsFromOn, type, args], ...]; a slide note with no wobble clears the one it took over.
  function exprOf(n) {
    const out = [];
    if (Array.isArray(n.bend) && n.bend.length) {
      const pts = [...n.bend].filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).sort((a, b) => a[0] - b[0]);
      if (pts.length) {
        out.push([0, "nbend", [n.pitch, pts[0][1], 0, 1]]);
        for (let i = 0; i + 1 < pts.length; i++) {
          const dt = pts[i + 1][0] - pts[i][0];
          if (dt <= 0.0005) out.push([Math.max(0, pts[i + 1][0]), "nbend", [n.pitch, pts[i + 1][1], 0, 1]]);
          else out.push([Math.max(0, pts[i][0]), "nbend", [n.pitch, pts[i + 1][1], dt, pts[i][2] || 1]]);
        }
      }
    }
    if (n.wob && n.wob.d > 0) {
      out.push([0, "wob", [n.pitch, n.wob.d, n.wob.hz || 6, n.wob.fade || 0, n.wob.sh || 0]]);
      // the intensity curve (Eman, 8 Nov): env [[tSec, level 0..1], ...]; before the first point its level, then
      // straight lines from point to point, the last level holds
      const E = Array.isArray(n.wob.env) ? n.wob.env.filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).sort((a, b) => a[0] - b[0]) : [];
      if (E.length) {
        out.push([0, "wobl", [n.pitch, E[0][1], 0]]);
        for (let i = 0; i + 1 < E.length; i++) {
          const dt = E[i + 1][0] - E[i][0];
          out.push([Math.max(0, E[i][0]), "wobl", [n.pitch, E[i + 1][1], dt > 0.0005 ? dt : 0]]);
        }
      }
    } else if (n.from != null) out.push([0, "wob", [n.pitch, 0, 0, 0, 0]]);
    return out;
  }
  // the wobble's intensity curve, stored as fractions of the note ({ e: [[u 0..1, level 0..1], ...] }), in seconds
  function wobEnvSec(n, spb) {
    if (Array.isArray(n.wob.env)) return { env: n.wob.env };
    return Array.isArray(n.wob.e) && n.wob.e.length ? { env: n.wob.e.map((p) => [p[0] * n.length * spb, p[1]]) } : {};
  }
  // notes in beats (render / schedule in beats) -> their expression in seconds
  function exprSeconds(n, spb) {
    const o = { ...n };
    if (Array.isArray(n.bend) && n.bend.length) o.bend = n.bend.map((p) => [p[0] * spb, p[1], p[2]]);
    if (n.wob && n.wob.d > 0) o.wob = { d: n.wob.d, hz: n.wob.hz != null ? n.wob.hz : (n.wob.r || 2) / spb, fade: n.wob.fade != null ? n.wob.fade : (n.wob.f || 0) * n.length * spb, sh: n.wob.sh || 0, ...wobEnvSec(n, spb) };
    return o;
  }

  // The preset's dice ({ "m2": { amt, speed }, "p1": {...} }: macro 2, point 1) as the worklet's
  // list, each with its home value. speed 0..1 picks the step: 4 bars down to 1/16.
  const DICE_RATES = [16, 8, 4, 2, 1, 0.5, 0.25];
  // The Play page's sliders can roll too ("srelease" ...): the engine's nudge slot for each.
  const SLIDER_DICE = { srelease: 0, scutoff: 1, span: 2 };
  function diceOf(p) {
    if (typeof p === "string") { try { p = JSON.parse(p); } catch (e) { return []; } }
    const out = [], dice = (p && p.dice) || {};
    for (const [key, d] of Object.entries(dice)) {
      if (!d || !(d.amt > 0)) continue;
      const i = +key.slice(1), rate = DICE_RATES[Math.round(Math.max(0, Math.min(1, d.speed == null ? 0.5 : d.speed)) * 6)], seed = i * 7.31 + (key[0] === "p" ? 3.3 : 0);
      if (key[0] === "m") { const m = (p.macros || [])[i]; if (m) out.push({ t: "m", i, bx: +m.value || 0, amt: d.amt, rate, seed }); }
      else if (key[0] === "p") { const q = (p.pads || [])[i]; if (q && q.kind && q.kind !== "macro" && !q.off) out.push({ t: "p", i, kind: q.kind, bx: (q.pos || [0, 0.5])[0], by: (q.pos || [0, 0.5])[1], amt: d.amt, rate, seed }); }
      else if (SLIDER_DICE[key] != null) out.push({ t: "s", i: SLIDER_DICE[key], amt: d.amt, rate, seed: SLIDER_DICE[key] * 5.17 + 1.9 });
    }
    return out;
  }

  const toJson = (p) => (typeof p === "string" ? p : JSON.stringify(p || {}));
  const toBytes = (p) => new TextEncoder().encode(toJson(p));
  const loadedBy = new WeakMap();   // ctx -> api (a worklet can be added to a context only once)
  const modules = new Map();   // url -> Promise of the compiled WebAssembly.Module

  async function load(ctx, url = "toy-machine.wasm") {
    if (loadedBy.has(ctx)) return loadedBy.get(ctx);
    // the compiled module is kept per file: an offline render (WAVE PEEK) loads it into its own context too
    if (!modules.has(url)) modules.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b)).catch((e) => { modules.delete(url); throw e; }));
    const module = await modules.get(url);
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));

    const noteEvents = (notes) => {
      const events = [], frame = (t) => Math.round(t * ctx.sampleRate);
      for (const n of planSlides(notes)) {
        const a = frame(n.on), b = Math.max(a + 1, frame(n.off));
        if (n.from != null) events.push({ frame: a, order: 1, type: "slide", args: [n.from, n.pitch, n.secs, n.velocity || 100, n.curve || 1] });
        else events.push({ frame: a, order: 1, type: "on", args: [n.pitch, n.velocity || 100] });
        for (const [dt, type, args] of exprOf(n)) events.push({ frame: Math.min(b - 1, a + frame(dt)), order: 2, type, args });
        if (!n.noOff) events.push({ frame: b, order: 0, type: "off", args: [n.pitch] });
      }
      return events;
    };

    /** opts: { preset, getTransport, notes } (notes as in schedule(), set up before the first block:
        needed for OfflineAudioContext renders, where port messages arrive too late). */
    function create(opts = {}) {
      if (opts.notes) opts = { ...opts, first: { events: noteEvents(opts.notes), transport: opts.getTransport ? { ...opts.getTransport(), ctxAt: 0 } : undefined } };
      const firstDice = opts.preset ? diceOf(opts.preset) : [];
      if (firstDice.length) opts = { ...opts, first: { ...(opts.first || {}), dice: firstDice } };
      const node = new AudioWorkletNode(ctx, "toy-machine", {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { module, preset: opts.preset ? toBytes(opts.preset) : null, first: opts.first || null, firstList: opts.firstList || null, guardOff: !!(typeof window !== "undefined" && window.KT2_TM_GUARD_OFF) },
      });
      let peak = 0, voices = 0, dice = null, arp = -1, dead = false;
      // a crashed engine (thrown in the worklet, or the browser's processorerror) is marked dead: the lane pool replaces it
      node.onprocessorerror = (ev) => { dead = true; console.warn("TOY MACHINE engine crashed; a new one is made on the next play", ev && ev.message || ""); };
      node.port.onmessage = (m) => {
        if (m.data.dead !== undefined) { dead = true; console.warn("TOY MACHINE engine crashed; a new one is made on the next play:", m.data.dead); return; }
        if (m.data.nan !== undefined) { if (m.data.nan === 1 || m.data.nan % 100 === 0) console.warn("TOY MACHINE made a broken sound (NaN); muted that moment and reset the synth (" + m.data.nan + "x)"); return; }
        if (m.data.peak !== undefined) { peak = Math.max(peak, m.data.peak); voices = m.data.voices; dice = m.data.dice || null; arp = m.data.arp == null ? -1 : m.data.arp; } };
      const frame = (when) => Math.round((when == null ? ctx.currentTime : when) * ctx.sampleRate);
      const send = (type, args, when, order = 2) => node.port.postMessage({ events: [{ frame: frame(when), order, type, args }] });
      const sendTransport = () => opts.getTransport && node.port.postMessage({ transport: { ...opts.getTransport(), ctxAt: ctx.currentTime } });
      sendTransport();
      return {
        output: node,
        setPreset: (p) => node.port.postMessage({ preset: toBytes(p), dice: diceOf(p) }),
        setMacro: (i, v) => node.port.postMessage({ macro: [i, v] }),
        setPad: (i, x, y) => node.port.postMessage({ pad: [i, x, y] }),
        /** The star: point i in spike 0..4 at depth 0..1, or back inside (spike -1). */
        setPadStar: (i, spike, depth) => node.port.postMessage({ padStar: [i, spike, depth || 0] }),
        setSample: (s) => s && s.data && node.port.postMessage({ sample: { data: s.data, sampleRate: s.sampleRate } }),
        /** A drop zone sound for slot 0..5 (the preset's drops.items[].slot). */
        setDropSample: (slot, s) => s && s.data && node.port.postMessage({ drop: { slot, data: s.data, sampleRate: s.sampleRate } }),
        noteOn: (pitch, velocity = 100, when) => send("on", [pitch, velocity], when, 1),
        noteOff: (pitch, when) => send("off", [pitch], when, 0),
        bend: (v, when) => send("bend", [v], when),
        wheel: (v, when) => send("wheel", [v], when),
        /** Many notes at once: [{ pitch, velocity, on: ctxTime, off: ctxTime }]. */
        schedule(notes) { node.port.postMessage({ events: noteEvents(notes) }); },
        /** Drops the scheduled notes but lets the ones sounding ring on (send their note-offs again). */
        requeue: () => node.port.postMessage({ requeue: true }),
        /** Stops everything scheduled. "hard" also cuts the tails (reverb, delay). */
        flush: (mode = "soft") => node.port.postMessage({ flush: mode }),
        sendTransport,
        /** dice: where each dice is right now, [["m"|"p", index, x, y]] or ["s", slot, offset] (null when none run). */
        meter: () => { const p = peak; peak = 0; return { peak: p, voices, dice, arp }; },
        close: () => { node.port.postMessage({ close: true }); node.disconnect(); },
        /** true once the engine crashed: it plays nothing more, make a new one. */
        get dead() { return dead; },
      };
    }

    // Main-thread engine (no worklet) for offline renders: previews, bounces and the null test.
    let direct = null;
    async function engine() {
      if (!direct) {
        const stub = () => 0;
        const inst = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: { fd_close: stub, fd_seek: stub, fd_write: stub, proc_exit: stub, environ_get: stub, environ_sizes_get: stub } });
        if (inst.exports._initialize) inst.exports._initialize();
        direct = inst.exports;
      }
      return direct;
    }

    /** Renders notes (beats) through a preset, like scripts/toymachine.py. -> [L, R] Float32Arrays. */
    async function render(preset, notes, { bpm = 120, seconds, sampleRate = 44100, sample, drops = {}, macros = {}, pads = {} } = {}) {
      const e = await engine(), spb = 60 / bpm, block = 128;
      if (seconds == null) seconds = Math.max(0, ...notes.map((n) => (n.start + n.length) * spb)) + 2;
      const N = Math.round(seconds * sampleRate), h = e.tm_create(sampleRate, block);
      const str = (s) => { const b = new TextEncoder().encode(s), p = e.tm_alloc(b.length + 1); const m = new Uint8Array(e.memory.buffer, p, b.length + 1); m.set(b); m[b.length] = 0; return p; };
      const ps = str(toJson(preset));
      e.tm_set_preset(h, ps); e.tm_free(ps);
      if (sample && sample.data) {
        const p = e.tm_alloc(sample.data.length * 4);
        new Float32Array(e.memory.buffer, p, sample.data.length).set(sample.data);
        e.tm_set_sample(h, p, sample.data.length, sample.sampleRate); e.tm_free(p);
      }
      for (const [slot, d] of Object.entries(drops || {})) {   // { slot: { data, sampleRate } }
        if (!d || !d.data) continue;
        const p = e.tm_alloc(d.data.length * 4);
        new Float32Array(e.memory.buffer, p, d.data.length).set(d.data);
        e.tm_set_drop_sample(h, +slot, p, d.data.length, d.sampleRate); e.tm_free(p);
      }
      for (const [i, v] of Object.entries(macros)) e.tm_set_macro(h, +i, v);
      for (const [i, [x, y]] of Object.entries(pads)) e.tm_set_pad(h, +i, x, y);
      e.tm_set_transport(h, bpm, 0, 1);
      const ev = [];
      for (const n of planSlides(notes.map((x) => ({ ...exprSeconds(x, spb), on: x.start * spb, off: (x.start + x.length) * spb })))) {
        const a = Math.round(n.on * sampleRate), b = Math.round(n.off * sampleRate);
        for (const [dt, type, args] of exprOf(n)) {
          const at = Math.min(Math.max(b, a + 1) - 1, a + Math.round(dt * sampleRate));
          if (type === "nbend") { if (e.tm_note_bend) ev.push([at, 2, () => e.tm_note_bend(h, args[0], args[1], args[2], args[3])]); }
          else if (type === "wobl") { if (e.tm_note_wobble_level) ev.push([at, 3, () => e.tm_note_wobble_level(h, args[0], args[1], args[2])]); }
          else if (e.tm_note_wobble) ev.push([at, 2, () => e.tm_note_wobble(h, args[0], args[1], args[2], args[3], args[4])]);
        }
        if (n.from == null) ev.push([a, 1, () => e.tm_note_on(h, n.pitch, n.velocity || 100)]);
        else if (n.curve && n.curve !== 1 && e.tm_note_slide_curve) ev.push([a, 1, () => e.tm_note_slide_curve(h, n.from, n.pitch, n.secs, n.curve)]);
        else if (e.tm_note_slide) ev.push([a, 1, () => e.tm_note_slide(h, n.from, n.pitch, n.secs)]);
        else ev.push([a, 1, () => { e.tm_note_off(h, n.from); e.tm_note_on(h, n.pitch, n.velocity || 100); }]);
        if (!n.noOff) ev.push([Math.max(b, a + 1), 0, () => e.tm_note_off(h, n.pitch)]);
      }
      ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      const L = new Float32Array(N), R = new Float32Array(N);
      let pos = 0, k = 0;
      while (pos < N) {
        while (k < ev.length && ev[k][0] <= pos) ev[k++][2]();
        const next = k < ev.length ? ev[k][0] : N;
        const m = Math.min(block - (pos % block), N - pos, Math.max(1, next - pos));
        if (pos % block === 0) e.tm_set_transport(h, bpm, (pos * bpm) / 60 / sampleRate, 1);
        e.tm_process(h, m);
        L.set(new Float32Array(e.memory.buffer, e.tm_left(h), m), pos);
        R.set(new Float32Array(e.memory.buffer, e.tm_right(h), m), pos);
        pos += m;
      }
      e.tm_destroy(h);
      return [L, R];
    }

    const api = { create, render, module };
    loadedBy.set(ctx, api);
    return api;
  }

  window.ToyMachine = { load };
})();
