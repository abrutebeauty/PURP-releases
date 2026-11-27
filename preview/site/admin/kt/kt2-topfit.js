// TOP BAR THAT FITS (Eman, 15 Nov): nothing in the top bar ever sits on top of something else. The time, the
// L/R meter, the ? and the menu used to float (absolute) over the bar, so on a narrower window, or with the
// bar 18% bigger, the meter landed on the BPM and buttons on the time. Now every item is in one row:
//   logo + tools | the time | BPM, KEY, modes, song, cards, ?, menu
// with at least 14 px between the groups. The bar takes the biggest size (up to the 18%-bigger one) that fits with
// some air to spare, and puts the time in the middle of the window when that costs (almost) nothing. When the row
// is wider than the window, everything scales down together (to 62% at most) instead of overlapping or squeezing.
// window.KT2_TOPFIT2_OLD = the old floating bar. ASCII only.
(function topFit() {
  if (window.KT2_TOPFIT2_OLD) return;
  const html = document.documentElement;
  if (!html.classList.contains("kt2")) return;
  const GAP = 14, MINZ = 0.62, CENTRED_MINZ = 0.86;   // the time stays centred down to 86% size
  const T = "html.kt2.k2-tf header.top";
  const st = document.createElement("style"); st.id = "k2-tf-css";
  st.textContent = `
${T} { gap: ${GAP}px; min-width: 0; }
${T} > .transport { position: relative !important; left: auto !important; top: auto !important; transform: none !important; height: auto; flex: none; margin-left: var(--tf-ml, auto) !important; }
${T} .transport > .k2m { position: static !important; translate: none !important; margin-right: 0; }
${T} > .kt-tools, ${T} > .top-left { flex: none; }
${T} > .kt-tools { margin-left: 0; }
${T} > .readouts { margin-left: auto !important; margin-right: 0 !important; flex: none; }
${T} > :is(.kt-help, .k2-hmenu) { position: relative !important; right: auto !important; top: auto !important; transform: none !important; flex: none; }
${T} > :is(.top-left, .kt-tools, .readouts, .kt-help, .k2-hmenu), ${T} > .transport > * { zoom: var(--tf-z, 1) !important; }
${T}.tf-measure > .transport { margin-left: 0 !important; }
${T}.tf-measure > .readouts { margin-left: 0 !important; }
${T}.tf-tight { overflow-x: clip; }`;
  (document.head || html).append(st);

  let top = null, raf = 0, last = "";
  const maxZ = () => (html.classList.contains("k2-top-big") ? 1.18 : 1);
  const inFlow = () => [...top.children].filter((c) => { const s = getComputedStyle(c); return s.display !== "none" && s.position !== "absolute" && s.position !== "fixed"; });
  // the width the row needs at zoom z, everything packed with the minimum gaps
  function need(z) {
    top.style.setProperty("--tf-z", z);
    const kids = inFlow();
    if (!kids.length) return 0;
    const H = top.getBoundingClientRect(), pr = parseFloat(getComputedStyle(top).paddingRight) || 0;
    return kids[kids.length - 1].getBoundingClientRect().right - H.left + pr;
  }
  // the middle of the time (or of the whole transport group when there is no time)
  const timeX = () => {
    const tr = top.querySelector(":scope > .transport"), time = document.getElementById("pos-time");
    const R = (time && tr && tr.contains(time) && time.offsetParent ? time : tr || top).getBoundingClientRect();
    return R.left + R.width / 2;
  };
  // FAST PLAY (16 Nov, deep debug): fit() lays the bar out about 20 times, and it ran at every class change on <html>
  // (play, stop, a menu opening...), 60 to 100 ms each. When the window and every item in the bar are as wide as
  // they were right after the last fit, the answer is the same: skip. window.KT2_TOPFIT_MEMO_OFF = true: always fit.
  let memo = "";
  const sigNow = (W) => W + "|" + maxZ() + "|" + inFlow().map((c) => c.offsetWidth).join(",");
  function fit() {
    raf = 0;
    if (!top || !top.isConnected || top.clientWidth < 50) return;
    const W = Math.min(top.clientWidth, html.clientWidth);   // the bar itself can be pushed wider than the window
    if (!window.KT2_TOPFIT_MEMO_OFF && memo && memo === sigNow(W)) return;
    top.classList.add("tf-measure");
    top.classList.remove("tf-tight");
    // the biggest size that fits with some air left over (6% of the width, the groups never packed edge to edge);
    // when centring the time costs almost nothing (4% size at most) the time sits in the middle of the window.
    // Each test is one layout of the bar, measured packed.
    const air = Math.min(96, W * 0.06);
    const centred = (z) => { const n = need(z), c = timeX() - top.getBoundingClientRect().left; return c <= W / 2 && n - c <= W / 2; };
    const best = (ok, lo, hi) => {
      if (ok(hi)) return hi;
      if (lo > hi || !ok(lo)) return null;
      for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
      return Math.floor(lo * 100) / 100;
    };
    const zFit = best((z) => need(z) <= W - air, MINZ, maxZ()) || best((z) => need(z) <= W, MINZ, maxZ()) || MINZ;
    const zMid = best(centred, Math.max(CENTRED_MINZ, zFit - 0.04), maxZ());
    const z = zMid || zFit;
    top.style.setProperty("--tf-z", z);
    const slack = W - need(z), tight = slack < -0.5;
    // the time in the middle of the window when there is room, else as close to it as it can get: measured
    // packed, it moves right by at most the room that is left over
    if (top.querySelector(":scope > .transport")) {
      const want = top.getBoundingClientRect().left + W / 2 - timeX();
      top.style.setProperty("--tf-ml", Math.floor(Math.max(0, Math.min(slack, want))) + "px");
    }
    top.classList.remove("tf-measure");
    top.classList.toggle("tf-tight", tight);
    last = W + ":" + z;
    html.dataset.k2tf = z;
    memo = sigNow(W);
  }
  const later = () => { if (!raf) raf = setTimeout(fit, 16); };   // not rAF: it never fires while the tab is hidden

  function start() {
    top = document.querySelector("header.top");
    if (!top) return;
    html.classList.add("k2-tf");
    window.addEventListener("resize", later);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(later);
      ro.observe(top);
      const watch = () => [...top.children].forEach((c) => ro.observe(c));
      watch();
      new MutationObserver(() => { watch(); later(); }).observe(top, { childList: true });
    }
    new MutationObserver(later).observe(html, { attributes: true, attributeFilter: ["class"] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
    later();
    setTimeout(later, 1500);   // modules that add buttons to the bar after load (tempo, cards, menu)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.KT2TopFit = { fit, zoom: () => parseFloat(top && top.style.getPropertyValue("--tf-z")) || 1, last: () => last };
})();
