/* THE OLD RHYTHM MENU, kept for window.KT2_RHYTHM_MENU_OLD (the new one is ui/kt2-rhythm.js).
   RHYTHM CLIPS (Eman, 11 Nov 2026 01:37): "take a sample right in the DAW and make a one file pattern from it".
   - Hold Shift and drag the right edge of a one-shot (a kick, a snare, anything): the clip grows into an empty
     pattern-like container, the hit still at its start.
   - Click the container: a clean menu. Press a rhythm (1/4, 1/8, 1/16, offbeat, backbeat, trap, jersey club...)
     and the hit is copied onto every step of it. STEPS opens a simple step grid for exact dots.
   - The bar strip at the top of the menu picks which bars a rhythm goes on (drag across bars), so the first
     8 bars can be one rhythm and the next 8 another. Default: all bars.
   - Shift-drag the edge again: the rhythm carries on into the new bars.
   - The yellow START flag on the clip: hits before it stay silent (still shown), so a snare can come in later.
     Default: the first hit.
   Data: c.rhythm (see setClipRhythm in playground/playground.js): hits are ticks, 24 per beat, from the clip
   start. The clip plays one rendered file, so everything else (play, export, copies, saving) just works.
   KT2_RHYTHM_OFF = the old behaviour (Shift+drag trims like a plain drag, no menu). */
