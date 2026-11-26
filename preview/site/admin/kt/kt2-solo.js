// KILLTOY 2: SOLO | FULL in the lane window's own top bar (Eman, 31 Oct), so it shows on every
// tab (TOY MACHINE / KILLDRUM, Split, MIDI). SOLO loops this lane on its own for a few bars from
// its clip's start (16 by default, the picker next to it changes it); FULL plays the whole song
// from the marker. Space in the window: play (from the marker if it is inside the loop), Space again stops.
// TOY MACHINE's own switch hides inside this window (one switch, one choice). Keep it ASCII-only.
"use strict";

(function () {
  if (!document.documentElement.classList.contains("kt2")) return;
  const MODE = "killtoy.playMode", BARS = "killtoy.soloBars";
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } } };
  const mode = () => (ls.get(MODE) === "full" ? "full" : "solo");
  const bars = () => { const n = +ls.get(BARS); return [1, 2, 4, 8, 16, 32, 64].includes(n) ? n : 16; };
  let solo = false, box = null;
  const playing = () => !!(ui.transport && ui.transport.playing);
  const open = () => !!(window.iw && !$("iw").hidden);

  // LOOP plays the pattern on its own, apart from the song's loop. A loop made in the MIDI roll's
  // ruler while on LOOP is a part of this pattern ({ clipId, from, to } in seconds from its start),
  // and only that shows as a yellow bar (Eman, 4 Nov 23:27).
  let part = null;
  window.KT2Solo = {
    mode, active: () => solo,
    part: (clipId) => (part && part.clipId === clipId ? part : null),
    async setPart(clipId, from, to) {
      part = to > from ? { clipId, from, to } : null;
      if (solo) { solo = false; await start(); }
      paint();
    },
  };
  async function start() {
    if (mode() === "solo" && iw) {
      const clip = ui.roll && ui.roll.clipId ? ui.roll.clipId : (ui.roll && ui.roll.clip && ui.roll.clip.id) || null;
      const pt = part && part.clipId === clip ? { from: part.from, to: part.to } : {};
      // LOOP always starts at the pattern's beginning (step 1), never where the song's marker sits;
      // only TRACK follows the marker (Eman, 14 Nov). KT2_LOOP_AT_MARKER = the 8 Nov behaviour
      // (from the marker when it sits inside the loop).
      const at = window.KT2_LOOP_AT_MARKER && ui.transport && isFinite(ui.transport.position) ? ui.transport.position : undefined;
      const r = await booth("laneSolo", { pluginId: iw.pluginId, trackId: iw.trackId, clipId: clip, ...pt, at, bars: window.KT2_SOLO_BARS ? bars() : 0 });   // the pattern's own length (Eman, 4 Nov: its length is how far it's dragged out); KT2_SOLO_BARS brings the picker back
      if (r && r.ok) { solo = true; paint(); return; }
    }
    await run("togglePlay"); paint();
  }
  async function stop() {
    if (solo) { solo = false; await booth("laneSolo", { on: false }); }
    else if (playing()) await run("togglePlay");
    paint();
  }
  const toggle = async () => { if (solo || playing()) await stop(); else await start(); };

  function build() {
    box = el("div", "k2-solo");
    box.innerHTML = `<div class="k2s-seg" title="LOOP: loop this pattern on its own. TRACK: play the whole song from the marker"><button data-m="solo">LOOP</button><button data-m="full">TRACK</button></div>
      <select class="k2s-bars" title="How long the LOOP is, from the clip's start"></select>
      <button type="button" class="k2s-play" title="Play / stop (Space)"><svg viewBox="0 0 16 16" width="14" height="14"><path d="M4.5 3.2v9.6L12.5 8z"/></svg></button>`;
    const sel = box.querySelector(".k2s-bars");
    for (const n of [1, 2, 4, 8, 16, 32, 64]) { const o = el("option", null, n + (n === 1 ? " bar" : " bars")); o.value = n; sel.append(o); }
    sel.onchange = async () => { ls.set(BARS, sel.value); if (solo) { solo = false; await start(); } paint(); };
    sel.onkeydown = (e) => { if (e.key === " ") e.preventDefault(); };
    for (const b of box.querySelectorAll("[data-m]")) b.onclick = async (e) => {
      e.stopPropagation();
      if (b.dataset.m === mode()) return;
      const was = solo || playing();
      if (was) await stop();
      ls.set(MODE, b.dataset.m); paint();
      if (was) await start();
    };
    box.querySelector(".k2s-play").onclick = (e) => { e.stopPropagation(); toggle(); };
    const end = document.querySelector("#iw .iw-end");
    end.prepend(box);
  }
  function paint() {
    if (!box) return;
    for (const b of box.querySelectorAll("[data-m]")) b.classList.toggle("on", b.dataset.m === mode());
    const sel = box.querySelector(".k2s-bars");
    sel.value = String(bars()); sel.hidden = mode() !== "solo" || !window.KT2_SOLO_BARS;
    box.querySelector(".k2s-play").classList.toggle("on", solo || playing());
  }
  setInterval(() => {
    if (!open()) { return; }
    if (!box || !box.isConnected) build();
    if (solo && !playing()) solo = false;
    paint();
  }, 200);
  // Opening a pattern (double-click a drum, MIDI or synth pattern) starts on TRACK and leaves whatever is playing
  // alone, so the switch shows what is really heard; picking LOOP then loops only that pattern (Eman, 15 Nov).
  // KT2_OPEN_LOOP_OLD = the window keeps the last choice (it could show LOOP while the whole song plays).
  const _openW = window.openLaneWindow;
  if (typeof _openW === "function") window.openLaneWindow = openLaneWindow = function (a) {
    const was = open() && iw ? iw.trackId : null, cid = a && a.clip && a.clip.id, wasClip = ui.roll && ui.roll.clipId;
    const fresh = !was || !a || !a.t || a.t.id !== was || (cid && cid !== wasClip);
    if (fresh && !window.KT2_OPEN_LOOP_OLD && !solo) ls.set(MODE, "full");
    const r = _openW.apply(this, arguments);
    paint();
    return r;
  };
  // closing the window ends a SOLO (the song's loop and marker come back)
  const _close = window.closeLaneWindow;
  if (typeof _close === "function") window.closeLaneWindow = closeLaneWindow = function () { if (solo) { solo = false; booth("laneSolo", { on: false }); } return _close.apply(this, arguments); };

  window.addEventListener("keydown", (e) => {
    if (e.key !== " " || e.metaKey || e.ctrlKey || e.altKey || !open()) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat) toggle();
  }, true);

  document.head.insertAdjacentHTML("beforeend", `<style>
.k2-solo{display:flex;align-items:center;gap:8px;margin-right:14px}
.k2s-seg{display:flex;border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden}
.k2s-seg button{height:30px;padding:0 14px;font:700 11px/1 var(--font);letter-spacing:.14em;color:var(--k2-ink2,#aaa);background:none;border:0;cursor:pointer}
.k2s-seg button.on{background:var(--acid,#E4FF3A);color:#0d0d10}
.k2s-bars{height:30px;padding:0 8px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:var(--k2-ink,#eee);font:500 12px var(--font)}
.k2s-bars option{background:#26272b;color:#ececee}
.k2s-play{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:var(--acid,#E4FF3A);background:none;border:1px solid rgba(255,255,255,.1);cursor:pointer}
.k2s-play svg{fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round}
.k2s-play.on{background:var(--acid,#E4FF3A);color:#0d0d10}
.k2s-play.on svg path{d:path("M4 4h8v8H4z");fill:currentColor}
/* one switch: TOY MACHINE's own SOLO|FULL hides inside the lane window */
#iw .tm-pmode{display:none!important}
</style>`);
})();
