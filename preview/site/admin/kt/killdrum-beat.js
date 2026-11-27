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
  // RHYTHM list sound toggle (Eman, 14 Nov): OFF (default) = previews click on the metronome sounds, ON = they loop
  // on this KILLDRUM's own sounds. Remembered while the page is open. KD_RW_REAL_OLD = old (always the real sounds).
  let rwReal = false;
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
    // off-grid: three grid ticks along the floor, the hits land between them
    off: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="13" width="1.6" height="2"/><rect x="7.2" y="13" width="1.6" height="2"/><rect x="12.9" y="13" width="1.6" height="2"/><rect x="4" y="3" width="2.4" height="8.5" rx="0.8"/><rect x="9.6" y="6" width="2.4" height="5.5" rx="0.8"/></svg>',
    // MIDI: three notes stepping up a little piano roll (the row's MIDI editor, 14 Nov)
    midi: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="10.5" width="5" height="2.6"/><rect x="5.8" y="6.7" width="4.4" height="2.6"/><rect x="9.5" y="2.9" width="5" height="2.6"/><rect x="1.5" y="14.2" width="13" height="0.9"/></svg>',
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
  const RB = () => (typeof window !== "undefined" && window.KillDrumRhythms) || null;   // the rhythm brain (ui/killdrum-rhythms.js)
  const FV = () => (typeof window !== "undefined" && window.KillDrumFavs) || null;      // Eman's favorite songs' exact patterns (ui/killdrum-favs.js)

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const svgEl = (tag, attrs) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const padDefaults = () => ({ tune: 0, decay: 1, drive: 0, cutoff: 1, pan: 0, fx: [] });
  const list = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  const fresh = () => ({ v: 1, genre: "trap", bars: 1, swing: 0, humanize: 0, xp: 0, cx: 0.5, sub808: "auto", rhythm: null, rhythmLock: false, rhythmHist: [], seed: newSeed(),
    pads: Object.fromEntries(SLOTS.map((s) => [s, { steps: FB.empty(1), lock: { sound: false, pattern: false }, layers: 1, layerMode: /^hat|perc/.test(s) ? "turns" : "stack" }])) });
  // a beat is 1, 2, 4 or 8 bars (16 / 32 / 64 / 128 steps); 4 and 8 came with "as long as the MIDI" (Zed call, 7 Nov).
  // KD_BARS_TWO_MAX = true: the old 16 | 32 only.
  const BAR_SIZES = () => (window.KD_BARS_TWO_MAX ? [1, 2] : [1, 2, 4, 8]);
  const normBars = (b) => (BAR_SIZES().includes(Number(b)) ? Number(b) : 1);
  function fit(steps, bars) { const n = 16 * bars, out = []; const src = steps && steps.length ? steps : FB.empty(1); for (let i = 0; i < n; i++) { const s = src[i % src.length]; const o = { v: s && s.v ? s.v : 0, r: s && s.r ? s.r : 1 }; if (o.v && s) { if (s.c != null && s.c < 1) o.c = s.c; if (s.t) o.t = s.t; if (s.g) o.g = true; if (s.o) o.o = s.o; if (s.u) o.u = JSON.parse(JSON.stringify(s.u)); if (s.l) o.l = s.l; if (s.bend) o.bend = s.bend.map((q) => q.slice()); if (s.wob) o.wob = { ...s.wob }; if (s.ft) o.ft = s.ft; } out.push(o); } return out; }
  // OFF-GRID (Eman, recorder V5q, 7 Nov): a pad row with its off-grid button on gets hits between the steps when
  // its pattern is rolled, the way a Cmd-drag places them (1/32 and triplets; s.o = how far into the step).
  // Some hits slide late or early, a few soft in-between ghost hits join. Seeded: the same roll gives the same feel.
  // Kick / 808 / snare / clap keep most hits that sit on a beat. KD_OFFGRID_OFF = true: no button, rolls stay on the grid.
  const OG_FINE = [1 / 3, 1 / 2, 2 / 3].map((x) => Math.round(x * 1000) / 1000);
  function offGrid(steps, slot, seed) {
    const R = rng(seed + ":offgrid:" + slot), n = steps.length, out = steps.map((x) => (x && x.v ? { ...x } : { v: 0, r: 1 }));
    const core = /^(kick|808|snare|clap)$/.test(slot), busy = out.filter((x) => x.v).length > n / 3;
    const amt = core ? 0.4 : busy ? 0.3 : 0.45, pick = () => OG_FINE[Math.floor(R() * OG_FINE.length)];
    let moved = 0; const cand = [];
    for (let i = 0; i < n; i++) {
      const st = out[i]; if (!st.v || st.o) continue;
      const anchor = i % 4 === 0 && (core || i % 8 === 0);
      if (anchor && R() < 0.85) continue;
      cand.push(i);
      if (R() >= amt) continue;
      // early: the hit jumps into the step before (lands just ahead of its beat); late: it slides into its own step
      if (i > 0 && !out[i - 1].v && R() < 0.4) { out[i - 1] = { ...st, o: R() < 0.5 ? 0.667 : 0.5 }; out[i] = { v: 0, r: 1 }; }
      else st.o = pick();
      moved++;
    }
    // at least one hit always leaves the grid (an all-on-the-beat row moves one of its later hits)
    if (!moved) { const any = out.map((x, i) => (x.v && !x.o && i > 0 ? i : -1)).filter((i) => i >= 0), from = cand.length ? cand : any;
      if (from.length) { const i = from[Math.floor(R() * from.length)]; out[i].o = pick(); moved++; } }
    // soft ghost hits in the gaps right after a hit (not on the 808: its notes ring long)
    if (slot !== "808") {
      const want = Math.max(1, Math.round(n / 16 * (core ? 0.75 : 1.5)));
      for (let tries = 0, added = 0; tries < n * 2 && added < want; tries++) {
        const j = Math.floor(R() * n), prev = out[(j - 1 + n) % n];
        if (out[j].v || !prev.v) continue;
        out[j] = { v: Math.max(30, Math.round((prev.v || 100) * (0.45 + R() * 0.25))), r: 1, o: R() < 0.5 ? 0.5 : 0.333 }; added++;
      }
    }
    return out;
  }
  const ogOn = (p) => !!(p && p.offgrid) && !window.KD_OFFGRID_OFF;
  function guessGenre(bpm, vibe) {
    const t = String(vibe == null ? "" : typeof vibe === "string" ? vibe : JSON.stringify(vibe)).toLowerCase();
    if (!window.KD_GENRES_OLD && t) { const W = [["evilrage", /evil ?rage/], ["opium", /opium/], ["driftphonk", /drift ?phonk/], ["sampledrill", /sample ?drill/], ["hardtechno", /hard ?techno/], ["basshouse", /bass ?house/], ["pluggnb", /plugg ?n ?b/], ["plugg", /\bplugg\b/], ["phonk", /phonk/], ["memphis", /memphis/], ["horrorcore", /horrorcore/], ["detroit", /detroit/], ["riddim", /riddim/], ["dubstep", /dubstep/], ["darkwave", /darkwave/], ["hyperpop", /hyperpop/], ["digicore", /digicore/], ["glitchcore", /glitchcore/], ["cloudrap", /cloud ?rap/], ["bmore", /baltimore|b-?more/], ["footwork", /footwork|juke/], ["jerk", /\bjerk/], ["baile", /baile/], ["reggaeton", /reggaeton|perreo/], ["dembow", /dembow/], ["afrobeats", /afrobeat/], ["amapiano", /amapiano/], ["rnb", /r ?(&|n|and) ?b\b/], ["ukg", /uk ?garage|speed garage/], ["twostep", /2-? ?step|two ?step/], ["jungle", /jungle/], ["breakbeat", /breakbeat|big beat/], ["gfunk", /g-? ?funk|west coast/], ["darksynth", /darksynth/], ["vaporwave", /vaporwave/], ["italo", /italo/], ["synthwave", /synthwave|outrun/]];
      for (const [id, re] of W) if (re.test(t) && genres().some((x) => x.id === id)) return id; }
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
    let pgG = null;   // PG MATCH: the groove heard under this beat for the roll in progress (KT2PGMatch.grooveFor)
    let S = fresh(), clip = { clipStart: 0, clipLength: 0, beats: 4, bpm: 140 }, kitE = ctx.getKit ? ctx.getKit() : { kit: {}, kitName: {}, kitPad: {} };
    let sel = (ctx.selected && ctx.selected()) || "kick", dead = false, shown = true, loaded = false, local = false;
    let ph = -1, phStep = -1, raf = 0, saveT = 0, saveUndo = false;
    let mr = null, mrRaf = 0; // the row's MIDI editor, when open
    // RHYTHM preview (Eman, 14 Nov): a pressed rhythm only PLAYS (light blue grid) until COMMIT; null = not previewing
    let pv = null; const PVCOL = "#7FD4FF";
    // OFF-GRID is one switch by ROLL for the whole beat (Eman, 14 Nov); KD_ROWMIDI_OFF = the old button per pad row
    // COMPLEXITY knob (Eman, 15 Nov): S.cx 0 = SIMPLE (2-3 rows), 0.5 = MID, 1 = CRAZY (up to 16 rows, off-grid, ratchets)
    const cxOn = () => !window.KD_CX_OFF;
    // LENGTH = THE CLIP (Eman, 15 Nov): no 16/32/64/128 buttons; the beat is as long as its clip in the playground (drag the
    // clip out there, no limit). A clip of 16 bars or more rolls like a song (P().arrange: intro, verse, hook, break...).
    // With more than one BAR in the ORDER the old buttons come back (each BAR keeps its own length). KD_LEN_SEL = old.
    const lenFollow = () => !window.KD_LEN_SEL && !(Array.isArray(S.vers) && S.vers.length > 1) && !(Array.isArray(S.chain) && S.chain.length > 1);
    const clipBars = () => Math.max(1, Math.min(512, Math.round((clip.beats || 4 * S.bars) / 4)));
    const barsIn = (b) => (lenFollow() && clip.clipLength ? clipBars() : normBars(b));
    const SONG_MIN = 16;
    const songOn = () => lenFollow() && !window.KD_SONG_OFF && S.bars >= SONG_MIN && !!P().arrange;
    const effXp = () => (cxOn() && S.cx > 0.6 ? Math.max(S.xp || 0, Math.min(1, (S.cx - 0.6) / 0.4)) : S.xp || 0);
    const ogOn = (p) => (window.KD_OFFGRID_OFF ? false : window.KD_ROWMIDI_OFF ? !!(p && p.offgrid) : !!S.offgrid);

    // ---------------------------------------------------------------- DOM
    pane.innerHTML = "";
    const root = el("div", "kd-beat");
    const plist = el("div", "kd-plist");
    plist.append(el("div", "kd-plist-h", `<button class="kb-genre" title="Style of the beat: pick one and the unlocked patterns change"><span></span> ▾</button><button class="kb-savedbtn" title="Your presets: save this beat, load a pattern, sounds or both, point at one to hear it">Presets</button>`));
    // RHYTHMS (Eman, 8 Nov): the rhythm this beat is in (every roll lands in one), click = the RHYTHMS tab. KD_RHYTHM_OFF = the old rolls.
    const rhythmBtn = el("button", "kb-rhythm", `<i>${ICON.lock}</i><span></span><em></em>`); rhythmBtn.title = "The rhythm this beat is in. Click: all the rhythms, press one to move the beat into it (sounds stay), lock it so every roll keeps it";
    rhythmBtn.hidden = !RB() || !!window.KD_RHYTHM_OFF || !window.KD_PANEL_OLD;   // the pad panel's RHYTHM widget took over (KD_PANEL_OLD = back)
    plist.append(rhythmBtn);
    rhythmBtn.onclick = (e) => { e.stopPropagation(); closeGenres(); closeSaved(); if (ctx.showTab) ctx.showTab("rhythms"); };
    const rows = {};
    for (const slot of SLOTS) {
      const r = el("div", "kd-prow"); r.dataset.slot = slot; r.style.setProperty("--c", COLOR[slot]);
      r.innerHTML = `<div class="kd-ppic"><canvas></canvas></div><div class="kd-pmeta"><div class="kd-pname">${LABEL[slot]}</div><div class="kd-psnd">—</div></div>
        <div class="kd-pbtns"><div class="kd-pcount" title="How many sounds on this pad (drag up/down)"><i></i><i></i><i></i><i></i></div>
        <button class="kd-ibtn kd-rollsnd" title="New sound for this pad">${ICON.dice}</button><button class="kd-ibtn kd-rollpat" title="New pattern for this pad">${ICON.pat}</button>
        <button class="kd-ibtn kd-lock" title="Lock: ROLL skips this pad (its own dice still work)">${ICON.lock}</button>
        ${!window.KD_ROWMIDI_OFF ? `<button class="kd-ibtn kb-midi" title="MIDI: edit this pad's notes">${ICON.midi}</button>` : window.KD_OFFGRID_OFF ? "" : `<button class="kd-ibtn kb-og" title="Off-grid: when on, this pad's pattern dice also puts hits between the steps">${ICON.off}</button>`}
        <button class="kd-ibtn kb-mute" title="Mute this pad (its pattern is kept)">M</button><button class="kd-ibtn kb-solo" title="Solo: only the soloed pads play">S</button></div>`;
      plist.append(r);
      rows[slot] = { el: r, pic: r.querySelector("canvas"), snd: r.querySelector(".kd-psnd"), count: r.querySelector(".kd-pcount"), lock: r.querySelector(".kd-lock") };
      r.addEventListener("click", (e) => { if (e.target.closest(".kd-pbtns")) return; select(slot); hit(slot); });
      r.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); openRowMenu(slot, e.clientX, e.clientY); });
      r.querySelector(".kd-rollsnd").onclick = (e) => { e.stopPropagation(); rollOne(slot, true, false); };
      r.querySelector(".kd-rollpat").onclick = (e) => { e.stopPropagation(); rollOne(slot, false, true); };
      rows[slot].lock.onclick = (e) => { e.stopPropagation(); toggleLock(slot); };
      const og = r.querySelector(".kb-og"); if (og) og.onclick = (e) => { e.stopPropagation(); setOffGrid(slot, !S.pads[slot].offgrid); };
      const mb = r.querySelector(".kb-midi"); if (mb) mb.onclick = (e) => { e.stopPropagation(); mrToggle(slot); };
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
      <button class="kd-roll" title="New sounds and patterns for every unlocked pad">${ICON.dice} Roll</button>${!window.KD_CX_OFF ? `<div class="kb-cx" title="Complexity: drag up/down. Yellow = SIMPLE (2-3 rows), MID in between, red = CRAZY (up to 16 rows). Click jumps SIMPLE / MID / CRAZY, double-click = MID"><svg viewBox="0 0 44 44"><circle class="kb-cx0" cx="22" cy="22" r="18" fill="none" stroke-width="4"/><circle class="kb-cx1" cx="22" cy="22" r="18" fill="none" stroke-width="4" stroke-linecap="round" transform="rotate(135 22 22)"/></svg><b></b></div>` : ""}${!window.KD_ROWMIDI_OFF && !window.KD_OFFGRID_OFF ? `<button class="kd-roll2 kb-ogall" title="Off-grid: ROLL and the pattern dice also put hits between the steps">${ICON.off}</button>` : ""}
      ${window.KT2PGMatch && !KT2PGMatch.off() ? `<button class="kd-pgm kb-pgm${KT2PGMatch.solo && KT2PGMatch.solo() ? " is-dot" : ""}${KT2PGMatch.isOn("killdrum") ? " on" : ""}" role="switch" aria-checked="${KT2PGMatch.isOn("killdrum")}" title="${KT2PGMatch.LABEL}: ROLL follows the vocals / samples over this beat">${KT2PGMatch.solo && KT2PGMatch.solo() ? '<i class="pgm-dot"></i>' : ""}${KT2PGMatch.LABEL}</button>` : ""}
      ${window.KT2CustomData && window.KT2_KD_CDATA_OLD ? KT2CustomData.html("killdrum", "kb-cdata") : ""}
      <button class="kd-roll2 kb-sounds" title="New sounds only (unlocked pads)">${ICON.dice}<span>Sounds only</span></button>
      <button class="kd-roll2 kb-patterns" title="New patterns only (unlocked pads)">${ICON.pat}<span>Pattern only</span></button>
      <div class="kd-seg kb-bars" title="Steps: how many bars the beat runs before it repeats">${BAR_SIZES().map((b) => `<button data-bars="${b}">${16 * b}</button>`).join("")}</div>
      <div class="kd-seg kb-pages" title="Which bars the rows show" hidden></div>
      <div class="kd-mini kb-mini" data-k="swing" title="Swing: drag up/down, double-click resets"><span class="kd-label">Swing</span><b>0%</b></div>
      <div class="kd-mini kb-mini" data-k="humanize" title="Humanise: loose timing and hits, drag up/down"><span class="kd-label">Human</span><b>0%</b></div>
      <div class="kd-mini kb-mini kb-xp" data-k="xp" title="Experimental: how far a roll strays from its rhythm. Low = the rhythm's skeleton, middle = how real songs play it, high = two rhythms mixed, max = glitch"><span class="kd-label">Exp</span><b>0%</b></div>${!window.KD_CX_OFF ? `<button class="kb-sub" title="808: AUTO = the style decides (trap, drill and rage always, house or crystal sometimes, techno and lo-fi rarely), ON = every roll has one, OFF = never. Click to switch"><span class="kd-label">808</span><b>Auto</b></button>` : ""}`;
    const grid = el("div", "kb-grid");
    const viewBtn = el("button", "kd-ibtn kb-view");
    const versEl = el("div", "kb-vers");
    stage.append(circle, grid, viewBtn, versEl, rollbar);
    const detail = el("div", "kd-detail");
    const PNEW = !window.KD_PANEL_OLD, PV2 = PNEW && !!window.KD_PANEL_V2;
    const KN_C = 2 * Math.PI * 13, KN_A = KN_C * 0.75;   // the small dials: r 13 in a 34 box, 270 degrees
    // (Eman, 27 Oct: the big picture made room for effects.) Head: the pad's name, or the picked hit with CONNECTED / MAKE UNIQUE.
    detail.innerHTML = `<div class="kb-dhead"><div class="kb-dtitle"><div class="kd-dname"></div><div class="kb-dwhat"></div></div><div class="kd-dbtns"><button class="kd-ibtn kb-dsnd" title="New sound (also puts this pad's unique hits back to normal)">${ICON.dice}</button><button class="kd-ibtn kb-dpat" title="New pattern">${ICON.pat}</button><button class="kd-ibtn kd-lock kb-dlock" title="Lock this pad">${ICON.lock}</button></div></div>
      <div class="kd-seg kb-scope" hidden><button data-u="0" title="This hit follows its row: the panel changes the whole row">Connected</button><button data-u="1" title="This hit gets its own settings and effects, on top of the row's">Make unique</button></div>
      <div class="kd-dsound"><button class="kd-ibtn kb-prev" title="Previous sound">‹</button><span>—</span><button class="kd-ibtn kb-next" title="Next sound">›</button><button class="kd-small kb-browse" title="All the sounds for this pad, search, and its effect chips (reverb, delay, clip, crush, drive)">Sounds</button></div>
      <div class="kd-howmany"><div class="kd-dial" title="How many sounds on this pad: drag up/down or click"><svg viewBox="0 0 58 58"><circle class="kd-arc0" cx="29" cy="29" r="24" fill="none" stroke-width="3" stroke-dasharray="113.1 150.8" transform="rotate(135 29 29)"/><circle class="kd-arc1" cx="29" cy="29" r="24" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="0 150.8" transform="rotate(135 29 29)"/></svg><div class="kd-dial-n">1</div></div>
      <div class="kd-label">How many</div><div class="kd-seg kb-mode"><button data-mode="stack" title="All the sounds play together">Stack</button><button data-mode="turns" title="The sounds take turns, hit by hit">Cycle</button></div>
      <div class="kd-layers"></div></div><div class="kd-bars"></div><div class="kb-fx"><div class="kd-label">Effects <em></em></div><div class="kb-fxlist"></div></div><div class="kb-hitopts" hidden><div class="kd-label">This hit</div><div class="kb-hitrow"><div class="kd-seg kb-chance" title="How often this hit plays"><button data-c="1">100%</button><button data-c="0.75">75%</button><button data-c="0.5">50%</button><button data-c="0.25">25%</button></div><button class="kd-small kb-glidebtn" title="The 808 glides into this note from the one before">Glide</button></div><div class="kd-bar kd-mid kb-notept" title="Note: this hit's pitch in semitones (808 lines). Drag left/right, double-click resets"><span>Note</span><b>0 st</b></div></div>
      <div class="kb-chain"${window.KT2_KD_ORDER_SHOW ? "" : " hidden"}><div class="kd-label">Order <em>what FULL plays, left to right</em></div><div class="kb-chainbox"></div></div><div class="kb-hint"></div>`;
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
    // LAYERS (Eman 14 Nov): the whole panel in the dial's height: one small volume knob per sound,
    // + adds one, x takes that one away, STACK/CYCLE in the head. The six sliders are small dials and a
    // RHYTHM widget sits in the room they freed. KD_PANEL_OLD = the old panel (dial + rows + slider bars).
    const LNEW = PNEW, LV2 = PV2;
    if (LNEW) {
      D.howmany.className = "kd-howmany kd-lnew" + (LV2 ? " kd-lv2" : "");
      D.howmany.innerHTML = `<div class="kd-lhead"><div class="kd-label">Layers</div>${LV2 ? `<button class="kd-lmode" title="Stack: all play together. Cycle: they take turns, hit by hit"></button>` : `<div class="kd-seg kb-mode"><button data-mode="stack" title="All the sounds play together">Stack</button><button data-mode="turns" title="The sounds take turns, hit by hit">Cycle</button></div>`}</div><div class="kd-lrow"></div>`;
      D.mode = D.howmany.querySelector(".kb-mode") || D.howmany.querySelector(".kd-lmode"); D.layers = D.howmany.querySelector(".kd-lrow"); D.dial = null;
      if (LV2) D.mode.onclick = () => setMode(sel, (S.pads[sel].layerMode || "stack") === "turns" ? "stack" : "turns");
    }
    if (!LV2) for (const b of D.mode.querySelectorAll("button")) b.onclick = () => setMode(sel, b.dataset.mode);
    if (D.dial) bindDial(D.dial);
    // RHYTHM widget (Eman 14 Nov): the beat's rhythm as a mini card. AUTO (default) = every roll picks
    // one; press = a clean list, pressing a rhythm plays it with the metronome-style clicks and puts the
    // beat in it (AUTO at the top gives it back to the dice). The lock = this pad's pattern stays on dice.
    let rwPop = null;
    const RW = PNEW && RB() && !window.KD_RHYTHM_OFF ? el("div", "kd-rw" + (PV2 ? " kd-rw2" : "")) : null;
    if (RW) {
      RW.innerHTML = `<button class="kd-rwcard" title="Rhythm: AUTO lets the dice pick, press to choose one"><div class="kd-rwtop"><span class="kd-rwname"></span><em></em><i class="kd-rwcar">\u25BE</i></div><div class="kd-rwdots kr-dots"></div></button><button class="kd-ibtn kd-rwlock" title="Lock this pad's pattern: the dice leaves it alone">${ICON.lock}</button>`;
      if (PV2) detail.insertBefore(RW, D.howmany); else detail.insertBefore(RW, D.bars);
      RW.querySelector(".kd-rwcard").onclick = (e) => { e.stopPropagation(); rwPop ? closeRw() : openRw(); };
      RW.querySelector(".kd-rwlock").onclick = () => togglePatLock(sel);
    }
    function togglePatLock(slot) {
      const l = S.pads[slot].lock; l.pattern = !l.pattern; renderRows(); renderDetail(); save(true);
      ctx.say(l.pattern ? `${LABEL[slot]} pattern locked: the dice keeps it.` : `${LABEL[slot]} pattern unlocked.`);
    }
    function renderRw() {
      if (!RW) return; const K = RB(), r = S.rhythm && K ? K.byId(S.rhythm) : null, auto = !S.rhythmLock;
      RW.querySelector(".kd-rwname").textContent = auto ? "Auto" : r ? r.name : "Auto";
      RW.querySelector("em").textContent = auto && r ? r.name : "";
      RW.querySelector(".kd-rwdots").innerHTML = r && window.KillDrumRhythmsTab ? window.KillDrumRhythmsTab.dots(r) : "";
      RW.classList.toggle("kd-auto", auto);
      const pl = S.pads[sel].lock.pattern; RW.querySelector(".kd-rwlock").classList.toggle("kb-lit", !!pl);
    }
    // ---- preview / COMMIT / HISTORY (Eman, 14 Nov). Pressing a rhythm plays it right away with the real KILLDRUM
    // sounds (SOLO loop, nothing saved) and paints the grid light blue. COMMIT keeps it (one undo step) and adds it to
    // the HISTORY (saved in the beat = with the project, the starting pattern too). Closing the list without COMMIT
    // puts the old pattern back. KD_RW_COMMIT_OFF = the old list (press = commit at once + metronome clicks).
    const RWC = () => !window.KD_RW_COMMIT_OFF;
    // GENRE LINK (Eman, 15 Nov): the genre picker sets the vibe; the rhythm list opens with that genre's rhythms
    // (own section at the top) and AUTO plays them. KD_GENRE_LINK_OFF = the old list and AUTO (any rhythm, any favorite)
    const ICON_EAR = '<svg viewBox="0 0 16 16" fill="currentColor"><rect class="kd-eq1" x="2" y="6" width="2" height="4" rx="1"/><rect class="kd-eq2" x="5.5" y="3" width="2" height="10" rx="1"/><rect class="kd-eq3" x="9" y="5" width="2" height="6" rx="1"/><rect class="kd-eq4" x="12.5" y="7" width="2" height="2" rx="1"/></svg>';
    const ICON_HIST = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8"/><path d="M2.4 2.2v2.6h2.6"/><path d="M8 5v3.2l2.2 1.4"/></svg>';
    const snapNow = () => ({ bars: S.bars, swing: S.swing, seed: S.seed, rhythm: S.rhythm, rhythmLock: S.rhythmLock, rhythmMix: S.rhythmMix, rhythmGlitch: S.rhythmGlitch,
      pads: copySteps(Object.fromEntries(SLOTS.map((x) => [x, S.pads[x].steps]))), lines: JSON.parse(JSON.stringify(S.lines || {})) });
    function putSnap(sn) {
      S.bars = sn.bars; S.swing = sn.swing; S.seed = sn.seed; S.rhythm = sn.rhythm; S.rhythmLock = sn.rhythmLock; S.rhythmMix = sn.rhythmMix; S.rhythmGlitch = sn.rhythmGlitch;
      for (const x of SLOTS) S.pads[x].steps = fit(JSON.parse(JSON.stringify(sn.pads[x] || [])), S.bars);
      S.lines = copyLines(sn.lines, S.bars);
    }
    // a history entry keeps only the hits, so a long project stays small
    function histEntry(name, from) {
      const src = from || { bars: S.bars, swing: S.swing, rhythm: S.rhythm, pads: Object.fromEntries(SLOTS.map((x) => [x, S.pads[x].steps])) };
      const hits = {}; for (const x of SLOTS) { const a = []; (src.pads[x] || []).forEach((st, i) => { if (st && st.v) a.push([i, JSON.parse(JSON.stringify(st))]); }); if (a.length) hits[x] = a; }
      return { t: Date.now(), name: name || rhythmName(src.rhythm) || "Pattern", rhythm: src.rhythm || null, bars: src.bars, swing: src.swing || 0, hits };
    }
    const histKey = (h) => JSON.stringify([h.bars, h.swing, h.hits]);
    function pushHist(h) {
      if (!Array.isArray(S.rhythmHist)) S.rhythmHist = [];
      const last = S.rhythmHist[S.rhythmHist.length - 1]; if (last && histKey(last) === histKey(h)) return;
      S.rhythmHist.push(h); if (S.rhythmHist.length > 40) S.rhythmHist.splice(0, S.rhythmHist.length - 40);
    }
    function putHist(h) {
      S.bars = barsIn(h.bars); S.swing = +h.swing || 0; S.rhythm = h.rhythm && RB() && RB().byId(h.rhythm) ? h.rhythm : S.rhythm; S.rhythmMix = null; S.rhythmGlitch = false;
      for (const x of SLOTS) { const st = FB.empty(S.bars).map(() => ({ v: 0, r: 1 })); for (const [i, q] of (h.hits && h.hits[x]) || []) if (i < st.length) st[i] = JSON.parse(JSON.stringify(q)); S.pads[x].steps = fit(st, S.bars); }
      S.lines = copyLines(S.lines, S.bars);
    }
    const curKey = () => histKey(histEntry(""));
    function histDots(h) {
      const per = 16, row = (xs) => { let o = ""; for (let i = 0; i < per; i++) { const on = xs.some((x) => ((h.hits && h.hits[x]) || []).some(([k]) => k === i)); o += `<i class="${on ? "kr-big" : "kr-off"}${i % 4 === 0 ? " kr-beat" : ""}"></i>`; } return o; };
      return `<div class="kr-row kr-k">${row(["kick", "808"])}</div><div class="kr-row kr-s">${row(["snare", "clap"])}</div><div class="kr-row kr-h">${row(["hat_closed", "hat_open"])}</div>`;
    }
    const tr0 = () => (typeof ui !== "undefined" && ui.transport) || null;
    const REAL_OLD = () => !!window.KD_RW_REAL_OLD;
    const realOn = () => REAL_OLD() || rwReal;
    // the previewed pattern as a metronome-click rhythm (KillDrumPreview): kick/808 = low blips, snare/clap = high, hats = tick
    function clickRhythm() {
      const n = 16 * S.bars, row = (xs) => { let o = ""; for (let i = 0; i < n; i++) { let v = 0; for (const x of xs) { const st = S.pads[x] && S.pads[x].steps[i]; if (st && st.v > v) v = st.v; } o += v >= 96 ? "X" : v > 0 ? "x" : "-"; } return o; };
      const bpm = (typeof ui !== "undefined" && ui.state && +ui.state.bpm) || clip.bpm || 120;
      return { id: "pv:" + (pv ? pv.label : ""), grid: 16, bars: S.bars, bpm: [bpm, bpm], k: row(["kick"]), b: row(["808"]), s: row(["snare", "clap"]), h: row(["hat_closed", "hat_open"]), p: row(["perc"]) };
    }
    function clickStop() { const P = window.KillDrumPreview; try { if (P && P.playing()) P.stop(); } catch (e) { /* fine */ } }
    async function pvClick() {
      const P = window.KillDrumPreview; if (!P || !pv) return;
      if (soloOn) await pvSilence();
      const t = tr0(); if (t && t.playing && typeof run === "function") await run("togglePlay");   // clicks stop when the song plays
      let tile = pv.tile && pv.tile.isConnected ? pv.tile : rwPop && rwPop.querySelector(".kd-rwrow.kd-pvon");
      if (!tile) tile = RW;
      pv.tile = tile; P.stop();
      if (P.play(clickRhythm(), tile, () => { tile.classList.remove("kr-play"); P._clear(); })) tile.classList.add("kr-play");
      paintRwHead();
    }
    function pvPlay() { if (!pv) return; pv.muted = false; if (realOn()) { clickStop(); pvListen(); } else pvClick(); }
    function pvStop() { if (pv) pv.muted = true; clickStop(); pvSilence(); }
    async function pvListen() {   // the loop with the real sounds: the KILLDRUM SOLO loop, fed the previewed notes
      if (!pv) return; syncCur();
      if (soloOn) { B("killDrumSolo", soloArgs(false)); return; }
      const t = tr0(); if (t && t.playing && typeof run === "function") await run("togglePlay");
      const r = await B("killDrumSolo", soloArgs(true)); if (r && r.ok) { soloOn = true; if (pv) pv.started = true; }
      paintRwHead();
    }
    async function pvSilence() { rwSolo = false; if (soloOn) { soloOn = false; await B("killDrumSolo", { pluginId: pid, on: false }); } paintRwHead(); }
    let rwSolo = false;   // the sound toggle started the real-sound loop with nothing previewed yet
    function pvShow(apply, label, tile) {   // apply(): changes S to the pattern to hear; tile: its row (click playhead)
      if (!pv) pv = { snap: snapNow(), started: rwSolo, label: "" };
      putSnap(pv.snap); apply(); pv.label = label; pv.muted = false; pv.tile = tile || null;
      root.classList.add("kd-pv"); if (RW) RW.classList.add("kd-pv");
      renderAll(); notifyRhythm(); paintRwHead();
      if (REAL_OLD()) pvListen(); else pvPlay();
    }
    function pvRevert() {
      if (!pv) return; const was = pv; pv = null;
      putSnap(was.snap); root.classList.remove("kd-pv"); if (RW) RW.classList.remove("kd-pv");
      renderAll(); notifyRhythm();
      if (was.started) pvSilence(); else if (soloOn) { syncCur(); B("killDrumSolo", soloArgs(false)); }
      if (was.saveWanted) save(was.saveUndo);
    }
    function pvCommit() {
      if (!pv) return; const was = pv;
      if (!S.rhythmHist || !S.rhythmHist.length) pushHist(histEntry("Start", was.snap));   // where it came from
      if (was.kind === "rhythm" && S.rhythm) S.rhythmLock = true;
      pushHist(histEntry(was.label));
      pv = null; root.classList.remove("kd-pv"); if (RW) RW.classList.remove("kd-pv");
      renderAll(); save(true); notifyRhythm();
      ctx.say(`${was.label} committed. The old pattern is in HISTORY.`);
      if (was.started) pvSilence();
      closeRw();
    }
    function paintRwHead() {
      if (!rwPop) return; const h = rwPop.querySelector(".kd-rwhead"); if (!h) return;
      h.querySelector(".kd-rwcommit").disabled = !pv;
      const ear = h.querySelector(".kd-rwear");
      if (REAL_OLD()) { ear.classList.toggle("kd-live", !!(pv && soloOn)); ear.classList.toggle("kb-lit", !!pv); }
      else { ear.classList.toggle("kd-live", realOn() && soloOn); ear.classList.toggle("kb-lit", realOn()); ear.setAttribute("aria-pressed", realOn() ? "true" : "false"); }
      h.querySelector(".kd-rwhist").classList.toggle("kb-lit", rwMode === "hist");
    }
    let rwMode = "list";
    function closeRw() {
      if (!rwPop) return; try { window.KillDrumPreview && window.KillDrumPreview.stop(); } catch (e) { /* fine */ }
      if (pv) pvRevert();
      if (rwSolo) pvSilence();
      rwPop.remove(); rwPop = null; rwMode = "list"; document.removeEventListener("pointerdown", onDocRw, true);
    }
    function onDocRw(e) { if (rwPop && !rwPop.contains(e.target) && !RW.contains(e.target)) closeRw(); }
    function openRw() {
      const K = RB(); if (!K) return; closeRw();
      rwPop = el("div", "kd-rwpop" + (RWC() ? " kd-rwc" : "")); const r0 = RW.getBoundingClientRect();
      rwPop.style.left = Math.round(r0.left) + "px"; rwPop.style.width = Math.round(Math.max(r0.width, RWC() ? 300 : 0)) + "px"; rwPop.style.top = Math.round(r0.bottom + 4) + "px";
      rwPop.style.maxHeight = Math.max(160, window.innerHeight - r0.bottom - 16) + "px";
      fillRw();
      document.body.append(rwPop); document.addEventListener("pointerdown", onDocRw, true);
      const on = rwPop.querySelector(".kd-rwrow.kd-on"); if (on) on.scrollIntoView({ block: "nearest" });
    }
    function fillRw() {
      const K = RB(); if (!K || !rwPop) return; rwPop.innerHTML = "";
      const row = (id, name, html, parent) => { const b = el("button", "kd-rwrow" + ((id ? S.rhythmLock && S.rhythm === id : !S.rhythmLock) ? " kd-on" : ""), `<span>${name}</span>${html ? `<div class="kr-dots">${html}</div>` : ""}`); b.dataset.id = id || ""; (parent || rwPop).append(b); return b; };
      if (!RWC()) {   // the old list
        row("", "Auto", "").onclick = () => { if (S.rhythmLock) setRhythmLock(false); closeRw(); renderRw(); };
        for (const g of K.GROUPS) {
          const list = K.RHYTHMS.filter((r) => r.group === g.id); if (!list.length) continue;
          rwPop.append(el("div", "kd-rwgrp", g.name));
          for (const r of list) {
            const b = row(r.id, r.name, window.KillDrumRhythmsTab ? window.KillDrumRhythmsTab.dots(r) : ""); b.title = r.about || "";
            b.onclick = () => {
              if (S.rhythm !== r.id) setRhythm(r.id); if (!S.rhythmLock) setRhythmLock(true);
              for (const x of rwPop.querySelectorAll(".kd-rwrow")) x.classList.toggle("kd-on", x === b);
              const P = window.KillDrumPreview; if (!P || window.KT2_KD_RHYTHM_PREVIEW_OFF) return;
              if (P.playing() === r.id) { P.stop(); return; }
              P.stop(); if (P.play(r, b, () => { b.classList.remove("kr-play"); P._clear(); })) b.classList.add("kr-play");
            };
          }
        }
        return;
      }
      // head: Auto | listen | history | COMMIT
      const head = el("div", "kd-rwhead"); rwPop.append(head);
      const auto = row("", GL() ? `Auto <em>${genreLabel()}</em>` : "Auto", "", head); auto.classList.add("kd-rwauto");
      if (GL()) auto.title = `AUTO plays ${genreLabel()} rhythms. Change the genre to change them`;
      auto.onclick = () => { if (pv) pvRevert(); if (S.rhythmLock) setRhythmLock(false); closeRw(); renderRw(); };
      const ear = el("button", "kd-rwico kd-rwear", ICON_EAR);
      ear.title = REAL_OLD() ? "Listen: the previewed pattern loops with your KILLDRUM sounds. Press to stop or start it" : "Your sounds. Off: rhythms click on the metronome sounds. On: they play on this KILLDRUM's own sounds";
      const hist = el("button", "kd-rwico kd-rwhist", ICON_HIST); hist.title = "History: every pattern you committed on this KILLDRUM, the first one too. Press one to hear it, COMMIT to go back to it";
      const com = el("button", "kd-rwcommit", "Commit"); com.title = "Keep the pattern you are hearing. Close the list without it and the old one comes back";
      head.append(ear, hist, com);
      ear.onclick = async () => {
        if (REAL_OLD()) { if (!pv) return; if (soloOn) { pv.muted = true; pvSilence(); } else { pv.muted = false; pvListen(); } return; }
        rwReal = !rwReal; paintRwHead();
        if (pv) { pvPlay(); return; }
        if (rwReal) {   // nothing previewed yet: hear the pattern you have on your sounds
          const t = tr0(); if (t && t.playing && typeof run === "function") await run("togglePlay");
          syncCur(); const r = await B("killDrumSolo", soloArgs(true)); if (r && r.ok && rwPop) { soloOn = true; rwSolo = true; }
          paintRwHead();
        } else if (rwSolo) pvSilence();
      };
      hist.onclick = () => { rwMode = rwMode === "hist" ? "list" : "hist"; fillRw(); };
      com.onclick = () => pvCommit();
      const sel0 = pv ? pv.label : null;
      if (rwMode === "hist") {
        const H = (S.rhythmHist || []).slice().reverse(); rwPop.append(el("div", "kd-rwgrp", "History"));
        if (!H.length) rwPop.append(el("div", "kd-rwnone", "Nothing committed yet. Press a rhythm, then COMMIT."));
        const now = pv ? histKey(histEntry("", pv.snap)) : curKey();
        H.forEach((h, k) => {
          const d = new Date(h.t || 0), tm = isFinite(d) ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
          const b = row("h" + k, `${h.name}<em>${tm}</em>`, histDots(h)); b.classList.toggle("kd-on", histKey(h) === now); b.classList.toggle("kd-pvon", !!pv && pv.hist === h);
          b.onclick = () => { pvShow(() => putHist(h), h.name, b); pv.kind = "hist"; pv.hist = h; for (const x of rwPop.querySelectorAll(".kd-rwrow")) x.classList.toggle("kd-pvon", x === b); };
        });
      } else {
        const gl = GL() ? gList() : [];
        const groups = gl.length ? [{ id: "\u0000genre", name: genreLabel().toUpperCase() }].concat(K.GROUPS) : K.GROUPS;
        for (const g of groups) {
          const list = g.id === "\u0000genre" ? gl.map((id) => K.byId(id)).filter(Boolean) : K.RHYTHMS.filter((r) => r.group === g.id && !gl.includes(r.id)); if (!list.length) continue;
          rwPop.append(el("div", "kd-rwgrp" + (g.id === "\u0000genre" ? " kd-rwgen" : ""), g.name));
          for (const r of list) {
            const b = row(r.id, r.name, window.KillDrumRhythmsTab ? window.KillDrumRhythmsTab.dots(r) : ""); b.title = r.about || "";
            if (pv && pv.kind === "rhythm" && pv.rid === r.id) b.classList.add("kd-pvon");
            b.onclick = () => {
              if (pv && pv.kind === "rhythm" && pv.rid === r.id) {   // same one again: stop / start the sound
                if (REAL_OLD()) { pv.muted = !pv.muted; pv.muted ? pvSilence() : pvListen(); } else if (pv.muted) { pv.tile = b; pvPlay(); } else pvStop();
                return;
              }
              pvShow(() => setRhythm(r.id, true, true), r.name, b); pv.kind = "rhythm"; pv.rid = r.id;
              for (const x of rwPop.querySelectorAll(".kd-rwrow")) x.classList.toggle("kd-pvon", x === b);
            };
          }
        }
      }
      paintRwHead(); void sel0;
      // the list was redrawn (HISTORY switch): the clicks follow the previewed row, or stop with it gone
      if (pv && !pv.muted && !realOn() && pv.tile && !pv.tile.isConnected) { const t = rwPop.querySelector(".kd-rwrow.kd-pvon"); if (t) { pv.tile = t; pvClick(); } }
    }
    if (RW) document.addEventListener("killdrum-rhythm", renderRw);
    const playBtn = rollbar.querySelector(".kb-play");
    rollbar.querySelector(".kb-undo").onclick = () => ctx.undo && ctx.undo();
    rollbar.querySelector(".kb-redo").onclick = () => ctx.redo && ctx.redo();
    if (ctx.canUndo && !ctx.canUndo()) for (const b of rollbar.querySelectorAll(".kb-hist")) b.hidden = true;
    playBtn.onclick = togglePlay;
    // PG MATCH (ui/kt2-pgmatch.js): ROLL / Pattern only first listen to the sound clips over this beat (onsets on the
    // song grid), then the rhythm brain follows their accents and the kick / 808 land on their low hits
    const pgBtn = rollbar.querySelector(".kb-pgm");
    if (pgBtn) { KT2PGMatch.addCss(); pgBtn.onclick = () => { const v = !KT2PGMatch.isOn("killdrum"); KT2PGMatch.setOn("killdrum", v); pgBtn.classList.toggle("on", v); pgBtn.setAttribute("aria-checked", String(v)); if (!v) pgG = null; }; }
    // CUSTOM DATA (ui/kt2-custom-data.js): ON = only Eman's favorite drums + the hand-written genre rhythms; OFF = the drum
    // rhythm collection and the hand-made grooves come in too (applies to the next roll)
    if (window.KT2CustomData) KT2CustomData.wire(rollbar.querySelector(".kb-cdata"), "killdrum");
    const pgRoll = (sounds, patterns) => {
      if (!(patterns && pgBtn && KT2PGMatch.isOn("killdrum") && clip.clipLength > 0)) { pgG = null; return rollAll(sounds, patterns); }
      KT2PGMatch.busy(pgBtn, true);
      KT2PGMatch.grooveFor(clip.clipStart, clip.clipStart + clip.clipLength).catch((e) => { console.error(e); return null; }).then((g) => {
        KT2PGMatch.busy(pgBtn, false); pgG = g; rollAll(sounds, patterns);
        if (!g) ctx.say(`${KT2PGMatch.LABEL}: no sounds over this beat yet.`);
      });
    };
    rollbar.querySelector(".kd-roll").onclick = () => pgRoll(true, true);
    // COMPLEXITY knob + 808 switch (Eman, 15 Nov). KD_CX_OFF = neither (old rolls).
    const cxEl = rollbar.querySelector(".kb-cx"), subBtn = rollbar.querySelector(".kb-sub");
    const CX_C = 2 * Math.PI * 18, CX_A = CX_C * 0.75;
    const cxWord = (v) => (v < 0.2 ? "Simple" : v < 0.68 ? "Mid" : v < 0.9 ? "Wild" : "Crazy");
    function cxColor(v) {   // acid yellow -> orange -> red
      const st = [[0, [228, 255, 58]], [0.5, [255, 170, 40]], [1, [255, 40, 40]]];
      let a = st[0], b = st[2]; for (let i = 0; i < 2; i++) if (v >= st[i][0] && v <= st[i + 1][0]) { a = st[i]; b = st[i + 1]; }
      const t = (v - a[0]) / (b[0] - a[0] || 1), c = a[1].map((x, i) => Math.round(x + (b[1][i] - x) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
    function paintCx() {
      if (!cxEl) return; const v = clamp(S.cx == null ? 0.5 : S.cx, 0, 1), c = cxColor(v);
      cxEl.querySelector(".kb-cx0").setAttribute("stroke-dasharray", `${CX_A.toFixed(2)} ${CX_C.toFixed(2)}`); cxEl.querySelector(".kb-cx0").setAttribute("transform", "rotate(135 22 22)");
      const a1 = cxEl.querySelector(".kb-cx1"); a1.setAttribute("stroke-dasharray", `${Math.max(0.01, CX_A * v).toFixed(2)} ${CX_C.toFixed(2)}`); a1.setAttribute("stroke", c);
      cxEl.style.setProperty("--cx", c); cxEl.style.setProperty("--cxa", (0.15 + 0.55 * v).toFixed(2)); cxEl.classList.toggle("kb-cxmax", v > 0.9);
      cxEl.querySelector("b").textContent = cxWord(v); cxEl.dataset.v = Math.round(v * 100);
    }
    function setCx(v, quiet) { S.cx = clamp(+v, 0, 1); paintCx(); if (!quiet) { save(true); ctx.say(`Complexity ${cxWord(S.cx).toUpperCase()} (${Math.round(S.cx * 100)}%): ROLL to hear it.`); } }
    if (cxEl) {
      let d = null;
      cxEl.addEventListener("pointerdown", (e) => { e.preventDefault(); d = { y: e.clientY, v: S.cx == null ? 0.5 : S.cx, moved: false }; try { cxEl.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } });
      cxEl.addEventListener("pointermove", (e) => { if (!d) return; const dy = d.y - e.clientY; if (Math.abs(dy) > 3) d.moved = true; if (d.moved) { S.cx = clamp(d.v + dy / 150, 0, 1); paintCx(); } });
      const up = () => { if (!d) return; const m = d.moved; d = null; if (m) setCx(S.cx); else { const v = S.cx == null ? 0.5 : S.cx; setCx(v < 0.25 ? 0.5 : v < 0.75 ? 1 : 0); } };
      cxEl.addEventListener("pointerup", up); cxEl.addEventListener("pointercancel", () => { d = null; paintCx(); });
      cxEl.addEventListener("dblclick", () => setCx(0.5));
    }
    function paintSub() { if (!subBtn) return; const m = S.sub808 || "auto"; subBtn.dataset.m = m; subBtn.querySelector("b").textContent = m === "on" ? "On" : m === "off" ? "Off" : "Auto"; }
    // ON puts an 808 under the kick now (if there is none), OFF takes it out now; AUTO waits for the next roll
    function setSub(m) {
      S.sub808 = m; paintSub();
      const p8 = S.pads["808"], has = p8.steps.some((x) => x && x.v);
      if (!p8.lock.pattern && m === "off" && has) { p8.steps = fit([], S.bars); if (S.lines) delete S.lines["808"]; syncSubRows(); renderAll(); }
      else if (!p8.lock.pattern && m === "on" && !has) { const k = S.pads.kick.steps; p8.steps = slides808(fit(k.some((x) => x.v) ? k.map((x, i) => (x.v && (i % 16 === 0 || Math.random() < 0.75) ? { v: Math.max(1, x.v - 6), r: 1 } : { v: 0, r: 1 })) : P().parse("x.........x.....", S.bars), S.bars), newSeed()); renderAll(); }
      save(true); ctx.say(m === "on" ? "808 ON: every roll has one." : m === "off" ? "808 OFF: no 808 in the rolls." : "808 AUTO: the style decides.");
    }
    if (subBtn) subBtn.onclick = () => setSub(S.sub808 === "auto" || !S.sub808 ? "on" : S.sub808 === "on" ? "off" : "auto");
    const ogAllBtn = rollbar.querySelector(".kb-ogall"); if (ogAllBtn) ogAllBtn.onclick = () => setOffGrid(null, !S.offgrid);
    rollbar.querySelector(".kb-sounds").onclick = () => rollAll(true, false);
    rollbar.querySelector(".kb-patterns").onclick = () => pgRoll(false, true);
    for (const b of rollbar.querySelectorAll(".kb-bars button")) b.onclick = () => setBars(Number(b.dataset.bars));
    const pagesEl = rollbar.querySelector(".kb-pages"), barsSel = rollbar.querySelector(".kb-bars");
    // 16 / 32 / 64 / 128 and the 1-2 / 3-4 pages hidden (Eman, 16 Nov); the beat keeps its length. KT2_KD_RES_SHOW = back.
    if (!window.KT2_KD_RES_SHOW) rollbar.classList.add("kb-nores");
    function renderPages() {
      const on = paged(); pagesEl.hidden = !on; if (!on) return;
      const w = win(), pages = Math.ceil(w.n / (SCROLL ? w.m : PAGE_STEPS)), per = (SCROLL ? w.m : PAGE_STEPS) / 16;
      if (SCROLL && !(pages > 6 && lenFollow())) { pagesEl.hidden = true; return; }   // the scroll strip under the rows does this now
      if (SCROLL) {   // long songs keep the \u2039 17-18 / 96 VERSE \u203a label, for where the window is
        const b0 = Math.floor(w.a / 16), sec = sectionAt(b0), lab = `${b0 + 1}-${Math.min(S.bars, Math.ceil((w.a + w.m) / 16))} <em>/ ${S.bars}</em>${sec ? ` <i>${sec.name}</i>` : ""}`;
        const html = `<button data-s="${Math.max(0, w.a - w.m)}" class="kb-pprev">\u2039</button><span class="kb-plab">${lab}</span><button data-s="${w.a + w.m}" class="kb-pnext">\u203a</button>`;
        if (pagesEl._html !== html) { pagesEl.innerHTML = html; pagesEl._html = html; }
        pagesEl.classList.add("kb-pcompact"); return;
      }
      if (pages > 6 && lenFollow()) {   // a long clip: \u2039 bars 17-18 of 96 \u00b7 VERSE \u203a
        const sec = sectionAt(page * per), lab = `${page * per + 1}-${Math.min(S.bars, page * per + per)} <em>/ ${S.bars}</em>${sec ? ` <i>${sec.name}</i>` : ""}`;
        const html = `<button data-p="${Math.max(0, page - 1)}" class="kb-pprev">\u2039</button><span class="kb-plab">${lab}</span><button data-p="${Math.min(pages - 1, page + 1)}" class="kb-pnext">\u203a</button>`;
        if (pagesEl._html !== html) { pagesEl.innerHTML = html; pagesEl._html = html; }
        pagesEl.classList.add("kb-pcompact"); return;
      }
      pagesEl.classList.remove("kb-pcompact");
      const html = Array.from({ length: pages }, (_, i) => `<button data-p="${i}">${i * per + 1}-${i * per + per}</button>`).join("");
      if (pagesEl._html !== html) { pagesEl.innerHTML = html; pagesEl._html = html; }
      for (const b of pagesEl.querySelectorAll("button")) b.classList.toggle("kd-on", Number(b.dataset.p) === page);
    }
    pagesEl.addEventListener("click", (e) => { const sb = e.target.closest("button[data-s]"); if (sb) { setScroll(Number(sb.dataset.s), true); return; } const b = e.target.closest("button[data-p]"); if (!b) return; page = Number(b.dataset.p); renderPages(); for (const s of SLOTS) drawRow(s); });
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
      for (let k = 0; k < (n > 128 ? 0 : n); k += 4) { const [x0, y0] = pt(482, -90 + k * da), [x1, y1] = pt(494, -90 + k * da); svg.append(svgEl("line", { class: "kd-beatmark", x1: x0, y1: y0, x2: x1, y2: y1 })); }
      svg.append(svgEl("circle", { class: "kd-ringrim", cx: 500, cy: 500, r: 496 }));
      SLOTS.forEach((slot, i) => {
        const g = svgEl("g", { class: "kd-trk" }); g.dataset.slot = slot;
        const ro = 470 - 33 * i, ri = ro - 29, steps = [], ticks = [];
        for (let k = 0; k < (n > 128 ? 0 : n); k++) {   // a long song beat: no ring (rows only)
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
      if (S.view === "rows") { if (!gridLay) return null; const w = win(), cw = (gridLay.w - gridLay.x0 - 6) / w.m; return w.a + ((e.clientX - gridLay.left) / gridLay.k - gridLay.x0) / cw; }
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
    // The grid's place on screen is measured again on every press (Zed call, 7 Nov 11:03 + 24:30): once the
    // window had moved (dragged, or its open bounce) a click used the old place and landed a row up and steps off,
    // "the wrong sound in the wrong place", and rows looked dead. KD_GRID_STALE_OLD = true: the old cached place.
    const freshGrid = () => { if (!window.KD_GRID_STALE_OLD && S.view === "rows") layoutGrid(); };
    grid.addEventListener("pointerenter", freshGrid);
    const onDown = (e) => {
      barSel = false; freshGrid();
      let c = locate(e); if (!c) return;
      if (c.edge) { // grab the tail's end: drag to cut it (GHOST TAILS)
        e.preventDefault(); closeMenu(); if (c.slot !== sel) select(c.slot, true); setPick(c.slot, c.i, c.line || 0);
        e.currentTarget.setPointerCapture(e.pointerId); drag = { edge: true, slot: c.slot, line: c.line || 0, i: c.i }; return;
      }
      // A long sound (808, FX bed) is drawn over the empty cells after it and a click there picks that hit
      // (Eman, 27 Oct). Clicking that same spot again, with the hit already picked, now adds a new hit there:
      // in 32 steps an 808 covered its whole row, so no new 808 could go in. KD_TAIL_ADD_OFF = true: old.
      if (c.tail != null && !window.KD_TAIL_ADD_OFF && pick && pick.slot === c.slot && (pick.line || 0) === (c.line || 0) && pick.i === c.i) c = { ...c, i: c.tail, tail: null };
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
      if (GHOST && !drag && S.view === "rows") { const c = gridLocate(e); grid.style.cursor = c && c.edge ? "ew-resize" : ""; }
      if (drag && drag.edge) { // cut the tail: 1 step at least, up to the whole sound (then the hold is cleared)
        const f = posF(e), st = arrOf(drag.slot, drag.line), s0 = st[drag.i]; if (f == null || !s0 || !s0.v) return;
        const n = 16 * S.bars, nat = spanOf(st, drag.i, n, soundSteps(drag.slot)), o = s0.o || 0;
        const len = clamp(e.metaKey || e.ctrlKey ? fineSnap(f - drag.i - o) : Math.round(f - drag.i - o), 1, Math.max(1, nat));
        if (len >= nat - 0.01) delete s0.l; else s0.l = Math.round(len * 1000) / 1000;
        hint(`${LABEL[drag.slot]} tail: ${s0.l ? s0.l + " steps" : "full sound"}`); drag.moved = true; changed(drag.slot, false); return;
      }
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
      if (d.edge) { hint(""); if (d.moved) ringChanged(d.slot, true); return; }
      if (pruneLines()) layoutGrid();
      hint(""); ringChanged(d.slot, true);
    };
    // the circle and the rows view edit the same steps the same way
    for (const elx of [svg, grid]) {
      elx.addEventListener("contextmenu", (e) => e.preventDefault());
      elx.addEventListener("pointerdown", onDown); elx.addEventListener("pointermove", onMove);
      elx.addEventListener("pointerup", up); elx.addEventListener("pointercancel", up);
    }

    // DELETE A BAR (Eman, 16 Nov): click a BAR pill, then Delete/Backspace removes that BAR (one undo step,
    // the last BAR stays). Clicking the grid or a hit hands Delete back to the hits. KT2_KD_BARDEL_OFF = old.
    let barSel = false;
    const onKey = (e) => {
      if (dead || !shown || !root.isConnected || root.offsetParent === null) return;
      if (e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable)) return;
      if (barSel && !pick && !window.KT2_KD_BARDEL_OFF && (e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); e.stopPropagation(); barSel = false; delVer(S.cur); return;
      }
      if (!pick) return;
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
    // 64 and 128 steps (4 and 8 bars) show two bars at a time in the rows, so every cell stays big enough to
    // click (a 128-step row was 4 px a cell). The bar buttons under the beat pick which two. KD_PAGE_OFF = all at once.
    let page = 0;
    const PAGE_STEPS = 32;
    // SCROLL WINDOW (Eman, 16 Nov): a long beat keeps its steps readable (about 28 px or more each) and the rows become a
    // window over the whole beat: a strip under the rows shows where you are (drag it, click it, or scroll sideways over the
    // rows), and while it plays the window turns the page when the playhead runs off it. KT2_KD_SCROLL_OLD = the old
    // 2-bar pages with the bar buttons.
    const SCROLL = !window.KT2_KD_SCROLL_OLD, MIN_CELL = 28;
    let scrollA = 0, userScrollT = 0;
    const viewSteps = () => { const w = (grid.offsetWidth || 0) - 20; return w > 0 ? Math.max(16, Math.floor(w / MIN_CELL / 16) * 16) : PAGE_STEPS; };
    const paged = () => !window.KD_PAGE_OFF && S.view === "rows" && 16 * S.bars > (SCROLL ? viewSteps() : PAGE_STEPS);
    function win() {
      const n = 16 * S.bars;
      if (!paged()) return { a: 0, m: n, n };
      if (SCROLL) { const m = Math.min(n, viewSteps()); scrollA = Math.max(0, Math.min(n - m, Math.round(scrollA))); page = Math.floor(scrollA / m); return { a: scrollA, m, n }; }
      const pages = Math.ceil(n / PAGE_STEPS); if (page >= pages) page = pages - 1; if (page < 0) page = 0;
      return { a: page * PAGE_STEPS, m: Math.min(PAGE_STEPS, n - page * PAGE_STEPS), n };
    }
    const gridRows = {}; let gridLay = null; // key "kick" (the pad's row) or "kick:1", "kick:2" (its extra lines)
    const rowKey = (slot, line) => (line ? slot + ":" + line : slot);
    function gridRow(slot, line) {
      const key = rowKey(slot, line); if (gridRows[key]) return gridRows[key];
      const r = el("div", "kb-grow" + (line ? " kb-gsub" : "")); r.dataset.slot = slot; r.style.setProperty("--c", COLOR[slot]);
      const cv = el("canvas"); r.append(cv); grid.insertBefore(r, gph); return (gridRows[key] = { el: r, cv });
    }
    const gph = el("div", "kb-gph"); grid.append(gph);
    // the scroll strip under the rows (SCROLL WINDOW): the light block = what the rows show, the thin line = the playhead
    const hs = el("div", "kb-hs", `<div class="kb-hst"></div><div class="kb-hsp"></div>`); hs.hidden = true; hs.title = "Drag to see the rest of the beat (or scroll sideways over the rows)";
    const hsT = hs.firstChild, hsP = hs.lastChild; hsP.hidden = true;
    if (SCROLL) grid.append(hs);
    const hsOn = () => SCROLL && S.view === "rows" && paged();
    function renderHs() {
      if (!SCROLL) return;
      const on = hsOn(); hs.hidden = !on; root.classList.toggle("kb-hson", on); if (!on) return;
      const w = win(); hsT.style.left = (100 * w.a / w.n) + "%"; hsT.style.width = (100 * w.m / w.n) + "%";
    }
    function setScroll(a, user) {
      if (!SCROLL) return;
      const a0 = win().a; scrollA = a; const w = win(); if (user) userScrollT = performance.now();
      if (w.a !== a0) { renderPages(); for (const s of SLOTS) drawRow(s); if (mr) mrSoon(); }
      renderHs();
    }
    hs.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = hs.getBoundingClientRect(), w = win(), stepAt = (x) => ((x - r.left) / Math.max(1, r.width)) * w.n;
      // on the light block: drag it from where it was grabbed; next to it: jump there (centred), then drag
      let grab = stepAt(e.clientX) - w.a; if (e.target !== hsT) { grab = w.m / 2; setScroll(stepAt(e.clientX) - grab, true); }
      try { hs.setPointerCapture(e.pointerId); } catch (er) {}
      const mv = (ev) => setScroll(stepAt(ev.clientX) - grab, true);
      const up = () => { hs.removeEventListener("pointermove", mv); hs.removeEventListener("pointerup", up); hs.removeEventListener("pointercancel", up); userScrollT = performance.now(); };
      hs.addEventListener("pointermove", mv); hs.addEventListener("pointerup", up); hs.addEventListener("pointercancel", up);
    });
    hs.addEventListener("click", (e) => e.stopPropagation());
    let wheelAcc = 0;
    function hWheel(e, any) { // sideways wheel / trackpad (or Shift+wheel, or any wheel over the strip) moves the window
      if (!hsOn() || !gridLay) return false;
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey || any ? e.deltaY : 0; if (!dx) return false;
      e.preventDefault(); e.stopPropagation();
      const w = win(), cell = Math.max(4, ((gridLay.w - gridLay.x0 - 6) / w.m) * gridLay.k);
      wheelAcc += e.deltaMode === 1 ? dx * 16 : dx; const k = Math.trunc(wheelAcc / cell); if (k) { wheelAcc -= k * cell; setScroll(w.a + k, true); }
      return true;
    }
    hs.addEventListener("wheel", (e) => hWheel(e, true), { passive: false });
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
      // Every pad's row fits above the beat's buttons: when the last pads (FX, Texture) fall under the rows' area,
      // the pads get shorter (down to 26 px) until they fit (Zed call, 7 Nov: rows you can't click). KD_ROWS_FIT_OFF = old.
      if (!window.KD_ROWS_FIT_OFF && !layoutGrid._fitting) {
        const els = []; for (const slot of SLOTS) { els.push(rows[slot].el); for (const x of subEls[slot] || []) els.push(x); }
        const first = els[0] && els[0].getBoundingClientRect(), last = els[els.length - 1] && els[els.length - 1].getBoundingClientRect();
        const cur = parseFloat(root.style.getPropertyValue("--kd-row")) || 0;
        if (first && last && first.height) {
          const kk = grid.offsetWidth ? g.width / grid.offsetWidth : 1, gap = 4 * kk;
          const fit = Math.floor(((g.bottom - (hsOn() ? 16 : 4) * kk - first.top) / els.length - gap) / kk);
          const want = last.bottom > g.bottom + 1 ? Math.max(els.length > 11 && cxOn() ? 18 : 26, Math.min(42, fit)) : cur && fit >= cur + 2 ? Math.min(42, fit) : cur;
          if (want && want !== cur) { root.style.setProperty("--kd-row", (want >= 42 ? 42 : want) + "px"); layoutGrid._fitting = true; try { layoutGrid(); } finally { layoutGrid._fitting = false; } return; }
        }
      }
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
      renderHs();
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
      const w = win(), y = (e.clientY - gridLay.top) / gridLay.k, x = (e.clientX - gridLay.left) / gridLay.k, n = 16 * S.bars, cw = (gridLay.w - gridLay.x0 - 6) / w.m;
      const row = Object.values(gridLay.rows).find((r) => y >= r.y && y < r.y + r.h);
      if (!row || x < gridLay.x0) return null;
      const slot = row.slot, line = row.line, f = w.a + (x - gridLay.x0) / cw;
      if (f >= w.a + w.m) return null;
      // a hit nudged later (Cmd-drag) is drawn past its cell: a click on that part still finds it
      let i = Math.floor(f); const st = arrOf(slot, line), prev = st[i - 1];
      if (prev && prev.v && prev.o && f < i + prev.o && !(st[i] && st[i].v)) i -= 1;
      // a long sound (an FX bed, an 808) is drawn over the empty cells after it: a click there picks
      // that hit, it doesn't add another one (Eman, 27 Oct)
      let tail = null;
      if (GHOST && i >= 0 && i < n && !(st[i] && st[i].v)) {
        // GHOST TAILS (Eman, 16 Nov): the tail is not clickable (a click there adds a hit), only its far edge is: grab it to cut the tail
        const ring = soundSteps(slot);
        for (let k = i - 1; k >= 0; k--) if (st[k] && st[k].v) {
          const o = st[k].o || 0, end = k + o + tailLen(st, k, n, ring);
          if (end > k + o + 1 - 1e-6 && Math.abs(f - end) * cw <= EDGE_PX) return { slot, line, i: k, f, edge: true };
          if (f < k + o + 1) i = k;   // the head box of a hit nudged later reaches into this cell
          break;
        }
        return i >= 0 && i < n ? { slot, line, i, f, tail: null } : null;
      }
      if (i >= 0 && i < n && !(st[i] && st[i].v)) { const ring = soundSteps(slot); for (let k = i - 1; k >= 0; k--) if (st[k] && st[k].v) { if (f < k + (st[k].o || 0) + spanOf(st, k, n, ring)) { tail = i; i = k; } break; } }
      return i >= 0 && i < n ? { slot, line, i, f, tail } : null;
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
    // GHOST TAILS (Eman, 16 Nov): only the outlined head box of a hit is clickable; the tail after it is drawn faint and
    // clicks go through it (add other hits there). Its far edge can be dragged left to cut the tail (sets the hit's hold, l,
    // which the engine fades out at), right again up to the whole sound. KT2_KD_TAIL_GHOST_OLD = old (solid, clickable tail).
    const GHOST = !window.KT2_KD_TAIL_GHOST_OLD, EDGE_PX = 6;
    function tailLen(st, k, n, ring) { const nat = spanOf(st, k, n, ring), l = st[k] && st[k].l; return GHOST && l > 0 ? Math.min(nat, Math.max(0.7, l)) : nat; }
    function drawRow(slot) { for (let line = 0; line <= linesOf(slot).length; line++) drawLine(slot, line); if (mr && mr.slot === slot) mrSoon(); }
    function drawLine(slot, line) {
      if (S.view !== "rows" || !gridLay) return;
      const R = gridRows[rowKey(slot, line)], lay = gridLay.rows[rowKey(slot, line)]; if (!R || !lay) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = gridLay.w, H = lay.h, cv = R.cv;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const wn = win(), n = 16 * S.bars, x0 = gridLay.x0, cw = (W - x0 - 6) / wn.m, ch = Math.max(16, H - 12), cy = H / 2, top = cy - ch / 2, col0 = pv ? PVCOL : COLOR[slot], col = col0;
      const st = arrOf(slot, line), quiet = !audible(slot), isSel = sel === slot;
      // the line in from the pad on the left
      if (!line) { g.globalAlpha = isSel ? 0.7 : 0.25; g.fillStyle = col; g.fillRect(0, cy - 0.5, x0 - 2, 1); g.globalAlpha = 1; }
      for (let k = 0; k < wn.m; k++) { // empty cells, every beat a little lighter
        g.fillStyle = (wn.a + k) % 4 === 0 ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.04)";
        rr(g, x0 + k * cw + 1.5, top, cw - 3, ch, 5); g.fill();
      }
      const ring = soundSteps(slot);
      if (wn.m < n) { g.save(); g.beginPath(); g.rect(x0, 0, W - x0, H); g.clip(); }
      for (let k = 0; k < n; k++) {
        const s = st[k]; if (!s || !s.v) continue;
        if (k >= wn.a + wn.m) break;
        const o = s.o || 0, uc = s.u && !pv ? UCOL : null, col = uc || col0;
        const len = tailLen(st, k, n, ring), x = x0 + (k - wn.a + o) * cw + 1.5, w = len * cw - 3;
        if (x + w < x0) continue;   // before the bars shown
        const a = (quiet ? 0.35 : 1) * (s.c != null ? 0.35 + 0.65 * s.c : 1), vel = 0.45 + 0.55 * (s.v / 127);
        if (GHOST && w > cw - 3) { // ghost tail: faint body + faint waveform after the head box, a thin edge to grab, then the head drawn solid
          const hx = x + cw - 3;
          g.save(); g.beginPath(); g.rect(hx, 0, x + w - hx + 2, H); g.clip();
          g.globalAlpha = a * 0.08; g.fillStyle = col; rr(g, x, top, w, ch, 5); g.fill();
          if (ring.pk) { const pk = ring.pk.peaks, show = Math.min(1, (len / Math.max(ring.steps, 0.001))), m = Math.max(2, Math.floor(pk.length * show)), wx = w - 4; g.beginPath(); for (let q = 0; q < m; q++) { const px = x + 2 + (q / m) * wx, amp = Math.min(1, pk[q] * 1.6) * (ch / 2 - 3) * vel; g.moveTo(px, cy - amp); g.lineTo(px, cy + amp); } g.globalAlpha = a * 0.3; g.strokeStyle = col; g.lineWidth = Math.max(1, wx / m * 0.7); g.stroke(); }
          g.globalAlpha = a * (s.l > 0 ? 0.75 : 0.35); g.fillStyle = col; g.fillRect(x + w - 2, top + 4, 2, ch - 8);
          g.restore();
          g.save(); g.beginPath(); g.rect(x - 2, 0, cw + 1, H); g.clip();
        }
        g.globalAlpha = a * 0.22; g.fillStyle = col; rr(g, x, top, GHOST ? Math.min(w, cw - 4) : w, ch, 5); g.fill();
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
        if (GHOST && w > cw - 3) g.restore();
        if (uc) { g.globalAlpha = a; g.fillStyle = uc; diamond(g, x + cw - 9, top + 7, 3.5); } // unique: own colour + a small diamond
        if (k === phStep && !quiet) { g.globalAlpha = 0.9; g.strokeStyle = "#fff"; g.lineWidth = 1.5; rr(g, x + 0.5, top + 0.5, cw - 4, ch - 1, 5); g.stroke(); }
        if (pick && pick.slot === slot && (pick.line || 0) === line && pick.i === k) { g.globalAlpha = 1; g.strokeStyle = "#fff"; g.lineWidth = 2; g.setLineDash([]); rr(g, x - 1, top - 1, Math.max(cw - 1, w + 2), ch + 2, 6); g.stroke(); }
      }
      if (wn.m < n) g.restore();
      g.globalAlpha = 1;
    }
    function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); }
    function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function setView(v) {
      // ROWS ONLY (Eman, 15 Nov): the circle view and its button are gone, rows are the only view. KD_RING_ON = old (circle + button)
      S.view = v === "rows" || !window.KD_RING_ON ? "rows" : "ring";
      viewBtn.hidden = !window.KD_RING_ON;
      root.classList.toggle("kb-rowsview", S.view === "rows");
      viewBtn.innerHTML = S.view === "rows" ? ICON.ring : ICON.rows;
      viewBtn.title = S.view === "rows" ? "Show the beat as a circle" : "Show the beat as rows (each pad's steps in a line, with its sound's waveform)";
      requestAnimationFrame(() => { layoutGrid(); if (mr) { mrPlace(); mrDraw(); } });
      renderPages();
    }
    viewBtn.onclick = () => { setView(S.view === "rows" ? "ring" : "rows"); save(false); };
    plist.addEventListener("scroll", () => layoutGrid(), { passive: true });
    // the rows follow the pad list, which scrolls when the window is short: the wheel over the rows scrolls it too,
    // so the last pads (FX, Texture) can be reached from the grid (they were cut off under it). KD_GRID_WHEEL_OFF = old.
    grid.addEventListener("wheel", (e) => { if (hWheel(e, false)) return; if (window.KD_GRID_WHEEL_OFF || plist.scrollHeight <= plist.clientHeight + 1) return; e.preventDefault(); plist.scrollTop += e.deltaY; }, { passive: false });
    if (typeof ResizeObserver !== "undefined") { const gro = new ResizeObserver(() => layoutGrid()); gro.observe(grid); }
    setView(S.view);

    // ---------------------------------------------------------------- the row's MIDI editor (Eman, 14 Nov)
    // The MIDI icon on a pad row turns the step grid into a small piano roll for the picked pad, in the same box.
    // MIDI: click empty = a note (Cmd = 1/32 and triplets), drag = move it in time and pitch, drag its end = how long it
    // holds, right-click = take it away, double-click = Slide in / Slide out, the strip under it = how hard each note hits
    // (snaps at 100, double-click = 100, over 100 goes red-orange). ADVANCED: PITCH draws a line from the note (the sound
    // follows it), FINE moves its pitch in cents, WOBBLE (drag up = deeper, sideways = faster). Notes are the row's steps:
    // pitch = t, hold = l, slide = g, plus bend / wob / ft; two notes on one step go on the pad's extra lines.
    // KD_ROWMIDI_OFF = no MIDI icon (the off-grid button per row instead).
    // KD_MROLL_OLD = the 14 Nov first look (+/- semitone numbers, square notes, no note names, no sound root)
    // rows about 22 px tall by default (Eman, 15 Nov: "not so thin"); KD_MROLL_THIN = the 15 px rows
    const MR_NEW = !window.KD_MROLL_OLD, MR_KEYS = MR_NEW ? 50 : 30, MR_VEL = 34, MR_ROWH = MR_NEW && !window.KD_MROLL_THIN ? 22 : 15, MR_LO = -24, MR_HI = 24, ACID = "#E4FF3A", OVER = "#FF5A2E";
    const MR_RATES = [0.5, 1, 2, 3, 4, 6, 8, 12, 16], MR_RN = { 0.5: "1/2", 1: "1/4", 2: "1/8", 3: "1/8T", 4: "1/16", 6: "1/16T", 8: "1/32", 12: "1/32T", 16: "1/64" };
    const MR_SHAPES = ["\u223f", "\u22c0", "\u2293", "\u25e9"];
    const mrEl = el("div", "kb-mroll"); mrEl.hidden = true;
    mrEl.innerHTML = `<div class="kb-mhead"><div class="kd-seg kb-mtabs"><button data-t="0">MIDI</button><button data-t="1">Advanced</button></div><span class="kb-mname"></span>
      <div class="kb-mtools" hidden><button data-tool="pitch" title="Pitch: drag from a note, the sound follows the line. Right-click a point takes it off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h5c5 0 6-12 11-12h2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg><span>Pitch</span></button><button data-tool="fine" title="Fine: drag a note up or down to tune it in cents. Double-click resets"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg><span>Fine</span></button><button data-tool="wobble" title="Wobble: drag a note up for more, down for less, sideways for faster. Right-click takes it off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2.5-7 5-7 7.5 0s5 7 7.5 0 3.5-5 5-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>Wobble</span></button>
      <span class="kb-msep"></span><button class="kb-mk" data-k="d" title="Wobble depth: drag up or down"><b>Depth</b><i></i></button><button class="kb-mk" data-k="r" title="Wobble speed: click for the next"><b>Rate</b><i></i></button><button class="kb-mk" data-k="sh" title="Wobble shape: click for the next"><b>Shape</b><i></i></button><button class="kb-mk kb-mreset" title="Pitch line, fine pitch and wobble off for the picked note"><b>Reset</b></button></div></div>
      <div class="kb-mbody"><canvas></canvas><div class="kb-mph" hidden></div><div class="kb-mmenu" hidden></div>${MR_NEW ? '<button class="kb-msemi" title="Note names or +/- semitones from the sound"></button>' : ""}</div>`;
    stage.append(mrEl);
    const mrCv = mrEl.querySelector("canvas"), mrBody = mrEl.querySelector(".kb-mbody"), mrMenu = mrEl.querySelector(".kb-mmenu"), mrPh = mrEl.querySelector(".kb-mph");
    // Note names (Eman, 14 Nov): the rows are real notes, the piano roll's keys, from the sound's own note (found by
    // listening, ui/kd-root.js, kept per sound). The button in the corner flips to +/- semitones from the sound.
    let mrSemi = false; try { mrSemi = localStorage.getItem("kt2.kdMidiSemi") === "1"; } catch (e) { /* private */ }
    const semiBtn = mrEl.querySelector(".kb-msemi");
    const semiPaint = () => { if (!semiBtn) return; semiBtn.textContent = mrSemi ? "\u00b1" : "C"; semiBtn.classList.toggle("kd-on", mrSemi); semiBtn.title = mrSemi ? "Showing +/- semitones from the sound. Click for note names" : "Showing note names. Click for +/- semitones from the sound"; };
    if (semiBtn) { semiPaint(); semiBtn.addEventListener("pointerdown", (e) => e.stopPropagation()); semiBtn.onclick = (e) => { e.stopPropagation(); mrSemi = !mrSemi; try { localStorage.setItem("kt2.kdMidiSemi", mrSemi ? "1" : "0"); } catch (er) { /* private */ } semiPaint(); mrDraw(); }; }
    const ROOT_KEY = "kt2.kdRoots.v1", rootMem = new Map();
    let rootStore = {}; try { rootStore = JSON.parse(localStorage.getItem(ROOT_KEY) || "{}") || {}; } catch (e) { rootStore = {}; }
    // the pad sound's own MIDI note (null = no clear pitch, shown as C). Asks the engine once per sound.
    function rootOf(slot) {
      if (window.KD_ROOT_OFF) return null;
      const note = NOTE_OF[slot], url = kitE && kitE.kit && kitE.kit[note]; if (!url) return null;
      if (rootMem.has(url)) { const v = rootMem.get(url); return v === "loading" ? undefined : v; }
      if (url in rootStore) { rootMem.set(url, rootStore[url]); return rootStore[url]; }
      rootMem.set(url, "loading");
      B("killDrumRoot", { url }).then((r) => {
        if (!r || r.ok === false || r.error) { rootMem.set(url, null); if (mr && mr.slot === slot) { mrHead(); mrDraw(); } return; }   // could not load it: counts from C this time, asks again next visit
        const m = r.midi == null ? null : r.midi; rootMem.set(url, m);
        try { rootStore[url] = m; const ks = Object.keys(rootStore); if (ks.length > 3000) for (const k of ks.slice(0, ks.length - 3000)) delete rootStore[k]; localStorage.setItem(ROOT_KEY, JSON.stringify(rootStore)); } catch (e) { /* full or private */ }
        if (mr && mr.slot === slot) { mrHead(); mrFit(); mrDraw(); }
      }, () => rootMem.set(url, null));
      return undefined;
    }
    // what row t sounds as: the sound's note (an unpitched one counts as C3) plus the pad's own Pitch knob
    function baseOf(slot) {
      const r = rootOf(slot), pp = (kitE && kitE.kitPad && kitE.kitPad[NOTE_OF[slot]]) || {};
      return (r == null ? 48 : r) + Math.round(pp.tune || 0);
    }
    const NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], pcOf = (p) => ((p % 12) + 12) % 12;
    const nameOf = (m) => NN[pcOf(m)] + (Math.floor(m / 12) - 1);
    function songKey() {
      const k = (typeof ui !== "undefined" && ui && ui.state && ui.state.key) || null, tonic = k && k.tonic != null && k.tonic >= 0 ? k.tonic % 12 : 0;
      const SC = window.KT_SCALES || {}, nm = (k && k.scale) || (k && k.minor ? "minor" : "major");
      return { tonic, steps: (SC[nm] && SC[nm].steps) || (k && k.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]) };
    }
    for (const b of mrEl.querySelectorAll(".kb-mtabs button")) b.onclick = () => { if (!mr) return; mr.adv = b.dataset.t === "1"; try { localStorage.setItem("kt2.kdMidiAdv", mr.adv ? "1" : "0"); } catch (e) { /* private */ } mrHead(); mrDraw(); };
    for (const b of mrEl.querySelectorAll(".kb-mtools [data-tool]")) b.onclick = () => { if (!mr) return; mr.tool = b.dataset.tool; mrHead(); mrDraw(); };
    function mrToggle(slot) {
      if (window.KD_ROWMIDI_OFF) return;
      if (mr && mr.slot === slot) { mrClose(); return; }
      if (slot !== sel) select(slot);
      let adv = false; try { adv = localStorage.getItem("kt2.kdMidiAdv") === "1"; } catch (e) { /* private */ }
      mr = { slot, adv, tool: (mr && mr.tool) || "pitch", pick: null, top: null };
      mrEl.hidden = false; root.classList.add("kb-midiopen"); mrPlace(); mrFit(); mrHead(); renderRows(); mrDraw();
    }
    function mrClose() { mr = null; mrEl.hidden = true; mrMenu.hidden = true; root.classList.remove("kb-midiopen"); renderRows(); requestAnimationFrame(layoutGrid); }
    // the editor takes exactly the step grid's box (the circle's in the ring view)
    function mrPlace() {
      if (!mr) return;
      const t = S.view === "rows" && grid.offsetWidth ? grid : circle;
      mrEl.style.left = t.offsetLeft + "px"; mrEl.style.top = t.offsetTop + "px"; mrEl.style.width = t.offsetWidth + "px"; mrEl.style.height = t.offsetHeight + "px";
    }
    function mrHead() {
      if (!mr) return;
      mrEl.style.setProperty("--c", COLOR[mr.slot]);
      const rt = MR_NEW ? rootOf(mr.slot) : undefined;
      mrEl.querySelector(".kb-mname").textContent = LABEL[mr.slot] + (rt != null ? " \u00b7 " + nameOf(baseOf(mr.slot)) : ""); mrEl.classList.toggle("kb-madv", !!mr.adv);
      for (const b of mrEl.querySelectorAll(".kb-mtabs button")) b.classList.toggle("kd-on", (b.dataset.t === "1") === mr.adv);
      const tools = mrEl.querySelector(".kb-mtools"); tools.hidden = !mr.adv;
      for (const b of tools.querySelectorAll("[data-tool]")) b.classList.toggle("kd-on", b.dataset.tool === mr.tool);
      const n = mrPicked(), w = n && n.st.wob;
      for (const k of tools.querySelectorAll(".kb-mk[data-k]")) k.classList.toggle("kb-dim", !w);
      tools.querySelector('[data-k="d"] i').textContent = w ? (+w.d).toFixed(2) + " st" : "\u2013";
      tools.querySelector('[data-k="r"] i').textContent = w ? MR_RN[w.r] || w.r + "/b" : "\u2013";
      tools.querySelector('[data-k="sh"] i').textContent = w ? MR_SHAPES[w.sh | 0] : "\u2013";
    }
    // every note of the pad: its row and its extra lines
    function mrNotes() {
      if (!mr) return [];
      const slot = mr.slot, n = 16 * S.bars, ring = soundSteps(slot), out = [];
      for (let line = 0; line <= linesOf(slot).length; line++) {
        const a = arrOf(slot, line);
        for (let i = 0; i < n; i++) { const st = a[i]; if (!st || !st.v) continue; out.push({ line, i, st, x: i + (st.o || 0), len: st.l > 0 ? st.l : Math.max(0.9, spanOf(a, i, n, ring)) }); }
      }
      return out.sort((p, q) => p.x - q.x || p.line - q.line);
    }
    const mrPicked = () => { if (!mr || !mr.pick) return null; const st = arrOf(mr.slot, mr.pick.line)[mr.pick.i]; return st && st.v ? { line: mr.pick.line, i: mr.pick.i, st, x: mr.pick.i + (st.o || 0) } : null; };
    // geometry: rows of semitones (top = the highest shown), steps across, the strip for how hard at the bottom
    function mrGeo() {
      const W = mrBody.clientWidth || 1, H = mrBody.clientHeight || 1, w = win(), vel = MR_VEL, rh = H - vel;
      const rowsN = clamp(Math.floor(rh / MR_ROWH), 7, MR_HI - MR_LO + 1), RH = rh / rowsN;
      if (mr.top == null) mr.top = Math.round((rowsN - 1) / 2);
      mr.top = clamp(mr.top, MR_LO + rowsN - 1, MR_HI);
      const cw = (W - MR_KEYS - 4) / w.m;
      return { W, H, w, rowsN, RH, rh, cw, top: mr.top, X: (f) => MR_KEYS + (f - w.a) * cw, Y: (p) => (mr.top - p) * RH + RH / 2, F: (x) => w.a + (x - MR_KEYS) / cw, P: (y) => mr.top - (y - RH / 2) / RH };
    }
    function mrFit() { // centre the notes there are (or the pad's own pitch)
      const ns = mrNotes(); if (!ns.length) { mr.top = null; return; }
      const lo = Math.min(...ns.map((n) => n.st.t || 0)), hi = Math.max(...ns.map((n) => n.st.t || 0)), rows = clamp(Math.floor(((mrBody.clientHeight || 300) - MR_VEL) / MR_ROWH), 7, 49);
      mr.top = Math.round((lo + hi) / 2 + (rows - 1) / 2);
    }
    const mrSoon = () => { if (mr && !mrRaf) mrRaf = requestAnimationFrame(() => { mrRaf = 0; mrDraw(); }); };
    const bendAtB = (st, tb) => { const B = st.bend; if (!B || !B.length) return 0; if (tb <= B[0][0]) return B[0][1]; for (let i = 0; i + 1 < B.length; i++) { const a = B[i], b = B[i + 1]; if (tb <= b[0]) { const d = b[0] - a[0]; return d <= 1e-9 ? b[1] : a[1] + (b[1] - a[1]) * (tb - a[0]) / d; } } return B[B.length - 1][1]; };
    const wobAtB = (st, tb, lenB) => { const w = st.wob; if (!w || !(w.d > 0)) return 0; const env = w.f > 0 ? Math.min(1, tb / Math.max(1e-6, w.f * lenB)) : 1, x = (tb * (w.r || 4)) % 1, sh = w.sh | 0; const v = sh === 1 ? (x < 0.5 ? 4 * x - 1 : 3 - 4 * x) : sh === 2 ? (x < 0.5 ? 1 : -1) : sh === 3 ? 1 - 2 * x : Math.sin(2 * Math.PI * x); return w.d * env * v; };
    const rRect = (g, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const toWhite = (hex, k) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#ffffff"; const v = parseInt(m[1], 16), f = (c) => Math.round(c + (255 - c) * k); return `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`; };
    // the main MIDI roll's look (Eman, 14 Nov): dark ground, a lane per row (black for notes outside the song's key),
    // key chips on the left (white in the key, acid for the key's root, black outside it), beat lines only
    function mrRowsNew(g, G) {
      const base = baseOf(mr.slot), K = songKey(), col = COLOR[mr.slot], kw = MR_KEYS - 8, lanes = [];
      for (let k = 0; k < G.rowsN; k++) {
        const t = G.top - k, m = base + t, y = k * G.RH, rel = pcOf(m - K.tonic), inK = K.steps.includes(rel), tonic = rel === 0;
        const lx = MR_KEYS + 2, lw = G.W - MR_KEYS - 4, ly = y + Math.min(1.5, G.RH * 0.08), lh = G.RH - Math.min(3, G.RH * 0.16), lr = Math.min(6, lh / 2);
        lanes.push([ly, lh]);
        if (!inK) { rRect(g, lx, ly, lw, lh, lr); g.fillStyle = "#0a0a0b"; g.fill(); }
        g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(MR_KEYS, y + G.RH - 0.5, G.W - MR_KEYS, 1);
        const kr = Math.min(3.5, (G.RH - 3) / 2);
        rRect(g, 3, y + 1.5, kw, G.RH - 3, kr); g.fillStyle = tonic ? ACID : inK ? "#ececf1" : "#000000"; g.fill();
        if (t === 0) { g.fillStyle = col; rRect(g, 3, y + 1.5, 3, G.RH - 3, 1.5); g.fill(); if (tonic) { g.fillStyle = "#16161a"; g.fillRect(3, y + 1.5, 3, G.RH - 3); g.fillStyle = col; g.fillRect(4, y + 2.5, 1.5, G.RH - 5); } }   // the sound's own note
        if (G.RH >= 9 || pcOf(m) === 0 || t === 0) {
          const fs = Math.min(8, Math.max(6, G.RH * 0.5));
          g.font = `700 ${fs}px system-ui, sans-serif`; g.textBaseline = "middle"; g.textAlign = "left";
          g.fillStyle = tonic || inK ? "#16161a" : t === 0 ? "#cfcfd6" : "#55555d";
          g.fillText(mrSemi ? (t === 0 ? "0" : (t > 0 ? "+" : "") + t) : nameOf(m), 9, y + G.RH / 2 + 0.5);
          if (tonic && G.RH >= 11 && kw >= 40) { g.font = `800 ${Math.min(5.8, G.RH * 0.4)}px system-ui, sans-serif`; g.textAlign = "right"; g.fillText("ROOT", kw - 1, y + G.RH / 2 + 0.5); }
        }
      }
      // beat lines only (bars a bit stronger), and the 16ths very faint, only inside the lanes
      for (let k = 0; k <= G.w.m; k++) {
        const s0 = G.w.a + k, bar = s0 % 16 === 0, beat = s0 % 4 === 0;
        g.fillStyle = bar ? "rgba(255,255,255,0.15)" : beat ? "rgba(255,255,255,0.065)" : "rgba(255,255,255,0.022)";
        const x = Math.round(G.X(s0)) - 0.5; for (const [ly, lh] of lanes) g.fillRect(x, ly, 1, lh);
      }
    }
    // a note as the main roll draws it: a full box with small round corners, a little shine dot, and the line inside
    // = how hard it hits (full at 100, shorter below, its tip warming to red past 100)
    function mrNoteNew(g, x, y, w, h, c, v, picked, dim) {
      const bh = h, by = y, bw = Math.max(3, w), rad = Math.min(5, bh / 2), cc = picked ? toWhite(c, 0.62) : c;
      g.save(); g.globalAlpha = dim;
      rRect(g, x, by, bw, bh, rad); g.fillStyle = cc; g.fill();
      if (bw > bh) {
        g.fillStyle = picked ? c : "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(x + bh * 0.55, by + bh * 0.35, bh * 0.18, bh * 0.12, 0, 0, 7); g.fill();
        if (bw - bh * 1.6 > 2) {
          const k = Math.max(0.04, Math.min(1, v / 100)), lx = x + bh * 0.9, lw = Math.max(bh * 0.18, (bw - bh * 1.6) * k), r = Math.max(0, Math.min(1, (v - 100) / 27));
          g.fillStyle = picked ? c : "rgba(255,255,255,0.32)"; rRect(g, lx, by + bh * 0.22, lw, bh * (0.18 + 0.06 * r), bh * 0.09); g.fill();
          if (r > 0) { const gr = g.createLinearGradient(lx, 0, lx + lw, 0); gr.addColorStop(0, "rgba(255,106,42,0)"); gr.addColorStop(0.5, `rgba(255,106,42,${(0.8 * r).toFixed(3)})`); gr.addColorStop(1, `rgba(255,30,46,${Math.min(1, 0.3 + r).toFixed(3)})`); g.fillStyle = gr; rRect(g, lx, by + bh * 0.22, lw, bh * (0.18 + 0.06 * r), bh * 0.09); g.fill(); }
        }
      }
      if (picked) { g.globalAlpha = 1; g.strokeStyle = "#fff"; g.lineWidth = 1.5; rRect(g, x + 0.75, by + 0.75, Math.max(2, bw - 1.5), Math.max(2, bh - 1.5), Math.max(0, rad - 0.75)); g.stroke(); }
      g.restore();
    }
    function mrDraw() {
      if (!mr || mrEl.hidden) return;
      const G = mrGeo(), dpr = Math.min(2, window.devicePixelRatio || 1), cv = mrCv;
      if (cv.width !== Math.round(G.W * dpr) || cv.height !== Math.round(G.H * dpr)) { cv.width = Math.round(G.W * dpr); cv.height = Math.round(G.H * dpr); cv.style.width = G.W + "px"; cv.style.height = G.H + "px"; }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, G.W, G.H);
      if (MR_NEW) { g.fillStyle = "#161618"; g.fillRect(0, 0, G.W, G.H); }
      const col = COLOR[mr.slot], n = 16 * S.bars;
      if (MR_NEW) mrRowsNew(g, G); else
      // rows: the pad's own pitch (0) lighter, octaves marked
      for (let k = 0; k < G.rowsN; k++) {
        const p = G.top - k, y = k * G.RH;
        g.fillStyle = p === 0 ? "rgba(255,255,255,0.07)" : ((p % 12) + 12) % 12 === 0 ? "rgba(255,255,255,0.045)" : k % 2 ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.03)";
        g.fillRect(MR_KEYS, y, G.W - MR_KEYS, G.RH - 1);
        g.fillStyle = p === 0 ? col : "rgba(236,236,238,0.42)"; g.font = "600 9px system-ui, sans-serif"; g.textAlign = "right"; g.textBaseline = "middle";
        if (p === 0 || p % 2 === 0 || G.RH >= 13) g.fillText(p === 0 ? "0" : (p > 0 ? "+" : "") + p, MR_KEYS - 6, y + G.RH / 2);
      }
      if (!MR_NEW) for (let k = 0; k <= G.w.m; k++) { const s = G.w.a + k; g.fillStyle = s % 16 === 0 ? "rgba(255,255,255,0.22)" : s % 4 === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.035)"; g.fillRect(Math.round(G.X(s)), 0, 1, G.rh); }
      // the strip: 100 line
      const vy0 = G.rh + 4, vh = G.H - vy0 - 2, vY = (v) => vy0 + vh - (v / 127) * vh;
      g.fillStyle = "rgba(255,255,255,0.035)"; g.fillRect(MR_KEYS, vy0, G.W - MR_KEYS, vh);
      g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(MR_KEYS, Math.round(vY(100)), G.W - MR_KEYS, 1);
      g.save(); g.beginPath(); g.rect(MR_KEYS, 0, G.W - MR_KEYS, G.H); g.clip();
      const ns = mrNotes(), pk = mrPicked(), spb = 0.25;
      for (let q = 0; q < ns.length; q++) {
        const nt = ns[q], st = nt.st, x = G.X(nt.x), w = Math.max(4, nt.len * G.cw - 2), y = G.Y(st.t || 0) - G.RH / 2 + 1, h = G.RH - 2;
        if (x > G.W || x + w < MR_KEYS) continue;
        const isPk = pk && pk.line === nt.line && pk.i === nt.i, c = st.g ? ACID : col, dim = mr.adv ? 0.55 : 1;
        // slide: a line from the note before into this one
        if (st.g) {
          const pv = ns.slice(0, q).reverse().find((o) => o.x < nt.x - 1e-6);
          if (pv) { const py = G.Y(pv.st.t || 0), sx = Math.max(G.X(pv.x) + 4, x - G.cw * 0.9); g.strokeStyle = ACID; g.lineWidth = 2; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(sx, py); g.bezierCurveTo(x - G.cw * 0.3, py, x - G.cw * 0.4, G.Y(st.t || 0), x + 2, G.Y(st.t || 0)); g.stroke(); }
        }
        if (MR_NEW) mrNoteNew(g, x, y, w, h, c, st.v || 100, isPk, dim);
        else {
        g.globalAlpha = dim * 0.35; g.fillStyle = c; g.fillRect(x, y, w, h);
        g.globalAlpha = dim; g.fillRect(x, y, 3, h);
        g.strokeStyle = isPk ? "#fff" : c; g.lineWidth = isPk ? 1.6 : 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        if (st.l > 0) { g.fillStyle = isPk ? "#fff" : c; g.fillRect(x + w - 3, y + 2, 2, h - 4); }   // a set hold shows its end notch
        }
        if (st.ft && h >= 10) { g.globalAlpha = 1; g.fillStyle = "#fff"; g.font = "600 8px system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText((st.ft > 0 ? "+" : "") + st.ft + "c", x + 6, y + h / 2); }
        // ADVANCED: the pitch line and the wobble, on top
        if (st.bend || st.wob) {
          const lenB = nt.len * spb, m = Math.max(8, Math.round(w / 2));
          g.globalAlpha = 1; g.strokeStyle = ACID; g.lineWidth = mr.adv ? 2 : 1.2; g.beginPath();
          for (let k = 0; k <= m; k++) { const tb = (k / m) * lenB, py = G.Y((st.t || 0) + bendAtB(st, tb) + wobAtB(st, tb, lenB)); k ? g.lineTo(x + (k / m) * w, py) : g.moveTo(x, py); }
          g.stroke();
          if (mr.adv && st.bend) for (const B of st.bend) { const px = x + (B[0] / spb) * G.cw, py = G.Y((st.t || 0) + B[1]); g.fillStyle = "#17171a"; g.beginPath(); g.arc(px, py, 3.6, 0, Math.PI * 2); g.fill(); g.strokeStyle = ACID; g.lineWidth = 1.6; g.stroke(); }
        }
        // how hard: a bar in the strip (over 100 = red-orange on top)
        const v = st.v, bx = Math.round(x), bw = Math.max(3, Math.min(6, G.cw * 0.3));
        g.globalAlpha = 1; g.fillStyle = isPk ? "#fff" : col; g.fillRect(bx, vY(Math.min(v, 100)), bw, vy0 + vh - vY(Math.min(v, 100)));
        if (v > 100) { const gr = g.createLinearGradient(0, vY(100), 0, vY(127)); gr.addColorStop(0, OVER); gr.addColorStop(1, "#FF2020"); g.fillStyle = gr; g.fillRect(bx, vY(v), bw, vY(100) - vY(v)); }
        g.fillRect(bx - 1, vY(v) - 1, bw + 2, 2);
      }
      g.restore(); g.globalAlpha = 1;
      g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(MR_KEYS - 1, 0, 1, G.H);
    }
    // where a press is: a note (body, its end, a pitch point), the strip, or empty roll
    function mrAt(e) {
      const r = mrBody.getBoundingClientRect(), k = mrBody.offsetWidth ? r.width / mrBody.offsetWidth : 1, G = mrGeo();
      const x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, out = { x, y, G, f: G.F(x), p: G.P(y), vel: y > G.rh + 2 };
      if (x < MR_KEYS) return out;
      const ns = mrNotes();
      if (out.vel) { let best = null, bd = 10; for (const nt of ns) { const d = Math.abs(G.X(nt.x) + 2 - x); if (d < bd) { bd = d; best = nt; } } out.note = best; return out; }
      for (let q = ns.length - 1; q >= 0; q--) {
        const nt = ns[q], nx = G.X(nt.x), w = Math.max(4, nt.len * G.cw - 2), ny = G.Y(nt.st.t || 0) - G.RH / 2;
        if (mr.adv && nt.st.bend) for (let j = 0; j < nt.st.bend.length; j++) { const B = nt.st.bend[j]; if (Math.hypot(nx + (B[0] / 0.25) * G.cw - x, G.Y((nt.st.t || 0) + B[1]) - y) < 7) { out.note = nt; out.point = j; return out; } }
        if (x >= nx && x <= nx + w && y >= ny && y <= ny + G.RH) { out.note = nt; out.edge = !mr.adv && x > nx + w - 6 && w > 12; return out; }
      }
      return out;
    }
    const mrHear = (st) => { try { if (ctx.hitUnique) ctx.hitUnique(mr.slot, st.v || 100, { tune: st.t || 0 }); else hit(mr.slot, st.v); } catch (e) { /* no engine */ } };
    // put a hit at step ni (+ offset no): its own line if that step is free there, else another of the pad's lines, else a new one
    function mrPlaceHit(obj, from, ni, prefer) {
      const slot = mr.slot, tryLine = (ln) => { const a = arrOf(slot, ln); return !(a[ni] && a[ni].v) || a[ni] === obj; };
      let ln = prefer != null && tryLine(prefer) ? prefer : -1;
      if (ln < 0) for (let k = 0; k <= linesOf(slot).length; k++) if (tryLine(k)) { ln = k; break; }
      if (ln < 0) ln = addLine(slot);
      if (from) { const a0 = arrOf(slot, from.line); if (a0[from.i] === obj) a0[from.i] = { v: 0, r: 1 }; }
      arrOf(slot, ln)[ni] = obj; syncSubRows();
      return { line: ln, i: ni };
    }
    function mrSlide(nt, on) {
      const ns = mrNotes(), pv = ns.filter((o) => o.x < nt.x - 1e-6).pop();
      if (!on) { delete nt.st.g; return; }
      nt.st.g = true;
      if (pv) {
        if (pv.line !== nt.line) { const at = mrPlaceHit(nt.st, nt, nt.i, pv.line); nt.line = at.line; }
        if (pv.st.l > 0 && pv.x + pv.st.l < nt.x) pv.st.l = Math.round((nt.x - pv.x) * 1000) / 1000;   // a held note reaches the slide
      }
      if (mr.pick && mr.pick.i === nt.i) mr.pick.line = nt.line;
    }
    function mrOpenMenu(nt, e) {
      const ns = mrNotes(), nx = ns.find((o) => o.x > nt.x + 1e-6), r = mrBody.getBoundingClientRect(), k = mrBody.offsetWidth ? r.width / mrBody.offsetWidth : 1;
      mrMenu.innerHTML = ""; mrMenu.hidden = false;
      const item = (label, on, fn) => { const b = el("button", on ? "kd-on" : "", label + (on ? " \u2713" : "")); b.onclick = (ev) => { ev.stopPropagation(); mrMenu.hidden = true; fn(); mrCommit(); }; mrMenu.append(b); };
      item("Slide in", !!nt.st.g, () => mrSlide(nt, !nt.st.g));
      if (nx) item("Slide out", !!nx.st.g, () => mrSlide(nx, !nx.st.g));
      item("Remove", false, () => mrDelete(nt));
      mrMenu.style.left = clamp((e.clientX - r.left) / k, 0, mrBody.offsetWidth - 110) + "px"; mrMenu.style.top = clamp((e.clientY - r.top) / k + 6, 0, mrBody.offsetHeight - 90) + "px";
    }
    function mrDelete(nt) { arrOf(mr.slot, nt.line)[nt.i] = { v: 0, r: 1 }; if (mr.pick && mr.pick.i === nt.i && mr.pick.line === nt.line) mr.pick = null; if (pick && pick.slot === mr.slot) pick = null; }
    // a pad's MIDI made into a melody (any note off the sound's own note) follows the song key from now on; back to
    // only the sound's own note = it stays put again (Eman, 14 Nov; followKey below)
    function mrMel() {
      if (!mr || window.KD_KEYFOLLOW_OFF) return;
      const mel = mrNotes().some((nt) => (nt.st.t || 0) !== 0);
      if (mel) { S.mel = S.mel || {}; if (S.mel[mr.slot] == null) S.mel[mr.slot] = songKey().tonic; }
      else if (S.mel) delete S.mel[mr.slot];
    }
    function mrCommit() { if (!mr) return; mrMel(); if (pruneLines()) layoutGrid(); if (mr.pick && !mrPicked()) mr.pick = null; ringChanged(mr.slot, true); mrHead(); mrDraw(); }
    let mrDrag = null;
    mrBody.addEventListener("contextmenu", (e) => e.preventDefault());
    mrBody.addEventListener("pointerdown", (e) => {
      if (!mr || e.target.closest(".kb-mmenu")) return;
      mrMenu.hidden = true; e.preventDefault(); e.stopPropagation();
      const a = mrAt(e), nt = a.note, G = a.G;
      if (a.x < MR_KEYS) return;
      if (e.button === 2) {   // right-click: a pitch point off, the wobble off, or the note away
        if (!nt) return;
        if (mr.adv && a.point > 0) nt.st.bend.splice(a.point, 1);
        else if (mr.adv && mr.tool === "wobble" && nt.st.wob) delete nt.st.wob;
        else if (mr.adv && mr.tool === "pitch" && nt.st.bend) delete nt.st.bend;
        else if (!a.vel) mrDelete(nt);
        mrCommit(); return;
      }
      mrBody.setPointerCapture(e.pointerId);
      if (a.vel) { if (nt) { mr.pick = { line: nt.line, i: nt.i }; mrDrag = { kind: "vel", nt, y0: a.y, v0: nt.st.v }; mrHead(); mrDraw(); } return; }
      if (nt) {
        mr.pick = { line: nt.line, i: nt.i }; setPick(mr.slot, nt.i, nt.line);
        if (mr.adv) {
          if (a.point != null) mrDrag = { kind: "point", nt, j: a.point };
          else if (mr.tool === "pitch") { const tb = clamp((a.f - nt.x) * 0.25, 0, nt.len * 0.25), B = nt.st.bend || (nt.st.bend = [[0, 0]]); let j = B.findIndex((p) => p[0] > tb); if (j < 0) j = B.length; if (tb < 0.01 && B.length) j = 0; else B.splice(j, 0, [tb, B.length ? bendAtB(nt.st, tb) : 0]); mrDrag = { kind: "point", nt, j }; }
          else if (mr.tool === "fine") mrDrag = { kind: "fine", nt, y0: a.y, v0: nt.st.ft || 0 };
          else if (mr.tool === "wobble") { if (!nt.st.wob) nt.st.wob = { d: 0.5, r: 4, sh: 0, f: 0 }; mrDrag = { kind: "wob", nt, x0: a.x, y0: a.y, d0: nt.st.wob.d, r0: MR_RATES.indexOf(nt.st.wob.r) }; }
        } else if (a.edge) mrDrag = { kind: "len", nt };
        else { mrDrag = { kind: "move", nt, grab: a.f - nt.x, t0: nt.st.t || 0, p0: Math.round(a.p), x0: a.x, y0: a.y, pending: true }; mrHear(nt.st); }
        mrHead(); mrDraw(); return;
      }
      if (mr.adv) return;
      // empty: a new note there, then it moves with the hand
      const n = 16 * S.bars, f = clamp(e.metaKey || e.ctrlKey ? fineSnap(a.f) : Math.floor(a.f), 0, n - 1 + 2 / 3), ni = Math.floor(f + 1e-6), no = Math.round((f - ni) * 1000) / 1000;
      const t = clamp(Math.round(a.p), MR_LO, MR_HI), st = { v: 100, r: 1 }; if (t) st.t = t; if (no) st.o = no;
      const at = mrPlaceHit(st, null, ni, 0), nn = { line: at.line, i: ni, st, x: f, len: 1 };
      mr.pick = { line: at.line, i: ni }; mrHear(st); changed(mr.slot, false);
      mrDrag = { kind: "move", nt: nn, grab: a.f - f, t0: t, p0: t, x0: a.x, y0: a.y, made: true };
      mrHead(); mrDraw();
    });
    mrBody.addEventListener("pointermove", (e) => {
      if (!mr || !mrDrag) return;
      const d = mrDrag, a = mrAt(e), G = a.G, st = d.nt.st;
      if (d.kind === "vel") { let v = clamp(Math.round(d.v0 - (a.y - d.y0)), 1, 127); if (Math.abs(v - 100) <= 4) v = 100; st.v = v; hint(`${LABEL[mr.slot]}: ${v}`); }
      else if (d.kind === "len") { const end = e.metaKey || e.ctrlKey ? fineSnap(a.f) : Math.round(a.f); st.l = Math.max(0.25, Math.round((end - d.nt.x) * 1000) / 1000); }
      else if (d.kind === "fine") { st.ft = clamp(Math.round(d.v0 - (a.y - d.y0) * 1.5), -100, 100); if (!st.ft) delete st.ft; hint(`${LABEL[mr.slot]}: ${(st.ft || 0) > 0 ? "+" : ""}${st.ft || 0} cents`); }
      else if (d.kind === "wob") { const w = st.wob; w.d = clamp(+(d.d0 - (a.y - d.y0) * 0.03).toFixed(2), 0.05, 12); w.r = MR_RATES[clamp((d.r0 < 0 ? 4 : d.r0) + Math.round((a.x - d.x0) / 28), 0, MR_RATES.length - 1)]; }
      else if (d.kind === "point") {
        const B = st.bend; if (!B) return;
        const lenB = d.nt.len * 0.25, s = clamp(+(a.p - (st.t || 0)).toFixed(2), -24, 24);
        const lo = d.j > 0 ? B[d.j - 1][0] : 0, hi = d.j + 1 < B.length ? B[d.j + 1][0] : lenB;
        B[d.j] = [d.j === 0 ? 0 : +clamp((a.f - d.nt.x) * 0.25, lo, hi).toFixed(4), Math.abs(s - Math.round(s)) < 0.12 ? Math.round(s) : s];
        hint(`${B[d.j][1] > 0 ? "+" : ""}${B[d.j][1]} st`);
      } else if (d.kind === "move") {
        if (d.pending && Math.hypot(a.x - d.x0, a.y - d.y0) < 4) return; d.pending = false;
        const n = 16 * S.bars, fine = e.metaKey || e.ctrlKey, f = clamp(fine ? fineSnap(a.f - d.grab) : Math.round(a.f - d.grab), 0, n - 1 + (fine ? 2 / 3 : 0));
        const ni = Math.floor(f + 1e-6), no = Math.round((f - ni) * 1000) / 1000, t = clamp(d.t0 + Math.round(a.p) - d.p0, MR_LO, MR_HI);
        if (t !== (st.t || 0)) { if (t) st.t = t; else delete st.t; mrHear(st); }
        if (ni !== d.nt.i) { const at = mrPlaceHit(st, d.nt, ni, d.nt.line); d.nt.line = at.line; d.nt.i = ni; mr.pick = { line: at.line, i: ni }; }
        if (no) st.o = no; else delete st.o;
        d.nt.x = f; d.moved = true;
      }
      changed(mr.slot, false); mrHead(); mrDraw();
    });
    const mrUp = () => { if (!mrDrag) return; const d = mrDrag; mrDrag = null; hint(""); if (d.kind === "move" && d.pending && !d.made) { renderPick(); return; } mrCommit(); };
    mrBody.addEventListener("pointerup", mrUp); mrBody.addEventListener("pointercancel", mrUp);
    mrBody.addEventListener("dblclick", (e) => {
      if (!mr) return; const a = mrAt(e), nt = a.note; if (!nt) return;
      if (a.vel) { nt.st.v = 100; mrCommit(); return; }
      if (mr.adv) { if (mr.tool === "fine") { delete nt.st.ft; mrCommit(); } return; }
      mrOpenMenu(nt, e);
    });
    mrBody.addEventListener("wheel", (e) => { if (!mr) return; e.preventDefault(); e.stopPropagation(); mr.top += e.deltaY > 0 ? -1 : 1; mrDraw(); }, { passive: false });
    // Deep debug 16 Nov: this page-wide listener was never taken off, so every time KILLDRUM was opened one more stayed
    // behind, each holding on to a whole closed KILLDRUM window. destroy() now removes it. KD_MRDOC_OLD = old (never removed).
    const onDocMr = (e) => { if (mr && !mrMenu.hidden && !mrMenu.contains(e.target)) mrMenu.hidden = true; };
    document.addEventListener("pointerdown", onDocMr, true);
    // the dock knobs (ADVANCED): Depth drags, Rate and Shape click on, Reset clears the picked note
    for (const k of mrEl.querySelectorAll(".kb-mk[data-k]")) {
      k.onpointerdown = (e) => {
        const n = mrPicked(); if (!n || !n.st.wob) return; const w = n.st.wob, K = k.dataset.k;
        if (K === "r") { w.r = MR_RATES[(MR_RATES.indexOf(w.r) + 1) % MR_RATES.length]; mrCommit(); return; }
        if (K === "sh") { w.sh = ((w.sh | 0) + 1) % 4; mrCommit(); return; }
        const y0 = e.clientY, d0 = w.d; k.setPointerCapture(e.pointerId);
        k.onpointermove = (m) => { w.d = clamp(+(d0 - (m.clientY - y0) * 0.03).toFixed(2), 0.05, 12); mrHead(); mrDraw(); };
        k.onpointerup = () => { k.onpointermove = k.onpointerup = null; mrCommit(); };
      };
    }
    mrEl.querySelector(".kb-mreset").onclick = () => { const n = mrPicked(); if (!n) return; delete n.st.bend; delete n.st.wob; delete n.st.ft; mrCommit(); };
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { mrPlace(); mrDraw(); }).observe(stage);
    // the song key changed while this is open: melody pads move with it (the engine did the same to the saved copy)
    const keyWatch = setInterval(() => {
      if (dead) { clearInterval(keyWatch); return; }
      if (pv || !S.mel || !Object.keys(S.mel).length || window.KD_KEYFOLLOW_OFF) return;
      const moved = followKey(S, songKey().tonic), ks = Object.keys(moved); if (!ks.length) return;
      for (const x of ks) paintTrack(x);
      if (ks.includes(sel)) { renderCells(); renderPick(); }
      if (mr) { mrFit(); mrHead(); mrDraw(); }
      save(false);
    }, 600);

    // ---------------------------------------------------------------- state helpers
    function changed(slot, undo) { paintTrack(slot); save(undo); }
    function ringChanged(slot, undo) { changed(slot, undo); if (slot === sel) { renderCells(); renderPick(); } }
    function save(undo) {
      if (pv) { pv.saveWanted = true; pv.saveUndo = pv.saveUndo || !!undo; return; }   // previewing: nothing reaches the project until COMMIT
      saveUndo = saveUndo || !!undo; clearTimeout(saveT);
      saveT = setTimeout(async () => {
        saveT = 0;
        const u = saveUndo; saveUndo = false; if (local || dead) return;
        syncCur();
        let notes = []; try { notes = chainNotes(); } catch (e) { console.error(e); }
        if (soloOn) B("killDrumSolo", soloArgs(false));
        // every BAR's own notes too: a pattern on the timeline can play just one BAR (KT2_KD_CLIPBAR_OFF = old)
        let bars = null; if (!window.KT2_KD_CLIPBAR_OFF) try { bars = Object.fromEntries(S.vers.map((v) => [v.id, barNotes(v, 4 * (v.bars || 1))])); } catch (e) { bars = null; }
        const r = await B("killDrumBeatSet", { pluginId: pid, notes, beat: S, undo: u, ...(bars ? { bars } : {}) });
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
      if (!quiet) ctx.say(`${v.name} open.${S.chain.includes(id) || !window.KT2_KD_ORDER_SHOW ? "" : " It isn't in the order yet: + in Order adds it."}`);
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
        b.onclick = () => { openVer(v.id); barSel = true; if (pick) setPick(null); };
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
      item("Duplicate", () => dupVer(v.id)); item("Rename", () => renameVer(v.id, pill)); if (window.KT2_KD_ORDER_SHOW) item("Add to the order", () => { S.chain.push(v.id); renderChain(); save(true); });
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
    // The header's LOOP/TRACK and this one are one choice: when the header (or opening a pattern, which picks TRACK)
    // changes it, this switch follows, so it never shows LOOP while the song plays (Eman, 15 Nov).
    // KT2_OPEN_LOOP_OLD = no follow (old).
    const pmodeSync = setInterval(() => {
      if (dead) return clearInterval(pmodeSync);
      if (window.KT2_OPEN_LOOP_OLD) return;
      let m = pmode; try { m = localStorage.getItem(modeKey) === "full" ? "full" : "solo"; } catch (e) { /* fine */ }
      if (m !== pmode) { pmode = m; for (const b of modeSeg.querySelectorAll("button")) b.classList.toggle("kd-on", b.dataset.m === pmode); }
    }, 250);
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
    function select(slot, keepPick) { if (!keepPick && pick) { const w = pick; pick = null; paintTrack(w.slot); } const was = sel; sel = slot; try { if (ctx.select && ctx.selected() !== slot) ctx.select(slot); } catch (e) { /* fine */ } if (was && was !== slot) paintTrack(was); paintTrack(slot); if (mr && mr.slot !== slot) { mr.slot = slot; mr.pick = null; mrFit(); mrHead(); mrDraw(); } renderRows(); renderDetail(); }
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
      let pool = all.filter((x) => (FITS[slot] || [slot]).includes(x.type) && x.id !== mainId);
      // MATCHED LAYERS (Eman 14 Nov bug, V7k Take 6: "everything muted but the kick, a hi-hat still comes in random
      // spots"). It was the kick's own 4th layer in Cycle: a vinyl kick with a long hissy tail (Kick Dookie Slip,
      // noise 0.97) that sounds like a hat on every 4th kick. Layers on kick/808/snare/clap now skip sounds much
      // noisier/brighter than the main sound and favour ones that sound like it. KD_LAYER_MATCH_OLD = old picks.
      const md = (main && main.d) || {}, body = /^(kick|808|snare|clap)$/.test(slot), match = body && !window.KD_LAYER_MATCH_OLD;
      const hissy = (it) => { const d = it.d || {}; return ((d.noise || 0) - (md.noise || 0) > 0.35 && (d.bright || 0) - (md.bright || 0) > 0.35) || ((d.noise || 0) >= 0.9 && (d.bright || 0) >= 0.9 && (md.noise || 0) < 0.7); };
      if (match) { const ok = pool.filter((x) => !hissy(x)); if (ok.length >= count) pool = ok; }
      const near = (it) => { const d = it.d || {}; let q = 0; for (const k of ["bright", "noise", "decay", "low"]) if (d[k] != null && md[k] != null) q += Math.abs(d[k] - md[k]); return q; };
      pool.sort((a, b) => score(b) - score(a));
      function score(it) { let s = 0; for (const t of it.tags || []) if (tags.has(t)) s += 1; return s + R() * 2.5 - (match ? 2 * near(it) : 0); }
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
    // MOOD GENRES: with no vibe typed, the sound dice reads the genre's own sound words (Memphis = cowbell + tape,
    // Hard techno = distorted kick + rumble...). A typed vibe always wins. KD_GENRES_OLD = no genre words.
    function genreKit(k) {
      if (window.KD_GENRES_OLD || !k || (k.vibe && String(k.vibe).trim())) return k;
      const g = genres().find((x) => x.id === S.genre); return g && g.vibe ? { ...k, vibe: g.vibe } : k;
    }
    function rollSound(slot, e, seed) {  // mutates e, returns the item or null
      const L = lib(); let id = null;
      try { if (L.roll) { const r = L.roll(genreKit(ctx.kit ? ctx.kit() : null), slot, hash(seed + ":" + slot)); const x = r && r.pads && r.pads[slot]; id = typeof x === "string" ? x : x && (x.sound || x.id); } } catch (err) { /* fallback below */ }
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
      if (only || !songOn()) { S.song = null; return applyLoop(seed, only); }
      // SONG: roll a 2-bar loop the usual way, then lay it out as a song over the whole clip
      const full = S.bars, lockedFull = {}, linesFull = S.lines || {};
      for (const x of SLOTS) if (S.pads[x].lock.pattern) lockedFull[x] = S.pads[x].steps;
      S.bars = 2;
      for (const x of SLOTS) S.pads[x].steps = fit(S.pads[x].steps, 2);
      S.lines = copyLines(Object.fromEntries(Object.entries(linesFull).filter(([x]) => lockedFull[x])), 2);
      try { applyLoop(seed); } catch (e) { console.error(e); }
      const loop = stepsBySlot(), loopLines = S.lines || {};
      S.bars = full;
      let r = null;
      try { r = P().arrange({ loop, loopLines, loopBars: 2, bars: full, genre: S.genre, bpm: clip.bpm, seed, cx: cxOn() ? S.cx : 0.5, sub808: loop["808"].some((q) => q.v), sad: songCtx && songCtx.minor ? 0.75 : 0.45, locked: lockedFull }); } catch (e) { console.error(e); }
      for (const x of SLOTS) S.pads[x].steps = lockedFull[x] ? lockedFull[x] : fit(r ? r.pads[x] : loop[x], full);
      const L = {}; for (const x in linesFull) if (lockedFull[x]) L[x] = linesFull[x];
      if (r) for (const x in r.lines) if (!lockedFull[x]) L[x] = r.lines[x];
      S.lines = copyLines(L, full);
      S.song = r ? { bars: full, from: r.from, sections: r.sections } : null;
      syncSubRows();
    }
    function songSay() { return S.song ? ` Song (${S.song.from === "song" ? "laid out like an analysed song" : "a usual " + genreWord() + " layout"}): ${S.song.sections.map((x) => x.name.toUpperCase() + " " + x.bars).join(", ")}.` : ""; }
    function sectionAt(bar) { if (!S.song) return null; for (const x of S.song.sections) if (bar >= x.start && bar < x.start + x.bars) return x; return null; }
    function applyLoop(seed, only) {
      const locked = {}; for (const s of SLOTS) if (S.pads[s].lock.pattern || (only && s !== only)) locked[s] = S.pads[s].steps;
      let b = null; try { b = P().beat({ genre: S.genre, bpm: clip.bpm, bars: S.bars, seed, locked }); } catch (e) { console.error(e); b = FB.beat({ genre: S.genre, bpm: clip.bpm, bars: S.bars, seed, locked }); }
      // the rhythm brain: every roll is one rhythm (locked, or the brain's pick for the song), shaped by EXP
      if (b && b.pads && RB() && !window.KD_RHYTHM_OFF) try {
        const id = S.rhythmLock && S.rhythm ? S.rhythm : GL() ? RB().pickForGenre(brainCtx(), seed) : RB().pickFor(brainCtx(), seed);
        const sh = RB().shape(id, { seed, bars: S.bars, bpm: clip.bpm, experimental: effXp(), genre: S.genre, locked, pads: b.pads, sub: /^(trap|drill|rage|jersey)$/.test(GB()) });
        for (const s in sh.pads) if (!locked[s]) b.pads[s] = sh.pads[s];
        S.rhythm = id; S.rhythmMix = sh.info.mix || null; S.rhythmGlitch = !!sh.info.glitch;
      } catch (e) { console.error(e); }
      // FAVORITES (Eman, 10 Nov): a share of the rolls is one of Eman's favorite songs, exactly as its drum stem plays it
      // (kick, snare, hats, open hats, perc; the 808 follows that kick). Not while a rhythm is locked. KD_FAV_OFF = the old rolls.
      S.fav = null;
      if (b && b.pads && !only && FV() && !window.KD_FAV_OFF && !(S.rhythmLock && S.rhythm) && !pgG) try {   // PG MATCH: a favorite song's exact drums would ignore the sounds
        let f = FV().pick({ bpm: clip.bpm, seed });
        // GENRE LINK: in AUTO a favorite only comes up when its drums are in the picked genre's rhythms (a few tries),
        // else the genre's own rhythm plays
        if (f && GL()) { const ok = (g) => { if (!g) return false; try { const top = RB().classify(FV().toPads(g.item, g.variant, S.bars, g.stretch), { bpm: clip.bpm }); return !!top && gList().includes(top.id); } catch (e) { return false; } };
          let tries = 0; while (f && !ok(f) && tries < 4) { tries++; f = FV().pick({ bpm: clip.bpm, seed: seed + ":g" + tries, force: true }); }
          if (f && !ok(f)) f = null; }
        if (f) {
          let fp = FV().toPads(f.item, f.variant, S.bars, f.stretch);
          // a blend of two analysed patterns (killdrum-favs.js blendPads; KD_TRAIN_OFF = never)
          if (f.blend && FV().blendPads) fp = FV().blendPads(fp, FV().toPads(f.blend.item, f.blend.variant, S.bars, f.blend.stretch), f.blend.how, f.blend.seed, S.bars);
          for (const s in fp) if (!locked[s]) b.pads[s] = fp[s];
          if (!locked["808"] && b.pads["808"] && (cxOn() || b.pads["808"].some((x) => x && x.v))) b.pads["808"] = fp.kick.map((x) => (x.v ? { v: x.v, r: 1 } : { v: 0, r: 1 }));
          S.fav = { id: f.item.id, name: f.item.t, variant: f.variant, blend: f.blend ? { id: f.blend.item.id, name: f.blend.item.t, how: f.blend.how } : null };
          if (!window.KD_RHYTHM_KEEPSWING) S.swing = FV().swingOf(f.item);
        }
      } catch (e) { console.error(e); }
      const keep = {}; for (const s of SLOTS) if (!locked[s]) S.pads[s].steps.forEach((st, i) => { if (st && st.v && st.u) (keep[s] = keep[s] || []).push([i, st]); });
      for (const s of SLOTS) if (!locked[s] && b && b.pads && b.pads[s]) S.pads[s].steps = fit(b.pads[s], S.bars);
      // COMPLEXITY + 808 FIT (Eman, 15 Nov): the knob by ROLL picks how many rows play (2-3 up to 16 with extra lines)
      // and how busy they are; the 808 only comes in styles it fits (or the 808 switch). KD_CX_OFF = the old rolls.
      if (cxOn() && !only && P().shape) try {
        const lk = {}; for (const s of SLOTS) if (locked[s]) lk[s] = true;
        const r = P().shape({ pads: stepsBySlot(), lines: S.lines || {}, locked: lk, genre: S.genre, bars: S.bars, bpm: clip.bpm, seed, cx: S.cx, sub: S.sub808 });
        for (const s of SLOTS) if (!lk[s]) S.pads[s].steps = fit(r.pads[s], S.bars);
        S.lines = copyLines(r.lines, S.bars); syncSubRows();
      } catch (e) { console.error(e); }
      if (!locked["808"]) S.pads["808"].steps = slides808(S.pads["808"].steps, seed);
      for (const s of SLOTS) if (!locked[s] && ogOn(S.pads[s])) S.pads[s].steps = offGrid(S.pads[s].steps, s, seed);
      // PG MATCH: kick / 808 onto the strong low hits of the sounds (never onto the snare / clap), swing like them
      if (pgG && !only) {
        const back = (j) => (S.pads.snare.steps[j] && S.pads.snare.steps[j].v) || (S.pads.clap.steps[j] && S.pads.clap.steps[j].v);
        for (const s of ["kick", "808"]) if (!locked[s] && S.pads[s].steps.some((x) => x && x.v)) S.pads[s].steps = KT2PGMatch.fitKick(S.pads[s].steps, pgG, back);
        if (pgG.swing >= 0.08 && !(S.rhythmLock && S.rhythm)) S.swing = pgG.swing;
      }
      for (const s in keep) for (const [i, st] of keep[s]) if (i < S.pads[s].steps.length) S.pads[s].steps[i] = st; // unique hits stay where they are
    }
    // Trap, drill and rage 808s move: some notes jump to a fifth/octave/minor third and glide in
    // (seeded, so the same roll gives the same line). Other styles keep the 808 on its root.
    function slides808(steps, seed) {
      if (!/^(trap|drill|rage)$/.test(GB())) return steps;
      const R = rng(seed + ":808"), JUMPS = [12, 7, 5, 3, -2, -5], amt = GB() === "drill" ? 0.45 : 0.3;
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
      const inR = patterns && S.fav && S.fav.blend ? ` ${S.fav.name} ${(FV().BLEND_SAY || {})[S.fav.blend.how] || "mixed with"} ${S.fav.blend.name}.` : patterns && S.fav ? ` Exact drums from ${S.fav.name}${S.fav.variant ? " (part " + (S.fav.variant + 1) + ")" : ""}.` : patterns && S.rhythm && RB() && !window.KD_RHYTHM_OFF ? ` In ${rhythmName(S.rhythm)}${S.rhythmMix ? " mixed with " + rhythmName(S.rhythmMix) : S.rhythmGlitch ? ", glitched" : ""}${S.rhythmLock ? " (locked)" : ""}.` : "";
      ctx.say(`${sounds && patterns ? "New " + genreWord() + " beat" : sounds ? "New sounds" : "New " + genreWord() + " patterns"}.${kept.length ? " " + list(kept) + " kept." : ""}${patterns ? songSay() : ""}${patterns && S.song ? "" : inR}`);
      if (patterns) { notifyRhythm(); fetchCtx(); }
    }
    function rollOne(slot, sound, pattern) {
      const seed = newSeed(); let item = null;
      clearUnique(slot);
      if (sound) { const e = ctx.getKit(); item = rollSound(slot, e, seed); const fx = rollFx(e, [slot]); if (item || fx) { kitE = e; ctx.setKit(e, true); } }
      if (pattern) { let st = null; try { st = P().pad(slot, { genre: S.genre, bpm: clip.bpm, bars: S.bars, seed, beat: stepsBySlot() }); } catch (e) { console.error(e); st = FB.pad(slot, { genre: S.genre, bars: S.bars, seed }); }
        // kick / 808 / snare / clap stay in the beat's rhythm (the dice gives another way of playing it)
        if (S.rhythm && RB() && !window.KD_RHYTHM_OFF && /^(kick|808|snare|clap)$/.test(slot)) try { const locked = {}; for (const x of SLOTS) if (x !== slot) locked[x] = true; const sh = RB().shape(S.rhythm, { seed, bars: S.bars, bpm: clip.bpm, experimental: Math.max(0.3, S.xp || 0), genre: S.genre, locked, pads: stepsBySlot(), sub: /^(trap|drill|rage|jersey)$/.test(GB()) }); if (sh.pads[slot]) st = sh.pads[slot]; } catch (e) { console.error(e); }
        if (st && S.song && songOn() && !window.KD_SONG_OFF) {   // song: a new 2-bar part for this row, in the bars it played before
          let two = null; try { two = P().pad(slot, { genre: S.genre, bpm: clip.bpm, bars: 2, seed, beat: Object.fromEntries(SLOTS.map((x) => [x, fit(S.pads[x].steps, 2)])) }); } catch (e) { two = null; }
          if (two) { const old = S.pads[slot].steps, had = old.some((q) => q.v), out = [];
            for (let bb = 0; bb < S.bars; bb++) { const sec = sectionAt(bb), on = had ? old.slice(bb * 16, bb * 16 + 16).some((q) => q.v) : !sec || sec.energy >= 5;
              for (let i = 0; i < 16; i++) out.push(on ? { ...two[(bb % 2) * 16 + i] } : { v: 0, r: 1 }); }
            st = out; }
        }
        if (st) S.pads[slot].steps = slot === "808" ? slides808(fit(st, S.bars), seed) : fit(st, S.bars);
        if (st && ogOn(S.pads[slot])) S.pads[slot].steps = offGrid(S.pads[slot].steps, slot, seed); }
      select(slot); paintTrack(slot); renderRows(); renderDetail(); save(true); hit(slot);
      ctx.say(sound && pattern ? `New ${LABEL[slot].toLowerCase()}${ogOn(S.pads[slot]) ? ", off the grid" : ""}.` : sound ? (item ? `${LABEL[slot]}: ${item.name}.` : "No other sound for that pad.") : `New ${LABEL[slot].toLowerCase()} pattern${ogOn(S.pads[slot]) ? ", off the grid" : ""}.`);
    }
    // ---------------------------------------------------------------- the rhythm brain (ui/killdrum-rhythms.js)
    let songCtx = null;
    async function fetchCtx() { const r = await B("killDrumContext", { pluginId: pid }); if (r && r.ok) songCtx = r; return songCtx; }
    function GB() { const p = P(); return p && p.baseOf ? p.baseOf(S.genre) || S.genre : S.genre; }   // a new genre's older parent (808 / clap rules)
    function gList() { const K = RB(); return K && K.genreRhythms ? K.genreRhythms(S.genre) : []; }
    function GL() { return !window.KD_GENRE_LINK_OFF && gList().length > 0; }
    function brainCtx() {
      const c = songCtx || {}, words = (c.words || []).slice();
      if (pgG && pgG.mask) return { bpm: clip.bpm, genre: S.genre, words, onsets: (c.onsets || 0) | pgG.mask, density: c.density != null ? c.density : pgG.density, minor: c.minor, has: { ...(c.has || {}), audio: true } };   // PG MATCH: the sounds' accents
      return { bpm: clip.bpm, genre: S.genre, words, onsets: c.onsets || 0, density: c.density, minor: c.minor, has: c.has || {} };
    }
    const rhythmName = (id) => { const r = id && RB() && RB().byId(id); return r ? r.name : ""; };
    function notifyRhythm() { try { document.dispatchEvent(new CustomEvent("killdrum-rhythm", { detail: rhythmState() })); } catch (e) { /* no DOM */ } renderBar(); }
    function rhythmState() { return { rhythm: S.rhythm || null, lock: !!S.rhythmLock, xp: S.xp || 0, mix: S.rhythmMix || null, glitch: !!S.rhythmGlitch, bpm: clip.bpm, genre: S.genre, ctx: songCtx }; }
    // press a rhythm: the sounds stay, the unlocked patterns move into it (kick, 808, snare, clap, hats, perc)
    function setRhythm(id, quiet, noSave) {
      const K = RB(); const r = K && K.byId(id); if (!r) return;
      S.rhythm = id; S.seed = newSeed();
      const locked = {}; for (const x of SLOTS) if (S.pads[x].lock.pattern) locked[x] = true;
      let sh = null; try { sh = K.shape(id, { seed: S.seed, bars: S.bars, bpm: clip.bpm, experimental: S.xp || 0, genre: S.genre, locked, pads: stepsBySlot(), sub: /^(trap|drill|rage|jersey)$/.test(GB()) }); } catch (e) { console.error(e); return; }
      const keep = {}; for (const x of SLOTS) if (!locked[x]) S.pads[x].steps.forEach((st, i) => { if (st && st.v && st.u) (keep[x] = keep[x] || []).push([i, st]); });
      for (const x in sh.pads) if (!locked[x] && sh.pads[x]) S.pads[x].steps = x === "808" ? slides808(fit(sh.pads[x], S.bars), S.seed) : fit(sh.pads[x], S.bars);
      for (const x in keep) for (const [i, st] of keep[x]) if (i < S.pads[x].steps.length) S.pads[x].steps[i] = st;
      S.rhythmMix = sh.info.mix || null; S.rhythmGlitch = !!sh.info.glitch;
      // the feel: a swung rhythm sets the swing, a straight one clears it, triplet ones carry their own timing
      if (!window.KD_RHYTHM_KEEPSWING) S.swing = r.grid === 12 ? 0 : r.swing ? +Math.min(0.6, (r.swing - 0.5) / 0.17 * 0.6).toFixed(2) : 0;
      renderAll(); if (!noSave) save(true); notifyRhythm();
      if (!quiet) ctx.say(`${r.name}. ${r.about}${S.rhythmMix ? " Mixed with " + rhythmName(S.rhythmMix) + "." : ""}`);
    }
    function setRhythmLock(on) { if (on && !S.rhythm) return; S.rhythmLock = !!on; save(true); notifyRhythm(); ctx.say(S.rhythmLock ? `${rhythmName(S.rhythm)} locked: every roll stays in it.` : "Rhythm unlocked: the dice picks the rhythm again."); }
    function setXp(v) { S.xp = clamp(+v || 0, 0, 1); renderBar(); save(true); notifyRhythm(); }
    function toggleLock(slot) {
      const l = S.pads[slot].lock, on = !(l.sound && l.pattern); l.sound = on; l.pattern = on;
      renderRows(); renderDetail(); save(true); ctx.say(on ? `${LABEL[slot]} locked: ROLL leaves it alone.` : `${LABEL[slot]} unlocked.`);
    }
    function setOffGrid(slot, on) {
      if (window.KD_OFFGRID_OFF) return;
      if (!window.KD_ROWMIDI_OFF) { S.offgrid = !!on; renderBar(); save(true); ctx.say(on ? "Off-grid: rolls also put hits between the steps." : "Rolls back on the grid."); return; }
      S.pads[slot].offgrid = !!on;
      renderRows(); save(true);
      ctx.say(on ? `${LABEL[slot]} off-grid: its pattern dice now puts hits between the steps.` : `${LABEL[slot]} back on the grid for new rolls.`);
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
    function setBars(n) { if (S.bars === n) return; S.bars = n; page = 0; scrollA = 0; if (n > 2 && S.view !== "rows" && !window.KD_BARS_RING) setView("rows"); for (const s of SLOTS) S.pads[s].steps = fit(S.pads[s].steps, n); S.lines = copyLines(S.lines, n); buildRing(); renderBar(); syncCur(); renderChain(); growClip(n).then(() => save(true)); ctx.say(n > 1 ? `${n} bars, ${16 * n} steps.` : "One bar."); }
    // A beat longer than its drum clip (128 steps in a 4-bar clip) had its last bars cut off in the song:
    // the clip grows to the beat's length (bug check, 7 Nov). KD_BARS_NO_GROW = true: the clip stays as it is.
    async function growClip(n) {
      if (window.KD_BARS_NO_GROW || local || !clip || !clip.clipLength) return;
      const bar = 240 / (clip.bpm || 120), want = n * bar;
      if (clip.clipLength >= want - 1e-3) return;
      const U = typeof ui !== "undefined" ? ui : window.ui, me = U && U.state && U.state.tracks.flatMap((t) => t.clips || []).find((c) => (c.plugins || []).some((p) => p.id === pid));
      if (!me) return;
      const ok = await B("setClipBounds", { clipId: me.id, start: me.start, length: want });
      if (ok && !ok.error) { clip.clipLength = want; clip.beats = n * 4; }
    }
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
      if (k === "xp" && (!RB() || window.KD_RHYTHM_OFF)) elm.hidden = true;
      const show = () => (b.textContent = Math.round((S[k] || 0) * 100) + "%");
      elm._show = show;
      elm.addEventListener("pointerdown", (e) => { e.preventDefault(); elm.setPointerCapture(e.pointerId); d = { y: e.clientY, v: S[k] || 0 }; });
      elm.addEventListener("pointermove", (e) => { if (!d) return; const v = clamp(d.v + (d.y - e.clientY) / 160, 0, max); if (v !== S[k]) { S[k] = +v.toFixed(3); show(); save(false); } });
      const up = () => { if (!d) return; d = null; save(true); if (k === "xp") notifyRhythm(); };
      elm.addEventListener("pointerup", up); elm.addEventListener("pointercancel", up);
      elm.addEventListener("dblclick", () => { S[k] = 0; show(); save(true); if (k === "xp") notifyRhythm(); });
      show();
    }
    let pop = null;
    function closeGenres() { if (pop) { pop.remove(); pop = null; document.removeEventListener("pointerdown", onDoc, true); } }
    function onDoc(e) { if (pop && !pop.contains(e.target) && e.target !== genreBtn) closeGenres(); }
    function openGenres() {
      if (pop) return closeGenres();
      const MO = P().MOODS || [];
      if (MO.length && !window.KD_GENRES_OLD) return openMoods(MO);
      pop = el("div", "kb-pop");
      for (const g of genres()) { const b = el("button", "kb-popi" + (g.id === S.genre ? " kb-on" : ""), `<span>${g.label}</span><em>${g.bpm ? g.bpm[0] + "–" + g.bpm[1] : ""}</em>`); b.onclick = () => { closeGenres(); setGenre(g.id); }; pop.append(b); }
      const rr = root.getBoundingClientRect(), br = genreBtn.getBoundingClientRect();
      pop.style.left = br.left - rr.left + "px"; pop.style.top = br.bottom - rr.top + 4 + "px";
      root.append(pop); setTimeout(() => document.addEventListener("pointerdown", onDoc, true), 0);
    }

    // MOOD GENRES (Eman, 15 Nov): the genre list as mood pages. Left: the moods (VILLAINCORE, MOSH PIT...), right:
    // the genres of the open mood (it opens on the current genre's mood). KD_GENRES_OLD = the old flat list.
    function openMoods(MO) {
      pop = el("div", "kb-pop kb-moods");
      const left = el("div", "kb-mleft"), right = el("div", "kb-mright"); pop.append(left, right);
      const cur = genres().find((x) => x.id === S.genre);
      let open = (cur && cur.mood) || MO[0].id;
      const paint = () => {
        left.innerHTML = ""; right.innerHTML = "";
        for (const m of MO) {
          const n = genres().filter((g) => g.mood === m.id).length; if (!n) continue;
          const b = el("button", "kb-mood" + (m.id === open ? " kb-mopen" : "") + (cur && cur.mood === m.id ? " kb-mcur" : ""), `<span>${m.title}</span><em>${n}</em>`);
          b.dataset.mood = m.id; b.onclick = (e) => { e.stopPropagation(); open = m.id; paint(); }; left.append(b);
        }
        for (const g of genres().filter((x) => x.mood === open)) {
          const b = el("button", "kb-popi" + (g.id === S.genre ? " kb-on" : ""), `<span>${g.label}</span><em>${g.bpm ? g.bpm[0] + "\u2013" + g.bpm[1] : ""}</em>`);
          b.dataset.genre = g.id; if (g.feel) b.title = g.feel; b.onclick = () => { closeGenres(); setGenre(g.id); }; right.append(b);
        }
      };
      paint();
      const rr = root.getBoundingClientRect(), br = genreBtn.getBoundingClientRect();
      pop.style.left = Math.max(0, Math.min(br.left - rr.left, rr.width - 400)) + "px"; pop.style.top = br.bottom - rr.top + 4 + "px";
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
      const g = GB(), e = kitE || {}, pads = Object.values(e.kitPad || {});
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
        const q = b.beat; S.bars = barsIn(q.bars); S.swing = +q.swing || 0; S.humanize = +q.humanize || 0; if (b.genre) S.genre = b.genre;
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
      const bars = usePat ? normBars(q.bars) : S.bars;
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
      const n = 16 * normBars(barsIn), pads = padsIn || {}, rowsOn = SLOTS.filter((x) => (pads[x] || []).some((st) => st && st.v));
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
    // AUTOMATION (9 Nov overnight test: KILLDRUM had no lines at all). The small A on each bar and effect:
    // a line for it under the pattern, for the picked pad ("kd.<note>.<bar>", "kd.<note>.fx.<kind>", v = the
    // bar's position). The song plays it per hit (playground.js kdAutoLanes). A purple A = that pad has a line.
    // KD_AUTO_OFF = no A buttons (old).
    const KDA = () => !window.KD_AUTO_OFF && typeof automateNow === "function" && typeof findPlugin === "function";
    const kdHost = () => { const f = findPlugin(pid); return f && f.t; };
    const kdHas = (param) => { const t = KDA() && kdHost(); return !!(t && (t.automation || []).some((l) => l.target && l.target.param === param)); };
    function aMark(elm, paramOf, labelOf, valueOf) {
      if (!KDA()) return;
      const a = el("i", "tm-abtn kd-abtn", "A");
      a.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); });
      a.addEventListener("dblclick", (e) => e.stopPropagation());
      a.addEventListener("click", (e) => {
        e.stopPropagation(); e.preventDefault();
        const t = kdHost(); if (!t || !ui.state || !ui.state.canAutomate) return;
        Promise.resolve(automateNow(t, [{ target: { type: "synth", param: paramOf() }, label: labelOf(), value: valueOf() }])).then(() => setTimeout(paintMarks, 300));
      });
      elm.insertBefore(a, elm.querySelector("b"));
      elm.__a = { a, paramOf, labelOf };
    }
    function paintMarks() {
      let all; try { all = [...Object.values(barEls), ...Object.values(fxEls)]; } catch (e) { all = Object.values(barEls); }   // fxEls is made after the bars
      for (const elm of all) {
        const m = elm.__a; if (!m) continue;
        const prm = m.paramOf(); m.a.dataset.autoParams = prm; m.a.title = "Automate " + m.labelOf() + ": a line for it under the pattern";
        m.a.classList.toggle("kd-ahas", kdHas(prm)); m.a.hidden = !!uniq();
      }
    }
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
      if (PNEW) {
        const arc = elm.querySelector(".kd-lk1"), a = (n >= 0.5 ? 0.5 : n), w = Math.abs(n - 0.5);
        arc.setAttribute("stroke-dasharray", b.mid ? `0 ${(KN_A * a).toFixed(2)} ${Math.max(0.01, KN_A * w).toFixed(2)} ${KN_C.toFixed(2)}` : `${(KN_A * n).toFixed(2)} ${KN_C.toFixed(2)}`);
        elm.querySelector("b").textContent = b.fmt(v).replace(/ (st|dB)$/, ""); return;
      }
      if (b.mid) { elm.style.setProperty("--a", (n >= 0.5 ? 0.5 : n).toFixed(3)); elm.style.setProperty("--w", Math.abs(n - 0.5).toFixed(3)); } else elm.style.setProperty("--v", n.toFixed(3));
      elm.querySelector("b").textContent = b.fmt(v);
    }
    function renderBars() { for (const b of BARS) paintBar(b, barGet(kitE, sel, b)); paintMarks(); }
    function buildBars(host) {
      for (const b of BARS) {
        const elm = PNEW ? el("div", "kd-bk" + (b.mid ? " kd-mid" : ""), `<svg viewBox="0 0 34 34"><circle class="kd-lk0" cx="17" cy="17" r="13" fill="none" stroke-width="3" stroke-dasharray="${KN_A.toFixed(2)} ${KN_C.toFixed(2)}" transform="rotate(135 17 17)"/><circle class="kd-lk1" cx="17" cy="17" r="13" fill="none" stroke-width="3" transform="rotate(135 17 17)"/></svg><b></b><span>${b.label}</span>`)
          : el("div", "kd-bar" + (b.mid ? " kd-mid" : ""), `<span>${b.label}</span><b></b>`);
        elm.title = PNEW ? b.tip.replace(/left\/right/, "up/down") : b.tip; host.append(elm); barEls[b.k] = elm;
        aMark(elm, () => `kd.${NOTE_OF[sel]}.${b.k}`, () => `${LABEL[sel]} ${b.label}`, () => +((barGet(ctx.getKit ? ctx.getKit() : kitE, sel, b) - b.min) / (b.max - b.min)).toFixed(4));
        let d = null, sendT = 0, sendDue = false;
        const send = (e, undo) => { try { ctx.setKit(e, undo); } catch (err) { /* no engine */ } };
        const push = (e) => { if (sendT) { sendDue = true; return; } send(e, false); sendT = setTimeout(() => { sendT = 0; if (sendDue) { sendDue = false; push(e); } }, 33); };
        elm.addEventListener("pointerdown", (ev) => {
          if (ev.button !== 0) return; ev.preventDefault(); elm.setPointerCapture(ev.pointerId);
          const e = ctx.getKit(), v0 = barGet(e, sel, b); d = { e, slot: sel, u: !!uniq(), x: ev.clientX, y: ev.clientY, v0, v: v0, w: PNEW ? 150 : Math.max(60, elm.clientWidth) }; elm.classList.add("kd-drag");
        });
        elm.addEventListener("pointermove", (ev) => {
          if (!d) return; const v = clamp(d.v0 + ((PNEW ? d.y - ev.clientY : ev.clientX - d.x) / d.w) * (b.max - b.min) * (ev.shiftKey ? 0.25 : 1), b.min, b.max);
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
      paintMarks();
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
      aMark(elm, () => `kd.${NOTE_OF[sel]}.fx.${f.k}`, () => `${LABEL[sel]} ${f.label}`, () => { const kp = ((kitE && kitE.kitPad && kitE.kitPad[NOTE_OF[sel]]) || {}), x = (kp.fx || []).find((q) => q.kind === f.k); return x ? (x.amount != null ? x.amount : 0.5) : 0; });
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
        const ogb = r.el.querySelector(".kb-og"); if (ogb) ogb.classList.toggle("kb-lit", ogOn(p));
        const mdb = r.el.querySelector(".kb-midi"); if (mdb) mdb.classList.toggle("kb-lit", !!(mr && mr.slot === slot));
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
      const n = p.layers || 1; if (D.n) { D.n.textContent = n; D.arc.setAttribute("stroke-dasharray", `${(113.1 * (n - 1)) / 3} 150.8`); }
      if (LV2) { D.mode.textContent = p.layerMode === "turns" ? "Cycle" : "Stack"; D.mode.classList.toggle("kd-on", p.layerMode === "turns"); }
      else for (const b of D.mode.querySelectorAll("button")) b.classList.toggle("kd-on", (p.layerMode || "stack") === b.dataset.mode);
      D.mode.style.visibility = n > 1 ? "" : "hidden";
      D.layers.innerHTML = "";
      const layers = [{ name: name || "no sound", url: kitE && kitE.kit && kitE.kit[NOTE_OF[sel]], gain: 1, main: true }, ...((n > 1 && kp.layers) || [])];
      renderRw();
      if (LNEW) { renderLayerKnobs(layers, n); renderPick(); renderCells(); return; }
      layers.forEach((L, i) => {
        const row = el("div", "kd-layer", `<canvas></canvas><span>${L.name}</span><div class="kd-lv" style="--v:${Math.round((L.gain || 0.7) * 100)}%"></div>${L.main ? "<em>main</em>" : `<button title="Remove">×</button>`}`);
        row.title = "Click to hear this sound alone";
        row.onclick = (e) => { if (e.target.tagName === "BUTTON") { setLayers(sel, n - 1); return; } try { ctx.hit(sel, 112, L.url); } catch (err) { /* fine */ } flash(sel); };
        D.layers.append(row); drawPic(row.querySelector("canvas"), sel, L.name, !L.main);
      });
      renderPick();
      renderCells();
    }
    // one knob per sound: drag up/down = its volume (0..100), click = hear it alone, double-click = back
    // to normal, wheel = volume. The main sound's knob is the pad's level (kitGain, same as LEVEL).
    const knGain = (e, i) => { const note = NOTE_OF[sel]; if (!i) { const g = e && e.kitGain && e.kitGain[note]; return g == null ? 1 : +g; } const L = ((e && e.kitPad && e.kitPad[note]) || {}).layers || []; const l = L[i - 1]; return l && l.gain != null ? +l.gain : 0.7; };
    const knSet = (e, i, g) => { g = +clamp(g, 0, 1).toFixed(3); if (!i) { e.kitGain = e.kitGain || {}; e.kitGain[NOTE_OF[sel]] = g; return; } const l = (kpOf(e, sel).layers || [])[i - 1]; if (l) l.gain = g; };
    function paintKnob(k, g) { const v = clamp(g, 0, 1); k.querySelector(".kd-lk1").setAttribute("stroke-dasharray", `${(KN_A * v).toFixed(2)} ${KN_C.toFixed(2)}`); k.querySelector("b").textContent = Math.round(g * 100); }
    function renderLayerKnobs(layers, n) {
      layers.forEach((L, i) => {
        const cell = el("div", "kd-lk" + (L.main ? " kd-lmain" : ""), `<div class="kd-lknob"${LV2 ? "><canvas></canvas" : ""}><svg viewBox="0 0 34 34"><circle class="kd-lk0" cx="17" cy="17" r="13" fill="none" stroke-width="3" stroke-dasharray="${KN_A.toFixed(2)} ${KN_C.toFixed(2)}" transform="rotate(135 17 17)"/><circle class="kd-lk1" cx="17" cy="17" r="13" fill="none" stroke-width="3" stroke-dasharray="0 ${KN_C.toFixed(2)}" transform="rotate(135 17 17)"/></svg><b></b></div><span>${L.name}</span>${L.main ? "" : `<button class="kd-lx" title="Remove">\u00d7</button>`}`);
        cell.dataset.i = i; cell.title = L.name + (L.main ? " (main)" : "") + ": drag = volume, click = hear it";
        const knob = cell.querySelector(".kd-lknob"); paintKnob(knob, knGain(kitE, i));
        if (LV2) drawPic(knob.querySelector("canvas"), sel, L.name, !L.main);
        const x = cell.querySelector(".kd-lx"); if (x) x.onclick = (e) => { e.stopPropagation(); removeLayer(sel, i); };
        bindKnob(knob, i, L);
        D.layers.append(cell);
      });
      if (n < 4) { const a = el("button", "kd-ladd", "+"); a.title = "Add a sound to this pad"; a.onclick = () => addLayer(sel); D.layers.append(a); }
    }
    function bindKnob(knob, i, L) {
      let d = null, sendT = 0;
      const push = (e, undo) => { clearTimeout(sendT); sendT = 0; try { ctx.setKit(e, undo); } catch (err) { /* no engine */ } };
      knob.addEventListener("pointerdown", (ev) => { if (ev.button !== 0) return; ev.preventDefault(); knob.setPointerCapture(ev.pointerId); const e = ctx.getKit(); d = { e, y: ev.clientY, g0: Math.min(1, knGain(e, i)), moved: false }; });
      knob.addEventListener("pointermove", (ev) => {
        if (!d) return; const dy = d.y - ev.clientY; if (!d.moved && Math.abs(dy) < 3) return; d.moved = true; knob.classList.add("kd-drag");
        knSet(d.e, i, d.g0 + dy / (ev.shiftKey ? 600 : 150)); paintKnob(knob, knGain(d.e, i));
        if (!sendT) { const e = d.e; sendT = setTimeout(() => { sendT = 0; try { ctx.setKit(e, false); } catch (err) { /* fine */ } }, 33); }
      });
      const up = () => { if (!d) return; const x = d; d = null; knob.classList.remove("kd-drag");
        if (x.moved) { kitE = x.e; push(x.e, true); renderBars(); return; }
        try { ctx.hit(sel, 112, L.url); } catch (err) { /* fine */ } flash(sel); };
      knob.addEventListener("pointerup", up); knob.addEventListener("pointercancel", () => { d = null; knob.classList.remove("kd-drag"); });
      knob.addEventListener("dblclick", () => { const e = ctx.getKit(); knSet(e, i, i ? 0.7 : 1); kitE = e; push(e, true); paintKnob(knob, knGain(e, i)); renderBars(); });
      knob.addEventListener("wheel", (ev) => { ev.preventDefault(); const e = ctx.getKit(); knSet(e, i, Math.min(1, knGain(e, i)) + (ev.deltaY < 0 ? 0.05 : -0.05)); kitE = e; paintKnob(knob, knGain(e, i)); clearTimeout(knob._wt); knob._wt = setTimeout(() => { try { ctx.setKit(e, true); } catch (err) { /* fine */ } renderBars(); }, 200); }, { passive: false });
    }
    // + keeps the sounds already there and adds one more; x takes exactly that one away
    function addLayer(slot) {
      const p = S.pads[slot], n = p.layers || 1; if (n >= 4) return;
      const e = ctx.getKit(), kp = kpOf(e, slot), have = new Set(((n > 1 && kp.layers) || []).map((l) => l.sound || l.url));
      if (n <= 1) return setLayers(slot, 2);
      const got = pickLayers(slot, 4, e, S.seed + ":" + newSeed()).find((l) => !have.has(l.sound || l.url));
      if (!got) return ctx.say(`No more ${LABEL[slot].toLowerCase()} sounds to add.`);
      const k = kp.layers.length; got.tune = +((k % 2 ? -1 : 1) * Math.abs(got.tune || 0.2)).toFixed(2); got.pan = +((k % 2 ? 1 : -1) * Math.abs(got.pan || 0.2)).toFixed(2);
      kp.layers.push(got); p.layers = kp.layers.length + 1; kitE = e; ctx.setKit(e, true); hit(slot); renderRows(); renderDetail(); save(true);
      ctx.say(`${p.layers} ${LABEL[slot].toLowerCase()}s on the pad: added ${got.name}.`);
    }
    function removeLayer(slot, i) {
      const p = S.pads[slot], e = ctx.getKit(), kp = kpOf(e, slot); if (!kp.layers || !kp.layers[i - 1]) return setLayers(slot, (p.layers || 1) - 1);
      const [gone] = kp.layers.splice(i - 1, 1); p.layers = kp.layers.length + 1;
      if (p.layers <= 1) { p.layers = 1; delete kp.layers; delete kp.layerMode; }
      kitE = e; ctx.setKit(e, true); renderRows(); renderDetail(); save(true); ctx.say(`Took ${gone.name} off the ${LABEL[slot].toLowerCase()} pad.`);
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
      if (ogAllBtn) ogAllBtn.classList.toggle("kb-lit", !!S.offgrid);
      paintCx(); paintSub();
      if (barsSel) barsSel.hidden = lenFollow();
      genreBtn.querySelector("span").textContent = genreLabel();
      if (rhythmBtn) { rhythmBtn.querySelector("span").textContent = S.rhythm ? rhythmName(S.rhythm) : "Rhythm"; rhythmBtn.querySelector("em").textContent = S.rhythmMix ? "+ " + rhythmName(S.rhythmMix) : S.rhythmGlitch ? "glitch" : ""; rhythmBtn.classList.toggle("kb-locked", !!S.rhythmLock); rhythmBtn.classList.toggle("kb-none", !S.rhythm); }
      for (const b of rollbar.querySelectorAll(".kb-bars button")) b.classList.toggle("kd-on", Number(b.dataset.bars) === S.bars);
      renderPages();
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
      ph = nph; const playing0 = !!(t && t.playing);
      if (!playhead) return;
      if (mr && ph >= 0) { const G = mrGeo(), x = G.X(ph * G.w.n); mrPh.style.left = x + "px"; mrPh.style.height = G.rh + "px"; mrPh.hidden = x < MR_KEYS || x > G.W; } else mrPh.hidden = true;
      if (SCROLL) { if (hsOn() && ph >= 0) { hsP.hidden = false; hsP.style.left = (ph * 100) + "%"; } else hsP.hidden = true; }
      if (SCROLL && paged() && ph >= 0 && playing0 && !drag) followTo(ph);
      if (!SCROLL && lenFollow() && paged() && ph >= 0 && playing0 && !drag) { const pg = Math.floor(ph * 16 * S.bars / PAGE_STEPS); if (pg !== page) { page = pg; renderPages(); for (const s of SLOTS) drawRow(s); } }   // long beats: the rows follow the playhead
      if (gridLay && S.view === "rows" && ph >= 0) { const w = win(), cw = (gridLay.w - gridLay.x0 - 6) / w.m, at = ph * w.n - w.a; gph.style.left = (gridLay.x0 + at * cw) + "px"; gph.hidden = at < 0 || at > w.m; } else gph.hidden = true;
      const playing = !!(t && t.playing); playBtn.innerHTML = playing ? ICON.stop : ICON.play; playBtn.classList.toggle("kb-on", playing);
      if (ph < 0) { playhead.style.display = "none"; setNow(-1); return; }
      const [x0, y0] = pt(150, -90 + ph * 360), [x1, y1] = pt(478, -90 + ph * 360);
      playhead.setAttribute("x1", x0); playhead.setAttribute("y1", y0); playhead.setAttribute("x2", x1); playhead.setAttribute("y2", y1); playhead.style.display = "";
      setNow(Math.floor(ph * 16 * S.bars));
    }
    // page-follow: once the playhead runs off the window, the window jumps so its bar is first (not right after you scrolled)
    function followTo(f, force) {
      if (!force && performance.now() - userScrollT < 1500) return;
      const w = win(), at = f * w.n; if (at >= w.a && at < w.a + w.m) return;
      setScroll(Math.floor(at / 16) * 16, false);
    }
    function setNow(k) {
      if (k === phStep) return;
      // only the steps that hit light up white; the playhead line shows the position on its own
      for (const slot of SLOTS) { const t = trk[slot]; if (!t) continue; if (phStep >= 0 && t.steps[phStep]) t.steps[phStep].classList.remove("kd-now"); if (k >= 0 && t.steps[k] && S.pads[slot].steps[k] && S.pads[slot].steps[k].v) { t.steps[k].classList.add("kd-now"); flash(slot); } }
      const was = phStep; phStep = k;
      if (S.view === "rows") for (const slot of SLOTS) if ([S.pads[slot].steps, ...linesOf(slot)].some((st) => (was >= 0 && st[was] && st[was].v) || (k >= 0 && st[k] && st[k].v))) drawRow(slot);
    }

    // ---------------------------------------------------------------- load
    // A brand-new beat is as long as the MIDI pattern next to it (Zed + Eman call, 7 Nov 23:52: "as long as the
    // MIDIs"): 1, 2, 4 or 8 bars, and a shorter new drum clip grows to that pattern's length. "Next to it" = the
    // nearest other MIDI pattern in time (overlapping, or up to 4 bars away). KD_BARS_ONE = the old 1-bar start.
    async function matchNeighbour(r) {
      if (window.KD_BARS_ONE) return;
      const U = typeof ui !== "undefined" ? ui : window.ui, st = U && U.state; if (!st || !Array.isArray(st.tracks)) return;
      const bar = 240 / (r.bpm || 120), me = +r.clipStart || 0, myEnd = me + (+r.clipLength || 0);
      let best = null, bd = Infinity;
      for (const t of st.tracks) for (const c of t.clips || []) {
        if (c.kind !== "midi" || c.id === r.clipId || (c.plugins || []).some((p) => p.kit)) continue;
        if (typeof isKillDrumLane === "function" && isKillDrumLane(t)) continue;
        const d = Math.max(0, c.start - myEnd, me - (c.start + c.length));
        if (d < bd - 1e-6 || (Math.abs(d - bd) < 1e-6 && best && c.length > best.length)) { bd = d; best = c; }
      }
      if (!best || bd > 4 * bar + 1e-6) return;
      const bars = [...BAR_SIZES()].reverse().find((x) => x <= best.length / bar + 0.01) || 1;
      S.bars = bars; if (bars > 2 && !window.KD_BARS_RING) S.view = "rows"; // 64+ steps are too small to aim at on the circle
      if (r.clipId && (+r.clipLength || 0) < best.length - 1e-3) {
        const ok = await B("setClipBounds", { clipId: r.clipId, start: me, length: best.length });
        if (ok && !ok.error) { clip.clipLength = best.length; clip.beats = Math.round(best.length / bar * 4 * 1000) / 1000; }
      }
    }
    async function load() {
      const r = await B("killDrumBeatGet", { pluginId: pid });
      if (dead) return;
      if (r && r.ok) {
        clip = { clipStart: r.clipStart || 0, clipLength: r.clipLength || 0, beats: r.beats || 4, bpm: r.bpm || 120 };
        await fetchCtx();
        const b = r.beat;
        if (b && b.pads) { S.genre = b.genre || S.genre; S.bars = normBars(b.bars); S.swing = +b.swing || 0; S.humanize = +b.humanize || 0; S.xp = clamp(+b.xp || 0, 0, 1); S.cx = b.cx == null ? 0.5 : clamp(+b.cx || 0, 0, 1); S.sub808 = /^(auto|on|off)$/.test(b.sub808) ? b.sub808 : "auto"; S.rhythm = b.rhythm && RB() && RB().byId(b.rhythm) ? b.rhythm : null; S.rhythmLock = !!b.rhythmLock && !!S.rhythm; S.rhythmHist = Array.isArray(b.rhythmHist) ? b.rhythmHist.slice(-40) : []; S.seed = b.seed || S.seed; if (b.view) S.view = b.view; S.playAll = !!b.playAll;
          for (const s of SLOTS) { const q = b.pads[s] || {}; S.pads[s].lock = { sound: !!(q.lock && q.lock.sound), pattern: !!(q.lock && q.lock.pattern) }; S.pads[s].layers = clamp(q.layers || 1, 1, 4); if (q.layerMode) S.pads[s].layerMode = q.layerMode; S.pads[s].mute = !!q.mute; S.pads[s].solo = !!q.solo; S.pads[s].offgrid = !!q.offgrid; } S.offgrid = !!b.offgrid; }
        const multi = b && Array.isArray(b.vers) && b.vers.length && (b.vers.length > 1 || (b.chain || []).length > 1);
        if (b && Array.isArray(b.vers) && b.vers.length) { S.vers = JSON.parse(JSON.stringify(b.vers)); S.cur = !window.KT2_KD_CLIPBAR_OFF && r.kdBar && b.vers.some((v) => v.id === r.kdBar) ? r.kdBar : b.cur; S.chain = Array.isArray(b.chain) ? b.chain.slice() : []; } else { S.vers = null; }
        ensureVers();
        if (multi) { const v = curV(); S.bars = v.bars || S.bars; }
        else if (lenFollow() && clip.clipLength) { S.bars = clipBars(); if (S.bars > 2 && S.view !== "rows" && !window.KD_BARS_RING) S.view = "rows"; }
        if (!(b && b.song && b.song.bars === S.bars)) S.song = null; else S.song = b.song;
        let pads = {}; try { pads = multi ? curV().pads || {} : P().fromNotes((r.notes || []).filter((n) => !n.line), { bars: S.bars, noteOf: NOTE_OF }) || {}; } catch (e) { console.error(e); }
        S.lines = copyLines(multi ? curV().lines : b && b.lines, S.bars);
        let any = false; for (const s of SLOTS) {
          const kept = !multi && !audible(s) && b && b.pads && b.pads[s] && Array.isArray(b.pads[s].steps) ? b.pads[s].steps : null;
          S.pads[s].steps = fit(kept || pads[s] || [], S.bars); if (S.pads[s].steps.some((x) => x.v)) any = true;
        }
        // the first clip on a new KILLDRUM lane already holds the 1-bar starter beat, so "as long as the MIDI" never
        // happened there (bug check, 7 Nov): a beat never opened before follows the MIDI next to it too, its bar
        // repeated to the new length. KD_NEIGHBOUR_EMPTY_ONLY = true: only a clip with no notes at all (old).
        if (!b && any && !window.KD_NEIGHBOUR_EMPTY_ONLY && !(window.KT2Quest && KT2Quest.active)) {   // quests set their own lengths
          const was = S.bars; await matchNeighbour(r);
          if (lenFollow() && clip.clipLength) S.bars = clipBars();
          if (S.bars !== was) { for (const s of SLOTS) S.pads[s].steps = fit(S.pads[s].steps, S.bars); S.lines = copyLines(S.lines, S.bars); save(false); }
        } else if (!any && !b) { await matchNeighbour(r); if (lenFollow() && clip.clipLength) { S.bars = clipBars(); for (const s of SLOTS) S.pads[s].steps = fit(S.pads[s].steps, S.bars); } }
        if (S.bars > 2 && S.view !== "rows" && !window.KD_BARS_RING && lenFollow()) S.view = "rows";
        if (!any) { let vibe = null; try { vibe = (ctx.kit && ctx.kit().vibe) || (kitE && kitE.kitVibe); } catch (e) { /* none */ } if (!b) S.genre = guessGenre(clip.bpm, vibe); applyPatterns(S.seed); save(true); ctx.say(`Made a ${genreWord()} beat to start. ROLL for another.`); }
      } else if (!loaded) { local = true; applyPatterns(S.seed); }
      if (!S.rhythm && RB() && !window.KD_RHYTHM_OFF) try { const c = RB().classify(stepsBySlot(), { bpm: clip.bpm }); if (c && SLOTS.some((x) => S.pads[x].steps.some((q) => q.v))) S.rhythm = c.id; } catch (e) { /* no brain */ }
      ensureVers(); loaded = true; renderAll(); renderVers(); setView(S.view); notifyRhythm();
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
      // the row's MIDI editor, for tests: screen points of a step / pitch, a note's end, its velocity bar
      _step: (slot, i, line) => { const q = arrOf(slot, line || 0)[i]; return q ? JSON.parse(JSON.stringify(q)) : null; }, _pick: () => (pick ? { ...pick } : null),
      _tail: () => { if (!gridLay) return null; const w = win(), cw = (gridLay.w - gridLay.x0 - 6) / w.m, n = 16 * S.bars;
        for (const slot of SLOTS) { const st = arrOf(slot, 0), ring = soundSteps(slot), row = gridLay.rows[slot]; if (!row) continue;
          for (let k = w.a; k < w.a + w.m; k++) if (st[k] && st[k].v) { const len = tailLen(st, k, n, ring); if (len >= 3 && k + len < w.a + w.m) { const X = (f) => gridLay.left + (gridLay.x0 + (f - w.a) * cw) * gridLay.k; return { slot, i: k, len, l: st[k].l || 0, hits: st.filter((q) => q && q.v).length, xEnd: X(k + (st[k].o || 0) + len), xMid: X(k + 1.5), y: gridLay.top + (row.y + row.h / 2) * gridLay.k }; } } }
        return null; },
      _scroll: () => { const w = win(); return { a: w.a, m: w.m, n: w.n, on: hsOn() }; }, _follow: (f) => followTo(f, true),
      _mr: { slot: () => (mr ? mr.slot : null), lines: () => (mr ? linesOf(mr.slot).length : 0),
        clear: () => { if (!mr) return; S.pads[mr.slot].steps = fit([], S.bars); if (S.lines) delete S.lines[mr.slot]; syncSubRows(); mr.pick = null; mr.top = null; ringChanged(mr.slot, true); mrDraw(); },
        _scr: (x, y) => { const r = mrBody.getBoundingClientRect(), k = mrBody.offsetWidth ? r.width / mrBody.offsetWidth : 1; return { x: r.left + x * k, y: r.top + y * k }; },
        pt(f, t) { const G = mrGeo(); return this._scr(G.X(f), G.Y(t)); },
        endX(k) { const G = mrGeo(), n = mrNotes()[k]; return this._scr(G.X(n.x + n.len) - 1, 0).x; },
        velPt(k) { const G = mrGeo(), n = mrNotes()[k], vy0 = G.rh + 4, vh = G.H - vy0 - 2; return this._scr(G.X(n.x) + 3, vy0 + vh - (n.st.v / 127) * vh + 2); },
        root: () => (mr ? rootOf(mr.slot) : undefined), base: () => (mr ? baseOf(mr.slot) : null), name: (t) => (mr ? nameOf(baseOf(mr.slot) + (t || 0)) : null),
        semi: () => mrSemi, mel: () => JSON.parse(JSON.stringify(S.mel || {})), top: () => (mr ? mr.top : null) },
      // complexity + 808 switch (tests): rows = pads with hits + their extra lines
      songState: () => ({ bars: S.bars, steps: S.pads.kick.steps.length, song: S.song ? S.song.sections.map((x) => x.name + x.bars).join() : null, from: S.song ? S.song.from : null, page }),
      cxState: () => ({ cx: S.cx, sub: S.sub808 || "auto", genre: S.genre, rows: SLOTS.reduce((n, x) => n + (S.pads[x].steps.some((q) => q.v) ? 1 : 0) + linesOf(x).length, 0), has808: S.pads["808"].steps.some((q) => q.v) }),
      padSteps: (slot) => { const x = slotOf(slot); return x ? JSON.parse(JSON.stringify(S.pads[x].steps)) : null; },
      isOffGrid: (slot) => { const x = slotOf(slot); return !!(x && ogOn(S.pads[x])); },
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
      offGrid(slot, on = true) {
        if (window.KD_OFFGRID_OFF) return "Off-grid is turned off.";
        if (!window.KD_ROWMIDI_OFF) { if (typeof slot === "boolean") on = slot; if (!!S.offgrid === !!on) return `Already ${on ? "off-grid" : "on the grid"}.`; return did(() => setOffGrid(null, on)); }
        const s = slotOf(slot); if (!s) return `No pad called ${slot}.`;
        if (!!S.pads[s].offgrid === !!on) return `${LABEL[s]} is already ${on ? "off-grid" : "on the grid"}.`;
        return did(() => setOffGrid(s, on));
      },
      genre(id) {
        const k = String(id == null ? "" : id).toLowerCase().trim(), g = genres().find((x) => x.id === k || x.label.toLowerCase() === k) || (k && genres().find((x) => x.id === wordGenre(k)));
        if (!g) return `No style called ${id}. Styles: ${genres().map((x) => x.id).join(", ")}.`;
        return did(() => setGenre(g.id));
      },
      steps(n) { const want = Math.max(1, Math.round((Number(n) || 16) / 16)), bars = BAR_SIZES().filter((b) => b <= want).pop() || 1; if (S.bars === bars) return `Already ${16 * bars} steps.`; return did(() => setBars(bars)); },
      swing(v) { S.swing = clamp(Number(v) || 0, 0, 60) / 100; renderBar(); save(true); return `Swing ${Math.round(S.swing * 100)}%.`; },
      // the rhythm brain: rhythm("boom bap") moves the beat into it, rhythmLock(true) keeps every roll in it, experimental(0..100)
      rhythms: () => (RB() ? RB().RHYTHMS.map((r) => ({ id: r.id, name: r.name, group: r.group })) : []),
      rhythm(id) {
        const K = RB(); if (!K) return "No rhythm brain loaded.";
        const k = String(id == null ? "" : id).toLowerCase().trim(), r = K.byId(k) || K.RHYTHMS.find((x) => x.name.toLowerCase() === k) || K.RHYTHMS.find((x) => x.name.toLowerCase().startsWith(k) || x.genres.includes(k));
        if (!r) return `No rhythm called ${id}. Rhythms: ${K.RHYTHMS.map((x) => x.name).join(", ")}.`;
        return did(() => setRhythm(r.id));
      },
      rhythmLock(on = true) { if (on && !S.rhythm) return "Pick a rhythm first."; if (!!S.rhythmLock === !!on) return `Rhythm already ${on ? "locked" : "unlocked"}.`; return did(() => setRhythmLock(on)); },
      experimental(v) { setXp(clamp(Number(v) || 0, 0, 100) / 100); return `Experimental ${Math.round(S.xp * 100)}%.`; },
      rhythmState, setRhythm, setRhythmLock, setXp, context: brainCtx, refreshContext: fetchCtx,
      pluginId: pid, kitJson: () => { try { return JSON.stringify(ctx.getKit().kit); } catch (e) { return ""; } },
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
        return `${genreLabel()} beat${S.rhythm ? " in " + rhythmName(S.rhythm) + (S.rhythmLock ? " (locked)" : "") : ""}, ${16 * S.bars} steps, swing ${Math.round((S.swing || 0) * 100)}%, human ${Math.round((S.humanize || 0) * 100)}%, experimental ${Math.round((S.xp || 0) * 100)}%. ${locked.length ? "Locked: " + list(locked) + "." : "Nothing locked."}${layered.length ? " Layered: " + list(layered) + "." : ""}`;
      },
    };
    window.killDrumBeat = api;
    // destroy() (below) calls closeGenres() with dead set: that is where this block lets go.
    const closeGenres0 = closeGenres;
    closeGenres = function () { closeGenres0(); if (dead) { if (window.killDrumBeat === api) window.killDrumBeat = null; if (unVibe) unVibe(); if (ctx.say !== say0 && say0) ctx.say = say0; } };

    return {
      show() { shown = true; load(); if (!raf) raf = requestAnimationFrame(tick); },
      hide() { shown = false; closeRw(); closeGenres(); closeSaved(); if (raf) cancelAnimationFrame(raf); raf = 0; },
      kitChanged(e) { kitE = e; renderRows(); renderDetail(); },
      // undo/redo changed the lane: read the beat (the clip's notes + kitBeat) again
      reload() { if (!dead && !saveT) load(); },
      destroy() { closeRw(); if (RW) document.removeEventListener("killdrum-rhythm", renderRw); closeSaved(); if (ctx.saveBeat) ctx.saveBeat = null; if (soloOn) B("killDrumSolo", { pluginId: pid, on: false }); dead = true; shown = false; closeGenres(); closeMenu(); document.removeEventListener("keydown", onKey, true); if (!window.KD_MRDOC_OLD) document.removeEventListener("pointerdown", onDocMr, true); if (raf) cancelAnimationFrame(raf); clearTimeout(saveT); if (unKit) unKit(); if (ro) ro.disconnect(); },
    };
  }

  window.KillDrumTabs = window.KillDrumTabs || [];
  window.KillDrumTabs.push({ id: "beat", label: "Beat", order: -1, mount });
  // Key follow for a pad's MIDI (Eman, 14 Nov). A pad whose notes were only ever the default (its sound's own note)
  // stays put when the song key changes: an 808 in C stays in C. Once its MIDI was edited into a melody, the pad
  // is in beat.mel (slot -> the key's tonic when it was edited) and moves with the key, the nearest way.
  // Shifts every copy of the pad's steps (the open BAR, the other BARs, the extra lines) once; returns { slot: semis }.
  // KD_KEYFOLLOW_OFF = nothing ever follows the key.
  function followKey(beat, tonic) {
    const out = {};
    if (!beat || !beat.mel || typeof window !== "undefined" && window.KD_KEYFOLLOW_OFF) return out;
    const to = tonic == null || tonic < 0 ? 0 : ((tonic % 12) + 12) % 12, seen = new Set();
    const shift = (arr, d) => { for (const st of arr || []) { if (!st || !st.v || seen.has(st)) continue; seen.add(st); const t = clamp((st.t || 0) + d, -24, 24); if (t) st.t = t; else delete st.t; } };
    for (const slot of Object.keys(beat.mel)) {
      const from = beat.mel[slot]; if (from == null || from === to) continue;
      const d = ((((to - from) % 12) + 18) % 12) - 6; beat.mel[slot] = to; if (!d) continue;
      if (beat.pads && beat.pads[slot]) shift(beat.pads[slot].steps, d);
      for (const a of (beat.lines && beat.lines[slot]) || []) shift(a, d);
      for (const v of beat.vers || []) { shift(v.pads && v.pads[slot], d); for (const a of (v.lines && v.lines[slot]) || []) shift(a, d); }
      out[slot] = d;
    }
    return out;
  }
  window.KillDrumBeat = { mount, FB, COLOR, NOTE_OF, offGrid, followKey };
})();
