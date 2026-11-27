// KILLTOY 2: the JAW KITTY (Eman, 16 Nov 2026). Eman's eyeless pink jaw kitty as a rigged 3D character
// in the corner, standing where the drawn head stands, feet on the footer edge. Built in Blender from code
// (tools/jawkitty/build_jawkitty.py): one rig (body, chest, head, ears, arms, legs) plus mouth shapes
// (close, teeth_in, wide, smile, frown), so the mouth really opens and shuts and the teeth + tongue slide
// back inside the head when it closes. Its moods are clips in the model file:
//   idle, talk, hungry, laugh, asleep, sulk, rage, smug, shocked, dance
// What it does by itself:
//   - idles; dances while the song plays (in time with the BPM); falls asleep when nobody touches
//     anything for a minute, and wakes up shocked
//   - talks while the quest / assistant talks (window.ktAvatar.mode / .word, like the drawn head)
//   - rages (red glow in the mouth) when something breaks (a script error on the page)
//   - a click is still a click on the head (talks to the assistant) and makes it chomp or laugh;
//     a right-click opens a small menu to pick a mood by hand
// It replaces the quest cat (kt2-cat.js gets KT2_CAT_OFF). Flags: window.KT2_KITTY_OFF = true or
// localStorage kt2.kitty = "off" = the cat as before. Debug: KT2Kitty.play("rage"), KT2Kitty.list(),
// KT2Kitty.mouth(0..1) holds the mouth (null lets go).
// The model: kt2-kitty.glb, or on the published page window.KT2_KITTY_PACK (JSON { b: base64 }) like the cat.
// V2 (Eman, 16 Nov 22:35: "teeth outside, never closes, doesn't feel alive"): new model (teeth behind the lips,
// lips meet in the middle, the teeth bite together before they tuck in, mouth shut at rest) plus a life layer
// here: the head follows the mouse, squash "blinks", ear flicks, a hop when play starts, the dance locked to
// the song's beat, glossy vinyl reflections and a soft shadow. KT2_KITTY_V1 = true (or localStorage
// kt2.kitty = "v1") = the first kitty exactly as it was (kt2-kitty-v1.glb / window.KT2_KITTY_PACK_V1).
// Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const html = document.documentElement;
  if (!html.classList.contains("kt2")) return;
  let off = !!window.KT2_KITTY_OFF;
  try { off = off || localStorage.getItem("kt2.kitty") === "off"; } catch (e) { /* fine */ }
  if (off) return;
  let V1 = !!window.KT2_KITTY_V1;
  try { V1 = V1 || localStorage.getItem("kt2.kitty") === "v1"; } catch (e) { /* fine */ }
  // V3 behaviour (Eman 17 Nov 02:37): calm and still by default, vibes to the music's mood, sleeps after 5 min with
  // floating zzz, wakes up grumpy and slowly gets up. KT2_KITTY_BEHAVE_OLD = true = the V2c behaviour.
  const OLD = V1 || !!window.KT2_KITTY_BEHAVE_OLD;
  // V3: hide the old head while the kitty downloads, so it doesn't flash first (KT2_KITTY_HEAD_FLASH_OLD = show it)
  if (!window.KT2_KITTY_HEAD_FLASH_OLD) html.classList.add("kt2-kitty-wait");
  window.KT2_CAT_OFF = true;     // one corner character at a time (kt2-cat.js loads after this file)
  if (window.KT2_QUEST_NO_CREATOR === undefined) window.KT2_QUEST_NO_CREATOR = true;   // "make your guide" dresses the cat, not the kitty

  const BW = 200, BH = 200;      // canvas, CSS px
  const FOOT = 186;              // where the feet sit inside the canvas (from the top)
  const K = 62;                  // model units -> px (the kitty is ~1.9 units tall, ~110 px)
  const MOODS = ["idle", "talk", "hungry", "laugh", "asleep", "sulk", "rage", "smug", "shocked", "dance", "tongue", "silly", "crossed", "rest", "groove", "wild", "grumpy"];
  const ONCE = { hungry: 1, laugh: 2, shocked: 1, rage: 2, smug: 1, sulk: 1, tongue: 2, silly: 2, grumpy: 1 };   // loops before going back
  const MUSIC = { dance: 1, groove: 1, wild: 1 };   // clips locked to the beat (one loop = 4 beats)
  const SLEEP_AFTER = OLD ? 60000 : 300000;
  const $ = (s) => document.querySelector(s);

  function load(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("no " + src));
      document.head.append(s);
    });
  }

  const css = document.createElement("style");
  css.textContent = `
  .kk-cv { position: fixed; left: 0; top: 0; width: ${BW}px; height: ${BH}px; pointer-events: none; z-index: 61; will-change: transform; }
  html.kq-on .kk-cv { z-index: 2147483002; }
  :is(html.kt2-kitty, html.kt2-kitty-wait) .kt-ai .kt-av { opacity: 0; }
  .kk-zzz { position: fixed; left: 0; top: 0; width: 1px; height: 1px; pointer-events: none; z-index: 61; display: none;
    font: 700 13px/1 Inter, "Helvetica Neue", sans-serif; color: #cbb6ff; text-shadow: 0 0 6px rgba(140, 90, 255, .8); }
  html.kk-asleep .kk-zzz { display: block; }
  html.kt2-kitty body.at-home .kk-zzz { display: none; }
  .kk-zzz i { position: absolute; left: 0; top: 0; font-style: normal; opacity: 0; animation: kkz 3.6s infinite ease-out; }
  .kk-zzz i:nth-child(2) { animation-delay: 1.2s; font-size: 16px; }
  .kk-zzz i:nth-child(3) { animation-delay: 2.4s; font-size: 20px; }
  @keyframes kkz { 0% { opacity: 0; transform: translate(0, 0) scale(.6); } 15% { opacity: .95; }
    100% { opacity: 0; transform: translate(30px, -54px) scale(1.15) rotate(-8deg); } }
  html.kt2-kitty body.at-home :is(.kk-cv, .kk-shadow) { display: none; }
  .kk-shadow { position: fixed; left: 0; top: 0; width: 70px; height: 10px; margin: -5px 0 0 -35px; border-radius: 50%;
    background: rgba(0,0,0,.55); filter: blur(4px); pointer-events: none; z-index: 60; }
  html.kq-on .kk-shadow { z-index: 2147483001; }
  `;

  async function start() {
    if (!window.THREE) await load("three.min.js");
    if (!window.THREE.GLTFLoader) await load("three-gltf.js");
    const T = window.THREE;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); } catch (e) { return; }
    if (!renderer.getContext()) return;
    const pack = V1 ? window.KT2_KITTY_PACK_V1 : window.KT2_KITTY_PACK;
    const fromFile = () => new Promise((res, rej) => new T.GLTFLoader().load(V1 ? "kt2-kitty-v1.glb" : "kt2-kitty.glb", res, undefined, rej));
    const gltf = pack
      ? await fetch(pack).then((r) => r.json()).then((j) => new Promise((res, rej) => new T.GLTFLoader().parse((function (s) { if (window.KT2_B64_OLD) return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); var b = atob(s), n = b.length, u = new Uint8Array(n), i; for (i = 0; i < n; i++) u[i] = b.charCodeAt(i); return u; })(j.b).buffer, "", res, rej))).catch(fromFile)
      : await fromFile();

    // V2d: draw at up to 3x for clean edges (KT2_KITTY_DPR_OLD = the old 2x cap); the canvas is small so it stays light
    { const d = window.devicePixelRatio || 1; renderer.setPixelRatio(window.KT2_KITTY_DPR_OLD ? Math.min(2, d) : Math.min(3, Math.max(2, d * 1.5))); }
    renderer.setSize(BW, BH, false);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    const cv = renderer.domElement;
    cv.className = "kk-cv";
    const scene = new T.Scene();
    const cam = new T.OrthographicCamera(-BW / 2, BW / 2, FOOT, FOOT - BH, -2000, 2000);
    cam.position.set(0, 0, 500);
    const hemi = new T.HemisphereLight(0xfff0ff, 0x2a1040, 0.6); scene.add(hemi);
    const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(-0.7, 1.2, 1.4); scene.add(key);
    const rim = new T.DirectionalLight(0x9b5cff, 2.4); rim.position.set(1.3, 0.6, -1.2); scene.add(rim);
    const rim2 = new T.DirectionalLight(0xffa8f0, 1.0); rim2.position.set(-1.4, 0.3, -0.8); scene.add(rim2);
    // V2: a tiny photo studio for reflections (soft boxes + purple fill), so the vinyl looks glossy like Eman's picture
    if (!V1) {
      try {
        const env = new T.Scene();
        const room = new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: 0x1a1024, side: T.BackSide }));
        env.add(room);
        const box = (w, h, c, x, y, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
        box(4, 2.5, 0xffffff, -2.5, 3.5, 3);     // big soft box, top left front
        box(2, 3, 0xffb8f4, 4, 0.5, 1);          // pink side light
        box(3, 3, 0x8a4dff, 1, 1, -4.5);         // purple from behind
        box(6, 1, 0x40306a, 0, -4.5, 0);         // floor bounce
        const pm = new T.PMREMGenerator(renderer);
        scene.environment = pm.fromScene(env, 0.035).texture;
        pm.dispose();
        key.intensity = 1.1; rim.intensity = 1.8;
      } catch (e) { /* plain lights are fine */ }
    }

    const root = new T.Group();
    const body = gltf.scene;
    body.scale.setScalar(K);
    root.add(body);
    root.rotation.y = -0.32;     // a little turned toward the page
    scene.add(root);
    const glow = [];             // mouth materials that light up red in a rage
    const skins = [], mats = [];
    body.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const m = o.material;
      if (!m) return;
      m.envMapIntensity = V1 ? 0 : (/Skin/.test(m.name) ? 0.9 : /Teeth/.test(m.name) ? 0.7 : 0.25);
      if (!V1 && /Skin/.test(m.name) && m.roughness != null) m.roughness = Math.min(m.roughness, 0.28);
      if (/Skin/.test(m.name) && skins.indexOf(m) < 0) { skins.push(m); m.userData.k0 = { r: m.roughness, mt: m.metalness, e: m.envMapIntensity }; }
      if (mats.indexOf(m) < 0) { mats.push(m); m.userData.e0 = m.envMapIntensity; }
      if (/Throat|MouthInside|Gum/.test(m.name) && glow.indexOf(m) < 0) { glow.push(m); m.emissive = new T.Color(0xff1830); m.emissiveIntensity = 0; }
    });
    const heads = [];
    body.traverse((o) => { if (o.morphTargetDictionary && o.morphTargetDictionary.close != null) heads.push(o); });

    // V2c: LIGHT (MOODY default, STUDIO = the V2 light) and SKIN looks, picked in the right-click menu and remembered.
    // KT2_KITTY_LIGHT_OLD = true starts on STUDIO.
    const LIGHTS = {
      MOODY: { exp: 0.92, hemi: 0.18, key: [0.75, 0.3, 1.7, 0.6], rim: [3.4, 1.4, 0.9, -1.0], rim2: [1.6, -1.5, 0.2, -0.6], env: 0.55 },
      STUDIO: { exp: 1.0, hemi: 0.6, key: [1.1, -0.7, 1.2, 1.4], rim: [1.8, 1.3, 0.6, -1.2], rim2: [1.0, -1.4, 0.3, -0.8], env: 1 },
    };
    const SKINS = {
      DEEP: (m) => { m.color.setRGB(0.5, 0.36, 0.66); m.roughness = 0.4; m.metalness = 0.55; },   // V2d: Eman's pick (CHROME colour, less shine)
      GLOSS: (m, k) => { m.roughness = k.r; m.metalness = k.mt; },
      SATIN: (m) => { m.roughness = 0.45; m.metalness = 0; },
      MATTE: (m) => { m.roughness = 0.85; m.metalness = 0; },
      CHROME: (m) => { m.roughness = 0.12; m.metalness = 0.85; },
    };
    const look = { light: window.KT2_KITTY_LIGHT_OLD ? "STUDIO" : "MOODY", skin: window.KT2_KITTY_SKIN_OLD ? "GLOSS" : "DEEP" };
    try { const l = localStorage.getItem("kt2.kitty.light"), k = localStorage.getItem("kt2.kitty.skin2"); if (LIGHTS[l]) look.light = l; if (SKINS[k]) look.skin = k; } catch (e) { /* fine */ }
    function setLight(n) {
      const L = LIGHTS[n]; if (!L || V1) return;
      look.light = n; renderer.toneMappingExposure = L.exp; hemi.intensity = L.hemi;
      [[key, L.key], [rim, L.rim], [rim2, L.rim2]].forEach(([o, v]) => { o.intensity = v[0]; o.position.set(v[1], v[2], v[3]); });
      for (const m of mats) m.envMapIntensity = (m.userData.e0 || 0) * L.env * (look.skin === "CHROME" && /Skin/.test(m.name) ? 1.8 : 1);
      try { localStorage.setItem("kt2.kitty.light", n); } catch (e) { /* fine */ }
    }
    function setSkin(n) {
      if (!SKINS[n] || V1) return;
      look.skin = n;
      for (const m of skins) { m.color.setRGB(1, 1, 1); SKINS[n](m, m.userData.k0); m.needsUpdate = true; }
      try { localStorage.setItem("kt2.kitty.skin2", n); } catch (e) { /* fine */ }
      setLight(look.light);
    }
    setSkin(look.skin);

    const mixer = new T.AnimationMixer(body);
    const acts = {};
    for (const c of gltf.animations) {
      const a = mixer.clipAction(c);
      a.enabled = true; a.setLoop(T.LoopRepeat, Infinity);
      acts[c.name] = a;
    }
    if (!acts.idle) throw new Error("model has no idle clip");

    css.parentNode || document.head.append(css);
    const shadow = document.createElement("div"); shadow.className = "kk-shadow";
    if (!V1) document.body.append(shadow);
    const zzz = document.createElement("div"); zzz.className = "kk-zzz"; zzz.innerHTML = "<i>z</i><i>z</i><i>Z</i>";
    if (!OLD) document.body.append(zzz);
    document.body.append(cv);
    html.classList.add("kt2-kitty");

    // ---------------------------------------------------------------- moods
    const st = { cur: null, base: "idle", once: null, onceEnd: 0, talk: false, word: 0, lastInput: performance.now(), hold: null, rage: 0, bpm: 120 };
    function fadeTo(name, secs) {
      const a = acts[name];
      if (!a || st.cur === name) return;
      const prev = st.cur && acts[st.cur];
      a.reset(); a.setEffectiveWeight(1); a.play();
      if (prev) prev.crossFadeTo(a, secs == null ? 0.3 : secs, false);
      st.cur = name;
    }
    function play(name) {     // a one-off mood; goes back to the base mood after ONCE[name] loops
      if (!acts[name]) return false;
      if (ONCE[name]) { st.once = name; st.onceEnd = performance.now() + acts[name].getClip().duration * 1000 * ONCE[name] / Math.max(0.25, timeScaleOf(name)); }
      else { st.once = null; st.base = name; st.pinned = name !== (OLD ? "idle" : "rest"); }
      if (name === "rage") st.rage = 1;
      fadeTo(name, 0.2);
      return true;
    }
    function timeScaleOf(name) { return name === "dance" ? st.bpm / 120 : 1; }
    // ui is a top-level let in app.js: reachable by name, not as window.ui
    const U = () => { try { return ui; } catch (e) { return null; } };
    function playing() { const u = U(); return !!(u && u.transport && u.transport.playing); }

    function pickBase(now) {
      if (st.pinned) return st.base;
      if (!OLD) {
        if (st.talk || html.classList.contains("kq-talk")) return "talk";
        if (playing()) return vibe.mood;
        if (now - st.lastInput > SLEEP_AFTER) return "asleep";
        return acts.rest ? "rest" : "idle";
      }
      if (st.talk || html.classList.contains("kq-talk")) return "talk";
      if (playing()) return "dance";
      if (now - st.lastInput > SLEEP_AFTER) return "asleep";
      return "idle";
    }
    const wake = () => {
      const now = performance.now();
      if (st.cur === "asleep" && !st.pinned) { st.lastInput = now; play(!OLD && acts.grumpy ? "grumpy" : "shocked"); }
      st.lastInput = now;
    };
    addEventListener("pointerdown", wake, true);
    if (!OLD) addEventListener("pointermove", wake, { capture: true, passive: true });   // V3: moving the mouse counts too
    addEventListener("keydown", wake, true);
    addEventListener("wheel", wake, { capture: true, passive: true });
    addEventListener("error", () => { if (st.cur !== "rage") play("rage"); });

    // the kitty answers clicks on the head spot (the head button is still there, just invisible)
    function onHead(e) {
      const av = e.target && e.target.closest && e.target.closest(".kt-ai .kt-av");
      if (!av) return;
      if (e.type === "contextmenu") {
        e.preventDefault(); e.stopPropagation();
        if (typeof showMenu === "function") {
          showMenu(av, [{ heading: "MOOD" }].concat(MOODS.map((m) => ({ label: m.toUpperCase(), on: st.cur === m, run: () => play(m) })),
            [{ sep: true }, { label: "AUTO", on: !st.pinned, run: () => { st.pinned = false; st.once = null; } }],
            V1 ? [] : [{ heading: "LIGHT" }].concat(Object.keys(LIGHTS).map((n) => ({ label: n, on: look.light === n, run: () => setLight(n) })),
              [{ heading: "SKIN" }], Object.keys(SKINS).map((n) => ({ label: n, on: look.skin === n, run: () => setSkin(n) })))));
        }
        return;
      }
      if (!st.pinned) { const r = Math.random(), pick = V1 || !acts.tongue ? (r < 0.5 ? "hungry" : "laugh") : ["hungry", "laugh", "tongue", "silly"][Math.floor(r * 4)]; play(pick); }
    }
    document.addEventListener("click", onHead, true);
    document.addEventListener("contextmenu", onHead, true);

    // ---------------------------------------------------------------- talking (assistant.js / the quest)
    const old = window.ktAvatar || {};
    window.ktAvatar = {
      mode(m) { st.talk = m === "speaking"; try { old.mode && old.mode(m); } catch (e) { /* fine */ } },
      word() { st.word = 1; try { old.word && old.word(); } catch (e) { /* fine */ } },
    };

    // ---------------------------------------------------------------- V2 life layer (on top of the clips)
    const bone = (n) => body.getObjectByName(n);
    const B2 = { head: bone("head"), earL: bone("earL") || bone("ear.L"), earR: bone("earR") || bone("ear.R") };
    const life = { mx: null, my: null, moved: -1e9, yaw: 0, pitch: 0, sq: 0, nextSq: 2000, earL: 0, earR: 0, nextEar: 3000, hop: 0, hopV: 0, wasPlaying: false, glance: 0, nextGlance: 4000 };
    addEventListener("pointermove", (e) => { life.mx = e.clientX; life.my = e.clientY; life.moved = performance.now(); }, { passive: true });
    const qa = new T.Quaternion(), qb = new T.Quaternion(), ax = new T.Vector3(), ay = new T.Vector3(0, 1, 0), axX = new T.Vector3(1, 0, 0), axZ = new T.Vector3(0, 0, 1);
    // ---------------------------------------------------------------- V3: listening to the music's mood
    // One analyser on the master (like kt2-alive.js). Soft music with little bass = "groove" (calm sway), normal = "dance",
    // hard bass with punchy kicks = "wild" (headbang, tongue out). Changes only after the new mood holds ~2.5 s.
    const vibe = { an: null, ctx: null, spec: null, e: 0.45, mood: "dance", cand: "dance", candAt: 0, bSlow: 0, punch: 0, lvl: 0 };
    function listen(now, dt) {
      if (window.KT2_KITTY_VIBE && acts[window.KT2_KITTY_VIBE]) { vibe.mood = window.KT2_KITTY_VIBE; return; }
      const d = window.purpPlaygroundDebug;
      if (!d || !d.ctx || !d.masterOut) return;
      if (!vibe.an || vibe.ctx !== d.ctx) {
        try {
          vibe.ctx = d.ctx; const a = d.ctx.createAnalyser(); a.fftSize = 1024; a.smoothingTimeConstant = 0.4;
          d.masterOut.connect(a); vibe.an = a; vibe.spec = new Uint8Array(a.frequencyBinCount);
          const hz = d.ctx.sampleRate / a.fftSize;
          vibe.b0 = Math.max(1, Math.round(35 / hz)); vibe.b1 = Math.max(vibe.b0 + 1, Math.round(150 / hz));
          vibe.m0 = Math.round(250 / hz); vibe.m1 = Math.round(2500 / hz); vibe.h1 = Math.min(a.frequencyBinCount - 1, Math.round(9000 / hz));
        } catch (e) { vibe.an = null; return; }
      }
      const sp = vibe.spec; vibe.an.getByteFrequencyData(sp);
      const avg = (a, b) => { let t = 0; for (let i = a; i <= b; i++) t += sp[i]; return t / (b - a + 1) / 255; };
      const bass = avg(vibe.b0, vibe.b1), mid = avg(vibe.m0, vibe.m1), hi = avg(vibe.m1, vibe.h1);
      const lvl = bass * 0.5 + mid * 0.35 + hi * 0.15;
      vibe.lvl = lvl;
      if (lvl < 0.012) return;                                 // silence between notes: keep the mood
      vibe.bSlow += (bass - vibe.bSlow) * (1 - Math.exp(-dt / 0.6));
      vibe.punch += (Math.max(0, bass - vibe.bSlow) * 4 - vibe.punch) * (1 - Math.exp(-dt / 1.2));
      let score = 1.25 * bass + 1.2 * vibe.punch + 0.25 * hi - 0.5 * Math.max(0, mid - bass) - 0.15;
      if (st.bpm < 90) score -= 0.12; else if (st.bpm > 135) score += 0.06;
      vibe.e += (Math.max(0, Math.min(1, score)) - vibe.e) * (1 - Math.exp(-dt / 2.5));
      const cur = vibe.mood, e = vibe.e;
      const want = e < (cur === "groove" ? 0.36 : 0.30) ? "groove" : e > (cur === "wild" ? 0.58 : 0.64) ? "wild" : "dance";
      if (want !== vibe.cand) { vibe.cand = want; vibe.candAt = now; }
      if (want !== cur && now - vibe.candAt > 2500) vibe.mood = want;
    }

    function alive(now, dt) {
      const m = st.cur;
      if (!OLD) return calm(now, dt);
      // V2c: sticks its tongue out now and then while awake and idle, and when the song starts
      if (!st.pinned && !st.once && m === "idle" && acts.tongue) {
        if (!life.nextBlep) life.nextBlep = now + 15000 + Math.random() * 20000;
        if (now > life.nextBlep) { life.nextBlep = now + 20000 + Math.random() * 30000; play(Math.random() < 0.6 ? "tongue" : "silly"); }
      }
      // the head follows the mouse while it moves near; otherwise it glances around now and then
      let ty = 0, tp = 0;
      if (life.mx != null && now - life.moved < 2500 && (m === "idle" || m === "talk" || m === "dance")) {
        ty = Math.max(-1, Math.min(1, (life.mx - spot.x) / 500)) * 0.55 + 0.32;
        tp = Math.max(-1, Math.min(1, (life.my - (spot.y - 80)) / 400)) * 0.3;
      } else if (m === "idle") {
        if (now > life.nextGlance) { life.glance = (Math.random() - 0.5) * 1.0; life.nextGlance = now + 2500 + Math.random() * 4000; }
        ty = life.glance;
      }
      const k = 1 - Math.exp(-dt * 6);
      life.yaw += (ty - life.yaw) * k; life.pitch += (tp - life.pitch) * k;
      if (B2.head) { qa.setFromAxisAngle(ay, life.yaw); qb.setFromAxisAngle(axX, life.pitch); B2.head.quaternion.multiply(qa).multiply(qb); }
      // squash "blink": no eyes, so the whole kitty squeezes for a moment
      if (now > life.nextSq && m !== "asleep") { life.sq = 1; life.nextSq = now + 2500 + Math.random() * 4500; }
      life.sq = Math.max(0, life.sq - dt * 7);
      const s = Math.sin(life.sq * Math.PI) * 0.06;
      // a hop when the song starts, a small settle when it stops
      const p = playing();
      if (p && !life.wasPlaying) life.hopV = 2.6;
      if (!p && life.wasPlaying) life.sq = 1;
      life.wasPlaying = p;
      life.hopV -= dt * 14; life.hop = Math.max(0, life.hop + life.hopV * dt); if (life.hop === 0 && life.hopV < 0) life.hopV = 0;
      root.scale.set(1 + s * 0.8, 1 - s, 1 + s * 0.8);
      root.position.y = life.hop * K * 0.4;
      // ear flicks
      if (now > life.nextEar) { if (Math.random() < 0.5) life.earL = 1; else life.earR = 1; life.nextEar = now + 2000 + Math.random() * 5000; }
      life.earL = Math.max(0, life.earL - dt * 5); life.earR = Math.max(0, life.earR - dt * 5);
      if (B2.earL) { qa.setFromAxisAngle(axZ, Math.sin(life.earL * Math.PI) * 0.45); B2.earL.quaternion.multiply(qa); }
      if (B2.earR) { qa.setFromAxisAngle(axZ, -Math.sin(life.earR * Math.PI) * 0.45); B2.earR.quaternion.multiply(qa); }
      shadow.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px) scale(${(1 - life.hop * 0.8).toFixed(2)})`;
      shadow.style.opacity = String(1 - life.hop * 1.5);
    }
    // V3 life layer: calmer and rarer than V2 (Eman: "stand more still casually most of the time")
    function calm(now, dt) {
      const m = st.cur;
      if (playing()) listen(now, dt);
      // a fidget gives way at once to talking, music or a mood someone picked
      if (life.fidget && st.once === life.fidget && (st.talk || html.classList.contains("kq-talk") || playing() || st.pinned)) st.once = null;
      if (st.once !== life.fidget) life.fidget = null;
      // now and then, while resting: the old idle (opens its mouth, bites shut) or a rare blep
      if (!st.pinned && !st.once && m === "rest") {
        if (!life.nextFidget) life.nextFidget = now + 40000 + Math.random() * 40000;
        if (now > life.nextFidget) {
          life.nextFidget = now + 45000 + Math.random() * 60000;
          const f = Math.random() < 0.7 ? "idle" : (Math.random() < 0.5 ? "tongue" : "silly");
          st.once = f; st.onceEnd = now + acts[f].getClip().duration * 1000; life.fidget = f;
          fadeTo(f, 0.5);
        }
      }
      // the head turns slowly toward the mouse when it is near; otherwise it rests
      let ty = 0.32 * 0, tp = 0;
      const near = life.mx != null && now - life.moved < 2500 && Math.abs(life.mx - spot.x) < 700 && Math.abs(life.my - spot.y) < 500;
      if (near && (m === "rest" || m === "idle" || m === "talk")) {
        ty = Math.max(-1, Math.min(1, (life.mx - spot.x) / 600)) * 0.35 + 0.2;
        tp = Math.max(-1, Math.min(1, (life.my - (spot.y - 80)) / 500)) * 0.15;
      }
      const k = 1 - Math.exp(-dt * 2.2);
      life.yaw += (ty - life.yaw) * k; life.pitch += (tp - life.pitch) * k;
      if (B2.head && Math.abs(life.yaw) + Math.abs(life.pitch) > 1e-4) { qa.setFromAxisAngle(ay, life.yaw); qb.setFromAxisAngle(axX, life.pitch); B2.head.quaternion.multiply(qa).multiply(qb); }
      // a slow, small squash now and then (no eyes, so this is its blink)
      if (now > life.nextSq && (m === "rest" || m === "idle")) { life.sq = 1; life.nextSq = now + 7000 + Math.random() * 9000; }
      life.sq = Math.max(0, life.sq - dt * 4);
      const s = Math.sin(life.sq * Math.PI) * 0.03;
      const p = playing();
      if (p && !life.wasPlaying) life.hopV = 1.8;
      life.wasPlaying = p;
      life.hopV -= dt * 14; life.hop = Math.max(0, life.hop + life.hopV * dt); if (life.hop === 0 && life.hopV < 0) life.hopV = 0;
      root.scale.set(1 + s * 0.8, 1 - s, 1 + s * 0.8);
      root.position.y = life.hop * K * 0.4;
      // a rare ear flick
      if (now > life.nextEar && (m === "rest" || m === "idle")) { if (Math.random() < 0.5) life.earL = 1; else life.earR = 1; life.nextEar = now + 6000 + Math.random() * 10000; }
      life.earL = Math.max(0, life.earL - dt * 4); life.earR = Math.max(0, life.earR - dt * 4);
      if (B2.earL && life.earL > 0) { qa.setFromAxisAngle(axZ, Math.sin(life.earL * Math.PI) * 0.3); B2.earL.quaternion.multiply(qa); }
      if (B2.earR && life.earR > 0) { qa.setFromAxisAngle(axZ, -Math.sin(life.earR * Math.PI) * 0.3); B2.earR.quaternion.multiply(qa); }
      shadow.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px) scale(${(1 - life.hop * 0.8).toFixed(2)})`;
      shadow.style.opacity = String(1 - life.hop * 1.5);
      // zzz while asleep, floating up from the head
      html.classList.toggle("kk-asleep", m === "asleep");
      if (m === "asleep") zzz.style.transform = `translate(${Math.round(spot.x + 18)}px, ${Math.round(spot.y - 120)}px)`;
    }
    // V3: the music clips follow the song smoothly: run at the song's tempo and gently pull toward the beat
    // (V2 set the time straight from the transport each frame, which stuttered when the position updated in steps)
    function musicSync() {
      const a = acts[st.cur];
      if (!a || !MUSIC[st.cur]) return;
      const u = U(), rate = st.bpm / 120, dur = a.getClip().duration;
      if (!u || !u.transport || !u.transport.playing) { a.timeScale = rate; return; }
      const beats = (+u.transport.position || 0) * st.bpm / 60, want = (beats % 4) / 4;
      let err = want - (a.time % dur) / dur; err -= Math.round(err);
      if (Math.abs(err) > 0.3) { a.time = want * dur; a.timeScale = rate; }
      else a.timeScale = rate * (1 + Math.max(-0.25, Math.min(0.25, err * 3)));
    }
    // the dance is locked to the song: one loop = 4 beats, started on the beat
    function beatSync() {
      const u = U(), a = acts.dance;
      if (!a || !u || !u.transport || st.cur !== "dance") return false;
      const beats = (+u.transport.position || 0) * st.bpm / 60;
      a.timeScale = 0;
      a.time = ((beats % 4) / 4) * a.getClip().duration;
      return true;
    }

    // ---------------------------------------------------------------- frame
    let last = performance.now();
    const spot = { x: innerWidth - 80, y: innerHeight - 220 };
    function place() {
      const av = $(".kt-ai .kt-av");
      const r = av && av.getBoundingClientRect();
      if (r && r.width > 0) { spot.x = r.left + r.width / 2; spot.y = r.bottom; }
      const rk = $("#rack"), f = rk && rk.getBoundingClientRect();   // feet on the footer edge, like the cat sat
      if (f && f.width && f.top < innerHeight - 20 && Math.abs(f.top - spot.y) < 80) spot.y = f.top + 2;
      cv.style.transform = `translate(${Math.round(spot.x - BW / 2)}px, ${Math.round(spot.y - FOOT)}px)`;
    }
    // Speed pass 27 Nov: the 3D kitty was drawn 60 times a second with full antialiasing, the biggest constant
    // graphics cost in the app (in the cloud test it slowed a 100-pattern drag from 46 to 943 ms per move).
    // Now it draws 30 times a second (its moves are slow, so they look the same) and holds still while a mouse
    // button is down and for 0.4 s after a click or key, so drags, knob turns and clicks get the whole machine.
    // KT2_KITTY_FAST_OLD = always 60 a second.
    let kkDown = false, kkLast = 0, kkUntil = 0;
    const kkMine = function (e) { return !!(e && e.target && e.target.closest && e.target.closest(".kt-ai")); };   // the kitty's own head spot answers at once
    const kkRest = function (e) { kkDown = false; if (!kkMine(e)) kkUntil = performance.now() + 400; };
    addEventListener("pointerdown", function (e) { if (!kkMine(e)) kkDown = true; }, true);
    addEventListener("pointerup", kkRest, true);
    addEventListener("pointercancel", kkRest, true);
    addEventListener("keydown", kkRest, true);
    addEventListener("blur", function () { kkDown = false; });
    function frame(now) {
      requestAnimationFrame(frame);
      if (!window.KT2_KITTY_FAST_OLD && (kkDown || now < kkUntil || now - kkLast < 30)) return;
      kkLast = now;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (document.hidden || document.body.classList.contains("at-home")) return;
      { const u = U(); st.bpm = (u && u.state && +u.state.bpm) || 120; }
      if (st.once && now > st.onceEnd) st.once = null;
      const want = st.once || pickBase(now);
      fadeTo(want, OLD ? null : (MUSIC[want] && MUSIC[st.cur] ? 0.8 : want === "asleep" ? 1.5 : want === "rest" ? 0.6 : null));
      if (!OLD) musicSync();
      else if (acts.dance && (V1 || !beatSync())) acts.dance.timeScale = timeScaleOf("dance");
      mixer.update(dt);
      if (!V1) alive(now, dt);
      // a held mouth (KT2Kitty.mouth) or the bounce of each spoken word goes on top of the clip
      st.word = Math.max(0, st.word - dt * 6);
      if (st.hold != null || st.word > 0) {
        const c = st.hold != null ? st.hold : Math.max(0, 0.7 - st.word);
        for (const h of heads) {
          const d = h.morphTargetDictionary, w = h.morphTargetInfluences;
          w[d.close] = c;
          if (d.teeth_in != null) w[d.teeth_in] = V1 ? Math.max(0, c - 0.6) * 2.5 : Math.max(0, Math.min(1, (c - 0.86) / 0.12));
        }
      }
      st.rage = st.cur === "rage" ? Math.min(1, st.rage + dt * 4) : Math.max(0, st.rage - dt * 2);
      for (const m of glow) m.emissiveIntensity = st.rage * (0.7 + 0.3 * Math.sin(now / 60));
      place();
      renderer.render(scene, cam);
    }
    fadeTo(!OLD && acts.rest ? "rest" : "idle", 0);
    requestAnimationFrame(frame);

    window.KT2Kitty = {
      play, list: () => Object.keys(acts),
      mood: () => st.cur,
      auto: () => { st.pinned = false; st.once = null; },
      mouth: (v) => { st.hold = v == null ? null : Math.max(0, Math.min(1, +v)); },
      sleepNow: () => { st.lastInput = -1e9; },
      _st: st, v1: V1, old: OLD, vibe: () => ({ mood: vibe.mood, e: +vibe.e.toFixed(3), lvl: +vibe.lvl.toFixed(3) }), look: () => Object.assign({}, look), light: setLight, skin: setSkin,
      weights: () => { const h = heads[0]; if (!h) return null; const o = {}; for (const n in h.morphTargetDictionary) o[n] = +h.morphTargetInfluences[h.morphTargetDictionary[n]].toFixed(3); return o; },
    };
  }

  const go = () => start().then(() => { if (!window.KT2Kitty) html.classList.remove("kt2-kitty-wait"); }).catch((e) => { console.warn("[kitty] not shown:", e && e.message); html.classList.remove("kt2-kitty"); html.classList.remove("kt2-kitty-wait"); });
  // Speed pass round 2 (27 Nov): the kitty (4 MB with its 3D engine) is a second-wave download: it comes once the
  // page has loaded and is quiet, so the editor is ready first. KT2_WAVE2_OLD = 0.3 s after the page is read, like before.
  if (window.KT2_WAVE2_OLD) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(go, 300)); else setTimeout(go, 300); }
  else {
    const later = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 3000 }) : go()), 500);
    if (document.readyState === "complete") later(); else addEventListener("load", later, { once: true });
  }
})();
