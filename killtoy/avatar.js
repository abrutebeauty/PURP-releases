// KILLTOY avatar: the assistant as a full-body 3D character standing in the corner.
// Loaded after assistant.js and three.min.js. It takes over the assistant's .kt-av button:
// clicking the character is the same as clicking the old face (talk / stop).
//
//   look   - head, neck and eyes follow the mouse; glances around when the mouse is still
//   modes  - idle (breathes, sways, blinks), listening (leans in, ears up, eyes open,
//            floor ring), thinking (looks up, hand to chin), speaking (mouth moves with
//            the voice), acting (a quick nod and hop)
//   hit    - only the character itself takes clicks; the timeline under the empty
//            corners of its box still works
//
// The character is built from simple shapes (no model file), so it ships in the app as is.
// assistant.js calls window.ktAvatar.mode(m) and .word() (each spoken word).
// Keep this file ASCII-only, like the rest of ui/.
"use strict";

(function () {
  const $av = document.querySelector(".kt-av");
  if (!$av || !window.THREE) return;
  const T = window.THREE;

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) { return; } // no WebGL: keep the flat face
  if (!renderer.getContext()) return;

  const W = 190, H = 300;
  const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setSize(W, H);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const cv = renderer.domElement;
  cv.className = "kt-3d-canvas";

  const css = document.createElement("style");
  css.textContent = `
  .kt-ai.kt-3d { right: 6px; align-items: flex-end; }
  .kt-ai.kt-3d .kt-av { width: ${W}px; height: ${H}px; border-radius: 0; background: none; box-shadow: none; animation: none; transform: none !important; pointer-events: none; }
  .kt-ai.kt-3d .kt-av.hit { pointer-events: auto; }
  .kt-ai.kt-3d .kt-av:focus-visible { outline-offset: -6px; border-radius: 18px; }
  .kt-ai.kt-3d .kt-av > :is(.eyes, .mouth, .ring) { display: none; }
  .kt-ai.kt-3d .kt-av .dots { top: 14px; right: 44px; }
  .kt-ai.kt-3d .kt-bub { margin-bottom: ${Math.round(H * 0.58)}px; margin-right: -26px; }
  .kt-3d-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  `;
  document.head.append(css);
  $av.prepend(cv);
  $av.parentElement.classList.add("kt-3d");

  // -------------------------------------------------------------------------
  // Scene, camera, light
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(24, W / H, 0.1, 50);
  cam.position.set(0, 1.86, 9.6);
  cam.lookAt(0, 1.72, 0);

  // A tiny studio for the glossy reflections: dark room, a few soft boxes.
  const pmrem = new T.PMREMGenerator(renderer);
  const studio = new T.Scene();
  studio.background = new T.Color(0x07080c);
  const box = (c, i, x, y, z, w, h) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
  };
  box(0xffffff, 3.2, -3, 4, 4, 4, 2.2);   // key soft box, front left, high
  box(0xb9a6ff, 1.6, 4, 1, -3, 2, 5);     // purple rim strip, back right
  box(0xe4ff3a, 0.35, 0, -4, 3, 6, 1);    // a hint of acid yellow from below
  box(0x9fb4ff, 0.9, 5, 3, 3, 1.5, 1.5);  // small cool fill
  scene.environment = pmrem.fromScene(studio, 0.03).texture;

  scene.add(new T.HemisphereLight(0xb8c4ff, 0x14101c, 0.3));
  const key = new T.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 5, 6); scene.add(key);
  const rim = new T.DirectionalLight(0xa58bff, 1.8); rim.position.set(4, 3, -4); scene.add(rim);

  // -------------------------------------------------------------------------
  // Materials
  const skin = new T.MeshPhysicalMaterial({ color: 0x121838, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.55, sheen: 0.25, sheenColor: new T.Color(0x5a64a8) });
  const earSkin = new T.MeshPhysicalMaterial({ color: 0x5d6596, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.6 });
  const earInner = new T.MeshPhysicalMaterial({ color: 0x3a3f6c, roughness: 0.6, envMapIntensity: 0.5 });
  const black = new T.MeshPhysicalMaterial({ color: 0x050507, roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
  const latex = new T.MeshPhysicalMaterial({ color: 0x0b0b10, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, side: T.DoubleSide });
  const lipMat = new T.MeshPhysicalMaterial({ color: 0x10142a, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const mouthIn = new T.MeshBasicMaterial({ color: 0x07030a });
  const white = new T.MeshPhysicalMaterial({ color: 0x8a8590, roughness: 0.15, clearcoat: 1, envMapIntensity: 0.6 });
  const iris = new T.MeshPhysicalMaterial({ color: 0x0a0605, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0 });
  const redRim = new T.MeshPhysicalMaterial({ color: 0x8c0f22, roughness: 0.35, emissive: 0x3a0008 });
  const hairMat = new T.MeshStandardMaterial({ color: 0xd9d09a, roughness: 0.6, envMapIntensity: 0.5, metalness: 0, map: hairTexture() });
  const acid = new T.MeshBasicMaterial({ color: 0xe4ff3a, transparent: true, opacity: 0, depthWrite: false });

  function hairTexture() {
    const c = document.createElement("canvas"); c.width = 128; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#f0ead0"; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * 128, w = 0.5 + Math.random() * 1.6, l = Math.random() * 0.35;
      g.fillStyle = Math.random() < 0.5 ? `rgba(160,140,90,${0.12 + l})` : `rgba(255,255,240,${0.1 + l * 0.6})`;
      g.fillRect(x, 0, w, 256);
    }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  // -------------------------------------------------------------------------
  // Shapes
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; };
  const group = (parent, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; };
  const sphere = (r, ws = 32, hs = 24) => new T.SphereGeometry(r, ws, hs);
  const capsule = (r, len) => new T.CapsuleGeometry(r, len, 8, 18);

  // A cone bent along an arc (horns, ears). Base at 0, tip at +y before bending.
  function bentCone(len, r, bend, flat = 1, tipR = 0) {
    const geo = new T.CylinderGeometry(tipR, r, len, 22, 28, false);
    geo.translate(0, len / 2, 0);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i) * flat;
      const s = y / len, th = bend * s;
      let cx = 0, cy = y;
      if (Math.abs(bend) > 1e-4) { const rc = len / bend; cx = rc * (1 - Math.cos(th)); cy = rc * Math.sin(th); }
      p.setXYZ(i, cx + x * Math.cos(th), cy - x * Math.sin(th), z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // A limb: pivot at the joint, hanging down along -y.
  function limb(parent, x, y, z, len, r1, r2, mat) {
    const g = group(parent, x, y, z);
    const geo = new T.CylinderGeometry(r1, r2, len, 18, 1, true); geo.translate(0, -len / 2, 0);
    mesh(geo, mat, g);
    mesh(sphere(r1 * 1.04, 18, 14), mat, g);
    g.end = group(g, 0, -len, 0);
    mesh(sphere(r2, 18, 14), mat, g.end);
    return g;
  }

  // -------------------------------------------------------------------------
  // Glitter: twinkling points (lashes, cheek writing, specks in the air)
  const sparkMats = [];
  function glitter(positions, size, color, bright = 1) {
    const n = positions.length / 3;
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    const ph = new Float32Array(n), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) { ph[i] = Math.random(); sz[i] = size * (0.5 + Math.random()); }
    geo.setAttribute("phase", new T.BufferAttribute(ph, 1));
    geo.setAttribute("size", new T.BufferAttribute(sz, 1));
    const mat = new T.ShaderMaterial({
      uniforms: { time: { value: 0 }, pr: { value: renderer.getPixelRatio() }, color: { value: new T.Color(color) }, bright: { value: bright } },
      vertexShader: `attribute float phase; attribute float size; uniform float time; uniform float pr; varying float vA;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5 * sin(time * (2.0 + phase * 3.0) + phase * 40.0); vA = tw * tw * tw;
          gl_PointSize = size * pr * (0.7 + vA * 0.9) * (300.0 / -mv.z); }`,
      fragmentShader: `uniform vec3 color; uniform float bright; varying float vA;
        void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c);
          float core = smoothstep(0.5, 0.0, d); core *= core;
          float star = max(0.0, 1.0 - abs(c.x) * 12.0) * max(0.0, 1.0 - abs(c.y) * 2.2) + max(0.0, 1.0 - abs(c.y) * 12.0) * max(0.0, 1.0 - abs(c.x) * 2.2);
          float a = (core * 0.8 + star * vA) * (0.3 + vA) * bright; if (a < 0.01) discard;
          gl_FragColor = vec4(color * a, a); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    sparkMats.push(mat);
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  // -------------------------------------------------------------------------
  // The character. Feet at y = 0, facing the camera (+z). Big doll head.
  const root = group(scene);
  const hips = group(root, 0, 1.12, 0);
  const spine = group(hips, 0, 0.08, 0);
  const chest = group(spine, 0, 0.42, 0);

  // Torso: waist, ribcage, hips (ball-jointed doll style), black latex dress over it
  mesh(capsule(0.2, 0.22), skin, spine, 0, 0.18, 0).scale.set(1, 1, 0.8);
  mesh(sphere(0.27), skin, chest, 0, 0.12, 0).scale.set(1, 0.95, 0.72);
  mesh(sphere(0.25), skin, hips, 0, 0, 0).scale.set(1.08, 0.75, 0.8);
  const top = mesh(sphere(0.275, 32, 20, 0), latex, chest, 0, 0.08, 0.005); top.scale.set(1.01, 0.62, 0.75);
  const skirtPts = [];
  for (let i = 0; i <= 12; i++) { const s = i / 12; skirtPts.push(new T.Vector2(0.2 + 0.18 * s * s + 0.06 * s, 0.32 - s * 0.62)); }
  mesh(new T.LatheGeometry(skirtPts, 40), latex, spine, 0, 0, 0).scale.set(1, 1, 0.82);
  // An acid-yellow star on the dress, like the app icon
  const starShape = new T.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.024 : 0.06; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  mesh(new T.ShapeGeometry(starShape), new T.MeshBasicMaterial({ color: 0xe4ff3a }), chest, 0.1, 0.04, 0.208).rotation.y = 0.35;

  // Neck + head
  const neck = group(chest, 0, 0.3, 0);
  mesh(new T.CylinderGeometry(0.075, 0.09, 0.22, 16), skin, neck, 0, 0.08, 0);
  const head = group(neck, 0, 0.5, 0.02);

  // Egg-shaped head: round forehead, narrower chin
  const R = 0.48;
  const headGeo = sphere(R, 48, 36);
  {
    const p = headGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0) { const k = Math.pow(-y / R, 1.6); x *= 1 - 0.3 * k; z *= 1 - 0.12 * k; }
      p.setXYZ(i, x, y * 1.1, z * 0.94);
    }
    headGeo.computeVertexNormals();
  }
  const headMesh = mesh(headGeo, skin, head);

  // Where the face surface is, for placing eyes, nose, lips and the writing on it.
  const ray = new T.Raycaster();
  headMesh.updateMatrixWorld();
  function surface(x, y) {
    ray.set(new T.Vector3(x, y, 3), new T.Vector3(0, 0, -1));
    const h = ray.intersectObject(headMesh)[0];
    if (!h) return { p: new T.Vector3(x, y, 0), n: new T.Vector3(0, 0, 1) };
    return { p: h.point.clone(), n: h.face.normal.clone() };
  }

  // Eyes: dark glossy irises, red rims, heavy lids, glitter lashes
  const eyes = [];
  for (const side of [-1, 1]) {
    const s = surface(side * 0.165, -0.045);
    const eye = group(head, s.p.x, s.p.y, s.p.z - 0.045);
    eye.rotation.y = side * 0.18;
    const ball = group(eye);
    mesh(sphere(0.082), white, ball);
    const ir = mesh(sphere(0.066, 24, 18), iris, ball, 0, 0.004, 0.054); ir.scale.set(1, 1, 0.5);
    const rimRing = mesh(new T.TorusGeometry(0.09, 0.008, 10, 40, Math.PI * 1.1), redRim, eye, 0, 0, 0.03); rimRing.rotation.z = Math.PI * 0.95;
    // Upper lid: a shell of skin that rotates down over the eye
    const lid = group(eye);
    const lidGeo = new T.SphereGeometry(0.092, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    mesh(lidGeo, skin, lid); // rotation.x: about -0.6 = wide open, 0 = half closed, 1.57 = shut
    const lower = mesh(new T.SphereGeometry(0.091, 28, 8, 0, Math.PI * 2, Math.PI * 0.76, Math.PI * 0.24), skin, eye);
    lower.rotation.x = -0.3;
    // Lashes: glitter strands curling up and out from the lid edge
    const lp = [], lo = [];
    for (let i = 0; i < 26; i++) {
      const u = i / 25, a = (u - 0.5) * 2.5;
      const outer = side > 0 ? u : 1 - u;
      const len = 0.03 + 0.12 * Math.pow(outer, 1.6) + Math.random() * 0.02;
      const bx = Math.sin(a) * 0.094, bz = Math.cos(a) * 0.094;
      const dx = Math.sin(a) * 0.25 + side * 0.55 * outer, dz = Math.cos(a) * 0.7;
      for (let k = 0; k < 12; k++) { const t = k / 11; lp.push(bx + dx * len * t, len * (0.35 * t + 0.75 * t * t), bz + dz * len * t); }
    }
    for (let i = 0; i < 22; i++) { const a = (Math.random() - 0.5) * 2.2; lo.push(Math.sin(a) * 0.088, -0.06 - Math.random() * 0.035, Math.cos(a) * 0.06 + 0.012); }
    eye.add(glitter(lo, 0.014, 0xdfe6ff, 0.9));
    lid.add(glitter(lp, 0.014, 0xe8eeff, 1.6));
    eyes.push({ eye, ball, lid, side });
  }

  // Nose and lips
  { const s = surface(0, -0.19); const n = mesh(sphere(0.036, 18, 14), skin, head, s.p.x, s.p.y, s.p.z - 0.012); n.scale.set(1.1, 0.8, 0.9); }
  const mouth = group(head);
  { const s = surface(0, -0.305); mouth.position.copy(s.p).add(new T.Vector3(0, 0, -0.02)); }
  const upperLip = mesh(capsule(0.03, 0.1), lipMat, mouth, 0, 0.016, 0); upperLip.rotation.z = Math.PI / 2; upperLip.scale.set(1, 1, 0.7);
  const jaw = group(mouth);
  const lowerLip = mesh(capsule(0.034, 0.088), lipMat, jaw, 0, -0.016, 0.002); lowerLip.rotation.z = Math.PI / 2; lowerLip.scale.set(1, 1, 0.7);
  const mouthHole = mesh(sphere(0.045, 18, 12), mouthIn, mouth, 0, 0, -0.012); mouthHole.scale.set(1.15, 0.05, 0.4);

  // Glitter writing on the cheek, drawn to a canvas and turned into sparkles on the skin
  {
    const c = document.createElement("canvas"); c.width = 220; c.height = 120;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.font = "italic 700 50px 'Brush Script MT', 'Snell Roundhand', cursive";
    g.translate(10, 64); g.rotate(-0.12); g.fillText("killtoy", 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0); g.lineWidth = 2.4; g.strokeStyle = "#fff";
    for (const [x, l] of [[30, 34], [74, 26], [118, 46], [160, 22], [188, 38]]) { g.beginPath(); g.moveTo(x, 62 - x * 0.12 + 16); g.lineTo(x + 1, 62 - x * 0.12 + 16 + l); g.stroke(); }
    const d = g.getImageData(0, 0, c.width, c.height).data, wp = [];
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      if (d[(y * c.width + x) * 4 + 3] < 120 || Math.random() < 0.15) continue;
      const fx = -0.4 + (x / c.width) * 0.3, fy = -0.06 - (y / c.height) * 0.27;
      const s = surface(fx, fy); wp.push(s.p.x, s.p.y, s.p.z + 0.004);
    }
    head.add(glitter(wp, 0.02, 0xeef2ff, 1.8));
  }

  // Ears: long, pointed, pale lavender, bent up and back
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = group(head, side * 0.34, 0.0, -0.08);
    const geo = bentCone(0.66, 0.12, -side * 0.5, 0.3);
    const em = mesh(geo, earSkin, ear); em.rotation.z = -side * 1.02;
    const inner = mesh(bentCone(0.5, 0.075, -side * 0.5, 0.2), earInner, ear, 0, 0, 0.022); inner.rotation.z = -side * 1.02;
    ear.rotation.y = side * 0.35;
    ears.push({ ear, side });
  }

  // Horns: glossy black, curving back and outward
  for (const side of [-1, 1]) {
    const h = mesh(bentCone(0.62, 0.1, 1.5, 1, 0.004), black, head, side * 0.2, 0.36, 0.1);
    h.rotation.set(-0.25, side * 0.9, -side * 0.35);
  }

  // Hair: cream blond, framing the face from behind and falling past the hips
  const hair = group(head, 0, 0, 0);
  // A hood of hair with the face left open at the front
  const gap = 0.95;
  const cap = mesh(new T.SphereGeometry(R * 1.07, 44, 30, Math.PI / 2 + gap, Math.PI * 2 - gap * 2, 0, Math.PI * 0.72), hairMat, hair, 0, 0.04, -0.03);
  cap.material = hairMat.clone(); cap.material.side = T.DoubleSide;
  cap.scale.set(1.04, 1.1, 1.0); cap.rotation.x = -0.18;
  const back = mesh(sphere(R * 1.02), hairMat, hair, 0, -0.04, -0.12); back.scale.set(1.02, 1.08, 0.92);
  const locks = [];
  for (let i = 0; i < 9; i++) {
    const u = i / 8 - 0.5, len = 1.05 + Math.cos(u * 2.4) * 0.35;
    const lock = group(hair, u * 0.78, -0.12, -0.2 - Math.cos(u * 3) * 0.06);
    const lm = mesh(capsule(0.12 - Math.abs(u) * 0.05, len), hairMat, lock, 0, -len / 2, 0);
    lm.scale.set(1, 1, 0.45);
    lock.rotation.z = u * 0.32; lock.rotation.x = 0.12;
    locks.push({ lock, u, z0: lock.rotation.z });
  }
  // Two front strands falling over the shoulders
  for (const side of [-1, 1]) {
    const lock = group(hair, side * 0.37, -0.05, 0.02);
    mesh(capsule(0.07, 0.85), hairMat, lock, 0, -0.45, 0).scale.set(1, 1, 0.5);
    lock.rotation.z = side * 0.12;
    locks.push({ lock, u: side * 0.6, z0: lock.rotation.z });
  }

  // Arms (shoulder -> elbow -> hand), ball-jointed
  function arm(side) {
    const sh = limb(chest, side * 0.29, 0.18, 0, 0.42, 0.07, 0.055, skin);
    const fore = limb(sh.end, 0, 0, 0, 0.38, 0.055, 0.042, skin);
    const hand = group(fore.end);
    mesh(sphere(0.065, 18, 14), skin, hand, 0, -0.07, 0).scale.set(0.8, 1.25, 0.55);
    mesh(capsule(0.02, 0.05), skin, hand, side * -0.05, -0.05, 0.02).rotation.z = side * 0.6;
    return { sh, fore, hand, side };
  }
  const arms = [arm(-1), arm(1)];

  // Legs with chunky black platform boots
  function leg(side) {
    const th = limb(hips, side * 0.12, -0.06, 0, 0.48, 0.11, 0.075, skin);
    const sh = limb(th.end, 0, 0, 0, 0.42, 0.075, 0.058, skin);
    const boot = group(sh.end);
    mesh(new T.CylinderGeometry(0.1, 0.09, 0.32, 18), latex, boot, 0, 0.08, 0);
    const foot = mesh(capsule(0.095, 0.13), latex, boot, 0, -0.08, 0.07); foot.rotation.x = Math.PI / 2; foot.scale.set(1.05, 1, 0.9);
    mesh(new T.CylinderGeometry(0.12, 0.12, 0.1, 20), black, boot, 0, -0.17, 0.05).scale.set(1, 1, 1.5);
    return { th, sh, boot, side };
  }
  const legs = [leg(-1), leg(1)];

  // Floor: soft shadow and a ring that lights up acid yellow while listening
  const shadowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,0.6)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  })();
  const shadow = mesh(new T.PlaneGeometry(1.4, 1.4), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }), root, 0, 0.002, 0);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.y = 0.55;
  const ring = mesh(new T.RingGeometry(0.5, 0.56, 64), acid, root, 0, 0.004, 0);
  ring.rotation.x = -Math.PI / 2; ring.scale.y = 0.55;

  // Specks floating around her, like in the reference photo
  {
    const sp = [];
    for (let i = 0; i < 70; i++) sp.push((Math.random() - 0.5) * 2.2, 0.2 + Math.random() * 3.3, (Math.random() - 0.5) * 1.4);
    scene.add((root.specks = glitter(sp, 0.022, 0xcfd8ff, 0.7)));
  }

  // Resting pose
  for (const a of arms) { a.sh.rotation.z = a.side * 0.16; a.fore.rotation.x = -0.15; }
  for (const l of legs) { l.th.rotation.z = l.side * 0.03; }

  // -------------------------------------------------------------------------
  // Behaviour
  const S = { mode: "idle", live: false, mx: null, my: null, lastMove: 0, glance: { x: 0, y: 0, until: 0 },
    yaw: 0, pitch: 0, eyeX: 0, eyeY: 0, blink: 0, nextBlink: 2, mouth: 0, mouthT: 0, syl: 0, nextSyl: 0,
    pose: { lean: 0, tilt: 0, ears: 0, lids: 0, think: 0, talk: 0, hop: 0 }, actAt: -9, wordAt: -9, hover: false };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  window.ktAvatar = {
    mode(m, live) {
      if (m === "acting" && S.mode !== "acting") S.actAt = clock.elapsedTime;
      S.mode = m; if (live !== undefined) S.live = live;
    },
    word() { S.wordAt = clock.elapsedTime; S.syl = 1; },
  };
  for (const m of ["listening", "thinking", "speaking", "acting"]) if ($av.classList.contains(m)) S.mode = m;

  const v3 = new T.Vector3();
  function headScreen() {
    head.getWorldPosition(v3); v3.project(cam);
    const r = cv.getBoundingClientRect();
    return { x: r.left + (v3.x * 0.5 + 0.5) * r.width, y: r.top + (-v3.y * 0.5 + 0.5) * r.height, r };
  }

  // Only the character takes clicks; the rest of its box lets them through.
  const hitRay = new T.Raycaster(), ndc = new T.Vector2();
  const solid = []; root.traverse((o) => o.isMesh && o !== shadow && o !== ring && solid.push(o));
  function onCharacter(x, y) {
    const r = cv.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    hitRay.setFromCamera(ndc, cam);
    return hitRay.intersectObjects(solid, false).length > 0;
  }
  window.addEventListener("mousemove", (e) => {
    S.mx = e.clientX; S.my = e.clientY; S.lastMove = clock.elapsedTime;
    const hit = onCharacter(e.clientX, e.clientY);
    if (hit !== S.hover) { S.hover = hit; $av.classList.toggle("hit", hit); }
  }, { passive: true });
  document.addEventListener("mouseleave", () => { S.mx = null; });

  const clock = new T.Clock();
  // Frame budget: she must never slow the app or the voice down. 30 fps while she listens,
  // thinks or talks, 20 fps at rest, 10 fps at rest while the song plays.
  let raf = 0, lastDraw = 0;
  const playing = () => typeof ui !== "undefined" && !!(ui.transport && ui.transport.playing); // app.js global
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const busy = S.mode !== "idle" || S.hover;
    const fps = busy ? 30 : playing() ? 10 : 20;
    if (now - lastDraw < 1000 / fps - 2) return;
    lastDraw = now;
    const dt = Math.min(0.12, clock.getDelta()), t = clock.elapsedTime;
    const k = (rate) => 1 - Math.exp(-rate * dt);
    const live = $av.classList.contains("live") || S.live;
    const m = S.mode;

    // Where to look: the mouse, or a glance around when it has been still a while
    let lx = 0, ly = 0.1;
    if (S.mx != null && t - S.lastMove < 4) {
      const h = headScreen(), D = 520;
      lx = Math.atan((S.mx - h.x) / D); ly = Math.atan((S.my - h.y) / D);
    } else {
      if (t > S.glance.until) S.glance = { x: (Math.random() - 0.65) * 1.1, y: (Math.random() - 0.6) * 0.5, until: t + 1.6 + Math.random() * 3 };
      lx = S.glance.x; ly = S.glance.y;
    }
    if (m === "thinking") { lx = -0.45; ly = -0.42; }
    if (m === "listening" && S.mx == null) { lx = -0.2; ly = 0; }
    S.yaw = lerp(S.yaw, clamp(lx, -0.95, 0.95), k(6));
    S.pitch = lerp(S.pitch, clamp(ly, -0.6, 0.55), k(6));
    S.eyeX = lerp(S.eyeX, clamp(lx * 1.2, -0.45, 0.45), k(18));
    S.eyeY = lerp(S.eyeY, clamp(ly * 1.2, -0.3, 0.3), k(18));

    // Pose targets per mode
    const P = S.pose, act = clamp(1 - (t - S.actAt) / 0.6, 0, 1);
    P.lean = lerp(P.lean, m === "listening" ? 0.09 : m === "speaking" ? 0.03 : 0, k(4));
    P.tilt = lerp(P.tilt, m === "listening" ? 0.16 : m === "thinking" ? -0.12 : 0, k(4));
    P.ears = lerp(P.ears, m === "listening" || live ? 1 : S.hover ? 0.6 : 0, k(5));
    P.lids = lerp(P.lids, m === "listening" || S.hover ? 0.55 : m === "thinking" ? -0.25 : m === "speaking" ? 0.3 : 0, k(5));
    P.think = lerp(P.think, m === "thinking" ? 1 : 0, k(4));
    P.talk = lerp(P.talk, m === "speaking" ? 1 : 0, k(4));

    // Mouth: syllables while speaking, sharper on each word the voice reports
    if (m === "speaking") {
      if (t > S.nextSyl) { S.syl = 0.25 + Math.random() * 0.75; S.nextSyl = t + 0.09 + Math.random() * 0.12; }
      if (t - S.wordAt > 0.12) S.syl *= Math.exp(-dt * 5);
    } else S.syl = 0;
    S.mouth = lerp(S.mouth, S.syl, k(26));
    jaw.position.y = -S.mouth * 0.05;
    jaw.rotation.x = S.mouth * 0.25;
    mouthHole.scale.set(1.35 - S.mouth * 0.3, 0.05 + S.mouth * 1.25, 0.4);
    mouthHole.position.y = -S.mouth * 0.024;

    // Breathing, sway, weight shift
    const br = Math.sin(t * 1.7), sw = Math.sin(t * 0.6);
    const mo = reduced ? 0.3 : 1;
    root.position.y = Math.max(0, Math.sin(act * Math.PI) * 0.12);
    hips.rotation.z = sw * 0.035 * mo; hips.position.x = sw * 0.02 * mo;
    spine.rotation.z = -sw * 0.05 * mo;
    spine.rotation.x = P.lean;
    chest.scale.set(1 + br * 0.008, 1 + br * 0.012, 1 + br * 0.01);
    chest.rotation.y = S.yaw * 0.18;
    chest.rotation.x = P.lean * 0.5 + S.pitch * 0.06;
    neck.rotation.y = S.yaw * 0.32;
    neck.rotation.x = S.pitch * 0.3 + P.lean * 0.4;
    const nod = m === "speaking" ? Math.sin(t * 7.3) * 0.025 + S.mouth * 0.03 : 0;
    head.rotation.set(S.pitch * 0.55 + nod + act * 0.25, S.yaw * 0.55, -S.yaw * 0.08 + P.tilt + sw * 0.02 * mo);
    for (const l of legs) { l.th.rotation.x = -P.lean * 0.6; l.sh.rotation.x = P.lean * 0.5 + act * 0.4; l.th.rotation.z = l.side * 0.03 - sw * 0.03 * mo; }

    // Arms: hang and swing a little; right hand to chin when thinking; gestures when talking
    for (const a of arms) {
      const thinkArm = a.side > 0 ? P.think : 0;
      const g = P.talk * (a.side < 0 ? 0.5 + 0.5 * Math.sin(t * 2.4) : 0.3 + 0.3 * Math.sin(t * 1.9 + 1));
      a.sh.rotation.z = a.side * (0.16 + br * 0.01 + g * 0.12) - thinkArm * a.side * 0.05;
      a.sh.rotation.x = -thinkArm * 0.55 - g * 0.35 + sw * 0.03 * a.side * mo;
      a.fore.rotation.x = -0.15 - thinkArm * 2.15 - g * 0.9;
      a.fore.rotation.z = thinkArm * -0.25 * a.side;
    }

    // Eyes and lids
    if (t > S.nextBlink) { S.blink = 1; S.nextBlink = t + 2.2 + Math.random() * 4 + (Math.random() < 0.15 ? -2 : 0); }
    S.blink = Math.max(0, S.blink - dt * 7);
    const blink = Math.sin(S.blink * Math.PI);
    for (const e of eyes) {
      e.ball.rotation.y = S.eyeX; e.ball.rotation.x = S.eyeY;
      // a heavy, half-lidded look at rest, like the reference
      const open = -0.12 - P.lids * 0.5;
      e.lid.rotation.x = lerp(open, 1.55, blink) + S.eyeY * 0.3;
    }

    // Ears perk up when listening, twitch now and then
    const tw = Math.max(0, Math.sin(t * 0.9) * Math.sin(t * 2.3) - 0.85) * 4;
    for (const e of ears) {
      e.ear.rotation.z = e.side * (-0.18 * P.ears - tw * 0.08 * (e.side > 0 ? 1 : 0.4)) + e.side * Math.sin(t * 1.7) * 0.01;
      e.ear.rotation.x = -0.15 * P.ears;
    }

    // Hair follows the head a little behind, with a slow sway
    for (const L of locks) {
      L.lock.rotation.z = L.z0 - head.rotation.z * 0.6 - S.yaw * 0.05 + Math.sin(t * 1.1 + L.u * 3) * 0.02 * mo;
      L.lock.rotation.x = 0.12 - head.rotation.x * 0.7 + P.lean * 0.3;
    }

    // Listening ring, glitter, specks
    acid.opacity = lerp(acid.opacity, live || m === "listening" ? 0.55 + Math.sin(t * 5) * 0.25 : 0, k(6));
    ring.scale.set(1 + Math.sin(t * 5) * 0.03, 0.55, 1);
    for (const mat of sparkMats) { mat.uniforms.time.value = t; }
    root.specks.rotation.y = t * 0.05;

    renderer.render(scene, cam);
  }

  // Stop drawing when the window is hidden
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { clock.getDelta(); raf = requestAnimationFrame(frame); }
  });
  raf = requestAnimationFrame(frame);
})();
