// KILLTOY 2: the quest cat (Eman, 7 Nov 2026). Eman's rigged Meshy cat (kt2-cat.glb, "Starry Night
// Cat", 52 bones, no animation clips) replaces the drawn head in the corner. It lives in the DAW:
//   - idles sitting on the top edge of the footer, legs dangling, looking around, tail swaying
//   - when the quest ring (.kq-ring, "the arrow") shows up or moves, it stands, looks at it and
//     runs / jumps across the UI (footer, INST + FX cards, patterns) to get next to it; when it
//     cannot reach the ring it stands under it and points up at it
//   - now and then it goes on a trip by itself: hops up onto the INST card or a pattern, walks
//     along it, looks around and jumps back down to the side (never onto the patterns in the playground)
//   - it faces you and bobs while the quest talks; the quest bubble follows it
//   - a click on the cat is a click on the old head (talks to the assistant) plus a happy hop
// All motion is made here in code from the bones (no clips needed); the GLB file has none.
// Flags: window.KT2_CAT_OFF = true, or localStorage kt2.cat = "off", brings back the old head
// (kt2-avatar.js). Loads three.min.js + three-gltf.js itself, only when the cat is on.
// Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const html = document.documentElement;
  if (!html.classList.contains("kt2")) return;
  let off = !!window.KT2_CAT_OFF;
  try { off = off || localStorage.getItem("kt2.cat") === "off"; } catch (e) { /* fine */ }
  if (off) return;

  const K = 60;                 // model units -> CSS px (the cat is 1.7 units tall, ~88 px)
  const BW = 240, BH = 240;     // the cat's canvas, moved around with the cat
  const OX = BW / 2, OY = 180;  // where the cat's feet sit inside that canvas
  const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const $ = (s, r) => (r || document).querySelector(s);

  function load(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("no " + src));
      document.head.append(s);
    });
  }

  const css = document.createElement("style");
  css.textContent = `
  .kc-cv { position: fixed; left: 0; top: 0; width: ${BW}px; height: ${BH}px; pointer-events: none; z-index: 61; will-change: transform; }
  .kc-hit { position: fixed; left: 0; top: 0; width: 56px; height: 80px; z-index: 62; cursor: pointer; background: none; border: 0; padding: 0; }
  .kc-shadow { position: fixed; left: 0; top: 0; width: 54px; height: 8px; margin: -4px 0 0 -27px; border-radius: 50%;
    background: rgba(0,0,0,.5); filter: blur(3px); pointer-events: none; z-index: 60; }
  html.kt2-cat .kt-ai .kt-av { opacity: 0; pointer-events: none; }
  html.kq-on .kc-cv, html.kq-on .kc-hit { z-index: 2147483002; }
  html.kq-on .kc-shadow { z-index: 2147483001; }
  html.kt2-cat.kq-on.kq-talk .kt-ai { transform: none; }
  html.kt2-cat body.at-home :is(.kc-cv, .kc-hit, .kc-shadow) { display: none; }
  html.kt2-cat .kq-bub.kc-noarrow::after { display: none; }
  html.kt2-cat .kq-bub.kc-flip::after { right: auto; left: -9px; border-right: 0; border-top: 0;
    border-left: 1px solid #c9a8ff; border-bottom: 1px solid #c9a8ff; }
  `;

  // ---------------------------------------------------------------- bones (Meshy Smart Rig names)
  const B = {
    hips: "Bone_000", pelvis: "Bone_001", sp1: "Bone_005", sp2: "Bone_004", sp3: "Bone_003", chest: "Bone_002",
    head: "Bone_023", crown: "Bone_022",
    earL1: "Bone_036", earL2: "Bone_035", earR1: "Bone_039", earR2: "Bone_038",
    clavR: "Bone_028", armR: "Bone_027", foreR: "Bone_026", wristR: "Bone_025",
    clavL: "Bone_033", armL: "Bone_032", foreL: "Bone_031", wristL: "Bone_030",
    thighR: "Bone_010", shinR: "Bone_009", ankleR: "Bone_008", footR: "Bone_007",
    thighL: "Bone_015", shinL: "Bone_014", ankleL: "Bone_013", footL: "Bone_012",
    tail1: "Bone_021", tail2: "Bone_020", tail3: "Bone_019", tail4: "Bone_018", tail5: "Bone_017",
  };
  // In model space the cat faces +z, up is +y, its right hand is +x.
  // A rotation of +x tips a bone's top forward (toward you) and swings a leg backward.

  async function start() {
    if (!window.THREE) await load("three.min.js");
    if (!window.THREE.GLTFLoader) await load("three-gltf.js");
    const T = window.THREE;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); } catch (e) { return; }
    if (!renderer.getContext()) return;
    // The published page is at its size cap, so there the model comes as base64 in a JSON asset (window.KT2_CAT_PACK)
    const pack = window.KT2_CAT_PACK;
    const fromFile = () => new Promise((res, rej) => new T.GLTFLoader().load("kt2-cat.glb", res, undefined, rej));
    const gltf = pack
      ? await fetch(pack).then((r) => r.json()).then((j) => new Promise((res, rej) => new T.GLTFLoader().parse(Uint8Array.from(atob(j.b), (c) => c.charCodeAt(0)).buffer, "", res, rej))).catch(fromFile)
      : await fromFile();

    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(BW, BH, false);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.localClippingEnabled = true;
    // sitting on an edge, whatever is below the edge AND behind the cat's back is hidden, so the
    // tail hangs down behind the footer (Eman, 7 Nov) while the legs dangle in front of it
    const behind = [new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Plane(new T.Vector3(0, 0, 1), -6)];
    const cv = renderer.domElement;
    cv.className = "kc-cv";
    const scene = new T.Scene();
    const cam = new T.OrthographicCamera(-OX, BW - OX, OY, OY - BH, -2000, 2000);
    cam.position.set(0, 0, 500);
    scene.add(new T.HemisphereLight(0xe8e0ff, 0x1a1024, 1.0));
    const key = new T.DirectionalLight(0xffffff, 1.5); key.position.set(-0.6, 1.2, 1.4); scene.add(key);
    const rim = new T.DirectionalLight(0x9b5cff, 2.2); rim.position.set(1.2, 0.6, -1.2); scene.add(rim);
    const rim2 = new T.DirectionalLight(0xc9a8ff, 1.0); rim2.position.set(-1.4, 0.2, -0.8); scene.add(rim2);

    const root = new T.Group();          // screen position + facing
    const body = gltf.scene;             // model units, scaled to px
    body.scale.setScalar(K);
    root.add(body);
    scene.add(root);
    const mats = [];
    body.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        const m = o.material;
        if (m) { m.envMapIntensity = 0; if (m.roughness != null) m.roughness = Math.max(m.roughness, 0.35); m.clipIntersection = true; mats.push(m); }
      }
    });

    // the person's own creature (kt2-creator.js / kt2-creature.js): skin, horns, ears... on this same rig.
    // A new look arrives live with the "kt2-avatar" event. KT2_CAT_PLAIN = Eman's cat as it was.
    let dressed = null;
    function wear(look) {
      if (!window.KT2Creature || !look || window.KT2_CAT_PLAIN) return;
      try {
        dressed = window.KT2Creature.dress(T, body, look, renderer);
        body.position.y = dressed.lift * K;
        rim.color.set(dressed.rim);
        mats.length = 0;
        const seen = new Set();
        body.traverse((o) => { if (o.isMesh && o.material && !seen.has(o.material)) { seen.add(o.material); o.frustumCulled = false; o.material.clipIntersection = true; mats.push(o.material); } });
        if (dressed.material) mats.splice(mats.indexOf(dressed.material), 1), mats.unshift(dressed.material);
      } catch (e) { console.warn("[cat] look", e); }
    }

    // rest pose: local quaternion L and rotation in model space W0, per bone
    const bones = {};
    body.updateMatrixWorld(true);
    const bodyInv = new T.Quaternion();
    body.getWorldQuaternion(bodyInv); bodyInv.invert();
    for (const [k, name] of Object.entries(B)) {
      const o = body.getObjectByName(name);
      if (!o) continue;
      const w0 = new T.Quaternion(); o.getWorldQuaternion(w0); w0.premultiply(bodyInv);
      bones[k] = { o, L: o.quaternion.clone(), W0: w0, W0i: w0.clone().invert(), e: [0, 0, 0], ord: /arm|fore|wrist|clav|thigh|shin|ankle|foot/.test(k) ? "XYZ" : "YXZ" };
    }
    // dressed after the rest pose is read, so scaled bones never change the pose maths
    wear(window.KT2Creature && window.KT2Creature.load());
    addEventListener("kt2-avatar", (e) => wear(e.detail));
    const tmpE = new T.Euler(), tmpQ = new T.Quaternion();
    // pose: { bone: [x, y, z] } rotations in the rest-model frame, carried by the parent
    function applyPose(P) {
      for (const k in bones) {
        const b = bones[k], t = P[k] || ZERO;
        b.e[0] = t[0]; b.e[1] = t[1]; b.e[2] = t[2];
        tmpE.set(t[0], t[1], t[2], b.ord);
        tmpQ.setFromEuler(tmpE);
        b.o.quaternion.copy(b.L).multiply(b.W0i).multiply(tmpQ).multiply(b.W0);
      }
    }
    const ZERO = [0, 0, 0];

    css.parentNode || document.head.append(css);
    const shadow = document.createElement("div"); shadow.className = "kc-shadow";
    const hit = document.createElement("button"); hit.className = "kc-hit"; hit.title = "";
    hit.setAttribute("aria-label", "KILLTOY cat");
    document.body.append(shadow, cv, hit);
    html.classList.add("kt2-cat", "kc-cat");   // kc-cat: kt2-quest.js leaves the bubble to us

    // ---------------------------------------------------------------- the world: surfaces to stand on
    const vis = (r) => r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    function footer() {
      const el = $("#rack");
      const r = el && el.getBoundingClientRect();
      if (!r || !r.width || r.top > innerHeight - 20) return { kind: "floor", el: null, x0: 30, x1: innerWidth - 30, get y() { return innerHeight - 4; } };
      return { kind: "footer", el, x0: r.left + 30, x1: r.right - 40, y: r.top };
    }
    function surfaceOf(el, kind) {
      const r = el.getBoundingClientRect();
      if (!vis(r)) return null;
      const x0 = Math.max(r.left + 18, 40), x1 = Math.min(r.right - 18, innerWidth - 40);
      if (x1 - x0 < 40) return null;
      return { kind, el, x0, x1, y: r.top };
    }
    function surfaces() {
      const out = [footer()];
      const f = out[0].y;
      document.querySelectorAll(".k2t-card").forEach((el) => { const s = surfaceOf(el, el.classList.contains("k2w") ? "inst" : "card"); if (s && s.y > 90) out.push(s); });
      // never the patterns in the playground (Eman, 7 Nov: "should not be in the middle of the playground");
      // only the UI's edges: the footer and the cards in it (INST first). window.KT2_CAT_CLIPS = old.
      if (window.KT2_CAT_CLIPS) document.querySelectorAll(".clip").forEach((el) => { const s = surfaceOf(el, "clip"); if (s && s.y > 120 && s.y < f - 30) out.push(s); });
      return out;
    }
    function liveY(s) {   // a surface's top now (it may scroll or move)
      if (!s || !s.el) return s ? s.y : innerHeight;
      if (!s.el.isConnected) return null;
      const r = s.el.getBoundingClientRect();
      if (!r.width) return null;
      if (s.kind === "footer") { s.x0 = r.left + 30; s.x1 = r.right - 40; }
      else { s.x0 = Math.max(r.left + 18, 40); s.x1 = Math.min(r.right - 18, innerWidth - 40); }
      return r.top;
    }
    // where the quest points now: the ring, else the spotlight hole (.kq-dim), else the tip label
    const box = (el) => { if (!el || !el.isConnected) return null; const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return null; const b = el.getBoundingClientRect(); return b.width ? b : null; };
    function ringRect() {
      const b = box($(".kq-ring")) || box($(".kq-dim.on")) || box($(".kq-tip"));
      return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2, top: b.top, bottom: b.bottom, left: b.left, right: b.right } : null;
    }
    // the ghost hand showing a move: the cat watches it
    function ghostXY() { const b = box($(".kq-ghost")); return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }

    // ---------------------------------------------------------------- the cat's state
    const cat = {
      x: innerWidth - 80, y: 0, on: null, yaw: 0, wantYaw: 0,
      state: "sit", t: 0, act: null, queue: [], phase: 0, speed: 0,
      head: { x: 0, y: 0 }, look: null, lookUntil: 0, nextGlance: 0,
      hop: 0, word: 0, talk: false, earTw: 0, earSide: 1, nextEar: 2,
      ring: null, idleSince: performance.now(), nextTrip: performance.now() + rnd(14000, 24000),
      air: null, pose: {}, sitBlend: 1, pointAt: null, homeX: () => innerWidth - 80,
    };
    cat.on = footer(); cat.y = cat.on.y;
    let mouse = { x: innerWidth / 2, y: innerHeight / 2, t: 0 };
    addEventListener("pointermove", (e) => { mouse = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });

    // actions: walk (x, run), jump (surface, x), sit (ms), stand (ms), attend (ring)
    function plan(list) { cat.queue = list; cat.act = null; }
    function goTo(surface, x, run, then) {
      const list = [];
      const cur = cat.on;
      if (!surface || surface === cur || (surface.el && cur && surface.el === cur.el)) {
        list.push({ type: "walk", x: clamp(x, cur.x0, cur.x1), run });
      } else {
        const lx = clamp(x, surface.x0, surface.x1);
        // take off from the point of my surface nearest the landing spot, a short run-up
        const take = clamp(lx, cur.x0, cur.x1);
        if (Math.abs(take - cat.x) > 8) list.push({ type: "walk", x: take, run });
        list.push({ type: "jump", to: surface, x: lx });
        if (Math.abs(lx - x) > 8) list.push({ type: "walk", x: clamp(x, surface.x0, surface.x1), run: false });
      }
      return list.concat(then || []);
    }

    // Eman, 7 Nov 12:10: "for now just keep the cat in the footer bar, mostly in the corner, sitting chilling".
    // It stays on the footer by its corner and only turns its head to what the quest shows.
    // window.KT2_CAT_ROAM = true brings back running to the ring and trips onto the cards.
    function thinkCorner(now) {
      const ring = ringRect() || ghostXY();
      if (ring) { cat.look = { x: ring.x, y: ring.y }; cat.lookUntil = now + 600; }
      if (cat.queue.length || cat.act) return;
      if (cat.on !== footer() && cat.on && cat.on.kind !== "footer" && cat.on.kind !== "floor") { plan(goHome()); return; }
      if (!ring && now > cat.nextTrip && !reduced && !html.classList.contains("kq-talk")) {
        cat.nextTrip = now + rnd(40000, 70000);
        // a short stretch of the legs along the footer, then back to the corner
        const f = footer(), x = clamp(cat.homeX() - rnd(50, 140), f.x0, f.x1);
        plan([{ type: "walk", x }, { type: "stand", ms: rnd(1500, 2800) }].concat(goHome()));
        return;
      }
      if (!atHome()) plan(goHome());
    }
    function think(now) {
      if (!window.KT2_CAT_ROAM) return thinkCorner(now);
      const ring = ringRect();
      const talking = html.classList.contains("kq-talk");
      if (ring) {
        const moved = !cat.ring || Math.hypot(ring.x - cat.ring.x, ring.y - cat.ring.y) > 40;
        if (moved && cat.state !== "air") {
          cat.ring = ring;
          cat.look = { x: ring.x, y: ring.y }; cat.lookUntil = now + 1500;
          const all = surfaces();
          // the best spot: a surface right under/next to the ring that I can stand on
          let best = null, bestD = 1e9;
          for (const s of all) {
            const y = s.y;
            if (y < ring.top - 4) continue;                  // never above the ring
            const sx = clamp(ring.x, s.x0, s.x1);
            const d = Math.hypot((sx - ring.x) * 0.8, (y - ring.bottom) * 1.2) + (s.kind === "footer" ? 60 : 0);
            if (d < bestD) { bestD = d; best = s; }
          }
          if (!best) best = footer();
          // stand beside the ring, not on top of the thing to click
          let x = clamp(ring.x, best.x0, best.x1);
          if (best.y <= ring.bottom + 6 && ring.x > best.x0 && ring.x < best.x1) {
            const side = ring.right + 34 < best.x1 ? ring.right + 34 : ring.left - 34;
            x = clamp(side, best.x0, best.x1);
          }
          const far = Math.abs(x - cat.x) > 260 || best !== cat.on;
          plan(goTo(best, x, far, [{ type: "attend" }]));
        }
        return;
      }
      if (cat.ring) { cat.ring = null; cat.pointAt = null; plan(goHome()); return; }
      if (cat.queue.length || cat.act) return;
      if (talking) return;
      if (now > cat.nextTrip && !reduced) { cat.nextTrip = now + rnd(18000, 34000); trip(); return; }
      if (!atHome()) plan(goHome());
    }
    function atHome() { return cat.on && cat.on.kind !== "clip" && cat.on.kind !== "card" && cat.on.kind !== "inst" && Math.abs(cat.x - cat.homeX()) < 12 && cat.state === "sit"; }
    function goHome() { const f = footer(); return goTo(f, cat.homeX(), Math.abs(cat.x - cat.homeX()) > 300 || cat.on !== f, [{ type: "sit" }]); }
    function trip() {
      const all = surfaces().filter((s) => s.kind !== "footer" && s.kind !== "floor" && Math.abs(s.y - cat.y) < 520);
      const inst = all.filter((s) => s.kind === "inst");
      const pickFrom = inst.length && Math.random() < 0.6 ? inst : all;
      const f = footer();
      if (!pickFrom.length) {   // nothing to climb: a stroll along the footer and back
        const x = clamp(cat.x + rnd(-420, -160), f.x0, f.x1);
        plan([{ type: "walk", x }, { type: "stand", ms: rnd(1500, 2600) }].concat(goHome()));
        return;
      }
      const s = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      const a = s.x0 + (s.x1 - s.x0) * rnd(0.1, 0.4), b = s.x0 + (s.x1 - s.x0) * rnd(0.6, 0.9);
      const [p, q] = Math.abs(cat.x - a) < Math.abs(cat.x - b) ? [a, b] : [b, a];
      const list = goTo(s, p, false, [{ type: "walk", x: q }, { type: "stand", ms: rnd(1800, 3200) }]);
      // then down to the side, onto the footer, and home
      const down = clamp(q + (q > cat.homeX() ? 1 : -1) * -60 + (Math.random() < 0.5 ? 80 : -80), f.x0, f.x1);
      list.push({ type: "jump", to: f, x: down });
      list.push({ type: "walk", x: cat.homeX(), run: Math.abs(down - cat.homeX()) > 300 }, { type: "sit" });
      plan(list);
    }

    // ---------------------------------------------------------------- running the actions
    function step(dt, now) {
      if (!cat.act && cat.queue.length) { cat.act = cat.queue.shift(); cat.act.t0 = now; startAct(cat.act, now); if (window.KT2_CAT_LOG) console.log("[cat]", Math.round(now), cat.act.type, Math.round(cat.act.x || 0), cat.act.to ? cat.act.to.kind : "", Math.round(cat.x), Math.round(cat.y)); }
      const a = cat.act;
      // keep standing on the surface as it moves; fall to the footer when it goes away
      if (cat.state !== "air" && cat.on) {
        const y = liveY(cat.on);
        if (y == null || (cat.on.kind !== "footer" && cat.on.kind !== "floor" && (cat.x < cat.on.x0 - 30 || cat.x > cat.on.x1 + 30))) {
          const f = footer();
          if (window.KT2_CAT_LOG) console.log("[cat] lost footing", cat.on.kind, y, Math.round(cat.x), cat.on.x0, cat.on.x1);
          plan([{ type: "jump", to: f, x: clamp(cat.x, f.x0, f.x1) }].concat(cat.ring ? [{ type: "attend" }] : goHome()));
          cat.ring = null;
          return;
        }
        cat.y = y;
        if (cat.on.kind === "footer" || cat.on.kind === "floor") cat.x = clamp(cat.x, cat.on.x0 - 20, cat.on.x1 + 20);
      }
      if (!a) { if (cat.state === "walk" || cat.state === "run") cat.state = "stand"; return; }
      if (a.type === "walk") {
        const dx = a.x - cat.x;
        if (Math.abs(dx) < 3) { cat.state = "stand"; cat.speed = 0; return done(); }
        const v = a.run ? 270 : 95;
        cat.speed = lerp(cat.speed, v, 1 - Math.exp(-dt * 6));
        cat.state = a.run ? "run" : "walk";
        cat.wantYaw = Math.sign(dx) * 1.25;
        if (Math.abs(cat.yaw - cat.wantYaw) > 0.9) { cat.speed *= 0.6; }
        cat.x += Math.sign(dx) * Math.min(Math.abs(dx), cat.speed * dt);
        cat.phase += dt * (a.run ? 15 : 8.5);
      } else if (a.type === "jump") {
        const J = cat.air;
        const t = (now - a.t0) / 1000;
        if (t < J.crouch) { cat.state = "crouch"; cat.wantYaw = Math.sign(J.x1 - J.x0 || 1) * 1.1; return; }
        const u = (t - J.crouch) / J.dur;
        if (u < 1) {
          cat.state = "air"; J.u = u;
          const y1 = liveY(J.to) ?? J.y1;
          cat.x = lerp(J.x0, J.x1, u);
          cat.y = lerp(J.y0, y1, u) - J.h * 4 * u * (1 - u);
          cat.wantYaw = Math.sign(J.x1 - J.x0 || 1) * 1.1;
          return;
        }
        if (cat.state === "air") { cat.on = J.to; cat.y = liveY(J.to) ?? J.y1; cat.x = J.x1; cat.hop = -1; cat.landAt = now; }
        cat.state = "land";
        if (now - cat.landAt > 160) { cat.state = "stand"; done(); }
      } else if (a.type === "sit") {
        cat.state = "sit"; cat.wantYaw = 0; done();
      } else if (a.type === "stand") {
        cat.state = "stand"; cat.wantYaw = 0;
        if (now - a.t0 > a.ms) done();
      } else if (a.type === "attend") {
        // next to the ring: look at it; point when it is far above; sit after a while
        const r = cat.ring;
        if (!r) return done();
        cat.look = { x: r.x, y: r.y }; cat.lookUntil = now + 400;
        const above = cat.y - r.y;
        const far = above > 170 || Math.abs(r.x - cat.x) > 260;
        cat.pointAt = (now - a.t0 < 5000 && far) ? { x: r.x, y: r.y } : null;
        cat.wantYaw = clamp((r.x - cat.x) / 400, -0.6, 0.6);
        cat.state = now - a.t0 > 9000 && cat.on && (cat.on.kind === "footer" || cat.on.kind === "floor") ? "sit" : "stand";
      }
    }
    function startAct(a, now) {
      if (a.type === "jump") {
        const y0 = cat.y, y1 = liveY(a.to) ?? a.to.y;
        const x1 = clamp(a.x, a.to.x0, a.to.x1);
        const dist = Math.hypot(x1 - cat.x, y1 - y0);
        const up = Math.max(0, y0 - y1);
        cat.air = { x0: cat.x, y0, x1, y1, to: a.to, crouch: 0.16, dur: 0.38 + Math.min(0.6, dist / 1500), h: Math.max(40, up + 40 + dist * 0.06), u: 0 };
        cat.pointAt = null;
      }
      if (a.type === "walk") cat.pointAt = null;
    }
    function done() { cat.act = null; }

    // ---------------------------------------------------------------- poses
    const S = (x, y, z) => [x || 0, y || 0, z || 0];
    function poseFor(now, dt) {
      const t = now / 1000;
      const P = {};
      const st = cat.state;
      const breathe = Math.sin(t * 2.2) * 0.03;
      // arms hang by the sides by default (rest pose is a T)
      let armR = S(0.1, 0, -1.2), armL = S(0.1, 0, 1.2), foreR = S(0, 0, -0.15), foreL = S(0, 0, 0.15);
      let thighR = S(), thighL = S(), shinR = S(), shinL = S(), ankR = S(), ankL = S();
      let spine = S(breathe, 0, 0), hips = S(), drop = 0, lift = 0;
      let tail = S(0.15 + Math.sin(t * 1.7) * 0.12, Math.sin(t * 1.3) * 0.35, 0);
      let ears = [0, 0];
      if (st === "walk" || st === "run") {
        const run = st === "run", ph = cat.phase, A = run ? 1.0 : 0.7;
        const s = Math.sin(ph);
        thighR = S(-A * s, 0, 0); thighL = S(A * s, 0, 0);
        shinR = S(Math.max(0, Math.sin(ph - 1.2)) * (run ? 1.5 : 0.8), 0, 0);
        shinL = S(Math.max(0, Math.sin(ph + Math.PI - 1.2)) * (run ? 1.5 : 0.8), 0, 0);
        armR = S(0.1 + A * 0.8 * s, 0, -1.15); armL = S(0.1 - A * 0.8 * s, 0, 1.15);
        if (run) { foreR = S(-0.9, 0, -0.1); foreL = S(-0.9, 0, 0.1); }
        lift = Math.abs(Math.cos(ph)) * (run ? 0.09 : 0.035);
        spine = S((run ? 0.32 : 0.08) + breathe, Math.sin(ph) * 0.08, 0);
        hips = S(0, -Math.sin(ph) * 0.12, Math.cos(ph) * 0.04);
        tail = S(run ? 0.9 : 0.4, Math.sin(ph) * 0.35, 0);
        ears = run ? [-0.35, -0.35] : [-0.05, -0.05];
      } else if (st === "crouch" || st === "land") {
        thighR = thighL = S(-0.75, 0, 0); shinR = shinL = S(1.35, 0, 0); ankR = ankL = S(-0.55, 0, 0);
        drop = 0.13; spine = S(0.15, 0, 0);
        armR = S(0.8, 0, -1.0); armL = S(0.8, 0, 1.0);
        ears = [-0.2, -0.2];
      } else if (st === "air") {
        const u = cat.air ? cat.air.u : 0.5;
        const tuck = Math.sin(Math.PI * clamp(u * 1.15, 0, 1));
        thighR = S(-0.4 - tuck * 0.8, 0, -0.1); thighL = S(-0.2 - tuck * 0.9, 0, 0.1);
        shinR = S(0.4 + tuck * 1.1, 0, 0); shinL = S(0.5 + tuck * 1.2, 0, 0);
        armR = S(-0.4, 0, lerp(0.6, -0.6, u)); armL = S(-0.4, 0, lerp(-0.6, 0.6, u));
        spine = S(lerp(-0.25, 0.25, u), 0, 0);
        tail = S(lerp(-0.4, 1.0, u), Math.sin(t * 9) * 0.3, 0);
        ears = [lerp(-0.45, 0.15, u), lerp(-0.45, 0.15, u)];
      } else if (st === "sit") {
        // on the edge, facing you, legs over the edge, swinging
        const sw = reduced ? 0 : 0.28;
        thighR = S(-1.5, 0, -0.12); thighL = S(-1.5, 0, 0.12);
        shinR = S(1.45 + Math.sin(t * 2.1) * sw, 0, 0); shinL = S(1.45 + Math.sin(t * 2.1 + 2.4) * sw, 0, 0);
        ankR = ankL = S(-0.3, 0, 0);
        armR = S(-0.55, 0, -1.15); armL = S(-0.55, 0, 1.15);
        foreR = S(-0.25, 0, -0.1); foreL = S(-0.25, 0, 0.1);
        spine = S(0.12 + breathe, 0, 0);
        drop = 0.24;
        tail = S(0.1 + Math.sin(t * 0.9) * 0.12, Math.sin(t * 1.1) * 0.45, 0);   // up behind the back; its base dips behind the edge and is hidden
      }
      // pointing at the ring with the hand on its side (in the screen plane, facing you)
      if (cat.pointAt && (st === "stand" || st === "sit")) {
        const dx = cat.pointAt.x - cat.x, dy = cat.pointAt.y - (cat.y - 60);
        if (dx >= 0) armR = S(0, 0, Math.atan2(-dy, dx)); else armL = S(0, 0, Math.atan2(-dy, dx) - Math.PI);
        if (dx >= 0) foreR = S(); else foreL = S();
      }
      // ears twitch now and then
      cat.nextEar -= dt;
      if (cat.nextEar < 0) { cat.earTw = 1; cat.earSide = Math.random() < 0.5 ? 0 : 1; cat.nextEar = rnd(1.8, 5.5); }
      cat.earTw = Math.max(0, cat.earTw - dt * 5);
      ears[cat.earSide] -= Math.sin(cat.earTw * Math.PI) * 0.35;
      // the head looks at something: the ring, the mouse, or around
      let lx, ly;
      const gh = ghostXY();
      if (gh) { lx = gh.x; ly = gh.y; }
      else if (cat.look && now < cat.lookUntil) { lx = cat.look.x; ly = cat.look.y; }
      else if (now - mouse.t < 1600 && Math.hypot(mouse.x - cat.x, mouse.y - cat.y) < 380) { lx = mouse.x; ly = mouse.y; }
      else {
        if (now > cat.nextGlance) {
          cat.glance = { x: cat.x + rnd(-500, 500), y: cat.y + rnd(-420, 60) };
          if (Math.random() < 0.3) cat.glance = { x: cat.x + rnd(-40, 40), y: cat.y - 20 };   // back at you
          cat.nextGlance = now + rnd(1400, 4200);
        }
        lx = cat.glance ? cat.glance.x : cat.x; ly = cat.glance ? cat.glance.y : cat.y;
      }
      if (!gh && (cat.talk || html.classList.contains("kq-talk"))) { lx = cat.x + (cat.x > innerWidth / 2 ? -120 : 120); ly = cat.y - 140; }
      const hx = lx - cat.x, hy = ly - (cat.y - 70);
      let wantHY = clamp(Math.atan2(hx, 260), -1.2, 1.2) - cat.yaw;
      let wantHX = clamp(Math.atan2(hy, Math.abs(hx) + 220), -0.7, 0.45);
      if (st === "walk" || st === "run" || st === "air" || st === "crouch" || st === "land") { wantHY = clamp(wantHY, -0.25, 0.25) * 0.5; wantHX *= 0.3; }
      const k = 1 - Math.exp(-dt * 7);
      cat.head.y = lerp(cat.head.y, clamp(wantHY, -0.9, 0.9), k);
      cat.head.x = lerp(cat.head.x, wantHX, k);
      // talking: a nod per word
      cat.word = Math.max(0, cat.word - dt * 6);
      const nod = Math.sin(cat.word * Math.PI) * 0.18;
      P.hips = hips; P.sp1 = spine; P.sp2 = S(spine[0] * 0.6, spine[1], 0); P.sp3 = S(spine[0] * 0.4, 0, 0);
      P.head = S(cat.head.x * 0.7 + nod, cat.head.y * 0.75, Math.sin(t * 0.8) * 0.04);
      P.crown = S(cat.head.x * 0.3, cat.head.y * 0.25, 0);
      P.armR = armR; P.armL = armL; P.foreR = foreR; P.foreL = foreL;
      P.thighR = thighR; P.thighL = thighL; P.shinR = shinR; P.shinL = shinL; P.ankleR = ankR; P.ankleL = ankL;
      P.earL1 = S(ears[0] * 0.6, 0, 0); P.earL2 = S(ears[0] * 0.5, 0, 0);
      P.earR1 = S(ears[1] * 0.6, 0, 0); P.earR2 = S(ears[1] * 0.5, 0, 0);
      const tw = (i) => S(tail[0] / 5 + Math.sin(t * 2.3 - i * 0.7) * 0.05, tail[1] / 5 * (1 + i * 0.25), 0);
      P.tail1 = tw(0); P.tail2 = tw(1); P.tail3 = tw(2); P.tail4 = tw(3); P.tail5 = tw(4);
      P._drop = drop; P._lift = lift;
      return P;
    }
    // smooth blend from the pose we had to the new one (walk cycles stay crisp)
    function blend(P, dt) {
      const k = 1 - Math.exp(-dt * (cat.state === "walk" || cat.state === "run" || cat.state === "air" ? 22 : 9));
      const out = {};
      for (const key in P) {
        if (key[0] === "_") { out[key] = cat.pose[key] == null ? P[key] : lerp(cat.pose[key], P[key], k); continue; }
        const a = cat.pose[key] || [0, 0, 0], b = P[key];
        out[key] = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      }
      cat.pose = out;
      return out;
    }

    // ---------------------------------------------------------------- the frame
    let last = performance.now(), thinkAt = 0, hidden = false;
    document.addEventListener("visibilitychange", () => { hidden = document.hidden; last = performance.now(); });
    function frame(now) {
      requestAnimationFrame(frame);
      if (hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.body.classList.contains("at-home")) return;
      if (now > thinkAt) { thinkAt = now + 250; try { think(now); } catch (e) { console.warn("[cat]", e); } }
      step(dt, now);
      cat.yaw = lerp(cat.yaw, cat.wantYaw, 1 - Math.exp(-dt * 9));
      const P = blend(poseFor(now, dt), dt);
      applyPose(P);
      cat.hop = lerp(cat.hop, 0, 1 - Math.exp(-dt * 10));
      const squash = 1 + cat.hop * 0.12 * (cat.hop < 0 ? 1 : -1);
      root.position.set(0, (P._lift - P._drop) * K + Math.max(0, cat.hop) * 14, 0);
      root.rotation.y = cat.yaw;
      const clip = cat.state === "sit" && cat.pose._drop > 0.18 ? behind : null;
      behind[1].normal.set(Math.sin(cat.yaw), 0, Math.cos(cat.yaw));   // "behind" turns with the cat
      if (mats[0] && (mats[0].clippingPlanes || null) !== clip) for (const m of mats) { m.clippingPlanes = clip; m.needsUpdate = true; }
      root.scale.set(2 - squash, squash, 2 - squash);
      if (dressed) dressed.tick(now / 1000);
      renderer.render(scene, cam);
      const x = Math.round(cat.x), y = Math.round(cat.y);
      cv.style.transform = `translate(${x - OX}px, ${y - OY}px)`;
      hit.style.transform = `translate(${x - 28}px, ${y - 84 + Math.round(P._drop * K)}px)`;
      const g = cat.on ? (liveY(cat.on) ?? y) : y;
      const air = cat.state === "air" ? clamp((g - y) / 200, 0, 1) : 0;
      shadow.style.transform = `translate(${x}px, ${Math.round(cat.state === "air" ? (cat.air && (liveY(cat.air.to) ?? y)) : g)}px) scale(${(1 - air * 0.5).toFixed(2)})`;
      shadow.style.opacity = cat.state === "sit" ? 0 : 1 - air * 0.6;
      placeBubble(x, y - (cat.state === "sit" ? 50 : 70));
    }
    // the quest's talk bubble sits beside the cat's head
    // ... but never over what the quest shows: the slots, the spotlight hole, the ring
    function placeBubble(x, hy) {
      const b = $(".kq-bub");
      if (!b) return;
      const w = b.offsetWidth || 360, h = b.offsetHeight || 90;
      const keep = [...document.querySelectorAll(".kq-slot, .kq-dim.on, .kq-ring, .kq-tip")].map(box).filter(Boolean);
      const free = (r) => r.left >= 8 && r.top >= 56 && r.left + w <= innerWidth - 8 && r.top + h <= innerHeight - 8 &&
        !keep.some((k) => r.left < k.right + 6 && r.left + w > k.left - 6 && r.top < k.bottom + 6 && r.top + h > k.top - 6);
      const by = clamp(hy - h + 34, 60, innerHeight - h - 8);
      const tries = [
        { left: x - 52 - w, top: by, flip: false, arrow: true },
        { left: x + 52, top: by, flip: true, arrow: true },
        { left: clamp(x - w / 2, 8, innerWidth - w - 8), top: hy - h - 70, flip: false, arrow: false },
        { left: innerWidth - w - 56, top: 96, flip: false, arrow: false },
        { left: 16, top: 96, flip: false, arrow: false },
        { left: 16, top: innerHeight - h - 16, flip: false, arrow: false },
      ];
      const pick = tries.find(free) || tries[3];
      b.classList.toggle("kc-flip", pick.flip);
      b.classList.toggle("kc-noarrow", !pick.arrow);
      Object.assign(b.style, { left: Math.round(pick.left) + "px", top: Math.round(pick.top) + "px", right: "auto", bottom: "auto" });
    }

    // ---------------------------------------------------------------- talking, clicks
    const old = window.ktAvatar || {};
    window.ktAvatar = {
      mode(m) { cat.talk = m === "speaking"; if (m === "acting") cat.hop = 1; try { old.mode && old.mode(m); } catch (e) { /* fine */ } },
      word() { cat.word = 1; try { old.word && old.word(); } catch (e) { /* fine */ } },
    };
    hit.addEventListener("click", (e) => {
      e.stopPropagation();
      cat.hop = 1; cat.earTw = 1;
      const av = $(".kt-av");
      if (av) av.click();
    });

    window.KT2Cat = {
      cat, surfaces, trip, goHome: () => plan(goHome()),
      go: (x, run) => plan(goTo(cat.on, x, run)),
      jumpTo: (sel, x) => { const el = $(sel); const s = el && surfaceOf(el, "card"); if (s) plan(goTo(s, x == null ? (s.x0 + s.x1) / 2 : x, false, [{ type: "stand", ms: 3000 }])); },
      sit: () => plan([{ type: "sit" }]),
    };
    requestAnimationFrame(frame);
  }

  const go = () => start().catch((e) => { console.warn("[cat] staying with the head:", e && e.message); html.classList.remove("kt2-cat", "kc-cat"); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(go, 300)); else setTimeout(go, 300);
})();
