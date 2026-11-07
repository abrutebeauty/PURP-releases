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
  const TABS = [["audio", "Audio"], ["look", "Look"], ["api", "API"], ["more", "More"]];
  let cur = "audio";
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
  }

  panes.audio.append(el("div", "k2p-h", "Audio"), audioRows);
  panes.look.append(el("div", "k2p-h", "Look"), el("div", "k2p-sub", "The background behind the song"), bgGrid, colorRow, lookSliders);
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
