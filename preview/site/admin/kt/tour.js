// "Show me how": guided tours inside the app. A tour dims the screen around one real part
// of the UI at a time, a fake cursor shows the move (click, drag), and a small card says what
// it does, with Back / Next / Skip. Little "?" buttons sit next to features (the returns, the
// versions, the rack, TOY MACHINE and KILLDRUM windows) and the "?" in the top bar lists every
// tour. The first time a session opens, a small card offers "Show me around".
//
// Tours never change the song. What the cursor "does" is painted on the UI and put back when
// the step ends (render() redraws from the real state). The only real things a tour does are
// selecting a clip or lane and opening a window, and it puts the selection back when it ends.
//
// A step: { at, title, text, demo, before, leave, place, action }
//   at      what to light up: a selector, a list of selectors (lit together), or a function
//           returning an element / list. Nothing found = a card in the middle.
//   demo    async (c) => {...}, looped while the step shows: c.click(el), c.drag(el, dx, dy, onMove)...
//   before  run (and awaited) when the step opens; leave: run when it closes.
//   action  { label, run }: a button on the card that does something for real (e.g. add a lane).
// Keep this file ASCII-only, like the rest of ui/.
"use strict";

(function () {
  const TOURS = {};
  const SEEN = "killtoy.tour.seen";
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const visible = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight; };

  // ------------------------------------------------------------------ overlay
  let root, spot, cursor, card, cur = null;   // cur = { tour, i, token, restore }
  function build() {
    if (root) return;
    root = mk("div", "kt-tour");
    root.hidden = true;
    const shield = mk("div", "kt-shield");   // clicks outside the card do nothing while a tour runs
    shield.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); card.classList.remove("kt-nudge"); void card.offsetWidth; card.classList.add("kt-nudge"); });
    spot = mk("div", "kt-spot");
    cursor = mk("div", "kt-cursor", '<svg viewBox="0 0 24 24"><path d="M5 3l14 8.2-6.3 1.3 3.6 6.9-2.6 1.3-3.6-6.9L5 18.6z"/></svg><i></i>');
    card = mk("div", "kt-card");
    root.append(shield, spot, cursor, card);
    document.body.append(root);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", () => cur && place(), { passive: true });
  }
  function onKey(e) {
    if (!cur) return;
    e.stopImmediatePropagation();   // Space, Enter, R... must not reach the app mid-tour
    if (e.key === "Escape") { e.preventDefault(); end(); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(cur.i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur.i - 1); }
  }

  // What a step lights up, as a list of elements (empty = nothing on screen).
  function targets(step) {
    let t = typeof step.at === "function" ? step.at() : step.at;
    if (!t) return [];
    if (typeof t === "string") t = [t];
    if (!Array.isArray(t)) t = [t];
    return t.flatMap((x) => typeof x === "string" ? [...document.querySelectorAll(x)] : x ? [x] : []).filter(visible);
  }
  function rectOf(els, pad = 6) {
    if (!els.length) return null;
    const rs = els.map((e) => e.getBoundingClientRect());
    const l = Math.min(...rs.map((r) => r.left)) - pad, t = Math.min(...rs.map((r) => r.top)) - pad;
    const r = Math.max(...rs.map((r) => r.right)) + pad, b = Math.max(...rs.map((r) => r.bottom)) + pad;
    return { left: Math.max(4, l), top: Math.max(4, t), right: Math.min(innerWidth - 4, r), bottom: Math.min(innerHeight - 4, b) };
  }

  // Spotlight + card placement (also every frame, so they follow a panel that moves or grows).
  let lastKey = "";
  function place() {
    if (!cur) return;
    const step = cur.tour.steps[cur.i];
    const r = rectOf(targets(step));
    const W = innerWidth, H = innerHeight;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let x, y;
    if (!r) {
      Object.assign(spot.style, { left: W / 2 + "px", top: H / 2 + "px", width: "0px", height: "0px" });
      spot.classList.add("kt-none");
      x = (W - cw) / 2; y = (H - ch) / 2;
    } else {
      spot.classList.remove("kt-none");
      Object.assign(spot.style, { left: r.left + "px", top: r.top + "px", width: r.right - r.left + "px", height: r.bottom - r.top + "px" });
      const gap = 14, cx = (r.left + r.right) / 2 - cw / 2;
      const fits = { below: H - r.bottom - gap >= ch, above: r.top - gap >= ch, right: W - r.right - gap >= cw, left: r.left - gap >= cw };
      const order = step.place ? [step.place, "below", "above", "right", "left"] : ["below", "above", "right", "left"];
      const side = order.find((s) => fits[s]);
      if (side === "below") { x = cx; y = r.bottom + gap; }
      else if (side === "above") { x = cx; y = r.top - gap - ch; }
      else if (side === "right") { x = r.right + gap; y = (r.top + r.bottom) / 2 - ch / 2; }
      else if (side === "left") { x = r.left - gap - cw; y = (r.top + r.bottom) / 2 - ch / 2; }
      else { x = W - cw - 24; y = H - ch - 24; }   // a big panel: the card sits in a corner on top
    }
    x = Math.max(12, Math.min(W - cw - 12, x));
    y = Math.max(12, Math.min(H - ch - 12, y));
    const key = Math.round(x) + "," + Math.round(y);
    if (key !== lastKey) { card.style.left = x + "px"; card.style.top = y + "px"; lastKey = key; }
  }
  function follow(token) {
    if (!cur || cur.token !== token) return;
    place();
    requestAnimationFrame(() => follow(token));
  }

  // ------------------------------------------------------------------ the cursor
  const Stop = {};
  let cx = innerWidth / 2, cy = innerHeight / 2;
  function cursorApi(token) {
    const alive = () => { if (!cur || cur.token !== token) throw Stop; };
    const wait = async (ms) => { await sleep(ms); alive(); };
    const center = (el, fx = 0.5, fy = 0.5) => { const r = el.getBoundingClientRect(); return [r.left + r.width * fx, r.top + r.height * fy]; };
    async function move(x, y, ms = 650, onMove) {
      alive();
      const x0 = cx, y0 = cy, t0 = performance.now();
      cursor.classList.add("kt-show");
      await new Promise((done) => {
        const tick = (now) => {
          if (!cur || cur.token !== token) return done();
          const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          cx = x0 + (x - x0) * e; cy = y0 + (y - y0) * e;
          cursor.style.transform = `translate(${cx}px, ${cy}px)`;
          if (onMove) onMove(e);
          if (k < 1) requestAnimationFrame(tick); else done();
        };
        requestAnimationFrame(tick);
      });
      alive();
    }
    const down = () => cursor.classList.add("kt-down");
    const up = () => cursor.classList.remove("kt-down");
    return {
      alive, wait, move, down, up,
      to: (el, fx, fy, ms) => el ? move(...center(el, fx, fy), ms) : wait(ms || 400),
      async click(el, fx, fy) {
        if (!el) return wait(500);
        await move(...center(el, fx, fy));
        await wait(160); down(); await wait(180); up(); await wait(200);
      },
      // Press on el, move by (dx, dy), let go. onMove(k) gets 0..1 so the step can paint the result.
      async drag(el, dx, dy, onMove, fx, fy) {
        if (!el) return wait(500);
        const [x, y] = center(el, fx, fy);
        await move(x, y);
        await wait(150); down();
        await move(x + dx, y + dy, 900, onMove);
        await wait(250); up(); await wait(150);
      },
    };
  }
  async function loop(step, token) {
    if (!step.demo) { cursor.classList.remove("kt-show"); return; }
    const c = cursorApi(token);
    try {
      for (let n = 0; ; n++) {
        await step.demo(c, n);
        if (step.once) break;
        await c.wait(1100);
      }
    } catch (e) { if (e !== Stop) console.warn("tour demo:", e); }
  }

  // ------------------------------------------------------------------ steps
  function leaveStep() {
    if (!cur) return;
    const step = cur.tour.steps[cur.i];
    if (step && step.leave) { try { step.leave(); } catch (e) { console.warn(e); } }
  }
  async function go(i) {
    if (!cur) return;
    const steps = cur.tour.steps, dir = i < cur.i ? -1 : 1;
    while (steps[i] && steps[i].skip && steps[i].skip()) i += dir;   // e.g. "add a lane" when there already is one
    if (i < 0) return;
    if (i >= steps.length) return end(true);
    leaveStep();
    const token = {};
    cur.i = i; cur.token = token;
    const step = steps[i];
    cursor.classList.remove("kt-down");
    if (step.before) { try { await step.before(); } catch (e) { console.warn(e); } await sleep(260); }
    if (!cur || cur.token !== token) return;
    drawCard(step, i, steps.length);
    lastKey = "";
    follow(token);
    loop(step, token);
  }
  function drawCard(step, i, n) {
    card.replaceChildren();
    const top = mk("div", "kt-top");
    top.append(mk("span", "kt-kicker", cur.tour.title), mk("span", "kt-count", n > 1 ? `${i + 1} / ${n}` : ""));
    const close = mk("button", "kt-x", "&times;");
    close.title = "Skip (Esc)";
    close.onclick = () => end();
    top.append(close);
    card.append(top, mk("div", "kt-title", step.title || ""), mk("div", "kt-text", typeof step.text === "function" ? step.text() : step.text || ""));
    if (step.action) {
      const a = mk("button", "kt-act", step.action.label);
      a.onclick = async () => { a.disabled = true; try { await step.action.run(); } finally { go(cur ? cur.i + 1 : 0); } };
      card.append(a);
    }
    const foot = mk("div", "kt-foot");
    const dots = mk("div", "kt-dots");
    for (let k = 0; k < n && n > 1; k++) dots.append(mk("i", k === i ? "on" : k < i ? "done" : ""));
    const back = mk("button", "kt-back", "Back");
    back.hidden = i === 0 || steps0(i);
    back.onclick = () => go(cur.i - 1);
    const next = mk("button", "kt-next", i === n - 1 ? (cur.tour.doneLabel || "Got it") : "Next");
    next.onclick = () => go(cur.i + 1);
    foot.append(dots, back, next);
    card.append(foot);
    card.classList.remove("kt-in"); void card.offsetWidth; card.classList.add("kt-in");
    setTimeout(() => cur && next.focus({ preventScroll: true }), 30);
  }

  const steps0 = (i) => cur.tour.steps.slice(0, i).every((s) => s.skip && s.skip());   // nothing to go back to

  async function start(id) {
    const tour = TOURS[id];
    if (!tour) return;
    if (cur) end();
    build();
    if (window.hidePop) hidePop();
    invite(false);
    store.set(SEEN, "1");
    const restore = { clip: ui.selectedClip, track: ui.selectedTrack };
    cur = { tour, i: -1, token: null, restore };
    root.hidden = false;
    document.body.classList.add("kt-touring");
    cx = innerWidth / 2; cy = innerHeight * 0.6;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    if (tour.setup) { try { const ok = await tour.setup(); if (ok === false) return end(); } catch (e) { console.warn(e); } }
    go(0);
  }
  function end(finished) {
    if (!cur) return;
    leaveStep();
    const { tour, restore } = cur;
    cur = null;
    root.hidden = true;
    cursor.classList.remove("kt-show", "kt-down");
    document.body.classList.remove("kt-touring");
    if (tour.cleanup) { try { tour.cleanup(restore, finished); } catch (e) { console.warn(e); } }
    else putBack(restore);
  }
  // Back to what was selected before the tour (and the lanes redrawn from the real state).
  function putBack(r) {
    if (!ui.state) return;
    if (r.clip && window.selectClip) selectClip(r.clip);
    else if (r.track && window.selectTrack) selectTrack(r.track);
    else if (ui.selectedClip || ui.selectedTrack) { if (window.selectClip) selectClip(null); ui.selectedTrack = null; if (window.renderRack) renderRack(); }
    ui.laneSig = ""; render();
  }

  // ------------------------------------------------------------------ helpers for the tours
  const lanes = () => (ui.state ? ui.state.tracks.filter((t) => t.kind !== "beat" && !t.instrument) : []);
  const firstLane = () => lanes().find((t) => t.clips.length) || lanes()[0] || (ui.state && ui.state.tracks.find((t) => t.kind !== "beat"));
  const rowOf = (t) => t && q(`.row[data-track-id="${t.id}"]`);
  const clipEl = () => ui.selectedClip && q(`.clip[data-clip-id="${ui.selectedClip}"]`) || q(".clip.selected");
  // A send knob shown at amount k (0..1), as if it had been dragged. render() puts it back.
  const paintKnob = (k, v) => { if (!k) return; k.style.setProperty("--v", (v * 100).toFixed(1) + "%"); k.classList.toggle("on", v > 0); };
  const redraw = () => { if (ui.state) { ui.laneSig = ""; render(); } };
  const synthLane = (re) => ui.state && ui.state.tracks.find((t) => re.test(t.instrument || "") || (t.plugins || []).some((p) => p.instrument && re.test(p.name || "")));
  const winOpen = (sel) => { const w = q("#iw"); return w && !w.hidden && q(sel); };
  async function openSynth(re, sel) {
    if (winOpen(sel)) return true;
    const t = synthLane(re);
    if (!t) return false;
    await openLaneSynth(t.id);
    for (let k = 0; k < 30 && !winOpen(sel); k++) await sleep(100);
    return !!winOpen(sel);
  }
  async function addSynthLane(re, sel) {
    const p = (await loadPlugins()).find((x) => x.instrument && re.test(x.name));
    if (!p) return;
    const r = await run("newInstrumentLane", { key: p.key });
    if (r && r.trackId) { selectTrack(r.trackId); await openLaneSynth(r.trackId); }
    for (let k = 0; k < 30 && !winOpen(sel); k++) await sleep(100);
  }

  // ------------------------------------------------------------------ the tours
  const R = (id) => `.row.return[data-track-id="${id}"]`;
  TOURS.returns = {
    title: "Sends: A Space and B Echo",
    steps: [
      { at: [R("returnA"), R("returnB")], title: "Two shared effects",
        text: "<b>A Space</b> is a reverb. <b>B Echo</b> is a delay that follows the song's tempo. They're not lanes you record on: they're effects that <b>every lane can share</b>, so all your vocals sit in the same room." },
      { at: () => rowOf(firstLane()) && rowOf(firstLane()).querySelector(".sends"), place: "right", title: "The A and B knobs",
        text: "Every lane has two tiny knobs, <b>A</b> and <b>B</b>. They set how much of the lane goes into A Space and B Echo. They start at 0, which is why the returns are quiet until you turn one up.",
        demo: async (c) => { const s = rowOf(firstLane()).querySelector(".sends"); await c.to(s.children[0], 0.5, 0.5); await c.wait(500); await c.to(s.children[1], 0.5, 0.5); await c.wait(500); } },
      { at: () => rowOf(firstLane()) && rowOf(firstLane()).querySelector(".sends .send-knob"), place: "right", title: "Send a lane",
        text: () => `Drag a knob <b>up</b> to send more. Here ${firstLane().name} gets some reverb. The lane itself stays dry, the reverb is added on top. <b>Double-click</b> a knob to turn it off again.`,
        demo: async (c) => { const k = rowOf(firstLane()).querySelector(".sends .send-knob"); paintKnob(k, 0); await c.drag(k, 0, -48, (e) => paintKnob(k, e * 0.4)); await c.wait(700); },
        leave: redraw },
      { at: () => q(R("returnA") + " .lane .master-chain") || q(R("returnA")), title: "Who's sending, and where it goes",
        text: "The return lists the lanes that send to it, the effect it plays through, and that it ends up in the <b>Master</b>.",
        before: () => { const o = q(R("returnA") + " .master-chain .out"); if (o && /No lane/.test(o.textContent)) o.textContent = firstLane().name; },
        leave: redraw },
      { at: () => q(R("returnA") + " .head"), title: "Click a return to open it",
        text: "Click <b>A Space</b> (the name, not the fader) and its effects open in the rack below, just like a lane.",
        demo: async (c) => { await c.click(q(R("returnA") + " .head-name")); if (ui.selectedTrack !== "returnA") selectTrack("returnA"); }, once: true },
      { at: "#rack", before: () => { if (ui.selectedTrack !== "returnA") selectTrack("returnA"); }, title: "Why only Space, or only Delay?",
        text: "Each return just <b>starts</b> with one effect, set 100% wet. It's a starting point, not a limit. Here you can turn its knobs, swap it for another effect, or stack more (up to 5), like reverb into a filter." },
      { at: () => [q(R("returnA") + " .head"), q(R("returnB") + " .head")], title: "Volume and mute",
        text: "Each return's fader sets how loud the whole effect is, <b>M</b> mutes it. A good start: a big reverb on A for the whole song, a short echo on B for adlib throws." },
    ],
  };

  TOURS.welcome = {
    title: "Show me around", doneLabel: "Let's go",
    steps: [
      { title: "Welcome to KILLTOY",
        text: "A quick look at where everything is. About a minute. Press <b>Esc</b> to stop any time, or use the arrow keys." },
      { at: "#logo", title: "Your projects",
        text: "Click the logo to see all your songs. <b>Right-click</b> it for settings: background, look, audio.",
        demo: (c) => c.to(q("#logo"), 0.5, 0.55) },
      { at: ["#session", "#versions"], title: "Song and versions",
        text: "The song's name, and its versions: <b>V1, V2</b>... Each one is a full copy of the song. <b>+</b> makes a new one to try an idea; the others stay safe." },
      { at: ".transport", title: "Play, record, loop",
        text: "Play / stop with <b>Space</b>. Record with <b>R</b> into the lane with its R lit. Loop with <b>L</b>, the metronome with <b>K</b>." },
      { at: ".readouts", title: "Tempo and key",
        text: "The song's tempo and key, found when the beat loads. Click the tempo to change it." },
      { at: "#sections", title: "Song sections",
        text: "INTRO, VERSE, HOOK... guessed from the beat. <b>Click one</b> to loop it while you record takes.",
        demo: (c) => c.to(q("#sections .section, #sections > *"), 0.5, 0.5) },
      { at: () => rowOf(firstLane()) && rowOf(firstLane()).querySelector(".head"), place: "right", title: "A lane",
        text: "<b>M</b> mutes, <b>S</b> solos, <b>R</b> arms it for recording. The line under the name is its volume. The <b>A</b> below opens its automation." },
      { at: () => rowOf(firstLane()) && rowOf(firstLane()).querySelector(".clip"), title: "Clips",
        text: "Each block is a clip. Click it to select it, drag it to move it. Its effects show up below.",
        demo: (c) => c.click(rowOf(firstLane()).querySelector(".clip"), 0.4, 0.6) },
      { at: "#rack", title: "The rack",
        text: "Effects live <b>on the clip</b> you clicked, so a throw can sit on one word. Presets on the left, effect cards on the right, and tools like Tune and Clean on top." },
      { at: ["#btn-lane", "#btn-inst"], title: "More lanes",
        text: "<b>+ Lane</b> for vocals. <b>+ Instrument</b> for TOY MACHINE (the synth) or KILLDRUM (the drums)." },
      { at: () => [...document.querySelectorAll(".row.return, .row.master")], title: "The master",
        text: "The Master sits at the bottom: everything ends up here. Click it to put effects on the whole song." },
      { at: "#kt-help", title: "Help is right here",
        text: "Press <b>?</b> any time to replay this or learn one thing step by step: clips, automation, versions, TOY MACHINE, KILLDRUM. Look for the small <b>?</b> next to features too." },
    ],
  };

  TOURS.clips = {
    title: "Clips and effects",
    setup: () => {
      const t = firstLane(), c = t && t.clips[0];
      if (!c) return false;
      selectClip(c.id); redraw();
    },
    steps: [
      { at: clipEl, title: "A clip", text: "One piece of audio. <b>Click</b> to select it, <b>Shift-click</b> to add more, drag it to move it.",
        demo: (c) => c.click(clipEl(), 0.45, 0.6) },
      { at: () => clipEl() && clipEl().querySelector(".fade-h.in"), title: "Fades",
        text: "Drag the small square at a top corner to fade in or out. Double-click it to take the fade away.",
        demo: (c) => c.drag(clipEl().querySelector(".fade-h.in"), 36, 0) },
      { at: () => clipEl() && clipEl().querySelector(".edge.r"), title: "Shorter or longer",
        text: "Drag a clip's left or right edge to trim it. The audio is still there, drag back to get it back.",
        demo: (c) => c.drag(clipEl().querySelector(".edge.r"), -40, 0) },
      { at: () => clipEl() && clipEl().querySelector(".gain-line"), title: "Clip volume",
        text: "The line across the selected clip is its volume. Drag it up or down.",
        demo: (c) => c.drag(clipEl().querySelector(".gain-line"), 0, -16, null, 0.5, 0.5) },
      { at: "#presets", place: "right", title: "Presets",
        text: "One click puts a whole effect chain on the clip: Throw, Clean Vocal, Big Verb... The ones you use most move to the top." },
      { at: "#cards", title: "Effect cards",
        text: "Each effect is a card with a few big knobs. Up to <b>5 per clip</b>. Click the card's dot to bypass it, <b>Save preset</b> keeps the chain for later." },
      { at: "#vtools", title: "Tools",
        text: "<b>Tune</b> pulls notes onto the key, <b>Align</b> tightens a double to the lead, <b>Clean</b> takes out noise, <b>Gate</b> cuts the gaps, <b>Stems</b> splits a beat, <b>Send to AI</b> makes a new take." },
      { at: clipEl, title: "Right-click for the rest",
        text: "Right-click a clip for split, duplicate, reverse, delete and more. <b>C</b> is the scissors." },
    ],
  };

  TOURS.automation = {
    title: "Automation",
    steps: [
      { at: () => rowOf(firstLane()) && rowOf(firstLane()).querySelector(".auto-btn"), place: "right", title: "The A button",
        text: "Automation makes something move by itself over the song, like the volume dipping in the verse or a filter opening into the hook. <b>Click A</b> and a volume line opens under the lane.",
        demo: (c) => c.to(rowOf(firstLane()).querySelector(".auto-btn")) },
      { at: () => rowOf(firstLane()) && rowOf(firstLane()).querySelector(".auto-btn"), place: "right", title: "Automate anything",
        text: "<b>Right-click A</b> to pick something else: any effect knob on the lane or its clips, or TOY MACHINE's sliders and points. Each gets its own line." },
      { at: () => q(".row.auto .lane") || (rowOf(firstLane()) && rowOf(firstLane()).querySelector(".lane")), title: "Drawing the line",
        text: "<b>Click</b> the line to add a point, <b>drag</b> a point to move it, <b>double-click</b> a point to delete it. Right-click for Flatten." },
      { at: "#kt-help", title: "It follows the clips",
        text: "When you move, cut or copy a clip, its automation goes with it." },
    ],
  };

  TOURS.versions = {
    title: "Versions",
    steps: [
      { at: "#versions .track", title: "Every version of the song",
        text: "<b>V1, V2, V3</b>... each is a full copy of the song. The lit one is where you are." },
      { at: "#versions .add", title: "Try an idea safely",
        text: "<b>+</b> copies the version you're on into a new one. Go wild there: the others stay exactly as they were.",
        demo: (c) => c.to(q("#versions .add")) },
      { at: "#versions", title: "Jump between them",
        text: "Click any pill to switch. Versions are never deleted, so nothing gets lost." },
    ],
  };

  const TM = /toy machine/i, TMW = "#iw .tm-root:not(.kd-root)";
  TOURS.toymachine = {
    title: "TOY MACHINE",
    setup: () => openSynth(TM, TMW).then(() => undefined),
    steps: [
      { at: "#btn-inst", skip: () => winOpen(TMW), title: "TOY MACHINE, the synth",
        text: "It lives on an instrument lane: <b>+ Instrument</b> &rarr; TOY MACHINE. There's none in this song yet. Want me to add one so you can follow along? (Cmd+Z takes it away again.)",
        action: { label: "Add a TOY MACHINE lane", run: () => addSynthLane(TM, TMW) } },
      { at: TMW + " .tm-nav", title: "Presets",
        text: "Click the name to browse every preset, the arrows for next / previous. The shuffle button picks one at random, the heart keeps it." },
      { at: TMW + " .tm-disc", place: "right", title: "The picture is the sound",
        text: "Every preset has its own picture, and it moves with the sound. The circles on it are <b>points</b>: each one shapes the sound (filter, space, motion, drive...)." },
      { at: () => q(TMW + " .tm-padlayer .tm-pad .tm-hit"), title: "Drag a point",
        text: "Drag a point around: <b>left / right</b> and <b>up / down</b> each move one of its settings. Click it to switch it off or remove it.",
        demo: async (c) => { const p = q(TMW + " .tm-padlayer .tm-pad .tm-hit") || q(TMW + " .tm-padlayer .tm-pad"); await c.drag(p, 60, -40); } },
      { at: TMW + " .tm-addpad", title: "Add a point",
        text: "<b>ADD</b> drops a new point on the picture: tape, crush, gate, arp and more. <b>LOOK</b> changes the picture.",
        demo: (c) => c.to(q(TMW + " .tm-addpad")) },
      { at: TMW + " .tm-macros", place: "right", title: "Each point, up close",
        text: "Every point has a row here with its own graph. Drag the graph to fine-tune it, the <b>A</b> automates it over the song." },
      { at: TMW + " .tm-side", place: "left", title: "Release, cutoff, sources",
        text: "Quick sliders on top. Below, the sound sources: two oscillators, grains, sub and sampler. Click the power dot to switch one on." },
      { at: TMW + " .tm-rail", place: "right", title: "The pages",
        text: "<b>Engine</b> for every setting, <b>Effects</b>, <b>Texture</b>, <b>Arp</b> patterns, and the <b>Drop zone</b>: drop any audio and it becomes a sound." },
      { at: TMW + " .tm-kb", title: "Play it",
        text: "Click the keys, use your computer keyboard, or plug in a MIDI keyboard. Hold a note and drag a point to hear it change." },
      { at: () => [q(TMW + " .iw-tabs"), q(TMW + " .tm-pmode")], title: "Notes, solo or full",
        text: "<b>Split</b> shows the notes next to the synth, <b>MIDI</b> just the notes. <b>LOOP</b> loops only this pattern, <b>TRACK</b> plays the whole song." },
    ],
  };

  const KD = /killdrum|toy drums/i, KDW = "#iw .kd-root";
  TOURS.killdrum = {
    title: "KILLDRUM",
    setup: () => openSynth(KD, KDW).then(() => undefined),
    steps: [
      { at: "#btn-inst", skip: () => winOpen(KDW), title: "KILLDRUM, the drums",
        text: "It lives on an instrument lane: <b>+ Instrument</b> &rarr; KILLDRUM. There's none in this song yet. Want me to add one so you can follow along? (Cmd+Z takes it away again.)",
        action: { label: "Add a KILLDRUM lane", run: () => addSynthLane(KD, KDW) } },
      { at: KDW + " .kd-plist", place: "right", title: "Nine drums",
        text: "Kick, 808, snare, clap, hats, perc, FX and texture. Per row: the <b>dice</b> rolls a new sound or pattern, the <b>lock</b> keeps it when you roll, <b>M S</b> mute and solo." },
      { at: KDW + " .kd-circle", place: "right", title: "The beat ring",
        text: "Each ring is a drum (kick outside, texture inside), each slice a step. <b>Click</b> a step to add a hit, drag up or down for how hard. Right-click for rolls.",
        demo: async (c) => { const r = q(KDW + " .kd-circle"); await c.to(r, 0.5, 0.06); await c.wait(150); c.down(); await c.wait(160); c.up(); await c.wait(400); await c.to(r, 0.94, 0.5); c.down(); await c.wait(160); c.up(); } },
      { at: KDW + " .kd-roll", title: "ROLL",
        text: "New sounds and patterns for every unlocked drum in one click. <b>SOUNDS ONLY</b> or <b>PATTERN ONLY</b> roll just one of them. Undo is right next to it.",
        demo: (c) => c.to(q(KDW + " .kd-roll")) },
      { at: KDW + " .kb-vers", title: "Bars",
        text: "<b>BAR 1</b>, <b>+</b> for more bars (a fill, a switch-up). <b>ALL</b> plays them in order." },
      { at: KDW + " .kd-detail", place: "left", title: "The selected drum",
        text: "Its sound (arrows or <b>Sounds</b> to browse), pitch, decay, drive, filter, pan, level, and small effects just for it." },
      { at: KDW + " .kd-vibe", title: "Just say it",
        text: "Type a vibe (<i>dark carti 808s, crunchy snares</i>) for a whole kit, or a change (<i>more reverb on the clap</i>)." },
      { at: KDW + " .kd-tabs", title: "FX",
        text: "The <b>FX</b> tab has 30 effects over the whole beat, as dots you drag. They start off, so the beat stays dry until you want it." },
    ],
  };

  // ------------------------------------------------------------------ "?" buttons
  const LIST = [["welcome", "Show me around"], ["returns", "Sends: A Space and B Echo"], ["clips", "Clips and effects"],
                ["automation", "Automation"], ["versions", "Versions"], ["toymachine", "TOY MACHINE"], ["killdrum", "KILLDRUM"]];
  function qBtn(id, cls, title) {
    const b = mk("button", "kt-q" + (cls ? " " + cls : ""), "?");
    b.type = "button";
    b.dataset.tour = id;
    b.title = title || "Show me how";
    b.addEventListener("mousedown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); start(id); });
    return b;
  }
  function helpButton() {
    if (q("#kt-help")) return;
    const top = q("header.top");
    if (!top) return;
    const b = mk("button", "kt-help", "?");
    b.id = "kt-help";
    b.type = "button";
    b.title = "Show me how: step-by-step tours";
    b.onclick = (e) => {
      e.stopPropagation();
      if (!window.showMenu) return start("welcome");
      showMenu(b, [{ heading: "Show me how" }, ...LIST.filter(([id]) => id !== "returns" || q(".row.return")).map(([id, label], i) => ({ label, meta: i === 0 ? "1 min" : "", cta: i === 0, run: () => start(id) }))]);
    };
    top.append(b);
  }
  // The small "?" next to features. Lanes and windows are redrawn often, so this runs after each change.
  function decorate() {
    helpButton();
    for (const id of ["returnA", "returnB"]) {
      const h = q(`${R(id)} .head-btns`);
      if (h && !h.querySelector(".kt-q")) h.prepend(qBtn("returns", "", "How sends and returns work"));
    }
    const v = q("#versions");
    if (v && !v.querySelector(".kt-q")) v.append(qBtn("versions", "", "How versions work"));
    const rh = q("#rack .rack-title");
    if (rh && !rh.querySelector(".kt-q")) rh.append(qBtn("clips", "", "How clips and effects work"));
    for (const [sel, id] of [[TMW + " .tm-topright", "toymachine"], [KDW + " .tm-topright", "killdrum"]]) {
      const tr = q(sel);
      if (tr && !tr.querySelector(".kt-q")) tr.prepend(qBtn(id, "kt-q-win", "Show me how " + (id === "killdrum" ? "KILLDRUM" : "TOY MACHINE") + " works"));
    }
    maybeInvite();
  }
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; decorate(); });
  }).observe(document.body, { childList: true, subtree: true });

  // ------------------------------------------------------------------ first launch
  let inviteEl = null;
  function invite(show) {
    if (!show) { if (inviteEl) inviteEl.remove(); inviteEl = null; return; }
    if (inviteEl) return;
    inviteEl = mk("div", "kt-invite");
    inviteEl.append(mk("div", "kt-title", "New here?"), mk("div", "kt-text", "Let me show you around. It takes about a minute."));
    const row = mk("div", "kt-foot");
    const no = mk("button", "kt-back", "Not now");
    no.onclick = () => { store.set(SEEN, "1"); invite(false); };
    const yes = mk("button", "kt-next", "Show me around");
    yes.onclick = () => start("welcome");
    row.append(mk("div", "kt-dots"), no, yes);
    inviteEl.append(row);
    document.body.append(inviteEl);
  }
  function maybeInvite() {
    if (inviteEl || cur || store.get(SEEN)) return;
    const home = q("#home"), veil = q("#veil");
    if (!ui.state || !ui.state.tracks || (home && !home.hidden) || (veil && !veil.hidden) || !q("#rows .row")) return;
    invite(true);
  }

  window.KillToyTour = { start, end, tours: TOURS, list: LIST };
  decorate();
})();
