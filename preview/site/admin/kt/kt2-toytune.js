// TOYTUNE in KILLTOY 2 (Eman, 16 Nov 2026): the glue between the window (ui/toytune.js), the card (p.tt on a
// kttoytune effect) and the engine (playground/toytune-engine.js). Also the vocal presets and the FX prompt
// ("travis scott type vocal mixed with slipknot"): words -> a blend of mix recipes, all here, no server.
// KT2_TOYTUNE_OFF = not offered (old sessions with one play it dry).
// ASCII only.
(function () {
  "use strict";
  if (window.KT2_TOYTUNE_OFF) return;
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const CHOIRS = ["double", "thirds", "power", "octaves", "gospel", "angel", "dark", "chords"];
  const VOCS = ["classic", "robot", "talkbox", "chord", "whisper", "digital", "choirpad", "sub"];
  const CARRIERS = ["midi", "chords", "voice"];
  const TRIGS = ["always", "gaps", "ends", "duck"];
  const VOICES = ["HIGH", "MID", "LOW", "BASS"];
  // knob spots for stepped choices (see MOD_KNOBS in ui/toytune.js)
  const KIND = { tape: 0.1, tube: 0.3, fuzz: 0.5, scream: 0.7, radio: 0.9 };
  const TIME = { "1/16": 0.05, "1/8": 0.2, "1/8.": 0.4, "1/4": 0.55, "1/4.": 0.75, "1/2": 0.95 };

  const clone = (x) => JSON.parse(JSON.stringify(x));
  function fresh(key) {
    const S = window.ToyTuneUI ? ToyTuneUI.defaults() : {};
    if (key && key.tonic != null) { S.key = key.tonic; S.scale = key.minor ? 1 : 0; }
    S.choir.on = false; S.vocoder.on = false;
    return S;
  }

  // the window's state -> engine settings (ids in Source/dsp/toytune/ToyTuneParams.h)
  function values(S) {
    const v = {}, T = S.tune || {}, C = S.choir || {}, V = S.vocoder || {}, F = S.fx || {}, P = S.prefs || {};
    v.key = S.key; v.scale = S.scale; v.custom = S.custom == null ? -1 : S.custom; v.midi = S.midi ? 1 : 0; v.bypass = S.bypass ? 1 : 0;
    v["tune.on"] = T.on === false ? 0 : 1;
    for (const k of ["speed", "human", "flex", "formant"]) v["tune." + k] = T[k];
    v["tune.vibrato"] = T.vibrato ? 1 : 0; v["tune.breath"] = T.breath ? 1 : 0; v["tune.noflip"] = T.noflip ? 1 : 0; v["tune.chordtones"] = T.chordtones ? 1 : 0;
    v["choir.on"] = C.on ? 1 : 0; v["choir.mode"] = Math.max(0, CHOIRS.indexOf(C.mode));
    for (const k of ["voices", "width", "loose", "mix"]) v["choir." + k] = C[k];
    v["vocoder.on"] = V.on ? 1 : 0; v["vocoder.mode"] = Math.max(0, VOCS.indexOf(V.mode)); v["vocoder.carrier"] = Math.max(0, CARRIERS.indexOf(V.carrier));
    for (const k of ["bands", "tone", "glide", "mix"]) v["vocoder." + k] = V[k];
    for (const m of ["gate", "eq", "comp", "drive", "double", "delay", "verb"]) {
      v["fx." + m + ".on"] = F.on && F.on[m] ? 1 : 0;
      const kn = (F.knobs && F.knobs[m]) || {};
      for (const k in kn) v["fx." + m + "." + (m === "comp" && k === "deess" ? "deess" : k)] = kn[k];
    }
    v["fx.comp.deess"] = F.knobs && F.knobs.comp ? F.knobs.comp.deess : 0.4;
    v["fx.delay.trig"] = Math.max(0, TRIGS.indexOf((F.trig || {}).delay || "always"));
    v["fx.verb.trig"] = Math.max(0, TRIGS.indexOf((F.trig || {}).verb || "always"));
    v["fx.mix"] = F.mix == null ? 1 : F.mix;
    v.out = 0;
    v["prefs.voice"] = Math.max(0, VOICES.indexOf(P.voice || "MID")); v["prefs.mode"] = P.mode === "STUDIO" ? 1 : 0; v["prefs.a4"] = P.a4 || 440;
    return v;
  }

  // the card's 3 knobs (Speed, Choir, FX) <-> the window's state
  const speedText = (v) => (v >= 0.99 ? "0ms" : Math.round(400 * Math.pow(10, -2.6 * v)) + "ms");
  function cardSet(p, node, pid, v) {
    const S = p.tt || (p.tt = fresh());
    if (pid === "speed") { S.tune.speed = v; node.set("tune.speed", v); return speedText(v); }
    if (pid === "choir") { S.choir.mix = v; S.choir.on = v > 0.01; node.set("choir.mix", v); node.set("choir.on", S.choir.on ? 1 : 0); return S.choir.on ? Math.round(v * 100) + "%" : "OFF"; }
    if (pid === "fx") { S.fx.mix = v; node.set("fx.mix", v); return Math.round(v * 100) + "%"; }
    return null;
  }
  function syncCard(p) {
    const S = p.tt;
    if (!S || !p.params) return;
    for (const q of p.params) {
      if (q.id === "speed") { q.value = S.tune.speed; q.text = speedText(S.tune.speed); }
      if (q.id === "choir") { q.value = S.choir.on ? S.choir.mix : 0; q.text = S.choir.on ? Math.round(S.choir.mix * 100) + "%" : "OFF"; }
      if (q.id === "fx") { q.value = S.fx.mix == null ? 1 : S.fx.mix; q.text = Math.round(q.value * 100) + "%"; }
    }
  }

  // ------------------------------------------------------------------ mix recipes
  // Each recipe is how that sound is usually made (engineer interviews, tutorials, forum breakdowns; see
  // docs/TOYTUNE-STYLES.md for the notes and sources). Values are the window's 0..1 knobs. Words pick them.
  const R = (o) => o;
  const RECIPES = [
    // ---- trap / melodic rap
    R({ id: "astro", name: "ASTRO HAZE", words: ["travis", "travis scott", "la flame", "astroworld", "utopia", "rodeo", "cactus jack"],
      tune: { speed: 0.96, human: 0.08, vibrato: false, formant: 0.5 },
      on: { gate: true, eq: true, comp: true, drive: true, double: true, delay: true, verb: true },
      knobs: { eq: { low: 0.4, body: 0.45, presence: 0.62, air: 0.72 }, comp: { amount: 0.62, speed: 0.6, deess: 0.45 }, drive: { amount: 0.22, kind: KIND.tape, tone: 0.55, mix: 0.6 },
        double: { amount: 0.35, width: 0.95, tight: 0.55 }, delay: { mix: 0.34, time: TIME["1/4"], feedback: 0.48, tone: 0.5 }, verb: { mix: 0.32, size: 0.82, tone: 0.45 } },
      trig: { delay: "gaps", verb: "always" }, choir: { on: true, mode: "double", mix: 0.22 } }),
    R({ id: "syrup", name: "SYRUP", words: ["future", "pluto", "hendrix", "codeine", "syrup", "seth firkins"],
      tune: { speed: 1, human: 0, vibrato: false },
      on: { gate: true, eq: true, comp: true, drive: false, double: false, delay: true, verb: true },
      knobs: { eq: { low: 0.4, body: 0.48, presence: 0.58, air: 0.6 }, comp: { amount: 0.6, speed: 0.55, deess: 0.4 },
        delay: { mix: 0.24, time: TIME["1/4"], feedback: 0.38, tone: 0.55 }, verb: { mix: 0.24, size: 0.6, tone: 0.5 } },
      trig: { delay: "always", verb: "always" } }),
    R({ id: "rage", name: "RAGE FUZZ", words: ["carti", "playboi carti", "ken carson", "destroy lonely", "opium", "rage", "homixide", "whole lotta red", "vamp"],
      tune: { speed: 1, human: 0, vibrato: false, formant: 0.58 },
      on: { gate: true, eq: true, comp: true, drive: true, double: true, delay: true, verb: true },
      knobs: { eq: { low: 0.5, body: 0.42, presence: 0.66, air: 0.78 }, comp: { amount: 0.8, speed: 0.85, deess: 0.35 }, drive: { amount: 0.48, kind: KIND.fuzz, tone: 0.65, mix: 0.7 },
        double: { amount: 0.3, width: 0.9, tight: 0.8 }, delay: { mix: 0.18, time: TIME["1/8"], feedback: 0.3, tone: 0.4 }, verb: { mix: 0.14, size: 0.35, tone: 0.4 } },
      trig: { delay: "ends", verb: "always" } }),
    R({ id: "melo", name: "MELO LEAD", words: ["don toliver", "toliver", "juice wrld", "juice", "lil uzi", "uzi", "melodic", "melody"],
      tune: { speed: 0.86, human: 0.15, vibrato: true },
      on: { gate: true, eq: true, comp: true, drive: false, double: true, delay: true, verb: true },
      knobs: { eq: { low: 0.38, body: 0.47, presence: 0.6, air: 0.7 }, comp: { amount: 0.58, speed: 0.55, deess: 0.45 },
        double: { amount: 0.32, width: 0.85, tight: 0.6 }, delay: { mix: 0.27, time: TIME["1/8."], feedback: 0.42, tone: 0.45 }, verb: { mix: 0.33, size: 0.78, tone: 0.4 } },
      trig: { delay: "gaps", verb: "always" } }),
    R({ id: "thug", name: "SLIME", words: ["young thug", "thug", "gunna", "lil baby", "slime"],
      tune: { speed: 0.78, human: 0.3, vibrato: true },
      on: { gate: true, eq: true, comp: true, drive: false, double: false, delay: true, verb: true },
      knobs: { comp: { amount: 0.6, speed: 0.6, deess: 0.45 }, delay: { mix: 0.18, time: TIME["1/8."], feedback: 0.3, tone: 0.5 }, verb: { mix: 0.2, size: 0.55, tone: 0.45 } },
      trig: { delay: "duck", verb: "always" } }),
    R({ id: "savage", name: "COLD DRY", words: ["21 savage", "savage", "drill", "dry", "upfront", "in your face"],
      tune: { speed: 0.5, human: 0.4, formant: 0.47 },
      on: { gate: true, eq: true, comp: true, drive: true, double: false, delay: true, verb: true },
      knobs: { eq: { low: 0.42, body: 0.52, presence: 0.62, air: 0.52 }, comp: { amount: 0.72, speed: 0.75, deess: 0.45 }, drive: { amount: 0.15, kind: KIND.tube, mix: 0.5 },
        delay: { mix: 0.1, time: TIME["1/8"], feedback: 0.2, tone: 0.6 }, verb: { mix: 0.08, size: 0.3, tone: 0.6 } },
      trig: { delay: "ends", verb: "always" } }),
    R({ id: "tpain", name: "ROBOT SNAP", words: ["t-pain", "t pain", "tpain", "808s", "robot", "robotic", "hard tune", "autotune"],
      tune: { speed: 1, human: 0, vibrato: false, noflip: false },
      on: { delay: true, verb: true }, knobs: { delay: { mix: 0.15, time: TIME["1/8"], feedback: 0.25 }, verb: { mix: 0.2, size: 0.55 } } }),
    R({ id: "phonk", name: "TAPE ROT", words: ["suicideboys", "uicideboy", "$uicideboy$", "phonk", "memphis", "lofi", "lo-fi", "tape", "old school"],
      tune: { speed: 0.5, human: 0.3, formant: 0.46 },
      on: { gate: true, eq: true, comp: true, drive: true, double: false, delay: true, verb: true },
      knobs: { eq: { low: 0.6, body: 0.55, presence: 0.5, air: 0.3 }, comp: { amount: 0.7, speed: 0.5, deess: 0.3 }, drive: { amount: 0.5, kind: KIND.tape, tone: 0.3, mix: 0.8 },
        delay: { mix: 0.2, time: TIME["1/8"], feedback: 0.4, tone: 0.8 }, verb: { mix: 0.25, size: 0.5, tone: 0.8 } },
      trig: { delay: "ends", verb: "always" } }),
    R({ id: "emo", name: "EMO TAPE", words: ["lil peep", "peep", "emo", "xxxtentacion", "x", "sad", "heartbreak"],
      tune: { speed: 0.8, human: 0.2 },
      on: { gate: true, eq: true, comp: true, drive: true, double: true, delay: true, verb: true },
      knobs: { drive: { amount: 0.3, kind: KIND.tape, tone: 0.45, mix: 0.6 }, double: { amount: 0.4, width: 0.85, tight: 0.5 },
        delay: { mix: 0.22, time: TIME["1/4"], feedback: 0.4, tone: 0.6 }, verb: { mix: 0.36, size: 0.75, tone: 0.55 } },
      trig: { delay: "gaps", verb: "always" } }),
    // ---- r&b / pop
    R({ id: "weeknd", name: "NIGHT DRIVE", words: ["weeknd", "the weeknd", "abel", "after hours", "80s", "retro", "synthwave"],
      tune: { speed: 0.55, human: 0.35, vibrato: true },
      on: { gate: true, eq: true, comp: true, drive: false, double: true, delay: true, verb: true },
      knobs: { eq: { low: 0.38, body: 0.45, presence: 0.6, air: 0.78 }, comp: { amount: 0.6, speed: 0.5, deess: 0.5 }, double: { amount: 0.28, width: 0.75, tight: 0.7 },
        delay: { mix: 0.26, time: TIME["1/4"], feedback: 0.45, tone: 0.35 }, verb: { mix: 0.38, size: 0.92, tone: 0.3 } },
      trig: { delay: "always", verb: "always" } }),
    R({ id: "drake", name: "UNDERWATER", words: ["drake", "40", "noah 40", "ovo", "partynextdoor", "pnd", "moody", "underwater", "muffled"],
      tune: { speed: 0.45, human: 0.4, vibrato: true },
      on: { gate: true, eq: true, comp: true, drive: false, double: false, delay: true, verb: true },
      knobs: { eq: { low: 0.48, body: 0.55, presence: 0.45, air: 0.38 }, comp: { amount: 0.6, speed: 0.45, deess: 0.5 },
        delay: { mix: 0.12, time: TIME["1/4"], feedback: 0.3, tone: 0.8 }, verb: { mix: 0.26, size: 0.7, tone: 0.82 } },
      trig: { delay: "duck", verb: "always" } }),
    R({ id: "silk", name: "R&B SILK", words: ["r&b", "rnb", "sza", "brent faiyaz", "silk", "smooth", "frank ocean", "frank"],
      tune: { speed: 0.5, human: 0.45, vibrato: true },
      on: { gate: true, eq: true, comp: true, drive: false, double: true, delay: true, verb: true },
      knobs: { eq: { low: 0.36, body: 0.5, presence: 0.58, air: 0.74 }, comp: { amount: 0.55, speed: 0.45, deess: 0.55 }, double: { amount: 0.22, width: 0.7, tight: 0.75 },
        delay: { mix: 0.16, time: TIME["1/8."], feedback: 0.35, tone: 0.5 }, verb: { mix: 0.3, size: 0.65, tone: 0.45 } },
      trig: { delay: "duck", verb: "always" } }),
    R({ id: "pop", name: "POP SHINE", words: ["pop", "ariana", "dua lipa", "taylor", "radio", "shiny", "bright", "polished"],
      tune: { speed: 0.62, human: 0.35, vibrato: true },
      on: { gate: true, eq: true, comp: true, drive: false, double: true, delay: true, verb: true },
      knobs: { eq: { low: 0.4, body: 0.46, presence: 0.64, air: 0.84 }, comp: { amount: 0.65, speed: 0.6, deess: 0.6 }, double: { amount: 0.2, width: 0.7, tight: 0.8 },
        delay: { mix: 0.12, time: TIME["1/8"], feedback: 0.28, tone: 0.35 }, verb: { mix: 0.24, size: 0.6, tone: 0.3 } },
      trig: { delay: "duck", verb: "always" } }),
    R({ id: "clean", name: "STUDIO CLEAN", words: ["clean", "natural", "studio", "subtle", "transparent", "raw"],
      tune: { speed: 0.4, human: 0.5, vibrato: true, flex: 0.3 },
      on: { gate: true, eq: true, comp: true, drive: false, double: false, delay: false, verb: true },
      knobs: { eq: { low: 0.36, body: 0.5, presence: 0.56, air: 0.62 }, comp: { amount: 0.5, speed: 0.55, deess: 0.45 }, verb: { mix: 0.12, size: 0.45, tone: 0.45 } } }),
    R({ id: "billie", name: "BEDROOM", words: ["billie", "billie eilish", "finneas", "bedroom", "intimate", "close", "soft", "whisper", "breathy"],
      tune: { speed: 0.3, human: 0.6, vibrato: true, flex: 0.4 },
      on: { gate: false, eq: true, comp: true, drive: false, double: false, delay: false, verb: true },
      knobs: { eq: { low: 0.3, body: 0.56, presence: 0.5, air: 0.66 }, comp: { amount: 0.68, speed: 0.35, deess: 0.65 }, verb: { mix: 0.16, size: 0.35, tone: 0.55 } } }),
    R({ id: "kanye", name: "RADIO READY", words: ["kanye", "ye", "yeezy", "punchy", "loud", "hard"],
      tune: { speed: 0.6, human: 0.3 },
      on: { gate: true, eq: true, comp: true, drive: true, double: false, delay: true, verb: true },
      knobs: { eq: { low: 0.45, body: 0.5, presence: 0.66, air: 0.6 }, comp: { amount: 0.75, speed: 0.7, deess: 0.45 }, drive: { amount: 0.25, kind: KIND.tube, tone: 0.5, mix: 0.6 },
        delay: { mix: 0.12, time: TIME["1/4"], feedback: 0.25, tone: 0.55 }, verb: { mix: 0.15, size: 0.5, tone: 0.5 } },
      trig: { delay: "ends", verb: "always" } }),
    R({ id: "cudi", name: "MOON HUM", words: ["kid cudi", "cudi", "hum", "humming", "space", "spacey", "dreamy", "ethereal"],
      tune: { speed: 0.7, human: 0.3 },
      on: { delay: true, verb: true, double: true },
      knobs: { double: { amount: 0.3, width: 0.9 }, delay: { mix: 0.3, time: TIME["1/4."], feedback: 0.55, tone: 0.5 }, verb: { mix: 0.45, size: 0.95, tone: 0.45 } },
      trig: { delay: "gaps", verb: "always" }, choir: { on: true, mode: "octaves", mix: 0.25 } }),
    R({ id: "adlib", name: "AD-LIB THROW", words: ["adlib", "ad-lib", "ad lib", "adlibs", "throw", "echo", "echoes"],
      tune: { speed: 0.9, human: 0.1 },
      on: { gate: true, eq: true, comp: true, drive: true, double: false, delay: true, verb: true },
      knobs: { eq: { low: 0.6, body: 0.4, presence: 0.66, air: 0.7 }, comp: { amount: 0.8, speed: 0.8, deess: 0.4 }, drive: { amount: 0.3, kind: KIND.radio, tone: 0.6, mix: 0.4 },
        delay: { mix: 0.42, time: TIME["1/4."], feedback: 0.5, tone: 0.5 }, verb: { mix: 0.3, size: 0.8, tone: 0.45 } },
      trig: { delay: "ends", verb: "ends" } }),
    // ---- rock / metal / weird
    R({ id: "metal", name: "SCREAM", words: ["slipknot", "corey taylor", "metal", "scream", "screaming", "screamo", "deathcore", "hardcore", "growl", "korn", "linkin park", "nu metal", "nu-metal"],
      tune: { speed: 0.2, human: 0.6, flex: 0.6, breath: true },
      on: { gate: true, eq: true, comp: true, drive: true, double: true, delay: true, verb: true },
      knobs: { eq: { low: 0.48, body: 0.56, presence: 0.7, air: 0.55 }, comp: { amount: 0.88, speed: 0.9, deess: 0.3 }, drive: { amount: 0.7, kind: KIND.scream, tone: 0.55, mix: 0.55 },
        double: { amount: 0.6, width: 0.9, tight: 0.85 }, delay: { mix: 0.08, time: TIME["1/8"], feedback: 0.2, tone: 0.6 }, verb: { mix: 0.14, size: 0.4, tone: 0.55 } },
      trig: { delay: "ends", verb: "always" } }),
    R({ id: "rock", name: "ARENA", words: ["rock", "punk", "grunge", "arena", "live", "band"],
      tune: { speed: 0.35, human: 0.5, flex: 0.4 },
      on: { gate: true, eq: true, comp: true, drive: true, double: true, delay: true, verb: true },
      knobs: { comp: { amount: 0.75, speed: 0.75, deess: 0.4 }, drive: { amount: 0.35, kind: KIND.tube, mix: 0.5 }, double: { amount: 0.35, width: 0.8, tight: 0.8 },
        delay: { mix: 0.14, time: TIME["1/8."], feedback: 0.3 }, verb: { mix: 0.22, size: 0.75, tone: 0.45 } } }),
    R({ id: "demon", name: "DEMON", words: ["demon", "evil", "villain", "villainous", "devil", "dark voice", "monster", "deep voice"],
      tune: { speed: 0.9, formant: 0.25 },
      on: { drive: true, verb: true, delay: true },
      knobs: { drive: { amount: 0.4, kind: KIND.tape, tone: 0.35, mix: 0.7 }, delay: { mix: 0.15, time: TIME["1/4"], feedback: 0.35, tone: 0.8 }, verb: { mix: 0.3, size: 0.8, tone: 0.85 } },
      choir: { on: true, mode: "dark", mix: 0.5 } }),
    R({ id: "phone", name: "TELEPHONE", words: ["telephone", "phone", "radio voice", "walkie", "intro voice"],
      on: { drive: true, eq: true }, knobs: { drive: { amount: 0.5, kind: KIND.radio, tone: 0.6, mix: 1 }, eq: { low: 0.8, air: 0.3 }, verb: { mix: 0.1 } } }),
    R({ id: "mega", name: "MEGAPHONE", words: ["megaphone", "bullhorn", "distorted", "blown out", "crushed"],
      on: { drive: true }, knobs: { drive: { amount: 0.8, kind: KIND.radio, tone: 0.7, mix: 1 }, comp: { amount: 0.85, speed: 0.9 } } }),
    R({ id: "daft", name: "DAFT", words: ["daft punk", "daft", "vocoder", "robot voice", "talkbox", "roger troutman", "zapp"],
      tune: { speed: 1 }, vocoder: { on: true, mode: "classic", mix: 0.9 }, on: { verb: true, delay: true }, knobs: { verb: { mix: 0.2 }, delay: { mix: 0.15, time: TIME["1/8."] } } }),
    R({ id: "prism", name: "PRISM", words: ["bon iver", "prismizer", "francis", "chance", "choir", "gospel", "harmony", "harmonies", "stacked", "stack"],
      tune: { speed: 0.85 }, choir: { on: true, mode: "gospel", mix: 0.6 }, on: { verb: true, delay: true }, knobs: { verb: { mix: 0.35, size: 0.85 }, delay: { mix: 0.12 } } }),
    R({ id: "angel", name: "ANGEL VERB", words: ["angel", "angelic", "heaven", "heavenly", "airy", "air"],
      tune: { speed: 0.7 }, choir: { on: true, mode: "angel", mix: 0.35 }, on: { verb: true, delay: true },
      knobs: { eq: { air: 0.85 }, verb: { mix: 0.5, size: 0.95, tone: 0.25 }, delay: { mix: 0.2, time: TIME["1/4."], feedback: 0.5, tone: 0.3 } } }),
    R({ id: "chip", name: "CHIPMUNK", words: ["chipmunk", "baby voice", "high pitched", "pitched up", "kid voice"], tune: { speed: 0.9, formant: 0.75 } }),
  ];

  // words that nudge any blend (applied after the artists)
  const NUDGES = [
    [/\bdark(er)?\b|\bmoody\b|\bgloomy\b/, (S) => { bump(S, "fx.knobs.eq.air", -0.15); bump(S, "fx.knobs.verb.tone", 0.2); bump(S, "fx.knobs.delay.tone", 0.2); }],
    [/\bbright(er)?\b|\bcrisp\b|\bairy\b/, (S) => { bump(S, "fx.knobs.eq.air", 0.15); bump(S, "fx.knobs.eq.presence", 0.06); }],
    [/\bwet\b|\bwetter\b|\bspac(e|ey|ious)\b|\bbig\b|\bhuge\b/, (S) => { bump(S, "fx.knobs.verb.mix", 0.12); bump(S, "fx.knobs.delay.mix", 0.08); S.fx.on.verb = true; }],
    [/\bdry\b|\bdrier\b|\bupfront\b|\btight\b/, (S) => { bump(S, "fx.knobs.verb.mix", -0.12); bump(S, "fx.knobs.delay.mix", -0.1); }],
    [/\bwide\b|\bwider\b|\bstereo\b/, (S) => { S.fx.on.double = true; bump(S, "fx.knobs.double.amount", 0.15); bump(S, "fx.knobs.double.width", 0.2); }],
    [/\bdist(orted|ortion)?\b|\bdirty\b|\bgritty\b|\bgrit\b|\bfuzz\b|\bsaturat/, (S) => { S.fx.on.drive = true; bump(S, "fx.knobs.drive.amount", 0.2); }],
    [/\bclean(er)?\b/, (S) => { bump(S, "fx.knobs.drive.amount", -0.3); if (S.fx.knobs.drive.amount < 0.05) S.fx.on.drive = false; }],
    [/\bhard(er)?\b|\bsnap\b/, (S) => { S.tune.speed = Math.max(S.tune.speed, 0.95); }],
    [/\bnatural\b|\bsubtle\b|\bgentle\b/, (S) => { S.tune.speed = Math.min(S.tune.speed, 0.45); bump(S, "tune.human", 0.2); }],
    [/\bdelay\b|\becho(es)?\b/, (S) => { S.fx.on.delay = true; bump(S, "fx.knobs.delay.mix", 0.1); }],
    [/\bafter\b|\bbetween\b|\bgaps?\b/, (S) => { S.fx.trig.delay = "gaps"; }],
    [/\bdeep(er)?\b|\blow(er)?\b/, (S) => { bump(S, "tune.formant", -0.1); }],
    [/\bhigh(er)?\b|\bthin\b/, (S) => { bump(S, "tune.formant", 0.08); }],
    [/\bdouble(d)?\b|\bdoubles\b/, (S) => { S.fx.on.double = true; bump(S, "fx.knobs.double.amount", 0.2); }],
  ];
  function bump(S, path, d) {
    const ks = path.split("."), last = ks.pop();
    let o = S;
    for (const k of ks) o = o[k] = o[k] || {};
    o[last] = Math.max(0, Math.min(1, (o[last] == null ? 0.5 : o[last]) + d));
  }

  // blend recipes by weight into a full state
  function blend(base, picks) {
    const S = clone(base);
    const tot = picks.reduce((a, x) => a + x.w, 0) || 1;
    const num = (get, set) => { let s = 0, w = 0; for (const { r, w: k } of picks) { const v = get(r); if (v != null) { s += v * k; w += k; } } if (w) set(s / w); };
    for (const k of ["speed", "human", "flex", "formant"]) num((r) => r.tune && r.tune[k], (v) => (S.tune[k] = v));
    for (const k of ["vibrato", "breath", "noflip"]) { let s = 0, w = 0; for (const { r, w: q } of picks) if (r.tune && r.tune[k] != null) { s += (r.tune[k] ? 1 : 0) * q; w += q; } if (w) S.tune[k] = s / w >= 0.5; }
    for (const m of ["gate", "eq", "comp", "drive", "double", "delay", "verb"]) {
      let s = 0, w = 0;
      for (const { r, w: q } of picks) if (r.on && r.on[m] != null) { s += (r.on[m] ? 1 : 0) * q; w += q; }
      if (w) S.fx.on[m] = s / w >= 0.5;
      for (const k of Object.keys(S.fx.knobs[m])) num((r) => r.knobs && r.knobs[m] && r.knobs[m][k], (v) => (S.fx.knobs[m][k] = v));
    }
    // stepped choices come from the strongest recipe that has one
    const top = (get) => { let best = null, bw = -1; for (const { r, w } of picks) { const v = get(r); if (v != null && w > bw) { best = v; bw = w; } } return best; };
    const dk = top((r) => r.knobs && r.knobs.drive && r.knobs.drive.kind); if (dk != null) S.fx.knobs.drive.kind = dk;
    const dt = top((r) => r.knobs && r.knobs.delay && r.knobs.delay.time); if (dt != null) S.fx.knobs.delay.time = dt;
    for (const m of ["delay", "verb"]) { const t = top((r) => r.trig && r.trig[m]); if (t) S.fx.trig[m] = t; }
    const ch = top((r) => r.choir); S.choir.on = false;
    if (ch && ch.on) Object.assign(S.choir, ch, { mix: Math.min(1, ch.mix * (picks.find((x) => x.r.choir === ch).w / tot) * (picks.length > 1 ? 1.4 : 1)) });
    const vc = top((r) => r.vocoder); S.vocoder.on = false;
    if (vc && vc.on) Object.assign(S.vocoder, vc);
    return S;
  }

  // "travis scott type vocal mixed with slipknot" -> a state + the words it understood
  function fromPrompt(text, base) {
    const s = " " + String(text || "").toLowerCase().replace(/[^a-z0-9$&#'+ -]/g, " ").replace(/\s+/g, " ") + " ";
    const picks = [];
    for (const r of RECIPES) {
      let hit = null;
      for (const w of r.words) {
        const re = new RegExp("(^|[^a-z0-9])" + w.replace(/[$+.*?^()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)");
        if (re.test(s) && (!hit || w.length > hit.length)) hit = w;
      }
      if (hit) picks.push({ r, w: hit.split(" ").length > 1 || hit.length > 5 ? 1 : 0.7, word: hit, at: s.indexOf(hit) });
    }
    // "mostly X with a bit of Y": the first named leads a little
    picks.sort((a, b) => a.at - b.at);
    if (picks.length > 1) picks[0].w *= /\b(mostly|main|heavy)\b/.test(s) ? 1.6 : 1.15;
    if (/\b(a bit of|little|touch of|hint of)\b/.test(s) && picks.length > 1) picks[picks.length - 1].w *= 0.5;
    const start = base ? clone(base) : fresh();
    let S = picks.length ? blend(start, picks) : clone(start);
    for (const [re, fn] of NUDGES) if (re.test(s)) fn(S);
    S.fx.preset = picks.length ? picks.map((x) => x.r.name).join(" + ") : "PROMPT";
    return { state: S, understood: picks.map((x) => x.word), nudged: NUDGES.filter(([re]) => re.test(s)).length };
  }

  function presetState(name, base) {
    const r = RECIPES.find((x) => x.name === name);
    if (!r) return null;
    const S = blend(base ? clone(base) : fresh(), [{ r, w: 1 }]);
    S.fx.preset = name;
    return S;
  }

  // ------------------------------------------------------------------ the window
  let open_ = null;
  function close() {
    if (!open_) return;
    clearInterval(open_.timer);
    open_.win.destroy();
    open_.host.remove();
    document.removeEventListener("keydown", open_.esc, true);
    open_ = null;
  }
  const find = (pid) => { try { return findPlugin(pid); } catch (e) { return null; } };
  async function open(p) {
    if (!window.ToyTuneUI) return;
    close();
    const pid = p.id;
    const hit = find(pid);
    const plug = (hit && hit.p) || p;
    if (!plug.tt) plug.tt = fresh(ui && ui.state && ui.state.key);
    const host = document.createElement("div");
    host.className = "tt-host";
    const box = document.createElement("div");
    box.className = "tt-box";
    host.append(box);
    host.addEventListener("mousedown", (e) => { if (e.target === host) close(); });
    document.body.append(host);
    let meter = null, saveT = 0;
    const push = (save) => booth("setToyTune", { pluginId: pid, tt: win.state, save });
    const api = {
      set: () => { push(false); clearTimeout(saveT); saveT = setTimeout(() => push(true), 400); },
      pitch: () => (meter ? { in: meter.in, out: meter.out, target: meter.target >= 0 ? meter.target : null, level: meter.level } : null),
      bands: () => (meter && meter.bands && meter.bands.length ? meter.bands : null),
      prompt: async (text) => { const r = fromPrompt(text, win.state); win.setState(r.state); push(true); return null; },
      preset: async (name) => { const S = presetState(name, win.state); if (S) { win.setState(S); push(true); } return null; },
      stack: (kind, o) => stack(pid, kind, o),
      peaks: async () => {   // the clip's real waveform for STACKS (0..1 per bucket)
        const h = find(pid); if (!h || !h.c) return null;
        const r = await booth("getPeaks", { clipId: h.c.id, buckets: 480 });
        if (!r || !r.max) return null;
        const v = r.max.map((x, i) => Math.max(Math.abs(x), Math.abs(r.min[i] || 0))), top = Math.max(1e-6, ...v);
        return v.map((x) => x / top);
      },
      live: (pitch, on) => booth("toyTuneLive", { pluginId: pid, pitch, on }),
      close,
    };
    const win = ToyTuneUI.open(box, { state: clone(plug.tt), api });
    // the meter: the engine posts ~40x a second; the window reads it every frame
    const timer = setInterval(async () => { const m = await booth("toyTuneMeter", { pluginId: pid }); meter = m && m.ok ? m : null; }, 33);
    const esc = (e) => { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector(".tt-menu") && win.root.querySelector(".tt-prefs").hidden) { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", esc, true);
    open_ = { host, win, timer, esc, pid };
    win.root.focus();
    return win;
  }

  // ------------------------------------------------------------------ STACKS (SUNO)
  // The vocal goes to Suno "upload & cover" through the same connector as REIMAGINE SOUND (ui/kt2-ace.js); what comes
  // back lands as new lanes right under the clip, lined up, 2 versions each.
  const STACK_WORDS = {
    remaster: "same singer, same melody, same lyrics, professionally mixed lead vocal, thick, polished, warm, autotuned, studio quality",
    stacks: "same singer, same melody, stacked vocal doubles, layered, wide, tight doubles, ad-lib layers",
    harmony: "same singer, vocal harmonies above and below the melody, harmony stack, choir layers",
  };
  async function stack(pid, kind, o) {
    const hit = find(pid);
    if (!hit || !hit.c) { toast("Put TOYTUNE on a vocal clip to make stacks."); return null; }
    if (!window.KT2Ace || !KT2Ace.go) { toast("SUNO isn't on this page."); return null; }
    const style = ((o && o.style) || "").trim();
    const prompt = (style ? style + ", " : "") + STACK_WORDS[kind];
    await KT2Ace.go(hit.c, hit.t, "re", prompt, { engine: "suno", wild: o ? o.wild : 0.35, vocal: kind });
    return { takes: [{ label: kind.toUpperCase(), secs: hit.c.length }] };
  }

  // ------------------------------------------------------------------ css for the floating host
  const css = document.createElement("style");
  css.textContent = ".tt-host{position:fixed;inset:0;z-index:100000;background:rgba(8,8,10,.55);display:grid;place-items:center}" +
    ".tt-box{width:min(1040px,96vw);height:min(640px,92vh);box-shadow:0 30px 90px rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.08)}";
  document.head.append(css);

  window.KT2ToyTune = { fresh, values, cardSet, syncCard, fromPrompt, presetState, open, close, RECIPES, _t: { blend, stack } };
})();
