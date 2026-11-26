// KILLTOY 2: the INST card, round 3 (Eman picked V2 01 CLEAN COLUMN WITH PICTURE, 6 Nov 02:27):
//   a live picture box on top (name, ON, swap): the synth's own picture, moving all the time and
//     always the preset that plays now: TOY MACHINE = the glitchy middle of its circle (the same
//     Landscape the window draws), BLOB = the creature, zoomed right in, KILLDRUM = its kit's
//     picture torn by the pattern's hits
//   < preset >
//   a round live picture of the lane's sound (grainy rings, red / purple / acid), PAN, LEVEL
//   OPEN and a big OCT - / + stepper
// The macro knobs are gone from the card (they live in the synth's window).
// kt2-tabs.js calls KT2InstLive.card(p, t, c, stacked, helpers); window.KT2_INSTCARD2 = true
// brings back the round-2 card. Keep this file ASCII-only, like ui/.
"use strict";

window.KT2InstLive = (function () {
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ART = { tm: 5, blob: 17, kd: 27, tk: 11, other: 11 };   // which of Eman's artworks sits frosted behind each card
  const SWAP = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M2 5h10l-3-3M14 11H4l3 3"/></svg>';
  const live = new Set();   // every card on screen: { el, t, kind, pic(), viz, meter }

  // ---------------------------------------------------------------- the lane's sound, ~16 times a second
  let polling = false;
  async function poll() {
    if (polling) return;
    polling = true;
    try {
      for (const L of [...live]) {
        if (!L.el.isConnected) { L.stop && L.stop(); live.delete(L); continue; }
        const m = await booth("laneMeter", { trackId: L.t.id }).catch(() => null);
        const s = L.snd;
        const pk = m && m.peak ? m.peak : 0, lvl = clamp((20 * Math.log10(Math.max(1e-5, pk)) + 54) / 48);
        if (lvl > 0.2 && lvl > s.slow + 0.1) s.hit = Math.max(s.hit, Math.min(1, 0.4 + (lvl - s.slow) * 3));
        s.slow += (lvl - s.slow) * 0.3; s.lvl = lvl;
        const b = m && Array.isArray(m.bands) ? m.bands : [0, 0, 0, 0, 0, 0, 0, 0], av = (i, j) => b.slice(i, j).reduce((a, c) => a + c, 0) / (j - i);
        s.low += (av(0, 3) - s.low) * 0.5; s.mid += (av(3, 6) - s.mid) * 0.5; s.high += (av(6, 8) - s.high) * 0.5;
        s.wave = m && Array.isArray(m.wave) && pk > 1e-4 ? m.wave : null;
      }
    } finally { polling = false; }
  }
  setInterval(() => { if (live.size) poll(); }, 60);

  // ---------------------------------------------------------------- one animation loop for every card
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    for (const L of live) {
      if (!L.el.isConnected) continue;
      const s = L.snd;
      s.act = Math.max(s.lvl, s.act * Math.exp(-dt / 0.4)); if (s.act < 0.01) s.act = 0;
      s.hit *= Math.exp(-dt * 6);
      try { L.pic && L.pic(now, dt); } catch (e) { console.warn("INST picture", e); L.pic = null; }
      if (L.viz) drawViz(L, now);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const fit = (cv) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, hh = cv.clientHeight;
    if (!w || !hh) return null;
    const W = Math.round(w * dpr), H = Math.round(hh * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    return { w, h: hh, dpr };
  };

  // ---------------------------------------------------------------- the round picture of the sound
  // grainy rings like an interference print; they bulge with the lows, ripple with the mids and the
  // highs, swell with the level; the colour morphs red -> purple -> acid (Eman, 6 Nov 01:27)
  const GRAIN = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), d = g.createImageData(256, 256);
    for (let k = 0; k < d.data.length; k += 4) d.data[k + 3] = Math.random() < 0.5 ? Math.random() * 150 : 0; g.putImageData(d, 0, 0); return c; })();
  const COLS = [[255, 59, 78], [139, 108, 255], [228, 255, 58]];
  const morph = (p) => { p = ((p % 3) + 3) % 3; const k = Math.floor(p), f = p - k, e = f * f * (3 - 2 * f), a = COLS[k], b = COLS[(k + 1) % 3]; return a.map((v, j) => Math.round(v + (b[j] - v) * e)); };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  function drawViz(L, t) {
    const cv = L.viz, f = cv && fit(cv);
    if (!f) return;
    const g = cv.getContext("2d"), s = L.snd, sm = L.sm;
    // idle: a slow breath so it never freezes; playing: the real bands
    const idle = 0.5 + 0.5 * Math.sin(t * 0.0012 + L.seed);
    const e = [s.low * s.act + s.hit * 0.6, s.mid * s.act, s.high * s.act, s.hit], lv = Math.max(s.act, 0.12 + 0.08 * idle);
    for (let b = 0; b < 4; b++) sm.e[b] += (Math.max(e[b], 0.08 + 0.06 * idle) - sm.e[b]) * 0.35;
    sm.l += (lv - sm.l) * 0.35;
    g.setTransform(f.dpr, 0, 0, f.dpr, 0, 0); g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, f.w, f.h);
    const cx = f.w / 2, cy = f.h / 2, R = Math.min(f.w, f.h) / 2, ph = t * 0.00045 + L.seed, oct = L.oct();
    const bg = g.createRadialGradient(cx, cy, 0, cx, cy, R); bg.addColorStop(0, "rgba(6,6,8,0.85)"); bg.addColorStop(0.8, "rgba(6,6,8,0.55)"); bg.addColorStop(1, "rgba(6,6,8,0)");
    g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = "lighter"; g.lineWidth = 1.1;
    const N = 22, lobes = [3 + Math.max(0, oct), 5, 8 + Math.max(0, oct), 13], wv = s.wave;
    for (let k = 0; k < N; k++) {
      const q = k / (N - 1), ring = Math.sin(q * Math.PI), a = (0.1 + 0.62 * sm.l) * (0.35 + 0.65 * ring);
      const c1 = morph(ph + q * 1.4), c2 = morph(ph + q * 1.4 + 1.2);
      let st;
      if (g.createConicGradient) { st = g.createConicGradient(t * 0.0005 + q * 2, cx, cy); st.addColorStop(0, rgba(c1, a)); st.addColorStop(0.5, rgba(c2, a)); st.addColorStop(1, rgba(c1, a)); } else st = rgba(c1, a);
      g.strokeStyle = st; g.beginPath();
      const base = R * (0.34 + 0.46 * q);
      for (let i = 0; i <= 120; i++) {
        const th = i / 120 * Math.PI * 2;
        let r = base + R * (0.1 * sm.e[0] * Math.sin(lobes[0] * th + ph * 2 + q * 2.5) * ring + 0.06 * sm.e[1] * Math.sin(lobes[1] * th - ph * 3 + q * 4) + 0.035 * sm.e[2] * Math.sin(lobes[2] * th + ph * 5) + 0.02 * sm.e[3] * Math.sin(lobes[3] * th - ph * 7 + q * 6));
        if (wv && k > N * 0.55) r += R * 0.05 * s.act * (wv[(i * 64 / 120) | 0] || 0) * ring;   // the outer rings carry the waveform itself
        r *= 0.9 + 0.16 * sm.l; r = Math.min(r, R - 1);
        const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath(); g.stroke();
    }
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.34), cc = morph(ph + 0.6);
    core.addColorStop(0, rgba(cc, 0.2 * sm.l)); core.addColorStop(1, rgba(cc, 0));
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, R * 0.34, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = "destination-out";
    g.drawImage(GRAIN, -Math.random() * 128, -Math.random() * 128, 256, 256);
    g.drawImage(GRAIN, 128 - Math.random() * 128, 128 - Math.random() * 128, 256, 256);
  }

  // ---------------------------------------------------------------- the live picture boxes
  // TOY MACHINE: its own circle (ToyMachineUI.Landscape) drawn off screen, the box shows a band
  // through the middle, zoomed in, where the picture is most torn up
  function tmPicture(L, cv, pid) {
    const TM = window.ToyMachineUI;
    if (!TM || !TM.Landscape) return null;
    const off = document.createElement("canvas"); off.width = off.height = 220;
    const land = TM.Landscape(off);
    let sig = "", macros = [0.5, 0.5], busy = false;
    const sync = async () => {
      if (busy) return; busy = true;
      try {
        const r = await booth("toyMachineGetPreset", { pluginId: pid });
        const pr = r && r.preset;
        if (!pr) return;
        const full = TM.withDefaults ? TM.withDefaults(pr) : pr;
        const s2 = JSON.stringify([full.look, pr.name, pr.category]);
        macros = (full.macros || []).map((m) => (m && m.value != null ? m.value : 0.5));
        if (s2 !== sig) { sig = s2; land.setLook(full.look, { category: full.category, name: full.name, tags: full.tags }); }
        L.label(pr.name || "Preset");
      } finally { busy = false; }
    };
    sync(); L.timers.push(setInterval(sync, 1000));   // the window or the arrows change the preset: the box follows within a second
    L.resync = sync;
    return (now, dt) => {
      const f = fit(cv); if (!f) return;
      const s = L.snd, m0 = macros[0] == null ? 0.5 : macros[0], m1 = macros[1] == null ? 0.5 : macros[1];
      // like the circle in TOY MACHINE: it holds still when nothing plays and moves with the sound
      // (the same Landscape, fed this lane's real level, bands and waveform)
      const pads = [{ u: 0.5, v: 0.5, mx: m0, my: m1, fall: 7 - 3 * m1, swirl: 0.5 + 1.6 * m0, pinch: 0.15 + 0.35 * m1 }];
      land.draw({ pads, force: {}, fxDirt: { drive: 0, clip: 0, crush: 0 }, morph: m0, zoom: 1.15 + 0.7 * m1, turb: 0.45 + 0.9 * s.act + 0.5 * m1, hueShift: (m0 - 0.5) * 50,
        bright: clamp(0.82 + 0.38 * m1, 0.3, 1.7), speed: s.act * 0.7 + s.hit * 0.6, audio: s }, dt);
      const g = cv.getContext("2d"), W = off.width, bw = W * 0.62, bh = bw * (cv.height / cv.width);
      g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingQuality = "high";
      g.drawImage(off, (W - bw) / 2, (W - bh) / 2, bw, bh, 0, 0, cv.width, cv.height);
    };
  }
  // BLOB: the creature itself, right up close, turning slowly; it swells and flashes with the sound
  function blobPicture(L, cv, pid) {
    const Lk = window.BlobLook;
    if (!Lk) return null;
    let r3 = null;
    try { r3 = window.BLOBMESH ? window.BLOBMESH.create(cv) : null; } catch (e) { r3 = null; }
    if (!r3 || !r3.ok) { try { r3 = window.BLOB3D ? window.BLOB3D.create(cv) : null; } catch (e) { r3 = null; } }
    if (!r3 || !r3.ok) return null;
    L.stop = () => { try { r3.lose && r3.lose(); } catch (e) { /* gone */ } };
    let look = Lk.lookOf(Lk.INIT, null).look, sig = "", busy = false, ph = 0;
    const sync = async () => {
      if (busy) return; busy = true;
      try {
        const r = await booth("toyMachineGetPreset", { pluginId: pid });
        const pr = r && r.preset;
        if (!pr) return;
        const s2 = JSON.stringify(pr);
        if (s2 !== sig) { sig = s2; look = Lk.lookOf(pr, null).look; }
        L.label(pr.name || "Preset");
      } finally { busy = false; }
    };
    sync(); L.timers.push(setInterval(sync, 1000));
    L.resync = sync;
    return (now, dt) => {
      if (!fit(cv)) return;
      const s = L.snd;
      ph += dt * (look.speed == null ? 0.5 : look.speed) * (1 + 2.5 * s.act);
      r3.draw({ ...look, lamp: 0.7 }, { t: now / 1000, ph, live: { level: s.act, pump: s.hit, hit: s.hit, shimmer: s.act }, ripples: [], yaw: 0.5 + now * 0.00012, pitch: 0.18 + 0.06 * Math.sin(now * 0.0003), dist: 1.3, level: s.act, swell: s.low * s.act, flash: s.hit });
    };
  }
  // KILLDRUM: a tile of the kit's picture sheet (the one its pads use), lilac duotone; every hit in
  // the pattern tears it sideways as the playhead passes, the loudest hits flash it acid
  const SHEET = new Image(); SHEET.src = "toymachine-looks.jpg";
  function kdPicture(L, cv, pid, c) {
    let kitName = "", tile = 0, busy = false;
    const sync = async () => {
      if (busy) return; busy = true;
      try {
        const r = await booth("killDrumGet", { pluginId: pid });
        const k = r && r.kit;
        if (!k) return;
        const nm = k.name || "Kit";
        if (nm !== kitName) { kitName = nm; let hh = 7; for (const ch of nm) hh = (hh * 31 + ch.charCodeAt(0)) >>> 0; tile = hh % 20; }
        L.label(nm);
      } finally { busy = false; }
    };
    sync(); L.timers.push(setInterval(sync, 1500));
    const off = document.createElement("canvas"), og = off.getContext("2d");
    return (now) => {
      const f = fit(cv); if (!f) return;
      const g = cv.getContext("2d"), W = cv.width, H = cv.height, s = L.snd;
      if (off.width !== W || off.height !== H) { off.width = W; off.height = H; }
      og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = "source-over";
      og.fillStyle = "#121214"; og.fillRect(0, 0, W, H);
      if (SHEET.complete && SHEET.naturalWidth) {
        const T = SHEET.naturalWidth / 5, sx = (tile % 5) * T, sy = ((tile / 5) | 0) * T, zw = T * 0.7, zh = zw * H / W, drift = Math.sin(now * 0.00025 + L.seed) * T * 0.1;
        og.filter = "grayscale(1) contrast(1.5)";
        og.drawImage(SHEET, sx + (T - zw) / 2 + drift, sy + (T - zh) / 2, zw, zh, 0, 0, W, H);
        og.filter = "none";
      }
      og.globalCompositeOperation = "multiply"; og.fillStyle = s.hit > 0.5 ? "#e4ff3a" : "#cbb8ff"; og.fillRect(0, 0, W, H);
      og.globalCompositeOperation = "source-over";
      // the pattern: where the hits are in the bar, torn slices, harder near the playhead
      const notes = (c && c.notes) || [], bar = 4, pos = ((window.ui && ui.transport && ui.transport.position) || 0) * ((ui.state && ui.state.bpm) || 120) / 60;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(off, 0, 0);
      const play = ((pos % bar) + bar) % bar;
      for (const n of notes) {
        const at = ((n.start != null ? n.start : n.at || 0) % bar + bar) % bar, near = Math.exp(-Math.pow(((play - at + bar) % bar), 2) * 10) * (s.act > 0.02 ? 1 : 0.15);
        const y = ((n.pitch * 37) % 97) / 97 * H, hh = H * (0.06 + 0.1 * ((n.pitch * 13) % 7) / 7), dx = (near * 0.18 + 0.02 * Math.sin(now * 0.003 + n.pitch)) * W * (n.pitch % 2 ? 1 : -1);
        g.drawImage(off, 0, y, W, hh, dx, y, W, hh);
        if (near > 0.3) { g.fillStyle = `rgba(228,255,58,${(near * 0.35).toFixed(3)})`; g.fillRect(0, y, W, Math.max(1, hh * 0.15)); }
      }
      // a scan line that runs with the playhead
      const x = play / bar * W; g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x, 0, Math.max(1, W * 0.004), H);
    };
  }
  // TOY KEYS (Eman, 7 Nov): a row of square keys in the preset's colour; the keys light up and
  // sink with the lane's sound (lows on the left, highs on the right), the picked one glows acid
  function tkPicture(L, cv, pid) {
    let hue = 270, busy = false;
    const sync = async () => {
      if (busy) return; busy = true;
      try {
        const r = await booth("toyMachineGetPreset", { pluginId: pid });
        const pr = r && r.preset;
        if (!pr) return;
        hue = pr.hue || 270;
        L.label(pr.name || "Preset");
      } finally { busy = false; }
    };
    sync(); L.timers.push(setInterval(sync, 1000));
    L.resync = sync;
    const lit = new Float32Array(15);
    return (now, dt) => {
      const f = fit(cv); if (!f) return;
      const g = cv.getContext("2d"), W = cv.width, H = cv.height, s = L.snd, N = 15, kw = W / N;
      g.setTransform(1, 0, 0, 1, 0, 0);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, `hsl(${hue},35%,14%)`); bg.addColorStop(1, "#111113");
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let i = 0; i < N; i++) {
        const q = i / (N - 1), band = q < 0.34 ? s.low : q < 0.67 ? s.mid : s.high;
        const want = s.act * (0.35 + 0.65 * band) * (0.6 + 0.4 * Math.sin(now * 0.004 + i * 1.7 + L.seed)) + s.hit * 0.3 * Math.max(0, Math.sin(i * 2.3 + now * 0.01));
        lit[i] += (Math.max(0, want) - lit[i]) * Math.min(1, dt * 14);
        const v = Math.min(1, lit[i]), x = i * kw, top = H * 0.18 + v * H * 0.05;
        g.fillStyle = v > 0.04 ? `hsla(${hue},80%,${(62 + 20 * v).toFixed(0)}%,${(0.25 + 0.75 * v).toFixed(3)})` : "rgba(233,232,238,0.82)";
        g.fillRect(x + 1, top, kw - 2, H * 0.78 - v * H * 0.05);
        if (v > 0.85) { g.fillStyle = "rgba(228,255,58,0.5)"; g.fillRect(x + 1, top, kw - 2, Math.max(2, H * 0.03)); }
      }
      for (let i = 0; i < N - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) { const x = (i + 1) * kw - kw * 0.3; g.fillStyle = "#1c1c20"; g.fillRect(x, H * 0.18, kw * 0.6, H * 0.45); }
    };
  }
  // TOY GTR (13 Nov): six strings across the card in the preset's colour; they shake with the lane's
  // sound (low strings with the lows, high with the highs) and the loudest one glows acid
  function tgPicture(L, cv, pid) {
    let hue = 30, busy = false;
    const sync = async () => {
      if (busy) return; busy = true;
      try { const r = await booth("toyMachineGetPreset", { pluginId: pid }); const pr = r && r.preset; if (!pr) return; hue = pr.hue == null ? 30 : pr.hue; L.label(pr.name || "Preset"); }
      finally { busy = false; }
    };
    sync(); L.timers.push(setInterval(sync, 1000));
    L.resync = sync;
    const amp = new Float32Array(6);
    return (now, dt) => {
      const f = fit(cv); if (!f) return;
      const g = cv.getContext("2d"), W = cv.width, H = cv.height, s = L.snd;
      g.setTransform(1, 0, 0, 1, 0, 0);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, `hsl(${hue},30%,13%)`); bg.addColorStop(1, "#111113");
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255,255,255,0.08)"; for (let k = 1; k < 8; k++) g.fillRect(W * k / 8, H * 0.12, Math.max(1, W * 0.004), H * 0.76);
      let top = 0;
      for (let i = 0; i < 6; i++) { const band = i < 2 ? s.low : i < 4 ? s.mid : s.high; amp[i] += (Math.max(0, s.act * (0.3 + 0.7 * band) + s.hit * 0.3) - amp[i]) * Math.min(1, dt * 12); if (amp[i] > amp[top]) top = i; }
      for (let i = 0; i < 6; i++) {
        const y = H * (0.2 + i * 0.12), a = Math.min(1, amp[i]), lw = Math.max(1, H * (0.006 + 0.004 * i));
        g.strokeStyle = a > 0.05 ? (i === top && a > 0.6 ? "rgba(228,255,58,0.9)" : `hsla(${hue},80%,${(60 + 20 * a).toFixed(0)}%,${(0.45 + 0.55 * a).toFixed(3)})`) : "rgba(220,218,228,0.55)";
        g.lineWidth = lw; g.beginPath();
        for (let x = 0; x <= W; x += Math.max(2, W / 80)) { const u = x / W, yy = y + Math.sin(u * Math.PI) * Math.sin(now * (0.03 + i * 0.006) + i) * a * H * 0.04; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
        g.stroke();
      }
    };
  }
  // anything else: its colour, slowly moving
  function plainPicture(L, cv) {
    return (now) => {
      const f = fit(cv); if (!f) return;
      const g = cv.getContext("2d"), W = cv.width, H = cv.height, x = W * (0.5 + 0.4 * Math.sin(now * 0.0004 + L.seed));
      const gr = g.createRadialGradient(x, H / 2, 0, x, H / 2, W * 0.6); gr.addColorStop(0, L.color); gr.addColorStop(1, "#121214");
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    };
  }

  // ---------------------------------------------------------------- the card
  function card(p, t, c, stacked, X) {
    const el = h("div", "k2t-card k2w" + (stacked ? " k2t-stacked" : ""));
    const col = colorOf(t) || "#8b6cff";
    el.style.setProperty("--c", col);
    const isFace = p.face === "blob" || t.face === "blob";
    const isKD = /killdrum|toy ?drums/i.test(p.name || ""), isTK = /toy ?keys|toy ?gtr/i.test(p.name || ""), isTG = /toy ?gtr/i.test(p.name || "");   // TOY GTR rides on TOY KEYS' card (13 Nov)
    const isTM = !isKD && !isTK && (/toy machine/i.test(p.name || "") || isFace);
    const isOldBlob = !isFace && /^blob$/i.test(p.name || "");
    const kind = isTK ? "tk" : isKD ? "kd" : isFace || isOldBlob ? "blob" : isTM ? "tm" : "other";
    el.style.setProperty("--art", `url("bg/KT_UP_${String(ART[kind]).padStart(2, "0")}-s.jpg")`);
    const on = p.enabled !== false;
    if (!on) el.classList.add("off");
    const L = { el, t, c, kind, timers: [], seed: (t.id || "").length * 1.7 + Math.random() * 3, color: col, snd: { act: 0, hit: 0, lvl: 0, slow: 0, low: 0, mid: 0, high: 0, wave: null }, sm: { e: [0, 0, 0, 0], l: 0 }, oct: () => t.oct || 0 };
    const stopAll = L.stop;
    // ---- the picture box with the name, ON and swap over it
    const box = h("div", "k2w-pic"), pcv = h("canvas");
    box.append(pcv);
    const row = h("div", "k2w-row");
    const name = h("button", "k2w-name");
    name.innerHTML = `<i></i><span></span>`;
    name.lastChild.textContent = (isFace || isOldBlob ? "BLOB" : isKD ? "KILLDRUM" : isTG ? "TOY GTR" : isTK ? "TOY KEYS" : isTM ? "TOY MACHINE" : p.name || "INSTRUMENT").toUpperCase();
    name.title = "Open " + name.lastChild.textContent;
    name.onclick = (e) => { e.stopPropagation(); openLaneSynth(t.id); };
    const sw = h("button", "k2w-on" + (on ? " on" : ""), on ? "ON" : "OFF");
    sw.title = on ? "Switch this instrument off" : "Switch it back on";
    sw.hidden = !p.id;
    sw.onclick = (e) => { e.stopPropagation(); run("togglePlugin", { pluginId: p.id }).then(X.refresh); };
    row.append(name, sw);
    if (window.KT2Pick && !stacked) {
      const rep = h("button", "k2w-rep"); rep.innerHTML = SWAP; rep.title = "Swap the synth (same notes)";
      rep.onclick = (e) => { e.stopPropagation(); KT2Pick.synth({ title: "SWAP THE SYNTH", onPick: (key) => KT2Pick.setInstrumentFor(t.id, key, c && c.id) }); };
      row.append(rep);
    }
    if (stacked) {
      const x = h("button", "k2w-rep k2w-x", "×"); x.title = "Remove this synth from the pattern";
      x.onclick = (e) => { e.stopPropagation(); run("deleteTrack", { trackId: t.id }).then(X.refresh); };
      row.append(x);
    }
    box.append(row);
    el.append(box);
    // ---- the preset
    const pre = h("div", "k2w-pre");
    const prev = h("button", "k2w-arr", "‹"), next = h("button", "k2w-arr", "›"), label = h("span", null, isTM || isTK || isOldBlob || isKD ? "..." : t.name);
    pre.append(prev, label, next);
    L.label = (s) => { if (label.textContent !== s && !L.stepping) label.textContent = s; };
    // ---- the live circle, PAN, LEVEL
    const mid = h("div", "k2w-mid");
    const vw = h("div", "k2w-viz"), vcv = h("canvas");
    vw.title = "What this synth sounds like right now";
    vw.append(vcv); L.viz = vcv;
    const pan = X.ring("PAN", ((t.pan || 0) + 1) / 2, (v, drag) => run("setLanePan", { trackId: t.id, pan: Math.abs(v - 0.5) < 0.02 ? 0 : v * 2 - 1, drag }),
      { cls: "k2w-pan", bip: true, tip: "Left or right", reset: 0.5, color: "#c9c8d0", fmt: (v) => { const q = Math.round((v * 2 - 1) * 50); return Math.abs(q) < 1 ? "C" : (q < 0 ? "L" : "R") + Math.abs(q); } });
    const lv = X.ring("LEVEL", volToFrac(t.volume || 0), (v, drag) => run("setTrackVolume", { trackId: t.id, db: fracToVol(v), drag }), { cls: "k2r-lvl k2w-lvl", tip: "This synth's volume (the same fader as in the mixer)", reset: volToFrac(0) });
    mid.append(pan, lv);
    // under the picture box: the live circle on the left, the rest in a column beside it
    // the V2 01 mock (Eman, 6 Nov 02:54): preset across the card, PAN on the left, LEVEL on the right
    // where the red mark was, then OPEN and OCT. The round sound picture is parked: KT2_INST_VIZ = true
    const viz = !!window.KT2_INST_VIZ;
    if (!viz) el.classList.add("k2w-mock");
    const body = h("div", "k2w-body"), right = h("div", "k2w-r");
    if (viz) { body.append(vw, right); right.append(pre, mid); el.append(body); }
    else { L.viz = null; el.append(pre, mid); mid.classList.add("k2w-low"); }
    // ---- OPEN and the big OCT
    const foot = h("div", "k2w-foot");
    const open = h("button", "k2w-open", "OPEN \u2197"); open.title = "Open the synth"; open.onclick = (e) => { e.stopPropagation(); openLaneSynth(t.id); };
    const ov = t.oct || 0, shift = (d) => run("setLaneOct", { trackId: t.id, oct: ov + d }).then(X.refresh);
    const oct = h("div", "k2w-oct");
    const minus = h("button", null, "−"), plus = h("button", null, "+"), mid2 = h("span");
    mid2.append(h("small", null, "OCT"), h("b", null, ov > 0 ? "+" + ov : String(ov)));
    minus.title = plus.title = "Play this synth an octave lower / higher (the notes stay where they are)";
    minus.onclick = (e) => { e.stopPropagation(); shift(-1); }; plus.onclick = (e) => { e.stopPropagation(); shift(1); };
    oct.append(minus, mid2, plus);
    foot.append(open, oct);
    (viz ? right : mid).append(foot);
    // Eman, 16 Nov: on a tall footer the green LEVEL ring grew past the card's right edge (OPEN + OCT + the ring are
    // wider than the card). The card now grows just enough to hold its bottom row; a short footer keeps the old
    // width. KT2_INSTCARD_FIT_OFF = old.
    if (!viz && !window.KT2_INSTCARD_FIT_OFF && typeof ResizeObserver === "function") {
      const fit = () => {
        if (!el.isConnected) return;
        el.style.width = el.style.flexBasis = "";
        const over = mid.scrollWidth - mid.clientWidth;
        if (over > 0) el.style.width = el.style.flexBasis = (el.getBoundingClientRect().width + over) + "px";
      };
      let asked = false;
      new ResizeObserver(() => { if (asked) return; asked = true; requestAnimationFrame(() => { asked = false; fit(); }); }).observe(lv);
    }
    // ---- preset arrows (TOY MACHINE and BLOB share TOY MACHINE's presets)
    if (isTM && p.id) {
      const step = async (d) => {
        const list = await X.presets();
        if (!list.length) return toast("No presets found.");
        const cur = label.textContent, i = list.findIndex((x) => x.name === cur);
        const nx = list[((i < 0 ? 0 : i + d) + list.length) % list.length];
        label.textContent = nx.name; L.stepping = true;
        try {
          const r = await booth("toyMachineLoadPreset", { id: nx.id, file: nx.file });
          if (r && r.preset) await run("toyMachineSetPreset", { pluginId: p.id, preset: r.preset });
        } finally { L.stepping = false; }
        if (L.resync) L.resync();
      };
      prev.onclick = (e) => { e.stopPropagation(); step(-1); }; next.onclick = (e) => { e.stopPropagation(); step(1); };
      prev.title = next.title = "Previous / next preset";
    } else if (isTK && p.id && (isTG ? window.ToyGtr : window.ToyKeys)) {   // TOY KEYS / TOY GTR: their own presets (window.TK_ONLY_PRESETS / TG_ONLY_PRESETS limit them, like TM_ONLY_PRESETS)
      const E = isTG ? window.ToyGtr : window.ToyKeys;
      const step = async (d) => {
        const only = isTG ? window.TG_ONLY_PRESETS : window.TK_ONLY_PRESETS, all = E.PRESETS.filter((x) => !Array.isArray(only) || !only.length || only.includes(x.name));
        const cur = label.textContent, i = all.findIndex((x) => x.name === cur), nx = all[((i < 0 ? 0 : i + d) + all.length) % all.length];
        label.textContent = nx.name; L.stepping = true;
        try { const pr = E.preset(nx.name); await run("toyMachineSetPreset", { pluginId: p.id, preset: pr }); booth("toyMachineAudition", { pluginId: p.id, preset: pr, pitch: 60 }); }
        finally { L.stepping = false; }
        if (L.resync) L.resync();
      };
      prev.onclick = (e) => { e.stopPropagation(); step(-1); }; next.onclick = (e) => { e.stopPropagation(); step(1); };
      prev.title = next.title = "Previous / next sound";
    } else if (isOldBlob && p.id && window.BlobEngine) {
      const B = window.BlobEngine;
      let i = 0;
      booth("blobGetPatch", { pluginId: p.id }).then((r) => { const n = (r && r.patch && r.patch.name) || "Saw Circle"; label.textContent = n; i = Math.max(0, B.PRESETS.findIndex((x) => x.n === n)); });
      const step = (d) => { i = (i + d + B.PRESETS.length) % B.PRESETS.length; const patch = B.fromPreset(i); label.textContent = patch.name || B.PRESETS[i].n; run("blobSetPatch", { pluginId: p.id, patch }); };
      prev.onclick = (e) => { e.stopPropagation(); step(-1); }; next.onclick = (e) => { e.stopPropagation(); step(1); };
      prev.title = next.title = "Previous / next BLOB";
    } else { prev.hidden = next.hidden = true; }
    // ---- the picture
    L.pic = (p.id && (kind === "tk" ? (/toy ?gtr/i.test(p.name || "") ? tgPicture(L, pcv, p.id) : tkPicture(L, pcv, p.id)) : kind === "tm" ? tmPicture(L, pcv, p.id) : isFace ? blobPicture(L, pcv, p.id) : kind === "kd" ? kdPicture(L, pcv, p.id, c) : null)) || plainPicture(L, pcv);
    const st0 = L.stop;
    L.stop = () => { L.timers.forEach(clearInterval); L.timers = []; st0 && st0(); stopAll && stopAll(); };
    live.add(L);
    return el;
  }

  // THE THREAD between two synths (Eman, 6 Nov 03:03, image 2 of the mock): soft strands, acid at the
  // ends and purple in the middle, waving across the gap, a white pulse running along; a glowing
  // half-round port on each card's edge. Unlinked: the ports sit empty and the strands are gone.
  let tid = 0;
  function thread(linked, W, H, onclick, tip) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "k2th" + (linked ? " on" : " off");
    el.title = tip || "";
    el.style.width = W + "px";
    const L = W - 10, mid = H / 2, gid = "k2thg" + (++tid);
    let paths = "";
    for (let k = 0; k < 5; k++) {
      const amp = (4 + k * 2) * Math.min(1, H / 60), ph = k * 0.9;
      let d = "";
      for (let i = 0; i <= 24; i++) {
        const q = i / 24, off = Math.sin(q * Math.PI) * Math.sin(q * Math.PI * 2 + ph) * amp;
        d += (i ? "L" : "M") + (5 + q * L).toFixed(1) + " " + (mid + off).toFixed(1);
      }
      paths += '<path d="' + d + '" stroke="url(#' + gid + ')" stroke-width="' + (k === 2 ? 2 : 1.2) + '" fill="none" opacity="' + (0.5 + 0.1 * k) + '"/>';
      if (k === 2 || k === 4) paths += '<path class="k2th-pulse" d="' + d + '" pathLength="100" style="animation-delay:' + (-k * 0.37) + 's"/>';
    }
    el.innerHTML = '<svg style="width:' + W + 'px;height:' + H + 'px" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="0">'
      + '<stop offset="0" stop-color="#E4FF3A"/><stop offset=".25" stop-color="#8b6cff"/><stop offset=".75" stop-color="#c46bff"/><stop offset="1" stop-color="#E4FF3A"/></linearGradient></defs>'
      + '<g class="k2th-s">' + paths + "</g></svg><i class=\"k2th-n l\"></i><i class=\"k2th-n r\"></i>";
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.onclick = (e) => { e.stopPropagation(); if (onclick) onclick(); };
    return el;
  }

  return { card, drawViz, thread };
})();
