// KILLTOY 2: BPM + KEY on every audio clip (Eman, 6 Nov 15:22; not on MIDI, 15:44).
// In the clip's name bar, before MUTE: "140 [A]  F#m [A]". A (auto) on = the clip follows the project's
// tempo / key, and keeps following when the project changes. A off = it plays its own: the original,
// or whatever is picked in the dropdown (click the number or the key). The dropdowns always show the
// original in brackets. A sound dropped into an empty project asks which way to match.
// Engine: setClipBpmKey in playground.js. KT2_CLIPKEY_OFF = true hides all of it. Keep it ASCII-only.
"use strict";

window.KT2ClipKey = (function () {
  if (!document.documentElement.classList.contains("kt2") || window.KT2_CLIPKEY_OFF) return null;
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const fmtB = (b) => (b ? String(Math.round(b * 10) / 10) : "?");
  const keyParse = (k) => { const m = String(k || "").match(/^([A-G]#?)(m?)$/); return m ? { tonic: NOTES.indexOf(m[1]), minor: !!m[2] } : null; };
  const songBpm = () => Math.round(((ui.state && ui.state.bpm) || 120) * 10) / 10;
  const songKeyName = () => { const k = ui.state && ui.state.key; return k && k.tonic != null ? NOTES[k.tonic] + (k.minor ? "m" : "") : ""; };
  const stop = (n) => { for (const ev of ["mousedown", "pointerdown", "dblclick"]) n.addEventListener(ev, (e) => e.stopPropagation()); };
  const send = (c, args) => run("setClipBpmKey", { clipId: c.id, ...args }).then((r) => { if (r && r.error) toast(r.error, true); return r; });

  // ---- the chips in the clip's name bar
  function chips(c, t) {
    if (!window.KT2_bkOf || t.kind === "bus") return null;
    if (c.kind === "midi" && !window.KT2_CLIPKEY_MIDI) return null;   // audio only (Eman, 6 Nov 15:44); KT2_CLIPKEY_MIDI = on MIDI too
    const bk = KT2_bkOf(t, c);
    if (!bk) return null;
    const box = document.createElement("span");
    box.className = "k2bk";
    stop(box);
    const part = (kind, val, on, tip) => {
      const v = document.createElement("b");
      v.className = "k2bk-v"; v.textContent = val; v.title = tip;
      v.onclick = (e) => { e.stopPropagation(); (kind === "bpm" ? bpmMenu : keyMenu)(v, c, t); };
      const a = document.createElement("i");
      a.className = "k2bk-a" + (on ? " on" : "");
      a.textContent = "A";
      a.title = on ? `Follows the project's ${kind === "bpm" ? "tempo" : "key"}. Click to play it as it came in` : `Click to follow the project's ${kind === "bpm" ? "tempo" : "key"}`;
      a.onclick = (e) => { e.stopPropagation(); send(c, kind === "bpm" ? { tempo: !on } : { key: !on }); };
      v.classList.toggle("on", !!on);
      if (window.KT2_BK_A_AFTER) box.append(v, a); else box.append(a, v);   // A in front (Eman, 6 Nov 19:06); KT2_BK_A_AFTER = old order
    };
    if (bk.unknown) {
      const q = document.createElement("b");
      q.className = "k2bk-v k2bk-q"; q.textContent = "BPM / KEY ?"; q.title = "Click to listen for its tempo and key";
      q.onclick = (e) => { e.stopPropagation(); q.textContent = "LISTENING..."; send(c, {}); };
      box.append(q);
      return box;
    }
    part("bpm", bk.bpm ? fmtB(bk.bpm) + " BPM" : "-- BPM", bk.tempo, "Tempo. Click to pick one");
    if (bk.key || !bk.drums) part("key", bk.key || "--", bk.keyAuto, "Key. Click to pick one");
    return box;
  }

  // ---- the dropdowns
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; removeEventListener("pointerdown", outside, true); } }
  function outside(e) { if (pop && !pop.contains(e.target)) closePop(); }
  function openPop(anchor, cls) {
    closePop();
    pop = document.createElement("div");
    pop.className = "k2bk-pop " + cls;
    stop(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(innerWidth - 250, r.left - 8)) + "px";
    pop.style.top = r.bottom + 6 + "px";
    document.body.append(pop);
    addEventListener("pointerdown", outside, true);
    return pop;
  }
  const fresh = (c) => { for (const t of ui.state.tracks) { const x = t.clips.find((y) => y.id === c.id); if (x) return [x, t]; } return [c, null]; };

  // ---- warp modes (Eman, 6 Nov 16:14): the name, one short line, and a little moving picture of what it does
  const MODES = [
    ["auto", "Auto", "Picks the best mode for the sound."],
    ["full", "Full", "Changes tempo, keeps pitch. Works on anything."],
    ["tape", "Tape", "Tempo and pitch change together, like a tape."],
    ["slice", "Slice", "Moves each hit to the new tempo without changing it. Best for drums."],
    ["slicestretch", "Slice Stretch", "Moves each hit and stretches its tail to fill the gap. Best for drum loops."],
    ["solo", "Solo", "Changes tempo, keeps pitch and voice character. Best for vocals and single instruments."],
    ["texture", "Texture", "Chops sound into tiny grains for a textured, lo-fi stretch. Best for pads and FX."],
  ];
  // a wave as y(x) on 0..W; before = 3 hits (or a tone / a pad), after = what the mode makes of it at a slower tempo
  function modeArt(id) {
    const W = 92, N = 368, P = 30, P2 = 40, k = P2 / P, A = 6.5;
    const hit = (t, decay, per, cut) => (t < 0 || (cut && t >= cut) ? 0 : Math.exp(-t / decay) * Math.sin((2 * Math.PI * t) / per));
    const drums = (x) => hit(x % P, 6, 4.5), tone = (x) => Math.sin((2 * Math.PI * x) / 4.5) * (0.35 + 0.65 * Math.pow(Math.sin((Math.PI * (x % P)) / P), 2));
    const pad = (x) => Math.sin((2 * Math.PI * x) / 5) * (0.55 + 0.2 * Math.sin(x / 9));
    const grain = (x) => { const g = Math.floor(x / 7), f = (x % 7) / 7; return (f < 0.7 ? Math.sin(Math.PI * f / 0.7) : 0) * Math.sin((2 * Math.PI * x) / 5) * (0.4 + 0.6 * Math.abs(Math.sin(g * 2.7))); };
    const F = {
      auto: [drums, (x) => (x % P2 < 8 ? hit(x % P2, 7, 4.5) : hit(x % P2, 7 * k, 4.5))],
      full: [drums, (x) => hit(x % P2, 6 * k, 4.5) * Math.min(1, (x % P2) / 1.5)],
      tape: [drums, (x) => hit(x % P2, 6 * k, 4.5 * k)],
      slice: [drums, (x) => hit(x % P2, 6, 4.5, P)],
      slicestretch: [drums, (x) => hit(x % P2, (x % P2) < 6 ? 7 : 7 * k * 1.25, 4.5)],
      solo: [tone, (x) => Math.sin((2 * Math.PI * x) / 4.5) * (0.35 + 0.65 * Math.pow(Math.sin((Math.PI * (x % P2)) / P2), 2))],
      texture: [pad, grain],
    }[id];
    const path = (f, y0) => { let d = ""; for (let i = 0; i <= N; i++) { const x = (i * W) / N; d += (i ? "L" : "M") + x.toFixed(1) + " " + (y0 - f(x) * A).toFixed(1); } return d; };
    const b = path(F[0], 8), a1 = path(F[0], 23), a2 = path(F[1], 23);
    return `<svg viewBox="0 0 ${W} 31" width="${W}" height="31"><path d="${b}" style="fill:none;stroke:#77767f;stroke-width:0.9"/>` +
      `<path d="${a1}" style="fill:none;stroke:#8b6cff;stroke-width:1.1"><animate attributeName="d" values="${a1};${a2};${a2};${a1}" keyTimes="0;0.4;0.8;1" dur="2.6s" repeatCount="indefinite"/></path></svg>`;
  }

  function bpmMenu(anchor, c0, t0) {
    const p = openPop(anchor, "k2bk-bpm");
    let timer = 0, val = 0;
    const paint = () => {
      const [c, t] = fresh(c0), bk = KT2_bkOf(t || t0, c);
      if (!val) val = bk.bpm || songBpm();
      const isOrig = !bk.tempo && bk.ob && Math.abs((bk.bpm || 0) - bk.ob) < 0.05;
      // ORIGINAL | PROJECT as one switch, left and right (Eman, 6 Nov 16:11); KT2_BK_ROWS = the two rows
      const pick = window.KT2_BK_ROWS
        ? `<button class="k2bk-opt${bk.tempo ? " on" : ""}" data-set="song"><i>A</i>FOLLOW THE PROJECT <em>${fmtB(songBpm())}</em></button>
           ${bk.ob ? `<button class="k2bk-opt${isOrig ? " on" : ""}" data-set="orig">ORIGINAL <em>${fmtB(bk.ob)}</em></button>` : ""}`
        : `<div class="k2bk-sw"><button data-set="orig" class="${isOrig ? "on" : ""}"${bk.ob ? "" : " disabled"}><small>ORIGINAL</small>${bk.ob ? fmtB(bk.ob) : "--"}</button>` +
          `<button data-set="song" class="${bk.tempo ? "on" : ""}"><small><i>A</i>PROJECT</small>${fmtB(songBpm())}</button></div>`;
      const mode = bk.mode || "auto";
      p.innerHTML = `<div class="k2bk-h">BPM <small>(original ${bk.ob ? fmtB(bk.ob) : "unknown"})</small></div>
        <div class="k2bk-num"><button data-d="-1">&minus;</button><input value="${fmtB(val)}" inputmode="decimal"><button data-d="1">+</button></div>
        <div class="k2bk-row"><button data-set="half">&frac12;</button><button data-set="double">&times;2</button></div>
        ${pick}
        ${bk.midi ? "" : `<div class="k2bk-h">WARP MODE</div><div class="k2bk-modes">${MODES.map(([id, nm, tx]) =>
          `<button data-mode="${id}" class="${id === mode ? "on" : ""}"><span class="k2bk-art">${modeArt(id)}</span><span class="k2bk-mt"><b>${nm}</b><small>${tx}</small></span></button>`).join("")}</div>`}`;
      const inp = p.querySelector("input");
      inp.onkeydown = (e) => { if (e.key === "Enter") { const v = parseFloat(inp.value); if (v >= 40 && v <= 250) { val = v; apply(c); } } if (e.key === "Escape") closePop(); };
      place(p, anchor);
    };
    const apply = (c) => { clearTimeout(timer); timer = setTimeout(() => send(c, { bpm: Math.round(val * 10) / 10 }).then(() => pop && paint()), 350); };
    p.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const [c, t] = fresh(c0), bk = KT2_bkOf(t || t0, c);
      if (b.dataset.mode) { p.querySelectorAll(".k2bk-modes button").forEach((x) => x.classList.toggle("on", x === b)); p.classList.add("busy"); return send(c, { mode: b.dataset.mode }).then(() => { p.classList.remove("busy"); if (pop) paint(); }); }
      if (b.dataset.d) { val = Math.max(40, Math.min(250, Math.round(val) + Number(b.dataset.d))); p.querySelector("input").value = fmtB(val); return apply(c); }
      const s = b.dataset.set;
      if (s === "song") { val = 0; return send(c, { tempo: true }).then(() => pop && paint()); }
      if (s === "orig") { val = 0; return send(c, { tempo: false }).then(() => pop && paint()); }
      if (s === "half" || s === "double") { val = Math.max(40, Math.min(250, (val || bk.bpm || songBpm()) * (s === "half" ? 0.5 : 2))); paint(); return apply(c); }
    });
    paint();
  }
  // keep a dropdown on the screen (it opens under the clip, and can be tall)
  function place(p, anchor) {
    const r = anchor.getBoundingClientRect(), h = p.offsetHeight;
    let top = r.bottom + 6;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - 6 - h);
    if (top + h > innerHeight - 8) top = Math.max(8, innerHeight - 8 - h);
    p.style.top = top + "px";
    p.style.left = Math.max(8, Math.min(innerWidth - p.offsetWidth - 8, r.left - 8)) + "px";
  }

  function keyMenu(anchor, c0, t0) {
    const p = openPop(anchor, "k2bk-key");
    const paint = () => {
      const [c, t] = fresh(c0), bk = KT2_bkOf(t || t0, c), cur = keyParse(bk.key) || { tonic: -1, minor: true };
      const minor = cur.tonic < 0 ? !!(keyParse(bk.okey) || { minor: true }).minor : cur.minor;
      p.dataset.minor = minor ? "1" : "";
      p.innerHTML = `<div class="k2bk-h">KEY <small>(original ${bk.okey || "unknown"})</small></div>
        <div class="k2bk-notes">${NOTES.map((n, i) => `<button data-t="${i}" class="${i === cur.tonic ? "on" : ""}">${n}</button>`).join("")}</div>
        <div class="k2bk-row"><button data-m="1" class="${minor ? "on" : ""}">MINOR</button><button data-m="0" class="${minor ? "" : "on"}">MAJOR</button></div>
        ${window.KT2_BK_ROWS ? `<button class="k2bk-opt${bk.keyAuto ? " on" : ""}" data-set="song"><i>A</i>FOLLOW THE PROJECT <em>${songKeyName() || "--"}</em></button>
        ${bk.okey ? `<button class="k2bk-opt${!bk.keyAuto && bk.key === bk.okey ? " on" : ""}" data-set="orig">ORIGINAL <em>${bk.okey}</em></button>` : ""}`
        : `<div class="k2bk-sw"><button data-set="orig" class="${!bk.keyAuto && bk.key === bk.okey ? "on" : ""}"${bk.okey ? "" : " disabled"}><small>ORIGINAL</small>${bk.okey || "--"}</button>` +
          `<button data-set="song" class="${bk.keyAuto ? "on" : ""}"><small><i>A</i>PROJECT</small>${songKeyName() || "--"}</button></div>`}`;
      place(p, anchor);
    };
    p.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const [c, t] = fresh(c0), bk = KT2_bkOf(t || t0, c), cur = keyParse(bk.key) || keyParse(bk.okey) || { tonic: 9, minor: true };
      const go = (args) => send(c, args).then(() => pop && paint());
      if (b.dataset.t) return go({ keyTo: NOTES[+b.dataset.t] + (p.dataset.minor ? "m" : "") });
      if (b.dataset.m) {   // minor <-> major keeps the same notes (its relative key)
        const m = b.dataset.m === "1"; if (m === cur.minor) return;
        return go({ keyTo: NOTES[(cur.tonic + (m ? 9 : 3)) % 12] + (m ? "m" : "") });
      }
      if (b.dataset.set === "song") return go({ key: true });
      if (b.dataset.set === "orig") return go({ key: false });
    });
    paint();
  }

  // ---- a sound dropped into an empty project: which way do they match?
  function askEmpty(res) {
    return new Promise((done) => {
      if (!res || !res.clipId || (!res.bpm && !res.key)) return done();
      const sb = songBpm(), sk = songKeyName();
      const sameB = !res.bpm || Math.abs(res.bpm - sb) < 0.05, sameK = !res.key || res.key === sk;
      if (sameB && sameK) return done();
      const what = (b, k) => [b ? fmtB(b) + " BPM" : "", k || ""].filter(Boolean).join(" \u00b7 ");
      const bg = document.createElement("div");
      bg.className = "k2bk-ask";
      bg.innerHTML = `<div class="k2bk-askbox"><div class="k2bk-h">NEW SOUND <small>${what(res.bpm, res.key)}</small></div>
        <button data-w="proj"><b>PROJECT FOLLOWS THE SOUND</b><small>The project becomes ${what(res.bpm, res.key)}</small></button>
        <button data-w="sound"><b>SOUND FOLLOWS THE PROJECT</b><small>The sound plays at ${what(res.bpm ? sb : 0, res.key ? sk : "") || "the project's tempo"}</small></button>
        <button data-w="keep" class="k2bk-keep">LEAVE BOTH AS THEY ARE</button></div>`;
      const end = async (w) => {
        bg.remove();
        if (w === "proj") {
          if (res.bpm && !sameB) await run("setBpm", { bpm: res.bpm });
          const k = keyParse(res.key); if (k && !sameK) await run("setKey", { tonic: k.tonic, minor: k.minor });
          await run("setClipBpmKey", { clipId: res.clipId, tempo: true, key: true });
          toast(`The project is ${what(res.bpm, res.key)} now.`);
        } else if (w === "sound") {
          await run("setClipBpmKey", { clipId: res.clipId, tempo: true, key: !!sk });
          toast(`The sound plays at ${what(sb, sk)} now.`);
        }
        done();
      };
      bg.addEventListener("click", (e) => { const b = e.target.closest("button[data-w]"); if (b) end(b.dataset.w); else if (e.target === bg) end("keep"); });
      document.body.append(bg);
    });
  }

  // ---- several sounds dropped into an empty project (Eman, 7 Nov 02:42): pick the one the project is
  // based on; the others follow the project. A row per sound with its colour, tempo and key.
  function askEmptyMany(list) {
    return new Promise((done) => {
      const withInfo = list.filter((r) => r && r.clipId && (r.bpm || r.key));
      if (!withInfo.length) return done();
      const what = (b, k) => [b ? fmtB(b) + " BPM" : "", k || ""].filter(Boolean).join(" \u00b7 ") || "tempo unknown";
      const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
      const bg = document.createElement("div");
      bg.className = "k2bk-ask";
      bg.innerHTML = `<div class="k2bk-askbox k2bk-many"><div class="k2bk-h">${list.length} NEW SOUNDS <small>PICK THE ONE THE PROJECT FOLLOWS</small></div>
        ${list.map((r, i) => `<button data-i="${i}" style="--c:${r.color || "#9d5cff"}"${r.bpm || r.key ? "" : " disabled"}><i></i><b>${esc(r.name || "Sound " + (i + 1))}</b><small>${what(r.bpm, r.key)}</small></button>`).join("")}
        <p class="k2bk-note">The others play at its tempo and key.</p>
        <button data-w="keep" class="k2bk-keep">LEAVE THEM ALL AS THEY ARE</button></div>`;
      const end = async (i) => {
        bg.remove();
        if (i == null) return done();
        const r = list[i];
        if (r.bpm && Math.abs(r.bpm - songBpm()) >= 0.05) await run("setBpm", { bpm: r.bpm });
        const k = keyParse(r.key); if (k && r.key !== songKeyName()) await run("setKey", { tonic: k.tonic, minor: k.minor });
        for (const x of list) if (x && x.clipId && (x.bpm || x.key)) await run("setClipBpmKey", { clipId: x.clipId, tempo: !!x.bpm, key: !!x.key && !!songKeyName() });
        toast(`The project is ${what(r.bpm, r.key)} now, from ${r.name || "that sound"}.`);
        done();
      };
      bg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && b.dataset.i != null) end(+b.dataset.i); else if ((b && b.dataset.w === "keep") || e.target === bg) end(null); });
      document.body.append(bg);
    });
  }

  return { chips, askEmpty, askEmptyMany };
})();
