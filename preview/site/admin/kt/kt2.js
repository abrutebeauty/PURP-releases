// KILLTOY 2: the new design (Eman's mock "Calm dark", v78) on the same app and engine.
// Loaded after app.js on the KILLTOY 2 page only (html.kt2). app.js's top-level functions
// are global, so this file wraps or replaces a few of them (renderClip, addClipHandles,
// drawWave, paintLoop...) and builds the new header, tools and footer around the old parts.
// Nothing here runs on the classic page.
(function () {
  if (!document.documentElement.classList.contains("kt2")) return;
  const html = document.documentElement;
  const K = (window.KT2 = { tool: "select", tab: "fx", tabsOff: new Set(), extraTabs: [] });
  // Eman, 14 Nov 22:26: a taller header (52 -> 82 px, everything under it moves down), a bigger footer when a
  // project opens (184 -> 242 px) and no grip bar on the footer edge (hovering the edge still shows the resize cursor).
  // KT2_HEAD_OLD = 52 px header, KT2_FOOT_OLD = 184 px footer, KT2_GRIP_SHOW = the little bar back.
  if (!window.KT2_HEAD_OLD) html.classList.add("k2-head-tall");
  if (window.KT2_GLOW_OLD) html.classList.add("k2-glow-old");   // speed pass 27 Nov: pulsing glows that repaint (kt2.css, kt2-explain.js)
  if (!window.KT2_FOOT_OLD) html.classList.add("k2-foot-tall");
  if (!window.KT2_GRIP_SHOW) html.classList.add("k2-grip-bare");
  // Eman, 15 Nov 00:24: footer default 205 px, top bar contents ~18% bigger (KT2_FOOT205_OLD, KT2_TOPBIG_OLD)
  if (!window.KT2_FOOT205_OLD) html.classList.add("k2-foot-205");
  if (!window.KT2_TOPBIG_OLD) html.classList.add("k2-top-big");

  const SVG = (d, w = 20) => `<svg viewBox="0 0 20 20" width="${w}" height="${w}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${d}</svg>`;
  const ICON = {
    select: '<path d="M5 3 L15 11 L10.5 11.6 L13 16.5 L11 17.4 L8.6 12.6 L5 15.5 Z" fill="currentColor"/>',
    draw: '<path d="M4 16 L5 12 L13 4 L16 7 L8 15 Z"/><path d="M11.5 5.5 L14.5 8.5"/>',
    paint: '<path d="M15.5 3.5 L9 10"/><path d="M8.5 10.5 C6 10.5 5 12.5 5 14 C5 15.5 3.8 16 3 16 C5 17.5 9.5 17.3 10 13.5 Z" fill="currentColor"/>',
    slice: '<path d="M5 15 L15 5"/><circle cx="5.5" cy="5.5" r="2"/><circle cx="5.5" cy="14.5" r="2"/><path d="M7 7 L10 10 M11.5 11.5 L15 15"/>',
    del: '<path d="M5 5 L15 15 M15 5 L5 15" stroke-width="2.6"/>',
    mute: '<path d="M2.5 10 C5 6 7.5 4.8 10 4.8 C12.5 4.8 15 6 17.5 10 C15 14 12.5 15.2 10 15.2 C7.5 15.2 5 14 2.5 10 Z"/><circle cx="10" cy="10" r="2.2" fill="currentColor"/>',
    // compound = several patterns packed into one box (Eman, 6 Nov 15:16); KT2_COMPOUND_ICON_OLD = the two squares
    compound: window.KT2_COMPOUND_ICON_OLD ? '<rect x="3" y="3" width="9" height="9" fill="currentColor"/><rect x="8" y="8" width="9" height="9"/>'
      : '<rect x="2.5" y="3" width="15" height="14"/><rect x="5" y="5.6" width="6.5" height="2.4" fill="currentColor" stroke="none"/><rect x="8.5" y="8.8" width="6.5" height="2.4" fill="currentColor" stroke="none"/><rect x="5" y="12" width="8" height="2.4" fill="currentColor" stroke="none"/>',
    dup: '<rect x="3" y="6.5" width="10.5" height="10.5"/><path d="M6.5 3.5 H17 V14"/><path d="M8.25 9.3 V14.2 M5.8 11.75 H10.7"/>',
    snap: '<path d="M10 10 m0 -1.2 a1.2 1.2 0 1 1 -1.2 1.2 a3 3 0 0 1 3 -3 a4.4 4.4 0 0 1 4.4 4.4 a6 6 0 0 1 -6 6 a7.4 7.4 0 0 1 -7.4 -7.4"/>',
    crown: '<path d="M3 15 L4.5 6 L8 10 L10 4 L12 10 L15.5 6 L17 15 Z" fill="currentColor" stroke="none"/>',
    star: '<path d="M10 0 L12.2 7.8 L20 10 L12.2 12.2 L10 20 L7.8 12.2 L0 10 L7.8 7.8 Z"/>',
    caret: '<path d="M2 3.5 L5 6.5 L8 3.5" stroke-width="1.6"/>',
    fold: '<path d="M2 4 L7 9 L12 4 M2 12 H12" stroke-width="1.6"/>',
    unfold: '<path d="M2 10 L7 5 L12 10" stroke-width="1.6"/>',
    fx: '<path d="M10 3 L10 17 M3 10 L17 10 M5 5 L15 15" />',
    inst: '<circle cx="10" cy="10" r="6.5"/><path d="M10 10 L13.5 6.5"/>',
    midi: '<rect x="3" y="4" width="14" height="12"/><path d="M7 4 V11 M10 4 V11 M13 4 V11"/>',
    warp: '<path d="M2 12 L6 12 L8 5 L11 15 L13 9 L18 9"/>',
    cards: '<rect x="3" y="5" width="9" height="12" rx="1"/><path d="M14 4 L18 5 L15.5 16.5 L13 16"/>',
    samples: '<rect x="3" y="3" width="6" height="6"/><rect x="11" y="3" width="6" height="6"/><rect x="3" y="11" width="6" height="6"/><rect x="11" y="11" width="6" height="6"/>',
    plus: '<path d="M10 4 V16 M4 10 H16"/>',
    pitch: '<circle cx="6" cy="13" r="2.3"/><circle cx="14" cy="7" r="2.3"/><path d="M8.3 13 H11 M11.7 7 H9"/>',
    stems: '<path d="M4 4 V16 M8 7 V16 M12 3 V16 M16 9 V16"/>',
    master: '<path d="M3 15 L7 9 L10 12 L17 4"/><path d="M13 4 H17 V8"/>',
  };
  const svg = (k, w) => SVG(ICON[k], w);

  // ------------------------------------------------------------------ header
  const top = document.querySelector(".top");
  const tools = el("div", "kt-tools");
  const TOOLS = [
    ["select", "Select", "V"], ["draw", "Draw", "P"], ["paint", "Paint", window.KT2_B_PAINT_OLD ? "B" : ""], ["slice", "Slice", "C"], "|",
    ["del", "Delete", "D"], ["mute", "Mute", "T"], ["compound", "Make compound", "G"], ...(window.KT2_NO_DUP_TOOL ? [] : [["dup", "Duplicate", "\u2318D"]]), ["snap", "Snap", "S"],
  ];
  for (const t of TOOLS) {
    if (t === "|") { tools.append(el("i", "sep")); continue; }
    const [id, name, key] = t;
    const b = el("button", "kt-tool");
    b.dataset.tool = id;
    b.innerHTML = svg(id) + `<span class="tip">${name}<em>${key}</em></span>`;
    b.onclick = () => pickTool(id);
    tools.append(b);
  }
  document.querySelector(".top-left").after(tools);

  // the time sits big in the centre of the header (click = play/stop)
  const time = $("pos-time");
  time.classList.add("kt-time");
  time.title = "Click or Space to play / stop";
  time.onclick = () => run("togglePlay");
  $("btn-play").after(time);
  $("btn-rec").after($("btn-play"));   // stop, rec, play, time
  $("btn-play").before($("btn-rec"));

  const mode = el("div", "kt-mode");
  mode.innerHTML = `<button class="on" data-mode="produce" title="PRODUCE">${svg("crown", 15)}</button><button class="rec" data-mode="record" title="RECORD"><i></i></button><button class="mix" data-mode="mix" title="MIX"><svg width="15" height="14" viewBox="0 0 15 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 1v12M7.5 1v12M12 1v12"/><rect x="1.2" y="7.5" width="3.6" height="2.4" fill="currentColor" stroke="none"/><rect x="5.7" y="3" width="3.6" height="2.4" fill="currentColor" stroke="none"/><rect x="10.2" y="9" width="3.6" height="2.4" fill="currentColor" stroke="none"/></svg></button>`;
  mode.onclick = (e) => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode); };
  const song = el("div", "kt-song");
  const songName = el("span"), vs = el("div", "vs");
  song.append(songName, vs);
  // Clicking the project name renames it right there (Eman, 10 Nov: it used to jump to the projects page;
  // the logo still does that). Enter or clicking away saves, Escape keeps the old name.
  // window.KT2_NAME_CLICK_OLD = true: the old way (click = projects page).
  if (window.KT2_NAME_CLICK_OLD) {
    song.title = "Your projects";
    song.onclick = (e) => { if (!e.target.closest(".vs")) showHome(true); };
  } else {
    songName.title = "Click to rename";
    const renameTop = () => {
      if (songName.querySelector("input")) return;
      const was = (ui.state && ui.state.session) || "";
      song.classList.add("k2-naming");
      inlineEdit(songName, was, (v) => run("renameSession", { name: v }).then((r) => {
        if (r && r.error) { toast(r.error); return; }
        const now = ui.state && ui.state.session;
        // the saved footer height follows the new name too (KT2_FOOT_SAVE_OFF: nothing saved)
        if (now && now !== was) { try { const fh = localStorage.getItem("kt2.footH:" + was); if (fh) { localStorage.setItem("kt2.footH:" + now, fh); localStorage.removeItem("kt2.footH:" + was); } } catch (e) {} K.footFor = "kt2.footH:" + now; }
        if (now && now !== was && window.KT2HomeRenamed) window.KT2HomeRenamed(was, now);   // cover, notes, playtime follow the new name
      }));
      const inp = songName.querySelector("input");
      if (inp) inp.addEventListener("blur", () => { song.classList.remove("k2-naming"); render(); });
    };
    song.onclick = (e) => { if (e.target.closest(".vs") || e.target.tagName === "INPUT") return; e.stopPropagation(); renameTop(); };
    song.ondblclick = (e) => { if (!e.target.closest(".vs")) e.stopPropagation(); };
  }
  document.querySelector(".readouts").append(mode, song);
  const bpmLabel = document.querySelector('label.ro .ro-l'); if (bpmLabel) bpmLabel.textContent = "BPM";

  // ---- BPM: drag up/down to change it, double-click to type it (Eman, 31 Oct)
  (function bpmDrag() {
    const inp = $("bpm");
    if (!inp) return;
    inp.title = window.KT2_BPM_REACH_OLD ? "Drag up or down to change the tempo (Shift = fine). Double-click to type it." : "Drag up or right to speed up, down or left to slow down, or scroll (Shift = fine). Double-click to type it.";
    inp.classList.add("k2-bpm");
    if (window.KT2_BPM_DRAG_OLD) inp.addEventListener("mousedown", (e) => {
      if (document.activeElement === inp || e.button !== 0) return;   // typing: leave the text alone
      e.preventDefault();
      const y0 = e.clientY, v0 = parseFloat(inp.value) || 120;
      let v = v0, moved = false;
      document.body.classList.add("k2-bpmdrag");
      const move = (ev) => {
        const dy = y0 - ev.clientY;
        if (Math.abs(dy) > 2) moved = true;
        v = Math.max(40, Math.min(250, ev.shiftKey ? Math.round((v0 + dy * 0.05) * 10) / 10 : Math.round(v0 + dy / 3)));
        inp.value = String(v);
      };
      const up = () => {
        window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
        document.body.classList.remove("k2-bpmdrag");
        if (moved && Math.abs(v - v0) > 1e-6) run("setBpm", { bpm: v });   // one step to undo
      };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    // The drag only lives while the button is held (Eman, 8 Nov: it kept moving after letting go when the
    // release was missed, e.g. let go outside the window). Pointer capture, and every way a press can end
    // ends it: up, cancel, lost capture, the window losing focus, and any move with no button down.
    // Each BPM step ticks (KT2Juice.sound.bpm), up the key's scale going up, down going down.
    // window.KT2_BPM_DRAG_OLD = true: the old mouse drag; window.KT2_BPM_TICK_OFF = true: no ticks.
    let drag = null;
    const tickAt = { t: 0, q: 0 };
    const tick = (i, dir) => {
      if (window.KT2_BPM_TICK_OFF) return;
      const J = window.KT2Juice; if (!J || !J.sound || !J.sound.bpm) return;
      const now = performance.now();
      if (now - tickAt.t < 22) return;   // a fast throw: a quick roll of ticks, never a pile-up
      tickAt.t = now; J.sound.bpm(i, dir);
    };
    const endDrag = () => {
      const d = drag; if (!d) return;
      drag = null;
      removeEventListener("pointermove", onMove, true); removeEventListener("pointerup", onUp, true);
      removeEventListener("pointercancel", onUp, true); removeEventListener("blur", onUp);
      inp.removeEventListener("lostpointercapture", onUp);
      document.removeEventListener("visibilitychange", onUp);
      try { if (inp.hasPointerCapture && inp.hasPointerCapture(d.id)) inp.releasePointerCapture(d.id); } catch (e) { /* fine */ }
      document.body.classList.remove("k2-bpmdrag");
      if (d.moved && Math.abs(d.v - d.v0) > 1e-6) run("setBpm", { bpm: d.v });   // one step to undo
    };
    function onUp() { endDrag(); }
    function onMove(ev) {
      const d = drag; if (!d || ev.pointerId !== d.id) return;
      if (ev.pointerType === "mouse" && !(ev.buttons & 1)) return endDrag();   // the release went missing: stop now
      // the box sits at the very top of the screen, so up had only ~25 px to go (+8 BPM a drag, stress test
      // 8 Nov): right counts as up too, left as down. window.KT2_BPM_REACH_OLD = true: up/down only.
      const dy = d.y0 - ev.clientY + (window.KT2_BPM_REACH_OLD ? 0 : ev.clientX - d.x0);
      if (Math.abs(dy) > 2) d.moved = true;
      const v = Math.max(40, Math.min(250, ev.shiftKey ? Math.round((d.v0 + dy * 0.05) * 10) / 10 : Math.round(d.v0 + dy / 3)));
      if (v === d.v) return;
      const dir = v > d.v ? 1 : -1;
      d.v = v; inp.value = String(v);
      tick(v - d.v0, dir);
    }
    if (!window.KT2_BPM_DRAG_OLD) inp.addEventListener("pointerdown", (e) => {
      if (document.activeElement === inp || e.button !== 0 || drag) return;   // typing: leave the text alone
      e.preventDefault();
      const v0 = parseFloat(inp.value) || 120;
      drag = { id: e.pointerId, y0: e.clientY, x0: e.clientX, v0, v: v0, moved: false };
      try { inp.setPointerCapture(e.pointerId); } catch (err) { /* window listeners still catch it */ }
      document.body.classList.add("k2-bpmdrag");
      addEventListener("pointermove", onMove, true); addEventListener("pointerup", onUp, true);
      addEventListener("pointercancel", onUp, true); addEventListener("blur", onUp);
      inp.addEventListener("lostpointercapture", onUp);
      document.addEventListener("visibilitychange", onUp);
    });
    // the old drag listened to mousedown; preventDefault on pointerdown does not stop the focus/text
    // selection from a mousedown, so stop that too (the input only focuses on double-click)
    if (!window.KT2_BPM_DRAG_OLD) inp.addEventListener("mousedown", (e) => { if (document.activeElement !== inp && e.button === 0) e.preventDefault(); });
    inp.addEventListener("dblclick", () => { inp.focus(); inp.select(); });
    // the wheel over the tempo: one notch = 1 BPM (Shift = 0.1), one undo step once the wheel rests
    let wheelT = 0, wheelV = null;
    if (!window.KT2_BPM_REACH_OLD) inp.addEventListener("wheel", (e) => {
      if (document.activeElement === inp || drag) return;
      e.preventDefault();
      const cur = wheelV != null ? wheelV : parseFloat(inp.value) || (ui.state && ui.state.bpm) || 120, step = e.shiftKey ? 0.1 : 1, dir = (e.deltaY || e.deltaX) < 0 ? 1 : -1;
      wheelV = Math.max(40, Math.min(250, Math.round((cur + dir * step) * 10) / 10));
      inp.value = String(wheelV); tick(dir, dir);
      clearTimeout(wheelT);
      wheelT = setTimeout(() => { const v = wheelV; wheelV = null; if (ui.state && Math.abs(v - ui.state.bpm) > 1e-6) run("setBpm", { bpm: v }); }, 350);
    }, { passive: false });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") { if (e.key === "Escape") inp.value = String(ui.state.bpm); inp.blur(); } });
  })();

  // ---- KEY: click it to pick the key. Simple = Minor / Major; Advanced = the other scales.
  const KEYN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SHORT = { dorian: "Dorian", phrygian: "Phrygian", harmonic: "Harm min", lydian: "Lydian", mixolydian: "Mixolyd", locrian: "Locrian",
    melodic: "Mel min", phrygdom: "Phryg dom", hungarian: "Hung min", double: "Dbl harm" };
  let keyTab = "simple";
  function keyPicker() {
    const old = document.querySelector(".k2-keypick");
    if (old) { old.remove(); return; }
    const chip = $("key-chip"), k = ui.state.key || {};
    const cur = { tonic: k.tonic != null ? k.tonic : 9, scale: k.scale || (k.minor || k.tonic == null ? "minor" : "major") };
    if (cur.scale !== "minor" && cur.scale !== "major") keyTab = "advanced";
    const box = el("div", "k2-keypick");
    const hasBeat = ui.state.tracks.some((t) => t.kind === "beat" && t.clips.length);
    const keyArgs = (tonic, scale) => {
      const SC = window.KT_SCALES || {};
      const minor = scale === "major" || scale === "lydian" || scale === "mixolydian" || scale === "phrygdom" || scale === "double" ? false : true;
      return { tonic, minor, ...(scale !== "minor" && scale !== "major" ? { scale, scaleName: SHORT[scale] || (SC[scale] && SC[scale].name) || scale } : {}) };
    };
    // a song that already has notes or key-following sounds: the new key waits for a choice, CONVERT
    // EVERYTHING (recommended) or JUST CHANGE THE KEY (Eman, 7 Nov 23:46). window.KT2_KEY_ASK_OLD = old (sets at once).
    const isDrum = (t) => /^(TOY DRUMS|KILLDRUM)$/i.test(t.instrument || "") || t.role === "drums";
    const hasStuff = () => ui.state.tracks.some((t) => (t.clips || []).some((c) => (c.kind === "midi" && !isDrum(t) && (c.notes || []).length) || (c.fit && c.fit.key)));
    const was = { tonic: cur.tonic, scale: cur.scale }, hadKey = k.tonic != null;
    const ask = !window.KT2_KEY_ASK_OLD && hadKey && hasStuff();
    // NO KEY (Eman, 8 Nov): new projects start in C major, this turns the key off. KT2_KEY_DEFAULT_OLD = no button (old).
    const noneBtn = !window.KT2_KEY_DEFAULT_OLD;
    let none = noneBtn && !hadKey;
    const keyName = (tonic, scale) => { const SC = window.KT_SCALES || {}; return KEYN[tonic] + (scale === "minor" ? "m" : scale === "major" ? "" : " " + (SHORT[scale] || (SC[scale] && SC[scale].name) || scale)); };
    const set = (tonic, scale) => {
      cur.tonic = tonic; cur.scale = scale; none = false;
      if (!ask) run("setKey", keyArgs(tonic, scale));
      paint();
    };
    const choose = async (convert) => {
      close();
      if (cur.tonic === was.tonic && cur.scale === was.scale) return;
      const r = await run(convert ? "convertKey" : "setKey", { ...keyArgs(cur.tonic, cur.scale), ...(convert ? {} : { keep: true }) });
      const nm = keyName(cur.tonic, cur.scale);
      if (window.toast) toast(convert ? `Everything is in ${nm} now.` : `Key is ${nm}. Your notes and sounds stayed as they were.`);
      return r;
    };
    function paint() {
      const SC = window.KT_SCALES || { minor: { name: "Minor" }, major: { name: "Major" } };
      const adv = Object.keys(SC).filter((x) => x !== "minor" && x !== "major");
      box.innerHTML = `<div class="k2-kp-tabs"><button data-tab="simple"${keyTab === "simple" ? ' class="on"' : ""}>Simple</button><button data-tab="advanced"${keyTab === "advanced" ? ' class="on"' : ""}>Advanced</button></div>
        <div class="k2-kp-notes">${KEYN.map((n, i) => `<button data-tonic="${i}"${i === cur.tonic && !none ? ' class="on"' : ""}>${n}</button>`).join("")}</div>
        <div class="k2-kp-scales ${keyTab}">${(keyTab === "simple" ? ["minor", "major"] : adv).map((x) => `<button data-scale="${x}"${x === cur.scale && !none ? ' class="on"' : ""}>${SC[x] ? SC[x].name : x}</button>`).join("")}</div>
        ${ask && (cur.tonic !== was.tonic || cur.scale !== was.scale) ? `<div class="k2-kp-ask"><div class="k2-kp-q">Change the song to <b>${keyName(cur.tonic, cur.scale)}</b>?</div>
          <button class="k2-kp-conv">CONVERT EVERYTHING TO ${keyName(cur.tonic, cur.scale).toUpperCase()}<small>Recommended \u00b7 every MIDI note and sound moves to the new key</small></button>
          <button class="k2-kp-keep">Just change the key<small>Your notes stay. Notes outside the new key may go quiet.</small></button></div>` : ""}
        ${noneBtn ? `<button class="k2-kp-none${none ? " on" : ""}">No key</button>` : ""}
        ${hasBeat ? '<button class="k2-kp-find">Find it from the beat</button>' : ""}`;
    }
    paint();
    box.addEventListener("mousedown", (e) => e.stopPropagation());
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.tab) { keyTab = b.dataset.tab; return paint(); }
      if (b.dataset.tonic) return set(Number(b.dataset.tonic), cur.scale);
      if (b.dataset.scale) return set(cur.tonic, b.dataset.scale);
      if (b.classList.contains("k2-kp-conv")) return choose(true);
      if (b.classList.contains("k2-kp-keep")) return choose(false);
      if (b.classList.contains("k2-kp-none")) { close(); if (!none) run("setKey", { tonic: null, keep: true }); return; }
      if (b.classList.contains("k2-kp-find")) { close(); run("analyzeBeat", { applyTempo: false }).then((r) => r && r.ok && toast("Listening to the beat again\u2026")); }
    });
    document.body.append(box);
    const r = chip.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(innerWidth - box.offsetWidth - 8, r.left + r.width / 2 - box.offsetWidth / 2)) + "px";
    box.style.top = r.bottom + 6 + "px";
    const close = () => { box.remove(); window.removeEventListener("mousedown", out, true); window.removeEventListener("keydown", esc, true); };
    const out = (e) => { if (!box.contains(e.target) && !chip.contains(e.target)) close(); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    setTimeout(() => { window.addEventListener("mousedown", out, true); window.addEventListener("keydown", esc, true); }, 0);
  }
  $("key-chip").onclick = (e) => { e.stopPropagation(); keyPicker(); };
  $("key-chip").title = "Click to pick the song's key";

  // star on the playhead
  const star = el("div", "k2-star");
  star.innerHTML = SVG(ICON.star, 17);
  $("playhead").append(star);
  // no triangle on the ruler: the star sits where it was, so the marker is just the star and the line
  // (Eman, 6 Nov 15:13); KT2_MARKER_TRI = true brings the triangle back
  if (!window.KT2_MARKER_TRI) {
    const rh = $("ruler-head"), s2 = el("div", "k2-star");
    s2.innerHTML = SVG(ICON.star, 17);
    rh.classList.add("k2-rh-star"); rh.append(s2);
    document.documentElement.classList.add("k2-star-marker");
  }
  // STAR BLADE marker (Eman, 16 Nov 02:52): a 4-point star, a small diamond under it, then a thin spike that runs
  // straight into the playhead line (same width and colour, no seam). It hangs from the line itself so it always
  // lines up. KT2_BLADE_OLD = the old star on the ruler
  if (!window.KT2_BLADE_OLD) {
    const bl = el("div", "k2-blade");
    const top = "M8.5 0Q9.4 10.2 17 11.4Q9.8 12.4 9.2 15.6Q9.5 17.2 11.2 18.8Q9.5 20.4 9.2 22";
    const bot = "Q7.5 20.4 5.8 18.8Q7.5 17.2 7.8 15.6Q7.2 12.4 0 11.4Q7.6 10.2 8.5 0Z";
    bl.innerHTML = '<svg viewBox="0 0 17 34" width="17" height="34" aria-hidden="true">' +
      '<path class="k2-bl1" d="' + top + 'Q9 28 9 34L8 34Q8 28 7.8 22' + bot + '"/>' +
      '<path class="k2-bl2" d="' + top + 'Q9.5 28 9.5 34L7.5 34Q7.5 28 7.8 22' + bot + '"/></svg>';
    $("playhead").append(bl);
    document.documentElement.classList.add("k2-blade-on");
    // the line always starts at the bottom of the top strip (parts + ruler, + TEMPO when open), also when the lanes
    // are scrolled down, so the blade stays in the ruler and its spike meets the line (Eman, 16 Nov 03:05).
    // KT2_BLADE_PIN_OFF = the line keeps its fixed top and scrolls with the lanes
    if (!window.KT2_BLADE_PIN_OFF) {
      let lastTop = NaN;
      (function pin() {
        try {
          const ph = $("playhead"), tr = $("toprow"), par = ph && ph.offsetParent;
          if (ph && tr && par && tr.offsetHeight) {
            const want = Math.round((tr.getBoundingClientRect().bottom - par.getBoundingClientRect().top - par.clientTop) * 2) / 2;
            if (want !== lastTop) { ph.style.top = want + "px"; lastTop = want; }
          }
        } catch (e) { /* next frame */ }
        requestAnimationFrame(pin);
      })();
    }
  }
  // purple marker (Eman, 11 Nov 01:24): purple while playing, a lighter dull purple when stopped;
  // KT2_MARKER_YELLOW = the old grey-white / acid-yellow marker
  if (!window.KT2_MARKER_YELLOW) document.documentElement.classList.add("k2-ph-purple");
  // purple while stopped, acid yellow while playing: line, blade and trail (Eman, 16 Nov 03:25);
  // KT2_PH_ACIDPLAY_OFF = purple both ways (dull purple stopped)
  if (!window.KT2_MARKER_YELLOW && !window.KT2_PH_ACIDPLAY_OFF) document.documentElement.classList.add("k2-ph-acid");
  // no coloured line above the PART markers (Eman, 16 Nov 03:04): with a picture or see-through PANELS the top bar's
  // frosted edge picked up the part colours just under it and flickered. A solid dark seam covers that edge.
  // KT2_PARTLINE_OLD = the old edge
  if (!window.KT2_PARTLINE_OLD) document.documentElement.classList.add("k2-partline-off");
  // a muted clip stays grey on hover, just a little lighter (Eman, 12 Nov 00:22); KT2_MUTED_HOVER_OLD = it showed its colour
  if (!window.KT2_MUTED_HOVER_OLD) document.documentElement.classList.add("k2-mute-hgrey");

  function pickTool(id) {
    if (id === "snap") { ui.snapOff = !ui.snapOff; toast(ui.snapOff ? "Snap off: clips and loops move freely" : "Snap on: everything lands on the grid"); return paintTools(); }
    if (id === "compound") { makeCompound(); return; }
    if (id === "dup") { duplicateSelected(); return; }   // DUPLICATE button (Eman, 6 Nov 15:16): copies the selected patterns
    K.tool = id;
    setCutMode(id === "slice");
    document.body.classList.toggle("k2-tool-del", id === "del");
    document.body.classList.toggle("k2-tool-mute", id === "mute");
    paintTools();
  }
  function paintTools() {
    tools.querySelectorAll(".kt-tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === K.tool || (b.dataset.tool === "snap" && !ui.snapOff)));
  }
  K.pickTool = pickTool;

  function setMode(m) {
    K.mode = m;
    mode.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
    html.classList.toggle("k2-rec", m === "record");
    if (window.KT2Mix) KT2Mix.show(m === "mix");
    if (window.KT2Record) KT2Record.show(m === "record");
    else if (m === "record") { toast("The RECORD page is next on the list. R still records into the armed lane."); setTimeout(() => setMode("produce"), 600); }
  }
  K.setMode = setMode;

  // ------------------------------------------------------------------ clips
  const hexHue = (c) => {
    const n = parseInt(String(c).replace("#", "").slice(0, 6), 16);
    if (isNaN(n)) return 260;
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return 0;
    const d = mx - mn;
    return Math.round(((mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60) % 360);
  };
  const bodyOf = (c, sat = 30, light = 11) => `hsl(${hexHue(c)} ${sat}% ${light}%)`;
  K.bodyOf = bodyOf;

  const _renderClip = renderClip;
  const liveBtn = (id, sel) => { const n = document.querySelector(`#rows .clip[data-clip-id="${id}"] ${sel}`); return n && n.isConnected ? n : null; };
  window.renderClip = renderClip = function (c, t, color) {
    color = noYellow(color);   // old sessions may still hold a yellow/orange colour: shown in the allowed one next to it
    if (c.color && noYellow(c.color) !== realHex(c.color)) c = { ...c, color: noYellow(c.color) };
    const node = _renderClip(c, t, c.color ? c.color : color);   // the notes and waves inside take the clip's own colour (Eman, 4 Nov)
    const col = c.color || color;
    node.style.setProperty("--c", col);
    node.style.setProperty("--k2-body", bodyOf(col, 30, c.cmp ? 14 : 11));
    // MIDI patterns filled with the instrument colour, notes darker on top, small bar notches on the
    // top edge, like FL (Eman, 10 Nov). KT2_PATTERN_DARK = true brings back the dark body + colour strip.
    // audio clips too (Eman, 10 Nov 21:06): colour fill, the wave drawn dark on it
    if (window.KT2_TITLE_FLAT) html.classList.add("k2-title-flat");   // all one colour, no darker notes area (old)
    if (!window.KT2_PATTERN_DARK && !c.cmp && (c.kind === "midi" || !window.KT2_AUDIO_DARK)) { node.classList.add("k2-full"); node.style.setProperty("--k2-body", col); }
    const label = node.querySelector(".clip-label");
    if (label && t.kind !== "beat") {
      const dd = el("button", "k2-dd");
      dd.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 5.5l5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      dd.title = "Clip menu";
      dd.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
      // selecting re-draws the clip, so the menu is placed at the new button, not the old one that left the page
      // (Eman's recording, 4 Nov: the first click opened the menu somewhere else)
      dd.addEventListener("click", (e) => {
        e.stopPropagation();
        const go = () => theClipMenu(liveBtn(c.id, ".k2-dd") || dd, c, t);
        if (!isSel(c.id)) { selectClip(c.id); requestAnimationFrame(go); } else go();
      });
      label.prepend(dd);
      label.querySelectorAll(".tag.fx").forEach((x) => x.remove());   // the FX tab shows the chain
      // a sound with two or more versions: its title opens the list of versions (Eman, 7 Nov)
      if (c.kind !== "midi" && t.kind === "take" && !window.KT2_LINK_OLD && window.KillToyLink) {
        const nm = label.querySelector(".nm");
        const vs = soundVersions(c);
        if (vs.length > 1) {
          const me = vs.find((v) => v.link === (c.link || c.src));
          if (nm && me) { nm.dataset.ver = "V" + me.ver; nm.classList.add("k2-vername"); }
          node.classList.add("k2-verclip");   // its title bar opens the versions (verHead below)
        }
      }
    }
    if (label) {
      // MIDI pill on a sound: opens the MIDI tab ("Convert it into playable MIDI?"); WAVE on a MIDI clip renders it to audio
      // the mock's icon chip at the right end of the header, always visible (Eman, 31 Oct): a waveform on
      // MIDI clips, little notes on sounds
      const mp = el("button", "k2-mp");
      mp.innerHTML = c.kind === "midi"
        ? '<svg width="12" height="9" viewBox="0 0 12 10"><path d="M1 5h1M3 2v6M5 3.5v3M7 1v8M9 3v4M11 5h0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>'
        : '<svg width="12" height="9" viewBox="0 0 12 10"><path d="M1 2h4M5 5h4M7 7.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
      mp.title = c.kind === "midi" ? "Render this MIDI clip to audio" : "Turn this sound into MIDI";
      mp.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
      mp.addEventListener("click", (e) => {
        e.stopPropagation();
        if (c.kind === "midi") return renderToAudio(c);
        if (!isSel(c.id)) selectClip(c.id);
        K.openTab("midi");
        const T = window.KT2Tabs;
        if (T && T.recreate) showMenu(liveBtn(c.id, ".k2-mp") || mp, [
          { heading: "MAKE IT MIDI" },
          { label: "FROM AUDIO SOURCE", meta: "its notes, on a TOY MACHINE", run: () => T.fromSource(c) },
          { label: "RECREATE THE SOUNDS", meta: "drums to KILLDRUM, the rest to TOY MACHINEs", run: () => T.recreate(c) },
        ]);
      });
      label.append(mp);
      if (t.kind !== "beat" && !window.KT2_NO_CLIP_LOOP) {
        const lp = el("button", "k2-loopbtn" + (K.loopClip === c.id ? " on" : ""));
        if (K.loopClip === c.id) node.classList.add("k2-looping");
        // a fully symmetrical infinity, centred in the pill (Eman, 10 Nov 21:26); KT2_LOOP_ICON_OLD = the old one
        lp.innerHTML = window.KT2_LOOP_ICON_OLD ? '<svg width="14" height="9" viewBox="0 0 14 9"><path d="M7 4.5C5.6 2.6 4.6 1.3 3.2 1.3a3.2 3.2 0 0 0 0 6.4c1.4 0 2.4-1.3 3.8-3.2s2.4-3.2 3.8-3.2a3.2 3.2 0 0 1 0 6.4C9.4 7.7 8.4 6.4 7 4.5z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
          : '<svg width="13" height="7" viewBox="0 0 14 8" style="display:block"><path d="M7 4C5.6 2 4.8 1.4 3.6 1.4A2.6 2.6 0 0 0 3.6 6.6C4.8 6.6 5.6 6 7 4C8.4 2 9.2 1.4 10.4 1.4A2.6 2.6 0 0 1 10.4 6.6C9.2 6.6 8.4 6 7 4Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/></svg>';
        lp.title = "Loop this clip on its own (click another clip or the background to stop)";
        lp.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
        lp.addEventListener("click", (e) => { e.stopPropagation(); const cc = findClip(c.id); if (cc) clipLoop(cc); });
        mp.before(lp);
      }
      // the speaker pill sits just left of the loop button (Eman, 10 Nov 21:31); KT2_MUTE_BY_NAME = after the name
      const mpill = !window.KT2_MUTE_BY_NAME && label.querySelector(":scope > .clip-mutep");
      if (mpill) { const lpb = label.querySelector(":scope > .k2-loopbtn"); (lpb || mp).before(mpill); mpill.classList.add("k2-mright"); }
    }
    return node;
  };

  // ---- colours nobody in the song uses yet (Eman, 31 Oct: "always a unique color")
  const hex2 = (n) => Math.round(n).toString(16).padStart(2, "0");
  function hslHex(h, sat, l) {
    sat /= 100; l /= 100;
    const f = (n) => { const k = (n + h / 30) % 12, a = sat * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return "#" + hex2(f(0)) + hex2(f(8)) + hex2(f(4));
  }
  function realHex(col) {
    if (!col) return null;
    const m = /^var\((--[\w-]+)\)$/.exec(col);
    if (m) col = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
    return /^#[0-9a-f]{6}$/i.test(col) ? col.toLowerCase() : null;
  }
  function usedColors() {
    const out = [];
    for (const t of (ui.state && ui.state.tracks) || []) {
      if (t.kind === "beat") continue;
      if (t.clips.some((c) => !c.color) || !t.clips.length) out.push(realHex(colorOf(t)));
      for (const c of t.clips) if (c.color) out.push(realHex(c.color));
    }
    return out.filter(Boolean);
  }
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  // yellow, gold, orange and peach are out for clips and lanes (Eman, 4 Nov): acid yellow is the
  // marker / loop / selected colour. A custom pick in that range slides to red or green.
  const BAN = [9, 88];
  // red is out too (Eman, 8 Nov: red patterns "look wrong"); red stays for warnings + overlap outlines.
  // KT2_RED_CLIPS_OLD = true lets red back in.
  const RED = [338, 9];
  const isRed = (h) => !window.KT2_RED_CLIPS_OLD && (h >= RED[0] || h <= RED[1]);
  // the acid yellow labels (BPM, key, A) must stand out on every clip (Eman, 10 Nov 23:00): lime /
  // yellow-green is out too, and no clip colour is pale enough to swallow the yellow (brightness capped,
  // the hue stays). KT2_ACID_SAFE_OLD = the old rules.
  const acidOld = () => !!window.KT2_ACID_SAFE_OLD;
  const banned = (h) => (h > BAN[0] && h < (acidOld() ? BAN[1] : 112)) || isRed(h);
  const relLum = (hx) => { const n = parseInt(hx.slice(1), 16), f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  function acidSafe(hx) {
    if (acidOld() || relLum(hx) <= 0.42) return hx;
    const n = parseInt(hx.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = (mx - mn) / (1 - Math.abs(2 * l - 1) || 1), h = hexHue(hx);
    let L = Math.round(l * 100), out = hx;
    while (L > 20 && relLum(out) > 0.42) { L -= 2; out = hslHex(h, Math.round(s * 100), L); }
    return out;
  }
  K.acidSafe = acidSafe;
  function noYellow(col) {
    const hx = realHex(col); if (!hx) return col;
    const n = parseInt(hx.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 0.12) return hx;   // greys are fine
    const h = hexHue(hx); if (!banned(h)) return acidSafe(hx);
    const l = (mx + mn) / 2, s = (mx - mn) / (1 - Math.abs(2 * l - 1) || 1);
    if (isRed(h)) return hslHex(318, Math.round(s * 100), Math.round(l * 100));   // red -> hot pink, nothing stays red
    return acidSafe(hslHex(h < 51 ? (window.KT2_RED_CLIPS_OLD ? 2 : 318) : acidOld() ? 100 : 140, Math.round(s * 100), Math.round(l * 100)));
  }
  K.noYellow = noYellow;
  // n colours, each at least ~22 degrees of hue away from every colour in the song and from each other
  function freshColors(n) {
    const taken = usedColors().map(hexHue), out = [];
    const far = (h, gap) => taken.every((x) => hueGap(x, h) >= gap) && out.every((x) => hueGap(hexHue(x), h) >= Math.max(gap, 30));
    for (const gap of [22, 14, 8]) {
      for (let i = 0; i < 36 && out.length < n; i++) {
        // golden-angle walk: spreads the picks round the wheel. It starts on blue, so the first
        // pattern in a song is blue (Eman, 8 Nov); KT2_RED_CLIPS_OLD = the old walk from red
        const h = ((window.KT2_RED_CLIPS_OLD ? 0 : 215) + i * 137.5) % 360;
        if (!banned(h) && far(h, gap)) out.push(acidSafe(hslHex(h, 78, 68)));
      }
      if (out.length >= n) break;
    }
    for (let k = 0; out.length < n && k < 60; k++) { const h = (k * 47 + 13) % 360; if (!banned(h)) out.push(acidSafe(hslHex(h, 70, 62))); }
    return out;
  }
  K.freshColors = freshColors;
  function colorPicker(anchor, c, t) {
    const old = document.querySelector(".k2-colpick");
    if (old) { old.remove(); if (old.dataset.clip === c.id) return; }
    const ids = isSel(c.id) ? selectedIds() : [c.id];
    const set = (color, drag) => run("setClipColor", { clipIds: ids, color: color && noYellow(color), drag: !!drag });
    const box = el("div", "k2-colpick");
    box.dataset.clip = c.id;
    const cur = realHex(c.color || colorOf(t)) || "#b79cff";
    box.innerHTML = `<div class="k2-cp-h">${ids.length > 1 ? ids.length + " clips" : "Colour"}</div>
      <div class="k2-cp-sw">${freshColors(8).map((x) => `<button data-col="${x}" style="--sw:${x}" title="Not used anywhere in the song yet"></button>`).join("")}</div>
      <div class="k2-cp-row"><label class="k2-cp-custom"><input type="color" value="${cur}">Custom</label>${c.color ? '<button class="k2-cp-reset">Channel colour</button>' : ""}</div>`;
    box.addEventListener("mousedown", (e) => e.stopPropagation());
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.col) { set(b.dataset.col); close(); }
      else if (b.classList.contains("k2-cp-reset")) { set(""); close(); }
    });
    let live = false;   // the clip follows the colour box as you move in it (Eman, 4 Nov)
    box.querySelector("input").addEventListener("input", (e) => { set(e.target.value, live); live = true; });
    box.querySelector("input").addEventListener("change", (e) => { if (!live) set(e.target.value); close(); });
    document.body.append(box);
    const r = anchor.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(innerWidth - box.offsetWidth - 8, r.left)) + "px";
    box.style.top = Math.min(innerHeight - box.offsetHeight - 8, r.bottom + 6) + "px";
    const close = () => { box.remove(); window.removeEventListener("mousedown", out, true); window.removeEventListener("keydown", esc, true); };
    const out = (e) => { if (!box.contains(e.target) && !anchor.contains(e.target)) close(); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    setTimeout(() => { window.addEventListener("mousedown", out, true); window.addEventListener("keydown", esc, true); }, 0);
  }

  // the menu's colour row: quick colours nobody in the song uses yet, then + for any colour (Eman, 31 Oct)
  function colorRow(c, t) {
    const ids = isSel(c.id) ? selectedIds() : [c.id];
    return { swatches: freshColors(7), custom: true, current: realHex(c.color || colorOf(t)), tip: "Not used anywhere in the song yet",
      pick: (color, drag) => run("setClipColor", { clipIds: ids, color: color && noYellow(color), drag: !!drag }) };
  }
  K.colorRow = colorRow;

  // ---- versions of a sound (kt2-link.js): every link of the same sound, oldest first
  function soundVersions(c) {
    const fam = c.fam || c.link || c.src, m = new Map();
    for (const tt of (ui.state && ui.state.tracks) || []) {
      if (tt.kind !== "take") continue;
      for (const x of tt.clips) {
        if (x.kind === "midi" || (x.fam || x.link || x.src) !== fam) continue;
        const l = x.link || x.src;
        if (!m.has(l)) m.set(l, { link: l, ver: x.ver || 1, color: x.color || colorOf(tt), name: x.name, ids: [] });
        m.get(l).ids.push(x.id);
      }
    }
    return [...m.values()].sort((a, b) => a.ver - b.ver);
  }
  function makeUniqueSounds(ids) {
    const fams = new Set(ids.map((x) => { const f = findClip(x); return f && (f.fam || f.link || f.src); }));
    run("makeUniqueSounds", { clipIds: ids, colors: freshColors(Math.max(1, fams.size)) }).then((r) => {
      if (!r || !r.ok) return;
      render();
      const v = r.versions && r.versions[0];
      toast(ids.length > 1 ? `${ids.length} clips are one new version now${v ? " (V" + v.ver + ")" : ""}: change one and they all change.` : `Its own version now${v ? " (V" + v.ver + ")" : ""}. Click the title to switch versions.`);
    });
  }
  // the versions as menu items: pick one and the selected clips move over to it
  function versionItems(c, ids) {
    const vs = soundVersions(c);
    if (vs.length < 2) return [];
    const mine = c.link || c.src;
    return [{ heading: "VERSIONS" }, ...vs.map((v) => ({
      label: `${String(v.name || c.name).toUpperCase()} V${v.ver}`, color: v.color, on: v.link === mine,
      meta: `${v.ids.length} clip${v.ids.length > 1 ? "s" : ""}`,
      run: () => {
        const move = ids.filter((x) => !v.ids.includes(x));
        if (!move.length) return;
        run("setSoundVersion", { clipIds: move, link: v.link }).then((r) => {
          if (!r || !r.ok) return;
          ui.selectedClip = ids[0]; ui.extraClips = new Set(ids.slice(1));   // they stay selected
          render(); toast(`${r.count} clip${r.count > 1 ? "s" : ""} on V${v.ver} now.`);
        });
      },
    }))];
  }
  // clicking a sound's title: its versions (only when there are two or more)
  function versionMenu(anchor, c, sel) {
    const ids = (sel || (isSel(c.id) ? selectedIds() : [c.id])).filter((x) => { const f = findClip(x); return f && f.kind !== "midi"; });
    const items = versionItems(c, ids);
    if (!items.length) return false;
    items[0] = { heading: ids.length > 1 ? `MOVE ${ids.length} CLIPS TO` : "VERSIONS" };
    showMenu(anchor, items);
    return true;
  }
  K.soundVersions = soundVersions; K.versionMenu = versionMenu;
  // A click (no drag) on the title bar of a sound clip that was already selected, alone or with others,
  // opens its versions (Eman, 7 Nov: "select any one or more ... and press the title"). The clip re-draws
  // when it's pressed, so this listens on the page and remembers what was selected at the press.
  {
    let press = null;
    const headAt = (e) => {
      const node = e.target.closest && e.target.closest("#rows .clip.k2-verclip");
      if (!node || e.target.closest("button, input, .edge, .fades")) return null;
      const lab = node.querySelector(".clip-label"), r = lab && lab.getBoundingClientRect(), n = node.getBoundingClientRect();
      if (!r || e.clientY > r.bottom + 2 || e.clientY < n.top) return null;
      return node.dataset.clipId;
    };
    document.addEventListener("pointerdown", (e) => {
      press = null;
      if (e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || K.tool !== "select") return;
      const cid = headAt(e);
      if (cid && isSel(cid)) press = { cid, x: e.clientX, y: e.clientY, sel: selectedIds() };
    }, true);
    document.addEventListener("pointerup", (e) => {
      const p = press; press = null;
      if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 3) return;
      setTimeout(() => {
        const c = findClip(p.cid);
        if (c) versionMenu(liveBtn(p.cid, ".clip-label") || { getBoundingClientRect: () => ({ left: p.x, right: p.x, top: p.y, bottom: p.y }) }, c, p.sel);
      }, 0);
    }, true);
  }

  // The ▾ menu before every clip name (Eman's order).
  // Make unique (FL Studio style): the pattern gets its own channel with a copy of the sound and notes
  function uniqueItems(c, t, many) {
    // sounds (Eman, 7 Nov): linked copies share colour, effects, volume and every control. MAKE UNIQUE on
    // one clip or a whole selection = ONE new version with one new colour; the title lists the versions.
    if (window.KillToyLink && !window.KT2_LINK_OLD && c.kind !== "midi" && t.kind === "take" && !c.cmp) {
      const ids = (many ? selectedIds() : [c.id]).filter((x) => { const f = findClip(x); return f && f.kind !== "midi"; });
      const l = c.link || c.src;
      const n = ui.state.tracks.reduce((a, tt) => a + tt.clips.filter((x) => (x.link || x.src) === l).length, 0);
      if (!many && n < 2 && soundVersions(c).length < 2) return [];
      const items = [];
      if (n > ids.length || many) items.push({ label: "Make unique", meta: many ? `${ids.length} clips, 1 new version` : `linked to ${n - 1} more`, run: () => makeUniqueSounds(ids) });
      return [...items, ...versionItems(c, ids)];
    }
    if (!many && c.kind !== "midi" && t.kind === "take" && !c.cmp) {
      // a sound: copies stay linked (drop a new sound on one, they all change) until it's made unique
      const l = c.link || c.src;
      const n = ui.state.tracks.reduce((a, tt) => a + tt.clips.filter((x) => (x.link || x.src) === l).length, 0);
      return n > 1 ? [{ label: "Make unique", meta: `linked to ${n - 1} more`, run: () => run("unlinkClip", { clipId: c.id }).then((r) => r && r.ok && toast("Its own sound now: dropping a new sound on it changes only this one.")) }] : [];
    }
    if (many || c.kind !== "midi" || t.kind !== "inst") return [];
    const np = c.pat ? ui.state.tracks.reduce((a, tt) => a + tt.clips.filter((x) => x.kind === "midi" && x.pat === c.pat).length, 0) : 1;
    const go = () => run("makeUniqueLane", { clipId: c.id, color: freshColors(1)[0] }).then((r) => {
      if (!r || !r.ok) return;
      ui.selectedClip = r.clipId; ui.extraClips.clear(); render();
      toast("Its own pattern now, right where it was: same notes and sound, change it freely. Cmd+Z puts it back.");
    });
    return [{ label: "Make unique", meta: np > 1 ? `linked to ${np - 1} more` : "new pattern", run: go }];   // no question (Eman, 31 Oct)
  }
  window.kt2UniqueItems = uniqueItems;

  function clipMenu2(anchor, c, t) {
    const audio = c.kind !== "midi";
    const ids = selectedIds(), many = ids.length > 1;
    const convert = audio && ui.state.canConvert && window.killtoyConvert ? killtoyConvert.menuItems(c, run, toast, openConverted) : [];
    const recreate = audio && ui.state.canRecreate && window.KT2Tabs && KT2Tabs.recreate ? [{ label: "Recreate the sounds", meta: "KILLDRUM + TOY MACHINE", run: () => KT2Tabs.recreate(c) }] : [];
    const stems = audio ? [{ label: "Split into stems", run: () => run("splitStems", { clipId: c.id }).then((r) => r && r.ok && toast(`Splitting ${c.name}. The stems arrive as their own rows.`)) }] : [];
    const variations = typeof variationItems === "function" ? variationItems({ clip: c }).slice(0, 1).map((x) => ({ ...x, label: "Make a variation" })) : [];
    const rev = audio && t.kind !== "beat" ? [{ label: c.reversed ? "Reverse back" : "Reverse", run: () => run("reverseClip", { clipId: c.id }) }] : [];
    const peek = !audio && window.KT2Peek && KT2Peek.available();
    const midiOnly = !audio ? [{ label: peek ? (KT2Peek.isOn(c.id) ? "Show the notes" : "Show as waveform") : "Render to audio", run: () => renderToAudio(c) }] : [];
    showMenu(anchor, [
      { heading: many ? `${ids.length} CLIPS` : c.name.toUpperCase() },
      ...(window.KT2_MENU_GROUP_OLD ? uniqueItems : (window.kt2UniqueItems || uniqueItems))(c, t, many),   // Make unique first (Eman, 4 Nov); + Group / Ungroup (9 Nov 13:20)
      ...(many ? [] : [...convert, ...recreate, ...midiOnly, ...stems, ...variations, ...rev]),
      { sep: true },
      ...(many ? [] : [{ label: "Rename", run: () => {
        const n = document.querySelector(`.clip[data-clip-id="${c.id}"] .nm`);
        if (n) inlineEdit(n, c.name, (v) => run("renameClip", { clipId: c.id, name: v }));
      } }]),
      colorRow(c, t),
      { label: "Make compound", meta: "G", run: () => makeCompound() },
      { label: "Duplicate after", meta: "Cmd+B", run: () => copyAfter() },
      { sep: true },
      { label: many ? `Delete ${ids.length} clips` : "Delete", meta: "⌫", danger: true, run: () => deleteSelected() },
    ]);
  }
  // ONE clip menu (Eman, 10 Nov 23:36): right-click and the corner arrow show the same short list,
  // Make unique first, Split into stems second. Only gone from the MENU (the features and their
  // shortcuts still work): Split at the marker (S), Deactivate (0), Reverse, Make it major/minor,
  // Make into drums, Slice to drums, Duplicate (top button, Cmd+D / Cmd+B).
  // window.KT2_MENU_ONE_OFF = the two old menus.
  function clipMenuOne(anchor, c, t) {
    if (!isSel(c.id)) selectClip(c.id);
    const audio = c.kind !== "midi", isBeat = t.kind === "beat";
    const ids = selectedIds(), many = ids.length > 1;
    // Make unique (+ Group / Ungroup / versions), with Make unique always on top
    const uni = (window.KT2_MENU_GROUP_OLD ? uniqueItems : (window.kt2UniqueItems || uniqueItems))(c, t, many);
    const isUni = (x) => x && /^Make unique/.test(x.label || "");
    let top = uni.filter(isUni);
    if (!top.length && !isBeat && !c.cmp && (audio ? t.kind === "take" : t.kind === "inst")) {
      top = [{ label: "Make unique", meta: "no copies yet", disabled: "This clip has no copies yet, so it's already unique." }];
    }
    const rest = uni.filter((x) => !isUni(x));
    const stems = audio && !many ? [{ label: "Split into stems", meta: "vocals, drums, bass...", run: () => run("splitStems", { clipId: c.id }).then((r) => r && r.ok && toast(`Splitting ${c.name}. The stems arrive as their own rows.`)) }] : [];
    const tune = audio && !many && t.kind === "take" && typeof openTune === "function" ? [{ label: "Tune\u2026", meta: "double-click", run: () => openTune(findClip(c.id)) }] : [];
    const vars = !many && typeof variationItems === "function" ? variationItems({ clip: c }) : [];
    // the two "make it into synths" tools, with hints that say how they differ
    const conv = audio && !many && ui.state.canConvert && window.killtoyConvert
      ? killtoyConvert.menuItems(c, run, toast, openConverted, ui.state.key).filter((x) => /^Make into MIDI$|^Clone the sound$/.test(x.label))
        .map((x) => ({ ...x, meta: x.label === "Clone the sound" ? "one part: notes + its sound" : "notes only, plain synth" }))
      : [];
    const recreate = audio && !many && ui.state.canRecreate && window.KT2Tabs && KT2Tabs.recreate ? [{ label: "Recreate the sounds", meta: "whole song: drums + synths", run: () => KT2Tabs.recreate(c) }] : [];
    const peek = !audio && window.KT2Peek && KT2Peek.available();
    const midiOnly = !audio && !many ? [{ label: peek ? (KT2Peek.isOn(c.id) ? "Show the notes" : "Show as waveform") : "Render to audio", run: () => renderToAudio(c) }] : [];
    const join = window.KillToyArrange ? KillToyArrange.clipItems(c, t, ids).filter((x) => /^Join/.test(x.label || "")) : [];
    const level = audio && !many ? [
      ...(c.gain ? [{ label: "Volume back to 0 dB", meta: fmtDb(c.gain || 0), run: () => run("setClipGain", { clipId: c.id, db: 0 }) }] : []),
      ...(c.fadeIn || c.fadeOut ? [{ label: "Remove fades", run: () => run("setClipFades", { clipId: c.id, fadeIn: 0, fadeOut: 0 }) }] : []),
    ] : [];
    // REIMAGINE SOUND / GENERATE SOUND (ACE, kt2-ace.js); KT2_ACE_OFF = not in the menu
    const ace = !many && window.KT2Ace ? KT2Ace.menuItems(c, t) : [];
    const tools = [...ace, ...vars, ...conv, ...recreate, ...midiOnly];
    showMenu(anchor, [
      { heading: many ? `${ids.length} CLIPS` : c.name.toUpperCase() },
      ...top, ...stems, ...rest, ...tune,
      ...(tools.length ? [{ sep: true }, ...tools] : []),
      ...(isBeat ? [] : [
        { sep: true },
        ...(many ? [] : [{ label: "Rename", run: () => {
          const n = document.querySelector(`.clip[data-clip-id="${c.id}"] .nm`);
          if (n) inlineEdit(n, c.name, (v) => run("renameClip", { clipId: c.id, name: v }));
        } }]),
        colorRow(c, t),
        ...level,
        { label: "Make compound", meta: "G", run: () => makeCompound() },
        ...join,
        { sep: true },
        { label: many ? `Delete ${ids.length} clips` : "Delete", meta: "\u232b", danger: true, run: () => deleteSelected() },
      ]),
    ]);
  }
  const theClipMenu = (anchor, c, t) => (window.KT2_MENU_ONE_OFF ? clipMenu2 : clipMenuOne)(anchor, c, t);
  K.clipMenu = theClipMenu;
  // right-click opens the same menu, at the mouse
  if (typeof clipMenu === "function") {
    const _rightClick = clipMenu;
    window.clipMenu = clipMenu = function (e, c, t) {
      if (window.KT2_MENU_ONE_OFF) return _rightClick(e, c, t);
      clipMenuOne(atMouse(e), c, t);
    };
  }
  // white line icons in front of menu items (Eman, 4 Nov), drawn on a 16 x 16 grid
  window.KT2_MENU_ICONS = [
    [/^Make unique/, '<circle cx="5" cy="8" r="3"/><circle cx="11" cy="8" r="3" stroke-dasharray="1.6 1.6"/>'],
    [/^Render to audio|^Show as waveform/, '<path d="M2 8h1.5M4.5 5v6M7 3v10M9.5 6v4M12 4v8M14 8h.5"/>'],
    [/^Make a variation|^Make variation|^Variation/, '<path d="M3 13V3M3 8h5l4-5M8 8l4 5"/><circle cx="12.5" cy="3" r="1"/><circle cx="12.5" cy="13" r="1"/>'],
    [/^Rename/, '<path d="M3 13h3l7-7-3-3-7 7z"/><path d="M8.5 4.5l3 3"/>'],
    [/^Make compound/, window.KT2_COMPOUND_ICON_OLD ? '<rect x="2" y="2" width="12" height="12"/><path d="M5 5h6v6H5z"/>' : '<rect x="1.5" y="2" width="13" height="12"/><path d="M4 5h5M7 8h5M4 11h6"/>'],
    [/^Duplicate/, '<rect x="2" y="5" width="9" height="9"/><path d="M5 2h9v9"/>'],
    [/^Delete/, '<path d="M3 4h10M6 4V2h4v2M4.5 4l.7 10h5.6l.7-10"/>'],
    [/^Split into stems/, '<path d="M8 2v4M8 6L3 14M8 6l5 8M8 6v8"/>'],
    [/^Split at/, '<path d="M8 1v14" stroke-dasharray="2 1.5"/><path d="M2 5h4v6H2M14 5h-4v6h4"/>'],
    [/^Reverse/, '<path d="M13 8H3M6 5L3 8l3 3"/><path d="M13 4v8"/>'],
    [/^Recreate/, '<circle cx="8" cy="8" r="2"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M3 13l2-2"/>'],
    [/MIDI|Clone the sound|Convert/, '<rect x="2" y="3" width="12" height="10"/><path d="M5 3v6M8 3v6M11 3v6"/>'],
    [/^Duplicate|^Copy/, '<rect x="2" y="5" width="9" height="9"/><path d="M5 2h9v9"/>'],
    [/^Mute|^Deactivate|^Activate/, '<path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 6l4 4M15 6l-4 4"/>'],
    [/^Join/, '<path d="M2 5h5v6H2M14 5H9v6h5"/><path d="M7 8h2"/>'],
    [/^Change it/, '<path d="M2 3h12v8H7l-3 3v-3H2z"/><path d="M5 7h6"/>'],
    [/^Reimagine sound|^Generate sound/, '<path d="M8 1.5l1.6 4.4 4.4 1.6-4.4 1.6L8 13.5l-1.6-4.4L2 7.5l4.4-1.6z"/><path d="M13 11.5v3M11.5 13h3"/>'],
    [/^Tune/, '<path d="M2 10c2-6 4-6 6 0s4 6 6 0"/>'],
    [/^Volume back|^Remove fades/, '<path d="M2 13L14 3"/><path d="M2 13h12"/>'],
  ];

  function renderToAudio(c) {
    if (ui.state && ui.state.canBounce) return run("bounceClip", { clipId: c.id }).then((r) => r && r.ok && toast("Rendered to audio on a new row."));
    // WAVE PEEK (Eman, 8 Nov): show the clip's sound as a waveform, rendered silently, nothing bounced (kt2-peek.js)
    if (window.KT2Peek && KT2Peek.available()) return KT2Peek.toggle(c);
    toast("Render to audio needs the app engine; the web page can't bounce a synth yet.");
  }

  // Cmd+B: copy the selection right after itself (press again to keep chaining).
  function copyAfter() {
    const list = selectedIds().map(findClip).filter((c) => c && c.track.kind !== "beat");
    if (!list.length) return toast("Select a clip first.");
    // now the same as Duplicate (Cmd+D), which pairs each copy with its own clip and pops it in where it ends up
    if (!window.KT2_DUP_GROUP_OLD && typeof duplicateSelected === "function") return duplicateSelected();
    const lo = Math.min(...list.map((c) => c.start)), hi = Math.max(...list.map((c) => c.start + c.length));
    // several clips (Eman, 11 Nov 02:13, same rule as Duplicate): the block goes to the next bar so the copies keep
    // their place in the bar (4 kicks in bar 9 -> bar 10), not glued to the end of the last one. One clip: right after.
    // window.KT2_DUP_GROUP_OLD = true: the old way (glued right after the last one).
    const shift = list.length > 1 && !window.KT2_DUP_GROUP_OLD && typeof dupShift === "function" ? dupShift(list) : hi - lo;
    const hold = window.KT2Juice && KT2Juice.holdCopies;   // the copies pop in where they end up (Eman, 11 Nov)
    if (hold) KT2Juice.holdCopies();
    run("duplicateClips", { clipIds: list.map((c) => c.id) }).then((r) => {
      if (!r || !r.clipIds || !r.clipIds.length) return;
      const moves = r.clipIds.map((id, i) => ({ clipId: id, start: list[i].start + shift, trackId: list[i].track.id }));
      return run("moveClips", { moves, drag: true }).then(() => {
        ui.selectedClip = r.clipIds[0]; ui.extraClips = new Set(r.clipIds.slice(1)); ui.laneSig = ""; render();
        if (hold) KT2Juice.popCopies(r.clipIds);
      });
    });
  }
  K.copyAfter = copyAfter;

  // Compound clips: kt2-compound.js.
  function makeCompound() {
    if (window.KT2Compound) return KT2Compound.make();
    toast("Compound clips need kt2-compound.js.");
  }

  // FL clip controls: volume half-dot at the bottom centre (in %), fade triangles in the top corners.
  const _addClipHandles = addClipHandles;
  window.addClipHandles = addClipHandles = function (node, c, t) {
    _addClipHandles(node, c, t);
    const w = Math.max(4, toX(c.length));
    // a small clip is for grabbing and moving: no fade corners or volume dot, thin trim edges (none when tiny).
    // Zoom in or make it longer and they come back (Eman, 31 Oct)
    node.classList.toggle("k2-small", w < 64);
    node.classList.toggle("k2-tinyclip", w < 30);
    if (w < 64) return;
    for (const side of ["in", "out"]) {
      const f = el("div", "k2-fade " + side);
      const v = side === "in" ? c.fadeIn || 0 : c.fadeOut || 0;
      // the fade-out corner is measured from the right edge, so it follows the edge live while the pattern
      // is stretched (Eman, 10 Nov: it only jumped into place on release). KT2_FADE_LEFT_OLD = old way.
      f.style.left = side === "in" ? toX(v) + "px" : window.KT2_FADE_LEFT_OLD ? w - toX(v) + "px" : `calc(100% - ${toX(v)}px)`;
      f.title = (side === "in" ? "Fade in" : "Fade out") + ": drag inward. Double-click to remove.";
      f.addEventListener("mousedown", (e) => fadeDrag2(e, c, side, node, f));
      f.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setClipFades", { clipId: c.id, fadeIn: side === "in" ? 0 : c.fadeIn || 0, fadeOut: side === "out" ? 0 : c.fadeOut || 0 }); });
      node.append(f);
    }
    const dot = el("div", "k2-vol");
    const tag = el("b", null, pct(c.gain || 0));
    dot.append(tag);
    dot.title = "Clip volume: drag up or down. Double-click for 100%.";
    dot.addEventListener("mousedown", (e) => (window.KT2_VOL_DRAG_OLD ? volDrag : volDrag2)(e, c, node, tag));
    dot.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setClipGain", { clipId: c.id, db: 0 }); });
    // the lane can be rebuilt mid-drag: the new dot keeps showing the % (Eman, 11 Nov 00:21)
    if (volLive && volLive.id === c.id) { node.classList.add("k2-voldrag"); tag.textContent = volLive.pct; }
    node.append(dot);
    if (!window.KT2_VOL_MIDDLE) placeVolsSoon();
  };
  // The volume circle sits in the middle of the part of the clip you can SEE (Eman, 6 Nov 16:31), so a long
  // song is never without one: it follows scrolling and zoom. KT2_VOL_MIDDLE = the middle of the whole clip.
  let volRaf = 0;
  function placeVols() {
    volRaf = 0;
    const sc = $("scroll"); if (!sc) return;
    const v = sc.getBoundingClientRect();
    for (const d of document.querySelectorAll("#rows .clip > .k2-vol")) {
      const r = d.parentElement.getBoundingClientRect();
      const a = Math.max(r.left, v.left), b = Math.min(r.right, v.right);
      const mid = b > a ? (a + b) / 2 - r.left : r.width / 2;
      d.style.left = Math.max(10, Math.min(r.width - 10, mid)) + "px";
    }
    if (!window.KT2_WAVE_DETAIL_OFF) waveDetail();
    if (!window.KT2_ZOOM_OLD) deepRuler();
  }
  // Zoomed far in, the ruler counts beats (9.2 = bar 9, beat 2) and milliseconds after each beat, only
  // over the part you see (Eman, 6 Nov 22:58: zoom right down to the samples and trim 10 ms by hand).
  function deepRuler() {
    const ruler = $("ruler"), sc = $("scroll"); if (!ruler || !sc) return;
    let box = ruler.querySelector(":scope > .k2-deep");
    const beatPx = secPerBeat() * ui.pxPerSec;
    if (beatPx < 240) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.className = "k2-deep"; ruler.append(box); }
    const vis = sc.clientWidth - HEAD_W, x0 = sc.scrollLeft, a = Math.max(0, (x0 - vis) / ui.pxPerSec), b = (x0 + 2 * vis) / ui.pxPerSec;
    const steps = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
    const ms = steps.find((x) => x * ui.pxPerSec >= 70) || 0.2;
    const key = [Math.round(a * 1000), Math.round(b * 1000), ui.pxPerSec, bpm()].join("|");
    if (box._key === key) return; box._key = key;
    const spb = secPerBeat(), parts = [];
    for (let k = Math.floor(a / spb); k * spb < b; k++) {
      const t = k * spb, bar = Math.floor(k / 4) + 1, beat = (k % 4) + 1;
      parts.push(`<div class="k2-dt beat" style="left:${(t * ui.pxPerSec).toFixed(1)}px">${bar}.${beat}</div>`);
      for (let j = 1; j * ms < spb - ms * 0.5; j++) {
        const tt = t + j * ms; if (tt < a || tt > b) continue;
        const lab = ms < 0.001 ? (j * ms * 1000).toFixed(1) : Math.round(j * ms * 1000);
        parts.push(`<div class="k2-dt" style="left:${(tt * ui.pxPerSec).toFixed(1)}px">+${lab} ms</div>`);
      }
    }
    box.innerHTML = parts.join("");
  }
  // while a zoom gesture stretches everything, show the plain picture under the close-up (it redraws sharp right after)
  if (typeof zoomAt === "function" && !window.KT2_ZOOM_OLD) {
    const _zoomAt = zoomAt;
    window.zoomAt = zoomAt = function (f, x) {
      for (const d of document.querySelectorAll("#rows canvas.k2-wdet")) { d.style.visibility = "hidden"; d._key = ""; const b = d.previousElementSibling; if (b) b.style.visibility = ""; }
      const r = _zoomAt(f, x);
      placeVolsSoon();
      return r;
    };
  }

  // Close-up waveforms (Eman, 6 Nov 19:06: "better resolution when zooming in close ... like vector
  // graphic"). Zoomed in, each audio clip gets a second canvas over just the part on screen, drawn
  // from the real samples at screen resolution: the same shape as the full picture, and when it's so
  // close that there are fewer samples than pixels, one smooth line through the samples.
  // KT2_WAVE_DETAIL_OFF = old (the full picture stretched).
  const DET_PX_PER_SEC = 40;   // closer than this (css px per second) the close-up takes over
  let detNo = 0;
  function waveDetail() {
    const sc = $("scroll"); if (!sc) return;
    const v = sc.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, near = ui.pxPerSec >= DET_PX_PER_SEC;
    // not the play-glow layer (kt2-juice.js kj-wake): it is no waveform and must not take the close-up away (Eman, 7 Nov 17:22)
    for (const base of document.querySelectorAll("#rows .clip > canvas:not(.k2-wdet):not(.kj-wake)")) {
      const clip = base.parentElement, w = base._k2w;
      let det = clip.querySelector(":scope > canvas.k2-wdet");
      const r = clip.getBoundingClientRect(), a = Math.max(r.left, v.left), b = Math.min(r.right, v.right);
      if (!w || !near || b - a < 2 || clip.classList.contains("midi") || w.c.reversed) {
        if (det) { det.remove(); base.style.visibility = ""; }
        continue;
      }
      if (!det) { det = document.createElement("canvas"); det.className = "k2-wdet"; base.after(det); }
      const left = a - r.left, width = b - a;
      const key = [w.c.id, w.loud, w.col, Math.round(left), Math.round(width), ui.pxPerSec, base.offsetHeight, w.c.gain, w.c.fadeIn, w.c.fadeOut].join("|");
      if (det._key === key) continue;
      det._key = key;
      const my = ++detNo; det._no = my;
      const from = left / ui.pxPerSec, to = (left + width) / ui.pxPerSec, W = Math.round(width * dpr), H = Math.round(base.offsetHeight * dpr);
      booth("getWaveDetail", { clipId: w.c.id, from, to, cols: W }).then((d) => {
        if (det._no !== my || !det.isConnected) return;
        if (!d) { det.remove(); base.style.visibility = ""; return; }
        det.style.left = left + "px"; det.style.width = width + "px"; det.style.top = base.offsetTop + "px"; det.style.height = base.offsetHeight + "px";
        det.width = W; det.height = H; det.style.visibility = "";
        paintDetail(det.getContext("2d"), W, H, dpr, w, d, from, to);
        base.style.visibility = "hidden";
      }, () => {});
    }
  }
  function paintDetail(g, W, H, dpr, w, d, from, to) {
    const host = g.canvas.parentElement, full = !!(host && host.classList.contains("k2-full")), c = w.c, col = full ? "#000000" : w.col;
    const topY = 17 * dpr, h = H - topY - 3 * dpr, mid = topY + h / 2, half = h / 2 - 1 * dpr;
    const gain = Math.min(0.94 / w.loud, 4) * half * dbToLin(c.gain || 0);
    const fin = c.fadeIn || 0, fout = c.fadeOut || 0;
    const fade = (t) => { let k = 1; if (fin > 0 && t < fin) k *= t / fin; if (fout > 0 && t > c.length - fout) k *= (c.length - t) / fout; return Math.max(0, k); };
    const light = (amt) => { const v = parseInt(String(col).replace("#", "").slice(0, 6), 16), m = (x) => Math.round(x + (255 - x) * amt); return `rgb(${m(v >> 16)},${m((v >> 8) & 255)},${m(v & 255)})`; };
    g.clearRect(0, 0, W, H);
    if (d.samples) {   // closer than one sample a pixel: a clean line through the samples
      const s = d.samples, xOf = (i) => ((d.t0 + i * d.dt - from) / (to - from)) * W, yOf = (i) => mid - Math.max(-half, Math.min(half, s[i] * gain * fade(d.t0 + i * d.dt)));
      g.beginPath(); g.moveTo(xOf(0), mid);
      for (let i = 0; i < s.length; i++) g.lineTo(xOf(i), yOf(i));
      g.lineTo(xOf(s.length - 1), mid); g.closePath();
      g.globalAlpha = full && !window.KT2_AUDIO_WAKE_OLD ? 0.6 : 0.28; g.fillStyle = col; g.fill(); g.globalAlpha = 1;
      g.beginPath();
      for (let i = 0; i < s.length; i++) { const x = xOf(i), y = yOf(i); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.lineJoin = "round"; g.lineCap = "round"; g.lineWidth = 1.8 * dpr; g.strokeStyle = col; g.stroke();
      if (!window.KT2_CLIP_RED_OFF) {   // samples past 0 dBFS: red, stronger the further over
        const lin = dbToLin(c.gain || 0);
        for (let i = 1; i < s.length; i++) {
          const v = Math.max(Math.abs(s[i - 1]) * fade(d.t0 + (i - 1) * d.dt), Math.abs(s[i]) * fade(d.t0 + i * d.dt)) * lin;
          if (!(v > 1)) continue;
          g.beginPath(); g.moveTo(xOf(i - 1), yOf(i - 1)); g.lineTo(xOf(i), yOf(i));
          g.strokeStyle = redCol(Math.min(RED_LV - 1, Math.floor((20 * Math.log10(v) / 9) * RED_LV))); g.lineWidth = 2.4 * dpr; g.stroke();
        }
      }
      const step = W / s.length;
      if (step > 10 * dpr) { g.fillStyle = light(0.6); for (let i = 0; i < s.length; i++) { g.beginPath(); g.arc(xOf(i), yOf(i), 1.8 * dpr, 0, 7); g.fill(); } }
      g.fillStyle = hexA(col, 0.25); g.fillRect(0, mid - 0.5 * dpr, W, Math.max(1, dpr * 0.5));
      return;
    }
    const n = d.max.length, hi = new Float32Array(W), lo = new Float32Array(W), up = new Float32Array(W), dn = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const i = Math.min(n - 1, Math.floor((x * n) / W)), k = fade(from + ((to - from) * x) / W);
      hi[x] = Math.min(half, Math.max(0.6 * dpr, d.max[i] * gain * k));
      lo[x] = Math.min(half, Math.max(0.6 * dpr, -d.min[i] * gain * k));
      up[x] = d.max[i] * k; dn[x] = -d.min[i] * k;
    }
    const lin = dbToLin(c.gain || 0), red = () => paintClipRed(g, W, mid, hi, lo, up, dn, lin);
    const shape = (s, fill) => {
      g.beginPath(); g.moveTo(0, mid);
      for (let x = 0; x < W; x++) g.lineTo(x + 0.5, mid - hi[x] * s);
      for (let x = W - 1; x >= 0; x--) g.lineTo(x + 0.5, mid + lo[x] * s);
      g.closePath(); g.fillStyle = fill; g.fill();
    };
    if (full) { if (window.KT2_AUDIO_WAKE_OLD) { shape(1, "rgba(0,0,0,0.5)"); shape(0.55, "rgba(0,0,0,0.12)"); } else { shape(1, "rgba(0,0,0,0.68)"); shape(0.55, "rgba(0,0,0,0.12)"); } red(); return; }   // dark by default (Eman, 10 Nov 21:44)
    shape(1, w.isBeat ? light(0.15) : col);
    g.save(); g.filter = `blur(${1.5 * dpr}px)`; g.globalAlpha = 0.13;
    const core = light(0.8);
    for (let i = 0; i < 16; i++) shape(0.68 - i * 0.04, core);
    g.restore();
    red();
  }
  function placeVolsSoon() { if (!volRaf) volRaf = requestAnimationFrame(placeVols); }
  K.placeVols = placeVolsSoon;
  (function hookVolScroll() {
    const sc = $("scroll");
    if (!sc) return setTimeout(hookVolScroll, 300);
    sc.addEventListener("scroll", () => { if (!window.KT2_VOL_MIDDLE) placeVolsSoon(); }, { passive: true });
    // lanes get rebuilt on their own too (scrolling, playing): the close-up layer comes back with them
    const rows = $("rows");
    if (rows) new MutationObserver((ms) => { if (!window.KT2_WAVE_DETAIL_OFF && ms.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && !n.classList.contains("k2-wdet")))) placeVolsSoon(); }).observe(rows, { childList: true, subtree: true });
    addEventListener("resize", () => { if (!window.KT2_VOL_MIDDLE) placeVolsSoon(); });
  })();
  const pct = (db) => Math.round(dbToLin(db) * 100) + "%";
  K.pct = pct;

  function volDrag(e, c, node, tag) {
    if (e.button !== 0) return;
    const canvas = node.querySelector("canvas"), y0 = e.clientY, lin0 = dbToLin(c.gain || 0);
    if (window.clipLive) clipLive(canvas);   // the picture squashes live while dragging
    let db = c.gain || 0;
    node.classList.add("k2-voldrag");
    liveDrag(e, (ev) => {
      // 1 px = 1% (Alt: finer), from 0% to 400% (+12 dB)
      const p = Math.max(0, Math.min(400, lin0 * 100 + (y0 - ev.clientY) * (ev.altKey ? 0.25 : 1)));
      db = p <= 0.1 ? -60 : Math.max(-60, Math.min(12, 20 * Math.log10(p / 100)));
      db = Math.round(db * 10) / 10;
      tag.textContent = Math.round(p) + "%";
      if (canvas) canvas.style.transform = `scaleY(${Math.max(0.02, dbToLin(db) / Math.max(1e-3, lin0))})`;
      return (first) => run("setClipGain", { clipId: c.id, db, drag: !first });
    }, (ev, none) => {
      node.classList.remove("k2-voldrag");
      if (!none) run("setClipGain", { clipId: c.id, db, drag: true });
      ui.laneSig = ""; render();
    });
  }

  // Volume dot drag, new way (Eman, 11 Nov 00:20). The % label stays up the whole drag even when the
  // lane is rebuilt under it, the wave redraws live so peaks pushed past 0 dBFS show red while you pull,
  // and a quick second click puts it back to 100% (the first click's rebuild ate the real dblclick).
  // KT2_VOL_DRAG_OLD = old drag.
  let volLive = null, volLastDown = null, volPaint = 0;
  function volDrag2(e, c, node, tag) {
    if (e.button !== 0) return;
    const now = performance.now();
    if (volLastDown && volLastDown.id === c.id && now - volLastDown.t < 400) {
      volLastDown = null; e.preventDefault(); e.stopPropagation();
      run("setClipGain", { clipId: c.id, db: 0 }).then(() => { ui.laneSig = ""; render(); });
      return;
    }
    volLastDown = { id: c.id, t: now };
    const y0 = e.clientY, lin0 = dbToLin(c.gain || 0);
    let db = c.gain || 0, moved = false;
    volLive = { id: c.id, pct: pct(db) };
    const live = () => document.querySelector(`#rows .clip[data-clip-id="${CSS.escape(c.id)}"]`) || node;
    node.classList.add("k2-voldrag");
    const repaint = () => {
      volPaint = 0;
      const n = live(), cv = n.querySelector("canvas:not(.k2-wdet):not(.kj-wake)"), w = cv && cv._k2w;
      if (w) { drawWave(cv, Object.assign({}, w.c, { gain: db }), w.col, w.isBeat); }
    };
    liveDrag(e, (ev) => {
      const p = Math.max(0, Math.min(400, lin0 * 100 + (y0 - ev.clientY) * (ev.altKey ? 0.25 : 1)));
      db = p <= 0.1 ? -60 : Math.max(-60, Math.min(12, 20 * Math.log10(p / 100)));
      db = Math.round(db * 10) / 10;
      moved = true;
      volLive.pct = Math.round(p) + "%";
      const n = live(), t = n.querySelector(".k2-vol b");
      n.classList.add("k2-voldrag");
      if (t) t.textContent = volLive.pct;
      if (!volPaint) volPaint = requestAnimationFrame(repaint);
      return (first) => run("setClipGain", { clipId: c.id, db, drag: !first });
    }, (ev, none) => {
      volLive = null;
      if (volPaint) { cancelAnimationFrame(volPaint); volPaint = 0; }
      live().classList.remove("k2-voldrag"); node.classList.remove("k2-voldrag");
      if (moved) volLastDown = null;
      if (!none) run("setClipGain", { clipId: c.id, db, drag: true });
      ui.laneSig = ""; render();
    });
  }

  // Peaks pushed past 0 dBFS by the clip volume turn red (Eman, 11 Nov 00:19). Per file: a column is
  // over when its real sample peak x clip volume > 1, so where it starts depends on how loud the file
  // already is. The red covers the part of the peak that is over (1 - 1/level of it) and gets
  // stronger the further over it goes (full red at +9 dB). up/dn = raw peak per column (after fades).
  // KT2_CLIP_RED_OFF = no red.
  const RED_LV = 8;
  const redCol = (L) => { const t = L / (RED_LV - 1), gb = Math.round(85 * (1 - t)); return `rgba(255,${gb},${gb},${(0.85 + 0.15 * t).toFixed(2)})`; };
  function paintClipRed(g, W, mid, hi, lo, up, dn, lin, dx) {
    if (window.KT2_CLIP_RED_OFF || !(lin > 0)) return;
    const rects = [];
    for (let x = 0; x < W; x++) {
      for (let side = 0; side < 2; side++) {
        const v = (side ? dn[x] : up[x]) * lin; if (!(v > 1)) continue;
        const h = side ? lo[x] : hi[x], band = Math.max(1, h * (1 - 1 / v));
        const L = Math.min(RED_LV - 1, Math.floor((20 * Math.log10(v) / 9) * RED_LV));
        (rects[L] || (rects[L] = [])).push(x + (dx || 0), side ? mid + h - band : mid - h, band);
      }
    }
    for (let L = 0; L < RED_LV; L++) {
      const r = rects[L]; if (!r) continue;
      g.beginPath(); for (let i = 0; i < r.length; i += 3) g.rect(r[i], r[i + 1], 1, r[i + 2]);
      g.fillStyle = redCol(L); g.fill();
    }
  }
  K.paintClipRed = paintClipRed;

  function fadeDrag2(e, c, side, node, h) {
    if (e.button !== 0) return;
    const x0 = e.clientX, v0 = side === "in" ? c.fadeIn || 0 : c.fadeOut || 0, w = Math.max(4, toX(c.length));
    let v = v0;
    liveDrag(e, (ev) => {
      const d = (ev.clientX - x0) / ui.pxPerSec * (side === "in" ? 1 : -1);
      const other = side === "in" ? c.fadeOut || 0 : c.fadeIn || 0;
      v = Math.max(0, Math.min(c.length - other, v0 + d));
      h.style.left = side === "in" ? toX(v) + "px" : window.KT2_FADE_LEFT_OLD ? w - toX(v) + "px" : `calc(100% - ${toX(v)}px)`;
      return null;
    }, () => {
      if (Math.abs(v - v0) < 1e-4) return;
      run("setClipFades", { clipId: c.id, fadeIn: side === "in" ? v : c.fadeIn || 0, fadeOut: side === "out" ? v : c.fadeOut || 0 });
    });
  }

  // Waveforms in the new look: the clip's colour at the peaks, brightening to near-white toward
  // the centre line (soft nested copies that follow the spikes), under the 17px header.
  const _drawWave = drawWave;
  window.drawWave = drawWave = async function (canvas, c, color, isBeat, take) {
    if (take != null) return _drawWave(canvas, c, color, isBeat, take);
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(4, toX(c.length));
    const buckets = Math.round(Math.min(8192, Math.max(16, cssW * dpr)));
    const key = `${c.id}:${c.offset.toFixed(3)}:${c.length.toFixed(3)}:${c.reversed ? "rev:" : ""}` + c.take + JSON.stringify(c.comp || null);
    let data = ui.peaks.get(key);
    if (!data || data.max.length < buckets * 0.9) {
      data = await booth("getPeaks", { clipId: c.id, buckets });
      if (!data || !data.peak) return;
      if (!data.max) { data.max = data.peak; data.min = data.peak.map((v) => -v); }
      ui.peaks.set(key, data);
    }
    const col = c.color || color;
    requestAnimationFrame(() => {
      const rect = typeof layoutRect === "function" ? layoutRect(canvas) : canvas.getBoundingClientRect();
      if (!rect.width) return;
      const W = Math.min(16384, Math.round(rect.width * dpr)), H = Math.round(rect.height * dpr);
      canvas.width = W; canvas.height = H;
      const g = canvas.getContext("2d");
      const topY = 17 * dpr, h = H - topY - 3 * dpr, mid = topY + h / 2, half = h / 2 - 1 * dpr;
      let loud = 0.02;
      for (let i = 0; i < data.max.length; i++) loud = Math.max(loud, data.max[i], -data.min[i]);
      const fin = c.fadeIn || 0, fout = c.fadeOut || 0;
      const gain = Math.min(0.94 / loud, 4) * half * dbToLin(c.gain || 0);
      canvas._k2w = { c, col, isBeat, loud };   // for the close-up layer (waveDetail)
      if (!window.KT2_WAVE_DETAIL_OFF) placeVolsSoon();   // so the close-up comes in right after a zoom, not only on scroll
      const n = data.max.length, hi = new Float32Array(W), lo = new Float32Array(W), up = new Float32Array(W), dn = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        const i0 = Math.floor((x * n) / W), i1 = Math.max(i0 + 1, Math.floor(((x + 1) * n) / W));
        let a = 0, b = 0;
        for (let i = i0; i < i1 && i < n; i++) { if (data.min[i] < a) a = data.min[i]; if (data.max[i] > b) b = data.max[i]; }
        // fades thin the wave toward the edge
        const t = (x / W) * c.length;
        let k = 1;
        if (fin > 0 && t < fin) k *= t / fin;
        if (fout > 0 && t > c.length - fout) k *= (c.length - t) / fout;
        hi[x] = Math.min(half, Math.max(0.6 * dpr, b * gain * k));
        lo[x] = Math.min(half, Math.max(0.6 * dpr, -a * gain * k));
        up[x] = b * k; dn[x] = -a * k;
      }
      const red = () => paintClipRed(g, W, mid, hi, lo, up, dn, dbToLin(c.gain || 0));
      const shape = (s, fill) => {
        g.beginPath(); g.moveTo(0, mid);
        for (let x = 0; x < W; x++) g.lineTo(x, mid - hi[x] * s);
        for (let x = W - 1; x >= 0; x--) g.lineTo(x, mid + lo[x] * s);
        g.closePath(); g.fillStyle = fill; g.fill();
      };
      const light = (amt) => { const v = parseInt(String(col).replace("#", "").slice(0, 6), 16), m = (x) => Math.round(x + (255 - x) * amt); return `rgb(${m(v >> 16)},${m((v >> 8) & 255)},${m(v & 255)})`; };
      if (canvas.closest && canvas.closest(".k2-full")) { if (window.KT2_AUDIO_WAKE_OLD) { shape(1, "rgba(0,0,0,0.5)"); shape(0.55, "rgba(0,0,0,0.12)"); } else { shape(1, "rgba(0,0,0,0.68)"); shape(0.55, "rgba(0,0,0,0.12)"); } red(); if (!window.KT2_WAVE_DETAIL_OFF && K.placeVols) K.placeVols(); return; }   // full-colour clip: dark wave
      shape(1, isBeat ? light(0.15) : col);
      g.save();
      g.filter = `blur(${1.5 * dpr}px)`;
      g.globalAlpha = 0.13;
      const core = light(0.8);
      for (let i = 0; i < 16; i++) shape(0.68 - i * 0.04, core);
      g.restore();
      red();
      if (!window.KT2_WAVE_DETAIL_OFF && K.placeVols) K.placeVols();   // the close-up layer, now that this clip has its picture
    });
  };

  // The loop strip holds the bar numbers: the ones inside the loop turn dark.
  const _paintLoop = paintLoop;
  window.paintLoop = paintLoop = function (lo, hi, on) {
    const sl = ui.transport && ui.transport.soloLane;   // a lane window LOOPs its pattern: the song keeps its own loop on screen
    if (sl) { lo = sl.lo; hi = sl.hi; on = sl.on && hi > lo; }
    _paintLoop(lo, hi, on);
    const bar = secPerBar(), ticks = document.querySelectorAll("#ruler .tick");
    const key = [lo, hi, on, ui.pxPerSec, ticks.length, ticks[0]].join("|");   // every tick of the transport: only redo when it changed
    if (key === K._tickKey && ticks[0] === K._tick0) return;
    K._tickKey = key; K._tick0 = ticks[0];
    ticks.forEach((tk) => {
      const at = parseFloat(tk.style.left) / ui.pxPerSec;
      tk.classList.toggle("inlp", !!on && at >= lo - 1e-3 && at < hi - bar * 0.05);
    });
  };

  // ------------------------------------------------------------------ after each render
  const _render = render;
  window.render = render = function () {
    _render.apply(this, arguments);
    if (K.applyFoot) K.applyFoot();
    afterRender();
    if (!window.KT2_WAVE_DETAIL_OFF && K.placeVols) K.placeVols();   // close-up waveforms follow the zoom
  };
  // The other clips go dark only to point at one (Eman, 4 Nov): while it's soloed, looping (its loop
  // button), or after FX / WARP was pressed for it. Just picking a clip leaves the rest alone.
  K.spot = null; K.loopClip = null;
  function spotlight() {
    const id = ui.selectedClip, s = ui.state, c = id && typeof findClip === "function" ? findClip(id) : null;
    if (K.loopClip && K.loopClip !== id) endClipLoop();
    if (K.spot && K.spot !== id) K.spot = null;
    const solo = !!(c && ((ui.transport && ui.transport.soloLane) || (c.track && c.track.solo)));
    const on = !!c && !!document.querySelector(".clip.selected") && !ui.selectedTrack && (solo || K.loopClip === id || K.spot === id);
    html.classList.toggle("k2-picking", on);
    document.querySelectorAll("#rows .k2-loopbtn").forEach((b) => b.classList.toggle("on", b.closest(".clip") && b.closest(".clip").dataset.clipId === K.loopClip));
    document.querySelectorAll("#rows .clip").forEach((n) => n.classList.toggle("k2-looping", !!K.loopClip && n.dataset.clipId === K.loopClip));   // the whole clip goes acid while it loops (Eman, 4 Nov)
  }
  K.spotlight = spotlight;
  // the clip's loop button: it plays on repeat on its own until you pick another clip or click away;
  // FX, the synth and the notes can all be changed while it loops
  async function clipLoop(c) {
    if (K.loopClip === c.id) return endClipLoop();
    if (!isSel(c.id)) selectClip(c.id);
    const r = await booth("laneSolo", { trackId: c.track.id, clipId: c.id, clipLoop: true });
    if (!r || !r.ok) return toast("That clip can't loop on its own.");
    K.loopClip = c.id;   // the loop starts playing by itself (pressing play now would end it)
    spotlight();
    // wherever the marker was, it plays right away (Eman, 4 Nov); an engine that only arms the loop gets a nudge
    setTimeout(() => { if (K.loopClip === c.id && ui.transport && !ui.transport.playing) run("togglePlay"); }, 250);
  }
  function endClipLoop() {
    if (!K.loopClip) return;
    K.loopClip = null;
    booth("laneSolo", { on: false });
    spotlight();
  }
  K.endClipLoop = endClipLoop;
  // picking another clip without a full redraw, or clicking the background, also ends it
  document.addEventListener("mousedown", () => setTimeout(() => { if (K.loopClip || K.spot) spotlight(); }, 0), true);
  function afterRender() {
    const s = ui.state;
    if (!s) return;
    projectLook(s);
    paintCues();
    requestAnimationFrame(paintOverlaps);
    if (!window.KT2_SEAM_GLOW_OLD) requestAnimationFrame(markSeams);
    spotlight();
    if (!songName.querySelector("input")) songName.textContent = (s.session || "Untitled").toUpperCase();   // not while it is being renamed
    const versions = s.versions && s.versions.length ? s.versions : [{ number: 1, current: true }];
    vs.replaceChildren(...versions.map((v, i) => {
      const b = el("button", v.current ? "on" : "", "V" + v.number);
      b.title = v.current ? "You're on " + (v.name || "V" + v.number) : "Switch to " + (v.name || "V" + v.number);
      b.onclick = () => !v.current && run("openVersion", { index: i });
      return b;
    }), (() => { const a = el("button", null, "+"); a.title = "New version: a copy to try ideas on"; a.onclick = () => run("newVersion"); return a; })());
    const on = vs.querySelector(".on"); if (on) vs.scrollLeft = on.offsetLeft - 40;
    // Sections: + ADD (your own parts, any name, no beat needed) and ANALYSE (finds them from the
    // beat) side by side; ANALYSE is just one option (Eman, 31 Oct)
    const box = $("sections");
    let secBtns = document.querySelector("body > .k2-secbtns");
    if (box && !secBtns) {
      const wrap = el("div", "k2-secbtns");
      const add = el("button", "k2-secnew", "+");
      add.title = "Add a part at the marker (or at the start of the yellow loop) and name it";
      add.onclick = (e) => { e.stopPropagation(); addSectionMenu(add); };
      add.onmousedown = (e) => e.stopPropagation();
      const an = el("button", "k2-auto", (s.sections || []).length ? "RE-ANALYSE" : "ANALYSE");
      an.title = "Listen to the beat and place the parts automatically (Cmd+Z undoes it)";
      an.onclick = (e) => { e.stopPropagation(); $("sec-auto").click(); };
      an.onmousedown = (e) => e.stopPropagation();
      wrap.append(add, an);
      document.body.append(wrap);   // pinned to the right end of the sections row, whatever the scroll
      secBtns = wrap;
      window.addEventListener("resize", placeSecBtns);
    }
    placeSecBtns();
    const an2 = secBtns && secBtns.querySelector(".k2-auto");
    if (an2) { an2.textContent = (s.sections || []).length ? "RE-ANALYSE" : "ANALYSE"; an2.hidden = !beatClip(); }
    const hint = box && box.querySelector(".sections-hint");
    if (hint) hint.textContent = "No parts yet. Press + to mark one at the marker" + (beatClip() ? ", or ANALYSE to find them." : ".");
    paintTools();
    renderFooter();
    // PRODUCE shows a voice lane only once something is on it, and only while its PRODUCE switch is on
    // (Eman, 31 Oct: RECORD's lanes exist from the start, but don't crowd the grid until used)
    if (!html.classList.contains("k2-rec")) {
      for (const t of s.tracks) {
        if (t.kind !== "take") continue;
        const row = document.querySelector(`#rows .row[data-track-id="${t.id}"]`);
        if (!row) continue;
        const off = t.onPlayground === false || !t.clips.length;
        row.style.display = off ? "none" : "";
        if (off) row.dataset.k2off = "1"; else delete row.dataset.k2off;   // kt2-compound.js leaves these hidden
      }
    }
    // stacked synths have no row: they play their main lane's patterns (INST shows them, the mixer has their faders)
    for (const t of s.tracks) {
      if (!t.layerOf) continue;
      const row = document.querySelector(`#rows .row[data-track-id="${t.id}"]`);
      if (row) { row.style.display = "none"; row.dataset.k2off = "1"; }
    }
    placeRows();
    ghostRows();
  }

  // Free rows (Eman, 31 Oct: "you can put anything anywhere, no specific channels"): a clip with
  // c.row shows on that row while it keeps its own lane (sound, effects, colour). A lane whose clips
  // all sit on other rows has no row of its own on the PLAYGROUND.
  // a clip moved onto an empty row keeps the colour it shows now
  { const _run = window.run;
    window.run = run = function (cmd, args) {
      if (cmd === "moveClipToNewLane" && args && !args.color) { const c = findClip(args.clipId); if (c) args = { ...args, color: realHex(c.color || colorOf(c.track)) || undefined }; }
      return _run.apply(this, [cmd, args]);
    };
  }
  // inside a compound it is a whole playground too: free rows and empty grid rows (Eman, 5 Nov 21:10)
  K.freeRows = () => !html.classList.contains("k2-rec") && (!html.classList.contains("k2-inside") || !window.KT2_CMP_ONE_LANE);
  const SEEN = new Set();
  function placeRows() {
    if (!K.freeRows()) return;
    const s = ui.state, rowOf = (id) => document.querySelector(`#rows .row[data-track-id="${id}"]`);
    const hosts = new Set();
    for (const t of s.tracks) {
      if (t.kind === "beat") continue;
      let away = 0;
      for (const c of t.clips) {
        const host = c.row && c.row !== t.id ? rowOf(c.row) : null;
        const node = document.querySelector(`#rows .clip[data-clip-id="${c.id}"]`);
        if (!host || !node) continue;
        const lane = host.querySelector(".lane");
        if (!lane) continue;
        if (node.parentNode !== lane) lane.append(node);
        hosts.add(host); away++;
      }
      const own = rowOf(t.id);
      // a row that has shown once stays (Eman, 4 Nov: moving a clip must never move any other clip,
      // and hiding its emptied row shifted every row under it up one)
      if (own && t.clips.length && away === t.clips.length && !own.dataset.k2off && !SEEN.has(t.id)) { own.style.display = "none"; own.dataset.k2away = "1"; }
      else {
        if (own && own.dataset.k2away) { delete own.dataset.k2away; if (!own.dataset.k2off) own.style.display = ""; }
        if (own && t.clips.length) SEEN.add(t.id);
      }
    }
    for (const h of hosts) if (h.style.display === "none" && !h.dataset.k2away) { h.style.display = ""; delete h.dataset.k2off; }
  }

  // One open grid (Eman): no "+ Lane" buttons, the rows just keep going. The empty rows under
  // the last real one take a new pattern (right-click) or a clip dragged onto them: the lane is
  // made when something lands there.
  function ghostRows() {
    const rows = $("rows");
    rows.querySelectorAll(".k2-ghost").forEach((n) => n.remove());
    if (html.classList.contains("k2-rec") || (html.classList.contains("k2-inside") && window.KT2_CMP_ONE_LANE)) return;
    const width = parseFloat(($("timeline-top") || {}).style?.width) || 4000;
    const sc = $("scroll"), rowH = parseFloat(getComputedStyle(html).getPropertyValue("--row-h")) || 62;
    const real = [...rows.querySelectorAll(".row:not(.master)")].reduce((h, r) => h + (r.offsetParent ? r.offsetHeight : 0), 0);
    const n = Math.max(6, Math.ceil((sc.clientHeight - real) / rowH) + 4);
    const anchor = rows.querySelector(".add-row") || rows.querySelector(".rows-gap") || null;
    const ghost = (extra) => {
      const row = el("div", "row k2-ghost" + (extra ? " k2-gap" : ""));
      const lane = el("div", "lane");
      lane.style.width = width + "px";
      if (window.KT2_GHOST_TIP) lane.title = "Right-click: new pattern here. Drag a clip or a sound onto any row.";   // tip parked: it sat over the footer tabs
      // click or drag on an empty row moves the marker, like on a lane: play starts anywhere, even in silence
      lane.addEventListener("mousedown", (e) => { if (e.button === 0 && K.tool === "select" && e.target === lane) { selectClip(null); if (typeof unloopPart === "function") unloopPart(); startMarkerDrag(e, lane); } });
      row.append(el("div", "head"), lane);
      return row;
    };
    // a lane's own empty rows above it (t.gap) stay where they are: the grid is a place, not a list
    for (const t of ui.state.tracks) {
      if (!(t.gap > 0)) continue;
      const own = rows.querySelector(`.row[data-track-id="${t.id}"]`);
      if (!own || !own.offsetParent) continue;
      for (let i = 0; i < t.gap; i++) { const g = ghost(true); g.dataset.gapOf = t.id; g.dataset.gapI = i; rows.insertBefore(g, own); }
    }
    for (let i = 0; i < n; i++) { const g = ghost(false); g.dataset.gapI = i; rows.insertBefore(g, anchor); }
  }
  // where a ghost row is on the grid: { gap, before } for moveClipToNewLane / setLaneGap
  K.ghostSpot = (row) => row && row.classList.contains("k2-ghost") ? { gap: +row.dataset.gapI || 0, before: row.dataset.gapOf || undefined } : {};
  // A clip dropped on an empty row: a new lane of its kind there, and the clip moves onto it.
  window.addEventListener("mouseup", (e) => {
    const dragging = document.querySelector("#rows .clip.dragging");
    if (!dragging || !document.documentElement.classList.contains("k2-rec")) return;   // the PLAYGROUND's own drop (app.js moveClipToNewLane) handles it
    const ghost = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.classList && n.classList.contains("k2-ghost"));
    if (!ghost) return;
    const id = dragging.dataset.clipId;
    setTimeout(async () => {
      const c = findClip(id);
      if (!c || c.track.kind === "beat") return;
      const r = c.kind === "midi" ? null : await run("newTakeLane", { role: "fx" });
      if (c.kind === "midi") return toast("MIDI clips stay with their instrument row for now: drag them along it.");
      if (r && r.trackId) run("moveClip", { clipId: id, start: c.start, trackId: r.trackId }).then(() => run("renameTrack", { trackId: r.trackId, name: c.name.replace(/\s*\(.*\)$/, "") }));
    }, 60);
  }, true);
  const _renderTransport = renderTransport;
  window.renderTransport = renderTransport = function () {
    _renderTransport.apply(this, arguments);
    const sl = !!(ui.transport && ui.transport.soloLane);
    // LOOP in a lane window (Eman, 10 Nov): the song's marker keeps moving, inside the looping pattern's clip
    // (a loop longer than the clip wraps round in it). KT2_LOOP_MARKER_OLD = old (marker hidden while LOOP plays).
    const mv = sl && !window.KT2_LOOP_MARKER_OLD;
    html.classList.toggle("k2-playing", !!(ui.transport && ui.transport.playing) && (!sl || mv));
    html.classList.toggle("k2-lanesolo", sl && !mv);
    if (mv) {
      const s = ui.transport.soloLane, t = ui.state && ui.state.tracks.find((x) => x.id === s.trackId);
      const c = t && (t.clips.find((x) => x.id === s.clipId) || null);
      const pos = ui.transport.position;
      if (c && c.length > 0 && pos >= c.start + c.length - 1e-6) {
        const x = toX(c.start + ((pos - c.start) % c.length));
        $("playhead").style.left = rulerLeft() + x + "px";
        $("ruler-head").style.left = x + "px";
      }
    }
  };

  // Wheel over the loop strip zooms like the ruler under it did.
  document.addEventListener("wheel", (e) => {
    const lb = e.target.closest && e.target.closest(".loopbar");
    if (!lb) return;
    const r = $("ruler");
    if (r) r.dispatchEvent(new WheelEvent("wheel", e));
  }, { passive: true });

  // the thin strip between the bar numbers and the grid moves the marker too (Eman, 31 Oct)
  { const tt = $("timeline-top");
    if (tt) tt.addEventListener("mousedown", (e) => { if (e.button === 0 && e.target === tt) { e.preventDefault(); startMarkerDrag(e, tt); } }); }

  function placeSecBtns() {
    const w = document.querySelector("body > .k2-secbtns"), box = $("sections"), sc = $("scroll");
    if (!w || !box || !sc) return;
    const r = box.getBoundingClientRect(), rs = sc.getBoundingClientRect(), html = document.documentElement;
    const show = r.height > 0 && !(window.ui && ui.home) && !html.classList.contains("k2-mix") && !html.classList.contains("k2-rec");
    w.style.display = show ? "" : "none";
    if (show) { w.style.top = r.top + Math.max(0, (Math.min(r.height, 26) - 22) / 2) + "px"; w.style.left = rs.right - 12 + "px"; }
  }

  // + ADD: pick a name (or type your own); the part starts at the marker, or at the yellow loop's start
  // Double-click an empty spot of the parts bar (Eman, 6 Nov 23:35): a new part starts on the closest bar, hangs
  // on the mouse in whole bars like a new pattern does, and the next click sets its length, then you name it.
  // Esc / right-click = no part. KT2_SEC_DBL_OFF = off.
  document.addEventListener("dblclick", (e) => {
    if (window.KT2_SEC_DBL_OFF) return;
    const box = $("sections");
    if (!box || !box.contains(e.target) || e.target.closest(".section")) return;
    e.preventDefault(); e.stopPropagation();
    const bar = secPerBar(), left = () => box.getBoundingClientRect().left;
    const at = Math.max(0, Math.round(toSec(e.clientX - left()) / bar) * bar);
    const list = ui.state.sections || [];
    if (list.some((x) => Math.abs(x.start - at) < 1e-3)) return toast("There's already a part starting here.");
    const g = el("div", "k2-dragout k2-secout"), tag = el("div", "k2-dragout-tag");
    g.style.setProperty("--c", "#8b6cff"); g.style.setProperty("--bar", bar * ui.pxPerSec + "px"); g.style.setProperty("--beat", secPerBeat() * ui.pxPerSec + "px");
    g.append(tag); document.body.append(g);
    let end = at + bar, done = false;
    const place = (mx) => {
      const r = box.getBoundingClientRect();
      const bars = Math.max(1, Math.round((toSec(mx - r.left) - at) / bar));
      end = at + bars * bar;
      Object.assign(g.style, { left: r.left + toX(at) + "px", top: r.top + "px", height: Math.max(12, r.height) + "px", width: toX(end - at) + "px" });
      tag.textContent = bars + (bars === 1 ? " BAR" : " BARS");
    };
    place(e.clientX);
    const move = (ev) => place(ev.clientX);
    const stop = (make) => {
      if (done) return; done = true;
      removeEventListener("mousemove", move, true); removeEventListener("mousedown", down, true); removeEventListener("keydown", key, true); removeEventListener("contextmenu", ctx, true);
      g.classList.add(make ? "set" : "gone"); setTimeout(() => g.remove(), 160);
      if (!make) return;
      const n = (ui.state.sections || []).length + 1, name = "PART " + n;
      editSections((l) => l.push({ name, start: at, len: end - at })).then(() => {
        const i = (ui.state.sections || []).findIndex((x) => Math.abs(x.start - at) < 1e-3);
        const b = document.querySelector(`#sections .section[data-index="${i}"] .lbl`);
        if (b) inlineEdit(b, name, (v) => editSections((l) => (l[i].name = v)));
      });
    };
    const down = (ev) => { ev.preventDefault(); ev.stopPropagation(); if (ev.button === 0) { place(ev.clientX); stop(true); } else stop(false); };
    const key = (ev) => { if (ev.key === "Escape" || (!window.KT2_DRAGOUT_DEL_OFF && (ev.key === "Delete" || ev.key === "Backspace"))) { ev.preventDefault(); ev.stopPropagation(); stop(false); } };
    const ctx = (ev) => { ev.preventDefault(); stop(false); };
    setTimeout(() => { addEventListener("mousemove", move, true); addEventListener("mousedown", down, true); addEventListener("keydown", key, true); addEventListener("contextmenu", ctx, true); }, 0);
  }, true);

  function addSectionMenu(anchor) {
    const st = ui.state, tr = ui.transport, list = st.sections || [];
    const at = tr.looping && st.loopEnd > st.loopStart ? st.loopStart : snapBeat(tr.position);
    if (list.some((x) => Math.abs(x.start - at) < 1e-3)) return toast("There's already a part starting here. Move the marker first.");
    const verses = list.filter((x) => /^VERSE/.test(x.name)).length;
    const put = (name, edit) => editSections((l) => l.push({ name, start: at })).then(() => {
      if (!edit) return;
      const i = (ui.state.sections || []).findIndex((x) => Math.abs(x.start - at) < 1e-3);
      const b = document.querySelector(`#sections .section[data-index="${i}"] .lbl`);
      if (b) inlineEdit(b, name, (v) => editSections((l) => (l[i].name = v)));
    });
    showMenu(anchor, [
      { heading: `New part at bar ${fmtBars(at)}` },
      { label: "Your own name\u2026", meta: "type it", run: () => put("PART", true) },
      { sep: true },
      ...["INTRO", "VERSE", "PRE", "HOOK", "DROP", "BUILD", "BREAK", "BRIDGE", "OUTRO"].map((n) => {
        const nm = n === "VERSE" ? `VERSE ${verses + 1}` : n;
        return { label: nm, run: () => put(nm, false) };
      }),
    ]);
  }

  // ------------------------------------------------------------------ plugin window size
  // Plugin windows open a bit smaller; drag the bottom-right corner to make the whole plugin bigger or
  // smaller (it scales as one piece, like a real plugin). The size is kept per session and used for
  // every plugin you open in it (Eman, 31 Oct).
  const IW_DEFAULT = 0.8;
  const iwKey = () => "killtoy.pluginScale:" + ((ui.state && ui.state.session) || "untitled");
  const iwGet = () => { try { const v = parseFloat(localStorage.getItem(iwKey())); return v > 0.4 && v < 1.6 ? v : IW_DEFAULT; } catch (e) { return IW_DEFAULT; } };
  const iwSet = (v) => { try { localStorage.setItem(iwKey(), String(v)); } catch (e) {} };
  // never bigger than the screen (UX stress test, 8 Nov): at the biggest size the window ran past the screen edge,
  // taking Done, play, undo and this corner with it, so it couldn't be made smaller again, and the size is kept for
  // every window in the project. KT2_IW_FIT_OLD = old (no limit).
  const iwFit = (c, v) => {
    if (window.KT2_IW_FIT_OLD || !c.offsetWidth) return v;
    const cur = parseFloat(c.style.zoom) || 1, r = c.getBoundingClientRect();
    const bw = r.width / cur, bh = r.height / cur;
    if (!(bw > 0 && bh > 0)) return v;
    return Math.max(0.5, Math.min(v, (innerWidth - 24) / bw, (innerHeight - 24) / bh));
  };
  const iwApply = (v) => { const c = $("iw-card"); if (c) c.style.zoom = String(iwFit(c, v)); };
  addEventListener("resize", () => { const c = $("iw-card"); if (c && c.offsetWidth) iwApply(iwGet()); });
  if ($("iw")) new MutationObserver(() => { if (!$("iw").hidden) [0, 250, 700, 2000].forEach((ms) => setTimeout(() => iwApply(iwGet()), ms)); }).observe($("iw"), { attributes: true, attributeFilter: ["hidden", "class"] });
  // the window's content arrives after it opens (the synth loads): shrink it again if it grew past the screen
  if ($("iw-card") && window.ResizeObserver) new ResizeObserver(() => {
    const c = $("iw-card"); if (!c.offsetWidth) return;
    const z = parseFloat(c.style.zoom) || 1, f = iwFit(c, z);
    if (f < z - 0.005) c.style.zoom = String(f);
  }).observe($("iw-card"));
  { const card = $("iw-card");
    if (card) {
      iwApply(iwGet());
      const grip = el("div", "k2-iwgrip"); grip.title = "Drag to make the plugin bigger or smaller (kept for this session)";
      card.append(grip);
      grip.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        const r = card.getBoundingClientRect(), s0 = parseFloat(card.style.zoom) || IW_DEFAULT;
        const d0 = Math.hypot(r.width, r.height), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let v = s0;
        const move = (ev) => {   // the window stays centred, so the corner moves twice as far as the size grows on one side
          const d = Math.hypot(2 * (ev.clientX - cx), 2 * (ev.clientY - cy));
          v = Math.max(0.5, Math.min(1.4, s0 * d / d0));
          iwApply(v);
          v = parseFloat(card.style.zoom) || v;   // what fitted is what's kept
        };
        const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); iwSet(v); };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      });
      grip.addEventListener("dblclick", (e) => { e.stopPropagation(); iwApply(IW_DEFAULT); iwSet(IW_DEFAULT); });
    }
  }
  let iwSession = null;
  setInterval(() => { const k = iwKey(); if (k !== iwSession) { iwSession = k; iwApply(iwGet()); } }, 1000);

  // ------------------------------------------------------------------ box select
  // Click on an empty spot of the grid still moves the marker; press and DRAG draws a box and every
  // clip it touches gets selected (Eman, 31 Oct). Shift keeps what was already selected.
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.detail === 2 || K.tool !== "select" || e.altKey) return;
    const lane = e.target;
    if (!lane.classList || !lane.classList.contains("lane") || !lane.closest("#rows")) return;
    const x0 = e.clientX, y0 = e.clientY, keep = e.shiftKey ? new Set(selectedIds()) : new Set();
    // Cmd (Ctrl) held: only the box, the marker stays where it is, even while playing (Eman, 31 Oct)
    const only = e.metaKey || e.ctrlKey;
    if (only) { e.preventDefault(); e.stopImmediatePropagation(); }
    let box = null, synth = false, hits = [];
    const move = (ev) => {
      if (!box) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        if (!only) { synth = true; window.dispatchEvent(new MouseEvent("mouseup", { clientX: x0, clientY: y0 })); synth = false; } // ends the marker drag where it started
        box = document.createElement("div"); box.className = "k2-box"; document.body.append(box);
      }
      const l = Math.min(x0, ev.clientX), t = Math.min(y0, ev.clientY), r = Math.max(x0, ev.clientX), b = Math.max(y0, ev.clientY);
      Object.assign(box.style, { left: l + "px", top: t + "px", width: r - l + "px", height: b - t + "px" });
      hits = [];
      document.querySelectorAll("#rows .clip").forEach((n) => {
        const q = n.getBoundingClientRect(), on = q.width > 0 && q.right > l && q.left < r && q.bottom > t && q.top < b && n.offsetParent !== null;
        if (on) hits.push(n.dataset.clipId);
        n.classList.toggle("selected", on || keep.has(n.dataset.clipId));
      });
    };
    const up = () => {
      if (synth) return;
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      if (!box) return;
      const gone = box; gone.classList.add("out"); setTimeout(() => gone.remove(), 260);   // short fade away on release
      const ids = [...new Set([...keep, ...hits])].filter(Boolean);
      ui.selectedTrack = null;
      ui.selectedClip = ids[0] || null; ui.extraClips = new Set(ids.slice(1));
      ui.laneSig = ""; render();
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }, true);

  // ------------------------------------------------------------------ tools on clips
  // Delete / Mute tools act on a click; Draw adds a MIDI clip on an empty spot; Paint drags copies.
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const clipNode = e.target.closest && e.target.closest(".clip");
    const lane = e.target.closest && e.target.closest(".lane");
    if (K.tool === "del" && clipNode) {
      e.stopPropagation(); e.preventDefault();
      const c = findClip(clipNode.dataset.clipId);
      if (c && c.track.kind !== "beat") run("deleteClip", { clipIds: window.KT2Compound ? KT2Compound.idsFor(c.id) : [c.id] });
      return;
    }
    if (K.tool === "mute" && clipNode) {
      e.stopPropagation(); e.preventDefault();
      const c = findClip(clipNode.dataset.clipId);
      if (c) run("setClipActive", { clipIds: window.KT2Compound ? KT2Compound.idsFor(c.id) : [c.id], active: c.active === false });
      return;
    }
    if (K.tool === "draw" && lane && !clipNode) {
      e.stopPropagation(); e.preventDefault();
      const row = lane.closest(".row"), t = ui.state.tracks.find((x) => x.id === row.dataset.trackId);
      const at = Math.floor(toSec(e.clientX - lane.getBoundingClientRect().left) / secPerBar() + 1e-6) * secPerBar();
      const inside = window.KT2Compound && KT2Compound.openInst;   // drawn inside an open compound: it joins it (every copy)
      if (t && t.kind === "inst") run("newMidiClip", { trackId: t.id, start: at, bars: 1 }).then(async (r) => {
        if (!r || !r.ok) return;
        if (inside) await run("joinCompound", { clipIds: [r.clipId], inst: inside });
        ui.selectedClip = r.clipId; render();
      });
      else toast("Draw makes MIDI clips: use it on a MIDI row.");
      return;
    }
    if (K.tool === "paint" && lane && !clipNode) {
      e.stopPropagation(); e.preventDefault();
      paintDrag(e, lane);
    }
  }, true);

  // Paint: drag along a row to lay copies of the selected clip, one after another.
  function paintDrag(e, lane) {
    const src = ui.selectedClip && findClip(ui.selectedClip);
    if (!src || src.track.kind === "beat") return toast(window.KT2_B_PAINT_OLD ? "Pick a clip first, then paint copies of it with B." : "Pick a clip first, then paint copies of it.");
    const row = lane.closest(".row"), rect = lane.getBoundingClientRect(), len = src.length;
    const done = new Set();
    const at = (x) => Math.max(0, Math.floor(toSec(x - rect.left) / len) * len);
    const place = (ev) => {
      const s = at(ev.clientX);
      if (done.has(s.toFixed(3))) return;
      done.add(s.toFixed(3));
      run("duplicateClips", { clipIds: [src.id] }).then((r) => r && r.clipIds && run("moveClips", { moves: [{ clipId: r.clipIds[0], start: s, trackId: row.dataset.trackId }], drag: true }));
    };
    place(e);
    const move = (ev) => place(ev);
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  // ------------------------------------------------------------------ background per project
  // A picture (or colour) picked in Preferences > Look belongs to the project you're in (Eman, 31 Oct):
  // each project remembers its own, a project without one is plain dark. Kept in this browser.
  const LOOKS = "kt2.lookByProject";
  const looks = () => { try { return JSON.parse(localStorage.getItem(LOOKS) || "{}"); } catch (e) { return {}; } };
  function projectLook(s) {
    const key = s.session || "Untitled";
    if (K.lookKey === key) return;
    K.lookKey = key;
    ui.lookLocal = looks()[key] || { mode: "dark", hue: 0 };
    applyLook(ui.lookLocal);
    if (typeof renderBackgrounds === "function") try { renderBackgrounds(); } catch (e) { /* the picker isn't built yet */ }
  }
  if (typeof saveLook === "function") {
    const _saveLook = saveLook;
    window.saveLook = saveLook = function (look) {
      _saveLook.apply(this, arguments);
      if (!K.lookKey) return;
      const all = looks(); all[K.lookKey] = look;
      try { localStorage.setItem(LOOKS, JSON.stringify(all)); } catch (e) { /* private window */ }
    };
  }

  // ------------------------------------------------------------------ cue points
  window.addEventListener("keyup", (e) => { if (e.key === "q" || e.key === "Q") K.qDown = false; });
  window.addEventListener("blur", () => { K.qDown = false; });
  function cueJump(t) {
    run("cueJump", { time: t }).then(() => { if (!(ui.transport && ui.transport.playing)) { ui.transport.position = t; render(); } });
  }
  function paintCues() {
    const r = $("ruler");
    if (!r) return;
    r.querySelectorAll(".k2-cue").forEach((x) => x.remove());
    const cues = (ui.state && ui.state.cues) || {};
    for (const n of Object.keys(cues).sort()) {
      const d = el("button", "k2-cue", n);
      d.style.left = toX(cues[n]) + "px";
      d.title = `Cue ${n}: click or press ${n} to jump here. Right-click: remove. Hold Q + ${n} to move it to the marker.`;
      d.addEventListener("mousedown", (e) => e.stopPropagation());
      d.onclick = (e) => { e.stopPropagation(); cueJump(cues[n]); };
      d.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); run("setCue", { n, time: null }).then(() => toast(`Cue ${n} removed.`)); };
      r.append(d);
    }
  }

  // Clips on top of clips (Eman, 31 Oct): the clip on top stays solid with its notes clear, and where
  // another clip lies under it a soft hatch in that clip's colour shows how far it reaches, with a
  // bright strip along the bottom edge and a line where the hidden clip starts or ends.
  // Touching clips (Eman 15 Nov): where two clips sit edge to edge on a row, neither draws its edge line or glow on
  // that side, so the two glows don't overlap into a thick strip. Picked: the acid frame goes round the outside of
  // touching picked clips only (a picked clip next to an unpicked one keeps its line there). k2-sl / k2-sr = a
  // touching neighbour on the left / right, drawn by a .k2-sframe child. KT2_SEAM_GLOW_OLD = every clip its own edges.
  if (!window.KT2_SEAM_GLOW_OLD) {
    const st = document.createElement("style"); st.id = "k2-seam-css";
    st.textContent = `
html.kt2 #rows .clip.k2-seam:not(.dragging) { outline: none; }
html.kt2 #rows .clip.k2-seam:not(.dragging):is(.selected, .sel) { box-shadow: none; }
html.kt2 #rows .clip.k2-seam > .k2-sframe { position: absolute; inset: 0; z-index: 28; pointer-events: none; box-sizing: border-box; border: 0 solid transparent; display: none; }
html.kt2 #rows .clip.k2-seam:not(.dragging):is(.selected, .sel) > .k2-sframe { display: block; border-width: 2px; border-color: #e4ff3a; }
html.kt2 #rows .clip.k2-seam.k2-sl > .k2-sframe { border-left-width: 0 !important; }
html.kt2 #rows .clip.k2-seam.k2-sr > .k2-sframe { border-right-width: 0 !important; }
html.kt2.k2-cg body.look-image #rows .clip.k2-full.k2-seam:not(.dragging) { box-shadow: 0 0 var(--cg-glow) color-mix(in srgb, var(--c) var(--cg-edge2), transparent); }
html.kt2.k2-cg body.look-image #rows .clip.k2-full.k2-seam:not(.dragging) > .k2-sframe { display: block; border-width: 1px; border-color: color-mix(in srgb, var(--c) var(--cg-edge), transparent); }
html.kt2.k2-cg body.look-image #rows .clip.k2-full.k2-seam:not(.dragging):is(.selected, .sel) > .k2-sframe { border-width: 2px; border-color: #e4ff3a; }
html.kt2.k2-cg body.look-image #rows .clip.k2-full.k2-seam.k2-sl > .k2-sframe { border-left-width: 0 !important; }
html.kt2.k2-cg body.look-image #rows .clip.k2-full.k2-seam.k2-sr > .k2-sframe { border-right-width: 0 !important; }
html.kt2 #rows .clip.k2-seam.k2-sl:not(.dragging) { clip-path: inset(-40px -40px -40px 0); }
html.kt2 #rows .clip.k2-seam.k2-sr:not(.dragging) { clip-path: inset(-40px 0 -40px -40px); }
html.kt2 #rows .clip.k2-seam.k2-sl.k2-sr:not(.dragging) { clip-path: inset(-40px 0 -40px 0); }`
    // 24 Nov (Eman clips 01.11 + 01.14, "the automation clip is cut"): that 40 px bottom margin also cut the automation
    // sheet hanging under a pattern that touches another one, so only its top 40 px showed (picked patterns have no seam,
    // so picking it "fixed" it). A pattern with its sheet open keeps the whole sheet. KT2_SEAM_ALCUT_OLD = cut at 40 px
    + (window.KT2_SEAM_ALCUT_OLD ? "" : `
html.kt2 #rows .clip.k2-seam.k2-alopen.k2-sl:not(.dragging) { clip-path: inset(-40px -40px -4000px 0); }
html.kt2 #rows .clip.k2-seam.k2-alopen.k2-sr:not(.dragging) { clip-path: inset(-40px 0 -4000px -40px); }
html.kt2 #rows .clip.k2-seam.k2-alopen.k2-sl.k2-sr:not(.dragging) { clip-path: inset(-40px 0 -4000px 0); }`);
    (document.head || document.documentElement).append(st);
  }
  function markSeams() {
    const pick = (n) => n.classList.contains("selected") || n.classList.contains("sel");
    document.querySelectorAll("#rows .lane").forEach((lane) => {
      const nodes = [...lane.querySelectorAll(":scope > .clip")].filter((n) => n.offsetParent !== null && !n.classList.contains("dragging") && !n.classList.contains("copy-ghost"));
      const box = nodes.map((n) => ({ n, l: n.offsetLeft, r: n.offsetLeft + n.offsetWidth, t: n.offsetTop, p: pick(n) }));
      for (const x of box) {
        let l = false, r = false;
        for (const o of box) {
          if (o === x || o.t !== x.t || o.p !== x.p) continue;
          if (Math.abs(o.r - x.l) <= 1.5) l = true;
          if (Math.abs(o.l - x.r) <= 1.5) r = true;
        }
        const on = (l || r) && !x.n.classList.contains("k2-ingrp");
        x.n.classList.toggle("k2-seam", on); x.n.classList.toggle("k2-sl", on && l); x.n.classList.toggle("k2-sr", on && r);
        let fr = x.n.querySelector(":scope > .k2-sframe");
        if (on && !fr) { fr = document.createElement("i"); fr.className = "k2-sframe"; x.n.append(fr); } else if (!on && fr) fr.remove();
      }
    });
  }
  function paintOverlaps() {
    document.querySelectorAll("#rows .k2-under").forEach((x) => x.remove());
    document.querySelectorAll("#rows .lane").forEach((lane) => {
      const nodes = [...lane.querySelectorAll(":scope > .clip")].filter((n) => n.offsetParent !== null);
      if (nodes.length < 2) return;
      const box = nodes.map((n) => ({ n, l: n.offsetLeft, r: n.offsetLeft + n.offsetWidth, z: +(getComputedStyle(n).zIndex) || 0 }));
      box.forEach((top, i) => {
        for (const [j, under] of box.entries()) {
          if (under === top) continue;
          const above = top.z > under.z || (top.z === under.z && i > j);
          if (!above) continue;
          const a = Math.max(top.l, under.l), b = Math.min(top.r, under.r);
          if (b - a < 2) continue;
          const c = findClip(under.n.dataset.clipId), col = (c && (c.color || (typeof colorOf === "function" && colorOf(c.track)))) || "#a78bfa";
          const o = el("div", "k2-under");
          o.style.left = a - top.l + "px"; o.style.width = b - a + "px"; o.style.setProperty("--uc", col);
          if (under.l > top.l + 1) o.classList.add("k2-ul");    // the hidden clip starts here
          if (under.r < top.r - 1) o.classList.add("k2-ur");    // and ends here
          o.title = (c ? c.name : "A clip") + " is under this one here";
          // a handle in the middle grabs the clip underneath, so it can still be moved (Eman, 4 Nov)
          if (b - a >= 26 && !window.KT2_NO_UNDER_GRAB) {
            const h = el("button", "k2-grab"); h.title = "Move " + (c ? c.name : "the clip") + " (it's under this one)";
            h.addEventListener("mousedown", (e) => {
              if (e.button !== 0) return;
              e.preventDefault(); e.stopPropagation();
              under.n.dispatchEvent(new MouseEvent("mousedown", { bubbles: false, cancelable: true, clientX: e.clientX, clientY: e.clientY, button: 0, detail: 1, shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey }));
            });
            h.addEventListener("click", (e) => e.stopPropagation());
            o.append(h);
          }
          top.n.append(o);
        }
      });
    });
  }

  // ------------------------------------------------------------------ keys
  // Cmd+D duplicates the picked clips whenever the last click was on the song (Eman, 11 Nov 02:24: the DUPLICATE
  // button worked but Cmd+D didn't). The app's own Cmd+D was skipped while a lane window or piano roll was open,
  // and those windows' own Cmd+D (let go of notes) took it. Here it runs first, by the physical D key too
  // (any keyboard layout). window.KT2_CMD_D_KEY_OLD = true: the old handling only.
  let downOnSong = false;
  window.addEventListener("mousedown", (e) => { downOnSong = !!(e.target.closest && e.target.closest("#rows, .clip")); }, true);
  window.addEventListener("keydown", (e) => {
    if (window.KT2_CMD_D_KEY_OLD || window.KT2_CMD_D_DESELECT || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    if (!(e.code === "KeyD" || (e.key || "").toLowerCase() === "d")) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || ui.home || ui.tune) return;
    if (!downOnSong || !selectedIds().some((id) => { const c = findClip(id); return c && c.track.kind !== "beat"; })) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat) duplicateSelected();
  }, true);
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
    if (ui.roll || ui.tune || ui.home || (typeof iw !== "undefined" && iw)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); e.stopImmediatePropagation(); copyAfter(); return; }
    if (mod || e.altKey) return;
    // Cue points (Eman, 31 Oct): hold Q and press 1-9 = a cue at the marker; 1-9 alone jumps there
    // (in time: while playing it lands on the next beat). The old 1-9 = saved effect chains is parked.
    if (e.key === "q" || e.key === "Q") { e.preventDefault(); e.stopImmediatePropagation(); K.qDown = true; return; }
    if (/^[1-9]$/.test(e.key) && !window.SHOW_CHAIN_KEYS) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      const cues = (ui.state && ui.state.cues) || {};
      if (K.qDown) {
        const spb = 60 / ((ui.state && ui.state.bpm) || 120), at = Math.max(0, Math.round((ui.transport ? ui.transport.position : 0) / spb) * spb);
        run("setCue", { n: e.key, time: at }).then(() => toast(`Cue ${e.key} set at bar ${fmtBars(at)}. Press ${e.key} to jump there.`));
      } else if (cues[e.key] != null) cueJump(cues[e.key]);
      else toast(`No cue ${e.key} yet. Hold Q and press ${e.key} to put one at the marker.`);
      return;
    }
    // Shift + arrows (Eman, 7 Nov 17:07): the picked clips step one row up/down or one beat back/forward, one undo step each
    if (e.shiftKey && /^Arrow(Up|Down|Left|Right)$/.test(e.key) && !window.KT2_SHIFT_ARROWS_OFF && K.nudge(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    // B no longer arms PAINT (Eman's V7k take 4, 11 Nov 02:56): a B pressed just after letting go of Cmd (Cmd+B =
    // Duplicate after) switched PAINT on unseen, and then every click on empty space dropped a copy of the picked
    // clip. PAINT is still there on its toolbar button. window.KT2_B_PAINT_OLD = true: B arms PAINT again.
    const map = { v: "select", p: "draw", ...(window.KT2_B_PAINT_OLD ? { b: "paint" } : {}), c: "slice", d: "del", t: "mute", g: "compound", s: "snap" };
    const id = map[e.key.toLowerCase()];
    if (id) { e.preventDefault(); e.stopImmediatePropagation(); pickTool(id === "slice" && K.tool === "slice" ? "select" : id); return; }
    // zoom (mock v81): + and - zoom around the middle, 0 fits the whole song
    if (!html.classList.contains("k2-mix") && (e.key === "+" || e.key === "=")) { e.preventDefault(); zoomAt(1.25); return; }
    if (!html.classList.contains("k2-mix") && (e.key === "-" || e.key === "_")) { e.preventDefault(); zoomAt(1 / 1.25); return; }
    if (!html.classList.contains("k2-mix") && e.key === "0") { e.preventDefault(); fitSong(); return; }
    if (e.key === "Escape" && K.tool !== "select") pickTool("select");
  }, true);

  // Nudge the picked clips with Shift + arrows. Left/Right: one beat (never before 0:00). Up/Down: one
  // row, the same way a drag moves them (each keeps its own sound; the beat's row is never a target).
  // A single clip pushed down past the last row gets a new row there, like dropping it on an empty one.
  K.nudge = (key) => {
    const ids = selectedIds().filter((id) => { const c = findClip(id); return c && c.track.kind !== "beat"; });
    if (!ids.length) return false;
    const clips = ids.map(findClip);
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const d = (key === "ArrowRight" ? 1 : -1) * secPerBeat();
      const shift = Math.max(d, -Math.min(...clips.map((c) => c.start)));   // the earliest stops at 0:00, the rest keep their spacing
      if (Math.abs(shift) < 1e-9) return true;
      if (K.freeRows()) run("setClipRow", { moves: clips.map((c) => ({ clipId: c.id, start: c.start + shift, row: c.row || c.track.id })) });
      else run("moveClips", { moves: clips.map((c) => ({ clipId: c.id, start: c.start + shift, trackId: c.track.id })) });
      return true;
    }
    if (!K.freeRows()) return true;
    const dr = key === "ArrowDown" ? 1 : -1;
    const rows = [...document.querySelectorAll("#rows > .row")].filter((r) => r.offsetParent && !r.classList.contains("master"));
    const real = rows.filter((r) => !r.classList.contains("k2-ghost"));
    const target = (c) => {
      const n = document.querySelector(`#rows .clip[data-clip-id="${c.id}"]`), hr = n && n.closest(".row");
      return hr ? real[real.indexOf(hr) + dr] : null;
    };
    const ok = (r) => r && r.dataset.kind !== "beat" && r.dataset.trackId;
    const to = clips.map(target);
    if (to.every(ok)) { run("setClipRow", { moves: clips.map((c, i) => ({ clipId: c.id, start: c.start, row: to[i].dataset.trackId })) }); return true; }
    // one clip on the last row going down: onto the first empty row under it
    if (clips.length === 1 && dr > 0 && !to[0]) {
      const n = document.querySelector(`#rows .clip[data-clip-id="${clips[0].id}"]`), hr = n && n.closest(".row");
      const g = hr && rows.slice(rows.indexOf(hr) + 1).find((r) => r.classList.contains("k2-ghost"));
      if (g) { run("moveClipToNewLane", { clipId: clips[0].id, start: clips[0].start, ...K.ghostSpot(g) }); return true; }
    }
    if (window.KT2Juice) try { KT2Juice.step("row", 0); } catch (err) { /* fine */ }
    return true;   // at the edge: nothing moves
  };

  // Double-click the loop bar (mock v79): a smart loop. One clip under the spot loops that
  // clip; several clips loop the span most of them share; no clip loops the song part there.
  document.addEventListener("dblclick", (e) => {
    // the empty strip under the loop bar counts as the loop bar too (Eman, 4 Nov)
    const bar = (e.target.closest && e.target.closest(".loopbar")) || (e.target.id === "timeline-top" && document.querySelector(".loopbar"));
    if (!bar || !ui.state) return;
    e.preventDefault(); e.stopPropagation();
    const at = toSec(e.clientX - bar.getBoundingClientRect().left);
    // double-click inside the loop that's on: the loop goes off (Eman, 31 Oct)
    if (ui.transport && ui.transport.looping && at >= ui.state.loopStart - 1e-3 && at <= ui.state.loopEnd + 1e-3) {
      ui.transport.looping = false; run("setLooping", { on: false }).then(() => render()); toast("Loop off."); return;
    }
    const under = ui.state.tracks.filter((t) => t.kind !== "beat").flatMap((t) => t.clips).filter((c) => c.active !== false && c.start <= at && c.start + c.length > at);
    let a, b, what;
    if (under.length) {
      const count = new Map();
      for (const c of under) { const k = c.start.toFixed(2) + "|" + (c.start + c.length).toFixed(2); count.set(k, (count.get(k) || 0) + 1); }
      const best = [...count.entries()].sort((x, y) => y[1] - x[1] || parseFloat(x[0].split("|")[1]) - parseFloat(x[0].split("|")[0]) - (parseFloat(y[0].split("|")[1]) - parseFloat(y[0].split("|")[0])))[0][0].split("|").map(Number);
      [a, b] = best;
      what = under.length === 1 ? under[0].name : `the part ${count.get(best.map((v) => v.toFixed(2)).join("|"))} of ${under.length} clips share`;
    } else {
      const sec = (ui.state.sections || []).find((x) => at >= x.start && at < x.end);
      if (sec) { a = sec.start; b = sec.end; what = sec.name; }
      else { const bar4 = secPerBar() * 4; a = Math.floor(at / bar4) * bar4; b = a + bar4; what = "these 4 bars"; }
    }
    run("setLoopRange", { start: a, end: b }).then((r) => r && r.ok !== false && toast(`Looping ${what}.`));
  }, true);

  // ------------------------------------------------------------------ footer: tabs
  const rack = $("rack");
  const side = el("div", "k2-side");
  const nameBar = el("div", "k2-name none");
  const tabsBox = el("div", "k2-tabs");
  const chips = el("div", "k2-chips");
  side.append(nameBar, chips, tabsBox);
  const fxPane = el("div", "k2-pane");
  fxPane.dataset.pane = "fx";
  fxPane.append(document.querySelector(".rack-side"), document.querySelector(".rack-main"));
  const otherPane = el("div", "k2-pane");
  otherPane.dataset.pane = "other";
  otherPane.hidden = true;
  rack.replaceChildren(side, fxPane, otherPane);
  // the footer's real height, so the song can run under it when a background picture is on
  new ResizeObserver(() => html.style.setProperty("--k2-foot-real", rack.getBoundingClientRect().height + "px")).observe(rack);
  const grip = el("div", "k2-grip");
  if (window.KT2_FOOT_SAVE_OFF) grip.title = "Drag to resize, drag down to fold. Double-click: back to normal.";
  rack.append(grip);
  grip.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const y0 = e.clientY, h0 = rack.getBoundingClientRect().height;
    html.classList.remove("k2-folded");
    const move = (ev) => {
      // any height from a thin strip up (Eman, 31 Oct): the footer rearranges itself to fit (footSize)
      const h = Math.max(58, Math.min(window.innerHeight * 0.75, h0 + (y0 - ev.clientY)));
      html.style.setProperty("--k2-foot", h + "px");
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      if (FOOT_SAVE) { try { localStorage.setItem(footKey(), Math.round(rack.getBoundingClientRect().height)); } catch (e) {} K.footFor = footKey(); }
      window.dispatchEvent(new Event("resize")); showPane();
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  });
  // The footer stays where it's dragged, saved per project; a project with no saved size opens at the default
  // (Eman, 15 Nov 00:24). No double-click reset any more: with no visible grip it fired by accident and looked
  // like the footer bouncing back. KT2_FOOT_SAVE_OFF = not saved + double-click resets, like before.
  const FOOT_SAVE = !window.KT2_FOOT_SAVE_OFF;
  const footKey = () => "kt2.footH:" + ((ui.state && ui.state.session) || "untitled");
  K.applyFoot = () => {
    if (!FOOT_SAVE || !ui.state) return;
    const k = footKey();
    if (K.footFor === k) return;
    if (document.querySelector(".k2-naming")) return;   // mid-rename: the name changes, the project doesn't
    K.footFor = k;
    let h = 0; try { h = +localStorage.getItem(k) || 0; } catch (e) {}
    if (h >= 58) html.style.setProperty("--k2-foot", Math.min(h, window.innerHeight * 0.75) + "px");
    else html.style.removeProperty("--k2-foot");
    window.dispatchEvent(new Event("resize"));
  };
  // The tab menu's width: thinner by default, drag its right edge to share room with the FX (Eman, 31 Oct)
  try { const w = +localStorage.getItem("kt2.sideW"); if (w) html.style.setProperty("--k2-side", w + "px"); } catch (e) {}
  const sideGrip = el("div", "k2-sidegrip");
  sideGrip.title = "Drag to make the menu wider or thinner. Double-click: back to normal.";
  side.append(sideGrip);
  sideGrip.addEventListener("mousedown", (e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = side.getBoundingClientRect().width;
    html.classList.add("k2-siding");
    const move = (ev) => html.style.setProperty("--k2-side", Math.round(Math.max(130, Math.min(460, w0 + ev.clientX - x0))) + "px");
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      html.classList.remove("k2-siding");
      try { localStorage.setItem("kt2.sideW", Math.round(side.getBoundingClientRect().width)); } catch (e) {}
      window.dispatchEvent(new Event("resize"));
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  });
  sideGrip.addEventListener("dblclick", () => { html.style.removeProperty("--k2-side"); try { localStorage.removeItem("kt2.sideW"); } catch (e) {} window.dispatchEvent(new Event("resize")); });

  // Smart sizes: compact = the tabs become a row of icons and the cards shrink; tiny = just one strip
  const footSize = () => {
    const h = rack.getBoundingClientRect().height;
    // the text tabs shrink first (k2-fsmall), and only turn into a row of tall icon buttons when they really can't fit
    html.classList.toggle("k2-fsmall", h < 190);
    html.classList.toggle("k2-fcompact", h < 120);
    html.classList.toggle("k2-ftiny", h < 100);
  };
  new ResizeObserver(footSize).observe(rack);
  grip.addEventListener("dblclick", () => { if (FOOT_SAVE) return; html.style.removeProperty("--k2-foot"); html.classList.remove("k2-folded"); window.dispatchEvent(new Event("resize")); showPane(); });

  const BASE_TABS = [
    { id: "fx", label: "FX", icon: "fx", info: () => "" },
    { id: "inst", label: "INST", icon: "inst", info: (c) => (c && c.kind === "midi" ? (c.track.instrument || "TOY MACHINE") : "MIDI only") },
    { id: "midi", label: "MIDI", icon: "midi", info: (c) => (c && c.kind === "midi" ? `${(c.notes || []).length} notes` : "piano roll") },
    { id: "warp", label: "WARP", icon: "warp", info: () => Math.round(bpm()) + " BPM" },
    // the 8 sound kits (Eman, 7 Nov 01:30; ui/kt2-samples.js): ALL shows every kit
    { id: "samples", label: "SAMPLES", icon: "samples", info: () => "8 KITS" },
    // the unlocked cards and the levels above them (Eman, 5 Nov; ui/kt2-cards.js). Since 7 Nov 01:30 CARDS is an
    // icon in the top bar (where the cloud was) and opens the same pane; KT2_CARDS_TAB_OLD = true puts the tab back.
    { id: "cards", label: "CARDS", icon: "cards", info: () => { try { return Math.floor(parseFloat(localStorage.getItem("kt2.score")) || 0) + " PTS"; } catch (e) { return ""; } } },
  ].filter((t) => (t.id !== "cards" || (window.KT2_CARDS_TAB_OLD && !window.KT2_NO_CARDS_TAB && window.KT2Tabs)) && (t.id !== "samples" || !window.KT2_NO_SAMPLES_TAB));
  const ADDABLE = [
    { id: "master", label: "MASTERING", icon: "master", info: () => "whole song" },
    { id: "pitch", label: "PITCH", icon: "pitch", info: () => "vocal notes" },
    { id: "stems", label: "STEMS", icon: "stems", info: () => "split" },
  ];
  function renderFooter() {
    const c = selectedRackClip();
    const many = ui.extraClips && ui.extraClips.size;
    const col = c && !c.master && c.track ? c.color || colorOf(c.track) : null;
    rack.style.setProperty("--sc", col || "#3a3a3e");
    side.style.setProperty("--sc", col || "#3a3a3e");
    nameBar.className = "k2-name" + (c ? "" : " none");
    nameBar.innerHTML = `<span></span><button title="Fold the footer">${SVG(html.classList.contains("k2-folded") ? ICON.unfold : ICON.fold, 11)}</button>`;
    nameBar.querySelector("span").textContent = many ? `${many + 1} clips selected` : c ? (c.master ? "MASTER" : c.name) : "Nothing selected";
    nameBar.querySelector("button").onclick = () => { html.classList.toggle("k2-folded"); window.dispatchEvent(new Event("resize")); renderFooter(); };
    // a MIDI clip lists MIDI first, then INST (Eman, 4 Nov); audio keeps FX first
    const order = c && c.kind === "midi" ? ["midi", "inst", "fx", "warp", "samples", "cards"].filter((id) => BASE_TABS.some((x) => x.id === id)) : null;
    const base = order ? order.map((id) => BASE_TABS.find((x) => x.id === id)) : BASE_TABS;
    const tabs = [...base, ...ADDABLE.filter((x) => K.extraTabs.includes(x.id))];
    tabsBox.replaceChildren(...tabs.map((tb) => {
      const b = el("div", "k2-tab" + (K.tab === tb.id ? " on" : ""));
      b.dataset.tab = tb.id;
      b.title = tb.label;
      b.innerHTML = `${SVG(ICON[tb.icon], 14).replace("<svg", '<svg class="ic"')}<span>${tb.label}</span><small></small>`;
      b.querySelector("small").textContent = tb.info(c) || "";
      const sw = el("i", "sw" + (K.tabsOff.has(tb.id) ? " off" : ""));
      sw.title = "Switch this tab's sound on or off";
      sw.onclick = (e) => { e.stopPropagation(); toggleTab(tb.id, c); };
      if (tb.id !== "cards" && tb.id !== "samples") b.append(sw);
      if (ADDABLE.some((x) => x.id === tb.id)) {
        const x = el("span", "x", "×");
        x.title = "Remove this tab";
        x.onclick = (e) => { e.stopPropagation(); K.extraTabs = K.extraTabs.filter((y) => y !== tb.id); if (K.tab === tb.id) K.tab = "fx"; renderFooter(); };
        b.append(x);
      }
      b.onclick = () => { K.spot = (tb.id === "fx" || tb.id === "warp") && ui.selectedClip ? ui.selectedClip : null; openTab(tb.id); spotlight(); };
      return b;
    }), (() => {
      const a = el("div", "k2-tab add");
      a.innerHTML = `${SVG(ICON.plus, 14).replace("<svg", '<svg class="ic"')}<span>ADD TAB</span>`;
      a.onclick = (e) => e.stopPropagation() || showMenu(a, ADDABLE.filter((x) => !K.extraTabs.includes(x.id)).map((x) => ({ label: x.label, meta: x.info(), run: () => { K.extraTabs.push(x.id); openTab(x.id); } })).concat(K.extraTabs.length === ADDABLE.length ? [{ heading: "ALL TABS ADDED" }] : []), { above: true });
      return a;
    })());
    // TEMPO and KEY, each an ORIGINAL | SONG switch (mock v83, Eman 31 Oct: "see the original vs
    // the matched ... I can select the original one, and it stays selected"). White on the clip colour.
    chips.replaceChildren();
    if (c && !c.master && c.kind !== "midi" && c.track && c.track.kind !== "beat") {
      const o = c.orig || {}, f = c.fit || {};
      const sk = (ui.state.key && ui.state.key.name) || ($("key-name").textContent || "").trim() || "--";
      const sb = Math.round(bpm());
      const seg = (kind, label, orig, song, on, same) => {
        const box = el("div", "k2-seg");
        if (orig == null) {
          box.classList.add("solo"); box.title = "Nothing to change: it plays as it is";
          box.innerHTML = `<i class="on"><small>${label}</small>${song}</i>`;
          return box;
        }
        box.innerHTML = `<i data-v="0" class="${on ? "" : "on"}" title="Play it as it came in"><small>ORIGINAL</small>${orig}</i>` +
          `<i data-v="1" class="${on ? "on" : ""}" title="Play it in the song's ${kind}"><small>SONG</small>${song}${same ? " ✓" : ""}</i>`;
        box.onclick = (e) => {
          const i = e.target.closest("i[data-v]"); if (!i) return;
          e.stopPropagation();
          const want = i.dataset.v === "1";
          if (want === on) return;
          i.parentNode.classList.add("busy");
          run("setClipFit", { clipId: c.id, [kind === "tempo" ? "tempo" : "key"]: want }).then((r) => {
            if (!r || r.error) return;
            if (r.clipId) ui.selectedClip = r.clipId;
            toast(want ? `${c.name} plays in the song's ${kind} now.` : (same ? `${c.name} plays as it came in (the same as the song, so it sounds the same).` : `${c.name} plays as it came in.`));
          });
        };
        return box;
      };
      chips.append(
        seg("tempo", "TEMPO", o.bpm ? Math.round(o.bpm) + "" : null, sb + "", !!f.tempo, o.bpm && Math.abs(o.bpm - bpm()) < 0.5),
        seg("key", "KEY", o.key ? o.key.name : null, sk, !!f.key, o.key && o.key.name === sk));
    }
    showPane();
  }
  K.renderFooter = renderFooter;

  function toggleTab(id, c) {
    if (K.tabsOff.has(id)) K.tabsOff.delete(id); else K.tabsOff.add(id);
    if (id === "fx" && c) $("btn-bypass").click();
    renderFooter();
  }

  function openTab(id) {
    K.tab = id;   // folded stays folded: it is the smallest view now, every tab works in it (Eman, 31 Oct)
    renderFooter();
  }
  K.openTab = openTab;
  K.refreshPane = () => { otherPane.dataset.sig = ""; showPane(); };

  // FX is for effects only: TOY MACHINE lives in INST, and CHAIN shows once there's an effect (Eman, 31 Oct)
  const fxCheck = () => html.classList.toggle("k2-nofx", !document.querySelector("#cards .card:not(.inst):not(.add):not(.idea)"));
  { const cardsEl = document.getElementById("cards"); if (cardsEl) new MutationObserver(fxCheck).observe(cardsEl, { childList: true }); fxCheck(); }

  function showPane() {
    const c = selectedRackClip();
    const fx = K.tab === "fx";
    fxPane.hidden = !fx;
    otherPane.hidden = fx;
    // FX is for effects only: TOY MACHINE lives in INST, and CHAIN shows once there's an effect (Eman, 31 Oct)
    if (fx) return;
    // a tall footer shows the whole instrument right here (Eman, 31 Oct)
    const tall = K.tab === "inst" && rack.getBoundingClientRect().height >= 430;
    const sig = K.tab + "|" + (c && K.tab !== "cards" ? c.id : "") + (tall ? "|tall" : "");
    if (otherPane.dataset.sig === sig) { if (K.tab === "midi" && window.KT2Tabs && KT2Tabs.midiLive) KT2Tabs.midiLive(); return; }
    otherPane.dataset.sig = sig;
    if (typeof tmWin !== "undefined" && tmWin && otherPane.contains(tmWin.host)) closeToyMachine();
    otherPane.replaceChildren();
    K.footTall = tall;
    const hook = window.KT2Tabs && KT2Tabs[K.tab];
    if (hook) return hook(otherPane, c);
    const msg = el("div", "k2-empty");
    const midi = c && c.kind === "midi";
    const safe = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));   // names are typed by the user: never let them act as HTML
    if (K.tab === "inst") {
      if (midi) { msg.innerHTML = `<span><b>${safe(c.track.instrument || "TOY MACHINE")}</b> plays this clip.</span>`; const b = el("button", null, "OPEN"); b.onclick = () => openLaneSynth(c.track.id); msg.append(b); }
      else msg.textContent = "INST is for MIDI clips. Pick a MIDI clip, or use ▾ Make into MIDI on a sound.";
    } else if (K.tab === "midi") {
      if (midi) { msg.innerHTML = `<span><b>${(c.notes || []).length} notes</b> in ${safe(c.name)}.</span>`; const b = el("button", null, "PIANO ROLL"); b.onclick = () => openRoll(c); msg.append(b); }
      else if (c && c.track && c.track.kind !== "beat") { msg.innerHTML = "<span>This is a waveform. Convert it into playable MIDI?</span>"; const b = el("button", null, "CONVERT"); b.onclick = () => { const it = window.killtoyConvert && killtoyConvert.menuItems(c, run, toast, openConverted)[0]; if (it) it.run(); else toast("Convert needs the engine's MIDI tools."); }; msg.append(b); }
      else msg.textContent = "Pick a clip to see its notes.";
    } else if (K.tab === "warp") {
      msg.textContent = c ? `${c.name} plays at the song's ${Math.round(bpm())} BPM. Warp markers come next.` : "Pick a clip to warp it.";
    } else if (K.tab === "master") {
      msg.innerHTML = "<span><b>MASTR</b>: the whole song's sound. The full mastering page comes next.</span>";
    } else if (K.tab === "pitch") {
      if (c && c.kind !== "midi") { msg.innerHTML = `<span>The notes ${safe(c.name)} sings.</span>`; const b = el("button", null, "OPEN TUNE"); b.onclick = () => openTune(findClip(c.id)); msg.append(b); }
      else msg.textContent = "PITCH shows a vocal's notes. Pick a vocal clip.";
    } else if (K.tab === "stems") {
      if (c && c.kind !== "midi") { msg.innerHTML = `<span>Split ${safe(c.name)} into vocals, drums, bass and music.</span>`; const b = el("button", null, "SPLIT"); b.onclick = () => run("splitStems", { clipId: c.id }).then((r) => r && r.ok && toast("Splitting. The stems arrive as their own rows.")); msg.append(b); }
      else msg.textContent = "Pick an audio clip to split it.";
    }
    otherPane.append(msg);
  }

  function openRoll(c) {
    ui.selectedClip = c.id;
    const fc = findClip(c.id);
    if (fc && typeof openLaneWindow === "function") { openLaneWindow({ t: fc.track, clip: fc, view: "midi" }); return; }
    ui.openRollFor = c.id; render();
  }

  // ------------------------------------------------------------------ right-click empty: new pattern / sounds
  document.addEventListener("contextmenu", (e) => {
    const lane = e.target.closest && e.target.closest(".lane");
    if (!lane || e.target.closest(".clip")) return;
    e.preventDefault(); e.stopPropagation();
    const row = lane.closest(".row"), t = ui.state.tracks.find((x) => x.id === row.dataset.trackId), spot = K.ghostSpot(row);
    const sec = toSec(e.clientX - lane.getBoundingClientRect().left);
    let at = Math.floor(sec / secPerBar() + 1e-6) * secPerBar(), bars = 4;   // a new pattern is 4 bars (Eman, 5 Nov 01:56; was 16 from 4 Nov)
    // inside the yellow loop: the pattern fills the loop (Eman, 31 Oct)
    const s = ui.state, inLoop = ui.transport.looping && s.loopEnd > s.loopStart && sec >= s.loopStart && sec < s.loopEnd;
    if (inLoop) { at = s.loopStart; bars = Math.max(0.25, Math.round(((s.loopEnd - s.loopStart) / secPerBar()) * 16) / 16); }
    const size = (bars === Math.round(bars) ? bars : bars.toFixed(2)) + (bars === 1 ? " bar" : " bars");
    showMenu(atMouse(e), [
      { label: "EMPTY PATTERN", meta: inLoop ? size + ", the loop" : size, run: () => newPattern("empty", t, at, bars, spot) },
      { sep: true },
      { heading: "NEW PATTERN HERE" },
      { label: "TOY MACHINE", meta: "synth", run: () => newPattern("toy", t, at, bars, spot) },
      { label: "DRUMS", meta: "KILLDRUM", run: () => newPattern("drums", t, at, 4, spot) },
      { label: "SAMPLER", meta: "your sounds", run: () => $("tool-samples").click() },
      { label: "AUDIO", meta: "record here", run: () => newPattern("audio", t, at, 4, spot) },
      { sep: true },
      { label: "Library", meta: "kicks, snares, FX", run: () => $("tool-library").click() },
    ]);
  }, true);

  // double-click an empty spot on the playground: a new empty pattern there, with no synth yet
  // (Eman, 5 Nov 01:45). KT2_NO_DBL_PATTERN = true turns it off. It listens for the second press
  // (mousedown with detail 2): the first click re-draws the rows, so a real dblclick never arrives.
  // It only makes the pattern; nothing opens (Eman, 5 Nov 01:56).
  document.addEventListener("mousedown", (e) => {
    if (e.detail !== 2 || e.button !== 0) return;
    if (window.KT2_NO_DBL_PATTERN || K.tool !== "select") return;
    const lane = e.target.closest && e.target.closest("#rows .lane");
    if (!lane || e.target.closest(".clip, .auto-lane, .loopbar, button, input")) return;
    const row = lane.closest(".row");
    if (!row || !ui.state) return;
    const t = ui.state.tracks.find((x) => x.id === row.dataset.trackId);
    if (t && (t.kind === "beat" || ((t.kind === "take" || t.kind === "audio") && !K.freeRows()))) return;
    e.preventDefault(); e.stopPropagation();
    const spot = K.ghostSpot(row), sec = toSec(e.clientX - lane.getBoundingClientRect().left);
    // a new pattern always starts on the half beat closest to the double-click (Eman, 6 Nov 22:39:
    // "closest half beat"); KT2_DBL_BAR_FLOOR = the old "the bar it was clicked in"
    const half = secPerBeat() / 2;
    // Eman, 6 Nov 23:03: no, the closest whole BAR, never between two bars. KT2_DBL_HALFBEAT = the half-beat start
    const barAt = (x) => (window.KT2_DBL_BAR_FLOOR ? Math.floor(x / secPerBar() + 1e-6) * secPerBar() : window.KT2_DBL_HALFBEAT ? Math.round(x / half) * half : Math.round(x / secPerBar()) * secPerBar());
    let at = Math.max(0, barAt(sec)), bars = 4;
    // BAR 1 MAGNET (Eman, 16 Nov 02:01: "if i press here it should snap to the first one, only on the first one"):
    // a double-click anywhere before the last tenth of bar 1 starts the pattern at bar 1. Zoomed in, the zone stays at
    // most 90 px wide, so it loosens ("if i zoom in a little bit more it would work to do whatever"). KT2_PAT_SNAP4_OLD = old.
    if (!window.KT2_PAT_SNAP4_OLD && !ui.snapOff && !e.altKey && sec * ui.pxPerSec < Math.min(secPerBar() * (window.KT2_PAT_BAR1_ZONE || 0.9) * ui.pxPerSec, 90)) at = 0;
    const s = ui.state, inLoop = ui.transport.looping && s.loopEnd > s.loopStart && sec >= s.loopStart && sec < s.loopEnd;
    if (inLoop) { at = window.KT2_DBL_BAR_FLOOR ? s.loopStart : Math.max(0, barAt(s.loopStart)); bars = Math.max(0.25, Math.round(((s.loopEnd - s.loopStart) / secPerBar()) * 16) / 16); }
    // DRAG OUT (Eman, 6 Nov 22:05): the new pattern hangs on the mouse, you pull it as long as you
    // want (snapping to the grid) and the next click sets its size. KT2_DBL_DRAG_OLD = the old 4 bars at once.
    if (!window.KT2_DBL_DRAG_OLD) return dragOutPattern(e, lane, row, t, at, spot);
    makeBlank(t, at, bars, spot);
  }, true);
  // The welcome card of a new project sits in the middle of the grid, right where a newcomer double-clicks
  // after reading "double-click a row to make a pattern": that did nothing (UX stress test, 8 Nov). A double-click
  // on the card (not on its buttons) now goes through to the row under it. KT2_EMPTY_DBL_OLD = old.
  document.addEventListener("mousedown", (e) => {
    if (e.detail !== 2 || e.button !== 0 || window.KT2_EMPTY_DBL_OLD || !e.isTrusted) return;
    const card = e.target.closest && e.target.closest("#empty .empty-card, #empty .k2st");
    if (!card || e.target.closest("button, a, input")) return;
    card.style.pointerEvents = "none";
    const under = document.elementFromPoint(e.clientX, e.clientY);
    card.style.pointerEvents = "";
    if (!under || !under.closest("#rows .lane")) return;
    e.preventDefault(); e.stopPropagation();
    document.getElementById("empty").hidden = true;   // out of the way while the new pattern is pulled out (render brings it back if nothing is made)
    under.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, button: 0, buttons: 1, detail: 2, view: window }));
  }, true);
  function makeBlank(t, at, bars, spot) {
    return newPattern("blank", t, at, bars, spot).then((m) => {
      if (!m || !m.clipId || !window.KT2Juice) return;
      requestAnimationFrame(() => { const n = document.querySelector(`.clip[data-clip-id="${m.clipId}"]`); if (n && n.animate) n.animate([{ transform: "scaleY(0.2)", opacity: 0 }, { transform: "scaleY(1.08)", opacity: 1 }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,1.4,.4,1)" }); });
    });
  }
  // The drag-out ghost: starts at the bar you double-clicked, its right end follows the mouse on the
  // grid you can see (snapGrid, Alt = free, at least one grid step), shows its size, scrolls the song
  // along at the right edge. Click (or let go after holding the second press and pulling) = make it
  // that big. Esc or right-click = no pattern.
  function dragOutPattern(e0, lane, row, t, at, spot) {
    const col = freshColors(1)[0], scroll = $("scroll");
    const g = el("div", "k2-dragout");
    g.style.setProperty("--c", col);
    g.style.setProperty("--bar", (secPerBar() * ui.pxPerSec) + "px");
    g.style.setProperty("--beat", (secPerBeat() * ui.pxPerSec) + "px");
    const tag = el("div", "k2-dragout-tag");
    g.append(tag);
    document.body.append(g);
    html.classList.add("k2-dragging-out");
    const sm = speedMeter();
    const x0 = e0.clientX;
    let end = at + secPerBar(), mx = e0.clientX, held = true, pulled = false, done = false, raf = 0;
    // an empty grid row has no track id: find it again by its place among the rows (24 Nov, see place())
    const rowIx = [...document.querySelectorAll("#rows > .row")].indexOf(row);
    const liveLane = () => { if (lane.isConnected) return lane; const tr = row.dataset.trackId && document.querySelector(`#rows .row[data-track-id="${row.dataset.trackId}"] .lane`); if (tr) return tr; if (window.KT2_DRAGOUT_TOP_OLD || rowIx < 0) return lane; const rw = document.querySelectorAll("#rows > .row")[rowIx]; return (rw && rw.querySelector(".lane")) || lane; };
    const laneLeft = () => liveLane().getBoundingClientRect();
    // sizes in bars + beats (Eman, 7 Nov 17:14): "2 BEATS", "1 BAR", "1 BAR 2 BEATS", "3 BARS 1.5 BEATS"
    const fmtBB = (sec) => {
      const all = Math.round((sec / secPerBeat()) * 4) / 4, per = Math.round(secPerBar() / secPerBeat()) || 4;
      const bars = Math.floor(all / per + 1e-6), beats = Math.round((all - bars * per) * 100) / 100;
      const B = bars ? bars + (bars === 1 ? " BAR" : " BARS") : "", b = beats ? beats + (beats === 1 ? " BEAT" : " BEATS") : "";
      return [B, b].filter(Boolean).join(" ") || "0 BEATS";
    };
    const fmt = (sec) => {
      if (!window.KT2_DRAGOUT_WHOLEBARS) return fmtBB(sec);
      const bars = sec / secPerBar();
      if (bars >= 1 - 1e-6) { const b = Math.round(bars * 100) / 100; return b + (b === 1 ? " BAR" : " BARS"); }
      const beats = Math.round((sec / secPerBeat()) * 100) / 100;
      return beats + (beats === 1 ? " BEAT" : " BEATS");
    };
    // 24 Nov (Eman clip 01.16, "now suddenly this bar is on the top"): when the lanes were drawn again mid-pull, the old
    // lane AND row were gone, their box read 0 and the ghost jumped to the very top of the window. It now follows the
    // live lane of that row. KT2_DRAGOUT_TOP_OLD = the old box
    const place = (ev) => {
      const r = laneLeft(), rr = window.KT2_DRAGOUT_TOP_OLD ? (lane.isConnected ? lane : row).getBoundingClientRect() : r;
      const free = toSec(mx - r.left);
      // whole bars only (Eman, 6 Nov 23:03: "you cant put it at 3.25, then it will be 3"), at least 1 bar.
      // Alt = free. KT2_DRAGOUT_BEATS = the beat steps of before.
      if (!window.KT2_DRAGOUT_BEATS && !window.KT2_DRAGOUT_GRID_ONLY && !(ev && ev.altKey)) {
        // the step scales with the zoom (K.dragStep, Eman 7 Nov 17:15). KT2_DRAGOUT_WHOLEBARS = whole bars only (6 Nov).
        const step = window.KT2_DRAGOUT_WHOLEBARS ? secPerBar() : K.dragStep();
        const n = Math.max(1, Math.round((free - at) / step));
        end = at + n * step;
        // 4-BAR MAGNET (Eman, 16 Nov): near 4, 8, 12, 16... it locks there (KT2_PAT_SNAP4_OLD = old)
        const m4 = K.snap4(free - at);
        if (m4 != null) end = at + m4;
        K.snap4Feel(g, m4 != null, end - at);
        const top = rr.top, h = rr.height;
        g.style.left = (r.left + toX(at)) + "px"; g.style.top = (top + 2) + "px"; g.style.height = Math.max(8, h - 4) + "px";
        g.style.width = Math.max(2, toX(end - at)) + "px";
        tag.textContent = fmt(end - at);
        return;
      }
      let e = (ui.snapOff || (ev && ev.altKey)) ? free : snapGrid(free, sm.v, 0);
      // the end can land on any beat of a bar, even zoomed out (Eman, 6 Nov 22:38); finer when the grid is finer.
      // KT2_DRAGOUT_GRID_ONLY = the old (only the grid you see)
      if (!(ui.snapOff || (ev && ev.altKey)) && !window.KT2_DRAGOUT_GRID_ONLY) {
        const bt = at + Math.round((free - at) / secPerBeat()) * secPerBeat();
        if (Math.abs(bt - free) < Math.abs(e - free)) e = bt;
      }
      // never shorter than one step of the grid you see (a quarter beat when free)
      const minLen = (ui.snapOff || (ev && ev.altKey)) ? secPerBeat() / 4 : Math.max(secPerBeat() / 4, snapGrid(at + secPerBeat() / 4 + 1e-4, sm.v, 1) - at);
      if (e < at + minLen) e = at + minLen;
      end = e;
      const top = rr.top, h = rr.height;
      g.style.left = (r.left + toX(at)) + "px";
      g.style.top = (top + 2) + "px";
      g.style.height = Math.max(8, h - 4) + "px";
      g.style.width = Math.max(2, toX(end - at)) + "px";
      tag.textContent = fmt(end - at);
    };
    const edge = () => {
      raf = 0;
      if (done || !scroll) return;
      const r = scroll.getBoundingClientRect(), zone = 48;
      const d = mx > r.right - zone ? (mx - (r.right - zone)) / zone : mx < r.left + zone + 120 && toSec(mx - laneLeft().left) > at ? -((r.left + zone + 120 - mx) / zone) : 0;
      if (d) { scroll.scrollLeft += Math.max(-1, Math.min(1, d)) * 18; place(); raf = requestAnimationFrame(edge); }
    };
    const move = (ev) => {
      sm.feed(ev); mx = ev.clientX;
      if (held && Math.abs(mx - x0) > 6) pulled = true;
      place(ev);
      if (!raf) raf = requestAnimationFrame(edge);
    };
    const finish = (make) => {
      if (done) return; done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("mousedown", down, true);
      window.removeEventListener("mouseup", up, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("contextmenu", ctx, true);
      scroll && scroll.removeEventListener("scroll", onScroll);
      html.classList.remove("k2-dragging-out");
      if (!make) { g.classList.add("gone"); setTimeout(() => g.remove(), 160); return; }
      g.classList.add("set");
      const bars = Math.max(1 / 16, (end - at) / secPerBar());
      makeBlank(t, at, bars, Object.assign({}, spot, { color: col })).finally(() => setTimeout(() => g.remove(), 60));
    };
    // the second press after the double-click: make it. Swallowed, so it does not select or move anything.
    const down = (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); if (ev.button === 0) { mx = ev.clientX; place(ev); finish(true); } else finish(false); };
    // held the double-click's second press and pulled: letting go makes it
    const up = (ev) => { if (!held) return; held = false; if (pulled) { ev.stopImmediatePropagation(); mx = ev.clientX; place(ev); finish(true); } };
    // Delete / Backspace cancel too, same as Esc (Eman, 11 Nov 02:20); KT2_DRAGOUT_DEL_OFF = only Esc
    const key = (ev) => { if (ev.key === "Escape" || (!window.KT2_DRAGOUT_DEL_OFF && (ev.key === "Delete" || ev.key === "Backspace"))) { ev.preventDefault(); ev.stopImmediatePropagation(); finish(false); } else if (ev.key === "Enter") { ev.preventDefault(); ev.stopImmediatePropagation(); finish(true); } };
    const ctx = (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); finish(false); };
    const onScroll = () => place();
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mousedown", down, true);
    window.addEventListener("mouseup", up, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("contextmenu", ctx, true);
    scroll && scroll.addEventListener("scroll", onScroll);
    place(e0);
    K.dragOut = { finish, get end() { return end; }, at };
  }
  K.newPattern = (...a) => newPattern(...a);
  // 4-BAR MAGNET (Eman, 16 Nov 02:00: "snap a little bit harder on 4, 8, 12, 16... if you're between 7 and 8,
  // a little on the 8 side, it goes to 8"): a pattern's length locks onto a multiple of 4 bars when the mouse is
  // within the magnet zone of one (0.65 bar either side, never under 14 px or over 110 px on screen, so a
  // clearly aimed 7 still lands on 7, and zoomed far in the zone stays small). Alt / snap off = free.
  // Returns the locked length in seconds, or null. KT2_PAT_SNAP4_OLD = the old snap (no magnet).
  K.snap4 = (len, ev) => {
    if (window.KT2_PAT_SNAP4_OLD || ui.snapOff || (ev && ev.altKey)) return null;
    const bar = secPerBar(), px = ui.pxPerSec;
    if (!(bar > 0) || !(len > 0)) return null;
    const four = bar * 4, n = Math.round(len / four);
    if (n < 1) return null;
    const zonePx = Math.max(14, Math.min(110, (window.KT2_PAT_SNAP4_ZONE || 0.65) * bar * px));
    return Math.abs(len - n * four) * px <= zonePx ? n * four : null;
  };
  // the lock feel: the tag pops and the edge flashes, with a soft click, each time it locks onto a new line
  K.snap4Feel = (node, locked, len) => {
    if (!node) return;
    const key = locked ? Math.round(len * 1000) : 0;
    if (locked && node._k2s4 !== key) {
      node.classList.remove("k2-snap4-hit"); void node.offsetWidth; node.classList.add("k2-snap4-hit");
      try { window.KT2Juice && KT2Juice.sound && KT2Juice.sound.land(); } catch (e) { /* fine */ }
    }
    node._k2s4 = key;
    node.classList.toggle("k2-snap4", !!locked);
  };
  // SMART drag-out step (Eman, 7 Nov 17:15): it scales with the zoom. Normal zoom = any beat of the bar; a bit
  // zoomed out = half bars; far out = whole bars. Zoomed far in, half and quarter beats once they are wide enough
  // to aim at. KT2_DRAGOUT_STEP_PX (8) / KT2_DRAGOUT_FINE_PX (24) = how wide a step must be on screen.
  K.dragStep = () => {
    const px = ui.pxPerSec, b = secPerBeat(), min = window.KT2_DRAGOUT_STEP_PX || 8, fine = window.KT2_DRAGOUT_FINE_PX || 24;
    let step = secPerBar();
    for (const s of [secPerBar() / 2, b]) if (s * px >= min) step = s;
    for (const s of [b / 2, b / 4]) if (s * px >= fine) step = s;
    return step;
  };


  function newPattern(kind, t, at, bars = 4, spot = {}) {
    // made on an empty row: the new lane sits on that row (its empty rows above it stay)
    const park = (r) => { const id = r && (r.trackId || r.id); return !t && id && (spot.gap || spot.before) ? run("setLaneGap", { trackId: id, gap: spot.gap, before: spot.before }).then(() => r) : r; };
    // EMPTY PATTERN: an empty MIDI pattern (4 bars, or the loop's size); on an empty row it gets a
    // plain TOY MACHINE to play it, picked like any lane's instrument afterwards
    if (kind === "toy" || kind === "empty" || kind === "blank") {
      // a new pattern is its own pattern: own sound and a colour nobody in the song has yet, on the
      // row you made it on (Eman, 31 Oct)
      const col = spot.color || freshColors(1)[0];
      return run("newInstrumentLane", { key: "builtin:toymachine" }).then(park).then(async (r) => {
        const id = r && (r.trackId || r.id);
        if (!id) return $("btn-inst").click();
        const m = await run("newMidiClip", { trackId: id, start: at, bars });
        if (!m || !m.clipId) return m;
        await run("setClipColor", { clipIds: [m.clipId], color: col });
        // BLANK (a double-click on the playground, Eman 5 Nov 01:45): no synth yet, the pattern shows ADD INSTRUMENT
        if (kind === "blank") { await run("setNoInstrument", { trackId: id, on: true }); await run("renameTrack", { trackId: id, name: "NEW PATTERN" }); }
        if (t && t.kind !== "beat" && K.freeRows()) await run("setClipRow", { clipId: m.clipId, row: t.id });
        ui.selectedClip = m.clipId; render();
        return m;
      });
    }
    if (kind === "audio") {
      if (t && t.kind === "take") return run("armTrack", { trackId: t.id }).then(() => toast("Press R to record into this row."));
      return run("newTakeLane").then(park).then((r) => r && r.trackId && toast("New audio row, armed: press R to record into it."));
    }
    if (kind === "drums") {
      if (window.KillDrum && KillDrum.newLane) return KillDrum.newLane(at);
      const pick = (r) => { if (r && r.clipId) { ui.selectedClip = r.clipId; render(); } return r; };
      if (t && t.kind === "inst" && [...(t.plugins || []), ...t.clips.flatMap((x) => x.plugins || [])].some((p) => p.kit)) return run("newMidiClip", { trackId: t.id, start: at, bars }).then(pick);
      return run("newInstrumentLane", { key: "builtin:toydrums" }).then(park).then((r) => { const id = r && (r.trackId || r.id); if (id) return run("newMidiClip", { trackId: id, start: at, bars }).then(pick); });
    }
  }

  // Start clean: nothing picked, tool = select.
  ui.selectedClip = null;
  setTimeout(() => { paintTools(); renderFooter(); }, 0);
})();

// SPLIT window: drag the line between the MIDI and the synth to give either side more room (Eman, 31 Oct).
// The MIDI width is kept (localStorage kt2.iwSplit) and both sides adapt: the synth through container queries in kt2.css.
(function iwSplitter() {
  const card = document.getElementById("iw-card"), body = card && card.querySelector(".iw-body");
  if (!body) return;
  const KEY = "kt2.iwSplit";
  let saved = null;
  try { saved = Number(localStorage.getItem(KEY)) || null; } catch (e) {}
  const bar = document.createElement("div");
  bar.className = "k2-iwsplit"; bar.title = "Drag to give the MIDI or the synth more room (double-click: back to even)";
  body.append(bar);
  const midiPane = () => [document.getElementById("iw-tmidi"), document.getElementById("roll")].find((p) => p && !p.hidden);
  const redraw = () => {
    const p = document.getElementById("iw-tmidi");
    if (p && !p.hidden && window.TmMidi) { p.dispatchEvent(new Event("change")); TmMidi.draw(); }
    if (typeof drawRoll === "function") drawRoll();
  };
  const apply = (w) => {
    const bw = body.clientWidth;
    if (w == null || !bw) { body.style.removeProperty("--k2-iw-midi"); return; }
    w = Math.max(240, Math.min(bw - 420, w));
    body.style.setProperty("--k2-iw-midi", w + "px");
  };
  const place = () => {
    const on = card.classList.contains("split") && midiPane();
    bar.hidden = !on;
    if (!on) return;
    apply(saved);
    const m = midiPane(), r = m.getBoundingClientRect(), b = body.getBoundingClientRect(), z = body.clientWidth / (b.width || 1);
    bar.style.left = ((r.right - b.left) * z + 3) + "px";
  };
  new MutationObserver(place).observe(card, { attributes: true, attributeFilter: ["class"] });
  for (const id of ["iw-tmidi", "roll"]) { const p = document.getElementById(id); if (p) new MutationObserver(place).observe(p, { attributes: true, attributeFilter: ["hidden"] }); }
  if (window.ResizeObserver) new ResizeObserver(place).observe(body);
  bar.addEventListener("pointerdown", (e) => {
    e.preventDefault(); bar.setPointerCapture(e.pointerId); bar.classList.add("on");
    const b = body.getBoundingClientRect(), z = body.clientWidth / (b.width || 1), padL = parseFloat(getComputedStyle(body).paddingLeft) || 0;
    const move = (ev) => { saved = (ev.clientX - b.left) * z - padL - 7; apply(saved); place(); redraw(); };
    const up = () => { bar.classList.remove("on"); bar.removeEventListener("pointermove", move); try { localStorage.setItem(KEY, String(Math.round(saved))); } catch (er) {} redraw(); };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up, { once: true }); bar.addEventListener("pointercancel", up, { once: true });
  });
  bar.addEventListener("dblclick", () => { saved = null; try { localStorage.removeItem(KEY); } catch (e) {} apply(null); place(); redraw(); });
  place();
})();

