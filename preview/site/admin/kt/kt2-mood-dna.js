// MOOD DNA (Eman, 9 Nov 2026 12:55: "how do we make it sound villain every time we do a villain dice, or villain but
// playful"). The overnight test showed the MOOD card only added search words ("villain evil dark") to the chord brain,
// so a villain roll got the usual minor-pop loops (or plain F major chords with ONLY KEY on) and a weak checker called
// that a pass. This file is the mood's own science, used in three places:
//   1. the dice: with a MOOD (card, or a mood word in the prompt) the chords come from the mood's own chord moves,
//      voiced the mood's way (register, spread, octaves), and every roll is checked against the mood before it lands
//      (up to 8 tries). A second mood word ("villain but playful") blends: harmony from the first, motion from the second.
//   2. the GENRE SCIENCE tab in BACKEND DATA (ui/science/genre.js): what makes each mood, 10 playable examples each,
//      5 suggested new moods, blends.
//   3. the tests (tests/kt2/mood/moodcheck.js): judge() is the same checker.
// Chords are written from the key's root: "r:q" = root in semitones above the key's root + quality, e.g. "0:m 1:M"
// = i to bII (Cm to Db in C). Flags: KT2_MOOD_DNA_OFF = the dice as before (words only); KT2_MOOD_KEY_OLD = the key
// picker's scale wins over the mood's (with ONLY KEY on, only the mood's examples that fit that scale are used).
// ASCII only.
(() => {
  const Q = {
    M: [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], 5: [0, 7], "5b": [0, 6], note: [0], sus2: [0, 2, 7], sus4: [0, 5, 7],
    7: [0, 4, 7, 10], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mM7: [0, 3, 7, 11], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], dimM7: [0, 3, 6, 11],
    6: [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], M9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], 9: [0, 4, 7, 10, 14],
    69: [0, 4, 7, 9, 14], m11: [0, 3, 7, 10, 14, 17], "7b9": [0, 4, 7, 10, 13], "7#9": [0, 4, 7, 10, 15], "M7#11": [0, 4, 7, 11, 18],
    augM7: [0, 4, 8, 11], mb9: [0, 3, 7, 13], "7sus4": [0, 5, 7, 10],
  };
  const QN = { M: "", m: "m", dim: "dim", aug: "+", 5: "5", "5b": "(b5)", note: " note", sus2: "sus2", sus4: "sus4", 7: "7", M7: "maj7", m7: "m7", mM7: "m(maj7)", dim7: "dim7", m7b5: "m7b5", dimM7: "dim(maj7)", 6: "6", m6: "m6", add9: "add9", madd9: "m(add9)", M9: "maj9", m9: "m9", 9: "9", 69: "6/9", m11: "m11", "7b9": "7b9", "7#9": "7#9", "M7#11": "maj7#11", augM7: "+maj7", mb9: "m(b9)", "7sus4": "7sus4" };
  const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
    major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
    melodic: [0, 2, 3, 5, 7, 9, 11], phrygdom: [0, 1, 4, 5, 7, 8, 10], hungarian: [0, 2, 3, 6, 7, 8, 11], double: [0, 1, 4, 5, 7, 8, 11],
  };
  const pc = (x) => ((x % 12) + 12) % 12;
  const parse = (t) => { const [r, q] = String(t).split(":"); return { r: pc(+r), q: Q[q] ? q : "M" }; };
  const fits = (prog, scale) => { const st = SCALES[scale]; return !!st && prog.every((t) => { const p = parse(t); return Q[p.q].every((x) => st.includes(pc(p.r + x))); }); };
  // BEND INTO KEY (Eman, 10 Nov 20:46): the picked key always wins. A mood chord that has notes outside the key
  // becomes the closest chord that stays inside it: the same root with another colour (major <-> minor, sus, power
  // chord, 7ths), else the nearest root in the key. Diminished only when nothing else fits. KT2_DICE_OUTKEY = old (moods
  // could leave the key).
  const STRICT = () => !window.KT2_DICE_OUTKEY;
  const DIMQ = new Set(["dim", "dim7", "m7b5", "dimM7", "5b", "note", "aug", "augM7"]);
  function bend(t, scale) {
    const st = SCALES[scale]; if (!st || fits([t], scale)) return t;
    const p = parse(t), A = new Set(Q[p.q].map((x) => pc(p.r + x)));
    let best = null;
    for (let d = -5; d <= 6; d++) {
      const r = pc(p.r + d); if (!st.includes(r)) continue;
      for (const q of Object.keys(Q)) {
        if (q === "note" || !Q[q].every((x) => st.includes(pc(r + x)))) continue;
        const B = new Set(Q[q].map((x) => pc(r + x))); let both = 0; for (const x of A) if (B.has(x)) both++;
        // shared notes count most; a lost note costs more than an added one; a thinner chord, a moved root and a
        // diminished chord (when the mood's chord wasn't one) cost extra
        const sc = both - 0.5 * (A.size - both) - 0.25 * (B.size - both) - 0.6 * Math.max(0, A.size - B.size) - 0.3 * Math.abs(d) - (DIMQ.has(q) && !DIMQ.has(p.q) ? 2.5 : 0);
        if (!best || sc > best.sc + 1e-9) best = { sc, t: r + ":" + q };
      }
    }
    return best ? best.t : t;
  }
  const nameOf = (tonic, t) => { const p = parse(t); return NOTE[pc(tonic + p.r)] + QN[p.q]; };
  const ex = (n, c, why) => ({ n, c: c.split(" "), why });

  // v = how it's voiced: bass = where the root sits (MIDI, 36 = C2), lo/hi = the upper notes' room, shape, n = notes.
  // lean = what the dice's AUTO dials do (pace 0..3 = 2 bars..1 beat per chord, rhythm 0..4 = hold pulse stabs off broken)
  // judge: minor = least share of minor chords (of those with a 3rd), major = least share of major ones, mean = [low, high]
  // average pitch, sig = at least one of these must be heard, forbid = none of these, size = [min, max] notes per chord,
  // power = least share of bare 5ths, changes = [min, max] different chords, long = least average note length (beats),
  // span = least distance lowest to highest note
  const MOODS = [
    { k: "demonic", n: "DEMONIC", b: 0, feel: "Unholy, inhuman, ritual",
      what: "Darker than dark: the tritone (the 'devil in music') and the half step down from the root, stacked very low under a drone, moving slowly or crawling down by half steps.",
      cues: { mode: "Locrian or Phrygian: the b2 and b5 are both in the scale", chords: "diminished, dim7, the i-bII rub, chords a tritone apart", notes: "b2 + b5 (tritone) against the root", voicing: "very low drone + power fifths or tritones, clusters on top", motion: "slow and huge, or creeping down by half steps", avoid: "any major home chord, maj7, add9" },
      v: { bass: 31, lo: 40, hi: 60, shape: "drone", n: 4 }, lean: { pace: 1, rhythm: 0, voices: 4, range: 0 }, bpm: 70, rhy: "hold",
      scales: ["phrygian", "locrian", "harmonic"],
      judge: { minor: 0.5, mean: [0, 54], sig: ["tritone", "b2", "chromatic", "dim"], forbid: ["maj7", "colour", "majorHome"] },
      tools: [3, 0, 0, 2, 2, 3, 1],
      ex: [ex("RITUAL DRONE", "0:mb9 0:mb9 1:M 0:mb9", "The minor chord with a b9 rubbing on top, held like a chant, one step up to bII and back."),
        ex("TRITONE GATE", "0:m 6:M 0:m 6:M", "Two chords as far apart as music allows (a tritone). Nothing connects them."),
        ex("DESCENT", "0:m 11:dim 10:m 9:dim", "Crawling down by half steps, minor and diminished in turns."),
        ex("LOCRIAN THRONE", "0:dim 1:M 0:dim 6:M", "Home itself is a diminished chord: there is no safe place."),
        ex("SLITHER", "0:dim7 1:dim7 0:dim7 11:dim7", "Diminished 7ths sliding a half step either way: pure tension, no key."),
        ex("SUMMONING", "0:m 1:M 7:dim 0:m", "i, the bII sneer, then the diminished v: the Phrygian scale's darkest corner."),
        ex("BLACK MASS", "5:m 1:M 7:dim 0:m", "Organ-style: iv to bII to dim v, then home to a minor chord that never sounds safe."),
        ex("CURSE", "0:mM7 8:M 11:dim7 0:m", "Minor with a major 7th (horror-film chord), bVI, the leading-tone dim7."),
        ex("WITCH CIRCLE", "0:m 8:M 1:M 0:m", "i to bVI to bII: two dark borrowed steps in a circle."),
        ex("ABYSS", "0:5 0:5b 0:5 1:5", "A bare fifth that turns into a tritone and back, then sinks a half step.")] },
    { k: "rage", n: "RAGE", b: 1, feel: "Explosive anger, out of control",
      what: "Power chords only (root + 5th, no 3rd, so no happy or sad, just force), very low, fast hard hits, moving by half steps.",
      cues: { mode: "Phrygian or minor, but the 3rd is left out", chords: "power chords (5)", notes: "root + 5th + octave; the b2 move", voicing: "low, tight, doubled octaves", motion: "fast repeated hits, chromatic steps", avoid: "3rds held long, maj7, add9, anything soft" },
      v: { bass: 33, lo: 40, hi: 55, shape: "power", n: 3 }, lean: { pace: 2, rhythm: 1, voices: 2, range: 0 }, bpm: 150, rhy: "pulse",
      scales: ["phrygian", "minor", "locrian"],
      judge: { power: 0.6, mean: [0, 52], forbid: ["maj7", "colour"] },
      tools: [0, 0, 0, 0, 2, 1, 1],
      ex: [ex("HALF STEP", "0:5 1:5 0:5 1:5", "Root to the half step above and back: the metal riff in two chords."),
        ex("STOMP", "0:5 0:5 3:5 1:5", "Hit home twice, jump up a minor 3rd, fall to the b2."),
        ex("COLLAPSE", "0:5 10:5 8:5 7:5", "Falling down the minor scale in power chords."),
        ex("TRITONE HIT", "0:5 6:5 0:5 5:5", "Root then the tritone power chord: the most violent jump there is."),
        ex("CLIMB", "0:5 3:5 5:5 6:5", "Up the blues scale to the b5: the tension keeps rising."),
        ex("WAR", "0:5 8:5 10:5 0:5", "i bVI bVII i as bare fifths: hero chords turned into a fight."),
        ex("GRIND", "0:5 1:5 3:5 1:5", "Phrygian grind around the root."),
        ex("SAW", "0:5 11:5 10:5 11:5", "Sawing a half step either side of home."),
        ex("BREAKDOWN", "0:5 0:5 7:5 8:5", "Hold home, then v to bVI: the breakdown push."),
        ex("SMASH", "0:5 5:5 1:5 0:5", "iv to the b2 then home, all fifths, all force.")] },
    { k: "villain", n: "VILLAIN", b: 1, feel: "Evil on purpose: powerful, in control, menacing",
      what: "Minor, but with a sneer: one note that should not be there (the b2, the raised 7th of harmonic minor, a minor chord a major 3rd away). Low octaves and fifths underneath, steady march.",
      cues: { mode: "Harmonic minor (the raised 7th makes a major V and a dim chord) or Phrygian (the b2)", chords: "i-bII, i-V (major), minor to minor a major 3rd apart (Imperial March), dim7, augmented III", notes: "b2, b6, major 7th over a minor chord, the tritone", voicing: "root low + its octave + the minor chord close on top", motion: "steady marching hits, a chord per bar", avoid: "maj7, add9, 6ths (they sound sweet), bright high voicings" },
      v: { bass: 36, lo: 48, hi: 64, shape: "octstab", n: 4 }, lean: { pace: 1, rhythm: 2, voices: 4, range: 0 }, bpm: 90, rhy: "march",
      scales: ["harmonic", "phrygian", "minor"],
      judge: { minor: 0.25, need: ["minorHome"], mean: [0, 58], sig: ["b2", "lead", "m8m", "dim", "tritone", "aug"], forbid: ["maj7", "colour"] },
      tools: [0, 0, 0, 0, 1, 0, 0],
      ex: [ex("THE THRONE", "0:m 1:M 0:m 1:M", "i to bII: the Neapolitan sneer, a half step up and back."),
        ex("EVIL TRIAD", "0:m 8:m 0:m 8:m", "Two minor chords a major 3rd apart (Murphy's 'minor-8-minor', Wagner's evil helmet, the Imperial March)."),
        ex("TRAP DOOR", "0:m 8:M 11:dim7 0:m", "i, bVI, then the dim7 on the raised 7th pulls back home."),
        ex("HARMONIC DOOM", "0:m 7:M 0:m 7:M", "i to a MAJOR V: the raised 7th of harmonic minor, the classic villain cadence."),
        ex("MASTERMIND", "0:m 2:dim 7:7b9 0:m", "ii dim, V7b9, i: the whole harmonic-minor cadence, scheming."),
        ex("SHADOW", "0:m 6:M 0:m 7:M", "i to the chord a tritone away, then the major V."),
        ex("MARCH", "0:m 0:m 5:m 7:M", "Home twice, iv, major V: an army walking."),
        ex("CROWN", "0:m 8:M 1:M 7:M", "i bVI bII V: every dark borrowed chord in one loop."),
        ex("SNAKE", "0:mM7 0:m 8:M 7:7", "The minor-major 7th (spy/villain chord) dissolving into minor, bVI, V7."),
        ex("COLD SMILE", "0:m 3:aug 8:M 7:M", "The augmented III of harmonic minor: a smile that is not friendly.")] },
    { k: "dark", n: "DARK", b: 2, feel: "Heavy, shadowy, serious",
      what: "Plain minor triads, no colour, close and low, slow. The b6 and b2 lean the darkness; nothing sweet.",
      cues: { mode: "Natural minor or Phrygian", chords: "minor triads, bVI, minor v", notes: "b3, b6 (and b2)", voicing: "close, low-mid", motion: "slow, a chord per bar or two", avoid: "maj7, add9, 6ths, major home chord" },
      v: { bass: 36, lo: 46, hi: 62, shape: "close", n: 4 }, lean: { pace: 1, rhythm: 0, voices: 3, range: 0 }, bpm: 80, rhy: "hold",
      scales: ["minor", "phrygian", "harmonic"],
      judge: { minor: 0.4, need: ["minorHome"], mean: [0, 58], sig: ["b6", "b2"], forbid: ["maj7", "colour", "majorHome"] },
      tools: [0, 0, 0, 0, 1, 0, 1],
      ex: [ex("SHADOW SWAY", "0:m 8:M 0:m 8:M", "i to bVI: the b6 rising a half step over the 5th, the darkest common move."),
        ex("WEIGHT", "0:m 5:m 0:m 5:m", "i to iv, both minor: heavy and grounded."),
        ex("PHRYGIAN STEP", "0:m 1:M 0:m 0:m", "One touch of the b2, then home."),
        ex("SINK", "0:m 8:M 5:m 0:m", "Down through bVI and iv back home."),
        ex("GREY", "0:m 7:m 8:M 7:m", "The minor v (no leading tone) keeps it cold."),
        ex("STONE", "0:m 3:M 8:M 7:m", "bIII and bVI lift a little, the minor v drops it again."),
        ex("STAIRS DOWN", "0:m 10:M 8:M 7:m", "Walking down i bVII bVI v."),
        ex("DEEP", "5:m 0:m 8:M 0:m", "Starting from iv makes home sound even lower."),
        ex("BURIED", "0:m 0:m 8:M 1:M", "bVI then the b2: darkness creeping in."),
        ex("HEAVY CADENCE", "0:m 5:m 8:M 7:M", "Ends on a major V that pulls back hard to minor.")] },
    { k: "unease", n: "UNEASE", b: 2, feel: "Something is wrong, can't relax",
      what: "Chords that don't belong together: augmented and diminished, minor chords a tritone or half step apart, clusters. Nothing lands.",
      cues: { mode: "no stable key: harmonic minor, chromatic", chords: "augmented, dim7, minor-major 7th, chromatic minor chords", notes: "half-step rubs, the tritone", voicing: "close clusters, mid", motion: "uneven, chords that slip", avoid: "a clear home chord, plain major" },
      v: { bass: 43, lo: 55, hi: 72, shape: "cluster", n: 4 }, lean: { pace: 2, rhythm: 3, voices: 4, range: 1 }, bpm: 85, rhy: "off",
      scales: ["harmonic", "locrian", "minor"],
      judge: { sig: ["aug", "dim", "cluster", "chromatic", "tritone"], forbid: ["majorHome"] },
      tools: [0, 0, 0, 2, 2, 0, 0],
      ex: [ex("NEIGHBOURS", "0:m 1:m 0:m 11:m", "Minor chords a half step up and down: the floor moves."),
        ex("FLOAT WRONG", "0:augM7 0:augM7 3:aug 3:aug", "Augmented chords have no centre: they float the wrong way."),
        ex("SLIP", "0:dim7 0:dim7 1:dim7 1:dim7", "A dim7 slipping a half step."),
        ex("FAR AWAY", "0:m 6:m 0:m 6:m", "Two minor chords a tritone apart: no shared notes."),
        ex("WRONG TURN", "0:mb9 8:M 0:mb9 2:dim", "A rub inside home, then dim ii."),
        ex("AUG TURN", "3:aug 0:m 3:aug 11:dim", "Harmonic minor's augmented III and dim vii."),
        ex("LOCRIAN", "0:m7b5 1:M 0:m7b5 6:M", "Half-diminished home: it never settles."),
        ex("UNCANNY CYCLE", "0:m 4:m 8:m 0:m", "Minor chords a major 3rd apart all the way round (the uncanny hexatonic cycle)."),
        ex("BREATH HELD", "0:dimM7 0:m 0:dimM7 1:M", "Diminished with a major 7th: the horror chord."),
        ex("SPIRAL", "0:m 2:dim 3:aug 11:dim7", "Every unstable chord harmonic minor owns.")] },
    { k: "sad", n: "SAD", b: 3, feel: "Crying, heavy heart, open grief",
      what: "Natural minor (mode is the strongest sad cue in the studies), minor 7ths, slow changes, low-mid, and the chords land home: it hurts but it resolves.",
      cues: { mode: "Natural minor (Aeolian)", chords: "i VI III VII, minor 7ths", notes: "b3, b6, b7", voicing: "close-to-open, low-mid", motion: "slow, legato", avoid: "dim and aug (too tense), bright high voicings" },
      v: { bass: 40, lo: 53, hi: 70, shape: "open", n: 4 }, lean: { pace: 1, rhythm: 0, voices: 4, range: 1 }, bpm: 75, rhy: "hold",
      scales: ["minor", "dorian", "harmonic"],
      judge: { minor: 0.25, mean: [46, 70], sig: ["minorHome"], forbid: ["aug", "cluster"] },
      tools: [0, 1, 0, 0, 1, 0, 0],
      ex: [ex("THE CLASSIC", "0:m 8:M 3:M 10:M", "i VI III VII: the most used sad loop in pop."),
        ex("FALLING", "0:m 5:m 8:M 10:M", "i iv VI VII: down to iv, rising back."),
        ex("RAIN", "0:m7 5:m7 10:M 3:M7", "Soft minor 7ths walking to the relative major."),
        ex("COMING HOME", "8:M 10:M 0:m 0:m", "VI VII i: the ache resolving."),
        ex("SWAY", "0:m 10:M 8:M 10:M", "i VII VI VII: rocking back and forth."),
        ex("MEMORY", "0:m 7:m 8:M 3:M", "i v VI III."),
        ex("SLOW WALK", "0:m 3:M 5:m 0:m", "i III iv i."),
        ex("HEAVY HEART", "5:m 0:m 8:M 7:m", "iv to i, then VI v."),
        ex("TEARS", "0:m 8:M 5:m 7:M", "The major V at the end makes it cry, then land."),
        ex("GRIEF", "0:m9 8:M7 3:M 10:M", "Minor 9 and maj7 on VI: sad but beautiful.")] },
    { k: "suspense", n: "SUSPENSE", b: 3, feel: "Something is about to happen",
      what: "Waiting: one chord or a pedal bass held while a single inner note moves, sus chords that never resolve, ends on the dominant.",
      cues: { mode: "Minor or harmonic minor", chords: "sus4/sus2 held, line cliche (m, mM7, m7, m6), V7b9 left hanging", notes: "one moving inner voice over a pedal", voicing: "pedal bass, close top", motion: "short repeated pulses, building", avoid: "landing home at the end" },
      v: { bass: 38, lo: 52, hi: 70, shape: "close", n: 4 }, lean: { pace: 1, rhythm: 1, voices: 3, range: 1 }, bpm: 100, rhy: "pulse",
      scales: ["minor", "harmonic", "phrygian"],
      judge: { sig: ["pedal", "sus", "dim", "aug", "lineCliche"], forbid: ["maj7", "colour"] },
      tools: [3, 0, 0, 1, 0, 1, 0],
      ex: [ex("LINE CLICHE", "0:m 0:mM7 0:m7 0:m6", "The spy move: one note slides down inside a held minor chord."),
        ex("WAIT", "0:sus4 0:m 0:sus4 0:m", "sus4 leaning onto minor again and again."),
        ex("TICK", "0:m 0:mb9 0:m 0:mb9", "A b9 ticking on and off over home."),
        ex("HOVER", "0:sus2 0:sus2 0:sus4 0:sus4", "No 3rd at all: not happy, not sad, waiting."),
        ex("HANG", "0:m 0:m 7:sus4 7:M", "Ends on the dominant: the question is never answered."),
        ex("NO LANDING", "8:M 8:M 7:sus4 7:sus4", "bVI to a suspended V."),
        ex("PACING", "0:m 2:dim 0:m 2:dim", "i and dim ii pacing back and forth."),
        ex("STRETCH", "0:m 3:aug 0:m 3:aug", "One note rising a half step inside the chord."),
        ex("CLIFF", "5:m 5:m 7:7sus4 7:7sus4", "iv then a 7sus4 that refuses to fall."),
        ex("TRIGGER", "0:m 0:m 0:m 7:7b9", "Three bars of home, then the sharpest dominant, unresolved.")] },
    { k: "lonely", n: "LONELY", b: 4, feel: "Empty room, missing someone, quiet ache",
      what: "Sparse minor with one bright note (the 'lonely shine': a major 7th or 9th over minor), thin high voicing with a single low note far below, lots of space.",
      cues: { mode: "Minor or Dorian", chords: "m(add9), m(maj7), maj7 on bVI and bIII", notes: "9th and major 7th against minor", voicing: "one low note, a gap, two or three notes high", motion: "slow, few hits", avoid: "full low chords, power chords" },
      v: { bass: 33, lo: 62, hi: 80, shape: "thin", n: 3 }, lean: { pace: 1, rhythm: 0, voices: 3, range: 2 }, bpm: 70, rhy: "hold",
      scales: ["minor", "dorian", "harmonic"],
      judge: { size: [2, 4.2], sig: ["shine"], gap: 14, forbid: ["power"] },
      tools: [5, 2, 0, 0, 1, 0, 0],
      ex: [ex("EMPTY ROOM", "0:madd9 8:M7 0:madd9 8:M7", "Minor with a 9th, then bVI maj7: one warm note in a cold room."),
        ex("STREETLIGHT", "0:mM7 0:mM7 8:M7 8:M7", "Minor-major 7th: the major 7th glows inside the minor chord."),
        ex("MISSING", "0:madd9 5:madd9", "Two minor chords, each with a 9th shining on top."),
        ex("LAST TRAIN", "8:M7 7:m7 5:m7 0:madd9", "Walking down to a minor home with a 9th on it."),
        ex("WINDOW", "0:madd9 3:M7 8:add9 10:sus2", "Each chord carries one shiny note."),
        ex("ALONE", "0:madd9 0:madd9 5:m6 5:m6", "The major 6th inside iv: a little light."),
        ex("SNOW", "3:M7 3:M7 0:madd9 0:madd9", "From the relative major's maj7 back to minor."),
        ex("NIGHT BUS", "0:m7 10:add9 8:M7 8:M7", "i7 bVII(add9) bVI maj7."),
        ex("ECHO", "0:mM7 5:m 0:mM7 8:M", "The minor-major 7th returning."),
        ex("WAITING UP", "5:madd9 0:madd9 5:madd9 7:sus4", "Ends on a sus that doesn't come back.")] },
    { k: "godlike", n: "GODLIKE", b: 4, feel: "Huge, holy and dangerous at once (church + cinema + villain)",
      what: "Organ and choir: minor that suddenly turns major (i bVI bVII I), every chord huge, octaves and fifths doubled low and high, very slow, every chord a statement.",
      cues: { mode: "Minor with a major ending (Picardy third) or Dorian (the major IV)", chords: "i bVI bVII I, i-IV (the 'fantasy fifth')", notes: "the major 3rd arriving at the end", voicing: "wide: low octave + fifth, full chord in the middle, top octave", motion: "very slow, one chord per bar or two", avoid: "small close voicings, 7ths and 9ths (it's triads made huge)" },
      v: { bass: 31, lo: 48, hi: 79, shape: "wide", n: 6 }, lean: { pace: 1, rhythm: 0, voices: 5, range: 1 }, bpm: 70, rhy: "hold",
      scales: ["minor", "dorian", "harmonic"],
      judge: { size: [3, 9], span: 28, sig: ["bVIbVII", "picardy", "fantasy5", "b6"], forbid: ["cluster"] },
      tools: [0, 2, 3, 0, 1, 1, 3],
      ex: [ex("ASCENSION", "0:m 8:M 10:M 0:M", "i bVI bVII and then a MAJOR I: the sudden light (Picardy third)."),
        ex("CATHEDRAL", "0:m 8:M 3:M 10:M", "The classic minor loop made huge with organ octaves."),
        ex("THRONE ROOM", "0:m 8:M 10:M 3:M", "i bVI bVII bIII: four triads, each a statement."),
        ex("RISING", "8:M 10:M 0:m 0:m", "bVI bVII i held: arriving."),
        ex("GOSPEL DARK", "0:m 10:M 5:M 0:m", "Dorian: the major IV gives the holy lift."),
        ex("REVELATION", "0:m 3:M 10:M 5:M", "Ends on the major IV: wonder."),
        ex("JUDGEMENT", "8:M 3:M 10:M 0:M", "Lands on a major I after all."),
        ex("CHOIR", "0:sus4 0:m 8:M 10:M", "A sus4 opening like a choir breathing in."),
        ex("TEMPLE", "0:5 8:M 10:5 0:5", "Bare fifths and one full chord: stone and light."),
        ex("WRATH", "0:m 7:M 8:M 10:M", "The major V, then bVI bVII climbing.")] },
    { k: "monotone", n: "MONOTONE", b: 5, feel: "Nothingness: cold, powerful or numb",
      what: "One chord or one note, repeated, a pedal bass, no colour. The feeling comes from the sound and the rhythm, not the harmony.",
      cues: { mode: "any", chords: "one chord (two at most)", notes: "root, 5th", voicing: "the same shape every hit", motion: "repeated hits", avoid: "chord changes, colour notes" },
      v: { bass: 36, lo: 48, hi: 62, shape: "close", n: 3 }, lean: { pace: 0, rhythm: 1, voices: 2, range: 1 }, bpm: 125, rhy: "pulse",
      scales: ["minor", "phrygian", "dorian"],
      judge: { changes: [1, 2], forbid: ["colour", "maj7"] },
      tools: [3, 0, 0, 0, 0, 0, 0],
      ex: [ex("FLAT", "0:m 0:m 0:m 0:m", "One minor chord, forever."),
        ex("FIFTH", "0:5 0:5 0:5 0:5", "Root and fifth only: no mood at all."),
        ex("ONE NOTE", "0:note 0:note 0:note 0:note", "A single note: all feeling comes from the rhythm."),
        ex("TWITCH", "0:m 0:m 0:m 8:M", "Three bars the same, one small step."),
        ex("COLD 7", "0:m7 0:m7 0:m7 0:m7", "A minor 7th repeated: cool, numb."),
        ex("HOLLOW", "0:sus2 0:sus2 0:sus2 0:sus2", "No 3rd, nothing to feel."),
        ex("TWO STATES", "0:m 0:m 3:M 3:M", "Two bars each of two chords."),
        ex("MACHINE", "0:5 0:5 10:5 10:5", "Two fifths, a step apart."),
        ex("BLINK", "0:m 0:m 0:sus4 0:m", "A sus4 blink, then the same again."),
        ex("LOOP", "0:m 5:m 0:m 0:m", "One iv, then numb again.")] },
    { k: "cinematic", n: "CINEMATIC", b: 5, feel: "A big scene: wide, emotional, telling a story",
      what: "Minor and major mixed (i VI III VII), spread wide from low to high, long holds, tension then release; chromatic mediants (a major chord a 3rd away) for the 'wow' moment.",
      cues: { mode: "Minor or Dorian, borrowing freely", chords: "i VI III VII, i-IV, chromatic mediants", notes: "the 3rd changing between chords", voicing: "very wide: low root, open fifth, chord high", motion: "slow build", avoid: "small close voicings" },
      v: { bass: 36, lo: 50, hi: 76, shape: "wide", n: 5 }, lean: { pace: 1, rhythm: 0, voices: 5, range: 1 }, bpm: 90, rhy: "swell",
      scales: ["minor", "dorian", "harmonic"],
      judge: { span: 24, sig: ["b6", "mediant", "fantasy5", "minorHome"], forbid: ["cluster"] },
      tools: [0, 2, 0, 0, 1, 1, 1],
      ex: [ex("EPIC LOOP", "0:m 8:M 3:M 10:M", "i VI III VII spread over four octaves."),
        ex("ZIMMER", "0:m 3:M 10:M 5:M", "Dorian's major IV: the modern film-score lift."),
        ex("HORIZON", "8:M 10:M 3:M 0:m", "VI VII III, then home in minor."),
        ex("BUILD", "0:m 5:m 8:M 10:sus4", "Ends on a sus that wants the next scene."),
        ex("STORY", "0:m 8:M 5:m 7:M", "The major V turns the page."),
        ex("SWELL", "0:m 10:M 8:M 8:M", "Holding the bVI: the emotional peak."),
        ex("CLIFFHANGER", "0:m 8:M 10:M 7:sus4", "Stops on a suspended V."),
        ex("JOURNEY", "3:M 10:M 0:m 8:M", "Starts in the relative major, falls into minor."),
        ex("WONDER", "0:m 4:M 0:m 4:M", "A major chord a major 3rd up from minor: the film-music 'wow' (chromatic mediant)."),
        ex("TITLES", "0:madd9 8:M7 3:add9 10:6", "Every chord with a colour note, spread wide.")] },
    { k: "psychedelic", n: "PSYCHEDELIC", b: 5, feel: "Melting, colours shifting, slightly unreal",
      what: "Chords that don't share one key: a major chord a whole step up (Lydian II), majors a 3rd apart, parallel slides. The loop repeats but its colour keeps changing.",
      cues: { mode: "Lydian (#4) or Mixolydian", chords: "I-II major, major chords a 3rd apart, I7-bVII", notes: "the #4, notes outside the key", voicing: "open, mid", motion: "a loop that drifts", avoid: "plain diatonic pop loops, dim" },
      v: { bass: 40, lo: 55, hi: 76, shape: "open", n: 4 }, lean: { pace: 1, rhythm: 4, voices: 4, range: 1 }, bpm: 95, rhy: "broken",
      scales: ["lydian", "mixolydian", "dorian"],
      judge: { sig: ["lydian", "mediant", "parallel", "mixo"], forbid: ["dim"] },
      tools: [0, 1, 4, 0, 2, 0, 0],
      ex: [ex("LYDIAN LIFT", "0:M 2:M 0:M 2:M", "I to II major: the #4 floats everything."),
        ex("COLOUR WHEEL", "0:M 8:M 0:M 4:M", "Major chords a major 3rd away on both sides."),
        ex("PRISM", "0:M7 2:M 4:m 2:M", "Lydian maj7, the major II, iii."),
        ex("MELT", "0:M 10:M 8:M 6:M", "Majors sliding down in whole steps."),
        ex("DORIAN HAZE", "0:m 2:m 0:m 2:m", "Two minor chords a step apart (Dorian)."),
        ex("KALEIDOSCOPE", "0:M 3:M 0:M 9:M", "Major chords a minor 3rd either way."),
        ex("SPACE", "0:M7#11 0:M7#11 2:M 2:M", "The #11 on the maj7 chord: Lydian in one chord."),
        ex("CYCLE", "0:M 4:M 8:M 0:M", "Around the circle of major 3rds back home."),
        ex("TRIP", "0:7 10:M 0:7 10:M", "I7 to bVII: the 60s Mixolydian swirl."),
        ex("WARP", "0:M 6:M 0:M 6:M", "Two major chords a tritone apart.")] },
    { k: "ambient", n: "AMBIENT", b: 6, feel: "A space you sit inside: wide, slow, weightless",
      what: "Long overlapping chords with maj7, add9 and sus colours, one change every 2 to 4 bars, spread wide, no hard hits, nothing resolves strongly.",
      cues: { mode: "Major, Lydian or Dorian", chords: "maj7, maj9, add9, sus2, 6/9", notes: "9ths and major 7ths", voicing: "very wide and airy", motion: "very slow, long holds", avoid: "dim, short stabs, strong V-I" },
      v: { bass: 36, lo: 55, hi: 84, shape: "wide", n: 5 }, lean: { pace: 0, rhythm: 0, voices: 5, range: 1 }, bpm: 70, rhy: "hold",
      scales: ["major", "lydian", "dorian"],
      judge: { long: 2, sig: ["maj7", "colour", "sus"], forbid: ["dim", "aug"] },
      tools: [0, 2, 0, 0, 0, 3, 0],
      ex: [ex("SKY", "0:M9 0:M9 5:M9 5:M9", "Two maj9 chords, two bars each."),
        ex("SHORE", "0:add9 0:add9 9:m7 9:m7", "add9 to the relative minor 7th."),
        ex("AIR", "0:sus2 0:sus2 5:sus2 5:sus2", "Open sus2 chords: no 3rd, no weight."),
        ex("SPACE STATION", "0:M7 0:M7 2:M 2:M", "Lydian: maj7 and the major II."),
        ex("TIDE", "5:M7 5:M7 0:add9 0:add9", "IV maj7 to home with a 9th."),
        ex("FOG", "9:m9 9:m9 5:M7 5:M7", "Minor 9 into maj7."),
        ex("STILL WATER", "0:69 0:69 0:69 5:69", "6/9 chords: as open as harmony gets."),
        ex("BREATH", "0:M7 4:m7 0:M7 4:m7", "Two chords sharing three notes."),
        ex("GLOW", "2:m9 2:m9 0:M9 0:M9", "ii9 to Imaj9."),
        ex("DRIFT", "0:sus4 0:sus2 5:add9 0:sus2", "Suspended chords drifting.")] },
    { k: "meditative", n: "MEDITATIVE", b: 6, feel: "Calm, breathing, still but warm",
      what: "One or two chords, a drone or pedal bass, sus2 and sus4, almost no movement, soft mid range. Studies: peaceful music depends most on slow tempo and soft dynamics, not on the chords.",
      cues: { mode: "Major or Mixolydian", chords: "sus2, sus4, add9, 6", notes: "2nd, 4th, 6th: no tension notes", voicing: "open, mid, soft", motion: "almost none, long holds", avoid: "dim, aug, many changes" },
      v: { bass: 38, lo: 53, hi: 70, shape: "open", n: 4 }, lean: { pace: 0, rhythm: 0, voices: 3, range: 1 }, bpm: 60, rhy: "hold",
      scales: ["major", "mixolydian", "dorian"],
      judge: { changes: [1, 3], sig: ["sus", "pedal", "colour"], forbid: ["dim", "aug", "cluster"] },
      tools: [3, 1, 0, 0, 0, 0, 0],
      ex: [ex("BREATHE", "0:sus2 0:sus2 0:sus2 0:sus2", "One open chord, breathing."),
        ex("TWO BREATHS", "0:sus2 5:sus2 0:sus2 5:sus2", "In and out."),
        ex("WARM", "0:add9 0:add9 0:add9 0:add9", "Home with a soft 9th."),
        ex("SETTLE", "0:sus4 0:M 0:sus4 0:M", "sus4 resting into major."),
        ex("TEA", "0:M7 0:M7 5:add9 5:add9", "Two bars each."),
        ex("DRONE", "0:5 0:5 0:sus2 0:sus2", "A fifth, then the 2nd joins."),
        ex("SOFT LIGHT", "9:m7 9:m7 0:add9 0:add9", "The relative minor 7th to home."),
        ex("SIX", "0:6 0:6 0:6 0:6", "The 6th chord: content."),
        ex("TIDE IN", "0:sus2 7:sus4 0:sus2 7:sus4", "Two suspended chords swaying."),
        ex("GARDEN", "0:69 0:69 5:69 5:69", "6/9 chords, slow.")] },
    { k: "dreamy", n: "DREAMY", b: 7, feel: "Floating, soft focus, half asleep",
      what: "maj7 and maj9 chords sliding by a step, no strong landing, airy high voicings, long holds. In studies maj7 and m7 are the most 'tender' and 'nostalgic' chords.",
      cues: { mode: "Major or Lydian", chords: "maj7, maj9, m7, 6", notes: "major 7th, 9th", voicing: "open and high", motion: "slow, stepwise", avoid: "power chords, dim, strong V-I" },
      v: { bass: 45, lo: 60, hi: 82, shape: "open", n: 5 }, lean: { pace: 1, rhythm: 0, voices: 5, range: 2 }, bpm: 80, rhy: "hold",
      scales: ["major", "lydian", "mixolydian"],
      judge: { mean: [58, 90], sig: ["maj7"], forbid: ["dim", "power"] },
      tools: [0, 2, 0, 0, 2, 0, 0],
      ex: [ex("CLOUD", "0:M7 5:M7 0:M7 5:M7", "Two maj7 chords swaying."),
        ex("DESCEND", "5:M7 4:m7 2:m7 0:M7", "Stepping down to home."),
        ex("HALF ASLEEP", "0:M9 2:m9 4:m7 5:M9", "Stepping up, all soft."),
        ex("SOFT FOCUS", "5:M7 7:6 4:m7 9:m7", "No dominant 7th anywhere."),
        ex("FLOAT", "0:M7 2:M 0:M7 2:M", "The Lydian major II."),
        ex("PILLOW", "9:m9 5:M9 0:M9 7:6", "Every chord extended."),
        ex("TWIN", "4:m7 5:M7 4:m7 5:M7", "Two chords a half step apart that share three notes."),
        ex("NEVER LANDS", "0:add9 9:m7 5:M7 7:sus4", "Ends suspended."),
        ex("SUNDAY", "2:m9 7:6 0:M9 9:m7", "ii9 to I, softened."),
        ex("LYDIAN DREAM", "5:M7#11 0:M7 5:M7#11 0:M7", "The #11 on IV: the dreamiest chord in the major key.")] },
    { k: "heroic", n: "HEROIC", b: 8, feel: "Standing up, marching forward, winning",
      what: "Major, with the borrowed 'hero chords' bVI and bVII (or a strong I IV V), power fifths in the bass, steady strong rhythm, rising.",
      cues: { mode: "Major or Mixolydian", chords: "I bVI bVII I, I IV V, the Lydian II", notes: "the major 3rd, rising roots", voicing: "root + fifth low, triad above", motion: "steady quarter or half notes, rising", avoid: "maj7, minor home, dim" },
      v: { bass: 36, lo: 52, hi: 72, shape: "power3", n: 5 }, lean: { pace: 1, rhythm: 1, voices: 4, range: 1 }, bpm: 110, rhy: "march",
      scales: ["major", "mixolydian", "lydian"],
      judge: { major: 0.6, sig: ["heroMajor", "plagalDom", "lydian"], forbid: ["maj7", "minorHome", "dim"] },
      tools: [0, 1, 1, 0, 1, 1, 1],
      ex: [ex("VICTORY", "0:M 8:M 10:M 0:M", "I bVI bVII I: the hero cadence from games and films."),
        ex("ANTHEM", "0:M 5:M 7:M 0:M", "I IV V I, made strong."),
        ex("RISE UP", "0:M 7:M 9:m 5:M", "I V vi IV with power."),
        ex("MARCH ON", "0:M 10:M 5:M 0:M", "The Mixolydian bVII."),
        ex("CHARGE", "5:M 7:M 0:M 0:M", "IV V then I held."),
        ex("SUNRISE", "0:M 2:M 5:M 0:M", "The Lydian major II: wonder before the win."),
        ex("BANNER", "9:m 5:M 0:M 7:M", "From vi up to the anthem."),
        ex("FORWARD", "0:5 10:5 5:5 7:5", "Power fifths, Mixolydian."),
        ex("STAND", "0:M 4:m 5:M 7:M", "Climbing I iii IV V."),
        ex("TRIUMPH", "0:M 3:M 5:M 0:M", "bIII to IV: the rock-hero lift.")] },
    { k: "playful", n: "PLAYFUL", b: 9, feel: "Cheeky, bouncy, a smile with a wink",
      what: "Major with 6ths and add9, short stabs and off-beats, quick changes, little chromatic winks (secondary dominants), a jumpy bass, mid-high.",
      cues: { mode: "Major", chords: "6, add9, dominant 7ths, secondary dominants (III7, II7)", notes: "6th and 9th; one chromatic wink", voicing: "close, mid-high", motion: "short stabs, off-beats, quick changes", avoid: "minor home, long holds, low heavy voicings" },
      v: { bass: 48, lo: 60, hi: 77, shape: "close", n: 4 }, lean: { pace: 2, rhythm: 2, voices: 4, range: 2 }, bpm: 115, rhy: "bounce",
      scales: ["major", "mixolydian", "lydian"],
      judge: { major: 0.45, mean: [53, 90], sig: ["colour", "dom7", "short"], forbid: ["minorHome", "dim7"] },
      tools: [2, 0, 0, 0, 1, 0, 0],
      ex: [ex("WINK", "0:6 9:m7 2:m7 7:7", "I6 vi7 ii7 V7: the bouncy jazz turnaround."),
        ex("RAGTIME", "0:M 4:7 9:m 7:7", "The III7 secondary dominant: a chromatic wink."),
        ex("SKIP", "0:add9 5:6 0:add9 7:M", "add9 and 6th chords skipping."),
        ex("BOUNCE", "0:M 5:M 0:M 7:M", "I IV I V, played short."),
        ex("CHEEKY", "0:6 2:m7 0:6 7:7", "Back and forth to the V7."),
        ex("CARTOON", "5:M 7:M 4:m 9:m", "IV V iii vi (the J-pop royal road)."),
        ex("SMIRK", "0:M 9:m 5:M 7:7sus4", "Ends on a 7sus4 tease."),
        ex("BLUES WINK", "0:7 5:7 0:7 7:7", "All dominant 7ths: the blues smile."),
        ex("HOP", "0:M 2:7 5:M 0:M", "The II7 jump."),
        ex("SUNNY", "0:69 9:m7 5:69 7:7", "6/9 chords: the brightest colours.")] },
    { k: "euphoric", n: "EUPHORIC", b: 10, feel: "Hands in the air, peak of the night, pure release",
      what: "Major with big lifts (IV to V to vi or I), sus chords resolving to major, wide open voicings, high, add9 shimmer.",
      cues: { mode: "Major", chords: "IV V vi I, sus4 to major, add9", notes: "9th shimmer, the rising IV-V", voicing: "wide and high", motion: "fast pulse, building", avoid: "dim, aug, minor home, low close chords" },
      v: { bass: 40, lo: 60, hi: 84, shape: "wide", n: 5 }, lean: { pace: 1, rhythm: 1, voices: 5, range: 2 }, bpm: 128, rhy: "pulse",
      scales: ["major", "lydian", "mixolydian"],
      judge: { major: 0.5, mean: [58, 92], sig: ["lift", "sus", "colour", "axis"], forbid: ["dim", "aug", "minorHome"] },
      tools: [2, 2, 0, 0, 1, 1, 2],
      ex: [ex("PEAK", "5:M 7:M 9:m 0:M", "IV V vi I: the trance lift."),
        ex("HANDS UP", "9:m 5:M 0:M 7:M", "vi IV I V: the festival loop."),
        ex("RELEASE", "0:sus4 0:M 5:add9 7:sus4", "sus resolving to major, then another sus."),
        ex("SHIMMER", "5:add9 7:add9 9:m7 9:m7", "add9 on IV and V."),
        ex("GLOW STICKS", "0:add9 7:M 9:m7 5:M7", "I V vi IV with colour."),
        ex("TAKE OFF", "5:M 7:M 0:M 0:M", "IV V I held."),
        ex("ROOFTOP", "9:m 7:M 5:M 7:sus4", "Falling then a suspended V."),
        ex("SUNRISE SET", "0:M 4:m 5:M 7:sus4", "I iii IV Vsus."),
        ex("FOREVER", "5:M9 0:add9 7:6 9:m7", "Wide 9ths everywhere."),
        ex("AXIS", "0:M 7:M 9:m 5:M", "I V vi IV: the most used happy loop.")] },
  ];

  // moods the 18 miss (from the music-emotion studies: Cowen 2020's 13 dimensions, the GEMS scale, Lahdelma 2016)
  const EXTRA = [
    { k: "sexy", n: "SEXY", b: 4, feel: "Slow, smooth, close, wanting", why: "Cowen 2020 found 'erotic/desirous' is its own feeling in music; R&B and neo-soul live here. Nothing in the 18 covers it.",
      what: "Minor 9ths and 11ths, Dorian, slow, swung, chords that glide by half steps.",
      cues: { mode: "Dorian or minor", chords: "m9, m11, 9, maj9", notes: "9ths and 11ths", voicing: "close, mid", motion: "slow, swung, legato", avoid: "power chords, dim, bright high triads" },
      v: { bass: 38, lo: 52, hi: 70, shape: "close", n: 5 }, lean: { pace: 1, rhythm: 1, voices: 5, range: 1 }, bpm: 75, rhy: "swing", scales: ["dorian", "minor"],
      judge: { sig: ["colour", "ext", "m7"], forbid: ["power", "dim"] },
      ex: [ex("SLOW JAM", "0:m9 5:9 0:m9 5:9", "Dorian i9 to IV9."), ex("VELVET", "0:m7 3:M7 5:m7 7:m7", "Soft 7ths climbing."), ex("LATE", "8:M7 7:m7 5:m9 0:m9", "Down to a minor 9."),
        ex("SMOKE", "0:m11 0:m11 5:m9 5:m9", "m11: the neo-soul chord."), ex("SILK", "2:m7 7:7 0:M9 9:m9", "ii V I in major, soft."), ex("BURN", "0:m9 10:6 8:M7 7:7#9", "Ends on the 7#9."),
        ex("CANDLE", "5:m9 10:9 3:M9 8:M7", "A ii V I to the relative major."), ex("GROOVE", "0:m7 5:7 0:m7 5:7", "i7 IV7."), ex("CLOSE", "0:m9 1:M7 0:m9 1:M7", "A half-step glide."), ex("AFTER HOURS", "8:M9 10:6 0:m9 0:m9", "Back to the minor 9.")] },
    { k: "nostalgic", n: "NOSTALGIC", b: 5, feel: "Bittersweet, remembering, warm and sad at once", why: "GEMS lists nostalgia as a core music feeling, and Lahdelma 2016 found the minor, maj7 and m7 chords rate highest for it. Between SAD and DREAMY.",
      what: "Major songs with one borrowed minor chord (IV to iv), maj7 and m7, mid register.",
      cues: { mode: "Major borrowing from minor", chords: "IV-iv-I, maj7, m7", notes: "the b6 inside the iv chord", voicing: "open, mid", motion: "medium-slow", avoid: "dim, power chords" },
      v: { bass: 40, lo: 55, hi: 74, shape: "open", n: 4 }, lean: { pace: 1, rhythm: 0, voices: 4, range: 1 }, bpm: 85, rhy: "hold", scales: ["major"],
      judge: { sig: ["ivMinor", "maj7", "iii"], forbid: ["power", "dim7"] },
      ex: [ex("THE SAD SMILE", "5:M 5:m 0:M 0:M", "IV to iv: the borrowed minor chord is the memory."), ex("POLAROID", "0:M7 9:m7 5:M7 5:m6", "maj7 and a minor iv6."), ex("OLD STREET", "0:M 4:m 9:m 5:M", "I iii vi IV."),
        ex("YEARBOOK", "5:M7 4:m7 9:m7 0:M7", "Soft 7ths."), ex("HOME VIDEO", "0:M7 7:6 9:m7 4:m7", "Gentle steps."), ex("LETTERS", "9:m7 2:m7 7:7 0:M7", "vi ii V I."),
        ex("BACK THEN", "0:M7 11:m7b5 4:7 9:m", "The minor-key turn inside a major key."), ex("SUMMER GONE", "5:M7 7:M 4:m7 9:m", "IV V iii vi."), ex("FADED", "0:add9 5:m6 0:add9 5:m6", "add9 and the minor iv6."), ex("PORCH", "5:M7 0:M7 5:M7 7:sus4", "Ends hanging.")] },
    { k: "defiant", n: "DEFIANT", b: 3, feel: "Swagger, cocky, 'try me'", why: "Cowen 2020's 'indignant/defiant' is not RAGE (out of control) or VILLAIN (evil): it's attitude. Fits trap and drill.",
      what: "Minor pentatonic and Dorian, dominant 7#9 bite, power fifths, short hits with stops.",
      cues: { mode: "Dorian or minor pentatonic", chords: "m7, IV7, 7#9, fifths", notes: "b7 and the blues b5", voicing: "low-mid, punchy", motion: "short hits with gaps", avoid: "maj7, sweet colours" },
      v: { bass: 36, lo: 48, hi: 64, shape: "close", n: 3 }, lean: { pace: 1, rhythm: 2, voices: 3, range: 0 }, bpm: 140, rhy: "stabs", scales: ["dorian", "minor"],
      judge: { mean: [0, 62], sig: ["dom7", "power", "minorHome"], forbid: ["maj7"] },
      ex: [ex("TRY ME", "0:m7 0:m7 5:7 0:m7", "i7 to the Dorian IV7."), ex("BITE", "0:7#9 0:7#9 5:7 0:7#9", "The 7#9: major and minor at once."), ex("STRUT", "0:m 10:M 5:M 0:m", "Dorian swagger."),
        ex("STOP", "0:5 3:5 5:5 3:5", "Pentatonic fifths."), ex("CROWN ON", "0:m7 3:M 10:M 5:M", "Ends on the major IV."), ex("WALK IN", "0:m 0:m 3:M 5:M", "Climbing the pentatonic."),
        ex("NO", "0:m7 8:M 10:M 0:m7", "bVI bVII back to i7."), ex("GANG", "0:5 10:5 3:5 5:5", "Bare fifths."), ex("ROCK BOSS", "0:7 3:M 5:M 0:7", "Blues-rock attitude."), ex("COLD", "0:m 5:m 10:M 3:M", "Steady and sure.")] },
    { k: "tender", n: "TENDER", b: 7, feel: "Love, care, gentle closeness", why: "Lahdelma 2016: tenderness is a separate rating, highest for m7 and maj7 chords. DREAMY floats away; TENDER stays close.",
      what: "maj7 and m7 chords, soft, mid register, close voicings, small steps.",
      cues: { mode: "Major", chords: "maj7, m7, 6, sus to major", notes: "7ths, soft 9ths", voicing: "close, mid", motion: "slow, legato", avoid: "dim, aug, power chords" },
      v: { bass: 43, lo: 55, hi: 72, shape: "close", n: 4 }, lean: { pace: 1, rhythm: 0, voices: 4, range: 1 }, bpm: 72, rhy: "hold", scales: ["major"],
      judge: { mean: [50, 80], sig: ["maj7", "m7"], forbid: ["dim", "aug", "power"] },
      ex: [ex("HOLD ME", "0:M7 9:m7 2:m7 7:7sus4", "The gentle turnaround."), ex("SOFT", "5:M7 0:M7 5:M7 0:M7", "IV and I maj7."), ex("CLOSE", "0:add9 4:m7 5:M7 7:sus4", "Step by step."),
        ex("SLOW DANCE", "9:m7 2:m7 5:M7 0:M7", "vi ii IV I."), ex("MORNING", "0:M7 5:M7 9:m7 7:6", "No tension at all."), ex("PROMISE", "2:m7 7:7 0:M7 0:6", "ii V I, soft."),
        ex("WARM HANDS", "0:M 4:m7 9:m7 5:M7", "Small steps."), ex("LULLABY", "5:M9 7:6 4:m7 9:m7", "Wide and soft."), ex("SMILE", "0:6 2:m7 4:m7 5:M7", "Climbing gently."), ex("FOREVER", "9:m9 2:m7 7:7sus4 0:M9", "Lands soft.")] },
    { k: "mysterious", n: "MYSTERIOUS", b: 4, feel: "The unknown, magic, wonder with a shadow", why: "Not scary (UNEASE) and not big (CINEMATIC): curiosity. Film scholars call minor-to-major-IV the 'fantasy fifth' (Patrick 2023) for wonder and magic.",
      what: "Minor with Dorian's major IV, minor chords a minor 3rd apart, add9 and m6, soft and mid.",
      cues: { mode: "Dorian or melodic minor", chords: "i-IV major, m6, mM7, m7b5", notes: "the major 6th inside minor", voicing: "open, mid", motion: "slow, sparse", avoid: "power chords, plain major" },
      v: { bass: 40, lo: 55, hi: 74, shape: "open", n: 4 }, lean: { pace: 1, rhythm: 4, voices: 4, range: 1 }, bpm: 80, rhy: "broken", scales: ["dorian", "melodic", "minor"],
      judge: { sig: ["fantasy5", "m6", "mediant", "colour", "shine", "dorian6", "sus"], forbid: ["power"] },
      ex: [ex("FANTASY FIFTH", "0:m 5:M 0:m 5:M", "i to a MAJOR IV: magic."), ex("SPELL", "0:madd9 5:add9 0:madd9 5:add9", "Both with 9ths."), ex("DOOR", "0:m 9:m 0:m 9:m", "Minor chords a minor 3rd apart."),
        ex("POTION", "0:m6 0:m6 5:7 5:7", "The m6: the major 6th in a minor chord."), ex("ATTIC", "0:mM7 0:mM7 9:m7b5 9:m7b5", "Melodic minor shades."), ex("FOREST", "0:m 2:m 3:M 2:m", "Dorian steps."),
        ex("MAP", "0:madd9 7:m 5:M 0:madd9", "Through the major IV."), ex("FOG", "0:sus2 3:sus2 0:sus2 10:sus2", "No 3rds: unknown."), ex("CANDLELIT", "0:m9 9:m7b5 5:9 0:m9", "Dorian colours."), ex("RIDDLE", "0:m 5:M 3:M 2:m", "Never quite home.")] },
  ];


  // CORES (Eman, 9 Nov 2026 21:25): moods built from songs Eman picked, not from the studies. src = where each example
  // comes from. DREAMCORE = the 11 Oneheart + my head is empty songs in SONG MIDI (chords read from their MIDI);
  // GRIEF = one song Eman sent ("nothing after 1"), read from the audio: Cmaj7 2 bars, D6 2 bars, Em(add9) 2 bars,
  // Em7 2 bars at 78 BPM, root + 5th + octave low with the 3rd and 7th close above, one note (B, the home 5th) ringing
  // through every chord, a very dark held pad with no drums. sound = which synth the GENRE SCIENCE tab plays it with,
  // tonic = the key the tab plays it in (the song's own), span = beats per chord there, mel = a top line [beat, len, semis].
  const CORES = [
    { k: "dreamcore", n: "DREAMCORE", b: 5, core: true, feel: "A night dream: sad and floating at once, half remembered",
      src: "Your 11 songs in SONG MIDI: Oneheart (Apathy, Dreamland, Dreams Come True, Next to You, Snowfall) and my head is empty (I Don't Care If It Hurts, real life sucks, I Was Only Temporary, panic attack(s), Perfect Girl, i want to drink your blood).",
      what: "A short loop of 2 to 4 plain chords that can't decide between major and minor: the home chord flips minor to major, minor keys borrow a MAJOR IV (Dorian), major keys borrow bIII or bVI. Clean notes ring high above (maj7, #11), slow, picked one note at a time.",
      cues: { mode: "Minor with Dorian's major IV, or major borrowing minor's bIII and bVI: both at once", chords: "i-I flip, i-IV major, bIII-IV-I, I-bVI, iv-v-i with a minor v", notes: "the 3rd changing on the same root; maj7 and #11 rung on top", voicing: "open: root low, single clean notes high, a gap in between", motion: "slow (75-95 BPM), 2-4 chords looping, picked (broken)", avoid: "diminished, power chords, dominant 7th pulls, busy changes" },
      v: { bass: 40, lo: 55, hi: 79, shape: "open", n: 4 }, lean: { pace: 1, rhythm: 4, voices: 4, range: 1 }, bpm: 85, rhy: "broken", sound: "clean",
      scales: ["minor", "mixolydian", "harmonic"],
      judge: { mean: [48, 76], sig: ["flip", "fantasy5", "mediant", "maj7", "colour", "bVIbVII", "picardy", "heroMajor", "lead"], forbid: ["dim", "power", "cluster", "dom7"] },
      tools: [0, 2, 0, 0, 2, 0, 0],
      ex: [ex("APATHY", "3:M 5:M 0:M 7:M", "Oneheart - Apathy: bIII IV I V. Minor's bIII and IV climb into a MAJOR home."),
        ex("DREAMLAND", "3:M7#11 5:M 2:m 5:m", "Oneheart - Dreamland: the #11 rings over bIII, then IV turns from major to minor."),
        ex("DREAMS COME TRUE", "5:m9 7:m7 0:madd9 7:m7", "Oneheart - Dreams Come True: iv v i v, the soft minor v (no pull home)."),
        ex("NEXT TO YOU", "0:madd9 8:M7 10:M 3:M", "Oneheart - Next to You: i bVI bVII bIII, the night-drive loop."),
        ex("SNOWFALL", "0:M 5:M7 9:m 7:m", "Oneheart - Snowfall: I IVmaj7 vi and a minor v that floats instead of landing."),
        ex("I DON'T CARE IF IT HURTS", "0:M 8:M 0:M 8:M", "my head is empty: major home and bVI, two chords a major 3rd apart."),
        ex("REAL LIFE SUCKS", "8:M 0:m 0:M 0:m", "my head is empty: the home chord flips minor, major, minor."),
        ex("I WAS ONLY TEMPORARY", "0:m 1:M 0:M 10:m", "my head is empty: up a half step, then home turns major."),
        ex("PANIC ATTACK(S)", "5:M 0:m 3:M 8:M", "my head is empty: starts on the Dorian major IV."),
        ex("PERFECT GIRL", "0:m 7:M 0:m 7:M", "my head is empty: i and the major V rocking, picked on acoustic guitar.")] },
    { k: "grief", n: "GRIEF", b: 3, core: true, feel: "Loss that doesn't leave: the hope rises, then it's still gone",
      src: "One song you sent: \"nothing after 1\". Every example keeps its sound (dark held pad, root + 5th + octave low) so you can hear only the chords change.",
      what: "Rising from below into a long held minor home: bVI(maj7) to bVII(6) to i, two bars each, and home held twice as long. The maj7 on bVI is the warm memory; one note (the home 5th) rings through every chord, so nothing ever really moves on.",
      cues: { mode: "Natural minor (Aeolian), nothing borrowed", chords: "bVImaj7 bVII6 i(add9) i7, also bIIImaj7, iv9, minor v", notes: "the home 5th held through every chord; maj7 on bVI; the 9th on the minor home", voicing: "root + 5th + octave low (C2 G2 C3), 3rd and 7th close above, a quiet top line", motion: "very slow: 2 bars per chord, home held longest, held pad, no drums, 78 BPM", avoid: "dominant 7ths, diminished, power chords, anything bright or busy" },
      v: { bass: 40, lo: 50, hi: 72, shape: "rootoct", n: 6 }, lean: { pace: 1, rhythm: 0, voices: 5, range: 0 }, bpm: 78, rhy: "hold", sound: "pad", tonic: 4, span: 8,
      scales: ["minor"],
      judge: { need: ["minorHome", "ring"], mean: [44, 68], long: 2, sig: ["maj7"], forbid: ["dim", "aug", "power", "dom7", "b2", "lead", "majorHome", "cluster"] },
      tools: [0, 1, 0, 0, 0, 0, 0],
      ex: [ex("NOTHING AFTER", "8:M7 10:6 0:madd9 0:m7", "The song itself: bVImaj7, bVII6, then home (add9, then m7) held 4 bars. With its top line."),
        ex("THE ROOM STAYS", "3:M7 10:6 0:madd9 0:m7", "bIIImaj7 instead of bVI: a little brighter, the same fall home."),
        ex("WHAT'S LEFT", "5:m9 8:M7 10:6 0:madd9", "Starts lower on iv9, then the same rise."),
        ex("TOO LONG", "8:M7 8:M7 10:6 0:madd9", "Stays in the memory (bVI) twice as long."),
        ex("STILL HERE", "8:M7 3:M7 10:6 0:madd9", "bVI to bIII: two warm chords before the climb."),
        ex("ALMOST", "8:M7 10:6 7:m7 0:madd9", "A minor v before home: the step that never pulls."),
        ex("WAKING UP", "0:madd9 8:M7 10:6 0:m7", "Starts at home, leaves, comes back."),
        ex("EMPTY CHAIR", "8:M7 10:6 0:madd9 5:m9", "Ends on iv9: it never gets back home."),
        ex("AFTER", "8:M7 7:m7 8:M7 0:madd9", "Rocking between bVI and the minor v."),
        ex("GOODBYE", "8:M7 10:6 3:M7 0:madd9", "Climbs past home to bIII, then falls back.")],
      mel: { 0: [[0, 4, 7], [0, 4, 3], [4, 4, 5], [8, 4, 2], [12, 4, 3], [16, 6, 2], [22, 2, -2], [24, 2, 3], [26, 6, 0]] } },
    { k: "liminal", n: "LIMINAL", b: 3, core: true, feel: "An empty place that feels familiar but wrong: still, dark, a little off",
      src: "Your LIMINAL playlist: 27 Kane Parsons tracks (the Backrooms soundtrack) plus Cafe Bossa - Release, read from the audio on your Mac. The Revive Music mixes in it were pop hit compilations, so they were left out.",
      what: "The home chord barely moves: a bare fifth hums, then a b9 slides in and rubs against it (minor with a b9), or a maj7 glows on top. Chords move by half steps (bII, the root dropping to the 7th) or not at all; sus and augmented chords leave things unresolved. Very dark, no drums.",
      cues: { mode: "Phrygian-dark minor, or a still major that never resolves", chords: "i5 to i(b9), Imaj7 to bIImaj7, i to i(maj7), sus4 and aug on the same root", notes: "the b9 rubbing on the home chord; the maj7 left hanging; half-step neighbours", voicing: "low and dark: root + 5th low, a few close notes above, nothing bright", motion: "very slow, held, 1 chord a bar or less, no drums (~90 BPM felt as still)", avoid: "dominant 7ths, the vi-IV lift, bright pop moves, busy changes" },
      v: { bass: 36, lo: 48, hi: 67, shape: "drone", n: 4 }, lean: { pace: 1, rhythm: 0, voices: 4, range: 0 }, bpm: 90, rhy: "hold", sound: "pad", span: 8,
      scales: ["phrygian", "minor", "major"],
      judge: { mean: [40, 62], long: 2, sig: ["b2", "cluster", "maj7", "aug", "chromatic", "pedal"], forbid: ["dom7", "axis", "lift"] },
      tools: [0, 1, 0, 0, 0, 0, 0],
      ex: [ex("LOCAL NETWORK", "0:5 0:mb9 0:5 0:mb9", "Kane Parsons: a bare fifth, then the b9 creeps in and out."),
        ex("FURNITURE LAMENT", "0:mb9 0:5 0:mb9 8:M7", "The rub at home, then a warm bVImaj7 that doesn't help."),
        ex("BASEMENT LAND", "0:mb9 0:mM7 11:5 0:mM7", "The root drops a half step to the 7th and back: a room that tilts."),
        ex("4-PCH", "0:M7 7:M7 0:M7 8:M7", "Major 7ths that drift, never landing anywhere."),
        ex("YOU KNOW ME", "0:dim 0:mb9 0:dim 0:mM7", "Diminished and the b9 on one root: wrong, but still."),
        ex("COLD FLOOR", "4:5 4:aug 0:M7 0:add9", "A fifth turns augmented, then falls into a soft major 7th."),
        ex("OTTOMAN EMPIRE", "0:M7 1:M7 0:M7 1:M7", "Imaj7 to bIImaj7: a half step up and back, forever."),
        ex("THE UNTRAINED MIND", "0:5 0:sus4 0:5 0:m", "Almost nothing moves: fifth, sus4, fifth, then the minor 3rd appears."),
        ex("CAPITOL & MCKEE", "1:M 7:sus4 7:5 0:add9", "bII, a sus4 that never resolves, then a plain home."),
        ex("OLD HOME NOT YET BUILT", "9:m7 0:M7 0:5 0:M7", "vi7 to Imaj7, then the 3rd drops out and comes back.")] },
  ];

  const ALL = MOODS.concat(EXTRA, CORES);
  const byKey = Object.fromEntries(ALL.map((m) => [m.k, m]));
  // words that name a mood (the prompt, the chat): first the mood keys, then common synonyms
  const WORDS = { evil: "villain", menacing: "villain", sinister: "villain", ond: "villain", angry: "rage", aggressive: "rage", metal: "rage", heavy: "dark", horror: "demonic", satanic: "demonic", eerie: "unease", creepy: "unease", scary: "unease", tense: "suspense", sadness: "sad", ledsen: "sad", alone: "lonely", sorg: "grief", mourning: "grief", loss: "grief", dreamcore: "dreamcore", oneheart: "dreamcore", liminal: "liminal", backrooms: "liminal", kane: "liminal", soundtrack: "liminal", epic: "cinematic", holy: "godlike", church: "godlike", trippy: "psychedelic", calm: "meditative", chill: "meditative", dream: "dreamy", hero: "heroic", triumphant: "heroic", happy: "playful", bouncy: "playful", fun: "playful", cheeky: "playful", euphoria: "euphoric", rave: "euphoric", sensual: "sexy", rnb: "sexy", bittersweet: "nostalgic", swagger: "defiant", cocky: "defiant", love: "tender", magic: "mysterious", mystery: "mysterious" };
  const moodsIn = (text) => { const out = []; for (const w of String(text || "").toLowerCase().split(/[^a-z\u00e5\u00e4\u00f6]+/)) { const k = byKey[w] ? w : WORDS[w]; if (k && !out.includes(k)) out.push(k); } return out; };

  // ---- the chords ----------------------------------------------------------------------------------
  function seeded(seed) { let s = ((seed * 2654435761) >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  // which scale a mood rolls in: the picked scale if the mood lives there, else the mood's own (same root note)
  const scaleFor = (m, scale) => (m.scales.includes(scale) || window.KT2_MOOD_KEY_OLD || STRICT() ? scale : m.scales[0]);
  // P: { mood, tonic, scale, bars, pace (0..3), inKey, seed, avoid (loop keys), toks (chords to keep: [{beat,len,tok}]) }
  function plan(P) {
    const m = byKey[P.mood]; if (!m) return null;
    const rng = P.seed != null ? seeded(P.seed + 17) : Math.random;
    const strict = STRICT() && !!SCALES[P.scale], scale = P.inKey || strict ? scaleFor(m, P.scale) : P.scale;
    let pool = m.ex.filter((e) => !(P.inKey || strict) || fits(e.c, scale));
    // the picked key wins (strict): too few of the mood's examples live in it, so the rest are bent into it
    if (strict && pool.length < 3) pool = pool.concat(m.ex.filter((e) => !fits(e.c, scale)).map((e) => ({ ...e, c: e.c.map((t) => bend(t, scale)), bent: true })));
    if (!pool.length) pool = m.ex.filter((e) => fits(e.c, m.scales[0]));
    const palette = [...new Set(pool.flatMap((e) => e.c))];
    const avoid = new Set(P.avoid || []);
    let prog = null, name = "";
    for (let t = 0; t < 12 && !prog; t++) {
      const e = pool[Math.floor(rng() * pool.length)];
      let c = e.c.slice();
      // a little variety, still the mood's own chords: swap one later chord for another one the mood uses
      if (t > 0 || rng() < 0.3) { const i = 1 + Math.floor(rng() * (c.length - 1)), alt = palette[Math.floor(rng() * palette.length)]; if (alt && alt !== c[i - 1]) c[i] = alt; }
      if (!avoid.has(c.join(" ")) || t === 11) { prog = c; name = e.n; }
    }
    const bars = Math.max(1, P.bars || 4);
    let segLen = [8, 4, 2, 1][Math.max(0, Math.min(3, P.pace == null ? 1 : P.pace))];
    const nseg = Math.max(1, Math.ceil(bars * 4 / segLen));
    const segs = [];
    // song sections (DICE LIVE on a long pattern hands in toks with .sec): every section its own example of the mood
    const secs = P.toks && P.toks.some((x) => x.sec) ? [...new Set(P.toks.map((x) => x.sec))] : null, secProg = {};
    if (secs) { const start = Math.max(0, pool.findIndex((e) => e.n === name)); secs.forEach((sc, i) => { secProg[sc] = i === 0 ? prog : pool[(start + i) % pool.length].c; }); }
    const tokAt = (b) => P.toks.find((x) => b >= x.beat - 1e-6 && b < x.beat + x.len - 1e-6);
    for (let i = 0; i < nseg; i++) {
      let t = prog[i % prog.length], sec = null;
      if (secs) { const k = tokAt(i * segLen); if (k && k.sec) { sec = k.sec; let s0 = k.beat; for (const x of P.toks) if (x.sec === sec && x.beat <= k.beat && x.beat < s0) s0 = x.beat; while (P.toks.some((x) => x.sec === sec && Math.abs(x.beat + x.len - s0) < 1e-6)) s0 = P.toks.find((x) => x.sec === sec && Math.abs(x.beat + x.len - s0) < 1e-6).beat; const pr = secProg[sec]; t = pr[Math.floor((i * segLen - s0) / segLen + 1e-6) % pr.length]; } }
      else if (P.toks && P.toks.length) { const k = P.toks.find((x) => Math.abs(x.beat - i * segLen) < 1e-6 && x.mood === m.k); if (k) t = k.baseTok; }
      if (strict) t = bend(t, scale);   // kept chords from an earlier roll (DICE LIVE) too
      const p = parse(t), root = pc(P.tonic + p.r), ivs = Q[p.q];
      segs.push({ beat: i * segLen, len: segLen, tok: t, baseTok: t, root, pcs: ivs.map((x) => pc(root + x)), ivs, name: nameOf(P.tonic, t), out: !fits([t], scale), mood: m.k, ...(sec ? { sec } : {}) });
    }
    return { segs, loopKey: prog.join(" "), used: ["mood:" + m.k], heard: [m.n], rest: "", mood: m.k, exName: name, scale,
      stats: { ext: 0.2, out: 0, colour: 0.3, tension: 0.5, random: 0.3, pop: 0.5, minor: !/major|lydian|mixolydian/.test(scale), mel: null } };
  }

  // ---- the voicing ---------------------------------------------------------------------------------
  // one chord as MIDI notes in the mood's way. o: { n (notes, null = mood's), shift (semitones, from a pinned Pitch card) }
  function voice(root, ivs, v, o) {
    o = o || {}; const n = Math.max(1, Math.min(7, o.n || v.n)), sh = 0, steps = Math.round((o.shift || 0) / 7);   // Pitch: re-voice by inversions (below), not a straight octave move
    // CHORD SIZE bigger than the chord: add its natural colours (minor: 7th then 9th, major: 9th then 6th) before doubling
    { const P = new Set(ivs.map(pc)); if (n > P.size + (v.shape === "rootoct" ? 2 : 1) && P.size >= 3) { const add = P.has(3) && P.has(7) ? [10, 14] : P.has(4) && P.has(7) ? [14, 9] : P.has(3) && P.has(6) ? [9] : []; ivs = ivs.slice(); for (const x of add) if (ivs.length + 1 < n && !P.has(pc(x))) { ivs.push(x); P.add(pc(x)); } } }
    const near = (p, target) => { let x = target + pc(p - target); if (x - target > 6) x -= 12; return x; };
    const bass = near(root, v.bass + sh), lo = v.lo + sh;
    // the chord's other notes (pitch classes); with too few notes the 5th goes first, the colour (7th, 9th, 6th) stays
    const rank = (x) => { const i = pc(x); return i === 3 || i === 4 || i === 2 && x < 12 || i === 5 && x < 12 ? 0 : i === 6 || i === 8 ? 1 : i === 10 || i === 11 || i === 9 ? 2 : i === 7 ? 4 : 3; };
    const keepN = Math.max(1, n - (v.shape === "octstab" ? 2 : v.shape === "drone" || v.shape === "wide" || v.shape === "power3" ? 2 : 1));
    let up = ivs.filter((x) => pc(x) !== 0);
    if (up.length > keepN && v.shape !== "power") up = up.slice().sort((a, b) => rank(a) - rank(b)).slice(0, keepN).sort((a, b) => a - b);
    up = up.map((x) => pc(root + x));
    const stackAbove = (start, pcs) => { const out = []; let cur = start; for (const q of pcs) { let p = cur + pc(q - cur); if (p <= cur) p += 12; out.push(p); cur = p; } return out; };
    const hasFifth = ivs.some((x) => pc(x) === 7), hasB5 = ivs.some((x) => pc(x) === 6);
    let ns;
    switch (v.shape) {
      case "power": ns = [bass, bass + (hasFifth || !hasB5 ? 7 : 6), bass + 12, bass + 19, bass - 12].slice(0, n); if (n >= 5 && bass - 12 < 26) ns = ns.slice(0, 4); break;
      case "drone": { const top = stackAbove(Math.max(lo, bass + 12) - 1, up.length ? up : [pc(root + 7)]); ns = [bass, bass + 7, ...top].slice(0, Math.max(n, 3)); break; }
      case "octstab": { const top = stackAbove(bass + 12, up); ns = [bass, bass + 12, ...top]; while (ns.length > n && ns.length > 2) ns.splice(ns.length - 1, 1); break; }
      case "power3": { const top = stackAbove(Math.max(lo, bass + 12) - 1, [root].concat(up).map(pc)); ns = [bass, bass + 7, ...top].slice(0, n); break; }
      case "thin": { const top = stackAbove(lo - 1, up.length ? up : [root]); ns = [bass, ...top].slice(0, n); break; }
      case "wide": { const top = stackAbove(Math.max(lo, bass + 19) - 1, up.concat([root])); ns = [bass, bass + 7, ...top]; let t = top[top.length - 1]; while (ns.length < n) { t += 12; if (t > v.hi + sh + 7) break; ns.push(t - (ns.length % 2 ? 0 : 0)); } ns = ns.slice(0, Math.max(n, 4)); break; }
      case "open": { const top = stackAbove(Math.max(lo, bass + 7) - 1, up); const out = [bass]; top.forEach((p, i) => out.push(i === 1 && top.length >= 3 ? p + 12 : p)); ns = out.slice(0, n); break; }
      case "cluster": { const top = stackAbove(Math.max(lo, bass + 7) - 1, up); ns = [bass, ...top].slice(0, n); if (!ivs.some((x) => pc(x) === 1 || pc(x) === 2 || pc(x) === 11) && ns.length >= 3) ns.push(ns[ns.length - 1] + 1); break; }
      case "rootoct": { const top = stackAbove(Math.max(lo, bass + 12), up); ns = [bass, bass + 7, bass + 12, ...top]; while (ns.length > Math.max(n, 3)) { const d = ns.findIndex((p, x) => x >= 3 && pc(p - root) === 7); ns.splice(d >= 0 ? d : ns.length - 1, 1); } break; }   // GRIEF: C2 G2 C3 then E3 G3 B3
      default: { const top = stackAbove(Math.max(lo, bass + 7) - 1, up); ns = [bass, ...top].slice(0, n); }
    }
    // too few notes: double the root and 5th upward
    let k = 0; while (ns.length < Math.min(n, 3) && k < 4) { ns.push(ns[ns.length - 1] + (pc(ns[ns.length - 1] - root) === 7 ? 5 : 7)); k++; }   // root and 5th only
    ns = [...new Set(ns)].sort((a, b) => a - b);
    if (ns.length > n) ns = [ns[0]].concat(ns.slice(1).slice(-(n - 1))).slice(0, n);   // CHORD SIZE 2: the bass and the top note
    // CHORD SIZE asks for more notes than the chord has: double its notes an octave up, top first
    for (let i = 1; ns.length < n && i < 12; i++) { const q = ns[ns.length - i] + 12; if (q <= 100 && !ns.includes(q)) ns.push(q); ns.sort((a, b) => a - b); }
    // Pitch away from the mood's own height: each step up moves the lowest upper note an octave up (the next
    // inversion), each step down moves the top note an octave down and drops the bass an octave once
    for (let k = 0; k < Math.abs(steps) && ns.length > 1; k++) {
      if (steps > 0) { const x = ns.splice(1, 1)[0]; if (ns.length === 1) ns.push(x + 12); else ns.push(x + 12 * Math.ceil((ns[ns.length - 1] - x + 1) / 12)); }
      else { for (let t = 0; t < 2 && ns.length > 2; t++) { const x = ns.pop(), y = x - 12; if (y > ns[0] && !ns.includes(y)) ns.unshift(y); else if (!ns.includes(x - 24) && x - 24 > ns[0]) ns.unshift(x - 24); else ns.push(x); ns.sort((a, b) => a - b); } }
      ns = [...new Set(ns)].sort((a, b) => a - b);
    }
    return ns;
  }

  // re-voice rolled notes chord by chord: a full hit gets the whole mood voicing, a single note (broken, arp) keeps its
  // place by rank. ctx: { segs, mood (key or object), n (pinned notes), shift (pinned Pitch), blend (second mood key) }
  function revoice(notes, ctx) {
    const m = typeof ctx.mood === "string" ? byKey[ctx.mood] : ctx.mood; if (!m || !notes || !notes.length || !ctx.segs) return notes;
    const b = ctx.blend && byKey[ctx.blend];
    const v = m.v;
    // a blend keeps the first mood's shape but moves it (by octaves) into the second mood's register
    const toB = (V, V0) => { if (!b || !V.length) return V; const mean = V0.reduce((x, y) => x + y, 0) / V0.length, target = (b.v.lo + b.v.hi) / 2 - 3; const o = Math.round((target - mean) / 12) * 12; return V.map((x) => x + o); };   // the octave move is found without the Pitch shift, so Pitch still moves it
    const segAt = (t) => { let s = ctx.segs[0]; for (const x of ctx.segs) if (x.beat <= t + 1e-6) s = x; return s; };
    const out = [], bySeg = new Map();
    for (const n of notes) { if (n.locked) { out.push(n); continue; } const s = segAt(n.start); if (!bySeg.has(s)) bySeg.set(s, []); bySeg.get(s).push(n); }
    for (const [s, ns] of bySeg) {
      const V = toB(voice(s.root, s.ivs, v, { n: ctx.n, shift: ctx.shift }), voice(s.root, s.ivs, v, { n: ctx.n }));
      const distinct = [...new Set(ns.map((n) => n.pitch))].sort((a, b) => a - b), D = distinct.length;
      const groups = new Map(); for (const n of ns) { const k = n.start.toFixed(4); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
      for (const g of groups.values()) {
        if (g.length >= Math.min(3, D) && g.length > 1) { const L = Math.max(...g.map((n) => n.length)), vel = Math.max(...g.map((n) => n.velocity || 100)); for (const p of V) out.push({ ...g[0], pitch: p, length: L, velocity: vel }); }
        else for (const n of g) { const r = D > 1 ? distinct.indexOf(n.pitch) / (D - 1) : 0; out.push({ ...n, pitch: V[Math.round(r * (V.length - 1))] }); }
      }
    }
    const seen = new Set(); return out.filter((n) => { const k = n.pitch + "@" + n.start.toFixed(4); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // ---- the checker ---------------------------------------------------------------------------------
  // what a roll actually sounds like, from its notes (not from what it meant to do)
  function measure(notes, tonic) {
    const ns = (notes || []).filter((n) => !n.locked && !n.tl);   // the TOP LINE is not part of the chord
    let m = new Map(); for (const n of ns) { const k = n.start.toFixed(3); if (!m.has(k)) m.set(k, []); m.get(k).push(n); }
    // broken chords and arps (mostly one note at a time): hear them a bar at a time
    if (m.size > 2 && [...m.values()].filter((g) => g.length === 1).length / m.size > 0.6) { const w = new Map(); for (const n of ns) { const k = (Math.floor(n.start / 4 + 1e-6) * 4).toFixed(3); if (!w.has(k)) w.set(k, []); w.get(k).push({ ...n, start: +k }); } m = w; }
    const hits = [...m.values()].sort((a, b) => a[0].start - b[0].start).map((g) => { const ps = g.map((n) => n.pitch).sort((a, b) => a - b), bass = ps[0]; const rel = new Set(ps.map((p) => pc(p - bass))); const T = new Set(ps.map((p) => pc(p - tonic))); return { ps, bass: pc(bass - tonic), rel, T, len: Math.max(...g.map((n) => n.length)) }; });
    const chords = hits.filter((h) => h.ps.length >= 2);
    // a rub (MOOD TOOLS) can put both 3rds in one chord: the one played lower is the chord's own
    const third = (h) => { const p3 = h.ps.find((p) => pc(p - h.ps[0]) === 3), p4 = h.ps.find((p) => pc(p - h.ps[0]) === 4); if (p3 != null && p4 != null) return p3 < p4 ? "m" : "M"; return h.rel.has(4) && !(h.rel.has(8) && !h.rel.has(7)) ? "M" : h.rel.has(3) && !(h.rel.has(6) && !h.rel.has(7)) ? "m" : null; };
    const withThird = chords.filter((h) => third(h)), minorShare = withThird.length ? withThird.filter((h) => third(h) === "m").length / withThird.length : null;
    const isPower = (h) => [...h.rel].every((x) => x === 0 || x === 7);
    const mean = ns.length ? ns.reduce((a, n) => a + n.pitch, 0) / ns.length : 0;
    const keys = chords.map((h) => [...h.T].sort().join(","));
    const has = (h, ...xs) => xs.every((x) => h.rel.has(x));
    const homeHits = chords.filter((h) => h.bass === 0), home = homeHits.length ? third(homeHits[0]) : null;
    const seq = []; for (const h of chords) { const k = h.bass + ":" + third(h); if (!seq.length || seq[seq.length - 1].k !== k) seq.push({ k, h }); }
    const pitchesAll = ns.map((n) => n.pitch);
    const f = {
      b2: chords.some((h) => h.T.has(1)),
      b6: chords.some((h) => h.T.has(8)) && minorShare != null && minorShare >= 0.4,
      tritone: chords.some((h) => [...h.rel].some((x) => h.rel.has(pc(x + 6)))) || seq.some((s, i) => i && pc(s.h.bass - seq[i - 1].h.bass) === 6),
      lead: chords.some((h) => h.T.has(11)) && chords.some((h) => h.T.has(3)),
      m8m: seq.some((s, i) => i && third(s.h) === "m" && third(seq[i - 1].h) === "m" && [4, 8].includes(pc(s.h.bass - seq[i - 1].h.bass))),
      dim: chords.some((h) => [...h.rel].some((x) => h.rel.has(pc(x + 3)) && h.rel.has(pc(x + 6)) && !h.rel.has(pc(x + 7)) && !h.rel.has(pc(x - 4)))),   // not the 3-5-7 of a dominant 7th
      aug: chords.some((h) => [...h.rel].some((x) => h.rel.has(pc(x + 4)) && h.rel.has(pc(x + 8)))),
      chromatic: seq.some((s, i) => i && [1, 11].includes(pc(s.h.bass - seq[i - 1].h.bass))),
      cluster: chords.some((h) => h.ps.some((p, i) => i && p - h.ps[i - 1] === 1)),
      maj7: chords.some((h) => has(h, 4, 11)),
      m7: chords.some((h) => has(h, 3, 10)),
      colour: chords.some((h) => (h.rel.has(4) || h.rel.has(3)) && (h.rel.has(2) || h.rel.has(9) && !h.rel.has(3))),
      ext: chords.some((h) => h.rel.has(2) && h.rel.has(10)),
      sus: chords.some((h) => (h.rel.has(2) || h.rel.has(5)) && h.rel.has(7) && !h.rel.has(3) && !h.rel.has(4)),
      power: chords.length > 0 && chords.filter(isPower).length / chords.length >= 0.5,
      dom7: chords.some((h) => has(h, 4, 10)),
      majorHome: home === "M", minorHome: home === "m",
      pedal: hits.length > 1 && hits.filter((h) => h.bass === hits[0].bass).length / hits.length >= 0.75,
      lineCliche: chords.some((h) => h.T.has(3) && h.T.has(11)) && chords.some((h) => h.T.has(3) && (h.T.has(10) || h.T.has(9))),
      shine: chords.some((h) => h.rel.has(3) && (h.rel.has(11) || h.rel.has(2))) || chords.some((h) => has(h, 4, 11)),
      bVIbVII: chords.some((h) => h.bass === 8 && third(h) === "M") && chords.some((h) => h.bass === 10 && third(h) !== "m"),
      heroMajor: home !== "m" && chords.some((h) => [3, 8, 10].includes(h.bass) && third(h) !== "m"),
      mixo: home === "M" && chords.some((h) => h.bass === 10 && third(h) === "M") || chords.some((h) => h.bass === 0 && h.rel.has(4) && h.rel.has(10)) && home === "M",
      short: hits.length > 0 && hits.reduce((a, h) => a + h.len, 0) / hits.length <= 1.5,
      axis: chords.some((h) => h.bass === 9 && third(h) === "m") && chords.some((h) => h.bass === 5 && third(h) === "M") && home !== "m",
      iii: home === "M" && chords.some((h) => h.bass === 4 && third(h) === "m"),
      dorian6: home === "m" && chords.some((h) => h.T.has(9) && (h.bass === 2 || h.bass === 5 || h.bass === 0)),
      picardy: home === "m" && chords.some((h) => h.bass === 0 && third(h) === "M"),
      fantasy5: chords.some((h) => h.bass === 0 && third(h) === "m") && chords.some((h) => h.bass === 5 && third(h) === "M"),
      plagalDom: chords.some((h) => h.bass === 5 && third(h) === "M") && chords.some((h) => h.bass === 7 && third(h) === "M"),
      lydian: chords.some((h) => h.T.has(6)) && home === "M",
      mediant: seq.some((s, i) => i && third(s.h) != null && [3, 4, 8, 9].includes(pc(s.h.bass - seq[i - 1].h.bass)) && third(seq[i - 1].h) != null && !(SCALES.major.includes(s.h.bass) && SCALES.major.includes(seq[i - 1].h.bass) && home === "M") && !(SCALES.minor.includes(s.h.bass) && SCALES.minor.includes(seq[i - 1].h.bass) && home === "m")),
      parallel: seq.some((s, i) => i && third(s.h) && third(s.h) === third(seq[i - 1].h) && [2, 10].includes(pc(s.h.bass - seq[i - 1].h.bass)) && (home === "M" ? [2, 6, 8].includes(s.h.bass) || [2, 6, 8].includes(seq[i - 1].h.bass) : third(s.h) === "m" && [...s.h.T, ...seq[i - 1].h.T].some((x) => !SCALES.minor.includes(x)))),
      lift: seq.some((s, i) => i && seq[i - 1].h.bass === 5 && s.h.bass === 7) || f_susToMajor(chords),
      ivMinor: chords.some((h) => h.bass === 5 && third(h) === "m") && home === "M",
      m6: chords.some((h) => has(h, 3, 9)),
      ring: chords.length > 1 && new Set(keys).size > 1 && [...Array(12).keys()].some((p) => chords.every((h) => h.T.has(p))),
      flip: chords.some((h) => third(h) && chords.some((g) => g.bass === h.bass && third(g) && third(g) !== third(h))),
    };
    const sizes = chords.map((h) => h.ps.length);
    const gaps = chords.map((h) => (h.ps.length > 1 ? h.ps[1] - h.ps[0] : 0));
    return { f, hits: hits.length, minorShare, majorShare: minorShare == null ? null : 1 - minorShare, powerShare: chords.length ? chords.filter(isPower).length / chords.length : 0, mean, size: sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0, changes: new Set(keys).size, long: hits.length ? hits.reduce((a, h) => a + h.len, 0) / hits.length : 0, span: chords.length ? chords.reduce((a, h) => a + h.ps[h.ps.length - 1] - h.ps[0], 0) / chords.length : 0, gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0 };
  }
  function f_susToMajor(chords) { for (let i = 1; i < chords.length; i++) { const a = chords[i - 1], b = chords[i]; if (a.bass === b.bass && (a.rel.has(5) || a.rel.has(2)) && !a.rel.has(4) && !a.rel.has(3) && b.rel.has(4)) return true; } return false; }


  // ---- TOP LINE (Eman, 9 Nov 22:19: "the yellow ... making the chords more interesting, not a melody") -----------
  // A slow voice riding just above the chords, made only of the chord's own notes and its soft colours (9th, 11th on
  // minor, 6th on major), so it lifts the chords without becoming a lead. It stops at G5 (79) so a real melody on its
  // own sound still fits above it. Styles come from our songs: scanning SONG MIDI (148 songs with real notes, sketches
  // left out) for the part above the chords, 54 have a TOP LINE and 94 a MELODY (busier, ~7 notes a bar, leaps of 4+,
  // ~11 semitones above the chords). The top lines were: MOVING 22 (~3.6 notes a bar, steps of 2), PEDAL 23 (one note
  // repeated), HELD 5 (one long note per chord), ARP 4 (a short chord-tone cycle). By sound: dark/trap songs mostly use a
  // PEDAL or a MOVING line, sad songs a MOVING line, night/ambient songs MOVING or ARP, big house/cinematic songs ARP or
  // PEDAL. Data: /mnt/project-files/killtoy/kt2/topline-scan.json. Moods we have no songs for use their own theory.
  // [style, beats per note, where it came from]
  const TOPS = {
    demonic: ["pedal", 2, "theory: one note that never moves, the b2 leaning on it"], rage: ["pedal", 1, "your dark/trap songs: pedal"],
    villain: ["pedal", 1, "your dark/trap songs: pedal (20 of 44 top lines)"], dark: ["moving", 0, "your dark songs: moving (19 of 44)"],
    unease: ["moving", 0, "theory: a restless step line"], sad: ["moving", 0, "your sad songs: moving (17 of 30)"],
    suspense: ["pedal", 1, "theory: a ticking pedal"], lonely: ["held", 0, "theory: one note left alone"],
    godlike: ["held", 0, "theory: a choir note held over everything"], monotone: ["pedal", 2, "theory: the same note, no change"],
    cinematic: ["held", 0, "theory: long held strings on top"], psychedelic: ["arp", 1, "theory: a turning figure"],
    ambient: ["arp", 2, "your night songs: slow arp"], meditative: ["held", 0, "theory: a held bowl note"],
    dreamy: ["arp", 1, "your night songs: arp"], heroic: ["moving", 0, "theory: a rising fanfare voice"],
    playful: ["moving", 0, "theory: a bouncing voice"], euphoric: ["arp", 0.5, "your house songs: arp (8ths)"],
    sexy: ["moving", 0, "theory: a slow smooth voice"], nostalgic: ["held", 0, "theory: a held memory note"],
    defiant: ["pedal", 1, "your trap songs: pedal"], tender: ["moving", 0, "theory: a gentle step voice"],
    mysterious: ["arp", 1, "theory: a slow question figure"], dreamcore: ["moving", 0, "your Oneheart / my head is empty songs: moving + arp"],
    grief: ["held", 0, "your song nothing after 1: held top notes"],
    liminal: ["moving", 0, "your LIMINAL playlist (Kane Parsons): moving by small steps (21 of 28)"],
  };
  const TOP_CAP = 79;
  // topLine(notes, { mood, tonic, scalePcs, seed, beats, segs }) -> new notes (tl: 1), the chord notes untouched
  function topLine(notes, o) {
    o = o || {};
    const base = (notes || []).filter((n) => !n.tl && !n.muted && !n.locked), out = [];
    if (!base.length) return out;
    const [style, rate0] = TOPS[o.mood] || ["held", 0];
    const rng = o.seed != null ? seeded(o.seed + 991) : Math.random;
    const beats = o.beats || Math.max(...base.map((n) => n.start + n.length));
    // the chords: the plan's segments, else every new set of notes that sounds together
    let segs = (o.segs || []).filter((s) => s.beat < beats - 1e-6).map((s) => ({ beat: s.beat, len: Math.min(s.len, beats - s.beat), root: s.root }));
    if (!segs.length) {
      const starts = [...new Set(base.map((n) => +n.start.toFixed(3)))].sort((a, b) => a - b);
      const sig = (t) => [...new Set(base.filter((n) => n.start <= t + 1e-6 && n.start + n.length > t + 1e-6).map((n) => pc(n.pitch)))].sort().join(",");
      for (const t of starts) { const k = sig(t); if (k && (!segs.length || segs[segs.length - 1].k !== k)) segs.push({ beat: t, k }); }
      segs.forEach((s, i) => { s.len = (i + 1 < segs.length ? segs[i + 1].beat : beats) - s.beat; });
    }
    let prev = null, pedal = null;
    segs.forEach((sg, si) => {
      const inSeg = base.filter((n) => n.start < sg.beat + sg.len - 1e-6 && n.start + n.length > sg.beat + 1e-6);
      if (!inSeg.length || sg.len < 0.5) return;
      const ps = inSeg.map((n) => n.pitch), top = Math.max(...ps), low = Math.min(...ps), root = sg.root != null ? pc(sg.root) : pc(low);
      const vel = Math.max(40, Math.round(inSeg.reduce((a, n) => a + (n.velocity || 100), 0) / inSeg.length * 0.78));
      const pcs = new Set(ps.map(pc)), minor = pcs.has(pc(root + 3)) && !pcs.has(pc(root + 4));
      const soft = [2, minor ? 5 : 9].map((x) => pc(root + x)).filter((x) => !o.scalePcs || o.scalePcs.includes(x));   // scalePcs: the key's notes, as pitch classes
      const ok = new Set([...pcs, ...soft]);
      // just above the chords (our songs: ~5 semitones), never past G5, never a half step from a chord note
      let lo = Math.max(top + 2, 55), hi = Math.min(TOP_CAP, lo + 11);
      if (hi - lo < 4) { hi = TOP_CAP; lo = hi - 9; }
      const cand = []; for (let p = lo; p <= hi; p++) if (ok.has(pc(p)) && !inSeg.some((n) => Math.abs(n.pitch - p) === 1)) cand.push(p);
      if (!cand.length) return;
      const chordC = cand.filter((p) => pcs.has(pc(p))), aim = prev != null ? prev : Math.min(hi, top + 5);
      const near = (list, at, skip) => { const l = list.filter((p) => p !== skip); if (!l.length) return list[0]; let best = l[0]; for (const p of l) if (Math.abs(p - at) + rng() * 0.6 < Math.abs(best - at)) best = p; return best; };
      const add = (pitch, at, len, v) => { const a = sg.beat + at, e = Math.min(sg.beat + sg.len, a + len, beats); if (e - a > 0.1) out.push({ pitch, start: +a.toFixed(4), length: +(e - a).toFixed(4), velocity: v || vel, tl: 1 }); };
      if (style === "held") {
        const k = sg.len >= 8 ? 2 : 1;
        for (let i = 0; i < k; i++) {
          // like "nothing after": the held note mostly steps (1-3 semitones) to the next chord's note, sometimes stays
          const step = prev == null ? [] : cand.filter((p) => Math.abs(p - prev) >= 1 && Math.abs(p - prev) <= 3);
          const p = prev == null ? near(chordC.length ? chordC : cand, aim) : step.length && (i || rng() < 0.7) ? near(step, prev - 0.5) : near(cand, prev);
          add(p, (i * sg.len) / k, sg.len / k - 0.05); prev = p;
        }
      } else if (style === "pedal") {
        if (pedal == null) { const tp = cand.filter((p) => pc(p - (o.tonic || 0)) === 0 || pc(p - (o.tonic || 0)) === 7); pedal = tp.length ? near(tp, aim) : near(cand, aim); }
        let p = pedal; if (!ok.has(pc(p)) || inSeg.some((n) => Math.abs(n.pitch - p) === 1)) p = near(cand, pedal);
        const r = rate0 || 1;
        for (let t = 0; t < sg.len - 1e-6; t += r) add(p, t, r >= 2 ? r - 0.1 : r * 0.55, t ? Math.round(vel * 0.85) : vel);
        prev = p;
      } else if (style === "arp") {
        const r = rate0 || 1, c3 = []; let at = near(cand, aim);
        const up = cand.filter((p) => p >= at).slice(0, 3); while (up.length < 3 && cand.length > up.length) { const more = cand.filter((p) => !up.includes(p)); up.unshift(more[more.length - 1] < up[0] ? more.filter((p) => p < up[0]).pop() : more[0]); }
        c3.push(...up.filter((p) => p != null).sort((a, b) => a - b));
        const pat = c3.length >= 3 ? [0, 1, 2, 1] : [0, 1];
        let i = 0; for (let t = 0; t < sg.len - 1e-6; t += r, i++) { const p = c3[pat[i % pat.length] % c3.length]; add(p, t, r * 0.9); prev = p; }
        prev = c3[0];
      } else {   // moving: ~3 notes a bar, by step, landing on a chord note when the chord changes
        const rh = [[0, 1.5], [1.5, 1], [2.5, 1.5]];
        for (let b = 0; b < sg.len - 1e-6; b += 4) for (const [t, len] of rh) {
          if (b + t >= sg.len - 1e-6) break;
          const first = b === 0 && t === 0, p = first ? near(chordC.length ? chordC : cand, aim) : near(cand.filter((x) => Math.abs(x - prev) <= 4), prev, rng() < 0.75 ? prev : null) || near(cand, prev);
          add(p, b + t, len - 0.05); prev = p;
        }
      }
    });
    return out;
  }

  const SIGN = { ring: "one note ringing through every chord", flip: "the same chord flipping minor/major", b2: "the b2 (a half step above the root)", b6: "the b6", tritone: "a tritone", lead: "the raised 7th over minor", m8m: "minor chords a major 3rd apart", dim: "a diminished chord", aug: "an augmented chord", chromatic: "a half-step chord move", cluster: "a half-step rub", maj7: "a maj7", m7: "a m7", colour: "a 6th or 9th colour", ext: "a 9th chord", sus: "a sus chord", power: "power chords", dom7: "a dominant 7th", majorHome: "a major home chord", minorHome: "a minor home chord", pedal: "a pedal bass", lineCliche: "a moving inner line", shine: "a lonely shine (maj7 or 9th over minor)", bVIbVII: "the hero chords bVI + bVII", heroMajor: "a borrowed bIII, bVI or bVII in major", mixo: "the Mixolydian b7", short: "short hits", axis: "the vi-IV lift", iii: "the iii chord", dorian6: "the Dorian 6th", picardy: "minor turning major", fantasy5: "minor i to major IV", plagalDom: "a strong IV and V", lydian: "the #4", mediant: "a chord a 3rd away from outside the key", parallel: "a parallel slide", lift: "the IV-V lift or sus to major", ivMinor: "the borrowed iv", m6: "a m6" };
  // judge(notes, { mood, blend, tonic, pins: { voices, range, rhythm } }) -> { ok, score 0..1, checks: [[ok, text]] }
  function judge(notes, o) {
    const m = byKey[o.mood]; if (!m) return { ok: true, score: 1, checks: [] };
    const b = o.blend && byKey[o.blend], J = m.judge, JB = b ? b.judge : null, pins = o.pins || {};
    const r = measure(notes, o.tonic || 0), c = [];
    if (!r.hits) return { ok: false, score: 0, checks: [[false, "no notes"]], r };
    if (J.minor != null && r.minorShare != null) c.push([r.minorShare >= J.minor, "minor chords " + Math.round(r.minorShare * 100) + "% (needs " + Math.round(J.minor * 100) + "%)"]);
    if (J.major != null && r.majorShare != null) c.push([r.majorShare >= J.major, "major chords " + Math.round(r.majorShare * 100) + "% (needs " + Math.round(J.major * 100) + "%)"]);
    if (J.power != null && !pins.voices) c.push([r.powerShare >= J.power, "power chords " + Math.round(r.powerShare * 100) + "%"]);
    if (J.need) { const miss = J.need.filter((s) => !r.f[s]); c.push([!miss.length, miss.length ? "needs " + miss.map((s) => SIGN[s]).join(", ") : SIGN[J.need[0]]]); }
    if (J.sig) { const got = J.sig.filter((s) => r.f[s]); c.push([got.length > 0, got.length ? "has " + got.map((s) => SIGN[s]).join(", ") : "missing its sound: " + J.sig.map((s) => SIGN[s]).join(" or ")]); }
    if (J.forbid) { const bad = J.forbid.filter((s) => r.f[s] && !(b && b.judge.sig && b.judge.sig.includes(s))); c.push([!bad.length, bad.length ? "should not have " + bad.map((s) => SIGN[s]).join(", ") : "nothing off-mood"]); }
    // the motion side comes from the blend's second mood when there is one
    const MJ = JB || J;
    if (MJ.mean && !pins.range) c.push([r.mean >= MJ.mean[0] && r.mean <= MJ.mean[1], "average pitch " + r.mean.toFixed(0) + " (wants " + (MJ.mean[0] ? MJ.mean[0] + "-" : "under ") + (MJ.mean[1] < 90 ? MJ.mean[1] : "up") + ")"]);
    if (J.size && !pins.voices) c.push([r.size >= J.size[0] - 0.01 && r.size <= J.size[1] + 0.01, "notes per chord " + r.size.toFixed(1)]);
    if (J.changes) c.push([r.changes >= J.changes[0] && r.changes <= J.changes[1], "different chords " + r.changes]);
    if (MJ.long && !pins.rhythm) c.push([r.long >= MJ.long, "notes held " + r.long.toFixed(1) + " beats"]);
    if (J.span && !pins.range) c.push([r.span >= J.span, "spread " + r.span.toFixed(0) + " semitones per chord"]);
    if (J.gap && !pins.range) c.push([r.gap >= J.gap, "low note " + r.gap.toFixed(0) + " below the rest"]);
    const okN = c.filter((x) => x[0]).length;
    return { ok: okN === c.length, score: c.length ? okN / c.length : 1, checks: c, r };
  }

  window.KT2MoodDNA = { on: () => !window.KT2_MOOD_DNA_OFF, MOODS, EXTRA, CORES, ALL, byKey, Q, QN, SCALES, parse, fits, bend, nameOf, moodsIn, scaleFor, plan, voice, revoice, measure, judge, SIGN, TOPS, topLine,
    tools: (k) => (byKey[k] && byKey[k].tools) || null };
  if (typeof module !== "undefined") module.exports = window.KT2MoodDNA;
})();
