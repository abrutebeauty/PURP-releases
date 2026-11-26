// KILLTOY 2: the synth and effect picker (Eman, 5 Nov 01:45).
// A clean, visual chooser in the spirit of FL Studio's plugin picker: a real picture of every synth
// (or effect) pops in as a bubble, you pick one and press ADD (or double-click it), it flies forward
// with a bright new sound, and the synth opens. Drag the pictures to sort them; the order is kept for
// every project (localStorage kt2.pick.<kind>). Opens from: a double-clicked empty pattern's ADD
// INSTRUMENT, the INST tab's ADD INSTRUMENT, and the FX rack's Add effect.
// Parked switches: KT2_OLD_FXMENU = true (the old search list for effects), KT2_OLD_ADDMENU = true
// (the old stack menu in INST).
(function () {
  "use strict";
  const SYNTHS = [
    { key: "builtin:toykeys", name: "TOY KEYS", img: "pick/syn-toykeys.jpg", what: "piano, EP, organ, clav" },   // Eman, 7 Nov: the keys you own from the start
    { key: "builtin:toygtr", name: "TOY GTR", img: "pick/syn-toygtr.jpg", what: "real acoustic + electric guitar", off: () => window.KT2_TOYGTR_OFF || !window.ToyGtr },   // Eman, 13 Nov
    { key: "builtin:toymachine", name: "TOY MACHINE", img: "pick/syn-toymachine.jpg", what: "presets, macros, the disc", stack: true },
    { key: "builtin:blob", name: "BLOB", img: "pick/syn-blob.jpg", what: "a sound as a creature", stack: true },
    { key: "builtin:toydrums", name: "KILLDRUM", img: "pick/syn-killdrum.jpg", what: "drums and kits" },
    { key: "builtin:uw808", name: "u wanna 808", img: "pick/syn-uw808.jpg", what: "808 bass" },
    { key: "builtin:uwlead", name: "u wanna Lead", img: "pick/syn-uwlead.jpg", what: "square lead" },
    { key: "builtin:ktsynth", name: "KILLTOY Synth", img: "pick/syn-ktsynth.jpg", what: "simple synth" },
  ];
  // effects, sorted the way a mix usually goes: dynamics, then tone and dirt, pitch, space
  const EFFECTS = [
    { key: "builtin:ktscclip", name: "SC Clip", cat: "DYNAMICS", img: "pick/fx-ktscclip.jpg", what: "soft clipper, almost every lane" },
    { key: "builtin:ktloud", name: "Loud", cat: "DYNAMICS", img: "pick/fx-ktloud.jpg", what: "loud without going over" },
    { key: "builtin:ktpunch", name: "Punch", cat: "DYNAMICS", img: "pick/fx-ktpunch.jpg", what: "more hit at the start" },
    { key: "builtin:ktsquash", name: "Squash", cat: "DYNAMICS", img: "pick/fx-ktsquash.jpg", what: "3-band squeeze" },
    { key: "builtin:ktside", name: "KILLCHAIN", cat: "DYNAMICS", img: "pick/fx-ktside.jpg", what: "sidechain: pick what pushes it down", off: () => window.KT2_KILLCHAIN_OFF || !window.KillChain },
    { key: "builtin:ktpump", name: "Pump", cat: "DYNAMICS", img: "pick/fx-ktpump.jpg", what: "ducks on the beat" },
    { key: "builtin:purpgate", name: "Vocal Gate", cat: "DYNAMICS", img: "pick/fx-purpgate.jpg", what: "cuts the noise between words" },
    { key: "builtin:ktcrush", name: "Crush", cat: "DIRT", img: "pick/fx-ktcrush.jpg", what: "bits and rate" },
    { key: "builtin:kttoytune", name: "TOYTUNE", cat: "PITCH", img: "pick/fx-ktsnaptune.jpg", what: "autotune, choir, vocoder, vocal FX", off: () => window.KT2_TOYTUNE_OFF || !window.ToyTuneUI },   // Eman, 16 Nov
    { key: "builtin:kttoyvox", name: "TOY VOX", cat: "PITCH", img: "pick/fx-ktsnaptune.jpg", what: "vocal chain, XY pad, presets", off: () => window.KT2_TOYVOX_OFF || !window.ToyVoxUI },   // Eman, 24 Nov
    { key: "builtin:ktsnaptune", name: "TUNR", cat: "PITCH", img: "pick/fx-ktsnaptune.jpg", what: "snaps a voice to the key" },
    { key: "builtin:ktchoppitch", name: "Chop Pitch", cat: "PITCH", img: "pick/fx-ktchoppitch.jpg", what: "pitch and formant" },
    { key: "builtin:ktspace", name: "Space", cat: "SPACE", img: "pick/fx-ktspace.jpg", what: "reverb" },
    { key: "builtin:kttexture", name: "Texture", cat: "SPACE", img: "pick/fx-kttexture.jpg", what: "granular clouds" },
  ];
  // CORE FX + KILLTIME (ui/kt2-corefx.js, Eman 16 Nov): EQ, comp, de-ess, filter, utility, drive, mod, the creative delay.
  // They sit with their category (a new TONE tab between DYNAMICS and DIRT). KT2_COREFX_OFF = the old list.
  const CATS = () => (window.KT2CoreFx && !KT2CoreFx.off() ? ["ALL", "DYNAMICS", "TONE", "DIRT", "PITCH", "SPACE"] : ["ALL", "DYNAMICS", "DIRT", "PITCH", "SPACE"]);
  const withCore = (base) => {
    const core = window.KT2CoreFx ? KT2CoreFx.pickerItems() : [];
    if (!core.length) return base;
    const out = [];
    for (const c of CATS().slice(1)) out.push(...base.filter((x) => x.cat === c), ...core.filter((x) => x.cat === c));
    return out.concat(base.filter((x) => !out.includes(x)));
  };
  const LIST = { synth: SYNTHS, get fx() { return withCore(EFFECTS); } };
  const KEY = (kind) => "kt2.pick." + kind;
  const ordered = (kind) => {
    const all = LIST[kind].filter((x) => !(x.off && x.off()));
    let o = [];
    try { o = JSON.parse(localStorage.getItem(KEY(kind)) || "[]"); } catch (e) { /* fine */ }
    const by = new Map(all.map((x) => [x.key, x]));
    const out = o.map((k) => by.get(k)).filter(Boolean);
    // a new one (not in the saved order yet) goes after the last one of its category, not at the very end
    for (const x of all) if (!out.includes(x)) {
      let at = -1;
      if (x.cat) out.forEach((y, i) => { if (y.cat === x.cat) at = i; });
      if (at >= 0 && x.core) out.splice(at + 1, 0, x); else out.push(x);
    }
    return out;
  };
  const saveOrder = (kind, keys) => { try { localStorage.setItem(KEY(kind), JSON.stringify(keys)); } catch (e) { /* fine */ } };
  const reduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const H = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---- sound: soft bubble blips as the pictures pop in, a tick on select, and a new bright
  // "power-up" for the pick (a rising major-ninth bell arpeggio with a shimmer)
  let ac = null;
  const audio = () => {
    if (window.KT2Juice && KT2Juice.soundOn && !KT2Juice.soundOn()) return null;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac; } catch (e) { return null; }
  };
  function note(f, dur, type, vol, at = 0, f2 = null) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function shimmer(at, dur, vol) {
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + at;
    s.buffer = b; f.type = "highpass"; f.frequency.value = 7000; g.gain.value = vol;
    s.connect(f).connect(g).connect(a.destination); s.start(t);
  }
  // in key (Eman, 7 Nov): every note here follows the project key (KT2Key in playground.js): the
  // bubbles climb its scale, the pick chord is built on its root (minor 9 in a minor key); the
  // pop sweep and the shimmer stay. No key or KT2_SFX_KEY_OLD = the old pitches
  const KK = () => (window.KT2Key && window.KT2Key.on() ? window.KT2Key : null);
  const kr = (ref) => (KK() ? KK().ratio(ref) : 1);
  const SND = {
    bubble: (i) => { if (!KK()) return note(520 + i * 46, 0.09, "sine", 0.05, 0, 900 + i * 60); const f = KK().degree(523, i); note(f, 0.09, "sine", 0.05, 0, f * 1.73); },
    tick: () => { const k = kr(1500); note(1500 * k, 0.05, "triangle", 0.035); note(2250 * k, 0.04, "sine", 0.02, 0.02); },
    pop: () => note(300, 0.08, "sine", 0.04, 0, 140),
    open: () => { const k = kr(180); note(180 * k, 0.25, "sine", 0.05, 0, 360 * k); shimmer(0.02, 0.35, 0.03); },
    pick: () => {   // C E G B D: up and bright, then a sparkle on top (in key: the key's root, minor 9 in minor)
      const k = kr(523.25), m = KK() && KK().minor();
      [523.25, m ? 622.25 : 659.25, 783.99, m ? 932.33 : 987.77, 1174.66].forEach((f, i) => { f *= k; note(f, 0.55 - i * 0.05, "triangle", 0.06, i * 0.055); note(f * 2, 0.4, "sine", 0.025, i * 0.055 + 0.01); });
      note(130.8 * k, 0.5, "sine", 0.09, 0, 196 * k); shimmer(0.22, 0.6, 0.045); note(2093 * k, 0.7, "sine", 0.03, 0.3);
    },
  };

  // ---- the picker
  let open = null, lastPress = null;
  addEventListener("pointerdown", (e) => { if (!(e.target.closest && e.target.closest(".k2p"))) lastPress = { x: e.clientX, y: e.clientY }; }, true);
  function show(kind, opts = {}) {
    if (open) open.close(true);
    const o = H("div", "k2p"), panel = H("div", "k2p-panel"), head = H("div", "k2p-head"), grid = H("div", "k2p-grid"), foot = H("div", "k2p-foot");
    o.dataset.kind = kind;
    // no panel any more: the tiles float right on the frosted page (Eman, 5 Nov 16:38). KT2_PICK_PANEL brings the panel back.
    if (!window.KT2_PICK_PANEL) o.classList.add("float");
    // plain (Eman, 6 Nov site comment): square corners, no coloured glow, quicker; KT2_PICK_GLOW = true = the glowing bubbles
    const plain = !window.KT2_PICK_GLOW;
    if (plain) o.classList.add("plain");
    const title = H("b", "k2p-title", opts.title || (kind === "fx" ? "ADD AN EFFECT" : "ADD AN INSTRUMENT"));
    const x = H("button", "k2p-x"); x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>'; x.title = "Close (Esc)";
    head.append(title);
    let cat = "ALL";
    if (kind === "fx") {
      const cats = H("div", "k2p-cats");
      for (const c of CATS()) {
        const b = H("button", c === cat ? "on" : "", c);
        b.onclick = () => { cat = c; cats.querySelectorAll("button").forEach((y) => y.classList.toggle("on", y === b)); filter(); SND.tick(); };
        cats.append(b);
      }
      head.append(cats);
    }
    head.append(x);
    const selName = H("span", "k2p-sel"), go = H("button", "k2p-go", "ADD");
    go.disabled = true;
    foot.append(selName, go);
    panel.append(head, grid, foot);
    o.append(panel);
    document.body.append(o);
    let sel = null, done = false;
    const items = ordered(kind);
    const tiles = items.map((it, i) => {
      const t = H("button", "k2p-tile");
      t.dataset.key = it.key;
      t.style.setProperty("--gc", ["#8b6cff", "#ff3b5c", "#c46bff", "#5c7bff", "#ff5cc8", "#7a5cff"][i % 6]);
      t.style.setProperty("--bob", (i % 4) * -0.7 + "s");
      const why = opts.disabled && opts.disabled(it);
      if (why) { t.classList.add("off"); t.title = why; }
      if (opts.current && opts.current === it.key) t.classList.add("cur");
      const pic = H("span", "k2p-pic"), img = H("img");
      img.src = it.img; img.alt = ""; img.draggable = false; img.loading = "eager";
      pic.append(img);
      t.append(pic, H("b", null, it.name), H("small", null, it.what || ""));
      t.onclick = (e) => { if (t.dataset.dragged) { delete t.dataset.dragged; return; } if (why) { SND.pop(); t.animate && t.animate([{ translate: "0 0" }, { translate: "-5px 0" }, { translate: "4px 0" }, { translate: "0 0" }], { duration: 220 }); return; } pick(t, it); };
      t.ondblclick = () => { if (!why) confirm(); };
      t.addEventListener("pointerdown", (e) => dragStart(e, t));
      grid.append(t);
      return t;
    });
    function filter() {
      tiles.forEach((t, i) => {
        const it = items[i], on = cat === "ALL" || it.cat === cat;
        if (on && t.hidden) { t.hidden = false; if (!reduce()) t.animate([{ scale: "0.4", opacity: 0 }, { scale: "1.06", opacity: 1 }, { scale: "1" }], { duration: 280, easing: "cubic-bezier(.2,1.5,.4,1)" }); }
        else if (!on) t.hidden = true;
      });
    }
    function pick(t, it) {
      if (sel === t) return;
      tiles.forEach((y) => y.classList.toggle("sel", y === t));
      sel = t; selName.textContent = it.name; go.disabled = false;
      SND.tick();
      if (!reduce()) t.animate([{ scale: "1" }, { scale: "1.07" }, { scale: "0.98" }, { scale: "1" }], { duration: 300, easing: "ease-out" });
    }
    function confirm() {
      if (!sel || done) return;
      done = true;
      const it = items[tiles.indexOf(sel)];
      SND.pick();
      if (!reduce()) {
        const r = sel.getBoundingClientRect(), cx = innerWidth / 2 - (r.left + r.width / 2), cy = innerHeight / 2 - (r.top + r.height / 2);
        tiles.forEach((y, i) => { if (y !== sel && !y.hidden) y.animate([{ scale: "1", opacity: 1 }, { scale: "1.12", opacity: 1, offset: 0.3 }, { scale: "0", opacity: 0 }], { duration: 300, delay: Math.random() * 120, easing: "ease-in", fill: "forwards" }); });
        sel.style.zIndex = "3";
        sel.animate([{ transform: "none" }, { transform: `translate(${cx}px, ${cy}px) scale(1.5)`, offset: 0.55 }, { transform: `translate(${cx}px, ${cy}px) scale(1.8)`, opacity: 0 }], { duration: 620, easing: "cubic-bezier(.3,.9,.3,1)", fill: "forwards" });
        o.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 640, fill: "forwards" });
      }
      setTimeout(() => { close(true); if (opts.onPick) opts.onPick(it.key, it); }, reduce() ? 0 : 520);
    }
    go.onclick = confirm;
    const close = (quiet) => {
      if (!o.isConnected) return;
      document.removeEventListener("keydown", onKey, true);
      if (quiet || reduce()) { o.remove(); open = null; return; }
      o.classList.add("out"); setTimeout(() => o.remove(), 200); open = null;
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "Enter" && sel) { e.preventDefault(); e.stopPropagation(); confirm(); }
    };
    document.addEventListener("keydown", onKey, true);
    x.onclick = () => close();
    o.addEventListener("pointerdown", (e) => { if (e.target === o) close(); });

    // ---- the bubbles pop in from the middle out, each with a soft blip
    SND.open();
    // The tiles come out of the pattern (or wherever you clicked) as glowing line drawings that
    // draw themselves, glide to their spots and then fill in with the picture (Eman, 6 Nov 01:25).
    // KT2_PICK_POP = true brings back the old bubble pop.
    const from = opts.from || lastPress;
    if (!reduce() && o.classList.contains("float") && !window.KT2_PICK_POP) requestAnimationFrame(() => {
      const ox = from ? from.x : innerWidth / 2, oy = from ? from.y : innerHeight;
      o.animate([{ opacity: 0 }, { opacity: 1 }], { duration: plain ? 200 : 420, easing: "ease-out" });
      // plain: quicker, and the picture comes in together with its box (no empty boxes first)
      const DUR = plain ? 480 : 900, STEP = plain ? 30 : 70, D0 = plain ? 0 : 60, HOLD = plain ? 0.08 : 0.45;
      tiles.forEach((t, i) => {
        const r = t.getBoundingClientRect(), pic = t.querySelector(".k2p-pic"), img = pic && pic.querySelector("img");
        const dx = ox - (r.left + r.width / 2), dy = oy - (r.top + r.height / 2), d = D0 + i * STEP;
        const ease = "cubic-bezier(.22,1,.36,1)";
        t.animate([{ transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "none", opacity: 1 }], { duration: DUR, delay: d, easing: ease, fill: "backwards" });
        if (pic) {
          const w = pic.offsetWidth, h = pic.offsetHeight, rad = plain ? 0 : 26;
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("class", "k2p-line"); svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
          const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          for (const [k, v] of Object.entries({ x: 1, y: 1, width: w - 2, height: h - 2, rx: rad, ry: rad, pathLength: 100 })) rect.setAttribute(k, v);
          svg.append(rect); pic.append(svg);
          rect.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: DUR, delay: d + (plain ? 0 : 80), easing: "cubic-bezier(.5,0,.2,1)", fill: "both" });
          svg.animate([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: plain ? 800 : 1500, delay: d, easing: "ease-in-out", fill: "both" }).onfinish = () => svg.remove();
          // the picture and its glow wait for the line, then fade in softly
          pic.animate([{ backgroundColor: "transparent", boxShadow: "none" }, { backgroundColor: "transparent", boxShadow: "none", offset: HOLD }, {}], { duration: plain ? DUR : 1300, delay: d, easing: "ease-out", fill: "backwards" });
          if (img) img.animate([{ opacity: 0, filter: "blur(6px) brightness(1.6)" }, { opacity: 0, filter: "blur(6px) brightness(1.6)", offset: HOLD }, { opacity: 1, filter: "blur(0) brightness(1)" }], { duration: plain ? DUR : 1300, delay: d, easing: "ease-out", fill: "backwards" });
        }
        for (const lab of t.querySelectorAll("b, small")) lab.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 0, offset: plain ? 0.2 : 0.5 }, { opacity: 1, transform: "none" }], { duration: plain ? DUR : 1100, delay: d, easing: "ease-out", fill: "backwards" });
        setTimeout(() => SND.bubble(i), d + (plain ? 80 : 200));
      });
    });
    else if (!reduce()) requestAnimationFrame(() => {
      const g = grid.getBoundingClientRect(), mx = g.left + g.width / 2, my = g.top + g.height / 2;
      const ds = tiles.map((t) => { const r = t.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - mx, r.top + r.height / 2 - my); });
      const mxd = Math.max(1, ...ds);
      panel.animate([{ opacity: 0, scale: "0.96" }, { opacity: 1, scale: "1" }], { duration: 220, easing: "ease-out" });
      tiles.forEach((t, i) => {
        const d = 40 + (ds[i] / mxd) * 300;
        t.animate([{ scale: "0.15", opacity: 0, filter: "blur(8px)", borderRadius: "50%" }, { scale: "1.1", opacity: 1, filter: "blur(0)", borderRadius: "40%", offset: 0.6 }, { scale: "0.97", borderRadius: "6%", offset: 0.82 }, { scale: "1", borderRadius: "2px" }],
          { duration: 520, delay: d, easing: "cubic-bezier(.2,1.2,.4,1)", fill: "backwards" });
        setTimeout(() => SND.bubble(i), d + 120);
      });
    });

    // ---- drag a picture to sort them; the order is kept for every project
    function dragStart(e, t) {
      if (e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY;
      let ghost = null, moved = false;
      const move = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        if (!moved) {
          moved = true; t.dataset.dragged = "1";
          const r = t.getBoundingClientRect();
          ghost = t.cloneNode(true); ghost.classList.add("k2p-ghost");
          Object.assign(ghost.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
          ghost.dataset.ox = sx - r.left; ghost.dataset.oy = sy - r.top;
          o.append(ghost); t.classList.add("hole"); SND.pop();
        }
        ghost.style.left = ev.clientX - ghost.dataset.ox + "px"; ghost.style.top = ev.clientY - ghost.dataset.oy + "px";
        const over = document.elementsFromPoint(ev.clientX, ev.clientY).map((n) => n.closest && n.closest(".k2p-tile")).find((n) => n && n !== t && n !== ghost && grid.contains(n));
        if (!over) return;
        const before = tiles.map((y) => [y, y.getBoundingClientRect()]);
        const r = over.getBoundingClientRect(), after = ev.clientX > r.left + r.width / 2;
        grid.insertBefore(t, after ? over.nextSibling : over);
        for (const [y, a] of before) {   // the others slide over (FLIP)
          const b = y.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
          if ((dx || dy) && y !== t && !reduce()) y.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 200, easing: "ease-out" });
        }
        SND.tick();
      };
      const up = () => {
        removeEventListener("pointermove", move, true); removeEventListener("pointerup", up, true);
        if (!moved) return;
        t.classList.remove("hole");
        const r = t.getBoundingClientRect();
        if (ghost) { const g = ghost; g.animate([{ left: g.style.left, top: g.style.top }, { left: r.left + "px", top: r.top + "px" }], { duration: 160, easing: "ease-out" }).onfinish = () => g.remove(); }
        const keys = [...grid.querySelectorAll(".k2p-tile")].map((y) => y.dataset.key);
        items.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
        tiles.sort((a, b) => keys.indexOf(a.dataset.key) - keys.indexOf(b.dataset.key));
        saveOrder(kind, keys);
        setTimeout(() => { delete t.dataset.dragged; }, 50);
      };
      addEventListener("pointermove", move, true); addEventListener("pointerup", up, true);
    }
    open = { close };
    return open;
  }

  // ---- what picking does
  const synthOf = (t) => t && [...(t.plugins || []), ...(t.clips || []).flatMap((c) => c.plugins || [])].find((x) => x.instrument);
  async function setInstrumentFor(trackId, key, clipId) {
    const r = await run("setInstrument", { trackId, key });
    if (r && r.error) return toast(r.error, true);
    try { const fresh = await booth("getState", {}); if (fresh && fresh.tracks) ui.state = fresh; } catch (e) { /* fine */ }
    ui.laneSig = ""; render();
    const t = ui.state.tracks.find((x) => x.id === trackId), p = synthOf(t);
    if (clipId) ui.selectedClip = clipId;
    // the synth appears: its window pops open with a little bounce
    if (p && typeof openPluginWindow === "function") {
      await openPluginWindow(p);
      const card = document.getElementById("iw-card");
      if (card && card.animate && !reduce()) card.animate([{ scale: "0.86", opacity: 0, filter: "blur(6px)" }, { scale: "1.02", opacity: 1, filter: "blur(0)", offset: 0.7 }, { scale: "1" }], { duration: 420, easing: "cubic-bezier(.2,1.2,.4,1)" });
    }
  }
  const pickSynth = (t, c, from) => show("synth", { current: null, from, onPick: (key) => setInstrumentFor(t.id, key, c && c.id) });

  // ---- ADD INSTRUMENT inside a pattern that has no synth yet
  const _renderClip = window.renderClip;
  if (typeof _renderClip === "function") {
    window.renderClip = renderClip = function (c, t, color) {
      const node = _renderClip.apply(this, arguments);
      // a pattern that already has notes plays its synth (you hear it), so no + LOAD on top of the notes
      // (Eman, 10 Nov 21:11: "why the load button when they're already loaded"). KT2_LOAD_FLAG_ONLY = old.
      const heard = !window.KT2_LOAD_FLAG_ONLY && c && ((c.notes || []).length || Object.values(c.stack || {}).some((x) => x && x.length));
      if (t && t.noInst && !heard && c && c.kind === "midi" && node && node.append) {
        node.classList.add("k2p-noinst");
        // plain words in the pattern's own colour, no button, no + (Eman, 6 Nov 01:14);
        // KT2_CLIPADD_BUTTON = true brings back the old "+ ADD INSTRUMENT" button;
        // now a filled pill in the pattern's colour, "+ LOAD" (Eman picked 05 PILL BUTTON, 6 Nov 02:32);
        // KT2_CLIPADD_TEXT = true brings back the plain LOAD INSTRUMENT words
        const old = !!window.KT2_CLIPADD_BUTTON, txt = !!window.KT2_CLIPADD_TEXT;
        const b = H("button", old ? "k2p-clipadd" : txt ? "k2p-clipadd k2p-cliptext" : "k2p-clipadd k2p-clippill");
        if (old) b.innerHTML = "<b>+</b><span>ADD INSTRUMENT</span>";
        else if (txt) { b.innerHTML = "<span>LOAD</span> <span>INSTRUMENT</span>"; b.title = "Pick the instrument that plays this pattern"; }
        else { b.textContent = "+ LOAD"; b.title = "Load the instrument that plays this pattern"; }
        for (const ev of ["pointerdown", "mousedown", "dblclick"]) b.addEventListener(ev, (e) => e.stopPropagation());
        b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); const r = node.getBoundingClientRect(); pickSynth(t, c, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); };
        node.append(b);
      } else if (t && c && c.kind === "midi" && node && node.append && !(c.notes || []).length && !Object.values(c.stack || {}).some((x) => x && x.length) && !window.KT2_CLIPADD_BUTTON && !c.cmp) {
        // an empty pattern that already has its instrument: the same pill, LOAD BEAT on KILLDRUM
        // (opens it on its beats), ADD NOTES on a synth (opens MIDI) (Eman, 6 Nov 02:47)
        const kd = typeof isKillDrumLane === "function" ? isKillDrumLane(t) : /killdrum|toy ?drums/i.test(t.instrument || "");
        node.classList.add("k2p-noinst");
        const b = H("button", "k2p-clipadd k2p-clippill");
        b.textContent = kd ? "+ LOAD BEAT" : "+ ADD NOTES";
        b.title = kd ? "Open KILLDRUM and pick or make a beat" : "Open the notes";
        for (const ev of ["pointerdown", "mousedown", "dblclick"]) b.addEventListener(ev, (e) => e.stopPropagation());
        b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); ui.selectedClip = c.id;
          if (kd && typeof openLaneSynth === "function") openLaneSynth(t.id);
          // ADD NOTES opens the MIDI pop-up on this pattern (Eman, 6 Nov 21:58); KT2_ADDNOTES_TAB = old (bottom MIDI tab)
          else if (!window.KT2_ADDNOTES_TAB && typeof openLaneWindow === "function") { render(); openLaneWindow({ t, clip: c, view: "midi" }); }
          else if (window.KT2 && KT2.openTab) { render(); KT2.openTab("midi"); } };
        node.append(b);
      }
      return node;
    };
  }

  // ---- the FX rack's Add effect opens the picker (the old search list: KT2_OLD_FXMENU = true)
  const _showAddDevice = window.showAddDevice;
  if (typeof _showAddDevice === "function") {
    window.showAddDevice = showAddDevice = function (anchor) {
      if (window.KT2_OLD_FXMENU) return _showAddDevice.apply(this, arguments);
      show("fx", { onPick: (key) => addDevice(key) });
    };
  }

  window.KT2Pick = { show, synth: (opts) => show("synth", opts), fx: (opts) => show("fx", opts), pickSynth, setInstrumentFor, SYNTHS, EFFECTS, sound: SND };
})();
