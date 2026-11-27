// KILLTOY 2: the creature look (Eman, 7 Nov 2026). Everyone makes their own guide at the start of
// quest 1 (kt2-creator.js). The guide is always Eman's rigged Meshy cat (kt2-cat.glb, 52 bones);
// a "look" changes it without a new model, so the bone animation in kt2-cat.js keeps working:
//   - bones scaled for head / ears / tail / body / legs (feet stay on the ground: dress() returns lift)
//   - the skin repainted in the shader: the cat's own texture is read as dark -> light, plus the
//     yellow star eyes, and mapped to new colours; patterns are painted in model space
//   - small parts made in code and hung on bones: horns, halo, wings, back spikes, tail flame, tears
// window.KT2Creature = { FEATURES, DEFAULT, load(), save(look), random(), name(), dress(T, scene, look, renderer) }
// Saved in localStorage kt2.avatar ({ v: 1, name, skin, eyes, ... }). Nothing here touches the DOM.
// Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const KEY = "kt2.avatar";
  const opt = (id, name, sw) => ({ id, name, sw });
  // sw = the swatch colour(s) for the tile when there is no picture yet
  const FEATURES = [
    { id: "skin", name: "SKIN", view: "full", opts: [
      opt("starry", "STARRY", ["#0b0b14", "#8f8cff"]), opt("void", "VOID", ["#050507", "#ff2a3d"]),
      opt("candy", "CANDY", ["#2a0b3d", "#ff7ad9"]), opt("porcelain", "PORCELAIN", ["#f4f1f6", "#c9a8ff"]),
      opt("ghost", "GHOST", ["#0a1620", "#7ff3ff"]), opt("blood", "BLOOD", ["#140306", "#c3122a"]),
      opt("chrome", "CHROME", ["#2b2b33", "#e8e8f0"]), opt("toxic", "TOXIC", ["#061206", "#59ff7a"]) ] },
    { id: "eyes", name: "EYES", view: "face", opts: [
      opt("star", "STAR", ["#e8df6e"]), opt("blood", "RED", ["#ff2236"]), opt("ice", "ICE", ["#9ff4ff"]),
      opt("void", "VOID", ["#000000"]), opt("white", "WHITE", ["#ffffff"]), opt("purple", "PURPLE", ["#b26bff"]) ] },
    { id: "pattern", name: "PATTERN", view: "full", opts: [
      opt("none", "CLEAN"), opt("drip", "DRIP"), opt("spots", "SPOTS"), opt("stripes", "STRIPES"), opt("split", "SPLIT") ] },
    { id: "head", name: "HEAD", view: "full", opts: [ opt("small", "SMALL"), opt("normal", "NORMAL"), opt("big", "BIG"), opt("huge", "HUGE") ] },
    { id: "ears", name: "EARS", view: "head", opts: [ opt("tiny", "TINY"), opt("cat", "CAT"), opt("big", "BIG"), opt("long", "LONG") ] },
    { id: "horns", name: "HORNS", view: "head", opts: [
      opt("none", "NONE"), opt("devil", "DEVIL"), opt("ram", "RAM"), opt("uni", "ONE"), opt("spikes", "CROWN") ] },
    { id: "top", name: "ABOVE", view: "head", opts: [ opt("none", "NONE"), opt("halo", "HALO"), opt("redhalo", "RED HALO"), opt("orb", "ORB") ] },
    { id: "face", name: "FACE", view: "face", opts: [ opt("clean", "CLEAN"), opt("tears", "TEARS"), opt("blood", "BLOOD TEARS"), opt("cheeks", "CHEEKS") ] },
    { id: "back", name: "BACK", view: "back", opts: [ opt("none", "NONE"), opt("wings", "WINGS"), opt("spikes", "SPIKES"), opt("tubes", "TUBES") ] },
    { id: "tail", name: "TAIL", view: "back", opts: [ opt("stub", "STUB"), opt("cat", "CAT"), opt("long", "LONG"), opt("devil", "DEVIL") ] },
    { id: "body", name: "BODY", view: "full", opts: [ opt("slim", "SLIM"), opt("normal", "NORMAL"), opt("chunky", "CHUNKY") ] },
    { id: "legs", name: "LEGS", view: "full", opts: [ opt("short", "SHORT"), opt("normal", "NORMAL"), opt("long", "LONG") ] },
  ];
  const DEFAULT = { v: 1, name: "", skin: "starry", eyes: "star", pattern: "none", head: "normal", ears: "cat", horns: "none",
    top: "none", face: "clean", back: "none", tail: "cat", body: "normal", legs: "normal" };

  // dark names (Eman's done-signal words)
  const N1 = ["NOX", "HEX", "SLAIN", "VOID", "MOTH", "GRIM", "NULL", "VEX", "RUIN", "ASH", "SKRAEL", "KHAROS", "LUX", "WRAITH", "SORROW", "BANE", "OMEN", "STATIC"];
  const N2 = ["", "", "", "", " 808", " II", " ZERO", "BOY", "GIRL", " KID", " X", "LING"];
  function name() { return N1[Math.floor(Math.random() * N1.length)] + N2[Math.floor(Math.random() * N2.length)]; }

  function load() {
    try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j && j.v === 1) return Object.assign({}, DEFAULT, j); } catch (e) { /* fine */ }
    return null;
  }
  function save(look) {
    try { localStorage.setItem(KEY, JSON.stringify(look)); } catch (e) { /* fine */ }
    try { window.dispatchEvent(new CustomEvent("kt2-avatar", { detail: look })); } catch (e) { /* fine */ }
  }
  function random(keepName) {
    const l = Object.assign({}, DEFAULT);
    for (const f of FEATURES) {
      let o = f.opts;
      // mostly the calmer choices, so random ones look designed, not noisy
      if (f.id === "pattern" && Math.random() < 0.45) { l[f.id] = "none"; continue; }
      if ((f.id === "back" || f.id === "top" || f.id === "face") && Math.random() < 0.5) { l[f.id] = o[0].id; continue; }
      l[f.id] = o[Math.floor(Math.random() * o.length)].id;
    }
    l.name = keepName || name();
    return l;
  }

  // ---------------------------------------------------------------- colours per skin
  // dark / light = the cat's black -> periwinkle gradient remapped; acc = parts (horns etc.); gloss 0..1
  const SKINS = {
    starry:    { orig: true, acc: 0x0c0c14, acc2: 0x8f8cff, gloss: 0.75 },
    void:      { dark: 0x040406, light: 0x5a0712, acc: 0xff2a3d, acc2: 0xff2a3d, gloss: 0.85 },
    candy:     { dark: 0x3a0e57, light: 0xff86de, acc: 0xffffff, acc2: 0xff86de, gloss: 0.8 },
    porcelain: { dark: 0xf2eef5, light: 0xb9a6e8, acc: 0x111116, acc2: 0xc9a8ff, gloss: 0.9 },
    ghost:     { dark: 0x0b1822, light: 0x82f2ff, acc: 0xe8fbff, acc2: 0x82f2ff, gloss: 0.7 },
    blood:     { dark: 0x170306, light: 0xc3122a, acc: 0x0b0b0e, acc2: 0xff3346, gloss: 0.85 },
    chrome:    { dark: 0x3a3a44, light: 0xf2f2fa, acc: 0x9b5cff, acc2: 0xc9a8ff, gloss: 1, metal: 1 },
    toxic:     { dark: 0x071407, light: 0x4dff6e, acc: 0x0a0a0a, acc2: 0x4dff6e, gloss: 0.8 },
  };
  const EYES = { star: null, blood: 0xff2236, ice: 0x9ff4ff, void: 0x020203, white: 0xffffff, purple: 0xb26bff };
  const PATTERN = { none: 0, drip: 1, spots: 2, stripes: 3, split: 4 };
  const ROLE = {   // what each bone is
    hips: "Bone_000", sp1: "Bone_005", sp2: "Bone_004", sp3: "Bone_003", chest: "Bone_002", head: "Bone_023", crown: "Bone_022",
    earL: "Bone_036", earR: "Bone_039", thighR: "Bone_010", thighL: "Bone_015", tail: "Bone_021", tailTip: "Bone_016", tailEnd: "Bone_017",
    armR: "Bone_027", armL: "Bone_032", toeR: "Bone_006", toeL: "Bone_011", footR: "Bone_007", footL: "Bone_012",
  };

  // ---------------------------------------------------------------- the skin shader
  function skinMaterial(T, base) {
    const m = new T.MeshPhysicalMaterial({ map: base.map, normalMap: base.normalMap, roughnessMap: base.roughnessMap, metalnessMap: base.metalnessMap,
      side: base.side });
    if (base.normalScale) m.normalScale.copy(base.normalScale);
    const u = {
      kcOn: { value: 0 }, kcDark: { value: new T.Color() }, kcLight: { value: new T.Color() },
      kcEyeOn: { value: 0 }, kcEye: { value: new T.Color() }, kcPat: { value: 0 }, kcPatCol: { value: new T.Color() },
    };
    m.userData.kc = u;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vKcPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvKcPos = position;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
varying vec3 vKcPos;
uniform float kcOn; uniform vec3 kcDark; uniform vec3 kcLight; uniform float kcEyeOn; uniform vec3 kcEye; uniform float kcPat; uniform vec3 kcPatCol;
float kcHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float kcPattern(vec3 p) {
  if (kcPat < 0.5) return 0.0;
  if (kcPat < 1.5) { // drip: paint runs down from the top of the head
    float col = floor(p.x * 9.0 + 40.0);
    float len = 0.12 + 0.55 * kcHash(vec3(col, 3.0, 1.0)) * kcHash(vec3(col, 7.0, 2.0));
    float edge = 0.62 - len + 0.04 * sin(p.x * 60.0);
    float w = abs(fract(p.x * 9.0) - 0.5);
    float drop = step(edge, p.y) * step(w, 0.32);
    return max(step(0.6, p.y), drop);
  }
  if (kcPat < 2.5) { // spots
    vec3 q = p * 5.5; vec3 c = floor(q); vec3 f = fract(q) - 0.5;
    vec3 o = vec3(kcHash(c), kcHash(c + 1.7), kcHash(c + 3.1)) - 0.5;
    float r = 0.18 + 0.16 * kcHash(c + 9.0);
    return 1.0 - smoothstep(r - 0.03, r, length(f - o * 0.4));
  }
  if (kcPat < 3.5) { // stripes, a bit wavy
    float s = sin(p.y * 34.0 + sin(p.x * 7.0 + p.z * 5.0) * 1.6);
    return smoothstep(0.35, 0.55, s);
  }
  return smoothstep(-0.01, 0.01, p.x); // split: one half the other colour
}
`)
        .replace("#include <map_fragment>", `#include <map_fragment>
#ifdef USE_MAP
{
  vec3 c = sampledDiffuseColor.rgb;
  float eye = smoothstep(0.12, 0.3, min(c.r, c.g) - c.b);
  vec3 outc = c;
  if (kcOn > 0.5) {
    float t = smoothstep(0.02, 0.75, max(c.b, max(c.r, c.g)));
    outc = mix(kcDark, kcLight, t);
  }
  float pat = kcPattern(vKcPos);
  outc = mix(outc, kcPatCol, pat * (1.0 - eye));
  vec3 eyec = kcEyeOn > 0.5 ? kcEye : c;
  outc = mix(outc, eyec, eye);
  diffuseColor.rgb = outc;
}
#endif`);
      // the cat's texture is already multiplied in by map_fragment; we replaced it above
    };
    m.customProgramCacheKey = () => "kt2creature";
    return m;
  }

  // a rich, glossy reflection without any image files: a dark room with purple + white light panels
  const envCache = new WeakMap();
  function env(T, renderer) {
    if (!renderer) return null;
    if (envCache.has(renderer)) return envCache.get(renderer);
    const sc = new T.Scene();
    const room = new T.Mesh(new T.SphereGeometry(10, 24, 12), new T.MeshBasicMaterial({ color: 0x0c0a12, side: T.BackSide }));
    sc.add(room);
    const panel = (c, x, y, z, w, h, i) => {
      const p = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide }));
      p.position.set(x, y, z); p.lookAt(0, 0, 0); sc.add(p);
    };
    panel(0xffffff, -3, 5, 4, 5, 2, 3);
    panel(0x9b5cff, 6, 1, -3, 3, 7, 2.5);
    panel(0xc9a8ff, -6, 0, -2, 2, 6, 1.5);
    panel(0xffffff, 0, -6, 2, 8, 1, 0.6);
    const pm = new T.PMREMGenerator(renderer);
    const tex = pm.fromScene(sc, 0.03).texture;
    pm.dispose();
    envCache.set(renderer, tex);
    return tex;
  }

  // ---------------------------------------------------------------- parts made in code
  // a ram horn: a shrinking spiral going up, back, down and forward beside the head, drifting outward
  function ramGeo(T, R, r0, out) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, th = t * Math.PI * 1.65, r = R * (1 - 0.5 * t);
      pts.push(new T.Vector3(out * (0.05 + t * 0.16), r * Math.sin(th), -(R - r * Math.cos(th))));
    }
    return tubeAlong(T, pts, r0, 0.25);
  }
  function tubeAlong(T, pts, r0, end) {
    const curve = new T.CatmullRomCurve3(pts);
    const n = pts.length * 2, radial = 11;
    const g = new T.TubeGeometry(curve, n, r0, radial - 1, false);
    const pos = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i <= n; i++) {
      const t = i / n, k = Math.max(0.03, end + (1 - end) * (1 - t));
      const c = curve.getPointAt(t);
      for (let j = 0; j < radial; j++) { const idx = i * radial + j; v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c); pos.setXYZ(idx, v.x, v.y, v.z); }
    }
    g.computeVertexNormals();
    return g;
  }
  function hornGeo(T, len, r0, curlX, curlZ, out, segs) {
    // a tapering tube along a bent path; starts at (0,0,0) going up (+y)
    segs = segs || 14;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const a = t * curlX, b = t * curlZ;
      pts.push(new T.Vector3(out * len * t * 0.55 + Math.sin(b) * len * 0.25, len * Math.sin(Math.PI / 2 - a * 0.5) * t, -Math.sin(a) * len * 0.45 * t));
    }
    const curve = new T.CatmullRomCurve3(pts);
    const g = new T.TubeGeometry(curve, segs * 2, r0, 10, false);
    // taper: scale each ring toward the path
    const pos = g.attributes.position, v = new T.Vector3(), radial = 11;
    for (let i = 0; i <= segs * 2; i++) {
      const t = i / (segs * 2), k = Math.max(0.02, Math.pow(1 - t, 0.9));
      const c = curve.getPointAt(t);
      for (let j = 0; j < radial; j++) {
        const idx = i * radial + j;
        v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
        pos.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    return g;
  }
  function wingGeo(T, side) {
    const s = new T.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.25, 0.25, 0.55, 0.4, 0.78, 0.36);
    s.lineTo(0.7, 0.16); s.quadraticCurveTo(0.6, 0.06, 0.55, -0.02);
    s.quadraticCurveTo(0.45, 0.02, 0.38, -0.12);
    s.quadraticCurveTo(0.26, -0.06, 0.18, -0.18);
    s.quadraticCurveTo(0.1, -0.08, 0, -0.06);
    const g = new T.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 10 });
    if (side < 0) g.scale(-1, 1, 1);
    g.computeVertexNormals();
    return g;
  }

  // ---------------------------------------------------------------- dress the cat
  // scene = gltf.scene, at its own scale (not yet scaled by kt2-cat's K). Safe to call again: it undoes the last look.
  function dress(T, scene, look, renderer) {
    look = Object.assign({}, DEFAULT, look || {});
    const bone = (k) => scene.getObjectByName(ROLE[k]);
    const st = scene.userData.kc || (scene.userData.kc = { scales: {}, mats: new Map(), parts: [] });
    // undo the last look
    for (const p of st.parts) { if (p.parent) p.parent.remove(p); p.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    st.parts = [];
    for (const n in st.scales) { const o = scene.getObjectByName(n); if (o) o.scale.copy(st.scales[n]); }

    // materials: swap each mesh to our physical skin once
    const sk = SKINS[look.skin] || SKINS.starry;
    let skin = null;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      let m = st.mats.get(o);
      if (!m) { m = skinMaterial(T, o.material); st.mats.set(o, m); m.userData.orig = o.material; o.material = m; }
      skin = m;
      const u = m.userData.kc;
      u.kcOn.value = sk.orig ? 0 : 1;
      if (!sk.orig) { u.kcDark.value.set(sk.dark).convertSRGBToLinear(); u.kcLight.value.set(sk.light).convertSRGBToLinear(); }
      const eye = EYES[look.eyes];
      u.kcEyeOn.value = eye == null ? 0 : 1;
      if (eye != null) u.kcEye.value.set(eye).convertSRGBToLinear();
      u.kcPat.value = PATTERN[look.pattern] || 0;
      u.kcPatCol.value.set(sk.acc2).convertSRGBToLinear();
      if (look.pattern === "split" || look.pattern === "drip") u.kcPatCol.value.set(look.skin === "porcelain" ? 0x111116 : (sk.orig ? 0x8f8cff : sk.acc)).convertSRGBToLinear();
      m.roughness = 1; m.metalness = 1;            // the maps decide, like the original
      m.roughnessMap = m.userData.orig.roughnessMap || null;
      m.clearcoat = sk.gloss; m.clearcoatRoughness = 0.12;
      m.metalness = sk.metal ? 1 : (m.userData.orig.metalness ?? 1);
      if (sk.metal) { m.roughness = 0.25; m.roughnessMap = null; }
      const e = env(T, renderer);
      m.envMap = e; m.envMapIntensity = sk.metal ? 1.4 : (e ? 0.55 : 0);
      m.needsUpdate = true;
    });

    // bones: remember rest scale the first time, then scale
    const sc = (k, x, y, z) => {
      const o = bone(k); if (!o) return;
      if (!st.scales[o.name]) st.scales[o.name] = o.scale.clone();
      const r = st.scales[o.name];
      o.scale.set(r.x * x, r.y * (y ?? x), r.z * (z ?? x));
    };
    const H = { small: 0.82, normal: 1, big: 1.14, huge: 1.28 }[look.head] || 1;
    // the head bone carries the ears; the arms hang off the chest, so the head is scaled at the head bone
    sc("head", H);
    const E = { tiny: [0.5, 0.45], cat: [1, 1], big: [1.3, 1.25], long: [0.85, 1.7] }[look.ears] || [1, 1];
    sc("earL", E[0], E[1], E[0]); sc("earR", E[0], E[1], E[0]);
    const TL = { stub: [0.7, 0.35], cat: [1, 1], long: [1.05, 1.5], devil: [1, 1.1] }[look.tail] || [1, 1];
    sc("tail", TL[0], TL[1], TL[0]);
    const BD = { slim: 0.84, normal: 1, chunky: 1.2 }[look.body] || 1;
    // widen the belly at the first spine bone and give it back at the chest so the arms and head keep their size
    sc("sp1", BD, 1, BD); sc("chest", 1 / BD, 1, 1 / BD);
    sc("thighR", BD, 1, BD); sc("thighL", BD, 1, BD);
    const LG = { short: 0.78, normal: 1, long: 1.22 }[look.legs] || 1;
    sc("thighR", BD, LG, BD); sc("thighL", BD, LG, BD);

    // parts are placed on the rest pose: remember it the first time, and lend it while placing
    if (!st.rest) { st.rest = []; scene.traverse((o) => { if (o.isBone) st.rest.push([o, o.quaternion.clone()]); }); }
    const posed = st.rest.map(([o]) => o.quaternion.clone());
    for (const [o, q0] of st.rest) o.quaternion.copy(q0);
    scene.updateMatrixWorld(true);

    // parts hang on bones; a point is given in the scene's own frame and turned into the bone's frame
    const inv = new T.Matrix4(), q = new T.Quaternion(), qs = new T.Quaternion();
    scene.getWorldQuaternion(qs);
    const sceneInv = new T.Matrix4().copy(scene.matrixWorld).invert();
    function hang(k, obj, x, y, z, rot) {
      const b = bone(k); if (!b) return;
      const rel = new T.Matrix4().multiplyMatrices(sceneInv, b.matrixWorld);
      inv.copy(rel).invert();
      const p = new T.Vector3(x, y, z).applyMatrix4(inv);
      obj.position.copy(p);
      // undo the bone's rotation + scale so the part keeps its own shape and size
      const pos = new T.Vector3(), quat = new T.Quaternion(), scl = new T.Vector3();
      rel.decompose(pos, quat, scl);
      obj.quaternion.copy(quat.invert());
      if (rot) obj.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(rot[0], rot[1], rot[2])));
      obj.scale.set(1 / scl.x, 1 / scl.y, 1 / scl.z);
      b.add(obj);
      st.parts.push(obj);
      return obj;
    }
    // rest-pose landmarks, in the scene frame at rest (measured on kt2-cat.glb, head top ~1.62, eyes ~1.03)
    const hb = bone("head"), hp = new T.Vector3();
    hb.getWorldPosition(hp); hp.applyMatrix4(sceneInv);
    const HS = H;   // things on the head grow with it
    const headY = (y) => hp.y + (y - 0.787) * HS;
    const headX = (x) => x * HS;
    const glossy = (c, extra) => new T.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env(T, renderer), envMapIntensity: 0.35 }, extra || {}));
    const glow = (c, i) => new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i || 1), toneMapped: false, transparent: true, opacity: 0.95 });
    const accCol = sk.acc;
    const ticks = [];

    // horns sit on the top of the head, between the ears
    if (look.horns !== "none") {
      // light horns on dark skins, black horns on light skins; devil horns go blood red
      const light = look.skin === "porcelain" || look.skin === "chrome";
      const hm = glossy(look.horns === "devil" ? (light ? 0x111116 : 0x4a020b) : (light ? 0x111116 : 0xe9e2d6));
      const pair = (geoFn, x, y, z, rot) => {
        for (const s of [-1, 1]) {
          const m = new T.Mesh(geoFn(s), hm);
          hang("head", m, headX(x * s), headY(y), z * HS, [rot[0], rot[1] * s, rot[2] * s]);
        }
      };
      if (look.horns === "devil") pair((s) => hornGeo(T, 0.36 * HS, 0.08 * HS, 0.8, 0, 0.3 * s), 0.22, 1.52, 0.2, [-0.1, 0, -0.3]);
      if (look.horns === "ram") pair((s) => hornGeo(T, 0.36 * HS, 0.085 * HS, 5.0, 0, 0.6 * s, 24), 0.64, 1.2, 0.1, [0, 0, -1.45]);
      if (look.horns === "uni") { const m = new T.Mesh(hornGeo(T, 0.42 * HS, 0.06 * HS, 0.25, 0, 0), hm); hang("head", m, 0, headY(1.5), 0.32 * HS, [0.7, 0, 0]); }
      if (look.horns === "spikes") {
        for (let i = -2; i <= 2; i++) {
          const m = new T.Mesh(hornGeo(T, (0.2 - Math.abs(i) * 0.03) * HS, 0.04 * HS, 0, 0, 0, 6), hm);
          hang("head", m, headX(i * 0.09), headY(1.56 - Math.abs(i) * 0.02), 0.12 * HS, [-0.15, 0, -i * 0.28]);
        }
      }
    }
    // halo / orb above the head
    if (look.top !== "none") {
      const g = new T.Group();
      if (look.top === "orb") {
        g.add(new T.Mesh(new T.SphereGeometry(0.075, 20, 14), glow(sk.acc2 === 0x0b0b0e ? 0xff3346 : sk.acc2, 1.6)));
        const shell = new T.Mesh(new T.SphereGeometry(0.11, 20, 14), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
        g.add(shell);
      } else {
        const c = look.top === "redhalo" ? 0xff2a3d : 0xfff3d6;
        g.add(new T.Mesh(new T.TorusGeometry(0.3 * HS, 0.022, 10, 48), glow(c, 1.4)));
        g.children[0].rotation.x = Math.PI / 2 - 0.25;
      }
      hang("head", g, 0, headY(look.top === "orb" ? 1.95 : 1.88), 0.1, null);
      const y0 = g.position.clone();
      ticks.push((t) => { g.position.copy(y0); g.position.y += Math.sin(t * 2.1) * 0.03 * (1 / Math.max(0.01, g.scale.y)); g.rotation.y = t * (look.top === "orb" ? 1.4 : 0.5); });
    }
    // face: tears run from under the eyes; cheeks glow
    if (look.face !== "clean") {
      for (const s of [-1, 1]) {
        if (look.face === "cheeks") {
          const m = new T.Mesh(new T.CircleGeometry(0.06 * HS, 20), new T.MeshBasicMaterial({ color: 0xff5aa8, transparent: true, opacity: 0.55, depthWrite: false }));
          hang("head", m, headX(0.3 * s), headY(0.93), 0.385 * HS, [0, 0.35 * s, 0]);
          continue;
        }
        const c = look.face === "blood" ? 0xc3122a : 0xcff6ff;
        const tg = new T.Group();
        const drop = new T.Mesh(new T.SphereGeometry(0.045 * HS, 14, 10), glossy(c, { transmission: look.face === "blood" ? 0 : 0.4, roughness: 0.05 }));
        drop.scale.set(1, 1.5, 0.7); drop.position.y = -0.12 * HS;
        const trail = new T.Mesh(new T.CylinderGeometry(0.018 * HS, 0.03 * HS, 0.12 * HS, 8), drop.material);
        trail.position.y = -0.06 * HS; trail.scale.z = 0.6;
        tg.add(drop, trail);
        hang("head", tg, headX(0.29 * s), headY(0.96), 0.39 * HS, [-0.25, 0.4 * s, 0]);
      }
    }
    // back: little bat wings that flap, spikes down the spine, or glowing tubes (frequency-gun style)
    if (look.back === "wings") {
      for (const s of [-1, 1]) {
        const w = new T.Mesh(wingGeo(T, s), glossy(look.skin === "porcelain" || look.skin === "chrome" ? 0x15151a : 0x1a1024, { side: T.DoubleSide, envMapIntensity: 0.6 }));
        w.scale.setScalar(0.8);
        const piv = new T.Group(); piv.add(w);
        hang("chest", piv, 0.08 * s, 0.72, -0.08, [0.15, 0, 0]);
        w.rotation.y = s * 0.5;
        ticks.push((t) => { w.rotation.y = s * (0.45 + Math.sin(t * 3.2) * 0.35); });
      }
    }
    if (look.back === "spikes") {
      const hm = glossy(accCol);
      [[0.62, 0.11], [0.52, 0.13], [0.42, 0.12], [0.33, 0.09]].forEach(([y, l]) => {
        const m = new T.Mesh(new T.ConeGeometry(0.045, l, 12), hm);
        hang("chest", m, 0, y, -0.04 - 0.055 * BD, [-Math.PI / 2 - 0.35, 0, 0]);
      });
    }
    if (look.back === "tubes") {
      const tm = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.28, depthWrite: false, envMap: env(T, renderer) });
      for (const s of [-1, 1]) {
        const g = new T.Group();
        const glass = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.3, 16), tm);
        const juice = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.22, 12), glow(look.skin === "toxic" ? 0x4dff6e : 0xff1a2e, 1.3)); juice.material.transparent = false; juice.renderOrder = -1;
        const cap1 = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.03, 16), glossy(0x111116));
        const cap2 = cap1.clone(); cap1.position.y = 0.16; cap2.position.y = -0.16;
        g.add(glass, juice, cap1, cap2);
        hang("chest", g, 0.09 * s, 0.52, -0.1 - 0.06 * BD, [0.25, 0, 0.1 * s]);
        ticks.push((t) => { juice.scale.y = 0.85 + Math.sin(t * 4 + s) * 0.12; });
      }
    }
    // tail flame
    if (look.tail === "devil") {
      const g = new T.Group();
      const parts = [];
      for (let i = 0; i < 3; i++) {
        const m = new T.Mesh(new T.ConeGeometry(0.11 - i * 0.03, 0.34 - i * 0.07, 14), i ? glow([0xff1a2e, 0xff1a2e, 0xffd6dc][i], 1.2) : glossy(look.skin === "porcelain" ? 0x111116 : 0x8a0716));
        if (i) { m.material.opacity = 0.35; m.material.blending = T.AdditiveBlending; m.material.depthWrite = false; m.scale.setScalar(1.15); }
        m.position.y = 0.17 - i * 0.03; m.renderOrder = 5 + i; parts.push(m); g.add(m);
      }
      // past the tip, along the tail's last bone
      const end = bone("tailEnd"), tip = bone("tailTip"), ep = new T.Vector3(), tp = new T.Vector3();
      end.getWorldPosition(ep); tip.getWorldPosition(tp); ep.applyMatrix4(sceneInv); tp.applyMatrix4(sceneInv);
      const dir = tp.clone().sub(ep).normalize();
      tp.addScaledVector(dir, 0.06);
      hang("tailEnd", g, tp.x, tp.y, tp.z, null);
      ticks.push((t) => { parts.forEach((m, i) => { m.scale.set(1 + Math.sin(t * 13 + i) * 0.12, 1 + Math.sin(t * 9 + i * 2) * 0.25, 1); m.rotation.y = t * (2 + i); }); });
    }

    // feet back on the ground: how far the lowest toe moved
    scene.updateMatrixWorld(true);
    let low = Infinity;
    for (const k of ["toeR", "toeL", "footR", "footL"]) { const b = bone(k); if (!b) continue; const p = new T.Vector3(); b.getWorldPosition(p); p.applyMatrix4(sceneInv); low = Math.min(low, p.y); }
    if (st.restLow == null) st.restLow = (look.legs === "normal" && look.body === "normal") ? low : 0.017;
    const lift = st.restLow - low;
    st.rest.forEach(([o], i) => o.quaternion.copy(posed[i]));
    scene.updateMatrixWorld(true);

    return {
      lift, look,
      rim: sk.orig ? 0x9b5cff : (look.skin === "porcelain" ? 0x9b5cff : sk.acc2 === 0x0b0b0e ? 0xff3346 : sk.acc2),
      tick(t) { for (const f of ticks) f(t); },
      material: skin,
    };
  }

  window.KT2Creature = { FEATURES, DEFAULT, KEY, load, save, random, name, dress, SKINS };
})();
