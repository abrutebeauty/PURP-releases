/* COREKULT admin MIDI lab: the real KILLTOY 2 TOY MACHINE window (VST / CREATE / SPLIT / MIDI tabs, dice, sciences,
   advanced sliders) opened on one lane, inside the sound lightbox. Loaded by lab.html; the lightbox talks to it with
   postMessage: parent -> { kt:"init", bpm, key, category, pick, notes } and lab -> parent { kt:"notes", notes }. */
(() => {
  document.documentElement.classList.add("kt-lab");
  const q = new URLSearchParams(location.search);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (f, ms = 20000) => { const t0 = Date.now(); for (;;) { try { const v = f(); if (v) return v; } catch (e) { /* not yet */ } if (Date.now() - t0 > ms) throw new Error("timeout " + f); await sleep(80); } };
  const log = (...a) => console.log("[lab]", ...a);
  const say = (o) => { try { parent.postMessage({ kt: o.kt, ...o }, "*"); } catch (e) { /* standalone */ } };
  const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const parseKey = (s) => { const m = /^\s*([A-G][#b]?)\s*(m|min|minor)?\b/i.exec(s || ""); if (!m) return null; const fl = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" }; const n = (m[1][0].toUpperCase() + m[1].slice(1)); const t = KEYS.indexOf(fl[n] || n); return t < 0 ? null : { tonic: t, minor: !!m[2] }; };
  const CAT = { arp: "Arps", lead: "Leads", pad: "Pads", bass: "Bass", pluck: "Plucks", key: "Keys", synth: "Synths", fx: "FX" };
  let started = false;

  async function start(init) {
    if (started) return; started = true;
    try {
      await until(() => typeof ui !== "undefined" && ui.state && document.querySelector(".k2h-open"));
      document.querySelector(".k2h-open").click();
      log('await until(() => !ui.home');
      await until(() => !ui.home && ui.state.tracks && ui.state.tracks.length);
      await sleep(3500);
      const key = parseKey(init.key);
      const bpm = Number(init.bpm);
      log('if (bpm >= 40');
      if (bpm >= 40 && bpm <= 250) await run("setBpm", { bpm });
      if (key) await run("setKey", { tonic: key.tonic, minor: key.minor });
      if (init.drum && !window.KT_LAB_DRUM_OFF) return await startDrum(init);   // drum packs (Eman 28 Nov): the sample itself, sliced onto KILLDRUM pads
      log('const pl = await loadPlugins()');
      // V3 (27 Nov): a sound that has a TOY MACHINE V3 preset opens on a V3 lane with that preset; otherwise the old V1 lane
      const v3 = !!(init.preset && init.preset.engine === "tm3" && window.TM3Web);
      const pl = await loadPlugins(), tm = (v3 && pl.find((x) => x.key === "builtin:toymachine3")) || pl.find((x) => /toy machine/i.test(x.name) && !/v[23]/i.test(x.name)) || pl.find((x) => /toy machine/i.test(x.name));
      log('const r = await run("newInstru');
      const r = await run("newInstrumentLane", { key: tm.key });
      log("lane", JSON.stringify(r)); await openLaneSynth(r.trackId); log("opened", $("iw").hidden, ui.state.tracks.length);
      log('await until(() => typeof tmWin');
      await until(() => typeof tmWin !== "undefined" && tmWin && tmWin.win && tmWin.pid);
      if (v3) {   // the sound's own V3 preset, then the window again so it shows it
        await run("toyMachineSetPreset", { pluginId: tmWin.pid, preset: init.preset });
        const pid = tmWin.pid; try { if (typeof closeLaneWindow === "function") closeLaneWindow(); } catch (e) { /* fine */ } await sleep(300); await openLaneSynth(r.trackId); await until(() => tmWin && tmWin.pid === pid && tmWin.win);
      }
      // neutral default patch (Init): the old DAW presets are not COREKULT sounds and are never auto-assigned
      const tab = [...document.querySelectorAll("button, .tm-tab, [role=tab]")].find((b) => b.textContent.trim() === "MIDI" && b.closest(".tm-host, #iw"));
      if (tab) tab.click();
      const lane = () => ui.state.tracks.find((t) => t.id === tmWin.laneId) || ui.state.tracks[ui.state.tracks.length - 1];
      const clip = () => { const t = lane(); return t && t.clips[0]; };
      if (init.notes && init.notes.length && clip()) {
        const end = Math.max(...init.notes.map((n) => n.start + n.length)), bars = Math.max(1, Math.ceil(end / 4 - 1e-6));   // the clip is as long as the MIDI (whole bars)
        try { await run("setClipLength", { clipId: clip().id, beats: bars * 4 }); } catch (e) { /* keeps the default length */ }
        await run("setMidiNotes", { clipId: clip().id, notes: init.notes }); if (typeof refreshLaneWindow === "function") try { refreshLaneWindow(); } catch (e) { /* fine */ } }
      let last = JSON.stringify(init.notes || []);
      setInterval(async () => { try { const f = await booth("getState", {}); if (f && f.tracks) ui.state = f; const c = clip(); const n = JSON.stringify((c && c.notes) || []); if (n !== last) { last = n; say({ kt: "notes", notes: (c && c.notes) || [] }); } } catch (e) { /* next time */ } }, 500);
      // what the editor holds now: { notes, preset } (preset = the lane's TOY MACHINE V3 preset, null on a V1 lane)
      window.__ktState = async () => { const c = clip(); let preset = null; try { const g = await run("toyMachineGetPreset", { pluginId: tmWin.pid }); if (g && g.preset && g.preset.engine === "tm3") preset = g.preset; } catch (e) { /* none */ }
        return { notes: c && c.notes ? JSON.parse(JSON.stringify(c.notes)) : [], preset, bpm: ui.state.bpm, v3 }; };
      // renders this lane's clip (its MIDI through its synth) to a WAV blob; tail = extra seconds for the release
      window.__ktRender = async (tail = 2) => { const c = clip(); if (!c) throw new Error("no clip");
        const spb = 60 / ui.state.bpm, beats = Math.round(c.length / spb), extra = Math.ceil(tail / spb);
        await run("setClipLength", { clipId: c.id, beats: beats + extra });   // room for the release, then back
        try { const r = await run("aceRender", { clipId: c.id }); if (!r || !r.wav) throw new Error((r && r.error) || "render failed"); return r; }
        finally { await run("setClipLength", { clipId: c.id, beats }); } };
      window.__ktNotes = () => { const c = clip(); return c && c.notes ? JSON.parse(JSON.stringify(c.notes)) : null; };
      say({ kt: "ready" });
    } catch (e) { say({ kt: "error", msg: String(e && e.message || e) }); console.warn("[lab]", e); }
  }
  /* KILLDRUM mode: the drum sound (a loop or a one-shot, cut from its sprite) goes on an audio lane, is sliced onto
     KILLDRUM pads (one hit per pad, playing in order = the exact sample), and the audio lane is removed again.
     Turn off: window.KT_LAB_DRUM_OFF = true (falls back to the synth lane). */
  async function startDrum(init) {
    const d = init.drum, ac = new (window.AudioContext || window.webkitAudioContext)();
    const full = await ac.decodeAudioData(await (await fetch(d.url)).arrayBuffer());
    const sr = full.sampleRate, a0 = Math.max(0, Math.floor((d.a || 0) * sr)), a1 = d.b != null ? Math.min(full.length, Math.floor(d.b * sr)) : full.length, n = Math.max(1, a1 - a0);
    const chs = []; for (let c = 0; c < full.numberOfChannels; c++) chs.push(full.getChannelData(c).subarray(a0, a0 + n));
    const view = new DataView(new ArrayBuffer(44 + n * 4)), str = (o, t) => { for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i)); };
    str(0, "RIFF"); view.setUint32(4, 36 + n * 4, true); str(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
    view.setUint32(24, sr, true); view.setUint32(28, sr * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, n * 4, true);
    const L = chs[0], R = chs[1] || chs[0]; for (let i = 0, o = 44; i < n; i++, o += 4) { view.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); view.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    try { ac.close(); } catch (e) { /* fine */ }
    const url = URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
    const s = await run("addSample", { url, name: d.name || "Drum", start: 0, oneShot: !d.loop, laneName: "Drum sample" });
    if (!s || !s.clipId) throw new Error((s && s.error) || "the sample did not load");
    const cv = await run("convertToMidi", { clipId: s.clipId, mode: "slice" });
    if (!cv || !cv.trackId) throw new Error((cv && cv.error) || "slicing failed");
    try { await run("deleteTrack", { trackId: s.trackId }); } catch (e) { /* the audio lane stays, muted */ try { await run("toggleMute", { trackId: s.trackId }); } catch (e2) { /* fine */ } }
    const f = await booth("getState", {}); if (f && f.tracks) ui.state = f;
    const lane = () => ui.state.tracks.find((t) => t.id === cv.trackId), clip = () => { const t = lane(); return t && t.clips[0]; };
    try { await openLaneSynth(cv.trackId); } catch (e) { log("no KILLDRUM window", e); }
    let last = JSON.stringify((clip() && clip().notes) || []);
    setInterval(async () => { try { const g = await booth("getState", {}); if (g && g.tracks) ui.state = g; const c = clip(); const nn = JSON.stringify((c && c.notes) || []); if (nn !== last) { last = nn; say({ kt: "notes", notes: JSON.parse(nn) }); } } catch (e) { /* fine */ } }, 1000);
    window.__ktState = async () => { const c = clip(); return { notes: c && c.notes ? JSON.parse(JSON.stringify(c.notes)) : [], preset: null, bpm: ui.state.bpm, v3: false, drum: true }; };
    window.__ktRender = async (tail = 2) => { const c = clip(); if (!c) throw new Error("no clip");
      const spb = 60 / ui.state.bpm, beats = Math.round(c.length / spb), extra = Math.ceil(tail / spb);
      await run("setClipLength", { clipId: c.id, beats: beats + extra });
      try { const r = await run("aceRender", { clipId: c.id }); if (!r || !r.wav) throw new Error((r && r.error) || "render failed"); return r; }
      finally { await run("setClipLength", { clipId: c.id, beats }); } };
    window.__ktNotes = () => { const c = clip(); return c && c.notes ? JSON.parse(JSON.stringify(c.notes)) : null; };
    say({ kt: "ready", notes: (clip() && clip().notes) || [] });
  }
  async function pickPreset(entry) {
    const r = await run("toyMachineLoadPreset", { id: entry.id, file: entry.file });
    log("load", entry.id, JSON.stringify(r).slice(0, 120));
    if (!r || !r.preset) return;
    await run("toyMachineSetPreset", { pluginId: tmWin.pid, preset: r.preset });
    tmWin.win.setPreset(r.preset);
  }
  addEventListener("message", (e) => {
    const m = e.data; if (!m || typeof m !== "object") return;
    if (m.kt === "init") start(m);
    if (m.kt === "preset" && typeof tmWin !== "undefined" && tmWin) pickPreset(m.entry);
  });
  if (q.has("bpm")) start({ bpm: q.get("bpm"), key: q.get("key"), category: q.get("cat"), pick: +q.get("pick") || 0 });
  else { const h = setInterval(() => { if (started) clearInterval(h); else say({ kt: "hello" }); }, 500); }
})();
