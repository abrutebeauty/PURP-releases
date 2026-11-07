// Arrangement and transport helpers, the Ableton way:
//   Tap tempo     click the word "Tempo" (or press T) in time; from the 4th tap it sets the tempo
//   Cmd+L         loop the selected clips (and turn the loop on)
//   0             turn the selected clips off / on (greyed out, silent)
//   Reverse       right-click an audio clip (plays it backwards)
//   Cmd+J         join the selected MIDI clips on a lane into one
//   Ruler menu    right-click the ruler: insert a bar / delete this bar, Follow on/off
//   Cmd+Shift+F   Follow: the timeline scrolls along with the playhead (on by default)
// The new edit commands (setClipActive, reverseClip, consolidateClips, insertTime, deleteTime)
// only exist in the demo backend and the playground for now, so the UI shows them only when
// getState says canArrangeTools. Loaded before app.js (createDemoBackend uses demo()); the UI
// part starts on DOMContentLoaded, when app.js is there. Keep this file ASCII-only, like ui/.
"use strict";

window.KillToyArrange = (function () {
  // ---- the edits, on the demo/playground state S ------------------------------------------
  function demo(ctx) {
    const { S, handlers, changed, id } = ctx;
    const spb = () => 60 / S.bpm;
    const EPS = 1e-6;
    const find = (clipId) => { for (const t of S.tracks) { const c = t.clips.find((x) => x.id === clipId); if (c) return { t, c }; } return null; };
    // A copy of a clip with fresh ids (its effects keep pointing at their automation, like duplicateClips).
    const clone = (c) => {
      const k = structuredClone(c);
      k.id = id();
      (k.plugins || []).forEach((p) => { p.autoOf = p.autoOf || p.id; p.id = id(); });
      return k;
    };
    // Cut `d` seconds off the front of a clip: it starts later and reads its audio (or notes) later.
    const trimLeft = (c, d) => {
      c.start += d; c.length -= d;
      if (c.kind === "midi") {
        const db = d / spb();
        c.notes = (c.notes || []).filter((n) => n.start >= db - EPS).map((n) => ({ ...n, start: Math.max(0, n.start - db) }));
        if (c.beats != null) c.beats = c.length / spb();
        return;
      }
      c.offset = (c.offset || 0) + d;
      if (c.takeSrc) c.takeSrc = c.takeSrc.map((x) => (x ? { ...x, offset: (x.offset || 0) + d } : x));
      if (c.comp) c.comp = c.comp.map((x) => ({ ...x, start: Math.max(0, x.start - d), end: Math.min(c.length, x.end - d) })).filter((x) => x.end > x.start);
      c.fadeIn = 0; c.fadeOut = Math.min(c.fadeOut || 0, c.length);
    };
    // Cut a clip's tail so it ends `len` seconds after it starts.
    const trimRight = (c, len) => {
      c.length = len;
      if (c.kind === "midi") { c.notes = (c.notes || []).filter((n) => n.start * spb() < len - EPS); if (c.beats != null) c.beats = len / spb(); return; }
      if (c.comp) c.comp = c.comp.map((x) => ({ ...x, end: Math.min(len, x.end) })).filter((x) => x.end > x.start);
      c.fadeOut = 0; c.fadeIn = Math.min(c.fadeIn || 0, len);
    };
    const autoLanes = () => [...S.tracks.flatMap((t) => t.automation || []), ...((S.master && S.master.automation) || [])];

    handlers.setClipActive = ({ clipIds, clipId, active }) => {
      for (const cid of clipIds || [clipId]) {
        const f = find(cid);
        if (!f) continue;
        if (active) delete f.c.active; else f.c.active = false;
      }
      changed(); return { ok: true };
    };

    handlers.reverseClip = ({ clipId }) => {
      const f = find(clipId);
      if (!f || f.c.kind === "midi") return { error: "Reverse works on audio clips." };
      const c = f.c;
      c.reversed = !c.reversed;
      [c.fadeIn, c.fadeOut] = [c.fadeOut || 0, c.fadeIn || 0];   // the fades flip round with the sound
      if (c.comp) c.comp = c.comp.map((x) => ({ ...x, start: c.length - x.end, end: c.length - x.start })).reverse();
      changed(); return { ok: true, reversed: c.reversed };
    };

    // Joins MIDI clips on one lane into one clip that spans them (the first clip keeps its
    // instrument, effects and name). Notes past a clip's end were silent, so they go.
    handlers.consolidateClips = ({ clipIds }) => {
      const found = (clipIds || []).map(find).filter(Boolean);
      if (found.length < 2) return { error: "Select two or more MIDI clips on one lane." };
      if (found.some((f) => f.c.kind !== "midi")) return { error: "Join works on MIDI clips (not audio, yet)." };
      if (found.some((f) => f.t !== found[0].t)) return { error: "Pick MIDI clips on the same lane to join them." };
      const t = found[0].t, list = found.map((f) => f.c).sort((a, b) => a.start - b.start);
      const a = list[0].start, b = Math.max(...list.map((c) => c.start + c.length));
      const notes = [];
      for (const c of list) {
        const lenB = c.length / spb(), shift = (c.start - a) / spb();
        for (const n of c.notes || []) if (n.start < lenB - EPS) notes.push({ ...n, start: n.start + shift, length: Math.min(n.length, lenB - n.start) });
      }
      const base = list[0];
      Object.assign(base, { start: a, length: b - a, notes: notes.sort((x, y) => x.start - y.start), take: 0, takes: 0 });
      if (base.beats != null) base.beats = (b - a) / spb();
      delete base.takeNotes; delete base.takeTone; delete base.takeInfo;
      t.clips = t.clips.filter((c) => c === base || !list.includes(c));
      changed(); return { ok: true, clipId: base.id };
    };

    // Insert time: everything from `at` on moves later by `seconds`. A MIDI clip across the
    // point stretches (its later notes move); an audio clip across it is cut in two.
    handlers.insertTime = ({ at, seconds }) => {
      if (!(seconds > 0)) return { error: "Nothing to insert." };
      for (const t of S.tracks) {
        if (t.kind === "beat") continue;   // the reference beat stays put
        for (const c of [...t.clips]) {
          if (c.start >= at - EPS) { c.start += seconds; continue; }
          if (c.start + c.length <= at + EPS) continue;
          if (c.kind === "midi") {
            const cut = (at - c.start) / spb();
            c.notes = (c.notes || []).map((n) => (n.start >= cut - EPS ? { ...n, start: n.start + seconds / spb() } : n));
            c.length += seconds; if (c.beats != null) c.beats = c.length / spb();
          } else {
            const right = clone(c);
            trimLeft(right, at - c.start); right.start += seconds;
            trimRight(c, at - c.start);
            t.clips.splice(t.clips.indexOf(c) + 1, 0, right);
          }
        }
      }
      for (const lane of autoLanes()) lane.points = (lane.points || []).map((p) => (p.t >= at - EPS ? { ...p, t: p.t + seconds } : p));
      S.sections = (S.sections || []).map((x) => (x.start >= at - EPS && x.start > 0 ? { ...x, start: x.start + seconds } : x));
      if (S.loopStart >= at - EPS) S.loopStart += seconds;
      if (S.loopEnd > at + EPS) S.loopEnd += seconds;
      changed(); return { ok: true };
    };

    // Delete time: what sits between `at` and `at + seconds` goes, and everything after moves up.
    handlers.deleteTime = ({ at, seconds }) => {
      if (!(seconds > 0)) return { error: "Nothing to delete." };
      const b = at + seconds;
      for (const t of S.tracks) {
        if (t.kind === "beat") continue;
        for (const c of [...t.clips]) {
          const end = c.start + c.length;
          if (end <= at + EPS) continue;
          if (c.start >= b - EPS) { c.start -= seconds; continue; }
          if (c.start >= at - EPS && end <= b + EPS) { t.clips = t.clips.filter((x) => x !== c); continue; }
          if (c.start >= at - EPS) { trimLeft(c, b - c.start); c.start -= seconds; continue; }   // starts inside the gap
          if (end <= b + EPS) { trimRight(c, at - c.start); continue; }                         // ends inside the gap
          // runs right across the gap
          if (c.kind === "midi") {
            const a0 = (at - c.start) / spb(), b0 = (b - c.start) / spb();
            c.notes = (c.notes || []).filter((n) => n.start < a0 - EPS || n.start >= b0 - EPS)
              .map((n) => (n.start >= b0 - EPS ? { ...n, start: n.start - seconds / spb() } : { ...n, length: n.start + n.length > a0 ? Math.max(0.01, a0 - n.start) : n.length }));
            c.length -= seconds; if (c.beats != null) c.beats = c.length / spb();
          } else {
            const right = clone(c);
            trimLeft(right, b - c.start); right.start = at;
            trimRight(c, at - c.start);
            t.clips.splice(t.clips.indexOf(c) + 1, 0, right);
          }
        }
      }
      for (const lane of autoLanes())
        lane.points = (lane.points || []).filter((p) => p.t < at - EPS || p.t >= b - EPS).map((p) => (p.t >= b - EPS ? { ...p, t: p.t - seconds } : p));
      // A section that started inside the gap now starts where the gap was; of two at the
      // same place the later one wins (it's the part that was playing at the end of the gap).
      const secs = (S.sections || []).map((x) => ({ ...x, start: x.start >= b - EPS ? x.start - seconds : x.start > at ? at : x.start }));
      S.sections = secs.filter((x, i) => !secs.slice(i + 1).some((y) => Math.abs(y.start - x.start) < 1e-4));
      const shift = (v) => (v >= b ? v - seconds : v > at ? at : v);
      S.loopStart = shift(S.loopStart); S.loopEnd = shift(S.loopEnd);
      changed(); return { ok: true };
    };
  }

  // After the playground has plugged in: a reversed clip's picture is drawn backwards too.
  function afterPlayground({ S, handlers }) {
    const orig = handlers.getPeaks;
    if (!orig) return;
    handlers.getPeaks = async (args) => {
      const r = await orig(args);
      const c = S.tracks.flatMap((t) => t.clips).find((x) => x.id === args.clipId);
      if (!r || !c || !c.reversed) return r;
      const out = { ...r };
      for (const k of ["peak", "rms", "min", "max"]) if (Array.isArray(r[k])) out[k] = [...r[k]].reverse();
      return out;
    };
  }

  // ---- the UI -----------------------------------------------------------------------------
  let follow = true;
  try { follow = localStorage.getItem("killtoy.follow") !== "0"; } catch (e) { /* no storage: follow stays on */ }
  const setFollow = (on) => {
    follow = on;
    try { localStorage.setItem("killtoy.follow", on ? "1" : "0"); } catch (e) { /* fine */ }
    toast(on ? "Follow on: the timeline scrolls along with the playhead." : "Follow off: the timeline stays where you put it.");
  };
  const tools = () => !!(ui.state && ui.state.canArrangeTools);

  // Tap tempo: the last taps' average, rounded to half a BPM. Shown live from the 2nd tap,
  // set from the 4th (once you stop, so one tapping run is one undo step).
  const tap = { times: [], timer: 0 };
  function tapTempo() {
    const now = performance.now(), T = tap.times;
    if (T.length && now - T[T.length - 1] > 2000) T.length = 0;
    T.push(now);
    if (T.length > 8) T.shift();
    const box = $("bpm").closest(".ro");
    box.classList.add("tapping");
    clearTimeout(tap.timer);
    if (T.length < 2) { tap.timer = setTimeout(() => box.classList.remove("tapping"), 2000); return; }
    const avg = (T[T.length - 1] - T[0]) / (T.length - 1);
    const bpm = Math.min(250, Math.max(40, Math.round((60000 / avg) * 2) / 2));
    $("bpm").value = bpm;
    const n = T.length;
    tap.timer = setTimeout(() => {
      box.classList.remove("tapping");
      if (n >= 4) run("setBpm", { bpm }).then((r) => r && !r.error && toast(`Tempo set to ${bpm} BPM`));
      else if (ui.state) $("bpm").value = Number(ui.state.bpm.toFixed(2));   // too few taps: back to the real tempo
    }, Math.max(700, avg * 1.5));
  }

  // Cmd+L: loop the selected clips, like Ableton.
  function loopSelection() {
    const clips = selectedIds().map(findClip).filter(Boolean);
    if (!clips.length) return toast("Select a clip first, then Cmd+L loops it. (Click a section to loop that part.)");
    const start = Math.min(...clips.map((c) => c.start)), end = Math.max(...clips.map((c) => c.start + c.length));
    run("setLoopRange", { start, end })
      .then(() => (ui.transport && ui.transport.looping ? null : run("setLooping", { on: true })))
      .then(() => toast(`Looping bars ${barAt(start)}–${barAt(end - 0.01)}`));
  }

  // 0: turn the selected clips off (or back on, when they're all off already).
  function toggleActive(ids) {
    ids = (ids || selectedIds()).filter((x) => findClip(x));
    if (!ids.length) return;
    if (!tools()) return toast("Turning clips off works in the playground for now.");
    const anyOn = ids.some((x) => findClip(x).active !== false);
    run("setClipActive", { clipIds: ids, active: !anyOn });
  }

  // Cmd+J: join the selected MIDI clips.
  function consolidate() {
    if (!tools()) return;
    const ids = selectedIds();
    run("consolidateClips", { clipIds: ids }).then((r) => {
      if (!r || !r.clipId) return;
      ui.selectedClip = r.clipId; ui.extraClips = new Set();
      ui.laneSig = ""; render();
      toast(`Joined ${ids.length} clips into one.`);
    });
  }

  // Extra entries for the clip right-click menu (app.js clipMenu).
  function clipItems(c, t, ids) {
    if (!tools()) return [];
    const off = ids.every((x) => (findClip(x) || {}).active === false);
    const midi = ids.map(findClip).filter(Boolean);
    const canJoin = midi.length > 1 && midi.every((x) => x.kind === "midi" && x.track.id === midi[0].track.id);
    return [
      { sep: true },
      { label: off ? "Activate" : "Deactivate", meta: "0", run: () => toggleActive(ids) },
      ...(ids.length === 1 && c.kind !== "midi" && t.kind !== "beat" ? [{ label: c.reversed ? "Reverse back" : "Reverse", on: !!c.reversed, run: () => run("reverseClip", { clipId: c.id }) }] : []),
      ...(canJoin ? [{ label: "Join into one clip", meta: "Cmd+J", run: consolidate }] : []),
    ];
  }

  // Right-click the ruler: insert or delete a bar where you clicked, and Follow.
  function rulerMenu(e) {
    e.preventDefault(); e.stopPropagation();
    const r = $("ruler").getBoundingClientRect();
    const bar = secPerBar(), at = Math.max(0, Math.floor(toSec(e.clientX - r.left) / bar + 1e-6)) * bar, n = barAt(at);
    showMenu(atMouse(e), [
      { heading: `BAR ${n}` },
      ...(tools() ? [
        { label: "Insert 1 bar here", meta: `before bar ${n}`, run: () => run("insertTime", { at, seconds: bar }).then((x) => x && !x.error && toast(`Added an empty bar at bar ${n}. Cmd+Z takes it out.`)) },
        { label: "Delete this bar", danger: true, run: () => run("deleteTime", { at, seconds: bar }).then((x) => x && !x.error && toast(`Deleted bar ${n}; everything after it moved up. Cmd+Z brings it back.`)) },
        { sep: true },
      ] : []),
      { label: "Follow the playhead", meta: "Cmd+Shift+F", on: follow, run: () => setFollow(!follow) },
    ]);
  }

  let lastDown = null;
  // remember WHERE the last click was when it happened: the clip it hit is rebuilt after a mute, and a detached
  // node no longer knows it was in the timeline, which made a second M do nothing (Eman, 6 Nov 16:32)
  let downInTimeline = true;
  addEventListener("pointerdown", (e) => { lastDown = e.target && e.target.closest ? e.target : null; downInTimeline = !lastDown || !!lastDown.closest("#rows, #ruler, .tracks, #lanes, .timeline"); }, true);
  function onKey(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
    if (ui.home || ui.tune || ui.roll || iw || e.repeat) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && e.shiftKey && k === "f") { e.preventDefault(); setFollow(!follow); return; }
    if (mod && !e.shiftKey && k === "l") { e.preventDefault(); loopSelection(); return; }
    if (mod && !e.shiftKey && k === "j") { e.preventDefault(); consolidate(); return; }
    if (mod || e.altKey) return;
    // M / 0 / T act only when the last click was on the song itself, not in a panel below it
    // (Eman, 6 Nov: a pattern went grey and silent while working in its MIDI / synth panel)
    if (!window.KT2_KEYS_ANYWHERE && !downInTimeline) return;
    if (k === "t") tapTempo();
    else if (e.key === "0" || k === "m") { const ids = selectedIds(); const was = ids.length && ids.every((x) => findClip(x) && findClip(x).active === false); toggleActive(); if (ids.length && window.toast) toast(was ? "Clip on again" : "Clip muted (M). Press M again to hear it"); }   // M too (Eman, 4 Nov): mute / unmute the picked clips
  }

  function init() {
    if (typeof ui === "undefined" || !document.getElementById("bpm")) return;
    const label = $("bpm").closest(".ro"), word = label.querySelector(".ro-l");
    label.title = "Tempo. Tap it in: click the word Tempo (or press T) 4 times or more, in time";
    word.classList.add("tap");
    word.addEventListener("mousedown", (e) => e.preventDefault());   // a tap doesn't start typing in the box
    word.addEventListener("click", (e) => { e.preventDefault(); tapTempo(); });
    $("ruler").addEventListener("contextmenu", rulerMenu);
    window.addEventListener("keydown", onKey);
  }
  document.addEventListener("DOMContentLoaded", init);

  return { demo, afterPlayground, clipItems, following: () => follow };
})();
