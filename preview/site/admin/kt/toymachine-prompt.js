// SYNTH PRESET SCIENCE: type a sound, get a TOY MACHINE patch.
//
//   const preset = await ToyMachinePrompt.make("dark distorted synth wobbling in 1/4");
//   const r = ToyMachinePrompt.parse(text)   // -> { recipe, said: ["DARK", ...], words: [...] } (no audio)
//   const p = ToyMachinePrompt.build(recipe, { seed, name })   // recipe -> toymachine/1 preset
//
// How it works (plan: https://claude.ai/artifact/H2FNxrDHQRWhA2RJZMZoPj):
//   1. words -> a "sound recipe": about 25 dials (role, source, bright, weight, dirt, width, motion,
//      morph, echo, shimmer, space...). The LEX dictionary moves the dials; strength words (very,
//      slightly) scale a move and "not / less / no" flip it. Exact rhythm words ("1/4", "quarter",
//      "every bar", "dotted", "triplet") become note lengths and beat vague ones ("slowly").
//   2. recipe -> a whole preset written from scratch (oscillators, filter, envelopes, LFOs, mods,
//      fx, 4 macros named after the prompt's own words, a look). opts.seed (a preset) is used as
//      the starting point instead, when the host has a close preset.
//   3. (later) render + measure + nudge with the real engine (the listen-and-fix loop).
//
// The preset carries "prompt": { text, said, recipe } so a host can show what was understood.
// Plain browser JS, no libraries, no build step. Also loads in Node (module.exports).
// Keep this file ASCII-only. KT2_PROMPT_OFF = window.ToyMachinePrompt is not set.
(function (root) {
  "use strict";
  if (root && root.KT2_PROMPT_OFF) return;

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---- the recipe ---------------------------------------------------------------------------
  // Every dial is 0..1 with 0.5 = "nothing said" unless noted. Words add or subtract.
  function blankRecipe() {
    return {
      role: null,          // bass, lead, pad, pluck, keys, arp, fx (null = guessed)
      source: null,        // wavetable family: saw, square, sine, warm, growl, acid, vocal, formant, metal, fmbell, digital, chip, hollow, organ, comb, sinefold, harmonic, pwm
      bright: 0.5,         // dark .. bright
      weight: 0.5,         // thin .. heavy (sub, low end)
      dirt: 0, dirtType: null,   // 0 clean .. 1 destroyed; soft, tube, hard, fold, rectify
      crush: 0,            // bit crush
      width: 0.5,          // mono .. huge
      attack: 0, length: 0.5, release: 0.4,   // instant .. slow swell; short .. held; tight .. long tail
      res: 0.2,            // resonance / squelch
      motion: 0, motionRate: null, motionShape: null, motionTarget: "filter", motionSoft: false,
      morph: 0, morphRate: null,        // the tone itself slowly changing shape
      echo: 0, echoRate: null,
      shimmer: 0,
      space: 0,            // reverb amount
      warble: 0,           // chorus / tape wobble in pitch
      glide: 0,
      air: 0,              // breath / noise
      octave: 0,           // register shift in octaves
      gate: 0, gateRate: null,
      fm: 0, sync: 0, fold: 0,          // oscillator warps
      phaser: 0,
      mood: null,          // dark, happy, evil, dreamy (look colour only)
    };
  }

  // ---- the dictionary -----------------------------------------------------------------------
  // w: words or phrases. Each entry's moves are deltas (scaled by strength), "=" values set a dial.
  // Grouped by the timbre factors people really use (QMUL: sharpness, mass, clarity,
  // percussiveness, rawness) plus motion and space, which synths need.
  const LEX = [
    // role
    { w: ["bass", "bassline", "sub bass", "low end"], set: { role: "bass" } },
    { w: ["808"], set: { role: "bass", source: "sine" }, d: { weight: 0.4, length: 0.2 }, say: "808" },
    { w: ["reese"], set: { role: "bass", source: "saw" }, d: { width: 0.25, motion: 0.15, dirt: 0.2 }, say: "REESE" },
    { w: ["lead", "melody", "topline", "solo"], set: { role: "lead" } },
    { w: ["pad", "pads", "atmosphere", "texture", "drone", "bed"], set: { role: "pad" } },
    { w: ["pluck", "plucky", "plucked"], set: { role: "pluck" } },
    { w: ["keys", "piano", "ep", "rhodes", "organ", "chords"], set: { role: "keys" } },
    { w: ["arp", "arpeggio", "arpeggiated"], set: { role: "arp" } },
    { w: ["fx", "riser", "sweep", "impact", "noise fx", "uplifter", "downlifter"], set: { role: "fx" } },
    { w: ["stab", "stabs", "hit"], set: { role: "pluck" }, d: { length: -0.3 } },
    { w: ["bell", "bells", "chime", "chimes"], set: { role: "keys", source: "fmbell" }, d: { bright: 0.15, release: 0.2 }, say: "BELL" },
    { w: ["choir", "voices", "vocal", "vox", "aah", "ooh", "singing"], set: { source: "vocal" }, d: { space: 0.2 }, say: "VOCAL" },

    // source / character
    { w: ["saw", "sawtooth", "supersaw", "trance"], set: { source: "saw" } },
    { w: ["supersaw"], d: { width: 0.4 }, say: "SUPERSAW" },
    { w: ["square", "pulse", "hollow", "clarinet"], set: { source: "hollow" } },
    { w: ["sine", "pure", "round", "smooth"], set: { source: "sine" }, d: { dirt: -0.2 } },
    { w: ["analog", "analogue", "vintage", "moog", "juno", "prophet", "retro", "warm"], set: { source: "warm" }, d: { warble: 0.1 }, say: "ANALOG" },
    { w: ["growl", "growly", "growling", "talking", "yoi", "yoy", "wah", "vowel", "formant"], set: { source: "growl" }, d: { motion: 0.3 }, say: "GROWL" },
    { w: ["acid", "303", "squelch", "squelchy", "rubbery"], set: { source: "acid" }, d: { res: 0.5 }, say: "ACID" },
    { w: ["metallic", "metal", "robotic", "robot", "clang", "clangy", "industrial", "ringing", "inharmonic"], set: { source: "metal" }, d: { fm: 0.3 }, say: "METALLIC" },
    { w: ["fm", "dx7", "digital", "cold"], set: { source: "fmbell" }, d: { fm: 0.25 }, say: "DIGITAL" },
    { w: ["chip", "chiptune", "8bit", "8-bit", "nes", "gameboy", "retro game", "pixel"], set: { source: "chip" }, d: { crush: 0.5 }, say: "8-BIT" },
    { w: ["glass", "glassy", "crystal", "crystalline"], set: { source: "fmbell" }, d: { bright: 0.25, release: 0.2 }, say: "GLASSY" },
    { w: ["buzzy", "buzz", "nasal", "reedy"], set: { source: "sinefold" }, d: { fold: 0.3, bright: 0.1 }, say: "BUZZY" },
    { w: ["phasey", "flanger", "flanged", "jet", "comb"], set: { source: "comb" }, d: { phaser: 0.5 }, say: "PHASEY" },
    { w: ["laser", "zap", "pew", "sci-fi", "scifi"], set: { role: "fx", source: "fmbell" }, d: { fm: 0.4, glide: 0.4 }, say: "LASER" },
    { w: ["hard sync", "sync", "screaming", "screech", "screechy"], d: { sync: 0.5, bright: 0.2 }, say: "SCREECH" },
    { w: ["organic", "acoustic", "natural", "real"], set: { source: "harmonic" }, d: { warble: 0.1 } },

    // sharpness (bright / dark)
    { w: ["dark", "darker", "murky", "muffled", "dull", "deep", "shadowy", "night", "underground", "moody", "gloomy"], d: { bright: -0.3 }, say: "DARK", mood: "dark" },
    { w: ["underwater", "under water", "submerged", "behind a wall", "next room", "in another room"], d: { bright: -0.45, space: 0.15 }, say: "UNDERWATER" },
    { w: ["bright", "brighter", "crisp", "shiny", "sharp", "sparkly", "sparkle", "sparkling", "brilliant", "piercing", "cutting", "harsh"], d: { bright: 0.3 }, say: "BRIGHT" },
    { w: ["airy", "breathy", "breath", "whisper", "airy", "hissy"], d: { air: 0.4, bright: 0.1 }, say: "AIRY" },
    { w: ["soft", "gentle", "mellow", "calm", "tender", "velvet", "silky"], d: { bright: -0.15, dirt: -0.3, attack: 0.1 }, say: "SOFT" },

    // mass (heavy / thin)
    { w: ["heavy", "fat", "thick", "huge", "massive", "big", "phat", "chunky", "beefy", "full"], d: { weight: 0.3, width: 0.1 }, say: "HEAVY" },
    { w: ["sub", "subby", "low", "bassy", "rumble", "rumbling", "booming", "boomy"], d: { weight: 0.35 }, say: "SUB" },
    { w: ["thin", "small", "tiny", "lofi phone", "tinny", "weak"], d: { weight: -0.35, width: -0.2 }, say: "THIN" },

    // clarity / rawness (dirt)
    { w: ["distorted", "distortion", "dirty", "gritty", "grit", "grimy", "filthy", "nasty", "raw", "saturated", "overdriven", "driven", "crunchy", "crunch", "fuzzy", "fuzz"], d: { dirt: 0.45 }, say: "DIRTY" },
    { w: ["aggressive", "angry", "rage", "violent", "brutal", "evil", "villain", "villainous", "sinister", "menacing", "demonic", "horror", "scary"], d: { dirt: 0.35, bright: -0.1 }, say: "EVIL", mood: "evil" },
    { w: ["destroyed", "blown out", "blown", "clipped", "clipping", "broken", "busted", "smashed", "crushed"], d: { dirt: 0.7 }, set: { dirtType: "hard" }, say: "BLOWN OUT" },
    { w: ["tube", "tape saturation", "warm saturation"], d: { dirt: 0.3 }, set: { dirtType: "tube" } },
    { w: ["folded", "wavefold", "wavefolded", "fold"], d: { dirt: 0.3, fold: 0.4 }, set: { dirtType: "fold" }, say: "FOLDED" },
    { w: ["bitcrushed", "bitcrush", "crush", "lofi", "lo-fi", "low fi", "degraded", "dusty", "old"], d: { crush: 0.45, bright: -0.1, warble: 0.15 }, say: "LO-FI" },
    { w: ["clean", "polished", "pristine", "hi-fi", "hifi"], d: { dirt: -0.5, crush: -0.5 }, say: "CLEAN" },

    // percussiveness (envelope)
    { w: ["short", "staccato", "punchy", "tight", "snappy", "percussive", "plucky", "bouncy"], d: { length: -0.35, attack: -0.3, release: -0.2 }, say: "SHORT" },
    { w: ["long", "sustained", "held", "endless", "infinite"], d: { length: 0.35, release: 0.2 }, say: "LONG" },
    { w: ["swell", "swelling", "swells", "fade in", "fading in", "rising", "slow attack", "bowed", "reverse", "reversed"], d: { attack: 0.6, length: 0.2 }, say: "SWELL" },
    { w: ["fading", "fade out", "tail", "long tail", "decaying"], d: { release: 0.4 }, say: "TAIL" },
    { w: ["glide", "gliding", "slide", "sliding", "portamento", "legato", "bend", "bending"], d: { glide: 0.5 }, say: "GLIDE" },

    // width
    { w: ["wide", "wider", "stereo", "spread", "panoramic", "huge stereo", "detuned", "unison"], d: { width: 0.35 }, say: "WIDE" },
    { w: ["mono", "narrow", "centered", "focused"], d: { width: -0.4 }, say: "MONO" },

    // motion
    { w: ["wobble", "wobbly", "wobbling", "wobbles", "wub", "wubs", "dubstep", "riddim"], d: { motion: 0.55 }, set: { motionTarget: "filter" }, say: "WOBBLE", motionWord: true },
    { w: ["pulsing", "pulse", "pumping", "throbbing", "breathing", "tremolo", "chopped", "choppy"], d: { motion: 0.45 }, set: { motionTarget: "amp" }, say: "PULSE", motionWord: true },
    { w: ["gated", "gate", "trance gate", "stutter", "stuttering", "chopped up"], d: { gate: 0.6 }, say: "GATED", gateWord: true },
    { w: ["vibrato", "wavy", "seasick", "drunk", "warped"], d: { motion: 0.3 }, set: { motionTarget: "pitch" }, say: "VIBRATO", motionWord: true },
    { w: ["morph", "morphing", "morphs", "evolving", "evolve", "shifting", "changing", "mutating", "alive", "animated", "moving", "liquid", "fluid"], d: { morph: 0.55 }, say: "MORPHING", morphWord: true },
    { w: ["warble", "warbly", "wow", "flutter", "tape", "chorus", "chorused", "seasick tape"], d: { warble: 0.45 }, say: "WARBLE" },
    { w: ["phaser", "phased", "swirl", "swirling", "swirly"], d: { phaser: 0.5 }, say: "SWIRL" },

    // space
    { w: ["delay", "delayed", "delaying", "echo", "echoes", "echoing", "echoey", "repeats", "repeating", "ping pong", "pingpong", "dub"], d: { echo: 0.5 }, say: "ECHO", echoWord: true },
    { w: ["shimmer", "shimmering", "shimmery", "heavenly", "heaven", "angelic", "celestial", "in the sky", "sky", "stars", "starry", "glistening", "glittering"], d: { shimmer: 0.55, space: 0.25, bright: 0.05 }, say: "SKY", mood: "dreamy" },
    { w: ["reverb", "reverby", "wet", "washed", "washy", "wash", "cavernous", "cave", "cathedral", "church", "hall", "spacious", "space", "spacey", "spacy", "ambient", "dreamy", "dream", "ethereal", "floating", "foggy", "hazy", "misty", "cinematic", "epic"], d: { space: 0.4 }, say: "SPACE", mood: "dreamy" },
    { w: ["dry", "close", "upfront", "in your face"], d: { space: -0.4, echo: -0.4, shimmer: -0.4 }, say: "DRY" },

    // register
    { w: ["high", "higher", "high pitched", "squeaky", "tiny high"], d: { octave: 1 } },
    { w: ["low pitched", "lower", "deeper", "downtuned"], d: { octave: -1 } },

    // mood words that only colour the look and nudge a little
    { w: ["happy", "uplifting", "euphoric", "sunny", "summer", "joyful"], d: { bright: 0.1 }, mood: "happy" },
    { w: ["sad", "melancholic", "melancholy", "lonely", "emotional", "grief", "nostalgic"], d: { bright: -0.1, space: 0.15, warble: 0.1 }, mood: "dreamy" },
    { w: ["electronic", "synth", "synthy", "electro", "synthesizer"], ifNone: { role: "synth" } },
  ];

  // phrases first (longest match), then single words
  const PHRASES = [];
  LEX.forEach((e, i) => e.w.forEach((w) => PHRASES.push({ w: w.split(/\s+/), i })));
  PHRASES.sort((a, b) => b.w.length - a.w.length);

  const STRONG = { very: 1.5, super: 1.6, extra: 1.5, really: 1.4, so: 1.3, crazy: 1.8, insanely: 1.9, extremely: 1.8, ultra: 1.8, hella: 1.6, mega: 1.7, most: 1.6, too: 1.3, more: 1.3, max: 2, maximum: 2, heavily: 1.5 };
  const WEAK = { slightly: 0.45, bit: 0.5, little: 0.5, kinda: 0.6, somewhat: 0.6, subtle: 0.45, subtly: 0.45, light: 0.55, lightly: 0.55, gently: 0.55, touch: 0.45, hint: 0.4, mild: 0.55, mildly: 0.55 };
  const NEG = { not: 1, no: 1, without: 1, less: 1, never: 1, non: 1, zero: 1 };

  // ---- rhythm words -> note lengths ---------------------------------------------------------
  // returns { sync, at } with `at` = token index, or null
  const NUM = { one: 1, two: 2, three: 3, four: 4, eight: 8, sixteen: 16, half: 0.5, quarter: 0.25 };
  function findRhythms(tokens) {
    const out = [];
    const mod = (i) => {
      const near = tokens.slice(Math.max(0, i - 2), i + 3).join(" ");
      return /triplet|\btrip\b/.test(near) ? "t" : /dotted/.test(near) ? "d" : "";
    };
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      let m;
      if ((m = /^(\d+)\/(\d+)([dt]?)$/.exec(t))) {
        // "1/4 of a bar" / "1/4 bar" = a quarter note; "1/2 bar" = a half note; "1/4" alone = a quarter
        let a = +m[1], b = +m[2];
        const ofBar = /^(of|a|bar|bars)$/.test(tokens[i + 1] || "") && /bar/.test(tokens.slice(i + 1, i + 4).join(" "));
        if (ofBar && b <= 2 && a === 1) { /* "1/2 bar" = 1/2 note */ }
        out.push({ sync: `${a}/${b}${m[3] || mod(i)}`, at: i });
      } else if ((m = /^(\d+)(th|nd|rd|st)s?$/.exec(t)) && [4, 8, 16, 32].includes(+m[1])) {
        out.push({ sync: `1/${m[1]}${mod(i)}`, at: i });
      } else if (/^(quarter|quarters|crotchet)s?$/.test(t)) {
        out.push({ sync: "1/4" + mod(i), at: i });
      } else if (/^(eighth|eighths|eigth|quaver)s?$/.test(t)) {
        out.push({ sync: "1/8" + mod(i), at: i });
      } else if (/^(sixteenth|sixteenths|semiquaver)s?$/.test(t)) {
        out.push({ sync: "1/16" + mod(i), at: i });
      } else if (/^bars?$/.test(t)) {
        const prev = tokens[i - 1] || "";
        if (tokens.slice(Math.max(0, i - 3), i).some((x) => /\//.test(x))) continue;   // "1/4 of a bar" already counted
        const n = /^\d+$/.test(prev) ? +prev : NUM[prev] != null ? NUM[prev] : (prev === "a" || prev === "every" || prev === "per" || prev === "each") ? 1 : null;
        if (n === 0.5) out.push({ sync: "1/2", at: i });
        else if (n === 0.25) out.push({ sync: "1/4", at: i });
        else if (n === 1) out.push({ sync: "1/1", at: i });
        else if (n === 2) out.push({ sync: "2/1", at: i });
        else if (n >= 4) out.push({ sync: "4/1", at: i });
      } else if (/^beats?$/.test(t)) {
        const prev = tokens[i - 1] || "";
        out.push({ sync: prev === "half" ? "1/8" : (prev === "2" || prev === "two") ? "1/2" : "1/4", at: i });
      }
    }
    return out;
  }

  // ---- parse ----------------------------------------------------------------------------------
  function tokenize(text) {
    return String(text || "").toLowerCase()
      .replace(/[\u2018\u2019']/g, "")
      .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2")
      .replace(/[^a-z0-9/\-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  }

  function parse(text) {
    const tokens = tokenize(text);
    const R = blankRecipe(), said = [], hits = [], used = new Array(tokens.length).fill(false);
    const moods = {};
    // find dictionary hits (longest phrase first)
    for (const ph of PHRASES) {
      for (let i = 0; i + ph.w.length <= tokens.length; i++) {
        let ok = true;
        for (let j = 0; j < ph.w.length; j++) if (used[i + j] || tokens[i + j] !== ph.w[j]) { ok = false; break; }
        if (!ok) continue;
        for (let j = 0; j < ph.w.length; j++) used[i + j] = true;
        hits.push({ at: i, len: ph.w.length, e: LEX[ph.i], word: ph.w.join(" ") });
      }
    }
    hits.sort((a, b) => a.at - b.at);
    // strength + negation look back up to 2 words (and "too much" style is ignored)
    // only the words between the previous hit and this one count, so "not dark pluck" negates dark only
    let prevEnd = 0;
    const scaleAt = (i) => {
      let k = 1, neg = false;
      for (let j = Math.max(prevEnd, i - 3); j < i; j++) {
        const t = tokens[j];
        if (STRONG[t]) k *= STRONG[t];
        if (WEAK[t]) k *= WEAK[t];
        if (NEG[t]) neg = true;
        if (/^(and|but|with|,)$/.test(t)) { k = 1; neg = false; }   // a new idea starts
      }
      return { k: clamp(k, 0.3, 2.2), neg };
    };
    const strength = {};   // dial -> {word, amount} for macro naming
    const seenEntry = new Map();
    for (const h of hits) {
      const { k, neg } = scaleAt(h.at), e = h.e;
      prevEnd = h.at + h.len;
      const again = seenEntry.get(e) || 0; seenEntry.set(e, again + 1);
      const rep = again ? 0.35 : 1;   // saying the same idea twice ("shimmer in the sky") adds a little, not double
      if (e.set && !neg) for (const key in e.set) R[key] = e.set[key];
      if (e.ifNone && !neg) for (const key in e.ifNone) if (R[key] == null) R[key] = e.ifNone[key];
      if (e.d) for (const key in e.d) {
        const amt = e.d[key] * k * rep * (neg ? -0.8 : 1);
        R[key] = (R[key] || 0) + amt;
        if (!strength[key] || Math.abs(amt) > Math.abs(strength[key].amount)) strength[key] = { word: h.word, amount: amt, say: e.say };
      }
      if (e.mood && !neg) moods[e.mood] = (moods[e.mood] || 0) + 1;
      if (e.say && !neg && !said.includes(e.say)) said.push(e.say);
      if (e.say && neg) said.push("NO " + e.say);
    }
    // rhythm: give each note length to the nearest echo / motion / gate word
    const rh = findRhythms(tokens);
    const anchors = hits.filter((h) => h.e.motionWord || h.e.echoWord || h.e.morphWord || h.e.gateWord);
    for (const r of rh) {
      let best = null, bd = 1e9;
      for (const a of anchors) { const d = Math.abs(a.at - r.at) + (a.at > r.at ? 0.5 : 0); if (d < bd) { bd = d; best = a; } }
      if (!best) { R.motionRate = r.sync; if (R.motion < 0.3) R.motion = 0.45; continue; }
      if (best.e.echoWord) R.echoRate = r.sync;
      else if (best.e.gateWord) R.gateRate = r.sync;
      else if (best.e.morphWord && !best.e.motionWord) R.morphRate = r.sync;
      else R.motionRate = r.sync;
    }
    // "slowly" / "fast" next to motion words
    const speed = (re) => tokens.some((t) => re.test(t));
    const slow = speed(/^(slow|slowly|lazy|lazily|gradual|gradually|sluggish|creeping)$/), fast = speed(/^(fast|quick|quickly|rapid|rapidly|frantic|hyper)$/);
    if (R.motion > 0) {
      if (!R.motionRate) R.motionRate = slow ? "1/2" : fast ? "1/16" : "1/8";
      else if (slow) R.motionSoft = true;   // exact number wins; "slowly" makes the shape rounder
    }
    if (R.morph > 0 && !R.morphRate) R.morphRate = fast ? "1/2" : slow ? "4/1" : "2/1";
    if (R.echo > 0 && !R.echoRate) R.echoRate = R.shimmer > 0 || R.space > 0.3 ? "1/4d" : "1/8d";
    if (R.gate > 0 && !R.gateRate) R.gateRate = fast ? "1/32" : "1/16";
    if (slow && R.attack < 0.2 && !R.motion && R.role !== "bass") R.attack += 0.25;
    // guess the role if nobody said it
    if (!R.role) R.role = R.weight > 0.75 ? "bass" : (R.attack > 0.35 || R.space > 0.45 || R.shimmer > 0.3) ? "pad" : R.length < 0.25 ? "pluck" : "lead";
    // clamp
    for (const key of ["bright", "weight", "dirt", "crush", "width", "attack", "length", "release", "res", "motion", "morph", "echo", "shimmer", "space", "warble", "glide", "air", "gate", "fm", "sync", "fold", "phaser"])
      R[key] = r3(clamp(R[key], 0, 1));
    R.octave = clamp(Math.round(R.octave), -2, 2);
    R.mood = Object.keys(moods).sort((a, b) => moods[b] - moods[a])[0] || null;
    return { recipe: R, said, words: hits.map((h) => h.word), strength, tokens };
  }

  // ---- recipe -> preset ---------------------------------------------------------------------
  const ROLE = {
    // base cutoff (Hz at bright 0.5), voice, amp env, osc octave, polyphony, category
    bass:  { cut: 900, trim: -1.4,  mode: "mono", env: { a: 0.003, d: 0.4, s: 0.85, r: 0.12 }, oct: -1, cat: "Bass" },
    synth: { cut: 2600, trim: 0.5, mode: "poly", env: { a: 0.006, d: 0.6, s: 0.8, r: 0.5 }, oct: 0, cat: "Synths" },
    lead:  { cut: 3200, trim: 3, mode: "legato", env: { a: 0.004, d: 0.3, s: 0.8, r: 0.25 }, oct: 0, cat: "Leads" },
    pad:   { cut: 2400, trim: 4, mode: "poly", env: { a: 0.6, d: 1.2, s: 0.85, r: 1.6 }, oct: 0, cat: "Pads" },
    pluck: { cut: 2600, trim: 7, mode: "poly", env: { a: 0.002, d: 0.32, s: 0.0, r: 0.25 }, oct: 0, cat: "Plucks" },
    keys:  { cut: 3800, trim: 4.3, mode: "poly", env: { a: 0.004, d: 0.9, s: 0.45, r: 0.45 }, oct: 0, cat: "Keys" },
    arp:   { cut: 3000, trim: 10, mode: "poly", env: { a: 0.002, d: 0.22, s: 0.2, r: 0.18 }, oct: 0, cat: "Arps" },
    fx:    { cut: 5000, trim: 6, mode: "poly", env: { a: 0.3, d: 1.5, s: 0.7, r: 2.0 }, oct: 0, cat: "FX" },
  };
  const TABLE = {
    // source -> [wave, pos]
    saw: ["basic", 0.667], square: ["basic", 1], hollow: ["hollow", 0.4], sine: ["basic", 0], warm: ["warm", 0.25],
    growl: ["growl", 0.3], acid: ["acid", 0.3], vocal: ["vocal", 0.2], formant: ["formant", 0.2], metal: ["metal", 0.4],
    fmbell: ["fmbell", 0.35], digital: ["digital", 0.4], chip: ["chip", 0.1], organ: ["organ", 0.4], comb: ["comb", 0.3],
    sinefold: ["sinefold", 0.4], harmonic: ["harmonic", 0.5], pwm: ["pwm", 0.3],
  };
  const DRIVE_FOR = { soft: "soft", tube: "tube", hard: "hard", fold: "fold", rectify: "rectify" };

  function build(R, opts) {
    opts = opts || {};
    const role = ROLE[R.role] || ROLE.lead;
    const p = opts.seed ? clone(opts.seed) : {};
    const P = Object.assign(p, { format: "toymachine/1", genre: "Electronic", category: role.cat });
    const source = R.source || (R.bright < 0.35 ? "warm" : R.role === "pad" ? "warm" : R.role === "bass" && R.dirt > 0.3 ? "growl" : "saw");
    const [wave, pos] = TABLE[source] || TABLE.saw;

    // voice
    P.voice = { mode: R.glide > 0.2 ? "legato" : role.mode, glide: r3(R.glide > 0.05 ? 0.02 + R.glide * 0.18 : 0), polyphony: role.mode === "poly" ? 8 : 1, bend: 2, velocity: 0.5 };
    if (P.voice.mode !== "poly") P.voice.polyphony = 8;

    // oscillators: A = the main table, B = a second voice that thickens (detuned saw, or an octave)
    const voices = Math.round(1 + R.width * (R.role === "bass" ? 4 : 7));
    const detune = r3(R.width * (R.role === "bass" ? 22 : 38) + R.warble * 8);
    const warpA = R.fm > 0.15 ? { type: "fm", amount: r3(R.fm * 0.7) } : R.sync > 0.15 ? { type: "sync", amount: r3(R.sync * 0.6) } : R.fold > 0.15 ? { type: "fold", amount: r3(R.fold * 0.7) } : { type: "none", amount: 0 };
    P.oscA = { on: true, wave, pos, oct: role.oct + R.octave, level: 0.8, unison: { voices, detune, spread: r3(clamp(R.width * 1.1, 0, 1)), blend: 0.75 }, warp: warpA };
    const bWave = source === "sine" ? "basic" : source;
    const bTable = TABLE[bWave] || TABLE.saw;
    P.oscB = { on: R.weight > 0.4 || R.width > 0.55 || R.morph > 0.2, wave: bTable[0], pos: r3(clamp(bTable[1] + 0.25, 0, 1)), oct: role.oct + R.octave + (R.role === "bass" ? 0 : -1), fine: 7, level: 0.45,
               unison: { voices: Math.max(1, Math.round(voices / 2)), detune: r3(detune * 0.7), spread: r3(R.width * 0.8), blend: 0.6 }, warp: warpA.type === "fm" ? { type: "none", amount: 0 } : warpA };
    if (warpA.type === "fm") { P.oscB.on = true; P.oscB.wave = "basic"; P.oscB.pos = 0; P.oscB.oct = role.oct + R.octave + 1; P.oscB.level = 0.2; }
    P.sub = { on: R.weight > 0.45 || R.role === "bass", shape: "sine", oct: R.role === "bass" ? -1 : -2, level: r3(clamp(0.2 + (R.weight - 0.4) * 1.1, 0.15, 0.8)), filter: false };
    if (R.role !== "bass" && R.weight <= 0.55) P.sub.on = false;
    P.noise = { on: R.air > 0.1 || R.role === "fx", color: 0.3, grain: 0, pitch: R.air > 0.3 ? 0.4 : 0, level: r3(0.05 + R.air * 0.25), filter: true };

    // filter: dark = low cutoff; the wobble rides on it
    const cutoff = Math.round(clamp(role.cut * Math.pow(2, (R.bright - 0.5) * 5.5) * (R.motion > 0.2 && R.motionTarget === "filter" ? 0.75 : 1), 120, 18000));
    P.filter = { on: true, type: R.dirt > 0.4 || source === "acid" ? "ladder" : "lp24", cutoff, res: r3(clamp(R.res + (R.motion > 0.2 && R.motionTarget === "filter" ? 0.15 : 0), 0, 0.9)),
                 drive: r3(R.dirt * 9), keytrack: R.role === "bass" ? 0.2 : 0.45, env: r3(R.role === "pluck" || R.role === "arp" ? 2.5 : R.role === "keys" ? 1.2 : source === "acid" ? 3 : 0.4), vel: 0.3 };
    P.filterEnv = { a: 0.002, d: R.role === "pluck" ? 0.25 : 0.4, s: 0.15, r: 0.3, curve: 0.6 };

    // amp envelope: role base, bent by attack / length / release
    const e = role.env;
    P.ampEnv = {
      a: r3(R.attack > 0.05 ? Math.max(e.a, 0.02 + Math.pow(R.attack, 1.6) * 2.4) : (R.attack < 0 ? 0.002 : e.a)),
      d: r3(e.d * Math.pow(2, (R.length - 0.5) * 2)),
      s: r3(clamp(e.s + (R.length - 0.5) * 0.9, 0, 1)),
      r: r3(clamp(e.r * Math.pow(2, (R.release - 0.4) * 3) + R.space * 0.6 + R.shimmer * 0.8, 0.03, 6)),
      curve: 0.55, aCurve: R.attack > 0.3 ? 0.3 : 0,
    };

    // modulation
    P.mods = [];
    P.lfo1 = { shape: "sine", rate: 2, sync: null, retrig: true, phase: R.motionTarget === "filter" ? 0.75 : 0 };
    P.lfo2 = { shape: "smooth", rate: 0.2, sync: null, retrig: false, phase: 0 };
    if (R.motion > 0.05) {
      P.lfo1.sync = R.motionRate || "1/8";
      P.lfo1.shape = R.motionShape || (R.motionSoft ? "sine" : R.motionTarget === "amp" ? "square" : "sine");
      if (R.motionTarget === "filter") {
        P.mods.push({ src: "lfo1", dst: "filter.cutoff", amt: r3(0.8 + R.motion * 3) });
        P.mods.push({ src: "lfo1", dst: "oscA.pos", amt: r3(R.motion * 0.2) });
      } else if (R.motionTarget === "amp") {
        P.mods.push({ src: "lfo1", dst: "amp", amt: r3(-0.3 - R.motion * 0.5) });
      } else if (R.motionTarget === "pitch") {
        P.lfo1.retrig = false; P.lfo1.sync = null; P.lfo1.rate = 5.5;
        P.mods.push({ src: "lfo1", dst: "pitch", amt: r3(0.08 + R.motion * 0.35) });
      }
    }
    if (R.morph > 0.05) {
      P.lfo2 = { shape: "sine", rate: 0.25, sync: R.morphRate || "2/1", retrig: false, phase: 0 };
      P.mods.push({ src: "lfo2", dst: "oscA.pos", amt: r3(0.15 + R.morph * 0.3) });
      P.mods.push({ src: "lfo2", dst: "oscB.pos", amt: r3(-(0.1 + R.morph * 0.25)) });
      if (warpA.type !== "none") P.mods.push({ src: "lfo2", dst: "oscA.warp", amt: r3(R.morph * 0.3) });
      else P.mods.push({ src: "lfo2", dst: "filter.cutoff", amt: r3(R.morph * 0.8) });
    }
    if (R.role === "pad" || R.attack > 0.3) P.mods.push({ src: "random", dst: "oscA.pan", amt: 0.15 });

    // effects (order matters: tone -> dirt -> movement -> space -> glue)
    const fx = [];
    if (R.dirt > 0.08) fx.push({ type: "drive", mode: DRIVE_FOR[R.dirtType] || (R.dirt > 0.65 ? "hard" : R.role === "bass" ? "fold" : "tube"), amount: r3(4 + R.dirt * 22), tone: r3(clamp(0.3 + R.bright * 0.5, 0, 1)), mix: r3(clamp(0.45 + R.dirt * 0.5, 0, 1)) });
    if (R.crush > 0.1) fx.push({ type: "crush", bits: Math.round(16 - R.crush * 11), rate: Math.round(44100 * Math.pow(0.5, R.crush * 3.5)), mix: r3(0.4 + R.crush * 0.5) });
    if (R.gate > 0.1) { /* the gate is a landscape point (below) */ }
    if (R.warble > 0.1) fx.push({ type: "chorus", rate: r3(0.4 + R.warble * 0.8), depth: r3(0.3 + R.warble * 0.6), mix: r3(0.2 + R.warble * 0.35), voices: R.warble > 0.4 ? 3 : 2 });
    if (R.phaser > 0.1) fx.push({ type: "phaser", rate: 0.25, depth: r3(0.4 + R.phaser * 0.5), feedback: 0.5, mix: 0.5 });
    if (R.echo > 0.05) fx.push({ type: "delay", sync: R.echoRate || "1/8d", feedback: r3(0.3 + R.echo * 0.4), mix: r3(0.12 + R.echo * 0.25), pingpong: true, tone: r3(R.shimmer > 0.2 ? 0.7 : R.bright < 0.4 ? 0.35 : 0.5) });
    if (R.shimmer > 0.05) fx.push({ type: "texture", mode: "shimmer", mix: r3(0.2 + R.shimmer * 0.4) });
    if (R.space > 0.05 || R.shimmer > 0.05) fx.push({ type: "reverb", size: r3(0.5 + R.space * 0.45), decay: r3(1.5 + R.space * 5 + R.shimmer * 3), damp: r3(R.bright < 0.4 ? 0.6 : 0.35), predelay: 0.02, mix: r3(clamp(0.1 + R.space * 0.35 + R.shimmer * 0.15, 0, 0.6)), mod: r3(0.3 + R.shimmer * 0.5) });
    if (R.width > 0.7) fx.push({ type: "width", amount: r3(1 + (R.width - 0.7) * 2), bassMono: R.role === "bass" ? 150 : 100 });
    if (R.dirt > 0.3 || R.weight > 0.7) fx.push({ type: "ott", depth: r3(0.2 + R.dirt * 0.3), time: 0.5, up: 1, down: 1 });
    if (R.dirt > 0.25 || R.role === "bass") fx.push({ type: "clip", drive: r3(2 + R.dirt * 8), shape: 40, ceiling: -1 });
    P.fx = fx.slice(0, 8);

    // moving effects (engine 2026-11-10: mods can aim at "fx.<type>.<field>"): "morphing" also morphs the
    // dirt and the shimmer, a filter wobble pushes the drive with it, a pulse breathes the echo.
    // KT2_PROMPT_FXMOD_OFF = synth-only movement (older engines ignore these mods anyway).
    const fxMods = !(root && root.KT2_PROMPT_FXMOD_OFF);
    const has = (t) => P.fx.some((f) => f.type === t);
    if (fxMods && R.morph > 0.05) {
      if (has("drive")) P.mods.push({ src: "lfo2", dst: "fx.drive.amount", amt: r3(4 + R.morph * 10) });
      if (has("texture")) P.mods.push({ src: "lfo2", dst: "fx.texture.mix", amt: r3(0.1 + R.morph * 0.2) });
      if (has("delay")) P.mods.push({ src: "lfo2", dst: "fx.delay.feedback", amt: r3(0.08 + R.morph * 0.15) });
      if (has("reverb")) P.mods.push({ src: "lfo2", dst: "fx.reverb.mod", amt: 0.3 });
    }
    if (fxMods && R.motion > 0.05 && R.motionTarget === "filter" && has("drive")) P.mods.push({ src: "lfo1", dst: "fx.drive.amount", amt: r3(R.motion * 6) });
    if (fxMods && R.motion > 0.05 && R.motionTarget === "amp" && has("delay")) P.mods.push({ src: "lfo1", dst: "fx.delay.mix", amt: r3(-R.motion * 0.15) });

    // landscape points: the gate rides a point
    P.pads = [{ kind: "macro", x: 0, y: 1 }, { kind: "macro", x: 2, y: 3 }];
    if (R.gate > 0.1) {
      const gr = { "1/4": 0, "1/8": 0.33, "1/8t": 0.5, "1/16": 0.66, "1/16t": 0.83, "1/32": 1 }[R.gateRate] != null ? { "1/4": 0, "1/8": 0.33, "1/8t": 0.5, "1/16": 0.66, "1/16t": 0.83, "1/32": 1 }[R.gateRate] : 0.66;
      P.pads.push({ kind: "gate", pos: [r3(gr), r3(0.5 + R.gate * 0.5)] });
    }

    // loudness: rough per-role trim (the listen-and-fix loop will level it properly)
    // trims measured on 50 test prompts (gated RMS to about -16 dB); level() makes it exact when a renderer is given
    P.out = { level: r3(-2 - R.dirt * 4 - R.width * 2 - (R.role === "pad" ? 2 : 0) + (role.trim || 0)), width: 1 };

    // CREATE SOUND: a dropped sound (or a close preset) is the body, so its oscillators and sampler stay
    // and only the shaping (filter, envelopes, movement, effects) comes from the words
    if (opts.keepSource && opts.seed) {
      for (const k of ["oscA", "oscB", "sampler", "noise"]) if (opts.seed[k]) P[k] = clone(opts.seed[k]);
      if (opts.seed.sub && opts.seed.sub.on && !P.sub.on) P.sub = clone(opts.seed.sub);
      if (opts.seed.drift) P.drift = clone(opts.seed.drift);
    }

    // 4 macros, named after the words that drove the sound
    P.macros = makeMacros(P, R, opts.strength || {});
    P.look = lookFor(R);
    return P;
  }

  function idx(P, type) { return P.fx.findIndex((f) => f.type === type); }

  function makeMacros(P, R, strength) {
    const cands = [];
    // a macro is named after the word that drove it ("SKY", "WOBBLE"), else a plain name
    const nm = (key, fallback) => (strength[key] && strength[key].say && strength[key].amount > 0 ? strength[key].say : fallback) + "|" + fallback;
    const add = (score, name, targets) => { const [a, b] = String(name).split("|"); cands.push({ score, name: a, alt: b || a, targets }); };
    // brightness is always useful
    const c = P.filter.cutoff;
    const bName = (strength.bright && strength.bright.say && (R.bright < 0.5) === (strength.bright.amount < 0) ? strength.bright.say : R.bright < 0.5 ? "DARK" : "BRIGHT") + "|" + (R.bright < 0.5 ? "DARK" : "BRIGHT");
    add(1 + Math.abs(R.bright - 0.5) * 3, bName, [{ param: "filter.cutoff", from: Math.round(Math.max(60, c / 4)), to: Math.round(Math.min(20000, c * 4)) }]);
    const d = idx(P, "drive");
    if (d >= 0) add(1 + R.dirt * 3, nm("dirt", "DIRT"), [{ param: `fx.${d}.amount`, from: 0, to: r3(P.fx[d].amount * 2) }, { param: "filter.drive", from: 0, to: r3(P.filter.drive * 2) }]);
    else add(0.6, "DIRT", [{ param: "filter.drive", from: 0, to: 12 }]);
    const m = P.mods.findIndex((x) => x.src === "lfo1");
    if (m >= 0) add(1 + R.motion * 3.2, nm("motion", "WOBBLE"), [{ param: `mod.${m}.amt`, from: 0, to: r3(P.mods[m].amt * 2) }]);
    const mo = P.mods.findIndex((x) => x.src === "lfo2");
    if (mo >= 0) add(1 + R.morph * 2.5, nm("morph", "MORPH"), [{ param: `mod.${mo}.amt`, from: 0, to: r3(P.mods[mo].amt * 2) }]);
    const t = idx(P, "texture"), rv = idx(P, "reverb"), dl = idx(P, "delay");
    if (t >= 0) add(1 + R.shimmer * 3, nm("shimmer", "SKY"), [{ param: `fx.${t}.mix`, from: 0, to: r3(Math.min(1, P.fx[t].mix * 2)) }].concat(rv >= 0 ? [{ param: `fx.${rv}.mix`, from: 0, to: r3(Math.min(1, P.fx[rv].mix * 2)) }] : []));
    else if (rv >= 0) add(1 + R.space * 2.5, nm("space", "SPACE"), [{ param: `fx.${rv}.mix`, from: 0, to: r3(Math.min(1, P.fx[rv].mix * 2)) }]);
    if (dl >= 0) add(1 + R.echo * 2.2, nm("echo", "ECHO"), [{ param: `fx.${dl}.mix`, from: 0, to: r3(Math.min(1, P.fx[dl].mix * 2)) }, { param: `fx.${dl}.feedback`, from: 0.1, to: r3(Math.min(0.9, P.fx[dl].feedback * 2 - 0.1)) }]);
    add(0.8 + R.width * 1.5, nm("width", "WIDTH"), [{ param: "oscA.unison.detune", from: 0, to: r3(Math.max(10, (+((P.oscA && P.oscA.unison) || {}).detune || 0) * 2)) }]);
    if (R.weight > 0.5 && P.sub.on) add(0.8 + R.weight * 1.5, nm("weight", "SUB"), [{ param: "sub.level", from: 0, to: r3(Math.min(1, P.sub.level * 2)) }]);
    const cr = idx(P, "crush");
    if (cr >= 0) add(1 + R.crush * 2.5, nm("crush", "LO-FI"), [{ param: `fx.${cr}.mix`, from: 0, to: r3(Math.min(1, P.fx[cr].mix * 2)) }]);
    const ch = idx(P, "chorus");
    if (ch >= 0) add(1 + R.warble * 2.2, nm("warble", "WARBLE"), [{ param: `fx.${ch}.depth`, from: 0, to: r3(Math.min(1, P.fx[ch].depth * 2)) }, { param: `fx.${ch}.mix`, from: 0, to: r3(Math.min(1, P.fx[ch].mix * 2)) }]);
    if (R.res > 0.4) add(1 + R.res * 2.5, nm("res", "SQUELCH"), [{ param: "filter.res", from: 0, to: r3(Math.min(0.95, P.filter.res * 2)) }]);
    const ph = idx(P, "phaser");
    if (ph >= 0) add(1 + R.phaser * 2, nm("phaser", "SWIRL"), [{ param: `fx.${ph}.mix`, from: 0, to: r3(Math.min(1, P.fx[ph].mix * 2)) }]);
    if (P.voice.glide > 0) add(0.9 + R.glide * 1.8, nm("glide", "GLIDE"), [{ param: "voice.glide", from: r3(P.voice.glide / 4), to: r3(Math.min(1, P.voice.glide * 4)) }]);
    if (R.attack > 0.2) add(0.9 + R.attack * 2, nm("attack", "SWELL"), [{ param: "ampEnv.a", from: r3(Math.max(0.002, P.ampEnv.a / 4)), to: r3(Math.min(8, P.ampEnv.a * 4)) }]);
    add(0.5, "LENGTH", [{ param: "ampEnv.r", from: r3(Math.max(0.02, P.ampEnv.r / 4)), to: r3(Math.min(8, P.ampEnv.r * 4)) }]);
    cands.sort((a, b) => b.score - a.score);
    const seen = new Set(), out = [];
    for (const k of cands) {
      const name = !seen.has(k.name) ? k.name : !seen.has(k.alt) ? k.alt : null;
      if (!name) continue;
      seen.add(name); out.push({ name, value: 0.5, targets: k.targets });
      if (out.length === 4) break;
    }
    return out;
  }

  function lookFor(R) {
    const hue = R.mood === "evil" ? 5 : R.mood === "dark" ? 275 : R.mood === "dreamy" ? 205 : R.mood === "happy" ? 70 : R.dirt > 0.5 ? 350 : 280;
    return { style: R.shimmer > 0.3 || R.space > 0.5 ? "grain" : R.motion > 0.3 ? "waves" : R.dirt > 0.5 ? "chrome" : "liquid", hue, hue2: R.shimmer > 0.3 ? 70 : 275, seed: Math.floor(Math.random() * 1000) };
  }

  function nameFor(text, said) {
    const w = String(text || "").toUpperCase().replace(/[^A-Z0-9 /]+/g, " ").split(/\s+/).filter((x) => x.length > 2 && !/^(AND|WITH|THE|LIKE|THAT|FROM|INTO|SOUND|SYNTH|SLOWLY|SOME|VERY)$/.test(x));
    said = said.filter((x) => !/^NO /.test(x));
    return (said.slice(0, 3).join(" ") || w.slice(0, 3).join(" ") || "NEW SOUND").slice(0, 40);
  }

  // ---- listen and fix (first part: loudness) ----------------------------------------------------
  // render(preset) -> [L, R] Float32Arrays (any length, 44.1 or 48 kHz). Sets out.level so the playing
  // part sits at about -16 dB RMS with peaks under -1 dB, like the factory presets.
  function gatedDb(L, R) {
    const n = Math.min(L.length, R ? R.length : L.length), B = 1024, rs = [];
    let peak = 0;
    for (let i = 0; i + B <= n; i += B) {
      let e = 0;
      for (let j = i; j < i + B; j++) { const m = R ? 0.5 * (L[j] + R[j]) : L[j]; e += m * m; const a = Math.max(Math.abs(L[j]), R ? Math.abs(R[j]) : 0); if (a > peak) peak = a; }
      rs.push(Math.sqrt(e / B) + 1e-9);
    }
    if (!rs.length) return { rms: -120, peak: -120 };
    const top = Math.max(...rs), keep = rs.filter((r) => r > top * 0.0316);
    const rms = Math.sqrt(keep.reduce((a, r) => a + r * r, 0) / keep.length);
    return { rms: 20 * Math.log10(rms), peak: 20 * Math.log10(peak + 1e-9) };
  }
  async function level(p, render, target) {
    target = target == null ? -16 : target;
    for (let round = 0; round < 2; round++) {
      const out = await render(p); if (!out || !out[0]) return p;
      const m = gatedDb(out[0], out[1]);
      if (m.rms < -90) return p;
      let gain = target - m.rms;
      if (m.peak + gain > -1) gain = -1 - m.peak;
      if (Math.abs(gain) < 0.5) break;
      p.out.level = r3(clamp(p.out.level + gain, -40, 18));
    }
    return p;
  }

  // CREATE SOUND's offspring: the same recipe, pushed a little (j = 0..1) in a repeatable direction,
  // so A-D are siblings of one sound and WILDER goes further
  function jitter(R, j, seed) {
    let s = (seed * 9301 + 49297) % 233280;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 * 2 - 1; };
    const out = clone(R);
    for (const k of ["bright", "width", "res", "length", "release"]) out[k] = r3(clamp(out[k] + rnd() * 0.22 * j, 0, 1));
    for (const k of ["dirt", "motion", "morph", "echo", "space", "warble", "shimmer", "air"]) out[k] = r3(clamp(out[k] + Math.max(0, rnd()) * 0.35 * j + (out[k] > 0 ? rnd() * 0.15 * j : 0), 0, 1));
    if (j > 0.6 && !out.source) out.source = ["growl", "digital", "formant", "metal", "acid", "chip"][Math.floor((rnd() + 1) * 3) % 6];
    if (out.motion > 0.05 && !out.motionRate) out.motionRate = ["1/4", "1/8", "1/8t", "1/16"][Math.floor((rnd() + 1) * 2) % 4];
    return out;
  }

  async function make(text, opts) {
    opts = opts || {};
    const r = parse(text);
    if (opts.jitter) r.recipe = jitter(r.recipe, opts.jitter, opts.jitterSeed || 1);
    const p = build(r.recipe, { seed: opts.seed, strength: r.strength, keepSource: !!opts.keepSource });
    p.name = opts.name || nameFor(text, r.said);
    p.tags = ["prompt"].concat(r.said.map((s) => s.toLowerCase()));
    p.notes = "Made from the prompt: " + String(text || "").slice(0, 200);
    p.prompt = { text: String(text || ""), said: r.said, recipe: r.recipe };
    if (typeof opts.render === "function") { try { await level(p, opts.render, opts.target); } catch (e) { /* keep the measured trim */ } }
    return p;
  }


  // ---- WORD BALLS (CREATE SOUND, Eman 11 Nov) -------------------------------------------------
  // Any word becomes a ball in the circle: dragging it right = more of the word, up = the word moves
  // (breathes in time). Producer words come from LEX; things ("candy cane", "rust", "ocean") from
  // THINGS below, which say what a thing sounds like in dial moves; anything else gets a stable
  // surprise mix from the letters (the same word always gives the same sound).
  const THINGS = {
    "candy cane": { bright: 0.45, res: 0.25, shimmer: 0.35, fm: 0.35, length: -0.2 }, candy: { bright: 0.4, shimmer: 0.25, fm: 0.2, res: 0.15 },
    sugar: { bright: 0.35, shimmer: 0.3, air: 0.15 }, honey: { bright: -0.2, warble: 0.3, glide: 0.3, space: 0.15 }, syrup: { bright: -0.25, glide: 0.45, warble: 0.3 },
    glass: { bright: 0.4, fm: 0.4, res: 0.3, space: 0.25 }, crystal: { bright: 0.45, shimmer: 0.45, fm: 0.3 }, ice: { bright: 0.35, shimmer: 0.4, space: 0.3, warble: 0.1 },
    metal: { fm: 0.45, res: 0.35, dirt: 0.2 }, rust: { dirt: 0.45, crush: 0.3, bright: -0.15 }, chrome: { bright: 0.3, phaser: 0.35, fm: 0.25, width: 0.2 },
    gold: { bright: 0.2, warble: 0.2, width: 0.25, space: 0.2 }, silk: { bright: 0.1, air: 0.25, warble: 0.25, attack: 0.2 }, velvet: { bright: -0.25, warble: 0.2, attack: 0.15, width: 0.2 },
    smoke: { bright: -0.3, air: 0.3, space: 0.35, morph: 0.25 }, fog: { bright: -0.35, space: 0.4, air: 0.25 }, cloud: { bright: -0.15, space: 0.4, width: 0.35, attack: 0.2 },
    rain: { air: 0.4, echo: 0.3, space: 0.25 }, ocean: { air: 0.35, motion: 0.3, space: 0.4, width: 0.3 }, water: { phaser: 0.3, morph: 0.3, glide: 0.2 }, underwater: { bright: -0.45, warble: 0.35, phaser: 0.3, space: 0.3 },
    wind: { air: 0.5, morph: 0.3, space: 0.2 }, storm: { dirt: 0.35, air: 0.35, motion: 0.3, space: 0.3 }, thunder: { weight: 0.45, dirt: 0.35, space: 0.35 },
    fire: { dirt: 0.45, air: 0.25, bright: 0.15 }, lava: { dirt: 0.5, bright: -0.3, weight: 0.3, morph: 0.25 }, sun: { bright: 0.35, width: 0.3, shimmer: 0.2 },
    space: { space: 0.55, echo: 0.3, shimmer: 0.2 }, stars: { shimmer: 0.5, echo: 0.3, bright: 0.25 }, galaxy: { space: 0.5, shimmer: 0.35, morph: 0.3, width: 0.3 },
    alien: { fm: 0.4, morph: 0.4, warble: 0.3, glide: 0.25 }, robot: { crush: 0.35, fm: 0.3, gate: 0.3 }, laser: { glide: 0.5, res: 0.4, bright: 0.3 },
    ghost: { space: 0.45, air: 0.3, warble: 0.3, bright: -0.1 }, angel: { shimmer: 0.55, space: 0.4, bright: 0.25, attack: 0.25 }, demon: { dirt: 0.55, bright: -0.35, weight: 0.35 },
    toy: { crush: 0.3, bright: 0.25, length: -0.2, warble: 0.15 }, gameboy: { crush: 0.5, bright: 0.2, width: -0.3 }, "game boy": { crush: 0.5, bright: 0.2, width: -0.3 }, nintendo: { crush: 0.45, bright: 0.25 },
    cassette: { warble: 0.45, bright: -0.25, crush: 0.1 }, tape: { warble: 0.4, bright: -0.2, dirt: 0.15 }, vinyl: { air: 0.25, warble: 0.25, bright: -0.2 }, radio: { bright: -0.15, crush: 0.25, width: -0.35, air: 0.2 },
    phone: { bright: -0.1, crush: 0.3, width: -0.4, weight: -0.3 }, voicemail: { crush: 0.35, width: -0.4, weight: -0.35, air: 0.2 },
    church: { space: 0.6, shimmer: 0.2, attack: 0.2 }, cathedral: { space: 0.7, shimmer: 0.25, release: 0.3 }, cave: { space: 0.55, echo: 0.3, bright: -0.25 }, tunnel: { echo: 0.45, space: 0.3, bright: -0.2 },
    bubble: { res: 0.4, glide: 0.3, motion: 0.3, bright: 0.15 }, bubbles: { res: 0.4, glide: 0.3, motion: 0.35 }, dust: { air: 0.3, crush: 0.2, bright: -0.15 }, sand: { air: 0.4, crush: 0.2 },
    neon: { bright: 0.35, width: 0.35, dirt: 0.15, phaser: 0.2 }, heartbeat: { gate: 0.45, weight: 0.3, bright: -0.2 }, insect: { fm: 0.35, gate: 0.4, bright: 0.25 }, bee: { fm: 0.3, motion: 0.4, dirt: 0.2 },
    bird: { glide: 0.4, bright: 0.35, fm: 0.2 }, cat: { glide: 0.4, res: 0.35, motion: 0.2 }, monster: { weight: 0.45, dirt: 0.45, bright: -0.3, glide: 0.2 }, villain: { bright: -0.35, dirt: 0.35, weight: 0.3 },
    sweet: { bright: 0.25, shimmer: 0.25, dirt: -0.2 }, sour: { res: 0.35, fm: 0.25, bright: 0.2 }, bitter: { dirt: 0.3, res: 0.25, bright: -0.1 }, spicy: { dirt: 0.4, bright: 0.25, res: 0.2 },
    rubber: { glide: 0.35, res: 0.35, length: -0.15 }, elastic: { glide: 0.45, motion: 0.25 }, jelly: { warble: 0.4, glide: 0.25, motion: 0.25 }, slime: { morph: 0.45, glide: 0.3, bright: -0.2 },
    broken: { crush: 0.4, dirt: 0.3, gate: 0.2 }, glitch: { crush: 0.45, gate: 0.35, fm: 0.2 }, cursed: { warble: 0.4, dirt: 0.3, bright: -0.3, space: 0.2 }, haunted: { space: 0.45, warble: 0.35, bright: -0.25 },
  };
  const DIALS = ["bright", "weight", "dirt", "crush", "width", "attack", "length", "release", "res", "motion", "morph", "echo", "shimmer", "space", "warble", "glide", "air", "gate", "fm", "fold", "phaser"];
  const BLANK = blankRecipe();
  /** A word -> { name, moves: {dial: -1..1}, how: "lex" | "thing" | "surprise" }. */
  function wordMoves(word) {
    const w = String(word || "").toLowerCase().replace(/[^a-z0-9 \-]+/g, " ").replace(/\s+/g, " ").trim();
    const name = w.toUpperCase().slice(0, 14) || "WORD";
    if (!w) return { name, moves: {}, how: "none" };
    const stems = [w, w.replace(/ness$/, ""), w.replace(/iness$/, "y"), w.replace(/(ing|ed|er|y|s)$/, ""), w.replace(/ly$/, "")];
    for (const k of stems) if (THINGS[k]) return { name, moves: Object.assign({}, THINGS[k]), how: "thing" };
    for (const k of stems) {
      const r = parse(k).recipe, moves = {};
      for (const d of DIALS) { const v = (r[d] || 0) - (BLANK[d] || 0); if (Math.abs(v) > 0.04) moves[d] = r3(v); }
      if (r.motion > 0) moves.motion = Math.max(moves.motion || 0, r.motion);
      if (Object.keys(moves).length) return { name, moves, how: "lex" };
    }
    // a surprise, but always the same one for the same word
    let h = 2166136261;
    for (let i = 0; i < w.length; i++) { h ^= w.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    const pick = ["shimmer", "dirt", "morph", "warble", "fm", "echo", "crush", "glide", "space", "res", "air", "phaser"], moves = {};
    for (let i = 0; i < 3; i++) { const d = pick[(h >>> (i * 5)) % pick.length]; moves[d] = r3(0.25 + ((h >>> (i * 7 + 3)) % 100) / 300); }
    moves.bright = r3((((h >>> 13) % 100) - 50) / 160);
    return { name, moves, how: "surprise" };
  }
  // what each dial moves in a preset at full: [path, how far] (fx are added silent if missing)
  const BALL_FX = {
    drive: { type: "drive", mode: "tube", amount: 0, tone: 0.6, mix: 1 }, crush: { type: "crush", bits: 16, rate: 44100, mix: 0 },
    chorus: { type: "chorus", rate: 0.6, depth: 0.5, mix: 0, voices: 2 }, phaser: { type: "phaser", rate: 0.25, depth: 0.6, feedback: 0.5, mix: 0 },
    delay: { type: "delay", sync: "1/8d", feedback: 0.4, mix: 0, pingpong: true, tone: 0.5 }, texture: { type: "texture", mode: "shimmer", mix: 0 },
    reverb: { type: "reverb", size: 0.75, decay: 4, damp: 0.4, predelay: 0.02, mix: 0, mod: 0.4 },
  };
  function addWord(P, word) {
    const wm = wordMoves(word), m = wm.moves;
    P.fx = Array.isArray(P.fx) ? P.fx : []; P.mods = Array.isArray(P.mods) ? P.mods : []; P.macros = Array.isArray(P.macros) ? P.macros : []; P.pads = Array.isArray(P.pads) ? P.pads : [];
    const fxi = (type) => {
      let i = P.fx.findIndex((f) => f && f.type === type);
      if (i < 0 && P.fx.length < 8) { P.fx.push(clone(BALL_FX[type])); i = P.fx.length - 1; }
      return i;
    };
    const num = (path, dflt) => { let o = P; for (const k of path.split(".")) { if (o == null) return dflt; o = o[/^\d+$/.test(k) ? +k : k]; } return typeof o === "number" ? o : dflt; };
    const T = [], moveT = [];   // amount targets, movement targets
    const lin = (param, from, to) => T.push({ param, from: r3(from), to: r3(to) });
    const fxMix = (type, amt, field = "mix") => { const i = fxi(type); if (i < 0) return -1; const cur = +P.fx[i][field] || 0; lin(`fx.${type}.${field}`, cur, clamp(cur + amt, 0, 1)); return i; };   // by type: indices shift when presets change
    P.filter = P.filter || { on: true, type: "lp24", cutoff: 20000, res: 0.1 };
    for (const [d, v] of Object.entries(m)) {
      const a = Math.abs(v), up = v > 0;
      if (d === "bright") { if (!P.filter.on) { P.filter.on = true; P.filter.cutoff = 20000; } const c = +P.filter.cutoff || 8000; T.push({ param: "filter.cutoff", from: Math.round(c), to: Math.round(clamp(c * Math.pow(2, v * 5), 80, 20000)) }); }
      else if (d === "dirt" && up) { const i = fxi("drive"); if (i >= 0) { const cur = +P.fx[i].amount || 0; lin("fx.drive.amount", cur, cur + 30 * a); } }
      else if (d === "dirt") lin("filter.drive", num("filter.drive", 0), 0);
      else if (d === "crush" && up) { const i = fxMix("crush", a * 0.9); if (i >= 0) { P.fx[i].bits = Math.min(P.fx[i].bits || 16, 8); P.fx[i].rate = Math.min(P.fx[i].rate || 44100, 16000); } }
      else if (d === "shimmer" && up) { fxMix("texture", a * 0.6); fxMix("reverb", a * 0.35); }
      else if (d === "space") fxMix("reverb", v * 0.55);
      else if (d === "echo") fxMix("delay", v * 0.45);
      else if (d === "warble" && up) fxMix("chorus", a * 0.6);
      else if (d === "phaser" && up) fxMix("phaser", a * 0.7);
      else if (d === "width" && P.oscA) { P.oscA.unison = P.oscA.unison || { voices: 1, detune: 0, spread: 0, blend: 0.75 }; const v0 = +P.oscA.unison.voices || 1, d0 = +P.oscA.unison.detune || 0;
        if (up) { T.push({ param: "oscA.unison.voices", from: v0, to: Math.max(v0, 7) }); lin("oscA.unison.detune", d0, d0 + 35 * a); } else lin("oscA.unison.detune", d0, d0 * (1 - a)); }
      else if (d === "weight" && up) { P.sub = Object.assign({ shape: "sine", oct: -1, filter: false }, P.sub || {}); if (!P.sub.on) { P.sub.on = true; P.sub.level = 0; } lin("sub.level", +P.sub.level || 0, clamp((+P.sub.level || 0) + 0.6 * a, 0, 1)); }
      else if (d === "air" && up) { P.noise = Object.assign({ color: 0.4, grain: 0, pitch: 0, filter: true }, P.noise || {}); if (!P.noise.on) { P.noise.on = true; P.noise.level = 0; } lin("noise.level", +P.noise.level || 0, clamp((+P.noise.level || 0) + 0.3 * a, 0, 1)); }
      else if (d === "res") lin("filter.res", num("filter.res", 0.1), clamp(num("filter.res", 0.1) + v * 0.6, 0, 0.92));
      else if (d === "glide") { P.voice = P.voice || {}; lin("voice.glide", +P.voice.glide || 0, clamp((+P.voice.glide || 0) + v * 0.25, 0, 1)); }
      else if (d === "attack" && P.ampEnv) T.push({ param: "ampEnv.a", from: Math.max(0.002, +P.ampEnv.a || 0.002), to: r3(clamp((+P.ampEnv.a || 0.002) * Math.pow(2, v * 8), 0.002, 6)) });
      else if ((d === "release" || d === "length") && P.ampEnv) T.push({ param: "ampEnv.r", from: Math.max(0.02, +P.ampEnv.r || 0.2), to: r3(clamp((+P.ampEnv.r || 0.2) * Math.pow(2, v * 4), 0.02, 8)) });
      else if (d === "fm" && up && P.oscA) { P.oscA.warp = P.oscA.warp && P.oscA.warp.type !== "none" ? P.oscA.warp : { type: "fm", amount: 0 }; lin("oscA.warp.amount", +P.oscA.warp.amount || 0, clamp((+P.oscA.warp.amount || 0) + 0.6 * a, 0, 1)); }
      else if (d === "fold" && up && P.oscA) { P.oscA.warp = P.oscA.warp && P.oscA.warp.type !== "none" ? P.oscA.warp : { type: "fold", amount: 0 }; lin("oscA.warp.amount", +P.oscA.warp.amount || 0, clamp((+P.oscA.warp.amount || 0) + 0.6 * a, 0, 1)); }
      else if ((d === "motion" || d === "gate") && up) { P.lfo1 = P.lfo1 || { shape: "sine", rate: 2, sync: "1/8", retrig: true, phase: 0.75 }; if (!P.lfo1.sync) P.lfo1.sync = d === "gate" ? "1/16" : "1/8";
        P.mods.push({ src: "lfo1", dst: d === "gate" ? "amp" : "filter.cutoff", amt: 0 }); lin(`mod.${P.mods.length - 1}.amt`, 0, d === "gate" ? -0.7 * a : 3 * a); }
      else if (d === "morph" && up) { P.mods.push({ src: "lfo2", dst: "oscA.pos", amt: 0 }); lin(`mod.${P.mods.length - 1}.amt`, 0, 0.5 * a); }
    }
    if (!T.length) lin("filter.res", num("filter.res", 0.1), clamp(num("filter.res", 0.1) + 0.3, 0, 0.9));   // never a dead ball
    // up = the word moves: a slow wave rides on its first effect (or the filter)
    P.lfo2 = P.lfo2 && P.lfo2.sync ? P.lfo2 : Object.assign({ shape: "sine", rate: 0.25, retrig: false, phase: 0 }, P.lfo2 || {}, { sync: "1/2" });
    const first = T.find((t) => /^fx\.[a-z]+\.(mix|amount)$/.test(t.param));
    const dst = first ? first.param : "filter.cutoff";
    const span = first ? Math.abs(first.to - first.from) * 0.6 : 1.5;
    P.mods.push({ src: "lfo2", dst, amt: 0 }); moveT.push({ param: `mod.${P.mods.length - 1}.amt`, from: 0, to: r3(span) });
    // room: two macros and a point (the oldest ball goes when it's full; then silent core points)
    while (P.macros.length > 14) {
      const old = P.macros.findIndex((x) => x && x.ball);
      if (old < 0) break;
      removeBall(P, P.macros[old].ball);
    }
    if (P.macros.length > 14) P.macros = P.macros.slice(0, 14);
    const id = "b" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const ix = P.macros.length;
    // a macro's targets start from the sound as it is (0 = as it was); the ball lands at 40% so you hear it at once
    P.macros.push({ name: wm.name, value: 0.4, targets: T, ball: id }, { name: wm.name + " MOVE", value: 0, targets: moveT, ball: id });
    while (P.pads.length >= 8) { const k = P.pads.map((q) => !!q.core).lastIndexOf(true); if (k < 0) break; P.pads.splice(k, 1); }
    P.pads.push({ kind: "macro", x: ix, y: ix + 1, ball: id, word: wm.name });
    P.balls = (P.balls || []).concat([{ id, word: wm.name, how: wm.how, moves: m }]);
    return { id, name: wm.name, how: wm.how, moves: m };
  }
  function removeBall(P, id) {
    const keep = [], remap = {};
    (P.macros || []).forEach((x, i) => { if (x.ball === id) return; remap[i] = keep.length; keep.push(x); });
    P.macros = keep;
    P.pads = (P.pads || []).filter((q) => q.ball !== id).map((q) => (q.kind === "macro" ? Object.assign({}, q, { x: remap[q.x] != null ? remap[q.x] : 0, y: remap[q.y] != null ? remap[q.y] : 0 }) : q));
    P.balls = (P.balls || []).filter((b) => b.id !== id);
  }

  const api = { make, parse, build, level, gatedDb, jitter, wordMoves, addWord, removeBall, THINGS, LEX, version: 3 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ToyMachinePrompt = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
