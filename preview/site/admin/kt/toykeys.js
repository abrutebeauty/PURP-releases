// TOY KEYS window (Eman, 7 Nov 2026): the simple keys instrument you own from the start.
// Big preset tiles (CLEAN / DIRTY), four faders (TONE DIRT SPACE WOBBLE) and a keyboard.
// The sound is playground/toy-keys.js (or the app's engine), reached through the same commands as
// TOY MACHINE: toyMachineGetPreset / toyMachineSetPreset / toyMachineSetMacro / toyMachineNote /
// toyMachineAudition / toyMachineMeter. So quests and undo see TOY KEYS the way they see TOY MACHINE.
//   window.ToyKeysUI.open(host, { preset, title, api, onClose }) -> { close, setPreset }
//   openToyKeys(p, into, wanted) opens it for a lane's plugin (like openToyMachine in app.js).
// window.TK_ONLY_PRESETS = ["Classic EP", ...] limits the tiles (quests).
// Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const list = () => {
    const all = (window.ToyKeys && ToyKeys.PRESETS) || [];
    const only = window.TK_ONLY_PRESETS;
    return Array.isArray(only) && only.length ? all.filter((p) => only.includes(p.name)) : all;
  };
  // a small drawing per sound family, square lines like the rest of KILLTOY
  const GLYPH = {
    grand: '<path d="M3 20V8c0-3 3-5 6-5h2c3 0 4 2 5 4l2 3c1 2 3 3 3 6v4z"/><path d="M3 16h18"/>',
    tine: '<path d="M4 6h16M4 10h16M4 14h16"/><path d="M4 18h16" stroke-dasharray="2 2"/>',
    reed: '<path d="M4 18 L8 6 L12 18 L16 6 L20 18"/>',
    organ: '<path d="M5 20V9M9 20V5M13 20V7M17 20V4M21 20V10M3 20h20"/>',
    clav: '<path d="M3 12h3l2-6 3 12 2-9 2 5h6"/>',
    bells: '<path d="M12 4v2M7 17c0-6 1-10 5-10s5 4 5 10zM5 17h14M11 20h2"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square">${GLYPH[k] || GLYPH.grand}</svg>`;
  const FADERS = ["TONE", "DIRT", "SPACE", "WOBBLE"];
  // QWERTY like TOY MACHINE: a w s e d f t g y h u j k o l p ; = C..E', z / x = octave
  const KEYS = "awsedftgyhujkolp;";

  function open(host, opts) {
    const api = opts.api || {};
    let preset = JSON.parse(JSON.stringify(opts.preset || (window.ToyKeys && ToyKeys.preset(ToyKeys.DEFAULT)) || {}));
    const root = h("div", "tk-root");
    root.tabIndex = 0;
    root.style.setProperty("--tk-hue", preset.hue || 270);
    // ---- top bar
    const top = h("div", "tk-top");
    const brand = h("div", "tk-brand");
    brand.innerHTML = '<span class="tk-word">TOY<b>KEYS</b></span>';
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
      for (const grp of ["CLEAN", "DIRTY"]) {
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
      box.addEventListener("dblclick", () => { const base = window.ToyKeys && ToyKeys.preset(preset.name); set(base && base.macros[i] ? base.macros[i].value : 0.5, true); if (api.commit) api.commit(preset); });
      box.addEventListener("wheel", (e) => { e.preventDefault(); set(preset.macros[i].value - e.deltaY * 0.0015, true); }, { passive: false });
      faders.append(f);
      return { set };
    });
    // while the song plays, the faders follow their automation lines (host: showAutomation, like TOY MACHINE); display only
    let autoShow = {};
    const paintFaders = () => fz.forEach((f, i) => { const a = autoShow["macro." + i]; if (a) f.set(a.v, false, true); else f.set(preset.macros && preset.macros[i] ? preset.macros[i].value : 0.5, false); });
    main.append(tiles, faders);
    // ---- keyboard
    const kb = h("div", "tk-kb");
    const octBox = h("div", "tk-oct"), om = h("button", null, "-"), ov = h("b"), op = h("button", null, "+");
    octBox.append(om, ov, op);
    const keys = h("div", "tk-keys");
    kb.append(octBox, keys);
    let base = 48;
    const held = new Map();   // pitch -> source
    const keyEls = new Map();
    const paintKeys = () => {
      keys.innerHTML = ""; keyEls.clear();
      ov.textContent = "C" + (base / 12 - 1);
      for (let n = base; n < base + 29; n++) {
        const black = [1, 3, 6, 8, 10].includes(n % 12);
        const k = h("div", "tk-key" + (black ? " b" : ""));
        k.dataset.p = n;
        if (n % 12 === 0) k.append(h("small", null, "C" + (n / 12 - 1)));
        keyEls.set(n, k);
        keys.append(k);
      }
      for (const p of held.keys()) { const k = keyEls.get(p); if (k) k.classList.add("on"); }
    };
    const down = (p, vel = 100, src = "m") => {
      if (held.has(p)) return;
      held.set(p, src);
      const k = keyEls.get(p); if (k) k.classList.add("on");
      api.noteOn && api.noteOn(p, vel);
    };
    const up = (p) => {
      if (!held.has(p)) return;
      held.delete(p);
      const k = keyEls.get(p); if (k) k.classList.remove("on");
      api.noteOff && api.noteOff(p);
    };
    let mouseNote = null;
    keys.addEventListener("pointerdown", (e) => {
      const k = e.target.closest(".tk-key"); if (!k) return;
      e.preventDefault(); keys.setPointerCapture(e.pointerId);
      const r = k.getBoundingClientRect(), vel = Math.round(60 + 67 * clamp((e.clientY - r.top) / r.height));
      mouseNote = +k.dataset.p; down(mouseNote, vel);
    });
    keys.addEventListener("pointermove", (e) => {
      if (mouseNote == null) return;
      const k = document.elementFromPoint(e.clientX, e.clientY), kk = k && k.closest && k.closest(".tk-key");
      if (kk && +kk.dataset.p !== mouseNote) { up(mouseNote); mouseNote = +kk.dataset.p; down(mouseNote, 96); }
    });
    const mouseUp = () => { if (mouseNote != null) { up(mouseNote); mouseNote = null; } };
    keys.addEventListener("pointerup", mouseUp); keys.addEventListener("pointercancel", mouseUp);
    om.onclick = () => { base = Math.max(24, base - 12); paintKeys(); };
    op.onclick = () => { base = Math.min(84, base + 12); paintKeys(); };
    root.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const c = e.key.toLowerCase();
      if (c === "z" || c === "x") { e.preventDefault(); if (!e.repeat) (c === "z" ? om : op).click(); return; }
      const i = KEYS.indexOf(c);
      if (i < 0) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) down(base + 12 + i, 100, "k" + c);
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
      const p = window.ToyKeys && ToyKeys.preset(n);
      if (!p) return;
      preset = p;
      root.style.setProperty("--tk-hue", p.hue || 270);
      name.textContent = p.name;
      for (const t of tiles.querySelectorAll(".tk-tile")) t.classList.toggle("on", t.dataset.name === p.name);
      paintFaders();
      if (api.setPreset) api.setPreset(p);
      if (hear && api.audition) api.audition(p);
    }

    paintTiles(); paintFaders(); paintKeys();
    root.append(top, main, kb);
    host.append(root);
    if (window.ToyKeys) for (const p of list()) ToyKeys.prefetch(p.name);
    return {
      root,
      showAutomation(map) { const next = map || {}; if (JSON.stringify(next) === JSON.stringify(autoShow)) return; autoShow = next; paintFaders(); },
      autoChanged() {},
      close() { cancelAnimationFrame(raf); for (const p of [...held.keys()]) up(p); root.remove(); },
      setPreset(p) { if (!p) return; preset = JSON.parse(JSON.stringify(p)); name.textContent = p.name || ""; root.style.setProperty("--tk-hue", p.hue || 270); for (const t of tiles.querySelectorAll(".tk-tile")) t.classList.toggle("on", t.dataset.name === p.name); paintFaders(); },
      topRight: right,
    };
  }

  // A lane's TOY KEYS: like openToyMachine in app.js (it shares tmWin, so closeToyMachine closes it).
  async function openToyKeys(p, into, wanted = () => true) {
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
  window.openToyKeys = openToyKeys;
  window.ToyKeysUI = { open, version: 1 };
})();
