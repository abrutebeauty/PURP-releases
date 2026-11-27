// KILLTOY 2 explainers (Eman, 7 Nov 23:05: "imagine 100 people trying it out with different levels
// of understanding, add explainers if someone is stuck"). Small first-use tips, one at a time:
// a square card next to the thing it explains, a purple outline on that thing, x to close.
// Each tip shows once (localStorage kt2.explain.seen), and also goes away for good once you
// do what it says (press the thing, play, make a pattern...).
//
// It also gives the ? menu a KILLTOY 2 "Show me around" (the KILLTOY 1 tour stays as
// KillToyTour.tours.welcomeK1), a KEYS sheet with every shortcut, and TIPS ON / OFF. The
// KILLTOY 1 tours that point at parts KT2 doesn't have (clips rack, A button, version pills)
// leave the menu while this is on, and come back when it's off. Two old texts that talk about
// KILLTOY 1 (the empty-project card, the empty rack) get KT2 words while it's on.
//
// Off: window.KT2_EXPLAIN_OFF = true before load, or TIPS OFF in the ? menu (kt2.explain = "off").
// Never during a quest (html.kq-on: quests teach on their own) or a tour. Keep it ASCII-only.
"use strict";

window.KT2Explain = (function () {
  const html = document.documentElement;
  if (!html.classList.contains("kt2") || window.KT2_EXPLAIN_OFF) return null;

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private window: tips just show again */ } },
  };
  const SEEN_KEY = "kt2.explain.seen", OFF_KEY = "kt2.explain";
  let seen = {};
  try { seen = JSON.parse(store.get(SEEN_KEY) || "{}") || {}; } catch (e) { seen = {}; }
  const markSeen = (id) => { seen[id] = 1; store.set(SEEN_KEY, JSON.stringify(seen)); };
  const isOn = () => store.get(OFF_KEY) !== "off";
  const q = (s, r) => (r || document).querySelector(s);
  const vis = (e) => { if (!e || !e.isConnected) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(e).visibility !== "hidden"; };
  const U = () => (typeof ui !== "undefined" ? ui : null);   // app.js keeps ui as a top-level const, not on window
  const S = () => U() && U().state;
  const onHome = () => !!(U() && U().home);
  // any pattern window open (the MIDI tab has no .tm-root, so song tips like PLAY sat on top of the open
  // note grid; bug check as 50 users, 8 Nov). KT2_EXPLAIN_WIN_OLD = old (only the synth tab counted).
  const inWindow = () => window.KT2_EXPLAIN_WIN_OLD ? !!q("#iw .tm-root") : !!(q("#iw .tm-root") || (q("#iw") && !q("#iw").hidden));
  const byText = (sel, re) => [...document.querySelectorAll(sel)].find((e) => vis(e) && re.test(e.textContent.trim()));

  // ------------------------------------------------------------------ look
  const css = document.createElement("style");
  css.textContent = `
  .k2x-tip { position: fixed; z-index: 2147481000; max-width: 270px; padding: 9px 30px 10px 11px; background: #1d1c22; color: #ececee;
    border: 1px solid rgba(139, 108, 255, 0.5); border-left: 3px solid #8b6cff; border-radius: 0; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    font: 500 12px/1.45 Inter, system-ui, sans-serif; letter-spacing: 0; pointer-events: auto; animation: k2x-in 0.22s ease-out; }
  .k2x-tip h6 { margin: 0 0 3px; font: 700 10px/1.2 Inter, system-ui, sans-serif; letter-spacing: 0.14em; color: #a68cff; text-transform: uppercase; }
  .k2x-tip b { color: #fff; font-weight: 700; }
  .k2x-tip kbd { display: inline-block; padding: 0 4px; border: 1px solid rgba(255, 255, 255, 0.22); font: 600 10px/15px Inter, system-ui, sans-serif; color: #fff; }
  .k2x-tip .k2x-x { all: unset; position: absolute; top: 5px; right: 6px; width: 18px; height: 18px; line-height: 17px; text-align: center; cursor: pointer; color: rgba(236, 236, 238, 0.55); font-size: 15px; }
  .k2x-tip .k2x-x:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
  .k2x-ring { position: fixed; z-index: 2147480999; pointer-events: none; border: 1.5px solid #8b6cff; border-radius: 0;
    box-shadow: 0 0 0 3px rgba(139, 108, 255, 0.18), 0 0 18px rgba(139, 108, 255, 0.45); animation: k2x-pulse 1.6s ease-in-out infinite; }
  @keyframes k2x-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes k2x-pulse { 50% { box-shadow: 0 0 0 5px rgba(139, 108, 255, 0.1), 0 0 26px rgba(139, 108, 255, 0.6); } }
  /* speed pass 27 Nov: a pulsing box-shadow repaints the whole screen 60 times a second (with 100 patterns that was 60% of
     the idle work). The glow now fades in and out on its own layer (only its see-through changes): the same pulse, no repaint.
     window.KT2_GLOW_OLD = the old pulse. */
  html:not(.k2-glow-old) .k2x-ring { animation: none; }
  html:not(.k2-glow-old) .k2x-ring::after { content: ""; position: absolute; inset: -1.5px; pointer-events: none; box-shadow: 0 0 0 5px rgba(139, 108, 255, 0.1), 0 0 26px rgba(139, 108, 255, 0.6); opacity: 0; animation: k2x-pulse2 1.6s ease-in-out infinite; }
  @keyframes k2x-pulse2 { 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .k2x-tip, .k2x-ring, .k2x-ring::after { animation: none; } }
  /* the tours in KT2 colours: square, purple buttons (yellow stays for marker, loop, selection) */
  html.k2x-on .kt-card, html.k2x-on .kt-invite, html.k2x-on .kt-spot, html.k2x-on .kt-back, html.k2x-on .kt-next, html.k2x-on .kt-act, html.k2x-on .kt-x { border-radius: 0; }
  html.k2x-on .kt-next { background: #8b6cff; color: #fff; }
  html.k2x-on .kt-spot:not(.kt-none) { box-shadow: 0 0 0 200vmax rgba(10, 10, 13, 0.66), 0 0 0 1.5px rgba(139, 108, 255, 0.95), 0 0 22px 2px rgba(139, 108, 255, 0.3); animation: k2x-breathe 2.4s ease-in-out infinite; }
  @keyframes k2x-breathe { 50% { box-shadow: 0 0 0 200vmax rgba(10, 10, 13, 0.66), 0 0 0 1.5px #a68cff, 0 0 30px 4px rgba(139, 108, 255, 0.45); } }
  html.k2x-on .kt-next:focus-visible, html.k2x-on .kt-back:focus-visible, html.k2x-on .kt-act:focus-visible { outline-color: rgba(139, 108, 255, 0.7); }
  html.k2x-on .kt-dots i.on { background: #8b6cff; border-radius: 0; }
  html.k2x-on .kt-card .k2x-keys { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin-top: 6px; font-size: 12px; }
  html.k2x-on .kt-card .k2x-keys kbd { font: 600 10.5px/16px Inter, system-ui, sans-serif; padding: 0 5px; border: 1px solid rgba(255, 255, 255, 0.22); color: #fff; white-space: nowrap; justify-self: start; }
  `;
  document.head.append(css);

  // ------------------------------------------------------------------ the tips
  // { id, at: () => element, text, done: () => bool (what it says has happened), place }
  const songClips = () => (S() && S().tracks ? S().tracks.filter((t) => t.kind !== "beat").flatMap((t) => t.clips) : []);
  let played = false;
  const TIPS = [
    { id: "home-quests", place: "below",
      at: () => onHome() && byText("#home button, #home a, #home [role=tab]", /^quests/i),
      text: "<h6>New here?</h6><b>QUESTS</b> teach you the app one step at a time. Quest 01 takes about 15 min." },
    { id: "play", place: "below",
      at: () => !onHome() && !inWindow() && songClips().length && q(".kt-time"),
      done: () => played,
      text: "<h6>Play</h6>Click the time or press <kbd>SPACE</kbd> to play and stop. <kbd>ENTER</kbd> jumps back." },
    { id: "new-pattern", place: "inside",
      at: () => !onHome() && !inWindow() && !vis(q("#empty")) && !vis(q(".k2p")) && vis(q("#rows")) && q("#rows"),
      done: () => songClips().some((c) => c.kind === "midi" || Array.isArray(c.notes)),
      text: "<h6>Make a pattern</h6><b>Double-click</b> an empty spot on a row. Move the mouse to set how long, click to drop it." },
    { id: "load-pill", place: "below",
      at: () => !inWindow() && [...document.querySelectorAll(".k2p-clippill")].find((e) => vis(e) && /LOAD/i.test(e.textContent)),
      text: "<h6>Pick a sound</h6>This pattern has no sound yet. <b>+ LOAD</b> picks one: keys, synth, drums." },
    { id: "notes-pill", place: "below",
      at: () => !inWindow() && [...document.querySelectorAll(".k2p-clippill")].find((e) => vis(e) && /NOTES/i.test(e.textContent)),
      text: "<h6>No notes yet</h6><b>+ ADD NOTES</b> opens the note grid. Click in it to place notes." },
    { id: "pattern-tabs", place: "right",
      at: () => !onHome() && !inWindow() && U() && U().selectedClip && q("#rack .k2-tabs"),
      text: "<h6>The picked pattern</h6><b>MIDI</b> its notes, <b>INST</b> its sound, <b>FX</b> its effects, <b>WARP</b> its tempo." },
    // over the pattern window, not on its note bar: "above" the grid sat on ADVANCED, the key and the scale,
    // and caught the clicks meant for them (bug check, 8 Nov). KT2_EXPLAIN_WIN_OLD = old spot.
    { id: "midi-roll", place: window.KT2_EXPLAIN_WIN_OLD ? "above" : "winTop",
      at: () => [...document.querySelectorAll(".tmm-canvas")].find(vis),
      text: window.KT2_EXPLAIN_WIN_OLD ? "<h6>Notes</h6><b>Click</b> = new note. <b>Drag</b> = move. <b>Drag its end</b> = longer. <b>Double-click</b> = delete. <b>Alt-drag</b> = copy. <b>Cmd-drag</b> = box."
        // double-click opens the note's menu since V6a and right-click deletes: the old words told beginners the opposite (bug check, 8 Nov)
        : "<h6>Notes</h6><b>Click</b> = new note. <b>Drag</b> = move. <b>Drag its end</b> = longer. <b>Right-click</b> = delete. <b>Double-click</b> = note menu. <b>Alt-drag</b> = copy. <b>Cmd-drag</b> = box." },
    { id: "toymachine", place: "below",
      at: () => q("#iw .tm-root:not(.kd-root) .tm-disc") && vis(q("#iw .tm-root:not(.kd-root) .tm-disc")) && q("#iw .tm-root:not(.kd-root) .tm-disc"),
      text: "<h6>TOY MACHINE</h6><b>Drag the points</b> on the picture to change the sound. Arrows on top = next preset. The <b>?</b> up top walks you through it." },
    { id: "killdrum", place: "right",
      at: () => q("#iw .kd-root .kd-circle") && vis(q("#iw .kd-root .kd-circle")) && q("#iw .kd-root .kd-circle"),
      text: "<h6>KILLDRUM</h6>Each ring is a drum, each slice a step. <b>Click</b> a slice for a hit. <b>ROLL</b> = a new beat. The <b>?</b> up top walks you through it." },
    { id: "clip-bpmkey", place: "below",
      at: () => !inWindow() && [...document.querySelectorAll(".k2bk")].find(vis),
      text: "<h6>Tempo and key of this sound</h6><b>?</b> = not known yet. Click to set it. <b>A</b> on = it follows the song." },
    { id: "parts", place: "below",
      at: () => !onHome() && !inWindow() && [...document.querySelectorAll("#sections .section")].find(vis),
      text: "<h6>Song parts</h6><b>Click</b> a part to loop it. <b>Double-click</b> to rename. <b>Drag</b> it to move that whole part of the song." },
  ];

  // ------------------------------------------------------------------ showing one
  let tip = null, ring = null, curTip = null, curEl = null, lastClose = 0;
  function hide(mark) {
    if (curTip && mark) markSeen(curTip.id);
    if (tip) tip.remove();
    if (ring) ring.remove();
    tip = ring = curTip = curEl = null;
    lastClose = performance.now();
  }
  function show(t, el) {
    hide(false);
    curTip = t; curEl = el;
    ring = document.createElement("div"); ring.className = "k2x-ring";
    tip = document.createElement("div"); tip.className = "k2x-tip"; tip.dataset.tip = t.id;
    tip.innerHTML = t.text;
    const x = document.createElement("button"); x.className = "k2x-x"; x.type = "button"; x.textContent = "\u00d7"; x.title = "Got it";
    x.onclick = (e) => { e.stopPropagation(); hide(true); };
    tip.append(x);
    for (const ev of ["mousedown", "pointerdown", "dblclick", "click"]) tip.addEventListener(ev, (e) => e.stopPropagation());
    if (t.place === "inside") ring.style.display = "none";   // a big area: just the card, no outline
    document.body.append(ring, tip);
    place();
  }
  function place() {
    if (!tip || !curEl) return;
    const r = curEl.getBoundingClientRect(), pad = 4;
    Object.assign(ring.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    const w = tip.offsetWidth, h = tip.offsetHeight, gap = 10, m = 8;
    let x, y;
    const p = curTip.place;
    const wc = p === "winTop" && q("#iw-card"), wr = wc && wc.getBoundingClientRect();
    if (wr && wr.top - gap - h >= m) { x = wr.left + 30; y = wr.top - gap - h; }
    // no room above the window (smaller screens, Fill browser): the old spot sat on the window's own MIDI/ADVANCED,
    // key, scale and ONLY KEY buttons and ate their clicks (UX stress test, 8 Nov). Now: under the window, or else
    // low in the note grid, right of the keys. KT2_EXPLAIN_WINTOP_OLD = old spot.
    else if (wr && !window.KT2_EXPLAIN_WINTOP_OLD && wr.bottom + gap + h <= innerHeight - m) { x = wr.left + 30; y = wr.bottom + gap; }
    else if (wr && !window.KT2_EXPLAIN_WINTOP_OLD) { x = r.left + 70; y = r.bottom - h - 44; }
    else if (p === "winTop") { x = r.left + 30; y = r.top - gap - h; if (y < m) y = r.bottom + gap; }
    else if (p === "inside") { x = r.left + Math.min(220, r.width / 2 - w / 2); y = r.top + Math.min(90, r.height / 3); }
    else if (p === "right") { x = r.right + gap; y = r.top + Math.min(r.height, 60) / 2 - h / 2 + 6; if (x + w > innerWidth - m) x = r.left - gap - w; }
    else if (p === "above") { x = r.left + 30; y = r.top - gap - h; if (y < m) y = r.bottom + gap; }
    else { x = r.left + r.width / 2 - w / 2; y = r.bottom + gap; if (y + h > innerHeight - m) y = r.top - gap - h; }
    x = Math.max(m, Math.min(innerWidth - w - m, x)); y = Math.max(m, Math.min(innerHeight - h - m, y));
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  addEventListener("resize", place, { passive: true });
  addEventListener("scroll", place, { passive: true, capture: true });
  // pressing the thing a tip points at = understood
  addEventListener("pointerdown", (e) => { if (curEl && curTip && curTip.place !== "inside" && curEl.contains(e.target)) setTimeout(() => hide(true), 0); }, true);

  // a popup or menu is open (key picker, colour picker, rename, the right-click menu...): tips wait so they never sit on it
  const POPS = ".k2-keypick, .k2-colpick, .k2-bgpop, .k2-renpop, .k2-secpop, .k2p, #pop, .k2-stempick, .kc-pop, [role=dialog], [role=menu]" + (window.KT2_RHYTHM_FIX_OLD ? "" : ", .k2rh-panel");   // the RHYTHM menu too (11 Nov)
  const popOpen = () => [...document.querySelectorAll(POPS)].some((e) => !(tip && tip.contains(e)) && !e.hidden && vis(e));
  const blocked = () => popOpen() || !isOn() || html.classList.contains("kq-on") || document.body.classList.contains("kt-touring") || !!q(".kq-layer, .kc-unlock, .kj-unlock");
  function tick() {
    if (U() && U().transport && U().transport.playing) played = true;
    html.classList.toggle("k2x-on", isOn());
    if (blocked()) { if (tip) hide(false); return; }
    for (const t of TIPS) if (!seen[t.id] && t.done && t.done()) markSeen(t.id);
    if (curTip) {
      if (seen[curTip.id]) return hide(false);
      const el = curTip.at();
      if (!el || !vis(el)) return hide(false);
      if (el !== curEl) curEl = el;
      return place();
    }
    if (performance.now() - lastClose < 2500) return;   // a breath between two tips
    for (const t of TIPS) {
      if (seen[t.id]) continue;
      let el = null;
      try { el = t.at(); } catch (e) { el = null; }
      if (el && vis(el)) { show(t, el); return; }
    }
  }
  setInterval(tick, 600);

  // ------------------------------------------------------------------ KT2 words for two KILLTOY 1 texts
  const EMPTY_NEW = { h1: "Drop a beat in, or start with a synth.", p: "Drop any audio file on this window or press <b>Load beat</b>. KILLTOY finds its tempo, key and song parts. Then double-click a row to make a pattern." };
  const RACK_NEW = "Click a pattern to see its effects here. <b>+ ADD EFFECT</b> puts one on it.";
  let emptyOld = null;
  function words() {
    const on = isOn();
    const e = q("#empty .empty-card");
    if (e) {
      const h = q("h1", e), p = q("p", e);
      if (h && p) {
        if (!emptyOld) emptyOld = { h1: h.innerHTML, p: p.innerHTML };
        const want = on ? EMPTY_NEW : emptyOld;
        if (h.innerHTML !== want.h1) h.innerHTML = want.h1;
        if (p.innerHTML !== want.p) p.innerHTML = want.p;
      }
    }
    const r = q("#rack .rack-empty");
    if (r) {
      if (!r.dataset.k2xOld) r.dataset.k2xOld = r.innerHTML;
      const want = on ? RACK_NEW : r.dataset.k2xOld;
      if (r.innerHTML !== want) r.innerHTML = want;
    }
  }
  let wq = false;
  new MutationObserver(() => { if (wq) return; wq = true; requestAnimationFrame(() => { wq = false; words(); }); })
    .observe(document.body, { childList: true, subtree: true });
  words();

  // ------------------------------------------------------------------ the ? menu: KT2 tour, KEYS, TIPS ON / OFF
  const K = window.KillToyTour;
  if (K && K.tours && K.list) {
    const T = K.tours, LIST = K.list;
    const W = "#rows";
    const KT2_WELCOME = {
      title: "Show me around", doneLabel: "Let's go",
      steps: [
        { title: "Welcome to KILLTOY",
          text: "A quick look at where everything is. About a minute. <b>Esc</b> stops, the arrow keys step." },
        { at: "#logo", title: "Your projects",
          text: "Click the logo for all your songs and the <b>QUESTS</b>. Quests teach you the app one step at a time." },
        { at: ".kt-tools", title: "Tools",
          text: "<b>Select</b> V, <b>Draw</b> P, <b>Paint</b> B, <b>Slice</b> C, <b>Delete</b> D, <b>Mute</b> T, <b>Compound</b> G, <b>Duplicate</b> Cmd+D, <b>Snap</b> S. Hover one to see its name." },
        { at: ".kt-time", title: "Play",
          text: "Click the time or press <b>Space</b> to play and stop. <b>Enter</b> jumps back to where you started." },
        { at: () => [q("label.ro"), q("#key-chip")], title: "Tempo and key",
          text: "Drag the <b>BPM</b> up or down, double-click it to type. Click the <b>key</b> to change it: the note grid follows it, so every note fits." },
        { at: ".kt-mode", title: "Produce, record, mix",
          text: "Pages for the same song. <b>Crown</b> = make the music. <b>Mixer</b> = set the levels." },
        { at: ".kt-song", title: "Song and versions",
          text: "The song's name (<b>click</b> it to rename) and its versions <b>V1, V2</b>... <b>+</b> makes a copy to try an idea; the others stay safe." },
        { at: "#sections", title: "Song parts",
          text: "INTRO, VERSE, HOOK. <b>Click</b> a part to loop it, <b>double-click</b> to rename, <b>drag</b> to move that whole part." },
        { at: W, title: "The playground",
          text: "Every block is a <b>pattern</b>. <b>Double-click</b> an empty spot for a new one. Drag to move, drag an edge to trim, double-click its name to rename." },
        { at: "#rack .k2-tabs", title: "The picked pattern",
          text: "Click a pattern and its tabs show here: <b>MIDI</b> notes, <b>INST</b> its sound, <b>FX</b> effects, <b>WARP</b> tempo, <b>SAMPLES</b> kits." },
        { at: ".k2-cardsbtn", title: "Cards",
          text: "Making music earns points. Points unlock new synths and kits." },
        { at: "#kt-help", title: "Help is right here",
          text: "<b>?</b> replays this, walks you through TOY MACHINE and KILLDRUM, and lists every key. Small tips also show the first time you meet something." },
      ],
    };
    const KEYS = [
      ["Space", "play / stop"], ["Enter", "back to the start"], ["R", "record"], ["L", "loop on / off"], ["K", "metronome"],
      ["V P B C", "select, draw, paint, slice"], ["D T G S", "delete, mute, compound, snap"],
      ["Cmd+Z", "undo (Shift = redo)"], ["Cmd+S", "save"], ["Cmd+D", "duplicate"], ["Cmd+A", "pick all"], ["Delete", "delete the picked"],
      ["Shift+arrows", "move picked a row / a beat"], ["Q + 1-9", "set a cue at the marker"], ["1-9", "jump to a cue"],
      ["+  -  0", "zoom in, out, whole song"], ["P", "projects"], ["Esc", "close / back to Select"],
      ["Alt-drag", "copy notes"], ["Double-click", "new pattern, rename, delete a note"],
    ];
    const KEYS_TOUR = {
      title: "Keys", doneLabel: "Got it",
      steps: [{ title: "Every key", text: '<div class="k2x-keys">' + KEYS.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join("") + "</div>" }],
    };
    const OLD = ["clips", "automation", "versions"];   // KILLTOY 1 tours whose parts KT2 doesn't show
    const parked = [];
    T.k2xKeys = KEYS_TOUR;
    T.k2xToggle = { title: "Tips", steps: [], setup: () => { store.set(OFF_KEY, isOn() ? "off" : "on"); if (!isOn()) hide(false); apply(); if (window.toast) toast(isOn() ? "Tips on. They show the first time you meet something." : "Tips off. Turn them on again in the ? menu."); return false; } };
    if (!T.welcomeK1) T.welcomeK1 = T.welcome;
    function apply() {
      const on = isOn();
      html.classList.toggle("k2x-on", on);
      T.welcome = on ? KT2_WELCOME : T.welcomeK1;
      // take out / put back the KILLTOY 1 entries, in place (the menu reads LIST on every click)
      if (on) { for (let i = LIST.length - 1; i >= 0; i--) if (OLD.includes(LIST[i][0])) parked.unshift(LIST.splice(i, 1)[0]); }
      else if (parked.length) { const at = Math.min(2, LIST.length); LIST.splice(at, 0, ...parked.splice(0)); }
      for (let i = LIST.length - 1; i >= 0; i--) if (LIST[i][0] === "k2xKeys" || LIST[i][0] === "k2xToggle") LIST.splice(i, 1);
      if (on) LIST.push(["k2xKeys", "Keys"]);
      LIST.push(["k2xToggle", on ? "Tips: turn off" : "Tips: turn on"]);
      words();
    }
    apply();
  }

  return { reset: () => { seen = {}; store.set(SEEN_KEY, "{}"); hide(false); }, tips: TIPS, hide };
})();
