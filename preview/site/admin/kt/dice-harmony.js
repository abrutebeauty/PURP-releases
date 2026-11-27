// DICE HARMONY (Eman, 8 Nov): the dice's ears. Before it rolls, it reads EVERY note already on the
// timeline: the other sounds cut from this pattern, the other synth lanes playing at the same time,
// and whatever is locked in the sound it writes. Chords with five notes, a sliding note, ten fast
// notes in a row, two basses at once: all of it is weighed (long notes count, passing notes barely)
// and turned into a chord plan the roll follows. Then `place` fits what was rolled around what is
// there: a free register, no doubled pitches, no semitone rubs against held notes, and a different
// good answer on every re-roll (the VARIANTS below).
//
// window.DiceHarmony = {
//   hear({ notes, sc, beats })            -> analysis (segs, registers, lines, fullness, advice...)
//   plan(analysis, sc, beats)             -> the harmony plan rollPart reads (at / chordAt / names / heard)
//   place({ mode, notes, ctx, analysis, sc, beats, variant, keep }) -> { notes, said, variant }
//   variants(mode, analysis, recent)      -> the variant to use next (different from the recent ones)
//   describe(analysis)                    -> a few plain words for the toast
// }
// KT2_DICE_HEAR_OLD = the old ears (triads every half bar, chords mode ignored what was there).
(() => {
  const pc = (p) => ((p % 12) + 12) % 12;
  const EPS = 1e-6;
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
    major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
    melodic: [0, 2, 3, 5, 7, 9, 11], phrygdom: [0, 1, 4, 5, 7, 8, 10], hungarian: [0, 2, 3, 6, 7, 8, 11], double: [0, 1, 4, 5, 7, 8, 11],
  };
  // chord templates: quality -> intervals (pitch classes above the root). Order matters a little: simpler first.
  const QUAL = {
    "": [0, 4, 7], "m": [0, 3, 7], "5": [0, 7], "dim": [0, 3, 6], "aug": [0, 4, 8], "sus2": [0, 2, 7], "sus4": [0, 5, 7],
    "7": [0, 4, 7, 10], "M7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "mM7": [0, 3, 7, 11], "dim7": [0, 3, 6, 9], "m7b5": [0, 3, 6, 10],
    "6": [0, 4, 7, 9], "m6": [0, 3, 7, 9], "add9": [0, 4, 7, 2], "madd9": [0, 3, 7, 2], "7sus4": [0, 5, 7, 10],
    "9": [0, 4, 7, 10, 2], "M9": [0, 4, 7, 11, 2], "m9": [0, 3, 7, 10, 2], "m11": [0, 3, 7, 10, 2, 5], "11": [0, 4, 7, 10, 2, 5], "13": [0, 4, 7, 10, 2, 9],
  };
  const NICE = { "": "", "m": "m", "5": "5", "dim": "dim", "aug": "aug", "sus2": "sus2", "sus4": "sus4", "7": "7", "M7": "maj7", "m7": "m7", "mM7": "mMaj7", "dim7": "dim7", "m7b5": "m7b5", "6": "6", "m6": "m6", "add9": "add9", "madd9": "madd9", "7sus4": "7sus4", "9": "9", "M9": "maj9", "m9": "m9", "m11": "m11", "11": "11", "13": "13" };
  // the colour tones a chord can take on top (for thickening): 7th, 9th, 11th/13th, in the scale when possible
  const EXT = { "": [11, 2, 9], "m": [10, 2, 5], "5": [4, 3, 10, 2], "dim": [10, 9], "aug": [11, 2], "sus2": [10, 11], "sus4": [10, 11], "7": [2, 9], "M7": [2, 9, 6], "m7": [2, 5], "mM7": [2], "dim7": [], "m7b5": [2], "6": [11, 2], "m6": [10, 2], "add9": [11, 9], "madd9": [10, 5], "7sus4": [2], "9": [9], "M9": [6, 9], "m9": [5], "m11": [], "11": [], "13": [] };
  const scaleOf = (sc) => (SCALES[sc && sc.scale] || SCALES.minor).map((s) => pc(s + ((sc && sc.tonic) || 0)));
  const inSc = (sc, p) => scaleOf(sc).includes(pc(p));
  // a semitone in any octave, either way round (E over F is a rub too, not only F over E)
  const rubs = (a, b) => { const m = Math.abs(a - b) % 12; return m === 1 || m === 11; };
  // the nearest scale note under p (an approach note or a slide's start): in harmonic minor and the phrygian scales a
  // gap is 3 semitones wide, so "-2 or else -1" could land outside the key (the user test, 8 Nov 16:03)
  const below = (sc, p) => { for (let d = 1; d <= 4; d++) if (inSc(sc, p - d)) return p - d; return p - 1; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  // ---- listening ---------------------------------------------------------------------------------
  // How much a note counts when the chord is weighed: a held note is the harmony, a 16th on the way
  // somewhere barely is, a very short repeated note (a trap hat on a synth) hardly at all. The low
  // register counts extra for the root, the top line a little less (melody notes pass through).
  function noteWeight(n) {
    const L = n.length;
    let w = L >= 1 ? 1 : L >= 0.5 ? 0.75 : L >= 0.25 ? 0.4 : 0.18;
    if (n.pitch < 48) w *= 1.25;
    if (n.pitch >= 79) w *= 0.8;
    if (n.velocity != null) w *= 0.6 + 0.4 * clamp(n.velocity / 110, 0.3, 1.2);
    return w;
  }
  // every template on every root, once
  const NON_TERTIAN = new Set(["6", "m6", "add9", "madd9", "sus2", "sus4", "7sus4", "5"]);
  const TPL = []; for (let r = 0; r < 12; r++) for (const q in QUAL) TPL.push({ r, q, ivs: QUAL[q], pcs: QUAL[q].map((x) => pc(r + x)), odd: NON_TERTIAN.has(q) });
  // the chord that explains a weighted set of pitch classes best. bass = { pc, low }: the pitch class that carries
  // the bottom (the heaviest note under the middle of the keyboard) and whether it sits in the bass register
  function bestChord(w, bass, sc, nDistinct) {
    const scale = scaleOf(sc), tot = sum(w) || 1;
    let best = null;
    for (const T of TPL) {
      const { r, q, ivs, pcs: tpl } = T;
      // a lone note or two: only the simple shapes make sense (the scale fills the rest)
      if (nDistinct <= 2 && ivs.length > 3) continue;
      if (nDistinct <= 1 && q !== "" && q !== "m" && q !== "5") continue;
      let hit = 0, absent = 0;
      for (const p of tpl) { if (w[p] > 0) hit += w[p]; else absent += p === pc(r + 7) ? 0.25 : 0.45; }   // a missing fifth is fine
      const miss = tot - hit;
      let score = hit - 0.7 * miss - absent * tot * 0.3;
      if (w[r] > 0) score += 0.15 * tot; else score -= 0.4 * tot;   // the root should sound
      if (bass && bass.pc != null) { const k = bass.low ? 1 : 0.2; score += bass.pc === r ? 0.5 * tot * k : bass.pc === pc(r + 7) ? 0.1 * tot * k : 0; }
      if (scale.includes(r)) score += 0.08 * tot;
      if (tpl.every((p) => scale.includes(p))) score += 0.08 * tot;
      if (ivs.length >= 5) score -= 0.05 * tot;   // 9ths only when they are really there
      if (T.odd && !(q === "5" && nDistinct <= 2)) score -= 0.12 * tot;   // a stack of thirds beats a 6 / add9 / sus reading of the same notes
      if (!best || score > best.score) best = { root: r, q, score, ivs };
    }
    return best;
  }
  // the pitch class carrying the bottom of a slice: the heaviest note in the bass register, else the lowest note
  function bassOf(lowW, low, first) {
    let bp = null, bw = 0; for (let p = 0; p < 12; p++) if (lowW[p] > bw) { bw = lowW[p]; bp = p; }
    if (bp != null && first && first.low && first.pc !== bp && lowW[first.pc] * 1.3 >= bw) bp = first.pc;   // the note that opened the chord holds the bottom
    if (bp != null) return { pc: bp, low: true };
    return low != null ? { pc: pc(low), low: low < 52 } : null;
  }
  // when a segment only has a root (and maybe a fifth), the scale says which triad it is
  function scaleTriad(sc, root) {
    const scale = scaleOf(sc), third = scale.includes(pc(root + 3)) ? 3 : scale.includes(pc(root + 4)) ? 4 : null;
    const fifth = scale.includes(pc(root + 7)) ? 7 : scale.includes(pc(root + 6)) ? 6 : scale.includes(pc(root + 8)) ? 8 : 7;
    if (third == null) return { q: "5", ivs: [0, 7] };
    const q = third === 3 ? (fifth === 6 ? "dim" : "m") : fifth === 8 ? "aug" : "";
    return { q, ivs: QUAL[q] };
  }
  const nameOf = (root, q) => NAMES[pc(root)] + (NICE[q] == null ? q : NICE[q]);

  // notes: [{ pitch, start, length, velocity?, src? }] in this clip's beats. sc: { tonic, scale }.
  function hear(P) {
    const notes = (P.notes || []).filter((n) => n && Number.isFinite(n.pitch) && Number.isFinite(n.start) && n.length > 0 && !n.muted);
    const beats = Math.max(1, P.beats || 16), sc = P.sc || { tonic: 0, scale: "minor" }, SL = 0.5, nsl = Math.ceil(beats / SL);
    const A = { heard: notes.length > 0, beats, sc, notes, segs: [], slices: [], registers: { low: 0, mid: 0, high: 0 }, lines: { bass: [], top: [] }, onsets: new Array(16).fill(0), sources: {}, fast: 0, slides: 0, fullness: 0, maxPoly: 0, keyFit: 1, keyHint: null, advice: [] };
    if (!notes.length) return A;
    const pitches = notes.map((n) => n.pitch);
    A.lowest = Math.min(...pitches); A.highest = Math.max(...pitches);
    let wIn = 0, wAll = 0; const kw = new Array(12).fill(0);
    for (const n of notes) {
      const w = n.length * noteWeight(n);
      A.registers[n.pitch < 48 ? "low" : n.pitch < 72 ? "mid" : "high"] += w;
      if (n.length < 0.25 + EPS) A.fast++;
      if (n.slide || n.slideFrom != null || (n.bend && n.bend.length)) A.slides++;
      const slot = Math.round((n.start % 4) / 0.25) % 16; if (slot >= 0) A.onsets[slot]++;
      const s = n.src || "here"; A.sources[s] = (A.sources[s] || 0) + 1;
      kw[pc(n.pitch)] += w; wAll += w; if (inSc(sc, n.pitch)) wIn += w;
    }
    A.keyFit = wAll ? wIn / wAll : 1;
    if (A.keyFit < 0.62 && wAll > 2) A.keyHint = guessKey(kw);
    // slices of half a beat: weighted pitch classes, lowest and highest sounding pitch, how many sound
    let fullSlices = 0;
    for (let s = 0; s < nsl; s++) {
      const a = s * SL, b = a + SL, w = new Array(12).fill(0), lowW = new Array(12).fill(0);
      let low = null, high = null, poly = 0, tot = 0;
      for (const n of notes) {
        const o = Math.min(b, n.start + n.length) - Math.max(a, n.start);
        if (o <= EPS) continue;
        const ww = o * noteWeight(n);
        w[pc(n.pitch)] += ww; tot += ww; poly++;
        if (n.pitch < 52) lowW[pc(n.pitch)] += ww;
        if (low == null || n.pitch < low) low = n.pitch;
        if (high == null || n.pitch > high) high = n.pitch;
      }
      A.maxPoly = Math.max(A.maxPoly, poly);
      if (poly >= 3) fullSlices++;
      A.lines.bass.push(low); A.lines.top.push(high);
      A.slices.push({ beat: a, w, lowW, low, high, poly, tot });
    }
    A.fullness = fullSlices / nsl;
    // segments: walk the slices. A slice joins the chord playing when the chord heard over both together is still
    // that chord (a passing note, the next note of an arpeggio, a bass fill); a new chord starts where it is not,
    // and off the beat only with real weight behind it.
    const nd = (w) => w.filter((x) => x > 0).length, add = (a, b) => a.map((x, i) => x + b[i]);
    let cur = null;
    for (const sl of A.slices) {
      if (sl.tot <= EPS) { if (cur) cur.len += SL; continue; }   // silence: the chord still rings in the ear
      if (cur) {
        const w2 = add(cur.w, sl.w), lw2 = add(cur.lowW, sl.lowW), low2 = cur.low == null ? sl.low : sl.low == null ? cur.low : Math.min(cur.low, sl.low);
        const onBeat = Math.abs(sl.beat - Math.round(sl.beat)) < EPS;
        // the slice's real notes (not the faintest flicks) all belong to the chord playing, colour tones included,
        // and its bass (if it has one) is still the root or the fifth
        const core = new Set(cur.pcs), okPcs = new Set(cur.pcs.concat((EXT[cur.q] || []).map((x) => pc(cur.root + x))));
        const slPcs = sl.w.map((x, p) => (x > 0.1 * sl.tot ? p : -1)).filter((p) => p >= 0);
        const slBass = bassOf(sl.lowW, null), slN = nd(sl.w);
        const slOwn = slN >= 3 ? bestChord(sl.w, bassOf(sl.lowW, sl.low), sc, slN) : null;
        // its notes are the chord's own notes; or a real chord of its own that hears the same root; or something
        // light (a fill, a melody note) that at least fits the chord's colour tones
        const compatible = (slPcs.every((p) => core.has(p)) || (slOwn && slOwn.root === cur.root) || (sl.tot < 0.35 && slPcs.every((p) => okPcs.has(p))))
          && (!slBass || slBass.pc === cur.root || slBass.pc === pc(cur.root + 7));
        // a bass that lands on a new note at a bar line has changed chord, even when the new note is the old chord's
        // fifth (F then C in the bass is F - C, not two bars of F; a run over the bass does not change that)
        const barLine = Math.abs(sl.beat / 4 - Math.round(sl.beat / 4)) < EPS, thinCur = nd(cur.w) <= 2;
        const bassHeavy = sum(sl.lowW) >= 0.25 * sl.tot;   // a real bass under it, not a flick
        const newBass = barLine && slBass && slBass.pc !== cur.root && sl.tot >= 0.12 && (thinCur || bassHeavy);
        const joins = !newBass && (compatible || (!onBeat && sl.tot < 0.4) || sl.tot < 0.12);
        if (joins) {
          const bc2 = bestChord(w2, bassOf(lw2, low2, cur.bass0), sc, nd(w2));
          cur.len += SL; cur.w = w2; cur.lowW = lw2; cur.tot += sl.tot; cur.low = low2;
          if (sl.high != null) cur.high = cur.high == null ? sl.high : Math.max(cur.high, sl.high);
          if (bc2.root === cur.root) { cur.q = bc2.q; cur.pcs = bc2.ivs.map((x) => pc(cur.root + x)); }
          continue;
        }
      }
      const bc = bestChord(sl.w, bassOf(sl.lowW, sl.low), sc, nd(sl.w));
      cur = { beat: sl.beat, len: SL, root: bc.root, q: bc.q, pcs: bc.ivs.map((x) => pc(bc.root + x)), w: sl.w.slice(), lowW: sl.lowW.slice(), tot: sl.tot, low: sl.low, high: sl.high, bass0: bassOf(sl.lowW, sl.low) };
      A.segs.push(cur);
    }
    // settle each segment: re-pick the chord over its whole span (passing notes average out), fill thin ones
    for (const sg of A.segs) {
      const nd = sg.w.filter((x) => x > 0).length, bc = bestChord(sg.w, bassOf(sg.lowW, sg.low, sg.bass0), sc, nd);
      sg.root = bc.root; sg.q = bc.q; sg.ivs = bc.ivs.slice();
      if (nd <= 2) { const t = scaleTriad(sc, sg.root); sg.q = t.q; sg.ivs = t.ivs.slice(); sg.thin = true; }   // a bass alone: the scale gives the triad
      sg.pcs = sg.ivs.map((x) => pc(sg.root + x)); sg.name = nameOf(sg.root, sg.q);
      sg.conf = clamp((sg.tot ? sum(sg.pcs.map((p) => sg.w[p])) / sg.tot : 0) * (nd <= 1 ? 0.6 : 1), 0, 1);
      sg.sounding = sg.w.map((x, p) => (x > 0 ? p : -1)).filter((p) => p >= 0);
      sg.ext = EXT[sg.q] || [];
      delete sg.w; delete sg.lowW; delete sg.bass0;
    }
    // merge neighbours that settled on the same chord
    for (let i = 1; i < A.segs.length; i++) { const a = A.segs[i - 1], b = A.segs[i]; if (a.root === b.root && a.q === b.q) { a.len += b.len; a.tot += b.tot; a.low = Math.min(a.low == null ? 999 : a.low, b.low == null ? 999 : b.low); a.high = Math.max(a.high == null ? -1 : a.high, b.high == null ? -1 : b.high); a.sounding = [...new Set(a.sounding.concat(b.sounding))]; A.segs.splice(i--, 1); } }
    if (A.segs.length && A.segs[0].beat > 0) { A.segs[0].len += A.segs[0].beat; A.segs[0].beat = 0; }   // the first chord is heard from the top
    A.names = A.segs.map((s) => s.name);
    // a drone / pedal: one thin chord (a note or a fifth) held across the whole clip. Chords may move over it.
    A.drone = A.segs.length === 1 && !!A.segs[0].thin && A.beats >= 8 && A.maxPoly <= 2;
    // a mess: lots of notes that never settle into chords (random clicks, a noise part). Nothing to follow there;
    // the roll is made fresh and only kept clear of the notes.
    const meanConf = A.segs.length ? A.segs.reduce((a, x) => a + x.conf, 0) / A.segs.length : 1;
    // random notes still look like some chord each (any 3-6 pitch classes name something), so the tell is the pace:
    // a new "chord" nearly every beat, most of them short, and the whole lot sitting badly in the key
    const shortFrac = A.segs.length ? A.segs.filter((x) => x.len <= 1 + EPS).length / A.segs.length : 0;
    A.messy = A.segs.length >= Math.max(5, A.beats / 2) && (meanConf < 0.55 || (A.keyFit < 0.8 && shortFrac >= 0.5));
    if (A.messy) A.advice.push("no clear chords");   // the toast says it in its own words
    // what it is, in plain words
    const srcN = Object.keys(A.sources).length;
    A.roles = { bass: A.registers.low > 0.6, chords: A.maxPoly >= 3 && A.registers.mid + A.registers.high > 1, melody: A.maxPoly <= 2 && A.fast + notes.length >= 6 && A.registers.mid + A.registers.high > 0.5 };
    if (A.roles.bass) A.advice.push("bass");
    if (A.roles.chords) A.advice.push("chords");
    if (A.roles.melody) A.advice.push("melody");
    if (srcN > 1) A.advice.push(srcN + " sounds");
    if (A.keyHint) A.advice.push("sounds like " + NAMES[A.keyHint.tonic] + " " + A.keyHint.scale);
    return A;
  }
  const FAM = (q) => (/^(m|m7|m9|m6|madd9|m11|mM7)$/.test(q) ? "m" : /^(dim|dim7|m7b5)$/.test(q) ? "d" : /^(aug)$/.test(q) ? "a" : /^(sus2|sus4|7sus4)$/.test(q) ? "s" : "M");
  const sameFamily = (a, b) => FAM(a) === FAM(b) || a === "5" || b === "5";
  // the key the notes fit best (major or minor), when they do not fit the picked one
  function guessKey(kw) {
    const prof = { major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17] };
    let best = null;
    for (const scale in prof) for (let t = 0; t < 12; t++) { let s = 0; for (let p = 0; p < 12; p++) s += kw[pc(p + t)] * prof[scale][p]; if (!best || s > best.s) best = { tonic: t, scale, s }; }
    return { tonic: best.tonic, scale: best.scale };
  }

  // ---- the plan rollPart reads ---------------------------------------------------------------------
  // segs: the old two-beat list of scale degrees (for the toast), at(beat) a degree, chordAt(beat) the chord
  function plan(A, sc, beats) {
    beats = beats || A.beats;
    const scale = scaleOf(sc);
    const degOf = (root) => { let best = 0, bd = 99; for (let d = 0; d < 7; d++) { const dd = Math.min(pc(scale[d] - root), pc(root - scale[d])); if (dd < bd) { bd = dd; best = d; } } return best; };
    const segAt = (beat) => { let s = A.segs[0]; for (const x of A.segs) if (x.beat <= beat + EPS) s = x; return s; };
    const segs2 = [];
    for (let s = 0; s < Math.ceil(beats / 2); s++) { const sg = A.segs.length ? segAt(s * 2) : null; segs2.push(sg ? { deg: degOf(sg.root) } : null); }
    return {
      segs: segs2, heard: A.segs.length > 0, analysis: A,
      at: (beat) => (A.segs.length ? degOf(segAt(beat).root) : 0),
      chordAt: (beat) => segAt(beat),
      changeAt: (beat) => A.segs.some((x) => Math.abs(x.beat - beat) < 0.26 && x.beat > 0),
      nextChange: (beat) => { for (const x of A.segs) if (x.beat > beat + 0.26) return x.beat; return beats; },
      names: A.segs.map((x) => x.name),
    };
  }

  // ---- fitting the roll around what is there ---------------------------------------------------------
  // VARIANTS: the different good answers a re-roll can give over the same notes. Each one is a set of
  // choices for register, voicing and rhythm; the dice walks through them so two rolls in a row differ.
  const VARIANTS = {
    bass: [
      { k: "under", n: "under it", oct: -1, fifths: 0.1, gaps: 0 },        // an octave under the other bass, same hits
      { k: "fifths", n: "fifths and octaves", oct: 0, fifths: 0.45, gaps: 0.2 },   // around the other bass, on the fifth
      { k: "gaps", n: "in the gaps", oct: 0, fifths: 0.2, gaps: 0.85 },      // where the other bass rests
      { k: "high", n: "an octave up", oct: 1, fifths: 0.25, gaps: 0.3 },    // above it, lighter
      { k: "answer", n: "answering", oct: 0, fifths: 0.35, gaps: 0.6, approach: true },   // slides up into the roots
    ],
    chords: [
      { k: "above", n: "above it, with colour", reg: "above", ext: 0.9, drop: 0.6 },   // the 7th / 9th on top of what is there
      { k: "thick", n: "thicker", reg: "same", ext: 0.5, drop: 0.3 },           // doubles the chord in another inversion
      { k: "below", n: "under it", reg: "below", ext: 0.2, drop: 0.5 },         // a low pad under
      { k: "sparkle", n: "high and sparse", reg: "high", ext: 1, drop: 0.8 },     // a few colour tones high up
      { k: "shell", n: "open shells", reg: "above", ext: 0.3, drop: 0.7, shell: true },   // root + 7th / 3rd only
      { k: "reharm", n: "new chords over the bass", reg: "above", ext: 0.4, drop: 0.5, reharm: true },   // the bass note as the third or fifth of another chord (re-rolls over a bass alone)
    ],
    melody: [
      { k: "over", n: "over the top", reg: "above", gaps: 0.3 },
      { k: "between", n: "between the lines", reg: "mid", gaps: 0.7 },
      { k: "answer", n: "answering the melody", reg: "above", gaps: 0.9 },
      { k: "low", n: "a low counter line", reg: "below", gaps: 0.4 },
    ],
    arp: [
      { k: "above", n: "above it", reg: "above" }, { k: "high", n: "high up", reg: "high" }, { k: "mid", n: "in the middle", reg: "mid" },
    ],
  };
  // pins (night test 9 Nov): { voices, range } the person set by hand. A pinned CHORD SIZE never gets the shells or
  // the high sparse variant (they throw notes away).
  function variants(mode, A, recent, pins) {
    let list = VARIANTS[mode] || VARIANTS.melody; const used = new Set(recent || []);
    if (pins && mode === "chords") {
      const out = list.filter((v) => !(pins.voices != null && (v.shell || v.k === "sparkle")));
      if (out.length) list = out;
    }
    let pool = list.filter((v) => !used.has(v.k));
    if (!pool.length) pool = list;
    // what fits this context best gets a head start: a crowded middle pushes a new part up or down
    const w = (v) => {
      let x = 1;
      if (mode === "bass" && A.registers.low > 0.6) { if (v.k === "under" && A.lowest <= 31) x *= 0.2; if (v.k === "high" && A.registers.mid > 1.5) x *= 0.5; if (v.k === "gaps" && A.onsets.filter(Boolean).length <= 2) x *= 0.4; }
      if (mode === "chords") {
        if (v.reg === "above" && A.highest >= 84) x *= 0.3; if (v.reg === "below" && A.lowest <= 40) x *= 0.3; if (v.reg === "same" && A.fullness > 0.8) x *= 0.4;
        if (A.roles.melody && !A.roles.chords && (v.reg === "above" || v.reg === "high")) x *= 0.15;   // under a melody, not over it
        if (A.roles.bass && !A.roles.chords && !A.roles.melody && v.reg === "below") x *= 0.05;   // never under the bass
        if (v.reharm) { const tot = A.segs.reduce((a, g) => a + g.len, 0) || 1, thin = A.segs.reduce((a, g) => a + (g.thin ? g.len : 0), 0) / tot;   /* by time: locked chords over the first half, a bass alone under the second */ x *= (thin >= 0.5 && recent && recent.length) ? 1.6 : 0; }   // only over a bass / line alone, never on the first roll
      }
      if (mode === "melody") { if (v.reg === "above" && A.highest >= 88) x *= 0.3; if (v.reg === "below" && (A.registers.low > 1 || A.roles.bass)) x *= 0.1; }
      return x;
    };
    // the first roll over a pattern states the roots plainly; fifths, the octave up and the answering slides come on re-rolls
    const first = !(recent && recent.length);
    const w2 = (v) => w(v) * (first && mode === "bass" && (v.k === "fifths" || v.k === "answer") ? 0.15 : first && mode === "bass" && v.k === "high" ? 0.5 : 1);
    let tot = 0; for (const v of pool) tot += w2(v);
    let r = Math.random() * tot; for (const v of pool) { r -= w2(v); if (r <= 0) return v; }
    return pool[pool.length - 1];
  }
  const overlap = (a, b) => a.start < b.start + b.length - EPS && b.start < a.start + a.length - EPS;
  // the context notes sounding while `n` plays, weighted by how much they overlap and how held they are
  const soundingWith = (n, ctx) => ctx.filter((c) => overlap(n, c) && Math.min(n.start + n.length, c.start + c.length) - Math.max(n.start, c.start) >= Math.min(0.1, n.length * 0.5) - EPS);   // 0.1: a note starting under the tail of a hit still rubs with it

  // P: { mode, notes (rolled), ctx (context notes), analysis, sc, beats, variant, keep }
  function place(P) {
    const A = P.analysis, ctx = P.ctx || [], sc = P.sc, mode = P.mode, V = P.variant || (VARIANTS[mode] || VARIANTS.melody)[0];
    let notes = P.notes.map((n) => ({ ...n }));
    const said = [];
    if (!A || !A.heard || !notes.length) return { notes, said, variant: V };
    const chordAt = (b) => { let s = A.segs[0]; for (const x of A.segs) if (x.beat <= b + EPS) s = x; return s; };
    const low = (ns) => Math.min(...ns.map((n) => n.pitch)), high = (ns) => Math.max(...ns.map((n) => n.pitch));
    const shift = (d) => { for (const n of notes) n.pitch += d; if (notes.some((n) => n.slideFrom != null)) for (const n of notes) if (n.slideFrom != null) n.slideFrom += d; };
    // 1) REGISTER: the part moves by whole octaves into room that is free
    if (mode === "bass") {
      const otherBass = A.registers.low > 0.6 ? ctx.filter((c) => c.pitch < 48) : [];
      if (otherBass.length) {
        const ob = otherBass.map((c) => c.pitch), obLow = Math.min(...ob), obMid = ob.reduce((a, b) => a + b, 0) / ob.length;
        const mine = notes.reduce((a, n) => a + n.pitch, 0) / notes.length;
        let d = 0;
        if (V.oct === -1) d = obLow - 12 >= 24 ? Math.round((obMid - 12 - mine) / 12) * 12 : 0;
        else if (V.oct === 1) d = Math.round((obMid + 12 - mine) / 12) * 12;
        else d = Math.round((obMid - mine) / 12) * 12;
        if (low(notes) + d < 24) d += 12;
        while (high(notes) + d > 60 && low(notes) + d - 12 >= 24) d -= 12;   // a bass stays a bass (nothing over C4)
        if (d) shift(d);
        said.push(V.n);
      } else {   // chords or a melody there, no bass yet: the variant still makes each roll its own
        if (V.oct === -1 && low(notes) - 12 >= 26) shift(-12);
        else if (V.oct === 1 && high(notes) + 12 <= 58) shift(12);
        const out = [];
        for (const n of notes) {
          const ch = chordAt(n.start), onBeat = Math.abs(n.start - Math.round(n.start)) < EPS;
          if (!onBeat && V.gaps > 0.5 && Math.random() < V.gaps * 0.4) continue;   // sparser: some off-beats rest
          if (V.fifths >= 0.5 && !onBeat && Math.random() < V.fifths * 0.6) { const f = ch.pcs[2] != null ? ch.pcs[2] : pc(ch.root + 7); let q = n.pitch + ((f - pc(n.pitch) + 12) % 12); if (q - n.pitch > 7) q -= 12; n.pitch = q; }
          if (V.approach && n.length >= 1 && Math.random() < 0.35 && n.start >= 0.5 && !out.some((q) => q.start > n.start - 0.26)) out.push({ pitch: below(sc, n.pitch), start: n.start - 0.25, length: 0.25, velocity: Math.max(50, (n.velocity || 100) - 20), slide: true });
          out.push(n);
        }
        notes = out;
        said.push(V.k === "under" ? "an octave down" : V.k === "high" ? "an octave up" : V.n);
      }
    } else if (mode === "chords" || mode === "melody" || mode === "arp") {
      const held = ctx.filter((c) => c.length >= 0.5), body = held.length ? held : ctx;
      // mine leaves out the Dark <-> Bright card's re-voicing (P.vShift, night test 9 Nov): the octave the fit picks is the
      // same for DARK, MID and BRIGHT, so the card moves the voicing a 4th / 5th and never flips it an octave the other way
      const top = high(body), bot = low(body), mine = notes.reduce((a, n) => a + n.pitch, 0) / notes.length - (P.vShift || 0), span = high(notes) - low(notes);
      let target = null;   // where the middle of the new part should sit
      if (V.reg === "above") target = top + 5 + span / 2;
      else if (V.reg === "high") target = Math.max(top + 9, 79) + span / 2;
      else if (V.reg === "below") target = bot - 5 - span / 2;
      else if (V.reg === "mid") target = mode === "chords" ? (top + bot) / 2 : top - 2 + span / 2;   // a line "between" sits in the upper part of the chords, not buried
      else if (V.reg === "same") target = (A.registers.mid >= A.registers.high ? (top + bot) / 2 : top - 6);
      if (target != null) {
        let d = Math.round((target - mine) / 12) * 12;
        const vs = P.vShift || 0;   // the floor and ceiling judge the MID voicing too, so DARK may sit up to a 4th under the floor (else the floor undid DARK)
        while (high(notes) - vs + d > (mode === "chords" ? 91 : 100)) d -= 12;
        while (low(notes) - vs + d < (mode === "chords" ? 48 : A.roles.chords ? 55 : A.roles.bass ? 52 : 40)) d += 12;
        if (d) shift(d);
      }
      said.push(V.n);
    }
    // 2) CHORDS over chords: colour on top instead of the same notes again (thickening), shells when asked.
    // Over a bass or a melody alone the chord is not there yet, so the roll states it as it is.
    if (mode === "chords" && A.roles.chords) {
      const byStart = new Map();
      for (const n of notes) { const k = n.start.toFixed(3); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(n); }
      const out = [];
      for (const grp of byStart.values()) {
        const ch = chordAt(grp[0].start), root = ch.root, here = soundingWith(grp[0], ctx).map((c) => c.pitch);
        const herePcs = new Set(here.map(pc));
        grp.sort((a, b) => a.pitch - b.pitch);
        // colour tones this chord can take that nobody plays yet, in the scale first
        const ext = ch.ext.filter((x) => !herePcs.has(pc(root + x)) && !herePcs.has(pc(root + x + 1)) && !herePcs.has(pc(root + x - 1))).sort((a, b) => (inSc(sc, root + b) ? 1 : 0) - (inSc(sc, root + a) ? 1 : 0));
        const keepN = []; let swapped = 0;
        const third = ch.pcs[1];
        for (let i = 0; i < grp.length; i++) {
          const n = grp[i], mine = pc(n.pitch);
          const doubled = here.includes(n.pitch) || (herePcs.has(mine) && Math.random() < V.drop);
          if (V.shell && i > 0 && i < grp.length - 1 && grp.length > 2) continue;   // shells: lowest + highest only
          // a doubled fifth (or 7th) becomes a colour tone; the root and the third stay, so the chord still reads
          // (a triad keeps all three notes: with the fifth swapped for a 9th and a 13th on top it read as another chord)
          if (doubled && ext.length && !swapped && grp.length >= 4 && mine !== root && mine !== third && Math.random() < V.ext) {
            const x = ext.shift(); let p = n.pitch + ((pc(root + x) - mine + 12) % 12); if (p - n.pitch > 6) p -= 12;
            if (p < low(grp) - 2) p += 12;
            n.pitch = p; swapped++;
          } else if (here.includes(n.pitch)) { n.pitch += 12; if (n.pitch > 91) n.pitch -= 24; }
          keepN.push(n);
        }
        // and one colour note on top when the variant wants colour and there is room (not past a pinned CHORD SIZE)
        if (ext.length && !V.shell && keepN.length < (P.pins && P.pins.voices != null ? Math.min(5, P.pins.voices) : 5) && Math.random() < V.ext) {
          const x = ext.shift(), top = high(keepN); let p = top + ((pc(root + x) - pc(top) + 12) % 12); if (p === top) p += 12;
          if (p <= 91) keepN.push({ ...grp[grp.length - 1], pitch: p, velocity: Math.max(40, (grp[0].velocity || 96) - 12) });
        }
        out.push(...keepN);
      }
      notes = out;
      if (A.roles.chords) said.push(V.ext >= 0.5 ? "colour notes on top" : "another voicing");
    }
    // 2a) CHORDS over a bass or a line alone: "thicker" doubles the root an octave under each chord, "open shells"
    // keeps only the outer notes (before, both gave the very same notes here; the user test, 8 Nov 16:38)
    if (mode === "chords" && !A.roles.chords && (V.shell || V.k === "thick")) {
      const byStart = new Map();
      for (const n of notes) { const k = n.start.toFixed(3); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(n); }
      const out = [];
      for (const grp of byStart.values()) {
        grp.sort((a, b) => a.pitch - b.pitch);
        if (V.shell && grp.length >= 3) { out.push(grp[0], grp[grp.length - 1]); continue; }
        out.push(...grp);
        if (V.k === "thick" && grp.length <= 4) { const ch = chordAt(grp[0].start), lo = grp[0].pitch; let p = lo - ((pc(lo) - ch.root + 12) % 12); if (p === lo) p -= 12; if (p < 48) p += 12; if (p < lo && !grp.some((n) => n.pitch === p)) out.push({ ...grp[0], pitch: p, velocity: Math.max(40, (grp[0].velocity || 96) - 8) }); }
      }
      notes = out;
    }
    // 2b) CHORDS over a bass alone, on a re-roll: the bass note becomes the third or the fifth of another scale chord
    // (A in the bass: Am, or F, or Dm), the same answer for the same bass note across the loop, so the loop still reads
    if (mode === "chords" && V.reharm) {   // only the thin (bass-alone) stretches change chord; heard chords stay
      const scale = scaleOf(sc), subFor = new Map(); let changed = 0;
      const byStart = new Map();
      for (const n of notes) { const k = n.start.toFixed(3); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(n); }
      for (const grp of byStart.values()) {
        const sg = chordAt(grp[0].start), b = sg.root;
        if (!sg.thin) continue;
        if (!subFor.has(b)) {
          const opts = [b - 3, b - 4, b + 5].map(pc).filter((r) => scale.includes(r)).map((r) => { const t = scaleTriad(sc, r); return { root: r, pcs: t.ivs.map((x) => pc(r + x)) }; }).filter((o) => o.pcs.includes(b) && o.pcs.length >= 3);
          subFor.set(b, opts.length && Math.random() < 0.75 ? opts[Math.floor(Math.random() * opts.length)] : null);
        }
        const sub = subFor.get(b); if (!sub) continue;
        const taken = new Set();
        for (const n of grp.sort((x, y) => x.pitch - y.pitch)) {
          let best = null, bd = 99;
          for (const q of sub.pcs) for (const cand of [n.pitch + ((q - pc(n.pitch) + 12) % 12), n.pitch - ((pc(n.pitch) - q + 12) % 12)]) { const d = Math.abs(cand - n.pitch); if (d < bd && !taken.has(cand)) { bd = d; best = cand; } }
          if (best != null) { n.pitch = best; taken.add(best); }
        }
        changed++;
      }
      if (!changed) { const i = said.indexOf(V.n); if (i >= 0) said[i] = "another voicing"; }
    }
    // 3) BASS over another bass: fifths / octaves / gaps / approach, as the variant says
    if (mode === "bass" && A.registers.low > 0.6) {
      const otherBass = ctx.filter((c) => c.pitch < 48);
      const bassOnsets = new Set(otherBass.map((c) => Math.round(c.start * 4)));
      const out = [];
      for (const n of notes) {
        const ch = chordAt(n.start), root = ch.root, with_ = soundingWith(n, otherBass);
        if (V.gaps > 0 && bassOnsets.has(Math.round(n.start * 4)) && Math.random() < V.gaps) {
          // the other bass hits here: move half a beat later, into a gap, if that is still inside the clip
          const t2 = n.start + (n.length >= 1 ? 0.5 : n.length);
          if (t2 + 0.25 <= P.beats - EPS && !bassOnsets.has(Math.round(t2 * 4)) && !notes.some((q) => q !== n && Math.abs(q.start - t2) < EPS)) { n.start = t2; n.length = Math.max(0.25, Math.min(n.length, P.beats - t2)); }
          else if (Math.random() < 0.5) continue;   // or just leave this hit out
        }
        if (Math.random() < V.fifths) { const f = ch.pcs[2] != null ? ch.pcs[2] : pc(root + 7); let p = n.pitch + ((f - pc(n.pitch) + 12) % 12); if (p - n.pitch > 7) p -= 12; n.pitch = p; }
        if (with_.some((c) => c.pitch === n.pitch)) {   // the same note as the other bass: another octave of it that is free, else the fifth
          const opts = [n.pitch - 12, n.pitch + 12, n.pitch - 24].filter((p) => p >= 24 && p <= 60 && !with_.some((c) => c.pitch === p));
          if (opts.length) n.pitch = opts[n.pitch + 12 > 58 || Math.random() < 0.5 ? 0 : Math.min(1, opts.length - 1)];
          else { const f = ch.pcs[2] != null ? ch.pcs[2] : pc(root + 7); let q = n.pitch + ((f - pc(n.pitch) + 12) % 12); if (q > 60) q -= 12; n.pitch = q; }
        }
        if (V.approach && n.length >= 1 && Math.random() < 0.4 && n.start >= 0.5) { out.push({ pitch: below(sc, n.pitch), start: n.start - 0.25, length: 0.25, velocity: Math.max(50, (n.velocity || 100) - 20), slide: true }); }
        out.push(n);
      }
      notes = out;
      said.push("with the other bass");
    }
    // 3b) a bass never ends up over C4 (60): the whole part comes down an octave until it fits (before the
    // rub check, so nothing lands on the other bass afterwards)
    if (mode === "bass") while (notes.length && high(notes) > 60 && low(notes) - 12 >= 24) shift(-12);
    // 4) MELODY / ARP over another line: its rests, not its notes
    if ((mode === "melody" || mode === "arp") && V.gaps) {
      const line = ctx.filter((c) => c.pitch >= 55 && c.length < 2), onsets = new Set(line.map((c) => Math.round(c.start * 4)));
      if (line.length >= 4) {
        notes = notes.filter((n) => !(onsets.has(Math.round(n.start * 4)) && Math.random() < V.gaps * 0.6));
        said.push("in its rests");
      }
    }
    const scalePcs = scaleOf(sc);
    // 5a) ONLY KEY on: nothing outside the scale (it would only be muted), the nearest scale note instead
    if (!P.allKeys) for (const n of notes) {
      if (scalePcs.includes(pc(n.pitch))) continue;
      const ch = chordAt(n.start), w = soundingWith(n, ctx).filter((c) => c.length >= 0.45);
      const free = (p) => !w.some((c) => c.pitch === p || rubs(c.pitch, p));
      let best = null;
      for (let d = 1; d <= 6 && best == null; d++) for (const p of [n.pitch - d, n.pitch + d]) if (scalePcs.includes(pc(p)) && (ch.pcs.includes(pc(p)) || d <= 2) && free(p)) { best = p; break; }
      // then any scale note that is free of the held notes; last, the nearest scale note even if it rubs (a borrowed
      // chord over there with ONLY KEY on here): a chord drops that note below rather than play the rub
      if (best == null) for (let d = 1; d <= 6 && best == null; d++) for (const p of [n.pitch - d, n.pitch + d]) if (scalePcs.includes(pc(p)) && free(p)) { best = p; break; }
      if (best == null) { n._rubs = true; for (let d = 1; d <= 6 && best == null; d++) for (const p of [n.pitch - d, n.pitch + d]) if (scalePcs.includes(pc(p))) { best = p; break; } }
      if (best != null) n.pitch = best;
      if (n.slideFrom != null && !scalePcs.includes(pc(n.slideFrom))) n.slideFrom = below(sc, n.pitch);
    }
    // 5b) NO RUBS: a new note a semitone from a held note of another part, or the very same pitch at the same
    // time, moves to the nearest chord tone that is free (in the scale when the key is on)
    for (const n of notes) {
      const ch = chordAt(n.start), w = soundingWith(n, ctx).filter((c) => c.length >= 0.45);
      // a rub: the same pitch as another part (not for chords, which may double), or a semitone / major 7th
      // against a held note. A chord part's own 7th or 9th may sit a semitone from the chord (that is the colour).
      const bad = (p) => w.some((c) => (mode !== "chords" && c.pitch === p) || (rubs(c.pitch, p) && !(mode === "chords" && !A.messy && ch.pcs.includes(pc(p)) && ch.pcs.includes(pc(c.pitch)) && ch.ivs.length >= 4 && ch.ivs.length <= 5)));   // a 6-note template (an 11th) would excuse nearly any rub
      if (!bad(n.pitch)) continue;
      const core = [ch.pcs[0], ch.pcs[2] != null ? ch.pcs[2] : ch.pcs[0], ch.pcs[1]];   // root, fifth, third first; colour tones after
      const cands = [];
      if (mode === "bass") for (const p of [n.pitch - 12, n.pitch + 12]) if (p >= 24 && p <= 60 && !bad(p)) cands.push(p);   // a bass keeps its note, in another octave
      for (let d = 1; d <= 7 && !cands.length; d++) for (const p of [n.pitch + d, n.pitch - d]) if (core.includes(pc(p)) && !bad(p) && (P.allKeys || scalePcs.includes(pc(p)))) cands.push(p);
      for (let d = 1; d <= 7 && !cands.length; d++) for (const p of [n.pitch + d, n.pitch - d]) if (ch.pcs.includes(pc(p)) && !bad(p) && (P.allKeys || scalePcs.includes(pc(p)))) cands.push(p);
      for (let d = 1; d <= 5 && !cands.length; d++) for (const p of [n.pitch + d, n.pitch - d]) if (scalePcs.includes(pc(p)) && !bad(p)) cands.push(p);
      if (cands.length) n.pitch = cands[0]; else n._rubs = true;
    }
    // a chord note that found no free place drops out (a thinner chord beats a rub); a line keeps its note
    if (mode === "chords" && notes.some((n) => n._rubs)) {
      const byStart = new Map(); for (const n of notes) { const k = n.start.toFixed(3); byStart.set(k, (byStart.get(k) || 0) + 1); }
      const minN = A.messy ? 1 : 2;   // over a mess a single clear note beats a rub
      notes = notes.filter((n) => { if (!n._rubs) return true; const k = n.start.toFixed(3); if (byStart.get(k) <= minN) return true; byStart.set(k, byStart.get(k) - 1); return false; });
      if (!said.includes("thinner where it would rub")) said.push("thinner where it would rub");
    }
    for (const n of notes) delete n._rubs;
    // 6) tidy: no two new notes on the same pitch at the same start, nothing past the clip, pitch in range
    const seen = new Set();
    const floor = (mode === "bass" ? 24 : mode === "chords" ? 48 : A.roles.chords ? 55 : A.roles.bass ? 52 : 40) + (mode === "bass" ? 0 : Math.min(0, P.vShift || 0));   // a line never sinks into the bass or the bottom of the chords
    notes = notes.filter((n) => { n.pitch = clamp(Math.round(n.pitch), 24, 108); if (n.pitch < floor) n.pitch += 12; if (!P.allKeys && !scalePcs.includes(pc(n.pitch))) { for (let d = 1; d <= 6; d++) { if (n.pitch - d >= floor && scalePcs.includes(pc(n.pitch - d))) { n.pitch -= d; break; } if (n.pitch + d <= 108 && scalePcs.includes(pc(n.pitch + d))) { n.pitch += d; break; } } } if (n.start + n.length > P.beats + EPS) n.length = Math.max(0.1, P.beats - n.start); if (n.length <= 0.05 || n.start < -EPS) return false; const k = n.start.toFixed(3) + "|" + n.pitch; if (seen.has(k)) return false; seen.add(k); return true; });
    // 7) a pinned CHORD SIZE (night test 9 Nov): every chord ends with the size asked for. POWER = root and fifth
    // (the root may double); bigger sizes add free chord tones (no rub with the held notes there, in the key).
    if (mode === "chords" && P.pins && P.pins.voices != null && notes.length) {
      const want = Math.max(2, Math.min(5, Math.round(P.pins.voices))), byStart = new Map();
      for (const n of notes) { const k = n.start.toFixed(3); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(n); }
      const out = [];
      for (const grp of byStart.values()) {
        grp.sort((a, b) => a.pitch - b.pitch);
        const ch = chordAt(grp[0].start), root = ch.pcs[0], fifth = ch.pcs[2] != null ? ch.pcs[2] : pc(root + 7);
        const w = soundingWith(grp[0], ctx).filter((c) => c.length >= 0.45);
        const ok = (p, g) => p >= 40 && p <= 91 && !g.some((n) => n.pitch === p) && !w.some((c) => rubs(c.pitch, p)) && (P.allKeys || scalePcs.includes(pc(p)));
        let g = grp;
        if (want === 2) {
          g = grp.filter((n) => pc(n.pitch) === root || pc(n.pitch) === fifth);
          const base = g.length ? g[0] : grp[0];
          for (const q of [root, fifth]) if (!g.some((n) => pc(n.pitch) === q)) { let best = null; for (let d = 0; d <= 12 && best == null; d++) for (const p of [base.pitch + d, base.pitch - d]) if (pc(p) === q && ok(p, g)) { best = p; break; } if (best != null) g.push({ ...base, pitch: best }); }
          g.sort((a, b) => a.pitch - b.pitch); g = g.slice(0, 2).concat(g.slice(2).filter((n) => n.pitch - g[0].pitch <= 12 && pc(n.pitch) === root).slice(0, 1));
        } else {
          if (g.length > want) {   // too many: the colour notes on top go first, the root and the third stay
            const third = ch.pcs[1], core = (n) => pc(n.pitch) === root || pc(n.pitch) === third;
            while (g.length > want) { let k = -1; for (let j = g.length - 1; j > 0; j--) if (!core(g[j])) { k = j; break; } if (k < 0) k = g.length - 1; g = g.filter((_, j) => j !== k); }
          }
          const pcsAll = ch.pcs.concat((ch.ext || []).map((x) => pc(root + x)));
          for (let guard = 0; g.length < want && guard < 12; guard++) {   // too few: the nearest free chord tone above, else below
            const top = g[g.length - 1].pitch, bot = g[0].pitch; let best = null;
            for (let d = 1; d <= 12 && best == null; d++) for (const p of [top + d, bot - d]) if (pcsAll.includes(pc(p)) && ok(p, g) && (want <= 3 || !g.some((n) => Math.abs(n.pitch - p) === 1) || ch.pcs.includes(pc(p)))) { best = p; break; }
            if (best == null) break;
            g.push({ ...g[g.length - 1], pitch: best }); g.sort((a, b) => a.pitch - b.pitch);
          }
        }
        out.push(...g);
      }
      notes = out;
    }
    // 8) one chord, one hand (pinned CHORD SIZE or Pitch): a note pushed an octave away (to dodge doubling the part
    // there) folds back next to the others, toward the Pitch asked for
    if (mode === "chords" && P.pins && (P.pins.voices != null || P.pins.range != null) && notes.length) {
      const byStart = new Map();
      for (const n of notes) { const k = n.start.toFixed(3); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(n); }
      for (const g of byStart.values()) {
        if (g.length < 2) continue;
        g.sort((a, b) => a.pitch - b.pitch);
        const w = soundingWith(g[0], ctx).filter((c) => c.length >= 0.45);
        const ok = (p) => p >= 40 && p <= 91 && !g.some((n) => n.pitch === p) && !w.some((c) => rubs(c.pitch, p));
        const anchor = P.pins.range === 0 ? g[0].pitch : P.pins.range === 2 ? g[g.length - 1].pitch : g[Math.floor(g.length / 2)].pitch;
        for (const n of g) { let k = 0; while (Math.abs(n.pitch - anchor) > 12 && k++ < 3) { const q = n.pitch + (n.pitch > anchor ? -12 : 12); if (!ok(q)) break; n.pitch = q; } }
        // re-rolls with the cards pinned have fewer fits to pick from: each press turns the chords one inversion on
        // (the lowest note up an octave, or the top one down for LOW) so the same chords don't come back the same
        for (let t = 0; t < (P.turn || 0) % 3; t++) {
          g.sort((a, b) => a.pitch - b.pitch);
          if (P.pins.range === 0) { const q = g[g.length - 1].pitch - 12; if (q >= 40 && ok(q)) g[g.length - 1].pitch = q; }
          else { const q = g[0].pitch + 12; if (q <= 91 && ok(q)) g[0].pitch = q; }
        }
      }
    }
    return { notes, said, variant: V };
  }

  // a chord loop over a drone / pedal: every chord of the plan that does not hold the drone's note is swapped for
  // the nearest scale chord that does (i, VI, iv over a tonic drone), so the drone never fights the chords
  function pedal(segs, dronePcs, sc) {
    const scale = scaleOf(sc);
    const fits = (pcs) => dronePcs.every((d) => pcs.includes(d));
    const options = scale.map((r) => { const t = scaleTriad(sc, r); const pcs = t.ivs.map((x) => pc(r + x)); return { root: r, q: t.q, ivs: t.ivs, pcs, name: nameOf(r, t.q) }; }).filter((o) => fits(o.pcs));
    if (!options.length) return segs;
    return segs.map((sg) => {
      if (fits(sg.pcs)) return sg;
      let best = options[0], bd = 99;
      for (const o of options) { const d = Math.min(pc(o.root - sg.root), pc(sg.root - o.root)); if (d < bd) { bd = d; best = o; } }
      return { ...sg, root: best.root, q: best.q, ivs: best.ivs, pcs: best.pcs, name: best.name, tok: undefined };
    });
  }

  // the notes stop before the clip ends (locked chords over the first half, a bass that plays two bars of four): the
  // chord brain's loop carries on from the first free 2-beat step, so the roll has something new to say there and
  // re-rolls differ. The added segments are marked cont, so the toast still says only what was HEARD.
  function extend(A, bpSegs, fromBeat, sc) {
    if (!A || !A.heard || !bpSegs || !bpSegs.length) return A;
    const start = Math.ceil(fromBeat / 2) * 2;
    if (start > A.beats - 2 + EPS) return A;
    const last = A.segs[A.segs.length - 1];
    if (last) last.len = Math.max(0.5, start - last.beat);
    for (const x of bpSegs) {
      const b0 = Math.max(x.beat, start), e = Math.min(x.beat + x.len, A.beats);
      if (e - b0 < 0.5) continue;
      const ivs = (x.ivs || QUAL[""]).slice(), root = x.root;
      let q = ""; for (const k of Object.keys(QUAL)) if (QUAL[k].length === ivs.length && QUAL[k].every((v, i) => v === ivs[i])) { q = k; break; }
      const pcs = ivs.map((v) => pc(root + v));
      A.segs.push({ beat: b0, len: e - b0, root, q, ivs, pcs, name: x.name || nameOf(root, q), conf: 1, sounding: pcs.slice(), ext: EXT[q] || [], tot: 0, cont: true });
    }
    A.contNames = A.segs.filter((x) => x.cont).map((x) => x.name);
    return A;
  }

  function describe(A) {
    if (!A || !A.heard) return "";
    const names = []; for (const n of A.names || []) if (names[names.length - 1] !== n && names.length < 6) names.push(n);
    return names.join(" - ") + (A.advice.length ? "  (" + A.advice.join(", ") + ")" : "");
  }

  window.DiceHarmony = { hear, plan, place, variants, describe, pedal, extend, VARIANTS, QUAL, _bestChord: bestChord };
})();
