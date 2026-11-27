/* TOY MACHINE: the TEXTURES page (KILLTOY 333, 16 Nov 2026). A library of named textures
   (ghost choirs, frozen vowels, whisper clouds, vocal chops, dust, hum, metal, air) that any
   sound can wear as layers. Several at once (up to 6, they share the drop zone's slots).

   Each layer plays one texture with a behaviour:
     PAD (follows the keys) . SHIMMER (octaves up, in reverb) . FRAGMENTS (sparse notes drifting
     around the held note) . RISE (climbs root, fifth, octave in a loop) . BED (own pitch, loops
     under) . STUTTER . CHOP (vocal slices on the grid)

   The layers are preset "drops" items with "tex": <id> (Source/dsp/toymachine/TmDrops.h plays them);
   the audio is toy-machine/textures/<id>.wav, listed in toy-machine/textures/index.json
   (made by scripts/k333/make_textures.py + make_el_textures.py; "usedBy" = presets wearing it).

   window.ToyMachineTextures.mount(pageEl, ctx) -> { render(), loaded() }
   ctx: get() -> { full, orig }, push(), flush(), call(fn, ...), audioCtx(), toast(t, lines, good)
   window.KT2_TEXTURES_BASE: where the library lives (default "toy-machine/textures/"); window.KT2_TEXTURES_INDEX: the index itself (array or promise).
   window.KT2_TM_TEXTURES_OFF: no TEXTURES page (old behaviour).
   Plain JS, no build step. ASCII only. */
