// KILLTOY 2: the audio editor (Eman, 4 Nov). Double-click an audio clip and it opens in a box:
// its tempo and warp, the song parts found in it (small marks on top), and the audio cut into
// pieces you can rearrange on the beat. Drag a piece anywhere: where you let go it cuts the
// piece under it there, everything from that point moves along to make room, and the hole it
// left stays empty (you can leave space). A piece can be transposed (it turns purple, with +1 on
// it). Undo / redo / RESET live in the box. The engine renders the pieces into one file
// (editAudio), and keeps the original, so RESET always gets it back.
(function () {
  if (!document.documentElement.classList.contains("kt2")) return;   // the editor before 6 Nov 23:12: kt2-audioedit.js opens this one when KT2_AE_OLD = true
  const DPR = window.devicePixelRatio || 1;
  const ACID = "#e4ff3a", PURP = "#9b6bff", MONO = '"Martian Mono", ui-monospace, Menlo, monospace';
  const E = { c: null, box: null, pieces: [], hist: [], fut: [], peaks: null, sel: -1, drag: null, hover: null, cut: false, secs: [], warps: [], origLen: 0, busy: false, loop: null, secSel: -1, solo: false, raf: 0 };
  const PM = "kt2.aePlayMode";
  const pmode = () => { try { return localStorage.getItem(PM) === "track" ? "track" : "loop"; } catch (e) { return "loop"; } };

  const spb = () => 60 / ((ui.state && ui.state.bpm) || 120);
  const bpmOf = (c) => (c.orig && c.orig.bpm) || c.bpm || 0;
  const clone = (ps) => ps.map((p) => ({ ...p }));
  const endOf = (ps) => Math.max(0, ...ps.map((p) => p.at + p.len));
  const snap = (t) => { const b = spb(), s = E.c.start; return Math.max(0, Math.round((s + t) / b) * b - s); };

  // ---- placing a dragged piece: cut what's under the drop point and push the rest along ----
  function place(ps, k, at) {
    const d = ps[k], rest = ps.filter((_, i) => i !== k).map((p) => ({ ...p }));
    const free = !rest.some((p) => p.at < at + d.len - 1e-6 && at < p.at + p.len - 1e-6);
    if (!free) {
      const out = [];
      for (const p of rest) {
        if (p.at < at - 1e-6 && p.at + p.len > at + 1e-6) {   // the drop point is inside it: cut it there
          const a = at - p.at;
          out.push({ ...p, len: a }, { ...p, from: p.from + a, at: at + d.len, len: p.len - a });
        } else out.push(p.at >= at - 1e-6 ? { ...p, at: p.at + d.len } : p);
      }
      rest.length = 0; rest.push(...out);
    }
    rest.push({ ...d, at });
    return rest.sort((a, b) => a.at - b.at);
  }
  function cutAt(ps, t) {
    const i = ps.findIndex((p) => t > p.at + 0.02 && t < p.at + p.len - 0.02);
    if (i < 0) return null;
    const p = ps[i], a = t - p.at, out = clone(ps);
    out.splice(i, 1, { ...p, len: a }, { ...p, from: p.from + a, at: t, len: p.len - a });
    return out;
  }

  // ---- history (the box's own undo; the engine gets every step as one undo too) ----
  function commit(ps, why) {
    E.hist.push(clone(E.pieces)); E.fut.length = 0;
    E.pieces = ps; send(); paint(); bar();
    if (why && window.KT2Juice && KT2Juice.sound) (KT2Juice.sound[why] || (() => {}))();
  }
  function undo() { if (!E.hist.length) return; E.fut.push(clone(E.pieces)); E.pieces = E.hist.pop(); E.sel = -1; send(); paint(); bar(); }
  function redo() { if (!E.fut.length) return; E.hist.push(clone(E.pieces)); E.pieces = E.fut.pop(); E.sel = -1; send(); paint(); bar(); }
  const isOrig = (ps) => ps.length === 1 && !ps[0].from && !ps[0].at && !ps[0].semi && Math.abs(ps[0].len - E.origLen) < 1e-3;
  function reset() {
    if (isOrig(E.pieces)) return;
    E.hist.push(clone(E.pieces)); E.fut.length = 0;
    E.pieces = [{ from: 0, len: E.origLen, at: 0, semi: 0 }]; E.sel = -1;
    run("editAudio", { clipId: E.c.id, reset: true }); paint(); bar();
    toast("Back to the original cut.");
  }
  let sendT = 0;
  function send() {
    clearTimeout(sendT);
    sendT = setTimeout(() => {
      const ps = E.pieces.filter((p) => p.len > 0.01);
      if (isOrig(ps)) run("editAudio", { clipId: E.c.id, reset: true });
      else run("editAudio", { clipId: E.c.id, pieces: ps }).then((r) => { if (r && r.error) toast(r.error); });
    }, 60);
  }

  // ---- the song parts in it: where the level steps up or down, on 4-bar lines ----
  function findSections(rms, len) {
    const bar = spb() * 4, nb = Math.max(1, Math.floor(len / bar + 1e-6)), lv = [];
    for (let b = 0; b < nb; b++) {
      const a = Math.floor((b * bar / len) * rms.length), z = Math.max(a + 1, Math.floor(((b + 1) * bar / len) * rms.length));
      let s = 0; for (let i = a; i < z && i < rms.length; i++) s += rms[i]; lv.push(s / (z - a));
    }
    const top = Math.max(1e-6, ...lv), starts = [0];
    for (let b = 4; b < nb; b += 4) {
      const prev = lv.slice(b - 4, b).reduce((x, y) => x + y, 0) / 4, next = lv.slice(b, b + 4).reduce((x, y) => x + y, 0) / Math.max(1, Math.min(4, nb - b));
      if (Math.abs(next - prev) / top > 0.14) starts.push(b);
    }
    const parts = starts.map((b, i) => { const e = starts[i + 1] || nb, m = lv.slice(b, e).reduce((x, y) => x + y, 0) / Math.max(1, e - b); return { at: b * bar, end: e * bar, lvl: m / top }; });
    parts.forEach((p, i) => {
      p.name = i === 0 && p.lvl < 0.55 ? "INTRO" : i === parts.length - 1 && p.lvl < 0.55 && parts.length > 2 ? "OUTRO" : p.lvl > 0.8 ? "HOOK" : p.lvl < 0.45 ? "BREAK" : "VERSE";
    });
    return parts;
  }

  // ---- warp markers (Eman, 4 Nov: "already put out all over the song", like Ableton) ----
  // One on every beat where the sound has a clear hit near it (the nearest hit within a 16th
  // pulls the marker onto it), so the strong hits are pinned to the grid across the whole clip.
  function findWarps(P, len) {
    const a = P.rms || P.peak, n = a.length, b = spb();
    if (!n) return [];
    const flux = new Float32Array(n); let mx = 1e-9;
    for (let i = 1; i < n; i++) { flux[i] = Math.max(0, a[i] - a[i - 1]); mx = Math.max(mx, flux[i]); }
    const out = [], win = Math.max(1, Math.round((b / 4) / len * n));
    for (let t = 0; t < len - 1e-6; t += b) {
      const c = Math.round(t / len * n);
      let best = -1, bv = mx * 0.18;
      for (let i = Math.max(1, c - win); i <= Math.min(n - 1, c + win); i++) if (flux[i] > bv) { bv = flux[i]; best = i; }
      if (best >= 0) out.push({ t: (best / n) * len, grid: t, bar: Math.round(t / b) % 4 === 0, k: bv / mx });
    }
    return out;
  }
  // where a moment of the original audio sits now (under the piece that holds it), or null
  const nowOf = (t) => { const p = E.pieces.find((q) => t >= q.from - 1e-6 && t < q.from + q.len - 1e-6); return p ? p.at + (t - p.from) : null; };

  // ---- playing it: LOOP plays only this clip, round the loop (or the whole clip); TRACK plays the song ----
  const playing = () => !!(ui.transport && ui.transport.playing);
  async function play() {
    if (!E.c) return;
    const lp = E.loop || { a: 0, b: endOf(E.pieces) };
    if (pmode() === "loop") {
      const r = await booth("laneSolo", { trackId: E.c.track && E.c.track.id, clipId: E.c.id, from: lp.a, to: lp.b });
      E.solo = !!(r && r.ok);
    } else {
      if (E.solo) { E.solo = false; await booth("laneSolo", { on: false }); }
      await run("setPosition", { time: E.c.start + lp.a });
      if (!playing()) await run("togglePlay");
    }
    tick(); bar();
  }
  async function stop() {
    if (E.solo) { E.solo = false; await booth("laneSolo", { on: false }); }
    else if (playing()) await run("togglePlay");
    bar(); paint();
  }
  const toggle = () => (E.solo || playing() ? stop() : play());
  // a new loop while LOOP plays: keep playing round the new one
  function loopChanged() { if (E.solo && playing()) play(); paint(); }
  function tick() {
    cancelAnimationFrame(E.raf);
    const go = () => { if (!E.box) return; paint(); if (playing()) E.raf = requestAnimationFrame(go); else { if (E.solo) E.solo = false; bar(); paint(); } };
    E.raf = requestAnimationFrame(go);
  }

  // ---- the box ----
  function open(c) {
    if (!c || c.kind === "midi") return;
    close();
    E.c = c; E.sel = -1; E.hist = []; E.fut = []; E.cut = false; E.peaks = null; E.loop = null; E.secSel = -1; E.warps = []; E.solo = false;
    E.origLen = c.edit ? c.edit.orig.length : c.length;
    E.pieces = c.edit ? clone(c.edit.pieces) : [{ from: 0, len: c.length, at: 0, semi: 0 }];
    const col = (typeof colorOf === "function" && c.track ? colorOf(c.track) : null) || "#a7a4b4";
    const ob = bpmOf(c), sb = Math.round((ui.state && ui.state.bpm) || 120), warped = !ob || !!(c.fit && c.fit.tempo) || Math.abs(ob - sb) < 0.5;
    const box = document.createElement("div");
    box.className = "kae";
    box.innerHTML = `<div class="kae-win" role="dialog" aria-label="Audio editor">
      <div class="kae-top">
        <i class="kae-sw" style="background:${col}"></i><b class="kae-nm"></b><span class="kae-tag">AUDIO</span>
        <span class="kae-chip" title="Its own tempo">${ob ? Math.round(ob) : sb} <small>BPM</small></span>
        <span class="kae-chip kae-warp${warped ? " on" : ""}" title="${warped ? "Plays in the song's tempo" : "Plays at its own speed"}"><small>WARP</small> ${warped ? (ob && Math.round(ob) !== sb ? Math.round(ob) + " \u2192 " + sb : "ON") : "OFF"}<i></i></span>
        <span class="kae-chip kae-len"></span>
        <span class="kae-sp"></span>
        <div class="kae-seg"><button data-m="loop">LOOP</button><button data-m="track">TRACK</button></div>
        <button data-a="play" class="kae-play" title="Play / stop (Space)"><svg viewBox="0 0 16 16" width="13" height="13"><path d="M4.5 3.2v9.6L12.5 8z"/></svg></button>
        <button data-a="cut" title="Cut: click where to cut (C). Double-click a piece also cuts.">${svg('<circle cx="4" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><path d="M5.5 10.5L12 2M10.5 10.5L4 2"/>')}CUT</button>
        <button data-a="undo" title="Undo (Cmd+Z)">${svg('<path d="M5 3L2 6l3 3"/><path d="M2 6h8a4 4 0 0 1 0 8H7"/>')}</button>
        <button data-a="redo" title="Redo (Cmd+Shift+Z)">${svg('<path d="M11 3l3 3-3 3"/><path d="M14 6H6a4 4 0 0 0 0 8h3"/>')}</button>
        <button data-a="reset" title="Back to the original cut">RESET</button>
        <button data-a="tune" title="Open TUNR (the notes it sings)">TUNR</button>
        <button data-a="close" class="kae-x" title="Close (Esc)">\u00d7</button>
      </div>
      <div class="kae-stage"><canvas></canvas></div>
      <div class="kae-foot">
        <span class="kae-sel"></span>
      </div>
    </div>`;
    box.querySelector(".kae-nm").textContent = c.name;
    document.body.append(box);
    E.box = box;
    box.addEventListener("mousedown", (e) => { if (e.target === box) close(); });
    box.querySelectorAll(".kae-seg button").forEach((b) => b.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (b.dataset.m === pmode()) return;
      const was = E.solo || playing();
      if (was) await stop();
      try { localStorage.setItem(PM, b.dataset.m); } catch (err) { /* fine */ }
      bar(); if (was) play();
    }));
    box.querySelectorAll(".kae-top button[data-a]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const a = b.dataset.a;
      if (a === "play") return toggle();
      if (a === "close") close(); else if (a === "undo") undo(); else if (a === "redo") redo(); else if (a === "reset") reset();
      else if (a === "cut") { E.cut = !E.cut; bar(); paint(); }
      else if (a === "tune") { const cc = findClip(E.c.id); close(); if (cc && typeof openTune === "function") openTune(cc); }
    }));
    bindStage(box.querySelector(".kae-stage"));
    if (box.animate) box.querySelector(".kae-win").animate([{ opacity: 0, transform: "translateY(10px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: "cubic-bezier(.2,.9,.3,1)" });
    if (window.KT2Juice && KT2Juice.sound && KT2Juice.sound.open) KT2Juice.sound.open();
    bar(); paint();
    booth("getPeaks", { clipId: c.id, buckets: 3000, orig: true }).then((p) => {
      if (!p || E.c !== c) return;
      E.peaks = p;
      E.secs = findSections(p.rms || p.peak, E.origLen);
      E.warps = findWarps(p, E.origLen);
      bar(); paint();
    });
  }
  function close() {
    if (!E.box) return;
    cancelAnimationFrame(E.raf);
    if (E.onResize) { removeEventListener("resize", E.onResize); E.onResize = null; }
    if (E.solo) { E.solo = false; booth("laneSolo", { on: false }); }
    E.box.remove(); E.box = null; E.c = null; E.drag = null;
  }
  const svg = (inner) => `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square">${inner}</svg>`;

  function bar() {
    if (!E.box) return;
    const q = (s) => E.box.querySelector(s);
    q('[data-a="undo"]').disabled = !E.hist.length; q('[data-a="redo"]').disabled = !E.fut.length;
    q('[data-a="reset"]').disabled = isOrig(E.pieces);
    q('[data-a="cut"]').classList.toggle("on", E.cut);
    E.box.querySelectorAll(".kae-seg button").forEach((b) => b.classList.toggle("on", b.dataset.m === pmode()));
    q(".kae-play").classList.toggle("on", E.solo || playing());
    q(".kae-warp i").textContent = E.warps.length ? " \u00b7 " + E.warps.length : "";
    const bars = endOf(E.pieces) / (spb() * 4);
    q(".kae-len").innerHTML = `${bars % 1 < 0.01 || bars % 1 > 0.99 ? Math.round(bars) : bars.toFixed(1)} <small>BARS</small> \u00b7 ${E.pieces.length} <small>PIECE${E.pieces.length > 1 ? "S" : ""}</small>`;
    const p = E.pieces[E.sel], s = q(".kae-sel");
    if (!p) { s.replaceChildren(); return; }
    s.innerHTML = `<b>PIECE ${E.sel + 1}</b><button data-t="-1" title="Down a semitone (\u2193)">\u2212</button><em>${p.semi > 0 ? "+" : ""}${p.semi || 0}</em><button data-t="1" title="Up a semitone (\u2191)">+</button><button data-t="del" title="Take it out, leave the gap (Delete)">${svg('<path d="M3 4h10M6 4V2h4v2M4.5 4l.7 10h5.6l.7-10"/>')}</button>`;
    s.querySelectorAll("button").forEach((b) => b.onclick = (e) => { e.stopPropagation(); b.dataset.t === "del" ? del() : transpose(+b.dataset.t); });
  }
  function transpose(d) {
    if (E.sel < 0) return;
    const ps = clone(E.pieces); ps[E.sel].semi = Math.max(-12, Math.min(12, (ps[E.sel].semi || 0) + d));
    commit(ps); if (window.KT2Juice && KT2Juice.step) KT2Juice.step("knob", d);
  }
  function del() {
    if (E.sel < 0 || E.pieces.length < 2) return;
    const ps = clone(E.pieces); ps.splice(E.sel, 1); E.sel = -1; commit(ps, "poof");
  }

  // ---- drawing ----
  // margins (CSS px). The top 72: the parts (big clickable blocks), the ruler (drag = loop), the warp markers.
  const G = { L: 14, T: 72, R: 14, B: 18 }, SEC = [6, 26], RUL = [28, 54], WRP = [56, 68];
  function geo() {
    const cv = E.box.querySelector(".kae-stage canvas"), w = cv.clientWidth, h = cv.clientHeight;
    const span = Math.max(E.origLen, endOf(E.pieces)) * 1.04 + spb() * 2;
    return { cv, w, h, span, x: (t) => G.L + (t / span) * (w - G.L - G.R), t: (x) => ((x - G.L) / (w - G.L - G.R)) * span, y0: G.T, y1: h - G.B };
  }
  function paint() {
    if (!E.box) return;
    const g0 = geo(), { cv, w, h, x } = g0;
    if (cv.width !== Math.round(w * DPR) || cv.height !== Math.round(h * DPR)) { cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR); }
    const g = cv.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = "#121215"; g.fillRect(0, 0, w, h);
    const b = spb(), off = E.c.start % b;
    // the grid: beats faint, bars clearer, numbers on the ruler
    g.font = `600 8px ${MONO}`; g.textAlign = "left";
    for (let k = 0, t = (b - off) % b; t < g0.span; t += b, k++) {
      const beat = Math.round((E.c.start + t) / b), isBar = beat % 4 === 0, xx = Math.round(x(t)) + 0.5;
      g.fillStyle = isBar ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.035)"; g.fillRect(xx, RUL[0] + (isBar ? 12 : 18), 1, h - RUL[0] - (isBar ? 12 : 18) - G.B);
      if (isBar && (beat / 4) % (x(b * 16) - x(0) < 80 ? 4 : x(b * 4) - x(0) < 30 ? 2 : 1) === 0) { g.fillStyle = "rgba(255,255,255,0.45)"; g.fillText(String(beat / 4 + 1), xx + 3, RUL[0] + 18); }
    }
    // the song parts in the original (subtle marks on top)
    // the ruler band (drag on it to loop, click to move the marker)
    g.fillStyle = "rgba(255,255,255,0.025)"; g.fillRect(G.L, RUL[0], w - G.L - G.R, RUL[1] - RUL[0]);
    // the song parts: blocks you can click (loops that part)
    g.font = `700 9px ${MONO}`;
    E.secRects = [];
    E.secs.forEach((s, i) => {
      const a = nowOf(s.at); if (a == null) return;
      const xa = Math.round(x(a)) + 1, xb = Math.round(x(a + (s.end - s.at))) - 1, on = i === E.secSel, hov = E.hover && E.hover.sec === i;
      E.secRects.push({ i, xa, xb, a, b: a + (s.end - s.at) });
      g.fillStyle = on ? ACID : hov ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)"; g.fillRect(xa, SEC[0], Math.max(2, xb - xa), SEC[1] - SEC[0]);
      g.fillStyle = on ? ACID : "rgba(228,255,58,0.8)"; g.fillRect(xa, SEC[0], 2, SEC[1] - SEC[0]);
      if (xb - xa > 30) { g.save(); g.beginPath(); g.rect(xa + 2, SEC[0], xb - xa - 6, SEC[1] - SEC[0]); g.clip(); g.fillStyle = on ? "#121215" : "#fff"; g.fillText(s.name, xa + 7, SEC[0] + 13.5); g.restore(); }
    });
    // the loop
    if (E.loop) {
      const la = x(E.loop.a), lb = x(E.loop.b);
      g.fillStyle = "rgba(228,255,58,0.85)"; g.fillRect(la, RUL[0], lb - la, 4);
      g.fillStyle = "rgba(228,255,58,0.10)"; g.fillRect(la, RUL[0] + 4, lb - la, RUL[1] - RUL[0] - 4);
    }
    // warp markers: small acid pins on the hits, a faint line down into the wave
    // as many as fit: every beat up close, bars further out, every 4 bars zoomed right out
    const pxB = x(b) - x(0), every = pxB >= 12 ? 1 : pxB * 4 >= 12 ? 4 : 16;
    for (const wm of E.warps) {
      if (Math.round(wm.grid / b) % every) continue;
      const a = nowOf(wm.t); if (a == null) continue;
      const xx = Math.round(x(a)) + 0.5, big = every > 1 ? Math.round(wm.grid / b) % (every * 4) === 0 : wm.bar, s2 = big ? 4 : 3;
      g.fillStyle = big ? "rgba(228,255,58,0.95)" : "rgba(228,255,58,0.45)";
      g.beginPath(); g.moveTo(xx - s2, WRP[0]); g.lineTo(xx + s2, WRP[0]); g.lineTo(xx + s2, WRP[0] + 5); g.lineTo(xx, WRP[0] + 5 + s2); g.lineTo(xx - s2, WRP[0] + 5); g.closePath(); g.fill();
      if (big) { g.fillStyle = "rgba(228,255,58,0.10)"; g.fillRect(xx - 0.5, G.T, 1, h - G.T - G.B); }
    }
    // the pieces
    const col = (typeof colorOf === "function" && E.c.track ? colorOf(E.c.track) : null) || "#a7a4b4";
    const P = E.peaks, n = P ? (P.max || P.peak).length : 0;
    let loud = 0.05; if (P) for (let i = 0; i < n; i++) loud = Math.max(loud, P.max ? P.max[i] : P.peak[i]);
    const preview = E.drag && E.drag.moved ? place(E.pieces, E.drag.k, E.drag.at) : null;
    const show = preview || E.pieces;
    show.forEach((p, i) => {
      const dragged = preview && Math.abs(p.at - E.drag.at) < 1e-6 && p.from === E.pieces[E.drag.k].from && p.len === E.pieces[E.drag.k].len;
      if (dragged) return;   // drawn last, at the hand
      drawPiece(g, g0, p, col, n, loud, !preview && i === E.sel, false);
    });
    if (preview) {
      const d = E.pieces[E.drag.k], xa = x(E.drag.at);
      // where it lands: an acid frame and line
      g.fillStyle = "rgba(228,255,58,0.08)"; g.fillRect(xa, g0.y0, x(E.drag.at + d.len) - xa, g0.y1 - g0.y0);
      g.fillStyle = ACID; g.fillRect(Math.round(xa) - 1, G.T - 14, 2, h - G.T + 14 - G.B);
      g.font = `700 8px ${MONO}`; g.fillStyle = "#121215"; const lab = "DROPS HERE", lw = g.measureText(lab).width + 10;
      g.fillStyle = ACID; g.fillRect(xa + 2, G.T - 14, lw, 12); g.fillStyle = "#121215"; g.fillText(lab, xa + 7, G.T - 5);
      // the piece itself, lifted under the hand
      const dx = E.drag.x - x(d.at) - E.drag.grab;
      g.save(); g.globalAlpha = 0.92; g.translate(dx, -4); drawPiece(g, g0, d, col, n, loud, true, true); g.restore();
    }
    if (E.loop) {   // outside the loop dims a touch
      g.fillStyle = "rgba(10,10,12,0.35)";
      g.fillRect(G.L, G.T, Math.max(0, x(E.loop.a) - G.L), h - G.T - G.B); g.fillRect(x(E.loop.b), G.T, Math.max(0, w - G.R - x(E.loop.b)), h - G.T - G.B);
    }
    // the marker, while it plays this clip's time
    if (ui.transport) {
      const t = ui.transport.position - E.c.start;
      if (t >= 0 && t <= g0.span) { const xx = Math.round(x(t)); g.fillStyle = ACID; g.fillRect(xx - 1, RUL[0], 2, h - RUL[0] - G.B); g.beginPath(); g.moveTo(xx - 5, RUL[0]); g.lineTo(xx + 5, RUL[0]); g.lineTo(xx, RUL[0] + 6); g.closePath(); g.fill(); }
    }
    // the cut line under the mouse
    if ((E.cut || E.hover && E.hover.alt) && E.hover && !E.drag) {
      const t = snap(E.hover.t), xx = Math.round(x(t)) + 0.5;
      g.strokeStyle = ACID; g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(xx, G.T); g.lineTo(xx, h - G.B); g.stroke(); g.setLineDash([]);
    }
  }
  function drawPiece(g, G0, p, col, n, loud, sel, lifted) {
    const { x, y0, y1 } = G0, xa = x(p.at), xb = x(p.at + p.len), w = Math.max(2, xb - xa - 1), mid = (y0 + y1) / 2 + 6, hh = (y1 - y0) / 2 - 12;
    const c = p.semi ? PURP : col;
    g.fillStyle = "#1b1b20"; g.fillRect(xa, y0, w, y1 - y0);
    g.fillStyle = c; g.fillRect(xa, y0, w, 14);
    if (E.peaks && n) {
      const P = E.peaks, mx = P.max || P.peak, mn = P.min || P.peak.map((v) => -v);
      g.fillStyle = c;
      for (let px = 0; px < w; px++) {
        const t = p.from + (px / w) * p.len, i = Math.min(n - 1, Math.max(0, Math.floor((t / E.origLen) * n)));
        const a = (mx[i] / loud) * hh, z = (-mn[i] / loud) * hh;
        g.fillRect(xa + px, mid - a, 1, Math.max(1, a + z));
      }
    } else { g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(xa, mid - 1, w, 2); }
    g.font = `700 8px ${MONO}`; g.textAlign = "left"; g.fillStyle = "#121215";
    const sb = p.from / (spb() * 4) + 1, tag = (p.semi ? (p.semi > 0 ? "+" : "") + p.semi + "  " : "") + "BAR " + (Math.round(sb * 10) / 10);
    if (w > 40) g.fillText(tag, xa + 5, y0 + 10);
    if (p.semi && w > 20) {   // the transposed tag, like on a clip: (+1)
      const t = `(${p.semi > 0 ? "+" : ""}${p.semi})`; g.font = `800 10px Unbounded, Inter, sans-serif`;
      const tw = g.measureText(t).width + 10; g.fillStyle = PURP; g.fillRect(xa + w - tw - 4, y1 - 20, tw, 15); g.fillStyle = "#fff"; g.fillText(t, xa + w - tw + 1, y1 - 9);
    }
    if (sel) { g.strokeStyle = ACID; g.lineWidth = lifted ? 2 : 1.5; g.strokeRect(xa + 0.75, y0 + 0.75, w - 1.5, y1 - y0 - 1.5); }
    g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(xb - 1, y0, 1, y1 - y0);
  }

  // ---- the hand ----
  function bindStage(st) {
    const at = (e) => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const pieceAt = (t) => E.pieces.findIndex((p) => t >= p.at && t < p.at + p.len);
    st.addEventListener("mousemove", (e) => {
      if (E.drag) return;
      const m = at(e), G0 = geo(), t = G0.t(m.x);
      const sr = m.y >= SEC[0] && m.y < SEC[1] ? (E.secRects || []).find((r) => m.x >= r.xa && m.x <= r.xb) : null;
      const was = E.hover && E.hover.sec;
      E.hover = { t, alt: e.altKey, sec: sr ? sr.i : null };
      st.style.cursor = sr ? "pointer" : m.y < G.T ? "text" : E.cut || e.altKey ? "crosshair" : pieceAt(t) >= 0 ? "grab" : "default";
      if (E.cut || e.altKey || was !== E.hover.sec) paint();
    });
    st.addEventListener("mouseleave", () => { E.hover = null; paint(); });
    st.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const m = at(e), G0 = geo(), t = G0.t(m.x), k = pieceAt(t);
      // the parts: click (or double-click) one = loop exactly that part
      if (m.y < SEC[1] + 1) {
        const sr = (E.secRects || []).find((r) => m.x >= r.xa && m.x <= r.xb);
        if (sr) {
          const same = E.secSel === sr.i && e.detail < 2;
          E.secSel = same ? -1 : sr.i; E.loop = same ? null : { a: sr.a, b: sr.b };
          if (window.KT2Juice && KT2Juice.step) KT2Juice.step("move", 1);
          loopChanged(); return;
        }
      }
      // the ruler: drag = a loop (on the beat), click = move the marker there
      if (m.y < G.T) {
        e.preventDefault();
        const a0 = snap(t); let moved = false;
        const mv = (ev) => {
          const tt = snap(G0.t(at(ev).x));
          if (!moved && Math.abs(ev.clientX - e.clientX) < 4) return;
          moved = true; E.secSel = -1;
          E.loop = tt === a0 ? null : { a: Math.min(a0, tt), b: Math.max(a0, tt) };
          paint();
        };
        const up = () => {
          removeEventListener("mousemove", mv); removeEventListener("mouseup", up);
          if (moved) { if (E.loop && window.KT2Juice && KT2Juice.step) KT2Juice.step("move", 1); loopChanged(); return; }
          if (e.detail === 2) { E.loop = null; E.secSel = -1; loopChanged(); return; }   // double-click the ruler: no loop
          run("setPosition", { time: E.c.start + Math.max(0, t) }).then(() => { if (E.solo && playing()) play(); paint(); });
        };
        addEventListener("mousemove", mv); addEventListener("mouseup", up);
        return;
      }
      if (E.cut || e.altKey || e.detail === 2) {
        const ps = cutAt(E.pieces, snap(t));
        if (ps) { E.sel = ps.findIndex((p) => Math.abs(p.at - snap(t)) < 1e-6); commit(ps, "land"); }
        return;
      }
      if (k < 0 || m.y < G.T) { E.sel = -1; bar(); paint(); return; }
      e.preventDefault();
      E.sel = k; bar();
      const p = E.pieces[k], x0 = e.clientX;
      E.drag = { k, x: m.x, grab: m.x - G0.x(p.at), at: p.at, moved: false };
      let lastAt = p.at;
      const mv = (ev) => {
        const mm = at(ev);
        if (!E.drag.moved && Math.abs(ev.clientX - x0) < 4) return;
        E.drag.moved = true; st.style.cursor = "grabbing";
        E.drag.x = mm.x;
        E.drag.at = snap(G0.t(mm.x - E.drag.grab));
        if (E.drag.at !== lastAt) { lastAt = E.drag.at; if (window.KT2Juice && KT2Juice.step) KT2Juice.step("move", 1); }
        paint();
      };
      const up = () => {
        removeEventListener("mousemove", mv); removeEventListener("mouseup", up); st.style.cursor = "";
        const d = E.drag; E.drag = null;
        if (d && d.moved && Math.abs(d.at - p.at) > 1e-6) {
          const ps = place(E.pieces, d.k, d.at);
          E.sel = ps.findIndex((q) => Math.abs(q.at - d.at) < 1e-6 && q.from === p.from);
          commit(ps, "land");
        } else paint();
      };
      addEventListener("mousemove", mv); addEventListener("mouseup", up);
    });
    // one resize listener per open, taken off again in close() (it leaked one per open)
    E.onResize = () => { if (E.box) paint(); };
    addEventListener("resize", E.onResize);
  }
  // Runs first: app2.html registers an early window listener that calls this,
  // so other shortcut handlers can't swallow the editor's keys.
  const onKey = (e) => {
    if (!E.box || e.__kae) return;
    e.__kae = 1;
    const k = e.key.toLowerCase();
    if (k === "escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); e.stopImmediatePropagation(); e.shiftKey ? redo() : undo(); return; }
    if (e.metaKey || e.ctrlKey || /input|textarea/i.test((e.target && e.target.tagName) || "")) return;
    if (k === " ") { if (!e.repeat) toggle(); }
    else if (k === "c") { E.cut = !E.cut; bar(); paint(); }
    else if (k === "arrowup" || k === "arrowdown") transpose(k === "arrowup" ? 1 : -1);
    else if (k === "delete" || k === "backspace") del();
    else { if (!/^(shift|alt|meta|control)$/.test(k)) e.stopImmediatePropagation(); return; }
    e.preventDefault(); e.stopImmediatePropagation();
  };
  window.__kaeKeyOld = onKey;
  addEventListener("keydown", onKey, true);

  const css = document.createElement("style");
  css.textContent = `
.kae { position: fixed; inset: 0; z-index: 8000; display: grid; place-items: center; background: rgba(8, 8, 10, 0.55); }
.kae-win { width: min(1240px, 94vw); height: min(560px, 74vh); display: flex; flex-direction: column; background: #17171b; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 30px 80px rgba(0,0,0,.6); }
.kae-top { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-bottom: 1px solid rgba(255,255,255,.06); flex: none; }
.kae-sw { width: 12px; height: 12px; flex: none; }
.kae-nm { font: 800 13px Unbounded, Inter, sans-serif; letter-spacing: .04em; color: #fff; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kae-tag { font: 700 8px ${MONO}; letter-spacing: .16em; color: rgba(255,255,255,.45); margin-right: 6px; }
.kae-chip { font: 700 11px Inter, sans-serif; color: #fff; padding: 5px 9px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); white-space: nowrap; }
.kae-chip small { font: 600 7.5px ${MONO}; letter-spacing: .14em; color: rgba(255,255,255,.5); }
.kae-chip.on { box-shadow: inset 0 0 0 1px ${ACID}; } .kae-chip.on small { color: ${ACID}; }
.kae-sp { flex: 1; }
.kae-seg { display: flex; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
.kae-top .kae-seg button { background: none; padding: 0 12px; }
.kae-top .kae-seg button.on { background: ${ACID}; color: #141218; }
.kae-top .kae-play { width: 30px; padding: 0; justify-content: center; color: ${ACID}; margin-right: 8px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); background: none; }
.kae-play svg { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; }
.kae-top .kae-play.on { background: ${ACID}; color: #141218; }
.kae-play.on svg path { d: path("M4 4h8v8H4z"); fill: currentColor; }
.kae-warp i { font-style: normal; color: rgba(255,255,255,.55); font-weight: 600; }
.kae-top button { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 0; border-radius: 0; background: rgba(255,255,255,.06); color: #ecebf2; font: 700 8.5px ${MONO}; letter-spacing: .14em; cursor: pointer; }
.kae-top button:hover:not(:disabled) { background: rgba(255,255,255,.12); }
.kae-top button:disabled { opacity: .3; cursor: default; }
.kae-top button.on { background: ${ACID}; color: #141218; }
.kae-top .kae-x { font-size: 16px; padding: 0 10px; background: transparent; }
.kae-stage { flex: 1; position: relative; min-height: 0; }
.kae-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.kae-foot { display: flex; align-items: center; gap: 14px; height: 40px; padding: 0 12px; border-top: 1px solid rgba(255,255,255,.06); flex: none; }
.kae-hint { color: rgba(255,255,255,.4); font: 500 10.5px Inter, sans-serif; margin-left: auto; text-align: right; }
.kae-sel { display: flex; align-items: center; gap: 4px; }
.kae-sel b { font: 700 8px ${MONO}; letter-spacing: .16em; color: ${ACID}; margin-right: 6px; }
.kae-sel em { font: 800 11px Unbounded, Inter, sans-serif; font-style: normal; min-width: 30px; text-align: center; color: #fff; }
.kae-sel button { width: 26px; height: 24px; border: 0; border-radius: 0; background: rgba(255,255,255,.07); color: #fff; font: 700 13px Inter, sans-serif; cursor: pointer; display: inline-grid; place-items: center; }
.kae-sel button:hover { background: rgba(255,255,255,.14); }
@media (max-width: 760px) { .kae-hint { display: none; } .kae-chip.kae-len { display: none; } }
`;
  document.head.append(css);
  window.KT2AudioEditOld = { open, close, _E: E, _place: place };
})();
