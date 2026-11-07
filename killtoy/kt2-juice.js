// KILLTOY 2, V2 "Juice" (Eman, 4 Nov 2026, from the Juice Book page; remade the same night from
// Eman's notes): small moments that make the boring parts of the DAW feel good, and sounds you
// learn to recognise without thinking: each top button has its own note, every snap step of a
// drag is one soft tick, things that worked go up, things that can't happen say "nope".
//   - first time (for now: every time) a synth opens: an FPS-style "new weapon" unlock
//   - dropping, copying, making unique, dropping a file in: the clip pops into place
//   - deleting: a poof; undo/redo: a tape sweep
//   - stems and audio-to-MIDI: shimmer while working, then the result drops in
//   - windows (synths, plugins) pop open with a bloop
//   - while playing: every clip the marker is on breathes on the beat, by how loud (and how much
//     bass) is right there; MIDI notes flick as they're hit. No glow, no rings.
// No drum-like sounds anywhere (it's a music app, a UI snare would be confusing). UI sounds are
// quiet and switch off by themselves while the song plays. Loaded last in app2.html. ASCII only.
"use strict";

window.KT2Juice = (function () {
  const reduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const playing = () => !!(typeof ui !== "undefined" && ui.transport && ui.transport.playing);
  let soundOn = true;
  try { soundOn = localStorage.getItem("kt2.uiSounds") !== "0"; } catch (e) { /* default on */ }

  // the Sound FX slider under the window: 0-200% (Eman, 4 Nov); only these UI sounds, never the music
  const readVol = () => { try { const v = parseFloat(localStorage.getItem("kt2.fxVol")); return isFinite(v) ? Math.max(0, Math.min(4, v)) : 1; } catch (e) { return 1; } };
  let fxVol = readVol();
  const setFxVol = (v) => { fxVol = Math.max(0, Math.min(4, +v || 0)); if (out) out.gain.setTargetAtTime(0.55 * fxVol, ctx.currentTime, 0.02); };
  addEventListener("storage", (e) => { if (e.key === "kt2.fxVol") setFxVol(readVol()); });
  addEventListener("message", (e) => { if (e.data && typeof e.data.ktFxVol === "number") { setFxVol(e.data.ktFxVol); if (e.data.preview) S.ok(); } });

  // ---- sound: tiny synthesized blips, own context, silent while the song plays -------------
  let ctx = null, out = null;
  const ac = () => {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        out = ctx.createGain(); out.gain.value = 0.55 * fxVol;
        // up to 400% (Eman, 4 Nov): a soft limiter after it so loud settings never crackle
        const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.08;
        out.connect(lim).connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };
  const canSound = () => soundOn && fxVol > 0 && !playing() && ac();
  // one voice: an oscillator through a lowpass (lp) with a quick attack and an exponential fall
  function tone(freq, dur, type, gain, slide, delay, lp) {
    const c = canSound(); if (!c) return;
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain || 0.05, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; f.Q.value = 0.4; o.connect(f); node = f; }
    node.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, gain, freq, type, delay) {
    const c = canSound(); if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type || "lowpass"; f.frequency.value = freq || 1500; g.gain.value = gain || 0.05;
    s.buffer = b; s.connect(f).connect(g).connect(out); s.start(c.currentTime + (delay || 0));
  }
  // a soft mallet: fundamental + a quiet 4th partial, lowpassed (marimba-ish, never a drum)
  const mallet = (f, gain, delay, lp) => { tone(f, 0.16, "sine", gain, null, delay, lp || 2200); tone(f * 4, 0.05, "sine", gain * 0.18, null, delay, lp || 2200); };
  // F# minor pentatonic over three octaves: the notes the top buttons are tuned to
  const PENTA = [370, 440, 494, 554, 659, 740, 880, 988, 1109, 1319, 1480, 1760];
  const S = {
    // the mouse itself: a very small, smooth click (Eman: "a smooth subtle click")
    mouse: () => tone(1500, 0.014, "sine", 0.012, 900, 0, 3200),
    // buttons: each one its own note, so you learn them; toggles go up when on, down when off
    button: (f, toggled) => { tone(f, 0.05, "triangle", 0.022, null, 0, 3600); if (toggled != null) tone(f * (toggled ? 1.5 : 0.75), 0.06, "triangle", 0.016, null, 0.045, 3600); },
    release: () => tone(1100, 0.016, "sine", 0.006, null, 0, 2600),
    // a snap step of a drag: a muffled detent, a hair higher going right/up than left/down
    step: (kind, dir, speed) => {
      if (kind === "glide") { const f = 520 * (dir < 0 ? 0.97 : 1.03); tone(f, 0.009, "sine", 0.016, f * 0.92, 0, 1800); return; }   // a fast throw: tiny quick ticks
      const base = { move: 300, row: 240, trim: 360, len: 360, knob: 520, note: 420 }[kind] || 320;
      const f = base * (dir < 0 ? 0.96 : 1.03) * (1 + (speed || 0) * 0.25);
      tone(f, 0.018, "sine", 0.045, f * 0.9, 0, 1300);   // shorter and drier (Eman, 4 Nov)
      noise(0.006, 0.01, 700, "lowpass");
    },
    // a clip settling where you let go: a muffled wooden "tok" with a soft bloom under it
    // (Eman, 4 Nov: the old low "tok" sounded like a mistake) a short dry click that lifts a hair
    land: () => { tone(1250, 0.018, "triangle", 0.03, 1500, 0, 5200); tone(2500, 0.008, "sine", 0.01, null, 0.004, 6000); },
    // it landed on top of another clip: allowed, just a soft "heads up" (two quiet notes, level, no buzz)
    over: () => { mallet(1047, 0.03, 0.02, 4200); mallet(1568, 0.026, 0.085, 4800); },   // snug against another clip: a bright little up-step, a fifth (Eman: the old one sounded negative)
    // a copy appearing (Cmd+D, alt-drag, a file dropped in): bloop-blip up
    copy: () => { tone(523, 0.09, "sine", 0.045, 600, 0, 2400); tone(784, 0.12, "triangle", 0.03, null, 0.055, 3000); },
    // it worked (make unique, saved, a new thing): a little three-note lift
    ok: (d) => { [659, 831, 988].forEach((f, i) => mallet(f, 0.035, (d || 0) + i * 0.05, 3000)); },
    // it can't happen (locked, nothing picked, not possible): two low muffled notes going down
    nope: () => { tone(233, 0.08, "square", 0.022, 220, 0, 700); tone(185, 0.12, "square", 0.022, 170, 0.085, 650); },
    poof: () => { noise(0.2, 0.035, 900, "bandpass"); tone(600, 0.12, "sine", 0.015, 300, 0, 1200); },
    tick: (i, d) => mallet([523, 587, 659, 784, 880, 988, 1175][i % 7], 0.035, d),
    whoosh: (d) => { noise(0.4, 0.04, 1800, "bandpass", d); },
    chime: (d) => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.9, "triangle", 0.03, null, (d || 0) + i * 0.06)); },
    // a window popping open (and closing again, the other way)
    open: () => { tone(280, 0.16, "sine", 0.05, 760, 0, 1600); mallet(1175, 0.03, 0.11); },
    close: () => tone(700, 0.12, "sine", 0.03, 260, 0, 1400),
    dice: () => { for (let i = 0; i < 4; i++) tone(1400 + Math.random() * 900, 0.02, "triangle", 0.02, null, i * 0.045, 4000); mallet(659, 0.035, 0.21); },
    // stacked synths linking up / letting go (Eman, 4 Nov): a rising charge into a click, and a
    // falling suck-back with a soft pop
    plug: () => { noise(0.09, 0.03, 2400, "bandpass"); tone(220, 0.14, "sawtooth", 0.018, 880, 0, 2200); tone(1320, 0.05, "square", 0.012, null, 0.13, 3000); mallet(1760, 0.03, 0.15); },
    unplug: () => { tone(900, 0.18, "sawtooth", 0.016, 140, 0, 1600); noise(0.12, 0.02, 700, "bandpass", 0.02); tone(260, 0.05, "sine", 0.03, 180, 0.17, 900); },
    // a new colour poured on: a wet little rising bloop and a bright two-note "yes"
    paint: () => { tone(330, 0.16, "sine", 0.04, 880, 0, 1800); noise(0.14, 0.012, 1600, "bandpass", 0.02); mallet(988, 0.032, 0.1, 3600); mallet(1319, 0.03, 0.16, 4200); },
    tape: (up) => { tone(up ? 260 : 900, 0.16, "sawtooth", 0.016, up ? 900 : 180, 0, 1800); noise(0.12, 0.018, up ? 2400 : 900, "bandpass", 0.02); },
  };

  // ---- motion -----------------------------------------------------------------------------
  function squash(el, big) {
    if (!el || reduce() || !el.animate) return;
    const a = big ? 0.22 : 0.12;
    el.animate([
      { scale: "1 1" }, { scale: `${1 + a} ${1 - a * 1.6}`, offset: 0.25 },
      { scale: `${1 - a * 0.4} ${1 + a * 0.6}`, offset: 0.6 }, { scale: "1 1" },
    ], { duration: big ? 320 : 240, easing: "ease-out" });
  }
  function shake(el, px) {
    if (!el || reduce() || !el.animate) return;
    px = px || 3;
    const k = [0, 1, 2, 3, 4, 5].map((i) => ({ translate: `${(i % 2 ? -1 : 1) * px * (1 - i / 6)}px 0` }));
    el.animate(k.concat([{ translate: "0 0" }]), { duration: 220 });
  }
  function flinch(el, dx) {
    if (!el || reduce() || !el.animate) return;
    el.animate([{ translate: "0 0" }, { translate: `${dx}px 0` }, { translate: "0 0" }], { duration: 200, easing: "ease-out" });
  }
  let layer = null;
  const fx = () => {
    if (!layer || !layer.isConnected) { layer = document.createElement("div"); layer.className = "kj-layer"; document.body.append(layer); }
    return layer;
  };
  function dust(x, y, n, color, spread) {
    if (reduce()) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i"); p.className = "kj-dust";
      p.style.left = x + "px"; p.style.top = y + "px"; if (color) p.style.background = color;
      fx().append(p);
      const a = Math.PI + Math.PI * (n > 1 ? i / (n - 1) : 0.5), d = (spread || 16) + Math.random() * 18;
      p.animate([{ transform: "translate(0,0) scale(1)", opacity: 0.85 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d * 0.55}px) scale(.2)`, opacity: 0 }],
        { duration: 360 + Math.random() * 220, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => p.remove();
    }
  }
  function burst(x, y, n, color) {
    if (reduce()) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i"); p.className = "kj-dust"; p.style.left = x + "px"; p.style.top = y + "px";
      if (color) p.style.background = color;
      fx().append(p);
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4, d = 30 + Math.random() * 50;
      p.animate([{ transform: "translate(0,0) scale(1.4)", opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 }],
        { duration: 500 + Math.random() * 300, easing: "cubic-bezier(.1,.8,.3,1)" }).onfinish = () => p.remove();
    }
  }
  function flash(el, strength) {
    if (reduce()) return;
    const r = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const f = document.createElement("div"); f.className = "kj-flash";
    Object.assign(f.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", opacity: String(strength || 0.7) });
    fx().append(f);
    setTimeout(() => { f.style.transition = "opacity 140ms"; f.style.opacity = "0"; setTimeout(() => f.remove(), 160); }, 34);
  }
  // a crisp outline that grows off a box and fades (used instead of round rings)
  function frame(r, color) {
    if (reduce() || !r) return;
    const f = document.createElement("i"); f.className = "kj-frame";
    Object.assign(f.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    if (color) f.style.borderColor = color;
    fx().append(f);
    f.animate([{ opacity: 1, transform: "scale(1, 1)" }, { opacity: 0, transform: "scale(1.04, 1.3)" }], { duration: 360, easing: "cubic-bezier(.1,.7,.3,1)" }).onfinish = () => f.remove();
  }
  const clipEl = (id) => document.querySelector(`.clip[data-clip-id="${CSS.escape(String(id))}"]`);
  const after = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  // ---- clips landing / popping in ------------------------------------------------------------
  // the pop Eman loves (Cmd+D): the clip grows out of nothing with a bounce and a light frame
  function pop(ids, sound) {
    const els = [...new Set(ids)].map(clipEl).filter(Boolean);
    if (!els.length) return;
    els.forEach((el, i) => {
      if (!reduce() && el.animate) el.animate([
        { scale: "0.6 0.3", opacity: 0, filter: "brightness(2)" },
        { scale: "1.06 1.12", opacity: 1, offset: 0.5 },
        { scale: "0.98 0.94", offset: 0.78, filter: "brightness(1.2)" },
        { scale: "1 1", filter: "none" }], { duration: 300, delay: i * 40, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" });
      setTimeout(() => frame(el.getBoundingClientRect(), "#e4ff3a"), 120 + i * 40);
    });
    (sound || S.copy)();
  }
  // letting go of a clip (Eman, 4 Nov): no squash, no jump, no sliding; it shrinks a hair, smoothly,
  // and grows back to full size. Audio and MIDI clips get exactly the same.
  function snapIn(el) {
    if (!el || reduce() || !el.animate) return;
    el.animate([{ scale: "1 1" }, { scale: "0.97 0.97", offset: 0.35, easing: "cubic-bezier(.3,0,.4,1)" }, { scale: "1 1" }], { duration: 240, easing: "cubic-bezier(.25,.1,.25,1)" });
  }
  // landing snug against another clip (edge to edge, any kind) gets the soft two-note "click
  // together" Eman liked; landing on top of one gets it too, as a heads-up
  function land(ids) {
    const els = [...new Set(ids)].map(clipEl).filter(Boolean);
    if (!els.length) return;
    let touch = false;
    els.forEach((el) => {
      snapIn(el);
      const r = el.getBoundingClientRect(), lane = el.parentNode;
      if (lane) for (const o of lane.querySelectorAll(":scope > .clip")) {
        if (o === el || els.includes(o) || !o.offsetParent) continue;
        const q = o.getBoundingClientRect();
        if (Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top) < 4) continue;   // another row
        if (Math.min(q.right, r.right) - Math.max(q.left, r.left) > -4) touch = true;
      }
    });
    S.land();
    if (touch) S.over();
  }
  let pending = null;   // a drag's last move: it lands when the mouse comes up
  addEventListener("pointerup", () => {
    if (!pending) return;
    const ids = pending.ids, old = Date.now() - pending.t > 1500; pending = null;
    if (old) return;
    setTimeout(() => after(() => land(ids)), 30);
  }, true);

  // ---- snap steps: one soft tick per step you can see (Eman, 4 Nov) --------------------------
  let nextAt = 0, lastStepAt = 0;
  function step(kind, dir) {
    const now = performance.now(), speed = Math.max(0, Math.min(1, 1 - (now - lastStepAt - 20) / 200));
    lastStepAt = now;
    const at = Math.max(now, nextAt);
    if (at - now > 54) return;   // many steps in one frame: a short roll, not a pile-up
    nextAt = at + 18;
    if (at === now) S.step(kind, dir, speed); else setTimeout(() => S.step(kind, dir, speed), at - now);
  }

  // ---- the commands -------------------------------------------------------------------------
  // ---- a new clip colour washes over every clip it changes, like paint poured from the left (Eman, 4 Nov)
  function clipColours() {
    const m = new Map();
    for (const el of document.querySelectorAll("#rows .clip[data-clip-id]")) {
      const cs = getComputedStyle(el);
      m.set(el.dataset.clipId, { c: cs.getPropertyValue("--c").trim(), body: cs.getPropertyValue("--k2-body").trim() || cs.getPropertyValue("--c").trim() });
    }
    return m;
  }
  function washAll(before) {
    const hit = [];
    for (const el of document.querySelectorAll("#rows .clip[data-clip-id]")) {
      const was = before.get(el.dataset.clipId);
      if (!was || !was.c) continue;
      if (getComputedStyle(el).getPropertyValue("--c").trim() === was.c) continue;
      hit.push([el, was]);
    }
    if (!hit.length) return;
    S.paint();
    if (reduce()) return;
    if (window.KJ_WASH_WIPE) {   // the old left-to-right paint wipe
      const x0 = Math.min(...hit.map(([el]) => el.getBoundingClientRect().left));
      hit.forEach(([el, was]) => wash(el, was, Math.min(260, (el.getBoundingClientRect().left - x0) * 0.35)));
      return;
    }
    // a drop of colour lands and spreads out like a puddle (Eman, 6 Nov 23:39): from where you last clicked
    // when that's on one of them, else from the middle of the first; nearer clips go first, all quick
    const m = lastDown && hit.find(([el]) => { const q = el.getBoundingClientRect(); return lastDown.x >= q.left && lastDown.x <= q.right && lastDown.y >= q.top && lastDown.y <= q.bottom; });
    const q0 = (m || hit[0])[0].getBoundingClientRect();
    const src = m ? { x: lastDown.x, y: lastDown.y } : { x: q0.left + q0.width / 2, y: q0.top + q0.height / 2 };
    hit.forEach(([el, was]) => { const q = el.getBoundingClientRect(); const cx = Math.max(q.left, Math.min(q.right, src.x)), cy = Math.max(q.top, Math.min(q.bottom, src.y));
      puddle(el, was, cx, cy, Math.min(140, Math.hypot(cx - src.x, cy - src.y) * 0.12)); });
  }
  let lastDown = null;
  addEventListener("pointerdown", (e) => { lastDown = { x: e.clientX, y: e.clientY }; }, true);
  function puddle(el, was, px, py, delay) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.bottom < 0 || r.top > innerHeight) return;
    const vis = { l: Math.max(0, r.left), r: Math.min(innerWidth, r.right) };
    if (vis.r - vis.l < 2) return;
    const dpr = devicePixelRatio || 1, cv = document.createElement("canvas"), W = vis.r - vis.l, H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    Object.assign(cv.style, { position: "fixed", left: vis.l + "px", top: r.top + "px", width: W + "px", height: H + "px", pointerEvents: "none", zIndex: 40 });
    document.body.append(cv);
    const g = cv.getContext("2d"); g.scale(dpr, dpr);
    const lab = el.querySelector(".clip-label"), LH = lab ? lab.getBoundingClientRect().bottom - r.top : 0;
    const cx = Math.max(0, Math.min(W, px - vis.l)), cy = Math.max(0, Math.min(H, py - r.top));
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy)) + 8;
    const D = Math.min(520, 260 + far * 0.25), t0 = performance.now() + delay, seed = Math.random() * 6;
    const col = getComputedStyle(el).getPropertyValue("--c").trim() || "#fff";
    const out = (x) => 1 - Math.pow(1 - x, 3);
    const ring = (rad, wob, k) => { g.beginPath(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, rr = rad + Math.sin(a * 5 + seed + k * 6) * wob + Math.sin(a * 3 - seed) * wob * 0.6; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    g.fillStyle = was.body; g.fillRect(0, 0, W, H); if (LH) { g.fillStyle = was.c; g.fillRect(0, 0, W, LH); }   // the old look until the drop lands
    const draw = (now) => {
      const k = (now - t0) / D;
      if (k < 0) { requestAnimationFrame(draw); return; }
      g.clearRect(0, 0, W, H);
      if (k >= 1) { cv.remove(); return; }
      const rad = out(k) * far, wob = Math.min(5, 1.5 + rad * 0.04) * (1 - k);
      // the old colour, with the growing puddle cut out of it
      g.save(); g.beginPath(); g.rect(0, 0, W, H); ring(rad, wob, k); g.clip("evenodd");
      g.fillStyle = was.body; g.globalAlpha = 0.96; g.fillRect(0, 0, W, H);
      if (LH) { g.globalAlpha = 1; g.fillStyle = was.c; g.fillRect(0, 0, W, LH); }
      g.restore();
      // the wet rim, and a faint second ripple behind it
      g.globalAlpha = 0.8 * (1 - k); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 1.4; g.shadowColor = col; g.shadowBlur = 8;
      ring(rad, wob, k); g.stroke();
      g.globalAlpha = 0.35 * (1 - k); g.lineWidth = 1; ring(rad * 0.62, wob * 0.5, k); g.stroke();
      g.shadowBlur = 0; g.globalAlpha = 1;
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }
  function wash(el, was, delay) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.bottom < 0 || r.top > innerHeight) return;
    const vis = { l: Math.max(0, r.left), r: Math.min(innerWidth, r.right) };
    if (vis.r - vis.l < 2) return;
    const dpr = devicePixelRatio || 1, cv = document.createElement("canvas"), W = vis.r - vis.l, H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    Object.assign(cv.style, { position: "fixed", left: vis.l + "px", top: r.top + "px", width: W + "px", height: H + "px", pointerEvents: "none", zIndex: 40, borderRadius: getComputedStyle(el).borderRadius });
    document.body.append(cv);
    const g = cv.getContext("2d"); g.scale(dpr, dpr);
    const lab = el.querySelector(".clip-label"), LH = lab ? lab.getBoundingClientRect().bottom - r.top : 0;
    const t0 = performance.now() + delay, D = 720, seed = Math.random() * 6;
    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const draw = (now) => {
      const k = Math.max(0, (now - t0) / D);
      g.clearRect(0, 0, W, H);
      if (k >= 1) { cv.remove(); return; }
      const p = ease(k), edge = -24 + p * (W + 48), amp = Math.min(9, 3 + W * 0.02) * (1 - p * 0.5);
      const ex = (y) => edge + Math.sin(y * 0.18 + seed + k * 9) * amp + Math.sin(y * 0.07 - k * 5) * amp * 0.6;
      // what's left of the old colour, to the right of the wavy edge
      g.beginPath(); g.moveTo(W, 0); g.lineTo(ex(0), 0);
      for (let y = 2; y <= H; y += 2) g.lineTo(ex(y), y);
      g.lineTo(W, H); g.closePath();
      g.fillStyle = was.body; g.globalAlpha = 0.95; g.fill();
      if (LH) { g.save(); g.clip(); g.globalAlpha = 1; g.fillStyle = was.c; g.fillRect(0, 0, W, LH); g.restore(); }   // the old header colour goes too
      // the wet edge: a bright line with a soft glow
      g.globalAlpha = 0.85 * (1 - k * 0.6); g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.5;
      g.shadowColor = getComputedStyle(el).getPropertyValue("--c").trim() || "#fff"; g.shadowBlur = 10;
      g.beginPath(); g.moveTo(ex(0), 0); for (let y = 2; y <= H; y += 2) g.lineTo(ex(y), y); g.stroke();
      g.shadowBlur = 0;
      // a few drops ahead of the wave
      g.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 3; i++) { const yy = ((i + 1) / 4) * H + Math.sin(seed + i) * 4, xx = ex(yy) + 6 + ((seed * 7 + i * 5) % 8); g.globalAlpha = 0.5 * (1 - k); g.beginPath(); g.arc(xx, yy, 1.4, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }
  function wrapRun() {
    if (typeof run !== "function" || run._juice) return;
    const _run = run;
    const wrapped = async function (cmd, args) {
      let gone = null, rowsBefore = 0;
      if (cmd === "deleteClip" && args) gone = (args.clipIds || [args.clipId]).map(clipEl).filter(Boolean).map((el) => el.getBoundingClientRect());
      const cols = cmd === "setClipColor" && args && !args.drag ? clipColours() : null;
      if (cmd === "splitStems" || cmd === "convertToMidi") { rowsBefore = document.querySelectorAll(".row").length; busyStart(args && args.clipId); }
      const res = await _run.apply(this, arguments);
      try { react(cmd, args || {}, res, gone, rowsBefore); } catch (e) { /* juice never breaks an edit */ }
      if (cols && res && !res.error) after(() => { try { washAll(cols); } catch (e) { /* fine */ } });
      return res;
    };
    wrapped._juice = true;
    window.run = run = wrapped;   // eslint-disable-line no-global-assign
  }
  // continuous drags that send live updates: discrete ones tick once per changed value,
  // smooth ones (gain, volume, knobs) tick at a pace that follows your hand
  const STEPPED = { setClipLength: "len", setLaneOct: "knob", setClipBounds: "trim" };
  const SMOOTH = { setClipGain: 1, setClipFades: 1, setTrackVolume: 1, setParam: 1 };
  const lastVal = new Map();
  let lastSmooth = 0;
  const QUIET = { getState: 1, getPeaks: 1, previewNote: 1, previewNoteOff: 1, setPosition: 1, togglePlay: 1, stop: 1, transport: 1 };
  function react(cmd, args, res, gone, rowsBefore) {
    const ok = res && !res.error;
    // a command that couldn't happen says so (not the quiet background ones)
    if (res && res.error && !QUIET[cmd] && !/^get|^preview|^list|^probe|^scan/.test(cmd)) S.nope();
    if (!ok) return;
    if (STEPPED[cmd] && (args.drag || cmd === "setLaneOct")) {
      const key = cmd + ":" + (args.clipId || args.trackId || ""), val = JSON.stringify([args.beats, args.start, args.length, args.oct, args.octave]);
      const was = lastVal.get(key);
      if (was !== val) { lastVal.set(key, val); step(STEPPED[cmd], 1); }
    } else if (SMOOTH[cmd]) {
      const now = performance.now();
      if (now - lastSmooth > 40) { lastSmooth = now; tone(520 + Math.random() * 30, 0.02, "sine", 0.02, null, 0, 1200); }
    }
    if ((cmd === "moveClips" || cmd === "moveClip" || cmd === "setClipRow") && !copying) {
      const ids = args.moves ? args.moves.map((m) => m.clipId) : [args.clipId];
      if (args.drag) pending = { ids, t: Date.now() };
      else if (pending && Date.now() - pending.t < 2000) pending = { ids, t: Date.now() };
      else after(() => land(ids));
    }
    if (cmd === "duplicateClips") {
      const ids = (res.clipIds || res.ids || []).concat(res.clipId ? [res.clipId] : []);
      if (ids.length) { copying = true; setTimeout(() => { copying = false; }, 400); setTimeout(() => after(() => pop(ids)), 60); }
    }
    if (cmd === "addSample" || cmd === "importAudio" || cmd === "addAudioFile") { if (res.clipId) after(() => pop([res.clipId], () => { S.copy(); S.ok(0.12); })); }
    if (cmd === "makeUnique" || cmd === "makeUniqueLane") {
      const id = res.clipId || args.clipId;
      setTimeout(() => after(() => { pop([id], () => S.ok()); }), 80);
    }
    if (cmd === "deleteClip" && gone) {
      gone.forEach((r) => { burst(r.left + r.width / 2, r.top + r.height / 2, 10, "rgba(255,255,255,.7)"); });
      if (gone.length) S.poof();
    }
    if (cmd === "splitStems" || cmd === "convertToMidi") busyEnd();
    if (cmd === "splitStems" || cmd === "convertToMidi") setTimeout(() => after(() => reveal(cmd, args, res, rowsBefore)), 60);
    if (cmd === "newMidiClip" && res.clipId) after(() => pop([res.clipId]));
    if (cmd === "undo" || cmd === "redo") {
      const up = cmd === "redo";
      S.tape(up);
      const lanes = document.getElementById("lanes") || document.querySelector(".lanes");
      if (lanes && !reduce()) lanes.animate([{ filter: "brightness(1.2)", translate: `${up ? 3 : -3}px 0` }, { filter: "none", translate: "0 0" }], { duration: 200, easing: "ease-out" });
    }
    if (cmd === "saveSession") S.ok();
    if (cmd === "addPlugin" || cmd === "applyChain") S.open();
  }
  let copying = false;

  // stems / audio to MIDI: the clip shimmers while it works, then flash, then the result drops in
  let busyEl = null;
  function busyStart(clipId) {
    busyEl = clipId != null ? clipEl(clipId) : null;
    if (busyEl) busyEl.classList.add("kj-working");
  }
  function busyEnd() { if (busyEl) busyEl.classList.remove("kj-working"); busyEl = null; }
  function reveal(cmd, args, res, rowsBefore) {
    const src = args.clipId != null ? clipEl(args.clipId) : null;
    flash(src, 0.6);
    S.ok();
    const rows = [...document.querySelectorAll(".row")];
    const fresh = rows.length > rowsBefore ? rows.slice(rowsBefore - rows.length) : [];
    const ids = [].concat(res.clipIds || [], res.clipId ? [res.clipId] : []);
    const targets = fresh.length ? fresh : ids.map(clipEl).filter(Boolean);
    targets.forEach((el, i) => {
      setTimeout(() => {
        if (!reduce() && el.animate) el.animate([
          { translate: "0 -18px", opacity: 0 },
          { translate: "0 0", scale: "1.02 .8", opacity: 1, offset: 0.55 },
          { translate: "0 0", scale: ".99 1.05", offset: 0.8 },
          { translate: "0 0", scale: "1 1", opacity: 1 }], { duration: 300, easing: "ease-in" });
        S.tick(i);
      }, 160 + i * 80);
    });
    if (!targets.length && cmd === "convertToMidi") for (let i = 0; i < 5; i++) S.tick(i, 0.16 + i * 0.07);
    if (src) frame(src.getBoundingClientRect(), "#e4ff3a");
  }

  // ---- the FPS-style unlock (Eman, 4 Nov: "cooler, like unlocking a weapon") -----------------
  // THE UNLOCK CARDS (Eman, 4 Nov 14:53: "add these 2 as the cards you get when unlocking"): his two
  // picks are the "90s game box" (wiz) and "Spiked rave flyer" (spike) plugin-screen cards. One of the
  // two shows at random. To swap, change the file names here (all 72 are in the card gallery artifact).
  const UNLOCK_CARDS = {
    "KILLDRUM": ["cards/B_ui_wiz_kd.jpg", "cards/B_ui_spike_kd.jpg"],
    "TOY MACHINE": ["cards/B_ui_wiz_tm.jpg", "cards/B_ui_spike_tm.jpg"],
  };
  // Eman, 4 Nov 17:12: "it's the wrong image": exactly his two picks, the 90s game box for KILLDRUM
  // and the spiked rave flyer for TOY MACHINE (the TM redraws above stay parked: KJ_TM_CARDS = true)
  // Eman, 4 Nov 23:19: the "888 GENESIS" KILLDRUM poster is its card now (the 90s game box: KJ_KD_WIZ = true)
  // Eman, 5 Nov 01:40: new front + back pairs (the earlier picks: KJ_CARDS_V1 = true)
  const PICKED = window.KJ_CARDS_V1 ? { "KILLDRUM": [window.KJ_KD_WIZ ? "cards/B_ui_wiz_kd.jpg" : "cards/C_kd_genesis.jpg"], "TOY MACHINE": ["cards/B_ui_spike_tm.jpg"] }   // 19:31: was the KILLDRUM file by mistake
    : { "KILLDRUM": ["cards/C2_kd.jpg"], "TOY MACHINE": ["cards/C2_tm.jpg"], "TOY KEYS": ["cards/C2_tk.jpg"] };
  // new card backs (Eman, 6 Nov): the castle for TOY MACHINE, the knight for KILLDRUM, with the red
  // KILLTOY logo drawn on top (the pictures have none). KJ_BACK_V2 = true brings back the old backs.
  // Eman, 6 Nov 16:39: no KILLTOY logo on the backs (KJ_BACK_LOGO = true brings it back)
  const BACK3 = !window.KJ_BACK_V2;
  const BACKS = window.KJ_CARDS_V1 ? {} : BACK3 ? { "KILLDRUM": "cards/C3_kd_back.jpg", "TOY MACHINE": "cards/C3_tm_back.jpg" } : { "KILLDRUM": "cards/C2_kd_back.jpg", "TOY MACHINE": "cards/C2_tm_back.jpg" };
  // the first card set (parked): window.KJ_OLD_CARDS = true brings it back
  const OLD_CARDS = {
    "TOY MACHINE": [1, 2, 3, 4, 6, 8, 10, 12, 14, 16].map((n) => "cards/c" + String(n).padStart(2, "0") + "_s.jpg"),
    "KILLDRUM": [1, 2, 3, 5, 7, 9, 11, 13, 15, 17].map((n) => "cards/c" + String(n).padStart(2, "0") + "_d.jpg"),
  };
  const cardsOf = (name) => (window.KJ_OLD_CARDS ? OLD_CARDS : window.KJ_TM_CARDS ? UNLOCK_CARDS : PICKED)[name] || null;
  const SYNTHS = {
    "TOY MACHINE": { type: "SYNTH", rare: "LEGENDARY", logo: "toymachine-logo.png", stats: [["TONE", 9], ["MOTION", 8], ["WEIRD", 8], ["WEIGHT", 6]], col: "#e4ff3a" },
    "TOY KEYS": { type: "KEYS", rare: "STARTER", stats: [["TONE", 8], ["DIRT", 6], ["SPACE", 7], ["WEIGHT", 5]], col: "#8b5cf6" },
    "KILLDRUM": { type: "DRUM MACHINE", rare: "EPIC", logo: "killdrum-logo.png", stats: [["PUNCH", 10], ["GRIT", 8], ["SWING", 6], ["WEIGHT", 9]], col: "#9b6bff" },
    "BLOB": { type: "VISUAL SYNTH", rare: "LEGENDARY", logo: "blob-logo.png", stats: [["GOO", 10], ["GLOW", 8], ["WEIRD", 10], ["WEIGHT", 5]], col: "#e4ff3a" },
    "KILLTOY Synth": { type: "SYNTH", rare: "RARE", stats: [["WARM", 7], ["BITE", 6], ["WIDTH", 8], ["WEIGHT", 7]], col: "#9b6bff" },
    "u wanna 808": { type: "808", rare: "RARE", stats: [["SUB", 10], ["GLIDE", 8], ["DIRT", 6], ["WEIGHT", 10]], col: "#9b6bff" },
    "u wanna Lead": { type: "LEAD", rare: "RARE", stats: [["BITE", 8], ["WIDTH", 6], ["SHINE", 8], ["WEIGHT", 4]], col: "#9b6bff" },
  };
  // for testing (Eman, 4 Nov): these show the unlock every time they open
  // (6 Nov 22:01: Eman already owns these two, so opening them no longer plays the unlock; click the card
  // in CARDS to see it. KJ_UNLOCK_ALWAYS = true brings back the every-time unlock)
  const OWNED = ["TOY MACHINE", "KILLDRUM", "TOY KEYS"];   // TOY KEYS (7 Nov): owned from the start
  const ALWAYS = { has: (n) => !!window.KJ_UNLOCK_ALWAYS && OWNED.includes(n) };
  const info = (name) => SYNTHS[name] || { type: "INSTRUMENT", rare: "NEW", stats: [["TONE", 6], ["MOTION", 6], ["WEIRD", 5], ["WEIGHT", 6]], col: "#ff3b4e" };
  const seen = () => { let l = []; try { l = JSON.parse(localStorage.getItem("kt2.v2.unlocked") || "[]"); } catch (e) { l = []; } return window.KJ_UNLOCK_ALWAYS ? l : [...new Set([...l, ...OWNED])]; };
  const markSeen = (n) => { try { localStorage.setItem("kt2.v2.unlocked", JSON.stringify([...new Set([...seen(), n])])); } catch (e) { /* fine */ } };
  let revealing = false;
  const esc = (s) => String(s).replace(/[<&>"]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;", '"': "&quot;" })[c]);
  function unlock(name) {
    if (revealing) return;
    revealing = true; markSeen(name);
    const k = info(name), quick = reduce(), cards = cardsOf(name), card = !window.KJ_NO_CARDS && cards && cards.length ? cards[Math.floor(Math.random() * cards.length)] : null;
    if (card && !window.KJ_BAND_CARD) return cardReveal(name, k, card, quick);   // the trading card (the band layout for cards is parked)
    const o = document.createElement("div"); o.className = "kj-unlock"; o.style.setProperty("--kc", k.col);
    o.innerHTML = `<div class="kj-scan"></div>
      <div class="kj-band">
        <div class="kj-edge"></div>
        <div class="kj-top"><span class="kj-tag">${esc(k.rare)}</span><span class="kj-new">NEW ${esc(k.type)} UNLOCKED</span></div>
        <div class="kj-main">
          <div class="kj-art${card ? " kj-card" : ""}">${card ? `<img src="${esc(card)}" alt="">` : k.logo ? `<img src="${esc(k.logo)}" alt="">` : `<b>${esc(name.slice(0, 1))}</b>`}</div>
          <div class="kj-nm" data-t=""></div>
          <div class="kj-stats">${k.stats.map(([s, n]) => `<div class="kj-stat"><em>${esc(s)}</em><span class="kj-meter" style="--n:${n}">${"<i></i>".repeat(10)}</span></div>`).join("")}</div>
        </div>
        <div class="kj-bottom"><button class="kj-go"><kbd>ENTER</kbd> EQUIP</button></div>
      </div>`;
    const nm = o.querySelector(".kj-nm"); nm.textContent = name; nm.dataset.t = name;
    document.body.append(o);
    const band = o.querySelector(".kj-band"), go = o.querySelector(".kj-go"), art = o.querySelector(".kj-art"), top = o.querySelector(".kj-top");
    const close = () => {
      if (!o.isConnected) return;
      removeEventListener("keydown", keyClose, true);
      S.button(880, true);
      o.classList.add("out"); setTimeout(() => { o.remove(); revealing = false; }, 260);
    };
    go.onclick = close;
    o.addEventListener("pointerdown", (e) => { if (e.target === o) close(); });
    const keyClose = (e) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); close(); } };
    addEventListener("keydown", keyClose, true);
    if (quick) { o.querySelectorAll(".kj-meter").forEach((m) => [...m.children].forEach((seg, i) => seg.classList.toggle("on", i < +m.style.getPropertyValue("--n")))); return; }
    // 1: the band slams in from the left, hard stop
    band.animate([{ clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)" }, { clipPath: "polygon(0 0, 104% 0, 100% 100%, 0 100%)" }], { duration: 260, easing: "cubic-bezier(.7,0,.2,1)", fill: "backwards" });
    tone(70, 0.5, "sine", 0.12, 45, 0.16, 300); noise(0.25, 0.03, 600, "lowpass", 0.16);
    tone(110, 0.55, "sawtooth", 0.025, 880, 0, 900);   // the charge
    // 2: label types on with a flicker; the logo glitches in
    top.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.2, offset: 0.35 }, { opacity: 1 }], { duration: 300, delay: 260, fill: "backwards" });
    art.animate([{ opacity: 0, translate: "-12px 0", filter: "brightness(3) hue-rotate(90deg)" }, { opacity: 1, translate: "3px 0", offset: 0.5 }, { opacity: 1, translate: "0 0", filter: "none" }], { duration: 320, delay: 320, fill: "backwards", easing: "steps(6)" });
    // 3: the name lands with a split that snaps together
    nm.animate([{ opacity: 0, letterSpacing: "0.6em", filter: "blur(6px)" }, { opacity: 1, letterSpacing: "0.02em", filter: "blur(0)" }], { duration: 380, delay: 420, easing: "cubic-bezier(.2,.9,.2,1)", fill: "backwards" });
    setTimeout(() => { nm.classList.add("kj-split"); setTimeout(() => nm.classList.remove("kj-split"), 260); S.chime(); }, 800);
    // 4: stats fill up, one tick per segment
    o.querySelectorAll(".kj-meter").forEach((m, j) => {
      const n = +m.style.getPropertyValue("--n");
      [...m.children].forEach((seg, i) => {
        if (i >= n) return;
        setTimeout(() => { seg.classList.add("on"); if (i % 2 === 0) tone(700 + i * 60 + j * 30, 0.025, "triangle", 0.012, null, 0, 3000); }, 880 + j * 90 + i * 28);
      });
    });
    // 5: the prompt
    go.animate([{ opacity: 0, translate: "0 6px" }, { opacity: 1, translate: "0 0" }], { duration: 220, delay: 1350, fill: "backwards" });
    setTimeout(() => { mallet(1319, 0.03); go.focus(); }, 1400);
  }
  // ---- THE TRADING CARD (Eman, 4 Nov 17:12, remade 17:34): it pops up face down with the KILLTOY
  // back, shakes while the suspense builds and flips over. Then it LANDS (no light rays), and while
  // it lands a thin white HUD draws itself around it like a game's character screen (Eman's
  // skeleton HUD picture): lines run out, the text types itself, the stat meters fill up, the
  // numbers count. After that it only rocks gently, always showing its front. Grab it to spin it
  // (it springs back to the front), tap a skill or a stat to read about it, and tap a sound to
  // hear a short TOY MACHINE preset melody (the chord ones slide).
  // Line icons: 24x24, thin white strokes with a few solid bits (Eman's icon refs).
  const IC = (b) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="square">${b}</svg>`;
  const DOT = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r || 1.2}" fill="currentColor" stroke="none"/>`;
  const ICONS = {
    disc: IC(`<circle cx="12" cy="12" r="9"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>${DOT(9.5, 10, 2)}${DOT(15, 14.5, 1.3)}`),
    dice: IC([4, 9, 14, 19].map((y) => [4, 9, 14, 19].map((x) => `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="1.4"/>`).join("")).join("")),
    slide: IC(`<path d="M2 18h6l8-12h6"/><rect x="1" y="16" width="3" height="3" fill="currentColor" stroke="none"/><rect x="20" y="4.5" width="3" height="3" fill="currentColor" stroke="none"/>`),
    arp: IC(`<path d="M3 21V3M3 21h18"/><path d="M6 18h3v-3h3v-3h3V9h3V6"/>`),
    drop: IC(`<rect x="3" y="3" width="18" height="18"/><path d="M12 6v10M8 12l4 4 4-4"/>`),
    space: IC(`<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/><circle cx="12" cy="12" r="2.4" fill="#141218"/>`),
    tone: IC(`<path d="M2 12c2.5-7 5-7 7.5 0s5 7 7.5 0 3-5 5-3"/>`),
    motion: IC(`<circle cx="12" cy="12" r="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6M9.5 4.5L12 2l2.5 2.5M9.5 19.5L12 22l2.5-2.5M4.5 9.5L2 12l2.5 2.5M19.5 9.5L22 12l-2.5 2.5"/>`),
    weird: IC(`<path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="4"/><path d="M8 12h8M12 8v8"/>`),
    weight: IC(`<circle cx="12" cy="12" r="10"/><path d="M12 6l5 3v6l-5 3-5-3V9zM12 12l5-3M12 12v6M12 12L7 9"/>`),
    pads: IC([3, 10, 17].map((y) => [3, 10, 17].map((x) => `<rect x="${x}" y="${y}" width="4.5" height="4.5"/>`).join("")).join("")),
    vibe: IC(`<rect x="2" y="5" width="20" height="14"/><path d="M6 12h3M11 12h7"/>${DOT(6, 9, 1)}`),
    drive: IC(`<path d="M3 21L21 3"/><path d="M3 12h4l2-6 3 12 2-6h7"/>`),
    fx: IC(`<rect x="3" y="3" width="18" height="18"/><path d="M12 7v10M7 12h10"/>`),
    groove: IC(`<path d="M3 20V9M8 20V4M13 20v-7M18 20V7"/>${DOT(3, 9, 1.6)}${DOT(8, 4, 1.6)}${DOT(13, 13, 1.6)}${DOT(18, 7, 1.6)}`),
    punch: IC(`<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>${DOT(12, 12, 2.4)}`),
    grit: IC(`<path d="M2 14l3-6 3 9 3-11 3 13 3-9 3 6 2-3"/>`),
    swing: IC(`<path d="M4 20c0-9 7-16 16-16"/><path d="M15 4h5v5"/>`),
    bass: IC(`<rect x="2" y="2" width="20" height="20"/><path d="M5 15c3 0 3-6 7-6s4 6 7 6"/>`),
    synth: IC(`<path d="M3 6h18M3 12h18M3 18h18"/>${DOT(8, 6, 2)}${DOT(15, 12, 2)}${DOT(10, 18, 2)}`),
    pluck: IC(`<path d="M3 3v18h18"/><path d="M6 6c1 8 5 12 15 12"/>`),
    ambient: IC(`<circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12M8 8l8 8M16 8l-8 8"/>`),
    play: IC(`<path d="M7 4l12 8-12 8z" fill="currentColor" stroke="none"/>`),
    stop: IC(`<rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none"/>`),
  };
  // Melodies are in beats: [pitch, start, length, slide]. A slide note glides from the note (or the
  // chord) that sounds before it; seq() makes that note ring into it so the glide has time.
  const seq = (list, glide) => {
    const n = list.map(([p, s, l, sl]) => ({ p, s, l, sl: !!sl }));
    for (const x of n) if (x.sl) for (const q of n) if (q !== x && q.s < x.s && Math.abs(q.s + q.l - x.s) < 0.05) q.l = x.s - q.s + (glide || 0.18);
    return n;
  };
  const chord = (ps, s, l, sl) => ps.map((p) => [p, s, l, sl]);
  // F# minor, 140 (Eman's taste: deep, minor, a bit villainous)
  const ARP = (roots, oct, len) => roots.flatMap((ch, i) => [0, 1, 2, 3, 2, 1, 0, 1].map((k, j) => [ch[k] + oct, i * 2 + j * 0.25, len || 0.22]));
  const PLUCK_CH = [[54, 57, 61, 66], [50, 54, 57, 62], [47, 50, 54, 59], [49, 53, 56, 61]];
  const MELODIES = {
    // 808 with octave slides
    m808: seq([[30, 0, 1.4], [30, 1.5, 0.5], [37, 2, 0.9, 1], [28, 3, 1], [30, 4, 1.4], [33, 5.5, 0.5], [25, 6, 1.1, 1], [42, 7.25, 0.7, 1]], 0.14),
    hollis: seq([[30, 0, 0.75], [30, 1, 0.5], [42, 1.5, 0.5, 1], [30, 2, 1.4, 1], [33, 3.5, 0.5], [28, 4, 1.5], [28, 5.5, 0.5], [40, 6, 0.5, 1], [37, 6.5, 1.5, 1]], 0.12),
    // sliding chords: F#m -> D -> Bm -> C# (the dominant), the top note climbs at the end
    chords: seq([
      ...chord([42, 54, 57, 61], 0, 4), ...chord([38, 54, 57, 62], 4, 4, 1), ...chord([35, 54, 59, 62], 8, 4, 1),
      ...chord([37, 53, 56, 61], 12, 2, 1), [66, 14, 2, 1],
    ], 0.5),
    stabs: seq([
      ...chord([54, 59, 62], 0, 0.5), ...chord([54, 59, 62], 0.75, 0.5), ...chord([56, 61, 64], 1.5, 1, 1),
      ...chord([54, 57, 61], 3, 0.5), ...chord([54, 57, 61], 3.75, 0.5), ...chord([53, 56, 61], 4.5, 1, 1),
      ...chord([54, 59, 62], 6, 0.5), ...chord([56, 61, 64], 6.75, 0.5, 1), ...chord([57, 61, 66], 7.5, 1.5, 1),
    ], 0.2),
    arp: seq([...ARP(PLUCK_CH, 12), [73, 8, 1], [66, 9, 1, 1]], 0.3),
    coin: seq([[73, 0, 0.5], [71, 0.75, 0.25], [69, 1, 0.5], [68, 1.5, 0.5], [66, 2, 1.25], [61, 3.5, 0.5], [64, 4, 0.5], [66, 4.75, 0.25], [69, 5, 0.75], [68, 5.75, 0.25], [66, 6, 0.5], [73, 6.5, 0.5, 1], [66, 7, 1, 1]], 0.12),
    haze: seq([
      ...chord([42, 54, 56, 61], 0, 8), [68, 1, 2], [69, 3, 2, 1], [73, 5, 3, 1],
      ...chord([38, 50, 54, 57], 8, 8, 1), [66, 9, 3, 1], [64, 12, 4, 1],
    ], 0.9),
    strings: seq([...chord([42, 49, 54, 57], 0, 4), ...chord([40, 47, 52, 56], 4, 4, 1), ...chord([38, 50, 54, 57], 8, 4, 1), ...chord([37, 49, 53, 56], 12, 4, 1)], 0.8),
  };
  const P = "Electronic/";
  const SOUNDS_TM = [
    { kind: "BASS", icon: "bass", list: [{ name: "COLDHEART 808", preset: P + "Bass/808 - Coldheart", mel: "m808", gain: 0.9 }, { name: "2HOLLIS", preset: P + "Bass/2Hollis", mel: "hollis", gain: 0.9 }] },
    { kind: "SYNTH", icon: "synth", list: [{ name: "GREYROCK", preset: P + "Synths/Greyrock", mel: "chords", gain: 0.9 }, { name: "WALK THRU WATER", preset: P + "Synths/Walk Thru Water - Chords", mel: "stabs", gain: 1.3 }] },
    { kind: "PLUCK", icon: "pluck", list: [{ name: "DARK RAVE", preset: P + "Plucks/Dark rave", mel: "arp", gain: 1.3 }, { name: "NIGHT IS DARK", preset: P + "Plucks/Clara (the night is dark) - Pluck 3", mel: "coin", gain: 1.8 }] },
    { kind: "AMBIENT", icon: "ambient", list: [{ name: "APATHY HAZE", preset: P + "Pads/Apathy Haze", mel: "haze", gain: 1.2 }, { name: "END OF THE WORLD", preset: P + "Synths/STRINGS End of The World", mel: "strings", gain: 1.4 }] },
  ];
  // the card's "back side": what each machine can do, in the shape of a game card
  const SHEETS = {
    "TOY MACHINE": {
      no: "TM-001", pwr: 180, cls: "SYNTH / WAVETABLE",
      skills: [
        { icon: "disc", name: "MORPH DISC", cost: 3, val: "6", info: "A landscape with circles on it. Drag a circle and every macro under it moves at once." },
        { icon: "slide", name: "SLIDE", cost: 2, val: "FL", info: "Mark a note as slide and it glides from the note before. A chord slides into the next chord, note by note." },
        { icon: "dice", name: "DICE", cost: 1, val: "1/16", info: "Roll a knob and it wanders around its own spot by itself, from 4 bars down to 1/16." },
        { icon: "arp", name: "ARP", cost: 2, val: "303", info: "Built-in arpeggiator. Steps can slide into each other, 303 style." },
        { icon: "drop", name: "DROP ZONE", cost: 2, val: "6", info: "Drop any sound on it and it plays as part of the synth, in tune." },
        { icon: "space", name: "SPACE", cost: 3, val: "12", info: "Drive, crush, chorus, phaser, delay, reverb, OTT, comp, EQ, width, clip, texture." },
      ],
      icons: ["tone", "motion", "weird", "weight"],
      statInfo: { TONE: "How much tone you get from 5 sources: 2 wavetable oscillators, sub, noise and a sampler.", MOTION: "LFOs, envelopes, dice and the disc keep the sound moving.", WEIRD: "Warps, drops and dice take it far from a normal synth.", WEIGHT: "Low end. The 808 presets are sampled 808s with glide." },
      vars: [["PRESETS", 864], ["MACROS", 6], ["SOURCES", 5], ["FX TYPES", 12], ["VOICES", 8]],
      sounds: SOUNDS_TM,
    },
    "KILLDRUM": {
      no: "KD-001", pwr: 160, cls: "DRUM MACHINE",
      skills: [
        { icon: "pads", name: "9 PADS", cost: 1, val: "9", info: "Kick, 808, snare, clap, closed hat, open hat, perc, FX and texture." },
        { icon: "vibe", name: "VIBE", cost: 3, val: "TXT", info: "Type a vibe like \"dark carti 808s, crunchy snares\" and it builds the kit. Then ask for changes." },
        { icon: "dice", name: "DICE KIT", cost: 1, val: "RND", info: "Roll a whole new kit from the library." },
        { icon: "drive", name: "DRIVE", cost: 2, val: "6", info: "Every pad has pitch, decay, drive, filter, pan and level." },
        { icon: "fx", name: "FX CARDS", cost: 3, val: "30", info: "30 effects: grains, tape stop, portals, spectral freeze, wavefold, gate sequencer, shimmer and more." },
        { icon: "groove", name: "GROOVES", cost: 2, val: "SW", info: "Ready-made grooves to start a beat from." },
      ],
      icons: ["punch", "grit", "swing", "weight"],
      statInfo: { PUNCH: "How hard the hits come through.", GRIT: "Drive, crush and dirt on every pad.", SWING: "Grooves and feel.", WEIGHT: "Kicks and 808s." },
      vars: [["PADS", 9], ["KNOBS", 6], ["FX", 30], ["SLOTS", 9]],
      sounds: [],
    },
  };
  const sheetOf = (name, k) => SHEETS[name] || { no: "KT-000", pwr: 100, cls: k.type, skills: [], icons: ["tone", "motion", "weird", "weight"], statInfo: {}, vars: [], sounds: [] };

  // ---- the demo sounds: real TOY MACHINE presets in the engine, on the juice audio context ----
  let tmApi = null, demoBus = null, demo = null;
  const tmPresetCache = new Map(), tmSampleCache = new Map();
  const loadTM = () => {
    const c = ac();
    if (!c || !window.ToyMachine || !c.audioWorklet) return Promise.reject(new Error("no TOY MACHINE here"));
    if (!demoBus) {
      demoBus = c.createGain(); demoBus.gain.value = 0.8;
      const lim = c.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 4; lim.ratio.value = 14; lim.attack.value = 0.002; lim.release.value = 0.12;
      demoBus.connect(lim).connect(c.destination);
    }
    return tmApi || (tmApi = window.ToyMachine.load(c, "toy-machine.wasm").catch((e) => { tmApi = null; throw e; }));
  };
  const fetchPreset = (id) => {
    if (!tmPresetCache.has(id)) tmPresetCache.set(id, fetch("toy-machine/presets/" + id.split("/").map(encodeURIComponent).join("/") + ".json")
      .then((r) => { if (!r.ok) throw new Error(r.status + " " + id); return r.json(); }).catch((e) => { tmPresetCache.delete(id); throw e; }));
    return tmPresetCache.get(id);
  };
  const fetchSample = (pr) => {
    const sm = pr && pr.sampler, f = sm && sm.on && typeof sm.file === "string" && /^samples\//.test(sm.file) ? sm.file : null;
    if (!f) return Promise.resolve(null);
    if (!tmSampleCache.has(f)) tmSampleCache.set(f, fetch("toy-machine/" + f.split("/").map(encodeURIComponent).join("/"))
      .then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => {
        const data = new Float32Array(buf.length);
        for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) data[i] += d[i] / buf.numberOfChannels; }
        return { data, sampleRate: buf.sampleRate };
      }).catch(() => { tmSampleCache.delete(f); return null; }));
    return tmSampleCache.get(f);
  };
  function stopDemo(fade) {
    if (!demo) return;
    const d = demo; demo = null;
    d.timers.forEach(clearTimeout); d.cancelled = true;
    if (d.synth) {
      const c = ctx, g = d.gain;
      try { d.synth.flush("soft"); } catch (e) { /* gone */ }
      if (g) { g.gain.setTargetAtTime(0, c.currentTime, fade ? 0.12 : 0.03); }
      setTimeout(() => { try { d.synth.close(); } catch (e) { /* gone */ } }, fade ? 900 : 300);
    }
    if (d.onEnd) d.onEnd();
  }
  // plays sound s; onNote(i, note) fires as each note is heard, onEnd when it's over or stopped
  async function playDemo(s, onNote, onEnd, onReady) {
    stopDemo();
    const d = demo = { timers: [], onEnd, cancelled: false };
    try {
      const [TM, pr] = await Promise.all([loadTM(), fetchPreset(s.preset)]);
      const smp = await fetchSample(pr);
      if (d.cancelled) return;
      const c = ctx, bpm = 140, spb = 60 / bpm, notes = MELODIES[s.mel] || [];
      d.synth = TM.create({ preset: pr, getTransport: () => ({ bpm, songAt: 0, playing: true }) });
      if (smp) d.synth.setSample(smp);
      d.gain = c.createGain(); d.gain.gain.value = s.gain || 0.8;
      d.synth.output.connect(d.gain).connect(demoBus);
      const t0 = c.currentTime + 0.12;
      d.synth.schedule(notes.map((n) => ({ pitch: n.p, velocity: 100, on: t0 + n.s * spb, off: t0 + (n.s + n.l) * spb, slide: n.sl })));
      if (onReady) onReady(notes.reduce((m, n) => Math.max(m, n.s + n.l), 0) * spb);
      const lead = (t0 - c.currentTime) * 1000;
      notes.forEach((n, i) => d.timers.push(setTimeout(() => onNote && onNote(i, n), lead + n.s * spb * 1000)));
      const end = notes.reduce((m, n) => Math.max(m, n.s + n.l), 0) * spb * 1000 + lead;
      d.timers.push(setTimeout(() => { if (demo === d) stopDemo(true); }, end + 200));
    } catch (e) {
      console.warn("[card] demo sound", e && e.message);
      if (demo === d) { demo = null; if (onEnd) onEnd(e); }
    }
  }
  // a tiny piano roll of a melody, drawn as thin lines; slides are drawn as diagonals
  function rollSvg(notes) {
    if (!notes.length) return "";
    const end = notes.reduce((m, n) => Math.max(m, n.s + n.l), 0), lo = Math.min(...notes.map((n) => n.p)), hi = Math.max(...notes.map((n) => n.p));
    const W = 120, H = 26, x = (b) => (b / end) * W, y = (p) => H - 3 - ((p - lo) / Math.max(1, hi - lo)) * (H - 6);
    const sounding = (n) => notes.filter((q) => q !== n && q.s < n.s && q.s + q.l > n.s);
    const segs = notes.map((n, i) => {
      let path = `<path data-i="${i}" d="M${x(n.s).toFixed(1)} ${y(n.p).toFixed(1)}H${x(n.s + n.l).toFixed(1)}"/>`;
      if (n.sl) {
        const from = sounding(n).sort((a, b) => Math.abs(a.p - n.p) - Math.abs(b.p - n.p))[0];
        if (from) path += `<path class="sl" d="M${x(n.s - 0.15).toFixed(1)} ${y(from.p).toFixed(1)}L${x(n.s + 0.1).toFixed(1)} ${y(n.p).toFixed(1)}"/>`;
      }
      return path;
    }).join("");
    return `<svg class="kc-roll" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${segs}</svg>`;
  }

  // ---- the pixel reveal (Eman, 4 Nov 23:19 + 23:27) -------------------------------------------
  // A canvas over the card's picture. First a grungy, morphing low-res field in the KILLTOY colours
  // (like TOY MACHINE's circle: liquid shapes, posterized, grain, scanlines, torn rows, a few glyphs).
  // Then blocks lock in (in glitchy bands) to the picture: first an outlined block in its colour,
  // then solid; then the whole card steps down to finer pixels and the real picture comes through.
  // It never shows a flat colour: before the picture is in, it keeps churning. Only drawImage is used
  // (no pixel reads), so it works when the picture comes from another address.
  function pixelReveal(front, img, col) {
    const cv = front.querySelector(".kc-px"), g = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
    const CW = front.offsetWidth || 300, CH = front.offsetHeight || 400;
    cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr);
    const CELL = Math.max(10, Math.round(CW / 24)), cols = Math.ceil(CW / CELL), rows = Math.ceil(CH / CELL);
    // the field: a small canvas, drawn big with hard pixels
    const FW = cols * 2, FH = rows * 2, fc = document.createElement("canvas"); fc.width = FW; fc.height = FH;
    const fg = fc.getContext("2d"), fd = fg.createImageData(FW, FH);
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const RAMP = ["#07060b", "#140e22", "#2a1d3d", "#4a2f8a", "#7b52e6", "#9b6bff", "#ff3b5c", "#e4ff3a", "#f4f0ff"].map(hex);
    const acc = hex(/^#[0-9a-f]{6}$/i.test(col || "") ? col : "#e4ff3a");
    // grain, made once
    const gn = document.createElement("canvas"); gn.width = gn.height = 96;
    { const gg = gn.getContext("2d"), id = gg.createImageData(96, 96); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gg.putImageData(id, 0, 0); }
    const grain = g.createPattern(gn, "repeat");
    const GLY = "#%&@$0123456789ABCDEFKXYZ/<>=+*?!".split("");
    const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const band = Array.from({ length: rows }, (_, r) => hash(Math.floor(r / 3), 7) * 0.5);
    const th = Array.from({ length: cols * rows }, (_, i) => Math.min(0.98, hash(i, 3) * 0.55 + band[Math.floor(i / cols)]));
    let mos = null;   // the picture in blocks: [cell, cell/2, cell/4] (small canvases, drawn big)
    const sample = (n) => {
      const w = Math.ceil(CW / n), h = Math.ceil(CH / n), oc = document.createElement("canvas"); oc.width = w; oc.height = h;
      const og = oc.getContext("2d"), iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.max(w / iw, h / ih);
      og.imageSmoothingQuality = "high";
      og.drawImage(img, (w - iw * sc) / 2, (h - ih * sc) / 2, iw * sc, ih * sc);   // object-fit: cover
      return { c: oc, w, h, n };
    };
    const ready = () => {
      if (mos) return true;
      if (!img.complete || !img.naturalWidth) return false;
      mos = [sample(CELL), sample(CELL / 2), sample(CELL / 4)];
      return true;
    };
    img.decode && img.decode().then(ready, () => {});
    function field(t, dens) {
      const T = t / 1000, d = fd.data;
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        const u = x / FW, w = y / FH;
        // a warped, liquid pattern that keeps morphing
        const wx = u * 5 + Math.sin(w * 6 + T * 1.7) * 0.9 + Math.sin(T * 0.6 + u * 3) * 0.5, wy = w * 5 + Math.sin(u * 5 - T * 1.3) * 0.9;
        let v = Math.sin(wx + Math.sin(wy * 1.3 + T * 2.1)) * 0.5 + Math.sin(wy * 1.7 - T * 1.1 + Math.sin(wx * 0.8)) * 0.35 + Math.sin((wx + wy) * 2.4 + T * 3) * 0.15;
        v = v * 0.5 + 0.5;
        v += (hash(x + y * 997, Math.floor(T * 14)) - 0.5) * 0.22;   // grit
        v = Math.pow(Math.max(0, Math.min(1, v)), 1.35 - dens * 0.45);
        const q = Math.min(RAMP.length - 1, Math.floor(v * RAMP.length));   // posterized
        let c = RAMP[q];
        if (q === RAMP.length - 2 && hash(x, y + 5) < 0.5) c = acc;
        const k = (y * FW + x) * 4;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
      fg.putImageData(fd, 0, 0);
    }
    // torn rows: strips of what's drawn slide sideways
    function tear(t, amt) {
      if (amt <= 0.02) return;
      const n = 2 + Math.floor(amt * 6), seed = Math.floor(t / 90);
      for (let i = 0; i < n; i++) {
        if (hash(i, seed) > 0.5 + amt * 0.4) continue;
        const y = hash(i + 9, seed) * CH, h = 3 + hash(i + 3, seed) * CELL * 1.6, dx = (hash(i + 7, seed) - 0.5) * CELL * 4 * amt;
        g.drawImage(cv, 0, y * dpr, cv.width, h * dpr, dx, y, CW, h);
      }
    }
    function grunge(t, amt) {
      g.save();
      g.globalCompositeOperation = "overlay"; g.globalAlpha = 0.18 + 0.3 * amt;
      g.translate(-hash(1, Math.floor(t / 60)) * 96, -hash(2, Math.floor(t / 60)) * 96);
      g.fillStyle = grain; g.fillRect(0, 0, CW + 96, CH + 96);
      g.restore();
      g.fillStyle = "rgba(0,0,0," + (0.12 + 0.12 * amt).toFixed(3) + ")";
      for (let y = 0; y < CH; y += 3) g.fillRect(0, y, CW, 1);   // scanlines
    }
    let lastBlip = 0, lastTick = 0, step = 0, gone = false;
    function draw(t, p, dens) {
      if (gone) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
      const now = performance.now();
      // Eman, 5 Nov 01:10: no peek at the picture before the hit: it stays glitched (coarse mosaic, tears)
      // until the ripple's punch, which swaps in the real picture at once. KJ_FADE_REVEAL = true: the old fade-in
      const FADE = !!window.KJ_FADE_REVEAL;
      if (!FADE) { dens = Math.min(1, dens + Math.max(0, p) * 0.6); p = 0; }   // only the churn, harder and harder, until the hit
      const fine = p > 0.62 ? (p > 0.8 && FADE ? 2 : 1) : 0;
      if (fine && mos) {
        const m = mos[fine];
        g.drawImage(m.c, 0, 0, m.w * m.n, m.h * m.n);
        tear(t, FADE ? (1 - p) * 0.6 : 0.45);
        grunge(t, FADE ? (1 - p) * 0.8 : 0.6);
        if (step < fine) { step = fine; const f = fine === 1 ? 660 : 990; tone(f, 0.06, "square", 0.016, f * 0.5, 0, 4200); tone(f * 1.5, 0.05, "square", 0.01, null, 0.03, 5200); noise(0.06, 0.025, 4000, "highpass"); }
        cv.style.opacity = String(FADE && p > 0.9 ? Math.max(0, 1 - (p - 0.9) / 0.1) : 1);
        front.style.setProperty("--pxa", String(FADE && p > 0.86 ? Math.min(1, (p - 0.86) / 0.12) : 0));
        return;
      }
      cv.style.opacity = "1";
      field(t, dens);
      g.drawImage(fc, 0, 0, FW * CELL / 2, FH * CELL / 2);
      // a few glyphs and boxes riding on it
      const tick = Math.floor(t / 80);
      g.font = `700 ${Math.round(CELL * 0.9)}px "Martian Mono", ui-monospace, monospace`; g.textAlign = "center"; g.textBaseline = "middle";
      let resolved = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, x = c * CELL, y = r * CELL;
        const q = p <= 0 || !mos ? 0 : Math.max(0, Math.min(1, (p / 0.62 - th[i]) / 0.18));
        if (q <= 0) {
          const h = hash(i, tick);
          if (h < 0.06 * dens) { g.fillStyle = h < 0.03 ? "#f4f0ff" : "#e4ff3a"; g.fillText(GLY[Math.floor(hash(i, tick + 7) * GLY.length)], x + CELL / 2, y + CELL / 2 + 1); }
          else if (h < 0.1 * dens) { g.strokeStyle = "rgba(244,240,255,.7)"; g.lineWidth = 1; g.strokeRect(x + CELL * 0.18, y + CELL * 0.18, CELL * 0.64, CELL * 0.64); }
          continue;
        }
        resolved++;
        g.drawImage(mos[0].c, c, r, 1, 1, x, y, CELL, CELL);
        if (q < 0.5) { g.fillStyle = "rgba(7,6,11,.72)"; g.fillRect(x + CELL * 0.2, y + CELL * 0.2, CELL * 0.6, CELL * 0.6); }   // an outlined block in the picture's colour
        else if (q < 0.8) { g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1); }
      }
      tear(t, p <= 0 ? 0.35 + 0.65 * dens : 0.8 * (1 - p));
      grunge(t, 1 - Math.max(0, p));
      // sound: grungy data while it churns, rising ticks as blocks lock in
      if (p <= 0) { if (now - lastBlip > 45) { lastBlip = now; tone(500 + Math.random() * 2200 * dens, 0.014, "sawtooth", 0.004 + 0.006 * dens, null, 0, 3800); if (Math.random() < 0.35 * dens) noise(0.03, 0.016, 1200 + Math.random() * 3000, "bandpass"); } }
      else if (now - lastTick > 38) { lastTick = now; const f = 300 + (resolved / (cols * rows)) * 1500; tone(f, 0.02, "square", 0.009, f * 1.06, 0, 4800); }
    }
    return {
      draw, ready, get gone() { return gone; },
      finish() { gone = true; cv.remove(); front.style.removeProperty("--pxa"); },
    };
  }

  const PIX_ON = () => !window.KJ_FLIP_REVEAL;
  // ---- the energy ripple (Eman, 5 Nov 01:07): when the card lands, water-like rings start at the card
  // and run out over the whole screen, bending the program behind and glowing on top. KJ_NO_RIPPLE = true: off
  function rippleOut(o, cx, cy, col) {
    if (window.KJ_NO_RIPPLE || reduce()) return;
    const W = innerWidth, H = innerHeight, MW = 160, MH = Math.max(60, Math.round(160 * H / W));
    const NS = "http://www.w3.org/2000/svg";
    let svg = document.getElementById("kc-rip-svg");
    if (!svg) {
      svg = document.createElementNS(NS, "svg"); svg.id = "kc-rip-svg"; svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
      svg.style.cssText = "position:fixed;width:0;height:0;pointer-events:none";
      svg.innerHTML = '<filter id="kc-rip" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse">'
        + '<feImage result="m" preserveAspectRatio="none" x="0" y="0"/><feDisplacementMap in="SourceGraphic" in2="m" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
      document.body.append(svg);
    }
    const fi = svg.querySelector("feImage"), fd = svg.querySelector("feDisplacementMap"), f = svg.querySelector("filter");
    for (const e of [f, fi]) { e.setAttribute("width", W); e.setAttribute("height", H); }
    const map = document.createElement("canvas"); map.width = MW; map.height = MH;
    const mg = map.getContext("2d"), img = mg.createImageData(MW, MH);
    // the glow on top: a few soft rings in the card colour, purple and acid
    const cv = document.createElement("canvas"); cv.className = "kc-ripc"; cv.width = Math.round(W / 2); cv.height = Math.round(H / 2);
    o.append(cv);
    const g = cv.getContext("2d");
    const targets = [...document.body.children].filter((e) => e !== o && e !== svg && !e.classList.contains("kc-unlock") && getComputedStyle(e).display !== "none");
    targets.forEach((e) => { e.dataset.kcf = e.style.filter || ""; e.style.filter = "url(#kc-rip)"; });
    const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)), DUR = 1500, WAVES = [0, 190, 400];
    const t0 = performance.now();
    const step = (now) => {
      const t = now - t0;
      if (t > DUR + 420) {
        targets.forEach((e) => { e.style.filter = e.dataset.kcf; delete e.dataset.kcf; });
        cv.remove(); return;
      }
      const rs = WAVES.map((d, i) => { const x = Math.max(0, (t - d) / DUR); return { r: maxR * (1 - Math.pow(1 - Math.min(1, x), 2)) * 1.08, a: x <= 0 || x >= 1 ? 0 : (1 - x) * (i ? 0.6 : 1) }; });
      // the bend map (R = x push, G = y push), each ring pushes outward then back like water
      const d = img.data, sx = W / MW, sy = H / MH, wid = 70;
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const dx = x * sx - cx, dy = y * sy - cy, dist = Math.hypot(dx, dy) || 1;
        let w = 0;
        for (const q of rs) { if (!q.a) continue; const u = (dist - q.r) / wid; if (u > -3 && u < 3) w += Math.sin(u * 2.2) * Math.exp(-u * u) * q.a; }
        const k = (y * MW + x) * 4;
        d[k] = 128 + Math.max(-127, Math.min(127, w * 127 * dx / dist)); d[k + 1] = 128 + Math.max(-127, Math.min(127, w * 127 * dy / dist)); d[k + 2] = 128; d[k + 3] = 255;
      }
      mg.putImageData(img, 0, 0);
      fi.setAttribute("href", map.toDataURL()); fd.setAttribute("scale", String(64));
      g.clearRect(0, 0, cv.width, cv.height);
      g.save(); g.scale(0.5, 0.5); g.globalCompositeOperation = "lighter";
      // Eman, 5 Nov 01:41: just the bend, no coloured rings (KJ_RIPPLE_GLOW = true brings them back)
      if (window.KJ_RIPPLE_GLOW) rs.forEach((q, i) => {
        if (!q.a) return;
        const grad = g.createRadialGradient(cx, cy, Math.max(0, q.r - 60), cx, cy, q.r + 30);
        const c1 = i === 0 ? col : i === 1 ? "#9b6bff" : "#e4ff3a";
        grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(0.62, "rgba(0,0,0,0)");
        grad.addColorStop(0.8, c1); grad.addColorStop(0.86, "rgba(255,255,255,0.9)"); grad.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.3 * q.a; g.fillStyle = grad; g.fillRect(0, 0, W, H);
      });
      g.restore();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function cardReveal(name, k, card, quick) {
    const sh = sheetOf(name, k);
    // Eman, 4 Nov 17:52: "no box around the card, just the card and some small text below", no
    // sound buttons for now. The big HUD around the card is parked behind window.KJ_CARD_HUD = true.
    const min = !window.KJ_CARD_HUD, sounds = min ? [] : sh.sounds;
    // Eman, 4 Nov 23:27: the card sits in a clear graded-card case with a label (KJ_NO_CASE = true: the bare card)
    const CASE = !window.KJ_NO_CASE, serial = String(Math.floor(10000000 + Math.random() * 89999999));
    const o = document.createElement("div"); o.className = "kc-unlock" + (min ? " kc-min" : "") + (CASE ? " kc-cased" : ""); o.style.setProperty("--kc", k.col);
    const labelHtml = `<div class="kc-label"><div class="kc-lt"><span>KILLTOY 2 &middot; ${esc(k.type)}</span><b class="kc-lname">${esc(name.replace(/./g, (ch) => (ch === " " ? " " : "?")))}</b><span>${esc(k.rare)}</span><i class="kc-bars"></i></div>
                <i class="kc-qr${window.KJ_QR ? " old" : ""}"></i><div class="kc-lr"><span>${k.rare === "LEGENDARY" ? "GEM MT" : "MINT"}</span><b>10</b><span>${esc(serial)}</span></div></div>`;
    // the back's label (Eman, 5 Nov 01:46): a caution / info sticker with numbers and small icons
    const bIco = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${d}</svg>`;
    const lot = String(serial).slice(0, 4), wt = (14 + (+serial % 60) / 10).toFixed(1);
    const backLabelHtml = `<div class="kc-label kc-blabel"><div class="kc-bwarn">${bIco('<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18v.5"/>')}</div>
                <div class="kc-lt"><b>CAUTION</b><span>LOUD SOUND</span><span>DO NOT OPEN</span><span>LOT ${lot}-26</span></div>
                <div class="kc-bicons">${bIco('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>')}${bIco('<path d="M7 7h10v10H7z"/><path d="M3 12h4M17 12h4M12 3v4M12 17v4"/>')}${bIco('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>')}${bIco('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>')}</div>
                <div class="kc-lr"><span>${wt} G</span><b>18+</b><span>No.${esc(serial.slice(-4))}</span></div></div>`;
    const slices = Array.from({ length: 6 }, (_, i) => `<i class="kc-slice" style="--z:${-(i + 1)}px"></i>`).join("");
    const T = (s, c) => `<span class="kc-type ${c || ""}" data-t="${esc(s)}"></span>`;   // text that types itself out
    const L = (c, d) => `<i class="kc-ln ${c || ""}" style="--d:${d || 0}"></i>`;   // a HUD line that draws itself
    const pips = (n) => `<span class="kc-pips">${"<i></i>".repeat(n)}</span>`;
    o.innerHTML = `
      <div class="kc-hud">
        <div class="kc-head">${L("h", 0)}
          <span class="kc-no">${esc(sh.no)}</span>${T(k.rare, "kc-rare")}<b class="kc-nm"></b>${T("NEW " + k.type + " UNLOCKED", "kc-new")}
          <span class="kc-pwr"><em>PWR</em><b data-n="${sh.pwr}">0</b></span>
        </div>
        <div class="kc-side kc-left">
          <div class="kc-h">${T("SKILLS")}${L("", 1)}</div>
          ${sh.skills.map((s, i) => `<button class="kc-skill" data-i="${i}" style="--i:${i}"><span class="kc-ic">${ICONS[s.icon] || ""}</span>${T(s.name)}${pips(s.cost)}<b>${esc(s.val)}</b></button>`).join("")}
        </div>
        <div class="kc-stage">
          <div class="kc-frame">${L("c tl", 2)}${L("c tr", 2)}${L("c bl", 2)}${L("c br", 2)}${L("x", 3)}</div>
          <div class="kc-scene"><div class="kc-glow"></div><div class="kc-ring"></div><div class="kc-shadow"></div><div class="kc-card">
            ${CASE ? `<div class="kc-face kc-front kc-slab">
              ${labelHtml}
              <div class="kc-well"><div class="kc-pic"><img src="${esc(card)}" alt="" draggable="false"><canvas class="kc-px"></canvas></div></div>
              <i class="kc-acr"></i><i class="kc-holo"></i><i class="kc-shine"></i><i class="kc-gleam"></i></div>`
            : `<div class="kc-face kc-front"><img src="${esc(card)}" alt="" draggable="false"><i class="kc-holo"></i><i class="kc-shine"></i><canvas class="kc-px"></canvas></div>`}
            ${slices}
            ${CASE && BACKS[name] ? `<div class="kc-face kc-back kc-slab kc-bpic">${window.KJ_SAME_BACK_LABEL ? labelHtml : backLabelHtml}<div class="kc-well"><div class="kc-pic"><img src="${esc(BACKS[name])}" alt="" draggable="false">${BACK3 && window.KJ_BACK_LOGO ? '<i class="kc-blogo"></i>' : ""}</div></div><i class="kc-acr"></i><i class="kc-bglass"></i></div>`
            : `<div class="kc-face kc-back${window.KJ_OLD_BACK ? " old" : ""}"><i class="kc-holo"></i><img src="logo.png" alt="KILLTOY" draggable="false">${CASE ? `<i class="kc-acr"></i><i class="kc-bglass"></i>` : ""}</div>`}
          </div></div>
          <span class="kc-tagbox">${esc(sh.no.replace(/\D/g, "") || "001")}</span>
        </div>
        <div class="kc-side kc-right">
          <div class="kc-h">${T("STATS")}${L("", 1)}</div>
          ${k.stats.map(([s, n], i) => `<button class="kc-stat" data-s="${esc(s)}" style="--n:${n}"><span class="kc-ic">${ICONS[sh.icons[i]] || ""}</span>${T(s)}<span class="kc-meter">${"<i></i>".repeat(10)}</span><b data-n="${n * 10}">0</b></button>`).join("")}
          <div class="kc-vars">${sh.vars.map(([a, b]) => `<div class="kc-var">${T(a)}<i></i><b data-n="${b}">0</b></div>`).join("")}</div>
          <div class="kc-info" hidden><div class="kc-info-h"><span class="kc-ic"></span><b></b><button class="kc-x">${IC('<path d="M5 5l14 14M19 5L5 19"/>')}</button></div><p></p></div>
        </div>
        ${sounds.length ? `<div class="kc-sounds"><div class="kc-h">${T("SOUNDS")}${L("", 1)}</div><div class="kc-sgrid">
          ${sounds.map((g, gi) => `<div class="kc-sgroup"><div class="kc-skind"><span class="kc-ic">${ICONS[g.icon]}</span>${T(g.kind)}</div>
            ${g.list.map((s, si) => `<button class="kc-snd" data-g="${gi}" data-s="${si}"><span class="kc-pl">${ICONS.play}</span><span class="kc-sn">${esc(s.name)}</span>${rollSvg(MELODIES[s.mel] || [])}<i class="kc-prog"></i></button>`).join("")}</div>`).join("")}
        </div></div>` : ""}
        <div class="kc-foot">${L("h", 4)}<button class="kc-go"><kbd>ENTER</kbd> TRY NOW</button></div>
      </div>
      <div class="kc-flash"></div>`;
    o.querySelector(".kc-nm").textContent = name;
    if (quick || !PIX_ON()) o.querySelectorAll(".kc-lname").forEach((ln) => { ln.textContent = name; });
    document.body.append(o);
    const el = (c) => o.querySelector(c);
    const cardEl = el(".kc-card"), glow = el(".kc-glow"), ring = el(".kc-ring"), shadow = el(".kc-shadow"), flash = el(".kc-flash"), go = el(".kc-go");
    const holos = [...o.querySelectorAll(".kc-holo")], shine = el(".kc-shine"), bglass = el(".kc-bglass"), info = el(".kc-info");
    let raf = 0, done = false;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => { if (!done) fn(); }, ms));
    const close = () => {
      if (done) return; done = true;
      cancelAnimationFrame(raf); removeEventListener("keydown", keyClose, true);
      timers.forEach(clearTimeout); stopDemo(true);
      S.button(880, true);
      o.classList.add("out"); setTimeout(() => { o.remove(); revealing = false; }, 280);
    };
    go.onclick = close;
    const keyClose = (e) => { if (e.key === "Escape" || e.key === "Enter") { e.stopPropagation(); e.preventDefault(); close(); } };
    addEventListener("keydown", keyClose, true);

    // ---- the HUD boot: lines, typing, meters, counters ----
    const typeOut = (node, delay, speed) => {
      const s = node.dataset.t || "";
      if (quick) { node.textContent = s; return; }
      later(() => {
        node.classList.add("on");
        let i = 0;
        const step = () => {
          if (done) return;
          i++; node.textContent = s.slice(0, i) + (i < s.length ? "_" : "");
          if (i % 3 === 1) tone(1800 + Math.random() * 600, 0.008, "square", 0.004, null, 0, 5000);
          if (i < s.length) timers.push(setTimeout(step, speed || 22));
        };
        step();
      }, delay);
    };
    const countUp = (b, delay, dur) => {
      const v = b.dataset.n, n = parseFloat(v);
      if (quick || !isFinite(n)) { later(() => { b.textContent = v; }, quick ? 0 : delay); return; }
      later(() => {
        const t0 = performance.now();
        const f = () => { if (done) return; const x = Math.min(1, (performance.now() - t0) / dur); b.textContent = String(Math.round(n * (1 - Math.pow(1 - x, 3)))); if (x < 1) requestAnimationFrame(f); };
        f();
      }, delay);
    };
    function boot() {
      o.classList.add("hud");
      if (quick) { o.classList.add("hud-done"); }
      // the frame lines draw in (CSS, each by its --d), then the text types, row by row
      o.querySelectorAll(".kc-head .kc-type").forEach((n, i) => typeOut(n, 120 + i * 140, 18));
      countUp(el(".kc-pwr b"), 200, 900);
      o.querySelectorAll(".kc-h .kc-type").forEach((n, i) => typeOut(n, 260 + i * 120, 30));
      o.querySelectorAll(".kc-skill").forEach((b, i) => {
        later(() => { b.classList.add("on"); tone(520 + i * 40, 0.03, "triangle", 0.012, null, 0, 3000); }, 380 + i * 120);
        typeOut(b.querySelector(".kc-type"), 400 + i * 120, 16);
      });
      // the meters fill up, one tick per segment, rising
      o.querySelectorAll(".kc-stat").forEach((b, j) => {
        const n = +b.style.getPropertyValue("--n"), segs = [...b.querySelectorAll(".kc-meter i")];
        later(() => b.classList.add("on"), 420 + j * 160);
        typeOut(b.querySelector(".kc-type"), 440 + j * 160, 20);
        segs.forEach((seg, i) => {
          if (i >= n) return;
          if (quick) { seg.classList.add("on"); return; }
          later(() => { seg.classList.add("on"); if (i % 2 === 0) tone(600 + i * 70 + j * 35, 0.03, "triangle", 0.012, null, 0, 3200); }, 700 + j * 160 + i * 45);
        });
        countUp(b.querySelector("b"), 700 + j * 160, n * 45 + 120);
      });
      o.querySelectorAll(".kc-var").forEach((v, i) => {
        later(() => v.classList.add("on"), 1250 + i * 110);
        typeOut(v.querySelector(".kc-type"), 1260 + i * 110, 18);
        countUp(v.querySelector("b"), 1300 + i * 110, 700);
      });
      o.querySelectorAll(".kc-sgroup").forEach((g, i) => {
        later(() => g.classList.add("on"), 1500 + i * 120);
        typeOut(g.querySelector(".kc-type"), 1500 + i * 120, 24);
      });
      later(() => { o.classList.add("hud-done"); go.focus({ preventScroll: true }); if (!quick) mallet(1319, 0.03); }, quick ? 0 : 2300);
    }

    // ---- motion: pop, suspense, flip, LAND, then a gentle rock that always shows the front ----
    // Eman, 4 Nov 23:19: no flip and no white card. The front stays hidden under a churning mosaic of
    // pixel glyphs, which resolves block by block into the picture. The old flip: KJ_FLIP_REVEAL = true
    const PIX = !window.KJ_FLIP_REVEAL;
    const POP = 650, WAIT = PIX ? 1250 : 1700, FLIP = PIX ? (window.KJ_FADE_REVEAL ? 1350 : 700) : 950, LAND = PIX ? 260 : 520;
    const T_FLIP = POP + WAIT, T_LAND = T_FLIP + FLIP, T_IDLE = T_LAND + LAND;
    const ease = (x) => 1 - Math.pow(1 - x, 3), back = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
    let offY = 0, offX = 0, velY = 0, velX = 0, drag = null, t0 = performance.now(), last = t0, landed = quick, idleAt = null, pulse = 0;
    const draw = (rx, ry, sc, y, jx) => {
      cardEl.style.transform = `translate(${jx}px, ${y}px) scale(${sc}) rotateX(${rx}deg) rotateY(${ry}deg)`;
      const a = ((ry % 360) + 360) % 360, face = Math.abs(Math.cos(ry * Math.PI / 180));
      holos.forEach((h) => { h.style.backgroundPosition = (50 + ry * 2.2) + "% 50%"; h.style.opacity = String(0.14 + (1 - face) * 0.6 + pulse * 0.25); });
      // the angle folded to -90..90 so the light slides smoothly while it rocks around face-on; it only
      // wraps when the card is edge-on, where you can't see it (Eman, 5 Nov 01:47: it used to jump at 0)
      const w = ((((ry + 90) % 180) + 180) % 180) - 90;
      shine.style.backgroundPosition = (50 - w / 90 * 120 + rx * 4) + "% 0";
      if (bglass) bglass.style.backgroundPosition = (50 + w / 90 * 120 - rx * 4) + "% 0";   // the back's glass catches the light as it turns
      shadow.style.transform = `translateX(-50%) scaleX(${0.25 + face * 0.75 * sc})`;
    };
    // the reveal lands hard: a punch, the whole screen jolts, a white hit, pixel debris, a boom
    // and a crack, then a streak of light sweeps over the case (Eman, 4 Nov 23:27)
    const impact = () => {
      const hud = el(".kc-hud");
      o.querySelectorAll(".kc-lname").forEach((ln) => { ln.textContent = name; });
      cardEl.animate([{ scale: "1.14" }, { scale: "0.95" }, { scale: "1.02" }, { scale: "1" }], { duration: 520, easing: "cubic-bezier(.2,.9,.3,1)", composite: "add" });
      if (hud && !reduce()) hud.animate([{ translate: "0 0" }, { translate: "-9px 6px" }, { translate: "7px -5px" }, { translate: "-4px 3px" }, { translate: "2px -1px" }, { translate: "0 0" }], { duration: 360, easing: "ease-out" });
      flash.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 460, easing: "ease-out" });
      // the thin rectangle that grew out of the card is gone: the ripple does that job now (Eman, 5 Nov 01:07)
      if (window.KJ_NO_RIPPLE) ring.animate([{ opacity: 1, transform: "translate(-50%, -50%) scale(0.9)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.7)" }], { duration: 760, easing: "cubic-bezier(.15,.85,.2,1)" });
      const r = cardEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      rippleOut(o, cx, cy, k.col || "#9b6bff");
      if (!reduce()) for (let i = 0; i < 26; i++) {
        const d = document.createElement("i"); d.className = "kc-bit"; d.style.left = cx + (Math.random() - 0.5) * r.width * 0.8 + "px"; d.style.top = cy + (Math.random() - 0.5) * r.height * 0.8 + "px";
        d.style.background = ["#e4ff3a", "#9b6bff", "#ff3b5c", "#f4f0ff"][i % 4]; o.append(d);
        const a = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 180;
        d.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px) scale(0.2)`, opacity: 0 }], { duration: 520 + Math.random() * 400, easing: "cubic-bezier(.1,.8,.3,1)" }).onfinish = () => d.remove();
      }
      const gl = el(".kc-gleam");
      if (gl) gl.animate([{ backgroundPosition: "160% 0", opacity: 0 }, { opacity: 1, offset: 0.15 }, { backgroundPosition: "-60% 0", opacity: 0 }], { duration: 1100, delay: 120, easing: "cubic-bezier(.3,.1,.2,1)" });
      // the sweep fades out at the end, and the resting light then fades in slowly where the card is,
      // instead of popping in at full strength (Eman, 5 Nov 16:33). KJ_SHINE_POP brings back the pop.
      if (shine && window.KJ_SHINE_POP) shine.animate([{ backgroundPosition: "160% 0" }, { backgroundPosition: "-60% 0" }], { duration: 900, delay: 200, easing: "ease-in-out" });
      else if (shine) {
        shine.style.transition = "none"; shine.style.opacity = "0";
        shine.animate([{ backgroundPosition: "160% 0", opacity: 1 }, { backgroundPosition: "20% 0", opacity: 1, offset: 0.6 }, { backgroundPosition: "-60% 0", opacity: 0 }], { duration: 900, delay: 200, easing: "ease-in-out" });
        later(() => { shine.style.transition = "opacity 2200ms cubic-bezier(.45,0,.25,1)"; shine.style.opacity = "1"; }, 1250);
      }
      tone(46, 0.9, "sine", 0.22, 28, 0, 200); tone(92, 0.25, "triangle", 0.08, 50, 0, 600);
      noise(0.16, 0.09, 2600, "bandpass", 0); noise(0.5, 0.04, 600, "lowpass", 0.01);
      tone(2400, 0.35, "triangle", 0.025, 2100, 0.05, 9000); mallet(1976, 0.03, 0.16, 7000); noise(0.4, 0.02, 7000, "highpass", 0.18);
    };
    const land = () => {
      landed = true; o.classList.add("live");
      if (PIX && !quick) { boot(); return; }   // the pixel reveal already hit
      // a hard soft landing: a squash, a thin shock ring, a quiet thud (no rays)
      flash.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 380, easing: "ease-out" });
      ring.animate([{ opacity: 0.9, transform: "translate(-50%, -50%) scale(0.92)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.45)" }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" });
      cardEl.animate([{ filter: "brightness(1.8)" }, { filter: "brightness(1)" }], { duration: 420, easing: "ease-out" });
      tone(55, 0.5, "sine", 0.11, 38, 0, 240); noise(0.18, 0.03, 900, "lowpass", 0);
      boot();
    };
    const px = PIX && !quick ? (CASE ? pixelReveal(el(".kc-pic"), el(".kc-pic img"), k.col) : pixelReveal(el(".kc-front"), el(".kc-front img"), k.col)) : null;
    if (px) o.classList.add("kc-pixing");
    if (quick) { draw(0, 0, 1, 0, 0); land(); idleAt = performance.now(); }
    else if (px) {
      tone(70, 0.5, "sine", 0.12, 45, 0, 300); noise(0.3, 0.025, 500, "lowpass", 0);
      tone(110, (WAIT + 300) / 1000, "square", 0.008, 880, POP / 1000, 1400);   // a rising data whine under the scramble
      if (!window.KJ_NO_SPIN) [0.12, 0.42, 0.85, 1.45].forEach((d, i) => noise(0.22 + i * 0.06, 0.03 - i * 0.005, 1400 - i * 250, "bandpass", d));   // a whoosh per turn, slowing down
      later(() => { S.chime(); }, T_LAND + 40);
    } else {
      tone(70, 0.5, "sine", 0.12, 45, 0, 300); noise(0.3, 0.025, 500, "lowpass", 0);
      tone(90, (WAIT + 300) / 1000, "sawtooth", 0.02, 760, POP / 1000, 700);
      noise(0.5, 0.02, 3000, "highpass", (T_FLIP - 150) / 1000);
      later(() => { S.chime(); }, T_LAND - 220);
    }
    const frame = (now) => {
      const t = now - t0, dt = Math.min(50, now - last) / 1000; last = now;
      pulse *= Math.exp(-dt * 7);
      if (px && !quick && t < T_IDLE) {
        // front-facing all the way: it rises, hovers and shakes while the mosaic churns, then settles as it resolves
        let tt = t;
        if (t >= T_FLIP && !px.ready()) { t0 += now - (t0 + t) + Math.min(50, dt * 1000); tt = T_FLIP - 1; }   // the picture isn't in yet: keep scrambling
        // Eman, 4 Nov 23:35: it spins around as it comes up, two turns that slow down and stop face-on
        // right before the reveal (KJ_NO_SPIN = true: no spin)
        const spin = window.KJ_NO_SPIN ? 0 : -720 * Math.pow(1 - Math.min(1, tt / (T_FLIP - 120)), 2);
        if (tt < POP) {
          const x = tt / POP;
          draw(14 * (1 - x), -10 * (1 - ease(x)) + spin, 0.4 + 0.6 * back(x), 140 * (1 - ease(x)), 0);
          glow.style.opacity = String(0.25 * x);
          px.draw(tt, 0, 0.25 + 0.4 * x);
        } else if (tt < T_FLIP) {
          const x = (tt - POP) / WAIT, s2 = Math.pow(x, 2.2);
          draw(Math.sin(tt / 90) * 3 * s2, Math.sin(tt / 60) * 4 * s2 + spin, 1 + 0.04 * x, Math.sin(tt / 400) * 5 - 10 * x, (Math.random() - 0.5) * 7 * s2);
          glow.style.opacity = String(0.25 + 0.55 * x); glow.style.transform = `translate(-50%, -50%) scale(${0.8 + 0.4 * x})`;
          cardEl.style.setProperty("--edge", String(x));
          px.draw(tt, 0, 0.65 + 0.35 * x);
        } else {
          const x = Math.min(1, (tt - T_FLIP) / (FLIP + LAND)), e = ease(x), calm = 1 - e;
          draw(Math.sin(tt / 90) * 2 * calm * calm, Math.sin(tt / 60) * 3 * calm * calm, 1 + 0.04 * calm + 0.03 * Math.sin(x * Math.PI), -10 * calm, (Math.random() - 0.5) * 4 * calm * calm);
          cardEl.style.setProperty("--edge", String(0.15 + 0.85 * calm));
          px.draw(tt, Math.min(1, (tt - T_FLIP) / FLIP), 1);
        }
        raf = requestAnimationFrame(frame);
        return;
      }
      if (px && !px.gone) { px.finish(); o.classList.remove("kc-pixing"); impact(); glow.animate([{ opacity: getComputedStyle(glow).opacity }, { opacity: 0.3 }], { duration: 600, fill: "forwards" }); offY = 0; }
      if (quick || t >= T_IDLE) {
        if (!landed) land();
        if (idleAt == null) idleAt = now;
        // grabbed: it follows the hand; let go: it keeps turning a little, then springs back to its front
        if (!drag) {
          const tgt = Math.round(offY / 360) * 360;
          velY += ((tgt - offY) * 16 - velY * 4.2) * dt; offY += velY * dt;
          velX += ((0 - offX) * 22 - velX * 6) * dt; offX += velX * dt;
        }
        const w = Math.min(1, (now - idleAt) / 1200), tt = now - idleAt;   // the rock fades in after landing
        const ry = offY + Math.sin(tt / 1500) * 10 * w, rx = offX + Math.sin(tt / 2100 + 1) * 3.5 * w;
        draw(rx, ry, 1 + pulse * 0.015, Math.sin(tt / 1100) * 4 * w, 0);
      } else if (t < POP) {
        const x = t / POP;
        draw(14 * (1 - x), 180 - 25 * (1 - ease(x)), 0.4 + 0.6 * back(x), 140 * (1 - ease(x)), 0);
        glow.style.opacity = String(0.25 * x);
      } else if (t < T_FLIP) {
        // suspense: it hovers and shakes harder and harder, the glow behind it swells
        const x = (t - POP) / WAIT, s2 = Math.pow(x, 2.2);
        draw(Math.sin(t / 90) * 3 * s2, 180 + Math.sin(t / 60) * 4 * s2, 1 + 0.04 * x, Math.sin(t / 400) * 5 - 10 * x, (Math.random() - 0.5) * 7 * s2);
        glow.style.opacity = String(0.25 + 0.55 * x); glow.style.transform = `translate(-50%, -50%) scale(${0.8 + 0.4 * x})`;
        cardEl.style.setProperty("--edge", String(x));
      } else if (t < T_LAND) {
        // the flip: one and a half turns while it lifts toward you
        const x = (t - T_FLIP) / FLIP, e = ease(x);
        draw(-6 * Math.sin(x * Math.PI), 180 + 540 * e, 1 + 0.16 * Math.sin(x * Math.PI * 0.5), -34 * Math.sin(x * Math.PI * 0.5), 0);
      } else {
        // the landing: it drops the last bit onto the table (fast), squashes and settles
        const x = (t - T_LAND) / LAND, fall = Math.max(0, 1 - x / 0.3);
        if (!landed && x >= 0.3) { land(); glow.animate([{ opacity: getComputedStyle(glow).opacity }, { opacity: 0.3 }], { duration: 600, fill: "forwards" }); cardEl.style.setProperty("--edge", "0.15"); }
        const after = Math.max(0, (x - 0.3) / 0.7), wob = -0.035 * Math.sin(after * Math.PI * 2.5) * (1 - after);
        draw(3 * Math.sin(after * Math.PI * 3) * (1 - after), 720, 1 + 0.16 * fall * fall + wob, -34 * fall * fall, 0);
        offY = 720; velY = 0;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ---- hands: drag the card, tap skills / stats / sounds ----
    let moved = 0;
    o.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      if (e.target.closest(".kc-card") || e.target.closest(".kc-scene")) {
        if (!landed) return;
        drag = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; o.setPointerCapture(e.pointerId); o.classList.add("grab");
        return;
      }
      // Eman, 4 Nov 20:23: the frosted app stays until you press TRY NOW (no click-away)
    });
    o.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const now = performance.now(), dx = e.clientX - drag.x, dy = e.clientY - drag.y, dts = Math.max(0.008, (now - drag.t) / 1000);
      moved += Math.abs(dx) + Math.abs(dy);
      offY += dx * 0.6; offX = Math.max(-40, Math.min(40, offX - dy * 0.35));
      velY = (dx * 0.6) / dts; velX = (-dy * 0.35) / dts;
      drag = { x: e.clientX, y: e.clientY, t: now };
    });
    const up = () => { if (!drag) return; drag = null; o.classList.remove("grab"); velY = Math.max(-1100, Math.min(1100, velY)); velX = Math.max(-200, Math.min(200, velX)); if (moved > 30) tone(300, 0.05, "sine", 0.02, 420, 0, 1600); };
    o.addEventListener("pointerup", up); o.addEventListener("pointercancel", up);

    const showInfo = (icon, title, text, src) => {
      o.querySelectorAll(".kc-skill.sel, .kc-stat.sel").forEach((b) => b.classList.remove("sel"));
      if (src) src.classList.add("sel");
      info.hidden = false; o.classList.add("info");
      info.querySelector(".kc-ic").innerHTML = icon || "";
      const h = info.querySelector("b"), p = info.querySelector("p");
      h.dataset.t = title; p.dataset.t = text; h.textContent = ""; p.textContent = "";
      info.animate([{ opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0 0 0)" }], { duration: 260, easing: "cubic-bezier(.2,.9,.2,1)" });
      typeOut(h, 0, 20); typeOut(p, 160, 9);
      tone(880, 0.05, "triangle", 0.02, null, 0, 3600); tone(1320, 0.06, "triangle", 0.014, null, 0.045, 3600);
    };
    info.querySelector(".kc-x").onclick = () => { info.hidden = true; o.classList.remove("info"); o.querySelectorAll(".sel").forEach((b) => b.classList.remove("sel")); S.close(); };
    o.querySelectorAll(".kc-skill").forEach((b) => b.onclick = () => {
      const s = sh.skills[+b.dataset.i];
      showInfo(ICONS[s.icon], s.name + "  /  COST " + s.cost, s.info, b);
    });
    o.querySelectorAll(".kc-stat").forEach((b, i) => b.onclick = () => {
      const s = b.dataset.s;
      showInfo(ICONS[sh.icons[i]], s + "  /  " + (+b.style.getPropertyValue("--n") * 10), (sh.statInfo || {})[s] || "", b);
    });
    o.querySelectorAll(".kc-snd").forEach((b) => b.onclick = () => {
      const s = sh.sounds[+b.dataset.g].list[+b.dataset.s];
      if (b.classList.contains("play") || b.classList.contains("load")) { stopDemo(true); return; }
      o.querySelectorAll(".kc-snd").forEach((x) => x.classList.remove("play", "load"));
      b.classList.add("load"); b.querySelector(".kc-pl").innerHTML = ICONS.stop;
      const segs = [...b.querySelectorAll(".kc-roll path:not(.sl)")], prog = b.querySelector(".kc-prog");
      playDemo(s, (i) => {
        const seg = segs[i]; if (seg) { seg.classList.add("hit"); setTimeout(() => seg.classList.remove("hit"), 220); }
        pulse = Math.min(1, pulse + 0.5);
      }, () => {
        b.classList.remove("play", "load"); b.querySelector(".kc-pl").innerHTML = ICONS.play;
        prog.getAnimations().forEach((a) => a.cancel());
      }, (secs) => {
        b.classList.remove("load"); b.classList.add("play");
        prog.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: secs * 1000 + 120, easing: "linear", fill: "forwards" });
      });
    });
  }
  function wrapOpen() {
    if (typeof openLaneWindow !== "function" || openLaneWindow._juice) return;
    const _open = openLaneWindow;
    const wrapped = function (a) {
      const wasOpen = !document.getElementById("iw") || !document.getElementById("iw").hidden;
      const r = _open.apply(this, arguments);
      try {
        const t = a && a.t, c = a && a.clip, inst = (l) => (l || []).find((x) => x.instrument);
        const p = (t && inst(t.plugins)) || (c && inst(c.plugins)) || (t && (t.clips || []).map((x) => inst(x.plugins)).find(Boolean));
        let name = (p && p.name) || (t && typeof t.instrument === "string" ? t.instrument : null);
        if (!name && t && typeof isKillDrumLane === "function" && isKillDrumLane(t)) name = "KILLDRUM";
        if (!name && t && typeof isToyMachineLane === "function" && isToyMachineLane(t)) name = "TOY MACHINE";
        if (name && /toy ?machine/i.test(name)) name = "TOY MACHINE";
        if (name && /toy ?keys/i.test(name)) name = "TOY KEYS";
        if (name && (ALWAYS.has(name) || !seen().includes(name))) setTimeout(() => unlock(name), wasOpen ? 60 : 320);
      } catch (e) { /* never block opening */ }
      return r;
    };
    wrapped._juice = true;
    window.openLaneWindow = openLaneWindow = wrapped;   // eslint-disable-line no-global-assign
  }

  // ---- windows pop open (synths, plugins): a springy scale-in and a bloop -------------------
  function watchWindows() {
    const ids = ["iw", "plugwin"];
    const pop1 = (el) => {
      const box = el.querySelector(".iw-box, .plugwin-box, .iw-win, .win") || el.firstElementChild || el;
      if (!reduce() && box.animate) box.animate([
        { scale: "0.9", opacity: 0, translate: "0 14px" },
        { scale: "1.015", opacity: 1, translate: "0 0", offset: 0.6 },
        { scale: "1" }], { duration: 280, easing: "cubic-bezier(.2,.9,.3,1)" });
      S.open();
    };
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target;
        if (!ids.includes(el.id)) continue;
        const nowOpen = !el.hidden;
        if (nowOpen && m.oldValue !== null) pop1(el);
        else if (!nowOpen && m.oldValue === null) S.close();
      }
    });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true }); });
  }

  // ---- buttons and the mouse ----------------------------------------------------------------
  // each button gets its own note from its name, so the same button always sounds the same
  const noteOf = (b) => {
    const k = b.id || b.getAttribute("aria-label") || b.title || (b.textContent || "").trim().slice(0, 24) || b.className;
    let h = 7; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    const inTop = !!b.closest("header.top, .top");
    return PENTA[(h % 7) + (inTop ? 4 : 2)];
  };
  const locked = (b) => b.disabled || b.getAttribute("aria-disabled") === "true" || b.classList.contains("locked") || b.classList.contains("disabled");
  let downBtn = null;
  addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const b = e.target.closest && e.target.closest("button, .k2h-open, .k2h-play, [role=button], select, .seg > *");
    if (!b) { S.mouse(); return; }
    if (locked(b)) { S.nope(); shake(b, 3); return; }
    if (b.tagName === "SELECT") { S.mouse(); return; }
    const was = b.getAttribute("aria-pressed") === "true" || b.classList.contains("on") || b.classList.contains("active");
    downBtn = { b, was };
    S.button(noteOf(b));
  }, true);
  addEventListener("pointerup", () => {
    if (!downBtn) return;
    const { b, was } = downBtn; downBtn = null;
    // a toggle that flipped answers with its interval (up = on, down = off)
    setTimeout(() => {
      const now = b.getAttribute("aria-pressed") === "true" || b.classList.contains("on") || b.classList.contains("active");
      if (now !== was) tone(noteOf(b) * (now ? 1.5 : 0.75), 0.06, "triangle", 0.016, null, 0, 3600);
      else S.release();
    }, 30);
  }, true);
  // a message that means "can't do that" gets the nope sound and a little shake
  function wrapToast() {
    if (typeof toast !== "function" || toast._juice) return;
    const _t = toast;
    const NO = /^(select|pick|choose|no |nothing|can't|cannot|needs?|already|only|first|that clip isn't|not )|can't|isn't there|doesn't work|not possible|locked/i;
    const w = function (msg, isError) {
      const r = _t.apply(this, arguments);
      try { if (isError || NO.test(String(msg))) { S.nope(); shake(document.getElementById("toast"), 4); } } catch (e) { /* fine */ }
      return r;
    };
    w._juice = true;
    window.toast = toast = w;   // eslint-disable-line no-global-assign
  }

  // ---- while playing: the clips under the marker breathe on the beat ------------------------
  // On every beat each clip the marker is on gets a short swell, as big as the sound is loud right
  // there (audio: its real loudness from the waveform; MIDI: how many notes and how hard), plus a
  // little extra when the bass hits. Bars hit harder. MIDI notes flick as the marker reaches them.
  let an = null, abuf = null;
  function bassNow() {
    const d = window.purpPlaygroundDebug;
    if (!an && d && d.ctx && d.masterOut) { an = d.ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.3; d.masterOut.connect(an); abuf = new Uint8Array(an.frequencyBinCount); }
    if (!an) return 0;
    an.getByteFrequencyData(abuf);
    const hz = an.context.sampleRate / an.fftSize, top = Math.max(2, Math.round(140 / hz));
    let s = 0; for (let i = 1; i <= top; i++) s += abuf[i];
    return Math.min(1, Math.pow(s / top / 255, 1.6) * 1.4);
  }
  // what you hear lags what's scheduled by the output latency: line the beat up with the ear
  function heardPos() {
    const t = ui.transport, d = window.purpPlaygroundDebug, now = performance.now();
    if (!t) return 0;
    if (!heardPos.s || heardPos.s.pos !== t.position) heardPos.s = { pos: t.position, at: now };
    const lat = d && d.ctx ? (d.ctx.outputLatency || 0) + (d.ctx.baseLatency || 0) : 0;
    return t.position + Math.min(0.12, (now - heardPos.s.at) / 1000) - lat;
  }
  function loudAt(c, sec) {   // 0..1, relative to the clip's own loudest moment
    if (c.kind === "midi") {
      const spb = 60 / (ui.state.bpm || 120), b = (sec - c.start) / spb;
      const on = (c.notes || []).filter((n) => !n.muted && b >= n.start - 0.05 && b < n.start + n.length);
      return Math.min(1, on.reduce((a, n) => a + (n.velocity || 100) / 127, 0) / 3);
    }
    if (!ui.peaks) return 0.5;
    let data = null;
    for (const [k, v] of ui.peaks) if (k.startsWith(c.id + ":") && v && (v.rms || v.peak)) { data = v; break; }
    const arr = data && (data.rms || data.peak);
    if (!arr || !arr.length) return 0.5;
    if (!data._max) { let m = 1e-6; for (const x of arr) m = Math.max(m, x); data._max = m; }
    const i = Math.floor(((sec - c.start) / Math.max(1e-6, c.length)) * arr.length), w = Math.max(1, Math.round(arr.length * 0.01));
    let s = 0, n = 0; for (let j = Math.max(0, i - w); j <= Math.min(arr.length - 1, i + w); j++) { s += arr[j]; n++; }
    return Math.min(1, (s / Math.max(1, n)) / data._max);
  }
  function clipsAt(sec) {
    const out = [];
    for (const t of (ui.state && ui.state.tracks) || []) { if (t.muted) continue; for (const c of t.clips || []) if (c.active !== false && sec >= c.start && sec < c.start + c.length) out.push(c); }   // muted clips stay dark (Eman, 4 Nov)
    return out;
  }
  // the old on-beat swell (whole clip pumps, a tick, the star bumps): parked (Eman, 4 Nov: "it blinks,
  // dun dun dun, not satisfying"); window.KJ_BEAT_SWELL = true brings it back
  function beatHit(sec, beat) {
    if (reduce() || !window.KJ_BEAT_SWELL) return;
    const bar = beat % 4 === 0, bass = bassNow();
    for (const c of clipsAt(sec)) {
      const el = clipEl(c.id);
      if (!el || !el.offsetParent) continue;
      const lv = loudAt(c, sec);
      if (lv < 0.08) continue;
      const amt = Math.min(1, lv * (bar ? 1 : 0.7) + bass * 0.35);
      const art = el.querySelector("canvas") || el;
      art.animate([{ scale: `1 ${1 + 0.16 * amt}`, filter: `brightness(${1 + 0.45 * amt})` }, { scale: "1 1", filter: "none" }], { duration: bar ? 260 : 190, easing: "cubic-bezier(.1,.7,.3,1)" });
      // a short bright tick at the marker inside the clip, as tall as it is loud
      const ph = document.getElementById("playhead"), r = el.getBoundingClientRect();
      if (ph) {
        const x = ph.getBoundingClientRect().left - r.left;
        if (x > 1 && x < r.width - 1) {
          const k = document.createElement("i"); k.className = "kj-beat";
          const h = Math.max(4, (r.height - 18) * (0.25 + 0.75 * lv));
          Object.assign(k.style, { left: x + "px", height: h + "px", top: 17 + (r.height - 17 - h) / 2 + "px" });
          el.append(k);
          k.animate([{ opacity: 0.95, scale: "1 1" }, { opacity: 0, scale: "6 0.6" }], { duration: bar ? 300 : 220, easing: "ease-out" }).onfinish = () => k.remove();
        }
      }
    }
    if (bar) { const star = document.querySelector("#playhead .k2-star"); if (star) star.animate([{ scale: "1.35" }, { scale: "1" }], { duration: 220, easing: "ease-out" }); }
  }
  // MIDI clips in the arrangement: each note flicks bright the moment the marker reaches it
  function noteHits(from, to) {   // parked (Eman, 4 Nov: too big); window.KJ_NOTE_FLICK = true brings it back
    if (!window.KJ_NOTE_FLICK || reduce() || to <= from || to - from > 0.25) return;
    const spb = 60 / (ui.state.bpm || 120);
    let n0 = 0;
    for (const c of clipsAt(to)) {
      if (c.kind !== "midi" || !(c.notes || []).length) continue;
      const el = clipEl(c.id); if (!el || !el.offsetParent) continue;
      const cv = el.querySelector("canvas"); if (!cv) continue;
      const b0 = (from - c.start) / spb, b1 = (to - c.start) / spb, beats = Math.max(0.25, c.beats || 16);
      const hits = c.notes.filter((n) => !n.muted && n.start >= b0 && n.start < b1);
      if (!hits.length) continue;
      const ns = c.notes, lo0 = Math.min(...ns.map((n) => n.pitch)), hi0 = Math.max(...ns.map((n) => n.pitch));
      let lo = lo0, hi = hi0; if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
      const cr = cv.getBoundingClientRect(), er = el.getBoundingClientRect(), top = 20, bottom = cr.height - 6, rowH = (bottom - top) / (hi - lo + 1), ppb = cr.width / beats;
      for (const n of hits) {
        if (n0++ > 16) return;
        const k = document.createElement("i"); k.className = "kj-note";
        Object.assign(k.style, { left: cr.left - er.left + n.start * ppb + "px", top: cr.top - er.top + bottom - (n.pitch - lo + 1) * rowH + "px", width: Math.max(3, n.length * ppb) + "px", height: Math.max(2, rowH) + "px" });
        el.append(k);
        k.animate([{ opacity: 0, scale: "1 1" }, { opacity: 0.75, scale: "1.02 1.45", offset: 0.25 }, { opacity: 0, scale: "1 1" }], { duration: 420, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => k.remove();
      }
    }
  }
  // While it plays (Eman, 4 Nov): no pumping. Right at the marker and a little behind it, the sound
  // inside the clip breathes: each thin slice of the waveform (or the notes) swells a touch, more
  // when it's loud, and settles back as the marker moves on. Drawn on a canvas over the clip's own.
  // MIDI while it plays (Eman, 4 Nov). Every sounding note lights up whole (a chord all at once) and
  // then loses power as it rings: less and less white. The marker plucks it like a string: the
  // note shivers most right under the marker and the ripple dies out to the sides; away from the
  // marker it is all but still. A slide warms the notes into acid yellow while it glides and lets
  // them cool back to white after, so the next chord eases from yellow into white.
  // Same layout as app.js drawNotes (rows between 20 px from the top and 6 px from the bottom).
  function midiWake(g, c, pos, x0, dpr, W, H, now) {
    const notes = (c.notes || []).filter((n) => !n.muted);
    if (!notes.length) return;
    const spb = 60 / (ui.state.bpm || 120), beats = Math.max(0.25, c.beats || 16);
    const b = (pos - c.start) / spb;
    let lo = Math.min(...c.notes.map((n) => n.pitch)), hi = Math.max(...c.notes.map((n) => n.pitch));
    if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
    const top = 20 * dpr, bottom = H - 6 * dpr, rowH = (bottom - top) / (hi - lo + 1), ppb = W / beats;
    // how "slidey" it is right now: rises over a glide, cools for ~0.6 s after it
    let heat = 0;
    for (const n of notes) {
      if (!n.slide) continue;
      const over = notes.filter((q) => q !== n && q.start < n.start && q.start + q.length > n.start);
      const glide = over.length ? Math.max(0.0625, Math.min(n.length, Math.max(...over.map((q) => q.start + q.length)) - n.start)) : 0.25;
      const t = b - n.start;
      if (t < 0) continue;
      const gs = glide * spb, ts = t * spb;
      const h = ts < gs ? 0.35 + 0.65 * (ts / gs) : Math.exp(-(ts - gs) / 0.35);
      heat = Math.max(heat, h);
    }
    const mix = (k) => `rgb(${Math.round(255 + (228 - 255) * k)},255,${Math.round(255 + (58 - 255) * k)})`;
    const col = mix(heat);
    const step = Math.max(1, Math.round(2 * dpr));
    g.globalCompositeOperation = "lighter";
    for (const n of notes) {
      const end = n.start + n.length, after = (b - end) * spb;
      if (b < n.start || after > 0.35) continue;
      const on = after < 0, age = (b - n.start) * spb, vel = (n.velocity || 100) / 127;
      // power: a quick bright hit that rings down, then lets go after the note ends
      let pw = (0.32 + 0.68 * Math.exp(-age / 0.55)) * (0.6 + 0.4 * vel);
      if (age < 0.03) pw *= age / 0.03;
      if (!on) pw *= Math.pow(1 - after / 0.35, 2);
      const x = n.start * ppb, w = Math.max(dpr * 2, n.length * ppb - dpr);
      const y = bottom - (n.pitch - lo + 1) * rowH, h = Math.max(dpr * 2, rowH - dpr);
      // soft glow under it, still
      g.shadowColor = col; g.shadowBlur = 5 * dpr * pw; g.globalAlpha = 0.18 * pw; g.fillStyle = col;
      g.fillRect(x, y, w, h); g.shadowBlur = 0;
      // the string: drawn in thin slices, each lifted by the ripple from the marker
      g.globalAlpha = 0.5 * pw;
      const amp = on ? 1.3 * dpr * (0.5 + 0.5 * vel) * Math.exp(-age / 1.2) : 0, lam = 26 * dpr;
      for (let xx = x; xx < x + w; xx += step) {
        const dx = xx + step / 2 - x0, fall = Math.exp(-Math.abs(dx) / lam);
        const dy = amp * fall * Math.sin(dx / (6 * dpr) - now * 26);
        g.fillRect(xx, y + dy, Math.min(step, x + w - xx), h);
      }
      // a small spark exactly where the marker is on the note
      if (on && x0 >= x && x0 <= x + w) {
        const cy = y + h / 2, tail = 14 * dpr;
        const gr = g.createLinearGradient(x0 - tail, 0, x0, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,0.55)");
        g.globalAlpha = pw; g.fillStyle = gr;
        g.fillRect(Math.max(x, x0 - tail), y, Math.min(tail, x0 - x), h);
        const r = Math.max(1 * dpr, Math.min(2.4 * dpr, h * 0.7)) * (0.8 + 0.2 * Math.sin(now * 30 + n.pitch));
        g.globalAlpha = 0.9; g.fillStyle = col;
        g.beginPath(); g.arc(x0, cy, r, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }
  // KILLDRUM clips while they play (Eman, 6 Nov): no lengths, no strings. When the marker reaches a
  // hit, its dot pops a little bigger and glows white, then eases back to its own colour. Clean.
  // Uses app.js drumLayout, so the lit dot sits exactly on the drawn one. KT2_DRUM_BARS = old look.
  function drumWake(g, c, pos, dpr, W, H) {
    const L = window.drumLayout && drumLayout(c, W, H, dpr);
    if (!L || !L.rows.length) return;
    const spb = 60 / (ui.state.bpm || 120), b = (pos - c.start) / spb, UP = 0.035, DOWN = 0.26;
    for (const n of c.notes || []) {
      if (n.muted) continue;
      const age = (b - n.start) * spb;
      if (age < 0 || age > UP + DOWN) continue;
      const p = L.at(n); if (!p) continue;
      const k = age < UP ? age / UP : Math.pow(1 - (age - UP) / DOWN, 2);   // quick pop, smooth settle
      const vel = 0.65 + 0.35 * (n.velocity || 100) / 127;
      g.globalAlpha = k;
      g.shadowColor = "rgba(255,255,255,0.9)"; g.shadowBlur = 12 * dpr * k * vel; g.fillStyle = "#fff";
      g.beginPath(); g.arc(p.x, p.y, L.r * (1 + 0.45 * k * vel), 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0; g.globalAlpha = 1;
  }
  const wakes = new Map();
  function wake(pos) {
    const ph = document.getElementById("playhead");
    const live = new Set();
    if (ph && !reduce() && !window.KJ_NO_WAKE) {
      const px = ph.getBoundingClientRect().left, bass = bassNow(), now = performance.now() / 1000;
      for (const c of clipsAt(pos)) {
        const el = clipEl(c.id);
        if (!el || !el.offsetParent) continue;
        const src = el.querySelector("canvas:not(.kj-wake)");
        if (!src || !src.width || !src.height) continue;
        const sr = src.getBoundingClientRect(), er = el.getBoundingClientRect();
        if (px < sr.left - 2 || px > sr.right + 80) continue;
        live.add(c.id);
        let w = wakes.get(c.id);
        if (!w || w.el !== el || !w.cv.isConnected) {
          if (w) w.cv.remove();
          const cv = document.createElement("canvas"); cv.className = "kj-wake";
          el.append(cv);
          w = { el, cv, body: getComputedStyle(el).getPropertyValue("--k2-body").trim() || "#141218" };
          wakes.set(c.id, w);
        }
        const cv = w.cv, sc = er.width ? el.offsetWidth / er.width : 1;
        if (cv.width !== src.width || cv.height !== src.height) { cv.width = src.width; cv.height = src.height; }
        Object.assign(cv.style, { left: (sr.left - er.left) * sc + "px", top: (sr.top - er.top) * sc + "px", width: sr.width * sc + "px", height: sr.height * sc + "px" });
        const g = cv.getContext("2d"), kx = src.width / Math.max(1, sr.width), H = src.height;
        g.clearRect(0, 0, cv.width, cv.height);
        const hy = Math.round(18 * H / Math.max(1, sr.height));   // below the clip's name bar
        g.save(); g.beginPath(); g.rect(0, hy, cv.width, H - hy); g.clip();
        const x0 = (px - sr.left) * kx;
        if (c.kind === "midi" && !window.KT2_DRUM_BARS && el.classList.contains("kdclip")) { drumWake(g, c, pos, kx, src.width, H); g.restore(); continue; }
        if (c.kind === "midi") { midiWake(g, c, pos, x0, kx, src.width, H, now); g.restore(); continue; }
        // hits punch (Eman, 4 Nov): when the sound jumps up right here (a kick, a bass note) the
        // wave kicks out a bit more and glows brighter, then settles. Bigger in heavy parts,
        // barely there in quiet ones, so you can see the tempo.
        const lv = loudAt(c, pos), rise = Math.max(0, lv - loudAt(c, pos - 0.05));
        const hit = Math.min(1, rise * 2.6 * (0.5 + 0.5 * lv) * (0.75 + 0.5 * bass));
        w.punch = Math.max(hit, (w.punch || 0) * Math.exp(-(now - (w.t || now)) / 0.11)); w.t = now;
        const pk = w.punch * (0.35 + 0.65 * lv);
        const span = (64 + 26 * pk) * kx, step = Math.max(1, Math.round(2 * kx));
        const amt = 0.03 + 0.08 * Math.min(1, lv + bass * 0.3) + 0.16 * pk;
        for (let i = 0; i < span; i += step) {
          const x = Math.round(x0 - i);
          if (x < 0 || x + step > src.width) continue;
          const d = 1 - i / span, k = 1 + amt * d * d * (0.65 + 0.35 * Math.sin(now * 7 - i / kx * 0.12));
          const bh = H - hy, dh = bh * k;   // only the body (under the name bar), drawn a touch taller over itself
          g.drawImage(src, x, hy, step, bh, x, hy + (bh - dh) / 2, step, dh);
        }
        // audio lights up only at the marker and a little behind it, never in front (Eman, 4 Nov)
        g.globalCompositeOperation = "lighter";
        for (let i = 0; i < span; i += step) {
          const x = Math.round(x0 - i);
          if (x < 0 || x + step > src.width) continue;
          const d = 1 - i / span;
          g.globalAlpha = Math.min(0.9, (0.45 + 0.4 * pk) * d * d * d);
          g.drawImage(src, x, hy, step, H - hy, x, hy, step, H - hy);
        }
        g.restore();
      }
    }
    for (const [id, w] of wakes) if (!live.has(id)) { w.cv.remove(); wakes.delete(id); }
  }
  let wasPlaying = false, lastBeat = -1, lastPos = null;
  function watchPlay() {
    const p = playing();
    if (p && !wasPlaying) { const btn = document.getElementById("btn-play"); if (btn) squash(btn, true); lastBeat = -1; lastPos = null; }
    wasPlaying = p;
    if (p && ui.state && ui.transport) {
      const pos = heardPos(), spb = 60 / (ui.state.bpm || 120);
      const beat = Math.floor(pos / spb + 1e-4);
      if (beat !== lastBeat && pos >= 0) { if (lastBeat >= 0 || pos - beat * spb < 0.05) beatHit(beat * spb + 0.001, beat); lastBeat = beat; }
      if (lastPos != null) noteHits(lastPos, pos);
      lastPos = pos;
      wake(pos);
    } else if (wakes.size) wake(-1);
    requestAnimationFrame(watchPlay);
  }

  function setSound(on) { soundOn = on; try { localStorage.setItem("kt2.uiSounds", on ? "1" : "0"); } catch (e) { /* fine */ } }

  function init() {
    wrapRun(); wrapOpen(); wrapToast(); watchWindows();
    document.documentElement.classList.add("kj-on");
    requestAnimationFrame(watchPlay);
    setTimeout(() => squash(document.getElementById("logo"), true), 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0));
  else setTimeout(init, 0);

  return { squash, shake, flash, dust, burst, frame, sound: S, step, pop, unlock, reveal, land, setSound, soundOn: () => soundOn, resetUnlocks: () => { try { localStorage.removeItem("kt2.v2.unlocked"); } catch (e) { /* fine */ } } };
})();
