// KILLDRUM BEAT tab: where the beat gets made. Pad column on the left (lock, dice for the
// sound, dice for the pattern, "how many" bars), the ring sequencer in the middle (kick
// outside, texture inside; click/paint steps, drag up/down for velocity, right-click for
// rolls), the selected pad on the right (its sound, how many sounds sit on it, stack or
// cycle). ROLL rolls sounds + patterns of every unlocked pad; a pad's own dice always work.
// The clip's notes are the truth: patterns are read back from them with KillDrumPatterns
// and written with killDrumBeatSet. Works alone (tiny pattern fallback, local state).
(function () {
  "use strict";

  const SLOTS = ["kick", "808", "snare", "clap", "hat_closed", "hat_open", "perc", "fx", "texture"];
  const NOTE_OF = { kick: 36, "808": 35, snare: 38, clap: 39, hat_closed: 42, hat_open: 46, perc: 37, fx: 49, texture: 51 };
  const LABEL = { kick: "Kick", "808": "808", snare: "Snare", clap: "Clap", hat_closed: "Closed hat", hat_open: "Open hat", perc: "Perc", fx: "FX", texture: "Texture" };
  const COLOR = { kick: "#E4FF3A", "808": "#C6E03A", snare: "#F2F2F4", clap: "#D8CCFF", hat_closed: "#A78BFA", hat_open: "#8B5CF6", perc: "#C4B5FD", fx: "#8A7FB8", texture: "#6F7380" };
  const FITS = { kick: ["kick"], "808": ["808", "kick"], snare: ["snare"], clap: ["clap", "snare"], hat_closed: ["hat_closed", "hat"], hat_open: ["hat_open", "hat_closed", "hat"],
                 perc: ["perc", "hat_closed", "clap"], fx: ["fx", "texture"], texture: ["texture", "fx"] };
  const GENRES = [{ id: "trap", label: "Trap", bpm: [130, 170] }, { id: "rage", label: "Rage", bpm: [140, 170] }, { id: "drill", label: "Drill", bpm: [138, 146] },
    { id: "jersey", label: "Jersey", bpm: [130, 145] }, { id: "lofi", label: "Lo-fi", bpm: [70, 92] }, { id: "boombap", label: "Boom bap", bpm: [85, 100] },
    { id: "house", label: "House", bpm: [118, 128] }, { id: "techno", label: "Techno", bpm: [128, 140] }, { id: "crystal", label: "Crystal", bpm: [120, 140] }, { id: "dnb", label: "DnB", bpm: [168, 176] }];

  const ICON = {
    dice: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="12" height="12" rx="3"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="5.5" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="5.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="10.5" r="1" fill="currentColor" stroke="none"/></svg>',
    pat: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="2.5" height="10" rx="0.8"/><rect x="6.75" y="6" width="2.5" height="7" rx="0.8"/><rect x="11.5" y="3" width="2.5" height="10" rx="0.8"/></svg>',
    lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="7" width="9" height="7" rx="1.8"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>',
    play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 3.2v9.6L12.5 8z"/></svg>',
    stop: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="4" width="8" height="8" rx="1.5"/></svg>',
    rows: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="2" rx="1"/><rect x="2" y="7" width="12" height="2" rx="1"/><rect x="2" y="11" width="12" height="2" rx="1"/></svg>',
    undo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter"><path d="M5 3.5 1.8 6.7 5 9.9"/><path d="M2.4 6.7h7.1a4 4 0 0 1 0 8H7"/></svg>',
    redo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter"><path d="M11 3.5l3.2 3.2L11 9.9"/><path d="M13.6 6.7H6.5a4 4 0 0 0 0 8H9"/></svg>',
    ring: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.2"/></svg>',
  };

  // ------------------------------------------------------------------ seeded random
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = hash(seed) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

  // ------------------------------------------------------------------ pattern fallback (used only when killdrum-patterns.js is missing)
  const FB = {
    GENRES, SLOTS,
    empty: (bars) => Array.from({ length: 16 * (bars || 1) }, () => ({ v: 0, r: 1 })),
    beat(o) {
      const pads = {}, locked = o.locked || {};
      for (const s of SLOTS) pads[s] = locked[s] ? locked[s].map((x) => ({ ...x })) : FB.pad(s, { ...o, beat: pads });
      return { name: o.genre, genre: o.genre, bars: o.bars || 1, pads };
    },
    pad(slot, o) {
      const bars = o.bars || 1, n = 16 * bars, st = FB.empty(bars), R = rng((o.seed || 1) + ":" + slot + ":" + o.genre), g = o.genre || "trap";
      const on = (i, v = 100, r = 1) => { if (i >= 0 && i < n) st[i] = { v, r }; };
      const four = /house|techno|crystal/.test(g), half = /trap|rage|drill|lofi/.test(g);
      for (let b = 0; b < n; b += 16) {
        switch (slot) {
          case "kick": if (four) { on(b, 112); on(b + 4, 112); on(b + 8, 112); on(b + 12, 112); } else { on(b, 112); if (R() < 0.75) on(b + (half ? 10 : 8) + (R() < 0.3 ? -1 : 0), 100); if (R() < 0.5) on(b + 14 - (R() < 0.5 ? 1 : 0), 88); } break;
          case "808": if (!four) { on(b, 110); if (R() < 0.6) on(b + 10, 100); if (R() < 0.4) on(b + 7, 96); } else if (R() < 0.4) on(b + 14, 90); break;
          case "snare": if (g === "dnb") { on(b + 4, 118); on(b + 10, 118); } else if (half) on(b + 8, 118); else { on(b + 4, 116); on(b + 12, 116); } if (R() < 0.25) on(b + 15, 56); break;
          case "clap": if (four) { on(b + 4, 100); on(b + 12, 100); } else if (R() < 0.5) on(b + (half ? 8 : 4), 90); break;
          case "hat_closed": for (let i = 0; i < 16; i += 2) { if (four && i % 4 === 2) continue; on(b + i, i % 4 === 0 ? 100 : 74, half && R() < 0.18 ? (R() < 0.5 ? 2 : 3) : 1); } break;
          case "hat_open": if (four) { on(b + 2, 96); on(b + 6, 96); on(b + 10, 96); on(b + 14, 96); } else if (R() < 0.7) on(b + 14, 88); break;
          case "perc": for (let i = 0; i < 16; i++) if (R() < 0.12) on(b + i, 70 + Math.round(R() * 30)); break;
          case "fx": if (b === 0 && R() < 0.5) on(0, 80); break;
          case "texture": if (b === 0) on(0, 90); break;
        }
      }
      return st;
    },
    toNotes(pads, o) {
      const bars = o.bars || 1, n = 16 * bars, clipBeats = o.clipBeats || 4 * bars, noteOf = o.noteOf || NOTE_OF, R = rng((o.seed || 1) + ":h");
      const out = [], loops = Math.max(1, Math.ceil(clipBeats / (4 * bars)));
      for (const [slot, steps] of Object.entries(pads)) {
        const pitch = noteOf[slot]; if (pitch == null || !steps) continue;
        const jit = (o.humanize || 0) * ({ kick: 0.01, "808": 0.01, snare: 0.02, clap: 0.02 }[slot] || 0.035);
        for (let L = 0; L < loops; L++) for (let i = 0; i < n; i++) {
          const s = steps[i]; if (!s || !s.v) continue;
          const r = Math.max(1, Math.min(4, s.r || 1)), base = L * 4 * bars + (i + (s.o || 0)) * 0.25 + (i % 2 && !s.o ? (o.swing || 0) * 0.0833 : 0);
          for (let k = 0; k < r; k++) {
            const start = Math.max(0, base + k * (0.25 / r) + (jit ? (R() - 0.5) * 2 * jit : 0));
            if (start >= clipBeats) continue;
            const vel = Math.max(1, Math.min(127, Math.round(s.v * (r > 1 ? 0.7 + 0.3 * (k + 1) / r : 1) + (o.humanize ? (R() - 0.5) * 16 * o.humanize : 0))));
            out.push({ pitch, start, length: Math.min(0.25 / r, 0.22), velocity: vel, ...(s.c != null && s.c < 1 ? { chance: s.c } : {}), ...(s.t ? { tune: s.t } : {}), ...(s.g && !k ? { slide: 1 } : {}), ...(s.o ? { o: s.o } : {}), ...(s.u ? { u: s.u } : {}) });
          }
        }
      }
      return out;
    },
    fromNotes(notes, o) {
      const bars = o.bars || 1, n = 16 * bars, noteOf = o.noteOf || NOTE_OF, bySlot = {}, out = {}, count = {};
      for (const [slot, p] of Object.entries(noteOf)) bySlot[p] = slot;
      for (const s of SLOTS) out[s] = FB.empty(bars);
      for (const nt of notes || []) {
        const slot = bySlot[nt.pitch]; if (!slot) continue;
        const i = Math.floor((nt.start - (nt.o || 0) * 0.25) / 0.25 + 0.02); if (i < 0 || i >= n) continue;
        const st = out[slot][i], key = slot + ":" + i; count[key] = (count[key] || 0) + 1;
        st.v = Math.max(st.v, nt.velocity || 100); st.r = Math.min(4, count[key]);
        if (count[key] === 1) { if (nt.chance != null && nt.chance < 1) st.c = nt.chance; if (nt.tune) st.t = nt.tune; if (nt.slide) st.g = true; if (nt.o) st.o = nt.o; if (nt.u) st.u = nt.u; }
      }
      return out;
    },
  };
  const P = () => window.KillDrumPatterns || FB;
  const genres = () => (P().GENRES && P().GENRES.length ? P().GENRES : GENRES);

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const svgEl = (tag, attrs) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const padDefaults = () => ({ tune: 0, decay: 1, drive: 0, cutoff: 1, pan: 0, fx: [] });
  const list = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  const fresh = () => ({ v: 1, genre: "trap", bars: 1, swing: 0, humanize: 0, seed: newSeed(),
    pads: Object.fromEntries(SLOTS.map((s) => [s, { steps: FB.empty(1), lock: { sound: false, pattern: false }, layers: 1, layerMode: /^hat|perc/.test(s) ? "turns" : "stack" }])) });
  function fit(steps, bars) { const n = 16 * bars, out = []; const src = steps && steps.length ? steps : FB.empty(1); for (let i = 0; i < n; i++) { const s = src[i % src.length]; const o = { v: s && s.v ? s.v : 0, r: s && s.r ? s.r : 1 }; if (o.v && s) { if (s.c != null && s.c < 1) o.c = s.c; if (s.t) o.t = s.t; if (s.g) o.g = true; if (s.o) o.o = s.o; if (s.u) o.u = JSON.parse(JSON.stringify(s.u)); } out.push(o); } return out; }
  function guessGenre(bpm, vibe) {
    const t = String(vibe == null ? "" : typeof vibe === "string" ? vibe : JSON.stringify(vibe)).toLowerCase();
    if (/rage|carti|opium/.test(t)) return "rage"; if (/lo-?fi|blue hour|snowfall|\bsad\b/.test(t)) return "lofi"; if (/drill/.test(t)) return "drill"; if (/jersey/.test(t)) return "jersey";
    if (/techno/.test(t)) return "techno"; if (/house/.test(t)) return "house"; if (/crystal|castles|witch/.test(t)) return "crystal"; if (/\bdnb\b|jungle|drum and bass/.test(t)) return "dnb"; if (/boom ?bap/.test(t)) return "boombap";
    return bpm < 95 ? "lofi" : bpm < 116 ? "boombap" : bpm < 126 ? "house" : "trap";
  }
  // A small generated "face" for a pad (until the doll pictures arrive): duotone noise + a waveform line.
  let padArt = null; // the window's pad pictures (doll faces, killdrum.js), set in mount()
  function drawPic(canvas, slot, name, sel) {
    const w = canvas.width = canvas.clientWidth * 2 || 80, h = canvas.height = canvas.clientHeight * 2 || 80, g = canvas.getContext("2d"), R = rng(slot + ":" + name);
    if (padArt && name) { try { padArt(canvas, slot, sel); return; } catch (e) { /* the placeholder below */ } }
    const grad = g.createRadialGradient(w * 0.4, h * 0.35, 4, w / 2, h / 2, w * 0.8); grad.addColorStop(0, sel ? "#3b3522" : "#2a2440"); grad.addColorStop(1, "#0d0d10");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = sel ? "rgba(228,255,58,0.85)" : "rgba(183,156,255,0.75)"; g.lineWidth = Math.max(1.5, w / 40); g.beginPath();
    const n = 28; for (let i = 0; i <= n; i++) { const x = (i / n) * w, env = Math.exp(-i / (n * 0.45)), y = h / 2 + (R() - 0.5) * h * 0.8 * env; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }

  function mount(pane, ctx) {
    const pid = ctx.pluginId;
    if (ctx.drawPad) padArt = ctx.drawPad;
    const lib = () => (typeof ctx.Lib === "function" ? ctx.Lib() : ctx.Lib) || { items: () => [] };
    const items = () => { try { return lib().items() || []; } catch (e) { return []; } };
    const B = async (cmd, args) => { if (typeof booth !== "function") return null; try { return await booth(cmd, args); } catch (e) { return null; } };
    let S = fresh(), clip = { clipStart: 0, clipLength: 0, beats: 4, bpm: 140 }, kitE = ctx.getKit ? ctx.getKit() : { kit: {}, kitName: {}, kitPad: {} };
    let sel = (ctx.selected && ctx.selected()) || "kick", dead = false, shown = true, loaded = false, local = false;
    let ph = -1, phStep = -1, raf = 0, saveT = 0, saveUndo = false;

    // ---------------------------------------------------------------- DOM
    pane.innerHTML = "";
    const root = el("div", "kd-beat");
    const plist = el("div", "kd-plist");
    plist.append(el("div", "kd-plist-h", `<button class="kb-genre" title="Style of the beat: pick one and the unlocked patterns change"><span></span> ▾</button><button class="kb-savedbtn" title="Your presets: save this beat, load a pattern, sounds or both, point at one to hear it">Presets</button>`));
    const rows = {};
    for (const slot of SLOTS) {
      const r = el("div", "kd-prow"); r.dataset.slot = slot; r.style.setProperty("--c", COLOR[slot]);
      r.innerHTML = `<div class="kd-ppic"><canvas></canvas></div><div class="kd-pmeta"><div class="kd-pname">${LABEL[slot]}</div><div class="kd-psnd">—</div></div>
        <div class="kd-pbtns"><div class="kd-pcount" title="How many sounds on this pad (drag up/down)"><i></i><i></i><i></i><i></i></div>
        <button class="kd-ibtn kd-rollsnd" title="New sound for this pad">${ICON.dice}</button><button class="kd-ibtn kd-rollpat" title="New pattern for this pad">${ICON.pat}</button>
        <button class="kd-ibtn kd-lock" title="Lock: ROLL skips this pad (its own dice still work)">${ICON.lock}</button>
        <button class="kd-ibtn kb-mute" title="Mute this pad (its pattern is kept)">M</button><button class="kd-ibtn kb-solo" title="Solo: only the soloed pads play">S</button></div>`;
      plist.append(r);
      rows[slot] = { el: r, pic: r.querySelector("canvas"), snd: r.querySelector(".kd-psnd"), count: r.querySelector(".kd-pcount"), lock: r.querySelector(".kd-lock") };
      r.addEventListener("click", (e) => { if (e.target.closest(".kd-pbtns")) return; select(slot); hit(slot); });
      r.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); openRowMenu(slot, e.clientX, e.clientY); });
      r.querySelector(".kd-rollsnd").onclick = (e) => { e.stopPropagation(); rollOne(slot, true, false); };
      r.querySelector(".kd-rollpat").onclick = (e) => { e.stopPropagation(); rollOne(slot, false, true); };
      rows[slot].lock.onclick = (e) => { e.stopPropagation(); toggleLock(slot); };
      r.querySelector(".kb-mute").onclick = (e) => { e.stopPropagation(); muteSolo(slot, "mute"); };
      r.querySelector(".kb-solo").onclick = (e) => { e.stopPropagation(); muteSolo(slot, "solo"); };
      bindCount(rows[slot].count, slot);
    }
    const stage = el("div", "kd-stage");
    const circle = el("div", "kd-circle");
    const svg = svgEl("svg", { viewBox: "0 0 1000 1000" });
    circle.append(svg);
    const face = el("div", "kd-face", `<canvas></canvas><div class="kd-facename"></div>`); face.title = "Play this pad";
    face.onclick = () => hit(sel);
    circle.append(face);
    const rollbar = el("div", "kd-rollbar");
    rollbar.innerHTML = `<div class="kd-seg kb-pmode" title="LOOP: loop this BAR on its own, forever. TRACK: play the whole song from the marker"><button data-m="solo">Loop</button><button data-m="full">Track</button></div><button class="kd-ibtn kb-play" title="Play / stop">${ICON.play}</button><button class="kb-hist kb-undo" title="Undo (Cmd+Z)">${ICON.undo}</button><button class="kb-hist kb-redo" title="Redo (Cmd+Shift+Z)">${ICON.redo}</button>
      <button class="kd-roll" title="New sounds and patterns for every unlocked pad">${ICON.dice} Roll</button>
      <button class="kd-roll2 kb-sounds" title="New sounds only (unlocked pads)">${ICON.dice}<span>Sounds only</span></button>
      <button class="kd-roll2 kb-patterns" title="New patterns only (unlocked pads)">${ICON.pat}<span>Pattern only</span></button>
      <div class="kd-seg kb-bars" title="Steps: one or two bars"><button data-bars="1">16</button><button data-bars="2">32</button></div>
      <div class="kd-mini kb-mini" data-k="swing" title="Swing: drag up/down, double-click resets"><span class="kd-label">Swing</span><b>0%</b></div>
      <div class="kd-mini kb-mini" data-k="humanize" title="Humanise: loose timing and hits, drag up/down"><span class="kd-label">Human</span><b>0%</b></div>`;
    const grid = el("div", "kb-grid");
    const viewBtn = el("button", "kd-ibtn kb-view");
    const versEl = el("div", "kb-vers");
    stage.append(circle, grid, viewBtn, versEl, rollbar);
    const detail = el("div", "kd-detail");
    // (Eman, 27 Oct: the big picture made room for effects.) Head: the pad's name, or the picked hit with CONNECTED / MAKE UNIQUE.
    detail.innerHTML = `<div class="kb-dhead"><div class="kb-dtitle"><div class="kd-dname"></div><div class="kb-dwhat"></div></div><div class="kd-dbtns"><button class="kd-ibtn kb-dsnd" title="New sound (also puts this pad's unique hits back to normal)">${ICON.dice}</button><button class="kd-ibtn kb-dpat" title="New pattern">${ICON.pat}</button><button class="kd-ibtn kd-lock kb-dlock" title="Lock this pad">${ICON.lock}</button></div></div>
      <div class="kd-seg kb-scope" hidden><button data-u="0" title="This hit follows its row: the panel changes the whole row">Connected</button><button data-u="1" title="This hit gets its own settings and effects, on top of the row's">Make unique</button></div>
      <div class="kd-dsound"><button class="kd-ibtn kb-prev" title="Previous sound">‹</button><span>—</span><button class="kd-ibtn kb-next" title="Next sound">›</button><button class="kd-small kb-browse" title="All the sounds for this pad, search, and its effect chips (reverb, delay, clip, crush, drive)">Sounds</button></div>
      <div class="kd-howmany"><div class="kd-dial" title="How many sounds on this pad: drag up/down or click"><svg viewBox="0 0 58 58"><circle class="kd-arc0" cx="29" cy="29" r="24" fill="none" stroke-width="3" stroke-dasharray="113.1 150.8" transform="rotate(135 29 29)"/><circle class="kd-arc1" cx="29" cy="29" r="24" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="0 150.8" transform="rotate(135 29 29)"/></svg><div class="kd-dial-n">1</div></div>
      <div class="kd-label">How many</div><div class="kd-seg kb-mode"><button data-mode="stack" title="All the sounds play together">Stack</button><button data-mode="turns" title="The sounds take turns, hit by hit">Cycle</button></div>
      <div class="kd-layers"></div></div><div class="kd-bars"></div><div class="kb-fx"><div class="kd-label">Effects <em></em></div><div class="kb-fxlist"></div></div><div class="kb-hitopts" hidden><div class="kd-label">This hit</div><div class="kb-hitrow"><div class="kd-seg kb-chance" title="How often this hit plays"><button data-c="1">100%</button><button data-c="0.75">75%</button><button data-c="0.5">50%</button><button data-c="0.25">25%</button></div><button class="kd-small kb-glidebtn" title="The 808 glides into this note from the one before">Glide</button></div><div class="kd-bar kd-mid kb-notept" title="Note: this hit's pitch in semitones (808 lines). Drag left/right, double-click resets"><span>Note</span><b>0 st</b></div></div>
      <div class="kb-chain"><div class="kd-label">Order <em>what FULL plays, left to right</em></div><div class="kb-chainbox"></div></div><div class="kb-hint"></div>`;
    root.append(plist, stage, detail);
    pane.append(root);
    const D = { what: detail.querySelector(".kb-dwhat"), scope: detail.querySelector(".kb-scope"), howmany: detail.querySelector(".kd-howmany"), fx: detail.querySelector(".kb-fxlist"), fxNote: detail.querySelector(".kb-fx em"), name: detail.querySelector(".kd-dname"), snd: detail.querySelector(".kd-dsound span"), dial: detail.querySelector(".kd-dial"),
      arc: detail.querySelector(".kd-arc1"), n: detail.querySelector(".kd-dial-n"), mode: detail.querySelector(".kb-mode"), layers: detail.querySelector(".kd-layers"), lock: detail.querySelector(".kb-dlock"), hint: detail.querySelector(".kb-hint"), bars: detail.querySelector(".kd-bars"), cells: null, hitopts: detail.querySelector(".kb-hitopts"), chain: detail.querySelector(".kb-chainbox") };
    detail.querySelector(".kb-dsnd").onclick = () => rollOne(sel, true, false);
    detail.querySelector(".kb-dpat").onclick = () => rollOne(sel, false, true);
    D.lock.onclick = () => toggleLock(sel);
    detail.querySelector(".kb-prev").onclick = () => stepSound(sel, -1);
    detail.querySelector(".kb-next").onclick = () => stepSound(sel, 1);
    for (const b of D.scope.querySelectorAll("button")) b.onclick = () => makeUnique(b.dataset.u === "1");
    detail.querySelector(".kb-browse").onclick = () => ctx.openSounds && ctx.openSounds(sel);
    for (const b of D.mode.querySelectorAll("button")) b.onclick = () => setMode(sel, b.dataset.mode);
    bindDial(D.dial);
    const playBtn = rollbar.querySelector(".kb-play");
    rollbar.querySelector(".kb-undo").onclick = () => ctx.undo && ctx.undo();
    rollbar.querySelector(".kb-redo").onclick = () => ctx.redo && ctx.redo();
    if (ctx.canUndo && !ctx.canUndo()) for (const b of rollbar.querySelectorAll(".kb-hist")) b.hidden = true;
    playBtn.onclick = togglePlay;
    rollbar.querySelector(".kd-roll").onclick = () => rollAll(true, true);
    rollbar.querySelector(".kb-sounds").onclick = () => rollAll(true, false);
    rollbar.querySelector(".kb-patterns").onclick = () => rollAll(false, true);
    for (const b of rollbar.querySelectorAll(".kb-bars button")) b.onclick = () => setBars(Number(b.dataset.bars));
    for (const m of rollbar.querySelectorAll(".kb-mini")) bindMini(m);
    const genreBtn = plist.querySelector(".kb-genre");
    genreBtn.onclick = (e) => { e.stopPropagation(); closeSaved(); openGenres(); };
    const savedBtn = plist.querySelector(".kb-savedbtn");
    savedBtn.onclick = (e) => { e.stopPropagation(); closeGenres(); openSaved(); };

    // ---------------------------------------------------------------- ring
    const trk = {}; // slot -> { g, steps: [path], ticks: [path|null] }
    let playhead = null;
    const pt = (r, deg) => { const a = (deg * Math.PI) / 180; return [500 + r * Math.cos(a), 500 + r * Math.sin(a)]; };
    function sector(ro, ri, a0, a1) {
      const [x0, y0] = pt(ro, a0), [x1, y1] = pt(ro, a1), [x2, y2] = pt(ri, a1), [x3, y3] = pt(ri, a0);
      return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${ro} ${ro} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${ri} ${ri} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
    }
    function buildRing() {
      svg.innerHTML = "";
      const n = 16 * S.bars, gap = n > 16 ? 1.0 : 1.6, da = 360 / n;
      for (let k = 0; k < n; k += 4) { const [x0, y0] = pt(482, -90 + k * da), [x1, y1] = pt(494, -90 + k * da); svg.append(svgEl("line", { class: "kd-beatmark", x1: x0, y1: y0, x2: x1, y2: y1 })); }
      svg.append(svgEl("circle", { class: "kd-ringrim", cx: 500, cy: 500, r: 496 }));
      SLOTS.forEach((slot, i) => {
        const g = svgEl("g", { class: "kd-trk" }); g.dataset.slot = slot;
        const ro = 470 - 33 * i, ri = ro - 29, steps = [], ticks = [];
        for (let k = 0; k < n; k++) {
          const a0 = -90 + k * da + gap / 2, a1 = -90 + (k + 1) * da - gap / 2;
          const p = svgEl("path", { class: "kd-step", d: sector(ro, ri, a0, a1) }); p.dataset.i = k; p.dataset.slot = slot;
          g.append(p); steps.push(p); ticks.push(null);
        }
        svg.append(g); trk[slot] = { g, steps, ticks, ro, ri, da, gap };
      });
      playhead = svgEl("line", { class: "kd-playhead", x1: 500, y1: 350, x2: 500, y2: 22, style: "display:none" });
      svg.append(playhead);
      for (const slot of SLOTS) paintTrack(slot);
    }
    function paintTrack(slot) {
      drawRow(slot);
      const t = trk[slot]; if (!t) return; const st = S.pads[slot].steps;
      t.g.classList.toggle("kd-sel", sel === slot); t.g.classList.toggle("kb-quiet", !audible(slot));
      for (let k = 0; k < t.steps.length; k++) {
        const s = st[k] || { v: 0, r: 1 }, p = t.steps[k];
        p.classList.toggle("kd-on", !!s.v); p.style.setProperty("--vel", s.v ? ((0.35 + 0.65 * s.v / 127) * (s.c != null ? 0.35 + 0.65 * s.c : 1)).toFixed(2) : "1");
        p.classList.toggle("kb-glide", !!(s.v && s.g));
        p.classList.toggle("kb-uniq", !!(s.v && s.u)); p.classList.toggle("kb-pick", !!(s.v && pick && pick.slot === slot && !pick.line && pick.i === k));
        p.classList.toggle("kb-nudge", !!(s.v && s.o));
        const r = s.v ? s.r || 1 : 1;
        if (r > 1) {
          let d = ""; const a0 = -90 + k * t.da + t.gap / 2, a1 = -90 + (k + 1) * t.da - t.gap / 2;
          for (let q = 1; q < r; q++) { const a = a0 + ((a1 - a0) * q) / r, [x0, y0] = pt(t.ri, a), [x1, y1] = pt(t.ro, a); d += `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`; }
          if (!t.ticks[k]) { t.ticks[k] = svgEl("path", { class: "kb-ticks" }); t.g.append(t.ticks[k]); }
          t.ticks[k].setAttribute("d", d);
        } else if (t.ticks[k]) { t.ticks[k].remove(); t.ticks[k] = null; }
      }
    }
    function locate(e) { return S.view === "rows" ? gridLocate(e) : ringLocate(e); }
    function ringLocate(e) {
      const rect = svg.getBoundingClientRect(); if (!rect.width) return null;
      const x = ((e.clientX - rect.left) / rect.width) * 1000 - 500, y = ((e.clientY - rect.top) / rect.height) * 1000 - 500, d = Math.hypot(x, y);
      if (d > 474 || d < 470 - 33 * 9 - 2) return null;
      const i = clamp(Math.floor((470 - d) / 33), 0, 8);
      let ang = (Math.atan2(y, x) * 180) / Math.PI + 90; if (ang < 0) ang += 360;
      const n = 16 * S.bars; return { slot: SLOTS[i], i: Math.floor((ang / 360) * n) % n, f: (ang / 360) * n };
    }
    // where along the beat the pointer is, in steps (any row): moving a hit only needs this
    function posF(e) {
      if (S.view === "rows") { if (!gridLay) return null; const cw = (gridLay.w - gridLay.x0 - 6) / (16 * S.bars); return ((e.clientX - gridLay.left) / gridLay.k - gridLay.x0) / cw; }
      const rect = svg.getBoundingClientRect(); if (!rect.width) return null;
      const x = ((e.clientX - rect.left) / rect.width) * 1000 - 500, y = ((e.clientY - rect.top) / rect.height) * 1000 - 500;
      let ang = (Math.atan2(y, x) * 180) / Math.PI + 90; if (ang < 0) ang += 360; return (ang / 360) * 16 * S.bars;
    }
    // Cmd-drag lands on 1/16, 1/32 and the triplets (1/8T, 1/16T): inside a 16th that is 0, 1/3, 1/2, 2/3
    const FINE = [0, 1 / 3, 1 / 2, 2 / 3];
    function fineSnap(f) { let best = 0, bd = 1e9; for (let k = Math.floor(f) - 1; k <= Math.floor(f) + 1; k++) for (const q of FINE) { const p = k + q, d = Math.abs(p - f); if (d < bd) { bd = d; best = p; } } return best; }
    const FRAC = { 0.333: "+ triplet", 0.5: "+ 1/32", 0.667: "+ 2 triplets" };
    const posLabel = (i, o) => `step ${i + 1}${o ? " " + (FRAC[o] || "") : ""}`;
    // A pad's extra lines (Eman, 27 Oct): drag a hit down out of its row and a new line opens under the pad,
    // same sound and settings, so its hits can ring over each other (an FX bed under another). S.lines[slot]
    // holds the extra lines' steps (line 1, 2 ...; line 0 is the pad's own row). An emptied line goes away.
    const linesOf = (slot) => (S.lines && S.lines[slot]) || [];
    const arrOf = (slot, line) => (line ? linesOf(slot)[line - 1] : null) || S.pads[slot].steps;
    const step = (slot, i, line) => { const a = arrOf(slot, line); return a[i] || (a[i] = { v: 0, r: 1 }); };
    function addLine(slot) { S.lines = S.lines || {}; (S.lines[slot] = S.lines[slot] || []).push(fit([], S.bars)); return linesOf(slot).length; }
    function pruneLines() { // drop the extra lines that have no hits left (the picked hit keeps its place)
      let gone = false;
      for (const slot of Object.keys(S.lines || {})) {
        const ls = S.lines[slot]; if (!Array.isArray(ls)) { delete S.lines[slot]; continue; }
        for (let k = ls.length - 1; k >= 0; k--) {
          if (ls[k] && ls[k].some((x) => x && x.v)) continue;
          ls.splice(k, 1); gone = true;
          if (pick && pick.slot === slot && pick.line) { if (pick.line === k + 1) pick = null; else if (pick.line > k + 1) pick.line--; }
        }
        if (!ls.length) delete S.lines[slot];
      }
      if (gone) syncSubRows();
      return gone;
    }
    let drag = null;
    // Click a hit to pick it (Eman, 27 Oct: clicking no longer deletes). Drag it left/right to move it
    // along its row (hold Cmd for 1/32 and triplet spots), up/down for how hard it hits. Delete or
    // Backspace (or the right-click menu) removes it. Click an empty cell to add a hit; drag to paint more.
    const onDown = (e) => {
      const c = locate(e); if (!c) return;
      e.preventDefault(); closeMenu(); const ln = c.line || 0, st = step(c.slot, c.i, ln);
      if (c.slot !== sel) select(c.slot, true);
      if (e.button === 2) { if (st.v) { setPick(c.slot, c.i, ln); openHitMenu(c.slot, c.i, e.clientX, e.clientY, ln); } else { st.v = 100; st.r = 2; setPick(c.slot, c.i, ln); ringChanged(c.slot, true); } return; }
      if (e.altKey) { st.v = st.v === 51 ? 100 : 51; ringChanged(c.slot, true); return; }   // ghost note
      if (e.shiftKey) { st.v = st.v === 124 ? 100 : 124; ringChanged(c.slot, true); return; }  // accent
      e.currentTarget.setPointerCapture(e.pointerId);
      if (!st.v) { st.v = 100; st.r = 1; setPick(c.slot, c.i, ln); hit(c.slot, 100); changed(c.slot, false); drag = { paint: true, x: e.clientX, y: e.clientY, slot: c.slot, line: ln, i: c.i, last: c.slot + ":" + ln + ":" + c.i }; }
      else { setPick(c.slot, c.i, ln); drag = { pending: true, x: e.clientX, y: e.clientY, slot: c.slot, line: ln, i: c.i, v0: st.v, grab: (c.f != null ? c.f : c.i) - (c.i + (st.o || 0)), last: c.slot + ":" + ln + ":" + c.i }; }
    };
    const onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.pending) {
        if (Math.abs(dy) > 4 && Math.abs(dy) > Math.abs(dx)) { drag.pending = false; drag.vel = true; }
        else if (Math.abs(dx) > 4) { drag.pending = false; drag.move = true; }
        else return;
      }
      if (drag.vel) {
        // up/down inside the row sets how hard it hits; out of the row (rows view) it moves to another line
        if (S.view === "rows" && lineTarget(e, drag.slot) !== drag.line) { step(drag.slot, drag.i, drag.line).v = drag.v0; drag.vel = false; drag.move = true; moveHit(e); return; }
        const st = step(drag.slot, drag.i, drag.line); st.v = clamp(Math.round(drag.v0 - dy * 0.8), 20, 127); hint(`${LABEL[drag.slot]} ${posLabel(drag.i, st.o)}: ${st.v}`); changed(drag.slot, false); return;
      }
      if (drag.move) { moveHit(e); return; }
      const c = locate(e); if (!c || c.slot !== drag.slot || (c.line || 0) !== drag.line) return; const key = c.slot + ":" + (c.line || 0) + ":" + c.i; if (key === drag.last) return; drag.last = key;
      const st = step(c.slot, c.i, c.line);
      if (!st.v) { st.v = 100; st.r = 1; changed(c.slot, false); }
    };
    function moveHit(e) {
      const f0 = posF(e); if (f0 == null || !isFinite(f0)) return;
      const n = 16 * S.bars, f = f0 - drag.grab, steps = arrOf(drag.slot, drag.line);
      let p = e.metaKey || e.ctrlKey ? fineSnap(f) : Math.round(f);
      p = clamp(p, 0, n - 1 + (e.metaKey || e.ctrlKey ? 2 / 3 : 0));
      const ni = Math.floor(p + 1e-6), no = Math.round((p - ni) * 1000) / 1000, obj = steps[drag.i];
      let tl = S.view === "rows" ? lineTarget(e, drag.slot) : drag.line;
      if (!obj || (ni === drag.i && no === (obj.o || 0) && tl === drag.line)) return;
      if (tl !== drag.line) { // down below the pad's last line opens a new one; up goes back
        if (tl > linesOf(drag.slot).length) tl = addLine(drag.slot);
        const dst = arrOf(drag.slot, tl);
        if (dst[ni] && dst[ni].v) tl = drag.line; // that spot on the other line is taken: stay on this one
        else { steps[drag.i] = { v: 0, r: 1 }; dst[ni] = obj; drag.line = tl; drag.i = ni; syncSubRows(); layoutGrid(); }
      }
      const cur = arrOf(drag.slot, drag.line);
      if (ni !== drag.i && cur[ni] && cur[ni].v) return; // another hit sits there: stay put
      if (ni !== drag.i) { cur[drag.i] = { v: 0, r: 1 }; cur[ni] = obj; }
      if (no) obj.o = no; else delete obj.o;
      drag.i = ni; drag.moved = true; pick = { slot: drag.slot, i: ni, line: drag.line };
      hint(`${LABEL[drag.slot]} hit: ${posLabel(ni, no)}${drag.line ? ` · line ${drag.line + 1}` : ""}${e.metaKey || e.ctrlKey ? "" : "  (hold Cmd for 1/32 and triplets)"}`);
      changed(drag.slot, false);
    }
    const up = () => {
      if (!drag) return; const d = drag; drag = null;
      if (d.pending) { renderPick(); return; } // a click on a hit only picks it
      if (pruneLines()) layoutGrid();
      hint(""); ringChanged(d.slot, true);
    };
    // the circle and the rows view edit the same steps the same way
    for (const elx of [svg, grid]) {
      elx.addEventListener("contextmenu", (e) => e.preventDefault());
      elx.addEventListener("pointerdown", onDown); elx.addEventListener("pointermove", onMove);
      elx.addEventListener("pointerup", up); elx.addEventListener("pointercancel", up);
    }

    const onKey = (e) => {
      if (dead || !shown || !pick || !root.isConnected || root.offsetParent === null) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); deleteHit(pick.slot, pick.i, pick.line); }
      else if (e.key === "Escape") { setPick(null); }
    };
    document.addEventListener("keydown", onKey, true);

    // ---------------------------------------------------------------- picked hit, unique hits
    // pick = { slot, i }: the hit the right panel talks about. CONNECTED (default) = the hit follows its
    // row. MAKE UNIQUE = it gets its own pitch / decay / drive / filter / pan / level and extra effects,
    // on top of the row's (the row's settings and effects still reach it). Stored on the step as `u`.
    let pick = null, uSeq = 0;
    const UCOL = "#5CF2FF";
    function picked() { if (!pick || !S.pads[pick.slot]) return null; const st = arrOf(pick.slot, pick.line)[pick.i]; return st && st.v ? st : null; }
    function setPick(slot, i, line) {
      const was = pick; pick = slot == null ? null : { slot, i, line: line || 0 };
      if (was && was.slot !== slot) paintTrack(was.slot);
      if (pick) paintTrack(pick.slot);
      renderPick();
    }
    const uniq = () => { const st = picked(); return st && st.u && pick.slot === sel ? st.u : null; };
    function deleteHit(slot, i, line) {
      const st = step(slot, i, line); if (!st.v) return;
      arrOf(slot, line)[i] = { v: 0, r: 1 }; pick = null;
      if (pruneLines()) layoutGrid();
      hint(`${LABEL[slot]} hit removed.`); ringChanged(slot, true); renderPick();
    }
    function makeUnique(on) {
      const st = picked(); if (!st) return;
      if (on && !st.u) { st.u = { id: (Date.now() % 1e6).toString(36) + (uSeq++).toString(36) }; ctx.say(`This ${LABEL[pick.slot].toLowerCase()} hit is unique now: what you change in the panel only changes it.`); }
      else if (!on && st.u) { delete st.u; ctx.say(`The ${LABEL[pick.slot].toLowerCase()} hit follows its row again.`); }
      else return;
      changed(pick.slot, true); renderPick();
    }
    function hitUnique() { const st = picked(); if (!st || !st.u) return hit(sel); try { ctx.hitUnique ? ctx.hitUnique(pick.slot, st.v, st.u) : ctx.hit(pick.slot, st.v); } catch (e) { /* no engine */ } flash(pick.slot); }
    // pad dice: that pad's unique hits go back to normal (ROLL and Sounds leave them alone)
    function clearUnique(slot) { let n = 0; for (const a of [S.pads[slot].steps, ...linesOf(slot)]) for (const st of a) if (st && st.u) { delete st.u; n++; } if (pick && pick.slot === slot) renderPick(); return n; }

    // ---------------------------------------------------------------- rows view (Eman, 27 Oct)
    // The other look of the same beat: every pad on the left runs out into its own row of steps. A hit
    // shows its sample's waveform, as long as the sound really rings (decay, pitch, until the pad's next
    // hit), so long and short sounds and which sound is which read at a glance. Toggle: the corner icon.
    const peakCache = new Map(); // url -> { peaks, duration } | "loading"
    function peaksOf(url, slot) {
      if (!url) return null;
      const got = peakCache.get(url);
      if (got && got !== "loading") return got;
      if (!got) { peakCache.set(url, "loading"); B("killDrumPeaks", { url, n: 240 }).then((r) => { if (r && r.ok) { peakCache.set(url, { peaks: r.peaks, duration: r.duration }); drawRow(slot); } else peakCache.delete(url); }); }
      return null;
    }
    const gridRows = {}; let gridLay = null; // key "kick" (the pad's row) or "kick:1", "kick:2" (its extra lines)
    const rowKey = (slot, line) => (line ? slot + ":" + line : slot);
    function gridRow(slot, line) {
      const key = rowKey(slot, line); if (gridRows[key]) return gridRows[key];
      const r = el("div", "kb-grow" + (line ? " kb-gsub" : "")); r.dataset.slot = slot; r.style.setProperty("--c", COLOR[slot]);
      const cv = el("canvas"); r.append(cv); grid.insertBefore(r, gph); return (gridRows[key] = { el: r, cv });
    }
    const gph = el("div", "kb-gph"); grid.append(gph);
    for (const slot of SLOTS) gridRow(slot, 0);
    // the extra lines also take a row in the pad list on the left, so everything under them moves down
    const subEls = {};
    function syncSubRows() {
      for (const slot of SLOTS) {
        const want = linesOf(slot).length, have = subEls[slot] || (subEls[slot] = []);
        while (have.length > want) have.pop().remove();
        while (have.length < want) {
          const k = have.length + 1, r = el("div", "kb-subl", `<span>${LABEL[slot]} · ${k + 1}</span>`); r.style.setProperty("--c", COLOR[slot]);
          r.title = "Another line for this pad: same sound and settings, its hits can ring over the others. Drag hits up and down between the lines; an empty line goes away.";
          r.addEventListener("click", () => select(slot));
          (have[have.length - 1] || rows[slot].el).after(r); have.push(r);
        }
      }
    }
    function layoutGrid() {
      if (S.view !== "rows") return;
      const g = grid.getBoundingClientRect(); if (!g.width) return;
      // the window can be drawn scaled (the KT2 synth card is zoomed): measure the grid in its own
      // (unscaled) pixels so the rows fill the whole width, and turn screen positions back with k
      const k = grid.offsetWidth ? g.width / grid.offsetWidth : 1;
      gridLay = { top: g.top, left: g.left, w: grid.offsetWidth || g.width, k, x0: 14, rows: {} };
      const used = new Set();
      for (const slot of SLOTS) for (let line = 0; line <= linesOf(slot).length; line++) {
        const src = line ? subEls[slot] && subEls[slot][line - 1] : rows[slot].el; if (!src) continue;
        const pr = src.getBoundingClientRect(), y = Math.round((pr.top - g.top) / k), h = Math.round(pr.height / k), key = rowKey(slot, line), R = gridRow(slot, line);
        R.el.style.top = y + "px"; R.el.style.height = h + "px"; R.el.hidden = pr.bottom < g.top || pr.top > g.bottom;
        gridLay.rows[key] = { y, h, slot, line }; used.add(key);
      }
      for (const key in gridRows) if (!used.has(key)) gridRows[key].el.hidden = true;
      for (const slot of SLOTS) drawRow(slot);
    }
    // which of the pad's lines the pointer is over: above them all = its own row, under the last one = a new line
    function lineTarget(e, slot) {
      if (!gridLay) return 0;
      const y = (e.clientY - gridLay.top) / gridLay.k, nl = linesOf(slot).length, top = gridLay.rows[slot];
      if (!top || y < top.y + top.h) return 0;
      for (let line = 1; line <= nl; line++) { const r = gridLay.rows[rowKey(slot, line)]; if (r && y < r.y + r.h) return line; }
      return nl + 1;
    }
    function gridLocate(e) {
      if (!gridLay) return null;
      const y = (e.clientY - gridLay.top) / gridLay.k, x = (e.clientX - gridLay.left) / gridLay.k, n = 16 * S.bars, cw = (gridLay.w - gridLay.x0 - 6) / n;
      const row = Object.values(gridLay.rows).find((r) => y >= r.y && y < r.y + r.h);
      if (!row || x < gridLay.x0) return null;
      const slot = row.slot, line = row.line, f = (x - gridLay.x0) / cw;
      // a hit nudged later (Cmd-drag) is drawn past its cell: a click on that part still finds it
      let i = Math.floor(f); const st = arrOf(slot, line), prev = st[i - 1];
      if (prev && prev.v && prev.o && f < i + prev.o && !(st[i] && st[i].v)) i -= 1;
      // a long sound (an FX bed, an 808) is drawn over the empty cells after it: a click there picks
      // that hit, it doesn't add another one (Eman, 27 Oct)
      if (i >= 0 && i < n && !(st[i] && st[i].v)) { const ring = soundSteps(slot); for (let k = i - 1; k >= 0; k--) if (st[k] && st[k].v) { if (f < k + (st[k].o || 0) + spanOf(st, k, n, ring)) i = k; break; } }
      return i >= 0 && i < n ? { slot, line, i, f } : null;
    }
    function soundSteps(slot) { // how many steps the pad's sound rings, from its length, decay and pitch
      const note = NOTE_OF[slot], url = kitE && kitE.kit && kitE.kit[note], pk = url && peaksOf(url, slot);
      if (!pk) return { pk: null, steps: 1 };
      const pp = (kitE.kitPad && kitE.kitPad[note]) || {}, rate = Math.pow(2, (pp.tune || 0) / 12);
      let sec = pk.duration / rate; if (pp.decay != null && pp.decay < 0.99) sec = Math.max(0.04, sec * Math.pow(Math.max(pp.decay, 0.02), 1.5));
      return { pk, sec, steps: sec / ((60 / (clip.bpm || 120)) / 4) };
    }
    // how many steps a hit is drawn over: as long as its sound rings, up to the row's next hit
    function spanOf(st, k, n, ring) {
      let next = n; for (let j = k + 1; j < n; j++) if (st[j] && st[j].v) { next = j; break; }
      const o = (st[k] && st[k].o) || 0;
      return Math.max(0.7, Math.min(next - k - o + ((st[next] && st[next].o) || 0), n - k - o, ring.steps || 1));
    }
    function drawRow(slot) { for (let line = 0; line <= linesOf(slot).length; line++) drawLine(slot, line); }
    function drawLine(slot, line) {
      if (S.view !== "rows" || !gridLay) return;
      const R = gridRows[rowKey(slot, line)], lay = gridLay.rows[rowKey(slot, line)]; if (!R || !lay) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = gridLay.w, H = lay.h, cv = R.cv;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const n = 16 * S.bars, x0 = gridLay.x0, cw = (W - x0 - 6) / n, ch = Math.max(16, H - 12), cy = H / 2, top = cy - ch / 2, col0 = COLOR[slot], col = col0;
      const st = arrOf(slot, line), quiet = !audible(slot), isSel = sel === slot;
      // the line in from the pad on the left
      if (!line) { g.globalAlpha = isSel ? 0.7 : 0.25; g.fillStyle = col; g.fillRect(0, cy - 0.5, x0 - 2, 1); g.globalAlpha = 1; }
      for (let k = 0; k < n; k++) { // empty cells, every beat a little lighter
        g.fillStyle = k % 4 === 0 ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.04)";
        rr(g, x0 + k * cw + 1.5, top, cw - 3, ch, 5); g.fill();
      }
      const ring = soundSteps(slot);
      for (let k = 0; k < n; k++) {
        const s = st[k]; if (!s || !s.v) continue;
        const o = s.o || 0, uc = s.u ? UCOL : null, col = uc || col0;
        const len = spanOf(st, k, n, ring), x = x0 + (k + o) * cw + 1.5, w = len * cw - 3;
        const a = (quiet ? 0.35 : 1) * (s.c != null ? 0.35 + 0.65 * s.c : 1), vel = 0.45 + 0.55 * (s.v / 127);
        g.globalAlpha = a * 0.22; g.fillStyle = col; rr(g, x, top, w, ch, 5); g.fill();
        g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = isSel ? 1.6 : 1.1; rr(g, x + 0.5, top + 0.5, cw - 4, ch - 1, 5); g.stroke();
        if (ring.pk) { // the waveform over the time the sound rings
          const pk = ring.pk.peaks, show = Math.min(1, (len / Math.max(ring.steps, 0.001))), m = Math.max(2, Math.floor(pk.length * show)), wx = w - 4;
          g.beginPath();
          for (let q = 0; q < m; q++) { const px = x + 2 + (q / m) * wx, amp = Math.min(1, pk[q] * 1.6) * (ch / 2 - 3) * vel; g.moveTo(px, cy - amp); g.lineTo(px, cy + amp); }
          g.globalAlpha = a * 0.95; g.lineWidth = Math.max(1, wx / m * 0.7); g.stroke();
        } else { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x + 3, cy - 1, w - 6, 2); }
        g.globalAlpha = a; g.fillStyle = col; g.font = "600 9px system-ui, sans-serif";
        if (s.t) g.fillText((s.t > 0 ? "+" : "") + s.t, x + 3, top + 10);
        if (s.g) { g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 2, top + ch - 3); g.lineTo(x + Math.min(cw, 14), top + 3); g.stroke(); }
        if ((s.r || 1) > 1) for (let q = 1; q < s.r; q++) { const tx = x + (cw - 3) * q / s.r; g.fillRect(tx, top + ch - 5, 1.2, 4); }
        if (uc) { g.globalAlpha = a; g.fillStyle = uc; diamond(g, x + cw - 9, top + 7, 3.5); } // unique: own colour + a small diamond
        if (k === phStep && !quiet) { g.globalAlpha = 0.9; g.strokeStyle = "#fff"; g.lineWidth = 1.5; rr(g, x + 0.5, top + 0.5, cw - 4, ch - 1, 5); g.stroke(); }
        if (pick && pick.slot === slot && (pick.line || 0) === line && pick.i === k) { g.globalAlpha = 1; g.strokeStyle = "#fff"; g.lineWidth = 2; g.setLineDash([]); rr(g, x - 1, top - 1, Math.max(cw - 1, w + 2), ch + 2, 6); g.stroke(); }
      }
      g.globalAlpha = 1;
    }
    function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); }
    function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function setView(v) {
      S.view = v === "rows" ? "rows" : "ring";
      root.classList.toggle("kb-rowsview", S.view === "rows");
      viewBtn.innerHTML = S.view === "rows" ? ICON.ring : ICON.rows;
      viewBtn.title = S.view === "rows" ? "Show the beat as a circle" : "Show the beat as rows (each pad's steps in a line, with its sound's waveform)";
      requestAnimationFrame(layoutGrid);
    }
    viewBtn.onclick = () => { setView(S.view === "rows" ? "ring" : "rows"); save(false); };
    plist.addEventListener("scroll", () => layoutGrid(), { passive: true });
    if (typeof ResizeObserver !== "undefined") { const gro = new ResizeObserver(() => layoutGrid()); gro.observe(grid); }
    setView(S.view);

    // ---------------------------------------------------------------- state helpers
    function changed(slot, undo) { paintTrack(slot); save(undo); }
    function ringChanged(slot, undo) { changed(slot, undo); if (slot === sel) { renderCells(); renderPick(); } }
    function save(undo) {
      saveUndo = saveUndo || !!undo; clearTimeout(saveT);
      saveT = setTimeout(async () => {
        saveT = 0;
        const u = saveUndo; saveUndo = false; if (local || dead) return;
        syncCur();
        let notes = []; try { notes = chainNotes(); } catch (e) { console.error(e); }
        if (soloOn) B("killDrumSolo", soloArgs(false));
        const r = await B("killDrumBeatSet", { pluginId: pid, notes, beat: S, undo: u });
        if (!r || r.ok === false) local = !r;  // command missing: keep it local from now on
      }, 60);
    }
    // ---------------------------------------------------------------- BARs + the order (Eman, 27 Oct)
    // BAR 1, BAR 2 ...: versions of the beat (pills over the grid). + copies the open one (then ROLL it),
    // double-click renames, right-click: duplicate / rename / delete. Each BAR has its own colour.
    // S.chain is the order FULL plays (B1 B1 B2 B1), repeated over the clip. The open BAR's steps live in
    // S.pads; the others in S.vers[k].pads. One BAR in the order = the old single pattern.
    const VCOL = ["#E4FF3A", "#B79CFF", "#5CF2FF", "#FF7AD9", "#FFB648", "#7CFFB2", "#9AA8FF", "#F2F2F4"];
    let soloOn = false;
    function ensureVers() {
      if (Array.isArray(S.vers) && S.vers.length) { if (!S.vers.some((v) => v.id === S.cur)) S.cur = S.vers[0].id; if (!Array.isArray(S.chain) || !S.chain.length) S.chain = [S.cur]; return; }
      S.vers = [{ id: "b1", name: "BAR 1", color: VCOL[0], bars: S.bars, pads: {} }]; S.cur = "b1"; S.chain = ["b1"];
    }
    const verOf = (id) => S.vers.find((v) => v.id === id);
    const curV = () => verOf(S.cur);
    function shortName(v) {
      const m = /^bar\s*(\d+)$/i.exec(v.name.trim()); if (m) return "B" + m[1];
      const w = v.name.trim().split(/\s+/).filter(Boolean);
      return (w.length > 1 ? w.map((x) => x[0]).join("") : w[0] || "?").slice(0, 3).toUpperCase();
    }
    function syncCur() { ensureVers(); const v = curV(); v.bars = S.bars; v.pads = Object.fromEntries(SLOTS.map((x) => [x, S.pads[x].steps])); v.lines = S.lines || {}; }
    const copyLines = (ls, bars) => Object.fromEntries(Object.entries(ls || {}).filter(([, a]) => Array.isArray(a) && a.length).map(([x, a]) => [x, a.map((st) => fit(JSON.parse(JSON.stringify(st || [])), bars))]));
    const copySteps = (pads) => Object.fromEntries(SLOTS.map((x) => [x, JSON.parse(JSON.stringify((pads && pads[x]) || []))]));
    function padsFor(v) { // what a BAR plays: muted pads left out
      const src = v.id === S.cur ? Object.fromEntries(SLOTS.map((x) => [x, S.pads[x].steps])) : v.pads || {};
      return Object.fromEntries(SLOTS.map((x) => [x, audible(x) ? fit(src[x] || [], v.bars || 1) : []]));
    }
    function barNotes(v, beats) {
      const o = { bars: v.bars || 1, clipBeats: beats || 4 * (v.bars || 1), swing: S.swing, humanize: S.humanize, seed: S.seed, noteOf: NOTE_OF };
      const out = P().toNotes(padsFor(v), o), lines = v.id === S.cur ? S.lines || {} : v.lines || {};
      for (const x of SLOTS) if (audible(x)) (lines[x] || []).forEach((st, k) => { for (const n of P().toNotes({ [x]: fit(st, v.bars || 1) }, o)) out.push({ ...n, line: k + 1 }); });
      return out.sort((a, b) => a.start - b.start);
    }
    const passBeats = () => S.chain.map(verOf).filter(Boolean).reduce((a, v) => a + 4 * (v.bars || 1), 0) || 4 * S.bars;
    function chainNotes(totalIn) {
      ensureVers();
      const total = totalIn || clip.beats || 4 * S.bars, ch = S.chain.map(verOf).filter(Boolean);
      if (ch.length <= 1) return barNotes(ch[0] || curV(), total);
      const out = []; let at = 0;
      while (at < total - 1e-6) for (const v of ch) {
        if (at >= total - 1e-6) break;
        const L = 4 * (v.bars || 1); for (const n of barNotes(v, Math.min(L, total - at))) out.push({ ...n, start: n.start + at }); at += L;
      }
      return out;
    }
    // What SOLO loops: the open BAR, or with ALL on the whole order once round (starting at the open BAR;
    // the loop comes back round from the first block). `from` (beats) only when it should jump there now.
    function soloArgs(jump) {
      if (S.playAll && S.chain.length > 1) {
        let from = 0; const k = S.chain.indexOf(S.cur);
        for (let i = 0; i < k; i++) from += 4 * ((verOf(S.chain[i]) || {}).bars || 1);
        return { pluginId: pid, notes: chainNotes(passBeats()), beats: passBeats(), ...(jump ? { from: k >= 0 ? from : 0 } : {}) };
      }
      return { pluginId: pid, notes: barNotes(curV()), beats: 4 * S.bars, ...(jump ? { from: 0 } : {}) };
    }
    function nextVerName() { let k = S.vers.length + 1; while (S.vers.some((v) => v.name.toUpperCase() === "BAR " + k)) k++; return "BAR " + k; }
    function newVer(from) {
      syncCur(); const used = new Set(S.vers.map((v) => v.color)), id = "b" + newSeed().toString(36);
      const v = { id, name: nextVerName(), color: VCOL.find((c) => !used.has(c)) || VCOL[S.vers.length % VCOL.length], bars: from.bars || 1, pads: copySteps(from.id === S.cur ? Object.fromEntries(SLOTS.map((x) => [x, S.pads[x].steps])) : from.pads), lines: copyLines(from.id === S.cur ? S.lines : from.lines, from.bars || 1) };
      S.vers.push(v); return v;
    }
    function openVer(id, quiet, follow) {
      const v = verOf(id); if (!v) return;
      if (id === S.cur) { if (!follow && soloOn) { syncCur(); B("killDrumSolo", soloArgs(true)); } return; } // click the open BAR while playing: start there
      syncCur(); const old = curV(); old.pads = copySteps(old.pads); old.lines = copyLines(old.lines, old.bars || 1);
      S.cur = id; S.bars = v.bars || 1; for (const x of SLOTS) S.pads[x].steps = fit((v.pads || {})[x] || [], S.bars);
      S.lines = copyLines(v.lines, S.bars);
      pick = null; renderAll(); renderVers();
      if (follow) return; // the view follows the playhead: nothing to save or restart
      if (soloOn) { syncCur(); B("killDrumSolo", soloArgs(true)); }
      save(true);
      if (!quiet) ctx.say(`${v.name} open.${S.chain.includes(id) ? "" : " It isn't in the order yet: + in Order adds it."}`);
    }
    function addVer() { const v = newVer(curV()); S.chain.push(v.id); openVer(v.id, true); ctx.say(`${v.name}: a copy of the one before. ROLL it, or change anything.`); }
    function dupVer(id) { const src = verOf(id); if (!src) return; const v = newVer(src); S.chain.push(v.id); openVer(v.id, true); ctx.say(`${v.name}: a copy of ${src.name}.`); }
    function delVer(id) {
      if (S.vers.length <= 1) return ctx.say("The last BAR stays.");
      const v = verOf(id); S.vers = S.vers.filter((x) => x.id !== id); S.chain = S.chain.filter((x) => x !== id);
      if (!S.chain.length) S.chain = [S.vers[0].id];
      if (S.cur === id) { S.cur = null; const n = S.vers[0]; S.cur = n.id; S.bars = n.bars || 1; for (const x of SLOTS) S.pads[x].steps = fit((n.pads || {})[x] || [], S.bars); pick = null; renderAll(); }
      renderVers(); save(true); ctx.say(`${v.name} deleted.`);
    }
    function renameVer(id, pill) {
      const v = verOf(id); if (!v) return;
      const inp = el("input", "kb-vrename"); inp.value = v.name; inp.maxLength = 24;
      pill.replaceChildren(inp); inp.focus(); inp.select();
      let done = false;
      const fin = (ok) => { if (done) return; done = true; const t = inp.value.trim(); if (ok && t && t !== v.name) { v.name = t; save(true); } renderVers(); };
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") fin(true); else if (e.key === "Escape") fin(false); };
      inp.onblur = () => fin(true);
      inp.onpointerdown = (e) => e.stopPropagation();
    }
    function renderVers() {
      ensureVers(); versEl.replaceChildren();
      for (const v of S.vers) {
        const b = el("button", "kb-vpill" + (v.id === S.cur ? " kd-on" : ""), ""); b.style.setProperty("--vc", v.color);
        b.append(el("i"), el("span", null, v.name.replace(/</g, "&lt;"))); b.title = `${v.name}: click to open, double-click to rename, right-click for more`;
        b.onclick = () => openVer(v.id);
        b.ondblclick = (e) => { e.preventDefault(); renameVer(v.id, b); };
        b.oncontextmenu = (e) => { e.preventDefault(); openVerMenu(v, e.clientX, e.clientY, b); };
        versEl.append(b);
      }
      const add = el("button", "kb-vadd", "+"); add.title = "New BAR: a copy of the open one"; add.onclick = addVer; versEl.append(add);
      // ALL: play the whole order (from the open BAR), and the view follows the playhead from BAR to BAR
      const all = el("button", "kb-vall" + (S.playAll ? " kd-on" : ""), "All");
      all.title = S.playAll ? "Playing the whole order, and the view follows along. Click to loop only the open BAR" : "Loop only the open BAR. Click to play the whole order (starts at the open BAR, follows along)";
      all.onclick = () => { S.playAll = !S.playAll; renderVers(); if (soloOn) { syncCur(); B("killDrumSolo", soloArgs(true)); } save(false);
        ctx.say(S.playAll ? "ALL: plays the whole order from the open BAR, and the view follows." : `Loops ${curV().name} only.`); };
      versEl.append(all);
      renderChain();
    }
    function openVerMenu(v, cx, cy, pill) {
      closeMenu(); closeGenres(); menu = el("div", "kb-menu");
      const item = (label, fn) => { const b = el("div", "kb-mi", `<span>${label}</span>`); b.onclick = () => { closeMenu(); fn(); }; menu.append(b); };
      item("Duplicate", () => dupVer(v.id)); item("Rename", () => renameVer(v.id, pill)); item("Add to the order", () => { S.chain.push(v.id); renderChain(); save(true); });
      if (S.vers.length > 1) item("Delete", () => delVer(v.id));
      const rr = root.getBoundingClientRect(); root.append(menu);
      menu.style.left = clamp(cx - rr.left, 0, Math.max(0, rr.width - menu.offsetWidth - 4)) + "px"; menu.style.top = clamp(cy - rr.top, 0, Math.max(0, rr.height - menu.offsetHeight - 4)) + "px";
      setTimeout(() => { document.addEventListener("pointerdown", onDocMenu, true); document.addEventListener("keydown", onKeyMenu, true); }, 0);
    }
    // The order: a boxed timeline of BAR blocks (16 steps = one slot, 32 = two). Click a block to put the
    // open BAR there, drag to move it, right-click (or ×) removes it, + adds the open BAR at the end.
    let chainPh = null;
    function renderChain() {
      const box = D.chain; if (!box) return; box.replaceChildren();
      S.chain.forEach((id, k) => {
        const v = verOf(id); if (!v) return;
        const b = el("div", "kb-cblk" + (id === S.cur ? " kd-on" : ""), `<span>${shortName(v)}</span><i title="Remove">\u00d7</i>`);
        b.style.setProperty("--vc", v.color); b.style.flexGrow = v.bars || 1; b.title = `${v.name} (${16 * (v.bars || 1)} steps). Click: put ${curV().name} here. Drag: move. Right-click: remove`;
        b.dataset.k = k;
        b.onpointerdown = (e) => {
          if (e.button !== 0) return; e.preventDefault();
          if (e.target.tagName === "I") { if (S.chain.length > 1) { S.chain.splice(k, 1); renderChain(); save(true); } return; }
          b.setPointerCapture(e.pointerId); let moved = false, at = k; const x0 = e.clientX;
          b.onpointermove = (m) => {
            if (!moved && Math.abs(m.clientX - x0) < 5) return; moved = true; b.classList.add("kb-cdrag");
            const blocks = [...box.querySelectorAll(".kb-cblk")], to = blocks.findIndex((q) => { const r = q.getBoundingClientRect(); return m.clientX >= r.left && m.clientX < r.right; });
            if (to >= 0 && to !== at) { const [x] = S.chain.splice(at, 1); S.chain.splice(to, 0, x); at = to; renderChain(); }
          };
          b.onpointerup = () => { b.onpointermove = b.onpointerup = null; if (moved) { save(true); return; } if (S.chain[k] !== S.cur) { S.chain[k] = S.cur; renderChain(); save(true); } };
        };
        b.oncontextmenu = (e) => { e.preventDefault(); if (S.chain.length > 1) { S.chain.splice(k, 1); renderChain(); save(true); } };
        box.append(b);
      });
      const add = el("button", "kb-cadd", "+"); add.title = `Add ${curV().name} at the end`; add.onclick = () => { S.chain.push(S.cur); renderChain(); save(true); };
      box.append(add);
      chainPh = el("div", "kb-cph"); chainPh.hidden = true; box.append(chainPh);
    }
    // where FULL is in the order right now -> { k (block), ph (0..1 inside it), at (0..1 of the whole) } or null
    function chainAt(rel) {
      const ch = S.chain.map(verOf).filter(Boolean); if (!ch.length) return null;
      const spb = 60 / (clip.bpm || 120), tot = ch.reduce((a, v) => a + 4 * (v.bars || 1), 0) * spb; let x = rel % tot; const all = x / tot;
      for (let k = 0; k < ch.length; k++) { const L = 4 * (ch[k].bars || 1) * spb; if (x < L) return { k, v: ch[k], ph: x / L, at: all }; x -= L; }
      return null;
    }
    // SOLO | FULL, shared with TOY MACHINE (app.js keeps the same choice)
    const modeKey = "killtoy.playMode";
    let pmode = "solo"; try { pmode = localStorage.getItem(modeKey) === "full" ? "full" : "solo"; } catch (e) { /* default */ }
    const modeSeg = rollbar.querySelector(".kb-pmode");
    function setPMode(m) {
      pmode = m === "full" ? "full" : "solo"; try { localStorage.setItem(modeKey, pmode); } catch (e) { /* fine */ }
      for (const b of modeSeg.querySelectorAll("button")) b.classList.toggle("kd-on", b.dataset.m === pmode);
    }
    for (const b of modeSeg.querySelectorAll("button")) b.onclick = async () => {
      const was = pmode; setPMode(b.dataset.m); if (was === pmode) return;
      const t = nowPos(); if (t && t.playing) { await stopAll(); togglePlay(); } // switch while playing: carry on in the new mode
      ctx.say(pmode === "solo" ? `SOLO: ${curV().name} loops on its own.` : "FULL: plays inside the song from the marker, only where the clip is.");
    };
    setPMode(pmode);
    function hint(t) { D.hint.textContent = t || ""; }
    // Mute / solo: the clip's notes leave out muted pads (and, while any pad is soloed, the others);
    // their steps stay in the tab's state (kitBeat) and come back when un-muted.
    const anySolo = () => SLOTS.some((s) => S.pads[s].solo);
    const audible = (s) => !S.pads[s].mute && (!anySolo() || !!S.pads[s].solo);
    function muteSolo(slot, k) {
      S.pads[slot][k] = !S.pads[slot][k];
      renderRows(); for (const s of SLOTS) paintTrack(s); save(true);
      const on = SLOTS.filter((s) => S.pads[s][k]).map((s) => LABEL[s].toLowerCase());
      hint(on.length ? (k === "mute" ? "Muted: " : "Solo: ") + list(on) : k === "mute" ? "Nothing muted" : "Solo off");
    }
    function hit(slot, v) { try { ctx.hit(slot, v || 112); } catch (e) { /* no engine */ } flash(slot); }
    function flash(slot) { const r = rows[slot]; if (!r) return; r.el.classList.add("kd-hit"); clearTimeout(r.ft); r.ft = setTimeout(() => r.el.classList.remove("kd-hit"), 150); if (slot === sel) { face.classList.add("kb-hit"); clearTimeout(face.ft); face.ft = setTimeout(() => face.classList.remove("kb-hit"), 150); } }
    function select(slot, keepPick) { if (!keepPick && pick) { const w = pick; pick = null; paintTrack(w.slot); } const was = sel; sel = slot; try { if (ctx.select && ctx.selected() !== slot) ctx.select(slot); } catch (e) { /* fine */ } if (was && was !== slot) paintTrack(was); paintTrack(slot); renderRows(); renderDetail(); }
    const soundName = (slot) => (kitE && kitE.kitName && kitE.kitName[NOTE_OF[slot]]) || "";
    const kpOf = (e, slot) => { e.kitPad = e.kitPad || {}; return (e.kitPad[NOTE_OF[slot]] = e.kitPad[NOTE_OF[slot]] || padDefaults()); };
    const genreLabel = () => { const g = genres().find((x) => x.id === S.genre); return g ? g.label : S.genre; };
    const genreWord = () => (S.genre === "dnb" ? "DnB" : genreLabel().toLowerCase());
    // 9 rows should fit without scrolling: shrink the row height a little when the window is short
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { const h = root.clientHeight; if (!h) return; root.style.setProperty("--kd-row", clamp(Math.floor((h - 70) / 9) - 4, 40, 54) + "px"); }) : null;
    if (ro) ro.observe(root);

    // ---------------------------------------------------------------- sounds
    function pickLayers(slot, count, e, seed) {
      const all = items(), note = NOTE_OF[slot], mainId = e.kitId && e.kitId[note], main = all.find((x) => x.id === mainId) || all.find((x) => x.url === e.kit[note]);
      const tags = new Set((main && main.tags) || []), R = rng(seed), out = [], used = new Set([mainId]);
      const pool = all.filter((x) => (FITS[slot] || [slot]).includes(x.type) && x.id !== mainId);
      pool.sort((a, b) => score(b) - score(a));
      function score(it) { let s = 0; for (const t of it.tags || []) if (tags.has(t)) s += 1; return s + R() * 2.5; }
      for (const it of pool) { if (out.length >= count) break; if (used.has(it.id)) continue; used.add(it.id); const k = out.length;
        out.push({ url: it.url, name: it.name, sound: it.id, gain: +(0.6 + R() * 0.15).toFixed(2), tune: +((k % 2 ? -1 : 1) * (0.12 + R() * 0.23)).toFixed(2), pan: +((k % 2 ? 1 : -1) * (0.15 + R() * 0.1)).toFixed(2) }); }
      return out;
    }
    function applyLayers(slot, e, seed) {
      const p = S.pads[slot], kp = kpOf(e, slot);
      if ((p.layers || 1) <= 1) { delete kp.layers; delete kp.layerMode; return; }
      kp.layers = pickLayers(slot, p.layers - 1, e, seed + ":L:" + slot);
      if (!kp.layers.length) { p.layers = 1; delete kp.layers; delete kp.layerMode; return; }
      kp.layerMode = p.layerMode || (/^hat|perc/.test(slot) ? "turns" : "stack"); p.layerMode = kp.layerMode;
    }
    function rollSound(slot, e, seed) {  // mutates e, returns the item or null
      const L = lib(); let id = null;
      try { if (L.roll) { const r = L.roll(ctx.kit ? ctx.kit() : null, slot, hash(seed + ":" + slot)); const x = r && r.pads && r.pads[slot]; id = typeof x === "string" ? x : x && (x.sound || x.id); } } catch (err) { /* fallback below */ }
      const all = items(), note = NOTE_OF[slot], cur = e.kitId && e.kitId[note];
      let item = id && id !== cur && all.find((x) => x.id === id);
      if (!item) { const R = rng(seed + ":" + slot + ":f"); for (const type of FITS[slot] || [slot]) { const pool = all.filter((x) => x.type === type && x.id !== cur); if (pool.length) { item = pool[Math.floor(R() * pool.length)]; break; } } }
      if (!item) return null;
      e.kit = e.kit || {}; e.kitName = e.kitName || {}; e.kitId = e.kitId || {}; e.kitGain = e.kitGain || {};
      e.kit[note] = item.url; e.kitName[note] = item.name; e.kitId[note] = item.id; if (e.kitGain[note] == null) e.kitGain[note] = 1; kpOf(e, slot);
      applyLayers(slot, e, seed);
      return item;
    }
    function setSound(slot, item) {
      const e = ctx.getKit(), note = NOTE_OF[slot]; e.kit = e.kit || {}; e.kitName = e.kitName || {}; e.kitId = e.kitId || {}; e.kitGain = e.kitGain || {};
      e.kit[note] = item.url; e.kitName[note] = item.name; e.kitId[note] = item.id; if (e.kitGain[note] == null) e.kitGain[note] = 1; kpOf(e, slot);
      applyLayers(slot, e, S.seed + ":" + item.id);
      kitE = e; ctx.setKit(e, true); hit(slot); renderRows(); renderDetail(); ctx.say(`${LABEL[slot]}: ${item.name}.`);
    }
    function stepSound(slot, dir) {
      const pool = items().filter((x) => (FITS[slot] || [slot]).includes(x.type)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (!pool.length) return ctx.say("No sounds loaded yet.");
      const cur = kitE && kitE.kitId && kitE.kitId[NOTE_OF[slot]]; let i = pool.findIndex((x) => x.id === cur); i = i < 0 ? 0 : (i + dir + pool.length) % pool.length;
      setSound(slot, pool[i]);
    }

    // ---------------------------------------------------------------- patterns
    const stepsBySlot = () => Object.fromEntries(SLOTS.map((s) => [s, S.pads[s].steps]));
    function applyPatterns(seed, only) {
      const locked = {}; for (const s of SLOTS) if (S.pads[s].lock.pattern || (only && s !== only)) locked[s] = S.pads[s].steps;
      let b = null; try { b = P().beat({ genre: S.genre, bpm: clip.bpm, bars: S.bars, seed, locked }); } catch (e) { console.error(e); b = FB.beat({ genre: S.genre, bpm: clip.bpm, bars: S.bars, seed, locked }); }
      const keep = {}; for (const s of SLOTS) if (!locked[s]) S.pads[s].steps.forEach((st, i) => { if (st && st.v && st.u) (keep[s] = keep[s] || []).push([i, st]); });
      for (const s of SLOTS) if (!locked[s] && b && b.pads && b.pads[s]) S.pads[s].steps = fit(b.pads[s], S.bars);
      if (!locked["808"]) S.pads["808"].steps = slides808(S.pads["808"].steps, seed);
      for (const s in keep) for (const [i, st] of keep[s]) if (i < S.pads[s].steps.length) S.pads[s].steps[i] = st; // unique hits stay where they are
    }
    // Trap, drill and rage 808s move: some notes jump to a fifth/octave/minor third and glide in
    // (seeded, so the same roll gives the same line). Other styles keep the 808 on its root.
    function slides808(steps, seed) {
      if (!/^(trap|drill|rage)$/.test(S.genre)) return steps;
      const R = rng(seed + ":808"), JUMPS = [12, 7, 5, 3, -2, -5], amt = S.genre === "drill" ? 0.45 : 0.3;
      let n = 0;
      return steps.map((st) => {
        if (!st.v) return st;
        const o = { v: st.v, r: st.r }; n++;
        if (n > 1 && R() < amt) { o.t = JUMPS[Math.floor(R() * JUMPS.length)]; if (R() < 0.6) o.g = true; }
        return o;
      });
    }
    // While FX is on, ROLL (and a pad's sound dice) also rolls the effect dots of those pads (Eman, 27 Oct).
    function rollFx(e, slots) {
      const K = window.KdFx;
      if (!K || !K.isOn || !K.rollDots || !K.isOn(e.kitVoid)) return false;
      const kv = JSON.parse(JSON.stringify(e.kitVoid));
      if (!K.rollDots(kv, kv.sync ? ["sync"] : slots.map((s) => NOTE_OF[s]))) return false;
      e.kitVoid = kv;
      try { if (K.host && K.host.update) K.host.update(pid, JSON.parse(JSON.stringify(kv))); } catch (err) { /* heard on the next pass */ }
      return true;
    }
    function rollAll(sounds, patterns) {
      S.seed = newSeed(); const e = ctx.getKit(); let got = 0;
      if (sounds) for (const s of SLOTS) if (!S.pads[s].lock.sound && rollSound(s, e, S.seed)) got++;
      if (patterns) applyPatterns(S.seed);
      if (sounds && patterns && rollFx(e, SLOTS.filter((s) => !(S.pads[s].lock.sound && S.pads[s].lock.pattern)))) got++;
      if (got) { kitE = e; ctx.setKit(e, true); }
      renderAll(); save(true);
      const kept = SLOTS.filter((s) => (sounds && S.pads[s].lock.sound) || (patterns && S.pads[s].lock.pattern)).map((s) => LABEL[s]);
      ctx.say(`${sounds && patterns ? "New " + genreWord() + " beat" : sounds ? "New sounds" : "New " + genreWord() + " patterns"}.${kept.length ? " " + list(kept) + " kept." : ""}`);
    }
    function rollOne(slot, sound, pattern) {
      const seed = newSeed(); let item = null;
      clearUnique(slot);
      if (sound) { const e = ctx.getKit(); item = rollSound(slot, e, seed); const fx = rollFx(e, [slot]); if (item || fx) { kitE = e; ctx.setKit(e, true); } }
      if (pattern) { let st = null; try { st = P().pad(slot, { genre: S.genre, bpm: clip.bpm, bars: S.bars, seed, beat: stepsBySlot() }); } catch (e) { console.error(e); st = FB.pad(slot, { genre: S.genre, bars: S.bars, seed }); } if (st) S.pads[slot].steps = slot === "808" ? slides808(fit(st, S.bars), seed) : fit(st, S.bars); }
      select(slot); paintTrack(slot); renderRows(); renderDetail(); save(true); hit(slot);
      ctx.say(sound && pattern ? `New ${LABEL[slot].toLowerCase()}.` : sound ? (item ? `${LABEL[slot]}: ${item.name}.` : "No other sound for that pad.") : `New ${LABEL[slot].toLowerCase()} pattern.`);
    }
    function toggleLock(slot) {
      const l = S.pads[slot].lock, on = !(l.sound && l.pattern); l.sound = on; l.pattern = on;
      renderRows(); renderDetail(); save(true); ctx.say(on ? `${LABEL[slot]} locked: ROLL leaves it alone.` : `${LABEL[slot]} unlocked.`);
    }
    function setLayers(slot, n) {
      n = clamp(Math.round(n), 1, 4); const p = S.pads[slot]; if (p.layers === n) return; p.layers = n; p.layerSeed = newSeed();
      const e = ctx.getKit(); applyLayers(slot, e, S.seed + ":" + p.layerSeed); kitE = e; ctx.setKit(e, true); hit(slot);
      renderRows(); renderDetail(); save(true);
      const nm = LABEL[slot].toLowerCase();
      ctx.say(p.layers > 1 ? `${p.layers} ${nm}s ${p.layerMode === "turns" ? "taking turns" : "mixed"} on the ${nm} pad.` : `One sound on the ${nm} pad.`);
    }
    function setMode(slot, mode) {
      const p = S.pads[slot]; p.layerMode = mode; const e = ctx.getKit(), kp = kpOf(e, slot); if (kp.layers) kp.layerMode = mode;
      kitE = e; ctx.setKit(e, true); renderDetail(); save(true); ctx.say(mode === "turns" ? `${LABEL[slot]} sounds take turns.` : `${LABEL[slot]} sounds play together.`);
    }
    function setBars(n) { if (S.bars === n) return; S.bars = n; for (const s of SLOTS) S.pads[s].steps = fit(S.pads[s].steps, n); S.lines = copyLines(S.lines, n); buildRing(); renderBar(); syncCur(); renderChain(); save(true); ctx.say(n > 1 ? "Two bars." : "One bar."); }
    function setGenre(id) { S.genre = id; renderBar(); rollAll(false, true); }
    async function stopAll() {
      if (soloOn) { soloOn = false; await B("killDrumSolo", { pluginId: pid, on: false }); return; }
      const tr = typeof ui !== "undefined" && ui.transport; if (tr && tr.playing && typeof run === "function") await run("togglePlay");
    }
    async function togglePlay() {
      try {
        const tr = typeof ui !== "undefined" && ui.transport;
        if (soloOn || (tr && tr.playing)) { await stopAll(); return; }
        if (pmode === "solo") {
          syncCur(); const r = await B("killDrumSolo", soloArgs(true));
          if (r && r.ok) { soloOn = true; return; }
          if (clip.clipLength > 0) await B("setLoopRange", { start: clip.clipStart, end: clip.clipStart + Math.min(clip.clipLength, 4 * S.bars * 60 / (clip.bpm || 120)) }); // no SOLO in this engine: loop the clip's start
        }
        if (typeof run === "function") await run("togglePlay");
      } catch (e) { console.error(e); }
    }

    // ---------------------------------------------------------------- small controls
    function bindCount(elm, slot) {
      let d = null;
      elm.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); elm.setPointerCapture(e.pointerId); d = { y: e.clientY, n: S.pads[slot].layers || 1, moved: false }; });
      elm.addEventListener("pointermove", (e) => { if (!d) return; const dy = d.y - e.clientY; if (Math.abs(dy) > 3) d.moved = true; const n = clamp(d.n + Math.round(dy / 14), 1, 4); if (n !== (S.pads[slot].layers || 1)) setLayers(slot, n); });
      const up = (e) => { if (!d) return; const m = d.moved; d = null; e.stopPropagation(); if (!m) setLayers(slot, ((S.pads[slot].layers || 1) % 4) + 1); };
      elm.addEventListener("pointerup", up); elm.addEventListener("pointercancel", () => (d = null));
      elm.addEventListener("click", (e) => e.stopPropagation());
    }
    function bindDial(elm) {
      let d = null;
      elm.addEventListener("pointerdown", (e) => { e.preventDefault(); elm.setPointerCapture(e.pointerId); d = { y: e.clientY, n: S.pads[sel].layers || 1, moved: false }; });
      elm.addEventListener("pointermove", (e) => { if (!d) return; const dy = d.y - e.clientY; if (Math.abs(dy) > 3) d.moved = true; const n = clamp(d.n + Math.round(dy / 18), 1, 4); if (n !== (S.pads[sel].layers || 1)) setLayers(sel, n); });
      const up = () => { if (!d) return; const m = d.moved; d = null; if (!m) setLayers(sel, ((S.pads[sel].layers || 1) % 4) + 1); };
      elm.addEventListener("pointerup", up); elm.addEventListener("pointercancel", () => (d = null));
      elm.addEventListener("wheel", (e) => { e.preventDefault(); setLayers(sel, (S.pads[sel].layers || 1) + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    }
    function bindMini(elm) {
      const k = elm.dataset.k, b = elm.querySelector("b"), max = k === "swing" ? 0.6 : 1; let d = null;
      const show = () => (b.textContent = Math.round((S[k] || 0) * 100) + "%");
      elm._show = show;
      elm.addEventListener("pointerdown", (e) => { e.preventDefault(); elm.setPointerCapture(e.pointerId); d = { y: e.clientY, v: S[k] || 0 }; });
      elm.addEventListener("pointermove", (e) => { if (!d) return; const v = clamp(d.v + (d.y - e.clientY) / 160, 0, max); if (v !== S[k]) { S[k] = +v.toFixed(3); show(); save(false); } });
      const up = () => { if (!d) return; d = null; save(true); };
      elm.addEventListener("pointerup", up); elm.addEventListener("pointercancel", up);
      elm.addEventListener("dblclick", () => { S[k] = 0; show(); save(true); });
      show();
    }
    let pop = null;
    function closeGenres() { if (pop) { pop.remove(); pop = null; document.removeEventListener("pointerdown", onDoc, true); } }
    function onDoc(e) { if (pop && !pop.contains(e.target) && e.target !== genreBtn) closeGenres(); }
    function openGenres() {
      if (pop) return closeGenres();
      pop = el("div", "kb-pop");
      for (const g of genres()) { const b = el("button", "kb-popi" + (g.id === S.genre ? " kb-on" : ""), `<span>${g.label}</span><em>${g.bpm ? g.bpm[0] + "–" + g.bpm[1] : ""}</em>`); b.onclick = () => { closeGenres(); setGenre(g.id); }; pop.append(b); }
      const rr = root.getBoundingClientRect(), br = genreBtn.getBoundingClientRect();
      pop.style.left = br.left - rr.left + "px"; pop.style.top = br.bottom - rr.top + 4 + "px";
      root.append(pop); setTimeout(() => document.addEventListener("pointerdown", onDoc, true), 0);
    }

    // ---------------------------------------------------------------- SAVED beats (Eman, 27 Oct)
    // One press keeps the open beat: its pattern (the open BAR, style, swing) and its sounds (the kit).
    // No name typed = a made-up one from the style and the feel ("Plastic Beach" style). Under it: when,
    // which style, what BPM. Load the pattern, the sounds or both; hold one to hear it at today's tempo.
    // Stored in this browser (localStorage "killdrum.beats").
    const BEATS_KEY = "killdrum.beats";
    const savedBeats = () => { try { const a = JSON.parse(localStorage.getItem(BEATS_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    const putBeats = (a) => { try { localStorage.setItem(BEATS_KEY, JSON.stringify(a.slice(0, 120))); return true; } catch (e) { ctx.say("Couldn't save: this browser's storage is full."); return false; } };
    const WORDS = {
      chill: [["Velvet", "Paper", "Faded", "Sleepy", "Cloudy", "Pastel", "Dusty", "Quiet", "Golden", "Hazy", "Lazy", "Rainy", "Sunday", "Polaroid", "Plastic", "Linen", "Honey"],
              ["Beach", "Window", "Garden", "Lagoon", "Motel", "Cassette", "Balcony", "Postcard", "Harbor", "Laundromat", "Aquarium", "Daydream", "Bus Stop", "Moon", "Swimming Pool", "Diner"]],
      heavy: [["Rusted", "Venom", "Chrome", "Broken", "Feral", "Black", "Static", "Toxic", "Iron", "Burnt", "Savage", "Concrete", "Hollow", "Rabid", "Cursed", "Barbed"],
              ["Cathedral", "Engine", "Riot", "Teeth", "Furnace", "Siren", "Bunker", "Halo", "Wolfpack", "Machine", "Throne", "Voltage", "Casket", "Asylum", "Chainsaw", "Crown"]],
      dance: [["Midnight", "Strobe", "Liquid", "Laser", "Hyper", "Disco", "Rubber", "Infinite", "Mirror", "Sugar", "Turbo", "Neon"],
              ["Club", "Tunnel", "Pulse", "Highway", "Arcade", "Orbit", "Basement", "Skyline", "Rollerdisco", "Afterparty", "Elevator", "Satellite"]],
      glass: [["Crystal", "Neon", "Glitter", "Ghost", "Ice", "Pixel", "Witch", "Frozen", "Digital", "Silver"],
              ["Castle", "Arcade", "Mirror", "Prism", "Signal", "Nightmare", "Comet", "Chapel", "Glitch", "Bloom"]],
    };
    function feelOf() {
      const g = S.genre, e = kitE || {}, pads = Object.values(e.kitPad || {});
      const dirt = pads.reduce((a, p) => a + (+p.drive || 0) + ((p.fx || []).length ? 0.3 : 0), 0);
      if (g === "crystal") return "glass";
      if (/house|techno|jersey|dnb/.test(g)) return "dance";
      if (/rage|drill/.test(g) || dirt > 1.2 || (g === "trap" && (clip.bpm || 120) >= 150)) return "heavy";
      return "chill";
    }
    function moodName() {
      const [A, N] = WORDS[feelOf()], R = rng(newSeed()), taken = new Set(savedBeats().map((b) => b.name));
      for (let k = 0; k < 40; k++) { const n = A[Math.floor(R() * A.length)] + " " + N[Math.floor(R() * N.length)]; if (!taken.has(n)) return n; }
      return A[0] + " " + N[0] + " " + (taken.size + 1);
    }
    const KIT_KEYS = ["kit", "kitName", "kitId", "kitGain", "kitPad", "kitTitle", "choke"];
    function saveBeat(name) {
      syncCur();
      const e = ctx.getKit(), kit = {}; for (const k of KIT_KEYS) if (e[k] != null) kit[k] = JSON.parse(JSON.stringify(e[k]));
      const b = { id: "s" + newSeed().toString(36), name: (name || "").trim() || moodName(), at: new Date().toISOString(), genre: S.genre, bpm: Math.round(clip.bpm || 120),
        beat: { bars: S.bars, swing: S.swing, humanize: S.humanize, seed: S.seed, pads: Object.fromEntries(SLOTS.map((x) => [x, JSON.parse(JSON.stringify(S.pads[x].steps))])), lines: copyLines(S.lines, S.bars) }, kit };
      if (!putBeats([b, ...savedBeats()])) return null;
      ctx.say(`Saved as “${b.name}”.`); return b;
    }
    ctx.saveBeat = () => { const b = saveBeat(""); if (b && spop) renderSaved(); return b; }; // the window's Save button
    let loadWhat = "both";
    try { const w = localStorage.getItem("killdrum.loadWhat"); if (/^(both|pattern|sounds)$/.test(w)) loadWhat = w; } catch (e) { /* default */ }
    function loadBeat(b, what) {
      const pat = what !== "sounds", snd = what !== "pattern";
      if (snd && b.kit) { const e = ctx.getKit(); for (const k of KIT_KEYS) if (b.kit[k] != null) e[k] = JSON.parse(JSON.stringify(b.kit[k])); kitE = e; ctx.setKit(e, true); }
      if (pat && b.beat) {
        const q = b.beat; S.bars = q.bars === 2 ? 2 : 1; S.swing = +q.swing || 0; S.humanize = +q.humanize || 0; if (b.genre) S.genre = b.genre;
        for (const x of SLOTS) S.pads[x].steps = fit((q.pads || {})[x] || [], S.bars);
        S.lines = copyLines(q.lines, S.bars);
        pick = null; buildRing();
      }
      renderAll(); renderVers(); save(true);
      ctx.say(`${what === "pattern" ? "Pattern" : what === "sounds" ? "Sounds" : "Pattern and sounds"} from “${b.name}”.`);
    }
    // Hover to hear (Eman, 27 Oct), following the switch: Both = the saved pattern with its saved sounds;
    // Pattern only = the saved pattern with the sounds you have now; Sounds only = your pattern now with
    // the saved sounds. The box draws what plays, with a playhead. Nothing changes until you click.
    let prev = null;
    function previewSrc(b) {
      const q = b.beat || {}, curPads = Object.fromEntries(SLOTS.map((x) => [x, S.pads[x].steps]));
      const usePat = loadWhat !== "sounds", useSnd = loadWhat !== "pattern";
      const bars = usePat ? (q.bars === 2 ? 2 : 1) : S.bars;
      const pads = Object.fromEntries(SLOTS.map((x) => [x, fit(usePat ? (q.pads || {})[x] || [] : curPads[x], bars)]));
      const kit = useSnd ? b.kit || {} : ctx.getKit();
      return { pads, bars, kit, swing: usePat ? q.swing : S.swing, seed: usePat ? q.seed : S.seed };
    }
    function previewStart(b, cv) {
      previewStop();
      const src = previewSrc(b), spb = 60 / (clip.bpm || 120), bars = src.bars;
      let notes = [];
      try { notes = P().toNotes(src.pads, { bars, clipBeats: 4 * bars, swing: src.swing, seed: src.seed, noteOf: NOTE_OF }); } catch (e) { return; }
      const kit = src.kit, t0 = performance.now() + 40, loop = 4 * bars * spb * 1000, timers = [];
      prev = { timers, until: t0 + 30000, raf: 0 };
      const sched = (L) => {
        if (!prev || prev.timers !== timers) return;
        for (const n of notes) {
          const at = t0 + L * loop + n.start * spb * 1000; if (at > prev.until) continue;
          const url = kit.kit && kit.kit[n.pitch]; if (!url) continue;
          const pad = (kit.kitPad && kit.kitPad[n.pitch]) || {}, g = (kit.kitGain && kit.kitGain[n.pitch]) || 1;
          timers.push(setTimeout(() => { if (prev && prev.timers === timers) B("killDrumHit", { pluginId: pid, pitch: n.pitch, velocity: Math.min(127, Math.round((n.velocity || 100) * Math.min(1.6, g))), url, pad: n.tune ? { ...pad, tune: (pad.tune || 0) + n.tune } : pad }); }, Math.max(0, at - performance.now())));
        }
        if (t0 + (L + 1) * loop < prev.until) timers.push(setTimeout(() => sched(L + 1), Math.max(0, t0 + (L + 1) * loop - performance.now() - 200)));
      };
      sched(0);
      if (cv) { const me = prev, draw = () => { if (prev !== me) return; const x = (performance.now() - t0) / loop; drawMini(cv, src.pads, bars, x >= 0 ? x % 1 : -1); me.raf = requestAnimationFrame(draw); }; draw(); me.cv = cv; me.b = b; }
    }
    function previewStop() {
      if (!prev) return; const p0 = prev; prev = null; p0.timers.forEach(clearTimeout); cancelAnimationFrame(p0.raf);
      if (p0.cv && p0.b) drawSaved(p0.cv, p0.b);
    }
    function drawSaved(cv, b) { const q = previewSrc(b); drawMini(cv, q.pads, q.bars, -1); }
    function drawMini(cv, padsIn, barsIn, ph) { // the pattern as rows of ticks, coloured by pad (like the timeline clip)
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || 240, H = cv.clientHeight || 44;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const n = 16 * (barsIn === 2 ? 2 : 1), pads = padsIn || {}, rowsOn = SLOTS.filter((x) => (pads[x] || []).some((st) => st && st.v));
      const rh = H / Math.max(1, rowsOn.length), cur = ph >= 0 ? Math.floor(ph * n) : -1;
      rowsOn.forEach((x, r) => {
        const st = pads[x]; g.fillStyle = COLOR[x];
        for (let i = 0; i < Math.min(n, st.length); i++) { const s0 = st[i]; if (!s0 || !s0.v) continue; g.globalAlpha = (0.45 + 0.55 * s0.v / 127) * (cur >= 0 && i !== cur ? 0.7 : 1); g.fillStyle = i === cur ? "#fff" : COLOR[x]; g.fillRect(((i + (s0.o || 0)) / n) * W + 1, r * rh + rh * 0.2, Math.max(2, W / n - 3), Math.max(2, rh * 0.6)); }
      });
      g.globalAlpha = 1;
      if (ph >= 0) { g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(ph * W, 0, 1.5, H); }
    }
    let spop = null;
    function closeSaved() { if (spop) { previewStop(); spop.remove(); spop = null; document.removeEventListener("pointerdown", onDocSaved, true); } }
    function onDocSaved(e) { if (spop && !spop.contains(e.target) && !savedBtn.contains(e.target)) closeSaved(); }
    function openSaved() {
      if (spop) return closeSaved();
      spop = el("div", "kb-pop kb-spop");
      const rr = root.getBoundingClientRect(), br = savedBtn.getBoundingClientRect();
      spop.style.left = Math.max(8, br.left - rr.left - 40) + "px"; spop.style.top = br.bottom - rr.top + 6 + "px";
      root.append(spop); renderSaved();
      setTimeout(() => document.addEventListener("pointerdown", onDocSaved, true), 0);
    }
    const fmtWhen = (iso) => { const d = new Date(iso); if (isNaN(d)) return ""; return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); };
    function renderSaved() {
      if (!spop) return; spop.replaceChildren();
      const top = el("div", "kb-shead");
      const inp = el("input", "kb-sname"); inp.placeholder = "Name (optional)"; inp.maxLength = 40;
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") doSave(); };
      const sv = el("button", "kb-ssave", "Save"); sv.title = "Save the open beat: pattern and sounds";
      const doSave = () => { if (saveBeat(inp.value)) renderSaved(); };
      sv.onclick = doSave; top.append(inp, sv); spop.append(top);
      const seg = el("div", "kd-seg kb-swhat", `<button data-w="both">Both</button><button data-w="pattern">Pattern only</button><button data-w="sounds">Sounds only</button>`);
      for (const b of seg.querySelectorAll("button")) { b.classList.toggle("kd-on", b.dataset.w === loadWhat); b.onclick = () => { previewStop(); loadWhat = b.dataset.w; try { localStorage.setItem("killdrum.loadWhat", loadWhat); } catch (e) { /* fine */ } renderSaved(); }; }
      spop.append(seg);
      const list = el("div", "kb-slist"), all = savedBeats();
      if (!all.length) list.append(el("div", "kb-snone", "Nothing saved yet. Make something you like and press Save."));
      for (const b of all) {
        const g = genres().find((x) => x.id === b.genre);
        const card = el("div", "kb-scard", `<div class="kb-stop"><b></b><button class="kb-sx" title="Delete">×</button></div><canvas></canvas><div class="kb-sinfo"></div>`);
        card.querySelector("b").textContent = b.name;
        card.querySelector(".kb-sinfo").textContent = [fmtWhen(b.at), g ? g.label : b.genre, b.bpm ? b.bpm + " BPM" : ""].filter(Boolean).join(" · ");
        card.title = `Click: load ${loadWhat === "both" ? "pattern and sounds" : loadWhat === "pattern" ? "the pattern" : "the sounds"}. Point at it to hear it at ${Math.round(clip.bpm || 120)} BPM (saved at ${b.bpm}).`;
        card.querySelector(".kb-sx").onclick = (e) => { e.stopPropagation(); putBeats(savedBeats().filter((x) => x.id !== b.id)); renderSaved(); };
        const cv = card.querySelector("canvas");
        let hoverT = 0;
        card.onpointerenter = () => { clearTimeout(hoverT); hoverT = setTimeout(() => { card.classList.add("kb-shear"); previewStart(b, cv); }, 120); };
        card.onpointerleave = () => { clearTimeout(hoverT); card.classList.remove("kb-shear"); if (prev && prev.b === b) previewStop(); };
        card.onclick = (e) => { if (e.target.closest(".kb-sx")) return; clearTimeout(hoverT); previewStop(); loadBeat(b, loadWhat); closeSaved(); };
        list.append(card);
        requestAnimationFrame(() => drawSaved(cv, b));
      }
      spop.append(list);
    }

    // ---------------------------------------------------------------- bars: pitch, decay, drive, filter, pan, level of the selected pad
    const hz = (f) => (f < 1000 ? Math.round(f) + " Hz" : (f / 1000).toFixed(f < 10000 ? 1 : 0) + " kHz");
    const BARS = [
      { k: "tune", label: "Pitch", mid: true, min: -24, max: 24, def: 0, step: 1, fmt: (v) => (v > 0 ? "+" : "") + Math.round(v) + " st", tip: "Pitch: drag left/right, double-click resets" },
      { k: "decay", label: "Decay", min: 0, max: 1, def: 1, fmt: (v) => (v >= 0.995 ? "Full" : Math.round(v * 100) + "%"), tip: "Decay: how long the sound rings" },
      { k: "drive", label: "Drive", min: 0, max: 1, def: 0, fmt: (v) => Math.round(v * 100) + "%", tip: "Drive: grit and distortion" },
      { k: "cutoff", label: "Filter", min: 0, max: 1, def: 1, fmt: (v) => (v >= 0.995 ? "Open" : hz(60 * Math.pow(20000 / 60, v))), tip: "Filter: darker to the left" },
      { k: "pan", label: "Pan", mid: true, min: -1, max: 1, def: 0, fmt: (v) => (Math.abs(v) < 0.005 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100)), tip: "Pan: left / right" },
      { k: "level", label: "Level", min: -24, max: 12, def: 0, gain: true, fmt: (v) => (v > 0.05 ? "+" : "") + (Math.abs(v) < 0.05 ? "0" : v.toFixed(1)) + " dB", tip: "Level of this pad" },
    ];
    const barEls = {};
    // a unique hit's bars sit on top of the row: pitch adds, decay shortens, level adds dB
    const U_DEF = { tune: 0, decay: 1, drive: 0, cutoff: 1, pan: 0, level: 0 };
    function barGet(e, slot, b) {
      const U = uniq(); if (U) { const v = U[b.k]; return v == null ? U_DEF[b.k] : clamp(+v, b.min, b.max); }
      const note = NOTE_OF[slot];
      if (b.gain) { const g = e && e.kitGain && e.kitGain[note]; return clamp(20 * Math.log10(Math.max(g == null ? 1 : +g, 1e-4)), b.min, b.max); }
      const kp = (e && e.kitPad && e.kitPad[note]) || {}; const v = kp[b.k]; return v == null ? b.def : clamp(+v, b.min, b.max);
    }
    function barSet(e, slot, b, v) {
      v = clamp(v, b.min, b.max);
      const U = uniq(); if (U) { v = b.step ? Math.round(v) : +v.toFixed(3); if (v === U_DEF[b.k]) delete U[b.k]; else U[b.k] = v; return; }
      if (b.gain) { e.kitGain = e.kitGain || {}; e.kitGain[NOTE_OF[slot]] = +Math.pow(10, v / 20).toFixed(4); return; }
      kpOf(e, slot)[b.k] = b.step ? Math.round(v) : +v.toFixed(3);
    }
    function paintBar(b, v) {
      const elm = barEls[b.k]; if (!elm) return; const n = (v - b.min) / (b.max - b.min);
      if (b.mid) { elm.style.setProperty("--a", (n >= 0.5 ? 0.5 : n).toFixed(3)); elm.style.setProperty("--w", Math.abs(n - 0.5).toFixed(3)); } else elm.style.setProperty("--v", n.toFixed(3));
      elm.querySelector("b").textContent = b.fmt(v);
    }
    function renderBars() { for (const b of BARS) paintBar(b, barGet(kitE, sel, b)); }
    function buildBars(host) {
      for (const b of BARS) {
        const elm = el("div", "kd-bar" + (b.mid ? " kd-mid" : ""), `<span>${b.label}</span><b></b>`); elm.title = b.tip; host.append(elm); barEls[b.k] = elm;
        let d = null, sendT = 0, sendDue = false;
        const send = (e, undo) => { try { ctx.setKit(e, undo); } catch (err) { /* no engine */ } };
        const push = (e) => { if (sendT) { sendDue = true; return; } send(e, false); sendT = setTimeout(() => { sendT = 0; if (sendDue) { sendDue = false; push(e); } }, 33); };
        elm.addEventListener("pointerdown", (ev) => {
          if (ev.button !== 0) return; ev.preventDefault(); elm.setPointerCapture(ev.pointerId);
          const e = ctx.getKit(), v0 = barGet(e, sel, b); d = { e, slot: sel, u: !!uniq(), x: ev.clientX, v0, v: v0, w: Math.max(60, elm.clientWidth) }; elm.classList.add("kd-drag");
        });
        elm.addEventListener("pointermove", (ev) => {
          if (!d) return; const v = clamp(d.v0 + ((ev.clientX - d.x) / d.w) * (b.max - b.min) * (ev.shiftKey ? 0.25 : 1), b.min, b.max);
          if (v === d.v) return; d.v = v; barSet(d.e, d.slot, b, v); paintBar(b, barGet(d.e, d.slot, b));
          if (d.u) changed(d.slot, false); else push(d.e);
        });
        const up = () => { if (!d) return; const x = d; d = null; clearTimeout(sendT); sendT = 0; sendDue = false; elm.classList.remove("kd-drag");
          if (x.u) { changed(x.slot, true); renderBars(); hitUnique(); return; }
          kitE = x.e; send(x.e, true); renderBars(); hit(x.slot); };
        elm.addEventListener("pointerup", up); elm.addEventListener("pointercancel", up);
        elm.addEventListener("dblclick", () => {
          if (uniq()) { barSet(null, sel, b, U_DEF[b.k]); changed(sel, true); renderBars(); hitUnique(); ctx.say(`This hit's ${b.label.toLowerCase()} follows the row again.`); return; }
          const e = ctx.getKit(); barSet(e, sel, b, b.def); kitE = e; send(e, true); renderBars(); hit(sel); ctx.say(`${LABEL[sel]} ${b.label.toLowerCase()} back to normal.`); });
      }
    }
    buildBars(D.bars);
    // the picked hit's own step settings (were the STEPS strip): chance, glide, note pitch
    for (const b of D.hitopts.querySelectorAll(".kb-chance button")) b.onclick = () => { const st = picked(); if (!st) return; const c = Number(b.dataset.c); if (c >= 1) delete st.c; else st.c = c; hint(`${LABEL[pick.slot]} hit plays ${Math.round(c * 100)}% of the time.`); ringChanged(pick.slot, true); };
    D.hitopts.querySelector(".kb-glidebtn").onclick = () => { const st = picked(); if (!st) return; st.g = !st.g; if (!st.g) delete st.g; hint(st.g ? "Glides in from the note before." : "No glide."); ringChanged(pick.slot, true); };
    (function bindNote(elm) {
      let d = null;
      elm.addEventListener("pointerdown", (e) => { const st = picked(); if (!st || e.button !== 0) return; e.preventDefault(); elm.setPointerCapture(e.pointerId); d = { x: e.clientX, t0: st.t || 0, w: Math.max(60, elm.clientWidth), st, slot: pick.slot }; elm.classList.add("kd-drag"); });
      elm.addEventListener("pointermove", (e) => { if (!d) return; const t = clamp(Math.round(d.t0 + ((e.clientX - d.x) / d.w) * 48), -24, 24); if (t === (d.st.t || 0)) return; if (t) d.st.t = t; else delete d.st.t; changed(d.slot, false); renderPick(); });
      const up = () => { if (!d) return; const x = d; d = null; elm.classList.remove("kd-drag"); changed(x.slot, true); renderPick(); hitUnique(); };
      elm.addEventListener("pointerup", up); elm.addEventListener("pointercancel", up);
      elm.addEventListener("dblclick", () => { const st = picked(); if (!st) return; delete st.t; ringChanged(pick.slot, true); });
    })(D.hitopts.querySelector(".kb-notept"));
    // Effects, the small version of the FX page (Eman, 27 Oct): tap one to switch it on, drag it for
    // how much, double-click switches it off. On the row they reach every hit of the row (unique ones
    // too); on a unique hit they are extra, for that hit only. Same effect cards the vibe box adds.
    const FXK = [{ k: "reverb", label: "Reverb" }, { k: "delay", label: "Delay" }, { k: "drive", label: "Saturate" }, { k: "clip", label: "Clip" },
      { k: "crush", label: "Crush" }, { k: "lofi", label: "Lo-fi" }];
    const fxEls = {};
    function fxList(e) { const U = uniq(); if (U) return U.fx || (U.fx = []); const kp = kpOf(e, sel); return kp.fx || (kp.fx = []); }
    function fxCommit(e, undo, sound) {
      const U = uniq();
      if (U) { if (U.fx && !U.fx.length) delete U.fx; changed(sel, undo); if (sound) hitUnique(); }
      else { kitE = e; try { ctx.setKit(e, undo); } catch (err) { /* no engine */ } if (sound) hit(sel); }
      renderFx();
    }
    function renderFx() {
      const U = uniq(), cur = U ? U.fx || [] : ((kitE && kitE.kitPad && kitE.kitPad[NOTE_OF[sel]]) || {}).fx || [];
      for (const f of FXK) {
        const elm = fxEls[f.k]; if (!elm) continue; const x = cur.find((q) => q.kind === f.k);
        elm.classList.toggle("kb-fxon", !!x); elm.style.setProperty("--v", x ? (x.amount != null ? x.amount : 0.5).toFixed(3) : "0");
        elm.querySelector("b").textContent = x ? Math.round((x.amount != null ? x.amount : 0.5) * 100) + "%" : "off";
      }
    }
    for (const f of FXK) {
      const elm = el("div", "kd-bar kb-fxb", `<span>${f.label}</span><b>off</b>`); elm.title = `${f.label}: click to switch on, drag left/right for how much, double-click switches it off`;
      D.fx.append(elm); fxEls[f.k] = elm;
      let d = null;
      elm.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return; ev.preventDefault(); elm.setPointerCapture(ev.pointerId);
        const e = ctx.getKit(), l = fxList(e), x = l.find((q) => q.kind === f.k);
        d = { e, x: ev.clientX, a0: x ? (x.amount != null ? x.amount : 0.5) : 0, was: !!x, moved: false, w: Math.max(60, elm.clientWidth) };
      });
      elm.addEventListener("pointermove", (ev) => {
        if (!d) return; if (!d.moved && Math.abs(ev.clientX - d.x) < 3) return; d.moved = true;
        const a = clamp(d.a0 + (ev.clientX - d.x) / d.w, 0, 1), l = fxList(d.e); let x = l.find((q) => q.kind === f.k);
        if (a <= 0.01) { if (x) l.splice(l.indexOf(x), 1); } else { if (!x) l.push((x = { kind: f.k, amount: 0 })); x.amount = +a.toFixed(3); }
        fxCommit(d.e, false, false);
      });
      const up = () => {
        if (!d) return; const x = d; d = null;
        if (!x.moved) { const l = fxList(x.e); if (!x.was) l.push({ kind: f.k, amount: 0.5 }); else return; } // a tap switches it on
        fxCommit(x.e, true, true);
      };
      elm.addEventListener("pointerup", up); elm.addEventListener("pointercancel", up);
      elm.addEventListener("dblclick", () => { const e = ctx.getKit(), l = fxList(e), x = l.find((q) => q.kind === f.k); if (!x) return; l.splice(l.indexOf(x), 1); fxCommit(e, true, false); });
    }

    // ---------------------------------------------------------------- right-click menu on a pad row
    let menu = null;
    function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener("pointerdown", onDocMenu, true); document.removeEventListener("keydown", onKeyMenu, true); } }
    function onDocMenu(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
    function onKeyMenu(e) { if (e.key === "Escape") closeMenu(); }
    function rotate(slot, dir) { const st = S.pads[slot].steps; S.pads[slot].steps = dir < 0 ? [...st.slice(1), st[0]] : [st[st.length - 1], ...st.slice(0, -1)]; }
    function openRowMenu(slot, cx, cy) {
      closeMenu(); closeGenres();
      menu = el("div", "kb-menu");
      const item = (label, fn, arrow) => { const b = el("div", "kb-mi", `<span>${label}</span>${arrow ? "<em>▸</em>" : ""}`); if (fn) b.onclick = () => { closeMenu(); fn(); }; menu.append(b); return b; };
      item("Clear pattern", () => { S.pads[slot].steps = FB.empty(S.bars); changed(slot, true); ctx.say(`${LABEL[slot]} pattern cleared.`); });
      item("Shift left", () => { rotate(slot, -1); changed(slot, true); ctx.say(`${LABEL[slot]} pattern moved one step earlier.`); });
      item("Shift right", () => { rotate(slot, 1); changed(slot, true); ctx.say(`${LABEL[slot]} pattern moved one step later.`); });
      const copy = item("Copy pattern to", null, true), sub = el("div", "kb-menu kb-msub"); copy.append(sub);
      for (const t of SLOTS) { if (t === slot) continue; const b = el("div", "kb-mi", `<span>${LABEL[t]}</span>`); b.onclick = (e) => { e.stopPropagation(); closeMenu(); S.pads[t].steps = S.pads[slot].steps.map((s) => ({ v: s.v, r: s.r })); changed(t, true); ctx.say(`${LABEL[slot]} pattern copied to the ${LABEL[t].toLowerCase()}.`); }; sub.append(b); }
      const rr = root.getBoundingClientRect(); root.append(menu);
      menu.style.left = clamp(cx - rr.left, 0, Math.max(0, rr.width - menu.offsetWidth - 4)) + "px"; menu.style.top = clamp(cy - rr.top, 0, Math.max(0, rr.height - menu.offsetHeight - 4)) + "px";
      setTimeout(() => { document.addEventListener("pointerdown", onDocMenu, true); document.addEventListener("keydown", onKeyMenu, true); }, 0);
    }

    function openHitMenu(slot, i, cx, cy, line) {
      closeMenu(); closeGenres();
      const st = step(slot, i, line); menu = el("div", "kb-menu");
      const item = (label, fn) => { const b = el("div", "kb-mi", `<span>${label}</span>`); b.onclick = () => { closeMenu(); fn(); }; menu.append(b); return b; };
      item("Delete", () => deleteHit(slot, i, line));
      item(st.u ? "Connect to the row" : "Make unique", () => { pick = { slot, i, line: line || 0 }; makeUnique(!st.u); });
      for (const r of [1, 2, 3, 4]) item((r === (st.r || 1) ? "✓ " : "") + (r === 1 ? "One hit" : `Roll ×${r}`), () => { st.r = r; ringChanged(slot, true); });
      const rr = root.getBoundingClientRect(); root.append(menu);
      menu.style.left = clamp(cx - rr.left, 0, Math.max(0, rr.width - menu.offsetWidth - 4)) + "px"; menu.style.top = clamp(cy - rr.top, 0, Math.max(0, rr.height - menu.offsetHeight - 4)) + "px";
      setTimeout(() => { document.addEventListener("pointerdown", onDocMenu, true); document.addEventListener("keydown", onKeyMenu, true); }, 0);
    }

    // ---------------------------------------------------------------- render
    function renderRows() {
      for (const slot of SLOTS) {
        const r = rows[slot], p = S.pads[slot], name = soundName(slot);
        r.el.classList.toggle("kd-sel", sel === slot); r.el.classList.toggle("kd-locked", !!(p.lock.sound || p.lock.pattern));
        r.el.classList.toggle("kd-muted", !name || !audible(slot));
        r.el.querySelector(".kb-mute").classList.toggle("kb-lit", !!p.mute); r.el.querySelector(".kb-solo").classList.toggle("kb-lit", !!p.solo);
        r.snd.textContent = (name || "no sound") + (p.layers > 1 ? "  ×" + p.layers : "");
        r.count.querySelectorAll("i").forEach((i, k) => i.classList.toggle("kd-on", k < (p.layers || 1)));
        if (r.picName !== name + (sel === slot)) { r.picName = name + (sel === slot); drawPic(r.pic, slot, name, sel === slot); }
      }
    }
    function renderDetail() {
      const p = S.pads[sel], name = soundName(sel), kp = (kitE && kitE.kitPad && kitE.kitPad[NOTE_OF[sel]]) || {};
      D.name.textContent = LABEL[sel]; D.snd.textContent = name || "no sound"; D.lock.classList.toggle("kb-lit", !!(p.lock.sound || p.lock.pattern));
      face.querySelector(".kd-facename").textContent = LABEL[sel];
      if (D.picName !== sel + ":" + name) { D.picName = sel + ":" + name; drawPic(face.querySelector("canvas"), sel, name, true); }
      const n = p.layers || 1; D.n.textContent = n; D.arc.setAttribute("stroke-dasharray", `${(113.1 * (n - 1)) / 3} 150.8`);
      for (const b of D.mode.querySelectorAll("button")) b.classList.toggle("kd-on", (p.layerMode || "stack") === b.dataset.mode);
      D.mode.style.visibility = n > 1 ? "" : "hidden";
      D.layers.innerHTML = "";
      const layers = [{ name: name || "no sound", url: kitE && kitE.kit && kitE.kit[NOTE_OF[sel]], gain: 1, main: true }, ...((n > 1 && kp.layers) || [])];
      layers.forEach((L, i) => {
        const row = el("div", "kd-layer", `<canvas></canvas><span>${L.name}</span><div class="kd-lv" style="--v:${Math.round((L.gain || 0.7) * 100)}%"></div>${L.main ? "<em>main</em>" : `<button title="Remove">×</button>`}`);
        row.title = "Click to hear this sound alone";
        row.onclick = (e) => { if (e.target.tagName === "BUTTON") { setLayers(sel, n - 1); return; } try { ctx.hit(sel, 112, L.url); } catch (err) { /* fine */ } flash(sel); };
        D.layers.append(row); drawPic(row.querySelector("canvas"), sel, L.name, !L.main);
      });
      renderPick();
      renderCells();
    }
    // the head, bars and effects follow what is picked: the row, or one hit (connected / unique)
    function renderPick() {
      const st = picked(), mine = st && pick.slot === sel, U = uniq();
      D.scope.hidden = !mine;
      for (const b of D.scope.querySelectorAll("button")) b.classList.toggle("kd-on", (b.dataset.u === "1") === !!(st && st.u));
      const lnW = mine && pick.line ? ` · line ${pick.line + 1}` : "";
      D.what.textContent = !mine ? "Whole row" : U ? `Unique hit · ${posLabel(pick.i, st.o)}${lnW}` : `Hit · ${posLabel(pick.i, st.o)}${lnW} · follows the row`;
      detail.classList.toggle("kb-unique", !!U);
      D.howmany.hidden = !!mine; // a picked hit needs the room (its own step settings show instead)
      D.hitopts.hidden = !mine;
      if (mine) {
        for (const b of D.hitopts.querySelectorAll(".kb-chance button")) b.classList.toggle("kd-on", Math.abs(Number(b.dataset.c) - (st.c != null ? st.c : 1)) < 0.01);
        D.hitopts.querySelector(".kb-glidebtn").classList.toggle("kd-on", !!st.g);
        const np = D.hitopts.querySelector(".kb-notept"), n = ((st.t || 0) + 24) / 48;
        np.style.setProperty("--a", (n >= 0.5 ? 0.5 : n).toFixed(3)); np.style.setProperty("--w", Math.abs(n - 0.5).toFixed(3));
        np.querySelector("b").textContent = (st.t > 0 ? "+" : "") + (st.t || 0) + " st";
      }
      D.fxNote.textContent = U ? "this hit only, on top of the row" : "whole row, unique hits too";
      renderBars(); renderFx();
    }
    // The selected pad's steps as a strip: each hit shows its pitch (808 slides, tuned perc), a top
    // bar for glide and its chance as brightness. Click cycles chance 100/75/50/25%, drag up/down
    // sets the pitch (-24..+24 st), double-click toggles a glide into that note.
    const CHANCES = [1, 0.75, 0.5, 0.25];
    function renderCells() {
      const st = S.pads[sel].steps, box = D.cells; if (!box) return; box.replaceChildren();
      box.style.setProperty("--n", st.length);
      st.forEach((s, i) => {
        const c = el("div", "kb-cell" + (s.v ? " kd-on" : "") + (s.g ? " kb-g" : "") + (i % 4 ? "" : " kb-beat1") + (s.v && s.u ? " kb-u" : "") + (s.v && pick && pick.slot === sel && !pick.line && pick.i === i ? " kb-p" : ""));
        if (s.v) { c.style.setProperty("--ch", s.c != null ? s.c : 1); c.textContent = s.t ? (s.t > 0 ? "+" : "") + s.t : ""; }
        c.title = s.v ? `Step ${i + 1}: ${Math.round((s.c != null ? s.c : 1) * 100)}% chance${s.t ? ", " + (s.t > 0 ? "+" : "") + s.t + " st" : ""}${s.g ? ", glides in" : ""}` : `Step ${i + 1}: empty (add it on the ring)`;
        c.onpointerdown = (e) => {
          if (!s.v) return; e.preventDefault(); c.setPointerCapture(e.pointerId);
          const y0 = e.clientY, t0 = s.t || 0; let moved = false;
          c.onpointermove = (m) => {
            const dt = Math.round((y0 - m.clientY) / 7);
            if (!moved && Math.abs(y0 - m.clientY) < 4) return;
            moved = true; s.t = clamp(t0 + dt, -24, 24) || 0; if (!s.t) delete s.t;
            c.textContent = s.t ? (s.t > 0 ? "+" : "") + s.t : ""; hint(`${LABEL[sel]} step ${i + 1}: ${s.t ? (s.t > 0 ? "+" : "") + s.t + " st" : "no pitch change"}`);
            changed(sel, false);
          };
          c.onpointerup = () => {
            c.onpointermove = c.onpointerup = null;
            if (!moved) { const k = CHANCES.indexOf(s.c != null ? s.c : 1); s.c = CHANCES[(k + 1) % CHANCES.length]; if (s.c >= 1) delete s.c; hint(`${LABEL[sel]} step ${i + 1}: ${Math.round((s.c || 1) * 100)}% chance`); }
            changed(sel, true); c.style.setProperty("--ch", s.c != null ? s.c : 1); // in place: a re-render would break the double-click
          };
        };
        c.ondblclick = () => { if (!s.v) return; s.g = !s.g; if (!s.g) delete s.g; // the double-click's two clicks cycled the chance twice: put it back
          const k = CHANCES.indexOf(s.c != null ? s.c : 1); s.c = CHANCES[(k + 2) % CHANCES.length]; if (s.c >= 1) delete s.c;
          hint(`${LABEL[sel]} step ${i + 1}: ${s.g ? "glides in from the note before" : "no glide"}`); changed(sel, true);
          c.classList.toggle("kb-g", !!s.g); c.style.setProperty("--ch", s.c != null ? s.c : 1); };
        box.append(c);
      });
    }
    function renderBar() {
      genreBtn.querySelector("span").textContent = genreLabel();
      for (const b of rollbar.querySelectorAll(".kb-bars button")) b.classList.toggle("kd-on", Number(b.dataset.bars) === S.bars);
      for (const m of rollbar.querySelectorAll(".kb-mini")) m._show && m._show();
    }
    function renderAll() { syncSubRows(); if (!trk.kick || trk.kick.steps.length !== 16 * S.bars) buildRing(); else for (const s of SLOTS) paintTrack(s); renderRows(); renderDetail(); renderBar(); layoutGrid(); }

    // ---------------------------------------------------------------- transport / playhead
    function nowPos() { const u = typeof ui !== "undefined" ? ui : null, tr = u && u.transport; if (!tr) return null; return { playing: !!tr.playing, pos: (tr.position || 0) + (tr.playing && u.transportAt ? (performance.now() - u.transportAt) / 1000 : 0) }; }
    function tick() {
      if (dead || !shown) { raf = 0; return; }
      raf = requestAnimationFrame(tick);
      const t = nowPos(); let nph = -1;
      if (t && !t.playing && soloOn) soloOn = false; // stopped from somewhere else
      let cAt = null;
      if (t && t.playing) {
        const rel = t.pos - clip.clipStart, loop = (S.bars * 4 * 60) / (clip.bpm || 120);
        if (soloOn && !(S.playAll && S.chain.length > 1)) { let x = rel % loop; if (x < 0) x += loop; nph = x / loop; }
        else if (rel >= 0 && (soloOn || !clip.clipLength || rel < clip.clipLength)) {
          cAt = chainAt(rel);
          if (cAt && cAt.v.id !== S.cur && S.playAll && !drag) openVer(cAt.v.id, true, true); // follow the playhead
          if (cAt && cAt.v.id === S.cur) nph = cAt.ph;
        }
      }
      if (chainPh) { if (cAt) { chainPh.hidden = false; chainPh.style.left = (cAt.at * 100).toFixed(2) + "%"; } else chainPh.hidden = true; }
      if (nph === ph) return;
      ph = nph;
      if (!playhead) return;
      if (gridLay && S.view === "rows" && ph >= 0) { const cw = (gridLay.w - gridLay.x0 - 6) / (16 * S.bars); gph.style.left = (gridLay.x0 + ph * 16 * S.bars * cw) + "px"; gph.hidden = false; } else gph.hidden = true;
      const playing = !!(t && t.playing); playBtn.innerHTML = playing ? ICON.stop : ICON.play; playBtn.classList.toggle("kb-on", playing);
      if (ph < 0) { playhead.style.display = "none"; setNow(-1); return; }
      const [x0, y0] = pt(150, -90 + ph * 360), [x1, y1] = pt(478, -90 + ph * 360);
      playhead.setAttribute("x1", x0); playhead.setAttribute("y1", y0); playhead.setAttribute("x2", x1); playhead.setAttribute("y2", y1); playhead.style.display = "";
      setNow(Math.floor(ph * 16 * S.bars));
    }
    function setNow(k) {
      if (k === phStep) return;
      // only the steps that hit light up white; the playhead line shows the position on its own
      for (const slot of SLOTS) { const t = trk[slot]; if (!t) continue; if (phStep >= 0 && t.steps[phStep]) t.steps[phStep].classList.remove("kd-now"); if (k >= 0 && t.steps[k] && S.pads[slot].steps[k] && S.pads[slot].steps[k].v) { t.steps[k].classList.add("kd-now"); flash(slot); } }
      const was = phStep; phStep = k;
      if (S.view === "rows") for (const slot of SLOTS) if ([S.pads[slot].steps, ...linesOf(slot)].some((st) => (was >= 0 && st[was] && st[was].v) || (k >= 0 && st[k] && st[k].v))) drawRow(slot);
    }

    // ---------------------------------------------------------------- load
    async function load() {
      const r = await B("killDrumBeatGet", { pluginId: pid });
      if (dead) return;
      if (r && r.ok) {
        clip = { clipStart: r.clipStart || 0, clipLength: r.clipLength || 0, beats: r.beats || 4, bpm: r.bpm || 120 };
        const b = r.beat;
        if (b && b.pads) { S.genre = b.genre || S.genre; S.bars = b.bars === 2 ? 2 : 1; S.swing = +b.swing || 0; S.humanize = +b.humanize || 0; S.seed = b.seed || S.seed; if (b.view) S.view = b.view; S.playAll = !!b.playAll;
          for (const s of SLOTS) { const q = b.pads[s] || {}; S.pads[s].lock = { sound: !!(q.lock && q.lock.sound), pattern: !!(q.lock && q.lock.pattern) }; S.pads[s].layers = clamp(q.layers || 1, 1, 4); if (q.layerMode) S.pads[s].layerMode = q.layerMode; S.pads[s].mute = !!q.mute; S.pads[s].solo = !!q.solo; } }
        const multi = b && Array.isArray(b.vers) && b.vers.length && (b.vers.length > 1 || (b.chain || []).length > 1);
        if (b && Array.isArray(b.vers) && b.vers.length) { S.vers = JSON.parse(JSON.stringify(b.vers)); S.cur = b.cur; S.chain = Array.isArray(b.chain) ? b.chain.slice() : []; } else { S.vers = null; }
        ensureVers();
        if (multi) { const v = curV(); S.bars = v.bars || S.bars; }
        let pads = {}; try { pads = multi ? curV().pads || {} : P().fromNotes((r.notes || []).filter((n) => !n.line), { bars: S.bars, noteOf: NOTE_OF }) || {}; } catch (e) { console.error(e); }
        S.lines = copyLines(multi ? curV().lines : b && b.lines, S.bars);
        let any = false; for (const s of SLOTS) {
          const kept = !multi && !audible(s) && b && b.pads && b.pads[s] && Array.isArray(b.pads[s].steps) ? b.pads[s].steps : null;
          S.pads[s].steps = fit(kept || pads[s] || [], S.bars); if (S.pads[s].steps.some((x) => x.v)) any = true;
        }
        if (!any) { let vibe = null; try { vibe = (ctx.kit && ctx.kit().vibe) || (kitE && kitE.kitVibe); } catch (e) { /* none */ } if (!b) S.genre = guessGenre(clip.bpm, vibe); applyPatterns(S.seed); save(true); ctx.say(`Made a ${genreWord()} beat to start. ROLL for another.`); }
      } else if (!loaded) { local = true; applyPatterns(S.seed); }
      ensureVers(); loaded = true; renderAll(); renderVers(); setView(S.view);
    }
    const unKit = ctx.onKitChange ? ctx.onKitChange((e) => { kitE = e; renderRows(); renderDetail(); }) : null;
    buildRing(); renderAll(); load();
    raf = requestAnimationFrame(tick);

    // ---------------------------------------------------------------- vibe steering + window.killDrumBeat (assistant API)
    // The vibe box builds kits from words; when its text changes and names a style, the beat follows
    // (new patterns for unlocked pads, sounds stay). window.killDrumBeat lets the assistant drive this tab.
    const vibeText = (e) => { let v = null; try { v = (e && e.kitVibe) || (ctx.kit && ctx.kit().vibe) || null; } catch (err) { v = null; } return v == null ? "" : typeof v === "string" ? v : JSON.stringify(v); };
    const wordGenre = (t) => { const a = guessGenre(0, t); return a === guessGenre(1000, t) ? a : /\btrap\b/i.test(String(t)) ? "trap" : null; };
    let lastVibe = vibeText(kitE), steering = false, said = "";
    const unVibe = ctx.onKitChange ? ctx.onKitChange((e) => {
      const t = vibeText(e); if (steering || t === lastVibe) return; lastVibe = t;
      if (dead || !loaded) return; const g = wordGenre(t); if (!g) return;
      steering = true;
      try { S.genre = g; S.seed = newSeed(); applyPatterns(S.seed); renderAll(); save(true);
        const kept = SLOTS.filter((s) => S.pads[s].lock.pattern).map((s) => LABEL[s].toLowerCase());
        ctx.say(`${genreLabel()} vibe: new ${genreWord()} patterns${kept.length ? ", " + list(kept) + " kept" : ""}.`); }
      catch (err) { console.error(err); } finally { steering = false; }
    }) : null;
    const say0 = ctx.say;
    ctx.say = function (t) { said = String(t == null ? "" : t); return say0 && say0.apply(this, arguments); };
    const did = (fn) => { said = ""; try { fn(); } catch (err) { console.error(err); return "That didn't work: " + ((err && err.message) || err); } return said; };
    const slotOf = (x) => { const t = String(x == null ? "" : x).toLowerCase().trim().replace(/[\s-]+/g, "_"); if (SLOTS.includes(t)) return t;
      if (/open/.test(t)) return "hat_open"; if (/hat|hh/.test(t)) return "hat_closed"; if (/bass|sub/.test(t)) return "808"; if (/effect/.test(t)) return "fx"; if (/tex|atmos|noise/.test(t)) return "texture";
      return SLOTS.find((s) => t.includes(s) || s.includes(t) && t.length > 2) || null; };
    const api = {
      pads: SLOTS.slice(),
      alive: () => !dead,
      style: () => S.genre, // the current style id (genre(id) sets it)
      roll(what = "all", slot) {
        const s = slot != null && slot !== "" ? slotOf(slot) : null; if (slot != null && slot !== "" && !s) return `No pad called ${slot}.`;
        const w = String(what || "all").toLowerCase(), snd = !/pattern/.test(w), pat = !/sound/.test(w);
        return did(() => (s ? rollOne(s, snd, pat) : rollAll(snd, pat)));
      },
      lock(slot, on = true) {
        const s = slotOf(slot); if (!s) return `No pad called ${slot}.`;
        const l = S.pads[s].lock; if (!!(l.sound && l.pattern) === !!on) return `${LABEL[s]} is already ${on ? "locked" : "unlocked"}.`;
        return did(() => toggleLock(s));
      },
      genre(id) {
        const k = String(id == null ? "" : id).toLowerCase().trim(), g = genres().find((x) => x.id === k || x.label.toLowerCase() === k) || (k && genres().find((x) => x.id === wordGenre(k)));
        if (!g) return `No style called ${id}. Styles: ${genres().map((x) => x.id).join(", ")}.`;
        return did(() => setGenre(g.id));
      },
      steps(n) { const bars = Number(n) >= 32 ? 2 : 1; if (S.bars === bars) return `Already ${16 * bars} steps.`; return did(() => setBars(bars)); },
      swing(v) { S.swing = clamp(Number(v) || 0, 0, 60) / 100; renderBar(); save(true); return `Swing ${Math.round(S.swing * 100)}%.`; },
      humanize(v) { S.humanize = clamp(Number(v) || 0, 0, 100) / 100; renderBar(); save(true); return `Humanise ${Math.round(S.humanize * 100)}%.`; },
      howMany(slot, n, mode) {
        const s = slotOf(slot); if (!s) return `No pad called ${slot}.`;
        const m = /turn|cycle|alt/i.test(mode || "") ? "turns" : /stack|mix|together|layer/i.test(mode || "") ? "stack" : null;
        const was = S.pads[s].layers || 1, want = clamp(Math.round(Number(n) || was), 1, 4);
        if (m) S.pads[s].layerMode = m;
        let out = want !== was ? did(() => setLayers(s, want)) : "";
        if (m && want === was) out = did(() => setMode(s, m));
        return out || `${LABEL[s]} already has ${want} sound${want > 1 ? "s" : ""}.`;
      },
      describe() {
        const locked = SLOTS.filter((s) => S.pads[s].lock.sound || S.pads[s].lock.pattern).map((s) => LABEL[s].toLowerCase());
        const layered = SLOTS.filter((s) => (S.pads[s].layers || 1) > 1).map((s) => `${S.pads[s].layers} ${LABEL[s].toLowerCase()}s ${S.pads[s].layerMode === "turns" ? "taking turns" : "mixed"}`);
        return `${genreLabel()} beat, ${16 * S.bars} steps, swing ${Math.round((S.swing || 0) * 100)}%, human ${Math.round((S.humanize || 0) * 100)}%. ${locked.length ? "Locked: " + list(locked) + "." : "Nothing locked."}${layered.length ? " Layered: " + list(layered) + "." : ""}`;
      },
    };
    window.killDrumBeat = api;
    // destroy() (below) calls closeGenres() with dead set: that is where this block lets go.
    const closeGenres0 = closeGenres;
    closeGenres = function () { closeGenres0(); if (dead) { if (window.killDrumBeat === api) window.killDrumBeat = null; if (unVibe) unVibe(); if (ctx.say !== say0 && say0) ctx.say = say0; } };

    return {
      show() { shown = true; load(); if (!raf) raf = requestAnimationFrame(tick); },
      hide() { shown = false; closeGenres(); closeSaved(); if (raf) cancelAnimationFrame(raf); raf = 0; },
      kitChanged(e) { kitE = e; renderRows(); renderDetail(); },
      // undo/redo changed the lane: read the beat (the clip's notes + kitBeat) again
      reload() { if (!dead && !saveT) load(); },
      destroy() { closeSaved(); if (ctx.saveBeat) ctx.saveBeat = null; if (soloOn) B("killDrumSolo", { pluginId: pid, on: false }); dead = true; shown = false; closeGenres(); closeMenu(); document.removeEventListener("keydown", onKey, true); if (raf) cancelAnimationFrame(raf); clearTimeout(saveT); if (unKit) unKit(); if (ro) ro.disconnect(); },
    };
  }

  window.KillDrumTabs = window.KillDrumTabs || [];
  window.KillDrumTabs.push({ id: "beat", label: "Beat", order: -1, mount });
  window.KillDrumBeat = { mount, FB, COLOR, NOTE_OF };
})();
