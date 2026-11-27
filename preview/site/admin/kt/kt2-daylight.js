// DAYLIGHT (Eman, 15 Nov): Preferences > Look > LIGHT turns the WHOLE app into a light, daytime theme, not
// just the background: top bar, bar strip, grid, footer, lane windows, plugin windows, Preferences, menus,
// the mixer. How: the dark look stays underneath and the page is flipped light with one filter on the root
// (invert + hue-rotate 180, so purples stay purple and greys go light). What must keep its own colours is
// flipped back: pictures, videos, the clips (same clip colours as on the dark look), the avatar.
// The acid yellow reads as a deep olive on the light page (like the classic light look's accent).
// window.KT2_DAYLIGHT_OLD = old: LIGHT only changed the background. ASCII only.
(function daylight() {
  if (window.KT2_DAYLIGHT_OLD) return;
  const html = document.documentElement;
  if (!html.classList.contains("kt2")) return;
  const F = "invert(1) hue-rotate(180deg)";
  const D = "html.kt2.k2-day";
  const KEEP = 'img, video, picture, .clip, .kt-av, .bg-tile, [style*="url("]';   // flipped back: their own colours (.bg-tile = the Look swatches)
  const st = document.createElement("style"); st.id = "k2-day-css";
  st.textContent = `
${D} { filter: ${F}; background: #1d1d1f; }
${D} body :is(${KEEP}) { filter: ${F}; }
${D} body :is(${KEEP}) :is(${KEEP}) { filter: none; }
/* the classic light look's own tweaks would flip twice: back to the dark look's values under the filter */
${D} body.look-light .logo img, ${D} body.look-light .empty-logo { filter: none; }
${D} body.look-light .playhead { background: rgba(220, 220, 228, 0.75); }
${D} body.look-light .k2rh-panel { background: #1c1c20; color: #ececee; }
${D} body.look-light .k2rh-tile { background: #26262b; color: #f2f2f4; }`;
  (document.head || html).append(st);

  const sync = () => html.classList.toggle("k2-day", !!document.body && document.body.classList.contains("look-light"));
  function start() {
    sync();
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.KT2Daylight = { on: () => html.classList.contains("k2-day") };
})();
