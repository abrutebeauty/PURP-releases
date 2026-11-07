// KILLTOY 2: the playhead while playing (mock v87-89, wob.js; Eman 31 Oct: nothing before the
// marker, particle texture after it; 1 Nov: dust only BEHIND the line, never on or in front of it).
// The line turns red; a short band of each clip just behind (left of) it
// reacts: the waveform there breaks into fragments that scatter and cool from white-hot to red
// to blue dust, and hits throw particles that percolate rightwards. Drums and 808 react most.
// It copies the clips' own waveform canvases, so what glitches is the real sound. One canvas
// over the timeline, drawn only while playing. Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  if (!document.documentElement.classList.contains("kt2")) return;
  const DPR = window.devicePixelRatio || 1;
  const GAIN = [[/drum|kick|snare|hat|perc|killdrum/i, 1], [/808|bass|sub/i, 0.95], [/fx|riser|impact/i, 0.6], [/vox|vocal|lead|adlib|double|harm/i, 0.5], [/chord|pad|key|piano/i, 0.3]];
  const gainOf = (name) => { for (const [re, g] of GAIN) if (re.test(name)) return g; return 0.4; };
  const hash = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
  const st = new WeakMap();   // clip node -> { sm, kick }
  let cv = null, tmp = null, sparks = [], last = 0, busy = false;
  const GAP = 2;   // px kept clear on the left of the line, so nothing ever sits on it

  function level(src, x) {
    // how much of the clip's waveform column at x is lit (0..1), read from its own canvas
    try {
      const g = src.getContext("2d", { willReadFrequently: true });
      const d = g.getImageData(Math.max(0, Math.min(src.width - 1, Math.round(x))), 0, 1, src.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 60) n++;
      return n / src.height;
    } catch (_) { return 0.3; }
  }

  function bandLevels(src, c0, c1) {
    // the lit share of each source column in c0..c1, read in one go
    const n = Math.max(1, Math.min(src.width - c0, c1 - c0)), out = new Float32Array(n);
    try {
      const d = src.getContext("2d", { willReadFrequently: true }).getImageData(c0, 0, n, src.height).data;
      for (let yy = 0; yy < src.height; yy++) for (let xx = 0; xx < n; xx++) if (d[(yy * n + xx) * 4 + 3] > 60) out[xx]++;
      for (let xx = 0; xx < n; xx++) out[xx] /= src.height;
    } catch (_) { out.fill(0.3); }
    return out;
  }

  // Same layout as app.js drawNotes: rows between 20 px from the top and 6 px from the bottom.
  const hit = new Map();   // note -> when it started glowing
  // a jagged, fast little buzz (two high sines + a per-frame flicker), not a smooth wave
  function spike(px, tm) { const f = Math.floor(tm * 40); return Math.sin(px * 1.3 - tm * 90) * 0.6 + Math.sin(px * 2.7 + tm * 61) * 0.4 + (hash(px, f, 77) - 0.5) * 0.8; }
  function midiGlow(g, c, r, sr, tm) {
    const spb = 60 / ((ui.state && ui.state.bpm) || 120), pb = (ui.transport.position - c.start) / spb;
    const notes = c.notes, top = 20, bottom = r.height - 6;
    let lo = Math.min(...notes.map((n) => n.pitch)), hi = Math.max(...notes.map((n) => n.pitch));
    if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
    const rowH = (bottom - top) / (hi - lo + 1), ppb = r.width / Math.max(0.25, c.beats || 16);
    const x0 = r.left - sr.left, y0 = r.top - sr.top;
    g.save(); g.beginPath(); g.rect(x0, y0, r.width, r.height); g.clip();
    for (const n of notes) {
      if (!(pb >= n.start && pb < n.start + n.length)) { hit.delete(n); continue; }
      if (!hit.has(n)) hit.set(n, tm);
      // played note: bright white-lilac, swells smoothly (no jump), and its edge buzzes with a tiny,
      // spiky shake like a plucked string (Eman, 31 Oct: small and spiky, not yellow)
      const age = tm - hit.get(n), swell = 1 + 0.3 * (1 - Math.exp(-age * 12)), amp = 0.25 + 0.45 * Math.exp(-age * 6);
      const x = x0 + n.start * ppb, w = Math.max(2, n.length * ppb - 1), h = Math.max(2, rowH - 1) * swell;
      const cy = y0 + bottom - (n.pitch - lo + 1) * rowH + Math.max(2, rowH - 1) / 2;
      g.shadowColor = "rgba(200,180,255,0.95)"; g.shadowBlur = 12 + 14 * Math.exp(-age * 5);
      g.fillStyle = `rgba(255,255,255,${0.7 + 0.3 * Math.exp(-age * 4)})`;
      g.beginPath();
      for (let px = 0; px <= w; px += 2) { const v = amp * spike(px, tm) * Math.min(1, px / 6, (w - px) / 6 + 0.2); px ? g.lineTo(x + px, cy - h / 2 + v) : g.moveTo(x, cy - h / 2 + v); }
      for (let px = Math.floor(w / 2) * 2; px >= 0; px -= 2) { const v = amp * spike(px, tm) * Math.min(1, px / 6, (w - px) / 6 + 0.2); g.lineTo(x + px, cy + h / 2 + v); }
      g.closePath(); g.fill();
    }
    g.restore();
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const html = document.documentElement;
    // parked in V2 (Eman, 4 Nov: "the faded neon behind the marker is too much"): kt2-juice.js's beat breathing replaces it
    if (html.classList.contains("kj-on")) { if (cv) cv.hidden = true; return; }
    const playing = html.classList.contains("k2-playing") && !html.classList.contains("k2-mix") && !(window.ui && ui.home);
    if (!playing && !busy) { if (cv) cv.hidden = true; return; }
    const scroll = document.getElementById("scroll"), ph = document.getElementById("playhead");
    if (!scroll || !ph) return;
    if (!cv) { cv = document.createElement("canvas"); cv.className = "k2-glitch"; document.body.append(cv); }
    const sr = scroll.getBoundingClientRect();
    cv.hidden = false;
    Object.assign(cv.style, { left: sr.left + "px", top: sr.top + "px", width: sr.width + "px", height: sr.height + "px" });
    const W = Math.round(sr.width * DPR), H = Math.round(sr.height * DPR);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, sr.width, sr.height);
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    const px = ph.getBoundingClientRect().left + 0.5 - sr.left, tm = t / 1000;
    busy = false;
    if (playing && px > 0 && px < sr.width) {
      for (const cl of document.querySelectorAll("#rows .clip")) {
        const r = cl.getBoundingClientRect();
        const x0 = r.left - sr.left, w = r.width;
        if (px < x0 || px >= x0 + w || r.bottom < sr.top || r.top > sr.bottom) continue;
        const src = cl.querySelector("canvas");
        if (!src || !src.width) continue;
        // MIDI: the notes under the marker turn acid yellow, swell and shake (Eman, 31 Oct: "like Guitar Hero")
        const mc = window.findClip && cl.dataset.clipId && findClip(cl.dataset.clipId);
        if (mc && mc.kind === "midi" && (mc.notes || []).length) { midiGlow(g, mc, src.getBoundingClientRect(), sr, tm); continue; }
        const row = cl.closest(".row"), name = (row && row.textContent.slice(0, 40)) + " " + (cl.textContent || "");
        const gain = gainOf(name);
        let s = st.get(cl); if (!s) { s = { sm: 0, kick: 0 }; st.set(cl, s); }
        const k = src.width / w, lv = level(src, (px - x0) * k), jump = lv - s.sm;
        s.sm += (lv - s.sm) * 0.3;
        if (jump > 0.05) s.kick = Math.min(1, s.kick + jump * gain * 3);
        s.kick *= Math.pow(0.02, dt);
        const amt = Math.min(1, 0.25 * gain + s.kick);
        // Eman, 1 Nov: only BEHIND the moving marker (a short trail to its left), never in front of
        // or on top of the line, and small like dust sparks
        const R = 8 + 16 * amt, bw = Math.min(R, px - GAP - x0);
        if (bw < 2) continue;
        const y = r.top - sr.top, h = r.height, head = Math.min(18, h * 0.3), ky = src.height / h;
        const top = y + head, mid = top + (h - head) / 2, half = (h - head) / 2;
        g.save(); g.beginPath(); g.rect(x0, top - 2, Math.max(0, px - GAP - x0), h - head + 4); g.clip();
        const fr = Math.floor(tm * 30);
        const c0 = Math.max(0, Math.floor((px - GAP - bw - x0) * k)), lvs = bandLevels(src, c0, Math.ceil((px - GAP - x0) * k) + 1);
        // the waveform breaks into fragments: short dashes of each column, more scattered the
        // further from the line, cooling from white-hot to red to a thin blue dust (the reference)
        for (let sx = 0; sx < bw; sx += 2) {
          const x = px - GAP - sx, f = sx / R;
          const lvc = lvs[Math.min(lvs.length - 1, Math.max(0, Math.floor((x - x0) * k) - c0))];
          if (lvc < 0.01) continue;
          const hh = Math.max(1.5, lvc * half * 1.9);
          const nfrag = 2 + Math.floor(hash(sx, fr, 4) * 3);
          for (let i = 0; i < nfrag; i++) {
            const n1 = hash(sx, fr, 10 + i), n2 = hash(sx, fr, 20 + i);
            const len = Math.min(3, hh * (0.06 + 0.12 * n2)), cy = mid + (n1 - 0.5) * 2 * hh;
            const scat = f * amt * (1 + 2 * f);
            const dx = -hash(sx, fr, 30 + i) * 6 * scat, dy = (hash(sx, fr, 40 + i) - 0.5) * 16 * scat;
            const a = (1 - f * 0.85) * (0.5 + 0.5 * amt);
            g.fillStyle = f < 0.22 ? `rgba(255,${235 - f * 400 | 0},${170 - f * 600 | 0},${a})`
              : f < 0.6 ? `rgba(255,${80 - (f - 0.22) * 120 | 0},${50 | 0},${a})`
              : hash(sx, fr, 50 + i) < 0.5 ? `rgba(255,60,60,${a})` : `rgba(110,120,255,${a})`;
            g.fillRect(x + dx, cy - len / 2 + dy, 1, Math.max(1, len));
          }
          // dust around the fragments
          if (hash(sx, fr, 60) < 0.5 * amt * f) {
            g.fillStyle = hash(sx, fr, 61) < 0.6 ? "rgba(255,90,60,0.6)" : "rgba(120,130,255,0.6)";
            g.fillRect(x - hash(sx, fr, 62) * 8 * f, mid + (hash(sx, fr, 63) - 0.5) * 2.4 * hh, 1, 1);
          }
        }
        g.restore();
        // hits throw tiny dust sparks backwards (left, behind the line) that sink and cool off
        if (s.kick > 0.15 && Math.random() < s.kick * 0.9) {
          const n = 1 + Math.round(s.kick * 3);
          for (let j = 0; j < n; j++) sparks.push({ x: px - GAP - 1 - Math.random() * 3, y: mid + (Math.random() - 0.5) * (h - head) * lv, vx: -(10 + Math.random() * 35 * s.kick), vy: (Math.random() - 0.6) * 25, life: 0, max: 0.25 + Math.random() * 0.3, blue: Math.random() < 0.3 });
        }
      }
    }
    // the particles drift right and sink, cooling from white-yellow to red (a few blue ones)
    sparks = sparks.filter((p) => (p.life += dt) < p.max);
    // never in front of the marker: everything is clipped to the left of the line
    g.save(); g.beginPath(); g.rect(0, 0, Math.max(0, px - GAP), sr.height); g.clip();
    for (const p of sparks) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.vx *= Math.pow(0.3, dt);
      const f = p.life / p.max, a = 1 - f;
      g.fillStyle = p.blue ? `rgba(120,130,255,${a})` : f < 0.3 ? `rgba(255,235,150,${a})` : f < 0.6 ? `rgba(255,140,40,${a})` : `rgba(255,50,50,${a})`;
      g.fillRect(p.x, p.y, 1, 1);
    }
    g.restore();
    if (playing || sparks.length) busy = true;
  }
  requestAnimationFrame(frame);
  document.head.insertAdjacentHTML("beforeend", `<style>
.k2-glitch{position:fixed;pointer-events:none;z-index:6}
.k2-glitch[hidden]{display:none}
</style>`);
})();
