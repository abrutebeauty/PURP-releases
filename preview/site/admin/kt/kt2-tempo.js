// KILLTOY 2: the TEMPO lane (Eman, 11 Nov 2026: "a button for automation, and it will automatically be on
// its own lane in the top little bit, separated from everything else").
// The TEMPO button next to the BPM opens a thin lane pinned under the ruler. Each dot is a tempo change:
// from that beat the song plays at that BPM, until the next dot. Before the first dot it plays at the
// BPM box tempo. The grid stays in bars; playback follows the dots (playground.js, setTempoMap).
//   click the lane      a new dot there (where you click = when + how fast), keep holding to drag it
//   drag a dot          left/right = when (snaps to the grid), up/down = BPM (Shift = fine)
//   double-click a dot  type the BPM
//   right-click a dot   delete it (or select it and press Delete)
// window.KT2_TEMPO_OFF = old: no button, no lane, the song plays at one tempo.
// STEP / CURVE (Eman, 15 Nov): two icons next to TEMPO pick how the dots join. STEP = hard jumps (the
// old way), CURVE = the tempo glides from dot to dot (the first glide from the song start). In CURVE:
//   click a glide       picks it (acid yellow, square handle in its middle)
//   drag it up / down   bends it (all the way = a hard jump at its start or end again)
//   double-click it     straight again (Delete does the same)
// window.KT2_TEMPO_RAMP_OFF = old: no icons, always steps.
// FOLD ARROW (Eman, 16 Nov): an arrow left of TEMPO folds the lane down to its name row and opens it again,
// saved per song (tempoMin). window.KT2_TEMPO_MIN_OFF = old: no arrow, the lane is always full height.
// The arrow is the clip header's small grey chevron; window.KT2_TEMPO_FOLD_BIG = the first big purple triangle.
// The lane sits above the PART markers row (Eman, 16 Nov). window.KT2_TEMPO_BELOW_OLD = old: under the ruler.
(function () {
  "use strict";
  if (window.KT2_TEMPO_OFF) return;
  const H = 52, PAD = 10, HEAD = window.KT2_TEMPO_HEAD_OLD ? 0 : 18;   // HEAD: TEMPO + icons get their own row above the line (Eman, 15 Nov)
  const NS = "http://www.w3.org/2000/svg";
  let lastDown = null, strip = null, svg = null, label = null, btn = null, sel = -1, selSeg = -1, drag = null, scale = null;

  const css = `
.k2-tempo { position: relative; height: ${H + HEAD}px; box-sizing: border-box; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(10,10,12,0.55); cursor: crosshair; user-select: none; }
.k2-tempo[hidden] { display: none; }
.k2-tempo.k2t-min { height: ${HEAD || 18}px; cursor: default; }
.k2-tempo.k2t-min > svg { display: none; }
.k2-tempo .k2t-fold { width: 13px; height: 15px; padding: 0; margin: 0 -2px 0 -3px; border: 0; border-radius: 3px; background: transparent; color: rgba(236, 235, 242, 0.45); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; align-self: center; pointer-events: auto; }
.k2-tempo .k2t-fold svg { width: 11px; height: 11px; }
.k2-tempo .k2t-fold:hover { color: #ecebf2; background: rgba(255, 255, 255, 0.08); }
.k2-tempo .k2t-fold svg { position: static; transition: transform 0.12s; }
.k2-tempo.k2t-min .k2t-fold svg { transform: rotate(-90deg); }
.k2-tempo.k2t-min .k2t-head { margin: 0; height: ${HEAD || 18}px; padding: 0 6px; align-items: center; background: transparent; }
.k2-tempo svg { position: absolute; left: 0; top: ${HEAD}px; overflow: visible; }
.k2-tempo .k2t-fill { fill: rgba(124, 92, 255, 0.1); }
.k2-tempo .k2t-line { fill: none; stroke: #8e74ff; stroke-width: 1.6; }
.k2-tempo .k2t-dot { fill: #8e74ff; stroke: #141218; stroke-width: 1.5; cursor: grab; }
.k2-tempo .k2t-dot.sel { fill: var(--acid, #E4FF3A); }
.k2-tempo .k2t-num { font: 600 9.5px var(--font, sans-serif); fill: #cfc8e8; letter-spacing: 0.04em; pointer-events: none; }
.k2-tempo .k2t-num.sel { fill: var(--acid, #E4FF3A); }
.k2-tempo .k2t-head { position: sticky; left: 0; top: 0; z-index: 2; display: inline-flex; align-items: baseline; gap: 6px; margin: 4px 0 0 4px; padding: 3px 6px; background: rgba(14, 13, 18, 0.88); pointer-events: none; }
.k2-tempo.k2t-row .k2t-head { margin: 0; height: ${HEAD}px; min-height: 0; box-sizing: border-box; padding: 0 6px; align-items: center; background: transparent; }
.k2-tempo .k2t-head b { font: 700 9px var(--font, sans-serif); letter-spacing: 0.22em; color: #8e74ff; }
.k2-tempo .k2t-head span { font: 600 10px var(--font, sans-serif); color: #cfc8e8; }
.k2-tempo .k2t-modes { display: inline-flex; gap: 2px; align-self: center; pointer-events: auto; }
.k2-tempo .k2t-mode { width: 20px; height: 16px; padding: 0; border: 0; border-radius: 0; background: transparent; color: rgba(142, 116, 255, 0.55); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.k2-tempo .k2t-mode:hover { color: #b3a2ff; }
.k2-tempo .k2t-mode.on { background: #8e74ff; color: #141218; }
.k2-tempo .k2t-mode svg { position: static; }
.k2-tempo .k2t-line.seg { stroke: var(--acid, #E4FF3A); stroke-width: 2.2; }
.k2-tempo .k2t-bend { fill: var(--acid, #E4FF3A); stroke: #141218; stroke-width: 1; cursor: ns-resize; }
.k2-tempo input.k2t-type { position: absolute; width: 52px; height: 20px; box-sizing: border-box; border: 0; border-radius: 0; padding: 0 4px; font: 600 11px var(--font, sans-serif); color: #141218; background: var(--acid, #E4FF3A); outline: none; z-index: 3; }
.kt2.k2-tempo-on .toprow { height: auto !important; }
.k2-tempo-tool { position: relative; }
.k2-tempo-tool.k2t-hasdots::after { content: ""; position: absolute; top: 5px; right: 5px; width: 5px; height: 5px; border-radius: 50%; background: #8e74ff; }
`;

  const st = () => (typeof ui !== "undefined" && ui.state) || {};
  const spb = () => 60 / (st().bpm || 120);
  const points = () => (Array.isArray(st().tempo) ? st().tempo : []).map((q) => ({ beat: +q.beat, bpm: +q.bpm, ...(q.curve ? { curve: +q.curve } : {}), ...(q.step ? { step: true } : {}) })).sort((a, b) => a.beat - b.beat);
  const xOf = (beat) => toX(beat * spb());
  const beatOf = (x) => toSec(x) / spb();
  const snapB = (beat) => Math.max(0, snapBeat(beat * spb()) / spb());
  const curveMode = () => !window.KT2_TEMPO_RAMP_OFF && st().tempoMode !== "step";
  // the same bend as the engine (playground.js tempoShape): u^(6^curve), all the way = a hard jump
  const shape = (u, c) => { c = Math.max(-1, Math.min(1, +c || 0)); if (c >= 0.99) return u < 1 - 1e-9 ? 0 : 1; if (c <= -0.99) return u > 1e-9 ? 1 : 0; return Math.pow(Math.max(0, Math.min(1, u)), Math.pow(6, c)); };
  const glides = (q) => curveMode() && !q.step;
  const bpmAtBeat = (pts, beat) => {
    let v = st().bpm || 120, pb = 0;
    for (const q of pts) {
      if (q.beat <= beat + 1e-9) { v = q.bpm; pb = q.beat; continue; }
      return glides(q) && q.beat > pb ? v + (q.bpm - v) * shape((beat - pb) / (q.beat - pb), q.curve) : v;
    }
    return v;
  };
  // the glide that ends at dot i: from (beat, bpm) of the dot before (or the song start)
  const segOf = (pts, i) => ({ b0: i > 0 ? pts[i - 1].beat : 0, v0: i > 0 ? pts[i - 1].bpm : st().bpm || 120, b1: pts[i].beat, v1: pts[i].bpm });
  function scaleOf(pts) {
    const all = [st().bpm || 120, ...pts.map((q) => q.bpm)];
    let lo = Math.min(...all) - 15, hi = Math.max(...all) + 15;
    if (hi - lo < 50) { const m = (hi + lo) / 2; lo = m - 25; hi = m + 25; }
    lo = Math.max(40, Math.floor(lo)); hi = Math.min(250, Math.ceil(hi));
    return { lo, hi };
  }
  const yOf = (bpm, sc) => PAD + (1 - (bpm - sc.lo) / Math.max(1, sc.hi - sc.lo)) * (H - 2 * PAD);
  const bpmOfY = (y, sc) => sc.lo + (1 - (y - PAD) / (H - 2 * PAD)) * (sc.hi - sc.lo);
  const fmt = (v) => (Math.round(v * 10) % 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v)));
  const send = (pts, isDrag) => run("setTempoMap", { points: pts, ...(isDrag ? { drag: true } : {}) });
  const keep = (q) => ({ beat: q.beat, bpm: q.bpm, ...(q.curve ? { curve: q.curve } : {}), ...(q.step ? { step: true } : {}) });
  const ICON_STEP = '<svg viewBox="0 0 20 16" width="16" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="square"><path d="M2 12 H8 V4 H12 V9 H18"/></svg>';
  const ICON_CURVE = '<svg viewBox="0 0 20 16" width="16" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="square"><path d="M2 12 C9 12 11 4 18 4"/></svg>';

  function build() {
    if (strip && strip.isConnected) return true;
    const top = document.getElementById("timeline-top"), ruler = document.getElementById("ruler");
    if (!top || !ruler) return false;
    if (!document.getElementById("k2-tempo-css")) { const s = document.createElement("style"); s.id = "k2-tempo-css"; s.textContent = css; document.head.append(s); }
    strip = document.createElement("div"); strip.className = "k2-tempo" + (HEAD ? " k2t-row" : ""); strip.hidden = true;
    label = document.createElement("div"); label.className = "k2t-head"; label.innerHTML = "<b>TEMPO</b><span></span>";
    if (!window.KT2_TEMPO_RAMP_OFF) {
      const modes = document.createElement("div"); modes.className = "k2t-modes";
      for (const [m, icon] of [["step", ICON_STEP], ["curve", ICON_CURVE]]) {
        const b = document.createElement("button"); b.type = "button"; b.className = "k2t-mode"; b.dataset.mode = m; b.innerHTML = icon;
        b.addEventListener("mousedown", (e) => e.stopPropagation());
        b.addEventListener("click", (e) => { e.stopPropagation(); selSeg = -1; run("setTempoMode", { mode: m }); });
        modes.append(b);
      }
      label.insertBefore(modes, label.querySelector("span"));
    }
    if (!window.KT2_TEMPO_MIN_OFF) {
      const f = document.createElement("button"); f.type = "button"; f.className = "k2t-fold";
      // the same small chevron as the clip header's menu arrow (k2-dd): 11 px, stroked, no fill (Eman, 16 Nov 03:24)
      f.innerHTML = window.KT2_TEMPO_FOLD_BIG ? '<svg viewBox="0 0 10 10" width="9" height="9" fill="currentColor"><path d="M1 3 H9 L5 8 Z"/></svg>'
        : '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5l5 5 5-5"/></svg>';
      f.addEventListener("mousedown", (e) => e.stopPropagation());
      f.addEventListener("click", (e) => { e.stopPropagation(); sel = -1; selSeg = -1; run("setTempoMin", { min: !st().tempoMin }); });
      label.prepend(f);
    }
    svg = document.createElementNS(NS, "svg");
    strip.append(label, svg);
    // the lane sits ABOVE the PART markers, its own safe line (Eman, 16 Nov 03:03); KT2_TEMPO_BELOW_OLD = under the ruler
    const secs = document.getElementById("sections");
    if (!window.KT2_TEMPO_BELOW_OLD && secs && secs.parentNode === top) top.insertBefore(strip, secs); else ruler.after(strip);
    strip.addEventListener("mousedown", down);
    strip.addEventListener("contextmenu", ctxMenu);
    return true;
  }
  // the button: a tool in the top bar (an icon of a tempo line that steps up and down)
  const ICON = '<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square"><path d="M2 13 H7 V6 H12 V11 H18"/><circle cx="7" cy="6" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="1.9" fill="currentColor" stroke="none"/></svg>';
  function buildBtn() {
    if (btn && btn.isConnected) return;
    const tools = document.querySelector(".kt-tools");
    if (!tools) return;
    btn = document.createElement("button"); btn.className = "kt-tool k2-tempo-tool"; btn.type = "button"; btn.innerHTML = ICON;
    btn.title = "TEMPO: tempo changes inside the song";
    btn.addEventListener("click", (e) => { e.stopPropagation(); run("setTempoOpen", { open: !st().tempoOpen }); });
    tools.append(btn);
  }

  function hitDot(e) {
    const r = strip.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top - HEAD, pts = points(), sc = scale || scaleOf(pts);
    let best = -1, bd = 9;
    pts.forEach((q, i) => { const d = Math.hypot(xOf(q.beat) - x, yOf(q.bpm, sc) - y); if (d < bd) { bd = d; best = i; } });
    return { i: best, x, y, pts, sc };
  }
  // CURVE: the glide under the pointer (only one that really changes tempo), as the index of its end dot
  function hitSeg(h) {
    if (!curveMode() || h.i >= 0) return -1;
    const beat = beatOf(h.x), pts = h.pts;
    for (let i = 0; i < pts.length; i++) {
      const g = segOf(pts, i);
      if (beat <= g.b0 || beat >= g.b1 || !glides(pts[i]) || Math.abs(g.v1 - g.v0) < 0.05) continue;
      // near the drawn line (a steep part counts by its sideways distance too)
      for (let dx = -6; dx <= 6; dx += 2) if (Math.abs(yOf(bpmAtBeat(pts, beatOf(h.x + dx)), h.sc) - h.y) < 6) return i;
      return -1;
    }
    return -1;
  }
  function bendDown(e, h, i) {
    const now = performance.now();
    if (lastDown && lastDown.seg === i && now - lastDown.at < 380) {   // double-press: straight again
      lastDown = null;
      send(h.pts.map((q, k) => (k === i ? keep({ ...q, curve: 0 }) : keep(q))), false);
      return;
    }
    lastDown = { seg: i, i: -2, at: now };
    sel = -1; selSeg = i; scale = h.sc;
    const g = segOf(h.pts, i), up = g.v1 > g.v0 ? -1 : 1, c0 = +h.pts[i].curve || 0;
    drag = { seg: true, first: true, moved: false };
    draw();
    const move = (ev) => {
      const dy = ev.clientY - e.clientY;
      if (!drag.moved && Math.abs(dy) < 3) return;
      drag.moved = true;
      let c = Math.max(-1, Math.min(1, c0 + up * (-dy) / (ev.shiftKey ? 160 : 40)));
      c = Math.round(c * 100) / 100;
      drag.live = h.pts.map((q, k) => (k === i ? keep({ ...q, curve: c }) : keep(q)));
      if (!drag.raf) drag.raf = requestAnimationFrame(() => { drag.raf = 0; send(drag.live, !drag.first); drag.first = false; });
    };
    const fin = () => {
      removeEventListener("mousemove", move); removeEventListener("mouseup", fin);
      if (drag && drag.raf) { cancelAnimationFrame(drag.raf); send(drag.live, !drag.first); }
      drag = null; scale = null; draw();
    };
    addEventListener("mousemove", move); addEventListener("mouseup", fin);
  }
  function down(e) {
    if (e.button !== 0 || e.target.tagName === "INPUT") return;
    e.preventDefault(); e.stopPropagation();
    if (strip.classList.contains("k2t-min")) return;   // folded: only the arrow does something
    const h = hitDot(e);
    if (h.y < -2) return;   // the TEMPO row above the line
    const si = e.target.classList && e.target.classList.contains("k2t-bend") ? selSeg : hitSeg(h);
    if (si >= 0) { bendDown(e, h, si); return; }
    selSeg = -1;
    let pts = h.pts, i = h.i;
    // the second press on the same dot: type its BPM (the dots are redrawn on every press, so the
    // browser's own dblclick can't be trusted here)
    const now = performance.now();
    if (i >= 0 && lastDown && lastDown.i === i && now - lastDown.at < 380) { lastDown = null; dbl(e); return; }
    lastDown = { i, at: now };
    scale = h.sc;
    if (i < 0) {   // a new dot where you click
      const beat = snapB(beatOf(h.x));
      if (beat <= 0) return;
      const bpm = Math.round(Math.max(40, Math.min(250, bpmOfY(h.y, h.sc))));
      pts = pts.filter((q) => Math.abs(q.beat - beat) > 1e-6).map(keep).concat({ beat, bpm }).sort((a, b) => a.beat - b.beat);
      i = pts.findIndex((q) => q.beat === beat && q.bpm === bpm);
      send(pts, false);
      drag = { i, x0: e.clientX, y0: e.clientY, beat0: beat, bpm0: bpm, pts, first: false, moved: false };
    } else drag = { i, x0: e.clientX, y0: e.clientY, beat0: pts[i].beat, bpm0: pts[i].bpm, pts, first: true, moved: false };
    sel = i; draw();
    const move = (ev) => {
      const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      const fine = ev.shiftKey;
      let beat = snapB(drag.beat0 + dx / toX(spb()));
      if (beat <= 0) beat = drag.lastBeat != null ? drag.lastBeat : drag.beat0;
      let bpm = fine ? drag.bpm0 - dy * 0.1 : drag.bpm0 - dy * ((scale.hi - scale.lo) / (H - 2 * PAD));
      bpm = Math.max(40, Math.min(250, fine ? Math.round(bpm * 10) / 10 : Math.round(bpm)));
      const others = drag.pts.filter((_, k) => k !== drag.i);
      if (others.some((q) => Math.abs(q.beat - beat) < 1e-6)) beat = drag.lastBeat != null ? drag.lastBeat : drag.beat0;
      drag.lastBeat = beat;
      const mine = drag.pts[drag.i];
      const pts2 = others.concat({ ...mine, beat, bpm, me: true }).sort((a, b) => a.beat - b.beat);
      sel = pts2.findIndex((q) => q.me);
      const clean = pts2.map(keep);
      drag.live = clean;
      if (!drag.raf) drag.raf = requestAnimationFrame(() => { drag.raf = 0; send(drag.live, !drag.first); drag.first = false; });
    };
    const up = () => {
      removeEventListener("mousemove", move); removeEventListener("mouseup", up);
      if (drag && drag.raf) { cancelAnimationFrame(drag.raf); send(drag.live, !drag.first); }
      drag = null; scale = null; draw();
    };
    addEventListener("mousemove", move); addEventListener("mouseup", up);
  }
  function ctxMenu(e) {
    const h = hitDot(e);
    e.preventDefault(); e.stopPropagation();
    if (h.i < 0) return;
    sel = -1; selSeg = -1; send(h.pts.filter((_, k) => k !== h.i).map(keep), false);
  }
  function dbl(e) {
    const h = hitDot(e);
    if (h.i < 0) return;
    e.preventDefault(); e.stopPropagation();
    if (strip.querySelector("input.k2t-type")) return;
    sel = h.i; draw();
    const q = h.pts[h.i], inp = document.createElement("input");
    inp.className = "k2t-type"; inp.type = "text"; inp.inputMode = "decimal"; inp.value = fmt(q.bpm);
    inp.style.left = Math.max(0, xOf(q.beat) - 26) + "px"; inp.style.top = HEAD + Math.max(0, Math.min(H - 20, yOf(q.bpm, h.sc) - 10)) + "px";
    strip.append(inp); inp.focus(); inp.select();
    let done = false;
    const end = (ok) => {
      if (done) return; done = true;
      const v = parseFloat(String(inp.value).replace(",", "."));
      inp.remove();
      if (ok && isFinite(v) && v > 0) send(h.pts.map((p, k) => keep(k === h.i ? { ...p, bpm: Math.max(40, Math.min(250, v)) } : p)), false);
    };
    inp.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") end(true); else if (ev.key === "Escape") end(false); });
    inp.addEventListener("blur", () => end(true));
    inp.addEventListener("mousedown", (ev) => ev.stopPropagation());
  }
  addEventListener("keydown", (e) => {
    if ((sel < 0 && selSeg < 0) || !strip || strip.hidden || drag) return;
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
    if (selSeg >= 0) {   // a picked glide: Delete makes it straight, Escape lets go
      if (e.key === "Delete" || e.key === "Backspace") {
        const pts = points();
        if (!pts[selSeg]) return;
        e.preventDefault(); e.stopImmediatePropagation();
        send(pts.map((q, k) => keep(k === selSeg ? { ...q, curve: 0 } : q)), false);
      } else if (e.key === "Escape") { selSeg = -1; draw(); }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      const pts = points();
      if (!pts[sel]) return;
      e.preventDefault(); e.stopImmediatePropagation();
      send(pts.filter((_, k) => k !== sel).map(keep), false); sel = -1;
    } else if (e.key === "Escape") { sel = -1; draw(); }
  }, true);
  // a click anywhere else lets go of the picked dot
  addEventListener("mousedown", (e) => { if ((sel >= 0 || selSeg >= 0) && strip && !strip.contains(e.target)) { sel = -1; selSeg = -1; draw(); } }, true);

  function el(tag, attrs) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function draw() {
    if (!strip) return;
    const s = st(), open = !!s.tempoOpen && !!s.tracks;
    strip.hidden = !open;
    const min = open && !window.KT2_TEMPO_MIN_OFF && !!s.tempoMin;
    strip.classList.toggle("k2t-min", min);
    const fb = label && label.querySelector(".k2t-fold"); if (fb) fb.title = min ? "Open the TEMPO lane" : "Fold the TEMPO lane";
    document.documentElement.classList.toggle("k2-tempo-on", open);
    const pts = points();
    if (btn) {
      btn.classList.toggle("on", !!s.tempoOpen);
      btn.classList.toggle("k2t-hasdots", pts.length > 0);
    }
    if (!open) return;
    const top = document.getElementById("timeline-top"), W = Math.max(200, (top && top.offsetWidth) || 2000);
    strip.style.width = W + "px";
    const sc = scale || scaleOf(pts), base = s.bpm || 120;
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.replaceChildren();
    if (label) label.querySelectorAll(".k2t-mode").forEach((b) => b.classList.toggle("on", b.dataset.mode === (curveMode() ? "curve" : "step")));
    if (selSeg >= pts.length || !curveMode()) selSeg = -1;
    // a glide drawn as short straight bits (every 3 px), a step as a corner
    const glidePath = (i, move) => {
      const g = segOf(pts, i), x0 = xOf(g.b0), x1 = xOf(g.b1), n = Math.max(2, Math.ceil((x1 - x0) / 3));
      let p = move ? `M${x0.toFixed(1)} ${yOf(g.v0, sc).toFixed(1)}` : "";
      for (let k = 1; k <= n; k++) { const u = k / n; p += ` L${(x0 + (x1 - x0) * u).toFixed(1)} ${yOf(g.v0 + (g.v1 - g.v0) * shape(u, pts[i].curve), sc).toFixed(1)}`; }
      return p;
    };
    let d = `M0 ${yOf(base, sc).toFixed(1)}`, cur = base;
    pts.forEach((q, i) => {
      const x = xOf(q.beat).toFixed(1);
      if (glides(q)) {
        const c = +q.curve || 0;
        if (c <= -0.99) d += ` V${yOf(q.bpm, sc).toFixed(1)} H${x}`;
        else d += glidePath(i, false);
      } else d += ` H${x} V${yOf(q.bpm, sc).toFixed(1)}`;
      cur = q.bpm;
    });
    d += ` H${W}`;
    svg.append(el("path", { d: d + ` V${H} H0 Z`, class: "k2t-fill" }), el("path", { d, class: "k2t-line" }));
    if (selSeg >= 0) {
      const g = segOf(pts, selSeg), mid = (g.b0 + g.b1) / 2;
      svg.append(el("path", { d: glidePath(selSeg, true), class: "k2t-line seg" }));
      const hx = xOf(mid), hy = yOf(bpmAtBeat(pts, mid), sc);
      svg.append(el("rect", { x: (hx - 4).toFixed(1), y: (hy - 4).toFixed(1), width: 8, height: 8, class: "k2t-bend" }));
    }
    pts.forEach((q, i) => {
      const x = xOf(q.beat), y = yOf(q.bpm, sc);
      svg.append(el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 5, class: "k2t-dot" + (i === sel ? " sel" : "") }));
      const t = el("text", { x: (x + 8).toFixed(1), y: (y < H / 2 ? y + 12 : y - 6).toFixed(1), class: "k2t-num" + (i === sel ? " sel" : "") });
      t.textContent = fmt(q.bpm);
      svg.append(t);
    });
    void cur;
    const ph = el("rect", { x: 0, y: 0, width: 1, height: H, fill: "#E4FF3A", opacity: 0.65, class: "k2t-ph" });
    svg.append(ph);
    live();
  }
  // the tempo playing right now, next to TEMPO, and the marker line in the lane
  function live() {
    if (!strip || strip.hidden) return;
    const pos = (typeof ui !== "undefined" && ui.transport && ui.transport.position) || 0, beat = pos / spb();
    const sp = label.querySelector("span"), v = fmt(bpmAtBeat(points(), beat));
    if (sp.textContent !== v) sp.textContent = v;
    const ph = svg.querySelector(".k2t-ph");
    if (ph) ph.setAttribute("x", toX(pos).toFixed(1));
  }
  setInterval(live, 60);

  // other modules wrap render() at different times, so the lane redraws on its own when the state,
  // the zoom or the timeline width change (checked every frame, it draws only then)
  let seen = null;
  (function watch() {
    try {
      const top = document.getElementById("timeline-top");
      const cur = [typeof ui !== "undefined" && ui.state, typeof ui !== "undefined" && ui.pxPerSec, top && top.offsetWidth, sel, selSeg];
      if (!seen || cur.some((v, i) => v !== seen[i])) { seen = cur; if (build()) { buildBtn(); draw(); } }
    } catch (e) { console.warn("[tempo]", e); }
    requestAnimationFrame(watch);
  })();
  window.KT2TempoLane = { draw, open: () => run("setTempoOpen", { open: true }), strip: () => strip };
})();
