// KILLDRUM FX: the portal circle, the canvas in the middle of the FX tab. It is Output Portal's XY
// circle, but every drum voice is a coloured dot inside the chosen effect's circle: the centre is
// subtle, the rim is extreme, and dot size = wet. The FX tab (ui/killdrum-fx.js) owns the state. This
// file draws the plain view that opts.get() returns each frame and reports gestures back
// (onPick / onMove / onWet / onHome). The contract is in CONTRACT.md, section 2.
//
//   const portal = KdFx.Portal.create(el, { get, onPick, onMove, onWet, onHome });
//   portal.hit(note, gain);   // pulse a dot now (the canvas also reads KdFx.events by the audio clock)
//   portal.destroy();
(function () {
  "use strict";
  const KdFx = (window.KdFx = window.KdFx || {});
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const num = (v, d) => (typeof v === "number" && v === v ? v : d);
  // the tab may hand notes over as "36" or 36: one key either way
  const keyOf = (n) => (typeof n === "string" && n !== "" && n !== "sync" && !isNaN(n) ? +n : n);
  const ACID = "#e4ff3a", LILAC = "#b79cff", PURPLE = "#8b5cf6", REC = "#ff3b4e", GREY = "#8c8c96";
  const SANS = '"Helvetica Neue", "Neue Haas Grotesk Text Pro", Inter, "Segoe UI", Helvetica, Arial, sans-serif';
  const DISPLAY = '"Archivo Black", "Archivo", "Arial Black", Impact, sans-serif';
  const NONE = [], DASH = [2, 4], SOLID = [];

  // Particle look per effect group. Matched on words, because the effect files come from different
  // people and may word their group a little differently.
  const STYLES = [
    [/GRAIN|GRANUL/, "grain"], [/DELAY|ECHO/, "echo"], [/REVERB|VERB/, "verb"],
    [/DISTORT|DESTRU|DIRT|DRIVE/, "dirt"], [/SPECTR|FILTER/, "spectral"], [/DYNAMIC|MOVEMENT/, "pulse"],
    [/GLITCH|CHAOS/, "glitch"],
  ];
  const styleOf = (group) => { const g = String(group || "").toUpperCase(); for (const [re, s] of STYLES) if (re.test(g)) return s; return "calm"; };

  // ------------------------------------------------------------------ colours
  // Each colour gets a soft glow sprite once. Drawing a sprite costs far less than shadowBlur, so
  // 600 glowing particles stay smooth.
  const pal = [], palIdx = new Map();
  let probe = null;
  function rgbOf(css) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(css);
    if (m) { const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1], n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    try { // any other CSS colour: let the browser parse it
      if (!probe) { const c = document.createElement("canvas"); c.width = c.height = 1; probe = c.getContext("2d", { willReadFrequently: true }); }
      probe.clearRect(0, 0, 1, 1); probe.fillStyle = LILAC; probe.fillStyle = css; probe.fillRect(0, 0, 1, 1);
      const d = probe.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) { return [183, 156, 255]; }
  }
  function colorIndex(css) {
    if (!css || typeof css !== "string") css = LILAC;
    let i = palIdx.get(css);
    if (i !== undefined) return i;
    if (pal.length > 200) return 0;
    const [r, g, b] = rgbOf(css);
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const x = s.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    const hot = (c) => Math.round(c + (255 - c) * 0.6);
    gr.addColorStop(0, `rgba(${hot(r)},${hot(g)},${hot(b)},1)`);
    gr.addColorStop(0.16, `rgba(${r},${g},${b},0.85)`);
    gr.addColorStop(0.42, `rgba(${r},${g},${b},0.2)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    pal.push({ css, sprite: s });
    palIdx.set(css, (i = pal.length - 1));
    return i;
  }
  const C_WHITE = colorIndex("#ffffff"), C_ACID = colorIndex(ACID), C_LILAC = colorIndex(LILAC), C_PURPLE = colorIndex(PURPLE);

  // particle kinds
  const K_DOT = 0, K_RING = 1, K_SPARK = 2, K_BLOCK = 3, K_STREAK = 4, K_PULSE = 5;
  const AMB_RATE = { calm: 14, grain: 34, echo: 9, verb: 11, dirt: 18, spectral: 13, pulse: 12, glitch: 10 };

  function create(el, opts) {
    opts = opts || {};
    const call = (fn, ...a) => { if (typeof fn === "function") try { fn(...a); } catch (e) { console.error("KdFx.Portal callback", e); } };
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    const cv = document.createElement("canvas");
    cv.className = "kdfx-portal";
    cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent";
    el.appendChild(cv);
    const ctx = cv.getContext("2d");
    const bg = document.createElement("canvas"), bgx = bg.getContext("2d");
    const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const fam = getComputedStyle(el).fontFamily || "";
    const font = /sans|helvetica|inter|arial|grotesk/i.test(fam) ? fam : SANS;

    // ---------------------------------------------------------------- geometry
    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 1, sc = 1, dirty = true, rimGlow = null;
    function measure() {
      const w = el.clientWidth, h = el.clientHeight, d = Math.min(3, window.devicePixelRatio || 1);
      if (w === W && h === H && d === dpr) return;
      W = w; H = h; dpr = d;
      cv.width = Math.max(1, Math.round(W * dpr));
      cv.height = Math.max(1, Math.round(H * dpr));
      // the circle fills the box but leaves room on the left for the vertical axis name and below for the X one
      const ML = 50, MR = 14, MT = 14, MB = 40;
      R = Math.max(30, Math.min(W - ML - MR, H - MT - MB) / 2);
      cx = ML + (W - ML - MR) / 2;
      cy = MT + (H - MT - MB) / 2;
      sc = clamp(R / 280, 0.45, 1.6);
      rimGlow = rimGradient(ctx);
      labelW.clear();
      dirty = true;
    }
    function rimGradient(g) {
      let gr;
      if (g.createConicGradient) {
        // as the CSS rim: conic "from 200deg" (CSS 0deg = up, canvas 0 = 3 o'clock, so 110deg here)
        gr = g.createConicGradient((110 * Math.PI) / 180, cx, cy);
        gr.addColorStop(0, PURPLE); gr.addColorStop(0.25, LILAC); gr.addColorStop(0.5, ACID); gr.addColorStop(0.75, LILAC); gr.addColorStop(1, PURPLE);
      } else {
        gr = g.createLinearGradient(cx - R, cy + R, cx + R, cy - R);
        gr.addColorStop(0, PURPLE); gr.addColorStop(0.5, LILAC); gr.addColorStop(1, ACID);
      }
      return gr;
    }
    // KdFx.xyToDisc, inlined so the frame loop allocates nothing (x, y: 0..1 square -> px in the circle)
    function toPx(x, y, out) {
      const X = clamp(num(x, 0.5)) * 2 - 1, Y = clamp(num(y, 0.5)) * 2 - 1;
      out.x = cx + X * Math.sqrt(1 - (Y * Y) / 2) * R;
      out.y = cy - Y * Math.sqrt(1 - (X * X) / 2) * R;
      return out;
    }

    // ---------------------------------------------------------------- the still layer (redrawn on resize / effect change)
    let kId, kName, kX, kY, kGroup, style = "calm";
    function buildStatic(eff) {
      dirty = false;
      bg.width = cv.width; bg.height = cv.height;
      const g = bgx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      // inside: a faint purple bloom in the middle and Portal's dot grid
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      gr.addColorStop(0, "rgba(139,92,246,0.12)");
      gr.addColorStop(0.62, "rgba(139,92,246,0.03)");
      gr.addColorStop(1, "rgba(139,92,246,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,255,255,0.07)";
      const step = 22, n = Math.ceil(R / step), lim = (R - 8) * (R - 8);
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
        const dx = i * step, dy = j * step;
        if (dx * dx + dy * dy < lim) g.fillRect(cx + dx - 0.6, cy + dy - 0.6, 1.2, 1.2);
      }
      // guide rings at a third and two thirds: how deep the effect goes
      g.strokeStyle = "rgba(255,255,255,0.045)"; g.lineWidth = 1;
      for (let k = 1; k <= 2; k++) { g.beginPath(); g.arc(cx, cy, (R * k) / 3, 0, TAU); g.stroke(); }
      // the rim: 2 px, purple -> lilac -> acid
      g.strokeStyle = rimGradient(g); g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, R - 1, 0, TAU); g.stroke();
      // home: the centre is dry
      g.fillStyle = "rgba(236,236,238,0.42)";
      g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill();
      g.textAlign = "center"; g.textBaseline = "middle";
      if (!eff) {
        g.font = `700 10px ${font}`; g.letterSpacing = "3px";
        g.fillStyle = "rgba(236,236,238,0.3)";
        g.fillText("PICK AN EFFECT", cx, cy + 26);
        g.letterSpacing = "0px";
        return;
      }
      // the effect's name, faint, inside the top of the circle
      g.font = `900 ${Math.round(12 * clamp(sc, 0.85, 1.25))}px ${DISPLAY}`; g.letterSpacing = "4px";
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fillText(String(eff.name || "").toUpperCase(), cx + 2, cy - R * 0.8);
      // axis names joined by an L, like Portal: Y reads upward on the left (lilac), X sits under the circle (acid)
      const D = R * 2, ax = eff.axes || {};
      g.strokeStyle = "rgba(236,236,238,0.32)"; g.lineWidth = 1;
      const x0 = Math.round(cx - R - 22) + 0.5, y1 = Math.round(cy + R + 18) + 0.5, bw = D * 0.15, bh = D * 0.3, rr = 6;
      g.beginPath(); g.moveTo(x0, y1 - bh); g.lineTo(x0, y1 - rr); g.arcTo(x0, y1, x0 + rr, y1, rr); g.lineTo(x0 + bw, y1); g.stroke();
      g.font = `800 11px ${font}`; g.letterSpacing = "3.7px"; g.textAlign = "left";
      g.save();
      g.translate(cx - R - 34, cy + R - D * 0.16); g.rotate(-Math.PI / 2);
      g.fillStyle = LILAC; g.textBaseline = "bottom";
      g.fillText(String(ax.y || "").toUpperCase(), 0, 0);
      g.restore();
      g.fillStyle = ACID; g.textBaseline = "middle";
      g.fillText(String(ax.x || "").toUpperCase(), cx - R + D * 0.14, y1);
      g.letterSpacing = "0px";
    }

    // ---------------------------------------------------------------- particles: pooled typed arrays, nothing allocated per frame
    const N = 600;
    const PX = new Float32Array(N), PY = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N);
    const AGE = new Float32Array(N), LIFE = new Float32Array(N), SIZE = new Float32Array(N), AUX = new Float32Array(N);
    const AMP = new Float32Array(N), DRAG = new Float32Array(N), COL = new Uint8Array(N), KIND = new Uint8Array(N), AMB = new Uint8Array(N);
    let np = 0, recycle = 0, nBurst = 0;
    // aux: dot = tail (s of travel), ring/pulse = growth px/s, spark = jitter px, streak = length px
    function spawn(kind, x, y, vx, vy, life, size, col, aux, amp, drag, delay, amb) {
      let i;
      if (np < N) i = np++;
      else { i = recycle; recycle = (recycle + 1) % N; } // full: reuse the oldest-ish slot
      PX[i] = x; PY[i] = y; VX[i] = vx; VY[i] = vy; AGE[i] = -(delay || 0); LIFE[i] = life; SIZE[i] = size;
      COL[i] = col; KIND[i] = kind; AUX[i] = aux || 0; AMP[i] = amp == null ? 1 : amp; DRAG[i] = drag || 0; AMB[i] = amb ? 1 : 0;
    }
    function kill(i) {
      const j = --np;
      if (i === j) return;
      PX[i] = PX[j]; PY[i] = PY[j]; VX[i] = VX[j]; VY[i] = VY[j]; AGE[i] = AGE[j]; LIFE[i] = LIFE[j]; SIZE[i] = SIZE[j];
      COL[i] = COL[j]; KIND[i] = KIND[j]; AUX[i] = AUX[j]; AMP[i] = AMP[j]; DRAG[i] = DRAG[j]; AMB[i] = AMB[j];
    }
    function stepParticles(dt) {
      nBurst = 0;
      for (let i = 0; i < np; i++) {
        AGE[i] += dt;
        if (AGE[i] >= LIFE[i]) { kill(i); i--; continue; }
        if (!AMB[i]) nBurst++;
        if (AGE[i] < 0) continue;
        if (DRAG[i]) { const f = Math.exp(-DRAG[i] * dt); VX[i] *= f; VY[i] *= f; }
        PX[i] += VX[i] * dt; PY[i] += VY[i] * dt;
        // glitch bits hop around on a grid now and then
        if (KIND[i] === K_BLOCK && Math.random() < dt * 8) { PX[i] += (Math.random() - 0.5) * 16 * sc; PY[i] += (Math.random() - 0.5) * 16 * sc; }
      }
    }
    function drawParticles(breathK) {
      for (let i = 0; i < np; i++) {
        const age = AGE[i];
        if (age < 0) continue;
        const t = age / LIFE[i];
        const env = AMB[i] ? Math.sin(Math.PI * t) : (1 - t) * (1 - t);
        const a = env * AMP[i] * pw;
        if (a < 0.01) continue;
        const c = pal[COL[i]];
        let x = PX[i], y = PY[i];
        if (AMB[i] && breathK !== 1) { x = cx + (x - cx) * breathK; y = cy + (y - cy) * breathK; }
        ctx.globalAlpha = a > 1 ? 1 : a;
        switch (KIND[i]) {
          case K_DOT: {
            const s = SIZE[i] * 3.4;
            if (AUX[i] > 0) { // a short streak behind it, Portal's flying motes
              ctx.strokeStyle = c.css; ctx.lineWidth = SIZE[i] * 0.7;
              ctx.beginPath(); ctx.moveTo(x - VX[i] * AUX[i], y - VY[i] * AUX[i]); ctx.lineTo(x, y); ctx.stroke();
            }
            ctx.drawImage(c.sprite, x - s, y - s, s * 2, s * 2);
            break;
          }
          case K_RING: {
            ctx.strokeStyle = c.css; ctx.lineWidth = SIZE[i] > 0 && !AMB[i] ? 1.3 : 1;
            ctx.beginPath(); ctx.arc(x, y, SIZE[i] + AUX[i] * age, 0, TAU); ctx.stroke();
            break;
          }
          case K_SPARK: {
            const j = AUX[i], sp = Math.hypot(VX[i], VY[i]) || 1, L = Math.max(3, sp * 0.035);
            const x0 = x + (Math.random() - 0.5) * j * 2, y0 = y + (Math.random() - 0.5) * j * 2;
            ctx.strokeStyle = c.css; ctx.lineWidth = SIZE[i];
            ctx.beginPath(); ctx.moveTo(x0, y0);
            ctx.lineTo(x0 - (VX[i] / sp) * L + (Math.random() - 0.5) * j * 2, y0 - (VY[i] / sp) * L + (Math.random() - 0.5) * j * 2);
            ctx.stroke();
            break;
          }
          case K_BLOCK: {
            if (Math.random() < 0.16) break; // blink
            const gsz = 6 * sc, s = SIZE[i];
            ctx.fillStyle = c.css;
            ctx.fillRect(Math.round(x / gsz) * gsz - s / 2, Math.round(y / gsz) * gsz - s / 2, s, s);
            break;
          }
          case K_STREAK: {
            const sp = Math.hypot(VX[i], VY[i]) || 1, L = AUX[i];
            ctx.strokeStyle = c.css; ctx.lineWidth = SIZE[i];
            ctx.beginPath(); ctx.moveTo(x - (VX[i] / sp) * L, y - (VY[i] / sp) * L); ctx.lineTo(x, y); ctx.stroke();
            break;
          }
          case K_PULSE: {
            const s = SIZE[i] + AUX[i] * age;
            ctx.drawImage(c.sprite, x - s, y - s, s * 2, s * 2);
            break;
          }
        }
      }
    }

    // A hit: louder and further out = more. Each effect group has its own picture.
    function burst(x, y, r0, ci, g, amt) {
      amt = clamp(amt);
      if (reduced) { spawn(K_RING, x, y, 0, 0, 0.5, r0, ci, 70 * sc, 0.4 + 0.5 * g); return; }
      const m = (0.4 + 0.8 * g) * (0.55 + 0.9 * amt);
      let ux = x - cx, uy = y - cy;
      const dl = Math.hypot(ux, uy);
      if (dl < 3) { const a = Math.random() * TAU; ux = Math.cos(a); uy = Math.sin(a); } else { ux /= dl; uy /= dl; }
      const out = Math.atan2(uy, ux);
      switch (style) {
        case "grain": { // grains scatter: a cloud of tiny dots slowed by the air
          const n = Math.round(12 + 30 * m);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU, c = Math.cos(a), s = Math.sin(a), sp = rnd(18, 150) * sc * (0.6 + amt);
            spawn(K_DOT, x + c * r0 * 0.8, y + s * r0 * 0.8, c * sp, s * sp, rnd(0.45, 1.3), rnd(0.5, 1.4), Math.random() < 0.15 ? C_WHITE : ci, 0, rnd(0.5, 1), 2.6);
          }
          break;
        }
        case "echo": { // echoes ripple: one ring per repeat, each one later and fainter
          const reps = 3 + Math.round(amt * 2), gap = 0.1 + 0.09 * (1 - amt);
          for (let i = 0; i < reps; i++) spawn(K_RING, x, y, 0, 0, 0.8, r0, ci, (80 + 40 * amt) * sc, (0.9 - i * 0.16) * (0.45 + 0.55 * g), 0, i * gap);
          for (let i = 0; i < 6; i++) {
            const a = out + rnd(-1.4, 1.4), sp = rnd(30, 110) * sc;
            spawn(K_DOT, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.5, 1), rnd(0.6, 1.2), ci, 0.08, rnd(0.4, 0.9), 1.6, i * gap * 0.5);
          }
          break;
        }
        case "verb": { // a wide slow swell and a haze that hangs in the air
          spawn(K_RING, x, y, 0, 0, 1.5, r0, ci, 115 * sc, 0.5 * (0.5 + g));
          spawn(K_PULSE, x, y, 0, 0, 1.1, r0 * 1.4, ci, 55 * sc, 0.28 * (0.5 + g));
          const n = Math.round(8 + 16 * m);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU, c = Math.cos(a), s = Math.sin(a), sp = rnd(6, 42) * sc;
            spawn(K_DOT, x + c * r0, y + s * r0, c * sp, s * sp, rnd(1.2, 2.6), rnd(0.6, 1.3), ci, 0, rnd(0.3, 0.7), 0.8);
          }
          break;
        }
        case "dirt": { // distortion jitters: fast hot sparks that shake as they fly
          const n = Math.round(10 + 26 * m);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU, c = Math.cos(a), s = Math.sin(a), sp = rnd(70, 280) * sc * (0.6 + amt);
            spawn(K_SPARK, x + c * r0, y + s * r0, c * sp, s * sp, rnd(0.12, 0.38), rnd(0.8, 1.6), Math.random() < 0.3 ? C_WHITE : ci, rnd(1.5, 4) * (0.5 + amt), rnd(0.6, 1), 4);
          }
          spawn(K_RING, x, y, 0, 0, 0.22, r0, C_WHITE, 160 * sc, 0.45 * g);
          break;
        }
        case "spectral": { // thin radial streaks shooting out along the line from the centre through the dot
          const n = Math.round(6 + 14 * m);
          for (let i = 0; i < n; i++) {
            const a = out + rnd(-0.55, 0.55), c = Math.cos(a), s = Math.sin(a), sp = rnd(120, 340) * sc;
            spawn(K_STREAK, x + c * r0, y + s * r0, c * sp, s * sp, rnd(0.25, 0.6), rnd(0.7, 1.3), Math.random() < 0.25 ? C_WHITE : ci, rnd(14, 48) * sc, rnd(0.5, 1), 1.5);
          }
          break;
        }
        case "pulse": { // dynamics: the space breathes, a soft swell and two rings
          spawn(K_PULSE, x, y, 0, 0, 0.55, r0, ci, r0 * 4.5, 0.5 * (0.4 + g));
          spawn(K_RING, x, y, 0, 0, 0.6, r0, ci, 90 * sc, 0.7 * (0.4 + g));
          spawn(K_RING, x, y, 0, 0, 0.6, r0, ci, 90 * sc, 0.4 * (0.4 + g), 0, 0.12);
          break;
        }
        case "glitch": { // blocky pixel bits that snap to a grid and blink
          const n = Math.round(6 + 16 * m), spread = r0 + 34 * sc * (0.5 + amt);
          for (let i = 0; i < n; i++) {
            spawn(K_BLOCK, x + rnd(-1, 1) * spread, y + rnd(-1, 1) * spread, rnd(-30, 30) * sc, rnd(-30, 30) * sc, rnd(0.15, 0.55), rnd(2, 7) * Math.max(0.7, sc), Math.random() < 0.3 ? C_ACID : ci, 0, rnd(0.6, 1));
          }
          break;
        }
        default: { // calm Portal look: a ring and a few motes streaking outward
          spawn(K_RING, x, y, 0, 0, 0.5, r0, ci, 80 * sc, 0.6 * (0.4 + g));
          const n = Math.round(6 + 12 * m);
          for (let i = 0; i < n; i++) {
            const a = out + rnd(-1.2, 1.2), sp = rnd(40, 160) * sc;
            spawn(K_DOT, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.4, 1), rnd(0.6, 1.3), ci, 0.06, rnd(0.5, 1), 1.8);
          }
        }
      }
    }

    // The calm field when nothing plays. Further-out dots make it busier.
    const ambCols = new Uint8Array(32);
    let nAmbCols = 0, ambAcc = 0, ringAcc = 0;
    function ambCol() {
      const r = Math.random();
      if (r < 0.4) return C_WHITE;
      if (r < 0.62) return C_LILAC;
      if (r < 0.7) return style === "glitch" ? C_ACID : C_PURPLE;
      return nAmbCols ? ambCols[(Math.random() * nAmbCols) | 0] : C_ACID;
    }
    function spawnAmbient() {
      const a = Math.random() * TAU, c = Math.cos(a), s = Math.sin(a), ci = ambCol();
      switch (style) {
        case "grain": { const rr = Math.sqrt(Math.random()) * R * 0.94, sp = rnd(2, 10) * sc, b = Math.random() * TAU; spawn(K_DOT, cx + c * rr, cy + s * rr, Math.cos(b) * sp, Math.sin(b) * sp, rnd(1.2, 3.2), rnd(0.5, 1.1), ci, 0, rnd(0.35, 0.8), 0, 0, 1); break; }
        case "dirt": { const rr = Math.sqrt(Math.random()) * R * 0.92, sp = rnd(8, 40) * sc; spawn(K_SPARK, cx + c * rr, cy + s * rr, c * sp, s * sp, rnd(0.18, 0.6), rnd(0.7, 1.2), ci, rnd(1, 2.5), rnd(0.3, 0.7), 0, 0, 1); break; }
        case "spectral": { const r0 = rnd(0.04, 0.35) * R, sp = rnd(25, 80) * sc; spawn(K_STREAK, cx + c * r0, cy + s * r0, c * sp, s * sp, rnd(1, 2.6), rnd(0.6, 1), ci, rnd(6, 28) * sc, rnd(0.25, 0.6), 0, 0, 1); break; }
        case "glitch": { const rr = Math.sqrt(Math.random()) * R * 0.9; spawn(K_BLOCK, cx + c * rr, cy + s * rr, 0, 0, rnd(0.08, 0.5), rnd(2, 6) * Math.max(0.7, sc), ci, 0, rnd(0.25, 0.7), 0, 0, 1); break; }
        case "verb": { const rr = Math.sqrt(Math.random()) * R * 0.85, sp = rnd(3, 10) * sc; spawn(K_DOT, cx + c * rr, cy + s * rr, c * sp, s * sp, rnd(3, 6), rnd(0.6, 1.4), ci, 0, rnd(0.2, 0.5), 0, 0, 1); break; }
        default: { // calm / echo / pulse: motes drifting out of the middle with short tails
          const r0 = rnd(0, 0.12) * R, sp = rnd(10, 34) * sc;
          spawn(K_DOT, cx + c * r0, cy + s * r0, c * sp, s * sp, rnd(3, 6.5), rnd(0.6, 1.3), ci, 0.3, rnd(0.3, 0.75), 0, 0, 1);
        }
      }
    }
    function ambient(dt) {
      if (reduced) return;
      ambAcc += AMB_RATE[style] * (0.55 + 1.1 * amtAvg) * dt;
      while (ambAcc >= 1) { ambAcc -= 1; if (np < 360) spawnAmbient(); }
      // echo / reverb / dynamics: a slow ring or swell out of the middle, the space breathing
      const period = style === "echo" ? 1.9 : style === "verb" ? 3.2 : style === "pulse" ? 2.2 : 0;
      if (!period || (ringAcc += dt) < period) return;
      ringAcc = 0;
      if (style === "pulse") spawn(K_PULSE, cx, cy, 0, 0, period * 1.2, 4, C_LILAC, (R * 0.5) / (period * 1.2), 0.1, 0, 0, 1);
      else spawn(K_RING, cx, cy, 0, 0, period * 1.5, 4, C_LILAC, (R * 0.95) / (period * 1.5), style === "verb" ? 0.12 : 0.18, 0, 0, 1);
    }

    // ---------------------------------------------------------------- dots
    const states = new Map();
    function stOf(key) {
      let s = states.get(key);
      if (!s) { s = { key, note: key, x: NaN, y: NaN, r: NaN, a: 0, pulse: 0, seen: -9, ci: C_LILAC, sel: false, dim: false, on: true, d: null, lx: 0, ly: 0 }; states.set(key, s); }
      return s;
    }
    const drawn = [];          // dot states in draw order (dim, normal, selected), for hit tests and labels
    const tmp = { x: 0, y: 0 }, tmp2 = { x: 0, y: 0 };
    const segPulse = new Float32Array(32);
    const EMPTY = { effect: null, dots: NONE, sync: false, syncDot: null, syncColors: NONE, now: null };
    let view = EMPTY, frameId = 0, T = 0, moving = false, amtAvg = 0, flash = 0, breath = 0, pw = 1;
    // R held = record a motion path. The tab swallows R (so the app does not start recording) and sets KdFx.recKey.
    const recHeld = () => !!KdFx.recKey || keys.r;
    let hovered = null, drag = null, wetHold = null, lastTap = null;
    function glide(s, x, y, k) {
      if (s.x !== s.x) { s.x = x; s.y = y; return; } // first sight: no fly-in from the corner
      const dx = x - s.x, dy = y - s.y;
      if (dx * dx + dy * dy > 0.04) moving = true;
      s.x += dx * k; s.y += dy * k;
    }
    function updateDots(dt) {
      const dots = view.dots || NONE, sync = !!view.sync, sd = view.syncDot;
      const kPos = 1 - Math.exp(-dt * 14), kFast = 1 - Math.exp(-dt * 40), kR = 1 - Math.exp(-dt * 12), kA = 1 - Math.exp(-dt * 9), kS = 1 - Math.exp(-dt * 22), decay = Math.exp(-dt * 7);
      moving = false;
      // the merged SYNC dot
      const ms = stOf("sync");
      if (sd) {
        const src = sd.live || sd;
        toPx(src.x, src.y, tmp);
        let k = sd.live ? kFast : kPos;
        if (drag && drag.started && drag.target === "sync") { tmp.x = drag.x; tmp.y = drag.y; k = 1; }
        glide(ms, tmp.x, tmp.y, k);
        const tr = 11 + clamp(num(sd.wet, 0.5)) * 16;
        ms.r = ms.r === ms.r ? ms.r + (tr - ms.r) * kR : tr;
        ms.seen = frameId;
      }
      ms.a += ((sync && sd ? 1 : 0) - ms.a) * kA;
      ms.pulse *= decay;
      for (let i = 0; i < 32; i++) segPulse[i] *= decay;
      let sum = 0, cnt = 0;
      nAmbCols = 0;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (!d || d.note == null) continue;
        const s = stOf(keyOf(d.note));
        s.d = d; s.note = d.note; s.seen = frameId; s.ci = colorIndex(d.color); s.sel = !!d.sel; s.dim = !!d.dim; s.on = d.on !== false;
        const src = d.live || d;
        toPx(src.x, src.y, tmp);
        let k = d.live ? kFast : kPos;
        if (drag && drag.started && drag.target !== "sync" && keyOf(drag.target) === s.key) { tmp.x = drag.x; tmp.y = drag.y; k = 1; }
        if (sync && sd && ms.x === ms.x) { tmp.x = ms.x; tmp.y = ms.y; k = kPos; } // fold into the merged dot
        glide(s, tmp.x, tmp.y, k);
        const tr = 7 + clamp(num(d.wet, 0.5)) * 16;
        s.r = s.r === s.r ? s.r + (tr - s.r) * kR : tr;
        const ta = sync ? 0 : 1; // SYNC: only the merged dot shows (the others fold into it fast)
        s.a += (ta - s.a) * (sync ? kS : kA);
        if (Math.abs(s.a - ta) > 0.01) moving = true;
        s.pulse *= decay;
        if (s.on && !s.dim) { sum += Math.hypot(s.x - cx, s.y - cy) / R; cnt++; }
        if (nAmbCols < 32 && s.on) ambCols[nAmbCols++] = s.ci;
      }
      if (sync && sd && ms.x === ms.x) { sum = Math.hypot(ms.x - cx, ms.y - cy) / R; cnt = 1; }
      amtAvg += ((cnt ? sum / cnt : 0) - amtAvg) * kA;
      // draw order: greyed-out first, then the rest, the selected on top
      drawn.length = 0;
      for (let pass = 0; pass < 3; pass++) for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (!d || d.note == null) continue;
        const s = states.get(keyOf(d.note));
        if (!s || s.seen !== frameId || (s.sel ? 2 : s.dim ? 0 : 1) !== pass) continue;
        drawn.push(s);
      }
      flash *= Math.exp(-dt * 5);
      breath *= Math.exp(-dt * 3);
    }
    const colorOfNote = (note) => {
      const s = states.get(keyOf(note));
      if (s && s.d && s.d.color) return s.d.color;
      const v = KdFx.voiceByNote && KdFx.voiceByNote[note];
      return v ? v.color : LILAC;
    };

    function hit(note, gain) {
      if (dead) return;
      const g = clamp(num(+gain, 0.8));
      const ms = states.get("sync");
      if (view.sync && ms && ms.x === ms.x && ms.a > 0.2) {
        flash = Math.max(flash, 0.2 + 0.45 * g);
        ms.pulse = Math.max(ms.pulse, 0.3 + 0.7 * g);
        const col = colorOfNote(note), k = (view.syncColors || NONE).indexOf(col);
        if (k >= 0 && k < 32) segPulse[k] = 1;
        burst(ms.x, ms.y, ms.r, colorIndex(col), g, Math.hypot(ms.x - cx, ms.y - cy) / R);
        if (style === "pulse") breath = Math.min(1.2, breath + 0.45 * g);
        return;
      }
      const s = states.get(keyOf(note));
      if (!s || s.x !== s.x || frameId - s.seen > 2) return; // not a voice in this view
      s.pulse = Math.max(s.pulse, 0.3 + 0.7 * g);
      if (!s.on || s.a < 0.2) return; // bypassed: the dot blinks, no effect picture
      flash = Math.max(flash, 0.2 + 0.45 * g);
      burst(s.x, s.y, s.r, s.ci, g * (s.dim ? 0.45 : 1), Math.hypot(s.x - cx, s.y - cy) / R);
      if (style === "pulse") breath = Math.min(1.2, breath + 0.45 * g);
    }
    // non-hit events ("grain"...): a little sparkle on the dot
    function sparkle(note, gain) {
      const sync = view.sync, s = states.get(sync ? "sync" : keyOf(note));
      if (!s || s.x !== s.x || reduced) return;
      const ci = colorIndex(colorOfNote(note)), g = clamp(num(+gain, 0.5));
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TAU, sp = rnd(20, 70) * sc;
        spawn(K_DOT, s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.3, 0.7), rnd(0.5, 1), ci, 0, 0.4 + 0.5 * g, 2);
      }
    }
    // Picture events: hits fire when the audio clock reaches them, so the pulse lands with the sound.
    const seenEv = new WeakSet();
    function pollEvents() {
      const ev = KdFx.events;
      if (!ev || !ev.length) return;
      let now = view.now;
      if (now == null && typeof KdFx.now === "function") now = KdFx.now();
      if (typeof now !== "number" || !isFinite(now)) return;
      for (let i = ev.length - 1, k = 0; i >= 0 && k < 600; i--, k++) {
        const e = ev[i];
        if (!e || typeof e.t !== "number") continue;
        if (e.t < now - 2) break; // pushed in time order: the rest is long gone
        if (e.t > now || e.t < now - 0.25 || seenEv.has(e)) continue;
        seenEv.add(e);
        if (!e.kind || e.kind === "hit") hit(e.note, e.gain); else sparkle(e.note, e.gain);
      }
    }

    // ---------------------------------------------------------------- drawing
    const labelW = new Map();
    const LR = new Float32Array(4 * 64);
    function ring(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(bg, 0, 0, W, H);
      // the rim glows and flashes softly with the beat
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (0.1 + 0.4 * Math.min(1, flash)) * pw;
      ctx.strokeStyle = rimGlow; ctx.lineWidth = 7;
      ring(cx, cy, R - 1);
      ctx.globalAlpha = (0.025 + 0.16 * Math.min(1, flash)) * pw;
      ctx.lineWidth = 11;
      ring(cx, cy, R + 2);
      // the particle field, kept inside the portal
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R - 1.5, 0, TAU); ctx.clip();
      ctx.lineCap = "round";
      drawParticles(style === "pulse" ? 1 + 0.07 * breath + 0.02 * Math.sin(T * 1.7) : 1);
      ctx.restore();
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      drawTrails();
      drawGuides();
      for (let i = 0; i < drawn.length; i++) drawDot(drawn[i]);
      drawSync();
      drawLabels();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    function drawTrails() {
      const dots = view.dots || NONE, sync = !!(view.sync && view.syncDot);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (let i = sync ? -1 : 0; i < (sync ? 0 : dots.length); i++) {
        const d = i < 0 ? view.syncDot : dots[i], tr = d && d.trail;
        if (!tr || tr.length < 2) continue;
        const s = i < 0 ? states.get("sync") : states.get(keyOf(d.note));
        if (!s || s.seen !== frameId) continue;
        ctx.beginPath();
        for (let j = 0; j < tr.length; j++) {
          const p = tr[j];
          if (!p) continue;
          toPx(Array.isArray(p) ? p[0] : p.x, Array.isArray(p) ? p[1] : p.y, tmp);
          if (j) ctx.lineTo(tmp.x, tmp.y); else ctx.moveTo(tmp.x, tmp.y);
        }
        const a = s.a * pw * (s.dim ? 0.3 : 1);
        ctx.strokeStyle = i < 0 ? LILAC : pal[s.ci].css;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.14 * a; ctx.lineWidth = 9; ctx.stroke();
        ctx.globalAlpha = 0.22 * a; ctx.lineWidth = 4; ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.8 * a; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // where a moving dot really lives (ghost), and a hairline from home to the selected dots
    function drawGuides() {
      const sync = !!view.sync;
      ctx.setLineDash(DASH);
      ctx.lineWidth = 1;
      for (let i = 0; i < drawn.length; i++) {
        const s = drawn[i], d = s.d;
        if (s.a < 0.05) continue;
        if (s.sel && !sync) {
          ctx.globalAlpha = 0.22 * s.a; ctx.strokeStyle = "#ffffff";
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(s.x, s.y); ctx.stroke();
        }
        if (d.live && !sync) {
          toPx(d.x, d.y, tmp);
          if (Math.hypot(tmp.x - s.x, tmp.y - s.y) > 3) {
            ctx.strokeStyle = pal[s.ci].css;
            ctx.globalAlpha = 0.3 * s.a * (s.dim ? 0.5 : 1);
            ctx.beginPath(); ctx.moveTo(tmp.x, tmp.y); ctx.lineTo(s.x, s.y); ctx.stroke();
            ctx.setLineDash(SOLID);
            ctx.globalAlpha = 0.55 * s.a * (s.dim ? 0.5 : 1);
            ring(tmp.x, tmp.y, Math.max(4, s.r * 0.6));
            ctx.setLineDash(DASH);
          }
        }
      }
      ctx.setLineDash(SOLID);
      // SYNC + Alt: show the constellation that moves along with the merged dot
      const ms = states.get("sync");
      if (sync && ms && ms.a > 0.05 && (keys.alt || (drag && drag.target === "sync" && drag.alt))) {
        const dots = view.dots || NONE;
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          if (!d) continue;
          toPx(d.x, d.y, tmp);
          ctx.strokeStyle = d.color || LILAC; ctx.lineWidth = 1;
          ctx.globalAlpha = 0.16 * ms.a;
          ctx.beginPath(); ctx.moveTo(ms.x, ms.y); ctx.lineTo(tmp.x, tmp.y); ctx.stroke();
          ctx.globalAlpha = 0.7 * ms.a; ctx.lineWidth = 1.5;
          ring(tmp.x, tmp.y, 5);
        }
      }
      ctx.globalAlpha = 1;
    }
    function drawDot(s) {
      const a = s.a * pw;
      if (a < 0.02) return;
      const c = pal[s.ci], dim = s.dim, on = s.on, p = s.pulse, d = s.d;
      let x = s.x, y = s.y;
      if (style === "dirt" && p > 0.05 && !reduced) { x += (Math.random() - 0.5) * 5 * p; y += (Math.random() - 0.5) * 5 * p; } // distortion shakes the dot
      const r = s.r * (1 + 0.3 * p);
      if (view.sync && a < 0.08) return;
      if (!dim && on) { // glow
        ctx.globalCompositeOperation = "lighter";
        const gs = r * (2.4 + 2.2 * p + (s.sel ? 0.9 : 0));
        ctx.globalAlpha = a * Math.min(1, 0.26 + 0.6 * p + (s.sel ? 0.22 : 0));
        ctx.drawImage(c.sprite, x - gs, y - gs, gs * 2, gs * 2);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      if (on) {
        ctx.globalAlpha = a * (dim ? 0.35 : 1);
        ctx.fillStyle = dim ? GREY : c.css; ctx.fill();
        ctx.globalAlpha = a * 0.5; ctx.lineWidth = 1; ctx.strokeStyle = "rgba(8,8,10,0.9)"; ctx.stroke(); // keeps stacked dots apart
      } else { // bypassed voice: just an outline
        ctx.globalAlpha = a * (dim ? 0.3 : 0.6); ctx.lineWidth = 1.5; ctx.strokeStyle = dim ? GREY : c.css; ctx.stroke();
      }
      if (p > 0.04 && on) { // a hot core flashes on each hit
        ctx.globalAlpha = a * p * (dim ? 0.4 : 0.9); ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fill();
      }
      if (s.sel) {
        ctx.globalAlpha = a; ctx.lineWidth = 1.5; ctx.strokeStyle = "#ffffff"; ring(x, y, r + 4.5);
        ctx.globalAlpha = a * 0.35; ctx.lineWidth = 1; ctx.strokeStyle = c.css; ring(x, y, r + 9);
      } else if (hovered != null && keyOf(hovered) === s.key) {
        ctx.globalAlpha = a * 0.5; ctx.lineWidth = 1; ctx.strokeStyle = "#ffffff"; ring(x, y, r + 4);
      }
      if ((d && d.rec) || (drag && drag.started && recHeld() && drag.target !== "sync" && keyOf(drag.target) === s.key)) { // recording a path: red, the only red on screen
        const q = 0.5 + 0.5 * Math.sin(T * 9);
        ctx.globalAlpha = a * (0.55 + 0.45 * q); ctx.lineWidth = 2; ctx.strokeStyle = REC; ring(x, y, r + 6 + 3 * q);
      }
      ctx.globalAlpha = 1;
    }
    function drawSync() {
      const ms = states.get("sync");
      if (!ms || ms.a < 0.02 || ms.x !== ms.x) return;
      const cols = view.syncColors && view.syncColors.length ? view.syncColors : NONE, n = Math.max(1, cols.length);
      const a = ms.a * pw, p = ms.pulse, x = ms.x, y = ms.y, r = ms.r * (1 + 0.25 * p);
      ctx.globalCompositeOperation = "lighter";
      const gs = r * (2.6 + 2 * p);
      ctx.globalAlpha = a * Math.min(1, 0.32 + 0.5 * p);
      ctx.drawImage(pal[C_LILAC].sprite, x - gs, y - gs, gs * 2, gs * 2);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a; ctx.fillStyle = "#141418";
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      // a ring of coloured segments: which voices are inside
      const lw = Math.max(3.5, r * 0.3), gap = n > 1 ? Math.min(0.24, (TAU / n) * 0.28) : 0;
      ctx.lineCap = "butt";
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i * TAU) / n + gap / 2, sp = segPulse[i];
        ctx.lineWidth = lw + 2.5 * sp; ctx.strokeStyle = cols[i] || LILAC; ctx.globalAlpha = a * (0.82 + 0.18 * sp);
        ctx.beginPath(); ctx.arc(x, y, r - lw / 2, a0, a0 + TAU / n - gap); ctx.stroke();
      }
      ctx.lineCap = "round";
      ctx.globalAlpha = a * (0.85 + 0.15 * p); ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(x, y, r * 0.26 * (1 + 0.5 * p), 0, TAU); ctx.fill();
      ctx.globalAlpha = a * 0.9; ctx.lineWidth = 1.5; ctx.strokeStyle = "#ffffff"; ring(x, y, r + 5);
      const sd = view.syncDot;
      if ((sd && sd.rec) || (drag && drag.started && drag.target === "sync" && recHeld())) {
        const q = 0.5 + 0.5 * Math.sin(T * 9);
        ctx.globalAlpha = a * (0.55 + 0.45 * q); ctx.lineWidth = 2; ctx.strokeStyle = REC; ring(x, y, r + 8 + 3 * q);
      }
      ctx.font = `700 9px ${font}`; ctx.letterSpacing = "1.6px"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      ctx.globalAlpha = a * 0.9; ctx.fillStyle = "#ffffff";
      ctx.fillText("SYNC", x + r + 10, y);
      ctx.letterSpacing = "0px"; ctx.globalAlpha = 1;
    }
    function textW(label) {
      let w = labelW.get(label);
      if (w === undefined) { w = ctx.measureText(label).width; labelW.set(label, w); }
      return w;
    }
    // tiny names beside the dots, nudged down when two would overlap (selected ones claim space first)
    function labelHits(x, y, w, h, nl) {
      for (let j = 0; j < nl; j++) {
        const o = j * 4;
        if (x < LR[o] + LR[o + 2] + 2 && x + w + 2 > LR[o] && y - h / 2 < LR[o + 1] + h / 2 && y + h / 2 > LR[o + 1] - h / 2) return true;
      }
      return false;
    }
    function drawLabels() {
      if (view.sync) return; // only the merged dot's "SYNC" label
      ctx.font = `700 9px ${font}`; ctx.letterSpacing = "1.6px"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      let nl = 0;
      for (let i = drawn.length - 1; i >= 0; i--) {
        const s = drawn[i];
        if (s.a < 0.05 || nl >= 64) continue;
        const label = String((s.d && s.d.label) || "");
        if (!label) { s.lx = NaN; continue; }
        const w = textW(label), h = 11;
        const off = s.r + (s.sel ? 14 : 7); // clear of the selection rings
        const right = s.x + off + w <= W - 4, x1 = right ? s.x + off : s.x - off - w, x2 = right ? s.x - off - w : s.x + off;
        let lx = x1, ly = s.y;
        // stacked dots (HATS on OPEN HAT): beside the dot, then a line below / above, then the other side
        for (let k = 0; k < 14; k++) {
          const st = k % 7, tx = k < 7 ? x1 : x2, ty = s.y + (st & 1 ? 1 : -1) * Math.ceil(st / 2) * h;
          if (tx < 4 || tx + w > W - 4) continue;
          if (!labelHits(tx, ty, w, h, nl)) { lx = tx; ly = ty; break; }
        }
        const o = nl * 4;
        LR[o] = lx; LR[o + 1] = ly; LR[o + 2] = w; nl++;
        s.lx = lx; s.ly = ly;
      }
      for (let i = 0; i < drawn.length; i++) {
        const s = drawn[i];
        if (s.a < 0.05 || s.lx !== s.lx) continue;
        ctx.globalAlpha = s.a * pw * (s.sel ? 1 : s.dim ? 0.3 : s.on ? 0.72 : 0.42);
        ctx.fillStyle = s.sel ? "#ffffff" : "#ececee";
        ctx.fillText(String((s.d && s.d.label) || ""), s.lx, s.ly);
      }
      ctx.letterSpacing = "0px"; ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- the loop
    let raf = 0, lastTs = 0, skip = 0, dead = false, shown = true, paused = false, warned = false;
    const running = () => !dead && !paused && el.isConnected && shown && !document.hidden && W > 0 && H > 0;
    function start() { if (!raf && running()) { lastTs = 0; raf = requestAnimationFrame(frame); } }
    function frame(ts) {
      raf = 0;
      if (!running()) { lastTs = 0; return; } // hidden or gone: stop until we are shown again
      raf = requestAnimationFrame(frame);
      if ((window.devicePixelRatio || 1) !== dpr) measure();
      const busy = !!drag || nBurst > 0 || moving || flash > 0.03 || hovered != null;
      if (!busy && lastTs && (++skip & 1)) return; // only the calm drift: 30 fps is plenty
      const dt = lastTs ? Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000)) : 1 / 60;
      lastTs = ts; T += dt; frameId++;
      let v = null;
      try { v = typeof opts.get === "function" ? opts.get() : null; } catch (e) { if (!warned) { warned = true; console.error("KdFx.Portal: get() failed", e); } }
      view = v || EMPTY;
      pw += ((view.on === false ? 0.4 : 1) - pw) * Math.min(1, dt * 8); // FX power off: everything dimmer
      if (drag && drag.started && recHeld() !== drag.rec) emit(drag, "move"); // R pressed/let go mid-drag
      const eff = view.effect || null, ax = (eff && eff.axes) || null;
      const id = eff && eff.id, nm = eff && eff.name, x = ax && ax.x, y = ax && ax.y, gp = eff && eff.group;
      if (dirty || id !== kId || nm !== kName || x !== kX || y !== kY || gp !== kGroup) {
        kId = id; kName = nm; kX = x; kY = y; kGroup = gp;
        style = styleOf(gp);
        buildStatic(eff);
      }
      updateDots(dt);
      pollEvents();
      ambient(dt);
      stepParticles(dt);
      draw();
    }

    // ---------------------------------------------------------------- gestures
    const keys = { r: false, alt: false };
    function local(e) { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
    // the dot under the pointer: a selected one wins (it sits on top), else the nearest within reach
    function pick(x, y) {
      if (view.sync) {
        const ms = states.get("sync");
        if (ms && ms.a > 0.3 && Math.hypot(x - ms.x, y - ms.y) <= ms.r + 6) return { key: "sync", wet: num(view.syncDot && view.syncDot.wet, 0.5), sel: true, x: ms.x, y: ms.y };
        return null;
      }
      let best = null, bd = Infinity;
      for (let i = drawn.length - 1; i >= 0; i--) {
        const s = drawn[i];
        if (s.a < 0.3) continue;
        const dd = Math.hypot(x - s.x, y - s.y);
        if (dd > s.r + 6) continue;
        if (!best || (s.sel && !best.sel) || (s.sel === best.sel && dd < bd)) { best = s; bd = dd; }
      }
      return best && { key: best.note, wet: num(best.d && best.d.wet, 0.5), sel: best.sel, x: best.x, y: best.y };
    }
    const selCount = () => { let n = 0; for (let i = 0; i < drawn.length; i++) if (drawn[i].sel) n++; return n; };
    let cursor = "";
    function setCursor(c) { if (c !== cursor) { cursor = c; cv.style.cursor = c; } }
    function hover(p) {
      const h = pick(p.x, p.y);
      hovered = h ? h.key : null;
      setCursor(h ? "grab" : Math.hypot(p.x - cx, p.y - cy) <= R ? "crosshair" : "default");
    }
    function place(d, p) { // keep the grab offset, clamp inside the circle
      let x = p.x + d.ox - cx, y = p.y + d.oy - cy;
      const l = Math.hypot(x, y);
      if (l > R) { x *= R / l; y *= R / l; }
      d.x = cx + x; d.y = cy + y;
    }
    function emit(d, phase, e) {
      d.alt = !!(e && e.altKey) || keys.alt;
      d.rec = recHeld();
      const xy = KdFx.discToXY((d.x - cx) / R, (cy - d.y) / R);
      call(opts.onMove, d.target, xy.x, xy.y, { phase, alt: d.alt, rec: d.rec });
    }
    function onDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (drag) return; // a second finger: ignored
      const p = local(e), h = pick(p.x, p.y);
      drag = {
        id: e.pointerId, target: h ? h.key : null, sx: p.x, sy: p.y, ox: h ? h.x - p.x : 0, oy: h ? h.y - p.y : 0,
        x: h ? h.x : p.x, y: h ? h.y : p.y, started: false, shift: !!e.shiftKey, alt: !!e.altKey,
        multi: !!(h && h.key !== "sync" && h.sel && selCount() > 1), touch: e.pointerType !== "mouse",
      };
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* old WebKit */ }
      // pressing a dot picks it, unless it is already part of the selection (then a drag moves the group)
      if (h && h.key !== "sync" && (!h.sel || e.shiftKey)) call(opts.onPick, h.key, { shift: !!e.shiftKey });
      if (h) setCursor("grabbing");
      e.preventDefault();
    }
    function onMove(e) {
      const p = local(e);
      if (!drag || e.pointerId !== drag.id) { if (e.pointerType === "mouse") hover(p); return; }
      if (drag.target == null) return;
      if (!drag.started) {
        if (Math.hypot(p.x - drag.sx, p.y - drag.sy) < (drag.touch ? 6 : 3)) return;
        drag.started = true;
        emit(drag, "start", e); // from where the press was: the tab moves dots by the delta since start
        place(drag, p);
        emit(drag, "move", e);
        start();
        return;
      }
      place(drag, p);
      emit(drag, "move", e);
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      try { cv.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
      if (d.started) emit(d, "end", e);
      else if (e.type === "pointerup") {
        if (d.target == null) call(opts.onPick, null, { shift: d.shift });
        else {
          const t = performance.now();
          if (lastTap && lastTap.target === d.target && t - lastTap.t < 330) { lastTap = null; call(opts.onHome, d.target); }
          else {
            lastTap = { target: d.target, t };
            if (d.multi && !d.shift) call(opts.onPick, d.target, { shift: false }); // a plain click on one of a group selects just it
          }
        }
      }
      if (e.pointerType === "mouse") hover(local(e)); else { hovered = null; setCursor("default"); }
    }
    function onLeave() { if (!drag) { hovered = null; setCursor("default"); } }
    // scroll (or trackpad pinch) on a dot = its size = wet; one wheel notch = 5%
    function onWheel(e) {
      const p = local(e), h = pick(p.x, p.y);
      if (!h) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 1 : e.ctrlKey ? 25 : 100;
      const t = performance.now();
      // quick wheel bursts build on our own last value, in case the view lags a frame behind
      const base = wetHold && wetHold.target === h.key && t - wetHold.t < 400 ? wetHold.wet : h.wet;
      const wet = Math.round(clamp(base - (e.deltaY / unit) * 0.05) * 1000) / 1000;
      wetHold = { target: h.key, wet, t };
      if (wet !== base) call(opts.onWet, h.key, wet);
      start();
    }
    const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""));
    function onKey(e) {
      const down = e.type === "keydown";
      if (e.key === "Alt") keys.alt = down;
      if (e.key === "r" || e.key === "R") {
        if (down && (typing(e.target) || e.metaKey || e.ctrlKey)) return;
        keys.r = down;
      }
    }
    function onBlur() { keys.r = false; keys.alt = false; }
    function onVis() { if (!document.hidden) start(); }

    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("dblclick", (e) => e.preventDefault()); // double-tap is ours (onHome)
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { measure(); start(); }) : null;
    if (ro) ro.observe(el); else window.addEventListener("resize", measure);
    const io = typeof IntersectionObserver === "function" ? new IntersectionObserver((es) => { shown = es[es.length - 1].isIntersecting; start(); }) : null;
    if (io) io.observe(el);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; labelW.clear(); });
    measure();
    start();

    function destroy() {
      if (dead) return;
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (ro) ro.disconnect(); else window.removeEventListener("resize", measure);
      if (io) io.disconnect();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      cv.remove();
      states.clear();
      np = 0;
    }
    return {
      hit(note, gain) { hit(note, gain); start(); },
      pause() { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; if (drag && drag.started) emit(drag, "end"); drag = null; },
      resume() { paused = false; dirty = true; start(); },
      destroy,
      resize() { measure(); start(); },
      canvas: cv,
    };
  }

  KdFx.Portal = { create };
})();
