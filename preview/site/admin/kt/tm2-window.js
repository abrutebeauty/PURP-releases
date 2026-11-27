// TOY MACHINE V2 window (26 Nov): the first cut of V2's own screen in the KILLTOY 2 DAW.
// Shows the preset, loads any .SerumPreset (button or drop), INIT SAW, and a small keyboard to try it.
// V1's panels (macros, filter, space...) wired to the Serum 2 tree come next (docs/toymachine2/SPEC.md phase 4).
// Opened by app.js when openPlugin answers toyMachine2 (playground.js); shares tmWin like TOY GTR.
(function () {
  const CSS = `
.tm2w { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; background: #131218; color: #ecebf0; font: 12px/1.4 Inter, "Helvetica Neue", Arial, sans-serif; min-height: 260px; outline: none; }
.tm-host > .tm2w { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(760px, calc(100vw - 32px)); box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
.tm2w .hd { display: flex; align-items: center; gap: 12px; }
.tm2w .logo { font: 800 22px/1 "Big Shoulders Display", "Arial Narrow", sans-serif; letter-spacing: 0.04em; }
.tm2w .logo i { font-style: normal; color: #9b6bff; }
.tm2w .tag { font: 700 9px Inter, sans-serif; letter-spacing: 0.14em; color: #8d8a99; }
.tm2w .x { margin-left: auto; appearance: none; border: 0; background: #1f1d27; color: #8d8a99; font: 700 11px "JetBrains Mono", monospace; width: 26px; height: 26px; cursor: pointer; }
.tm2w .pr { display: flex; align-items: center; gap: 10px; background: #1a1922; padding: 14px 16px; }
.tm2w .pr .dot { width: 8px; height: 8px; border-radius: 50%; background: #E4FF3A; box-shadow: 0 0 8px rgba(228,255,58,0.35); flex: none; }
.tm2w .pr .nm { font: 800 26px/1 "Big Shoulders Display", "Arial Narrow", sans-serif; letter-spacing: 0.03em; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.tm2w .pr .src { margin-left: auto; font: 500 10px "JetBrains Mono", monospace; color: #8d8a99; white-space: nowrap; }
.tm2w .row { display: flex; gap: 6px; flex-wrap: wrap; }
.tm2w .b { appearance: none; border: 0; border-radius: 0; background: #1f1d27; color: #ecebf0; font: 700 10px Inter, sans-serif; letter-spacing: 0.12em; padding: 9px 14px; cursor: pointer; text-transform: uppercase; }
.tm2w .b.main { background: #9b6bff; color: #fff; }
.tm2w .msg { font: 500 10px "JetBrains Mono", monospace; color: #8d8a99; min-height: 14px; }
.tm2w .msg.bad { color: #d42a24; }
.tm2w.drag::after { content: "DROP .SERUMPRESET"; position: absolute; inset: 0; display: grid; place-items: center; background: rgba(155,107,255,0.18); font: 800 28px "Big Shoulders Display", sans-serif; letter-spacing: 0.06em; color: #ecebf0; pointer-events: none; }
.tm2w .kb { position: relative; height: 64px; display: flex; user-select: none; touch-action: none; }
.tm2w .kb .w { flex: 1; background: #d9d6e0; margin-right: 1px; cursor: pointer; }
.tm2w .kb .w.on, .tm2w .kb .k.on { background: #9b6bff; }
.tm2w .kb .k { position: absolute; top: 0; height: 60%; background: #0b0a0e; cursor: pointer; z-index: 1; }
`;
  function style() { if (document.getElementById("tm2w-css")) return; const s = document.createElement("style"); s.id = "tm2w-css"; s.textContent = CSS; document.head.append(s); }
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  async function openToyMachine2(p, into, wanted = () => true) {
    const pid = p.id;
    const got = await run("toyMachineGetPreset", { pluginId: pid });
    if (!got || got.error || !wanted()) return;
    if (typeof closeToyMachine === "function") closeToyMachine();
    style();
    const host = el("div", into ? "iw-tm" : "tm-host");
    if (!into) host.addEventListener("mousedown", (e) => { if (e.target === host) closeToyMachine(); });
    (into || document.body).append(host);
    const root = el("div", "tm2w"); root.tabIndex = 0; host.append(root);
    let preset = got.preset && window.TM2Web && TM2Web.isTm2(got.preset) ? got.preset : TM2Web.preset(TM2Web.DEFAULT);

    const hd = el("div", "hd"), logo = el("div", "logo"); logo.innerHTML = "TOY MACHINE <i>V2</i>";
    const x = el("button", "x", "X"); x.setAttribute("aria-label", "Close");
    x.onclick = () => (into ? typeof tmWin !== "undefined" && tmWin && tmWin.pid === pid && closeLaneWindow() : closeToyMachine());
    hd.append(logo, el("span", "tag", "SERUM 2 PRESETS"), x);
    const pr = el("div", "pr"), nm = el("div", "nm"), src = el("div", "src");
    pr.append(el("span", "dot"), nm, src);
    const show = () => { nm.textContent = preset.name || "Init Saw"; src.textContent = preset.tree && preset.tree.tm2 && preset.tree.tm2.from === "SerumPreset" ? ".SERUMPRESET" : "INIT"; };
    show();
    const msg = el("div", "msg");
    const say = (t, bad) => { msg.textContent = t || ""; msg.classList.toggle("bad", !!bad); };
    const setP = async (np) => { preset = np; show(); await run("toyMachineSetPreset", { pluginId: pid, preset: np }); };

    const file = el("input"); file.type = "file"; file.accept = ".SerumPreset"; file.hidden = true;
    const loadFile = async (f) => {
      if (!f) return;
      if (!/\.serumpreset$/i.test(f.name)) return say("That's not a .SerumPreset file", true);
      say("Loading " + f.name);
      try { const np = await TM2Web.fromSerumPreset(await f.arrayBuffer(), f.name.replace(/\.serumpreset$/i, "")); await setP(np); say(""); }
      catch (e) { say("Couldn't read that preset (" + (e && e.message || "error") + ")", true); }
    };
    file.onchange = () => loadFile(file.files && file.files[0]);
    const row = el("div", "row");
    const bLoad = el("button", "b main", "Load .SerumPreset"); bLoad.onclick = () => file.click();
    const bInit = el("button", "b", "Init Saw"); bInit.onclick = () => { setP(TM2Web.preset(TM2Web.DEFAULT)); say(""); };
    row.append(bLoad, bInit, file);
    root.addEventListener("dragover", (e) => { e.preventDefault(); root.classList.add("drag"); });
    root.addEventListener("dragleave", (e) => { if (e.target === root) root.classList.remove("drag"); });
    root.addEventListener("drop", (e) => { e.preventDefault(); root.classList.remove("drag"); loadFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });

    // two octaves from C3 to try the sound
    const kb = el("div", "kb"), send = (cmd, args) => booth(cmd, { pluginId: pid, ...args });
    const LO = 48, WHITE = [0, 2, 4, 5, 7, 9, 11], whites = [];
    for (let n = LO; n < LO + 25; n++) if (WHITE.includes(n % 12)) whites.push(n);
    const keyEls = new Map();
    whites.forEach((n) => { const w = el("div", "w"); w.dataset.n = n; kb.append(w); keyEls.set(n, w); });
    const ww = 100 / whites.length;
    for (let n = LO; n < LO + 25; n++) if (!WHITE.includes(n % 12)) {
      const k = el("div", "k"); k.dataset.n = n; const left = whites.indexOf(n - 1); k.style.left = ((left + 1) * ww - ww * 0.3) + "%"; k.style.width = (ww * 0.6) + "%"; kb.append(k); keyEls.set(n, k);
    }
    let held = null;
    const up = () => { if (held == null) return; send("toyMachineNote", { pitch: held, on: false }); keyEls.get(held).classList.remove("on"); held = null; };
    kb.addEventListener("pointerdown", (e) => { const n = +(e.target.dataset && e.target.dataset.n); if (!n) return; up(); held = n; e.target.classList.add("on"); send("toyMachineNote", { pitch: n, velocity: 100, on: true }); });
    window.addEventListener("pointerup", up);

    root.append(hd, pr, row, msg, kb);
    tmWin = { pid, host, win: { root }, meterTimer: 0 };   // eslint-disable-line no-global-assign
    root.focus({ preventScroll: true });
  }
  window.openToyMachine2 = openToyMachine2;
})();
