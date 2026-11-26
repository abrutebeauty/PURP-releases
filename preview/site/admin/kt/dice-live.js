// DICE LIVE (Eman, 8 Nov 22:21 + 22:24): the parts of the new dice panel that don't depend on its look.
//
// 1. ONE PANEL BOTH WAYS. After a roll, turning a dial changes the notes that roll wrote, live, instead of only
//    the next roll. SHAPE dials (CHANGE, RHYTHM, VOICES, RANGE, COLOUR, NOTES, FEEL) keep the same chords and
//    reshape them; SWAP dials (TENSION, RANDOM, POP <-> ALT) may swap some chords for others. Only the dice makes
//    brand new chords. This works only while the notes are still exactly what the last roll wrote: after a hand
//    edit (or another clip, another dice mode) the dials go back to setting up the next roll.
//    How: each roll gets a seed, and Math.random runs from that seed while the roll is computed, so the same roll
//    with one dial changed comes out the same everywhere else.
// 2. NO LENGTH. The dice always fills the whole pattern (the clip). Over more than 4 bars it writes a song
//    shape: intro, verse, pre, hook, bridge, outro, each section its own chords from the brain (the prompt's
//    songs), repeated sections the same chords, instead of one 4-bar loop over and over.
// 3. THE FROM CHIP: what the prompt's words reached in the brain, as data for a small chip by the dice
//    ("FROM 5", the words and their song counts on hover).
//
// window.DiceLive = { on(), seeded(seed, fn), kindOf(dial), form(bars), songToks(o), from(text) }
// On by default since the PICTURE CARDS (8 Nov 23:30). KT2_DICE_LIVE = false or localStorage kt2.diceLive = "0" turns it off;
// KT2_DICE_LIVE_OFF = off whatever else says.
(() => {
  const on = () => {
    if (window.KT2_DICE_LIVE_OFF) return false;
    if (window.KT2_DICE_LIVE != null) return !!window.KT2_DICE_LIVE;
    try { if (typeof location !== "undefined" && /dicelive|dice=a\b/i.test(location.hash + location.search)) return true; } catch (e) {}
    // ON for everyone with the PICTURE CARDS (Eman, 8 Nov 23:15 "okay do it"): kt2.diceLive = "0" or KT2_DICE_LIVE_OFF turns it off
    try { return localStorage.getItem("kt2.diceLive") !== "0"; } catch (e) { return true; }
  };

  // run fn with Math.random drawn from seed (xorshift), then put Math.random back
  function seeded(seed, fn) {
    const R = Math.random;
    let s = ((seed * 2654435761) >>> 0) || 1;
    Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    try { return fn(); } finally { Math.random = R; }
  }

  // which dials keep the chords and which may swap them
  const SWAP = new Set(["tension", "random", "alt", "pad", "mood"]);   // a new MOOD = other songs = other chords
  const kindOf = (dial) => (SWAP.has(dial) ? "swap" : "shape");
  // where the SWAP dials sit, in 5 steps each: a new place rolls other chords, the same place the same ones
  const step5 = (x) => Math.max(0, Math.min(4, Math.round((x == null ? 0.5 : x) * 4)));
  const step6 = (x) => Math.max(0, Math.min(5, Math.round((x == null ? 0.5 : x) * 5)));   // Common <-> Alternative has 6 places (9 Nov)
  const swapKey = (row) => (row.mood == null ? 0 : row.mood + 1) * 150 + step6(1 - (row.pop == null ? 0.5 : row.pop)) * 25 + step5(row.tension) * 5 + step5(row.random) + (row.exp ? 9000 : 0);   // EXPERIMENTAL = other chords

  // ---- song shape -------------------------------------------------------------------------------
  // the sections for a pattern of `bars` bars. Longer patterns get more of a song.
  const TEMPLATES = [
    [4, [["LOOP", 4]]],
    [8, [["VERSE", 4], ["HOOK", 4]]],
    [16, [["VERSE", 8], ["HOOK", 8]]],
    [24, [["INTRO", 4], ["VERSE", 8], ["HOOK", 8], ["OUTRO", 4]]],
    [32, [["INTRO", 4], ["VERSE", 8], ["PRE", 4], ["HOOK", 8], ["BRIDGE", 4], ["OUTRO", 4]]],
    [48, [["INTRO", 4], ["VERSE", 8], ["PRE", 4], ["HOOK", 8], ["VERSE", 8], ["HOOK", 8], ["BRIDGE", 4], ["OUTRO", 4]]],
    [64, [["INTRO", 4], ["VERSE", 8], ["PRE", 4], ["HOOK", 8], ["VERSE", 8], ["PRE", 4], ["HOOK", 8], ["BRIDGE", 8], ["HOOK", 8], ["OUTRO", 4]]],
  ];
  function form(bars) {
    bars = Math.max(1, Math.round(bars || 4));
    if (bars <= 4) return [{ s: "LOOP", at: 0, n: bars }];
    // the biggest template that fits, then the last sections stretch or shrink to fill exactly
    let t = TEMPLATES[0][1];
    for (const [b, tt] of TEMPLATES) if (b <= bars) t = tt;
    const out = []; let at = 0;
    for (const [s, n] of t) { out.push({ s, at, n }); at += n; }
    let left = bars - at;
    // more bars than the template: the hook (or the last section) gets longer, in 4-bar steps where it can
    while (left > 0) { const h = [...out].reverse().find((x) => x.s === "HOOK") || out[out.length - 1]; const add = Math.min(left, 4); h.n += add; left -= add; let a = 0; for (const x of out) { x.at = a; a += x.n; } }
    return out;
  }
  // how each section leans away from the dials (on top of what the dials say)
  const LEAN = {
    LOOP: {}, INTRO: { tension: -0.15, bars: 4 }, VERSE: {}, PRE: { tension: +0.35 }, HOOK: { pop: +0.15, tension: -0.2 },
    BRIDGE: { pop: -0.3, random: +0.15 }, OUTRO: { tension: -0.4 },
  };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  // the chords for the whole pattern, section by section, as toks for ChordBrain.roll(P.toks): [{ beat, len, baseTok, sec }]
  // o: { bars, seed, sc: { tonic, scale }, row (TmDice.get), text, inKey, avoid }. null when the pattern is one loop.
  function songToks(o) {
    if (!window.ChordBrain || !ChordBrain.roll) return null;
    const F = form(o.bars);
    if (F.length < 2) return null;
    const row = o.row || {}, made = new Map(), keys = [].concat(o.avoid || []), out = [];
    F.forEach((f, i) => {
      if (!made.has(f.s)) {
        const L = LEAN[f.s] || {}, bars = Math.min(8, L.bars || f.n);
        const tension = clamp01((row.tension == null ? 0.3 : row.tension) + (L.tension || 0));
        const pop = clamp01((row.pop == null ? 0.5 : row.pop) + (L.pop || 0));
        const random = clamp01((row.random == null ? 0.3 : row.random) + (L.random || 0));
        // every section its own chords: a section that came out like an earlier one (a prompt with few chords in it) is
        // rolled again, a little wilder each time
        const per = (segs) => { const t = segs.map((x) => x.baseTok); for (let k = 1; k <= t.length; k++) if (t.length % k === 0 && t.every((x, j) => x === t[j % k])) return t.slice(0, k).join(" "); return t.join(" "); };   // the loop, once
        const seen = [...made.values()].map((m) => per(m.segs));
        let r = null;
        for (let t = 0; t < 6; t++) {
          r = ChordBrain.roll({ tonic: o.sc.tonic, scale: o.sc.scale, bars, pace: row.pace, colour: row.colour, tension, random: clamp01(random + t * 0.12), voices: row.voices, pop, text: o.text || "", avoid: keys, inKey: !!o.inKey, seed: (o.seed || 1) * 31 + i * 7 + 3 + t * 1009 });
          if (!seen.includes(per(r.segs))) break;
        }
        keys.push(r.loopKey);
        made.set(f.s, { segs: r.segs, beats: bars * 4 });
      }
      const m = made.get(f.s), at0 = f.at * 4, end = at0 + f.n * 4;
      // the section's chords repeat until the section ends
      for (let rep = 0; at0 + rep * m.beats < end - 1e-6; rep++) for (const sg of m.segs) {
        const b = at0 + rep * m.beats + sg.beat; if (b >= end - 1e-6) break;
        out.push({ beat: b, len: Math.min(sg.len, end - b), baseTok: sg.baseTok, sec: f.s });
      }
    });
    return out;
  }

  // ---- the FROM chip --------------------------------------------------------------------------------
  // { n: how many song groups the words reached, items: [{ label, n (songs) }], songs: all songs learned, empty }
  const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n || 0));
  function from(text) {
    const B = window.ChordBrain, songs = B && B.data ? B.data().songs || 0 : 0, t = String(text || "").trim();
    if (!B || !t) return { n: 0, items: [], songs, empty: true, chip: "ALL " + fmt(songs) };
    const seen = new Set();
    const items = B.describe(t).filter((p) => p.n >= 20).sort((a, b) => b.w - a.w)
      .map((p) => ({ label: p.label || p.id, n: p.n }))
      .filter((p) => { const k = String(p.label).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    return { n: items.length, items, songs, empty: false, chip: items.length ? "FROM " + items.length : "ALL " + fmt(songs) };
  }

  window.DiceLive = { on, seeded, kindOf, swapKey, form, songToks, from, fmt };
})();
