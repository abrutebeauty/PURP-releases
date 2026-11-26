// KILLTOY 2: MIDI controllers + SAVE MIDI (Eman, 11 Nov 2026).
//  1. PREFERENCES > MIDI: pick the keyboard / pad controller (Web MIDI). What you play sounds on the
//     picked pattern's instrument (the open MIDI window first, then the selected pattern), through the
//     same previewNote command the computer keys use. Velocity AS PLAYED or FULL. RECORD ON = notes you
//     play while the song plays are written into that pattern (one Cmd+Z when the song stops).
//  2. SAVE MIDI in the MIDI editor's corner (12 Nov; was the top bar): MY MIDI list (save, use, download,
//     delete) + SAVE AS FILE. Downloads go to the folder picked in PREFERENCES > MIDI, or Downloads.
// window.KT2_MIDI_OFF = old (no MIDI tab, no button). window.KT2_SAVEMIDI_TOP_OLD = button back in the top bar. Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  if (!document.documentElement.classList.contains("kt2") || window.KT2_MIDI_OFF) return;

  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = (p) => NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const UI = () => (typeof ui !== "undefined" ? ui : null);   // app.js keeps ui as a top-level const, not on window
  const send = (cmd, args) => (typeof booth === "function" ? booth : run)(cmd, args);
  const say = (m) => (window.toast ? toast(m) : console.log(m));

  // ---------------------------------------------------------------------------
  // settings (this computer only)
  const SET = Object.assign({ off: [], velocity: "played", record: false }, store.get("kt2.midi", {}));
  const save = () => store.set("kt2.midi", SET);

  // ---------------------------------------------------------------------------
  // Web MIDI
  const M = { access: null, state: "idle", error: "", lastAt: 0, last: null, held: new Map(), pedal: false, pedalHeld: new Set(), lit: new Set(), heard: new Map() };
  const supported = () => typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
  const inputs = () => (M.access ? [...M.access.inputs.values()] : []);
  const isOn = (inp) => !SET.off.includes(inp.name);

  async function connect() {
    if (!supported()) { M.state = "nosupport"; repaint(); return; }
    if (M.access) return;
    M.state = "asking"; repaint();
    try {
      M.access = await navigator.requestMIDIAccess({ sysex: false });
      M.state = "ready";
      M.access.onstatechange = (e) => { hook(); repaint(); if (e.port && e.port.type === "input" && e.port.state === "connected" && !M.heard.has(e.port.id)) say(`${e.port.name} connected.`); };
      hook();
    } catch (err) {
      M.state = "blocked"; M.error = (err && err.message) || String(err);
    }
    repaint();
  }
  function hook() {
    for (const inp of inputs()) {
      if (M.heard.has(inp.id)) continue;
      M.heard.set(inp.id, true);
      inp.onmidimessage = (e) => { if (isOn(inp)) onMessage(e.data, inp); };
    }
  }

  // ---------------------------------------------------------------------------
  // which pattern the keys play: the open MIDI window, else the picked pattern, else the last one played
  let lastClip = null;
  const allClips2 = () => (UI() && ui.state ? ui.state.tracks.flatMap((t) => t.clips.map((c) => ({ c, t }))) : []);
  const findMidi = (id) => { const x = id && allClips2().find((y) => y.c.id === id); return x && x.c.kind === "midi" ? x : null; };
  function target() {
    const iw = document.getElementById("iw");
    const roll = UI() && ui.roll && ui.roll.clipId && iw && !iw.hidden ? findMidi(ui.roll.clipId) : null;
    const t = roll || (UI() && findMidi(ui.selectedClip)) || findMidi(lastClip);
    if (t) lastClip = t.c.id;
    return t;
  }
  const soundName = (x) => {
    if (!x) return "";
    const p = (x.c.plugins || []).find((q) => q.instrument || q.kit || /toy|killdrum|blob/i.test(q.name || "")) || {};
    return (x.t.name || p.name || "pattern") + (x.c.name && x.c.name !== x.t.name ? " / " + x.c.name : "");
  };

  // ---------------------------------------------------------------------------
  // playing
  let warned = 0;
  function noteOn(pitch, vel) {
    const x = target();
    M.lit.add(pitch); M.last = { pitch, at: performance.now() }; M.lastAt = performance.now();
    activity();
    if (!x) { if (performance.now() - warned > 4000) { warned = performance.now(); say("Pick a pattern first. Your keys play its sound."); } return; }
    const v = SET.velocity === "full" ? 100 : Math.max(1, Math.round(vel * 100 / 127));
    if (M.held.has(pitch)) noteOffNow(pitch);
    M.pedalHeld.delete(pitch);
    send("previewNote", { clipId: x.c.id, pitch, velocity: v, key: "midi" + pitch });
    M.held.set(pitch, { clipId: x.c.id, vel: v, at: songNow() });
  }
  function noteOff(pitch) {
    M.lit.delete(pitch); activity();
    if (M.pedal && M.held.has(pitch)) { M.pedalHeld.add(pitch); return; }
    noteOffNow(pitch);
  }
  function noteOffNow(pitch) {
    const h = M.held.get(pitch);
    M.held.delete(pitch);
    send("previewNoteOff", { key: "midi" + pitch });
    if (h) keep(pitch, h);
  }
  function pedal(down) {
    M.pedal = down;
    if (!down) { for (const p of [...M.pedalHeld]) { M.pedalHeld.delete(p); noteOffNow(p); } }
  }
  function allOff() { for (const p of [...M.held.keys()]) noteOffNow(p); M.lit.clear(); M.pedal = false; M.pedalHeld.clear(); activity(); }
  function onMessage(d, inp) {
    const st = d[0] & 0xf0;
    if (st === 0x90 && d[2] > 0) noteOn(d[1], d[2]);
    else if (st === 0x80 || (st === 0x90 && d[2] === 0)) noteOff(d[1]);
    else if (st === 0xb0 && d[1] === 64) pedal(d[2] >= 64);
    else if (st === 0xb0 && (d[1] === 120 || d[1] === 123)) allOff();
    M.lastIn = inp.name;
  }
  window.addEventListener("blur", allOff);

  // ---------------------------------------------------------------------------
  // recording: while the song plays and RECORD is on, played notes go into the pattern (in time),
  // written in one go when the song stops
  const songNow = () => {
    const dbg = window.purpPlaygroundDebug;
    try { if (dbg && typeof dbg.songPos === "function") return dbg.songPos(); } catch (e) { /* fine */ }
    const tr = UI() && (ui.transport || (ui.state && ui.state.transport));
    return tr ? tr.position || 0 : 0;
  };
  const playing = () => { const tr = UI() && (ui.transport || (ui.state && ui.state.transport)); return !!(tr && tr.playing); };   // ui.transport = the live one
  const REC = new Map();   // clipId -> [{pitch, start, length, velocity}]
  function keep(pitch, h) {
    if (!SET.record || !playing() || h.at == null) return;
    const x = findMidi(h.clipId); if (!x) return;
    const spb = 60 / (ui.state.bpm || 120), end = songNow();
    let s = (h.at - x.c.start) / spb, e = (end - x.c.start) / spb;
    const len = (x.c.length || 0) / spb;
    if (!(len > 0)) return;
    if (e < s) e = len;   // the loop jumped back while the key was down
    if (s < 0 || s >= len) return;   // played outside the pattern: not kept
    const n = { pitch, start: Math.round(s * 1000) / 1000, length: Math.max(0.0625, Math.round(Math.min(e, len) * 1000) / 1000 - Math.round(s * 1000) / 1000), velocity: h.vel };
    if (!REC.has(h.clipId)) REC.set(h.clipId, []);
    REC.get(h.clipId).push(n);
    repaint();
  }
  let wasPlaying = false;
  setInterval(() => {
    const now = playing();
    if (wasPlaying && !now) { for (const p of [...M.held.keys()]) noteOffNow(p); commit(); }
    wasPlaying = now;
  }, 150);
  async function commit() {
    for (const [clipId, add] of [...REC.entries()]) {
      REC.delete(clipId);
      const x = findMidi(clipId); if (!x || !add.length) continue;
      const keepFields = ({ pitch, start, length, velocity, slide, group, mute }) => ({ pitch, start, length, velocity, ...(slide != null ? { slide } : {}), ...(group != null ? { group } : {}), ...(mute ? { mute } : {}) });
      const notes = [...(x.c.notes || []).map(keepFields), ...add];
      await run("setMidiNotes", { clipId, notes });
      say(`Recorded ${add.length} note${add.length === 1 ? "" : "s"} into ${soundName(x)}.`);
    }
    repaint();
  }

  // ---------------------------------------------------------------------------
  // .mid writer: format 1, 480 ticks a beat, tempo + one track per sound (drums on channel 10)
  function midiFile(tracks, bpm) {
    const PPQ = 480, bytes = [];
    const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const vlq = (n) => { n = Math.max(0, Math.round(n)); const out = [n & 127]; while ((n >>= 7)) out.unshift((n & 127) | 128); return out; };
    const text = (s) => [...String(s).replace(/[^\x20-\x7e]/g, "?")].map((ch) => ch.charCodeAt(0));
    const chunk = (id, data) => [...text(id), ...u32(data.length), ...data];
    const mspq = Math.round(60000000 / (bpm || 120));
    const head = [0, 0xff, 0x51, 3, (mspq >> 16) & 255, (mspq >> 8) & 255, mspq & 255, 0, 0xff, 0x58, 4, 4, 2, 24, 8, 0, 0xff, 0x2f, 0];
    bytes.push(...chunk("MThd", [0, 1, 0, tracks.length + 1, (PPQ >> 8) & 255, PPQ & 255]), ...chunk("MTrk", head));
    for (const tr of tracks) {
      const ch = tr.drums ? 9 : 0, ev = [];
      for (const n of tr.notes) {
        const a = Math.round(n.start * PPQ), b = Math.max(a + 1, Math.round((n.start + n.length) * PPQ));
        const v = Math.max(1, Math.min(127, Math.round((n.velocity || 100) * 127 / 100)));
        const p = Math.max(0, Math.min(127, Math.round(n.pitch)));
        ev.push({ t: a, o: 1, d: [0x90 | ch, p, v] }, { t: b, o: 0, d: [0x80 | ch, p, 0] });
      }
      ev.sort((x, y) => x.t - y.t || x.o - y.o);
      const name = text(tr.name).slice(0, 120);
      const data = [0, 0xff, 0x03, ...vlq(name.length), ...name];
      let t = 0;
      for (const e of ev) { data.push(...vlq(e.t - t), ...e.d); t = e.t; }
      data.push(0, 0xff, 0x2f, 0);
      bytes.push(...chunk("MTrk", data));
    }
    return new Uint8Array(bytes);
  }
  // the song (or the picked patterns) as tracks: notes in beats from the song start
  function collect(wholeSong) {
    const st = ui.state, spb = 60 / (st.bpm || 120);
    const picked = new Set(!wholeSong && typeof selectedIds === "function" ? selectedIds() : []);
    const usePick = [...picked].some((id) => findMidi(id));
    const byLane = new Map();
    for (const t of st.tracks) {
      for (const c of t.clips) {
        if (c.kind !== "midi" || !(c.notes || []).length) continue;
        if (usePick && !picked.has(c.id)) continue;
        const lane = t.layerOf || t.id;
        if (!byLane.has(lane)) byLane.set(lane, { name: t.name || "Sound", drums: typeof isKillDrumLane === "function" && isKillDrumLane(t), notes: [] });
        const at = c.start / spb, len = (c.length || 0) / spb;
        for (const n of c.notes) { if (n.mute || n.start >= len) continue; byLane.get(lane).notes.push({ pitch: n.pitch, start: at + n.start, length: Math.min(n.length, len - n.start), velocity: n.velocity }); }
      }
    }
    const tracks = [...byLane.values()].filter((x) => x.notes.length);
    if (usePick && tracks.length) { const first = Math.min(...tracks.flatMap((x) => x.notes.map((n) => n.start))); const bar = Math.floor(first / 4) * 4; tracks.forEach((x) => x.notes.forEach((n) => (n.start -= bar))); }
    return { tracks, picked: usePick };
  }

  // the folder to save into (Chrome's folder picker), kept between visits in IndexedDB
  const DB = { name: "kt2-midi", store: "h" };
  const idb = (mode, fn) => new Promise((res) => {
    try {
      const r = indexedDB.open(DB.name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DB.store);
      r.onsuccess = () => { try { const tx = r.result.transaction(DB.store, mode); const q = fn(tx.objectStore(DB.store)); tx.oncomplete = () => res(q && q.result); tx.onerror = () => res(null); } catch (e) { res(null); } };
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  let folder = null;
  idb("readonly", (s) => s.get("folder")).then((h) => { folder = h || null; repaint(); });
  const canPick = () => typeof window.showDirectoryPicker === "function";
  async function pickFolder() {
    if (!canPick()) { say("This browser can't pick a folder. MIDI goes to Downloads."); return; }
    try {
      const h = await window.showDirectoryPicker({ id: "killtoy-midi", mode: "readwrite" });
      folder = h; await idb("readwrite", (s) => s.put(h, "folder"));
      say(`MIDI now saves to ${h.name}.`);
    } catch (e) { if (e && e.name !== "AbortError") say("The folder can't be picked here, so MIDI goes to Downloads."); }
    repaint();
  }
  async function forgetFolder() { folder = null; await idb("readwrite", (s) => s.delete("folder")); repaint(); }

  async function saveMidi() {
    if (!UI() || !ui.state) return;
    const { tracks, picked } = collect();
    if (!tracks.length) { say("No notes to save yet."); return; }
    const song = String((ui.state.session && ui.state.session.name) || ui.state.name || ui.state.song || "KILLTOY").replace(/[\\/:*?"<>|]+/g, " ").trim() || "KILLTOY";
    const file = (picked ? `${song} - ${tracks.map((t) => t.name).join(", ")}` : song).slice(0, 90) + ".mid";
    const bytes = midiFile(tracks, ui.state.bpm);
    if (folder) {
      try {
        if (folder.queryPermission && (await folder.queryPermission({ mode: "readwrite" })) !== "granted") {
          if ((await folder.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("no permission");
        }
        const fh = await folder.getFileHandle(file, { create: true }), w = await fh.createWritable();
        await w.write(bytes); await w.close();
        say(`Saved ${file} in ${folder.name}.`); flash(); return;
      } catch (e) { /* fall back to a download */ }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
    a.download = file; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    say(`Saved ${file}${folder ? " to Downloads (the folder can't be reached here)" : ""}.`); flash();
  }

  // ---------------------------------------------------------------------------
  // SAVE MIDI lives in the MIDI editor's corner (Eman 12 Nov: "not in the main menu at the top").
  // It opens MY MIDI: name it, SAVE keeps it in the list (this computer), every saved MIDI can be
  // downloaded, put back into the open pattern, or deleted. SAVE AS FILE = the browser's "save as".
  // window.KT2_SAVEMIDI_TOP_OLD = old (the button in the top bar, saves at once, no list).
  const TOP_OLD = !!window.KT2_SAVEMIDI_TOP_OLD;
  const ICON = `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>`;
  let btn = null;
  function flash(b) { b = b || btn; if (!b) return; b.classList.remove("ok"); void b.offsetWidth; b.classList.add("ok"); }
  function placeButton() {
    if (btn && btn.isConnected) return;
    // in the tool row on the left (Eman 11 Nov: the right side has no room; there it pushed BPM under the meter)
    const ro = document.querySelector("header.top .kt-tools");
    if (!ro) return;
    btn = document.createElement("button");
    btn.className = "k2-savemidi";
    btn.id = "k2-savemidi";
    btn.title = "Save MIDI: the picked patterns, or the whole song. Right-click to pick the folder.";
    btn.innerHTML = ICON + `<span>MIDI</span>`;
    btn.onclick = (e) => { e.stopPropagation(); saveMidi(); };
    btn.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (typeof showMenu !== "function") return pickFolder();
      showMenu(btn, [
        { heading: "SAVE MIDI TO" },
        { label: folder ? folder.name : "Downloads", meta: "now", disabled: true },
        { label: "Pick a folder\u2026", run: pickFolder },
        ...(folder ? [{ label: "Back to Downloads", run: forgetFolder }] : []),
      ]);
    };
    const sep = document.createElement("span"); sep.className = "sep k2-savemidi-sep";
    ro.append(sep, btn);
  }
  if (TOP_OLD) {
    placeButton();
    new MutationObserver(placeButton).observe(document.querySelector("header.top") || document.body, { childList: true, subtree: true });
  }

  // --- the open pattern in the MIDI editor
  function openPattern() {
    const iw = document.getElementById("iw");
    if (!UI() || !ui.roll || !ui.roll.clipId || !iw || iw.hidden) return null;
    return findMidi(ui.roll.clipId);
  }
  const cleanName = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const songName = () => cleanName((ui.state.session && ui.state.session.name) || ui.state.name || ui.state.song || "KILLTOY") || "KILLTOY";
  function patternItem(x) {
    const spb = 60 / (ui.state.bpm || 120), beats = Math.max(1, Math.round(((x.c.length || 0) / spb) * 4) / 4);
    const notes = (x.c.notes || []).filter((n) => !n.mute && n.start < beats).map((n) => Object.assign({}, n, { length: Math.min(n.length, beats - n.start) }));
    const drums = typeof isKillDrumLane === "function" && isKillDrumLane(x.t);
    return { name: x.t.name || "Pattern", bpm: ui.state.bpm || 120, beats, drums, notes };
  }
  const itemFile = (it) => midiFile([{ name: it.lane || it.name, drums: it.drums, notes: it.notes }], it.bpm);

  // --- MY MIDI: the saved list (this computer, localStorage)
  const LIB_KEY = "kt2.midilib";
  const lib = () => { const v = store.get(LIB_KEY, []); return Array.isArray(v) ? v : []; };
  const setLib = (v) => store.set(LIB_KEY, v.slice(0, 400));
  function uniqueName(base) {
    const names = new Set(lib().map((x) => x.name.toLowerCase()));
    if (!names.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) if (!names.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
  }
  function libSave(name, it) {
    const all = lib(), clean = cleanName(name).slice(0, 80) || "MIDI";
    const same = all.findIndex((x) => x.name.toLowerCase() === clean.toLowerCase());
    const rec = { id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: clean, at: Date.now(), bpm: it.bpm, beats: it.beats, drums: !!it.drums, lane: it.name, notes: it.notes };
    if (same >= 0) all.splice(same, 1);   // same name = save over it
    all.unshift(rec); setLib(all);
    return rec;
  }

  // write bytes as a file: the picked folder (PREFERENCES > MIDI), else "save as", else Downloads
  async function writeFile(file, bytes, saveAs) {
    if (folder && !saveAs) {
      try {
        if (folder.queryPermission && (await folder.queryPermission({ mode: "readwrite" })) !== "granted") {
          if ((await folder.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("no permission");
        }
        const fh = await folder.getFileHandle(file, { create: true }), w = await fh.createWritable();
        await w.write(bytes); await w.close();
        return `Saved ${file} in ${folder.name}.`;
      } catch (e) { /* fall through */ }
    }
    if (saveAs && typeof window.showSaveFilePicker === "function") {
      try {
        const fh = await window.showSaveFilePicker({ suggestedName: file, id: "killtoy-midi", types: [{ description: "MIDI file", accept: { "audio/midi": [".mid"] } }] });
        const w = await fh.createWritable(); await w.write(bytes); await w.close();
        return `Saved ${fh.name || file}.`;
      } catch (e) { if (e && e.name === "AbortError") return ""; /* blocked here: a download instead */ }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
    a.download = file; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return `Downloaded ${file}.`;
  }

  // --- the panel
  let lp = null, lpFor = null;
  const when = (t) => {
    const d = (Date.now() - t) / 1000;
    if (d < 60) return "now"; if (d < 3600) return Math.floor(d / 60) + " min"; if (d < 86400) return Math.floor(d / 3600) + " h";
    const x = new Date(t); return x.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][x.getMonth()];
  };
  function closeLib() { if (lp) lp.remove(); lp = null; lpFor = null; }
  function openLib(anchor) {
    if (!UI() || !ui.state) return;
    if (lp && lpFor === anchor) { closeLib(); return; }
    closeLib();
    lpFor = anchor;
    lp = h("div", "k2ml");
    lp.addEventListener("mousedown", (e) => e.stopPropagation());
    lp.addEventListener("pointerdown", (e) => e.stopPropagation());
    lp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") closeLib(); });
    document.body.append(lp);
    drawLib();
    placeLib();
  }
  function placeLib() {
    if (!lp || !lpFor) return;
    const r = lpFor.getBoundingClientRect(), w = lp.offsetWidth, hh = lp.offsetHeight;
    lp.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
    lp.style.top = Math.max(8, Math.min(innerHeight - hh - 8, r.bottom + 6)) + "px";
  }
  function drawLib() {
    if (!lp) return;
    const x = openPattern();
    lp.replaceChildren();
    const head = h("div", "k2ml-h"); head.append(h("b", null, "SAVE MIDI"));
    const xb = h("button", "k2ml-x", "\u00d7"); xb.title = "Close"; xb.onclick = closeLib; head.append(xb);
    lp.append(head);
    // save row: name + SAVE (into the list) + SAVE AS FILE
    const it = x ? patternItem(x) : null;
    const row = h("div", "k2ml-save");
    const inp = h("input", "k2ml-name"); inp.type = "text"; inp.maxLength = 80; inp.spellcheck = false;
    inp.value = it ? uniqueName(cleanName(`${songName()} - ${it.name}`)) : "";
    inp.placeholder = "Name";
    const sb = h("button", "k2ml-go", "SAVE"); sb.title = "Keep it in MY MIDI";
    const fb = h("button", "k2ml-btn", "SAVE AS FILE"); fb.title = "Save it as a .mid file on your computer";
    if (!it || !it.notes.length) { sb.disabled = fb.disabled = true; inp.disabled = !it; }
    const doSave = () => {
      if (!it || !it.notes.length) return;
      const rec = libSave(inp.value, it);
      try { if (typeof logUsage === "function") logUsage("saveMidi", { notes: it.notes.length }); } catch (e) { /* fine */ }
      say(`Saved ${rec.name} in MY MIDI.`); flash(lpFor); drawLib(); flashRow(rec.id);
    };
    sb.onclick = doSave;
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") doSave(); if (e.key === "Escape") closeLib(); };
    fb.onclick = async () => {
      if (!it || !it.notes.length) return;
      const nm = cleanName(inp.value) || "KILLTOY";
      const m = await writeFile(nm.slice(0, 90) + ".mid", itemFile(it), true);
      if (m) { say(m); flash(lpFor); }
    };
    row.append(inp, sb, fb);
    lp.append(row);
    if (!x) lp.append(h("div", "k2ml-note", "Open a pattern to save it."));
    else if (!it.notes.length) lp.append(h("div", "k2ml-note", "This pattern has no notes yet."));
    // MY MIDI list
    const all = lib();
    lp.append(h("div", "k2ml-sub", `MY MIDI \u00b7 ${all.length}`));
    const list = h("div", "k2ml-list");
    if (!all.length) list.append(h("div", "k2ml-note", "Nothing saved yet."));
    for (const r of all) {
      const li = h("div", "k2ml-row"); li.dataset.id = r.id;
      const nm = h("div", "k2ml-nm"); nm.append(h("b", null, r.name), h("span", null, `${+(r.beats / 4).toFixed(2)} bar${r.beats === 4 ? "" : "s"} \u00b7 ${r.notes.length} notes \u00b7 ${Math.round(r.bpm)} BPM \u00b7 ${when(r.at)}`));
      const use = h("button", "k2ml-btn", "USE"); use.title = "Put these notes into the open pattern (Cmd+Z undoes)";
      use.disabled = !x;
      use.onclick = async () => {
        const y = openPattern(); if (!y) return;
        await send("setMidiNotes", { clipId: y.c.id, notes: r.notes.map((n) => Object.assign({}, n)) });
        say(`${r.name} is in the pattern.`); flash(lpFor);
      };
      const dl = h("button", "k2ml-ic"); dl.innerHTML = ICON; dl.title = "Download as a .mid file";
      dl.onclick = async () => { const m = await writeFile(r.name.slice(0, 90) + ".mid", itemFile(r), false); if (m) say(m); };
      const del = h("button", "k2ml-ic k2ml-del", "\u00d7"); del.title = "Delete from MY MIDI";
      del.onclick = () => {
        if (!del.classList.contains("sure")) { del.classList.add("sure"); del.textContent = "DELETE"; setTimeout(() => { if (del.isConnected) { del.classList.remove("sure"); del.textContent = "\u00d7"; } }, 2500); return; }
        setLib(lib().filter((y) => y.id !== r.id)); drawLib();
      };
      li.append(nm, use, dl, del); list.append(li);
    }
    lp.append(list);
    // the whole song as one file (what the old top button did with nothing picked)
    const foot = h("div", "k2ml-foot");
    const sg = h("button", "k2ml-btn ghost", "WHOLE SONG AS FILE"); sg.title = "Every pattern in the song, one track per sound";
    sg.onclick = async () => {
      const { tracks } = collectSong();
      if (!tracks.length) { say("No notes to save yet."); return; }
      const m = await writeFile(songName().slice(0, 90) + ".mid", midiFile(tracks, ui.state.bpm), true);
      if (m) say(m);
    };
    foot.append(sg);
    lp.append(foot);
    placeLib();
    if (x && it && it.notes.length) setTimeout(() => { if (inp.isConnected) { inp.focus(); inp.select(); } }, 0);
  }
  function flashRow(id) { const r = lp && lp.querySelector(`.k2ml-row[data-id="${id}"]`); if (r) { r.classList.add("new"); setTimeout(() => r.classList.remove("new"), 900); } }
  const collectSong = () => collect(true);
  document.addEventListener("mousedown", (e) => { if (lp && !lp.contains(e.target) && !(lpFor && lpFor.contains(e.target))) closeLib(); });
  window.addEventListener("resize", placeLib);

  // the button in the editor's corner: next to Play / Clear in the TOY MACHINE notes bar, or in the
  // classic piano roll's actions
  function editorButton(where, cls) {
    if (!where || where.querySelector(".k2-esave")) return;
    const b = h("button", "k2-esave " + (cls || ""));
    b.innerHTML = ICON + "<span>SAVE MIDI</span>";
    b.title = "Save MIDI: keep this pattern in MY MIDI, or save it as a file";
    b.onclick = (e) => { e.stopPropagation(); openLib(b); };
    where.prepend(b);
    if (window.TmMidiRefit && !window.KT2_BAR_ESAVE_OLD) setTimeout(window.TmMidiRefit, 0);   // the bar makes room for it (no overlap)
  }
  function topSave(iw) {
    const tm = iw.querySelector("#iw-tmidi"); if (!tm) return false;
    const ur = [...iw.querySelectorAll(".k2-ur")].find((u) => !u.closest("#iw-tmidi") && !u.closest("[hidden]") && u.offsetParent);
    let b = iw.querySelector(".k2-esave.k2-esave-top");
    // only touch `hidden` when it changes: setting it again still wakes the MutationObserver below, which calls this
    // again, forever (froze the app on KILLDRUM Done, Eman 15 Nov)
    if (!ur) { if (b && !b.hidden) b.hidden = true; return !!b; }
    if (!b) {
      b = h("button", "k2-esave k2-esave-top");
      b.innerHTML = SAVE_ICON; b.title = "Save MIDI"; b.setAttribute("aria-label", "Save MIDI");
      b.addEventListener("mousedown", (e) => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); openLib(b); };
    }
    if (b.nextElementSibling !== ur) ur.parentElement.insertBefore(b, ur);
    const show = !tm.hidden && !tm.closest("[hidden]");
    if (b.hidden === show) b.hidden = !show;
    return true;
  }
  const SAVE_ICON = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter" aria-hidden="true"><path d="M2.5 2.5h8.6l2.4 2.4v8.6h-11z"/><path d="M5 2.5v3.6h5V2.5"/><path d="M4.8 13.5V9.4h6.4v4.1"/></svg>';
  function placeEditorButtons() {
    const iw = document.getElementById("iw");
    if (!iw) return;
    // SAVE ON TOP (Eman, 15 Nov 17:16: "SAVE MIDI we can move to the top row like next to the undo buttons, and just make it
    // a save button not even a text"): in the TOY MACHINE window the save icon sits left of undo / redo while the MIDI page
    // is open; the bar keeps the room for the DICE rhythm row. KT2_TBAR_ICONS_OLD = SAVE MIDI with its words in the bar
    const top = !window.KT2_TBAR_ICONS_OLD && topSave(iw);
    iw.querySelectorAll(".tmm-end").forEach((g) => { if (top && g.closest("#iw-tmidi")) { const o = g.querySelector(".k2-esave"); if (o) o.remove(); return; } editorButton(g, "tmm"); });
    const ra = iw.querySelector("#roll .tune-actions"); if (ra && (window.KT2_BAR_ESAVE_OLD || !ra.classList.contains("tmm-bar"))) editorButton(ra, "roll");   // the TOY MACHINE bar already has one in .tmm-end (two overlapped, Eman 15 Nov)
    if (lp && (iw.hidden || (lpFor && !lpFor.isConnected))) closeLib();
  }
  if (!TOP_OLD) setTimeout(() => {   // after this file has run (h and pane are declared further down)
    placeEditorButtons();
    const iwEl = document.getElementById("iw");
    if (iwEl) new MutationObserver(placeEditorButtons).observe(iwEl, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }, 0);

  // ---------------------------------------------------------------------------
  // PREFERENCES > MIDI pane (kt2-prefs.js calls KT2Midi.pane(el) when the tab opens)
  let pane = null, keysEl = null, liveEl = null, tgtEl = null;
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  function seg(label, value, opts, set) {
    const row = h("div", "k2m-row");
    row.append(h("div", "k2m-lab", label));
    const s = h("div", "k2m-seg");
    for (const [v, name] of opts) {
      const b = h("button", v === value ? "on" : "", name);
      b.onclick = (e) => { e.stopPropagation(); set(v); render(); };
      s.append(b);
    }
    row.append(s);
    return row;
  }
  function render() {
    if (!pane) return;
    pane.replaceChildren(h("div", "k2p-h", "MIDI"));
    // controllers
    const list = h("div", "k2m-devs");
    if (!supported() || M.state === "nosupport") {
      list.append(h("div", "k2m-empty", "This browser can't use MIDI. Open KILLTOY in Chrome or Edge."));
    } else if (M.state === "blocked") {
      const box = h("div", "k2m-empty");
      box.append(h("span", null, "MIDI is blocked on this page."));
      const b = h("button", "k2m-btn", "TRY AGAIN"); b.onclick = (e) => { e.stopPropagation(); M.access = null; connect(); };
      box.append(b); list.append(box);
    } else if (!M.access) {
      list.append(h("div", "k2m-empty", "Looking for controllers\u2026"));
    } else if (!inputs().length) {
      list.append(h("div", "k2m-empty", "No controller found. Plug one in, it shows up here."));
    } else {
      for (const inp of inputs()) {
        const d = h("div", "k2m-dev" + (isOn(inp) ? " on" : ""));
        d.dataset.id = inp.id;
        const dot = h("i", "k2m-dot");
        const nm = h("div", "k2m-name"); nm.append(h("b", null, inp.name || "MIDI device"), h("span", null, inp.manufacturer || ""));
        const sw = h("button", "k2m-sw" + (isOn(inp) ? " on" : ""), isOn(inp) ? "ON" : "OFF");
        sw.onclick = (e) => { e.stopPropagation(); SET.off = isOn(inp) ? [...SET.off, inp.name] : SET.off.filter((n) => n !== inp.name); save(); if (!isOn(inp)) allOff(); render(); };
        d.append(dot, nm, sw); list.append(d);
      }
    }
    pane.append(list);
    // the live strip: plays-into + a little keyboard that lights what you play
    const live = h("div", "k2m-live");
    tgtEl = h("div", "k2m-tgt");
    keysEl = h("div", "k2m-keys");
    liveEl = live;
    live.append(tgtEl, keysEl);
    pane.append(live);
    pane.append(seg("Velocity", SET.velocity, [["played", "AS PLAYED"], ["full", "FULL"]], (v) => { SET.velocity = v; save(); }));
    pane.append(seg("Record", SET.record ? "on" : "off", [["off", "OFF"], ["on", "WHILE PLAYING"]], (v) => { SET.record = v === "on"; save(); }));
    const fr = h("div", "k2m-row");
    fr.append(h("div", "k2m-lab", "Save MIDI to"));
    const fv = h("div", "k2m-folder");
    fv.append(h("b", null, folder ? folder.name : "Downloads"));
    if (canPick()) { const pb = h("button", "k2m-btn", "PICK FOLDER"); pb.onclick = (e) => { e.stopPropagation(); pickFolder(); }; fv.append(pb); }
    if (folder) { const x = h("button", "k2m-btn ghost", "DOWNLOADS"); x.onclick = (e) => { e.stopPropagation(); forgetFolder(); }; fv.append(x); }
    fr.append(fv);
    pane.append(fr);
    activity();
  }
  // redraw the live parts only (cheap, often)
  let raf = 0;
  function activity() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!pane || !pane.isConnected || !keysEl) return;
      const x = target(), rec = SET.record && playing();
      tgtEl.replaceChildren(h("span", "k2m-k", rec ? "RECORDING INTO" : "PLAYS"), h("b", null, x ? soundName(x) : "pick a pattern"), h("span", "k2m-n", M.last && performance.now() - M.last.at < 4000 ? noteName(M.last.pitch) : ""));
      tgtEl.classList.toggle("rec", rec);
      // two octaves around the last note
      const centre = M.last ? M.last.pitch : 60, lo = Math.max(0, Math.min(103, 12 * Math.floor(centre / 12) - 12));
      if (keysEl.dataset.lo !== String(lo)) {
        keysEl.dataset.lo = lo; keysEl.replaceChildren();
        for (let p = lo; p < lo + 36; p++) { const k = h("i", [1, 3, 6, 8, 10].includes(p % 12) ? "b" : "w"); k.dataset.p = p; if (p % 12 === 0) k.dataset.c = noteName(p); keysEl.append(k); }
      }
      keysEl.querySelectorAll("i").forEach((k) => k.classList.toggle("on", M.lit.has(+k.dataset.p)));
      pane.querySelectorAll(".k2m-dev").forEach((d) => d.classList.toggle("hot", d.dataset.id && M.lastIn && performance.now() - M.lastAt < 160 && inputs().some((i) => i.id === d.dataset.id && i.name === M.lastIn)));
      if (performance.now() - M.lastAt < 200) setTimeout(activity, 180);
    });
  }
  function repaint() { if (pane && pane.isConnected) render(); }

  window.KT2Midi = {
    pane: (el) => { pane = el; render(); connect(); },
    save: saveMidi, pickFolder, connect, target, openLib, closeLib, lib,
    _file: midiFile, _collect: collect, _msg: (d, name) => onMessage(d, { name: name || "test" }), _set: SET, _rec: REC, _commit: commit,
  };
  // ask for MIDI right away only when it was used before (Chrome asks the first time from the MIDI tab)
  if (store.get("kt2.midi.used", false)) connect();
  const _connect = connect;
  KT2Midi.connect = () => { store.set("kt2.midi.used", true); return _connect(); };
  KT2Midi.pane = (el) => { pane = el; render(); KT2Midi.connect(); };
})();
