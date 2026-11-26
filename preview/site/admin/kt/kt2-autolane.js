// KILLTOY 2: automation under the pattern (Eman, 8 Nov 19:50).
// The "A" next to any control (TOY MACHINE's sliders, macros and points, every effect knob) puts an
// automation line right under the pattern that is picked. Lines stack under it and go wherever the
// pattern goes. The arrow in the pattern's lower right corner folds them back into the pattern and
// shows how many it has; press it again to open them. Each line is named "PLUGIN \u00b7 CONTROL", and its
// open icon opens that plugin and pulses a marker round the control until the mouse goes over it.
//
// Model: the lines are the lane's usual automation (ui/automation.js, played back as before);
// lane.clips holds the patterns a line shows under, t.autoFold the patterns that are folded.
// A copied pattern takes its line along (follow), so a line also shows under any pattern of its lane
// that has points of it inside.
// KT2_AUTOLANE_OFF = old behaviour (the lines hide, the "a line under ..." message comes back).
"use strict";
(function () {
  if (window.KT2_AUTOLANE_OFF || !document.documentElement.classList.contains("kt2") || !window.KillToyAuto) return;
  const A = window.KillToyAuto;
  // A line is about 80% of its pattern's height (Eman, 8 Nov 21:10; it was 30 px: KT2_AL_SMALL).
  // The stack sits INSIDE the pattern's node (top: 100%), so it moves, glides and lifts with the pattern
  // in every drag; it used to be a sibling moved after each frame, which lagged and jumped (KT2_AL_SIBLING = old).
  const SIB = !!window.KT2_AL_SIBLING;
  // The lines drop OVER the rows below as a frosted sheet; no row grows and there is no dark band
  // (Eman, 8 Nov 22:50, mockup 1 "frosted sheet"). KT2_AL_BAND = the band and taller row (8 Nov 21:30).
  const BAND = !!window.KT2_AL_BAND || SIB;
  if (!BAND) document.documentElement.classList.add("k2-al-over");
  // the band a row grows for its open lines reads as the lines' own rows, not as grid, and the sheet casts no shadow
  // (Eman 11 Nov 21:53). KT2_AL_ZONE_OLD = the old plain band + shadow.
  if (!BAND && !window.KT2_AL_ZONE_OLD) document.documentElement.classList.add("k2-al-zone");
  // plain dark zone, no hatch / coloured outline (Eman 12 Nov 01:10). KT2_AL_PLAIN_OLD = the hatch.
  if (!window.KT2_AL_PLAIN_OLD) document.documentElement.classList.add("k2-al-plain");
  // 24 Nov (Eman clip 01.11, last ask): the lines are see-through by default, the grid shows under them a little (no
  // frosted blur that made them solid black). KT2_AL_SEE_OLD = the frosted sheet
  if (!window.KT2_AL_SEE_OLD) document.documentElement.classList.add("k2-al-see");
  // 24 Nov (Eman clip 01.05): the reset + red X sit in the title bar right after the name, not in the bottom corner where
  // they covered the last point. KT2_AL_XTOP_OLD = bottom right corner
  const XTOP = !window.KT2_AL_XTOP_OLD;
  // 24 Nov (Eman clip 01.11): a point goes all the way to the top of the line, behind the name; while you drag into the
  // name's space the name fades away so you can see the point. KT2_AL_TOP_OLD = the top stops under the name
  const TOPOK = !window.KT2_AL_TOP_OLD;
  // 24 Nov (Eman clip 01.11): right-click a point (or the line) = pick the curve to the next point (Line, Curve, S-curve,
  // Wobble, Spikes, Steps, Saw, Random, like FL Studio's right-click on a point). KT2_AL_RCURVE_OFF = old menu
  // group look round 2 (Eman, 9 Nov 01:22): one frame round the whole group, no acid between members, seams at
  // half strength, the join chain under the title bar and only while the outside clip is picked. KT2_GROUP_LOOK_OLD = before.
  // GROUP is parked (Eman, 9 Nov 13:24: compound clips cover moving things together). KT2_GROUP_ON brings it back.
  // Instead, copies of the SAME pattern that touch on a row link by themselves: their automation becomes one sheet
  // and folds/opens together; they still move on their own. KT2_AUTOLINK_OFF = no auto link.
  if (!window.KT2_GROUP_ON && window.KT2_GROUP_OFF === undefined) window.KT2_GROUP_OFF = true;
  const GLOOK = !window.KT2_GROUP_LOOK_OLD;
  if (GLOOK) document.documentElement.classList.add("k2-glook");
  // the always-on group sign, round 2 (Eman, 9 Nov 13:07: the purple bottom line doesn't read as a group).
  // KT2_GROUP_SIGN = 1: a lavender outline just OUTSIDE the whole group (default); 2: inside it, a thick lavender
  // frame + a purple wash over the notes; "line" = the 01:24 bottom line.
  const GSIGN = String(window.KT2_GROUP_SIGN || 1);
  if (GLOOK) document.documentElement.classList.add("k2-gsign-" + GSIGN);
  // Round 4 (Eman 8 Nov 22:53): each line is as tall as a whole row, so 3 lines cover the 3 rows below. KT2_AL_80 = 80%.
  // (a row that made room for a sheet is taller by --k2-al: that's not the row's own height)
  const rowH = (node) => { const r = node.closest && node.closest(".row"); const g = r && r.classList.contains("k2-alrow") ? parseFloat(r.style.getPropertyValue("--k2-al")) || 0 : 0; return (r && r.offsetHeight - g) || (node.offsetHeight || 62) + 1; };
  const lineH = (node) => (window.KT2_AL_SMALL ? 30 : window.KT2_AL_80 || BAND ? Math.max(30, Math.round((node.offsetHeight || 62) * 0.8)) : Math.max(30, rowH(node) - 1));
  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const OPEN_SVG = '<svg viewBox="0 0 12 12"><path d="M7 1.5h3.5V5M10.5 1.5L6 6M5 2H1.5v8.5H10V7"/></svg>';
  const CHEV = '<svg viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3"/></svg>';

  // ---- which lines sit under which pattern -------------------------------------------------
  // the lanes whose lines can show under a pattern on track t: its own and its stacked synths' (they play its patterns)
  const hostsOf = (t) => [t, ...ui.state.tracks.filter((x) => x.layerOf === t.id)];
  function linesOf(c, t) {
    if (!ui.state || !ui.state.canAutomate || t.kind === "beat") return [];
    const out = [];
    for (const h of hostsOf(t)) for (const l of h.automation || []) {
      if (!l.clips) continue;   // older lines (made before 8 Nov) stay off the patterns
      if (A.fits && !A.fits(l, h)) continue;   // parked: made on the instrument this lane had before
      const inside = (l.points || []).some((p) => p.t > c.start + 1e-4 && p.t < c.start + c.length - 1e-4);
      if (l.clips.includes(c.id) || inside) out.push({ h, l });
    }
    return out;
  }
  const folded = (c, t) => (t.autoFold || []).includes(c.id);

  // ---- one set of lines per group (Eman, 9 Nov 01:36): a line on any member runs across the whole group.
  // Members with the same synth (or the same effect) get it for real, flat at their current setting until you
  // draw on them; a member whose synth/effects don't have that control shows its stretch greyed (switched off).
  // Each line is a key (plugin + control); a key can live on several lanes (a made-unique copy has its own lane).
  // KT2_GROUP_LINES_OLD = the sheet shows each lane as it is (round 1).
  const GL = !window.KT2_GROUP_LINES_OLD;
  const instOf = (h) => String(h.instrument || "").toLowerCase().trim();
  function keyOf(h, l) {
    const tg = l.target;
    if (tg.type === "synth") return "s|" + instOf(h) + "|" + tg.param;
    if (tg.type === "fx") { const f = A.findTarget(h, tg); return "f|" + (f ? f.p.type || f.p.name : tg.pluginId) + "|" + tg.paramId; }
    return tg.type;
  }
  // where member m keeps the line `sample` stands for: { h, target, value } or null (it doesn't have that control)
  function homeFor(m, sample) {
    const tg = sample.l.target, hosts = hostsOf(m.t);
    if (hosts.includes(sample.h)) return { h: sample.h, target: tg };
    for (const h of hosts) {
      if (tg.type === "synth") { if (h.instrument && instOf(h) === instOf(sample.h)) return { h, target: tg }; continue; }
      if (tg.type === "fx") {
        const f = A.findTarget(sample.h, tg);
        if (!f) return null;
        const ty = f.p.type || f.p.name;
        const p = [...(h.plugins || []), ...(h === m.t ? m.c.plugins || [] : [])].find((x) => (x.type || x.name) === ty && (x.params || []).some((q) => q.id === tg.paramId));
        if (p) return { h, target: { ...tg, pluginId: p.id }, value: p.params.find((q) => q.id === tg.paramId).value };
        continue;
      }
      return { h, target: tg };
    }
    return null;
  }
  const laneAt = (home) => (home.h.automation || []).find((l) => A.sameTarget(l.target, home.target) || (home.target.type === "fx" && l.target.type === "fx" && l.target.paramId === home.target.paramId && A.findTarget(home.h, l.target) && A.findTarget(home.h, home.target) && A.findTarget(home.h, l.target).p === A.findTarget(home.h, home.target).p));
  const groupMembers = (alg) => ui.state.tracks.filter((t) => t.kind !== "beat" && !t.layerOf).flatMap((t) => t.clips.filter((c) => c.alg === alg).map((c) => ({ c, t })));
  // every key any member has: the rows of the group's sheet, each with where every member keeps it
  function groupRows(ms) {
    const keys = new Map();
    for (const m of ms) for (const x of linesOf(m.c, m.t)) { const k = keyOf(x.h, x.l); if (!keys.has(k)) keys.set(k, x); }
    const rows = [];
    for (const [key, sample] of keys) {
      const parts = ms.map((m) => { const home = homeFor(m, sample); const lane = home && laneAt(home); return { m, h: home ? home.h : null, l: lane || null, miss: !home }; });
      const prim = parts.find((p) => p.l && p.l.id === sample.l.id && p.h === sample.h) || parts.find((p) => p.l) || { h: sample.h, l: sample.l };
      rows.push({ key, h: prim.h, l: prim.l, parts });
    }
    return rows;
  }
  // put the group's lines on every member that can have them (made after Group, a new line, a join, Make unique)
  let syncing = false;
  async function syncGroup(alg) {
    if (!GL || !alg || syncing) return;
    syncing = true;
    try {
      const ms = groupMembers(alg);
      if (ms.length < 2) return;
      const keys = new Map();
      for (const m of ms) for (const x of linesOf(m.c, m.t)) { const k = keyOf(x.h, x.l); if (!keys.has(k)) keys.set(k, x); }
      for (const sample of keys.values()) for (const m of groupMembers(alg)) {
        const home = homeFor(m, sample);
        if (!home) continue;
        const lane = laneAt(home);
        if (!lane) {
          // a member that didn't have this line: flat at its current setting, so nothing changes until you draw
          const v = home.value != null ? home.value : sample.l.base != null ? sample.l.base : A.valueAt(sample.l, m.c.start);
          await run("addAutomation", { trackId: home.h.id, target: home.target, value: v, name: sample.l.name, clipId: m.c.id });
        } else if (!(lane.clips || []).includes(m.c.id)) await run("setAutomation", { trackId: home.h.id, laneId: lane.id, clips: [...(lane.clips || []), m.c.id] });
      }
    } finally { syncing = false; }
  }
  const algOf = (id) => { const f = id != null && typeof findClip === "function" && findClip(id); return f && f.alg; };
  // a stretch of the sheet, as a clip-path: only these members' parts of the line show
  const stretchPath = (c, ms, H) => "path('" + ms.map((m) => { const a = toX(m.c.start - c.start), b = toX(m.c.start + m.c.length - c.start); return `M${a.toFixed(1)} -4 H${b.toFixed(1)} V${H + 4} H${a.toFixed(1)} Z`; }).join(" ") + "')";
  function decorateRow(lineEl, row, c, color, LH) {
    if (!row.parts) return;
    const byLane = new Map(), miss = [];
    for (const p of row.parts) {
      if (p.miss) { miss.push(p.m); continue; }
      const k = p.l ? p.h.id + "|" + p.l.id : row.h.id + "|" + row.l.id;
      if (!byLane.has(k)) byLane.set(k, { h: p.l ? p.h : row.h, l: p.l || row.l, ms: [] });
      byLane.get(k).ms.push(p.m);
    }
    const primKey = row.h.id + "|" + row.l.id, clip = lineEl.querySelector(":scope > .k2-al-clip");
    if (byLane.size <= 1 && !miss.length) return;
    if (clip) clip.style.clipPath = byLane.has(primKey) ? stretchPath(c, byLane.get(primKey).ms, LH) : "inset(0 100% 0 0)";
    if (clip && byLane.has(primKey)) zx(clip, () => { clip.style.clipPath = stretchPath(c, byLane.get(primKey).ms, LH); });
    for (const [k, g] of byLane) {
      if (k === primKey) continue;
      const other = lineBox(c, g.ms[0].t, g.h, g.l, color, LH).querySelector(".k2-al-clip");
      other.classList.add("k2-al-part");
      other.style.clipPath = stretchPath(c, g.ms, LH);
      zx(other, () => { other.style.clipPath = stretchPath(c, g.ms, LH); });
      lineEl.insertBefore(other, clip ? clip.nextSibling : lineEl.firstChild);
    }
    for (const m of miss) {
      const d = el("div", "k2-al-miss");
      const at = () => { d.style.left = toX(m.c.start - c.start) + "px"; d.style.width = toX(m.c.length) + "px"; };
      at(); zx(d, at);
      d.title = "This pattern's synth doesn't have this control, so the line is switched off here.";
      lineEl.append(d);
    }
    // X and reset reach every lane of the line
    const others = [...byLane.entries()].filter(([k]) => k !== primKey).map(([, g]) => g);
    const x = lineEl.querySelector(".k2-al-x"), rs = lineEl.querySelector(".k2-al-reset");
    if (x) x.addEventListener("click", () => { for (const g of others) { const rest = (g.l.clips || []).filter((id) => !c.ids.includes(id)); if (!rest.length) run("removeAutomation", { trackId: g.h.id, laneId: g.l.id }); else run("setAutomation", { trackId: g.h.id, laneId: g.l.id, clips: rest }); } });
    if (rs) rs.addEventListener("click", () => { for (const g of others) { const v = g.l.base != null ? g.l.base : A.valueAt(g.l, g.ms[0].c.start); const lane = { points: (g.l.points || []).map((p) => ({ ...p })) }; for (const m of g.ms) A.record(lane, [{ t: m.c.start, v }, { t: m.c.start + m.c.length, v }]); run("setAutomation", { trackId: g.h.id, laneId: g.l.id, points: lane.points }); } });
  }

  // ---- names: "TOY MACHINE \u00b7 CUTOFF", "EQ \u00b7 LOW" ----------------------------------------------
  function title(h, l) {
    const tg = l.target;
    if (tg.type === "synth") {
      // KILLDRUM / TOY KEYS lines name their own instrument (9 Nov: a drum line read "TOY MACHINE")
      const inst = /toy gtr/i.test(h.instrument || "") ? "TOY GTR" : /toy keys/i.test(h.instrument || "") ? "TOY KEYS" : /^kd\./.test(tg.param || "") || /killdrum|toy drums/i.test(h.instrument || "") ? "KILLDRUM" : "TOY MACHINE";
      const nm = A.SYNTH[tg.param] ? A.SYNTH[tg.param].name : l.name || tg.param;
      return [inst, nm];
    }
    if (tg.type === "fx") {
      const f = A.findTarget(h, tg);
      return f ? [f.p.name, typeof knobName === "function" ? knobName(f.q.name) : f.q.name] : [(l.name || "Effect"), "removed"];
    }
    return ["LANE", "Volume"];
  }

  // ---- live zoom (Eman, V6z Take 1, 9 Nov 22:21: "when zooming the automations are not following, they should
  // always follow the same as the clip itself"). Everything in a sheet that is measured in time keeps a small
  // re-measure (el._zx); each zoom step runs them, so lines, dots, seams and group widths stretch with their
  // pattern on every frame instead of 160 ms after the zoom stops. KT2_AL_ZOOM_OLD = the old wait.
  const ZX = !window.KT2_AL_ZOOM_OLD;
  const zx = (e, f) => { if (ZX) { e._zx = f; e.classList.add("k2-al-zx"); } return e; };
  function rezoom() {
    for (const s of laid) {
      if (!s.box.isConnected) continue;
      if (s.box._zx) s.box._zx();
      for (const e of s.box.querySelectorAll(".k2-al-zx")) e._zx();
    }
  }

  // ---- the stacks ------------------------------------------------------------------------
  let laid = [];   // [{ node (the pattern), box (its stack) }]
  function place() {
    if (!SIB) return;
    for (const s of laid) {
      const n = s.node;
      if (!n.isConnected) { s.box.remove(); continue; }
      if (s.box.parentNode !== n.parentNode) n.parentNode.append(s.box);
      s.box.style.left = n.offsetLeft + "px";
      s.box.style.top = n.offsetTop + n.offsetHeight + "px";
      s.box.style.width = n.offsetWidth + "px";
      const tr = n.style.transform;
      s.box.style.transform = tr || "";
    }
  }
  let placeQ = 0;
  const placeSoon = () => { if (!placeQ) placeQ = requestAnimationFrame(() => { placeQ = 0; place(); }); };

  // ---- shapes between two dots (look 12 "shape bar", picked for Eman 9 Nov 01:56 while away) ----------------
  // Click a dot, shift-click another on the same line: a bar of shapes pops up over that stretch. A shape is
  // baked into points between the two dots (so playback and saving stay plain points); speed and depth re-bake.
  const SH = !window.KT2_AL_SHAPES_OFF;
  const SHAPES = [["line", "Line"], ["curve", "Curve"], ["scurve", "S-curve"], ["wobble", "Wobble"], ["spikes", "Spikes"], ["steps", "Steps"], ["saw", "Saw"], ["random", "Random"]];
  const SPEEDS = [["1/2", 2], ["1/4", 1], ["1/8", 0.5], ["1/16", 0.25], ["1/4T", 2 / 3]];
  const DEPTHS = [0.25, 0.5, 0.75, 1];
  let pick = null;   // { trackId, laneId, a, b (seconds), shape, speed (index), depth (index) }
  const isPicked = (h, l, t) => pick && pick.trackId === h.id && pick.laneId === l.id && (Math.abs(t - pick.a) < 1e-6 || (pick.b != null && Math.abs(t - pick.b) < 1e-6));
  function pickDown(e, h, l, pts) {
    const i = e.target && e.target.dataset && e.target.dataset.i;
    if (e.button !== 0 || i == null || e.metaKey || e.ctrlKey) return;
    const t = pts[+i] && pts[+i].t, x0 = e.clientX, y0 = e.clientY, shift = e.shiftKey;
    if (t == null) return;
    const up = (ev) => {
      window.removeEventListener("mouseup", up, true);
      if (Math.abs(ev.clientX - x0) > 3 || Math.abs(ev.clientY - y0) > 3) return;   // it was a drag
      if (shift && pick && pick.trackId === h.id && pick.laneId === l.id && Math.abs(pick.a - t) > 1e-6) {
        pick.b = t; if (pick.b < pick.a) [pick.a, pick.b] = [pick.b, pick.a];
        pick.shape = null;
      } else pick = { trackId: h.id, laneId: l.id, a: t, b: null, shape: null, speed: 1, depth: 1 };
      kept.clear(); build();
    };
    window.addEventListener("mouseup", up, true);
  }
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  function rnd(seed) { let r = seed % 233280; return () => (r = (r * 9301 + 49297) % 233280) / 233280; }
  // the points strictly between p0 and p1 that draw `shape`
  function bake(p0, p1, shape, beats, depth) {
    const w = p1.t - p0.t, out = [], L = (u) => p0.v + (p1.v - p0.v) * u, at = (u, v) => out.push({ t: p0.t + w * u, v: clamp01(v) });
    if (w <= 0.002 || shape === "line") return out;
    const per = beats * 60 / ((ui.state && ui.state.bpm) || 120), n = Math.max(1, Math.round(w / per)), A = depth * 0.5, eps = Math.min(0.002, w / (n * 8));
    const e = eps / w;
    if (shape === "curve") { for (let k = 1; k < 16; k++) { const u = k / 16; at(u, L(1 - (1 - u) * (1 - u))); } return out; }
    if (shape === "scurve") { for (let k = 1; k < 16; k++) { const u = k / 16; at(u, L(u * u * (3 - 2 * u))); } return out; }
    if (shape === "wobble") { const m = n * 10; for (let k = 1; k < m; k++) { const u = k / m; at(u, L(u) + A * Math.sin(u * n * Math.PI * 2)); } return out; }
    if (shape === "spikes") { const m = n * 12; for (let k = 1; k < m; k++) { const u = k / m, f = (u * n) % 1; at(u, L(u) + A * 1.6 * Math.pow(Math.max(0, 1 - Math.abs(f - 0.5) * 2), 3)); } return out; }
    if (shape === "saw") { for (let j = 0; j < n; j++) { const u0 = j / n, u1 = (j + 1) / n; if (j) at(u0 + e, L(u0) - A); at(u1 - e, L(u1) + A); } return out; }
    if (shape === "steps" || shape === "random") {
      const k = shape === "steps" ? Math.max(2, n) : n * 2, r = rnd(Math.round(p0.t * 1000) + 7);
      for (let j = 0; j < k; j++) {
        const u0 = j / k, u1 = (j + 1) / k, v = shape === "steps" ? L(j / (k - 1)) : L(u0) + (r() * 2 - 1) * A;
        if (j) at(u0 + e, v); else at(e, v);
        at(u1 - e, v);
      }
      return out;
    }
    return out;
  }
  function applyShape(shape) {
    if (!pick || pick.b == null) return;
    const h = ui.state.tracks.find((x) => x.id === pick.trackId) || (pick.trackId === "master" ? ui.state.master : null);
    const l = h && (h.automation || []).find((x) => x.id === pick.laneId);
    if (!l) { pick = null; return; }
    pick.shape = shape;
    const pts = (l.points || []).map((p) => ({ ...p }));
    const i0 = pts.findIndex((p) => Math.abs(p.t - pick.a) < 1e-6), i1 = pts.findIndex((p) => Math.abs(p.t - pick.b) < 1e-6);
    if (i0 < 0 || i1 < 0) { pick = null; kept.clear(); build(); return; }
    const mid = bake(pts[i0], pts[i1], shape, SPEEDS[pick.speed][1], DEPTHS[pick.depth]);
    const next = pts.slice(0, i0 + 1).concat(mid, pts.slice(i1));
    run("setAutomation", { trackId: h.id, laneId: l.id, points: next });
  }
  const ICON = (k) => { const W = 18, H = 10, d = [`M1 ${H - 1}`]; const p0 = { t: 0, v: 0.1 }, p1 = { t: 1, v: 0.9 };
    const pts = [p0, ...bakeIcon(k), p1]; for (const p of pts) d.push(`L${(1 + p.t * (W - 2)).toFixed(1)} ${(H - 1 - p.v * (H - 2)).toFixed(1)}`);
    return `<svg viewBox="0 0 ${W} ${H}"><path d="${d.join(" ").replace("M1 9 L1.0 8.2", "M1 8.2")}"/></svg>`; };
  function bakeIcon(k) { const keep = ui.state && ui.state.bpm; const st = ui.state; try { if (st) st.bpm = 60; return bake({ t: 0, v: 0.1 }, { t: 1, v: 0.9 }, k, 0.4, 0.5); } finally { if (st) st.bpm = keep; } }
  let bar = null;
  function placeBar() {
    if (!SH) return;
    const svg = pick && pick.b != null && [...document.querySelectorAll(`.k2-al .k2-al-svg[data-lane-id="${pick.laneId}"][data-track-id="${pick.trackId}"]`)].find((s) => s.isConnected);
    if (!svg) { if (bar) bar.hidden = true; return; }
    if (!bar) {
      bar = el("div", "k2-shapebar");
      bar.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
      bar.addEventListener("click", (e) => {
        e.stopPropagation();
        const b = e.target.closest("button");
        if (!b || !pick) return;
        if (b.dataset.shape) applyShape(b.dataset.shape);
        else if (b.dataset.k === "speed") { pick.speed = (pick.speed + 1) % SPEEDS.length; if (pick.shape) applyShape(pick.shape); else placeBar(); }
        else if (b.dataset.k === "depth") { pick.depth = (pick.depth + 1) % DEPTHS.length; if (pick.shape) applyShape(pick.shape); else placeBar(); }
      });
      document.body.append(bar);
    }
    bar.innerHTML = SHAPES.map(([k, n]) => `<button data-shape="${k}" title="${n}" class="${pick.shape === k ? "on" : ""}">${ICON(k)}</button>`).join("") +
      `<i class="sep"></i><button data-k="speed" class="txt" title="Speed (click to change)">${SPEEDS[pick.speed][0]}</button><button data-k="depth" class="txt" title="Depth (click to change)">${Math.round(DEPTHS[pick.depth] * 100)}%</button>`;
    bar.hidden = false;
    const r = svg.getBoundingClientRect(), line = svg.closest(".k2-al-line").getBoundingClientRect();
    const xa = r.left + toX(pick.a), xb = r.left + toX(pick.b), bw = bar.offsetWidth || 300;
    bar.style.left = Math.max(8, Math.min(innerWidth - bw - 8, (xa + xb) / 2 - bw / 2)) + "px";
    bar.style.top = Math.max(8, line.top - 28) + "px";
  }
  if (SH) {
    document.addEventListener("mousedown", (e) => {
      if (!pick || e.target.closest(".k2-shapebar") || (e.target.closest(".k2-al-pt") && e.target.closest(".k2-al"))) return;
      pick = null; if (bar) bar.hidden = true; kept.clear(); setTimeout(build, 0);
    }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pick) { pick = null; if (bar) bar.hidden = true; kept.clear(); build(); } });
    window.addEventListener("scroll", () => placeBar(), true);
  }

  // a line under a MIDI pattern takes its INSTRUMENT's colour (the lane colour, as on the instrument's card), not
  // the pattern's own colour, so lines for different synths read apart (Eman 9 Nov 22:17). KT2_AL_CLIP_COLOR = old.
  const lineColor = (h, color) => {
    if (window.KT2_AL_CLIP_COLOR || !h || h.kind !== "inst" || typeof colorOf !== "function") return color;
    try { return colorOf(h) || color; } catch (e) { return color; }
  };
  // the sound type in a small box before the name (Eman 9 Nov 23:46): BASS, PAD, PLUCK... from the preset's
  // category; a lane with sounds of different types says SEVERAL. KT2_AL_KIND_OFF = no box.
  const KIND = !window.KT2_AL_KIND_OFF;
  const CAT = { bass: "BASS", pads: "PAD", pad: "PAD", plucks: "PLUCK", pluck: "PLUCK", arps: "ARP", arp: "ARP", leads: "LEAD", lead: "LEAD", keys: "KEYS", fx: "FX", texture: "TEXTURE", synths: "SYNTH", synth: "SYNTH", bells: "BELL", vox: "VOX", strings: "STRINGS", brass: "BRASS" };
  const presetKind = new Map(), askedAt = new Map();   // pluginId -> "BASS"...; when we last asked
  function pluginKind(p) {
    if (p.kit || /killdrum|toy ?drums/i.test(p.name || "")) return "DRUMS";
    if (/blob/i.test(p.name || "")) return "BLOB";
    const kindOfPreset = (pr) => (/808/.test(pr.name || "") ? "BASS" : CAT[String(pr.category || "").toLowerCase()] || (/toy keys/i.test(p.name || "") ? "KEYS" : /toy gtr/i.test(p.name || "") ? "GUITAR" : "SYNTH"));
    if (!/toy (machine|keys)/i.test(p.name || "") || !p.id) return p.toy && p.toy.preset ? kindOfPreset(p.toy.preset) : "SYNTH";
    const now = performance.now();
    if (!askedAt.has(p.id) || now - askedAt.get(p.id) > 2000) {
      askedAt.set(p.id, now);
      Promise.resolve(booth("toyMachineGetPreset", { pluginId: p.id })).then((r) => {
        const pr = r && r.preset; if (!pr) return;
        const k = kindOfPreset(pr);
        if (presetKind.get(p.id) !== k) { presetKind.set(p.id, k); kept.clear(); build(); }
      }).catch(() => {});
    }
    // the live preset (asked above) wins; until it answers, the copy the state carries (the playground has one)
    return presetKind.get(p.id) || (p.toy && p.toy.preset ? kindOfPreset(p.toy.preset) : null);
  }
  // the sounds that play this pattern on line host h: the lane's own instrument, else the pattern's (a group: its members')
  function kindOf(h, c) {
    if (!KIND || !h || h.kind !== "inst") return null;
    const host = ui.state.tracks.find((x) => x.id === h.id) || h;
    const ps = (host.plugins || []).filter((p) => p.instrument);
    if (!ps.length && c) {
      const ids = c.ids || [c.id];
      let mine = host.clips.filter((k) => ids.includes(k.id));
      if (!mine.length) mine = host.clips.filter((k) => k.start < c.start + c.length && k.start + k.length > c.start);
      ps.push(...mine.flatMap((k) => (k.plugins || []).filter((p) => p.instrument)));
    }
    const ks = [...new Set(ps.map(pluginKind).filter(Boolean))];
    return ks.length > 1 ? "SEVERAL" : ks[0] || null;
  }
  function lineBox(c, t, h, l, color, LH) {
    color = lineColor(h, color);
    const box = el("div", "k2-al-line");
    box.style.setProperty("--c", color);
    box.style.height = LH + "px";
    box.dataset.laneId = l.id;
    box.dataset.trackId = h.id;
    const head = el("div", "k2-al-head");
    const [who, what] = title(h, l);
    const open = el("button", "k2-al-open");
    open.innerHTML = OPEN_SVG;
    open.hidden = l.target.type === "volume";
    open.addEventListener("click", (e) => { e.stopPropagation(); openSource(c, t, h, l); });
    const nm = el("span", "k2-al-name");
    nm.title = who + " \u00b7 " + what;
    const kd = kindOf(h, c), kind = kd ? el("i", "k2-al-kind", kd) : null;
    nm.append(el("b", null, who), document.createTextNode(" \u00b7 " + what));
    const pos = (ui.transport && ui.transport.position) || 0;
    const at = pos >= c.start && pos <= c.start + c.length ? pos : c.start;
    const val = el("span", "k2-al-val", A.text(h, l, A.valueAt(l, at)));
    const x = el("button", "k2-al-x", "\u00d7");
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      const rest = (l.clips || []).filter((id) => !(c.ids || [c.id]).includes(id));
      // the last pattern it shows under: the line goes; otherwise it only leaves this pattern
      if (!rest.length) run("removeAutomation", { trackId: h.id, laneId: l.id });
      else run("setAutomation", { trackId: h.id, laneId: l.id, clips: rest });
    });
    // reset (Eman, 8 Nov 22:14): this pattern's stretch of the line goes back to flat, at the value the line
    // started from when it was made (lane.base; older lines: the value at the pattern's start)
    const rs = el("button", "k2-al-reset");
    rs.innerHTML = '<svg viewBox="0 0 12 12"><path d="M2.5 6a3.5 3.5 0 1 0 1.1-2.55"/><path d="M2.2 1.6v2.3h2.3"/></svg>';
    rs.addEventListener("click", (e) => {
      e.stopPropagation();
      const v = l.base != null ? l.base : A.valueAt(l, c.start);
      const lane = { points: (l.points || []).map((p) => ({ ...p })) };
      A.record(lane, [{ t: c.start, v }, { t: c.start + c.length, v }]);
      run("setAutomation", { trackId: h.id, laneId: l.id, points: lane.points });
    });
    const corner = el("div", "k2-al-corner");
    corner.append(rs, x);
    head.append(...[open, kind, nm, XTOP && !window.KT2_AL_X_OLD ? corner : null, val].filter(Boolean));
    if (toX(c.length) < 200) val.hidden = true;   // a short pattern keeps the room for the name
    zx(val, () => { val.hidden = toX(c.length) < 200; });
    // the line: an svg from the song's start (so the lane editor's maths in app.js work as they are),
    // shifted so the pattern's stretch shows through the stack
    let W = Math.max(toX(c.start + c.length) + 40, 200);
    const svg = mk("svg", { class: "k2-al-svg", width: W, height: LH });
    svg.style.cssText = `left:${-toX(c.start)}px;width:${W}px;height:${LH}px`;
    svg.style.setProperty("--c", color);
    svg.dataset.laneId = l.id; svg.dataset.trackId = h.id;
    if (SH) svg.addEventListener("mousedown", (e) => pickDown(e, h, l, pts), true);
    const pts = (l.points || []).map((p) => ({ ...p }));
    // a group is one clip (Eman, 9 Nov 01:26): where two members meet, the end point of one and the start point
    // of the next are ONE point, so dragging it moves the line on both sides. KT2_GROUP_SEAM_TWO = two points.
    if (c.seams && !window.KT2_GROUP_SEAM_TWO) {
      for (const at of c.seams) {
        const near = pts.map((p, i) => [p, i]).filter(([p]) => Math.abs(p.t - at) < 0.01);   // (a copy ends 2 ms before the next starts)
        for (const [, i] of near.slice(0, -1).reverse()) pts.splice(i, 1);   // keep the last (the one the next member starts on)
      }
    }
    const draw = () => {
      // 0% is the bottom of the line box (Eman 9 Nov 22:27); the top keeps room for the name. KT2_AL_PAD_OLD = even.
      const H = LH, pad = TOPOK ? 4 : Math.max(5, Math.round(LH * 0.3)), pb = window.KT2_AL_PAD_OLD ? pad : 4, y = (v) => pad + (1 - v) * (H - pad - pb);
      svg.dataset.padTop = pad; svg.dataset.padBot = pb;   // autoMouseDown (app.js) maps the mouse with the same numbers
      svg.replaceChildren();
      if (!pts.length) return;
      let d = `M0 ${y(pts[0].v).toFixed(1)}`;
      for (const p of pts) d += ` L${toX(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`;
      d += ` L${W} ${y(pts[pts.length - 1].v).toFixed(1)}`;
      svg.append(mk("path", { class: "k2-al-fill", d: d + ` L${W} ${H} L0 ${H} Z` }), mk("path", { class: "k2-al-path", d }));
      // round dots (Eman 8 Nov 22:53); KT2_AL_SQUARE = the old squares
      if (window.KT2_AL_SQUARE) pts.forEach((p, i) => svg.append(mk("rect", { class: "k2-al-pt", x: toX(p.t) - 3.5, y: y(p.v) - 3.5, width: 7, height: 7, "data-i": i })));
      else {
        // a shaped stretch (wobble, steps...) is many points: dots inside a dense run hide, so it stays clean
        // (KT2_AL_SHAPES_OFF = every dot). The two picked dots are acid.
        pts.forEach((p, i) => {
          const x = toX(p.t), pk = SH && isPicked(h, l, p.t);
          const near = (j) => pts[j] && Math.abs(toX(pts[j].t) - x) < 16;
          if (SH && !pk && near(i - 1) && near(i + 1)) return;   // inside a dense run (a baked shape): no dot
          svg.append(mk("circle", { class: "k2-al-pt" + (pk ? " k2-al-pick" : ""), cx: x, cy: y(p.v), r: pk ? 4.6 : 4, "data-i": i }));
        });
      }
    };
    draw();
    zx(svg, () => {
      W = Math.max(toX(c.start + c.length) + 40, 200);
      svg.setAttribute("width", W);
      svg.style.left = -toX(c.start) + "px"; svg.style.width = W + "px";
      draw();
    });
    // the same editing as the lane rows: click adds a point, drag moves it, double-click removes it, Cmd-drag paints
    svg.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      if (TOPOK && e.button === 0) {   // the name fades while the hand is inside its space, back on release
        // (the sheet can be rebuilt mid-drag: always the live name of this line under this pattern)
        const liveHead = () => { const b = document.querySelector(`.k2-al[data-clip-id="${c.id}"] .k2-al-line[data-lane-id="${l.id}"][data-track-id="${h.id}"] .k2-al-head`); return b || head; };
        const inHead = (ev, hd) => { const r = hd.getBoundingClientRect(); return ev.clientX >= r.left - 6 && ev.clientX <= r.right + 6 && ev.clientY >= r.top - 6 && ev.clientY <= r.bottom + 4; };
        const mv = (ev) => { const hd = liveHead(); hd.classList.toggle("k2-al-fade", inHead(ev, hd)); };
        const up = () => { window.removeEventListener("mousemove", mv, true); window.removeEventListener("mouseup", up, true); document.querySelectorAll(".k2-al-head.k2-al-fade").forEach((x) => x.classList.remove("k2-al-fade")); };
        window.addEventListener("mousemove", mv, true); window.addEventListener("mouseup", up, true);
      }
      if (typeof autoMouseDown === "function") autoMouseDown(e, h, l, pts, svg, draw, val);
    });
    svg.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const i = e.target.dataset && e.target.dataset.i;
      // double-click a dot: back to the line's default (lane.base; older lines: the value at the pattern's start,
      // the same place the reset button goes). Delete: right-click. KT2_DBL_RESET_OFF = old (deletes)
      const k = i != null ? +i : typeof autoDotNear === "function" ? autoDotNear(svg, e) : -1;
      if (k >= 0 && !window.KT2_DBL_RESET_OFF) {
        const p = pts[k], v = l.base != null ? l.base : A.valueAt(l, c.start);
        if (p && Math.abs(p.v - v) > 1e-6) { p.v = v; draw(); run("setAutomation", { trackId: h.id, laneId: l.id, points: pts }); }
        return;
      }
      if (i == null || pts.length <= 1) return;
      pts.splice(+i, 1);
      run("setAutomation", { trackId: h.id, laneId: l.id, points: pts });
    });
    svg.addEventListener("contextmenu", (e) => {
      e.preventDefault(); e.stopPropagation();
      const i = e.target.dataset && e.target.dataset.i;
      if (SH && !window.KT2_AL_RCURVE_OFF && pts.length > 1) {
        // the stretch: from the point you pressed (or the shown point left of the hand) to the next shown point
        const shown = pts.map((p, k) => k).filter((k) => { const x0 = toX(pts[k].t), near = (j) => pts[j] && Math.abs(toX(pts[j].t) - x0) < 16; return !(near(k - 1) && near(k + 1)); });
        const r = svg.getBoundingClientRect(), tm = (e.clientX - r.left) / ui.pxPerSec;
        let a = i != null ? +i : -1;
        if (a < 0) for (const k of shown) if (pts[k].t <= tm) a = k;
        const b = a >= 0 ? shown.find((k) => k > a) : undefined;
        const items = [];
        if (a >= 0 && b != null) {
          const mini = (k) => { const q = [{ t: 0, v: 0.15 }, ...bakeIcon(k), { t: 1, v: 0.85 }]; return `<path d="${q.map((p, j) => (j ? "L" : "M") + (1.5 + p.t * 13).toFixed(1) + " " + (14 - p.v * 12).toFixed(1)).join(" ")}"/>`; };
          items.push({ heading: "CURVE TO NEXT POINT" });
          for (const [k, n] of SHAPES) items.push({ label: n, icon: mini(k), run: () => {
            const p0 = pts[a], p1 = pts[b], mid = bake(p0, p1, k, SPEEDS[1][1], DEPTHS[1]);
            run("setAutomation", { trackId: h.id, laneId: l.id, points: pts.slice(0, a + 1).concat(mid, pts.slice(b)) });
          } });
        }
        if (i != null) { if (items.length) items.push({ sep: true }); items.push({ label: "Delete point", danger: true, run: () => { pts.splice(+i, 1); run("setAutomation", { trackId: h.id, laneId: l.id, points: pts }); } }); }
        if (items.length && i != null) return showMenu(atMouse(e), items);
        if (items.length) { const v = A.valueAt(l, at); return showMenu(atMouse(e), [...items, { sep: true }, { label: "Flatten", meta: A.text(h, l, v), run: () => run("setAutomation", { trackId: h.id, laneId: l.id, points: [{ t: 0, v }] }) }, { label: "Remove", danger: true, run: () => x.click() }]); }
      }
      if (i != null && pts.length > 1) return showMenu(atMouse(e), [{ label: "Delete point", danger: true, run: () => { pts.splice(+i, 1); run("setAutomation", { trackId: h.id, laneId: l.id, points: pts }); } }]);
      const v = A.valueAt(l, at);
      showMenu(atMouse(e), [{ heading: (who + " \u00b7 " + what).toUpperCase() },
        { label: "Flatten", meta: A.text(h, l, v), run: () => run("setAutomation", { trackId: h.id, laneId: l.id, points: [{ t: 0, v }] }) },
        { sep: true }, { label: "Remove", danger: true, run: () => x.click() }]);
    });
    const clip = el("div", "k2-al-clip");
    clip.append(svg);
    box.append(clip, head);
    if (window.KT2_AL_X_OLD) box.append(x); else if (!XTOP) box.append(corner);
    // a name longer than the pattern runs on past its end, on a chip
    requestAnimationFrame(() => head.classList.toggle("k2-al-over", head.scrollWidth > box.clientWidth - 2));
    return box;
  }

  // Redrawn after each render, but a pattern whose lines, place and zoom didn't change keeps its stack
  // (all reads first, then all writes: no layout thrash with many patterns).
  let kept = new Map();   // clipId -> { sig, box, node }
  // copies of one MIDI pattern (same c.pat; the first one has none until it is copied, so its id) that touch end to
  // start on the same row of the same lane. A made-unique copy has its own pattern, so it never joins.
  // the same pattern: linked (one c.pat) and still the same clip (a cut's halves share c.pat but are different clips)
  const same = (a, b) => (a.pat || a.id) === (b.pat || b.id) && Math.abs(a.length - b.length) < 1e-3 && JSON.stringify(a.notes || []) === JSON.stringify(b.notes || []);
  // mid-drag a pattern's node has moved but its start hasn't (it lands on release): runs are worked out from where
  // the patterns ARE on screen, so pulling one copy away splits the sheet at once and its lines ride with it
  // (Eman 9 Nov 23:10). KT2_AL_DRAGRUN_OLD = the run holds until release.
  const DR = !window.KT2_AL_DRAGRUN_OLD;
  const liveStart = (m) => { if (DR && m.node.classList.contains("dragging")) { const x = parseFloat(m.node.style.left); if (isFinite(x)) return x / ui.pxPerSec; } return m.c.start; };
  // a pattern being dragged never JOINS a run mid-drag (Eman 10 Nov 21:05): the sheet's width comes from where the
  // patterns were before the drag, so joining showed the lines shooting out past the pattern for a moment. It
  // joins on release instead; pulling one out still splits at once, and patterns dragged together stay linked.
  // KT2_AL_JOINLIVE_OLD = join mid-drag (the flash).
  const JOINLATE = !window.KT2_AL_JOINLIVE_OLD;
  const dragged = (m) => DR && m.node.classList.contains("dragging");
  function autoRuns(skip) {
    const out = [];
    for (const t of ui.state.tracks) {
      if (t.kind === "beat" || t.layerOf) continue;
      const byRow = new Map();
      for (const c of t.clips) {
        if (c.kind !== "midi" || c.cmp || skip.has(c.id)) continue;
        const node = document.querySelector(`#rows .clip[data-clip-id="${c.id}"]`);
        if (!node || !node.parentNode) continue;
        const k = node.closest(".row") || node.parentNode;
        if (!byRow.has(k)) byRow.set(k, []);
        byRow.get(k).push({ c, t, node });
      }
      for (const list of byRow.values()) {
        for (const m of list) m.at = liveStart(m);
        list.sort((a, b) => a.at - b.at);
        let run = [];
        const flush = () => { if (run.length > 1) out.push(run); };
        for (const m of list) {
          const p = run[run.length - 1];
          if (p && same(p.c, m.c) && Math.abs(m.at - (p.at + p.c.length)) < 0.01 && (JOINLATE ? dragged(p) === dragged(m) : true)) run.push(m);
          else { flush(); run = [m]; }
        }
        flush();
      }
    }
    return out;
  }
  // a new copy of a pattern opens or stays folded like the one it was copied from (Eman, V6z Take 2): it used to
  // always come down open. KT2_AL_COPY_OPEN_OLD = always open.
  let seenIds = null;
  function copyFold() {
    if (window.KT2_AL_COPY_OPEN_OLD) return;
    const all = [];
    for (const t of ui.state.tracks) for (const c of t.clips || []) all.push({ t, c });
    if (seenIds) {
      for (const { t, c } of all) {
        if (seenIds.has(c.id)) continue;
        const key = c.pat || c.id;
        const src = all.find((x) => x.c.id !== c.id && seenIds.has(x.c.id) && (x.c.id === key || x.c.pat === key || x.c.pat === c.id));
        if (src && folded(src.c, src.t) && !folded(c, t)) { t.autoFold = (t.autoFold || []).concat([c.id]); run("setAutoFold", { trackId: t.id, clipId: c.id, fold: true }); }
      }
    }
    seenIds = new Set(all.map((x) => x.c.id));
  }
  function build() {
    if (ui.state && ui.state.tracks) copyFold();
    if (!ui.state || !ui.state.canAutomate) { for (const s of laid) { s.box.remove(); s.node.classList.remove("k2-alopen"); } laid = []; kept.clear(); return; }
    const want = [], grouped = new Set();
    // groups (Eman, 9 Nov 00:50): the members on one row show ONE sheet from the first one's start to the
    // last one's end, with every line any of them has; the fold arrow sits on the last one. KT2_GROUP_OFF = none.
    if (!window.KT2_GROUP_OFF) {
      const gs = new Map();
      for (const t of ui.state.tracks) {
        if (t.kind === "beat" || t.layerOf) continue;
        for (const c of t.clips) if (c.alg) { const node = document.querySelector(`#rows .clip[data-clip-id="${c.id}"]`); if (!node) continue; const k = c.alg + "|" + (node.closest(".row") ? [...node.closest(".row").parentNode.children].indexOf(node.closest(".row")) : 0); if (!gs.has(k)) gs.set(k, []); gs.get(k).push({ c, t, node }); }
      }
      for (const ms of gs.values()) {
        if (ms.length < 2) continue;
        ms.sort((a, b) => a.c.start - b.c.start);
        const lead = ms[0], end = Math.max(...ms.map((m) => m.c.start + m.c.length));
        const last = ms.reduce((a, b) => (b.c.start + b.c.length >= a.c.start + a.c.length ? b : a));
        let lines;
        if (GL) lines = groupRows(ms);
        else { const seen = new Set(); lines = []; for (const m of ms) for (const x of linesOf(m.c, m.t)) if (!seen.has(x.l.id)) { seen.add(x.l.id); lines.push(x); } }
        for (const m of ms) grouped.add(m.c.id);
        if (!lines.length) continue;
        const ids = ms.map((m) => m.c.id);
        const vc = { id: lead.c.id, start: lead.c.start, length: end - lead.c.start, ids, seams: ms.slice(1).map((m) => m.c.start) };
        want.push({ c: vc, t: lead.t, lines, node: lead.node, fbNode: last.node, f: ms.some((m) => folded(m.c, m.t)), group: ms });
      }
    }
    // auto link: runs of touching copies of one pattern on one row = one sheet over the run
    if (DR) runSig = null;   // the next drag frame compares against where things are then
    if (!window.KT2_AUTOLINK_OFF) for (const ms of autoRuns(grouped)) {
      const lead = ms[0], last = ms[ms.length - 1];
      const seen = new Set(), lines = [];
      for (const m of ms) for (const x of linesOf(m.c, m.t)) if (!seen.has(x.l.id)) { seen.add(x.l.id); lines.push(x); }
      for (const m of ms) grouped.add(m.c.id);
      if (!lines.length) continue;
      const vc = { id: lead.c.id, start: lead.c.start, length: last.c.start + last.c.length - lead.c.start, ids: ms.map((m) => m.c.id), seams: ms.slice(1).map((m) => m.c.start) };
      want.push({ c: vc, t: lead.t, lines, node: lead.node, fbNode: last.node, f: ms.some((m) => folded(m.c, m.t)), group: ms, allFb: true });
    }
    for (const t of ui.state.tracks) {
      if (t.kind === "beat" || t.layerOf) continue;
      for (const c of t.clips) {
        if (grouped.has(c.id)) continue;
        const lines = linesOf(c, t);
        if (!lines.length) continue;
        const node = document.querySelector(`#rows .clip[data-clip-id="${c.id}"]`);
        if (!node || !node.parentNode) continue;
        want.push({ c, t, lines, node, f: folded(c, t) });
      }
    }
    // reads
    for (const w of want) {
      w.LH = lineH(w.node);
      w.color = getComputedStyle(w.node).getPropertyValue("--c").trim() || "#8b5cf6";
      w.sig = JSON.stringify([ui.pxPerSec, c0(w.c), w.c.ids || 0, w.c.seams || 0, w.LH, w.color, w.f, w.lines.map(({ h, l, parts }) => [h.id, lineColor(h, ""), kindOf(h, w.c), l.id, l.points, l.target, l.name, title(h, l), parts ? parts.map((p) => [p.m.c.id, p.miss, p.h && p.h.id, p.l && p.l.id, p.l && p.l.points]) : 0])]);
    }
    // writes
    const next = new Map(), rowsGrow = new Map(), hostRows = new Set();
    const keepBox = new Set(), hostBoxes = [];
    for (const w of want) {
      const { c, t, lines, node, LH } = w;
      const fbNode = w.fbNode || node;
      // auto-linked copies: every one keeps its fold arrow, and each folds/opens the whole run
      if (w.allFb) for (const m of w.group) if (m.node !== fbNode) { let b = m.node.querySelector(":scope > .k2-alfold"); if (!b || b.dataset.sig !== w.sig) { if (b) b.remove(); b = foldButton(m.node, c, t, lines.length, w.group); b.dataset.sig = w.sig; } }
      if (w.group && !w.allFb) for (const m of w.group) if (m.node !== fbNode) { const b = m.node.querySelector(":scope > .k2-alfold"); if (b) b.remove(); }
      let fb = fbNode.querySelector(":scope > .k2-alfold");
      if (!fb || fb.dataset.sig !== w.sig) { if (fb) fb.remove(); fb = foldButton(fbNode, c, t, lines.length, w.group); fb.dataset.sig = w.sig; }
      if (w.f) continue;
      const old = kept.get(c.id);
      let box;
      if (!SIB && old && old.sig === w.sig && old.node === node && old.box.parentNode === node) box = old.box;
      else {
        box = el("div", "k2-al" + (SIB ? "" : " k2-al-in"));
        box.dataset.clipId = c.id;
        box.title = "";   // the pattern's own hover text stays on the pattern
        box.style.setProperty("--c", w.color);
        for (const row of lines) { const le = lineBox(c, t, row.h, row.l, w.color, LH); if (row.parts) decorateRow(le, row, c, w.color, LH); box.append(le); }
        if (c.ids) {   // a group's sheet: as wide as the whole group, a thin dashed mark where each member starts
          box.classList.add("k2-al-grp");
          box.style.right = "auto"; box.style.width = toX(c.length) + "px";
          if (ZX) box._zx = () => { box.style.width = toX(c.length) + "px"; };
          for (const at of c.seams) { const sm = el("i", "k2-al-seam"); sm.style.left = toX(at - c.start) + "px"; zx(sm, () => { sm.style.left = toX(at - c.start) + "px"; }); box.append(sm); }
        }
        // nothing in the stack reaches the pattern under it (no drag, no double-click editor, no clip menu)
        for (const ev of ["mousedown", "pointerdown", "click", "dblclick", "contextmenu"]) box.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === "contextmenu") e.preventDefault(); });
        if (SIB) node.parentNode.append(box); else node.append(box);
      }
      if (!SIB) node.classList.add("k2-alopen");
      keepBox.add(box);
      next.set(c.id, { sig: w.sig, box, node });
      const row = node.closest(".row");
      if (row) rowsGrow.set(row, Math.max(rowsGrow.get(row) || 0, lines.length * (LH + 1) + 6));
      if (!BAND && row) { hostRows.add(row); hostBoxes.push({ row, box, px: lines.length * (LH + 1) + 6, LH, color: w.color }); }
    }
    for (const s of laid) if (!keepBox.has(s.box)) { s.box.remove(); if (!next.has(s.box.dataset.clipId)) s.node.classList.remove("k2-alopen"); }
    // fold buttons of patterns that have no lines any more
    const live = new Set(want.flatMap((w) => (w.allFb ? w.group.map((m) => m.node) : [w.fbNode || w.node])));
    document.querySelectorAll("#rows .clip > .k2-alfold").forEach((b) => { if (!live.has(b.parentNode)) { b.parentNode.classList.remove("k2-hasal"); b.remove(); } });
    document.querySelectorAll("#rows .clip.k2-alopen").forEach((n) => { if (!n.querySelector(":scope > .k2-al")) n.classList.remove("k2-alopen"); });
    laid = [...next.values()].map((x) => ({ node: x.node, box: x.box }));
    kept = next;
    // overlay: the row holding an open stack sits above the rows under it, so the sheet lies on top of them
    document.querySelectorAll("#rows .row.k2-alhost").forEach((r) => { if (!hostRows.has(r)) r.classList.remove("k2-alhost"); });
    for (const r of hostRows) r.classList.add("k2-alhost");
    // overlay, but never over another pattern (Eman 9 Nov 23:11): where an open sheet would lie on a pattern in a row
    // below, its row makes room (the rows under it move down); over empty grid it still floats. KT2_AL_ROOM_OLD = always float.
    const zoneOf = new Map();
    if (!BAND) {
      rowsGrow.clear();
      if (!window.KT2_AL_ROOM_OLD) {
        const rowsAll = [...document.querySelectorAll("#rows .row")];
        for (const hb of hostBoxes) {
          const { row, box, px } = hb;
          if (!box.isConnected) continue;
          const b = box.getBoundingClientRect(), r0 = row.getBoundingClientRect();
          const top = r0.bottom - (rowsGrow.get(row) ? 0 : 0), bottom = top + px;
          let hit = false;
          for (let i = rowsAll.indexOf(row) + 1; i < rowsAll.length && !hit; i++) {
            const rr = rowsAll[i].getBoundingClientRect();
            if (rr.top >= bottom - 1) break;
            for (const n of rowsAll[i].querySelectorAll(":scope > .lane > .clip")) {
              const q = n.getBoundingClientRect();
              if (q.right > b.left + 1 && q.left < b.right - 1 && q.top < bottom - 1) { hit = true; break; }
            }
          }
          if (hit) { rowsGrow.set(row, Math.max(rowsGrow.get(row) || 0, px)); if (!zoneOf.has(row) || zoneOf.get(row).px < px) zoneOf.set(row, { px, LH: hb.LH, color: hb.color }); }
        }
      }
      document.documentElement.classList.toggle("k2-al-room", rowsGrow.size > 0);
    }
    document.querySelectorAll("#rows .row.k2-alrow").forEach((r) => { if (!rowsGrow.has(r)) { r.classList.remove("k2-alrow"); r.style.removeProperty("--k2-al"); } });
    for (const [row, px] of rowsGrow) { row.classList.add("k2-alrow"); if (row.style.getPropertyValue("--k2-al") !== px + "px") row.style.setProperty("--k2-al", px + "px"); }
    // the zone look: one strip per open line (same height as the lines), tinted with their colour
    for (const [row, z] of zoneOf) { const p = z.LH + 1 + "px"; if (row.style.getPropertyValue("--k2-alp") !== p) row.style.setProperty("--k2-alp", p); if (row.style.getPropertyValue("--k2-alc") !== z.color) row.style.setProperty("--k2-alc", z.color); }
    document.querySelectorAll("#rows .row[style*='--k2-alp']").forEach((r) => { if (!zoneOf.has(r)) { r.style.removeProperty("--k2-alp"); r.style.removeProperty("--k2-alc"); } });
    place();
    if (!window.KT2_GROUP_OFF) groupMarks();
    placeBar();
  }
  const c0 = (c) => [c.start, c.length];

  // ---- how a group shows (Eman, 9 Nov 00:54): a small chain at the top left of every member's title bar
  // (its name moves right to make room), and a chain on the seam where a clip that isn't in the group touches
  // one that is: press it and that clip joins the group. Dark, never acid.
  const CHAIN = '<svg viewBox="0 0 12 12"><path d="M5 7l2-2M4.2 5.6 3 6.8a1.75 1.75 0 0 0 2.5 2.5L6.6 8.2M7.8 6.4 9 5.2a1.75 1.75 0 0 0-2.5-2.5L5.4 3.8"/></svg>';
  function groupMarks() {
    const gs = new Map(), nodes = new Map();
    for (const t of ui.state.tracks) if (t.kind !== "beat") for (const c of t.clips) {
      const n = document.querySelector(`#rows .clip[data-clip-id="${c.id}"]`);
      if (!n) continue;
      nodes.set(c.id, { c, t, n });
      if (c.alg) { if (!gs.has(c.alg)) gs.set(c.alg, []); gs.get(c.alg).push(c.id); }
    }
    // the chain in each member's title bar
    for (const { c, n } of nodes.values()) {
      const inG = c.alg && gs.get(c.alg).length > 1;
      const label = n.querySelector(".clip-label");
      let ic = label && label.querySelector(":scope > .k2-grpic");
      if (inG && label && !ic) {
        ic = el("span", "k2-grpic");
        ic.innerHTML = CHAIN;
        ic.title = `In a group of ${gs.get(c.alg).length}: they move together and share their automation. Right-click > Ungroup to undo.`;
        const nm = label.querySelector(".nm");
        label.insertBefore(ic, nm || label.firstChild);
      } else if (!inG && ic) { ic.remove(); ic = null; }
      if (ic) ic.title = `In a group of ${gs.get(c.alg).length}: they move together and share their automation. Right-click > Ungroup to undo.`;
      n.classList.toggle("k2-ingrp", !!inG);
      // one frame over the whole group: each member draws its part, with no edge where it touches another member
      let fr = n.querySelector(":scope > .k2-gframe");
      if (GLOOK && inG && !fr) { fr = el("i", "k2-gframe"); n.append(fr); } else if ((!GLOOK || !inG) && fr) fr.remove();
    }
    if (GLOOK) for (const x of nodes.values()) {
      if (!x.c.alg || gs.get(x.c.alg).length < 2) continue;
      const L = x.n.offsetLeft, R = L + x.n.offsetWidth;
      let l = false, r = false;
      for (const o of nodes.values()) {
        if (o === x || o.c.alg !== x.c.alg || o.n.parentNode !== x.n.parentNode || o.n.offsetTop !== x.n.offsetTop) continue;
        const oL = o.n.offsetLeft, oR = oL + o.n.offsetWidth;
        if (Math.abs(oR - L) <= 2) l = true;
        if (Math.abs(oL - R) <= 2) r = true;
      }
      x.n.classList.toggle("k2-gl", l); x.n.classList.toggle("k2-gr", r);
    }
    // sign 1: one ring per run of touching members on a row, in the lane, just outside them
    document.querySelectorAll("#rows .k2-gring").forEach((b) => b.remove());
    if (GLOOK && GSIGN === "1") {
      const runs = new Map();
      for (const x of nodes.values()) {
        if (!x.c.alg || gs.get(x.c.alg).length < 2) continue;
        const k = x.c.alg + "|" + x.n.offsetTop;
        if (!runs.has(k)) runs.set(k, new Map());
        const byL = runs.get(k); if (!byL.has(x.n.parentNode)) byL.set(x.n.parentNode, []); byL.get(x.n.parentNode).push(x.n);
      }
      for (const byL of runs.values()) for (const [lane, ns] of byL) {
        ns.sort((a, b) => a.offsetLeft - b.offsetLeft);
        let cur = null;
        const out = [];
        for (const n of ns) {
          const L = n.offsetLeft, R = L + n.offsetWidth;
          if (cur && L - cur.R <= 2) { cur.R = Math.max(cur.R, R); cur.n++; } else { cur = { L, R, T: n.offsetTop, H: n.offsetHeight, n: 1 }; out.push(cur); }
        }
        for (const r of out) {
          if (r.n < 2) continue;
          const g = el("i", "k2-gring");
          Object.assign(g.style, { left: r.L - 3 + "px", top: r.T + "px", width: r.R - r.L + 6 + "px", height: r.H + 3 + "px" });
          lane.append(g);
        }
      }
    }
    // the join chain on a seam between a group and a clip outside it, on the same row
    document.querySelectorAll("#rows .k2-grpjoin").forEach((b) => b.remove());
    const eps = 2;   // px: "touching"
    const byLane = new Map();
    for (const x of nodes.values()) { const lane = x.n.parentNode; if (!byLane.has(lane)) byLane.set(lane, []); byLane.get(lane).push(x); }
    for (const [lane, xs] of byLane) {
      for (const a of xs) {
        if (!a.c.alg || gs.get(a.c.alg).length < 2) continue;
        for (const o of xs) {
          if (o === a || (o.c.alg && o.c.alg === a.c.alg)) continue;
          if (o.n.offsetTop !== a.n.offsetTop) continue;
          const aL = a.n.offsetLeft, aR = aL + a.n.offsetWidth, oL = o.n.offsetLeft, oR = oL + o.n.offsetWidth;
          let x = null;
          if (Math.abs(oL - aR) <= eps) x = aR; else if (Math.abs(oR - aL) <= eps) x = aL;
          if (x == null) continue;
          if (o.c.alg && gs.get(o.c.alg).length > 1) continue;   // two groups touching: no chain (Group them from the menu)
          const b = el("button", "k2-grpjoin");
          b.innerHTML = CHAIN;
          b.title = "Join this clip to the group";
          b.style.left = x - 9 + "px"; b.style.top = a.n.offsetTop + (GLOOK ? 26 : 2) + "px";   // look 2: in the notes, under the title bar
          b.dataset.out = o.c.id;
          b.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            const ids = gs.get(a.c.alg).concat([o.c.id]);
            run("groupClips", { clipIds: ids }).then((r) => { if (r && r.ok) { ui.laneSig = ""; render(); } });
          });
          lane.append(b);
        }
      }
    }
    joinVis();
  }
  // look 2: the join chain shows only while the clip outside the group is picked
  function joinVis() {
    document.querySelectorAll("#rows .k2-grpjoin").forEach((b) => { b.hidden = GLOOK && !isSel(b.dataset.out); });
  }
  if (GLOOK && !window.KT2_GROUP_OFF) for (const ev of ["mouseup", "keyup"]) window.addEventListener(ev, () => setTimeout(joinVis, 0), true);

  // ---- "A" with patterns/audio clips picked folds or opens their lines (Eman 9 Nov 23:13). KT2_AL_AKEY_OFF = none.
  if (!window.KT2_AL_AKEY_OFF) window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "a" || e.metaKey || e.ctrlKey || e.altKey || e.repeat || ui.roll) return;
    const tg = e.target;
    if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
    if (!ui.state || ui.state.canAutomate === false) return;
    const ids = new Set([ui.selectedClip, ...(ui.extraClips || [])].filter((x) => x != null));
    if (!ids.size) return;
    for (const r of autoRuns(new Set())) if (r.some((m) => ids.has(m.c.id))) for (const m of r) ids.add(m.c.id);   // a linked run folds as one
    const list = [];
    for (const t of ui.state.tracks) for (const c of t.clips) if (ids.has(c.id) && linesOf(c, t).length) list.push({ t, c });
    if (!list.length) return;
    e.preventDefault(); e.stopPropagation();
    const fold = list.some(({ c, t }) => !folded(c, t));   // any open -> close them all; all closed -> open them
    list.reduce((p, { t, c }) => p.then(() => run("setAutoFold", { trackId: t.id, clipId: c.id, fold })), Promise.resolve());
  }, true);

  // ---- the fold arrow + count in the pattern's lower right corner ------------------------------
  // (put on in build(): KILLTOY 2 keeps a pattern's node when nothing on it changed)
  function foldButton(node, c, t, n, group) {
    const isF = () => (group ? group.some((m) => folded(m.c, ui.state.tracks.find((x) => x.id === m.t.id) || m.t)) : folded(c, ui.state.tracks.find((x) => x.id === t.id) || t));
    const b = el("button", "k2-alfold" + (isF() ? " folded" : ""));
    b.innerHTML = `<span>${n}</span>${CHEV}`;
    b.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const tt = ui.state.tracks.find((x) => x.id === t.id) || t;
      if (group) { const f = !isF(); group.reduce((p, m) => p.then(() => run("setAutoFold", { trackId: m.t.id, clipId: m.c.id, fold: f })), Promise.resolve()); return; }
      run("setAutoFold", { trackId: t.id, clipId: c.id, fold: !folded(c, tt) });
    });
    node.append(b);
    node.classList.add("k2-hasal");
    return b;
  }

  // Mac control-click is a right-click (Eman, 9 Nov 13:20: right-clicking one of several picked patterns kept only
  // that one): the click part of it used to toggle the clip out of the pick first. Now only the menu opens and the
  // whole pick stays. KT2_CTRLCLICK_OLD = old.
  if (!window.KT2_CTRLCLICK_OLD && /Mac/i.test(navigator.platform || navigator.userAgent)) {
    document.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || !e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!(e.target.closest && e.target.closest("#rows .clip"))) return;
      e.stopImmediatePropagation(); e.stopPropagation();
    }, true);
  }

  // ---- groups: one click picks every member, so a drag moves them all; Group / Ungroup in the clip menu ----
  const membersOf = (c) => (c && c.alg ? ui.state.tracks.flatMap((t) => t.clips.filter((x) => x.alg === c.alg)) : []);
  if (!window.KT2_GROUP_OFF) {
    document.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || ui.cutMode || e.detail > 1) return;
      const node = e.target.closest && e.target.closest("#rows .clip");
      if (!node || e.target.closest(".k2-al, .k2-alfold, .edge, .trim, .trim-l, .trim-r, .k2-fade, .k2-vol, .k2-dd, button")) return;
      const f = findClip(node.dataset.clipId);
      const ms = membersOf(f);
      if (ms.length < 2) return;
      ui.selectedClip = f.id;
      ui.extraClips = new Set(ms.filter((x) => x.id !== f.id).map((x) => x.id));
      ui.selectedTrack = null;
      document.querySelectorAll("#rows .clip").forEach((n) => n.classList.toggle("selected", n.dataset.clipId === f.id || ui.extraClips.has(n.dataset.clipId)));
    }, true);
    // a plain click (no move) on a member ended in selectClip(thatOne) and dropped the others (Eman, 9 Nov 01:22:
    // the pick should sit on the whole group). Picking a member picks its group. KT2_GROUP_CLICK_ONE = old.
    if (!window.KT2_GROUP_CLICK_ONE && typeof selectClip === "function" && !selectClip._grp) {
      const sel0 = selectClip;
      selectClip = function (id) {
        const r = sel0.apply(this, arguments);
        const f = id && findClip(id), ms = membersOf(f);
        if (ms.length > 1) {
          ui.extraClips = new Set(ms.filter((x) => x.id !== id).map((x) => x.id));
          document.querySelectorAll("#rows .clip").forEach((n) => n.classList.toggle("selected", isSel(n.dataset.clipId)));
        }
        return r;
      };
      selectClip._grp = true;
    }
    const items = (c, t, many) => {
      const ids = selectedIds(), out = [];
      const clips = ids.map(findClip).filter((x) => x && x.track.kind !== "beat");
      const ms = membersOf(c);
      const sameGroup = ms.length > 1 && clips.every((x) => x.alg === c.alg);
      if (clips.length > 1 && !sameGroup) out.push({ label: "Group", meta: "Cmd+G", run: () => run("groupClips", { clipIds: clips.map((x) => x.id) }).then(afterGroup) });
      if (ms.length > 1) {
        out.push({ label: "Take this one out of the group", run: () => run("ungroupClips", { clipIds: [c.id] }).then(() => { selectClip(c.id); ui.laneSig = ""; render(); }) });
        out.push({ label: "Ungroup", meta: "Cmd+Shift+G", run: () => run("ungroupClips", { clipIds: ms.map((x) => x.id) }) });
      }
      return out;
    };
    const afterGroup = (r) => { if (r && r.ok) { ui.laneSig = ""; render(); } };
    const wrapMenu = () => {
      const u = window.kt2UniqueItems;
      if (u && u._grp) return;
      const w = function (c, t, many) { return [...items(c, t, many), ...(u ? u.apply(this, arguments) : [])]; };
      w._grp = true; window.kt2UniqueItems = w;
    };
    wrapMenu(); setTimeout(wrapMenu, 0);
    document.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "g" || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "") || (document.activeElement || {}).isContentEditable) return;
      const clips = selectedIds().map(findClip).filter((x) => x && x.track.kind !== "beat");
      if (!clips.length) return;
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) run("ungroupClips", { clipIds: clips.flatMap((c) => membersOf(c).map((x) => x.id)) });
      else if (clips.length > 1) run("groupClips", { clipIds: clips.map((x) => x.id) }).then(afterGroup);
    }, true);
  }
  window.KT2Group = { membersOf, syncGroup, groupRows, keyOf };

  const _render = render;
  window.render = render = function () {
    const r = _render.apply(this, arguments);
    try { build(); } catch (e) { console.warn("[autolane]", e); }
    return r;
  };

  // zoom: every step re-measures the sheets right away (see rezoom)
  if (ZX && typeof window.relayoutTimeline === "function") {
    const _relayout = window.relayoutTimeline;
    window.relayoutTimeline = relayoutTimeline = function () {
      const r = _relayout.apply(this, arguments);
      try { rezoom(); place(); } catch (e) { console.warn("[autolane zoom]", e); }
      return r;
    };
  }

  // the stacks go wherever their pattern goes, also in the middle of a drag
  let runSig = null, runQ = 0;
  const runKey = () => autoRuns(new Set()).map((r) => r.map((m) => m.c.id).join(",")).join("|");
  const runsSoon = () => { if (!runQ) runQ = requestAnimationFrame(() => { runQ = 0; const k = runKey(); if (k !== runSig) { runSig = k; build(); } }); };
  new MutationObserver((ms) => {
    if (!laid.length) return;
    if (DR && !window.KT2_AUTOLINK_OFF && ms.some((m) => m.type === "attributes" && m.target.classList && m.target.classList.contains("dragging"))) runsSoon();
    for (const m of ms) {
      const n = m.target;
      if (m.type === "attributes" ? n.classList && n.classList.contains("clip") : true) { placeSoon(); return; }
    }
  }).observe(document.getElementById("rows") || document.body, { subtree: true, attributes: true, attributeFilter: ["style"], childList: true });
  window.addEventListener("resize", placeSoon);

  // ---- the A buttons: the line goes in under the picked pattern -----------------------------
  function pickClip(t) {
    const main = t.layerOf ? ui.state.tracks.find((x) => x.id === t.layerOf) || t : t;
    const own = (id) => id != null && main.clips.find((c) => c.id === id);
    const pos = (ui.transport && ui.transport.position) || 0;
    return own(ui.selectedClip) || own(ui.roll && ui.roll.clipId) || main.clips.find((c) => pos >= c.start && pos < c.start + c.length) || main.clips[0] || null;
  }
  window.automateNow = automateNow = async function (t, list) {
    const c = pickClip(t);
    let first = null;
    for (const x of list) {
      const r = await run("addAutomation", { trackId: t.id, target: x.target, value: x.value == null ? null : x.value, name: x.label.split(" \u00b7 ")[0], ...(c ? { clipId: c.id } : {}) });
      if (r && r.laneId && !first) first = r.laneId;
    }
    if (first) flash(first);
  };
  // A hand move recorded (or painted) while playing: its line shows under the pattern it was recorded over
  // (it used to make a line no pattern showed, playing but hidden)
  { const _run = window.run;
    window.run = run = function (cmd, args) {
      if (cmd === "recordAutomation" && args && args.clipId == null && args.trackId !== "master" && args.points && args.points.length) {
        const t = ui.state.tracks.find((x) => x.id === args.trackId);
        const main = t && (t.layerOf ? ui.state.tracks.find((x) => x.id === t.layerOf) || t : t);
        const at = args.points[0].t;
        const c = main && (main.clips.find((x) => at >= x.start - 1e-3 && at < x.start + x.length) || pickClip(t));
        if (c) args = { ...args, clipId: c.id };
      }
      const r = _run.apply(this, [cmd, args]);
      if (GL && !syncing && /^(groupClips|addAutomation|recordAutomation|makeUniqueLane)$/.test(cmd)) {
        Promise.resolve(r).then((res) => {
          if (!res || res.error) return;
          const id = cmd === "groupClips" ? args.clipIds[0] : cmd === "makeUniqueLane" ? res.clipId : args.clipId;
          const alg = algOf(id);
          if (alg) return syncGroup(alg);
        }).catch(() => {});
      }
      return r;
    };
  }
  // right-click > Automate goes the same way (no long message)
  window.addAutomation = addAutomation = (t, target, value, label) => automateNow(t, [{ target, value, label }]);
  // "Show its automation" (right-click, TOY MACHINE's point menu): opens the folded pattern and flashes the line
  window.flashAuto = flashAuto = async (laneId) => {
    for (const t of ui.state.tracks) for (const c of t.clips) {
      if (folded(c, t) && linesOf(c, t).some((x) => x.l.id === laneId)) await run("setAutoFold", { trackId: t.id, clipId: c.id, fold: false });
    }
    flash(laneId);
  };
  function flash(laneId) {
    requestAnimationFrame(() => {
      const n = document.querySelector(`.k2-al-line[data-lane-id="${laneId}"]`);
      if (!n) return;
      n.classList.add("k2-al-new");
      setTimeout(() => n.classList.remove("k2-al-new"), 1400);
    });
  }

  // ---- the open icon: open what made the line, pulse round its control --------------------------
  function waitFor(find, ms = 4000) {
    return new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        const n = find();
        if (n) return res(n);
        if (performance.now() - t0 > ms) return res(null);
        setTimeout(tick, 80);
      };
      tick();
    });
  }
  const visible = (n) => n && n.isConnected && n.offsetParent !== null && n.getBoundingClientRect().width > 0;
  function pulse(n) {
    document.querySelectorAll(".k2-alpulse").forEach((x) => x.classList.remove("k2-alpulse"));
    n.scrollIntoView({ block: "nearest", inline: "nearest" });
    n.classList.add("k2-alpulse");
    const off = () => { n.classList.remove("k2-alpulse"); n.removeEventListener("mouseenter", off); };
    n.addEventListener("mouseenter", off);
  }
  // TOY MACHINE: the control whose A button names this param (toymachine.js aBtn sets data-auto-params)
  function synthControl(param) {
    const pad = /^pad\.(\d+)\./.exec(param);
    const btns = [...document.querySelectorAll("#iw .tm-abtn, .tm-host .tm-abtn")];
    const b = btns.find((x) => (x.dataset.autoParams || "").split(" ").includes(param)) ||
              (pad ? btns.find((x) => (x.dataset.autoParams || "").split(" ").some((p) => p.startsWith(`pad.${pad[1]}.`))) : null);
    if (!b) return null;
    const ctl = b.closest(".tm-rel");
    if (ctl) return { b, n: ctl.querySelector(".tm-rel-track") || ctl };
    return { b, n: b.closest(".tm-mgroup") || b.parentElement };
  }
  async function openSource(c, t, h, l) {
    const tg = l.target;
    if (tg.type === "synth") {
      openLaneWindow({ t: h, clip: findClip(c.id), view: "inst" });
      // the VST tab of the window (KILLTOY 2 remembers each pattern's last view)
      const vst = await waitFor(() => [...document.querySelectorAll("#iw button, #iw [data-v]")].find((x) => /^vst$/i.test(x.textContent.trim()) && visible(x)), 1500);
      if (vst && !vst.classList.contains("on") && !vst.classList.contains("active")) vst.click();
      // a KILLDRUM line: pick its pad first, so the bars show that pad (its A sits on the bar)
      const kdm = /^kd\.(\d+)\./.exec(tg.param || "");
      if (kdm && window.KillDrumBeat) {
        const slot = Object.keys(KillDrumBeat.NOTE_OF).find((k) => String(KillDrumBeat.NOTE_OF[k]) === kdm[1]);
        const row = slot && await waitFor(() => document.querySelector(`#iw .kd-prow[data-slot="${CSS.escape(slot)}"] .kd-pmeta`), 1500);
        if (row) row.click();
      }
      let hit = await waitFor(() => { const s = synthControl(tg.param); return s && s.b.isConnected ? s : null; });
      if (!hit) return;
      if (!visible(hit.n)) {   // a macro inside the folded Macros list: open the list
        const fold = hit.b.closest(".tm-macfold");
        const fh = fold && !fold.classList.contains("tm-open") && fold.querySelector(".tm-macfold-h");
        if (fh) { fh.click(); hit = await waitFor(() => { const s = synthControl(tg.param); return s && visible(s.n) ? s : null; }, 1500); }
      }
      if (hit && hit.n) pulse(hit.n);
      return;
    }
    if (tg.type === "fx") {
      const f = A.findTarget(h, tg);
      if (!f) return;
      // the card that holds it: on this pattern (an effect copied with a pattern keeps autoOf), else on the lane
      const cc = findClip(c.id);
      const card = ((cc && cc.plugins) || []).find((p) => A.isPlugin(p, tg.pluginId)) || f.p;
      const sel = `.knob[data-plugin="${CSS.escape(String(card.id))}"][data-param="${CSS.escape(String(tg.paramId))}"]`;
      if (typeof selectClip === "function") selectClip(c.id);
      if (window.KT2 && KT2.openTab) KT2.openTab("fx");
      let n = await waitFor(() => [...document.querySelectorAll(sel)].find(visible), 900);
      if (!n && typeof openPluginWindow === "function") {
        openPluginWindow(card);
        n = await waitFor(() => [...document.querySelectorAll(sel)].find(visible), 2000);
      }
      if (n) pulse(n);
    }
  }
  window.KT2AutoLane = { linesOf, title, build, openSource, pickClip };
})();
