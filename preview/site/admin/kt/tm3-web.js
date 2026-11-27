// TOY MACHINE V3 in the KILLTOY 2 DAW (27 Nov): a web engine on TOY MACHINE's lanes, built the same way as tm2-web.js.
// A V3 preset is { engine: "tm3", name, data } where data is a .toymachine JSON (format_version 3, settings: {...}).
//   TM3Web.load(ctx).create({ preset }) -> same calls as ToyMachine's create() (noteOn/Off, schedule, requeue, flush,
//   setPreset, meter...). The wasm loads in the background; calls made before it is ready are kept and played once it is.
//   TM3Web.presets() -> Promise of the list [{ name, group, data } | { name, group, pack }] (pack 1 = tm3-presets.json; packs 2..5 load on pick).
//   window.KT2_TM3_OFF = true hides the tile and keeps the page exactly as before (this file then does nothing).
// This file also holds the lane window (openToyMachine3): preset list, prev/next, a small keyboard.
(function () {
  if (window.KT2_TM3_OFF) return;
  const DEFAULT = "Init Saw";
  const isTm3 = (p) => !!p && p.engine === "tm3";
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const INIT = { engine: "tm3", name: DEFAULT, data: { format: "TOY MACHINE", format_version: 3, preset_name: DEFAULT,
    settings: { osc_1_on: 1, osc_1_random_phase: 0, osc_1_unison_voices: 3, osc_1_unison_detune: 3, filter_1_on: 1, filter_1_cutoff: 100, reverb_on: 1, reverb_dry_wet: 0.12 } } };
  const preset = (name) => (name && typeof name === "object" && isTm3(name) ? copy(name) : !name || name === DEFAULT ? copy(INIT) : null);

  // Pack 1 (tm3-presets.json) loads with the window. The other presets sit in packs 2..5 and load when picked
  // (KT2_TM3_ONEPACK_OLD = true shows only pack 1, as before). PACK_URL maps a pack to where the live page serves it.
  const PACK_URL = { 1: "tm3-presets.json", 2: "tm3-presets-2.json", 3: "tm3-presets-3.json", 4: "tm3-presets-4.json", 5: "tm3-presets-5.json" };
  const MORE = window.KT2_TM3_ONEPACK_OLD ? [] : [["808 - GRAVE KNOCK","BASS + 808",2],["BASS - CRUSHED FUR","BASS + 808",2],["BASS - UNDERTOW","BASS + 808",2],["CHORD - FIFTH WOUND","CHORDS",2],["CHORD - NIGHT FIFTHS","CHORDS",2],["CHORD - NIGHT FIFTHS HIT","CHORDS",2],["CHORD - NIGHT FIFTHS OPEN HIT","CHORDS",2],["CHORD - SPIRE STACK","CHORDS",2],["BELL - THORN CHIME","KEYS + BELLS",2],["LEAD - BLACK TOYBOX","LEADS",2],["LEAD - DRIFT GHOST","LEADS",2],["LEAD - SHATTERED SQUARE","LEADS",2],["LEAD - SLIDE OMEN","LEADS",2],["Adrian Synth","MORE PUSHED (not in a folder yet)",2],["AnalougeStyleHipHopSynth","MORE PUSHED (not in a folder yet)",2],["BNYX BASS","MORE PUSHED (not in a folder yet)",2],["FOMDJ - F1LTHY WIP","MORE PUSHED (not in a folder yet)",2],["Playboi Carti - Don't Miss PAD","MORE PUSHED (not in a folder yet)",2],["Playboi WACKY","MORE PUSHED (not in a folder yet)",2],["SICKO","MORE PUSHED (not in a folder yet)",2],["TIRED-SNTH","MORE PUSHED (not in a folder yet)",2],["Travis Scott - FE!N 808","MORE PUSHED (not in a folder yet)",2],["opium lead","MORE PUSHED (not in a folder yet)",2],["preset 1","MORE PUSHED (not in a folder yet)",2],["DamnSine-ish","OPIUM CORE",2],["G funk lead","OPIUM CORE",3],["GIVENCHY LD 2","OPIUM CORE",3],["I Wish","OPIUM CORE",3],["LONG TIME","OPIUM CORE",3],["Lead - Miss The Rage","OPIUM CORE",3],["Pad - 2024 (Playboi Carti)","OPIUM CORE",3],["Pluck - Stop Breathing","OPIUM CORE",3],["SY Fury","OPIUM CORE",3],["Synth - 2024 (Playboi Carti)","OPIUM CORE",3],["TUFF808v1","OPIUM CORE",3],["opium chords shit","OPIUM CORE",3],["preset 2","OPIUM CORE",3],["preset 3","OPIUM CORE",3],["preset 4","OPIUM CORE",3],["preset 5 (dry)","OPIUM CORE",3],["PAD - CRYPT GLOW","PADS + VOX",3],["PAD - RED MIST CHOIR","PADS + VOX",3],["LD - Unison Rage Lead (S1 rebui","SUBSCRIBER OPIUM",3],["LD PLUTO","SUBSCRIBER OPIUM",3],["LD Rage (JH) (S1 rebuild)","SUBSCRIBER OPIUM",3],["MISS THE RAGE LEAD","SUBSCRIBER OPIUM",3],["StarBell","SUBSCRIBER OPIUM",4],["Yeat Synth","SUBSCRIBER OPIUM",4],["KEYS - CRYPT VEIL","SUBSCRIBER TRAVIS",4],["Keys - Travis (S1 rebuild)","SUBSCRIBER TRAVIS",4],["LD_FE!N","SUBSCRIBER TRAVIS",4],["My Eyes Keys","SUBSCRIBER TRAVIS",4],["Sub Bass","SUBSCRIBER TRAVIS",4],["Travis X Metro Synth","SUBSCRIBER TRAVIS",4],["ARP - CIRCUIT VAMP","SYNTHS",4],["PAD - BLACK CATHEDRAL","TEXTURES",4],["Good Vibes","TRAVIS CORE",4],["PD-DEAN","TRAVIS CORE",4],["travis808","TRAVIS CORE",5]];   // [name, group, pack]
  const packs = {};
  const pack = (n) => (packs[n] || (packs[n] = fetch(PACK_URL[n]).then((r) => { if (!r.ok) throw new Error("no presets " + n); return r.json(); }).catch((e) => { delete packs[n]; console.warn("TOY MACHINE V3 presets did not load", e); return []; })));
  let list = null;
  const presets = () => (list || (list = pack(1).then((l) => { if (!l.length) { list = null; return []; } return l.concat(MORE.map(([name, group, p]) => ({ name, group, pack: p }))); })));
  // an entry from packs 2..5 has no data until its pack is fetched
  const fill = (e) => (e.data ? Promise.resolve(e) : pack(e.pack).then((l) => { const f = l.find((x) => x.name === e.name && x.group === e.group); if (f) e.data = f.data; return e; }));
  const fromEntry = (e) => ({ engine: "tm3", name: e.name, data: copy(e.data) });

  // ---------- engine ----------
  const apis = new WeakMap();
  function load(ctx) {
    if (apis.has(ctx)) return apis.get(ctx);
    let real = null;
    const ready = window.ToyMachine3 && ctx.audioWorklet
      ? window.ToyMachine3.load(ctx, "toy-machine-v3.wasm").then((a) => (real = a), (e) => { console.warn("TOY MACHINE V3 did not load", e); return null; })
      : Promise.resolve(null);
    function create(opts = {}) {
      const out = ctx.createGain();
      let s = null, dead = false, cur = isTm3(opts.preset) ? opts.preset : INIT;
      const queue = [];
      const make = (api) => {
        if (!api || s) return;
        s = api.create({ ...opts, preset: cur.data });
        s.output.connect(out);
        for (const [fn, args] of queue) if (s[fn]) s[fn](...args);
        queue.length = 0;
      };
      if (real) make(real); else ready.then(make);
      const call = (fn) => (...args) => {
        if (fn === "setPreset") { if (!isTm3(args[0])) return; cur = args[0]; args = [cur.data]; }
        if (s) return s[fn] && s[fn](...args);
        if (fn === "flush" || fn === "requeue") { for (let i = queue.length - 1; i >= 0; i--) if (queue[i][0] === "noteOn" || queue[i][0] === "schedule") queue.splice(i, 1); return; }
        queue.push([fn, args]);
      };
      const api = { output: out, isToyKeys: true, isTm3: true };   // isToyKeys: a web engine (playground.js keeps it apart from the TOY MACHINE wasm)
      for (const fn of ["setPreset", "setMacro", "setParam", "setPad", "setPadStar", "setSample", "setDropSample", "noteOn", "noteOff", "bend", "wheel", "schedule", "requeue", "flush", "sendTransport"]) api[fn] = call(fn);
      api.meter = () => (s ? s.meter() : { peak: 0, voices: 0, dice: null, arp: -1 });
      api.close = () => { dead = true; if (s) s.close(); out.disconnect(); };
      Object.defineProperty(api, "dead", { get: () => dead || (!!s && s.dead) });
      return api;
    }
    const a = { create, ready, preload: () => ready };
    apis.set(ctx, a);
    return a;
  }
  window.TM3Web = { load, preset, DEFAULT, PRESETS: [INIT], isTm3, presets, fill, version: 2 };

  // ---------- lane window ----------
  const CSS = `
.tm3w { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; background: #131218; color: #ecebf0; font: 12px/1.4 Inter, "Helvetica Neue", Arial, sans-serif; min-height: 100%; box-sizing: border-box; }
.tm-host > .tm3w { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(760px, calc(100vw - 32px)); box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
.tm3w .hd { display: flex; align-items: center; gap: 12px; }
.tm3w .logo { font: 800 22px/1 "Big Shoulders Display", "Arial Narrow", sans-serif; letter-spacing: 0.04em; }
.tm3w .logo i { font-style: normal; color: #E4FF3A; }
.tm3w .tag { font: 700 9px Inter, sans-serif; letter-spacing: 0.14em; color: #8d8a99; }
.tm3w .x { margin-left: auto; appearance: none; border: 0; background: #1f1d27; color: #8d8a99; font: 700 11px "JetBrains Mono", monospace; width: 26px; height: 26px; cursor: pointer; }
.tm3w .pr { display: flex; align-items: center; gap: 10px; background: #1a1922; padding: 14px 16px; }
.tm3w .pr .dot { width: 8px; height: 8px; border-radius: 50%; background: #E4FF3A; box-shadow: 0 0 8px rgba(228,255,58,0.35); flex: none; }
.tm3w .pr .nm { font: 800 26px/1 "Big Shoulders Display", "Arial Narrow", sans-serif; letter-spacing: 0.03em; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm3w .row { display: flex; gap: 6px; flex-wrap: wrap; }
.tm3w .b { appearance: none; border: 0; border-radius: 0; background: #1f1d27; color: #ecebf0; font: 700 10px Inter, sans-serif; letter-spacing: 0.12em; padding: 9px 14px; cursor: pointer; text-transform: uppercase; }
.tm3w .b.main { background: #E4FF3A; color: #131218; }
.tm3w .list { display: flex; flex-direction: column; max-height: 180px; overflow: auto; background: #1a1922; }
.tm3w .list .it { appearance: none; border: 0; background: none; color: #ecebf0; text-align: left; font: 600 11px Inter, sans-serif; padding: 7px 14px; cursor: pointer; display: flex; gap: 10px; }
.tm3w .list .it small { color: #8d8a99; font-weight: 500; margin-left: auto; }
.tm3w .list .it.on { background: #E4FF3A; color: #131218; }
.tm3w .list .it.on small { color: #131218; }
.tm3w .kb { position: relative; height: 64px; display: flex; user-select: none; touch-action: none; }
.tm3w .kb .w { flex: 1; background: #d9d6e0; margin-right: 1px; cursor: pointer; }
.tm3w .kb .w.on, .tm3w .kb .k.on { background: #E4FF3A; }
.tm3w .kb .k { position: absolute; top: 0; height: 60%; background: #0b0a0e; cursor: pointer; z-index: 1; }
`;
  const style = () => { if (document.getElementById("tm3w-css")) return; const s = document.createElement("style"); s.id = "tm3w-css"; s.textContent = CSS; document.head.append(s); };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  async function openToyMachine3(p, into, wanted = () => true) {
    if (window.TM3UI && !window.KT2_TM3_UI_OLD) return window.TM3UI.open(p, into, wanted);   // the real synth window (playground/tm3-ui.js); KT2_TM3_UI_OLD = true keeps this simple one
    const pid = p.id;
    const got = await run("toyMachineGetPreset", { pluginId: pid });
    if (!got || got.error || !wanted()) return;
    if (typeof closeToyMachine === "function") closeToyMachine();
    try { const D = window.purpPlaygroundDebug; if (D && D.ctx) load(D.ctx); } catch (e) { /* the engine loads on first sound instead */ }   // start the wasm download now, so the first note is not late
    style();
    const host = el("div", into ? "iw-tm" : "tm-host");
    if (!into) host.addEventListener("mousedown", (e) => { if (e.target === host) closeToyMachine(); });
    (into || document.body).append(host);
    const root = el("div", "tm3w"); root.tabIndex = 0; host.append(root);
    let preset = got.preset && isTm3(got.preset) ? got.preset : preset_(DEFAULT);
    function preset_(n) { return window.TM3Web.preset(n); }

    const hd = el("div", "hd"), logo = el("div", "logo"); logo.innerHTML = "TOY MACHINE <i>V3</i>";
    const x = el("button", "x", "X"); x.setAttribute("aria-label", "Close");
    x.onclick = () => (into ? typeof tmWin !== "undefined" && tmWin && tmWin.pid === pid && closeLaneWindow() : closeToyMachine());
    hd.append(logo, el("span", "tag", "PRESETS"), x);
    const pr = el("div", "pr"), nm = el("div", "nm");
    pr.append(el("span", "dot"), nm);
    const lst = el("div", "list");
    let entries = [];
    const show = () => { nm.textContent = preset.name || DEFAULT; lst.querySelectorAll(".it").forEach((b) => b.classList.toggle("on", b.dataset.name === preset.name)); };
    const setP = async (np) => { preset = np; show(); await run("toyMachineSetPreset", { pluginId: pid, preset: np }); };
    const setE = (e) => fill(e).then((f) => { if (f.data && wanted()) return setP(fromEntry(f)); });
    const pick = (i) => { if (!entries.length) return; const e = entries[(i + entries.length) % entries.length]; setE(e); };
    const idx = () => entries.findIndex((e) => e.name === preset.name);
    const row = el("div", "row");
    const bPrev = el("button", "b", "Prev"), bNext = el("button", "b main", "Next"), bInit = el("button", "b", DEFAULT);
    bPrev.onclick = () => pick(idx() - 1); bNext.onclick = () => pick(idx() + 1); bInit.onclick = () => setP(preset_(DEFAULT));
    row.append(bPrev, bNext, bInit);
    presets().then((l) => {
      if (!wanted()) return;
      entries = l;
      for (const e of l) { const b = el("button", "it", e.name); b.dataset.name = e.name; b.append(el("small", null, e.group || "")); b.onclick = () => setE(e); lst.append(b); }
      show();
    });
    show();

    // two octaves from C3 to try the sound
    const kb = el("div", "kb"), send = (cmd, args) => booth(cmd, { pluginId: pid, ...args });
    const LO = 48, WHITE = [0, 2, 4, 5, 7, 9, 11], whites = [];
    for (let n = LO; n < LO + 25; n++) if (WHITE.includes(n % 12)) whites.push(n);
    const keyEls = new Map();
    whites.forEach((n) => { const w = el("div", "w"); w.dataset.n = n; kb.append(w); keyEls.set(n, w); });
    const ww = 100 / whites.length;
    for (let n = LO; n < LO + 25; n++) if (!WHITE.includes(n % 12)) {
      const k = el("div", "k"); k.dataset.n = n; const left = whites.indexOf(n - 1); k.style.left = ((left + 1) * ww - ww * 0.3) + "%"; k.style.width = (ww * 0.6) + "%"; kb.append(k); keyEls.set(n, k);
    }
    let held = null;
    const up = () => { if (held == null) return; send("toyMachineNote", { pitch: held, on: false }); keyEls.get(held).classList.remove("on"); held = null; };
    kb.addEventListener("pointerdown", (e) => { const n = +(e.target.dataset && e.target.dataset.n); if (!n) return; up(); held = n; e.target.classList.add("on"); send("toyMachineNote", { pitch: n, velocity: 100, on: true }); });
    window.addEventListener("pointerup", up);

    root.append(hd, pr, row, lst, kb);
    tmWin = { pid, host, win: { root }, meterTimer: 0 };   // eslint-disable-line no-global-assign
    root.focus({ preventScroll: true });
  }
  window.openToyMachine3 = openToyMachine3;
})();
