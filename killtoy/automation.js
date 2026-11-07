// Automation lanes (Ableton-style): the shared model, used by app.js (drawing and the demo
// backend) and playground/playground.js (playing it back). Keep this file ASCII-only, like ui/.
//
// A lane's automation lives on the lane: track.automation = [{ id, target, points, follow }].
//   target  what moves:
//     { type: "volume" }                                   the lane's fader
//     { type: "fx", pluginId, paramId }                    an effect card's knob (on the lane or on one of its clips)
//     { type: "synth", param }                             a TOY MACHINE control on the lane's instrument:
//         "filter.cutoff" | "ampEnv.r"  the Play page sliders (v = slider position, fields in SYNTH below)
//         "macro.<i>"                   macro i (v = its value, as on its ring)
//         "pad.<k>.<kind>.x" | ".y"     effect point k on the disc, of that kind (v = its position across / up);
//                                       it moves nothing when point k is another kind (older "pad.<k>.x" lines: never an arp or gate)
//   name    the control's name when the lane was made ("Bright", "Motion rate"), for targets that can't name themselves
//   points  [{ t: seconds, v: 0..1 }] sorted by t; straight lines between them, flat before the
//           first and after the last. v is the control's own position (knob/slider/fader 0..1).
//   follow  true (default): cutting, moving or duplicating clips takes their automation with them.
//           false: the automation stays where it is when clips move.
// track.autoOpen = true shows the lanes under the track.
"use strict";

