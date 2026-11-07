// BLOB, step 1 of the rethink (BLOB design map v2, page 15): one creature, and the sound is a
// TOY MACHINE preset. < > flips through the presets and the blob melts into what that sound would
// look like (ui/blob-look.js), drawn in 3D by ui/blob3d.js. The blob is lit from inside while it's
// selected and dims when it isn't. G gives a grab hand: drag to turn it around, scroll to bring
// it closer. Playing it shakes it: hard sounds click, soft ones swell like jelly.
//
//   const ui = BLOB2.mount(el, {
//     engine,                   // { setPreset(p), noteOn(pitch, vel), noteOff(pitch), meter?() -> {peak}, close?() }
//     loadIndex: () => [...],   // the TOY MACHINE index (presets/index.json), may be async
//     loadPreset: (id) => preset (may be async),
//     preset, presetId,         // what to show first (none = the plain saw blob)
//     onChange: ({ presetId, preset, step }) => {},   // step: one id per drag / click / preset change (one undo step each)
//     keys: true,               // the computer keys play it (G is the grab hand, so the G note is on the screen keys)
//     logo: "blob-logo.png"
//   });
//   ui.noteOn(60) / ui.noteOff(60) / ui.setPreset(preset, id) / ui.next(1) / ui.destroy()
// Keep this file ASCII-only, like ui/.
"use strict";

