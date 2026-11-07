/* KILLDRUM patterns: pure, deterministic drum-pattern generator (no DOM, node-testable).
   window.KillDrumPatterns in the browser, module.exports in node. See scratchpad CONTRACT.md.

   Step = { v: 0..127 (0 = off), r: 1..4 (hits inside the 16th) }; a pad's pattern = Step[16 * bars]
   API: GENRES, SLOTS, NOTE_OF, beat(), pad(), toNotes(), fromNotes(), empty(), parse(), str()

   Templates: when window.KillDrumGrooves (ui/killdrum-grooves.js) is around, a groove of the genre is
   picked by seed and mutated; otherwise (or 30% of the time, for variety) the rule-based generator runs.
   Same seed + same inputs = same output. */
(function () {
  "use strict";

  var SLOTS = ["kick", "808", "snare", "clap", "hat_closed", "hat_open", "perc", "fx", "texture"];
  var NOTE_OF = { kick: 36, "808": 35, snare: 38, clap: 39, hat_closed: 42, hat_open: 46, perc: 37, fx: 49, texture: 51 };
  // generation order: dependencies first (808 follows kick, clap follows snare, open hat avoids closed)
  var ORDER = ["kick", "snare", "808", "clap", "hat_closed", "hat_open", "perc", "fx", "texture"];

  // kick: four | trap | rage | drill | jersey | boom | twostep | electro
  // sub (808): follow | lead | offbeat | eighths     hats: 16 | 8 | drill | 8off | lazy
  // open: choke | offbeat | soft | off               clap: layer chance (clapPrimary = clap carries the backbeat)
  var GENRES = [
    { id: "trap", label: "Trap", bpm: [130, 165], feel: "half-time, rolling hats, 808 slides",
      half: true, kick: "trap", sub: "follow", hats: "16", rolls: 0.8, open: "choke", clap: 0.7, ghost: 0, perc: 0.3, fx: 0.35, tex: 0.25,
      names: ["ATL Bounce", "Plug Walk", "Slime Season", "Trap Door", "Codeine Dream", "Molly Whop"] },
    { id: "rage", label: "Rage", bpm: [140, 170], feel: "half-time, the 808 does the kicking, loud and sparse",
      half: true, kick: "rage", sub: "lead", hats: "8", rolls: 0.5, open: "choke", clap: 0.5, ghost: 0, perc: 0.2, fx: 0.4, tex: 0.2,
      names: ["Whole Lotta", "Opium Den", "Vamp Hour", "Sorcery", "Mosh Pit", "Red Lights"] },
    { id: "drill", label: "Drill", bpm: [138, 146], feel: "half-time, sliding 808s, 3-3-2 bounce, skippy hats",
      half: true, kick: "drill", sub: "follow", hats: "drill", rolls: 0.45, open: "choke", clap: 0.4, ghost: 0, perc: 0.35, fx: 0.3, tex: 0.15,
      names: ["Brixton Slide", "Woo Walk", "Gang Hour", "Balaclava", "Night Bus", "Opp Block"] },
    { id: "jersey", label: "Jersey", bpm: [130, 145], feel: "club bounce, kick stutter, squeaks and chops",
      half: false, kick: "jersey", sub: "follow", hats: "8", rolls: 0.3, open: "off", clap: 0.6, ghost: 0, perc: 0.6, fx: 0.5, tex: 0.1,
      names: ["Bed Squeak", "Jersey Jump", "Club Rat", "Garden State", "Bounce Back", "Sneaker Squeak"] },
    { id: "lofi", label: "Lo-fi", bpm: [70, 95], feel: "lazy swing, ghost snares, dust and tape",
      half: false, kick: "boom", sub: "follow", hats: "lazy", rolls: 0, open: "soft", clap: 0.3, ghost: 0.7, perc: 0.3, fx: 0.1, tex: 0.85,
      names: ["Blue Hour", "Sad Hours", "Snowfall", "Tape Hiss", "Late Bus", "Rainy Window"] },
    { id: "boombap", label: "Boom bap", bpm: [85, 100], feel: "hard backbeat, swung 16ths, chopped kick",
      half: false, kick: "boom", sub: "follow", hats: "8", rolls: 0, open: "soft", clap: 0.3, ghost: 0.6, perc: 0.3, fx: 0.15, tex: 0.35,
      names: ["Dusty Crate", "Golden Era", "Shook", "Boom Box", "Corner Store", "Vinyl Dig"] },
    { id: "house", label: "House", bpm: [120, 128], feel: "four on the floor, open hat offbeats, clap on 2 and 4",
      half: false, kick: "four", sub: "offbeat", hats: "8off", rolls: 0, open: "offbeat", clap: 1, clapPrimary: true, ghost: 0.1, perc: 0.5, fx: 0.25, tex: 0.2,
      names: ["Deep End", "Warehouse", "Piano Hands", "Body Move", "Sunrise Set", "Disco Dust"] },
    { id: "techno", label: "Techno", bpm: [125, 145], feel: "four on the floor, 16th hats, machine perc",
      half: false, kick: "four", sub: "offbeat", hats: "16", rolls: 0.15, open: "offbeat", clap: 1, clapPrimary: true, ghost: 0, perc: 0.55, fx: 0.2, tex: 0.25,
      names: ["Concrete", "Strobe", "Tunnel", "Black Box", "Steel Room", "Night Shift"] },
    { id: "crystal", label: "Crystal", bpm: [120, 140], feel: "electro: 4-on-floor or broken, bitcrushed stabs",
      half: false, kick: "electro", sub: "eighths", hats: "8", rolls: 0.2, open: "offbeat", clap: 0.8, ghost: 0.1, perc: 0.5, fx: 0.5, tex: 0.75,
      names: ["Crimewave", "Courtship", "Glass Castle", "8-bit Riot", "Untrust", "Celestica"] },
    { id: "dnb", label: "DnB", bpm: [165, 178], feel: "two-step breaks, kick on 1 and the 'and' of 3, ghost snares",
      half: false, kick: "twostep", sub: "follow", hats: "16", rolls: 0.1, open: "soft", clap: 0.2, ghost: 0.6, perc: 0.4, fx: 0.3, tex: 0.2,
      names: ["Amen Cut", "Two Step", "Roller", "Liquid Sky", "Jungle Run", "Hyper Jump"] }
  ];
  var BY_ID = {};
  GENRES.forEach(function (g) { BY_ID[g.id] = g; });

  /* ---------- random ---------- */
  function fnv(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function seedOf() {
    var s = "";
    for (var i = 0; i < arguments.length; i++) s += String(arguments[i]) + "|";
    return fnv(s);
  }
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    var f = mulberry32(seed);
    return {
      next: f,
      chance: function (p) { return f() < p; },
      int: function (n) { return Math.floor(f() * n); },
      range: function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)); },
      pick: function (arr) { return arr[Math.floor(f() * arr.length)]; },
      // weighted pick: items = [[value, weight], ...]
      weighted: function (items) {
        var total = 0, i;
        for (i = 0; i < items.length; i++) total += items[i][1];
        var x = f() * total;
        for (i = 0; i < items.length; i++) { x -= items[i][1]; if (x < 0) return items[i][0]; }
        return items[items.length - 1][0];
      }
    };
  }

  /* ---------- steps ---------- */
  function clampV(v) { v = Math.round(+v || 0); return v < 0 ? 0 : v > 127 ? 127 : v; }
  function clampR(r) { r = Math.round(+r || 1); return r < 1 ? 1 : r > 4 ? 4 : r; }
  function off() { return { v: 0, r: 1 }; }
  function hit(v, r) { v = clampV(v); return { v: v, r: v ? clampR(r) : 1 }; }
  // a step's extras: c = chance (0..1, left out = always), t = pitch in semitones, g = glide into it,
  // o = how far past its 16th the hit sits (0..1 of a step: Cmd-drag snaps to 1/32 and triplets),
  // u = a unique hit's own settings on top of the row ({ id, tune, decay, drive, cutoff, pan, level, fx })
  function extras(dst, s) {
    if (s && s.c != null && s.c < 1) dst.c = Math.max(0.05, +s.c);
    if (s && s.t) dst.t = Math.max(-24, Math.min(24, Math.round(+s.t)));
    if (s && s.g) dst.g = true;
    if (s && s.o > 0.01 && s.o < 0.99) dst.o = Math.round(+s.o * 1000) / 1000;
    if (s && s.u && typeof s.u === "object") dst.u = JSON.parse(JSON.stringify(s.u));
    return dst;
  }
  function clampBars(bars) { bars = Math.round(+bars || 0); return bars < 1 ? 1 : bars > 8 ? 8 : bars; }

  function empty(bars) {
    var n = 16 * clampBars(bars), p = new Array(n);
    for (var i = 0; i < n; i++) p[i] = off();
    return p;
  }
  // any array-ish of steps -> clean Step[16*bars] (repeat / trim)
  function normalize(pat, bars) {
    var n = 16 * clampBars(bars), out = new Array(n);
    var len = pat && pat.length ? pat.length : 0;
    for (var i = 0; i < n; i++) {
      var s = len ? pat[i % len] : null;
      out[i] = s && s.v > 0 ? extras(hit(s.v, s.r), s) : off();
    }
    return out;
  }
  function clone(pat) { return pat.map(function (s) { return s.v > 0 ? hit(s.v, s.r) : off(); }); }
  function same(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      var av = a[i] ? a[i].v : 0, bv = b[i] ? b[i].v : 0;
      if (av !== bv) return false;
      if (av && (a[i].r || 1) !== (b[i].r || 1)) return false;
    }
    return true;
  }
  // "x" hit, "X" accent, "o" ghost, "2"/"3"/"4" roll, "t" triplet roll, anything else off
  function parse(str, bars) {
    str = String(str || "");
    var n = 16 * clampBars(bars), out = new Array(n), len = str.length;
    for (var i = 0; i < n; i++) {
      var c = len ? str.charAt(i % len) : ".";
      out[i] = c === "x" ? hit(100, 1) : c === "X" ? hit(124, 1) : c === "o" ? hit(55, 1)
        : (c === "2" || c === "3" || c === "4") ? hit(96, +c) : c === "t" ? hit(96, 3) : off();
    }
    return out;
  }
  function str(pat) {
    var s = "";
    for (var i = 0; i < pat.length; i++) {
      var st = pat[i];
      s += !st || !st.v ? "." : st.r > 1 ? String(clampR(st.r)) : st.v >= 115 ? "X" : st.v <= 62 ? "o" : "x";
    }
    return s;
  }
  function on(p, i) { return i >= 0 && i < p.length && p[i].v > 0; }
  function onIdx(p, skipDownbeats) {
    var out = [];
    for (var i = 0; i < p.length; i++) if (p[i].v > 0 && !(skipDownbeats && i % 16 === 0)) out.push(i);
    return out;
  }
  function count(p, from, to) { var c = 0; for (var i = from; i < to; i++) if (p[i].v > 0) c++; return c; }
  function hitsPerBar(p, b) { return count(p, b * 16, b * 16 + 16); }
  // keep at most max hits in a bar: drop the softest ones (never step 0 of the bar)
  function capBar(p, b, max) {
    while (hitsPerBar(p, b) > max) {
      var softest = -1;
      for (var i = b * 16 + 1; i < b * 16 + 16; i++) if (p[i].v > 0 && (softest < 0 || p[i].v < p[softest].v)) softest = i;
      if (softest < 0) break;
      p[softest] = off();
    }
  }

  /* ---------- context ---------- */
  function ruleFor(genre) { return BY_ID[String(genre || "").toLowerCase()] || BY_ID.trap; }
  function midBpm(rule) { return Math.round((rule.bpm[0] + rule.bpm[1]) / 2); }
  function makeCtx(rule, bpm, bars, density, rng, pads, locked) {
    bpm = +bpm > 0 ? +bpm : midBpm(rule);
    var half = !!rule.half && bpm >= 100;        // half-time genres played slow turn double-time
    return {
      rule: rule, bpm: bpm, bars: bars, n: 16 * bars, half: half,
      bb: half ? [8] : [4, 12],                   // backbeat steps within a bar
      density: density, rng: rng, pads: pads || {}, locked: locked || {}
    };
  }
  function pad_(ctx, slot) { return ctx.pads[slot] || null; }
  function isBackbeat(ctx, i) { return ctx.bb.indexOf(i % 16) >= 0; }
  function dens(ctx, k) { return (0.5 + ctx.density) * (k == null ? 1 : k); }   // x1 at density 0.5

  /* ---------- rule generators ---------- */
  function genKick(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, bars = ctx.bars, style = ctx.rule.kick, b, base, last;
    var sub = pad_(ctx, "808");
    if (ctx.locked["808"] && sub) return kickFrom808(ctx);
    for (b = 0; b < bars; b++) {
      base = b * 16; last = b === bars - 1;
      if (style === "four") {
        p[base] = hit(120, 1); p[base + 4] = hit(112, 1); p[base + 8] = hit(116, 1); p[base + 12] = hit(112, 1);
      } else if (style === "trap") {
        p[base] = hit(122, 1);
        if (rng.chance(0.7 * dens(ctx))) p[base + rng.pick([10, 11, 10])] = hit(108, 1);
        if (rng.chance(0.35 * dens(ctx))) p[base + rng.pick([6, 7, 3])] = hit(100, 1);
        if (last && rng.chance(0.4)) p[base + rng.pick([14, 15])] = hit(96, 1);
        else if (b % 2 === 1 && rng.chance(0.3)) p[base + 13] = hit(92, 1);
      } else if (style === "rage") {
        if (b === 0 || rng.chance(0.6)) p[base] = hit(120, 1);
        if (rng.chance(0.3 * dens(ctx))) p[base + rng.pick([6, 10, 11])] = hit(104, 1);
      } else if (style === "drill") {
        p[base] = hit(120, 1);
        if (rng.chance(0.8)) p[base + 6] = hit(106, 1);
        if (rng.chance(0.6)) p[base + 12] = hit(104, 1); else p[base + 11] = hit(104, 1);
        if (last && rng.chance(0.4)) p[base + rng.pick([14, 15])] = hit(96, 1);
      } else if (style === "jersey") {
        [0, 3, 6, 10, 12].forEach(function (s, k) { p[base + s] = hit(k === 0 ? 120 : 108, 1); });
        if (last && rng.chance(0.5)) p[base + 14] = hit(104, 3);         // the triplet kick stutter
        else if (rng.chance(0.3)) p[base + 14] = hit(96, 1);
      } else if (style === "boom") {
        p[base] = hit(118, 1);
        var pool = rng.pick([[7, 10], [6, 10], [10], [3, 10], [7, 11], [6, 11, 14], [2, 7, 10]]);
        pool.forEach(function (s) { if (rng.chance(0.85)) p[base + s] = hit(s === 10 ? 110 : 100, 1); });
        if (last && rng.chance(0.35)) p[base + 15] = hit(92, 1);
      } else if (style === "twostep") {
        p[base] = hit(120, 1); p[base + 10] = hit(112, 1);
        if (rng.chance(0.25 * dens(ctx))) p[base + 14] = hit(96, 1);
        if (b % 2 === 1 && rng.chance(0.3)) p[base + 7] = hit(92, 1);
      } else if (style === "electro") {
        var pat = rng.weighted([[[0, 4, 8, 12], 5], [[0, 4, 8, 12, 14], 2], [[0, 7, 8, 10], 2], [[0, 6, 8, 11], 2]]);
        pat.forEach(function (s, k) { p[base + s] = hit(k === 0 ? 120 : s % 4 === 0 ? 112 : 100, 1); });
      }
    }
    return p;
  }
  // when the 808 is locked, the kick follows it instead
  function kickFrom808(ctx) {
    var sub = pad_(ctx, "808"), p = empty(ctx.bars), rng = ctx.rng, rage = ctx.rule.id === "rage";
    for (var i = 0; i < ctx.n; i++) {
      if (!sub[i].v) continue;
      if (i % 16 === 0 ? (rage ? rng.chance(0.6) : true) : rng.chance(rage ? 0.4 : 0.7)) p[i] = hit(i % 16 === 0 ? 120 : 104, 1);
    }
    if (!rage && !p[0].v) p[0] = hit(120, 1);
    return p;
  }
  function gen808(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, bars = ctx.bars, style = ctx.rule.sub, kick = pad_(ctx, "kick") || empty(bars), b, base, i;
    var snare = pad_(ctx, "snare");
    function free(i) { return !p[i].v && !kick[i].v && !(snare && snare[i].v >= 100); }
    if (style === "lead") {   // rage: the 808 is the drum
      for (b = 0; b < bars; b++) {
        base = b * 16;
        var pat = rng.pick([[0, 6, 10], [0, 7, 10, 14], [0, 10, 11], [0, 6, 11, 14], [0, 3, 10], [0, 10, 13]]);
        pat.forEach(function (s, k) { p[base + s] = hit(k === 0 ? 120 : 108, 1); });
        if (b === bars - 1 && rng.chance(0.4)) p[base + 15] = hit(100, 1);
      }
      for (i = 0; i < ctx.n; i++) if (kick[i].v && !p[i].v && rng.chance(0.5)) p[i] = hit(104, 1);
    } else if (style === "offbeat" && rng.chance(0.55)) {   // house/techno rolling bass
      for (i = 2; i < ctx.n; i += 4) p[i] = hit(100, 1);
      if (rng.chance(0.3)) p[0] = hit(108, 1);
    } else if (style === "eighths" && rng.chance(0.5)) {    // crystal: 8th-note bass
      for (i = 0; i < ctx.n; i += 2) p[i] = hit(i % 16 === 0 ? 110 : 96, 1);
      if (rng.chance(0.5)) for (i = 14; i < ctx.n; i += 16) p[i] = off();
    } else {                                                 // follow the kick (~75%) plus pickups, leave space
      for (i = 0; i < ctx.n; i++) if (kick[i].v && (i === 0 || rng.chance(0.75))) p[i] = hit(kick[i].v - 4, 1);
      var pickups = bars > 1 ? rng.range(1, 2) : (rng.chance(0.6) ? 1 : 0);
      var cands = [3, 11, 14, 15, 7, 13, 9];
      for (var k = 0; k < pickups; k++) {
        b = rng.int(bars); var s = base = b * 16 + rng.pick(cands);
        if (free(s)) p[s] = hit(100, 1);
      }
      if (!p[0].v && !count(p, 0, ctx.n)) p[0] = hit(112, 1);
    }
    for (b = 0; b < bars; b++) capBar(p, b, style === "eighths" ? 8 : 5);
    return p;
  }
  function fillInto(p, ctx) {   // a snare fill in the last bar
    var rng = ctx.rng, base = (ctx.bars - 1) * 16, id = ctx.rule.id, kind;
    var light = id === "lofi" || id === "house" || id === "techno";
    kind = rng.weighted([["climb", 3], ["double", light ? 1 : 3], ["trip", light ? 0.5 : 2], ["skip", 2]]);
    function put(s, v, r) { if (!isBackbeat(ctx, s) && !p[base + s].v) p[base + s] = hit(light ? v - 25 : v, r); }
    if (kind === "climb") { put(13, 80, 1); put(14, 92, 1); put(15, 104, 1); }
    else if (kind === "double") { put(14, 96, 2); put(15, 110, 1); }
    else if (kind === "trip") { put(15, 100, 3); }
    else { put(11, 84, 1); put(13, 94, 1); put(15, 106, 1); }
    return p;
  }
  function addGhosts(p, ctx) {
    var rule = ctx.rule, rng = ctx.rng;
    if (!rule.ghost) return p;
    var per = Math.round(rule.ghost * dens(ctx) * 2.2);   // ~0..3 per bar
    for (var b = 0; b < ctx.bars; b++) {
      var cands = rng.pick([[3, 7, 11, 15], [7, 10, 15, 2], [3, 10, 14, 11], [7, 11, 15, 6]]);
      for (var k = 0; k < per && k < cands.length; k++) {
        var s = b * 16 + cands[k];
        if (!p[s].v && !isBackbeat(ctx, s) && rng.chance(0.8)) p[s] = hit(rng.range(44, 58), 1);
      }
    }
    return p;
  }
  function genSnare(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, rule = ctx.rule, bars = ctx.bars, b, base;
    for (b = 0; b < bars; b++) {
      base = b * 16;
      if (rule.clapPrimary) {   // house/techno: the clap carries 2 and 4, the snare layers it sometimes
        if (rng.chance(0.4)) ctx.bb.forEach(function (s) { p[base + s] = hit(92, 1); });
        continue;
      }
      ctx.bb.forEach(function (s) { p[base + s] = hit(rule.id === "rage" ? 124 : 120, 1); });
      if (rule.id === "drill" && ctx.half && rng.chance(0.45)) p[base + 14] = hit(100, 1);
      if (rule.id === "jersey" && rng.chance(0.3)) p[base + 14] = hit(92, 1);
    }
    addGhosts(p, ctx);
    var fillChance = bars > 1 ? (rule.clapPrimary || rule.id === "lofi" ? 0.25 : 0.45) : 0.12;
    if (rng.chance(fillChance)) fillInto(p, ctx);
    return p;
  }
  function genClap(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, rule = ctx.rule, snare = pad_(ctx, "snare") || empty(ctx.bars), b, base, i;
    var strong = [];
    for (i = 0; i < ctx.n; i++) if (snare[i].v >= 100) strong.push(i);
    if (rule.clapPrimary) {
      for (b = 0; b < ctx.bars; b++) ctx.bb.forEach(function (s) { p[b * 16 + s] = hit(112, 1); });
      if (rule.id === "house" && rng.chance(0.3)) p[ctx.n - 1] = hit(84, 1);
      return p;
    }
    if (!strong.length) for (b = 0; b < ctx.bars; b++) ctx.bb.forEach(function (s) { strong.push(b * 16 + s); });
    if (rng.chance(rule.clap)) {   // layer the snare
      strong.forEach(function (i) { p[i] = hit(104, 1); });
      // and the fill, sometimes
      if (rng.chance(0.5)) for (i = ctx.n - 4; i < ctx.n; i++) if (snare[i].v >= 70 && snare[i].v < 115) p[i] = hit(snare[i].v, snare[i].r);
    } else {                       // answer it: a clap in the gap after the snare
      strong.forEach(function (i) {
        if (!rng.chance(0.65)) return;
        var cands = [i + 6, i + 7, i + 3], s;
        for (var k = 0; k < cands.length; k++) { s = cands[k]; if (s < ctx.n && !snare[s].v && !p[s].v && !isBackbeat(ctx, s)) { p[s] = hit(96, 1); break; } }
      });
      if (!count(p, 0, ctx.n) && strong.length) p[strong[0]] = hit(104, 1);
    }
    return p;
  }
  // thin or thicken a hat pattern by density (keeps the accents)
  function applyDensity(p, ctx) {
    var d = ctx.density, rng = ctx.rng, i;
    if (d < 0.5) { var drop = (0.5 - d) * 2 * 0.9; for (i = 1; i < p.length; i += 2) if (p[i].v && p[i].r === 1 && rng.chance(drop)) p[i] = off(); }
    else if (d > 0.5) { var add = (d - 0.5) * 2 * 0.7; for (i = 1; i < p.length; i += 2) if (!p[i].v && rng.chance(add)) p[i] = hit(70, 1); }
    return p;
  }
  function addRolls(p, ctx) {
    var rule = ctx.rule, rng = ctx.rng, bars = ctx.bars, b, base;
    if (!rule.rolls) return p;
    var spots = ctx.half ? [[15, 4], [14, 3], [7, 3], [6, 2], [11, 1], [3, 1]] : [[15, 4], [14, 2], [7, 3], [11, 1]];
    for (b = 0; b < bars; b++) {
      base = b * 16;
      if (!rng.chance(rule.rolls * (0.4 + ctx.density))) continue;
      var s = base + rng.weighted(spots);
      p[s] = hit(96, rng.weighted([[2, 4], [3, 3.5], [4, 2.5]]));
      if (rng.chance(0.3)) { var s2 = base + rng.weighted(spots); if (s2 !== s) p[s2] = hit(92, rng.pick([2, 3])); }
      if (b === bars - 1 && rule.id === "trap" && rng.chance(0.3 * ctx.density * 2)) for (var i = 12; i < 16; i++) p[base + i] = hit(90 + i, 2);   // the double-time run
    }
    return p;
  }
  function genHatClosed(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, rule = ctx.rule, style = rule.hats, i, b, base;
    for (b = 0; b < ctx.bars; b++) {
      base = b * 16;
      if (style === "16") for (i = 0; i < 16; i++) p[base + i] = hit(i % 4 === 0 ? 110 : i % 4 === 2 ? 92 : 78, 1);
      else if (style === "8" || style === "8off") {
        for (i = 0; i < 16; i += 2) p[base + i] = hit(i % 4 === 0 ? 106 : 88, 1);
        if (style === "8off" && rng.chance(0.5)) for (i = 3; i < 16; i += 4) p[base + i] = hit(70, 1);
      } else if (style === "drill") {
        var s = rng.pick(["x.x.xx.x.x.x.xx.", "x.x.x.xxx.x.x.x.", "x.xx.x.x.x.xx.x.", "x.x.x.x.xx.x.x.x"]);
        for (i = 0; i < 16; i++) if (s.charAt(i) === "x") p[base + i] = hit(i % 4 === 0 ? 108 : i % 2 ? 76 : 92, 1);
      } else if (style === "lazy") {
        for (i = 0; i < 16; i += 2) p[base + i] = hit(i % 4 === 0 ? 92 : 76, 1);
        if (rng.chance(0.5)) p[base + rng.pick([6, 10, 14])] = off();
        if (rng.chance(0.6)) p[base + rng.pick([3, 7, 11, 15])] = hit(64, 1);
      }
    }
    applyDensity(p, ctx);
    addRolls(p, ctx);
    return p;
  }
  function openSpots(ctx) {
    var rule = ctx.rule, bars = ctx.bars, rng = ctx.rng, out = [], b, base;
    for (b = 0; b < bars; b++) {
      base = b * 16;
      if (rule.open === "offbeat") {
        var all = rule.id === "house" || rng.chance(0.6);
        (all ? [2, 6, 10, 14] : [6, 14]).forEach(function (s) { out.push([base + s, 100]); });
      } else if (rule.open === "choke") {
        if (rng.chance(0.5)) out.push([base + rng.weighted([[15, 3.5], [7, 2.5], [14, 1.5], [6, 1.5], [11, 1]]), 92]);
      } else if (rule.open === "soft") {
        if (rng.chance(0.6)) out.push([base + rng.pick([6, 14]), 72]);
      } else if (b === bars - 1 && rng.chance(0.3)) out.push([base + 14, 88]);
    }
    return out;
  }
  function genHatOpen(ctx) {
    var p = empty(ctx.bars), closed = pad_(ctx, "hat_closed");
    openSpots(ctx).forEach(function (sv) {
      var s = sv[0];
      if (ctx.locked.hat_closed && closed && closed[s].v) {        // can't choke a locked closed hat: try a neighbour
        if (s + 1 < ctx.n && !closed[s + 1].v) s = s + 1; else if (s > 0 && !closed[s - 1].v) s = s - 1; else return;
      }
      p[s] = hit(sv[1], 1);
    });
    return p;
  }
  function genPerc(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, rule = ctx.rule, bars = ctx.bars, i, b;
    var kick = pad_(ctx, "kick"), snare = pad_(ctx, "snare"), clap = pad_(ctx, "clap");
    var busy = [];
    for (i = 0; i < 16; i++) busy.push((kick && kick[i].v) || (snare && snare[i].v >= 100) || (clap && clap[i].v));
    var per = Math.round(rule.perc * 4 * (0.4 + ctx.density * 1.2));
    if (per > 4) per = 4;
    var cands = [];
    for (i = 0; i < 16; i++) if (!busy[i]) cands.push([i, i % 4 === 3 ? 3 : i % 4 === 1 ? 1.5 : i % 4 === 2 ? 2 : 0.5]);
    var bar = empty(1), accent = -1;
    for (var k = 0; k < per && cands.length; k++) {
      var s = rng.weighted(cands);
      cands = cands.filter(function (c) { return c[0] !== s; });
      bar[s] = hit(rng.range(78, 90), 1);
      if (accent < 0) accent = s;
    }
    if (accent >= 0) bar[accent] = hit(100, 1);
    for (b = 0; b < bars; b++) for (i = 0; i < 16; i++) p[b * 16 + i] = hit(bar[i].v, bar[i].r);
    if (bars > 1 && rng.chance(0.4) && cands.length) {   // vary the last bar
      var base = (bars - 1) * 16, hits = onIdx(bar, false);
      if (hits.length) { p[base + rng.pick(hits)] = off(); p[base + rng.weighted(cands)] = hit(88, 1); }
    }
    return p;
  }
  function genFx(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng;
    if (!rng.chance(ctx.rule.fx * 0.9)) return p;
    var last = (ctx.bars - 1) * 16;
    if (rng.chance(0.55)) { p[0] = hit(110, 1); if (ctx.bars > 1 && rng.chance(0.15)) p[last + 15] = hit(96, 1); }
    else p[last + rng.pick([14, 15, 12])] = hit(100, 1);
    return p;
  }
  function genTexture(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng;
    if (!rng.chance(ctx.rule.tex)) return p;
    var s = rng.chance(0.3) ? 8 : 0;
    if (rng.chance(0.5)) for (var b = 0; b < ctx.bars; b++) p[b * 16 + s] = hit(90, 1);
    else p[s] = hit(96, 1);
    return p;
  }
  var GEN = { kick: genKick, "808": gen808, snare: genSnare, clap: genClap, hat_closed: genHatClosed, hat_open: genHatOpen, perc: genPerc, fx: genFx, texture: genTexture };

  // never an open hat and a closed hat on the same step: the open one wins (choke), unless the closed hat is locked
  function resolveHats(ctx) {
    var c = ctx.pads.hat_closed, o = ctx.pads.hat_open;
    if (!c || !o) return;
    for (var i = 0; i < ctx.n; i++) {
      if (!(c[i].v && o[i].v)) continue;
      if (!ctx.locked.hat_closed) c[i] = off();
      else if (!ctx.locked.hat_open) o[i] = off();
    }
  }

  /* ---------- templates (window.KillDrumGrooves) ---------- */
  function grooveList() {
    var g = null;
    try {
      if (typeof window !== "undefined" && window.KillDrumGrooves) g = window.KillDrumGrooves;
      else if (typeof require === "function" && typeof module !== "undefined") {
        try { g = require("./killdrum-grooves.js"); } catch (e) { g = null; }
      }
    } catch (e2) { g = null; }
    if (g && !Array.isArray(g) && Array.isArray(g.grooves)) g = g.grooves;
    return Array.isArray(g) ? g : [];
  }
  function groovesFor(genre, bpm) {
    var all = grooveList().filter(function (g) { return g && g.pads && g.genre === genre; });
    var near = all.filter(function (g) { return !g.bpm || !g.bpm.length || (bpm >= g.bpm[0] - 6 && bpm <= g.bpm[1] + 6); });
    return near.length ? near : all;
  }
  function fromGroove(g, bars) {
    var pads = {};
    SLOTS.forEach(function (slot) { pads[slot] = parse(g.pads[slot] || "", bars); });
    return pads;
  }
  function mutate(slot, src, ctx) {
    var p = clone(src), rng = ctx.rng, rule = ctx.rule, bars = ctx.bars, n = ctx.n, i, s, hits;
    if (slot === "kick") {
      if (ctx.locked["808"]) return kickFrom808(ctx);
      hits = onIdx(p, true);
      if (hits.length && rng.chance(0.4)) { i = rng.pick(hits); s = i + rng.pick([-1, 1]); if (s > 0 && s < n && !p[s].v && s % 16 !== 0) { p[s] = p[i]; p[i] = off(); } }
      if (rng.chance(0.3)) { s = (bars - 1) * 16 + rng.pick([14, 15]); if (!p[s].v) p[s] = hit(96, 1); }
      if (hits.length >= 3 && rng.chance(0.2)) p[rng.pick(onIdx(p, true))] = off();
      if (rule.id !== "rage" && !p[0].v) p[0] = hit(120, 1);
    } else if (slot === "808") {
      if (ctx.locked.kick || !count(p, 0, n)) return gen808(ctx);
      var kick = pad_(ctx, "kick");
      if (kick) for (i = 0; i < n; i++) if (kick[i].v && !p[i].v && rng.chance(0.35)) p[i] = hit(kick[i].v - 4, 1);
      if (rng.chance(0.4)) { s = rng.int(bars) * 16 + rng.pick([3, 11, 14, 15]); if (!p[s].v && !(kick && kick[s].v)) p[s] = hit(100, 1); }
      else if (rng.chance(0.3)) { hits = onIdx(p, true); if (hits.length > 1) p[rng.pick(hits)] = off(); }
      for (var b = 0; b < bars; b++) capBar(p, b, 5);
    } else if (slot === "snare") {
      addGhosts(p, ctx);
      if (rule.id === "drill" && ctx.half && rng.chance(0.3)) { s = rng.int(bars) * 16 + 14; p[s] = p[s].v ? off() : hit(100, 1); }
      if (rng.chance(bars > 1 ? 0.4 : 0.1)) fillInto(p, ctx);
      for (i = 0; i < n; i++) if (p[i].v && p[i].v < 70 && rng.chance(0.15)) p[i] = off();
    } else if (slot === "clap") {
      if (ctx.locked.snare || (!count(p, 0, n) && rng.chance(0.5))) return genClap(ctx);
      var snare = pad_(ctx, "snare");
      if (rng.chance(0.3)) { var c = [15, 14, 7, 6, 3]; for (i = 0; i < c.length; i++) { s = rng.int(bars) * 16 + c[i]; if (!p[s].v && !(snare && snare[s].v)) { p[s] = hit(90, 1); break; } } }
      else if (rng.chance(0.25) && count(p, 0, n) >= 2) p[rng.pick(onIdx(p, false))] = off();
    } else if (slot === "hat_closed") {
      applyDensity(p, ctx);
      for (i = 0; i < n; i++) if (p[i].r > 1 && rng.chance(0.3)) p[i] = hit(p[i].v, 1);
      addRolls(p, ctx);
    } else if (slot === "hat_open") {
      if (ctx.locked.hat_closed || rng.chance(0.3)) return genHatOpen(ctx);
      hits = onIdx(p, false);
      if (hits.length && rng.chance(0.3)) { i = rng.pick(hits); s = i + rng.pick([-1, 1, 8, -8]); if (s >= 0 && s < n && !p[s].v) { p[s] = p[i]; p[i] = off(); } }
    } else if (slot === "perc") {
      if (rng.chance(0.45) || !count(p, 0, n)) return genPerc(ctx);
      hits = onIdx(p, false);
      if (rng.chance(0.5)) { i = rng.pick(hits); s = i + rng.pick([-2, -1, 1, 2]); if (s >= 0 && s < n && !p[s].v) { p[s] = p[i]; p[i] = off(); } }
    } else if (slot === "fx") {
      if (rng.chance(0.5)) return genFx(ctx);
    } else if (slot === "texture") {
      if (rng.chance(0.5)) return genTexture(ctx);
    }
    return p;
  }

  /* ---------- names ---------- */
  function makeName(rule, rng) { return rng.pick(rule.names) + " " + rng.range(1, 9); }

  /* ---------- API ---------- */
  function beat(opts) {
    opts = opts || {};
    var rule = ruleFor(opts.genre), bars = clampBars(opts.bars == null ? 2 : opts.bars);
    var seed = opts.seed == null ? 1 : opts.seed;
    var density = opts.density == null ? 0.5 : Math.max(0, Math.min(1, +opts.density || 0));
    var rng = makeRng(seedOf("beat", seed, rule.id, bars, density));
    var pads = {}, locked = {}, lockedIn = opts.locked || {};
    SLOTS.forEach(function (slot) {
      var l = lockedIn[slot];
      if (!l || !l.length) return;
      pads[slot] = l.length === 16 * bars ? l : normalize(l, bars);   // exactly as given (repeat/trim only if the bar count differs)
      locked[slot] = true;
    });
    var ctx = makeCtx(rule, opts.bpm, bars, density, rng, pads, locked);
    var pool = (rule.half && !ctx.half) ? [] : groovesFor(rule.id, ctx.bpm), tpl = null;   // templates are written at genre tempo
    if (pool.length && rng.chance(0.7)) tpl = fromGroove(rng.pick(pool), bars);
    ORDER.forEach(function (slot) {
      if (locked[slot]) return;
      pads[slot] = tpl ? mutate(slot, tpl[slot], ctx) : GEN[slot](ctx);
    });
    resolveHats(ctx);
    return { name: makeName(rule, rng), genre: rule.id, bars: bars, pads: pads };
  }

  function pad(slot, opts) {
    opts = opts || {};
    slot = SLOTS.indexOf(slot) >= 0 ? slot : "kick";
    var rule = ruleFor(opts.genre), current = opts.beat && opts.beat[slot];
    var bars = clampBars(opts.bars == null ? (current && current.length ? current.length / 16 : 2) : opts.bars);
    var seed = opts.seed == null ? 1 : opts.seed, candidate = null, k;
    var bpm = +opts.bpm > 0 ? +opts.bpm : midBpm(rule);
    var pool = (rule.half && bpm < 100) ? [] : groovesFor(rule.id, bpm);
    for (k = 0; k < 8; k++) {
      var rng = makeRng(seedOf("pad", seed, rule.id, bars, slot, k));
      var pads = {}, locked = {};
      SLOTS.forEach(function (s) {
        if (s === slot || !opts.beat || !opts.beat[s]) return;
        pads[s] = opts.beat[s].length === 16 * bars ? opts.beat[s] : normalize(opts.beat[s], bars);
        locked[s] = true;
      });
      var ctx = makeCtx(rule, opts.bpm, bars, opts.density == null ? 0.5 : +opts.density, rng, pads, locked);
      if (pool.length && k % 2 === 1) candidate = mutate(slot, parse(rng.pick(pool).pads[slot] || "", bars), ctx);
      else candidate = GEN[slot](ctx);
      if (slot === "hat_closed" && pads.hat_open) for (var i = 0; i < ctx.n; i++) if (pads.hat_open[i].v) candidate[i] = off();
      if (!current || !same(candidate, current)) return candidate;
    }
    return candidate;
  }

  function timeFactor(slot) { return slot === "kick" || slot === "808" ? 0.25 : slot === "snare" || slot === "clap" ? 0.6 : 1; }

  function toNotes(pads, opts) {
    opts = opts || {}; pads = pads || {};
    var noteOf = opts.noteOf || NOTE_OF;
    var first = null;
    for (var key in pads) if (pads[key] && pads[key].length) { first = pads[key]; break; }
    var bars = clampBars(opts.bars == null ? (first ? first.length / 16 : 1) : opts.bars);
    var patBeats = bars * 4, n = bars * 16;
    var clipBeats = +opts.clipBeats > 0 ? +opts.clipBeats : patBeats;
    var swing = Math.max(0, Math.min(1, +opts.swing || 0)), hum = Math.max(0, Math.min(1, +opts.humanize || 0));
    var rng = makeRng(seedOf("notes", opts.seed == null ? 0 : opts.seed));
    var notes = [], slots = SLOTS.filter(function (s) { return pads[s]; });
    Object.keys(pads).forEach(function (s) { if (slots.indexOf(s) < 0) slots.push(s); });
    slots.forEach(function (slot) {
      var pitch = noteOf[slot];
      if (pitch == null || !pads[slot]) return;
      var pat = normalize(pads[slot], bars), tf = timeFactor(slot);
      var sustain = slot === "808" || slot === "fx" || slot === "texture", hits = [], rep, i, k;
      for (rep = 0; rep * patBeats < clipBeats; rep++) {
        for (i = 0; i < n; i++) {
          var st = pat[i];
          if (!st.v) continue;
          var base = rep * patBeats + (i + (st.o || 0)) * 0.25;
          if (base >= clipBeats) break;
          var sw = (i & 1) && !st.o ? swing * 0.0833 : 0, r = st.r;
          var spacing = r > 1 ? (0.25 - sw) * 0.8 / r : 0;   // r hits evenly spaced, kept inside the (swung) 16th
          for (k = 0; k < r; k++) {
            var start = base + sw + k * spacing;
            var vel = r > 1 ? st.v * (0.7 + 0.3 * k / (r - 1)) : st.v;
            if (hum > 0) { start += (rng.next() * 2 - 1) * hum * 0.02 * tf; vel += (rng.next() * 2 - 1) * hum * 12; }
            if (start < 0) start = 0;
            vel = Math.round(vel); if (vel < 1) vel = 1; if (vel > 127) vel = 127;
            hits.push({ start: start, vel: vel, len: 0.25 / r * 0.9, st: st, sub: k });
          }
        }
      }
      for (i = 0; i < hits.length; i++) {
        var h = hits[i], len = h.len;
        if (sustain) {
          var next = i + 1 < hits.length ? hits[i + 1].start : hits[0].start + clipBeats;
          len = Math.min(4, next - h.start, clipBeats - h.start);
          if (!(len > 0.05)) len = h.len;
        }
        var nt = { pitch: pitch, start: h.start, length: len, velocity: h.vel };
        if (h.st.c != null && h.st.c < 1) nt.chance = h.st.c;
        if (h.st.t) nt.tune = h.st.t;
        if (h.st.g && !h.sub) nt.slide = 1;
        if (h.st.o) nt.o = h.st.o;
        if (h.st.u) nt.u = h.st.u;
        notes.push(nt);
      }
    });
    notes.sort(function (a, b) { return a.start - b.start || a.pitch - b.pitch; });
    return notes;
  }

  function fromNotes(notes, opts) {
    opts = opts || {};
    var bars = clampBars(opts.bars == null ? 1 : opts.bars), n = bars * 16, noteOf = opts.noteOf || NOTE_OF;
    var slotOf = {}, pads = {}, cnt = {}, slot;
    for (slot in noteOf) { slotOf[noteOf[slot]] = slot; pads[slot] = empty(bars); cnt[slot] = new Array(n); }
    (notes || []).forEach(function (note) {
      if (!note) return;
      slot = slotOf[note.pitch];
      var start = +note.start;
      if (!slot || !(start >= 0 || start < 0) || !(start < bars * 4)) return;
      var step = Math.floor((start - (note.o > 0 ? note.o * 0.25 : 0)) * 4 + 0.15);   // tolerant floor: swing (late) and roll sub-hits still land in their step
      if (step < 0) step = 0;
      if (step >= n) return;
      var v = clampV(note.velocity == null ? 100 : note.velocity);
      if (v < 1) v = 1;
      var c = cnt[slot][step] || 0;
      cnt[slot][step] = c + 1;
      pads[slot][step] = extras(hit(Math.max(v, pads[slot][step].v), Math.min(4, c + 1)), c ? pads[slot][step] : { c: note.chance, t: note.tune, g: note.slide, o: note.o, u: note.u });
    });
    return pads;
  }

  var API = {
    GENRES: GENRES.map(function (g) { return { id: g.id, label: g.label, bpm: g.bpm.slice(), feel: g.feel }; }),
    SLOTS: SLOTS.slice(),
    NOTE_OF: NOTE_OF,
    beat: beat,
    pad: pad,
    toNotes: toNotes,
    fromNotes: fromNotes,
    empty: empty,
    parse: parse,
    str: str,
    same: same,
    grooves: grooveList
  };
  if (typeof window !== "undefined") window.KillDrumPatterns = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