// CHAIN column (Eman, 1 Nov): no built-in names or use bars. It only lists the chains YOU saved
// (one click puts one on the clip) and a SAVE CURRENT button for the effects on this clip.
(function () {
  if (!document.documentElement.classList.contains("kt2") || typeof renderPresets !== "function") return;
  window.renderPresets = renderPresets = function (clip) {
    const box = document.getElementById("presets");
    if (!box) return;
    box.replaceChildren();
    const mine = (ui.state.chains || []).filter((c) => c.saved).sort((a, b) => a.name.localeCompare(b.name));
    ui.sortedChains = mine;
    const current = clip ? clip.plugins.map((p) => p.name).join(" → ") : null;
    const off = !clip || clip.kind === "midi";
    for (const ch of mine) {
      const b = el("button", "k2-chain" + (current && current === ch.plugins ? " on" : ""), ch.name);
      b.disabled = off;
      b.title = ch.plugins + "  ·  right-click to delete";
      b.onclick = () => applyChain(ch.name);
      b.oncontextmenu = (e) => { e.preventDefault(); showMenu(b, [{ label: `Delete chain "${ch.name}"`, danger: true, run: () => run("deleteChain", { name: ch.name }) }]); };
      box.append(b);
    }
    if (!mine.length) box.append(el("div", "k2-chain-none", "No saved chains yet"));
    const save = el("button", "k2-chain-save", "+ SAVE CURRENT");
    save.disabled = off || !(clip.plugins || []).length;
    save.onclick = (e) => { e.stopPropagation(); promptChainName(save); };
    box.append(save);
  };
  document.head.insertAdjacentHTML("beforeend", `<style>
.kt2 #presets { display: flex; flex-direction: column; gap: 2px; }
.kt2 .k2-chain { text-align: left; padding: 6px 8px; font: 600 12px var(--font); color: var(--k2-ink); background: transparent; border: 0; border-radius: 0; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt2 .k2-chain:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); }
.kt2 .k2-chain.on { background: var(--acid); color: #141218; }
.kt2 .k2-chain:disabled { opacity: 0.4; cursor: default; }
.kt2 .k2-chain-none { padding: 6px 8px; font: 400 11px var(--font); color: var(--k2-ink3); }
.kt2 .k2-chain-save { margin-top: 8px; align-self: flex-start; padding: 6px 8px; font: 700 9.5px var(--font); letter-spacing: 0.14em; color: var(--k2-ink); background: transparent; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 0; cursor: pointer; }
.kt2 .k2-chain-save:hover:not(:disabled) { border-color: var(--acid); color: var(--acid); }
.kt2 .k2-chain-save:disabled { opacity: 0.35; cursor: default; }
</style>`);
})();

