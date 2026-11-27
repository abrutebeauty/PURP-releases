/* TOY MACHINE: the DROP ZONE page. Drop sounds onto the synth; each one becomes a point on a
   round field around the CORE (the preset's own sound):
     - left / right   = which part of the sound gets in: its lows .. full .. its highs
     - near the core  = melted into the synth (through its filter and envelope);
       out at the edge = on top, as itself
     - point size     = level (scroll on it, or the slider)
   On drop the analyser (toymachine-analyze.js) finds the pitch, so the C key plays a C and the
   sound is always in key. No clear pitch -> marked TEXTURE: it keeps its own sound on every key.
   CUSTOM on the core empties it and builds the core from the dropped sounds instead.

   The engine side is Source/dsp/toymachine/TmDrops.h (preset "drops", audio per slot through
   api.setDropSample(slot, { data, sampleRate })).

   window.ToyMachineDropZone.mount(pageEl, ctx) -> { render(), draw(dt), addFiles(files) }
   ctx: get() -> { full, orig }, push(), flush(), setPreset(p), call(fn, ...), toast(t, lines, good), audioCtx()
   Plain JS, no build step. ASCII only. */
(function () {
  "use strict";

  const MAX = 6;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = (m) => { const n = Math.round(m); return NOTE[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); };
  const COLORS = ["#b88cff", "#4fb2ff", "#38f5c2", "#ff8a2a", "#ff5ad1", "#9fe3ff"];
  const TEXTURE_COLOR = "#e4ff3a";
  const MODES = [["synth", "SYNTH", "Plays it as a synth: in key, stretched over the keys"], ["arp", "ARP", "Plays it as a pattern of notes or chops, in time"], ["stutter", "STUTTER", "Repeats the start of it in time"]];
  // the engine's patterns (TmDrops.h dropStep): steps as semitones, null = rest, "s<n>" = slice n
  const ARPS = [
    ["up", "Up", [0, 7, 12, 19, 0, 7, 12, 19]],
    ["down", "Down", [19, 12, 7, 0, 19, 12, 7, 0]],
    ["bounce", "Bounce", [0, 7, 12, 19, 12, 7, 0, 7]],
    ["octaves", "Octaves", [0, 12, 24, 12, 0, 12, 24, 12]],
    ["stab", "Chord stab", [0, null, 0, 0, null, 0, null, null]],
    ["chop", "Chop", ["s0", "s4", "s2", "s6", "s1", "s5", "s3", "s7"]],
    ["skip", "Skip", [0, null, 12, 7, null, 0, 19, null]],
    ["random", "Random", [7, 0, null, 19, "s3", 12, 0, "s6"]],
  ];
  // the shared ARP library (ui/toymachine-arps.js): after the 8 above, every library pattern can
  // drive a drop too (item.steps + item.libName; the engine plays them as root, fifth, octaves)
  const LIB = () => (window.ToyMachineArps ? window.ToyMachineArps.PATTERNS : []);
  const LIB_FILL = [0, 7, 12, 19];
  const libSemis = (steps) => (steps || []).slice(0, 8).map((st, k) => (st.n == null ? null : LIB_FILL[(st.n === "next" ? k : st.n) % 4] + 24 * Math.floor((st.n === "next" ? 0 : st.n) / 4) + 12 * (st.oct || 0)));
  const STUTTERS = [["straight", "Straight"], ["triplet", "Triplet"], ["roll", "Roll"]];
  const SPEEDS = [[-2, "SLOWER", "1/4"], [-1, "SLOW", "1/8"], [0, "NORMAL", "1/16"], [1, "FAST", "1/32"], [2, "FASTER", "1/64"]];
  // the core sound when CUSTOM starts with nothing pitched to build from: silent oscillators,
  // an open gate, so the dropped sounds play as they are
  const EMPTY_CORE = {
    format: "toymachine/1", name: "Custom", category: "Synths", tags: ["custom", "dropzone"],
    oscA: { on: false }, oscB: { on: false }, sub: { on: false }, noise: { on: false }, sampler: { on: false },
    filter: { on: false }, ampEnv: { a: 0.003, d: 0.1, s: 1, r: 0.3, curve: 0.5 },
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(cls, text, title) {
    const b = el("button", cls, text);
    b.type = "button";
    if (title) b.title = title;
    return b;
  }

  // ------------------------------------------------ geometry (pos is 0..1 in the field's square)
  const CORE_R = 0.17;   // of the field radius
  function polar(pos) { const dx = pos[0] - 0.5, dy = pos[1] - 0.5; return { dx, dy, d: Math.hypot(dx, dy) / 0.5 }; }
  function keepInField(pos) {
    let { dx, dy, d } = polar(pos);
    if (d < 1e-6) { dx = 0; dy = -1e-3; d = 2e-3; }
    const want = clamp(d, CORE_R + 0.06, 0.94);
    const k = want / d;
    return [0.5 + dx * k, 0.5 + dy * k];
  }
  /** Where a point sits -> what the engine plays. */
  function fromPos(pos) {
    const { dx, d } = polar(pos);
    return {
      tone: Math.round(clamp(dx / 0.4, -1, 1) * 1000) / 1000,
      melt: Math.round(clamp(1 - (d - (CORE_R + 0.06)) / (0.9 - CORE_R - 0.06)) * 1000) / 1000,
    };
  }
  const SPOTS = [270, 90, 235, 125, 305, 55];   // degrees, where new sounds land (0 = right, 90 = down)
  function spotFor(i, texture) {
    const a = (SPOTS[i % SPOTS.length] * Math.PI) / 180, d = texture ? 0.84 : 0.5;
    return keepInField([0.5 + Math.cos(a) * d * 0.5, 0.5 + Math.sin(a) * d * 0.5]);
  }
  function toneWords(t) {
    if (Math.abs(t) < 0.05) return "Full sound";
    return (t < 0 ? "Lows" : "Highs") + " " + Math.round(Math.abs(t) * 100) + "%";
  }
  function meltWords(m) {
    if (m > 0.85) return "Melted into the synth";
    if (m < 0.15) return "On top, as itself";
    return Math.round(m * 100) + "% melted in";
  }

  function peaksOf(data, n = 48) {
    const out = [], step = Math.max(1, Math.floor(data.length / n));
    let mx = 1e-6;
    for (let i = 0; i < n; i++) {
      let p = 0;
      for (let j = i * step, e = Math.min(data.length, j + step); j < e; j++) { const a = Math.abs(data[j]); if (a > p) p = a; }
      out.push(p); if (p > mx) mx = p;
    }
    return out.map((p) => Math.round((p / mx) * 100) / 100);
  }

  // ------------------------------------------------ styles (kept here so the page is one file)
  const CSS = `
.tm-dz { position: absolute; inset: 0; display: grid; grid-template-columns: 270px minmax(0, 1fr) 290px; }
.tm-dzfield { position: relative; min-width: 0; min-height: 0; }
.tm-dzcv { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: default; }
.tm-dzland { position: absolute; border-radius: 50%; pointer-events: none; clip-path: circle(0% at 50% 50%); }
.tm-dzcv.tm-grab { cursor: grabbing; }
.tm-dzhint { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); font-size: 11.5px; color: var(--tm-ink3); white-space: nowrap; pointer-events: none; }
.tm-dzside { padding: 16px 16px 14px; overflow: auto; display: flex; flex-direction: column; gap: 14px; }
.tm-dzside.tm-dzleft { border-right: 1px solid var(--tm-line); }
.tm-dzside.tm-dzright { border-left: 1px solid var(--tm-line); }
.tm-dzhead2 { font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; color: var(--tm-ink3); }
.tm-dzname.tm-full { white-space: normal; overflow: visible; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.25; word-break: break-word; }
.tm-dzempty { font-size: 12.5px; color: var(--tm-ink3); line-height: 1.5; }
.tm-vfs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.tm-vf { display: flex; flex-direction: column; align-items: center; gap: 6px; user-select: none; }
.tm-vf-track { position: relative; width: 30px; height: 132px; border-radius: 9px; background: rgba(255,255,255,0.05); box-shadow: inset 0 0 0 1px var(--tm-line2); cursor: ns-resize; overflow: hidden; touch-action: none; }
.tm-vf-fill { position: absolute; left: 0; right: 0; background: linear-gradient(180deg, var(--vf-col, #b88cff), rgba(139,92,246,0.35)); }
.tm-vf-mid { position: absolute; left: 4px; right: 4px; top: 50%; height: 1px; background: rgba(255,255,255,0.25); }
.tm-vf-thumb { position: absolute; left: 3px; right: 3px; height: 4px; margin-top: -2px; border-radius: 2px; background: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.4); }
.tm-vf-name { font-size: 9.5px; font-weight: 800; letter-spacing: 0.07em; color: var(--tm-ink2); }
.tm-vf-val { font-size: 10px; color: var(--tm-ink3); min-height: 12px; text-align: center; }
.tm-vf.tm-active .tm-vf-val { color: #fff; }
.tm-dztitle { font-family: var(--tm-display); font-weight: 900; font-stretch: 125%; font-size: 22px; line-height: 1; color: #fff; letter-spacing: 0.01em;
}
.tm-dzsub { font-size: 12px; color: var(--tm-ink3); margin-top: 5px; line-height: 1.4; }
.tm-dzcard { border-radius: 12px; background: var(--tm-panel); box-shadow: inset 0 0 0 1px var(--tm-line); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.tm-dzrow { display: flex; align-items: center; gap: 8px; }
.tm-dzname { font-weight: 700; font-size: 14px; color: #fff; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm-dzdot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.tm-dzkey { font-size: 12px; color: var(--tm-ink2); line-height: 1.4; }
.tm-dzkey b { color: #fff; font-weight: 700; }
.tm-dzseg { display: flex; border-radius: 99px; box-shadow: inset 0 0 0 1px var(--tm-line2); padding: 2px; }
.tm-dzseg button { flex: 1; height: 26px; border-radius: 99px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; color: var(--tm-ink3); }
.tm-dzseg button.tm-sel { background: rgba(255,255,255,0.1); color: #fff; }
.tm-dzseg button.tm-sel.tm-dztex { background: rgba(228,255,58,0.16); color: var(--tm-acid); }
.tm-dzseg button:disabled { opacity: 0.45; cursor: default; }
.tm-dzlbl { font-size: 11px; color: var(--tm-ink3); letter-spacing: 0.04em; display: flex; justify-content: space-between; }
.tm-dzlbl span:last-child { color: var(--tm-ink2); }
.tm-dzrange { -webkit-appearance: none; appearance: none; width: 100%; height: 18px; background: transparent; margin: 0; }
.tm-dzrange::-webkit-slider-runnable-track { height: 4px; border-radius: 4px; background: rgba(255,255,255,0.12); }
.tm-dzrange::-moz-range-track { height: 4px; border-radius: 4px; background: rgba(255,255,255,0.12); }
.tm-dzrange::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%; background: #fff; }
.tm-dzrange::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: #fff; }
.tm-dzbtns { display: flex; gap: 6px; flex-wrap: wrap; }
.tm-dzbtn { height: 28px; padding: 0 12px; border-radius: 99px; font-size: 12px; font-weight: 600; color: var(--tm-ink2); box-shadow: inset 0 0 0 1px var(--tm-line2); }
.tm-dzbtn:hover { color: #fff; }
.tm-dzbtn.tm-on { background: rgba(228,255,58,0.14); color: var(--tm-acid); box-shadow: inset 0 0 0 1px rgba(228,255,58,0.4); }
.tm-dzbtn.tm-dzrm:hover { color: var(--tm-red); }
.tm-dzarp { display: flex; flex-direction: column; gap: 8px; }
.tm-dzarrow { width: 28px; height: 28px; border-radius: 50%; font-size: 18px; line-height: 1; color: var(--tm-ink2); box-shadow: inset 0 0 0 1px var(--tm-line2); }
.tm-dzarrow:hover { color: #fff; }
.tm-dzpat { flex: 1; text-align: center; font-weight: 800; font-size: 13px; color: #fff; letter-spacing: 0.04em; }
.tm-dzsteps { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; height: 34px; align-items: end; }
.tm-dzsteps i { display: block; height: calc(var(--h, 0.3) * 100%); border-radius: 3px; background: #b88cff; }
.tm-dzsteps i.tm-slice { background: #38f5c2; }
.tm-dzsteps i.tm-rest { height: 3px; background: rgba(255,255,255,0.12); }
.tm-dzspeed { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; }
.tm-dzspeed button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 0 5px; border-radius: 8px; font-size: 8.5px; font-weight: 800; letter-spacing: 0.05em; color: var(--tm-ink3); box-shadow: inset 0 0 0 1px var(--tm-line); }
.tm-dzspeed button.tm-sel { color: var(--tm-acid); box-shadow: inset 0 0 0 1px rgba(228,255,58,0.5); background: rgba(228,255,58,0.08); }
.tm-dzspeed button i { display: flex; gap: 1px; height: 8px; align-items: stretch; }
.tm-dzspeed button b { width: 2px; background: currentColor; border-radius: 1px; }
.tm-dzswitch { display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--tm-ink2); }
.tm-dzswitch i { width: 34px; height: 20px; border-radius: 99px; background: rgba(255,255,255,0.12); position: relative; transition: background 0.15s; }
.tm-dzswitch i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.15s var(--tm-ease); }
.tm-dzswitch.tm-on { color: #fff; }
.tm-dzswitch.tm-on i { background: var(--tm-purple); }
.tm-dzswitch.tm-on i::after { transform: translateX(14px); }
.tm-dzsnapwrap { position: relative; padding-bottom: 14px; }
.tm-dzticks { position: absolute; left: 7px; right: 7px; bottom: 0; height: 12px; }
.tm-dzticks span { position: absolute; transform: translateX(-50%); font-size: 8.5px; font-weight: 700; color: var(--tm-ink3); cursor: pointer; white-space: nowrap; }
.tm-dzticks span::before { content: ""; position: absolute; left: 50%; top: -6px; width: 1px; height: 4px; background: rgba(255,255,255,0.25); }
.tm-dzticks span:hover { color: #fff; }
.tm-dzbusy { font-size: 12px; color: var(--tm-acid); }
.tm-root.tm-filedrag[data-page="drop"] .tm-dzfield::after { content: "Drop to add"; position: absolute; inset: 14px; border-radius: 20px; border: 2px dashed rgba(228,255,58,0.6); display: grid; place-items: center; font-weight: 800; letter-spacing: 0.08em; color: var(--tm-acid); background: rgba(228,255,58,0.04); pointer-events: none; }
@media (max-width: 1000px) { .tm-dz { grid-template-columns: 230px minmax(0, 1fr) 250px; } .tm-vf-track { width: 24px; } }
`;
  function injectCss() {
    if (document.getElementById("tm-dz-css")) return;
    const s = el("style");
    s.id = "tm-dz-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ------------------------------------------------ the page
  function mount(page, ctx) {
    injectCss();
    const analyses = new Map();   // item id -> analyser result (this window only; for CUSTOM)
    let beforeCustom = null;      // the core preset to go back to when CUSTOM is switched off
    let sel = null;               // selected item id, or "core"
    let busy = 0, cv = null, side = null, fxSide = null, drag = null, t0 = performance.now(), land = null, landCv = null, lastT = 0;
    // empty -> filled: the landscape grows out of the first sound you drop; every new sound sends a ripple
    let shown = 0, bloomFrom = null, seen = new Set(), ripples = [];

    const drops = () => {
      const { orig } = ctx.get();
      if (!orig.drops || typeof orig.drops !== "object") orig.drops = { core: 1, items: [] };
      if (!Array.isArray(orig.drops.items)) orig.drops.items = [];
      return orig.drops;
    };
    const items = () => drops().items;
    const find = (id) => items().find((it) => it.id === id) || null;
    /** After any edit: mirror into the live copy and send it (fast = while dragging). */
    function changed(fast) {
      const { full } = ctx.get();
      full.drops = clone(drops());
      if (fast) ctx.push(); else ctx.flush();
    }
    const colorOf = (it) => (it.texture ? TEXTURE_COLOR : COLORS[it.slot % COLORS.length]);

    // ---------------------------------------- adding sounds
    async function addFiles(files) {
      const A = window.ToyMachineAnalyze;
      if (!A || typeof A.fromFile !== "function") { ctx.toast("Can't read sounds yet", ["The sound analyser (toymachine-analyze.js) isn't loaded in this window."]); return; }
      const list = [...(files || [])].filter((f) => f && (/^audio\//.test(f.type) || /\.(wav|aiff?|mp3|m4a|ogg|flac|opus|webm)$/i.test(f.name || "")));
      if (!list.length) { ctx.toast("That isn't a sound", ["Drop audio files (wav, aiff, mp3, flac...)."]); return; }
      const lines = [];
      for (const file of list) {
        if (items().length >= MAX) { lines.push("The drop zone holds " + MAX + " sounds. Remove one to add " + file.name + "."); break; }
        busy++; render();
        try {
          const res = await A.fromFile(file, ctx.audioCtx(), { maxSeconds: 12 });
          if (!res || !res.sample) throw new Error("No sound came back");
          const it = makeItem(res, file.name);
          const fr = fitRate(it, res);
          if (fr) it.rate = fr;
          ctx.call("setDropSample", it.slot, { data: res.sample.data, sampleRate: res.sample.sampleRate, name: it.name, id: it.id });
          analyses.set(it.id, res);
          items().push(it);
          sel = it.id;
          lines.push(it.name + ": " + (it.texture ? "no clear pitch, so Follow pitch is off (same sound on every key)." : "it's " + noteName(it.root) + (centsText(it.root) ? " " + centsText(it.root) : "") + ", tuned so C plays a C.")
            + (fr ? " It's " + (res.report.duration || 0).toFixed(2) + " s long, so it repeats " + rateText(fr).toLowerCase() + " at " + Math.round(ctx.bpm()) + " BPM." : ""));
        } catch (err) {
          console.warn("[DropZone] analyse", err);
          lines.push("Couldn't read " + file.name + ": " + ((err && err.message) || err));
        } finally { busy--; }
      }
      if (drops().custom) buildCustomCore(); else changed();
      render();
      ctx.call("audition", ctx.get().orig);
      ctx.toast("Drop zone", lines, true);
    }
    function centsText(root) {
      const c = Math.round((root - Math.round(root)) * 100);
      return c ? (c > 0 ? "+" : "") + c + " ct" : "";
    }
    function freeSlot() {
      const used = new Set(items().map((it) => it.slot));
      for (let s = 0; s < MAX; s++) if (!used.has(s)) return s;
      return 0;
    }
    function makeItem(res, fileName) {
      const r = res.report || {}, smp = res.preset && res.preset.sampler ? res.preset.sampler : {};
      const pitched = r.pitchHz > 0 && r.kind !== "noise";
      const root = pitched ? Math.round(((+r.midi || 60) + (+r.cents || 0) / 100) * 1000) / 1000 : 60;
      const texture = !pitched;
      const slot = freeSlot();
      const pos = spotFor(items().length, texture);
      const it = {
        id: "d" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        slot, name: String(fileName || "Sound").replace(/\.[^.]+$/, "").replace(/_+/g, " ").trim().slice(0, 40) || "Sound",
        file: smp.file || null, on: true, texture, root,
        detected: { pitched, note: pitched ? noteName(root) : null, midi: root, confidence: +r.confidence || 0, kind: r.kind || "" },
        mode: "synth", pattern: null, speed: 0, rate: 0, nudge: 0, oneShot: false, grain: 0, sat: 0, pos, level: texture ? 0.45 : 0.6,
        start: 0, end: 1,
        loop: !texture && !!smp.loop, loopStart: +smp.loopStart || 0, loopEnd: smp.loopEnd == null ? 1 : +smp.loopEnd,
        peaks: peaksOf(res.sample.data),
      };
      Object.assign(it, fromPos(pos));
      return it;
    }
    function remove(id) {
      const d = drops(), i = d.items.findIndex((it) => it.id === id);
      if (i < 0) return;
      d.items.splice(i, 1);
      analyses.delete(id);
      if (sel === id) sel = d.items.length ? d.items[Math.max(0, i - 1)].id : null;
      if (d.custom) buildCustomCore(); else changed();
      render();
    }

    // ---------------------------------------- CORE and CUSTOM
    function setCustom(on) {
      const { orig } = ctx.get();
      const d = clone(drops());
      if (on) {
        beforeCustom = clone(orig);
        d.custom = true;
        buildCustomCore(d);
      } else {
        const back = beforeCustom ? clone(beforeCustom) : clone(orig);
        delete d.custom;
        back.drops = d;
        beforeCustom = null;
        ctx.setPreset(back);
      }
      render();
    }
    /** CUSTOM: the core is rebuilt from the clearest pitched sound in the zone (its wavetable,
        envelope and filter from the analyser); with nothing pitched the core stays empty. */
    function buildCustomCore(d) {
      d = d || clone(drops());
      let best = null, score = -1;
      for (const it of d.items) {
        const res = analyses.get(it.id);
        if (!res || it.texture || !it.on || !res.preset) continue;
        const s = (+res.report.harmonicity || 0) * (+res.report.confidence || 0);
        if (s > score) { score = s; best = res; }
      }
      const core = best ? clone(best.preset) : clone(EMPTY_CORE);
      if (core.sampler) core.sampler.on = false;   // the drop zone plays the sample itself
      core.name = "Custom";
      core.tags = ["custom", "dropzone"];
      d.core = 1;
      core.drops = d;
      ctx.setPreset(core);
    }

    // ---------------------------------------- side panel
    function render() {
      page.textContent = "";
      const wrap = el("div", "tm-dz");
      const field = el("div", "tm-dzfield");
      cv = el("canvas", "tm-dzcv");
      landCv = el("canvas", "tm-dzland");
      land = ctx.Landscape ? ctx.Landscape(landCv) : null;
      if (land && ctx.look) land.setLook(ctx.look());
      field.append(landCv, cv, el("div", "tm-dzhint", items().length ? "Drag: left = lows, right = highs, near the core = melted in, edge = on top. Scroll = level." : ""));
      side = el("div", "tm-dzside tm-dzleft");
      fxSide = el("div", "tm-dzside tm-dzright");
      wrap.append(side, field, fxSide);
      page.append(wrap);
      bindField();
      renderSide();
    }
    function renderSide() {
      side.textContent = "";
      renderFxSide();
      const d = drops(), head = el("div");
      head.append(el("div", "tm-dztitle", "DROP ZONE"),
        el("div", "tm-dzsub", items().length ? items().length + " of " + MAX + " sounds. Play the keys: everything stays in key." : "Drop up to " + MAX + " sounds here (or onto the field). They join the synth in key."));
      side.append(head);
      if (busy) side.append(el("div", "tm-dzbusy", "Listening\u2026"));

      // core card
      const cc = el("div", "tm-dzcard");
      const cr = el("div", "tm-dzrow");
      cr.append(el("div", "tm-dzname", d.custom ? "CORE \u00b7 custom" : "CORE"));
      const cu = btn("tm-dzbtn" + (d.custom ? " tm-on" : ""), "Custom", d.custom ? "Go back to the preset's own core sound" : "Empty the core and build it from the dropped sounds");
      cu.addEventListener("click", () => setCustom(!d.custom));
      cr.append(cu);
      cc.append(cr);
      cc.append(slider("Core level", d.core == null ? 1 : d.core, (v) => Math.round(v * 100) + "%", (v, fast) => { drops().core = v; changed(fast); }));
      if (d.custom) cc.append(el("div", "tm-dzkey", analysesPitched() ? "Built from your clearest pitched sound." : "Empty: drop a pitched sound to build it."));
      side.append(cc);

      const it = sel && sel !== "core" ? find(sel) : null;
      if (it) side.append(itemCard(it));

      const add = btn("tm-dzbtn", "+ Add sounds\u2026", "Choose audio files");
      add.addEventListener("click", () => {
        const inp = el("input"); inp.type = "file"; inp.accept = "audio/*"; inp.multiple = true;
        inp.addEventListener("change", () => addFiles(inp.files));
        inp.click();
      });
      if (items().length < MAX) side.append(add);
    }
    const analysesPitched = () => items().some((it) => !it.texture && analyses.has(it.id));
    function slider(label, value, fmt, onInput) {
      const box = el("div");
      const lb = el("div", "tm-dzlbl");
      const vs = el("span", null, fmt(value));
      lb.append(el("span", null, label), vs);
      const r = el("input", "tm-dzrange");
      r.type = "range"; r.min = 0; r.max = 1; r.step = 0.001; r.value = value;
      r.addEventListener("input", () => { vs.textContent = fmt(+r.value); onInput(+r.value, true); });
      r.addEventListener("change", () => onInput(+r.value, false));
      box.append(lb, r);
      return box;
    }
    function itemCard(it) {
      const c = el("div", "tm-dzcard");
      const r1 = el("div", "tm-dzrow");
      const dot = el("div", "tm-dzdot"); dot.style.background = colorOf(it);
      const nm = el("div", "tm-dzname tm-full", it.name); nm.title = it.name;
      const pw = btn("tm-dzbtn" + (it.on ? " tm-on" : ""), it.on ? "On" : "Off", "Switch this sound on or off");
      pw.addEventListener("click", () => { it.on = !it.on; changed(); if (drops().custom) buildCustomCore(); render(); });
      r1.append(dot, nm, pw);
      c.append(r1);

      // key / texture
      const kt = el("div", "tm-dzkey");
      const det = it.detected || {};
      if (it.texture) kt.innerHTML = "<b>Own pitch</b> \u00b7 sounds the same on every key" + (det.pitched ? " (it's " + det.note + ")" : " (no clear pitch found)");
      else kt.innerHTML = "<b>" + noteName(it.root) + "</b>" + (centsText(it.root) ? " " + centsText(it.root) : "") + " \u2192 in key: C plays C" + (det.pitched ? "" : " (no clear pitch: tuned as C4)");
      const fp = el("label", "tm-dzswitch" + (it.texture ? "" : " tm-on"));
      fp.title = "On: every key plays it at that note. Off: it keeps the pitch it came with on every key (like a texture); rate and nudge still work.";
      fp.append(el("span", "tm-dzswname", "Follow pitch"), el("i"));
      fp.addEventListener("click", () => setTexture(it, !it.texture));
      c.append(fp, kt);
      const lp = el("div", "tm-dzseg");
      [[false, "LOOP", "Keeps playing while you hold the key"], [true, "ONE SHOT", "Plays once per note"]].forEach(([os, label, tip]) => {
        const b = btn(!!it.oneShot === os ? "tm-sel" : "", label, tip);
        b.addEventListener("click", () => { it.oneShot = os; changed(); renderSide(); });
        lp.append(b);
      });
      c.append(lp);

      if (it.texture) {
        // textures skip Synth/Arp/Stutter and get sound-shaping tools instead
        const tb = el("div", "tm-dzarp");
        tb.append(el("div", "tm-dzlbl", "TEXTURE"));
        const pct = (v) => Math.round(v * 100) + "%";
        tb.append(slider("Grain", +it.grain || 0, pct, (v, fast) => { it.grain = Math.round(v * 1000) / 1000; changed(fast); }));
        tb.append(slider("Saturation", +it.sat || 0, pct, (v, fast) => { it.sat = Math.round(v * 1000) / 1000; changed(fast); }));
        c.append(tb);
      } else {
        const ms = el("div", "tm-dzseg");
        MODES.forEach(([m, label, tip]) => {
          const b = btn(it.mode === m ? "tm-sel" : "", label, tip);
          b.addEventListener("click", () => setMode(it, m));
          ms.append(b);
        });
        c.append(ms);
        if (it.mode === "arp") c.append(arpBox(it));
        if (it.mode === "stutter") c.append(stutterBox(it));
      }

      c.append(slider("Level", clamp(it.level / 1.5), (v) => Math.round(v * 150) + "%", (v, fast) => { it.level = Math.round(v * 1.5 * 1000) / 1000; changed(fast); }));
      const where = el("div", "tm-dzkey", toneWords(it.tone) + " \u00b7 " + meltWords(it.melt));
      c.append(where);
      const rm = btn("tm-dzbtn tm-dzrm", "Remove", "Take this sound out of the drop zone");
      rm.addEventListener("click", () => remove(it.id));
      const bs = el("div", "tm-dzbtns");
      bs.append(rm);
      c.append(bs);
      return c;
    }
    // ---------------------------------------- timing: RATE (how often it plays again) and NUDGE
    // Rate snaps to musical lengths but can sit anywhere in between (that's out of sync, on purpose).
    const RATE_SNAPS = [[0.5, "1/8"], [1, "1/4"], [2, "1/2"], [4, "1 bar"], [8, "2 bars"], [16, "4 bars"], [32, "8 bars"]];
    const RATE_LO = 0.5, RATE_HI = 32, OFF_W = 0.08;   // the slider's left 8% is "Once"
    const rateToX = (r) => (!(r > 0) ? 0 : OFF_W + (1 - OFF_W) * Math.log(r / RATE_LO) / Math.log(RATE_HI / RATE_LO));
    const xToRate = (x) => (x < OFF_W * 0.6 ? 0 : RATE_LO * Math.pow(RATE_HI / RATE_LO, clamp((x - OFF_W) / (1 - OFF_W))));
    function rateText(r) {
      if (!(r > 0)) return "Once per key";
      const s = RATE_SNAPS.find((q) => Math.abs(q[0] - r) < 1e-3);
      if (s) return "Every " + s[1] + (r < 4 ? " bar" : "");
      return "Every " + (r / 4).toFixed(2) + " bar (free)";
    }
    function nudgeText(n) {
      if (Math.abs(n) < 1e-3) return "On the beat";
      const ms = Math.round(Math.abs(n) * 60000 / ctx.bpm());
      return ms + " ms " + (n > 0 ? "later" : "earlier");
    }
    /** A slider with labelled snap points: it jumps to a snap when close (hold Alt to slide free). */
    function snapSlider(label, x, snaps, fromX, toX, fmt, onSet) {
      const box = el("div", "tm-dzsnap");
      const lb = el("div", "tm-dzlbl");
      const vs = el("span", null, fmt(fromX(x)));
      lb.append(el("span", null, label), vs);
      const wrap = el("div", "tm-dzsnapwrap");
      const r = el("input", "tm-dzrange");
      r.type = "range"; r.min = 0; r.max = 1; r.step = 0.001; r.value = x;
      const ticks = el("div", "tm-dzticks");
      snaps.forEach(([v, name]) => {
        const tk = el("span", null, name);
        tk.style.left = (toX(v) * 100).toFixed(2) + "%";
        tk.addEventListener("click", () => { r.value = toX(v); vs.textContent = fmt(v); onSet(v, false); });
        ticks.append(tk);
      });
      let alt = false;
      r.addEventListener("pointerdown", (e) => { alt = e.altKey; });
      const pick = () => {
        let v = fromX(+r.value);
        if (!alt) for (const [sv] of snaps) if (Math.abs(toX(sv) - +r.value) < 0.025) { v = sv; break; }
        return v;
      };
      r.addEventListener("input", () => { const v = pick(); vs.textContent = fmt(v); onSet(v, true); });
      r.addEventListener("change", () => { const v = pick(); r.value = toX(v); vs.textContent = fmt(v); onSet(v, false); });
      wrap.append(r, ticks);
      box.append(lb, wrap);
      return box;
    }
    function rateSlider(it) {
      return snapSlider("Rate", rateToX(it.rate || 0), RATE_SNAPS, xToRate, rateToX, rateText,
        (v, fast) => { it.rate = Math.round(v * 1e4) / 1e4; changed(fast); });
    }
    const NUDGE = 1;   // +/- 1 beat
    function nudgeSlider(it) {
      const snaps = [[-1, "-1/4"], [-0.5, "-1/8"], [0, "0"], [0.5, "+1/8"], [1, "+1/4"]];
      return snapSlider("Nudge", (clamp(it.nudge || 0, -NUDGE, NUDGE) + NUDGE) / (2 * NUDGE), snaps,
        (x) => (x * 2 - 1) * NUDGE, (v) => (v + NUDGE) / (2 * NUDGE), nudgeText,
        (v, fast) => { it.nudge = Math.round(v * 1e4) / 1e4; changed(fast); });
    }
    /** On drop: a short, unpitched-ish sound (a word, a hit, a texture) gets a repeat that fits the
        tempo: the shortest musical length (1/8 .. 8 bars) it fits in, so it lands on the grid. */
    function fitRate(it, res) {
      const r = res.report || {}, dur = +r.duration || 0, bpm = ctx.bpm();
      // a held, steady note is an instrument: leave it to the keys. Words, hits, phrases, textures repeat.
      const steadyNote = r.kind === "tonal" && r.envelope && r.envelope.sustained && !it.texture;
      if (steadyNote || !(dur > 0)) return null;
      const beats = dur * bpm / 60;
      if (beats > 32) return null;
      const fit = RATE_SNAPS.find((q) => q[0] >= beats * 0.97);
      return fit ? fit[0] : null;
    }
    // ---------------------------------------- right panel: timing + the sound's own effects
    const FX = [
      ["drive", "DRIVE", 0, 1, 0, "#ff8a2a", (v) => (v < 0.005 ? "off" : Math.round(v * 100) + "%"), "Distortion: grit and saturation"],
      ["cutoff", "CUTOFF", -1, 1, 0, "#4fb2ff", (v) => (Math.abs(v) < 0.02 ? "open" : v < 0 ? "muffled " + Math.round(-v * 100) + "%" : "pushy " + Math.round(v * 100) + "%"), "Down = muffled, up = pushy and bright"],
      ["delay", "DELAY", 0, 1, 0, "#38f5c2", (v) => (v < 0.005 ? "off" : Math.round(v * 100) + "%"), "Echo (dotted 1/8, in time)"],
      ["reverb", "REVERB", 0, 1, 0, "#9fe3ff", (v) => (v < 0.005 ? "off" : Math.round(v * 100) + "%"), "Room"],
      ["stretch", "STRETCH", 1, 8, 1, "#e4ff3a", (v) => (v < 1.01 ? "off" : "\u00d7" + v.toFixed(v < 2 ? 2 : 1)), "Plays it slower without changing its pitch"],
    ];
    function renderFxSide() {
      fxSide.textContent = "";
      const it = sel && sel !== "core" ? find(sel) : null;
      if (!it) {
        fxSide.append(el("div", "tm-dzhead2", "SOUND SETTINGS"), el("div", "tm-dzempty", items().length ? "Click a sound in the circle to set its timing and effects." : "Drop a sound first. Its timing and effects show up here."));
        return;
      }
      const tm = el("div", "tm-dzcard");
      tm.append(el("div", "tm-dzhead2", "TIMING"));
      if (it.mode === "synth") tm.append(rateSlider(it));
      tm.append(nudgeSlider(it));
      const fx = el("div", "tm-dzcard");
      fx.append(el("div", "tm-dzhead2", "EFFECTS"));
      const row = el("div", "tm-vfs");
      FX.forEach(([key, name, lo, hi, def, col, fmt, tip]) => row.append(vfader(it, key, name, lo, hi, def, col, fmt, tip)));
      fx.append(row);
      fxSide.append(tm, fx);
    }
    /** A tall fader: drag up/down (Shift = fine), double-click = back to its start value. */
    function vfader(it, key, name, lo, hi, def, col, fmt, tip) {
      const box = el("div", "tm-vf");
      box.title = tip + " (double-click to reset)";
      const tr = el("div", "tm-vf-track"), fill = el("div", "tm-vf-fill"), th = el("div", "tm-vf-thumb"), val = el("div", "tm-vf-val");
      tr.style.setProperty("--vf-col", col);
      const bip = lo < 0;
      if (bip) tr.append(el("div", "tm-vf-mid"));
      tr.append(fill, th);
      const get = () => (it[key] == null ? def : +it[key]);
      const toN = (v) => (key === "stretch" ? Math.log(v) / Math.log(hi) : (v - lo) / (hi - lo));
      const fromN = (n) => (key === "stretch" ? Math.pow(hi, clamp(n)) : lo + clamp(n) * (hi - lo));
      const show = () => {
        const n = clamp(toN(get())), y = (1 - n) * 100;
        th.style.top = y + "%";
        if (bip) { fill.style.top = Math.min(y, 50) + "%"; fill.style.bottom = (100 - Math.max(y, 50)) + "%"; }
        else { fill.style.top = y + "%"; fill.style.bottom = "0"; }
        val.textContent = fmt(get());
      };
      const setV = (v, fast) => { it[key] = Math.round(v * 1000) / 1000; show(); changed(fast); };
      tr.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        tr.setPointerCapture(e.pointerId);
        box.classList.add("tm-active");
        const h = tr.getBoundingClientRect().height;
        let y0 = e.clientY, n0 = clamp(toN(get()));
        const mv = (ev) => {
          const k = ev.shiftKey ? 0.2 : 1;
          n0 = clamp(n0 + ((y0 - ev.clientY) / h) * k); y0 = ev.clientY;
          let v = fromN(n0);
          if (bip && Math.abs(v) < (hi - lo) * 0.02) v = 0;   // a soft click at the middle
          setV(v, true);
        };
        const up = () => { box.classList.remove("tm-active"); tr.removeEventListener("pointermove", mv); tr.removeEventListener("pointerup", up); changed(); };
        tr.addEventListener("pointermove", mv); tr.addEventListener("pointerup", up);
      });
      tr.addEventListener("dblclick", () => setV(def, false));
      tr.addEventListener("wheel", (e) => { e.preventDefault(); setV(fromN(clamp(toN(get()) + (e.deltaY < 0 ? 0.03 : -0.03))), true); clearTimeout(tr._w); tr._w = setTimeout(() => changed(), 200); }, { passive: false });
      show();
      box.append(tr, el("div", "tm-vf-name", name), val);
      return box;
    }
    function setMode(it, m) {
      if (it.mode === m) return;
      it.mode = m;
      if (m === "arp" && !ARPS.some((a) => a[0] === it.pattern)) it.pattern = it.texture ? "chop" : "up";
      if (m === "stutter" && !STUTTERS.some((a) => a[0] === it.pattern)) it.pattern = "straight";
      if (it.speed == null) it.speed = 0;
      changed(); render();
      ctx.call("audition", ctx.get().orig);
    }
    function speedRow(it) {
      const row = el("div", "tm-dzspeed");
      SPEEDS.forEach(([v, label, len]) => {
        const b = btn((it.speed || 0) === v ? "tm-sel" : "", "", label + " (" + len + " notes)");
        const bars = el("i");
        for (let k = 0; k < [1, 2, 4, 6, 8][v + 2]; k++) bars.append(el("b"));   // more ticks = faster
        b.append(bars, el("span", null, label));
        b.addEventListener("click", () => { it.speed = v; changed(); renderSide(); });
        row.append(b);
      });
      return row;
    }
    function arpBox(it) {
      const box = el("div", "tm-dzarp");
      const lib = LIB(), total = ARPS.length + lib.length;
      const li = Array.isArray(it.steps) ? lib.findIndex((p) => p.name === it.libName) : -1;
      const i = Array.isArray(it.steps) ? (li >= 0 ? ARPS.length + li : -1) : Math.max(0, ARPS.findIndex((a) => a[0] === it.pattern));
      const a = Array.isArray(it.steps) ? [it.pattern, it.libName || "Dice", libSemis(it.steps)] : ARPS[i];
      const nav = el("div", "tm-dzrow");
      const prev = btn("tm-dzarrow", "\u2039", "Previous pattern"), next = btn("tm-dzarrow", "\u203a", "Next pattern");
      const setAt = (k) => {
        if (k < ARPS.length) { it.pattern = ARPS[k][0]; delete it.steps; delete it.libName; }
        else { const p = lib[k - ARPS.length]; it.pattern = "up"; it.steps = window.ToyMachineArps.expand(p, 1); it.libName = p.name; }
        changed(); renderSide(); ctx.call("audition", ctx.get().orig);
      };
      const flip = (d) => setAt(((i < 0 ? 0 : i) + d + total) % total);
      prev.addEventListener("click", () => flip(-1)); next.addEventListener("click", () => flip(1));
      nav.append(prev, el("div", "tm-dzpat", a[1] + (i >= 0 ? "  " + (i + 1) + "/" + total : "")), next);
      if (window.ToyMachineArps) {
        const dice = btn("tm-dzarrow tm-dzdice", "\u2684", "Dice: a brand-new pattern for this sound");
        dice.addEventListener("click", () => { const p = window.ToyMachineArps.roll(window.ToyMachineArps.newSeed(), 0.5); it.pattern = "up"; it.steps = window.ToyMachineArps.expand(p, 1); it.libName = p.name; changed(); renderSide(); ctx.call("audition", ctx.get().orig); });
        nav.append(dice);
      }
      // the pattern as 8 steps: height = note (or slice), gaps = rests
      const pic = el("div", "tm-dzsteps");
      a[2].forEach((st) => {
        const cell = el("i");
        if (st == null) cell.className = "tm-rest";
        else {
          const h = typeof st === "string" ? 0.2 + 0.1 * +st.slice(1) : 0.2 + (it.texture ? 0 : st / 24) * 0.8;
          cell.style.setProperty("--h", Math.min(1, h).toFixed(2));
          if (typeof st === "string") cell.className = "tm-slice";
        }
        pic.append(cell);
      });
      box.append(nav, pic, speedRow(it));
      if (it.texture && a[0] !== "chop" && a[0] !== "random" && a[0] !== "stab") box.append(el("div", "tm-dzkey", "A texture keeps its pitch, so this plays the rhythm only. Try Chop."));
      return box;
    }
    function stutterBox(it) {
      const box = el("div", "tm-dzarp");
      const seg = el("div", "tm-dzseg");
      STUTTERS.forEach(([m, label]) => {
        const b = btn(it.pattern === m ? "tm-sel" : "", label.toUpperCase(), m === "roll" ? "Speeds up through each bar" : label);
        b.addEventListener("click", () => { it.pattern = m; changed(); renderSide(); });
        seg.append(b);
      });
      box.append(seg, speedRow(it));
      return box;
    }
    function setTexture(it, on) {
      if (it.texture === on) return;
      it.texture = on;   // the measured root stays, so switching back gives the same tuning
      if (on) { if (it.mode !== "synth") it.modeBefore = it.mode; it.mode = "synth"; }
      else if (it.modeBefore) { it.mode = it.modeBefore; delete it.modeBefore; }
      changed();
      if (drops().custom) buildCustomCore();
      render();
      ctx.call("audition", ctx.get().orig);
    }

    // ---------------------------------------- the field
    function geom() {
      const r = cv.getBoundingClientRect();
      const S = Math.min(r.width - 90, r.height - 30), R = Math.max(40, S * 0.42);
      return { r, R, cx: r.width / 2, cy: (r.height - 18) / 2 };
    }
    const toPx = (g, pos) => [g.cx + (pos[0] - 0.5) * 2 * g.R, g.cy + (pos[1] - 0.5) * 2 * g.R];
    const radiusOf = (g, it) => (8 + 14 * clamp(it.level / 1.5)) * (g.R / 180) + 6;
    function hit(g, x, y) {
      const list = items();
      for (let i = list.length - 1; i >= 0; i--) {
        const [px, py] = toPx(g, list[i].pos);
        if (Math.hypot(x - px, y - py) <= radiusOf(g, list[i]) + 6) return list[i].id;
      }
      if (Math.hypot(x - g.cx, y - g.cy) <= CORE_R * g.R) return "core";
      return null;
    }
    function bindField() {
      cv.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const g = geom(), x = e.clientX - g.r.left, y = e.clientY - g.r.top;
        const id = hit(g, x, y);
        if (!id) { if (sel) { sel = null; renderSide(); } return; }
        e.preventDefault();
        sel = id; renderSide();
        if (id === "core") return;
        const it = find(id);
        cv.setPointerCapture(e.pointerId);
        cv.classList.add("tm-grab");
        const [px, py] = toPx(g, it.pos);
        drag = { id, ox: x - px, oy: y - py };
        const mv = (ev) => {
          const gx = geom(), qx = ev.clientX - gx.r.left - drag.ox, qy = ev.clientY - gx.r.top - drag.oy;
          it.pos = keepInField([0.5 + (qx - gx.cx) / (2 * gx.R), 0.5 + (qy - gx.cy) / (2 * gx.R)]).map((v) => Math.round(v * 1e4) / 1e4);
          Object.assign(it, fromPos(it.pos));
          changed(true);
        };
        const up = () => { cv.classList.remove("tm-grab"); cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up); drag = null; changed(); renderSide(); };
        cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up);
      });
      cv.addEventListener("wheel", (e) => {
        const g = geom(), id = hit(g, e.clientX - g.r.left, e.clientY - g.r.top);
        if (!id) return;
        e.preventDefault();
        const step = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.01 : 0.05);
        if (id === "core") drops().core = clamp((drops().core == null ? 1 : drops().core) + step);
        else { const it = find(id); it.level = Math.round(clamp(it.level + step * 1.5, 0, 1.5) * 1000) / 1000; }
        changed(true);
        clearTimeout(cv._wt); cv._wt = setTimeout(() => { changed(); renderSide(); }, 250);
      }, { passive: false });
      cv.addEventListener("dblclick", (e) => {
        const g = geom(), id = hit(g, e.clientX - g.r.left, e.clientY - g.r.top);
        if (id && id !== "core") { const it = find(id); it.on = !it.on; changed(); renderSide(); }
      });
    }

    function draw() {
      if (!cv || !cv.isConnected) return;
      const g = geom();
      if (!g.r.width) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(g.r.width * dpr), H = Math.round(g.r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const c = cv.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, g.r.width, g.r.height);
      const t = (performance.now() - t0) / 1000, { cx, cy, R } = g, d = drops();
      const font = getComputedStyle(cv).fontFamily;
      const list = items();

      // sounds that just arrived: a ripple from where they landed (the first one also starts the bloom)
      for (const it of list) if (!seen.has(it.id)) {
        seen.add(it.id);
        ripples.push({ pos: it.pos.slice(), at: t, col: colorOf(it) });
        if (!bloomFrom && shown < 0.02) bloomFrom = it.pos.slice();
      }
      for (const id of [...seen]) if (!list.some((it) => it.id === id)) seen.delete(id);
      const dt = Math.min(0.1, Math.max(0, t - (draw.lastT || t))); draw.lastT = t;
      shown = list.length ? Math.min(1, shown + dt / 1.6) : Math.max(0, shown - dt / 0.5);
      if (!list.length && shown === 0) bloomFrom = null;
      const bloom = shown * shown * (3 - 2 * shown);   // eased 0..1

      if (bloom > 0) drawLand(g, t, bloom); else if (landCv) landCv.style.visibility = "hidden";
      // the quiet outline (always), and the guides once there is something to place
      c.lineWidth = 1;
      c.strokeStyle = "rgba(255,255,255," + (0.14 * (1 - bloom) + 0.05).toFixed(3) + ")";
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = bloom;
      c.setLineDash([2, 4]);
      c.strokeStyle = "rgba(0,0,0,0.6)";
      c.beginPath(); c.arc(cx, cy, R * 0.5, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
      c.font = "700 9.5px " + font;
      c.fillStyle = "rgba(255,255,255,0.6)";
      c.textAlign = "center";
      const lab = (txt, rad) => { const a = -Math.PI * 0.32; c.fillText(txt, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); };
      lab("MELTED IN", R * 0.5 - 10);
      lab("ON TOP", R - 12);
      c.font = "700 11px " + font;
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.textAlign = "right"; c.fillText("LOWS", cx - R - 16, cy + 4);
      c.textAlign = "left"; c.fillText("HIGHS", cx + R + 16, cy + 4);
      c.globalAlpha = 1;
      // ripples
      ripples = ripples.filter((r) => t - r.at < 1.2);
      for (const r of ripples) {
        const f = (t - r.at) / 1.2, [rx, ry] = toPx(g, r.pos);
        c.strokeStyle = hexA(r.col, 0.7 * (1 - f));
        c.lineWidth = 2 * (1 - f) + 0.5;
        c.beginPath(); c.arc(rx, ry, 12 + f * R * 0.9, 0, Math.PI * 2); c.stroke();
      }

      // links: thicker and faster the more a sound is melted in
      for (const it of list) {
        const [px, py] = toPx(g, it.pos);
        if (!it.on) continue;
        c.strokeStyle = hexA(colorOf(it), 0.15 + 0.45 * it.melt);
        c.lineWidth = 1 + 3 * it.melt;
        c.setLineDash([4, 6]);
        c.lineDashOffset = -t * (8 + 30 * it.melt);
        c.beginPath(); c.moveTo(px, py); c.lineTo(cx, cy); c.stroke();
      }
      c.setLineDash([]);

      // the core
      const core = d.core == null ? 1 : d.core, cr = CORE_R * R;
      const breathe = 1 + 0.03 * Math.sin(t * 2);
      const cg = c.createRadialGradient(cx, cy, 0, cx, cy, cr * breathe);
      cg.addColorStop(0, d.custom ? "rgba(228,255,58," + (0.2 + 0.4 * core) + ")" : "rgba(20,18,28," + (0.25 + 0.6 * bloom) + ")");
      cg.addColorStop(1, "rgba(10,10,14," + (0.35 * bloom).toFixed(3) + ")");
      c.fillStyle = cg;
      c.beginPath(); c.arc(cx, cy, cr * breathe, 0, Math.PI * 2); c.fill();
      c.strokeStyle = sel === "core" ? "#e4ff3a" : "rgba(255,255,255," + (0.2 + 0.15 * bloom).toFixed(3) + ")";
      c.lineWidth = sel === "core" ? 2 : 1;
      c.stroke();
      c.textAlign = "center";
      c.font = "800 11px " + font;
      c.fillStyle = "rgba(255,255,255," + (0.6 + 0.4 * bloom).toFixed(3) + ")";
      c.fillText(d.custom ? "CUSTOM" : "CORE", cx, cy + 1);
      c.font = "600 9.5px " + getComputedStyle(cv).fontFamily;
      c.fillStyle = "rgba(255,255,255,0.6)";
      c.fillText(Math.round(core * 100) + "%", cx, cy + 13);

      // the sounds: a dot ringed by its own waveform
      for (const it of list) {
        const [px, py] = toPx(g, it.pos), rr = radiusOf(g, it), col = colorOf(it);
        const a = it.on ? 1 : 0.3, pk = it.peaks || [];
        c.globalAlpha = a;
        c.fillStyle = "rgba(8,8,12,0.55)";
        c.beginPath(); c.arc(px, py, rr + 10, 0, Math.PI * 2); c.fill();
        c.strokeStyle = col; c.lineWidth = 1.5;
        c.beginPath();
        const n = Math.max(1, pk.length);
        for (let k = 0; k <= n; k++) {
          const ang = (k / n) * Math.PI * 2 - Math.PI / 2 + t * (it.texture ? 0.15 : 0.35);
          const amp = rr + 2 + 8 * (pk[k % n] || 0);
          const x = px + Math.cos(ang) * amp, y = py + Math.sin(ang) * amp;
          if (k) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.stroke();
        c.fillStyle = col;
        c.beginPath(); c.arc(px, py, rr, 0, Math.PI * 2); c.fill();
        if (it.texture) {   // grain speckles
          c.fillStyle = "rgba(0,0,0,0.45)";
          for (let k = 0; k < 7; k++) { const ang = k * 2.4 + t * 0.6, rad = rr * (0.25 + 0.5 * ((k * 37) % 10) / 10); c.beginPath(); c.arc(px + Math.cos(ang) * rad, py + Math.sin(ang) * rad, 1.3, 0, Math.PI * 2); c.fill(); }
        }
        if (it.mode === "arp" || it.mode === "stutter") {
          const steps = it.mode !== "arp" ? [0, 0, 0, 0, 0, 0, 0, 0] : Array.isArray(it.steps) ? libSemis(it.steps).concat(new Array(8).fill(0)).slice(0, 8) : ((ARPS.find((a) => a[0] === it.pattern) || ARPS[0])[2]);
          const per = 0.125 * Math.pow(2, -(it.speed || 0)) * 4;   // seconds per step at 120 bpm, slowed 4x for the eye
          const now = Math.floor(t / per) % 8;
          steps.forEach((st, k) => {
            const ang = (k / 8) * Math.PI * 2 - Math.PI / 2, rad = rr + 15;
            c.fillStyle = st == null ? "rgba(255,255,255,0.15)" : k === now ? "#fff" : hexA(col, 0.7);
            c.beginPath(); c.arc(px + Math.cos(ang) * rad, py + Math.sin(ang) * rad, k === now ? 2.6 : 1.8, 0, Math.PI * 2); c.fill();
          });
        }
        if (sel === it.id) { c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(px, py, rr + 3, 0, Math.PI * 2); c.stroke(); }
        c.fillStyle = "#111"; c.textAlign = "center";
        c.font = "900 " + Math.max(8, Math.min(12, rr * 0.7)) + "px " + getComputedStyle(cv).fontFamily;
        c.fillText(it.texture ? "TX" : noteName(it.root).replace(/-?\d+$/, ""), px, py + 4);
        c.fillStyle = "rgba(255,255,255,0.85)";
        c.font = "600 10.5px " + getComputedStyle(cv).fontFamily;
        c.fillText(it.name.length > 16 ? it.name.slice(0, 15) + "\u2026" : it.name, px, py + rr + 22);
        c.globalAlpha = 1;
      }
      if (!list.length) {
        c.fillStyle = "rgba(255,255,255,0.7)"; c.textAlign = "center";
        c.font = "600 15px " + font;
        c.fillText(busy ? "Listening\u2026" : "Drop sounds here", cx, cy + R * 0.62);
        c.font = "500 11px " + font;
        c.fillStyle = "rgba(255,255,255,0.32)";
        c.fillText("vocals, textures, one-shots, loops", cx, cy + R * 0.62 + 17);
      }
    }
    /** The same liquid, grainy landscape as the Play page, bent by the dropped sounds: each sound
        is a point (louder = stronger swirl), textures add analog grain, arps pulse, and the more
        sound is piled in, the dirtier (clip tears) it gets. */
    function drawLand(g, t, bloom) {
      const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      const size = Math.round(2 * g.R);
      const from = bloomFrom || [0.5, 0.5];
      landCv.style.visibility = "visible";
      landCv.style.clipPath = bloom >= 1 ? "none" : "circle(" + (bloom * 145).toFixed(1) + "% at " + (from[0] * 100).toFixed(1) + "% " + (from[1] * 100).toFixed(1) + "%)";
      landCv.style.opacity = Math.min(1, bloom * 1.6).toFixed(3);
      if (landCv.style.width !== size + "px" || landCv.style.left !== Math.round(g.cx - g.R) + "px") {
        Object.assign(landCv.style, { width: size + "px", height: size + "px", left: Math.round(g.cx - g.R) + "px", top: Math.round(g.cy - g.R) + "px" });
      }
      if (!land) {   // no landscape (old toymachine.js): a plain gradient
        const c = cv.getContext("2d"), rg = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.R);
        rg.addColorStop(0, "rgba(139,92,246,0.3)"); rg.addColorStop(1, "rgba(10,10,12,0.6)");
        c.fillStyle = rg; c.beginPath(); c.arc(g.cx, g.cy, g.R, 0, Math.PI * 2); c.fill();
        return;
      }
      const px = Math.min(720, Math.round(size * Math.min(2, window.devicePixelRatio || 1)));
      if (landCv.width !== px) landCv.width = landCv.height = px;
      const list = items().filter((it) => it.on), d = drops();
      const pads = list.map((it, k) => ({
        u: (it.pos[0] - 0.5) * 2, v: -(it.pos[1] - 0.5) * 2, mx: 0.5, my: 0.5, fall: 9 - 3 * it.melt,
        swirl: (k % 2 ? -1 : 1) * (0.3 + 1.2 * clamp(it.level / 1.5)) + (drag && drag.id === it.id ? 1.2 : 0), pinch: 0.1 + 0.3 * it.melt,
      }));
      const load = list.reduce((a, it) => a + clamp(it.level / 1.5), 0) + (d.core == null ? 1 : d.core) * 0.5;
      const force = {};
      const tex = list.filter((it) => it.texture);
      if (tex.length) force.analog = { x: 0.3, y: Math.min(1, 0.25 * tex.length), u: 0, v: 0 };
      if (load > 2.2) force.clip = { x: clamp(0.3 + (load - 2.2) * 0.25), y: 0.6 };   // piled high: tears
      const tilt = list.reduce((a, it) => a + it.tone * clamp(it.level / 1.5), 0);
      land.draw({
        pads, force, zoom: 1.2, turb: 0.5 + 0.35 * load, hueShift: clamp(tilt * 25, -40, 40),
        bright: clamp(0.6 + 0.25 * (d.core == null ? 1 : d.core) + 0.04 * list.length, 0.4, 1.1), speed: 0.25 + (drag ? 1.2 : 0),
      }, dt);
    }
    function hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a.toFixed(3) + ")";
    }

    return { render, draw, addFiles, get busy() { return busy > 0; } };
  }

  window.ToyMachineDropZone = { mount, fromPos, keepInField, version: 1 };
})();
