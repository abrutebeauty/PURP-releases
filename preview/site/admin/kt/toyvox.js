// TOY VOX window (Eman, 24 Nov 2026): KILLTOY's vocal preset rack. It sits on every recording switched off;
// one click turns it on, one click picks a preset. Twin = TOY MACHINE (ui/toymachine.js): same top bar, rail,
// big disc and side sliders + pills.
//   PLAY   presets (by pack) | the XY circle (drag: left darker, right brighter, up bigger, down dirtier) |
//          PITCH / FORMANT / TUNE sliders + HEAT AIR DIRT WIDE ECHO HALL pills
//   CHAIN  every block with every knob
// Bottom: the chain strip (click a block = CHAIN page at that block) and the ROOM meter: your level against the
// mic's learned room tone; DIRT only plays past the line.
//
//   const w = ToyVoxUI.open(host, { state, api })
//   state = { on, pack, preset, v: { "boy.pitch": -5, ... } }   (ids from Source/dsp/toyvox/ToyVoxParams.h)
//   api.set(id, value)     one setting changed (live)
//   api.power(on)          the big switch
//   api.commit()           a drag or click ended (one undo step)
//   api.meter()            -> { level, floor, dirt, comp, hush, in, out } or null
//   api.close()
// ASCII only.
(function () {
  "use strict";

  // engine defaults (keep in step with ToyVoxParams.h)
  const DEF = {
    bypass: 0, mix: 1, out: 0, "xy.x": 0, "xy.y": 0, key: 9, scale: 1,
    "tune.on": 1, "tune.speed": 0.92, "tune.human": 0.1,
    "boy.on": 0, "boy.pitch": 0, "boy.formant": 0, "boy.mix": 1,
    "hush.on": 1, "hush.amount": 0.4,
    "eq.on": 1, "eq.low": 0.35, "eq.mud": 0.4, "eq.presence": 0.55, "eq.air": 0.55,
    "comp.on": 1, "comp.punch": 0.5, "comp.level": 0.4, "comp.deess": 0.4,
    "heat.on": 0, "heat.amount": 0.3, "heat.kind": 0, "heat.tone": 0.5,
    "air.on": 1, "air.mid": 0.3, "air.high": 0.4,
    "dirt.on": 0, "dirt.amount": 0.3, "dirt.kind": 0, "dirt.sense": 0.5,
    "wide.on": 0, "wide.amount": 0.25, "wide.rate": 0.3,
    "echo.on": 1, "echo.mix": 0.18, "echo.time": 3, "echo.feedback": 0.25, "echo.tone": 0.5, "echo.trig": 0,
    "hall.on": 1, "hall.mix": 0.18, "hall.size": 0.7, "hall.tone": 0.6, "hall.lowcut": 0.5,
    "tune.live": 0, "choir.on": 0, "choir.mode": 1, "choir.voices": 2, "choir.mix": 0.4,
  };

  // The PLAYBOI pack: our own settings, rebuilt from the chains in public tutorials (analysed 24 Nov 2026,
  // see docs/TOYVOX.md). "Inspired by", not anyone's preset file.
  const CARTI = {
    "tune.on": 1, "tune.speed": 0.98, "tune.human": 0.04, "hush.amount": 0.5,
    "eq.low": 0.42, "eq.mud": 0.5, "eq.presence": 0.62, "eq.air": 0.56,
    "comp.punch": 0.68, "comp.level": 0.45, "comp.deess": 0.45, "air.mid": 0.32, "air.high": 0.46,
    "echo.on": 1, "echo.time": 3, "echo.mix": 0.14, "echo.feedback": 0.2, "echo.tone": 0.55,
    "hall.on": 1, "hall.mix": 0.16, "hall.size": 0.82, "hall.tone": 0.66, "hall.lowcut": 0.62,
  };
  const P = (o) => Object.assign({}, CARTI, o);
  const PACKS = [
    { name: "PLAYBOI", color: "#ff3b4e", presets: [
      { name: "DEEP", tag: "-5 ST", v: P({ "boy.on": 1, "boy.pitch": -5, "boy.formant": -4, "heat.on": 1, "heat.kind": 0, "heat.amount": 0.22, "wide.on": 1, "wide.amount": 0.14 }) },
      { name: "ALL RED", tag: "-5 ST", v: P({ "boy.on": 1, "boy.pitch": -5, "boy.formant": -3, "heat.on": 1, "heat.kind": 1, "heat.amount": 0.38, "dirt.on": 1, "dirt.kind": 0, "dirt.amount": 0.16, "hall.mix": 0.12 }) },
      { name: "TUNDRA", tag: "-3 ST", v: P({ "boy.on": 1, "boy.pitch": -3, "boy.formant": -2, "wide.on": 1, "wide.amount": 0.18, "wide.rate": 0.25, "echo.mix": 0.16, "hall.mix": 0.2 }) },
      { name: "VOICE HACK", tag: "-4 ST", v: P({ "boy.on": 1, "boy.pitch": -4, "boy.formant": 0, "tune.speed": 0.94, "hall.mix": 0.14 }) },
      { name: "RAGE", tag: "HEAT", v: P({ "heat.on": 1, "heat.kind": 3, "heat.amount": 0.55, "heat.tone": 0.55, "dirt.on": 1, "dirt.kind": 0, "dirt.amount": 0.2, "comp.punch": 0.74, "air.high": 0.5, "hall.mix": 0.2, "hall.size": 0.62 }) },
      { name: "MELO", tag: "CLEAN", v: P({ "tune.speed": 0.95, "heat.on": 1, "heat.kind": 1, "heat.amount": 0.24, "comp.punch": 0.45, "comp.level": 0.6, "echo.time": 1, "echo.mix": 0.16, "hall.mix": 0.22 }) },
      { name: "BABY", tag: "+3 ST", v: P({ "boy.on": 1, "boy.pitch": 3, "boy.formant": 3, "heat.on": 1, "heat.kind": 2, "heat.amount": 0.28, "wide.on": 1, "wide.amount": 0.22, "air.high": 0.55 }) },
      { name: "ADLIBS", tag: "THROW", v: P({ "boy.on": 1, "boy.pitch": -5, "boy.formant": -4, "eq.low": 0.62, "wide.on": 1, "wide.amount": 0.4, "echo.mix": 0.34, "echo.trig": 1, "echo.feedback": 0.32, "hall.mix": 0.26 }) },
    ] },
    { name: "BASIC", color: "#8b5cf6", presets: [
      { name: "CLEAN LEAD", tag: "", v: { "tune.speed": 0.6, "tune.human": 0.3, "comp.punch": 0.4, "comp.level": 0.5, "echo.mix": 0.12, "hall.mix": 0.16 } },
      { name: "RAW", tag: "DRY", v: { "tune.on": 0, "comp.punch": 0.35, "comp.level": 0.3, "air.mid": 0.2, "air.high": 0.25, "echo.on": 0, "hall.on": 0 } },
      { name: "LIVE TUNE", tag: "6 MS", v: { "tune.live": 1, "tune.speed": 1, "tune.human": 0, "echo.mix": 0.12, "hall.mix": 0.14 } },
      { name: "STACKED", tag: "CHOIR", v: { "tune.speed": 0.9, "choir.on": 1, "choir.mode": 4, "choir.voices": 4, "choir.mix": 0.45, "wide.on": 1, "wide.amount": 0.3, "hall.mix": 0.24 } },
      { name: "LOFI TAPE", tag: "DIRT", v: { "tune.speed": 0.7, "heat.on": 1, "heat.kind": 0, "heat.amount": 0.45, "heat.tone": 0.3, "dirt.on": 1, "dirt.kind": 1, "dirt.amount": 0.45, "air.on": 0, "hall.mix": 0.2 } },
    ] },
  ];
  const presetValues = (pr) => Object.assign({}, DEF, pr.v);

  const pct = (v) => Math.round(v * 100) + "%";
  const st = (v) => (v > 0 ? "+" : "") + (Math.round(v * 10) / 10) + " st";
  const TRIGS = ["ALWAYS", "GAPS", "ENDS", "DUCK"];
  const TIMES = ["1/16", "1/8", "1/8.", "1/4", "1/4.", "1/2"];
  const HEATS = ["TAPE", "TUBE", "FUZZ", "RAGE"];
  const DIRTS = ["TAPE HISS", "VINYL", "RADIO", "BREATH", "CRUSH"];
  const MODES = ["STUDIO", "LIVE"];
  const CHOIRS = ["DOUBLE", "THIRDS", "POWER", "OCTAVES", "GOSPEL", "ANGEL", "DARK", "CHORDS"];
  // each block of the chain: [key, name, colour, knobs [id, label, min, max, text, steps?]]
  const BLOCKS = [
    ["tune", "TUNE", "#e4ff3a", [["tune.speed", "SPEED", 0, 1, (v) => (v >= 0.97 ? "HARD" : Math.round(400 * Math.pow(10, -2.6 * v)) + "ms")], ["tune.human", "HUMAN", 0, 1, pct], ["tune.live", "MODE", 0, 1, null, MODES]]],
    ["boy", "TOY BOY", "#ff6bd6", [["boy.pitch", "PITCH", -12, 12, st], ["boy.formant", "FORMANT", -12, 12, st], ["boy.mix", "MIX", 0, 1, pct]]],
    ["choir", "CHOIR", "#ffd166", [["choir.mix", "MIX", 0, 1, pct], ["choir.voices", "VOICES", 1, 8, (v) => Math.round(v) + ""], ["choir.mode", "KIND", 0, 7, null, CHOIRS]]],
    ["hush", "HUSH", "#7fd1ff", [["hush.amount", "AMOUNT", 0, 1, pct]]],
    ["eq", "EQ", "#9fe870", [["eq.low", "LOW CUT", 0, 1, (v) => Math.round(40 + v * v * 360) + "Hz"], ["eq.mud", "MUD", 0, 1, (v) => "-" + (v * 8).toFixed(1) + "dB"], ["eq.presence", "PRESENCE", 0, 1, (v) => ((v - 0.5) * 16).toFixed(1) + "dB"], ["eq.air", "AIR", 0, 1, (v) => ((v - 0.5) * 18).toFixed(1) + "dB"]]],
    ["comp", "PUNCH", "#ffb03a", [["comp.punch", "PUNCH", 0, 1, pct], ["comp.level", "LEVEL", 0, 1, pct], ["comp.deess", "DE-ESS", 0, 1, pct]]],
    ["heat", "HEAT", "#ff7a3a", [["heat.amount", "AMOUNT", 0, 1, pct], ["heat.tone", "TONE", 0, 1, pct], ["heat.kind", "KIND", 0, 3, null, HEATS]]],
    ["air", "TOY AIR", "#b9f3ff", [["air.mid", "MID AIR", 0, 1, pct], ["air.high", "HIGH AIR", 0, 1, pct]]],
    ["dirt", "DIRT", "#d9c28a", [["dirt.amount", "AMOUNT", 0, 1, pct], ["dirt.sense", "SENSE", 0, 1, pct], ["dirt.kind", "KIND", 0, 4, null, DIRTS]]],
    ["wide", "WIDE", "#8b5cf6", [["wide.amount", "AMOUNT", 0, 1, pct], ["wide.rate", "RATE", 0, 1, (v) => (0.15 + v * 2.5).toFixed(2) + "Hz"]]],
    ["echo", "ECHO", "#5ad1c8", [["echo.mix", "MIX", 0, 1, pct], ["echo.feedback", "FEEDBACK", 0, 1, pct], ["echo.tone", "DARK", 0, 1, pct], ["echo.time", "TIME", 0, 5, null, TIMES], ["echo.trig", "WHEN", 0, 3, null, TRIGS]]],
    ["hall", "HALL", "#6a8cff", [["hall.mix", "MIX", 0, 1, pct], ["hall.size", "SIZE", 0, 1, pct], ["hall.tone", "DARK", 0, 1, pct], ["hall.lowcut", "LOW CUT", 0, 1, (v) => Math.round(80 + v * v * 700) + "Hz"]]],
  ];
  const PILLS = [["heat", "HEAT", "heat.amount", "heat.kind", HEATS], ["air", "TOY AIR", "air.high"], ["dirt", "DIRT", "dirt.amount", "dirt.kind", DIRTS],
                 ["wide", "WIDE", "wide.amount"], ["echo", "ECHO", "echo.mix", "echo.time", TIMES], ["hall", "HALL", "hall.mix"]];

  const SVG = {
    prev: '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    power: '<svg viewBox="0 0 24 24" stroke-width="2.2"><path d="M12 3v8"/><path d="M6.3 7.5a8 8 0 1 0 11.4 0"/></svg>',
    play: '<svg viewBox="0 0 24 24" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="14.5" cy="9.5" r="2.2"/></svg>',
    chain: '<svg viewBox="0 0 24 24" stroke-width="1.6"><path d="M5 4v16M12 4v16M19 4v16"/><rect x="3" y="13" width="4" height="3"/><rect x="10" y="7" width="4" height="3"/><rect x="17" y="11" width="4" height="3"/></svg>',
  };

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function drag(target, onMove, onEnd) {
    target.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      onMove(e, true);
      const mv = (ev) => onMove(ev, false);
      const up = () => { target.removeEventListener("pointermove", mv); target.removeEventListener("pointerup", up); target.removeEventListener("pointercancel", up); onEnd && onEnd(); };
      target.addEventListener("pointermove", mv);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    });
  }

  function menu(anchor, items, pick, sel) {
    document.querySelectorAll(".tv-menu").forEach((m) => m.remove());
    const m = el("div", "tv-menu");
    items.forEach((t, i) => { const b = el("button", i === sel ? "tv-sel" : "", t); b.onclick = () => { m.remove(); pick(i); }; m.append(b); });
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    m.style.left = Math.min(window.innerWidth - m.offsetWidth - 8, r.left) + "px";
    m.style.top = Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 4) + "px";
    const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", off, true); } };
    setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
  }

  function defaults() { const pr = PACKS[0].presets[0]; return { on: false, pack: PACKS[0].name, preset: pr.name, v: presetValues(pr) }; }

  function open(host, opts) {
    const api = opts.api || {};
    const S = Object.assign(defaults(), JSON.parse(JSON.stringify(opts.state || {})));
    S.v = Object.assign({}, DEF, S.v || {});
    let page = "play", focus = null, raf = 0, dead = false;

    const root = el("div", "tv-root");
    root.tabIndex = 0;
    host.append(root);

    // ---------------- top bar
    const top = el("div", "tv-top");
    const brand = el("div", "tv-brand");
    brand.append(el("span", "tv-wordmark", "TOY VOX"), el("span", "tv-sub", ""));
    const nav = el("div", "tv-nav");
    const prevB = el("button", "tv-iconbtn", SVG.prev), nameB = el("button", "tv-presetname", ""), nextB = el("button", "tv-iconbtn", SVG.next);
    nav.append(prevB, nameB, nextB);
    const tr = el("div", "tv-topright");
    const onoff = el("button", "tv-onoff", "<i></i><span></span>");
    const out = el("div", "tv-out", '<div class="tv-meter"><i></i></div><div class="tv-out-thumb"></div>');
    const closeB = el("button", "tv-iconbtn tv-close", SVG.x);
    tr.append(onoff, out, closeB);
    top.append(brand, nav, tr);

    // ---------------- main
    const main = el("div", "tv-main");
    const rail = el("div", "tv-rail");
    const railBtns = {};
    for (const [k, label] of [["play", "Play"], ["chain", "Chain"]]) {
      const b = el("button", "tv-railbtn", SVG[k] + "<span>" + label + "</span>");
      b.dataset.page = k;
      b.onclick = () => { page = k; focus = null; render(); };
      railBtns[k] = b; rail.append(b);
    }
    const pages = el("div", "tv-pages");
    const pPlay = el("div", "tv-page tv-page-play"), pChain = el("div", "tv-page tv-page-chain");
    pages.append(pPlay, pChain);
    main.append(rail, pages);

    // PLAY: presets
    const presets = el("div", "tv-presets");
    const packRow = el("div", "tv-packs"), plist = el("div", "tv-plist");
    presets.append(packRow, plist);
    // PLAY: the disc
    const stage = el("div", "tv-stage");
    const ring = el("div", "tv-discring"), disc = el("div", "tv-disc");
    const cv = el("canvas"), dot = el("div", "tv-dot");
    disc.append(cv, dot);
    ring.append(disc, el("span", "tv-axis tv-ax-l", "DARK"), el("span", "tv-axis tv-ax-r", "BRIGHT"), el("span", "tv-axis tv-ax-t", "BIG"), el("span", "tv-axis tv-ax-b", "DIRTY"));
    const xyRead = el("div", "tv-xyread", "");
    stage.append(ring, xyRead);
    // PLAY: side
    const side = el("div", "tv-side");
    pPlay.append(presets, stage, side);

    // bottom
    const bottom = el("div", "tv-bottom");
    const chain = el("div", "tv-chain");
    const room = el("div", "tv-room", '<div class="tv-roomhead"><span>ROOM</span><span></span></div><div class="tv-roombar"><em></em><i></i><b></b></div>');
    bottom.append(chain, room);
    root.append(top, main, bottom);

    // ---------------- state helpers
    const set = (id, v, quiet) => { S.v[id] = v; if (api.set) api.set(id, v); if (!quiet) markCustom(); };
    const commit = () => { if (api.commit) api.commit(S); };
    function markCustom() { if (S.preset && !S.preset.endsWith(" *")) S.preset += " *"; renderTop(); renderPresets(); }
    function loadPreset(pack, pr) {
      const keep = { key: S.v.key, scale: S.v.scale, out: S.v.out };
      S.pack = pack.name; S.preset = pr.name;
      S.v = Object.assign(presetValues(pr), keep, { "xy.x": 0, "xy.y": 0 });
      for (const id in S.v) if (api.set) api.set(id, S.v[id]);
      if (!S.on) { S.on = true; if (api.power) api.power(true); }   // picking a preset = you want to hear it
      render(); commit();
    }
    const allPresets = () => PACKS.flatMap((pk) => pk.presets.map((pr) => [pk, pr]));
    function step(d) {
      const all = allPresets(), base = (S.preset || "").replace(/ \*$/, "");
      let i = all.findIndex(([pk, pr]) => pk.name === S.pack && pr.name === base);
      i = (i + d + all.length) % all.length;
      loadPreset(all[i][0], all[i][1]);
    }

    // ---------------- renders
    function renderTop() {
      const pk = PACKS.find((p) => p.name === S.pack);
      brand.lastChild.textContent = pk ? pk.name : "";
      nameB.textContent = S.preset || "INIT";
      onoff.classList.toggle("tv-on", !!S.on);
      onoff.lastChild.textContent = S.on ? "ON" : "MUTED";
      const o = (S.v.out + 24) / 36;
      out.querySelector(".tv-out-thumb").style.left = o * 100 + "%";
    }
    function renderPresets() {
      packRow.replaceChildren(...PACKS.map((pk) => {
        const b = el("button", "tv-pack" + (pk.name === (S.view || S.pack) ? " tv-sel" : ""), pk.name);
        b.onclick = () => { S.view = pk.name; renderPresets(); };
        return b;
      }));
      const pk = PACKS.find((p) => p.name === (S.view || S.pack)) || PACKS[0];
      const base = (S.preset || "").replace(/ \*$/, "");
      plist.replaceChildren(...pk.presets.map((pr) => {
        const b = el("button", "tv-preset" + (pk.name === S.pack && pr.name === base ? " tv-sel" : ""), "<i></i><b></b><span></span>");
        b.style.setProperty("--pc", pk.color);
        b.children[1].textContent = pr.name; b.children[2].textContent = pr.tag || "";
        b.onclick = () => loadPreset(pk, pr);
        return b;
      }));
    }
    function slider(label, id, min, max, text, center) {
      const w = el("div", "tv-slider");
      const head = el("div", "tv-slhead", "<b></b><span></span>");
      head.firstChild.textContent = label;
      const tk = el("div", "tv-track", "<i></i>" + (center ? "<em></em>" : "") + "<b></b>");
      w.append(head, tk);
      const paint = () => {
        const v = S.v[id], f = (v - min) / (max - min), c = center ? (0 - min) / (max - min) : 0;
        tk.querySelector("i").style.left = Math.min(f, c) * 100 + "%";
        tk.querySelector("i").style.width = Math.abs(f - c) * 100 + "%";
        tk.querySelector("b").style.left = f * 100 + "%";
        if (center) tk.querySelector("em").style.left = c * 100 + "%";
        head.lastChild.textContent = text(v);
      };
      drag(tk, (e) => {
        const r = tk.getBoundingClientRect();
        let v = min + clamp((e.clientX - r.left) / r.width, 0, 1) * (max - min);
        if (center) v = Math.round(v * 2) / 2;
        set(id, v); paint();
      }, commit);
      tk.addEventListener("dblclick", () => { set(id, DEF[id]); paint(); commit(); });
      paint();
      return w;
    }
    function lvl(id, min, max, after) {
      const b = el("div", "tv-pilllvl", "<i></i>");
      const paint = () => { b.firstChild.style.width = ((S.v[id] - min) / (max - min)) * 100 + "%"; };
      drag(b, (e) => { const r = b.getBoundingClientRect(); set(id, min + clamp((e.clientX - r.left) / r.width, 0, 1) * (max - min)); paint(); after && after(); }, commit);
      b.addEventListener("dblclick", () => { set(id, DEF[id]); paint(); after && after(); commit(); });
      paint();
      return b;
    }
    function powerBtn(key, box) {
      const b = el("button", "tv-power", SVG.power);
      b.onclick = () => { const on = !(S.v[key + ".on"] > 0.5); set(key + ".on", on ? 1 : 0); box.classList.toggle("tv-off", !on); renderChain(); commit(); };
      return b;
    }
    function renderSide() {
      side.replaceChildren(
        slider("Pitch", "boy.pitch", -12, 12, (v) => (S.v["boy.on"] > 0.5 ? st(v) : "off"), true),
        slider("Formant", "boy.formant", -12, 12, (v) => (S.v["boy.on"] > 0.5 ? st(v) : "off"), true),
        slider("Tune", "tune.speed", 0, 1, (v) => (S.v["tune.on"] > 0.5 ? (v >= 0.97 ? "HARD" : Math.round(400 * Math.pow(10, -2.6 * v)) + " ms") + (S.v["tune.live"] > 0.5 ? " \u00b7 LIVE" : "") : "off")),
      );
      // moving PITCH or FORMANT switches TOY BOY on; moving TUNE switches TUNE on
      side.querySelectorAll(".tv-track").forEach((tk, i) => tk.addEventListener("pointerdown", () => {
        const k = i < 2 ? "boy.on" : "tune.on";
        if (!(S.v[k] > 0.5)) { set(k, 1, true); renderChain(); }
      }, true));
      const pills = el("div", "tv-pills");
      for (const [key, name, lid, kid, kinds] of PILLS) {
        const p = el("div", "tv-pill" + (S.v[key + ".on"] > 0.5 ? "" : " tv-off"));
        const nm = el("span", "tv-pillname", name);
        p.append(powerBtn(key, p), nm);
        if (kid) {
          const k = el("button", "tv-pillkind", kinds[Math.round(S.v[kid])] || "");
          k.onclick = () => menu(k, kinds, (i) => { set(kid, i); k.textContent = kinds[i]; commit(); }, Math.round(S.v[kid]));
          p.append(k);
        }
        p.append(lvl(lid, 0, 1, () => { if (!(S.v[key + ".on"] > 0.5)) { set(key + ".on", 1, true); p.classList.remove("tv-off"); renderChain(); } }));
        pills.append(p);
      }
      side.append(pills);
    }
    function renderChain() {
      const parts = [];
      BLOCKS.forEach(([key, name], i) => {
        if (i) parts.push(el("span", "tv-chipsep"));
        const c = el("button", "tv-chip" + (S.v[key + ".on"] > 0.5 ? " tv-on" : ""), "<i></i>" + name);
        c.onclick = () => { page = "chain"; focus = key; render(); };
        parts.push(c);
      });
      chain.replaceChildren(...parts);
    }
    function renderCards() {
      const grid = el("div", "tv-grid");
      for (const [key, name, color, knobs] of BLOCKS) {
        const card = el("div", "tv-card" + (S.v[key + ".on"] > 0.5 ? "" : " tv-off") + (focus === key ? " tv-focus" : ""));
        card.style.setProperty("--kc", color);
        const head = el("div", "tv-cardhead");
        head.append(powerBtn(key, card), el("span", "tv-cardname", name));
        card.append(head);
        for (const [id, label, min, max, text, steps] of knobs) {
          if (steps && steps.length > 5) {   // long lists (CHOIR kinds): one dropdown, like the side pills
            const b = el("button", "tv-step tv-sel tv-stepmenu", steps[Math.round(S.v[id])] || "");
            b.onclick = () => menu(b, steps, (i) => { set(id, i); renderCards(); commit(); }, Math.round(S.v[id]));
            const k = el("div", "tv-knob"); k.style.gridTemplateColumns = "74px 1fr"; k.append(el("span", "", label), el("div", "tv-steps"));
            k.lastChild.append(b);
            card.append(k);
          } else if (steps) {
            const row = el("div", "tv-steps");
            steps.forEach((s, i) => { const b = el("button", "tv-step" + (Math.round(S.v[id]) === i ? " tv-sel" : ""), s); b.onclick = () => { set(id, i); renderCards(); commit(); }; row.append(b); });
            const k = el("div", "tv-knob"); k.style.gridTemplateColumns = "74px 1fr"; k.append(el("span", "", label), row);
            card.append(k);
          } else {
            const k = el("div", "tv-knob");
            const val = el("span", "", text(S.v[id]));
            k.append(el("span", "", label), lvl(id, min, max, () => { val.textContent = text(S.v[id]); }), val);
            card.append(k);
          }
        }
        grid.append(card);
      }
      pChain.replaceChildren(grid);
      if (focus) { const f = pChain.querySelector(".tv-focus"); if (f) f.scrollIntoView({ block: "nearest" }); }
    }
    function placeDot() {
      dot.style.left = (50 + S.v["xy.x"] * 50 * 0.86) + "%";
      dot.style.top = (50 - S.v["xy.y"] * 50 * 0.86) + "%";
      const x = S.v["xy.x"], y = S.v["xy.y"];
      xyRead.textContent = Math.abs(x) < 0.02 && Math.abs(y) < 0.02 ? "" : (x < 0 ? "DARK " : "BRIGHT ") + Math.round(Math.abs(x) * 100) + "  /  " + (y < 0 ? "DIRTY " : "BIG ") + Math.round(Math.abs(y) * 100);
    }
    function render() {
      Object.entries(railBtns).forEach(([k, b]) => b.classList.toggle("tv-sel", k === page));
      pPlay.hidden = page !== "play"; pChain.hidden = page !== "chain";
      renderTop(); renderPresets(); renderSide(); renderChain(); placeDot();
      if (page === "chain") renderCards();
      fit();
    }

    // ---------------- events
    prevB.onclick = () => step(-1); nextB.onclick = () => step(1);
    nameB.onclick = () => { page = "play"; render(); };
    onoff.onclick = () => { S.on = !S.on; if (api.power) api.power(S.on); renderTop(); commit(); };
    closeB.onclick = () => api.close && api.close();
    drag(out, (e) => { const r = out.getBoundingClientRect(); set("out", Math.round((-24 + clamp((e.clientX - r.left) / r.width, 0, 1) * 36) * 2) / 2, true); renderTop(); }, commit);
    out.addEventListener("dblclick", () => { set("out", 0, true); renderTop(); commit(); });
    drag(disc, (e) => {
      const r = disc.getBoundingClientRect();
      let x = ((e.clientX - r.left) / r.width - 0.5) / (0.5 * 0.86), y = -((e.clientY - r.top) / r.height - 0.5) / (0.5 * 0.86);
      const d = Math.hypot(x, y);
      if (d > 1) { x /= d; y /= d; }
      set("xy.x", x, true); set("xy.y", y, true); placeDot();
    }, commit);
    disc.addEventListener("dblclick", () => { set("xy.x", 0, true); set("xy.y", 0, true); placeDot(); commit(); });

    // ---------------- the disc picture + meters (only data visuals move)
    const ctx2 = cv.getContext("2d");
    const hist = new Array(96).fill(0);
    let hp = 0, lastLvl = 0;
    function frame() {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      const m = api.meter ? api.meter() : null;
      const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      if (!W) return;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = ctx2;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, R = W / 2;
      const level = m ? clamp((m.level + 60) / 60, 0, 1) : 0, floor = m ? clamp((m.floor + 60) / 60, 0, 1) : 0, dirt = m ? m.dirt : 0;
      lastLvl += (level - lastLvl) * 0.35;
      hist[hp] = S.on ? lastLvl : 0; hp = (hp + 1) % hist.length;
      // background: the XY field tinted by where the dot is
      const x = S.v["xy.x"], y = S.v["xy.y"];
      const bg = g.createRadialGradient(cx + x * R * 0.5, cy - y * R * 0.5, 4, cx, cy, R);
      bg.addColorStop(0, `hsla(${285 + x * 40}, 60%, ${18 + Math.max(0, y) * 10}%, 0.9)`);
      bg.addColorStop(1, "rgba(10,10,12,1)");
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // grid rings
      g.strokeStyle = "rgba(255,255,255,0.06)"; g.lineWidth = 1;
      for (const f of [0.3, 0.55, 0.8]) { g.beginPath(); g.arc(cx, cy, R * f, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
      // the room-tone circle: below it is silence to DIRT and HUSH
      g.strokeStyle = "rgba(255,255,255,0.22)"; g.setLineDash([3, 4]);
      g.beginPath(); g.arc(cx, cy, R * (0.2 + floor * 0.7), 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      // the voice: a ring of the last ~2 seconds, round the disc
      g.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const v = hist[(hp + i) % hist.length], a = (i / hist.length) * Math.PI * 2 - Math.PI / 2, rr = R * (0.2 + v * 0.7);
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
      g.strokeStyle = dirt > 0.02 ? `rgba(228,255,58,${0.5 + dirt * 0.5})` : "rgba(185,164,255,0.85)";
      g.lineWidth = 1.6; g.stroke();
      g.fillStyle = dirt > 0.02 ? `rgba(228,255,58,${0.05 + dirt * 0.12})` : "rgba(139,92,246,0.10)"; g.fill();
      // room meter at the bottom
      const bar = room.querySelector("i"), mark = room.querySelector("b"), zone = room.querySelector("em");
      const pos = (db) => clamp((db + 80) / 80, 0, 1) * 100;
      if (m) {
        bar.style.width = pos(m.level) + "%";
        mark.style.left = pos(m.floor) + "%";
        const over = m.floor + 4 + (1 - S.v["dirt.sense"]) * 16;
        zone.style.left = pos(over) + "%";
        bar.classList.toggle("tv-hot", m.dirt > 0.02);
        room.querySelector(".tv-roomhead span:last-child").textContent = Math.round(m.floor) + " dB";
      }
      const om = out.querySelector(".tv-meter i");
      om.style.width = (S.on ? lastLvl * 100 : 0) + "%";
    }
    raf = requestAnimationFrame(frame);

    // the disc fills its column like TOY MACHINE's
    function fit() {
      const r = stage.getBoundingClientRect();
      const d = Math.max(200, Math.min(r.width - 150, r.height - 70));
      ring.style.setProperty("--tv-disc", d + "px");
    }
    const ro = new ResizeObserver(fit);
    ro.observe(stage);

    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { step(1); e.preventDefault(); }
    });

    render();
    return {
      root, state: S,
      setState(n) { Object.assign(S, JSON.parse(JSON.stringify(n))); S.v = Object.assign({}, DEF, S.v || {}); render(); },
      destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); root.remove(); document.querySelectorAll(".tv-menu").forEach((m) => m.remove()); },
    };
  }

  window.ToyVoxUI = { open, defaults, PACKS, DEF, presetValues, BLOCKS };
})();