// The lane window's view (Eman, 4 Nov; was one SPLIT memory for every window, 1 Nov):
// double-clicking a pattern opens MIDI, pressing its INST opens the synth (TOY MACHINE), and each
// pattern remembers the view picked last with the tabs (TOY MACHINE / SPLIT / MIDI), per project,
// across reloads. KILLDRUM lanes keep their own single view.
(function () {
  if (!document.documentElement.classList.contains("kt2") || typeof openLaneWindow !== "function") return;
  const K = window.KT2;
  let views = {};
  try { views = JSON.parse(localStorage.getItem("kt2.clipViews") || "{}") || {}; } catch (e) { views = {}; }
  const keyOf = (cid) => ((ui.state && ui.state.session) || "") + "|" + cid;
  const curClip = () => ui.roll && ui.roll.clipId;
  let opening = false;
  function remember() {
    if (opening || typeof iw === "undefined" || !iw || !iw.view) return;
    const t = ui.state && ui.state.tracks.find((x) => x.id === iw.trackId), cid = curClip();
    if (!cid || !t || isKillDrumLane(t)) return;
    views[keyOf(cid)] = iw.view;
    const ks = Object.keys(views); if (ks.length > 600) for (const k of ks.slice(0, ks.length - 600)) delete views[k];
    try { localStorage.setItem("kt2.clipViews", JSON.stringify(views)); } catch (e) { /* this browser only */ }
  }
  K.clipView = (cid) => views[keyOf(cid)] || null;
  const _set = setLaneView;
  window.setLaneView = setLaneView = function () { const r = _set.apply(this, arguments); remember(); return r; };
  const _open = openLaneWindow;
  window.openLaneWindow = openLaneWindow = function (a) {
    // A pattern always opens in its own lane's window (Zed call, 7 Nov 22:00: a new drum pattern made under
    // "hey" opened hey's TOY MACHINE notes instead of KILLDRUM). When the clip asked for lives on another lane
    // than the one passed in, its own lane wins, so its own instrument (KILLDRUM, a synth) opens with it.
    // KT2_OPEN_TRACK_OLD = true: the lane passed in, as before.
    if (a && a.clip && !window.KT2_OPEN_TRACK_OLD && typeof findClip === "function") {
      const own = findClip(a.clip.id), ot = own && own.track && ui.state.tracks.find((x) => x.id === own.track.id);
      if (ot && (!a.t || a.t.id !== ot.id) && !(a.t && ot.layerOf === a.t.id)) {
        a = Object.assign({}, a, { t: ot, clip: own });
        if (isKillDrumLane(ot)) a.view = "inst";
        arguments[0] = a;
      }
    }
    opening = true;
    let r;
    try { r = _open.apply(this, arguments); } finally { opening = false; }
    const t = a && a.t, cid = curClip(), saved = cid && K.clipView(cid);
    if (t && saved && !isKillDrumLane(t) && typeof iw !== "undefined" && iw && iw.view !== saved) { opening = true; try { setLaneView(saved); } finally { opening = false; } }
    return r;
  };
})();