(function () {
  "use strict";
  if (window.KT2_RHYTHM_OFF || !window.KT2_RHYTHM_MENU_OLD) return;   // the first menu (v328-v331): KT2_RHYTHM_MENU_OLD
  const PPQ = 24, BAR = 96, ACID = "#E4FF3A";
  const tickSec = () => secPerBeat() / PPQ;

  // ---------------------------------------------------------------- the rhythms
  // Note values: one hit every N ticks. Grooves: one line, no matter what the sound is.
  // Drum rhythms: the KILLDRUM rhythm brain's skeletons (ui/killdrum-rhythms.js), the kick, snare or hat line
  // depending on what the sound is (guessed from its name, switchable). 16 chars per bar, "X"/"x" = a hit.
  const every = (n, from = 0) => { const o = []; for (let t = from; t < BAR; t += n) o.push(t); return o; };
  const line = (s) => { const o = [], step = (BAR * (s.length > 16 ? 2 : 1)) / s.length; for (let i = 0; i < s.length; i++) if (s[i] === "x" || s[i] === "X") o.push(Math.round(i * step)); return o; };
  const EVERY = [
    { id: "b4", name: "4 BARS", period: BAR * 4, hits: [0] },
    { id: "b2", name: "2 BARS", period: BAR * 2, hits: [0] },
    { id: "b1", name: "1 BAR", period: BAR, hits: [0] },
    { id: "n2", name: "1/2", period: BAR, hits: every(48) },
    { id: "n4", name: "1/4", period: BAR, hits: every(24) },
    { id: "n8", name: "1/8", period: BAR, hits: every(12) },
    { id: "n16", name: "1/16", period: BAR, hits: every(6) },
    { id: "n32", name: "1/32", period: BAR, hits: every(3) },
    { id: "t4", name: "1/4 T", period: BAR, hits: every(16) },
    { id: "t8", name: "1/8 T", period: BAR, hits: every(8) },
    { id: "t16", name: "1/16 T", period: BAR, hits: every(4) },
  ];
  const GROOVES = [
    { id: "off", name: "OFFBEAT", period: BAR, hits: every(24, 12) },           // the "and"s: house hats, offbeat bass
    { id: "back", name: "BACKBEAT", period: BAR, hits: [24, 72] },            // 2 and 4: the snare / clap spot
    { id: "half", name: "HALF-TIME", period: BAR, hits: [48] },               // only on 3: trap / dubstep snare
    { id: "tres", name: "3-3-2", period: BAR, hits: line("X..X..X.X..X..X.") }, // tresillo: reggaeton, afro, dancehall
    { id: "dot", name: "DOTTED 1/8", period: BAR * 3, hits: (() => { const o = []; for (let t = 0; t < BAR * 3; t += 18) o.push(t); return o; })() },
    { id: "gallop", name: "GALLOP", period: BAR, hits: [0, 12, 18, 24, 36, 42, 48, 60, 66, 72, 84, 90] },
    { id: "roll", name: "TRAP ROLL", period: BAR, hits: [0, 12, 24, 36, 48, 60, 72, 75, 78, 81, 84, 87, 90, 93] },
  ];
  // copied from ui/killdrum-rhythms.js (k = kick, s = snare, h = hats), so this works without it
  const DRUMS = [
    { id: "four", name: "FOUR ON THE FLOOR", k: "X...X...X...X...", s: "....X.......X...", h: "..X...X...X...X." },
    { id: "boombap", name: "BOOM BAP", k: "X.....x...x.x...", s: "....X.......X...", h: "x.x.x.x.x.x.x.x." },
    { id: "trap", name: "TRAP", k: "X.........x.....X.....x...x....x", s: "........X...............X.......", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.xxxx" },
    { id: "drill", name: "DRILL", k: "X..x..x...x.....", s: "........X.....x.", h: "x.x.x.x.x..xx.x." },
    { id: "jersey", name: "JERSEY CLUB", k: "X...X...X..X..X.", s: "....X.......X...", h: "......x.x.x....." },
    { id: "twostep", name: "2-STEP", k: "X.........X.....", s: "....X.......X...", h: "x.X.x.x.x.X.x.x." },
    { id: "breakbeat", name: "BREAKBEAT", k: "X.x......xx.....", s: "....X..x..x.X..x", h: "x.x.x.x.x.x.x.x." },
    { id: "amen", name: "AMEN", k: "X.x.......x.x...X.x......x......", s: "....X..x.x..X..x....X..x.x....X.", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x." },
    { id: "dnb", name: "DRUM & BASS", k: "X.........X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x." },
    { id: "dembow", name: "DEMBOW", k: "X...X...X...X...", s: "...x..x....x..x.", h: "x.x.x.x.x.x.x.x." },
    { id: "afrobeat", name: "AFROBEATS", k: "X.....x...X.....", s: "...x..x....x..x.", h: "xxxxxxxxxxxxxxxx" },
    { id: "amapiano", name: "AMAPIANO", k: "X.......X.......", s: "....X.......X...", h: "...x..x...x..x.x" },
    { id: "baile", name: "BAILE FUNK", k: "X..x..x.X..x..x.", s: "....X..X....X.X.", h: "x.x.x.x.x.x.x.x." },
    { id: "lofi", name: "LO-FI", k: "X......x..X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x." },
  ];
  // the Jersey club kick Eman picked (8 Nov, "Just Wanna Rock"): 1, 5, 9, 12, 15
  DRUMS.find((d) => d.id === "jersey").k = "X...X...X..X..X.";
  const ROLES = [{ id: "k", name: "KICK" }, { id: "s", name: "SNARE" }, { id: "h", name: "HAT" }];
  const guessRole = (name) => {
    const n = String(name || "").toLowerCase();
    if (/snare|clap|rim|snr|\bsn\b|\bcp\b/.test(n)) return "s";
    if (/hat|hh|shaker|ride|cym|perc|tamb|\boh\b|\bch\b/.test(n)) return "h";
    return "k";
  };
  function preset(id, role) {
    const a = EVERY.find((x) => x.id === id) || GROOVES.find((x) => x.id === id);
    if (a) return a;
    const d = DRUMS.find((x) => x.id === id);
    if (!d) return null;
    const s = d[role] || d.k;
    return { id, name: d.name, period: BAR * (s.length > 16 ? 2 : 1), hits: line(s) };
  }

  // ---------------------------------------------------------------- the maths (pure)
  const uniq = (a) => [...new Set(a)].sort((x, y) => x - y);
  // put a rhythm (period + hits) on [a, b) ticks, tiled from a
  function fill(r, a, b, p, id) {
    const hits = (r.hits || []).filter((h) => h < a || h >= b);
    for (let o = a; o < b; o += p.period) for (const h of p.hits) if (o + h < b) hits.push(o + h);
    const parts = (r.parts || []).flatMap((q) => {
      if (q.b <= a || q.a >= b) return [q];
      const out = [];
      if (q.a < a) out.push({ ...q, b: a });
      if (q.b > b) out.push({ ...q, a: b });
      return out;
    });
    parts.push({ a, b, id, period: p.period });
    parts.sort((x, y) => x.a - y.a);
    return { ...r, hits: uniq(hits), parts };
  }
  // the clip got longer with Shift: the rhythm at the end carries on (the last period of it, tiled)
  function extend(r, oldT, newT) {
    if (newT <= oldT) return { ...r, hits: (r.hits || []).filter((h) => h < newT), parts: (r.parts || []).filter((q) => q.a < newT).map((q) => ({ ...q, b: Math.min(q.b, newT) })) };
    const last = (r.parts || []).filter((q) => q.b >= oldT - 1).sort((x, y) => y.b - x.b)[0];
    if (!last) return r;   // still empty: stays empty, the hit alone
    const P = last.period || BAR, from = Math.max(last.a, oldT - P), src = (r.hits || []).filter((h) => h >= from && h < oldT);
    const hits = [...(r.hits || [])];
    for (const h of src) for (let t = h + P; t < newT; t += P) if (t >= oldT) hits.push(t);
    const parts = (r.parts || []).map((q) => (q === last ? { ...q, b: newT } : q));
    return { ...r, hits: uniq(hits), parts };
  }
  const steps16 = (r, a) => { const set = new Set(r.hits || []); return Array.from({ length: 16 }, (_, i) => set.has(a + i * 6)); };

  // ---------------------------------------------------------------- talking to the engine
  const clipOf = (id) => (window.findClip ? findClip(id) : null);
  const ticksOf = (c) => Math.max(1, Math.round(c.length / tickSec()));
  function dropPeaks(id) { if (ui.peaks) for (const k of [...ui.peaks.keys()]) if (k.startsWith(id + ":")) ui.peaks.delete(k); }
  async function send(c, rhythm, length) {
    dropPeaks(c.id);
    const r = await run("setClipRhythm", { clipId: c.id, rhythm, ...(length ? { length } : {}) });
    dropPeaks(c.id);
    ui.laneSig = ""; render();
    setTimeout(() => { decorate(); if (P.id === c.id) paint(); }, 30);
    return r;
  }

  // ---------------------------------------------------------------- Shift + drag the right edge
  function startStretch(e, c, node) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (typeof hidePop === "function") hidePop();
    const x0 = e.clientX, len0 = c.length, isR = !!c.rhythm;
    const minLen = isR ? tickSec() * 6 : len0;
    let len = len0;
    const pins = [...node.querySelectorAll("canvas")].map((cv) => { const w = cv.getBoundingClientRect().width; cv.style.width = w + "px"; cv.style.maxWidth = "none"; cv.style.flex = "none"; return cv; });
    node.style.overflow = "hidden";
    node.classList.add("k2rh-stretching");
    let tag = el("div", "k2rh-tag"); node.append(tag);
    const sp = typeof speedMeter === "function" ? speedMeter() : null;
    const move = (ev) => {
      if (sp) sp.feed(ev);
      let at = c.start + len0 + (ev.clientX - x0) / ui.pxPerSec;
      if (!ev.altKey) at = snapGrid(at, sp ? sp.v : undefined);
      len = Math.max(minLen, at - c.start);
      node.style.width = Math.max(4, toX(len)) + "px";
      const bars = len / secPerBar();
      tag.textContent = Math.abs(bars - Math.round(bars)) < 1e-3 ? Math.round(bars) + (Math.round(bars) === 1 ? " BAR" : " BARS") : (Math.round(bars * 4 * 100) / 100) + " BEATS";
      if (window.KT2Juice) try { KT2Juice.step("len", 1); } catch (er) {}
    };
    const up = async () => {
      removeEventListener("mousemove", move, true); removeEventListener("mouseup", up, true);
      node.classList.remove("k2rh-stretching"); tag.remove();
      for (const cv of pins) cv.style.width = cv.style.maxWidth = cv.style.flex = "";
      node.style.overflow = "";
      if (Math.abs(len - len0) < 1e-4 || (!isR && len <= len0 + 1e-4)) { node.style.width = Math.max(4, toX(len0)) + "px"; return; }
      const fresh = clipOf(c.id) || c;
      let r = fresh.rhythm ? extend(fresh.rhythm, ticksOf(fresh), Math.round(len / tickSec())) : { hits: [0], startAt: 0, parts: [], role: guessRole(fresh.name) };
      const res = await send(fresh, r, len);
      if (res && res.ok) openPanel(c.id);
    };
    addEventListener("mousemove", move, true); addEventListener("mouseup", up, true);
  }
  // the right edge, or (small clips hide their edges) the last few px of the clip, with Shift held
  // (any=true: anywhere on the clip, for the press-then-pull and Shift-during-the-drag ways below)
  function stretchTarget(e, any) {
    if ((!e.shiftKey && !any) || !e.target || !e.target.closest) return null;
    const node = e.target.closest("#rows .clip[data-clip-id]");
    if (!node || e.target.closest(".k2rh-start, button, .fade-h, .k2-fade, .k2-vol, .gain-line")) return null;
    const q = node.getBoundingClientRect(), zone = q.width < 30 ? q.width / 2 : Math.max(6, Math.min(12, q.width * 0.35));
    if (!any && !e.target.closest(".edge.r") && e.clientX < q.right - zone) return null;
    const c = clipOf(node.dataset.clipId);
    if (!c || c.kind === "midi" || !c.track || c.track.kind === "beat") return null;
    if (!c.rhythm && (c.takes > 1 || (c.comp && c.comp.length))) return null;
    return { node, c };
  }
  const fakeDown = (x, y) => ({ clientX: x, clientY: y, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} });
  let armed = null, synth = false;
  document.addEventListener("mousedown", (e) => {
    armed = null;
    if (window.KT2_RHYTHM_OFF || e.button !== 0 || synth) return;
    const hit = stretchTarget(e);
    if (hit) return startStretch(e, hit.c, hit.node);
    // Shift + press anywhere else on a sound clip, then pull right: the stretch too (the press alone still
    // adds the clip to the selection, like before). Without Shift on the right edge: a plain trim that turns
    // into the stretch the moment Shift goes down during the drag.
    const any = stretchTarget(e, true);
    if (!any) return;
    if (e.shiftKey) armed = { kind: "body", id: any.c.id, x: e.clientX, y: e.clientY };
    else if (e.target.closest(".edge.r")) armed = { kind: "edge", id: any.c.id, x: e.clientX, y: e.clientY };
  }, true);
  addEventListener("mousemove", (e) => {
    if (!armed || synth) return;
    if (!(e.buttons & 1)) { armed = null; return; }
    const dx = e.clientX - armed.x, dy = e.clientY - armed.y;
    if (armed.kind === "body" && (dx < 6 || Math.abs(dy) > dx)) { if (Math.hypot(dx, dy) > 12) armed = null; return; }
    if (armed.kind === "edge" && !e.shiftKey) return;
    const a = armed; armed = null;
    const node = document.querySelector(`#rows .clip[data-clip-id="${a.id}"]`), c = clipOf(a.id);
    if (!node || !c) return;
    if (a.kind === "edge") {   // end the plain trim with no change: back to where it started, let go
      synth = true;
      try {
        dispatchEvent(new MouseEvent("mousemove", { clientX: a.x, clientY: a.y, bubbles: true }));
        dispatchEvent(new MouseEvent("mouseup", { clientX: a.x, clientY: a.y, bubbles: true }));
      } finally { synth = false; }
      node.style.width = Math.max(4, toX(c.length)) + "px";
    }
    const fresh = document.querySelector(`#rows .clip[data-clip-id="${a.id}"]`) || node;
    startStretch(fakeDown(a.x, a.y), c, fresh);
    dispatchEvent(new MouseEvent("mousemove", { clientX: e.clientX, clientY: e.clientY, altKey: e.altKey }));
  }, true);
  addEventListener("mouseup", () => { if (!synth) armed = null; }, true);
  // Shift over that spot: the stretch cursor
  let hov = null;
  const hover = (e) => {
    const hit = e && e.buttons === 0 ? stretchTarget(e) : null, n = hit && hit.node;
    if (hov && hov !== n) hov.classList.remove("k2rh-can");
    if (n) n.classList.add("k2rh-can");
    hov = n;
  };
  document.addEventListener("mousemove", hover, true);
  addEventListener("keyup", (e) => { if (e.key === "Shift") hover(null); });

  // ---------------------------------------------------------------- the look on the clip
  function decorate() {
    if (window.KT2_RHYTHM_OFF) return;
    for (const node of document.querySelectorAll("#rows .clip[data-clip-id]")) {
      const c = clipOf(node.dataset.clipId);
      const old = node.querySelector(":scope > .k2rh-ov");
      if (!c || !c.rhythm) { if (old) { old.remove(); node.classList.remove("k2rh-clip"); } continue; }
      const sig = JSON.stringify([c.rhythm.hits, c.rhythm.startAt, c.length, ui.pxPerSec, P.id === c.id ? P.sel : null]);
      if (old && old.dataset.sig === sig) continue;
      if (old) old.remove();
      node.classList.add("k2rh-clip");
      node.append(overlay(c, node, sig));
    }
  }
  function overlay(c, node, sig) {
    const ov = el("div", "k2rh-ov"), ts = tickSec(), T = ticksOf(c), r = c.rhythm, start = r.startAt || 0;
    ov.dataset.sig = sig;
    const barPx = toX(secPerBar()), beatPx = toX(secPerBeat());
    ov.style.setProperty("--bar", barPx + "px"); ov.style.setProperty("--beat", beatPx + "px");
    // silent part before the START flag, with the hits it keeps quiet shown as ghosts
    if (start > 0) { const pre = el("div", "k2rh-pre"); pre.style.width = toX(start * ts) + "px"; ov.append(pre); }
    const marks = el("div", "k2rh-marks");
    for (const h of r.hits || []) {
      if (h >= T) break;
      const m = el("i", h < start ? "ghost" : "");
      m.style.left = toX(h * ts) + "px";
      marks.append(m);
    }
    ov.append(marks);
    if (P.id === c.id && P.sel) {
      const s = el("div", "k2rh-selbox");
      s.style.left = toX(P.sel[0] * BAR * ts) + "px"; s.style.width = toX((Math.min(T, P.sel[1] * BAR) - P.sel[0] * BAR) * ts) + "px";
      ov.append(s);
    }
    const flag = el("div", "k2rh-start" + (start > 0 ? " moved" : ""));
    flag.style.left = toX(start * ts) + "px";
    flag.title = "Where the sound starts. Drag it later and the hits before it stay silent. Double-click: back to the first hit.";
    flag.addEventListener("mousedown", (e) => startFlag(e, c, node, flag));
    flag.addEventListener("dblclick", (e) => { e.stopPropagation(); const f = clipOf(c.id); if (f && f.rhythm && f.rhythm.startAt) send(f, { ...f.rhythm, startAt: 0 }); });
    ov.append(flag);
    return ov;
  }
  function startFlag(e, c, node, flag) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const x0 = e.clientX, ts = tickSec(), T = ticksOf(c), s0 = c.rhythm.startAt || 0;
    let s = s0;
    const pre = () => node.querySelector(".k2rh-pre") || node.querySelector(".k2rh-ov").insertBefore(el("div", "k2rh-pre"), node.querySelector(".k2rh-marks"));
    const move = (ev) => {
      const raw = s0 + (ev.clientX - x0) / ui.pxPerSec / ts;
      // snaps to the visible step (1/16 up close, beats, bars further out); Alt = free
      const stepT = ev.altKey ? 1 : [6, 12, 24, 48, 96].find((k) => toX(k * ts) >= 18) || 96;
      s = Math.max(0, Math.min(T - 1, Math.round(raw / stepT) * stepT));
      flag.style.left = toX(s * ts) + "px";
      pre().style.width = toX(s * ts) + "px";
      for (const m of node.querySelectorAll(".k2rh-marks i")) m.classList.toggle("ghost", parseFloat(m.style.left) < toX(s * ts) - 0.5);
    };
    const up = () => {
      removeEventListener("mousemove", move, true); removeEventListener("mouseup", up, true);
      const f = clipOf(c.id);
      if (s !== s0 && f && f.rhythm) send(f, { ...f.rhythm, startAt: s });
    };
    addEventListener("mousemove", move, true); addEventListener("mouseup", up, true);
  }
  (function watch() {
    const rows = document.getElementById("rows");
    if (!rows) return setTimeout(watch, 400);
    let raf = 0;
    new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; decorate(); if (P.id) keepPanel(); }); }).observe(rows, { childList: true, subtree: true });
    decorate();
  })();

  // ---------------------------------------------------------------- the menu
  const P = { id: null, el: null, sel: null, steps: false, role: null };
  // a click (no drag, no double-click) on a rhythm clip opens it
  let press = null;
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) { press = null; return; }
    if (P.el && P.el.contains(e.target)) return;
    const node = e.target.closest && e.target.closest("#rows .clip.k2rh-clip");
    if (node && !e.target.closest(".edge, .k2rh-start, button, .fade-h, .gain-line") && !e.shiftKey && !e.metaKey && !e.ctrlKey && e.detail < 2) press = { id: node.dataset.clipId, x: e.clientX, y: e.clientY };
    else { press = null; if (P.el && !(node && node.dataset.clipId === P.id)) closePanel(); }
  }, true);
  addEventListener("mouseup", (e) => {
    const p = press; press = null;
    if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) return;
    setTimeout(() => {
      if (p.cancel) return;
      if (ui.selectedClip === p.id || isSel(p.id)) openPanel(p.id); else if (P.id === p.id) closePanel();
    }, 240);
    press = null; lastPress = p;
  }, true);
  let lastPress = null;
  document.addEventListener("dblclick", () => { if (lastPress) lastPress.cancel = true; closePanel(); }, true);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && P.el) { closePanel(); e.stopPropagation(); } }, true);

  function openPanel(id) {
    const c = clipOf(id);
    if (!c || !c.rhythm) return;
    if (P.id !== id) { P.sel = null; P.role = c.rhythm.role || guessRole(c.name); }
    P.id = id;
    if (!P.el) { P.el = el("div", "k2rh-panel"); document.body.append(P.el); }
    paint(); decorate();
  }
  function closePanel() {
    if (!P.el) return;
    P.el.remove(); P.el = null; const id = P.id; P.id = null; P.sel = null;
    if (id) decorate();
  }
  function keepPanel() {
    const c = clipOf(P.id);
    if (!c || !c.rhythm) return closePanel();
    place();
  }
  function place() {
    const node = document.querySelector(`#rows .clip[data-clip-id="${P.id}"]`);
    if (!node || !P.el) return;
    const q = node.getBoundingClientRect(), w = P.el.offsetWidth, h = P.el.offsetHeight;
    let left = Math.max(8, Math.min(innerWidth - w - 8, q.left));
    let top = q.bottom + 6;
    if (top + h > innerHeight - 8) top = Math.max(8, q.top - h - 6);
    P.el.style.left = left + "px"; P.el.style.top = top + "px";
  }
  const svgDots = (p, wide) => {
    const per = p.period, n = per / BAR;
    const marks = p.hits.map((h) => `<rect x="${(h / per) * 100}" y="1" width="${wide ? 1.1 : 1.6}" height="8"/>`).join("");
    const bars = Array.from({ length: n * 4 }, (_, i) => `<rect class="g" x="${(i / (n * 4)) * 100}" y="4" width="0.5" height="2"/>`).join("");
    return `<svg viewBox="0 0 100 10" preserveAspectRatio="none">${bars}${marks}</svg>`;
  };
  function paint() {
    const c = clipOf(P.id);
    if (!c || !c.rhythm || !P.el) return closePanel();
    const r = c.rhythm, T = ticksOf(c), nBars = Math.max(1, Math.ceil(T / BAR));
    if (P.sel && (P.sel[0] >= nBars)) P.sel = null;
    const sel = P.sel || [0, nBars], a = sel[0] * BAR, b = Math.min(T, sel[1] * BAR);
    const partOn = (r.parts || []).find((q) => q.a <= a && q.b >= b);
    const on = partOn ? partOn.id : null;
    const pn = P.el;
    pn.innerHTML = "";
    // bar strip: which bars the next rhythm goes on
    const strip = el("div", "k2rh-bars");
    for (let i = 0; i < nBars; i++) {
      const cell = el("div", "k2rh-bar" + (i >= sel[0] && i < sel[1] ? " on" : ""));
      cell.dataset.i = i;
      const hs = (r.hits || []).filter((h) => h >= i * BAR && h < Math.min(T, (i + 1) * BAR)).map((h) => h - i * BAR);
      cell.innerHTML = `<b>${i + 1}</b>` + svgDots({ period: BAR, hits: hs }, true);
      strip.append(cell);
    }
    strip.addEventListener("mousedown", (e) => {
      const cell = e.target.closest(".k2rh-bar"); if (!cell) return;
      e.preventDefault();
      const i0 = +cell.dataset.i;
      const setSel = (i1) => { const lo = Math.min(i0, i1), hi = Math.max(i0, i1) + 1; P.sel = lo === 0 && hi === nBars ? null : [lo, hi]; for (const x of strip.children) x.classList.toggle("on", +x.dataset.i >= lo && +x.dataset.i < hi); decorate(); };
      // a click on the only picked bar picks all of them again
      if (P.sel && P.sel[1] - P.sel[0] === 1 && P.sel[0] === i0) { P.sel = null; paint(); decorate(); return; }
      setSel(i0);
      const mv = (ev) => { const t = document.elementFromPoint(ev.clientX, strip.getBoundingClientRect().top + 8); const cc = t && t.closest && t.closest(".k2rh-bar"); if (cc) setSel(+cc.dataset.i); };
      const upx = () => { removeEventListener("mousemove", mv); removeEventListener("mouseup", upx); paint(); };
      addEventListener("mousemove", mv); addEventListener("mouseup", upx);
    });
    const head = el("div", "k2rh-head");
    head.append(el("span", "k2rh-title", "RHYTHM"), el("span", "k2rh-range", P.sel ? (sel[1] - sel[0] === 1 ? "BAR " + (sel[0] + 1) : "BARS " + (sel[0] + 1) + "-" + sel[1]) : (nBars === 1 ? "1 BAR" : "ALL " + nBars + " BARS")));
    const x = el("button", "k2rh-x", "\u00d7"); x.title = "Close (Esc)"; x.onclick = closePanel; head.append(x);
    pn.append(head, strip);
    const apply = (p) => {
      const f = clipOf(P.id); if (!f || !f.rhythm) return;
      const TT = ticksOf(f), aa = (P.sel ? P.sel[0] : 0) * BAR, bb = Math.min(TT, (P.sel ? P.sel[1] : Math.ceil(TT / BAR)) * BAR);
      let nr = fill(f.rhythm, aa, bb, p, p.id);
      nr.role = P.role;
      // the START flag sits on the first hit of the rhythm when it was on the clip's start and that spot is now empty
      send(f, nr);
    };
    const tiles = (name, list, extra) => {
      const g = el("div", "k2rh-group");
      const gh = el("div", "k2rh-gh", name);
      if (extra) gh.append(extra);
      const box = el("div", "k2rh-tiles");
      for (const it of list) {
        const p = it.k ? preset(it.id, P.role) : it;
        const tb = el("button", "k2rh-tile" + (on === it.id ? " on" : ""));
        tb.innerHTML = `<span>${it.name}</span>` + svgDots(p, p.period > BAR);
        tb.onclick = () => apply(p);
        box.append(tb);
      }
      g.append(gh, box);
      return g;
    };
    pn.append(tiles("EVERY", EVERY), tiles("GROOVES", GROOVES));
    const roles = el("div", "k2rh-roles");
    for (const ro of ROLES) {
      const rb = el("button", P.role === ro.id ? "on" : "", ro.name);
      rb.onclick = () => { P.role = ro.id; paint(); };
      roles.append(rb);
    }
    pn.append(tiles("DRUM RHYTHMS", DRUMS, roles));
    // STEPS: a simple 16-step grid for the picked bars (the first of them shows; a change goes on all)
    const stepsBtn = el("button", "k2rh-more" + (P.steps ? " open" : ""), "STEPS " + (P.steps ? "\u25b4" : "\u25be"));
    stepsBtn.onclick = () => { P.steps = !P.steps; paint(); };
    const foot = el("div", "k2rh-foot");
    const one = el("button", "k2rh-small", "ONE HIT");
    one.title = "Back to the single sound";
    one.onclick = () => { const f = clipOf(P.id); closePanel(); if (f) send(f, null); };
    const clear = el("button", "k2rh-small", "CLEAR");
    clear.title = "Empty the picked bars";
    clear.onclick = () => { const f = clipOf(P.id); if (!f) return; const TT = ticksOf(f), aa = (P.sel ? P.sel[0] : 0) * BAR, bb = Math.min(TT, (P.sel ? P.sel[1] : Math.ceil(TT / BAR)) * BAR); send(f, { ...fill(f.rhythm, aa, bb, { period: BAR, hits: [] }, "clear"), parts: (f.rhythm.parts || []).filter((q) => q.b <= aa || q.a >= bb) }); };
    foot.append(stepsBtn, el("span", "k2rh-sp"), clear, one);
    pn.append(foot);
    if (P.steps) {
      const st = steps16(r, a), grid = el("div", "k2rh-steps");
      st.forEach((v, i) => {
        const d = el("button", "k2rh-step" + (v ? " on" : "") + (i % 4 === 0 ? " beat" : ""));
        d.onclick = () => {
          st[i] = !st[i];
          apply({ id: "steps", period: BAR, hits: st.map((s, k) => (s ? k * 6 : -1)).filter((k) => k >= 0) });
        };
        grid.append(d);
      });
      pn.append(grid);
    }
    requestAnimationFrame(place);
  }

  // ---------------------------------------------------------------- style
  const css = document.createElement("style");
  css.textContent = `
  .k2rh-ov { position: absolute; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; z-index: 7;
    background-image: repeating-linear-gradient(90deg, rgba(0,0,0,.28) 0 1px, transparent 1px var(--bar)), repeating-linear-gradient(90deg, rgba(0,0,0,.12) 0 1px, transparent 1px var(--beat)); }
  .k2rh-pre { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(20,20,22,.55); }
  .k2rh-marks { position: absolute; left: 0; right: 0; bottom: 2px; height: 5px; }
  .k2rh-marks i { position: absolute; bottom: 0; width: 2px; height: 5px; background: rgba(0,0,0,.55); }
  .k2rh-marks i.ghost { background: transparent; box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); height: 4px; width: 3px; }
  .k2rh-selbox { position: absolute; top: 0; bottom: 0; background: rgba(228,255,58,.14); box-shadow: inset 0 0 0 1px ${ACID}; }
  .k2rh-start { position: absolute; top: 0; bottom: 0; width: 1px; pointer-events: none; z-index: 4; }
  .k2rh-start::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 1px; background: ${ACID}; opacity: .5; }
  .k2rh-start::after { content: ""; position: absolute; left: 0; bottom: 0; width: 8px; height: 8px; background: ${ACID}; pointer-events: auto; cursor: ew-resize; }
  .k2rh-start.moved::before { opacity: 1; }
  .clip.k2rh-can, .clip.k2rh-can * { cursor: ew-resize !important; }
  .clip.k2rh-stretching { box-shadow: inset 0 0 0 2px ${ACID} !important; }
  .k2rh-tag { position: absolute; right: 4px; bottom: 3px; font: 700 9px/1 var(--font, system-ui); letter-spacing: .08em; color: #111; background: ${ACID}; padding: 2px 4px; z-index: 6; pointer-events: none; }
  .k2rh-panel { position: fixed; z-index: 9000; width: 440px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: auto; background: #1b1b1e; color: #e8e8ea;
    box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 14px 40px rgba(0,0,0,.55); padding: 10px; font: 600 10px/1.2 var(--font, system-ui); letter-spacing: .06em; user-select: none; }
  .k2rh-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .k2rh-title { font-weight: 800; font-size: 11px; color: ${ACID}; }
  .k2rh-range { color: rgba(255,255,255,.55); flex: 1; }
  .k2rh-x { background: none; border: 0; color: rgba(255,255,255,.6); font-size: 16px; cursor: pointer; padding: 0 4px; }
  .k2rh-x:hover { color: #fff; }
  .k2rh-bars { display: flex; gap: 2px; margin-bottom: 10px; cursor: pointer; }
  .k2rh-bar { flex: 1 1 0; min-width: 6px; height: 26px; background: #26262a; position: relative; box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
  .k2rh-bar b { position: absolute; left: 3px; top: 2px; font-size: 8px; color: rgba(255,255,255,.35); font-weight: 600; }
  .k2rh-bar svg { position: absolute; left: 2px; right: 2px; bottom: 3px; width: calc(100% - 4px); height: 8px; fill: rgba(255,255,255,.7); }
  .k2rh-bar svg .g, .k2rh-tile svg .g { fill: rgba(255,255,255,.18); }
  .k2rh-bar.on { background: rgba(228,255,58,.16); box-shadow: inset 0 0 0 1px ${ACID}; }
  .k2rh-bar.on b { color: ${ACID}; }
  .k2rh-group { margin-bottom: 8px; }
  .k2rh-gh { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,.45); font-size: 9px; margin-bottom: 4px; }
  .k2rh-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
  .k2rh-tile { background: #26262a; border: 0; color: #e8e8ea; text-align: left; padding: 6px 6px 5px; cursor: pointer; font: inherit; display: grid; gap: 5px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
  .k2rh-tile span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 9.5px; }
  .k2rh-tile svg { width: 100%; height: 8px; fill: rgba(255,255,255,.75); }
  .k2rh-tile:hover { background: #2f2f34; }
  .k2rh-tile.on { background: ${ACID}; color: #111; }
  .k2rh-tile.on svg { fill: #111; }
  .k2rh-tile.on svg .g { fill: rgba(0,0,0,.25); }
  .k2rh-roles { display: flex; gap: 2px; margin-left: auto; }
  .k2rh-roles button, .k2rh-small, .k2rh-more { background: #26262a; border: 0; color: rgba(255,255,255,.7); font: inherit; font-size: 9px; padding: 3px 6px; cursor: pointer; }
  .k2rh-roles button.on { background: #e8e8ea; color: #111; }
  .k2rh-foot { display: flex; gap: 4px; align-items: center; margin-top: 2px; }
  .k2rh-sp { flex: 1; }
  .k2rh-more { color: #e8e8ea; padding: 5px 8px; }
  .k2rh-more.open { color: ${ACID}; }
  .k2rh-small:hover, .k2rh-more:hover, .k2rh-roles button:hover:not(.on) { background: #333338; color: #fff; }
  .k2rh-steps { display: grid; grid-template-columns: repeat(16, 1fr); gap: 3px; margin-top: 8px; }
  .k2rh-step { height: 22px; border: 0; background: #2a2a2e; cursor: pointer; padding: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,.05); }
  .k2rh-step.beat { background: #34343a; }
  .k2rh-step.on { background: ${ACID}; }
  .k2rh-step:hover:not(.on) { background: #404046; }
  body.look-light .k2rh-panel { background: #f1f1f3; color: #1b1b1e; }
  `;
  document.head.append(css);

  window.KT2Rhythm = { EVERY, GROOVES, DRUMS, preset, fill, extend, guessRole, steps16, open: openPanel, close: closePanel, decorate, state: P };
})();
