// ---------------------------------------------------------------------------
// MIDI tools for the piano roll (Ableton-style): selecting notes, Quantize, transpose and
// nudge with the arrows, Duplicate, the song's scale (lit rows + Fold), and a Tools menu
// (stretch, legato, humanize, swing, chord, strum, velocity ramps, reverse, invert).
// The note maths are plain functions on note arrays ({ pitch, start, length, velocity } in
// beats from the clip start); the rest hooks them into ui.roll in app.js. Every tool is one
// setMidiNotes call (commitRoll), so one Cmd+Z undoes it.
(() => {
  const clampP = (p) => Math.max(0, Math.min(127, Math.round(p)));
  const clampV = (v) => Math.max(1, Math.min(127, Math.round(v)));
  const MIN_LEN = 1 / 64;
  const endOf = (n) => n.start + n.length;
  const lo = (ns) => Math.min(...ns.map((n) => n.start));
  const hi = (ns) => Math.max(...ns.map(endOf));
  const fit = (n, beats) => { // keep a note inside the clip
    n.start = Math.max(0, Math.min(beats - MIN_LEN, n.start));
    n.length = Math.max(MIN_LEN, Math.min(beats - n.start, n.length));
  };

  // ---- the song's key -----------------------------------------------------
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLATS = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
  // ui.state.key is { tonic, minor, name } (or a name like "F#m"); null when unknown.
  function parseKey(k) {
    if (!k) return null;
    if (typeof k === "object" && k.tonic != null) return { tonic: k.tonic, minor: !!k.minor };
    const m = /^\s*([A-G][#b]?)\s*(m(?:in(?:or)?)?)?\b/.exec(typeof k === "string" ? k : k.name || "");
    if (!m) return null;
    const t = NAMES.indexOf(FLATS[m[1]] || m[1]);
    return t < 0 ? null : { tonic: t, minor: !!m[2] };
  }
  const scaleSteps = (key) => key.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const inScale = (key, p) => scaleSteps(key).includes((((p - key.tonic) % 12) + 12) % 12);
  const keyName = (key) => NAMES[key.tonic] + (key.minor ? " minor" : " major");

  // ---- the tools (pure: they change the notes given, and return any new ones) --
  const T = {
    quantize(ns, grid, amount = 1) {
      for (const n of ns) n.start += (Math.round(n.start / grid) * grid - n.start) * amount;
    },
    transpose(ns, semis) {
      if (ns.some((n) => n.pitch + semis < 0 || n.pitch + semis > 127)) return false;
      for (const n of ns) n.pitch += semis;
      return true;
    },
    nudge(ns, beats, clipBeats) {
      if (ns.some((n) => n.start + beats < -1e-9 || endOf(n) + beats > clipBeats + 1e-9)) return false;
      for (const n of ns) n.start = Math.max(0, n.start + beats);
      return true;
    },
    // Copies right after the notes (their span, rounded up to the grid); copies past the clip end are dropped.
    duplicate(ns, grid, clipBeats) {
      const span = Math.ceil((hi(ns) - lo(ns)) / grid - 1e-9) * grid;
      return ns.map((n) => ({ ...n, start: n.start + span })).filter((n) => n.start < clipBeats - 1e-9)
        .map((n) => ({ ...n, length: Math.min(n.length, clipBeats - n.start) }));
    },
    stretch(ns, factor, clipBeats) {
      const s0 = lo(ns);
      for (const n of ns) { n.start = s0 + (n.start - s0) * factor; n.length *= factor; fit(n, clipBeats); }
    },
    // Each note lasts until the next one starts (notes of one chord all reach the next chord).
    legato(ns) {
      const starts = [...new Set(ns.map((n) => +n.start.toFixed(6)))].sort((a, b) => a - b);
      for (const n of ns) {
        const next = starts.find((s) => s > n.start + 1e-6);
        if (next != null) n.length = next - n.start;
      }
    },
    humanize(ns, bpm, clipBeats, rnd = Math.random) {
      const ms = (60 / bpm) / 1000; // 1 ms in beats
      for (const n of ns) {
        n.start += (rnd() * 2 - 1) * 10 * ms;
        n.velocity = clampV((n.velocity || 100) + Math.round((rnd() * 2 - 1) * 8));
        fit(n, clipBeats);
      }
    },
    // Every off-beat 16th (the 2nd and 4th of each beat) moves later by amount x a 16th.
    swing(ns, amount, clipBeats) {
      for (const n of ns) {
        const k = Math.round(n.start / 0.25);
        if (k % 2 === 1 && Math.abs(n.start - k * 0.25) < 0.02) { n.start = k * 0.25 + amount * 0.25; fit(n, clipBeats); }
      }
    },
    // Each note becomes a triad built on it in the song's key (major triad when there's no key).
    chord(ns, key, all) {
      const out = [];
      const has = (p, s) => all.some((m) => m.pitch === p && Math.abs(m.start - s) < 1e-6) || out.some((m) => m.pitch === p && Math.abs(m.start - s) < 1e-6);
      for (const n of ns) {
        let add = [4, 7];
        if (key) {
          const up = (p, steps) => { let q = p; for (let i = 0; i < steps;) { q++; if (inScale(key, q)) i++; } return q; };
          let root = n.pitch;
          while (!inScale(key, root) && root > n.pitch - 2) root--; // an out-of-key note uses the key note under it
          add = [up(root, 2) - n.pitch, up(root, 4) - n.pitch];
        }
        for (const d of add) {
          const p = n.pitch + d;
          if (p <= 127 && !has(p, n.start)) out.push({ ...n, pitch: p, slide: undefined });
        }
      }
      return out.map(({ slide, ...n }) => n);
    },
    // Notes that start together are spread low to high, ms apart; their ends stay put.
    strum(ns, ms, bpm) {
      const step = (ms / 1000) * (bpm / 60);
      const groups = new Map();
      for (const n of ns) { const k = n.start.toFixed(4); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
      for (const g of groups.values()) {
        g.sort((a, b) => a.pitch - b.pitch).forEach((n, i) => {
          const d = Math.min(i * step, n.length - MIN_LEN);
          n.start += d; n.length -= d;
        });
      }
    },
    velocityRamp(ns, up) {
      const s0 = lo(ns), s1 = Math.max(...ns.map((n) => n.start));
      for (const n of ns) {
        const t = s1 > s0 ? (n.start - s0) / (s1 - s0) : 1;
        n.velocity = clampV(40 + 87 * (up ? t : 1 - t));
      }
    },
    // Back to front in time, inside the notes' own span.
    reverse(ns) {
      const s0 = lo(ns), e1 = hi(ns);
      for (const n of ns) n.start = s0 + e1 - endOf(n);
    },
    // Upside down: the highest note becomes the lowest.
    invert(ns) {
      const a = Math.min(...ns.map((n) => n.pitch)), b = Math.max(...ns.map((n) => n.pitch));
      for (const n of ns) n.pitch = clampP(a + b - n.pitch);
    },
  };

  // ---- hooking into the roll ----------------------------------------------
  const songKey = () => parseKey(ui.state && ui.state.key);
  const sel = (r) => (r.sel ||= new Set());
  const selected = (r) => r.notes.filter((n) => sel(r).has(n));
  const targets = (r) => { const s = selected(r); return s.length ? s : r.notes; }; // the selection, else every note
  const clipBeats = () => rollGeometry().beats;
  const tempo = () => bpm();
  const select = (r, ns) => { r.sel = new Set(ns); drawRoll(); };
  const done = () => { drawRoll(); commitRoll(); };

  // Fold: only the rows in the song's key (plus rows that hold notes), high to low.
  function foldRows(r, key) {
    const used = new Set(r.notes.map((n) => n.pitch));
    const out = [];
    for (let p = 127; p >= 0; p--) if (inScale(key, p) || used.has(p)) out.push(p);
    return out;
  }
  const folded = (r) => { const key = ui.rollFold && songKey(); return key ? foldRows(r, key) : null; };
  function pitchAt(r, i) {
    const list = folded(r);
    if (!list) return r.top - i;
    const first = list.findIndex((p) => p <= r.top);
    const p = first < 0 ? undefined : list[first + i];
    return p == null ? -1 : p;
  }
  function rowOf(r, p) {
    const list = folded(r);
    if (!list) return r.top - p;
    const at = list.indexOf(p), first = list.findIndex((q) => q <= r.top);
    return at < 0 || first < 0 ? -1 : at - first;
  }

  function paintRow(g, pitch, y, W, keysW, rowH) {
    const key = songKey();
    if (!key || !inScale(key, pitch)) return;
    const root = (((pitch - key.tonic) % 12) + 12) % 12 === 0;
    if (root || !ui.rollFold) { // folded, every row is in key: light only the key note's rows
      g.fillStyle = root ? "rgba(228,255,58,0.09)" : "rgba(228,255,58,0.035)";
      g.fillRect(keysW, y, W - keysW, rowH);
    }
    g.fillStyle = root ? "rgba(228,255,58,0.8)" : "rgba(228,255,58,0.35)";
    g.fillRect(keysW - 5, y + 1, 2, rowH - 3); // a small mark by the key
  }

  let box = null; // { x0, y0, x1, y1 } in canvas pixels while Shift-dragging
  function paintBox(g) {
    if (!box) return;
    const x = Math.min(box.x0, box.x1), y = Math.min(box.y0, box.y1), w = Math.abs(box.x1 - box.x0), h = Math.abs(box.y1 - box.y0);
    g.fillStyle = "rgba(228,255,58,0.08)"; g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(228,255,58,0.7)"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  // Shift- or Cmd-click a note: add it to (or take it out of) the selection. Cmd-drag on empty
  // space draws a box that selects what it touches (Shift-drag adds to what's already selected).
  function mouseDown(e, h) {
    const r = ui.roll;
    if (!(e.shiftKey || e.metaKey || e.ctrlKey) || h.x < ROLL_KEYS) return false;
    if (h.note) {
      const s = sel(r);
      if (s.has(h.note)) s.delete(h.note); else s.add(h.note);
      drawRoll();
      return true;
    }
    const { cv, pxPerBeat } = rollGeometry();
    const rect = cv.getBoundingClientRect();
    const keep = new Set(e.shiftKey ? sel(r) : []);
    box = { x0: h.x, y0: e.clientY - rect.top, x1: h.x, y1: e.clientY - rect.top };
    const onMove = (ev) => {
      box.x1 = ev.clientX - rect.left; box.y1 = ev.clientY - rect.top;
      const b0 = (Math.min(box.x0, box.x1) - ROLL_KEYS) / pxPerBeat, b1 = (Math.max(box.x0, box.x1) - ROLL_KEYS) / pxPerBeat;
      const r0 = Math.floor(Math.min(box.y0, box.y1) / ROLL_ROW), r1 = Math.floor(Math.max(box.y0, box.y1) / ROLL_ROW);
      r.sel = new Set(keep);
      for (const n of r.notes) {
        const row = rowOf(r, n.pitch);
        if (row >= r0 && row <= r1 && n.start < b1 && endOf(n) > b0) r.sel.add(n);
      }
      drawRoll();
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); box = null; drawRoll(); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return true;
  }

  // A plain press on a note: picks it (unless it's already in the selection). Returns the other
  // selected notes with where they started, so a move drags them along.
  function grab(r, note, mode) {
    const s = sel(r);
    if (!s.has(note)) { s.clear(); s.add(note); }
    if (mode !== "move") return [];
    return r.notes.filter((n) => n !== note && s.has(n)).map((n) => ({ n, start: n.start, pitch: n.pitch }));
  }

  // After a state refresh the roll gets fresh copies of the notes: select the same ones again.
  function keepSel(r, fresh) {
    if (!r.sel || !r.sel.size) return;
    const id = (n) => `${n.pitch}|${n.start.toFixed(5)}|${n.length.toFixed(5)}`;
    const want = new Set(selected(r).map(id));
    r.sel = new Set(fresh.filter((n) => want.has(id(n))));
  }

  // ---- actions (each one setMidiNotes = one undo step) -----------------------
  const act = {
    quantize() {
      const r = ui.roll, amt = Number($("roll-qamt").value) || 1;
      T.quantize(targets(r), r.grid, amt);
      for (const n of targets(r)) fit(n, clipBeats());
      done();
      toast(`Quantized ${selected(r).length || "all"} note${selected(r).length === 1 ? "" : "s"} to the grid${amt < 1 ? " (50%)" : ""}`);
    },
    transpose(semis) { const r = ui.roll, ns = selected(r); if (ns.length && T.transpose(ns, semis)) { rollPreview(ns[0].pitch, ns[0].velocity); setTimeout(rollPreviewOff, 160); done(); } },
    nudge(dir) { const r = ui.roll, ns = selected(r); if (ns.length && T.nudge(ns, dir * r.grid, clipBeats())) done(); },
    duplicate() {
      const r = ui.roll, ns = selected(r);
      if (!ns.length) return toast("Select notes first (Cmd-drag a box), then Cmd+D");
      const copies = T.duplicate(ns, r.grid, clipBeats());
      if (!copies.length) return toast("No room after these notes. Make the clip longer (Length).");
      r.notes.push(...copies); r.sel = new Set(copies); done();
    },
    remove() { const r = ui.roll, s = sel(r); if (!s.size) return; r.notes = r.notes.filter((n) => !s.has(n)); s.clear(); done(); },
    all() { select(ui.roll, ui.roll.notes); },
    tool(fn) { const r = ui.roll; if (!r || !r.notes.length) return toast("No notes yet"); fn(r, targets(r)); for (const n of r.notes) fit(n, clipBeats()); done(); },
  };

  function onKey(e) {
    const r = ui.roll;
    if (!r || $("iw").hidden || $("roll").hidden || $("roll-canvas").hidden) return false;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return false;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    const take = (f) => { e.preventDefault(); f(); return true; };
    if (mod && k === "a") return take(act.all);
    if (mod && k === "u") return take(act.quantize);
    if (mod && k === "d") return take(window.KT2_CMD_D_DUP ? act.duplicate : () => { sel(r).clear(); drawRoll(); });   // Cmd+D lets go (Eman, 4 Nov)
    if (mod || e.altKey) return false;
    if (e.key === "ArrowUp") return take(() => act.transpose(e.shiftKey ? 12 : 1));
    if (e.key === "ArrowDown") return take(() => act.transpose(e.shiftKey ? -12 : -1));
    if (e.key === "ArrowRight") return take(() => act.nudge(1));
    if (e.key === "ArrowLeft") return take(() => act.nudge(-1));
    if ((e.key === "Delete" || e.key === "Backspace") && sel(r).size) return take(act.remove);
    if (e.key === "Escape" && sel(r).size) return take(() => select(r, []));
    return false;
  }

  function showTools(anchor) {
    const key = songKey(), bpm = tempo();
    const amounts = (label, list, fn) => showMenu(anchor, [{ heading: label }, ...list.map(([l, v]) => ({ label: l, run: () => act.tool((r, ns) => fn(ns, v)) }))]);
    const scope = ui.roll && selected(ui.roll).length ? `${selected(ui.roll).length} selected` : "all notes";
    showMenu(anchor, [
      { heading: `Tools (${scope})` },
      { label: "x2", meta: "twice as slow", run: () => act.tool((r, ns) => T.stretch(ns, 2, clipBeats())) },
      { label: "÷2", meta: "twice as fast", run: () => act.tool((r, ns) => T.stretch(ns, 0.5, clipBeats())) },
      { label: "Legato", meta: "each note lasts to the next", run: () => act.tool((r, ns) => T.legato(ns)) },
      { label: "Humanize", meta: "±10 ms, ±8 velocity", run: () => act.tool((r, ns) => T.humanize(ns, bpm, clipBeats())) },
      { label: "Swing…", meta: "push the off-beat 16ths", run: () => amounts("Swing", [["25%", 0.25], ["33% (triplet feel)", 1 / 3], ["50%", 0.5], ["75%", 0.75]], (ns, v) => T.swing(ns, v, clipBeats())) },
      { sep: true },
      { label: "Chord", meta: key ? `triads in ${keyName(key)}` : "major triads (no song key)",
        run: () => act.tool((r, ns) => { const add = T.chord(ns, key, r.notes); r.notes.push(...add); if (sel(r).size) add.forEach((n) => r.sel.add(n)); }) },
      { label: "Strum…", meta: "spread chord notes", run: () => amounts("Strum", [["10 ms", 10], ["20 ms", 20], ["40 ms", 40]], (ns, v) => T.strum(ns, v, bpm)) },
      { label: "Velocity ramp up", meta: "soft to loud", run: () => act.tool((r, ns) => T.velocityRamp(ns, true)) },
      { label: "Velocity ramp down", meta: "loud to soft", run: () => act.tool((r, ns) => T.velocityRamp(ns, false)) },
      { label: "Reverse", meta: "back to front", run: () => act.tool((r, ns) => T.reverse(ns)) },
      { label: "Invert", meta: "upside down", run: () => act.tool((r, ns) => T.invert(ns)) },
    ]);
  }

  function refreshFold() {
    const key = songKey();
    $("roll-fold").classList.toggle("on", !!ui.rollFold);
    $("roll-fold").title = key ? `Fold: show only the notes in ${keyName(key)} (the song's key)` : "Fold: needs the song's key (set it in the session)";
  }
  $("roll-quant").onclick = () => ui.roll && act.quantize();
  $("roll-tools").onclick = (e) => { e.stopPropagation(); if (ui.roll) showTools($("roll-tools")); };
  $("roll-fold").onclick = () => {
    if (!songKey()) return toast("Fold needs the song's key. Set the key first.");
    ui.rollFold = !ui.rollFold;
    refreshFold(); drawRoll();
  };
  refreshFold();

  window.MidiTools = { ...T, parseKey, inScale, pitchAt, rowOf, paintRow, paintBox, mouseDown, grab, keepSel, onKey };
})();
