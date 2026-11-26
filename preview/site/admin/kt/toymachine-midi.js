// ---------------------------------------------------------------------------
// TOY MACHINE's own MIDI view (Eman, 27 Oct): the MIDI tab of a TOY MACHINE lane. It is not the
// app's piano roll (that one stays as it is for every other lane); this is where the smart
// chord and melody tools grow. v0: a scale you pick (the rows ARE the scale, so every note is
// in key), the chord of each bar named above the grid, and a chord dice that writes a
// voice-led progression in that scale. Notes are the lane's MIDI clip ({ pitch, start, length,
// velocity, slide? } in beats from the clip start); every change is one setMidiNotes (Cmd+Z).
// The research and the plan for the rest: docs/TOY-MACHINE-MIDI.md.
// Round 2 (Eman, 27 Oct night): "a normal MIDI, in our style, bigger and easier to move". Each
// note is drawn as its sound: the amp envelope of the lane's TOY MACHINE preset (attack, decay to
// sustain, and the release tail after the note ends), so short plucks and long pads look
// different. Cmd-drag a box over notes and a small menu shows above them: Compound glues them
// into one block that moves (and stretches) as one (`group` on each note); Slide in makes them
// glide from the notes just before (over how much they overlap, voice to nearest voice), and
// Slide out makes the notes right after glide from them.
(() => {
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SCALES = {
    minor: { name: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
    dorian: { name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
    phrygian: { name: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10] },
    harmonic: { name: "Harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11] },
    major: { name: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
    lydian: { name: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
    locrian: { name: "Locrian", steps: [0, 1, 3, 5, 6, 8, 10] },
    melodic: { name: "Melodic minor", steps: [0, 2, 3, 5, 7, 9, 11] },
    phrygdom: { name: "Phrygian dominant", steps: [0, 1, 4, 5, 7, 8, 10] },
    hungarian: { name: "Hungarian minor", steps: [0, 2, 3, 6, 7, 8, 11] },
    double: { name: "Double harmonic", steps: [0, 1, 4, 5, 7, 8, 11] },
  };
  window.KT_SCALES = SCALES;   // the top bar's key picker offers the same list (ui/kt2.js)
  const MINORISH = new Set(["minor", "dorian", "phrygian", "harmonic", "locrian", "melodic", "phrygdom", "hungarian"]);
  const KEYS = 66, LOW = 24, HIGH = 108;
  // the note-end resize cursor: a left-right arrow in acid with a dark edge, so it reads on purple (Eman, 4 Nov 23:23)
  const RESIZE_CUR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="20" viewBox="0 0 28 20"><path d="M2 10l6-6v4h12V4l6 6-6 6v-4H8v4z" fill="#E4FF3A" stroke="#141218" stroke-width="1.6" stroke-linejoin="round"/></svg>')}") 14 10, ew-resize`;   // 66: the key chips of the V2m look (was 52)
  // the chord strip on top; the footer MIDI has none, so the notes get all the height (Eman, 31 Oct)
  let STRIP = 26, FOOT = 22;
  // The marker's grab area: the ruler plus the first grid row under it (no lower), so a press a little
  // under the ruler still moves the marker, and the second row writes notes (Eman, 8 Nov 01:42; V6d reached
  // 1.5 rows: KT2_RULER_HIT_TALL brings that back). KT2_RULER_HIT_OLD = the ruler only.
  const rulerHitY = () => (STRIP > 0 && !window.KT2_RULER_HIT_OLD ? STRIP + Math.round((ROW || 22) * (window.KT2_RULER_HIT_TALL ? 1.5 : 1)) : STRIP);
  const stripFor = (pane) => (pane && pane.classList.contains("k2t-tmidi") ? 0 : 26);
  // Eman, 4 Nov 19:53: the chord names live in a strip under the notes; the top is the song's ruler
  // (drag the marker, click-drag a yellow loop, double-click loops the bar)
  const footFor = (pane) => (window.TMM_CHORD_FOOT && stripFor(pane) ? 22 : 0);   // V2n: no chord strip (Eman, 4 Nov 23:22); the flag brings it back
  let OX = 0;   // where beat 0 sits on screen (KEYS when not zoomed in; moves left as you scroll a zoomed view)
  let ROW = 22;   // row height: 22 in the big window; in the footer it shrinks so the part fits (fitRows)
  const COLOR = "#8b5cf6", ACID = "#e4ff3a";
  // a colour moved part of the way to white (k 0..1); leaves anything that isn't #rgb / #rrggbb alone
  const toWhite = (c, k) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || "")); if (!m) return c;
    const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
    return "#" + [0, 2, 4].map((i) => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (255 - v) * k).toString(16).padStart(2, "0"); }).join("");
  };

  // Progressions as scale degrees (0 = the tonic chord). Minor ones lean on the Sad Hours /
  // snowfall / Blue Hour moves: i-VI-III-VII, the iv and the borrowed-feeling v, endings that
  // don't resolve. Every chord is stacked in thirds from the picked scale, so Dorian, Phrygian
  // and Harmonic minor each colour the same shapes their own way.
  const PROGS = {
    minor: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 6, 0, 0], [0, 6, 5, 6], [3, 0, 5, 6], [0, 4, 5, 3], [5, 3, 0, 4],
            [0, 2, 6, 3], [0, 5, 3, 4], [5, 2, 6, 0], [0, 0, 5, 3], [3, 5, 0, 6]],
    major: [[0, 4, 5, 3], [0, 5, 3, 4], [5, 3, 0, 4], [3, 0, 4, 5], [0, 3, 5, 4], [3, 4, 2, 5], [0, 2, 3, 4], [5, 4, 3, 4]],
  };

  // ---- where the scale lives: per lane, in this browser (v0) ---------------------------
  const STORE = "killtoy.tmMidi";
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; } };
  const save = (all) => { try { localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* private window */ } };
  // The lane follows the project's key (Eman, 6 Nov 21:02: "changing the key in the project changes
  // the key in the midi"): each time the project key changes, every lane's root + scale move to it
  // (ONLY KEY and the tapped locks stay). A key picked in the MIDI tab holds until the project key
  // changes again. TMM_KEY_OWN = old (a lane kept its first key for good).
  const songKeySig = () => { try { return JSON.stringify((ui.state && ui.state.key) || null); } catch (e) { return ""; } };
  function songScale() {
    const k = window.MidiTools && MidiTools.parseKey(ui.state && ui.state.key); // start on the song's key
    const sk = ui.state && ui.state.key && ui.state.key.scale;   // an Advanced scale picked in the top bar
    return k ? { tonic: k.tonic, scale: sk && SCALES[sk] ? sk : k.minor ? "minor" : "major" } : { tonic: 9, scale: "minor" };
  }
  function laneScale(trackId) {
    const own = load()[trackId], sig = songKeySig();
    if (own && (window.TMM_KEY_OWN || own.songKey === sig || !(window.MidiTools && MidiTools.parseKey(ui.state && ui.state.key)))) return own;
    const sc = { ...(own || {}), ...songScale(), songKey: sig };
    if (own) setLaneScale(trackId, sc);
    return sc;
  }
  // the project key changed while a MIDI tab is open: move it along
  // CONVERT EVERYTHING (Eman, 10 Nov 00:14: A minor -> B minor kept every note where it was): the song's
  // notes are moved by the backend, then this ran with the view's own copy of the notes from before and
  // wrote them straight back, so the key changed and the notes didn't. Now the view takes the clip's notes
  // as they are after the change, and only writes when a note has to come back (or go quiet), for the
  // view it belongs to. KT2_FOLLOW_KEY_OLD = old (wrote its old copy back).
  function followSongKey() {
    if (window.TMM_KEY_OWN || !S || S.trackId == null || !S.sc || S.sc.songKey === songKeySig()) return false;
    if (!(window.MidiTools && MidiTools.parseKey(ui.state && ui.state.key))) return false;
    if (!window.KT2_FOLLOW_KEY_OLD && S.drag) return false;   // mid-drag: once the note is let go
    S.sc = laneScale(S.trackId); setLaneScale(S.trackId, S.sc);
    const t = S.pane && S.pane.querySelector("#tmm-tonic"), sc = S.pane && S.pane.querySelector("#tmm-scale");
    if (t) t.value = String(S.sc.tonic); if (sc) sc.value = S.sc.scale;
    if (window.KT2_FOLLOW_KEY_OLD) {
      if (S.notes && S.notes.length) setTimeout(() => { try { commit(); } catch (e) { /* closed */ } }, 0);   // notes now out of key go quiet (or come back)
      return true;
    }
    const c = S.clipId && findClip(S.clipId);
    if (!c) return true;
    S.notes = voiceNotes(c, S.voice).map((n) => ownExpr({ ...n, _op: n.pitch }));   // the notes as they are now
    S.sel = null; S.multi = null; S.pending = 0;
    // what commit would write: a muted note that is in the key again comes back (nothing else changes)
    const flip = S.notes.some((n) => !!n.muted !== (!rowOpen(n.pitch) && (!!window.TMM_MUTE_ALL_ON_COMMIT || !!n.muted)));
    if (flip) { const st = S; setTimeout(() => { try { const was = S; if (use(st.pane) === st && st.clipId === c.id) commit(); if (was && was !== st) use(was.pane); } catch (e) { /* closed */ } }, 0); }
    return true;
  }
  function setLaneScale(trackId, sc) { const all = load(); all[trackId] = sc; save(all); }

  // ---- the scale's rows ----------------------------------------------------------------
  const pc = (p) => ((p % 12) + 12) % 12;
  const inScale = (sc, p) => SCALES[sc.scale].steps.includes(pc(p - sc.tonic));
  const isBlackKey = (p) => [1, 3, 6, 8, 10].includes(pc(p));
  // V2n: a row is open (takes notes, plays) when it's in the key or ONLY KEY is off; tapping the lock
  // on its key flips that, for any key (Eman, 4 Nov 23:16). The flips live with the lane's scale.
  const rowOpen = (p) => { if (!S || !S.sc) return true; const base = S.all || inScale(S.sc, p); return (S.sc.flip || []).includes(p) ? !base : base; };
  function flipKey(p) {
    const f = new Set(S.sc.flip || []);
    if (f.has(p)) f.delete(p); else f.add(p);
    S.sc = { ...S.sc, flip: [...f] };
    if (S.trackId != null) setLaneScale(S.trackId, S.sc);
    draw(); S.rekey = true; commit();   // a row closed by hand goes quiet (or comes back)
    if (window.KT2Juice && KT2Juice.sound) { const on = rowOpen(p); (on ? KT2Juice.sound.unplug || (() => {}) : KT2Juice.sound.plug)(); }
  }
  // MORE GRID (Eman, 26 Nov: "the grid covers 3 octaves more ... on top and bottom"): the roll's rows run over the whole
  // MIDI range (0-127: C-1 to G9, two octaves more at the bottom, all the way to the top), the dice still writes in
  // LOW..HIGH. KT2_TMM_RANGE_OLD = C1..C8 as before
  const RLO = () => (window.KT2_TMM_RANGE_OLD ? LOW : 0), RHI = () => (window.KT2_TMM_RANGE_OLD ? HIGH : 127);
  function rowPitches(sc, all) { // top to bottom
    const out = [];
    for (let p = RHI(); p >= RLO(); p--) if (all || inScale(sc, p)) out.push(p);
    return out;
  }
  // A scale degree (any octave, 0 = the tonic at `base`) to its pitch.
  function degreePitch(sc, deg, base) {
    const st = SCALES[sc.scale].steps, o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
    return base + o * 12 + st[d];
  }

  // ---- naming chords -------------------------------------------------------------------
  const SHAPES = [["", [0, 4, 7]], ["m", [0, 3, 7]], ["dim", [0, 3, 6]], ["aug", [0, 4, 8]], ["sus2", [0, 2, 7]], ["sus4", [0, 5, 7]],
    ["maj7", [0, 4, 7, 11]], ["m7", [0, 3, 7, 10]], ["7", [0, 4, 7, 10]], ["m7b5", [0, 3, 6, 10]], ["mMaj7", [0, 3, 7, 11]],
    ["add9", [0, 4, 7, 2]], ["madd9", [0, 3, 7, 2]], ["maj9", [0, 4, 7, 11, 2]], ["m9", [0, 3, 7, 10, 2]], ["5", [0, 7]]];
  // FLATS IN FLAT KEYS (Eman, 15 Nov: "are this even F min?"): F minor reads Db, Ab, Bb, Eb, not C#, G#, A#, D#. The
  // piano keys, the chord names in the roll's text and the dice names follow the key. KT2_FLATS_OFF = always sharps
  const FLATN = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const flatKey = (sc) => { if (!sc || window.KT2_FLATS_OFF) return false; const st = (SCALES[sc.scale] || {}).steps || [], t = pc(sc.tonic || 0), minor = st.includes(3) && !st.includes(4); return minor ? [2, 7, 0, 5, 10, 3].includes(t) : [5, 10, 3, 8, 1, 6].includes(t); };
  const keyNames = (sc) => (flatKey(sc || (S && S.sc)) ? FLATN : NAMES);
  const SH2FL = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
  const spell = (name, sc) => (flatKey(sc || (S && S.sc)) ? String(name).replace(/(^|\/)([A-G]#)/g, (m, a, n) => a + (SH2FL[n] || n)) : name);
  function chordName(pitches) {
    const pcs = new Set(pitches.map(pc));
    const NAMES = keyNames();
    if (pcs.size < 2) return pitches.length ? NAMES[pc(pitches[0])] : "";
    const bass = pc(Math.min(...pitches));
    let best = null;
    for (let r = 0; r < 12; r++) for (const [suf, iv] of SHAPES) {
      const want = new Set(iv.map((i) => pc(r + i)));
      let hit = 0; for (const x of pcs) if (want.has(x)) hit++;
      const score = hit * 2 - (want.size - hit) * 2 - (pcs.size - hit) * 3 + (r === bass ? 1 : 0) - iv.length * 0.1;
      if (!best || score > best.score) best = { score, name: NAMES[r] + suf + (r !== bass && pcs.has(bass) ? "/" + NAMES[bass] : "") };
    }
    return best && best.score > 1 ? best.name : "";
  }

  // the root of a chord, by the same scoring as chordName
  function chordRoot(pitches) {
    const pcs = new Set(pitches.map(pc)); if (!pcs.size) return null;
    let best = null;
    for (let r = 0; r < 12; r++) for (const [, iv] of SHAPES) {
      const want = new Set(iv.map((i) => pc(r + i))); let hit = 0; for (const x of pcs) if (want.has(x)) hit++;
      const score = hit * 2 - (want.size - hit) * 2 - (pcs.size - hit) * 3 + (r === pc(Math.min(...pitches)) ? 1 : 0) - iv.length * 0.1;
      if (!best || score > best.score) best = { score, r };
    }
    return best.r;
  }
  // THE DICE CHAT (Eman, 9 Nov 01:38): "last chord darker" / "chord 2 brighter" change one chord of what is there.
  // A chord is every hit of the same notes in a row. Darker: major -> minor -> diminished; brighter: dim -> minor -> major -> maj7.
  // which: 0-based chord number or "last". dir: +1 darker, -1 brighter. Returns { n, before, after } or { err }
  function editChordMood(notes, which, dir) {
    const main = notes.filter((n) => !n._v && !n.locked);
    const starts = [...new Set(main.map((n) => Math.round(n.start * 1000)))].sort((a, b) => a - b);
    const groups = starts.map((t) => main.filter((n) => Math.round(n.start * 1000) === t));
    const segs = []; for (const g of groups) { const key = g.map((n) => n.pitch).sort((a, b) => a - b).join(","), last = segs[segs.length - 1]; if (last && last.key === key) last.gs.push(g); else segs.push({ key, gs: [g] }); }
    if (!segs.length) return { err: "There are no chords yet. Roll first." };
    const i = which === "last" ? segs.length - 1 : which;
    if (i < 0 || i >= segs.length) return { err: `There ${segs.length === 1 ? "is 1 chord" : "are " + segs.length + " chords"} here.` };
    const ps = segs[i].gs[0].map((n) => n.pitch), r = chordRoot(ps), has = (iv) => ps.some((p) => pc(p - r) === iv);
    // the move: which interval above the root goes where
    let from = null, to = null;
    if (dir > 0) { if (has(4)) { from = 4; to = 3; } else if (has(3) && has(7)) { from = 7; to = 6; } else if (has(11)) { from = 11; to = 10; } }
    else { if (has(6)) { from = 6; to = 7; } else if (has(3)) { from = 3; to = 4; } else if (has(4) && has(10)) { from = 10; to = 11; } }
    const before = chordName(ps);
    // a plain major chord gets brighter as a maj7: a doubled root (not the bass) steps down to the major 7th
    if (from == null && dir < 0 && has(4) && !has(11)) {
      const lo = Math.min(...ps), up = ps.filter((p) => pc(p - r) === 0 && p !== lo);
      if (up.length) { const top = Math.max(...up); for (const g of segs[i].gs) for (const n of g) if (n.pitch === top) n.pitch -= 1; return { n: i + 1, before, after: chordName(segs[i].gs[0].map((n) => n.pitch)) }; }
    }
    // nothing left to change in the chord itself: the voicing moves instead (brighter = the lowest note an octave up,
    // darker = the top note an octave down)
    if (from == null) {
      const pick = dir < 0 ? Math.min(...ps) : Math.max(...ps), np = pick + (dir < 0 ? 12 : -12);
      if (np < 24 || np > 108 || ps.length < 2) return { err: `${before || "That chord"} is already as ${dir > 0 ? "dark" : "bright"} as this goes.` };
      for (const g of segs[i].gs) for (const n of g) if (n.pitch === pick) n.pitch = np;
      return { n: i + 1, before, after: chordName(segs[i].gs[0].map((n) => n.pitch)) + (dir < 0 ? " (voiced higher)" : " (voiced lower)") };
    }
    // the picked key wins (10 Nov): a darker/brighter chord that would leave the key moves its voicing instead
    if (DICE_STRICT() && S && S.sc && ps.some((p) => pc(p - r) === from && !keyOpen(S.sc, p + to - from))) {
      const pick = dir < 0 ? Math.min(...ps) : Math.max(...ps), np = pick + (dir < 0 ? 12 : -12);
      if (np < 24 || np > 108 || ps.length < 2) return { err: `${before || "That chord"} can't get ${dir > 0 ? "darker" : "brighter"} without leaving the key.` };
      for (const g of segs[i].gs) for (const n of g) if (n.pitch === pick) n.pitch = np;
      return { n: i + 1, before, after: chordName(segs[i].gs[0].map((n) => n.pitch)) + (dir < 0 ? " (voiced higher, stays in key)" : " (voiced lower, stays in key)") };
    }
    for (const g of segs[i].gs) for (const n of g) if (pc(n.pitch - r) === from) n.pitch += to - from;
    return { n: i + 1, before, after: chordName(segs[i].gs[0].map((n) => n.pitch)) };
  }

  // ---- the chord dice ------------------------------------------------------------------
  let lastProg = "", lastBassPat = -1;
  function rollChords(sc, bars) {
    const mood = PR.mood && MOOD_PROGS[PR.mood];   // the prompt's mood picks the moves (Eman, 8 Nov)
    const pool = (mood ? mood[MINORISH.has(sc.scale) ? "minor" : "major"] : PROGS[MINORISH.has(sc.scale) ? "minor" : "major"]).filter((p) => p.join() !== lastProg);
    const prog = pool[Math.floor(Math.random() * pool.length)];
    lastProg = prog.join();
    const sevenths = Math.random() < (PR.sev != null ? PR.sev : 0.5), base = 48 + sc.tonic + (sc.tonic > 6 ? -12 : 0);
    const notes = [];
    let prev = null;
    for (let b = 0; b < bars; b++) {
      const deg = prog[b % prog.length];
      const tones = [0, 2, 4].concat(sevenths && deg !== 6 ? [6] : []).map((x) => degreePitch(sc, deg + x, base));
      const voiced = voiceLead(prev, tones);
      prev = voiced;
      const len = 4 - (b % 4 === 3 && Math.random() < 0.3 ? 0.5 : 0); // now and then a breath before the turn
      for (const p of voiced) notes.push({ pitch: p, start: b * 4, length: len, velocity: 92 + Math.round(Math.random() * 14) });
      notes.push({ pitch: degreePitch(sc, deg, base - 12), start: b * 4, length: len, velocity: 100 }); // the root under it
    }
    return { notes, prog };
  }
  // The inversion (and octave) that moves the fewest semitones from the last chord, kept around C4.
  // shift (the dice's RANGE: -12 LOW, 0 MID, +12 HIGH) moves the window the chords may sit in and the middle the first
  // chord aims for. Before, RANGE moved the stack an octave and voice leading pulled it straight back (Eman's cards,
  // 8 Nov: RANGE did nothing). KT2_DICE_RANGE_OLD = the fixed window
  function voiceLead(prev, tones, shift) {
    const sh = window.KT2_DICE_RANGE_OLD ? 0 : shift || 0, rootPc = ((tones[0] % 12) + 12) % 12;
    const cands = [];
    for (let inv = 0; inv < tones.length; inv++) for (const oct of [-12, 0, 12]) {
      const v = tones.map((p, i) => p + oct + (i < inv ? 12 : 0)).sort((a, b) => a - b);
      if (v[0] < 50 + sh || v[v.length - 1] > 80 + sh) continue;
      if (!window.KT2_DICE_DOUBLED_OLD && new Set(v).size !== v.length) continue;   // dice sprint 8 Nov: two voices + an octave doubled a note on inversion
      cands.push(v);
    }
    if (!cands.length) return tones;
    const centre = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    // DARK (shift < 0) likes the root at the bottom, BRIGHT (shift > 0) likes the root off the top (3rd or colour up there)
    const lean = (v) => (window.KT2_DICE_VOICING_OLD || !sh ? 0 : sh < 0 ? (((v[0] % 12) + 12) % 12 === rootPc ? 0 : 3) : (((v[v.length - 1] % 12) + 12) % 12 === rootPc ? 3 : 0));
    const cost = (v) => (prev ? v.reduce((s, p) => s + Math.min(...prev.map((q) => Math.abs(p - q))), 0) + (sh ? Math.abs(centre(v) - 62 - sh) : 0) : Math.abs(centre(v) - 62 - sh)) + lean(v);
    return cands.sort((a, b) => cost(a) - cost(b))[0];
  }


  // ---- the smart dice (Eman, 4 Nov): CHORDS, MELODY, BASS or ARP, rolled in the key ----------
  // It listens first: the other synths on this pattern (each cut SOUND), plus other MIDI lanes
  // playing at the same time (drums left out), are read as chords every half bar. What you roll
  // then follows them: a melody leans on their chord tones, a bass plays their roots, an arp
  // spells them. With nothing there yet it makes up a progression and follows that.
  // SPEED (0..3) picks the rhythm: CHORDS hold/half/stabs/pulse, BASS long/root+5/8ths/808,
  // MELODY slow/walk/bouncy/runs, ARP 1/4, 1/8, 1/16, 1/16 jumping octaves.
  const DICE_MODES = { chords: "CHORDS", melody: "MELODY", bass: "BASS", arp: "ARP" };
  const DICE_SPEEDS = { chords: ["HOLD", "HALF", "STABS", "PULSE"], melody: ["SLOW", "WALK", "BOUNCE", "RUNS"], bass: ["LONG", "ROOT+5", "8THS", "808"], arp: ["1/4", "1/8", "1/16", "JUMP"] };
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const scalePcs = (sc) => SCALES[sc.scale].steps.map((s) => pc(s + sc.tonic));
  // the triad on a scale degree, as pitch classes (root first)
  const triadPcs = (sc, deg) => [0, 2, 4].map((x) => pc(degreePitch(sc, deg + x, sc.tonic)));
  // other notes playing with this clip, in this clip's beats
  function diceContext(c, voice) {
    const out = [];
    // a sound that was removed can leave its notes in c.stack: those are not heard (dice sprint, 8 Nov)
    const ts = (ui.state && ui.state.tracks) || [], alive = (id) => !id || !ts.some((t) => t.layerOf === S.trackId) || ts.some((t) => t.id === id);
    for (const [id, ns] of [[null, c.notes || []], ...Object.entries(c.stack || {})]) if ((id || null) !== (voice || null) && alive(id)) out.push(...ns.filter((n) => !n.muted).map((n) => ({ ...n, src: id || "main" })));
    const st = ui.state, spb = secPerBeat(), beats = c.beats || 16, c0 = c.start, c1 = c.start + beats * spb;
    for (const t of (st && st.tracks) || []) {
      if (t.id === S.trackId || t.layerOf === S.trackId || t.kind !== "inst" || /drum|kick|clap|hat|perc/i.test((t.instrument || "") + " " + (t.name || ""))) continue;
      if ([...(t.plugins || []), ...t.clips.flatMap((k) => k.plugins || [])].some((p) => p.kit)) continue;
      for (const k of t.clips) {
        if (k.kind !== "midi" || k.start >= c1 || k.start + k.length <= c0) continue;
        for (const n of k.notes || []) {
          if (n.muted) continue;
          const a = (k.start + n.start * spb - c0) / spb, e = a + n.length;
          if (e > 0 && a < beats) out.push({ pitch: n.pitch, start: Math.max(0, a), length: Math.min(beats, e) - Math.max(0, a), velocity: n.velocity, slide: n.slide, src: t.id });
        }
      }
    }
    // PG MATCH (ui/kt2-pgmatch.js): the vocals / samples / beat over this pattern, heard as notes (chroma every half beat)
    if (window.KT2PGMatch && KT2PGMatch.isOn("dice") && !KT2PGMatch.simpleBlocked()) out.push(...KT2PGMatch.notesFor(c, S.sc));
    return out;
  }
  // chords every half bar: [{ deg }] (null where nothing plays), from what's there
  function hearChords(sc, notes, beats) {
    const segs = Math.ceil(beats / 2), out = [];
    for (let s = 0; s < segs; s++) {
      const a = s * 2, b = a + 2, w = new Array(12).fill(0);
      let low = null;
      for (const n of notes) {
        const o = Math.min(b, n.start + n.length) - Math.max(a, n.start);
        if (o <= 0) continue;
        w[pc(n.pitch)] += o;
        if (!low || n.pitch < low.pitch) low = n;
      }
      if (!w.some((x) => x > 0)) { out.push(null); continue; }
      let best = null;
      for (let d = 0; d < 7; d++) {
        const t = triadPcs(sc, d);
        const score = t.reduce((s, p, i) => s + w[p] * (i === 0 ? 1.2 : 1), 0) + (low && pc(low.pitch) === t[0] ? 1.5 : 0) - (d === 6 ? 0.3 : 0);
        if (!best || score > best.score) best = { deg: d, score };
      }
      out.push({ deg: best.deg });
    }
    return out;
  }
  // the harmony to follow: heard chords, gaps filled from the neighbours, or a fresh progression
  function plan(sc, ctx, beats) {
    const bars = Math.max(1, Math.round(beats / 4));
    let segs = hearChords(sc, ctx, beats);
    const heard = segs.some(Boolean);
    if (!heard) {
      const prog = rollChords(sc, Math.min(4, bars)).prog;
      segs = []; for (let s = 0; s < Math.ceil(beats / 2); s++) segs.push({ deg: prog[Math.floor(s / 2) % prog.length] });
    } else {
      let last = segs.find(Boolean);
      segs = segs.map((x) => (x ? (last = x) : last));
    }
    return { segs, heard, at: (beat) => segs[Math.max(0, Math.min(segs.length - 1, Math.floor(beat / 2)))].deg };
  }
  // the nearest pitch to `near` whose pitch class is in `pcs`
  const nearestIn = (pcs, near, below) => { for (let d = 0; d < 12; d++) { if (!below && pcs.includes(pc(near + d))) return near + d; if (pcs.includes(pc(near - d))) return near - d; } return near; };
  // PLAYBOI slides (Eman 24 Nov 2026): on a one-line part (808 or melody), a note that starts where the one before it ends
  // (or overlaps it) and sits close to it glides from it. 808: about half of the moves, any jump up to an octave; melody:
  // about a third of the steps of a whole tone or less (the sliding bell notes of the Yeat-style leads). The note keeps
  // its pitch and start; the engine glides into it (slide + slideFrom), as the SLIDE switch does.
  function playboiSlides(notes, mode, rnd) {
    const R = rnd || Math.random, ns = notes.map((n) => ({ ...n })).sort((a, b) => a.start - b.start);
    const bass = mode === "bass", odds = bass ? 0.5 : 0.33, far = bass ? 12 : 2;
    for (let i = 1; i < ns.length; i++) {
      const p = ns[i - 1], n = ns[i], d = Math.abs(n.pitch - p.pitch);
      if (!d || d > far || n.start - (p.start + p.length) > 0.26 || n.start - p.start < 0.2) continue;
      if (R() < odds) { n.slide = true; n.slideFrom = p.pitch; }
    }
    return ns;
  }
  // The dice's SLIDE switch (Eman, 4 Nov): the rolled part glides. Between chords (or notes) that
  // follow each other, some glide across (each voice to its partner, low to low), and now and then a
  // chord scoops in from just under itself. Different every roll.
  function diceSlides(notes, sc) {
    const at = new Map();
    for (const n of notes) { const k = n.start.toFixed(3); if (!at.has(k)) at.set(k, []); at.get(k).push(n); }
    const groups = [...at.values()].sort((a, b) => a[0].start - b[0].start);
    const added = [];
    const pair = (from, to) => {
      const lo = [...from].sort((a, b) => a.pitch - b.pitch), hi = [...to].sort((a, b) => a.pitch - b.pitch);
      hi.forEach((n, i) => {
        const q = hi.length === 1 ? lo.reduce((b, x) => (Math.abs(x.pitch - n.pitch) < Math.abs(b.pitch - n.pitch) ? x : b))
          : lo[Math.min(lo.length - 1, hi.length <= lo.length ? Math.round(i * (lo.length - 1) / Math.max(1, hi.length - 1)) : i)];
        n.slide = true; n.slideFrom = q.pitch;
      });
    };
    let last = -9, made = 0;
    groups.forEach((g, i) => {
      const t = g[0].start, prev = groups[i - 1];
      const prevEnd = prev ? Math.max(...prev.map((n) => n.start + n.length)) : -9;
      const key = (x) => x.map((n) => n.pitch).sort((a, b) => a - b).join(","), same = prev && key(prev) === key(g);
      const near = prev && t - prevEnd <= 0.5 + EPS && !same;
      const wide = prev && Math.abs(Math.min(...g.map((n) => n.pitch)) - Math.min(...prev.map((n) => n.pitch))) <= 7;
      const chance = (made === 0 && i > 1 ? 0.7 : 0.4) * (t - last < 1.5 ? 0.4 : 1);
      if (near && wide && Math.random() < chance) {
        const lap = Math.min(0.5, Math.max(0.25, Math.min(...g.map((n) => n.length)) / 2));
        for (const n of prev) n.length = Math.max(n.length, t + lap - n.start);
        pair(prev, g); made++; last = t;
      } else if (t >= 0.5 && Math.random() < 0.18 && t - last > 2) {   // a scoop up into it from just below
        const lo = g.map((n) => { let p = n.pitch - 2; if (sc && !inScale(sc, p)) { p = n.pitch - 1; for (let d = 1; d <= 4 && !inScale(sc, p); d++) p = n.pitch - d; } return { pitch: p, start: t - 0.25, length: 0.375, velocity: Math.max(40, (n.velocity || 100) - 20) }; });
        added.push(...lo); pair(lo, g); made++; last = t;
      }
    });
    return notes.concat(added);
  }
  // brain (optional, Eman 8 Nov): { plan: ChordBrain.roll(...) result, row: TmDice.get() }. With it the chords come from
  // the songs the prompt named (borrowed chords and all) and the row's dials shape rhythm, voices and range.
  // ---- ARP from songs: the song arp bank as the arp dice's data ----------------------------------
  const songArps = () => (window.ToyMachineArps && Array.isArray(window.ToyMachineArps.SONGS) ? window.ToyMachineArps.SONGS : []).filter((p) => Array.isArray(p.steps) && p.steps.some((s) => typeof s.n === "number"));
  const songArpOk = () => !window.KT2_SONG_ARPS_OFF && songArps().length >= 2 && Math.random() < 0.8;   // 1 in 5 presses still uses the plain shapes, for contrast
  let lastSongArps = [];
  const SONG_RATE = { "1/4": 0, "1/8": 1, "1/8t": 1, "1/16": 2, "1/16t": 2, "1/32": 3 };
  // a figure for this press: rate near the chosen speed, minor figures in minor keys, never one of the last few
  function songArpFigure(sc, speed) {
    const bank = songArps(), minor = /min|aeol|dor|phryg/i.test(String(sc && sc.scale || ""));
    const w = (p) => {
      const r = SONG_RATE[p.rate] != null ? SONG_RATE[p.rate] : 2, tags = p.tags || [], hasMinor = tags.indexOf("minor") >= 0 || /minor/i.test(p.key || "");
      let x = 1 / (1 + Math.abs(r - Math.min(speed, 2)));
      if (minor === hasMinor) x *= 1.8;
      if (lastSongArps.indexOf(p.name) >= 0) x *= 0.02;
      return x;
    };
    const pickOne = (skip) => { let tot = 0; for (const p of bank) if (p !== skip) tot += w(p); let r = Math.random() * tot; for (const p of bank) { if (p === skip) continue; r -= w(p); if (r <= 0) return p; } return bank[0]; };
    const a = pickOne(null), tile = (st, n) => { const o = []; while (o.length < n) o.push(...st); return o.slice(0, n); };
    const len = (st) => (st.length <= 8 ? 8 : 16);
    let steps = a.steps.slice(), from = [a.name], how = "song";
    const roll = Math.random();
    if (roll < 0.25) {   // splice: first half of one, second half of another
      const b = pickOne(a), L = Math.max(len(a.steps), len(b.steps));
      steps = tile(a.steps, L).slice(0, L / 2).concat(tile(b.steps, L).slice(L / 2)); from.push(b.name); how = "splice";
    } else if (roll < 0.6 && roll >= 0.45) {   // a new figure in their style: one figure's rhythm, notes walked from which tone follows which across every song figure
      const T = songArpMoves();
      let cur = (a.steps.find((s) => typeof s.n === "number") || { n: 0 }).n;
      steps = a.steps.map((s) => { if (typeof s.n !== "number") return s; const o = { ...s, n: cur }; const nx = T[cur]; if (nx) { let tot = 0; for (const k in nx) tot += nx[k]; let r = Math.random() * tot; for (const k in nx) { r -= nx[k]; if (r <= 0) { cur = +k; break; } } } return o; });
      how = "walk";
    } else if (roll < 0.45) {   // one figure's rhythm (rests, gates, accents) with another's notes in order
      const b = pickOne(a), ns = b.steps.filter((s) => typeof s.n === "number").map((s) => s.n);
      let j = 0; steps = a.steps.map((s) => (typeof s.n === "number" ? { ...s, n: ns[j++ % ns.length] } : s)); from.push(b.name); how = "rhythm";
    }
    lastSongArps = from.concat(lastSongArps).slice(0, 6);
    return { steps, lift: Math.random() < 0.2 ? 12 : 0, from: { how, names: from } };
  }
  // which chord tone follows which, counted over every song figure (rests skipped); grows with the bank
  let songMovesFor = null, songMoves = null;
  function songArpMoves() {
    const bank = songArps();
    if (songMovesFor === bank.length && songMoves) return songMoves;
    const T = {};
    for (const p of bank) { const ns = p.steps.filter((s) => typeof s.n === "number").map((s) => Math.max(-3, Math.min(7, s.n))); for (let i = 0; i < ns.length; i++) { const a = ns[i], b = ns[(i + 1) % ns.length]; (T[a] = T[a] || {})[b] = (T[a][b] || 0) + 1; } }
    songMovesFor = bank.length; songMoves = T; return T;
  }
  window.TmMidiSongArps = { bank: songArps, figure: songArpFigure, moves: songArpMoves };   // for the tests
  // DICE TRAIN (ui/dice-train.js): BASS and MELODY from the real MIDI's own lines most of the time; the hand-made
  // grooves and the cell melody below stay as the floor (about 3 in 10). KT2_DICE_TRAIN_OFF = only those, as before
  const trainOn = () => !window.KT2_DICE_TRAIN_OFF && window.KT2DiceTrain && KT2DiceTrain.ready();
  // SIMPLE DICE (15 Nov): the song figures only, no hand-made grooves or cell melodies
  const trainShare = (k) => (window.KT2_DICE_TRAIN_PART != null ? +window.KT2_DICE_TRAIN_PART : window.KT2DiceSimple && KT2DiceSimple.on() ? 1 : k);
  function rollPart(mode, speed, sc, c, voice, keep, brain) {
    let arpFrom = null, trainedPart = null;
    const beats = Math.max(1, c.beats || 16), ctx = diceContext(c, voice).concat((keep || []).map((n) => ({ ...n, src: "locked" }))), notes = [];
    let H = plan(sc, ctx, beats);
    // the new ears (Eman, 8 Nov): every note already there, weighed by how long it rings, read as real chords
    // (5-note chords, a lone bass, passing notes and all). KT2_DICE_HEAR_OLD = triads every half bar as before.
    const ears = !window.KT2_DICE_HEAR_OLD && window.DiceHarmony;
    let A = null;
    if (ears) {
      A = DiceHarmony.hear({ notes: ctx, sc, beats });
      // the notes end before the clip does (locked chords over the first half): the brain's loop carries on from there
      if (A.heard && !A.drone && !A.messy && brain && brain.plan && DiceHarmony.extend && !window.KT2_DICE_CONT_OLD) {
        const coverEnd = ctx.reduce((m, n) => Math.max(m, n.start + n.length), 0);
        if (coverEnd <= beats - 4 + 1e-6) DiceHarmony.extend(A, brain.plan.segs, coverEnd, sc);
      }
      if (A.heard && A.segs.length && !((A.drone || A.messy) && brain && brain.plan)) H = DiceHarmony.plan(A, sc, beats);
      else if (A.drone || A.messy) H.heard = false;   // over a drone the chords may move (held to the drone's note below); a mess is rolled over fresh
    }
    // a second CHORDS press over the same notes: another rhythm (picked in diceCompute), unless the ears call the
    // pattern noise, where short off-beat hits would rub against the random notes (HOLD stays)
    if (brain && brain.rotate && !(A && A.messy)) brain.row = { ...brain.row, rhythm: brain.rotate };
    const row = brain && brain.row;
    // the chord brain writes the chords when nothing is there to follow; with notes on the timeline, they lead
    // (before: in CHORDS the brain's own loop replaced whatever bass or chords were already playing)
    if (brain && brain.plan && (ears ? !H.heard : (mode === "chords" || !H.heard))) {
      let bp = brain.plan;
      if (A && A.drone && A.segs[0]) bp = { ...bp, segs: DiceHarmony.pedal(bp.segs, A.segs[0].sounding.slice(0, 2), sc) };   // chords that hold the drone's note
      H = brainPlan(bp, sc, beats);
    }
    const v = (base, spread) => Math.max(40, Math.min(127, base + Math.round((Math.random() - 0.5) * (spread || 12) * (row ? 0.6 + row.random : 1))));
    const octShift = row ? [-12, 0, 12][row.range] || 0 : 0;
    // CHORDS (Eman, 9 Nov 01:14): the Pitch card must not jump octaves. It re-voices the same chords darker or brighter:
    // the voicing window moves a 4th / 5th, so notes change places (inversions) instead of the whole stack moving.
    // ARP: the chord tones start a 5th lower / higher, so the arp is re-imagined over the same chords.
    // KT2_DICE_VOICING_OLD = octave steps as in v265-v268
    const VOLD = !!window.KT2_DICE_VOICING_OLD, chShift = row ? (VOLD ? octShift : [-6, 0, 6][row.range] || 0) : 0, arpShift = row ? (VOLD ? octShift : [-7, 0, 7][row.range] || 0) : 0;
    const chordPcs = (at) => (H.chordAt ? H.chordAt(at).pcs : triadPcs(sc, H.at(at)));   // pitch classes, root first
    if (mode === "chords") {
      let prev = null;
      let hits = [[[0, 4]], [[0, 2], [2, 2]], [[0, 0.75], [1.5, 0.75], [3, 0.75]], [[0, 0.4], [0.5, 0.4], [1, 0.4], [1.5, 0.4], [2, 0.4], [2.5, 0.4], [3, 0.4], [3.5, 0.4]]][speed];
      const sevenths = Math.random() < (PR.sev != null ? PR.sev : 0.45);
      const segLen = row ? [8, 4, 2, 1][row.pace] : 2;
      // the row's RHYTHM: hits in 16ths over one bar, each chord re-voiced where it changes. A prompt word that
      // names a feel (stabs, hold, pulse...) wins over the row's AUTO pick, never over a pinned chip.
      if (row && (row.hits || !(row.auto && row.auto.rhythm && PR.speed != null) || (brain && brain.rotate && row.rhythm === brain.rotate))) {   // a rotated rhythm plays even when a mood word set the speed
        const R = row.rhythm;
        hits = row.hits && !window.KT2_DICE_HITS_OFF ? (() => {   // the Rhythm card's own dots (TmDice.toggleHit): each hit lasts until the next one
          const on = row.hits.map((x, i) => (x ? i : -1)).filter((i) => i >= 0), out = [];
          const hl = (!window.KT2_DICE_GRID_OFF || !window.KT2_DICE_NOTEROW_OFF) && row.hitLen;   // NOTE ROW lengths too   // a rhythm from the list: each hit rings as long as in the songs (never past the next)
          on.forEach((i, k) => { const nx = k + 1 < on.length ? on[k + 1] : row.hits.length; let len = (nx - i) * 0.25; if (hl && hl[i] > 0) len = Math.min(len, hl[i] * 0.25); out.push([i * 0.25, Math.max(0.2, len > 0.5 ? len - 0.05 : len * 0.9)]); });
          return out.length ? out : null;
        })() : R === "hold" ? null : R === "pulse" ? [[0, 0.9], [1, 0.9], [2, 0.9], [3, 0.9]] : R === "stabs" ? [[0, 0.7], [1.5, 0.7], [3, 0.7]] : R === "off" ? [[0.5, 0.45], [1.5, 0.45], [2.5, 0.45], [3.5, 0.45]] : "broken";
      }
      const voiceOf = (at) => {
        if (H.chordAt) {
          const ch = H.chordAt(at), n = Math.max(2, Math.min(window.KT2_DICE_STACKN_OLD ? 5 : 6, row ? row.voices : 3));   // 6 STACKED (Eman 11 Nov 23:58)
          const base = 48 + (VOLD ? octShift : 0), tones = ch.ivs.slice(0, n).map((x) => base + ((ch.root - base % 12 + 12) % 12) + x);
          if (!window.KT2_DICE_VOICES_OLD) { for (let k = 0; tones.length < n && k < 3; k++) tones.push(tones[k] + 12); }   // VOICES asks for 5 on a triad or 7th: double the root, 3rd, 5th an octave up (dice sprint 8 Nov)
          return voiceLead(prev, tones.length >= 3 ? tones : tones.concat([tones[0] + 12]), chShift);
        }
        const deg = H.at(at), tones = [0, 2, 4].concat(sevenths && deg !== 6 ? [6] : []).map((x) => degreePitch(sc, deg + x, 48 + sc.tonic + (VOLD ? octShift : 0)));
        return voiceLead(prev, tones, chShift);
      };
      if (row && hits === null) {   // HOLD: one hit per chord, as long as the chord
        for (let at = 0; at < beats - 1e-6;) {
          let next = Math.min(beats, at + segLen);   // and sooner where a heard chord changes (fast chord changes on another sound)
          if (H.changeAt) for (let t = at + 0.5; t < next - 1e-6; t += 0.5) if (H.changeAt(t)) { next = t; break; }
          prev = voiceOf(at); for (const p of prev) notes.push({ pitch: p, start: at, length: next - at, velocity: v(98, 10) });
          at = next;
        }
      } else if (row && hits === "broken") {   // BROKEN: the chord's notes one after another, up and back, in 8ths
        let i = 0;
        for (let at = 0; at < beats - 1e-6; at += 0.5) {
          if (at % segLen === 0 || !prev || (H.changeAt && H.changeAt(at))) { prev = voiceOf(at); i = 0; }
          const seq = prev.concat(prev.slice(1, -1).reverse()), p = seq[i++ % seq.length];
          notes.push({ pitch: p, start: at, length: 0.5 * 0.95, velocity: v(at % 1 === 0 ? 100 : 86, 10) });
        }
      } else {
        const per = row && row.hits && !window.KT2_DICE_HITS_OFF && Array.isArray(hits) && row.hits.length > 16 ? row.hits.length / 4 : 4;   // ROW BARS: a 4 / 8 / 16-bar rhythm loops whole
        for (let bar = 0; bar * per < beats; bar++) for (const [o, len] of hits) {
          const at = bar * per + o; if (at >= beats) continue;
          if (!prev || speed === 0 || o === 0 || o === 2 || (row && (row.hits || at % segLen === 0)) || (H.changeAt && H.changeAt(at))) prev = voiceOf(at);   // custom dots: every hit takes the chord playing there
          const lenTo = H.nextChange ? Math.min(len, H.nextChange(at) - at) : len;   // a held hit ends where a heard chord changes
          for (const p of prev) notes.push({ pitch: p, start: at, length: Math.max(0.25, Math.min(lenTo, beats - at)), velocity: v(speed >= 2 && o % 1 ? 84 : 98, 10) });
        }
      }
      // FILL (Eman, 8 Nov 23:14: "this rhythm, but each chord goes on to the next without space"): the hits keep their
      // starts and every note lasts until the next hit (the last one to the clip end), stopping where a heard chord
      // changes. Works on presets and custom dots alike. KT2_DICE_FILL_OFF = gaps stay
      if (row && row.fill && !window.KT2_DICE_FILL_OFF && notes.length) {
        const st = [...new Set(notes.map((n) => n.start))].sort((a, b) => a - b);
        for (const n of notes) {
          const nx = st.find((x) => x > n.start + 1e-6), hc = H.nextChange ? H.nextChange(n.start) : Infinity;
          n.length = Math.max(n.length, Math.min(nx == null ? beats : nx, hc, beats) - n.start);
        }
        // a held chord stopped early where the chord heard under it changes: the new chord starts right there and holds
        // on to the next hit, so FILL never leaves a hole (night test 9 Nov: 1 in 10 FILL rolls over a melody had gaps).
        // KT2_DICE_FILL_GAP_OLD = the hole stays
        if (!window.KT2_DICE_FILL_GAP_OLD && H.nextChange) {
          for (let guard = 0; guard < 64; guard++) {
            const st = [...new Set(notes.map((n) => +n.start.toFixed(4)))].sort((a, b) => a - b);
            let hole = null;
            for (let i = 0; i < st.length && !hole; i++) {
              const end = Math.max(...notes.filter((n) => Math.abs(n.start - st[i]) < 1e-4).map((n) => n.start + n.length)), nx = i + 1 < st.length ? st[i + 1] : beats;
              if (nx - end > 0.05 && end < beats - 0.05) hole = [end, nx];
            }
            if (!hole) break;
            const [a, b] = hole, stop = Math.min(b, Math.max(a + 0.25, H.nextChange(a + 1e-3) || b));
            prev = voiceOf(a); for (const p of prev) notes.push({ pitch: p, start: a, length: stop - a, velocity: v(90, 10) });
          }
        }
      }
      // LENGTH (Eman, 10 Nov 22:49: how long each note is, apart from the rhythm): SHORT / HALF / LONG ring a quarter /
      // half / 9 tenths of the way to the next hit. LEGATO is FILL above. null = each rhythm's own lengths.
      // KT2_DICE_SIMPLE_OFF = no LENGTH
      if (row && row.len != null && row.len < 3 && !window.KT2_DICE_SIMPLE_OFF && notes.length) {
        const f = [0.25, 0.5, 0.9][row.len], st = [...new Set(notes.map((n) => +n.start.toFixed(4)))].sort((a, b) => a - b);
        for (const n of notes) {
          const nx = st.find((x) => x > n.start + 1e-4), gap = (nx == null ? beats : nx) - n.start;
          n.length = Math.max(0.125, Math.min(gap * f, beats - n.start));
        }
      }
    } else if (mode === "bass") {
      // dice sprint 8 Nov: LOW used to drop an octave under the keyboard (pitches 21-23, clamped to wrong notes); now LOW
      // sits at C1-B1 (24 + tonic), MID where it was, HIGH an octave up. KT2_DICE_BASS_LOW_OLD = the old shift
      const base0 = 36 + sc.tonic + (sc.tonic > 7 ? -12 : 0);
      const base = window.KT2_DICE_BASS_LOW_OLD || !row ? base0 + octShift : row.range === 0 ? 24 + sc.tonic : row.range === 2 ? base0 + 12 : base0;
      const root = (beat) => (H.chordAt ? nearestIn([H.chordAt(beat).root], base + 3) : degreePitch(sc, H.at(beat), base));
      const fifth = (beat) => (H.chordAt ? nearestIn([chordPcs(beat)[2] != null ? chordPcs(beat)[2] : chordPcs(beat)[1]], root(beat) + 5) : degreePitch(sc, H.at(beat) + 4, base));
      // dice sprint 8 Nov: over chords that are already there the bass came out the same on every press (one fixed pattern
      // per speed). Now each press picks one of several grooves per speed, and now and then an approach note ("a": the
      // scale step under the next bar's root) or an octave pop. KT2_DICE_BASS_VAR_OLD = the one fixed pattern
      const PATS = window.KT2_DICE_BASS_VAR_OLD ? null : [
        [[[0, 4, "r"]], [[0, 3, "r"], [3, 1, "f"]], [[0, 3.5, "r"], [3.5, 0.5, "a"]], [[0, 2, "r"], [2, 2, "r"]], [[0, 2.5, "r"], [2.5, 1.5, "o"]]],
        [[[0, 2, "r"], [2, 2, "f"]], [[0, 1.5, "r"], [1.5, 0.5, "r"], [2, 2, "f"]], [[0, 2, "r"], [2, 1, "f"], [3, 1, "o"]], [[0, 2, "r"], [2, 1.5, "f"], [3.5, 0.5, "a"]], [[0, 1, "r"], [1, 1, "o"], [2, 1, "f"], [3, 1, "r"]]],
        [[[0, 0.45, "r"], [0.5, 0.45, "r"], [1, 0.45, "r"], [1.5, 0.45, "o"], [2, 0.45, "r"], [2.5, 0.45, "r"], [3, 0.45, "r"], [3.5, 0.45, "o"]], [[0, 0.45, "r"], [0.5, 0.45, "r"], [1, 0.45, "r"], [1.5, 0.45, "r"], [2, 0.45, "f"], [2.5, 0.45, "f"], [3, 0.45, "r"], [3.5, 0.45, "a"]], [[0, 0.45, "r"], [0.5, 0.45, "o"], [1, 0.45, "r"], [1.5, 0.45, "o"], [2, 0.45, "r"], [2.5, 0.45, "o"], [3, 0.45, "f"], [3.5, 0.45, "o"]], [[0, 0.45, "r"], [0.5, 0.45, "r"], [1, 0.45, "f"], [1.5, 0.45, "r"], [2, 0.45, "r"], [2.5, 0.45, "r"], [3, 0.45, "f"], [3.5, 0.45, "a"]]],
        [[[0, 1.5, "r"], [1.5, 1, "r"], [2.75, 0.5, "o"], [3.25, 0.75, "f"]], [[0, 0.75, "r"], [0.75, 0.75, "r"], [2, 1, "f"], [3.5, 0.5, "o"]], [[0, 2.5, "r"], [2.5, 0.5, "o"], [3, 1, "r"]], [[0, 1, "r"], [1.5, 0.5, "r"], [2, 1.5, "r"], [3.5, 0.5, "a"]], [[0, 3, "r"], [3, 0.5, "o"], [3.5, 0.5, "f"]]],
      ];
      const pick = (arr) => { if (arr.length < 2) return arr[0]; let k; do { k = Math.floor(Math.random() * arr.length); } while (k === lastBassPat); lastBassPat = k; return arr[k]; };   // never the same groove twice running
      const pat = PATS ? pick(PATS[speed]) : [[[0, 4, "r"]], [[0, 2, "r"], [2, 2, "f"]], [[0, 0.45, "r"], [0.5, 0.45, "r"], [1, 0.45, "r"], [1.5, 0.45, "o"], [2, 0.45, "r"], [2.5, 0.45, "r"], [3, 0.45, "r"], [3.5, 0.45, "o"]],
        rnd([[[0, 1.5, "r"], [1.5, 1, "r"], [2.75, 0.5, "o"], [3.25, 0.75, "f"]], [[0, 0.75, "r"], [0.75, 0.75, "r"], [2, 1, "f"], [3.5, 0.5, "o"]], [[0, 2.5, "r"], [2.5, 0.5, "o"], [3, 1, "r"]]])][speed];
      const turn = PATS && speed <= 2 && Math.random() < 0.5 ? rnd(PATS[speed]) : null;   // the last bar may turn around differently
      const scPcsB = scalePcs(sc);
      // BASS ROW (Eman, 15 Nov): the rhythm drawn on the bass's note row wins: a root on every hit, as long as drawn,
      // the whole 4 / 8 / 16-bar rhythm looping. KT2_DICE_BASSROW_OFF = the grooves / song figures only
      const BH = row && row.hits && !window.KT2_DICE_BASSROW_OFF && !window.KT2_DICE_HITS_OFF ? row.hits : null;
      if (BH) {
        const on = BH.map((x, i) => (x ? i : -1)).filter((i) => i >= 0), hl = row.hitLen, N = BH.length, per = N / 4;
        for (let bar = 0; bar * per < beats - 1e-6; bar++) on.forEach((i, k) => {
          const at = bar * per + i * 0.25; if (at >= beats - 1e-6) return;
          const nx = Math.min(beats, bar * per + (k + 1 < on.length ? on[k + 1] : N) * 0.25);
          let len = nx - at; if (hl && hl[i] > 0) len = Math.min(len, hl[i] * 0.25);
          notes.push({ pitch: root(at), start: at, length: Math.max(0.12, len > 0.5 ? len - 0.03 : len * 0.92), velocity: v(i % 4 === 0 ? 108 : 96, 8) });
        });
      }
      const pgHeard = !window.KT2_PGMATCH_LOOSE && ctx.some((n) => n.src === "pg");
      const TB = !BH && trainOn() && Math.random() < trainShare(0.7) ? KT2DiceTrain.bass({ dens: speed, bars: Math.ceil(beats / 4) }) : null;
      if (TB) {   // a bass figure from the songs: its rhythm, and where each note sits against the chord's root
        const tbAt = []; for (let bar = 0; bar * 4 < beats; bar++) for (const [s16] of TB.bars[bar] || []) tbAt.push(bar * 4 + s16 / 4);
        tbAt.sort((a, b) => a - b);
        for (let bar = 0; bar * 4 < beats; bar++) for (const [s16, l16, iv] of TB.bars[bar] || []) {
          const at = bar * 4 + s16 / 4; if (at >= beats) continue;
          // a figure note stops where the next one starts (a long note used to ring under the next bar's first note).
          // KT2_DICE_STACK_OLD = as before
          const tbNx = window.KT2_DICE_STACK_OLD ? null : tbAt.find((x) => x > at + 1e-6);
          let p = root(at) + iv; while (p > base + 19) p -= 12; while (p < Math.max(24, base - 5)) p += 12;
          // PG MATCH heard a vocal / sample: the figure's beat notes and long notes land on its chord tones (passing notes stay)
          if (pgHeard && (s16 % 4 === 0 || l16 >= 4) && !chordPcs(at).includes(pc(p))) p = nearestIn(chordPcs(at), p);
          notes.push({ pitch: p, start: at, length: Math.max(0.12, Math.min(l16 / 4 * 0.95, beats - at, tbNx == null ? 99 : tbNx - at)), velocity: v(s16 % 4 === 0 ? 108 : 94, 8) });
        }
        trainedPart = { how: TB.how, from: TB.from };
      }
      if (!TB && !BH) for (let bar = 0; bar * 4 < beats; bar++) for (const [o, len, k] of (turn && bar === Math.ceil(beats / 4) - 1 ? turn : pat)) {
        const at = bar * 4 + o; if (at >= beats) continue;
        const r = root(at);
        let p = k === "f" ? fifth(at) - (fifth(at) - r > 7 ? 12 : 0) : k === "o" ? (window.KT2_DICE_BASS_VAR_OLD || r + 12 <= base + 19 ? r + 12 : r) : r;   // an octave pop never above the bass register
        if (k === "a") {   // approach: the scale step under the root that comes next (or above it when the line sits low)
          const nx = root(Math.min(beats - 1e-6, at + len)); const up = nx - 1 < base; let q = nx + (up ? 1 : -1); while (!scPcsB.includes(pc(q))) q += up ? 1 : -1; p = nx === r ? r + 12 : q;
        }
        const n = { pitch: p, start: at, length: Math.min(len, beats - at), velocity: v(k === "r" ? 108 : 96, 8) };
        if (speed === 3 && (k === "o" || k === "a") && Math.random() < 0.5) n.slide = true;
        notes.push(n);
      }
      // a bass stays a bass: RANGE on HIGH plus the octave hits could reach past C4 (dice sprint, 8 Nov). KT2_DICE_HEAR_OLD = as before
      if (!window.KT2_DICE_HEAR_OLD && notes.length) { let top = Math.max(...notes.map((n) => n.pitch)); while (top > 60 && Math.min(...notes.map((n) => n.pitch)) - 12 >= 24) { for (const n of notes) n.pitch -= 12; top -= 12; } }
    } else if (mode === "arp" && songArpOk()) {
      // ARP from songs (Eman, 8 Nov): the arp figures found in songs Eman loves (ToyMachineArps.SONGS, 104+ from the
      // arp scan) are the arp dice's main source, behind the scenes. Each press takes one song figure, or splices two
      // (first half of one, second half of another), or plays one figure's rhythm with another's note order. The
      // figure's steps count chord tones up from the root, so it lands on the chords under it, in whatever key.
      // KT2_SONG_ARPS_OFF = the shapes below only
      const step = [1, 0.5, 0.25, 0.25][speed], fig = songArpFigure(sc, speed), seq = fig.steps;
      let lastAt = -1;
      for (let at = 0, k = 0; at < beats - 1e-6; at += step, k++) {
        const st = seq[k % seq.length];
        if (!st || st.n == null || typeof st.n !== "number") continue;
        if (st.prob != null && Math.random() > st.prob) continue;
        const tones = [];
        if (H.chordAt) { const ch = H.chordAt(at), b0 = 60 + (window.KT2_DICE_SONGARP_OCT_OLD ? octShift : arpShift), r0 = b0 + ((ch.root - b0 % 12 + 12) % 12) - (ch.root > 5 ? 12 : 0); for (const x of ch.ivs.slice(0, Math.max(3, Math.min(5, row ? row.voices : 3)))) tones.push(r0 + x); }
        else for (const x of [0, 2, 4]) tones.push(degreePitch(sc, H.at(at) + x, 60 + sc.tonic - (sc.tonic > 5 ? 12 : 0) + (window.KT2_DICE_SONGARP_OCT_OLD ? octShift : arpShift)));   // song arps: DARK/BRIGHT = a 5th, like the plain arp (KT2_DICE_SONGARP_OCT_OLD = octaves)
        tones.sort((a, b) => a - b);
        const n = Math.max(-tones.length, st.n);
        let p = tones[((n % tones.length) + tones.length) % tones.length] + 12 * Math.floor(n / tones.length) + 12 * (st.oct || 0) + fig.lift;
        while (p > 96) p -= 12; while (p < 36) p += 12;
        const vel = Math.round(66 + (st.vel != null ? st.vel : 0.8) * 46 + (at % 1 === 0 ? 6 : 0));
        const len = Math.max(0.1, Math.min(step * Math.min(2, st.gate != null ? st.gate : 1) * 0.9, beats - at));
        const rat = Math.max(1, Math.min(4, st.ratchet || 1));
        for (let r = 0; r < rat; r++) { const t = at + (r * step) / rat; if (t <= lastAt + 1e-6) continue; notes.push({ pitch: p, start: t, length: rat > 1 ? (step / rat) * 0.8 : len, velocity: v(vel, 8) }); lastAt = t; }
      }
      arpFrom = fig.from;
      if (!notes.length) arpFrom = null;
    }
    if (mode === "arp" && !notes.length) {
      const step = [1, 0.5, 0.25, 0.25][speed], up = Math.random() < 0.6, oct = speed === 3 ? 2 : 1;
      // dice sprint 8 Nov: over chords already there the arp came out the same on every press (up or down was the only
      // choice). Now each press also picks a shape: up, down, up-and-back, inside-out, or skipping, and may start an
      // octave higher. KT2_DICE_ARP_VAR_OLD = up/down only
      const shape = window.KT2_DICE_ARP_VAR_OLD ? (up ? "up" : "updown") : rnd(["up", "up", "down", "updown", "inout", "skip", "pairs"]), lift = !window.KT2_DICE_ARP_VAR_OLD && Math.random() < 0.3 ? 12 : 0;
      const gap = window.KT2_DICE_ARP_VAR_OLD || speed === 0 ? 0 : rnd([0, 0, 0, 4, 8, 3]);   // round 2: now and then a rest every 4th, 8th or 3rd step (a hole in the arp)
      const order = (t) => { const d = [...t].reverse(); if (shape === "up") return t; if (shape === "down") return d; if (shape === "updown") return t.concat(t.slice(1, -1).reverse()); if (shape === "inout") { const o = []; for (let a = 0, b = t.length - 1; a <= b; a++, b--) { o.push(t[a]); if (a !== b) o.push(t[b]); } return o; } if (shape === "skip") { const o = []; for (let k = 0; k < t.length; k += 2) o.push(t[k]); for (let k = 1; k < t.length; k += 2) o.push(t[k]); return o; } const o = []; for (let k = 0; k + 1 < t.length; k++) { o.push(t[k]); o.push(t[k + 1]); } return o.length ? o : t; };
      let i = 0, segDeg = null;
      for (let at = 0; at < beats - 1e-6; at += step) {
        const deg = H.at(at);
        if (deg !== segDeg) { segDeg = deg; i = 0; }
        if (gap && Math.round(at / step) % gap === gap - 1) { i++; continue; }
        const tones = [];
        if (H.chordAt) { const ch = H.chordAt(at), b0 = 60 + arpShift, r0 = b0 + ((ch.root - b0 % 12 + 12) % 12) - (ch.root > 5 ? 12 : 0); for (let o = 0; o <= oct; o++) for (const x of ch.ivs.slice(0, Math.max(3, Math.min(5, row ? row.voices : 3)))) tones.push(r0 + x + o * 12); }
        else for (let o = 0; o <= oct; o++) for (const x of [0, 2, 4]) tones.push(degreePitch(sc, deg + x, 60 + sc.tonic - (sc.tonic > 5 ? 12 : 0)) + o * 12);
        const seq = order(tones);
        let p = seq[i++ % seq.length] + (speed === 3 && i % 4 === 0 ? 12 : 0) + lift;
        if (!window.KT2_DICE_ARP_VAR_OLD) { while (p > 96) p -= 12; } else p = Math.min(96, p);   // dice sprint 8 Nov: the cap at 96 (a C) left the key; drop an octave instead
        notes.push({ pitch: p, start: at, length: step * 0.9, velocity: v(at % 1 === 0 ? 104 : 88, 10) });
      }
    } else if (mode !== "chords" && mode !== "bass" && mode !== "arp") {   // melody: a two-bar idea, answered, ending on a chord tone
      const cells = [
        [[[0, 2], [2, 2]], [[0, 3], [3, 1]], [[0, 4]], [[0, 1], [1, 3]]],
        [[[0, 1], [1, 0.5], [1.5, 0.5], [2, 2]], [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]], [[0.5, 0.5], [1, 1], [2, 1.5]], [[0, 1], [1, 1], [2, 0.5], [2.5, 1.5]]],
        [[[0, 0.5], [0.5, 0.5], [1, 0.75], [1.75, 0.25], [2, 0.5], [3, 0.5], [3.5, 0.5]], [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2.5, 0.5], [3, 1]], [[0.5, 0.5], [1, 0.5], [1.5, 1], [2.75, 0.25], [3, 1]]],
        [[[0, 0.25], [0.25, 0.25], [0.5, 0.25], [0.75, 0.25], [1, 0.5], [1.5, 0.5], [2, 0.25], [2.25, 0.25], [2.5, 0.25], [2.75, 0.25], [3, 1]], [[0, 0.5], [0.5, 0.25], [0.75, 0.25], [1, 0.25], [1.25, 0.25], [1.5, 0.5], [2, 1], [3, 0.25], [3.25, 0.25], [3.5, 0.5]]],
      ][speed];
      const idea = [rnd(cells), rnd(cells)], scPcs = scalePcs(sc), lo = 64 + sc.tonic - (sc.tonic > 4 ? 12 : 0) + octShift, hi = lo + 17;
      let p = nearestIn(chordPcs(0), lo + 7), dir = Math.random() < 0.5 ? 1 : -1;
      const contour = [];
      const TM = trainOn() && Math.random() < trainShare(0.75) ? KT2DiceTrain.melody({ minor: SCALES[sc.scale].steps[2] === 3, dens: speed, bars: Math.ceil(beats / 4) }) : null;
      if (TM && TM.notes.length) {   // a phrase from the songs, in this key, its strong notes leaning onto the chords under them
        const base = 60 + sc.tonic - (sc.tonic > 6 ? 12 : 0);
        let ps = TM.notes.map(([s16, l16, d, ch]) => ({ at: s16 / 4, len: l16 / 4, p: degreePitch(sc, d, base) + (ch ? 1 : 0) }));
        const mid = ps.map((x) => x.p).sort((a, b) => a - b)[ps.length >> 1], want = (lo + hi) / 2;
        const sh = Math.round((want - mid) / 12) * 12; ps.forEach((x) => { x.p += sh; });
        for (const x of ps) {
          if (x.at >= beats) continue;
          let q = x.p;
          if (Math.abs(x.at % 2) < 1e-6 && x.len >= 0.5) { const ct = nearestIn(chordPcs(x.at), q); if (Math.abs(ct - q) <= 2) q = ct; }   // beats 1 and 3: a chord tone when one is close
          if (!scPcs.includes(pc(q))) q = nearestIn(scPcs, q);
          notes.push({ pitch: q, start: x.at, length: Math.max(0.15, Math.min(x.len * 0.95, beats - x.at)), velocity: v(x.at % 1 === 0 ? 104 : 90, 10) });
        }
        trainedPart = { how: TM.how, from: TM.from };
      }
      if (!notes.length) for (let bar = 0; bar * 4 < beats; bar++) {
        const cell = idea[bar % 2], answer = bar % 4 >= 2;
        cell.forEach(([o, len], j) => {
          const at = bar * 4 + o; if (at >= beats) return;
          const strong = o % 1 === 0, chord = chordPcs(at);
          if (answer && contour[(bar % 2) * 16 + j] != null && Math.random() < 0.7) p = contour[(bar % 2) * 16 + j] + (Math.random() < 0.5 ? 0 : (dir > 0 ? -2 : 2));
          else {
            if (Math.random() < 0.25 || p > hi - 2 || p < lo + 2) dir = p > hi - 2 ? -1 : p < lo + 2 ? 1 : -dir;
            const mel = brain && brain.plan && brain.plan.stats && brain.plan.stats.mel, leapRate = mel && mel.leap != null ? Math.max(0.08, Math.min(0.5, mel.leap * 0.6)) : (speed >= 2 ? 0.15 : 0.3);
            const leap = Math.random() < leapRate * (PR.leap || 1) * (row ? 0.6 + row.tension + row.random * 0.5 : 1) ? 2 : 1;
            let q = p; for (let k = 0; k < leap; k++) { q += dir; while (!scPcs.includes(pc(q))) q += dir; }
            p = q;
          }
          const melCT = brain && brain.plan && brain.plan.stats && brain.plan.stats.mel && brain.plan.stats.mel.chordtone;
          if (strong || (melCT != null && Math.random() < melCT - 0.5)) p = nearestIn(chord, p);
          else if (!scPcs.includes(pc(p))) p = nearestIn(scPcs, p);
          p = Math.max(lo, Math.min(hi, p));
          if (!window.KT2_DICE_MEL_CLAMP_OLD && !scPcs.includes(pc(p))) p = nearestIn(strong ? chord : scPcs, p);   // dice sprint 8 Nov: the range clamp (64 + tonic = the major 3rd) left the key in minor
          contour[(bar % 2) * 16 + j] = p;
          notes.push({ pitch: p, start: at, length: Math.min(len * (speed >= 2 ? 0.85 : 0.95), beats - at), velocity: v(strong ? 104 : 90, 10) });
        });
      }
      // land the last note on the chord's root or third, a bit longer
      const last = notes[notes.length - 1];
      if (last && !trainedPart) { last.pitch = nearestIn(chordPcs(last.start).slice(0, 2), last.pitch); last.length = Math.max(last.length, Math.min(1.5, beats - last.start)); }
    }
    if (row && row.swing && mode !== "chords") for (const n of notes) { const f = n.start % 1; const sw = row.swing === 2 ? 0.17 : 0.08; if (Math.abs(f - 0.5) < 1e-6) { n.start += sw; n.length = Math.max(0.1, n.length - sw); } }
    // over a drone or a mess the chords come from the brain, but what was HEARD is the drone / the notes: the toast
    // (and the lab's judge) read names as what is there, planNames as the loop that was written over it
    const overIt = A && A.heard && (A.drone || A.messy) && !H.heard;
    const contNames = A && A.contNames && A.contNames.length ? A.contNames : null;
    // names = the chords the roll is built on (heard ones first; over a drone or a mess the brain's loop); planNames = the
    // loop that carried on past the notes; the toast reads what was HEARD over a drone from analysis.names itself
    return { vShift: mode === "chords" ? chShift : mode === "arp" ? arpShift : mode === "melody" ? octShift : 0, notes, arpFrom, trainedPart, heard: H.heard, segs: H.segs, names: contNames ? H.names.filter((x, i) => !A.segs[i] || !A.segs[i].cont) : H.names, planNames: contNames, overIt, ctx, analysis: A };
  }
  // the chord brain's plan in the shape rollPart reads: at(beat) = nearest scale degree (for the old paths),
  // chordAt(beat) = { root (pc), pcs, ivs } straight from the song data, borrowed chords included
  // ---- a FULL pattern (Eman, 8 Nov): the dice never comes back empty-handed --------------------
  // Where notes are locked the dice adds nothing (the 6 Nov rule). When the locks cover (nearly) the whole
  // clip that rule would roll nothing at all, in silence. Instead the dice works WITH what's locked:
  //   CHORDS  thickens them: a 7th, a 9th, an added 6th, the root doubled on top, or a root under them
  //           (one idea per roll, a different one each time you roll again).
  //   BASS    goes under the locked notes: the roots of the chords it hears, below the lowest locked note.
  //   MELODY  and ARP go over them: the same roll, lifted above the highest locked note.
  // When even that can't happen (every colour is already in the chords, or the locked notes already sit
  // at the bottom/top of the keyboard) it says so, in one line. KT2_DICE_FULL_OLD = the old silence.
  // g = the choice shown in the dice row's FULL line: ext (chord extension), add (added tone), voice (voicing)
  const FULL_IDEAS = [
    { k: "7ths", g: "ext", steps: [6], where: "above", say: "7ths on top of your chords" },
    { k: "9ths", g: "ext", steps: [8], where: "above", say: "9ths on top of your chords" },
    { k: "added tone", g: "add", steps: [5], where: "inside", say: "an added 6th inside your chords" },
    { k: "voicing", g: "voice", steps: [0], where: "above", say: "the root doubled on top (wider voicing)" },
    { k: "bass note", g: "voice", steps: [0], where: "below", say: "a root under each chord" },
    { k: "add2", g: "add", steps: [1], where: "inside", say: "an added 2nd inside your chords" },
    { k: "11ths", g: "ext", steps: [10], where: "above", say: "11ths on top of your chords" },
    { k: "add4", g: "add", steps: [3], where: "inside", say: "an added 4th inside your chords" },
  ];
  const FULL_NAMES = { ext: "a chord extension", add: "an added tone", voice: "a voicing" };
  // is the clip (nearly) full of locked notes? The dice row shows the FULL choices when it is.
  const isFull = (keep, beats) => keep.length > 0 && freeBeats(keep, beats) < Math.min(2, beats * 0.25) + 1e-6;
  let fullIdea = -1;
  // the locked notes grouped into blocks that sound together (a block = one chord as played)
  function lockBlocks(keep) {
    const ns = [...keep].sort((a, b) => a.start - b.start), out = [];
    for (const n of ns) {
      const b = out[out.length - 1];
      if (b && n.start < b.end - 1e-6 && Math.abs(n.start - b.start) < 0.26) { b.notes.push(n); b.end = Math.max(b.end, n.start + n.length); }
      else out.push({ start: n.start, end: n.start + n.length, notes: [n] });
    }
    return out;
  }
  // free (unlocked) beats in the clip
  function freeBeats(keep, beats) {
    const spans = keep.map((k) => [Math.max(0, k.start), Math.min(beats, k.start + k.length)]).sort((a, b) => a[0] - b[0]);
    let covered = 0, cur = null;
    for (const sp of spans) { if (cur && sp[0] <= cur[1] + 1e-6) cur[1] = Math.max(cur[1], sp[1]); else { if (cur) covered += cur[1] - cur[0]; cur = [...sp]; } }
    if (cur) covered += cur[1] - cur[0];
    return Math.max(0, beats - covered);
  }
  // the locked notes sounding at `at`
  // CONTINUE LOCKED CHORDS (Eman, 15 Nov 01:17: "if I lock the first half ... the second half should fit, based on what
  // these chords were, not just random ... in the same octaves"; "3 STACKED but it's five notes"). When locked chords sit
  // in one stretch and the dice fills the free time, the new chords are made FROM the locked ones: the same register and
  // the same size (a pinned CHORD SIZE wins), the harmonic rhythm of the locked part, and a musical answer to it, picked
  // per roll: ANSWER (starts like the locked part, the middle moves a third away, ends on the locked cadence), RELATIVE
  // (every chord swapped for the one a third away, two notes shared), MIRROR (the locked chords backwards, ending on
  // their own last chord). The rolled notes keep only their rhythm. Every note in the key. KT2_DICE_CONT_OFF = old roll
  function lockedChords(keep) {
    const G = new Map(); for (const k of keep) { const t = (+k.start).toFixed(3); if (!G.has(t)) G.set(t, []); G.get(t).push(k); }
    return [...G.values()].filter((g) => new Set(g.map((n) => n.pitch)).size >= 3).map((g) => ({ start: g[0].start, len: Math.max(...g.map((n) => n.length)), ps: [...new Set(g.map((n) => n.pitch))].sort((a, b) => a - b) })).sort((a, b) => a.start - b.start);
  }
  function continueLocked(out, keep, sc, beats, o) {
    let L = lockedChords(keep); if (L.length < 1 || !out.length) return null;
    let a = L[0].start, b = Math.max(...L.map((x) => x.start + x.len)), span = b - a; if (span < 0.5) return null;
    const pcs = new Set(scalePcs(sc)), lad = []; for (let p = 12; p <= 115; p++) if (pcs.has(pc(p))) lad.push(p);
    const near = (p) => { let k = 0; for (let i = 1; i < lad.length; i++) if (Math.abs(lad[i] - p) < Math.abs(lad[k] - p)) k = i; return k; };
    const step = (p, d) => lad[Math.max(0, Math.min(lad.length - 1, near(p) + d))];
    const med = (ps) => ps[Math.floor(ps.length / 2)];
    const R = o.seed != null ? (() => { let x = ((o.seed * 2654435761) >>> 0) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; })() : Math.random;
    // a chord a third away (shares two notes), put back where the original sat
    const third = (ps, d) => { let q = [...new Set(ps.map((p) => step(p, d)))].sort((x, y) => x - y); const sh = Math.round((med(ps) - med(q)) / 12) * 12; q = q.map((p) => p + sh); while (q.length < ps.length) q.push(step(q[q.length - 1], 2)); return q; };
    const mode = ["answer", "relative", "mirror"][Math.floor(R() * 3) % 3], dir = R() < 0.5 ? -2 : 2;
    const at = (t) => { const pos = (((t - a) % span) + span) % span; let i = 0; for (let k = 0; k < L.length; k++) if (L[k].start - a <= pos + 1e-6) i = k; return { i, pos }; };
    // LOCKED RHYTHM (Eman, 15 Nov 17:18: "if there is locked chords that already has a pattern, base the new generation on
    // the pattern, continuing it or matching something that works with it on a rhythmic level"). With 2+ locked chord hits
    // the new stretch plays THEIR rhythm (hit starts, lengths, accents), repeated in whole bars from the locked part, only
    // in the free time; the harmony follows the locked chord CHANGES (repeated hits of one chord = one change).
    // Sometimes the last hits of the stretch merge into one held chord (LANDS). KT2_DICE_LOCKRHY_OFF = the dice's own rhythm
    const LR = !window.KT2_DICE_LOCKRHY_OFF && o.lockRhy !== false && L.length >= 2 ? lockRhythm(L, keep, beats, out[0], R) : null;
    if (LR && LR.groups.length) { L = LR.changes; a = L[0].start; b = Math.max(...L.map((x) => x.start + x.len)); span = Math.max(0.5, b - a); }
    // the new stretch as groups (the dice's own rhythm)
    const G = new Map(); for (const n of out) { const t = (+n.start).toFixed(3); if (!G.has(t)) G.set(t, []); G.get(t).push(n); }
    const groups = LR && LR.groups.length ? LR.groups : [...G.values()].map((g) => ({ start: g[0].start, len: Math.max(...g.map((n) => n.length)), vel: Math.max(...g.map((n) => n.velocity || 100)), src: g[0] })).sort((x, y) => x.start - y.start);
    // a long hit over several locked chord changes is split where the locked chords change (their harmonic rhythm)
    const cuts = []; for (let m = Math.floor((0 - a) / span) - 1; a + m * span < beats; m++) for (const x of L) cuts.push(x.start + m * span);
    for (let gi = 0; gi < groups.length; gi++) { const g = groups[gi], e = g.start + g.len, cx = cuts.filter((t) => t > g.start + 0.24 && t < e - 0.24).sort((x, y) => x - y); if (!cx.length) continue;
      const parts = [g.start, ...cx, e], add = []; for (let k = 0; k + 1 < parts.length; k++) add.push({ ...g, start: parts[k], len: parts[k + 1] - parts[k] }); groups.splice(gi, 1, ...add); gi += add.length - 1; }
    const lastStart = groups.length ? groups[groups.length - 1].start : 0, n = o.n;
    const res = [];
    for (const g of groups) {
      const { i, pos } = at(g.start); let ps;
      if (mode === "mirror") { const j = L.length - 1 - i; ps = L[j].ps.slice(); if (g.start >= lastStart - 1e-6 || at(g.start + g.len).i === 0 && g.start + g.len >= beats - 1e-6) ps = L[L.length - 1].ps.slice(); }
      else if (mode === "relative") ps = third(L[i].ps, i % 2 ? -dir : dir);
      else ps = pos < span * 0.5 - 1e-6 || i === L.length - 1 ? L[i].ps.slice() : third(L[i].ps, dir);
      if (n) { ps = ps.slice(); while (ps.length > n) ps.splice(ps.length > 2 ? ps.length - 2 : 1, 1); while (ps.length < n) ps.push(step(ps[ps.length - 1], 2)); }
      for (const p of ps) res.push({ ...g.src, pitch: p, start: g.start, length: g.len, velocity: g.vel });
    }
    return { notes: res, said: "CONTINUES THE LOCKED CHORDS (" + { answer: "ANSWER", relative: "RELATIVE", mirror: "MIRROR" }[mode] + (LR && LR.groups.length ? ", SAME RHYTHM" + (LR.lands ? ", LANDS" : "") : "") + ")", size: L[0].ps.length, rhythm: !!(LR && LR.groups.length) };
  }
  // the locked chord hits' rhythm laid over the free time: { groups, changes, lands }
  function lockRhythm(L, keep, beats, tpl, R) {
    const a0 = Math.floor(L[0].start / 4 + 1e-6) * 4, b0 = Math.ceil(Math.max(...L.map((x) => x.start + x.len)) / 4 - 1e-6) * 4, P = Math.max(4, b0 - a0);
    const vel = (x) => Math.max(...keep.filter((k) => Math.abs(k.start - x.start) < 1e-3).map((k) => k.velocity || 100));
    const pat = L.map((x) => ({ off: x.start - a0, len: x.len, vel: vel(x) }));
    // the free time (not covered by any locked note)
    const sp = keep.map((k) => [k.start, k.start + k.length]).sort((x, y) => x[0] - y[0]), mg = [];
    for (const s of sp) { const l = mg[mg.length - 1]; if (l && s[0] <= l[1] + 1e-6) l[1] = Math.max(l[1], s[1]); else mg.push([...s]); }
    const free = []; let t0 = 0; for (const [x, y] of mg) { if (x > t0 + 1e-6) free.push([t0, Math.min(x, beats)]); t0 = Math.max(t0, y); } if (t0 < beats - 1e-6) free.push([t0, beats]);
    const src = { ...tpl }; delete src.locked;
    const groups = [];
    for (let m = Math.floor(-a0 / P) - 1; a0 + m * P < beats; m++) for (const h of pat) {
      const t = a0 + m * P + h.off, f = free.find(([x, y]) => t >= x - 1e-6 && t < y - 1e-6); if (!f || t < -1e-6) continue;
      const len = Math.min(h.len, f[1] - t); if (len >= 0.12) groups.push({ start: t, len, vel: h.vel, src });
    }
    groups.sort((x, y) => x.start - y.start);
    // LANDS: the last beat of the stretch (when it ends the clip or runs into the locked part) becomes one held chord
    let lands = false;
    if (groups.length > 4 && R() < 0.3) {
      const end = groups[groups.length - 1].start + groups[groups.length - 1].len, from = Math.floor((end - 1e-6) / 2) * 2;   // the last half bar
      const tail = groups.filter((g) => g.start >= from - 1e-6);
      if (tail.length >= 2) { const g0 = tail[0]; groups.splice(groups.length - tail.length, tail.length, { ...g0, len: end - g0.start, vel: Math.max(...tail.map((g) => g.vel)) }); lands = true; }
    }
    // the chord changes: hits in a row with the same notes are one chord
    const changes = []; for (const x of L) { const l = changes[changes.length - 1]; if (l && l.ps.join() === x.ps.join()) l.len = x.start + x.len - l.start; else changes.push({ start: x.start, len: x.len, ps: x.ps }); }
    return { groups, changes, lands };
  }
  const lockedAt = (keep, at) => keep.filter((k) => k.start <= at + 1e-6 && k.start + k.length > at + 1e-6);
  // the locked notes overlapping [a, b)
  const lockedIn = (keep, a, b) => keep.filter((k) => k.start < b - 1e-6 && k.start + k.length > a + 1e-6);
  // `groups` of rolled notes (a chord, or one note) moved by octaves until clear of the locked notes they overlap:
  // `under` = below the lowest locked note, else above the highest. Out of [floor, ceil] = dropped.
  // `fifths` (a bass over a locked bass): tries a fifth up first, then octaves, so the new line stays a bass and not a lead.
  function clearOf(groups, keep, under, floor, ceil, fifths, sc) {
    const out = []; let dropped = 0;
    for (const g of groups) {
      const a = Math.min(...g.map((n) => n.start)), b = Math.max(...g.map((n) => n.start + n.length)), L = lockedIn(keep, a, b);
      let d = 0;
      if (L.length) {
        if (under) { const lo = Math.min(...L.map((k) => k.pitch)); while (Math.max(...g.map((n) => n.pitch)) + d >= lo) d -= 12; }
        else {
          const hi = Math.max(...L.map((k) => k.pitch)), gmin = Math.min(...g.map((n) => n.pitch));
          if (fifths && gmin + 7 > hi && g.every((n) => !sc || inScale(sc, n.pitch + 7))) d = 7;
          else while (gmin + d <= hi) d += 12;
        }
      }
      const moved = g.map((n) => ({ ...n, pitch: n.pitch + d })).filter((n) => n.pitch >= floor && n.pitch <= ceil && !keep.some((k) => k.pitch === n.pitch && k.start < n.start + n.length - 1e-6 && n.start < k.start + k.length - 1e-6));
      dropped += g.length - moved.length; out.push(...moved);
    }
    return { notes: out, dropped };
  }
  const byStart = (ns) => { const m = new Map(); for (const n of ns) { const k = n.start.toFixed(3); if (!m.has(k)) m.set(k, []); m.get(k).push(n); } return [...m.values()]; };
  // mode = the dice's mode, rolled = what rollPart made before the locks cut it, keep = the locked notes
  // pick = ext | add | voice from the dice row's FULL line (null = AUTO: a different idea each roll)
  function fillFull(mode, rolled, keep, sc, beats, pick) {
    const vel = (ns, d) => Math.max(40, Math.min(127, Math.round(ns.reduce((a, n) => a + (n.velocity || 100), 0) / ns.length) - d));
    const pitches = keep.map((k) => k.pitch).sort((a, b) => a - b), median = pitches[Math.floor(pitches.length / 2)];
    if (mode === "chords") {
      const blocks = lockBlocks(keep), thick = blocks.filter((b) => new Set(b.notes.map((n) => n.pitch)).size >= 3);
      // where what's locked is a line (a bass, a melody, a few fast notes), not chords, the rolled chords go over
      // or under it; where it IS chords they get thickened (below). Both can happen in one clip.
      const lineNotes = blocks.filter((b) => !thick.includes(b)).flatMap((b) => b.notes), lineOut = [];
      let lineSay = "";
      if (lineNotes.length) {
        const lp = lineNotes.map((n) => n.pitch).sort((a, b) => a - b), lmed = lp[Math.floor(lp.length / 2)], under = lmed >= 60;
        const inThick = (g) => thick.some((b) => g.some((n) => n.start < b.end - 1e-6 && n.start + n.length > b.start + 1e-6));
        const r = clearOf(byStart(rolled).filter((g) => !inThick(g)), keep, under, under ? 36 : 40, under ? 84 : 91);
        if (r.notes.length && r.dropped <= r.notes.length) { lineOut.push(...r.notes); lineSay = under ? "chords under your locked line" : "chords over your locked line"; }
        if (!thick.length) return lineOut.length ? { notes: lineOut, say: lineSay } : { blocked: under ? "Your locked line sits too low for chords under it. Unlock some notes, or move them up." : "Your locked line sits too high for chords over it. Unlock some notes, or move them down." };
      }
      const room = blocks.filter((b) => new Set(b.notes.map((n) => n.pitch)).size < 6);   // 6 notes is already muddy
      if (!room.length) return lineOut.length ? { notes: lineOut, say: lineSay } : { blocked: "Your chords are as thick as they get. Roll BASS or MELODY over them, or unlock a note or two." };
      const ideas = pick && FULL_IDEAS.some((x) => x.g === pick) ? FULL_IDEAS.filter((x) => x.g === pick) : FULL_IDEAS;
      for (let t = 0; t < ideas.length; t++) {
        const idea = ideas[(fullIdea + 1 + t) % ideas.length], added = [];
        for (const b of room) {
          const ps = b.notes.map((n) => n.pitch), pcs = new Set(ps.map(pc)), lo = Math.min(...ps), hi = Math.max(...ps);
          const deg = hearChords(sc, b.notes.map((n) => ({ pitch: n.pitch, start: 0, length: 1 })), 2)[0].deg;
          for (const st of idea.steps) {
            const want = pc(degreePitch(sc, deg + st, sc.tonic));
            if (idea.k !== "voicing" && pcs.has(want)) continue;   // that colour is already in the chord
            let p = null;
            if (idea.where === "above") { for (let q = hi + 1; q <= hi + 12; q++) if (pc(q) === want) { p = q; break; } }
            else if (idea.where === "below") { for (let q = lo - 1; q >= lo - 12; q--) if (pc(q) === want) { p = q; break; } }
            else { for (let q = lo + 1; q < hi; q++) if (pc(q) === want && !ps.includes(q)) { p = q; break; } if (p == null) for (let q = hi + 1; q <= hi + 12; q++) if (pc(q) === want) { p = q; break; } }
            if (p == null || p < LOW || p > HIGH || ps.includes(p)) continue;
            if (idea.where === "above" && p > 91) continue;   // not up in the whistle register
            if (idea.where === "below" && p < 30) continue;
            added.push({ pitch: p, start: b.start, length: Math.max(0.25, b.end - b.start), velocity: vel(b.notes, 10) });
          }
        }
        if (added.length) { fullIdea = (fullIdea + 1 + t) % ideas.length; return { notes: added.concat(lineOut), say: idea.say + (lineSay ? " + " + lineSay : ""), k: idea.k, g: idea.g }; }
      }
      if (lineOut.length) return { notes: lineOut, say: lineSay };
      if (pick && ideas.length < FULL_IDEAS.length) { const other = Object.keys(FULL_NAMES).filter((g) => g !== pick).map((g) => FULL_NAMES[g].replace(/^an? /, "")); return { blocked: `Your chords already have ${FULL_NAMES[pick].replace(/^an? /, "every ")} the key offers. Try ${other.join(" or ")}, or roll BASS or MELODY over them.` }; }
      return lineOut.length ? { notes: lineOut, say: lineSay } : { blocked: "Your chords already have every colour the key offers. Roll BASS or MELODY over them, or unlock a note or two." };
    }
    // BASS goes under (or, when what's locked is itself a bass, an octave over it); MELODY and ARP go over
    // (or under a locked line that already sits at the top). The roll it already made, moved clear of the locks.
    const lo = pitches[0], hi = pitches[pitches.length - 1];
    let under, floor, ceil, say;
    if (mode === "bass") { under = lo >= 40; floor = under ? 28 : 36; ceil = under ? 60 : 59; say = under ? "a bass under your locked notes" : "a second bass over your locked bass"; }   // a bass stays under C4
    else { under = hi >= 88 && median >= 76; floor = under ? 48 : 40; ceil = under ? 84 : 96; say = (mode === "arp" ? "an arp " : "a melody ") + (under ? "under your locked line" : "over your locked notes"); }
    const r = clearOf(byStart(rolled), keep, under, floor, ceil, mode === "bass" && !under, sc);
    if (!r.notes.length || r.dropped > r.notes.length) return { blocked: mode === "bass" ? "No room for another bass around the locked notes. Roll MELODY or CHORDS over them, or unlock some." : "No room for a line around the locked notes. Unlock some, or move them." };
    return { notes: r.notes, say };
  }
  window.TmMidiFull = { fillFull, lockBlocks, freeBeats, isFull, ideas: FULL_IDEAS, names: FULL_NAMES };   // for the dice row and the tests
  // a 2-note chord (root + fifth) is named as the chord the key makes on that root: in F minor Db5 reads Db, F5 reads Fm
  function keyTriadName(sc, root, fallback) {
    const st = (SCALES[sc.scale] || {}).steps; if (!st || st.length !== 7 || root == null) return fallback;
    const i = st.indexOf(pc(root - sc.tonic)); if (i < 0) return fallback;
    const at = (k) => st[(i + k) % 7] + (i + k >= 7 ? 12 : 0) + sc.tonic + 48;
    return chordName([at(0), at(2), at(4)]) || fallback;
  }
  function homeChord(bp, sc, bars, pop) {
    const st = (SCALES[sc.scale] || {}).steps; if (!st || st.length !== 7) return;
    const t = pc(sc.tonic), ivs = [0, st[2], st[4]];
    for (let w = 0; w < bars * 4; w += 32) {
      const win = bp.segs.filter((x) => x.beat >= w - 1e-6 && x.beat < w + 32 - 1e-6); if (!win.length) continue;
      // anchored, not forced (Eman 00:45): the home chord is the first chord OR the last one (iv or VI may start and land
      // on i), so a sample labelled in that key sits on top. Already so = left alone. Else the chords are turned round so
      // they land on home, or home takes the last chord when it is not in there (KT2_DICE_HOME_FIRST = start on it instead)
      const ch = []; for (const x of win) if (!ch.length || ch[ch.length - 1].root !== x.root || String(ch[ch.length - 1].ivs) !== String(x.ivs)) ch.push(x);
      if (pc(win[0].root) === t || pc(win[win.length - 1].root) === t) continue;
      const first = !!window.KT2_DICE_HOME_FIRST, F = ["root", "ivs", "pcs", "name", "tok", "baseTok", "out"], c = win.map((x) => Object.fromEntries(F.map((f) => [f, x[f]])));
      const ks = win.map((x, i) => (pc(x.root) === t ? i : -1)).filter((i) => i >= 0);
      if (ks.length) { const k = first ? ks[0] : (ks[ks.length - 1] + 1) % win.length; win.forEach((x, i) => Object.assign(x, c[(i + k) % win.length])); continue; }
      const x = first ? win[0] : win[win.length - 1], n = x.ivs ? x.ivs.length : 3, full = [0, st[2], st[4], st[6] + 0, st[1] + 12, st[3] + 12].slice(0, Math.max(2, n));
      x.root = t; x.ivs = n <= 2 ? [0, 7] : full; x.pcs = x.ivs.map((i) => pc(t + i)); x.name = keyTriadName(sc, t, x.name); x.home = 1;
    }
  }
  function brainPlan(bp, sc, beats) {
    const segs2 = [];   // the old 2-beat segments for the toast
    const segAt = (beat) => { let s = bp.segs[0]; for (const x of bp.segs) if (x.beat <= beat + 1e-6) s = x; return s; };
    const degOf = (root) => { let best = 0, bd = 99; for (let d = 0; d < 7; d++) { const dd = Math.min(pc(degreePitch(sc, d, sc.tonic) - root), pc(root - degreePitch(sc, d, sc.tonic))); if (dd < bd) { bd = dd; best = d; } } return best; };
    for (let s = 0; s < Math.ceil(beats / 2); s++) segs2.push({ deg: degOf(segAt(s * 2).root) });
    return { segs: segs2, heard: false, at: (beat) => degOf(segAt(beat).root), chordAt: (beat) => segAt(beat), names: bp.segs.map((x) => spell(!window.KT2_FLATS_OFF && /5$/.test(x.name) ? keyTriadName(sc, x.root, x.name) : x.name, sc)) };
  }

  // The whole roll as one pure step (8 Nov, dice sprint): brain plan -> rollPart -> prompt shaping -> slides ->
  // fit around the locked notes. rollWith calls it with the live clip; the headless tests (tests/kt2/dicelab) call it
  // with a made-up one, so thousands of rolls can be checked without a browser.
  // I: { mode, speed, sc, c (clip: beats, notes, stack), voice (null = main sound), keep (locked notes), text (prompt),
  //      p (parseDicePrompt result), all (ONLY KEY off), recent (loop keys to avoid), slide, setBars(beats) (LENGTH on AUTO) }
  // O: { notes, heard, segs, names, brain (ChordBrain.roll result or null), speed (new knob value or null) }
  // the MOOD card's words join the prompt's for the songs the chords come from (TmDice.withMood; KT2_DICE_MOOD_OFF = none)
  const moodText = (t) => (window.TmDice && TmDice.withMood ? TmDice.withMood(t || "") : t || "");
  // MOOD DNA (ui/kt2-mood-dna.js, Eman 9 Nov 12:55: "make it sound villain every time"): with a mood (the MOOD card, or a
  // mood word in the prompt) the chords come from the mood's own moves in the mood's scale (same root note), voiced the
  // mood's way, and each roll is checked against the mood: up to 8 tries, the best one lands. A second mood word blends
  // ("villain but playful" = villain chords, playful motion). KT2_MOOD_DNA_OFF = the chord brain's words only, as before
  // STACKED CHORDS (Eman, 11 Nov 23:58: "3 in total ... don't add the extra bass note one octave down"): a chord is its
  // notes stacked close, CHORD SIZE of them, nothing under it; a mood picks the chords but no longer re-voices them with a
  // far bass note (bass is for a bass sound). KT2_DICE_NOBASS_OLD = the mood's own voicing with its bass note
  // EXACT STACK (Eman, 15 Nov 05:25: "if it's 3 then it should be 3 notes per chord, if it's 4 then 4"): the number on
  // the STACKED card is the number of notes heard in every chord, whatever made them (voicing, octave doubling, the
  // 2-note fill-up, the mood's voicing, the fit over what's there, PG MATCH, the tools, EXPERIMENTAL, locked-chord
  // continuation, snapping to the key, FILL / LEGATO overlaps). It runs last, on every roll and live card turn:
  //  - each chord hit (notes starting together) gets exactly N different notes: doubled octaves go first, then the
  //    least needed note (2 = root + fifth; else root, 3rd, 5th, 7th, 9th...). Too few: the chord's missing tone,
  //    else a note doubled an octave up, never on a note already there.
  //  - a note still ringing when the next chord starts is cut there, so chords never overlap.
  //  - BASS button notes and the TOP LINE voice count as one of the N each (so 3 + BASS = bass + 2 above).
  //  - locked notes are never touched, but they count: a hit next to a locked note sounding gets fewer new notes.
  //  - BROKEN (one note at a time) keeps its single notes; only the overlaps are cut.
  // KT2_DICE_EXACT_OLD = as before (the number was only a wish).
  const EX_RANK2 = [0, 7, 5, 3, 4, 10, 11, 2, 9, 8, 6, 1], EX_RANK = [0, 4, 3, 7, 10, 11, 2, 5, 9, 6, 8, 1];
  function exactStack(notes, N, o) {
    o = o || {};
    N = Math.max(1, Math.min(8, Math.round(N || 0)));
    if (!N || !notes || !notes.length) return notes;
    const kept = new Set(o.keep || []), isFixed = (n) => kept.has(n) || n.locked || n.muted;
    const fixed = notes.filter(isFixed), free = notes.filter((n) => !isFixed(n));
    const tl = free.filter((n) => n.tl), bs = free.filter((n) => !n.tl && n.bs), body = free.filter((n) => !n.tl && !n.bs);
    const nb0 = Math.max(1, N - (tl.length ? 1 : 0) - (bs.length ? 1 : 0));
    const at = (n) => Math.round(n.start * 1000);
    const by = new Map(); for (const n of body) { const k = at(n); if (!by.has(k)) by.set(k, []); by.get(k).push(n); }
    const ringing = (t) => fixed.filter((f) => f.start <= t + 1e-6 && f.start + f.length > t + 1e-6);
    const out = [];
    for (const k of [...by.keys()].sort((a, b) => a - b)) {
      const seen = new Set(), g = by.get(k).filter((n) => (seen.has(n.pitch) ? false : (seen.add(n.pitch), true))).sort((a, b) => a.pitch - b.pitch);
      const t = g[0].start, lockHere = new Set(ringing(t).map((f) => f.pitch));
      let gg = g.filter((n) => !lockHere.has(n.pitch));
      const nb = Math.max(0, nb0 - lockHere.size);
      if (o.broken && gg.length <= nb) { out.push(...gg); continue; }   // one note at a time: nothing to fill
      const root = o.rootAt ? o.rootAt(t, gg.map((n) => n.pitch)) : null, r0 = root == null ? (gg.length ? pc(gg[0].pitch) : 0) : root;
      const rank = nb <= 2 ? EX_RANK2 : EX_RANK, score = (p) => rank.indexOf(pc(p - r0));
      while (gg.length > nb) {   // too many: a doubled note class first (the higher copy), else the least needed tone
        let drop = -1;
        for (let i = gg.length - 1; i >= 0 && drop < 0; i--) if (gg.some((m, j) => j !== i && pc(m.pitch) === pc(gg[i].pitch))) drop = i;
        if (drop < 0) { let w = -1; gg.forEach((m, i) => { const s = score(m.pitch); if (s > w || (s === w && i > drop)) { w = s; drop = i; } }); }
        gg = gg.filter((_, i) => i !== drop);
      }
      if (gg.length && gg.length < nb) {   // too few: the chord's missing tones close to the stack, then octave doubles up
        const want = o.pcsAt ? o.pcsAt(t) : null, have = () => new Set(gg.map((n) => n.pitch).concat([...lockHere]));
        const tpl = gg[gg.length - 1], add = (p) => { gg.push({ ...tpl, pitch: p, tl: undefined, bs: undefined }); gg.sort((a, b) => a.pitch - b.pitch); };
        if (want) for (const q of want) {
          if (gg.length >= nb) break;
          if (gg.some((n) => pc(n.pitch) === pc(q))) continue;
          const lo = gg[0].pitch, hi = gg[gg.length - 1].pitch; let best = null;
          for (let p = lo - 12; p <= hi + 12; p++) if (pc(p) === pc(q) && !have().has(p) && (best == null || Math.abs(p - (lo + hi) / 2) < Math.abs(best - (lo + hi) / 2))) best = p;
          if (best != null) add(best);
        }
        for (let up = 12; gg.length < nb && up <= 36; up += 12) for (const n of gg.slice()) { if (gg.length >= nb) break; const p = n.pitch + up; if (!have().has(p) && p <= 108) add(p); }
      }
      out.push(...gg);
    }
    // nothing rings into the next chord: a note is cut where the next hit of its own voice starts
    const cut = (arr) => {
      const st = [...new Set(arr.map(at))].sort((a, b) => a - b);
      return arr.map((n) => { const nx = st.find((s) => s > at(n)); if (nx == null || n.start + n.length <= nx / 1000 + 1e-6) return n; return { ...n, length: Math.max(0.05, nx / 1000 - n.start) }; });
    };
    return fixed.concat(cut(out), cut(tl), cut(bs));
  }
  // NO STACKED NOTES (Eman, 15 Nov: the bass dice put short notes inside the tail of a long note on the same row).
  // Runs on every roll, live card turn and re-rhythm, after the pitches are clamped: two notes on one row never lie
  // on top of each other. The earlier one is cut where the later one starts; two starting together keep the longer.
  // A locked note (or another sound's note) is never touched: a rolled note running into it is cut, one starting inside it goes. A BASS roll is
  // one line: a note also stops where the next note starts, on any row, unless that next note slides from it.
  // KT2_DICE_STACK_OLD = as before.
  function diceNoStack(notes, o) {
    if (window.KT2_DICE_STACK_OLD || !notes || notes.length < 2) return notes;
    o = o || {};
    const kept = new Set(o.keep || []), fixed = (n) => kept.has(n) || n.locked || !!n._v;
    const E = 1e-6, MIN = 1 / 64, gone = new Set();
    const ns = notes.map((n) => (fixed(n) ? n : { ...n }));
    const rows = new Map();
    for (const n of ns) { const k = n.pitch + "|" + (n._v || ""); if (!rows.has(k)) rows.set(k, []); rows.get(k).push(n); }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      row.sort((a, b) => a.start - b.start || (fixed(b) ? 1 : 0) - (fixed(a) ? 1 : 0) || b.length - a.length);
      let prev = null;
      for (const n of row) {
        if (!prev || prev.start + prev.length <= n.start + E) { prev = n; continue; }
        if (n.start - prev.start < MIN) {   // starting together: one note is enough (a locked one stays)
          if (!fixed(n)) { gone.add(n); continue; }
          if (!fixed(prev)) { gone.add(prev); prev = n; continue; }
        }
        if (!fixed(prev)) { prev.length = n.start - prev.start; prev = n; continue; }
        if (!fixed(n)) { gone.add(n); continue; }   // it starts inside a locked note: it goes (as the dice's lock rule does)
        if (n.start + n.length > prev.start + prev.length) prev = n;   // two locked notes: the one that rings longer counts
      }
    }
    let out = ns.filter((n) => !gone.has(n));
    if (o.mono) {
      const line = out.filter((n) => !n.muted && !n._v).sort((a, b) => a.start - b.start);
      for (let i = 0; i < line.length; i++) {
        const n = line[i]; if (fixed(n)) continue;
        const nx = line.slice(i + 1).find((m) => m.start > n.start + MIN);
        if (!nx || n.start + n.length <= nx.start + E) continue;
        if (nx.slide && nx.pitch !== n.pitch && nx.start + 0.5 >= n.start + n.length) continue;   // a slide glides from the note it overlaps
        n.length = Math.max(MIN, nx.start - n.start);
      }
    }
    return out;
  }
  // the most notes heard at once, and every chord hit's size (the smoke test and tests/kt2/stackexact.js read these)
  function stackCount(notes) {
    const by = new Map(); for (const n of notes) { if (n.muted) continue; const k = Math.round(n.start * 1000); if (!by.has(k)) by.set(k, new Set()); by.get(k).add(n.pitch); }
    const hits = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([k]) => {
      const t = k / 1000, s = new Set(); for (const n of notes) if (!n.muted && n.start <= t + 1e-6 && n.start + n.length > t + 1e-6) s.add(n.pitch);
      return { t, n: s.size };
    });
    return { hits, max: hits.reduce((m, h) => Math.max(m, h.n), 0), min: hits.reduce((m, h) => Math.min(m, h.n), 99) };
  }
  const stackPlain = () => !window.KT2_DICE_NOBASS_OLD && !window.KT2_DICE_SIMPLE_OFF;
  const MDNA = () => (window.KT2MoodDNA && KT2MoodDNA.on() && !window.KT2_DICE_ROW_OLD && window.TmDice ? KT2MoodDNA : null);
  function moodOf(I) {
    const D = MDNA(); if (!D || I.mode !== "chords") return null;
    const row = TmDice.get(I.text || "", I.mode), words = D.moodsIn(I.text || ""), mood = (row.moodName && D.byKey[row.moodName] ? row.moodName : null) || words[0];
    if (!mood) return null;
    // OWN SOURCES (Eman, 12 Nov): only the moods made from Eman's own songs (DREAMCORE, GRIEF, LIMINAL) write their own
    // chords; the theory moods just add their word, and the chords come from Eman's songs. KT2_OWN_SOURCES_OFF = all moods
    if (!(window.KT2Use ? KT2Use("moods") : !!window.KT2_OWN_SOURCES_OFF) && !(D.byKey[mood] && D.byKey[mood].core)) return null;   // UNPERSONAL DATA page: MOOD CHORDS switch
    return { mood, blend: words.find((k) => k !== mood) || null, row };
  }
  // THE PICKED KEY ALWAYS WINS (Eman, 10 Nov 20:46: "A minor, changed the mood to PSYCHEDELIC, it made chords not even
  // in the scale"). Every roll and every live card turn writes only notes on open rows of the key set in the top bar,
  // with the in-key switch on or off: a mood bends its chords into the key (KT2MoodDNA.bend) instead of switching to
  // its own scale, the dice no longer follows the key of notes already there, and whatever still lands on a grey row
  // (a LIFT, a RUB, a slide) moves to the closest open row. KT2_DICE_OUTKEY = old (moods/tools could leave the key).
  const DICE_STRICT = () => !window.KT2_DICE_OUTKEY;
  const keyOpen = (sc, p) => { const base = inScale(sc, p); return (sc.flip || []).includes(p) ? !base : base; };
  function snapToKey(notes, sc, keep) {
    if (!sc || !SCALES[sc.scale]) return notes;
    const kept = new Set(keep || []), out = [], at = new Map();
    const slot = (n) => Math.round(n.start * 1000) + (n._v ? "|" + n._v : "");
    for (const n of notes) if (kept.has(n) || keyOpen(sc, n.pitch)) { const k = slot(n); if (!at.has(k)) at.set(k, new Set()); at.get(k).add(n.pitch); }
    for (const n of notes) {
      if (kept.has(n) || keyOpen(sc, n.pitch)) { out.push(n); continue; }
      const k = slot(n), here = at.get(k) || new Set(); let to = null;
      for (let d = 1; d <= 6 && to == null; d++) for (const q of [n.pitch - d, n.pitch + d]) if (to == null && keyOpen(sc, q) && !here.has(q)) to = q;
      if (to == null) continue;   // only doubles left: the note goes
      here.add(to); at.set(k, here); out.push({ ...n, pitch: to });
    }
    return out;
  }
  function diceCompute(I) {
    if (!DICE_STRICT()) { const r0 = diceComputeAny(I); if (r0 && r0.notes) r0.notes = exactRoll(r0, I); return r0; }
    const r = diceComputeAny({ ...I, all: false });
    if (r && r.notes) r.notes = snapToKey(r.notes, I.sc, I.keep);
    delete r.moodScale; r.sc = I.sc;
    if (r && r.notes) r.notes = exactRoll(r, I);
    return r;
  }
  // the STACKED card's number on a finished CHORDS roll (EXACT STACK above)
  function stackN(row) { return row && row.voices != null ? Math.max(2, Math.min(6, Math.round(row.voices))) : null; }
  function exactRoll(r, I) {
    if (window.KT2_DICE_EXACT_OLD || I.mode !== "chords" || !r.notes.length) return r.notes;
    const N = stackN(r.row); if (!N) return r.notes;
    const segs = !(r.analysis && r.analysis.heard) && r.brain && r.brain.segs && r.brain.segs.length && r.brain.segs[0].root != null ? r.brain.segs : null;
    const segAt = (t) => { let x = segs[0]; for (const sg of segs) if (sg.beat <= t + 1e-6) x = sg; return x; };
    const keep = new Set(I.keep || []), starts = new Map();
    for (const n of r.notes) if (!keep.has(n) && !n.locked && !n.tl && !n.bs) { const k = Math.round(n.start * 1000); starts.set(k, (starts.get(k) || 0) + 1); }
    const singles = [...starts.values()].filter((x) => x === 1).length, broken = starts.size > 2 && singles > starts.size / 2;
    return exactStack(r.notes, N, { keep: I.keep, broken,
      rootAt: (t, ps) => (segs ? segAt(t).root : ps.length ? chordRoot(ps) : null),
      pcsAt: segs ? (t) => { const sg = segAt(t); return sg.pcs || (sg.ivs || []).map((x) => pc(sg.root + x)); } : null });
  }
  function diceComputeAny(I) {
    const MD = moodOf(I); if (!MD) return diceCompute0(I);
    const D = MDNA(), m = D.byKey[MD.mood], sc = DICE_STRICT() ? I.sc : I.all ? I.sc : { ...I.sc, scale: D.scaleFor(m, I.sc.scale), flip: [] };
    const pins = MD.row.auto ? { voices: !MD.row.auto.voices, range: !MD.row.auto.range, rhythm: !MD.row.auto.rhythm } : {};
    let best = null;
    for (let t = 0; t < 8; t++) {
      const r = diceCompute0({ ...I, sc, _md: { ...MD, t } });
      const j = D.judge(r.notes, { mood: MD.mood, blend: MD.blend, tonic: (r.sc || sc).tonic, pins });
      if (!best || j.score > best.j.score) best = { r, j };
      if (j.ok) break;
    }
    const r = best.r; r.moodJudge = best.j; r.mood = MD; if (!r.sc) r.sc = sc;
    if (sc.scale !== I.sc.scale) r.moodScale = sc.scale;
    return r;
  }
  function diceCompute0(I) {
    const c = I.c, mode = I.mode, p = I.p || {}, keep = I.keep || [];
    let speed = I.speed, r, brain = null, speedOut = null;
    // the chord brain + the row (Eman, 8 Nov): the prompt's words pick the songs, the dials shape the roll
    if (!window.KT2_DICE_ROW_OLD && window.ChordBrain && window.TmDice) {
      const text = I.text || "", row = TmDice.get(text, mode);
      // LENGTH on AUTO: the clip grows or shrinks to what the chord loop needs (4 bars, 8 when a chord lasts 2 bars)
      if (window.KT2_DICE_LENGTH_OLD && row.auto && row.auto.bars && row.bars && Math.abs((c.beats || 16) - row.bars * 4) > 1e-6 && mode === "chords" && I.setBars) I.setBars(row.bars * 4);
      const bars = Math.max(1, Math.round((c.beats || 16) / 4));
      const mdPlan = (sc) => (I._md ? MDNA().plan({ mood: I._md.mood, tonic: sc.tonic, scale: sc.scale, bars: Math.max(1, Math.round((c.beats || 16) / 4)), pace: row.pace, paceAuto: !row.auto || !!row.auto.pace, inKey: !I.all, seed: I.seed != null ? I.seed + I._md.t * 7919 : null, avoid: I.recent || [], toks: I.toks }) : null);
      const bp = mdPlan(I.sc) || ChordBrain.roll({ tonic: I.sc.tonic, scale: I.sc.scale, bars, pace: row.pace, colour: row.colour, tension: row.tension, random: row.random, voices: row.voices, pop: row.pop, text: moodText(text), avoid: I.recent || [], inKey: !I.all, seed: I.seed, toks: I.toks });   // ONLY KEY on = no borrowed chords
      // HOME CHORD (Eman, 15 Nov 00:44-00:45: a vocal in F minor expects Fm as home, but keep the creative choices): every
      // 8 bars of a roll start OR land on the key's own chord (Fm in F minor). Not for
      // EXPERIMENTAL or over locked chords. KT2_DICE_HOME_OFF = as rolled
      if (!window.KT2_DICE_HOME_OFF && mode === "chords" && bp && bp.segs && bp.segs.length && !row.exp && !keep.length) homeChord(bp, I.sc, Math.max(1, Math.round((c.beats || 16) / 4)), row.pop == null ? 0.5 : row.pop);
      brain = { plan: bp, row };
      // a second press over the same notes plays the chords differently (dice sprint 8 Nov): with RHYTHM on AUTO and
      // nothing in the prompt about the feel, the rhythm rotates through the ones not used lately. KT2_DICE_RHY_VAR_OLD = off
      const tkey = (I.text || "").trim().toLowerCase(), chordFits = (I.recentFits || []).map(String).filter((f) => f.startsWith("chords:") && (f.split("|")[2] || "") === tkey);   // only earlier CHORDS presses with the same prompt count: a new prompt is a first press
      if (!window.KT2_DICE_RHY_VAR_OLD && mode === "chords" && row.auto && row.auto.rhythm && !row.hits && chordFits.length) {   // custom dots never rotate   // over an empty pattern too: a second press is another idea, not the same one
        // a mood word that set the speed ("dreamy" = hold, "bouncy" = stabs) keeps its family; a pinned RHYTHM chip never rotates
        const fam = p.speed == null ? ["hold", "pulse", "stabs", "off", "broken", "plain"] : [["hold", "pulse"], ["pulse", "hold", "stabs"], ["stabs", "off", "broken"], ["broken", "off", "stabs"]][Math.max(0, Math.min(3, p.speed))];
        const used = new Set(chordFits.map((x) => x.split("|")[1]).filter(Boolean)), pool = fam.filter((x) => !used.has(x) && x !== row.rhythm);
        if (pool.length) brain.rotate = pool[Math.floor(Math.random() * pool.length)];   // rollPart applies it once it knows the pattern is not noise
      }
      // the row's NOTES density and FEEL stand in for the old speed knob on melody, bass and arp
      if (mode !== "chords") speed = speedOut = Math.max(0, Math.min(3, row.dens));
    }
    PR = p; try { r = rollPart(mode, speed, I.sc, c, I.voice, keep, brain); } finally { PR = {}; }
    // the notes already there sound like another key than the one set (a pad in F major under an A minor setting):
    // the dice follows the notes, not the picker, unless the prompt named a key. KT2_DICE_KEYFOLLOW_OLD = the picker wins
    if (!window.KT2_DICE_KEYFOLLOW_OLD && !DICE_STRICT() && r.analysis && r.analysis.heard && r.analysis.keyHint && !r.analysis.messy && p.tonic == null && !p.scale) {
      const kh = r.analysis.keyHint, sc2 = { ...I.sc, tonic: kh.tonic, scale: kh.scale, flip: [] };
      if (brain) brain = { ...brain, plan: (I._md && MDNA().plan({ mood: I._md.mood, tonic: sc2.tonic, scale: sc2.scale, bars: Math.max(1, Math.round((c.beats || 16) / 4)), pace: brain.row.pace, paceAuto: !brain.row.auto || !!brain.row.auto.pace, inKey: !I.all, seed: I.seed != null ? I.seed + I._md.t * 7919 : null, avoid: I.recent || [], toks: I.toks })) || ChordBrain.roll({ tonic: sc2.tonic, scale: sc2.scale, bars: Math.max(1, Math.round((c.beats || 16) / 4)), pace: brain.row.pace, colour: brain.row.colour, tension: brain.row.tension, random: brain.row.random, voices: brain.row.voices, pop: brain.row.pop, text: moodText(I.text || ""), avoid: I.recent || [], inKey: !I.all, seed: I.seed, toks: I.toks }) };
      PR = p; try { r = rollPart(mode, speed, sc2, c, I.voice, keep, brain); } finally { PR = {}; }
      r.sc = sc2; r.keyFollowed = kh;
    }
    r.brain = brain ? brain.plan : null; r.row = brain ? brain.row : null; r.speed = speedOut;
    // custom rhythm dots and FILL are what Eman set by hand: a sparse prompt word ("ambient") must not thin those hits
    // out or shorten the filled chords again
    const rw = brain && brain.row, own = (mode === "chords" || (mode === "bass" && !window.KT2_DICE_BASSROW_OFF)) && rw && (rw.hits || rw.fill);
    r.notes = shapeByPrompt(r.notes, own ? { ...p, dens: Math.max(0, p.dens || 0), len: rw.fill && p.len && p.len < 1 ? 1 : p.len } : p, Math.max(1, c.beats || 16));
    // fit it around what is there (Eman, 8 Nov): a free register, no doubled notes, no semitone rubs, and a
    // different answer each roll (under it / fifths / in the gaps / an octave up...). KT2_DICE_HEAR_OLD = off
    if (r.analysis && r.analysis.heard && window.DiceHarmony && !window.KT2_DICE_HEAR_OLD) {
      // the fits already used, for this mode only (a BASS roll before a CHORDS roll must not count as its first re-roll)
      const recentFits = (I.recentFits || []).map(String).filter((f) => !f.includes(":") || f.startsWith(mode + ":")).map((f) => f.replace(/^[a-z]+:/, "").split("|")[0]);
      // the cards Eman set by hand (CHORD SIZE, Pitch) win over the fit (night test 9 Nov: a pinned 9THS came out as
      // 3 notes and a pinned LOW sat two octaves up over a pad). AUTO cards leave the fit free. KT2_DICE_PINFIT_OLD = the fit wins
      const pins = !window.KT2_DICE_PINFIT_OLD && brain && brain.row && brain.row.auto ? { voices: brain.row.auto.voices || mode !== "chords" ? null : brain.row.voices, range: brain.row.auto.range ? null : brain.row.range } : null;
      const V = DiceHarmony.variants(mode, r.analysis, recentFits, pins);
      const f = DiceHarmony.place({ mode, notes: r.notes, ctx: r.ctx, analysis: r.analysis, sc: r.sc || I.sc, beats: Math.max(1, c.beats || 16), variant: V, allKeys: I.all, pins, turn: recentFits.length, vShift: window.KT2_DICE_PINFIT_OLD ? 0 : r.vShift || 0 });
      r.notes = f.notes; r.said = f.said; r.fit = mode + ":" + V.k + (brain && brain.row && mode === "chords" ? "|" + (brain.row.rhythm || "plain") + "|" + (I.text || "").trim().toLowerCase() : "");
    }
    if (!r.fit && brain && mode === "chords" && !window.KT2_DICE_RHY_VAR_OLD) r.fit = "chords:-|" + (brain.row.rhythm || "plain") + "|" + (I.text || "").trim().toLowerCase();   // nothing heard: remember the rhythm so the next press picks another
    if (I.slide) r.notes = diceSlides(r.notes, I.all ? null : r.sc || I.sc);
    // MOOD TOOLS (ui/kt2-dice-tools.js, Eman 9 Nov): BASS, SPREAD, LIFT, RUB, MOTION, SHAPE, OCTAVES reshape the rolled
    // chords here, inside the roll, so DICE LIVE replays them. KT2_DICE_TOOLS_OFF = none
    // ONLY KEY on (night test 9 Nov): a mood's own LIFT (a borrowed chord from outside the key) is skipped; a LIFT
    // picked by hand still plays. KT2_DICE_TOOLS_KEY_OLD = old.
    // MOOD DNA: the mood's own voicing (register, spread, octaves) over the rolled rhythm, unless the notes follow
    // what's already there. A pinned CHORD SIZE or Pitch card still wins. The tools on AUTO then leave it alone.
    const md = I._md && brain && brain.plan && brain.plan.mood ? I._md : null;
    if (md && !(r.analysis && r.analysis.heard)) {
      // CHORD SIZE and Pitch always win (pinned, or turned live): the mood's own size/height is what AUTO gives them,
      // a Pitch step away from the mood's re-voices a fifth darker or brighter (new places, same chords)
      const rw = brain.row, lean = MDNA().byKey[md.mood].lean;
      if (!stackPlain()) r.notes = MDNA().revoice(r.notes, { segs: brain.plan.segs, mood: md.mood, blend: md.blend, n: rw.voices || null, shift: rw.range != null && lean.range != null ? (rw.range - lean.range) * 7 : 0 });
    }
    if (mode === "chords" && brain && brain.row && brain.row.tools && window.KT2DiceTools && KT2DiceTools.on())
      r.notes = KT2DiceTools.apply(r.notes, { tools: !window.KT2_DICE_TOOLS_KEY_OLD && !I.all && brain.row.auto && brain.row.auto.lift && brain.row.tools.lift ? { ...brain.row.tools, lift: 0 } : brain.row.tools, sc: r.sc || I.sc, beats: Math.max(1, c.beats || 16), segs: brain.plan && brain.plan.segs, scalePcs: I.all ? null : scalePcs(r.sc || I.sc), slides: I.slide ? null : (ns) => diceSlides(ns, I.all ? null : r.sc || I.sc) });
    // EXPERIMENTAL (Eman, 15 Nov; ui/kt2-dice-exp.js): the 7th step of the Common <-> Alternative card. The most
    // alternative chords, then a new harmony move + voicing + rhythm every roll, all inside the picked key. KT2_DICE_EXP_OFF = none
    if (mode === "chords" && brain && brain.row && brain.row.exp && window.KT2DiceExp && KT2DiceExp.on() && r.notes.length) {
      const sc = r.sc || I.sc, x = KT2DiceExp.apply(r.notes, { pcs: scalePcs(sc), tonic: sc.tonic, beats: Math.max(1, c.beats || 16), seed: I.seed });
      r.notes = x.notes; r.expSaid = x.said;
    }
    // TOP LINE (Eman, 9 Nov 22:19; ui/kt2-mood-dna.js topLine): a slow voice riding on the chords in the mood's own
    // style (held, moving, pedal, arp), only the chords' notes and soft colours, stopping at G5 so a melody still fits
    // above. Added after the chords (the mood check ignores it, notes carry tl: 1). The TOP button on the RHYTHM card
    if (mode === "chords" && brain && brain.row && brain.row.top && window.KT2MoodDNA && KT2MoodDNA.topLine && !window.KT2_TOPLINE_OFF) {
      const sc = r.sc || I.sc;
      r.notes = r.notes.concat(KT2MoodDNA.topLine(r.notes, { mood: (I._md && I._md.mood) || brain.row.moodName || null, tonic: sc.tonic, scalePcs: I.all ? null : scalePcs(sc), seed: I.seed, beats: Math.max(1, c.beats || 16), segs: brain.plan && brain.plan.segs }));
    }
    // BASS button (Eman, 14 Nov; STYLE card in ui/toymachine-dice.js): the chord's root an octave under each chord hit,
    // the notes only (the sound stays the lane's). Off by default. KT2_DICE_STYLE_OLD = no button
    if (mode === "chords" && brain && brain.row && brain.row.bassNote && r.notes.length) {
      const segs = brain.plan && brain.plan.segs, segAt = (t) => { let x = null; if (segs) for (const sg of segs) if (sg.beat <= t + 1e-6) x = sg; return x; };
      const groups = new Map();
      for (const n of r.notes) if (!n.tl && !n.locked) { const k = n.start.toFixed(3); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
      const add = [];
      for (const g of groups.values()) {
        const ps = g.map((n) => n.pitch), lo = Math.min(...ps), sg = r.analysis && r.analysis.heard ? null : segAt(g[0].start);
        const root = sg && sg.root != null ? sg.root : chordRoot(ps); if (root == null) continue;
        const rp = ps.filter((x) => pc(x) === root).sort((a, b2) => a - b2)[0];   // an octave under the chord's own root note
        let b = rp != null ? rp - 12 : lo - 12; if (rp == null) while (pc(b) !== root) b--; while (b >= lo) b -= 12;
        if (b < 24) b += 12;
        add.push({ pitch: b, start: g[0].start, length: Math.max(...g.map((n) => n.length)), velocity: Math.min(127, Math.max(...g.map((n) => n.velocity || 100)) + 4), bs: 1 });
      }
      r.notes = r.notes.concat(add);
    }
    if (keep.length) {   // what's rolled fits around them: no doubling a locked pitch, one line stays one line
      const poly = mode === "chords", hit = (a, b) => a.start < b.start + b.length - 1e-6 && b.start < a.start + a.length - 1e-6;
      const rolled = r.notes;   // what it made before the locks cut it (the FULL pattern fallback reads it)
      if (window.TMM_LOCK_SAMETIME) r.notes = r.notes.filter((n) => !keep.some((k) => hit(n, k) && (poly ? (n.pitch - k.pitch) % 12 === 0 : true))).concat(keep);
      else {   // Eman, 6 Nov 23:28: where something is locked, the dice adds nothing at all, on any row. New notes
        // live only in the unlocked time: one starting inside a locked stretch goes, one running into it is cut short.
        // TMM_LOCK_SAMETIME = the old rule (only no doubled pitch next to a locked note)
        const spans = keep.map((k) => [k.start, k.start + k.length]).sort((a, b) => a[0] - b[0]), merged = [];
        for (const sp of spans) { const l = merged[merged.length - 1]; if (l && sp[0] <= l[1] + 1e-6) l[1] = Math.max(l[1], sp[1]); else merged.push([...sp]); }
        const out = [];
        for (const n of r.notes) {
          if (merged.some(([a, b]) => n.start >= a - 1e-6 && n.start < b - 1e-6)) continue;
          const next = merged.find(([a]) => a > n.start + 1e-6);
          const len = next ? Math.min(n.length, next[0] - n.start) : n.length;
          if (len >= 0.24) out.push(len === n.length ? n : { ...n, length: len });
        }
        let out2 = out;
        const brow = brain && brain.row;
        if (!window.KT2_DICE_CONT_OFF && mode === "chords" && out.length && !(brow && brow.exp)) {
          const cn = continueLocked(out, keep, r.sc || I.sc, Math.max(1, c.beats || 16), { seed: I.seed, n: brow && brow.auto && !brow.auto.voices && brow.voices ? brow.voices : null });
          if (cn) { out2 = cn.notes; r.contSaid = cn.said; }
        }
        r.notes = out2.concat(keep);
        // (nearly) no free time left, or nothing survived: work with the locked notes instead of rolling nothing
        const beatsNow = Math.max(1, c.beats || 16);
        if (!window.KT2_DICE_FULL_OLD && (out.length === 0 || freeBeats(keep, beatsNow) < Math.min(2, beatsNow * 0.25) + 1e-6)) {
          const full = fillFull(mode, rolled, keep, r.sc || I.sc, beatsNow, I.fullPick || null);
          if (full.blocked) r.blocked = full.blocked;   // rollWith says it and leaves the notes alone
          else { r.notes = full.notes.concat(keep); r.full = full.say; r.fullG = full.g || null; }
        }
      }
    }
    return r;
  }

  // ---- the dice's PROMPT box (Eman, 8 Nov) ----------------------------------------------------
  // Words typed next to the dice steer what it rolls: the NOTES, never the sound. It all runs here in
  // the browser, no AI and no account: each known word (English or Swedish) moves the dice's own
  // dials: what it writes, speed, the chord moves it picks, 7ths, how full, how long, how high, how
  // hard, swing, slide, and a named scale/key. Mood and style words go first, then plain words
  // (slow, sparse, high...) win over them. An empty box rolls exactly as before.
  // Later an AI can stand in: window.KT2_DICE_PROMPT_AI = async (text, scale) => params (same shape
  // as parseDicePrompt returns). KT2_DICE_PROMPT_OLD = no box, the dice where it was.
  let PR = {};   // the prompt's dials while a roll runs (rollChords / rollPart read it)
  const MOOD_PROGS = {   // scale degrees from 0; every chord stays in the picked key
    dark: { minor: [[0, 5, 3, 0], [0, 1, 5, 0], [0, 3, 0, 5], [0, 0, 5, 1], [0, 6, 5, 4], [0, 4, 3, 0]], major: [[5, 3, 0, 4], [5, 2, 3, 0], [5, 1, 3, 4], [2, 5, 1, 5]] },
    sad: { minor: [[0, 5, 2, 6], [5, 3, 0, 4], [0, 3, 5, 4], [0, 5, 3, 4]], major: [[5, 3, 0, 4], [0, 5, 3, 4], [3, 4, 5, 5], [5, 2, 3, 0]] },
    happy: { minor: [[2, 5, 6, 2], [5, 6, 2, 2], [2, 6, 5, 6], [5, 2, 6, 0]], major: [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [3, 4, 0, 0]] },
    epic: { minor: [[0, 5, 2, 6], [5, 6, 0, 0], [0, 6, 5, 6], [5, 2, 6, 0]], major: [[5, 3, 0, 4], [3, 4, 5, 5], [0, 4, 5, 3]] },
    still: { minor: [[0, 0, 5, 5], [0, 5, 0, 5], [0, 0, 3, 3], [0, 6, 0, 6]], major: [[0, 0, 3, 3], [0, 3, 0, 3], [0, 0, 5, 5]] },
    tense: { minor: [[0, 1, 0, 4], [0, 1, 6, 1], [0, 4, 1, 0], [3, 1, 4, 0]], major: [[0, 6, 3, 1], [1, 6, 0, 3], [6, 3, 1, 4]] },
  };
  // [words, priority (0 = mood/style, 1 = plain dial), what it sets]
  const DP_WORDS = [
    [/^(dark\w*|evil|villain\w*|sinister|menacing|grim|horror|scary|creepy|spooky|demonic|m\u00f6rk\w*|ond\w*|l\u00e4skig\w*)$/, 0, (p) => { p.mood = "dark"; p.sev = 0.25; }],
    [/^(sad|sadness|melanchol\w*|emo|heartbreak\w*|crying|ledsen|ledsna|sorglig\w*|sorg)$/, 0, (p) => { p.mood = "sad"; p.speed = 1; p.vel = -6; }],
    [/^(happy|bright|uplifting|sunny|joyful|cheerful|summer\w*|glad\w*|ljus\w*|sommar\w*)$/, 0, (p) => { p.mood = "happy"; }],
    [/^(epic|cinematic|huge|anthem\w*|massive|episk\w*|stor)$/, 0, (p) => { p.mood = "epic"; p.len = 1.3; p.vel = 8; }],
    [/^(dreamy|dream|ethereal|floaty|floating|heavenly|dr\u00f6m\w*)$/, 0, (p) => { p.mood = "still"; p.sev = 0.9; p.speed = 0; p.len = 1.4; p.vel = -10; p.oct = 1; }],
    [/^(ambient|atmospheric|atmosphere|drone|space|spacey|spacy|cosmic|rymd\w*)$/, 0, (p) => { p.mood = "still"; p.speed = 0; p.dens = -0.6; p.len = 1.6; p.vel = -12; p.sev = 0.7; }],
    [/^(chill|calm|relaxed|mellow|peaceful|lugn\w*|avslappn\w*)$/, 0, (p) => { p.speed = 1; p.vel = -8; p.len = 1.1; }],
    [/^(techno|rave|industrial|hypnotic|acid)$/, 0, (p) => { p.mood = "still"; p.speed = 3; p.len = 0.6; p.sev = 0.1; }],
    [/^(house|garage|disco)$/, 0, (p) => { p.speed = 2; p.sev = 0.8; p.len = 0.6; }],
    [/^(trap|drill|phonk|rage)$/, 0, (p) => { p.mood = "dark"; p.sev = 0.15; }],
    [/^(lofi|lo-fi|jazz|jazzy|neosoul|soul|soulful|rnb|r&b)$/, 0, (p) => { p.sev = 1; p.swing = true; p.vel = -6; p.speed = 1; }],
    [/^(pop|poppy)$/, 0, (p) => { p.mood = "happy"; p.sev = 0.2; }],
    [/^(funky|funk|groovy|groove)$/, 0, (p) => { p.speed = 2; p.sev = 0.6; p.len = 0.7; }],
    [/^(weird|strange|crazy|wild|chaos|chaotic|tense|tension|unsettling|konstig\w*|galen|galna|kn\u00e4pp\w*)$/, 0, (p) => { p.mood = "tense"; p.leap = 2; p.sev = 0.7; }],
    [/^(simple|basic|minimal|plain|enkel|enkla|enkelt)$/, 0, (p) => { p.sev = 0; p.leap = 0.5; p.dens = -0.3; }],
    // dice sprint round 2 (8 Nov): words the 3000-people lab found nobody understood
    [/^(ballads?|ballad\w*|powerballad)$/, 0, (p) => { p.mood = "sad"; p.speed = 0; p.sev = 0.6; p.len = 1.3; p.vel = -6; }],
    [/^(whisper\w*|viska\w*|hushed|breathy|intimate|intim\w*)$/, 0, (p) => { p.vel = -22; p.dens = -0.5; p.speed = 0; p.len = 1.3; }],
    [/^(arabic|arabian|arab|arabisk\w*|oriental|middle-eastern|egyptian|turkish|persian)$/, 0, (p) => { if (!p.scale) p.scale = "phrygdom"; p.mood = "tense"; }],
    [/^(cosy|cozy|mysig\w*|snug|warm|hygge|homely)$/, 0, (p) => { p.speed = 1; p.vel = -8; p.len = 1.1; p.sev = 0.7; }],
    [/^(avant|avant-garde|avantgarde|garde|experimental|atonal|dissonant|free)$/, 0, (p) => { p.mood = "tense"; p.leap = 2; p.sev = 0.8; }],
    [/^(pulse|pulsing|pulsating|driving|four-on-the-floor|4x4|stomp\w*)$/, 1, (p) => { p.speed = 3; p.len = 0.6; }],
    [/^(hold|holding|held|sustain|pad-like|wash|drawn-out)$/, 1, (p) => { p.speed = 0; p.len = 1.6; }],
    [/^(jazzier|7ths|sevenths|colou?rful|rich|lush)$/, 1, (p) => { p.sev = 1; }],
    [/^(slow|slower|slowly|lazy|halftime|half-time|l\u00e5ngsam\w*|sakta|seg)$/, 1, (p) => { p.speed = 0; }],
    [/^(medium|mid|walking|walk|mellan)$/, 1, (p) => { p.speed = 1; }],
    [/^(fast|quick|faster|energetic|hype|upbeat|snabb\w*)$/, 1, (p) => { p.speed = 2; }],
    [/^(fastest|frantic|runs|rapid|hyper)$/, 1, (p) => { p.speed = 3; }],
    [/^(bouncy|bounce|bouncing|studsig\w*)$/, 1, (p) => { p.speed = 2; p.len = 0.75; }],
    [/^(sparse|empty|airy|spacious|few|less|gles|glest|luftig\w*)$/, 1, (p) => { p.dens = -0.7; }],
    [/^(dense|busy|full|packed|lots|more|t\u00e4t|t\u00e4tt|fullt|mycket)$/, 1, (p) => { p.dens = 0.6; }],
    [/^(long|legato|sustained|held|smooth|l\u00e5ng\w*)$/, 1, (p) => { p.len = 1.6; }],
    [/^(short|staccato|choppy|plucky|pluck|plucks|tight|kort\w*)$/, 1, (p) => { p.len = 0.45; }],
    [/^(high|higher|up|h\u00f6g\w*|ljusare)$/, 1, (p) => { p.oct = 1; }],
    [/^(low|lower|deep|deeper|down|l\u00e5g\w*|djup\w*)$/, 1, (p) => { p.oct = -1; }],
    [/^(soft|gentle|quiet|soft|mjuk\w*|tyst\w*|svag\w*)$/, 1, (p) => { p.vel = -18; }],
    [/^(hard|loud|aggressive|aggro|heavy|punchy|h\u00e5r[dt]\w*|hardt?|tung\w*)$/, 1, (p) => { p.vel = 14; }],
    [/^(banger|bangers|fire|lit|hype|hyped|slaps|slapper)$/, 0, (p) => { p.vel = 12; p.speed = Math.max(p.speed == null ? 2 : p.speed, 2); }],
    [/^(monster|dragon|beast|demon|giant|titan|boss)$/, 0, (p) => { p.mood = "epic"; p.sev = 0.3; p.vel = 10; p.oct = -1; }],
    [/^(boom-bap|boombap)$/, 0, (p) => { p.swing = true; p.speed = 1; p.sev = 0.8; p.vel = -4; }],
    [/^(slide|slides|glide|glides|gliding|portamento|glid\w*)$/, 1, (p) => { p.slide = true; }],
    [/^(swing|swung|shuffle|swingig\w*)$/, 1, (p) => { p.swing = true; }],
    [/^(straight|rak|rakt)$/, 1, (p) => { p.swing = false; }],
    [/^(chords?|pads?|ackord\w*)$/, 1, (p) => { p.mode = "chords"; }],
    [/^(stabs?)$/, 1, (p) => { p.mode = "chords"; p.speed = 2; p.len = 0.5; }],
    [/^(melody|melodies|lead|hook|topline|melodi\w*)$/, 1, (p) => { p.mode = "melody"; }],
    [/^(riff|riffs)$/, 1, (p) => { p.mode = "melody"; p.speed = 2; }],
    [/^(bass|bassline|bas|basg\u00e5ng|sub)$/, 1, (p) => { p.mode = "bass"; }],
    [/^(808|808s)$/, 1, (p) => { p.mode = "bass"; p.speed = 3; }],
    [/^(arp|arps|arpeggio\w*|arpegg\w*)$/, 1, (p) => { p.mode = "arp"; }],
    [/^(1\/4|quarters?|4ths)$/, 1, (p) => { p.speed = 0; }],
    [/^(1\/8|8ths|eighths?)$/, 1, (p) => { p.speed = 1; }],
    [/^(1\/16|16ths|sixteenths?)$/, 1, (p) => { p.speed = 2; }],
  ];
  const DP_NOT = /^(no|not|non|without|never|inte|utan|ingen|inga|icke)$/;
  const DP_SCALES = [["phrygian dominant", "phrygdom"], ["double harmonic", "double"], ["harmonic minor", "harmonic"], ["melodic minor", "melodic"], ["hungarian minor", "hungarian"],
    ["hungarian", "hungarian"], ["harmonic", "harmonic"], ["melodic", "melodic"], ["dorian", "dorian"], ["phrygian", "phrygian"], ["lydian", "lydian"], ["mixolydian", "mixolydian"],
    ["locrian", "locrian"], ["minor", "minor"], ["moll", "minor"], ["major", "major"], ["dur", "major"]];
  // text -> { mode, speed, mood, sev, leap, dens, len, oct, vel, slide, swing, scale, tonic, heard: [words understood] }
  function parseDicePrompt(text) {
    const p = { heard: [] };
    let t = " " + String(text || "").toLowerCase().replace(/[,.;:!?()"]+/g, " ").replace(/\s+/g, " ") + " ";
    // a key: "F# minor", "in Bb dorian", "Am", "c moll"
    const km = t.match(/\s(?:in\s+|key\s+|tonart\s+)?([a-h])(#|b|\u266f|\u266d|\s?sharp|\s?flat)?\s?(m|min|maj|phrygian dominant|double harmonic|harmonic minor|melodic minor|hungarian minor|hungarian|harmonic|melodic|dorian|phrygian|lydian|mixolydian|locrian|minor|moll|major|dur)(?=\s)/);
    if (km) {
      const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, h: 11 }[km[1]];
      const acc = km[2] ? (/#|\u266f|sharp/.test(km[2]) ? 1 : -1) : 0;
      p.tonic = (base + acc + 12) % 12;
      const s = km[3] === "m" || km[3] === "min" ? "minor" : km[3] === "maj" ? "major" : (DP_SCALES.find(([w]) => w === km[3]) || [])[1];
      if (s) p.scale = s;
      p.heard.push(km[0].trim());
      t = t.replace(km[0], " ");
    } else {
      for (const [w, k] of DP_SCALES) if (t.includes(" " + w + " ")) { p.scale = k; p.heard.push(w); t = t.replace(" " + w + " ", " "); break; }
    }
    t = t.replace(/ boom bap /g, " boom-bap ").replace(/ avant garde /g, " avant-garde ").replace(/ four on the floor /g, " four-on-the-floor ");
    // a tempo in the prompt ("140 bpm", "128 house", "170"): slow tempos hold, fast ones move (the dice cannot change the song's BPM)
    const bm = t.match(/\s(\d{2,3})\s?(bpm)?\s/);
    if (bm && +bm[1] >= 60 && +bm[1] <= 200 && !window.KT2_DICE_PROMPT_TYPO_OLD) { const bpm = +bm[1]; p.bpm = bpm; p.speed = bpm < 95 ? 1 : bpm < 135 ? 2 : 2; if (bpm < 95) p.swing = p.swing == null ? true : p.swing; if (bpm >= 150) p.len = 0.8; p.heard.push(bpm + " bpm"); t = t.replace(bm[0], " "); }
    const toks = t.trim().split(" ").filter(Boolean), hits = [];
    toks.forEach((w, i) => {
      let e = DP_WORDS.find(([re]) => re.test(w));
      // dice sprint 8 Nov: "chrods", "sadd", "basss" (one edit away), never for a word the brain already knows ("rap" is not "arp")
      if (!e && !window.KT2_DICE_PROMPT_TYPO_OLD && !(window.ChordBrain && ChordBrain.knows && ChordBrain.knows(w))) { const fx = typoOf(w); if (fx) { e = DP_WORDS.find(([re]) => re.test(fx)); if (e) w = fx + "~"; } }
      if (!e) return;
      const neg = i > 0 && DP_NOT.test(toks[i - 1]) || (i > 1 && DP_NOT.test(toks[i - 2]) && /^(too|so|f\u00f6r|s\u00e5)$/.test(toks[i - 1]));
      hits.push({ w, e, neg });
    });
    // several parts named at once ("808s and a melody on top"): the dice keeps the part picked in its menu (dice sprint 8 Nov)
    const parts = new Set(hits.filter((h) => !h.neg).map((h) => { const q = {}; h.e[2](q); return q.mode; }).filter(Boolean));
    const manyParts = parts.size > 1 && !window.KT2_DICE_PROMPT_TYPO_OLD;
    // mood and style first, then the plain words (in the order typed) win
    for (const pri of [0, 1]) for (const { w, e, neg } of hits) {
      if (e[1] !== pri) continue;
      const q = {}; e[2](q);
      if (neg) {   // "no slide", "not too fast": only the plain on/off and opposite dials
        if (q.slide) p.slide = false; else if (q.swing) p.swing = false;
        else if (q.speed != null) p.speed = q.speed >= 2 ? 1 : 2;
        else if (q.dens != null) p.dens = 0; else continue;
        p.heard.push("no " + w); continue;
      }
      if (manyParts && q.mode) delete q.mode;
      if (q.scale && p.scale && km) delete q.scale;   // a key named in full ("D harmonic minor") wins over a style's scale ("arabic")
      Object.assign(p, q); p.heard.push(w);
    }
    return p;
  }
  // a typo'd word one edit away from one the dice knows: a doubled letter (sadd, chordss), two letters swapped (chrods),
  // one letter too many (darkk) or one missing (chrds). Only for words of 4+ letters, and the first fix that is a word wins.
  const typoOf = (w) => {
    if (w.length < 4 || /\d/.test(w)) return null;
    const tries = [];
    for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) tries.push(w.slice(0, i) + w.slice(i + 1));
    for (let i = 1; i < w.length; i++) tries.push(w.slice(0, i - 1) + w[i] + w[i - 1] + w.slice(i + 1));
    for (let i = 0; i < w.length; i++) tries.push(w.slice(0, i) + w.slice(i + 1));
    for (let i = 1; i <= w.length; i++) for (const ch of "aeiouyrsdlntwh") tries.push(w.slice(0, i) + ch + w.slice(i));
    for (const t of tries) if (t.length >= 3 && t !== w && DP_WORDS.some(([re]) => re.test(t))) return t;
    return null;
  };
  // what the roll's notes get from the prompt after they're written: fewer, longer/shorter, higher/lower,
  // softer/harder, swung. Chords stay together (notes starting at the same time go or stay as one).
  function shapeByPrompt(notes, p, beats) {
    if (!p || !notes.length) return notes;
    if (p.dens < 0) {
      const at = new Map(); for (const n of notes) { const k = n.start.toFixed(3); if (!at.has(k)) at.set(k, []); at.get(k).push(n); }
      const keepIt = (s) => s % 4 < 1e-6 || Math.random() > -p.dens * (s % 1 > 1e-6 ? 0.8 : s % 2 > 1e-6 ? 0.5 : 0.3);
      notes = [...at.values()].filter((g) => keepIt(g[0].start)).flat();
    }
    if (p.len && p.len !== 1) {
      const onsets = [...new Set(notes.map((n) => +n.start.toFixed(4)))].sort((a, b) => a - b);
      for (const n of notes) {
        if (p.len < 1) { n.length = Math.max(0.125, n.length * p.len); continue; }
        const nx = onsets.find((o) => o > n.start + 1e-6), room = (nx != null ? nx : beats) - n.start;
        n.length = Math.max(n.length, Math.min(n.length * p.len, room));
      }
    }
    if (p.swing) for (const n of notes) {
      const f = n.start % 1;
      if (Math.abs(f - 0.5) < 1e-6) { n.start += 0.0833; n.length = Math.max(0.1, n.length - 0.0833); }
      else if (Math.abs(f - 0.25) < 1e-6 || Math.abs(f - 0.75) < 1e-6) { n.start += 0.04; n.length = Math.max(0.08, n.length - 0.04); }
    }
    if (p.vel) for (const n of notes) n.velocity = Math.max(20, Math.min(127, (n.velocity || 100) + p.vel));
    if (p.oct) { const d = p.oct * 12; if (notes.every((n) => n.pitch + d >= LOW && n.pitch + d <= HIGH)) for (const n of notes) n.pitch += d; }
    return notes;
  }
  window.KT2DicePrompt = { parse: parseDicePrompt, shape: shapeByPrompt };

  // ---- the view ------------------------------------------------------------------------
  let S = null; // { pane, trackId, clipId, sc, all, top, grid, notes, drag, sel, pending, lastLen, row }
  // Each MIDI view (footer, big window) keeps its own state and row height. They used to share one,
  // so a click in one view was measured with the other's rows and notes landed rows away (Eman, 31 Oct).
  const STATES = new Map();
  function use(pane) {
    const st = STATES.get(pane);
    if (st && S !== st && !(S && S.drag)) { if (S) S.row = ROW; S = st; ROW = st.row || 22; }
    if (S && !(S.drag)) { STRIP = stripFor(S.pane); FOOT = footFor(S.pane); }
    return st;
  }

  // The mouse let go outside the page (the app runs in a frame: a release over the browser's edge or another
  // app never reaches us), or the window lost focus mid-drag: the drag ends there, instead of the note sticking
  // to the mouse with no button held (debug sprint, 8 Nov). KT2_LOST_UP_OLD = old.
  let rollPress = false;
  window.addEventListener("mouseup", () => { rollPress = false; }, true);
  let lastXY = { x: 0, y: 0 };
  const lostUp = () => { if (!rollPress || window.KT2_LOST_UP_OLD) return; rollPress = false; window.dispatchEvent(new MouseEvent("mouseup", { clientX: lastXY.x, clientY: lastXY.y, bubbles: true })); };
  window.addEventListener("mousemove", (ev) => { if (rollPress && ev.buttons === 0) return lostUp(); lastXY = { x: ev.clientX, y: ev.clientY }; }, true);
  window.addEventListener("blur", () => { if (rollPress) lostUp(); });
  // DICE TRAIN (14 Nov): where a roll came from, after the chord names: the song, or how it was changed
  function trainedSay(r, mode) {
    if (window.KT2_DICE_TRAIN_SAY_OFF) return "";
    const t = r && (r.trained || (r.brain && r.brain.trained));
    const parts = [];
    if (t && mode === "chords") parts.push(t.how === "theory" ? "a basic loop" : !t.from.length ? "" : t.how === "exact" ? "as in " + t.from[0] : t.how === "morphed" ? t.from[0] + ", " + t.morph.join(" + ") : t.from.slice(0, 2).join(" + "));
    if (r && r.trainedPart && r.trainedPart.from.length) parts.push(r.trainedPart.how === "vocal" ? "vocal melody from " + r.trainedPart.from[0] : r.trainedPart.how === "exact" ? (mode === "bass" ? "bass" : "melody") + " as in " + r.trainedPart.from[0] : r.trainedPart.from.slice(0, 2).join(" + ") + " (" + r.trainedPart.how + ")");
    return parts.length && parts.every(Boolean) ? "  \u00b7  " + parts.join("  \u00b7  ") : "";
  }
  function build(pane) {
    pane.replaceChildren();
    if (!pane.dataset.tmmWired) {   // whatever the hand does in a view works on that view's own state
      pane.dataset.tmmWired = "1";
      for (const t of ["pointerdown", "mousedown", "mousemove", "wheel", "click", "change", "input", "keydown"]) pane.addEventListener(t, () => use(pane), true);
      pane.addEventListener("mousedown", (e) => { if (e.target && e.target.id === "tmm-canvas") rollPress = true; }, true);
    }
    const opt = (v, t, on) => `<option value="${v}"${on ? " selected" : ""}>${t}</option>`;
    pane.innerHTML = `
      <div class="tune-head tmm-head">
        <div class="tune-actions tmm-bar">
          <div class="tmm-grp tmm-mode" id="tmm-mode" title="MIDI: the notes. ADVANCED: the same notes, plus pitch lines and wobble on each one"><button id="tmm-mode-notes" class="on">MIDI</button>${tabs3On() ? '<button id="tmm-mode-dice">Dice</button>' : ""}${icoOn() ? '<button id="tmm-mode-adv" class="tmm-advico" title="ADVANCED" aria-label="Advanced">' + SPIRAL_SVG + "</button>" : '<button id="tmm-mode-adv">Advanced</button>'}</div>
          <div class="tmm-title"><span>MIDI</span><span class="rack-sub" id="tmm-sub"></span></div>
          <div class="tmm-grp tmm-voices" id="tmm-voices" hidden title="Which sound's notes you write: each colour is a synth on this pattern"></div>
          <div class="tmm-grp" title="The scale: notes outside it are greyed out and locked"><span class="tmm-lbl">Scale</span>
            <select id="tmm-tonic">${NAMES.map((n, i) => opt(i, n)).join("")}</select>
            <select id="tmm-scale">${Object.entries(SCALES).map(([k, s]) => opt(k, s.name)).join("")}</select>
            <button class="tmm-sw on" id="tmm-all" title="ONLY KEY on: notes outside the scale are greyed and muted. Off: every note plays"><i></i>Only key</button></div>
          <div class="tmm-grp tmm-dg" id="tmm-dg" title="Roll a part in the key that follows what's already there (Cmd+Z takes it back)">
            <button class="tmm-dice" id="tmm-dice" title="Roll (Cmd+Z takes it back)"><svg class="tmm-ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg></button>
            <button class="tmm-dslide" id="tmm-dslide" aria-pressed="false" title="SLIDE: what the dice rolls glides in and out between its chords and notes"><svg viewBox="0 0 24 16" width="20" height="13" aria-hidden="true"><path d="M2 12h5c4 0 6-8 10-8h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg></button>
            <select id="tmm-dmode" title="What the dice writes">${Object.entries(DICE_MODES).map(([k, n]) => opt(k, n)).join("")}</select>
            <span class="tmm-knob" id="tmm-speed" role="slider" tabindex="0" aria-label="Speed" title="Speed: drag, scroll or click"><i></i></span><span class="tmm-spd" id="tmm-spdl"></span></div>
          <div class="tmm-grp tmm-lg"><span class="tmm-lbl">Length</span> <select id="tmm-bars" title="Clip length">${[1, 2, 4, 8, 16].map((b) => opt(b, b + (b > 1 ? " bars" : " bar"))).join("")}</select>
            <span class="tmm-lbl">Grid</span> <select id="tmm-grid" title="Grid">${opt(1, "1/4")}${opt(0.5, "1/8")}${opt(0.25, "1/16", true)}</select></div>
          <div class="tmm-grp tmm-oct" title="Move every note in this clip up or down an octave"><span class="tmm-lbl">Octave</span>
            <button class="tmm-octbtn" id="tmm-octdn" title="Everything down an octave">\u25BC</button><b class="tmm-octn" id="tmm-octn" title="The octave this pattern sits in"></b><button class="tmm-octbtn" id="tmm-octup" title="Everything up an octave">\u25B2</button></div>
          <div class="tmm-grp tmm-mouse"><button class="tmm-sw" id="tmm-mouse" aria-pressed="false"><i></i>Mouse</button></div>
          <div class="tmm-grp tmm-zm" title="How big the notes look">
            <span class="tmm-zl" title="Note height">\u2195</span><button class="tmm-octbtn" id="tmm-hdn" title="Thinner notes">\u2212</button><button class="tmm-octbtn" id="tmm-hup" title="Taller notes">+</button>
            <span class="tmm-zl" title="Zoom"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 10l4.5 4.5" stroke="currentColor" stroke-width="2"/></svg></span><button class="tmm-octbtn" id="tmm-zdn" title="Zoom out">\u2212</button><button class="tmm-octbtn" id="tmm-zup" title="Zoom in (scroll sideways to move along)">+</button></div>
          <label class="tmm-grp tmm-ghost" title="Show the other lanes' notes faintly behind this grid, to write against them">
            <input type="checkbox" id="tmm-ghost"> <span class="tmm-lbl">Reference</span><svg class="tmm-ico tmm-eye" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg> <select id="tmm-ghostsel"><option value="all">ALL</option></select></label>
          <div class="tmm-grp tmm-pg" id="tmm-pg"><input id="tmm-prompt" type="text" maxlength="120" spellcheck="false" autocomplete="off" placeholder="PROMPT" aria-label="Prompt for the dice" title="Words for the dice: dark, slow, ambient, bass, sparse, high, jazzy... Enter rolls"></div>
          <div class="tmm-grp tmm-rhy" id="tmm-rhy" hidden></div>
          <div class="tmm-grp tmm-end">
            <button class="link tmm-ib" id="tmm-play" title="Play this clip"><svg class="tmm-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg><span class="tmm-lbl">Play</span></button>
            <button class="link tmm-ib" id="tmm-clear" title="Clear all notes"><svg class="tmm-ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span class="tmm-lbl">Clear</span></button>
</div>
          <div class="tmm-grp tmm-vg" id="tmm-vg"><button class="tmm-vbtn${icoOn() ? " is-ico" : ""}" id="tmm-vers" aria-pressed="false" aria-label="Versions" title="Versions: several ideas for this MIDI, all kept in the same clip"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="1.5" y="4.5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 2.5h6a2 2 0 0 1 2 2v6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>Versions</span></button></div>
          <div class="tmm-grp tmm-moregrp" id="tmm-moregrp" hidden><button class="link tmm-ib tmm-more" id="tmm-more" title="More: the tools that didn't fit">\u22EF</button></div>
        </div>
        <div class="tune-actions tmm-morepop" id="tmm-morepop" hidden></div>
        <div class="tmm-vstrip" id="tmm-vstrip" hidden></div>
      </div>
      <div class="tmm-wrap"><canvas class="tmm-canvas" id="tmm-canvas"></canvas><div class="tmm-menu" id="tmm-menu" hidden></div><div class="tmm-chips" id="tmm-chips"></div><div class="tmm-pick" id="tmm-pick" hidden></div>
        <div class="tmm-dock" id="tmm-dock" hidden>
          <button data-tool="move" class="on" title="Move: notes as usual. Points on a pitch line can still be dragged"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span>Move</span></button>
          <button data-tool="pitch" title="Pitch: press on a note and drag a line to anywhere, the sound follows it. Two picked notes: builds the glide between them. Press on a line to add a point there (up, down, up again). Right-click a point takes it off"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M3 18h5c5 0 6-12 11-12h2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/><circle cx="3.5" cy="18" r="2.2" fill="currentColor"/><circle cx="20.5" cy="6" r="2.2" fill="currentColor"/></svg><span>Pitch</span></button>
          <button data-tool="wobble" title="Wobble: press a note and drag up for more, down for less, sideways for faster or slower. Right-click takes it off"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M2 12c2.5-7 5-7 7.5 0s5 7 7.5 0 3.5-5 5-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Wobble</span></button>
          <span class="tmm-dsep"></span>
          <span class="tmm-dset" id="tmm-dset">
            <button class="tmm-dknob" data-k="d" title="Wobble depth (drag up or down, or scroll)"><b>Depth</b><i id="tmm-wd">0.5 st</i></button>
            <button class="tmm-dknob" data-k="r" title="Wobble speed, in note lengths (drag sideways, scroll, or click for the next)"><b>Rate</b><i id="tmm-wr">1/8</i></button>
            <button class="tmm-dknob" data-k="f" title="Fade: the wobble grows in over this much of the note (drag, or scroll)"><b>Fade</b><i id="tmm-wf">0%</i></button>
            <button class="tmm-dknob" data-k="e" title="Curve: how the wobble moves over the note: Rise, Swell, Fall, Late, Full (click for the next, scroll). Drag the squares on a note to draw your own"><b>Curve</b><i id="tmm-we">Rise</i></button>
            <button class="tmm-dknob" data-k="sh" title="Shape of the wobble (click)"><b>Shape</b><i id="tmm-ws">&#8767;</i></button>
          </span>
          <span class="tmm-dsep" id="tmm-dsep-reset"></span>
          <button id="tmm-advclear" title="Reset the picked notes: pitch lines and wobble off"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg><span>Reset</span></button>
        </div>
      </div>
      <div class="iw-empty" id="tmm-empty" hidden>No MIDI clip on this lane yet. Double-click the lane to add one.</div>
      <div class="tune-hint" hidden>Notes outside the scale are greyed out and locked, so whatever you draw is in key (Out of key lets you write there too). Click a note to select it, click empty space to add one, drag to move, drag its end to resize, right-click or Delete removes. Each note shows how its sound fades (from the synth's envelope). Cmd-drag a box over notes for Compound (glue them into one block) and Slide in / Slide out. Drag one selected note to move them all; arrows move them, Delete removes them. The chord of each bar is named on top. Roll chords writes a progression in the scale; Cmd+Z undoes it.</div>`;
    const q = (id) => pane.querySelector("#" + id);
    // NO TITLE (Eman, 26 Nov: "remove the text midi bar 1.1 fully"): the MIDI / bar 1.1 words in the bar are gone.
    // KT2_TMM_TITLE_OLD = shown as before
    if (!window.KT2_TMM_TITLE_OLD) { const tt = pane.querySelector(".tmm-title"); if (tt) tt.style.display = "none"; }
    advBuild(pane, q);
    vBuild(pane, q);
    // A new root / scale picked here moves the pattern's notes to it, the way a musician would rewrite
    // the part (Eman, 8 Nov: A minor chords -> F# major chords, closest way): convertClipKey in
    // playground.js with ui/keyconvert.js, one undo. TMM_SCALE_MUTE_OLD = old (notes stayed, the ones
    // now out of key went quiet).
    q("tmm-tonic").onchange = q("tmm-scale").onchange = () => {
      const was = S.sc && { tonic: S.sc.tonic, scale: S.sc.scale };
      S.sc = { ...S.sc, tonic: Number(q("tmm-tonic").value), scale: q("tmm-scale").value, free: S.all, songKey: songKeySig() };
      setLaneScale(S.trackId, S.sc);
      if (!window.TMM_SCALE_MUTE_OLD && window.KeyConvert && was && S.clipId && S.notes && S.notes.length) {
        draw();
        run("convertClipKey", { clipId: S.clipId, from: was, to: { tonic: S.sc.tonic, scale: S.sc.scale } }).then((r) => {
          if (r && r.error) return toast(r.error, true);
          if (r && r.moved && window.toast) toast("Notes moved to " + KeyConvert.keyName({ tonic: S.sc.tonic, scale: S.sc.scale }) + ".");
        });
        return;
      }
      draw(); if (S.notes && S.notes.length) { S.rekey = true; commit(); }   // notes now out of key go quiet (or come back)
    };
    // Reference: other lanes' notes, faint, behind the grid (Eman, 31 Oct). Turning it on starts on ALL.
    q("tmm-ghost").onchange = () => { S.ghost = q("tmm-ghost").checked; if (S.ghost) { S.ghostSel = "all"; q("tmm-ghostsel").value = "all"; } saveGhost(); draw(); };
    q("tmm-ghostsel").onchange = () => { S.ghostSel = q("tmm-ghostsel").value; if (!S.ghost) { S.ghost = true; q("tmm-ghost").checked = true; } saveGhost(); draw(); };
    // ONLY KEY (Eman, 31 Oct): on = notes outside the scale are greyed and muted (still there); off = everything plays
    q("tmm-all").onclick = () => {
      S.all = !S.all; q("tmm-all").classList.toggle("on", !S.all);
      S.sc = { ...S.sc, free: S.all }; setLaneScale(S.trackId, S.sc);
      draw(); if (S.notes && S.notes.length) { S.rekey = true; commit(); }
    };
    q("tmm-grid").onchange = () => { S.grid = Number(q("tmm-grid").value); draw(); };
    q("tmm-mouse").onclick = () => setMouseMode(mouseMode() === "classic" ? "killtoy" : "classic"); showMouse(pane);
    q("tmm-bars").onchange = () => S.clipId && run("setClipLength", { clipId: S.clipId, beats: Number(q("tmm-bars").value) * 4 });
    q("tmm-clear").onclick = () => { if (S.clipId) { S.notes = []; draw(); commit(); } };
    q("tmm-play").onclick = () => {
      const c = S.clipId && findClip(S.clipId);
      if (!c) return;
      if (ui.transport.playing) return run("togglePlay");
      run("setPosition", { time: c.start }).then(() => run("togglePlay"));
    };
    const octave = (d) => {
      if (!S || !S.notes || !S.notes.length) return toast("No notes yet");
      if (S.notes.some((n) => n.pitch + d * 12 < RLO() || n.pitch + d * 12 > RHI())) return toast(d > 0 ? "Already as high as it goes" : "Already as low as it goes");
      for (const n of S.notes) n.pitch += d * 12;
      if (octDiceOn() && S.clipId) octSet(S.clipId, octOf(S.clipId) + d);   // the dice rolls in this octave from now on
      const rows = rowPitches(S.sc, true), per = rows.filter((p) => p > 60 && p <= 72).length || 7; // rows in one octave
      S.top = Math.max(0, Math.min(topMax(rows), S.top - d * per));   // the view follows the notes
      draw(); commit();
      hear(S.notes[0].pitch, S.notes[0].velocity); setTimeout(hush, 160);
    };
    // note height and zoom (Eman, 4 Nov): steps, the zoom keeps the middle of the view where it is
    const HS = [12, 16, 22, 28, 36], ZS = [1, 1.5, 2, 3, 4, 6, 8];
    const height = (d) => {
      const cur = S.rowH || ROW || 22, i = HS.findIndex((h) => h >= cur - 0.5);
      const j = Math.max(0, Math.min(HS.length - 1, (i < 0 ? HS.length - 1 : i) + d));
      S.rowH = HS[j]; fitRows(true); draw(); zmState();
    };
    const zoom = (d) => {
      const { beats } = geom(), z0 = S.zx || 1, near = ZS.reduce((b, z, k) => (Math.abs(z - z0) < Math.abs(ZS[b] - z0) ? k : b), 0);
      const i = d > 0 ? (ZS[near] > z0 + 1e-6 ? near - 1 : near) : (ZS[near] < z0 - 1e-6 ? near + 1 : near), z1 = ZS[Math.max(0, Math.min(ZS.length - 1, i + d))];
      const mid = (S.sx || 0) + beats / z0 / 2;
      S.zx = z1; S.sx = Math.max(0, Math.min(beats - beats / z1, mid - beats / z1 / 2));
      draw(); zmState();
    };
    const zmState = () => {
      q("tmm-hdn").disabled = (S.rowH || ROW) <= HS[0]; q("tmm-hup").disabled = (S.rowH || ROW) >= HS[HS.length - 1];
      q("tmm-zdn").disabled = (S.zx || 1) <= 1; q("tmm-zup").disabled = (S.zx || 1) >= ZS[ZS.length - 1];
    };
    q("tmm-hup").onclick = () => height(1); q("tmm-hdn").onclick = () => height(-1);
    // V2n: height +/- sit under the keys, width +/- at the bottom right of the roll (Eman, 4 Nov 23:25)
    if (document.documentElement.classList.contains("kt2")) {
      const wrap = pane.querySelector(".tmm-wrap"), eh = document.createElement("div"), ew = document.createElement("div");
      eh.className = "tmm-edge tmm-edge-h"; ew.className = "tmm-edge tmm-edge-w";
      eh.innerHTML = '<span title="Note height">\u2195</span>'; ew.innerHTML = '<span title="Width (pinch on the trackpad works too)">\u2194</span>';
      eh.append(q("tmm-hdn"), q("tmm-hup")); ew.append(q("tmm-zdn"), q("tmm-zup"));
      for (const x of [eh, ew]) { x.addEventListener("mousedown", (ev) => ev.stopPropagation()); wrap.append(x); }
      const zg = pane.querySelector(".tmm-zm"); if (zg) zg.hidden = true;
    }
    q("tmm-zup").onclick = () => zoom(1); q("tmm-zdn").onclick = () => zoom(-1);
    q("tmm-octup").onclick = () => octave(1);
    q("tmm-octdn").onclick = () => octave(-1);
    // the smart dice: mode + speed are remembered; rolling writes the current SOUND's notes
    const dice = (() => { try { return { mode: "chords", speed: 1, ...JSON.parse(localStorage.getItem("kt2.dice") || "{}") }; } catch (e) { return { mode: "chords", speed: 1 }; } })();
    const saveDice = () => { try { localStorage.setItem("kt2.dice", JSON.stringify(dice)); } catch (e) {} };
    // a bass sound (Zed call, 7 Nov): the dice writes a bass line, and CHORDS isn't offered, so a
    // beginner's bass stays a bass. TMM_BASS_CHORDS = chords on a bass too.
    const bassOnly = () => !!(S && S.isBass && !window.TMM_BASS_CHORDS);
    const modeNow = () => (bassOnly() && dice.mode === "chords" ? "bass" : dice.mode);
    const showDice = () => {
      const ch = q("tmm-dmode").querySelector('option[value="chords"]'); if (ch) ch.hidden = bassOnly();
      q("tmm-dmode").value = modeNow();
      const k = q("tmm-speed"); k.style.setProperty("--a", (-135 + dice.speed * 90) + "deg"); k.setAttribute("aria-valuenow", dice.speed);
      q("tmm-spdl").textContent = DICE_SPEEDS[modeNow()][dice.speed];
    };
    showDice(); pane._showDice = showDice;
    const showSl = () => { const b = q("tmm-dslide"); b.classList.toggle("on", !!dice.slide); b.setAttribute("aria-pressed", String(!!dice.slide)); };
    showSl();
    q("tmm-dslide").onclick = () => { dice.slide = !dice.slide; saveDice(); showSl(); };
    q("tmm-dmode").onchange = () => { dice.mode = q("tmm-dmode").value; saveDice(); showDice(); if (window.TmDice && !window.KT2_DICE_ROW_OLD) TmDice.setPart(pane, modeNow()); };
    if (window.TmDice && !window.KT2_DICE_ROW_OLD) TmDice.setPart(pane, modeNow());
    const setSpeed = (v) => { v = Math.max(0, Math.min(3, v)); if (v === dice.speed) return; dice.speed = v; saveDice(); showDice(); if (window.KT2Juice && KT2Juice.step) KT2Juice.step("knob", "dice" + v); };
    const knob = q("tmm-speed");
    knob.addEventListener("mousedown", (e) => {
      e.preventDefault(); e.stopPropagation();
      const y0 = e.clientY, s0 = dice.speed; let moved = false;
      const mv = (ev) => { const d = Math.round((y0 - ev.clientY) / 18); if (d) moved = true; setSpeed(s0 + d); };
      const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); if (!moved) setSpeed((dice.speed + 1) % 4); };
      window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    });
    knob.addEventListener("wheel", (e) => { e.preventDefault(); e.stopPropagation(); setSpeed(dice.speed + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    knob.addEventListener("keydown", (e) => { if (e.key === "ArrowUp" || e.key === "ArrowRight") { setSpeed(dice.speed + 1); e.preventDefault(); } if (e.key === "ArrowDown" || e.key === "ArrowLeft") { setSpeed(dice.speed - 1); e.preventDefault(); } });
    // the PROMPT box (Eman, 8 Nov): what's typed steers the roll; Enter rolls. KT2_DICE_PROMPT_OLD = no box
    const pr = q("tmm-prompt");
    if (window.KT2_DICE_PROMPT_OLD) q("tmm-pg").remove();
    else {
      q("tmm-pg").append(q("tmm-dice"));
      // the DICE ROW (Eman, 8 Nov): an arrow after the dice opens the visual dials under the bar. KT2_DICE_ROW_OLD = no arrow
      if (!window.KT2_DICE_ROW_OLD && window.TmDice) {
        const ar = document.createElement("button"); ar.type = "button"; ar.id = "tmm-darrow"; ar.title = "Dice settings: length, change, rhythm, voices, colour, tension, random, range"; ar.setAttribute("aria-expanded", "false");
        ar.innerHTML = '<svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
        q("tmm-pg").append(ar);
        ar.onclick = (e) => { e.stopPropagation(); TmDice.toggle(pane); };
        TmDice.mount(pane, { full: () => { const c = S && S.clipId && findClip(S.clipId); if (!c || !S.notes) return false; const keep = S.notes.filter((n) => n.locked && (S.voice !== "*" || !n._v)); return isFull(keep, Math.max(1, c.beats || 16)); }, fullUsed: () => S && S.fullUsed, bars: () => { const c = S && S.clipId && findClip(S.clipId); return c ? Math.max(1, Math.round((c.beats || 16) / 4)) : Number(q("tmm-bars").value) || 4; }, setBars: (b) => { if (S && S.clipId) run("setClipLength", { clipId: S.clipId, beats: b * 4 }); }, prompt: () => pr.value, owner: () => (S && S.trackId != null ? ((typeof ui !== "undefined" && ui.state && ui.state.session) || "") + "|" + S.trackId : null), live: (dial, final) => liveEdit(dial, final) || (["hits", "len"].includes(dial) && (rerhythmLive(final) || rerhythmLine(final))) || (dial === "voices" && restackLive(final)), armed: () => liveArmed(),
          // the dice chat: edit one chord, read and put back the notes (its own undo), roll
          chordMood: (which, dir) => { if (!S || !S.notes) return { err: "Open a pattern first." }; const ns = S.notes.map((n) => ({ ...n })), r = editChordMood(ns, which, dir); if (!r.err) { S.notes = ns; S.sel = null; draw(); commit(); } return r; },
          notes: () => (S && S.notes ? S.notes.map((n) => ({ ...n })) : null), setNotes: (ns) => { if (!S || !ns) return; S.notes = ns.map((n) => ({ ...n })); draw(); commit(); },
          roll: () => { const d = q("tmm-dice"); if (d && !d.disabled) d.click(); } });
        // the panel shows the cards of the mode the dice is on (live check 14 Nov: a saved MELODY mode opened with the chord
        // cards and the STYLE card, since the mode was set before the panel existed). KT2_DICE_PART_OLD = as before
        if (!window.KT2_DICE_PART_OLD) TmDice.setPart(pane, modeNow());
        document.addEventListener("chordbrain", () => TmDice.refresh(pane));
      }
      pr.value = dice.prompt || "";
      // NO PROMPT BOX (Eman, 15 Nov: "remove this"): the box is gone from the bar, and words left in it from before are
      // cleared so nothing hidden steers the roll. The dice cards do the steering. KT2_DICE_PROMPT_SHOW = the box back
      if (!window.KT2_DICE_PROMPT_SHOW) { pr.hidden = true; pr.style.display = "none"; if (pr.value) { pr.value = ""; dice.prompt = ""; saveDice(); } }
      // the FROM line reads the box, so draw it again now that the saved prompt is in (it said SONGS with words in the box)
      if (window.TmDice && !window.KT2_DICE_ROW_OLD) TmDice.refresh(pane);
      pr.addEventListener("input", () => { dice.prompt = pr.value; saveDice(); if (window.TmDice && !window.KT2_DICE_ROW_OLD) TmDice.refresh(pane); });
      pr.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); q("tmm-dice").click(); }
        else if (e.key === "Escape") pr.blur();
      });
      for (const t of ["keyup", "keypress"]) pr.addEventListener(t, (e) => e.stopPropagation());
    }
    // the prompt's words set the dice's own dials first, where you can see them (mode, speed, key)
    const applyPrompt = (p) => {
      if (p.mode && DICE_MODES[p.mode]) dice.mode = p.mode;
      if (p.speed != null) dice.speed = p.speed; else if (p.dens > 0) dice.speed = Math.max(2, dice.speed);
      if (p.mode || p.speed != null || p.dens > 0) { saveDice(); showDice(); }
      if ((p.scale && SCALES[p.scale] && p.scale !== S.sc.scale) || (p.tonic != null && p.tonic !== S.sc.tonic)) {
        if (p.tonic != null) q("tmm-tonic").value = String(p.tonic);
        if (p.scale && SCALES[p.scale]) q("tmm-scale").value = p.scale;
        q("tmm-scale").onchange();
      }
    };
    q("tmm-dice").onclick = () => {
      // PG MATCH on: listen to the sound clips over the pattern first (cached per clip position), then roll
      const pc0 = window.KT2PGMatch && KT2PGMatch.isOn("dice") && !KT2PGMatch.simpleBlocked() && S.clipId && findClip(S.clipId);   // SIMPLE DICE: PG MATCH too (KT2_PGMATCH_SIMPLE_OFF = not there)
      if (pc0 && !q("tmm-dice").dataset.pgm) {
        const sw = () => pane.querySelector(".pgm-sw");
        q("tmm-dice").dataset.pgm = "1"; KT2PGMatch.busy(sw(), true);
        KT2PGMatch.hearFor(pc0).catch((e) => { console.error(e); return null; }).then(() => {
          KT2PGMatch.busy(sw(), false); KT2PGMatch.badge(sw(), S.sc);
          try { q("tmm-dice").click(); } finally { delete q("tmm-dice").dataset.pgm; }
        });
        return;
      }
      const txt = pr && pr.isConnected ? pr.value.trim() : "";
      if (txt && typeof window.KT2_DICE_PROMPT_AI === "function") {   // later: an AI reads the words instead
        Promise.resolve().then(() => window.KT2_DICE_PROMPT_AI(txt, { ...S.sc })).catch(() => null).then((p) => rollWith(p && typeof p === "object" ? { heard: [], ...p } : parseDicePrompt(txt)));
      } else rollWith(txt ? parseDicePrompt(txt) : {});
    };
    // SIMPLE DICE chords (ui/kt2-dice-simple.js): the loop's notes, moved onto the key's open rows (the key always wins),
    // the locked notes kept. null = no song data yet (the old roll runs)
    // LANES IN OTHER KEYS (test 15 Nov): every TOY MACHINE lane keeps its own key, and the key set here always wins, so a
    // lane set to another key clashes with this one. The roll still follows the key here; the message says which lane is
    // in which key, so it can be set to match. null = no clash
    const keyClash = (I, heard) => {
      const ts = (ui.state && ui.state.tracks) || [], pcs = scalePcs(I.sc);
      let tot = 0, out = 0; for (const n of heard) { tot += n.length; if (!pcs.includes(pc(n.pitch))) out += n.length; }
      if (!tot || out / tot < 0.15) return null;
      for (const id of new Set(heard.map((n) => n.src))) {
        const t = ts.find((x) => x.id === id); if (!t || id === S.trackId) continue;
        const o = laneScale(id); if (!o || !SCALES[o.scale] || (o.tonic === I.sc.tonic && o.scale === I.sc.scale)) continue;
        return `${t.name || "another lane"} is in ${keyNames(o)[o.tonic]} ${SCALES[o.scale].name}, this one in ${keyNames()[I.sc.tonic]} ${SCALES[I.sc.scale].name}: set the key above to match`;
      }
      return `the other lanes play notes outside ${keyNames()[I.sc.tonic]} ${SCALES[I.sc.scale].name}`;
    };
    const simpleChords = (I) => {
      const beats = Math.max(1, I.c.beats || 16);
      let sr = null, notes = null, by = null;
      // notes already playing (other lanes, the other sounds of this pattern): of 12 loops, the one whose chords hold them
      // best (time on a chord note counts, a clash against the chord counts against it)
      const heard = diceContext(I.c, I.voice).filter((n) => !n.locked).concat(I.keep || []), opt = { tonic: I.sc.tonic, minor: SCALES[I.sc.scale].steps[2] === 3, beats, scalePcs: I.all && !DICE_STRICT() ? null : scalePcs(I.sc) };
      const fitOf = (ns) => { let sc = 0; for (const h of heard) for (const n of ns) { const o = Math.min(h.start + h.length, n.start + n.length) - Math.max(h.start, n.start); if (o <= 0) continue; const d = pc(h.pitch - n.pitch); sc += o * (d === 0 ? 1 : d === 1 || d === 11 ? -1.5 : 0); } return sc; };
      const pick = () => { if (!heard.length) return KT2DiceSimple.chords(opt); let best = null, bs = -1e9; for (let k = 0; k < 12; k++) { const x = KT2DiceSimple.chords({ ...opt, noRecent: true }); if (!x) return null; const f = fitOf(x.notes); if (f > bs) { bs = f; best = x; } } if (best) KT2DiceSimple.remember(best.key); return best; };
      for (let t = 0; t < 5; t++) {   // two chords the key rule turned into the same chord: one chord all the way, roll again
        sr = pick();
        if (!sr || !sr.notes.length) return null;
        notes = sr.notes;
        if (!I.all || DICE_STRICT()) notes = snapToKey(notes, I.sc);
        by = new Map(); for (const n of notes) { const k = Math.round(n.start * 1000); if (!by.has(k)) by.set(k, []); by.get(k).push(n.pitch); }
        if (beats < 8 || new Set([...by.values()].map((ps) => [...new Set(ps.map(pc))].sort((a, b) => a - b).join())).size > 1) break;
      }
      // LOCKED notes keep their time: a chord that would start under a locked note is left out, one running into it stops there
      // (a _soft locked note, ROLL IN THE YELLOW, is heard but doesn't block)
      const locks = (I.keep || []).filter((n) => !n._soft).map((n) => [n.start, n.start + n.length]);
      // LOCKED RHYTHM (Eman, 15 Nov 17:18): locked chord stabs with a pattern = the loop's chords play THAT rhythm in the
      // free time (lockRhythm: same hits per bar, lengths, accents). The chords are still the loop's. KT2_DICE_LOCKRHY_OFF = old
      const LL = locks.length && !window.KT2_DICE_LOCKRHY_OFF ? lockedChords(I.keep.filter((n) => !n._soft)) : [];
      let lr = LL.length >= 2 ? lockRhythm(LL, I.keep.filter((n) => !n._soft), beats, notes[0], Math.random) : null;
      if (lr && lr.groups.length) {
        const G0 = [...by.keys()].sort((a, b) => a - b).map((k) => { const ns = notes.filter((n) => Math.round(n.start * 1000) === k); return { start: k / 1000, end: Math.max(...ns.map((n) => n.start + n.length)), ns }; });
        const at = (t) => { let x = null; for (const g of G0) if (g.start <= t + 1e-6) x = g; return x || G0[0]; };
        const out = []; for (const g of lr.groups) { const ch = at(g.start); for (const n of ch.ns) out.push({ ...n, start: g.start, length: g.len, velocity: g.vel }); }
        notes = out; sr = { ...sr, lockRhy: lr.lands ? "SAME RHYTHM, LANDS" : "SAME RHYTHM" };
        by = new Map(); for (const n of notes) { const k = Math.round(n.start * 1000); if (!by.has(k)) by.set(k, []); by.get(k).push(n.pitch); }
      } else lr = null;
      if (locks.length && !lr) {
        notes = notes.filter((n) => !locks.some(([a, e]) => n.start >= a - 1e-6 && n.start < e - 1e-6)).map((n) => { const nx = locks.filter(([a]) => a > n.start + 1e-6).map(([a]) => a).sort((x, y) => x - y)[0]; return nx != null && n.start + n.length > nx ? { ...n, length: Math.max(0.12, nx - n.start - 0.02) } : n; });
        by = new Map(); for (const n of notes) { const k = Math.round(n.start * 1000); if (!by.has(k)) by.set(k, []); by.get(k).push(n.pitch); }
      }
      const names = [...by.keys()].sort((a, b) => a - b).map((k) => chordName(by.get(k)).replace(/\/.*$/, ""));   // the chord, not its inversion
      return { notes: (I.keep || []).concat(notes), names, sc: I.sc, simple: { ...sr, warn: heard.length ? keyClash(I, heard.filter((n) => !n.locked)) : null }, segs: [] };
    };
    // SIMPLE DICE bass and melody (15 Nov): a figure from a song of the picked genre (ui/dice-train.js), laid on the chords
    // under it: the chords on the other lanes when there are some (the test found the old fits put only a third of the
    // bass notes on the chord there), else a chord loop of the same genre and mood. Bass: each note keeps where it sat
    // against the song's chord root; melody: the song's line in this key, its long notes on beats 1 and 3 on a chord note.
    const simpleLine = (I) => {
      const DT = window.KT2DiceTrain; if (!DT || !DT.ready()) return null;
      const beats = Math.max(1, I.c.beats || 16), bars = Math.ceil(beats / 4), minor = SCALES[I.sc.scale].steps[2] === 3, mode = I.mode;
      const heard = diceContext(I.c, I.voice).filter((n) => !n.locked && n.length > 0.05);
      // the chords under it, as segments [{ at, end, ps }]
      let segs = [], from = "";
      const cut = (ns) => {
        const ts = [...new Set(ns.flatMap((n) => [n.start, n.start + n.length]).concat([0, beats]).map((t) => Math.round(Math.max(0, Math.min(beats, t)) * 64) / 64))].sort((a, b) => a - b), out = [];
        for (let i = 0; i + 1 < ts.length; i++) { const m = (ts[i] + ts[i + 1]) / 2, ps = ns.filter((n) => n.start <= m && n.start + n.length > m).map((n) => n.pitch); const l = out[out.length - 1]; const k = [...new Set(ps.map(pc))].sort((a, b) => a - b).join(); if (l && l.k === k) l.end = ts[i + 1]; else out.push({ at: ts[i], end: ts[i + 1], ps, k }); }
        return out;
      };
      // the chords come from the lanes that play chords or a bass line; a melody or arp on another lane is left out (a
      // 4-lane test re-rolling chords found the old arp's notes read as part of the new chords: 8% clashes with the melody)
      const bySrc = new Map(); for (const n of heard) { if (!bySrc.has(n.src)) bySrc.set(n.src, []); bySrc.get(n.src).push(n); }
      const chordsL = [], bassL = [];   // a lane of chords wins; a bass line stands in only when no lane plays chords
      for (const ns of bySrc.values()) {
        const poly = ns.filter((n) => ns.some((m) => m !== n && Math.abs(m.start - n.start) < 0.03)).length / ns.length;   // notes that start together: chords (an arp's ringing notes overlap but never start together)
        const mid = ns.reduce((a, n) => a + n.pitch, 0) / ns.length;
        if (poly >= 0.5) chordsL.push(...ns); else if (mid < 50) bassL.push(...ns);
      }
      const harm = chordsL.length ? chordsL : bassL;
      if (heard.length) segs = cut(harm.length ? harm : heard).filter((g) => g.ps.length);
      if (!segs.length) { const x = KT2DiceSimple.chords({ tonic: I.sc.tonic, minor, beats, scalePcs: scalePcs(I.sc) }); if (x) { segs = cut(snapToKey(x.notes, I.sc)).filter((g) => g.ps.length); from = x.from; } }
      if (!segs.length) segs = [{ at: 0, end: beats, ps: [60 + I.sc.tonic, 60 + I.sc.tonic + (minor ? 3 : 4), 67 + I.sc.tonic] }];
      // a long held note fills the gaps: a beat with nothing playing takes the chord before it
      const segAt = (t) => { let g = segs[0]; for (const x of segs) if (x.at <= t + 1e-6) g = x; return g; };
      const rootOf = (g) => { const lo = Math.min(...g.ps); return lo < 48 ? pc(lo) : chordRoot(g.ps); };
      const pcsOf = (g) => [...new Set(g.ps.map(pc))];
      const dens = [0, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)], notes = [];
      let part = null;
      if (mode === "bass") {
        part = DT.bass({ dens, bars }); if (!part) return null;
        const at16 = []; part.bars.forEach((b, bi) => b.forEach(([s16]) => at16.push(bi * 16 + s16)));
        at16.sort((a, b) => a - b);
        part.bars.forEach((b, bi) => b.forEach(([s16, l16, iv]) => {
          const t16 = bi * 16 + s16, at = t16 / 4; if (at >= beats - 1e-6) return;
          const r = rootOf(segAt(at)); let p = 33 + pc(r - 33) + iv;   // the root between A1 and G#2, the note where the song put it
          while (p > 52) p -= 12; while (p < 28) p += 12;
          // a note on the beat or held a beat or more sits on a note of the chord there (a song's major 3rd under a minor chord)
          if ((s16 % 4 === 0 || l16 >= 4) && !pcsOf(segAt(at)).includes(pc(p))) p = nearestIn(pcsOf(segAt(at)), p);
          else if (l16 >= 2) { const cp = pcsOf(segAt(at)); if (!cp.includes(pc(p)) && cp.some((c) => pc(p - c) === 1 || pc(c - p) === 1)) p = nearestIn(cp, p); }   // an 8th or longer a semitone off the chord: onto it
          const nx = at16.find((x) => x > t16);
          notes.push({ pitch: p, start: at, length: Math.max(0.12, Math.min(l16 / 4 * 0.95, beats - at, nx == null ? 99 : (nx - t16) / 4)), velocity: s16 % 4 === 0 ? 106 : 94 });
        }));
      } else if (mode === "arp") {
        // ARP: a figure from the arps found in Eman's songs (ui/toymachine-arps-songs.js), counted in chord notes up from the
        // root of the chord under it, 8ths or 16ths. No plain hand-made shapes
        if (window.KT2_SONG_ARPS_OFF || songArps().length < 2) return null;
        const speed = 1 + Math.floor(Math.random() * 2), step = [1, 0.5, 0.25, 0.25][speed], fig = songArpFigure(I.sc, speed), seq = fig.steps;
        part = { from: ((fig.from && fig.from.names) || []).slice(0, 1) };
        let lastAt = -1;
        for (let at = 0, k = 0; at < beats - 1e-6; at += step, k++) {
          const st = seq[k % seq.length];
          if (!st || st.n == null || typeof st.n !== "number") continue;
          if (st.prob != null && Math.random() > st.prob) continue;
          const g = segAt(at), r = rootOf(g), r0 = 60 + pc(r - 60) - (pc(r - 60) > 6 ? 12 : 0), ivs = [...new Set(pcsOf(g).map((x) => pc(x - r)))].sort((a, b) => a - b);
          const tones = (ivs.length ? ivs : [0, 7]).slice(0, 4).map((x) => r0 + x);
          const n = Math.max(-tones.length, st.n);
          let p = tones[((n % tones.length) + tones.length) % tones.length] + 12 * Math.floor(n / tones.length) + 12 * (st.oct || 0) + (fig.lift || 0);
          while (p > 91) p -= 12; while (p < 48) p += 12;
          const vel = Math.round(66 + (st.vel != null ? st.vel : 0.8) * 46 + (at % 1 === 0 ? 6 : 0));
          const len = Math.max(0.1, Math.min(step * Math.min(2, st.gate != null ? st.gate : 1) * 0.9, beats - at));
          const rat = Math.max(1, Math.min(4, st.ratchet || 1));
          for (let q = 0; q < rat; q++) { const t = at + (q * step) / rat; if (t <= lastAt + 1e-6) continue; notes.push({ pitch: p, start: t, length: rat > 1 ? (step / rat) * 0.8 : len, velocity: vel }); lastAt = t; }
        }
      } else {
        part = DT.melody({ minor, dens, bars }); if (!part || !part.notes.length) return null;
        const base = 72 + I.sc.tonic - (I.sc.tonic > 5 ? 12 : 0);
        let ps = part.notes.map(([s16, l16, d, ch]) => ({ at: s16 / 4, len: l16 / 4, p: degreePitch(I.sc, d, base) + (ch ? 1 : 0) }));
        const mid = ps.map((x) => x.p).sort((a, b) => a - b)[ps.length >> 1], sh = Math.round((base + 2 - mid) / 12) * 12;
        const sorted = ps.map((x) => x.at).sort((a, b) => a - b);
        for (const x of ps) {
          if (x.at >= beats - 1e-6) continue;
          let q = x.p + sh;
          while (q > 91) q -= 12; while (q < 53) q += 12;   // a wide vocal line folds into the melody's range (test 15 Nov: notes up to C8)
          if ((Math.abs(x.at % 2) < 1e-6 && x.len >= 0.5) || x.len >= 1) { const ct = nearestIn(pcsOf(segAt(x.at)), q); if (Math.abs(ct - q) <= 2) q = ct; }   // and any note held a beat or more
          else if (x.len >= 0.5) { const cp = pcsOf(segAt(x.at)); if (!cp.includes(pc(q)) && cp.some((c) => pc(q - c) === 1 || pc(c - q) === 1)) q = nearestIn(cp, q); }   // an 8th or longer a semitone off a chord note: onto the chord (4-lane test: 5.6% clashes)
          const nx = sorted.find((t) => t > x.at + 1e-6);
          notes.push({ pitch: q, start: x.at, length: Math.max(0.12, Math.min(x.len * 0.95, beats - x.at, nx == null ? 99 : nx - x.at)), velocity: x.at % 1 === 0 ? 102 : 90 });
        }
      }
      if (!notes.length) return null;
      let out = notes;
      if (!I.all || DICE_STRICT()) out = snapToKey(out, I.sc);
      // PLAYBOI science (Eman 24 Nov 2026, the Playboi / Yeat tutorials): the 808 glides into some of its notes (a legato
      // move, or a jump up the octave and back) and the melody slides between close notes, like those beats do.
      // KT2_DICE_PLAYBOI_OFF = no slides (the science itself is off then too)
      // OPIUM science (24 Nov 2026) glides the same way (KT2_DICE_OPIUM_OFF = never)
      if ((KT2DiceSimple.slidesOn ? KT2DiceSimple.slidesOn() : (!window.KT2_DICE_PLAYBOI_OFF && KT2DiceSimple.playboiOn && KT2DiceSimple.playboiOn())) && (mode === "bass" || mode === "melody")) out = playboiSlides(out, mode);
      const locks = (I.keep || []).map((n) => [n.start, n.start + n.length]);   // locked notes keep their time (as the chords do)
      if (locks.length) out = out.filter((n) => !locks.some(([a, e]) => n.start >= a - 1e-6 && n.start < e - 1e-6)).map((n) => { const nx = locks.filter(([a]) => a > n.start + 1e-6).map(([a]) => a).sort((x, y) => x - y)[0]; return nx != null && n.start + n.length > nx ? { ...n, length: Math.max(0.12, nx - n.start) } : n; });
      const names = []; for (const g of segs) { const nm = chordName(g.ps).replace(/\/.*$/, ""); if (nm && names[names.length - 1] !== nm && names.length < 8) names.push(nm); }
      const st = KT2DiceSimple.state();
      return { notes: (I.keep || []).concat(out), names, sc: I.sc, segs: [], simple: { genre: KT2DiceSimple.GENRES[st.genre].n, mood: KT2DiceSimple.MOODS[st.mood].n, from: (part.from || [])[0] || from, part: mode, warn: heard.length ? keyClash(I, heard) : null } };
    };
    // ROLL IN THE YELLOW (Eman, 26 Nov: "if I select a certain area with yellow ... the dice will only reimagine that part"):
    // with the loop bar on over part of the pattern, the roll only writes inside it. Notes there that aren't locked are
    // replaced, locked ones stay and the new notes fit around them; everything outside stays exactly as it is and is what
    // the new part fits to (the dice treats it like locked notes: it hears its chords and keeps its rhythm going).
    // { lo, hi } in beats from the clip's start, or null (no loop, or it covers the whole pattern). KT2_DICE_RANGE_OFF = whole pattern
    function diceRange(c) {
      if (window.KT2_DICE_RANGE_OFF || !c) return null;
      const spb = secPerBeat(), st = ui.state || {}, pt = soloMode() ? soloPart() : null, beats = Math.max(1, c.beats || 16);
      const on = soloMode() ? !!pt : !!(ui.transport && ui.transport.looping);
      if (!on || !(spb > 0)) return null;
      let lo = pt ? pt.from / spb : (st.loopStart - c.start) / spb, hi = pt ? pt.to / spb : (st.loopEnd - c.start) / spb;
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
      lo = Math.max(0, Math.round(lo * 4) / 4); hi = Math.min(beats, Math.round(hi * 4) / 4);
      if (hi - lo < 0.25 || (lo <= 1e-6 && hi >= beats - 1e-6)) return null;
      return { lo, hi };
    }
    const rollWith = (p) => {
      const c = S.clipId && findClip(S.clipId);
      if (!c) return;
      if (window.TmDice && TmDice.beforeRoll) TmDice.beforeRoll();   // the MOOD card unlocked: every roll picks a new mood
      if (p.heard && p.heard.length) applyPrompt(p);
      let keep = S.notes.filter((n) => n.locked && (S.voice !== "*" || !n._v));   // locked notes stay (Eman, 4 Nov)
      const rg = diceRange(c);
      if (rg) {   // ROLL IN THE YELLOW: what's outside goes in as locked (marked _rk, unlocked again after the roll)
        const out = S.notes.filter((n) => !n.locked && !n._v && (n.start < rg.lo - 1e-6 || n.start >= rg.hi - 1e-6))
          .map((n) => ({ ...n, length: n.start < rg.lo - 1e-6 && n.start + n.length > rg.lo + 1e-6 ? Math.max(0.06, rg.lo - n.start) : n.length, locked: true, _rk: 1 }));
        // CHORDS: a locked note inside the yellow doesn't block the chord there, the new chord is built with it (_soft:
        // the chord timing ignores it, the loop that holds it best wins); BASS / MELODY / ARP play around it as before
        if (modeNow() === "chords") keep = keep.map((n) => (n.locked && !n._v && n.start >= rg.lo - 1e-6 && n.start < rg.hi - 1e-6 ? { ...n, _soft: 1 } : n));
        keep = keep.concat(out);
      }
      const rgB = rg ? [Math.floor(rg.lo / 4 + 1e-6) + 1, Math.max(Math.floor(rg.lo / 4 + 1e-6) + 1, Math.ceil(rg.hi / 4 - 1e-6))] : null, rgSay = rg ? (rgB[0] === rgB[1] ? "BAR " + rgB[0] : "BARS " + rgB[0] + "\u2013" + rgB[1]) + " ONLY  \u00b7  " : "";
      S.recentLoops = S.recentLoops || [];
      const rowNow = !window.KT2_DICE_ROW_OLD && window.TmDice && window.ChordBrain ? TmDice.get(pr && pr.isConnected ? pr.value : "", modeNow()) : null;
      const simple = !!(window.KT2DiceSimple && KT2DiceSimple.on());
      // the song data still loading (the first seconds after the page opens): wait for it and roll then, instead of the old
      // dice standing in. If it can't load, the old roll runs
      if (simple && window.KT2DiceTrain && !KT2DiceTrain.ready() && !rollWith.waited) {
        toast("Loading the songs\u2026");
        Promise.resolve(KT2DiceTrain.load()).then(() => { rollWith.waited = true; try { rollWith(p); } finally { rollWith.waited = false; } });
        return;
      }
      const I = { mode: modeNow(), speed: dice.speed, sc: S.sc, c, voice: S.voice === "*" ? null : S.voice, keep, text: pr && pr.isConnected ? pr.value : "", p, all: S.all, recent: S.recentLoops, fullPick: rowNow ? rowNow.full : null,
        slide: simple ? false : p.slide != null ? p.slide : dice.slide, recentFits: S.recentFits || [], setBars: (beats) => { run("setClipLength", { clipId: S.clipId, beats }); c.beats = beats; } };
      // DICE LIVE (ui/dice-live.js): a seed per roll (so a dial turned afterwards re-plays this roll with one thing
      // changed) and the song sections over the whole pattern
      // SIMPLE DICE (Eman, 15 Nov: "a simple chord generator ... GENRE and also MOOD ... no other things"; ui/kt2-dice-simple.js):
      // a CHORDS roll is a chord loop from a song of the picked genre and mood, in the key set here. No DICE LIVE (no cards
      // left to turn). KT2_DICE_SIMPLE_OLD = the old roll
      const live = !simple && window.DiceLive && DiceLive.on() && rowNow;
      if (live) { I.seed = 1 + Math.floor(Math.random() * 1e9); I.setBars = null; I.recent = I.recent.slice(); I.recentFits = I.recentFits.slice(); I.toks = DiceLive.songToks({ bars: Math.round((c.beats || 16) / 4), seed: I.seed, sc: S.sc, row: rowNow, text: moodText(I.text), inKey: !S.all || DICE_STRICT(), avoid: I.recent }); }
      if (live) I.mem = [lastProg, lastBassPat];   // the roll's own memory (no repeated progression / groove), replayed on a live edit
      let r = (simple && modeNow() === "chords" && simpleChords(I)) || (simple && (modeNow() === "bass" || modeNow() === "melody" || modeNow() === "arp") && simpleLine(I)) || (live ? DiceLive.seeded(I.seed, () => diceCompute(I)) : diceCompute(I));
      // ONE CHORD ALL THE WAY (Eman, 15 Nov: the same chord for all 16 bars): a chords roll over 4+ hits that came out as a
      // single chord is rolled again (up to 3 times) with a new seed. KT2_DICE_ONECHORD_OK = keep it
      const oneChord = (x) => { if (!x || !x.notes || modeNow() !== "chords" || x.full || x.blocked) return false; const G = new Map(); for (const n of x.notes) if (!n.locked && !n.tl && !n.bs) { const k = (+n.start).toFixed(3); if (!G.has(k)) G.set(k, []); G.get(k).push(n.pitch); } if (G.size < 4) return false; return new Set([...G.values()].map((g) => [...new Set(g.map(pc))].sort((a, b) => a - b).join(","))).size === 1; };
      for (let t = 0; t < 3 && !window.KT2_DICE_ONECHORD_OK && !r.simple && oneChord(r); t++) { if (live) { I.seed = 1 + Math.floor(Math.random() * 1e9); I.toks = DiceLive.songToks({ bars: Math.round((c.beats || 16) / 4), seed: I.seed, sc: S.sc, row: rowNow, text: moodText(I.text), inKey: !S.all || DICE_STRICT(), avoid: I.recent }); r = DiceLive.seeded(I.seed, () => diceCompute(I)); } else r = diceCompute(I); }
      if (r.fit) { S.recentFits = [r.fit].concat(S.recentFits || []).slice(0, 3); S.lastHear = r.analysis; }   // the next roll answers differently
      if (r.brain) { S.lastBrain = r.brain; S.recentLoops = [r.brain.loopKey].concat(S.recentLoops).slice(0, 8); }   // the same loop doesn't come back for 8 rolls
      if (r.speed != null) dice.speed = r.speed;
      if (r.blocked) return toast(r.blocked, true);   // a FULL pattern with nothing to add: say so, change nothing
      if (rg && r.notes) { const K = new Set(keep); r.notes = keep.concat(r.notes.filter((n) => !K.has(n) && !n._rk && !n.locked && !n._v && n.start >= rg.lo - 1e-6 && n.start < rg.hi - 1e-6).map((n) => (n.start + n.length > rg.hi + 1e-6 ? { ...n, length: Math.max(0.06, rg.hi - n.start) } : n))); }
      // MOOD DNA: the mood rolled in its own scale on the same root (VILLAIN in F major -> F harmonic minor). The lane's
      // key follows quietly (no note moving: the new notes are written in it). KT2_MOOD_KEY_OLD = never happens
      if (r.moodScale && SCALES[r.moodScale] && r.moodScale !== S.sc.scale && !S.all) { S.sc = { ...S.sc, scale: r.moodScale }; const se = q("tmm-scale"); if (se) se.value = r.moodScale; setLaneScale(S.trackId, S.sc); }
      if (S.voice === "*") r.notes = r.notes.concat(S.notes.filter((n) => n._v));   // ALL: the dice writes the main sound
      S.notes = diceNoStack(octRoll(r.notes).map((n) => ({ ...n, pitch: Math.max(LOW, Math.min(HIGH, n.pitch)) })), { keep: I.keep, mono: I.mode === "bass" }); S.sel = null; S.multi = null;
      if (rg) S.notes = S.notes.map((n) => { if (n._soft) { const { _soft, ...m } = n; n = m; } if (!n._rk) return n; const { _rk, ...m } = n; m.locked = false; return m; });   // the outside notes as they were
      // RHYTHM IN THE BAR (Eman, 15 Nov 17:16): SIMPLE DICE chords play the rhythm picked in the bar's light-blue row (the
      // song's chords, each one on the hits where it sounds). AUTO = the song's own rhythm; with locked notes the locked rhythm wins. KT2_DICE_TBROW_OFF = never
      if (simple && modeNow() === "chords" && !window.KT2_DICE_TBROW_OFF && !r.full && !r.blocked && !I.keep.length) { rrSrc = null; rerhythmLive("roll"); }
      // the BASS / MELODY / ARP row: a rhythm picked or drawn there (not AUTO) is the rhythm the roll plays (Eman, 26 Nov)
      else if (simple && modeNow() !== "chords" && !window.KT2_DICE_TBROW_OFF && !r.full && !r.blocked && !I.keep.length) { rlSrc = null; rerhythmLine("roll"); }   // locked chords: their own rhythm continues (KT2_DICE_LOCKRHY)
      S.live = live ? { I, swapKey: DiceLive.swapKey(rowNow), clipId: S.clipId, voice: S.voice, mode: modeNow(), segs: r.brain ? r.brain.segs : null, sig: liveSig(), r } : null;
      if (live) setTimeout(() => TmDice.refresh(pane), 0);
      centreOn(S.notes);
      popNotes(window.KT2_DICE_POPLOCK_OLD ? S.notes : S.notes.filter((n) => !n.locked), true);   // locked notes stay still (Eman 15 Nov); KT2_DICE_POPLOCK_OLD = all pop
      draw(); commit();
      const ic = q("tmm-dice").querySelector("svg");
      const spin = (el) => { if (el && el.animate) el.animate([{ rotate: "0deg", scale: "1" }, { rotate: "200deg", scale: "1.25" }, { rotate: "360deg", scale: "1" }], { duration: 420, easing: "cubic-bezier(.2,.8,.3,1)" }); };
      spin(ic); setTimeout(() => { if (window.TmDice && TmDice.tumble && !window.KT2_DICE_TUMBLE_OLD) TmDice.tumble(pane); else spin(pane.querySelector("#tmd-bigdice svg")); }, 20);   // the big dice in the panel squashes and tumbles (redrawn just after the roll)
      if (window.KT2Juice && KT2Juice.sound && KT2Juice.sound.dice) KT2Juice.sound.dice();
      const names = [];
      if (r.names) { for (const nm0 of r.names) { const nm = spell(nm0, r.sc || S.sc); if (names[names.length - 1] !== nm && names.length < 6) names.push(nm); } }
      else for (let i = 0; i < r.segs.length && names.length < 4; i += 2) { const d = r.segs[i] && r.segs[i].deg; if (d == null) continue; const nm = chordName([0, 2, 4].map((x) => degreePitch(S.sc, d + x, 60 + S.sc.tonic))); if (names[names.length - 1] !== nm) names.push(nm); }
      const heardAll = (r.brain && r.brain.heard && r.brain.heard.length ? r.brain.heard : []).concat(p.heard || []).filter((w, i, a) => a.findIndex((x) => x.replace(/~$/, "").toLowerCase() === w.replace(/~$/, "").toLowerCase()) === i);   // BASS~ and bass are one word
      const said = heardAll.length ? heardAll.join(" \u00b7 ").toUpperCase() + "  \u2192  " : "";
      if (r.full) {   // the FULL line in the dice row shows the choices (extension, added tone, voicing); AUTO's pick shows as a ghost
        S.fullUsed = r.fullG || null;
        if (window.TmDice && !window.KT2_DICE_ROW_OLD && modeNow() === "chords") { if (!TmDice.isOpen()) TmDice.toggle(pane, true); else TmDice.refresh(pane); }
        return toast(`FULL PATTERN  \u2192  ${r.full}. Roll again for another idea.`);
      }
      if (r.simple) return toast(rgSay + `${r.simple.part ? DICE_MODES[modeNow()] + " over " : ""}${names.join(" \u2013 ")}  \u00b7  ${r.simple.genre === "ALL" ? "" : r.simple.genre + "  \u00b7  "}${r.simple.mood === "ANY" ? "" : r.simple.mood + "  \u00b7  "}from ${r.simple.from || "the songs"}${r.simple.lockRhy ? "  \u00b7  " + r.simple.lockRhy : ""}${r.simple.warn ? "  \u00b7  " + r.simple.warn : ""}`, !!r.simple.warn);
      if (r.contSaid) toast(said + r.contSaid);
      else if (r.analysis && r.analysis.heard && r.said) {   // the new ears: what it heard, then what it did about it
        const A = r.analysis, what = A.advice.filter((w) => !/^sounds like|^no clear chords/.test(w)).join(" + ");
        const KN = keyNames();
        const warn = r.keyFollowed ? `  (rolled in ${KN[r.keyFollowed.tonic]} ${r.keyFollowed.scale} like the notes there, not the key set here)` : A.keyHint ? `  (these notes sound like ${KN[A.keyHint.tonic]} ${A.keyHint.scale}, not the key set here)` : "";
        const plan = []; for (const nm of r.planNames || []) if (plan[plan.length - 1] !== nm && plan.length < 6) plan.push(nm);
        if (A.messy) toast(said + `No clear chords in what's there  \u2192  ${DICE_MODES[modeNow()]} rolled fresh (${names.join(" \u2013 ")}), kept clear of the notes`);
        else if (A.drone && r.overIt) toast(said + `HEARD ${(A.names && A.names[0]) || ""} held${what ? " in the " + what : ""}  \u2192  ${DICE_MODES[modeNow()]} ${r.said.join(", ")} (${names.join(" \u2013 ")} over it)` + warn);
        else toast(said + `HEARD ${names.join(" \u2013 ")}${what ? " in the " + what : ""}  \u2192  ${DICE_MODES[modeNow()]} ${r.said.join(", ")}${plan.length ? ", going on to " + plan.join(" \u2013 ") : ""}` + warn);
      } else toast(said + (modeNow() === "chords" && !r.heard ? names.join(" \u2013 ") + (r.expSaid ? "  \u00b7  " + r.expSaid : "") + (r.moodScale ? "  (" + SCALES[r.moodScale].name + ", the mood's scale)" : "") : `${DICE_MODES[modeNow()]} ${r.heard ? "over what's there" : "over"}: ${names.join(" \u2013 ")}`) + trainedSay(r, modeNow()));
    };
    // DICE LIVE (Eman, 8 Nov 22:21): a dial turned after a roll changes that roll's notes, live. SHAPE dials keep the
    // chords (the roll's chords go back in as toks), SWAP dials (tension, random, pop/alt) roll the chords again from the
    // same seed. Only while the notes are exactly what the roll wrote; otherwise the dial sets up the next roll.
    function liveSig() { return (S.notes || []).map((n) => n.pitch + "@" + Math.round(n.start * 1000) + ":" + Math.round(n.length * 1000) + (n.locked ? "L" : "") + (n._v || "")).sort().join(","); }
    function liveArmed() { const L = S && S.live; return !!(L && window.DiceLive && DiceLive.on() && L.clipId === S.clipId && L.voice === S.voice && L.mode === modeNow() && findClip(S.clipId) && L.sig === liveSig()); }
    let liveT = null;
    function liveEdit(dial, final) {
      if (!liveArmed()) return false;
      const L = S.live, c = findClip(S.clipId), kind = DiceLive.kindOf(dial);
      const rowNow = TmDice.get(L.I.text, L.mode);
      const I = { ...L.I, c, recent: L.I.recent.slice(), recentFits: L.I.recentFits.slice() };
      // a SWAP dial in a new place = another set of chords; back in the roll's own place = the roll's chords again
      if (kind === "swap") { const k = DiceLive.swapKey(rowNow); if (k !== L.swapKey) I.seed = L.I.seed + 7919 * (k + 1); }
      I.toks = kind === "shape" && L.segs ? L.segs : DiceLive.songToks({ bars: Math.round((c.beats || 16) / 4), seed: I.seed, sc: I.sc, row: rowNow, text: moodText(I.text), inKey: !I.all || DICE_STRICT(), avoid: I.recent });
      const mem = [lastProg, lastBassPat];
      [lastProg, lastBassPat] = I.mem || mem;
      let r = DiceLive.seeded(L.I.seed, () => diceCompute(I));
      // a SWAP dial moved to a new place should swap something: a prompt with few chords in it can roll the same ones
      // again, so try a few more seeds before giving up (the same place always lands on the same chords)
      const toks = (x) => (x && x.brain ? x.brain.segs.map((g) => g.baseTok).join(" ") : "");
      if (kind === "swap" && I.seed !== L.I.seed && L.segs) {
        const old = L.segs.map((g) => g.baseTok).join(" ");
        for (let k = 1; k <= 4 && toks(r) === old; k++) { I.seed += 104729; I.toks = DiceLive.songToks({ bars: Math.round((c.beats || 16) / 4), seed: I.seed, sc: I.sc, row: rowNow, text: moodText(I.text), inKey: !I.all || DICE_STRICT(), avoid: I.recent }); [lastProg, lastBassPat] = I.mem || mem; r = DiceLive.seeded(L.I.seed, () => diceCompute(I)); }
      }
      [lastProg, lastBassPat] = mem;
      if (r.blocked) return false;
      if (S.voice === "*") r.notes = r.notes.concat(S.notes.filter((n) => n._v));
      S.notes = diceNoStack(octRoll(r.notes).map((n) => ({ ...n, pitch: Math.max(LOW, Math.min(HIGH, n.pitch)) })), { keep: I.keep, mono: I.mode === "bass" }); S.sel = null; S.multi = null;
      if (kind === "swap" && r.brain) L.segs = r.brain.segs;   // the swapped chords are the ones the next SHAPE turn keeps
      L.r = r; L.sig = liveSig();
      draw();
      clearTimeout(liveT);
      if (final) commit(); else liveT = setTimeout(() => { if (S && S.live === L) commit(); }, 140);   // the sound follows while dragging
      return r;
    }
    // RE-RHYTHM (Eman, 11 Nov 23:59: "if you have chords already put out and you change this rhythm, they change to that
    // rhythm right away"): when the dice can't replay its own roll (chords drawn by hand, edited, or from an earlier
    // session), the chords there are read as a timeline and played again on the Rhythm grid's hits, every click.
    // The timeline is kept, so a sparse rhythm and back doesn't lose a chord. KT2_DICE_RERHYTHM_OFF = only rolls follow
    let rrSrc = null;
    function chordLine(ns) {   // [{ at, end, notes }] one entry per chord change
      const by = new Map(); for (const n of ns) { const k = Math.round(n.start * 64) / 64; if (!by.has(k)) by.set(k, []); by.get(k).push(n); }
      const ats = [...by.keys()].sort((a, b) => a - b), out = [];
      for (const at of ats) { const g = by.get(at).slice().sort((a, b) => a.pitch - b.pitch), sig = g.map((n) => n.pitch).join(","), last = out[out.length - 1];
        if (last && last.sig === sig) continue; out.push({ at, sig, notes: g }); }
      return out;
    }
    function rerhythmLive(final) {
      if (window.KT2_DICE_RERHYTHM_OFF || !S || !S.notes || !S.clipId || S.voice === "*" || modeNow() !== "chords") return false;
      const c = findClip(S.clipId); if (!c) return false;
      const row = TmDice.get(q("tmm-prompt") ? q("tmm-prompt").value : "", "chords"); if (!row.hits) return false;
      const own = S.notes.filter((n) => !n.locked && !n._v), keep = S.notes.filter((n) => n.locked || n._v);
      const line = rrSrc && rrSrc.clipId === S.clipId && rrSrc.sig === liveSig() ? rrSrc.line : chordLine(own);
      if (!line.length || !line.some((g) => g.notes.length >= 2)) return false;   // a line, not chords
      const beats = Math.max(1, c.beats || 16), on = row.hits.map((x, i) => (x ? i : -1)).filter((i) => i >= 0), hl = row.hitLen, out = [];
      const lenF = row.len != null && row.len < 3 ? [0.25, 0.5, 0.9][row.len] : null;
      const per = row.hits.length / 4, N = row.hits.length;   // ROW BARS: the whole 4 / 8 / 16-bar rhythm loops
      for (let bar = 0; bar * per < beats - 1e-6; bar++) on.forEach((i, k) => {
        const at = bar * per + i * 0.25; if (at >= beats - 1e-6) return;
        const nx = Math.min(beats, bar * per + (k + 1 < on.length ? on[k + 1] : N) * 0.25);
        let len = nx - at; if (hl && hl[i] > 0) len = Math.min(len, hl[i] * 0.25); if (lenF != null) len = Math.max(0.12, (nx - at) * lenF);
        len = Math.max(0.12, len > 0.5 ? len - 0.02 : len * 0.95);
        let g = line[0]; for (const x of line) if (x.at <= at + 1e-6) g = x; else break;
        for (const n of g.notes) out.push({ ...n, start: at, length: len });
      });
      if (!out.length) return false;
      const SN = !window.KT2_DICE_EXACT_OLD && stackN(row);
      S.notes = diceNoStack(SN ? exactStack(keep.concat(out), SN, { keep, rootAt: (t, ps) => (ps.length ? chordRoot(ps) : null) }) : keep.concat(out), { keep }); S.sel = null; S.multi = null;
      rrSrc = { clipId: S.clipId, line, sig: liveSig() };
      if (final === "roll") return true;   // the roll draws and saves itself
      draw(); clearTimeout(liveT);
      if (final) commit(); else liveT = setTimeout(() => { if (S) commit(); }, 140);
      return true;
    }
    // RHYTHM ROW ON EVERY PART (Eman, 26 Nov): on BASS, MELODY and ARP the bar's row re-times the part's own notes: each hit
    // plays the note that was sounding at that moment in the line as it was (the line is kept, so a sparse rhythm and back
    // gets the notes back), as long as the hit says. Chords stay with rerhythmLive. KT2_TBROW_ALL_OFF = chords only
    let rlSrc = null;
    function rerhythmLine(final) {
      const mode = modeNow();
      if (window.KT2_TBROW_ALL_OFF || window.KT2_DICE_RERHYTHM_OFF || !S || !S.notes || !S.clipId || S.voice === "*" || !["bass", "melody", "arp"].includes(mode)) return false;
      const c = findClip(S.clipId); if (!c) return false;
      const row = TmDice.get(q("tmm-prompt") ? q("tmm-prompt").value : "", mode); if (!row.hits) return false;
      const own = S.notes.filter((n) => !n.locked && !n._v), keep = S.notes.filter((n) => n.locked || n._v);
      const src = rlSrc && rlSrc.clipId === S.clipId && rlSrc.mode === mode && rlSrc.sig === liveSig() ? rlSrc.line : own.slice().sort((a, b) => a.start - b.start || (mode === "bass" ? a.pitch - b.pitch : b.pitch - a.pitch));
      if (!src.length) return false;
      const beats = Math.max(1, c.beats || 16), on = row.hits.map((x, i) => (x ? i : -1)).filter((i) => i >= 0), hl = row.hitLen, N = row.hits.length, per = N / 4, out = [];
      const locks = keep.filter((n) => n.locked && !n._v).map((n) => [n.start, n.start + n.length]);
      for (let bar = 0; bar * per < beats - 1e-6; bar++) on.forEach((i, k) => {
        const at = bar * per + i * 0.25; if (at >= beats - 1e-6) return;
        if (locks.some(([a, e]) => at >= a - 1e-6 && at < e - 1e-6)) return;   // a locked note keeps its time
        const nx = Math.min(beats, bar * per + (k + 1 < on.length ? on[k + 1] : N) * 0.25);
        let len = nx - at; if (hl && hl[i] > 0) len = Math.min(len, hl[i] * 0.25);
        len = Math.max(0.1, len > 0.5 ? len - 0.02 : len * 0.95);
        let g = src[0]; for (const x of src) if (x.start <= at + 1e-6) g = x; else break;
        out.push({ ...g, start: at, length: len });
      });
      if (!out.length) return false;
      S.notes = diceNoStack(keep.concat(out), { keep, mono: mode === "bass" }); S.sel = null; S.multi = null;
      rlSrc = { clipId: S.clipId, mode, line: src, sig: liveSig() };
      if (final === "roll") return true;
      draw(); clearTimeout(liveT);
      if (final) commit(); else liveT = setTimeout(() => { if (S) commit(); }, 140);
      return true;
    }
    // the STACKED card turned over chords the dice can't replay (drawn by hand, edited, an older session): the chords
    // there take the new size right away, same chords and rhythm (EXACT STACK). KT2_DICE_EXACT_OLD = only rolls follow
    let stSrc = null;
    function restackLive(final) {
      if (window.KT2_DICE_EXACT_OLD || !S || !S.notes || !S.clipId || S.voice === "*" || modeNow() !== "chords") return false;
      const row = TmDice.get(q("tmm-prompt") ? q("tmm-prompt").value : "", "chords"), N = stackN(row); if (!N) return false;
      const keep = S.notes.filter((n) => n.locked || n._v), own = stSrc && stSrc.clipId === S.clipId && stSrc.sig === liveSig() ? stSrc.own : S.notes.filter((n) => !n.locked && !n._v);   // 6 -> 3 -> 6 gets the first chords back
      const st = new Map(); for (const n of own) { const k = Math.round(n.start * 1000); st.set(k, (st.get(k) || 0) + 1); }
      if (![...st.values()].some((x) => x >= 2)) return false;   // a line, not chords
      const next = diceNoStack(exactStack(keep.concat(own), N, { keep, rootAt: (t, ps) => (ps.length ? chordRoot(ps) : null) }), { keep });
      const sig = (ns) => ns.map((n) => n.pitch + "@" + Math.round(n.start * 1000) + ":" + Math.round(n.length * 1000)).sort().join(",");
      if (sig(next) === sig(S.notes)) return true;
      S.notes = next; S.sel = null; S.multi = null; rrSrc = null; stSrc = { clipId: S.clipId, own, sig: liveSig() };
      draw(); clearTimeout(liveT);
      if (final) commit(); else liveT = setTimeout(() => { if (S) commit(); }, 140);
      return true;
    }
    pane._diceLive = { edit: liveEdit, armed: liveArmed, rerhythm: rerhythmLive, restack: restackLive };
    // the bar fits its row (Eman, 4 Nov): when the window is narrow (SPLIT) it goes compact, and the
    // tools used least (Reference, Octave, Length/Grid, Play/Clear) fold into the ... menu, in that order
    [...q("tmm-moregrp").parentNode.children].forEach((g, i) => { g.dataset.ord = i; });
    q("tmm-more").onclick = (e) => {
      e.stopPropagation();
      const pop = q("tmm-morepop"), b = q("tmm-more").getBoundingClientRect(), h = pop.parentNode.getBoundingClientRect();
      pop.hidden = !pop.hidden;
      pop.style.right = Math.max(4, h.right - b.right) + "px"; pop.style.top = (b.bottom - h.top + 4) + "px";
      if (!pop.hidden && pop.animate) pop.animate([{ opacity: 0, translate: "0 -6px", scale: "0.96" }, { opacity: 1, translate: "0 0", scale: "1" }], { duration: 160, easing: "cubic-bezier(.2,.9,.3,1.2)" });
    };
    q("tmm-morepop").addEventListener("mousedown", (e) => e.stopPropagation());
    document.addEventListener("mousedown", () => { const pop = q("tmm-morepop"); if (pop) pop.hidden = true; });
    new ResizeObserver(() => fitBar(pane)).observe(pane.querySelector(".tmm-head"));
    q("tmm-menu").addEventListener("mousedown", (e) => e.stopPropagation());
    q("tmm-menu").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (b) ({ compound, uncompound, slideIn, slideOut, pull: pullPicked, lock: lockPicked, close: () => { S.multi = null; S.sel = null; draw(); },
        remove: () => { const ns = new Set(picked()); S.notes = S.notes.filter((n) => !ns.has(n)); S.multi = null; S.sel = null; draw(); commit(); } })[b.dataset.act]();
    });
    for (const id of ["tmm-chips", "tmm-pick"]) q(id).addEventListener("mousedown", (e) => e.stopPropagation());
    q("tmm-chips").addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) openPick(+b.dataset.i, b); });
    q("tmm-pick").addEventListener("click", (e) => { const b = e.target.closest("button[data-p]"); if (b) pickSource(+b.dataset.p); });
    document.addEventListener("mousedown", () => { const pk = q("tmm-pick"); if (pk) pk.hidden = true; });
    const cv = q("tmm-canvas");
    cv.addEventListener("mousedown", onDown);
    // double-click one note: its Slide in / Slide out menu (several picked show it straight away)
    cv.addEventListener("dblclick", (e) => {
      if (!S || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (local(cv, e).x >= KEYS && advWobDbl(e)) return;
      const vh = velHit(e);
      if (vh && !window.KT2_VEL_SNAP_OLD && !window.KT2_VEL_V1) {   // double-click the dot: back to 100% (the picked notes too, if it's one of them)
        const set = S.multi && S.multi.has(vh) ? picked() : [vh];
        if (set.some((m) => (m.velocity || 100) !== 100)) { for (const m of set) m.velocity = 100; draw(); commit(); heard = null; hear(vh.pitch, 100); setTimeout(hush, 260); }
        return;
      }
      if (vh) return;   // two quick drags on the velocity dot are not a double-click on the note
      if (local(cv, e).x >= KEYS && advPitchDbl(e)) return;
      const h = hit(e);
      if (STRIP > 0 && local(cv, e).y < rulerHitY() && h.x >= KEYS) {   // the ruler: loop this bar
        // double-click the yellow loop that's already there: it goes away (Eman, 7 Nov V4m)
        if (performance.now() - (S.loopClearedAt || 0) < 600) return;
        if (S.loopOn && S.loopPx && h.x >= S.loopPx[0] - 2 && h.x <= S.loopPx[1] + 2) { loopOff(); return; }
        const c = findClip(S.clipId), spb = secPerBeat(), bar = Math.floor(Math.max(0, h.beat) / 4) * 4;
        if (c) loopRange(c.start + bar * spb, c.start + Math.min(bar + 4, (c.beats || 16)) * spb);
        return;
      }
      if (!h.note) return;
      if (mouseMode() === "classic") { S.multi = new Set(groupOf(h.note) || [h.note]); S.sel = null; draw(); return; }
      // ...not the note this double-click's first click just wrote on empty grid (bug check, 7 Nov). TMM_DBL_EMPTY_OLD = old.
      if (!window.TMM_DBL_EMPTY_OLD && S.made && S.made.note === h.note && performance.now() - S.made.at < 700) return;
      // KILLTOY: double-click a note opens its menu (Slide in / Slide out / Pull up / Lock); it never deletes it.
      // Delete: pick it and press Delete, or right-click it (Eman, 8 Nov). KT2_MIDI_DBLCLICK_DELETE = old (7 Nov: takes it away)
      if (!window.KT2_MIDI_DBLCLICK_DELETE) { if (!(S.multi && S.multi.has(h.note))) S.multi = new Set(groupOf(h.note) || [h.note]); S.sel = null; draw(); return; }
      S.notes.splice(S.notes.indexOf(h.note), 1); S.sel = null; if (S.multi) S.multi.delete(h.note); draw(); commit();
    });
    cv.addEventListener("mousemove", (e) => {
      if (!S || S.drag || S.advDrag || S.velDrag) return;
      const h = hit(e), kh = h.x < KEYS && h.pitch != null ? h.pitch : null;
      if (h.x >= KEYS && local(cv, e).y < rulerHitY()) { cv.style.cursor = "default"; if (kh !== S.keyHover) { S.keyHover = kh; draw(); } return; }   // the marker's grab area
      const vh = h.x >= KEYS ? velHit(e) : null;
      if (vh !== (S.velHover || null)) { S.velHover = vh; draw(); }
      if (vh) { cv.style.cursor = "ns-resize"; if (kh !== S.keyHover) { S.keyHover = kh; draw(); } return; }
      if (S.adv && h.x >= KEYS) { const g0 = geom(); const wh = S.tool === "wobble" && wobEnvOn() ? wobHitAt(local(cv, e), g0.rows, g0.ppb, 999) : null; const hp = S.tool === "wobble" && wobEnvOn() ? null : advHandleAt(local(cv, e), g0.rows, g0.ppb); cv.style.cursor = wh ? (wh.kind === "chip" ? "pointer" : wh.kind === "pt" ? "grab" : "ns-resize") : hp ? "grab" : S.tool === "pitch" ? "crosshair" : S.tool === "wobble" ? "ns-resize" : h.note ? (h.nearEnd ? RESIZE_CUR : e.altKey ? "copy" : "move") : "crosshair"; if (kh !== S.keyHover) { S.keyHover = kh; draw(); } return; }
      cv.style.cursor = h.x < KEYS ? (h.x > KEYS - 28 && h.pitch != null ? "pointer" : "default") : h.note ? (h.nearEnd ? RESIZE_CUR : e.altKey ? "copy" : "move") : "crosshair";
      if (kh !== S.keyHover) { S.keyHover = kh; draw(); }
    });
    cv.addEventListener("mouseleave", () => { if (S && (S.keyHover != null || S.velHover)) { S.keyHover = null; S.velHover = null; draw(); } });
    // Right-click on a Mac trackpad (two-finger click, Ctrl-click) normally arrives as a right-button press and is
    // handled in onDown; if a browser only sends the contextmenu event, it does the same right-click here (Eman, 8 Nov)
    cv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!S || window.KT2_MIDI_RC_OLD || performance.now() - (S.rcAt || 0) < 400) return;
      onDown(asRight(e));
    });
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (!e.ctrlKey && !e.metaKey && advWobWheel(e)) return;
      if (e.ctrlKey || e.metaKey) {   // pinch on a trackpad (Eman, 4 Nov 23:25)
        const { beats, ppb } = geom(), z0 = S.zx || 1, f = Math.exp(-e.deltaY * 0.01);
        if (e.altKey) { S.rowH = Math.max(12, Math.min(36, (S.rowH || ROW || 22) * f)); fitRows(true); draw(); return zmState(); }
        const z1 = Math.max(1, Math.min(8, z0 * f)), mx = local(cv, e).x, at = (S.sx || 0) + (mx - KEYS) / ppb;
        S.zx = z1; S.sx = Math.max(0, Math.min(beats - beats / z1, at - (mx - KEYS) / (ppb * z1 / z0)));
        draw(); return zmState();
      }
      if ((S.zx || 1) > 1 && (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) {   // zoomed in: sideways scrolls the time
        const { beats, ppb } = geom(), d = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) / ppb;
        S.sx = Math.max(0, Math.min(beats - beats / S.zx, (S.sx || 0) + d));
        return draw();
      }
      const rows = rowPitches(S.sc, true);
      // a trackpad sends many small scrolls: they add up, one row per 30 px like a mouse notch (debug sprint,
      // 8 Nov: every tiny trackpad scroll jumped a whole row, so two fingers flew through the keys).
      // KT2_WHEEL_ROW_OLD = old (a row per event).
      if (!window.KT2_WHEEL_ROW_OLD) {
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
        if (Math.sign(dy) !== Math.sign(S.wAcc || 0)) S.wAcc = 0;
        S.wAcc = (S.wAcc || 0) + dy;
        const n = Math.trunc(S.wAcc / 30);
        if (!n) return;
        S.wAcc -= n * 30;
        S.top = Math.max(0, Math.min(topMax(rows), S.top + n));
        return draw();
      }
      S.top = Math.max(0, Math.min(topMax(rows), S.top + (e.deltaY > 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(e.deltaY) / 30))));
      draw();
    }, { passive: false });
    new ResizeObserver(() => { dockFit(pane); if (!S || S.drag) return; const was = S; if (use(pane)) draw(); if (was && was !== S && STATES.get(was.pane) === was) use(was.pane); }).observe(cv);
  }

  // SLIM BAR (Eman, 15 Nov 17:16: "make some other buttons smaller ... SAVE MIDI we can move to the top row next to the undo
  // buttons ... VERSIONS can just be the icon ... the ADVANCED button can just have this icon"): ADVANCED = a spiral icon,
  // VERSIONS = its icon only, SAVE MIDI = an icon by undo / redo (ui/kt2-midi.js), so the DICE rhythm row fits in the bar.
  // KT2_TBAR_ICONS_OLD = the words as before
  function icoOn() { return !window.KT2_TBAR_ICONS_OLD; }
  const SPIRAL_SVG = '<svg class="tmm-spiral" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M11.6 12.4l1.5-1.3 1.4 1.6-1.2 2.4-3 .1-1.6-2.6 1.1-3.4 3.4-1.4 3.6 1.2 1.8 3.4-.9 4-3.4 2.6-4.4-.2-3.3-3-.8-4.5 2-4.2 4.2-2.2 4.4.4 3.1 2.4" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="miter" stroke-linecap="square"/><path d="M19.6 6.2l1.6-.9" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="square"/></svg>';
  const MINI = { minor: "MIN", dorian: "DOR", phrygian: "PHR", harmonic: "HARM", major: "MAJ", lydian: "LYD", mixolydian: "MIX", locrian: "LOC",
    melodic: "MEL MIN", phrygdom: "PHR DOM", hungarian: "HUN", double: "DBL HARM", chords: "CHRD", melody: "MEL", bass: "BASS", arp: "ARP" };
  function miniLabels(pane, on) {
    for (const o of pane.querySelectorAll("#tmm-scale option, #tmm-dmode option")) {
      if (on && !o.dataset.full) { o.dataset.full = o.textContent; o.textContent = MINI[o.value] || o.textContent; }
      else if (!on && o.dataset.full) { o.textContent = o.dataset.full; delete o.dataset.full; }
    }
  }
  function fitBar(pane) {
    // TOOLBAR LOOK 2 (Eman, 16 Nov 02:30, ui/kt2.css): flat dark square controls like the rhythm chip, taller bar, vertical
    // octave. KT2_TBAR2_OLD = the rounded outlined controls as before
    document.documentElement.classList.toggle("kt2-tbar2-old", !!window.KT2_TBAR2_OLD);
    const q = (id) => pane.querySelector("#" + id), bar = pane.querySelector(".tmm-bar"), pop = q("tmm-morepop"), mg = q("tmm-moregrp");
    if (!bar || !pop || !mg) return;
    const w = bar.clientWidth, key = w + "|" + q("tmm-voices").hidden + "|" + q("tmm-voices").childElementCount + "|" + (window.KT2_BAR_ESAVE_OLD ? "" : pane.querySelectorAll(".k2-esave").length + "|" + (q("tmm-pg") ? q("tmm-pg").childElementCount : 0));   // SAVE MIDI arrives later (ui/kt2-midi.js): its width counts (Eman 15 Nov: ALL / SAVE MIDI overlapped)
    if (w && key === bar._fitKey) return;
    bar._fitKey = key;
    for (const g of [...pop.children]) bar.append(g);
    [...bar.children].sort((a, b) => a.dataset.ord - b.dataset.ord).forEach((g) => bar.append(g));
    bar.classList.remove("tmm-narrow", "tmm-tight", "tmm-mini", "tmm-wrap"); mg.hidden = true; pop.hidden = true; miniLabels(pane, false);
    if (!w || pane.classList.contains("k2t-tmidi")) return;
    const over = () => bar.scrollWidth > bar.clientWidth + 1;
    if (!over()) return;
    bar.classList.add("tmm-narrow"); mg.hidden = false;
    for (const cls of ["tmm-ghost", "tmm-oct", "tmm-lg", "tmm-end", "tmm-zm", "tmm-mouse"]) { if (!over()) break; const g = bar.querySelector(":scope > ." + cls); if (g) pop.append(g); }
    if (!pop.children.length) mg.hidden = true;
    if (over()) bar.classList.add("tmm-tight");   // last resort: the speed's name goes (the knob stays)
    // still too wide (SPLIT view, Eman 8 Nov): short names (MIN, MAJ, CHRD...) and tighter, smaller controls,
    // so the dice and everything after it stay visible. window.KT2_BAR_MINI_OLD = old (cut at the divider).
    if (over() && !window.KT2_BAR_MINI_OLD) { bar.classList.add("tmm-mini"); miniLabels(pane, true); if (over()) bar.classList.add("tmm-wrap"); }   // very narrow: a second row, never cut
    bar.scrollLeft = 0;
  }

  // In the footer the rows get as small as needed for the notes (at least an octave) to fit its height (Eman, 31 Oct)
  function fitRows(force) {
    const cv = S.pane.querySelector("#tmm-canvas"), H = cv ? cv.clientHeight : 0;
    if (!force && H === S.fitH) return;
    S.fitH = H;
    if (!S.pane.closest(".k2t-tmidi") || !H) { ROW = S.row = S.rowH || 22; return; }
    const ps = (S.notes || []).map((n) => n.pitch);
    const span = Math.max(13, ps.length ? Math.max(...ps) - Math.min(...ps) + 4 : 13);
    ROW = S.row = S.rowH || Math.max(9, Math.min(22, Math.floor((H - STRIP - FOOT) / span)));
  }
  // SCROLL END (Eman, 26 Nov: "when scrolling down it becomes this grey, make it stop before that"): the view stops with
  // the last row at the bottom edge, never past it. KT2_TMM_SCROLLEND_OLD = it could scroll until 8 rows were left
  function topMax(rows) {
    if (window.KT2_TMM_SCROLLEND_OLD) return rows.length - 8;
    const cv = S && S.pane && S.pane.querySelector("#tmm-canvas"), hh = cv ? cv.clientHeight : 0;
    const v = hh && ROW > 0 ? Math.floor((hh - STRIP - FOOT) / ROW) : 8;
    return Math.max(0, rows.length - Math.max(1, v));
  }
  function centreOn(notes) {
    fitRows(true);
    const rows = rowPitches(S.sc, true), ps = notes.map((n) => n.pitch);
    const mid = ps.length ? (Math.min(...ps) + Math.max(...ps)) / 2 : 60 + S.sc.tonic;
    const i = rows.findIndex((p) => p <= mid);
    const cv = S.pane.querySelector("#tmm-canvas"), vis = Math.max(8, Math.floor((cv.clientHeight - STRIP - FOOT) / ROW));
    S.top = Math.max(0, i - Math.floor(vis / 2));
    if (!window.KT2_TMM_TOP_OLD) { if (!Number.isFinite(S.top)) S.top = 0; S.top = Math.min(S.top, Math.max(0, topMax(rows))); }
  }

  // Mount into the lane window's MIDI pane for this lane's clip (again on every state change).
  function show(pane, trackId, clipId) {
    const q0 = (id) => pane.querySelector("#" + id);
    if (!STATES.has(pane) || !pane.querySelector("#tmm-canvas")) { build(pane); STATES.set(pane, { pane, grid: 0.25, all: false, lastLen: 1, pending: 0, row: 22, ...loadGhost() }); }
    use(pane);
    const fresh = S.trackId !== trackId || S.clipId !== clipId;
    S.trackId = trackId; S.clipId = clipId;
    if (fresh) S.viewBy = {};   // VIEW PER SYNTH: a pattern opened again lands on the notes
    if (fresh) { S.sc = laneScale(trackId); S.all = !!S.sc.free; S.sel = null; S.multi = null; q0("tmm-all").classList.toggle("on", !S.all); }
    const c = clipId && findClip(clipId);
    const q = (id) => pane.querySelector("#" + id);
    q("tmm-canvas").hidden = !c; q("tmm-empty").hidden = !!c;
    for (const id of ["tmm-bars", "tmm-grid", "tmm-dice", "tmm-dmode", "tmm-play", "tmm-clear", "tmm-octup", "tmm-octdn", "tmm-prompt", "tmm-darrow"]) if (q(id)) q(id).disabled = !c;
    // the row follows the clip. Never let it stop the view from opening: on v265 the open cards asked for the clip's notes
    // before they were loaded, the error ended show() here, and the dice (and the notes) never came (Eman, 9 Nov 00:46)
    // Note input (Eman, 9 Nov 00:47: "you can't put notes in the midi"): the row now mounts after the clip's notes are
    // loaded, so nothing it does can leave the roll without notes. KT2_DICE_MOUNT_EARLY = the old order
    const mountRow = () => { if (c && window.TmDice && !window.KT2_DICE_ROW_OLD && TmDice.isOpen()) { try { TmDice.mount(pane); } catch (e) { console.warn("dice row", e); } } };
    if (window.KT2_DICE_MOUNT_EARLY) mountRow();
    voicesBar(pane, trackId, c);
    // a write that never answered (4 s) doesn't keep the view from taking the song's notes (KT2_PENDING_OLD = waits for good)
    if (S.pending && !window.KT2_PENDING_OLD && Date.now() - (S.pendingAt || 0) > 4000) S.pending = 0;
    // UNDO WHILE A WRITE IS ON ITS WAY (test 15 Nov: ROLL three times fast after changing CHORDS/BASS, then Undo: the clip went
    // back but the roll kept showing the last roll, so the next edit would have written the undone notes again). The skipped
    // update is remembered and taken as soon as the write answers (commit). KT2_PENDING_RESYNC_OFF = as before
    if (c && !S.drag && S.pending && !window.KT2_PENDING_RESYNC_OFF) S.missedSync = true;
    if (c && !S.drag && !S.pending) {
      S.missedSync = false;
      // Fresh copies of the notes: pick the same ones again.
      const key = (n) => n.pitch + "@" + n.start + "/" + n.length;
      const want = new Set(picked().map(key)), one = S.sel && key(S.sel);
      S.notes = voiceNotes(c, S.voice).map((n) => ownExpr({ ...n, _op: n.pitch }));   // _op: the pitch it came in with (commit's ONLY KEY check)
      S.multi = new Set(S.notes.filter((n) => want.has(key(n))));
      S.sel = one ? S.notes.find((n) => key(n) === one) || null : null;
    }
    if (!c) S.notes = [];
    if (!window.KT2_DICE_MOUNT_EARLY) mountRow();
    loadEnv(trackId, c, fresh);
    q("tmm-tonic").value = String(S.sc.tonic); q("tmm-scale").value = S.sc.scale;
    { const sel = q("tmm-ghostsel"), others = ghostLanes(), sig = others.map((t) => t.id + ":" + t.name).join("|");
      if (sel.dataset.sig !== sig) { sel.dataset.sig = sig; sel.innerHTML = `<option value="all">ALL</option>` + others.map((t) => `<option value="${t.id}">${String(t.name).replace(/[<&]/g, "")}</option>`).join(""); }
      if (S.ghostSel !== "all" && !others.some((t) => t.id === S.ghostSel)) S.ghostSel = "all";
      sel.value = S.ghostSel; q("tmm-ghost").checked = !!S.ghost; }
    q("tmm-sub").textContent = c ? `bar ${fmtBars(c.start)}` : "";
    const bars = String(Math.max(1, Math.round(((c && c.beats) || 16) / 4)));
    if ([...q("tmm-bars").options].some((o) => o.value === bars)) q("tmm-bars").value = bars;
    fitBar(pane);
    advShow(pane);
    vShow(pane);
    if (fresh) { const st = S; requestAnimationFrame(() => { const was = S; if (use(st.pane)) { centreOn(st.notes || []); draw(); } if (was && was !== st) use(was.pane); }); }
    draw();
  }

  // Stacked synths (Eman, 1 Nov): the main sound plus every synth whose thread is cut has its own
  // notes and colour; threaded synths share the main notes (and its colour).
  // "*" = ALL (Eman, 4 Nov): every sound's notes together, each in its colour, all of them editable
  function voiceNotes(c, id) {
    if (!c) return [];
    if (id === "*") return (c.notes || []).concat(...(S.voices || []).filter((v) => v.id).map((v) => ((c.stack && c.stack[v.id]) || []).map((n) => ({ ...n, _v: v.id }))));
    return id ? (c.stack && c.stack[id]) || [] : c.notes || [];
  }
  const vcolOf = (id) => ((S.voices || []).find((v) => v.id === id) || {}).color;
  function voicesBar(pane, trackId, c) {
    const box = pane.querySelector("#tmm-voices"), tr = (ui.state && ui.state.tracks) || [];
    const cut = tr.filter((t) => t.layerOf === trackId && t.linked === false);
    const main = tr.find((t) => t.id === trackId);
    const all = tr.filter((t) => t.layerOf === trackId);   // numbered like the window's SOUND tabs
    // every synth on the pattern gets its number (Eman, 6 Nov 15:00: 3 VSTs showed only 1 and 3);
    // a linked one plays the pattern's notes: picking it cuts its link (its notes start as a copy) and
    // shows them. Parked (Eman, 6 Nov 15:01: linked ones are fine as they are): TMM_VOICES_ALL = true turns it on
    const listed = window.TMM_VOICES_ALL ? all : cut;
    // the main button names every synth linked to it, 1-2 with a link between (Eman, 6 Nov 15:01);
    // TMM_VOICE_PLAIN = just "1" as before
    const joined = window.TMM_VOICES_ALL || window.TMM_VOICE_PLAIN ? [] : all.filter((t) => t.linked !== false).map((t) => all.indexOf(t) + 2);
    const showBar = listed.length || joined.length;
    S.voices = showBar ? [{ id: null, n: 1, joined, color: COLOR, name: (main && main.name) || "Main" }, ...listed.map((t) => ({ id: t.linked === false ? t.id : null, lane: t.id, linked: t.linked !== false, n: all.indexOf(t) + 2, color: colorOf(t), name: t.name }))] : [];
    if (S.voice === "*" ? !S.voices.length : !S.voices.some((v) => v.id === (S.voice || null))) S.voice = null;
    S.vcol = S.voice && S.voice !== "*" ? (S.voices.find((v) => v.id === S.voice) || {}).color : null;
    if (!box) return;
    // SYNTH BAR IN MIDI (Eman, 26 Nov: "add the synth bar on the midi page ... make this replace the 1 2 3 button"): in the
    // lane window the synth cards row (ui/app.js laneLayerRow) picks whose notes you write, so the numbers hide there.
    // KT2_MIDI_LAYERS_OFF = the 1 2 3 buttons as before
    box.hidden = !S.voices.length || (!window.KT2_MIDI_LAYERS_OFF && !!pane.closest("#iw"));
    const sig = S.voices.map((v) => v.id + v.color + (v.linked ? "L" : "") + (v.joined || []).join(",")).join("|") + "@" + S.voice;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.replaceChildren(...S.voices.map((v, i) => {
      const b = document.createElement("button");
      b.className = "tmm-voice" + (!v.linked && (S.voice === "*" || (v.id || null) === (S.voice || null)) ? " on" : "") + (v.linked ? " linked" : "");
      b.style.setProperty("--c", v.color);
      if (v.joined && v.joined.length) {
        b.classList.add("joined");
        // the link between them is the same glowing thread as between the INST cards (Eman, 6 Nov 15:03);
        // TMM_VLINK_BAR = the plain bar
        let link = '<i class="tmm-vlink"></i>';
        if (!window.TMM_VLINK_BAR && window.KT2InstLive && KT2InstLive.thread) link = '<span class="k2th on tmm-vthread">' + KT2InstLive.thread(true, 30, 20).innerHTML + "</span>";
        b.innerHTML = [v.n, ...v.joined].map((x) => "<span>" + x + "</span>").join(link);
      } else b.textContent = String(v.n);
      b.title = v.joined && v.joined.length ? "SOUNDS " + [v.n, ...v.joined].join(" + ") + " are linked: they all play these notes" : v.linked ? "SOUND " + v.n + " (" + v.name + ") plays these notes. Click to give it its own notes" : "Write SOUND " + v.n + "'s notes (" + v.name + ")";
      b.onclick = () => {
        const tell = (id) => { if (window.KT2LanePickVoice && pane.closest("#iw")) window.KT2LanePickVoice(id); };   // VST / SPLIT follow (Eman, 9 Nov)
        if (!v.linked) { setVoice(v.id); return tell(v.id); }
        run("setLayerLinked", { trackId: v.lane, linked: false }).then(async () => {
          try { const f = await booth("getState", {}); if (f && f.tracks) ui.state = f; } catch (e) { /* fine */ }
          setVoice(v.lane); tell(v.lane);
          if (typeof refreshLaneWindow === "function") refreshLaneWindow();
        });
      };
      return b;
    }));
  }
  function setVoice(id) {
    if (!S) return;
    // VIEW PER SYNTH (Eman, 26 Nov: "if I skip back and forth between the bass and arp, it will come back to where I exactly
    // was"): each synth keeps where the view was while this pattern is open; the first visit lands on its notes.
    // Opening the pattern again starts over (on the notes). KT2_TMM_VIEWMEM_OFF = the view stays where it is
    const vm = !window.KT2_TMM_VIEWMEM_OFF, k0 = S.voice || "main", k1 = id || "main", moved = k0 !== k1;
    if (vm && moved) { S.viewBy = S.viewBy || {}; S.viewBy[k0] = { top: S.top, sx: S.sx, zx: S.zx }; }
    S.voice = id || null; S.sel = null; S.multi = null;
    const c = S.clipId && findClip(S.clipId);
    voicesBar(S.pane, S.trackId, c);
    S.notes = voiceNotes(c, S.voice).map((n) => ownExpr({ ...n, _op: n.pitch }));
    if (vm && moved) { const v = S.viewBy[k1]; if (v && Number.isFinite(v.top)) { S.top = v.top; S.sx = v.sx; S.zx = v.zx; } else if (S.notes.length) centreOn(S.notes); }
    draw();
    if (!window.TMM_BASS_MAIN_ONLY) loadEnv(S.trackId, c, true);   // the picked sound's own BASS check and envelope
  }

  // The lane's TOY MACHINE amp envelope (seconds), so every note can be drawn as its sound.
  function loadEnv(trackId, c, fresh) {
    // the sound being written: a cut layer (VST 2, 3...) has its own synth, so its envelope and its BASS check
    // come from that synth (Zed call, 7 Nov 04:40: a bass on layer 2 still offered CHORDS). TMM_BASS_MAIN_ONLY = old (always the main synth).
    const lay = !window.TMM_BASS_MAIN_ONLY && S.voice && S.voice !== "*" && ui.state && ui.state.tracks.find((x) => x.id === S.voice);
    const t = lay || (ui.state && ui.state.tracks.find((x) => x.id === trackId));
    const p = t && window.ToyMachineUI && [...((!lay && c && c.plugins) || []), ...(t.plugins || []), ...t.clips.flatMap((k) => k.plugins || [])].find((x) => /toy machine/i.test(x.name || "") || x.instrument);
    if (!p || (!fresh && Date.now() - (S.envAt || 0) < 1500)) return;
    S.envAt = Date.now();
    Promise.resolve(booth("toyMachineGetPreset", { pluginId: p.id })).then((g) => {
      if (!S || !g || !g.preset) return;
      const pr = typeof g.preset === "string" ? JSON.parse(g.preset) : g.preset;
      const isBass = /bass|808|sub\b/i.test([pr && pr.category, pr && pr.name, t && t.name].filter(Boolean).join(" "));
      if (isBass !== !!S.isBass) { S.isBass = isBass; if (S.pane._showDice) S.pane._showDice(); }
      const full = ToyMachineUI.applyMacros(ToyMachineUI.withDefaults(pr));
      const e = full && full.ampEnv;
      if (e && JSON.stringify(e) !== JSON.stringify(S.env)) { S.env = { a: +e.a || 0, d: +e.d || 0, s: e.s == null ? 1 : +e.s, r: +e.r || 0 }; draw(); }
    }).catch(() => {});
  }
  // How loud a note is `t` seconds after it starts (0..1), and its release tail after `len` seconds.
  function envAt(env, t) {
    if (t < env.a) return env.a > 0 ? t / env.a : 1;
    const u = t - env.a;
    return env.d > 0 ? env.s + (1 - env.s) * Math.exp(-4 * u / env.d) : env.s;
  }

  function geom() {
    const cv = S.pane.querySelector("#tmm-canvas"), c = findClip(S.clipId);
    const W = cv.clientWidth, H = cv.clientHeight, beats = Math.max(0.25, (c && c.beats) || 16);
    const zx = S.zx || 1, ppb = ((W - KEYS) / beats) * zx;
    S.sx = Math.max(0, Math.min(beats - beats / zx, S.sx || 0));
    OX = KEYS - S.sx * ppb;
    return { cv, c, W, H, beats, ppb, rows: rowPitches(S.sc, true) };   // every note has a row; out-of-key ones are greyed (and locked unless Out of key is on)
  }
  // MARKER GLUE (shell): where beat 0 sits and how wide a beat is in this MIDI view right now
  window.ktTmmGeom = () => { try { if (!S.pane || !S.pane.isConnected) return null; const g = geom(); return g.cv && g.cv.clientWidth ? { cv: g.cv, ppb: g.ppb, ox: OX } : null; } catch (e) { return null; } };
  // A pitch to its row on screen (out-of-scale notes sit on the scale row just under them).
  function rowOf(rows, p) {
    let i = rows.indexOf(p);
    if (i < 0) i = rows.findIndex((x) => x < p);
    return i < 0 ? -1 : i - S.top;
  }

  // between the transport's updates the marker keeps moving at the song's pace (drawn only, never stored)
  let seen = null;
  function posNow() {
    const t = ui.transport, now = performance.now();
    if (!t || !t.playing) { seen = null; return t ? t.position : 0; }
    if (!seen || seen.pos !== t.position) seen = { pos: t.position, at: now };
    return t.position + Math.min(0.1, (now - seen.at) / 1000);
  }
  // ---- Reference (ghost notes from the other lanes)
  function loadGhost() { try { const v = JSON.parse(localStorage.getItem("killtoy.midiGhost") || "null"); return v ? { ghost: !!v.on, ghostSel: "all" } : { ghost: false, ghostSel: "all" }; } catch (e) { return { ghost: false, ghostSel: "all" }; } }
  function saveGhost() { try { localStorage.setItem("killtoy.midiGhost", JSON.stringify({ on: !!S.ghost })); } catch (e) {} }
  function ghostLanes() {
    const st = ui.state;
    return st ? st.tracks.filter((t) => t.id !== S.trackId && t.kind === "inst" && t.clips.some((c) => c.kind === "midi" && (c.notes || []).length)) : [];
  }
  function laneInk(t) {
    let col = (typeof colorOf === "function" ? colorOf(t) : t.color) || "#a78bfa";
    const m = /^var\((--[\w-]+)\)$/.exec(col); if (m) col = cssVar(m[1]) || "#a78bfa";
    return col;
  }
  // A note from another instrument: see-through in its own colour with an outline (V2m "Blue ghost").
  function ghostNote(g, X, Y, W, H, col) {
    // Ghost notes sit exactly inside their own start..end, like the real notes (which end 1 px short of their
    // end): no outline poking past the end, no minimum width, no pill caps. A note's end looks the same with
    // or without a note next to it (Eman, 8 Nov). KT2_GHOST_PAD_OLD = old (pill, inset, 4 px minimum).
    if (!window.KT2_GHOST_PAD_OLD) {
      const w = W - 1, bh = Math.min(H - 1, H - 2), y = Y + H / 2 - bh / 2, lw = 1.2;
      if (w <= 0.5 || bh <= 0) return;
      const rad = Math.min(5, bh / 2, w / 2);
      g.save(); g.beginPath(); g.rect(X, y, w, bh); g.clip();
      roundRect(g, X, y, w, bh, rad); g.fillStyle = col; g.globalAlpha = 0.08; g.fill();
      if (w > lw * 2 + 1) { roundRect(g, X + lw / 2, y + lw / 2, w - lw, bh - lw, Math.max(0, rad - lw / 2)); g.strokeStyle = col; g.globalAlpha = 0.38; g.lineWidth = lw; g.stroke(); }
      g.restore();
      return;
    }
    const x = X + 1.5, y = Y + 2, w = W - 3, h = H - 4;
    if (w <= 0 || h <= 0) return;
    g.save(); roundRect(g, x, y, w, h, h / 2);
    g.fillStyle = col; g.globalAlpha = 0.08; g.fill();
    g.strokeStyle = col; g.globalAlpha = 0.38; g.lineWidth = 1.2; g.stroke(); g.restore();   // V2n: half as strong
  }
  function drawGhost(g, c, rows, ppb, vis, beats) {
    if (!S.ghost) return;
    const spb = secPerBeat(), c0 = c.start, c1 = c.start + beats * spb;
    const lanes = ghostLanes().filter((t) => S.ghostSel === "all" ? !/drum/i.test(t.instrument || t.name || "") : t.id === S.ghostSel);
    g.save();
    for (const t of lanes) {
      const ink = laneInk(t);
      for (const k of t.clips) {
        if (k.kind !== "midi" || k.start >= c1 || k.start + k.length <= c0) continue;
        for (const n of k.notes || []) {
          const a = k.start + n.start * spb, e = Math.min(k.start + k.length, a + n.length * spb);
          if (e <= c0 || a >= c1 || a >= k.start + k.length) continue;
          const b0 = Math.max(0, (a - c0) / spb), b1 = Math.min(beats, (e - c0) / spb), r = rowOf(rows, n.pitch);
          if (r < 0 || r >= vis) continue;
          ghostNote(g, OX + b0 * ppb, STRIP + r * ROW, window.KT2_GHOST_PAD_OLD ? Math.max(4, (b1 - b0) * ppb) : (b1 - b0) * ppb, ROW, ink);
        }
      }
    }
    g.restore();
  }

  // ---- note juice (Eman, 4 Nov): notes pop in, lean the way they're moved, squash when let go.
  // Look only; the synth plays the notes, so no UI sound here.
  const FXDUR = { pop: 300, step: 140, drop: 220 };
  function fxNote(n, k, extra) { if (!S) return; if (!S.fx) S.fx = new Map(); S.fx.set(n, { t: performance.now() + ((extra && extra.delay) || 0), k, ...(extra || {}) }); fxLoop(); }
  function popNotes(ns, stagger) { const many = ns.length > 1; ns.forEach((n, i) => fxNote(n, "pop", { delay: stagger && many ? Math.min(600, i * Math.max(8, 260 / ns.length)) : 0 })); }
  function fxLoop() {
    const st = S;
    if (!st || st.fxRaf) return;
    const tick = () => {
      st.fxRaf = 0;
      if (!st.fx || !st.fx.size || !st.pane.isConnected) return;
      const now = performance.now();
      for (const [n, f] of st.fx) if (now - f.t > FXDUR[f.k]) st.fx.delete(n);
      const was = S; use(st.pane); draw(); if (was && was !== st) use(was.pane);
      if (st.fx.size) st.fxRaf = requestAnimationFrame(tick);
    };
    st.fxRaf = requestAnimationFrame(tick);
  }
  // the note's shape right now: null = not shown yet, false = plain
  function noteFx(n) {
    const f = S.fx && S.fx.get(n);
    if (!f) return false;
    const age = performance.now() - f.t;
    if (age < 0) return f.k === "pop" ? null : false;
    const k = Math.min(1, age / FXDUR[f.k]), e = 1 - k;
    if (f.k === "pop") {
      const sc = k < 0.45 ? 0.35 + 0.85 * (k / 0.45) : 1.2 - 0.2 * ((k - 0.45) / 0.55);
      return { sx: sc, sy: k < 0.45 ? sc * 1.15 : 2 - sc, a: Math.min(1, k * 3), ring: k > 0.3 ? e : 0 };
    }
    if (f.k === "step") return { sx: 1 + 0.16 * e * Math.abs(f.dx || 0), sy: 1 - 0.1 * e * Math.abs(f.dx || 0) + 0.22 * e * Math.abs(f.dy || 0), a: 1, ring: 0 };
    const b = Math.sin(k * Math.PI) * e;   // drop: a squash and a little bounce
    return { sx: 1 + 0.14 * b, sy: 1 - 0.28 * b, a: 1, ring: 0 };
  }

  // OCTAVE ON THE PATTERN (Eman, 16 Nov 02:29: the octave arrows "dont seem to be connected to the pattern in use"; make
  // them vertical: up arrow, a number, down arrow): the arrows move every note AND the dice keeps that octave, so the
  // next roll on this pattern lands where the arrows put it (it used to jump back). The number is the octave the
  // pattern sits in (its middle note: C4 = 4). Remembered per pattern. KT2_OCT_DICE_OFF = rolls ignore the arrows, no number
  const octDiceOn = () => !window.KT2_OCT_DICE_OFF;
  const OCTK = "kt2.diceOct";
  const octMap = () => { try { return JSON.parse(localStorage.getItem(OCTK) || "{}") || {}; } catch (e) { return {}; } };
  function octOf(clipId) { const v = octMap()[clipId]; return typeof v === "number" && isFinite(v) ? v : 0; }
  function octSet(clipId, v) { try { const m = octMap(); if (v) m[clipId] = Math.max(-4, Math.min(4, v)); else delete m[clipId]; localStorage.setItem(OCTK, JSON.stringify(m)); } catch (e) {} }
  // the rolled notes moved by the pattern's octave (locked notes stay); never past the lowest / highest note
  function octRoll(ns) {
    const off = octDiceOn() && S && S.clipId ? octOf(S.clipId) : 0; if (!off || !ns || !ns.length) return ns;
    const mv = ns.filter((n) => !n.locked && !n._v); if (!mv.length) return ns;
    let sh = off * 12; const lo = Math.min(...mv.map((n) => n.pitch)), hi = Math.max(...mv.map((n) => n.pitch));
    while (sh > 0 && hi + sh > HIGH) sh -= 12; while (sh < 0 && lo + sh < LOW) sh += 12;
    return sh ? ns.map((n) => (!n.locked && !n._v ? { ...n, pitch: n.pitch + sh } : n)) : ns;
  }
  function octShow() {
    const el = S && S.pane && S.pane.querySelector("#tmm-octn"); if (!el) return;
    const ps = (S.notes || []).filter((n) => !n.muted).map((n) => n.pitch).sort((a, b) => a - b);
    const t = ps.length ? String(Math.floor(ps[ps.length >> 1] / 12) - 1) : String(4 + (S.clipId ? octOf(S.clipId) : 0));
    if (el.textContent !== t) el.textContent = t;
  }
  function draw() {
    if (!S || !S.clipId) return;
    if (octDiceOn()) octShow();
    advReset();
    followSongKey();
    if (!S.drag) { STRIP = stripFor(S.pane); FOOT = footFor(S.pane); }
    const { cv, c, W, H, beats, ppb, rows } = geom();
    if (!W || !H || !c) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#161618"; g.fillRect(0, 0, W, H);   // V2m look (Eman, 4 Nov 22:59, "Blue ghost"): its own dark ground
    g.font = "10px " + cssVar("--font");
    const ink3 = cssVar("--ink-3"), line = cssVar("--line"), line2 = cssVar("--line-2");
    const was = ROW;
    fitRows();
    if (ROW !== was && S.notes) { centreOn(S.notes); }
    // the view's top row can be unset (a pane drawn before its first centring, or a second pane opened by SPLIT)
    // or past the last row: then nothing at all was drawn, not even the keys (Eman, 8 Nov 23:44). KT2_TMM_TOP_OLD = no guard
    if (!window.KT2_TMM_TOP_OLD) {
      if (!Number.isFinite(ROW) || ROW <= 0) ROW = S.row = 22;
      if (!Number.isFinite(S.top) || S.top < 0 || S.top > topMax(rows)) centreOn(S.notes || []);
      if (!Number.isFinite(S.top)) S.top = 0;
      S.top = Math.max(0, Math.min(topMax(rows), S.top));
    }
    const vis = Math.ceil((H - STRIP - FOOT) / ROW);

    // Rows (V2n, Eman 4 Nov 23:22): open rows in the key are the plain ground with a thin line under
    // each; other open rows are a black lane; locked rows a black lane with a faint hatch inside.
    // Keys are chips: white in the key, acid for the root, grey for open notes outside the key, black
    // when locked (with a lock). Black piano keys used to get a black left half (TMM_BLACK_HALF). Tap the lock end to flip it.
    const F = cssVar("--font"), lanes = [];
    for (let i = 0; i < vis; i++) {
      const p = rows[S.top + i], y = STRIP + i * ROW;
      if (p == null) break;
      const tonic = pc(p - S.sc.tonic) === 0, inK = inScale(S.sc, p), opn = rowOpen(p);
      const lx = KEYS + 2, lw = W - KEYS - 4, ly = y + Math.min(1.5, ROW * 0.08), lh = ROW - Math.min(3, ROW * 0.16), lr = Math.min(6, lh / 2);
      lanes.push([ly, lh]);
      if (!opn || !inK) { roundRect(g, lx, ly, lw, lh, lr); g.fillStyle = "#0a0a0b"; g.fill(); }
      if (!opn) {
        g.save(); roundRect(g, lx, ly, lw, lh, lr); g.clip();
        g.strokeStyle = "rgba(255,255,255,0.035)"; g.lineWidth = 1; g.beginPath();
        for (let hx = lx - lh; hx < lx + lw; hx += 7) { g.moveTo(hx, ly + lh); g.lineTo(hx + lh, ly); }
        g.stroke(); g.restore();
      }
      g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(KEYS, y + ROW - 0.5, W - KEYS, 1);
      // the key chip
      const kr = Math.min(3.5, (ROW - 3) / 2), kw = KEYS - 9, half = isBlackKey(p) && opn && !!window.TMM_BLACK_HALF;   // Eman, 6 Nov 23:26: no black half on black keys, every key full white (TMM_BLACK_HALF = old)
      roundRect(g, 3, y + 1.5, kw, ROW - 3, kr);
      g.fillStyle = !opn ? "#000000" : tonic ? "#E4FF3A" : inK ? "#ececf1" : "#4a4a52"; g.fill();
      if (half) { roundRect(g, 3, y + 1.5, kw / 2, ROW - 3, kr); g.fillStyle = "#0b0b0c"; g.fill(); g.fillRect(3 + kw / 2 - kr, y + 1.5, kr, ROW - 3); }
      if (S.held && S.held.has(p)) { roundRect(g, 3, y + 1.5, kw, ROW - 3, kr); g.fillStyle = "#8b6cff"; g.fill(); }   // played from the computer keyboard
      if (ROW >= 9 || pc(p) === 0) {
        g.save(); g.font = `700 ${Math.min(6.5, ROW * 0.44)}px ${F}`; g.textBaseline = "middle";
        g.fillStyle = !opn ? "#3a3a40" : half ? "#ffffff" : tonic || inK ? "#16161a" : "#e8e8ee";
        g.fillText(keyNames()[pc(p)] + (Math.floor(p / 12) - 1), 8, y + ROW / 2 + 1);
        const lk = (open1) => {   // a small lock at the key's right end; open when flipped open
          const cx = KEYS - 14, cy = y + ROW / 2 + 1, sz = Math.min(ROW * 0.5, 8);
          g.fillStyle = g.strokeStyle; g.fillRect(cx - sz * 0.35, cy - sz * 0.12, sz * 0.7, sz * 0.5);
          g.lineWidth = Math.max(1, sz * 0.16); g.beginPath(); g.arc(cx + (open1 ? sz * 0.32 : 0), cy - sz * 0.15, sz * 0.25, Math.PI, 0); g.stroke();
        };
        const flipped = (S.sc.flip || []).includes(p);
        if (!opn && ROW >= 10) { g.strokeStyle = "#3a3a40"; lk(false); }
        else if (opn && flipped && ROW >= 10) { g.strokeStyle = inK ? "#16161a" : "rgba(255,255,255,0.85)"; lk(true); }
        else if (tonic && ROW >= 11) { g.font = `800 ${Math.min(5.8, ROW * 0.4)}px ${F}`; g.fillStyle = "#16161a"; const tw = g.measureText("ROOT").width; g.fillText("ROOT", KEYS - 9 - tw - 3, y + ROW / 2 + 1); }
        else if (S.keyHover === p && ROW >= 10) { g.strokeStyle = inK ? "rgba(22,22,26,0.45)" : "rgba(255,255,255,0.45)"; lk(false); }   // hover: tap to lock
        g.restore();
      }
    }
    g.save(); g.beginPath(); g.rect(KEYS, 0, W - KEYS, H); g.clip();   // zoomed in: nothing slides under the keys
    // V2n: the other instruments' notes first, faint, so the grid lines sit over them (Eman, 4 Nov 23:22)
    drawGhost(g, c, rows, ppb, vis, beats);
    for (const v of S.voices || []) {
      if (v.linked || v.id === S.voice || S.voice === "*") continue;
      for (const n of voiceNotes(c, v.id)) {
        const r = rowOf(rows, n.pitch);
        if (r < 0 || r >= vis) continue;
        ghostNote(g, OX + n.start * ppb, STRIP + r * ROW, window.KT2_GHOST_PAD_OLD ? Math.max(4, n.length * ppb) : n.length * ppb, ROW, window.TMM_LAYER_GHOST_COLOR ? v.color : "#8a8a96");   // grey (Zed call, 7 Nov); TMM_LAYER_GHOST_COLOR = their colour
      }
    }
    // Grid: beat lines, bars a bit stronger, only inside the rows.
    for (let b = 0; b <= beats + 1e-6; b += S.grid) {
      const x = OX + b * ppb, isBar = Math.abs(b / 4 - Math.round(b / 4)) < 1e-6, isBeat = Math.abs(b - Math.round(b)) < 1e-6;
      if (!isBeat) continue;   // V2m: beat lines only, bars a bit stronger
      g.fillStyle = isBar ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.065)";
      for (const [ly, lh] of lanes) g.fillRect(Math.round(x) - 0.5, ly, 1, lh);
    }
    // The ruler on top: bar numbers, the song's loop in yellow, the marker (drawn after the notes)
    if (STRIP > 0) {
      g.fillStyle = "#1b1b1e"; g.fillRect(KEYS, 0, W - KEYS, STRIP - 2);
      const spbR = secPerBeat(), st = ui.state || {}, pt = soloMode() ? soloPart() : null;
      const lo = S.loopDrag ? (S.loopDrag.lo - c.start) / spbR : pt ? pt.from / spbR : (st.loopStart - c.start) / spbR;
      const hi = S.loopDrag ? (S.loopDrag.hi - c.start) / spbR : pt ? pt.to / spbR : (st.loopEnd - c.start) / spbR;
      const showLoop = !!S.loopDrag || (soloMode() ? !!pt : !!(ui.transport && ui.transport.looping));
      S.loopOn = showLoop;
      if (showLoop && hi > lo && hi > 0 && lo < beats) {
        const x0 = Math.max(KEYS, OX + lo * ppb), x1 = Math.min(W, OX + hi * ppb);
        // V2n: one acid bar in the ruler, like the playground's loop bar; the roll itself stays as it is (Eman, 4 Nov 23:26)
        g.save(); g.shadowColor = "rgba(228,255,58,0.45)"; g.shadowBlur = 10; g.fillStyle = ACID; roundRect(g, x0, 5, x1 - x0, 14, 4); g.fill(); g.restore();   // the playground's loop bar: 14 px, round 4, glow
        S.loopPx = [x0, x1];
      }
      if (!S.loopOn) S.loopPx = null;
      const lp = S.loopOn ? S.loopPx : null;
      for (let b = 0; b < beats / 4; b++) { const x = OX + b * 4 * ppb; if (x < KEYS - 1) continue; const onBar = lp && x + 5 >= lp[0] && x + 12 <= lp[1]; g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(Math.round(x), 2, 1, STRIP - 7); g.fillStyle = onBar ? "#141218" : "#5e5e66"; g.fillText(String(b + 1), x + 5, 15); }
    }
    // Compounds: a block around the notes glued together.
    const spb = secPerBeat(), env = S.env || { a: 0.003, d: 0.1, s: 1, r: 0.08 };
    for (const [id, ns] of groups()) {
      const b = boxOf(ns, rows, ppb, vis);
      if (!b) continue;
      const on = ns.some((n) => S.multi && S.multi.has(n));
      g.fillStyle = on ? "rgba(228,255,58,0.07)" : "rgba(255,255,255,0.04)";
      roundRect(g, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 8); g.fill();
      g.strokeStyle = on ? "rgba(228,255,58,0.8)" : "rgba(255,255,255,0.35)"; g.lineWidth = 1.5; g.stroke();
      g.save(); g.font = "700 9px " + cssVar("--font"); g.fillStyle = on ? ACID : "rgba(255,255,255,0.55)";
      g.fillText("COMPOUND", b.x - 2, Math.max(STRIP + 9, b.y - 7)); g.restore();
    }
    // The other sounds on this pattern (cut threads): their notes in their colour, behind; pick a
    // colour in the toolbar to write those (Eman, 1 Nov)
    // Notes, each drawn as its sound: a faint box for its length, the envelope filled in, and the
    // release tail fading out after it ends.
    // While it plays, the note under the marker lights up bright, swells smoothly and its edge buzzes
    // with a tiny spiky shake like a plucked string (Eman, 31 Oct: "like Guitar Hero", small, not yellow)
    const playingNow = !!(ui.transport && ui.transport.playing), nowPos = posNow(), pb = (nowPos - c.start) / spb;
    for (const n of S.notes) {
      const r = rowOf(rows, n.pitch);
      if (r < 0 || r >= vis) continue;
      const live = playingNow && pb >= n.start && pb < n.start + n.length, age = live ? (pb - n.start) * spb : 9;
      const swell = live ? 1 + 0.18 * (1 - Math.exp(-age * 12)) : 1, tNow = performance.now() / 1000;
      const amp = live ? 0.3 + 0.5 * Math.exp(-age * 6) : 0, fr = Math.floor(tNow * 40);
      const vib = (px) => amp * (Math.sin(px * 1.3 - tNow * 90) * 0.6 + Math.sin(px * 2.7 + tNow * 61) * 0.4 + (((Math.sin(px * 12.9898 + fr * 78.233) * 43758.5453) % 1 + 1) % 1 - 0.5) * 0.8) * Math.min(1, px / 4, (w - px) / 4 + 0.2);
      const x = OX + n.start * ppb, w = Math.max(3, n.length * ppb - 1), y = STRIP + r * ROW, mid = y + ROW / 2, hh = (ROW / 2 - 2) * swell;
      const off = !rowOpen(n.pitch), grey = !inScale(S.sc, n.pitch) || off, picked1 = S.sel === n || (S.multi && S.multi.has(n));
      // out of key: a greyed-out red, dull and see-through so the row's strike shows (Eman, 1 Nov)
      let col = S.drag && S.drag.note === n ? "#fff" : grey ? (live ? "#9a9aa4" : "#5a5a63") : live ? (n.slide ? "#f6ffb8" : "#ece4ff") : n.slide ? ACID : (n._v ? vcolOf(n._v) : S.vcol) || COLOR, vel = 0.55 + 0.45 * (n.velocity || 100) / 127;
      // a picked note lights up: its own colour, most of the way to white, so a pick is plain to see (Eman, 8 Nov).
      // TMM_PICK_DIM = old (same fill, white outline only)
      const lit = picked1 && !grey && !live && !(S.drag && S.drag.note === n) && !window.TMM_PICK_DIM, col0 = col;
      if (lit) col = toWhite(col, 0.62);
      const fxk = noteFx(n);
      if (fxk === null) continue;   // still waiting for its turn to pop in
      // Inside its own row a note draws only between its start and its end, so the note next to it never
      // gets a lighter edge from it (Eman, 8 Nov). Above and below its row it can still glow. KT2_GHOST_PAD_OLD = old
      const fit = !window.KT2_GHOST_PAD_OLD;
      if (fit) { g.save(); g.beginPath(); g.rect(x, y, n.length * ppb, ROW); g.rect(0, 0, W, y); g.rect(0, y + ROW, W, H); g.clip(); }
      if (fxk) { g.save(); const cx = x + w / 2, cy = y + ROW / 2; g.translate(cx, cy); g.scale(fxk.sx, fxk.sy); g.translate(-cx, -cy); g.globalAlpha = fxk.a; }
      if (live) {   // a glow behind it, brightest on the hit
        g.save(); g.globalAlpha = 0.35 + 0.5 * Math.exp(-age * 6); g.shadowColor = n.slide ? ACID : "#b89cff"; g.shadowBlur = 24;
        g.fillStyle = col; roundRect(g, x - 1, y + 1, w + 2, ROW - 2, 5); g.fill(); g.restore();
      }
      let shp = null;   // the note's own outline, so the white "picked" line follows it exactly
      if (!window.TMM_ENV_NOTES) {   // V2m: a rounded bubble with a little shine; it swells while it plays
        // every note has the shape a playing note's glow has: a fuller box with small round corners
        // (Eman, 6 Nov 02:50); TMM_PILL_NOTES = true brings back the round pills
        const pill = !!window.TMM_PILL_NOTES, bh = pill ? Math.min(ROW - 4, (ROW - 4) * swell) : Math.min(ROW - 1, (ROW - 2) * swell), by = mid - bh / 2, bx = pill ? x + 1.5 : x, bw = pill ? Math.max(3, w - 3) : Math.max(3, w), rad = pill ? bh / 2 : Math.min(5, bh / 2);
        shp = { bx, by, bw, bh, rad };
        g.globalAlpha = off ? 0.55 : 1;
        roundRect(g, bx, by, bw, bh, rad); g.fillStyle = col; if (!off && live) { g.shadowColor = col; g.shadowBlur = 8; } g.fill(); g.shadowBlur = 0;
        if (bw > bh) {
          // on a picked (near-white) note the dot and the line inside it are the note's own purple, so they
          // still show (Eman, 8 Nov). KT2_PICK_SHINE_WHITE = old (white, washed out on the white note)
          // A playing note is white too: its dot and line are purple the same way (Eman, 8 Nov 03:20). KT2_VEL_V1 = old
          const v2 = !window.KT2_VEL_V1, ink = (lit || (v2 && live && !grey)) && !window.KT2_PICK_SHINE_WHITE;
          const inkCol = lit ? col0 : n.slide ? ACID : (n._v ? vcolOf(n._v) : S.vcol) || COLOR;
          if (v2 && velShow()) velDraw(g, n, bx, by, bw, bh, rad, off);   // the velocity look under the dot and line, so they stay on top
          g.save(); if (ink) g.globalAlpha *= 0.9;
          g.fillStyle = ink ? inkCol : "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(bx + bh * 0.55, by + bh * 0.35, bh * 0.18, bh * 0.12, 0, 0, 7); g.fill();
          if (ink) g.globalAlpha *= 0.75 / 0.9;
          // round 3 (Eman, 8 Nov 03:24): the line inside the note is its velocity: full length at 100%, shorter as it
          // goes down (the note itself stays fully coloured). KT2_VEL_V2 = round 2 (fill level, red-free grit)
          const v3 = v2 && !window.KT2_VEL_V2 && velShow(), lineK = v3 ? Math.max(0.04, Math.min(1, velPct(n))) : 1;
          // round 4 (Eman, 9 Nov): past 100% the line itself heats up, orange-red turning to full red at its tip,
          // redder the louder (no grain). KT2_VEL_V3 = round 3 (purple grain + glow)
          const hotK = v3 && !window.KT2_VEL_V3 ? Math.max(0, Math.min(1, (velPct(n) - 1) / 0.5)) : 0;
          if (bw - bh * 1.6 > 2) {
            const lx = bx + bh * 0.9, lw = Math.max(bh * 0.18, (bw - bh * 1.6) * lineK);
            let fs = ink ? inkCol : v3 ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.18)";
            // smooth (Eman, 10 Nov): the red creeps in from the tip. r = how far toward 200% (full red), so 101%
            // is a faint warm tip, 150% about half the line, 200% all of it. KT2_VEL_RED_FAST = the 9 Nov ramp
            const smooth = !window.KT2_VEL_RED_FAST, r = smooth ? Math.max(0, Math.min(1, velPct(n) - 1)) : hotK;
            if (!smooth && hotK > 0) { const gr = g.createLinearGradient(lx, 0, lx + lw, 0); gr.addColorStop(0, fs); gr.addColorStop(Math.max(0.05, 1 - 0.25 - 0.6 * hotK), "#ff6a2a"); gr.addColorStop(1, "#ff1e2e"); fs = gr; g.globalAlpha = Math.max(g.globalAlpha, 0.85 + 0.15 * hotK); }
            g.fillStyle = fs; roundRect(g, lx, by + bh * 0.22, lw, bh * (0.18 + 0.06 * r), bh * 0.09); g.fill();
            if (smooth && r > 0) {
              const reach = Math.min(1, r + 0.04), x0r = lx + lw * (1 - reach), a = Math.min(1, 0.25 + 1.5 * r);
              const gr = g.createLinearGradient(x0r, 0, lx + lw, 0);
              gr.addColorStop(0, "rgba(255,106,42,0)"); gr.addColorStop(Math.min(0.85, 0.35 + 0.5 * (1 - r)), `rgba(255,106,42,${(0.8 * a).toFixed(3)})`); gr.addColorStop(1, `rgba(255,30,46,${a.toFixed(3)})`);
              g.save(); g.globalAlpha = 1; g.fillStyle = gr; roundRect(g, lx, by + bh * 0.22, lw, bh * (0.18 + 0.06 * r), bh * 0.09); g.fill(); g.restore();
            }
          }
          g.restore();
        }
        if (velShow() && (window.KT2_VEL_V1 || !(bw > bh))) velDraw(g, n, bx, by, bw, bh, rad, off);   // velocity: how full the note is, and its dot
        if (amp > 0.05) { g.strokeStyle = "rgba(255,255,255," + (0.5 * amp).toFixed(3) + ")"; g.lineWidth = 1; roundRect(g, bx + vib(bw / 2) * 0.4, by, bw, bh, rad); g.stroke(); }   // the plucked-string buzz
        g.globalAlpha = 1;
      } else {
      g.globalAlpha = 0.22; g.fillStyle = col; roundRect(g, x, y + 2, w, ROW - 4, 4); g.fill();
      const lenS = n.length * spb, endLvl = envAt(env, lenS) * vel, tailPx = Math.min(W - x - w, (env.r / spb) * ppb);
      g.globalAlpha = off ? 0.55 : 1;
      g.beginPath(); g.moveTo(x, mid);
      for (let px = 0; px <= w; px += 2) g.lineTo(x + px, mid - Math.max(0.12, envAt(env, (px / ppb) * spb) * vel) * hh + vib(px));
      for (let px = Math.floor(w / 2) * 2; px >= 0; px -= 2) g.lineTo(x + px, mid + Math.max(0.12, envAt(env, (px / ppb) * spb) * vel) * hh + vib(px));
      g.closePath(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = off ? 0 : 8; g.fill(); g.shadowBlur = 0;
      if (tailPx > 2 && endLvl > 0.02) { // the release: from where the note ends down to silence
        const grad = g.createLinearGradient(x + w, 0, x + w + tailPx, 0);
        grad.addColorStop(0, col); grad.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.55; g.fillStyle = grad;
        g.beginPath(); g.moveTo(x + w, mid - endLvl * hh);
        for (let px = 0; px <= tailPx; px += 2) g.lineTo(x + w + px, mid - endLvl * Math.exp(-4 * px / tailPx) * hh);
        for (let px = Math.floor(tailPx / 2) * 2; px >= 0; px -= 2) g.lineTo(x + w + px, mid + endLvl * Math.exp(-4 * px / tailPx) * hh);
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      }
      if (window.TMM_ENV_NOTES) { g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(x + w - 3, y + 5, 2, ROW - 10); }
      if (n.locked) {   // locked: a fine grid over it and a little lock, the dice keeps it (Eman, 4 Nov)
        g.save(); roundRect(g, x, y + 2, w, ROW - 4, 4); g.clip();
        g.strokeStyle = "rgba(10,10,14,0.7)"; g.lineWidth = 1; g.beginPath();
        for (let gx = x + 3; gx < x + w; gx += 4) { g.moveTo(gx + 0.5, y + 2); g.lineTo(gx + 0.5, y + ROW - 2); }
        for (let gy = y + 4; gy < y + ROW - 2; gy += 4) { g.moveTo(x, gy + 0.5); g.lineTo(x + w, gy + 0.5); }
        g.stroke(); g.restore();
        g.strokeStyle = "#e4ff3a"; g.lineWidth = 1; roundRect(g, x + 0.5, y + 2.5, w - 1, ROW - 5, 4); g.stroke();
        if (w > 16 && ROW >= 14) { const lx = x + 4, ly = y + ROW / 2 - 4; g.fillStyle = "#141218"; g.fillRect(lx - 1, ly - 3, 9, 12); g.fillStyle = "#e4ff3a"; g.fillRect(lx, ly + 2, 7, 5); g.strokeStyle = "#e4ff3a"; g.lineWidth = 1.2; g.beginPath(); g.arc(lx + 3.5, ly + 2, 2.4, Math.PI, 0); g.stroke(); }
      }
      if (picked1) {
        g.save(); g.globalAlpha = 1; g.strokeStyle = "#fff"; g.lineWidth = 1.5;
        // the same shape as the note (Eman, 6 Nov 19:12: it kept the old round pill); TMM_PICK_PILL = old
        if (shp && !window.TMM_PICK_PILL) roundRect(g, shp.bx + 0.75, shp.by + 0.75, Math.max(2, shp.bw - 1.5), Math.max(2, shp.bh - 1.5), Math.max(0, shp.rad - 0.75));
        else roundRect(g, x + 1.5, y + 2, Math.max(3, w - 3), ROW - 4, window.TMM_ENV_NOTES ? 4 : (ROW - 4) / 2);
        g.stroke(); g.restore();
      }
      if (fxk) {
        g.restore();
        if (fxk.ring > 0) { g.save(); g.globalAlpha = fxk.ring * 0.8; g.strokeStyle = S.vcol || "#b89cff"; g.lineWidth = 1.5; const e = (1 - fxk.ring) * 7; roundRect(g, x - e, y + 2 - e, w + e * 2, ROW - 4 + e * 2, 5); g.stroke(); g.restore(); }
      }
      if (fit) g.restore();
    }
    // Notes on top of each other on one row: the overlap gets the playground's red outline (a thin
    // red line round it and a faint red hatch, like a clip lying over another clip), so you see how
    // much is covered (Eman, 8 Nov). KT2_MIDI_OVERLAP_OLD = no outline.
    if (!window.KT2_MIDI_OVERLAP_OLD) for (const { n, a, b } of overlapsOf(S.notes)) {
      const r = rowOf(rows, n.pitch);
      if (r < 0 || r >= vis) continue;
      const x0 = OX + a * ppb, x1 = OX + b * ppb, y = STRIP + r * ROW + 0.5, h = ROW - 1;
      if (x1 - x0 < 1) continue;
      g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, h); g.clip();
      g.strokeStyle = "rgba(255,64,64,0.16)"; g.lineWidth = 2; g.beginPath();
      for (let k = x0 - h; k < x1; k += 7) { g.moveTo(k, y + h); g.lineTo(k + h, y); }
      g.stroke();
      g.strokeStyle = "rgba(255,70,70,0.9)"; g.lineWidth = 1.5; g.strokeRect(x0 + 0.75, y + 0.75, x1 - x0 - 1.5, h - 1.5);
      g.restore();
    }
    // A note that runs on under another note on its row still shows where it ends (Zed call, 7 Nov):
    // a notch on top of whatever covers it. TMM_NO_END_MARK = off.
    if (!window.TMM_NO_END_MARK) for (const n of S.notes) {
      const r = rowOf(rows, n.pitch);
      if (r < 0 || r >= vis) continue;
      const e1 = n.start + n.length;
      if (!S.notes.some((m) => m !== n && m.pitch === n.pitch && m.start < e1 - 1e-6 && m.start + m.length > e1 + 1e-6)) continue;
      const x = OX + e1 * ppb - 1, y = STRIP + r * ROW;
      g.fillStyle = "rgba(10,10,12,0.9)"; g.fillRect(x - 2.5, y + 2, 5, ROW - 4);
      g.fillStyle = "#fff"; g.fillRect(x - 0.75, y + 3, 1.5, ROW - 6);
    }
    // Slides: a curve from the note it glides from to the slide note, over their overlap.
    // In ADVANCED they receded (dissolved, Eman 7 Nov), so Slide in / Slide out / Pull up seemed to do
    // nothing there. Eman 10 Nov: they must show, so they draw at full strength in ADVANCED too.
    // KT2_ADV_SLIDE_DIM = old (dissolved to 22%).
    const dis = S.adv && window.KT2_ADV_SLIDE_DIM ? 0.22 : 1;
    g.globalAlpha = dis;
    const drawn = [];
    for (const sl of slidePlan(S.notes)) {
      const r0 = rowOf(rows, sl.from.pitch), r1 = rowOf(rows, sl.note.pitch);
      if (r0 < 0 || r1 < 0 || (r0 >= vis && r1 >= vis)) continue;
      const x0 = OX + sl.note.start * ppb, x1 = x0 + Math.max(sl.beats * ppb, 4), y0 = STRIP + r0 * ROW + ROW / 2, y1 = STRIP + r1 * ROW + ROW / 2;
      if (!isFinite(x0 + x1 + y0 + y1)) continue;   // not laid out yet
      const purple = S.vcol || COLOR;
      // the note it leaves fades off over the glide: it darkens toward its end, with a yellow notch
      // where the glide starts and a thin line along it that warms up to yellow (Eman, 4 Nov)
      if (r0 >= 0 && r0 < vis) {
        const yt = STRIP + r0 * ROW + 2, hh = ROW - 4, fade = g.createLinearGradient(x0, 0, x1, 0);
        fade.addColorStop(0, "rgba(16,14,20,0)"); fade.addColorStop(1, "rgba(16,14,20,0.78)");
        g.fillStyle = fade; g.fillRect(x0, yt, x1 - x0, hh);
        const edge = g.createLinearGradient(x0, 0, x1, 0);
        edge.addColorStop(0, purple); edge.addColorStop(1, ACID);
        g.fillStyle = edge; g.globalAlpha = 0.85 * dis; g.fillRect(x0, yt + hh - 2, x1 - x0, 2); g.globalAlpha = dis;
        g.fillStyle = ACID; g.fillRect(Math.round(x0) - 1, yt, 2, hh);
      }
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, purple); grad.addColorStop(1, ACID);
      g.strokeStyle = grad; g.lineWidth = 2.5; g.globalAlpha = 0.95 * dis; g.lineCap = "round";
      g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1); g.stroke();
      g.globalAlpha = dis; g.lineCap = "butt";
      sl.mx = (x0 + x1) / 2; sl.my = (y0 + y1) / 2; sl.vis = true;
      drawn.push(sl);
    }
    // Pull up: each chord note bends up into the long note on a curve (slow first). The long note
    // is dimmed where it's quiet and lit where the bends land in it.
    for (const t of S.notes) {
      if (!t.pull) continue;
      const rt = rowOf(rows, t.pitch), plan = pullPlan(t, S.notes), purple = S.vcol || COLOR;
      if (rt >= 0 && rt < vis) {
        const yt = STRIP + rt * ROW + 2, hh = ROW - 4, xa = OX + t.start * ppb, xb = OX + (t.start + t.length) * ppb;
        const lit = [...plan].sort((a, b) => a.bs - b.bs).reduce((m, p) => { const l = m[m.length - 1]; if (l && p.bs < l[1]) l[1] = Math.max(l[1], p.be); else m.push([p.bs, p.be]); return m; }, []);
        let cur = xa;
        g.fillStyle = "rgba(16,14,20,0.62)";
        for (const [a, b] of lit) { const x0 = OX + a * ppb; if (x0 > cur) g.fillRect(cur, yt, x0 - cur, hh); cur = OX + b * ppb; }
        if (xb > cur) g.fillRect(cur, yt, xb - cur, hh);
        g.fillStyle = ACID;
        for (const [a, b] of lit) g.fillRect(OX + a * ppb, yt + hh - 2, (b - a) * ppb, 2);
      }
      for (const { q, bs, be } of plan) {
        const r0 = rowOf(rows, q.pitch);
        if (r0 < 0 || rt < 0 || (r0 >= vis && rt >= vis)) continue;
        const x0 = OX + bs * ppb, x1 = OX + be * ppb, y0 = STRIP + r0 * ROW + ROW / 2, y1 = STRIP + rt * ROW + ROW / 2;
        if (!isFinite(x0 + x1 + y0 + y1)) continue;
        const grad = g.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, purple); grad.addColorStop(1, ACID);
        g.strokeStyle = grad; g.lineWidth = 2.5; g.globalAlpha = 0.95 * dis; g.lineCap = "round";
        g.beginPath(); g.moveTo(x0, y0);
        for (let k = 1; k <= 16; k++) { const u = k / 16; g.lineTo(x0 + (x1 - x0) * u, y0 + (y1 - y0) * Math.pow(u, PULL_CURVE)); }
        g.stroke(); g.globalAlpha = dis; g.lineCap = "butt";
        if (r0 < vis) { g.fillStyle = ACID; g.fillRect(Math.round(x0) - 1, STRIP + r0 * ROW + 2, 2, ROW - 4); }
      }
    }
    g.globalAlpha = 1;
    advDraw(g, c, rows, ppb, vis, beats, spb, playingNow, pb);
    // with the WOBBLE tool on, the velocity dot hides (it sat on the wave's middle dot, Eman 8 Nov 04:05). KT2_WOB_VELDOT_KEEP = old
    if (S.adv && velShow() && !velDotHidden()) for (const n of S.notes) {   // velocity dots on top of the lines and waves
      const r = rowOf(rows, n.pitch);
      if (r < 0 || r >= vis) continue;
      const x = OX + n.start * ppb, w = Math.max(3, n.length * ppb - 1), bh = Math.min(ROW - 1, ROW - 2);
      if (x + w < KEYS) continue;
      velDotDraw(g, n, x, STRIP + r * ROW + ROW / 2 - bh / 2, w, bh, !rowOpen(n.pitch));
    }
    // The chord names, in a strip under the notes: each bar's chord, named from the notes in it
    if (FOOT > 0) {
      g.fillStyle = "#161618"; g.fillRect(0, H - FOOT, W, FOOT);
      g.fillStyle = "#1b1b1e"; g.fillRect(KEYS, H - FOOT + 2, W - KEYS, FOOT - 2);
      for (let b = 0; b < beats / 4; b++) {
        const x = OX + b * 4 * ppb;
        if (x + 4 * ppb < KEYS) continue;
        const ps = S.notes.filter((n) => n.start < (b + 1) * 4 - 0.5 && n.start + n.length > b * 4 + 0.5).map((n) => n.pitch);   // a slide's overlap doesn't count
        const name = chordName(ps);
        g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(Math.round(x), H - FOOT + 2, 1, FOOT - 2);
        if (name) { g.save(); g.font = "700 12px " + cssVar("--font"); g.fillStyle = "#ffffff"; g.fillText(name, Math.max(KEYS, x) + 6, H - 6); g.restore(); }
      }
    }
    // Cmd-drag box
    if (S.box) {
      const b = S.box, x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
      g.fillStyle = "rgba(228,255,58,0.08)"; g.fillRect(x, y, w, h);
      g.strokeStyle = "rgba(228,255,58,0.7)"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w, h);
    }
    // Playhead, inside this clip.
    const pos = nowPos - c.start;
    if (pos >= 0 && pos <= c.length) {
      const px = OX + (pos / secPerBeat()) * ppb;
      // the same marker as the song's (Eman, 4 Nov 23:29): a thin grey line with the 4-point star on top,
      // acid and glowing while it plays
      g.save();
      if (playingNow) { g.shadowColor = "rgba(228,255,58,0.55)"; g.shadowBlur = 6; }
      g.fillStyle = playingNow ? ACID : "rgba(220,220,228,0.75)";
      g.fillRect(px - (playingNow ? 1 : 0.5), STRIP > 0 ? 10 : STRIP, playingNow ? 2 : 1, H - (STRIP > 0 ? 10 : STRIP) - FOOT);
      if (STRIP > 0 && px >= KEYS) {
        const sz = 17, k = sz / 20, sx = px - sz / 2, sy = 1;
        g.fillStyle = playingNow ? ACID : "#cfcfd6";
        if (playingNow) { g.shadowColor = "rgba(228,255,58,0.8)"; g.shadowBlur = 4; }
        g.beginPath();
        [[10, 0], [12.2, 7.8], [20, 10], [12.2, 12.2], [10, 20], [7.8, 12.2], [0, 10], [7.8, 7.8]].forEach(([a, b], i) => (i ? g.lineTo : g.moveTo).call(g, sx + a * k, sy + b * k));
        g.closePath(); g.fill();
      }
      g.restore();
    }
    // smooth while playing: redraw every frame (the transport only ticks ~30 times a second)
    if (playingNow && !S.raf) S.raf = requestAnimationFrame(() => { S.raf = 0; if (S && S.pane && S.pane.isConnected && S.pane.offsetParent) { draw(); } });
    g.restore();
    placeMenu(rows, ppb, vis);
    placeChips(drawn);
    // anything laid over the grid from outside (the quest's note boxes) moves in the same frame (Eman, V4x)
    if (typeof window.TMM_AFTER_DRAW === "function") { try { window.TMM_AFTER_DRAW(); } catch (e) { /* not ours */ } }
  }
  // ---- Velocity (Eman, 8 Nov): a small dot at the bottom middle of each note, like the drag dot on
  // the playground's patterns. Drag it up or down: the note fills from the bottom to show how full it
  // is out of 100% (velocity 127), and goes greyer as it empties. Past 100% (up to 150% = velocity
  // 190) the note runs hot: a red band grows down from its top, a red glow and grit come in, and
  // TOY MACHINE drives that note (ToyMachine.h Voice::hot). Only in the MIDI view (ADVANCED draws
  // its wobble inside the notes). The dot hides on notes too small for it: zoom in.
  // KT2_VEL_DOT_OLD = old (no dot, no fill).
  const VEL_MAX = 190;
  // ADVANCED too (Eman works there most, 8 Nov): the wobble's edge dots sit on the wave, not in the note's
  // bottom middle, so they don't meet. Not with the V6c wobble curve (it fills the note body), and a pitch
  // or wobble dot nearer the hand than the velocity dot always wins (velHit). KT2_VEL_ADV_OFF = MIDI view only.
  const velShow = () => !window.KT2_VEL_DOT_OLD && S && (!S.adv || (!window.KT2_VEL_ADV_OFF && (wobDots() || !wobEnvOn())));
  // Round 2 (Eman, 8 Nov 03:20): a note starts FULL. 100% = velocity 100 (the default), and 101..127 (the
  // dice's accents) also show full and play as before; dragging up from full goes straight to the hot
  // range 128..190 = 101..150%, drawn as a gritty, torn texture. KT2_VEL_V1 = first version (100% = 127, red band).
  const velPct = (n) => { const v = n.velocity || 100; return window.KT2_VEL_V1 ? v / 127 : v <= 100 ? v / 100 : v <= 127 ? 1 : 1 + 0.5 * (v - 127) / 63; };
  const velOfPct = (p, v0) => p < 0.995 ? Math.max(1, Math.round(p * 100)) : p <= 1.005 ? (v0 >= 100 && v0 <= 127 ? v0 : 100) : Math.min(VEL_MAX, 128 + Math.round((p - 1.01) / 0.49 * 62));
  const velDotOn = (bw, bh) => bw >= 22 && bh >= 12;
  // the dot's centre and radius for a note box
  const velDotAt = (bx, by, bw, bh) => { const r = Math.max(2.2, Math.min(3.2, bh * 0.15)); return { x: bx + bw / 2, y: by + bh - r - 2, r }; };
  function velDraw(g, n, bx, by, bw, bh, rad, off) {
    const p = velPct(n), fill = Math.min(1, p), hot = Math.max(0, Math.min(1, (p - 1) / ((VEL_MAX - 127) / 127)));
    const dragging = S.velDrag && S.velDrag.has(n);
    g.save();
    roundRect(g, bx, by, bw, bh, rad); g.clip();
    const v3 = !window.KT2_VEL_V1 && !window.KT2_VEL_V2;
    if (v3) {
      // round 3 (Eman, 8 Nov 03:24): no water level and no red. Lower = the same purple, a little deeper
      // (darker) and the inner line shorter; past 100% = grain in the note's own purples, denser the hotter.
      if (fill < 0.999) { g.globalAlpha = 0.42 * (1 - fill); g.fillStyle = "#0e0c12"; g.fillRect(bx, by, bw, bh); }
      if (hot > 0 && window.KT2_VEL_V3) {
        let seed = (Math.round(n.start * 997) * 31 + n.pitch * 17) >>> 0;
        const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        const count = Math.round(bw * bh * (0.06 + 0.16 * hot));
        for (let k = 0; k < count; k++) {
          const q = rnd();
          g.globalAlpha = 0.35 + 0.45 * hot * rnd();
          g.fillStyle = q < 0.4 ? "#2a1460" : q < 0.75 ? "#c9b3ff" : "#5b2fd6";
          g.fillRect(bx + rnd() * bw, by + rnd() * bh, 1, 1);
        }
      }
    } else if (fill < 0.999) {
      // the empty part (above the level) goes dark, and the whole note loses colour as it empties
      const top = by + bh * (1 - fill);
      g.globalAlpha = 1; g.fillStyle = "rgba(14,12,18,0.62)"; g.fillRect(bx, by, bw, top - by);
      g.globalCompositeOperation = "saturation"; g.globalAlpha = Math.min(1, (1 - fill) * 1.1); g.fillStyle = "#808080"; g.fillRect(bx, by, bw, bh);
      g.globalCompositeOperation = "source-over";
      if (bh >= 8) { g.globalAlpha = 0.55; g.fillStyle = "#fff"; g.fillRect(bx, Math.round(top) - 0.5, bw, 1); }   // the level line
    }
    if (hot > 0 && !window.KT2_VEL_V1 && !v3) {
      // over 100%: the note's texture breaks up: grit all over, a few torn lines across it, more the hotter it is
      let seed = (Math.round(n.start * 997) * 31 + n.pitch * 17) >>> 0;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const count = Math.round(bw * bh * 0.05 * (0.25 + hot));
      g.globalAlpha = 0.35 + 0.5 * hot;
      for (let k = 0; k < count; k++) { const q = rnd(); g.fillStyle = q < 0.45 ? "rgba(10,8,12,0.95)" : q < 0.8 ? "rgba(255,255,255,0.85)" : "rgba(255,48,72,0.95)"; g.fillRect(bx + rnd() * bw, by + rnd() * bh, 1 + rnd(), 1 + rnd()); }
      const tears = 1 + Math.round(hot * 4);
      for (let k = 0; k < tears; k++) {
        const ty = by + 2 + rnd() * (bh - 4), tx = bx + rnd() * bw * 0.6, tw = bw * (0.15 + rnd() * 0.4);
        g.globalAlpha = 0.5 + 0.4 * hot; g.fillStyle = k % 2 ? "rgba(10,8,12,0.9)" : "#ff3048"; g.fillRect(tx, ty, tw, 1);
        g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(tx + 2 + rnd() * 3, ty + 1, tw * 0.7, 1);
      }
    } else if (hot > 0 && !v3) {
      // over 100%: a red band from the top, as deep as how far past full it is, and grit over the note
      const band = Math.max(1.5, bh * 0.55 * hot);
      g.globalAlpha = 0.5 + 0.4 * hot; g.fillStyle = "#ff3048"; g.fillRect(bx, by, bw, band);
      g.globalAlpha = 0.25 + 0.5 * hot;
      let seed = (Math.round(n.start * 997) * 31 + n.pitch * 17) >>> 0;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const count = Math.round(bw * bh * 0.03 * (0.3 + hot));
      for (let k = 0; k < count; k++) { g.fillStyle = rnd() < 0.5 ? "rgba(10,8,12,0.9)" : "rgba(255,90,110,0.9)"; g.fillRect(bx + rnd() * bw, by + rnd() * bh, 1.2, 1.2); }
    }
    g.restore();
    if (hot > 0 && !off && v3 && window.KT2_VEL_V3) {   // pushed: a purple glow round it
      g.save(); g.globalAlpha = 0.3 + 0.5 * hot; g.strokeStyle = "#b89cff"; g.lineWidth = 1; g.shadowColor = "#8b5cf6"; g.shadowBlur = 3 + 9 * hot;
      roundRect(g, bx + 0.5, by + 0.5, bw - 1, bh - 1, rad); g.stroke(); g.restore();
    } else if (hot > 0 && !off && !v3) {   // the red heat around it
      g.save(); g.globalAlpha = 0.35 + 0.5 * hot; g.strokeStyle = "#ff3048"; g.lineWidth = 1; g.shadowColor = "#ff3048"; g.shadowBlur = 4 + 8 * hot;
      roundRect(g, bx + 0.5, by + 0.5, bw - 1, bh - 1, rad); g.stroke(); g.restore();
    }
    if (!S.adv) velDotDraw(g, n, bx, by, bw, bh, off);
  }
  // the dot itself (in ADVANCED drawn after the pitch lines and waves, so it stays on top: velDotsTop)
  function velDotDraw(g, n, bx, by, bw, bh, off) {
    if (!velDotOn(bw, bh)) return;
    const p = velPct(n), hot = p > 1, dragging = S.velDrag && S.velDrag.has(n);
    const d = velDotAt(bx, by, bw, bh), big = dragging || S.velHover === n, r = big ? d.r + 1 : d.r;
    g.save(); g.globalAlpha = off ? 0.55 : 1;
    g.fillStyle = "rgba(14,12,18,0.75)"; g.beginPath(); g.arc(d.x, d.y, r + 1.2, 0, 7); g.fill();
    g.fillStyle = hot > 0 && (window.KT2_VEL_V1 || window.KT2_VEL_V2) ? "#ffb3bd" : big ? "#fff" : "#c9c7d1"; g.beginPath(); g.arc(d.x, d.y, r, 0, 7); g.fill();
    if (dragging && S.velDrag.lead === n) {   // the value while you drag
      const t = Math.round(p * 100) + "%";
      g.font = "600 10px ui-monospace, Menlo, monospace"; const tw = g.measureText(t).width + 8, ty = by - 15 < STRIP ? by + bh + 3 : by - 15;
      g.fillStyle = "rgba(14,12,18,0.92)"; g.fillRect(d.x - tw / 2, ty, tw, 13);
      g.fillStyle = hot > 0 ? (window.KT2_VEL_V1 || window.KT2_VEL_V2 ? "#ff6a7c" : window.KT2_VEL_V3 ? "#c9b3ff" : "#ff5a3a") : "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, d.x, ty + 7);
    }
    g.restore();
  }
  // the note whose velocity dot is under the mouse (the box drawn for it), or null
  const velDotHidden = () => !window.KT2_WOB_VELDOT_KEEP && wobFocus();
  function velHit(e) {
    if (!velShow() || velDotHidden()) return null;
    const { cv, ppb, rows } = geom(), m = local(cv, e);
    for (const n of [...S.notes].reverse()) {
      const r = rowOf(rows, n.pitch);
      if (r < 0) continue;
      const x = OX + n.start * ppb, w = Math.max(3, n.length * ppb - 1), y = STRIP + r * ROW;
      const bh = Math.min(ROW - 1, ROW - 2), by = y + ROW / 2 - bh / 2;
      if (!velDotOn(w, bh)) continue;
      const d = velDotAt(x, by, w, bh);
      // sprint 8 Nov: the hit box reached up to the note's middle (by 0.5 px at 22 px rows, more in the
      // footer), so a press dead in the centre of a note grabbed velocity instead of moving the note.
      // Now it starts below the middle. KT2_VEL_HIT_OLD = old box.
      const yTop = window.KT2_VEL_HIT_OLD ? d.y - d.r - 2.5 : Math.max(d.y - d.r - 2.5, by + bh * 0.6);
      if (Math.abs(m.x - d.x) <= d.r + 3 && m.y >= yTop && m.y <= d.y + d.r + 2.5) return S.adv && advNearer(m, rows, ppb, Math.hypot(m.x - d.x, m.y - d.y)) ? null : n;
    }
    return null;
  }
  // ADVANCED: is a pitch line point (or its bend handle) or a wobble dot closer to the hand than dv?
  function advNearer(m, rows, ppb, dv) {
    for (const n of S.notes) {
      const x0 = OX + n.start * ppb;
      for (const p of advPts(n)) if (Math.hypot(x0 + p[0] * ppb - m.x, yOfPitch(rows, n.pitch + p[1]) - m.y) < Math.max(dv, 3)) return true;
      if (wobDots() && n.wob && n.wob.d > 0) for (const p of wobDotList(n, rows, ppb)) if (Math.hypot(p.x - m.x, p.y - m.y) < Math.max(dv, 3)) return true;
    }
    const hp = advHandleAt(m, rows, ppb);
    return !!(hp && hp.kind === "curve");
  }
  // drag the dot: up = fuller (1% a pixel, Shift = fine); picked notes all move by the same amount
  function velDown(e, n) {
    const { cv } = geom(), y0 = local(cv, e).y;
    const set = S.multi && S.multi.has(n) ? picked() : [n];
    const was = new Map(set.map((m) => [m, m.velocity || 100]));
    const dragSet = new Set(set); dragSet.lead = n; S.velDrag = dragSet;
    if (!(S.multi && S.multi.has(n))) S.sel = n;
    let acc = 0, lastY = y0, moved = false;
    const move = (ev) => {
      const y = local(cv, ev).y; acc += (lastY - y) * (ev.shiftKey ? 0.25 : 1); lastY = y;
      if (Math.abs(acc) >= 1) moved = true;
      if (window.KT2_VEL_V1) { const d = Math.round(acc); for (const [m, v] of was) m.velocity = Math.max(1, Math.min(VEL_MAX, v + d)); }
      // a little snap at 100% (Eman, 9 Nov): within 4% of full it sits on full; Shift (fine) doesn't snap.
      // KT2_VEL_SNAP_OLD = no snap, no double-click reset
      else for (const [m, v] of was) { let q = velPct({ velocity: v }) + Math.round(acc) / 100; if (!window.KT2_VEL_SNAP_OLD && !ev.shiftKey && Math.abs(q - 1) < 0.04) q = 1; m.velocity = velOfPct(q, v); }
      queueDraw();
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      S.velDrag = null; draw();
      if (!moved || [...was].every(([m, v]) => m.velocity === v)) return;
      commit();
      heard = null; hear(n.pitch, n.velocity); setTimeout(hush, 260);   // hear it at its new strength
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    draw();
  }
  function roundRect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // The notes' box on screen (null when none of them show).
  function boxOf(ns, rows, ppb, vis) {
    const rs = ns.map((n) => rowOf(rows, n.pitch)).filter((r) => r >= 0 && r < vis);
    if (!rs.length) return null;
    const x = OX + Math.min(...ns.map((n) => n.start)) * ppb, x1 = OX + Math.max(...ns.map((n) => n.start + n.length)) * ppb;
    return { x, y: STRIP + Math.min(...rs) * ROW, w: x1 - x, h: (Math.max(...rs) - Math.min(...rs) + 1) * ROW };
  }
  // Compounds: notes sharing a `group` id.
  function groups() {
    const m = new Map();
    for (const n of S.notes) if (n.group) { if (!m.has(n.group)) m.set(n.group, []); m.get(n.group).push(n); }
    return m;
  }
  const groupOf = (n) => (n && n.group ? S.notes.filter((x) => x.group === n.group) : null);
  // the notes tied to this one: its compound, and the notes it slides from or that slide from it (its pair)
  function linkedOf(n) {
    const out = new Set(groupOf(n) || [n]);
    for (const sl of slidePlan(S.notes)) { if (sl.note === n) out.add(sl.from); else if (sl.from === n) out.add(sl.note); }
    return [...out];
  }

  // ---- the menu over the selection: Compound, Slide in, Slide out ----------------------
  function placeMenu(rows, ppb, vis) {
    const m = S.pane.querySelector("#tmm-menu"), ns = S.multi && S.multi.size ? picked() : [];
    const b = !S.drag && !S.box && ns.length && !(S.adv && tabs3On()) ? boxOf(ns, rows, ppb, vis) : null;   // ADVANCED: no note menu (three tabs)
    if (!b) { m.hidden = true; return; }
    const ids = new Set(ns.map((n) => n.group)), whole = ids.size === 1 && !ids.has(undefined) && groupOf(ns[0]).length === ns.length;
    const sIn = slideInPlan(ns), sOut = slideOutPlan(ns);
    const html = (whole ? `<button data-act="uncompound" title="Unglue: the notes move on their own again">Uncompound</button>`
      : ns.length < 2 ? "" : `<button data-act="compound" title="Glue these notes into one block that moves and stretches as one">Compound</button>`)
      + `<button data-act="slideIn" class="${sIn.on ? "on" : ""}" title="Glide into these notes from the notes just before them${sIn.on ? ". Tab: try the other ways (which note goes to which)" : ""}">Slide in${sIn.on ? " \u2713" + cycLabel("in", sIn.heads) : ""}</button>`
      + `<button data-act="slideOut" class="${sOut.on ? "on" : ""}" title="Glide from these notes into the notes right after them${sOut.on ? ". Tab: try the other ways (which note goes to which)" : ""}">Slide out${sOut.on ? " \u2713" + (sIn.on ? "" : cycLabel("out", sOut.next)) : ""}</button>`
      + (pullTarget(ns) ? (() => { const t = pullTarget(ns); return `<button data-act="pull" class="${t.pull ? "on" : ""}" title="${t.pull ? "Pull up: the chords under this note bend up into it. Click: a longer or shorter bend, then off" : "Pull up: every chord under this long note plays, then bends up into it on a curve"}">Pull up${t.pull ? " \u2713<span class=\"tmm-cyc\">" + PULL_NAMES[pullIdx(t.pullAt)] + "</span>" : ""}</button>`; })() : "")
      + (() => { const on = ns.every((n) => n.locked); return `<button data-act="lock" class="lk${on ? " on" : ""}" title="${on ? "Locked: the dice keeps these notes. Click to unlock" : "Lock: the dice keeps these notes and builds the rest around them"}"><svg viewBox="0 0 16 16" width="13" height="13" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><rect x="3" y="7" width="10" height="7"/><path fill="none" d="${on ? "M5 7V5a3 3 0 0 1 6 0v2" : "M5 7V4.5a3 3 0 0 1 5.6-1.5"}"/></svg><span>${on ? "LOCKED" : "LOCK"}</span></button>`; })()
      + (mouseMode() === "classic" ? `<button data-act="remove" title="Take these notes away (Delete)">Remove</button>` : "")
      + `<button data-act="close" class="x" title="Deselect (Esc)">\u00D7</button>`;
    // compare with what was written last, not innerHTML (the browser writes it back differently, so it
    // was rebuilt every frame and a click on Slide in / Slide out landed on a button already gone)
    if (m._html !== html) { m.innerHTML = html; m._html = html; }
    m.hidden = false;
    const cv = S.pane.querySelector("#tmm-canvas"), mw = m.offsetWidth || 260;
    m.style.left = Math.max(KEYS, Math.min(cv.clientWidth - mw - 4, b.x + b.w / 2 - mw / 2)) + "px";
    m.style.top = (b.y - 4 - 34 < STRIP ? b.y + b.h + 8 : b.y - 4 - 34) + "px";
  }
  function compound() {
    const ns = picked();
    if (!ns.length) return;
    const id = "c" + Date.now().toString(36);
    for (const n of ns) n.group = id;
    S.multi = new Set(ns); S.sel = null;
    draw(); commit();
    toast("Compound: these notes now move and stretch as one. Click any of them to grab the whole block.");
  }
  // lock (Eman, 4 Nov): the dice keeps these notes and writes the rest around them
  function lockPicked() {
    const ns = picked();
    if (!ns.length) return;
    const on = !ns.every((n) => n.locked);
    for (const n of ns) { if (on) n.locked = true; else delete n.locked; }
    draw(); commit();
    if (window.KT2Juice && KT2Juice.sound) (on ? KT2Juice.sound.plug : KT2Juice.sound.unplug || (() => {}))();
    toast(on ? `Locked ${ns.length > 1 ? ns.length + " notes" : "the note"}: the dice keeps ${ns.length > 1 ? "them" : "it"} and builds around ${ns.length > 1 ? "them" : "it"}.` : "Unlocked.");
    if (window.TmDice && !window.KT2_DICE_ROW_OLD && S.pane) TmDice.refresh(S.pane);   // the FULL line comes and goes with the locks
  }
  // Pull up (Eman, 4 Nov): the long note of the pick is a magnet over the chords under it. Each
  // chord plays, then over its last stretch bends up into the long note on a curve (slow first);
  // the long note sounds as they arrive and stops when the next chord starts. Click again for a
  // longer or shorter bend (1/2, 3/4, 1/4 of each chord), then off.
  const PULL_STEPS = [0.5, 0.75, 0.25], PULL_NAMES = ["1/2", "3/4", "1/4"], PULL_CURVE = 2.5;
  const pullIdx = (at) => Math.max(0, PULL_STEPS.indexOf(at || 0.5));
  // the long note: the longest picked one (highest on a tie), when there are notes under it
  function pullTarget(ns) {
    if (!ns.length) return null;
    const t = ns.reduce((b, n) => (n.length > b.length + EPS || (Math.abs(n.length - b.length) < EPS && n.pitch > b.pitch) ? n : b));
    return pullUnder(t, S.notes).length ? t : null;
  }
  const pullUnder = (t, notes) => notes.filter((q) => q !== t && !q.pull && q.pitch < t.pitch && (q._v || "") === (t._v || "") && q.start < t.start + t.length - EPS && q.start + q.length > t.start + EPS);
  // where each note under t bends: [{ q, bs, be }] in beats (same rule as toy-machine.js planPulls)
  function pullPlan(t, notes) {
    const at = t.pullAt || 0.5, out = [];
    for (const q of pullUnder(t, notes)) {
      const be = Math.min(q.start + q.length, t.start + t.length), bs = Math.max(t.start, be - (be - q.start) * at);
      if (be - bs > EPS) out.push({ q, bs, be });
    }
    return out;
  }
  function pullPicked() {
    const t = pullTarget(picked());
    if (!t) return;
    if (!t.pull) { t.pull = true; t.pullAt = 0.5; }
    else { const i = pullIdx(t.pullAt) + 1; if (i >= PULL_STEPS.length) { delete t.pull; delete t.pullAt; } else t.pullAt = PULL_STEPS[i]; }
    draw(); commit();
    if (t.pull) { hearSlide([t]); toast(`Pull up: the chords under it bend up into it over the last ${PULL_NAMES[pullIdx(t.pullAt)]} of each.`); }
    else toast("Pull up off.");
  }
  function uncompound() {
    for (const n of picked()) delete n.group;
    draw(); commit();
  }
  // The selection's first notes (its chord) and the notes sounding or ending just before them.
  const EPS = 1e-6;
  function slideInPlan(ns) {
    const t0 = Math.min(...ns.map((n) => n.start)), heads = ns.filter((n) => n.start < t0 + Math.max(EPS, chordTol()));   // a chord played a hair early still counts
    // notes still sounding when these start; else the last notes that ended up to 2 beats before
    const others = S.notes.filter((n) => !ns.includes(n) && n.start < t0 - EPS && n.start + n.length > t0 - 2 + EPS);
    const sounding = others.filter((n) => n.start + n.length > t0 + EPS);
    const lastEnd = Math.max(-Infinity, ...others.map((n) => n.start + n.length));
    const before = sounding.length ? sounding : others.filter((n) => n.start + n.length > lastEnd - EPS);
    const glides = new Set(slidePlan(S.notes).map((x) => x.note)); // "on" = they really glide now
    return { t0, heads, before, on: heads.length > 0 && heads.every((n) => glides.has(n)) };
  }
  // The selection's last notes and the notes starting right after it (up to 2 beats later).
  function slideOutPlan(ns) {
    const t1 = Math.max(...ns.map((n) => n.start + n.length));
    const tails = ns.filter((n) => n.start + n.length > t1 - EPS);
    const later = S.notes.filter((n) => !ns.includes(n) && n.start > Math.min(...tails.map((x) => x.start)) + EPS && n.start < t1 + 2);
    const first = later.length ? Math.min(...later.map((n) => n.start)) : null;
    const next = first == null ? [] : later.filter((n) => n.start < first + EPS);
    const plan = slidePlan(S.notes);
    return { tails, next, on: next.length > 0 && next.every((n) => plan.some((x) => x.note === n && tails.includes(x.from))) };
  }
  // Glide `to` from `from`: make them overlap (keeping any overlap already there, else an 1/8
  // note, never more than half of the shorter side) and mark the arriving notes as slides. Voices
  // pair up low to low, high to high, so a chord slides into the next chord cleanly.
  function makeSlide(from, to) {
    const t = Math.min(...to.map((n) => n.start));
    const lap = Math.max(0, ...from.map((n) => n.start + n.length - t));
    const want = lap > EPS ? lap : Math.min(0.5, Math.max(S.grid, Math.min(...to.map((n) => n.length)) / 2));
    for (const n of from) n.length = Math.max(n.length, t + want - n.start);
    for (const n of to) { n.slide = true; delete n.slideHand; }
    // low to low, high to high, written down so it stays that way (pick others with the tags or Tab)
    const lo = [...from].sort((a, b) => a.pitch - b.pitch), hi = [...to].sort((a, b) => a.pitch - b.pitch);
    hi.forEach((n, i) => {
      if (hi.length === 1) n.slideFrom = lo.reduce((b, q) => (Math.abs(q.pitch - n.pitch) < Math.abs(b.pitch - n.pitch) ? q : b)).pitch;   // one note: the nearest
      else if (hi.length <= lo.length) n.slideFrom = lo[Math.round(i * (lo.length - 1) / (hi.length - 1))].pitch;   // spread over the chord
      else if (i < lo.length) n.slideFrom = lo[i].pitch;
      else delete n.slideFrom;   // more notes than before: the extra ones start fresh
    });
    // the engine pairs each slide note with the nearest-pitched note sounding before it
    const order = [...from].sort((a, b) => a.pitch - b.pitch).concat([...to].sort((a, b) => a.pitch - b.pitch));
    S.notes = S.notes.filter((n) => !order.includes(n)).concat(order);
  }
  function slideIn() {
    const ns = picked(), p = slideInPlan(ns);
    if (p.on) { for (const n of p.heads) { delete n.slide; delete n.slideFrom; delete n.slideHand; } draw(); commit(); return; } // off again
    if (!p.before.length) return toast("Nothing right before these notes to slide from.");
    makeSlide(p.before, p.heads);
    draw(); commit();
    if (p.before.length < p.heads.length) toast("Fewer notes before than here: the extra notes start fresh.");
  }
  function slideOut() {
    const ns = picked(), p = slideOutPlan(ns);
    if (p.on) { for (const n of p.next) { delete n.slide; delete n.slideFrom; delete n.slideHand; } draw(); commit(); return; }
    if (!p.next.length) return toast("Nothing right after these notes to slide into.");
    makeSlide(p.tails, p.next);
    draw(); commit();
  }
  // ---- which note slides to which (Eman, 4 Nov) ---------------------------------------------
  // Every glide of the picked notes gets a tag "A4 -> E5" on its line: click it to pick the note it
  // comes from (the note that had that one swaps over). Tab / Shift+Tab steps through every way the
  // notes can pair up, and plays that spot each time so you hear it.
  const nm = (p) => keyNames()[pc(p)] + (Math.floor(p / 12) - 1);
  // the glides being worked on: the picked notes' Slide in (or else Slide out) when it's on
  function slideGroup() {
    const ns = picked();
    if (!ns.length) return null;
    const pIn = slideInPlan(ns);
    if (pIn.on) return { kind: "in", slides: pIn.heads };
    const pOut = slideOutPlan(ns);
    if (pOut.on) return { kind: "out", slides: pOut.next };
    return null;
  }
  // the notes a slide note can come from: anything still sounding when it starts (one per pitch)
  function sourcesFor(slides) {
    const t = Math.min(...slides.map((n) => n.start)), seen = new Set();
    return S.notes.filter((q) => !slides.includes(q) && q.start < t - EPS && q.start + q.length > t + EPS)
      .sort((a, b) => a.pitch - b.pitch).filter((q) => (seen.has(q.pitch) ? false : seen.add(q.pitch)));
  }
  // every way to pair them up (at most 24), each a list of source pitches (null = starts fresh)
  function pairings(slides, srcs) {
    const H = [...slides].sort((a, b) => a.pitch - b.pitch), P = srcs.map((q) => q.pitch), want = Math.min(H.length, P.length), out = [];
    const go = (i, used, acc, n) => {
      if (out.length >= 24) return;
      if (i === H.length) { if (n === want) out.push(acc.slice()); return; }
      for (const p of P) if (!used.has(p)) { used.add(p); acc.push(p); go(i + 1, used, acc, n + 1); acc.pop(); used.delete(p); }
      if (H.length - i > want - n) { acc.push(null); go(i + 1, used, acc, n); acc.pop(); }
    };
    go(0, new Set(), [], 0);
    return { H, list: out };
  }
  function currentPairing(H) {
    const plan = slidePlan(S.notes);
    return H.map((n) => { const x = plan.find((y) => y.note === n); return x ? x.from.pitch : null; });
  }
  function cycLabel(kind, slides) {
    const grp = slideGroup();
    if (!grp || grp.kind !== kind) return "";
    const { H, list } = pairings(slides, sourcesFor(slides));
    if (list.length < 2) return "";
    const cur = JSON.stringify(currentPairing(H)), i = list.findIndex((o) => JSON.stringify(o) === cur);
    return ` <span class="tmm-cyc">\u21E5 ${i < 0 ? "-" : i + 1}/${list.length}</span>`;
  }
  function applyPairing(H, opt) {
    H.forEach((n, i) => { if (opt[i] == null) delete n.slideFrom; else n.slideFrom = opt[i]; n.slide = true; n.slideHand = true; });   // picked by hand: kept even when lines cross
  }
  function cycleSlides(d) {
    const grp = slideGroup();
    if (!grp) return false;
    const { H, list } = pairings(grp.slides, sourcesFor(grp.slides));
    if (list.length < 2) return false;
    const cur = JSON.stringify(currentPairing(H)), i = list.findIndex((o) => JSON.stringify(o) === cur);
    applyPairing(H, list[((i < 0 ? 0 : i + d) % list.length + list.length) % list.length]);
    draw(); commit(); hearSlide(grp.slides);
    return true;
  }
  // play the spot: from a beat before the glide, for about two seconds
  let hearT = 0;
  function hearSlide(slides) {
    const c = findClip(S.clipId);
    if (!c || !slides.length) return;
    const t = c.start + Math.max(0, Math.min(...slides.map((n) => n.start)) - 1) * secPerBeat();
    clearTimeout(hearT);
    const go = () => run("setPosition", { time: t }).then(() => (ui.transport.playing ? null : run("togglePlay")));
    setTimeout(go, S.pending ? 60 : 0);
    hearT = setTimeout(() => { if (ui.transport.playing) run("togglePlay"); }, 1900);
  }
  function placeChips(drawn) {
    const box = S.pane.querySelector("#tmm-chips");
    if (!box) return;
    const ns = picked(), grp = !S.drag && !S.box ? slideGroup() : null;
    const show = S.drag || S.box || !ns.length ? [] : drawn.filter((sl) => sl.mx >= KEYS && (grp ? grp.slides.includes(sl.note) : ns.includes(sl.note) || ns.includes(sl.from)));
    S.chips = show;
    const html = show.map((sl, i) => `<button data-i="${i}" style="left:${Math.round(sl.mx)}px;top:${Math.round(sl.my)}px" title="Pick the note it slides from">${nm(sl.from.pitch)} \u2192 ${nm(sl.note.pitch)}</button>`).join("");
    if (box._html !== html) { box.innerHTML = html; box._html = html; }   // (not innerHTML: see placeMenu)
  }
  function openPick(i, btn) {
    const sl = S.chips && S.chips[i], pk = S.pane.querySelector("#tmm-pick");
    if (!sl || !pk) return;
    const srcs = sourcesFor([sl.note].concat((slideGroup() || { slides: [] }).slides.filter((n) => n !== sl.note && Math.abs(n.start - sl.note.start) < EPS)));
    S.pickFor = sl.note;
    pk.innerHTML = `<b>${nm(sl.note.pitch)} slides from</b>` + srcs.map((q) => `<button data-p="${q.pitch}" class="${q.pitch === sl.from.pitch ? "on" : ""}">${nm(q.pitch)}</button>`).join("")
      + `<button data-p="-1" class="${""}" title="No slide: this note starts fresh">none</button>`;
    pk.hidden = false;
    const wrap = pk.parentNode.getBoundingClientRect(), r = btn.getBoundingClientRect(), sx = pk.parentNode.clientWidth / (wrap.width || 1);
    pk.style.left = Math.max(4, Math.min(pk.parentNode.clientWidth - pk.offsetWidth - 4, (r.left - wrap.left) * sx)) + "px";
    pk.style.top = ((r.bottom - wrap.top) * sx + 4) + "px";
  }
  function pickSource(p) {
    const n = S.pickFor, pk = S.pane.querySelector("#tmm-pick");
    if (pk) pk.hidden = true;
    if (!n) return;
    if (p < 0) { delete n.slide; delete n.slideFrom; delete n.slideHand; draw(); commit(); return; }
    const plan = slidePlan(S.notes), was = (plan.find((x) => x.note === n) || {}).from;
    // the slide that came from that note takes this one's old note instead
    const other = plan.find((x) => x.note !== n && x.from.pitch === p && Math.abs(x.note.start - n.start) < EPS);
    if (other) { if (was) other.note.slideFrom = was.pitch; else delete other.note.slideFrom; other.note.slideHand = true; }
    n.slide = true; n.slideFrom = p; n.slideHand = true;
    draw(); commit(); hearSlide([n]);
  }

  // Which slide notes glide from which note: the same rule as the TOY MACHINE engine
  // (playground/toy-machine.js planSlides): the latest note still sounding, nearest pitch on a tie.
  function slidePlan(notes) {
    if (notes.some((n) => n._v)) {   // ALL: each sound glides on its own
      const by = new Map(); for (const n of notes) { const k = n._v || ""; if (!by.has(k)) by.set(k, []); by.get(k).push(n); }
      return [].concat(...[...by.values()].map((ns) => slidePlan1(ns)));
    }
    return slidePlan1(notes);
  }
  // chords pair by order, top to top (Eman, 4 Nov 19:50): the same rule as planSlides/pairChord
  // in playground/toy-machine.js, in beats
  const chordTol = () => 0.08 / Math.max(0.05, secPerBeat());
  function slidePlan1(notes) {
    const out = [], gone = new Set(), end = new Map(notes.map((n) => [n, n.start + n.length])), tol = chordTol();
    const slides = notes.filter((n) => n.slide).sort((a, b) => a.start - b.start);
    for (let i = 0; i < slides.length;) {
      const t0 = slides[i].start, G = [];
      while (i < slides.length && slides[i].start <= t0 + tol) G.push(slides[i++]);
      const Sx = notes.filter((q) => !gone.has(q) && !G.includes(q) && q.start < t0 - 1e-9 && end.get(q) > t0 && !(q.slide && q.start > t0 - tol));
      const pairs = new Map(), used = new Set();
      for (const s of G) if (s.slideFrom != null) { const q = Sx.find((x) => !used.has(x) && x.pitch === s.slideFrom); if (q) { pairs.set(s, q); used.add(q); } }
      // crossing picks from the old automatic pairing are dropped (pair by order); picks made by hand
      // (the "xx -> xx" tags or Tab, Eman 6 Nov 19:16) are kept even when the lines cross
      const ex = [...pairs].sort((a, b) => a[0].pitch - b[0].pitch), hand = ex.length && ex.every((e) => e[0].slideHand) && !window.TMM_HAND_CROSS_OFF;
      if (!hand && ex.some((e, k) => k && e[1].pitch < ex[k - 1][1].pitch)) { pairs.clear(); used.clear(); }
      const g = G.filter((x) => !pairs.has(x)).sort((a, b) => a.pitch - b.pitch);
      let src = Sx.filter((q) => !used.has(q));
      if (g.length && src.length) {
        const latest = Math.max(...src.map((q) => q.start)), near = src.filter((q) => q.start >= latest - tol);
        if (near.length >= g.length) src = near;
        src.sort((a, b) => a.pitch - b.pitch);
        if (g.length === 1) pairs.set(g[0], src.reduce((b, q) => (Math.abs(q.pitch - g[0].pitch) < Math.abs(b.pitch - g[0].pitch) ? q : b)));
        else g.forEach((x, k) => pairs.set(x, src[Math.round(k * (src.length - 1) / (g.length - 1))]));
        const seen = new Set();
        for (const [x, q] of [...pairs]) { if (seen.has(q)) pairs.delete(x); else seen.add(q); }
      }
      for (const [x, p] of pairs) {
        out.push({ note: x, from: p, beats: Math.min(end.get(p), end.get(x)) - x.start });
        end.set(x, Math.max(end.get(p), end.get(x)));
        gone.add(p);
      }
    }
    return out;
  }

  // =====================================================================================
  // ADVANCED (Eman, 7 Nov): the same clean roll, plus each note's own pitch line and wobble, played
  // by TOY MACHINE (tm_note_bend / tm_note_wobble in Source/dsp/toymachine). Studied from Ableton
  // Live 12's note expression videos: thin pitch lines hanging off the notes (octave falls, scoops up
  // into a note, slow drifts over a bar, zigzag wobbles), there edited with a pencil in a lane under
  // the notes. Here it is direct: press PITCH, drag from a note to anywhere, and the sound follows the
  // line; WOBBLE is dragged straight on the note. The FL-style slides and Pull up still play; in
  // ADVANCED they recede (dissolved) so the lines are the picture.
  //   n.bend = [[t, s, curve?], ...]  t beats from the note start (0..length), s semitones from its pitch;
  //            before the first point the pitch sits at that point, after the last it holds
  //   n.wob  = { d: semitones (peak), r: cycles per beat, f: fade in over this much of the note (0..1), sh: 0 sine 1 tri 2 square 3 saw }
  const ADV_STORE = "kt2.midiAdv";
  // How the mouse works on a note (Zed call, 7 Nov). KILLTOY (Eman's way, default): double-click a note takes
  // it away, right-click too. CLASSIC (Zed's way): double-click picks it, right-click opens its menu (Slide in,
  // Slide out, Compound, Pull up, Remove). Click on empty grid writes a note either way. localStorage kt2.midiMouse.
  const MOUSE_STORE = "kt2.midiMouse";
  const mouseMode = () => { try { return localStorage.getItem(MOUSE_STORE) === "classic" ? "classic" : "killtoy"; } catch (e) { return "killtoy"; } };
  const setMouseMode = (m) => { try { localStorage.setItem(MOUSE_STORE, m); } catch (e) { /* private window */ } for (const st of STATES.values()) showMouse(st.pane); };
  const showMouse = (pane) => { const b = pane.querySelector("#tmm-mouse"); if (!b) return; const c = mouseMode() === "classic"; b.classList.toggle("on", c); b.setAttribute("aria-pressed", String(c)); b.title = c ? "Mouse: CLASSIC. Double-click a note picks it, right-click opens its menu. Click: back to KILLTOY (double-click or right-click a note takes it away)" : "Mouse: KILLTOY. Double-click a note opens its menu, right-click takes it away. Click: CLASSIC (double-click picks, right-click opens the note's menu)"; };
  const WOB_RATES = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];   // cycles per beat
  const RATE_NAMES = { 0.25: "1 bar", 0.5: "1/2", 1: "1/4", 1.5: "1/4T", 2: "1/8", 3: "1/8T", 4: "1/16", 6: "1/16T", 8: "1/32", 12: "1/32T", 16: "1/64" };
  const rateName = (r) => RATE_NAMES[r] || (+r).toFixed(1) + "/beat";
  const WOB_SHAPES = ["\u223f", "\u22c0", "\u2293", "\u25e9"];   // sine, triangle, square, saw
  const WOB_DEF = { d: 0.5, r: 2, f: 0, sh: 0 };
  // Wobble intensity curve (Eman, 8 Nov): each note's wobble has its own curve over the note, n.wob.e =
  // [[u 0..1 of the note, level 0..1 of Depth], ...], and its own rate (n.wob.r). It is drawn INSIDE the
  // note's body as a dark level that rises from the bottom, cut into one stripe per wobble cycle; the pitch
  // lines stay thin bright lines on top, and whichever tool is on gets the light (the other one dims).
  // Squares = wobble points, round dots = pitch points. Everything down to 0% = the wobble is off.
  // KT2_WOB_ENV_OLD = the old wobble (one depth/rate/fade per note, drawn as a zigzag on the line).
  const wobEnvOn = () => !window.KT2_WOB_ENV_OLD;
  // EDGE DOTS (Eman, 8 Nov, picked option 1 of 10): the old wavy wobble line is back as the picture, its
  // height following the curve, and with WOBBLE on three dots ride the top of the wave (start, middle, end).
  // Drag a dot down = the wobble calms there, up = it grows; press the wave elsewhere = one more dot there.
  // KT2_WOB_V6C = the V6c picture (dark level inside the note, white squares, rate chip).
  const wobDots = () => wobEnvOn() && !window.KT2_WOB_V6C;
  // THREE DOTS ONLY (Eman 24 Nov, clip 00.59: "there should only be three markers on the wobble, you should not be able to
  // make your own ... a stuck one in the beginning, the middle, the ending, you can't change that"): every wobble shows
  // exactly start / middle / end, they only go up and down, pressing the wave grabs the nearest of the three (no new dot),
  // right-click doesn't take one away. A curve with more points (an old one, a Curve preset) is read at those 3 spots.
  // KT2_WOB3_OLD = dots can be added anywhere, moved sideways, taken off
  const wob3On = () => wobDots() && !window.KT2_WOB3_OLD;
  const env3 = (w) => [0, 0.5, 1].map((u) => [u, +envLevel(w, u).toFixed(3)]);
  const WOB_NEW = { d: 0.5, r: 4, sh: 0 };   // a fresh wobble: half a semitone at 1/16
  const ENV_PRESETS = [
    { name: "Rise", e: [[0, 0], [1, 1]] },
    { name: "Swell", e: [[0, 0], [0.5, 1], [1, 0]] },
    { name: "Fall", e: [[0, 1], [1, 0]] },
    { name: "Late", e: [[0, 0], [0.5, 0], [1, 1]] },
    { name: "Full", e: [[0, 1], [1, 1]] },
  ];
  // the curve of a note's wobble (an old one with a fade reads as a ramp up to full)
  const envOf = (w) => (w && Array.isArray(w.e) && w.e.length ? w.e : w && w.f > 0 ? [[0, 0], [Math.min(1, w.f), 1], [1, 1]] : [[0, 1], [1, 1]]);
  function envLevel(w, u) {
    const E = envOf(w);
    if (u <= E[0][0]) return E[0][1];
    for (let i = 0; i + 1 < E.length; i++) { const a = E[i], b = E[i + 1]; if (u <= b[0]) { const d = b[0] - a[0]; return d <= 1e-9 ? b[1] : a[1] + (b[1] - a[1]) * (u - a[0]) / d; } }
    return E[E.length - 1][1];
  }
  const envName = (w) => { const k = JSON.stringify(envOf(w)); const p = ENV_PRESETS.find((x) => JSON.stringify(x.e) === k); return p ? p.name : "Drawn"; };
  const envOff = (E) => E.every((p) => p[1] <= 0.005);
  const clampN = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
  const advOn = () => !!(S && S.adv);
  const advPts = (n) => (n && Array.isArray(n.bend) ? n.bend : []);
  // a note copy with its own pitch line and wobble (debug sprint, 8 Nov: an Option-drag copy, a pasted note
  // and the loaded notes shared these arrays, so dragging a point of one line moved the other note's line too).
  // KT2_SHARED_EXPR_OLD = old (shallow copies).
  const ownExpr = (n) => {
    if (window.KT2_SHARED_EXPR_OLD) return n;
    if (Array.isArray(n.bend)) n.bend = n.bend.map((p) => p.slice());
    if (n.wob && typeof n.wob === "object") { n.wob = { ...n.wob }; if (Array.isArray(n.wob.e)) n.wob.e = n.wob.e.map((p) => p.slice()); }
    return n;
  };
  const hasExpr = (n) => advPts(n).length > 0 || !!(n.wob && n.wob.d > 0);
  // what goes into the clip (commit / copy)
  const advOut = (bend, wob, length) => ({
    ...(Array.isArray(bend) && bend.length ? { bend: bend.map((p) => [+clampN(0, length, p[0]).toFixed(4), +(+p[1]).toFixed(3), ...(p[2] && p[2] !== 1 ? [+(+p[2]).toFixed(2)] : [])]) } : {}),
    ...(wob && wob.d > 0 ? { wob: { d: +(+wob.d).toFixed(3), r: +(+(wob.r || 2)).toFixed(3), ...(wob.f ? { f: +(+wob.f).toFixed(3) } : {}), ...(wob.sh ? { sh: wob.sh } : {}), ...(Array.isArray(wob.e) && wob.e.length ? { e: wob.e.map((p) => [+clampN(0, 1, p[0]).toFixed(3), +clampN(0, 1, p[1]).toFixed(3)]) } : {}) } } : {}),
  });
  // THREE TABS (Eman, 10 Nov 22:55): MIDI | DICE | ADVANCED. Every dice control (prompt, dice, what it writes, speed,
  // the dice panel, octaves) lives on the DICE tab only, so no page gets crowded; MIDI and ADVANCED are for the notes.
  // ADVANCED never shows the note menu (Slide in / Slide out / Pull up / Lock): that is MIDI and DICE only.
  // KT2_TABS3_OFF = the two tabs as before (dice in the bar on MIDI and ADVANCED)
  const tabs3On = () => !window.KT2_TABS3_OFF && !!window.TmDice && !window.KT2_DICE_ROW_OLD;
  const DTAB_STORE = "kt2.midiDiceTab";
  const loadDiceTab = () => { try { return localStorage.getItem(DTAB_STORE) === "1"; } catch (e) { return false; } };
  const saveDiceTab = (on) => { try { localStorage.setItem(DTAB_STORE, on ? "1" : "0"); } catch (e) { /* private window */ } };
  const loadAdv = () => { try { return localStorage.getItem(ADV_STORE) === "1"; } catch (e) { return false; } };
  const saveAdv = (on) => { try { localStorage.setItem(ADV_STORE, on ? "1" : "0"); } catch (e) { /* private window */ } };

  // ---- the line's maths
  // the pitch line's offset (semitones) t beats after the note starts
  function bendAt(n, t) {
    const P = advPts(n);
    if (!P.length) return 0;
    if (t <= P[0][0]) return P[0][1];
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1];
      if (t <= b[0]) { const d = b[0] - a[0]; if (d <= 1e-9) return b[1]; const u = (t - a[0]) / d, c = a[2] || 1; return a[1] + (b[1] - a[1]) * (c === 1 ? u : Math.pow(u, c)); }
    }
    return P[P.length - 1][1];
  }
  // the wobble (semitones) t beats in; when the song isn't playing it drifts slowly so it reads as alive
  function wobAt(n, t, tNow, playing) {
    const w = n.wob;
    if (!w || !(w.d > 0)) return 0;
    const env = Array.isArray(w.e) && w.e.length ? envLevel(w, t / Math.max(1e-6, n.length)) : w.f > 0 ? Math.min(1, t / Math.max(1e-6, w.f * n.length)) : 1;
    const ph = t * (w.r || 2) + (playing ? 0 : tNow * 0.3), x = ph - Math.floor(ph), sh = w.sh || 0;
    const v = sh === 1 ? (x < 0.5 ? 4 * x - 1 : 3 - 4 * x) : sh === 2 ? Math.tanh(6 * Math.sin(2 * Math.PI * x)) : sh === 3 ? 1 - 2 * x : Math.sin(2 * Math.PI * x);
    return w.d * env * v;
  }
  const soundAt = (n, t, tNow, playing) => n.pitch + bendAt(n, t) + wobAt(n, t, tNow, playing);
  // screen y of a pitch that may sit between rows (and rows may skip pitches when folded to the key)
  function yOfPitch(rows, p) {
    p = clampN(RLO(), RHI(), p);
    const lo = Math.floor(p), hi = Math.ceil(p), f = p - lo;
    const ry = (q) => STRIP + (rowOf(rows, q) + 0.5) * ROW;
    return hi === lo ? ry(lo) : ry(lo) + (ry(hi) - ry(lo)) * f;
  }
  // the pitch under a screen y: the row's note, or between rows when `free`
  function pitchAtY(rows, y, free) {
    const u = (y - STRIP) / ROW, ri = clampN(0, rows.length - 1, Math.floor(u) + S.top);
    const p = rows[ri];
    return free ? +(p + (0.5 - (u - Math.floor(u)))).toFixed(2) : p;
  }
  const advLabel = (note, B) => { const p = note.pitch + B[1], s = B[1]; return `${nm(Math.round(p))}${Math.abs(p - Math.round(p)) > 0.01 ? "~" : ""}  ${s > 0 ? "+" : ""}${Math.abs(s % 1) > 0.01 ? s.toFixed(1) : s}`; };

  // ---- the mode, the tools, the dock
  function advBuild(pane, q) {
    q("tmm-mode-notes").onclick = () => advMode(false);
    q("tmm-mode-adv").onclick = () => advMode(true);
    if (q("tmm-mode-dice")) q("tmm-mode-dice").onclick = () => diceTab();
    const dock = q("tmm-dock");
    dock.addEventListener("mousedown", (e) => e.stopPropagation());
    for (const b of dock.querySelectorAll("button[data-tool]")) b.onclick = () => {
      const t = b.dataset.tool;
      // PITCH with two or more notes picked: build the glide between them right away (Eman: "if you select two, you can build a pitch between them")
      // KT2_PITCH_MULTI_OFF = old: always try to build it (and say so when the notes don't line up)
      if (t === "pitch" && picked().length >= 2) { advTool("pitch"); if (window.KT2_PITCH_MULTI_OFF || advBetweenOk(picked())) advBetween(picked()); return; }
      advTool(S.tool === t && t !== "move" ? "move" : t);
    };
    // RESET (Eman, 8 Nov): shows when a picked note has a pitch line or a wobble, and turns the picked
    // notes back into plain notes (multi-select too). Nothing picked = nothing happens.
    // KT2_RESET_OLD = old CLEAR (always there; with nothing picked it cleared every note).
    q("tmm-advclear").onclick = () => {
      const ns = window.KT2_RESET_OLD ? (picked().length ? picked() : S.notes.filter(hasExpr)) : picked().filter(hasExpr);
      if (!ns.length) return;
      for (const n of ns) { delete n.bend; delete n.wob; }
      draw(); commit(); advDock();
    };
    // the wobble readouts: drag them (or scroll) to change the picked notes' wobble; click Shape / Rate steps on
    for (const k of dock.querySelectorAll(".tmm-dknob")) {
      const key = k.dataset.k;
      // new wobble: the picked notes (all of them, also the ones without a wobble yet); old: as before
      const targets = () => { const ps = picked(); const have = ps.filter((n) => n.wob && n.wob.d > 0); return wobEnvOn() && ps.length ? ps : have.length ? have : ps.length ? ps : S.notes.filter((n) => n.wob && n.wob.d > 0); };
      const step = (ns, d, dx) => {
        for (const n of ns) {
          const w = wobEnvOn() ? (n.wob && n.wob.d > 0 ? { ...n.wob } : newWob()) : { ...WOB_DEF, ...(n.wob || {}) };
          if (key === "e") { const i = ENV_PRESETS.findIndex((x) => x.name === envName(w)); w.e = ENV_PRESETS[((i < 0 ? -1 : i) + (d < 0 ? ENV_PRESETS.length - 1 : 1)) % ENV_PRESETS.length].e.map((p) => p.slice()); delete w.f; n.wob = w; continue; }
          if (key === "d" && wobEnvOn() && d < 0 && w.d <= 0.05) { delete n.wob; continue; }   // scrolled down past the bottom: off
          if (key === "d") w.d = +clampN(0.05, 12, w.d + d * (w.d >= 2 ? 0.25 : 0.05)).toFixed(2);
          else if (key === "r") w.r = WOB_RATES[clampN(0, WOB_RATES.length - 1, nearestRate(w.r) + (dx != null ? dx : d))];
          else if (key === "f") w.f = +clampN(0, 1, w.f + d * 0.05).toFixed(2);
          else if (key === "sh") w.sh = ((w.sh || 0) + 1) % 4;
          n.wob = w;
        }
      };
      k.addEventListener("mousedown", (e) => {
        e.preventDefault(); e.stopPropagation();
        const ns = targets();
        if (!ns.length) { toast("Pick a note first, or press a note with the WOBBLE tool."); return; }
        const prev = ns.map((n) => JSON.stringify(n.wob || null)), base = ns.map((n) => (wobEnvOn() ? (n.wob && n.wob.d > 0 ? { ...n.wob } : newWob()) : { ...WOB_DEF, ...(n.wob || {}) }));
        const x0 = e.clientX, y0 = e.clientY; let moved = false;
        const mv = (ev) => {
          const dy = y0 - ev.clientY, dx = ev.clientX - x0;
          if (Math.abs(dy) > 2 || Math.abs(dx) > 2) moved = true;
          ns.forEach((n, i) => { const w = { ...base[i] };
            if (key === "d") w.d = +clampN(0.05, 12, base[i].d * Math.exp(dy / 60)).toFixed(2);
            else if (key === "r") w.r = WOB_RATES[clampN(0, WOB_RATES.length - 1, nearestRate(base[i].r) + Math.round(dx / 28))];
            else if (key === "f") w.f = +clampN(0, 1, base[i].f + dy / 120).toFixed(2);
            else if (key === "e" || key === "sh") return;
            // new wobble: Depth dragged all the way down = off (Eman, 8 Nov)
            if (key === "d" && wobEnvOn() && base[i].d * Math.exp(dy / 60) < 0.05) { delete n.wob; return; }
            n.wob = w; });
          advDock(); queueDraw();
        };
        const up = () => {
          window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
          if (!moved && (key === "sh" || key === "r" || key === "e")) step(ns, 1);
          advDock(); draw();
          if (ns.some((n, i) => JSON.stringify(n.wob || null) !== prev[i])) { commit(); advHear(ns[0]); }
        };
        window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      });
      k.addEventListener("wheel", (e) => { e.preventDefault(); e.stopPropagation(); const ns = targets(); if (!ns.length) return; step(ns, e.deltaY < 0 ? 1 : -1); for (const n of ns) if (n.wob && !(n.wob.d > 0)) delete n.wob; advDock(); draw(); clearTimeout(S.advWheelT); S.advWheelT = setTimeout(() => { commit(); }, 350); }, { passive: false });
    }
  }
  const newWob = () => (wobDots() ? { d: 0.5, r: 2, sh: 0, e: [[0, 1], [0.5, 1], [1, 1]] } : { ...WOB_NEW, e: ENV_PRESETS[0].e.map((p) => p.slice()) });
  const nearestRate = (r) => WOB_RATES.reduce((b, x, i) => (Math.abs(x - r) < Math.abs(WOB_RATES[b] - r) ? i : b), 0);
  function advShow(pane) {
    if (S.adv == null) S.adv = loadAdv();
    if (S.diceTab == null) S.diceTab = !S.adv && tabs3On() && loadDiceTab();
    if (!S.tool) S.tool = "move";
    advApply(pane);
  }
  function advMode(on) {
    if (!S) return;
    S.adv = !!on; saveAdv(S.adv);
    S.diceTab = false; saveDiceTab(false);
    if (!S.adv) S.tool = "move";
    advApply(S.pane); draw();
    if (S.adv && window.KT2Juice && KT2Juice.sound && KT2Juice.sound.unplug) KT2Juice.sound.unplug();
  }
  function diceTab() {
    if (!S) return;
    S.adv = false; saveAdv(false); S.tool = "move";
    S.diceTab = true; saveDiceTab(true);
    advApply(S.pane); draw();
  }
  function advApply(pane) {
    const q = (id) => pane.querySelector("#" + id), on = !!S.adv, T3 = tabs3On(), dt = T3 && !on && !!S.diceTab;
    pane.classList.toggle("tmm-advanced", on);
    pane.classList.toggle("tmm-tabs3", T3); pane.classList.toggle("tmm-dicetab", dt);
    if (dt && window.TmDice && !TmDice.isOpen()) TmDice.toggle(pane, true);   // the DICE tab is the dice panel, always open
    const a = q("tmm-mode-adv"), b = q("tmm-mode-notes"), d = q("tmm-dock"), dz = q("tmm-mode-dice");
    if (a) a.classList.toggle("on", on); if (b) b.classList.toggle("on", !on && !dt); if (dz) dz.classList.toggle("on", dt);
    if (d) d.hidden = !on;
    advTool(S.tool || "move", true);
    advDock();
  }
  function advTool(t, quiet) {
    if (!S) return;
    S.tool = t;
    const dock = S.pane.querySelector("#tmm-dock");
    if (dock) for (const b of dock.querySelectorAll("button[data-tool]")) b.classList.toggle("on", b.dataset.tool === t);
    const cv = S.pane.querySelector("#tmm-canvas");
    if (cv) cv.style.cursor = t === "pitch" ? "crosshair" : t === "wobble" ? "ns-resize" : "";
    if (!quiet) draw();
  }
  // RESET in the dock: lit only while a picked note has a pitch line or a wobble
  function advReset() {
    const b = S.pane && S.pane.querySelector("#tmm-advclear"); if (!b) return;
    const old = !!window.KT2_RESET_OLD, on = old || picked().some(hasExpr);
    b.classList.toggle("live", !old && on); b.classList.toggle("gone", !on);
    const sep = S.pane.querySelector("#tmm-dsep-reset"); if (sep) sep.classList.toggle("gone", !on);
    const t = b.querySelector("span"); if (t) t.textContent = old ? "Clear" : "Reset";
  }
  // the dock's readouts follow the wobble being worked on
  function advDock() {
    if (S && S.pane) advReset();
    if (!S || !S.pane) return;
    const q = (id) => S.pane.querySelector("#" + id);
    const ps = picked(), w = (ps.find((n) => n.wob && n.wob.d > 0) || S.notes.find((n) => n.wob && n.wob.d > 0) || {}).wob;
    const set = q("tmm-dset"); if (set) set.classList.toggle("idle", !w);
    const v = w || WOB_DEF;
    if (q("tmm-wd")) q("tmm-wd").textContent = (+v.d).toFixed(v.d >= 2 ? 1 : 2).replace(/\.?0+$/, "") + " st";
    if (q("tmm-wr")) q("tmm-wr").textContent = rateName(v.r || 2);
    if (q("tmm-wf")) q("tmm-wf").textContent = Math.round((v.f || 0) * 100) + "%";
    if (q("tmm-ws")) q("tmm-ws").textContent = WOB_SHAPES[v.sh || 0];
    // new wobble: Curve takes Fade's place (KT2_WOB_ENV_OLD = Fade)
    const nw = wobEnvOn(), kf = S.pane.querySelector('.tmm-dknob[data-k="f"]'), ke = S.pane.querySelector('.tmm-dknob[data-k="e"]');
    if (kf) kf.hidden = nw; if (ke) ke.hidden = !nw;
    if (q("tmm-we")) q("tmm-we").textContent = w ? envName(w) : "Rise";
    if (nw && !w && q("tmm-wr")) q("tmm-wr").textContent = rateName(WOB_NEW.r);
    dockFit(S.pane);
  }
  // sprint 8 Nov: in SPLIT the roll is narrower than the dock, so its left end (RESET) was cut off by the
  // window and its right end ran under the synth. Shrink it to fit its pane. KT2_DOCK_FIT_OLD = old (no fit).
  function dockFit(pane) {
    const d = pane && pane.querySelector("#tmm-dock"); if (!d || d.hidden) return;
    d.style.scale = ""; if (window.KT2_DOCK_FIT_OLD) return;
    const host = d.offsetParent; if (!host) return;
    const room = host.clientWidth - 12, w = d.offsetWidth;
    if (w > room && room > 0) { d.style.transformOrigin = "50% 100%"; d.style.scale = String(Math.max(0.5, room / w)); }
  }

  // ---- drawing: the ribbon, the line, its points, the comet riding it while the song plays
  function advDraw(g, c, rows, ppb, vis, beats, spb, playingNow, pb) {
    const adv = advOn(), tNow = performance.now() / 1000;
    const list = S.notes.filter(hasExpr);
    if (S.advDrag && S.advDrag.note && !list.includes(S.advDrag.note)) list.push(S.advDrag.note);
    let anyWob = false;
    const yTop = STRIP, yBot = S.pane.querySelector("#tmm-canvas").clientHeight - FOOT;
    // new wobble: its curve in the note bodies (under the lines); the lines show only the pitch, and dim
    // while WOBBLE is the tool
    const newWobs = wobEnvOn() && !wobDots();
    if (newWobs) advWobDraw(g, rows, ppb, vis, beats);
    const lineK = newWobs && adv && S.tool === "wobble" ? 0.3 : 1;
    for (const n of list) {
      if (newWobs && !advPts(n).length) continue;   // a wobble alone has no line: its curve is in the note
      const picked1 = S.sel === n || (S.multi && S.multi.has(n)) || (S.advDrag && S.advDrag.note === n);
      const col = n._v ? vcolOf(n._v) : S.vcol || COLOR;
      const x0 = OX + n.start * ppb, x1 = OX + (n.start + n.length) * ppb;
      if (x1 < KEYS - 2 || x0 > OX + beats * ppb + 2) continue;
      const wob = !newWobs && n.wob && n.wob.d > 0;
      anyWob = anyWob || wob;
      const live = playingNow && pb >= n.start && pb < n.start + n.length;
      // the sounded pitch along the note, sampled every 2 px (every 1 px with a wobble)
      const stepPx = wob ? 1 : 2, pts = [];
      const lineAt = newWobs ? (t) => n.pitch + bendAt(n, t) : (t) => soundAt(n, t, tNow, playingNow);
      for (let x = Math.max(x0, KEYS); x <= x1; x += stepPx) pts.push([x, yOfPitch(rows, lineAt((x - x0) / ppb))]);
      if (pts.length && pts[pts.length - 1][0] < x1) pts.push([x1, yOfPitch(rows, lineAt(n.length))]);
      if (pts.length < 2) continue;
      const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
      g.save();
      g.lineCap = "round"; g.lineJoin = "round";
      const ga = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "globalAlpha");
      if (lineK !== 1) Object.defineProperty(g, "globalAlpha", { configurable: true, get() { return ga.get.call(this) / lineK; }, set(v) { ga.set.call(this, v * lineK); } });
      // the ribbon, the glow and the line stay between the note's start and end: no round caps or glow
      // reaching into the next note's space (Eman, 8 Nov). KT2_GHOST_PAD_OLD = old
      const fitL = !window.KT2_GHOST_PAD_OLD;
      if (fitL) { g.save(); g.beginPath(); g.rect(x0, -1e5, x1 - x0, 2e5); g.clip(); }
      if (adv) {
        // the ribbon: the note's body following its own line, so a bent note is seen bending
        g.globalAlpha = picked1 ? 0.22 : 0.14; g.strokeStyle = col; g.lineWidth = Math.max(4, ROW * 0.62); path(); g.stroke();
        // the glow and the line: purple where it leaves the note, acid where it lands
        const grad = g.createLinearGradient(pts[0][0], 0, pts[pts.length - 1][0], 0);
        grad.addColorStop(0, col); grad.addColorStop(1, ACID);
        g.globalAlpha = picked1 || live ? 1 : 0.85;
        g.shadowColor = live ? ACID : "rgba(228,255,58,0.75)"; g.shadowBlur = live ? 18 : picked1 ? 14 : 9;
        g.strokeStyle = grad; g.lineWidth = picked1 ? 3 : 2.5; path(); g.stroke();
        g.shadowBlur = 0;
        g.globalAlpha = 0.9; g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 0.8; path(); g.stroke();
      } else {
        // the MIDI tab stays as it is: the line only hints that the note has one (edit it in ADVANCED)
        g.globalAlpha = 0.4; g.strokeStyle = ACID; g.lineWidth = 1.5; path(); g.stroke();
      }
      if (fitL) g.restore();
      // the points of the pitch line (ADVANCED): hollow dots, the last one with a white core; a picked
      // note also shows a small handle in the middle of each stretch that bends it
      if (adv) {
        const P = advPts(n);
        P.forEach((p, i) => {
          const x = x0 + p[0] * ppb, y = yOfPitch(rows, n.pitch + p[1]);
          if (x < KEYS - 4 || y < yTop - 6 || y > yBot + 6) return;
          const r = picked1 ? 5 : 4;
          g.globalAlpha = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = "#161618"; g.fill();
          g.lineWidth = 2; g.strokeStyle = ACID; g.stroke();
          if (i === P.length - 1 || i === 0) { g.beginPath(); g.arc(x, y, r - 2.5, 0, 7); g.fillStyle = i === P.length - 1 ? "#fff" : col; g.fill(); }
          if (picked1 && i + 1 < P.length) {
            const q = P[i + 1], d = q[0] - p[0];
            if (d > 1e-6) {
              const cx = x0 + (p[0] + d / 2) * ppb, cy = yOfPitch(rows, n.pitch + bendAt(n, p[0] + d / 2));
              g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.fillStyle = ACID; g.globalAlpha = 0.9; g.fillRect(-3, -3, 6, 6); g.restore();
            }
          }
        });
      }
      // the comet: a bright dot riding the line at the marker, with a short tail behind it
      if (live) {
        const t = pb - n.start, x = x0 + t * ppb, y = yOfPitch(rows, soundAt(n, t, tNow, true));
        const tr = (S.trail = S.trail || []);
        tr.push([x, y, tNow]);
        while (tr.length > 18 || (tr.length && tNow - tr[0][2] > 0.25)) tr.shift();
        tr.forEach(([tx, ty, tt], i) => { const k = (i + 1) / tr.length; g.globalAlpha = 0.5 * k; g.fillStyle = ACID; g.beginPath(); g.arc(tx, ty, 1.5 + 3 * k, 0, 7); g.fill(); });
        g.globalAlpha = 1; g.shadowColor = ACID; g.shadowBlur = 16; g.fillStyle = ACID; g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill();
        g.shadowBlur = 0; g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill();
      }
      if (lineK !== 1) delete g.globalAlpha;
      g.restore();
    }
    if (!playingNow && S.trail) S.trail = null;
    if (wobDots() && wobFocus()) advWobDotsDraw(g, rows, ppb);
    // PITCH on: every note without a line shows a dot where its line would start, so you can see what to grab
    // (Eman, 8 Nov). KT2_PITCH_NO_DOTS = none.
    if (adv && S.tool === "pitch" && !window.KT2_PITCH_NO_DOTS) {
      for (const n of S.notes) {
        if (hasExpr(n) && advPts(n).length) continue;
        const r0 = rowOf(rows, n.pitch); if (r0 < 0 || r0 >= vis) continue;
        const x0 = OX + n.start * ppb, w = n.length * ppb; if (x0 + w < KEYS || w < 8) continue;
        const x = Math.max(KEYS + 5, x0 + Math.min(7, w / 2)), y = yOfPitch(rows, n.pitch);
        const picked1 = S.sel === n || (S.multi && S.multi.has(n)), r = picked1 ? 5 : 4;
        g.save(); g.globalAlpha = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = "#161618"; g.fill();
        g.lineWidth = 2; g.strokeStyle = ACID; g.stroke(); g.restore();
      }
    }
    // while dragging: what the hand is writing, next to the cursor
    if (S.advDrag && S.advDrag.label && S.advDrag.at) {
      const { x, y } = S.advDrag.at, txt = S.advDrag.label;
      g.save(); g.font = "700 11px " + cssVar("--font");
      const w = g.measureText(txt).width + 14, bx = Math.min(x + 14, S.pane.querySelector("#tmm-canvas").clientWidth - w - 4), by = Math.max(STRIP + 2, y - 30);
      g.fillStyle = "#141218"; g.fillRect(bx, by, w, 20);
      g.fillStyle = ACID; g.fillRect(bx, by, 2, 20);
      g.fillStyle = ACID; g.textBaseline = "middle"; g.fillText(txt, bx + 8, by + 10.5);
      g.restore();
    }
    // the wobbles keep moving on their own (30 times a second) when the song is stopped
    if (adv && anyWob && !playingNow && !S.raf && !S.advAnim && S.pane.isConnected) {
      S.advAnim = setTimeout(() => { S.advAnim = 0; const st = S; if (st && st.adv && st.pane.isConnected && st.pane.offsetParent) { const was = S; use(st.pane); draw(); if (was && was !== st) use(was.pane); } }, 33);
    }
  }

  // ---- the new wobble's picture (Eman, 8 Nov): inside each note's body, so it never crosses a pitch line.
  // The dark level rising from the bottom is the intensity over the note (top = full Depth); the thin
  // stripes in it are the wobble's own rhythm (one per cycle, so 1/16 vs 1/8 is seen); white squares are
  // the curve's points; the chip in the corner is the rate.
  function wobBox(n, rows, ppb, vis) {
    const r = rowOf(rows, n.pitch);
    if (r < 0 || r >= vis) return null;
    const x0 = OX + n.start * ppb, w = n.length * ppb, y = STRIP + r * ROW;
    return { x0, w, top: y + 2.5, bot: y + ROW - 2.5, H: ROW - 5, y };
  }
  const wobFocus = () => advOn() && S.tool === "wobble";
  const isPicked = (n) => S.sel === n || (S.multi && S.multi.has(n));
  function advWobDraw(g, rows, ppb, vis, beats) {
    const focus = wobFocus(), adv = advOn();
    for (const n of S.notes) {
      if (!(n.wob && n.wob.d > 0)) continue;
      const b = wobBox(n, rows, ppb, vis); if (!b) continue;
      const { x0, w, top, bot, H } = b;
      if (x0 + w < KEYS || x0 > OX + beats * ppb + 2 || w < 3) continue;
      const pk = isPicked(n) || (S.advDrag && S.advDrag.note === n), E = envOf(n.wob);
      const lvY = (u) => bot - H * envLevel(n.wob, u);
      g.save();
      g.beginPath(); g.rect(Math.max(x0, KEYS), top - 1, x0 + w - Math.max(x0, KEYS), H + 2); g.clip();
      // the level
      g.beginPath(); g.moveTo(x0, bot);
      for (let px = 0; px <= w; px += 2) g.lineTo(x0 + px, lvY(px / w));
      g.lineTo(x0 + w, lvY(1)); g.lineTo(x0 + w, bot); g.closePath();
      g.globalAlpha = 1; g.fillStyle = adv ? (focus || pk ? "rgba(14,12,22,0.66)" : "rgba(14,12,22,0.5)") : "rgba(14,12,22,0.4)"; g.fill();
      // the rhythm: one stripe per cycle, cut into the level
      const per = ppb / (n.wob.r || 2);
      if (per >= 3) {
        g.save(); g.clip();
        g.strokeStyle = focus || pk ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.2)"; g.lineWidth = 1; g.beginPath();
        for (let x = x0 + per; x < x0 + w - 0.5; x += per) { const xx = Math.round(x) + 0.5; g.moveTo(xx, bot); g.lineTo(xx, top); }
        g.stroke(); g.restore();
      }
      // the curve's edge
      g.beginPath(); g.moveTo(x0, lvY(0));
      for (let px = 2; px <= w; px += 2) g.lineTo(x0 + px, lvY(px / w));
      g.lineTo(x0 + w, lvY(1));
      g.strokeStyle = "#fff"; g.globalAlpha = adv ? (focus || pk ? 0.95 : 0.6) : 0.45; g.lineWidth = focus ? 1.5 : 1; g.stroke();
      g.restore();
      if (!focus) continue;
      // its points: white squares (the pitch line's points are round)
      g.save();
      E.forEach((p) => {
        const x = x0 + p[0] * w, y = bot - H * p[1], s2 = pk ? 3.5 : 2.5;
        if (x < KEYS - 4) return;
        g.fillStyle = "#141218"; g.fillRect(Math.round(x - s2 - 1), Math.round(y - s2 - 1), s2 * 2 + 2, s2 * 2 + 2);
        g.fillStyle = "#fff"; g.fillRect(Math.round(x - s2), Math.round(y - s2), s2 * 2, s2 * 2);
      });
      // the rate chip, top right inside the note
      const c = wobChip(n, b, g);
      if (c) {
        g.fillStyle = "rgba(20,18,26,0.92)"; g.fillRect(c.x, c.y, c.w, c.h);
        g.fillStyle = pk ? ACID : "#fff"; g.textBaseline = "middle"; g.fillText(c.txt, c.x + 3, c.y + c.h / 2 + 0.5);
      }
      g.restore();
    }
  }
  // EDGE DOTS: where each dot of a note's wobble curve sits, riding the top of the wave. A curve with only
  // its two ends gets a middle dot too (virtual until it's dragged: "v").
  function wobDotList(n, rows, ppb) {
    const E = wob3On() ? env3(n.wob) : envOf(n.wob), x0 = OX + n.start * ppb, w = n.length * ppb, d = n.wob.d || 0.5;
    const at = (u, lv) => ({ x: x0 + clampN(Math.min(5, w / 4), w - Math.min(5, w / 4), u * w), y: yOfPitch(rows, n.pitch + bendAt(n, u * n.length) + d * lv) });
    const out = E.map((p, i) => ({ i, u: p[0], ...at(p[0], p[1]) }));
    if (E.length === 2 && !wob3On()) out.splice(1, 0, { i: 1, v: true, u: 0.5, ...at(0.5, envLevel(n.wob, 0.5)) });
    return out;
  }
  function advWobDotsDraw(g, rows, ppb) {
    const yTop = STRIP, yBot = S.pane.querySelector("#tmm-canvas").clientHeight - FOOT;
    const drag = S.advDrag && S.advDrag.note, di = S.advDrag ? S.advDrag.dot : -1;
    g.save();
    for (const n of S.notes) {
      if (!(n.wob && n.wob.d > 0)) continue;
      const pk = isPicked(n) || drag === n;
      for (const p of wobDotList(n, rows, ppb)) {
        if (p.x < KEYS - 4 || p.y < yTop - 6 || p.y > yBot + 6) continue;
        const on = drag === n && di === p.i && !p.v, r = on ? 5 : pk ? 4 : 3;
        g.globalAlpha = pk ? 1 : 0.75;
        // acid yellow dots (Eman, 8 Nov 04:05); the one you hold gets a white ring. KT2_WOB_DOT_WHITE = old (white)
        const old = window.KT2_WOB_DOT_WHITE;
        g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fillStyle = old ? (on ? ACID : "#fff") : ACID; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = on && !old ? "#fff" : "#141416"; g.stroke();
      }
    }
    g.restore();
  }
  // where a note's rate chip sits (null when the note is too short to carry one)
  function wobChip(n, b, g) {
    const ctx = g || S.pane.querySelector("#tmm-canvas").getContext("2d");
    ctx.font = "700 8.5px " + cssVar("--font");
    const txt = rateName(n.wob.r || 2), tw = Math.ceil(ctx.measureText(txt).width) + 6, h = Math.min(11, b.H);
    if (b.w < tw + 24 || b.H < 8) return null;
    return { x: Math.round(b.x0 + b.w - tw - 9), y: Math.round(b.y + 2), w: tw, h, txt };
  }
  // what's under the mouse with WOBBLE on: a curve point ("pt"), a rate chip ("chip") or a note body ("body")
  function wobHitAt(m, rows, ppb, vis) {
    if (wobDots()) {   // EDGE DOTS: a dot ("pt", or "vpt" for a middle dot not yet made), else the note's wave ("body")
      let best = null, bd = 9;
      for (const n of S.notes) {
        if (!(n.wob && n.wob.d > 0)) continue;
        for (const p of wobDotList(n, rows, ppb)) {
          const d = Math.hypot(p.x - m.x, p.y - m.y);
          if (d < bd) { bd = d; best = { note: n, kind: p.v ? "vpt" : "pt", i: p.i, u: p.u, b: wobBox(n, rows, ppb, vis) }; }
        }
      }
      return best;
    }
    let best = null, bd = 8, chip = null;
    for (const n of S.notes) {
      if (!(n.wob && n.wob.d > 0)) continue;
      const b = wobBox(n, rows, ppb, vis); if (!b) continue;
      if (m.x < b.x0 - 8 || m.x > b.x0 + b.w + 8 || m.y < b.y - 6 || m.y > b.y + ROW + 6) continue;
      envOf(n.wob).forEach((p, i) => {
        const d = Math.hypot(b.x0 + p[0] * b.w - m.x, b.bot - b.H * p[1] - m.y);
        if (d < bd) { bd = d; best = { note: n, kind: "pt", i, b }; }
      });
      const c = wobChip(n, b);
      if (c && m.x >= c.x - 1 && m.x <= c.x + c.w + 1 && m.y >= c.y - 1 && m.y <= c.y + c.h + 1) chip = { note: n, kind: "chip", b };
    }
    // a square right under the mouse wins over the chip next to it
    return best && bd < 5 ? best : chip || best;
  }
  // WOBBLE (new): press a note = it gets a wobble (Rise, 1/16); press inside it = a new point of the curve
  // there, dragged up or down; press a square = drag it (sideways too). Every picked note gets the same curve.
  // Down to 0% everywhere = the wobble comes off (Eman, 8 Nov). Rate chip: click = next, right-click = back, scroll.
  function advWobEnvDown(e, h, rows, ppb, vis, cv, m) {
    const hp = wobHitAt(m, rows, ppb, vis);
    const sel = picked();
    if (hp && hp.kind === "chip") {
      const ns = sel.includes(hp.note) ? sel.filter((n) => n.wob && n.wob.d > 0) : [hp.note];
      const r0 = hp.note.wob.r || 2, r1 = WOB_RATES[clampN(0, WOB_RATES.length - 1, nearestRate(r0) + (e.button === 2 ? -1 : 1))];
      for (const n of ns) n.wob = { ...n.wob, r: r1 };
      draw(); advDock(); commit(); advHear(hp.note);
      return true;
    }
    if (e.button === 2) {   // right-click: a square goes; on a note body the wobble comes off
      if (hp && hp.kind === "pt") {
        if (wob3On()) return true;   // the three dots stay
        const E = envOf(hp.note.wob).map((p) => p.slice());
        if (E.length > 2) { E.splice(hp.i, 1); wobSetAll(hp.note, sel, E); draw(); commit(); advDock(); }
        return true;
      }
      const n = h.note || advNoteAt(h, rows);
      if (n) { for (const x of sel.includes(n) ? sel : [n]) delete x.wob; draw(); commit(); advDock(); }
      return true;
    }
    if (e.button !== 0) return true;
    let note = hp ? hp.note : h.note;
    if (!note) { const n = advNoteAt(h, rows); if (n && sel.includes(n)) note = n; }
    if (!note) return false;   // empty grid: picking box as usual
    const group = sel.includes(note) ? sel : [note];
    const prev = group.map((n) => JSON.stringify(n.wob || null));
    if (group.length === 1) { S.sel = note; S.multi = null; } else { S.sel = null; S.multi = new Set(group); }
    // a note without a wobble: it gets one (and so does every picked note without one)
    let fresh = false;
    for (const n of group) if (!(n.wob && n.wob.d > 0)) { n.wob = newWob(); if (n === note) fresh = true; }
    const b = wobBox(note, rows, ppb, vis);
    const E = wob3On() ? env3(note.wob) : envOf(note.wob).map((p) => p.slice());
    let i = hp && hp.kind === "pt" ? hp.i : -1, inserted = false;
    if (wob3On()) {   // the nearest of the 3 dots (a dot under the hand, or the part of the wave you pressed)
      if (i < 0 && b && !fresh) { const u = clampN(0, 1, (m.x - b.x0) / b.w); i = u < 0.25 ? 0 : u > 0.75 ? 2 : 1; }
    } else if (hp && hp.kind === "vpt") {   // the middle dot of a two-point curve: it becomes a real point once dragged
      i = 1; E.splice(1, 0, [0.5, +envLevel(note.wob, 0.5).toFixed(3)]); inserted = true;
    } else if (i < 0 && b) {   // a new point where you pressed, on the curve (taken back if the press doesn't move)
      const u = +clampN(0, 1, (m.x - b.x0) / b.w).toFixed(3);
      const near = E.findIndex((p) => Math.abs(p[0] - u) * b.w < 6);
      if (near >= 0) i = near;
      else { const lv = +envLevel(note.wob, u).toFixed(3); i = E.findIndex((p) => p[0] > u); if (i < 0) i = E.length; E.splice(i, 0, [u, lv]); inserted = true; }
    }
    const before = E.map((p) => p.slice());
    if (inserted) E.splice(i, 1);   // shown only once the hand moves
    note.wob = { ...note.wob, e: E }; delete note.wob.f;
    wobSetAll(note, group, E);
    let moved = false;
    const label = () => { const E2 = envOf(note.wob); return envOff(E2) ? "OFF" : i >= 0 && moved ? `${Math.round(E2[i][1] * 100)}% \u00b7 ${rateName(note.wob.r)}` : `${envName(note.wob)} \u00b7 ${rateName(note.wob.r)}`; };
    S.advDrag = { note, label: label(), at: m };
    advDock(); draw();
    if (i < 0) {   // a fresh wobble: nothing to drag
      const up0 = () => { window.removeEventListener("mouseup", up0); S.advDrag = null; draw(); commit(); advHear(note); };
      window.addEventListener("mouseup", up0);
      return true;
    }
    const y0 = m.y, x0m = m.x, l0 = before[i][1], u0 = before[i][0];
    const move = (ev) => {
      const mm = local(cv, ev);
      if (!moved && Math.hypot(mm.x - x0m, mm.y - y0) < 3) return;
      moved = true;
      const E2 = before.map((p) => p.slice());
      // up and down: the level (about 4 rows for the whole range, finer than the 22 px of the note)
      E2[i][1] = +clampN(0, 1, l0 + (y0 - mm.y) / 90).toFixed(3);
      // sideways: the point moves between its neighbours (the first and last stay at the note's ends);
      // Alt = free, else on the grid
      if (b && i > 0 && i < E2.length - 1 && !wob3On()) {
        let u = u0 + (inserted ? 0 : (mm.x - x0m) / b.w);
        if (!ev.altKey) { const beat = u * note.length, g = Math.round(beat / S.grid) * S.grid; u = g / note.length; }
        E2[i][0] = +clampN(E2[i - 1][0] + 0.001, E2[i + 1][0] - 0.001, u).toFixed(3);
      }
      wobSetAll(note, group, E2);
      S.advDrag.label = label(); S.advDrag.at = mm; queueDraw();
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      S.advDrag = null;
      // everything at 0%: the wobble is off (Eman, 8 Nov)
      if (envOff(envOf(note.wob))) for (const n of group) delete n.wob;
      draw(); advDock();
      if (group.some((n, k) => JSON.stringify(n.wob || null) !== prev[k])) { commit(); if (note.wob) advHear(note); }
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return true;
  }
  // the same curve on every note of the group (it's in parts of the note, so it fits any length)
  function wobSetAll(lead, group, E) {
    for (const n of group) { if (!n.wob) n.wob = newWob(); n.wob = { ...n.wob, e: E.map((p) => p.slice()) }; delete n.wob.f; }
  }
  // double-click a square: it goes (and double-click never takes the note away while WOBBLE is on)
  function advWobDbl(e) {
    if (!wobEnvOn() || !wobFocus()) return false;
    const { rows, ppb, cv } = geom(), hp = wobHitAt(local(cv, e), rows, ppb, 999);
    // double-click a dot: back to its default, full wobble (100%), like velocity goes back to 100 (Eman, 10 Nov).
    // The picked notes get the same curve. KT2_DBL_RESET_OFF = old (the dot goes away)
    if (hp && hp.kind === "pt" && !window.KT2_DBL_RESET_OFF) {
      const E = wob3On() ? env3(hp.note.wob) : envOf(hp.note.wob).map((p) => p.slice());
      if (E[hp.i] && E[hp.i][1] !== 1) { E[hp.i][1] = 1; const sel = picked(); wobSetAll(hp.note, sel.includes(hp.note) ? sel : [hp.note], E); draw(); commit(); advDock(); advHear(hp.note); }
      return true;
    }
    if (hp && hp.kind === "pt") {
      const E = envOf(hp.note.wob).map((p) => p.slice());
      if (E.length > 2 && hp.i > 0 && hp.i < E.length - 1) { E.splice(hp.i, 1); const sel = picked(); wobSetAll(hp.note, sel.includes(hp.note) ? sel : [hp.note], E); draw(); commit(); advDock(); }
    }
    return true;
  }
  // PITCH: double-click a dot of a pitch line and it goes back onto the note's own pitch (keeps its time); a line
  // that ends up flat on the note goes away. Double-click the bend handle in the middle: straight again.
  // Several picked notes: their matching dots reset together. Works in every tool (MOVE too) while the dots show.
  // (Eman, 10 Nov: "double clicking on a dot ... resets to default position"). KT2_DBL_RESET_OFF = old (nothing)
  function advPitchDbl(e) {
    if (window.KT2_DBL_RESET_OFF || !advOn() || S.tool === "wobble") return false;
    const { rows, ppb, cv } = geom(), hp = advHandleAt(local(cv, e), rows, ppb);
    if (!hp) return false;
    const ps = picked(), LP = advPts(hp.note), last = hp.i === LP.length - 1, first = hp.i === 0;
    const group = ps.length >= 2 && ps.includes(hp.note) && !window.KT2_PITCH_MULTI_OFF ? ps : [hp.note];
    let changed = false;
    for (const n of group) {
      const P = advPts(n); if (!P.length) continue;
      const i = n === hp.note ? hp.i : last ? P.length - 1 : first ? 0 : hp.i;
      if (!P[i]) continue;
      const before = JSON.stringify(n.bend || null);
      if (hp.kind === "curve") { if (P[i].length > 2) P[i].length = 2; }
      else P[i][1] = 0;
      advTidy(n);
      if (JSON.stringify(n.bend || null) !== before) changed = true;
    }
    if (changed) { draw(); commit(); advHear(hp.note); }
    return true;
  }
  // scroll on a rate chip: faster / slower
  function advWobWheel(e) {
    if (!wobEnvOn() || !wobFocus()) return false;
    const { rows, ppb, cv } = geom(), hp = wobHitAt(local(cv, e), rows, ppb, 999);
    if (!hp || hp.kind !== "chip") return false;
    const sel = picked(), ns = sel.includes(hp.note) ? sel.filter((n) => n.wob && n.wob.d > 0) : [hp.note];
    const r1 = WOB_RATES[clampN(0, WOB_RATES.length - 1, nearestRate(hp.note.wob.r || 2) + (e.deltaY < 0 ? 1 : -1))];
    for (const n of ns) n.wob = { ...n.wob, r: r1 };
    draw(); advDock(); clearTimeout(S.advWheelT); S.advWheelT = setTimeout(() => commit(), 350);
    return true;
  }

  // ---- the hand
  // the note a press belongs to when it isn't on one: the picked note, else a note spanning that beat (nearest row)
  function advNoteAt(h, rows) {
    const ps = picked();
    if (ps.length === 1) return ps[0];
    const span = S.notes.filter((n) => h.beat >= n.start - 1e-6 && h.beat <= n.start + n.length + 1e-6);
    if (span.length) return span.reduce((b, n) => (Math.abs(n.pitch - h.pitch) < Math.abs(b.pitch - h.pitch) ? n : b));
    // nothing under that beat: the nearest note in time, up to two beats away (a line can start before its note)
    const near = S.notes.map((n) => ({ n, d: h.beat < n.start ? n.start - h.beat : h.beat - (n.start + n.length) })).filter((x) => x.d <= 2).sort((a, b) => a.d - b.d);
    return near.length ? near[0].n : null;
  }
  // a handle under the mouse: a point of a pitch line ("pt"), or the bend handle in the middle of a stretch ("curve", picked notes)
  function advHandleAt(m, rows, ppb, list) {
    // a picked note's own points come first: where its start dot sits on the end dot of the note before it,
    // pressing there always takes the picked note's dot (Eman, 8 Nov). KT2_PITCH_PICK_FIRST_OFF = nearest wins.
    if (!list && !window.KT2_PITCH_PICK_FIRST_OFF) { const ps = picked(); if (ps.length) { const h = advHandleAt(m, rows, ppb, ps); if (h) return h; } }
    let best = null, bd = 9;
    for (const n of list || S.notes) {
      const P = advPts(n); if (!P.length) continue;
      const x0 = OX + n.start * ppb, picked1 = S.sel === n || (S.multi && S.multi.has(n));
      P.forEach((p, i) => {
        const d = Math.hypot(x0 + p[0] * ppb - m.x, yOfPitch(rows, n.pitch + p[1]) - m.y);
        if (d < bd) { bd = d; best = { note: n, i, kind: "pt" }; }
        if (picked1 && i + 1 < P.length && P[i + 1][0] - p[0] > 1e-6) {
          const tm = p[0] + (P[i + 1][0] - p[0]) / 2, dc = Math.hypot(x0 + tm * ppb - m.x, yOfPitch(rows, n.pitch + bendAt(n, tm)) - m.y);
          if (dc < bd) { bd = dc; best = { note: n, i, kind: "curve" }; }
        }
      });
    }
    return best;
  }
  function advDown(e, h) {
    if (!advOn()) return false;
    const { rows, ppb, beats, cv } = geom(), vis = 999, m = local(cv, e);
    if (S.tool === "wobble" && wobEnvOn() && !(e.metaKey || e.ctrlKey || e.shiftKey)) return advWobEnvDown(e, h, rows, ppb, vis, cv, m);
    let hp = advHandleAt(m, rows, ppb);
    // the picked note's own start dot (no line yet) wins over another note's point sitting on it
    if (hp && S.tool === "pitch" && !window.KT2_PITCH_PICK_FIRST_OFF && startFree() && !picked().includes(hp.note) && picked().length && advDotAt(m, rows, ppb, picked())) hp = null;
    if (hp && e.button === 0 && !e.metaKey && !e.ctrlKey) {
      // a point of one of several picked notes: the same point moves on all of them, to the same note (KT2_PITCH_MULTI_OFF = only that one)
      const ps = picked();
      if (hp.kind === "pt" && ps.length >= 2 && ps.includes(hp.note) && !window.KT2_PITCH_MULTI_OFF) { advDragHandleMulti(e, hp, ps, rows, ppb, cv); return true; }
      advDragHandle(e, hp, rows, ppb, cv); return true;
    }
    if (hp && e.button === 2) {   // right-click a point: it goes (a line needs two)
      const P = advPts(hp.note); P.splice(hp.i, 1); if (P.length < 2) delete hp.note.bend; else advEndHome(P, [[0, 0]]);
      draw(); commit(); return true;
    }
    const tool = S.tool || "move";
    if (tool === "move") return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return false;   // picking boxes still work in every tool
    if (e.button === 2) {   // right-click with a tool: that kind of expression comes off the note
      const n = h.note || advNoteAt(h, rows);
      if (n) { if (tool === "pitch") delete n.bend; else delete n.wob; draw(); commit(); advDock(); }
      return true;
    }
    if (e.button !== 0) return true;
    if (tool === "pitch") return advPitchDown(e, h, rows, ppb, beats, cv, m);
    if (tool === "wobble") return advWobbleDown(e, h, rows, cv);
    return false;
  }
  // PITCH: a line from where you press to where you let go, on the note under the hand (or the picked one,
  // or the note spanning that beat). Press near a line's last point to carry on from it. Time snaps to the
  // grid (Alt: free), pitch to the rows (Shift: between them).
  function advPitchDown(e, h, rows, ppb, beats, cv, m) {
    const sel = picked();
    // press ON a pitch line (anywhere along it, or on the flat hold after its last point): a new point goes in
    // right there and follows the mouse, so one line can go up, down and up again (Eman, 8 Nov recorder note:
    // "several dots inside a pitch ... without it bugging"; before, pressing the line threw it away and started
    // a new one). KT2_PITCH_ADDPT_OFF = old.
    if (!window.KT2_PITCH_ADDPT_OFF) { const hit = advLineAt(m, rows, ppb); if (hit) return advInsertPoint(e, hit, sel, rows, ppb, cv); }
    // press the start dot of a note with no line and drag UP or DOWN: the line starts on another note and comes
    // back to the note at its end (Eman, 8 Nov). Sideways or diagonal: the slide out as before.
    if (startFree() && !e._dotDone) { const dn = advDotAt(m, rows, ppb); if (dn) return advDotDown(e, dn, h, rows, ppb, beats, cv, m); }
    const note = h.note || (sel.length === 1 ? sel[0] : null) || advNoteAt(h, rows);
    if (!note) return true;
    if (sel.length >= 2 && sel.includes(note)) {
      if (window.KT2_PITCH_MULTI_OFF) { advBetween(sel); return true; }
      return advPitchMulti(e, note, sel, rows, ppb, cv, m);
    }
    // a press on the body of a note that already has a pitch line, later than the line's first point, adds a
    // point to that line there (bug check as 50 users, 8 Nov: pressing the note itself, not exactly on the
    // line, threw the whole line away and started a new one; people press the note). A press on the line's
    // last point still carries on from it. KT2_PITCH_BODY_NEWLINE = old.
    if (!window.KT2_PITCH_BODY_NEWLINE && !window.KT2_PITCH_ADDPT_OFF && h.note === note) {
      const P0 = advPts(note), t = (m.x - OX) / ppb - note.start, lastP = P0[P0.length - 1];
      const nearLast = lastP && Math.hypot(OX + (note.start + lastP[0]) * ppb - m.x, yOfPitch(rows, note.pitch + lastP[1]) - m.y) < 16;
      if (P0.length >= 2 && t > P0[0][0] + 1e-6 && t <= note.length + 1e-6 && !nearLast) return advInsertPoint(e, { note, t }, sel, rows, ppb, cv);
    }
    const rel = (mm, ev) => {
      const b = (mm.x - OX) / ppb, snapped = ev.altKey ? b : Math.round(b / S.grid) * S.grid;
      const t = clampN(0, note.length, snapped - note.start), p = pitchAtY(rows, mm.y, ev.shiftKey);
      return [+t.toFixed(4), +(p - note.pitch).toFixed(2)];
    };
    const P = advPts(note), last = P.length ? P[P.length - 1] : null;
    const append = !!last && Math.hypot(OX + (note.start + last[0]) * ppb - m.x, yOfPitch(rows, note.pitch + last[1]) - m.y) < 16;
    // the line starts ON the note, at its own pitch (Eman, 8 Nov: it could float off below the notes);
    // you only pick where it goes. KT2_PITCH_FREE_START = old (start wherever you press, either way in time)
    const anchor = !window.KT2_PITCH_FREE_START;
    let A = append ? last.slice(0, 2) : rel(m, e);
    if (anchor && !append) A = [A[0], 0];
    const base = append ? P.slice() : null, prev = JSON.stringify(note.bend || null);
    S.sel = note; S.multi = null;
    S.advDrag = { note, label: advLabel(note, A), at: m };
    const apply = (B) => {
      if (append) { note.bend = base.concat([B]).map((p) => p.slice()); advEndHome(note.bend, base); }
      else if (anchor) note.bend = [A, [Math.max(A[0], B[0]), B[1]]];
      else note.bend = B[0] >= A[0] ? [A, B] : [B, A];   // dragged back in time: the line still runs forward
    };
    apply(A.slice());
    let moved = false;
    const move = (ev) => { const mm = local(cv, ev), B = rel(mm, ev); if (Math.abs(B[0] - A[0]) > 1e-6 || Math.abs(B[1] - A[1]) > 1e-6) moved = true; apply(B); S.advDrag.label = advLabel(note, B); S.advDrag.at = mm; queueDraw(); };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      S.advDrag = null;
      if (!moved) { if (prev === "null") delete note.bend; else note.bend = JSON.parse(prev); draw(); return; }   // a click: nothing written
      // two points at the same time and pitch say nothing: drop the double
      note.bend = note.bend.filter((p, i, a) => !i || Math.abs(p[0] - a[i - 1][0]) > 1e-6 || Math.abs(p[1] - a[i - 1][1]) > 1e-6);
      if (note.bend.length < 2) delete note.bend;
      draw();
      if (JSON.stringify(note.bend || null) !== prev) { commit(); advHear(note); }
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return true;
  }
  // the start dot can go up/down too (Eman, 8 Nov): a line that starts off the note's pitch and does not already
  // end on it gets a point at the note's end, back on the note. So a line starts on the note or ends on it.
  // KT2_PITCH_START_LOCK = old (start dot stays on the note's pitch).
  const startFree = () => !window.KT2_PITCH_START_LOCK && !window.KT2_PITCH_FREE_START;
  function advStartTo(P, base, len, t, off) {
    const out = [[t, off].concat(base[0].length > 2 ? [base[0][2]] : [])].concat(base.slice(1).map((p) => p.slice()));
    const L = out[out.length - 1];
    if (Math.abs(off) > 1e-6 && Math.abs(L[1]) > 1e-6) { if (L[0] < len - 1e-6) out.push([+len.toFixed(4), 0]); else L[1] = 0; }
    P.length = 0; out.forEach((p) => P.push(p));
  }
  // a line never floats free of its note (Eman, 8 Nov: "it always needs to either start or end on the note"):
  // when the LAST point is off the note, the start goes back on it; when the last comes home, the start is restored
  function advEndHome(P, base) {
    if (!startFree() || P.length < 2) return;
    P[0][1] = Math.abs(P[P.length - 1][1]) > 1e-6 ? 0 : base[0][1];
  }
  // the dot drawn at the start of a note with no line (PITCH tool), under the mouse
  function advDotAt(m, rows, ppb, list) {
    if (window.KT2_PITCH_NO_DOTS) return null;
    if (!list && !window.KT2_PITCH_PICK_FIRST_OFF) { const ps = picked(); if (ps.length) { const d = advDotAt(m, rows, ppb, ps); if (d) return d; } }
    let best = null, bd = 8;
    for (const n of list || S.notes) {
      if (advPts(n).length) continue;
      const x0 = OX + n.start * ppb, w = n.length * ppb; if (x0 + w < KEYS || w < 8) continue;
      const d = Math.hypot(Math.max(KEYS + 5, x0 + Math.min(7, w / 2)) - m.x, yOfPitch(rows, n.pitch) - m.y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  function advDotDown(e, n, h, rows, ppb, beats, cv, m) {
    const off = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", off); };
    const mv = (ev) => {
      const mm = local(cv, ev), dx = Math.abs(mm.x - m.x), dy = Math.abs(mm.y - m.y);
      if (Math.max(dx, dy) < 5) return;
      off();
      if (dy > dx * 2) { n.bend = [[0, 0]]; advDragHandle(e, { note: n, i: 0, kind: "pt" }, rows, ppb, cv, "null"); }
      else { e._dotDone = 1; advPitchDown(e, h, rows, ppb, beats, cv, m); }
      window.dispatchEvent(new MouseEvent("mousemove", { buttons: 1, clientX: ev.clientX, clientY: ev.clientY, shiftKey: ev.shiftKey, altKey: ev.altKey }));
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", off);
    return true;
  }
  // the pitch line under the mouse (not on one of its points): which note, and how far into it (beats)
  function advLineAt(m, rows, ppb) {
    let best = null, bd = 8;
    for (const n of S.notes) {
      const P = advPts(n); if (P.length < 2) continue;
      const x0 = OX + n.start * ppb, t = (m.x - x0) / ppb;
      if (t < P[0][0] - 1e-6 || t > n.length + 1e-6) continue;
      const d = Math.abs(yOfPitch(rows, n.pitch + bendAt(n, t)) - m.y);
      if (d < bd) { bd = d; best = { note: n, t }; }
    }
    return best;
  }
  // put a point into the line at t (snapped to the grid, Alt: free) where the line already is, then drag it.
  // Several picked notes with lines: each gets its point at the same time, and they move together.
  function advInsertPoint(e, hit, sel, rows, ppb, cv) {
    const snapT = (n) => { const b = n.start + hit.t, sn = e.altKey ? b : Math.round(b / S.grid) * S.grid; return +clampN(0, n.length, sn - n.start).toFixed(4); };
    const put = (n) => {
      const P = advPts(n), t = Math.max(P[0][0], snapT(n));
      let k = P.length; while (k > 0 && P[k - 1][0] > t + 1e-6) k--;
      const pt = [t, +bendAt(n, t).toFixed(2)];
      const prevPt = P[k - 1];
      if (prevPt && prevPt.length > 2) { pt.push(prevPt[2]); }   // the bent stretch stays bent on both sides
      P.splice(k, 0, pt);
      return k;
    };
    const lead = hit.note, multi = sel.length >= 2 && sel.includes(lead) && !window.KT2_PITCH_MULTI_OFF;
    const prevAll = new Map((multi ? sel : [lead]).map((n) => [n, JSON.stringify(n.bend || null)]));
    const i = put(lead);
    if (multi) for (const n of sel) if (n !== lead && advPts(n).length >= 2) put(n);
    const hp = { note: lead, i, kind: "pt" };
    if (multi) advDragHandleMulti(e, hp, sel, rows, ppb, cv, prevAll); else advDragHandle(e, hp, rows, ppb, cv, prevAll.get(lead));
    return true;
  }
  // PITCH with several notes picked (Eman, 8 Nov): press one of them and drag to a note; every picked note
  // gets the same line shape in time and ends on that same note. Each one starts from its own pitch.
  function advPitchMulti(e, lead, sel, rows, ppb, cv, m) {
    const relT = (mm, ev) => { const b = (mm.x - OX) / ppb, snapped = ev.altKey ? b : Math.round(b / S.grid) * S.grid; return +clampN(0, lead.length, snapped - lead.start).toFixed(4); };
    const anchor = !window.KT2_PITCH_FREE_START;
    const t0 = relT(m, e), a1 = anchor ? 0 : +(pitchAtY(rows, m.y, e.shiftKey) - lead.pitch).toFixed(2);
    const prev = sel.map((n) => JSON.stringify(n.bend || null));
    S.sel = null; S.multi = new Set(sel);
    S.advDrag = { note: lead, label: "", at: m };
    const apply = (t1, target) => {
      for (const n of sel) {
        const ta = +Math.min(t0, n.length).toFixed(4), tb = +Math.min(t1, n.length).toFixed(4);
        const A = [ta, a1], B = [tb, +(target - n.pitch).toFixed(2)];
        n.bend = anchor ? [A, [Math.max(ta, tb), B[1]]] : tb >= ta ? [A, B] : [B, A];
      }
    };
    let moved = false, lastT = t0, lastP = lead.pitch + a1;
    apply(t0, lastP);
    S.advDrag.label = advLabel(lead, [t0, a1]);
    const move = (ev) => {
      const mm = local(cv, ev), t1 = relT(mm, ev), p = pitchAtY(rows, mm.y, ev.shiftKey);
      if (Math.abs(t1 - t0) > 1e-6 || Math.abs(p - lead.pitch - a1) > 1e-6) moved = true;
      lastT = t1; lastP = p; apply(t1, p);
      S.advDrag.label = advLabel(lead, [t1, +(p - lead.pitch).toFixed(2)]); S.advDrag.at = mm; queueDraw();
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      S.advDrag = null;
      if (!moved) { sel.forEach((n, i) => { if (prev[i] === "null") delete n.bend; else n.bend = JSON.parse(prev[i]); }); draw(); return; }   // a click: nothing written
      for (const n of sel) {
        n.bend = n.bend.filter((p, i, a) => !i || Math.abs(p[0] - a[i - 1][0]) > 1e-6 || Math.abs(p[1] - a[i - 1][1]) > 1e-6);
        if (n.bend.length < 2) delete n.bend;
      }
      draw();
      if (sel.some((n, i) => JSON.stringify(n.bend || null) !== prev[i])) { commit(); advHear(lead); }
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return true;
  }
  // a point of a line is dragged (between its neighbours, inside the note); the middle handle bends the stretch
  // so the line passes through where you drag it
  function advDragHandle(e, hp, rows, ppb, cv, prevIn) {
    const { note, i, kind } = hp, P = advPts(note), prev = prevIn !== undefined ? prevIn : JSON.stringify(note.bend);
    const base = P.map((p) => p.slice()), free0 = kind === "pt" && i === 0 && startFree(), x00 = local(cv, e).x;
    S.sel = note; S.multi = null; S.advDrag = { note, label: "", at: local(cv, e) };
    const move = (ev) => {
      const mm = local(cv, ev), b = (mm.x - OX) / ppb;
      if (kind === "pt") {
        const snapped = ev.altKey ? b : Math.round(b / S.grid) * S.grid;
        const lo = i > 0 ? P[i - 1][0] : 0, hi = i + 1 < P.length ? P[i + 1][0] : note.length;
        P[i][0] = +clampN(lo, hi, clampN(0, note.length, snapped - note.start)).toFixed(4);
        if (free0) {   // the start moves by how far you drag (grid steps), so pressing the dot does not jump it
          const db = (mm.x - x00) / ppb, t0 = base[0][0] + (ev.altKey ? db : Math.round(db / S.grid) * S.grid);
          advStartTo(P, base, note.length, +clampN(0, hi, t0).toFixed(4), +(pitchAtY(rows, mm.y, ev.shiftKey) - note.pitch).toFixed(2));
        }
        else {
          P[i][1] = i === 0 && !window.KT2_PITCH_FREE_START ? 0 : +(pitchAtY(rows, mm.y, ev.shiftKey) - note.pitch).toFixed(2);
          if (i > 0 && i === P.length - 1) advEndHome(P, base);
        }
        S.advDrag.label = advLabel(note, P[i]);
      } else {
        const a = P[i], q = P[i + 1], p = pitchAtY(rows, mm.y, true) - note.pitch;
        const v = clampN(0.04, 0.96, (p - a[1]) / ((q[1] - a[1]) || 1e-6));   // where the middle of the stretch should sit
        const c = +clampN(0.25, 4, Math.log(v) / Math.log(0.5)).toFixed(2);
        if (c === 1) a.length = 2; else a[2] = c;
        S.advDrag.label = c > 1.05 ? "slow, then fast" : c < 0.95 ? "fast, then slow" : "straight";
      }
      S.advDrag.at = mm; queueDraw();
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      S.advDrag = null;
      if (prevIn !== undefined || free0) advTidy(note);
      draw();
      if (JSON.stringify(note.bend || null) !== prev) { commit(); advHear(note); }
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }
  // a new point that ended on top of its neighbour (same time and pitch) says nothing: it goes again
  function advTidy(n) {
    if (!Array.isArray(n.bend)) return;
    n.bend = n.bend.filter((p, i, a) => !i || Math.abs(p[0] - a[i - 1][0]) > 1e-6 || Math.abs(p[1] - a[i - 1][1]) > 1e-6);
    if (n.bend.length < 2 || (startFree() && n.bend.every((p) => Math.abs(p[1]) < 1e-6))) delete n.bend;   // flat on the note: no line
  }
  function advDragHandleMulti(e, hp, sel, rows, ppb, cv, prevMap) {
    const lead = hp.note, LP = advPts(lead), last = hp.i === LP.length - 1, first = hp.i === 0;
    // each picked note's matching point: first to first, last to last, otherwise the same number
    const items = sel.map((n) => { const P = advPts(n); if (!P.length) return null; const i = last ? P.length - 1 : first ? 0 : hp.i; return i < P.length ? { n, P, i } : null; }).filter(Boolean);
    const prev = items.map((x) => (prevMap && prevMap.has(x.n) ? prevMap.get(x.n) : JSON.stringify(x.n.bend)));
    const free0 = first && startFree(); items.forEach((x) => { x.base = x.P.map((p) => p.slice()); });
    S.sel = null; S.multi = new Set(sel); S.advDrag = { note: lead, label: "", at: local(cv, e) };
    const move = (ev) => {
      const mm = local(cv, ev), b = (mm.x - OX) / ppb, snapped = ev.altKey ? b : Math.round(b / S.grid) * S.grid;
      const t = snapped - lead.start, p = pitchAtY(rows, mm.y, ev.shiftKey);
      for (const { n, P, i, base } of items) {
        const lo = i > 0 ? P[i - 1][0] : 0, hi = i + 1 < P.length ? P[i + 1][0] : n.length;
        P[i][0] = +clampN(lo, hi, clampN(0, n.length, t)).toFixed(4);
        if (free0) advStartTo(P, base, n.length, P[0][0], +(p - n.pitch).toFixed(2));
        else {
          P[i][1] = i === 0 && !window.KT2_PITCH_FREE_START ? 0 : +(p - n.pitch).toFixed(2);
          if (i > 0 && i === P.length - 1) advEndHome(P, base);
        }
      }
      S.advDrag.label = advLabel(lead, LP[hp.i]); S.advDrag.at = mm; queueDraw();
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      S.advDrag = null;
      if (prevMap || free0) items.forEach((x) => advTidy(x.n));
      draw();
      if (items.some((x, k) => JSON.stringify(x.n.bend || null) !== prev[k])) { commit(); advHear(lead); }
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }
  // WOBBLE: press a note (or the picked notes) and drag: up = deeper, down = shallower, sideways = faster or slower.
  function advWobbleDown(e, h, rows, cv) {
    const sel = picked();
    let targets = h.note ? (sel.includes(h.note) ? sel : [h.note]) : sel.length ? sel : [];
    if (!targets.length) { const n = advNoteAt(h, rows); if (n) targets = [n]; }
    if (!targets.length) return true;
    const base = targets.map((n) => ({ n, w: { ...WOB_DEF, ...(n.wob || {}) }, prev: JSON.stringify(n.wob || null) }));
    for (const b of base) b.n.wob = { ...b.w };
    if (targets.length === 1) { S.sel = targets[0]; S.multi = null; } else { S.sel = null; S.multi = new Set(targets); }
    const x0 = e.clientX, y0 = e.clientY;
    S.advDrag = { note: targets[0], label: `${targets[0].wob.d} st \u00b7 ${rateName(targets[0].wob.r)}`, at: local(cv, e) };
    advDock(); draw();
    const move = (ev) => {
      const dy = y0 - ev.clientY, dx = ev.clientX - x0;
      for (const b of base) b.n.wob = { ...b.w, d: +clampN(0.05, 12, b.w.d + dy / ROW * 0.5).toFixed(2), r: WOB_RATES[clampN(0, WOB_RATES.length - 1, nearestRate(b.w.r) + Math.round(dx / 36))] };
      S.advDrag.label = `${targets[0].wob.d} st \u00b7 ${rateName(targets[0].wob.r)}`; S.advDrag.at = local(cv, ev);
      advDock(); queueDraw();
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      S.advDrag = null; draw(); advDock();
      if (base.some((b) => JSON.stringify(b.n.wob || null) !== b.prev)) { commit(); advHear(targets[0]); }
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return true;
  }
  // would advBetween build anything for these notes? (a chord, all starting together, would not)
  function advBetweenOk(ns) {
    const list = [...ns].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    for (let i = 0; i + 1 < list.length; i++) { const a = list[i], b = list[i + 1]; if (b.start > a.start + 1e-6 && b.start - (a.start + a.length) <= 2) return true; }
    return false;
  }
  // two (or more) picked notes: each one glides into the next over its last stretch, and reaches it
  function advBetween(ns) {
    const list = [...ns].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    let did = 0;
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1];
      if (b.start <= a.start + 1e-6) continue;
      const gap = b.start - (a.start + a.length);
      if (gap > 2) continue;   // too far apart to be one line
      a.length = +Math.max(S.grid, b.start - a.start).toFixed(4);   // it reaches the next note exactly
      const glide = Math.min(a.length / 2, Math.max(S.grid, 0.5));
      a.bend = [[+(a.length - glide).toFixed(4), 0], [a.length, +(b.pitch - a.pitch).toFixed(2)]];
      did++;
    }
    if (!did) return toast("Pick two notes, one after the other, to build a pitch between them.");
    S.multi = new Set(list); S.sel = null;
    draw(); commit(); advHear(list[0]);
  }
  // hear the spot: from half a beat before the note, for its length and a little tail (while the song is stopped)
  let advHearT = 0;
  function advHear(n) {
    const c = findClip(S.clipId);
    if (!c || !n || (ui.transport && ui.transport.playing)) return;
    const spb = secPerBeat(), t = c.start + Math.max(0, n.start - 0.5) * spb;
    clearTimeout(advHearT);
    setTimeout(() => run("setPosition", { time: t }).then(() => (ui.transport.playing ? null : run("togglePlay"))), S.pending ? 80 : 0);
    advHearT = setTimeout(() => { if (ui.transport.playing) run("togglePlay"); }, Math.min(6000, (n.length + 0.5) * spb * 1000 + 900));
  }
  window.TmAdvanced = { on: () => advOn(), set: (on) => advMode(on), tool: (t) => advTool(t), bendAt, wobAt, soundAt, between: () => advBetween(picked()) };

  // The mouse in the canvas's own pixels. The big window is zoomed (0.8), so screen pixels and
  // canvas pixels differ; without this every click landed left of and above the cursor (Eman, 31 Oct).
  function local(cv, e, rect) {
    rect = rect || cv.getBoundingClientRect();
    const sx = rect.width ? cv.clientWidth / rect.width : 1, sy = rect.height ? cv.clientHeight / rect.height : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }
  function hit(e) {
    const { cv, ppb, rows } = geom();
    const { x, y } = local(cv, e);
    const beat = (x - OX) / ppb, ri = Math.floor((y - STRIP) / ROW) + S.top;
    const pitch = y < STRIP || (FOOT && y > cv.clientHeight - FOOT) ? null : rows[ri] != null ? rows[ri] : null;
    const note = pitch == null ? null : [...S.notes].reverse().find((n) => rowOf(rows, n.pitch) + S.top === ri && beat >= n.start && beat <= n.start + n.length);
    const nw = note ? note.length * ppb : 0, nearEnd = note && (OX + (note.start + note.length) * ppb) - x < Math.max(4, Math.min(10, nw * 0.25, nw - 6));   // V2n: easier to grab (Eman, 4 Nov 23:23)
    return { x, beat, pitch, note, nearEnd };
  }

  // a write answered: take the song's notes now if an update (an Undo) was skipped while it was on its way (see show)
  function resync(o) {
    if (!o || o.pending || !o.missedSync || !o.pane || !o.pane.isConnected) return;
    o.missedSync = false;
    setTimeout(() => { if (!o.pending && o.pane.isConnected) { const was = S; show(o.pane, o.trackId, o.clipId); if (was && was !== o) use(was.pane); } }, 0);
  }
  function commit() {
    if (!S || !S.clipId) return;
    S.pending++; S.pendingAt = Date.now();
    // out of key while ONLY KEY is on: kept, but muted (Eman, 31 Oct). Only a note you add or move
    // gets muted this way (Eman, 7 Nov: a bass went silent); a note that was already there keeps
    // playing until ONLY KEY, the key or the scale is switched (rekey), and an in-key note always
    // comes back. TMM_MUTE_ALL_ON_COMMIT = old (every commit muted every out-of-key note).
    const rekey = !!S.rekey; S.rekey = false;
    const mute = (n) => !rowOpen(n.pitch) && (window.TMM_MUTE_ALL_ON_COMMIT || rekey || n._op == null || n._op !== n.pitch || !!n.muted);
    const out = (ns) => ns.map((n) => { const { pitch, start, length, velocity, slide, slideFrom, group, locked, pull, pullAt, bend, wob } = n; return { pitch, start, length, velocity: velocity || 100, ...(slide ? { slide: true } : {}), ...(slide && slideFrom != null ? { slideFrom } : {}), ...(group ? { group } : {}), ...(locked ? { locked: true } : {}), ...(pull ? { pull: true, pullAt: pullAt || 0.5 } : {}), ...(mute(n) ? { muted: true } : {}), ...advOut(bend, wob, length) }; });
    // the view that wrote counts its own answer (KT2_PENDING_OLD = old: whichever view was current then, so a
    // write from the footer answered while the big window was current left the footer waiting for good, and it
    // stopped taking the song's notes, e.g. after CONVERT EVERYTHING; Eman, 10 Nov)
    const st = S;
    const done = () => { const o = window.KT2_PENDING_OLD ? S : st; if (!o) return; o.pending = Math.max(0, o.pending - 1); resync(o); };
    if (S.voice === "*") {   // ALL: each sound's notes go back to where they live
      S.pending += (S.voices || []).filter((v) => v.id).length;
      run("setMidiNotes", { clipId: S.clipId, notes: out(S.notes.filter((n) => !n._v)) }).finally(done);
      for (const v of (S.voices || []).filter((x) => x.id)) run("setStackNotes", { clipId: S.clipId, layerId: v.id, notes: out(S.notes.filter((n) => n._v === v.id)) }).finally(done);
      return;
    }
    run(S.voice ? "setStackNotes" : "setMidiNotes", { clipId: S.clipId, ...(S.voice ? { layerId: S.voice } : {}), notes: out(S.notes) }).finally(done);
  }
  // The picked notes: a box / Cmd-click selection, or the one note last pressed.
  function picked() {
    if (!S) return [];
    if (S.multi && S.multi.size) return S.notes.filter((n) => S.multi.has(n));
    return S.sel ? [S.sel] : [];
  }
  // Cmd (or Shift) + drag on empty space draws a box that selects every note it touches;
  // Cmd/Shift-click a note adds it to the selection or takes it out.
  function boxSelect(e, h) {
    if (h.note) {
      const m = S.multi || (S.multi = new Set(S.sel ? [S.sel] : []));
      if (m.has(h.note)) m.delete(h.note); else m.add(h.note);
      S.sel = null; draw();
      return;
    }
    const { cv, ppb, rows } = geom(), rect = cv.getBoundingClientRect();
    const keep = e.shiftKey ? picked() : [];
    const y0 = local(cv, e, rect).y;
    S.box = { x0: h.x, y0, x1: h.x, y1: y0 }; S.sel = null;
    const move = (ev) => {
      const b = S.box, m = local(cv, ev, rect); b.x1 = m.x; b.y1 = m.y;
      const b0 = (Math.min(b.x0, b.x1) - OX) / ppb, b1 = (Math.max(b.x0, b.x1) - OX) / ppb;
      const r0 = Math.floor((Math.min(b.y0, b.y1) - STRIP) / ROW), r1 = Math.floor((Math.max(b.y0, b.y1) - STRIP) / ROW);
      S.multi = new Set(keep);
      for (const n of S.notes) { const r = rowOf(rows, n.pitch); if (r >= r0 && r <= r1 && n.start < b1 && n.start + n.length > b0) S.multi.add(n); }
      draw();
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); S.box = null; draw(); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  let dq = 0;
  const queueDraw = () => { if (!dq) dq = requestAnimationFrame(() => { dq = 0; draw(); }); };
  let heard = null;
  const hear = (p, v) => { if (heard === p) return; heard = p; booth("previewNote", { clipId: S.clipId, pitch: p, velocity: v || 100, voice: S.voice }); };
  const hush = () => { if (heard == null) return; heard = null; booth("previewNoteOff", {}); };

  // a row you can write on: in the scale, or anything when Out of key is on (Eman, 31 Oct)
  // ONLY KEY on: a dragged note lands on the closest note in the key (Eman, 31 Oct); ties go the way you are dragging
  const toKey = (p, was) => {
    if (!S.sc || rowOpen(p)) return p;
    const up = p + 1, dn = p - 1, upOk = rowOpen(up), dnOk = rowOpen(dn);
    if (upOk && dnOk) return p >= was ? up : dn;
    if (upOk) return up; if (dnOk) return dn;
    for (let d = 2; d < 7; d++) { if (rowOpen(p + d)) return p + d; if (rowOpen(p - d)) return p - d; }
    return p;
  };
  const KEYDRAG_NEW = () => !window.KT2_KEYDRAG_OLD;
  const open = (p) => rowOpen(p);   // V2n: a locked row takes no new notes (tap its key's lock to open it)
  // The ruler: press near the marker and drag it; click elsewhere puts the marker there; click and
  // drag makes a yellow loop (snapped to the grid); double-click loops that bar
  function rulerDown(e, h) {
    const c = findClip(S.clipId), { beats, ppb } = geom(), spb = secPerBeat();
    if (!c) return;
    const snap = (b) => Math.max(0, Math.min(beats, Math.round(b / S.grid) * S.grid));
    const toT = (b) => c.start + b * spb, mk = (posNow() - c.start) / spb;
    const onMarker = Math.abs((OX + mk * ppb) - h.x) < 8;
    const b0 = h.beat, x0 = e.clientX;
    let moved = false;
    const move = (ev) => {
      const m = hit(ev);
      if (!moved && Math.abs(ev.clientX - x0) < 4) return;
      moved = true;
      if (onMarker) run("setPosition", { time: toT(Math.max(0, Math.min(beats, m.beat))) });
      else { const a = snap(b0), b = snap(m.beat); S.loopDrag = { lo: toT(Math.min(a, b)), hi: toT(Math.max(a, b)) }; draw(); }
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      const L = S.loopDrag; S.loopDrag = null;
      if (!moved) {
        const pt = soloMode() && soloPart(), at = b0 * spb;
        if (pt && at >= pt.from && at <= pt.to) { S.loopClearedAt = performance.now(); KT2Solo.setPart(S.clipId, 0, 0).then(() => draw()); return; }   // click the bar: the whole pattern again
        // the marker put down outside the loop: the loop goes away (Eman, 7 Nov V4m)
        const inLoop = S.loopOn && S.loopPx && h.x >= S.loopPx[0] - 2 && h.x <= S.loopPx[1] + 2;
        if (S.loopOn && !inLoop && !onMarker) loopOff(true);
        run("setPosition", { time: toT(Math.max(0, Math.min(beats, b0))) }); return;
      }
      if (L && L.hi - L.lo > spb * S.grid * 0.5) loopRange(L.lo, L.hi); else draw();
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }
  // On LOOP (the pattern plays on its own) the ruler's loop is a part of this pattern; on TRACK it's the song's loop
  const soloMode = () => !!(window.KT2Solo && KT2Solo.mode() === "solo");
  const soloPart = () => (window.KT2Solo && S && KT2Solo.part(S.clipId)) || null;
  function loopOff(away) {
    if (!away) S.loopClearedAt = performance.now();   // the double-click that cleared it doesn't loop a bar again
    if (soloMode()) { KT2Solo.setPart(S.clipId, 0, 0).then(() => draw()); return; }
    run("setLooping", { on: false }).then(() => draw());
  }
  function loopRange(lo, hi) {
    if (soloMode()) { const c = findClip(S.clipId); if (c) KT2Solo.setPart(S.clipId, lo - c.start, hi - c.start).then(() => draw()); return; }
    run("setLoopRange", { start: lo, end: hi }).then(() => (ui.transport && ui.transport.looping ? null : run("setLooping", { on: true }))).then(() => draw());
  }
  // Notes on the same row (Eman, 8 Nov): a note you drag or stretch into another note on its row
  // takes that space. The note it runs into is cut where they meet (its front moves along as you
  // stretch, its end stays), and a note it covers all the way is replaced. A locked note is never
  // cut. Notes can still end up on top of each other (paste, dice, a locked note): then the part
  // that overlaps gets the playground's red outline. KT2_MIDI_OVERLAP_OLD = old (notes just stack).
  const sameRow = (a, b) => a !== b && a.pitch === b.pitch && (a._v || "") === (b._v || "");
  function trimFront(o, d) {
    o.start += d; o.length -= d;
    if (Array.isArray(o.bend) && o.bend.length) {   // its pitch line keeps its place in time
      const pts = o.bend.map((p) => [p[0] - d, ...p.slice(1)]), keep = pts.filter((p) => p[0] >= 0), before = pts.filter((p) => p[0] < 0);
      if (before.length) keep.unshift([0, ...before[before.length - 1].slice(1)]);
      o.bend = keep;
    }
  }
  // a note made shorter: its pitch line is cut where the note now ends (the part you still see), instead of the
  // whole line being squeezed into the shorter note when it is saved (debug sprint, 8 Nov: the roll showed one
  // line and the synth played another). KT2_BEND_SQUEEZE_OLD = old.
  function cutBend(n) {
    if (window.KT2_BEND_SQUEEZE_OLD || !Array.isArray(n.bend) || !n.bend.length) return;
    const L = n.length, P = n.bend, j = P.findIndex((q) => q[0] > L + 1e-6);
    if (j < 0) return;
    const keep = P.slice(0, j).map((q) => q.slice());
    if (j === 0) return;   // the whole line starts after the new end: left alone
    const a = P[j - 1], b = P[j], f = (L - a[0]) / Math.max(1e-6, b[0] - a[0]);
    if (L - a[0] > 1e-6) keep.push([+L.toFixed(4), +(a[1] + (b[1] - a[1]) * f).toFixed(3)].concat(b.length > 2 ? [b[2]] : []));
    if (keep.length < 2) delete n.bend; else n.bend = keep;
  }
  function overlapFix(movers) {
    if (window.KT2_MIDI_OVERLAP_OLD || !movers.length) return;
    const own = new Set(movers), gone = new Set(), MIN = 1 / 64;
    for (const m of movers) {
      const m0 = m.start, m1 = m.start + m.length;
      for (const o of S.notes) {
        if (own.has(o) || gone.has(o) || o.locked || !sameRow(m, o)) continue;
        const o0 = o.start, o1 = o.start + o.length;
        if (o0 >= m1 - EPS || o1 <= m0 + EPS) continue;
        if (o0 >= m0 - EPS && o1 <= m1 + EPS) { gone.add(o); continue; }   // covered all the way: replaced
        if (o0 < m0 - EPS) { o.length = m0 - o0; cutBend(o); }   // it starts first: it now ends where this one starts (its pitch line is cut there too)
        else trimFront(o, m1 - o0);              // it starts inside: its front moves to this one's end
        if (o.length < MIN) gone.add(o);
      }
    }
    if (!gone.size) return;
    const keep = S.notes.filter((n) => !gone.has(n));
    S.notes.splice(0, S.notes.length, ...keep);
    if (S.multi) for (const n of gone) S.multi.delete(n);
    if (gone.has(S.sel)) S.sel = null;
  }
  // where notes on one row lie on top of each other: [{ n (the one on top), a, b }] in beats
  function overlapsOf(ns) {
    const out = [], by = new Map();
    ns.forEach((n, i) => { const k = n.pitch + "|" + (n._v || ""); if (!by.has(k)) by.set(k, []); by.get(k).push([n, i]); });
    for (const row of by.values()) {
      if (row.length < 2) continue;
      for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) {
        const [p] = row[i], [q] = row[j], a = Math.max(p.start, q.start), b = Math.min(p.start + p.length, q.start + q.length);
        if (b - a > EPS) out.push({ n: q, a, b });   // drawn later = on top
      }
    }
    return out;
  }

  // SMART NOTE SNAP (Eman, 16 Nov 2026). A click in an empty spot between notes on the same row fills the gap:
  // left half of the gap = the new note starts right where the note before it ends, right half = it ends right
  // where the next one starts (a gap shorter than the note gets a note exactly that long). In a big gap a click
  // close to a note still lines up with its edge instead of landing half a step off and overlapping. Moving a
  // note you already placed snaps softer: a finer grid (finer still when zoomed in), with a light pull to the
  // main grid and to the edges of the notes on its row. KT2_NOTE_SNAP_OLD = old (click = grid step under the
  // mouse, move = the full grid step).
  const NOTE_SNAP_NEW = () => !window.KT2_NOTE_SNAP_OLD;
  // the empty stretch around `beat` on the row of `pitch`: lo = end of the note before (or null), hi = start of the next (or null)
  function rowGap(pitch, v, beat, skip) {
    let lo = null, hi = null;
    for (const o of S.notes) {
      if ((skip && skip.has(o)) || o.pitch !== pitch || (o._v || "") !== (v || "")) continue;
      const a = o.start, b = o.start + o.length;
      if (b <= beat + EPS && (lo == null || b > lo)) lo = b;
      if (a >= beat - EPS && (hi == null || a < hi)) hi = a;
    }
    return { lo, hi };
  }
  function smartNewNote(pitch, beat, len, step, beats) {
    const plain = Math.max(0, Math.min(beats - step, Math.floor(beat / step) * step));
    let length = Math.min(len, beats - plain);
    if (!NOTE_SNAP_NEW()) return { start: plain, length };
    const { lo, hi } = rowGap(pitch, "", beat);
    if (lo == null && hi == null) return { start: plain, length };
    const L = lo == null ? 0 : lo, H = hi == null ? beats : hi, gap = H - L;
    if (gap < 1 / 64) return { start: plain, length };
    if (lo != null && hi != null && gap <= 2 * len + EPS) {   // a gap about one or two notes wide: fill it from the side you clicked
      length = Math.min(len, gap);
      return { start: beat - L <= gap / 2 ? L : H - length, length };
    }
    let start = plain;
    if (lo != null && beat - lo < len && beat - lo <= gap / 2) start = lo;   // just after a note: it joins on
    length = Math.min(len, beats - start);
    if (hi != null && start + length > hi + EPS) start = Math.max(L, hi - length);   // would run into the next note: it ends where that one starts
    return { start, length: Math.min(length, H - start) };
  }
  // the start of a note being moved: soft snap (see above)
  function softMoveStart(raw, note, others, step, ppb, beats) {
    const hiS = beats - note.length, clamp = (b) => Math.max(0, Math.min(hiS, b));
    if (!NOTE_SNAP_NEW()) return clamp(Math.round(raw / step) * step);
    const PULL = 9;   // px: an edge or a main grid line this close catches the note
    let best = null, bd = PULL / ppb;
    for (const o of others) {
      if (o.pitch !== note.pitch || (o._v || "") !== (note._v || "")) continue;
      for (const c of [o.start + o.length, o.start - note.length]) { const d = Math.abs(raw - c); if (d < bd) { bd = d; best = c; } }
    }
    if (best != null) return clamp(best);
    const g = Math.round(raw / step) * step;
    if (Math.abs(raw - g) * ppb < Math.min(6, step * ppb * 0.2)) return clamp(g);   // a light pull to the main grid
    let fine = step;
    if (fine / 2 * ppb >= 6) fine /= 2;   // always a bit finer than the click grid when there's room to see it
    while (fine / 2 * ppb >= 18 && fine > 1 / 64) fine /= 2;   // zoomed in: finer still
    return clamp(Math.round(raw / fine) * fine);
  }

  // a plain copy of a mouse event as a right-button press (for Ctrl-click and a lone contextmenu on a Mac)
  const asRight = (e) => ({ button: 2, buttons: 2, clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY, offsetX: e.offsetX, offsetY: e.offsetY,
    target: e.target, currentTarget: e.currentTarget, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false, detail: 1,
    preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation() });
  function onDown(e) {
    if (!S || !S.clipId) return;
    // a roll that never got its notes (v265: an error while the view opened) reloads them from the clip instead of
    // throwing on every click, so a click always writes a note (9 Nov). KT2_NOTES_GUARD_OFF = old
    if (!Array.isArray(S.notes) && !window.KT2_NOTES_GUARD_OFF) { const c = findClip(S.clipId); if (!c) return; S.notes = voiceNotes(c, S.voice).map((n) => ownExpr({ ...n, _op: n.pitch })); }
    // Mac: Ctrl-click is a right-click (the trackpad's own right-click); onDown handles it as one (Eman, 8 Nov). KT2_MIDI_RC_OLD = old
    if (!window.KT2_MIDI_RC_OLD && e.button === 0 && e.ctrlKey && !e.metaKey && /Mac/.test(navigator.platform || navigator.userAgent)) e = asRight(e);
    if (e.button === 2) S.rcAt = performance.now();
    const { beats, rows: rows0 } = geom(), h = hit(e);   // the same rows the screen shows (moving a group used to count other rows)
    if (STRIP > 0 && e.button === 0 && local(geom().cv, e).y < rulerHitY() && h.x >= KEYS) return rulerDown(e, h);
    if (h.pitch == null) return;
    if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && h.x >= KEYS) { const vn = velHit(e); if (vn) return velDown(e, vn); }   // the velocity dot (before ADVANCED's tools; their dots win when nearer)
    if (h.x >= KEYS && advDown(e, h)) return;   // ADVANCED: pitch lines, wobble, their handles
    if (h.x < KEYS) {
      if (e.button !== 0) return;
      // in a quest the locks never flip (10 Nov quest-safe, a playtester locked a chord row by pressing just left of the box); KT2_QUEST_SAFE_OFF = old
      if (h.x > KEYS - 28) return document.documentElement.classList.contains("kq-safe") ? undefined : flipKey(h.pitch);   // the lock at the key's right end
      hear(h.pitch);
      const up = () => { window.removeEventListener("mouseup", up); hush(); };
      return window.addEventListener("mouseup", up);
    }
    if (e.button === 2) {
      if (!h.note) return;
      if (mouseMode() === "classic") { if (!(S.multi && S.multi.has(h.note))) { S.multi = new Set(groupOf(h.note) || [h.note]); S.sel = null; } draw(); return; }   // its menu
      S.notes.splice(S.notes.indexOf(h.note), 1); S.sel = null; if (S.multi) S.multi.delete(h.note); draw(); commit(); return;
    }
    if (e.button !== 0) return;
    // A plain drag moves just the note you hold, even in a compound or a slide pair (Zed call, 7 Nov:
    // "dragging one note dragged others along"). Shift-drag moves the whole block or pair; a Shift-click
    // with no move still adds the note to the selection. TMM_GROUP_PLAIN_DRAG = old (a compound always moved as one).
    const kin = h.note && !window.TMM_GROUP_PLAIN_DRAG ? linkedOf(h.note) : null;
    // Just-pasted notes stay lit, but a plain drag on one of them moves only that note (Zed call, 7 Nov 00:49:
    // he pasted a chord, grabbed one note and the whole chord came along). Shift-drag moves them all.
    // TMM_PASTE_GROUP_DRAG = old (the pasted notes always moved as one).
    const softSel = !!(h.note && !window.TMM_PASTE_GROUP_DRAG && S.multi && S.multi === S.pasteSet && S.multi.has(h.note));
    if (softSel && !e.shiftKey && !e.metaKey && !e.ctrlKey) S.multi = null;
    const shiftKin = !!(e.shiftKey && !e.metaKey && !e.ctrlKey && ((kin && kin.length > 1) || softSel));
    if (e.metaKey || e.ctrlKey || (e.shiftKey && !shiftKin)) return boxSelect(e, h);
    if (!h.note && !open(h.pitch)) { S.sel = null; S.multi = null; draw(); return; }   // out of key: locked
    // Pressing a note of a compound grabs the whole block (old way), or Shift-pressing a block / pair.
    const block = window.TMM_GROUP_PLAIN_DRAG ? groupOf(h.note) : shiftKin ? kin : null;
    const multi0 = S.multi ? new Set(S.multi) : null, sel0 = S.sel;   // a Shift-click with no move gives the pick back first (bug check, 7 Nov)
    if (block && !(S.multi && S.multi.has(h.note))) { S.multi = new Set(block); S.sel = null; }
    // Pressing a note that's in the selection moves the whole selection; anything else starts over.
    let group = h.note && S.multi && S.multi.has(h.note) ? picked().filter((n) => n !== h.note).map((n) => ({ n, start: n.start, pitch: n.pitch })) : [];
    if (!group.length) S.multi = null;
    const step = S.grid;
    let note = h.note, mode = "draw", grab = 0;
    // Option-drag copies the note (and the picked notes with it) and drags the copies; the originals
    // stay (Eman, 7 Nov). A press with no move leaves nothing behind. KT2_ALT_DRAG_OLD = plain move.
    const copying = !!(note && e.altKey && !h.nearEnd && !window.KT2_ALT_DRAG_OLD);
    let copies = [];
    if (copying) {
      const dup = (n) => { const c = ownExpr({ ...n }); S.notes.push(c); copies.push(c); return c; };
      group = group.map((o) => ({ ...o, src: o.n, n: dup(o.n) }));
      note = dup(note);
      if (group.length) S.multi = new Set([note, ...group.map((o) => o.n)]);
    }
    if (note) { mode = h.nearEnd ? "resize" : "move"; grab = h.beat - note.start; }
    else {
      // a new note is one grid step long until you resize one, then it takes your last size (Zed call,
      // 7 Nov); TMM_NEWNOTE_BEAT = old (a beat)
      // A single click gives the length of the last note you drew, stretched or grabbed in this roll; press and
      // drag still sets the length by hand (Eman, 8 Nov). KT2_CLICK_LEN_OLD = old (only a stretch counted).
      const dl = S.lenByHand || window.TMM_NEWNOTE_BEAT ? S.lastLen : Math.max(S.grid, 0.25);
      const at = smartNewNote(h.pitch, h.beat, dl, step, beats);
      note = { pitch: h.pitch, start: at.start, length: at.length, velocity: 100 };
      S.notes.push(note);
      S.made = { note, at: performance.now() };   // a double-click on empty grid writes a note, it doesn't take it straight back
      fxNote(note, "pop");
    }
    const before = JSON.stringify(note), from = { start: note.start, pitch: note.pitch, length: note.length };
    // stretching: a compound, or every picked note, grows by the same amount (Eman, 4 Nov)
    const stretchSet = mode === "resize" ? (group.length ? group.map((o) => o.n) : block ? block.filter((n) => n !== note) : []) : [];
    const stretch = stretchSet.map((n) => ({ n, length: n.length }));
    S.drag = { note }; S.sel = group.length ? null : note;
    const m0 = { start: note.start, pitch: note.pitch };
    // the notes as they were, so a note you only pass over while dragging comes back whole
    const base = S.notes.slice(), was = new Map(S.notes.map((n) => [n, { start: n.start, length: n.length, bend: n.bend }]));
    const movers = [note, ...group.map((o) => o.n), ...stretch.map((o) => o.n)];
    // the other notes where they were when the drag began (the ones you pass over get cut for a moment), for the soft snap's edges
    const others = base.filter((n) => !movers.includes(n)).map((n) => ({ pitch: n.pitch, _v: n._v, ...was.get(n) }));
    const reflow = () => {
      if (window.KT2_MIDI_OVERLAP_OLD) return;
      for (const n of base) if (!movers.includes(n)) { const w = was.get(n); n.start = w.start; n.length = w.length; if (w.bend !== undefined) n.bend = w.bend; else delete n.bend; }
      S.notes.splice(0, S.notes.length, ...base);
      overlapFix(movers);
    };
    draw(); hear(note.pitch, note.velocity);
    const x0 = e.clientX, y0 = e.clientY, clickLen = !window.KT2_CLICK_LEN_OLD;
    let dragged = false;
    const move = (ev) => {
      // a new note keeps its length until the mouse really moves, so a shaky click doesn't shrink it to one step
      if (!dragged) { if (clickLen && mode === "draw" && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return; dragged = true; }
      const m = hit(ev);
      if (mode === "move") {
        note.start = softMoveStart(m.beat - grab, note, others, step, geom().ppb, beats);
        // over a locked row the note jumps straight to the nearest open one (Eman, 4 Nov: it hung on the old row and lagged)
        // over a locked row between two open ones it stays where it is until the mouse reaches the next open
        // row (Eman, 8 Nov recorder note: it flipped up/down on every mouse move there). KT2_KEYDRAG_OLD = old.
        // sprint 8 Nov: an out-of-key note (on a locked row) dragged only sideways keeps its own row; it used to
        // snap to the next open row, and a picked chord jumped a semitone with it. KT2_KEYDRAG_SIDE_OLD = old.
        if (m.pitch != null && m.pitch === from.pitch && !rowOpen(from.pitch) && !window.KT2_KEYDRAG_SIDE_OLD) note.pitch = from.pitch;
        else if (m.pitch != null) { const k = KEYDRAG_NEW() && !rowOpen(m.pitch) && Math.abs(m.pitch - note.pitch) === 1 && rowOpen(note.pitch) ? note.pitch : toKey(m.pitch, note.pitch); if (rowOpen(k)) note.pitch = k; }
        if (group.length) { // the others follow: same time shift, same number of rows
          // ONLY KEY on: the chord moves in steps of the key (open rows only), so every note lands on its own
          // note in the key and the chord keeps its shape; before, locked rows were counted and then each note
          // was pushed to the closest open one, so notes doubled up or jumped (Eman, 8 Nov). KT2_KEYDRAG_OLD = old.
          const rowsK = KEYDRAG_NEW() && S.sc && !S.all ? rows0.filter(rowOpen) : rows0;
          const ri = (p) => { const i = rowsK.indexOf(p); return i < 0 ? rowsK.findIndex((x) => x < p) : i; };
          const dRow = ri(note.pitch) - ri(from.pitch);
          let dt = note.start - from.start;
          dt = Math.max(dt, -Math.min(...group.map((o) => o.start)));
          dt = Math.min(dt, beats - Math.max(...group.map((o) => o.start + o.n.length)));
          note.start = from.start + dt;   // the held note keeps the same shift as the others (it was clamped on its own)
          for (const o of group) {
            o.n.start = o.start + dt;
            const j = ri(o.pitch) + dRow;
            if (rowsK !== rows0) o.n.pitch = rowOpen(o.pitch) ? (rowsK[Math.max(0, Math.min(rowsK.length - 1, j))] ?? o.pitch) : o.pitch + (note.pitch - from.pitch);   // an out-of-key (muted) note just keeps its distance
            else o.n.pitch = toKey(rows0[Math.max(0, Math.min(rows0.length - 1, j))] ?? o.pitch, o.pitch);
          }
        }
        hear(note.pitch, note.velocity);
        if (note.start !== m0.start || note.pitch !== m0.pitch) { fxNote(note, "step", { dx: Math.sign(note.start - m0.start), dy: Math.sign(note.pitch - m0.pitch) }); m0.start = note.start; m0.pitch = note.pitch; }
      } else {
        note.length = Math.max(note.start + step, Math.min(beats, Math.ceil(m.beat / step) * step)) - note.start;
        const d = note.length - from.length; // a compound stretches as one
        for (const o of stretch) o.n.length = Math.max(step, Math.min(beats - o.n.start, o.length + d));
      }
      reflow();
      queueDraw();   // one paint per screen frame, however fast the mouse sends moves
    };
    // Escape while dragging: the drag is called off and every note goes back to how it was, nothing is
    // saved and the window stays open (bug check as 50 users, 8 Nov: Escape mid-drag still dropped the
    // note, and a drop onto a note replaces it, so a note was lost). KT2_MIDI_ESC_DRAG_OLD = old.
    const snap = window.KT2_MIDI_ESC_DRAG_OLD ? null : new Map(base.map((n) => [n, JSON.stringify(n)]));
    const esc = (ev) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); window.removeEventListener("keydown", esc, true);
      S.drag = null; hush();
      for (const [n, j] of snap) { for (const k of Object.keys(n)) delete n[k]; Object.assign(n, JSON.parse(j)); }
      const drop = new Set(copies); if (mode === "draw") drop.add(note);
      S.notes.splice(0, S.notes.length, ...base.filter((n) => !drop.has(n)));
      S.multi = multi0; S.sel = sel0; S.made = null;
      draw();
    };
    if (snap) window.addEventListener("keydown", esc, true);
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      if (snap) window.removeEventListener("keydown", esc, true);
      S.drag = null; hush();
      if (shiftKin && JSON.stringify(note) === before) { if (window.TMM_SHIFT_CLICK_OLD) { if (!softSel) S.multi = null; } else { S.multi = multi0; S.sel = sel0; } boxSelect(e, h); return; }   // Shift-click, no move: picks it as before
      if (copying && JSON.stringify(note) === before) {   // Option-click without a move: no copy on top of the original
        // the copy sat on its original while you wiggled, and the overlap rule took the original away; put the
        // notes back as they were (debug sprint, 8 Nov: an Option-click on a trackpad deleted the note).
        // KT2_ALT_CLICK_LOSS_OLD = old.
        if (!window.KT2_ALT_CLICK_LOSS_OLD) { for (const n of base) { const w = was.get(n); n.start = w.start; n.length = w.length; if (w.bend !== undefined) n.bend = w.bend; else delete n.bend; } S.notes = base.slice(); }
        S.notes = S.notes.filter((n) => !copies.includes(n)); copies = [];
        S.sel = h.note; S.multi = group.length ? new Set([h.note, ...group.map((o) => o.src)]) : null;
        draw(); return;
      }
      if (mode === "move" && JSON.stringify(note) !== before) { fxNote(note, "drop"); for (const o of group) fxNote(o.n, "drop"); }
      if (mode !== "move") { S.lastLen = note.length; if (mode === "resize") S.lenByHand = true; }
      if (mode === "resize") { cutBend(note); for (const o of stretch) cutBend(o.n); }
      if (clickLen && (mode === "move" || (mode === "draw" && dragged))) { S.lastLen = note.length; S.lenByHand = true; }   // grabbed or drawn by dragging: its length is the one a click gives next
      draw();
      const cut = !window.KT2_MIDI_OVERLAP_OLD && (S.notes.length !== base.length || base.some((n) => { const w = was.get(n); return n.start !== w.start || n.length !== w.length; }));
      if (mode === "draw" || JSON.stringify(note) !== before || stretch.length || cut) commit();
      else if (!group.length && !h.note) S.multi = null;
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  // ---- VERSIONS (Eman, 15 Nov 2026): a VERSIONS button at the end of the bar opens a strip under it with every
  // version of this MIDI as a small box showing its notes. Click a box: that version is in the roll to edit.
  // + adds an empty version. Cmd+D (with the strip last clicked), right-click > Duplicate or Option-drag a box makes
  // a copy to change on its own. Drag a box to put it anywhere in the row; double-click its name to rename it.
  // Everything lives in the clip itself (c.versions, setClipVersions in playground.js), so the ideas stay together
  // and travel with the clip. KT2_VERSIONS_OFF = no button, no strip.
  const VOPEN_STORE = "kt2.midiVersionsOpen";
  const vOn = () => !window.KT2_VERSIONS_OFF;
  const vLoadOpen = () => { try { return localStorage.getItem(VOPEN_STORE) === "1"; } catch (e) { return false; } };
  const vSaveOpen = (on) => { try { localStorage.setItem(VOPEN_STORE, on ? "1" : "0"); } catch (e) { /* private window */ } };
  const vNewId = () => "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const vCopy = (ns) => (ns || []).map((n) => JSON.parse(JSON.stringify(n)));
  const vStackOf = (st) => Object.fromEntries(Object.entries(st || {}).map(([k, ns]) => [k, vCopy(ns)]));
  // PER SYNTH (Eman, 15 Nov 2026): each synth slot (1, 2...) has its own versions. A new or picked version on
  // synth 2 changes only synth 2's notes; synth 1 keeps its notes (still shown as ghost notes) and its own
  // versions. The main synth's live in c.versions (as before), a stacked synth's in c.versionsBy[its id].
  // KT2_VERSIONS_SHARED = old: one set of versions for the whole clip, every synth's notes switched together.
  const vPer = () => !window.KT2_VERSIONS_SHARED;
  const vKey = (st) => (st && st.voice && st.voice !== "*" ? st.voice : null);
  function vListOf(c, key) {
    const src = key ? c && c.versionsBy && c.versionsBy[key] : c && c.versions;
    const v = src && Array.isArray(src.list) && src.list.length ? src : null;
    const live = vCopy(key ? c && c.stack && c.stack[key] : c && c.notes);
    if (!v) return { list: [{ id: "v1", name: "V1", notes: live }], active: "v1" };
    const active = v.list.some((x) => x.id === v.active) ? v.active : v.list[0].id;
    return { list: v.list.map((x) => ({ id: x.id, name: x.name, notes: x.id === active ? live : vCopy(x.notes) })), active };
  }
  // the clip's versions with the active one's entry holding the clip's notes as they are now
  // (a clip that never had versions is one: V1, its notes)
  function vList(c, st) {
    if (vPer()) return vListOf(c, vKey(st === undefined ? S : st));
    const v = c && c.versions && Array.isArray(c.versions.list) && c.versions.list.length ? c.versions : null;
    const live = { notes: vCopy(c && c.notes), stack: vStackOf(c && c.stack) };
    if (!v) return { list: [{ id: "v1", name: "V1", ...live }], active: "v1" };
    const active = v.list.some((x) => x.id === v.active) ? v.active : v.list[0].id;
    return { list: v.list.map((x) => (x.id === active ? { ...x, ...live } : { ...x, notes: vCopy(x.notes), stack: vStackOf(x.stack) })), active };
  }
  function vNextName(list) {
    let k = list.length + 1;
    const used = new Set(list.map((x) => String(x.name).toUpperCase()));
    while (used.has("V" + k)) k++;
    return "V" + k;
  }
  // write the versions; `load` = the version whose notes go into the clip now (one undo step)
  function vWrite(st, versions, load) {
    if (!st || !st.clipId) return;
    if (vPer()) return vWriteOne(st, versions, load);
    const args = { clipId: st.clipId, versions: { active: versions.active, list: versions.list.map((x) => (x.id === versions.active ? { id: x.id, name: x.name } : { id: x.id, name: x.name, notes: x.notes, stack: x.stack })) } };
    if (load) {
      const c = findClip(st.clipId), keys = new Set([...Object.keys((c && c.stack) || {}), ...Object.keys(load.stack || {})]);
      args.notes = vCopy(load.notes);
      args.stack = Object.fromEntries([...keys].map((k) => [k, vCopy((load.stack || {})[k])]));
      st.sel = null; st.multi = null;
      if (st.voice === null || st.voice === undefined) st.notes = args.notes.map((n) => ownExpr({ ...n, _op: n.pitch }));
    }
    st.pending++; st.pendingAt = Date.now();
    run("setClipVersions", args).then((r) => { if (r && r.error && window.toast) toast(r.error, true); }).finally(() => { st.pending = Math.max(0, st.pending - 1); resync(st); });
    st.vDraft = versions;   // drawn right away; the clip's own copy takes over on the next state
    vDrawStrip(st);
    if (load) draw();
  }
  // per synth: only this synth's versions and notes are written; the other synths are left as they are
  function vWriteOne(st, versions, load) {
    const key = vKey(st);
    const args = { clipId: st.clipId, versions: { active: versions.active, list: versions.list.map((x) => (x.id === versions.active ? { id: x.id, name: x.name } : { id: x.id, name: x.name, notes: x.notes })) } };
    if (key) args.layer = key;
    if (load) {
      const ns = vCopy(load.notes);
      if (key) args.stack = { [key]: ns }; else args.notes = ns;
      st.sel = null; st.multi = null;
      if (st.voice !== "*") st.notes = ns.map((n) => ownExpr({ ...n, _op: n.pitch }));
      else st.notes = (st.notes || []).filter((n) => n._v).concat(ns.map((n) => ownExpr({ ...n, _op: n.pitch })));
    }
    st.pending++; st.pendingAt = Date.now();
    run("setClipVersions", args).then((r) => { if (r && r.error && window.toast) toast(r.error, true); }).finally(() => { st.pending = Math.max(0, st.pending - 1); resync(st); });
    st.vDraft = versions; st.vDraftKey = key;
    vDrawStrip(st);
    if (load) draw();
  }
  const vPick = (st, id) => { const c = findClip(st.clipId); const v = vList(c, st); if (v.active === id) return; const to = v.list.find((x) => x.id === id); if (!to) return; vWrite(st, { ...v, active: id }, to); };
  function vAdd(st) {
    const c = findClip(st.clipId); if (!c) return;
    const v = vList(c, st), nv = { id: vNewId(), name: vNextName(v.list), notes: [], stack: Object.fromEntries(Object.keys(c.stack || {}).map((k) => [k, []])) };
    vWrite(st, { list: v.list.concat(nv), active: nv.id }, nv);
    if (window.toast) toast(`${nv.name}: a new empty version. Your other versions are kept in this clip.`);
  }
  // a copy of version `id` at place `at` (default: right after it), picked so it can be changed on its own
  function vDup(st, id, at) {
    const c = findClip(st.clipId); if (!c) return;
    const v = vList(c, st), i = v.list.findIndex((x) => x.id === (id || v.active)); if (i < 0) return;
    const src = v.list[i], nv = { id: vNewId(), name: String(src.name).slice(0, 18) + " copy", notes: vCopy(src.notes), stack: vStackOf(src.stack) };
    const list = v.list.slice(); list.splice(at == null ? i + 1 : at, 0, nv);
    vWrite(st, { list, active: nv.id }, nv);
    if (window.toast) toast(`${nv.name}: a copy of ${src.name}, yours to change.`);
  }
  function vMove(st, id, at) {
    const c = findClip(st.clipId); if (!c) return;
    const v = vList(c, st), i = v.list.findIndex((x) => x.id === id); if (i < 0) return;
    const list = v.list.slice(), [x] = list.splice(i, 1); list.splice(at > i ? at - 1 : at, 0, x);
    if (list.every((y, k) => y === v.list[k])) return;
    vWrite(st, { list, active: v.active });
  }
  function vDelete(st, id) {
    const c = findClip(st.clipId); if (!c) return;
    const v = vList(c, st); if (v.list.length < 2) return;
    const i = v.list.findIndex((x) => x.id === id); if (i < 0) return;
    const list = v.list.filter((x) => x.id !== id);
    if (v.active !== id) return vWrite(st, { list, active: v.active });
    const to = list[Math.min(i, list.length - 1)];
    vWrite(st, { list, active: to.id }, to);
  }
  function vRename(st, id, name) {
    const c = findClip(st.clipId); if (!c) return;
    const v = vList(c, st), x = v.list.find((y) => y.id === id), nm = String(name || "").replace(/\s+/g, " ").trim().slice(0, 24);
    if (!x || !nm || nm === x.name) return vDrawStrip(st);
    x.name = nm; vWrite(st, v);
  }
  // a version's notes, small: every note a bar, the pitch range fitted to the box
  function vMini(cv, notes, beats, color, on) {
    const W = cv.clientWidth || 96, H = cv.clientHeight || 34, dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(W * dpr)) cv.width = Math.round(W * dpr);
    if (cv.height !== Math.round(H * dpr)) cv.height = Math.round(H * dpr);
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const ns = (notes || []).filter((n) => n && n.length > 0);
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (let b = 4; b < beats; b += 4) g.fillRect(Math.round((b / beats) * W), 0, 1, H);
    if (!ns.length) { g.fillStyle = "rgba(255,255,255,0.22)"; g.font = "700 8.5px Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("EMPTY", W / 2, H / 2); return; }
    let lo = Math.min(...ns.map((n) => n.pitch)), hi = Math.max(...ns.map((n) => n.pitch));
    if (hi - lo < 11) { const m = (hi + lo) / 2; lo = m - 5.5; hi = m + 5.5; }
    const pad = 3, rh = Math.max(1.5, Math.min(4, (H - pad * 2) / (hi - lo + 1)));
    g.fillStyle = on ? color : toWhite(color, 0.15);
    g.globalAlpha = on ? 1 : 0.75;
    for (const n of ns) {
      const x = (n.start / beats) * W, w = Math.max(1.5, (n.length / beats) * W - 0.5);
      const y = pad + (1 - (n.pitch - lo) / Math.max(1, hi - lo)) * (H - pad * 2 - rh);
      g.fillRect(x, y, w, rh);
    }
    g.globalAlpha = 1;
  }
  function vDrawStrip(st) {
    const strip = st && st.pane && st.pane.querySelector("#tmm-vstrip");
    if (!strip || strip.hidden) return;
    const c = st.clipId && findClip(st.clipId);
    if (!c) { strip.replaceChildren(); return; }
    if (vPer() && st.vDraft && st.vDraftKey !== vKey(st)) st.vDraft = null;   // drawn for another synth: not this one's
    const v = st.vDraft || vList(c, st), beats = Math.max(1, c.beats || 16), color = (c.color || st.vcol || COLOR);
    st.vDraft = null;
    const boxes = new Map([...strip.querySelectorAll(".tmm-vbox")].map((b) => [b.dataset.id, b]));
    strip.replaceChildren();
    v.list.forEach((x, i) => {
      const b = boxes.get(x.id) || document.createElement("div");
      if (!b.dataset.id) {
        b.className = "tmm-vbox"; b.dataset.id = x.id; b.tabIndex = 0;
        b.innerHTML = `<canvas></canvas><span class="tmm-vname"></span>`;
      }
      b.classList.toggle("on", x.id === v.active);
      b.setAttribute("aria-pressed", x.id === v.active ? "true" : "false");
      b.title = `${x.name}: click to edit it here. Drag to move it, Option-drag to copy it, double-click the name to rename, right-click for more`;
      b.querySelector(".tmm-vname").textContent = x.name;
      strip.append(b);
      const key = vKey(st), mine = vPer() ? (key ? (c.stack && c.stack[key]) || [] : c.notes || []) : null;
      const live = vPer() && x.id === v.active ? (st.voice !== "*" && Array.isArray(st.notes) ? st.notes : mine).filter((n) => !n._v) : x.id === v.active ? (st.voice ? c.notes : (st.notes || c.notes || []).filter((n) => !n._v)) : x.notes;
      requestAnimationFrame(() => vMini(b.querySelector("canvas"), live, beats, color, x.id === v.active));
    });
    const add = document.createElement("button");
    add.className = "tmm-vadd"; add.title = "A new empty version (your others stay in this clip)"; add.setAttribute("aria-label", "New version");
    add.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>`;
    add.onclick = () => vAdd(st);
    strip.append(add);
  }
  function vSetOpen(st, on) {
    const pane = st.pane, strip = pane.querySelector("#tmm-vstrip"), btn = pane.querySelector("#tmm-vers");
    st.vOpen = !!on; vSaveOpen(st.vOpen);
    strip.hidden = !st.vOpen || !st.clipId;
    btn.classList.toggle("on", st.vOpen); btn.setAttribute("aria-pressed", st.vOpen ? "true" : "false");
    vDrawStrip(st);
    if (st === S) { st.fitH = null; requestAnimationFrame(() => { const was = S; if (use(st.pane)) { fitRows(true); draw(); } if (was && was !== st) use(was.pane); }); }
  }
  function vBuild(pane, q) {
    const btn = q("tmm-vers"), strip = q("tmm-vstrip");
    if (!vOn()) { q("tmm-vg").remove(); strip.remove(); return; }
    btn.onclick = () => { use(pane); vSetOpen(S, !S.vOpen); };
    // the strip was the last thing clicked: Cmd+D copies the picked version; a click in the roll hands Cmd+D back to the notes
    strip.addEventListener("mousedown", () => { use(pane); S.vFocus = true; }, true);
    if (!pane.dataset.tmmVWired) { pane.dataset.tmmVWired = "1"; pane.addEventListener("mousedown", (e) => { if (e.target && e.target.id === "tmm-canvas" && S) S.vFocus = false; }, true); }
    strip.addEventListener("contextmenu", (e) => {
      const b = e.target.closest(".tmm-vbox"); if (!b || typeof showMenu !== "function") return;
      e.preventDefault(); e.stopPropagation(); use(pane);
      const st = S, id = b.dataset.id, v = vList(findClip(st.clipId), st), x = v.list.find((y) => y.id === id); if (!x) return;
      showMenu(atMouse(e), [
        { heading: String(x.name).toUpperCase() },
        ...(id !== v.active ? [{ label: "Edit this version", run: () => vPick(st, id) }] : []),
        { label: "Duplicate", meta: "Cmd+D", run: () => vDup(st, id) },
        { label: "Rename", run: () => vNameEdit(st, b) },
        { sep: true },
        { label: "Delete version", danger: true, ...(v.list.length < 2 ? { disabled: "The last version can't be deleted (it is the clip's notes)." } : {}), run: () => vDelete(st, id) },
      ]);
      // the app's menu sits under the lane window while it is open: this one comes up over it, until it closes
      const pop = document.getElementById("pop");
      if (pop) { pop.classList.add("tmm-vpop"); const mo = new MutationObserver(() => { if (pop.hidden) { pop.classList.remove("tmm-vpop"); mo.disconnect(); } }); mo.observe(pop, { attributes: true, attributeFilter: ["hidden"] }); }
    });
    strip.addEventListener("dblclick", (e) => { const b = e.target.closest(".tmm-vbox"); if (b) { use(pane); vNameEdit(S, b); } });
    strip.addEventListener("keydown", (e) => {
      const b = e.target.closest && e.target.closest(".tmm-vbox"); if (!b || e.target.tagName === "INPUT") return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); use(pane); vPick(S, b.dataset.id); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { const n = e.key === "ArrowLeft" ? b.previousElementSibling : b.nextElementSibling; if (n && n.classList.contains("tmm-vbox")) n.focus(); e.preventDefault(); }
    });
    // press a box: a click picks it; a drag moves it (Option held: a copy lands there instead)
    strip.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".tmm-vbox"); if (!b || e.button !== 0 || e.target.tagName === "INPUT") return;
      use(pane);
      const st = S, id = b.dataset.id, x0 = e.clientX, y0 = e.clientY;
      let drag = false, at = -1, ghost = null, mark = null;
      const spots = () => [...strip.querySelectorAll(".tmm-vbox")].map((el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; });
      const move = (ev) => {
        if (!drag && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        if (!drag) {
          drag = true; b.classList.add(ev.altKey ? "copying" : "dragging");
          ghost = b.cloneNode(true); ghost.classList.add("tmm-vghost"); ghost.querySelector("canvas").replaceWith(Object.assign(document.createElement("img"), { src: b.querySelector("canvas").toDataURL(), alt: "" }));
          const r = b.getBoundingClientRect(); ghost.style.width = r.width + "px"; ghost.style.height = r.height + "px"; ghost._dx = x0 - r.left; ghost._dy = y0 - r.top;
          document.body.append(ghost);
          mark = document.createElement("i"); mark.className = "tmm-vmark"; strip.append(mark);
        }
        ghost.style.left = ev.clientX - ghost._dx + "px"; ghost.style.top = ev.clientY - ghost._dy + "px";
        b.classList.toggle("copying", ev.altKey); b.classList.toggle("dragging", !ev.altKey); ghost.classList.toggle("copying", ev.altKey);
        const xs = spots(); at = xs.findIndex((cx) => ev.clientX < cx); if (at < 0) at = xs.length;
        const els = [...strip.querySelectorAll(".tmm-vbox")], sr = strip.getBoundingClientRect();
        const ref = els[at] ? els[at].getBoundingClientRect().left - 4 : els[els.length - 1].getBoundingClientRect().right + 3;
        mark.style.left = ref - sr.left + strip.scrollLeft + "px";
      };
      const up = (ev) => {
        window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true);
        b.classList.remove("dragging", "copying"); if (ghost) ghost.remove(); if (mark) mark.remove();
        if (!drag) return ev.type === "pointerup" && vPick(st, id);
        if (ev.type !== "pointerup" || at < 0) return;
        if (ev.altKey) vDup(st, id, at); else vMove(st, id, at);
      };
      window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
    });
  }
  // the name turns into a box to type in (Enter keeps it, Escape leaves it as it was)
  function vNameEdit(st, b) {
    const span = b.querySelector(".tmm-vname"); if (!span || b.querySelector("input")) return;
    const inp = document.createElement("input");
    inp.className = "tmm-vname-in"; inp.value = span.textContent; inp.maxLength = 24; inp.spellcheck = false;
    span.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const end = (keep) => { if (done) return; done = true; const val = inp.value; inp.replaceWith(span); if (keep) vRename(st, b.dataset.id, val); };
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") end(true); else if (e.key === "Escape") end(false); });
    inp.addEventListener("blur", () => end(true));
    inp.addEventListener("pointerdown", (e) => e.stopPropagation());
  }
  function vShow(pane) {
    if (!vOn() || !S) return;
    const strip = pane.querySelector("#tmm-vstrip"), btn = pane.querySelector("#tmm-vers");
    if (!strip || !btn) return;
    if (S.vOpen == null) S.vOpen = vLoadOpen();
    const c = S.clipId && findClip(S.clipId);
    btn.disabled = !c;
    btn.classList.toggle("on", !!S.vOpen); btn.setAttribute("aria-pressed", S.vOpen ? "true" : "false");
    const hid = !S.vOpen || !c;
    if (strip.hidden !== hid) { strip.hidden = hid; S.fitH = null; }
    // a box being renamed keeps its typing box until it is done
    if (!hid && !strip.querySelector("input")) vDrawStrip(S);
  }
  // Cmd+D with the strip last clicked: a copy of the picked version (in the roll, Cmd+D still lets go of the notes)
  window.addEventListener("keydown", (e) => {
    if (!vOn() || !S || !S.vOpen || !S.vFocus || !S.clipId || S.pane.hidden || S.pane.closest("[hidden]")) return;
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "d" || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    vDup(S);
  }, true);

  // Cmd+D in the roll: the picked notes copied straight after the selection's end (same pitches). Notes that would
  // start past the pattern's end are left out, like Cmd+V. A compound's copy is a compound of its own.
  function dupNotes() {
    const ns = picked();
    if (!ns.length) return;
    const c = findClip(S.clipId), beats = (c && c.beats) || 16;
    const t0 = Math.min(...ns.map((n) => n.start)), t1 = Math.max(...ns.map((n) => n.start + n.length)), shift = t1 - t0;
    const grp = {};
    const copies = ns.map((n) => {
      const k = ownExpr({ ...n });
      k.start = +(n.start + shift).toFixed(4);
      if (k.group) k.group = grp[n.group] || (grp[n.group] = "c" + Date.now().toString(36) + Object.keys(grp).length);
      delete k._op;
      return k;
    }).filter((k) => k.start < beats - 1e-6);
    for (const k of copies) { if (k.start + k.length > beats) { k.length = +(beats - k.start).toFixed(4); cutBend(k); } }
    if (!copies.length) { if (window.toast) toast("No room after these notes: the pattern ends here."); return; }
    if (copies.length < ns.length && window.toast) setTimeout(() => toast(`${ns.length - copies.length} note${ns.length - copies.length > 1 ? "s" : ""} didn't fit in this pattern.`), 0);
    S.notes.push(...copies);
    overlapFix(copies);
    S.multi = new Set(copies); S.sel = null;
    draw(); commit();
  }

  // (capture, so the song's own Cmd+D never also copies the clip while the footer roll shows)
  window.addEventListener("keydown", (e) => {
    if (window.KT2_NOTES_CMD_D_OLD || window.KT2_CMD_D_DUP || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || (e.key || "").toLowerCase() !== "d") return;
    if (!S || !picked().length || S.pane.hidden || S.pane.closest("[hidden]") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat) dupNotes();
  }, true);
  // Delete / arrows on the picked note while this view shows (the app's keys skip open windows).
  window.addEventListener("keydown", (e) => {
    // Escape with PITCH or WOBBLE on and nothing picked: back to MOVE first, the window stays (bug check as
    // 50 users, 8 Nov: beginners pressed Escape to leave PITCH and lost the whole window). KT2_ESC_TOOL_OLD = old.
    if (S && !window.KT2_ESC_TOOL_OLD && e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && S.adv && S.tool && S.tool !== "move" && !picked().length
      && !S.pane.hidden && !S.pane.closest("[hidden]") && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { advTool("move"); draw(); e.preventDefault(); return e.stopImmediatePropagation(); }
    if (!S || !picked().length || S.pane.hidden || S.pane.closest("[hidden]") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    // Cmd+D: a copy of the picked notes right after them, same rows; pressing again puts the next copy after the
    // newest one, which becomes the selection (Eman, 16 Nov 02:21). KT2_NOTES_CMD_D_OLD = let go of the notes (4 Nov).
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "d" && !window.KT2_CMD_D_DUP) { e.preventDefault(); S.sel = null; S.multi = null; draw(); return; }   // Cmd+D: let go of the notes (Eman, 4 Nov)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const ns = picked(), rows = rowPitches(S.sc, S.all);
    if (e.key === "Tab") { if (cycleSlides(e.shiftKey ? -1 : 1)) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (e.key === "Delete" || e.key === "Backspace") { S.notes = S.notes.filter((n) => !ns.includes(n)); S.sel = null; S.multi = null; }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const up = e.key === "ArrowUp";
      for (const n of ns) {
        if (e.shiftKey) n.pitch = Math.max(RLO(), Math.min(RHI(), n.pitch + (up ? 12 : -12)));
        else { const i = rows.indexOf(n.pitch); const j = (i < 0 ? rows.findIndex((x) => x < n.pitch) : i) + (up ? -1 : 1); if (rows[j] != null) n.pitch = rows[j]; }
      }
    } else if (e.key === "Escape") { S.sel = null; S.multi = null; if (S.adv && S.tool !== "move") advTool("move"); draw(); return e.stopImmediatePropagation(); }
    else return;
    e.preventDefault();
    draw(); commit();
  });

  // Cmd+A picks every note, Cmd+C copies the picked notes (or all), Cmd+X cuts, Cmd+V pastes them into
  // whichever MIDI clip is open now, at the same spots (Eman, 31 Oct). The copy is shared by every MIDI view.
  window.addEventListener("keydown", (e) => {
    const typing = e.target.tagName === "TEXTAREA" || (e.target.tagName === "INPUT" && !/checkbox|radio|range|button/.test(e.target.type)) || e.target.isContentEditable;
    if (!S || !S.clipId || S.pane.hidden || S.pane.closest("[hidden]") || typing) return;
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "a") { S.multi = new Set(S.notes); S.sel = null; draw(); }
    else if (k === "c" || k === "x") {
      const ns = picked().length ? picked() : S.notes;
      if (!ns.length) return;
      window.killtoyNoteClip = ns.map(({ pitch, start, length, velocity, slide, slideFrom, pull, pullAt, bend, wob }) => ({ pitch, start, length, velocity: velocity || 100, ...(slide ? { slide: true } : {}), ...(slide && slideFrom != null ? { slideFrom } : {}), ...(pull ? { pull: true, pullAt: pullAt || 0.5 } : {}), ...advOut(bend, wob, length) }));
      try { localStorage.setItem("killtoy.noteClip", JSON.stringify(window.killtoyNoteClip)); } catch (err) {}
      if (k === "x") { const cut = new Set(ns); S.notes = S.notes.filter((n) => !cut.has(n)); S.sel = null; S.multi = null; draw(); commit(); }
      if (window.toast) toast(`${ns.length} note${ns.length > 1 ? "s" : ""} ${k === "x" ? "cut" : "copied"}. Open any MIDI clip and press Cmd+V.`);
    } else if (k === "v") {
      let clip = window.killtoyNoteClip;
      if (!clip) { try { clip = JSON.parse(localStorage.getItem("killtoy.noteClip") || "null"); } catch (err) { clip = null; } }
      if (!clip || !clip.length) return;
      // Pasted notes land at the song marker when it is inside this clip, else right after the copied
      // notes' own spot, so they never hide under the originals (Zed call, 7 Nov). TMM_PASTE_SAME_SPOT = old.
      const added = clip.map((n) => ownExpr({ ...n }));
      if (!window.TMM_PASTE_SAME_SPOT && added.length) {
        const c = findClip(S.clipId), spb = secPerBeat(), beats = (c && c.beats) || 16, grid = S.grid || 0.25;
        const t0 = Math.min(...added.map((n) => n.start)), t1 = Math.max(...added.map((n) => n.start + n.length));
        const mk = c && ui.transport ? (posNow() - c.start) / spb : NaN;
        const atMk = mk >= 0 && mk < beats - 1e-6 && !(mk > t0 - grid && mk < t1);   // the marker, unless it sits on the copied notes themselves
        let at = atMk ? Math.round(mk / grid) * grid : Math.ceil((t1 - 1e-6) / grid) * grid;
        // pressing Cmd+V again (same copy, same clip, marker not moved) goes on after the last paste instead
        // of stacking on top of it (bug check, 7 Nov). TMM_PASTE_STACK = old.
        const lp = S.lastPaste, key = JSON.stringify(clip);
        if (!window.TMM_PASTE_STACK && lp && lp.key === key && lp.clipId === S.clipId && (lp.mk === mk || (isNaN(lp.mk) && isNaN(mk))) && S.notes.some((n) => Math.abs(n.start - lp.at) < 1e-6)) at = Math.ceil((lp.at + (t1 - t0) - 1e-6) / grid) * grid;
        if (at + (t1 - t0) > beats + 1e-6) at = Math.max(0, Math.floor((beats - (t1 - t0)) / grid) * grid);
        S.lastPaste = { key, clipId: S.clipId, mk, at };
        for (const n of added) { n.start = +(n.start - t0 + at).toFixed(4); n.length = +Math.min(n.length, Math.max(grid, beats - n.start)).toFixed(4); }
        // a copy longer than this pattern: the notes that would start past its end are left out, so nothing
        // hides outside the pattern (debug sprint, 8 Nov: 4 bars pasted into 1 bar put 12 notes out of sight).
        // KT2_PASTE_PAST_END_OLD = old.
        if (!window.KT2_PASTE_PAST_END_OLD) {
          const fit = added.filter((n) => n.start < beats - 1e-6);
          for (const n of fit) { n.length = +Math.max(Math.min(grid, beats - n.start), Math.min(n.length, beats - n.start)).toFixed(4); cutBend(n); }
          if (fit.length < added.length && window.toast) setTimeout(() => toast(`${added.length - fit.length} note${added.length - fit.length > 1 ? "s" : ""} didn't fit in this pattern.`), 0);
          added.splice(0, added.length, ...fit);
          if (!added.length) return;
        }
      }
      S.notes = S.notes.concat(added); S.multi = S.pasteSet = new Set(added); S.sel = null;
      draw(); commit();
      if (window.toast) toast(`Pasted ${added.length} note${added.length > 1 ? "s" : ""}.`);
    } else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  // Play the notes from the computer keyboard while the MIDI view shows (Eman, 6 Nov 21:58).
  // FL-style: Z S X D C V G B H N J M is one octave from C3, Q 2 W 3 E R 5 T 6 Y 7 U I the next;
  // - and = move it an octave. ONLY KEY on: a key outside the scale plays the closest note in the key.
  // By key position (e.code), so it works the same on a Swedish keyboard. TMM_QWERTY_OFF = old (no keys).
  const QW = { KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
    KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29 };
  let qwOct = 0;
  const qwHeld = new Map();   // e.code -> pitch sounding
  const qwVis = (st) => st && st.clipId && !st.pane.hidden && !st.pane.closest("[hidden]") && st.pane.getClientRects().length > 0;
  const qwOn = () => {   // the MIDI view on screen (the pop-up first), even when another view was used last
    if (window.TMM_QWERTY_OFF) return false;
    if (qwVis(S) && S.pane.closest("#iw")) return true;
    const pop = [...STATES.values()].find((st) => qwVis(st) && st.pane.closest("#iw"));
    const any = pop || (qwVis(S) ? S : [...STATES.values()].find(qwVis));
    if (!any) {   // parked: the synth's own view (VST) uses TOY MACHINE's own keys (they play linked synths too); TMM_QWERTY_SYNTHVIEW = true plays these keys there
      const iwEl = document.getElementById("iw");
      if (!iwEl || iwEl.hidden || !window.TMM_QWERTY_SYNTHVIEW || !window.ui || !ui.roll || !ui.roll.clipId || !ui.state) return false;
      const tr = ui.state.tracks.find((t) => t.clips.some((c) => c.id === ui.roll.clipId));
      if (!tr || (typeof isKillDrumLane === "function" && isKillDrumLane(tr)) || (typeof isToyMachineLane === "function" && !isToyMachineLane(tr))) return false;
      return { clipId: ui.roll.clipId };
    }
    if (any !== S) use(any.pane);
    return true;
  };
  const qwStop = (code) => { if (!qwHeld.has(code)) return; qwHeld.delete(code); booth("previewNoteOff", { key: "qw" + code }); if (S) { S.held = new Set(qwHeld.values()); queueDraw(); } };
  const qwStopAll = () => { for (const code of [...qwHeld.keys()]) qwStop(code); };
  window.addEventListener("keydown", (e) => {
    const typing = e.target.tagName === "TEXTAREA" || (e.target.tagName === "INPUT" && !/checkbox|radio|range|button/.test(e.target.type)) || e.target.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const tgt = qwOn(), clipId = tgt && tgt.clipId ? tgt.clipId : S && S.clipId, inMidi = tgt === true;
    if (!tgt) return;
    if (e.code === "Minus" || e.code === "Equal") { if (!e.repeat) { qwStopAll(); qwOct = Math.max(-3, Math.min(3, qwOct + (e.code === "Equal" ? 1 : -1))); if (window.toast) toast("Keyboard octave C" + (3 + qwOct)); } e.preventDefault(); e.stopImmediatePropagation(); return; }
    const k = QW[e.code];
    if (k == null) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat || qwHeld.has(e.code)) return;
    let p = Math.max(LOW, Math.min(HIGH, 48 + qwOct * 12 + k));
    if (inMidi && !S.all) p = toKey(p, p);   // ONLY KEY: the closest open note
    else if (!inMidi && window.ui && ui.state && ui.roll) {   // synth view: the lane's own key setting
      const tr = ui.state.tracks.find((t) => t.clips.some((c) => c.id === clipId)), sc = tr && laneScale(tr.layerOf || tr.id);
      if (sc && !sc.free && SCALES[sc.scale]) { const ok = (x) => SCALES[sc.scale].steps.includes(pc(x - sc.tonic)); if (!ok(p)) for (let d = 1; d < 7; d++) { if (ok(p + d)) { p += d; break; } if (ok(p - d)) { p -= d; break; } } }
    }
    qwHeld.set(e.code, p);
    booth("previewNote", { clipId, pitch: p, velocity: 100, key: "qw" + e.code, voice: inMidi ? S.voice : null });
    if (inMidi) { S.held = new Set(qwHeld.values()); queueDraw(); }
  }, true);
  window.addEventListener("keyup", (e) => { if (qwHeld.has(e.code)) { qwStop(e.code); e.stopImmediatePropagation(); } }, true);
  window.addEventListener("blur", qwStopAll);
  document.addEventListener("visibilitychange", () => { if (document.hidden) qwStopAll(); });

  // for tests: where a note sits on screen (its middle), or null when it's off screen
  const notePos = (n) => { if (!S) return null; const g0 = geom(), r = rowOf(g0.rows, n.pitch); if (r < 0) return null; const b = g0.cv.getBoundingClientRect(), k = b.width / (g0.cv.clientWidth || b.width); return { x: b.left + (OX + (n.start + n.length / 2) * g0.ppb) * k, x0: b.left + (OX + n.start * g0.ppb) * k, x1: b.left + (OX + (n.start + n.length) * g0.ppb) * k, y: b.top + (STRIP + r * ROW + ROW / 2) * k, k }; };
  // the same spot in the canvas's own pixels (no screen zoom), for pointers drawn inside the window (KT2 quest)
  const noteLoc = (n) => { if (!S) return null; const g0 = geom(), r = rowOf(g0.rows, n.pitch); if (r < 0 || STRIP + r * ROW > g0.cv.clientHeight - ROW / 2) return null; return { x0: OX + n.start * g0.ppb, x1: OX + (n.start + n.length) * g0.ppb, y: STRIP + r * ROW, h: ROW, cv: g0.cv }; };
  // the size of the locked chords in the open clip (median notes per locked chord), for the CHORD SIZE card on AUTO
  window.KT2LockSize = () => { if (!S || !S.notes) return 0; const L = lockedChords(S.notes.filter((n) => n.locked && (S.voice !== "*" || !n._v))); if (!L.length) return 0; const z = L.map((x) => x.ps.length).sort((x, y) => x - y); return z[Math.floor(z.length / 2)]; };
  window.TmMidiRefit = () => { for (const st of STATES.values()) if (st && st.pane) fitBar(st.pane); };
  window.TmMidi = { _lastHear: () => S && S.lastHear, _dice: { compute: diceCompute, exact: exactStack, stackCount, stackN, rollPart, hearChords, plan, diceContext, parsePrompt: parseDicePrompt, shape: shapeByPrompt, slides: diceSlides, setS: (s) => { S = s; }, LOW, HIGH }, _s: () => S, _lastBrain: () => S && S.lastBrain, _pos: notePos, _loc: noteLoc, _keysW: KEYS, _commit: commit, centre: (notes) => { if (S) { centreOn(notes); draw(); } }, setVoice: (id) => { for (const st of STATES.values()) { use(st.pane); setVoice(id); } }, dbg: () => S && { ROW, top: S.top, pane: S.pane.id || S.pane.className, n: (S.notes || []).length }, show, draw, hide: () => { hush(); if (S) { S.sel = null; S.multi = null; } }, chordName, rollChords, SCALES };
})();
