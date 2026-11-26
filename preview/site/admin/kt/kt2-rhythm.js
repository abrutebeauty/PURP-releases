/* RHYTHM CLIPS (Eman, 11 Nov 2026 01:37): "take a sample right in the DAW and make a one file pattern from it".
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
  if (window.KT2_RHYTHM_OFF || window.KT2_RHYTHM_MENU_OLD) return;   // KT2_RHYTHM_MENU_OLD = the first menu (ui/kt2-rhythm-old.js)
  const PPQ = 24, BAR = 96, ACID = "#E4FF3A";
  // stress test fixes (Eman 11 Nov 13:53, "triple check everything"): the icon clicks with the mouse, tips never eat
  // a click in the menu, LOOP/TRACK switch cleanly while playing, play shows what you hear, the loop grows with the
  // clip. KT2_RHYTHM_FIX_OLD = how v335 did it.
  const FIX = !window.KT2_RHYTHM_FIX_OLD;
  // Eman 11 Nov 21:34: a small square icon that fits the pattern clips (KT2_RHYTHM_ICON_OLD = the round dots pill),
  // and FL-style slices on the clip at every point where the rhythm loops round (KT2_RHYTHM_SLICES_OFF = none)
  const SQ = !window.KT2_RHYTHM_ICON_OLD, SLICES = !window.KT2_RHYTHM_SLICES_OFF;
  // Eman 12 Nov 00:32: the loop cuts are small V notches cut into the clip's top and bottom edge, like FL,
  // with no line through the wave (KT2_LOOP_NOTCH_OLD = v338's thin line with dark caps under the title)
  const NOTCH = !window.KT2_LOOP_NOTCH_OLD;
  // Eman 12 Nov 00:37: no pattern icon on these clips; double-clicking the clip opens this menu (app.js), and the
  // audio editor moves into the menu ("AUDIO EDITOR") and the right-click menu. KT2_RHYTHM_ICON_SHOW = icon + old double-click.
  const NOICON = !window.KT2_RHYTHM_ICON_SHOW;
  // Eman 11 Nov 21:36: no STEPS tab; the step grid always sits under LOOP / TRACK and shows whatever was pressed.
  // Click an empty step = a hit, right-click = gone, drag a hit = move it. KT2_RHYTHM_STEPS_TAB = the STEPS tab.
  const STEPBAR = !window.KT2_RHYTHM_STEPS_TAB;
  const tickSec = () => secPerBeat() / PPQ;

  // ---------------------------------------------------------------- the rhythms
  // Note values: one hit every N ticks. Grooves: one line, no matter what the sound is.
  // Drum rhythms: the KILLDRUM rhythm brain's skeletons (ui/killdrum-rhythms.js), the kick, snare or hat line
  // depending on what the sound is (guessed from its name, switchable). 16 chars per bar, "X"/"x" = a hit.
  const every = (n, from = 0) => { const o = []; for (let t = from; t < BAR; t += n) o.push(t); return o; };
  const line = (s) => { const o = [], step = (BAR * (s.length > 16 ? 2 : 1)) / s.length; for (let i = 0; i < s.length; i++) if (s[i] === "x" || s[i] === "X") o.push(Math.round(i * step)); return o; };
  const EVERY = [
    { id: "empty", name: "Empty", period: BAR, hits: [] },
    { id: "b4", name: "4 bars", period: BAR * 4, hits: [0] },
    { id: "b2", name: "2 bars", period: BAR * 2, hits: [0] },
    { id: "b1", name: "1 bar", period: BAR, hits: [0] },
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
    { id: "off", name: "Offbeat", period: BAR, hits: every(24, 12) },           // the "and"s: house hats, offbeat bass
    { id: "back", name: "Backbeat", period: BAR, hits: [24, 72] },            // 2 and 4: the snare / clap spot
    { id: "half", name: "Half-time", period: BAR, hits: [48] },               // only on 3: trap / dubstep snare
    { id: "tres", name: "3-3-2", period: BAR, hits: line("X..X..X.X..X..X.") }, // tresillo: reggaeton, afro, dancehall
    { id: "dot", name: "Dotted 1/8", period: BAR * 3, hits: (() => { const o = []; for (let t = 0; t < BAR * 3; t += 18) o.push(t); return o; })() },
    { id: "gallop", name: "Gallop", period: BAR, hits: [0, 12, 18, 24, 36, 42, 48, 60, 66, 72, 84, 90] },
    { id: "roll", name: "Trap roll", period: BAR, hits: [0, 12, 24, 36, 48, 60, 72, 75, 78, 81, 84, 87, 90, 93] },
  ];
  // copied from ui/killdrum-rhythms.js (k = kick, s = snare, h = hats), so this works without it
  const DRUMS = [
    { id: "four", name: "Four on the floor", k: "X...X...X...X...", s: "....X.......X...", h: "..X...X...X...X." },
    { id: "boombap", name: "Boom bap", k: "X.....x...x.x...", s: "....X.......X...", h: "x.x.x.x.x.x.x.x." },
    { id: "trap", name: "Trap", k: "X.........x.....X.....x...x....x", s: "........X...............X.......", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.xxxx" },
    { id: "drill", name: "Drill", k: "X..x..x...x.....", s: "........X.....x.", h: "x.x.x.x.x..xx.x." },
    { id: "jersey", name: "Jersey club", k: "X...X...X..X..X.", s: "....X.......X...", h: "......x.x.x....." },
    { id: "twostep", name: "2-step", k: "X.........X.....", s: "....X.......X...", h: "x.X.x.x.x.X.x.x." },
    { id: "breakbeat", name: "Breakbeat", k: "X.x......xx.....", s: "....X..x..x.X..x", h: "x.x.x.x.x.x.x.x." },
    { id: "amen", name: "Amen", k: "X.x.......x.x...X.x......x......", s: "....X..x.x..X..x....X..x.x....X.", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x." },
    { id: "dnb", name: "Drum & bass", k: "X.........X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x." },
    { id: "dembow", name: "Dembow", k: "X...X...X...X...", s: "...x..x....x..x.", h: "x.x.x.x.x.x.x.x." },
    { id: "afrobeat", name: "Afrobeats", k: "X.....x...X.....", s: "...x..x....x..x.", h: "xxxxxxxxxxxxxxxx" },
    { id: "amapiano", name: "Amapiano", k: "X.......X.......", s: "....X.......X...", h: "...x..x...x..x.x" },
    { id: "baile", name: "Baile funk", k: "X..x..x.X..x..x.", s: "....X..X....X.X.", h: "x.x.x.x.x.x.x.x." },
    { id: "lofi", name: "Lo-fi", k: "X......x..X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x." },
  ];
  // the Jersey club kick Eman picked (8 Nov, "Just Wanna Rock"): 1, 5, 9, 12, 15
  DRUMS.find((d) => d.id === "jersey").k = "X...X...X..X..X.";
  // Eman 16 Nov 02:18: the menu opens on DRUMS, on the sub-tab of what the sound is (kick / snare / hat / fx, from the
  // clip name, its lane and its file), and an FX sub-tab with its own rhythms (sparse hits, off-beat accents, end-of-bar
  // fills, builds). KT2_RHYTHM_DRUMS_OLD = opens on the tab of the picked rhythm (else EVERY), role from the clip name
  // only, no FX. KT2_RHYTHM_FX_OFF = no FX sub-tab.
  const DRUMS1 = !window.KT2_RHYTHM_DRUMS_OLD, FXTAB = DRUMS1 && !window.KT2_RHYTHM_FX_OFF;
  // FX rhythms: 16 chars per bar, as many bars as the string is long ("X"/"x" = a hit)
  const FXR = [
    { id: "fx_impact", name: "Impact", f: "X..............." + ".".repeat(48) },
    { id: "fx_down", name: "Downbeat", f: "X..............." + "................" },
    { id: "fx_off", name: "Off accents", f: "......X.......X." },
    { id: "fx_pick", name: "Pickups", f: "...X.......X...." },
    { id: "fx_dot", name: "Dotted echo", f: "X.....X.....X..." },
    { id: "fx_call", name: "Call & answer", f: "X.....X........." + "........X..X...." },
    { id: "fx_space", name: "Space hits", f: "X..........X...." + "......X........." },
    { id: "fx_sparse", name: "Sparse", f: "X......X........" + "..........X....." + "....X..........." + "...........X..X." },
    { id: "fx_stutter", name: "Stutter", f: "XXXX............" + "................" },
    { id: "fx_fill", name: "End fill", f: "................" + "..........X.X.XX" },
    { id: "fx_turn", name: "Turnaround", f: ".".repeat(48) + "........X..X..X." },
    { id: "fx_build", name: "Build roll", f: "X..............." + "X.......X......." + "X...X...X...X..." + "X.X.X.X.XXXXXXXX" },
  ];
  const fxPreset = (d) => { const bars = Math.max(1, Math.round(d.f.length / 16)), o = []; for (let i = 0; i < d.f.length; i++) if (d.f[i] === "x" || d.f[i] === "X") o.push(Math.round((i * BAR) / 16)); return { id: d.id, name: d.name, period: BAR * bars, hits: o }; };
  const ROLES = [{ id: "k", name: "KICK" }, { id: "s", name: "SNARE" }, { id: "h", name: "HAT" }].concat(FXTAB ? [{ id: "f", name: "FX" }] : []);
  const guessRole = (name) => {
    const n = String(name || "").toLowerCase();
    if (/snare|clap|rim|snr|\bsn\b|\bcp\b/.test(n)) return "s";
    if (/hat|hh|shaker|ride|cym|perc|tamb|\boh\b|\bch\b/.test(n)) return "h";
    return "k";
  };
  // what one bit of text says the sound is, or null when it says nothing
  const roleIn = (txt) => {
    const n = String(txt || "").toLowerCase().replace(/[_\-.\/:]+/g, " ");
    if (!n.trim()) return null;
    if (FXTAB && /\b(s?fx|riser?s?|rising|uplift\w*|downlift\w*|sweeps?|whoosh\w*|swoosh\w*|impacts?|crash(es)?|reverse[ds]?|rev|noise|foley|atmos\w*|ambien\w*|texture\w*|laser|zap|scratch\w*|glitch\w*|transition\w*|siren|horn|vinyl|tape ?stop|drone|swell|sub ?drop|boom fx)\b/.test(n)) return "f";
    if (/\b(kick|kik|kck|bd|808)s?\b|kick/.test(n)) return "k";
    if (/snare|clap|rim|snr|\bsn\b|\bcp\b|\bsnap/.test(n)) return "s";
    if (/hat|hh|shaker|ride|cym|perc|tamb|\boh\b|\bch\b/.test(n)) return "h";
    return null;
  };
  // the clip's name first, then its lane's name, then the file it plays
  const roleOf = (c) => {
    if (!c) return "k";
    let lane = "";
    try { const t = ui.state.tracks.find((x) => x.clips.some((y) => y.id === c.id)); lane = t ? t.name : ""; } catch (e) { /* no lane */ }
    const src = String((c.rhythm && c.rhythm.src) || c.src || "").split(/[\/]/).pop();
    return roleIn(c.name) || roleIn(lane) || roleIn(src) || "k";
  };
  function preset(id, role) {
    const a = EVERY.find((x) => x.id === id) || GROOVES.find((x) => x.id === id);
    if (a) return a;
    const fx = FXR.find((x) => x.id === id);
    if (fx) return fxPreset(fx);
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
      // the menu no longer pops up by itself (Eman, 11 Nov 02:51): the clip menu has RHYTHM, and the clip gets a small icon
      return res;
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
  // the parts (each part's rhythm) stay on the clip in two shades, so they can be picked again later
  const partsOf = (c) => { const T = ticksOf(c); return (c.rhythm.parts || []).filter((q) => q && q.b > q.a && q.a < T).map((q) => ({ ...q, b: Math.min(q.b, T) })); };
  function decorate() {
    if (window.KT2_RHYTHM_OFF) return;
    for (const node of document.querySelectorAll("#rows .clip[data-clip-id]")) {
      const c = clipOf(node.dataset.clipId);
      const old = node.querySelector(":scope > .k2rh-ov");
      if (!c || !c.rhythm) { if (old) { old.remove(); node.classList.remove("k2rh-clip"); } node.querySelector(".k2rh-ico") && node.querySelector(".k2rh-ico").remove(); continue; }
      // LOOP KEEP (16 Nov): one clip with odd data no longer stops every other loop clip from getting its cuts
      // (KT2_LOOP_KEEP_OFF = old: the first error stops the rest)
      try {
        icon(node, c);
        node.classList.toggle("k2rh-editing", P.id === c.id);
        const sig = JSON.stringify([c.rhythm.hits, c.rhythm.startAt, c.rhythm.parts, c.length, ui.pxPerSec, P.id === c.id ? P.sel || "all" : null]);
        if (old && old.dataset.sig === sig) continue;
        if (old) old.remove();
        node.classList.add("k2rh-clip");
        node.append(overlay(c, node, sig));
      } catch (e) { if (window.KT2_LOOP_KEEP_OFF) throw e; console.warn("loop cuts", c.id, e); }
    }
  }
  // a small icon in the title of clips made with Shift+drag: click = the rhythm menu
  function icon(node, c) {
    if (NOICON) { const o = node.querySelector(".k2rh-ico"); if (o) o.remove(); return; }
    const label = node.querySelector(".clip-label");
    if (!label || label.querySelector(".k2rh-ico")) return;
    const b = el("button", "k2rh-ico" + (SQ ? " sq" : ""));
    b.innerHTML = SQ ? '<svg viewBox="0 0 8 8" width="8" height="8"><rect x="0" y="0" width="3.2" height="3.2"/><rect x="4.8" y="0" width="3.2" height="3.2" opacity=".45"/><rect x="0" y="4.8" width="3.2" height="3.2" opacity=".45"/><rect x="4.8" y="4.8" width="3.2" height="3.2"/></svg>'
      : '<svg viewBox="0 0 12 8" width="11" height="7"><circle cx="1.5" cy="4" r="1.4"/><circle cx="4.5" cy="4" r="1"/><circle cx="7.5" cy="4" r="1.4"/><circle cx="10.5" cy="4" r="1"/></svg>';
    b.title = "Rhythm";
    b.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
    b.addEventListener("click", (e) => { e.stopPropagation(); if (P.id === c.id) closePanel(); else openPanel(c.id); });
    const nm = label.querySelector(".nm");
    if (nm) nm.after(b); else label.prepend(b);
  }
  function overlay(c, node, sig) {
    const ov = el("div", "k2rh-ov"), ts = tickSec(), T = ticksOf(c), r = c.rhythm, start = r.startAt || 0;
    ov.dataset.sig = sig;
    const barPx = toX(secPerBar()), beatPx = toX(secPerBeat());
    ov.style.setProperty("--bar", barPx + "px"); ov.style.setProperty("--beat", beatPx + "px");
    const parts = partsOf(c);
    if (parts.length > 1 || (parts.length === 1 && (parts[0].a > 0 || parts[0].b < T))) parts.forEach((q, i) => {
      const d = el("div", "k2rh-part" + (i % 2 ? " alt" : ""));
      d.style.left = toX(q.a * ts) + "px"; d.style.width = toX((q.b - q.a) * ts) + "px";
      ov.append(d);
    });
    // where the rhythm loops round (each part, every period from its start): a cut in the clip, like FL's looped clips
    if (SLICES && NOTCH) {
      // a cut wherever the sound starts again: each hit after the clip's first edge (6 kicks = 6 starts, the first is the edge)
      let last = -1e9;
      for (const h of r.hits || []) {
        if (h >= T) break;
        if (h <= 0 || h < start) continue;
        const x = toX(h * ts);
        if (x - last < 8) continue;   // zoomed far out: too close together to read
        const sl = el("i", "k2rh-slice k2rh-notch"); sl.style.left = x + "px"; ov.append(sl); last = x;
      }
    } else if (SLICES) for (const q of parts) {
      const per = q.period || BAR;
      const minPx = NOTCH ? 8 : 14, cls = NOTCH ? "k2rh-slice k2rh-notch" : "k2rh-slice";
      if (toX(per * ts) < minPx) continue;   // zoomed far out: too close together to read
      for (let t = q.a + per; t < q.b - 1e-6; t += per) { const sl = el("i", cls); sl.style.left = toX(t * ts) + "px"; ov.append(sl); }
      if (q.b < T && toX((q.b - q.a) * ts) >= minPx) { const sl = el("i", cls); sl.style.left = toX(q.b * ts) + "px"; ov.append(sl); }
    }
    // silent part before the START flag, with the hits it keeps quiet shown as ghosts
    if (start > 0) { const pre = el("div", "k2rh-pre"); pre.style.width = toX(start * ts) + "px"; ov.append(pre); }
    const marks = el("div", "k2rh-marks");
    for (const h of r.hits || []) {
      if (h >= T) break;
      if (NOTCH && SLICES && h >= start) continue;   // the cut shows where it plays
      const m = el("i", h < start ? "ghost" : "");
      m.style.left = toX(h * ts) + "px";
      marks.append(m);
    }
    ov.append(marks);
    if (P.id === c.id && P.sel) for (const [a, b] of P.sel) {
      const s = el("div", "k2rh-selbox");
      s.style.left = toX(a * ts) + "px"; s.style.width = toX((Math.min(T, b) - a) * ts) + "px";
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

  // ---------------------------------------------------------------- the menu (Eman, 11 Nov 02:48-02:54)
  // Opens from the clip menu (RHYTHM) or the clip's small icon, right under the clip, in tabs. The parts of
  // the pattern are picked ON the clip: drag inside it to mark a stretch, click a part to pick it, Shift-click to
  // add one more. Nothing picked = the whole clip. While it is open the other clips go dark.
  const P = { id: null, el: null, sel: null, role: null, tab: null, sig: "" };
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } } };
  const mode = () => (LS.get("kt2.rhythm.mode") === "track" ? "track" : "loop");
  const K2 = () => window.KT2 || {};

  function openPanel(id) {
    const c = clipOf(id);
    if (!c || !c.rhythm) return;
    if (P.id !== id) { closePanel(); P.sel = null; P.tab = null; P.role = DRUMS1 ? (c.rhythm.rolePick && ROLES.some((x) => x.id === c.rhythm.role) ? c.rhythm.role : roleOf(c)) : c.rhythm.role || guessRole(c.name); P.pick = false; }
    P.id = id;
    if (!isSel(id) && typeof selectClip === "function") selectClip(id);
    if (!P.el) { P.el = el("div", "k2rh-panel"); document.body.append(P.el); if (FIX) P.el.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); }); }
    const K = K2(); K.spot = id; if (K.spotlight) K.spotlight();   // the rest goes dark
    paint(); decorate();
  }
  function closePanel() {
    if (!P.el) return;
    P.el.remove(); P.el = null; const id = P.id; P.id = null; P.sel = null;
    const K = K2(); if (K.spot === id) { K.spot = null; if (K.spotlight) K.spotlight(); }
    if (id) decorate();
  }
  function keepPanel() {
    const c = clipOf(P.id);
    if (!c || !c.rhythm) return closePanel();
    const sig = JSON.stringify([c.rhythm, c.length]);
    if (sig !== P.sig) paint(); else place();   // undo / redo (Cmd+Z too) show at once
    const K = K2(); if (K.spot !== P.id && ui.selectedClip === P.id) { K.spot = P.id; if (K.spotlight) K.spotlight(); }
  }
  function place() {
    const node = document.querySelector(`#rows .clip[data-clip-id="${P.id}"]`);
    if (!node || !P.el) return;
    const q = node.getBoundingClientRect(), w = P.el.offsetWidth, h = P.el.offsetHeight;
    const left = Math.max(8, Math.min(innerWidth - w - 8, q.left));
    let top = q.bottom + 6;
    const room = innerHeight - 8 - top;
    if (room >= 170 || room >= q.top - 14) P.el.style.maxHeight = Math.max(120, room) + "px";
    else { P.el.style.maxHeight = (q.top - 14) + "px"; top = Math.max(8, q.top - Math.min(h, q.top - 14) - 6); }
    P.el.style.left = left + "px"; P.el.style.top = top + "px";
  }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && P.el) { closePanel(); e.stopPropagation(); } }, true);
  // Space with the menu open plays like the menu's play button: LOOP = only this pattern, on repeat (Eman 11 Nov 21:44:
  // it played the whole song). KT2_RHYTHM_SPACE_OLD = Space plays the song as everywhere else.
  addEventListener("keydown", (e) => {
    if (window.KT2_RHYTHM_SPACE_OLD || !P.el || e.key !== " " || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    play();
  }, true);
  addEventListener("resize", () => P.el && place());
  document.addEventListener("scroll", () => P.el && place(), true);

  // pick parts on the clip while the menu is open
  const pickStep = (ts) => [6, 12, 24, 48, 96].find((k) => toX(k * ts) >= 14) || 96;
  document.addEventListener("mousedown", (e) => {
    if (!P.el || e.button !== 0) return;
    if (P.el.contains(e.target) || (e.target.closest && e.target.closest(".menu, #pop, .k2-menu"))) return;
    if (FIX && e.target.closest && e.target.closest(".k2x-tip, .toast, #toast")) return;   // a tip card or toast on top: not a click away
    const node = e.target.closest && e.target.closest("#rows .clip[data-clip-id]");
    if (!node || node.dataset.clipId !== P.id) { closePanel(); return; }
    if (e.target.closest(".clip-label, .edge, .k2rh-start, button, .fade-h, .k2-fade, .k2-vol, .gain-line") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (stretchTarget(e)) return;   // Shift on the right end: the stretch, as always
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const c = clipOf(P.id), ts = tickSec(), T = ticksOf(c), q = node.getBoundingClientRect();
    const tAt = (x) => Math.max(0, Math.min(T, (x - q.left) / ui.pxPerSec / ts));
    const t0 = tAt(e.clientX), add = e.shiftKey, keep = add && P.sel ? P.sel.slice() : [];
    let moved = false, rng = null;
    const show = () => { const s = keep.concat(rng ? [rng] : []); P.sel = s.length ? merge(s) : null; decorate(); paintRange(); };
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - e.clientX) < 4) return;
      moved = true;
      const st = pickStep(ts), t1 = tAt(ev.clientX);
      const a = Math.floor(Math.min(t0, t1) / st) * st, b = Math.min(T, Math.ceil(Math.max(t0, t1) / st) * st);
      rng = b > a ? [a, b] : null; show();
    };
    const up = () => {
      removeEventListener("mousemove", move, true); removeEventListener("mouseup", up, true);
      if (!moved) {   // a click: the part under it (Shift = add / take away), or the whole clip again
        const part = partsOf(c).find((p) => t0 >= p.a && t0 < p.b);
        const all = !part || partsOf(c).length < 2;
        if (all && !add) P.sel = null;
        else if (part) {
          const has = keep.some(([a, b]) => a === part.a && b === part.b);
          const s = add ? (has ? keep.filter(([a, b]) => !(a === part.a && b === part.b)) : keep.concat([[part.a, part.b]])) : [[part.a, part.b]];
          P.sel = s.length ? merge(s) : null;
        }
        decorate(); paintRange();
      }
      if (P.sel && P.sel.length === 1 && P.sel[0][0] <= 0 && P.sel[0][1] >= T) P.sel = null;
      paint();
    };
    addEventListener("mousemove", move, true); addEventListener("mouseup", up, true);
  }, true);
  function merge(list) {
    const s = list.map((x) => x.slice()).sort((x, y) => x[0] - y[0]), out = [];
    for (const r of s) { const l = out[out.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else out.push(r); }
    return out;
  }
  const ranges = (c) => P.sel || [[0, ticksOf(c)]];
  function apply(p) {
    const f = clipOf(P.id); if (!f || !f.rhythm) return;
    let nr = f.rhythm;
    for (const [a, b] of ranges(f)) nr = fill(nr, a, b, p, p.id);
    // hits / parts left past the end (the clip was trimmed, e.g. a sound dropped on top of it) went on hiding there and
    // came back on the next Shift-drag: a rhythm picked now is all there is
    if (FIX) { const T = ticksOf(f); nr = { ...nr, hits: (nr.hits || []).filter((h) => h < T), parts: (nr.parts || []).filter((q) => q.a < T).map((q) => ({ ...q, b: Math.min(q.b, T) })) }; }
    nr.role = P.role;
    if (DRUMS1 && P.pick) nr.rolePick = true;   // picked by hand: it opens on that one next time
    send(f, nr);
  }

  // LOOP plays this pattern on repeat, TRACK plays the song from the marker (like the lane window's switch)
  const playingNow = () => !!(ui.transport && ui.transport.playing);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = async (want) => { for (let i = 0; i < 25 && playingNow() !== want; i++) await sleep(40); };
  let busy = null;
  async function stopAll() {
    const K = K2();
    if (K.loopClip && K.endClipLoop) K.endClipLoop();
    if (playingNow()) { await run("togglePlay"); await settle(false); }
  }
  async function startMode() {
    const K = K2(), c = clipOf(P.id);
    if (mode() === "loop" && c) {
      if (K.loopClip === c.id) { if (!playingNow()) await run("togglePlay"); }   // still armed (Space paused it)
      else {
        if (K.loopClip && K.endClipLoop) K.endClipLoop();
        const r = await booth("laneSolo", { trackId: c.track.id, clipId: c.id, clipLoop: true });
        if (!(r && r.ok)) return run("togglePlay");
        K.loopClip = c.id; if (K.spotlight) K.spotlight();
        await sleep(250);
        if (K.loopClip === c.id && !playingNow()) await run("togglePlay");
      }
    } else {
      if (K.loopClip && K.endClipLoop) K.endClipLoop();
      await settle(false);
      if (!playingNow()) await run("togglePlay");
    }
    await settle(true);
  }
  // one at a time: fast clicks queue up instead of fighting over the transport
  const queue = (fn) => (busy = (busy || Promise.resolve()).then(fn, fn).finally(() => { paintPlay(); }));
  function play() {
    if (!FIX) return playOld();
    return queue(async () => { if (playingNow()) await stopAll(); else await startMode(); });
  }
  async function playOld() {
    const K = K2(), c = clipOf(P.id);
    if (playingNow() || K.loopClip) { if (K.loopClip && K.endClipLoop) K.endClipLoop(); if (playingNow()) await run("togglePlay"); paintPlay(); return; }
    if (mode() === "loop" && c) {
      const r = await booth("laneSolo", { trackId: c.track.id, clipId: c.id, clipLoop: true });
      if (r && r.ok) { K.loopClip = c.id; if (K.spotlight) K.spotlight(); setTimeout(() => { if (K.loopClip === c.id && !playingNow()) run("togglePlay"); paintPlay(); }, 250); return; }
    }
    await run("togglePlay"); paintPlay();
  }
  function paintPlay() { const b = P.el && P.el.querySelector(".k2rh-play"); if (b) b.classList.toggle("on", FIX ? playingNow() : playingNow() || !!K2().loopClip); }
  setInterval(() => { if (P.el) paintPlay(); }, 300);

  const svgDots = (p) => {
    const per = p.period, beats = per / PPQ;
    const lines = Array.from({ length: beats - 1 }, (_, i) => `<rect class="g" x="${((i + 1) / beats) * 100 - 0.2}" y="2" width="0.4" height="6"/>`).join("");
    const dots = p.hits.map((h, i) => `<circle class="${h % (PPQ * 4) === 0 ? "one" : "d"}" cx="${(h / per) * 100 + 1.4}" cy="5" r="${p.hits.length > 24 ? 1 : 1.5}"/>`).join("");
    return `<svg viewBox="0 0 102 10">${lines}${dots}</svg>`;
  };
  function paintRange() {
    const c = clipOf(P.id), lbl = P.el && P.el.querySelector(".k2rh-range");
    if (!c || !lbl) return;
    const n = P.sel ? P.sel.length : 0, bars = (t) => Math.round((t / BAR) * 100) / 100;
    lbl.textContent = !n ? "WHOLE CLIP" : n === 1 ? (() => { const [a, b] = P.sel[0], x = Math.floor(a / BAR) + 1, y = Math.ceil(b / BAR); return x === y ? "BAR " + x : "BARS " + x + "-" + y; })() : n + " PARTS";
  }
  // the always-there step grid: one loop of the pattern (1 bar, or 2 for 2-bar rhythms like Trap), 1/16 steps.
  // Hits off the 1/16 grid (triplets, 1/32) light the step they fall in; editing puts them on the grid.
  function stepBar(r, rs) {
    const [a0, b0] = rs[0], q = (r.parts || []).find((x) => x.a <= a0 && x.b > a0);
    const per = q && q.period >= BAR * 2 && b0 - a0 >= BAR * 2 ? BAR * 2 : BAR, n = per / 6;
    const on = Array.from({ length: n }, (_, i) => (r.hits || []).some((h) => h >= a0 + i * 6 && h < a0 + i * 6 + 6 && h < b0));
    const wrap = el("div", "k2rh-steps" + (n > 16 ? " two" : ""));
    const cells = on.map((v, i) => {
      const d = el("button", "k2rh-step" + (v ? " on" : "") + (Math.floor(i / 4) % 2 ? "" : " beat"));
      d.dataset.i = i; d.title = v ? "Drag to move, right-click to remove" : "Click to add a hit";
      wrap.append(d); return d;
    });
    const commit = (st) => apply({ id: "steps", period: per, hits: st.map((x, k) => (x ? k * 6 : -1)).filter((k) => k >= 0) });
    const idxAt = (x, y) => { const e = document.elementFromPoint(x, y), s = e && e.closest && e.closest(".k2rh-step"); return s && wrap.contains(s) ? +s.dataset.i : null; };
    wrap.addEventListener("contextmenu", (e) => {
      e.preventDefault(); e.stopPropagation();
      const i = idxAt(e.clientX, e.clientY);
      if (i == null || !on[i]) return;
      on[i] = false; commit(on.slice());
    });
    wrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const i = idxAt(e.clientX, e.clientY);
      if (i == null) return;
      e.preventDefault();
      if (!on[i]) { on[i] = true; cells[i].classList.add("on"); commit(on.slice()); return; }
      // drag a hit to another step
      let to = i;
      cells[i].classList.add("drag");
      const move = (ev) => {
        const j = idxAt(ev.clientX, ev.clientY);
        if (j == null || j === to) return;
        to = j;
        cells.forEach((c, k) => { c.classList.toggle("on", k === to || (on[k] && k !== i)); c.classList.toggle("drag", k === to); });
      };
      const up = () => {
        removeEventListener("mousemove", move, true); removeEventListener("mouseup", up, true);
        cells.forEach((c) => c.classList.remove("drag"));
        if (to === i) return;
        on[i] = false; on[to] = true; commit(on.slice());
      };
      addEventListener("mousemove", move, true); addEventListener("mouseup", up, true);
    });
    return wrap;
  }
  function paint() {
    const c = clipOf(P.id);
    if (!c || !c.rhythm || !P.el) return closePanel();
    P.sig = JSON.stringify([c.rhythm, c.length]);
    const r = c.rhythm, T = ticksOf(c);
    if (P.sel) { P.sel = merge(P.sel.map(([a, b]) => [a, Math.min(b, T)]).filter(([a, b]) => b > a)); if (!P.sel.length) P.sel = null; }
    const rs = ranges(c), on = (() => { const ids = new Set(rs.map(([a, b]) => { const q = (r.parts || []).find((x) => x.a <= a && x.b >= b); return q ? q.id : "?"; })); return ids.size === 1 ? [...ids][0] : null; })();
    const pn = P.el;
    pn.innerHTML = "";
    // top: LOOP | TRACK + play, then undo / redo / reset / close
    const top = el("div", "k2rh-top");
    const seg = el("div", "k2rh-seg");
    for (const m of [["loop", "LOOP"], ["track", "TRACK"]]) {
      const b = el("button", mode() === m[0] ? "on" : "", m[1]);
      b.title = m[0] === "loop" ? "Loop only this pattern" : "Play it in the track, from the marker";
      b.onclick = FIX
        // while playing: stop, wait for the stop, then play in the new mode (it played the song in LOOP before)
        ? () => { if (mode() === m[0]) return; LS.set("kt2.rhythm.mode", m[0]); paint(); queue(async () => { if (playingNow()) { await stopAll(); await startMode(); } }); }
        : async () => { if (mode() === m[0]) return; const was = playingNow() || !!K2().loopClip; if (was) await play(); LS.set("kt2.rhythm.mode", m[0]); paint(); if (was) await play(); };
      seg.append(b);
    }
    const pl = el("button", "k2rh-play");
    pl.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4.5 3.2v9.6L12.5 8z"/></svg>';
    pl.title = "Play / stop"; pl.onclick = play;
    const ib = (cls, svg, tip, fn) => { const b = el("button", "k2rh-ib " + cls); b.innerHTML = svg; b.title = tip; b.onclick = fn; return b; };
    const undo = ib("undo", '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M6 4L2.5 7.5 6 11M3 7.5h6.5a3.5 3.5 0 0 1 0 7H8"/></svg>', "Undo (Cmd+Z)", () => run("undo"));
    const redo = ib("redo", '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M10 4l3.5 3.5L10 11M13 7.5H6.5a3.5 3.5 0 0 0 0 7H8"/></svg>', "Redo (Cmd+Shift+Z)", () => run("redo"));
    const reset = el("button", "k2rh-reset", "RESET");
    reset.title = "Back to the empty pattern with the one hit";
    reset.onclick = () => { const f = clipOf(P.id); if (f) { P.sel = null; send(f, { hits: [0], startAt: 0, parts: [], role: P.role }); } };
    const x = ib("x", '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 4l8 8M12 4l-8 8"/></svg>', "Close (Esc)", closePanel);
    const ae = NOICON && window.KT2AudioEdit ? el("button", "k2rh-reset k2rh-ae", "AUDIO EDITOR") : null;
    if (ae) { ae.title = "Open this clip in the audio editor"; ae.onclick = () => { const id = P.id; closePanel(); const f = clipOf(id); if (f) KT2AudioEdit.open(f); }; }
    top.append(...[seg, pl, el("span", "k2rh-sp"), undo, redo, reset, ae, x].filter(Boolean));
    // tabs + what is picked
    const TABS = [{ id: "every", name: "EVERY", list: EVERY }, { id: "grooves", name: "GROOVES", list: GROOVES }, { id: "drums", name: "DRUMS", list: DRUMS }].concat(STEPBAR ? [] : [{ id: "steps", name: "STEPS" }]);
    if (STEPBAR && P.tab === "steps") P.tab = null;
    if (!P.tab) P.tab = (on === "steps" && "steps") || (DRUMS1 ? "drums" : (TABS.find((t) => t.list && t.list.some((q) => q.id === on)) || TABS[0]).id);
    const tabs = el("div", "k2rh-tabs");
    for (const t of TABS) {
      const tb = el("button", "k2rh-tab" + (P.tab === t.id ? " on" : ""), t.name);
      tb.dataset.tab = t.id;
      tb.onclick = () => { P.tab = t.id; paint(); };
      tabs.append(tb);
    }
    tabs.append(el("span", "k2rh-sp"), el("span", "k2rh-range"));
    pn.append(top);
    if (STEPBAR) pn.append(stepBar(r, rs));
    pn.append(tabs);
    const cur = TABS.find((t) => t.id === P.tab) || TABS[0];
    if (cur.id === "steps") {
      const st = steps16(r, rs[0][0]), grid = el("div", "k2rh-steps");
      st.forEach((v, i) => {
        const d = el("button", "k2rh-step" + (v ? " on" : "") + (i % 4 === 0 ? " beat" : ""));
        d.onclick = () => { st[i] = !st[i]; apply({ id: "steps", period: BAR, hits: st.map((s, k) => (s ? k * 6 : -1)).filter((k) => k >= 0) }); };
        grid.append(d);
      });
      pn.append(grid);
    } else {
      if (cur.id === "drums") {
        const roles = el("div", "k2rh-roles");
        for (const ro of ROLES) { const rb = el("button", P.role === ro.id ? "on" : "", ro.name); rb.dataset.role = ro.id; rb.onclick = () => { P.role = ro.id; P.pick = true; paint(); }; roles.append(rb); }
        pn.append(roles);
      }
      const box = el("div", "k2rh-tiles");
      const list = cur.id === "drums" && FXTAB && P.role === "f" ? FXR : cur.list;
      for (const it of list) {
        const p = it.f ? fxPreset(it) : it.k ? preset(it.id, P.role) : it;
        // "4 bars" on a 2-bar clip is just the first hit (same as 2 bars and RESET): dimmed so it doesn't look broken
        const span = Math.max(...rs.map(([a, b]) => b - a)), long = FIX && p.hits.length === 1 && p.period >= span;
        const tb = el("button", "k2rh-tile" + (on === it.id ? " on" : "") + (long ? " long" : ""));
        if (long) tb.title = "Longer than this " + (P.sel ? "part" : "clip") + ": just the first hit";
        tb.dataset.id = it.id;
        tb.innerHTML = `<b>${it.name}</b>` + svgDots(p);
        tb.onclick = () => apply(p);
        box.append(tb);
      }
      pn.append(box);
    }
    paintRange(); paintPlay();
    requestAnimationFrame(place);
  }

  // the clip menu (right-click / the corner arrow) gets RHYTHM and BACK TO ONE HIT on these clips
  if (typeof showMenu === "function") {
    const _show = showMenu;
    window.showMenu = showMenu = function (anchor, items, ...more) {
      try {
        const c = ui.selectedClip && !(ui.extraClips && ui.extraClips.size) ? clipOf(ui.selectedClip) : null;
        if (c && c.rhythm && Array.isArray(items) && items[0] && items[0].heading && items.some((x) => x && /^(Rename|Delete)$/.test(x.label || ""))) {
          items = [items[0], { label: "Rhythm", meta: "pick a rhythm", run: () => openPanel(c.id) }, { label: "Back to one hit", run: () => { closePanel(); send(c, null); } }].concat(NOICON && window.KT2AudioEdit ? [{ label: "Open in audio editor", run: () => { closePanel(); const f = clipOf(c.id); if (f) KT2AudioEdit.open(f); } }] : [], items.slice(1));
        }
      } catch (e) { /* the menu as it was */ }
      return _show.call(this, anchor, items, ...more);
    };
  }

  // ---------------------------------------------------------------- style
  const css = document.createElement("style");
  css.textContent = `
  .k2rh-ov { position: absolute; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; z-index: 7;
    background-image: repeating-linear-gradient(90deg, rgba(0,0,0,.28) 0 1px, transparent 1px var(--bar)), repeating-linear-gradient(90deg, rgba(0,0,0,.12) 0 1px, transparent 1px var(--beat)); }
  .k2rh-part { position: absolute; top: 18px; bottom: 0; background: rgba(255,255,255,.07); box-shadow: inset 1px 0 0 rgba(0,0,0,.55); }
  .k2rh-part.alt { background: rgba(0,0,0,.16); }
  .k2rh-pre { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(20,20,22,.55); }
  .k2rh-marks { position: absolute; left: 0; right: 0; bottom: 2px; height: 5px; }
  .k2rh-marks i { position: absolute; bottom: 0; width: 2px; height: 5px; background: rgba(0,0,0,.55); }
  .k2rh-marks i.ghost { background: transparent; box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); height: 4px; width: 3px; }
  .k2rh-selbox { position: absolute; top: 0; bottom: 0; background: rgba(228,255,58,.16); box-shadow: inset 0 0 0 1.5px ${ACID}; }
  .clip.k2rh-editing { cursor: text; }
  .clip.k2rh-editing .clip-label { cursor: grab; }
  .k2rh-start { position: absolute; top: 0; bottom: 0; width: 1px; pointer-events: none; z-index: 4; }
  .k2rh-start::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 1px; background: ${ACID}; opacity: .5; }
  .k2rh-start::after { content: ""; position: absolute; left: 0; bottom: 0; width: 8px; height: 8px; background: ${ACID}; pointer-events: auto; cursor: ew-resize; }
  .k2rh-start.moved::before { opacity: 1; }
  .clip.k2rh-can, .clip.k2rh-can * { cursor: ew-resize !important; }
  .clip.k2rh-stretching { box-shadow: inset 0 0 0 2px ${ACID} !important; }
  .k2rh-tag { position: absolute; right: 4px; bottom: 3px; font: 700 9px/1 var(--font, system-ui); letter-spacing: .08em; color: #111; background: ${ACID}; padding: 2px 4px; z-index: 6; pointer-events: none; }
  ${FIX ? ".kt2 .clip .clip-label .k2rh-ico { pointer-events: auto; position: relative; z-index: 3; }" : ""}
  .k2rh-ico { display: inline-grid; place-items: center; height: 12px; padding: 0 3px; margin-left: 4px; border: 0; border-radius: 6px; background: rgba(0,0,0,.28); cursor: pointer; flex: none; }
  .k2rh-ico svg { fill: ${ACID}; display: block; }
  .k2rh-ico:hover { background: rgba(0,0,0,.5); }
  .k2rh-ico.sq { width: 12px; height: 12px; padding: 0; border-radius: 2px; background: rgba(0,0,0,.2); color: inherit; }
  .k2rh-ico.sq svg { fill: currentColor; }
  .k2rh-ico.sq:hover { background: rgba(0,0,0,.4); }
  .clip.k2rh-editing .k2rh-ico.sq { background: ${ACID}; color: #141218; }
  .k2rh-slice { position: absolute; top: 18px; bottom: 0; width: 0; z-index: 3; box-shadow: 0 0 0 .5px rgba(0,0,0,.45); }
  .k2rh-slice::before, .k2rh-slice::after { content: ""; position: absolute; left: -3px; width: 6px; height: 4px; background: var(--bg, #161618); }
  .k2rh-slice::before { top: 0; border-radius: 0 0 3px 3px; }
  .k2rh-slice::after { bottom: 0; border-radius: 3px 3px 0 0; }
  .k2rh-slice.k2rh-notch { top: 0; box-shadow: none; }
  .k2rh-slice.k2rh-notch::before, .k2rh-slice.k2rh-notch::after { left: -5px; width: 10px; height: 6px; border-radius: 0; background: var(--bg, #161618); }
  .k2rh-slice.k2rh-notch::before { top: -0.5px; clip-path: polygon(0 0, 100% 0, 50% 100%); }
  .k2rh-slice.k2rh-notch::after { bottom: -0.5px; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
  .k2rh-panel { position: fixed; z-index: 9000; width: 440px; max-width: calc(100vw - 16px); overflow: auto; background: #1c1c20; color: #ececee; border-radius: 12px;
    box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 16px 44px rgba(0,0,0,.6); padding: 10px; font: 600 11px/1.2 var(--font, system-ui); user-select: none; }
  .k2rh-top, .k2rh-tabs { display: flex; align-items: center; gap: 4px; }
  .k2rh-top { margin-bottom: 10px; }
  .k2rh-sp { flex: 1; }
  .k2rh-seg { display: flex; border-radius: 8px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
  .k2rh-seg button { height: 26px; padding: 0 11px; font: 700 10px/1 var(--font, system-ui); letter-spacing: .12em; color: rgba(255,255,255,.6); background: none; border: 0; cursor: pointer; }
  .k2rh-seg button.on { background: ${ACID}; color: #0d0d10; }
  .k2rh-play { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: ${ACID}; background: none; border: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); cursor: pointer; margin-left: 2px; }
  .k2rh-play svg { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; }
  .k2rh-play.on { background: ${ACID}; color: #0d0d10; }
  .k2rh-play.on svg path { d: path("M4.5 4.5h7v7h-7z"); fill: currentColor; }
  .k2rh-ib { width: 26px; height: 26px; border-radius: 8px; border: 0; background: none; color: rgba(255,255,255,.65); display: grid; place-items: center; cursor: pointer; }
  .k2rh-ib svg { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .k2rh-ib:hover, .k2rh-reset:hover { background: rgba(255,255,255,.08); color: #fff; }
  .k2rh-reset { height: 26px; padding: 0 9px; border-radius: 8px; border: 0; background: none; color: rgba(255,255,255,.65); font: 700 10px/1 var(--font, system-ui); letter-spacing: .1em; cursor: pointer; }
  .k2rh-tabs { margin-bottom: 8px; }
  .k2rh-tab { background: none; border: 0; border-radius: 7px; color: rgba(255,255,255,.45); font: 700 10px/1 var(--font, system-ui); letter-spacing: .12em; padding: 6px 8px; cursor: pointer; }
  .k2rh-tab:hover { color: #fff; }
  .k2rh-tab.on { color: #fff; background: rgba(255,255,255,.08); }
  .k2rh-range { color: rgba(255,255,255,.4); font: 600 9.5px/1 var(--font, system-ui); letter-spacing: .1em; }
  .k2rh-roles { display: flex; gap: 2px; margin: 0 0 8px; }
  .k2rh-roles button { flex: 1; height: 24px; border: 0; border-radius: 7px; background: rgba(255,255,255,.04); color: rgba(255,255,255,.55); font: 700 9.5px/1 var(--font, system-ui); letter-spacing: .12em; cursor: pointer; }
  .k2rh-roles button.on { background: rgba(255,255,255,.12); color: #fff; }
  .k2rh-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
  .k2rh-tile { background: #26262b; border: 0; border-radius: 9px; color: #f2f2f4; text-align: left; padding: 7px 8px 7px; cursor: pointer; display: grid; gap: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.05); font: inherit; }
  .k2rh-tile b { font: 650 11.5px/1.15 var(--font, system-ui); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .k2rh-tile svg { width: 100%; height: 10px; overflow: visible; }
  .k2rh-tile svg .g { fill: rgba(255,255,255,.13); }
  .k2rh-tile svg .d { fill: #a99bff; }
  .k2rh-tile svg .one { fill: ${ACID}; }
  .k2rh-tile:hover { background: #2d2d33; }
  .k2rh-tile.on { box-shadow: inset 0 0 0 2px ${ACID}; }
  .k2rh-tile.long { opacity: .45; }
  .k2rh-steps { display: grid; grid-template-columns: repeat(16, 1fr); gap: 3px; padding: 2px 0 2px; }
  .k2rh-step { height: 30px; border: 0; border-radius: 6px; background: #2a2a2f; cursor: pointer; padding: 0; }
  .k2rh-step.beat { background: #34343a; }
  .k2rh-step.on { background: ${ACID}; }
  .k2rh-step:hover:not(.on) { background: #404046; }
  .k2rh-steps.two { grid-template-columns: repeat(16, 1fr); row-gap: 4px; }
  .k2rh-steps.two .k2rh-step { height: 22px; }
  .k2rh-panel > .k2rh-steps { margin: 0 0 10px; }
  .k2rh-step.on { cursor: grab; }
  .k2rh-step.drag { box-shadow: 0 0 0 2px #fff inset; }
  body.look-light .k2rh-panel { background: #f1f1f3; color: #1b1b1e; }
  body.look-light .k2rh-tile { background: #fff; color: #1b1b1e; }
  `;
  document.head.append(css);

  window.KT2Rhythm = { EVERY, GROOVES, DRUMS, FXR, preset, roleOf, roleIn, fill, extend, guessRole, steps16, open: openPanel, close: closePanel, decorate, state: P };
})();
