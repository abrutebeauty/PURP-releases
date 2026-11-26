// MASTER VOLUME BOX (Eman, 10 Nov): the Save preset / Bypass / Export buttons in the bottom-right corner of the
// panel are gone; at the far right of the panel there is one tall box instead. It shows the live sound of the whole
// project as a waveform flowing up the box (what reaches the speakers, after the master fader), and the yellow line
// is the master volume: drag anywhere in the box up or down to set it, double-click = back to 0 dB.
// Same command as the master strip's fader (setTrackVolume trackId "master"), so it saves and undoes with the song.
// The old buttons are only hidden (kt2.js still clicks Bypass from a shortcut). KT2_MASTERVOL_OFF = old corner.
(function () {
  if (window.KT2_MASTERVOL_OFF) return;
  const rack = document.getElementById("rack");
  if (!rack || typeof run !== "function") return;
  document.documentElement.classList.add("k2-mvol");

  const css = document.createElement("style");
  css.textContent = `
.kt2.k2-mvol .rack-actions { display: none !important; }
.kt2 .k2-mv { position: relative; flex: 0 0 46px; align-self: stretch; margin-left: auto; border-left: 1px solid rgba(255, 255, 255, 0.07);
  background: #101012; cursor: ns-resize; touch-action: none; user-select: none; overflow: hidden; }
.kt2 .k2-mv canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.kt2 .k2-mv b { position: absolute; left: 0; right: 0; bottom: 3px; text-align: center; font: 600 8.5px var(--font); letter-spacing: 0.02em;
  color: var(--k2-ink3, #77737f); pointer-events: none; white-space: nowrap; }
.kt2 .k2-mv:hover b, .kt2 .k2-mv.drag b { color: #fff; }
`;
  document.head.appendChild(css);

  const box = document.createElement("div");
  box.className = "k2-mv";
  box.title = "Master volume";
  box.innerHTML = "<canvas></canvas><b></b>";
  rack.appendChild(box);
  const cv = box.querySelector("canvas"), label = box.querySelector("b"), g = cv.getContext("2d");

  const ROW = 2;                      // px per moment in the flowing wave
  const hist = [];                    // newest last: { pk, rms } of the output, 0..1+
  let buf = null, lastDb = null, w = 0, h = 0, dpr = 1;

  const U = () => (typeof ui !== "undefined" ? ui : null);   // app.js keeps ui as a top-level const, not on window
  const masterDb = () => { const u = U(), m = u && u.state && u.state.master; return m ? +m.volume || 0 : 0; };
  const toFrac = (db) => (typeof volToFrac === "function" ? volToFrac(db) : Math.max(0, Math.min(1, (db + 60) / 66)));
  const toDb = (f) => (typeof fracToVol === "function" ? fracToVol(f) : f * 66 - 60);
  const fmt = (db) => (typeof fmtDb === "function" ? fmtDb(db) : db.toFixed(1) + " dB");

  function sample() {
    const d = window.purpPlaygroundDebug, an = d && d.outMeter;
    let pk = 0, rms = 0;
    if (an) {
      if (!buf || buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > pk) pk = v; s += v * v; }
      rms = Math.sqrt(s / buf.length);
    }
    hist.push({ pk, rms });
    const max = Math.ceil(h / ROW) + 2;
    if (hist.length > max) hist.splice(0, hist.length - max);
  }

  function draw() {
    const r = box.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    if (r.width < 4 || r.height < 4) return;
    if (r.width !== w || r.height !== h || cv.width !== Math.round(r.width * dpr)) { w = r.width; h = r.height; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const db = masterDb(), lineY = Math.round((1 - toFrac(db)) * (h - 16)) + 3;   // keep the dB number free at the bottom
    // the volume: everything under the line is lit a little
    g.fillStyle = "rgba(228, 255, 58, 0.06)";
    g.fillRect(0, lineY, w, h - lineY);
    // the wave: newest at the bottom, flowing up, mirrored around the middle; louder = wider
    const cx = w / 2, half = w / 2 - 4, n = hist.length;
    for (let i = 0; i < n; i++) {
      const s = hist[n - 1 - i], y = h - (i + 1) * ROW;
      if (y < -ROW) break;
      const pk = Math.min(1, s.pk), body = Math.min(1, s.rms * 1.6);
      if (pk < 0.002) continue;
      const fade = 1 - i / (n + 4) * 0.55;
      g.fillStyle = s.pk >= 0.985 ? `rgba(255, 70, 50, ${fade})` : `rgba(170, 140, 255, ${0.55 * fade})`;
      g.fillRect(cx - pk * half, y, pk * half * 2, ROW);
      g.fillStyle = `rgba(255, 255, 255, ${0.8 * fade})`;
      g.fillRect(cx - body * half, y, body * half * 2, ROW);
    }
    // the fader line
    g.fillStyle = "#E4FF3A";
    g.fillRect(0, lineY - 1, w, 2);
    g.fillRect(cx - 7, lineY - 2, 14, 4);
    if (db !== lastDb) { label.textContent = fmt(db).replace(" dB", ""); lastDb = db; box.title = "Master volume " + fmt(db); }
  }

  (function tick() {
    if (!document.hidden && box.isConnected && box.offsetParent !== null) { sample(); draw(); }
    requestAnimationFrame(tick);
  })();

  // drag up/down = master volume (one undo step per drag)
  const dbAt = (ev) => {
    const r = box.getBoundingClientRect(), f = 1 - (ev.clientY - r.top - 3) / Math.max(1, r.height - 16);
    return Math.round(toDb(Math.max(0, Math.min(1, f))) * 10) / 10;
  };
  const setLocal = (db) => { const u = U(); if (u && u.state && u.state.master) u.state.master.volume = db; };
  box.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    box.setPointerCapture(e.pointerId);
    box.classList.add("drag");
    let v = dbAt(e), sent = 0, pend = null;
    setLocal(v); run("setTrackVolume", { trackId: "master", db: v });
    const move = (ev) => {
      v = dbAt(ev); setLocal(v);
      if (Date.now() - sent > 50) { sent = Date.now(); run("setTrackVolume", { trackId: "master", db: v, drag: true }); }
      else { clearTimeout(pend); pend = setTimeout(() => run("setTrackVolume", { trackId: "master", db: v, drag: true }), 60); }
    };
    const up = () => {
      clearTimeout(pend);
      box.classList.remove("drag");
      box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up);
      run("setTrackVolume", { trackId: "master", db: v, drag: true });
    };
    box.addEventListener("pointermove", move); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
  });
  box.addEventListener("dblclick", (e) => { e.preventDefault(); e.stopPropagation(); setLocal(0); run("setTrackVolume", { trackId: "master", db: 0 }); });
})();
