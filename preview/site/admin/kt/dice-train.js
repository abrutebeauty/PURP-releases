/* DICE TRAIN (Eman, 14 Nov 2026): the MIDI dice learns ONLY from concrete MIDI: real MIDI files (Songsterr tabs,
   YouTube MIDI videos, piano-tutorial MIDIs, MuseScore) and the MIDI transcribed from Eman's own MIDI videos, plus a
   small floor of basic theory (common loops, bass moves, melody cells) so it still knows things the songs don't have.
   Data: ui/dice-train-data.json, built by scripts/dice/build_dice_train.py (re-run it as more MIDI lands).

   CHORDS  every source loop can come up exactly; most rolls morph one (a chord swapped for a relative, the loop
           turned around, a passing chord, a held chord, another ending...), some blend two loops, a few are theory loops.
   BASS    one-bar bass figures from the songs (rhythm + where they sit against the chord root), one per roll, or two
           blended (one's rhythm, the other's notes); the old hand grooves stay as the floor.
   MELODY  two-bar top-line phrases from the songs, put into the key on the chords under them, answered or blended.
   ARP     is ui/toymachine-arps-songs.js (arps found in Eman's songs) + the plain shapes, over these same chords.

   window.KT2DiceTrain in the browser, module.exports in node. KT2_DICE_TRAIN_OFF = the dice as before. */
