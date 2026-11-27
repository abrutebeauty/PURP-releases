// ---------------------------------------------------------------------------
// KeyConvert: move notes from one key to another the way a musician rewrites a part
// (Eman, 8 Nov 2026: "convert chords from A minor to F sharp major ... in the closest way possible").
//
// The rules, in plain words:
//  1. Every note in the old scale keeps its scale degree. The 3rd of A minor (C) becomes the 3rd of
//     F# major (A#), the 6th (F) becomes the 6th (D#), and so on. So chords change quality the way the
//     new key wants: Am (i) -> F# (I), F (VI) -> D#m (vi), C (III) -> A#m (iii), G (VII) -> E#dim (vii).
//  2. A note outside the old scale keeps its colour against the new tonic. The raised 3rd/6th/7th of
//     minor (C#, F#, G# in A minor) are the plain 3rd/6th/7th of major, so an E major chord in A minor
//     (V) becomes C# major in F# major (V). The flat 3rd/6th/7th borrowed into a major key become the
//     plain degrees of minor.
//  3. The whole part moves by one shift (up or down, whichever moves the notes least), so chord shapes
//     and the melody's ups and downs stay as they were, and the part stays in its octave.
//
// Pure functions, no DOM. The app loads it as window.KeyConvert; tests require() it in node.
// Every key the app uses goes through parseKey: { tonic, minor, scale? }, { pc, minor, scale? },
// "F#m", "A minor", "F# major", "A Dorian", "Bb".
// ---------------------------------------------------------------------------
(function (root, make) {
  const api = make();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KeyConvert = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null, () => {
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLATS = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B", Fb: "E", "E#": "F", "B#": "C" };
  // the same scales as the MIDI tab (ui/toymachine-midi.js SCALES) and the top bar's key picker
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11], major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10], melodic: [0, 2, 3, 5, 7, 9, 11],
    phrygdom: [0, 1, 4, 5, 7, 8, 10], hungarian: [0, 2, 3, 6, 7, 8, 11], double: [0, 1, 4, 5, 7, 8, 11],
  };
  const MAJORISH = new Set(["major", "lydian", "mixolydian", "phrygdom", "double"]);
  const SCALE_WORDS = { m: "minor", min: "minor", minor: "minor", aeolian: "minor", maj: "major", major: "major", ionian: "major",
    dorian: "dorian", phrygian: "phrygian", harmonic: "harmonic", "harm min": "harmonic", "harmonic minor": "harmonic",
    lydian: "lydian", mixolydian: "mixolydian", mixolyd: "mixolydian", locrian: "locrian", melodic: "melodic", "mel min": "melodic",
    "melodic minor": "melodic", "phrygian dominant": "phrygdom", "phryg dom": "phrygdom", phrygdom: "phrygdom",
    "hungarian minor": "hungarian", "hung min": "hungarian", hungarian: "hungarian", "double harmonic": "double", "dbl harm": "double", double: "double" };
  const pc = (p) => ((p % 12) + 12) % 12;
  const clampP = (p) => Math.max(0, Math.min(127, p));

  // any key the app holds -> { tonic, scale } (scale is a SCALES name), or null
  function parseKey(k) {
    if (k == null || k === "") return null;
    if (typeof k === "object") {
      const t = k.tonic != null ? k.tonic : k.pc;
      if (t == null || isNaN(t)) return k.name ? parseKey(k.name) : null;
      const scale = k.scale && SCALES[k.scale] ? k.scale : k.minor ? "minor" : "major";
      return { tonic: pc(Math.round(t)), scale };
    }
    const m = /^\s*([A-Ga-g])([#b]?)\s*(.*)$/.exec(String(k));
    if (!m) return null;
    const nm = m[1].toUpperCase() + m[2];
    const t = NAMES.indexOf(FLATS[nm] || nm);
    if (t < 0) return null;
    const rest = m[3].trim().toLowerCase();
    const scale = rest === "" ? "major" : SCALE_WORDS[rest] || (rest[0] === "m" && !/^maj/.test(rest) ? "minor" : null);
    return scale ? { tonic: t, scale } : null;
  }
  const stepsOf = (key) => SCALES[key.scale] || SCALES.major;
  const isMinor = (key) => !MAJORISH.has(key.scale);
  function keyName(k) {
    const key = parseKey(k); if (!key) return "";
    return NAMES[key.tonic] + (key.scale === "minor" ? "m" : key.scale === "major" ? "" : " " + key.scale);
  }

  // the 12 pitch classes of the old key (as steps above its tonic) -> steps above the new tonic
  function stepMap(from, to) {
    const F = stepsOf(from), T = stepsOf(to), out = [];
    for (let iv = 0; iv < 12; iv++) { const d = F.indexOf(iv); out.push(d >= 0 ? T[d] : iv); }
    return out;
  }
  // one pitch, with the tonic shift already picked
  const mapPitch = (p, from, map, shift) => { const iv = pc(p - from.tonic); return p - iv + map[iv] + shift; };

  // Pick the one shift for the whole part: of the two ways to the new tonic (up or down), the one that
  // moves the notes least in total; on a tie, the one that keeps the part nearer the middle of the keys.
  function pickShift(pitches, from, to, map) {
    const d = pc(to.tonic - from.tonic), cands = d === 0 ? [0] : [d, d - 12];
    let best = null;
    for (const s of cands) {
      let move = 0, sum = 0;
      for (const p of pitches) { const q = mapPitch(p, from, map, s); move += Math.abs(q - p); sum += q; }
      const mid = pitches.length ? Math.abs(sum / pitches.length - 60) : Math.abs(s);
      if (!best || move < best.move - 1e-9 || (Math.abs(move - best.move) < 1e-9 && mid < best.mid)) best = { s, move, mid };
    }
    return best.s;
  }

  // Convert a list of pitches (all from one part, so they share one shift). Returns new pitches.
  function convertPitches(pitches, fromKey, toKey, opts) {
    const from = parseKey(fromKey), to = parseKey(toKey);
    if (!from || !to || !pitches || !pitches.length) return (pitches || []).slice();
    const map = stepMap(from, to);
    const shift = opts && opts.shift != null ? opts.shift : pickShift(pitches, from, to, map);
    return pitches.map((p) => {
      let q = mapPitch(p, from, map, shift);
      while (q > 127) q -= 12;
      while (q < 0) q += 12;
      return clampP(q);
    });
  }
  // Convert note objects ({ pitch, ... }). Returns copies; the rest of each note is kept.
  // `groups` (optional): more note lists from the same part (a pattern's stacked sounds) that should
  // move by the same shift, so a stack stays lined up. Returns { notes, groups, shift }.
  function convertNotes(notes, fromKey, toKey, groups) {
    const from = parseKey(fromKey), to = parseKey(toKey);
    const all = (notes || []).concat(...Object.values(groups || {}));
    if (!from || !to || !all.length) return { notes: (notes || []).map((n) => ({ ...n })), groups: { ...(groups || {}) }, shift: 0 };
    const map = stepMap(from, to), shift = pickShift(all.map((n) => n.pitch), from, to, map);
    const one = (ns) => { const ps = convertPitches(ns.map((n) => n.pitch), from, to, { shift }); return ns.map((n, i) => ({ ...n, pitch: ps[i] })); };
    const g = {}; for (const [k, ns] of Object.entries(groups || {})) g[k] = one(ns || []);
    return { notes: one(notes || []), groups: g, shift };
  }

  // Audio can't change mode by plain pitch-shifting, so a sound clip moves to the key that shares the
  // new key's notes: the same tonic when both are minor or both major, else the relative one
  // (A minor into F# major -> D# minor). The smallest move, -6..+5 semitones. This is the old
  // shiftBetween / keyShift maths from playground.js, kept here so every part of the app asks one place.
  function audioShift(fromKey, toKey) {
    const a = parseKey(fromKey), b = parseKey(toKey);
    if (!a || !b) return 0;
    const target = isMinor(a) === isMinor(b) ? b.tonic : isMinor(a) ? b.tonic + 9 : b.tonic + 3;
    return pc(target - a.tonic + 6) - 6;
  }

  // naming chords, for tests and for messages ("Am -> F#")
  const SHAPES = [["", [0, 4, 7]], ["m", [0, 3, 7]], ["dim", [0, 3, 6]], ["aug", [0, 4, 8]], ["7", [0, 4, 7, 10]], ["maj7", [0, 4, 7, 11]],
    ["m7", [0, 3, 7, 10]], ["m7b5", [0, 3, 6, 10]], ["sus2", [0, 2, 7]], ["sus4", [0, 5, 7]], ["5", [0, 7]]];
  function chordName(pitches) {
    const pcs = [...new Set(pitches.map(pc))];
    const bass = pc(Math.min(...pitches));
    for (const root of [bass, ...pcs.filter((x) => x !== bass)]) {
      const set = pcs.map((x) => pc(x - root)).sort((a, b) => a - b).join(",");
      for (const [nm, iv] of SHAPES) if ([...iv].sort((a, b) => a - b).join(",") === set) return NAMES[root] + nm;
    }
    return pcs.map((x) => NAMES[x]).join("-");
  }

  // The project's root note and scale, in one clean shape, for anything that wants to play in key
  // (UI sound effects, previews): { tonic: 0..11, name: "F#", scale: "major", minor: false,
  // steps: [...], rootMidi: the root nearest middle C (60..71) } or null when the key isn't set.
  function rootOf(k) {
    const key = parseKey(k); if (!key) return null;
    return { tonic: key.tonic, name: NAMES[key.tonic], scale: key.scale, minor: isMinor(key), steps: stepsOf(key).slice(), rootMidi: 60 + key.tonic };
  }

  return { NAMES, SCALES, parseKey, keyName, isMinor, stepMap, convertPitches, convertNotes, audioShift, chordName, rootOf };
});
