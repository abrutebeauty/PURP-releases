// TOY MACHINE: the CREATE SOUND tab (SYNTH PRESET SCIENCE, Eman 10 Nov 2026).
//
// Same synth, same circle. Next to PRESETS, CREATE SOUND turns the circle into a nest: drop up to 5
// sounds into it (voicemails, vocals, field recordings, hits), type what you want, press GROW. Four
// offspring A-D come out as normal TOY MACHINE presets: the words shape the synth
// (ui/toymachine-prompt.js) and every dropped sound gets a role:
//   BODY     the synth is rebuilt from it (the analyser's resynth + sampler), the words shape it
//   TEXTURE  it stays recognisable as grains on top (drop zone layer: grain, stretch, space)
//   SAMPLE   it plays exactly as itself, tuned to the keys
//   PULSE    its rhythm chops and repeats it in time (drop zone layer in ARP / STUTTER mode)
// Only after GROW do the tools appear on the left: the macros named after your words, plus one
// per dropped sound. SAVE puts the sound in MY PRESETS (category "Mine"), next to the factory ones,
// with its dropped audio kept in this browser (IndexedDB).
//
//   const cs = ToyMachineCreate.mount(ctx)   // ctx from toymachine.js (see open())
//   cs.decorate(stage, ring)  cs.addFiles(files)  cs.layout(discPx)  cs.active
//   ToyMachineCreate.mine.entries() / load(entry, call) / save(preset, audio)
// LIVE TEXTURES (Eman 12 Nov 2026): a dropped sound works right away, no GROW needed. While it is read
// the circle says LISTENING and its chip spins, then it pops in and is morphed into the sound that's on:
// it plays inside the synth as a texture layer (drops, through the synth's filter and envelope) and,
// when it has a pitch, its rebuilt wavetable becomes OSC B. The slider under each chip says how much
// (0 = gone). GROW no longer opens the side panels (TOOLS shows / hides them), SAVE asks for a name
// and goes back to VST, and closing the window keeps the nest as it was.
//   KT2_CS_TEXTURE_OLD = sounds only count after GROW, no sliders, no loading chip
//   KT2_CS_PANELS_OLD  = GROW opens the side panels    KT2_CS_SAVE_OLD = SAVE saves at once, stays here
//   KT2_CS_KEEP_OLD    = the nest empties when the window closes
// Plain browser JS, ASCII only. KT2_TM_CREATE_OFF = no tab (TOY MACHINE as before).
(function () {
  "use strict";
  if (window.KT2_TM_CREATE_OFF) return;

  const MAX_REFS = 5;
  const LIVE = !window.KT2_CS_TEXTURE_OLD, CLEAN = !window.KT2_CS_PANELS_OLD, NAME_SAVE = !window.KT2_CS_SAVE_OLD, KEEP = !window.KT2_CS_KEEP_OLD;
  const MORPH0 = 0.6;
  // the nest of every open synth window, so closing and reopening it brings everything back
  const STORE = new Map();
  const ROLES = ["BODY", "TEXTURE", "SAMPLE", "PULSE"];
  const ROLE_TIP = {
    BODY: "BODY: the synth is rebuilt from this sound, your words shape it",
    TEXTURE: "TEXTURE: stays recognisable as grains on top of the synth",
    SAMPLE: "SAMPLE: plays exactly as itself, tuned to the keys",
    PULSE: "PULSE: its rhythm chops and repeats it in time",
  };
  const ROLE_COLOR = { BODY: "#e4ff3a", TEXTURE: "#b18cff", SAMPLE: "#6ee7ff", PULSE: "#ff8a3d" };
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const uid = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const nice = (n) => String(n || "Sound").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "Sound";

  // ------------------------------------------------------------------ MY PRESETS (this browser)
  const LS = "tm-mine";
  const mine = {
    list() { try { const a = JSON.parse(localStorage.getItem(LS) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
    write(a) { try { localStorage.setItem(LS, JSON.stringify(a)); return true; } catch (e) { return false; } },
    /** Index entries for the preset drawer (category "Mine"). */
    entries() {
      return mine.list().map((m) => ({ id: "mine:" + m.id, mineId: m.id, mine: true, name: m.name, category: "Mine", genre: "Mine",
        tags: ["mine"].concat(m.tags || []), kw: ["mine", "my", "own", "created"].concat(m.tags || []), look: m.preset && m.preset.look }));
    },
    async save(preset, audio) {
      const id = uid(), p = clone(preset);
      p.category = p.category || "Synths";
      const list = mine.list();
      let name = String(p.name || "MY SOUND").slice(0, 40), n = 2;
      while (list.some((m) => m.name === name)) name = String(p.name || "MY SOUND").slice(0, 36) + " " + n++;
      p.name = name;
      list.unshift({ id, name, at: new Date().toISOString(), tags: (p.tags || []).slice(0, 12), preset: p });
      if (!mine.write(list)) throw new Error("This browser's storage is full");
      for (const [key, smp] of Object.entries(audio || {})) if (smp && smp.data) await idbPut(id + "/" + key, { data: smp.data, sampleRate: smp.sampleRate, name: smp.name || key });
      return { id: "mine:" + id, mineId: id, name };
    },
    async load(entry, call) {
      const m = mine.list().find((x) => x.id === entry.mineId);
      if (!m) return null;
      const p = clone(m.preset);
      // the dropped sounds go back into the engine's slots (and the body into its sampler)
      const items = p.drops && Array.isArray(p.drops.items) ? p.drops.items : [];
      for (const it of items) {
        const smp = await idbGet(m.id + "/" + it.slot);
        if (smp && smp.data) call("setDropSample", it.slot, { data: smp.data, sampleRate: smp.sampleRate, name: it.name, id: it.id });
      }
      const body = await idbGet(m.id + "/body");
      if (body && body.data) call("setSample", { data: body.data, sampleRate: body.sampleRate, name: body.name });
      return p;
    },
    remove(mineId) { mine.write(mine.list().filter((x) => x.id !== mineId)); },
  };
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const rq = indexedDB.open("tm-mine", 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore("audio");
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  async function idbPut(k, v) { try { const d = await db(); await new Promise((res, rej) => { const t = d.transaction("audio", "readwrite"); t.objectStore("audio").put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { console.warn("[CreateSound] save audio", e); } }
  async function idbGet(k) { try { const d = await db(); return await new Promise((res) => { const rq = d.transaction("audio").objectStore("audio").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); } catch (e) { return null; } }

  // ------------------------------------------------------------------ the tab
  function mount(ctx) {
    const KEY = String(ctx.key || "tm");
    const kept = KEEP ? STORE.get(KEY) : null;
    const refs = kept ? kept.refs : [];          // { id, name, res, role, peaks, slot, morph, pending }
    let text = "", grown = false, kids = [], cur = 0, busy = false, wild = 0, toolsOpen = false;
    if (kept) ({ text, grown, kids, cur, wild, toolsOpen } = kept);
    const keep = () => { if (KEEP) STORE.set(KEY, { refs, text, grown, kids, cur, wild, toolsOpen, best }); };
    let barEl = null, chipsEl = null, nestEl = null, inp = null, growBtn = null, varEl = null, discPx = 300;
    const root = ctx.root;

    function autoRole(res) {
      const r = (res && res.report) || {}, kind = r.kind || "";
      if (kind === "percussive") return "PULSE";
      if ((kind === "tonal" || kind === "breathy") && !refs.some((x) => x.role === "BODY")) return "BODY";
      return "TEXTURE";
    }
    function peaksOf(data, n = 40) {
      const out = [], step = Math.max(1, Math.floor(data.length / n));
      let mx = 1e-6;
      for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j++) m = Math.max(m, Math.abs(data[j])); out.push(m); mx = Math.max(mx, m); }
      return out.map((v) => v / mx);
    }

    async function addFiles(files) {
      const A = window.ToyMachineAnalyze;
      if (!A || typeof A.fromFile !== "function") { ctx.toast("Can't read sounds yet", ["The sound analyser isn't loaded in this window."]); return; }
      const list = [...(files || [])].filter((f) => f && (/^audio\//.test(f.type) || /\.(wav|aiff?|mp3|m4a|ogg|flac|opus|webm)$/i.test(f.name || "")));
      if (!list.length) { ctx.toast("That isn't a sound", ["Drop audio files (wav, mp3, m4a, flac...)."]); return; }
      if (LIVE) return addLive(list, A);
      const lines = [];
      for (const file of list) {
        if (refs.length >= MAX_REFS) { lines.push("The nest holds " + MAX_REFS + " sounds. Remove one to add " + nice(file.name) + "."); break; }
        root.classList.add("tm-cs-listening");
        try {
          const res = await A.fromFile(file, ctx.audioCtx(), { maxSeconds: 12 });
          if (!res || !res.sample) throw new Error("No sound came back");
          const ref = { id: "r" + uid(), name: nice(file.name), res, peaks: peaksOf(res.sample.data) };
          ref.role = autoRole(res);
          refs.push(ref);
          lines.push(ref.name + ": " + ref.role);
        } catch (err) {
          console.warn("[CreateSound] analyse", err);
          lines.push("Couldn't read " + nice(file.name) + ": " + ((err && err.message) || err));
        } finally { root.classList.remove("tm-cs-listening"); }
      }
      draw();
      if (lines.length) ctx.toast("In the nest", lines, true);   // one line per sound: its role (click the role to change it)
    }
    // LIVE: chips show up at once (spinning), each pops in ready and is morphed into the sound
    async function addLive(list, A) {
      const room = MAX_REFS - refs.length, take = list.slice(0, Math.max(0, room));
      if (list.length > take.length) ctx.toast("The nest is full", ["It holds " + MAX_REFS + " sounds. Remove one to add another."]);
      if (!take.length) return;
      const wait = take.map((file) => ({ id: "r" + uid(), name: nice(file.name), pending: true, role: "TEXTURE", peaks: [], morph: MORPH0, file }));
      refs.push(...wait);
      root.classList.add("tm-cs-listening");
      draw();
      for (const ref of wait) {
        try {
          const res = await A.fromFile(ref.file, ctx.audioCtx(), { maxSeconds: 12 });
          if (!res || !res.sample) throw new Error("No sound came back");
          ref.res = res; ref.peaks = peaksOf(res.sample.data);
          ref.role = autoRole(res);
          ref.pending = false; ref.fresh = true;
        } catch (err) {
          console.warn("[CreateSound] analyse", err);
          const i = refs.indexOf(ref);
          if (i >= 0) refs.splice(i, 1);
          ctx.toast("Couldn't read that sound", [ref.name + ": " + ((err && err.message) || err)]);
        }
        delete ref.file;
        if (!refs.some((x) => x.pending)) root.classList.remove("tm-cs-listening");
        applyLive();
        draw();
      }
    }
    // ---- LIVE morph: the dropped sounds inside the sound that's on now
    let base = null, lastSet = null;
    const isPitched = (ref) => { const r = (ref.res && ref.res.report) || {}; return r.pitchHz > 0 && r.kind !== "noise" && r.kind !== "phrase"; };
    function stripLive(p) {
      const c = clone(p || {});
      delete c.drops;
      if (c.oscB && c.oscB.fromTexture) c.oscB = { on: false };
      return c;
    }
    /** How strongly a sound is in: its level, how far it melts into the synth, how grainy (texture). */
    function morphFields(it, m) {
      m = clamp(m == null ? MORPH0 : +m);
      if (it.lvl0 == null) it.lvl0 = it.level;
      if (it.grain0 == null) it.grain0 = it.grain || 0;
      const o = { morph: r3(m), level: r3(Math.min(1.2, it.lvl0 * 1.7 * m)), melt: r3(0.15 + 0.75 * m) };
      if (it.role === "TEXTURE") o.grain = r3(Math.min(1, it.grain0 * (0.4 + 1.2 * m)));
      return o;
    }
    function synthRef(list) { return list.find((x) => isPitched(x) && x.res.preset && x.res.preset.oscA && Array.isArray(x.res.preset.oscA.frames)) || null; }
    const oscLevel = (m) => r3(0.75 * clamp(m));
    function applyLive() {
      if (!LIVE) return;
      const curP = ctx.getPreset();
      if (!base || curP !== lastSet) base = stripLive(curP);
      const ready = refs.filter((x) => !x.pending && x.res);
      const p = clone(base);
      ready.forEach((ref, i) => ctx.call("setDropSample", i, { data: ref.res.sample.data, sampleRate: ref.res.sample.sampleRate, name: ref.name, id: ref.id }));
      if (ready.length) {
        const items = ready.map((ref, i) => { const it = dropItem(ref, i, 0, i); return Object.assign(it, morphFields(it, ref.morph)); });
        p.drops = { core: 1, items };
        // a sound with a pitch becomes the second oscillator too: its rebuilt wavetable plays on every key
        const sr = synthRef(ready);
        if (sr && !(p.oscB && p.oscB.on)) {
          p.oscB = { on: true, frames: sr.res.preset.oscA.frames, pos: 0, oct: 0, semi: 0, fine: 0, level: oscLevel(sr.morph), pan: 0,
            unison: { voices: 1, detune: 0, spread: 0, blend: 1 }, warp: { type: "none", amount: 0 }, phase: 0, randomPhase: 1, filter: true, fromTexture: sr.id };
        }
      }
      lastSet = p;
      ctx.setLive(p);
      lastSet = ctx.getPreset();
    }
    /** The slider: only the numbers move (no rebuild), so dragging it is smooth. */
    function setMorph(ref, m) {
      ref.morph = clamp(m);
      const p = ctx.getPreset();
      const items = p && p.drops && Array.isArray(p.drops.items) ? p.drops.items : [];
      const k = items.findIndex((it) => it.refId === ref.id);
      if (k < 0) { applyLive(); return; }
      const o = morphFields(items[k], ref.morph);
      for (const key of Object.keys(o)) ctx.setParam(`drops.items.${k}.${key}`, o[key]);
      if (p.oscB && p.oscB.fromTexture === ref.id) ctx.setParam("oscB.level", oscLevel(ref.morph));
      keep();
    }
    function setRole(ref, role) {
      if (role === "BODY") refs.forEach((x) => { if (x !== ref && x.role === "BODY") x.role = "TEXTURE"; });
      ref.role = role;
      if (LIVE) applyLive();
      draw();
    }
    function removeRef(ref) {
      const i = refs.indexOf(ref);
      if (i >= 0) refs.splice(i, 1);
      if (LIVE) applyLive();
      draw();
    }

    // ---- GROW: words + roles -> 4 presets
    function dropItem(ref, slot, v, i) {
      const r = (ref.res && ref.res.report) || {}, smp = (ref.res.preset && ref.res.preset.sampler) || {};
      const pitched = r.pitchHz > 0 && r.kind !== "noise" && r.kind !== "phrase";
      const root = pitched ? Math.round(((+r.midi || 60) + (+r.cents || 0) / 100) * 1000) / 1000 : 60;
      const ang = (-90 + i * 72) * Math.PI / 180;
      const it = { id: "d" + uid(), refId: ref.id, slot, name: ref.name, on: true, texture: !pitched, root, tone: 0, melt: 0.5, level: 0.6, start: 0, end: 1,
        loop: false, loopStart: +smp.loopStart || 0, loopEnd: smp.loopEnd == null ? 1 : +smp.loopEnd, oneShot: false, mode: "synth", pattern: null, speed: 0, rate: 0, nudge: 0,
        drive: 0, cutoff: 0, delay: 0, reverb: 0, stretch: 1, grain: 0, sat: 0, role: ref.role,
        pos: [r3(0.5 + Math.cos(ang) * 0.36), r3(0.5 + Math.sin(ang) * 0.36)], peaks: ref.peaks,
        detected: { pitched, note: r.note || null, midi: root, confidence: +r.confidence || 0, kind: r.kind || "" } };
      if (ref.role === "TEXTURE") {
        // recognisable, but woven in: grains, a little slower, its lows thinned (the synth brings those), space
        Object.assign(it, { texture: true, grain: r3(0.3 + 0.15 * v), stretch: r3([1.6, 2.4, 1.3, 3.2][v]), melt: r3([0.25, 0.4, 0.15, 0.55][v]), tone: r3([0.15, 0.25, 0.05, 0.35][v]), reverb: r3(0.25 + 0.1 * v), delay: v === 3 ? 0.3 : 0.12, level: 0.5, loop: true });
      } else if (ref.role === "SAMPLE") {
        Object.assign(it, { melt: 0, grain: 0, stretch: 1, level: 0.7, loop: !it.texture && !!smp.loop, oneShot: r.duration > 0 && r.duration < 1.5 });
      } else if (ref.role === "PULSE") {
        Object.assign(it, { mode: v === 1 ? "stutter" : "arp", pattern: ["chop", "straight", "stab", "skip"][v], speed: v === 3 ? 1 : 0, melt: r3(0.35 + 0.1 * v), level: 0.55, oneShot: true, sat: v === 2 ? 0.3 : 0 });
      }
      return it;
    }
    async function grow() {
      if (busy) return;
      const P = window.ToyMachinePrompt;
      if (!P || typeof P.make !== "function") { ctx.toast("Can't grow yet", ["The prompt engine (toymachine-prompt.js) isn't loaded."]); return; }
      text = inp ? inp.value.trim() : text;
      if (!text && !refs.some((x) => !x.pending)) { inp && inp.focus(); ctx.toast("Give it something", ["Type what you want to hear, or drop a sound into the circle (or both)."]); return; }
      busy = true; root.classList.add("tm-cs-busy"); draw();
      try {
        const ready = refs.filter((x) => !x.pending && x.res);
        const body = ready.find((x) => x.role === "BODY") || null;
        const layers = ready.filter((x) => x !== body);
        // the seeds: the dropped body, else the closest presets to the words (and one from scratch)
        let seeds = [];
        if (body && body.res.preset) seeds = [0, 1, 2, 3].map(() => ({ preset: body.res.preset, keep: true }));
        else {
          const near = text ? ctx.search(text, 3) : [];
          const loaded = [];
          for (const e of near) { try { const p = await ctx.loadPreset(e); if (p) loaded.push({ preset: p, keep: true, from: e.name }); } catch (err) { /* skip */ } }
          seeds = [{ preset: null }, loaded[0] || { preset: null }, loaded[1] || { preset: null }, loaded[2] || { preset: null }];
        }
        const words = text || refs.map((x) => x.name).join(" ");
        kids = [];
        for (let v = 0; v < 4; v++) {
          const s = seeds[v];
          const j = (v === 0 ? 0 : v === 3 ? 0.75 : 0.35) + wild * 0.5;
          const p = await P.make(words, { seed: s.preset ? clone(s.preset) : null, keepSource: !!s.keep, jitter: j, jitterSeed: 11 + v * 7 + wild * 101 });
          // the dropped layers, one slot each
          const items = layers.map((ref, i) => { const it = dropItem(ref, i, v, i); if (LIVE) Object.assign(it, morphFields(it, ref.morph)); return it; });
          if (items.length) p.drops = { core: body || text ? 1 : 0.8, items };
          else delete p.drops;
          // finishing: phone audio and voices have no lows, so the synth's sub fills them
          if (layers.some((x) => /phrase|breathy|noise/.test((x.res.report || {}).kind || "")) && p.sub && !p.sub.on) p.sub = Object.assign({}, p.sub, { on: true, shape: "sine", oct: -2, level: 0.25 });
          // tools: one macro per dropped sound, named after it (how much of it you hear and how grainy)
          // (they take the second pair on the circle, so the words keep the first)
          const wm = (p.macros || []).slice(), sm = [];
          items.slice(0, 2).forEach((it, k) => {
            const nm = it.name.toUpperCase().replace(/[^A-Z0-9 ]+/g, "").trim().split(/\s+/).slice(0, 2).join(" ").slice(0, 12) || "SOUND " + (k + 1);
            const t = [{ param: `drops.items.${k}.level`, from: 0, to: r3(Math.min(2, it.level * 2)) }];
            if (it.role === "TEXTURE") t.push({ param: `drops.items.${k}.grain`, from: 0, to: r3(Math.min(1, it.grain * 2)) });
            if (it.role === "PULSE") t.push({ param: `drops.items.${k}.melt`, from: 0, to: 1 });
            sm.push({ name: nm, value: 0.5, targets: t });
          });
          if (sm.length) p.macros = wm.slice(0, 2).concat(sm, wm.slice(2, 4 - sm.length), wm.slice(4 - sm.length + 2)).slice(0, 8);
          p.name = (p.name || "NEW SOUND") + (v ? " " + "ABCD"[v] : "");
          p.tags = (p.tags || []).concat(["created"]);
          p.created = { text, refs: refs.map((x) => ({ name: x.name, role: x.role })), kid: "ABCD"[v], from: s.from || (body ? body.name : null) };
          kids.push(p);
        }
        // the engine gets the dropped audio once (same slots for every offspring)
        layers.forEach((ref, i) => ctx.call("setDropSample", i, { data: ref.res.sample.data, sampleRate: ref.res.sample.sampleRate, name: ref.name, id: ref.id }));
        if (body && body.res.sample) ctx.call("setSample", body.res.sample);
        grown = true;
        best = -1;
        await listen(body, layers);
        pick(best >= 0 ? best : 0);
      } catch (err) {
        console.warn("[CreateSound] grow", err);
        ctx.toast("Couldn't grow that", [String((err && err.message) || err)]);
      } finally {
        busy = false; root.classList.remove("tm-cs-busy"); draw();
      }
    }
    // ---- listen: render each offspring with the real engine, level it to about -16 dB, and (when the
    // EARS have arrived) find the one where your dropped sounds are still heard the most
    let best = -1;
    if (kept && kept.best != null) best = kept.best;
    async function listen(body, layers) {
      const R = await ctx.renderer();
      if (!R) return;
      const role = (kids[0] && kids[0].category) || "";
      const notes = /Bass/.test(role) ? [{ pitch: 36, start: 0, length: 3, velocity: 100 }]
        : [48, 55, 60].map((pitch) => ({ pitch, start: 0, length: 3, velocity: 100 }));
      const drops = {};
      layers.forEach((ref, i) => { drops[i] = { data: ref.res.sample.data, sampleRate: ref.res.sample.sampleRate }; });
      const opt = { bpm: ctx.bpm(), seconds: 4, drops, sample: body && body.res.sample ? body.res.sample : undefined };
      const P = window.ToyMachinePrompt, E = window.ToyMachineEars;
      const ears = E && E.ready && refs.length;
      const refEmb = [];
      if (ears) for (const ref of refs) { if (!ref.emb) ref.emb = await E.embed(ref.res.sample.data, ref.res.sample.sampleRate); if (ref.emb) refEmb.push(ref.emb); }
      let top = -2;
      for (let v = 0; v < kids.length; v++) {
        try {
          const render = (p) => R.render(p, notes, opt);
          if (P && P.level) await P.level(kids[v], render, -16);
          if (refEmb.length) {
            const out = await render(kids[v]);
            const mono = new Float32Array(out[0].length);
            for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (out[0][i] + out[1][i]);
            const e = await E.embed(mono, 44100);
            if (e) {
              const sc = refEmb.reduce((a, r) => a + E.cos(e, r), 0) / refEmb.length;
              kids[v].created.heard = Math.round(sc * 1000) / 1000;
              if (sc > top) { top = sc; best = v; }
            }
          }
        } catch (err) { console.warn("[CreateSound] listen", err); }
      }
    }
    function pick(v) {
      if (!kids[v]) return;
      cur = v;
      ctx.setPreset(clone(kids[v]));
      ctx.call("audition", kids[v]);
      draw();
    }
    async function save(name) {
      const p0 = ctx.getPreset();
      if (!p0) return;
      const p = name ? Object.assign(clone(p0), { name }) : p0;
      const audio = {};
      const items = p.drops && Array.isArray(p.drops.items) ? p.drops.items : [];
      for (const it of items) { const ref = refs.find((x) => x.id === it.refId || x.name === it.name); if (ref) audio[it.slot] = Object.assign({ name: ref.name }, ref.res.sample); }
      const body = refs.find((x) => x.role === "BODY");
      if (body && p.created && body.res.sample) audio.body = Object.assign({ name: body.name }, body.res.sample);
      try {
        const e = await mine.save(p, audio);
        ctx.saved(e);
        ctx.toast("Saved to MY PRESETS", [e.name + " is in the preset list under Mine, like any other preset."], true);
        if (NAME_SAVE && ctx.toPresets) { if (name) ctx.setParam("name", e.name); ctx.toPresets(); }
      } catch (err) { ctx.toast("Couldn't save", [String((err && err.message) || err)]); }
    }
    function clearAll() {
      refs.length = 0; kids = []; grown = false; text = ""; wild = 0;
      if (LIVE) applyLive();
      if (inp) inp.value = "";
      draw();
    }

    // ---- drawing (inside the real play page)
    function decorate(stage, ring) {
      nestEl = el("div", "tm-cs-nest");
      nestEl.innerHTML = '<div class="tm-cs-nest-in"><div class="tm-cs-nest-t">DROP SOUNDS</div><div class="tm-cs-nest-busy">LISTENING</div></div>';
      nestEl.addEventListener("click", () => pickFiles());
      ring.append(nestEl);
      chipsEl = el("div", "tm-cs-chips");
      stage.append(chipsEl);
      barEl = el("div", "tm-cs-bar");
      const row = el("div", "tm-cs-row");
      // the global prompt: the core of the sound. Words it understands light up as you type
      const field = el("div", "tm-cs-field");
      mirror = el("div", "tm-cs-mirror");
      inp = el("input", "tm-cs-input");
      inp.type = "text"; inp.spellcheck = false; inp.placeholder = "Describe the sound";
      inp.value = text;
      field.append(mirror, inp);
      inp.addEventListener("input", () => { text = inp.value; paintMirror(); keep(); });
      inp.addEventListener("scroll", () => { mirror.scrollLeft = inp.scrollLeft; });
      inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") grow(); });
      inp.addEventListener("keyup", (e) => e.stopPropagation());
      const add = el("button", "tm-cs-add"); add.type = "button"; add.title = "Add a sound (or drop it on the circle)"; add.textContent = "+";
      add.addEventListener("click", () => pickFiles());
      growBtn = el("button", "tm-cs-grow", "GROW"); growBtn.type = "button";
      growBtn.addEventListener("click", () => grow());
      row.append(add, field, growBtn);
      // word balls: any word becomes a ball in the circle, on top of whatever sound is on
      const row2 = el("div", "tm-cs-row2");
      const ball = el("label", "tm-cs-ballin");
      ball.innerHTML = '<i class="tm-cs-balldot"></i>';
      ballInp = el("input", "tm-cs-ballinput");
      ballInp.type = "text"; ballInp.spellcheck = false; ballInp.placeholder = "add a word"; ballInp.maxLength = 24;
      ballInp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") addBall(ballInp.value); });
      ballInp.addEventListener("keyup", (e) => e.stopPropagation());
      ball.append(ballInp);
      varEl = el("div", "tm-cs-kids");
      row2.append(ball, varEl);
      barEl.append(row, row2);
      stage.append(barEl);
      paintMirror();
      draw();
    }
    let mirror = null, ballInp = null;
    function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
    /** Words the synth understands glow acid, things it knows ("candy cane", "rust") glow purple. */
    function paintMirror() {
      if (!mirror || !inp) return;
      const P = window.ToyMachinePrompt, t = inp.value;
      if (!P || !P.wordMoves) { mirror.textContent = t; return; }
      const parts = t.split(/(\s+)/);
      let html = "";
      for (let i = 0; i < parts.length; i++) {
        const w = parts[i];
        if (!w.trim()) { html += esc(w); continue; }
        const pair = parts[i + 2] ? (w + " " + parts[i + 2]).toLowerCase().replace(/[^a-z ]/g, "") : "";
        if (pair && P.THINGS && P.THINGS[pair]) { html += '<b class="tm-cs-thing">' + esc(w + parts[i + 1] + parts[i + 2]) + "</b>"; i += 2; continue; }
        const r = P.wordMoves(w);
        const cls = r.how === "lex" ? "tm-cs-lex" : r.how === "thing" ? "tm-cs-thing" : "";
        html += cls ? '<b class="' + cls + '">' + esc(w) + "</b>" : esc(w);
      }
      mirror.innerHTML = html + "&nbsp;";
      mirror.scrollLeft = inp.scrollLeft;
    }
    function addBall(word) {
      word = String(word || "").trim();
      if (!word) return;
      const r = ctx.addBall(word);
      if (!r) return;
      if (ballInp) { ballInp.value = ""; ballInp.focus(); }
      grown = true; draw();
    }
    function pickFiles() {
      const f = el("input"); f.type = "file"; f.accept = "audio/*"; f.multiple = true;
      f.addEventListener("change", () => { if (f.files && f.files.length) addFiles(f.files); });
      f.click();
    }
    function draw() {
      root.classList.toggle("tm-cs-clean", CLEAN);
      root.classList.toggle("tm-cs-live", LIVE);
      root.classList.toggle("tm-cs-made", grown);
      root.classList.toggle("tm-grown", grown && (!CLEAN || toolsOpen));
      root.classList.toggle("tm-cs-tools", CLEAN && toolsOpen);
      root.classList.toggle("tm-cs-hasrefs", refs.length > 0);
      root.classList.toggle("tm-cs-listening", refs.some((x) => x.pending));
      if (growBtn) { growBtn.textContent = busy ? "GROWING" : grown ? "REGROW" : "GROW"; growBtn.disabled = busy; }
      if (chipsEl) {
        chipsEl.textContent = "";
        refs.forEach((ref, i) => {
          const c = el("div", "tm-cs-chip" + (ref.pending ? " tm-cs-pending" : "") + (ref.fresh ? " tm-cs-fresh" : ""));
          ref.fresh = false;
          c.style.setProperty("--rc", ROLE_COLOR[ref.role]);
          const cv = el("canvas", "tm-cs-wave"); cv.width = 80; cv.height = 22;
          const g = cv.getContext("2d");
          if (g && !ref.pending) { g.fillStyle = ROLE_COLOR[ref.role]; ref.peaks.forEach((v, k) => { const h = Math.max(1, v * 20); g.fillRect(k * 2, 11 - h / 2, 1.4, h); }); }
          const nm = el("span", "tm-cs-cname", ref.name);
          const role = el("button", "tm-cs-role", ref.pending ? "LOADING" : ref.role); role.type = "button";
          if (!ref.pending) {
            role.title = ROLE_TIP[ref.role] + ". Click to change";
            role.addEventListener("click", (e) => { e.stopPropagation(); setRole(ref, ROLES[(ROLES.indexOf(ref.role) + 1) % ROLES.length]); });
          }
          const x = el("button", "tm-cs-x", "\u00d7"); x.type = "button"; x.title = "Remove";
          x.addEventListener("click", (e) => { e.stopPropagation(); removeRef(ref); });
          c.append(cv, nm, role, x);
          if (ref.pending) c.append(el("i", "tm-cs-spin"));
          // LIVE: how much of this sound is morphed into the synth
          if (LIVE) {
            const w = el("label", "tm-cs-mixw");
            const sl = el("input", "tm-cs-mix"); sl.type = "range"; sl.min = 0; sl.max = 100; sl.step = 1;
            sl.value = Math.round((ref.morph == null ? MORPH0 : ref.morph) * 100);
            sl.disabled = !!ref.pending;
            sl.title = "How much of " + ref.name + " is morphed into the synth";
            const paint = () => { w.style.setProperty("--v", sl.value + "%"); };
            paint();
            sl.addEventListener("input", () => { paint(); setMorph(ref, sl.value / 100); });
            sl.addEventListener("dblclick", () => { sl.value = Math.round(MORPH0 * 100); paint(); setMorph(ref, MORPH0); });
            for (const t of ["pointerdown", "click", "keydown", "keyup"]) sl.addEventListener(t, (e) => e.stopPropagation());
            w.append(sl);
            c.append(w);
          }
          chipsEl.append(c);
          c.dataset.i = i;
        });
        layout(discPx);
      }
      if (varEl) {
        varEl.textContent = "";
        if (grown) {
          kids.forEach((k, v) => {
            const b = el("button", "tm-cs-kid" + (v === cur ? " tm-sel" : ""), "ABCD"[v]); b.type = "button";
            b.title = (v === 0 ? "The words as said" : v === 3 ? "The wild one" : k.created && k.created.from ? "Grown from " + k.created.from : "A sibling") + (v === best ? ". The ears hear your sounds most in this one" : "");
            if (v === best) b.classList.add("tm-cs-best");
            b.addEventListener("click", () => pick(v));
            varEl.append(b);
          });
          const w = el("button", "tm-cs-act tm-cs-wild", "WILDER"); w.type = "button"; w.title = "Four new offspring, further from the words";
          w.addEventListener("click", () => { wild = Math.min(3, wild + 1); grow(); });
          varEl.append(w);
        }
        if (grown || (LIVE && refs.some((x) => !x.pending))) {
          const s = el("button", "tm-cs-act tm-cs-save", "SAVE"); s.type = "button"; s.title = "Save this sound to MY PRESETS (it shows up in the preset list under Mine)";
          s.addEventListener("click", () => (NAME_SAVE ? askName() : save()));
          const c = el("button", "tm-cs-act tm-cs-clear", "NEW"); c.type = "button"; c.title = "Start a new sound (empties the nest)";
          c.addEventListener("click", () => clearAll());
          varEl.append(s, c);
        }
        if (CLEAN && grown) {
          const t = el("button", "tm-cs-act tm-cs-toolsbtn" + (toolsOpen ? " tm-sel" : ""), "TOOLS"); t.type = "button";
          t.title = toolsOpen ? "Hide the side panels" : "Show the side panels (macros, filter, oscillators...)";
          t.addEventListener("click", () => { toolsOpen = !toolsOpen; draw(); ctx.relayout && ctx.relayout(); });
          varEl.append(t);
        }
      }
      keep();
    }
    // SAVE: name it, then back to VST
    let nameEl = null;
    function askName() {
      if (!barEl) return;
      if (nameEl) { nameEl.remove(); nameEl = null; }
      const p = ctx.getPreset() || {};
      nameEl = el("div", "tm-cs-namebox");
      const inp2 = el("input", "tm-cs-nameinput"); inp2.type = "text"; inp2.spellcheck = false; inp2.maxLength = 40;
      inp2.value = String(p.name || (text ? text.toUpperCase().slice(0, 24) : "MY SOUND")).slice(0, 40);
      inp2.placeholder = "Name it";
      const ok = el("button", "tm-cs-nameok", "SAVE"); ok.type = "button";
      const no = el("button", "tm-cs-x", "\u00d7"); no.type = "button"; no.title = "Cancel";
      const close = () => { if (nameEl) { nameEl.remove(); nameEl = null; } };
      const go = () => { const n = inp2.value.trim() || "MY SOUND"; close(); save(n); };
      ok.addEventListener("click", go);
      no.addEventListener("click", close);
      inp2.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") go(); if (e.key === "Escape") close(); });
      inp2.addEventListener("keyup", (e) => e.stopPropagation());
      nameEl.append(inp2, ok, no);
      barEl.append(nameEl);
      setTimeout(() => { inp2.focus(); inp2.select(); }, 0);
    }
    /** Dropped sounds sit around the rim of the circle, like threads into it. */
    function layout(px) {
      discPx = px || discPx;
      if (!chipsEl) return;
      const R = discPx / 2 + 34, SPOT = [200, 340, 160, 20, 180];
      [...chipsEl.children].forEach((c, i) => {
        const a = SPOT[i % SPOT.length] * Math.PI / 180;
        const left = Math.cos(a) < 0;
        c.style.setProperty("--x", (Math.cos(a) * R).toFixed(1) + "px");
        c.style.setProperty("--y", (Math.sin(a) * R * 0.98).toFixed(1) + "px");
        c.classList.toggle("tm-cs-left", left);
      });
    }

    let warmed = false;
    /** CREATE SOUND opened: the ears start downloading in the background (once). */
    function activate() { if (!warmed && window.ToyMachineEars) { warmed = true; window.ToyMachineEars.warm(); } }

    return {
      decorate, addFiles, layout, grow, save, activate, addBall, removeBall: (id) => ctx.removeBall(id),
      get grown() { return grown; },
      get refs() { return refs; },
    };
  }

  window.ToyMachineCreate = { mount, mine, ROLES, version: 1 };
})();