(function () {
  "use strict";
  var W = typeof window !== "undefined" ? window : {};
  var DATA = null, loading = null, IDX = null;
  var BLOB = "/_blob/47172091e534a430cfde3065e22db2c4";   // the asset-store copy of ui/dice-train-data.json (the playground fills this in when it uploads it)
  var on = function () { return !W.KT2_DICE_TRAIN_OFF; };
  var pc = function (x) { return ((x % 12) + 12) % 12; };

  function load(url) {
    if (DATA || loading || typeof fetch === "undefined") return loading;
    var get = function (u) { return u ? fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null); };
    loading = get(url || "dice-train-data.json").then(function (d) { return d || get(W.KT2_DICE_TRAIN_URL || BLOB); })
      .then(function (d) { if (d && d.progs) setData(d); return DATA; }).catch(function () { return null; })
      // Deep debug 16 Nov: a download that failed once (a network blip as the page opened) was remembered for good, so the
      // dice stayed without its data until a reload. After 15 s a failed try is forgotten and the next load() tries again.
      // KT2_DATA_RETRY_OFF = old.
      .then(function (r) { if (!DATA && typeof window !== "undefined" && !W.KT2_DATA_RETRY_OFF) setTimeout(function () { if (!DATA) loading = null; }, 15000); return r; });
    return loading;
  }
  function setData(d) {
    DATA = d; IDX = { minor: [], major: [], bass: [], mel: { minor: [], major: [] }, perSong: {} };
    d.progs.forEach(function (p) { IDX.perSong[p[0]] = (IDX.perSong[p[0]] || 0) + 1; });
    d.progs.forEach(function (p) {
      var toks = p[2].split(" "), w = Math.sqrt(p[3] || 1) / Math.sqrt(IDX.perSong[p[0]]);   // a song with many loops doesn't drown the rest
      (p[1] ? IDX.minor : IDX.major).push({ song: p[0], toks: toks, w: w });
    });
    d.bass.forEach(function (b) { IDX.bass.push({ song: b[0], notes: b[1].split(",").map(function (x) { var a = x.split("."); return [+a[0], +a[1], +a[2]]; }), w: Math.sqrt(b[2] || 1) }); });
    IDX.vmel = { minor: [], major: [] };
    (d.vmel || []).forEach(function (m) { (m[1] ? IDX.vmel.minor : IDX.vmel.major).push({ song: m[0], vocal: true, notes: m[2].split(",").map(function (x) { var a = x.split("."); return [+a[0], +a[1], parseInt(a[2], 10), 0]; }), w: 1 }); });
    d.mel.forEach(function (m) { (m[1] ? IDX.mel.minor : IDX.mel.major).push({ song: m[0], notes: m[2].split(",").map(function (x) { var a = x.split("."); return [+a[0], +a[1], parseInt(a[2], 10), /\+$/.test(a[2]) ? 1 : 0]; }), w: Math.sqrt(m[3] || 1) }); });
    try { document.dispatchEvent(new CustomEvent("dicetrain", { detail: d.n })); } catch (e) { /* no DOM */ }
  }
  var ready = function () { return !!(DATA && on()); };
  var songName = function (i) { var s = DATA && DATA.songs[i]; return s ? s[1] : ""; };

  function pickW(arr, R, wf) { var t = 0, i; for (i = 0; i < arr.length; i++) t += wf(arr[i]); var x = R() * t; for (i = 0; i < arr.length; i++) { x -= wf(arr[i]); if (x <= 0) return arr[i]; } return arr[arr.length - 1]; }

  // ---------------------------------------------------------------- theory floor
  // tokens = semitones above the tonic + quality, one per half bar (like the data)
  var THEORY = {
    minor: ["0m 0m 8 8 3 3 10 10", "0m 0m 5m 5m 8 8 7 7", "0m 0m 10 10 8 8 10 10", "0m 0m 5m 5m 7m 7m 0m 0m", "0m 0m 8 8 5m 5m 7 7", "0m 0m 3 3 10 10 5m 5m",
      "0m 0m 0m 0m 8 8 8 8", "0m 0m 8 8 10 10 0m 0m", "0m 0m 2dim 2dim 7 7 0m 0m", "0m 0m 5m 5m 10 10 3 3", "8 8 10 10 0m 0m 0m 0m", "0m 10 8 10 0m 10 8 7"],
    major: ["0 0 7 7 9m 9m 5 5", "9m 9m 5 5 0 0 7 7", "0 0 5 5 9m 9m 7 7", "0 0 9m 9m 5 5 7 7", "2m 2m 7 7 0 0 0 0", "0 0 4m 4m 5 5 5m 5m",
      "0 0 5 5 0 0 7 7", "5 5 7 7 4m 4m 9m 9m", "0 0 10 10 5 5 0 0", "0 0 7 7 5 5 5 5", "9m 9m 7 7 5 5 7 7", "0 7 9m 5 0 7 5 5"],
  };

  // ---------------------------------------------------------------- chord morphs
  var parse = function (t) { var m = /^(\d+)(.*)$/.exec(t || "0"); return { r: +m[1], q: m[2] || "" }; };
  var tk = function (r, q) { return pc(r) + (q || ""); };
  var MINS = [0, 2, 3, 5, 7, 8, 10], MAJS = [0, 2, 4, 5, 7, 9, 11];
  // the diatonic triad on a root of the key (minor/major), or null
  function triadOn(r, minor) { var st = minor ? MINS : MAJS, d = st.indexOf(pc(r)); if (d < 0) return null; var t3 = pc(st[(d + 2) % 7] - st[d]), t5 = pc(st[(d + 4) % 7] - st[d]); return tk(st[d], t3 === 4 ? "" : t5 === 6 ? "dim" : "m"); }
  // relatives: the chords a third up / down share two notes with it (I <-> vi, I <-> iii, IV <-> ii...)
  function relative(t, minor, R) { var p = parse(t), st = minor ? MINS : MAJS, d = st.indexOf(p.r); if (d < 0) return t; var to = st[(d + (R() < 0.5 ? 2 : 5)) % 7], c = triadOn(to, minor); return c && !/dim/.test(c) ? c : t; }
  function neighbour(t, minor, R) { var p = parse(t), st = minor ? MINS : MAJS, d = st.indexOf(p.r); if (d < 0) return t; var c = triadOn(st[(d + (R() < 0.5 ? 1 : 6)) % 7], minor); return c && !/dim/.test(c) ? c : t; }
  // chord changes as [token, halfbars] runs
  function runs(toks) { var out = []; toks.forEach(function (t) { var l = out[out.length - 1]; if (l && l[0] === t) l[1]++; else out.push([t, 1]); }); return out; }
  function unruns(rs) { var out = []; rs.forEach(function (r) { for (var i = 0; i < r[1]; i++) out.push(r[0]); }); return out; }
  var MORPHS = [
    { k: "relative", f: function (toks, minor, R) { var rs = runs(toks), i = 1 + Math.floor(R() * Math.max(1, rs.length - 1)); if (rs[i]) rs[i][0] = relative(rs[i][0], minor, R); return unruns(rs); } },
    { k: "turned", f: function (toks, minor, R) { var n = toks.length, k = 2 * (1 + Math.floor(R() * (n / 2 - 1))); return toks.slice(k).concat(toks.slice(0, k)); } },
    { k: "swapped", f: function (toks, minor, R) { var rs = runs(toks); if (rs.length < 3) return toks; var i = 1 + Math.floor(R() * (rs.length - 2)), t = rs[i][0]; rs[i][0] = rs[i + 1][0]; rs[i + 1][0] = t; return unruns(rs); } },
    { k: "passing chord", f: function (toks, minor, R) { var rs = runs(toks), c = rs.filter(function (r) { return r[1] >= 2; }); if (!c.length) return toks; var r = c[Math.floor(R() * c.length)], i = rs.indexOf(r), nx = rs[(i + 1) % rs.length][0], half = Math.floor(r[1] / 2); rs.splice(i + 1, 0, [R() < 0.5 ? neighbour(nx, minor, R) : relative(r[0], minor, R), r[1] - half]); r[1] = half; return unruns(rs); } },
    { k: "held", f: function (toks, minor, R) { var rs = runs(toks); if (rs.length < 3) return toks; var i = Math.floor(R() * (rs.length - 1)); rs[i][1] += rs[i + 1][1]; rs.splice(i + 1, 1); return unruns(rs); } },
    { k: "new ending", f: function (toks, minor, R) { var rs = runs(toks), ends = minor ? ["7", "10", "5m", "8", "7m"] : ["7", "5", "2m", "4m", "10"]; rs[rs.length - 1][0] = ends[Math.floor(R() * ends.length)]; return unruns(rs); } },
    { k: "answered", f: function (toks, minor, R) { var h = toks.length / 2, a = toks.slice(0, h), b = a.slice(); var rs = runs(b); rs[rs.length - 1][0] = R() < 0.5 ? relative(rs[rs.length - 1][0], minor, R) : neighbour(rs[rs.length - 1][0], minor, R); return a.concat(unruns(rs)); } },
    { k: "suspended", f: function (toks, minor, R) { var rs = runs(toks), i = Math.floor(R() * rs.length), p = parse(rs[i][0]); if (p.q === "" || p.q === "m") rs[i][0] = tk(p.r, R() < 0.5 ? "sus2" : "sus4"); return unruns(rs); } },
    { k: "pedal start", f: function (toks, minor, R) { var t = toks.slice(), h = Math.max(1, Math.floor(t.length / 4)); for (var i = 1; i < h + 1 && i < t.length; i++) t[i] = t[0]; return t; } },
    { k: "doubled time", f: function (toks, minor, R) { var rs = runs(toks); if (rs.length > 4) return toks; var out = []; rs.forEach(function (r) { out.push([r[0], Math.max(1, Math.ceil(r[1] / 2))]); }); var t = unruns(out); while (t.length < toks.length) t = t.concat(t); return t.slice(0, toks.length); } },
  ];

  // a loop from a major song played in a minor key (or back): the relative key, so every chord keeps its job
  function toMode(toks, fromMinor, minor) { if (!!fromMinor === !!minor) return toks; var sh = fromMinor ? 9 : 3; return toks.map(function (t) { var p = parse(t); return tk(p.r + sh, p.q); }); }

  // CHORDS. o = { minor, nseg, segLen, rng, avoid (Set of loop keys), text }
  // -> { toks (nseg chord tokens), how: exact | morphed | blend | theory, from: song names, morph: [names] }
  function chords(o) {
    if (!ready()) return null;
    var R = o.rng || Math.random, minor = !!o.minor, halfPer = Math.max(1, Math.round((o.segLen || 4) / 2));
    var need = Math.max(1, Math.round(o.nseg * halfPer));   // half bars the clip holds
    var words = String(o.text || "").toLowerCase().split(/[^a-z0-9\u00c0-\u024f$]+/).filter(function (w) { return w.length >= 3; });
    var own = IDX[minor ? "minor" : "major"], other = IDX[minor ? "major" : "minor"];
    var pool = own.map(function (x) { return { x: x, m: minor, w: x.w }; }).concat(other.map(function (x) { return { x: x, m: !minor, w: x.w * 0.35 }; }));
    if (words.length) {   // a song or artist named in the prompt: its loops first
      var hit = pool.filter(function (e) { var s = DATA.songs[e.x.song] || [], t = (s[0] + " " + s[1]).toLowerCase(); return words.some(function (w) { return t.indexOf(w) >= 0; }); });
      if (hit.length) pool = hit;
    }
    var take = function () { var e = pickW(pool, R, function (e) { return e.w; }); return { toks: toMode(e.x.toks, e.m, minor), song: e.x.song }; };
    var fit = function (toks) {   // the source's half bars onto the clip: 8-bar loops on 4 bars take one half, short ones repeat
      var t = toks.slice();
      if (t.length > need && t.length % need === 0) { var parts = t.length / need, k = Math.floor(R() * parts); t = t.slice(k * need, (k + 1) * need); }
      while (t.length < need) t = t.concat(toks);
      return t.slice(0, need);
    };
    var roll = R(), how, from = [], morph = [], toks;
    var shares = W.KT2_DICE_TRAIN_SHARES || { exact: 0.25, morph: 0.5, blend: 0.15 };
    for (var tries = 0; tries < 8; tries++) {
      morph = []; from = [];
      if (roll < shares.exact) { var a = take(); toks = fit(a.toks); how = "exact"; from = [a.song]; }
      else if (roll < shares.exact + shares.morph) {
        var b = take(); toks = fit(b.toks); how = "morphed"; from = [b.song];
        var n = 1 + (R() < 0.45 ? 1 : 0) + (R() < 0.15 ? 1 : 0);
        for (var i = 0; i < n; i++) { var m = MORPHS[Math.floor(R() * MORPHS.length)]; var nt = m.f(toks.slice(), minor, R); if (nt && nt.length === toks.length && nt.join(" ") !== toks.join(" ")) { toks = nt; morph.push(m.k); } }
        if (!morph.length) how = "exact";
      } else if (roll < shares.exact + shares.morph + shares.blend) {
        var c = take(), d = take(), A = fit(c.toks), B = fit(d.toks), h = need / 2, way = R();
        how = "blend"; from = [c.song, d.song];
        if (way < 0.45) toks = A.slice(0, Math.ceil(h)).concat(B.slice(Math.ceil(h)));   // first half of one, second half of the other
        else if (way < 0.75) { var ra = runs(A), rb = runs(B); toks = unruns(ra.map(function (r, j) { return [j % 2 ? rb[j % rb.length][0] : r[0], r[1]]; })); }   // one's chord rhythm, chords from both
        else { var rb2 = runs(B), ra2 = runs(A); toks = unruns(rb2.map(function (r, j) { return [ra2[j % ra2.length][0], r[1]]; })); }   // one's chords in the other's rhythm
        toks = fit(toks);
      } else {
        var th = THEORY[minor ? "minor" : "major"]; toks = fit(th[Math.floor(R() * th.length)].split(" ")); how = "theory";
      }
      var key = segsOf(toks, o.nseg, halfPer).join(" ");
      if (!(o.avoid && o.avoid.has && o.avoid.has(key))) break;
      roll = R();
    }
    // no diminished chord on the 7th of a major key (live check 14 Nov: minor loops with ii-dim moved to major came out
    // as "Bdim"): it plays the dominant it stands for. KT2_DICE_TRAIN_DIM_OLD = keep it
    if (!minor && !W.KT2_DICE_TRAIN_DIM_OLD) toks = toks.map(function (t) { return parse(t).r === 11 ? "7" : t; });
    return { toks: segsOf(toks, o.nseg, halfPer), how: how, from: from.map(songName).filter(Boolean), morph: morph };
  }
  // half-bar tokens -> one token per segment (the chord at the segment's start)
  function segsOf(toks, nseg, halfPer) { var out = []; for (var i = 0; i < nseg; i++) out.push(toks[Math.min(toks.length - 1, Math.floor(i * halfPer))] || toks[0]); return out; }

  // ---------------------------------------------------------------- BASS
  // o = { dens 0..3, rng, bars } -> { bars: [[[step, len16, semis above the chord root], ...] per bar], from, how }
  var BASS_DENS = [[1, 2], [2, 4], [3, 8], [5, 16]];
  function bass(o) {
    if (!ready() || !IDX.bass.length) return null;
    var R = o.rng || Math.random, dr = BASS_DENS[Math.max(0, Math.min(3, o.dens == null ? 1 : o.dens))];
    // GENRE (ui/kt2-dice-simple.js, 15 Nov): only the songs of the picked genre, when it has enough figures
    var gOk = typeof W.KT2_DICE_SONG_OK === "function" ? W.KT2_DICE_SONG_OK : null, all = gOk ? IDX.bass.filter(function (b) { return gOk(b.song); }) : IDX.bass;
    if (all.length < 8) all = IDX.bass;
    var pool = all.filter(function (b) { return b.notes.length >= dr[0] && b.notes.length <= dr[1]; });
    if (pool.length < 4) pool = all;
    var A = pickW(pool, R, function (b) { return b.w; }), how = "exact", from = [A.song], figA = A.notes;
    if (R() < 0.3) {   // blend: A's rhythm with B's notes
      var B = pickW(pool, R, function (b) { return b.w; }); how = "blend"; from.push(B.song);
      figA = A.notes.map(function (n, i) { return [n[0], n[1], B.notes[i % B.notes.length][2]]; });
    }
    // the turn: the last bar plays a sister figure from the same song now and then
    var sis = IDX.bass.filter(function (b) { return b.song === A.song && b !== A; }), turn = sis.length && R() < 0.5 ? sis[Math.floor(R() * sis.length)].notes : null;
    var out = []; for (var b = 0; b < (o.bars || 4); b++) out.push(turn && b === (o.bars || 4) - 1 ? turn : figA);
    return { bars: out, how: how, from: from.map(songName).filter(Boolean) };
  }

  // ---------------------------------------------------------------- MELODY
  // o = { minor, dens 0..3, rng, bars } -> { notes: [[step from clip start (16ths), len16, degree, chromatic]], from, how }
  var MEL_DENS = [[3, 6], [4, 9], [6, 14], [9, 32]];
  function melody(o) {
    if (!ready()) return null;
    var R = o.rng || Math.random, minor = !!o.minor, list = IDX.mel[minor ? "minor" : "major"].concat(IDX.mel[minor ? "major" : "minor"]);
    // VOCAL melodies (checked ones only, see the builder): about 1 in 5 melody rolls sings like a vocal. KT2_DICE_VOCAL_OFF = never
    var voc = !W.KT2_DICE_VOCAL_OFF && IDX.vmel && IDX.vmel[minor ? "minor" : "major"].length >= 8 && R() < (W.KT2_DICE_VOCAL_SHARE != null ? +W.KT2_DICE_VOCAL_SHARE : 0.2);
    if (voc) list = IDX.vmel[minor ? "minor" : "major"];
    var gOk = typeof W.KT2_DICE_SONG_OK === "function" ? W.KT2_DICE_SONG_OK : null;   // GENRE (ui/kt2-dice-simple.js)
    if (gOk) { var gl = list.filter(function (m) { return gOk(m.song); }); if (gl.length >= 8) list = gl; }
    if (!list.length) return null;
    var dr = MEL_DENS[Math.max(0, Math.min(3, o.dens == null ? 1 : o.dens))];
    var pool = list.filter(function (m) { return m.notes.length >= dr[0] && m.notes.length <= dr[1]; });
    if (pool.length < 4) pool = list;
    var A = pickW(pool, R, function (m) { return m.w; }), how = voc ? "vocal" : "exact", from = [A.song], phA = A.notes;
    var other = function (sameSong) { var c = pool.filter(function (m) { return m !== A && (!sameSong || m.song === A.song); }); return c.length ? c[Math.floor(R() * c.length)] : null; };
    var x = R(), phB;
    if (voc) phB = phA;   // a vocal line plays as it was sung
    else if (x < 0.35) { var s = other(true); phB = s ? s.notes : phA; if (s) how = "phrases"; }   // a second phrase from the same song answers
    else if (x < 0.6) { phB = phA.map(function (n, i, a) { return i < a.length - 2 ? n : [n[0], n[1], n[2] + (R() < 0.5 ? -1 : 1), 0]; }); how = "answered"; }   // the same phrase, a new ending
    else if (x < 0.8) { var bb = other(false); if (bb) { phA = phA.map(function (n, i) { return [n[0], n[1], bb.notes[i % bb.notes.length][2] - bb.notes[0][2] + phA[0][2], 0]; }); how = "blend"; from.push(bb.song); } phB = phA; }   // A's rhythm, B's shape
    else phB = phA;
    var out = [], bars = o.bars || 4;
    for (var b0 = 0; b0 < bars; b0 += 2) { var ph = (b0 / 2) % 2 ? phB : phA; ph.forEach(function (n) { if (b0 * 16 + n[0] < bars * 16) out.push([b0 * 16 + n[0], n[1], n[2], n[3]]); }); }
    return { notes: out, how: how, from: from.map(songName).filter(Boolean) };
  }

  var API = { load: load, setData: setData, data: function () { return DATA; }, ready: ready, on: on, chords: chords, bass: bass, melody: melody, THEORY: THEORY, MORPHS: MORPHS, runs: runs, toMode: toMode };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  // Speed pass round 2 (27 Nov): the 0.8 MB of song data is a second-wave download now. It loads once the page is up
  // and quiet, so it no longer competes with the editor opening (a roll that needs it before then waits for it, as
  // before). KT2_WAVE2_OLD = load it at once.
  if (typeof window !== "undefined") {
    window.KT2DiceTrain = API;
    if (on()) {
      if (W.KT2_WAVE2_OLD) load();
      else {
        var later = function () { if (W.requestIdleCallback) W.requestIdleCallback(function () { load(); }, { timeout: 4000 }); else setTimeout(load, 1500); };
        if (document.readyState === "complete") later(); else W.addEventListener("load", later, { once: true });
      }
    }
  }
})();