// One strip on top (Eman, 4 Nov): no separate window title bar. The three window dots sit at the
// left of KILLTOY's own top bar, like an app with a hidden title bar. In the browser preview they're
// drawn here (green = fill the screen); the Mac app gets the real ones from macOS in the same spot.
(function () {
  if (!document.documentElement.classList.contains("kt2") || window.__JUCE__) return;
  const make = () => {
  const box = document.createElement("div");
  box.className = "k2-lights";
  box.innerHTML = '<i class="r" title="Close"></i><i class="y" title="Minimise"></i><i class="g" title="Fill the screen"></i>';
  box.querySelector(".g").onclick = () => { try { const b = parent.document.getElementById("size-fill"), m = parent.document.getElementById("size-mac"); (b && b.getAttribute("aria-pressed") === "true" ? m : b).click(); } catch (e) { /* not in the preview frame */ } };
  return box;
  };
  // the DAW's top bar and the projects page's bar both start with them
  const place = () => { for (const sel of ["header.top .top-left", "#home .home-bar"]) { const left = document.querySelector(sel); if (left && !left.querySelector(".k2-lights")) left.prepend(make()); } };
  place();
  const home = document.getElementById("home");   // the projects page builds its bar later
  if (home) new MutationObserver(place).observe(home, { childList: true });
  document.documentElement.classList.add("k2-has-lights");
})();

