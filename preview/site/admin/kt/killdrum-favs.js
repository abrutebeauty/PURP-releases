/* KILLDRUM FAVORITES (Eman, 10 Nov 2026): the exact drum patterns of Eman's favorite songs, transcribed from the
   stems in FAVORITE STEMS/DRUMS (753 songs). With this file around, a share of the pattern dice (ROLL, Pattern only)
   lands on one of them exactly: kick, snare, hats, open hats and perc as the song plays them, nothing mutated.
   The song's tempo picks which ones can come up (same tempo, or half / double), so a roll still sits in the clip.
   Data: killdrum/favorites.json (made by research/fav-drums/tools/build_web.py on the Mac).
   Lanes: k kick, s snare/clap, h hats (X = open hat), p perc/toms; X accent, x hit, o ghost; 16 chars a bar, or 12
   (grid 12 = triplets, they land on the 16 grid with a 1/3 or 2/3 offset, like the rhythm brain's feels).
   window.KD_FAV_OFF = the old dice (no favorites). window.KD_FAV_SHARE = how often a roll is a favorite (0..1, 0.35).
   window.KillDrumFavs in the browser, module.exports in node (pure, no DOM). */
(function () {
  "use strict";
  var DATA = null, loading = null;
  var VEL = { X: 122, x: 100, o: 58 };
  var BLOB = "/_blob/4d64878fce9bf760ec6afb9cdd409548";   // killdrum/favorites.json in the asset store (14 Nov, 703 items; 12 Nov 522-item copy was 9a35e725a9be3bb0781ada35eec5a77c)

  function load(url) {
    if (DATA || loading || typeof fetch === "undefined") return loading;
    // the file next to the page, else its uploaded copy in the asset store (the artifact is at its size cap)
    var get = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    loading = get(url || "killdrum/favorites.json").then(function (d) { return d || get(BLOB); })
      .then(function (d) { if (d && d.items) { DATA = d; try { document.dispatchEvent(new CustomEvent("killdrum-favs")); } catch (e) { /* no DOM */ } } return DATA; })
      .catch(function () { return null; })
      // Deep debug 16 Nov: a download that failed once was remembered for good (no favorites until a reload). After 15 s
      // a failed try is forgotten and the next load() tries again. KT2_DATA_RETRY_OFF = old.
      .then(function (r) { if (!DATA && typeof window !== "undefined" && !window.KT2_DATA_RETRY_OFF) setTimeout(function () { if (!DATA) loading = null; }, 15000); return r; });
    return loading;
  }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }
  function hash(str) { var h = 2166136261; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // every pattern a favorite holds: the groove, then its alternates (verse / chorus / fills that came back often)
  function variants(it) { return [it].concat(it.a || []); }
  function byId(id) { if (!DATA) return null; for (var i = 0; i < DATA.items.length; i++) if (DATA.items[i].id === id) return DATA.items[i]; return null; }

  // tempo fit -> { w: 0..1, stretch: 1 | 2 }. Same tempo = 1. A favorite at half the clip's tempo also fits: each of its
  // steps then takes two of the clip's (a 1-bar groove fills 2 bars), so it still plays exactly as the song does.
  function tempoFit(fav, clip) {
    if (!fav || !clip) return { w: 0.5, stretch: 1 };
    var same = 1 - Math.abs(Math.log(fav / clip)) / 0.1, half = 1 - Math.abs(Math.log(fav * 2 / clip)) / 0.1;
    return same >= half ? { w: Math.max(0, same), stretch: 1 } : { w: Math.max(0, half) * 0.8, stretch: 2 };
  }
  // every favorite with a groove goes in the dice (Eman: "I WANT ALL OF THESE"); how sure the transcription is weights it
  function diceable(it) { return (it.n || 0) >= 2 && (/[Xxo]/.test(it.k) || /[Xxo]/.test(it.s)); }

  // pick a favorite for a roll: null = let the normal dice roll. ctx = { bpm, seed, force }
  function pick(ctx) {
    if (!DATA || (typeof window !== "undefined" && window.KD_FAV_OFF)) return null;
    var R = rng(hash("fav:" + ctx.seed));
    // OWN SOURCES (Eman, 12 Nov): every pattern roll is one of Eman's favorites (when one fits the tempo); the hand-made
    // grooves come back to 35% with the HAND-MADE DRUM GROOVES switch on the UNPERSONAL DATA page, or KT2_OWN_SOURCES_OFF
    var hand = typeof window === "undefined" || (window.KT2Use ? window.KT2Use("drumgrooves") : !!window.KT2_OWN_SOURCES_OFF);
    var share = typeof window !== "undefined" && window.KD_FAV_SHARE != null ? +window.KD_FAV_SHARE : hand ? 0.35 : 1;
    if (!ctx.force && R() >= share) return null;
    // TRAINED (Eman, 14 Nov): every analysed pattern can come up at any tempo (a pattern is steps, it plays at any BPM;
    // the ones near the clip's tempo still come up most), and about 4 in 10 rolls blend two patterns (see blendOf).
    // About 1 in 7 rolls is a basic beat style instead (null here: the rhythm skeletons of KillDrumRhythms play).
    // KD_TRAIN_OFF = the old pick (only patterns near the tempo, no blends, no basic styles)
    var train = !(typeof window !== "undefined" && window.KD_TRAIN_OFF);
    if (train && !ctx.force && !hand && R() < (typeof window !== "undefined" && window.KD_BASIC_SHARE != null ? +window.KD_BASIC_SHARE : 0.15)) return null;
    var pool = [], tot = 0;
    DATA.items.forEach(function (it) {
      if (!diceable(it)) return;
      var tf = tempoFit(it.bpm, ctx.bpm), w = tf.w * (0.4 + (it.c || 0.5));
      if (train) w = Math.max(w, 0.12 * (0.4 + (it.c || 0.5)));
      if (w > 0.02) { pool.push([it, w, tf.w > 0.02 ? tf.stretch : 1]); tot += w; }
    });
    if (!pool.length) return null;
    var draw = function (not) {
      var x = R() * tot, c = pool[0];
      for (var i = 0; i < pool.length; i++) { x -= pool[i][1]; if (x <= 0) { c = pool[i]; break; } }
      if (not && c[0] === not) c = pool[(pool.indexOf(c) + 1 + Math.floor(R() * (pool.length - 1))) % pool.length];
      return c;
    };
    var c0 = draw(null), chosen = c0[0], stretch = c0[2];
    var vs = variants(chosen), vi = R() < 0.7 ? 0 : 1 + Math.floor(R() * Math.max(1, vs.length - 1));
    var out = { item: chosen, variant: Math.min(vi, vs.length - 1), stretch: stretch };
    if (train && pool.length > 1 && R() < (typeof window !== "undefined" && window.KD_BLEND_SHARE != null ? +window.KD_BLEND_SHARE : 0.45)) {
      var c1 = draw(chosen), v1 = variants(c1[0]);
      out.blend = { item: c1[0], variant: R() < 0.7 ? 0 : Math.min(v1.length - 1, 1 + Math.floor(R() * Math.max(1, v1.length - 1))), stretch: c1[2], how: BLENDS[Math.floor(R() * BLENDS.length)], seed: Math.floor(R() * 1e9) };
    }
    return out;
  }
  // how two patterns mix: whose lanes go where, or one bar of each, or the steps of both woven together
  var BLENDS = ["kick", "hats", "groove", "bars", "weave", "top"];
  var BLEND_SAY = { kick: "with the kick from", hats: "with the hats from", groove: "with the kick + snare from", bars: "with every other bar from", weave: "woven with", top: "with the snare + hats from" };
  // a pads set (toPads) mixed with another: A keeps what B doesn't give
  function blendPads(a, b, how, seed, bars) {
    var R = rng(seed || 7), out = {}, k;
    for (k in a) out[k] = a[k].slice();
    var take = function (lanes) { lanes.forEach(function (l) { if (b[l]) out[l] = b[l].slice(); }); };
    if (how === "kick") take(["kick"]);
    else if (how === "hats") take(["hat_closed", "hat_open"]);
    else if (how === "groove") take(["kick", "snare"]);
    else if (how === "top") take(["snare", "hat_closed", "hat_open", "perc"]);
    else if (how === "bars") { for (k in out) if (b[k]) for (var i = 0; i < out[k].length; i++) if (Math.floor(i / 16) % 2 === 1) out[k][i] = b[k][i]; }
    else {   // weave: each lane keeps A's hits on the beats and takes B's hits between them, with a little chance
      for (k in out) if (b[k]) for (var j = 0; j < out[k].length; j++) {
        var onBeat = j % 4 === 0, ah = out[k][j] && out[k][j].v, bh = b[k][j] && b[k][j].v;
        if (!onBeat && bh && !ah && R() < 0.6) out[k][j] = b[k][j];
        else if (!onBeat && ah && !bh && R() < 0.35) out[k][j] = { v: 0, r: 1 };
      }
    }
    return out;
  }

  function off() { return { v: 0, r: 1 }; }
  // one lane string -> KILLDRUM steps (16 a bar); rolls = the same length string of 2..4 (hits inside the step)
  function steps(str, grid, bars, rolls, only, stretch) {
    var per = grid || 16, nb = Math.max(1, Math.round(str.length / per)), out = [], i, st = stretch || 1;
    for (i = 0; i < 16 * bars; i++) out.push(off());
    if (st > 1) {   // half-tempo favorite: lay it out on a 32nd grid of its own bar, then every clip step = one of those
      var wide = steps(str, grid, Math.ceil(bars / 2), rolls, only, 1);
      for (i = 0; i < 16 * bars; i++) {
        var src = wide[Math.floor(i / 2)];
        if (i % 2 === 0 && src && src.v) { var c2 = { v: src.v, r: src.r }; if (src.o) { var t = src.o * 2; if (t >= 1) { out[i + 1] = { v: src.v, r: src.r }; if (t > 1) out[i + 1].o = t - 1; continue; } c2.o = t; } out[i] = c2; }
      }
      return out;
    }
    for (var b = 0; b < bars; b++) {
      for (i = 0; i < per; i++) {
        var c = str[((b % nb) * per + i) % str.length];
        if (!c || c === "." || (only && only.indexOf(c) < 0)) continue;
        var step, o = 0;
        if (per === 12) { var beat = Math.floor(i / 3), sub = i % 3; step = beat * 4 + sub; o = sub === 1 ? 1 / 3 : sub === 2 ? 2 / 3 : 0; } else step = i;
        var s = { v: VEL[c] || 100, r: 1 };
        var rr = rolls && rolls[((b % nb) * per + i) % rolls.length];
        if (rr && rr !== ".") s.r = Math.max(1, Math.min(4, +rr));
        if (o) s.o = o;
        out[b * 16 + step] = s;
      }
    }
    return out;
  }

  // a favorite -> pads { kick, snare, hat_closed, hat_open, perc, clap } over `bars` bars (the song's own bars repeat)
  function toPads(item, variant, bars, stretch) {
    var v = variants(item)[variant || 0] || item, g = v.g || item.g || 16, rolls = v.r || item.r || {}, x = stretch || 1;
    return {
      kick: steps(v.k, g, bars, null, null, x), snare: steps(v.s, g, bars, rolls.s, null, x), hat_closed: steps(v.h, g, bars, rolls.h, "xo", x),
      hat_open: steps(v.h, g, bars, null, "X", x), perc: steps(v.p || "", g, bars, null, null, x), clap: steps("", g, bars),
    };
  }
  // how many of the song's own bars the pattern covers (1 or 2)
  function barsOf(item, variant) { var v = variants(item)[variant || 0] || item; return Math.max(1, Math.round(v.k.length / (v.g || item.g || 16))); }
  function swingOf(item) { return item.g === 12 ? 0 : item.sw > 0.53 ? +Math.min(0.6, (item.sw - 0.5) / 0.17 * 0.6).toFixed(2) : 0; }

  var API = { blendPads: blendPads, BLEND_SAY: BLEND_SAY, BLENDS: BLENDS, load: load, setData: function (d) { DATA = d && d.items ? d : null; }, data: function () { return DATA; }, byId: byId, pick: pick, toPads: toPads, barsOf: barsOf, swingOf: swingOf, variants: variants, tempoFit: tempoFit, diceable: diceable, steps: steps };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") { window.KillDrumFavs = API; if (!window.KD_FAV_OFF) load(); }
})();
