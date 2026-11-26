/* COREKULT day / night switch (Eman 21 Nov). Night = default. The choice is kept per visitor (localStorage "ck-theme").
   THEME_ON = false: no switch, always night. Day colours: day.css + day-*.css. Images are never filtered. */
(function () {
  var THEME_ON = true, K = "ck-theme", d = document.documentElement;
  var get = function () { try { return localStorage.getItem(K); } catch (e) { return null; } };
  var isDay = function () { return d.getAttribute("data-theme") === "day"; };
  if (!THEME_ON) return;
  // AUTO (Eman 26 Nov): no saved choice = follow the visitor's OS / Chrome setting. A tap on the sun/moon button is remembered and wins.
  var mq = null; try { mq = window.matchMedia("(prefers-color-scheme: light)"); } catch (e) {}
  var want = function () { var g = get(); return g === "day" ? true : g === "night" ? false : !!(mq && mq.matches); };
  var meta = function (day) { try { var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", day ? "#eceaea" : "#0b0a0e"); } catch (e) {} };
  if (want()) d.setAttribute("data-theme", "day"); meta(isDay());

  // waveforms are drawn on canvas by shop.js with fixed colours: swap them while drawing in day mode
  // OPIUM 2 sound cards, preview stack and wave boxes draw white bars on canvas: in day mode white bars become dark ink, near-black plates become light (alpha is kept). Pictures are never touched.
  var isWave = function (c) { try { return !!(c && c.closest && c.closest(".pv,.cs-pvstack,.cs-pvr,.op-pl,.psec") && !c.closest(".pq")); } catch (e) { return false; } };
  var flip = function (v) {
    var m = /^\s*(#([0-9a-f]{3}|[0-9a-f]{6})|rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\))\s*$/i.exec(v); if (!m) return v;
    var r, g, b, a = 1;
    if (m[2]) { var h = m[2]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
    else { r = +m[3]; g = +m[4]; b = +m[5]; if (m[6] != null) a = m[6].slice(-1) === "%" ? parseFloat(m[6]) / 100 : parseFloat(m[6]); }
    var mn = Math.min(r, g, b), mxx = Math.max(r, g, b);
    if (mn > 200 && mxx - mn < 40) return "rgba(22,21,26," + Math.min(1, a * 1.15) + ")";      // white bars -> ink
    if (mn > 110 && mxx - mn < 40) return "rgba(22,21,26," + Math.min(1, a * 0.7 + 0.12) + ")";      // light greys -> dark greys
    if (mxx < 24) return a >= 0.99 ? "#e9e9e6" : "rgba(233,233,230," + a + ")";                    // near-black plate -> light plate
    return v;
  };
  var MAP = { "#8b6cf6": "#7255ee", "#b8a4ff": "#5b3fd6", "#e4ff3a": "#6b7d00", "#fff": "#16141c", "#ffffff": "#ffffff" }, inW = false;
  try {
    var P = CanvasRenderingContext2D.prototype;
    ["fillStyle", "strokeStyle", "shadowColor"].forEach(function (k) {
      var ds = Object.getOwnPropertyDescriptor(P, k); if (!ds || !ds.set) return;
      Object.defineProperty(P, k, { configurable: true, enumerable: ds.enumerable, get: ds.get,
        set: function (v) { if (typeof v === "string") { if (inW) { var m = MAP[v.toLowerCase()]; if (m) { ds.set.call(this, m); return; } } if (isDay() && isWave(this.canvas)) v = flip(v); } ds.set.call(this, v); } });
    });
  } catch (e) {}
  function wrapWave() {
    var o = window.drawWave; if (typeof o !== "function" || o.__day) return;
    var w = function () { inW = isDay(); try { return o.apply(this, arguments); } finally { inW = false; } };
    w.__day = true; try { window.drawWave = w; } catch (e) {}
  }
  function redraw() {
    if (typeof window.drawWave !== "function") return;
    document.querySelectorAll("canvas.wf").forEach(function (c) { var b = c.closest("button,[data-src]"); if (b) try { window.drawWave(b, null); } catch (e) {} });
  }
  var SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2"/><path d="M7.2 0h1.6v2.6H7.2zM7.2 13.4h1.6V16H7.2zM0 7.2h2.6v1.6H0zM13.4 7.2H16v1.6h-2.6zM2.1 3.2l1.1-1.1 1.8 1.8-1.1 1.1zM11 12.1l1.1-1.1 1.8 1.8-1.1 1.1zM2.1 12.8l1.8-1.8 1.1 1.1-1.8 1.8zM11 3.9l1.8-1.8 1.1 1.1-1.8 1.8z"/></svg>';
  var MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 1.2A7 7 0 1 0 14.8 11 5.6 5.6 0 0 1 10.6 1.2Z"/></svg>';
  function paint(b) { b.innerHTML = isDay() ? MOON : SUN; b.setAttribute("aria-label", isDay() ? "Night mode" : "Day mode"); b.setAttribute("aria-pressed", isDay() ? "true" : "false"); }
  function set(day, auto) {
    d.classList.add("thm-anim");
    if (day) d.setAttribute("data-theme", "day"); else d.removeAttribute("data-theme");
    meta(day);
    if (!auto) try { localStorage.setItem(K, day ? "day" : "night"); } catch (e) {}
    document.querySelectorAll(".thm").forEach(paint);
    redraw(); try { window.dispatchEvent(new Event("resize")); } catch (e) {} setTimeout(function () { d.classList.remove("thm-anim"); }, 300);
  }
  function mount() {
    wrapWave();
    if (document.querySelector(".thm")) return;
    var b = document.createElement("button"); b.type = "button";
    var nav = document.querySelector("nav.top .wrap"), cart = nav && nav.querySelector(".cartw"), adm = document.querySelector("body[data-page] .top .in");
    if (nav) { b.className = "nl thm"; nav.insertBefore(b, cart || null); }
    else if (adm) { b.className = "tab thm"; adm.appendChild(b); }
    else { b.className = "thm fix"; document.body.appendChild(b); }
    paint(b);
    b.addEventListener("click", function () { set(!isDay()); });
    if (isDay()) redraw();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  window.addEventListener("storage", function (e) { if (e.key === K) set(want(), true); });
  if (mq) { var ch = function () { if (!get()) set(want(), true); }; if (mq.addEventListener) mq.addEventListener("change", ch); else if (mq.addListener) mq.addListener(ch); }
})();