// RENAME BY DOUBLE-CLICK (Eman, 7 Nov 13:00): double-click a pattern's name and a big name box opens in the middle;
// DONE, Enter or a click outside keeps it, Esc leaves it. Linked copies get the name too, and the lane when it
// carried the pattern's name. KT2_RENAME_POP_OFF = only the right-click menu, as before.
(function () {
  "use strict";
  const html = document.documentElement;
  if (!html.classList.contains("kt2") || window.KT2_RENAME_POP_OFF) return;
  const css = document.createElement("style");
  css.textContent = `
  .k2-renpop { position: fixed; inset: 0; z-index: 2147483100; display: grid; place-items: center; background: rgba(8,8,10,.12); }
  .k2-renpop .box { width: min(360px, calc(100vw - 32px)); background: #18181c; border: 1px solid #2c2c33; padding: 16px; display: flex; flex-direction: column; gap: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,.6); animation: k2-renin .2s cubic-bezier(.2,1.2,.4,1); }
  @keyframes k2-renin { from { transform: translateY(8px) scale(.97); opacity: 0; } }
  .k2-renpop b { font: 700 11px Inter, sans-serif; letter-spacing: .22em; color: #8a8a96; }
  .k2-renpop input { background: #0f0f12; border: 1px solid #3a3a44; color: #fff; font: 800 20px Unbounded, Inter, sans-serif; letter-spacing: .02em; padding: 9px 11px; outline: none; text-transform: uppercase; }
  .k2-renpop input:focus { border-color: #c9a8ff; box-shadow: 0 0 0 3px rgba(155,92,255,.25); }
  .k2-renpop .row { display: flex; justify-content: flex-end; gap: 10px; }
  .k2-renpop button { background: #9b5cff; color: #fff; border: 0; font: 800 10px Inter, sans-serif; letter-spacing: .16em; padding: 8px 12px; cursor: pointer; }
  .k2-renpop button.q { background: none; border: 1px solid #3a3a44; color: #aaa; }`;
  document.head.append(css);
  function open(clipId) {
    const st = typeof ui !== "undefined" && ui.state; if (!st) return;
    const t = st.tracks.find((x) => x.clips.some((c) => c.id === clipId)), c = t && t.clips.find((x) => x.id === clipId);
    if (!c || document.querySelector(".k2-renpop")) return;
    const pop = document.createElement("div"); pop.className = "k2-renpop";
    pop.innerHTML = '<div class="box"><b>NAME</b><input maxlength="40" spellcheck="false"><div class="row"><button class="q" data-x>CANCEL</button><button data-ok>DONE</button></div></div>';
    const inp = pop.querySelector("input"); inp.value = c.name || "";
    document.body.append(pop);
    setTimeout(() => { inp.focus(); inp.select(); }, 20);
    const close = (keep) => {
      pop.remove();
      const v = inp.value.trim();
      if (!keep || !v || v === c.name) return;
      const idsAll = window.KT2Compound ? KT2Compound.idsFor(c.id) : [c.id];
      if (t.name === c.name || t.clips.length === 1) run("renameTrack", { trackId: t.id, name: v });
      idsAll.forEach((id) => run("renameClip", { clipId: id, name: v }));
    };
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") close(true); if (e.key === "Escape") close(false); });
    pop.addEventListener("mousedown", (e) => { e.stopPropagation(); if (e.target === pop) close(true); });
    pop.querySelector("[data-ok]").onclick = () => close(true);
    pop.querySelector("[data-x]").onclick = () => close(false);
  }
  // the clip redraws on the first press, so the second press of a double-click is caught as mousedown detail 2
  // (a second press can come without its mousedown, so a real dblclick counts too; once per double-click)
  let lastOpen = 0;
  const onDbl = (e) => {
    if (e.button !== 0 || (e.type === "mousedown" && e.detail !== 2) || Date.now() - lastOpen < 400) return;
    // the notes picture can lie over the name, so the spot counts, not the element under it
    const under = document.elementFromPoint(e.clientX, e.clientY) || e.target;
    const clip = under.closest && under.closest(".clip");
    const nm = clip && clip.querySelector(".clip-label .nm");
    if (!clip || !nm || !clip.dataset.clipId) return;
    const r = nm.getBoundingClientRect();
    if (!(e.clientX >= r.left - 3 && e.clientX <= r.right + 3 && e.clientY >= r.top - 3 && e.clientY <= r.bottom + 3)) return;
    // a small pattern (zoomed out) is mostly its name: a double-click there goes into it, like on the body, and the
    // name is changed from the right-click menu (Zed call 2, 7 Nov 13:05: "we go into the MIDI" opened NAME).
    // KT2_RENAME_SMALL = old (the name box on any size).
    const cr = clip.getBoundingClientRect();
    if (!window.KT2_RENAME_SMALL && !(window.KT2Quest && KT2Quest.active) && (cr.width < 160 || cr.height < 44)) return;   // a quest that asks for the name keeps it
    e.preventDefault(); e.stopImmediatePropagation();
    lastOpen = Date.now();
    open(clip.dataset.clipId);
  };
  window.addEventListener("mousedown", onDbl, true);
  window.addEventListener("dblclick", onDbl, true);
  window.KT2Rename = { open };
})();

