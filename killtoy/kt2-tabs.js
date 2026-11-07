// KILLTOY 2: the footer tabs other than FX, as window.KT2Tabs[tab](pane, clip) (kt2.js calls them).
//   INST     the MIDI clip's instrument as a card: < preset >, its 4 macro bars, OCT -/+ (moves
//            the clip's notes), LEVEL (the lane's volume), OPEN; + ADD INSTRUMENT layers another
//            TOY MACHINE on a new row playing the same notes
//   MIDI     the clip's notes; on a sound: FROM AUDIO SOURCE (its notes on a TOY MACHINE) or
//            RECREATE THE SOUNDS (stems -> KILLDRUM + TOY MACHINEs in one compound, ui/stemsplit.js)
//   WARP     the clip's waveform with its hits marked, its tempo against the song's
//   MASTR    BEFORE / AFTER (the master chain on/off), MATCH VOLUME, STYLES (one click puts a
//            chain on the master) | ADVANCED (the master's own cards), ANALYSE, a level meter
//   PITCH    a vocal's notes as blobs: drag one up or down, it snaps to the key, you hear it at
//            once (previewTune); APPLY renders it (tune), RESET puts it back
//   STEMS    the stem rows with S / M, and SPLIT for the picked sound
// Loaded at the end of the KILLTOY 2 page, before kt2.js. Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  if (!document.documentElement.classList.contains("kt2")) return;
  const T = (window.KT2Tabs = {});
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const head = (title, sub) => { const b = h("div", "k2t-head"); b.append(h("b", null, title)); if (sub) b.append(h("span", null, sub)); return b; };
  const empty = (pane, text) => pane.append(h("div", "k2-empty", text));
  const refresh = () => window.KT2 && KT2.refreshPane && KT2.refreshPane();
  // a horizontal bar you drag (0..1)
  function bar(label, value, onSet, color) {
    const b = h("div", "k2t-bar");
    const fill = h("i"), lab = h("span", null, label), val = h("em");
    b.append(fill, lab, val);
    if (color) b.style.setProperty("--bc", color);
    const paint = (v) => { fill.style.width = Math.round(v * 100) + "%"; val.textContent = Math.round(v * 100); };
    paint(value);
    b.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const r = b.getBoundingClientRect();
      const at = (ev) => Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      let v = at(e); paint(v); onSet(v, true);
      const move = (ev) => { v = at(ev); paint(v); onSet(v, true); };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); onSet(v, false); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    return b;
  }

  // RECREATE THE SOUNDS on a sound clip. The split takes a few minutes for a whole song; its job card
  // shows how far it is. The result is a compound clip in place of the sound (which is switched off).
  function recreate(c) {
    if (!ui.state || !ui.state.canRecreate) return toast("Recreating needs the newer engine.");
    toast(`Recreating ${c.name}: splitting it into drums, bass, music and vocals first. This takes a few minutes; the card at the bottom shows how far it is.`);
    return run("recreateSounds", { clipId: c.id }).then((r) => {
      if (!r || !r.ok) return toast((r && r.error) || "Couldn't recreate that sound.");
      toast(`${r.message}. ${r.inst ? "It's one compound clip: double-click it to see the lanes, Cmd+Z takes it all away." : "Cmd+Z takes it away."} The original is switched off.`);
      if (r.clipIds && r.clipIds.length) { ui.selectedClip = r.clipIds[0]; ui.extraClips = new Set(r.clipIds.slice(1)); ui.laneSig = ""; render(); }
    });
  }
  T.recreate = recreate;

  // ------------------------------------------------------------------ INST
  let presetList = null;
  const presets = async () => presetList || (presetList = ((await booth("toyMachinePresets")) || {}).presets || []);
  // The whole instrument in the footer shrinks to fit however tall the footer is, so nothing is cut off (Eman, 31 Oct)
  function fitInst(host) {
    const fit = () => {
      if (!host.isConnected) { ro.disconnect(); mo.disconnect(); return; }
      const r = host.querySelector(".tm-root");
      if (!r || !host.clientHeight) return;
      const W = host.clientWidth, H = host.clientHeight;
      r.style.zoom = ""; r.style.width = ""; r.style.height = "";
      let s = 1;
      for (let i = 0; i < 3; i++) {
        const nh = r.scrollHeight;
        s = Math.min(1, H / Math.max(1, nh));
        r.style.width = W / s + "px";
      }
      s = Math.min(1, H / Math.max(1, r.scrollHeight));
      r.style.width = W / s + "px";
      r.style.zoom = s < 0.999 ? String(s) : "";
    };
    let raf = 0;
    const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
    const ro = new ResizeObserver(soon);
    ro.observe(host);
    const mo = new MutationObserver(() => { if (host.querySelector(".tm-root")) soon(); });
    mo.observe(host, { childList: true, subtree: true });
  }
  T.inst = (pane, c) => {
    // a compound (mock v82): every instrument inside it, one group per row, on one cable rail
    const mem = c && c.cmp ? ui.state.tracks.flatMap((t) => t.clips.filter((x) => x.cmp && x.cmp.inst === c.cmp.inst && x.kind === "midi").map((x) => findClip(x.id))).filter(Boolean) : [];
    if (mem.length) {
      const box = h("div", "k2t-cmp");
      box.append(h("div", "k2t-cmp-h", `COMPOUND \u00b7 ${c.cmp.name || "group"} \u00b7 ${mem.length} instrument${mem.length > 1 ? "s" : ""}`));
      const row = h("div", "k2t-cards k2t-cmprow");
      row.append(h("div", "k2t-rail"));
      for (const m of mem) {
        const t = ui.state.tracks.find((x) => x.id === m.track.id) || m.track;
        const inst = [...(t.plugins || []), ...(m.plugins || [])].filter((p) => p.instrument);
        const grp = h("div", "k2t-grp");
        grp.style.setProperty("--c", colorOf(t));
        const tag = h("button", "k2t-grp-tag", t.name);
        tag.title = "Pick this part";
        tag.onclick = () => { ui.selectedClip = m.id; render(); };
        grp.append(tag);
        for (const p of inst.length ? inst : [{ name: t.instrument || "Instrument" }]) grp.append(instCard(p, t, m));
        row.append(grp);
      }
      box.append(row);
      return pane.append(box);
    }
    if (!c || c.kind !== "midi") return empty(pane, "INST is for MIDI clips. Pick a MIDI clip, or use the MIDI pill on a sound to turn it into notes.");
    const t = ui.state.tracks.find((x) => x.id === c.track.id) || c.track;
    if (t.noInst && window.KT2Pick) {   // no synth yet (a double-clicked pattern, Eman 5 Nov): one big ADD INSTRUMENT
      const b = h("button", "k2t-add k2p-instadd");
      b.innerHTML = "<b>+</b>ADD INSTRUMENT";
      b.onclick = (e) => { e.stopPropagation(); KT2Pick.pickSynth(t, c); };
      return pane.append(b);
    }
    const inst = [...(t.plugins || []), ...(c.plugins || [])].filter((p) => p.instrument);
    // stacked synths (Eman, 1 Nov): every synth on this pattern, side by side on one cable
    const stack = ui.state.tracks.filter((x) => x.layerOf === t.id);
    // footer dragged tall: the whole TOY MACHINE, playable and editable, right in the footer
    const tmp = inst.find((p) => p.id && /toy machine/i.test(p.name || ""));
    if (KT2.footTall && tmp && typeof openToyMachine === "function") {
      const host = h("div", "k2t-fullinst");
      pane.append(host);
      openToyMachine(tmp, host, () => host.isConnected);
      fitInst(host);
      return;
    }
    const row = h("div", "k2t-cards" + (stack.length ? " k2t-stack" : ""));
    pane.append(row);
    if (stack.length && window.KT2_STACK_RAIL) row.append(h("div", "k2t-rail"));   // the old cable on top: parked (Eman, 4 Nov)
    if (!inst.length) inst.push({ name: t.instrument || "Instrument" });
    for (const p of inst) row.append(instCard(p, t, c));
    for (const L of stack) for (const p of (L.plugins || []).filter((q) => q.instrument)) row.append(instCard(p, L, c, true));
    if (stack.length && window.KT2_STACK_RAIL) requestAnimationFrame(() => {   // the cable runs from the first card's middle to the last one's
      const cs = row.querySelectorAll(":scope > .k2t-card"), rail = row.querySelector(":scope > .k2t-rail");
      if (cs.length < 2 || !rail) return;
      const a = cs[0].offsetLeft + cs[0].offsetWidth / 2, z = cs[cs.length - 1].offsetLeft + cs[cs.length - 1].offsetWidth / 2;
      Object.assign(rail.style, { left: a + "px", width: Math.max(0, z - a) + "px" });
    });
    // KILLDRUM plays drums only: nothing stacks on it, and it doesn't stack on synths (Eman, 31 Oct, "for now")
    if (isKillDrumLane(t) || inst.some((p) => /killdrum|toy ?drums/i.test(p.name || ""))) return;
    const add = h("button", "k2t-add");
    add.innerHTML = "<b>+</b>ADD INSTRUMENT<small>another synth on this pattern, playing the same notes at the same time</small>";
    add.onclick = (e) => { e.stopPropagation();
      if (window.KT2Pick && !window.KT2_OLD_ADDMENU) return KT2Pick.synth({ title: "STACK A SYNTH",
        disabled: (it) => (it.stack ? null : it.key === "builtin:toydrums" ? "KILLDRUM doesn't stack with synths. Start a new pattern for drums." : it.name + " can't stack yet. TOY MACHINE and BLOB can."),
        onPick: (key) => addLayer(c, key) });
      showMenu(add, [
      { heading: "STACK A SYNTH" },
      { label: "TOY MACHINE", meta: "presets and macros", run: () => addLayer(c, "builtin:toymachine") },
      { label: "BLOB", meta: "a sound as a creature", run: () => addLayer(c, "builtin:blob") },
      { label: "KILLDRUM", meta: "drums", disabled: "KILLDRUM doesn't stack with synths. Start a new pattern for drums.", run: () => {} },
    ]); };
    row.append(add);
  };
  // ---- the INST card, round 2 (Eman, 4 Nov 23:30): ring gauges for the macros, a green ring for the
  // level and a green ON chip, the synth's name as "TOY MACHINE / BLOB" tabs that swap it, chips for
  // the rest. Fills the footer top to bottom. The old card: window.KT2_OLD_INSTCARD = true
  const RING0 = 120, RINGS = 300;   // the arc starts at 7 o'clock and sweeps 300 degrees, gap at the bottom
  const arcD = (r, a0, a1) => {
    const p = (a) => [50 + r * Math.cos(a * Math.PI / 180), 50 + r * Math.sin(a * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  function ring(label, value, onSet, opts = {}) {
    const b = h("div", "k2r" + (opts.cls ? " " + opts.cls : ""));
    if (opts.color) b.style.setProperty("--rc", opts.color);
    b.innerHTML = `<svg viewBox="0 0 100 100"><path class="k2r-tr" d="${arcD(40, RING0, RING0 + RINGS)}"/><path class="k2r-v"/><circle class="k2r-dot" r="4.5"/></svg><b></b>`;
    b.append(h("span", null, label));
    const vp = b.querySelector(".k2r-v"), dot = b.querySelector(".k2r-dot"), num = b.querySelector("b");
    const fmt = opts.fmt || ((v) => String(Math.round(v * 100)));
    const paint = (v) => {
      const a = RING0 + RINGS * Math.max(0.001, v), m = RING0 + RINGS / 2;
      // bip: drawn out from the top (PAN), otherwise from the start
      if (opts.bip) vp.setAttribute("d", Math.abs(a - m) < 0.5 ? "" : arcD(40, Math.min(a, m), Math.max(a, m)));
      else vp.setAttribute("d", arcD(40, RING0, a));
      dot.setAttribute("cx", (50 + 40 * Math.cos(a * Math.PI / 180)).toFixed(2)); dot.setAttribute("cy", (50 + 40 * Math.sin(a * Math.PI / 180)).toFixed(2));
      num.textContent = fmt(v);
    };
    let v = Math.max(0, Math.min(1, value || 0));
    paint(v);
    b.title = (opts.tip || label) + ": drag up or down" + (opts.reset != null ? ", double-click to reset" : "");
    b.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const y0 = e.clientY, x0 = e.clientX, v0 = v;
      b.classList.add("drag");
      const move = (ev) => { v = Math.max(0, Math.min(1, v0 + ((ev.clientX - x0) - (ev.clientY - y0)) / (ev.shiftKey ? 600 : 150))); paint(v); onSet(v, true); };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); b.classList.remove("drag"); onSet(v, false); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    if (opts.reset != null) b.addEventListener("dblclick", (e) => { e.stopPropagation(); v = opts.reset; paint(v); onSet(v, false); });
    return b;
  }
  T.ring = ring;
  const SYNTHS = [["TOY MACHINE", "builtin:toymachine"], ["BLOB", "builtin:blob"]];
  function instCard2(p, t, c, stacked) {
    const card = h("div", "k2t-card k2v" + (stacked ? " k2t-stacked" : ""));
    card.style.setProperty("--c", colorOf(t));
    const isBlob = /^blob$/i.test(p.name || "") || p.face === "blob", isTM = !isBlob && /toy machine/i.test(p.name || "");
    const isKD = /killdrum|toy ?drums/i.test(p.name || "");
    const on = p.enabled !== false;
    if (!on) card.classList.add("off");
    const left = h("div", "k2v-l"), top = h("div", "k2v-top");
    // ON: a green chip
    const sw = h("button", "k2v-on" + (on ? " on" : ""), on ? "ON" : "OFF");
    sw.title = on ? "Switch this instrument off" : "Switch it back on";
    sw.hidden = !p.id;
    sw.onclick = (e) => { e.stopPropagation(); run("togglePlugin", { pluginId: p.id }).then(refresh); };
    top.append(sw);
    // the synth: slash tabs, the one playing is lit; clicking another swaps it (same notes, same lane)
    const tabs = h("div", "k2v-syn");
    if (isKD || !(isTM || isBlob)) tabs.append(h("b", "on", (p.name || "INSTRUMENT").toUpperCase()));
    else SYNTHS.forEach(([nm, key], i) => {
      if (i) tabs.append(h("i", null, "/"));
      const cur = (nm === "BLOB") === isBlob;
      const b = h("button", cur ? "on" : "", nm);
      b.title = cur ? "Open " + nm : "Swap to " + nm + ": same notes, a new sound (Cmd+Z puts it back)";
      b.onclick = (e) => {
        e.stopPropagation();
        if (cur) return openLaneSynth(t.id);
        run("setInstrument", { trackId: t.id, key }).then((r) => { if (r && r.error) return; refresh(); if (window.KT2Juice && KT2Juice.sound && KT2Juice.sound.plug) KT2Juice.sound.plug(); toast(`${nm} plays this ${stacked ? "layer" : "pattern"} now. Cmd+Z puts ${isBlob ? "BLOB" : "TOY MACHINE"} back.`); });
      };
      tabs.append(b);
    });
    if (window.KT2Pick && !stacked) {   // every synth, in the picker (Eman, 5 Nov)
      const more = h("button", "k2v-more", "+");
      more.title = "All synths";
      more.onclick = (e) => { e.stopPropagation(); KT2Pick.synth({ title: "SWAP THE SYNTH", onPick: (key) => KT2Pick.setInstrumentFor(t.id, key, c && c.id) }); };
      tabs.append(more);
    }
    top.append(tabs);
    if (stacked) {
      const x = h("button", "k2v-x", "×");
      x.title = "Remove this synth from the pattern";
      x.onclick = (e) => { e.stopPropagation(); run("deleteTrack", { trackId: t.id }).then(refresh); };
      top.append(x);
    }
    left.append(top);
    // the preset, big, with < >
    const nm = h("div", "k2v-pre");
    const prev = h("button", "k2v-arr", "‹"), next = h("button", "k2v-arr", "›"), label = h("span", null, isTM || isBlob ? "..." : t.name);
    nm.append(prev, label, next);
    left.append(nm);
    // chips: OPEN, OCT - n +
    const chips = h("div", "k2v-chips");
    const open = h("button", "k2v-chip", "OPEN ↗"); open.title = "Open the synth"; open.onclick = (e) => { e.stopPropagation(); openLaneSynth(t.id); };
    const ov = t.oct || 0, shift = (d) => run("setLaneOct", { trackId: t.id, oct: ov + d }).then(refresh);
    const oct = h("div", "k2v-chip k2v-oct");
    const minus = h("button", null, "−"), plus = h("button", null, "+");
    minus.title = plus.title = "Play this synth an octave lower / higher (the notes stay where they are)";
    minus.onclick = (e) => { e.stopPropagation(); shift(-1); }; plus.onclick = (e) => { e.stopPropagation(); shift(1); };
    oct.append(h("span", null, "OCT"), minus, h("b", null, ov > 0 ? "+" + ov : String(ov)), plus);
    chips.append(open, oct);
    left.append(chips);
    card.append(left);
    // the macros as rings
    const macros = h("div", "k2v-mac");
    card.append(macros);
    // the level: a green ring
    const lv = ring("LEVEL", volToFrac(t.volume || 0), (v, drag) => run("setTrackVolume", { trackId: t.id, db: fracToVol(v), drag }), { cls: "k2r-lvl", tip: "This synth's volume (the same fader as in the mixer)", reset: volToFrac(0) });
    card.append(lv);
    if (isTM && p.id) {
      const load = async () => {
        const r = await booth("toyMachineGetPreset", { pluginId: p.id });
        const pr = r && r.preset;
        if (!pr) return;
        label.textContent = pr.name || "Preset";
        macros.replaceChildren(...(pr.macros || []).slice(0, 4).map((m, i) => ring((m.name || "MACRO " + (i + 1)).toUpperCase(), m.value || 0, (v) => booth("toyMachineSetMacro", { pluginId: p.id, index: i, value: v }), { tip: m.name || "Macro" })));
      };
      const step = async (d) => {
        const list = await presets();
        if (!list.length) return toast("No presets found.");
        const cur = label.textContent, i = list.findIndex((x) => x.name === cur);
        const nx = list[((i < 0 ? 0 : i + d) + list.length) % list.length];
        label.textContent = nx.name;
        const r = await booth("toyMachineLoadPreset", { id: nx.id, file: nx.file });
        if (r && r.preset) { await run("toyMachineSetPreset", { pluginId: p.id, preset: r.preset }); load(); }
      };
      prev.onclick = (e) => { e.stopPropagation(); step(-1); }; next.onclick = (e) => { e.stopPropagation(); step(1); };
      prev.title = next.title = "Previous / next preset";
      load();
    } else if (isBlob && p.id && window.BlobEngine) {
      const B = window.BlobEngine;
      let i = 0;
      booth("blobGetPatch", { pluginId: p.id }).then((r) => {
        const n = (r && r.patch && r.patch.name) || "Saw Circle";
        label.textContent = n;
        i = Math.max(0, B.PRESETS.findIndex((x) => x.n === n));
      });
      const step = (d) => {
        i = (i + d + B.PRESETS.length) % B.PRESETS.length;
        const patch = B.fromPreset(i);
        label.textContent = patch.name || B.PRESETS[i].n;
        run("blobSetPatch", { pluginId: p.id, patch });
      };
      prev.onclick = (e) => { e.stopPropagation(); step(-1); }; next.onclick = (e) => { e.stopPropagation(); step(1); };
      prev.title = next.title = "Previous / next BLOB";
      macros.append(h("div", "k2v-note", "Open it to paint its sound: colours make the tone, the shape moves it."));
    } else { prev.hidden = next.hidden = true; macros.append(h("div", "k2v-note", "Open it to change its sound.")); }
    return card;
  }
  function instCard(p, t, c, stacked) {
    // round 3 (Eman, 6 Nov 02:27): live picture box, live circle, PAN, LEVEL, big OCT (ui/kt2-instlive.js);
    // window.KT2_INSTCARD2 = true brings back round 2
    if (!window.KT2_OLD_INSTCARD && !window.KT2_INSTCARD2 && window.KT2InstLive) return withLink(KT2InstLive.card(p, t, c, stacked, { ring, presets, refresh }), t, stacked);
    if (!window.KT2_OLD_INSTCARD) return withLink(instCard2(p, t, c, stacked), t, stacked);
    const card = h("div", "k2t-card" + (stacked ? " k2t-stacked" : ""));
    card.style.setProperty("--c", colorOf(t));
    const isTM = /toy machine/i.test(p.name || "") || p.face === "blob";   // a BLOB flips through TOY MACHINE presets too
    // the whole top is the instrument's name, as one button that opens it; ON/OFF on the right (Eman, 31 Oct)
    const top = h("div", "k2t-card-top");
    // one full-width button with the ON/OFF switch inside it, no arrow (Eman, 31 Oct)
    const kind = h("div", "k2t-iname");
    kind.setAttribute("role", "button"); kind.tabIndex = 0;
    kind.innerHTML = `<span></span>`;
    kind.firstChild.textContent = (p.name || "INSTRUMENT").toUpperCase();
    kind.title = "Open " + (p.name || "the instrument");
    kind.onclick = () => openLaneSynth(t.id);
    const on = p.enabled !== false;
    const sw = h("button", "k2t-onoff" + (on ? " on" : ""));
    sw.innerHTML = `<i></i>`;   // just a dot: lit = on, dark = off (Eman, 31 Oct)
    sw.title = on ? "Switch this instrument off" : "Switch it back on";
    sw.hidden = !p.id;
    sw.onclick = (e) => { e.stopPropagation(); run("togglePlugin", { pluginId: p.id }).then(refresh); };
    kind.prepend(sw);
    top.append(kind);
    card.append(top);
    if (!on) card.classList.add("off");
    const nm = h("div", "k2t-pname");
    const prev = h("button", "k2t-arrow", "\u2039"), next = h("button", "k2t-arrow", "\u203a"), label = h("span", null, isTM ? "..." : t.name);
    nm.append(prev, label, next);
    card.append(nm);
    const macros = h("div", "k2t-macros");
    const logo = /^blob$/i.test(p.name || "") ? "blob-logo.png" : isTM ? "toymachine-logo.png" : "";
    if (logo && window.SHOW_INST_LOGO) { macros.classList.add("k2t-logo"); macros.style.setProperty("--logo", `url("${logo}")`); }
    card.append(macros);
    if (isTM && p.id) {
      const load = async () => {
        const r = await booth("toyMachineGetPreset", { pluginId: p.id });
        const pr = r && r.preset;
        if (!pr) return;
        label.textContent = pr.name || "Preset";
        macros.replaceChildren(...(pr.macros || []).slice(0, 4).map((m, i) => bar((m.name || "MACRO " + (i + 1)).toUpperCase(), m.value || 0, (v) => booth("toyMachineSetMacro", { pluginId: p.id, index: i, value: v }), colorOf(t))));
      };
      const step = async (d) => {
        const list = await presets();
        if (!list.length) return toast("No presets found.");
        const cur = label.textContent, i = list.findIndex((x) => x.name === cur);
        const nx = list[((i < 0 ? 0 : i + d) + list.length) % list.length];
        label.textContent = nx.name;
        const r = await booth("toyMachineLoadPreset", { id: nx.id, file: nx.file });
        if (r && r.preset) { await run("toyMachineSetPreset", { pluginId: p.id, preset: r.preset }); load(); }
      };
      prev.onclick = () => step(-1); next.onclick = () => step(1);
      prev.title = next.title = "Previous / next preset";
      load();
    } else if (/^blob$/i.test(p.name || "") && p.id && window.BlobEngine) {
      // BLOB (mock v91): its presets with < >, OPEN paints it in the big window
      const B = window.BlobEngine;
      let i = 0;
      booth("blobGetPatch", { pluginId: p.id }).then((r) => {
        const nm = (r && r.patch && r.patch.name) || "Saw Circle";
        label.textContent = nm;
        i = Math.max(0, B.PRESETS.findIndex((x) => x.n === nm));
      });
      const step = (d) => {
        i = (i + d + B.PRESETS.length) % B.PRESETS.length;
        const patch = B.fromPreset(i);
        label.textContent = patch.name || B.PRESETS[i].n;
        run("blobSetPatch", { pluginId: p.id, patch });
      };
      prev.onclick = () => step(-1); next.onclick = () => step(1);
      prev.title = next.title = "Previous / next BLOB";
      macros.append(h("div", "k2t-note", "Open it to paint its sound: colours make the tone, the shape moves it."));
    } else { prev.hidden = next.hidden = true; macros.append(h("div", "k2t-note", "Open it to change its sound.")); }
    const foot = h("div", "k2t-card-foot");
    const oct = h("div", "k2t-oct");
    const minus = h("button", null, "−"), plus = h("button", null, "+"), ov = t.oct || 0;
    minus.title = plus.title = "Play this synth an octave lower / higher (the notes stay where they are)";
    const shift = (d) => run("setLaneOct", { trackId: t.id, oct: ov + d }).then(refresh);
    minus.onclick = () => shift(-1); plus.onclick = () => shift(1);
    oct.append(h("span", null, "OCT"), minus, h("b", "k2t-octv", ov > 0 ? "+" + ov : String(ov)), plus);
    const lvl = bar("LEVEL", volToFrac(t.volume || 0), (v, drag) => run("setTrackVolume", { trackId: t.id, db: fracToVol(v), drag }), "#7c5cf0");
    lvl.title = "This synth's volume (the same fader as in the mixer)";
    withLink(card, t, stacked, true);
    if (stacked) {   // take a stacked synth off again
      const x = h("button", "k2t-unstack", "\u00d7");
      x.title = "Remove this synth from the pattern";
      x.onclick = (e) => { e.stopPropagation(); run("deleteTrack", { trackId: t.id }).then(refresh); };
      top.append(x);
    }
    foot.append(oct, lvl);
    card.append(foot);
    return card;
  }
  // the link to the synth before it, on a stacked card (old and new card alike)
  function withLink(card, t, stacked) {
    if (!stacked) return card;
    // the new cards: the waving thread in a real gap between them (Eman, 6 Nov 03:03);
    // KT2_LINK_CABLES = true brings back the old cable bundle
    if (card.classList.contains("k2w") && !window.KT2_LINK_CABLES && window.KT2InstLive && KT2InstLive.thread) {
      const linked = t.linked !== false;
      const th = KT2InstLive.thread(linked, 64, 60, () => {
        if (window.KT2Juice) { const S = KT2Juice.sound; const f = linked ? S.unplug : S.plug; if (f) f(); }
        run("setLayerLinked", { trackId: t.id, linked: !linked }).then(refresh);
      }, linked ? "Linked: plays the pattern's notes. Click to give it its own notes" : "Own notes. Click to link it back to the pattern's notes");
      th.classList.add("k2th-card");
      card.classList.toggle("k2t-own", !linked);
      card.append(th);
      return card;
    }
      // the link to the synth before it (Eman, 4 Nov): in the gap between the cards, a plug on each
      // side and a few cables with light running through them while linked (same notes as the
      // pattern); cut, the cables pull back into the other synth and both plugs sit empty
      const linked = t.linked !== false, just = KT2.justLinked && KT2.justLinked.id === t.id ? KT2.justLinked : null;
      if (just) KT2.justLinked = null;
      const lk = h("button", "k2t-link" + (linked ? " on" : " off") + (just ? (linked ? " k2t-in" : " k2t-out") : ""));
      lk.style.setProperty("--c", colorOf(t) || "#8b6cff");
      // a loose bundle sweeping from one plug to the other, each strand a little different
      const curves = [[40, 58, 20], [45, 54, 25], [50, 50, 17], [55, 46, 27], [60, 42, 22]].map(([a, b, k]) => `M0 ${a} C ${k} ${a - 6}, ${44 - k} ${b + 6}, 44 ${b}`);
      lk.innerHTML = `<svg viewBox="0 0 44 100" preserveAspectRatio="none" aria-hidden="true">`
        + `<g class="k2t-cab">${curves.map((d) => `<path d="${d}"/>`).join("")}</g>`
        + `<g class="k2t-lit">${curves.map((d, i) => `<path d="${d}" style="animation-delay:${-i * 0.29}s"/>`).join("")}</g></svg>`
        + `<i class="k2t-plug k2t-pl"></i><i class="k2t-plug k2t-pr"></i>`;
      lk.title = linked ? "Linked: plays the pattern's notes. Click to unlink it and give it its own notes" : "Unlinked: its own notes (its colour in the MIDI). Click to link it back to the pattern's notes";
      lk.onclick = (e) => {
        e.stopPropagation();
        KT2.justLinked = { id: t.id, on: !linked };
        if (window.KT2Juice) { const S = KT2Juice.sound; (linked ? S.unplug : S.plug) && (linked ? S.unplug() : S.plug()); }
        run("setLayerLinked", { trackId: t.id, linked: !linked }).then(refresh);
      };
      card.classList.toggle("k2t-own", !linked);
      card.style.setProperty("--c", colorOf(t) || "#8b6cff");
      if (just && card.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {   // a wobble: big when it links, small when it lets go
        const a = just.on ? 1 : 0.4;
        requestAnimationFrame(() => card.animate([{ rotate: "0deg", scale: "1" }, { rotate: `${-1.6 * a}deg`, scale: `${1 + 0.035 * a}` }, { rotate: `${1.1 * a}deg` }, { rotate: `${-0.5 * a}deg` }, { rotate: "0deg", scale: "1" }], { duration: just.on ? 520 : 360, easing: "ease-out" }));
      }
      card.append(lk);
        return card;
  }
  async function addLayer(c, key = "builtin:toymachine") {
    // synths stack on the pattern itself (Eman, 1 Nov): no new row, no new pattern
    if (key !== "builtin:toydrums") {
      const r = await run("addSynthLayer", { clipId: c.id, key });
      if (!r || !r.ok) return;
      refresh();
      return toast(`${key === "builtin:blob" ? "BLOB" : "TOY MACHINE"} stacked on this pattern. Pick its sound with < >, OCT moves it up or down.`);
    }
    const r = await run("newInstrumentLane", { key });
    if (!r || !r.trackId) return;
    const bars = Math.max(1, Math.round(c.length / secPerBar()));
    const m = await run("newMidiClip", { trackId: r.trackId, start: c.start, bars });
    if (key === "builtin:toydrums") {   // drums don't copy the melody: an empty KILLDRUM pattern under it
      if (m && m.clipId) { ui.selectedClip = m.clipId; render(); }
      return toast("KILLDRUM on a new row, same spot. Double-click the pattern to open it.");
    }
    if (m && m.clipId) await run("setMidiNotes", { clipId: m.clipId, notes: structuredClone(c.notes || []) });
    toast(`A ${key === "builtin:blob" ? "BLOB" : "TOY MACHINE"} layer on a new row plays the same notes. Pick its sound with < >.`);
  }

  // ------------------------------------------------------------------ MIDI
  T.midi = (pane, c) => {
    if (!c) return empty(pane, "Pick a clip to see its notes.");
    if (c.kind !== "midi") {
      // two ways to MIDI (the design mock's choice): the notes played by TOY MACHINE, or the whole
      // sound rebuilt (split into stems: drums to KILLDRUM, the rest to TOY MACHINEs, one compound)
      const q = h("div", "k2t-choose");
      const card = (icon, title, text, onClick) => {
        const b = h("button", "k2t-choice");
        b.innerHTML = icon;
        b.append(h("b", null, title), h("small", null, text));
        b.onclick = onClick;
        q.append(b);
        return b;
      };
      card('<svg width="40" height="22" viewBox="0 0 40 22"><path d="M1 11h2M5 6v10M8 3v16M11 8v6M14 1v20M17 7v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M22 11h4m-2-3 3 3-3 3" stroke="#6f6b7c" stroke-width="1.5" fill="none" stroke-linecap="round"/><rect x="30" y="4" width="8" height="3.4" rx="1.7" fill="currentColor"/><rect x="31" y="10" width="8" height="3.4" rx="1.7" fill="currentColor"/><rect x="30" y="16" width="6" height="3.4" rx="1.7" fill="currentColor"/></svg>',
        "FROM AUDIO SOURCE", "The notes in this sound, played by TOY MACHINE on a new lane under it.", () => {
          const it = window.killtoyConvert && killtoyConvert.menuItems(c, run, toast, openConverted)[0];
          if (it) it.run(); else toast("Convert needs the engine's MIDI tools.");
        });
      card('<svg width="40" height="22" viewBox="0 0 40 22"><path d="M1 11h2M5 6v10M8 3v16M11 8v6M14 1v20M17 7v8" stroke="#6f6b7c" stroke-width="1.8" stroke-linecap="round"/><path d="M22 11h4m-2-3 3 3-3 3" stroke="#6f6b7c" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="34" cy="7" r="3.2" fill="none" stroke="#9f7bff" stroke-width="1.6"/><path d="M30 18h8" stroke="#e4ff3a" stroke-width="2.4" stroke-linecap="round"/></svg>',
        "RECREATE THE SOUNDS", "Split into stems, then rebuilt: KILLDRUM for the drums, TOY MACHINE for the bass and melodic parts. Several? You get a compound clip with a lane for each.",
        () => recreate(c));
      return pane.append(q);
    }
    // the real note editor, right here in the footer (Eman, 31 Oct); MIDI (the title) opens it big
    if (window.TmMidi) {
      const big = h("button", "k2t-bigbtn", "MIDI");
      big.innerHTML = 'MIDI <svg viewBox="0 0 16 16" width="9" height="9"><path d="M2 6V2h4M2 2l4.5 4.5M10 2h4v4M14 2 9.5 6.5M2 10v4h4M2 14l4.5-4.5M10 14h4v-4M14 14 9.5 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';   // expand: four arrows out (Eman, 31 Oct)
      big.title = "Open it big (notes and the instrument side by side)";
      big.onclick = () => openRoll(c);
      const host = T._midiHost || (T._midiHost = h("div", "iw-tmidi k2t-tmidi"));
      pane.append(host);
      const live = () => {
        const fc = findClip(c.id);
        if (!fc || !host.isConnected) return;
        const iwm = document.getElementById("iw-tmidi");
        if (iwm && !iwm.hidden && iwm.offsetParent) return;   // the big window has the editor right now
        TmMidi.show(host, fc.track.id, c.id);
        const bar = host.querySelector(".tmm-bar");
        if (bar && !bar.querySelector(".k2t-bigbtn")) bar.prepend(big);
      };
      T.midiLive = live;
      requestAnimationFrame(live);
      return;
    }
    const bar0 = head("MIDI", `${(c.notes || []).length} notes · double-click the clip or open the piano roll to edit`);
    const open = h("button", "k2t-go", "BIGGER");
    open.title = "The big window: notes, the instrument, or both side by side (SPLIT)";
    open.onclick = () => openRoll(c);
    bar0.append(open);
    const cv = h("canvas", "k2t-roll");
    pane.append(bar0, cv);
    requestAnimationFrame(() => {
      const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const g = cv.getContext("2d"), notes = c.notes || [];
      if (!notes.length) return;
      const beats = c.beats || c.length / (60 / bpm());
      const lo = Math.min(...notes.map((n) => n.pitch)) - 1, hi = Math.max(...notes.map((n) => n.pitch)) + 1, rows = hi - lo + 1;
      g.fillStyle = "rgba(255,255,255,0.035)";
      for (let i = 0; i < rows; i++) if ([1, 3, 6, 8, 10].includes((lo + i) % 12)) g.fillRect(0, cv.height - (i + 1) * (cv.height / rows), cv.width, cv.height / rows);
      g.fillStyle = colorOf(c.track);
      for (const n of notes) {
        const x = (n.start / beats) * cv.width, w = Math.max(3, (n.length / beats) * cv.width), y = cv.height - (n.pitch - lo + 1) * (cv.height / rows);
        g.fillRect(x, y + 1, w - 1, Math.max(2, cv.height / rows - 2));
      }
    });
    cv.title = "Click to open the piano roll";
    cv.onclick = () => openRoll(c);
  };

  // the MIDI pill's two ways (mock v82)
  T.fromSource = (c) => {
    const it = window.killtoyConvert && killtoyConvert.menuItems(c, run, toast, openConverted)[0];
    if (it) it.run(); else toast("Convert needs the engine's MIDI tools.");
  };

  // ------------------------------------------------------------------ WARP
  T.warp = (pane, c) => {
    if (!c || c.kind === "midi" || c.lane) return empty(pane, "WARP is for sounds. Pick an audio clip.");
    const ob = (c.orig && c.orig.bpm) || c.bpm || 0;
    const top = head("WARP", `ORIG ${ob ? Math.round(ob) : "?"} → SONG ${Math.round(bpm())} BPM · the yellow marks are its hits; loops from the Samples drawer are stretched to the song when you add them`);
    const cv = h("canvas", "k2t-wave");
    pane.append(top, cv);
    booth("getPeaks", { clipId: c.id, buckets: 1400 }).then((p) => {
      if (!p || !p.peak) return;
      const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const g = cv.getContext("2d"), max = p.max || p.peak, min = p.min || p.peak.map((v) => -v), n = max.length, W = cv.width, H = cv.height, mid = H / 2;
      let loud = 0.02;
      for (let i = 0; i < n; i++) loud = Math.max(loud, max[i], -min[i]);
      const k = (H / 2 - 14 * dpr) / loud;
      // beat grid
      const spb = 60 / bpm(), beats = c.length / spb;
      g.fillStyle = "rgba(255,255,255,0.05)";
      for (let b = 0; b <= beats; b++) g.fillRect((b / beats) * W, 0, b % 4 ? 1 : 2, H);
      g.fillStyle = colorOf(c.track);
      for (let x = 0; x < W; x++) {
        const i = Math.floor((x / W) * n);
        g.fillRect(x, mid - max[i] * k, 1, Math.max(1, (max[i] - min[i]) * k));
      }
      // hits: where the level jumps up (a simple onset finder on the peaks)
      const env = max.map((v, i) => Math.max(v, -min[i]));
      let last = -99;
      g.fillStyle = "#e4ff3a";
      for (let i = 3; i < n; i++) {
        const before = (env[i - 1] + env[i - 2] + env[i - 3]) / 3;
        if (env[i] > loud * 0.32 && env[i] > before * 1.8 && i - last > n / Math.max(8, beats * 2)) {
          last = i;
          const x = (i / n) * W;
          g.fillRect(x, 10 * dpr, 1, H - 10 * dpr);
          g.beginPath(); g.moveTo(x - 5 * dpr, 0); g.lineTo(x + 5 * dpr, 0); g.lineTo(x, 8 * dpr); g.fill();
        }
      }
    });
  };

  // ------------------------------------------------------------------ MASTR
  const STYLES = [
    { id: "even", name: "EVEN", sub: "any style", fx: [/^EQ$/, /^Compressor$/], why: "balanced tone and gentle glue, safe on anything" },
    { id: "heat", name: "HEAT", sub: "rap · reggaeton", fx: [/^Drive$/, /^Compressor$/, /^SC Clip$/], why: "warm drive and a firm low end" },
    { id: "glass", name: "GLASS", sub: "pop · R&B", fx: [/^EQ$/, /^Squash$/], why: "clean, bright and wide" },
    { id: "cassette", name: "CASSETTE", sub: "lo-fi · indie", fx: [/^Crush$/, /^EQ$/, /^Compressor$/], why: "soft, worn and a little crunchy" },
    { id: "vast", name: "VAST", sub: "ambient · electronic", fx: [/^Space$/, /^Compressor$/], why: "big room around everything" },
    { id: "film", name: "FILM", sub: "score · dark", fx: [/^EQ$/, /^Reverb$/, /^Compressor$/], why: "dark and deep" },
    { id: "slam", name: "SLAM", sub: "trap · rage", fx: [/^Loud$/, /^SC Clip$/], why: "as loud as it goes, clipped hard" },
  ];
  const M = { style: null, adv: false, match: true, before: false };
  T.master = (pane) => {
    const s = ui.state, mt = masterTrack();
    if (!s.master) return empty(pane, "This engine has no master yet.");
    const top = h("div", "k2t-mtop");
    const title = h("b", "k2t-mtitle", "MASTR");
    const ba = h("div", "k2-seg k2t-ba");
    const anyOn = (mt.plugins || []).some((p) => p.enabled);
    for (const [k, on] of [["BEFORE", !anyOn], ["AFTER", anyOn]]) {
      const b = h("button", on ? "on" : "", k);
      b.title = k === "BEFORE" ? "Hear the song without the master chain" : "Hear it through the master chain";
      b.onclick = () => { if (!on && (mt.plugins || []).length) run("bypassAll", { trackId: "master" }).then(refresh); };
      ba.append(b);
    }
    const match = h("button", "k2t-pill" + (M.match ? " on" : ""), "MATCH VOLUME");
    match.title = "BEFORE plays at the same loudness as AFTER, so you judge the sound, not the volume";
    match.onclick = () => { M.match = !M.match; applyMatch(); refresh(); };
    const style = STYLES.find((x) => x.id === M.style);
    const info = h("span", "k2t-minfo", style ? `${style.name} · ${style.why}` : (mt.plugins || []).length ? (mt.plugins || []).map((p) => p.name).join(" → ") : "Pick a style, or ANALYSE to get one picked for this song");
    const sa = h("div", "k2-seg k2t-sa");
    for (const [k, adv] of [["STYLES", false], ["ADVANCED", true]]) {
      const b = h("button", M.adv === adv ? "on" : "", k);
      b.onclick = () => { M.adv = adv; if (adv) { selectTrack("master"); window.KT2 && KT2.openTab && KT2.openTab("fx"); } else refresh(); };
      sa.append(b);
    }
    top.append(title, ba, match, info, sa);
    const grid = h("div", "k2t-styles");
    const an = h("button", "k2t-style an");
    an.innerHTML = "<b>ANALYSE</b><small>press to pick</small>";
    an.title = "Picks a style from the song's tempo and key";
    an.onclick = () => {
      const b = bpm(), minor = s.key && s.key.minor;
      const pick = b >= 135 ? "slam" : b >= 112 ? (minor ? "heat" : "glass") : b < 95 ? (minor ? "film" : "cassette") : minor ? "vast" : "even";
      applyStyle(STYLES.find((x) => x.id === pick), `ANALYSE: ${Math.round(b)} BPM${minor ? ", minor" : ""}, so `);
    };
    grid.append(an);
    for (const st of STYLES) {
      const b = h("button", "k2t-style" + (M.style === st.id ? " on" : ""));
      b.innerHTML = `<b>${st.name}</b><small>${st.sub}</small>`;
      b.title = st.why;
      b.onclick = () => applyStyle(st);
      grid.append(b);
    }
    const meter = h("div", "k2t-lufs");
    meter.innerHTML = "<small>OUT</small><i></i><i></i>";
    const body = h("div", "k2t-mbody");
    body.append(grid, meter);
    pane.append(top, body);
  };
  async function applyStyle(st, lead = "") {
    const list = await booth("listPlugins");
    const all = (list && (list.plugins || list)) || [];
    await run("clearEffects", { trackId: "master" });
    for (const re of st.fx) { const p = all.find((x) => re.test(x.name)); if (p) await run("addPlugin", { trackId: "master", key: p.key }); }
    M.style = st.id;
    applyMatch();
    toast(`${lead}${st.name} on the master: ${st.why}.`);
    refresh();
  }
  T.applyStyle = (name) => { const st = STYLES.find((x) => x.name === String(name).toUpperCase()); if (st) applyStyle(st); };
  function applyMatch() { /* the playground plays the chain as is; MATCH VOLUME is kept for the Mac engine's loudness match */ }
  const meterTick = () => {
    const m = document.querySelector(".k2t-lufs");
    if (m && ui.transport && ui.transport.master) {
      const pk = ui.transport.master.peak ?? -100, pct = Math.max(0, Math.min(100, ((pk + 48) / 48) * 100));
      m.querySelectorAll("i").forEach((x, i) => (x.style.height = Math.max(2, pct - i * 3) + "%"));
    }
    requestAnimationFrame(meterTick);
  };
  requestAnimationFrame(meterTick);

  // ------------------------------------------------------------------ PITCH
  const P = { clipId: null, notes: null, key: null };
  T.pitch = (pane, c) => {
    if (!c || c.kind === "midi" || c.lane) return empty(pane, "PITCH shows a vocal's notes. Pick a vocal clip.");
    const k = ui.state.key || {};
    const top = head("PITCH", `KEY ${k.tonic != null ? NAMES[k.tonic] + (k.minor ? " minor" : " major") : "--"} · drag a note up or down, it snaps to the key and you hear it at once`);
    const apply = h("button", "k2t-go", "APPLY"), reset = h("button", "k2t-go ghost", "RESET"), full = h("button", "k2t-go ghost", "OPEN TUNE");
    apply.title = "Render the moved notes into the clip (Cmd+Z undoes)";
    reset.title = "Put every note back";
    full.onclick = () => openTune(findClip(c.id));
    top.append(reset, apply, full);
    const cv = h("canvas", "k2t-pitch");
    pane.append(top, cv);
    const draw = () => drawPitch(cv, c);
    if (P.clipId === c.id && P.notes) draw();
    else {
      P.clipId = c.id; P.notes = null;
      booth("trackPitch", { clipId: c.id }).then((r) => {
        if (P.clipId !== c.id) return;
        P.notes = ((r && r.notes) || []).map((n) => ({ ...n, target: n.target != null ? n.target : Math.round(n.midi) }));
        draw();
      });
    }
    reset.onclick = () => { if (!P.notes) return; P.notes.forEach((n) => (n.target = Math.round(n.midi))); booth("previewTune", { clipId: c.id, notes: null }); draw(); };
    apply.onclick = () => {
      if (!P.notes) return;
      run("tune", { clipId: c.id, notes: P.notes }).then((r) => r && !r.error && toast("Tuning the clip. It swaps in when it's ready."));
      P.clipId = null;
    };
    cv.addEventListener("mousedown", (e) => pitchDrag(e, cv, c, draw));
  };
  function inKey(m) {
    const k = ui.state.key;
    if (!k || k.tonic == null) return true;
    const scale = k.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    return scale.includes((((m - k.tonic) % 12) + 12) % 12);
  }
  function view(c) {
    const ns = P.notes || [];
    const lo = Math.floor(Math.min(...ns.map((n) => Math.min(n.midi, n.target)), 60)) - 2, hi = Math.ceil(Math.max(...ns.map((n) => Math.max(n.midi, n.target)), 64)) + 2;
    return { lo, hi, len: c.length };
  }
  function drawPitch(cv, c) {
    const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    if (!r.width) return;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, v = view(c), rows = v.hi - v.lo + 1, rh = H / rows;
    for (let m = v.lo; m <= v.hi; m++) {
      const y = H - (m - v.lo + 1) * rh;
      g.fillStyle = inKey(m) ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.18)";
      g.fillRect(0, y, W, rh - 1);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.font = `${9 * dpr}px Inter, sans-serif`;
      if (rh > 9 * dpr) g.fillText(NAMES[((m % 12) + 12) % 12], 4 * dpr, y + rh * 0.7);
    }
    if (!P.notes) { g.fillStyle = "rgba(255,255,255,0.5)"; g.fillText("Listening to the notes…", 40 * dpr, H / 2); return; }
    const col = colorOf(c.track);
    for (const n of P.notes) {
      const x = (n.start / v.len) * W, w = Math.max(4 * dpr, ((n.end - n.start) / v.len) * W);
      const moved = Math.abs(n.target - n.midi) > 0.05;
      if (moved) { g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x, H - (n.midi - v.lo + 1) * rh + rh * 0.2, w, rh * 0.6); }
      g.fillStyle = moved ? "#e4ff3a" : col;
      const y = H - (n.target - v.lo + 1) * rh;
      g.beginPath(); g.roundRect ? g.roundRect(x, y + rh * 0.15, w, rh * 0.7, rh * 0.35) : g.rect(x, y + rh * 0.15, w, rh * 0.7); g.fill();
    }
  }
  function pitchDrag(e, cv, c, draw) {
    if (!P.notes || e.button !== 0) return;
    const r = cv.getBoundingClientRect(), v = view(c), rows = v.hi - v.lo + 1, rh = r.height / rows;
    const t = ((e.clientX - r.left) / r.width) * v.len, m = v.lo + (r.height - (e.clientY - r.top)) / rh - 1;
    const n = P.notes.find((x) => t >= x.start && t <= x.end && Math.abs(x.target + 0.5 - m) < 1.6);
    if (!n) return;
    e.preventDefault();
    const y0 = e.clientY, base = n.target;
    const move = (ev) => {
      let to = Math.round(base + (y0 - ev.clientY) / rh);
      if (!inKey(to)) to += (y0 - ev.clientY) > 0 ? 1 : -1;   // snaps to the key
      if (!inKey(to)) to = Math.round(base);
      if (to !== n.target) { n.target = to; draw(); }
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      booth("previewTune", { clipId: c.id, notes: P.notes });
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  // ------------------------------------------------------------------ STEMS
  T.stems = (pane, c) => {
    const stems = ui.state.tracks.filter((t) => t.role === "stem");
    const top = head("STEMS", "split by the AI tools · S solos, M mutes");
    if (c && c.kind !== "midi" && !c.lane) {
      const go = h("button", "k2t-go", "SPLIT " + c.name.slice(0, 24).toUpperCase());
      go.onclick = () => run("splitStems", { clipId: c.id }).then((r) => r && r.ok && toast("Splitting. The stems arrive as their own rows."));
      top.append(go);
    }
    pane.append(top);
    const list = h("div", "k2t-stems");
    if (!stems.length) list.append(h("div", "k2t-note", c && c.kind !== "midi" ? "No stems yet. SPLIT turns the picked sound into vocals, drums, bass and music." : "No stems yet. Pick a sound and press SPLIT."));
    for (const t of stems) {
      const r = h("div", "k2t-stem");
      r.style.setProperty("--c", colorOf(t));
      const s = h("button", t.solo ? "on" : "", "S"), m = h("button", t.muted ? "on" : "", "M");
      s.onclick = () => run("toggleSolo", { trackId: t.id }).then(refresh);
      m.onclick = () => run("toggleMute", { trackId: t.id }).then(refresh);
      r.append(h("i"), h("span", null, t.name), s, m);
      list.append(r);
    }
    pane.append(list);
  };
})();
