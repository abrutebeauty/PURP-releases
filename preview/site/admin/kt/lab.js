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
      log('const pl = await loadPlugins()');
      const pl = await loadPlugins(), tm = pl.find((x) => /toy machine/i.test(x.name));
      log('const r = await run("newInstru');
      const r = await run("newInstrumentLane", { key: tm.key });
      log("lane", JSON.stringify(r)); await openLaneSynth(r.trackId); log("opened", $("iw").hidden, ui.state.tracks.length);
      log('await until(() => typeof tmWin');
      await until(() => typeof tmWin !== "undefined" && tmWin && tmWin.win && tmWin.pid);
      // neutral default patch (Init): the old DAW presets are not COREKULT sounds and are never auto-assigned
      const tab = [...document.querySelectorAll("button, .tm-tab, [role=tab]")].find((b) => b.textContent.trim() === "MIDI" && b.closest(".tm-host, #iw"));
      if (tab) tab.click();
      const lane = () => ui.state.tracks.find((t) => t.id === tmWin.laneId) || ui.state.tracks[ui.state.tracks.length - 1];
      const clip = () => { const t = lane(); return t && t.clips[0]; };
      if (init.notes && init.notes.length && clip()) { await run("setMidiNotes", { clipId: clip().id, notes: init.notes }); if (typeof refreshLaneWindow === "function") try { refreshLaneWindow(); } catch (e) { /* fine */ } }
      let last = JSON.stringify(init.notes || []);
      setInterval(async () => { try { const f = await booth("getState", {}); if (f && f.tracks) ui.state = f; const c = clip(); const n = JSON.stringify((c && c.notes) || []); if (n !== last) { last = n; say({ kt: "notes", notes: (c && c.notes) || [] }); } } catch (e) { /* next time */ } }, 1500);
      say({ kt: "ready" });
    } catch (e) { say({ kt: "error", msg: String(e && e.message || e) }); console.warn("[lab]", e); }
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