(function () {
  "use strict";
  const MAX = 6;
  const FAMS = [["all", "All"], ["ghost", "Ghost"], ["dust", "Dust"], ["dirt", "Dirt"], ["metal", "Metal"], ["air", "Air"]];
  const ROLES_P = [["pad", "PAD"], ["shimmer", "SHIMMER"], ["fragments", "FRAGMENTS"], ["rise", "RISE"]];
  const ROLES_B = [["bed", "BED"], ["stutter", "STUTTER"], ["chop", "CHOP"]];
  const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = (m) => { const n = Math.round(m); return NOTE[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); };
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const base = () => (window.KT2_TEXTURES_BASE || "toy-machine/textures/");

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(cls, html, title) { const b = el("button", cls); b.type = "button"; if (html != null) b.innerHTML = html; if (title) b.title = title; return b; }

  // ------------------------------------------------ the library (shared by every window)
  let LIB = null, libLoad = null;
  function loadLib() {
    if (!libLoad && window.KT2_TEXTURES_INDEX) libLoad = Promise.resolve(window.KT2_TEXTURES_INDEX).then((a) => { LIB = Array.isArray(a) ? a : []; return LIB; });   // a host that carries the index itself (SCIENCE KILLTOY 333 tab)
    if (!libLoad) libLoad = fetch(base() + "index.json").then((r) => (r.ok ? r.json() : [])).then((a) => { LIB = Array.isArray(a) ? a : []; return LIB; }).catch(() => { LIB = []; libLoad = null; return LIB; });
    return libLoad;
  }
  const audio = new Map();   // id -> Promise of { data, sampleRate, id }
  function loadTex(id, ac) {
    if (window.KT2LoadDrop) return window.KT2LoadDrop("tex:" + id);
    if (!audio.has(id)) audio.set(id, fetch(base() + encodeURIComponent(id) + ".wav").then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => ac.decodeAudioData(b)).then((buf) => {
        const data = new Float32Array(buf.length);
        for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < ch.length; i++) data[i] += ch[i] / buf.numberOfChannels; }
        return { data, sampleRate: buf.sampleRate, id: "tex:" + id };
      }).catch(() => { audio.delete(id); return null; }));
    return audio.get(id);
  }

  // ------------------------------------------------ behaviours (same as scripts/k333/k333_layers.py)
  function rnd(seed) { let h = 2166136261; for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  function shape(it, t, role) {
    const r = rnd(t.id + role), pick = (a) => a[Math.floor(r() * a.length)];
    const keep = { slot: it.slot, tex: t.id, id: "tex:" + t.id, name: t.name, on: it.on !== false, level: it.level, pos: it.pos };
    for (const k in it) delete it[k];
    Object.assign(it, keep, { layer: role, texture: t.kind !== "pitched", root: t.root || 60, loop: t.loop !== false, mode: "synth", melt: 0.3, tone: 0 });
    if (t.loop === false) it.oneShot = true;
    if (role === "pad") Object.assign(it, { texture: false, melt: 0.6, grain: Math.round(r() * 25) / 100 });
    else if (role === "shimmer") Object.assign(it, { texture: false, root: (t.root || 60) - pick([12, 12, 19, 24]), tone: 0.55, melt: 0.15, reverb: 0.75, delay: 0.3, grain: 0.35, stretch: 2 });
    else if (role === "fragments") {
      const n = pick([8, 12, 16]), prob = Math.round((0.28 + r() * 0.22) * 100) / 100, steps = [];
      for (let k = 0; k < n; k++) steps.push(r() < 0.2 ? { n: null } : { n: pick([0, 1, 2, 3, 1, 2]), oct: pick([0, 0, 1]), gate: Math.round((0.15 + r() * 0.25) * 100) / 100, prob });
      Object.assign(it, { texture: false, mode: "arp", steps, speed: pick([0, 0, -1, 1]), tone: 0.35, melt: 0.2, reverb: 0.55, delay: 0.45 });
    } else if (role === "rise") {
      const steps = []; for (const o of [0, 1]) for (const n of [0, 1, 2, 3]) steps.push({ n, oct: o, gate: 0.9, prob: 0.85 });
      Object.assign(it, { texture: false, mode: "arp", steps, speed: pick([-1, -1, 0, 1]), tone: 0.25, melt: 0.2, reverb: 0.5, delay: 0.3, stretch: 1.5 });
    } else if (role === "stutter") Object.assign(it, { mode: "stutter", pattern: pick(["straight", "triplet", "roll"]), speed: pick([0, 1]), tone: 0.2, melt: 0.35 });
    else if (role === "chop") Object.assign(it, { texture: true, mode: "arp", pattern: "chop", speed: 0, tone: 0.15, melt: 0.3, delay: 0.15 });
    else Object.assign(it, { texture: true, tone: 0.3, melt: 0.25 });   // bed
    if (!it.pos) it.pos = fieldPos(it.tone, it.melt, it.slot);
    return it;
  }
  function fieldPos(tone, melt, i) {   // the DROP ZONE field's inverse (ui/toymachine-dropzone.js fromPos)
    const d = 0.23 + (1 - melt) * 0.67, rr = d * 0.5, dx = Math.max(-rr * 0.97, Math.min(rr * 0.97, tone * 0.4));
    const dy = Math.sqrt(Math.max(0, rr * rr - dx * dx)) * (i % 2 ? 1 : -1);
    return [Math.round((0.5 + dx) * 1e4) / 1e4, Math.round((0.5 + dy) * 1e4) / 1e4];
  }
  const rolesOf = (t) => (t && t.kind === "pitched" ? ROLES_P : ROLES_B);
  const defaultRole = (t) => (t.kind === "pitched" ? "pad" : t.recipe === "chop" ? "chop" : "bed");
  const levelFor = (t, lv) => Math.max(0.02, Math.min(1.6, Math.round(lv * Math.pow(10, (-18 - (t.rms != null ? t.rms : -18)) / 20) * 1000) / 1000));

  function mount(page, ctx) {
    let fam = "all", sel = null, prev = null;   // sel = library texture id shown in the strip
    const drops = () => { const { orig } = ctx.get(); if (!orig.drops || typeof orig.drops !== "object") orig.drops = { core: 1, items: [] }; if (!Array.isArray(orig.drops.items)) orig.drops.items = []; return orig.drops; };
    const layers = () => drops().items.filter((it) => it && it.tex);
    const byId = (id) => (LIB || []).find((t) => t.id === id) || null;
    function changed() { const { full } = ctx.get(); full.drops = clone(drops()); ctx.flush(); }
    function sendAudio(it) { const ac = ctx.audioCtx(); loadTex(it.tex, ac).then((smp) => { if (smp) ctx.call("setDropSample", it.slot, { data: smp.data, sampleRate: smp.sampleRate, name: it.name, id: it.id }); }); }
    function freeSlot() { const used = new Set(drops().items.map((x) => x.slot)); for (let s = 0; s < MAX; s++) if (!used.has(s)) return s; return -1; }
    function add(t) {
      if (drops().items.length >= MAX) { ctx.toast("Textures", ["A sound holds " + MAX + " layers. Remove one first."]); return; }
      const it = shape({ slot: freeSlot(), level: levelFor(t, t.kind === "pitched" ? 0.3 : 0.18) }, t, defaultRole(t));
      drops().items.push(it);
      sendAudio(it); changed(); render(); ctx.call("audition", ctx.get().orig);
    }
    function remove(it) { const a = drops().items; a.splice(a.indexOf(it), 1); changed(); render(); }
    function preview(t) {
      const ac = ctx.audioCtx(); if (!ac) return;
      if (prev) { try { prev.src.stop(); } catch (e) {} const was = prev.id; prev = null; renderLib(); if (was === t.id) return; }
      loadTex(t.id, ac).then((smp) => {
        if (!smp) return;
        const b = ac.createBuffer(1, smp.data.length, smp.sampleRate); b.copyToChannel(smp.data, 0);
        const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = b; g.gain.value = 0.35; src.connect(g).connect(ac.destination);
        src.onended = () => { if (prev && prev.src === src) { prev = null; renderLib(); } };
        if (ac.state === "suspended") ac.resume(); src.start(); prev = { id: t.id, src }; renderLib();
      });
    }

    let headEl, onEl, stripEl, libEl;
    function render() {
      page.textContent = "";
      const wrap = el("div", "tm-arp tm-txp");
      headEl = el("div", "tm-arphead"); onEl = el("div", "tm-txon"); stripEl = el("div", "tm-txstrip"); libEl = el("div", "tm-arplib");
      wrap.append(headEl, onEl, stripEl, libEl); page.append(wrap);
      renderHead(); renderOn(); renderStrip(); renderLib();
      if (!LIB) loadLib().then(() => { renderOn(); renderStrip(); renderLib(); });
    }
    function renderHead() {
      headEl.textContent = "";
      const ttl = el("div", "tm-textitle"), n = layers().length;
      ttl.append(el("div", "tm-texname", "TEXTURES"), el("div", "tm-texsub", n ? n + (n === 1 ? " layer" : " layers") + " on this sound" : "No layers on this sound"));
      headEl.append(ttl);
    }
    function renderOn() {
      onEl.textContent = "";
      renderHead();
      const ls = layers();
      onEl.hidden = !ls.length;
      for (const it of ls) {
        const t = byId(it.tex) || { id: it.tex, name: it.name, kind: it.texture ? "bed" : "pitched", family: "" };
        const card = el("div", "tm-txcard tm-sel" + (it.on === false ? " tm-dim" : ""));
        const top = el("div", "tm-txtop");
        const pw = btn("tm-txpow" + (it.on === false ? "" : " tm-on"), "", it.on === false ? "On" : "Off");
        pw.addEventListener("click", () => { it.on = it.on === false; changed(); renderOn(); });
        const nm = el("span", "tm-arpcn", t.name || it.name);
        nm.addEventListener("click", () => { sel = t.id; renderStrip(); renderLib(); });
        const x = el("span", "tm-arpdel", "\u00d7"); x.addEventListener("click", () => remove(it));
        top.append(pw, nm, x);
        const roles = el("div", "tm-txroles");
        for (const [k, lab] of rolesOf(t)) {
          const c = btn("tm-txrole" + ((it.layer || defaultRole(t)) === k ? " tm-sel" : ""), lab);
          c.addEventListener("click", () => { if (!byId(it.tex)) return; shape(it, byId(it.tex), k); changed(); renderOn(); ctx.call("audition", ctx.get().orig); });
          roles.append(c);
        }
        const lv = el("input", "tm-txlevel"); lv.type = "range"; lv.min = 0; lv.max = 1.6; lv.step = 0.01; lv.value = it.level != null ? it.level : 0.5;
        lv.addEventListener("input", () => { it.level = +lv.value; const { full } = ctx.get(); full.drops = clone(drops()); ctx.push(); });
        lv.addEventListener("change", () => changed());
        card.append(top, roles, lv);
        onEl.append(card);
      }
    }
    function renderStrip() {
      stripEl.textContent = "";
      const t = sel && byId(sel);
      stripEl.hidden = !t;
      if (!t) return;
      const on = layers().find((it) => it.tex === t.id);
      const nm = el("div", "tm-txsname", t.name);
      const meta = el("div", "tm-txsmeta", [t.family ? t.family.toUpperCase() : "", t.kind === "pitched" ? noteName(t.root) : "OWN PITCH", (t.seconds || 0).toFixed(1) + " S"].filter(Boolean).join(" \u00b7 "));
      const go = btn("tm-modechip" + (on ? " tm-sel" : ""), on ? "ON THIS SOUND" : "ADD");
      go.addEventListener("click", () => { if (on) remove(on); else add(t); renderStrip(); renderLib(); });
      const used = el("div", "tm-txused");
      const ub = t.usedBy || [];
      if (ub.length) { used.append(el("span", "tm-txulab", "USED BY " + ub.length)); for (const n of ub.slice(0, 40)) used.append(el("span", "tm-txuse", n)); }
      stripEl.append(nm, meta, go, used);
    }
    function renderLib() {
      libEl.textContent = "";
      const list = LIB || [];
      const tabs = el("div", "tm-chips tm-arpfams");
      for (const [k, lab] of FAMS) {
        const n = k === "all" ? list.length : list.filter((t) => t.family === k).length;
        const c = btn("tm-modechip" + (fam === k ? " tm-sel" : ""), lab + '<span class="tm-tcount">' + n + "</span>");
        c.addEventListener("click", () => { fam = k; renderLib(); });
        tabs.append(c);
      }
      const grid = el("div", "tm-arpcards tm-txgrid");
      if (!LIB) grid.append(el("div", "tm-empty", "Loading textures..."));
      else if (!list.length) grid.append(el("div", "tm-empty", "No textures here."));
      const onIds = new Set(layers().map((it) => it.tex));
      for (const t of list.filter((t) => fam === "all" || t.family === fam)) {
        const card = btn("tm-arpcard tm-txlib" + (onIds.has(t.id) ? " tm-sel" : "") + (sel === t.id ? " tm-txpick" : ""));
        const pl = el("span", "tm-txplay" + (prev && prev.id === t.id ? " tm-on" : ""));
        pl.addEventListener("click", (e) => { e.stopPropagation(); preview(t); });
        const top = el("div", "tm-txtop"); top.append(pl, el("span", "tm-arpcn", t.name));
        card.append(top, el("span", "tm-arpcr", (t.family || "").toUpperCase() + " \u00b7 " + (t.kind === "pitched" ? noteName(t.root) : "OWN PITCH") + ((t.usedBy || []).length ? " \u00b7 " + t.usedBy.length : "")));
        card.addEventListener("click", () => { sel = t.id; renderStrip(); renderLib(); });
        card.addEventListener("dblclick", () => { if (!onIds.has(t.id)) add(t); });
        grid.append(card);
      }
      libEl.append(tabs, grid);
    }
    loadLib();
    return { render, loaded: () => !!LIB, send: () => layers().forEach(sendAudio) };
  }

  window.ToyMachineTextures = { mount, loadLib, loadTex, shape };
})();