window.BLOB2 = (function () {
  const KEYS = "awsedftgyhujkolp;";
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const isTyping = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;

  function mount(root, opts = {}) {
    const L = window.BlobLook;
    root.classList.add("blob2");
    root.innerHTML = `
<header>
  <img class="logo" alt="BLOB">
  <div class="pre">
    <button class="prev" title="Previous sound" aria-label="Previous sound">&lsaquo;</button>
    <button class="name" title="All sounds"><b></b><small></small></button>
    <button class="nxt" title="Next sound" aria-label="Next sound">&rsaquo;</button>
  </div>
  <button class="grab" title="Grab hand: drag to turn the blob (G)"><span class="ic"></span>GRAB <kbd>G</kbd></button>
</header>
<div class="stage">
  <aside class="lt"><div class="mapbox mood"></div><p class="mread"></p><button class="reset" title="Put every map back in the middle (the sound as loaded)">RESET MAPS</button></aside>
  <div class="view">
    <canvas></canvas>
    <div class="words"></div>
    <div class="hint">Drag the pucks. <b>G</b> grab hand. Click the blob to light it up. Keys <b>A W S E D F T&nbsp;Y H U J K</b> play it.</div>
    <div class="list" hidden><input class="q" placeholder="Search sounds" spellcheck="false"><div class="items"></div></div>
  </div>
  <aside class="rt"><div class="tabs"></div><div class="mapbox big"></div><div class="envbox" hidden></div><p class="bread"></p></aside>
</div>
<footer><button class="oct" data-d="-1" title="Octave down">&minus;</button><div class="keys"></div><button class="oct" data-d="1" title="Octave up">+</button></footer>`;
    const $ = (s) => root.querySelector(s);
    $(".logo").src = opts.logo || "blob-logo.png";
    const stage = $(".view"), cv = $("canvas"), wordsEl = $(".words"), listEl = $(".list");
    // the mesh (ui/blob-mesh.js) draws sharp at full resolution; the raymarcher (ui/blob3d.js) is the fallback
    const useMesh = window.BLOBMESH && (opts.renderer || window.BLOB2_RENDERER) !== "ray";
    let r3 = null;
    try { r3 = useMesh ? window.BLOBMESH.create(cv) : null; } catch (e) { console.warn("BLOB mesh", e); r3 = null; }
    if (!r3 || !r3.ok) r3 = window.BLOB3D.create(cv);
    const meshDraw = !!(r3 && r3.triangles);
    if (!r3.ok) stage.append(h("div", "nogl", "This browser can't draw the 3D blob (WebGL is off)."));

    let engine = opts.engine || null;
    let index = [], preset = opts.preset || null, presetId = opts.presetId || null, meta = null;
    let target = L.lookOf(preset || L.INIT, meta), cur = { ...target.look }, m = target.m;
    let selected = true, grab = false, dragging = null, octave = 0;
    const cam = { yaw: 0.5, pitch: 0.22, dist: 7, vy: 0, vp: 0 };
    const M = window.BlobMaps;
    let mapState = {}, edited = null, tool = "skin";
    const live = { level: 0, swell: 0, flash: 0, lamp: 1, held: new Set() };

    // ---- presets
    const findMeta = (id) => index.find((x) => x.id === id) || null;
    function showName() {
      $(".name b").textContent = preset ? preset.name || (meta && meta.name) || "Sound" : "Plain saw";
      $(".name small").textContent = meta ? `${meta.category} \u00b7 ${index.indexOf(meta) + 1} / ${index.length}` : preset ? preset.category || "" : "no sound loaded";
      wordsEl.textContent = L.words(m).join(" \u00b7 ");
    }
    function setPreset(p, id, quiet) {
      preset = p || null; presetId = id || null; meta = presetId ? findMeta(presetId) : null;
      mapState = {}; edited = null; clearTimeout(sendWait); sendWait = null;
      target = L.lookOf(preset || L.INIT, meta); m = target.m;
      if (engine) engine.setPreset(preset || L.INIT);
      showName(); drawTools();
      lastSent = JSON.stringify(preset || L.INIT);
      if (!quiet) newStep();
      if (!quiet && opts.onChange) opts.onChange({ presetId, preset, step });
    }
    // a map or an envelope moved: the sound and the blob follow at once; the host hears about it
    // a few times a second while dragging (KILLTOY 2 makes one undo step of a whole drag)
    // Each drag, click or preset change is one "step" (KILLTOY 2 makes one undo step of each, by this id)
    let sendT = 0, sendWait = null, lastSent = JSON.stringify(preset || L.INIT), step = "";
    const newStep = () => { step = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
    function edit(final) {
      const empty = !Object.keys(mapState).some((k) => k === "env" ? !!mapState.env : mapState[k] && (mapState[k][0] || mapState[k][1]));
      edited = empty ? null : M.apply(preset || L.INIT, mapState);
      const now = edited || preset || L.INIT;
      target = L.lookOf(now, meta); m = target.m;
      wordsEl.textContent = L.words(m).join(" \u00b7 ");
      if (engine) engine.setPreset(now, true);
      readouts();
      const go = () => {
        sendWait = null; sendT = performance.now();
        const j = JSON.stringify(now);
        if (j === lastSent) return;   // nothing really changed (a click on the spot the puck already was)
        lastSent = j;
        if (opts.onChange) opts.onChange({ presetId, preset: now, edited: !!edited, step });
      };
      clearTimeout(sendWait);
      if (final || performance.now() - sendT > 120) go(); else sendWait = setTimeout(go, 120);
    }
    let loading = 0, wantId = null;
    async function pick(id) {
      const me = ++loading;
      wantId = id;
      try {
        const p = await opts.loadPreset(id);
        if (me !== loading || !p) return;
        wantId = null;
        setPreset(p, id);
        hitPreview();
      } catch (e) { wordsEl.textContent = "Couldn't load that sound."; }
    }
    function next(d) {
      if (!index.length) return;
      const at = (wantId && findMeta(wantId)) || meta;   // quick clicks count from the one still loading
      const i = at ? index.indexOf(at) : d > 0 ? -1 : 0;
      pick(index[(i + d + index.length) % index.length].id);
    }
    // a short note so you hear the new sound (only when nothing is held)
    function hitPreview() {
      if (!engine || live.held.size) return;
      const p = meta && meta.category === "Bass" ? 36 : 60;
      noteOn(p, 100); setTimeout(() => noteOff(p), 420);
    }
    $(".prev").onclick = () => next(-1);
    $(".nxt").onclick = () => next(1);

    // the list of every sound, with search
    function drawList() {
      const q = $(".q").value.trim().toLowerCase(), box = $(".items");
      box.textContent = "";
      let last = null, n = 0;
      for (const x of index) {
        if (q && !(x.name.toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q) || (x.kw || []).some((w) => w.startsWith(q)))) continue;
        if (x.category !== last) { box.append(h("h6", null, x.category)); last = x.category; }
        const b = h("button", x.id === presetId ? "on" : "", x.name);
        b.onclick = () => { listEl.hidden = true; pick(x.id); };
        box.append(b);
        n++;
      }
      if (!n) box.append(h("p", "none", "Nothing called that."));
    }
    $(".name").onclick = () => {
      listEl.hidden = !listEl.hidden;
      if (!listEl.hidden) { drawList(); $(".q").focus(); const on = $(".items .on"); if (on) on.scrollIntoView({ block: "center" }); }
    };
    $(".q").oninput = drawList;
    $(".q").onkeydown = (e) => { if (e.key === "Escape") { listEl.hidden = true; e.stopPropagation(); } };

    Promise.resolve(opts.loadIndex ? opts.loadIndex() : []).then((ix) => {
      index = Array.isArray(ix) ? ix : (ix && ix.presets) || [];
      meta = presetId ? findMeta(presetId) : null;
      target = L.lookOf(edited || preset || L.INIT, meta); m = target.m;
      showName();
    }).catch(() => {});
    if (engine) engine.setPreset(preset || L.INIT);
    showName();


    // ---- the maps (step 2): MOOD always on the left, one big map at a time on the right
    const SVGNS = "http://www.w3.org/2000/svg";
    const sv = (tag, at) => { const e = document.createElementNS(SVGNS, tag); for (const k in at || {}) e.setAttribute(k, at[k]); return e; };
    function makeMap(box, def) {
      box.textContent = ""; box.classList.remove("on");
      const head = h("div", "mhead"); head.append(h("b", null, def.name), h("small", null, def.what));
      const svg = sv("svg", { viewBox: "-120 -120 240 240", class: "map" });
      svg.append(sv("circle", { r: 112, class: "bg" }), sv("circle", { r: 74, class: "ring" }), sv("circle", { r: 37, class: "ring" }),
        sv("line", { x1: -112, y1: 0, x2: 112, y2: 0, class: "ax" }), sv("line", { x1: 0, y1: -112, x2: 0, y2: 112, class: "ax" }));
      const label = (txt, x, y, anchor) => { const t = sv("text", { x, y, "text-anchor": anchor || "middle", class: "lb" }); t.textContent = txt; svg.append(t); };
      if (def.ring) {
        svg.append(sv("circle", { r: 31, class: "core" }));
        label("AS LOADED", 0, 3);
        M.SOURCES.forEach((src, i) => { const a = (i / 8) * Math.PI * 2; label(src.name, Math.cos(a) * 92, -Math.sin(a) * 92 + 3); });
      } else {
        label(def.up, 0, -98); label(def.down, 0, 104);
        label(def.left, -106, -6, "start"); label(def.right, 106, -6, "end");
      }
      const trail = sv("line", { class: "trail", x1: 0, y1: 0, x2: 0, y2: 0 });
      const puck = sv("circle", { r: 11, class: "puck" });
      svg.append(trail, puck);
      box.append(head, svg);
      const set = (x, y) => { puck.setAttribute("cx", x * 100); puck.setAttribute("cy", -y * 100); trail.setAttribute("x2", x * 100); trail.setAttribute("y2", -y * 100); };
      const v0 = mapState[def.id] || [0, 0]; set(v0[0], v0[1]);
      let drag = false;
      const at = (e) => {
        const r = svg.getBoundingClientRect();
        let x = ((e.clientX - r.left) / r.width * 240 - 120) / 100, y = -((e.clientY - r.top) / r.height * 240 - 120) / 100;
        const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; }
        if (Math.hypot(x, y) < 0.06) x = y = 0;   // snaps back to the middle (the sound as loaded)
        mapState[def.id] = [x, y]; set(x, y); edit(false);
      };
      svg.addEventListener("pointerdown", (e) => { drag = true; svg.setPointerCapture(e.pointerId); box.classList.add("on"); newStep(); at(e); });
      svg.addEventListener("pointermove", (e) => { if (drag) at(e); });
      const up = () => { if (!drag) return; drag = false; box.classList.remove("on"); edit(true); };
      svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
      svg.addEventListener("dblclick", () => { delete mapState[def.id]; set(0, 0); edit(true); });
      return { set };
    }
    const tabsEl = $(".tabs"), bigEl = $(".big"), envEl = $(".envbox");
    const TOOLS = [...M.MAPS.filter((x) => x.id !== "mood").map((x) => x.id), "env"];
    function drawTools() {
      makeMap($(".mood"), M.MAPS[0]);
      tabsEl.textContent = "";
      for (const id of TOOLS) {
        const def = M.MAPS.find((x) => x.id === id);
        const b = h("button", id === tool ? "on" : "", def ? def.name : "ENVELOPES");
        const v = mapState[id];
        if ((v && (v[0] || v[1])) || (id === "env" && mapState.env)) b.classList.add("moved");
        b.onclick = () => { tool = id; drawTools(); };
        tabsEl.append(b);
      }
      bigEl.hidden = tool === "env"; envEl.hidden = tool !== "env";
      if (tool === "env") drawEnv(); else makeMap(bigEl, M.MAPS.find((x) => x.id === tool));
      readouts();
    }
    function readouts() {
      const now = edited || preset || L.INIT;
      $(".mread").textContent = M.readout("mood", now);
      $(".bread").textContent = tool === "env" ? "" : M.readout(tool, now);
      tabsEl.querySelectorAll("button").forEach((b, i) => { const id = TOOLS[i], v = mapState[id]; b.classList.toggle("moved", !!((v && (v[0] || v[1])) || (id === "env" && mapState.env))); });
    }
    $(".reset").onclick = () => { newStep(); mapState = {}; edited = null; edit(true); drawTools(); };

    // ---- envelopes you drag: volume (amp) and filter, attack / decay+sustain / release handles
    let envWhich = "amp";
    function drawEnv() {
      envEl.textContent = "";
      const sw = h("div", "envtabs");
      for (const [k, n] of [["amp", "VOLUME"], ["filt", "FILTER"]]) { const b = h("button", k === envWhich ? "on" : "", n); b.onclick = () => { envWhich = k; drawEnv(); }; sw.append(b); }
      envEl.append(sw);
      // the envelope itself, before the maps bend it (BODY and MOOD still work on top of it)
      const now = M.apply(preset || L.INIT, { env: mapState.env });
      const src = envWhich === "amp" ? now.ampEnv : now.filterEnv;
      const e = { ...(envWhich === "amp" ? { a: 0.003, d: 0.3, s: 0.8, r: 0.2 } : { a: 0.001, d: 0.3, s: 0, r: 0.2 }), ...(src || {}) };
      const W = 240, H = 120, SEG = 64, top = 10, bot = H - 14, MAX = { a: 4, d: 8, r: 10 };
      const tx = (t, k) => Math.sqrt(Math.max(0, t) / MAX[k]) * SEG, fx = (x, k) => Math.pow(Math.max(0, Math.min(SEG, x)) / SEG, 2) * MAX[k];
      const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "env" });
      const path = sv("path", { class: "curve" }), fill = sv("path", { class: "fill" });
      svg.append(sv("line", { x1: 0, y1: bot, x2: W, y2: bot, class: "ax" }), fill, path);
      const hA = sv("circle", { r: 7, class: "hd" }), hD = sv("circle", { r: 7, class: "hd" }), hR = sv("circle", { r: 7, class: "hd" });
      svg.append(hA, hD, hR);
      const info = h("p", "eread");
      function draw() {
        const xa = 8 + tx(e.a, "a"), xd = xa + tx(e.d, "d"), ys = bot - (bot - top) * e.s, xs = xd + 34, xr = xs + tx(e.r, "r");
        const d = `M8 ${bot} L${xa} ${top} L${xd} ${ys} L${xs} ${ys} L${xr} ${bot}`;
        path.setAttribute("d", d); fill.setAttribute("d", d + " Z");
        hA.setAttribute("cx", xa); hA.setAttribute("cy", top); hD.setAttribute("cx", xd); hD.setAttribute("cy", ys); hR.setAttribute("cx", xr); hR.setAttribute("cy", bot);
        const ms = (t) => (t < 1 ? Math.round(t * 1000) + " ms" : t.toFixed(2) + " s");
        info.textContent = `attack ${ms(e.a)} \u00b7 decay ${ms(e.d)} \u00b7 sustain ${Math.round(e.s * 100)}% \u00b7 release ${ms(e.r)}`;
        return { xa, xd, xs };
      }
      let g = draw(), drag = null;
      const pt = (ev) => { const r = svg.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H]; };
      const commit = (final) => { mapState.env = mapState.env || {}; mapState.env[envWhich] = { a: e.a, d: e.d, s: e.s, r: e.r }; edit(final); };
      for (const [hd, k] of [[hA, "a"], [hD, "d"], [hR, "r"]]) hd.addEventListener("pointerdown", (ev) => { drag = k; newStep(); svg.setPointerCapture(ev.pointerId); ev.preventDefault(); });
      svg.addEventListener("pointermove", (ev) => {
        if (!drag) return;
        const [x, y] = pt(ev);
        if (drag === "a") e.a = Math.max(0.0005, fx(x - 8, "a"));
        if (drag === "d") { e.d = Math.max(0.005, fx(x - g.xa, "d")); e.s = Math.max(0, Math.min(1, (bot - y) / (bot - top))); }
        if (drag === "r") e.r = Math.max(0.005, fx(x - g.xs, "r"));
        g = draw(); commit(false);
      });
      const up = () => { if (drag) { drag = null; commit(true); } };
      svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
      svg.addEventListener("dblclick", () => {   // back to the sound's own envelope
        if (!mapState.env) return;
        newStep(); delete mapState.env[envWhich]; if (envWhich === "filt") delete mapState.env.filtAmt;
        if (!Object.keys(mapState.env).length) delete mapState.env;
        edit(true); drawEnv();
      });
      envEl.append(svg, info);
      if (envWhich === "filt") {
        const row = h("label", "eamt"), rng = h("input"), f = now.filter || {};
        rng.type = "range"; rng.min = -6; rng.max = 8; rng.step = 0.1; rng.value = f.env == null ? 0 : f.env;
        row.append(h("span", null, "HOW MUCH IT OPENS THE FILTER"), rng);
        let fresh = true;
        rng.oninput = () => { if (fresh) { newStep(); fresh = false; } mapState.env = mapState.env || {}; mapState.env.filtAmt = +rng.value; edit(false); };
        rng.onchange = () => { fresh = true; edit(true); };
        envEl.append(row);
      }
      envEl.append(h("p", "ehint", envWhich === "amp" ? "Drag the dots: how fast it starts, how it settles, how long it rings after you let go. Double-click to put it back." : "The filter's own envelope: each note opens the skin, then it settles. Double-click to put it back."));
    }
    drawTools();

    // ---- playing: each note shakes the blob by how hard the sound is
    function noteOn(p, v = 100) {
      if (!engine) return;
      engine.noteOn(p, v);
      live.held.add(p);
      live.flash = Math.max(live.flash, 0.5 + 0.5 * (v / 127));
      live.kick = 1;
      ripple(0.6 + 0.4 * (v / 127), ((p % 12) / 12) * Math.PI * 2, Math.max(-1, Math.min(1, (p - 60) / 24)));
      keyEl(p, true);
    }
    // water on the skin: each hit starts a ring of waves where it lands (on the side facing you)
    const ripples = [];
    function ripple(amp, a, up) {
      const f = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
      const t1 = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)], t2 = [-Math.sin(cam.pitch) * Math.sin(cam.yaw), Math.cos(cam.pitch), -Math.sin(cam.pitch) * Math.cos(cam.yaw)];
      const k = 0.75, d = f.map((x, i) => x + k * (Math.cos(a) * t1[i] + (Math.sin(a) * 0.6 + up * 0.4) * t2[i]));
      const l = Math.hypot(...d) || 1;
      ripples.push({ d: d.map((x) => x / l), t0: performance.now(), amp });
      while (ripples.length > 6) ripples.shift();
    }
    function noteOff(p) {
      if (!engine) return;
      engine.noteOff(p);
      live.held.delete(p);
      keyEl(p, false);
    }

    // the screen keys: two octaves
    const keysEl = $(".keys");
    const BLACK = [1, 3, 6, 8, 10];
    function drawKeys() {
      keysEl.textContent = "";
      const base = 48 + octave * 12;
      for (let n = base; n < base + 25; n++) {
        const k = h("i", BLACK.includes(n % 12) ? "b" : "w");
        k.dataset.p = n;
        if (n % 12 === 0) k.dataset.c = "C" + (Math.floor(n / 12) - 1);
        if (live.held.has(n)) k.classList.add("on");
        keysEl.append(k);
      }
    }
    function keyEl(p, on) { const k = keysEl.querySelector(`[data-p="${p}"]`); if (k) k.classList.toggle("on", on); }
    drawKeys();
    let mouseNote = null;
    keysEl.addEventListener("pointerdown", (e) => {
      const k = e.target.closest("i"); if (!k) return;
      keysEl.setPointerCapture(e.pointerId);
      mouseNote = +k.dataset.p; noteOn(mouseNote, 100);
    });
    keysEl.addEventListener("pointermove", (e) => {
      if (mouseNote == null) return;
      const k = document.elementFromPoint(e.clientX, e.clientY);
      const p = k && k.closest && k.closest(".blob2 .keys i") ? +k.dataset.p : null;
      if (p != null && p !== mouseNote) { noteOff(mouseNote); mouseNote = p; noteOn(p, 100); }
    });
    const upKey = () => { if (mouseNote != null) { noteOff(mouseNote); mouseNote = null; } };
    keysEl.addEventListener("pointerup", upKey);
    keysEl.addEventListener("pointercancel", upKey);
    root.querySelectorAll(".oct").forEach((b) => (b.onclick = () => { octave = Math.max(-3, Math.min(3, octave + +b.dataset.d)); drawKeys(); }));

    // ---- grab hand (G) and selecting
    function setGrab(on) { grab = on; root.classList.toggle("grabbing", grab); $(".grab").classList.toggle("on", grab); }
    $(".grab").onclick = () => setGrab(!grab);
    function onBlob(x, y) {   // roughly: inside the blob's outline on screen
      const r = cv.getBoundingClientRect(), u = (x - r.left - r.width / 2) / r.height, v = (y - r.top - r.height / 2) / r.height;
      const R = 1.15 + (cur.spkLen || 0) * (cur.spk > 3 ? 0.4 : 0) + (cur.bristles || 0) * 0.25 + (cur.antenna ? 0.6 : 0);
      return Math.hypot(u, v) < (1.25 * R) / Math.sqrt(Math.max(0.5, cam.dist * cam.dist - R * R));
    }
    cv.addEventListener("pointerdown", (e) => {
      listEl.hidden = true;
      if (grab) { cv.setPointerCapture(e.pointerId); dragging = { x: e.clientX, y: e.clientY, t: performance.now() }; cam.vy = cam.vp = 0; return; }
      selected = onBlob(e.clientX, e.clientY);
      root.classList.toggle("unsel", !selected);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y, now = performance.now(), dt = Math.max(1, now - dragging.t);
      cam.yaw -= dx * 0.008; cam.pitch = Math.max(-1.3, Math.min(1.3, cam.pitch + dy * 0.008));
      cam.vy = (-dx * 0.008) / dt * 16; cam.vp = (dy * 0.008) / dt * 16;
      dragging = { x: e.clientX, y: e.clientY, t: now };
    });
    const endDrag = () => { dragging = null; };
    cv.addEventListener("pointerup", endDrag);
    cv.addEventListener("pointercancel", endDrag);
    cv.addEventListener("wheel", (e) => {
      if (!grab) return;
      e.preventDefault();
      cam.dist = Math.max(3.2, Math.min(8, cam.dist * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });

    // ---- computer keys
    const visible = () => root.isConnected && root.getClientRects().length > 0;
    function kd(e) {
      if (!visible() || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // while the sound list is open it gets the keys: Escape closes it, nothing plays or grabs underneath
      if (!listEl.hidden) { if (k === "escape") { listEl.hidden = true; e.preventDefault(); e.stopImmediatePropagation(); } return; }
      if (k === "g") { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) setGrab(!grab); return; }
      if (k === "escape" && grab) { setGrab(false); return; }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { if (root.contains(e.target) || (opts.keys !== false && e.target === document.body)) { e.preventDefault(); next(e.key === "ArrowRight" ? 1 : -1); } return; }
      if (opts.keys === false) return;
      if (k === "z" || k === "x") { e.preventDefault(); octave = Math.max(-3, Math.min(3, octave + (k === "x" ? 1 : -1))); drawKeys(); return; }
      const i = KEYS.indexOf(k);
      if (i < 0) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const p = 60 + octave * 12 + i;
      if (e.repeat || live.held.has(p)) return;
      noteOn(p, 100);
      keyHeld.set(k, p);
    }
    const keyHeld = new Map();
    function ku(e) {
      const k = e.key.toLowerCase();
      if (!keyHeld.has(k)) return;
      noteOff(keyHeld.get(k)); keyHeld.delete(k);
      e.stopImmediatePropagation();
    }
    // the window lost focus while a key was down: its keyup never comes, so let go of everything
    function blur() { for (const p of keyHeld.values()) noteOff(p); keyHeld.clear(); }
    // a click anywhere else closes the sound list
    function away(e) { if (!listEl.hidden && !listEl.contains(e.target) && !$(".name").contains(e.target)) listEl.hidden = true; }
    window.addEventListener("keydown", kd, true);
    window.addEventListener("keyup", ku, true);
    window.addEventListener("blur", blur);
    document.addEventListener("pointerdown", away, true);

    // ---- the frame loop
    const qMax = opts.quality || window.BLOB2_QUALITY || 1;
    let raf = 0, last = performance.now(), scale = qMax, slow = 0, fast = 0, t0 = performance.now(), spkN = 0, spkK = 1, spkWant = 0, spkSince = 0, ph = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!visible()) { last = now; return; }
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      // melt toward the preset's look
      cur = L.blend(cur, target.look, 1 - Math.exp(-dt * 5));
      // the number of spikes can't melt (every spike would hop to a new spot each frame): pull them
      // in, switch the count, grow them back out
      // (and only once the new count has held still for a moment, so dragging a map doesn't keep them pulled in)
      const n0 = Math.round(target.look.spk || 0);
      if (n0 !== spkWant) { spkWant = n0; spkSince = now; }
      const wantN = now - spkSince > 150 || spkN === 0 ? spkWant : spkN;
      if (spkN !== wantN) { spkK -= dt * 5; if (spkK <= 0 || spkN === 0) { spkN = wantN; spkK = 0; } }
      else spkK = Math.min(1, spkK + dt * 4);
      // sound level -> ripples; hits -> a flash and a swell (soft sounds swell, hard ones click)
      const pk = engine && engine.meter ? engine.meter().peak || 0 : live.held.size ? 0.4 : 0;
      live.level += ((Math.min(1, pk * 1.4)) - live.level) * (1 - Math.exp(-dt * (pk > live.level ? 30 : 6)));
      // hits in the sound itself (a song playing the lane, an arp) also start ripples
      live.avg = (live.avg || 0) + (pk - (live.avg || 0)) * (1 - Math.exp(-dt * 3));
      if (pk > 0.08 && pk > (live.avg || 0) * 1.6 + 0.03 && now - (live.lastHit || 0) > 110) { live.lastHit = now; live.flash = Math.max(live.flash, 0.4 + pk * 0.5); ripple(Math.min(1, 0.35 + pk), Math.random() * Math.PI * 2, Math.random() * 2 - 1); }
      live.pump = (live.pump || 0) + (live.level - (live.pump || 0)) * (1 - Math.exp(-dt * 4));
      while (ripples.length && now - ripples[0].t0 > 3500) ripples.shift();
      const wob = target.look.wobble == null ? 0.5 : target.look.wobble;
      const want = live.held.size ? 0.5 + 0.7 * wob : 0;
      live.swell += (want - live.swell) * (1 - Math.exp(-dt * (2 + 10 * (1 - wob))));
      if (live.kick) { live.swell += 0.25 * (1 - wob) + 0.1; live.kick = 0; }
      live.flash *= Math.exp(-dt * 4);
      live.lamp += ((selected ? 1 : 0) - live.lamp) * (1 - Math.exp(-dt * 6));
      if (!dragging) { cam.yaw += cam.vy * dt * 60 + dt * 0.06; cam.pitch = Math.max(-1.3, Math.min(1.3, cam.pitch + cam.vp * dt * 60)); cam.vy *= Math.exp(-dt * 3); cam.vp *= Math.exp(-dt * 3); }
      // size the canvas: drop the resolution when the computer can't keep up (bristles are the heavy ones)
      const r = cv.getBoundingClientRect();
      const dpr = Math.round((meshDraw ? Math.min(2, window.devicePixelRatio || 1) : Math.min(1.25, window.devicePixelRatio || 1) * (1 - 0.2 * Math.min(1, (cur.bristles || 0) * 4))) * scale * 20) / 20;   // in steps, so the canvas isn't resized every frame
      const W = Math.max(64, Math.round(r.width * dpr)), H = Math.max(64, Math.round(r.height * dpr));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const ease = spkK * spkK * (3 - 2 * spkK);
      ph += dt * (cur.speed == null ? 0.5 : cur.speed) * (1 + 2.5 * live.level);   // churns faster while it sounds   // the blob's own clock: a speed change never makes it jump
      const look = { ...cur, spk: spkN, spkLen: (cur.spkLen || 0) * ease, sockets: (cur.sockets || 0) * ease, lamp: live.lamp * 0.9, dark: Math.min(1, (cur.dark || 0) + (1 - live.lamp) * 0.45) };
      r3.draw(look, { t: (now - t0) / 1000, ph, live: { level: live.level, pump: Math.min(1, live.pump * 1.6), hit: live.flash, shimmer: Math.min(1, live.level * 1.3) }, ripples: ripples.map((q) => ({ d: q.d, amp: q.amp, age: (now - q.t0) / 1000 })), yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, level: live.level * (0.6 + 0.8 * wob), swell: live.swell, flash: live.flash });
      if (dt > 0.045) { if (++slow >= 3) { scale = Math.max(Math.min(0.5, qMax), scale * 0.8); slow = 0; } } else slow = 0;
      if (dt < 0.02) { if (++fast > 300 && scale < qMax) { scale = Math.min(qMax, scale * 1.1); fast = 0; } } else fast = 0;
    }
    raf = requestAnimationFrame(frame);

    return {
      noteOn, noteOff, next, setPreset: (p, id) => setPreset(p, id, true), pick,
      get presetId() { return presetId; }, get preset() { return preset; },
      look: () => ({ ...cur }), maps: () => JSON.parse(JSON.stringify(mapState)), edited: () => edited, setTool: (t) => { tool = t; drawTools(); }, measures: () => ({ ...m }), target: () => ({ ...target.look }),
      setEngine(e) { engine = e; if (engine) engine.setPreset(preset || L.INIT); },
      select(on) { selected = !!on; root.classList.toggle("unsel", !selected); },
      grab: setGrab, get grabbing() { return grab; }, camera: () => ({ ...cam }),
      destroy() {
        cancelAnimationFrame(raf);
        clearTimeout(sendWait); sendWait = null; loading++;
        if (r3 && r3.lose) r3.lose();
        window.removeEventListener("keydown", kd, true);
        window.removeEventListener("keyup", ku, true);
        window.removeEventListener("blur", blur);
        document.removeEventListener("pointerdown", away, true);
        for (const p of live.held) if (engine) engine.noteOff(p);
        root.innerHTML = ""; root.classList.remove("blob2", "grabbing", "unsel");
      }
    };
  }

  // A TOY MACHINE engine for the window, on its own page (KILLTOY 2 passes the lane's own).
  async function toyEngine(ctx, wasmUrl, out) {
    const TM = await window.ToyMachine.load(ctx, wasmUrl);
    const s = TM.create({ getTransport: () => ({ bpm: 120, songAt: 0, playing: false }) });
    s.output.connect(out || ctx.destination);
    let cur = null;
    return {
      synth: s,
      setPreset(p, live) { if (p !== cur) { cur = p; if (!live) s.flush("soft"); s.setPreset(p); } },
      noteOn(p, v) { if (ctx.state !== "running") ctx.resume(); s.noteOn(p, v); },
      noteOff(p) { s.noteOff(p); },
      meter: () => s.meter(),
      close() { s.close(); }
    };
  }

  return { mount, toyEngine };
})();
