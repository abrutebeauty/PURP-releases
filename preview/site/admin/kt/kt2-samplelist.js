// KILLTOY 2 Samples list (Eman, 12 Nov 20:52: "like the real Splice"): every sound of the connected folder
// in one flat list right away (no pack folders), a waveform on each row, search over everything, and a BPM box:
// loops play at that BPM, and land in time with the song when dropped.
// Nothing leaves the computer: names come from the folder listing, and a file is read only to draw the
// waveform of a row on screen, to play it, or to put it in the song. Waveforms live in memory only.
// KT2_SAMPLES_LIST_OLD = the old pack-folder list. Keep this file ASCII-only.
"use strict";
(function () {
  const ROW_H = 56, PEAKS = 140;
  const on = () => document.documentElement.classList.contains("kt2") && !window.KT2_SAMPLES_LIST_OLD;
  const SL = { bpm: null, inst: "", sel: null, peaks: new Map(), dur: new Map(), queue: [], busy: 0, shown: [], playT0: 0, playId: null, raf: 0, sig: "" };
  window.KT2SampleList = SL;   // tests

  // ---- names: a little more than samples.js reads (Bpm091, KIT6_150_..._C#, keys and tempos in folder names)
  function extra(s) {
    if (s._x) return s;
    s._x = true;
    const parts = s.path.split(/[\\/]/).filter(Boolean);
    parts.pop();
    const tok = s.file.replace(/\.[^.]+$/, "").split(/[\s_\-.()[\],]+/);
    if (!s.bpm) {
      const b = tok.map((t) => /^bpm(\d{2,3})$/i.exec(t) || /^(\d{2,3})bpm$/i.exec(t)).find(Boolean);
      if (b && +b[1] >= 60 && +b[1] <= 200) s.bpm = +b[1];
    }
    // a loop in a construction kit folder ("Jump__A#_126_", "NW_LL_100_kit_dimensional_Fmin") takes the folder's
    if (s.kind === "loop" && (!s.bpm || !s.key)) {
      for (let i = parts.length - 1; i >= Math.max(0, parts.length - 2); i--) {
        const p = parseSample(parts[i] + ".wav");
        if (!s.bpm && p.bpm) s.bpm = p.bpm;
        if (!s.key && p.key) s.key = p.key;
      }
    }
    s.hay = (s.name + " " + s.path.replace(/[_\-/\\.]+/g, " ") + " " + (s.key ? s.key.name : "") + " " + (s.bpm || "")).toLowerCase();
    s.inst = instOf(s.hay);
    return s;
  }
  const INST = [
    ["KICK", /\bkicks?\b|\bbd\b/], ["808", /\b808s?\b/], ["SNARE", /\bsnares?\b|\brims?\b|\brimshot/], ["CLAP", /\bclaps?\b/],
    ["HATS", /\bhi ?hats?\b|\bhats?\b|\bhh\b|\bcymbals?\b|\bride\b|\bcrash\b/], ["PERC", /\bperc(ussion)?s?\b|\bshakers?\b|\btamb|\bconga|\bbongo/],
    ["BASS", /\bbass\b|\bsub\b/], ["KEYS", /\bkeys?\b|\bpiano|\brhodes|\borgan|\bchords?\b/], ["SYNTH", /\bsynths?\b|\blead\b|\barp\b|\bpads?\b|\bpluck/],
    ["GUITAR", /\bguitars?\b/], ["VOX", /\bvox\b|\bvocals?\b|\bvoice|\bchoir|\bchants?\b|\badlibs?\b/], ["FX", /\bfx\b|\bsfx\b|\briser|\bimpact|\bsweep|\bfoley|\bambien|\bdrone|\bnoise\b|\bglitch/],
  ];
  function instOf(h) { for (const [n, re] of INST) if (re.test(h)) return n; return ""; }

  const songBpm = () => Math.round(bpm() * 10) / 10;
  const boxBpm = () => SL.bpm || songBpm();
  const rateOf = (s) => (smp.sync && s.kind === "loop" && s.bpm ? boxBpm() / s.bpm : 1);

  function filtered() {
    const words = smp.q.toLowerCase().split(/\s+/).filter(Boolean);
    return smp.items.filter((s) => {
      extra(s);
      return (smp.kind === "all" || s.kind === smp.kind) && (!smp.inKey || sampleInKey(s)) && (!SL.inst || s.inst === SL.inst)
        && words.every((w) => s.hay.includes(w));
    });
  }

  // ---- the panel
  const prevRender = renderSamples;
  renderSamples = function () { // eslint-disable-line no-func-assign
    const box = $("samples");
    if (box) box.classList.toggle("k2sl", on() && smp.items.length > 0);
    if (!on() || !smp.items.length) return prevRender();
    if (!box || box.hidden) return;
    box.replaceChildren();
    const head = el("div", "smp-head k2sl-head");
    head.append(el("div", "smp-title", "SAMPLES"), el("span", "k2sl-count", smp.items.length.toLocaleString()));
    const change = el("button", "k2sl-link", "FOLDER");
    change.title = smp.folder || "";
    change.onclick = () => connectSamples();
    head.append(change);
    if (window.killtoyLibrary) { const lb = el("button", "k2sl-link", "LIBRARY"); lb.onclick = () => window.killtoyLibrary.toggle(true); head.append(lb); }
    const close = el("button", "smp-x", "\u00d7");
    close.title = "Close (B)";
    close.onclick = () => toggleSamples(false);
    head.append(close);

    const bar = el("div", "k2sl-bar");
    const search = el("input", "smp-search k2sl-search");
    search.placeholder = "Search";
    search.value = smp.q;
    search.oninput = () => { smp.q = search.value; SL.sig = ""; renderList(); };
    search.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Escape") { search.value = ""; smp.q = ""; renderList(); search.blur(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); step(e.key === "ArrowDown" ? 1 : -1); }
      else if (e.key === "Enter") { e.preventDefault(); const s = SL.shown.find((x) => x.id === SL.sel) || SL.shown[0]; if (s) { SL.sel = s.id; previewSample(s); } }
    };
    const bpmWrap = el("label", "k2sl-bpm" + (smp.sync ? " on" : ""));
    const bpmIn = el("input");
    bpmIn.id = "k2sl-bpm";
    bpmIn.type = "text"; bpmIn.inputMode = "decimal"; bpmIn.maxLength = 5;
    bpmIn.value = String(boxBpm());
    bpmIn.title = "BPM";
    const setBox = () => {
      const v = parseFloat(bpmIn.value);
      SL.bpm = isFinite(v) && v >= 40 && v <= 250 ? Math.round(v * 10) / 10 : null;
      if (SL.bpm === songBpm()) SL.bpm = null;
      bpmIn.value = String(boxBpm());
      bpmWrap.classList.toggle("own", !!SL.bpm);
      replay();
    };
    bpmIn.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { setBox(); bpmIn.blur(); }
      else if (e.key === "Escape") { bpmIn.value = String(boxBpm()); bpmIn.blur(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); bpmIn.value = String(Math.max(40, Math.min(250, Math.round(boxBpm()) + (e.key === "ArrowUp" ? 1 : -1)))); setBox(); }
    };
    bpmIn.onblur = setBox;
    bpmWrap.classList.toggle("own", !!SL.bpm);
    const sync = el("button", "k2sl-sync", "SYNC");
    sync.onclick = (e) => { e.preventDefault(); smp.sync = !smp.sync; bpmWrap.classList.toggle("on", smp.sync); replay(); };
    bpmWrap.append(bpmIn, el("span", "k2sl-unit", "BPM"), sync);
    bar.append(search, bpmWrap);

    const chips = el("div", "smp-chips k2sl-chips");
    const chip = (label, isOn, fn) => { const b = el("button", "smp-chip" + (isOn ? " on" : ""), label); b.onclick = () => { fn(); SL.sig = ""; renderSamples(); }; return b; };
    const key = ui.state && ui.state.key && ui.state.key.name;
    chips.append(
      chip("ALL", smp.kind === "all", () => (smp.kind = "all")),
      chip("LOOPS", smp.kind === "loop", () => (smp.kind = smp.kind === "loop" ? "all" : "loop")),
      chip("ONE-SHOTS", smp.kind === "shot", () => (smp.kind = smp.kind === "shot" ? "all" : "shot")),
      chip(key ? "IN " + key.toUpperCase() : "IN KEY", smp.inKey, () => (smp.inKey = !smp.inKey)),
    );
    const insts = el("div", "smp-chips k2sl-inst");
    for (const [n] of INST) insts.append(chip(n, SL.inst === n, () => (SL.inst = SL.inst === n ? "" : n)));

    const list = el("div", "smp-list k2sl-list");
    list.id = "smp-list";
    list.tabIndex = -1;
    const spacer = el("div", "k2sl-space");
    list.append(spacer);
    list.addEventListener("scroll", () => drawWindow(), { passive: true });
    list.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); step(e.key === "ArrowDown" ? 1 : -1); }
    });
    box.append(head, bar, chips, insts, list);
    SL.sig = "";
    renderList();
    if (document.activeElement === document.body) search.focus();
  };

  // the list: only the rows on screen exist (2,700+ sounds stay fast)
  const prevList = renderList;
  renderList = function () { // eslint-disable-line no-func-assign
    if (!on() || !$("samples") || !$("samples").classList.contains("k2sl")) return prevList();
    const list = $("smp-list");
    if (!list) return;
    const sig = [smp.q, smp.kind, smp.inKey, SL.inst, smp.items.length, ui.state && ui.state.key && ui.state.key.name].join("|");
    const fresh = sig !== SL.sig;
    if (fresh) { SL.sig = sig; SL.shown = filtered(); list.scrollTop = 0; }
    const sp = list.firstChild;
    sp.style.height = SL.shown.length * ROW_H + "px";
    list.querySelector(".smp-none")?.remove();
    if (!SL.shown.length) list.append(el("div", "smp-none", "Nothing matches."));
    drawWindow(fresh);
    for (const r of sp.children) { mark(r); const s = SL.shown[+r.dataset.i]; if (s) paint(r.querySelector("canvas"), s); }
    const b = $("k2sl-bpm");
    if (b && document.activeElement !== b) b.value = String(boxBpm());
  };

  function drawWindow(force) {
    const list = $("smp-list");
    if (!list || !list.firstChild) return;
    const sp = list.firstChild, h = list.clientHeight || 400;
    const a = Math.max(0, Math.floor(list.scrollTop / ROW_H) - 4), z = Math.min(SL.shown.length, Math.ceil((list.scrollTop + h) / ROW_H) + 4);
    const keep = new Map();
    for (const r of [...sp.children]) {
      const i = +r.dataset.i;
      if (force || i < a || i >= z || !SL.shown[i] || SL.shown[i].id !== r.dataset.id) r.remove(); else keep.set(i, r);
    }
    for (let i = a; i < z; i++) {
      if (keep.has(i)) { mark(keep.get(i)); continue; }
      const r = row(SL.shown[i], i);
      sp.append(r);
    }
    pump();
  }

  function mark(r) {
    const id = r.dataset.id;
    r.classList.toggle("playing", smp.playing === id);
    r.classList.toggle("sel", SL.sel === id);
    r.querySelector(".smp-play").textContent = smp.playing === id ? "\u25a0" : "\u25b6";
  }

  function row(s, i) {
    const r = el("div", "smp-row k2sl-row");
    r.dataset.id = s.id; r.dataset.i = String(i);
    r.style.top = i * ROW_H + "px";
    const cover = el("span", "k2sl-cover", initials(s.pack));
    cover.style.setProperty("--h", String(hue(s.pack)));
    const play = el("span", "smp-play");
    const mid = el("div", "k2sl-mid");
    const cv = el("canvas", "k2sl-wave");
    cv.width = PEAKS * 2; cv.height = 48;
    const nm = el("div", "k2sl-name");
    nm.append(el("b", null, s.name), el("small", null, s.pack));
    nm.title = s.path;
    mid.append(cv, nm);
    const tags = el("div", "k2sl-tags");
    tags.append(el("i", "k2sl-key" + (s.key && sampleInKey(s) ? " in" : ""), s.key ? s.key.name : ""), el("i", "k2sl-tempo", s.kind === "loop" && s.bpm ? String(s.bpm) : ""),
      el("i", "k2sl-kind", s.kind === "loop" ? "LOOP" : "SHOT"));
    r.append(cover, play, mid, tags);
    r.addEventListener("mousedown", (e) => { SL.sel = s.id; dragSample(e, s, r); });
    mark(r);
    paint(cv, s);
    if (!SL.peaks.has(s.id)) want(s);
    return r;
  }
  function initials(p) { const w = String(p || "?").replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean); return ((w[0] || "?")[0] + ((w[1] || "")[0] || "")).toUpperCase(); }
  function hue(p) { let h = 0; for (const c of String(p)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 250 + (h % 50); } // purples only

  function paint(cv, s) {
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, pk = SL.peaks.get(s.id);
    g.clearRect(0, 0, W, H);
    const playing = smp.playing === s.id, prog = playing ? progress(s) : 0;
    if (!pk) { g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(0, H / 2 - 0.5, W, 1); return; }
    const n = pk.length / 2, bw = W / n;
    for (let k = 0; k < n; k++) {
      const lo = pk[2 * k], hi = pk[2 * k + 1];
      const y0 = H / 2 - hi * (H / 2 - 1), y1 = H / 2 - lo * (H / 2 - 1);
      g.fillStyle = playing && k / n < prog ? "#e4ff3a" : playing ? "rgba(228,255,58,0.45)" : SL.sel === s.id ? "#b9a2ff" : "#8f86a6";
      g.fillRect(k * bw, y0, Math.max(1, bw - 0.6), Math.max(1, y1 - y0));
    }
  }

  // ---- waveforms: read only rows on screen, two at a time, small (11 kHz mono), kept in memory
  let actx = null;
  function want(s) { if (!SL.queue.includes(s)) SL.queue.push(s); }
  function onScreen(id) { return !!document.querySelector('#smp-list .k2sl-row[data-id="' + id + '"]'); }
  function pump() {
    while (SL.busy < 2 && SL.queue.length) {
      const s = SL.queue.shift();
      if (SL.peaks.has(s.id) || !onScreen(s.id)) continue;
      SL.busy++;
      peaksOf(s).then((pk) => { SL.peaks.set(s.id, pk); }, () => { SL.peaks.set(s.id, null); })
        .finally(() => {
          SL.busy--;
          const cv = document.querySelector('#smp-list .k2sl-row[data-id="' + s.id + '"] canvas');
          if (cv) paint(cv, s);
          pump();
        });
    }
  }
  async function peaksOf(s) {
    const f = sampleFileOf(s.id);
    if (!f) throw new Error("gone");
    const file = f.file || (await f.getFile());
    if (file.size > 40e6) throw new Error("big");
    if (!actx) actx = new OfflineAudioContext(1, 1, 11025);
    const buf = await actx.decodeAudioData(await file.arrayBuffer());
    SL.dur.set(s.id, buf.duration);
    const n = PEAKS, out = new Float32Array(n * 2), chs = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    const len = buf.length, per = Math.max(1, Math.floor(len / n));
    let top = 0;
    for (let k = 0; k < n; k++) {
      let lo = 0, hi = 0;
      const a = Math.floor((k * len) / n), z = Math.min(len, a + per);
      for (const d of chs) for (let j = a; j < z; j++) { const v = d[j]; if (v < lo) lo = v; else if (v > hi) hi = v; }
      out[2 * k] = lo; out[2 * k + 1] = hi;
      top = Math.max(top, hi, -lo);
    }
    if (top > 0) for (let k = 0; k < out.length; k++) out[k] /= top;   // every row fills its height, like Splice
    return out;
  }
  // the file the backend holds for this sound (playground: sampleFiles; demo: SAMPLES) - asked via a command
  function sampleFileOf(id) { return window.purpSampleFile ? window.purpSampleFile(id) : null; }

  // ---- playing: a yellow line runs over the waveform
  function progress(s) {
    const d = SL.dur.get(s.id);
    if (!d || SL.playId !== s.id) return 0;
    return Math.min(1, ((performance.now() - SL.playT0) / 1000) * SL.rate / d);
  }
  function tick() {
    SL.raf = 0;
    if (!smp.playing) return;
    const s = smp.items.find((x) => x.id === smp.playing);
    const cv = s && document.querySelector('#smp-list .k2sl-row[data-id="' + s.id + '"] canvas');
    if (cv) paint(cv, s);
    SL.raf = requestAnimationFrame(tick);
  }
  const prevPreview = previewSample;
  previewSample = function (s) { // eslint-disable-line no-func-assign
    if (!on()) return prevPreview(s);
    if (smp.playing === s.id) return stopPreview();
    smp.playing = s.id;
    SL.sel = s.id;
    SL.playId = s.id; SL.playT0 = performance.now(); SL.rate = rateOf(s);
    run("previewSample", { id: s.id, path: s.path, rate: SL.rate }).then((r) => {
      if (r && r.error) smp.playing = null;
      SL.playT0 = performance.now();
      renderList();
    });
    renderList();
    if (!SL.raf) SL.raf = requestAnimationFrame(tick);
  };
  function replay() {
    if (!smp.playing) return;
    const s = smp.items.find((x) => x.id === smp.playing);
    if (!s) return;
    smp.playing = null;
    previewSample(s);
  }
  function step(d) {
    if (!SL.shown.length) return;
    let i = SL.shown.findIndex((x) => x.id === SL.sel);
    i = i < 0 ? 0 : Math.max(0, Math.min(SL.shown.length - 1, i + d));
    const s = SL.shown[i];
    SL.sel = s.id;
    const list = $("smp-list");
    if (list) {
      if (i * ROW_H < list.scrollTop) list.scrollTop = i * ROW_H;
      else if ((i + 1) * ROW_H > list.scrollTop + list.clientHeight) list.scrollTop = (i + 1) * ROW_H - list.clientHeight;
    }
    if (smp.playing === s.id) smp.playing = null;
    previewSample(s);
  }

  // ---- dropping: loops land in time with the song. Into a song with nothing in it yet, the typed BPM becomes the song's.
  const prevDrop = dropSample;
  dropSample = async function (s, trackId, start) { // eslint-disable-line no-func-assign
    if (on() && SL.bpm && smp.sync && s.kind === "loop" && s.bpm && ui.state.tracks.every((t) => !t.clips.length)) {
      await run("setBpm", { bpm: SL.bpm });
      SL.bpm = null;
    }
    return prevDrop(s, trackId, start);
  };

  // the song tempo changed: the box follows unless a BPM was typed
  booth.on("state", () => { const b = $("k2sl-bpm"); if (b && document.activeElement !== b) b.value = String(boxBpm()); });
})();
