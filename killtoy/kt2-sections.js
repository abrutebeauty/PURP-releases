// KILLTOY 2: the song-part blocks (INTRO, VERSE, HOOK...) as the mock has them.
//   drag a block      moves that part of the song: everything under it (the beat too) goes
//                     with it, the other parts close up (moveSection)
//   drag its edges    the left edge moves where it starts, the right edge where the next
//                     part starts (snaps to the beat)
//   + in a gap        adds a part there: 8 empty bars, or a copy of the part before it, and
//                     everything after moves later (insertSection)
//   click / double-click   loops it / renames it (app.js, unchanged)
// demo() adds the two engine commands to the demo backend (app.js calls it next to
// KillToyCompound.demo, so the playground's undo and restart wrap them). The page half
// starts on DOMContentLoaded, after app.js. Keep this file ASCII-only, like ui/.
"use strict";

window.KillToySections = (function () {
  const EPS = 1e-6;

  // ------------------------------------------------------------------ engine (demo backend)
  function demo({ S, handlers, changed, id }) {
    const bar = () => (4 * 60) / S.bpm, spb = () => 60 / S.bpm;
    const songEnd = () => Math.max(44 * bar(), ...S.tracks.flatMap((t) => t.clips.map((c) => c.start + c.length)));
    const spans = () => (S.sections || []).map((x, i, l) => { const nx = i + 1 < l.length ? l[i + 1].start : Math.max(songEnd(), x.start + bar()); return { ...x, end: x.len > 0 ? Math.min(nx, x.start + x.len) : nx }; });
    // Cut a clip in two at `time` (song seconds); the right half is returned (new id).
    function cut(t, c, time) {
      const at = time - c.start;
      if (at <= EPS || at >= c.length - EPS) return null;
      const r = structuredClone(c);
      r.id = id();
      r.plugins = (r.plugins || []).map((p) => ({ ...p, id: id(), autoOf: p.autoOf || p.id }));
      r.start = time; r.length = c.length - at;
      if (c.kind === "midi") {
        const b = at / spb();
        r.notes = (c.notes || []).filter((n) => n.start >= b - EPS).map((n) => ({ ...n, start: n.start - b }));
        c.notes = (c.notes || []).filter((n) => n.start < b - EPS).map((n) => ({ ...n, length: Math.min(n.length, b - n.start) }));
        if (c.beats != null) { c.beats = at / spb(); r.beats = r.length / spb(); }
        delete c.pat; delete r.pat;   // the two halves hold different notes now, so they leave the linked pattern
      } else {
        r.offset = (c.offset || 0) + at;
        if (c.takeSrc) r.takeSrc = c.takeSrc.map((x) => (x ? { ...x, offset: (x.offset || 0) + at } : x));
        if (Array.isArray(c.comp)) {
          r.comp = c.comp.filter((x) => x.end > at).map((x) => ({ ...x, start: Math.max(0, x.start - at), end: x.end - at }));
          c.comp = c.comp.filter((x) => x.start < at).map((x) => ({ ...x, end: Math.min(at, x.end) }));
        }
        r.fadeIn = 0; c.fadeOut = 0;
      }
      c.length = at;
      t.clips.splice(t.clips.indexOf(c) + 1, 0, r);
      return r;
    }
    const cutAll = (time) => { for (const t of S.tracks) for (const c of [...t.clips]) cut(t, c, time); };
    const autoLanes = () => [...S.tracks.flatMap((t) => t.automation || []), ...((S.master && S.master.automation) || [])];
    // Every clip, automation point and the loop inside [a, b) moves by d.
    function shiftRange(a, b, d, clips) {
      for (const c of clips) if (c.start >= a - EPS && c.start < b - EPS) c.__d = d;
      for (const lane of autoLanes()) for (const p of lane.points || []) if (p.t >= a - EPS && p.t < b - EPS) p.__d = d;
    }
    function applyShift(clips) {
      for (const c of clips) if (c.__d != null) { c.start += c.__d; delete c.__d; }
      for (const lane of autoLanes()) { for (const p of lane.points || []) if (p.__d != null) { p.t += p.__d; delete p.__d; } lane.points && lane.points.sort((x, y) => x.t - y.t); }
    }
    const allClips = () => S.tracks.flatMap((t) => t.clips);
    const sortClips = () => S.tracks.forEach((t) => t.clips.sort((x, y) => x.start - y.start));

    // moveSection { index, to }: part `index` goes to place `to` (0..n-1) in the song order.
    // cue points (Eman, 31 Oct): Q + 1..9 puts one at the marker, 1..9 alone jumps there
    handlers.setCue = ({ n, time }) => {
      n = String(n); if (!/^[1-9]$/.test(n)) return { error: "Cue points are 1 to 9." };
      S.cues = { ...(S.cues || {}) };
      if (time == null) delete S.cues[n]; else S.cues[n] = Math.max(0, +time || 0);
      changed(); return { ok: true };
    };
    handlers.moveSection = ({ index, to }) => {
      const list = spans(), n = list.length;
      if (!(index >= 0 && index < n) || !(to >= 0 && to < n) || index === to) return { error: "Nothing to move." };
      const beat = S.tracks.find((t) => t.kind === "beat"), beatId = beat && beat.clips[0] && beat.clips[0].id;
      for (const x of list) { cutAll(x.start); cutAll(x.end); }
      const order = list.map((_, i) => i);
      order.splice(to, 0, order.splice(index, 1)[0]);
      let at = list[0].start;
      const clips = allClips(), loop = list.find((x) => Math.abs(x.start - S.loopStart) < 1e-3 && Math.abs(x.end - S.loopEnd) < 1e-3);
      const moved = [];
      for (const i of order) {
        const x = list[i], d = at - x.start;
        shiftRange(x.start, x.end, d, clips);
        moved.push({ name: x.name, start: at, len: x.end - x.start, d, from: x });
        at += x.end - x.start;
      }
      applyShift(clips);
      // the beat's first piece keeps the beat's id (the app reads the beat from its first clip)
      if (beat && beatId) {
        beat.clips.sort((x, y) => x.start - y.start);
        const was = beat.clips.find((c) => c.id === beatId), first = beat.clips[0];
        if (was && first !== was) { was.id = first.id; first.id = beatId; }
      }
      sortClips();
      S.sections = moved.map((m) => ({ name: m.name, start: m.start, ...(m.from.len ? { len: m.from.len } : {}), ...(m.from.color ? { color: m.from.color } : {}) }));
      if (loop) { const m = moved.find((x) => x.from === loop); S.loopStart = m.start; S.loopEnd = m.start + m.len; }
      changed(); return { ok: true };
    };

    // insertSection { at, name, bars, copyOf }: a new part starting at `at` (a part's edge or
    // the song's end). Empty bars, or (copyOf = a part's index) a copy of that part's music.
    handlers.insertSection = ({ at, name, bars, copyOf }) => {
      const list = spans();
      const src = copyOf != null ? list[copyOf] : null;
      const len = src ? src.end - src.start : Math.max(1, bars || 8) * bar();
      cutAll(at);
      const clips = allClips();
      shiftRange(at, Infinity, len, clips);
      applyShift(clips);
      if (src) {
        const a = src.start >= at - EPS ? src.start + len : src.start, b = a + len;   // where the copied part sits now
        cutAll(a); cutAll(b);
        for (const t of S.tracks) {
          for (const c of [...t.clips]) {
            if (c.start < a - EPS || c.start >= b - EPS) continue;
            const k = structuredClone(c);
            k.id = id(); k.start = at + (c.start - a);
            k.plugins = (k.plugins || []).map((p) => ({ ...p, id: id(), autoOf: p.autoOf || p.id }));
            delete k.cmp;
            if (c.kind === "midi") { if (!c.pat) c.pat = c.id; k.pat = c.pat; }   // a copied part's patterns stay linked to the originals
            t.clips.push(k);
          }
        }
      }
      sortClips();
      const secs = (S.sections || []).map((x) => (x.start >= at - EPS ? { ...x, start: x.start + len } : x));
      secs.push({ name: String(name || (src ? src.name : "VERSE")).toUpperCase(), start: at });
      S.sections = secs.sort((x, y) => x.start - y.start);
      if (S.loopStart >= at - EPS) { S.loopStart += len; S.loopEnd += len; }
      changed(); return { ok: true };
    };
  }

  // One click loops the part, but only once it's clear it wasn't the first half of a double-click.
  let loopT = null;
  function loopSoon(i) { clearTimeout(loopT); loopT = setTimeout(() => { loopT = null; loopSection(i); }, 260); }

  // a clean row of colour squares under the part (Eman, 31 Oct): pick one, the part takes it
  const PART_COLOURS = ["#8b5cf0", "#3fb0f0", "#e8b04a", "#e0559e", "#ff8a5c", "#3fd6b0", "#e4ff3a", "#ef5a5a", "#7bd66a", "#5a6cff", "#c084fc", "#a7a4b4"];   // the part colours first, then new ones
  // The colour that is MOST different from every part colour already in the song (Eman, 31 Oct:
  // "not one shade different, a clearly different colour"). Distance = hue apart (degrees) plus a
  // lot for light vs dark, so dark blue next to light blue still counts as different.
  const hsl = (hex) => {
    const n = parseInt(String(hex).replace("#", "").slice(0, 6), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
  };
  const CANDIDATES = ["#8b5cf0", "#3fb0f0", "#e8b04a", "#e0559e", "#3fd6b0", "#e4ff3a", "#ef3a3a", "#5ad65a", "#2f4bff", "#ff7a1a", "#c084fc", "#14b8a6", "#9b1c4a", "#1e3a8a", "#a3e635"];
  function farColour(used) {
    const U = used.map(hsl);
    const dist = (a, b) => { const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h)) * Math.min(1, (a.s + b.s) * 1.5); return dh + Math.abs(a.l - b.l) * 220 + Math.abs(a.s - b.s) * 60; };
    let best = CANDIDATES[0], bestD = -1;
    for (const c of CANDIDATES) { const x = hsl(c), d = U.length ? Math.min(...U.map((u) => dist(x, u))) : 999; if (d > bestD) { bestD = d; best = c; } }
    return best;
  }
  function colourPop(node, i) {
    document.querySelectorAll(".k2-secpop").forEach((x) => x.remove());
    const r = node.getBoundingClientRect(), pop = el("div", "k2-secpop");
    pop.style.left = Math.max(8, r.left) + "px"; pop.style.top = r.bottom + 4 + "px";
    const me = (ui.state.sections || [])[i] || {}, cur = me.color || sectionColor(me.name);
    for (const c of PART_COLOURS) {
      const sw = el("button", "k2-secsw" + (cur === c ? " on" : ""));
      sw.style.background = c; sw.title = "Colour this part";
      sw.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
      sw.onclick = (e) => { e.stopPropagation(); close(); editSections((l) => { if (l[i]) l[i].color = c; }); };
      pop.append(sw);
    }
    // the last dot: any colour (the system picker)
    const any = el("label", "k2-secsw k2-secany"), inp = el("input");
    any.title = "Any colour";
    inp.type = "color"; inp.value = cur && /^#[0-9a-f]{6}$/i.test(cur) ? cur : "#b79cff";
    inp.addEventListener("mousedown", (e) => e.stopPropagation());
    inp.onchange = () => { const c = inp.value; close(); editSections((l) => { if (l[i]) l[i].color = c; }); };
    any.append(inp); pop.append(any);
    document.body.append(pop);
    const away = (e) => { if (!pop.contains(e.target)) close(); };
    const key = (e) => { if (e.key === "Escape" || e.key === "Enter") close(); };
    function close() { pop.remove(); document.removeEventListener("mousedown", away, true); window.removeEventListener("keydown", key, true); }
    setTimeout(() => { document.addEventListener("mousedown", away, true); window.addEventListener("keydown", key, true); }, 0);
  }

  // ------------------------------------------------------------------ page
  function start() {
    // double-click an empty spot of the parts line: a new 16-bar part from the nearest bar (Eman, 31 Oct)
    document.addEventListener("dblclick", (e) => {
      const box = $("sections");
      if (!box || e.target !== box || !ui.state) return;
      e.preventDefault(); e.stopPropagation();
      const bar = secPerBar(), at = Math.max(0, Math.round(toSec(e.clientX - box.getBoundingClientRect().left) / bar) * bar);
      if ((ui.state.sections || []).some((x) => Math.abs(x.start - at) < 1e-3)) return toast("There's already a part starting on that bar.");
      const used = new Set((ui.state.sections || []).map((x) => (x.color || sectionColor(x.name)).toLowerCase()));
      const colour = farColour([...used]);
      editSections((l) => l.push({ name: "PART", start: at, len: 16 * bar, color: colour })).then(() => {
        const i = (ui.state.sections || []).findIndex((x) => Math.abs(x.start - at) < 1e-3);
        const n = document.querySelector(`#sections .section[data-index="${i}"]`);
        if (n) n.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));   // name it and pick a colour right away
      });
    }, true);
    const _renderSections = renderSections;
    window.renderSections = renderSections = function () {
      _renderSections.apply(this, arguments);
      decorate();
    };
    if (ui.state) render();
  }

  function decorate() {
    const box = $("sections"), list = (ui.state && ui.state.sections) || [];
    if (!box || !list.length) return;
    box.querySelectorAll(".section").forEach((b) => {
      const i = +b.dataset.index, hs = b.querySelectorAll(".sec-h");
      b.title = "Click: loop it  ·  Drag: move this part (everything under it goes along)  ·  Edges: resize  ·  Double-click: rename";
      if (hs[0]) { hs[0].classList.add("k2-edge"); hs[0].title = "Drag: where this part starts"; hs[0].addEventListener("mousedown", (e) => edgeDrag(e, i, "start", b)); }
      if (hs[1]) { hs[1].classList.add("k2-edge"); hs[1].title = "Drag: where this part ends"; hs[1].addEventListener("mousedown", (e) => edgeDrag(e, i, "end", b)); }
      b.addEventListener("mousedown", (e) => blockDrag(e, i, b), true);
      // double-click: rename + a colour row, and the loop from the first click never starts (Eman, 31 Oct)
      const dbl = b.ondblclick;
      b.ondblclick = (e) => { clearTimeout(loopT); loopT = null; if (dbl) dbl.call(b, e); colourPop(b, i); };
    });
    // "+" at each edge between parts: parked (Eman, 31 Oct: the + button on the right is enough)
    if (window.SHOW_SECTION_EDGE_PLUS) list.forEach((sec, i) => {
      const p = el("button", "k2-secadd", "+");
      p.style.left = toX(sec.end) - 9 + "px";
      p.title = i + 1 < list.length ? "Add a part here (everything after moves later)" : "Add a part at the end";
      p.addEventListener("mousedown", (e) => e.stopPropagation());
      p.onclick = (e) => { e.stopPropagation(); addMenu(p, sec.end, i); };
      box.append(p);
    });
  }

  // edges (Eman, 31 Oct: a part only gets bigger when you drag its edges). A part keeps its own
  // length (len), so moving it leaves a gap instead of stretching its neighbour. An edge that touches
  // the next part moves the border between them; an edge next to a gap just resizes this part.
  function edgeDrag(e, i, side, node) {
    if (e.button !== 0 || !node) return;
    e.stopPropagation(); e.preventDefault();
    const list = ui.state.sections, sec = list[i], prev = list[i - 1], next = list[i + 1], beat = secPerBeat();
    const box = $("sections"), nodeOf = (k) => box.querySelector(`.section[data-index="${k}"]`);
    const adjPrev = prev && Math.abs(prev.end - sec.start) < 1e-3, adjNext = next && Math.abs(sec.end - next.start) < 1e-3;
    let lo, hi, from;
    if (side === "start") { lo = prev ? (adjPrev ? prev.start + beat : prev.end) : 0; hi = sec.end - beat; from = sec.start; }
    else if (adjNext) { lo = sec.start + beat; hi = next.end - beat; from = sec.end; }
    else { lo = sec.start + beat; hi = next ? next.start : Infinity; from = sec.end; }
    const x0 = e.clientX;
    let moved = false, v = from;
    const width = (n, a, b) => { if (n) n.style.width = Math.max(10, toX(b - a)) + "px"; };
    const move = (ev) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true; node.classList.add("dragging");
      v = Math.min(hi, Math.max(lo, snapBeat(from + dx / ui.pxPerSec)));
      if (side === "start") { node.style.left = toX(v) + "px"; width(node, v, sec.end); if (adjPrev) width(nodeOf(i - 1), prev.start, v); }
      else { width(node, sec.start, v); if (adjNext) { const n = nodeOf(i + 1); if (n) n.style.left = toX(v) + "px"; width(n, v, next.end); } }
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      node.classList.remove("dragging");
      if (!moved) return loopSoon(i);
      if (Math.abs(v - from) < 1e-6) return render();
      editSections((l) => {
        if (side === "start") { l[i].start = v; l[i].len = sec.end - v; if (adjPrev) delete l[i - 1].len; }
        else if (adjNext) { l[i + 1].start = v; l[i + 1].len = next.end - v; delete l[i].len; }
        else l[i].len = v - sec.start;
      });
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  // the block: click loops (app.js), drag moves the part to another place in the song
  // a part you clicked is picked: Delete / Backspace takes it out (only the label; the music stays) (Eman, 31 Oct)
  let picked = null;
  document.addEventListener("mousedown", (e) => { if (!e.target.closest || !e.target.closest("#sections .section")) picked = null; }, true);
  window.addEventListener("keydown", (e) => {
    if (picked == null || (e.key !== "Delete" && e.key !== "Backspace")) return;
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
    const list = (ui.state && ui.state.sections) || [], sec = list[picked];
    if (!sec) { picked = null; return; }
    e.preventDefault(); e.stopImmediatePropagation();
    const i = picked; picked = null;
    if (ui.transport && ui.transport.looping) { ui.transport.looping = false; run("setLooping", { on: false }); }
    editSections((l) => l.splice(i, 1)).then(() => toast(`Took out ${sec.name}. The music stays. Cmd+Z brings it back.`));
  }, true);

  function blockDrag(e, i, b) {
    if (e.button !== 0 || e.target.closest(".sec-h") || e.target.tagName === "INPUT") return;
    picked = i;
    if (e.detail === 2) { e.stopImmediatePropagation(); clearTimeout(loopT); loopT = null; return; }   // the double-click renames (and never loops)
    e.stopImmediatePropagation(); e.preventDefault();
    const box = $("sections"), list = ui.state.sections, x0 = e.clientX, r0 = b.getBoundingClientRect(), bx = box.getBoundingClientRect();
    let moved = false, to = i, line = null;
    const slots = () => list.map((s) => toX(s.start));   // where each part starts now
    let lastX = x0;
    // where the block lands when it slides (not over another part): on the grid, between its neighbours,
    // and pulled flush against the part before or after when it comes within ~14 px of it (Eman, 31 Oct)
    const slideTo = (px) => {
      const sp = 60 / ui.state.bpm, sec = list[i], L = sec.end - sec.start, pull = 14 / ui.pxPerSec;
      const lo = i > 0 ? list[i - 1].start + sp : 0, hi = i + 1 < list.length ? list[i + 1].start - L : Infinity;
      let ns = snapGrid(sec.start + px / ui.pxPerSec);
      const raw = sec.start + px / ui.pxPerSec;
      if (i > 0 && Math.abs(raw - list[i - 1].end) < pull) ns = list[i - 1].end;
      if (i + 1 < list.length && Math.abs(raw + L - list[i + 1].start) < pull) ns = list[i + 1].start - L;
      return Math.max(lo, Math.min(hi, ns));
    };
    const move = (ev) => {
      const dx = ev.clientX - x0;
      lastX = ev.clientX;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) { moved = true; b.classList.add("k2-lift"); line = el("i", "k2-secline"); box.append(line); }
      b.style.transform = `translateX(${dx}px)`;
      // the place it would go: the slot whose start is nearest the block's left edge
      const left = r0.left - bx.left + dx, xs = slots();
      let best = 0;
      xs.forEach((x, k) => { if (Math.abs(x - left) < Math.abs(xs[best] - left)) best = k; });
      to = best;
      const lx = to > i ? (list[to].end != null ? toX(list[to].end) : xs[to]) : xs[to];
      line.style.left = lx - 1 + "px";
      line.hidden = to === i;
      if (to === i) b.style.transform = `translateX(${toX(slideTo(dx) - list[i].start)}px)`;   // show where it will land
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      if (!moved) return loopSoon(i);
      b.classList.remove("k2-lift"); b.style.transform = ""; if (line) line.remove();
      if (to === i) {
        // not over another part: the block itself slides to where it was let go (Eman, 31 Oct: "move it
        // wherever"). Only the label moves; the music stays. It snaps to the grid, between its neighbours.
        // It keeps its length, and so does the part before it: a gap stays a gap (Eman, 31 Oct).
        const sec = list[i], L = sec.end - sec.start, ns = slideTo(lastX - x0);
        if (Math.abs(ns - sec.start) > 1e-6) editSections((l) => { l[i].start = ns; l[i].len = L; if (i > 0) l[i - 1].len = list[i - 1].end - list[i - 1].start; });
        return;
      }
      const name = list[i].name;
      run("moveSection", { index: i, to }).then((r) => r && r.ok && toast(`Moved ${name}. Everything under it went along. Cmd+Z puts it back.`));
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  function addMenu(anchor, at, i) {
    const list = ui.state.sections, prev = list[i];
    const verses = list.filter((x) => /^VERSE/.test(x.name)).length;
    const names = ["INTRO", "VERSE", "PRE", "HOOK", "BRIDGE", "OUTRO"];
    showMenu(anchor, [
      { heading: `New part at bar ${barAt(at)}` },
      { label: `Copy of ${prev.name}`, meta: "music too", run: () => run("insertSection", { at, copyOf: i, name: prev.name }).then((r) => r && r.ok && toast(`${prev.name} again after itself. Cmd+Z takes it out.`)) },
      { sep: true },
      ...names.map((n) => {
        const nm = n === "VERSE" ? `VERSE ${verses + 1}` : n;
        return { label: nm, meta: "8 empty bars", run: () => run("insertSection", { at, name: nm, bars: 8 }).then((r) => r && r.ok && toast(`Added ${nm}: 8 empty bars, everything after moved later.`)) };
      }),
    ]);
  }

  if (document.documentElement.classList.contains("kt2")) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
  return { demo };
})();