window.KillToyAuto = (function () {
  const EPS = 0.002; // seconds: the edge points that keep a shape in place when clips move

  // ---- values ---------------------------------------------------------------------------
  function valueAt(lane, t) {
    const p = lane.points || [];
    if (!p.length) return lane.value != null ? lane.value : 0.5;
    if (t <= p[0].t) return p[0].v;
    const last = p[p.length - 1];
    if (t >= last.t) return last.v;
    let lo = 0, hi = p.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].t <= t) lo = m; else hi = m; }
    const a = p[lo], b = p[hi];
    return b.t - a.t < 1e-9 ? b.v : a.v + (b.v - a.v) * ((t - a.t) / (b.t - a.t));
  }
  const clean = (points) => {
    const out = points.filter((x) => isFinite(x.t) && isFinite(x.v))
      .map((x) => ({ t: Math.max(0, x.t), v: Math.min(1, Math.max(0, x.v)) }))
      .sort((a, b) => a.t - b.t);
    // two points at the same time are a step; three or more keep only the outer two
    return out.filter((x, i) => !(i > 0 && i < out.length - 1 && Math.abs(out[i - 1].t - x.t) < 1e-6 && Math.abs(out[i + 1].t - x.t) < 1e-6));
  };

  // ---- the fader: same curve as the lane fader in app.js (0.75 = 0 dB, top = +6 dB) ----------
  const dbToLin = (db) => (db <= -60 ? 0 : Math.pow(10, db / 20));
  const linToDb = (g) => (g <= 0.001 ? -60 : Math.max(-60, 20 * Math.log10(g)));
  const volToFrac = (db) => (db >= 0 ? 0.75 + Math.min(6, db) / 24 : 0.75 * Math.sqrt(dbToLin(db)));
  const fracToVol = (f) => (f >= 0.75 ? Math.min(6, (f - 0.75) * 24) : linToDb((f / 0.75) ** 2));

  // ---- TOY MACHINE sliders: slider position (0..1) -> the preset fields it writes ----------
  // Same maths as the Play-page sliders in toymachine.js (cutoffSlider / releaseSlider).
  const CUT_LO = 60, CUT_HI = 20000, CUT_OPEN = 0.85, CUT_DRIVE = 36;
  const SYNTH = {
    "filter.cutoff": {
      name: "Cutoff",
      // muffled at 0, wide open at 0.85 (the red line), then the filter's push (level-held drive in
      // the engine) comes up to +36 dB at 1
      fields: (n) => {
        const d = n > CUT_OPEN ? ((n - CUT_OPEN) / (1 - CUT_OPEN)) * CUT_DRIVE : 0;
        return [["filter.cutoff", n >= CUT_OPEN ? CUT_HI : CUT_LO * Math.pow(CUT_HI / CUT_LO, n / CUT_OPEN)],
                ["filter.push", d]];
      },
      text: (n) => {
        if (n > CUT_OPEN + 0.005) return "Drive +" + Math.round(((n - CUT_OPEN) / (1 - CUT_OPEN)) * CUT_DRIVE) + " dB";
        const c = CUT_LO * Math.pow(CUT_HI / CUT_LO, Math.min(n, CUT_OPEN) / CUT_OPEN);
        return c >= 1000 ? (c / 1000).toFixed(c >= 10000 ? 0 : 1) + " kHz" : Math.round(c) + " Hz";
      },
    },
    "ampEnv.r": {
      name: "Release",
      fields: (n) => [["ampEnv.r", 10 * n * n * n]],   // the slider's "pow" scale, 0..10 s
      text: (n) => { const v = 10 * n * n * n; return v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(2) + " s"; },
    },
    "out.pan": {
      name: "Pan",
      fields: (n) => [["out.pan", n * 2 - 1]],
      text: (n) => { const p = n * 2 - 1; return Math.abs(p) < 0.005 ? "Centre" : (p < 0 ? "L " : "R ") + Math.round(Math.abs(p) * 100); },
    },
  };
  // The range each field can take: the engine gets one hidden macro per field that runs
  // linearly from min to max (see playground.js tmInject), so its value is fieldN(path, value).
  const FIELD_RANGE = { "filter.cutoff": [0, 20000], "filter.drive": [0, 72], "filter.push": [0, 48], "ampEnv.r": [0, 40], "out.level": [-36, 6], "out.pan": [-1, 1] };
  const fieldN = (path, val) => { const [lo, hi] = FIELD_RANGE[path]; return Math.min(1, Math.max(0, (val - lo) / (hi - lo))); };

  // ---- names --------------------------------------------------------------------------
  function plugins(track) {
    return [...(track.plugins || []), ...(track.clips || []).flatMap((c) => c.plugins || [])];
  }
  // A clip effect cut in two (or copied) keeps the id it came from in autoOf, so its automation still reaches it.
  const isPlugin = (p, pluginId) => p.id === pluginId || p.autoOf === pluginId;
  function findTarget(track, target) {
    if (target.type !== "fx") return null;
    const p = plugins(track).find((x) => isPlugin(x, target.pluginId));
    const q = p && (p.params || []).find((x) => x.id === target.paramId);
    return p && q ? { p, q } : null;
  }
  function name(track, lane) {
    const t = lane.target;
    if (t.type === "volume") return "Volume";
    if (t.type === "synth") return (SYNTH[t.param] ? SYNTH[t.param].name : lane.name || t.param) + " \u00b7 TOY MACHINE";
    const f = findTarget(track, t);
    return f ? `${f.q.name} \u00b7 ${f.p.name}` : (lane.name || "Effect") + " (effect removed)";
  }
  // the short name the lane card shows ("Cutoff", "Room"); the full name() goes in its tooltip
  function short(track, lane) {
    const t = lane.target;
    if (t.type === "volume") return "Volume";
    if (t.type === "synth") {
      const n = (SYNTH[t.param] ? SYNTH[t.param].name : lane.name || t.param).replace(/^Filter\s+/i, "");
      return n.charAt(0).toUpperCase() + n.slice(1);
    }
    const f = findTarget(track, t);
    return f ? f.q.name : (lane.name || "Effect") + " (removed)";
  }
  function text(track, lane, v) {
    const t = lane.target;
    if (t.type === "volume") {
      const db = fracToVol(v);
      return db <= -59.9 ? "-inf dB" : (db > 0.04 ? "+" : "") + (Math.abs(db) < 0.05 ? "0.0" : db.toFixed(1)) + " dB";
    }
    if (t.type === "synth") return SYNTH[t.param] ? SYNTH[t.param].text(v) : Math.round(v * 100) + "%";
    return Math.round(v * 100) + "%";
  }
  const sameTarget = (a, b) => a.type === b.type && a.pluginId === b.pluginId && a.paramId === b.paramId && a.param === b.param;

  // ---- clips moving: the automation under them goes along (lanes with follow on) ------------
  // segs: [{ from, to, len }] = a clip that sat at [from, from+len] now sits at [to, to+len].
  // keep: true for duplicates (the original's automation stays too).
  function carry(track, segs, keep) {
    segs = segs.filter((s) => s.len > 0 && Math.abs(s.to - s.from) > 1e-6);
    if (!segs.length) return;
    for (const lane of track.automation || []) {
      if (lane.follow === false || !(lane.points && lane.points.length)) continue;
      const orig = { points: lane.points };
      const at = (t) => valueAt(orig, t);
      const inAny = (t, key) => segs.some((s) => t >= s[key] - 1e-9 && t <= s[key] + s.len + 1e-9);
      // what moves: the shape inside each clip, pinned at both of its edges
      const moved = segs.flatMap((s) => [
        { t: s.to, v: at(s.from) },
        ...orig.points.filter((x) => x.t > s.from && x.t < s.from + s.len).map((x) => ({ t: x.t - s.from + s.to, v: x.v })),
        { t: s.to + s.len, v: at(s.from + s.len) }]);
      // what stays: everything else, pinned where the moved parts left and land
      let rest = keep ? orig.points.slice() : orig.points.filter((x) => !inAny(x.t, "from"));
      const pins = [];
      if (!keep) for (const s of segs) pins.push({ t: s.from - EPS, v: at(s.from - EPS) }, { t: s.from + s.len + EPS, v: at(s.from + s.len + EPS) });
      const stay = { points: clean(rest.concat(pins)) };
      for (const s of segs) pins.push({ t: s.to - EPS, v: valueAt(stay, s.to - EPS) }, { t: s.to + s.len + EPS, v: valueAt(stay, s.to + s.len + EPS) });
      rest = rest.concat(pins).filter((x) => !inAny(x.t, "to") && x.t >= 0);
      lane.points = clean(rest.concat(moved));
    }
  }

  // ---- session.json -------------------------------------------------------------------
  // On disk times are in beats (like MIDI clips): "automation": [{ target, follow, points: [[beat, v], ...] }].
  // An fx target names its card by where it sits: { type: "fx", on: "lane" | <clip index>, index, paramId }.
  function toJson(track, spb) {
    const where = (pid) => {
      const k = (track.plugins || []).filter((p) => !p.instrument).findIndex((p) => isPlugin(p, pid));
      if (k >= 0) return { on: "lane", index: k };
      for (let ci = 0; ci < (track.clips || []).length; ci++) {
        const list = (track.clips[ci].plugins || []).filter((p) => !p.instrument), j = list.findIndex((p) => isPlugin(p, pid));
        if (j >= 0) return { on: ci, index: j };
      }
      return null;
    };
    return (track.automation || []).map((l) => {
      let target = l.target;
      if (target.type === "fx") { const w = where(target.pluginId); target = w ? { type: "fx", ...w, paramId: target.paramId } : null; }
      return target && { target, follow: l.follow !== false, points: (l.points || []).map((x) => [+(x.t / spb).toFixed(4), +x.v.toFixed(4)]) };
    }).filter(Boolean);
  }
  function fromJson(list, track, spb, newId) {
    const card = (tg) => {
      const lane = (track.plugins || []).filter((p) => !p.instrument), clip = track.clips && track.clips[tg.on];
      const p = tg.on === "lane" ? lane[tg.index] : clip && (clip.plugins || []).filter((x) => !x.instrument)[tg.index];
      return p ? { type: "fx", pluginId: p.id, paramId: tg.paramId } : null;
    };
    return (list || []).map((l) => {
      const target = l.target && l.target.type === "fx" ? card(l.target) : l.target;
      return target && { id: newId(), target, follow: l.follow !== false, points: clean((l.points || []).map(([b, v]) => ({ t: b * spb, v }))) };
    }).filter(Boolean);
  }

  // ---- recording: a hand move written over what was there ---------------------------------
  // rec: [{ t, v }] in time order. Points between its first and last time are replaced; the
  // line outside keeps its shape. Close-enough points are thinned (Douglas-Peucker, 1%).
  function thin(p, eps = 0.01) {
    if (p.length < 3) return p.slice();
    const keep = new Array(p.length).fill(false);
    keep[0] = keep[p.length - 1] = true;
    const stack = [[0, p.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let worst = -1, far = eps;
      for (let i = a + 1; i < b; i++) {
        const k = p[b].t - p[a].t < 1e-9 ? 0 : (p[i].t - p[a].t) / (p[b].t - p[a].t);
        const d = Math.abs(p[i].v - (p[a].v + (p[b].v - p[a].v) * k));
        if (d > far) { far = d; worst = i; }
      }
      if (worst > 0) { keep[worst] = true; stack.push([a, worst], [worst, b]); }
    }
    return p.filter((_, i) => keep[i]);
  }
  function record(lane, rec) {
    rec = clean(rec);
    if (!rec.length) return;
    const a = rec[0].t, b = rec[rec.length - 1].t, had = (lane.points || []).length;
    const old = { points: lane.points || [] };
    const keep = old.points.filter((x) => x.t < a - 1e-6 || x.t > b + 1e-6);
    const pins = had ? [{ t: a - EPS, v: valueAt(old, a - EPS) }, { t: b + EPS, v: valueAt(old, b + EPS) }].filter((x) => x.t >= 0) : [];
    lane.points = clean(keep.concat(pins, thin(rec)));
  }

  return { valueAt, clean, record, thin, carry, name, short, text, findTarget, isPlugin, sameTarget, plugins, SYNTH, FIELD_RANGE, fieldN,
           volToFrac, fracToVol, dbToLin, toJson, fromJson };
})();
