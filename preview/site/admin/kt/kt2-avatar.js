// KILLTOY 2: Eman's drawn head in the corner instead of the 3D character. It bobs, leans
// toward the mouse and its eyes follow it; it blinks now and then. It is the assistant's
// button (.kt-av), so a click still talks, and assistant.js drives it through
// window.ktAvatar.mode(m) / .word() like it drove the 3D one (listening leans in,
// thinking looks up, speaking bounces with each word).
// kt2-page.sh leaves avatar.js and three.min.js out of the KILLTOY 2 page.
// The picture (kt2-head.png, 260x399) has the face cut out, so the pupils drawn under it
// only show inside the face. Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const html = document.documentElement;
  if (!html.classList.contains("kt2")) return;
  const W = 120, H = Math.round(120 * 399 / 260);
  const S = W / 260;   // picture px -> screen px
  const EYES = [{ x: 58, y: 176, r: 27 }, { x: 158, y: 183, r: 30 }];   // pupil centres in the picture
  const FACE = { x: 8, y: 107, w: 218, h: 117 };   // the light face behind the cut-out

  const css = document.createElement("style");
  css.textContent = `
  .kt-ai.kt2-head .kt-av { width: ${W}px; height: ${H}px; border-radius: 0; background: none; box-shadow: none; animation: none; overflow: visible; transform: none !important; }
  .kt-ai.kt2-head .kt-av > :is(.eyes, .mouth, .ring) { display: none; }
  .kt-ai.kt2-head .kt-av .dots { top: -6px; right: 4px; }
  .kt-ai.kt2-head .kt-bub { margin-bottom: ${Math.round(H * 0.6)}px; }
  .k2h { position: absolute; inset: 0; transform-origin: 50% 90%; will-change: transform; }
  .k2h-face { position: absolute; left: ${FACE.x * S}px; top: ${FACE.y * S}px; width: ${FACE.w * S}px; height: ${FACE.h * S}px; background: #ecebe8; }
  .k2h-pupil { position: absolute; border-radius: 50%; background: #0a0a0c; transform-origin: 50% 50%; }
  .k2h img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; user-select: none;
    filter: drop-shadow(0 0 1px rgba(255,255,255,.55)) drop-shadow(0 0 10px rgba(255,255,255,.10)); }
  .k2h-shadow { position: absolute; left: 18%; right: 18%; bottom: -8px; height: 8px; border-radius: 50%; background: rgba(0,0,0,.45); filter: blur(3px); }
  .kt-av.listening .k2h-shadow { background: rgba(228,255,58,.25); }
  `;
  document.head.append(css);

  function mount() {
    const av = document.querySelector(".kt-av");
    if (!av) return false;
    av.parentElement.classList.add("kt2-head");
    const shadow = document.createElement("div");
    shadow.className = "k2h-shadow";
    const box = document.createElement("div");
    box.className = "k2h";
    const face = document.createElement("div");
    face.className = "k2h-face";
    box.append(face);
    const pupils = EYES.map((e) => {
      const p = document.createElement("i");
      p.className = "k2h-pupil";
      Object.assign(p.style, { width: e.r * 2 * S + "px", height: e.r * 2.16 * S + "px", left: (e.x - e.r) * S + "px", top: (e.y - e.r * 1.08) * S + "px" });
      box.append(p);
      return p;
    });
    const img = new Image();
    img.src = "kt2-head.png";
    img.alt = "";
    img.draggable = false;
    box.append(img);
    av.prepend(shadow, box);

    let mx = innerWidth / 2, my = innerHeight / 2, mode = "idle", lean = 0, look = { x: 0, y: 0 }, hop = 0, blink = 0, nextBlink = performance.now() + 2500;
    window.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = (now) => {
      requestAnimationFrame(frame);
      const r = av.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
      let dx = mx - cx, dy = my - cy;
      const dist = Math.hypot(dx, dy) || 1;
      // eyes: toward the mouse, a bit further the further it is (up to ~7 px)
      const reach = Math.min(1, dist / 420);
      let tx = (dx / dist) * reach, ty = (dy / dist) * reach;
      if (mode === "thinking") { tx = 0.5; ty = -0.9; }
      look.x += (tx - look.x) * 0.18; look.y += (ty - look.y) * 0.18;
      // the head leans toward the mouse and slides a little after it
      const wantLean = Math.max(-1, Math.min(1, dx / 600)) * (mode === "listening" ? 1.4 : 1);
      lean += (wantLean - lean) * 0.08;
      const t = now / 1000;
      const speed = mode === "speaking" ? 7 : mode === "listening" ? 3.2 : 2.1;
      const amp = reduced ? 0 : mode === "speaking" ? 4 : 2.6;
      hop *= 0.86;
      const bob = Math.sin(t * speed) * amp + hop;
      const squash = 1 + Math.sin(t * speed * 2) * (reduced ? 0 : 0.012) + hop * -0.006;
      box.style.transform = `translate(${(lean * 9).toFixed(2)}px, ${(-Math.abs(bob)).toFixed(2)}px) rotate(${(lean * 9 + Math.sin(t * speed * 0.5) * (reduced ? 0 : 1.2)).toFixed(2)}deg) scale(${(2 - squash).toFixed(4)}, ${squash.toFixed(4)})`;
      shadow.style.transform = `translateX(${(lean * 9).toFixed(2)}px) scaleX(${(1 - Math.abs(bob) * 0.03).toFixed(3)})`;
      // blink every few seconds
      if (now > nextBlink) { blink = 1; nextBlink = now + 2200 + Math.random() * 3800; }
      blink = Math.max(0, blink - 0.12);
      const lid = blink > 0 ? Math.max(0.08, 1 - Math.sin(blink * Math.PI)) : 1;
      for (const p of pupils) p.style.transform = `translate(${(look.x * 7).toFixed(2)}px, ${(look.y * 6).toFixed(2)}px) scaleY(${lid.toFixed(3)})`;
    };
    requestAnimationFrame(frame);

    window.ktAvatar = {
      mode(m) { mode = m; if (m === "acting") hop = 9; },
      word() { hop = Math.min(10, hop + 4); },
    };
    av.addEventListener("mousedown", () => { hop = 7; });
    return true;
  }
  if (!mount()) document.addEventListener("DOMContentLoaded", () => mount() || setTimeout(mount, 500));
})();
