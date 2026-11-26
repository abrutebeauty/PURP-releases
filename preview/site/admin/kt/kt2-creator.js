// KILLTOY 2: MAKE YOUR GUIDE (Eman, 7 Nov 2026). The creature creator that opens when quest 1 starts.
// Everyone gets their own glossy creature as the guide: Eman's rigged cat (kt2-cat.glb) dressed by
// kt2-creature.js (skin, eyes, pattern, head, ears, horns, halo, face, back, tail, body, legs).
//   - big live 3D creature on the left (turns slowly, drag to spin it, breathes, wags, blinks its parts)
//   - feature tabs + picture tiles on the right; each tile is the creature itself rendered with that choice
//   - name box with a dice for a dark name, RANDOM for a whole new creature, THAT'S ME to finish
// window.KT2Creator.open({ first }) -> Promise<look | null>; the look is saved (localStorage kt2.avatar) and
// the corner cat (kt2-cat.js) wears it right away. Also opens from #creator. KT2_CREATOR_OFF = never opens.
// Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const html = document.documentElement;
  if (window.KT2_CREATOR_OFF) return;
  const H = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const snd = (name, a) => { try { window.KT2Juice && KT2Juice.sound[name] && KT2Juice.sound[name](a); } catch (e) { /* quiet */ } };
  function load(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("no " + src)); document.head.append(s); });
  }

  const css = H("style");
  css.textContent = `
  .kcr { position: fixed; inset: 0; z-index: 2147483100; background: #0e0e11; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(380px, 1fr);
    font-family: Inter, system-ui, sans-serif; color: #fff; animation: kcr-in .35s cubic-bezier(.2,.9,.25,1); }
  @keyframes kcr-in { from { opacity: 0; transform: scale(1.02); } }
  .kcr-stage { position: relative; overflow: hidden; cursor: grab;
    background: radial-gradient(60% 55% at 50% 58%, #2a1c44 0%, #141019 55%, #0e0e11 100%); }
  .kcr-stage:active { cursor: grabbing; }
  .kcr-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 1; }
  .kcr-title, .kcr-name, .kcr-x { z-index: 2; }
  .kcr-floor { position: absolute; left: 50%; bottom: 13%; width: 46%; height: 34px; transform: translateX(-50%); border-radius: 50%;
    background: radial-gradient(closest-side, rgba(155,92,255,.45), rgba(155,92,255,0)); pointer-events: none; }
  .kcr-title { position: absolute; left: 28px; top: 24px; font: 800 12px Inter, sans-serif; letter-spacing: .3em; color: #c9a8ff; }
  .kcr-name { position: absolute; left: 28px; right: 28px; bottom: 28px; display: flex; align-items: center; gap: 10px; justify-content: center; }
  .kcr-name input { width: min(420px, 70%); background: transparent; border: 0; border-bottom: 1px solid #3a3a44; color: #fff; text-align: center;
    font: 900 40px/1.1 Inter, sans-serif; letter-spacing: .12em; text-transform: uppercase; padding: 4px 8px; outline: none; }
  .kcr-name input:focus { border-bottom-color: #c9a8ff; }
  .kcr-btn { background: #17171c; border: 1px solid #2c2c33; color: #fff; font: 800 11px Inter, sans-serif; letter-spacing: .18em; padding: 10px 14px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
  .kcr-btn:hover { border-color: #c9a8ff; }
  .kcr-btn svg { width: 18px; height: 18px; fill: none !important; }
  .kcr-btn svg rect { fill: none !important; stroke: currentColor; }
  .kcr-btn svg circle { fill: currentColor !important; stroke: none; }
  .kcr-side { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; background: #141417; border-left: 1px solid #24242b; min-height: 0; }
  .kcr-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 18px 18px 12px; border-bottom: 1px solid #24242b; }
  .kcr-tab { background: none; border: 1px solid transparent; color: #8a8a96; font: 800 11px Inter, sans-serif; letter-spacing: .16em; padding: 8px 10px; cursor: pointer; }
  .kcr-tab:hover { color: #fff; }
  .kcr-tab.on { color: #fff; border-color: #9b5cff; background: rgba(155,92,255,.14); }
  .kcr-grid { overflow: auto; padding: 16px 18px; display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; align-content: start; }
  .kcr-tile { position: relative; aspect-ratio: 3 / 4; background: #1b1b21; border: 1px solid #2c2c33; cursor: pointer; padding: 0; overflow: hidden;
    transition: transform .12s, border-color .12s; }
  .kcr-tile:hover { transform: translateY(-2px); border-color: #6a6a78; }
  .kcr-tile.on { border-color: #c9a8ff; box-shadow: 0 0 0 1px #c9a8ff, 0 0 22px rgba(155,92,255,.55); }
  .kcr-tile img, .kcr-tile i { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .kcr-tile i { opacity: .55; }
  .kcr-tile b { position: absolute; left: 0; right: 0; bottom: 0; padding: 7px 8px; font: 800 10px Inter, sans-serif; letter-spacing: .16em; text-align: left;
    background: linear-gradient(transparent, rgba(0,0,0,.75)); color: #fff; }
  .kcr-foot { display: flex; gap: 10px; padding: 16px 18px; border-top: 1px solid #24242b; justify-content: space-between; }
  .kcr-done { background: #9b5cff; border-color: #9b5cff; font-size: 13px; padding: 14px 22px; }
  .kcr-done:hover { background: #b07dff; border-color: #fff; }
  .kcr-x { position: absolute; right: 18px; top: 18px; background: none; border: 1px solid #2c2c33; color: #8a8a96; font: 700 10px Inter, sans-serif;
    letter-spacing: .14em; padding: 6px 9px; cursor: pointer; z-index: 2; }
  .kcr-x:hover { color: #fff; border-color: #fff; }
  .kcr-pop { animation: kcr-pop .3s cubic-bezier(.2,1.6,.4,1); }
  @keyframes kcr-pop { 50% { transform: scale(1.06); } }
  html.kcr-open :is(.kc-cv, .kc-hit, .kc-shadow) { visibility: hidden; }
  @media (max-width: 820px) { .kcr { grid-template-columns: 1fr; grid-template-rows: 46vh minmax(0, 1fr); } .kcr-side { border-left: 0; border-top: 1px solid #24242b; }
    .kcr-name input { font-size: 28px; } }
  `;
  const DICE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="16" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>';

  let busy = null;
  async function open(opts) {
    opts = opts || {};
    if (busy) return busy;
    busy = run(opts).finally(() => { busy = null; });
    return busy;
  }

  async function run(opts) {
    if (!window.KT2Creature) await load("kt2-creature.js");
    if (!window.THREE) await load("three.min.js");
    if (!window.THREE.GLTFLoader) await load("three-gltf.js");
    const T = window.THREE, C = window.KT2Creature;
    css.parentNode || document.head.append(css);

    let look = C.load() || Object.assign({}, C.DEFAULT, { name: C.name() });
    if (!look.name) look.name = C.name();

    // ---------------------------------------------------------------- screen
    const root = H("div", "kcr");
    const stage = H("div", "kcr-stage");
    stage.append(H("div", "kcr-floor"), H("div", "kcr-title", "MAKE YOUR GUIDE"));
    const nameRow = H("div", "kcr-name");
    const inp = H("input"); inp.maxLength = 14; inp.value = look.name; inp.spellcheck = false; inp.setAttribute("aria-label", "Name");
    const nameDice = H("button", "kcr-btn"); nameDice.innerHTML = DICE; nameDice.title = "New name";
    nameRow.append(inp, nameDice);
    stage.append(nameRow);
    const side = H("div", "kcr-side");
    const tabs = H("div", "kcr-tabs"), grid = H("div", "kcr-grid"), foot = H("div", "kcr-foot");
    const rnd = H("button", "kcr-btn"); rnd.innerHTML = DICE + "<span>RANDOM</span>";
    const done = H("button", "kcr-btn kcr-done", "THAT'S ME");
    foot.append(rnd, done);
    side.append(tabs, grid, foot);
    const x = H("button", "kcr-x", opts.first ? "SKIP" : "CLOSE");
    stage.append(x);
    root.append(stage, side);
    document.body.append(root);
    html.classList.add("kcr-open");

    // ---------------------------------------------------------------- 3D
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    stage.prepend(renderer.domElement);
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xe8e0ff, 0x1a1024, 1.0));
    const key = new T.DirectionalLight(0xffffff, 1.5); key.position.set(-0.6, 1.2, 1.4); scene.add(key);
    const rim = new T.DirectionalLight(0x9b5cff, 2.2); rim.position.set(1.2, 0.6, -1.2); scene.add(rim);
    const rim2 = new T.DirectionalLight(0xc9a8ff, 1.0); rim2.position.set(-1.4, 0.2, -0.8); scene.add(rim2);
    const cam = new T.PerspectiveCamera(28, 1, 0.1, 50);

    // the model's bytes once, parsed twice: one creature on the stage, one for the tile pictures
    const pack = window.KT2_CAT_PACK;
    const bytes = pack
      ? await fetch(pack).then((r) => r.json()).then((j) => (function (s) { if (window.KT2_B64_OLD) return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); var b = atob(s), n = b.length, u = new Uint8Array(n), i; for (i = 0; i < n; i++) u[i] = b.charCodeAt(i); return u; })(j.b).buffer).catch(() => fetch("kt2-cat.glb").then((r) => r.arrayBuffer()))
      : await fetch("kt2-cat.glb").then((r) => r.arrayBuffer());
    const parse = () => new Promise((res, rej) => new T.GLTFLoader().parse(bytes, "", res, rej));

    // a relaxed stance: arms down (the rig rests in a T-pose), breathing, tail wag, ear flicks
    const B = { armR: "Bone_027", armL: "Bone_032", head: "Bone_023", tail: "Bone_021", tail2: "Bone_019", earL: "Bone_036", earR: "Bone_039", sp: "Bone_004" };
    function rig(body, rend, light) {
      body.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      const bones = {};
      body.updateMatrixWorld(true);
      const bodyInv = new T.Quaternion(); body.getWorldQuaternion(bodyInv); bodyInv.invert();
      for (const [k, n] of Object.entries(B)) {
        const o = body.getObjectByName(n); if (!o) continue;
        const w0 = new T.Quaternion(); o.getWorldQuaternion(w0); w0.premultiply(bodyInv);
        bones[k] = { o, L: o.quaternion.clone(), W0: w0, W0i: w0.clone().invert() };
      }
      const tE = new T.Euler(), tQ = new T.Quaternion();
      const rot = (k, x, y, z) => { const b = bones[k]; if (!b) return; tE.set(x, y, z, "XYZ"); tQ.setFromEuler(tE); b.o.quaternion.copy(b.L).multiply(b.W0i).multiply(tQ).multiply(b.W0); };
      const r = {
        body, dressed: null,
        pose(t) {
          const br = Math.sin(t * 2.2);
          rot("armR", 0, 0, -1.05 + br * 0.04); rot("armL", 0, 0, 1.05 - br * 0.04);
          rot("sp", br * 0.015, 0, 0);
          rot("head", Math.sin(t * 0.9) * 0.05, Math.sin(t * 0.6) * 0.12, Math.sin(t * 0.7) * 0.04);
          rot("tail", 0, Math.sin(t * 1.6) * 0.25, Math.sin(t * 1.6) * 0.12);
          rot("tail2", 0, Math.sin(t * 1.6 - 0.8) * 0.3, 0);
          const tw = Math.max(0, Math.sin(t * 0.7) - 0.92) * 6;
          rot("earL", 0, 0, tw * 0.3); rot("earR", 0, 0, -tw * 0.15);
        },
        wear(l) { r.dressed = C.dress(T, body, l, rend); body.position.y = r.dressed.lift; light.color.set(r.dressed.rim); },
      };
      return r;
    }
    const lights = (sc) => {
      sc.add(new T.HemisphereLight(0xe8e0ff, 0x1a1024, 1.0));
      const k = new T.DirectionalLight(0xffffff, 1.5); k.position.set(-0.6, 1.2, 1.4); sc.add(k);
      const r1 = new T.DirectionalLight(0x9b5cff, 2.2); r1.position.set(1.2, 0.6, -1.2); sc.add(r1);
      const r2 = new T.DirectionalLight(0xc9a8ff, 1.0); r2.position.set(-1.4, 0.2, -0.8); sc.add(r2);
      return r1;
    };
    const turn = new T.Group(); scene.add(turn);
    const main = rig((await parse()).scene, renderer, rim);
    turn.add(main.body);
    const pose = main.pose;
    const wear = (l) => main.wear(l);

    // the tile pictures: their own small renderer + creature, so the stage never flickers
    const tr = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    tr.setPixelRatio(1);
    tr.outputEncoding = T.sRGBEncoding; tr.toneMapping = T.ACESFilmicToneMapping; tr.toneMappingExposure = 1.3;
    tr.setClearColor(0x1b1b21, 1);
    const tscene = new T.Scene();
    const tbody = rig((await parse()).scene, tr, lights(tscene));
    tscene.add(tbody.body);

    // framing per kind of view: [target y, distance, turn]
    const VIEWS = { full: [0.86, 5.6, 0.45], head: [1.0, 4.9, 0.5], face: [0.98, 4.6, 0.2], back: [0.8, 5.4, 2.6] };
    const TVIEWS = { full: [0.86, 5.0, 0.45], head: [1.3, 3.9, 0.5], face: [1.1, 3.0, 0.2], back: [0.8, 5.0, 2.6] };
    let spin = 0.45, spinV = 0, drag = null, view = VIEWS.full, viewY = view[0], viewD = view[1];
    function size() {
      const r = stage.getBoundingClientRect();
      renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix();
    }
    size();
    const ro = new ResizeObserver(size); ro.observe(stage);
    stage.addEventListener("pointerdown", (e) => { if (e.target.closest(".kcr-name")) return; drag = { x: e.clientX, s: spin }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener("pointermove", (e) => { if (!drag) return; const ns = drag.s + (e.clientX - drag.x) * 0.012; spinV = ns - spin; spin = ns; });
    stage.addEventListener("pointerup", () => { drag = null; });

    // ---------------------------------------------------------------- tile pictures: the creature itself with that choice
    const thumbCache = new Map();
    const TW = 180, TH = 240;
    function thumb(l, kind) {
      const k = kind + "|" + JSON.stringify(l);
      if (thumbCache.has(k)) return thumbCache.get(k);
      const v = TVIEWS[kind] || TVIEWS.full;
      tr.setSize(TW, TH, false);
      tbody.wear(l); tbody.pose(1.2); tbody.dressed.tick(0.6);
      const c = new T.PerspectiveCamera(28, TW / TH, 0.1, 50);
      const d = v[1], a = v[2];
      c.position.set(Math.sin(a) * d, v[0] + 0.12, Math.cos(a) * d); c.lookAt(0, v[0], 0);
      tr.render(tscene, c);
      const url = tr.domElement.toDataURL("image/jpeg", 0.85);
      thumbCache.set(k, url);
      if (thumbCache.size > 300) thumbCache.delete(thumbCache.keys().next().value);
      return url;
    }

    let tab = C.FEATURES[0].id;
    const tabBtns = {};
    for (const f of C.FEATURES) {
      const b = H("button", "kcr-tab", f.name);
      b.onclick = () => { if (tab === f.id) return; tab = f.id; snd("tick", 2); paintTabs(); paintGrid(); };
      b.onmouseenter = () => snd("tick", 5);
      tabs.append(b); tabBtns[f.id] = b;
    }
    function paintTabs() { for (const id in tabBtns) tabBtns[id].classList.toggle("on", id === tab); }
    let gridJob = 0;
    function paintGrid() {
      const f = C.FEATURES.find((q) => q.id === tab);
      view = VIEWS[f.view] || VIEWS.full;
      grid.textContent = "";
      const job = ++gridJob;
      const tiles = f.opts.map((o) => {
        const t = H("button", "kcr-tile" + (look[f.id] === o.id ? " on" : ""));
        const sw = H("i"); sw.style.background = o.sw ? (o.sw.length > 1 ? `linear-gradient(160deg, ${o.sw[0]} 30%, ${o.sw[1]})` : o.sw[0]) : "#1b1b21";
        t.append(sw, H("b", null, o.name));
        t.onclick = () => pick(f.id, o.id, t);
        t.onmouseenter = () => snd("tick", 3);
        grid.append(t);
        return [t, o];
      });
      // pictures one by one, so the screen never freezes
      let i = 0;
      const next = () => {
        if (job !== gridJob || !root.isConnected) return;
        if (i >= tiles.length) return;
        const [t, o] = tiles[i++];
        const img = new Image(); img.alt = ""; img.src = thumb(Object.assign({}, look, { [f.id]: o.id, name: "" }), f.view);
        t.prepend(img);
        setTimeout(next, 16);
      };
      setTimeout(next, 30);
    }
    function pick(fid, oid, tile) {
      look = Object.assign({}, look, { [fid]: oid });
      gridJob++;            // stop half-drawn pictures; the grid redraws below
      wear(look);
      snd("pop");
      [...grid.children].forEach((c) => c.classList.toggle("on", c === tile));
      if (tile) { tile.classList.remove("kcr-pop"); void tile.offsetWidth; tile.classList.add("kcr-pop"); }
      hop = 1;
      // the other tabs' pictures show the creature as it is now, the next time they open
    }
    nameDice.onclick = () => { look.name = C.name(); inp.value = look.name; snd("tick", 1); hop = 1; };
    inp.oninput = () => { look.name = inp.value.toUpperCase().replace(/[^A-Z0-9 _\-]/g, ""); if (inp.value !== look.name) inp.value = look.name; };
    rnd.onclick = () => { look = C.random(); inp.value = look.name; wear(look); snd("whoosh"); hop = 1; spinV = 0.35; paintGrid(); };

    // ---------------------------------------------------------------- loop
    let hop = 0, raf = 0, t0 = performance.now(), last = t0;
    wear(look);
    paintTabs(); paintGrid();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - t0) / 1000;
      if (!drag) { spin += spinV; spinV *= 0.92; spin += dt * 0.25; }
      // ease the camera to the tab's view
      viewY += (view[0] - viewY) * (1 - Math.exp(-dt * 5));
      viewD += (view[1] - viewD) * (1 - Math.exp(-dt * 5));
      turn.rotation.y = spin + (view === VIEWS.back ? Math.PI : 0);
      hop += (0 - hop) * (1 - Math.exp(-dt * 7));
      turn.position.y = Math.sin(Math.min(1, hop) * Math.PI) * 0.12;
      turn.scale.set(1 + hop * 0.04, 1 - hop * 0.03, 1 + hop * 0.04);
      pose(t);
      if (main.dressed) main.dressed.tick(t);
      cam.position.set(0, viewY + 0.15, viewD); cam.lookAt(0, viewY, 0);
      renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);

    return await new Promise((resolve) => {
      const close = (out) => {
        cancelAnimationFrame(raf); ro.disconnect();
        root.style.transition = "opacity .25s"; root.style.opacity = "0";
        setTimeout(() => { root.remove(); renderer.dispose(); tr.dispose(); try { tr.forceContextLoss(); renderer.forceContextLoss(); } catch (e) { /* fine */ } html.classList.remove("kcr-open"); }, 260);
        removeEventListener("keydown", onKey, true);
        resolve(out);
      };
      const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(null); } else if (e.target !== inp) e.stopPropagation(); };
      addEventListener("keydown", onKey, true);
      x.onclick = () => { snd("tick", 0); close(null); };
      done.onclick = () => {
        look.name = (inp.value || "").trim().toUpperCase() || C.name();
        C.save(look);
        snd("chime");
        close(look);
      };
    });
  }

  window.KT2Creator = { open };
  // #creator opens it (handy for testing and for changing your guide later)
  const fromHash = () => { if (/^#creator\b/.test(location.hash)) { open({}); try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* fine */ } } };
  addEventListener("hashchange", fromHash);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(fromHash, 800)); else setTimeout(fromHash, 800);
})();
