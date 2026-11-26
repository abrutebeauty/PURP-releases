// CHORD BRAIN (Eman, 8 Nov): the dice's musical brain. Words and dials in, a chord plan out.
//
// It is fed by real songs: chord-brain-data.json holds, for every genre, mood word, era and
// artist we analysed (Chordonomicon 680k songs, Hooktheory 26k lead sheets, Lakh MIDI 31k,
// POP909), how chords move (which chord follows which, relative to the key), which loops are
// common, how colourful the chords are (7ths, 9ths), how often they leave the key, and for
// the artists with melodies, how their melodies move. A prompt like "radiohead sad cinematic"
// picks those profiles and mixes them; the dials (pace, rhythm, voices, colour, tension,
// random, range) shape the result. Nothing here needs the internet: the data file is built
// offline by scripts/chords/build_brain_data.py and shipped with the app.
//
// Chord tokens: "<root semitones above the tonic><quality>", e.g. "0m" (i), "8" (VI in minor),
// "7m7" (v7), "10" (VII), "5sus4". A move is "a>b". Everything is relative to the key, so a
// profile learned from songs in any key plays in Eman's key.
//
// window.ChordBrain = { load(data), roll(params), parsePrompt(text), profilesFor(text), words() }
(() => {
  const QUAL = {   // quality -> intervals above the root (pitch classes)
    "": [0, 4, 7], "m": [0, 3, 7], "dim": [0, 3, 6], "aug": [0, 4, 8], "sus2": [0, 2, 7], "sus4": [0, 5, 7], "5": [0, 7],
    "7": [0, 4, 7, 10], "M7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "mM7": [0, 3, 7, 11], "dim7": [0, 3, 6, 9], "m7b5": [0, 3, 6, 10],
    "6": [0, 4, 7, 9], "m6": [0, 3, 7, 9], "add9": [0, 4, 7, 14], "madd9": [0, 3, 7, 14], "9": [0, 4, 7, 10, 14], "M9": [0, 4, 7, 11, 14], "m9": [0, 3, 7, 10, 14],
    "11": [0, 4, 7, 10, 14, 17], "m11": [0, 3, 7, 10, 14, 17], "13": [0, 4, 7, 10, 14, 21], "7sus4": [0, 5, 7, 10], "7b9": [0, 4, 7, 10, 13], "7#9": [0, 4, 7, 10, 15],
  };
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
    major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
    melodic: [0, 2, 3, 5, 7, 9, 11], phrygdom: [0, 1, 4, 5, 7, 8, 10], hungarian: [0, 2, 3, 6, 7, 8, 11], double: [0, 1, 4, 5, 7, 8, 11],
  };
  const MINORISH = new Set(["minor", "dorian", "phrygian", "harmonic", "locrian", "melodic", "phrygdom", "hungarian"]);
  const pc = (p) => ((p % 12) + 12) % 12;
  // a token is <root 0..11><quality> with no separator, and qualities can start with a digit ("107" = root 10 + "7",
  // "17" = root 1 + "7", "15" = root 1 + "5"): take the two-digit root when the rest is a real quality, else one digit
  const parseTok = (t) => {
    t = String(t);
    for (const L of [2, 1]) { const rs = t.slice(0, L), q = t.slice(L); if (rs.length === L && /^\d+$/.test(rs) && +rs <= 11 && (L === 1 || rs[0] !== "0" || INKEY_OLD()) && QUAL[q] !== undefined) return { r: +rs, q }; }   // "05" is root 0 + "5", never root 5 (roots are never zero-padded)
    const m = /^(\d+)/.exec(t); return m ? { r: +m[1] % 12, q: "" } : { r: 0, q: "" };
  };
  const tok = (r, q) => pc(r) + (q || "");
  // KT2_BRAIN_INKEY_OLD = true brings back the ONLY KEY behaviour before 8 Nov (modal scales could leak a note: "05" read as
  // root 5, and exotic scales had degrees with no named in-scale triad)
  const INKEY_OLD = () => typeof window !== "undefined" && !!window.KT2_BRAIN_INKEY_OLD;
  // the quality to play at root r so that every note sits in the scale: the stack's own name first, then plainer shapes
  const inScaleQual = (st, r, prefer) => {
    const fits = (q) => (QUAL[q] || QUAL[""]).every((x) => st.includes(pc(r + x)));
    for (const q of [...prefer, "m", "", "sus2", "sus4", "dim", "aug", "5"]) if (q != null && fits(q)) return q;
    return null;
  };

  // ---- the built-in brain (used until the data file arrives, and as the floor under every profile) ----
  // Moves counted from Eman's own 64 reference songs (toy-machine/midi/world.json) plus the usual minor and major pop moves.
  const BUILTIN = {
    v: 0, songs: 64,
    profiles: {
      "base:minor": { label: "Minor", kind: "base", n: 39, minor: 1, ext: 0.18, out: 0.06,
        moves: { "0m>8": 18, "8>0m": 12, "0m>10": 11, "3>0m": 9, "10>8": 9, "5m>0m": 8, "0m>7m": 7, "8>10": 8, "10>0m": 7, "3>10": 6, "0m>3": 6, "0m>5m": 6, "8>3": 5, "7m>0m": 5, "10>3": 4, "5m>8": 4, "3>8": 4, "7>0m": 3, "0m>7": 3, "5m>10": 3, "2dim>0m": 2, "8>7": 2, "1>0m": 1 },
        loops: [["0m", "8", "3", "10", 9], ["0m", "5m", "8", "10", 6], ["8", "10", "0m", "0m", 5], ["0m", "10", "8", "10", 5], ["3", "0m", "8", "10", 4], ["0m", "7m", "8", "5m", 4], ["8", "5m", "0m", "7m", 3], ["0m", "3", "10", "5m", 3], ["0m", "8", "5m", "7", 3], ["8", "3", "10", "0m", 3]] },
      "base:major": { label: "Major", kind: "base", n: 25, minor: 0, ext: 0.15, out: 0.05,
        moves: { "0>7": 14, "7>9m": 10, "9m>5": 12, "5>0": 11, "0>9m": 8, "5>7": 9, "7>0": 8, "0>5": 7, "9m>7": 6, "2m>7": 6, "5>9m": 4, "0>2m": 4, "4m>9m": 3, "9m>2m": 3, "7>5": 3, "0>4m": 2, "10>0": 2, "5>2m": 2 },
        loops: [["0", "7", "9m", "5", 7], ["0", "5", "9m", "7", 5], ["9m", "5", "0", "7", 5], ["5", "0", "7", "9m", 4], ["0", "9m", "5", "7", 4], ["5", "7", "4m", "9m", 3], ["0", "2m", "5", "7", 3], ["9m", "7", "5", "7", 2]] },
    },
    words: {},
  };
  let DATA = BUILTIN;
  const load = (d) => { if (d && d.profiles) { DATA = d; for (const k of Object.keys(BUILTIN.profiles)) if (!DATA.profiles[k]) DATA.profiles[k] = BUILTIN.profiles[k]; } return DATA; };
  // SCENES (round 2, 8 Nov, from the research thread's atlas): words and artists -> an underground scene -> a mix of
  // brain profiles plus dial hints (pace, colour, tension, rhythm, swing, range, pop). ui/dice-scenes.json, optional.
  let SCENES = { words: {}, mix: {}, dice: {} };
  const loadScenes = (d) => { if (d && d.words) SCENES = d; return SCENES; };
  // OWN SOURCES (Eman, 12 Nov 2026: "deactivate everything you found online"): the brain learns only from Eman's own
  // songs (ui/chord-brain-own.js: the artist hunts Eman asked for + the 64 reference songs). The big song collection
  // and the scene lists stay on disk and are listed on the UNPERSONAL DATA page, where each one can be switched back
  // into the app (localStorage kt2.use.<id> = "1", read by window.KT2Use(id); the switch applies at once).
  // KT2_OWN_SOURCES_OFF = the old app: every source on, as before.
  const useOn = (id) => { if (typeof window === "undefined") return false; if (window.KT2_OWN_SOURCES_OFF) return true; try { return localStorage.getItem("kt2.use." + id) === "1"; } catch (e) { return false; } };
  if (typeof window !== "undefined" && !window.KT2Use) window.KT2Use = useOn;
  const said = (detail) => { try { if (typeof document !== "undefined" && document.dispatchEvent) document.dispatchEvent(new CustomEvent("chordbrain", { detail })); } catch (e) {} };
  let bigP = null, sceneP = null;
  const getFirst = (urls) => { const get = (i) => (i >= urls.length ? Promise.resolve(null) : fetch(urls[i]).then((r) => (r.ok ? r.json() : Promise.reject(0))).catch(() => get(i + 1))); return get(0); };
  function applySources() {
    const net = typeof fetch === "function";
    if (useOn("scenes") && net) { if (!sceneP) sceneP = getFirst(["dice-scenes.json"]); sceneP.then((d) => { if (d && useOn("scenes")) { loadScenes(d); said({ scenes: Object.keys(d.mix || {}).length }); } }).catch(() => {}); }
    else if (SCENES.words && Object.keys(SCENES.words).length) { SCENES = { words: {}, mix: {}, dice: {} }; said({ scenes: 0 }); }
    if (useOn("chords") && net) { if (!bigP) bigP = getFirst(["chord-brain-data.json", "/_blob/6283aa036950462b720f118d335e99f3"]); bigP.then((d) => { if (d && useOn("chords")) { load(d); said({ songs: d.songs }); } }).catch(() => {}); }
    else if (!useOn("chords") && !DATA.own) { if (typeof window !== "undefined" && window.KT2_OWN_BRAIN) { load(window.KT2_OWN_BRAIN); setTimeout(() => said({ songs: DATA.songs, own: true }), 0); } else DATA = BUILTIN; }
  }
  applySources();
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("storage", (e) => { if (!e.key || /^kt2\.use\./.test(e.key)) applySources(); });
  if (typeof window !== "undefined") window.KT2UseApply = () => { applySources(); try { document.dispatchEvent(new CustomEvent("kt2use")); } catch (e) {} };

  // ---- words -> profiles --------------------------------------------------------------------------
  // The data file maps every word people might type (genres, moods, artists, eras, Swedish words) to profile
  // ids with a weight. Unknown words are ignored. Multi-word names ("fred again", "nine inch nails") match first.
  function norm(t) { return String(t || "").toLowerCase().replace(/[\u2019']/g, "").replace(/[^a-z0-9\u00e0-\u00ff&+ ]+/g, " ").replace(/\s+/g, " ").trim(); }
  // Swedish (Eman writes both): whole words turned into the English the data knows, before matching
  const SV = { melankolisk: "melancholic", melankoliskt: "melancholic", melankoli: "melancholy", glad: "happy", glatt: "happy", lycklig: "happy", lugn: "chill", lugnt: "chill", regn: "rain", regnig: "rainy", regnigt: "rainy", natt: "night", kvall: "evening", kv\u00e4ll: "evening", morgon: "morning", sommar: "summer", vinter: "winter", host: "autumn", h\u00f6st: "autumn", var: "spring", v\u00e5r: "spring", kall: "cold", kallt: "cold", varm: "warm", varmt: "warm", mysig: "cosy", mysigt: "cosy", dyster: "gloomy", dystert: "gloomy", arg: "angry", argt: "angry", snabb: "fast", snabbt: "fast", langsam: "slow", l\u00e5ngsam: "slow", l\u00e5ngsamt: "slow", tung: "heavy", tungt: "heavy", latt: "light", l\u00e4tt: "light", ljus: "bright", ljust: "bright", vacker: "beautiful", vackert: "beautiful", episk: "epic", episkt: "epic", rymd: "space", rymden: "space", kyrka: "church", kyrkan: "church", stad: "city", staden: "city", hav: "sea", havet: "sea", skog: "forest", skogen: "forest", dromsk: "dreamy", dr\u00f6msk: "dreamy", dr\u00f6mskt: "dreamy", drom: "dream", hjarta: "heart", hj\u00e4rta: "heart", ensam: "lonely", ensamt: "lonely", grata: "crying", gr\u00e5ta: "crying", fest: "party", klubb: "club", klubben: "club", dans: "dance", dansa: "dance", svensk: "swedish", svenskt: "swedish", svenska: "swedish", skum: "eerie", skumt: "eerie", laskig: "scary", l\u00e4skigt: "scary", ond: "evil", ont: "evil", elak: "villain", elakt: "villain", bov: "villain", skurk: "villain", gata: "street", gatan: "street", bil: "drive", bilen: "drive", tag: "train", t\u00e5g: "train", sol: "sun", solen: "sun", solnedgang: "sunset", solnedg\u00e5ng: "sunset", dimma: "fog", sno: "snow", sn\u00f6: "snow", is: "ice", eld: "fire", vatten: "water", gammal: "old", gammalt: "old", ny: "new", nytt: "new", modern: "modern", stor: "big", stort: "big", liten: "small", litet: "small", hogt: "high", h\u00f6gt: "high", lagt: "low", l\u00e5gt: "low", djup: "deep", djupt: "deep", mjuk: "soft", mjukt: "soft", hard: "hard", h\u00e5rt: "hard", ren: "clean", rent: "clean", smutsig: "dirty", smutsigt: "dirty", enkel: "simple", enkelt: "simple", konstig: "weird", konstigt: "weird", galen: "crazy", galet: "crazy", rolig: "fun", roligt: "fun", trist: "sad", sorgsen: "sad", sorgset: "sad", vemodig: "melancholic", vemodigt: "melancholic", hopp: "hope", hoppfull: "hopeful", hoppfullt: "hopeful", seger: "triumphant", spannande: "tense", sp\u00e4nnande: "tense", farlig: "dangerous", farligt: "dangerous", dod: "death", d\u00f6d: "death", himmel: "heaven", helvete: "hell", angel: "angel", \u00e4ngel: "angel", kyla: "cold", varme: "warm", v\u00e4rme: "warm", mork: "dark", m\u00f6rk: "dark", m\u00f6rkt: "dark", morkt: "dark",
    // round 2 (8 Nov): slang and everyday words from the lab's Swedish prompts
    skon: "chill", sk\u00f6n: "chill", skont: "chill", sk\u00f6nt: "chill", karlek: "love", k\u00e4rlek: "love", morker: "dark", m\u00f6rker: "dark", sjuk: "crazy", sjukt: "crazy", grym: "epic", grymt: "epic", fet: "heavy", fett: "heavy", drommig: "dreamy", dr\u00f6mmig: "dreamy", drommigt: "dreamy", dr\u00f6mmigt: "dreamy", trakig: "sad", tr\u00e5kig: "sad", trakigt: "sad", tr\u00e5kigt: "sad", nattlig: "night", nattligt: "night", ballad: "ballad", viskande: "whisper", arabisk: "arabic", arabiskt: "arabic", hype: "hype", bangers: "banger", skit: "very", j\u00e4vla: "very", javla: "very", as: "very", sa: "so", s\u00e5: "so", lite: "a bit", mer: "more", mindre: "less", snabbare: "faster", langsammare: "slower", l\u00e5ngsammare: "slower", h\u00f6gre: "higher", hogre: "higher", lagre: "lower", l\u00e4gre: "lower" };
  const swedish = (t) => t.split(" ").map((w) => SV[w] || w).join(" ");
  // the word lists sorted longest first, once per list (the lab calls profilesFor thousands of times)
  const SORTED = new WeakMap();
  const sortedKeys = (obj) => { let k = SORTED.get(obj); if (!k) { k = Object.keys(obj).sort((a, b) => b.length - a.length); SORTED.set(obj, k); } return k; };
  function profilesFor(text) {
    const words = DATA.words || {}, out = new Map(), heard = [], scenes = [];
    let t = " " + swedish(norm(text)) + " ";
    // scene words first (longest first): "memphis rap", "three 6 mafia", "phonk"... each adds its scene's profile mix
    const sw = SCENES.words || {}, skeys = sortedKeys(sw);
    for (const w of skeys) {
      if (w.length < 3) continue;
      const i = t.indexOf(" " + w + " ");
      if (i < 0) continue;
      heard.push(w); t = t.slice(0, i + 1) + t.slice(i + 1 + w.length);
      for (const sid of sw[w]) { if (!scenes.includes(sid)) scenes.push(sid); for (const [pid, wt] of Object.entries(SCENES.mix[sid] || {})) if (DATA.profiles[pid]) out.set(pid, (out.get(pid) || 0) + wt); }
    }
    const keys = sortedKeys(words);
    for (const w of keys) {
      if (w.length < 2) continue;
      const i = t.indexOf(" " + w + " ");
      if (i < 0) continue;
      heard.push(w); t = t.slice(0, i + 1) + t.slice(i + 1 + w.length);
      for (const [pid, wt] of words[w]) if (DATA.profiles[pid]) out.set(pid, (out.get(pid) || 0) + wt);
    }
    // words we don't know exactly: try their stem (sadness -> sad, dreaming -> dream, melankoliskt -> melankolisk)
    // and a long prefix (radioh -> radiohead). Half weight, so a guess never outvotes a known word.
    const rest = [];
    for (const w0 of t.trim().split(" ").filter(Boolean)) {
      const hit = fuzzy(w0, words);
      if (!hit) { rest.push(w0); continue; }
      heard.push(hit + "~");
      for (const [pid, wt] of words[hit]) if (DATA.profiles[pid]) out.set(pid, (out.get(pid) || 0) + wt * 0.5);
    }
    return { profiles: out, heard, rest: rest.join(" "), scenes };
  }
  // the dial hints of the scenes a prompt names, averaged (null when none)
  function sceneDice(scenes) {
    const hints = (scenes || []).map((s) => SCENES.dice[s]).filter(Boolean); if (!hints.length) return null;
    const out = {}; for (const k of ["pace", "colour", "tension", "random", "voices", "rhythm", "swing", "range", "pop"]) { const xs = hints.map((h) => h[k]).filter((x) => x != null); if (xs.length) out[k] = xs.reduce((a, b) => a + b, 0) / xs.length; }
    const sc = hints.map((h) => h.scale).filter(Boolean); if (sc.length) out.scale = sc.sort((a, b) => sc.filter((x) => x === b).length - sc.filter((x) => x === a).length)[0];
    return out;
  }
  const STEMS = [/(iga|igt|ig|are|ast|ande|ende|het|heten|erna|arna|orna|en|et|er|ar|or|na|a|t)$/, /(ness|ingly|ing|edly|ed|ly|ies|es|s|y|er|est|ish|ic|al|ful|less)$/];
  function fuzzy(w, words) {
    if (w.length < 4) return null;
    const tries = [w];
    for (const re of STEMS) { const st = w.replace(re, ""); if (st.length >= 3 && st !== w) { tries.push(st); tries.push(st + "e"); tries.push(st + "y"); } }
    for (const tr of tries) if (words[tr] && tr !== w) return tr;
    if (w.length >= 5 && !/^(the|and|with|from|band|group|project|orchestra|little|big|young|lil|dj|mc|classic|modern|new|old)$/.test(w)) {   // round 2: one word of a known multi-word name (kanye -> kanye west), when it is not ambiguous
      let hits = []; for (const k of Object.keys(words)) if (k.includes(" ") && k.split(" ").includes(w)) hits.push(k);
      if (hits.length === 1) return hits[0];
      if (hits.length > 1 && hits.length <= 3) { hits.sort((a, b) => (((DATA.profiles[(words[b][0] || [])[0]] || {}).n || 0) - ((DATA.profiles[(words[a][0] || [])[0]] || {}).n || 0))); return hits[0]; }
    }
    if (w.length >= 5) {   // a long prefix of a known word, or a known word that starts this one
      let best = null;
      for (const k of Object.keys(words)) {
        if (k.length < 5) continue;
        if ((k.startsWith(w) && k.length - w.length <= 3) || (w.startsWith(k) && w.length - k.length <= 3)) if (!best || Math.abs(k.length - w.length) < Math.abs(best.length - w.length)) best = k;
      }
      return best;
    }
    return null;
  }
  // the mixed melody stats (notes per bar, leaps, chord tones...) of the profiles that have them
  function mixMel(pros) {
    const keys = ["step", "leap", "rep", "dens", "len", "range", "onbeat", "offbeat", "chordtone", "rest", "up", "mid"], acc = {}, wsum = {};
    const add = (m, w) => { for (const k of keys) if (m && m[k] != null) { acc[k] = (acc[k] || 0) + m[k] * w; wsum[k] = (wsum[k] || 0) + w; } };
    for (const [pid, w] of pros) { const p = DATA.profiles[pid]; if (p && p.mel) add(p.mel, w); }
    const base = DATA.profiles["base:minor"]; add(base && base.mel, 0.3);
    const out = {}; for (const k of keys) out[k] = wsum[k] ? acc[k] / wsum[k] : null;
    return out;
  }
  // POP <-> ALT (Eman, 8 Nov): the pop side leans on the mainstream pop songs and the moves everybody makes;
  // the alt side leans on alternative / indie / experimental songs and lets the rare moves through.
  const POP_SIDE = [["genre:pop", 1], ["era:2010s", 0.4], ["era:2020s", 0.4]], ALT_SIDE = [["genre:alternative", 1], ["tag:experimental", 0.6], ["tag:indie rock", 0.4], ["tag:shoegaze", 0.3], ["tag:dream pop", 0.3], ["tag:post-rock", 0.3], ["tag:art rock", 0.3]];
  function popMix(pros, pop) {
    if (pop == null || Math.abs(pop - 0.5) < 0.03) return pros;
    const out = new Map(pros), side = pop > 0.5 ? POP_SIDE : ALT_SIDE, k = Math.abs(pop - 0.5) * 2;
    let tot = 0; for (const w of out.values()) tot += w;
    for (const [pid, w] of side) if (DATA.profiles[pid]) out.set(pid, (out.get(pid) || 0) + w * k * Math.max(1, tot));
    return out;
  }
  // every dial on AUTO (Eman, 8 Nov): the songs behind the prompt choose. pace from their median beats per chord,
  // colour from how many 7ths/9ths they use, tension from how often they leave the key, voices from colour,
  // rhythm and feel from the styles named, notes per bar from their melodies, range from plain words.
  const RHY_HOLD = /rap|trap|hip|drill|ambient|cinematic|sad|dream|chill|lo-fi|lofi|ballad|piano|choir|drone|cloud|villain|dark|soul|r&b|rnb|sleep|slow/;
  const RHY_PULSE = /house|techno|trance|edm|dance|disco|eurodance|electro|club|rave|pop punk|punk|metal|synthwave|synth-pop|synthpop|italo|hyperpop/;
  const RHY_STABS = /funk|reggae|ska|dancehall|afro|latin|salsa|groov|boogie|jazz|neo soul|gospel|bossa/;
  const RHY_BROKEN = /arp|guitar|folk|indie|acoustic|country|bluegrass|lullaby|music box|harp|waltz/;
  const SWINGY = /jazz|swing|blues|soul|neo soul|hip hop|hip-hop|boom bap|gospel|shuffle|bossa|lo-fi|lofi|funk/;
  function auto(text, part) {
    const pf = profilesFor(text || ""), pros = pf.profiles, ids = [...pros.keys()].join(" ") + " " + norm(text || "");
    const ext = mixStat(pros, "ext", 0.14), out = mixStat(pros, "out", 0.12), paceB = mixStat(pros, "pace", 4), mel = mixMel(pros);
    const A = {};
    A.pace = paceB >= 6.5 ? 0 : paceB >= 2.8 ? 1 : paceB >= 1.4 ? 2 : 3;
    A.colour = Math.max(0, Math.min(1, ext * 3));
    A.tension = Math.max(0.1, Math.min(0.8, out * 1.6 + (/tense|villain|dark|horror|scary|anx|creep|uneasy/.test(ids) ? 0.25 : 0)));
    A.random = /experimental|weird|strange|odd|chaos|wild|random|avant|psychedelic|free jazz|math/.test(ids) ? 0.55 : /pop|radio|simple|easy|basic|clean/.test(ids) ? 0.2 : 0.3;
    A.voices = A.colour >= 0.7 ? 5 : A.colour >= 0.3 ? 4 : 3;   // COLOUR needs a 4th voice for the 7th, a 5th for the 9th
    A.rhythm = RHY_BROKEN.test(ids) ? 4 : RHY_STABS.test(ids) ? 2 : RHY_PULSE.test(ids) ? (/off|syncop|ska|reggae/.test(ids) ? 3 : 1) : 0;
    if (RHY_HOLD.test(ids) && A.rhythm === 1) A.rhythm = 0;
    A.swing = SWINGY.test(ids) ? (/shuffle|swing|hard/.test(ids) ? 2 : 1) : 0;
    const dens = mel.dens != null ? mel.dens : 4.8;
    A.dens = part === "bass" ? (dens >= 9 ? 2 : dens >= 4.5 ? 1 : 0) : part === "arp" ? (dens >= 9 ? 2 : 1) : (dens >= 10 ? 3 : dens >= 6.5 ? 2 : dens >= 3.2 ? 1 : 0);
    A.range = /\b(sub|deep|low|bass|808|dark|heavy|growl)\b/.test(ids) ? 0 : /\b(high|bright|airy|sparkl|bell|light|glitter|twinkl)\b/.test(ids) ? 2 : 1;
    A.pop = /genre:pop\b|era:2010s|era:2020s|\b(radio|hit|hits|mainstream|chart|charts|top 40|commercial)\b/.test(ids) && !/alternative|indie|experimental|underground/.test(ids) ? 0.65 : /alternative|indie|experimental|underground|shoegaze|post-rock|avant|art rock|weird/.test(ids) ? 0.35 : 0.5;
    // a named scene knows its own dials (round 2): they weigh 60% against what the songs' numbers say
    const SD = sceneDice(pf.scenes);
    if (SD) { const mixv = (k, round) => { if (SD[k] == null) return; const v = A[k] * 0.4 + SD[k] * 0.6; A[k] = round ? Math.round(v) : v; }; mixv("pace", 1); mixv("colour"); mixv("tension"); mixv("random"); mixv("voices", 1); mixv("rhythm", 1); mixv("swing", 1); mixv("range", 1); mixv("pop"); A.scene = pf.scenes; A.sceneScale = SD.scale || null; }
    A.bars = A.pace === 0 ? 8 : 4;
    A.mel = mel; A.ext = ext; A.out = out; A.paceBeats = paceB; A.heard = pf.heard; A.used = [...pros.keys()];
    return A;
  }
  // the mixed move table for a set of profiles ({id: weight}); the base profile for the key is always under it
  function mixMoves(pros, minor) {
    const base = DATA.profiles[minor ? "base:minor" : "base:major"], mix = {}, add = (moves, w) => { const tot = Object.values(moves).reduce((a, b) => a + b, 0) || 1; for (const [k, v] of Object.entries(moves)) mix[k] = (mix[k] || 0) + (v / tot) * w; };
    let wsum = 0;
    for (const [pid, w] of pros) { const p = DATA.profiles[pid]; if (!p || !p.moves) continue; add(p.moves, w); wsum += w; }
    add(base.moves, wsum ? Math.max(0.15, 0.5 - wsum * 0.1) : 1);
    return mix;
  }
  function mixStat(pros, key, dflt) {
    let s = 0, w = 0;
    for (const [pid, wt] of pros) { const p = DATA.profiles[pid]; if (p && p[key] != null) { s += p[key] * wt; w += wt; } }
    return w ? s / w : dflt;
  }
  function mixLoops(pros, minor) {
    const out = [];
    for (const [pid, w] of pros) { const p = DATA.profiles[pid]; if (p && p.loops) for (const l of p.loops) out.push({ loop: l.slice(0, -1), w: l[l.length - 1] * w }); }
    const base = DATA.profiles[minor ? "base:minor" : "base:major"];
    for (const l of base.loops) out.push({ loop: l.slice(0, -1), w: l[l.length - 1] * 0.3 });
    return out;
  }

  // ---- the roll -----------------------------------------------------------------------------------
  // params: { tonic 0..11, scale, bars, pace 0..3 (2 bars | 1 bar | half | beat per chord), colour 0..1, tension 0..1,
  //   random 0..1, voices 2..5, text (prompt), avoid: [recent loop keys], seed }
  // returns { segs: [{ beat, len, tok, root(pc abs), pcs(abs), name }], loopKey, used: [profile ids], heard: [words] }
  let rng = Math.random;
  function seeded(seed) { let s = ((seed * 2654435761) >>> 0) || 1; for (let i = 0; i < 8; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; } return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const pick = (items, weightOf) => { let tot = 0; for (const it of items) tot += weightOf(it); let r = rng() * tot; for (const it of items) { r -= weightOf(it); if (r <= 0) return it; } return items[items.length - 1]; };

  const diatonic = (scale, r, q) => { const st = SCALES[scale] || SCALES.minor, iv = QUAL[q] || QUAL[""]; return iv.slice(0, 3).every((x) => st.includes(pc(r + x))); };
  // the chord built in thirds on a scale degree (so Dorian / Phrygian colour the same shapes their own way)
  function scaleChord(scale, deg, n) {
    const st = SCALES[scale] || SCALES.minor, out = [];
    for (let k = 0; k < n; k++) { const i = deg + 2 * k; out.push(st[i % 7] + 12 * Math.floor(i / 7)); }
    return out;
  }
  function qualityOf(ivs) {   // the quality name for a stack of intervals (triad + maybe 7th)
    const s = ivs.map((x) => pc(x - ivs[0]));
    const t3 = s[1], t5 = s[2], t7 = s[3];
    let q = t3 === 4 ? (t5 === 8 ? "aug" : "") : t3 === 3 ? (t5 === 6 ? "dim" : "m") : t3 === 2 ? "sus2" : "sus4";
    if (t7 == null) return q;
    if (q === "") return t7 === 11 ? "M7" : "7";
    if (q === "m") return t7 === 11 ? "mM7" : "m7";
    if (q === "dim") return t7 === 9 ? "dim7" : "m7b5";
    return q;
  }
  // colour a chord: voices + colour decide how far up the stack we go and whether the key's 7th/9th come in
  function colourTok(scale, baseTok, voices, colour, root) {
    const b = parseTok(baseTok);
    const st = SCALES[scale] || SCALES.minor, deg = st.indexOf(b.r);
    if (deg < 0) {   // borrowed chord: keep its own quality, add a 7th only when very colourful
      if (voices >= 4 && colour > 0.6 && /^(|m)$/.test(b.q)) return tok(b.r, b.q === "m" ? "m7" : "7");
      return baseTok;
    }
    const want = Math.max(2, Math.min(5, voices));
    if (want === 2) return tok(b.r, "5");
    const n = want === 3 ? 3 : want === 4 ? 4 : 5;
    const stack = scaleChord(scale, deg, Math.min(4, n));
    let q = qualityOf(stack.slice(0, want >= 4 ? 4 : 3));
    if (want === 3 && colour > 0.75 && rng() < (colour - 0.75) * 2) q = rng() < 0.5 ? "sus2" : "sus4";   // very colourful triads: suspensions now and then
    if (want >= 5) { q = q === "m7" ? "m9" : q === "M7" ? "M9" : q === "7" ? "9" : q === "" ? "add9" : q === "m" ? "madd9" : q; }
    if (want === 4 && colour < 0.35 && rng() < 1 - colour / 0.35) q = q.replace(/M7|m7|mM7|dim7|m7b5|7/, (m) => (m === "m7" || m === "mM7" ? "m" : m === "dim7" || m === "m7b5" ? "dim" : ""));   // plain: drop the 7th sometimes
    return tok(b.r, q);
  }
  const degreeName = (tonic, t) => { const p = parseTok(t); return ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][pc(tonic + p.r)] + (p.q === "M7" ? "maj7" : p.q === "" ? "" : p.q); };

  function roll(P) {
    rng = P.seed != null ? seeded(P.seed) : Math.random;
    const minor = MINORISH.has(P.scale), scale = SCALES[P.scale] ? P.scale : minor ? "minor" : "major";
    const pf = profilesFor(P.text || ""), pros = popMix(pf.profiles, P.pop);
    const pop = P.pop == null ? 0.5 : Math.max(0, Math.min(1, P.pop)), popK = (pop - 0.5) * 2;   // -1 alt .. +1 pop
    const moves = mixMoves(pros, minor), loops = mixLoops(pros, minor);
    // how common each move is across all songs in this key: the pop side rides the common ones, the alt side the rare ones
    const baseMoves = (DATA.profiles[minor ? "base:minor" : "base:major"] || {}).moves || {}, baseVals = Object.values(baseMoves).sort((a, b) => a - b);
    const baseMid = baseVals.length ? baseVals[Math.floor(baseVals.length / 2)] : 0.01;
    const popW = (k) => { if (!popK) return 1; const f = (baseMoves[k] || baseMid * 0.15) / baseMid; return Math.max(0.2, Math.min(5, Math.pow(f, popK * 1.5))); };
    const ext = mixStat(pros, "ext", 0.2), outRate = mixStat(pros, "out", 0.06);
    const colour = P.colour != null ? P.colour : Math.min(1, ext * 2), tension = P.tension != null ? P.tension : 0.3, random = P.random != null ? P.random : 0.3;
    const bars = Math.max(1, P.bars || 4), segLen = [8, 4, 2, 1][Math.max(0, Math.min(3, P.pace == null ? 1 : P.pace))];
    const nseg = Math.max(1, Math.ceil(bars * 4 / segLen));
    const home = minor ? "0m" : "0";
    // the roots the key offers (diatonic triads) and the borrowed ones the profiles use
    const diat = [];
    for (let d = 0; d < 7; d++) { const s = scaleChord(scale, d, 3); diat.push(tok(s[0], qualityOf(s))); }
    const nextOf = (from) => {
      const cands = new Map();
      for (const [k, w] of Object.entries(moves)) { const [a, b] = k.split(">"); if (a === from) cands.set(b, (cands.get(b) || 0) + w); }
      if (!cands.size) for (const t of diat) cands.set(t, 1);
      return cands;
    };
    const avoid = new Set(P.avoid || []), inKey = !!P.inKey;   // ONLY KEY on: nothing borrowed, ever (notes outside the scale would be muted anyway)
    const okTok = (t) => !inKey || diat.includes(t);
    let segsTok = null, trained = null;
    // 0) TRAINED (Eman, 14 Nov): the loops of the real MIDI files + Eman's MIDI videos, exact, morphed or blended, plus
    // a few theory loops (ui/dice-train.js). KT2_DICE_TRAIN_OFF = the brain's own walk below, as before
    const DT = typeof window !== "undefined" && window.KT2DiceTrain;
    // CUSTOM DATA OFF (ui/kt2-custom-data.js): the big collection is loaded, so about half the rolls walk it instead of the
    // trained loops (KT2_CUSTOM_DATA_OFF = trained loops every time, as before)
    const bigTurn = typeof window !== "undefined" && !window.KT2_CUSTOM_DATA_OFF && window.KT2CustomData && !DATA.own && useOn("chords") && rng() < 0.5;
    if (DT && DT.ready() && !bigTurn) { trained = DT.chords({ minor, nseg, segLen, rng, avoid, text: P.text || "" }); if (trained && trained.toks && trained.toks.length === nseg) segsTok = trained.toks; else trained = null; }
    // 1) a known loop from the profiles, when the song is loop-shaped (4 or 8 chords) and the dice isn't set to wild
    if (!segsTok && loops.length && nseg >= 4 && random < 0.7 && rng() < 0.45 - random * 0.4 + popK * 0.3) {
      // low TENSION wants the tonic in the loop (it is in nearly every song loop anyway); high tension is happy without
      const fit = loops.filter((l) => !avoid.has(l.loop.join(" ")) && (tension > 0.45 || l.loop.includes(home)) && l.loop.every((t) => diat.includes(t) || (!inKey && rng() < outRate * 4 + colour)));
      const loopW = (x) => { let w = Math.sqrt(x.w); for (let i = 1; i < x.loop.length; i++) w *= Math.sqrt(popW(x.loop[i - 1] + ">" + x.loop[i])); return w; };   // flattened, so the top loop doesn't come back every time
      if (fit.length) { const l = pick(fit, loopW); segsTok = []; for (let i = 0; i < nseg; i++) segsTok.push(l.loop[i % l.loop.length]); }
    }
    // 2) else walk the move table: random = temperature, tension = how little it is pulled home at the turn
    if (!segsTok) {
      for (let tries = 0; tries < 6 && !segsTok; tries++) {
        const out = [];
        let cur = rng() < 0.75 ? home : pick(diat.filter((t) => !/dim|o/.test(parseTok(t).q)), () => 1);   // never open on the diminished chord
        for (let i = 0; i < nseg; i++) {
          if (i > 0) {
            const cands = nextOf(cur), items = [...cands.entries()].filter(([t]) => (t !== cur || nseg <= 2) && okTok(t));
            const temp = 0.5 + random * 1.4;
            const w = ([t, v]) => {
              let x = Math.pow(v, 1 / temp) * popW(cur + ">" + t);
              if (!diat.includes(t)) x *= (0.3 + outRate * 4 + colour * 0.6) * (1 - popK * 0.4);   // leaving the key: only when the profiles do, or when colourful
              const last = i === nseg - 1, half = nseg >= 4 && i === Math.floor(nseg / 2);
              if (last) x *= t === home ? 1 + (1 - tension) * 6 : 1 + tension * 1.5;   // the end lands home unless tense
              if (half && t === home) x *= 0.5 + tension;
              if (out.length >= 2 && out[out.length - 2] === t && out[out.length - 1] !== t) x *= 0.6;   // no a-b-a-b ping-pong unless the data loves it
              return x;
            };
            cur = items.length ? pick(items, w)[0] : (inKey ? pick(diat.filter((t) => t !== cur), () => 1) : home);
          }
          out.push(cur);
        }
        if (!avoid.has(out.join(" ")) || tries === 5) segsTok = out;
      }
    }
    // 2b) chords handed in (dice live edit + song sections, ui/dice-live.js): P.toks = [{ beat, len, baseTok }]. Every new
    // chord that starts where a handed-in chord starts keeps it, so turning a SHAPE dial keeps the progression; a chord
    // that starts inside one (CHANGE made faster) keeps what the walk above picked. KT2_DICE_LIVE_OFF = ignored
    if (P.toks && P.toks.length && !window.KT2_DICE_LIVE_OFF) {
      segsTok = segsTok.map((t, i) => { const b = i * segLen, s = P.toks.find((x) => b >= x.beat - 1e-6 && b < x.beat + x.len - 1e-6); return s && Math.abs(s.beat - b) < 1e-6 && okTok(s.baseTok || s.tok) ? s.baseTok || s.tok : t; });
    }
    // 3) colour and voice the chords, name them
    const voices = Math.max(2, Math.min(5, P.voices || 3));
    const segs = segsTok.map((t, i) => {
      let ct = colourTok(scale, t, voices, colour), p = parseTok(ct), ivs = QUAL[p.q] || QUAL[""];
      if (inKey) {   // every note of the stack must sit in the scale; otherwise fall back to the plain scale stack
        const st = SCALES[scale] || SCALES.minor, inSc = (q) => (QUAL[q] || QUAL[""]).every((x) => st.includes(pc(p.r + x)));
        if (!inSc(p.q) && INKEY_OLD()) { const deg = st.indexOf(p.r), stack = deg >= 0 ? scaleChord(scale, deg, voices >= 4 ? 4 : 3) : null; ct = tok(p.r, stack && inSc(qualityOf(stack)) ? qualityOf(stack) : (st.includes(pc(p.r + 3)) ? "m" : "")); p = parseTok(ct); ivs = QUAL[p.q] || QUAL[""]; }
        else if (!inSc(p.q)) {
          // first keep the root and find a shape that fits (the scale's own stack, 4 then 3 notes, then plainer ones);
          // if the root itself is outside the scale, or nothing fits there, step to the nearest scale degree that has a fit, home last
          const deg = st.indexOf(p.r), prefer = deg >= 0 ? [qualityOf(scaleChord(scale, deg, 4)), qualityOf(scaleChord(scale, deg, 3))] : [];
          let r = p.r, q = deg >= 0 ? inScaleQual(st, r, prefer) : null;
          if (q == null) { for (const step of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6]) { const rr = pc(p.r + step), d2 = st.indexOf(rr); if (d2 < 0) continue; const qq = inScaleQual(st, rr, [qualityOf(scaleChord(scale, d2, 3))]); if (qq != null) { r = rr; q = qq; break; } } }
          if (q == null) { r = 0; q = inScaleQual(st, 0, [qualityOf(scaleChord(scale, 0, 3))]) || "5"; }
          ct = tok(r, q); p = parseTok(ct); ivs = QUAL[p.q] || QUAL[""];
        }
      }
      const root = pc(P.tonic + p.r);
      return { beat: i * segLen, len: segLen, tok: ct, baseTok: t, root, pcs: ivs.map((x) => pc(root + x)), ivs, name: degreeName(P.tonic, ct), out: !diatonic(scale, p.r, p.q) };
    });
    return { segs, trained, loopKey: segsTok.join(" "), used: [...pf.profiles.keys()], heard: pf.heard, rest: pf.rest, stats: { ext, out: outRate, colour, tension, random, pop, minor, mel: mixMel(pf.profiles) } };
  }

  // profiles that a prompt uses, with their song counts (for the test page and the toast)
  const describe = (text) => { const pf = profilesFor(text); return [...pf.profiles.entries()].map(([id, w]) => ({ id, w, ...(DATA.profiles[id] || {}), moves: undefined, loops: undefined })); };
  window.ChordBrain = { knows: (w) => !!((DATA.words || {})[w] || (SCENES.words || {})[w]), load, loadScenes, scenes: () => SCENES, sceneDice, roll, auto, profilesFor, describe, nameTok: (tonic, t) => degreeName(tonic, t), mixMel, mixStat, data: () => DATA, QUAL, SCALES, parseTok, tok, words: () => Object.keys(DATA.words || {}) };
})();
