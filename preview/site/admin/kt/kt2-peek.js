// KILLTOY 2 WAVE PEEK (Eman, 8 Nov 22:19): the waveform chip on a MIDI clip shows the clip as the
// sound it makes, without bouncing. Press it: an instant sketch from the notes (timing, velocity, the
// synth's attack and release) comes in at once, then the synth plays the clip silently, faster than real
// time (peekRender in playground.js, an OfflineAudioContext), and the real waveform fills in from the
// left behind an acid scan line. No clip is made and nothing is saved. Edit the notes or the sound and it
// renders again (only when something changed). Press the chip again for the notes.
// The RECORD page's PLAYGROUND line uses the same render (kt2-record.js).
// window.KT_PEEK_OFF = true: the chip shows the old "needs the app engine" toast.
(function () {
  "use strict";
  if (!document.documentElement.classList.contains("kt2")) return;
  const ACID = "#E4FF3A";
  const LS = "kt2PeekClips";
  let on;
  try { on = new Set(JSON.parse(localStorage.getItem(LS) || "[]")); } catch (e) { on = new Set(); }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify([...on].slice(-200))); } catch (e) { /* private window */ } };
  const st = new Map();   // clipId -> { c, col, sketch, real, partial, rendering, timer, canvas }
  const S = (id) => { if (!st.has(id)) st.set(id, { id }); return st.get(id); };

  const P = window.KT2Peek = {
    available: () => !window.KT_PEEK_OFF && !!window.OfflineAudioContext && !(ui.state && ui.state.canBounce),
    isOn: (id) => on.has(id),
    // a cut half keeps the waveform view of the clip it came from (Eman 8 Nov 23:10)
    copy(from, to) { if (on.has(from) && !on.has(to)) { on.add(to); save(); } },
    // Several clips selected and the chip pressed on one of them (Eman, 8 Nov 23:12): they all go together.
    // If any of them still shows notes, they all go to waveform (the ones already there stay); once they're
    // all waveform, they all go back to notes. So they line up on the first press and stay in step.
    // window.KT2_PEEK_ONE = only the pressed clip, as before.
    toggle(c) {
      const sel = typeof selectedIds === "function" ? selectedIds() : [];
      const group = !window.KT2_PEEK_ONE && sel.length > 1 && sel.includes(c.id)
        ? sel.filter((id) => { const x = typeof findClip === "function" && findClip(id); return x && x.kind === "midi"; }) : [c.id];
      if (!group.includes(c.id)) group.push(c.id);
      const allOn = group.every((id) => on.has(id));
      for (const id of group) { if (allOn) on.delete(id); else on.add(id); }
      save();
      ui.laneSig = ""; render();
    },
  };

  // ---- the loading look, shared with the PLAYGROUND line: a soft light sweeping through what's still to come,
  // and the acid scan line where the render has got to
  P.shimmer = (g, x0, x1, H, now, dpr) => {
    if (x1 <= x0) return;
    const span = Math.max(120 * dpr, (x1 - x0)), w = 90 * dpr, at = x0 + ((now / 1400) % 1) * (span + w) - w;
    const gr = g.createLinearGradient(at, 0, at + w, 0);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.16)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.save(); g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(Math.max(x0, at), 0, Math.min(x1, at + w) - Math.max(x0, at), H); g.restore();
  };
  P.scan = (g, x, top, bottom, dpr) => {
    g.save();
    const gr = g.createLinearGradient(x - 14 * dpr, 0, x, 0);
    gr.addColorStop(0, "rgba(228,255,58,0)"); gr.addColorStop(1, "rgba(228,255,58,0.28)");
    g.fillStyle = gr; g.fillRect(x - 14 * dpr, top, 14 * dpr, bottom - top);
    g.fillStyle = ACID; g.fillRect(Math.round(x), top, Math.max(1, Math.round(1.5 * dpr)), bottom - top);
    g.restore();
  };

  // ---- drawing one clip: the real waveform when it's there; while rendering, the sketch (dim, shimmering)
  // with the real one growing over it from the left
  const lighten = (col, amt) => {
    const v = parseInt(String(col).replace("#", "").slice(0, 6), 16);
    if (isNaN(v)) return "rgba(240,240,245,0.9)";
    const m = (x) => Math.round(x + (255 - x) * amt);
    return `rgb(${m(v >> 16)},${m((v >> 8) & 255)},${m(v & 255)})`;
  };
  function columns(peaks, bucket, W, len, upto) {
    const out = new Float32Array(W), n = peaks.length;
    for (let x = 0; x < W; x++) {
      const t0 = (x / W) * len, t1 = ((x + 1) / W) * len;
      if (upto != null && t0 >= upto) break;
      let pk = 0;
      for (let i = Math.floor(t0 / bucket), z = Math.min(n - 1, Math.floor(t1 / bucket)); i <= z; i++) if (peaks[i] > pk) pk = peaks[i];
      out[x] = pk;
    }
    return out;
  }
  function draw(s, now) {
    const cv = s.canvas;
    if (!cv || !cv.isConnected || !s.c) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1, W = Math.min(16384, Math.round(r.width * dpr)), H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext("2d");
    g.clearRect(0, 0, W, H);
    const c = s.c, len = c.length, topY = 17 * dpr, h = H - topY - 3 * dpr, mid = topY + h / 2, half = h / 2 - dpr;
    const fin = c.fadeIn || 0, fout = c.fadeOut || 0, cg = dbToLin(c.gain || 0);
    const fadeK = (x) => { const t = (x / W) * len; let k = 1; if (fin > 0 && t < fin) k *= t / fin; if (fout > 0 && t > len - fout) k *= (len - t) / fout; return k; };
    const shape = (cols, scale, gain, fill, x1 = W) => {
      g.beginPath(); g.moveTo(0, mid);
      for (let x = 0; x < x1; x++) g.lineTo(x, mid - Math.min(half, Math.max(0.6 * dpr, cols[x] * gain * fadeK(x))) * scale);
      for (let x = x1 - 1; x >= 0; x--) g.lineTo(x, mid + Math.min(half, Math.max(0.6 * dpr, cols[x] * gain * fadeK(x))) * scale);
      g.closePath(); g.fillStyle = fill; g.fill();
    };
    const gainFor = (peaks) => { let loud = 0.02; for (const v of peaks) if (v > loud) loud = v; return Math.min(0.94 / loud, 4) * half * cg; };
    const col = s.col || "#9a9aa0";
    if (s.real && !s.rendering) {
      const cols = columns(s.real.peaks, s.real.bucket, W, len);
      const gain = gainFor(s.real.peaks);
      // on a full-colour pattern the wave is dark, exactly like audio clips (Eman, 10 Nov 23:01); KT2_PEEK_PALE = old
      if (!window.KT2_PEEK_PALE && cv.closest && cv.closest(".k2-full")) { const old = window.KT2_AUDIO_WAKE_OLD; shape(cols, 1, gain, old ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.68)"); shape(cols, 0.55, gain, "rgba(0,0,0,0.12)"); return; }
      shape(cols, 1, gain, col);
      g.save(); g.filter = `blur(${1.5 * dpr}px)`; g.globalAlpha = 0.13;
      const core = lighten(col, 0.8);
      for (let i = 0; i < 16; i++) shape(cols, 0.68 - i * 0.04, gain, core);
      g.restore();
      return;
    }
    // loading
    const sk = s.sketch, part = s.partial;
    const done = part ? Math.max(0, Math.min(1, part.done)) : 0, edge = Math.round(W * done);
    if (sk && sk.peaks.length) {
      g.save(); g.globalAlpha = 0.32;
      shape(columns(sk.peaks, sk.bucket, W, len), 1, gainFor(sk.peaks), lighten(col, 0.35));
      g.restore();
      P.shimmer(g, edge, W, H, now, dpr);
    }
    if (part && part.peaks.length) {
      // scaled against the louder of what's rendered so far and the sketch's guess, so it doesn't jump around
      const cols = columns(part.peaks, part.bucket, W, len, done * len);
      g.save(); g.beginPath(); g.rect(0, 0, edge, H); g.clip();
      g.fillStyle = "rgba(20,20,24,0.55)"; g.fillRect(0, topY, edge, h);   // the dim sketch steps back where the real one is
      shape(cols, 1, gainFor(part.peaks), col, edge);
      g.restore();
    }
    P.scan(g, Math.max(1, edge), topY, H - 3 * dpr, dpr);
    // a small percentage at the right end of the header
    g.save(); g.font = `600 ${9 * dpr}px Martian Mono, ui-monospace, monospace`; g.textAlign = "right"; g.textBaseline = "middle";
    g.fillStyle = ACID; g.fillText(Math.round(done * 100) + "%", W - 26 * dpr, 9 * dpr);
    g.restore();
  }
  // one animation loop for every clip that's rendering (about 30 frames a second)
  let raf = 0, lastFrame = 0;
  function loop(now) {
    raf = 0;
    let any = false;
    for (const s of st.values()) if (s.rendering) { any = true; if (now - lastFrame > 30) draw(s, now); }
    if (now - lastFrame > 30) lastFrame = now;
    if (any) raf = requestAnimationFrame(loop);
  }
  const animate = () => { if (!raf) raf = requestAnimationFrame(loop); };

  // ---- asking the engine: the sketch at once, then the real render (instant when nothing changed)
  function bucketFor(c) { return Math.max(0.004, Math.min(0.05, c.length / 2400)); }
  function refresh(id) {
    const s = S(id);
    clearTimeout(s.timer);
    s.timer = setTimeout(async () => {
      const c = typeof findClip === "function" ? findClip(id) : null;
      if (!c || !on.has(id) || !s.canvas || !s.canvas.isConnected || s.busy) return;
      s.busy = true;
      const bucket = bucketFor(c);
      let settled = false;
      // only show the loader if it takes a moment: a cached answer swaps straight in, no flash
      const shown = setTimeout(() => {
        if (settled) return;
        s.rendering = true; s.partial = null;
        Promise.resolve(run("peekSketch", { clipId: id, bucket })).then((r) => { if (r && r.ok) s.sketch = r; });
        animate();
      }, 70);
      const r = await run("peekRender", { clipId: id, bucket, onProgress: (x) => { s.partial = x; } });
      settled = true; clearTimeout(shown);
      const rendered = s.rendering;
      s.rendering = false; s.busy = false;
      if (r && r.ok) { s.real = r; if (!r.cached) P.lastMs = r.ms; }
      else if (r && r.off) { on.delete(id); save(); ui.laneSig = ""; render(); return; }
      draw(s, performance.now());
      if (rendered) refresh(id);   // something may have changed while it rendered: ask again (cached if not)
    }, 120);
  }
  P.refresh = refresh;

  // ---- on every clip drawn: a MIDI clip in wave view gets its canvas over the notes
  const _renderClip = renderClip;
  window.renderClip = renderClip = function (c, t, color) {
    const node = _renderClip(c, t, color);
    try {
      if (c.kind === "midi" && on.has(c.id) && P.available()) decorate(node, c, color);
      const mp = node.querySelector(".k2-mp");
      if (mp && c.kind === "midi") {
        mp.classList.toggle("on", on.has(c.id));
        mp.title = on.has(c.id) ? "Back to the notes" : "Show the sound as a waveform (nothing is bounced)";
      }
    } catch (e) { console.warn("WAVE PEEK", e); }
    return node;
  };
  function decorate(node, c, color) {
    node.classList.add("k2-peek");
    const s = S(c.id);
    s.c = c; s.col = c.color || color;
    const cv = document.createElement("canvas");
    cv.className = "k2-peekcv";
    const notes = node.querySelector(":scope > canvas");
    if (notes) notes.after(cv); else node.append(cv);
    s.canvas = cv;
    requestAnimationFrame(() => draw(s, performance.now()));
    refresh(c.id);
  }
  // the sound itself can change without the clip being drawn again (a TOY MACHINE knob): check now and then
  setInterval(() => {
    if (document.hidden || !P.available()) return;
    for (const s of st.values()) if (on.has(s.id) && s.canvas && s.canvas.isConnected && !s.busy) refresh(s.id);
  }, 2500);
  addEventListener("resize", () => { for (const s of st.values()) if (s.canvas && s.canvas.isConnected) draw(s, performance.now()); });

  const css = document.createElement("style");
  css.textContent = `
    .kt2 .clip.k2-peek > canvas:not(.k2-peekcv) { visibility: hidden; }
    .kt2 .clip > canvas.k2-peekcv { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; visibility: visible; }
    .kt2 .clip .k2-mp.on { color: ${ACID}; }
    .kt2 .k2-pghint.k2-pgrendering { color: ${ACID}; font-family: "Martian Mono", ui-monospace, monospace; font-size: 9px; }
  `;
  document.head.append(css);
})();
