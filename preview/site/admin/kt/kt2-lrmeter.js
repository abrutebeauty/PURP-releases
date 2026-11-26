// L/R METER IN THE TOP BAR (Eman, 10 Nov): the tall master-volume wave box at the far right of the panel is gone.
// Instead, next to the time there is a stereo peak meter like an old tape deck: two rows of segments, L on top,
// R under it, white segments that turn orange near 0 dB, and the loudest segment stays lit for a moment (peak hold).
// It shows what reaches the speakers (after the master fader and the safety limiter). The time and the metronome
// move a bit to the left to make room, and the tools on the left (select, pencil, brush, scissors...) are a bit
// smaller and closer together. KT2_LRMETER_OFF = the old bar, the old tool size and the tall box back.
// MASTER VOLUME ON THE METER (Eman, 11 Nov): drag up or down on the meter = the whole song louder or quieter (the
// master fader, setTrackVolume "master"). It starts on AUTO (the yellow A next to it): the engine keeps the loudest
// peaks just under the limiter, as loud as it can go without cracking (playground.js MAUTO). Dragging leaves AUTO and
// keeps the loudness you had and greys the A; pressing A (or double-clicking the meter) goes back to AUTO. When the level
// is set so loud that the limiter has to shave, "+2.3 dB OVER" shows next to the A (MAUTO.over). The meter is 15%
// smaller than in v314.
// KT2_MASTER_AUTO_OFF = no AUTO and no drag (the plain meter of v314).
// THE YELLOW LINE (Eman, 11 Nov): instead of dragging up/down, a vertical yellow line stands on the meter where the
// loudest parts of the song land; drag it left or right. On AUTO it sits at -1 dB (just under the orange). Past the
// last segment there is a short space for "too loud" (up to +6 dB over). KT2_MASTER_DRAG_UPDOWN = the v316 up/down drag.
// SOFT LINE (Eman, 11 Nov): the yellow line is gone. The line only shows while the mouse is over the meter, as a faint
// white hairline that fades in (a bit brighter while dragging), so you can tell it can be dragged. The drag works the
// same. KT2_MASTER_LINE_YELLOW = the always-on yellow line of v317-v323.
(function () {
  if (window.KT2_LRMETER_OFF) return;
  const CONTROL = !window.KT2_MASTER_AUTO_OFF;
  if (CONTROL) window.KT2_MASTER_AUTO = 1;
  const transport = document.querySelector("header.top .transport"), time = document.getElementById("pos-time");
  if (!transport || !time) return;
  const root = document.documentElement;
  root.classList.add("k2-lrm");

  const css = document.createElement("style");
  css.textContent = `
html.kt2.k2-lrm .k2-mv { display: none !important; }
html.kt2.k2-lrm .kt-tools { gap: 0; margin-left: 10px; }
html.kt2.k2-lrm .kt-tools .sep { height: 18px; margin: 0 5px; }
html.kt2.k2-lrm .kt-tool { width: 32px; height: 32px; }
html.kt2.k2-lrm .kt-tool svg { width: 17px; height: 17px; }
html.kt2.k2-lrm .kt-tool .tip { top: 40px; }
@media (max-width: 1240px) {
  html.kt2.k2-lrm .kt-tool { width: 29px; height: 29px; }
  html.kt2.k2-lrm .kt-tools .sep { margin: 0 3px; }
  html.kt2.k2-lrm .kt-tools { margin-left: 6px; }
  html.kt2.k2-lrm .k2-lrm-box { width: 104px; }
  html.kt2.k2-lrm .k2-lrm-side { margin-right: 10px; }
}
@media (max-width: 1060px) {
  html.kt2.k2-lrm .kt-tool { width: 26px; height: 26px; }
  html.kt2.k2-lrm .kt-tool svg { width: 15px; height: 15px; }
  html.kt2.k2-lrm .k2-lrm-box { width: 94px; }
}
html.kt2.k2-lrm .transport { gap: 14px; }
.kt2 .k2-lrm-box { position: relative; flex: none; width: 143px; height: 22px; display: block; cursor: default; }
.kt2 .k2-lrm-box.ctl.line { cursor: ew-resize; }
.kt2 .k2-lrm-box.ctl { cursor: ns-resize; touch-action: none; user-select: none; }
.kt2 .k2-lrm-side { flex: none; display: flex; align-items: center; margin-left: -8px; position: relative; }
.kt2 .k2-lrm-a { flex: none; width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; padding: 0;
  font: 800 10px/1 var(--font); color: #77737f; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); cursor: pointer; }
.kt2 .k2-lrm-a:hover { color: #fff; border-color: rgba(255, 255, 255, 0.3); }
.kt2 .k2-lrm-a.on { color: #141218; background: #E4FF3A; border-color: #E4FF3A; }
.kt2 .k2-lrm-info { position: absolute; right: 0; top: calc(100% + 3px); pointer-events: none; font: 700 8.5px/1 var(--font); letter-spacing: 0.06em; white-space: nowrap; font-variant-numeric: tabular-nums; color: #cfcbd6; }
.kt2 .k2-lrm-info.over { color: #ff5a3c; }
.kt2 .k2-lrm-info:empty { display: none; }
.kt2 .k2-lrm-box canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
`;
  document.head.appendChild(css);

  const box = document.createElement("div");
  box.className = "k2-lrm-box";
  box.title = "Output level, left and right";
  box.innerHTML = "<canvas></canvas>";
  time.insertAdjacentElement("afterend", box);
  const cv = box.querySelector("canvas"), g = cv.getContext("2d");

  // segment thresholds in dB (an old deck's scale: wide steps down low, fine steps near 0)
  const SEG = [-48, -42, -36, -31, -27, -23, -20, -17, -14.5, -12, -10, -8.5, -7, -6, -5, -4, -3.2, -2.5, -1.8, -1.2, -0.7, -0.3];
  const HOT = -1.2;                 // from here on the segments are orange
  const HOLD_MS = 1200, FALL_DB_S = 26;

  let split = null, an = [null, null], buf = null, tapped = null;
  function tap() {
    const d = window.purpPlaygroundDebug;
    if (!d || !d.outMeter || !d.ctx) return false;
    if (tapped === d.outMeter) return true;
    try {
      split = d.ctx.createChannelSplitter(2);
      d.outMeter.connect(split);
      an = [0, 1].map((ch) => { const a = d.ctx.createAnalyser(); a.fftSize = 1024; split.connect(a, ch); return a; });
      tapped = d.outMeter;
      return true;
    } catch (e) { return false; }
  }

  const lvl = [-90, -90], peak = [-90, -90], peakAt = [0, 0];
  let last = performance.now();
  function sample(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (let ch = 0; ch < 2; ch++) {
      let pk = 0;
      const a = an[ch];
      if (a) {
        if (!buf || buf.length !== a.fftSize) buf = new Float32Array(a.fftSize);
        a.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) { const v = buf[i] < 0 ? -buf[i] : buf[i]; if (v > pk) pk = v; }
      }
      const db = pk > 1e-5 ? 20 * Math.log10(pk) : -90;
      lvl[ch] = db >= lvl[ch] ? db : Math.max(db, lvl[ch] - FALL_DB_S * dt);
      if (db >= peak[ch]) { peak[ch] = db; peakAt[ch] = now; }
      else if (now - peakAt[ch] > HOLD_MS) peak[ch] = Math.max(lvl[ch], peak[ch] - FALL_DB_S * 1.4 * dt);
    }
  }

  // the meter's x scale (the line uses it): segment centres carry SEG's dB, past the last one up to +6 dB
  const LAB = 9, GAP = 1.7, OZ = window.KT2_MASTER_DRAG_UPDOWN || !CONTROL ? 0 : 11, OVER_MAX = 6;
  const segGeo = () => { const n = SEG.length, segW = (w - LAB - OZ - GAP * (n - 1)) / n; return { n, segW, cx: (i) => LAB + i * (segW + GAP) + segW / 2 }; };
  const xOfDb = (db) => {
    const { n, cx } = segGeo();
    if (db <= SEG[0]) return cx(0);
    for (let i = 1; i < n; i++) if (db <= SEG[i]) return cx(i - 1) + (cx(i) - cx(i - 1)) * (db - SEG[i - 1]) / (SEG[i] - SEG[i - 1]);
    return cx(n - 1) + (w - 2 - cx(n - 1)) * Math.min(1, (db - SEG[n - 1]) / (OVER_MAX - SEG[n - 1]));
  };
  const dbOfX = (x) => {
    const { n, cx } = segGeo();
    if (x <= cx(0)) return SEG[0];
    for (let i = 1; i < n; i++) if (x <= cx(i)) return SEG[i - 1] + (SEG[i] - SEG[i - 1]) * (x - cx(i - 1)) / (cx(i) - cx(i - 1));
    return SEG[n - 1] + (OVER_MAX - SEG[n - 1]) * Math.min(1, (x - cx(n - 1)) / Math.max(1, w - 2 - cx(n - 1)));
  };
  const YELLOW = !!window.KT2_MASTER_LINE_YELLOW;
  let lineHover = false, lineDrag = false, lineA = 0, lineT = 0;   // soft line: shown on hover / while dragging
  let lineDb = null;   // where the yellow line stands (dB of the loudest parts), set by the control; null = no line
  // lit segments are purple (Eman, 11 Nov): a few share one shade, each group to the right a darker purple; the last
  // ones stay orange. KT2_LRMETER_WHITE = the white segments of v314-v316.
  const PURPLES = ["#e2d4ff", "#c4a6ff", "#a57aff", "#8a55f5", "#7038dc"];
  const segCol = (i) => {
    if (window.KT2_LRMETER_WHITE) return "#f4efe6";
    const nCold = SEG.filter((d) => d < HOT).length;
    return PURPLES[Math.min(PURPLES.length - 1, Math.floor(i / Math.ceil(nCold / PURPLES.length)))];
  };
  const lastIdx = (db) => { let k = -1; for (let i = 0; i < SEG.length; i++) if (db >= SEG[i]) k = i; return k; };
  let w = 0, h = 0, dpr = 1;
  function draw() {
    const r = box.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    dpr = window.devicePixelRatio || 1;
    if (r.width !== w || r.height !== h || cv.width !== Math.round(r.width * dpr)) { w = r.width; h = r.height; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const lab = LAB, gap = GAP, rowH = 7, rowGap = 3, top = Math.round((h - rowH * 2 - rowGap) / 2);
    const { n, segW } = segGeo();
    g.font = "600 7.5px Inter, sans-serif"; g.textBaseline = "middle";
    for (let ch = 0; ch < 2; ch++) {
      const y = top + ch * (rowH + rowGap), on = lastIdx(lvl[ch]), pk = lastIdx(peak[ch]);
      g.fillStyle = "#8a8696";
      g.fillText(ch ? "R" : "L", 0, y + rowH / 2 + 0.5);
      for (let i = 0; i < n; i++) {
        const x = lab + i * (segW + gap), hot = SEG[i] >= HOT, lit = i <= on || i === pk;
        if (lit) {
          const col = hot ? "#ff6a2a" : segCol(i);
          g.shadowColor = hot ? "rgba(255, 106, 42, 0.7)" : col + "99";
          g.shadowBlur = 4;
          g.fillStyle = col;
        } else {
          g.shadowBlur = 0;
          g.fillStyle = hot ? "rgba(255, 106, 42, 0.16)" : "rgba(255, 255, 255, 0.07)";
        }
        g.fillRect(Math.round(x), y, Math.max(1, Math.round(segW)), rowH);
      }
      g.shadowBlur = 0;
    }
    if (lineDb != null && !YELLOW) {
      // soft line: fades in on hover, brighter while dragging, nothing when the mouse is away
      const want = lineDrag ? 0.75 : lineHover ? 0.38 : 0;
      const t = performance.now(), dt = Math.min(0.1, (t - (lineT || t)) / 1000); lineT = t;
      lineA = want > lineA ? Math.min(want, lineA + dt * 4) : Math.max(want, lineA - dt * 3);   // ~0.1 s in, a bit slower out
      if (lineA > 0.01) {
        const x = Math.round(xOfDb(lineDb));
        if (OZ) { g.fillStyle = "rgba(255, 90, 60, " + (0.10 * lineA / 0.75).toFixed(3) + ")"; g.fillRect(w - OZ + 2, top, OZ - 2, rowH * 2 + rowGap); }
        g.fillStyle = "rgba(255, 255, 255, " + lineA.toFixed(3) + ")";
        g.fillRect(x, 1, 1, h - 2);
      }
    } else if (lineDb != null) {
      const x = Math.round(xOfDb(lineDb));
      if (OZ) { g.fillStyle = "rgba(255, 90, 60, 0.10)"; g.fillRect(w - OZ + 2, top, OZ - 2, rowH * 2 + rowGap); }   // the too-loud space
      g.shadowColor = "rgba(228, 255, 58, 0.8)"; g.shadowBlur = 5;
      g.fillStyle = "#E4FF3A";
      g.fillRect(x - 1, 0, 2, h);
      g.fillRect(x - 3, 0, 6, 2); g.fillRect(x - 3, h - 2, 6, 2);   // little caps to grab
      g.shadowBlur = 0;
    }
  }


  // ---- master volume: drag the meter, AUTO pill ----
  function setupControl() {
    const U = () => (typeof ui !== "undefined" ? ui : null);
    const M = () => { const u = U(); return u && u.state && u.state.master; };
    const isAuto = () => { const m = M(); return !!(m && m.auto !== false); };
    const debug = () => window.purpPlaygroundDebug || {};
    const autoDb = () => (debug().MAUTO ? debug().MAUTO.db : 0);
    const clampDb = (v) => Math.round(Math.max(-60, Math.min(6, v)) * 10) / 10;
    const fmt = (db) => (db > 0 ? "+" : "") + db.toFixed(1);
    box.classList.add("ctl");
    box.title = "Drag up or down: the whole song louder or quieter. Double-click or Alt-click: AUTO";
    const side = document.createElement("div");
    side.className = "k2-lrm-side";
    side.innerHTML = '<button class="k2-lrm-a">A</button><span class="k2-lrm-info"></span>';
    box.insertAdjacentElement("afterend", side);
    const pill = side.querySelector(".k2-lrm-a"), info = side.querySelector(".k2-lrm-info");
    let dragging = false, shown = "";
    const paint = () => {
      const m = M(), on = isAuto(), over = !on && debug().MAUTO ? debug().MAUTO.over : 0;   // AUTO handles its own peaks
      const txt = dragging ? fmt(m ? +m.volume || 0 : 0) + " dB" : over > 0 ? "+" + over.toFixed(1) + " dB OVER" : "";
      if (txt !== shown) { info.textContent = txt; shown = txt; }
      info.classList.toggle("over", !dragging && over > 0);
      // (tooltips are only written when they change: writing the same words 8 times a second kept waking the page's watchers. KT2_IDLE_WRITES_OLD = old)
      const tip = (n, t) => { if (window.KT2_IDLE_WRITES_OLD || n.title !== t) n.title = t; };
      tip(info, over > 0 ? "Too loud: the limiter is shaving " + over.toFixed(1) + " dB off the peaks. Drag the " + (YELLOW ? "yellow " : "") + "line left, or press A" : "");
      pill.classList.toggle("on", on);
      tip(pill, on ? "AUTO: as loud as it can go without cracking" : "Master volume " + fmt(m ? +m.volume || 0 : 0) + " dB. Press for AUTO");
    };
    (function loop() { if (box.isConnected) paint(); setTimeout(loop, 120); })();
    // AUTO RESET (Eman, 12 Nov): back to AUTO puts the fader back to 0 dB too (playground.js setMasterAuto), so the real
    // sound comes back up, not only the A and the line. Ways back: A, double-click the meter, Alt/Option-click or
    // Cmd/Ctrl-click the meter. The double-click is caught on the second press itself (a dblclick event can get lost),
    // and the A always sends, even if the page already thinks it is on AUTO. KT2_AUTO_RESET_OLD = old A + dblclick only.
    const RESET_OLD = !!window.KT2_AUTO_RESET_OLD;
    let resetAt = 0;
    const toAuto = () => {
      const m = M();
      if (m) { m.auto = true; if (!RESET_OLD) m.volume = 0; }
      resetAt = Date.now();
      run("setMasterAuto", { on: true }); paint();
    };
    pill.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (!RESET_OLD || !isAuto()) toAuto(); });
    box.addEventListener("dblclick", (e) => { e.preventDefault(); e.stopPropagation(); if (RESET_OLD || Date.now() - resetAt > 600) toAuto(); });
    const LINE = !window.KT2_MASTER_DRAG_UPDOWN;
    // the line: on AUTO at AUTO's target (-1 dB); by hand it moves with the fader from where AUTO left it
    let base = null;   // { v, P }: fader v put the loudest parts at P dB (set when leaving AUTO)
    const target = () => (debug().MAUTO ? debug().MAUTO.TARGET : -1);
    const lineNow = () => {
      if (isAuto()) return target();
      const m = M(), v = m ? +m.volume || 0 : 0;
      if (!base) base = { v, P: target() };   // opened already out of AUTO: start the line at the target
      return Math.max(SEG[0], Math.min(OVER_MAX, base.P + (v - base.v)));
    };
    if (LINE) {
      box.classList.add("line");
      box.title = YELLOW ? "Drag the yellow line left or right: where the loudest parts land. Double-click or Alt-click: AUTO" : "Drag left or right: where the loudest parts land. Double-click or Alt-click: AUTO";
      box.addEventListener("pointerenter", () => { lineHover = true; });
      box.addEventListener("pointerleave", () => { lineHover = false; });
      (function follow() { if (box.isConnected) lineDb = lineNow(); requestAnimationFrame(follow); })();
    }
    box.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      if (!RESET_OLD && (e.detail >= 2 || e.altKey || e.metaKey || e.ctrlKey)) { toAuto(); return; }   // second press / Alt-click = AUTO
      box.setPointerCapture(e.pointerId);
      const m = M();
      const x0 = e.clientX, y0 = e.clientY, wasAuto = isAuto(), P0 = LINE ? lineNow() : 0;
      // leaving AUTO keeps today's loudness: the fader takes over what AUTO was adding
      const v0 = clampDb((m ? +m.volume || 0 : 0) + (wasAuto ? autoDb() : 0));
      let v = v0, moved = false, sent = 0, pend = null;
      const send = () => { if (m) m.volume = v; run("setTrackVolume", { trackId: "master", db: v, drag: true }); };
      const move = (ev) => {
        if (!moved && Math.abs(LINE ? ev.clientX - x0 : ev.clientY - y0) < 2) return;
        if (!moved) {
          moved = true; dragging = true; lineDrag = true;
          if (m) { m.auto = false; m.volume = v0; }
          base = { v: v0, P: P0 };
          if (wasAuto) run("setMasterAuto", { on: false, volume: v0 });
          else run("setTrackVolume", { trackId: "master", db: v0 });
        }
        if (LINE) {
          const r = box.getBoundingClientRect();
          v = clampDb(v0 + dbOfX(ev.clientX - r.left) - P0);
        } else v = clampDb(v0 + (y0 - ev.clientY) * 0.15);
        if (m) m.volume = v;
        paint();
        if (Date.now() - sent > 50) { sent = Date.now(); send(); }
        else { clearTimeout(pend); pend = setTimeout(send, 60); }
      };
      const up = () => {
        clearTimeout(pend);
        box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up);
        if (moved) send();
        dragging = false; lineDrag = false;
        paint();
      };
      box.addEventListener("pointermove", move); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    });
  }

  if (CONTROL) setupControl();   // after the scale and the line exist
  box._lrm = { xOfDb: (d) => xOfDb(d), dbOfX: (x) => dbOfX(x), line: () => lineDb, soft: () => ({ lineHover, lineDrag, lineA }) };   // for tests/kt2/masterauto.js

  (function tick(now) {
    if (!document.hidden && box.isConnected && box.offsetParent !== null) {
      if (!tapped || tapped !== (window.purpPlaygroundDebug && window.purpPlaygroundDebug.outMeter)) tap();
      sample(now || performance.now()); draw();
    }
    requestAnimationFrame(tick);
  })();
})();
