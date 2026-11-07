// KILLDRUM: KILLTOY's drum machine. Nine pads (kick, 808, snare, clap, hats, perc, FX, texture)
// played from a MIDI lane's notes; each pad has a sound, Pitch, Decay, Drive, Filter, Pan, Level
// and a few effects. A kit can be brought in (saved and starter kits), rolled with the dice, or
// typed as a vibe ("dark carti 808s, crunchy snares"); after that the same box takes follow-ups
// ("make the snare more distorted", "add reverb to the clap").
//
// The sounds and the vibe words come from window.KillDrumLib (ui/killdrum-library.js) when it
// is there; a small fallback below reads the Sound Library's INDEX.json so this works alone.
// The window edits a plain kit object and hands it back through api.setKit; the sound runs in
// the playground (playKit) or the app.
(function () {
  "use strict";

  // Pad slot -> MIDI note (the General MIDI drum notes where there is one).
  const PADS = [
    { slot: "kick", note: 36, label: "Kick", key: "1" },
    { slot: "808", note: 35, label: "808", key: "2" },
    { slot: "snare", note: 38, label: "Snare", key: "3" },
    { slot: "clap", note: 39, label: "Clap", key: "4" },
    { slot: "hat_closed", note: 42, label: "Closed hat", key: "5" },
    { slot: "hat_open", note: 46, label: "Open hat", key: "6" },
    { slot: "perc", note: 37, label: "Perc", key: "7" },
    { slot: "fx", note: 49, label: "FX", key: "8" },
    { slot: "texture", note: 51, label: "Texture", key: "9" },
  ];
  const BY_NOTE = Object.fromEntries(PADS.map((p) => [p.note, p]));
  const BY_SLOT = Object.fromEntries(PADS.map((p) => [p.slot, p]));
  // Which library types can sit on a pad (an 808 pad takes deep kicks until real 808s land).
  const FITS = { kick: ["kick"], "808": ["808", "kick"], snare: ["snare"], clap: ["clap", "snare"], hat_closed: ["hat_closed", "hat"], hat_open: ["hat_open", "hat_closed", "hat"],
                 perc: ["perc", "hat_closed", "clap"], fx: ["fx", "texture"], texture: ["texture", "fx"] };
  const FX_KINDS = [["reverb", "Reverb"], ["delay", "Delay"], ["clip", "Clip"], ["crush", "Crush"], ["drive", "Drive"]];
  const KNOBS = [
    { id: "tune", label: "Pitch", min: -24, max: 24, def: 0, fmt: (v) => (v > 0 ? "+" : "") + Math.round(v) + " st", step: 1 },
    { id: "decay", label: "Decay", min: 0, max: 1, def: 1, fmt: (v) => (v >= 0.99 ? "Full" : Math.round(v * 100) + "%") },
    { id: "drive", label: "Drive", min: 0, max: 1, def: 0, fmt: (v) => Math.round(v * 100) + "%" },
    { id: "cutoff", label: "Filter", min: 0, max: 1, def: 1, fmt: (v) => (v >= 0.99 ? "Open" : Math.round(60 * Math.pow(20000 / 60, v)) + " Hz") },
    { id: "pan", label: "Pan", min: -1, max: 1, def: 0, fmt: (v) => (Math.abs(v) < 0.02 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100)) },
    { id: "level", label: "Level", min: -24, max: 12, def: 0, fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1) + " dB" },
  ];

  // ------------------------------------------------------------------ sounds (fallback library)
  const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9#]+/g, " ").split(" ").filter(Boolean);
  const Fallback = {
    _items: null,
    async load() {
      if (this._items) return this._items;
      const out = [];
      for (const [base, idx] of [["library/", "library/INDEX.json"], ["killdrum/", "killdrum/INDEX.json"]]) {
        try {
          const r = await fetch(idx, { cache: "no-cache" });
          if (!r.ok) continue;
          const j = await r.json();
          for (const x of j.items || j.sounds || j) {
            const url = x.url || (x.preview ? base + x.preview : null);
            if (!url) continue;
            let type = x.type === "hat" ? "hat_closed" : x.type;
            if (type === "fx" && (x.tone || x.tags || []).includes("texture")) type = "texture";
            out.push({ id: x.id, name: x.name, type, url, duration_s: x.duration_s, source: x.source,
                       tags: [...new Set([...(x.tags || []), ...(x.tone || []), ...words(x.song), ...words(x.artist), ...words(x.name)])] });
          }
        } catch (e) { /* not in this build */ }
      }
      return (this._items = out);
    },
    items() { return this._items || []; },
    kits() { return []; },
  };
  const Lib = () => window.KillDrumLib || Fallback;

  // Words -> what they mean for a pad. Used by the fallback vibe/follow-up reader.
  const SLOT_WORDS = [
    ["808", /\b(808s?|sub|subs|bass)\b/], ["hat_open", /\bopen ?hats?\b/], ["hat_closed", /\b(hats?|hi ?hats?|hihats?|closed ?hats?)\b/],
    ["kick", /\b(kicks?|bd|bass ?drums?)\b/], ["snare", /\b(snares?|rims?)\b/], ["clap", /\b(claps?|snaps?)\b/],
    ["perc", /\b(percs?|percussion|toms?|shakers?|bongos?|congas?)\b/], ["texture", /\b(textures?|vinyl|hiss|haze|noise|foley|ambience)\b/],
    ["fx", /\b(fx|riser|risers|impact|sweep|swell|effects? sound)\b/],
  ];
  const SYN = {
    dark: ["dark", "deep", "warm", "round", "sub"], deep: ["deep", "sub", "round"], crunchy: ["crisp", "punchy", "dirty", "distorted"],
    distorted: ["distorted", "dirty", "crisp"], dirty: ["dirty", "distorted"], punchy: ["punchy", "tight"], soft: ["warm", "round", "soft"],
    bright: ["bright", "crisp", "snappy"], tight: ["tight", "short", "snappy"], snappy: ["snappy", "crisp", "tight"], lofi: ["warm", "dark", "crackle", "hiss"],
    "lo": ["warm", "dark"], dusty: ["warm", "dark", "crackle", "hiss"], vinyl: ["crackle", "hiss"], sad: ["sad", "hours", "blue", "hour", "ambient"], ambient: ["ambient", "texture"], hard: ["punchy", "crisp"], rage: ["punchy", "crisp", "distorted"],
    carti: ["punchy", "deep", "distorted"], trap: ["punchy", "deep", "crisp"], house: ["tight", "punchy", "crisp"], techno: ["tight", "punchy", "dark"],
  };
  const expand = (ws) => [...new Set(ws.flatMap((w) => [w, ...(SYN[w] || [])]))];
  function scoreItem(it, want, seed) {
    let s = 0;
    for (const w of want) if (it.tags.includes(w)) s += 1;
    return s + rand(seed + it.id) * 0.9;
  }
  function rand(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
  function pickFor(slot, want, seed, not) {
    const items = Lib().items();
    for (const type of FITS[slot] || [slot]) {
      const pool = items.filter((x) => x.type === type && x.id !== not);
      if (!pool.length) continue;
      pool.sort((a, b) => scoreItem(b, want, seed) - scoreItem(a, want, seed));
      return pool[0];
    }
    return null;
  }
  // Tone words -> knob moves on a pad.
  function moves(ws, pad) {
    const p = {}, fx = [], unfx = [];
    const has = (re) => ws.some((w) => re.test(w));
    const more = has(/^(more|much|very|extra|super|really)$/), less = has(/^(less|little|bit|slightly)$/);
    const step = more ? 0.5 : less ? 0.15 : 0.3;
    if (has(/^(distort|distorted|crunchy|crunch|dirty|clipped|gritty|saturated|blown|harder|rage)$/)) p.drive = Math.min(1, (pad.drive || 0) + step);
    if (has(/^(clean|cleaner|undistorted)$/)) p.drive = 0;
    if (has(/^(dark|darker|muffled|warmer|duller|lofi|underwater)$/)) p.cutoff = Math.max(0.25, (pad.cutoff != null ? pad.cutoff : 1) - step);
    if (has(/^(bright|brighter|open|crisper|airy)$/)) p.cutoff = 1;
    if (has(/^(long|longer|boomy|ringing|tail)$/)) p.decay = Math.min(1, (pad.decay != null ? pad.decay : 1) + step);
    if (has(/^(short|shorter|tight|tighter|choppy|clipped)$/)) p.decay = Math.max(0.1, (pad.decay != null ? pad.decay : 1) - step - 0.1);
    if (has(/^(higher|up|pitched)$/) && !has(/^(down|lower)$/)) p.tune = (pad.tune || 0) + (more ? 5 : 2);
    if (has(/^(lower|down|deeper)$/)) p.tune = (pad.tune || 0) - (more ? 5 : 2);
    if (has(/^(louder|loud)$/)) p.level = Math.min(12, (pad.level || 0) + 3);
    if (has(/^(quieter|softer|lower volume|down volume)$/)) p.level = Math.max(-24, (pad.level || 0) - 3);
    if (has(/^left$/)) p.pan = -0.4; if (has(/^right$/)) p.pan = 0.4; if (has(/^(center|centre|middle)$/)) p.pan = 0;
    const no = has(/^(no|remove|without|off|kill|less)$/);
    for (const [k] of FX_KINDS) if (ws.includes(k) || (k === "reverb" && has(/^(verb|room|hall|space|spacey|roomy|wet)$/)) || (k === "delay" && has(/^(echo|echoes)$/)) || (k === "crush" && has(/^(bitcrush|crushed|8bit|bit)$/)))
      (no ? unfx : fx).push(k);
    const pm = ws.join(" ").match(/(up|down|\+|-)\s*(\d+)\s*(st|semi|semitones?)/);
    if (pm) p.tune = (pad.tune || 0) + (pm[1] === "down" || pm[1] === "-" ? -1 : 1) * Number(pm[2]);
    return { p, fx, unfx };
  }
  function slotsIn(text) {
    const t = " " + text.toLowerCase() + " ";
    return SLOT_WORDS.filter(([, re]) => re.test(t)).map(([s]) => s).filter((s, i, a) => !(s === "hat_closed" && a.includes("hat_open") && !/\bclosed\b/.test(t)) && a.indexOf(s) === i);
  }
  // A vibe -> a whole kit. -> { name, pads: { slot: itemId }, params, fx, say }
  function fallbackVibe(text, seed) {
    const ws = expand(words(text)), pads = {}, params = {}, fx = {};
    const parts = text.split(/[,.;]| and | with /i).map((x) => x.trim()).filter(Boolean);
    for (const P of PADS) {
      const mine = parts.filter((x) => slotsIn(x).includes(P.slot));
      const want = expand(words(mine.join(" "))).concat(ws);
      const it = pickFor(P.slot, want, seed + P.slot);
      if (it) pads[P.slot] = it.id;
      const m = moves(words(mine.join(" ")), {});
      if (Object.keys(m.p).length) params[P.slot] = m.p;
      if (m.fx.length) fx[P.slot] = m.fx;
    }
    const g = moves(words(parts.filter((x) => !slotsIn(x).length).join(" ")), {});
    for (const P of PADS) { if (Object.keys(g.p).length) params[P.slot] = { ...g.p, ...(params[P.slot] || {}) }; }
    return { name: titleOf(text), pads, params, fx, say: "Built a kit from the Library for that vibe." };
  }
  // A follow-up on a kit -> changes. -> { changes: [{ slot, sound?, params?, addFx?, removeFx? }], say }
  function fallbackFollow(text, kit, seed) {
    const ws = words(text);
    let slots = slotsIn(text);
    if (!slots.length && /\b(all|everything|whole kit|kit|drums)\b/i.test(text)) slots = PADS.map((p) => p.slot);
    if (!slots.length) return { changes: [], say: "Which pad? Say kick, 808, snare, clap, hats, perc, FX or texture." };
    const swap = /\b(change|swap|replace|different|another|new|other|switch|find)\b/i.test(text);
    const changes = [], said = [];
    for (const slot of slots) {
      const pad = (kit.pads && kit.pads[slot]) || {}, m = moves(ws, pad), ch = { slot };
      if (swap || (!Object.keys(m.p).length && !m.fx.length && !m.unfx.length)) {
        const it = pickFor(slot, expand(ws), seed + slot + text, pad.sound);
        if (it) { ch.sound = it.id; said.push(`${BY_SLOT[slot].label} is now ${it.name}`); }
        // a swap for "a more distorted snare" also turns its drive up if no sound says distorted
        if (it && m.p.drive != null && !it.tags.some((w) => /distort|dirty/.test(w))) ch.params = { drive: m.p.drive };
      }
      if (!swap || Object.keys(m.p).length) {
        if (Object.keys(m.p).length) ch.params = { ...(ch.params || {}), ...m.p };
      }
      if (m.fx.length) ch.addFx = m.fx[0];
      if (m.unfx.length) ch.removeFx = m.unfx[0];
      if (ch.params) said.push(`${BY_SLOT[slot].label}: ${Object.entries(ch.params).map(([k, v]) => `${KNOBS.find((x) => x.id === k).label} ${KNOBS.find((x) => x.id === k).fmt(v)}`).join(", ")}`);
      if (ch.addFx) said.push(`${ch.addFx} on the ${BY_SLOT[slot].label.toLowerCase()}`);
      if (ch.removeFx) said.push(`${ch.removeFx} off the ${BY_SLOT[slot].label.toLowerCase()}`);
      changes.push(ch);
    }
    return { changes, say: said.length ? said.join(". ") + "." : "Nothing to change there." };
  }
  const titleOf = (t) => { const s = String(t || "").trim().replace(/\s+/g, " "); return s ? (s.length > 28 ? s.slice(0, 26) + "…" : s).replace(/^\w/, (c) => c.toUpperCase()) : "New kit"; };

  // ------------------------------------------------------------------ kit <-> engine
  // The window's kit: { name, pads: { slot: { sound, name, url, tune, decay, drive, cutoff, pan, level, fx: [{kind, amount}] } } }
  // The engine's: kit/kitName/kitGain/kitPad/kitId keyed by MIDI note.
  function fromEngine(e) {
    const pads = {};
    for (const [note, url] of Object.entries(e.kit || {})) {
      const P = BY_NOTE[note]; const slot = P ? P.slot : "n" + note;
      const pp = (e.kitPad && e.kitPad[note]) || {};
      pads[slot] = { ...pp, note: Number(note), url, name: (e.kitName && e.kitName[note]) || (P ? P.label : "Pad " + note), sound: e.kitId && e.kitId[note],
                     level: 20 * Math.log10((e.kitGain && e.kitGain[note]) || 1), tune: pp.tune || 0, decay: pp.decay != null ? pp.decay : 1,
                     drive: pp.drive || 0, cutoff: pp.cutoff != null ? pp.cutoff : 1, pan: pp.pan || 0, fx: (pp.fx || []).map((x) => ({ ...x })) };
    }
    return { name: e.kitTitle || "Kit", pads, choke: e.choke || [[42, 46]], void: e.kitVoid, vibe: e.kitVibe };
  }
  function toEngine(k) {
    const e = { kit: {}, kitName: {}, kitGain: {}, kitPad: {}, kitId: {}, kitTitle: k.name, choke: k.choke || [[42, 46]] };
    if (k.void !== undefined) e.kitVoid = k.void;
    if (k.vibe !== undefined) e.kitVibe = k.vibe;
    for (const [slot, p] of Object.entries(k.pads)) {
      if (!p || !p.url) continue;
      const note = p.note || (BY_SLOT[slot] && BY_SLOT[slot].note);
      e.kit[note] = p.url; e.kitName[note] = p.name; e.kitGain[note] = Math.pow(10, (p.level || 0) / 20);
      if (p.sound) e.kitId[note] = p.sound;
      // every other field a tab put on the pad (layers, …) rides along
      const { note: _n, url: _u, name: _nm, sound: _s, level: _l, ...rest } = p;
      e.kitPad[note] = { ...rest, tune: p.tune || 0, decay: p.decay, drive: p.drive || 0, cutoff: p.cutoff, pan: p.pan || 0, fx: p.fx || [] };
    }
    return e;
  }
  // gainDb: the library's level trim for that sound (previews differ in loudness)
  function soundOnto(pad, it) { return Object.assign(pad, { sound: it.id, url: it.url, name: it.name, gainDb: it.gain_db || 0 }); }

  // ------------------------------------------------------------------ saved kits
  const SAVE_KEY = "killdrum.kits";
  const savedKits = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); } catch (e) { return []; } };
  const saveKits = (list) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch (e) { /* private window */ } };

  // ------------------------------------------------------------------ the window
  const LOOK_IMG = new Image();
  LOOK_IMG.src = "toymachine-looks.jpg"; // 5 x 4 greyscale tiles of 256 px (TOY MACHINE's looks)
  let lookOff = null;
  const lookCanvas = (W, H) => { if (!lookOff) lookOff = document.createElement("canvas"); lookOff.width = W; lookOff.height = H; return lookOff; };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const DICE = '<svg viewBox="0 0 24 24" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/></svg>';
  const CLOSE = '<svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function open(host, opts) {
    const api = opts.api || {};
    let kit = fromEngine(opts.kit || {}), sel = "kick", seed = Date.now() % 100000;
    const used = opts.used || {};
    const peaks = {}; // url -> peaks
    const undo = [];

    const root = h("div", "tm-root kd-root");
    root.tabIndex = 0;
    root.innerHTML = `
      <div class="tm-top">
        <div class="tm-brand"><img class="tm-wordmark tm-logo kd-logo" src="killdrum-logo.png" alt="KILLDRUM" draggable="false"><span class="tm-title"></span></div>
        <div class="tm-nav kd-nav">
          <div class="kd-tabs"></div>
          <button class="kd-kitname" title="Bring a kit: your saved kits and the starter kits"></button>
          <button class="tm-iconbtn kd-dice" title="Roll a new kit (click). Shift-click: only the selected pad">${DICE}</button>
          <button class="kd-small kd-save" title="Save this kit to your kits">Save</button>
          <button class="kd-small kd-undo" title="Undo the last change: dice, ROLL, sounds, patterns, steps (Cmd+Z)">\u21b6 Undo</button>
          <button class="kd-small kd-redo" title="Redo (Cmd+Shift+Z)">\u21b7</button>
        </div>
        <div class="tm-topright"><button class="tm-iconbtn tm-closebtn" title="Close">${CLOSE}</button></div>
      </div>
      <div class="kd-main">
        <div class="kd-padsWrap"><div class="kd-pads"></div></div>
        <div class="kd-side">
          <div class="kd-padhead"><button class="kd-small kd-back" hidden title="Back to the beat">\u2039 Beat</button><span class="kd-padlabel"></span><span class="kd-padsound"></span><button class="tm-iconbtn kd-paddice" title="New sound for this pad">${DICE}</button></div>
          <canvas class="kd-shape" width="560" height="150"></canvas>
          <div class="kd-knobs"></div>
          <div class="kd-fx"></div>
          <div class="kd-browse"><input class="kd-search" placeholder="Search sounds for this pad" spellcheck="false"><div class="kd-list"></div></div>
        </div>
      </div>
      <div class="kd-panes" hidden></div>
      <div class="kd-vibe">
        <input class="kd-prompt" spellcheck="false" placeholder="Type a vibe (dark carti 808s, crunchy snares) or a change (add reverb to the clap)">
        <button class="kd-go" title="A new kit from a vibe, or a change to this one (\u201cmore distorted snare\u201d)">Go</button>
        <span class="kd-said"></span>
      </div>
      <div class="kd-kits" hidden></div>`;
    host.append(root);
    const $ = (s) => root.querySelector(s);
    $(".tm-title").textContent = opts.title || "";
    $(".tm-closebtn").onclick = () => opts.onClose && opts.onClose();

    // snap: keep a step for the window's own Cmd+Z; appUndo: one step in the song's undo too
    // (a slider being dragged sends without one, its release adds it)
    let pushT = 0, pushUndo = false;
    function commit(snap = true, appUndo = true) {
      if (snap) undo.push(JSON.stringify(kit)), undo.length > 40 && undo.shift();
      pushUndo = pushUndo || appUndo;
      clearTimeout(pushT);
      pushT = setTimeout(() => { const u = pushUndo; pushUndo = false; if (api.setKit) api.setKit(toEngine(kit), u); }, 60);
      if (appUndo) render();
    }
    function say(t) { $(".kd-said").textContent = t || ""; }

    // pads
    function renderPads() {
      const box = $(".kd-pads");
      box.replaceChildren();
      for (const P of PADS) {
        const pad = kit.pads[P.slot], b = h("button", "kd-pad" + (P.slot === sel ? " kd-sel" : "") + (pad && pad.url ? "" : " kd-empty"));
        b.dataset.slot = P.slot;
        const cv = h("canvas", "kd-padpic"); cv.width = 180; cv.height = 70;
        b.append(cv, h("span", "kd-padname", P.label), h("span", "kd-padsnd", pad && pad.url ? pad.name : "Empty"), h("span", "kd-key", P.key));
        if (used[P.note]) b.append(h("span", "kd-uses", used[P.note] + " hits"));
        if (pad && pad.drive > 0.05) b.classList.add("kd-hot");
        b.onmousedown = (e) => { if (e.button) return; sel = P.slot; hit(P.slot); render(); };
        box.append(b);
        drawShape(cv, pad, true);
      }
    }
    function hit(slot, url, velocity = 112) {
      const pad = kit.pads[slot], P = BY_SLOT[slot];
      if (!pad && !url) return;
      api.hit && api.hit(P.note, velocity, url ? { url, pad: toEngine({ pads: { [slot]: { ...(pad || {}), url } } }).kitPad[P.note] } : null);
      const b = root.querySelector(`.kd-pad[data-slot="${slot}"]`);
      if (b) { b.classList.remove("kd-flash"); void b.offsetWidth; b.classList.add("kd-flash"); }
    }
    // The pad's picture: its sound's waveform, bent by its knobs (decay shortens it, drive
    // squares it off and warms the colour, the filter smooths it), over the pad's face (drawLook).
    // selected (optional): true/false = acid/lilac face. Left out, the selected pad in the pad grid
    // goes acid; the side panel always shows the selected pad, so it stays lilac.
    async function drawShape(cv, pad, small, selected) {
      const g = cv.getContext("2d"), W = cv.width, H = cv.height, tok = (cv._kdTok = {});
      if (!pad || !pad.url) return g.clearRect(0, 0, W, H);
      if (selected == null) selected = !!small && pad === kit.pads[sel];
      let pk = peaks[pad.url];
      if (!pk && api.peaks) {
        const r = await api.peaks(pad.url);
        pk = peaks[pad.url] = (r && r.peaks) || [];
      } else await null; // after the caller's DOM work, so the nine pads share one layout read
      if (cv._kdTok !== tok) return; // a newer drawing of this canvas took over
      g.clearRect(0, 0, W, H);
      drawLook(g, W, H, pad, selected);
      if (!pk || !pk.length) return;
      const n = pk.length, max = Math.max(...pk, 1e-3);
      const decay = pad.decay != null ? pad.decay : 1, drive = pad.drive || 0, cut = pad.cutoff != null ? pad.cutoff : 1;
      const end = decay >= 0.99 ? 1 : Math.max(0.05, Math.pow(Math.max(decay, 0.02), 1.5));
      // lilac, acid once it's driven; white on the selected pad's acid face so it stays readable.
      // Never red: in KILLTOY red only means recording.
      const col = selected ? "#ffffff" : drive > 0.25 ? "#e4ff3a" : "#b79cff";
      g.fillStyle = col; g.globalAlpha = small ? 0.75 : 0.9;
      const mid = H / 2, bw = W / n;
      for (let i = 0; i < n; i++) {
        const x = i / n;
        let v = pk[i] / max;
        if (x > end) v *= Math.max(0, 1 - (x - end) * 12);
        else if (end < 1 && x > end * 0.35) v *= Math.pow(0.0005, (x - end * 0.35) / (end * 0.65)) ** 0.25;
        const a = 1 + drive * 8; v = Math.tanh(a * v) / Math.tanh(a);
        if (cut < 0.99 && i > 0) v = v * (0.4 + cut * 0.6);
        const hh = v * (H * 0.46);
        g.fillRect(i * bw, mid - hh, Math.max(1, bw - (small ? 0.4 : 1)), hh * 2);
      }
      g.globalAlpha = 1;
      if ((pad.fx || []).length && !small) { g.fillStyle = "rgba(236,236,238,0.5)"; g.font = "11px sans-serif"; g.fillText(pad.fx.map((f) => f.kind).join(" · "), 8, 16); }
    }

    // ---- Pad pictures (docs/KILLDRUM-LOOK.md "Pictures"). Behind each pad's waveform sits an
    // abstract picture, no faces (Eman 2026-10-27: faces look bad distorted): a tile of TOY
    // MACHINE's look atlas ui/toymachine-looks.jpg (5 x 4 tiles of 256 px: veins, grain, cells,
    // skulls...) on drum pads, one of Eman's sigils (ui/toymachine-chars.jpg, packed tiles 3-9 of
    // 6 columns) on FX and Texture, picked by the sound so a sound keeps its picture. Duotone #121214 -> lilac #cbb8ff (acid #e4ff3a when selected), and it gets uglier
    // as you push it: Drive crushes the mids to black/white and from 0.5 tears it into sideways
    // slices, the Crush effect turns it to blocks, a short Decay crops in. No RGB split, no
    // halftone. Each picture is built once into its own offscreen canvas (PIC.cache, keyed by
    // everything it depends on), so a redraw is one drawImage. Until the sheet has loaded (or if it
    // can't), the older TOY MACHINE look further down draws instead.
    const PIC = { img: new Image(), sig: new Image(), cache: new Map(), scratch: null };
    PIC.img.addEventListener("load", () => root.isConnected && render(), { once: true });
    PIC.sig.addEventListener("load", () => root.isConnected && render(), { once: true });
    PIC.img.src = "toymachine-looks.jpg";
    PIC.sig.src = "toymachine-chars.jpg";
    // -> a W x H canvas holding the pad's picture. aw x ah: the shape it is shown at on screen (a
    // canvas stretched by CSS gets a crop of that shape, so faces aren't squashed).
    function padPicture(pad, W, H, aw, ah, selected) {
      const id = String(pad.sound || pad.url), P = BY_NOTE[pad.note] || PADS.find((x) => kit.pads[x.slot] === pad);
      const sigil = !!P && (P.slot === "fx" || P.slot === "texture") && PIC.sig.complete && PIC.sig.naturalWidth > 0;
      const src = sigil ? PIC.sig : PIC.img, cols = sigil ? 6 : 5;
      const tile = sigil ? 3 + Math.floor(rand(id) * 7) : Math.floor(rand(id) * 20);
      const q = (v, def) => Math.round(Math.min(1, Math.max(0, v != null ? v : def)) * 20) / 20; // 0.05 steps
      const drive = q(pad.drive, 0), decay = q(pad.decay, 1), cr = (pad.fx || []).find((f) => f.kind === "crush");
      const B = cr ? Math.round(1 + 7 * q(cr.amount, 0.4)) : 1; // crush block size in screen px, 8 at full
      aw = Math.max(1, Math.round(aw)); ah = Math.max(1, Math.round(ah));
      const key = [id, tile, W, H, aw, ah, drive, B, decay, selected ? 1 : 0].join("|");
      let pic = PIC.cache.get(key);
      if (pic) { PIC.cache.delete(key); PIC.cache.set(key, pic); return pic; } // newest last
      // crop: the face's middle at the screen shape, closer in as the decay gets shorter (to 1.35x)
      const T = src.naturalWidth / cols, tx = (tile % cols) * T, ty = Math.floor(tile / cols) * T;
      const a = aw / ah, z = 1 + 0.35 * (1 - decay), cw = (a >= 1 ? T : T * a) / z, ch = (a >= 1 ? T / a : T) / z;
      const cy = Math.min(T - ch / 2, Math.max(ch / 2, T * (sigil ? 0.42 : 0.48)));
      // drawn small (one pixel per crush block) when crushed, at full size otherwise
      const bw = B > 1 ? Math.max(2, Math.round(aw / B)) : W, bh = B > 1 ? Math.max(2, Math.round(ah / B)) : H, n = bw * bh;
      const s = PIC.scratch || (PIC.scratch = document.createElement("canvas"));
      s.width = bw; s.height = bh;
      const o = s.getContext("2d", { willReadFrequently: true });
      o.imageSmoothingQuality = "high";
      o.drawImage(src, tx + (T - cw) / 2, ty + cy - ch / 2, cw, ch, 0, 0, bw, bh);
      const img = o.getImageData(0, 0, bw, bh), d = img.data, lum = new Uint8Array(n);
      for (let i = 0; i < n; i++) lum[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
      // brightness -> colour: an S-curve (steeper with drive: mids go to black or white), then
      // the duotone, as one lookup table
      const lo = [18, 18, 20], hi = selected ? [228, 255, 58] : [203, 184, 255], k = 1 + 6 * drive;
      const sg = (x) => 1 / (1 + Math.exp(-k * (x - 0.5))), s0 = sg(0), s1 = sg(1), lut = new Uint8ClampedArray(768);
      for (let i = 0; i < 256; i++) {
        const v = (sg(i / 255) - s0) / (s1 - s0);
        for (let c = 0; c < 3; c++) lut[i * 3 + c] = lo[c] + (hi[c] - lo[c]) * v;
      }
      // tearing from drive 0.5: 4-10 bands (picked by the sound, so it never flickers) slide
      // sideways, up to 14% of the width at full drive, wrapping round like chewed tape
      const shift = new Int32Array(bh);
      if (drive > 0.5) {
        const nb = 4 + Math.floor(rand(id + "#bands") * 7), most = (drive - 0.5) * 2 * 0.14 * bw, hs = [];
        let sum = 0;
        for (let i = 0; i < nb; i++) sum += hs[i] = 0.4 + rand(id + "#h" + i);
        for (let i = 0, run = 0, y0 = 0; i < nb; i++) {
          const y1 = Math.round(((run += hs[i]) / sum) * bh), r = rand(id + "#o" + i);
          shift.fill(r < 0.25 ? 0 : Math.round((r < 0.625 ? -1 : 1) * (0.35 + 0.65 * rand(id + "#m" + i)) * most), y0, y1);
          y0 = y1;
        }
      }
      for (let y = 0; y < bh; y++) {
        const row = y * bw, sh = shift[y];
        for (let x = 0; x < bw; x++) {
          let sx = (x - sh) % bw; if (sx < 0) sx += bw;
          const L = lum[row + sx] * 3, j = (row + x) * 4;
          d[j] = lut[L]; d[j + 1] = lut[L + 1]; d[j + 2] = lut[L + 2]; d[j + 3] = 255;
        }
      }
      o.putImageData(img, 0, 0);
      pic = document.createElement("canvas"); pic.width = W; pic.height = H;
      const pg = pic.getContext("2d");
      pg.imageSmoothingEnabled = false; // crush blocks stay hard-edged (1:1 copy otherwise)
      pg.drawImage(s, 0, 0, bw, bh, 0, 0, W, H);
      PIC.cache.set(key, pic);
      if (PIC.cache.size > 48) PIC.cache.delete(PIC.cache.keys().next().value); // drop the oldest
      return pic;
    }

    function drawLook(g, W, H, pad, selected) {
      if (PIC.img.complete && PIC.img.naturalWidth) {
        try {
          const cv = g.canvas, fill = cv.clientWidth > 0 && cv.clientHeight > 0 && getComputedStyle(cv).objectFit === "fill";
          const pic = padPicture(pad, W, H, fill ? cv.clientWidth : W, fill ? cv.clientHeight : H, !!selected);
          g.save(); g.globalAlpha = 0.55; // held back so the waveform on top stays readable
          g.drawImage(pic, 0, 0);
          g.restore();
          return;
        } catch (e) { /* a file:// page can't read pixels back: try the older look */ }
      }
      // The older look: one of TOY MACHINE's greyscale reference images (picked by the sound),
      // bent the same way the synth's looks are: drive folds it into contour bands, Clip makes it
      // hard black and white, Crush turns it to blocks, the filter dims it; tinted purple, acid
      // yellow as it gets dirty.
      if (!LOOK_IMG.complete || !LOOK_IMG.naturalWidth) return;
      try {
        const tile = Math.floor(rand(pad.sound || pad.url) * 20), tx = (tile % 5) * 256, ty = Math.floor(tile / 5) * 256;
        const off = lookCanvas(W, H);
        const o = off.getContext("2d", { willReadFrequently: true });
        o.drawImage(LOOK_IMG, tx, ty + (256 - 256 * H / W) / 2, 256, 256 * H / W, 0, 0, W, H);
        const img = o.getImageData(0, 0, W, H), d = img.data;
        const drive = pad.drive || 0, cut = pad.cutoff != null ? pad.cutoff : 1, fx = (pad.fx || []).map((f) => f.kind);
        const clip = fx.includes("clip"), crush = fx.includes("crush"), bands = 1 + drive * 7;
        const hue = drive > 0.35 ? [228, 255, 58] : [139, 92, 246], dim = (0.22 + cut * 0.25) * (drive > 0.35 ? 0.55 : 1);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          let i = (y * W + x) * 4;
          if (crush) { const bx = x - (x % 6), by = y - (y % 6); i = (by * W + bx) * 4; }
          let v = d[i] / 255;
          if (drive > 0.02) v = Math.abs(Math.sin(v * Math.PI * bands));
          if (clip) v = v > 0.5 ? 1 : 0;
          const j = (y * W + x) * 4;
          d[j] = hue[0] * v; d[j + 1] = hue[1] * v; d[j + 2] = hue[2] * v; d[j + 3] = 255 * v * dim;
        }
        o.putImageData(img, 0, 0);
        g.drawImage(off, 0, 0);
      } catch (e) { /* no picture; the waveform still draws */ }
    }

    // side panel: the selected pad
    function renderSide() {
      const P = BY_SLOT[sel], pad = kit.pads[sel] || (kit.pads[sel] = { note: P.note, name: P.label, level: 0, tune: 0, decay: 1, drive: 0, cutoff: 1, pan: 0, fx: [] });
      $(".kd-padlabel").textContent = P.label;
      $(".kd-padsound").textContent = pad.url ? pad.name : "No sound yet";
      drawShape($(".kd-shape"), pad, false);
      const kb = $(".kd-knobs"); kb.replaceChildren();
      for (const K of KNOBS) {
        const v = pad[K.id] != null ? pad[K.id] : K.def;
        const row = h("label", "kd-knob"), name = h("span", "kd-kname", K.label), val = h("span", "kd-kval", K.fmt(v));
        const r = h("input"); r.type = "range"; r.min = K.min; r.max = K.max; r.step = K.step || (K.max - K.min) / 200; r.value = v;
        r.oninput = () => { pad[K.id] = Number(r.value); val.textContent = K.fmt(pad[K.id]); drawShape($(".kd-shape"), pad, false); commit(false, false); };
        r.onpointerdown = () => { if (api.setKit) api.setKit(toEngine(kit), true); }; // the undo step holds the kit before the drag
        r.onchange = () => { commit(false, false); render(); hit(sel); };
        r.ondblclick = () => { pad[K.id] = K.def; commit(); };
        row.append(name, r, val); kb.append(row);
      }
      const fxb = $(".kd-fx"); fxb.replaceChildren();
      for (const [kind, label] of FX_KINDS) {
        const on = (pad.fx || []).find((f) => f.kind === kind);
        const card = h("div", "kd-fxcard" + (on ? " kd-on" : ""));
        const b = h("button", "kd-fxname", label);
        b.onclick = () => { pad.fx = on ? pad.fx.filter((f) => f !== on) : [...(pad.fx || []), { kind, amount: 0.4 }]; commit(); hit(sel); };
        card.append(b);
        if (on) {
          const r = h("input"); r.type = "range"; r.min = 0; r.max = 1; r.step = 0.01; r.value = on.amount;
          r.oninput = () => { on.amount = Number(r.value); commit(false, false); };
          r.onpointerdown = () => { if (api.setKit) api.setKit(toEngine(kit), true); };
          r.onchange = () => { commit(false, false); render(); hit(sel); };
          card.append(r);
        }
        fxb.append(card);
      }
      renderList();
    }
    function renderList() {
      const q = words($(".kd-search").value), list = $(".kd-list"), pad = kit.pads[sel];
      const fit = FITS[sel] || [sel];
      const items = Lib().items().filter((x) => fit.includes(x.type) && q.every((w) => x.tags.some((t) => t.startsWith(w)) || x.name.toLowerCase().includes(w)))
        .sort((a, b) => fit.indexOf(a.type) - fit.indexOf(b.type));
      list.replaceChildren();
      if (!items.length) list.append(h("div", "kd-none", Lib().items().length ? "No sounds like that for this pad yet." : "Loading sounds…"));
      for (const it of items.slice(0, 200)) {
        const row = h("div", "kd-row" + (pad && pad.sound === it.id ? " kd-cur" : ""));
        row.append(h("span", "kd-rname", it.name), h("span", "kd-rtags", it.tags.filter((t) => !words(it.name).includes(t)).slice(0, 3).join(" ")));
        // Splice previews stand in until the licensed file replaces them (same name)
        if (it.source === "splice-preview") { const m = h("span", "kd-ph", "preview"); m.title = "A Splice preview standing in until the licensed sound is downloaded"; row.append(m); }
        row.onclick = () => hit(sel, it.url);
        row.ondblclick = () => { soundOnto(kit.pads[sel], it); commit(); hit(sel); say(`${BY_SLOT[sel].label} is now ${it.name}.`); };
        row.title = "Click to hear it on this pad, double-click to load it";
        list.append(row);
      }
    }
    let render = function () {
      window.setTickerText ? setTickerText($(".kd-kitname"), kit.name || "Kit") : ($(".kd-kitname").textContent = kit.name || "Kit");
      renderPads(); renderSide();
    }
    $(".kd-search").oninput = renderList;

    // dice: the whole kit, or one pad
    function roll(slot) {
      seed++;
      const L = Lib();
      if (L.roll) {
        const r = L.roll(kitForLib(), slot || null, seed);
        if (r && r.pads) return applyVibe(r, !slot);
      }
      for (const P of slot ? [BY_SLOT[slot]] : PADS) {
        const pool = Lib().items().filter((x) => (FITS[P.slot] || []).includes(x.type));
        if (!pool.length) continue;
        const it = pool[Math.floor(rand(seed + P.slot) * pool.length)];
        const pad = kit.pads[P.slot] || (kit.pads[P.slot] = { note: P.note, level: 0, tune: 0, decay: 1, drive: 0, cutoff: 1, pan: 0, fx: [] });
        soundOnto(pad, it);
        if (!slot) Object.assign(pad, { tune: 0, drive: rand(seed + "d" + P.slot) < 0.25 ? 0.3 : 0, decay: P.slot === "808" ? 1 : pad.decay });
      }
      if (!slot) kit.name = "Dice kit " + (seed % 1000);
      commit(); say(slot ? `New ${BY_SLOT[slot].label.toLowerCase()}: ${kit.pads[slot].name}.` : "Rolled a new kit.");
    }
    $(".kd-dice").onclick = (e) => roll(e.shiftKey ? sel : null);
    $(".kd-paddice").onclick = () => { roll(sel); hit(sel); };

    // vibe + follow-ups
    const kitForLib = () => ({ name: kit.name, vibe: kit.vibe, pads: Object.fromEntries(Object.entries(kit.pads).map(([s, p]) => [s, { sound: p.sound, url: p.url, name: p.name, tune: p.tune, pitch: p.tune, decay: p.decay, drive: p.drive, cutoff: p.cutoff, pan: p.pan, level: p.level, fx: (p.fx || []).map((f) => f.kind) }])) });
    const itemById = (id) => Lib().items().find((x) => x.id === id);
    // the library says `pitch` (semitones); the pads and the engine call it `tune`
    const tuneOf = (prm) => { const o = { ...prm }; if (o.pitch != null) { o.tune = o.pitch; delete o.pitch; } return o; };
    // Kits, dice and vibes put dry sounds on the pads (Eman, 27 Oct: BEAT is tight and dry, effects
    // live in the FX tab). Pad effect cards only come from words that ask for them ("add reverb to the clap").
    const ASKS_FX = /\b(reverb|reverby|verb|roomy|wet|spacey|delay|echo|echoes|crush|crushed|bitcrush|clip|clipped)\b/i;
    function applyVibe(r, whole = true, text = "") {
      undo.push(JSON.stringify(kit));
      if (whole) { kit.name = r.name || kit.name; if (r.vibe) kit.vibe = r.vibe; }
      for (const [slot, id] of Object.entries(r.pads || {})) {
        const it = itemById(id), P = BY_SLOT[slot];
        if (!it || !P) continue;
        const pad = whole ? { note: P.note, level: 0, tune: 0, decay: 1, drive: 0, cutoff: 1, pan: 0, fx: [] } : kit.pads[slot] || { note: P.note, fx: [] };
        kit.pads[slot] = soundOnto(pad, it);
      }
      for (const [slot, prm] of Object.entries(r.params || {})) if (kit.pads[slot]) Object.assign(kit.pads[slot], tuneOf(prm));
      if (ASKS_FX.test(text)) for (const [slot, list] of Object.entries(r.fx || {})) if (kit.pads[slot]) kit.pads[slot].fx = [...new Set(list)].map((kind) => ({ kind, amount: 0.4 }));
      commit(false);
      say(r.say || "");
      return r;
    }
    function applyFollow(r) {
      undo.push(JSON.stringify(kit));
      for (const ch of r.changes || []) {
        const P = BY_SLOT[ch.slot];
        if (!P) continue;
        const pad = kit.pads[ch.slot] || (kit.pads[ch.slot] = { note: P.note, level: 0, tune: 0, decay: 1, drive: 0, cutoff: 1, pan: 0, fx: [] });
        if (ch.sound) { const it = itemById(ch.sound); if (it) soundOnto(pad, it); }
        if (ch.params) Object.assign(pad, tuneOf(ch.params));
        if (ch.addFx && !(pad.fx || []).some((f) => f.kind === ch.addFx)) pad.fx = [...(pad.fx || []), { kind: ch.addFx, amount: 0.45 }];
        if (ch.removeFx) pad.fx = (pad.fx || []).filter((f) => f.kind !== ch.removeFx);
        sel = ch.slot;
      }
      commit(false);
      say(r.say || "");
      if (r.changes && r.changes[0]) setTimeout(() => hit(r.changes[0].slot), 120);
      return r;
    }
    // A sentence: a new kit ("make me a kit…", or the first prompt), or a change to this one.
    async function prompt(text, mode) {
      text = String(text || "").trim();
      if (!text) return { say: "" };
      await Lib().load();
      const L = Lib();
      // a change names "the snare" / starts like an edit; anything else is a vibe for a whole new kit
      const edit = /^(change|swap|replace|add|remove|take|make (the|it|my|that)|turn|more|less|put|give (the|it)|pitch|tune|lower|raise|no |without|new |another|different|louder|quieter|pan)\b/i.test(text)
        || /\b(the|this|that|my) (kick|808|snare|clap|hat|hats|hi ?hats?|open hat|closed hat|perc|fx|texture)\b/i.test(text)
        // "808 down 2 semitones", "snare louder": a pad name with a change word is an edit too
        || (/^(kicks?|808s?|snares?|claps?|hats?|hi ?hats?|open hats?|closed hats?|percs?|fx|textures?)\b/i.test(text)
          && /\b(semitones?|st|up|down|louder|quieter|softer|darker|brighter|higher|lower|left|right|reverb|delay|crush|clip|drive|distorted|dirtier|cleaner|shorter|longer|tighter|more|less)\b/i.test(text));
      const isNew = mode === "vibe" || (mode !== "follow" && !edit);
      seed++;
      if (isNew && L.parse) { // nothing in it we know: say so and keep the kit
        const p = L.parse(text);
        const G = (window.KillDrumPatterns && window.KillDrumPatterns.GENRES) || [];
        const genre = G.some((g) => new RegExp("\\b(" + g.id + "|" + g.label.replace(/[^a-z ]/gi, ".?") + ")\\b", "i").test(text));
        if (!genre && !p.named.length && !p.mentioned.length && !p.scenes.length && !p.key) { say("Didn't catch that. Try a vibe like \u201cdark carti 808s, crunchy snares\u201d."); return { say: "" }; }
      }
      if (isNew) {
        const r = L.vibe ? await L.vibe(text, { seed }) : fallbackVibe(text, seed);
        return applyVibe(r || fallbackVibe(text, seed), true, text);
      }
      const r = L.follow ? await L.follow(text, kitForLib(), { seed }) : fallbackFollow(text, kitForLib(), seed);
      return applyFollow(r && r.changes ? r : fallbackFollow(text, kitForLib(), seed));
    }
    const go = async () => { const t = $(".kd-prompt").value; const r = await prompt(t); if (r && r.say) $(".kd-prompt").value = ""; $(".kd-prompt").placeholder = "Change it: more distorted snare, add reverb to the clap, new 808\u2026"; };
    $(".kd-go").onclick = go;
    $(".kd-prompt").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") go(); });
    $(".kd-search").addEventListener("keydown", (e) => e.stopPropagation());

    // bring a kit
    $(".kd-kitname").onclick = async () => {
      const box = $(".kd-kits");
      if (!box.hidden) return (box.hidden = true);
      await Lib().load();
      box.replaceChildren(h("div", "kd-kits-t", "Your kits"));
      const mine = savedKits();
      if (!mine.length) box.append(h("div", "kd-none", "Saved kits show here. Press Save to keep this one."));
      for (const k of mine) {
        const row = h("div", "kd-row");
        row.append(h("span", "kd-rname", k.name), h("span", "kd-rtags", Object.keys(k.pads).length + " pads"));
        const del = h("button", "kd-x", "×"); del.title = "Remove this saved kit";
        del.onclick = (e) => { e.stopPropagation(); saveKits(savedKits().filter((x) => x.name !== k.name)); $(".kd-kitname").onclick(); $(".kd-kitname").onclick(); };
        row.append(del);
        row.onclick = () => { undo.push(JSON.stringify(kit)); kit = JSON.parse(JSON.stringify(k)); commit(false); box.hidden = true; say(`Loaded ${k.name}.`); };
        box.append(row);
      }
      const starters = (Lib().kits && Lib().kits()) || [];
      box.append(h("div", "kd-kits-t", "Starter kits"));
      if (!starters.length) box.append(h("div", "kd-none", "Starter kits arrive with the KILLDRUM sound library."));
      for (const k of starters) {
        const row = h("div", "kd-row");
        row.append(h("span", "kd-rname", k.name), h("span", "kd-rtags", (k.tags || []).slice(0, 4).join(" ")));
        row.onclick = () => { applyVibe({ name: k.name, pads: k.pads, params: k.params, fx: k.fx, say: `Loaded ${k.name}.` }); box.hidden = true; };
        box.append(row);
      }
      box.hidden = false;
    };
    $(".kd-save").onclick = () => {
      if (ctx.saveBeat) return ctx.saveBeat(); // the BEAT tab keeps pattern + sounds in its Saved list (one press, a made-up name)
      const name = (window.prompt("Name this kit", kit.name) || "").trim();
      if (!name) return;
      kit.name = name;
      saveKits([{ ...JSON.parse(JSON.stringify(kit)), name }, ...savedKits().filter((x) => x.name !== name)]);
      commit(false); say(`Saved ${name}.`);
    };

    // Undo / Redo: the song's undo (every kit and beat change is a step there), same as Cmd+Z / Cmd+Shift+Z
    $(".kd-undo").onclick = () => { if (api.undo) api.undo(); };
    $(".kd-redo").onclick = () => { if (api.redo) api.redo(); };
    // (Eman, 27 Oct: Undo / Redo live next to Play in the BEAT tab's bottom row now; Cmd+Z still works everywhere)
    $(".kd-undo").hidden = true; $(".kd-redo").hidden = true;

    // keys: 1-9 hit the pads, Cmd/Ctrl+Z undoes inside the window
    root.addEventListener("keydown", (e) => {
      if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== "range") return;
      // Cmd+Z / Cmd+Shift+Z go to the song's undo (every kit edit is a step there); the window re-reads the kit after
      // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z: the window's Undo / Redo (the song's undo), wherever the focus is in here
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z") && api.undo) { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) api.redo(); else api.undo(); return; }
      const P = PADS.find((x) => x.key === e.key);
      if (P && !e.repeat && !e.metaKey && !e.ctrlKey) { e.preventDefault(); e.stopPropagation(); sel = P.slot; hit(P.slot); render(); }
    });

    // Tabs: KIT is this file's page; other files add theirs to window.KillDrumTabs
    // ({ id, label, order, mount(pane, ctx) -> { show?(), hide?(), kitChanged?(), destroy?() } }).
    // ctx gives them the kit (engine form, as in killDrumGet), a way to change it, pad hits and
    // the sounds. Mounted the first time the tab is opened.
    const kitListeners = new Set();
    const ctx = {
      pluginId: opts.pluginId, api, PADS, BY_SLOT, Lib,
      getKit: () => toEngine(kit), kit: () => kitForLib(), used,
      setKit: (e, undoIt = true) => { if (undoIt) undo.push(JSON.stringify(kit)); kit = fromEngine(e); commit(false, undoIt); },
      hit: (slotOrNote, velocity, url) => hit(BY_NOTE[slotOrNote] ? BY_NOTE[slotOrNote].slot : slotOrNote, url, velocity),
      // a unique hit (BEAT tab): the pad's sound with that hit's own settings on top
      undo: () => api.undo && api.undo(), redo: () => api.redo && api.redo(), canUndo: () => !!api.undo,
      hitUnique: (slot, velocity, unique) => { const P = BY_SLOT[slot]; if (P && api.hit) api.hit(P.note, velocity || 112, { unique }); },
      select: (slot) => { sel = slot; render(); },
      selected: () => sel,
      onKitChange: (fn) => (kitListeners.add(fn), () => kitListeners.delete(fn)),
      say,
      // the sound browser + effect chips (this file's KIT page), opened from the BEAT tab
      openSounds: (slot) => { if (slot) sel = slot; showTab("kit"); },
      // a pad's picture (its doll face, bent by drive/crush/decay, with its waveform) on any canvas
      drawPad: (cv, slotOrNote, selected) => { const P = BY_NOTE[slotOrNote] || BY_SLOT[slotOrNote]; if (cv && P) drawShape(cv, kit.pads[P.slot], true, !!selected); },
    };
    const tabs = [{ id: "kit", label: "Kit", order: 0 }, ...(window.KillDrumTabs || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const mounted = {};
    let tab = "kit";
    function showTab(id) {
      const t = tabs.find((x) => x.id === id) || tabs[0];
      if (mounted[tab] && mounted[tab].hide) try { mounted[tab].hide(); } catch (e) { console.error(e); }
      tab = t.id;
      for (const b of root.querySelectorAll(".kd-tab")) b.classList.toggle("kd-tabon", b.dataset.tab === tab || (tab === "kit" && b.dataset.tab === "beat"));
      $(".kd-main").hidden = tab !== "kit";
      $(".kd-panes").hidden = tab === "kit";
      for (const pn of root.querySelectorAll(".kd-pane")) pn.hidden = pn.dataset.tab !== tab;
      if (tab === "kit") return render();
      let pane = root.querySelector(`.kd-pane[data-tab="${tab}"]`);
      if (!pane) {
        pane = h("div", "kd-pane"); pane.dataset.tab = tab; $(".kd-panes").append(pane);
        try { mounted[tab] = t.mount(pane, ctx) || {}; } catch (e) { console.error(e); pane.append(h("div", "kd-none", `${t.label} didn't load.`)); mounted[tab] = {}; }
      } else if (mounted[tab].show) try { mounted[tab].show(); } catch (e) { console.error(e); }
    }
    // With BEAT there, the tabs are BEAT | FX (Eman's two): KIT folds into BEAT as its sound browser
    // (the Sounds button on the selected pad, back with "< Beat").
    const folded = tabs.some((t) => t.id === "beat");
    if (tabs.length > 1) for (const t of tabs) {
      if (folded && t.id === "kit") continue;
      const b = h("button", "kd-tab", t.label); b.dataset.tab = t.id; b.onclick = () => showTab(t.id);
      $(".kd-tabs").append(b);
    }
    if (folded) { $(".kd-back").hidden = false; $(".kd-back").onclick = () => showTab("beat"); }
    const origRender = render;
    render = function () {
      if (tab === "kit") origRender(); else window.setTickerText ? setTickerText($(".kd-kitname"), kit.name || "Kit") : ($(".kd-kitname").textContent = kit.name || "Kit");
      for (const fn of kitListeners) try { fn(toEngine(kit)); } catch (e) { console.error(e); }
      for (const m of Object.values(mounted)) if (m.kitChanged) try { m.kitChanged(toEngine(kit)); } catch (e) { console.error(e); }
    };
    showTab(tabs[0].id); // the first tab by order (BEAT, when it is there)

    Lib().load().then(() => { render(); if (!Object.keys(kit.pads).length) roll(); });
    if (!LOOK_IMG.complete) LOOK_IMG.addEventListener("load", () => root.isConnected && render(), { once: true });
    render();
    const win = {
      close() { for (const m of Object.values(mounted)) if (m.destroy) try { m.destroy(); } catch (e) { /* gone */ } root.remove(); },
      showTab, ctx,
      prompt, roll,
      kit: () => kitForLib(),
      // the lane changed outside the window (undo/redo, import): re-read the kit, and let the tabs re-read the rest (the beat)
      setKit(e) { kit = fromEngine(e); render(); for (const m of Object.values(mounted)) if (m.reload) try { m.reload(); } catch (err) { console.error(err); } },
    };
    root._kd = win;
    return win;
  }

  window.KillDrumUI = { open, PADS, fromEngine, toEngine, fallbackVibe, fallbackFollow };
})();
