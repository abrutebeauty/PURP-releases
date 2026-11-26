// KILLTOY Samples: browse the Splice folder (or any sample folder) and drag sounds onto
// lanes. Splice has no public API, but the Splice app saves every sample you download
// into a normal folder (~/Splice/sounds by default), so KILLTOY just reads that folder.
// The backend lists files ({ id, path }); names, packs, BPM and key are read here from
// the file paths, so the app and the browser share one parser.
// Keep this file ASCII-only.
"use strict";

const smp = {
  open: false, loaded: false, folder: "", items: [], q: "", kind: "all", inKey: false, sync: true,
  openPacks: new Set(), playing: null, needsReconnect: false,
};

// ---------------------------------------------------------------------------
// Reading names: "SO_CP_90_piano_loop_Fmin.wav" -> loop, 90 BPM, F minor.
const PC = { c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, f: 5, "f#": 6, gb: 6, g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11 };
const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const AUDIO_EXT = /\.(wav|aiff?|mp3|flac|ogg|m4a)$/i;

function parseSample(path) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  const file = parts.pop() || path;
  const base = file.replace(/\.[^.]+$/, "");
  const pi = parts.findIndex((p) => p.toLowerCase() === "packs");
  const pack = pi >= 0 && parts[pi + 1] ? parts[pi + 1] : parts.length ? parts[parts.length - 1] : "Samples";
  const tok = base.split(/[\s_\-.()[\],]+/).filter(Boolean);
  let bpm = 0, key = null;
  tok.forEach((t, i) => {
    const m = /^(\d{2,3})(bpm)?$/i.exec(t);
    const n = m && Number(m[1]);
    if (n >= 60 && n <= 200 && (m[2] || /^bpm$/i.test(tok[i + 1] || "") || !bpm)) bpm = n;
    const k = /^([A-Ga-g])(#|b|s|sharp|flat)?(maj|major|min|minor|m)?$/.exec(t);
    if (k && !key) {
      const next = (tok[i + 1] || "").toLowerCase();
      const quality = (k[3] || (/^(maj|major|min|minor)$/.test(next) ? next : "")).toLowerCase();
      if (!k[2] && !quality) return; // a lone letter is too often part of a word
      if (k[1] === k[1].toLowerCase() && !quality) return;
      const acc = !k[2] ? "" : /^(#|s|sharp)$/i.test(k[2]) ? "#" : "b";
      const pc = PC[(k[1] + acc).toLowerCase()];
      if (pc === undefined) return;
      const minor = /^(m|min|minor)$/.test(quality);
      key = { pc, minor, name: NOTE[pc] + (minor ? "m" : "") };
    }
  });
  const low = path.toLowerCase();
  const kind = /loop/.test(low) ? "loop" : /one[ _-]?shots?|oneshot|[_ -]hit|[_ -]shot/.test(low) ? "shot" : bpm ? "loop" : "shot";
  const nice = base.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return { name: nice, file, pack, bpm, key, kind };
}

function sampleInKey(s) {
  const k = ui.state && ui.state.key;
  if (!s.key || !k || k.tonic == null) return false;
  if (s.key.pc === k.tonic && s.key.minor === !!k.minor) return true;
  const rel = k.minor ? (k.tonic + 3) % 12 : (k.tonic + 9) % 12; // relative major / minor shares the notes
  return s.key.pc === rel && s.key.minor === !k.minor;
}

// ---------------------------------------------------------------------------
// The panel
function toggleSamples(on = !smp.open) {
  smp.open = on;
  document.body.classList.toggle("samples-open", on);
  $("samples").hidden = !on;
  $("tool-samples").classList.toggle("on", on);
  if (on && !smp.loaded) loadSamples();
  if (on) renderSamples();
  if (!on) stopPreview();
}

async function loadSamples() {
  const r = await run("getSamples");
  smp.loaded = true;
  smp.folder = (r && r.folder) || "";
  smp.needsReconnect = !!(r && r.needsReconnect);
  smp.items = ((r && r.samples) || []).filter((s) => AUDIO_EXT.test(s.path)).map((s) => ({ ...s, ...parseSample(s.path) }));
  smp.items.sort((a, b) => a.pack.localeCompare(b.pack) || a.name.localeCompare(b.name));
  renderSamples();
}

async function connectSamples() {
  if (juce) {
    const r = await run("setSampleFolder"); // native folder picker, starts in ~/Splice/sounds
    if (r && r.ok) await loadSamples();
    return;
  }
  const r = await pickFolderInBrowser();
  if (r) { await run("setSampleFiles", r); await loadSamples(); }
}

function visibleSamples() {
  const words = smp.q.toLowerCase().split(/\s+/).filter(Boolean);
  return smp.items.filter((s) => (smp.kind === "all" || s.kind === smp.kind)
    && (!smp.inKey || sampleInKey(s))
    && words.every((w) => (s.name + " " + s.pack + " " + (s.key ? s.key.name : "") + " " + (s.bpm || "")).toLowerCase().includes(w)));
}

function renderSamples() {
  const box = $("samples");
  if (!box || box.hidden) return;
  box.replaceChildren();
  const head = el("div", "smp-head");
  const title = el("div", "smp-title", "Samples");
  const close = el("button", "smp-x", "\u00d7");
  close.title = "Close (B)";
  close.onclick = () => toggleSamples(false);
  head.append(title, close);
  box.append(head);

  if (!smp.items.length) {
    const empty = el("div", "smp-empty");
    empty.append(
      el("div", "smp-big", smp.needsReconnect ? "Splice is connected" : "Connect your Splice sounds"),
      el("p", null, smp.needsReconnect
        ? "Click once so the browser can read the folder again."
        : "Pick the folder the Splice app saves into. On a Mac it is usually Home \u203a Splice \u203a sounds."),
    );
    const go = el("button", "pill go", smp.needsReconnect ? "Reconnect Splice" : "Connect Splice folder");
    go.onclick = connectSamples;
    empty.append(go, el("p", "smp-note", "Any folder of WAV, AIFF or MP3 works too. You can also drag files in from Finder straight onto a lane."));
    box.append(empty);
    return;
  }

  const src = el("div", "smp-src");
  const where = el("span", null, `${smp.folder || "Samples"} \u00b7 ${smp.items.length.toLocaleString()} sounds`);
  const change = el("button", "link", "Change");
  change.onclick = connectSamples;
  src.append(where, change);

  const search = el("input", "smp-search");
  search.placeholder = "Search: kick, guitar, 140, F#m\u2026";
  search.value = smp.q;
  search.oninput = () => { smp.q = search.value; renderList(); };
  search.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Escape") { search.value = ""; smp.q = ""; renderList(); search.blur(); } };

  const chips = el("div", "smp-chips");
  const chip = (label, on, fn, tip) => { const b = el("button", "smp-chip" + (on ? " on" : ""), label); b.title = tip || ""; b.onclick = () => { fn(); renderSamples(); }; return b; };
  const key = ui.state && ui.state.key && ui.state.key.name;
  chips.append(
    chip("All", smp.kind === "all", () => (smp.kind = "all")),
    chip("Loops", smp.kind === "loop", () => (smp.kind = "loop")),
    chip("One-shots", smp.kind === "shot", () => (smp.kind = "shot")),
    chip(key ? `In ${key}` : "In key", smp.inKey, () => (smp.inKey = !smp.inKey), "Only sounds in the song's key (or its relative key)"),
    chip(`Sync ${Math.round(bpm())}`, smp.sync, () => (smp.sync = !smp.sync), "Play and drop loops at the song tempo"),
  );

  const list = el("div", "smp-list");
  list.id = "smp-list";
  box.append(src, search, chips, list, el("div", "smp-foot", "Click to hear \u00b7 drag onto a lane \u00b7 double-click adds at the marker"));
  renderList();
  if (document.activeElement === document.body) search.focus();
}

function renderList() {
  const list = $("smp-list");
  if (!list) return;
  list.replaceChildren();
  const shown = visibleSamples();
  if (!shown.length) { list.append(el("div", "smp-none", "Nothing matches. Try fewer words.")); return; }
  const flat = smp.q.trim() || smp.inKey;
  if (flat) { shown.slice(0, 400).forEach((s) => list.append(sampleRow(s))); return; }
  const packs = new Map();
  for (const s of shown) (packs.get(s.pack) || packs.set(s.pack, []).get(s.pack)).push(s);
  for (const [pack, items] of packs) {
    const open = smp.openPacks.has(pack) || packs.size === 1;
    const ph = el("button", "smp-pack" + (open ? " open" : ""));
    ph.append(el("span", "smp-caret", open ? "\u25be" : "\u25b8"), el("span", "smp-pack-name", pack), el("span", "smp-count", String(items.length)));
    ph.onclick = () => { open ? smp.openPacks.delete(pack) : smp.openPacks.add(pack); renderList(); };
    list.append(ph);
    if (open) items.slice(0, 400).forEach((s) => list.append(sampleRow(s)));
  }
}

function sampleRow(s) {
  const row = el("div", "smp-row" + (smp.playing === s.id ? " playing" : ""));
  row.dataset.id = s.id;
  const play = el("span", "smp-play", smp.playing === s.id ? "\u25a0" : "\u25b6");
  const name = el("span", "smp-name", s.name);
  name.title = s.path;
  const meta = el("span", "smp-meta");
  if (s.kind === "loop") meta.append(el("i", "loop", s.bpm ? String(s.bpm) : "loop"));
  if (s.key) meta.append(el("i", sampleInKey(s) ? "key in" : "key", s.key.name));
  row.append(play, name, meta);
  row.addEventListener("mousedown", (e) => dragSample(e, s, row));
  return row;
}

// ---------------------------------------------------------------------------
// Hearing and placing
function previewSample(s) {
  if (smp.playing === s.id) return stopPreview();
  smp.playing = s.id;
  run("previewSample", { id: s.id, path: s.path, rate: smp.sync && s.bpm ? bpm() / s.bpm : 1 })
    .then((r) => { if (r && r.error) smp.playing = null; renderList(); });
  renderList();
}
function stopPreview() {
  if (!smp.playing) return;
  smp.playing = null;
  run("stopPreview");
  renderList();
}
// Called by the backend when a preview ends by itself.
booth.on("previewEnded", () => { smp.playing = null; renderList(); });
// In the app the folder picker answers later; reload the list when it does.
booth.on("samplesChanged", () => loadSamples());

// The lane under a point, and the beat it lands on.
function dropTarget(x, y) {
  const hit = document.elementFromPoint(x, y);
  const k2 = document.documentElement.classList.contains("kt2");
  if (k2) {
    // KILLTOY 2 (Eman, 31 Oct): drop anywhere on the grid. The row under the mouse (by height) takes it
    // when it's an audio row; anywhere else it gets a new row there. The time follows the mouse.
    const sc = $("scroll"), box = sc && sc.getBoundingClientRect();
    const anyLane = document.querySelector("#rows .row:not(.master) .lane");
    if (!box || !anyLane || x < box.left || x > box.right || y < box.top || y > box.bottom) return { trackId: null, start: null, ok: false };
    // dropped on a sound: it replaces that sound in every linked copy (FL Studio style)
    // (the automation lines under a pattern are not the pattern: a sound dropped there doesn't replace it)
    const clipEl = hit && hit.closest && !hit.closest(".k2-al") && hit.closest(".clip[data-clip-id]");
    const crow = clipEl && clipEl.closest(".row");
    if (clipEl && crow && crow.dataset.kind === "take" && !clipEl.classList.contains("midi")) {
      const c = findClip(clipEl.dataset.clipId);
      if (c && c.kind !== "midi") return { replace: c.id, clipEl, ok: true, start: null, trackId: null };
    }
    const rows = [...document.querySelectorAll("#rows > .row")].filter((r) => r.offsetParent && !r.classList.contains("master"));
    const row = rows.find((r) => { const q = r.getBoundingClientRect(); return y >= q.top && y < q.bottom; }) || null;
    const left = anyLane.getBoundingClientRect().left;
    if (x < left) return { trackId: null, start: null, ok: false };
    const kind = row && row.dataset.kind;
    const own = !!row && !row.classList.contains("k2-ghost") && kind === "take";
    return { trackId: own ? row.dataset.trackId : null, start: Math.max(0, snapBeat(toSec(x - left))), ok: true, row: own ? row : null, at: row, left };
  }
  const row = hit && hit.closest && hit.closest(".row");
  const lane = row && row.querySelector(".lane");
  if (!row || !lane) return { trackId: null, start: null, ok: !!(hit && hit.closest && hit.closest(".add-row, #rows, .inner")) };
  const kind = row.dataset.kind;
  const ok = kind !== "beat" && kind !== "inst" && kind !== "master";
  const start = snapBeat(toSec(x - lane.getBoundingClientRect().left));
  return { trackId: ok ? row.dataset.trackId : null, start, ok, row };
}

// KILLTOY 2: while dragging a sound in, a ghost clip shows exactly where it will land
let dropGhostEl = null;
function linkedCount(id) {
  const c = findClip(id); if (!c) return 1;
  const l = c.link || c.src;
  return l ? ui.state.tracks.reduce((a, t) => a + t.clips.filter((x) => (x.link || x.src) === l).length, 0) : 1;
}
let replaceEl = null;
function showDropGhost(t, name, length) {
  if (replaceEl && (!t || t.clipEl !== replaceEl)) { replaceEl.classList.remove("k2-replace"); replaceEl.removeAttribute("data-replace"); replaceEl = null; }
  if (t && t.replace) {
    if (dropGhostEl) { dropGhostEl.remove(); dropGhostEl = null; }
    replaceEl = t.clipEl; replaceEl.classList.add("k2-replace");
    const n = linkedCount(t.replace);
    replaceEl.dataset.replace = n > 1 ? `REPLACE IN ALL ${n}` : "REPLACE";
    return;
  }
  if (!document.documentElement.classList.contains("kt2") || !t || !t.ok || t.start == null) return hideDropGhost();
  if (!dropGhostEl) { dropGhostEl = el("div", "k2-dropghost"); dropGhostEl.append(el("b"), el("small")); document.body.append(dropGhostEl); }
  const rows = [...document.querySelectorAll("#rows > .row")].filter((r) => r.offsetParent && !r.classList.contains("master"));
  const last = rows[rows.length - 1], ref = t.at || null;
  const q = ref ? ref.getBoundingClientRect() : last ? { top: last.getBoundingClientRect().bottom, height: last.getBoundingClientRect().height } : { top: 120, height: 58 };
  const w = Math.max(24, toX(length || 2 * secPerBar()));
  Object.assign(dropGhostEl.style, { left: t.left + toX(t.start) + "px", top: q.top + 2 + "px", height: Math.max(30, q.height - 4) + "px", width: w + "px" });
  dropGhostEl.classList.toggle("new", !t.trackId);
  dropGhostEl.firstChild.textContent = name || "Sound";
  dropGhostEl.lastChild.textContent = t.trackId ? "" : "new row";
}
function hideDropGhost() {
  if (dropGhostEl) { dropGhostEl.remove(); dropGhostEl = null; }
  if (replaceEl) { replaceEl.classList.remove("k2-replace"); replaceEl.removeAttribute("data-replace"); replaceEl = null; }
}
// ---------------------------------------------------------------------------
// KILLTOY 2 drop (Eman, 7 Nov 02:39-02:42): every file dragged in gets its own glowing ghost on its own
// row (the row under the mouse, then the rows under it), each in its own colour. Letting go puts a
// loading pattern there AT ONCE (no 5-second freeze with nothing on screen); it grows to the sound's
// real length as soon as that is known, fills up while the sound loads, and turns into the pattern.
// KT2_DROP_OLD = the old single white box and files one after another on one row.
const k2Drop = () => document.documentElement.classList.contains("kt2") && !window.KT2_DROP_OLD && !juce;
const K2D = { ghosts: [], cols: null, n: 0, layer: null, loaders: [], raf: 0 };
function k2Cols(n) {
  if (K2D.cols && K2D.n === n) return K2D.cols;
  const f = window.KT2 && KT2.freshColors ? KT2.freshColors(n) : [];
  K2D.cols = Array.from({ length: n }, (_, i) => f[i] || ["#9d5cff", "#5ce1ff", "#ff5c8a", "#5cff9d", "#c45cff", "#5c8aff"][i % 6]);
  K2D.n = n;
  return K2D.cols;
}
// the rows the n sounds will land on: the row under the mouse (never the beat's), then the ones under it
function k2DropRows(t, n) {
  const rows = [...document.querySelectorAll("#rows > .row")].filter((r) => r.offsetParent && !r.classList.contains("master"));
  const rowsTop = $("rows").getBoundingClientRect().top;
  let i = t.at ? rows.indexOf(t.at) : rows.length;
  if (i >= 0 && rows[i] && rows[i].dataset.kind === "beat") i++;
  if (i < 0) i = rows.length;
  const last = rows[rows.length - 1], rh = last ? last.getBoundingClientRect().height : 62;
  const out = [];
  for (let k = 0; k < n; k++) {
    const r = rows[i + k];
    if (r) { const q = r.getBoundingClientRect(); out.push({ row: r, y: q.top - rowsTop, h: q.height }); }
    else { const base = last ? last.getBoundingClientRect().bottom - rowsTop : 0; out.push({ row: null, y: base + (i + k - rows.length) * rh, h: rh }); }
  }
  return out;
}
function k2Layer() {
  // a fixed box over the grid, clipped to it, so ghosts and loaders never sit on the ruler or the footer
  if (K2D.layer && K2D.layer.isConnected) return K2D.layer;
  const L = el("div", "k2-droplayer");
  document.body.append(L);
  K2D.layer = L;
  const fit = () => {
    const sc = $("scroll"); if (!sc || !L.isConnected) return;
    const q = sc.getBoundingClientRect(), rows = $("rows").getBoundingClientRect();
    Object.assign(L.style, { left: q.left + "px", top: rows.top > q.top ? rows.top + "px" : q.top + "px", width: q.width + "px", height: Math.max(0, q.bottom - Math.max(q.top, rows.top)) + "px" });
    L.dataset.oy = String(rows.top - Math.max(q.top, rows.top));   // where row 0 is inside the layer
    L.dataset.ox = String(q.left);
  };
  fit(); L._fit = fit;
  return L;
}
function k2PlaceBox(b, laneLeft, start, len, spot) {
  const L = K2D.layer; if (!L) return;
  b.style.left = (laneLeft - +L.dataset.ox + toX(start)) + "px";
  b.style.top = (+L.dataset.oy + spot.y + 3) + "px";
  b.style.height = Math.max(26, spot.h - 6) + "px";
  if (len != null) b.style.width = Math.max(28, toX(len)) + "px";
}
function showDropGhosts(t, n) {
  if (!t || !t.ok || t.start == null || t.replace) { hideDropGhosts(); return showDropGhost(t, null, 0); }
  hideDropGhost();
  const L = k2Layer(); L._fit();
  const spots = k2DropRows(t, n), cols = k2Cols(n);
  while (K2D.ghosts.length > n) K2D.ghosts.pop().remove();
  for (let k = 0; k < n; k++) {
    let g = K2D.ghosts[k];
    if (!g) {
      g = el("div", "k2-glowghost");
      g.append(el("i", "k2g-start"), el("b"), el("small"));
      L.append(g); K2D.ghosts[k] = g;
      requestAnimationFrame(() => g.classList.add("on"));
    }
    g.style.setProperty("--c", cols[k]);
    g.style.setProperty("--d", k * 40 + "ms");
    g.children[1].textContent = n > 1 ? `SOUND ${k + 1} OF ${n}` : "DROP HERE";
    const sp = spots[k];
    g.children[2].textContent = sp.row && !sp.row.classList.contains("k2-ghost") && sp.row.dataset.kind === "take" && k === 0 ? "on this row" : "new row";
    g.classList.add("unknown");   // the length is only known once it is let go (a browser can't read the file before)
    k2PlaceBox(g, t.left, t.start, 4 * secPerBar(), sp);
  }
}
function hideDropGhosts() { K2D.ghosts.forEach((g) => g.remove()); K2D.ghosts = []; if (!K2D.loaders.length && K2D.layer) { K2D.layer.remove(); K2D.layer = null; } }
// how long a sound is, from its header only (fast: no decoding)
function k2Duration(f) {
  return new Promise((done) => {
    try {
      const url = URL.createObjectURL(f), a = new Audio();
      const end = (d) => { clearTimeout(tm); a.removeAttribute("src"); URL.revokeObjectURL(url); done(d); };
      const tm = setTimeout(() => end(0), 2500);
      a.preload = "metadata";
      a.onloadedmetadata = () => end(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => end(0);
      a.src = url;
    } catch (e) { done(0); }
  });
}
function k2Loader(name, col, laneLeft, start, spot, est) {
  const L = k2Layer();
  const b = el("div", "k2-loadclip");
  b.style.setProperty("--c", col);
  b.style.setProperty("--est", Math.max(1.2, est || 3) + "s");
  b.append(el("i", "k2l-fill"), el("i", "k2l-shine"), el("b", null, name), el("small", null, "LOADING"));
  L.append(b);
  k2PlaceBox(b, laneLeft, start, null, spot);
  b.style.width = Math.max(28, toX(4 * secPerBar())) + "px";
  const it = { b, laneLeft, start, spot, len: null };
  K2D.loaders.push(it);
  // follow the grid while it scrolls or zooms
  // (only when the view really changed: measuring the grid every frame slowed the loading down 3x)
  if (!K2D.raf) {
    let sig = "";
    const tick = () => {
      if (!K2D.loaders.length) { K2D.raf = 0; return; }
      const sc = $("scroll"), L2 = K2D.layer, now = sc ? `${sc.scrollLeft}|${sc.scrollTop}|${ui.pxPerSec}|${innerWidth}|${innerHeight}` : "";
      if (L2 && now !== sig) {
        sig = now; L2._fit();
        const nl = (document.querySelector("#rows .row:not(.master) .lane") || {}).getBoundingClientRect?.().left;
        for (const x of K2D.loaders) k2PlaceBox(x.b, nl != null ? nl : x.laneLeft, x.start, x.len, x.spot);
      }
      K2D.raf = requestAnimationFrame(tick);
    };
    K2D.raf = requestAnimationFrame(tick);
  }
  return it;
}
function k2LoaderLen(it, sec) { if (!sec) return; it.len = sec; it.b.classList.add("sized"); it.b.style.width = Math.max(28, toX(sec)) + "px"; }
// the loader turns into the real pattern: it fills up, then fades while the pattern wipes in from the left
function k2LoaderDone(it, clipId) {
  it.b.classList.add("done");
  const n = clipId && document.querySelector(`.clip[data-clip-id="${clipId}"]`);
  if (n && n.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    n.animate([{ clipPath: "inset(0 100% 0 0)", filter: "brightness(1.8) blur(2px)" }, { clipPath: "inset(0 0 0 0)", filter: "none" }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  setTimeout(() => { it.b.classList.add("gone"); }, 260);
  setTimeout(() => { it.b.remove(); K2D.loaders = K2D.loaders.filter((x) => x !== it); if (!K2D.loaders.length && !K2D.ghosts.length && K2D.layer) { K2D.layer.remove(); K2D.layer = null; } }, 620);
}
function k2LoaderFail(it) { it.b.classList.add("gone"); setTimeout(() => { it.b.remove(); K2D.loaders = K2D.loaders.filter((x) => x !== it); }, 300); }
const k2Frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
// the row right under a placed clip: { spot } for an empty grid row, { onRow } for a lane's row, {} for none
function k2RowUnder(clipId) {
  const n = document.querySelector(`#rows .clip[data-clip-id="${clipId}"]`), r = n && n.closest(".row");
  if (!r) return {};
  let x = r.nextElementSibling;
  while (x && (!x.classList.contains("row") || !x.offsetParent || x.classList.contains("master"))) x = x.nextElementSibling;
  if (!x) return {};
  if (x.classList.contains("k2-ghost")) return { spot: KT2.ghostSpot(x) };
  if (x.dataset.kind && x.dataset.kind !== "beat" && x.dataset.trackId) return { onRow: x.dataset.trackId };
  return {};
}
async function k2DropFiles(audio, t) {
  const n = audio.length, cols = k2Cols(n), spots = k2DropRows(t, n), at = t.start != null ? t.start : snapBeat(ui.transport.position);
  hideDropGhosts();
  const names = audio.map((f) => parseSample(f.name || "").name || f.name);
  // the loading patterns go down first, then the browser gets to paint them before anything heavy starts
  const its = audio.map((f, k) => k2Loader(names[k], cols[k], t.left, at, spots[k], 1.5 + (f.size || 0) / 4e6));
  K2D.cols = null;
  await k2Frame();
  audio.forEach((f, k) => k2Duration(f).then((d) => k2LoaderLen(its[k], d)));
  const r = await run("setSampleFiles", { name: "Dropped files", files: audio.map((f) => ({ file: f, path: "Dropped/" + f.name })), add: true });
  const k2 = window.KT2ClipKey && !window.KT2_CLIPKEY_OFF, empty = k2 && ui.state.tracks.every((x) => !x.clips.length);
  const k2rows = KT2.freeRows && KT2.freeRows() && !window.KT2_DROP_AT_END;
  const first = t.at;
  let where = {
    trackId: t.trackId,
    spot: k2rows && first && first.classList.contains("k2-ghost") ? KT2.ghostSpot(first) : null,
    onRow: k2rows && !t.trackId && first && !first.classList.contains("k2-ghost") && first.dataset.trackId && first.dataset.kind !== "beat" ? first.dataset.trackId : null,
  };
  const got = [];
  const samples = (r && r.samples) || [];
  for (let k = 0; k < samples.length; k++) {
    const s = samples[k], ps = parseSample(s.path), it = its[k];
    await k2Frame();
    const res = await run("addSample", { ...recFlag(), id: s.id, path: s.path, name: ps.name, trackId: where.trackId || null, start: at, bpm: 0, origBpm: ps.bpm || 0, key: ps.key || null,
      ...(k2 ? { listen: true, fitSong: !empty } : {}) });
    if (!res || res.error) { if (it) k2LoaderFail(it); continue; }
    if (!where.trackId && res.trackId && where.spot) await run("setLaneGap", { trackId: res.trackId, ...where.spot });
    if (where.onRow && res.clipId) await run("setClipRow", { clipId: res.clipId, start: at, row: where.onRow });
    if (res.clipId) await run("setClipColor", { clipIds: [res.clipId], color: cols[k] });
    if (res.clipId) { ui.selectedClip = res.clipId; render(); }
    if (it) k2LoaderDone(it, res.clipId);
    got.push({ ...res, name: ps.name, color: cols[k] });
    // the next sound goes on the row under this one
    const u = res.clipId ? k2RowUnder(res.clipId) : {};
    where = { trackId: null, spot: u.spot || null, onRow: u.onRow || null };
  }
  for (const it of its.slice(samples.length)) k2LoaderFail(it);
  if (k2 && empty && got.length) {
    if (got.length > 1 && KT2ClipKey.askEmptyMany) await KT2ClipKey.askEmptyMany(got);
    else await KT2ClipKey.askEmpty(got[0]);
  }
  if (smp.loaded) loadSamples();
}

function replaceWith(clipId, s) {
  const n = linkedCount(clipId);
  return run("replaceClipSound", { clipId, id: s.id, url: s.url, name: s.name || parseSample(s.path || "").name }).then((r) => {
    if (r && r.ok) toast(r.count > 1 ? `${s.name || "The new sound"} is in all ${r.count} linked copies. Make unique (clip menu) splits one off.` : `Replaced with ${s.name || "the new sound"}.`);
    return r;
  });
}

function dragSample(e, s, rowEl) {
  if (e.button !== 0) return;
  // Double-click (read from e.detail: the first click redraws the list): add at the marker
  // on the Samples lane.
  if (e.detail === 2) {
    stopPreview();
    const lane = ui.state.tracks.find((t) => t.name === "Samples" && t.kind !== "inst");
    return dropSample(s, lane ? lane.id : null, snapBeat(ui.transport.position));
  }
  const x0 = e.clientX, y0 = e.clientY;
  let ghost = null, over = null;
  const onMove = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!ghost) {
      ghost = el("div", "smp-ghost", s.name);
      document.body.append(ghost);
      document.body.classList.add("smp-dragging");
    }
    ghost.style.left = ev.clientX + 12 + "px";
    ghost.style.top = ev.clientY + 10 + "px";
    const t = dropTarget(ev.clientX, ev.clientY);
    showDropGhost(t, s.name, s.length || s.seconds || 0);
    ghost.classList.toggle("k2-hide", !!dropGhostEl);
    if (over && over !== t.row) over.classList.remove("smp-over");
    over = t.row && t.ok ? t.row : null;
    if (over) over.classList.add("smp-over");
    ghost.classList.toggle("bad", !t.ok);
  };
  const onUp = (ev) => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (over) over.classList.remove("smp-over");
    hideDropGhost();
    document.body.classList.remove("smp-dragging");
    if (!ghost) return previewSample(s);
    ghost.remove();
    const t = dropTarget(ev.clientX, ev.clientY);
    if (!t.ok) return;
    if (t.replace) return replaceWith(t.replace, s);
    const start = t.start != null ? t.start : snapBeat(ui.transport.position);
    dropSample(s, t.trackId, start);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

// KILLTOY 2: a sound added on the RECORD page is a voice lane there; added anywhere else it's a plain sample
const recFlag = () => (document.documentElement.classList.contains("k2-rec") ? { recLane: true } : {});
// trackId null = a new lane for it.
function dropSample(s, trackId, start) {
  const t = trackId && ui.state.tracks.find((x) => x.id === trackId);
  run("addSample", { ...recFlag(), id: s.id, path: s.path, name: s.name, trackId: t ? t.id : null, start: Math.max(0, start),
                     bpm: smp.sync && s.kind === "loop" && s.bpm ? s.bpm : 0, origBpm: s.kind === "loop" && s.bpm ? s.bpm : 0, key: s.key || null })
    .then((r) => {
      if (!r || r.error) return;
      if (r.clipId) { ui.selectedClip = r.clipId; render(); }
      toast(`${s.name} added${s.bpm && smp.sync && s.kind === "loop" && s.bpm !== Math.round(bpm()) ? `, stretched from ${s.bpm} to ${Math.round(bpm())} BPM` : ""}.`);
    });
}

// ---------------------------------------------------------------------------
// Files dragged in from Finder: dropped on a lane they land at that beat, one after
// another; anywhere else they get a new lane at the marker.
function dropFiles(files, x, y) {
  const audio = files.filter((f) => AUDIO_EXT.test(f.name || f.path || f));
  if (!audio.length) { if (typeof hideDropGhosts === "function") hideDropGhosts(); return toast("Only audio files (WAV, AIFF, MP3) can go on a lane.", true); }
  const t = dropTarget(x, y);
  if (t.replace && !juce) {
    return run("setSampleFiles", { name: "Dropped files", files: audio.slice(0, 1).map((f) => ({ file: f, path: "Dropped/" + f.name })), add: true })
      .then((r) => { const s = r && r.samples && r.samples[r.samples.length - 1]; if (s) replaceWith(t.replace, { ...s, name: parseSample(s.path).name }); if (smp.loaded) loadSamples(); });
  }
  if (k2Drop() && t.ok && t.start != null) return k2DropFiles(audio, t);
  const at = t.start != null ? t.start : snapBeat(ui.transport.position);
  if (juce) { // the app hands over paths
    audio.forEach((p) => run("addSample", { ...recFlag(), path: p, name: parseSample(p).name, trackId: t.trackId, start: at, bpm: 0 }));
    return;
  }
  run("setSampleFiles", { name: "Dropped files", files: audio.map((f) => ({ file: f, path: "Dropped/" + f.name })), add: true }).then(async (r) => {
    let pos = at, trackId = t.trackId;
    // KILLTOY 2 (Eman, 6 Nov 15:22): a dropped sound gets its BPM + key (name, else by listening). Into an empty
    // project it asks which way to match; into a song it follows the song's tempo and key (A on). KT2_CLIPKEY_OFF = old.
    const k2 = window.KT2ClipKey && !window.KT2_CLIPKEY_OFF, empty = k2 && ui.state.tracks.every((x) => !x.clips.length);
    let first = true;
    // KILLTOY 2 (Eman, 6 Nov 23:33: "it doesn't come where you have let them go"): a sound dropped on an empty
    // row gets its new lane on THAT row, and one dropped on another kind of row (a synth's) sits on that row,
    // instead of a new lane at the bottom of the song. KT2_DROP_AT_END = the old way.
    const k2rows = !juce && window.KT2 && KT2.freeRows && KT2.freeRows() && !window.KT2_DROP_AT_END;
    const spot = k2rows && t.at && t.at.classList.contains("k2-ghost") && KT2.ghostSpot ? KT2.ghostSpot(t.at) : null;
    const onRow = k2rows && !spot && !t.trackId && t.at && t.at.dataset.trackId && t.at.dataset.kind !== "beat" ? t.at.dataset.trackId : null;
    let placed = false;
    for (const s of (r && r.samples) || []) {
      const ps = parseSample(s.path);
      const res = await run("addSample", { ...recFlag(), id: s.id, path: s.path, name: ps.name, trackId, start: pos, bpm: 0, origBpm: ps.bpm || 0, key: ps.key || null,
        ...(k2 ? { listen: true, fitSong: !(empty && first) } : {}) });
      if (!res || res.error) break;
      if (!trackId && res.trackId && spot && !placed) { await run("setLaneGap", { trackId: res.trackId, ...spot }); placed = true; }
      if (onRow && res.clipId) await run("setClipRow", { clipId: res.clipId, start: pos, row: onRow });
      if (k2 && empty && first) await KT2ClipKey.askEmpty(res);
      first = false;
      trackId = res.trackId || trackId;
      pos += res.length || 0;
    }
    if (smp.loaded) loadSamples();
  });
}

const scrollEl = $("scroll");
scrollEl.addEventListener("dragover", (e) => {
  if (![...(e.dataTransfer.types || [])].includes("Files")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  const t = dropTarget(e.clientX, e.clientY);
  document.querySelectorAll(".row.smp-over").forEach((r) => r !== t.row && r.classList.remove("smp-over"));
  if (t.row && t.ok) t.row.classList.add("smp-over");
  const n = (e.dataTransfer.items || []).length;
  if (k2Drop()) showDropGhosts(t, Math.max(1, n));
  else showDropGhost(t, n > 1 ? `${n} sounds` : "Drop to place it here", 0);
  e.dataTransfer.dropEffect = "copy";
});
scrollEl.addEventListener("dragleave", (e) => {
  const r = scrollEl.getBoundingClientRect();
  if (e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom) { hideDropGhost(); hideDropGhosts(); K2D.cols = null; document.querySelectorAll(".row.smp-over").forEach((x) => x.classList.remove("smp-over")); }
});
scrollEl.addEventListener("drop", (e) => {
  if (!e.dataTransfer.files || !e.dataTransfer.files.length) return;
  e.preventDefault();
  hideDropGhost();
  if (!k2Drop()) hideDropGhosts();   // the KILLTOY 2 drop turns its ghosts into loaders itself
  document.querySelectorAll(".row.smp-over").forEach((r) => r.classList.remove("smp-over"));
  dropFiles([...e.dataTransfer.files], e.clientX, e.clientY);
});
// In the app, the window catches Finder drops (the web view can't see file paths).
booth.on("filesDropped", ({ paths, x, y }) => dropFiles(paths || [], x, y));

// ---------------------------------------------------------------------------
// Browser only: read a folder the person picks. With the File System Access API the
// folder is remembered, so the next visit is one click; otherwise a folder upload box.
const SMP_DB = "killtoy-samples";
function idb(mode, fn) {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(SMP_DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("h");
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction("h", mode), req = fn(tx.objectStore("h"));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      };
    } catch (e) { resolve(null); }
  });
}

async function walkHandle(dir, prefix, out) {
  for await (const [name, h] of dir.entries()) {
    if (name.startsWith(".")) continue;
    if (h.kind === "directory") await walkHandle(h, prefix + name + "/", out);
    else if (AUDIO_EXT.test(name)) out.push({ handle: h, path: prefix + name });
  }
  return out;
}

async function filesFromHandle(dir) {
  const list = await walkHandle(dir, dir.name + "/", []);
  return { name: dir.name, files: list.map((x) => ({ path: x.path, getFile: () => x.handle.getFile() })) };
}

async function pickFolderInBrowser() {
  if (window.showDirectoryPicker) {
    try {
      const dir = await window.showDirectoryPicker({ id: "splice", mode: "read" });
      idb("readwrite", (s) => s.put(dir, "folder"));
      toast("Reading your sounds\u2026");
      return await filesFromHandle(dir);
    } catch (e) {
      if (e && e.name === "AbortError") return null;
      // Blocked here (some embedded pages can't open a folder picker): use the upload box.
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = () => {
      const files = [...input.files].filter((f) => AUDIO_EXT.test(f.name));
      const top = files[0] && files[0].webkitRelativePath.split("/")[0];
      resolve(files.length ? { name: top || "Samples", files: files.map((f) => ({ file: f, path: f.webkitRelativePath || f.name })) } : null);
    };
    input.click();
  });
}

// A remembered folder: reconnect without asking when the browser still allows it.
async function restoreBrowserFolder() {
  if (juce || !window.showDirectoryPicker) return;
  const dir = await idb("readonly", (s) => s.get("folder"));
  if (!dir || !dir.queryPermission) return;
  if ((await dir.queryPermission({ mode: "read" })) === "granted") {
    await run("setSampleFiles", await filesFromHandle(dir));
  } else {
    await run("setSampleFiles", { name: dir.name, files: [], reconnect: true });
    connectSamples = async function reconnect() { // one click asks the browser again
      if ((await dir.requestPermission({ mode: "read" })) === "granted") { await run("setSampleFiles", await filesFromHandle(dir)); await loadSamples(); }
      else { const r = await pickFolderInBrowser(); if (r) { await run("setSampleFiles", r); await loadSamples(); } }
    };
  }
}

// ---------------------------------------------------------------------------
// Wiring
$("tool-samples").onclick = (e) => { e.stopPropagation(); toggleSamples(); };
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === "b" || e.key === "B") { e.preventDefault(); toggleSamples(); }
});
restoreBrowserFolder();
