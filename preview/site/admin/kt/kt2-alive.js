// ALIVE (Eman, 15 Nov): with a background picture picked (Preferences > Look), the ALIVE button makes
// the picture move with the song while the playground plays. Each kick pushes the picture in (a
// short scale pulse from the middle of the grid), a ghost copy of the picture zooms out and fades
// (the "morph"), and a soft purple/acid glow breathes with the low end.
// Cheap: one AnalyserNode on the master (purpPlaygroundDebug.masterOut, like kt2-fog.js), only the
// low bins read, and only transform/opacity change per frame (no repaint of the picture).
// Off by default, saved in localStorage "kt2.alive". KT2_ALIVE_OFF = no button, old behaviour.
// The Mac app has no Web Audio tap, so there the button does nothing.
(function () {
  if (window.KT2_ALIVE_OFF || !document.documentElement.classList.contains("kt2")) return;
  const KEY = "kt2.alive";
  let on = false;
  try { on = localStorage.getItem(KEY) === "1"; } catch (e) { /* private mode */ }

  const css = document.createElement("style");
  css.textContent = `
.kt2 .k2-alive-row { display: grid; grid-template-columns: 64px 1fr; align-items: center; gap: 12px; font-size: 13px; color: var(--ink-2); }
.kt2 body:not(.look-image) .k2-alive-row { display: none; }
.kt2 .k2-alive-btn { justify-self: start; height: 28px; padding: 0 14px; border: 0; border-radius: 0; background: rgba(255,255,255,0.06); color: var(--ink-2, #aaa); font: 600 11px var(--font, sans-serif); letter-spacing: 0.14em; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10); }
.kt2 .k2-alive-btn.k2-alive-on-pic { position: absolute; top: 10px; right: 10px; z-index: 2; background: rgba(17,17,20,0.78); color: #fff; }
.kt2 body:not(.look-image) .k2-alive-on-pic { display: none; }
.kt2 .k2-alive-btn:hover { color: #fff; }
.kt2 .k2-alive-btn.on, .kt2 .k2-alive-btn.k2-alive-on-pic.on { background: #E4FF3A; color: #111; box-shadow: none; }
.kt2 .k2-alive-ghost, .kt2 .k2-alive-glow { position: absolute; inset: 0; pointer-events: none; opacity: 0; will-change: transform, opacity; }
.kt2 .k2-alive-ghost { background-repeat: no-repeat; mix-blend-mode: screen; }
.kt2 .k2-alive-glow { mix-blend-mode: screen; }
.kt2 body.k2-alive-on #bg { will-change: transform; }
.kt2 body.k2-alive-on .backdrop { background: #0a0a0c; }`;
  document.head.append(css);

  // ------------------------------------------------------------------ the button (Look tab)
  // On the big picture preview, top right (Preferences > Look). Without the preview
  // (KT2_BG_POS_OLD) it sits as a row above the Brightness slider.
  let btn = null;
  function mountButton() {
    const frame = document.querySelector(".k2-bgpos"), box = document.getElementById("look-sliders");
    const home = frame || box;
    if (!home) return false;
    if (btn && home.contains(btn)) return true;
    if (btn) btn.closest(".k2-alive-row") ? btn.closest(".k2-alive-row").remove() : btn.remove();
    btn = document.createElement("button");
    btn.className = "k2-alive-btn"; btn.type = "button"; btn.textContent = "ALIVE";
    btn.onclick = (e) => { e.stopPropagation(); set(!on); };
    for (const ev of ["pointerdown", "mousedown", "dblclick"]) btn.addEventListener(ev, (e) => e.stopPropagation());
    if (frame) { btn.classList.add("k2-alive-on-pic"); frame.append(btn); }
    else {
      const row = document.createElement("div"); row.className = "k2-alive-row";
      const lab = document.createElement("span"); lab.textContent = "Alive";
      row.append(lab, btn); box.insertBefore(row, box.firstChild);
    }
    paint();
    return true;
  }
  function paint() {
    if (btn) btn.classList.toggle("on", on);
    document.body.classList.toggle("k2-alive-on", on);
  }
  function set(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* private mode */ }
    paint();
    if (on) start(); else rest();
  }

  // ------------------------------------------------------------------ layers
  const bgEl = () => document.getElementById("bg");
  let ghost = null, glow = null;
  function layers() {
    const bg = bgEl(), shade = document.getElementById("shade");
    if (!bg || !bg.parentNode) return false;
    if (!ghost) {
      ghost = document.createElement("div"); ghost.className = "k2-alive-ghost";
      glow = document.createElement("div"); glow.className = "k2-alive-glow";
      bg.after(ghost);                        // under the overlay, so the Overlay slider still darkens it
      (shade || ghost).after(glow);           // over the overlay, so the glow reads through it
    }
    return true;
  }
  let lastSig = "";
  function syncGhost() {           // the ghost is the same picture, placed the same way
    const b = bgEl(); if (!b || !ghost) return;
    const s = b.style;
    const sig = s.backgroundImage + "|" + s.backgroundSize + "|" + s.backgroundPosition + "|" + s.filter;
    if (sig === lastSig) return;
    lastSig = sig;
    ghost.style.backgroundImage = s.backgroundImage;
    ghost.style.backgroundSize = s.backgroundSize || "cover";
    ghost.style.backgroundPosition = s.backgroundPosition || "center";
    ghost.style.filter = ((s.filter || "") + " blur(6px)").trim();
  }
  function origin() {              // pulse from the middle of the grid, not of the window
    const g = document.getElementById("scroll"), b = bgEl();
    if (!g || !b) return "50% 50%";
    const r = g.getBoundingClientRect(), B = b.getBoundingClientRect();
    const x = r.left + r.width / 2 - B.left, y = r.top + r.height / 2 - B.top;
    glow.style.background = `radial-gradient(ellipse ${Math.round(r.width * 0.55)}px ${Math.round(r.height * 0.6)}px at ${Math.round(x)}px ${Math.round(y)}px, rgba(228,255,58,0.22), rgba(140,70,255,0.28) 38%, rgba(140,70,255,0) 75%)`;
    return `${Math.round(x)}px ${Math.round(y)}px`;
  }

  // ------------------------------------------------------------------ listening
  let an = null, spec = null, lo = 1, hi = 4, ctxRef = null;
  function tap() {
    const d = window.purpPlaygroundDebug;
    if (!d || !d.ctx || !d.masterOut) return false;
    if (an && ctxRef === d.ctx) return true;
    ctxRef = d.ctx;
    an = d.ctx.createAnalyser();
    an.fftSize = 1024; an.smoothingTimeConstant = 0;   // raw, so the kick's front edge is sharp
    d.masterOut.connect(an);
    spec = new Uint8Array(an.frequencyBinCount);
    const hz = d.ctx.sampleRate / an.fftSize;
    lo = Math.max(1, Math.round(40 / hz)); hi = Math.max(lo + 1, Math.round(130 / hz));   // kick body
    return true;
  }
  const playing = () => typeof ui !== "undefined" && ui && ui.transport && (ui.transport.playing || ui.transport.recording);

  let raf = 0, last = 0, avg = 0, prev = 0, lastHit = -1e9, punch = 0, ghostK = 0, body = 0, side = 1, orig = "", origAt = 0;
  function frame(t) {
    raf = 0;
    if (!on || !document.body.classList.contains("look-image") || !layers()) { rest(); return; }
    const dt = Math.min(0.1, (t - (last || t)) / 1000); last = t;
    let e = 0;
    if (playing() && tap()) {
      an.getByteFrequencyData(spec);
      let m = 0; for (let i = lo; i <= hi; i++) m += spec[i];
      e = Math.pow(m / ((hi - lo + 1) * 255), 2);
      // onset: low end jumps clearly above its running average, rising, and not straight after a hit
      const rise = e - prev;
      if (e > avg * 1.35 + 0.03 && rise > 0.02 && t - lastHit > 140) {
        const k = Math.min(1, 0.45 + (e - avg) * 2.2);
        punch = Math.max(punch, k); ghostK = Math.max(ghostK, k); lastHit = t; side = -side;
      }
      avg += (e - avg) * Math.min(1, dt * 2.5);
      prev = e;
    }
    punch *= Math.exp(-dt / 0.13);   // fast push, ~130 ms
    ghostK *= Math.exp(-dt / 0.28);  // the ghost lingers a bit longer
    body += (e - body) * Math.min(1, dt * 6);
    if (t - origAt > 500) { orig = origin(); origAt = t; syncGhost(); }

    const b = bgEl();
    const s = 1 + punch * 0.045 + body * 0.012;
    const sq = punch * 0.008;   // a little squash: wider than tall on the hit, then back (the morph)
    b.style.transformOrigin = orig;
    b.style.transform = `scale(${(s + sq).toFixed(4)}, ${(s - sq).toFixed(4)}) rotate(${(side * punch * 0.25).toFixed(3)}deg)`;
    ghost.style.transformOrigin = orig;
    ghost.style.transform = `scale(${(1.02 + (1 - ghostK) * 0.06 + ghostK * 0.04).toFixed(4)})`;
    ghost.style.opacity = (ghostK * 0.32).toFixed(3);
    glow.style.opacity = Math.min(0.9, punch * 0.55 + body * 0.35).toFixed(3);

    const idle = !playing() && punch < 0.002 && ghostK < 0.002 && body < 0.002;
    if (idle) { rest(); return; }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && on) { last = 0; raf = requestAnimationFrame(frame); } }
  function rest() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; punch = ghostK = body = 0;
    const b = bgEl(); if (b) { b.style.transform = ""; b.style.transformOrigin = ""; }
    if (ghost) { ghost.style.opacity = 0; ghost.style.transform = ""; }
    if (glow) glow.style.opacity = 0;
  }

  // Wake up when the transport starts (cheap poll; no loop runs while stopped or off).
  setInterval(() => { mountButton(); if (on && playing()) start(); }, 250);
  mountButton();
  paint();
  window.KT2Alive = { set, get: () => on, _state: () => ({ punch, ghostK, body, avg, hits: lastHit }) };
})();
