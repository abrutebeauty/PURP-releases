// TOY GTR window (Eman, 13 Nov 2026): the guitar. Same frame as TOY KEYS (ui/toykeys.js): big preset tiles
// (ACOUSTIC / ELECTRIC / DIRTY), four faders (TONE DRIVE SPACE MOTION), four switches for how it's played
// (PALM off/auto/on, RIFF, STRUM, DOUBLE) and a fretboard to play it on (6 strings, frets 0-15).
// The sound is playground/toy-gtr.js, reached through the same commands as TOY MACHINE / TOY KEYS.
//   window.ToyGtrUI.open(host, { preset, api, onClose }) -> { close, setPreset }
//   openToyGtr(p, into, wanted) opens it for a lane's plugin.
// Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const list = () => {
    const all = (window.ToyGtr && ToyGtr.PRESETS) || [];
    const only = window.TG_ONLY_PRESETS;
    return Array.isArray(only) && only.length ? all.filter((p) => only.includes(p.name)) : all;
  };
  // a small drawing per sound family, square lines like the rest of KILLTOY
  const GLYPH = {
    acoustic: '<circle cx="12" cy="14" r="5"/><path d="M12 9V2M10 2h4M7 14c-3 0-4 2-4 4s2 4 5 3M17 14c3 0 4 2 4 4s-2 4-5 3"/>',
    electric: '<path d="M12 2v9M10 2h4M8 11h8l1 5-3 6h-4l-3-6z"/><path d="M10 15h4"/>',
    solid: '<path d="M12 2v10M10 2h4M7 12l3-1h4l4 3-2 3 1 4H7l1-4-2-2z"/>',
    gretsch: '<path d="M12 2v8M10 2h4M6 13c0-2 3-3 6-3s6 1 6 3-1 3-1 4 2 2 1 4-4 1-6 1-5 0-6-1 1-3 1-4-1-2-1-4z"/><path d="M9 15l1 2M15 15l-1 2"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square">${GLYPH[k] || GLYPH.acoustic}</svg>`;
  const FADERS = ["TONE", "DRIVE", "SPACE", "MOTION"];
  // QWERTY like TOY KEYS: a w s e d f t g y h u j k o l p ; = a run of notes, z / x = octave
  const KEYS = "awsedftgyhujkolp;";
  // the fretboard: standard tuning, high E on top like a tab
  const STRINGS = [64, 59, 55, 50, 45, 40], FRETS = 16;
  const SWITCHES = [
    { id: "palm", label: "PALM", vals: ["off", "auto", "on"], show: (v) => (v || "off").toUpperCase() },
    { id: "riff", label: "RIFF", vals: [0, 1], show: (v) => (v ? "ON" : "OFF") },
    { id: "strum", label: "STRUM", vals: [0, 14, 26], show: (v) => (!v ? "OFF" : v < 20 ? "FAST" : "SLOW") },
    { id: "dbl", label: "DOUBLE", vals: [0, 1], show: (v) => (v ? "ON" : "OFF") },
  ];

  function open(host, opts) {
    const api = opts.api || {};
    let preset = JSON.parse(JSON.stringify(opts.preset || (window.ToyGtr && ToyGtr.preset(ToyGtr.DEFAULT)) || {}));
    const root = h("div", "tk-root tg-root");
    root.tabIndex = 0;
    root.style.setProperty("--tk-hue", preset.hue || 270);
    // ---- top bar
    const top = h("div", "tk-top");
    const brand = h("div", "tk-brand");
    brand.innerHTML = '<span class="tk-word">TOY<b>GTR</b></span>';
    const name = h("div", "tk-name", preset.name || "");
    const right = h("div", "tk-topright");
    const x = h("button", "tk-x"); x.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M3 3l10 10M13 3L3 13"/></svg>';
    x.title = "Close"; x.onclick = () => opts.onClose && opts.onClose();
    right.append(x);
    top.append(brand, name, right);
    // ---- presets
    const main = h("div", "tk-main");
    const tiles = h("div", "tk-tiles");
    const paintTiles = () => {
      tiles.innerHTML = "";
      for (const grp of ["ACOUSTIC", "ELECTRIC", "DIRTY"]) {
        const ps = list().filter((p) => p.group === grp);
        if (!ps.length) continue;
        const g = h("div", "tk-grp" + (grp === "DIRTY" ? " dirty" : ""));
        g.append(h("div", "tk-grplabel", grp));
        const grid = h("div", "tk-grid");
        for (const p of ps) {
          const b = h("button", "tk-tile");
          b.dataset.name = p.name;
          b.style.setProperty("--th", p.hue || 270);
          b.innerHTML = svg(p.model) + "<span></span>";
          b.lastChild.textContent = p.name.toUpperCase();
          b.classList.toggle("on", p.name === preset.name);
          b.onclick = () => pick(p.name, true);
          grid.append(b);
        }
        g.append(grid);
        tiles.append(g);
      }
    };
    // ---- faders
    const faders = h("div", "tk-faders");
    const fz = FADERS.map((label, i) => {
      const f = h("div", "tk-fader");
      const box = h("div", "tk-fbox"), fill = h("i", "tk-ffill"), num = h("div", "tk-fnum");
      box.append(fill);
      f.append(num, box, h("div", "tk-flabel", label));
      // AUTOMATION (9 Nov overnight test: TOY KEYS had no A at all, so its faders could never get a line).
      // The small A under each fader, like TOY MACHINE's: a line for it under the pattern (param "macro.<i>",
      // which the song engine already plays: setMacro). TK_AUTO_OFF = no A buttons (old).
      if (!window.TK_AUTO_OFF && typeof opts.onAutomate === "function") {
        const ab = h("button", "tm-abtn tk-abtn", "A");
        ab.title = "Automate " + label + ": a line for it appears under the pattern";
        ab.dataset.autoParams = "macro." + i;
        ab.addEventListener("pointerdown", (e) => e.stopPropagation());
        ab.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); opts.onAutomate({ param: "macro." + i, label, value: preset.macros && preset.macros[i] ? preset.macros[i].value : 0.5, direct: true }, e); });
        f.append(ab);
      }
      const set = (v, send, showOnly) => {
        v = clamp(v);
        fill.style.height = (v * 100).toFixed(1) + "%";
        num.textContent = String(Math.round(v * 100));
        if (showOnly) return;
        if (!preset.macros) preset.macros = [];
        if (!preset.macros[i]) preset.macros[i] = { name: label, value: v };
        preset.macros[i].value = v;
        if (send && api.setMacro) api.setMacro(i, v);
      };
      let y0 = 0, v0 = 0;
      box.addEventListener("pointerdown", (e) => {
        e.preventDefault(); box.setPointerCapture(e.pointerId);
        const r = box.getBoundingClientRect();
        if (e.shiftKey || e.altKey) { y0 = e.clientY; v0 = preset.macros[i].value; }
        else { y0 = e.clientY; v0 = clamp(1 - (e.clientY - r.top) / r.height); set(v0, true); }
        f.classList.add("drag");
        const mv = (ev) => set(v0 + (y0 - ev.clientY) / r.height, true);
        const up = () => { f.classList.remove("drag"); box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up); if (api.commit) api.commit(preset); };
        box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
      });
      box.addEventListener("dblclick", () => { const base = window.ToyGtr && ToyGtr.preset(preset.name); set(base && base.macros[i] ? base.macros[i].value : 0.5, true); if (api.commit) api.commit(preset); });
      box.addEventListener("wheel", (e) => { e.preventDefault(); set(preset.macros[i].value - e.deltaY * 0.0015, true); }, { passive: false });
      faders.append(f);
      return { set };
    });
    // while the song plays, the faders follow their automation lines (host: showAutomation, like TOY MACHINE); display only
    let autoShow = {};
    const paintFaders = () => fz.forEach((f, i) => { const a = autoShow["macro." + i]; if (a) f.set(a.v, false, true); else f.set(preset.macros && preset.macros[i] ? preset.macros[i].value : 0.5, false); });
    // ---- how it's played: four switches under the tiles (each click steps to the next value)
    const sws = h("div", "tg-sws");
    const swEls = SWITCHES.map((sw) => {
      const b = h("button", "tg-sw");
      b.innerHTML = "<small></small><b></b>";
      b.firstChild.textContent = sw.label;
      b.onclick = () => {
        const cur = preset[sw.id] == null ? sw.vals[0] : preset[sw.id];
        let i = sw.vals.findIndex((x) => x === cur);
        if (i < 0) i = sw.vals.findIndex((x) => typeof x === "number" && typeof cur === "number" && x >= cur);
        preset[sw.id] = sw.vals[(i + 1) % sw.vals.length];
        paintSws();
        if (api.setPreset) api.setPreset(preset);
        if (api.commit) api.commit(preset);
      };
      sws.append(b);
      return b;
    });
    const paintSws = () => SWITCHES.forEach((sw, i) => { const v = preset[sw.id], on = !!v && v !== "off"; swEls[i].lastChild.textContent = sw.show(v); swEls[i].classList.toggle("on", on); });
    const left = h("div", "tg-left");
    left.append(tiles, sws);
    main.append(left, faders);
    // ---- fretboard (in place of TOY KEYS' keyboard): click a fret to play it, drag across to play more
    const kb = h("div", "tk-kb tg-kb");
    const octBox = h("div", "tk-oct"), om = h("button", null, "-"), ov = h("b"), op = h("button", null, "+");
    octBox.append(om, ov, op);
    const keys = h("div", "tg-neck");
    kb.append(octBox, keys);
    let base = 48, capo = 0;
    const held = new Map();   // pitch -> source
    const keyEls = new Map();   // pitch -> [cells]
    const paintKeys = () => {
      keys.innerHTML = ""; keyEls.clear();
      ov.textContent = capo ? "+" + capo : "0";
      keys.style.setProperty("--frets", FRETS);
      for (let f = 0; f < FRETS; f++) { const m = h("i", "tg-fret" + ([3, 5, 7, 9, 15].includes(f) ? " dot" : f === 12 ? " dot2" : "")); m.style.gridColumn = String(f + 1); keys.append(m); }
      STRINGS.forEach((open, si) => {
        for (let f = 0; f < FRETS; f++) {
          const p = open + capo + f, k = h("div", "tk-key tg-cell" + (f === 0 ? " open" : ""));
          k.dataset.p = p; k.dataset.s = si;
          k.style.gridRow = String(si + 1); k.style.gridColumn = String(f + 1);
          k.style.setProperty("--sw", (1 + si * 0.35).toFixed(2) + "px");
          if (!keyEls.has(p)) keyEls.set(p, []);
          keyEls.get(p).push(k);
          keys.append(k);
        }
      });
      for (const p of held.keys()) for (const k of keyEls.get(p) || []) k.classList.add("on");
    };
    const lit = (p, on) => { for (const k of keyEls.get(p) || []) k.classList.toggle("on", on); };
    const down = (p, vel = 100, src = "m") => {
      if (held.has(p)) return;
      held.set(p, src);
      lit(p, true);
      api.noteOn && api.noteOn(p, vel);
    };
    const up = (p) => {
      if (!held.has(p)) return;
      held.delete(p);
      lit(p, false);
      api.noteOff && api.noteOff(p);
    };
    let mouseNote = null;
    keys.addEventListener("pointerdown", (e) => {
      const k = e.target.closest(".tk-key"); if (!k) return;
      e.preventDefault(); keys.setPointerCapture(e.pointerId);
      const r = k.getBoundingClientRect(), vel = Math.round(70 + 57 * clamp(1 - Math.abs((e.clientY - r.top) / r.height - 0.5) * 2));
      mouseNote = +k.dataset.p; down(mouseNote, vel);
    });
    keys.addEventListener("pointermove", (e) => {
      if (mouseNote == null) return;
      const k = document.elementFromPoint(e.clientX, e.clientY), kk = k && k.closest && k.closest(".tk-key");
      if (kk && +kk.dataset.p !== mouseNote) { up(mouseNote); mouseNote = +kk.dataset.p; down(mouseNote, 96); }
    });
    const mouseUp = () => { if (mouseNote != null) { up(mouseNote); mouseNote = null; } };
    keys.addEventListener("pointerup", mouseUp); keys.addEventListener("pointercancel", mouseUp);
    // - / + move a capo up the neck (0..7); z / x move the computer keys an octave
    om.onclick = () => { capo = Math.max(0, capo - 1); paintKeys(); };
    op.onclick = () => { capo = Math.min(7, capo + 1); paintKeys(); };
    root.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const c = e.key.toLowerCase();
      if (c === "z" || c === "x") { e.preventDefault(); if (!e.repeat) base = Math.max(36, Math.min(72, base + (c === "z" ? -12 : 12))); return; }
      const i = KEYS.indexOf(c);
      if (i < 0) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) down(base + i, 100, "k" + c);
    });
    root.addEventListener("keyup", (e) => {
      const c = e.key.toLowerCase(), i = KEYS.indexOf(c);
      if (i < 0) return;
      e.preventDefault();
      for (const [p, s] of held) if (s === "k" + c) up(p);
    });
    root.addEventListener("blur", () => { for (const p of [...held.keys()]) up(p); });

    // ---- the level light on the wordmark: it glows with what plays
    const lamp = h("i", "tk-lamp"); brand.append(lamp);
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const m = api.meter && api.meter();
      const pk = m && m.peak ? m.peak : 0, l = clamp((20 * Math.log10(Math.max(1e-5, pk)) + 48) / 44);
      lamp.style.opacity = (0.15 + 0.85 * l).toFixed(3);
    };
    raf = requestAnimationFrame(tick);

    function pick(n, hear) {
      const p = window.ToyGtr && ToyGtr.preset(n);
      if (!p) return;
      preset = p;
      root.style.setProperty("--tk-hue", p.hue || 270);
      name.textContent = p.name;
      for (const t of tiles.querySelectorAll(".tk-tile")) t.classList.toggle("on", t.dataset.name === p.name);
      paintFaders(); paintSws();
      if (api.setPreset) api.setPreset(p);
      if (hear && api.audition) api.audition(p);
    }

    paintTiles(); paintFaders(); paintSws(); paintKeys();
    root.append(top, main, kb);
    host.append(root);
    if (window.ToyGtr) { const seen = new Set(); for (const p of list()) if (!seen.has(p.model)) { seen.add(p.model); ToyGtr.prefetch(p.name); } }
    return {
      root,
      showAutomation(map) { const next = map || {}; if (JSON.stringify(next) === JSON.stringify(autoShow)) return; autoShow = next; paintFaders(); },
      autoChanged() {},
      close() { cancelAnimationFrame(raf); for (const p of [...held.keys()]) up(p); root.remove(); },
      setPreset(p) { if (!p) return; preset = JSON.parse(JSON.stringify(p)); name.textContent = p.name || ""; root.style.setProperty("--tk-hue", p.hue || 270); for (const t of tiles.querySelectorAll(".tk-tile")) t.classList.toggle("on", t.dataset.name === p.name); paintFaders(); paintSws(); },
      topRight: right,
    };
  }

  // A lane's TOY GTR: like openToyKeys (it shares tmWin, so closeToyMachine closes it).
  async function openToyGtr(p, into, wanted = () => true) {
    const pid = p.id;
    const got = await run("toyMachineGetPreset", { pluginId: pid });
    if (!got || got.error || !wanted()) return;
    if (typeof closeToyMachine === "function") closeToyMachine();
    const host = h("div", into ? "iw-tm" : "tm-host");
    if (!into) host.addEventListener("mousedown", (e) => { if (e.target === host) closeToyMachine(); });
    (into || document.body).append(host);
    const send = (cmd, args) => booth(cmd, { pluginId: pid, ...args });
    let lastMeter = null;
    const meterTimer = setInterval(async () => { const m = await send("toyMachineMeter", {}); if (m && m.ok) lastMeter = m; }, 50);
    const hit = typeof findPlugin === "function" ? findPlugin(pid) : null;
    const win = open(host, {
      preset: got.preset,
      title: hit ? hit.t.name : "",
      api: {
        setPreset: (preset) => run("toyMachineSetPreset", { pluginId: pid, preset }),
        setMacro: (index, value) => send("toyMachineSetMacro", { index, value }),
        commit: (preset) => run("toyMachineSetPreset", { pluginId: pid, preset }),
        noteOn: (pitch, velocity) => send("toyMachineNote", { pitch, velocity, on: true }),
        noteOff: (pitch) => send("toyMachineNote", { pitch, on: false }),
        audition: (preset) => booth("toyMachineAudition", { pluginId: pid, preset, pitch: 60 }),
        meter: () => lastMeter,
      },
      onClose: () => (into ? typeof tmWin !== "undefined" && tmWin && tmWin.pid === pid && closeLaneWindow() : closeToyMachine()),
      // the A under a fader: its line under the pattern (same path as TOY MACHINE's A, app.js automateNow)
      onAutomate: (info) => {
        const f = typeof findPlugin === "function" ? findPlugin(pid) : null;
        if (!f || !f.t || !ui.state.canAutomate || typeof automateNow !== "function") return;
        automateNow(f.t, [{ target: { type: "synth", param: info.param }, label: info.label, value: info.value }]);
      },
    });
    tmWin = { pid, host, win, meterTimer };   // eslint-disable-line no-global-assign
    if (typeof addPlayMode === "function") addPlayMode(win.topRight, pid);
    win.root.focus({ preventScroll: true });
  }
  window.openToyGtr = openToyGtr;
  window.ToyGtrUI = { open, version: 1 };
})();
