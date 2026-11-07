// KILLTOY 2: the SAMPLES tab (Eman, 7 Nov 01:30). Eight sound kits made from the sounds the
// KILLDRUM library already has (killdrum/PACKS.json, sorted by scripts/killdrum/build_packs.py):
// DOLLHOUSE, CANDY CANE, RAWS, INSOMNIA, SLUMBER, MELTDOWN, SAWTOOTH, DIGI JUNKY, 32 sounds each.
// ALL shows every kit as a card with its picture; click a kit (or its name up top) to see its
// sounds. Each row shows its waveform; press a sound to play it (on the beat while the song plays,
// like a launchpad), + puts it in the song at the marker.
// The kits also show in KILLDRUM's kit list (ui/killdrum-library.js reads the same file).
// KT2_NO_SAMPLES_TAB hides the tab. Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  if (!document.documentElement.classList.contains("kt2") || !window.KT2Tabs) return;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const SND = () => (window.KT2Juice && KT2Juice.sound) || {};
  const tick = (n) => { try { SND().tick && SND().tick(n || 2); } catch (e) { /* quiet */ } };

  const TYPE = { kick: "KICKS", "808": "808S", snare: "SNARES", clap: "CLAPS", hat_closed: "HATS", hat_open: "OPEN HATS", perc: "PERC", fx: "FX", texture: "TEXTURES" };
  const LANE = { kick: "Kick", "808": "808", snare: "Snare", clap: "Clap", hat_closed: "Hi-hat", hat_open: "Open hat", perc: "Perc", fx: "FX", texture: "Texture" };
  const ORDER = Object.keys(TYPE);

  let data = null, loading = null;
  const S = { open: "all", playing: null };   // open: "all" or a pack id
  try { S.open = localStorage.getItem("kt2.samples.open") || "all"; } catch (e) { /* fine */ }

  function load() {
    if (loading) return loading;
    const lib = window.KillDrumLib;
    loading = Promise.all([
      fetch("killdrum/PACKS.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      lib && lib.load ? lib.load().catch(() => null) : null,
    ]).then(([p]) => {
      const own = (p && p.items) || {};   // the published page has no KILLDRUM index, so PACKS.json carries its own sounds
      const item = (id) => (lib && lib.item && lib.item(id)) || own[id] || null;
      data = ((p && p.packs) || []).map((k) => ({ ...k, items: (k.sounds || []).map(item).filter(Boolean) }));
      return data;
    });
    return loading;
  }
  window.KT2Samples = { load, packs: () => data || [] };

  // ---------------------------------------------------------------- hear (Eman, 7 Nov 15:18)
  // Click a sound: it plays at once. While the song plays it waits for the next beat, like a
  // launchpad, so tapping sounds in stays in time. Each sound plays through Web Audio here (the
  // playground's own audio clock when there is one) so the hit lands on the beat; a second press
  // of the same sound restarts it, different sounds ring together. Waveforms come from the same
  // decoded audio. KT2_SAMPLES_QUANT = beats to snap to (default 1, 0 = never wait).
  const buf = new Map();      // url -> Promise<AudioBuffer|null>
  let actx = null;
  const ctx = () => {
    const pg = window.purpPlaygroundDebug && purpPlaygroundDebug.ctx;
    if (pg) return pg;
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; actx = AC ? new AC() : null; }
    return actx;
  };
  function decode(it) {
    if (!buf.has(it.url)) {
      buf.set(it.url, fetch(it.url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => {
        const c = ctx();
        return ab && c ? new Promise((ok) => c.decodeAudioData(ab, ok, () => ok(null))) : null;
      }).catch(() => null));
    }
    return buf.get(it.url);
  }
  // seconds of song time and audio time "now", and whether the song is playing
  function clock(c) {
    const tr = ui.transport || {}, dbg = window.purpPlaygroundDebug;
    const pos = dbg && dbg.songPos && dbg.ctx === c ? dbg.songPos() : (typeof songNow === "function" ? songNow() : tr.position || 0);
    return { pos, now: c.currentTime, playing: !!tr.playing };
  }
  const voices = new Map();   // sound id -> { src, g, at, dur }
  async function hear(it) {
    const c = ctx();
    if (!c) return run("previewSample", { url: it.url, path: it.file, name: it.name });
    if (c.state === "suspended") { try { await c.resume(); } catch (e) { /* fine */ } }
    const b = await decode(it);
    if (!b) return run("previewSample", { url: it.url, path: it.file, name: it.name });
    const k = clock(c);
    let at = c.currentTime + 0.005;
    const q = window.KT2_SAMPLES_QUANT != null ? +window.KT2_SAMPLES_QUANT : 1;
    if (k.playing && q > 0) {
      const step = (60 / bpm()) * q, next = Math.ceil((k.pos - 0.03) / step) * step;   // a press just after a beat still counts as that beat
      at = k.now + Math.max(0.005, next - k.pos);
    }
    const old = voices.get(it.id);
    if (old) { try { old.g.gain.setTargetAtTime(0, Math.max(c.currentTime, Math.min(at, old.at + old.dur)), 0.006); old.src.stop(at + 0.05); } catch (e) { /* gone */ } }
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = b;
    g.gain.value = Math.pow(10, ((it.gain_db || 0) - 3) / 20);
    src.connect(g); g.connect(c.destination);
    src.start(at);
    const v = { src, g, at, dur: b.duration, shown: heard(b) / b.sampleRate, ctx: c };
    voices.set(it.id, v);
    src.onended = () => { if (voices.get(it.id) === v) { voices.delete(it.id); paintPlaying(); } };
    paintPlaying();
    sweep();
  }
  function stop() {
    for (const v of voices.values()) { try { v.src.stop(); } catch (e) { /* gone */ } }
    voices.clear();
    try { run("stopPreview"); } catch (e) { /* fine */ }
    paintPlaying();
  }
  // the playing rows: a line runs across the waveform while the sound plays
  let raf = 0;
  function sweep() {
    cancelAnimationFrame(raf);
    const go = () => {
      if (!live || !live.root.isConnected) return;
      let any = false;
      live.root.querySelectorAll(".k2s-snd").forEach((row) => {
        const v = voices.get(row.dataset.id);
        const line = row.querySelector(".k2s-ph");
        if (!v) { row.classList.remove("on", "wait"); return; }
        any = true;
        const t = v.ctx.currentTime - v.at;
        row.classList.toggle("wait", t < 0);
        row.classList.toggle("on", t >= 0);
        if (line) line.style.left = Math.max(0, Math.min(1, t / v.shown)) * 100 + "%";
      });
      if (any) raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
  }
  // samples until the sound has died away (-36 dB under its peak), at least a tenth of a second
  function heard(b) {
    if (b._heard) return b._heard;
    const d = b.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i += 4) peak = Math.max(peak, Math.abs(d[i]));
    // walk back from the end in 5 ms windows until one is louder than -36 dB under the peak
    const floor = peak * 0.016, W = Math.max(64, Math.round(b.sampleRate * 0.005));
    let end = d.length;
    for (; end > W; end -= W) { let m = 0; for (let i = end - W; i < end; i++) m = Math.max(m, Math.abs(d[i])); if (m > floor) break; }
    return (b._heard = Math.min(d.length, Math.max(end + 1, Math.round(b.sampleRate * 0.1))));
  }
  // the waveform behind a row's name: min/max per pixel, drawn once the sound is decoded
  async function drawWave(cv, it) {
    const b = await decode(it);
    if (!b || !cv.isConnected) return;
    const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext("2d"), d = b.getChannelData(0), mid = (H * dpr) / 2;
    let peak = 0;
    for (let i = 0; i < d.length; i += 4) peak = Math.max(peak, Math.abs(d[i]));
    const n = heard(b);   // the silent tail is left off so the hit fills the row
    const scale = (mid * 0.92) / Math.max(0.05, peak);
    g.fillStyle = "#fff";
    const cols = cv.width;
    for (let x = 0; x < cols; x++) {
      const a = Math.floor((x / cols) * n), e = Math.max(a + 1, Math.floor(((x + 1) / cols) * n));
      let lo = 0, hi = 0;
      for (let i = a; i < e; i++) { const v = d[i]; if (v < lo) lo = v; else if (v > hi) hi = v; }
      const y0 = mid - hi * scale, y1 = mid - lo * scale;
      g.fillRect(x, y0, 1, Math.max(dpr, y1 - y0));
    }
  }
  window.KT2Samples.hear = (id) => { const it = (data || []).flatMap((k) => k.items).find((x) => x.id === id); return it ? hear(it) : null; };
  window.KT2Samples.voices = () => [...voices.entries()].map(([id, v]) => ({ id, at: v.at, now: v.ctx.currentTime }));
  async function add(it, pack) {
    stop();
    const at = typeof snapBeat === "function" ? snapBeat(ui.transport.position) : ui.transport.position;
    const r = await run("addSample", { url: it.url, path: it.file, name: it.name, trackId: null, start: Math.max(0, at), bpm: 0, origBpm: 0, key: null,
                                       laneName: (pack ? pack.name + " " : "") + (LANE[it.type] || "Sample"), libType: it.type });
    if (!r || r.error) { if (typeof toast === "function") toast((r && r.error) || "Couldn't add that sound.", true); return; }
    if (r.clipId) { ui.selectedClip = r.clipId; render(); }
    if (typeof toast === "function") toast(`${it.name} added${typeof barAt === "function" ? " at bar " + barAt(at) : ""}.`);
  }

  // ---------------------------------------------------------------- the tab
  let live = null;
  function paintPlaying() {
    if (!live || !live.root.isConnected) return;
    live.root.querySelectorAll(".k2s-snd").forEach((b) => { if (!voices.has(b.dataset.id)) b.classList.remove("on", "wait"); });
  }

  function chips(root) {
    const row = h("div", "k2s-chips");
    const mk = (id, label) => {
      const b = h("button", S.open === id ? "on" : "", label);
      b.onclick = () => { if (S.open === id) return; S.open = id; try { localStorage.setItem("kt2.samples.open", id); } catch (e) { /* fine */ } tick(3); paint(root); };
      return b;
    };
    row.append(mk("all", "ALL"), ...data.map((k) => mk(k.id, k.name)));
    return row;
  }

  function kitCard(k, i, root) {
    const c = h("button", "k2s-kit");
    c.style.setProperty("--i", i);
    const pic = h("span", "k2s-pic"), img = h("img");
    img.src = k.img; img.alt = ""; img.draggable = false;
    pic.append(img);
    const lab = h("span", "k2s-lab");
    lab.append(h("b", null, k.name), h("small", null, `${k.what.toUpperCase()} \u00b7 ${k.items.length}`));
    c.append(pic, lab);
    c.title = k.about;
    c.onclick = () => { S.open = k.id; try { localStorage.setItem("kt2.samples.open", k.id); } catch (e) { /* fine */ } tick(4); paint(root); };
    c.addEventListener("mouseenter", () => tick(i + 2));
    return c;
  }

  function kitView(k) {
    const box = h("div", "k2s-one");
    const side = h("div", "k2s-side");
    const pic = h("span", "k2s-pic"), img = h("img");
    img.src = k.img; img.alt = ""; img.draggable = false;
    pic.append(img);
    side.title = k.about;
    side.append(pic, h("b", null, k.name), h("small", null, `${k.what.toUpperCase()} \u00b7 ${k.items.length}`));
    const list = h("div", "k2s-list");
    for (const t of ORDER) {
      const of = k.items.filter((x) => x.type === t);
      if (!of.length) continue;
      const grp = h("div", "k2s-grp");
      grp.append(h("em", null, `${TYPE[t]} ${of.length}`));
      for (const it of of) {
        const b = h("div", "k2s-snd");
        b.dataset.id = it.id;
        b.title = `${it.name}\nClick to play (on the beat while the song plays). + puts it in the song at the marker`;
        const plus = h("button", "k2s-add", "+");
        plus.title = "Put it in the song at the marker";
        plus.onclick = (e) => { e.stopPropagation(); add(it, k); };
        const cv = h("canvas", "k2s-wave");
        const nm = it.name.replace(/\s*\(\d+\)$/, "");
        if (window.KT2_SAMPLES_NAME_ON_WAVE) b.append(cv, h("i", "k2s-ph"), h("span", null, nm), plus);   // old look: name drawn over the waveform
        else {
          // waveform in its own box, the name in small text underneath
          b.classList.add("k2s-under");
          const wb = h("div", "k2s-wb");
          wb.append(cv, h("i", "k2s-ph"), plus);
          b.append(wb, h("span", "k2s-nm", nm));
        }
        // pressed down = plays, like a pad (no waiting for the click to finish)
        b.addEventListener("pointerdown", (e) => { if (e.button !== 0 || e.target === plus) return; b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 120); hear(it); });
        requestAnimationFrame(() => drawWave(cv, it));
        grp.append(b);
      }
      list.append(grp);
    }
    box.append(side, list);
    return box;
  }

  function paint(root) {
    root.replaceChildren(chips(root));
    const k = data.find((x) => x.id === S.open);
    if (!k) {
      const grid = h("div", "k2s-all");
      data.forEach((x, i) => grid.append(kitCard(x, i, root)));
      root.append(grid);
      if (!window.KT2_NO_SAMPLES_FOLD && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        [...grid.children].forEach((n, i) => n.animate([{ transform: "translateY(14px) scale(0.92)", opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration: 320, delay: i * 45, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" }));
      }
    } else root.append(kitView(k));
  }

  window.KT2Tabs.samples = (pane) => {
    const root = h("div", "k2s" + (window.KT2_SAMPLES_WIDE_COVER ? " k2s-wide" : ""));
    pane.append(root);
    live = { root };
    root.append(h("div", "k2-empty", "Loading the kits..."));
    load().then(() => {
      if (!root.isConnected) return;
      if (!data.length) { root.replaceChildren(h("div", "k2-empty", "The sample kits arrive with the KILLDRUM sound library.")); return; }
      paint(root);
    });
  };

  // ---------------------------------------------------------------- looks
  const css = `
.kt2 .k2s { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.kt2 .k2s-chips { flex: none; display: flex; gap: 4px; flex-wrap: wrap; }
.kt2 .k2s-chips button { font: 700 10px var(--font); letter-spacing: 0.14em; padding: 5px 9px; color: var(--k2-ink3); background: rgba(255,255,255,0.05); border-radius: 0; }
.kt2 .k2s-chips button:hover { color: var(--k2-ink); background: rgba(255,255,255,0.09); }
.kt2 .k2s-chips button.on { color: #141218; background: var(--k2-ink); }
.kt2 .k2s-all { flex: 1; min-height: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(96px, 1fr); gap: 10px; overflow-x: auto; overflow-y: hidden; padding-bottom: 4px; }
.kt2 .k2s-kit { display: flex; flex-direction: column; gap: 6px; min-height: 0; text-align: left; border-radius: 0; padding: 0; background: none; }
.kt2 .k2s-kit .k2s-pic { flex: 1; min-height: 0; }
.kt2 .k2s-pic { display: block; position: relative; overflow: hidden; background: #111; aspect-ratio: 1 / 1; max-width: 100%; }
.kt2 .k2s-pic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .25s ease, filter .25s ease; filter: saturate(1.05); }
.kt2 .k2s-kit:hover .k2s-pic img { transform: scale(1.05); }
.kt2 .k2s-kit .k2s-pic::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); transition: box-shadow .15s; }
.kt2 .k2s-kit:hover .k2s-pic::after { box-shadow: inset 0 0 0 2px var(--k2-sel); }
.kt2 .k2s-lab { flex: none; display: flex; flex-direction: column; gap: 1px; }
.kt2 .k2s-lab b { font: 700 11px var(--font); letter-spacing: 0.12em; color: var(--k2-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt2 .k2s-lab small { font: 500 9px var(--font); letter-spacing: 0.14em; color: var(--k2-ink3); white-space: nowrap; }
.kt2 .k2s-one { flex: 1; min-height: 0; display: flex; gap: 14px; }
.kt2 .k2s-side { flex: none; width: 140px; display: flex; flex-direction: column; gap: 2px; min-height: 0; overflow: hidden; }
.kt2 .k2s-side .k2s-pic { flex: 0 1 auto; width: 100%; min-height: 30px; max-height: 140px; margin-bottom: 4px; }
/* square covers: each picture is as wide as it is tall, sized to fit the footer (KT2_SAMPLES_WIDE_COVER = old look) */
.kt2 .k2s:not(.k2s-wide) { container-type: size; }
.kt2 .k2s:not(.k2s-wide) .k2s-all { grid-auto-columns: clamp(60px, calc(100cqh - 76px), 220px); }
.kt2 .k2s:not(.k2s-wide) .k2s-kit .k2s-pic { flex: none; width: 100%; height: auto; aspect-ratio: 1 / 1; }
.kt2 .k2s:not(.k2s-wide) .k2s-side { width: clamp(60px, calc(100cqh - 66px), 140px); }
.kt2 .k2s:not(.k2s-wide) .k2s-side .k2s-pic { flex: none; width: 100%; height: auto; min-height: 0; max-height: none; aspect-ratio: 1 / 1; }
.kt2 .k2s-side b { overflow-wrap: anywhere; line-height: 1.15; }
.kt2 .k2s-side b { font: 700 13px var(--font); letter-spacing: 0.12em; color: var(--k2-ink); }
.kt2 .k2s-side small { font: 500 9px var(--font); letter-spacing: 0.14em; color: var(--k2-ink3); }
.kt2 .k2s-list { flex: 1; min-width: 0; overflow: auto; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 10px 16px; }
.kt2 .k2s-grp { display: flex; flex-direction: column; gap: 3px; width: 200px; }
.kt2 .k2s-grp em { font: 700 9px var(--font); font-style: normal; letter-spacing: 0.16em; color: var(--k2-ink3); padding: 0 0 2px; }
.kt2 .k2s-snd { position: relative; display: flex; align-items: center; gap: 7px; height: 28px; padding: 0 0 0 8px; cursor: pointer; background: rgba(255,255,255,0.035); color: var(--k2-ink); font: 500 11px var(--font); user-select: none; overflow: hidden; touch-action: manipulation; }
.kt2 .k2s-snd:hover { background: rgba(255,255,255,0.08); }
.kt2 .k2s-wave { position: absolute; inset: 3px 0; width: 100%; height: calc(100% - 6px); opacity: 0.3; pointer-events: none; }
.kt2 .k2s-snd:hover .k2s-wave { opacity: 0.42; }
.kt2 .k2s-snd > span { position: relative; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9); }
.kt2 .k2s-ph { position: absolute; top: 0; bottom: 0; left: 0; width: 1px; background: #fff; opacity: 0; pointer-events: none; }
.kt2 .k2s-snd.on { background: rgba(124,92,240,0.32); }
.kt2 .k2s-snd.on .k2s-wave { opacity: 0.55; }
.kt2 .k2s-snd.on .k2s-ph { opacity: 0.9; }
.kt2 .k2s-snd.wait { box-shadow: inset 0 0 0 1px var(--k2-sel); }
.kt2 .k2s-snd.hit { background: rgba(124,92,240,0.5); }
.kt2 .k2s-add { position: relative; flex: none; width: 26px; height: 28px; font: 600 13px var(--font); color: var(--k2-ink3); background: none; border-radius: 0; opacity: 0; }
.kt2 .k2s-snd:hover .k2s-add { opacity: 1; }
.kt2 .k2s-add:hover { color: #141218; background: var(--k2-ink); }
/* name under the waveform */
.kt2 .k2s-snd.k2s-under { flex-direction: column; align-items: stretch; gap: 3px; height: auto; padding: 0; background: none; overflow: visible; }
.kt2 .k2s-under .k2s-wb { position: relative; height: 26px; background: rgba(255,255,255,0.035); overflow: hidden; }
.kt2 .k2s-under .k2s-wave { inset: 3px 0; opacity: 0.55; }
.kt2 .k2s-under:hover .k2s-wb { background: rgba(255,255,255,0.08); }
.kt2 .k2s-under:hover .k2s-wave { opacity: 0.7; }
.kt2 .k2s-under .k2s-nm { font: 500 9px var(--font); letter-spacing: 0.04em; color: var(--k2-ink3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 1px; }
.kt2 .k2s-under:hover .k2s-nm { color: var(--k2-ink); }
.kt2 .k2s-snd.k2s-under.on { background: none; }
.kt2 .k2s-under.on .k2s-wb { background: rgba(124,92,240,0.32); }
.kt2 .k2s-under.on .k2s-wave { opacity: 0.85; }
.kt2 .k2s-under.on .k2s-nm { color: var(--k2-ink); }
.kt2 .k2s-snd.k2s-under.wait { box-shadow: none; }
.kt2 .k2s-under.wait .k2s-wb { box-shadow: inset 0 0 0 1px var(--k2-sel); }
.kt2 .k2s-snd.k2s-under.hit { background: none; }
.kt2 .k2s-under.hit .k2s-wb { background: rgba(124,92,240,0.5); }
.kt2 .k2s-under + .k2s-under { margin-top: 4px; }
.kt2 .k2s-under .k2s-add { position: absolute; right: 0; top: 0; height: 100%; }
`;
  const st = document.createElement("style");
  st.id = "kt2-samples-css";
  st.textContent = css;
  document.head.append(st);
})();
