/* COREKULT FX (24 Nov, Eman): (1) CD "spin in 3D" page transition when you press a pack's art, then the pack info types out like code,
   (2) UI sound effects: good actions get bright clicks, remove-from-cart gets a "wrong" sound.
   One self-contained file (own CSS + own synth, no files). Loaded in <head> on every page. Remove the <script src="/fx.js"> line = back to normal.
   Respects: the site sound switch (localStorage ck-mute), and prefers-reduced-motion (no spin, no typing, no sweeps). Flags below. */
(function () {
  "use strict";
  var FX_SPIN = false, FX_TYPE = false, FX_SOUND = true;   // 24 Nov (Eman): transition + typing OFF, sounds stay
  var doc = document.documentElement, KEY = "ck-fx-tr";
  var reduced = function () { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  var muted = function () { try { return localStorage.getItem("ck-mute") === "1"; } catch (e) { return false; } };
  var ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} } };

  /* ---------- CSS ---------- */
  var css = ".fx-ov{position:fixed;inset:0;z-index:2147483000;perspective:1100px;perspective-origin:50% 45%;overflow:hidden;pointer-events:none}" +
    ".fx-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,#241a46 0,#0b0a0e 62%);opacity:0}" +
    ".fx-ring{position:absolute;left:50%;top:46%;width:40vmin;height:40vmin;margin:-20vmin 0 0 -20vmin;border-radius:50%;border:2px solid #E4FF3A;opacity:0}" +
    ".fx-cd{position:absolute;left:0;top:0;transform-origin:50% 50%;transform-style:preserve-3d;will-change:transform;backface-visibility:visible}" +
    ".fx-cd img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 26px rgba(139,108,246,.65)) drop-shadow(0 18px 30px rgba(0,0,0,.7))}" +
    "html.fx-in .pkc .pq,html.fx-in .pkc .stamp,html.fx-in .pkc .badge{visibility:hidden}" +
    ".fx-typ{caret-color:#E4FF3A}" +
    ".fx-typing{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace!important;letter-spacing:0!important}" +
    ".fx-caret{display:inline-block;width:.55em;height:1em;margin-left:2px;vertical-align:-.12em;background:#E4FF3A;animation:fxb .5s steps(1) infinite}" +
    "@keyframes fxb{50%{opacity:0}}" +
    ".fx-hid{visibility:hidden}" +
    ".fx-pop{animation:fxp .45s cubic-bezier(.2,.9,.25,1.1) both}@keyframes fxp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}";
  var st = document.createElement("style"); st.id = "fx-css"; st.textContent = css; (document.head || doc).appendChild(st);

  /* ---------- SOUND ENGINE ---------- */
  var ctx = null, out = null, last = {};
  function ac() {
    if (!FX_SOUND || muted()) return null;
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 1.8;
      var lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1; out.connect(lim); lim.connect(ctx.destination); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {});
    return ctx && ctx.state === "running" ? ctx : null;
  }
  function tone(f, dur, type, gain, slide, delay, lp) {
    var c = ac(); if (!c) return; var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain || 0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var n = o; if (lp) { var fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); n = fl; }
    n.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.04);
  }
  function sweep(dur, gain, f0, f1, q, delay, type) {   // filtered noise that glides from f0 to f1 (whoosh)
    var c = ac(); if (!c) return; var t = c.currentTime + (delay || 0), n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; fl.type = type || "bandpass"; fl.Q.value = q || 1.2;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t);
  }
  function click(gain, freq, delay) { sweep(0.012, gain || 0.03, freq || 3600, freq ? freq * 0.6 : 2200, 2, delay || 0, "bandpass"); }
  var S = {
    tick: function () { tone(1900, 0.02, "sine", 0.012, 1500, 0, 6000); },
    click: function () { click(0.03, 3200); tone(620, 0.045, "triangle", 0.03, 540, 0, 3800); },
    /* positive: bright up-arpeggio (E major) + glassy shimmer + dry click */
    add: function () { click(0.035, 4200); [659, 831, 988, 1319].forEach(function (f, i) { tone(f, 0.16, "triangle", 0.032, null, i * 0.045, 5200); tone(f * 2, 0.1, "sine", 0.009, null, i * 0.045 + 0.01, 8000); }); tone(2637, 0.28, "sine", 0.012, null, 0.17, 9000); },
    ok: function () { click(0.03, 4000); tone(784, 0.12, "triangle", 0.03, null, 0, 5200); tone(1175, 0.18, "triangle", 0.03, null, 0.06, 5600); tone(1568, 0.2, "sine", 0.012, null, 0.06, 8000); },
    /* negative: low falling buzz, two dull pulses, a tritone apart = "wrong" */
    rm: function () { tone(196, 0.13, "sawtooth", 0.05, 150, 0, 650); tone(277, 0.13, "square", 0.02, 205, 0, 600); tone(165, 0.2, "sawtooth", 0.05, 110, 0.11, 560); tone(233, 0.2, "square", 0.02, 150, 0.11, 520); tone(70, 0.16, "sine", 0.05, 45, 0, 300); },
    open: function () { tone(520, 0.07, "sine", 0.028, 780, 0, 4000); click(0.02, 3000); },
    close: function () { tone(700, 0.07, "sine", 0.024, 430, 0, 3500); },
    whoosh: function () { sweep(0.62, 0.11, 300, 5200, 0.9, 0); tone(110, 0.55, "sine", 0.05, 380, 0, 900); },
    rewind: function () { sweep(0.7, 0.085, 4800, 260, 0.9, 0); },
    thunk: function () { tone(150, 0.22, "sine", 0.1, 42, 0, 600); click(0.05, 1800); tone(1250, 0.1, "triangle", 0.02, 1500, 0.02, 5200); tone(2500, 0.08, "sine", 0.008, null, 0.03, 7000); },
    key: function () { click(0.011 + Math.random() * 0.006, 2600 + Math.random() * 1800); }
  };
  var RED_OK = { tick: 1, click: 1, add: 1, ok: 1, rm: 1, open: 1, close: 1, thunk: 1, key: 0 };
  function play(k) {
    try { if (!S[k]) return; var now = performance.now(); var gap = k === "key" ? 38 : k === "tick" ? 60 : 25; if (last[k] && now - last[k] < gap) return; last[k] = now;
      if (reduced() && !RED_OK[k]) return; S[k](); } catch (e) {}
  }
  window.ckUi = play;
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { addEventListener(ev, function u() { ac(); removeEventListener(ev, u, true); }, true); });   // first tap unlocks audio (browser rule)
  addEventListener("pointerdown", function () { if (!muted()) ac(); }, { capture: true, passive: true });

  /* click sounds (capture phase, so we read the state BEFORE shop.js changes it) */
  var SKIP = ".bflow,#pkSounds,.wv,.snd,.sfxm,audio,[data-noclick]";
  addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var add = t.closest("[data-add]"); if (add) { play(/in cart/i.test(add.textContent || "") ? "open" : "add"); return; }
    if (t.closest("[data-rm]")) { play("rm"); return; }
    if (t.closest("#cartBtn")) { play(t.closest("#cartBtn").classList.contains("open") ? "close" : "open"); return; }
    if (t.closest("[data-close],.dh .x")) { play("close"); return; }
    if (t.closest(SKIP)) return;
    if (t.closest("a[href^='/pack/'] img,.cv")) return;   // pack art: the transition plays its own whoosh
    var b = t.closest(".btn.acid,#frGo,#claimGo,[data-checkout],#payBtn,.buy .acid");
    if (b) { play("ok"); return; }
    if (t.closest("button,.btn,.ch,.chip,.nl,.cartb")) play("click");
  }, true);
  /* very soft hover tick on buttons and CD art */
  var hov = null;
  addEventListener("pointerover", function (e) {
    if (e.pointerType && e.pointerType !== "mouse") return; var t = e.target && e.target.closest && e.target.closest(".btn,.ch,.chip,.cv,.nl,[data-add],[data-rm]");
    if (!t || t === hov || (t.closest && t.closest(SKIP))) { hov = t || null; return; } hov = t; play("tick");
  }, { passive: true });

  /* ---------- 3D CD TRANSITION ---------- */
  function mkOv(src, r) {
    var ov = document.createElement("div"); ov.className = "fx-ov";
    ov.innerHTML = '<div class="fx-bg"></div><div class="fx-ring"></div><div class="fx-cd"><img alt="" draggable="false"></div>';
    var cd = ov.querySelector(".fx-cd"), im = cd.querySelector("img"); im.src = src;
    cd.style.width = r.w + "px"; cd.style.height = r.h + "px"; cd.style.left = r.x + "px"; cd.style.top = r.y + "px";
    (document.body || doc).appendChild(ov);
    return { ov: ov, cd: cd, bg: ov.querySelector(".fx-bg"), ring: ov.querySelector(".fx-ring") };
  }
  var vw = function () { return innerWidth; }, vh = function () { return innerHeight; };
  function bigScale(w, h) { var target = Math.min(vh() * 0.62, vw() * 0.8, 560); return target / Math.max(w, h); }
  function ctrShift(r, s) { return { dx: vw() / 2 - (r.x + r.w / 2), dy: vh() * 0.46 - (r.y + r.h / 2) }; }
  var go = false;
  function leave(a) {
    var img = a.querySelector("img"); if (!img || go) return false; go = true;
    var b = img.getBoundingClientRect(); if (b.width < 20) { go = false; return false; }
    var r = { x: b.left, y: b.top, w: b.width, h: b.height }, o = mkOv(img.currentSrc || img.src, r), s = bigScale(r.w, r.h), c = ctrShift(r, s), D = 760;
    ss.set(KEY, JSON.stringify({ src: img.currentSrc || img.src, w: r.w, h: r.h, t: Date.now() }));
    play("whoosh");
    o.bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D * 0.7, delay: D * 0.15, fill: "forwards", easing: "ease-in" });
    o.ring.animate([{ opacity: 0.85, transform: "scale(.2)" }, { opacity: 0, transform: "scale(2.6)" }], { duration: D * 0.9, delay: D * 0.25, easing: "cubic-bezier(.1,.7,.2,1)", fill: "both" });
    var an = o.cd.animate([
      { transform: "translate3d(0,0,0) rotateY(0deg) rotateZ(0deg) scale(1)", offset: 0 },
      { transform: "translate3d(" + c.dx * 0.35 + "px," + c.dy * 0.35 + "px,60px) rotateY(260deg) rotateZ(-6deg) scale(" + (1 + (s - 1) * 0.35) + ")", offset: 0.4 },
      { transform: "translate3d(" + c.dx + "px," + c.dy + "px,140px) rotateY(720deg) rotateZ(0deg) scale(" + s + ")", offset: 1 }
    ], { duration: D, easing: "cubic-bezier(.55,.05,.25,1)", fill: "forwards" });
    var done = false, nav = function () { if (done) return; done = true; location.href = a.href; };
    an.onfinish = nav; setTimeout(nav, D + 250);
    return true;
  }
  addEventListener("click", function (e) {
    if (!FX_SPIN || reduced() || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest && e.target.closest("a[href^='/pack/']"); if (!a || a.target === "_blank") return;
    if (e.target.closest("[data-add],[data-rm],button")) return;
    var img = a.querySelector(".pq img, .cv img, img"); if (!img || !(a.closest(".cv") || a.querySelector(".pq") || a.closest(".simg,.sim,.cd"))) return;
    if (leave(a)) { e.preventDefault(); }
  }, false);

  /* ---- arriving on a pack page ---- */
  var T = null; try { T = JSON.parse(ss.get(KEY) || "null"); } catch (e) { T = null; } ss.del(KEY);
  if (T && FX_SPIN && !reduced() && Date.now() - T.t < 6000 && /^\/pack\//.test(location.pathname)) arrive(T);

  function arrive(T) {
    doc.classList.add("fx-in");
    var r0 = { w: T.w, h: T.h, x: 0, y: 0 }, s0 = bigScale(T.w, T.h);
    r0.x = vw() / 2 - T.w / 2; r0.y = vh() * 0.46 - T.h / 2;
    var o = mkOv(T.src, r0); o.bg.style.opacity = 1;
    o.cd.style.transform = "translate3d(0,0,140px) scale(" + s0 + ")";
    var fin = false;
    function cleanup() { if (fin) return; fin = true; doc.classList.remove("fx-in"); setTimeout(function () { if (o.ov.parentNode) o.ov.parentNode.removeChild(o.ov); }, 50); }
    setTimeout(cleanup, 5000);   // never leave the page covered
    function target(cb, n) {   // wait until the real cover is painted
      var im = document.querySelector("#pkTop .pkc .pq img");
      if (im) { var b = im.getBoundingClientRect(); if (b.width > 40 && b.height > 40) return cb(b); }
      if ((n || 0) > 150) return cleanup();
      requestAnimationFrame(function () { target(cb, (n || 0) + 1); });
    }
    function land(b) {
      var D = 900, dx = (b.left + b.width / 2) - r0.x - T.w / 2, dy = (b.top + b.height / 2) - r0.y - T.h / 2, sc = b.width / T.w;
      play("rewind");
      o.bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D * 0.75, delay: D * 0.2, fill: "forwards", easing: "ease-out" });
      o.ring.animate([{ opacity: 0.7, transform: "scale(.6)" }, { opacity: 0, transform: "scale(2.2)" }], { duration: 700, delay: D * 0.55, easing: "ease-out", fill: "both" });
      var an = o.cd.animate([
        { transform: "translate3d(0,0,140px) rotateY(0deg) scale(" + s0 + ")", offset: 0 },
        { transform: "translate3d(" + dx * 0.7 + "px," + dy * 0.7 + "px,70px) rotateY(250deg) scale(" + (sc + (s0 - sc) * 0.3) + ")", offset: 0.55 },
        { transform: "translate3d(" + dx + "px," + dy + "px,-10px) rotateY(380deg) rotateZ(1.5deg) scale(" + sc * 0.985 + ")", offset: 0.85 },
        { transform: "translate3d(" + dx + "px," + dy + "px,0) rotateY(360deg) rotateZ(0deg) scale(" + sc + ")", offset: 1 }
      ], { duration: D, easing: "cubic-bezier(.2,.8,.25,1)", fill: "forwards" });
      an.onfinish = function () { play("thunk"); doc.classList.remove("fx-in"); setTimeout(function () { cleanup(); }, 40); settle(); };
    }
    target(land);
  }

  /* ---- info types out like code ---- */
  function settle() {
    if (!FX_TYPE) return;
    var n = 0, go2 = function () {
      var pki = document.querySelector("#pkTop .pki");
      if (!pki) { if (n++ < 120) return setTimeout(go2, 50); return; }
      typeOut(pki);
    }; go2();
  }
  function typeOut(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], t;
    while ((t = walker.nextNode())) { if (!t.nodeValue.trim()) continue; var p = t.parentNode;
      if (p.closest("script,style,button,.btn,.buy,.price,input,textarea,svg")) continue; nodes.push(t); }
    var blocks = [].slice.call(root.querySelectorAll(".buy,.price,.btn,button,.stars,.pks")).filter(function (b) { return !nodes.some(function (nd) { return b.contains(nd); }); });
    if (!nodes.length) return;
    var h0 = root.offsetHeight; root.style.minHeight = h0 + "px"; root.classList.add("fx-typ");
    var full = nodes.map(function (nd) { return nd.nodeValue; }); nodes.forEach(function (nd) { nd.nodeValue = ""; });
    blocks.forEach(function (b) { b.classList.add("fx-hid"); });
    var total = full.join("").length, per = Math.max(1, Math.round(total / 55)), i = 0, ci = 0, caret = document.createElement("span"); caret.className = "fx-caret"; caret.setAttribute("aria-hidden", "true");
    var cur = null;
    (function tick() {
      if (ci >= nodes.length) { end(); return; }
      var nd = nodes[ci], f = full[ci], el = nd.parentNode;
      if (cur !== el) { if (cur) cur.classList.remove("fx-typing"); cur = el; el.classList.add("fx-typing"); }
      i = Math.min(f.length, i + per); nd.nodeValue = f.slice(0, i);
      nd.parentNode.insertBefore(caret, nd.nextSibling);
      if (!(i % 2)) play("key");
      if (i >= f.length) { ci++; i = 0; setTimeout(tick, 70); } else requestAnimationFrame(tick);
    })();
    var ended = false;
    function end() {
      if (ended) return; ended = true;
      if (cur) cur.classList.remove("fx-typing");
      if (caret.parentNode) caret.parentNode.removeChild(caret);
      root.classList.remove("fx-typ"); root.style.minHeight = "";
      blocks.forEach(function (b, k) { b.classList.remove("fx-hid"); b.classList.add("fx-pop"); b.style.animationDelay = k * 70 + "ms"; });
      play("tick");
    }
    setTimeout(function () { nodes.forEach(function (nd, k) { if (nd.nodeValue !== full[k]) nd.nodeValue = full[k]; }); end(); }, 4500);   // safety: always end with the real text
  }
})();
