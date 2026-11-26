// TOY VOX in KILLTOY 2 (Eman, 24 Nov 2026): the vocal FX that sits on every new recording, MUTED until you
// turn it on or pick a preset. Glue between the window (ui/toyvox.js), the card (p.tv on a kttoyvox effect,
// muted = the card's own power off) and the engine (playground/toyvox-engine.js + toyvox.wasm).
// KT2_TOYVOX_OFF = not offered at all. KT2_TOYVOX_AUTO_OFF = recordings start with no effects, as before.
// ASCII only.
(function () {
  "use strict";
  if (window.KT2_TOYVOX_OFF) return;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // a new TOY VOX state, in the song's key
  function fresh(key) {
    const S = window.ToyVoxUI ? ToyVoxUI.defaults() : { on: false, v: {} };
    if (key && key.tonic != null) { S.v.key = key.tonic; S.v.scale = key.minor ? 1 : 0; }
    return S;
  }
  // the window's state -> engine settings (ids in Source/dsp/toyvox/ToyVoxParams.h)
  function values(S) {
    const v = Object.assign({}, window.ToyVoxUI ? ToyVoxUI.DEF : {}, (S && S.v) || {});
    v.bypass = 0;   // muted = the card's power is off, so the engine isn't even built
    return v;
  }

  // the card's 3 knobs: XY (left/right), XY (up/down), Mix
  const pct = (v) => Math.round(v * 100) + "%";
  function cardSet(p, node, pid, v) {
    const S = p.tv || (p.tv = fresh());
    if (pid === "x") { S.v["xy.x"] = v * 2 - 1; node.set("xy.x", S.v["xy.x"]); return Math.round(S.v["xy.x"] * 100) + ""; }
    if (pid === "y") { S.v["xy.y"] = v * 2 - 1; node.set("xy.y", S.v["xy.y"]); return Math.round(S.v["xy.y"] * 100) + ""; }
    if (pid === "mix") { S.v.mix = v; node.set("mix", v); return pct(v); }
    return null;
  }
  function syncCard(p) {
    const S = p.tv;
    if (!S || !p.params) return;
    for (const q of p.params) {
      if (q.id === "x") { q.value = ((S.v["xy.x"] || 0) + 1) / 2; q.text = Math.round((S.v["xy.x"] || 0) * 100) + ""; }
      if (q.id === "y") { q.value = ((S.v["xy.y"] || 0) + 1) / 2; q.text = Math.round((S.v["xy.y"] || 0) * 100) + ""; }
      if (q.id === "mix") { q.value = S.v.mix == null ? 1 : S.v.mix; q.text = pct(q.value); }
    }
    p.preset = S.preset || null;
  }
  const params = () => [
    { id: "x", name: "Dark/Bright", value: 0.5, text: "0", def: 0.5 },
    { id: "y", name: "Dirt/Space", value: 0.5, text: "0", def: 0.5 },
    { id: "mix", name: "Mix", value: 1, text: "100%", def: 1 },
  ];
  // the plugin a new recording gets: TOY VOX, muted
  function plugin(newId, key) {
    const p = { id: newId(), name: "TOY VOX", type: "kttoyvox", enabled: false, params: params(), tv: fresh(key) };
    syncCard(p);
    return p;
  }

  // ------------------------------------------------------------------ the window
  let open_ = null;
  function close() {
    if (!open_) return;
    clearInterval(open_.timer);
    open_.win.destroy();
    open_.host.remove();
    document.removeEventListener("keydown", open_.esc, true);
    open_ = null;
  }
  const find = (pid) => { try { return findPlugin(pid); } catch (e) { return null; } };
  function open(p) {
    if (!window.ToyVoxUI) return null;
    close();
    const pid = p.id;
    const hit = find(pid);
    const plug = (hit && hit.p) || p;
    if (!plug.tv) plug.tv = fresh(ui && ui.state && ui.state.key);
    const host = document.createElement("div");
    host.className = "tv-host";
    const box = document.createElement("div");
    box.className = "tv-box";
    host.append(box);
    host.addEventListener("mousedown", (e) => { if (e.target === host) close(); });
    document.body.append(host);
    let meter = null, saveT = 0, liveQ = 0;
    const state = clone(plug.tv);
    state.on = !!plug.enabled;
    const push = (save, enabled) => booth("setToyVox", { pluginId: pid, tv: win.state, save, enabled });
    const api = {
      set: () => {   // many sets in one go (a preset) = one push
        if (!liveQ) liveQ = requestAnimationFrame(() => { liveQ = 0; push(false); });
        clearTimeout(saveT); saveT = setTimeout(() => push(true), 400);
      },
      commit: () => { clearTimeout(saveT); push(true); },
      power: (on) => push(true, !!on),
      meter: () => meter,
      close,
    };
    const win = ToyVoxUI.open(box, { state, api });
    const timer = setInterval(async () => { const m = await booth("toyVoxMeter", { pluginId: pid }); meter = m && m.ok ? m : null; }, 33);
    const esc = (e) => { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector(".tv-menu")) { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", esc, true);
    open_ = { host, win, timer, esc, pid };
    if (win.root) win.root.focus();
    return win;
  }

  const css = document.createElement("style");
  css.textContent = ".tv-host{position:fixed;inset:0;z-index:100000;background:rgba(8,8,10,.55);display:grid;place-items:center}" +
    ".tv-box{width:min(1040px,96vw);height:min(640px,92vh);box-shadow:0 30px 90px rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.08)}";
  document.head.append(css);

  window.KT2ToyVox = { fresh, values, cardSet, syncCard, params, plugin, open, close };
})();
