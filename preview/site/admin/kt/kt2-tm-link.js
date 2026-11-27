// OPEN IN TOY MACHINE from a link (Eman, 18 Nov 2026: "add a button for TM (toy machine), which opens ... from the
// sample being played, and i can myself select midi and dice around to find it, or change some notes").
// The Crystal Core page's TM button opens KILLTOY 2 with  #tm-<bpm>-<tonic 0-11>-<m|M>-<bars>-<notes>
// (only letters, digits and hyphens pass through an artifact link). <notes> = 6 base-36 characters per note:
// start in 1/16 steps (2), length in 1/16 steps (2), MIDI pitch (2).
// It starts a NEW project (the open one is kept as it is), sets tempo and key, adds a TOY MACHINE lane with a clip
// holding the notes, opens it in the piano roll on the DICE tab with SCIENCE set to CRYSTAL.
// window.KT2TmLink = { encode(o), decode(hash) }.  KT2_TM_LINK_OFF = the link is ignored.
(function () {
  "use strict";
  var W = window;
  var b36 = function (n) { n = Math.max(0, Math.min(1295, Math.round(n))); return (n < 36 ? "0" : "") + n.toString(36); };
  function encode(o) {
    var s = (o.notes || []).map(function (n) { return b36(n.start * 4) + b36(Math.max(1, n.length * 4)) + b36(n.pitch); }).join("");
    return "tm-" + Math.round(o.bpm) + "-" + (o.tonic % 12) + "-" + (o.minor ? "m" : "M") + "-" + (o.bars || 4) + "-" + s;
  }
  function decode(h) {
    var m = /^#?tm-(\d+)-(\d+)-([mM])-(\d+)-([0-9a-z]*)$/.exec(h || "");
    if (!m) return null;
    var notes = [], s = m[5];
    for (var i = 0; i + 6 <= s.length; i += 6) {
      notes.push({ start: parseInt(s.substr(i, 2), 36) / 4, length: parseInt(s.substr(i + 2, 2), 36) / 4, pitch: parseInt(s.substr(i + 4, 2), 36), velocity: 100 });
    }
    return { bpm: +m[1], tonic: +m[2] % 12, minor: m[3] === "m", bars: Math.max(1, Math.min(32, +m[4])), notes: notes };
  }
  W.KT2TmLink = { encode: encode, decode: decode };
  if (W.KT2_TM_LINK_OFF) return;
  var want = decode(location.hash);
  if (!want) return;
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* frame refuses: harmless */ }
  // ui is a top-level const in app.js: reachable by name from here, but not as window.ui
  var U = function () { try { return typeof ui !== "undefined" ? ui : W.ui; } catch (e) { return W.ui; } };
  var tries = 0;
  (function go() {
    if (typeof W.run !== "function" || !U() || !U().state) { if (++tries < 120) setTimeout(go, 250); return; }
    (async function () {
      try {
        await W.run("newSession");
        try { if (typeof W.showHome === "function") W.showHome(false); } catch (e) { /* fine */ }
        U().emptyOff = U().state.session; if (typeof W.render === "function") W.render();
        await W.run("setBpm", { bpm: want.bpm });
        await W.run("setKey", { tonic: want.tonic, minor: want.minor });
        var r = await W.run("newInstrumentLane", { key: "builtin:toymachine" }), tid = r && (r.trackId || r.id);
        var c = await W.run("newMidiClip", { trackId: tid, start: 0, bars: want.bars });
        await W.run("setMidiNotes", { clipId: c.clipId, notes: want.notes });
        try { if (W.KT2DiceSimple && KT2DiceSimple.setScience && KT2DiceSimple.science()) KT2DiceSimple.setScience("crystal"); } catch (e) { /* fine */ }
        setTimeout(function () {
          var t = U().state.tracks.find(function (x) { return x.id === tid; }), clip = t && t.clips.find(function (x) { return x.id === c.clipId; });
          if (t && clip && typeof W.openLaneWindow === "function") W.openLaneWindow({ t: t, clip: clip, view: "midi" });
          setTimeout(function () { var d = document.getElementById("tmm-mode-dice"); if (d) d.click(); }, 700);
        }, 400);
      } catch (e) { console.warn("TM link did not open", e); }
    })();
  })();
})();
