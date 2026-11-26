// KILLTOY 2 (PARKED 7 Nov, see KT2_FOG_OLD below): FOG, a background for the PRODUCE page that moves with the music. Off by default
// (the page has no background); the cloud button in the header picks NONE or FOG and the
// choice is remembered on this computer.
// Slow smoke rising from the bottom of the playground, under a dark veil so clips and the grid
// stay easy to read. The music thickens it where it plays (lows on the left, highs on the
// right), the bass makes it curl faster and kicks lift it for a moment; a faint purple glow
// sits inside it. Stopped, it just drifts.
// The smoke is a small picture (domain-warped noise, about 160 pixels wide) that the browser
// stretches and blurs, so it costs little. Listens to the playground's master
// (purpPlaygroundDebug.masterOut); without it (the Mac app) it only drifts. Loaded after
// kt2.js. Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const html = document.documentElement;
  if (!html.classList.contains("kt2")) return;
  // Parked (Eman, 7 Nov 01:30: "removing the cloud feature fully"): the CARDS icon sits where the cloud
  // button was. KT2_FOG_OLD = true before this file loads brings the cloud button and FOG back.
  if (!window.KT2_FOG_OLD) return;
  const KEY = "kt2.background";
  const NB = 32, FPS = 30, GW = 160;

  let mode = "none";
  try { mode = localStorage.getItem(KEY) || "none"; } catch (e) {}
  if (mode !== "fog") mode = "none";

  // ------------------------------------------------------------------ the picker in the header
  const btn = document.createElement("button");
  btn.className = "k2-bgbtn";
  btn.title = "Background";
  btn.innerHTML = '<svg viewBox="0 0 20 20" width="15" height="15"><path d="M5.5 14.5h9a3 3 0 0 0 .3-6 4.3 4.3 0 0 0-8.3-.6A3.3 3.3 0 0 0 5.5 14.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const pop = document.createElement("div");
  pop.className = "k2-bgpop";
  pop.innerHTML = '<div class="h">BACKGROUND</div>' +
    '<button data-bg="none"><b>NONE</b><span>Plain dark grey</span></button>' +
    '<button data-bg="fog"><b>FOG</b><span>Slow smoke that moves with the music</span></button>';
  btn.onclick = (e) => { e.stopPropagation(); pop.classList.toggle("open"); paintPicker(); };
  pop.onclick = (e) => { const b = e.target.closest("button"); if (b) { set(b.dataset.bg); pop.classList.remove("open"); } e.stopPropagation(); };
  document.addEventListener("pointerdown", (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) pop.classList.remove("open"); });
  const readouts = document.querySelector(".readouts");
  if (readouts) readouts.append(btn);
  document.body.append(pop);
  function paintPicker() {
    btn.classList.toggle("on", mode === "fog");
    pop.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.bg === mode));
    const r = btn.getBoundingClientRect();
    pop.style.top = r.bottom + 8 + "px";
    pop.style.right = Math.max(8, innerWidth - r.right - 6) + "px";
  }

  // ------------------------------------------------------------------ the layer: smoke + dark veil
  const wrap = document.createElement("div");
  wrap.className = "k2-fog";
  wrap.setAttribute("aria-hidden", "true");
  const cv = document.createElement("canvas"), veil = document.createElement("div");
  veil.className = "veil";
  wrap.append(cv, veil);
  document.body.prepend(wrap);
  const g = cv.getContext("2d");
  let W = 0, H = 0, img = null, px = null;

  function resize() {
    const sc = document.getElementById("scroll");
    const r = sc ? sc.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    Object.assign(wrap.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    const w = GW, h = Math.max(24, Math.round(GW * (r.height / Math.max(1, r.width))));
    if (w === W && h === H) return;
    W = cv.width = w; H = cv.height = h;
    img = g.createImageData(W, H); px = new Uint32Array(img.data.buffer);
  }

  // ------------------------------------------------------------------ listening
  let an = null, spec = null, binOf = null;
  function tap() {
    if (an) return true;
    const d = window.purpPlaygroundDebug;
    if (!d || !d.ctx || !d.masterOut) return false;
    an = d.ctx.createAnalyser();
    an.fftSize = 2048; an.smoothingTimeConstant = 0.8;
    d.masterOut.connect(an);
    spec = new Uint8Array(an.frequencyBinCount);
    const hz = d.ctx.sampleRate / an.fftSize;   // NB log-spaced bands, 30 Hz to 16 kHz
    binOf = [];
    for (let i = 0; i <= NB; i++) binOf.push(Math.max(1, Math.round((30 * Math.pow(16000 / 30, i / NB)) / hz)));
    return true;
  }
  const band = new Float32Array(NB);           // smoothed loudness per band, 0..1
  let level = 0, bass = 0, prevBass = 0, lift = 0, flow = 0;
  function listen(dt) {
    const playing = typeof ui !== "undefined" && ui && ui.transport && (ui.transport.playing || ui.transport.recording);
    let sum = 0;
    if (playing && tap()) {
      an.getByteFrequencyData(spec);
      for (let i = 0; i < NB; i++) {
        let m = 0; for (let b = binOf[i]; b < Math.max(binOf[i] + 1, binOf[i + 1]); b++) m += spec[b];
        const v = Math.pow(m / Math.max(1, binOf[i + 1] - binOf[i]) / 255, 1.4) * (0.9 + 0.4 * i / NB);
        band[i] += (Math.min(1, v) - band[i]) * 0.12;   // slow, so the smoke swells instead of flickering
        sum += band[i];
      }
    } else for (let i = 0; i < NB; i++) { band[i] *= 0.96; sum += band[i]; }
    level += (sum / NB - level) * 0.08;
    const b = (band[0] + band[1] + band[2] + band[3]) / 4;
    if (b - prevBass > 0.05) lift = Math.min(1, lift + (b - prevBass) * 3);   // a kick lifts the smoke a little
    prevBass = b;
    bass += (b - bass) * 0.1;
    lift *= 0.92;
    flow += dt * (0.05 + bass * 0.22);           // the bass makes it curl faster
  }

  // ------------------------------------------------------------------ smoke
  // value noise on a 256 grid, smooth-stepped, a few octaves; domain warp gives the curls
  const perm = new Uint8Array(512), val = new Float32Array(256);
  { let s = 1234567; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = r(); }
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]; }
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]], c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    return noise(x, y) * 0.5 + noise(x * 2.03 + 17, y * 2.03 + 3) * 0.25 + noise(x * 4.1 + 41, y * 4.1 + 29) * 0.15 + noise(x * 8.3 + 7, y * 8.3 + 61) * 0.1;
  }

  function paint() {
    const t = flow, asp = W / H;
    for (let y = 0; y < H; y++) {
      const v = y / H;
      // smoke lives low and thins toward the top; a kick pushes it up a little
      const rise = Math.min(1, Math.max(0, (v - 0.12 + lift * 0.08) / 0.75));
      const height = rise * rise * (3 - 2 * rise);
      for (let x = 0; x < W; x++) {
        const u = x / W, sx = u * 2.6 * asp * 0.5, sy = v * 2.6;
        // warp: the field drifts up and sideways and folds into itself
        const wx = fbm(sx + t * 0.6, sy + t * 1.1), wy = fbm(sx - t * 0.4 + 5.2, sy + t * 0.9 + 1.3);
        const n = fbm(sx + wx * 1.6 - t * 0.2, sy + wy * 1.6 + t * 0.7);
        const loud = band[Math.min(NB - 1, (u * NB) | 0)];
        let d = (n - 0.36 + loud * 0.2 + level * 0.1) * 3.2;
        d = d <= 0 ? 0 : d >= 1 ? 1 : d * d * (3 - 2 * d);
        d *= height * (0.6 + loud * 0.5 + lift * 0.25);
        if (d <= 0.004) { px[y * W + x] = 0; continue; }
        // colour: ash grey with a purple glow in the thick parts (#7c5cf0 toward rgb(150, 146, 162))
        const p = Math.min(1, Math.max(0, wx - 0.45) * 2.2 + loud * 0.35);
        const r = (150 + (124 - 150) * p) | 0, gg = (146 + (92 - 146) * p) | 0, b = (162 + (240 - 162) * p) | 0;
        const a = (d * 255) | 0;
        px[y * W + x] = (a << 24) | (b << 16) | (gg << 8) | r;
      }
    }
    g.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------------ loop
  let raf = 0, last = 0;
  const shown = () => mode === "fog" && !document.hidden && !html.classList.contains("k2-rec") && !document.body.classList.contains("at-home");
  function frame(now) {
    raf = 0;
    if (mode !== "fog") return;
    raf = requestAnimationFrame(frame);
    if (!shown() || now - last < 1000 / FPS - 2) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    resize();
    listen(dt);
    const p0 = performance.now();
    paint();
    window.KT2Fog.ms = window.KT2Fog.ms * 0.9 + (performance.now() - p0) * 0.1;
  }

  function set(m) {
    mode = m === "fog" ? "fog" : "none";
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    html.classList.toggle("k2-fog", mode === "fog");
    if (mode === "fog" && !raf) raf = requestAnimationFrame(frame);
    paintPicker();
  }
  window.KT2Fog = { set, get: () => mode, ms: 0 };   // ms = how long one frame takes to paint
  set(mode);
})();
