// KILLTOY 2: the logo opens PREFERENCES (Eman, 31 Oct), a window with tabs like Ableton's, not
// the projects page (that's the song name at the top, or P). Audio, Look and More are the app's
// own settings moved into tabs; API is new: keys for the services the app can talk to, saved on
// this computer only (never in the song). Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const html = document.documentElement;
  if (!html.classList.contains("kt2")) return;
  const box = $("settings");
  if (!box) return;

  // ---- the window: side tabs, one pane each
  const audioRows = $("audio-rows"), moreRows = $("more-rows"), bgGrid = $("bg-grid"), colorRow = $("color-row"), lookSliders = $("look-sliders");
  box.replaceChildren();
  box.classList.add("k2-prefs");
  const side = el("div", "k2p-side");
  side.append(el("div", "k2p-title", "PREFERENCES"));
  const panes = {};
  const TABS = [["audio", "Audio"], ...(window.KT2_MIDI_OFF ? [] : [["midi", "MIDI"]]), ["look", "Look"], ["api", "API"], ["more", "More"]];   // MIDI: ui/kt2-midi.js (KT2_MIDI_OFF = old)
  // Look is the first tab and opens first (Eman, 12 Nov). KT2_PREFS_LOOK_OLD = old order, Audio first.
  if (!window.KT2_PREFS_LOOK_OLD) TABS.unshift(...TABS.splice(TABS.findIndex((t) => t[0] === "look"), 1));
  let cur = TABS[0][0];
  for (const [id, name] of TABS) {
    const b = el("button", id === cur ? "on" : "", name);
    b.dataset.tab = id;
    b.onclick = (e) => { e.stopPropagation(); show(id); };
    side.append(b);
    const p = el("div", "k2p-pane");
    p.dataset.pane = id;
    p.hidden = id !== cur;
    panes[id] = p;
  }
  const close = el("button", "k2p-close", "×");
  close.title = "Close (Esc)";
  close.onclick = (e) => { e.stopPropagation(); toggleSettings(false); };
  box.append(side, ...Object.values(panes), close);
  function show(id) {
    cur = id;
    side.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== id;
    if (id === "api") renderApi();
    if (id === "midi" && window.KT2Midi) KT2Midi.pane(panes.midi);
  }

  panes.audio.append(el("div", "k2p-h", "Audio"), audioRows);
  panes.look.append(el("div", "k2p-h", "Look"), el("div", "k2p-sub", "The background behind the song"), bgGrid, colorRow, lookSliders);
  // A big preview of the picture at the top, framed like the song grid: press and drag it up/down
  // to pick which part of the picture sits behind the grid (Eman, 12 Nov). Saved per picture on
  // this computer. KT2_BG_POS_OLD = old: no preview, picture centred on the whole window.
  if (!window.KT2_BG_POS_OLD) bgPosSetup(panes.look, bgGrid);
  panes.more.append(el("div", "k2p-h", "More"), moreRows);
  panes.api.append(el("div", "k2p-h", "API"), el("div", "k2p-sub", "Keys for the services KILLTOY can talk to. They stay on this computer and never go into a song."));
  const apiList = el("div", "k2p-list");
  panes.api.append(apiList);

  // ---- API: the built-in services, then any key Eman adds himself
  const store = {
    get: (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };
  const CUSTOM = "killtoy.apiKeys";
  const custom = () => { try { return JSON.parse(store.get(CUSTOM) || "[]"); } catch (e) { return []; } };
  const saveCustom = (list) => store.set(CUSTOM, list.length ? JSON.stringify(list) : "");
  const onWeb = !!window.purpPlayground;

  function keyRow(name, note, value, save, extra) {
    const row = el("div", "k2p-row");
    const lab = el("div", "k2p-lab");
    lab.append(el("b", null, name), el("span", null, note || ""));
    const input = el("input");
    input.type = /address|url/i.test(note || "") ? "text" : "password";
    input.placeholder = input.type === "password" ? "paste the key" : "";
    input.value = value || "";
    input.onclick = (e) => e.stopPropagation();
    input.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") { input.blur(); } if (e.key === "Escape") toggleSettings(false); };
    input.onchange = () => { save(input.value.trim()); toast(input.value.trim() ? `Saved the ${name} key.` : `Removed the ${name} key.`); };
    const state = el("i", "k2p-dot" + (value ? " on" : ""));
    state.title = value ? "Saved" : "Not set";
    input.addEventListener("input", () => state.classList.toggle("on", !!input.value.trim()));
    row.append(lab, input, state);
    if (extra) row.append(extra);
    return row;
  }

  function renderApi() {
    apiList.replaceChildren();
    apiList.append(keyRow("Claude", onWeb ? "not needed here: the page uses claude.ai's Claude" : "Anthropic key for the talking avatar", store.get("killtoy.anthropicKey"), (v) => store.set("killtoy.anthropicKey", v)));
    apiList.append(keyRow("ElevenLabs", "voices, for later", store.get("killtoy.elevenLabsKey"), (v) => store.set("killtoy.elevenLabsKey", v)));
    const ace = keyRow("ACE-Step", "address of the server (Send to AI)", (ui.state && ui.state.ai && ui.state.ai.aceStepUrl) || "", (v) => v && run("setAiSettings", { aceStepUrl: v }));
    ace.querySelector("input").type = "text";
    apiList.append(ace);
    for (const [i, k] of custom().entries()) {
      const del = el("button", "k2p-del", "×");
      del.title = "Remove it";
      del.onclick = (e) => { e.stopPropagation(); const l = custom(); l.splice(i, 1); saveCustom(l); renderApi(); };
      apiList.append(keyRow(k.name, "your own", k.key, (v) => { const l = custom(); l[i].key = v; saveCustom(l); }, del));
    }
    // add one: a name, then the key
    const add = el("div", "k2p-add");
    const name = el("input"); name.placeholder = "Service name (Suno, OpenAI...)"; name.type = "text";
    const key = el("input"); key.placeholder = "its key"; key.type = "password";
    for (const inp of [name, key]) { inp.onclick = (e) => e.stopPropagation(); inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") go(); if (e.key === "Escape") toggleSettings(false); }; }
    const btn = el("button", "k2p-addbtn", "+ Add");
    const go = () => {
      const n = name.value.trim(), k = key.value.trim();
      if (!n) { name.focus(); return; }
      const l = custom().filter((x) => x.name.toLowerCase() !== n.toLowerCase());
      l.push({ name: n, key: k }); saveCustom(l); renderApi(); toast(`Added ${n}.`);
    };
    btn.onclick = (e) => { e.stopPropagation(); go(); };
    add.append(name, key, btn);
    apiList.append(add);
  }
  function bgPosSetup(pane, before) {
    const KEY = "killtoy.bgPos";
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
    const write = (m) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* private mode */ } };
    let pos = read();
    const sizes = {};   // url -> [w, h] once loaded
    const frame = el("div", "k2-bgpos");
    frame.title = "Drag up or down to choose the part behind the grid. Double-click = middle.";
    const pic = el("div", "k2-bgpos-pic");
    frame.append(pic);
    pane.insertBefore(frame, before);

    const bgEl = () => $("bg");
    const urlOf = () => { const m = /url\(["']?(.*?)["']?\)$/.exec((bgEl() && bgEl().style.backgroundImage) || ""); return m ? m[1] : ""; };
    const look = () => (typeof currentLook === "function" ? currentLook() : {});
    const isPic = () => document.body.classList.contains("look-image") && !!urlOf();
    const keyOf = () => String(look().image || urlOf());
    const getP = () => { const v = pos[keyOf()]; return typeof v === "number" ? Math.min(1, Math.max(0, v)) : 0.5; };

    // The picture covers the grid: as wide as the window, at least as tall as the grid, and the
    // saved 0..1 slides it so that part of it lines up with the grid.
    // The part of the grid the picture shows through: #scroll minus the solid ruler row on top.
    function gridRect(g) {
      const r = g.getBoundingClientRect(), tr = g.querySelector(".toprow");
      const top = tr && !window.KT2_BARS_GLASS_OLD ? Math.min(r.bottom, Math.max(r.top, tr.getBoundingClientRect().bottom)) : r.top;
      // ...and minus the solid bottom panel when it sits over the grid
      const rk = document.querySelector(".rack"), R = rk && rk.offsetParent ? rk.getBoundingClientRect() : null;
      const bottom = R && R.height > 0 && R.top > top + 40 && R.top < r.bottom ? R.top : r.bottom;
      return { left: r.left, top, width: r.width, height: bottom - top, bottom };
    }
    function seeThrough() {
      if (window.KT2_BG_FILL_OLD || !window.KT2Panels || !document.documentElement.classList.contains("k2-pn")) return false;
      const o = Number(KT2Panels.get().opacity);
      return o < 100;
    }
    function layout() {
      const b = bgEl(), g = $("scroll"), url = urlOf();
      if (!b || !g || !url) return null;
      const sz = sizes[url];
      if (!sz) {
        if (sz === undefined) {
          sizes[url] = null;
          const im = new Image();
          im.onload = () => { sizes[url] = [im.naturalWidth || 1, im.naturalHeight || 1]; apply(); };
          im.src = url;
        }
        return null;
      }
      const B = b.getBoundingClientRect(), G = gridRect(g);
      if (G.width < 20 || G.height < 20 || B.width < 20) return null;
      // See-through panels (LOOK > PANELS opacity under 100%): the picture shows behind the bars
      // too, so it must cover the whole window and never leave dark strips top or bottom.
      // Flag KT2_BG_FILL_OLD = old (fits the grid only).
      if (seeThrough()) {
        const s = Math.max(B.width / sz[0], B.height / sz[1]);
        const Iw = sz[0] * s, Ih = sz[1] * s, p = getP();
        const yB = -(Ih - B.height) * p, yG = yB - (G.top - B.top);
        return { B, G, Iw, Ih, xB: (B.width - Iw) / 2, yB, xG: (B.width - Iw) / 2 + B.left - G.left, yG, room: Ih - B.height, full: true };
      }
      const s = Math.max(B.width / sz[0], G.height / sz[1]);
      const Iw = sz[0] * s, Ih = sz[1] * s, p = getP();
      const yG = -(Ih - G.height) * p;
      return { B, G, Iw, Ih, xB: (B.width - Iw) / 2, yB: G.top - B.top + yG, xG: (B.width - Iw) / 2 + B.left - G.left, yG, room: Ih - G.height };
    }

    function apply() {
      const b = bgEl();
      if (!b) return;
      const L = isPic() ? layout() : null;
      if (L) {
        b.style.backgroundSize = `${L.Iw.toFixed(1)}px ${L.Ih.toFixed(1)}px`;
        b.style.backgroundPosition = `${L.xB.toFixed(1)}px ${L.yB.toFixed(1)}px`;
      } else if (!isPic()) { b.style.backgroundSize = ""; b.style.backgroundPosition = ""; }
      drawPreview(L);
    }

    function drawPreview(L) {
      frame.hidden = !isPic();
      if (frame.hidden || box.hidden) return;
      const g = $("scroll"), G = g && gridRect(g);
      const ar = G && G.width > 20 && G.height > 20 ? G.width / G.height : 16 / 6;
      const w = frame.parentNode ? Math.max(200, frame.parentNode.clientWidth - 56) : 520;
      const h = Math.min(300, Math.max(80, w / ar));
      frame.style.height = `${Math.round(h)}px`;
      frame.style.width = `${Math.round(Math.min(w, h * ar))}px`;
      pic.style.backgroundImage = `url("${urlOf()}")`;
      if (!L) { pic.style.backgroundSize = "cover"; pic.style.backgroundPosition = "center"; return; }
      const k = frame.clientWidth / L.G.width;
      pic.style.backgroundSize = `${(L.Iw * k).toFixed(1)}px ${(L.Ih * k).toFixed(1)}px`;
      pic.style.backgroundPosition = `${(L.xG * k).toFixed(1)}px ${(L.yG * k).toFixed(1)}px`;
      frame.classList.toggle("stuck", L.room < 1);
    }

    let drag = null;
    frame.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const L = layout();
      if (!L || L.room < 1) return;
      e.preventDefault(); e.stopPropagation();
      frame.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, p: getP(), per: (L.G.width / frame.clientWidth) / L.room };
      frame.classList.add("drag");
    });
    frame.addEventListener("pointermove", (e) => {
      if (!drag) return;
      pos[keyOf()] = Math.min(1, Math.max(0, drag.p - (e.clientY - drag.y) * drag.per));
      apply();
    });
    const end = () => { if (!drag) return; drag = null; frame.classList.remove("drag"); write(pos); };
    frame.addEventListener("pointerup", end);
    frame.addEventListener("pointercancel", end);
    frame.addEventListener("click", (e) => e.stopPropagation());
    frame.addEventListener("dblclick", (e) => { e.stopPropagation(); delete pos[keyOf()]; write(pos); apply(); });

    window.KT2BgPos = { apply, layout, get: () => ({ ...pos }) };
    let raf = 0;
    const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; apply(); }); };
    window.addEventListener("resize", later);
    const g = $("scroll");
    if (g && window.ResizeObserver) new ResizeObserver(later).observe(g);
    new MutationObserver(later).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(later).observe(box, { attributes: true, attributeFilter: ["hidden"] });
    later();
  }

  window.killtoyApiKeys = { get: (name) => (custom().find((x) => x.name.toLowerCase() === String(name).toLowerCase()) || {}).key || "" };

  // ---- open from the logo; the More tab loses the two rows the API tab now holds
  const _toggle = toggleSettings;
  window.toggleSettings = toggleSettings = function (force) {
    _toggle.apply(this, arguments);
    if (box.hidden) return;
    moreRows.querySelectorAll(".set-item").forEach((b) => { if (/^(Claude key|ACE-Step address)/.test(b.textContent)) b.remove(); });
    if (cur === "api") renderApi();
  };
  // Logo = back to the PROJECTS page; PREFERENCES moved to the three-line button at the far right
  // of the header (Eman, 1 Nov). Square bars, no rounded ends.
  $("logo").onclick = (e) => { e.stopPropagation(); toggleSettings(false); showHome(true); };
  $("logo").title = "All projects";
  const menu = document.createElement("button");
  menu.id = "k2-hmenu"; menu.className = "k2-hmenu"; menu.title = "Preferences";
  menu.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="butt"/></svg>`;
  menu.onclick = (e) => { e.stopPropagation(); toggleSettings(); };
  const top = document.querySelector("header.top");
  if (top) top.append(menu);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.hidden) { toggleSettings(false); e.stopImmediatePropagation(); } }, true);
})();
