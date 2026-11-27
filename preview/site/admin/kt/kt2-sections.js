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
  // Where things go when the part [a, b) is lifted out and dropped in at `at` (dropSection, and the drag's
  // live preview). Like picking up a block: where it was stays an empty gap; everything from `at` on moves
  // later by its length. map(t) = new time of anything outside the part; at1 = where the part itself starts.
  // (KT2_PART_DROP_CLOSE = the song also closes up behind it.)
  function dropMap(a, b, at) {
    const L = b - a, close = (t) => (window.KT2_PART_DROP_CLOSE && t >= b - EPS ? t - L : t), at1 = close(at);
    return { at1, map: (t) => { const t1 = close(t); return t1 >= at1 - EPS ? t1 + L : t1; } };
  }

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
        // (deep debug 16 Nov: a note a hair before the cut landed at a tiny negative time in the right half; it now starts at 0. KT2_CUT_CLAMP_OLD = old)
        r.notes = (c.notes || []).filter((n) => n.start >= b - EPS).map((n) => ({ ...n, start: window.KT2_CUT_CLAMP_OLD ? n.start - b : Math.max(0, n.start - b) }));
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
    // TEMPO lane dots (S.tempo, in beats) go along with their part too (stress test 11 Nov: inserting a part or moving
    // the HOOK left its tempo change behind, so the song sped up in the wrong place). KT2_TEMPO_SECTIONS_OLD = old.
    const tempoPts = () => (window.KT2_TEMPO_SECTIONS_OLD || !Array.isArray(S.tempo) ? [] : S.tempo);
    function shiftRange(a, b, d, clips) {
      for (const c of clips) if (c.start >= a - EPS && c.start < b - EPS) c.__d = d;
      for (const lane of autoLanes()) for (const p of lane.points || []) if (p.t >= a - EPS && p.t < b - EPS) p.__d = d;
      for (const q of tempoPts()) { const t = q.beat * spb(); if (t >= a - EPS && t < b - EPS) q.__d = d; }
    }
    function applyShift(clips) {
      for (const c of clips) if (c.__d != null) { c.start += c.__d; delete c.__d; }
      for (const lane of autoLanes()) { for (const p of lane.points || []) if (p.__d != null) { p.t += p.__d; delete p.__d; } lane.points && lane.points.sort((x, y) => x.t - y.t); }
      const tp = tempoPts();
      if (tp.some((q) => q.__d != null)) {
        S.tempo = tp.map((q) => { const o = { ...q }; if (o.__d != null) o.beat = Math.round((o.beat + o.__d / spb()) * 1000) / 1000; delete o.__d; return o; })
          .filter((q) => q.beat > 0).sort((x, y) => x.beat - y.beat).filter((q, i, l) => i === l.length - 1 || l[i + 1].beat - q.beat > EPS);
      }
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

    // slideSection { index, start }: part `index` slides to `start` and takes everything under it along
    // (clips, automation, tempo dots, the loop). Eman, 12 Nov: "if I take PART 1 and move it, all the
    // footage below should move with it". KT2_PART_DRAG_OLD = the old way (only the label slid).
    handlers.slideSection = ({ index, start }) => {
      const list = spans(), x = list[index];
      if (!x || !(start >= 0)) return { error: "Nothing to move." };
      const d = start - x.start;
      if (Math.abs(d) < EPS) return { error: "Nothing to move." };
      const beat = S.tracks.find((t) => t.kind === "beat"), beatId = beat && beat.clips[0] && beat.clips[0].id;
      cutAll(x.start); cutAll(x.end);
      const clips = allClips();
      shiftRange(x.start, x.end, d, clips);
      // replace (Eman, 23 Nov clip 8: "replace whatever is under if you drag it on top of something"): on every lane
      // the part carries music in, what already sits where it lands is cut away, so nothing overlaps.
      // KT2_PART_REPLACE_OLD = the moved music lands on top of what is there.
      if (!window.KT2_PART_REPLACE_OLD) {
        const a = start, b = start + (x.end - x.start);
        for (const t of S.tracks) {
          if (!t.clips.some((c) => c.__d != null)) continue;
          for (const c of [...t.clips]) if (c.__d == null) { cut(t, c, a); }
          for (const c of [...t.clips]) if (c.__d == null) { cut(t, c, b); }
          t.clips = t.clips.filter((c) => c.__d != null || !(c.start >= a - EPS && c.start < b - EPS));
          for (const lane of t.automation || []) {
            if (!(lane.points || []).some((p) => p.__d != null)) continue;
            lane.points = lane.points.filter((p) => p.__d != null || !(p.t >= a - EPS && p.t < b - EPS));
          }
        }
      }
      const clips2 = window.KT2_PART_REPLACE_OLD ? clips : allClips();
      for (const c of clips) if (c.__d != null && !clips2.includes(c)) delete c.__d;
      applyShift(clips2);
      if (beat && beatId) {
        beat.clips.sort((p, q) => p.start - q.start);
        const was = beat.clips.find((c) => c.id === beatId), first = beat.clips[0];
        if (was && first !== was) { was.id = first.id; first.id = beatId; }
        else if (!was && first && !window.KT2_PART_REPLACE_OLD) first.id = beatId;
      }
      sortClips();
      const L = x.end - x.start;
      S.sections = list.map((y, k) => {
        const o = { name: y.name, start: k === index ? start : y.start };
        if (k === index || (k === index - 1)) o.len = y.end - y.start; else if (y.len) o.len = y.len;   // a gap stays a gap
        if (y.color) o.color = y.color;
        return o;
      }).sort((p, q) => p.start - q.start);
      if (Math.abs(x.start - S.loopStart) < 1e-3 && Math.abs(x.end - S.loopEnd) < 1e-3) { S.loopStart = start; S.loopEnd = start + L; }
      changed(); return { ok: true };
    };

    // dropSection { index, at }: part `index` is lifted out (its old spot stays a gap) and dropped in at
    // `at` (song seconds): everything from `at` on moves later to make room. If `at`
    // is inside another part, that part is cut in two there; both pieces keep its name and colour (Eman, 14 Nov).
    handlers.dropSection = ({ index, at }) => {
      const list = spans(), x = list[index];
      if (!x || !(at >= 0)) return { error: "Nothing to move." };
      if (at >= x.start - EPS && at <= x.end + EPS) return { error: "Nothing to move." };
      const L = x.end - x.start, m = dropMap(x.start, x.end, at);
      const beat = S.tracks.find((t) => t.kind === "beat"), beatId = beat && beat.clips[0] && beat.clips[0].id;
      cutAll(x.start); cutAll(x.end); cutAll(at);
      const clips = allClips(), inX = (t) => t >= x.start - EPS && t < x.end - EPS;
      const f = (t) => (inX(t) ? m.at1 + (t - x.start) : m.map(t));
      for (const c of clips) { const d = f(c.start) - c.start; if (Math.abs(d) > EPS) c.__d = d; }
      for (const lane of autoLanes()) for (const p of lane.points || []) { const d = f(p.t) - p.t; if (Math.abs(d) > EPS) p.__d = d; }
      for (const q of tempoPts()) { const t = q.beat * spb(), d = f(t) - t; if (Math.abs(d) > EPS) q.__d = d; }
      applyShift(clips);
      if (beat && beatId) {
        beat.clips.sort((p, q) => p.start - q.start);
        const was = beat.clips.find((c) => c.id === beatId), first = beat.clips[0];
        if (was && first !== was) { was.id = first.id; first.id = beatId; }
      }
      sortClips();
      const out = [];
      list.forEach((y, k) => {
        const keep = (o, a, b, last) => { if (y.color) o.color = y.color; if (!last || y.len) o.len = b - a; return o; };
        const last = k === list.length - 1;
        if (k === index) return out.push(keep({ name: y.name, start: m.at1 }, 0, L, false));
        if (at > y.start + EPS && at < y.end - EPS) {   // the cut: two pieces, same name + colour
          out.push(keep({ name: y.name, start: m.map(y.start) }, y.start, at, false));
          out.push(keep({ name: y.name, start: m.map(at) }, at, y.end, last));
          return;
        }
        out.push(keep({ name: y.name, start: m.map(y.start) }, y.start, y.end, last));
      });
      S.sections = out.sort((p, q) => p.start - q.start);
      if (Math.abs(x.start - S.loopStart) < 1e-3 && Math.abs(x.end - S.loopEnd) < 1e-3) { S.loopStart = m.at1; S.loopEnd = m.at1 + L; }
      else if (S.loopEnd > S.loopStart) { S.loopStart = m.map(S.loopStart); S.loopEnd = Math.max(S.loopStart + EPS, m.map(S.loopEnd)); }
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
    if (!window.KT2_PARTS_EMPTY_OLD) emptyLane();
    const _renderSections = renderSections;
    window.renderSections = renderSections = function () {
      _renderSections.apply(this, arguments);
      const box = $("sections");
      if (box && !window.KT2_PARTS_EMPTY_OLD) {
        box.classList.toggle("k2-secempty", !((ui.state && ui.state.sections) || []).length);
        if (ui.state && ui.pxPerSec) box.style.setProperty("--k2-barpx", secPerBar() * ui.pxPerSec + "px");
      }
      decorate();
    };
    if (ui.state) render();
  }

  // The parts line reads as its own lane (Eman, 12 Nov: empty, it melted into the bar ruler below).
  // Empty: a faint dashed slot. Hovering any free spot shows a ghost part on the bar under the mouse;
  // drag there to draw a part from bar to bar (a click alone does nothing; double-click still makes 16 bars).
  // KT2_PARTS_EMPTY_OLD = the old flat strip, no ghost, no drag.
  function emptyLane() {
    let ghost = null, drawing = false;
    const free = (t) => t && (t.id === "sections" || (t.classList && t.classList.contains("sections-hint")));
    const spanAt = (box, x) => {   // the free gap around song second x: [lo, hi]
      const list = (ui.state && ui.state.sections) || [];
      let lo = 0, hi = Infinity;
      for (const s of list) { const end = s.end != null ? s.end : s.start + (s.len > 0 ? s.len : 1e9); if (end <= x + 1e-6) lo = Math.max(lo, end); else if (s.start >= x - 1e-6) hi = Math.min(hi, s.start); }
      return [lo, hi];
    };
    const place = (box, a, b) => {
      if (!ghost || ghost.parentNode !== box) { ghost = el("div", "k2-secdraw"); box.append(ghost); }
      ghost.style.left = toX(a) + "px"; ghost.style.width = Math.max(6, toX(b) - toX(a)) + "px";
    };
    const hide = () => { if (ghost) ghost.remove(); ghost = null; };
    document.addEventListener("mousemove", (e) => {
      if (drawing) return;
      const box = $("sections");
      if (!box || !ui.state || !free(e.target) || document.documentElement.classList.contains("k2-inside")) return hide();
      const bar = secPerBar(), x = toSec(e.clientX - box.getBoundingClientRect().left), [lo, hi] = spanAt(box, x);
      const a = Math.max(lo, Math.floor(x / bar) * bar), b = Math.min(hi, a + bar);
      if (b - a < 1e-3) return hide();
      place(box, a, b);
    }, true);
    document.addEventListener("mouseleave", hide);
    document.addEventListener("mousedown", (e) => {
      const box = $("sections");
      if (e.button !== 0 || e.detail > 1 || e.shiftKey || !box || !ui.state || !free(e.target)) return;
      e.preventDefault();
      const bar = secPerBar(), left = box.getBoundingClientRect().left, x0 = toSec(e.clientX - left), [lo, hi] = spanAt(box, x0);
      const from = Math.max(lo, Math.floor(x0 / bar) * bar), cx = e.clientX;
      let a = from, b = Math.min(hi, from + bar), moved = false;
      drawing = true;
      const move = (ev) => {
        if (!moved && Math.abs(ev.clientX - cx) < 4) return;
        moved = true; box.classList.add("k2-secdrawing");
        const x = toSec(ev.clientX - left);
        if (x >= from) { a = from; b = Math.min(hi, Math.max(from + bar, Math.ceil(x / bar) * bar)); }
        else { a = Math.max(lo, Math.floor(x / bar) * bar); b = Math.min(hi, from + bar); }
        place(box, a, b);
        if (ghost) ghost.dataset.bars = Math.round((b - a) / bar);
      };
      const up = () => {
        window.removeEventListener("mousemove", move, true); window.removeEventListener("mouseup", up, true);
        drawing = false; box.classList.remove("k2-secdrawing");
        if (ghost) delete ghost.dataset.bars;
        if (!moved || b - a < bar - 1e-3) return;
        hide();
        const used = new Set((ui.state.sections || []).map((s) => (s.color || sectionColor(s.name)).toLowerCase()));
        editSections((l) => l.push({ name: "PART", start: a, len: b - a, color: farColour([...used]) })).then(() => {
          const i = (ui.state.sections || []).findIndex((s) => Math.abs(s.start - a) < 1e-3);
          const n = document.querySelector(`#sections .section[data-index="${i}"]`);
          if (n) n.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));   // name it and pick a colour right away
        });
      };
      window.addEventListener("mousemove", move, true); window.addEventListener("mouseup", up, true);
    }, true);
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
      if (!window.KT2_PART_DRAG_OLD && !window.KT2_PART_DRAG2_OFF && !window.KT2_PART_GRIP_OFF) addGrip(b);
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

  // The move grip (Eman, 14 Nov): an icon in the middle of each part bar. Drag the grip = the whole part with
  // its music (partDrag2). Drag anywhere else on the bar = only the marker moves, the song stays put.
  // A bar too narrow for the middle puts the grip before the name. KT2_PART_GRIP_OFF = no grip, the whole bar
  // moves the music (v395).
  const GRIP_SVG = '<svg viewBox="0 0 22 12" width="22" height="12" aria-hidden="true">' +
    '<path d="M0 6 L4 2.5 V9.5 Z M22 6 L18 2.5 V9.5 Z" fill="currentColor"/>' +
    '<g fill="currentColor"><rect x="7" y="2" width="2" height="2"/><rect x="10" y="2" width="2" height="2"/><rect x="13" y="2" width="2" height="2"/>' +
    '<rect x="7" y="5" width="2" height="2"/><rect x="10" y="5" width="2" height="2"/><rect x="13" y="5" width="2" height="2"/>' +
    '<rect x="7" y="8" width="2" height="2"/><rect x="10" y="8" width="2" height="2"/><rect x="13" y="8" width="2" height="2"/></g></svg>';
  function addGrip(b) {
    if (b.querySelector(".k2-secgrip")) return;
    const g = el("span", "k2-secgrip");
    g.innerHTML = GRIP_SVG;
    g.title = "Drag: move the part with its music";
    b.title = "Click: loop it  \u00B7  Drag: move the marker  \u00B7  Edges: resize  \u00B7  Double-click: rename";
    const lb = b.querySelector(".lbl");
    b.insertBefore(g, lb ? lb.nextSibling : b.lastChild);   // the last .sec-h must stay :last-child (right edge)
    const w = b.getBoundingClientRect().width || parseFloat(b.style.width) || 0;
    const lbl = b.querySelector(".lbl"), lw = (() => { if (!lbl) return 60; const r = document.createRange(); r.selectNodeContents(lbl); return r.getBoundingClientRect().width || 60; })();
    b.classList.toggle("k2-grip-front", w < lw * 2 + 60);
    if (b.classList.contains("k2-grip-front") && w < 34) g.remove();
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
    if (!window.KT2_PART_DRAG_OLD) return partDrag(e, i, b);
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

  // Drag a part (Eman, 12 Nov: "like we had it before"). Everything under it goes along.
  //   pointer over another part  -> it goes in before (left half) or after (right half) that part,
  //                                 the others shift to make room (moveSection, the yellow line shows where)
  //   anywhere else              -> it slides there on the grid with all its music (slideSection),
  //                                 between its neighbours, pulled flush when close to one
  // KT2_PART_DRAG_OLD = the old way (a free slide moved only the label, the slot nearest the left edge reordered).
  function partDrag(e, i, b) {
    if (!window.KT2_PART_DRAG2_OFF) return partDrag2(e, i, b);
    const box = $("sections"), list = ui.state.sections, x0 = e.clientX, bx = box.getBoundingClientRect();
    const sec = list[i], L = sec.end - sec.start, sp = 60 / ui.state.bpm, pull = 14 / ui.pxPerSec;
    let moved = false, to = i, line = null, dxNow = 0;
    const slideTo = (px) => {
      const lo = i > 0 ? list[i - 1].end : 0, hi = i + 1 < list.length ? list[i + 1].start - L : Infinity;
      const raw = sec.start + px / ui.pxPerSec;
      let ns = snapGrid(raw);
      if (i > 0 && Math.abs(raw - list[i - 1].end) < pull) ns = list[i - 1].end;
      if (i + 1 < list.length && Math.abs(raw + L - list[i + 1].start) < pull) ns = list[i + 1].start - L;
      return Math.max(Math.max(0, lo), Math.min(hi, ns));
    };
    // which other part the pointer is over, and on which half
    const target = (cx) => {
      for (let k = 0; k < list.length; k++) {
        if (k === i) continue;
        const a = toX(list[k].start), z = toX(list[k].end), x = cx - bx.left;
        if (x >= a && x < z) return { k, after: x >= (a + z) / 2, lx: x >= (a + z) / 2 ? z : a };
      }
      return null;
    };
    const move = (ev) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) { moved = true; b.classList.add("k2-lift"); line = el("i", "k2-secline"); box.append(line); }
      dxNow = dx;
      const hit = target(ev.clientX);
      if (hit) {
        to = hit.after ? (hit.k < i ? hit.k + 1 : hit.k) : (hit.k < i ? hit.k : hit.k - 1);
        line.style.left = hit.lx - 1 + "px"; line.hidden = false;
        b.style.transform = `translateX(${dx}px)`;
      } else {
        to = i; line.hidden = true;
        b.style.transform = `translateX(${toX(slideTo(dx)) - toX(sec.start)}px)`;   // shows where it will land
      }
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      if (!moved) return loopSoon(i);
      b.classList.remove("k2-lift"); if (line) line.remove();
      const name = sec.name;
      if (to !== i) {
        b.style.transform = "";
        return run("moveSection", { index: i, to }).then((r) => r && r.ok && toast(`Moved ${name}. Everything under it went along. Cmd+Z puts it back.`));
      }
      const ns = slideTo(dxNow);
      if (Math.abs(ns - sec.start) < 1e-6) { b.style.transform = ""; return; }
      run("slideSection", { index: i, start: ns }).then((r) => {
        b.style.transform = "";
        if (r && r.ok) toast(`Moved ${name} to bar ${barAt(ns)}. Everything under it went along. Cmd+Z puts it back.`);
      });
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  // Physical part drag (Eman, 14 Nov: "the grid underneath should be stuck to it ... it will snap to the end or
  // the beginning of a part ... drop it in the middle of another marker and it cuts that one in two").
  //   The block, a slab of grid the size of the part and every clip under it lift and stay stuck to the mouse.
  //   A yellow frame shows where it lands. Start or end pulls onto other parts' edges (16 px).
  //   Free spot (no overlap)   -> slides there with its music (slideSection), a gap stays a gap.
  //   Overlapping other parts  -> it is dropped in there (dropSection): the song opens up where it lands (the
  //                               others glide later to show it), its old spot stays a gap. Landing inside a part cuts
  //                               that part in two (both pieces keep its colour).
  //   Esc cancels. KT2_PART_DRAG2_OFF = the 12 Nov drag (partDrag).
  function partDrag2(e, i, b) {
    const box = $("sections"), rows = $("rows"), ph = $("playhead"), host = (ph && ph.offsetParent) || $("inner");
    const list = ui.state.sections, sec = list[i], L = sec.end - sec.start, pps = ui.pxPerSec, x0 = e.clientX, pull = 16 / pps;
    const others = list.map((s, k) => ({ s, k })).filter((o) => o.k !== i);
    // marker only (Eman, 14 Nov): grabbed anywhere but the grip, only the marker moves and the music stays
    const solo = !window.KT2_PART_GRIP_OFF && !!b.querySelector(".k2-secgrip") && !(e.target.closest && e.target.closest(".k2-secgrip"));
    const edges = others.flatMap((o) => [o.s.start, o.s.end]);
    const nodeOf = (k) => box.querySelector(`.section[data-index="${k}"]`);
    const clips = [];
    if (!solo) for (const t of ui.state.tracks || []) for (const c of t.clips || []) {
      const n = document.querySelector(`#rows .clip[data-clip-id="${CSS.escape(String(c.id))}"]`);
      if (n) clips.push({ c, n, tid: t.id, carry: c.start >= sec.start - EPS && c.start < sec.end - EPS, end: c.start + (c.length || 0) });
    }
    const carryT = new Set(clips.filter((x) => x.carry).map((x) => x.tid));
    let moved = false, plan = null, dxNow = 0, slab = null, hole = null, land = null, landSec = null, gone = false;
    const temp = [];   // clones made for the preview
    const ov = (cls, a, w) => {
      const d = el("div", cls), top = rows ? rows.offsetTop : 0, h = rows ? rows.offsetHeight : 0;
      d.style.left = rulerLeft() + toX(a) + "px"; d.style.width = Math.max(2, toX(w)) + "px";
      d.style.top = top + "px"; d.style.height = h + "px";
      host.append(d); return d;
    };
    const plan2 = (dx) => {
      const raw = sec.start + dx / pps;
      let t = null, snap = null, bd = pull;
      for (const ed of edges) {
        const ds = Math.abs(raw - ed), de = Math.abs(raw + L - ed);
        if (ds < bd) { bd = ds; t = ed; snap = ed; }
        if (de < bd && ed - L >= -EPS) { bd = de; t = ed - L; snap = ed; }
      }
      if (t == null) t = Math.max(0, snapGrid(raw));
      const at = snap != null ? snap : t;
      const over = others.some((o) => t < o.s.end - EPS && t + L > o.s.start + EPS);
      if (!over) return { mode: "slide", t, snap };
      if (solo) {   // a marker alone never lands on another one: the nearest free spot it fits in
        const os = others.map((o) => o.s).sort((p, q) => p.start - q.start), gaps = [];
        let a = 0;
        for (const o of os) { gaps.push([a, o.start]); a = Math.max(a, o.end); }
        gaps.push([a, Infinity]);
        let best = null;
        for (const g of gaps) {
          if (g[1] - g[0] < L - EPS) continue;
          const tt = Math.max(g[0], Math.min(g[1] - L, t));
          if (best == null || Math.abs(tt - t) < Math.abs(best - t)) best = tt;
        }
        return best == null ? { mode: "none", t: sec.start, snap: null } : { mode: "slide", t: best, snap: Math.abs(best - t) > EPS ? best : snap };
      }
      if (at >= sec.start - EPS && at <= sec.end + EPS) return { mode: "none", t: sec.start, snap: null };
      const cut = others.find((o) => at > o.s.start + EPS && at < o.s.end - EPS);
      return { mode: "drop", at, cut: cut ? cut.k : -1, snap, m: dropMap(sec.start, sec.end, at) };
    };
    const clearPreview = () => {
      while (temp.length) temp.pop().remove();
      for (const o of others) { const n = nodeOf(o.k); if (n) { n.style.transform = ""; n.classList.remove("k2-pd-torn"); if (n.dataset.pdW) { n.style.width = n.dataset.pdW; delete n.dataset.pdW; } } }
      for (const x of clips) if (!x.carry) { x.n.style.transform = ""; x.n.style.clipPath = ""; x.n.classList.remove("k2-pd-gone", "k2-pd-trim"); }
    };
    const paint = (dx, p) => {
      b.style.transform = `translateX(${dx}px) translateY(-2px)`;
      slab.style.transform = `translateX(${dx}px)`;
      for (const x of clips) if (x.carry) x.n.style.transform = `translateX(${dx}px) translateY(-3px)`;
      clearPreview();
      const lt = p.mode === "drop" ? p.m.at1 : p.t;
      for (const n of [land, landSec]) {
        n.style.left = (n === land ? rulerLeft() : 0) + toX(lt) + "px";
        n.classList.toggle("k2-pd-snapped", p.snap != null);
        n.classList.toggle("k2-pd-cutting", p.mode === "drop" && p.cut >= 0);
        n.hidden = p.mode === "none" || (solo && n === land);   // a marker alone: the song stays, no frame over it
      }
      hole.style.transform = "";
      // live replace preview (Eman, 23 Nov clip 8: "I should see it so I know that if I place it here it will replace it"):
      // what sits where the part would land is shown cut back right away. KT2_PART_REPLACE_OLD = no preview.
      if (p.mode === "slide" && !solo && !window.KT2_PART_REPLACE_OLD) {
        const a = p.t, z = p.t + L;
        for (const x of clips) {
          if (x.carry || !carryT.has(x.tid) || x.end <= a + EPS || x.c.start >= z - EPS) continue;
          const head = x.c.start < a - EPS ? toX(a - x.c.start) : 0, tail = x.end > z + EPS ? toX(x.end - z) : 0;
          if (!head && !tail) { x.n.style.clipPath = "inset(0 100% 0 0)"; x.n.classList.add("k2-pd-gone"); continue; }
          x.n.classList.add("k2-pd-trim");
          if (head) x.n.style.clipPath = `inset(0 calc(100% - ${head}px) 0 0)`;
          else x.n.style.clipPath = `inset(0 0 0 calc(100% - ${tail}px))`;
          if (head && tail) {   // the part lands in the middle of it: the end piece stays after the part
            const r = x.n.cloneNode(true);
            r.classList.add("k2-pd-piece"); r.classList.remove("k2-pd-trim");
            r.removeAttribute("data-clip-id");
            r.style.clipPath = `inset(0 0 0 calc(100% - ${tail}px))`;
            r.style.pointerEvents = "none";
            x.n.parentNode.append(r); temp.push(r);
          }
        }
      }
      if (p.mode !== "drop") return;
      const m = p.m, gap = typeof SEC_GAP === "function" ? SEC_GAP() : 0;
      hole.style.transform = `translateX(${toX(m.map(sec.start)) - toX(sec.start)}px)`;
      for (const o of others) {
        const n = nodeOf(o.k);
        if (!n) continue;
        n.style.transform = `translateX(${toX(m.map(o.s.start)) - toX(o.s.start)}px)`;
        if (o.k !== p.cut) continue;
        // the cut: the part shrinks to the left piece, a copy shows the right piece after the dropped part
        n.dataset.pdW = n.style.width;
        n.style.width = Math.max(10, toX(p.at - o.s.start) - gap) + "px";
        n.classList.add("k2-pd-torn");
        const r = n.cloneNode(true);
        r.classList.add("k2-pd-piece", "k2-pd-torn");
        r.removeAttribute("data-index");
        r.style.transform = "";
        r.style.left = toX(m.map(p.at)) + "px";
        r.style.width = Math.max(10, toX(o.s.end - p.at) - gap) + "px";
        box.append(r); temp.push(r);
      }
      for (const x of clips) {
        if (x.carry) continue;
        const d = toX(m.map(x.c.start)) - toX(x.c.start);
        x.n.style.transform = d ? `translateX(${d}px)` : "";
        if (x.c.start < p.at - EPS && x.end > p.at + EPS) {   // a clip across the cut: its tail goes with the right piece
          const head = toX(p.at - x.c.start);
          x.n.style.clipPath = `inset(0 calc(100% - ${head}px) 0 0)`;
          const r = x.n.cloneNode(true);
          r.classList.add("k2-pd-piece");
          r.removeAttribute("data-clip-id");
          r.style.clipPath = `inset(0 0 0 ${head}px)`;
          r.style.transform = `translateX(${toX(m.map(p.at)) - toX(x.c.start) - head}px)`;
          r.style.pointerEvents = "none";
          x.n.parentNode.append(r); temp.push(r);
        }
      }
    };
    const start = () => {
      moved = true;
      document.documentElement.classList.add("k2-pd-on");
      b.classList.add("k2-lift", "k2-pd-lift");
      if (solo) b.classList.add("k2-pd-solo");
      hole = ov("k2-pd-hole", sec.start, L);
      slab = ov("k2-pd-slab", sec.start, L);
      if (solo) { hole.hidden = true; slab.hidden = true; }
      slab.style.setProperty("--k2-pd-beat", secPerBeat() * pps + "px");
      slab.style.setProperty("--k2-pd-bar", secPerBar() * pps + "px");
      land = ov("k2-pd-land", sec.start, L);
      landSec = el("div", "k2-pd-landsec"); landSec.style.width = Math.max(10, toX(L)) + "px"; box.append(landSec);
      for (const x of clips) if (x.carry) {
        x.n.classList.add("k2-pd-carry");
        const tail = x.end - sec.end;   // a carried clip only takes the part of it inside the part
        if (tail > EPS) x.n.style.clipPath = `inset(0 ${toX(tail)}px 0 0)`;
      }
    };
    const cleanup = () => {
      if (gone) return; gone = true;
      clearPreview();
      document.documentElement.classList.remove("k2-pd-on");
      b.classList.remove("k2-lift", "k2-pd-lift", "k2-pd-solo"); b.style.transform = "";
      for (const x of clips) if (x.carry) { x.n.classList.remove("k2-pd-carry"); x.n.style.transform = ""; x.n.style.clipPath = ""; }
      for (const n of [slab, hole, land, landSec]) if (n) n.remove();
    };
    let lastSnap = null;
    const move = (ev) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) start();
      dxNow = dx;
      plan = plan2(dx);
      paint(dx, plan);
      if (plan.snap !== lastSnap && plan.snap != null) {   // a small thunk when it pulls onto an edge
        for (const n of [land, landSec]) { n.classList.remove("k2-pd-thunk"); void n.offsetWidth; n.classList.add("k2-pd-thunk"); }
      }
      lastSnap = plan.snap;
    };
    const off = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); window.removeEventListener("keydown", key, true); };
    const key = (ev) => { if (ev.key !== "Escape") return; ev.preventDefault(); ev.stopImmediatePropagation(); off(); cleanup(); };
    const settle = (at) => {
      const k = (ui.state.sections || []).findIndex((s) => Math.abs(s.start - at) < 1e-3);
      const n = k >= 0 && nodeOf(k);
      if (n) { n.classList.add("k2-pd-settle"); setTimeout(() => n.classList.remove("k2-pd-settle"), 400); }
    };
    const up = () => {
      off();
      if (!moved) return loopSoon(i);
      const p = plan || { mode: "none" }, name = sec.name;
      if (solo && p.mode === "slide" && Math.abs(p.t - sec.start) > 1e-6) {
        return editSections((l) => { l.forEach((y, k) => { y.len = list[k].end - list[k].start; }); l[i].start = p.t; }).then((r) => {
          cleanup();
          if (r && r.ok) settle(p.t);
        });
      }
      if (p.mode === "slide" && Math.abs(p.t - sec.start) > 1e-6) {
        return run("slideSection", { index: i, start: p.t }).then((r) => {
          cleanup();
          if (r && r.ok) { settle(p.t); toast(`Moved ${name} to bar ${barAt(p.t)}. Cmd+Z puts it back.`); }
        });
      }
      if (p.mode === "drop") {
        const cutName = p.cut >= 0 ? list[p.cut].name : null;
        return run("dropSection", { index: i, at: p.at }).then((r) => {
          cleanup();
          if (r && r.ok) { settle(p.m.at1); toast(cutName ? `${name} cut ${cutName} in two. Cmd+Z puts it back.` : `Moved ${name}. Cmd+Z puts it back.`); }
        });
      }
      cleanup();
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); window.addEventListener("keydown", key, true);
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