// ZOOM (Eman, 7 Nov V4x; moved 10 Nov): pinch, Cmd + scroll and Cmd +/- still zoom too. KT2_ZOOM_BTNS_OFF = none.
// 10 Nov 23:58: the -/+ above the ruler were confusing next to the parts + (that one adds a song part). Now the
// zoom sits in the bar-number row at the right end, faded until the mouse is on it, and is a ZOOM WHEEL: a strip of
// thin vertical stripes you drag sideways (right = closer, left = wider) that ticks softly as stripes pass;
// double-click it = fit the song. KT2_ZOOM_WHEEL_OFF = small -/+ in the same spot; KT2_ZOOM_RULER_OLD = the old
// -/+ above the ruler, before the parts +.
(() => {
  "use strict";
  const html = document.documentElement;
  if (!html.classList.contains("kt2") || window.KT2_ZOOM_BTNS_OFF || typeof zoomAt !== "function") return;
  const OLD = !!window.KT2_ZOOM_RULER_OLD, WHEEL = !OLD && !window.KT2_ZOOM_WHEEL_OFF;
  const css = document.createElement("style");
  css.textContent = OLD ? `
  .k2-zoom { display: inline-flex; gap: 2px; margin-right: 4px; }
  .k2-zoom button { width: 22px; height: 20px; padding: 0; font: 500 15px/20px var(--font); text-align: center; border-radius: 0; color: var(--k2-ink, #ececf0); background: #2c2c30; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); cursor: pointer; }
  .k2-zoom button:hover { background: #3a3a3e; color: #fff; }` : `
  .k2-zoom.k2-zr { position: fixed; z-index: 40; display: flex; align-items: center; gap: 2px; transform: translate(-100%, -50%); padding: 2px 0 2px 6px; background: rgb(24, 24, 27); }
  .k2-zoom.k2-zr > * { opacity: .4; transition: opacity .15s; }
  .k2-zoom.k2-zr:hover > *, .k2-zoom.k2-zr.k2-zr-on > * { opacity: 1; }
  .k2-zoom.k2-zr button { width: 16px; height: 14px; padding: 0; font: 500 12px/14px var(--font); text-align: center; border-radius: 0; color: var(--k2-ink, #ececf0); background: #2c2c30; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); cursor: pointer; }
  .k2-zoom.k2-zr button:hover { background: #3a3a3e; color: #fff; }
  .k2-zwheel { position: relative; width: 64px; height: 14px; overflow: hidden; cursor: ew-resize; background: #1b1b1e; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); touch-action: none; }
  .k2-zwheel i { position: absolute; inset: 1px; background: repeating-linear-gradient(90deg, rgba(236,236,240,.75) 0 1px, transparent 1px 6px); background-position-x: var(--zx, 0px); }
  .k2-zwheel::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, #1b1b1e, transparent 30%, transparent 70%, #1b1b1e); }
  .k2-zr-on .k2-zwheel i { background-image: repeating-linear-gradient(90deg, #E4FF3A 0 1px, transparent 1px 6px); }`;
  document.head.append(css);
  const box = document.createElement("span"); box.className = "k2-zoom" + (OLD ? "" : " k2-zr");
  box.addEventListener("mousedown", (e) => e.stopPropagation());
  const mk = (txt, f, tip) => { const b = document.createElement("button"); b.dataset.zoom = f > 1 ? "in" : "out"; b.textContent = txt; b.title = tip;
    b.onclick = (e) => { e.stopPropagation(); zoomAt(f); }; return b; };
  if (WHEEL) {
    const w = document.createElement("span"); w.className = "k2-zwheel"; w.title = "Drag to zoom: right = closer, left = wider. Double-click = fit the song";
    const st = document.createElement("i"); w.append(st); box.append(w);
    const STEP = 6;                 // px between stripes = one tick
    let ac = null, lastTick = 0, x0 = 0, off = 0, acc = 0;
    const tick = (up) => {          // a tiny dry click, a bit higher going in
      if (window.KT2_ZOOM_TICK_OFF) return;
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === "suspended") ac.resume();
        const t = ac.currentTime; if (t - lastTick < 0.018) return; lastTick = t;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "square"; o.frequency.value = up ? 2400 : 1800;
        g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
        o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.02);
      } catch (e) {}
    };
    w.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      w.setPointerCapture(e.pointerId); x0 = e.clientX; acc = 0; box.classList.add("k2-zr-on");
      const mid = () => { const r = $("scroll").getBoundingClientRect(); return r.left + (r.width + (typeof HEAD_W === "number" ? HEAD_W : 0)) / 2; };
      const move = (ev) => {
        const dx = ev.clientX - x0; x0 = ev.clientX; if (!dx) return;
        off += dx; st.style.setProperty("--zx", off + "px");
        zoomAt(Math.pow(1.012, dx), mid());
        acc += dx;
        while (Math.abs(acc) >= STEP) { tick(acc > 0); acc -= Math.sign(acc) * STEP; }
      };
      const up = () => { box.classList.remove("k2-zr-on"); w.removeEventListener("pointermove", move); w.removeEventListener("pointerup", up); w.removeEventListener("pointercancel", up); };
      w.addEventListener("pointermove", move); w.addEventListener("pointerup", up); w.addEventListener("pointercancel", up);
    });
    w.addEventListener("dblclick", (e) => { e.stopPropagation(); const f = document.getElementById("zoom-fit"); if (f) f.click(); });
  } else {
    box.append(mk("\u2212", 1 / 1.3, "Zoom out (pinch, Cmd + scroll, or Cmd -)"), mk("+", 1.3, "Zoom in (pinch, Cmd + scroll, or Cmd +)"));
  }
  if (OLD) {
    const put = () => { const add = document.querySelector("body > .k2-secbtns .k2-secnew"); if (!add) return false; if (box.parentNode !== add.parentNode) add.before(box); return true; };
    if (!put()) { const t = setInterval(() => { if (put()) clearInterval(t); }, 300); setTimeout(() => clearInterval(t), 30000); }
    setInterval(put, 2000);
  } else {
    // pinned over the right end of the bar-number row, whatever the scroll (like the parts buttons above it)
    document.body.append(box);
    const place = () => {
      const ru = document.getElementById("ruler"), sc = document.getElementById("scroll");
      if (!ru || !sc) return;
      const r = ru.getBoundingClientRect(), rs = sc.getBoundingClientRect();
      const show = r.height > 0 && !(window.ui && ui.home) && !html.classList.contains("k2-mix") && !html.classList.contains("k2-rec");
      box.style.display = show ? "" : "none";
      if (show) { box.style.top = r.top + r.height / 2 + "px"; box.style.left = rs.right - 12 + "px"; }
    };
    place(); window.addEventListener("resize", place); setInterval(place, 400);
  }
  window.KT2Zoom = { box };
})();

