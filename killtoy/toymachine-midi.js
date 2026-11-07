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
  const stripFor = (pane) => (pane && pane.classList.contains("k2t-tmidi") ? 0 : 26);
  // Eman, 4 Nov 19:53: the chord names live in a strip under the notes; the top is the song's ruler
  // (drag the marker, click-drag a yellow loop, double-click loops the bar)
  const footFor = (pane) => (window.TMM_CHORD_FOOT && stripFor(pane) ? 22 : 0);   // V2n: no chord strip (Eman, 4 Nov 23:22); the flag brings it back
  let OX = 0;   // where beat 0 sits on screen (KEYS when not zoomed in; moves left as you scroll a zoomed view)
  let ROW = 22;   // row height: 22 in the big window; in the footer it shrinks so the part fits (fitRows)
  const COLOR = "#8b5cf6", ACID = "#e4ff3a";

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
  function followSongKey() {
    if (window.TMM_KEY_OWN || !S || S.trackId == null || !S.sc || S.sc.songKey === songKeySig()) return false;
    if (!(window.MidiTools && MidiTools.parseKey(ui.state && ui.state.key))) return false;
    S.sc = laneScale(S.trackId); setLaneScale(S.trackId, S.sc);
    const t = S.pane && S.pane.querySelector("#tmm-tonic"), sc = S.pane && S.pane.querySelector("#tmm-scale");
    if (t) t.value = String(S.sc.tonic); if (sc) sc.value = S.sc.scale;
    if (S.notes && S.notes.length) setTimeout(() => { try { commit(); } catch (e) { /* closed */ } }, 0);   // notes now out of key go quiet (or come back)
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
    draw(); commit();
    if (window.KT2Juice && KT2Juice.sound) { const on = rowOpen(p); (on ? KT2Juice.sound.unplug || (() => {}) : KT2Juice.sound.plug)(); }
  }
  function rowPitches(sc, all) { // top to bottom
    const out = [];
    for (let p = HIGH; p >= LOW; p--) if (all || inScale(sc, p)) out.push(p);
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
  function chordName(pitches) {
    const pcs = new Set(pitches.map(pc));
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

  // ---- the chord dice ------------------------------------------------------------------
  let lastProg = "";
  function rollChords(sc, bars) {
    const pool = PROGS[MINORISH.has(sc.scale) ? "minor" : "major"].filter((p) => p.join() !== lastProg);
    const prog = pool[Math.floor(Math.random() * pool.length)];
    lastProg = prog.join();
    const sevenths = Math.random() < 0.5, base = 48 + sc.tonic + (sc.tonic > 6 ? -12 : 0);
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
  function voiceLead(prev, tones) {
    const cands = [];
    for (let inv = 0; inv < tones.length; inv++) for (const oct of [-12, 0, 12]) {
      const v = tones.map((p, i) => p + oct + (i < inv ? 12 : 0)).sort((a, b) => a - b);
      if (v[0] < 50 || v[v.length - 1] > 80) continue;
      cands.push(v);
    }
    if (!cands.length) return tones;
    const centre = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const cost = (v) => prev ? v.reduce((s, p) => s + Math.min(...prev.map((q) => Math.abs(p - q))), 0) : Math.abs(centre(v) - 62);
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
    for (const [id, ns] of [[null, c.notes || []], ...Object.entries(c.stack || {})]) if ((id || null) !== (voice || null)) out.push(...ns.filter((n) => !n.muted));
    const st = ui.state, spb = secPerBeat(), beats = c.beats || 16, c0 = c.start, c1 = c.start + beats * spb;
    for (const t of (st && st.tracks) || []) {
      if (t.id === S.trackId || t.layerOf === S.trackId || t.kind !== "inst" || /drum|kick|clap|hat|perc/i.test((t.instrument || "") + " " + (t.name || ""))) continue;
      if ([...(t.plugins || []), ...t.clips.flatMap((k) => k.plugins || [])].some((p) => p.kit)) continue;
      for (const k of t.clips) {
        if (k.kind !== "midi" || k.start >= c1 || k.start + k.length <= c0) continue;
        for (const n of k.notes || []) {
          if (n.muted) continue;
          const a = (k.start + n.start * spb - c0) / spb, e = a + n.length;
          if (e > 0 && a < beats) out.push({ pitch: n.pitch, start: Math.max(0, a), length: Math.min(beats, e) - Math.max(0, a) });
        }
      }
    }
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
        const lo = g.map((n) => { let p = n.pitch - 2; if (sc && !inScale(sc, p)) p = n.pitch - 1; return { pitch: p, start: t - 0.25, length: 0.375, velocity: Math.max(40, (n.velocity || 100) - 20) }; });
        added.push(...lo); pair(lo, g); made++; last = t;
      }
    });
    return notes.concat(added);
  }
  function rollPart(mode, speed, sc, c, voice, keep) {
    const beats = Math.max(1, c.beats || 16), ctx = diceContext(c, voice).concat(keep || []), H = plan(sc, ctx, beats), notes = [];
    const v = (base, spread) => Math.max(40, Math.min(127, base + Math.round((Math.random() - 0.5) * (spread || 12))));
    if (mode === "chords") {
      let prev = null;
      const hits = [[[0, 4]], [[0, 2], [2, 2]], [[0, 0.75], [1.5, 0.75], [3, 0.75]], [[0, 0.4], [0.5, 0.4], [1, 0.4], [1.5, 0.4], [2, 0.4], [2.5, 0.4], [3, 0.4], [3.5, 0.4]]][speed];
      const sevenths = Math.random() < 0.45;
      for (let bar = 0; bar * 4 < beats; bar++) for (const [o, len] of hits) {
        const at = bar * 4 + o; if (at >= beats) continue;
        const deg = H.at(at);
        if (!prev || speed === 0 || o === 0 || o === 2) { const tones = [0, 2, 4].concat(sevenths && deg !== 6 ? [6] : []).map((x) => degreePitch(sc, deg + x, 48 + sc.tonic)); prev = voiceLead(prev, tones); }
        for (const p of prev) notes.push({ pitch: p, start: at, length: Math.min(len, beats - at), velocity: v(speed >= 2 && o % 1 ? 84 : 98, 10) });
      }
    } else if (mode === "bass") {
      const base = 36 + sc.tonic + (sc.tonic > 7 ? -12 : 0);
      const root = (beat) => degreePitch(sc, H.at(beat), base), fifth = (beat) => degreePitch(sc, H.at(beat) + 4, base);
      const pat = [[[0, 4, "r"]], [[0, 2, "r"], [2, 2, "f"]], [[0, 0.45, "r"], [0.5, 0.45, "r"], [1, 0.45, "r"], [1.5, 0.45, "o"], [2, 0.45, "r"], [2.5, 0.45, "r"], [3, 0.45, "r"], [3.5, 0.45, "o"]],
        rnd([[[0, 1.5, "r"], [1.5, 1, "r"], [2.75, 0.5, "o"], [3.25, 0.75, "f"]], [[0, 0.75, "r"], [0.75, 0.75, "r"], [2, 1, "f"], [3.5, 0.5, "o"]], [[0, 2.5, "r"], [2.5, 0.5, "o"], [3, 1, "r"]]])][speed];
      for (let bar = 0; bar * 4 < beats; bar++) for (const [o, len, k] of pat) {
        const at = bar * 4 + o; if (at >= beats) continue;
        const r = root(at), p = k === "f" ? fifth(at) - (fifth(at) - r > 7 ? 12 : 0) : k === "o" ? r + 12 : r;
        const n = { pitch: p, start: at, length: Math.min(len, beats - at), velocity: v(k === "r" ? 108 : 96, 8) };
        if (speed === 3 && k === "o" && Math.random() < 0.5) n.slide = true;
        notes.push(n);
      }
    } else if (mode === "arp") {
      const step = [1, 0.5, 0.25, 0.25][speed], up = Math.random() < 0.6, oct = speed === 3 ? 2 : 1;
      let i = 0, segDeg = null;
      for (let at = 0; at < beats - 1e-6; at += step) {
        const deg = H.at(at);
        if (deg !== segDeg) { segDeg = deg; i = 0; }
        const tones = [];
        for (let o = 0; o <= oct; o++) for (const x of [0, 2, 4]) tones.push(degreePitch(sc, deg + x, 60 + sc.tonic - (sc.tonic > 5 ? 12 : 0)) + o * 12);
        const seq = up ? tones : tones.concat(tones.slice(1, -1).reverse());
        const p = seq[i++ % seq.length] + (speed === 3 && i % 4 === 0 ? 12 : 0);
        notes.push({ pitch: Math.min(96, p), start: at, length: step * 0.9, velocity: v(at % 1 === 0 ? 104 : 88, 10) });
      }
    } else {   // melody: a two-bar idea, answered, ending on a chord tone
      const cells = [
        [[[0, 2], [2, 2]], [[0, 3], [3, 1]], [[0, 4]], [[0, 1], [1, 3]]],
        [[[0, 1], [1, 0.5], [1.5, 0.5], [2, 2]], [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]], [[0.5, 0.5], [1, 1], [2, 1.5]], [[0, 1], [1, 1], [2, 0.5], [2.5, 1.5]]],
        [[[0, 0.5], [0.5, 0.5], [1, 0.75], [1.75, 0.25], [2, 0.5], [3, 0.5], [3.5, 0.5]], [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2.5, 0.5], [3, 1]], [[0.5, 0.5], [1, 0.5], [1.5, 1], [2.75, 0.25], [3, 1]]],
        [[[0, 0.25], [0.25, 0.25], [0.5, 0.25], [0.75, 0.25], [1, 0.5], [1.5, 0.5], [2, 0.25], [2.25, 0.25], [2.5, 0.25], [2.75, 0.25], [3, 1]], [[0, 0.5], [0.5, 0.25], [0.75, 0.25], [1, 0.25], [1.25, 0.25], [1.5, 0.5], [2, 1], [3, 0.25], [3.25, 0.25], [3.5, 0.5]]],
      ][speed];
      const idea = [rnd(cells), rnd(cells)], scPcs = scalePcs(sc), lo = 64 + sc.tonic - (sc.tonic > 4 ? 12 : 0), hi = lo + 17;
      let p = nearestIn(triadPcs(sc, H.at(0)), lo + 7), dir = Math.random() < 0.5 ? 1 : -1;
      const contour = [];
      for (let bar = 0; bar * 4 < beats; bar++) {
        const cell = idea[bar % 2], answer = bar % 4 >= 2;
        cell.forEach(([o, len], j) => {
          const at = bar * 4 + o; if (at >= beats) return;
          const strong = o % 1 === 0, chord = triadPcs(sc, H.at(at));
          if (answer && contour[(bar % 2) * 16 + j] != null && Math.random() < 0.7) p = contour[(bar % 2) * 16 + j] + (Math.random() < 0.5 ? 0 : (dir > 0 ? -2 : 2));
          else {
            if (Math.random() < 0.25 || p > hi - 2 || p < lo + 2) dir = p > hi - 2 ? -1 : p < lo + 2 ? 1 : -dir;
            const leap = Math.random() < (speed >= 2 ? 0.15 : 0.3) ? 2 : 1;
            let q = p; for (let k = 0; k < leap; k++) { q += dir; while (!scPcs.includes(pc(q))) q += dir; }
            p = q;
          }
          if (strong) p = nearestIn(chord, p);
          else if (!scPcs.includes(pc(p))) p = nearestIn(scPcs, p);
          p = Math.max(lo, Math.min(hi, p));
          contour[(bar % 2) * 16 + j] = p;
          notes.push({ pitch: p, start: at, length: Math.min(len * (speed >= 2 ? 0.85 : 0.95), beats - at), velocity: v(strong ? 104 : 90, 10) });
        });
      }
      // land the last note on the chord's root or third, a bit longer
      const last = notes[notes.length - 1];
      if (last) { last.pitch = nearestIn(triadPcs(sc, H.at(last.start)).slice(0, 2), last.pitch); last.length = Math.max(last.length, Math.min(1.5, beats - last.start)); }
    }
    return { notes, heard: H.heard, segs: H.segs };
  }

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

  function build(pane) {
    pane.replaceChildren();
    if (!pane.dataset.tmmWired) {   // whatever the hand does in a view works on that view's own state
      pane.dataset.tmmWired = "1";
      for (const t of ["pointerdown", "mousedown", "mousemove", "wheel", "click", "change", "input", "keydown"]) pane.addEventListener(t, () => use(pane), true);
    }
    const opt = (v, t, on) => `<option value="${v}"${on ? " selected" : ""}>${t}</option>`;
    pane.innerHTML = `
      <div class="tune-head tmm-head">
        <div class="tune-actions tmm-bar">
          <div class="tmm-grp tmm-mode" id="tmm-mode" title="MIDI: the notes. ADVANCED: the same notes, plus pitch lines and wobble on each one"><button id="tmm-mode-notes" class="on">MIDI</button><button id="tmm-mode-adv">Advanced</button></div>
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
            <button class="tmm-octbtn" id="tmm-octdn" title="Everything down an octave">\u25BC</button><button class="tmm-octbtn" id="tmm-octup" title="Everything up an octave">\u25B2</button></div>
          <div class="tmm-grp tmm-zm" title="How big the notes look">
            <span class="tmm-zl" title="Note height">\u2195</span><button class="tmm-octbtn" id="tmm-hdn" title="Thinner notes">\u2212</button><button class="tmm-octbtn" id="tmm-hup" title="Taller notes">+</button>
            <span class="tmm-zl" title="Zoom"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 10l4.5 4.5" stroke="currentColor" stroke-width="2"/></svg></span><button class="tmm-octbtn" id="tmm-zdn" title="Zoom out">\u2212</button><button class="tmm-octbtn" id="tmm-zup" title="Zoom in (scroll sideways to move along)">+</button></div>
          <label class="tmm-grp tmm-ghost" title="Show the other lanes' notes faintly behind this grid, to write against them">
            <input type="checkbox" id="tmm-ghost"> <span class="tmm-lbl">Reference</span><svg class="tmm-ico tmm-eye" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg> <select id="tmm-ghostsel"><option value="all">ALL</option></select></label>
          <div class="tmm-grp tmm-end">
            <button class="link tmm-ib" id="tmm-play" title="Play this clip"><svg class="tmm-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg><span class="tmm-lbl">Play</span></button>
            <button class="link tmm-ib" id="tmm-clear" title="Clear all notes"><svg class="tmm-ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span class="tmm-lbl">Clear</span></button>
</div>
          <div class="tmm-grp tmm-moregrp" id="tmm-moregrp" hidden><button class="link tmm-ib tmm-more" id="tmm-more" title="More: the tools that didn't fit">\u22EF</button></div>
        </div>
        <div class="tune-actions tmm-morepop" id="tmm-morepop" hidden></div>
      </div>
      <div class="tmm-wrap"><canvas class="tmm-canvas" id="tmm-canvas"></canvas><div class="tmm-menu" id="tmm-menu" hidden></div><div class="tmm-chips" id="tmm-chips"></div><div class="tmm-pick" id="tmm-pick" hidden></div>
        <div class="tmm-dock" id="tmm-dock" hidden>
          <button data-tool="move" class="on" title="Move: notes as usual. Points on a pitch line can still be dragged"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span>Move</span></button>
          <button data-tool="pitch" title="Pitch: press on a note and drag a line to anywhere, the sound follows it. Two picked notes: builds the glide between them. Press again on a line's end to add a bend. Right-click takes it off"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M3 18h5c5 0 6-12 11-12h2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/><circle cx="3.5" cy="18" r="2.2" fill="currentColor"/><circle cx="20.5" cy="6" r="2.2" fill="currentColor"/></svg><span>Pitch</span></button>
          <button data-tool="wobble" title="Wobble: press a note and drag up for more, down for less, sideways for faster or slower. Right-click takes it off"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M2 12c2.5-7 5-7 7.5 0s5 7 7.5 0 3.5-5 5-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Wobble</span></button>
          <span class="tmm-dsep"></span>
          <span class="tmm-dset" id="tmm-dset">
            <button class="tmm-dknob" data-k="d" title="Wobble depth (drag up or down, or scroll)"><b>Depth</b><i id="tmm-wd">0.5 st</i></button>
            <button class="tmm-dknob" data-k="r" title="Wobble speed, in note lengths (drag sideways, scroll, or click for the next)"><b>Rate</b><i id="tmm-wr">1/8</i></button>
            <button class="tmm-dknob" data-k="f" title="Fade: the wobble grows in over this much of the note (drag, or scroll)"><b>Fade</b><i id="tmm-wf">0%</i></button>
            <button class="tmm-dknob" data-k="sh" title="Shape of the wobble (click)"><b>Shape</b><i id="tmm-ws">&#8767;</i></button>
          </span>
          <span class="tmm-dsep"></span>
          <button id="tmm-advclear" title="Take the pitch lines and wobble off the picked notes (or every note when none is picked)"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg><span>Clear</span></button>
        </div>
      </div>
      <div class="iw-empty" id="tmm-empty" hidden>No MIDI clip on this lane yet. Double-click the lane to add one.</div>
      <div class="tune-hint" hidden>Notes outside the scale are greyed out and locked, so whatever you draw is in key (Out of key lets you write there too). Click a note to select it, click empty space to add one, drag to move, drag its end to resize, right-click or Delete removes. Each note shows how its sound fades (from the synth's envelope). Cmd-drag a box over notes for Compound (glue them into one block) and Slide in / Slide out. Drag one selected note to move them all; arrows move them, Delete removes them. The chord of each bar is named on top. Roll chords writes a progression in the scale; Cmd+Z undoes it.</div>`;
    const q = (id) => pane.querySelector("#" + id);
    advBuild(pane, q);
    q("tmm-tonic").onchange = q("tmm-scale").onchange = () => {
      S.sc = { ...S.sc, tonic: Number(q("tmm-tonic").value), scale: q("tmm-scale").value, free: S.all, songKey: songKeySig() };
      setLaneScale(S.trackId, S.sc);
      draw(); if (S.notes && S.notes.length) commit();   // notes now out of key go quiet (or come back)
    };
    // Reference: other lanes' notes, faint, behind the grid (Eman, 31 Oct). Turning it on starts on ALL.
    q("tmm-ghost").onchange = () => { S.ghost = q("tmm-ghost").checked; if (S.ghost) { S.ghostSel = "all"; q("tmm-ghostsel").value = "all"; } saveGhost(); draw(); };
    q("tmm-ghostsel").onchange = () => { S.ghostSel = q("tmm-ghostsel").value; if (!S.ghost) { S.ghost = true; q("tmm-ghost").checked = true; } saveGhost(); draw(); };
    // ONLY KEY (Eman, 31 Oct): on = notes outside the scale are greyed and muted (still there); off = everything plays
    q("tmm-all").onclick = () => {
      S.all = !S.all; q("tmm-all").classList.toggle("on", !S.all);
      S.sc = { ...S.sc, free: S.all }; setLaneScale(S.trackId, S.sc);
      draw(); if (S.notes && S.notes.length) commit();
    };
    q("tmm-grid").onchange = () => { S.grid = Number(q("tmm-grid").value); draw(); };
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
      if (S.notes.some((n) => n.pitch + d * 12 < LOW || n.pitch + d * 12 > HIGH)) return toast(d > 0 ? "Already as high as it goes" : "Already as low as it goes");
      for (const n of S.notes) n.pitch += d * 12;
      const rows = rowPitches(S.sc, true), per = rows.filter((p) => p > 60 && p <= 72).length || 7; // rows in one octave
      S.top = Math.max(0, Math.min(rows.length - 8, S.top - d * per));   // the view follows the notes
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
    const showDice = () => {
      q("tmm-dmode").value = dice.mode;
      const k = q("tmm-speed"); k.style.setProperty("--a", (-135 + dice.speed * 90) + "deg"); k.setAttribute("aria-valuenow", dice.speed);
      q("tmm-spdl").textContent = DICE_SPEEDS[dice.mode][dice.speed];
    };
    showDice();
    const showSl = () => { const b = q("tmm-dslide"); b.classList.toggle("on", !!dice.slide); b.setAttribute("aria-pressed", String(!!dice.slide)); };
    showSl();
    q("tmm-dslide").onclick = () => { dice.slide = !dice.slide; saveDice(); showSl(); };
    q("tmm-dmode").onchange = () => { dice.mode = q("tmm-dmode").value; saveDice(); showDice(); };
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
    q("tmm-dice").onclick = () => {
      const c = S.clipId && findClip(S.clipId);
      if (!c) return;
      const keep = S.notes.filter((n) => n.locked && (S.voice !== "*" || !n._v));   // locked notes stay (Eman, 4 Nov)
      const r = rollPart(dice.mode, dice.speed, S.sc, c, S.voice === "*" ? null : S.voice, keep);
      if (dice.slide) r.notes = diceSlides(r.notes, S.all ? null : S.sc);
      if (keep.length) {   // what's rolled fits around them: no doubling a locked pitch, one line stays one line
        const poly = dice.mode === "chords", hit = (a, b) => a.start < b.start + b.length - 1e-6 && b.start < a.start + a.length - 1e-6;
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
          r.notes = out.concat(keep);
        }
      }
      if (S.voice === "*") r.notes = r.notes.concat(S.notes.filter((n) => n._v));   // ALL: the dice writes the main sound
      S.notes = r.notes.map((n) => ({ ...n, pitch: Math.max(LOW, Math.min(HIGH, n.pitch)) })); S.sel = null; S.multi = null;
      centreOn(S.notes);
      popNotes(S.notes, true);
      draw(); commit();
      const ic = q("tmm-dice").querySelector("svg");
      if (ic && ic.animate) ic.animate([{ rotate: "0deg", scale: "1" }, { rotate: "200deg", scale: "1.25" }, { rotate: "360deg", scale: "1" }], { duration: 420, easing: "cubic-bezier(.2,.8,.3,1)" });
      if (window.KT2Juice && KT2Juice.sound && KT2Juice.sound.dice) KT2Juice.sound.dice();
      const names = [];
      for (let i = 0; i < r.segs.length && names.length < 4; i += 2) { const d = r.segs[i] && r.segs[i].deg; if (d == null) continue; const nm = chordName([0, 2, 4].map((x) => degreePitch(S.sc, d + x, 60 + S.sc.tonic))); if (names[names.length - 1] !== nm) names.push(nm); }
      toast(dice.mode === "chords" && !r.heard ? names.join(" \u2013 ") : `${DICE_MODES[dice.mode]} ${r.heard ? "over what's there" : "over"}: ${names.join(" \u2013 ")}`);
    };
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
      if (b) ({ compound, uncompound, slideIn, slideOut, pull: pullPicked, lock: lockPicked, close: () => { S.multi = null; S.sel = null; draw(); } })[b.dataset.act]();
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
      const h = hit(e);
      if (STRIP > 0 && local(cv, e).y < STRIP && h.x >= KEYS) {   // the ruler: loop this bar
        // double-click the yellow loop that's already there: it goes away (Eman, 7 Nov V4m)
        if (performance.now() - (S.loopClearedAt || 0) < 600) return;
        if (S.loopOn && S.loopPx && h.x >= S.loopPx[0] - 2 && h.x <= S.loopPx[1] + 2) { loopOff(); return; }
        const c = findClip(S.clipId), spb = secPerBeat(), bar = Math.floor(Math.max(0, h.beat) / 4) * 4;
        if (c) loopRange(c.start + bar * spb, c.start + Math.min(bar + 4, (c.beats || 16)) * spb);
        return;
      }
      if (!h.note) return;
      S.multi = new Set(groupOf(h.note) || [h.note]); S.sel = null; draw();
    });
    cv.addEventListener("mousemove", (e) => {
      if (!S || S.drag || S.advDrag) return;
      const h = hit(e), kh = h.x < KEYS && h.pitch != null ? h.pitch : null;
      if (S.adv && h.x >= KEYS) { const g0 = geom(); const hp = advHandleAt(local(cv, e), g0.rows, g0.ppb); cv.style.cursor = hp ? "grab" : S.tool === "pitch" ? "crosshair" : S.tool === "wobble" ? "ns-resize" : h.note ? (h.nearEnd ? RESIZE_CUR : "move") : "crosshair"; if (kh !== S.keyHover) { S.keyHover = kh; draw(); } return; }
      cv.style.cursor = h.x < KEYS ? (h.x > KEYS - 28 && h.pitch != null ? "pointer" : "default") : h.note ? (h.nearEnd ? RESIZE_CUR : "move") : "crosshair";
      if (kh !== S.keyHover) { S.keyHover = kh; draw(); }
    });
    cv.addEventListener("mouseleave", () => { if (S && S.keyHover != null) { S.keyHover = null; draw(); } });
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
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
      S.top = Math.max(0, Math.min(rows.length - 8, S.top + (e.deltaY > 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(e.deltaY) / 30))));
      draw();
    }, { passive: false });
    new ResizeObserver(() => { if (!S || S.drag) return; const was = S; if (use(pane)) draw(); if (was && was !== S && STATES.get(was.pane) === was) use(was.pane); }).observe(cv);
  }

  function fitBar(pane) {
    const q = (id) => pane.querySelector("#" + id), bar = pane.querySelector(".tmm-bar"), pop = q("tmm-morepop"), mg = q("tmm-moregrp");
    if (!bar || !pop || !mg) return;
    const w = bar.clientWidth, key = w + "|" + q("tmm-voices").hidden + "|" + q("tmm-voices").childElementCount;
    if (w && key === bar._fitKey) return;
    bar._fitKey = key;
    for (const g of [...pop.children]) bar.append(g);
    [...bar.children].sort((a, b) => a.dataset.ord - b.dataset.ord).forEach((g) => bar.append(g));
    bar.classList.remove("tmm-narrow", "tmm-tight"); mg.hidden = true; pop.hidden = true;
    if (!w || pane.classList.contains("k2t-tmidi")) return;
    const over = () => bar.scrollWidth > bar.clientWidth + 1;
    if (!over()) return;
    bar.classList.add("tmm-narrow"); mg.hidden = false;
    for (const cls of ["tmm-ghost", "tmm-oct", "tmm-lg", "tmm-end", "tmm-zm"]) { if (!over()) break; const g = bar.querySelector(":scope > ." + cls); if (g) pop.append(g); }
    if (!pop.children.length) mg.hidden = true;
    if (over()) bar.classList.add("tmm-tight");   // last resort: the speed's name goes (the knob stays)
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
  function centreOn(notes) {
    fitRows(true);
    const rows = rowPitches(S.sc, true), ps = notes.map((n) => n.pitch);
    const mid = ps.length ? (Math.min(...ps) + Math.max(...ps)) / 2 : 60 + S.sc.tonic;
    const i = rows.findIndex((p) => p <= mid);
    const cv = S.pane.querySelector("#tmm-canvas"), vis = Math.max(8, Math.floor((cv.clientHeight - STRIP - FOOT) / ROW));
    S.top = Math.max(0, i - Math.floor(vis / 2));
  }

  // Mount into the lane window's MIDI pane for this lane's clip (again on every state change).
  function show(pane, trackId, clipId) {
    const q0 = (id) => pane.querySelector("#" + id);
    if (!STATES.has(pane) || !pane.querySelector("#tmm-canvas")) { build(pane); STATES.set(pane, { pane, grid: 0.25, all: false, lastLen: 1, pending: 0, row: 22, ...loadGhost() }); }
    use(pane);
    const fresh = S.trackId !== trackId || S.clipId !== clipId;
    S.trackId = trackId; S.clipId = clipId;
    if (fresh) { S.sc = laneScale(trackId); S.all = !!S.sc.free; S.sel = null; S.multi = null; q0("tmm-all").classList.toggle("on", !S.all); }
    const c = clipId && findClip(clipId);
    const q = (id) => pane.querySelector("#" + id);
    q("tmm-canvas").hidden = !c; q("tmm-empty").hidden = !!c;
    for (const id of ["tmm-bars", "tmm-grid", "tmm-dice", "tmm-dmode", "tmm-play", "tmm-clear", "tmm-octup", "tmm-octdn"]) q(id).disabled = !c;
    voicesBar(pane, trackId, c);
    if (c && !S.drag && !S.pending) {
      // Fresh copies of the notes: pick the same ones again.
      const key = (n) => n.pitch + "@" + n.start + "/" + n.length;
      const want = new Set(picked().map(key)), one = S.sel && key(S.sel);
      S.notes = voiceNotes(c, S.voice).map((n) => ({ ...n }));
      S.multi = new Set(S.notes.filter((n) => want.has(key(n))));
      S.sel = one ? S.notes.find((n) => key(n) === one) || null : null;
    }
    if (!c) S.notes = [];
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
    box.hidden = !S.voices.length;
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
        if (!v.linked) return setVoice(v.id);
        run("setLayerLinked", { trackId: v.lane, linked: false }).then(async () => {
          try { const f = await booth("getState", {}); if (f && f.tracks) ui.state = f; } catch (e) { /* fine */ }
          setVoice(v.lane);
          if (typeof refreshLaneWindow === "function") refreshLaneWindow();
        });
      };
      return b;
    }));
  }
  function setVoice(id) {
    if (!S) return;
    S.voice = id || null; S.sel = null; S.multi = null;
    const c = S.clipId && findClip(S.clipId);
    voicesBar(S.pane, S.trackId, c);
    S.notes = voiceNotes(c, S.voice).map((n) => ({ ...n }));
    draw();
  }

  // The lane's TOY MACHINE amp envelope (seconds), so every note can be drawn as its sound.
  function loadEnv(trackId, c, fresh) {
    const t = ui.state && ui.state.tracks.find((x) => x.id === trackId);
    const p = t && window.ToyMachineUI && [...((c && c.plugins) || []), ...(t.plugins || []), ...t.clips.flatMap((k) => k.plugins || [])].find((x) => /toy machine/i.test(x.name || "") || x.instrument);
    if (!p || (!fresh && Date.now() - (S.envAt || 0) < 1500)) return;
    S.envAt = Date.now();
    Promise.resolve(booth("toyMachineGetPreset", { pluginId: p.id })).then((g) => {
      if (!S || !g || !g.preset) return;
      const pr = typeof g.preset === "string" ? JSON.parse(g.preset) : g.preset;
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
          ghostNote(g, OX + b0 * ppb, STRIP + r * ROW, Math.max(4, (b1 - b0) * ppb), ROW, ink);
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

  function draw() {
    if (!S || !S.clipId) return;
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
        g.fillText(NAMES[pc(p)] + (Math.floor(p / 12) - 1), 8, y + ROW / 2 + 1);
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
        ghostNote(g, OX + n.start * ppb, STRIP + r * ROW, Math.max(4, n.length * ppb), ROW, v.color);
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
      const col = S.drag && S.drag.note === n ? "#fff" : grey ? (live ? "#9a9aa4" : "#5a5a63") : live ? (n.slide ? "#f6ffb8" : "#ece4ff") : n.slide ? ACID : (n._v ? vcolOf(n._v) : S.vcol) || COLOR, vel = 0.55 + 0.45 * (n.velocity || 100) / 127;
      const fxk = noteFx(n);
      if (fxk === null) continue;   // still waiting for its turn to pop in
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
          g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(bx + bh * 0.55, by + bh * 0.35, bh * 0.18, bh * 0.12, 0, 0, 7); g.fill();
          if (bw - bh * 1.6 > 2) { g.fillStyle = "rgba(255,255,255,0.18)"; roundRect(g, bx + bh * 0.9, by + bh * 0.22, bw - bh * 1.6, bh * 0.18, bh * 0.09); g.fill(); }
        }
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
    }
    // Slides: a curve from the note it glides from to the slide note, over their overlap.
    // In ADVANCED they recede (dissolved, Eman 7 Nov): the pitch lines and wobbles are the picture there.
    const dis = S.adv ? 0.22 : 1;
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

  // ---- the menu over the selection: Compound, Slide in, Slide out ----------------------
  function placeMenu(rows, ppb, vis) {
    const m = S.pane.querySelector("#tmm-menu"), ns = S.multi && S.multi.size ? picked() : [];
    const b = !S.drag && !S.box && ns.length ? boxOf(ns, rows, ppb, vis) : null;
    if (!b) { m.hidden = true; return; }
    const ids = new Set(ns.map((n) => n.group)), whole = ids.size === 1 && !ids.has(undefined) && groupOf(ns[0]).length === ns.length;
    const sIn = slideInPlan(ns), sOut = slideOutPlan(ns);
    const html = (whole ? `<button data-act="uncompound" title="Unglue: the notes move on their own again">Uncompound</button>`
      : ns.length < 2 ? "" : `<button data-act="compound" title="Glue these notes into one block that moves and stretches as one">Compound</button>`)
      + `<button data-act="slideIn" class="${sIn.on ? "on" : ""}" title="Glide into these notes from the notes just before them${sIn.on ? ". Tab: try the other ways (which note goes to which)" : ""}">Slide in${sIn.on ? " \u2713" + cycLabel("in", sIn.heads) : ""}</button>`
      + `<button data-act="slideOut" class="${sOut.on ? "on" : ""}" title="Glide from these notes into the notes right after them${sOut.on ? ". Tab: try the other ways (which note goes to which)" : ""}">Slide out${sOut.on ? " \u2713" + (sIn.on ? "" : cycLabel("out", sOut.next)) : ""}</button>`
      + (pullTarget(ns) ? (() => { const t = pullTarget(ns); return `<button data-act="pull" class="${t.pull ? "on" : ""}" title="${t.pull ? "Pull up: the chords under this note bend up into it. Click: a longer or shorter bend, then off" : "Pull up: every chord under this long note plays, then bends up into it on a curve"}">Pull up${t.pull ? " \u2713<span class=\"tmm-cyc\">" + PULL_NAMES[pullIdx(t.pullAt)] + "</span>" : ""}</button>`; })() : "")
      + (() => { const on = ns.every((n) => n.locked); return `<button data-act="lock" class="lk${on ? " on" : ""}" title="${on ? "Locked: the dice keeps these notes. Click to unlock" : "Lock: the dice keeps these notes and builds the rest around them"}"><svg viewBox="0 0 16 16" width="13" height="13" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><rect x="3" y="7" width="10" height="7"/><path fill="none" d="${on ? "M5 7V5a3 3 0 0 1 6 0v2" : "M5 7V4.5a3 3 0 0 1 5.6-1.5"}"/></svg><span>${on ? "LOCKED" : "LOCK"}</span></button>`; })()
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
  const nm = (p) => NAMES[pc(p)] + (Math.floor(p / 12) - 1);
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
  const WOB_RATES = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];   // cycles per beat
  const RATE_NAMES = { 0.25: "1 bar", 0.5: "1/2", 1: "1/4", 1.5: "1/4T", 2: "1/8", 3: "1/8T", 4: "1/16", 6: "1/16T", 8: "1/32", 12: "1/32T", 16: "1/64" };
  const rateName = (r) => RATE_NAMES[r] || (+r).toFixed(1) + "/beat";
  const WOB_SHAPES = ["\u223f", "\u22c0", "\u2293", "\u25e9"];   // sine, triangle, square, saw
  const WOB_DEF = { d: 0.5, r: 2, f: 0, sh: 0 };
  const clampN = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
  const advOn = () => !!(S && S.adv);
  const advPts = (n) => (n && Array.isArray(n.bend) ? n.bend : []);
  const hasExpr = (n) => advPts(n).length > 0 || !!(n.wob && n.wob.d > 0);
  // what goes into the clip (commit / copy)
  const advOut = (bend, wob, length) => ({
    ...(Array.isArray(bend) && bend.length ? { bend: bend.map((p) => [+clampN(0, length, p[0]).toFixed(4), +(+p[1]).toFixed(3), ...(p[2] && p[2] !== 1 ? [+(+p[2]).toFixed(2)] : [])]) } : {}),
    ...(wob && wob.d > 0 ? { wob: { d: +(+wob.d).toFixed(3), r: +(+(wob.r || 2)).toFixed(3), ...(wob.f ? { f: +(+wob.f).toFixed(3) } : {}), ...(wob.sh ? { sh: wob.sh } : {}) } } : {}),
  });
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
    const env = w.f > 0 ? Math.min(1, t / Math.max(1e-6, w.f * n.length)) : 1;
    const ph = t * (w.r || 2) + (playing ? 0 : tNow * 0.3), x = ph - Math.floor(ph), sh = w.sh || 0;
    const v = sh === 1 ? (x < 0.5 ? 4 * x - 1 : 3 - 4 * x) : sh === 2 ? Math.tanh(6 * Math.sin(2 * Math.PI * x)) : sh === 3 ? 1 - 2 * x : Math.sin(2 * Math.PI * x);
    return w.d * env * v;
  }
  const soundAt = (n, t, tNow, playing) => n.pitch + bendAt(n, t) + wobAt(n, t, tNow, playing);
  // screen y of a pitch that may sit between rows (and rows may skip pitches when folded to the key)
  function yOfPitch(rows, p) {
    p = clampN(LOW, HIGH, p);
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
    const dock = q("tmm-dock");
    dock.addEventListener("mousedown", (e) => e.stopPropagation());
    for (const b of dock.querySelectorAll("button[data-tool]")) b.onclick = () => {
      const t = b.dataset.tool;
      // PITCH with two or more notes picked: build the glide between them right away (Eman: "if you select two, you can build a pitch between them")
      if (t === "pitch" && picked().length >= 2) { advTool("pitch"); advBetween(picked()); return; }
      advTool(S.tool === t && t !== "move" ? "move" : t);
    };
    q("tmm-advclear").onclick = () => {
      const ns = picked().length ? picked() : S.notes.filter(hasExpr);
      if (!ns.length) return;
      for (const n of ns) { delete n.bend; delete n.wob; }
      draw(); commit(); advDock();
    };
    // the wobble readouts: drag them (or scroll) to change the picked notes' wobble; click Shape / Rate steps on
    for (const k of dock.querySelectorAll(".tmm-dknob")) {
      const key = k.dataset.k;
      const targets = () => { const ps = picked(); const have = ps.filter((n) => n.wob && n.wob.d > 0); return have.length ? have : ps.length ? ps : S.notes.filter((n) => n.wob && n.wob.d > 0); };
      const step = (ns, d, dx) => {
        for (const n of ns) {
          const w = { ...WOB_DEF, ...(n.wob || {}) };
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
        const prev = ns.map((n) => JSON.stringify(n.wob || null)), base = ns.map((n) => ({ ...WOB_DEF, ...(n.wob || {}) }));
        const x0 = e.clientX, y0 = e.clientY; let moved = false;
        const mv = (ev) => {
          const dy = y0 - ev.clientY, dx = ev.clientX - x0;
          if (Math.abs(dy) > 2 || Math.abs(dx) > 2) moved = true;
          ns.forEach((n, i) => { const w = { ...base[i] };
            if (key === "d") w.d = +clampN(0.05, 12, base[i].d * Math.exp(dy / 60)).toFixed(2);
            else if (key === "r") w.r = WOB_RATES[clampN(0, WOB_RATES.length - 1, nearestRate(base[i].r) + Math.round(dx / 28))];
            else if (key === "f") w.f = +clampN(0, 1, base[i].f + dy / 120).toFixed(2);
            n.wob = w; });
          advDock(); queueDraw();
        };
        const up = () => {
          window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
          if (!moved && (key === "sh" || key === "r")) step(ns, 1);
          advDock(); draw();
          if (ns.some((n, i) => JSON.stringify(n.wob || null) !== prev[i])) { commit(); advHear(ns[0]); }
        };
        window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      });
      k.addEventListener("wheel", (e) => { e.preventDefault(); e.stopPropagation(); const ns = targets(); if (!ns.length) return; step(ns, e.deltaY < 0 ? 1 : -1); advDock(); draw(); clearTimeout(S.advWheelT); S.advWheelT = setTimeout(() => { commit(); }, 350); }, { passive: false });
    }
  }
  const nearestRate = (r) => WOB_RATES.reduce((b, x, i) => (Math.abs(x - r) < Math.abs(WOB_RATES[b] - r) ? i : b), 0);
  function advShow(pane) {
    if (S.adv == null) S.adv = loadAdv();
    if (!S.tool) S.tool = "move";
    advApply(pane);
  }
  function advMode(on) {
    if (!S) return;
    S.adv = !!on; saveAdv(S.adv);
    if (!S.adv) S.tool = "move";
    advApply(S.pane); draw();
    if (S.adv && window.KT2Juice && KT2Juice.sound && KT2Juice.sound.unplug) KT2Juice.sound.unplug();
  }
  function advApply(pane) {
    const q = (id) => pane.querySelector("#" + id), on = !!S.adv;
    pane.classList.toggle("tmm-advanced", on);
    const a = q("tmm-mode-adv"), b = q("tmm-mode-notes"), d = q("tmm-dock");
    if (a) a.classList.toggle("on", on); if (b) b.classList.toggle("on", !on);
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
  // the dock's readouts follow the wobble being worked on
  function advDock() {
    if (!S || !S.pane) return;
    const q = (id) => S.pane.querySelector("#" + id);
    const ps = picked(), w = (ps.find((n) => n.wob && n.wob.d > 0) || S.notes.find((n) => n.wob && n.wob.d > 0) || {}).wob;
    const set = q("tmm-dset"); if (set) set.classList.toggle("idle", !w);
    const v = w || WOB_DEF;
    if (q("tmm-wd")) q("tmm-wd").textContent = (+v.d).toFixed(v.d >= 2 ? 1 : 2).replace(/\.?0+$/, "") + " st";
    if (q("tmm-wr")) q("tmm-wr").textContent = rateName(v.r || 2);
    if (q("tmm-wf")) q("tmm-wf").textContent = Math.round((v.f || 0) * 100) + "%";
    if (q("tmm-ws")) q("tmm-ws").textContent = WOB_SHAPES[v.sh || 0];
  }

  // ---- drawing: the ribbon, the line, its points, the comet riding it while the song plays
  function advDraw(g, c, rows, ppb, vis, beats, spb, playingNow, pb) {
    const adv = advOn(), tNow = performance.now() / 1000;
    const list = S.notes.filter(hasExpr);
    if (S.advDrag && S.advDrag.note && !list.includes(S.advDrag.note)) list.push(S.advDrag.note);
    let anyWob = false;
    const yTop = STRIP, yBot = S.pane.querySelector("#tmm-canvas").clientHeight - FOOT;
    for (const n of list) {
      const picked1 = S.sel === n || (S.multi && S.multi.has(n)) || (S.advDrag && S.advDrag.note === n);
      const col = n._v ? vcolOf(n._v) : S.vcol || COLOR;
      const x0 = OX + n.start * ppb, x1 = OX + (n.start + n.length) * ppb;
      if (x1 < KEYS - 2 || x0 > OX + beats * ppb + 2) continue;
      const wob = n.wob && n.wob.d > 0;
      anyWob = anyWob || wob;
      const live = playingNow && pb >= n.start && pb < n.start + n.length;
      // the sounded pitch along the note, sampled every 2 px (every 1 px with a wobble)
      const stepPx = wob ? 1 : 2, pts = [];
      for (let x = Math.max(x0, KEYS); x <= x1; x += stepPx) pts.push([x, yOfPitch(rows, soundAt(n, (x - x0) / ppb, tNow, playingNow))]);
      if (pts.length && pts[pts.length - 1][0] < x1) pts.push([x1, yOfPitch(rows, soundAt(n, n.length, tNow, playingNow))]);
      if (pts.length < 2) continue;
      const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
      g.save();
      g.lineCap = "round"; g.lineJoin = "round";
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
      g.restore();
    }
    if (!playingNow && S.trail) S.trail = null;
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
  function advHandleAt(m, rows, ppb) {
    let best = null, bd = 9;
    for (const n of S.notes) {
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
    const { rows, ppb, beats, cv } = geom(), m = local(cv, e);
    const hp = advHandleAt(m, rows, ppb);
    if (hp && e.button === 0 && !e.metaKey && !e.ctrlKey) { advDragHandle(e, hp, rows, ppb, cv); return true; }
    if (hp && e.button === 2) {   // right-click a point: it goes (a line needs two)
      const P = advPts(hp.note); P.splice(hp.i, 1); if (P.length < 2) delete hp.note.bend;
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
    const note = h.note || (sel.length === 1 ? sel[0] : null) || advNoteAt(h, rows);
    if (!note) return true;
    if (sel.length >= 2 && sel.includes(note)) { advBetween(sel); return true; }
    const rel = (mm, ev) => {
      const b = (mm.x - OX) / ppb, snapped = ev.altKey ? b : Math.round(b / S.grid) * S.grid;
      const t = clampN(0, note.length, snapped - note.start), p = pitchAtY(rows, mm.y, ev.shiftKey);
      return [+t.toFixed(4), +(p - note.pitch).toFixed(2)];
    };
    const P = advPts(note), last = P.length ? P[P.length - 1] : null;
    const append = !!last && Math.hypot(OX + (note.start + last[0]) * ppb - m.x, yOfPitch(rows, note.pitch + last[1]) - m.y) < 16;
    const A = append ? last.slice(0, 2) : rel(m, e), base = append ? P.slice() : null, prev = JSON.stringify(note.bend || null);
    S.sel = note; S.multi = null;
    S.advDrag = { note, label: advLabel(note, A), at: m };
    const apply = (B) => {
      if (append) note.bend = base.concat([B]);
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
  // a point of a line is dragged (between its neighbours, inside the note); the middle handle bends the stretch
  // so the line passes through where you drag it
  function advDragHandle(e, hp, rows, ppb, cv) {
    const { note, i, kind } = hp, P = advPts(note), prev = JSON.stringify(note.bend);
    S.sel = note; S.multi = null; S.advDrag = { note, label: "", at: local(cv, e) };
    const move = (ev) => {
      const mm = local(cv, ev), b = (mm.x - OX) / ppb;
      if (kind === "pt") {
        const snapped = ev.altKey ? b : Math.round(b / S.grid) * S.grid;
        const lo = i > 0 ? P[i - 1][0] : 0, hi = i + 1 < P.length ? P[i + 1][0] : note.length;
        P[i][0] = +clampN(lo, hi, clampN(0, note.length, snapped - note.start)).toFixed(4);
        P[i][1] = +(pitchAtY(rows, mm.y, ev.shiftKey) - note.pitch).toFixed(2);
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
      S.advDrag = null; draw();
      if (JSON.stringify(note.bend) !== prev) { commit(); advHear(note); }
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

  function commit() {
    if (!S || !S.clipId) return;
    S.pending++;
    // out of key while ONLY KEY is on: kept, but muted (Eman, 31 Oct)
    const mute = (p) => !rowOpen(p);
    const out = (ns) => ns.map(({ pitch, start, length, velocity, slide, slideFrom, group, locked, pull, pullAt, bend, wob }) => ({ pitch, start, length, velocity: velocity || 100, ...(slide ? { slide: true } : {}), ...(slide && slideFrom != null ? { slideFrom } : {}), ...(group ? { group } : {}), ...(locked ? { locked: true } : {}), ...(pull ? { pull: true, pullAt: pullAt || 0.5 } : {}), ...(mute(pitch) ? { muted: true } : {}), ...advOut(bend, wob, length) }));
    const done = () => { if (S) S.pending = Math.max(0, S.pending - 1); };
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
  function onDown(e) {
    if (!S || !S.clipId) return;
    const { beats, rows: rows0 } = geom(), h = hit(e);   // the same rows the screen shows (moving a group used to count other rows)
    if (STRIP > 0 && e.button === 0 && local(geom().cv, e).y < STRIP && h.x >= KEYS) return rulerDown(e, h);
    if (h.pitch == null) return;
    if (h.x >= KEYS && advDown(e, h)) return;   // ADVANCED: pitch lines, wobble, their handles
    if (h.x < KEYS) {
      if (e.button !== 0) return;
      if (h.x > KEYS - 28) return flipKey(h.pitch);   // the lock at the key's right end
      hear(h.pitch);
      const up = () => { window.removeEventListener("mouseup", up); hush(); };
      return window.addEventListener("mouseup", up);
    }
    if (e.button === 2) { if (h.note) { S.notes.splice(S.notes.indexOf(h.note), 1); S.sel = null; if (S.multi) S.multi.delete(h.note); draw(); commit(); } return; }
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return boxSelect(e, h);
    if (!h.note && !open(h.pitch)) { S.sel = null; S.multi = null; draw(); return; }   // out of key: locked
    // Pressing a note of a compound grabs the whole block.
    const block = groupOf(h.note);
    if (block && !(S.multi && S.multi.has(h.note))) { S.multi = new Set(block); S.sel = null; }
    // Pressing a note that's in the selection moves the whole selection; anything else starts over.
    const group = h.note && S.multi && S.multi.has(h.note) ? picked().filter((n) => n !== h.note).map((n) => ({ n, start: n.start, pitch: n.pitch })) : [];
    if (!group.length) S.multi = null;
    const step = S.grid;
    let note = h.note, mode = "draw", grab = 0;
    if (note) { mode = h.nearEnd ? "resize" : "move"; grab = h.beat - note.start; }
    else {
      const start = Math.max(0, Math.min(beats - step, Math.floor(h.beat / step) * step));
      note = { pitch: h.pitch, start, length: Math.min(S.lastLen, beats - start), velocity: 100 };
      S.notes.push(note);
      fxNote(note, "pop");
    }
    const before = JSON.stringify(note), from = { start: note.start, pitch: note.pitch, length: note.length };
    // stretching: a compound, or every picked note, grows by the same amount (Eman, 4 Nov)
    const stretchSet = mode === "resize" ? (group.length ? group.map((o) => o.n) : block ? block.filter((n) => n !== note) : []) : [];
    const stretch = stretchSet.map((n) => ({ n, length: n.length }));
    S.drag = { note }; S.sel = group.length ? null : note;
    const m0 = { start: note.start, pitch: note.pitch };
    draw(); hear(note.pitch, note.velocity);
    const move = (ev) => {
      const m = hit(ev);
      if (mode === "move") {
        note.start = Math.max(0, Math.min(beats - note.length, Math.round((m.beat - grab) / step) * step));
        // over a locked row the note jumps straight to the nearest open one (Eman, 4 Nov: it hung on the old row and lagged)
        if (m.pitch != null) { const k = toKey(m.pitch, note.pitch); if (rowOpen(k)) note.pitch = k; }
        if (group.length) { // the others follow: same time shift, same number of rows
          const ri = (p) => { const i = rows0.indexOf(p); return i < 0 ? rows0.findIndex((x) => x < p) : i; };
          const dRow = ri(note.pitch) - ri(from.pitch);
          let dt = note.start - from.start;
          dt = Math.max(dt, -Math.min(...group.map((o) => o.start)));
          dt = Math.min(dt, beats - Math.max(...group.map((o) => o.start + o.n.length)));
          for (const o of group) {
            o.n.start = o.start + dt;
            const j = ri(o.pitch) + dRow;
            o.n.pitch = toKey(rows0[Math.max(0, Math.min(rows0.length - 1, j))] ?? o.pitch, o.pitch);
          }
        }
        hear(note.pitch, note.velocity);
        if (note.start !== m0.start || note.pitch !== m0.pitch) { fxNote(note, "step", { dx: Math.sign(note.start - m0.start), dy: Math.sign(note.pitch - m0.pitch) }); m0.start = note.start; m0.pitch = note.pitch; }
      } else {
        note.length = Math.max(note.start + step, Math.min(beats, Math.ceil(m.beat / step) * step)) - note.start;
        const d = note.length - from.length; // a compound stretches as one
        for (const o of stretch) o.n.length = Math.max(step, Math.min(beats - o.n.start, o.length + d));
      }
      queueDraw();   // one paint per screen frame, however fast the mouse sends moves
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      S.drag = null; hush();
      if (mode === "move" && JSON.stringify(note) !== before) { fxNote(note, "drop"); for (const o of group) fxNote(o.n, "drop"); }
      if (mode !== "move") S.lastLen = note.length;
      draw();
      if (mode === "draw" || JSON.stringify(note) !== before || stretch.length) commit();
      else if (!group.length && !h.note) S.multi = null;
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  // Delete / arrows on the picked note while this view shows (the app's keys skip open windows).
  window.addEventListener("keydown", (e) => {
    if (!S || !picked().length || S.pane.hidden || S.pane.closest("[hidden]") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "d" && !window.KT2_CMD_D_DUP) { e.preventDefault(); S.sel = null; S.multi = null; draw(); return; }   // Cmd+D: let go of the notes (Eman, 4 Nov)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const ns = picked(), rows = rowPitches(S.sc, S.all);
    if (e.key === "Tab") { if (cycleSlides(e.shiftKey ? -1 : 1)) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (e.key === "Delete" || e.key === "Backspace") { S.notes = S.notes.filter((n) => !ns.includes(n)); S.sel = null; S.multi = null; }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const up = e.key === "ArrowUp";
      for (const n of ns) {
        if (e.shiftKey) n.pitch = Math.max(LOW, Math.min(HIGH, n.pitch + (up ? 12 : -12)));
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
      const added = clip.map((n) => ({ ...n }));
      S.notes = S.notes.concat(added); S.multi = new Set(added); S.sel = null;
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
  window.TmMidi = { _s: () => S, _pos: notePos, _loc: noteLoc, centre: (notes) => { if (S) { centreOn(notes); draw(); } }, setVoice: (id) => { for (const st of STATES.values()) { use(st.pane); setVoice(id); } }, dbg: () => S && { ROW, top: S.top, pane: S.pane.id || S.pane.className, n: (S.notes || []).length }, show, draw, hide: () => { hush(); if (S) { S.sel = null; S.multi = null; } }, chordName, rollChords, SCALES };
})();
