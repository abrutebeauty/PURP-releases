// TOYTUNE window (Eman, 16 Nov 2026): KILLTOY's vocal tool. Pitch correction plus everything a vocal needs, in 5 tabs:
//   TUNE     live pitch correction (key + scale or MIDI notes), the pitch picture, Speed / Human / Flex / Formant.
//   CHOIR    sing once, get a choir: voices from the key (or PG MATCH chords / MIDI), spread wide.
//   VOCODER  8 vocoder kinds; the carrier plays MIDI notes, PG MATCH chords or your own note.
//   FX       vocal chain presets + a prompt ("dark rage vocal, wide and wet") + 7 modules; Delay / Verb have trigger modes.
//   STACKS   SUNO: remaster the take (thicker, processed), generate stacks or harmony layers; results land as takes.
// Top bar (all tabs): KEY, PG MATCH (key + chords from the song), MIDI (follow a MIDI lane), gear (preferences), power.
// Twin = TOY KEYS (ui/toykeys.js): same top bar, tiles, faders and keyboard. ASCII only.
//
//   const w = ToyTuneUI.open(host, { state, api, title })
//   api.set(path, value)      every change ("tune.speed", 80) -> the engine
//   api.pitch()               -> { in, out, level } MIDI notes (0 = no pitch), for the picture
//   api.prompt(text)          -> Promise<preset>   (FX prompt)
//   api.stack(kind, opts)     -> Promise<{ takes }> (STACKS: "remaster" | "stacks" | "harmony")
//   api.close()
(function () {
  "use strict";
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SCALES = ["MAJOR", "MINOR", "CHROMATIC", "H. MINOR", "PENTA", "BLUES"];
  // bit n = semitone n above the key (same table as Source/dsp/toytune/ToyTuneCore.h)
  const MASKS = [0xAB5, 0x5AD, 0xFFF, 0x9AD, 0x4A9, 0x4E9];
  const inScale = (n, key, sc, custom) => { const m = custom != null ? custom : MASKS[sc] || 0xFFF; return (m >> (((n - key) % 12 + 12) % 12)) & 1; };

  const ICON = {
    tune: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M3 16 C7 16 7 8 11 8 S15 12 21 12"/><path d="M3 20h18" opacity=".4"/></svg>',
    choir: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="9" r="2.5"/><circle cx="17" cy="9" r="2.5"/><circle cx="12" cy="7" r="2.5"/><path d="M3 19c1-4 7-4 8 0M13 19c1-4 7-4 8 0M8 17c1-4 7-4 8 0"/></svg>',
    vocoder: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M4 8v8M8 5v14M12 9v6M16 6v12M20 10v4"/></svg>',
    fx: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/></svg>',
    stacks: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M3 8l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4M3 16l9 4 9-4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
    power: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 3v8"/><path d="M6.3 7.5a8 8 0 1 0 11.4 0"/></svg>',
    x: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    wave: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M2 12h3l2-6 3 12 3-9 2 6 2-3h5"/></svg>',
    dot: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="6"/></svg>',
    flame: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-7z"/></svg>',
    moon: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    star: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.6 6 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.2 1.4-6.3L3 9.6 9.4 9z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><rect x="7" y="2" width="10" height="20"/><path d="M11 18h2"/></svg>',
    skull: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M5 11a7 7 0 0 1 14 0v4h-3v4H8v-4H5z"/><circle cx="9.5" cy="11.5" r="1.5"/><circle cx="14.5" cy="11.5" r="1.5"/></svg>',
    up: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path d="M4 18 12 6l8 12"/></svg>',
  };

  // what each tab shows. Labels stay short and uppercase.
  const TABS = [["tune", "TUNE"], ["choir", "CHOIR"], ["vocoder", "VOCODER"], ["fx", "FX"], ["stacks", "STACKS"]];
  const CHOIR_MODES = [
    ["double", "DOUBLE", 270, "dot"], ["thirds", "THIRDS", 250, "up"], ["power", "POWER 5THS", 300, "bolt"], ["octaves", "OCTAVES", 220, "up"],
    ["gospel", "GOSPEL", 40, "choir"], ["angel", "ANGELS", 190, "star"], ["dark", "DARK CHOIR", 330, "moon"], ["chords", "PG CHORDS", 280, "choir"]];
  const VOC_MODES = [
    ["classic", "CLASSIC", 270, "vocoder"], ["robot", "ROBOT", 200, "bolt"], ["talkbox", "TALKBOX", 300, "wave"], ["chord", "CHORD", 280, "choir"],
    ["whisper", "WHISPER", 190, "moon"], ["digital", "DIGITAL", 330, "skull"], ["choirpad", "CHOIR PAD", 230, "star"], ["sub", "SUB", 250, "dot"]];
  const FX_MODS = [["gate", "GATE"], ["eq", "EQ"], ["comp", "COMP"], ["drive", "DRIVE"], ["double", "DOUBLE"], ["delay", "DELAY"], ["verb", "VERB"]];
  // what each module's knobs are (0..1 values; text shows the real unit). The first one is the strip's bar.
  const MOD_KNOBS = {
    gate: [["thresh", "THRESH", (v) => Math.round(-80 + v * 60) + "dB"]],
    eq: [["low", "LOW CUT", (v) => Math.round(40 + v * v * 360) + "Hz"], ["body", "BODY", (v) => db(v, 9)], ["presence", "PRESENCE", (v) => db(v, 9)], ["air", "AIR", (v) => db(v, 12)]],
    comp: [["amount", "AMOUNT", pct], ["speed", "SPEED", (v) => (v < 0.34 ? "SLOW" : v < 0.67 ? "MED" : "FAST")], ["deess", "DE-ESS", pct]],
    drive: [["amount", "AMOUNT", pct], ["tone", "TONE", pct], ["kind", "KIND", (v) => ["TAPE", "TUBE", "FUZZ", "SCREAM", "RADIO"][Math.min(4, Math.floor(v * 5))]], ["mix", "MIX", pct]],
    double: [["amount", "AMOUNT", pct], ["width", "WIDTH", pct], ["tight", "TIGHT", pct]],
    delay: [["mix", "MIX", pct], ["time", "TIME", (v) => ["1/16", "1/8", "1/8.", "1/4", "1/4.", "1/2"][Math.min(5, Math.floor(v * 6))]], ["feedback", "FEEDBACK", pct], ["tone", "DARK", pct]],
    verb: [["mix", "MIX", pct], ["size", "SIZE", pct], ["tone", "DARK", pct]],
  };
  // trigger modes for the time effects (the "effects come right after you stop singing" idea)
  const TRIG = [["always", "ALWAYS"], ["gaps", "GAPS"], ["ends", "ENDS"], ["duck", "DUCK"]];
  function pct(v) { return Math.round(v * 100) + "%"; }
  function db(v, r) { const d = (v - 0.5) * 2 * r; return (d > 0 ? "+" : "") + d.toFixed(1) + "dB"; }

  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function defaults() {
    return {
      tab: "tune",
      key: 9, scale: 1, custom: null, pg: true, midi: false, bypass: false,
      tune: { speed: 0.5, human: 0.25, flex: 0, formant: 0.5, vibrato: true, breath: true, noflip: true, chordtones: false },
      choir: { on: false, mode: "thirds", voices: 0.5, width: 0.7, loose: 0.35, mix: 0.5 },
      vocoder: { on: false, mode: "classic", carrier: "midi", bands: 0.6, tone: 0.5, glide: 0.2, mix: 1 },
      fx: { preset: "", sel: "delay", mix: 1,
        on: { gate: true, eq: true, comp: true, drive: false, double: false, delay: true, verb: true },
        knobs: { gate: { thresh: 0.35 }, eq: { low: 0.35, body: 0.5, presence: 0.6, air: 0.65 }, comp: { amount: 0.55, speed: 0.6, deess: 0.4 },
          drive: { amount: 0.3, tone: 0.5, kind: 0.1, mix: 1 }, double: { amount: 0.5, width: 0.8, tight: 0.6 },
          delay: { mix: 0.25, time: 0.55, feedback: 0.35, tone: 0.4 }, verb: { mix: 0.22, size: 0.55, tone: 0.4 } },
        trig: { delay: "gaps", verb: "always" } },
      stacks: { wild: 0.35, style: "", takes: [] },
      prefs: { a4: 440, voice: "MID", mode: "LIVE", midiCh: "ALL", keySource: "SONG", breathSens: 0.5, layout: "tabs" },
    };
  }

  const FX_PRESETS = [
    { grp: "TRAP", items: [["ASTRO HAZE", 280, "star"], ["MELO LEAD", 270, "wave"], ["RAGE FUZZ", 330, "bolt"], ["SYRUP", 300, "moon"], ["AD-LIB THROW", 250, "up"]] },
    { grp: "CLEAN", items: [["STUDIO CLEAN", 200, "dot"], ["POP SHINE", 190, "star"], ["R&B SILK", 230, "wave"], ["BEDROOM", 260, "moon"], ["RADIO READY", 210, "bolt"]] },
    { grp: "DIRTY", dirty: true, items: [["DEMON", 0, "skull"], ["SCREAM", 0, "flame"], ["TELEPHONE", 0, "phone"], ["TAPE ROT", 0, "wave"], ["MEGAPHONE", 0, "bolt"]] },
  ];

  function open(host, opts) {
    opts = opts || {};
    const api = opts.api || {};
    const S = Object.assign(defaults(), opts.state || {});
    const send = (path, v) => { try { api.set && api.set(path, v, S); } catch (e) { console.warn(e); } };

    const root = h("div", "tt-root");
    root.tabIndex = 0;
    if (S.prefs.layout === "rail") root.classList.add("rail");

    // ---------------------------------------------------------------- top bar
    const top = h("div", "tt-top");
    const brand = h("div", "tt-brand", '<span class="tt-word">TOY<b>TUNE</b></span><span class="tt-lamp"></span>');
    const lamp = brand.querySelector(".tt-lamp");
    const tabs = h("div", "tt-tabs");
    const rail = h("div", "tt-railbox");
    const right = h("div", "tt-right");
    const keyChip = h("button", "tt-chip tt-key");
    const pgChip = h("button", "tt-chip", "<i></i>PG MATCH");
    const midiChip = h("button", "tt-chip", "<i></i>MIDI");
    const gear = h("button", "tt-icon", ICON.gear);
    const power = h("button", "tt-icon on", ICON.power);
    const xb = h("button", "tt-icon tt-x", ICON.x);
    right.append(keyChip, pgChip, midiChip, gear, power);
    if (api.close) right.append(xb);
    for (const [id, label] of TABS) {
      const b = h("button", "", label); b.dataset.tab = id; b.onclick = () => setTab(id); tabs.append(b);
      const r = h("button", "", ICON[id] + "<span>" + label + "</span>"); r.dataset.tab = id; r.onclick = () => setTab(id); rail.append(r);
    }
    top.append(brand, tabs, right);

    const main = h("div", "tt-main");
    const pane = h("div", "tt-pane");
    const faders = h("div", "tt-faders");
    main.append(pane, faders);
    const bottom = h("div", "tt-bottom");
    const prefs = h("div", "tt-prefs"); prefs.hidden = true;
    root.append(top, rail, main, bottom, prefs);
    host.append(root);

    keyChip.onclick = (e) => keyMenu(e.currentTarget);
    pgChip.onclick = () => { S.pg = !S.pg; send("pg", S.pg); paintTop(); };
    midiChip.onclick = () => { S.midi = !S.midi; send("midi", S.midi); paintTop(); if (S.tab === "tune") renderTab(); };
    gear.onclick = () => { prefs.hidden = !prefs.hidden; gear.classList.toggle("on", !prefs.hidden); if (!prefs.hidden) renderPrefs(); };
    power.onclick = () => { S.bypass = !S.bypass; send("bypass", S.bypass); paintTop(); };
    xb.onclick = () => api.close && api.close();

    function paintTop() {
      keyChip.innerHTML = (S.midi ? "MIDI" : NAMES[S.key] + " " + (S.scale === 2 ? "CHROM" : SCALES[S.scale].replace("MAJOR", "MAJ").replace("MINOR", "MIN"))) + '<span class="car"></span>';
      pgChip.classList.toggle("on", !!S.pg);
      midiChip.classList.toggle("on", !!S.midi);
      power.classList.toggle("on", !S.bypass);
      root.classList.toggle("off", !!S.bypass);
      for (const b of root.querySelectorAll("[data-tab]")) {
        b.classList.toggle("on", b.dataset.tab === S.tab);
        b.classList.toggle("lit", (b.dataset.tab === "choir" && !!S.choir.on) || (b.dataset.tab === "vocoder" && !!S.vocoder.on));
      }
    }

    // ---------------------------------------------------------------- small parts
    function fader(label, get, set, opt = {}) {
      const f = h("div", "tt-fader");
      const num = h("div", "tt-fnum"), box = h("div", "tt-fbox" + (opt.mid ? " mid" : "")), fill = h("div", "tt-ffill"), lab = h("div", "tt-flabel", label);
      box.append(fill);
      f.append(h("div", "tt-ftop", opt.top || ""), num, box, lab);
      const paint = () => {
        const v = get();
        if (opt.mid) { const a = Math.min(v, 0.5), b = Math.max(v, 0.5); fill.style.top = (100 - b * 100) + "%"; fill.style.height = ((b - a) * 100) + "%"; }
        else fill.style.height = (v * 100) + "%";
        num.textContent = opt.text ? opt.text(v) : Math.round(v * 100);
      };
      let y0 = 0, v0 = 0;
      box.addEventListener("pointerdown", (e) => {
        e.preventDefault(); box.setPointerCapture(e.pointerId); f.classList.add("drag");
        const r = box.getBoundingClientRect();
        if (e.detail === 2 && opt.def != null) { set(opt.def); paint(); return; }
        y0 = e.clientY; v0 = e.altKey ? get() : 1 - (e.clientY - r.top) / r.height;
        v0 = Math.max(0, Math.min(1, v0)); set(v0); paint();
        const mv = (ev) => { const nv = Math.max(0, Math.min(1, v0 - (ev.clientY - y0) / r.height * (ev.shiftKey ? 0.2 : 1))); set(nv); paint(); };
        const up = () => { f.classList.remove("drag"); box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); };
        box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up);
      });
      paint();
      return f;
    }
    function chip(label, get, set) {
      const c = h("button", "tt-chip", "<i></i>" + label);
      const paint = () => c.classList.toggle("on", !!get());
      c.onclick = () => { set(!get()); paint(); };
      paint();
      return c;
    }
    function seg(items, get, set) {
      const s = h("div", "tt-seg");
      for (const [id, label] of items) {
        const b = h("button", "", label); b.dataset.v = id;
        b.onclick = () => { set(id); for (const x of s.children) x.classList.toggle("on", x.dataset.v === id); };
        b.classList.toggle("on", get() === id);
        s.append(b);
      }
      return s;
    }
    function tile(label, hue, icon, on, click) {
      const t = h("button", "tt-tile" + (on ? " on" : ""), ICON[icon || "dot"] + "<span>" + label + "</span>");
      t.style.setProperty("--th", hue);
      t.dataset.name = label;
      t.onclick = click;
      return t;
    }
    function mini(label, get, set, text) {
      const m = h("div", "tt-mini"), lab = h("span"), bar = h("div", "tt-bar"), fill = h("i");
      bar.append(fill); m.append(lab, bar);
      const paint = () => { const v = get(); fill.style.width = (v * 100) + "%"; lab.innerHTML = label + "<em>" + (text ? text(v) : pct(v)) + "</em>"; };
      m.addEventListener("pointerdown", (e) => {
        e.preventDefault(); m.setPointerCapture(e.pointerId);
        const x0 = e.clientX, v0 = get(), w = m.getBoundingClientRect().width;
        const mv = (ev) => { set(Math.max(0, Math.min(1, v0 + (ev.clientX - x0) / w))); paint(); };
        const up = () => { m.removeEventListener("pointermove", mv); m.removeEventListener("pointerup", up); };
        m.addEventListener("pointermove", mv); m.addEventListener("pointerup", up);
      });
      paint();
      return m;
    }

    // keyboard (bottom of TUNE / CHOIR / VOCODER). In TUNE a click takes a note out of (or back into) the scale.
    let keyEls = [];
    function keyboard(lo, hi, editable) {
      const kb = h("div", "tt-kb"), oct = h("div", "tt-oct", "<span>" + NAMES[lo % 12] + (Math.floor(lo / 12) - 1) + "</span>"), keys = h("div", "tt-keys");
      kb.append(oct, keys);
      keyEls = [];
      for (let n = lo; n <= hi; n++) {
        const b = [1, 3, 6, 8, 10].includes(n % 12);
        const k = h("div", "tt-k" + (b ? " b" : ""), !b && n % 12 === 0 ? "<small>C" + (n / 12 - 1) + "</small>" : "");
        k.dataset.n = n;
        if (editable) k.onclick = () => {
          const pc = ((n - S.key) % 12 + 12) % 12;
          const m = S.custom != null ? S.custom : MASKS[S.scale];
          S.custom = m ^ (1 << pc);
          send("custom", S.custom); paintKeys();
        };
        else if (api.live) {
          // CHOIR / VOCODER: the keys play notes into the engine (carrier / choir root)
          k.onpointerdown = (e) => { e.preventDefault(); api.live(n, true); k.classList.add("down"); };
          const up = () => { if (k.classList.contains("down")) { api.live(n, false); k.classList.remove("down"); } };
          k.onpointerup = up; k.onpointerleave = up;
        }
        keys.append(k); keyEls.push(k);
      }
      paintKeys();
      return kb;
    }
    function paintKeys() {
      for (const k of keyEls) {
        const n = +k.dataset.n;
        k.classList.toggle("out", !S.midi && !inScale(n, S.key, S.scale, S.custom));
      }
    }

    // ---------------------------------------------------------------- tabs
    let graph = null, stage = null;
    function stageBox(label, kind) {
      const b = h("div", "tt-stage", "<b>" + label + "</b>"), cv = h("canvas");
      b.prepend(cv);
      stage = { cv, kind, bands: [] };
      return b;
    }
    // the choir voices for the picture: [{ semi, pan }] (the engine's real ones when it has them)
    const CHOIR_SHAPES = { double: [0, 0], thirds: [0, 4, -5], power: [0, 7, -5], octaves: [0, 12, -12], gospel: [0, 4, 7, 12, -5, -12], angel: [0, 12, 19, 24], dark: [0, -12, -5, -24], chords: [0, 4, 7, -5] };
    function choirVoices() {
      if (api.choirVoices) { const v = api.choirVoices(); if (v) return v; }
      const C = S.choir, n = 2 + Math.round(C.voices * 6), sh = CHOIR_SHAPES[C.mode] || [0];
      const out = [];
      for (let i = 0; i < n; i++) out.push({ semi: sh[i % sh.length] + (i >= sh.length ? (i % 2 ? 12 : -12) : 0), pan: n === 1 ? 0 : ((i % 2 ? 1 : -1) * Math.ceil(i / 2) / Math.ceil((n - 1) / 2)) * C.width });
      return out;
    }
    function drawStage(p) {
      const cv = stage.cv, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (!r.width) return;
      if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const W = cv.width, H = cv.height, g = cv.getContext("2d");
      g.clearRect(0, 0, W, H);
      const lvl = p && p.level ? Math.min(1, p.level * 5) : 0;
      if (stage.kind === "choir") {
        g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(W / 2, 0, dpr, H);
        for (let s = -24; s <= 24; s += 12) { g.fillRect(0, H / 2 - s / 30 * H / 2, W, dpr); }
        for (const v of choirVoices()) {
          const x = W / 2 + v.pan * (W / 2 - 24 * dpr), y = H / 2 - v.semi / 30 * (H / 2), sz = (v.semi === 0 ? 9 : 6) * dpr * (1 + lvl * 0.5);
          g.fillStyle = v.semi === 0 ? "#e4ff3a" : "rgba(167,139,250," + (0.55 + lvl * 0.45) + ")";
          g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
          g.fillStyle = "rgba(236,236,238,0.4)"; g.font = (9 * dpr) + "px Martian Mono, monospace";
          if (v.semi) g.fillText((v.semi > 0 ? "+" : "") + v.semi, x + sz, y + 3 * dpr);
        }
        g.fillStyle = "rgba(236,236,238,0.3)"; g.font = (9 * dpr) + "px Martian Mono, monospace";
        g.fillText("L", 8 * dpr, H - 8 * dpr); g.fillText("R", W - 14 * dpr, H - 8 * dpr);
      } else {
        const n = 8 + Math.round(S.vocoder.bands * 24);
        const live = api.bands ? api.bands() : null;
        for (let i = 0; i < n; i++) {
          const target = live && live.length ? live[Math.floor(i / n * live.length)] : lvl * (0.3 + 0.7 * Math.abs(Math.sin(i * 1.7 + Date.now() / 300)));
          stage.bands[i] = Math.max(target, (stage.bands[i] || 0) * 0.9);
          const bw = W / n, hh = Math.max(dpr, stage.bands[i] * (H - 24 * dpr));
          g.fillStyle = "rgba(139,92,246,0.8)";
          g.fillRect(i * bw + dpr, H - hh, bw - 2 * dpr, hh);
        }
      }
    }
    function setTab(id) { S.tab = id; send("tab", id); prefs.hidden = true; gear.classList.remove("on"); renderTab(); }
    function renderTab() {
      paintTop();
      pane.innerHTML = ""; faders.innerHTML = ""; bottom.innerHTML = ""; graph = null; stage = null;
      ({ tune: tabTune, choir: tabChoir, vocoder: tabVocoder, fx: tabFx, stacks: tabStacks })[S.tab]();
    }

    function tabTune() {
      const T = S.tune;
      const g = h("div", "tt-graph");
      const cv = h("canvas");
      const note = h("div", "tt-note", "<b>--</b><span></span>");
      const cents = h("div", "tt-cents", "<i></i>");
      g.append(cv, note, cents);
      const row = h("div", "tt-row");
      row.append(
        chip("VIBRATO", () => T.vibrato, (v) => { T.vibrato = v; send("tune.vibrato", v); }),
        chip("BREATH SAFE", () => T.breath, (v) => { T.breath = v; send("tune.breath", v); }),
        chip("NO FLIP", () => T.noflip, (v) => { T.noflip = v; send("tune.noflip", v); }),
        chip("CHORD NOTES", () => T.chordtones, (v) => { T.chordtones = v; send("tune.chordtones", v); }),
        h("span", "sp"));
      if (S.custom != null) {
        const rs = h("button", "tt-chip", "RESET NOTES");
        rs.onclick = () => { S.custom = null; send("custom", null); renderTab(); };
        row.append(rs);
      }
      pane.append(g, row);
      faders.append(
        fader("SPEED", () => T.speed, (v) => { T.speed = v; send("tune.speed", v); }, { top: "ROBOT", def: 0.5, text: (v) => (v >= 0.99 ? "0ms" : Math.round(400 * Math.pow(10, -2.6 * v)) + "ms") }),
        fader("HUMAN", () => T.human, (v) => { T.human = v; send("tune.human", v); }, { def: 0.25 }),
        fader("FLEX", () => T.flex, (v) => { T.flex = v; send("tune.flex", v); }, { def: 0 }),
        fader("FORMANT", () => T.formant, (v) => { T.formant = v; send("tune.formant", v); }, { mid: true, def: 0.5, text: (v) => { const s = (v - 0.5) * 12; return (s > 0 ? "+" : "") + s.toFixed(1); } }));
      bottom.append(keyboard(48, 84, true));
      graph = { cv, note: note.querySelector("b"), sub: note.querySelector("span"), cents: cents.querySelector("i"), trail: [] };
    }

    function tabChoir() {
      const C = S.choir;
      const tiles = h("div", "tt-tiles"), grp = h("div", "tt-grp"), grid = h("div", "tt-grid g4");
      grp.append(h("div", "tt-grplabel", "VOICES"), grid);
      for (const [id, label, hue, ic] of CHOIR_MODES)
        grid.append(tile(label, hue, ic, C.on && C.mode === id, () => { C.on = !(C.on && C.mode === id); C.mode = id; send("choir.on", C.on); renderTab(); }));
      tiles.append(grp); tiles.classList.add("fit");
      pane.append(tiles, stageBox("STAGE", "choir"));
      faders.append(
        fader("VOICES", () => C.voices, (v) => { C.voices = v; send("choir.voices", v); }, { text: (v) => String(2 + Math.round(v * 6)) }),
        fader("WIDTH", () => C.width, (v) => { C.width = v; send("choir.width", v); }),
        fader("LOOSE", () => C.loose, (v) => { C.loose = v; send("choir.loose", v); }),
        fader("MIX", () => C.mix, (v) => { C.mix = v; send("choir.mix", v); }));
      bottom.append(keyboard(48, 84, false));
    }

    function tabVocoder() {
      const V = S.vocoder;
      const tiles = h("div", "tt-tiles"), grp = h("div", "tt-grp"), grid = h("div", "tt-grid g4");
      const head = h("div", "tt-row");
      head.append(h("div", "tt-grplabel", "CARRIER"), h("span", "sp"),
        seg([["midi", "MIDI"], ["chords", "PG CHORDS"], ["voice", "OWN NOTE"]], () => V.carrier, (v) => { V.carrier = v; send("vocoder.carrier", v); }));
      grp.append(h("div", "tt-grplabel", "KIND"), grid);
      for (const [id, label, hue, ic] of VOC_MODES)
        grid.append(tile(label, hue, ic, V.on && V.mode === id, () => { V.on = !(V.on && V.mode === id); V.mode = id; send("vocoder.on", V.on); renderTab(); }));
      tiles.append(grp); tiles.classList.add("fit");
      pane.append(tiles, head, stageBox("BANDS", "vocoder"));
      faders.append(
        fader("BANDS", () => V.bands, (v) => { V.bands = v; send("vocoder.bands", v); }, { text: (v) => String(8 + Math.round(v * 24)) }),
        fader("TONE", () => V.tone, (v) => { V.tone = v; send("vocoder.tone", v); }),
        fader("GLIDE", () => V.glide, (v) => { V.glide = v; send("vocoder.glide", v); }),
        fader("MIX", () => V.mix, (v) => { V.mix = v; send("vocoder.mix", v); }));
      bottom.append(keyboard(36, 72, false));
    }

    function tabFx() {
      const F = S.fx;
      const pr = h("div", "tt-prompt"), inp = h("input"), go = h("button", "", "MAKE");
      inp.placeholder = "TYPE A VOCAL";
      inp.spellcheck = false;
      pr.append(h("span", "gt", ">"), inp, go);
      const doPrompt = async () => {
        const text = inp.value.trim();
        if (!text || !api.prompt) return;
        pr.classList.add("busy");
        try { const p = await api.prompt(text); if (p) { applyPreset(p); renderTab(); } } finally { pr.classList.remove("busy"); }
      };
      go.onclick = doPrompt;
      inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") doPrompt(); });
      const tiles = h("div", "tt-tiles");
      for (const g of FX_PRESETS) {
        const grp = h("div", "tt-grp" + (g.dirty ? " dirty" : "")), grid = h("div", "tt-grid");
        grp.append(h("div", "tt-grplabel", g.grp), grid);
        for (const [name, hue, ic] of g.items)
          grid.append(tile(name, hue, ic, F.preset === name, async () => {
            const p = api.preset ? await api.preset(name) : null;
            F.preset = name; if (p) applyPreset(p); else send("fx.preset", name);
            renderTab();
          }));
        tiles.append(grp);
      }
      // the picked module's knobs
      const det = h("div", "tt-detail");
      const sel = F.sel;
      det.append(h("span", "ttl", (FX_MODS.find((m) => m[0] === sel) || [0, ""])[1]));
      for (const [id, label, text] of MOD_KNOBS[sel])
        det.append(mini(label, () => F.knobs[sel][id], (v) => { F.knobs[sel][id] = v; send("fx." + sel + "." + id, v); paintChain(); }, text));
      if (F.trig[sel]) {
        det.append(h("span", "sp"));
        det.append(seg(TRIG, () => F.trig[sel], (v) => { F.trig[sel] = v; send("fx." + sel + ".trig", v); paintChain(); }));
      }
      det.querySelector(".sp") || det.append(h("span", "sp"));
      pane.append(pr, tiles, det);
      faders.append(
        fader("SPACE", () => F.knobs.verb.mix, (v) => { F.knobs.verb.mix = v; send("fx.verb.mix", v); paintChain(); }),
        fader("ECHO", () => F.knobs.delay.mix, (v) => { F.knobs.delay.mix = v; send("fx.delay.mix", v); paintChain(); }),
        fader("DIRT", () => F.knobs.drive.amount, (v) => { F.knobs.drive.amount = v; F.on.drive = v > 0.02; send("fx.drive.amount", v); send("fx.drive.on", F.on.drive); paintChain(); }),
        fader("MIX", () => F.mix, (v) => { F.mix = v; send("fx.mix", v); }));
      // bottom: the chain, in its fixed order
      const chain = h("div", "tt-chain");
      for (const [id, label] of FX_MODS) {
        const m = h("div", "tt-mod"); m.dataset.mod = id;
        const hd = h("h4", "", "<i></i>" + label);
        hd.querySelector("i").onclick = (e) => { e.stopPropagation(); F.on[id] = !F.on[id]; send("fx." + id + ".on", F.on[id]); paintChain(); };
        m.append(hd, h("div", "val"), h("div", "tt-bar", "<i></i>"));
        if (F.trig[id]) { const md = h("button", "tt-mode"); md.onclick = (e) => { e.stopPropagation(); trigMenu(md, id); }; m.append(md); }
        m.onclick = () => { F.sel = id; renderTab(); };
        chain.append(m);
      }
      bottom.append(chain);
      paintChain();
    }
    function paintChain() {
      const F = S.fx;
      for (const m of root.querySelectorAll(".tt-mod")) {
        const id = m.dataset.mod, k = MOD_KNOBS[id][0], v = F.knobs[id][k[0]];
        m.classList.toggle("on", !!F.on[id]);
        m.classList.toggle("sel", F.sel === id);
        m.querySelector(".val").textContent = k[2](v);
        m.querySelector(".tt-bar i").style.width = (v * 100) + "%";
        const md = m.querySelector(".tt-mode");
        if (md) md.innerHTML = (TRIG.find((t) => t[0] === F.trig[id]) || TRIG[0])[1] + '<span class="car" style="width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-top:4px solid currentColor;opacity:.7"></span>';
      }
    }
    function applyPreset(p) {
      const F = S.fx;
      if (p.name) F.preset = p.name;
      if (p.on) Object.assign(F.on, p.on);
      if (p.knobs) for (const k in p.knobs) Object.assign(F.knobs[k] = F.knobs[k] || {}, p.knobs[k]);
      if (p.trig) Object.assign(F.trig, p.trig);
      if (p.tune) Object.assign(S.tune, p.tune);
      send("fx.all", F);
      if (p.tune) send("tune.all", S.tune);
    }

    function tabStacks() {
      const K = S.stacks;
      const wrap = h("div", "tt-stack");
      const src = h("div", "tt-src", "<b>THIS VOCAL</b>"), scv = h("canvas");
      src.prepend(scv);
      const big = h("div", "tt-big");
      const kinds = [["remaster", "REMASTER", 280, "star"], ["stacks", "STACKS", 250, "stacks"], ["harmony", "HARMONY", 300, "choir"]];
      for (const [id, label, hue, ic] of kinds)
        big.append(tile(label, hue, ic, false, () => runStack(id, label)));
      const row = h("div", "tt-row");
      const st = h("div", "tt-prompt"), si = h("input");
      si.placeholder = "STYLE"; si.value = K.style || ""; si.spellcheck = false;
      si.addEventListener("keydown", (e) => e.stopPropagation());
      si.addEventListener("input", () => { K.style = si.value; });
      st.style.gridTemplateColumns = "auto minmax(0,1fr)";
      st.append(h("span", "gt", ">"), si);
      st.style.flex = "1";
      row.append(st);
      wrap.append(src, big, row);
      pane.append(wrap);
      faders.append(fader("WILD", () => K.wild, (v) => { K.wild = v; send("stacks.wild", v); }, { top: "", text: (v) => (v < 0.34 ? "CLOSE" : v < 0.67 ? "MID" : "WILD") }));
      const tk = h("div", "tt-takes");
      bottom.append(tk);
      paintTakes();
      Promise.resolve(api.peaks ? api.peaks() : null).catch(() => null).then((pk) => requestAnimationFrame(() => drawWave(scv, pk)));
    }
    async function runStack(kind, label) {
      const K = S.stacks;
      const t = { id: "w" + Date.now(), label, wait: true };
      K.takes.unshift(t); paintTakes();
      try {
        const r = api.stack ? await api.stack(kind, { wild: K.wild, style: K.style }) : null;
        const i = K.takes.indexOf(t);
        if (r && r.takes && r.takes.length) K.takes.splice(i, 1, ...r.takes.map((x, j) => ({ label: label + " " + (j + 1), ...x })));
        else K.takes.splice(i, 1);
      } catch (e) { K.takes.splice(K.takes.indexOf(t), 1); }
      paintTakes();
    }
    function paintTakes() {
      const tk = root.querySelector(".tt-takes");
      if (!tk) return;
      tk.innerHTML = "";
      for (const t of S.stacks.takes) {
        const c = h("div", "tt-take" + (t.wait ? " wait" : "") + (t.on ? " on" : ""), "<b>" + t.label + "</b>");
        const cv = h("canvas"); c.append(cv, h("small", "", t.wait ? "..." : (t.secs ? t.secs.toFixed(1) + "s" : "")));
        c.onclick = () => { if (t.wait) return; S.stacks.takes.forEach((x) => (x.on = x === t)); api.useTake && api.useTake(t); paintTakes(); };
        tk.append(c);
        if (!t.wait) requestAnimationFrame(() => drawWave(cv, t.peaks || null));
      }
    }
    function drawWave(cv, peaks) {
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
      const g = cv.getContext("2d"), W = cv.width, H = cv.height;
      g.fillStyle = "rgba(139,92,246,0.75)";
      for (let x = 0; x < W; x += 2 * dpr) {
        const i = x / W;
        const v = peaks && peaks.length ? peaks[Math.floor(i * peaks.length)] : Math.abs(Math.sin(i * 37) * Math.sin(i * 5.3)) * (0.3 + 0.7 * Math.abs(Math.sin(i * 2.1)));
        const hh = Math.max(dpr, v * H * 0.8);
        g.fillRect(x, (H - hh) / 2, dpr, hh);
      }
    }

    // ---------------------------------------------------------------- menus
    let menu = null;
    function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener("pointerdown", outside, true); } }
    function outside(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
    function place(m, anchor) {
      const rr = root.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
      root.append(m);
      const w = m.offsetWidth;
      m.style.left = Math.max(6, Math.min(rr.width - w - 6, ar.right - rr.left - w)) + "px";
      m.style.top = (ar.bottom - rr.top + 4) + "px";
      menu = m;
      setTimeout(() => document.addEventListener("pointerdown", outside, true));
    }
    function keyMenu(anchor) {
      closeMenu();
      const m = h("div", "tt-menu"), grid = h("div", "tt-mgrid");
      NAMES.forEach((n, i) => { const b = h("button", S.key === i ? "on" : "", n); b.onclick = () => { S.key = i; S.custom = null; S.midi = false; send("key", i); send("midi", false); closeMenu(); renderTab(); }; grid.append(b); });
      const list = h("div", "tt-mlist");
      SCALES.forEach((n, i) => { const b = h("button", S.scale === i ? "on" : "", n); b.onclick = () => { S.scale = i; S.custom = null; send("scale", i); closeMenu(); renderTab(); }; list.append(b); });
      m.append(grid, h("hr"), list);
      place(m, anchor);
    }
    function trigMenu(anchor, id) {
      closeMenu();
      const m = h("div", "tt-menu"), list = h("div", "tt-mlist");
      for (const [v, label] of TRIG) { const b = h("button", S.fx.trig[id] === v ? "on" : "", label); b.onclick = () => { S.fx.trig[id] = v; send("fx." + id + ".trig", v); closeMenu(); renderTab(); }; list.append(b); }
      m.append(list);
      place(m, anchor);
    }

    // ---------------------------------------------------------------- preferences (things you set once)
    function renderPrefs() {
      const P = S.prefs;
      prefs.innerHTML = "";
      const row = (label, ctl) => { const r = h("div", "tt-pref"); r.append(h("span", "", label), ctl); prefs.append(r); };
      row("VOICE", seg([["HIGH", "HIGH"], ["MID", "MID"], ["LOW", "LOW"], ["BASS", "BASS"]], () => P.voice, (v) => { P.voice = v; send("prefs.voice", v); }));
      row("MODE", seg([["LIVE", "LIVE"], ["STUDIO", "STUDIO"]], () => P.mode, (v) => { P.mode = v; send("prefs.mode", v); }));
      row("KEY FROM", seg([["SONG", "SONG"], ["PG", "PG MATCH"], ["SET", "MANUAL"]], () => P.keySource, (v) => { P.keySource = v; send("prefs.keySource", v); }));
      row("MIDI CH", seg([["ALL", "ALL"], ["1", "1"], ["2", "2"], ["10", "10"]], () => P.midiCh, (v) => { P.midiCh = v; send("prefs.midiCh", v); }));
      row("A4", seg([["432", "432"], ["440", "440"], ["442", "442"]], () => String(P.a4), (v) => { P.a4 = +v; send("prefs.a4", +v); }));
      row("BREATH", mini("SENS", () => P.breathSens, (v) => { P.breathSens = v; send("prefs.breathSens", v); }));
      row("LAYOUT", seg([["tabs", "TABS"], ["rail", "RAIL"]], () => P.layout, (v) => { P.layout = v; root.classList.toggle("rail", v === "rail"); send("prefs.layout", v); }));
    }

    // ---------------------------------------------------------------- the live pitch picture
    let raf = 0, alive = true;
    function frame() {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const p = api.pitch ? api.pitch() : null;
      lamp.style.opacity = p && p.level ? String(0.15 + Math.min(0.85, p.level * 4)) : "0.15";
      if (stage) drawStage(p);
      if (!graph) return;
      const cv = graph.cv, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (!r.width) return;
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const W = cv.width, H = cv.height, g = cv.getContext("2d");
      const tr = graph.trail;
      tr.push(p && p.in ? { i: p.in, o: p.out, t: p.target } : null);
      if (tr.length > 360) tr.shift();
      // the range follows the voice
      const seen = tr.filter(Boolean);
      const mid = seen.length ? seen.reduce((a, x) => a + x.o, 0) / seen.length : 60;
      graph.mid = graph.mid == null ? mid : graph.mid + (mid - graph.mid) * 0.05;
      const lo = graph.mid - 7, hi = graph.mid + 7, Y = (n) => H - (n - lo) / (hi - lo) * H;
      g.clearRect(0, 0, W, H);
      // note rows: in-scale rows lighter, the target row acid
      const cur = seen.length ? seen[seen.length - 1] : null, tgt = cur ? Math.round(cur.t != null ? cur.t : cur.o) : null;
      for (let n = Math.floor(lo); n <= Math.ceil(hi); n++) {
        const y = Y(n);
        const ins = S.midi || inScale(n, S.key, S.scale, S.custom);
        g.fillStyle = n === tgt ? "rgba(228,255,58,0.10)" : ins ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0)";
        g.fillRect(0, y - (H / (hi - lo)) / 2, W, H / (hi - lo));
        g.fillStyle = ins ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)";
        g.fillRect(0, Math.round(y), W, dpr);
        if (ins) { g.fillStyle = n === tgt ? "#e4ff3a" : "rgba(236,236,238,0.32)"; g.font = (9 * dpr) + "px Martian Mono, monospace"; g.fillText(NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1), W - 30 * dpr, y + 3 * dpr); }
      }
      const step = (W - 40 * dpr) / 360;
      const line = (key, col, wd) => {
        g.strokeStyle = col; g.lineWidth = wd * dpr; g.beginPath();
        let pen = false;
        tr.forEach((s, i) => { if (!s) { pen = false; return; } const x = i * step, y = Y(s[key]); if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y); });
        g.stroke();
      };
      line("i", "rgba(236,236,238,0.35)", 1.2);
      line("o", "#a78bfa", 2);
      if (cur) {
        const n = Math.round(cur.o);
        graph.note.textContent = NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
        const c = Math.round((cur.i - Math.round(cur.i)) * 100);
        graph.sub.textContent = (c > 0 ? "+" : "") + c + "c";
        graph.cents.style.left = (50 + Math.max(-50, Math.min(50, c))) + "%";
      }
    }
    raf = requestAnimationFrame(frame);

    root.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (menu) closeMenu(); else if (!prefs.hidden) { prefs.hidden = true; gear.classList.remove("on"); } } });
    renderTab();

    return {
      root, state: S,
      setTab, render: renderTab,
      setState(ns) { Object.assign(S, ns); renderTab(); },
      setTakes(t) { S.stacks.takes = t; paintTakes(); },
      highlight(notes) { for (const k of keyEls) k.classList.toggle("hit", notes.includes(+k.dataset.n)); },
      destroy() { alive = false; cancelAnimationFrame(raf); closeMenu(); root.remove(); },
    };
  }

  window.ToyTuneUI = { open, NAMES, SCALES, MASKS, inScale, defaults, FX_PRESETS };
})();