// TOP STRIP GLASS (Eman, 11 Nov 23:06): with a background picture the strip under the top bar (song parts +
// bar numbers) strobed, a dark band blinking on and off. The strip is as wide as the whole song (thousands of
// px) and blurred what's behind it with backdrop-filter while the playhead and markers inside it redraw every
// frame; Chrome re-blurs such a wide scrolling layer in pieces and the pieces don't always match. Now the strip
// itself is see-through and a window-sized glass pane sits behind it (fixed, like the top bar, which never
// flickered) with the same blur, tint and grain. KT2_TOPSTRIP_OLD = the old blur on the strip itself.
// Still blinked in v344 (Eman, 11 Nov 23:51), so the blur itself is the problem: now the strip has NO live blur at
// all, just a dark tint + grain over the picture (which is already blurred by the background's own Blur slider).
// KT2_TOPSTRIP_GLASS = the v344 glass pane, KT2_TOPSTRIP_OLD = the original blur on the strip.
(function topStripGlass() {
  if (window.KT2_TOPSTRIP_OLD) return;
  if (!window.KT2_TOPSTRIP_GLASS) {
    const st = document.createElement("style"); st.id = "k2-topglass-css";
    st.textContent = `.kt2 body:is(.look-image, .look-color) .toprow { background-color: rgba(8, 8, 10, var(--k2-strip-tint, 0.62)); background-image: var(--k2-grain); -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }`;
    document.head.append(st);
    return;
  }
  const LOOK = "body:is(.look-image, .look-color)";
  const css = `.kt2 ${LOOK} .toprow { background-color: transparent; background-image: none; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
.k2-topglass { position: fixed; z-index: 8; pointer-events: none; display: none; background-color: rgba(8, 8, 10, 0.62); background-image: var(--k2-grain);
  -webkit-backdrop-filter: blur(26px) saturate(1.8); backdrop-filter: blur(26px) saturate(1.8); }
.kt2 ${LOOK} .k2-topglass.on { display: block; }
body:has(#iw:not([hidden]), .tm-host) .k2-topglass { -webkit-backdrop-filter: none; backdrop-filter: none; }`;
  const st = document.createElement("style"); st.id = "k2-topglass-css"; st.textContent = css; document.head.append(st);
  const glass = document.createElement("div"); glass.className = "k2-topglass"; glass.setAttribute("aria-hidden", "true");
  let last = "";
  function place() {
    const tr = document.getElementById("toprow"), sc = document.getElementById("scroll");
    if (!glass.isConnected && sc && sc.parentNode) sc.parentNode.insertBefore(glass, sc);   // same z as the strip, painted just before it
    const r = tr && tr.getBoundingClientRect(), rs = sc && sc.getBoundingClientRect();
    const show = !!(r && rs && r.height > 0 && rs.width > 0 && !(window.ui && ui.home));
    let sig = "off";
    if (show) {
      const left = Math.max(r.left, rs.left), right = Math.min(r.right, rs.left + sc.clientWidth);
      sig = `${Math.round(r.top)},${Math.round(left)},${Math.max(0, Math.round(right - left))},${Math.round(r.height)}`;
    }
    if (sig === last) return;
    last = sig;
    glass.classList.toggle("on", show);
    if (!show) return;
    const [t, l, w, h] = sig.split(",");
    Object.assign(glass.style, { top: t + "px", left: l + "px", width: w + "px", height: h + "px" });
  }
  const start = () => {
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, { capture: true, passive: true });
    if (window.ResizeObserver) { const ro = new ResizeObserver(place); ["toprow", "scroll"].forEach((id) => { const n = document.getElementById(id); if (n) ro.observe(n); }); }
    setInterval(place, 300);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.KT2TopGlass = { place };
})();

