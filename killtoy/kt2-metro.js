// KILLTOY 2: the metronome left of the clock (Eman, 6 Nov 02:56, redone 15:10). One square button with
// a dot in it: click = on / off (K does the same); while on and playing, the dot ticks with the beat
// (bigger on the 1). Right-click opens the settings (the wheel in its corner did, until 6 Nov 16:21): the click's SOUND (chips) and
// its RHYTHM (cards drawn as rows of dots, like the song cards). Hovering a sound or a rhythm plays a
// bar of it; clicking picks it. (Since 6 Nov 16:21: no sound on hover, a click picks it and plays one bar.) Both are kept in this browser.
// KT2_METRO_V1 = true brings back the first look (icon + sound name + list). Keep it ASCII-only.
"use strict";

(function () {
  if (!document.documentElement.classList.contains("kt2")) return;
  const NAMES = { muffled: "Muffled", wood: "Wood block", rim: "Rim", soft: "Soft beep", shaker: "Shaker", thump: "Low thump", tick: "Classic tick",
    clave: "Clave", sidestick: "Side stick", hat: "Hi-hat", pop: "Pop" };
  const V1 = !!window.KT2_METRO_V1;
  const ICON = '<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">'
    + '<path d="M7.2 2.8h5.6l3.2 14.4H4z"/><path d="M5.6 13.4h8.8"/><path d="M10 13.4l4.6-8.6"/><circle cx="14.9" cy="4.3" r="1.3" fill="currentColor"/></svg>';
  const GEAR = '<svg viewBox="0 0 16 16" width="9" height="9"><path fill="currentColor" d="M6.9 1h2.2l.4 1.8 1.3.6 1.6-1 1.6 1.6-1 1.6.6 1.3 1.8.4v2.2l-1.8.4-.6 1.3 1 1.6-1.6 1.6-1.6-1-1.3.6-.4 1.8H6.9l-.4-1.8-1.3-.6-1.6 1-1.6-1.6 1-1.6-.6-1.3L.6 9.1V6.9l1.8-.4.6-1.3-1-1.6 1.6-1.6 1.6 1 1.3-.6zM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z"/></svg>';
  // a pendulum with its weight, between two swing arcs (Eman's picture, 6 Nov 16:24): the pendulum swings to the beat
  const PEND = '<svg viewBox="0 0 24 22" width="20" height="18"><g class="k2m-trail">' + Array.from({ length: 9 }, (_, i) => '<line x1="12" y1="17" x2="12" y2="2.5" style="stroke:currentColor;stroke-width:' + (1.1 - i * 0.08).toFixed(2) + ';stroke-linecap:round;opacity:0"/>').join("") + '</g><g class="k2m-pend"><path d="M11.4 1.2h1.2v2.2h2.9l-.9 4.4h-1.5V17h-1.2V7.8H9.4l-.9-4.4h2.9z" style="fill:currentColor"/><rect x="11.55" y="4" width="0.9" height="2.6" style="fill:#1c1c20"/><circle cx="10" cy="4.9" r="0.45" style="fill:#1c1c20"/><circle cx="14" cy="4.9" r="0.45" style="fill:#1c1c20"/></g>'
    + (window.KT2_METRO_ARCS ? '<path class="k2m-arc" d="M7.6 6.2C4.6 7.6 2.4 10.6 1.6 14.6 3 11.6 5 9.2 7.7 7.6z" style="fill:currentColor"/><path class="k2m-arc" d="M16.4 6.2c3 1.4 5.2 4.4 6 8.4-1.4-3-3.4-5.4-6.1-7z" style="fill:currentColor"/>' : "")
    + '</svg>';
  // no side arcs now (Eman, 6 Nov 16:27; KT2_METRO_ARCS = back): the pendulum swings smoothly and leaves fading lines behind it
  const GHOSTS = 9;
  let box = null, btn = null, cap = null, dot = null, panel = null, info = null;

  function build() {
    const pos = document.getElementById("pos-time");
    if (!pos || !pos.parentElement) return false;
    box = document.createElement("div");
    box.className = "k2m" + (V1 ? "" : " k2m2");
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "k2m-on";
    if (V1) btn.innerHTML = ICON;
    else if (window.KT2_METRO_DOT) { dot = document.createElement("i"); dot.className = "k2m-dot"; btn.append(dot); }
    else { dot = document.createElement("i"); dot.className = "k2m-dot k2m-ico"; dot.innerHTML = PEND; btn.append(dot); }   // Eman's icon (6 Nov 16:24); KT2_METRO_DOT = the dot
    btn.onclick = (e) => { e.stopPropagation(); run("toggleClick").then(paint); };
    cap = document.createElement("button");
    cap.type = "button";
    if (V1) {
      cap.className = "k2m-snd";
      cap.innerHTML = '<span></span><svg viewBox="0 0 10 10" width="8" height="8"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
      cap.onclick = (e) => { e.stopPropagation(); menu(); };
      box.append(btn, cap);
    } else {
      cap.className = "k2m-gear"; cap.innerHTML = GEAR; cap.title = "Metronome sound and rhythm";
      cap.onclick = (e) => { e.stopPropagation(); togglePanel(); };
      // right-click the button for the menu; the little wheel is gone (Eman, 6 Nov 16:21; KT2_METRO_GEAR = wheel back)
      btn.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); togglePanel(); };
      const wrap = document.createElement("div"); wrap.className = "k2m-wrap";
      if (window.KT2_METRO_GEAR) wrap.append(btn, cap); else wrap.append(btn);
      box.append(wrap);
    }
    pos.before(box);   // left of the clock: the right side holds tempo and key
    return true;
  }

  // ---- V1: the plain list
  async function menu() {
    const r = await booth("getClickSounds", {}).catch(() => null);
    if (!r || !r.sounds) return;
    showMenu(cap, [{ heading: "CLICK SOUND" }, ...r.sounds.map((k) => ({
      label: NAMES[k] || k, on: k === r.sound,
      run: async () => { await run("setClickSound", { sound: k }); booth("previewClick", { sound: k }); paint(); },
    }))]);
  }

  // ---- the settings panel
  function closePanel() { if (panel) { panel.remove(); panel = null; removeEventListener("pointerdown", outside, true); } }
  function outside(e) { if (panel && !panel.contains(e.target) && !cap.contains(e.target) && !(e.button === 2 && btn.contains(e.target))) closePanel(); }
  let hoverT = 0;
  const hear = (args) => { clearTimeout(hoverT); hoverT = setTimeout(() => booth("previewClick", args).catch(() => {}), 120); };
  async function togglePanel() {
    if (panel) return closePanel();
    info = await booth("getClickSounds", {}).catch(() => null);
    if (!info || !info.sounds) return;
    panel = document.createElement("div");
    panel.className = "k2m-panel";
    const r = box.getBoundingClientRect();
    panel.style.left = Math.max(8, r.left - 20) + "px"; panel.style.top = r.bottom + 8 + "px";
    fill();
    document.body.append(panel);
    addEventListener("pointerdown", outside, true);
  }
  function fill() {
    const head = (t) => { const d = document.createElement("div"); d.className = "k2m-h"; d.textContent = t; return d; };
    const sounds = document.createElement("div"); sounds.className = "k2m-chips";
    for (const k of info.sounds) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "k2m-chip" + (k === info.sound ? " on" : "");
      b.textContent = NAMES[k] || k;
      if (window.KT2_METRO_HOVER) b.onpointerenter = () => hear({ sound: k, pattern: info.pattern });   // no sound on hover now (Eman, 6 Nov 16:21)
      b.onclick = async () => { booth("previewClick", { sound: k, pattern: info.pattern }).catch(() => {}); await run("setClickSound", { sound: k }); info.sound = k; redraw(); };
      sounds.append(b);
    }
    const grid = (list) => {
      const g = document.createElement("div"); g.className = "k2m-cards";
      for (const p of list) g.append(card(p));
      return g;
    };
    // two sides (Eman, 6 Nov 15:11): every sound on the left, the rhythms on the right
    const left = document.createElement("div"); left.className = "k2m-side k2m-left";
    left.append(head("SOUND"), sounds);
    // VOLUME, 100% by default, up to 300% (Eman, 6 Nov 16:26)
    const vol = document.createElement("div"); vol.className = "k2m-vol";
    const pct = Math.round((info.volume == null ? 1 : info.volume) * 100);
    vol.innerHTML = `<input type="range" min="0" max="300" step="5" value="${pct}"><span>${pct}%</span>`;
    const range = vol.querySelector("input"), lab = vol.querySelector("span");
    range.oninput = () => { lab.textContent = range.value + "%"; info.volume = range.value / 100; booth("setClickVolume", { volume: info.volume }).catch(() => {}); };
    range.onchange = () => booth("previewClick", { sound: info.sound, pattern: info.pattern }).catch(() => {});
    range.ondblclick = () => { range.value = 100; range.oninput(); };
    left.append(head("VOLUME"), vol);
    const right = document.createElement("div"); right.className = "k2m-side k2m-right";
    const G = [["basic", "BASIC"], ["theory", "FROM MUSIC THEORY"], ["groove", window.KT2_METRO_OLDGROOVE ? "WITH A GROOVE (QUIET HAT / SNARE)" : "WITH A GROOVE (QUIET BEEPS)"]];
    for (const [id, title] of G) { const list = info.patterns.filter((p) => (p.group || "basic") === id); if (list.length) right.append(head(title), grid(list)); }
    panel.replaceChildren(left, right);
  }
  const redraw = () => { if (panel) fill(); paint(); };
  // a rhythm as dots: the click row on top (the strong one acid), the hat and snare rows under it
  function card(p) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "k2m-card" + (p.id === info.pattern ? " on" : "");
    const t = document.createElement("b"); t.textContent = p.name; b.title = p.name;
    const W = 132, rows = [["c", p.c], ["h", p.h], ["s", p.s]].filter((x) => x[1]), H = 8 + rows.length * 9;
    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">';
    for (let i = 0; i < p.steps; i += p.steps / 4) svg += '<rect x="' + (2 + i * (W - 4) / p.steps).toFixed(1) + '" y="0" width="1" height="' + H + '" style="fill:rgba(255,255,255,0.1);stroke:none"/>';
    rows.forEach(([kind, str], ri) => {
      for (let i = 0; i < p.steps; i++) {
        const ch = str[i]; if (!ch || ch === ".") continue;
        const x = 2 + (i + 0.5) * (W - 4) / p.steps, y = 6 + ri * 9;
        const col = kind === "c" ? (ch === "A" ? "#E4FF3A" : "#c4b5ff") : kind === "h" ? "#8b6cff" : "#ff5f7a";
        const r = kind === "c" ? (ch === "A" ? 3 : ch === "o" ? 1.8 : 2.5) : 1.9;
        svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="' + r + '" style="fill:' + col + ';stroke:none"/>';
      }
    });
    svg += "</svg>";
    const art = document.createElement("span"); art.className = "k2m-dots"; art.innerHTML = svg;
    const sub = document.createElement("small");
    const meter = p.beats === 3 ? "3/4" : p.beats === 8 ? "2 bars" : p.steps === 12 ? "triplet feel" : "4/4";
    sub.textContent = [meter, p.h ? (window.KT2_METRO_OLDGROOVE ? "hat" : "hi beep") : "", p.s ? (window.KT2_METRO_OLDGROOVE ? "snare" : "low bip") : ""].filter(Boolean).join(" \u00b7 ");
    b.append(t, art, sub);
    if (window.KT2_METRO_HOVER) b.onpointerenter = () => hear({ sound: info.sound, pattern: p.id });
    b.onclick = async () => { booth("previewClick", { sound: info.sound, pattern: p.id }).catch(() => {}); await run("setClickPattern", { pattern: p.id }); info.pattern = p.id; redraw(); };
    return b;
  }

  async function paint() {
    if (!box) return;
    const on = !!(ui.state && ui.state.click);
    btn.classList.toggle("on", on);
    btn.title = (on ? "Metronome on (K). Click to turn it off" : "Metronome (K)") + ". Right-click for its sound and rhythm";
    if (V1) {
      const r = await booth("getClickSounds", {}).catch(() => null);
      const nm = r && (NAMES[r.sound] || r.sound);
      cap.querySelector("span").textContent = nm ? nm.toUpperCase() : "";
      cap.title = "The click's sound: " + (nm || "") + ". Click to pick another";
    }
  }

  // the dot ticks with the beat while it plays (the 1 of each bar a bit bigger)
  let lastBeat = -1;
  const base = () => (dot && dot.querySelector("svg") ? "k2m-dot k2m-ico" : "k2m-dot");
  // the swing: at each beat the pendulum is at one end, in between it glides (a cosine), and the trail
  // lines are where it was a moment ago, fading out
  let seenPos = -1, seenAt = 0;
  function swing(beatPos, live) {
    const pend = dot && dot.querySelector(".k2m-pend"), lines = dot && dot.querySelectorAll(".k2m-trail line");
    if (!pend) return;
    const A = 26, ang = (b) => A * Math.cos(Math.PI * b);
    pend.setAttribute("transform", live ? `rotate(${ang(beatPos).toFixed(2)} 12 17)` : "");
    lines.forEach((l, i) => {
      if (!live) { l.style.opacity = 0; return; }
      const back = (i + 1) * 0.05;
      l.setAttribute("transform", `rotate(${ang(beatPos - back).toFixed(2)} 12 17)`);
      l.style.opacity = (0.6 * (1 - i / GHOSTS)).toFixed(3);
    });
  }
  function tick() {
    requestAnimationFrame(tick);
    if (!dot || !btn.classList.contains("on")) { swing(0, false); if (dot && lastBeat !== -1) { lastBeat = -1; dot.className = base(); } return; }
    const tr = ui.transport || {};
    if (!tr.playing) { swing(0, false); seenPos = -1; if (lastBeat !== -1) { lastBeat = -1; dot.className = base(); } return; }
    const now = performance.now(), p0 = tr.position || 0;
    if (p0 !== seenPos) { seenPos = p0; seenAt = now; }
    const pos = p0 + Math.min(0.25, (now - seenAt) / 1000);   // between transport updates, keep gliding
    const bpm = (ui.state && ui.state.bpm) || 120;
    if (!window.KT2_METRO_ARCS) swing(pos * bpm / 60, true);
    const beat = Math.floor(p0 * bpm / 60 + 1e-3);
    if (beat === lastBeat) return;
    lastBeat = beat;
    dot.className = base();
    void dot.offsetWidth;   // restart the animation
    dot.className = base() + " " + (beat % 4 === 0 ? "k2m-one" : "k2m-beat") + (window.KT2_METRO_ARCS ? (beat % 2 ? " k2m-r" : " k2m-l") : "");
    dot.style.setProperty("--k2m-swing", Math.min(0.6, 50 / bpm) + "s");
  }
  if (!V1) requestAnimationFrame(tick);

  let last = null;
  setInterval(() => {
    if (!box || !box.isConnected) { if (!build()) return; last = null; }
    const on = !!(ui.state && ui.state.click);
    if (on !== last) { last = on; paint(); }
  }, 300);
})();
