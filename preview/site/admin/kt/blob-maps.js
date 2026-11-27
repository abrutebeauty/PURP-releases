// BLOB maps (design map pages 7-9, step 2): round maps with a puck you drag instead of knobs. Every
// spot on a map is a mix of several real TOY MACHINE settings. The middle of each map is the loaded
// preset as it is (the maps are relative), so every preset starts with all pucks in the middle.
//   const p2 = BlobMaps.apply(basePreset, state)   // state: { mood: [x, y], skin: [x, y], ..., env }
// x and y run -1..1 (right and up are +). Keep this file ASCII-only, like ui/.
"use strict";

window.BlobMaps = (function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const num = (x, d) => (typeof x === "number" && isFinite(x) ? x : d);
  const fx = (p, type, make) => {
    p.fx = p.fx || [];
    let f = p.fx.find((q) => q.type === type);
    if (!f && make) { f = { type, on: true, ...make }; p.fx.push(f); }
    // an effect the preset had switched off fades in from nothing instead of jumping back at its old amount
    if (f && make && f.on === false) { f.on = true; if ("mix" in f || "mix" in make) f.mix = 0; }
    return f;
  };
  const oscs = (p) => ["oscA", "oscB"].map((k) => p[k]).filter((o) => o && (o.on !== false));

  // the eight sources around SOURCE's ring (angle 0 = right, counter-clockwise)
  const SOURCES = [
    { name: "SPHERE", wave: "sine", hint: "sine" }, { name: "TEARDROP", wave: "saw", hint: "saw" },
    { name: "CLUSTER", wave: "organ", hint: "organ" }, { name: "CRYSTAL", wave: "fmbell", hint: "FM bell" },
    { name: "PETALS", wave: "formant", hint: "vocal" }, { name: "RIBBONS", wave: "growl", hint: "growl" },
    { name: "VOXEL", wave: "digital", hint: "digital" }, { name: "CUBE", wave: "pwm", hint: "square / pulse" }];

  const MAPS = [
    { id: "mood", name: "MOOD", what: "how it feels", left: "DARK / ROUGH", right: "SWEET / BRIGHT", down: "CALM", up: "WILD",
      apply(p, x, y) {
        const f = p.filter = { on: true, type: "lp24", cutoff: 20000, ...(p.filter || {}) };
        f.cutoff = clamp(num(f.cutoff, 20000) * Math.pow(2.2, x), 60, 20000);
        if (x < 0) { const d = fx(p, "drive", { mode: "tube", amount: 0, tone: 0.5, mix: 0 }); d.amount = clamp(num(d.amount, 0) - x * 14, 0, 30); d.mix = clamp(num(d.mix, 0) - x * 0.6, 0, 1); }
        if (x > 0) { const c = fx(p, "chorus", { rate: 0.6, depth: 0.5, mix: 0 }); c.mix = clamp(num(c.mix, 0) + x * 0.35, 0, 1); }
        for (const o of oscs(p)) if (o.unison) o.unison.detune = clamp(num(o.unison.detune, 0) * Math.pow(1.7, y - x * 0.4), 0, 100);
        const e = p.ampEnv = { a: 0.003, d: 0.3, s: 0.8, r: 0.2, ...(p.ampEnv || {}) };
        e.a = clamp(num(e.a, 0.003) * Math.pow(5, -y), 0.0005, 4);
        scaleMotion(p, Math.pow(2.5, y), Math.pow(2.5, y));
      } },
    { id: "source", name: "SOURCE", what: "what it's made of", ring: true,
      apply(p, x, y) {
        const r = Math.hypot(x, y);
        if (r < 0.28) return;
        const a = (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1, s = SOURCES[Math.round(a * 8) % 8];
        const o = p.oscA = { ...(p.oscA || {}), on: true };
        delete o.frames;
        o.wave = s.wave; o.pos = clamp((r - 0.28) / 0.72, 0, 1);
      } },
    { id: "skin", name: "SKIN", what: "the filter", left: "CLOSED / MATTE", right: "OPEN / GLOSSY", down: "SMOOTH", up: "RESONANT",
      apply(p, x, y) {
        const f = p.filter = { on: true, type: "lp24", cutoff: 20000, res: 0, ...(p.filter || {}) };
        f.cutoff = clamp(num(f.cutoff, 20000) * Math.pow(7, x), 50, 20000);
        f.res = clamp(num(f.res, 0) + y * 0.55, 0, 0.95);
      } },
    { id: "body", name: "BODY", what: "how hard it is", left: "STONE (fast)", right: "JELLY (slow)", down: "SHORT", up: "LONG",
      apply(p, x, y) {
        const e = p.ampEnv = { a: 0.003, d: 0.3, s: 0.8, r: 0.2, ...(p.ampEnv || {}) };
        e.a = clamp(num(e.a, 0.003) * Math.pow(20, x), 0.0005, 4);
        e.d = clamp(num(e.d, 0.3) * Math.pow(4, y), 0.01, 8); e.r = clamp(num(e.r, 0.2) * Math.pow(4, y), 0.01, 10);
        e.s = clamp(num(e.s, 0.8) + y * 0.4, 0, 1);
      } },
    { id: "spikes", name: "SPIKES", what: "harmonics and bite", left: "DULL", right: "BRIGHT", down: "EVEN", up: "WILD",
      apply(p, x, y) {
        const f = p.filter = { on: true, type: "lp24", cutoff: 20000, ...(p.filter || {}) };
        f.env = clamp(num(f.env, 0) + x * 3, -6, 8);
        const o = p.oscA = { ...(p.oscA || {}), on: true };
        if (!o.frames) o.pos = clamp(num(o.pos, 0) + x * 0.35, 0, 1);
        if (y > 0) {
          // FM bite (or more of the bend the preset already has); oscB and noise fade in from nothing
          if (!o.warp || !o.warp.type || o.warp.type === "none" || o.warp.type === "fm") o.warp = { type: "fm", amount: clamp(num(o.warp && o.warp.amount, 0) + y * 0.55, 0, 1) };
          else o.warp = { ...o.warp, amount: clamp(num(o.warp.amount, 0) + y * 0.4, 0, 1) };
          const bWas = p.oscB && p.oscB.on !== false;
          p.oscB = { wave: "sine", oct: 1, ...(p.oscB || {}), on: true, level: bWas ? num(p.oscB.level, 0.5) : clamp(y * 0.6, 0, 0.6) };
          const nWas = p.noise && p.noise.on !== false ? num(p.noise.level, 0) : 0;
          p.noise = { color: 0.5, ...(p.noise || {}), on: true, level: clamp(nWas + y * 0.12, 0, 0.5) };
        } else if (y < 0 && o.warp) o.warp = { ...o.warp, amount: clamp(num(o.warp.amount, 0) * (1 + y), 0, 1) };
      } },
    { id: "voices", name: "VOICES", what: "bristles and width", left: "ONE", right: "MANY", down: "TIGHT", up: "WIDE",
      apply(p, x, y) {
        for (const o of oscs(p)) {
          const u = o.unison = { voices: 1, detune: 0, spread: 0, blend: 1, ...(o.unison || {}) };
          u.voices = clamp(Math.round(num(u.voices, 1) * Math.pow(2, x * 2.2) + (x > 0 ? x * 3 : 0)), 1, 16);
          u.detune = clamp(num(u.detune, 0) + y * 35 + (x > 0 ? x * 10 : 0), 0, 100);
          u.spread = clamp(num(u.spread, 0) + y * 0.5 + x * 0.3, 0, 1);
          if (u.voices > 1 && num(u.blend, 1) === 1) u.blend = 0.7;
        }
      } },
    { id: "motion", name: "MOTION", what: "modulation", left: "SLOW", right: "FAST", down: "STILL", up: "MOVING",
      apply(p, x, y) {
        const still = !(p.mods || []).some((m) => Math.abs(num(m.amt, 0)) > 0.01), hadLfo = !!p.lfo1;
        scaleMotion(p, Math.pow(3, y), Math.pow(4, x));
        if (y > 0 && still) {   // a sound with no movement gets a wobble on its filter (amt is in octaves)
          p.lfo1 = { shape: "sine", rate: 2, sync: null, retrig: false, ...(p.lfo1 || {}) };
          if (!hadLfo) p.lfo1.rate = clamp(num(p.lfo1.rate, 2) * Math.pow(4, x), 0.02, 30);
          p.filter = { on: true, type: "lp24", cutoff: 4000, ...(p.filter || {}) };
          p.mods = [...(p.mods || []), { src: "lfo1", dst: "filter.cutoff", amt: y * 2.2 }];
        }
      } },
    { id: "aura", name: "AURA", what: "effects around it", left: "DRY", right: "MISTY (reverb)", down: "CLOSE", up: "ECHOES (delay)",
      apply(p, x, y) {
        if (x > 0) { const r = fx(p, "reverb", { size: 0.6, decay: 2.5, damp: 0.5, mix: 0 }); r.mix = clamp(num(r.mix, 0) + x * 0.4, 0, 0.9); r.decay = clamp(num(r.decay, 2.5) * Math.pow(1.8, x), 0.3, 12); }
        if (x < 0) { const r = fx(p, "reverb"); if (r && r.on !== false) { r.mix = clamp(num(r.mix, 0) * (1 + x), 0, 1); r.decay = clamp(num(r.decay, 2.5) * Math.pow(1.8, x), 0.3, 12); } }
        if (y > 0) { const d = fx(p, "delay", { time: 0.375, sync: "1/8d", feedback: 0.3, mix: 0, pingpong: true, tone: 0.5 }); d.mix = clamp(num(d.mix, 0) + y * 0.4, 0, 0.8); d.feedback = clamp(num(d.feedback, 0.3) + y * 0.3, 0, 0.85); }
        if (y < 0) { const d = fx(p, "delay"); if (d && d.on !== false) d.mix = clamp(num(d.mix, 0) * (1 + y), 0, 1); }
      } }
  ];
  function scaleMotion(p, depth, rate) {
    for (const m of p.mods || []) m.amt = num(m.amt, 0) * Math.max(0, depth);
    for (const k of ["lfo1", "lfo2"]) {
      const l = p[k];
      if (!l) continue;
      if (!l.sync) { l.rate = clamp(num(l.rate, 1) * rate, 0.02, 30); continue; }
      // a tempo-synced LFO moves in note lengths instead (each doubling of speed = the next shorter note)
      const m = /^(\d+)\/(\d+)([dt]?)$/.exec(String(l.sync)), steps = Math.round(Math.log2(rate));
      if (!m || !steps) continue;
      const beats = (4 * m[1]) / m[2], i0 = SYNCS.reduce((b, s, i) => (Math.abs(Math.log2(s[1] / beats)) < Math.abs(Math.log2(SYNCS[b][1] / beats)) ? i : b), 0);
      l.sync = SYNCS[clamp(i0 + steps, 0, SYNCS.length - 1)][0] + m[3];
    }
  }
  const SYNCS = [["4/1", 16], ["2/1", 8], ["1/1", 4], ["1/2", 2], ["1/4", 1], ["1/8", 0.5], ["1/16", 0.25], ["1/32", 0.125]];

  // the preset with every map and the envelopes applied; base stays untouched
  function apply(base, st) {
    const p = JSON.parse(JSON.stringify(base || {}));
    // the envelopes you drew come first; the maps then bend them like any other setting
    if (st && st.env) {
      if (st.env.amp) p.ampEnv = { ...(p.ampEnv || {}), ...st.env.amp };
      if (st.env.filt) p.filterEnv = { a: 0.001, d: 0.3, s: 0, r: 0.2, ...(p.filterEnv || {}), ...st.env.filt };
      if (st.env.filtAmt != null) p.filter = { on: true, type: "lp24", cutoff: 20000, ...(p.filter || {}), env: st.env.filtAmt };
    }
    for (const m of MAPS) { const v = st && st[m.id]; if (v && (v[0] || v[1])) m.apply(p, clamp(v[0], -1, 1), clamp(v[1], -1, 1)); }
    return p;
  }

  // the real numbers under a map, in small print
  function readout(id, p) {
    const f = p.filter || {}, e = p.ampEnv || {}, o = p.oscA || {}, u = o.unison || {};
    const ms = (s) => (num(s, 0) < 1 ? Math.round(num(s, 0) * 1000) + "\u00a0ms" : num(s, 0).toFixed(2) + "\u00a0s");
    const fxv = (t, k) => { const q = (p.fx || []).find((x) => x.type === t && x.on !== false); return q ? Math.round(num(q[k], 0) * 100) + "%" : "off"; };
    const hz = (v) => (num(v, 20000) >= 1000 ? (num(v, 20000) / 1000).toFixed(1) + "\u00a0kHz" : Math.round(num(v, 0)) + "\u00a0Hz");
    switch (id) {
      case "mood": return `cutoff ${hz(f.cutoff)} \u00b7 drive ${fxv("drive", "mix")} \u00b7 chorus ${fxv("chorus", "mix")} \u00b7 attack ${ms(e.a)}`;
      case "source": return o.frames ? "the preset's own wavetable" : `${o.wave || "basic"} table, position ${Math.round(num(o.pos, 0) * 100)}%`;
      case "skin": return `${f.type || "lp24"} \u00b7 cutoff ${hz(f.cutoff)} \u00b7 resonance ${Math.round(num(f.res, 0) * 100)}%`;
      case "body": return `attack ${ms(e.a)} \u00b7 decay ${ms(e.d)} \u00b7 sustain ${Math.round(num(e.s, 0.8) * 100)}% \u00b7 release ${ms(e.r)}`;
      case "spikes": return `filter envelope ${num(f.env, 0).toFixed(1)} \u00b7 FM ${Math.round(num(o.warp && o.warp.type === "fm" ? o.warp.amount : 0, 0) * 100)}% \u00b7 noise ${p.noise && p.noise.on ? Math.round(num(p.noise.level, 0) * 100) + "%" : "off"}`;
      case "voices": return `${num(u.voices, 1)} voice${num(u.voices, 1) === 1 ? "" : "s"} \u00b7 detune ${Math.round(num(u.detune, 0))} cents \u00b7 spread ${Math.round(num(u.spread, 0) * 100)}%`;
      case "motion": return `${(p.mods || []).filter((m) => Math.abs(num(m.amt, 0)) > 0.01).length} movements \u00b7 LFO ${p.lfo1 ? (p.lfo1.sync || num(p.lfo1.rate, 1).toFixed(2) + " Hz") : "none"}`;
      case "aura": return `reverb ${fxv("reverb", "mix")} \u00b7 delay ${fxv("delay", "mix")}`;
      default: return "";
    }
  }

  return { MAPS, SOURCES, apply, readout };
})();