// SOLID BARS ON PICTURES (Eman, 12 Nov 00:12): with a background PICTURE the top bar, the strip under it
// (song parts + bar numbers) and the footer keep the default dark solid colours instead of see-through
// glass; only the grid shows the picture. Colour looks are unchanged. KT2_BARS_GLASS_OLD = the glass bars.
(function solidBarsOnPictures() {
  if (window.KT2_BARS_GLASS_OLD) return;
  const L = "html.kt2 body.look-image";
  const st = document.createElement("style"); st.id = "k2-solidbars-css";
  st.textContent = `${L} .top { background: #141416; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
${L} .toprow { background-color: #1a1a1c !important; background-image: var(--k2-grain) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
${L} .rack { background: #151517; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
${L} .k2-side { background: #141416; }
${L} .k2-topglass { display: none !important; }
html.kt2:not(.k2-no-lead) body.look-image #scroll { background: linear-gradient(#141416, #141416) left top / 6px 100% no-repeat local; }`;
  (document.head || document.documentElement).append(st);
})();

// EDGE TO EDGE (Eman, 12 Nov 00:14): with a picture or colour behind the song, the song area's own scrollbars
// left a strip of bare background on the right (beside the bar numbers too) and above the footer, where the grid
// stopped short. Those scrollbars are hidden there now (wheel/trackpad and the zoom strip still scroll), so the
// grid runs to the right edge and down to the footer. No picture: unchanged. KT2_SCROLLBARS_OLD = the scrollbars back.
(function edgeToEdge() {
  if (window.KT2_SCROLLBARS_OLD) return;
  const st = document.createElement("style"); st.id = "k2-edge-css";
  st.textContent = `html.kt2 body:is(.look-image, .look-color) #scroll { scrollbar-width: none; }
html.kt2 body:is(.look-image, .look-color) #scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }`;
  (document.head || document.documentElement).append(st);
})();

// NO PULL PAST THE TOP (Eman, 12 Nov 00:42): a trackpad pull down (or a fling) at the top of the song, or past
// any other edge, let the Mac rubber-band the whole song area, so a strip of bare background opened above the
// SECTIONS row. The song area and the page now stop dead at their edges instead (also stops a sideways swipe at
// bar 1 from going "back" a page). Any look. KT2_OVERSCROLL_OLD = the rubber band back.
(function noOverscroll() {
  if (window.KT2_OVERSCROLL_OLD) return;
  const st = document.createElement("style"); st.id = "k2-overscroll-css";
  st.textContent = `html.kt2, html.kt2 body, html.kt2 #scroll { overscroll-behavior: none; }`;
  (document.head || document.documentElement).append(st);
  // the page itself never scrolls: if anything (a focus jump, scrollIntoView) moves it, put it straight back
  const zero = (el) => { if (el && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; } };
  const back = (e) => { const t = e.target; if (t === document || t === document.documentElement || t === document.body) { zero(document.scrollingElement); zero(document.documentElement); zero(document.body); } };
  document.addEventListener("scroll", back, { capture: true, passive: true });
})();

// DARKER GREY (Eman, 12 Nov 01:09): "make the UX overall a bit darker grey, even darker than this". The default
// dark look (no picture, no colour) goes about a third darker: the song grid and empty lanes, the strip with the
// song parts + bar numbers, the top bar, the footer and its tab list, the mixer and pop-ups. Grid lines and the
// 4-bar bands get a touch more white so they read just as clearly on the darker grey. Picture / colour / light
// looks are unchanged. KT2_GREY_OLD = the old lighter grey.
(function darkerGrey() {
  if (window.KT2_GREY_OLD) return;
  const D = "html.kt2 body.look-dark";
  const st = document.createElement("style"); st.id = "k2-darkgrey-css";
  st.textContent = `html.kt2:has(> body.look-dark) { background: #121214; }
${D} { --k2-bg: #121214; --k2-panel: #1e1e21; --bg: #121214; --panel: #121214; --pop: #1b1b1e; --head: #161618;
  --grid-major: rgba(255, 255, 255, 0.085); --grid-minor: rgba(255, 255, 255, 0.032); --grid-band: rgba(0, 0, 0, 0.22);
  background: #121214; }
${D} .top { background: #0d0d0f; }
${D} .toprow { background-color: #111113; }
${D} .rack { background: rgba(12, 12, 14, 0.96); }
${D} .k2-side { background: #0d0d0f; }
${D} .k2-tab:not(.on):not(:hover) { background: #151517; }
${D} .L4 .mixv { background: #121214; }`;
  (document.head || document.documentElement).append(st);
  // the lane grid is drawn once and cached; draw it again with the new line colours
  try { if (typeof setGrid === "function") requestAnimationFrame(() => setGrid()); } catch (e) { /* fine */ }
})();
