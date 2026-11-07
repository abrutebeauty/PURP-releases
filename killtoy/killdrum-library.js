// KILLDRUM library: the sound index, the starter kits and the "vibe" search behind the KILLDRUM
// window (ui/killdrum.js). Pure logic, no DOM: the window, the assistant tools and
// scripts/killdrum/bake_kits.js all call the same functions, so a kit picked by text in the
// window and one picked by the assistant come out the same.
// Data: killdrum/INDEX.json and killdrum/KITS.json next to the page, made by
// scripts/killdrum/ingest.py and scripts/killdrum/bake_kits.js. Formats are in
// /mnt/project-files/killdrum/FORMAT.md, the window contract in killdrum/INTERFACE.md.
// Keep this file ASCII-only.
(function (root) {
"use strict";

const SLOTS = ["kick", "808", "snare", "clap", "hat_closed", "hat_open", "perc", "fx", "texture"];
const NOTES = { kick: 36, "808": 35, snare: 38, clap: 39, hat_closed: 42, hat_open: 46, perc: 37, fx: 49, texture: 51 };
const SLOT_LABEL = { kick: "kick", "808": "808", snare: "snare", clap: "clap", hat_closed: "hats", hat_open: "open hat", perc: "perc", fx: "fx", texture: "texture" };
const DIMS = ["bright", "punch", "dirt", "width", "decay", "low", "tonal", "noise"];
const FX_KINDS = ["reverb", "delay", "drive", "crush", "clip"];
const DRUM_SLOTS = ["kick", "808", "snare", "clap", "hat_closed", "hat_open", "perc"];

const state = { items: [], byId: new Map(), bySlot: {}, kits: [], loaded: false, loading: null, df: {} };

// ---------------------------------------------------------------------------
// Words. Every query word maps to tags to look for and/or descriptor hints (+ = more of it).

// Slot words (longest phrase wins).
const SLOT_WORDS = {
  kick: ["kick", "kicks", "kik", "bd", "bass drum", "kick drum"],
  "808": ["808", "808s", "eight oh eight", "sub bass", "bass", "basses", "sub", "subs", "808 bass"],
  snare: ["snare", "snares", "snr", "sd"],
  clap: ["clap", "claps", "handclap", "handclaps", "hand clap"],
  hat_closed: ["hat", "hats", "hihat", "hihats", "hi-hat", "hi-hats", "hi hat", "hi hats", "hh", "closed hat", "closed hats", "closed hihat"],
  hat_open: ["open hat", "open hats", "open hihat", "open hi-hat", "open hi hat", "oh", "cymbal", "cymbals", "crash", "crashes", "ride", "rides"],
  perc: ["perc", "percs", "percussion", "rim", "rims", "rimshot", "rimshots", "shaker", "shakers", "tambourine", "tamb",
    "cowbell", "cowbells", "tom", "toms", "conga", "congas", "bongo", "bongos", "woodblock", "clave", "claves", "snaps",
    "finger snap", "triangle", "block"],
  fx: ["fx", "sfx", "riser", "risers", "impact", "impacts", "sweep", "sweeps", "whoosh", "whooshes", "swoosh", "sword", "swords",
    "blade", "blades", "laser", "lasers", "zap", "zaps", "explosion", "explosions", "braam", "braams", "downlifter", "uplifter",
    "transition", "sound effect", "sound effects", "chains", "glass"],
  texture: ["texture", "textures", "atmosphere", "atmos", "ambience", "vinyl", "crackle", "hiss", "rain", "noise bed", "foley",
    "room tone", "wind", "background", "bed"],
};
// Words inside slot phrases that are also wanted as tags when said (a "sword" fx should be a sword).
const SLOT_TAG_WORDS = new Set(["rim", "rimshot", "shaker", "tambourine", "cowbell", "tom", "conga", "bongo", "woodblock", "clave",
  "snap", "triangle", "riser", "impact", "sweep", "whoosh", "swoosh", "sword", "blade", "laser", "zap", "explosion", "braam",
  "downlifter", "uplifter", "transition", "vinyl", "crackle", "hiss", "rain", "wind", "crash", "ride", "chain", "glass", "foley"]);

// Character words: tags + hints. "x" = extra fx card, "p" = params for the slots it applies to.
const WORDS = {
  dark: { t: ["dark", "moody"], h: { bright: -1 } },
  evil: { t: ["evil", "dark", "villain", "sinister"], h: { bright: -0.6, dirt: 0.3 } },
  villain: { t: ["villain", "evil", "dark", "sinister"], h: { bright: -0.6, dirt: 0.3 } },
  villainous: { t: ["villain", "evil", "dark"], h: { bright: -0.6, dirt: 0.3 } },
  sinister: { t: ["sinister", "dark", "evil"], h: { bright: -0.7 } },
  scary: { t: ["dark", "evil", "horror"], h: { bright: -0.6 } },
  horror: { t: ["horror", "dark", "cinematic"], h: { bright: -0.5 } },
  moody: { t: ["moody", "dark"], h: { bright: -0.4 } },
  sad: { t: ["sad", "moody", "soft"], h: { bright: -0.5, punch: -0.3 } },
  bright: { t: ["bright", "crisp", "shiny"], h: { bright: 1 } },
  crisp: { t: ["crisp", "bright", "tight"], h: { bright: 0.6, punch: 0.4 } },
  shiny: { t: ["shiny", "bright"], h: { bright: 0.8 } },
  airy: { t: ["airy", "bright"], h: { bright: 0.5, punch: -0.3 } },
  warm: { t: ["warm", "round", "analog"], h: { bright: -0.4 } },
  soft: { t: ["soft", "smooth"], h: { punch: -0.8 } },
  smooth: { t: ["smooth", "soft"], h: { punch: -0.5, dirt: -0.4 } },
  gentle: { t: ["soft"], h: { punch: -0.8 } },
  muffled: { t: ["muffled", "dull", "underwater"], h: { bright: -1.3 }, p: { cutoff: 0.45 } },
  muted: { t: ["muffled", "dull"], h: { bright: -1 } },
  underwater: { t: ["underwater", "muffled"], h: { bright: -1.4 }, p: { cutoff: 0.35 } },
  dull: { t: ["dull", "muffled"], h: { bright: -1 } },
  filtered: { t: ["muffled", "filtered"], h: { bright: -0.8 }, p: { cutoff: 0.5 } },
  lofi: { t: ["lofi", "dusty", "tape"], h: { bright: -0.6, dirt: 0.3, punch: -0.2 }, p: { cutoff: 0.6 } },
  dusty: { t: ["dusty", "lofi", "vintage"], h: { bright: -0.5, dirt: 0.2 } },
  vintage: { t: ["vintage", "analog", "dusty"], h: { bright: -0.3 } },
  old: { t: ["vintage", "dusty"], h: { bright: -0.3 } },
  tape: { t: ["tape", "cassette", "lofi"], h: { bright: -0.4, dirt: 0.2 } },
  cassette: { t: ["cassette", "tape", "lofi"], h: { bright: -0.5, dirt: 0.2 } },
  vhs: { t: ["vhs", "tape", "lofi"], h: { bright: -0.5, dirt: 0.2 } },
  analog: { t: ["analog", "warm", "vintage"], h: {} },
  clean: { t: ["clean"], h: { dirt: -1 } },
  pure: { t: ["clean"], h: { dirt: -1 } },
  punchy: { t: ["punchy", "hitting"], h: { punch: 1 } },
  hard: { t: ["hard", "punchy", "hitting"], h: { punch: 0.9, dirt: 0.2 } },
  hitting: { t: ["hitting", "punchy", "hard"], h: { punch: 0.9 } },
  knocking: { t: ["punchy", "hitting", "knock"], h: { punch: 1, low: 0.3 } },
  slapping: { t: ["punchy", "hitting"], h: { punch: 1 } },
  heavy: { t: ["heavy", "big", "huge"], h: { low: 0.7, punch: 0.4 } },
  fat: { t: ["fat", "big", "heavy"], h: { low: 0.6, punch: 0.3 } },
  thick: { t: ["thick", "fat", "big"], h: { low: 0.6 } },
  big: { t: ["big", "huge", "heavy"], h: { low: 0.5, decay: 0.3 } },
  huge: { t: ["huge", "big", "epic"], h: { low: 0.6, decay: 0.4 } },
  massive: { t: ["huge", "big", "heavy"], h: { low: 0.7, decay: 0.4 } },
  aggressive: { t: ["aggressive", "hard", "distorted"], h: { dirt: 0.6, punch: 0.5 } },
  angry: { t: ["aggressive", "distorted"], h: { dirt: 0.6, punch: 0.5 } },
  distorted: { t: ["distorted", "dirty", "saturated"], h: { dirt: 1.2 }, p: { drive: 0.3 } },
  distortion: { t: ["distorted", "dirty"], h: { dirt: 1.2 }, p: { drive: 0.3 } },
  dirty: { t: ["dirty", "distorted", "gritty"], h: { dirt: 1 }, p: { drive: 0.2 } },
  gritty: { t: ["gritty", "dirty", "distorted"], h: { dirt: 0.9 }, p: { drive: 0.2 } },
  saturated: { t: ["saturated", "warm", "distorted"], h: { dirt: 0.7 }, p: { drive: 0.2 } },
  fuzz: { t: ["fuzz", "distorted"], h: { dirt: 1.1 }, p: { drive: 0.35 } },
  fuzzy: { t: ["fuzz", "distorted"], h: { dirt: 1 }, p: { drive: 0.3 } },
  blown: { t: ["distorted", "clipped", "blown"], h: { dirt: 1.3 }, p: { drive: 0.45 } },
  overdriven: { t: ["distorted", "saturated"], h: { dirt: 1 }, p: { drive: 0.3 } },
  crunchy: { t: ["crunchy", "bitcrushed", "crunch"], h: { dirt: 1, bright: 0.3 }, x: ["crush"] },
  crunch: { t: ["crunchy", "bitcrushed"], h: { dirt: 1, bright: 0.3 }, x: ["crush"] },
  bitcrushed: { t: ["bitcrushed", "crunchy", "chiptune"], h: { dirt: 1 }, x: ["crush"] },
  crushed: { t: ["bitcrushed", "crunchy"], h: { dirt: 0.9 }, x: ["crush"] },
  clipped: { t: ["clipped", "distorted"], h: { dirt: 0.8 }, x: ["clip"] },
  trashy: { t: ["trashy", "distorted", "crunchy", "lofi"], h: { dirt: 0.8 } },
  short: { t: ["short", "tight"], h: { decay: -1 }, p: { decay: 0.6 } },
  tight: { t: ["tight", "short", "snappy"], h: { decay: -0.8, punch: 0.3 } },
  snappy: { t: ["snappy", "tight", "short"], h: { decay: -0.6, punch: 0.6 } },
  dry: { t: ["dry", "tight"], h: { decay: -0.6, width: -0.3 } },
  long: { t: ["long"], h: { decay: 1 } },
  sustained: { t: ["long", "sustained"], h: { decay: 1 } },
  ringing: { t: ["long", "ringing"], h: { decay: 0.8, tonal: 0.4 } },
  boomy: { t: ["boomy", "boom", "deep"], h: { low: 1, decay: 0.5 } },
  booming: { t: ["boomy", "boom"], h: { low: 1, decay: 0.5 } },
  subby: { t: ["subby", "sub", "deep"], h: { low: 1, bright: -0.3 } },
  deep: { t: ["deep", "subby"], h: { low: 0.9, bright: -0.3 } },
  low: { t: ["deep", "low"], h: { low: 0.8 } },
  round: { t: ["round", "warm"], h: { dirt: -0.4, bright: -0.3 } },
  wide: { t: ["wide", "stereo"], h: { width: 1 } },
  stereo: { t: ["stereo", "wide"], h: { width: 0.8 } },
  spacious: { t: ["spacious", "wide", "reverby"], h: { width: 0.7, decay: 0.4 } },
  mono: { t: ["mono"], h: { width: -1 } },
  roomy: { t: ["roomy", "reverby", "room"], h: { decay: 0.5, width: 0.3 }, x: ["reverb"] },
  reverby: { t: ["reverby", "roomy", "wet"], h: { decay: 0.6, width: 0.3 }, x: ["reverb"] },
  wet: { t: ["wet", "reverby"], h: { decay: 0.4 }, x: ["reverb"] },
  spacey: { t: ["spacey", "reverby", "space"], h: { decay: 0.5, width: 0.5 }, x: ["reverb"] },
  ambient: { t: ["ambient", "airy", "reverby"], h: { decay: 0.5, punch: -0.4 }, x: ["reverb"] },
  dreamy: { t: ["dreamy", "airy", "ambient"], h: { punch: -0.4, width: 0.4 }, x: ["reverb"] },
  ethereal: { t: ["ethereal", "airy", "dreamy"], h: { punch: -0.5, width: 0.4 }, x: ["reverb"] },
  echo: { t: ["delay", "echo"], h: {}, x: ["delay"] },
  metallic: { t: ["metallic", "metal"], h: { tonal: 0.3, bright: 0.4 } },
  metal: { t: ["metallic", "metal"], h: { tonal: 0.3, bright: 0.4 } },
  noisy: { t: ["noisy", "noise"], h: { noise: 1 } },
  glitchy: { t: ["glitchy", "glitch"], h: {} },
  glitch: { t: ["glitchy", "glitch"], h: {} },
  cinematic: { t: ["cinematic", "epic", "impact"], h: { decay: 0.6, low: 0.4 } },
  epic: { t: ["epic", "cinematic", "huge"], h: { decay: 0.6, low: 0.4 } },
  weird: { t: ["weird", "glitchy", "experimental", "designed"], h: {} },
  interesting: { t: ["designed", "glitchy", "weird", "experimental"], h: {} },
  experimental: { t: ["experimental", "glitchy", "designed"], h: {} },
  organic: { t: ["organic", "acoustic", "live"], h: { dirt: -0.2 } },
  acoustic: { t: ["acoustic", "organic", "live"], h: { dirt: -0.2 } },
  live: { t: ["live", "acoustic"], h: {} },
  tuned: { t: ["tonal", "tuned"], h: { tonal: 1 } },
  melodic: { t: ["tonal", "melodic"], h: { tonal: 0.8 } },
  pitched: { t: ["tonal"], h: { tonal: 0.6 } },
  gated: { t: ["gated", "80s", "reverb"], h: { decay: 0.4 }, x: ["reverb"] },
};

// Comparatives ("darker", "dirtier") -> base word.
const COMPARE = {
  darker: "dark", brighter: "bright", crisper: "crisp", warmer: "warm", softer: "soft", smoother: "smooth",
  dirtier: "dirty", grittier: "gritty", crunchier: "crunchy", fuzzier: "fuzzy", harder: "hard", punchier: "punchy",
  heavier: "heavy", fatter: "fat", thicker: "thick", bigger: "big", shorter: "short", tighter: "tight", snappier: "snappy",
  drier: "dry", longer: "long", boomier: "boomy", deeper: "deep", lower: "low", rounder: "round", wider: "wide",
  cleaner: "clean", noisier: "noisy", weirder: "weird", wetter: "wet", duller: "dull", dustier: "dusty", lofier: "lofi",
  evilier: "evil", eviler: "evil", meaner: "aggressive", angrier: "angry", rougher: "gritty", tinier: "short",
};
// Opposites, for "less X" when X has no hints of its own.
const LESS_OF = { reverb: "dry", reverby: "dry", wet: "dry", boomy: "tight", long: "short", short: "long", dark: "bright", bright: "dark" };

// Scenes: genres and artists Eman likes. g = tags for every slot, h = hints for every slot,
// s = per-slot { t: tags, h: hints, p: params, x: fx }, p/x = for every drum slot.
const SCENES = {
  carti: { label: "Carti", g: ["carti", "rage", "opium", "trap"], h: { dirt: 0.3 },
    s: { "808": { t: ["rage", "distorted", "long"], h: { dirt: 1.2, decay: 0.6, low: 0.5 }, p: { drive: 0.35 } },
      kick: { h: { punch: 0.8 } }, snare: { h: { bright: 0.5, dirt: 0.4 } }, clap: { h: { dirt: 0.3 } },
      hat_closed: { t: ["crisp"], h: { bright: 0.6, decay: -0.8 } }, fx: { t: ["laser", "zap", "glitch"] }, texture: { t: ["tape", "hiss", "dark"] } } },
  rage: { label: "Rage", g: ["rage", "carti", "distorted", "trap"], h: { dirt: 0.6 },
    s: { "808": { t: ["rage", "distorted", "fuzz", "clipped"], h: { dirt: 1.5, decay: 0.5 }, p: { drive: 0.5 } },
      kick: { t: ["distorted"], h: { punch: 1, dirt: 0.8 }, x: ["clip"] }, snare: { h: { dirt: 0.8, bright: 0.5 } },
      clap: { t: ["distorted"], h: { dirt: 0.8 } }, hat_closed: { h: { bright: 0.6, decay: -0.8, dirt: 0.4 } },
      fx: { t: ["laser", "impact", "zap", "synth"] } } },
  opium: { label: "Opium", g: ["opium", "carti", "dark", "trap"], h: { bright: -0.3, dirt: 0.4 },
    s: { "808": { t: ["distorted", "dark"], h: { dirt: 1.2, decay: 0.7, low: 0.5 }, p: { drive: 0.4 } },
      kick: { h: { punch: 0.8, dirt: 0.4 } }, snare: { t: ["dark"], h: { dirt: 0.5 } }, hat_closed: { h: { decay: -0.8 } },
      fx: { t: ["dark", "glitch", "metal"] } } },
  trap: { label: "Trap", g: ["trap", "808"], h: {},
    s: { "808": { h: { decay: 0.6, low: 0.6 } }, hat_closed: { t: ["crisp"], h: { decay: -1, bright: 0.5 } },
      snare: { h: { bright: 0.4, punch: 0.4 } }, clap: { h: { bright: 0.3 } }, perc: { t: ["rim"] } } },
  drill: { label: "Drill", g: ["drill", "trap", "dark"], h: { bright: -0.2 },
    s: { "808": { t: ["slide", "glide"], h: { decay: 0.9, low: 0.6 } }, snare: { h: { bright: 0.4, decay: -0.3 } },
      perc: { t: ["rim"] }, hat_closed: { h: { decay: -0.8 } } } },
  phonk: { label: "Phonk", g: ["phonk", "memphis", "cowbell"], h: { dirt: 0.5 },
    s: { perc: { t: ["cowbell"], h: { tonal: 0.5 } }, "808": { h: { dirt: 0.9, decay: 0.4 }, p: { drive: 0.35 } },
      kick: { h: { punch: 0.8 } }, hat_closed: { h: { decay: -0.7 } } } },
  hiphop: { label: "Boom Bap", g: ["hip hop", "boom bap", "dusty"], h: { bright: -0.3 },
    s: { kick: { h: { punch: 0.6 } }, snare: { h: { punch: 0.5 } }, texture: { t: ["vinyl", "crackle"] }, perc: { t: ["rim", "shaker"] } } },
  lofi: { label: "Lo-fi", g: ["lofi", "dusty", "tape", "soft"], h: { bright: -0.8, punch: -0.3 }, p: { cutoff: 0.6 },
    s: { texture: { t: ["vinyl", "crackle", "tape", "hiss"] }, snare: { x: ["reverb"] }, "808": { t: ["round", "warm"], h: { dirt: -0.3 } } } },
  bluehour: { label: "Blue Hour", g: ["blue hour", "snowfall", "lofi", "muffled", "ambient"], h: { bright: -1.4, punch: -0.5, width: 0.5, decay: 0.4 },
    p: { cutoff: 0.35 }, s: { snare: { x: ["reverb"] }, clap: { x: ["reverb"] }, perc: { x: ["reverb"] },
      texture: { t: ["underwater", "rain", "vinyl", "tape", "hiss"] }, "808": { t: ["round", "warm", "sub"], h: { dirt: -0.5, decay: 0.6 } },
      fx: { t: ["reverse", "swell", "ambient"] } } },
  tame: { label: "Tame Impala", g: ["tame impala", "psychedelic", "dusty", "warm", "vintage", "analog"], h: { bright: -0.4 },
    p: { cutoff: 0.7 }, s: { kick: { h: { punch: 0.4 } }, snare: { t: ["roomy", "gated"], h: { decay: 0.7 }, x: ["reverb"] },
      perc: { t: ["shaker", "tambourine"] }, texture: { t: ["tape", "hiss"] }, hat_open: { h: { bright: -0.3 } } } },
  castles: { label: "Crystal Castles", g: ["crystal castles", "chiptune", "bitcrushed", "crunchy", "glitchy"], h: { dirt: 1, bright: 0.3 },
    s: { snare: { x: ["crush"] }, hat_closed: { x: ["crush"] }, fx: { t: ["blip", "chiptune", "8-bit", "zap", "glitch"] },
      kick: { h: { punch: 0.6 } }, texture: { t: ["static", "noise"] } } },
  skrillex: { label: "Skrillex", g: ["skrillex", "dubstep", "hard", "impact"], h: { punch: 0.6 },
    s: { kick: { h: { punch: 1.2 } }, snare: { h: { punch: 1, bright: 0.6, decay: 0.3 } }, "808": { h: { dirt: 0.9 }, p: { drive: 0.3 } },
      fx: { t: ["impact", "laser", "riser", "braam"] }, clap: { h: { bright: 0.5 } } } },
  gorillaz: { label: "Gorillaz", g: ["gorillaz", "dusty", "boom bap", "lofi", "analog"], h: { bright: -0.3 },
    s: { kick: { h: { punch: 0.5 } }, perc: { t: ["conga", "cowbell", "shaker"] }, texture: { t: ["vinyl", "tape"] } } },
  pop: { label: "Neon Pop", g: ["pop", "edm", "bright"], h: { bright: 0.5, punch: 0.5 },
    s: { clap: { h: { bright: 0.6 } }, kick: { h: { punch: 1 } }, fx: { t: ["riser", "whoosh", "impact"] }, hat_open: { h: { bright: 0.4 } } } },
  techno: { label: "Techno", g: ["techno", "hard", "tight", "industrial"], h: {},
    s: { kick: { h: { punch: 1, decay: -0.2, low: 0.4 } }, hat_closed: { h: { decay: -0.6, bright: 0.3 } },
      clap: { h: { decay: 0.3 }, x: ["reverb"] }, perc: { t: ["metallic", "metal"] }, texture: { t: ["rumble", "noise", "industrial"] },
      fx: { t: ["sweep", "noise"] } } },
  house: { label: "House", g: ["house", "garage"], h: {},
    s: { kick: { h: { punch: 0.7, low: 0.4 } }, clap: { h: { bright: 0.3 } }, hat_open: { h: { decay: 0.2 } }, perc: { t: ["shaker"] } } },
  hyperpop: { label: "Hyperpop", g: ["hyperpop", "glitchy", "bright", "crunchy"], h: { bright: 0.6, dirt: 0.5 },
    s: { fx: { t: ["glitch", "zap", "8-bit"] }, snare: { h: { bright: 0.6 } } } },
  cinematic: { label: "Cinematic", g: ["cinematic", "epic", "impact"], h: { decay: 0.4 },
    s: { fx: { t: ["sword", "blade", "impact", "braam", "whoosh"] }, kick: { h: { low: 0.6, decay: 0.4 } }, snare: { x: ["reverb"] },
      texture: { t: ["wind", "rumble"] } } },
  eighties: { label: "80s", g: ["80s", "gated", "retro", "synthwave"], h: {},
    s: { snare: { t: ["gated"], h: { decay: 0.6 }, x: ["reverb"] }, clap: { x: ["reverb"] }, kick: { h: { punch: 0.5 } } } },
  afro: { label: "Afro", g: ["afro", "organic"], h: {}, s: { perc: { t: ["conga", "shaker", "bongo"], h: { tonal: 0.4 } }, kick: { h: { punch: 0.4 } } } },
  dnb: { label: "Jungle", g: ["dnb", "jungle", "breakbeat"], h: {}, s: { snare: { h: { bright: 0.5, punch: 0.6 } }, kick: { h: { punch: 0.6 } } } },
  dubstep: { label: "Dubstep", g: ["dubstep", "heavy"], h: { low: 0.3 },
    s: { snare: { h: { punch: 1, decay: 0.3 } }, "808": { t: ["growl"], h: { dirt: 0.8 } }, fx: { t: ["impact", "braam", "riser"] } } },
  anime: { label: "Anime", g: ["anime", "sword"], h: {}, s: { fx: { t: ["sword", "blade", "anime", "whoosh", "slash"] } } },
};
const SCENE_WORDS = {
  carti: ["carti", "playboi carti", "whole lotta red", "wlr", "ken carson", "destroy lonely", "yeat", "homixide"],
  rage: ["rage", "rager"],
  opium: ["opium"],
  trap: ["trap", "atl", "metro boomin", "southside"],
  drill: ["drill", "uk drill", "ny drill", "chicago drill"],
  phonk: ["phonk", "memphis", "drift phonk"],
  hiphop: ["hip hop", "hiphop", "hip-hop", "boom bap", "boombap", "90s", "dilla", "jazzy", "rap"],
  lofi: ["lofi", "lo-fi", "lo fi", "chillhop", "study"],
  bluehour: ["blue hour", "bluehour", "snowfall", "sad hours", "undercurrent", "oneheart", "reidenshi", "leadwave", "my head is empty"],
  tame: ["tame impala", "tame", "psychedelic", "psych", "kevin parker", "70s"],
  castles: ["crystal castles", "chiptune", "8 bit", "8-bit", "8bit", "witch house", "alice glass", "nintendo", "gameboy"],
  skrillex: ["skrillex", "brostep", "riddim", "bass music"],
  gorillaz: ["gorillaz", "damon albarn", "plastic beach"],
  pop: ["icona pop", "pop", "dance pop", "edm", "electro", "big room", "festival"],
  techno: ["techno", "warehouse", "berlin", "industrial", "rave", "hard techno"],
  house: ["house", "deep house", "garage", "uk garage", "2-step", "2 step", "bicep", "overmono", "fred again"],
  hyperpop: ["hyperpop", "pc music", "glitchcore", "digicore"],
  cinematic: ["cinematic", "trailer", "battle", "fight", "samurai"],
  eighties: ["80s", "synthwave", "retro", "outrun"],
  afro: ["afro", "afrobeats", "amapiano", "afro house"],
  dnb: ["dnb", "drum and bass", "drum n bass", "jungle", "breakbeat", "breaks"],
  dubstep: ["dubstep", "wub"],
  anime: ["anime", "katana", "ninja"],
};

// Tag groups: a wanted tag also half-matches its group mates.
const GROUPS = [
  ["distorted", "distortion", "dirty", "saturated", "overdrive", "driven", "fuzz", "gritty", "clipped", "blown"],
  ["crunchy", "crunch", "bitcrushed", "bitcrush", "crushed", "chiptune", "8-bit", "8bit"],
  ["dark", "sinister", "evil", "villain", "moody", "menacing", "ominous", "horror"],
  ["bright", "crisp", "shiny", "sparkly"],
  ["muffled", "muted", "dull", "underwater", "filtered", "lowpassed"],
  ["lofi", "lo-fi", "dusty", "vintage", "tape", "cassette", "vhs"],
  ["punchy", "punch", "hard", "hitting", "knock", "slap"],
  ["boomy", "boom", "deep", "subby", "sub"],
  ["short", "tight", "dry", "snappy"],
  ["long", "sustained", "ringing"],
  ["wide", "stereo", "spacious"],
  ["roomy", "reverb", "reverby", "wet", "room", "hall"],
  ["metallic", "metal", "tinny", "clang"],
  ["glitchy", "glitch", "stutter", "digital"],
  ["sword", "blade", "katana", "slash", "shing", "samurai"],
  ["laser", "zap", "pew", "sci-fi", "scifi", "blaster"],
  ["impact", "hit", "explosion", "braam", "slam"],
  ["riser", "rise", "uplifter", "build"],
  ["whoosh", "swoosh", "swish", "sweep", "transition"],
  ["vinyl", "crackle", "dust"],
  ["rain", "storm", "water"],
  ["hiss", "noise", "static"],
  ["warm", "round", "analog", "smooth"],
  ["carti", "rage", "opium"],
  ["blue hour", "snowfall", "bluehour"],
];
const GROUP_OF = {};
GROUPS.forEach((g) => g.forEach((w) => { (GROUP_OF[w] = GROUP_OF[w] || []).push(g); }));

const STOP = new Set(("a an the some me my give make i want like kit kits kind of sound sounds drum drums beat beats with more less very really super " +
  "please for that this it its to in on and but plus also bit little lot lots one ones something thing stuff get got need can could would " +
  "be is are was some any all every everything whole new style type vibe vibes feel feeling ish sort just maybe so too much way pls").split(" "));
const FX_WORDS = { reverb: "reverb", verb: "reverb", room: "reverb", hall: "reverb", space: "reverb", plate: "reverb",
  delay: "delay", echo: "delay", echoes: "delay", "ping pong": "delay", slapback: "delay",
  drive: "drive", distortion: "drive", saturation: "drive", overdrive: "drive", dirt: "drive", grit: "drive", tape: "drive",
  crush: "crush", bitcrush: "crush", bitcrusher: "crush", crusher: "crush", "bit crush": "crush", decimate: "crush", "8-bit": "crush",
  clip: "clip", clipper: "clip", clipping: "clip", "soft clip": "clip", limiter: "clip" };

// ---------------------------------------------------------------------------
// Small helpers.

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = (typeof seed === "number" ? seed : hashStr(String(seed))) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r2 = (v) => Math.round(v * 100) / 100;
const stem = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9#\-\s]+/g, " ").split(/\s+/).filter(Boolean);
const NOTE_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const FLATS = { db: "c#", eb: "d#", gb: "f#", ab: "g#", bb: "a#" };

function prep(it) {
  if (it._w instanceof Set) return it; // (a JSON copy can carry _w/_t as plain objects)
  const text = [it.name, it.subtype, it.song, it.artist, it.pack, (it.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
  it._text = " " + text.replace(/[^a-z0-9#\-]+/g, " ") + " ";
  it._w = new Set(words(text).map(stem));
  it._t = new Set((it.tags || []).map((t) => String(t).toLowerCase()));
  if (it.subtype) it._t.add(String(it.subtype).toLowerCase());
  it.d = it.d || {};
  return it;
}
const dv = (it, k) => (it && it.d && typeof it.d[k] === "number" ? it.d[k] : 0.5);
function hasTag(it, t) {
  if (t.indexOf(" ") >= 0 || t.indexOf("-") >= 0) return it._t.has(t) || it._text.indexOf(" " + t + " ") >= 0;
  return it._t.has(t) || it._w.has(stem(t));
}

// ---------------------------------------------------------------------------
// Data.

function slotOfItem(it) {
  const t = it.type;
  // an 808 filed as a kick (no "kick" in its name) goes on the 808 pad, not the kick pad (7 Nov: kick pads got long 808s)
  if (t === "kick" && it.source === "splice-owned" && /\b808\b/i.test(it.name || "") && !/kick|\bbd\b/i.test(it.name || "") && !(root && root.KD_KICK808_OLD)) return "808";
  if (SLOTS.indexOf(t) >= 0) return t;
  if (t === "hat" || t === "closed-hat" || t === "closed_hat") return "hat_closed";
  if (t === "open-hat" || t === "open_hat") return "hat_open";
  if (t === "designed" || t === "riser") return "fx";
  return "fx";
}

// Eman, 7 Nov: KILLDRUM plays only real sounds from the Splice packs we own. Our synthesized
// sounds (killdrum), the remakes of hits from songs (sound-library), Eman's 888 one-shots and the
// Splice website previews (placeholder) all stay out. window.KD_ALL_SOURCES = the old mix.
const realSample = (it) => it.source === "splice-owned" && !it.placeholder;
// Starter kits come dry and clean: no drive, low-pass, crush, clip or lo-fi on any pad (a kick
// through crush/clip lost its low end). Reverb on snares and claps stays. KD_KIT_FX_OLD = old.
const DIRTY_FX = new Set(["crush", "clip", "lofi", "drive"]);
function cleanKit(k) {
  if (!k || (root && root.KD_KIT_FX_OLD)) return k;
  const params = {}, fx = {};
  for (const [slot, p] of Object.entries(k.params || {})) {
    const q = { ...p }; delete q.drive; delete q.cutoff;
    if (Object.keys(q).length) params[slot] = q;
  }
  for (const [slot, list] of Object.entries(k.fx || {})) {
    const l = (list || []).filter((f) => !DIRTY_FX.has(typeof f === "string" ? f : f && f.kind));
    if (l.length) fx[slot] = l;
  }
  return { ...k, params, fx };
}

function setData(data) {
  const all = !!((root && root.KD_ALL_SOURCES) || (typeof process !== "undefined" && process.env && process.env.KD_ALL_SOURCES));
  const items = ((data && data.items) || []).filter((it) => it && (all || realSample(it)));
  state.items = items.filter((it) => it && it.id).map((it) => { it.type = slotOfItem(it); return prep(it); });
  state.byId = new Map(state.items.map((it) => [it.id, it]));
  state.bySlot = {};
  SLOTS.forEach((s) => { state.bySlot[s] = []; });
  state.items.forEach((it) => state.bySlot[it.type].push(it));
  state.df = {};
  SLOTS.forEach((s) => {
    const c = {}; const list = state.bySlot[s];
    list.forEach((it) => { it._t.forEach((t) => { c[t] = (c[t] || 0) + 1; }); it._w.forEach((w) => { if (!it._t.has(w)) c[w] = (c[w] || 0) + 1; }); });
    Object.keys(c).forEach((k) => { c[k] /= Math.max(1, list.length); });
    state.df[s] = c;
  });
  if (data && Array.isArray(data.kits) && data.kits.length) state.kits = data.kits.filter((k) => k && k.pads && Object.values(k.pads).every((id) => state.byId.has(id))).map(cleanKit);
  else { const avoid = {}; state.kits = RECIPES.map((r) => bakeRecipe(r, avoid)); }
  state.loaded = true;
  return state.items;
}

// Library INDEX.json (ui/library.js format) -> our items, used when killdrum/INDEX.json is missing.
function fromLibrary(j) {
  return ((j && j.items) || []).map((s) => ({
    id: s.id, name: s.name, type: s.type, tags: (s.tone || []).concat([s.song, s.artist].filter(Boolean).map((x) => String(x).toLowerCase())),
    url: "library/" + (s.preview || s.file), duration_s: s.duration_s, source: "sound-library", song: s.song, artist: s.artist,
    q: s.match && s.match.score, root_hz: s.pitch_hz, note: s.note, d: {},
  }));
}

function load(base) {
  if (state.loading) return state.loading;
  const b = base || "";
  const get = (u) => fetch(b + u, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  state.loading = Promise.all([get("killdrum/INDEX.json"), get("killdrum/KITS.json"), get("killdrum/PACKS.json")]).then(([idx, kits, packs]) => {
    // the 8 SAMPLES kits (Eman, 7 Nov; ui/kt2-samples.js) also show first in the starter kits, with their 9 pads
    const fromPacks = ((packs && packs.packs) || []).filter((k) => k && k.pads).map((k) => ({ id: "pack-" + k.id, name: k.name, vibe: k.about, tags: [k.kind, k.what, "sample kit"], pads: k.pads, params: {}, fx: {}, say: `Loaded ${k.name}.`, pack: k.id }));
    if (idx && Array.isArray(idx.items) && idx.items.length) { const r = setData({ items: idx.items, kits: kits && kits.kits }); if (fromPacks.length) state.kits = fromPacks.filter((k) => Object.values(k.pads).every((id) => state.byId.has(id))).concat(state.kits); return r; }
    return get("library/INDEX.json").then((lib) => setData({ items: fromLibrary(lib) }));
  });
  return state.loading;
}

// ---------------------------------------------------------------------------
// Parsing free text into wants: per slot { tags: {tag: w}, hints: {dim: w}, params, fx }.

function phraseTable() {
  if (phraseTable.t) return phraseTable.t;
  const t = [];
  Object.keys(SLOT_WORDS).forEach((s) => SLOT_WORDS[s].forEach((p) => t.push({ p: p.split(" "), kind: "slot", v: s })));
  Object.keys(SCENE_WORDS).forEach((s) => SCENE_WORDS[s].forEach((p) => t.push({ p: words(p), kind: "scene", v: s })));
  Object.keys(FX_WORDS).forEach((w) => { if (w.indexOf(" ") >= 0 || w.indexOf("-") >= 0) t.push({ p: words(w), kind: "fxword", v: FX_WORDS[w] }); });
  t.sort((a, b) => b.p.length - a.p.length);
  return (phraseTable.t = t);
}

// Splits text into clauses; each clause -> tokens tagged as slot / scene / word / mod.
function tokenize(text) {
  const clean = String(text || "").toLowerCase().replace(/\u00f8/g, "o").replace(/[\u2019']/g, "");
  const clauses = clean.split(/[,;.!?\n]+|\s(?:and|with|plus|but|also|then)\s/).map((c) => c.trim()).filter(Boolean);
  const table = phraseTable();
  return clauses.map((c) => {
    const w = words(c); const out = [];
    for (let i = 0; i < w.length;) {
      let hit = null;
      for (const e of table) {
        if (e.p.length > w.length - i) continue;
        let ok = true;
        for (let k = 0; k < e.p.length; k++) if (w[i + k] !== e.p[k]) { ok = false; break; }
        if (ok) { hit = e; break; }
      }
      // "bass" next to "drum" is the kick; "oh" alone is too loose unless it's a pad word in a list.
      if (hit) { out.push({ kind: hit.kind, v: hit.v, raw: hit.p.join(" ") }); i += hit.p.length; continue; }
      out.push({ kind: "word", v: w[i], raw: w[i] }); i++;
    }
    return out;
  });
}

const MOD = { more: 1.5, very: 1.5, super: 1.6, really: 1.4, extra: 1.6, extremely: 1.8, insanely: 1.9, way: 1.5, much: 1.3,
  slightly: 0.5, bit: 0.5, little: 0.5, kinda: 0.6, somewhat: 0.6, less: -0.8, not: -1, no: -1, without: -1, non: -1, too: -1 };

// How people complain about a sound -> what they want instead (used by follow()).
const COMPLAINTS = [
  [/\btoo much reverb\b/g, "less reverb"], [/\btoo much delay\b/g, "less delay"],
  [/\b(too )?(weak|wimpy|limp)\b/g, "punchier"], [/\b(too )?thin\b/g, "fatter"], [/\b(too )?harsh\b/g, "softer darker"],
  [/\b(too )?muddy\b/g, "tighter cleaner"], [/\b(too )?quiet\b|\bcan'?t hear\b/g, "louder"], [/\btoo loud\b/g, "quieter"],
  [/\b(too )?boring|\bdon'?t like|\bhate|\b(is |sounds )?(lame|wack|trash|bad|meh)\b/g, "randomize"],
];

function emptyWant() { return { tags: {}, hints: {}, params: {}, fx: [], noFx: [] }; }
function addTags(want, tags, w) { (tags || []).forEach((t) => { want.tags[t] = (want.tags[t] || 0) + w; }); }
function addHints(want, h, w) { Object.keys(h || {}).forEach((k) => { want.hints[k] = (want.hints[k] || 0) + h[k] * w; }); }

// Reads a vibe text. Returns { slots: {slot: want}, global: want, scenes: [...], named: [...words for the name], key }.
function parse(text) {
  const res = { slots: {}, global: emptyWant(), scenes: [], named: [], key: parseKey(text), mentioned: [] };
  const want = (s) => (res.slots[s] = res.slots[s] || emptyWant());
  tokenize(text).forEach((toks) => {
    const slots = toks.filter((t) => t.kind === "slot").map((t) => t.v);
    slots.forEach((s) => { if (res.mentioned.indexOf(s) < 0) res.mentioned.push(s); });
    const targets = slots.length ? slots.map(want) : [res.global];
    let mod = 1;
    toks.forEach((t) => {
      if (t.kind === "word" && MOD[t.v] !== undefined) { mod = mod < 0 ? mod : MOD[t.v]; return; }
      if (t.kind === "slot") {
        const w0 = stem(t.raw.split(" ").pop());
        if (SLOT_TAG_WORDS.has(w0)) targets.forEach((tw) => addTags(tw, [w0], 1.6));
        mod = 1; return;
      }
      if (t.kind === "scene") {
        if (res.scenes.indexOf(t.v) < 0) res.scenes.push(t.v);
        res.named.push(SCENES[t.v].label);
        mod = 1; return;
      }
      if (t.kind === "fxword") { targets.forEach((tw) => (mod < 0 ? tw.noFx : tw.fx).push(t.v)); mod = 1; return; }
      let base = COMPARE[t.v] ? COMPARE[t.v] : t.v;
      let m = COMPARE[t.v] ? Math.max(Math.abs(mod), 1.4) * Math.sign(mod) : mod;
      if (m < 0 && !WORDS[base] && LESS_OF[base]) { base = LESS_OF[base]; m = -m; }
      const e = WORDS[base];
      if (e) {
        targets.forEach((tw) => {
          if (m > 0) addTags(tw, e.t, m);
          addHints(tw, e.h, m);
          if (e.p && m > 0) Object.assign(tw.params, e.p);
          if (e.x) (m > 0 ? tw.fx : tw.noFx).push(...e.x);
        });
        if (m > 0) res.named.push(base);
      } else if (FX_WORDS[t.v] && (mod < 0 || /^(reverb|verb|delay|echo|bitcrush|bitcrusher|crusher|clipper)$/.test(t.v))) {
        targets.forEach((tw) => (mod < 0 ? tw.noFx : tw.fx).push(FX_WORDS[t.v]));
      } else if (!STOP.has(t.v) && !/^\d+$/.test(t.v) && t.v.length > 1 && !isKeyWord(t.v)) {
        targets.forEach((tw) => addTags(tw, [stem(t.v)], m > 0 ? 1.2 * m : -1));
      }
      mod = 1;
    });
  });
  return res;
}

function isKeyWord(w) { return /^[a-g](#|b)?(m|min|minor|maj|major)?$/.test(w) || w === "minor" || w === "major" || w === "key"; }
// "in F#m", "key of A minor", "C# minor", "tune the 808 to F#" -> { pc 0..11, name }.
// A bare "a" only counts after "key"/"key of"/"tuned to" (it's usually the article).
function parseKey(text) {
  const t = " " + String(text || "").toLowerCase().replace(/\u266f/g, "#") + " ";
  const re = /\b(in the key of|key of|key|tuned to|tune(?: it| them| the \w+)? to|in|to)\s+([a-g])(#|b|sharp|flat)?(?:\s*(minor|major|min|maj|m))?(?![a-z0-9#])/g;
  let m; let hit = null;
  while ((m = re.exec(t))) {
    const strong = /key|tune/.test(m[1]);
    if (m[1] === "to" && !/\btun|\bkey|\bpitch/.test(t)) continue;
    if (!strong && !m[3] && !m[4] && (m[2] === "a" || m[2] === "e" || m[2] === "b")) continue;
    hit = m; break;
  }
  if (!hit) { const m2 = t.match(/\s([a-g])(#|b)?\s*(minor|major|min|maj|m)\s/); if (m2) hit = [m2[0], "", m2[1], m2[2], m2[3]]; }
  if (!hit) return null;
  let n = hit[2] + (hit[3] === "#" || hit[3] === "sharp" ? "#" : hit[3] === "b" || hit[3] === "flat" ? "b" : "");
  if (FLATS[n]) n = FLATS[n];
  if (n === "cb") n = "b"; if (n === "fb") n = "e"; if (n === "e#") n = "f"; if (n === "b#") n = "c";
  const pc = NOTE_NAMES.indexOf(n);
  if (pc < 0) return null;
  const minor = hit[4] && hit[4] !== "maj" && hit[4] !== "major";
  return { pc, name: n.toUpperCase() + (minor ? "m" : "") };
}
function hzToMidi(hz) { return 69 + 12 * Math.log2(hz / 440); }
// Semitones that move a root to the nearest note of pitch class pc (-6..+5).
function tuneTo(rootHz, pc) {
  if (!rootHz || pc == null) return 0;
  const m = hzToMidi(rootHz); const cur = ((Math.round(m) % 12) + 12) % 12;
  let d = pc - cur; if (d > 5) d -= 12; if (d < -6) d += 12;
  return d + (Math.round(m) - m);
}

// Merges global + scenes + slot wants into one want for a slot.
function slotWant(p, slot) {
  const w = emptyWant();
  const g = p.global;
  addTags(w, Object.keys(g.tags), 0); Object.keys(g.tags).forEach((t) => { w.tags[t] = (w.tags[t] || 0) + g.tags[t] * (slot === "texture" || slot === "fx" ? 0.6 : 1); });
  addHints(w, g.hints, slot === "texture" || slot === "fx" ? 0.5 : 1);
  if (DRUM_SLOTS.indexOf(slot) >= 0 || slot === "fx") Object.assign(w.params, g.params);
  if (DRUM_SLOTS.indexOf(slot) >= 0) { w.fx.push(...g.fx.filter((k) => k !== "reverb" || slot === "snare" || slot === "clap" || slot === "perc")); }
  w.noFx.push(...g.noFx);
  p.scenes.forEach((sc) => {
    const S = SCENES[sc];
    addTags(w, S.g, 0.7);
    addHints(w, S.h, slot === "texture" || slot === "fx" ? 0.4 : 1);
    if (S.p && DRUM_SLOTS.indexOf(slot) >= 0) Object.keys(S.p).forEach((k) => { if (w.params[k] === undefined) w.params[k] = S.p[k]; });
    const ss = S.s && S.s[slot];
    if (ss) { addTags(w, ss.t, 1.2); addHints(w, ss.h, 1); if (ss.p) Object.assign(w.params, ss.p); if (ss.x) w.fx.push(...ss.x); }
  });
  const s = p.slots[slot];
  if (s) { Object.keys(s.tags).forEach((t) => { w.tags[t] = (w.tags[t] || 0) + s.tags[t] * 1.3; }); addHints(w, s.hints, 1.4); Object.assign(w.params, s.params); w.fx.push(...s.fx); w.noFx.push(...s.noFx); }
  w.fx = uniq(w.fx).filter((k) => w.noFx.indexOf(k) < 0 && FX_KINDS.indexOf(k) >= 0);
  return w;
}
const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);

// ---------------------------------------------------------------------------
// Scoring.

function candidates(slot) {
  let c = state.bySlot[slot] || [];
  // kick pad: no 1.5 s+ 808 kicks and no thin clicks (bottom 25% low end) (7 Nov; KD_KICK_PICK_OLD = old)
  if (slot === "kick" && !(root && root.KD_KICK_PICK_OLD)) { const k = c.filter((it) => (it.duration_s || 0) <= 1.5 && dv(it, "low") >= 0.25); if (k.length >= 20) return k; }
  if (c.length) return c;
  if (slot === "hat_open") return (state.bySlot.hat_closed || []).slice().sort((a, b) => dv(b, "decay") - dv(a, "decay")).slice(0, 12);
  if (slot === "808") return (state.bySlot.kick || []).filter((it) => dv(it, "decay") > 0.5 && dv(it, "tonal") > 0.4);
  if (slot === "perc") return (state.bySlot.fx || []).filter((it) => (it.duration_s || 1) < 0.6);
  if (slot === "texture") return (state.bySlot.fx || []).filter((it) => it.loop || (it.duration_s || 0) > 2);
  return c;
}

function tagScore(it, want, slot) {
  let s = 0; const df = state.df[slot] || {};
  Object.keys(want.tags).forEach((t) => {
    const w = want.tags[t];
    if (!w) return;
    const rare = 1 - 0.7 * Math.min(1, df[t] || df[stem(t)] || 0);
    if (hasTag(it, t)) { s += w * rare; return; }
    const gs = GROUP_OF[t];
    if (gs && w > 0) for (const g of gs) { if (g.some((m) => m !== t && hasTag(it, m))) { s += w * 0.45 * rare; break; } }
  });
  return s;
}
function hintScore(it, hints) { let s = 0; Object.keys(hints).forEach((k) => { s += hints[k] * (dv(it, k) - 0.5) * 2; }); return s; }
function prior(it, slot) {
  let s = 0.25 * (typeof it.q === "number" ? it.q : 0.6) + 0.45 * (typeof it.pop === "number" ? it.pop : 0.15);
  if (it.placeholder) s -= 0.04;
  const loop = it.loop || / (loop|lp|roll|fill|groove|break) /.test(it._text);
  if (loop && slot !== "texture") s -= 0.8;
  if (slot === "texture" && loop) s += 0.2;
  if ((slot === "texture" || slot === "fx") && / (drums?|kick|snare|clap|hihat|hat|break|beat|groove|top) /.test(it._text)) s -= 1;
  // Eman, 7 Nov ("the kicks don't hit at all"): a kick pad wants a short kick with real low end and
  // punch, not a 2-second 808 kick or a thin click. KD_KICK_PICK_OLD = old.
  if (slot === "kick" && !(root && root.KD_KICK_PICK_OLD)) {
    if ((it.duration_s || 0) > 1.2) s -= 1.4;
    if (dv(it, "low") < 0.3) s -= 1.4;
    s += 0.3 * (dv(it, "low") - 0.5) + 0.3 * (dv(it, "punch") - 0.5);
  }
  return s;
}
// Eman (27 Oct): BEAT should play tight, dry sounds. Drum pads skip sounds with reverb/room/echo
// baked in unless the vibe asks for a wet sound (fx and texture pads may stay wet).
const WET_RE = / (reverb|reverbs|verb|hall|room|roomy|wet|ambient|ambience|echo|echoes|delay|delayed|tail|tails|cathedral|spacey|cavern|cave) /;
const WET_ASK = ["reverb", "reverby", "verb", "roomy", "room", "wet", "spacey", "ambient", "hall", "echo", "delay", "gated", "long", "tails"];
function wetPenalty(it, want, slot) {
  if (slot === "fx" || slot === "texture") return 0;
  if (WET_ASK.some((t) => want.tags && want.tags[t] > 0)) return 0;
  prep(it);
  return WET_RE.test(it._text) ? 0.6 : 0;
}
function scoreItem(it, want, slot, jitter, rand) {
  return tagScore(it, want, slot) * 1.0 + hintScore(it, want.hints) * 0.9 + prior(it, slot) - wetPenalty(it, want, slot) + (jitter ? jitter * rand() : 0);
}

function rank(slot, want, opts) {
  const o = opts || {}; const rand = o.rand || rng(1); const ex = o.exclude || new Set();
  const avoid = o.avoid || {};
  // near-silent files (some Splice preview placeholders peak under -30 dBFS) never go on a pad
  return candidates(slot).filter((it) => !ex.has(it.id) && !(it.m && it.m.peak_db < -30) && (!o.filter || o.filter(it)))
    .map((it) => ({ it, s: scoreItem(it, want, slot, o.jitter || 0, rand) - 0.35 * (avoid[it.id] || 0) })).sort((a, b) => b.s - a.s);
}

// ---------------------------------------------------------------------------
// vibe(text) -> kit

function nameFor(p, text) {
  const n = uniq(p.named.map((w) => w.replace(/(^|\s)\S/g, (c) => c.toUpperCase())));
  const scene = n.find((w) => Object.keys(SCENES).some((k) => SCENES[k].label === w));
  const adj = n.filter((w) => w !== scene);
  const NOUN = { Crunchy: "Crunch", Distorted: "Dirt", Dirty: "Dirt", Muffled: "Haze", Long: "Tails", Punchy: "Punch", Boomy: "Boom",
    Dark: "Dark", Lofi: "Dust", Dusty: "Dust", Gritty: "Grit", Wide: "Wide", Short: "Snap", Heavy: "Weight", Evil: "Evil", Soft: "Soft" };
  const parts = [];
  if (adj[0]) parts.push(adj[0]);
  if (scene) parts.push(scene);
  if (adj[1]) parts.push(NOUN[adj[1]] || adj[1]);
  if (!parts.length) { const w = words(text).filter((x) => !STOP.has(x)).slice(0, 2); w.forEach((x) => parts.push(x[0].toUpperCase() + x.slice(1))); }
  return parts.join(" ").slice(0, 32) || "Vibe Kit";
}

function shortName(it) { return it ? String(it.name || it.id).replace(/\s*\(.*?\)\s*/g, " ").trim() : "none"; }

function describe(it) {
  if (!it) return "";
  prep(it);
  // The index's tags already pick one word of each pair (and the sound's own tags win), so use them first.
  const pick = (a, b, k, hi, lo) => (it._t.has(a) ? a : it._t.has(b) ? b : dv(it, k) > hi ? a : dv(it, k) < lo ? b : "");
  return [pick("distorted", "clean", "dirt", 0.8, 0.15), pick("dark", "bright", "bright", 2, -1) || pick("bright", "dark", "bright", 0.8, 0.2),
    pick("punchy", "soft", "punch", 0.8, 0.2), pick("long", "short", "decay", 0.8, 0.2), it._t.has("wide") ? "wide" : ""].filter(Boolean).slice(0, 3).join(" ");
}

function resolve(p, text, opts) {
  const o = opts || {};
  const rand = rng(o.seed != null ? o.seed : hashStr(String(text)));
  const jitter = o.jitter != null ? o.jitter : 0.08;
  const keep = o.keep || {};
  const pads = {}; const params = {}; const fx = {}; const used = new Set(); const picked = {};
  SLOTS.forEach((slot) => {
    if (keep[slot]) { pads[slot] = keep[slot]; used.add(keep[slot]); return; }
    const want = slotWant(p, slot);
    const r = rank(slot, want, { rand, jitter, exclude: used, avoid: o.avoid });
    if (!r.length) return;
    const it = r[0].it; pads[slot] = it.id; used.add(it.id); picked[slot] = it;
    const pr = {};
    Object.keys(want.params).forEach((k) => { pr[k] = want.params[k]; });
    if (p.key && (slot === "808" || (it.root_hz && (slot === "perc" || slot === "kick") && dv(it, "tonal") > 0.6))) {
      const st = tuneTo(it.root_hz, p.key.pc); if (st) pr.pitch = r2(st);
    }
    if (Object.keys(pr).length) params[slot] = cleanParams(pr);
    if (want.fx.length) fx[slot] = want.fx.slice(0, 3);
  });
  return { pads, params, fx, picked };
}

function cleanParams(pr) {
  const o = {};
  if (pr.pitch != null) o.pitch = r2(clamp(pr.pitch, -24, 24));
  if (pr.decay != null) o.decay = r2(clamp(pr.decay, 0, 1));
  if (pr.drive != null) o.drive = r2(clamp(pr.drive, 0, 1));
  if (pr.cutoff != null) o.cutoff = r2(clamp(pr.cutoff, 0, 1));
  if (pr.pan != null) o.pan = r2(clamp(pr.pan, -1, 1));
  if (pr.level != null) o.level = r2(clamp(pr.level, -24, 12));
  return o;
}

function sayKit(name, picked, p, params) {
  const bits = [];
  ["808", "kick", "snare", "clap", "hat_closed", "fx"].forEach((s) => {
    const it = picked[s]; if (!it) return;
    const want = p.slots[s] || (s === "808" && p.scenes.length) ? describe(it) : "";
    if (p.mentioned.indexOf(s) >= 0 || (s === "808" && p.scenes.length) || bits.length < 2) bits.push((want ? want + " " : "") + SLOT_LABEL[s] + " (" + shortName(it) + ")");
  });
  let s = name + ": " + bits.slice(0, 4).join(", ") + ".";
  if (p.key && params["808"] && params["808"].pitch != null) s += " 808 tuned to " + p.key.name + ".";
  return s;
}

function vibe(text, opts) {
  const p = parse(text || "");
  const o = opts || {};
  const k = resolve(p, text, o);
  const name = o.name || nameFor(p, text);
  return { name, vibe: String(text || ""), pads: k.pads, params: k.params, fx: k.fx, say: sayKit(name, k.picked, p, k.params) };
}

// Ranked sounds for one text (assistant tool "find me a sword"): [{ id, name, type, url, score, why }]
function search(text, opts) {
  const o = opts || {};
  const p = parse(text || "");
  const slots = o.slot ? [o.slot] : (p.mentioned.length ? p.mentioned : SLOTS);
  const out = [];
  slots.forEach((slot) => rank(slot, slotWant(p, slot), { jitter: 0 }).slice(0, o.n || 12)
    .forEach((r) => out.push({ id: r.it.id, name: r.it.name, type: r.it.type, url: r.it.url, score: r2(r.s), why: describe(r.it), placeholder: !!r.it.placeholder })));
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, o.n || 12);
}

// ---------------------------------------------------------------------------
// follow(text, kit) -> { changes, say }

const SWAP_RE = /\b(change|swap|replace|switch|different|another|other|new|find|get|try|use|give me|pick|choose|instead|exchange)\b/;
const ROLL_RE = /\b(random|randomi[sz]e|roll|dice|shuffle|surprise|reroll|re-roll)\b/;
const ADD_FX_RE = /\b(add|put|give|throw|more|some|with|on|apply|slap)\b/;
const REMOVE_FX_RE = /\b(remove|take off|take away|no|without|kill|drop|less|off|lose|delete|dry)\b/;
const ALL_RE = /\b(everything|all|whole|kit|it|drums|the beat|overall)\b/;

function padOf(kit, slot) {
  const p = kit && kit.pads && kit.pads[slot];
  if (!p) return null;
  return typeof p === "string" ? { sound: p } : p;
}

function follow(text, kit) {
  let t = String(text || "").toLowerCase().replace(/[\u2019]/g, "'");
  COMPLAINTS.forEach(([re, to]) => { t = t.replace(re, to); });
  const changes = []; const said = [];
  const clauses = t.split(/[,;.!?\n]+|\s(?:and then|and|then|also|plus)\s/).map((c) => c.trim()).filter(Boolean);
  let lastSlots = []; const swapped = new Set();
  clauses.forEach((c) => {
    const p = parse(c);
    let slots = p.mentioned.slice();
    if (!slots.length && lastSlots.length && /\b(it|that|them|this one|too)\b/.test(c)) slots = lastSlots.slice();
    const allKit = !slots.length;
    if (slots.length) lastSlots = slots;
    const targetSlots = allKit ? SLOTS.filter((s) => padOf(kit, s)) : slots;

    // Effect cards: "add reverb to the clap", "no delay on the hats".
    const fxKinds = uniq(Object.keys(FX_WORDS).filter((w) => new RegExp("(^|\\s)" + w.replace(/[-]/g, "\\-") + "(\\s|$)").test(c)).map((w) => FX_WORDS[w]));
    const wantsFx = fxKinds.length && !(SWAP_RE.test(c) && /\b(more|less)\s+(distorted|dirty|gritty|crunchy|clipped)\b/.test(c) && !/\b(add|put|apply)\b/.test(c));
    if (wantsFx) {
      const remove = REMOVE_FX_RE.test(c) && !/\b(add|put|apply)\b/.test(c);
      const fxSlots = allKit ? (fxKinds.indexOf("reverb") >= 0 ? ["snare", "clap"] : DRUM_SLOTS).filter((s) => padOf(kit, s)) : targetSlots;
      fxSlots.forEach((s) => fxKinds.forEach((k) => changes.push(remove ? { slot: s, removeFx: k } : { slot: s, addFx: k })));
      said.push((remove ? "took " + fxKinds.join(" + ") + " off " : "added " + fxKinds.join(" + ") + " to ") + fxSlots.map((s) => "the " + SLOT_LABEL[s]).join(", "));
      return;
    }

    // Level / pitch / pan words act on the pad, never swap.
    const lvl = /\b(louder|turn (it |them )?up|boost|more volume)\b/.test(c) ? 3 : /\b(quieter|softer volume|turn (it |them )?down|lower the volume|less volume|lower volume|too loud)\b/.test(c) ? -3 : /\bmute\b/.test(c) ? -24 : 0;
    const semis = parseSemis(c);
    const panTo = /\bpan\b/.test(c) ? (/\bleft\b/.test(c) ? -0.5 : /\bright\b/.test(c) ? 0.5 : /\bcent(er|re)\b/.test(c) ? 0 : null) : null;
    const tune = p.key && /\btun|\bkey\b/.test(c);
    if ((lvl || semis != null || panTo != null || tune) && !SWAP_RE.test(c)) {
      targetSlots.forEach((s) => {
        const pad = padOf(kit, s) || {}; const pr = {};
        if (lvl) pr.level = lvl === -24 ? -24 : clamp((pad.level || 0) + lvl * (/\b(much|way|a lot)\b/.test(c) ? 2 : 1), -24, 12);
        if (semis != null) pr.pitch = clamp((pad.pitch || 0) + semis, -24, 24);
        if (tune) { const it = state.byId.get(pad.sound); if (it && it.root_hz) pr.pitch = r2(tuneTo(it.root_hz, p.key.pc)); }
        if (panTo != null) pr.pan = panTo;
        if (Object.keys(pr).length) changes.push({ slot: s, params: cleanParams(pr) });
      });
      const who = targetSlots.length >= 7 ? "the whole kit" : "the " + targetSlots.map((s) => SLOT_LABEL[s]).join(", ");
      said.push(lvl ? (lvl === -24 ? "muted " + who : (lvl > 0 ? "turned up " : "turned down ") + who) :
        semis != null ? "pitched " + who + (semis > 0 ? " up " : " down ") + Math.abs(r2(semis)) + " st" :
        panTo != null ? "panned " + who + (panTo < 0 ? " left" : panTo > 0 ? " right" : " to the centre") : "tuned " + who + " to " + p.key.name);
      return;
    }

    // Dice: "randomize the hats", "surprise me".
    if (ROLL_RE.test(c)) {
      const r = roll(kit, slots.length === 1 ? slots[0] : null, hashStr(c + Date.now()));
      (slots.length ? slots : SLOTS).forEach((s) => { if (r.pads[s] && (!padOf(kit, s) || r.pads[s] !== padOf(kit, s).sound)) changes.push({ slot: s, sound: r.pads[s] }); });
      said.push("rolled " + (slots.length ? slots.map((s) => "the " + SLOT_LABEL[s]).join(", ") : "a new kit"));
      return;
    }

    // Character change: swap the sound (swap verbs, or nothing a knob can do), or turn a knob.
    const isSwap = SWAP_RE.test(c);
    targetSlots.forEach((s) => {
      const pad = padOf(kit, s); const cur = pad && state.byId.get(pad.sound);
      const sw = slotWant(p, s);
      const sl = p.slots[s] || p.global;
      const hints = Object.assign({}, sl.hints);
      if (!allKit || p.scenes.length) p.scenes.forEach((sc) => { const ss = SCENES[sc].s && SCENES[sc].s[s]; addHints({ hints }, SCENES[sc].h, 1); if (ss) addHints({ hints }, ss.h, 1); });
      const knob = !isSwap && !p.scenes.length ? knobFor(hints, pad || {}) : null;
      if (knob) { changes.push({ slot: s, params: knob.params }); said.push(knob.say + " the " + SLOT_LABEL[s]); return; }
      if (!Object.keys(hints).length && !Object.keys(sw.tags).length && !isSwap) return;
      const named = Object.keys((p.slots[s] || p.global).tags).filter((tg) => (p.slots[s] || p.global).tags[tg] > 0 && !WORDS[tg] && !GROUP_OF[tg]);
      const pick = swapPick(s, cur, hints, sw, hashStr(c + (cur ? cur.id : "")), named.concat(Object.keys((p.slots[s] || {}).tags || {}).filter((tg) => SLOT_TAG_WORDS.has(tg))));
      if (swapped.has(s)) { said.push("kept the first pick for the " + SLOT_LABEL[s] + " (one pad)"); return; }
      if (pick && (!cur || pick.id !== cur.id)) {
        const ch = { slot: s, sound: pick.id }; swapped.add(s);
        if (sw.fx.length) sw.fx.forEach((k) => { if (!pad || !pad.fx || pad.fx.indexOf(k) < 0) changes.push({ slot: s, addFx: k }); });
        changes.push(ch);
        said.push("swapped the " + SLOT_LABEL[s] + " for " + shortName(pick) + (describe(pick) ? " (" + describe(pick) + ")" : ""));
      }
    });
  });
  const say = said.length ? cap(squash(said).join("; ")) + "." : "I didn't catch what to change. Try \"darker snare\", \"add reverb to the clap\" or \"randomize the hats\".";
  return { changes: dedupeChanges(changes), say };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "darkened the kick; darkened the 808; ..." -> "darkened the kick, 808, snare ..." (or "the whole kit").
function squash(said) {
  const out = []; const by = {};
  said.forEach((x) => {
    const m = x.match(/^(.*?) the (kick|808|snare|clap|hats|open hat|perc|fx|texture)$/);
    if (!m) { out.push(x); return; }
    if (by[m[1]] == null) { by[m[1]] = out.length; out.push({ v: m[1], s: [] }); }
    out[by[m[1]]].s.push(m[2]);
  });
  return out.map((o) => (typeof o === "string" ? o : o.v + (o.s.length >= 7 ? " the whole kit" : " the " + o.s.join(", "))));
}

function dedupeChanges(ch) {
  const out = []; const seen = {};
  ch.forEach((c) => {
    const k = c.slot + "|" + (c.sound ? "sound" : c.params ? "params" : c.addFx ? "add" + c.addFx : "rm" + c.removeFx);
    if (seen[k] != null) { out[seen[k]] = c.params ? { slot: c.slot, params: Object.assign({}, out[seen[k]].params, c.params) } : c; return; }
    seen[k] = out.length; out.push(c);
  });
  return out;
}

function parseSemis(c) {
  if (/\boctave (up|higher)|up an octave|octave higher|\+12\b/.test(c)) return 12;
  if (/\boctave (down|lower)|down an octave|octave lower|-12\b/.test(c)) return -12;
  const m = c.match(/\b(up|down)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*(semitones?|semis?|st|half ?steps?|steps?|notes?)?\b/);
  if (m && (m[3] || /\b(pitch|tune|transpose|shift)/.test(c))) return (m[1] === "up" ? 1 : -1) * parseFloat(m[2]);
  const m2 = c.match(/([+-]\d+(?:\.\d+)?)\s*(semitones?|semis?|st)\b/);
  if (m2) return parseFloat(m2[1]);
  if (/\bpitch(ed)? (it |them |\w+ )?down\b|\blower (the )?pitch\b|\btune (it |them |\w+ )?down\b/.test(c)) return -2;
  if (/\bpitch(ed)? (it |them |\w+ )?up\b|\bhigher pitch\b|\braise (the )?pitch\b|\btune (it |them |\w+ )?up\b/.test(c)) return 2;
  return null;
}

// A knob that does what was asked, for "make the snare darker" (no swap verb). null = needs a new sound.
function knobFor(h, pad) {
  const keys = Object.keys(h).filter((k) => Math.abs(h[k]) > 0.2);
  if (!keys.length || keys.some((k) => ["bright", "dirt", "decay"].indexOf(k) < 0)) return null;
  const pr = {}; const say = [];
  if (h.bright) { const c0 = pad.cutoff != null ? pad.cutoff : 1; const c1 = clamp(c0 + (h.bright > 0 ? 0.2 : -0.2) * Math.min(2, Math.abs(h.bright)), 0.1, 1); if (Math.abs(c1 - c0) < 0.05) return null; pr.cutoff = c1; say.push(h.bright > 0 ? "opened the filter on" : "darkened"); }
  if (h.dirt) { const d0 = pad.drive || 0; const d1 = clamp(d0 + (h.dirt > 0 ? 0.25 : -0.25) * Math.min(2, Math.abs(h.dirt)), 0, 1); if (Math.abs(d1 - d0) < 0.05) return null; pr.drive = d1; say.push(h.dirt > 0 ? "pushed the drive on" : "cleaned up"); }
  if (h.decay) { const d0 = pad.decay != null ? pad.decay : 1; const d1 = clamp(d0 + (h.decay > 0 ? 0.25 : -0.3) * Math.min(2, Math.abs(h.decay)), 0.05, 1); if (Math.abs(d1 - d0) < 0.05) return null; pr.decay = d1; say.push(h.decay > 0 ? "lengthened" : "shortened"); }
  return { params: cleanParams(pr), say: say.join(" and ") };
}

// Best new sound for a slot that moves in the asked direction from the current one, staying close otherwise.
// Things named outright ("a sword", "a cowbell") must be that thing when the library has one.
function swapPick(slot, cur, hints, want, seed, named) {
  const rand = rng(seed);
  const hk = Object.keys(hints).filter((k) => Math.abs(hints[k]) > 0.15);
  let list = candidates(slot).filter((it) => !cur || it.id !== cur.id);
  if (!list.length) return null;
  const nouns = (named || []).filter((t) => list.some((it) => hasTag(it, t)));
  if (nouns.length) list = list.filter((it) => nouns.some((t) => hasTag(it, t)));
  let pool = list;
  if (cur && hk.length) {
    const moved = list.filter((it) => hk.every((k) => (dv(it, k) - dv(cur, k)) * Math.sign(hints[k]) > 0.04));
    if (moved.length >= 1) pool = moved;
  }
  const scored = pool.map((it) => {
    let s = tagScore(it, want, slot) + prior(it, slot) * 0.6;
    hk.forEach((k) => { s += hints[k] * (dv(it, k) - (cur ? dv(cur, k) : 0.5)) * 2; });
    if (cur) DIMS.forEach((k) => { if (hk.indexOf(k) < 0) s -= Math.abs(dv(it, k) - dv(cur, k)) * (nouns.length ? 0.15 : 0.6); });
    return { it, s: s + 0.15 * rand() };
  }).sort((a, b) => b.s - a.s);
  return scored[0].it;
}

// ---------------------------------------------------------------------------
// roll(kit, slot?, seed?) -> kit like vibe()

function roll(kit, slot, seed) {
  const sd = seed != null ? seed : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const rand = rng(sd);
  const text = (kit && kit.vibe) || "";
  const cur = {};
  SLOTS.forEach((s) => { const p = padOf(kit, s); if (p && p.sound) cur[s] = p.sound; });
  if (!kit || (!text && !Object.keys(cur).length)) {
    const r = RECIPES[Math.floor(rand() * RECIPES.length)];
    const k = vibe(r.vibe, { seed: sd, jitter: 1.2, name: r.name });
    return Object.assign(k, { say: "Rolled from " + r.name + ". " + k.say });
  }
  const p = parse(text);
  const keep = {};
  if (slot) SLOTS.forEach((s) => { if (s !== slot && cur[s]) keep[s] = cur[s]; });
  const pads = {}; const params = {}; const fx = {}; const used = new Set(Object.values(keep));
  SLOTS.forEach((s) => {
    if (keep[s]) { pads[s] = keep[s]; return; }
    const curIt = state.byId.get(cur[s]);
    const want = slotWant(p, s);
    // Without a vibe text, stay near the current sound's character.
    if (!text && curIt) DIMS.forEach((k) => { want.hints[k] = (want.hints[k] || 0) + (dv(curIt, k) - 0.5) * 1.2; });
    const r = rank(s, want, { rand, jitter: 1.4, exclude: new Set([...used, cur[s]].filter(Boolean)) });
    if (!r.length) { if (cur[s]) pads[s] = cur[s]; return; }
    const top = r.slice(0, 10);
    const pick = top[Math.floor(rand() * top.length)].it;
    pads[s] = pick.id; used.add(pick.id);
    if (Object.keys(want.params).length) params[s] = cleanParams(want.params);
    if (want.fx.length) fx[s] = want.fx.slice(0, 3);
  });
  const name = (kit && kit.name) || nameFor(p, text);
  const picked = state.byId.get(pads[slot || "snare"]);
  return { name, vibe: text, pads, params, fx, say: slot ? "New " + SLOT_LABEL[slot] + ": " + shortName(picked) + "." : "Rolled a new " + name + " kit." };
}

// ---------------------------------------------------------------------------
// Starter kits. Each is a vibe text plus optional per-slot extras; bake_kits.js resolves them
// against the index into KITS.json, and kits() falls back to resolving them live.

const RECIPES = [
  { id: "opium-night", name: "Opium Night", vibe: "dark opium carti kit, long distorted 808s, crisp tight hats, dark snare, laser fx, tape hiss texture" },
  { id: "rage-fold", name: "Rage Fold", vibe: "rage, blown out fuzz 808, hard distorted kick, distorted clap, crunchy hats, impact fx" },
  { id: "carti-vamp", name: "Vamp Anthem", vibe: "carti vamp, evil distorted 808, punchy kick, bright crisp snare, glitch fx, dark texture" },
  { id: "blue-hour", name: "Blue Hour", vibe: "blue hour, muffled soft drums, round warm long 808, reverb snare, rain texture, wide" },
  { id: "snowfall", name: "Snowfall", vibe: "snowfall, very muffled underwater kit, soft kick, round sub 808, airy hats, vinyl texture, reverse fx" },
  { id: "tame-dust", name: "Tame Dust", vibe: "tame impala, dusty warm roomy drums, big reverb snare, shaker perc, tape texture" },
  { id: "castle-crunch", name: "Castle Crunch", vibe: "crystal castles, bitcrushed crunchy everything, chiptune blip fx, static texture" },
  { id: "skrill-smash", name: "Skrill Smash", vibe: "skrillex, hard punchy kick, big bright snare, distorted 808, impact and laser fx" },
  { id: "warehouse", name: "Warehouse", vibe: "hard techno, punchy short kick, tight hats, reverb clap, metallic perc, rumble texture" },
  { id: "plastic-beach", name: "Plastic Beach", vibe: "gorillaz, dusty boom bap kick and snare, conga perc, vinyl crackle texture" },
  { id: "neon-pop", name: "Neon Pop", vibe: "icona pop, bright punchy kick, big bright clap, open hat, riser fx" },
  { id: "villain-drill", name: "Villain Drill", vibe: "dark drill, slide 808, crisp snare, rim perc, tight hats, sinister fx" },
  { id: "phonk-drift", name: "Phonk Drift", vibe: "phonk, distorted cowbell, dirty 808, punchy kick, crunchy hats" },
  { id: "bicep-nights", name: "Bicep Nights", vibe: "bicep, house kick, crisp clap, shaker perc, airy hats, wide texture" },
  { id: "overmono-garage", name: "Overmono Garage", vibe: "overmono uk garage, punchy kick, snappy snare, crisp hats, metallic perc" },
  { id: "fred-tape", name: "Fred Tape", vibe: "fred again, warm soft kick, roomy clap, tape texture, dreamy" },
  { id: "genesis-888", name: "888 Genesis", vibe: "888genesis eman, hard kick, long distorted 808, crisp clap, riser fx" },
  { id: "cassette-ghost", name: "Cassette Ghost", vibe: "cassette vhs lofi, dusty muffled kit, gritty 808, tape hiss texture, dark" },
  { id: "glass-hyper", name: "Glass Hyper", vibe: "hyperpop, bright glitchy crunchy kit, glass fx, metallic perc" },
  { id: "dub-pressure", name: "Dub Pressure", vibe: "dubstep, heavy boomy kick, huge snare with reverb, growl 808, braam impact fx" },
  { id: "basement-boom", name: "Basement Boom Bap", vibe: "boom bap hip hop, dusty punchy kick, crisp dusty snare, rim perc, vinyl texture" },
  { id: "cinema-doom", name: "Cinema Doom", vibe: "cinematic epic, boomy kick, reverb snare, sword fx, wind texture, dark" },
  { id: "analog-808", name: "Analog 808", vibe: "classic clean analog 808 kit, round long 808, clean kick, 808 snare, cowbell perc" },
  { id: "glitch-lab", name: "Glitch Lab", vibe: "glitchy experimental kit, bitcrushed perc, glitch fx, static texture, short tight hats" },
  { id: "gated-80s", name: "Gated 80s", vibe: "80s synthwave, gated reverb snare, punchy kick, bright clap, crash open hat" },
  { id: "samurai", name: "Samurai", vibe: "anime samurai, sword blade fx, punchy kick, crisp snare, wind texture, dark 808" },
];

// avoid = { soundId: times used by earlier kits }, so the starter kits don't all share one hat.
function bakeRecipe(r, avoid) {
  const k = vibe(r.vibe, { name: r.name, seed: hashStr(r.id), avoid });
  if (avoid) Object.values(k.pads).forEach((id) => { avoid[id] = (avoid[id] || 0) + 1; });
  return cleanKit({ id: r.id, name: r.name, vibe: r.vibe, tags: uniq(parse(r.vibe).named.map((w) => w.toLowerCase())).slice(0, 6), pads: k.pads, params: k.params, fx: k.fx, say: k.say });
}
function kits() { return state.kits; }
function items() { return state.items; }
function item(id) { return state.byId.get(id) || null; }

// The kit a new KILLDRUM lane starts with (playground.js REAL_KIT keeps the same ids): real Splice
// one-shots, a short kick with real low end. bake_kits.js always ships these on the page.
const DEFAULT_PADS = { 36: "sp-os-nbb-kick-streets-862ed", 35: "sp-os-flint-808-clean-c-e3c03", 37: "sp-decap-dtk11-perc-high-stick-dry-a6c1c",
  38: "sp-ss-snare-carry-on-6efd2", 39: "sp-ts-bpd-clap-group-small-7d6ab", 42: "sp-x10-glo-closed-hat-brother-1685d",
  46: "sp-zen-fth-hi-hat-open-doha-5576c", 49: "sp-91v-sgr-138-fx-one-shot-spinning-scratch-7a816", 51: "sp-orbit-st-fx-vinyl-crackle-2e178" };

const api = { SLOTS, NOTES, FX_KINDS, RECIPES, DEFAULT_PADS, load, setData, items, item, kits, vibe, follow, roll, search, describe, parse, bakeRecipe, tuneTo };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (root) root.KillDrumLib = api;
})(typeof window !== "undefined" ? window : null);
