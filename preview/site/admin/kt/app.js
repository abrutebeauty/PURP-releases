// KILLTOY web UI (the app was called PURP; code and folders keep that name).
// Every action goes through booth(cmd, args) to the C++ BoothEngine.
// Opened in a normal browser (no app around it), a small demo backend is used instead.
// Keep this file ASCII-only: use \u escapes for symbols (see CLAUDE.md).
"use strict";

// ---------------------------------------------------------------------------
// Bridge
const juce = window.__JUCE__;
const booth = juce ? createNativeBridge() : createDemoBackend();

function createNativeBridge() {
  let nextId = 0;
  const pending = new Map();

  juce.backend.addEventListener("__juce__complete", ({ promiseId, result }) => {
    const resolve = pending.get(promiseId);
    if (resolve) { pending.delete(promiseId); resolve(result); }
  });

  const call = (cmd, args = {}) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    juce.backend.emitEvent("__juce__invoke", { name: "booth", params: [cmd, args], resultId: id });
  });

  call.on = (event, fn) => juce.backend.addEventListener(event, fn);
  return call;
}

// ---------------------------------------------------------------------------
// Look
const ROLES = [
  { id: "lead",    name: "Lead Vox", color: "#b79cff", sub: "Main take" },
  { id: "double",  name: "Double",   color: "#8b5cf6", sub: "Stack L/R" },
  { id: "adlib",   name: "Adlibs",   color: "#ff6b8b", sub: "Throws + ad-libs" },
  { id: "harmony", name: "Harmony",  color: "#3dd6f5", sub: "Stacks" },
  { id: "backs",   name: "Backs",    color: "#ff4fb8", sub: "Backing vox" },
  { id: "fx",      name: "FX Vox",   color: "#c3c7da", sub: "Risers + chops" },
];
const BEAT_COLOR = "#ece6ff";
const INST_COLOR = "#5eead4";
const STEM_ROLE = { id: "stem", name: "Stem", color: "#9aa3b8", sub: "From the stem splitter" };
const roleOf = (id) => (id === "stem" ? STEM_ROLE : ROLES.find((r) => r.id === id) || ROLES[0]);
// Every lane gets its own colour automatically, so different sounds read apart at a glance.
// Lanes that hold the same thing share one: copies ("Lead 2", "808 (audio)") and spellings of
// the same sound (hats / hi-hats). A colour picked by hand (track.color) always wins.
// No yellow, orange or peach (Eman, 4 Nov): acid yellow means marker / loop / selected.
// No red either (Eman, 8 Nov: red patterns "look wrong"): Red became Blue. Red stays for warnings
// and overlap outlines only. KT2_RED_CLIPS_OLD = true brings the old red back.
const LANE_COLORS = window.KT2_RED_CLIPS_OLD
  ? ["#b79cff", "#ff5c7a", "#3dd6f5", "#ff6fb5", "#5eead4", "#e05cff", "#6fe08a", "#8aa2ff", "#9fd8ff", "#a06bff", "#34c3b0", "#f59ac0"]
  : ["#b79cff", "#4d8dff", "#3dd6f5", "#ff6fb5", "#5eead4", "#e05cff", "#6fe08a", "#8aa2ff", "#9fd8ff", "#a06bff", "#34c3b0", "#f59ac0"];
const COLOR_NAMES = ["Lilac", window.KT2_RED_CLIPS_OLD ? "Red" : "Blue", "Cyan", "Pink", "Mint", "Magenta", "Green", "Periwinkle", "Sky", "Violet", "Teal", "Rose"];
function colorKey(t) {
  const n = (t.name || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/\b(copy|dup|duplicate)\b/g, " ")
    .replace(/\s+\d+\s*$/, "").replace(/\s+/g, " ").trim();
  return /^(hi-?hats?|hats?|hh)$/.test(n) ? "hats" : n || t.id;
}
function autoColors(tracks) {
  const byKey = new Map(), out = new Map();
  for (const t of tracks) {
    if (t.kind === "beat") continue;
    const k = colorKey(t);
    if (!byKey.has(k)) byKey.set(k, LANE_COLORS[byKey.size % LANE_COLORS.length]);
    out.set(t.id, byKey.get(k));
  }
  return out;
}
// KILLTOY 2: a lane colour from an old song in a colour that's out now (yellow, orange, red) shows in the allowed one next to it
const laneTint = (c) => (window.KT2 && KT2.noYellow ? KT2.noYellow(c) : c);
const colorOf = (track) => (track.kind === "beat" ? BEAT_COLOR : track.kind === "master" ? "var(--purple)" : laneTint(track.color
  || (ui.autoColors && ui.autoColors.get(track.id)) || (track.kind === "inst" ? INST_COLOR : roleOf(track.role).color)));

// KILLTOY 2 (Eman, 31 Oct): our own effects say Toy... so they stand out from other plugins.
// Only the shown name changes (the type stays), TOY MACHINE, KILLDRUM and BLOB keep theirs.
const TOY_NAMES = { ktpump: "ToyPump", ktchoppitch: "ToyChop", ktspace: "ToySpace", ktcrush: "ToyCrush", ktloud: "ToyLoud",
  ktsquash: "ToySquash", ktpunch: "ToyPunch", ktscclip: "ToyClip", ktsnaptune: window.KT2_TUNR_TOYNAME_OLD ? "ToyTune" : "TUNR", kttoytune: "TOYTUNE", kttoyvox: "TOY VOX", kttexture: "ToyTexture", purpgate: "ToyGate",
  ...(window.KT2CoreFx ? KT2CoreFx.toyNames() : {}) };
function toyName(p) {
  if (!document.documentElement.classList.contains("kt2")) return p.name;
  return TOY_NAMES[String(p.type || p.key || "").replace(/^builtin:/, "")] || p.name;
}
function toyNames(s) {
  if (!document.documentElement.classList.contains("kt2")) return;
  const fix = (list) => { for (const p of list || []) { const n = toyName(p); if (n !== p.name) p.name = n; } };
  for (const t of s.tracks || []) { fix(t.plugins); for (const c of t.clips || []) fix(c.plugins); }
  if (s.master) fix(s.master.plugins);
}
function deviceColor(p) {
  const core = window.KT2CoreFx && KT2CoreFx.color(p);
  if (core) return core;
  const n = (p.type + " " + p.name).toLowerCase();
  if (/ktscclip|sc clip/.test(n)) return "#ff7a45";
  if (/kttexture|texture|granular/.test(n)) return "#5ef0c8";
  if (/squash|multiband/.test(n)) return "#3dd6f5";
  if (/punch|transient/.test(n)) return "#ff7a45";
  if (/comp|press|limit/.test(n)) return "#3dd6f5";
  if (/4bandeq|\beq\b|pass\b|\bair\b/.test(n)) return "#b79cff";
  if (/delay|echo/.test(n)) return "#ffb547";
  if (/verb|room|hall/.test(n)) return "#ff4fb8";
  if (/drive|dens|tape|tube|fat|dist|sat/.test(n)) return "#ff7a45";
  if (/tune|pitch/.test(n)) return "#e4ff3a";
  return "#8b5cf6";
}

const KNOB_NAMES = {
  "low-shelf gain": "Low", "mid gain 1": "Mid", "high-shelf gain": "Air", "mix proportion": "Mix",
  "wet level": "Wet", "room size": "Size", "output gain": "Gain", "frequency": "Freq", "semitones": "Semi",
};
const knobName = (n) => KNOB_NAMES[n.toLowerCase()] || n;

// ---------------------------------------------------------------------------
// State
const ui = {
  state: null,
  transport: { position: 0, playing: false, recording: false, looping: false, input: -100 },
  selectedClip: null,
  selectedTrack: null, // a whole lane picked by its card (its effects show in the rack)
  extraClips: new Set(), // more clips picked with Shift-click (move, duplicate, delete together)
  pxPerSec: 20,
  fittedFor: null,
  cutMode: false,
  plugins: null,
  peaks: new Map(),
  openTakes: new Set(), // clips whose take folder is open
  laneSig: "",
  rollTickPos: null, rollTickN: 0,
  rackSig: "",
  dragging: null,
  meter: { level: -100, peak: -100, peakHold: 0 },
  clipMeters: new Map(), // SC Clip cards: pluginId -> recent dB shaved off
  update: null,
  updateAsked: false,
  updateLater: 0,
};

// Width of the lane names column: read from the CSS so the playhead lines up with the ruler.
const HEAD_W = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--head-w")) || 236;
// Where the ruler's 0:00 really sits inside the scrolling area, measured from the page so the
// playhead line and loop zone stay under the ruler triangle even when padding or borders change.
// Measured once per layout (render or resize), not on every transport tick.
let rulerLeftAt = null;
function rulerLeft() {
  if (rulerLeftAt != null) return rulerLeftAt;
  const r = $("ruler"), ph = $("playhead");
  if (!r || !ph || !ph.offsetParent) return HEAD_W;
  return (rulerLeftAt = r.getBoundingClientRect().left - ph.offsetParent.getBoundingClientRect().left - ph.offsetParent.clientLeft);
}
window.addEventListener("resize", () => { rulerLeftAt = null; });
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

async function run(cmd, args) {
  const opening = cmd === "openSession" || cmd === "openVersion";
  if (opening) showVeil(cmd === "openSession" ? args.name : null);
  const res = await booth(cmd, args);
  if (opening && ui.veil) { ui.veil.opened = true; updateVeil(); } // a second open may have closed this veil
  // the KILLDRUM window keeps its own copy of the kit: after undo/redo/import it reads the lane again
  if (kdWin && /^(undo|redo|importSession|openVersion|openSession)$/.test(cmd)) refreshKillDrum();
  if (res && res.error) toast(res.error, true);
  else if (res && res.warning) toast(res.warning);
  return res;
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "");
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), Math.max(3400, msg.length * 55));
}

// ---------------------------------------------------------------------------
// Time helpers
const bpm = () => (ui.state ? ui.state.bpm : 120);
const secPerBeat = () => 60 / bpm();
const secPerBar = () => secPerBeat() * 4;
const toX = (sec) => sec * ui.pxPerSec;
const toSec = (x) => Math.max(0, x / ui.pxPerSec);
window.ktTlGeom = () => ({ pps: ui.pxPerSec, head: HEAD_W });   // MARKER GLUE (shell): where bar time sits on screen
const snap = (sec) => {
  if (ui.snapOff) return Math.max(0, sec); // the Snap tool (KILLTOY 2) turned off
  const grid = secPerBeat() / 4; // 1/16 note
  return Math.round(sec / grid) * grid;
};
const snapBeat = (sec) => ui.snapOff ? Math.max(0, sec) : Math.max(0, Math.round(sec / secPerBeat()) * secPerBeat());
// Zoomed in so far that one 1/16 step is wider than 160 px: snap lets go and edges, clips and the
// marker move freely, down to single milliseconds (Eman, 6 Nov 22:58). KT2_DEEP_SNAP_OLD = always snap.
const deepZoom = () => !window.KT2_DEEP_SNAP_OLD && (secPerBeat() / 4) * ui.pxPerSec >= 160;
// Clips and patterns snap like a magnet to the grid you can see (Eman, 31 Oct): whole bars when
// zoomed out, beats closer in, 1/16 notes up close. Alt = free.
// Smart snap (Eman, 31 Oct): the grid it snaps to follows the mouse. A slow, small push lands on
// in-between spots (half bar, beat, 16th), a fast throw lands on an obvious one (bar, 2 bars).
// Zooming in makes every step bigger on screen, so finer spots come in reach.
// speed = pointer speed in px/ms (none = a calm default)
// dir (clip drags): -1/+1 = the next spot ahead in the direction you're moving, 0/none = the nearest
const snapGrid = (sec, speed, dir) => {
  if (ui.snapOff || deepZoom()) return Math.max(0, sec);
  const bar = secPerBar(), beat = secPerBeat();
  const minPx = speed == null ? 24 : speed < 0.15 ? 10 : speed < 0.4 ? 22 : speed < 0.9 ? 45 : speed < 1.8 ? 90 : 170;
  const grids = [beat / 4, beat / 2, beat, bar / 2, bar, bar * 2, bar * 4];
  const g = grids.find((x) => x * ui.pxPerSec >= minPx) || grids[grids.length - 1];
  const q = sec / g, f = dir < 0 ? Math.floor(q + 1e-6) : dir > 0 ? Math.ceil(q - 1e-6) : Math.round(q);
  return Math.max(0, f * g);
};
// The cut tool snaps too while SNAP is on (Eman, 6 Nov 15:45): to the grid you can see, never onto the
// clip's own edges. Alt = free. KT2_CUT_FREE = the old free cut.
const cutTime = (c, x, e) => {
  const free = c.start + toSec(x);
  if (ui.snapOff || (e && e.altKey) || window.KT2_CUT_FREE) return free;
  const s = snapGrid(free);
  return s > c.start + 1e-3 && s < c.start + c.length - 1e-3 ? s : free;
};
// the marker's snap: like snapGrid but always on
const markerSnap = (sec, speed) => { const off = ui.snapOff; ui.snapOff = false; try { return snapGrid(sec, speed); } finally { ui.snapOff = off; } };
// pointer speed tracker for drags: feed it mousemove events, read .v (px/ms, smoothed)
// It reads the time the mouse actually moved (the event's timeStamp), not the time the page got round to it: right
// after a press the page is busy (selecting, drawing) and a fast throw's first move looked slow, so the clip
// snapped to a spot behind the hand (robot users, 8 Nov). KT2_SPEED_NOW_OLD = the old clock.
const speedMeter = () => { let lx = null, lt = 0; const m = { v: 0, feed(ev) { const t = (!window.KT2_SPEED_NOW_OLD && ev.timeStamp > 0) ? ev.timeStamp : performance.now();
  if (lx != null && t > lt) { const inst = Math.hypot(ev.clientX - lx, ev.clientY - (m.ly == null ? ev.clientY : m.ly)) / Math.max(4, t - lt); m.v = inst > m.v ? inst : m.v * 0.6 + inst * 0.4; }   // speeds up at once, calms down smoothly
  lx = ev.clientX; m.ly = ev.clientY; lt = t; } }; return m; };
// The row a dragged clip goes to (Eman's take, 8 Nov 18:59): the row under cy, out of the rows you can SEE
// and can drop on (ok). Above the first one or below the last one (the ruler, the toolbar, out of the
// window) it stays on the nearest one; it used to jump back to the row it came from and land there.
// Near a border it keeps the row it's on for a few px, so a shaky hand doesn't flick it between two.
// KT2_DRAG_EDGE_OLD = the old way (only the row exactly under cy, none = back home).
const dragRowAt = (cy, ok, prev) => {
  const sc = $("scroll"), tt = $("timeline-top");
  if (!sc) return null;
  const sr = sc.getBoundingClientRect();
  const top = Math.max(sr.top, tt && tt.offsetParent ? tt.getBoundingClientRect().bottom : sr.top), bot = sr.top + sc.clientHeight;
  const rows = [];
  for (const r of document.querySelectorAll("#rows > .row")) {
    if (!r.offsetParent || !ok(r)) continue;
    const q = r.getBoundingClientRect(), a = Math.max(top, q.top), b = Math.min(bot, q.bottom);
    if (b - a >= 6) rows.push({ r, a, b });
  }
  if (!rows.length) return null;
  if (prev) {
    const p = rows.find((x) => x.r === prev);
    if (p) { const pad = Math.min(10, (p.b - p.a) * 0.2); if (cy >= p.a - pad && cy < p.b + pad) return prev; }
  }
  let best = null, bd = Infinity;
  for (const x of rows) { const d = cy < x.a ? x.a - cy : cy >= x.b ? cy - x.b + 1e-3 : 0; if (d < bd) { bd = d; best = x.r; } }
  return best;
};
// While a clip is dragged near (or past) the edge of the lanes, the view scrolls along (KT2_DRAG_SCROLL_OLD = it
// doesn't). Calls tick() after each scroll step so the clip follows. Returns stop().
const dragEdgeScroll = (getPt, tick) => {
  let raf = 0, done = false;
  const step = () => {
    raf = 0;
    if (done) return;
    const sc = $("scroll"), pt = getPt();
    if (!sc || !pt) return;
    const sr = sc.getBoundingClientRect(), tt = $("timeline-top");
    const top = Math.max(sr.top, tt && tt.offsetParent ? tt.getBoundingClientRect().bottom : sr.top), bot = sr.top + sc.clientHeight;
    const lane = document.querySelector("#rows > .row .lane"), left = lane ? Math.max(sr.left, lane.getBoundingClientRect().left) : sr.left + HEAD_W, right = sr.left + sc.clientWidth;
    const zone = 36, sp = (d) => Math.max(-1, Math.min(1, d / zone)) * 16;
    const dx = pt.x > right - zone ? sp(pt.x - (right - zone)) : pt.x < left + zone && sc.scrollLeft > 0 ? sp(pt.x - (left + zone)) : 0;
    // up/down only once the hand is AT or past the edge (robot users: a shaky hand on the lowest row you can see
    // scrolled the rows under the clip and it hopped rows)
    const dy = pt.y > bot - 4 ? sp(pt.y - (bot - 4)) * 0.6 : pt.y < top + 2 && sc.scrollTop > 0 ? sp(pt.y - (top + 2)) * 0.6 : 0;
    const l0 = sc.scrollLeft, t0 = sc.scrollTop;
    if (dx) sc.scrollLeft += dx;
    if (dy) sc.scrollTop += dy;
    // 24 Nov (Eman clip 00.51): tick() runs the clip's move, which pokes this loop again; scheduling AFTER it
    // started a 2nd loop every frame, so the scroll sped up 2x per frame, ran to millions of px and the grid
    // vanished. Book the next frame first so the poke sees it. KT2_EDGE_LOOP_OLD = the doubling order.
    if (sc.scrollLeft !== l0 || sc.scrollTop !== t0) {
      if (window.KT2_EDGE_LOOP_OLD) { tick(); raf = requestAnimationFrame(step); } else { raf = requestAnimationFrame(step); tick(); }
    }
  };
  return { poke() { if (!raf && !done) raf = requestAnimationFrame(step); }, stop() { done = true; if (raf) cancelAnimationFrame(raf); raf = 0; } };
};
function fmtTime(sec) {
  sec = Math.max(0, sec || 0);   // the engine can report a hair below 0 right as play starts
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
function fmtBars(sec) {
  const beats = Math.max(0, sec || 0) / secPerBeat() + 1e-6;
  return `${Math.floor(beats / 4) + 1}.${Math.floor(beats % 4) + 1}`;
}
const barAt = (sec) => Math.floor(sec / secPerBar() + 1e-6) + 1;

function allClips() {
  return ui.state ? ui.state.tracks.flatMap((t) => t.clips.map((c) => ({ ...c, track: t }))) : [];
}
function findClip(id) { return allClips().find((c) => c.id === id) || null; }
const isSel = (id) => id === ui.selectedClip || ui.extraClips.has(id);
// Re-draw just the patterns whose selection changed (see render). False = not possible here, rebuild all.
function reSelect(was, now) {
  const a = new Set(was.filter(Boolean)), b = new Set(now.filter(Boolean));
  const ids = new Set([...a, ...b].filter((id) => a.has(id) !== b.has(id)));
  if (a.size === 1) ids.add([...a][0]);   // a single pick shows its volume line, so the old and new single picks redraw too
  if (b.size === 1) ids.add([...b][0]);
  const jobs = [];
  for (const id of ids) {
    const t = ui.state.tracks.find((x) => x.clips.some((c) => c.id === id)), c = t && t.clips.find((x) => x.id === id);
    const node = document.querySelector('#rows .clip[data-clip-id="' + CSS.escape(String(id)) + '"]');
    if (!c || !node) return false;
    jobs.push([c, t, node]);
  }
  for (const [c, t, node] of jobs) node.replaceWith(renderClip(c, t, colorOf(t)));
  return true;
}
// Rebuild only the patterns of the lanes whose patterns changed (see render). False = rebuild everything.
function reLanes(was, now, selWas, selNow) {
  if (was.glob !== now.glob || was.metas.length !== now.metas.length || was.metas.some((m, i) => m !== now.metas[i])) return false;
  const tracks = ui.state.tracks, todo = [];
  for (let i = 0; i < tracks.length; i++) {
    if (was.clips[i] === now.clips[i]) continue;
    const t = tracks[i];
    if (t.kind === "beat") return false;   // the Reference lane's card shows its clip's name
    const lane = document.querySelector('#rows .row[data-track-id="' + CSS.escape(String(t.id)) + '"] > .lane');
    if (!lane) return false;
    todo.push([t, lane]);
  }
  if (!todo.length) return false;
  for (const [t, lane] of todo) {
    const color = colorOf(t);
    lane.querySelectorAll(":scope > .clip").forEach((n) => n.remove());
    for (const c of t.clips) lane.append(renderClip(c, t, color));
  }
  const done = new Set(todo.map(([t]) => t.id));
  // a selection change in the lanes that stayed is drawn the same way as a plain pick
  const keep = (ids) => ids.filter((id) => { const t = tracks.find((x) => x.clips.some((c) => c.id === id)); return t && !done.has(t.id); });
  return reSelect(keep(selWas.filter(Boolean)), keep(selNow.filter(Boolean)));
}
const selectedIds = () => (ui.selectedClip ? [ui.selectedClip, ...ui.extraClips] : []);

// Volume. A clip's gain line sits in the middle at 0 dB, the top is +12 dB, the bottom
// silence. The lane fader has 0 dB at three quarters, +6 dB at the end.
const dbToLin = (db) => (db <= -60 ? 0 : Math.pow(10, db / 20));
const linToDb = (g) => (g <= 0.001 ? -60 : Math.max(-60, 20 * Math.log10(g)));
const gainToFrac = (db) => (db >= 0 ? 0.5 + Math.min(12, db) / 24 : 0.5 * Math.sqrt(dbToLin(db)));
const fracToGain = (f) => (f >= 0.5 ? Math.min(12, (f - 0.5) * 24) : linToDb((f / 0.5) ** 2));
const volToFrac = (db) => (db >= 0 ? 0.75 + Math.min(6, db) / 24 : 0.75 * Math.sqrt(dbToLin(db)));
const fracToVol = (f) => (f >= 0.75 ? Math.min(6, (f - 0.75) * 24) : linToDb((f / 0.75) ** 2));
const fmtDb = (db) => (db <= -59.9 ? "-inf dB" : (db > 0.04 ? "+" : "") + (Math.abs(db) < 0.05 ? "0.0" : db.toFixed(1)) + " dB");
function songLength() {
  const beat = ui.state && ui.state.tracks.find((t) => t.kind === "beat");
  const beatEnd = beat && beat.clips.length ? Math.max(...beat.clips.map((c) => c.start + c.length)) : 0;
  const end = Math.max(beatEnd, ...allClips().map((c) => c.start + c.length), 0);
  return Math.max(end, 30);
}
// The timeline never ends: it always reaches at least one more screen past what you can
// see, so the grid, bars and lanes carry on however far you zoom out or scroll.
const timelineWidth = () => {
  const sc = $("scroll"), seen = sc ? sc.scrollLeft + 2 * Math.max(0, sc.clientWidth - HEAD_W) : 0;
  return Math.max(toX(songLength() + 8 * secPerBeat()), seen);
};

// ---------------------------------------------------------------------------
// Rendering
function render() {
  try { syncTmAutoMarks(); } catch (e) { /* TOY MACHINE not open */ }
  const s = ui.state;
  if (!s) return;
  toyNames(s);
  rulerLeftAt = null;
  applyLook(currentLook());

  if (ui.selectedClip && !findClip(ui.selectedClip)) {
    // Tune/Align/Clean swap the clip for a new one in the same spot: keep it selected.
    const at = ui.selectedAt;
    const same = at && allClips().find((c) => c.track.id === at.trackId && Math.abs(c.start - at.start) < 0.001);
    ui.selectedClip = same ? same.id : null;
  }
  for (const x of ui.extraClips) if (!findClip(x)) ui.extraClips.delete(x);
  const sel = ui.selectedClip && findClip(ui.selectedClip);
  ui.selectedAt = sel ? { trackId: sel.track.id, start: sel.start } : null;

  // Waveforms are kept per clip; a newly opened song (or version) has new clips, so drop the old ones.
  const opened = s.session + "|" + ((s.versions || []).find((v) => v.current) || {}).number;
  if (opened !== ui.peaksFor) { ui.peaks.clear(); ui.peaksFor = opened; }

  const key = s.key;
  $("key-name").textContent = key && key.name ? key.name : "--";
  $("key-chip").title = key && key.name
    ? `${key.name}: same notes as ${key.relative}.` + (key.byHand ? " Click to change it." : ` Found ${Math.round(key.bpmFound)} BPM in the beat. Click to change it or look again.`)
    : "The song's key: click to pick one";
  renderJobs();
  autoFit();

  $("session").textContent = s.session;
  if (document.activeElement !== $("bpm")) $("bpm").value = Number(s.bpm.toFixed(2));
  $("btn-click").classList.toggle("on", !!s.click);

  const beatTrack = s.tracks.find((t) => t.kind === "beat");
  // The "drop a beat in" card is for a brand-new, empty project only: anything on a lane, or
  // "No beat, just start", puts it away. It never blocks + Lane / + Instrument behind it.
  $("empty").hidden = !!(beatTrack && beatTrack.clips.length) || s.tracks.some((t) => t.clips.length || t.kind === "inst") || ui.emptyOff === s.session;

  renderVersions();
  renderHome();

  // Knob drags change the state many times a second. Only rebuild the lanes when
  // something they show has changed.
  // KILLTOY 2: an old song's red (or yellow) clip or lane shows in the allowed colour next to it,
  // everywhere it's read (clip, pattern window, side panel), so nothing stays red (Eman, 8 Nov)
  if (window.KT2 && KT2.noYellow) for (const t of s.tracks) {
    if (t.color) t.color = laneTint(t.color);
    for (const c of t.clips || []) if (c.color) c.color = laneTint(c.color);
  }
  ui.autoColors = autoColors(s.tracks);
  const laneArr = ([s.tracks.map((t) => [t.id, t.name, t.role, t.color, t.armed, t.muted, t.solo, t.layerOf, t.linked,
    t.volume, t.autoOpen, t.automation, t.clips.map((c) => [c.id, c.row, c.name, c.color, c.start, c.length, c.offset, c.take, c.takes, c.comp, c.plugins.length, c.gain, c.fadeIn, c.fadeOut, c.audition, c.active, c.reversed, (c.takeInfo || []).map((x) => x && x.name), c.kind === "midi" ? notesSig(c) : 0, c.orig && [c.orig.bpm, c.orig.key, c.orig.drift, !!c.orig.unfixed], c.fit, c.mk])]), s.key && s.key.name,
    variationSig(), s.master && [s.master.automation, s.master.autoOpen], window.killtoyReturns && killtoyReturns.sig(), s.sections, s.bpm, ui.pxPerSec, ui.selectedClip, [...ui.extraClips], [...ui.openTakes]]);
  const laneSig = JSON.stringify(laneArr);
  // Speed pass round 2 (27 Nov): picking a pattern used to throw away and rebuild every pattern in the song
  // (100 patterns = 100 rebuilt boxes plus the restyle and repaint of all of them). When nothing but the
  // selection changed, only the patterns whose selection changed are drawn again now; everything else stays.
  // KT2_SEL_REBUILD_OLD = rebuild everything like before.
  const selNow = [ui.selectedClip, ...ui.extraClips];
  const restSig = JSON.stringify([laneArr.slice(0, -3), laneArr[laneArr.length - 1]]);
  if (laneSig !== ui.laneSig && !window.KT2_SEL_REBUILD_OLD && ui.laneSig && restSig === ui.restSig && !ui.openTakes.size && ui.selDrawn && reSelect(ui.selDrawn, selNow)) {
    ui.laneSig = laneSig; ui.selDrawn = selNow;
  }
  // ...and when only the patterns of some lanes changed (move, new, duplicate, delete, notes, undo of those),
  // only those lanes' patterns are built again. KT2_LANE_REBUILD_OLD = rebuild everything.
  const parts = { glob: JSON.stringify([laneArr.slice(1, -3), laneArr[laneArr.length - 1], timelineWidth()]), metas: laneArr[0].map((x) => JSON.stringify(x.slice(0, 12))), clips: laneArr[0].map((x) => JSON.stringify(x[12])) };
  if (laneSig !== ui.laneSig && !window.KT2_LANE_REBUILD_OLD && !window.KT2_SEL_REBUILD_OLD && ui.laneSig && ui.laneParts && !ui.openTakes.size && ui.selDrawn && reLanes(ui.laneParts, parts, ui.selDrawn, selNow)) {
    ui.laneSig = laneSig; ui.restSig = restSig; ui.selDrawn = selNow; ui.laneParts = parts;
  }
  if (laneSig !== ui.laneSig) {
    ui.laneSig = laneSig; ui.restSig = restSig; ui.selDrawn = selNow; ui.laneParts = parts;
    // rebuilding the rows empties them for a moment, which would snap the view back to the top
    const sc = $("scroll"), top = sc ? sc.scrollTop : 0, left = sc ? sc.scrollLeft : 0;
    renderTimeline();
    if (sc) queueMicrotask(() => { if (sc.scrollTop !== top) sc.scrollTop = top; if (sc.scrollLeft !== left) sc.scrollLeft = left; });   // after the rest of render (KILLTOY 2 adds its rows last)
  }

  renderRack();
  renderTransport();
  // after the lanes are rebuilt (KILLTOY 2 adds its rows last, so wait a tick)
  if (ui.ghostJobs && (ui.ghostJobs.length || document.querySelector(".k2-sghost"))) queueMicrotask(() => clipGhosts(ui.ghostJobs));

  // A new MIDI clip made by double-clicking a lane opens straight in the piano roll.
  if (ui.openRollFor) {
    const c = findClip(ui.openRollFor);
    if (c) { ui.openRollFor = null; openRoll(c); }
  } else if (iw) {
    refreshLaneWindow();
  }
}

function autoFit() {
  // Zoom so the whole song fits the first time a beat shows up.
  const beat = ui.state.tracks.find((t) => t.kind === "beat");
  const key = beat && beat.clips[0] ? beat.clips[0].id + ui.state.session : null;
  // KILLTOY 2 (Eman, 31 Oct): every project opens at the same zoom, about 42 bars across the window.
  // Eman, 14 Nov: a bit closer, about 32 bars (KT2_ZOOM42_OLD = 42 bars).
  const kt2 = document.documentElement.classList.contains("kt2");
  const openBars = window.KT2_ZOOM42_OLD ? 42 : 32;
  const openZoom = () => { ui.fitted = false; ui.pxPerSec = Math.min(400, Math.max(3, ($("scroll").clientWidth - HEAD_W - 24) / (openBars * 4 * secPerBeat()))); };
  if (key && key !== ui.fittedFor) {
    ui.fittedFor = key;
    if (kt2) openZoom(); else fitSong(false);
  } else if (!key && !allClips().length && ui.fittedFor !== "empty:" + ui.state.session) {
    // A new, empty project: show 16 bars, not the zoom left over from the last song.
    ui.fittedFor = "empty:" + ui.state.session; ui.fitted = false;
    if (kt2) openZoom(); else ui.pxPerSec = Math.min(400, Math.max(3, ($("scroll").clientWidth - HEAD_W - 24) / (16 * 4 * secPerBeat())));
  } else if (kt2 && !key && allClips().length && ui.fittedFor !== "open:" + ui.state.session && !String(ui.fittedFor || "").endsWith(ui.state.session)) {
    ui.fittedFor = "open:" + ui.state.session; openZoom();   // a project with patterns but no beat
  }
}

// While the whole song is fitted, it stays fitted when the window changes size.
function fitSong(rerender = true) {
  ui.fitted = true;
  const avail = $("scroll").clientWidth - HEAD_W - 24;
  ui.pxPerSec = Math.min(400, Math.max(3, avail / (songLength() + 2 * secPerBeat())));
  if (rerender) render();
}

function renderVersions() {
  const box = $("versions");
  box.replaceChildren();
  const versions = ui.state.versions && ui.state.versions.length ? ui.state.versions : [{ number: 1, current: true }];
  const track = el("div", "track");
  box.append(track);
  versions.forEach((v, i) => {
    // A version can carry its own name ("V4 Fred"). Only the open one shows it in full, the
    // rest show just "V4" (full name on hover), so a long row stays clear of the transport.
    const name = v.name || "V" + v.number, short = name.split(" ")[0];
    const b = el("button", v.current ? "on" : "", v.current ? name : short);
    b.title = v.current ? "You're on " + name : "Switch to " + name;
    b.onclick = () => !v.current && run("openVersion", { index: i });
    track.append(b);
  });
  const add = el("button", "add", "+");
  add.title = "New version: a copy of this session to try ideas on. The others stay as they are.";
  add.onclick = () => run("newVersion").then((r) => r && r.ok && toast(`V${r.version} is a copy to play with. The other versions stay safe.`));
  box.append(add);
}

// The lanes' grid (Eman, 27 Oct: "add grids for the tracks"): a line on every bar, fainter beats when
// there's room, and every 4 bars when zoomed far out.
function setGrid() {
  const beatPx = toX(secPerBeat());
  if (!window.KT2_GRID_OLD) return setGridSnapped(beatPx);
  const line = (c, every) => `repeating-linear-gradient(90deg, var(${c}) 0 1px, transparent 1px ${every}px)`;
  const grid = beatPx >= 7 ? `${line("--grid-major", beatPx * 4)}, ${line("--grid-minor", beatPx)}`
    : beatPx * 4 >= 9 ? `${line("--grid-major", beatPx * 16)}, ${line("--grid-minor", beatPx * 4)}`
    : line("--grid-major", beatPx * 16);
  // Eman, 4 Nov: every other 4 bars a shade darker, so lengths read at a glance
  const four = beatPx * 16, band = `repeating-linear-gradient(90deg, transparent 0 ${four}px, var(--grid-band, rgba(0, 0, 0, 0.17)) ${four}px ${four * 2}px)`;
  document.body.style.setProperty("--grid", grid + ", " + band); // on body: the grid colours are defined there (on html they came out empty, so no grid showed)
}

// Eman, 10 Nov 21:03: "in some zooms the grid is fucked up". The repeating gradients above are drawn by
// the graphics card, which loses precision far out on a wide lane, so lines landed mid-bar (thick ones near
// 70, 74, 78...) and the dark 4-bar bands slid off. Now the grid is drawn as small pictures, 1024px each,
// with every line put on the same whole screen pixel as the ruler's bar line. KT2_GRID_OLD = the old way.
let gridKey = "";
function setGridSnapped(beatPx) {
  const cs = getComputedStyle(document.body);
  const col = (n, d) => (cs.getPropertyValue(n).trim() || d);
  let major = col("--grid-major", "rgba(255,255,255,0.1)"), minor = col("--grid-minor", "rgba(255,255,255,0.04)");
  let bandC = col("--grid-band", "rgba(0, 0, 0, 0.17)");
  const dpr = window.devicePixelRatio || 1, W = Math.ceil(timelineWidth()) + 2;
  // Eman, 12 Nov 00:05: with a background PICTURE the light/dark 4-bar bands and the beat lines took
  // too much attention. Picture only: no bands, no beat lines, just faint bar lines with a slightly
  // clearer line every 4 bars, so more of the picture shows. No picture / colour looks keep the
  // grid exactly as before. KT2_GRID_PIC_OLD = old grid on pictures too.
  const pic = !window.KT2_GRID_PIC_OLD && document.body.classList.contains("look-image");
  const key = [beatPx, W, dpr, major, minor, bandC, pic].join("|");
  if (key === gridKey) return;
  gridKey = key;
  // same choice of lines as before: beats + bars, or bars + every 4 bars, or every 4 bars only
  let [majEvery, minEvery] = beatPx >= 7 ? [4, 1] : beatPx * 4 >= 9 ? [16, 4] : [16, 0];
  if (pic) {
    [majEvery, minEvery] = beatPx * 4 >= 9 ? [16, 4] : [16, 0];
    bandC = "";
    major = "rgba(255,255,255,0.11)"; minor = "rgba(255,255,255,0.05)";
  }
  const snap = (x) => Math.round(x * dpr) / dpr;   // a ruler tick's 1px border lands on a whole device pixel too
  const lineW = 1, C = 1024, layers = [];
  for (let c0 = 0; c0 < W; c0 += C) {
    const w = Math.min(C, W - c0);
    let band = "", lo = "", hi = "";
    const four = beatPx * 16;
    for (let k = Math.max(0, Math.floor(c0 / four)); k * four < c0 + w; k++) {
      if (k % 2 === 0 || !bandC) continue;   // every other 4 bars a shade darker (Eman, 4 Nov), starting with bars 5-8
      const a = Math.max(c0, snap(k * four)), b = Math.min(c0 + w, snap((k + 1) * four));
      if (b > a) band += `<rect x="${+(a - c0).toFixed(3)}" width="${+(b - a).toFixed(3)}" y="0" height="1"/>`;
    }
    const step = minEvery || majEvery;
    for (let i = Math.max(0, Math.floor(c0 / (beatPx * step)) * step); i * beatPx < c0 + w; i += step) {
      const x = snap(i * beatPx) - c0;
      if (x < -lineW || x >= w) continue;
      const r = `<rect x="${+x.toFixed(3)}" width="${lineW}" y="0" height="1"/>`;
      if (minEvery) lo += r;
      if (i % majEvery === 0) hi += r;
    }
    if (!band && !lo && !hi) continue;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="1" viewBox="0 0 ${w} 1" preserveAspectRatio="none" shape-rendering="crispEdges">` +
      (band ? `<g fill="${bandC}">${band}</g>` : "") + (lo ? `<g fill="${minor}">${lo}</g>` : "") + (hi ? `<g fill="${major}">${hi}</g>` : "") + "</svg>";
    layers.push(`url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c0}px 0 / ${w}px 100% no-repeat`);
  }
  document.body.style.setProperty("--grid", layers.join(", ") || "none");
}

function renderTimeline() {
  const s = ui.state;
  const width = timelineWidth();
  $("inner").style.width = HEAD_W + width + "px";
  $("timeline-top").style.width = width + "px";
  setGrid();

  renderSections(width);
  renderRuler(width);

  const rows = $("rows");
  rows.replaceChildren();
  for (const t of s.tracks) {
    const isBeat = t.kind === "beat";
    if (isBeat && t.hideEmpty && !t.clips.length) continue; // an instrumental project shows no empty Reference lane
    const isInst = t.kind === "inst";
    const color = colorOf(t);
    const row = el("div", "row" + (isBeat ? " beat" : "") + (t.armed ? " armed" : "") + (ui.selectedTrack === t.id ? " selected" : ""));
    row.style.setProperty("--c", color);
    row.dataset.trackId = t.id;
    row.dataset.kind = t.kind;

    const head = el("div", "head");
    const badge = el(isBeat ? "div" : "button", "dot-btn");
    const drumLane = !isBeat && !isInst && window.killtoyLibrary && window.killtoyLibrary.laneType(t);
    badge.title = (isBeat ? "" : isInst ? "Click to change the instrument. " : drumLane ? "Click to change this lane's sound. " : "Click to change what this lane is for. ") + "Hold to see how it was made.";
    holdForSource(badge, t);
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      if (performance.now() < ui.heldUntil) return; // this click ends a hold that opened the source panel
      if (isBeat) return;
      // A drum lane's dot changes its sound (the Library, library.js); other lanes pick what they're for.
      if (!isInst && window.killtoyLibrary && window.killtoyLibrary.laneType(t)) return window.killtoyLibrary.openForLane(t);
      isInst ? showInstrumentMenu(badge, t) : showRoleMenu(badge, t);
    });

    const text = el("div", "head-text");
    const name = el("div", "head-name", isBeat ? "Reference" : t.name);
    const sub = el("div", "head-sub", isBeat ? (t.clips[0] ? t.clips[0].name : "No beat yet")
      : t.armed ? (isInst ? "Keyboard plays here" : "Recording here")
      : isInst ? (t.instrument || "No instrument") + " \u00b7 double-click to add notes" : t.sub || roleOf(t.role).sub);
    if (!isBeat) {
      name.title = "Double-click to rename";
      name.ondblclick = () => inlineEdit(name, t.name, (v) => run("renameTrack", { trackId: t.id, name: v }));
    }
    // A TOY MACHINE lane: double-click its line (or the dot) to open the synth with the lane's preset.
    // A TOY MACHINE lane: click its name or its line (or double-click the dot) to open the synth.
    // The synth lives on the lane's own plugin list; older sessions kept it on a clip.
    if (isInst && /toy machine/i.test(t.instrument || "")) {
      sub.textContent = "TOY MACHINE \u00b7 click to open" + (t.armed ? " \u00b7 keyboard plays here" : "");
      sub.classList.add("tm-open");
      name.classList.add("tm-open");
      sub.title = name.title = "Click to open TOY MACHINE. Double-click the name to rename.";
      const open = (e) => { e.stopPropagation(); openLaneSynth(t.id); };
      let nameTimer = 0; // a double-click on the name renames, so wait a moment before opening
      name.addEventListener("click", (e) => { e.stopPropagation(); clearTimeout(nameTimer); if (e.detail === 1) nameTimer = setTimeout(() => open(e), 260); });
      name.addEventListener("dblclick", () => clearTimeout(nameTimer));
      sub.addEventListener("click", open);
      badge.addEventListener("dblclick", open);
    }
    text.append(name, sub, laneFader(t));

    const btns = el("div", "head-btns");
    const mute = el("button", "msr m" + (t.muted ? " on" : ""), "M");
    mute.title = "Mute";
    mute.onclick = () => run("toggleMute", { trackId: t.id });
    const solo = el("button", "msr s" + (t.solo ? " on" : ""), "S");
    solo.title = "Solo";
    solo.onclick = () => run("toggleSolo", { trackId: t.id });
    btns.append(mute, solo);
    if (!isBeat) {
      const arm = el("button", "msr r" + (t.armed ? " on" : ""), "R");
      arm.title = isInst ? "Play and record your MIDI keyboard on this lane" : "Record into this lane";
      arm.onclick = () => run("armTrack", { trackId: t.id });
      btns.append(arm);
    }

    head.append(badge, text, btns);
    const sends = SHOW_RETURNS && window.killtoyReturns && killtoyReturns.sendKnobs(t);   // A/B send knobs (returns.js), when the engine has returns
    if (sends) head.append(sends);
    head.title = "Click to see this lane's effects. Right-click for more.";
    head.addEventListener("contextmenu", (e) => { e.preventDefault(); laneMenu(e, t); });
    head.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.closest("button, input")) return;
      if (ui.selectedTrack !== t.id) selectTrack(t.id);
    });

    const lane = el("div", "lane");
    lane.style.width = width + "px";
    // Empty lane: click or drag moves the marker (and lets go of a looped section).
    // (Double-clicks are read from e.detail: the first click re-renders the lanes, so a
    // dblclick event would land on a different element.)
    lane.addEventListener("mousedown", (e) => {
      if (e.target !== lane || e.button !== 0) return;
      if (isInst && e.detail === 2) {
        const start = Math.floor(toSec(e.offsetX) / secPerBar() + 1e-6) * secPerBar();
        run("newMidiClip", { trackId: t.id, start, bars: NEW_PATTERN_BARS() }).then((r) => {
          if (r && r.ok) { ui.selectedClip = r.clipId; ui.openRollFor = r.clipId; render(); }
        });
        return;
      }
      selectClip(null);
      unloopPart();
      startMarkerDrag(e, lane);
    });
    if (isInst) lane.title = "Double-click to add a MIDI clip";
    for (const c of t.clips) lane.append(renderClip(c, t, color));

    // Open take folders: every take stacked under the clip, swipe across one to comp.
    // Variations (variations.js) land here too, with a loading row while they're made.
    const open = t.clips.filter((c) => hasFolder(c) && ui.openTakes.has(c.id));
    if (open.length) {
      const extra = Math.max(...open.map((c) => folderRows(c))) * TAKE_H + 4;
      row.classList.add("expanded");
      row.style.height = `calc(var(--row-h) + ${extra}px)`;
      for (const c of open) { renderTakeStrips(lane, c, color); renderPendingStrips(lane, c); }
      renderVariationHeads(head, open.find((c) => c.id === ui.selectedClip) || open[0]);
    }

    if (!isBeat && s.canAutomate) head.append(autoButton(t));   // engines without automation (yet) don't show it
    row.append(head, lane);
    rows.append(row);
    if (!isBeat && s.canAutomate && t.autoOpen) for (const a of t.automation || []) rows.append(autoRow(t, a, width, color));
  }
  // "+ Lane / + Instrument" follow the last lane; the space under them pushes the master to the bottom edge.
  ui.addRow = ui.addRow || document.querySelector(".add-row");
  if (ui.addRow) rows.append(ui.addRow);
  if (s.master) {   // engines without a master bus (yet) don't show one
    rows.append(el("div", "rows-gap"));
    const mt = masterTrack();
    if (s.canAutomate && mt.autoOpen) for (const a of mt.automation) rows.append(autoRow(mt, a, width, "#8b5cf6"));   // its lines sit just above it (it stays at the bottom)
    if (SHOW_RETURNS && window.killtoyReturns) rows.append(...killtoyReturns.rows(width));   // the A/B returns, just above the master
    rows.append(masterRow(width));
  }

  renderOverlays();
}

// The master strip under the lanes: name, what's on it, its fader and its output meter.
// Click it to see its effects in the rack (same cards as a lane), right-click for more.
// A name box that never spills over its neighbours: a name too long for its box scrolls
// through it right to left on a loop, like a news ticker (TOY MACHINE's preset, KILLDRUM's kit).
function setTickerText(box, text) {
  text = String(text == null ? "" : text);
  if (box.dataset.ticker === text && box.firstElementChild) return fitTicker(box);
  box.dataset.ticker = text;
  box.classList.add("kt-ticker");
  box.replaceChildren(el("span", "kt-tick", text));
  if (!box.ktObserved && window.ResizeObserver) { box.ktObserved = true; new ResizeObserver(() => fitTicker(box)).observe(box); }
  requestAnimationFrame(() => fitTicker(box));
}
function fitTicker(box) {
  const tick = box.firstElementChild, text = box.dataset.ticker || "";
  if (!tick || !box.clientWidth) return;
  tick.replaceChildren(text);
  box.classList.remove("kt-ticking");
  tick.style.animationDuration = "";
  // 15 Nov (Eman): a short name that fits the box stays still, even when the box is squeezed so small that the
  // name runs into its side padding; then the name spills into the padding, centred (the box keeps its size).
  // KT2_TICKER_PAD_OLD = the old check (padding counted, so a short name like "Init" scrolled in a narrow box).
  const oldPad = !!window.KT2_TICKER_PAD_OLD;
  tick.style.marginLeft = tick.style.marginRight = "";
  const cs = getComputedStyle(box), room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (tick.scrollWidth <= room + 1) return;
  if (!oldPad && tick.scrollWidth <= box.clientWidth - 2) {
    tick.style.marginLeft = tick.style.marginRight = -Math.ceil((tick.scrollWidth - room) / 2) + "px";
    return;
  }
  tick.replaceChildren(el("span", null, text), el("span", null, text)); // two copies, so the loop has no seam
  box.classList.add("kt-ticking");
  tick.style.animationDuration = Math.max(4, tick.scrollWidth / 2 / 38) + "s"; // ~38 px a second
}
window.setTickerText = setTickerText;

// The A/B returns (returns.js) are hidden for now (Eman, 2026-10-28): no return rows, no send knobs.
const SHOW_RETURNS = false;

function masterRow(width) {
  const t = masterTrack();
  const row = el("div", "row master" + (ui.selectedTrack === t.id ? " selected" : ""));
  row.style.setProperty("--c", colorOf(t));
  row.dataset.trackId = t.id;
  row.dataset.kind = "master";
  const head = el("div", "head");
  const text = el("div", "head-text");
  const on = t.plugins.filter((p) => !p.instrument);
  const chain = [...on.map((p) => p.name + (p.enabled ? "" : " (off)")), "Limiter"].join(" \u2192 ");
  const sub = el("div", "head-sub", on.length ? chain : "No effects \u00b7 limiter on");
  sub.title = "Everything plays through: " + chain;
  text.append(el("div", "head-name", "Master"), sub, laneFader(t));
  const meter = el("div", "mmeter");
  meter.title = "What comes out of your speakers";
  const fill = el("i", "mmeter-fill"), peak = el("b", "mmeter-peak");
  meter.append(fill, peak);
  head.append(el("div", "dot-btn"), text, meter);
  if (ui.state.canAutomate) head.append(autoButton(t));
  head.title = "Click to see the master's effects. Right-click for more.";
  head.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.target.closest("button, input, .vol")) return;
    if (ui.selectedTrack !== t.id) selectTrack(t.id);
  });
  head.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (ui.selectedTrack !== t.id) selectTrack(t.id);
    showMenu(atMouse(e), [
      { heading: "MASTER" },
      { label: "Volume back to 0 dB", meta: fmtDb(t.volume || 0), run: () => run("setTrackVolume", { trackId: t.id, db: 0 }) },
      ...(on.length ? [{ label: on.every((p) => !p.enabled) ? "Turn the effects back on" : "Bypass the effects", run: () => run("bypassAll", { trackId: t.id }) },
                       { sep: true }, { label: "Remove all master effects", danger: true, run: () => run("clearEffects", { trackId: t.id }) }] : []),
    ]);
  });
  const lane = el("div", "lane");
  lane.style.width = width + "px";
  lane.addEventListener("mousedown", (e) => { if (e.button === 0 && ui.selectedTrack !== t.id) selectTrack(t.id); });
  const chips = el("div", "master-chain");
  for (const p of on) {
    const chip = el("span", "chip" + (p.enabled ? "" : " off"), p.name);
    chip.style.setProperty("--dc", deviceColor(p));
    chips.append(chip, el("span", "arrow", "\u2192"));
  }
  chips.append(el("span", "chip lim", "Safety limiter"), el("span", "arrow", "\u2192"), el("span", "out", "Speakers"));
  lane.append(chips);
  row.append(head, lane);
  return row;
}

// ---------------------------------------------------------------------------
// Automation lanes (Ableton-style; model and session.json format in automation.js). Each lane
// sits under its track as its own row: a line with points you drag. Click the empty line to
// add a point, drag points to move them (Alt = off the grid), double-click a point to remove it.
const AUTO_PAD = 7;

// The small icon on a track's card: shows or hides its automation lanes (a menu to add one if it has none).
function autoButton(t) {
  const n = (t.automation || []).length;
  const b = el("button", "auto-btn" + (t.autoOpen && n ? " on" : "") + (n ? " has" : ""));
  b.textContent = "A";
  b.title = n ? (t.autoOpen ? "Hide this lane's automation" : `Show this lane's automation (${n})`) + ". Right-click to automate something else." : "Automate: a volume line appears under this lane. Right-click for everything else you can automate.";
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (n) run("showAutomation", { trackId: t.id, show: !t.autoOpen });
    else automateNow(t, [{ target: { type: "volume" }, label: "Volume", value: volToFrac(t.volume || 0) }]);
  });
  b.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showAutomateMenu(b, t); });
  return b;
}

// Everything on a lane that can be automated: its volume, TOY MACHINE's sliders, every effect knob.
function automatable(t) {
  const out = [{ target: { type: "volume" }, label: "Volume", value: volToFrac(t.volume || 0) }];
  const tm = t.kind === "inst" && /toy machine/i.test(t.instrument || "");
  if (tm) for (const param of ["filter.cutoff", "ampEnv.r", "out.pan"]) out.push({ target: { type: "synth", param }, label: KillToyAuto.SYNTH[param].name, meta: "TOY MACHINE", value: null });
  const seen = new Set();
  const cards = [...(t.plugins || []).map((p) => [p, ""]), ...t.clips.flatMap((c) => c.plugins.map((p) => [p, c.name]))];
  for (const [p, where] of cards) {
    const key = p.autoOf || p.id;
    if (p.instrument || seen.has(key)) continue;
    seen.add(key);
    for (const q of p.params || []) out.push({ target: { type: "fx", pluginId: key, paramId: q.id }, label: `${knobName(q.name)}`, meta: p.name + (where ? " \u00b7 " + where : ""), value: q.value });
  }
  return out;
}
function showAutomateMenu(anchor, t) {
  const has = t.automation || [];
  const items = automatable(t).filter((x) => !has.some((l) => KillToyAuto.sameTarget(l.target, x.target)));
  const list = items.slice(0, 26).map((x) => ({ label: x.label, meta: x.meta, run: () => addAutomation(t, x.target, x.value, x.label) }));
  showMenu(anchor, [{ heading: "AUTOMATE ON " + t.name.toUpperCase() }, ...(list.length ? list : [{ label: "Everything here is automated", run: () => {} }]),
    ...(has.length ? [{ sep: true }, { label: t.autoOpen ? "Hide automation" : "Show automation", run: () => run("showAutomation", { trackId: t.id, show: !t.autoOpen }) }] : [])]);
}
// Right-click on a fader, knob or slider: one item that starts (or shows) its automation lane.
function automateItemMenu(anchor, t, target, label, value, extra) {
  const there = (t.automation || []).find((l) => KillToyAuto.sameTarget(l.target, target));
  showMenu(anchor, [{ heading: label.toUpperCase() },
    there ? { label: "Show its automation", meta: t.name, run: () => { run("showAutomation", { trackId: t.id, show: true }); flashAuto(there.id); } }
          : { label: "Automate", meta: t.name, run: () => addAutomation(t, target, value, label) },
    ...(there ? [{ label: "Remove its automation", danger: true, run: () => run("removeAutomation", { trackId: t.id, laneId: there.id }) }] : []),
    ...(extra || [])]);
}
async function addAutomation(t, target, value, label) {
  const r = await run("addAutomation", { trackId: t.id, target, value: value == null ? null : value });
  if (!r || !r.laneId) return;
  flashAuto(r.laneId);
  toast(`${label.split(" \u00b7 ")[0]} now has its own line under ${t.name}. Click the line to add points, drag them to move it.`);
}
// The "A" buttons: the lanes go in at once (or show, if they're there already).
async function automateNow(t, list) {
  let first = null;
  for (const x of list) {
    const there = (t.automation || []).find((l) => KillToyAuto.sameTarget(l.target, x.target));
    const r = there ? { laneId: there.id } : await run("addAutomation", { trackId: t.id, target: x.target, value: x.value == null ? null : x.value, name: x.label.split(" \u00b7 ")[0] });
    if (r && r.laneId && !first) first = r.laneId;
  }
  if (!t.autoOpen) await run("showAutomation", { trackId: t.id, show: true });
  if (first) flashAuto(first);
  toast(`${list.map((x) => x.label.split(" \u00b7 ")[0]).join(" + ")}: a line under ${t.name}. Click it to add points, or arm the lane (R), play, and move the control to record it.`);
}

// Recording automation, like Ableton: with the lane armed (R) and the song playing, every move
// of a control on it is written into its lane. While a control is held, its old line lets go
// of it (touchAutomation), so what you hear is your hand.
const autoRec = new Map(); // trackId|target -> { t, target, label, points, timer }
function songNow() {
  const tr = ui.transport || {};
  return (tr.position || 0) + (tr.playing ? (performance.now() - (ui.transportAt || performance.now())) / 1000 : 0);
}
function autoTouch(t, target, v, label, end) {
  if (!ui.state || !ui.state.canAutomate) return;
  t = t.id === MASTER_ID ? masterTrack() : ui.state.tracks.find((x) => x.id === t.id) || t;   // the lane as it is now (armed, its lines)
  const key = t.id + "|" + JSON.stringify(target);
  const rolling = !!(ui.transport && (ui.transport.playing || ui.transport.recording));
  // a lane records while armed (R) and the song plays; the master (no R) while the song records
  const has = (t.automation || []).some((l) => KillToyAuto.sameTarget(l.target, target));
  // A control with no line yet starts one only while the song RECORDS: playing a loop and dragging TOY MACHINE's
  // points used to write automation by itself (Zed call 2, 7 Nov 11:10: an instrument lane is armed just so the keys
  // play it). A control that already has its line still records on an armed lane while it plays. KT2_AUTO_REC_PLAY = old.
  const recNew = window.KT2_AUTO_REC_PLAY || has || !!(ui.transport && ui.transport.recording);
  const recording = t.id === MASTER_ID ? !!(ui.transport && ui.transport.recording) : rolling && t.armed && recNew;
  let r = autoRec.get(key);
  if (!r) {
    if (!recording && !has) return;
    r = { t, target, label, points: [], held: false, timer: 0 };
    autoRec.set(key, r);
  }
  if (!r.held) { r.held = true; booth("touchAutomation", { trackId: t.id, target, on: true }); }
  if (recording) {
    if (!r.points.length && !r.told) { r.told = true; toast(`Recording ${label.split(" \u00b7 ")[0]} automation on ${t.name}`); }
    r.points.push({ t: songNow(), v });
  }
  clearTimeout(r.timer);
  // a let-go, or no move for a moment: write what was recorded, give the control back to its line
  r.timer = setTimeout(() => autoCommit(key), end ? 0 : 600);
}
function autoCommit(key) {
  const r = autoRec.get(key);
  if (!r) return;
  autoRec.delete(key);
  clearTimeout(r.timer);
  booth("touchAutomation", { trackId: r.t.id, target: r.target, on: false });
  if (r.points.length) run("recordAutomation", { trackId: r.t.id, target: r.target, name: r.label.split(" \u00b7 ")[0], points: r.points });
}

function flashAuto(laneId) {
  requestAnimationFrame(() => {
    const row = document.querySelector(`.auto-row[data-lane-id="${laneId}"]`);
    if (!row) return;
    row.classList.add("flash");
    const sc = $("scroll"), r = row.getBoundingClientRect(), b = sc.getBoundingClientRect();
    if (r.bottom > b.bottom || r.top < b.top) sc.scrollTop += r.top - b.top - b.height / 2;
    setTimeout(() => row.classList.remove("flash"), 1200);
  });
}

function autoRow(t, a, width, color) {
  const row = el("div", "row auto-row");
  row.style.setProperty("--c", color);
  row.dataset.trackId = t.id;
  row.dataset.laneId = a.id;
  row.dataset.kind = "auto";
  const head = el("div", "head auto-head");
  const text = el("div", "head-text");
  const label = (t.id === MASTER_ID ? "Master \u00b7 " : "") + KillToyAuto.name(t, a);
  const nm = el("div", "auto-name", KillToyAuto.short(t, a));
  head.title = label; // the full name ("Filter cutoff \u00b7 TOY MACHINE") on hover
  const val = el("div", "auto-val", KillToyAuto.text(t, a, KillToyAuto.valueAt(a, (ui.transport && ui.transport.position) || 0)));
  text.append(nm, val);
  const follow = el("label", "auto-follow" + (a.follow !== false ? " on" : ""));
  const box = el("input");
  box.type = "checkbox";
  box.checked = a.follow !== false;
  box.onchange = () => run("setAutomation", { trackId: t.id, laneId: a.id, follow: box.checked });
  follow.append(box, el("span", "", "Follow"));
  follow.title = "On: cutting, moving or copying a clip takes this automation with it. Off: the automation stays put while clips move.";
  const pen = el("button", "auto-pen" + (ui.autoDraw ? " on" : ""));
  pen.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 13l1-3.5 7-7 2.5 2.5-7 7z"/><path d="M9.5 4l2.5 2.5"/></svg>';
  pen.title = ui.autoDraw ? "Drawing: drag across a line to paint it. Click to go back to points" : "Draw: drag across the line to paint it freehand";
  pen.onclick = (e) => { e.stopPropagation(); ui.autoDraw = !ui.autoDraw; document.querySelectorAll(".auto-pen").forEach((b) => b.classList.toggle("on", ui.autoDraw)); document.querySelectorAll(".auto-svg").forEach((v) => v.classList.toggle("draw", ui.autoDraw)); };
  const x = el("button", "auto-x", "\u00d7");
  x.title = "Remove this automation";
  x.onclick = (e) => { e.stopPropagation(); run("removeAutomation", { trackId: t.id, laneId: a.id }); };
  head.append(text, follow, pen, x);
  head.addEventListener("contextmenu", (e) => { e.preventDefault(); autoLaneMenu(e, t, a); });

  const lane = el("div", "lane auto-lane");
  lane.style.width = width + "px";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "auto-svg" + (ui.autoDraw ? " draw" : ""));
  svg.setAttribute("width", width);
  lane.append(svg);
  const pts = a.points.map((p) => ({ ...p }));
  const draw = () => drawAuto(svg, t, pts, width);
  requestAnimationFrame(draw);
  lane.addEventListener("mousedown", (e) => autoMouseDown(e, t, a, pts, svg, draw, val));
  lane.addEventListener("dblclick", (e) => {
    const i = e.target.dataset && e.target.dataset.i;
    // double-click a dot: it goes back to where the line started (the control's value when the line was made),
    // like velocity goes back to 100 (Eman, 10 Nov). Delete a dot: right-click. KT2_DBL_RESET_OFF = old (deletes)
    if (!window.KT2_DBL_RESET_OFF) { const k = i != null ? +i : autoDotNear(svg, e); if (k >= 0 && autoResetPt(a, pts, k)) { draw(); run("setAutomation", { trackId: t.id, laneId: a.id, points: pts }); } if (k >= 0) return; }
    if (i == null || pts.length <= 1) return;
    pts.splice(+i, 1);
    run("setAutomation", { trackId: t.id, laneId: a.id, points: pts });
  });
  lane.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const i = e.target.dataset && e.target.dataset.i;
    if (i != null && pts.length > 1) return showMenu(atMouse(e), [{ label: "Delete point", meta: window.KT2_DBL_RESET_OFF ? "double-click" : undefined, danger: true, run: () => { pts.splice(+i, 1); run("setAutomation", { trackId: t.id, laneId: a.id, points: pts }); } }]);
    autoLaneMenu(e, t, a);
  });
  row.append(head, lane);
  return row;
}
function autoLaneMenu(e, t, a) {
  const at = (ui.transport && ui.transport.position) || 0, v = KillToyAuto.valueAt(a, at);
  showMenu(atMouse(e), [{ heading: KillToyAuto.name(t, a).toUpperCase() },
    { label: "Automate something else\u2026", run: () => showAutomateMenu(atMouse(e), t) },
    { label: "Flatten", meta: KillToyAuto.text(t, a, v), run: () => run("setAutomation", { trackId: t.id, laneId: a.id, points: [{ t: 0, v }] }) },
    { label: a.follow !== false ? "Stop following clips" : "Follow clips", on: a.follow !== false, run: () => run("setAutomation", { trackId: t.id, laneId: a.id, follow: a.follow === false }) },
    { sep: true }, { label: "Remove this automation", danger: true, run: () => run("removeAutomation", { trackId: t.id, laneId: a.id }) }]);
}

function drawAuto(svg, t, pts, width) {
  const H = svg.clientHeight || 50, y = (v) => AUTO_PAD + (1 - v) * (H - 2 * AUTO_PAD);
  const NS = "http://www.w3.org/2000/svg", mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  svg.replaceChildren();
  // the track's clips, faintly, so you can see what the line lines up with
  for (const c of t.clips) svg.append(mk("rect", { class: "auto-clip", x: toX(c.start), y: 2, width: Math.max(2, toX(c.length)), height: H - 4, rx: 5 }));
  if (!pts.length) return;
  let d = `M0 ${y(pts[0].v)}`;
  for (const p of pts) d += ` L${toX(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`;
  d += ` L${width} ${y(pts[pts.length - 1].v)}`;
  svg.append(mk("path", { class: "auto-fill", d: d + ` L${width} ${H} L0 ${H} Z` }), mk("path", { class: "auto-line", d }));
  pts.forEach((p, i) => svg.append(mk("circle", { class: "auto-pt", cx: toX(p.t), cy: y(p.v), r: 4.5, "data-i": i })));
  svg.append(mk("circle", { class: "auto-head-dot", r: 3.5, cx: -10, cy: -10 }));
}

// a line's default: lane.base (the control's value when the line was made); older lines: its first dot
// the dot under a double-click: the first click redraws the dots, so the event's target may be the svg itself
function autoDotNear(svg, e) {
  let best = -1, bd = 10;
  for (const d of svg.querySelectorAll("circle[data-i]")) { const r = d.getBoundingClientRect(), dd = Math.hypot(r.left + r.width / 2 - e.clientX, r.top + r.height / 2 - e.clientY); if (dd < bd) { bd = dd; best = +d.dataset.i; } }
  return best;
}
function autoResetPt(a, pts, i) {
  const p = pts[i]; if (!p) return false;
  const v = a.base != null ? a.base : pts[0] ? pts[0].v : p.v;
  if (Math.abs(p.v - v) < 1e-6) return false;
  p.v = v; return true;
}
function autoMouseDown(e, t, a, pts, svg, draw, val) {
  // double-click a dot: back to the line's default (read here: the first click can redraw the dots, so the
  // dblclick event may never arrive). KT2_DBL_RESET_OFF = old
  if (e.button === 0 && e.detail === 2 && !window.KT2_DBL_RESET_OFF && !ui.autoDraw && !e.metaKey && !e.ctrlKey) {
    const k = autoDotNear(svg, e);
    if (k >= 0 && autoResetPt(a, pts, k)) { draw(); run("setAutomation", { trackId: t.id, laneId: a.id, points: pts }); }
    return;
  }
  if (e.button !== 0 || e.detail > 1) return;
  e.preventDefault();
  hidePop();
  const r = svg.getBoundingClientRect(), H = r.height;
  // a line that draws with its own top/bottom room (the KT2 lines under patterns) says so on the svg, so the
  // mouse lands on the value under it and the bottom of the box is 0% (Eman 9 Nov 22:27)
  const pT = svg.dataset.padTop != null ? +svg.dataset.padTop : AUTO_PAD, pB = svg.dataset.padBot != null ? +svg.dataset.padBot : AUTO_PAD;
  const vAt = (cy) => Math.min(1, Math.max(0, 1 - (cy - r.top - pT) / (H - pT - pB)));
  const tAt = (ev) => { const s = Math.max(0, toSec(ev.clientX - r.left)); return Math.max(0, ev.altKey ? s : snap(s)); };
  // Draw (the pencil, or Cmd/Ctrl-drag): paint the line freehand; what you paint replaces that stretch.
  if (ui.autoDraw || e.metaKey || e.ctrlKey) {
    const before = a.points.map((p) => ({ ...p })), drawn = [];
    const paint = (ev) => {
      const p = { t: Math.max(0, toSec(ev.clientX - r.left)), v: vAt(ev.clientY) };
      while (drawn.length && drawn[drawn.length - 1].t >= p.t) drawn.pop();   // going back paints over
      drawn.push(p);
      const lane = { points: before.map((q) => ({ ...q })) };
      KillToyAuto.record(lane, drawn);
      pts.splice(0, pts.length, ...lane.points);
      val.textContent = KillToyAuto.text(t, a, p.v); val.classList.add("live");
      draw();
    };
    paint(e);
    svg.classList.add("dragging");
    const up = () => {
      window.removeEventListener("mousemove", paint);
      window.removeEventListener("mouseup", up);
      svg.classList.remove("dragging"); val.classList.remove("live");
      run("recordAutomation", { trackId: t.id, target: a.target, points: drawn });
    };
    window.addEventListener("mousemove", paint);
    window.addEventListener("mouseup", up);
    return;
  }
  let i = e.target.dataset && e.target.dataset.i != null ? +e.target.dataset.i : -1;
  // a press just beside a dot grabs that dot instead of making a second one on top of it (the first and last
  // dots sit on the pattern's edges, half hidden, so they were easy to miss). AUTO_GRAB_OLD = only an exact hit.
  if (i < 0 && !window.AUTO_GRAB_OLD) {
    let best = 10;
    pts.forEach((q, k) => { const d = Math.hypot(r.left + toX(q.t) - e.clientX, r.top + pT + (1 - q.v) * (H - pT - pB) - e.clientY); if (d < best) { best = d; i = k; } });
    if (i < 0) { const st = tAt(e), k = pts.findIndex((q) => Math.abs(q.t - st) < 1e-6); if (k >= 0 && Math.abs(r.left + toX(st) - e.clientX) < 14) i = k; }
  }
  const added = i < 0;
  if (i < 0) { // a new point on the line where you clicked
    const p = { t: tAt(e), v: vAt(e.clientY) };
    i = pts.findIndex((q) => q.t > p.t);
    if (i < 0) i = pts.length;
    pts.splice(i, 0, p);
  }
  const p = pts[i], t0 = p.t, v0 = p.v, x0 = e.clientX, y0 = e.clientY;
  const show = () => { val.textContent = KillToyAuto.text(t, a, p.v); val.classList.add("live"); };
  show(); draw();
  svg.classList.add("dragging");
  const move = (ev) => {
    const lo = i > 0 ? pts[i - 1].t : 0, hi = i < pts.length - 1 ? pts[i + 1].t : Infinity;
    let nt = t0 + (ev.clientX - x0) / ui.pxPerSec;
    if (!ev.altKey) nt = snap(nt);
    p.t = Math.min(hi, Math.max(lo, nt));
    p.v = ev.shiftKey ? Math.min(1, Math.max(0, v0 - (ev.clientY - y0) / (H * 6))) : vAt(ev.clientY); // Shift = fine
    show(); draw();
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    svg.classList.remove("dragging");
    val.classList.remove("live");
    // a click on a point that didn't move (the first click of a double-click) is no edit
    if (!added && p.t === t0 && p.v === v0) return;
    run("setAutomation", { trackId: t.id, laneId: a.id, points: pts });
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

// While the song plays, the controls follow their lines on screen: lane faders, effect knobs
// and TOY MACHINE's macros, points and sliders (held ones show your hand instead).
let autoShown = false;
function updateAutoControls(pos) {
  if (!ui.state || !ui.state.canAutomate) return;
  const playing = !!(ui.transport && ui.transport.playing);
  if (!playing && !autoShown) return;
  autoShown = playing;
  const hosts = [...ui.state.tracks, ...(ui.state.master ? [masterTrack()] : [])];
  const synth = {};
  for (const t of hosts) {
    for (const a of t.automation || []) {
      if (!a.points || !a.points.length || autoRec.has(t.id + "|" + JSON.stringify(a.target)) || !KillToyAuto.fits(a, t)) continue;
      const v = KillToyAuto.valueAt(a, pos), tg = a.target;
      if (tg.type === "volume") {
        const fill = document.querySelector(`.row[data-track-id="${t.id}"] .vol i`);
        if (fill) fill.style.width = (playing ? v : volToFrac(t.volume || 0)) * 100 + "%";
      } else if (tg.type === "fx") {
        for (const p of KillToyAuto.plugins(t)) {
          if (!KillToyAuto.isPlugin(p, tg.pluginId)) continue;
          const q = (p.params || []).find((x) => x.id === tg.paramId);
          document.querySelectorAll(`.knob[data-plugin="${p.id}"][data-param="${CSS.escape(tg.paramId)}"]`).forEach((k) => {
            if (ui.dragging !== k) setKnob(k, playing ? v : q ? q.value : v);
          });
        }
      } else if (tg.type === "synth" && playing && tmWin) {
        const h = findPlugin(tmWin.pid);
        if (h && h.t && h.t.id === t.id) synth[tg.param] = { v, text: KillToyAuto.SYNTH[tg.param] ? KillToyAuto.SYNTH[tg.param].text(v) : null };
      }
    }
  }
  if (tmWin && tmWin.win && tmWin.win.showAutomation) tmWin.win.showAutomation(synth);
}
// TOY MACHINE's A marks follow its lane's lines (added, recorded, cleared), checked on every render
function syncTmAutoMarks() {
  if (!tmWin || !tmWin.win || !tmWin.win.autoChanged || !ui.state) return;
  const h = findPlugin(tmWin.pid), sig = h && h.t ? (h.t.automation || []).filter((l) => l.target && l.target.type === "synth").map((l) => l.target.param).sort().join("|") : "";
  if (sig !== tmWin.autoSig) { tmWin.autoSig = sig; tmWin.win.autoChanged(); }
}

// While the song plays, each lane shows its value at the marker, with a dot riding the line.
const autoH = new WeakMap();   // each line's height, re-read at most twice a second
function updateAutoReadouts(pos) {
  const rows = document.querySelectorAll(".auto-row");
  if (!rows.length || !ui.state) return;
  // Heavy songs (many lanes) went to ~10 fps here: each row read clientHeight right after the
  // row before it moved its dot, which forces a full layout per row. Read everything first,
  // then write, and only touch what changed.
  const todo = [], byId = new Map(ui.state.tracks.map((x) => [x.id, x])), now = performance.now();
  for (const row of rows) {
    const t = row.dataset.trackId === MASTER_ID ? masterTrack() : byId.get(row.dataset.trackId), a = t && (t.automation || []).find((l) => l.id === row.dataset.laneId);
    if (!a) continue;
    const svg = row.querySelector(".auto-svg");
    let H = 50;
    if (svg) { const k = autoH.get(svg); if (k && now - k.at < 500) H = k.h; else { H = svg.clientHeight || 50; autoH.set(svg, { h: H, at: now }); } }
    todo.push({ t, a, val: row.querySelector(".auto-val"), svg, dot: svg && svg.querySelector(".auto-head-dot"), H });
  }
  const x = toX(pos);
  for (const r of todo) {
    const v = KillToyAuto.valueAt(r.a, pos);
    if (r.val && !r.val.classList.contains("live")) { const txt = KillToyAuto.text(r.t, r.a, v); if (r.val.textContent !== txt) r.val.textContent = txt; }
    if (r.dot && !r.svg.classList.contains("dragging")) {
      const cy = (AUTO_PAD + (1 - v) * (r.H - 2 * AUTO_PAD)).toFixed(1), cx = String(x);
      if (r.dot.getAttribute("cx") !== cx) r.dot.setAttribute("cx", cx);
      if (r.dot.getAttribute("cy") !== cy) r.dot.setAttribute("cy", cy);
    }
  }
}

// The master's meter (after the limiter, what you hear) and how hard the limiter works.
function updateMasterMeter(m) {
  const box = document.querySelector(".row.master .mmeter");
  const lv = ui.masterMeter || (ui.masterMeter = { level: -100, peak: -100, at: 0 });
  const now = performance.now(), db = m && typeof m.peak === "number" ? m.peak : -100, gr = m && m.gr ? m.gr : 0;
  lv.level = Math.max(db, lv.level - 1.6);
  if (db >= lv.peak || now - lv.at > 1200) { lv.peak = Math.max(db, lv.level); lv.at = now; }
  const pct = (v) => Math.max(0, Math.min(1, (v + 48) / 48)) * 100;
  if (box) {
    box.querySelector(".mmeter-fill").style.height = pct(lv.level) + "%";
    const pk = box.querySelector(".mmeter-peak");
    pk.style.bottom = pct(lv.peak) + "%";
    pk.classList.toggle("hot", lv.peak > -1);
    setTitle(box, `Out ${lv.peak > -99 ? lv.peak.toFixed(1) + " dB" : "silent"}` + (gr > 0.1 ? ` \u00b7 limiter -${gr.toFixed(1)} dB` : ""));
  }
  const g = $("lim-gr"), f = $("lim-fill");
  setText(g, gr > 0.1 ? `Holding back ${gr.toFixed(1)} dB` : "Not working right now");
  if (f) f.style.width = Math.min(100, (gr / 12) * 100) + "%";
}

function sectionAt(sec) {
  const list = ui.state.sections || [];
  return list.findIndex((x) => sec >= x.start && sec < x.end);
}

// Section colours (from the redesign mock): each kind of part has its own solid colour.
const SECTION_COLORS = { INTRO: "#3fb0f0", VERSE: "#8b5cf0", PRE: "#e8b04a", HOOK: "#e0559e", CHORUS: "#e0559e", DROP: "#e0559e",
                         BRIDGE: "#ff8a5c", BREAK: "#ff8a5c", BUILD: "#e8b04a", OUTRO: "#3fd6b0" };
const sectionColor = (name) => SECTION_COLORS[String(name || "").toUpperCase().replace(/[^A-Z]/g, "")] || "#a7a4b4";

function renderSections(width) {
  const box = $("sections");
  box.replaceChildren(loopBar());
  const list = ui.state.sections || [];
  const hasBeat = !!beatClip();
  $("sec-auto").textContent = list.length ? "Re-AUTO" : "AUTO";
  $("sec-auto").title = list.length ? "Listen to the beat again and re-place every section (Cmd+Z brings the old ones back)"
                                    : "Listen to the beat and place the sections where its parts really start";
  $("sec-auto").disabled = !hasBeat;
  if (!list.length) {
    box.append(el("div", "sections-hint", hasBeat ? "No sections yet. Press AUTO, or + to add one at the marker."
                                                  : "Load a beat, then press AUTO to find its sections."));
    return;
  }

  list.forEach((sec, i) => {
    const b = el("div", "section" + (sec.name === "OFFBEAT" ? " offbeat" : ""));
    b.dataset.index = i;
    b.style.setProperty("--sc", sec.color || sectionColor(sec.name));
    b.style.left = toX(sec.start) + "px";
    b.style.width = Math.max(10, toX(sec.end - sec.start) - SEC_GAP()) + "px";
    const label = el("span", "lbl");
    label.append(el("span", "num", String(i + 1).padStart(2, "0")), document.createTextNode(sec.name));
    const bars = el("span", "bars", `B ${barAt(sec.start)}\u2013${barAt(sec.end - 0.01)}`);
    b.append(el("i", "sec-h"), label, el("span", "sec-loop", "LOOP"), bars, el("i", "sec-h"));
    b.title = sec.name === "OFFBEAT"
      ? "OFFBEAT: an extra-long gap that breaks the 8-bar pattern, kept apart so the next part starts where it really hits"
      : "Click: loop this part  \u00B7  Drag: move where it starts  \u00B7  Double-click: rename  \u00B7  Right-click: more";
    b.addEventListener("mousedown", (e) => onSectionMouseDown(e, i, b));
    b.ondblclick = (e) => { e.stopPropagation(); inlineEdit(label, sec.name, (v) => editSections((l) => (l[i].name = v))); };
    b.oncontextmenu = (e) => { e.preventDefault(); showSectionMenu(b, i); };
    box.append(b);
  });
}

// The acid loop bar over the sections: drag along it to loop any part (snaps to the beat,
// Alt: free); drag a lit range's ends to change it, click the lit range to stop looping.
function loopBar() {
  const bar = el("div", "loopbar");
  bar.title = "Click or drag: move the marker. Shift-drag: loop a part (Shift-drag its ends to change it, Shift-click it to stop). Double-click: loop what's there.";
  bar.append(el("div", "loopbar-fill"));
  bar.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    // without Shift this strip is just the marker's (Eman, 31 Oct): click or drag moves it, no loop
    if (!e.shiftKey) { startMarkerDrag(e, bar); return; }
    const s = ui.state, t = ui.transport, rect = bar.getBoundingClientRect();
    // snaps to the beat, and to section edges when close (Alt: free)
    const edges = (s.sections || []).flatMap((x) => [x.start, x.end]), near = 8 / ui.pxPerSec;
    const at = (ev) => {
      const v = toSec(ev.clientX - rect.left);
      if (ev.altKey) return v;
      for (const x of edges) if (Math.abs(v - x) < near) return x;
      return snapBeat(v);
    };
    const x0 = at(e), on = t.looping && s.loopEnd > s.loopStart, edge = 6 / ui.pxPerSec;
    let a = x0, b = x0, mode = "new";
    if (on && Math.abs(x0 - s.loopStart) < edge * 1.5) { mode = "start"; a = s.loopStart; b = s.loopEnd; }
    else if (on && Math.abs(x0 - s.loopEnd) < edge * 1.5) { mode = "end"; a = s.loopStart; b = s.loopEnd; }
    else if (on && x0 > s.loopStart && x0 < s.loopEnd) mode = "inside";
    let moved = false;
    bar.classList.add("drag");
    const show = () => { const lo = Math.min(a, b), hi = Math.max(a, b); paintLoop(lo, hi, true); };
    const move = (ev) => {
      const v = at(ev);
      if (!moved && Math.abs(ev.clientX - e.clientX) < 3) return;
      moved = true;
      if (mode === "start") a = v; else if (mode === "end") b = v; else { if (mode === "inside") { mode = "new"; a = x0; } b = v; }
      show();
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      bar.classList.remove("drag");
      if (!moved) {
        if (mode !== "new") run("setLooping", { on: false });
        else renderOverlays();
        return;
      }
      const lo = Math.min(a, b), hi = Math.max(a, b);
      if (hi - lo < secPerBeat() / 4) return renderOverlays();
      run("setLoopRange", { start: lo, end: hi });
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  });
  return bar;
}
// The lit part of the loop bar, and the dark veil over everything outside the loop.
let loopPainted = "";
function paintLoop(lo, hi, on) {
  // runs on every transport tick: read the layout once, before writing, and skip when nothing moved
  // (each tick used to force a full layout of the song, slow in big projects)
  const zone = $("loop-zone"), rows = $("rows"), inner = $("inner");
  // the layout reads force a full layout, so they're re-read at most 4 times a second
  const now = performance.now();
  if (!paintLoop.lay || now - paintLoop.lay.at > 250 || !(zone && zone.isConnected))
    paintLoop.lay = { at: now, top: rows ? rows.offsetTop : 0, sw: inner ? inner.scrollWidth : 0 };
  const top = paintLoop.lay.top, rl = rulerLeft(), sw = paintLoop.lay.sw;
  const key = [lo, hi, on, ui.pxPerSec, top, rl, sw].join("|");
  const fill = document.querySelector(".loopbar-fill");
  // (24 Nov) a redraw makes a new yellow bar: it used to be skipped here and stayed blank while the loop was still on.
  // KT2_LOOPFILL_OLD = old
  if (key === loopPainted && zone && zone.isConnected && (window.KT2_LOOPFILL_OLD || fill === paintLoop.fill)) return;
  loopPainted = key; paintLoop.fill = fill;
  if (fill) { fill.hidden = !on; fill.style.left = toX(lo) + "px"; fill.style.width = Math.max(2, toX(hi - lo)) + "px"; }
  zone.hidden = !on;
  zone.style.left = rl + toX(lo) + "px";
  zone.style.width = toX(hi - lo) + "px";
  if (rows) zone.style.top = top + "px";
  const L = $("loop-dim-l"), R = $("loop-dim-r");
  for (const d of [L, R]) if (d) { d.hidden = !on; if (rows) d.style.top = top + "px"; }
  if (on && L && R) {
    L.style.left = rl + "px"; L.style.width = toX(lo) + "px";
    R.style.left = rl + toX(hi) + "px"; R.style.width = Math.max(0, sw - rl - toX(hi)) + "px";
  }
}

// Click a section: loop it. Drag it: move where it starts (snaps to the beat; the part
// before it grows or shrinks to match).
const SEC_GAP = () => (document.documentElement.classList.contains("kt2") ? 0 : 4);   // KILLTOY 2: parts sit flush, no gap (Eman, 31 Oct)
function onSectionMouseDown(e, i, node) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const list = ui.state.sections;
  const sec = list[i];
  const minStart = i > 0 ? list[i - 1].start + secPerBeat() : 0;
  const maxStart = sec.end - secPerBeat();
  const prev = i > 0 ? document.querySelector(`.section[data-index="${i - 1}"]`) : null;
  const startX = e.clientX;
  let moved = false, start = sec.start;

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    if (!moved && Math.abs(dx) < 4) return;
    moved = true;
    node.classList.add("dragging");
    start = Math.min(maxStart, Math.max(minStart, snapBeat(sec.start + dx / ui.pxPerSec)));
    node.style.left = toX(start) + "px";
    node.style.width = Math.max(10, toX(sec.end - start) - 4) + "px";
    if (prev) prev.style.width = Math.max(10, toX(start - list[i - 1].start) - 4) + "px";
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    node.classList.remove("dragging");
    if (!moved) return loopSection(i);
    if (Math.abs(start - sec.start) > 1e-6) editSections((l) => (l[i].start = start));
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

const SECTION_NAMES = ["INTRO", "VERSE", "PRE", "HOOK", "BRIDGE", "OUTRO", "OFFBEAT"];

function showAddSection(anchor) {
  if (!beatClip()) return toast("Load a beat first.");
  const at = snapBeat(ui.transport.position);
  const list = ui.state.sections || [];
  if (list.some((x) => Math.abs(x.start - at) < 1e-3)) return toast("There's already a section starting at the marker. Move the marker first.");
  const verses = list.filter((x) => /^VERSE/.test(x.name)).length;
  showMenu(anchor, [
    { heading: `New section at bar ${fmtBars(at)}` },
    ...SECTION_NAMES.map((n) => ({
      label: n === "VERSE" ? `VERSE ${verses + 1}` : n,
      run: () => editSections((l) => l.push({ name: n === "VERSE" ? `VERSE ${verses + 1}` : n, start: at })),
    })),
  ]);
}

function autoSections() {
  if (!beatClip()) return toast("Load a beat first.");
  const had = (ui.state.sections || []).length;
  run("autoSections").then((r) => r && r.ok && toast(had ? "Listening again\u2026 (Cmd+Z brings your old sections back)" : "Listening to the beat\u2026"));
}

// The marker (playhead): click or drag on the ruler or an empty lane. It never sticks to
// sections. Leaving a looped section turns the loop off, so the marker is free again.
function moveMarker(sec, final) {
  sec = Math.max(0, sec);
  ui.transport.position = sec;
  renderTransport();
  const s = ui.state;
  if (final && ui.transport.looping && s && (sec < s.loopStart - 1e-3 || sec >= s.loopEnd)) {
    ui.transport.looping = false;
    run("setLooping", { on: false });
  }
  const now = performance.now();
  if (final || !ui.lastScrub || now - ui.lastScrub > 40) {
    ui.lastScrub = now;
    run("setPosition", { time: sec });
  }
}

// A click on the empty grid lets go of a looped PART (Eman, 24 Nov 23:00: "I pressed away on the grid ... the marker is
// still white selected around it, it shouldn't"): its loop goes off and its white outline with it.
// KT2_GRID_UNLOOP_OFF = only a click outside the loop turned it off.
function unloopPart() {
  if (window.KT2_GRID_UNLOOP_OFF || !ui.transport || !ui.transport.looping) return;
  const s = ui.state, secs = typeof sectionSpans === "function" ? sectionSpans() : (s.sections || []);
  if (!secs.some((x) => Math.abs(x.start - s.loopStart) < 0.01 && Math.abs((x.end != null ? x.end : x.start) - s.loopEnd) < 0.01)) return;
  ui.transport.looping = false;
  run("setLooping", { on: false }).then(() => renderOverlays());
}

function startMarkerDrag(e, surface) {
  hidePop();
  const rectLeft = () => surface.getBoundingClientRect().left;
  // The marker always smart-snaps to the grid you can see, Snap on or off (Eman, 31 Oct): slow = fine
  // spots, a fast throw = bars. Alt = free.
  const sp = speedMeter();
  const at = (ev) => { const sec = toSec(ev.clientX - rectLeft()); return ev.altKey ? sec : markerSnap(sec, ev.type === "mousedown" ? null : sp.v); };
  ui.scrubbing = true;
  moveMarker(at(e), false);
  const onMove = (ev) => { sp.feed(ev); moveMarker(at(ev), false); };
  const onUp = (ev) => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    ui.scrubbing = false;
    moveMarker(at(ev), true);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function editSections(mutate) {
  const list = (ui.state.sections || []).map((x) => ({ name: x.name, start: x.start, ...(x.len ? { len: x.len } : {}), ...(x.color ? { color: x.color } : {}) }));
  mutate(list);
  list.sort((a, b) => a.start - b.start);
  return run("setSections", { sections: list });
}

function loopSection(i) {
  const sec = ui.state.sections[i];
  run("setLoopRange", { start: sec.start, end: sec.end }).then((r) => {
    if (r && r.ok) toast(`Looping ${sec.name}. Press R: every pass becomes a version of the take.`);
  });
}

function recordHere(sec, role) {
  run("recordDouble", { start: sec.start, end: sec.end, role }).then((r) => {
    if (r && r.ok) toast(`Recording a ${roleOf(role).name.toLowerCase()} over ${sec.name}. Every pass is kept as a version.`);
  });
}

function splitSectionAtPlayhead() {
  const pos = snap(ui.transport.position);
  const i = sectionAt(pos);
  if (i < 0 || Math.abs(ui.state.sections[i].start - pos) < 0.05) return toast("Move the playhead inside a section to split it.");
  editSections((l) => l.push({ name: "PART", start: pos }));
}

function renderRuler(width) {
  const ruler = $("ruler");
  ruler.querySelectorAll(".tick").forEach((n) => n.remove());
  const barPx = toX(secPerBar());
  const every = [1, 2, 4, 8, 16, 32].find((k) => barPx * k >= 64) || 64;

  for (let bar = 0; bar * barPx < width; bar++) {
    if (bar % every === 0) {
      const tick = el("div", "tick");
      tick.style.left = bar * barPx + "px";
      tick.append(document.createTextNode(String(bar + 1)));
      if (barPx * every >= 96) tick.append(el("small", null, fmtTime(bar * secPerBar()).replace(/\.\d$/, "")));
      ruler.append(tick);
    } else if (barPx * every >= 120 && every <= 4) {
      const minor = el("div", "tick minor");
      minor.style.left = bar * barPx + "px";
      ruler.append(minor);
    }
  }
}

function renderClip(c, t, color) {
  const isBeat = t.kind === "beat";
  const clip = el("div", "clip" + (isSel(c.id) ? " selected" : "") + (t.muted ? " muted" : "") + (c.active === false ? " inactive" : ""));
  clip.dataset.clipId = c.id;
  clip.style.left = toX(c.start) + "px";
  clip.style.width = Math.max(4, toX(c.length)) + "px";

  const label = el("div", "clip-label");
  if (hasFolder(c)) {
    const open = ui.openTakes.has(c.id);
    const tog = el("button", "takes-toggle" + (open ? " on" : ""), open ? "\u25BE" : "\u25B8");
    tog.title = open ? "Close the folder: just the default shows" : `Show all ${takeCount(c)} versions (takes and variations)`;
    // B2 (debug 7 Nov): it opened on mousedown, so starting a drag on the little arrow opened the takes and
    // pushed every row under it down. Now it opens on a real click only. KT2_TAKES_ON_DOWN = the old way.
    tog.addEventListener("mousedown", (e) => { e.stopPropagation(); if (window.KT2_TAKES_ON_DOWN) toggleTakes(c.id); });
    tog.addEventListener("click", (e) => { e.stopPropagation(); if (!window.KT2_TAKES_ON_DOWN) toggleTakes(c.id); });
    label.append(tog);
  }
  label.append(el("span", "nm", c.name));
  if (window.KT2ClipKey && toX(c.length) > 230) { const bk = KT2ClipKey.chips(c, t); if (bk) label.append(bk); }   // BPM + key with A switches (Eman, 6 Nov 15:22)
  if (t.kind !== "beat" && document.documentElement.classList.contains("kt2")) {   // mute, right after the name (Eman, 4 Nov; M does the same)
    // a small pill with a speaker, like the loop button next to it, red when muted (Eman, 10 Nov 21:26);
    // KT2_MUTE_WORD = the MUTE word button (6 Nov), KT2_MUTE_ICON = the older bare speaker
    const pill = !window.KT2_MUTE_WORD && !window.KT2_MUTE_ICON;
    const off = c.active === false, mb = el("button", "clip-mute" + (off ? " off" : "") + (pill ? " clip-mutep" : window.KT2_MUTE_ICON ? "" : " clip-mutew"));
    // a MUTE word button, red when on (Eman, 6 Nov 03:05); KT2_MUTE_ICON = true brings back the speaker
    if (pill) mb.innerHTML = `<svg viewBox="0 0 14 9" width="13" height="8"><path d="M1.5 3.2h2.2L6.6 1v7L3.7 5.8H1.5z" fill="currentColor"/>${off ? '<path d="M9 3l3.4 3.2M12.4 3L9 6.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>' : '<path d="M8.6 2.9a2.3 2.3 0 0 1 0 3.2M10.4 1.5a4.3 4.3 0 0 1 0 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>'}</svg>`;
    else if (!window.KT2_MUTE_ICON) mb.textContent = "MUTE"; else mb.innerHTML = `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M1.5 5.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor" stroke-linejoin="round"/>${off ? '<path d="M10.5 5.5l4.5 5M15 5.5l-4.5 5" stroke-width="1.9"/>' : '<path d="M10.6 5.6a3.2 3.2 0 0 1 0 4.8M12.6 3.4a6.2 6.2 0 0 1 0 9.2"/>'}</svg>`;
    mb.title = off ? "Muted. Click (or M) to hear it again" : "Mute this clip (M)";
    mb.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
    mb.addEventListener("click", (e) => { e.stopPropagation(); run("setClipActive", { clipIds: window.KT2Compound ? KT2Compound.idsFor(c.id) : [c.id], active: off }); });
    label.append(mb);
  }
  if (c.takes > 1) {
    const comped = compOf(c).some((x) => x.take !== compOf(c)[0].take);
    const ver = el("span", "tag ver", comped ? `Comp \u00b7 ${c.takes} \u25BE` : `${c.takeInfo && c.takeInfo[c.take] ? takeName(c, c.take) : "V" + (c.take + 1)} \u00b7 ${c.take + 1}/${c.takes} \u25BE`);
    ver.title = "This clip has takes from loop recording. Click to pick one, or open the folder to comp.";
    ver.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      selectClip(c.id); // redraws the lanes, so anchor the menu on the fresh tag
      showTakeMenu(document.querySelector(`.clip[data-clip-id="${c.id}"] .ver`) || ver, c);
    });
    label.append(ver);
  }
  const effects = c.plugins.filter((p) => !p.instrument);
  if (effects.length) {
    const fx = el("span", "tag fx", "FX " + effects.length);
    fx.title = effects.map((p) => p.name).join(" \u2192 ");
    label.append(fx);
  }
  clip.append(label);

  const canvas = el("canvas");
  clip.append(canvas);
  const kdKit = c.kind === "midi" && ((c.plugins || []).find((p) => p.kit) || (isKillDrumLane(t) && {}));
  if (kdKit) { // KILLDRUM: the beat as rows of hits, one row per pad, not notes
    clip.classList.add("midi", "kdclip");
    const nm = label.querySelector(".nm"); if (nm && (!c.name || c.name === "MIDI")) nm.textContent = kdKit.kitTitle || "KILLDRUM";
    keepCanvas(canvas, c, "kd", () => drawDrumPattern(canvas, c));
    clip.title = "Double-click to open KILLDRUM";
  } else if (c.kind === "midi") {
    clip.classList.add("midi");
    // stacked synths with their own notes show in the preview too, each in its channel colour (Eman, 4 Nov 22:31)
    const layers = noteLayers(t, c);
    keepCanvas(canvas, c, "n" + color + layers.map((l) => l.color + l.muted).join(""), () => drawNotes(canvas, c, color, layers));
    clip.title = "Double-click to edit the notes";
    if (document.documentElement.classList.contains("kt2")) addClipHandles(clip, c, t);   // volume dot + fades on patterns too (Eman, 31 Oct)
  } else {
    keepCanvas(canvas, c, "w" + color + isBeat, () => drawWave(canvas, c, color, isBeat));
    addClipHandles(clip, c, t);
  }
  if (c.kind === "midi") {   // patterns stretch from either edge too, even into empty space (Eman, 31 Oct)
    for (const side of ["l", "r"]) {
      const edge = el("div", "edge " + side);
      edge.title = "Drag to make the pattern shorter or longer";
      edge.addEventListener("mousedown", (e) => trimDrag(e, c, side, clip));
      clip.append(edge);
    }
  }
  if (c.takes > 1 && compOf(c).length > 1) {
    // Where the comp switches take: a thin crossfade mark.
    for (const seg of compOf(c).slice(1)) {
      const m = el("div", "comp-cut");
      m.style.left = toX(seg.start) + "px";
      clip.append(m);
    }
  }

  clip.addEventListener("mousedown", (e) => onClipMouseDown(e, c, t, clip));
  clip.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); clipMenu(e, c, t); });
  clip.addEventListener("mousemove", (e) => {
    if (!ui.cutMode || isBeat) return;
    let g = clip.querySelector(".cut-guide");
    if (!g) { g = el("div", "cut-guide"); clip.append(g); }
    const at = cutTime(c, e.clientX - clip.getBoundingClientRect().left, e);
    g.style.left = toX(at - c.start) + "px";
    g.classList.toggle("snapped", !ui.snapOff && !e.altKey && !window.KT2_CUT_FREE);
  });
  clip.addEventListener("mouseleave", () => clip.querySelector(".cut-guide")?.remove());
  return clip;
}

// Waveforms are the real audio: one column per screen pixel, from the lowest to the
// highest sample in that slice, with the loudness (RMS) drawn brighter inside. No
// smoothing, so every transient, breath and consonant shows.
// Every render rebuilds the clips, and redrawing every clip picture (new canvases, peaks, notes)
// froze the screen for ~half a second after each drop (Eman's V2k recording, take 2: "deep fix").
// A clip whose picture didn't change gets its old, already drawn canvas back instead.
const CANVAS_KEEP = new Map();
function keepCanvas(canvas, c, what, draw) {
  let sig;
  try { sig = what + "|" + JSON.stringify(c, (k, v) => (k === "start" || k === "track" || k === "row" || k === "lane" ? undefined : v)) + "|" + document.documentElement.className.includes("light"); } catch (e) { sig = null; }
  if (sig == null) return draw();
  // all clips of one render are handled together: measure every canvas first, then swap, so the
  // page lays out once instead of once per clip
  KEEP_Q.push({ canvas, c, sig, draw, what });
  if (KEEP_Q.length === 1) queueMicrotask(flushKeep);
}
const KEEP_Q = [];
function flushKeep() {
  const list = KEEP_Q.splice(0), dpr = window.devicePixelRatio || 1;
  for (const j of list) { const r = layoutRect(j.canvas); j.W = Math.min(16384, Math.round(r.width * dpr)); j.H = Math.round(r.height * dpr); j.w = r.width; }
  const later = [];
  for (const j of list) {
    const old = CANVAS_KEEP.get(j.c.id);
    if (j.w && old && old.sig === j.sig && old.el !== j.canvas && !old.el.isConnected && old.el.width === j.W && old.el.height === j.H && j.canvas.isConnected) {
      old.el.className = j.canvas.className; old.el.style.cssText = j.canvas.style.cssText;
      j.canvas.replaceWith(old.el);
      clipImgBack(old.el);
      continue;
    }
    CANVAS_KEEP.set(j.c.id, { sig: j.sig, el: j.canvas });
    later.push(j);
  }
  while (CANVAS_KEEP.size > 600) CANVAS_KEEP.delete(CANVAS_KEEP.keys().next().value);
  for (const j of later) { const r = j.draw(); if (/^(n|kd)/.test(j.what) && !(r && r.then)) clipImg(j.canvas); }
}

// Speed pass round 3 (27 Nov): every pattern picture was a canvas, and the browser keeps each canvas as its own
// graphics layer: 100 patterns = 140 layers to sort and send on every frame while playing or dragging. Once a
// MIDI / KILLDRUM pattern's picture is drawn, an image of the same pixels is laid over it and the canvas is hidden
// (it stays in place, so everything that measures or reads it still works). Measured while playing with 100
// patterns: 142 -> 22 layers, about 390 ms less frame work per 3 s. Drags that squash the picture (volume) show
// the live canvas again. Same look: the image gets the canvas's classes and every ".clip ... canvas" style rule
// is copied for it. KT2_CLIPIMG_OLD = canvases only, like before.
const CLIPIMG_Q = [];
let clipImgCss = -1;
function clipImgStyles() {
  // copy the clip canvas style rules for the image twin (once per new style sheet)
  const sheets = [...document.styleSheets];
  if (sheets.length === clipImgCss) return;
  clipImgCss = sheets.length;
  const walk = (list, sheet) => {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.cssRules && !r.selectorText) { walk(r.cssRules, sheet); continue; }
      if (!r.selectorText || r.ktImg || !/\bcanvas\b/.test(r.selectorText) || !/\.clip\b/.test(r.selectorText)) continue;
      r.ktImg = 1;
      const sel = r.selectorText.split(",").filter((x) => /\.clip\b/.test(x) && /\bcanvas\b/.test(x)).map((x) => x.replace(/\bcanvas\b/g, "img.kimg")).join(",");
      if (!sel) continue;
      try { const owner = r.parentRule || sheet; owner.insertRule(sel + "{" + r.style.cssText + "}", i + 1); const nr = list[i + 1]; if (nr) nr.ktImg = 1; i++; } catch (e) { /* a rule the browser won't take back */ }
    }
  };
  for (const sh of sheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } if (rules) walk(rules, sh); }
}
function clipImg(cv) {
  if (window.KT2_CLIPIMG_OLD || !cv || !cv.toBlob || !cv.width || !cv.height) return;
  cv.ktImgGen = (cv.ktImgGen || 0) + 1;
  clipImgDrop(cv);
  CLIPIMG_Q.push([cv, cv.ktImgGen]);
  if (CLIPIMG_Q.length === 1) (window.requestIdleCallback || setTimeout)(clipImgRun, { timeout: 600 });
}
function clipImgRun() {
  clipImgStyles();
  for (const [cv, gen] of CLIPIMG_Q.splice(0)) {
    if (!cv.isConnected || cv.ktImgGen !== gen) continue;
    cv.toBlob((b) => {
      if (!b || !cv.isConnected || cv.ktImgGen !== gen) return;
      const im = new Image(), url = URL.createObjectURL(b);
      im.className = cv.className ? cv.className + " kimg" : "kimg";
      im.alt = ""; im.draggable = false; im.src = url;
      im.decode().then(() => {
        URL.revokeObjectURL(url);
        if (!cv.isConnected || cv.ktImgGen !== gen) return;
        im.style.cssText = cv.style.cssText; im.style.pointerEvents = "none";
        cv.after(im); cv.ktImg = im; cv.style.visibility = "hidden";
      }).catch(() => URL.revokeObjectURL(url));
    });
  }
}
// the image off again, the canvas shows (a drag that changes the picture live, or a redraw)
function clipImgDrop(cv) {
  if (!cv || !cv.ktImg) return;
  cv.ktImg.remove(); cv.ktImg = null; cv.style.visibility = "";
}
window.clipLive = (cv) => { if (cv) { cv.ktImgGen = (cv.ktImgGen || 0) + 1; clipImgDrop(cv); } };
// a kept canvas went back into a new clip box: its image goes with it
function clipImgBack(cv) {
  if (!cv.ktImg) return;
  if (window.KT2_CLIPIMG_OLD) return clipImgDrop(cv);
  cv.after(cv.ktImg); cv.ktImg.style.cssText = cv.style.cssText; cv.ktImg.style.pointerEvents = "none"; cv.style.visibility = "hidden";
}

// A canvas's size on the page without an animation's squash: the copy pop scales a new clip's height for 150 ms,
// and a waveform measured then was drawn squashed / blank until the next redraw (Eman, 11 Nov 02:47: "the
// waveform doesn't show until I click away"). Unscaled it's the normal box. KT2_WAVE_RECT_OLD = always the box.
function layoutRect(el) {
  const r = el.getBoundingClientRect();
  if (window.KT2_WAVE_RECT_OLD || !el.offsetWidth || (Math.abs(r.width - el.offsetWidth) < 1 && Math.abs(r.height - el.offsetHeight) < 1)) return r;
  return { left: r.left, top: r.top, width: el.offsetWidth, height: el.offsetHeight };
}

async function drawWave(canvas, c, color, isBeat, take) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(4, toX(c.length));
  const buckets = Math.round(Math.min(8192, Math.max(16, cssW * dpr)));
  const key = `${c.id}:${c.offset.toFixed(3)}:${c.length.toFixed(3)}:${c.reversed ? "rev:" : ""}${c.rhythm ? c.src + ":" : ""}` + (take != null ? "take" + take : c.take + JSON.stringify(c.comp || null));

  // One fetch per clip, kept for zooming out (the drawing below takes the real min/max
  // over each pixel). Only zooming in past what's loaded asks for more detail.
  let data = ui.peaks.get(key);
  if (!data || data.max.length < buckets * 0.9) {
    data = await booth("getPeaks", take != null ? { clipId: c.id, buckets, take } : { clipId: c.id, buckets });
    if (!data || !data.peak) return;
    if (!data.max) { data.max = data.peak; data.min = data.peak.map((v) => -v); }
    ui.peaks.set(key, data);
  }

  requestAnimationFrame(() => {
    const rect = layoutRect(canvas);
    if (!rect.width) return;
    const W = Math.min(16384, Math.round(rect.width * dpr));
    const H = Math.round(rect.height * dpr);
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");

    const top = (take != null ? 4 : 18) * dpr; // room for the label
    const mid = Math.round(top + (H - top) / 2) + 0.5;
    const half = (H - top) / 2 - 2 * dpr;
    if (isBeat) color = cssVar("--beat") || color;

    // Loudest point fills the lane, so quiet takes still read (never more than 4x).
    let loud = 0.02;
    for (let i = 0; i < data.max.length; i++) loud = Math.max(loud, data.max[i], -data.min[i]);
    // The clip's own volume scales the picture (its gain line).
    const gain = Math.min(0.96 / loud, 4) * half * (take != null ? 1 : dbToLin(c.gain || 0));

    const n = data.max.length;
    g.fillStyle = hexA(color, 0.18);
    g.fillRect(0, mid - 0.5, W, Math.max(1, dpr * 0.5));

    // On the light look the loud core goes darker instead of lighter, so it still reads.
    const light = document.body.classList.contains("look-light");
    const outline = hexA(color, light ? 0.9 : isBeat ? 0.55 : 0.75);
    const body = light ? mixWhite(color, -0.45) : mixWhite(color, isBeat ? 0.15 : 0.35);
    for (let x = 0; x < W; x++) {
      const i0 = Math.floor((x * n) / W), i1 = Math.max(i0 + 1, Math.floor(((x + 1) * n) / W));
      let lo = 0, hi = 0, r = 0;
      for (let i = i0; i < i1 && i < n; i++) {
        if (data.min[i] < lo) lo = data.min[i];
        if (data.max[i] > hi) hi = data.max[i];
        if (data.rms[i] > r) r = data.rms[i];
      }
      const y0 = mid - hi * gain, y1 = mid - lo * gain;
      g.fillStyle = outline;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
      if (r > 0.001) {
        const rr = Math.min(r * gain, (y1 - y0) / 2);
        g.fillStyle = body;
        g.fillRect(x, mid - rr, 1, Math.max(1, rr * 2));
      }
    }
  });
}

// ---------------------------------------------------------------------------
// On an audio clip: fades (drag the little squares at the top corners), trim (drag the
// left or right edge) and, on the selected clip, the FL-style volume line.
function addClipHandles(node, c, t) {
  const isBeat = t.kind === "beat";
  const fin = c.fadeIn || 0, fout = c.fadeOut || 0;
  const w = Math.max(4, toX(c.length));
  if (fin > 0 || fout > 0) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "fades");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("viewBox", `0 0 ${w} 100`);
    const a = toX(fin), b = w - toX(fout);
    const shade = (d) => { const pth = document.createElementNS("http://www.w3.org/2000/svg", "path"); pth.setAttribute("d", d); svg.append(pth); };
    if (fin > 0) shade(`M0 0 L${a} 0 L0 100 Z`);
    if (fout > 0) shade(`M${b} 0 L${w} 0 L${w} 100 Z`);
    node.append(svg);
  }
  for (const side of ["in", "out"]) {
    const h = el("div", "fade-h " + side);
    h.title = side === "in" ? "Drag to fade in" : "Drag to fade out";
    h.style.left = (side === "in" ? toX(fin) : w - toX(fout)) + "px";
    h.addEventListener("mousedown", (e) => fadeDrag(e, c, side, node));
    h.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setClipFades", { clipId: c.id, fadeIn: side === "in" ? 0 : fin, fadeOut: side === "out" ? 0 : fout }); });
    node.append(h);
  }
  if (!isBeat && c.kind !== "midi") {   // patterns have their own stretch edges
    for (const side of ["l", "r"]) {
      const edge = el("div", "edge " + side);
      edge.title = "Drag to make the clip shorter or longer";
      edge.addEventListener("mousedown", (e) => trimDrag(e, c, side, node));
      node.append(edge);
    }
  }
  if (c.id === ui.selectedClip && !ui.extraClips.size) {
    const db = c.gain || 0;
    const line = el("div", "gain-line");
    line.style.top = (1 - gainToFrac(db)) * 100 + "%";
    const tag = el("span", "gain-tag", fmtDb(db));
    line.append(tag);
    line.title = "Drag up or down for this clip's volume. Double-click for 0 dB.";
    // At 0 dB the line sits across the middle of the clip, right where a double-click opens Tune
    // (the first click of it selected the clip and drew the line), so a double-click there still does.
    line.addEventListener("mousedown", (e) => (e.detail === 2 && !db ? onClipMouseDown(e, c, t, node) : gainDrag(e, c, node, line, tag)));
    line.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setClipGain", { clipId: c.id, db: 0 }); });
    node.append(line);
  }
}

// A drag that sends live updates (at most every 50 ms) and a final one on release.
// Only the first one starts an undo step; the rest carry `drag: true`.
function liveDrag(e, onMove, onEnd) {
  e.preventDefault();
  e.stopPropagation();
  hidePop();
  let first = true, last = 0, pending = null, timer = 0;
  const send = (fn) => { fn(first); first = false; last = Date.now(); };
  const move = (ev) => {
    const fn = onMove(ev);
    if (!fn) return;
    clearTimeout(timer);
    const wait = 50 - (Date.now() - last);
    if (wait <= 0) send(fn); else { pending = fn; timer = setTimeout(() => { send(pending); pending = null; }, wait); }
  };
  const up = (ev) => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    clearTimeout(timer);
    onEnd(ev, first, pending);
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

function gainDrag(e, c, node, line, tag) {
  if (e.button !== 0) return;
  const canvas = node.querySelector("canvas");
  window.clipLive(canvas);   // the picture squashes live while dragging
  const h = node.getBoundingClientRect().height, y0 = e.clientY, f0 = gainToFrac(c.gain || 0), lin0 = dbToLin(c.gain || 0) || 1e-3;
  let db = c.gain || 0;
  node.classList.add("gain-drag");
  liveDrag(e, (ev) => {
    const f = Math.min(1, Math.max(0, f0 + (y0 - ev.clientY) / h * (ev.altKey ? 0.25 : 1)));
    db = Math.round(fracToGain(f) * 10) / 10;
    line.style.top = (1 - gainToFrac(db)) * 100 + "%";
    tag.textContent = fmtDb(db);
    if (canvas) canvas.style.transform = `scaleY(${dbToLin(db) / lin0})`;
    return (first) => run("setClipGain", { clipId: c.id, db, drag: !first });
  }, (ev, none) => {
    node.classList.remove("gain-drag");
    if (!none) run("setClipGain", { clipId: c.id, db, drag: true });
    ui.laneSig = ""; render();
  });
}

function fadeDrag(e, c, side, node) {
  if (e.button !== 0) return;
  const x0 = e.clientX, v0 = side === "in" ? c.fadeIn || 0 : c.fadeOut || 0;
  let v = v0;
  liveDrag(e, (ev) => {
    const d = (ev.clientX - x0) / ui.pxPerSec * (side === "in" ? 1 : -1);
    const other = side === "in" ? c.fadeOut || 0 : c.fadeIn || 0;
    v = Math.max(0, Math.min(c.length - other, v0 + d));
    const h = node.querySelector(".fade-h." + side);
    h.style.left = (side === "in" ? toX(v) : Math.max(4, toX(c.length)) - toX(v)) + "px";
    return null; // fades are sent once, on release
  }, () => {
    if (Math.abs(v - v0) < 1e-4) return;
    run("setClipFades", { clipId: c.id, fadeIn: side === "in" ? v : c.fadeIn || 0, fadeOut: side === "out" ? v : c.fadeOut || 0 });
  });
}

function trimDrag(e, c, side, node) {
  if (e.button !== 0) return;
  const x0 = e.clientX, end = c.start + c.length;
  // never shorter than one step of the grid you see while snapping (robot users, 8 Nov: a right edge pulled
  // past the left one left a 1 px sliver you can't grab). Alt / snap off = 50 ms. KT2_TRIM_MIN_OLD = always 50 ms.
  const gridMin = () => {
    if (window.KT2_TRIM_MIN_OLD || ui.snapOff || deepZoom()) return 0.05;
    const beat = secPerBeat(), bar = beat * 4, gs = [beat / 4, beat / 2, beat, bar / 2, bar, bar * 2, bar * 4];
    return Math.min(c.length, gs.find((x) => x * ui.pxPerSec >= 24) || gs[gs.length - 1]);
  };
  let start = c.start, length = c.length, jS = start, jL = length;
  // FIRST SOUND snap (Eman, 10 Nov 23:36): with SNAP on, the left edge of an audio clip snaps to where the
  // sound starts (the first sound in the file, and any start after half a second of quiet), ahead of the grid. So a
  // quiet bit the silence cutter left in front on purpose goes with one drag. Alt = free.
  // KT2_TRIM_SOUND_OFF = the old trim (grid only).
  let sounds = [];
  if (side === "l" && c.kind !== "midi" && !window.KT2_TRIM_SOUND_OFF && !ui.snapOff)
    Promise.resolve(booth("soundStarts", { clipId: c.id })).then((r) => { if (r && Array.isArray(r.starts)) sounds = r.starts; }).catch(() => {});
  const soundAt = (raw, gridAt) => {
    if (!sounds.length) return null;
    const beat = secPerBeat(), grids = [beat / 4, beat / 2, beat, beat * 2, beat * 4, beat * 8, beat * 16];
    const gpx = deepZoom() ? 0 : (grids.find((x) => x * ui.pxPerSec >= 24) || grids[grids.length - 1]) * ui.pxPerSec;
    const reach = Math.max(18, Math.min(60, gpx * 0.5)) / ui.pxPerSec;   // a magnet that wins over the grid near the sound
    let best = null;
    for (const t of sounds) {
      const d = Math.abs(raw - t);
      if (d <= reach && (best == null || d < Math.abs(raw - best))) best = t;
    }
    // the grid spot you'd land on is closer to the hand than the sound: keep the grid (unless the grid sits in the quiet right before it)
    if (best != null && gridAt != null && Math.abs(raw - gridAt) < Math.abs(raw - best) * 0.35 && gridAt > best) return null;
    return best;
  };
  // pin the drawings (notes, waveform, name) to their pixel size so they don't stretch while dragging;
  // the clip is redrawn properly on release (Eman, 31 Oct)
  const pins = [...node.querySelectorAll("canvas")].map((cv) => {
    const w = cv.getBoundingClientRect().width;
    cv.style.width = w + "px"; cv.style.maxWidth = "none"; cv.style.flex = "none";
    return cv;
  });
  if (pins.length) node.style.overflow = "hidden";
  liveDrag(e, (ev) => {
    let at = (side === "l" ? c.start : end) + (ev.clientX - x0) / ui.pxPerSec;
    const raw = at;
    if (!ev.altKey) at = snapGrid(at);
    const snd = side === "l" && !ev.altKey && !ui.snapOff ? soundAt(raw, at) : null;
    if (snd != null) at = snd;
    node.classList.toggle("k2-snd-snap", snd != null);
    // a MIDI clip / pattern stretches either way, even into empty space; audio can't start before its file
    const floor = c.kind === "midi" ? 0 : Math.max(0, c.start - (c.offset || 0));
    const min = ev.altKey ? 0.05 : Math.max(0.05, gridMin());
    if (side === "l") { start = Math.min(end - min, Math.max(floor, at)); length = end - start; }
    else length = Math.max(min, at - c.start);
    // 4-BAR MAGNET on a pattern's right edge (Eman, 16 Nov), see K.snap4 in kt2.js; KT2_PAT_SNAP4_OLD = old
    if (side !== "l" && c.kind === "midi" && window.KT2 && KT2.snap4) {
      const m4 = KT2.snap4(raw - c.start, ev);
      if (m4 != null) length = Math.max(min, m4);
      KT2.snap4Feel(node, m4 != null, length);
    }
    if (window.KT2Juice && (Math.abs(start - jS) > 1e-6 || Math.abs(length - jL) > 1e-6)) { KT2Juice.step(c.kind === "midi" ? "len" : "trim", Math.sign((start + length) - (jS + jL)) || -1); jS = start; jL = length; }
    node.style.left = toX(start) + "px";
    node.style.width = Math.max(4, toX(length)) + "px";
    if (side === "l") for (const cv of pins) cv.style.marginLeft = toX(c.start - start) + "px";
    // zoomed far in, show how much the edge moved, in ms (Eman, 6 Nov 22:58)
    if (deepZoom()) {
      let tg = node.querySelector(":scope > .k2-trim-ms");
      if (!tg) { tg = el("div", "k2-trim-ms"); node.append(tg); }
      const d = side === "l" ? start - c.start : length - c.length, msv = Math.round(Math.abs(d) * 10000) / 10;
      tg.textContent = (side === "l" ? (d > 0 ? "CUT " : "ADD ") : (d < 0 ? "CUT " : "ADD ")) + msv + " MS";
      tg.style.left = side === "l" ? "4px" : ""; tg.style.right = side === "l" ? "" : "4px";
    }
    return null;
  }, () => {
    node.classList.remove("k2-snd-snap", "k2-snap4", "k2-snap4-hit"); node._k2s4 = 0;
    if (Math.abs(start - c.start) < 1e-4 && Math.abs(length - c.length) < 1e-4) {
      for (const cv of pins) { cv.style.width = cv.style.maxWidth = cv.style.flex = cv.style.marginLeft = ""; }
      node.style.overflow = "";
      return;
    }
    run("setClipBounds", { clipId: c.id, start, length });
  });
}

// Right-click menus, at the mouse.
const atMouse = (e) => ({ getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) });

function clipMenu(e, c, t) {
  if (!isSel(c.id)) selectClip(c.id);
  const ids = selectedIds(), many = ids.length > 1, audio = c.kind !== "midi";
  const isBeat = t.kind === "beat";
  showMenu(atMouse(e), [
    { heading: many ? `${ids.length} CLIPS` : c.name.toUpperCase() },
    ...(window.kt2UniqueItems ? window.kt2UniqueItems(c, t, many) : []),   // Make unique, first (KILLTOY 2, Eman 4 Nov)
    ...(!many && !isBeat ? [{ label: "Rename", run: () => {
      const n = document.querySelector(`.clip[data-clip-id="${c.id}"] .nm`);
      if (n) inlineEdit(n, c.name, (v) => run("renameClip", { clipId: c.id, name: v }));
    } }] : []),
    ...(!isBeat ? [{ label: "Duplicate", meta: "Cmd+D", run: () => duplicateSelected() }] : []),
    ...(window.KT2 && KT2.colorRow && !isBeat ? [KT2.colorRow(c, t)] : []),   // colour row (KILLTOY 2)
    ...(!many && !isBeat ? [{ label: "Split at the marker", meta: "S", run: () => splitAtPlayhead() }] : []),
    ...(!many && audio && t.kind === "take" ? [{ label: "Tune\u2026", meta: "double-click", run: () => openTune(findClip(c.id)) }] : []),
    ...(!many ? [{ sep: true }, ...variationItems({ clip: c })] : []),
    ...(!many && audio ? [
      { sep: true },
      { label: "Volume back to 0 dB", meta: fmtDb(c.gain || 0), run: () => run("setClipGain", { clipId: c.id, db: 0 }) },
      ...(c.fadeIn || c.fadeOut ? [{ label: "Remove fades", run: () => run("setClipFades", { clipId: c.id, fadeIn: 0, fadeOut: 0 }) }] : []),
    ] : []),
    ...(window.KillToyArrange ? KillToyArrange.clipItems(c, t, ids) : []),   // Deactivate, Reverse, Join (ui/arrange.js)
    // Convert to MIDI (ui/convert.js), on engines that have it
    ...(!many && audio && ui.state.canConvert && window.killtoyConvert ? [{ sep: true }, ...window.killtoyConvert.menuItems(c, run, toast, openConverted, ui.state.key)] : []),
    ...(!isBeat ? [{ sep: true }, { label: many ? `Delete ${ids.length} clips` : "Delete", meta: "\u232b", danger: true, run: () => deleteSelected() }] : []),
  ]);
}

// After "Make into MIDI" / "Clone the sound": TOY MACHINE opens on the new lane (the first one).
function openConverted(r) {
  if (!r || !r.pluginId) return;
  let tries = 0;
  const go = () => {
    const hit = findPlugin(r.pluginId);
    if (hit) openPluginWindow(hit.p);
    else if (++tries < 20) setTimeout(go, 50);   // the new lane shows up with the next state
  };
  go();
}

function laneMenu(e, t) {
  if (ui.selectedTrack !== t.id) selectTrack(t.id);
  const isBeat = t.kind === "beat", isInst = t.kind === "inst";
  const row = document.querySelector(`.row[data-track-id="${t.id}"]`);
  showMenu(atMouse(e), [
    { heading: (isBeat ? "Reference" : t.name).toUpperCase() },
    ...(!isBeat ? [{ label: "Rename", run: () => { const n = row && row.querySelector(".head-name"); if (n) inlineEdit(n, t.name, (v) => run("renameTrack", { trackId: t.id, name: v })); } }] : []),
    ...(!isBeat && t.clips.length && window.killtoyLibrary && window.killtoyLibrary.canSwap(t) ? [{ label: "Change sample\u2026", meta: t.sub && t.libType ? t.sub : "", run: () => window.killtoyLibrary.openForLane(t) }] : []),
    ...(!isBeat && !isInst ? [{ label: "What it's for\u2026", meta: roleOf(t.role).name, run: () => showRoleMenu(row.querySelector(".dot-btn"), t) }] : []),
    ...(isInst ? [{ label: "Instrument\u2026", meta: t.instrument || "", run: () => showInstrumentMenu(row.querySelector(".dot-btn"), t) }] : []),
    ...(isInst && /toy machine/i.test(t.instrument || "") ? [{ label: "Open TOY MACHINE", run: () => { const p = t.clips.flatMap((c) => c.plugins).find((x) => x.instrument); if (p) openPluginWindow(p); } }] : []),
    ...(!isBeat ? [{ label: "Colour\u2026", color: colorOf(t), run: () => showColorMenu(row.querySelector(".dot-btn"), t) }] : []),
    ...(!isBeat ? [{ label: t.armed ? "Recording here" : "Record here", on: t.armed, run: () => run("armTrack", { trackId: t.id }) }] : []),
    { label: t.muted ? "Unmute" : "Mute", run: () => run("toggleMute", { trackId: t.id }) },
    { label: t.solo ? "Unsolo" : "Solo", run: () => run("toggleSolo", { trackId: t.id }) },
    { label: "Volume back to 0 dB", meta: fmtDb(t.volume || 0), run: () => run("setTrackVolume", { trackId: t.id, db: 0 }) },
    ...(!isBeat && fxBarNew() && !window.KT2_BUS_OFF && ui.state.returns ? folderItems(t) : []),
    ...(!isBeat && ui.state.canAutomate ? [{ label: "Automate\u2026", meta: (t.automation || []).length ? String(t.automation.length) : "", run: () => showAutomateMenu(row.querySelector(".auto-btn") || row, t) }] : []),
    ...(t.clips.length ? [{ sep: true }, ...variationItems({ track: t })] : []),
    ...(!isBeat ? [{ sep: true }, { label: "Delete lane", danger: true, run: () => run("deleteTrack", { trackId: t.id }) }] : []),
  ]);
}

// FOLDERS (Eman's list, 11 Nov): a folder is a GROUP bus. On RECORD its lanes fold into one row with the
// group's fader and mute; "Put in a folder" makes a new GROUP with this lane in it, or moves it into one.
function folderItems(t) {
  const groups = ui.state.returns.filter((r) => r.mode === "group");
  const k = (r) => r.id.slice(6), inG = groups.find((r) => t.sends && t.sends[k(r)] > 0);
  return [{ sep: true },
    { label: "Put in a new folder", run: () => run("newBus", { mode: "group", name: (t.name.split(/\s+/)[0] || "FOLDER").toUpperCase() + "S" }).then((r) => r && r.id && run("setBusMember", { trackId: t.id, id: r.id, on: true })) },
    ...groups.filter((r) => r !== inG).map((r) => ({ label: "Into " + r.name, run: () => run("setBusMember", { trackId: t.id, id: r.id, on: true }) })),
    ...(inG ? [{ label: "Out of " + inG.name, run: () => run("setBusMember", { trackId: t.id, id: inG.id, on: false }) }] : [])];
}

// How far a block of picked clips moves when duplicated (Eman, 11 Nov). Starts evenly spaced (4 kicks a beat apart,
// 2 long clips with a gap between) keep that rhythm going: the first copy comes one step after the last clip, so
// every gap is the same (it used to be rounded up to the next bar, and long clips got an odd gap). Clips that all
// start together: right after the longest. Uneven starts: the next whole bar. KT2_DUP_STEP_OLD = always the next bar.
function dupShift(list) {
  const lo = Math.min(...list.map((c) => c.start)), hi = Math.max(...list.map((c) => c.start + c.length)), span = hi - lo, bar = secPerBar();
  const barUp = Math.max(1, Math.ceil(span / bar - 1e-6)) * bar;
  if (window.KT2_DUP_STEP_OLD) return barUp;
  const starts = [...new Set(list.map((c) => Math.round(c.start * 1e6) / 1e6))].sort((a, b) => a - b);
  if (starts.length < 2) return span;
  const steps = starts.slice(1).map((x, i) => x - starts[i]), step = steps[0];
  if (step > 1e-6 && steps.every((d) => Math.abs(d - step) <= Math.max(1e-4, step * 0.01))) return Math.max(starts.length, Math.ceil(span / step - 1e-6)) * step;
  return barUp;
}

function duplicateSelected() {
  const ids = selectedIds().filter((id) => { const c = findClip(id); return c && c.track.kind !== "beat"; });
  if (!ids.length) return toast("Select a clip first.");
  // Several clips picked (Eman's V7k take 2, 11 Nov): the copies keep the same pattern and spacing and go after the
  // whole selection, on the next bar (4 kicks in bar 1 -> the same 4 kicks in bar 2), instead of each copy landing
  // right after its own clip (on top of the next one). One clip: still right after itself, no gap.
  // window.KT2_DUP_GROUP_OLD = true: the old way (each copy right after its own clip).
  const list = ids.map(findClip).filter(Boolean);
  const asGroup = list.length > 1 && !window.KT2_DUP_GROUP_OLD;
  const shift = dupShift(list);
  const hold = asGroup && window.KT2Juice && KT2Juice.holdCopies;   // the copies pop in where they end up, not first at the old spot
  if (hold) KT2Juice.holdCopies();
  run("duplicateClips", { clipIds: ids }).then(async (r) => {
    if (!r || !r.clipIds || !r.clipIds.length) return;
    if (asGroup && r.clipIds.length === list.length) {
      const free = window.KT2 && KT2.freeRows && KT2.freeRows();
      // which original each copy came from: same lane, same length, starting where the original ends
      const left = list.slice();
      const moves = r.clipIds.map((id) => {
        const k = findClip(id); if (!k) return null;
        const i = left.findIndex((o) => o.track.id === k.track.id && Math.abs(o.length - k.length) < 1e-6 && Math.abs(o.start + o.length - k.start) < 1e-6);
        if (i < 0) return null;
        const o = left.splice(i, 1)[0];
        return { clipId: id, start: o.start + shift, ...(free ? { row: k.row || o.row || o.track.id } : { trackId: o.track.id }) };
      });
      if (moves.every(Boolean)) await (free ? run("setClipRow", { moves, drag: true }) : run("moveClips", { moves, drag: true }));
    }
    ui.selectedClip = r.clipIds[0];
    ui.extraClips = new Set(r.clipIds.slice(1));
    ui.laneSig = ""; render();
    if (hold) KT2Juice.popCopies(r.clipIds);
  });
}

function deleteSelected() {
  const ids = selectedIds().filter((id) => { const c = findClip(id); return c && c.track.kind !== "beat"; });
  if (!ids.length) return;
  ui.extraClips.clear();
  run("deleteClip", ids.length > 1 ? { clipIds: ids } : { clipId: ids[0] });
}

// The lane's volume: a slim fader under the lane name. Double-click for 0 dB.
function laneFader(t) {
  const f = el("div", "vol");
  const fill = el("i");
  const db = t.volume || 0;
  fill.style.width = volToFrac(db) * 100 + "%";
  f.append(fill);
  f.title = `Lane volume ${fmtDb(db)}. Drag, or double-click for 0 dB.`;
  f.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setTrackVolume", { trackId: t.id, db: 0 }); });
  if (t.kind !== "beat" && t.kind !== "return" && ui.state && ui.state.canAutomate) {
    f.title += " Right-click to automate.";
    f.addEventListener("contextmenu", (e) => {
      e.preventDefault(); e.stopPropagation();
      automateItemMenu(atMouse(e), t, { type: "volume" }, "Volume", volToFrac(t.volume || 0));
    });
  }
  f.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const r = f.getBoundingClientRect();
    const sub = f.parentElement.querySelector(".head-sub"), was = sub ? sub.textContent : "";
    let v = db;
    const at = (ev) => {
      v = Math.round(fracToVol(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width))) * 10) / 10;
      fill.style.width = volToFrac(v) * 100 + "%";
      if (t.kind !== "beat") autoTouch(t, { type: "volume" }, volToFrac(v), "Volume");
      if (sub) sub.textContent = "Volume " + fmtDb(v);
    };
    at(e);
    let firstSent = false;
    run("setTrackVolume", { trackId: t.id, db: v }); firstSent = true;
    liveDrag(e, (ev) => { at(ev); return (first) => run("setTrackVolume", { trackId: t.id, db: v, drag: firstSent || !first }); },
      (ev, none) => { if (!none) run("setTrackVolume", { trackId: t.id, db: v, drag: true }); if (t.kind !== "beat") autoTouch(t, { type: "volume" }, volToFrac(v), "Volume", true); if (sub) sub.textContent = was; ui.laneSig = ""; render(); });
  });
  return f;
}

// A MIDI clip's notes in a few numbers, so the lane redraws when its notes change (a KILLDRUM roll, the piano roll)
function notesSig(c) {
  let h = (c.notes || []).length;
  for (const n of c.notes || []) h = (h * 31 + n.pitch * 7 + Math.round(n.start * 96) + Math.round((n.chance == null ? 1 : n.chance) * 4)) % 1000000007;
  // the stacked synths' own notes show in the preview too, so they count
  for (const [id, ns] of Object.entries(c.stack || {})) { h = (h * 17 + id.length + ns.length) % 1000000007; for (const n of ns) h = (h * 31 + n.pitch * 7 + Math.round(n.start * 96) + Math.round(n.length * 48)) % 1000000007; }
  const k = (c.plugins || []).find((p) => p.kit);
  return [h, k ? k.kitTitle || "" : ""];
}
// A KILLDRUM clip in the lane: one row per pad that plays (kick on top), each hit a round dot in
// the pad's colour (as in KILLDRUM's BEAT tab), fainter when it only plays sometimes. No lengths:
// a drum is a hit (Eman, 6 Nov). window.KT2_DRUM_BARS = true brings back the old little bars.
const KD_ROWS = [[36, "#E4FF3A"], [35, "#C6E03A"], [38, "#F2F2F4"], [39, "#D8CCFF"], [42, "#A78BFA"], [46, "#8B5CF6"], [37, "#C4B5FD"], [49, "#8A7FB8"], [51, "#6F7380"]];
// where each hit's dot sits; kt2-juice.js uses the same numbers so the lit dot lands on the drawn one
// where the notes start under the clip's 17px title: a 6px gap so the top notes never touch it, even
// on short rows (Eman, 10 Nov 22:56). KT2_NOTE_GAP_OLD = the old 3px.
function patTop(dpr) { return (window.KT2_NOTE_GAP_OLD ? 20 : 23) * dpr; }
function drumLayout(c, W, H, dpr) {
  const notes = c.notes || [];
  const rows = KD_ROWS.filter(([p]) => notes.some((n) => n.pitch === p));
  const top = patTop(dpr), bottom = H - 5 * dpr, rowH = (bottom - top) / Math.max(1, rows.length);
  const ppb = W / Math.max(0.25, c.beats || 16), stepW = ppb / 4;
  const r = Math.max(1.2 * dpr, Math.min(rowH * 0.36, stepW * 0.42, 4.5 * dpr));
  const at = (n) => {
    const i = rows.findIndex(([p]) => p === n.pitch);
    return i < 0 ? null : { x: n.start * ppb + Math.min(r + dpr * 0.5, stepW / 2), y: top + (i + 0.5) * rowH, col: rows[i][1] };
  };
  return { rows, top, bottom, rowH, ppb, stepW, r, at };
}
function drawDrumPattern(canvas, c) {
  requestAnimationFrame(() => {
    const dpr = window.devicePixelRatio || 1, rect = layoutRect(canvas);
    if (!rect.width) return;
    const W = Math.min(16384, Math.round(rect.width * dpr)), H = Math.round(rect.height * dpr);
    canvas.width = W; canvas.height = H; canvas.ktDpr = dpr;   // kt2-juice.js lays its play light out with the same ratio
    const g = canvas.getContext("2d"), notes = c.notes || [];
    const L = drumLayout(c, W, H, dpr), rows = L.rows, top = L.top, bottom = L.bottom;
    if (!rows.length && !window.KT2_CLIPADD_BUTTON && canvas.closest && canvas.closest(".k2p-noinst")) return;   // the + LOAD BEAT pill says it (kt2-picker.js)
    const full = !!(canvas.closest && canvas.closest(".k2-full"));   // full-colour pattern: dark hits on the colour
    if (!rows.length) { g.fillStyle = full ? "rgba(0,0,0,0.5)" : "rgba(236,236,238,0.45)"; g.font = `${11 * dpr}px ${cssVar("--font")}`; g.fillText("double-click to make a beat", 7 * dpr, top + 14 * dpr); return; }
    const rowH = L.rowH, pxPerBeat = L.ppb, stepW = L.stepW;
    for (let k = 0; k * stepW < W; k++) if (k % 4 === 0) { g.fillStyle = full ? (k % 16 === 0 ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.06)") : k % 16 === 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)"; g.fillRect(k * stepW, top, Math.max(1, dpr), bottom - top); }
    const alphaOf = (n) => (0.4 + 0.6 * (n.velocity || 100) / 127) * (n.chance != null && n.chance < 1 ? 0.35 + 0.65 * n.chance : 1);
    if (!window.KT2_DRUM_BARS) {
      for (const n of notes) {
        const p = L.at(n); if (!p) continue;
        g.fillStyle = full ? "#000" : p.col; g.globalAlpha = full ? 0.25 + 0.5 * alphaOf(n) : alphaOf(n);
        g.beginPath(); g.arc(p.x, p.y, L.r, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      return;
    }
    rows.forEach(([pitch, col], i) => {
      const y = top + i * rowH, h = Math.max(dpr * 2, rowH - Math.max(dpr, rowH * 0.22)), r = Math.min(h / 2, 2.5 * dpr);
      g.fillStyle = full ? "#000" : col;
      for (const n of notes) {
        if (n.pitch !== pitch) continue;
        const x = n.start * pxPerBeat + dpr * 0.5, w = Math.max(dpr * 2, Math.min(stepW, (n.length || 0.25) * pxPerBeat) - dpr * 1.5);
        g.globalAlpha = full ? 0.25 + 0.5 * alphaOf(n) : alphaOf(n);
        g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill();
      }
    });
    g.globalAlpha = 1;
  });
}

// A MIDI clip in the lane: its notes as little bars, like a mini piano roll.
// the stacked synths with their own notes on a pattern (drawn in its preview, lit while it plays)
function noteLayers(t, c) {
  if (!t) t = ((ui.state && ui.state.tracks) || []).find((x) => (x.clips || []).some((q) => q.id === c.id));
  if (!t) return [];
  return ((ui.state && ui.state.tracks) || []).filter((x) => x.layerOf === t.id && x.linked === false)
    .map((x) => ({ id: x.id, color: colorOf(x), muted: !!x.muted, notes: (c.stack && c.stack[x.id]) || [] })).filter((l) => l.notes.length);
}
// Where every note of a pattern's preview sits, exactly as drawNotes draws it: the same pitch range
// (main notes + stacked synths' notes), rows and widths. kt2-juice.js lights these very boxes up
// while the pattern plays (Eman, 9 Nov: the white must light the notes you see, every time).
// full-colour patterns (kt2.js k2-full) draw each note as a thin dark line centred in its row (Eman, 10 Nov)
function isFullPattern(c) { return !!(c && c.id && document.querySelector(`#rows .clip.k2-full[data-clip-id="${c.id}"]`)); }
function thinNote(rowH, dpr) { const h = Math.max(dpr * 1.5, Math.min(rowH - dpr, 3 * dpr)); return { h, dy: (rowH - h) / 2 }; }
function notesLayout(c, layers, W, H, dpr, full) {
  if (full == null) full = isFullPattern(c);
  const top = patTop(dpr), bottom = H - 6 * dpr;
  const notes = c.notes || [];
  layers = layers || [];
  const every = notes.concat(...layers.map((l) => l.notes));
  if (!every.length) return null;
  let lo = Math.min(...every.map((n) => n.pitch)), hi = Math.max(...every.map((n) => n.pitch));
  if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
  const rowH = (bottom - top) / (hi - lo + 1), ppb = W / Math.max(0.25, c.beats || 16);
  const boxes = [];
  if (full) {
    const { h, dy } = thinNote(rowH, dpr);
    for (const n of notes) boxes.push({ n, layer: null, x: n.start * ppb, w: Math.max(dpr * 2, n.length * ppb - dpr), y: bottom - (n.pitch - lo + 1) * rowH + dy, h });
    for (const l of layers) for (const n of l.notes) boxes.push({ n, layer: l, x: n.start * ppb, w: Math.max(dpr * 2, n.length * ppb - dpr), y: bottom - (n.pitch - lo + 1) * rowH + dy, h });
    return { lo, hi, top, bottom, rowH, ppb, boxes };
  }
  for (const n of notes) boxes.push({ n, layer: null, x: n.start * ppb, w: Math.max(dpr * 2, n.length * ppb - dpr), y: bottom - (n.pitch - lo + 1) * rowH, h: Math.max(dpr * 2, rowH - dpr) });
  const solidLayers = !notes.length && !window.KT2_LAYER_COLORS;
  for (const l of layers) for (const n of l.notes) {
    if (solidLayers) { boxes.push({ n, layer: l, x: n.start * ppb, w: Math.max(dpr * 2, n.length * ppb - dpr), y: bottom - (n.pitch - lo + 1) * rowH, h: Math.max(dpr * 2, rowH - dpr) }); continue; }
    const h = Math.max(dpr * 2, (rowH - dpr) * 0.7);
    boxes.push({ n, layer: l, x: n.start * ppb, w: Math.max(dpr * 3, n.length * ppb - dpr), y: bottom - (n.pitch - lo + 1) * rowH + (rowH - h) / 2, h });
  }
  return { lo, hi, top, bottom, rowH, ppb, boxes };
}
window.noteLayers = noteLayers; window.notesLayout = notesLayout; window.isFullPattern = isFullPattern;

function drawNotes(canvas, c, color, layers) {
  requestAnimationFrame(() => {
    const dpr = window.devicePixelRatio || 1;
    const rect = layoutRect(canvas);
    if (!rect.width) return;
    const W = Math.min(16384, Math.round(rect.width * dpr)), H = Math.round(rect.height * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.ktDpr = dpr;   // kt2-juice.js lays its play light out with the same ratio, even while the canvas is stretched
    const g = canvas.getContext("2d");
    const top = patTop(dpr), bottom = H - 6 * dpr;
    const notes = c.notes || [];
    layers = layers || [];
    const every = notes.concat(...layers.map((l) => l.notes));
    // full-colour pattern (kt2.js k2-full, Eman 10 Nov): the clip is the colour, so the notes are dark ink on it
    const full = !!(canvas.closest && canvas.closest(".k2-full"));
    if (full) color = "#000";
    if (!every.length) {
      // a pattern with no instrument yet says LOAD INSTRUMENT instead (kt2-picker.js), no symbol behind it
      if (!window.KT2_CLIPADD_BUTTON && canvas.closest && canvas.closest(".k2p-noinst")) return;
      // empty: a small "open" symbol (four arrows out to the corners) instead of a hint text (Eman, 31 Oct)
      const cx = W / 2, cy = (top + bottom) / 2, r = Math.min(7 * dpr, (bottom - top) / 2 - 2 * dpr);
      if (r < 3 * dpr) return;
      g.strokeStyle = g.fillStyle = full ? "rgba(0,0,0,0.45)" : hexA(color, 0.6);
      g.lineWidth = Math.max(1, 1.6 * dpr);
      const a = r * 0.55, gap = r * 0.18;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tx = cx + sx * r, ty = cy + sy * r;
        g.beginPath(); g.moveTo(cx + sx * gap, cy + sy * gap); g.lineTo(tx - sx * a * 0.4, ty - sy * a * 0.4); g.stroke();
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - sx * a, ty); g.lineTo(tx, ty - sy * a); g.closePath(); g.fill();
      }
      return;
    }
    let lo = Math.min(...every.map((n) => n.pitch)), hi = Math.max(...every.map((n) => n.pitch));
    if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
    const rowH = (bottom - top) / (hi - lo + 1);
    const pxPerBeat = W / Math.max(0.25, c.beats || 16);
    g.fillStyle = color;
    // the clip's fades thin the notes as the sound goes down (Eman, 31 Oct), like a wave thins
    const secW = (c.length || 0) / W, fin = c.fadeIn || 0, fout = c.fadeOut || 0;
    const lvl = (x) => { const t = x * secW; let k = 1; if (fin > 0 && t < fin) k = Math.min(k, t / fin); if (fout > 0 && t > c.length - fout) k = Math.min(k, (c.length - t) / fout); return Math.max(0, k); };
    const fades = secW > 0 && (fin > 0 || fout > 0);
    const thin = full ? thinNote(rowH, dpr) : null;
    for (const n of notes) {
      const x = n.start * pxPerBeat, w = Math.max(dpr * 2, n.length * pxPerBeat - dpr);
      const y = bottom - (n.pitch - lo + 1) * rowH + (thin ? thin.dy : 0), h = thin ? thin.h : Math.max(dpr * 2, rowH - dpr);
      g.globalAlpha = full ? (n.muted ? 0.18 : 0.5 + 0.32 * (n.velocity || 100) / 127) : n.muted ? 0.25 : 0.45 + 0.55 * (n.velocity || 100) / 127;
      if (!fades) { g.fillRect(x, y, w, h); continue; }
      const step = Math.max(1, Math.round(dpr * 2));
      for (let xx = x; xx < x + w; xx += step) {
        const hh = Math.max(dpr * 0.75, h * lvl(xx + step / 2));
        g.fillRect(xx, y + (h - hh) / 2, Math.min(step, x + w - xx), hh);
      }
    }
    // the other synths: outlined bars in their own colour, thinner, dimmed when muted; the main
    // synth's notes stay solid so the two are easy to tell apart
    // all in the pattern's own colour (Eman, 6 Nov: blue chords on a green pattern looked wrong);
    // with no notes of its own the stacked synth's notes draw solid, like the main ones.
    // KT2_LAYER_COLORS = true brings back each synth's own colour
    const solidLayers = !notes.length && !window.KT2_LAYER_COLORS;
    for (const l of layers) {
      g.strokeStyle = g.fillStyle = window.KT2_LAYER_COLORS && !full ? l.color : color;
      if (full) {   // stacked synths: the same thin dark lines (kt2-juice lights these same boxes via notesLayout)
        for (const n of l.notes) {
          const x = n.start * pxPerBeat, w = Math.max(dpr * 2, n.length * pxPerBeat - dpr);
          g.globalAlpha = (l.muted || n.muted ? 0.18 : (notes.length ? 0.6 : 1) * (0.5 + 0.32 * (n.velocity || 100) / 127));
          g.fillRect(x, bottom - (n.pitch - lo + 1) * rowH + thin.dy, w, thin.h);
        }
        continue;
      }
      if (solidLayers) {
        for (const n of l.notes) {
          const x = n.start * pxPerBeat, w = Math.max(dpr * 2, n.length * pxPerBeat - dpr);
          const y = bottom - (n.pitch - lo + 1) * rowH, h = Math.max(dpr * 2, rowH - dpr);
          g.globalAlpha = full ? (l.muted || n.muted ? 0.18 : 0.5 + 0.32 * (n.velocity || 100) / 127) : (l.muted || n.muted ? 0.25 : 0.45 + 0.55 * (n.velocity || 100) / 127);
          g.fillRect(x, y, w, h);
        }
        continue;
      }
      g.lineWidth = Math.max(1, 1.2 * dpr);
      for (const n of l.notes) {
        const x = n.start * pxPerBeat, w = Math.max(dpr * 3, n.length * pxPerBeat - dpr);
        const h = Math.max(dpr * 2, (rowH - dpr) * 0.7), y = bottom - (n.pitch - lo + 1) * rowH + (rowH - h) / 2;
        const k = (l.muted || n.muted ? 0.3 : 1) * (full ? 0.7 : 1);
        g.globalAlpha = 0.22 * k; g.fillRect(x, y, w, h);
        g.globalAlpha = 0.95 * k; g.strokeRect(x + g.lineWidth / 2, y + g.lineWidth / 2, Math.max(1, w - g.lineWidth), Math.max(1, h - g.lineWidth));
      }
    }
    // slides (Eman, 4 Nov): a thin curve from the note it glides out of into the slide note, for as
    // long as the two overlap, so you can see the glide in the lane
    const ycen = (p) => bottom - (p - lo + 1) * rowH + rowH / 2;
    g.lineWidth = Math.max(1, Math.min(rowH * 0.45, 2 * dpr));
    g.lineCap = "round";
    for (const n of notes) {
      if (!n.slide || n.muted) continue;
      const over = notes.filter((q) => q !== n && q.start < n.start && q.start + q.length > n.start);
      let fromP = n.slideFrom != null ? n.slideFrom : null, glide = 0.25;
      const src = over.length ? over.reduce((a, q) => (Math.abs(q.pitch - n.pitch) < Math.abs(a.pitch - n.pitch) ? q : a)) : null;
      if (fromP == null && src) fromP = src.pitch;
      if (src) glide = Math.max(0.0625, Math.min(n.length, src.start + src.length - n.start));
      if (fromP == null || fromP === n.pitch) continue;
      const x1 = n.start * pxPerBeat, x2 = x1 + Math.max(4 * dpr, glide * pxPerBeat), y1 = ycen(fromP), y2 = ycen(n.pitch);
      g.globalAlpha = 0.95;
      g.strokeStyle = full ? "rgba(0,0,0,0.8)" : "#e4ff3a";
      g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(x1 + (x2 - x1) * 0.5, y1, x1 + (x2 - x1) * 0.5, y2, x2, y2); g.stroke();
      g.fillStyle = "#e4ff3a"; g.beginPath(); g.arc(x1, y1, g.lineWidth, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  });
}

// read per note while drawing, so it's cached (a look change shows within half a second)
var cssVarCache = { at: 0, map: new Map() };   // var: applyLook runs before this line on start
function cssVar(name) {
  if (!cssVarCache) return getComputedStyle(document.body).getPropertyValue(name).trim();
  const now = performance.now();
  if (now - cssVarCache.at > 500) { cssVarCache.at = now; cssVarCache.map.clear(); }
  let v = cssVarCache.map.get(name);
  if (v === undefined) { v = getComputedStyle(document.body).getPropertyValue(name).trim(); cssVarCache.map.set(name, v); }
  return v;
}

function mixWhite(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const m = (v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)); // amt < 0 mixes toward black
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function renderOverlays() {
  const s = ui.state;
  const t = ui.transport;
  paintLoop(s.loopStart, s.loopEnd, !!(t.looping && s.loopEnd > s.loopStart));

  const now = sectionAt(t.position);
  document.querySelectorAll(".section").forEach((b) => {
    const sec = s.sections[b.dataset.index];
    b.classList.toggle("now", Number(b.dataset.index) === now);
    b.classList.toggle("looped", t.looping && Math.abs(sec.start - s.loopStart) < 0.01 && Math.abs(sec.end - s.loopEnd) < 0.01);
  });
}

// ---------------------------------------------------------------------------
// Device rack: the selected clip's chain as a strip of cards. Each card shows the
// effect's own little picture (EQ curve, compressor curve, echoes, reverb tail...)
// drawn from its settings, and its 2-3 main values underneath. Drag a value up or
// down (or scroll on it) to change it; click the name for the full plugin window.
// A vocal clip (what the vocal tools work on).
function selectedTakeClip() {
  const c = ui.selectedClip && findClip(ui.selectedClip);
  return c && c.track.kind === "take" ? c : null;
}

// Any selected clip: a vocal take, the beat, or a MIDI clip. The rack shows its effects
// (for MIDI clips: the lane's instrument and effects).
// Or a whole lane, picked by clicking its card: then the rack shows the lane's own effects,
// which every clip on it goes through.
function selectedRackClip() {
  if (ui.selectedClip) return findClip(ui.selectedClip);
  if (ui.selectedTrack === MASTER_ID && ui.state) {
    const m = masterTrack();
    return { id: m.id, lane: true, master: true, kind: "lane", name: "Master", plugins: m.plugins, track: m, start: 0, clips: [] };
  }
  if (window.killtoyReturns && killtoyReturns.isReturn(ui.selectedTrack) && ui.state) return killtoyReturns.rackClip(ui.selectedTrack);
  const t = ui.selectedTrack && ui.state && ui.state.tracks.find((x) => x.id === ui.selectedTrack);
  if (!t) return null;
  return { id: t.id, lane: true, kind: "lane", name: t.kind === "beat" ? "Reference" : t.name,
           plugins: laneFx(t), track: t, start: 0, clips: t.clips, macros: t.macros };
}
// The master as a lane: every lane plays through its effects, then its fader, then the
// safety limiter (always last, can't be removed). Rack commands reach it as { trackId: "master" }.
const MASTER_ID = "master";
function masterTrack() {
  const m = (ui.state && ui.state.master) || { volume: 0, plugins: [] };
  return { id: MASTER_ID, kind: "master", role: "master", name: "Master", volume: m.volume || 0, plugins: m.plugins || [], clips: [], automation: m.automation || [], autoOpen: !!m.autoOpen };
}
// A lane's own effects. (Instrument lanes keep theirs with the MIDI clip in the preview.)
const laneFx = (t) => (t.plugins && t.plugins.length) || t.kind !== "inst" || !t.clips[0] ? t.plugins || [] : t.clips[0].plugins;
// What rack commands act on: { clipId } for a clip, { trackId } for a whole lane.
const fxTarget = (c) => (c.lane ? { trackId: c.id } : { clipId: c.id });

// ---------------------------------------------------------------------------
// Effect ideas: when a clip or lane is picked, the rack also shows the effects that
// usually make that kind of sound better, as cards that sit switched off. One click
// puts one on, already set to a good starting point. What kind of sound it is comes
// from the lane's name first (Kick, 808, Chords...), then its role.
function soundKind(t) {
  if (!t) return null;
  if (t.kind === "beat" || t.kind === "master" || t.kind === "return") return "mix";
  const n = (t.name || "").toLowerCase();
  if (/chop/.test(n)) return "chops";
  if (/adlib|ad-lib|throw/.test(n)) return "adlib";
  if (/vox|vocal|voice|lead vox|double|harmon|backing|backs/.test(n)) return "vocal";
  if (/808|bass|\bsub\b|reese/.test(n)) return "bass";
  if (/kick|snare|clap|hat|drum|perc|break|cymbal|ride|tom|rim|shaker/.test(n)) return "drums";
  if (/chord|key|piano|rhodes|organ|pad|string|guitar|pluck/.test(n)) return "chords";
  if (/lead|arp|synth|melody|hook|bell/.test(n)) return "lead";
  if (/fx|noise|texture|riser|sweep|impact|reverb|delay/.test(n)) return "fx";
  if (t.kind === "inst") return "lead";
  return { lead: "vocal", double: "vocal", harmony: "vocal", backs: "vocal", adlib: "adlib", fx: "fx" }[t.role] || "fx";
}

// kn(id, value 0..1, readout) is one knob setting. "plugin" is the effect's name in the
// plugin list; ideas whose effect isn't there (yet) are left out, so a new built-in
// (SC Clip) shows up by itself once it exists.
const kn = (id, value, text) => ({ id, value, text });
const throwTime = () => (60 / ((ui.state && ui.state.bpm) || 120)) * 0.75; // dotted 1/8, in seconds
const THROW = () => ({ plugin: "Delay", label: "Throw", why: "Echo in time on the last words",
  knobs: [kn("purp:delayTime", throwTime() / 1.5, Math.round(throwTime() * 1000) + " ms"), kn("feedback", 0.45, "-7 dB"), kn("mix proportion", 0.32, "32%")] });
// SC Clip (Drive 0..+24 dB, Shape soft..hard, Ceiling -24..0 dB): a gentle hard-ish clip on
// vocals, drums and the mix; on bass a soft, pushed clip that turns into grit.
const SC_CLIP = { plugin: "SC Clip", why: "Shaves the peaks so it sits louder without spiking",
  knobs: [kn("drive", 0.125, "+3.0 dB"), kn("shape", 0.65, "65%"), kn("ceiling", 0.958, "-1.0 dB")] };
const SC_CLIP_GRIT = { plugin: "SC Clip", label: "Clip grit", why: "Pushed soft clipping: distortion you can hear",
  knobs: [kn("drive", 0.5, "+12.0 dB"), kn("shape", 0.15, "15%"), kn("ceiling", 0.958, "-1.0 dB")] };
const FX_IDEAS = {
  vocal: () => [
    { plugin: "TUNR", label: "TUNR", why: "Pulls every note into the song's key, still sounds natural", knobs: [kn("speed", 0.5, "50%"), kn("humanize", 0.25, "25%"), kn("formant", 0.5, "0.0 st")] },
    { plugin: "Compressor", label: "Vocal comp", why: "Keeps every word at the same level", knobs: [kn("threshold", 0.6, "-18.0 dB"), kn("ratio", 0.36, "4.0 : 1"), kn("output gain", 0.58, "+2.0 dB")] },
    { plugin: "DeEss", why: "Takes the sting out of S and T sounds", knobs: [kn("intense", 0.5, "0.50"), kn("max", 0.5, "0.50"), kn("freq", 0.5, "0.50")] },
    SC_CLIP,
    THROW(),
    { plugin: "Chop Pitch", label: "Octave up", why: "An octave-up copy under the voice", knobs: [kn("pitch", 1, "+12.0 st"), kn("formant", 0.5, "0.0 st"), kn("mix", 0.25, "25%")] },
    { plugin: "Space", why: "Big lush room behind the voice", knobs: [kn("size", 0.55, "55%"), kn("decay", 0.45, "2.5 s"), kn("mix", 0.18, "18%")] },
  ],
  chops: () => [
    { plugin: "Chop Pitch", why: "Pitch the chop up, voice stays human", knobs: [kn("pitch", 0.708, "+5.0 st"), kn("formant", 0.5, "0.0 st"), kn("mix", 1, "100%")] },
    { plugin: "Pump", why: "Ducks the chop to the kick", knobs: [kn("depth", 0.5, "50%"), kn("rate", 0.5, "1/4"), kn("release", 0.526, "55%")] },
    { plugin: "Space", knobs: [kn("size", 0.7, "70%"), kn("decay", 0.55, "3.5 s"), kn("mix", 0.35, "35%")], why: "Washes the chop out" },
    THROW(),
    { plugin: "Crush", why: "Lo-fi grit", knobs: [kn("bits", 0.5, "9.0 bits"), kn("rate", 0.62, "11.0 kHz"), kn("mix", 0.4, "40%")] },
  ],
  adlib: () => [
    THROW(),
    { plugin: "TUNR", label: "Hard tune", why: "The robotic snap between notes", knobs: [kn("speed", 1, "Robot"), kn("humanize", 0, "0%"), kn("formant", 0.5, "0.0 st")] },
    { plugin: "Drive", why: "Dirty, phone-like adlib", knobs: [kn("drive", 0.45, "0.45"), kn("highpass", 0.35, "0.35"), kn("outlevel", 0.6, "0.60")] },
    { plugin: "Chop Pitch", label: "Pitch down", why: "Deep, dark adlib", knobs: [kn("pitch", 0.25, "-6.0 st"), kn("formant", 0.4, "-2.4 st"), kn("mix", 1, "100%")] },
    { plugin: "Space", knobs: [kn("size", 0.6, "60%"), kn("decay", 0.5, "3.0 s"), kn("mix", 0.28, "28%")], why: "Puts it far away" },
    { plugin: "DeEss", why: "Softer S sounds", knobs: [kn("intense", 0.5, "0.50"), kn("max", 0.5, "0.50"), kn("freq", 0.5, "0.50")] },
  ],
  drums: () => [
    { plugin: "Punch", why: "Sharper hit, shorter tail", knobs: [kn("attack", 0.75, "+50%"), kn("sustain", 0.4, "-20%"), kn("mix", 1, "100%")] },
    SC_CLIP,
    { plugin: "Loud", label: "Clip", why: "Clips the peaks so the drums hit loud", knobs: [kn("push", 0.125, "+3.0 dB"), kn("ceiling", 0.917, "-1.0 dB"), kn("clip", 0.7, "70%")] },
    { plugin: "Squash", why: "OTT-style 3-band: brings up the room and snap", knobs: [kn("depth", 0.3, "30%"), kn("time", 0.4, "40%"), kn("output", 0.5, "+0.0 dB")] },
    { plugin: "Compressor", label: "Drum bus", why: "Glues the hits together", knobs: [kn("threshold", 0.65, "-15.8 dB"), kn("ratio", 0.24, "3.0 : 1"), kn("output gain", 0.55, "+1.2 dB")] },
  ],
  bass: () => [
    { plugin: "Drive", label: "Saturation", why: "Grit you can hear on small speakers", knobs: [kn("drive", 0.35, "0.35"), kn("highpass", 0.02, "0.02"), kn("outlevel", 0.62, "0.62")] },
    SC_CLIP_GRIT,
    { plugin: "Pump", label: "Sidechain", why: "Ducks the bass out of the kick's way", knobs: [kn("depth", 0.6, "60%"), kn("rate", 0.5, "1/4"), kn("release", 0.4, "43%")] },
    { plugin: "Compressor", label: "Bass comp", why: "Every note the same weight", knobs: [kn("threshold", 0.6, "-18.0 dB"), kn("ratio", 0.48, "5.0 : 1"), kn("output gain", 0.58, "+2.0 dB")] },
    { plugin: "Squash", why: "OTT-style: brings out the growl", knobs: [kn("depth", 0.35, "35%"), kn("time", 0.5, "50%"), kn("output", 0.5, "+0.0 dB")] },
  ],
  chords: () => [
    { plugin: "Pump", label: "Sidechain", why: "Breathes with the kick", knobs: [kn("depth", 0.55, "55%"), kn("rate", 0.5, "1/4"), kn("release", 0.526, "55%")] },
    { plugin: "Space", why: "Wide, soft room", knobs: [kn("size", 0.65, "65%"), kn("decay", 0.5, "3.0 s"), kn("mix", 0.25, "25%")] },
    { plugin: "EQ", label: "Make room", why: "Thins the lows so the bass and vocal fit", knobs: [kn("Low-pass gain", 0.35, "-3.6 dB"), kn("Mid gain 1", 0.46, "-1.0 dB"), kn("High-pass gain", 0.56, "+1.4 dB")] },
    { plugin: "Squash", why: "OTT-style shimmer", knobs: [kn("depth", 0.25, "25%"), kn("time", 0.5, "50%"), kn("output", 0.5, "+0.0 dB")] },
    { plugin: "Crush", label: "Lo-fi", why: "Dusty, older sound", knobs: [kn("bits", 0.6, "10.4 bits"), kn("rate", 0.7, "14.0 kHz"), kn("mix", 0.35, "35%")] },
  ],
  lead: () => [
    { plugin: "Squash", why: "OTT-style 3-band: loud, bright, in your face", knobs: [kn("depth", 0.4, "40%"), kn("time", 0.4, "40%"), kn("output", 0.5, "+0.0 dB")] },
    SC_CLIP,
    THROW(),
    { plugin: "Space", knobs: [kn("size", 0.55, "55%"), kn("decay", 0.45, "2.5 s"), kn("mix", 0.2, "20%")], why: "Room around the lead" },
    { plugin: "Drive", why: "Bite", knobs: [kn("drive", 0.3, "0.30"), kn("highpass", 0.1, "0.10"), kn("outlevel", 0.62, "0.62")] },
    { plugin: "Pump", label: "Sidechain", why: "Moves with the kick", knobs: [kn("depth", 0.45, "45%"), kn("rate", 0.5, "1/4"), kn("release", 0.526, "55%")] },
  ],
  fx: () => [
    { plugin: "Space", why: "Huge tail", knobs: [kn("size", 0.8, "80%"), kn("decay", 0.62, "5.0 s"), kn("mix", 0.4, "40%")] },
    THROW(),
    { plugin: "Pump", label: "Sidechain", why: "Ducks to the kick", knobs: [kn("depth", 0.55, "55%"), kn("rate", 0.5, "1/4"), kn("release", 0.526, "55%")] },
    { plugin: "Crush", why: "Grit and noise", knobs: [kn("bits", 0.43, "8.0 bits"), kn("rate", 0.62, "11.0 kHz"), kn("mix", 0.5, "50%")] },
    { plugin: "EQ", label: "Thin out", why: "Keeps it out of the bass", knobs: [kn("Low-pass gain", 0.25, "-6.0 dB"), kn("Mid gain 1", 0.5, "0.0 dB"), kn("High-pass gain", 0.55, "+1.2 dB")] },
  ],
  mix: () => [
    { plugin: "Loud", why: "Master it loud without going over", knobs: [kn("push", 0.25, "+6.0 dB"), kn("ceiling", 0.917, "-1.0 dB"), kn("clip", 0.4, "40%")] },
    SC_CLIP,
    { plugin: "Squash", why: "OTT-style glue on the whole song", knobs: [kn("depth", 0.15, "15%"), kn("time", 0.5, "50%"), kn("output", 0.5, "+0.0 dB")] },
    { plugin: "EQ", label: "Air", why: "A little brighter on top", knobs: [kn("Low-pass gain", 0.5, "0.0 dB"), kn("Mid gain 1", 0.5, "0.0 dB"), kn("High-pass gain", 0.6, "+2.4 dB")] },
  ],
};

// The ideas for this clip or lane that aren't on it already, each with its plugin-list
// entry. Empty until the plugin list has loaded (it loads in the background).
function fxIdeas(clip) {
  if (!clip || clip.kind === "midi" || !ui.plugins) return [];
  const kind = soundKind(clip.track);
  const have = new Set(clip.plugins.map((p) => p.name.toLowerCase()));
  const room = 5 - clip.plugins.filter((p) => !p.instrument).length;
  const out = [];
  for (const idea of (FX_IDEAS[kind] || FX_IDEAS.fx)()) {
    const entry = ui.plugins.find((p) => !p.instrument && p.name.toLowerCase() === idea.plugin.toLowerCase());
    if (!entry || have.has(idea.plugin.toLowerCase())) continue;
    out.push({ ...idea, entry });
  }
  return out.slice(0, Math.max(0, Math.min(4, room)));
}

// One click: the effect goes on, set the way the idea says (one undo step).
async function turnOnIdea(clip, idea) {
  const target = fxTarget(clip);
  const r = await run("addPlugin", { ...target, key: idea.entry.key });
  if (!r || r.error) return;
  const s = await booth("getState");
  if (s && !s.error) ui.state = s;
  const host = target.trackId ? ui.state.tracks.find((t) => t.id === target.trackId) : findClip(target.clipId);
  const list = host ? (target.trackId ? laneFx(host) : host.plugins) : [];
  const fx = list[list.length - 1];
  if (!fx) return;
  for (const q of idea.knobs || []) {
    if (fx.params.some((x) => x.id === q.id)) await booth("setParam", { pluginId: fx.id, paramId: q.id, value: q.value, begin: false });
  }
}

function renderRack() {
  const clip = selectedRackClip();
  const isMidi = !!clip && clip.kind === "midi";
  const rack = $("rack");
  rack.style.setProperty("--c", clip ? colorOf(clip.track) : "");

  const fxCount = clip ? clip.plugins.filter((p) => !p.instrument).length : 0;
  $("rack-name").textContent = clip ? clip.name : "No clip selected";
  $("rack-sub").textContent = !clip ? "Click a clip or a lane"
    : clip.master ? `Everything you hear \u00b7 ${fxOf(fxCount)}, then the safety limiter`
    : clip.ret ? `Return \u00b7 what the lanes send here \u00b7 ${fxOf(fxCount)}, then the master`
    : clip.lane ? `Whole lane \u00b7 ${fxOf(fxCount)}`
    : isMidi ? `${clip.track.name} \u00b7 bar ${fmtBars(clip.start)} \u00b7 ${clip.notes.length} notes \u00b7 effects play on the whole lane`
    : clip.track.kind === "beat" ? `Reference beat \u00b7 ${fxOf(fxCount)}`
    : `${clip.track.name} \u00b7 bar ${fmtBars(clip.start)} \u00b7 ${fxOf(fxCount)}`;
  $("btn-save-chain").disabled = !clip || isMidi || !clip.plugins.length;
  $("btn-bypass").disabled = !clip || !fxCount;
  $("btn-bypass").classList.toggle("on", !!clip && fxCount > 0 && clip.plugins.every((p) => p.instrument || !p.enabled));

  renderPresets(clip);
  renderTools(clip);
  if (ui.plugwin) renderPluginPanel(false);

  // Rebuild cards only when the chain itself changes; values are patched in place.
  // The ideas need the plugin list; fetch it once, then draw the cards again.
  if (clip && !ui.plugins && !ui.pluginsLoading) {
    ui.pluginsLoading = true;
    loadPlugins().then(() => { ui.pluginsLoading = false; ui.rackSig = ""; renderRack(); }, () => (ui.pluginsLoading = false));
  }
  const sig = clip ? (ui.plugins ? "i" : "") + soundKind(clip.track) + clip.id + "|" + clip.plugins.map((p) => p.id + (p.enabled ? "1" : "0") + (p.sidechain || "") + (p.scAmt != null ? p.scAmt : "") + p.params.map((x) => x.id).join(",")).join(";") + "|" + JSON.stringify((clip.macros || []).map((m) => [m.id, m.name, m.maps.length, Math.round(m.value * 100)])) : "none";
  // the GROUP / SEND panel follows the buses and this sound's sends without rebuilding the cards
  const busSig = fxBarNew() && clip && ui.state.returns ? JSON.stringify([clip.id, ui.selectedTrack, ui.state.returns.map((r) => [r.id, r.name, r.mode, r.muted, (r.plugins || []).map((p) => p.id + (p.enabled ? 1 : 0))]), ui.state.tracks.map((t) => t.sends), clip.track && clip.track.sendsPre]) : "";
  if (sig === ui.rackSig && busSig !== ui.busSig) buildBusPanel(clip);
  ui.busSig = busSig;
  if (sig !== ui.rackSig) {
    ui.rackSig = sig;
    buildCards(clip);
  } else if (clip) {
    for (const p of clip.plugins) {
      const grabbed = ui.dragging && ui.dragging.dataset && ui.dragging.dataset.fx === p.id;   // its picture is being dragged
      for (const prm of p.params) {
        const k = document.querySelector(`.knob[data-plugin="${p.id}"][data-param="${CSS.escape(prm.id)}"]`);
        if (k && ui.dragging !== k && !grabbed) setKnob(k, prm.value, prm.text);
      }
      refreshCard(p);
    }
  }
}

function renderPresets(clip) {
  const box = $("presets");
  box.replaceChildren();
  const chains = [...ui.state.chains].sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
  ui.sortedChains = chains;
  const current = clip ? clip.plugins.map((p) => p.name).join(" \u2192 ") : null;
  const most = Math.max(1, ...chains.map((c) => c.uses));

  chains.slice(0, 9).forEach((ch, i) => {
    const b = el("button", "preset" + (current && current === ch.plugins ? " on" : ""));
    const bar = el("span", "bar");
    const fill = el("i");
    fill.style.width = Math.round((ch.uses / most) * 100) + "%";
    bar.append(fill);
    b.append(el("span", "k", String(i + 1)), document.createTextNode(ch.name), bar);
    b.disabled = !clip || clip.kind === "midi";
    b.title = `${ch.plugins || "Empty"}${ch.uses ? `  \u00b7  used ${ch.uses}\u00d7` : ""}  \u00b7  key ${i + 1}  \u00b7  right-click to delete`;
    b.onclick = () => applyChain(ch.name);
    b.oncontextmenu = (e) => {
      e.preventDefault();
      showMenu(b, [{ label: `Delete preset "${ch.name}"`, danger: true, run: () => run("deleteChain", { name: ch.name }) }]);
    };
    box.append(b);
  });
}

// Other words the Add effect search finds KILLTOY's own effects by.
const FX_SEARCH = {
  "SC Clip": "clipper soft clip clipping saturation distortion standardclip",
  Texture: "granular grains shimmer stutter cloud glitch freeze pad reverse bloom texture",
  Loud: "limiter maximizer master", Pump: "sidechain duck", Crush: "bitcrusher lofi lo-fi", KILLCHAIN: "sidechain side chain duck ducking pump kickstart volume shaper",
  Space: "reverb", "Chop Pitch": "pitch shift formant",
  "TUNR": "tunr tuner snap tune auto-tune autotune auto tune pitch correction hard tune t-pain melodyne",
  ...(window.KT2CoreFx ? KT2CoreFx.search() : {}),
};

// What kind of picture a device gets, from its type and name.
function deviceKind(p) {
  const n = (p.type + " " + p.name).toLowerCase();
  if (/purpgate|gate/.test(n)) return "gate";
  if (/ktscclip|sc clip/.test(n)) return "clip";
  if (/kttexture|texture/.test(n)) return "verb";
  if (/ktsquash|squash|multiband/.test(n)) return "multi";
  if (/ktpunch|punch|transient/.test(n)) return "punch";
  if (/ktpump|pump/.test(n)) return "pump";
  if (/ktloud|loud/.test(n)) return "loud";
  if (/ktspace|space/.test(n)) return "verb";
  if (/ktcrush|crush/.test(n)) return "crush";
  if (/ktsnaptune/.test(n)) return "snaptune";
  if (/ktchoppitch/.test(n)) return "tune";
  if (/deess|de-ess/.test(n)) return "deess";
  if (/comp|press|limit|opto/.test(n)) return "comp";
  if (/4bandeq|\beq\b|pass\b|\bair\b|filter/.test(n)) return "eq";
  if (/delay|echo|dly/.test(n)) return "delay";
  if (/verb|room|hall|chamber/.test(n)) return "verb";
  if (/drive|dens|tape|tube|fat|dist|sat/.test(n)) return "drive";
  if (/tune|pitch/.test(n)) return "tune";
  return "other";
}

const pv = (p, re, fallback = 0.5) => {
  const prm = p.params.find((x) => re.test(x.id) || re.test(x.name));
  return prm ? Number(prm.value) : fallback;
};
const pt = (p, re) => {
  const prm = p.params.find((x) => re.test(x.id) || re.test(x.name));
  return prm ? prm.text : "";
};

function deviceTag(p) {
  switch (deviceKind(p)) {
    case "comp": return pt(p, /ratio/i);
    case "delay": return pt(p, /delayTime|time/i);
    case "verb": return "size " + Math.round(pv(p, /room size|size/i) * 100) + "%";
    case "gate": return pt(p, /threshold/i);
    case "eq": return "3-band";
    case "drive": return Math.round(pv(p, /drive|density/i) * 100) + "%";
    case "clip": return pt(p, /drive/i);
    case "multi": return "3-band " + Math.round(pv(p, /depth/i) * 100) + "%";
    case "punch": return pt(p, /attack/i);
    case "snaptune": return tuneTag(p);
    case "pump": return p.sidechain ? "follows a lane" : pt(p, /rate/i);
    case "loud": return pt(p, /push/i);
    case "crush": return pt(p, /bits/i);
    default: return p.params.length ? "" : "plugin";
  }
}

function buildCards(clip) {
  const box = $("cards");
  box.replaceChildren();

  if (!clip) {
    buildFxSide(null);
    buildBusPanel(null);
    const hint = el("div", "rack-empty");
    hint.innerHTML = "Pick a clip or a lane, then a <b>preset</b> on the left or <b>add an effect</b>. Effects live on the clip, so a throw stays on just that word.";
    box.append(hint);
    return;
  }

  const rack = rackCard(clip);
  if (rack) box.append(rack);
  for (const p of clip.plugins) {
    const card = el("div", "card" + (p.enabled ? "" : " off") + (p.instrument ? " inst" : ""));
    card.dataset.plugin = p.id;
    card.style.setProperty("--dc", deviceColor(p));
    if (p.why) card.title = p.why;

    const head = el("div", "card-head");
    const power = el("button", "card-power");
    power.title = p.enabled ? "Bypass" : "Turn on";
    power.onclick = () => run("togglePlugin", { pluginId: p.id });
    const name = el("div", "card-name", p.name);
    name.title = "Open the full plugin window";
    name.onclick = () => openPluginWindow(p);
    const tag = el("span", "card-tag" + (p.instrument ? " swap" : ""), p.instrument ? "instrument \u25BE" : deviceTag(p));
    if (p.instrument) {
      tag.title = "Pick another instrument";
      tag.onclick = (e) => { e.stopPropagation(); showInstrumentMenu(tag, clip.track); };
    }
    const x = el("button", "card-x", "\u2715");
    x.title = "Remove";
    x.onclick = () => run("removePlugin", { pluginId: p.id });
    head.append(power, name, tag);
    if (keyAnyOn(p)) head.append(keyChip(clip, p));
    head.append(x);
    if (!p.instrument) reorderByHead(head, card, p);

    const screen = el("canvas", "card-screen");
    screen.title = "Drag the dots to change the sound. Shift = fine, double-click = reset.";
    grabbable(screen, p.id);
    card.append(head);
    // TOY MACHINE: its logo instead of a knob picture, and the whole card opens the synth.
    if (p.instrument && /toy machine/i.test(p.name || "")) {
      const face = el("button", "card-tm");
      face.title = "Open TOY MACHINE: the landscape, macros and every song preset";
      const logo = el("img");
      logo.src = "toymachine-logo.png"; logo.alt = "TOY MACHINE"; logo.draggable = false;
      face.append(logo, el("span", "card-tm-sub", "Presets \u00b7 macros \u00b7 drop a sound"));
      face.onclick = () => openPluginWindow(p);
      const open = el("button", "card-open card-open-tm", "Open TOY MACHINE");
      open.onclick = () => openPluginWindow(p);
      card.append(face, open);
      box.append(card);
      continue;
    }
    // KILLCHAIN (ui/killchain.js): its logo in the name bar, the INPUT row, 4 knobs
    const kc = p.type === "ktside" && window.KillChain;
    if (kc) { const logo = el("img", "kchn-logo"); logo.src = "killchain-logo.png"; logo.alt = p.name; logo.draggable = false; name.replaceChildren(logo); name.title = p.name + ": open it big"; }
    // GHOST sidechain button right of the logo (Eman, 16 Nov; ui/killchain.js, KT2_KCHN_GHOST_OFF = no button)
    if (kc && KillChain.ghostBtn && !KillChain.ghostOff()) { name.classList.add("kchn-hasghost"); name.append(KillChain.ghostBtn(p)); }
    // KILLCHAIN layout (Eman, 16 Nov): INPUT up in the name bar, a row of shape pictures under the big one (KT2_KCHN_LAYOUT_OLD = old)
    const kcNew = kc && KillChain.shapeRow && !KillChain.layoutOld();
    if (kcNew) { card.classList.add("kchn-card", "kchn-l2"); const inp = KillChain.inputRow(clip, p); inp.classList.add("kchn-top"); name.after(inp); }
    else if (kc) { card.classList.add("kchn-card"); card.append(KillChain.inputRow(clip, p)); }
    else if (p.keyable || p.type === "ktpump") card.append(sidechainPicker(clip, p));
    card.append(deviceKind(p) === "snaptune" ? tuneScreen(p, screen) : screen);
    if (kcNew) card.append(KillChain.shapeRow(clip, p));
    // CORE FX (ui/kt2-corefx.js): a MODE row of small pictures under the big one (filter type, chorus/flanger/phaser...)
    const coreRow = window.KT2CoreFx && KT2CoreFx.modeRow(clip, p);
    if (coreRow) { card.classList.add("kfx-card"); card.append(coreRow); }

    if (p.params.length) {
      const knobs = el("div", "knobs");
      for (const prm of p.params.slice(0, kc ? 4 : (window.KT2CoreFx && KT2CoreFx.knobs(p)) || 3)) knobs.append(makeKnob(p, prm));
      card.append(knobs);
    } else {
      const open = el("button", "card-open", "Open its window \u2197");
      open.onclick = () => openPluginWindow(p);
      card.append(open);
    }
    box.append(card);
  }

  if (clip.master) box.append(limiterCard());
  // KILLTOY 2 (Eman, 31 Oct): a new clip shows no effect ideas, just Add effect. Parked, not deleted.
  const showIdeas = !document.documentElement.classList.contains("kt2") || window.SHOW_FX_IDEAS;
  if (showIdeas) for (const idea of fxIdeas(clip)) box.append(ideaCard(clip, idea));

  // KILLTOY 2 (Eman, 11 Nov): no effect limit; KT2_FX_LIMIT5 = the old 5. The new FX bar has ADD EFFECT on the left.
  buildFxSide(clip);
  buildBusPanel(clip);
  if (!fxBarNew() && (!fxLimit5() || clip.plugins.filter((p) => !p.instrument).length < 5)) {
    const add = el("button", "card add");
    // KILLTOY 2 (Eman, 6 Nov 15:26): the same plain card as ADD INSTRUMENT; KT2_FXADD_OLD = the round + and "Add effect"
    if (document.documentElement.classList.contains("kt2") && !window.KT2_FXADD_OLD) { add.classList.add("k2-fxadd"); add.innerHTML = "<b>+</b>ADD EFFECT"; }
    else add.append(el("span", "plus", "+"), el("span", null, "Add effect"));
    add.onclick = (e) => { e.stopPropagation(); showAddDevice(add); };
    box.append(add);
  }

  requestAnimationFrame(() => clip.plugins.forEach(refreshCard));
}

// The master's safety limiter: always on, always last, so the song never goes over -0.3 dB.
// It shows how much it is holding back right now (updateMasterMeter fills it in).
function limiterCard() {
  const card = el("div", "card limiter");
  card.title = "Always on and always last, so nothing you do can blow up your speakers. Your effects go before it.";
  const head = el("div", "card-head");
  head.append(el("span", "lim-lock", "\u25cf"), el("div", "card-name", "Safety limiter"), el("span", "card-tag", "always last"));
  const gr = el("div", "lim-gr");
  gr.id = "lim-gr";
  const bar = el("div", "lim-bar");
  const fill = el("i");
  fill.id = "lim-fill";
  bar.append(fill);
  card.append(head, el("div", "lim-text", "Keeps the song under -0.3 dB."), bar, gr);
  return card;
}

// Drag a card by its name bar to move it in the chain (the sound goes through the cards
// left to right). A plain click on the name still opens the plugin window.
function reorderByHead(head, card, p) {
  head.title = "Drag left or right to change the order";
  head.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    const x0 = e.clientX, y0 = e.clientY, box = $("cards"), scroll = box.scrollLeft;
    let moving = false, target = -1, mark = null;
    const others = () => [...document.querySelectorAll("#cards .card[data-plugin]")].filter((c) => !c.classList.contains("inst"));
    const move = (ev) => {
      const dx = ev.clientX - x0;
      if (!moving && Math.hypot(dx, ev.clientY - y0) < 6) return;
      if (!moving) { moving = true; card.classList.add("moving"); ui.dragging = card; }
      card.style.transform = `translateX(${dx}px)`;
      if (!window.KT2_BUS_LIST && busDragHover(ev.clientX, ev.clientY)) { if (mark) mark.classList.remove("drop-before", "drop-after"); target = -1; return; }
      box.scrollLeft = scroll;   // the moved card mustn't scroll the rack
      // Where it lands: before the first card whose middle is right of the pointer.
      const list = others(), rest = list.filter((c) => c !== card);
      let i = rest.findIndex((c) => { const r = c.getBoundingClientRect(); return ev.clientX < r.left + r.width / 2; });
      if (i < 0) i = rest.length;
      target = i;
      if (mark) mark.classList.remove("drop-before", "drop-after");
      mark = rest[i] || rest[rest.length - 1] || null;
      if (mark) mark.classList.add(rest[i] ? "drop-before" : "drop-after");
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (mark) mark.classList.remove("drop-before", "drop-after");
      if (!moving) return;
      const bus = !window.KT2_BUS_LIST && busDropAt(ev.clientX, ev.clientY);
      document.querySelectorAll("#k2bus .drop").forEach((n) => n.classList.remove("drop"));
      if (bus) { target = -1; const sel = selectedRackClip(); busCopyEffect(p, bus.dataset.bus || null, sel && sel.track && !sel.master && !sel.ret ? sel.track : null); }
      card.classList.remove("moving");
      card.style.transform = "";
      ui.dragging = null;
      // the click that ends a drag doesn't open the plugin window
      const eat = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener("click", eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", eat, { capture: true }), 0);
      setTimeout(() => (ui.rackSig = ""), 0);
      const from = others().indexOf(card);
      const done = target >= 0 && target !== from ? run("movePlugin", { pluginId: p.id, index: target }) : Promise.resolve(renderRack());
      box.scrollLeft = scroll;
      done.then(() => ($("cards").scrollLeft = scroll));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

// Pump's trigger: the tempo, or any other lane's real hits (an off-grid kick, a hat...).
const sidechainName = (p) => {
  if (p.type === "ktside" && window.KillChain) return KillChain.label(p);
  const t = p.sidechain && ui.state && ui.state.tracks.find((x) => x.id === p.sidechain);
  return t ? t.name : "Tempo";
};
// SIDECHAIN ON ANY EFFECT (Eman's list, 11 Nov; KT2_KEYANY_OFF = only Pump): every effect card gets a KEY chip.
// Pick a lane and this effect fades out of the sound while that lane plays (a ducked reverb or delay, a drive that
// backs off under the kick), then comes back. Amount = how far it fades. Pump and KILLCHAIN keep their own rows.
// RACKS (Eman's list, 11 Nov; KT2_RACK_OFF = none): up to 4 MACRO knobs on a clip or lane. Right-click any
// effect knob -> "Link to MACRO n": that macro now turns it (and every other knob linked to it) at once, across
// cards. The RACK card sits first in the row. Saved on the host as macros [{ id, name, value, maps: [{ pluginId,
// paramId, lo, hi }] }] with setMacros. Parallel chains = a SEND bus (GROUP / SEND panel).
const rackOn = () => document.documentElement.classList.contains("kt2") && !window.KT2_RACK_OFF;
function macroItems(p, prm) {
  const host = selectedRackClip();
  if (!rackOn() || !host || p.instrument) return [];
  const ms = host.macros || [], linked = ms.find((m) => m.maps.some((x) => x.pluginId === p.id && x.paramId === prm.id));
  const save = (next) => run("setMacros", { ...fxTarget(host), macros: next });
  const clone = () => JSON.parse(JSON.stringify(ms));
  const link = (i) => { const next = clone().map((m) => ({ ...m, maps: m.maps.filter((x) => !(x.pluginId === p.id && x.paramId === prm.id)) }));
    if (i == null) { if (next.length >= 4) return toast("A rack has 4 macros. Link this knob to one of them."); next.push({ id: "m" + Date.now().toString(36), name: "MACRO " + (next.length + 1), value: prm.value, maps: [] }); i = next.length - 1; }
    next[i].maps.push({ pluginId: p.id, paramId: prm.id, lo: 0, hi: 1 }); save(next); };
  return [{ sep: true },
    ...ms.map((m, i) => ({ label: "Link to " + m.name, meta: m.maps.length + " knob" + (m.maps.length === 1 ? "" : "s"), on: linked === m, run: () => link(i) })),
    ...(ms.length < 4 ? [{ label: "Link to a new MACRO", run: () => link(null) }] : []),
    ...(linked ? [{ label: "Unlink from " + linked.name, run: () => save(clone().map((m) => ({ ...m, maps: m.maps.filter((x) => !(x.pluginId === p.id && x.paramId === prm.id)) })).filter((m) => m.maps.length)) }] : [])];
}
function rackCard(host) {
  const ms = (host.macros || []).filter((m) => m.maps.length);
  if (!rackOn() || !ms.length) return null;
  const card = el("div", "card k2-rack");
  const head = el("div", "card-head");
  head.append(el("div", "card-name", "RACK"), el("span", "card-tag", ms.length + " macro" + (ms.length === 1 ? "" : "s")));
  const knobs = el("div", "k2-macros");
  ms.forEach((m) => {
    const k = el("div", "k2-macro");
    const dial = el("div", "k2-dial"), val = el("div", "k2-mval", Math.round(m.value * 100) + "%"), nm = el("div", "k2-mname", m.name);
    const paint = (v) => { dial.style.setProperty("--v", v); val.textContent = Math.round(v * 100) + "%"; };
    paint(m.value);
    k.title = m.maps.length + " knob" + (m.maps.length === 1 ? "" : "s") + " linked. Drag up or down. Double-click the name to rename, right-click for the links.";
    k.append(dial, val, nm);
    nm.ondblclick = (e) => { e.stopPropagation(); inlineEdit(nm, m.name, (v) => run("setMacros", { ...fxTarget(host), macros: host.macros.map((x) => (x.id === m.id ? { ...x, name: v.toUpperCase().slice(0, 16) } : x)) })); };
    k.addEventListener("contextmenu", (e) => {
      e.preventDefault(); e.stopPropagation();
      const name = (x) => { const q = host.plugins.find((pp) => pp.id === x.pluginId), pr = q && q.params.find((r) => r.id === x.paramId); return q ? `${knobName(pr ? pr.name : x.paramId)} \u00b7 ${q.name}` : x.paramId; };
      showMenu(atMouse(e), [{ heading: m.name },
        ...m.maps.map((x) => ({ label: "Unlink " + name(x), run: () => run("setMacros", { ...fxTarget(host), macros: host.macros.map((y) => (y.id === m.id ? { ...y, maps: y.maps.filter((z) => z !== x && !(z.pluginId === x.pluginId && z.paramId === x.paramId)) } : y)).filter((y) => y.maps.length) }) })),
        { sep: true }, { label: "Delete " + m.name, danger: true, run: () => run("setMacros", { ...fxTarget(host), macros: host.macros.filter((y) => y.id !== m.id) }) }]);
    });
    k.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target === nm) return;
      e.preventDefault();
      let v = m.value, lastY = e.clientY, first = true;
      k.classList.add("active");
      const mv = (ev) => {
        v = Math.min(1, Math.max(0, v + (lastY - ev.clientY) * 0.005 * (ev.shiftKey ? 0.2 : 1))); lastY = ev.clientY;
        paint(v);
        for (const x of m.maps) {
          const q = host.plugins.find((pp) => pp.id === x.pluginId), pr = q && q.params.find((r) => r.id === x.paramId);
          if (!pr) continue;
          const pv = x.lo + (x.hi - x.lo) * v;
          pr.value = pv;
          const kn = document.querySelector(`#cards .knob[data-plugin="${x.pluginId}"][data-param="${x.paramId}"]`);
          if (kn) setKnob(kn, pv);
          drawDevice(document.querySelector(`.card[data-plugin="${x.pluginId}"] .card-screen`), q);
          sendParam(x.pluginId, x.paramId, pv, first, kn);
        }
        first = false;
      };
      const up = () => { removeEventListener("mousemove", mv); removeEventListener("mouseup", up); k.classList.remove("active");
        m.value = v; run("setMacros", { ...fxTarget(host), macros: host.macros.map((y) => (y.id === m.id ? { ...y, value: v } : y)) }); };
      addEventListener("mousemove", mv); addEventListener("mouseup", up);
    });
    knobs.append(k);
  });
  card.append(head, knobs);
  return card;
}

function keyAnyOn(p) {
  return document.documentElement.classList.contains("kt2") && !window.KT2_KEYANY_OFF && !p.instrument && !p.keyable && !["ktpump", "ktside", "ktroom"].includes(p.type);
}
function keyChip(clip, p) {
  const lane = p.sidechain && ui.state.tracks.find((t) => t.id === p.sidechain);
  const b = el("button", "card-keychip" + (lane ? " on" : ""), lane ? "KEY \u00b7 " + lane.name : "KEY");
  if (lane) b.style.setProperty("--kc", colorOf(lane));
  b.title = lane ? `Fades out while ${lane.name} plays (${Math.round((p.scAmt != null ? p.scAmt : 0.7) * 100)}%). Click to change.` : "Sidechain: pick a sound that makes this effect fade out while it plays";
  b.onclick = (e) => {
    e.stopPropagation();
    const own = clip.track && clip.track.id, amt = p.scAmt != null ? p.scAmt : 0.7;
    showMenu(b, [
      { heading: "Fades out while this plays" },
      { label: "Nothing (always on)", on: !p.sidechain, run: () => run("setSidechain", { pluginId: p.id, trackId: "" }) },
      { sep: true },
      ...ui.state.tracks.filter((t) => t.id !== own).map((t) => ({ label: t.name, color: colorOf(t), on: p.sidechain === t.id, meta: t.muted ? "muted" : "",
        run: () => run("setSidechain", { pluginId: p.id, trackId: t.id }) })),
      ...(p.sidechain ? [{ sep: true }, { heading: "How far it fades" }, ...[0.3, 0.5, 0.7, 1].map((v) => ({ label: Math.round(v * 100) + "%", on: Math.abs(amt - v) < 0.01, run: () => run("setSidechainAmount", { pluginId: p.id, amount: v }) }))] : []),
    ]);
  };
  return b;
}

function sidechainPicker(clip, p) {
  const row = el("button", "card-key");
  row.title = "What makes it duck: the beat, or another lane's hits";
  row.append(el("span", null, "Ducks to"), el("b", null, sidechainName(p)), el("span", "caret", "\u25BE"));
  row.onclick = (e) => {
    e.stopPropagation();
    const own = clip.track.id;   // a lane can't duck to itself
    showMenu(row, [
      { heading: "Duck to" },
      { label: "Tempo", meta: "every " + (pt(p, /rate/i) || "1/4"), on: !p.sidechain, run: () => run("setSidechain", { pluginId: p.id, trackId: "" }) },
      { sep: true },
      ...ui.state.tracks.filter((t) => t.id !== own).map((t) => ({
        label: t.name, color: colorOf(t), on: p.sidechain === t.id, meta: t.muted ? "muted" : "",
        run: () => run("setSidechain", { pluginId: p.id, trackId: t.id }),
      })),
    ]);
  };
  return row;
}

// An idea card: looks like the real card, switched off. Click anywhere to put it on.
function ideaCard(clip, idea) {
  const fake = { id: "idea", name: idea.plugin, type: idea.entry.key, enabled: false,
                 params: (idea.knobs || []).map((q) => ({ ...q, name: q.id })) };
  const card = el("button", "card idea off");
  card.style.setProperty("--dc", deviceColor(fake));
  card.title = `${idea.why || idea.plugin}. Click to turn it on.`;
  const head = el("div", "card-head");
  head.append(el("span", "card-power"), el("div", "card-name", idea.label || idea.plugin),
              el("span", "card-tag", idea.label ? idea.plugin : "idea"));
  const screen = el("canvas", "card-screen");
  card.append(head, screen);
  const vals = el("div", "knobs");
  for (const q of (idea.knobs || []).slice(0, 3)) {
    const prm = fake.params.find((x) => x.id === q.id);
    const kb = el("div", "knob");
    kb.append(el("div", "k-name", knobName(PARAM_NAMES[q.id] || q.id)), el("div", "k-val", prm.text));
    vals.append(kb);
  }
  if (idea.knobs) card.append(vals);
  else card.append(el("div", "card-why", idea.why || ""));
  card.append(el("div", "card-on", "Turn on"));
  card.onclick = (e) => { e.stopPropagation(); turnOnIdea(clip, idea); };
  requestAnimationFrame(() => drawDevice(screen, fake));
  return card;
}
// Knob ids -> the short names the real cards show.
const PARAM_NAMES = { threshold: "Threshold", ratio: "Ratio", "output gain": "Output gain", intense: "Intense", max: "Max", freq: "Freq",
  "purp:delayTime": "Time", feedback: "Feedback", "mix proportion": "Mix proportion", pitch: "Pitch", formant: "Formant", mix: "Mix",
  size: "Size", decay: "Decay", depth: "Depth", rate: "Rate", release: "Release", bits: "Bits", drive: "Drive", highpass: "Highpass",
  outlevel: "Out", push: "Push", speed: "Speed", humanize: "Humanize", ceiling: "Ceiling", clip: "Clip", attack: "Attack", sustain: "Sustain", time: "Time", output: "Output",
  "Low-pass gain": "Low-shelf gain", "Mid gain 1": "Mid gain 1", "High-pass gain": "High-shelf gain" };

function refreshCard(p) {
  const card = document.querySelector(`.card[data-plugin="${p.id}"]`);
  if (!card) return;
  const tag = card.querySelector(".card-tag");
  if (tag && !p.instrument) tag.textContent = deviceTag(p);
  const picks = card.querySelectorAll(".tune-pick");
  if (picks.length === 2) {
    picks[0].textContent = TUNE_KEYS[tuneKey(p)] + " \u25BE";
    picks[1].textContent = TUNE_SCALES[tuneScale(p)] + " \u25BE";
  }
  const cv = card.querySelector(".card-screen");
  if (ui.dragging !== cv) drawDevice(cv, p);
  const key = card.querySelector(".card-key b");
  if (key) key.textContent = sidechainName(p);
}

// ---------------------------------------------------------------------------
// TUNR (KILLTOY's pitch corrector). Its card has the key and scale as two small
// pickers on top of a live pitch line: grey = what was sung, colour = what you hear.
// The line comes from the engine about 30 times a second (transport.tune).
const TUNE_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const TUNE_SCALES = ["Major", "Minor", "Chromatic"];
const TUNE_STEPS = [[0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]];
const tuneKey = (p) => Math.round(pv(p, /^key$/, 9 / 11) * 11);
const tuneScale = (p) => Math.round(pv(p, /^scale$/, 0) * 2);
const noteName = (m) => TUNE_KEYS[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
const tuneTrails = new Map(); // pluginId -> [[sung, heard, time]...], newest last

function tuneTag(p) {
  const t = tuneTrails.get(p.id), last = t && t[t.length - 1];
  return last && last[1] > 0 && performance.now() - last[2] < 400 ? noteName(last[1]) : "";
}

function tuneScreen(p, screen) {
  const wrap = el("div", "tune-screen");
  const pick = (text, title, items) => {
    const b = el("button", "tune-pick", text + " \u25BE");
    b.title = title;
    b.onclick = (e) => { e.stopPropagation(); showMenu(b, items()); };
    return b;
  };
  const set = (id, value) => run("setParam", { pluginId: p.id, paramId: id, value });
  const songKey = ui.state.key;
  const keyItems = () => [
    ...(songKey && songKey.tonic != null ? [{ label: `Song key: ${TUNE_KEYS[songKey.tonic]} ${songKey.minor ? "minor" : "major"}`, cta: true,
      run: async () => { await set("key", songKey.tonic / 11); await set("scale", songKey.minor ? 0.5 : 0); } }, { sep: true }] : []),
    { heading: "KEY" },
    ...TUNE_KEYS.map((k, i) => ({ label: k, on: i === tuneKey(p), run: () => set("key", i / 11) })),
  ];
  const scaleItems = () => [{ heading: "SCALE" },
    ...TUNE_SCALES.map((sc, i) => ({ label: sc, meta: ["happy, bright", "dark, sad", "every note"][i], on: i === tuneScale(p), run: () => set("scale", i / 2) }))];
  const pills = el("div", "tune-picks");
  pills.append(pick(TUNE_KEYS[tuneKey(p)], "The song's key", keyItems), pick(TUNE_SCALES[tuneScale(p)], "Which notes are allowed", scaleItems));
  wrap.append(screen, pills);
  return wrap;
}

// The live line when the voice is coming through, otherwise a picture of what Speed does:
// a smooth slide between notes (natural) or hard steps (robot).
function drawSnapTune(g, p, w, h, col, label) {
  const steps = TUNE_STEPS[tuneScale(p)], key = tuneKey(p);
  const trail = (tuneTrails.get(p.id) || []).filter((x) => performance.now() - x[2] < 3000);
  const live = trail.filter((x) => x[0] > 0);
  const top = 24, bottom = h - 6;
  if (live.length > 2 && performance.now() - trail[trail.length - 1][2] < 600) {
    const notes = live.flatMap((x) => [x[0], x[1]]);
    const mid = (Math.min(...notes) + Math.max(...notes)) / 2;
    const span = Math.max(7, Math.max(...notes) - Math.min(...notes) + 2);
    const y = (m) => bottom - ((m - (mid - span / 2)) / span) * (bottom - top);
    // The allowed notes as faint lines.
    for (let m = Math.floor(mid - span / 2); m <= Math.ceil(mid + span / 2); m++) {
      if (!steps.includes((((m - key) % 12) + 12) % 12)) continue;
      g.fillStyle = hexA(col, m % 12 === key ? 0.22 : 0.08);
      g.fillRect(0, Math.round(y(m)), w, 1);
    }
    const x = (t) => w - 4 - ((performance.now() - t) / 3000) * (w - 8);
    const path = (k, stroke, width) => {
      g.beginPath();
      let on = false;
      for (const pt of trail) {
        if (pt[k] <= 0) { on = false; continue; }
        on ? g.lineTo(x(pt[2]), y(pt[k])) : g.moveTo(x(pt[2]), y(pt[k]));
        on = true;
      }
      g.strokeStyle = stroke; g.lineWidth = width; g.stroke();
    };
    path(0, cssVar("--ink-3"), 1.2);
    path(1, col, 2);
    return;
  }
  const speed = pv(p, /^speed$/, 0.5);
  const tau = speed >= 0.99 ? 0 : Math.pow(10, -2.6 * speed) * 0.4;
  const pts = [];
  const levels = [0.25, 0.65, 0.45, 0.8];
  let v = levels[0];
  for (let px = 8; px <= w - 8; px += 1.5) {
    const seg = Math.min(3, Math.floor(((px - 8) / (w - 16)) * 4));
    const k = tau ? 1 - Math.exp(-1.5 / (tau * 900)) : 1;
    v += (levels[seg] - v) * k;
    pts.push([px, bottom - v * (bottom - top)]);
  }
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.strokeStyle = col; g.lineWidth = 2; g.stroke();
  label(speed >= 0.99 ? "robot" : speed > 0.7 ? "tight" : "natural", w - 8, h - 8, "right");
}

function feedTuneMeters(list) {
  if (!list || !list.length) return;
  const now = performance.now();
  for (const m of list) {
    const t = tuneTrails.get(m.id) || [];
    t.push([m.in, m.out, now]);
    while (t.length && now - t[0][2] > 3200) t.shift();
    tuneTrails.set(m.id, t);
    const card = document.querySelector(`.card[data-plugin="${m.id}"]`);
    if (!card) continue;
    const found = ui.state && findPlugin(m.id), p = found && found.p;
    if (!p) continue;
    drawDevice(card.querySelector(".card-screen"), p);
    const tag = card.querySelector(".card-tag");
    if (tag) tag.textContent = tuneTag(p);
  }
}


// TUNR's picture on the shared cards: up/down = Speed (top = robot), left/right = Humanize.
window.FxView.register("snaptune", {
  match: /ktsnaptune/,
  draw(d) { drawSnapTune(d.g, d.p, d.w, d.h, d.col, (t, x, y, align) => d.label(t, x, y, align)); },
  handles(d) {
    const sid = d.id(/^speed$/), hid = d.id(/^humanize$/);
    if (!sid) return [];
    return [{ x: d.X(hid ? d.v(hid, 0) : 0.5), y: d.Y(d.v(sid, 0.5)),
              label: () => "speed " + d.t(sid) + (hid ? "   humanize " + d.t(hid) : ""),
              drag: (px, py) => ({ [sid]: d.V(py), ...(hid ? { [hid]: d.U(px) } : {}) }) }];
  },
});

// The picture on each card (and in the plugin window): ui/fxview.js draws it and makes it
// draggable.
function drawDevice(cv, p) {
  if (cv && p) window.FxView.draw(cv, p);
}

// Wires a card's (or the plugin window's) picture to the knobs: dragging it sets them.
function grabbable(cv, pid) {
  cv.dataset.fx = pid;
  window.FxView.attach(cv, () => { const hit = findPlugin(pid); return hit && hit.p; },
    (paramId, value, first) => sendParam(pid, paramId, value, first),
    (vals) => {
      for (const [paramId, v] of Object.entries(vals))
        document.querySelectorAll(`.knob[data-plugin="${pid}"][data-param="${CSS.escape(paramId)}"]`).forEach((k) => setKnob(k, v));
    });
}

// "Open its window": the app opens the plugin's own window. Built-ins with no window of
// their own (and everything in the browser playground) get a KILLTOY panel with every knob.
async function openPluginWindow(p) {
  const hit = p.instrument && findPlugin(p.id);
  if (hit && hit.t.kind !== "beat") return openLaneWindow({ t: hit.t, clip: hit.c, plugin: hit.p, view: "inst" });
  const r = await run("openPlugin", { pluginId: p.id });
  if (r && r.toyTune && window.KT2ToyTune) return KT2ToyTune.open(p);   // TOYTUNE (ui/kt2-toytune.js, 16 Nov)
  if (r && r.toyVox && window.KT2ToyVox) return KT2ToyVox.open(p);   // TOY VOX (ui/kt2-toyvox.js, 24 Nov)
  if (r && r.toyMachine3 && window.openToyMachine3) return openToyMachine3(p);   // TOY MACHINE V3 (playground/tm3-web.js, 27 Nov)
  if (r && r.toyMachine2 && window.openToyMachine2) return openToyMachine2(p);   // TOY MACHINE V2 (ui/tm2-window.js, 26 Nov)
  if (r && r.toyGtr && window.openToyGtr) return openToyGtr(p);   // TOY GTR (ui/toygtr.js, 13 Nov)
  if (r && r.toyKeys && window.openToyKeys) return openToyKeys(p);
  if (r && r.toyMachine) return openToyMachine(p);
  if (r && r.panel) showPluginPanel(p.id);
}

// TOY MACHINE, KILLTOY's own synth: its window (ui/toymachine.js) over the whole screen. The
// sound runs in the engine (the app's C++, or toy-machine.wasm in the playground); the window
// edits the preset and sends it back through these commands.
let tmWin = null;
// Undo / redo. When it brings back an older TOY MACHINE sound, the open window shows it too.
async function undoRedo(redo) {
  const r = await run(redo ? "redo" : "undo");
  // an open synth or effect window shows the undone edit right away
  try { if (ui.plugwin && typeof renderPluginPanel === "function") renderPluginPanel(true); } catch (e) { /* fine */ }
  try { if (!$("iw").hidden && !(r && r.toyRestored)) refreshLaneWindow(); } catch (e) { /* fine */ }
  if (!r || !r.toyRestored || !tmWin || !tmWin.win) return r;
  const w = tmWin, got = await run("toyMachineGetPreset", { pluginId: w.pid });
  if (got && got.preset && tmWin === w && typeof w.win.setPreset === "function") w.win.setPreset(got.preset);
  return r;
}
// With `into`, it fills that element (the synth tab of a MIDI lane's window) instead.
async function openToyMachine(p, into, wanted = () => true) {
  if (!window.ToyMachineUI) return toast("The TOY MACHINE window didn't load.", true);
  const pid = p.id, hit = findPlugin(pid);
  const got = await run("toyMachineGetPreset", { pluginId: pid });
  if (!got || got.error || !wanted()) return;
  closeToyMachine();
  const host = el("div", into ? "iw-tm" : "tm-host");
  if (!into) host.addEventListener("mousedown", (e) => { if (e.target === host) closeToyMachine(); });
  (into || document.body).append(host);
  const index = await booth("toyMachinePresets", {});
  if (!wanted()) return host.remove();
  const bytes64 = (f32) => { const b = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const send = (cmd, args) => booth(cmd, { pluginId: pid, ...args });
  // The window reads the meter synchronously, so poll the engine and keep the last answer.
  let lastMeter = null;
  const meterTimer = setInterval(async () => { const m = await send("toyMachineMeter", {}); if (m && m.ok) lastMeter = m; }, 50);
  const win = window.ToyMachineUI.open(host, {
    preset: got.preset,
    presetIndex: (index && index.presets) || [],
    loadPreset: async (entry) => { const r = await run("toyMachineLoadPreset", { id: entry.id, file: entry.file }); return r && r.preset; },
    title: hit ? hit.t.name : "",
    // in a lane window the window's own VST / CREATE SOUND tabs switch it (laneTmMode)
    hostModeTabs: !!(into && $("iw-tab-create") && !window.KT2_TM_CREATE_TAB_OLD),
    // CREATE: its nest is kept per synth (closing the window keeps it); SAVE goes back to the VST tab
    createKey: pid,
    onModeRequest: (m) => { if (m === "presets" && $("iw-tab-inst") && into && !window.KT2_TM_CREATE_TAB_OLD) $("iw-tab-inst").click(); else if (win && win.setMode) win.setMode(m); },
    api: {
      setPreset: (preset) => send("toyMachineSetPreset", { preset }),
      setMacro: (index, value) => send("toyMachineSetMacro", { index, value }),
      setPads: (pads) => pads.forEach((d, i) => d.kind && d.kind !== "macro" && d.pos && send("toyMachineSetPad", { index: i, x: d.pos[0], y: d.pos[1], star: d.star || null })),
      noteOn: (pitch, velocity) => send("toyMachineNote", { pitch, velocity, on: true }),
      noteOff: (pitch) => send("toyMachineNote", { pitch, on: false }),
      pitchBend: (value) => send("toyMachineBend", { value }),
      modWheel: (value) => send("toyMachineWheel", { value }),
      audition: (preset) => booth("toyMachineAudition", { pluginId: pid, preset }),
      setSample: (smp) => smp && smp.data && send("toyMachineSetSample", { data: bytes64(smp.data), sampleRate: smp.sampleRate, name: smp.name }),
      getSamplePeaks: () => booth("toyMachineSamplePeaks", { pluginId: pid }),
      getBpm: () => bpm(),
      setDropSample: (slot, smp) => smp && smp.data && send("toyMachineSetDropSample", { slot, id: smp.id, data: bytes64(smp.data), sampleRate: smp.sampleRate, name: smp.name }),
      meter: () => lastMeter,
    },
    // Right-click Cutoff or Release: automate it on this lane (a line under the lane, like Ableton).
    // Right-click (a menu) or its "A" button (info.direct: straight in; info.params: several lanes at once).
    onAutomate: (info, e) => {
      const h = findPlugin(pid);
      if (!h || !h.t || !ui.state.canAutomate) return;
      const list = info.params || [info];
      if (info.direct) return automateNow(h.t, list.map((x) => ({ target: { type: "synth", param: x.param }, label: x.label, value: x.value })));
      automateItemMenu(atMouse(e), h.t, { type: "synth", param: info.param }, info.label + " \u00b7 TOY MACHINE", info.value);
    },
    // Which of these params have a line on this lane, and Show / Clear them (TOY MACHINE's point menu, Zed call 2, 7 Nov)
    autoHas: (params) => { const h = findPlugin(pid); return !!(h && h.t && (h.t.automation || []).some((l) => l.target && l.target.type === "synth" && params.includes(l.target.param))); },
    autoShowLanes: (params) => { const h = findPlugin(pid); if (!h || !h.t) return; const l = (h.t.automation || []).find((x) => x.target && x.target.type === "synth" && params.includes(x.target.param)); run("showAutomation", { trackId: h.t.id, show: true }).then(() => l && flashAuto(l.id)); },
    autoClear: async (params) => {
      const h = findPlugin(pid); if (!h || !h.t) return;
      const ls = (h.t.automation || []).filter((x) => x.target && x.target.type === "synth" && params.includes(x.target.param));
      for (const l of ls) await run("removeAutomation", { trackId: h.t.id, laneId: l.id });
      if (ls.length) toast("Automation cleared.");
    },
    // A hand move on the synth: recorded when the lane is armed and the song plays.
    onTouch: (info) => { const h = findPlugin(pid); if (h && h.t) autoTouch(h.t, { type: "synth", param: info.param }, info.value, info.label, info.end); },
    onSave: async (preset) => { const r = await run("toyMachineSavePreset", { pluginId: pid, preset }); if (r && r.ok) toast("Saved to your TOY MACHINE presets."); },
    // (closeToyMachine clears tmWin before closing the window, so this only runs for its own X)
    onClose: () => (into ? tmWin && tmWin.pid === pid && closeLaneWindow() : closeToyMachine()),
  });
  tmWin = { pid, host, win, meterTimer };
  if (into && !window.KT2_CS_KEEP_OLD && iw && iw.tmMode === "create") laneTmMode();   // back on CREATE
  addPlayMode(host.querySelector(".tm-topright"), pid);
  const root = host.querySelector(".tm-root");
  if (root) root.focus({ preventScroll: true }); // so the computer keyboard plays it straight away
}
// The computer keyboard plays TOY MACHINE whenever it shows, even when the last click was on
// the piano roll or a tab (focus elsewhere): letter keys are passed on to the synth.
for (const type of ["keydown", "keyup"]) window.addEventListener(type, (e) => {
  const root = tmWin && tmWin.host.querySelector(".tm-root, .tk-root");   // TOY KEYS (ui/toykeys.js) too
  if (!root || !root.offsetParent || root.contains(e.target) || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (document.querySelector(".kae")) return;   // the audio editor box (KILLTOY 2) has the keys while it's open
  if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || e.key === " ") return;
  e.preventDefault();
  e.stopImmediatePropagation();
  root.dispatchEvent(new KeyboardEvent(type, { key: e.key, code: e.code, repeat: e.repeat, cancelable: true }));
}, true);
// SOLO | FULL (Eman, 27 Oct; FL Studio's pattern / song): SOLO loops this lane's clip on its own, FULL
// plays the song from the marker. KILLDRUM's BEAT tab has the same switch; both keep one choice.
function addPlayMode(bar, pid) {
  if (!bar) return;
  const key = "killtoy.playMode", get = () => { try { return localStorage.getItem(key) === "full" ? "full" : "solo"; } catch (e) { return "solo"; } };
  const box = el("div", "tm-pmode");
  box.innerHTML = `<div class="tm-pseg" title="SOLO: loop this part on its own. FULL: play it inside the song from the marker"><button data-m="solo">Loop</button><button data-m="full">Track</button></div>
    <button type="button" class="tm-iconbtn tm-pplay" title="Play / stop"><svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M4.5 3.2v9.6L12.5 8z"/></svg></button>`;
  let solo = false;
  const paint = () => { for (const b of box.querySelectorAll("[data-m]")) b.classList.toggle("tm-on", b.dataset.m === get()); };
  const playing = () => !!(ui.transport && ui.transport.playing);
  const stop = async () => { if (solo) { solo = false; await booth("laneSolo", { pluginId: pid, on: false }); } else if (playing()) await run("togglePlay"); };
  const start = async () => {
    if (get() === "solo") { const r = await booth("laneSolo", { pluginId: pid }); if (r && r.ok) { solo = true; return; } }
    await run("togglePlay");
  };
  box.querySelector(".tm-pplay").onclick = async () => { if (solo || playing()) await stop(); else await start(); };
  for (const b of box.querySelectorAll("[data-m]")) b.onclick = async () => {
    if (b.dataset.m === get()) return;
    try { localStorage.setItem(key, b.dataset.m); } catch (e) { /* fine */ }
    paint(); if (solo || playing()) { await stop(); await start(); }
  };
  const tick = setInterval(() => { if (!box.isConnected) return clearInterval(tick); if (solo && !playing()) solo = false; box.querySelector(".tm-pplay").classList.toggle("tm-on", playing()); }, 200);
  paint(); bar.prepend(box);
}
function closeToyMachine() {
  if (!tmWin) return;
  const w = tmWin;
  tmWin = null;
  clearInterval(w.meterTimer);
  unfoldLaneHead(); // the lane window's tabs may sit in this window's top bar
  try { w.win.close(); } catch (e) { /* already closed */ }
  w.host.remove();
  booth("toyMachineClose", { pluginId: w.pid });
}

// KILLDRUM, KILLTOY's drum machine (ui/killdrum.js), in the synth tab of a drum lane's window.
// The window edits the lane's kit and sends it back whole (killDrumSet); pads play through killDrumHit.
let kdWin = null;
async function openKillDrum(p, into, wanted = () => true) {
  const pid = p.id;
  const got = await run("killDrumGet", { pluginId: pid });
  if (!got || got.error || !wanted()) return;
  closeKillDrum();
  const host = el("div", "iw-tm");
  into.append(host);
  const win = window.KillDrumUI.open(host, {
    kit: got.kit, used: got.used, title: got.lane, pluginId: pid,
    api: {
      setKit: (kit, undo) => booth("killDrumSet", { pluginId: pid, kit, undo: undo !== false }),
      hit: (pitch, velocity, extra) => booth("killDrumHit", { pluginId: pid, pitch, velocity, ...(extra || {}) }),
      peaks: (url) => booth("killDrumPeaks", { url }),
      // the window's Undo / Redo buttons: the song's undo, like Cmd+Z (the window re-reads the lane after)
      undo: () => undoRedo(false),
      redo: () => undoRedo(true),
    },
    onClose: () => closeLaneWindow(),
  });
  kdWin = { pid, host, win };
  window.killDrumWindow = win; // the assistant's killdrum tool talks to the open window
  const root = host.querySelector(".kd-root");
  if (root) root.focus({ preventScroll: true });
}
async function refreshKillDrum() {
  const w = kdWin;
  const got = w && await booth("killDrumGet", { pluginId: w.pid });
  if (w && kdWin === w && got && got.kit) w.win.setKit(got.kit);
}
function closeKillDrum() {
  if (!kdWin) return;
  const w = kdWin;
  kdWin = null; window.killDrumWindow = null;
  unfoldLaneHead();
  try { w.win.close(); } catch (e) { /* gone */ }
  w.host.remove();
}

const findPlugin = (pid) => {
  const m = ui.state && ui.state.master && ui.state.master.plugins.find((x) => x.id === pid);
  if (m) return { p: m, c: null, t: masterTrack() };
  for (const r of (ui.state && ui.state.returns) || []) { const p = (r.plugins || []).find((x) => x.id === pid); if (p) return { p, c: null, t: killtoyReturns.track(r.id) }; }
  for (const t of ui.state ? ui.state.tracks : []) {
    const lp = (t.plugins || []).find((x) => x.id === pid);
    if (lp) return { p: lp, c: null, t };
    for (const c of t.clips) { const p = c.plugins.find((x) => x.id === pid); if (p) return { p, c, t }; }
  }
  return null;
};

const plugCard = document.querySelector("#plugwin .plug-card");
const plugCardAway = () => plugCard.parentNode !== $("plugwin");

function showPluginPanel(pid, into) {
  const hit = findPlugin(pid);
  if (!hit) return;
  const { p, t } = hit;
  // Instrument keys play the clip open in the piano roll when the synth sits on the lane.
  const c = hit.c || (ui.roll && findClip(ui.roll.clipId));
  ui.plugwin = { pid, sig: "" };
  if (into) into.append(plugCard);
  else { $("plugwin").append(plugCard); $("plugwin").hidden = false; }
  $("plugwin-ext").hidden = !(into && iw && iw.native);
  hidePop();
  $("plugwin-name").textContent = p.name;
  $("plugwin-dot").style.setProperty("--c", deviceColor(p));
  $("plugwin-sub").textContent = p.instrument ? `instrument \u00b7 ${t.name}` : c ? `on ${c.name}` : `on the ${t.name} lane`;
  $("plugwin-reset").hidden = !p.params.some((x) => x.def != null);
  // Instruments get a strip of keys to hear the sound while you turn the knobs.
  const keys = $("plugwin-keys");
  keys.replaceChildren();
  keys.hidden = !(p.instrument && c && c.kind === "midi");
  if (!keys.hidden) {
    const ps = (c.notes || []).map((n) => n.pitch);
    const lo = ps.length ? Math.min(...ps) - (Math.min(...ps) % 12) : 48;
    for (let k = lo; k < lo + 24; k++) {
      const b = el("button", isBlackKey(k) ? "black" : "", k % 12 === 0 ? "C" + (Math.floor(k / 12) - 1) : "");
      b.onmousedown = (e) => {
        e.preventDefault();
        b.classList.add("on");
        booth("previewNote", { clipId: c.id, pitch: k, velocity: 110 });
        const up = () => { window.removeEventListener("mouseup", up); b.classList.remove("on"); booth("previewNoteOff", {}); };
        window.addEventListener("mouseup", up);
      };
      keys.append(b);
    }
  }
  renderPluginPanel(true);
}

function renderPluginPanel(force) {
  const w = ui.plugwin;
  if (!w) return;
  const hit = findPlugin(w.pid);
  if (!hit) { if (plugCardAway()) { ui.plugwin = null; return; } return closePluginPanel(); }
  const p = hit.p, box = $("plugwin-knobs");
  const sig = p.params.map((x) => x.id).join(",");
  if (force || sig !== w.sig) {
    w.sig = sig;
    box.replaceChildren(...p.params.map((prm) => makeKnob(p, prm)));
  } else if (!ui.dragging) {
    for (const prm of p.params) {
      const k = box.querySelector(`.knob[data-param="${CSS.escape(prm.id)}"]`);
      if (k) setKnob(k, prm.value, prm.text);
    }
  }
  grabbable($("plugwin-screen"), p.id);
  if (ui.dragging !== $("plugwin-screen")) drawDevice($("plugwin-screen"), p);
}

function closePluginPanel() {
  ui.plugwin = null;
  $("plugwin").hidden = true;
  if (plugCardAway()) closeLaneWindow(); // Done or Escape on the synth tab closes the whole window
}
$("plugwin-ext").onclick = () => ui.plugwin && run("openPlugin", { pluginId: ui.plugwin.pid });
$("plugwin-done").onclick = closePluginPanel;
// Undo / redo arrows in the top of every synth and effect window (Eman, 4 Nov 23:24): the same
// steps as Cmd+Z and Cmd+Shift+Z, so they undo what you did inside the window
function undoArrows() {
  const box = el("span", "k2-ur");
  const mk = (redo) => {
    const b = el("button", "k2-ur-b " + (redo ? "redo" : "undo"));
    b.title = redo ? "Redo (Cmd+Shift+Z)" : "Undo (Cmd+Z)";
    b.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (redo ? '<path d="M11 3l3 3-3 3"/><path d="M14 6H6a4 4 0 0 0 0 8h3"/>' : '<path d="M5 3L2 6l3 3"/><path d="M2 6h8a4 4 0 0 1 0 8H7"/>') + "</svg>";
    b.addEventListener("mousedown", (e) => e.stopPropagation());
    b.onclick = (e) => { e.stopPropagation(); undoRedo(redo); };
    return b;
  };
  box.append(mk(false), mk(true));
  return box;
}
function paintUndoArrows() {
  const s = ui.state || {};
  document.querySelectorAll(".k2-ur .undo").forEach((b) => b.classList.toggle("dim", s.canUndo === false));
  document.querySelectorAll(".k2-ur .redo").forEach((b) => b.classList.toggle("dim", s.canRedo === false));
}
(function () {
  const iwEnd = document.querySelector("#iw .iw-end"), pw = document.querySelector("#plugwin .tune-actions");
  if (iwEnd) iwEnd.prepend(undoArrows());
  if (pw) pw.prepend(undoArrows());
  setInterval(paintUndoArrows, 400);
})();
$("plugwin").addEventListener("mousedown", (e) => { if (e.target === $("plugwin")) closePluginPanel(); });
$("plugwin-reset").onclick = () => {
  const hit = ui.plugwin && findPlugin(ui.plugwin.pid);
  if (!hit) return;
  for (const prm of hit.p.params) if (prm.def != null) booth("setParam", { pluginId: hit.p.id, paramId: prm.id, value: prm.def, begin: true });
};

function makeKnob(p, prm) {
  const k = el("div", "knob");
  k.dataset.plugin = p.id;
  k.dataset.param = prm.id;
  k.title = "Drag up or down (Shift for fine), or scroll. Right-click to automate";
  k.addEventListener("contextmenu", (e) => {
    const hit = findPlugin(p.id);
    const macro = macroItems(p, prm);
    if (!ui.state.canAutomate || !hit || !hit.t || hit.t.kind === "beat") {
      if (macro.length) { e.preventDefault(); e.stopPropagation(); showMenu(atMouse(e), [{ heading: knobName(prm.name).toUpperCase() }, ...macro]); }
      return;
    }
    e.preventDefault(); e.stopPropagation();
    automateItemMenu(atMouse(e), hit.t, { type: "fx", pluginId: p.autoOf || p.id, paramId: prm.id }, `${knobName(prm.name)} \u00b7 ${p.name}`, prm.value, macro);
  });
  k.append(el("div", "k-name", knobName(prm.name)), el("div", "k-val", prm.text));
  setKnob(k, prm.value, prm.text);
  // "A": this knob gets its own automation lane under its track, straight away.
  const knobHit = findPlugin(p.id), knobTarget = { type: "fx", pluginId: p.autoOf || p.id, paramId: prm.id };
  const knobTrack = knobHit && knobHit.t && knobHit.t.kind !== "beat" ? knobHit.t : null;
  if (knobTrack && ui.state.canAutomate) {
    const has = (knobTrack.automation || []).some((l) => KillToyAuto.sameTarget(l.target, knobTarget));
    const ab = el("button", "k-auto" + (has ? " on" : ""), "A");
    ab.title = has ? "Automated: click to show its line" : "Automate this knob: a line for it appears under the lane";
    ab.addEventListener("mousedown", (e) => e.stopPropagation());
    ab.addEventListener("click", (e) => { e.stopPropagation(); automateNow(knobTrack, [{ target: knobTarget, label: `${knobName(prm.name)} \u00b7 ${p.name}`, value: prm.value }]); });
    k.append(ab);
  }

  const live = (value) => {
    prm.value = value;
    drawDevice(document.querySelector(`.card[data-plugin="${p.id}"] .card-screen`), p);
  };

  k.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    let value = Number(k.dataset.value);
    let lastY = e.clientY;
    let first = true;
    ui.dragging = k;
    k.classList.add("active");

    const onMove = (ev) => {
      const fine = ev.shiftKey ? 0.2 : 1;
      value = Math.min(1, Math.max(0, value + (lastY - ev.clientY) * 0.005 * fine));
      lastY = ev.clientY;
      setKnob(k, value);
      live(value);
      sendParam(p.id, prm.id, value, first, k);
      if (knobTrack) autoTouch(knobTrack, knobTarget, value, `${knobName(prm.name)} \u00b7 ${p.name}`);
      first = false;
    };
    const onUp = () => {
      if (knobTrack) autoTouch(knobTrack, knobTarget, value, `${knobName(prm.name)} \u00b7 ${p.name}`, true);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      k.classList.remove("active");
      ui.dragging = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  let wheelAt = 0; // notches less than half a second apart are one undo step
  k.addEventListener("wheel", (e) => {
    e.preventDefault();
    const value = Math.min(1, Math.max(0, Number(k.dataset.value) - Math.sign(e.deltaY) * 0.02));
    setKnob(k, value);
    live(value);
    const now = performance.now();
    sendParam(p.id, prm.id, value, now - wheelAt > 500, k);
    wheelAt = now;
  }, { passive: false });
  return k;
}

function setKnob(k, v, text) {
  k.dataset.value = v;
  k.style.setProperty("--v", v);
  if (text != null) k.querySelector(".k-val").textContent = text;
}

// One request in flight per knob; the newest value wins.
const paramQueue = new Map();
function sendParam(pluginId, paramId, value, begin, knob) {
  const key = pluginId + "|" + paramId;
  const q = paramQueue.get(key) || { busy: false, next: null, begin: false };
  q.next = value;
  q.begin = q.begin || begin;
  paramQueue.set(key, q);
  if (q.busy) return;

  const pump = async () => {
    q.busy = true;
    while (q.next != null) {
      const v = q.next, b = q.begin;
      q.next = null; q.begin = false;
      const r = await booth("setParam", { pluginId, paramId, value: v, begin: b });
      if (r && r.text) {
        // Every place showing this knob: the card, the plugin window, the picture's bubble.
        document.querySelectorAll(`.knob[data-plugin="${pluginId}"][data-param="${CSS.escape(paramId)}"] .k-val`).forEach((x) => (x.textContent = r.text));
        if (knob && !knob.dataset.plugin) knob.querySelector(".k-val").textContent = r.text;
        const hit = findPlugin(pluginId), q = hit && hit.p.params.find((x) => x.id === paramId);
        if (q) q.text = r.text;
        window.FxView.redraw(pluginId);
      }
    }
    q.busy = false;
  };
  pump();
}

// ---------------------------------------------------------------------------
// Popovers
function showMenu(anchor, items, opts = {}) {
  const pop = $("pop");
  pop.replaceChildren();
  // line icons in front of the items (KILLTOY 2 sets window.KT2_MENU_ICONS: [[regex, svg inner], ...])
  const iconOf = (it) => it.icon || (window.KT2_MENU_ICONS && it.label ? (KT2_MENU_ICONS.find((x) => x[0].test(it.label)) || [])[1] : null);
  const iconed = items.some((it) => !it.sep && !it.heading && !it.swatches && iconOf(it));
  pop.classList.toggle("iconed", iconed);
  for (const it of items) {
    if (it.sep) { pop.append(el("div", "sep")); continue; }
    if (it.heading) { pop.append(el("div", "label", it.heading)); continue; }
    if (it.swatches) { // one row of colour dots (KILLTOY 2 clip menu); + opens the full colour picker
      const row = el("div", "swatch-row");
      for (const c of it.swatches) {
        const d = el("button", "sw" + (c === it.current ? " on" : ""));
        d.style.setProperty("--sw", c); d.title = it.tip || "Colour";
        d.onclick = (e) => { e.stopPropagation(); hidePop(); it.pick(c); };
        d.onmouseenter = () => { if (it.preview) it.preview(c); };
        row.append(d);
      }
      if (it.custom) {
        const lab = el("label", "sw sw-custom"); lab.title = "Custom colour";
        const inp = el("input"); inp.type = "color"; inp.value = it.current && /^#[0-9a-f]{6}$/i.test(it.current) ? it.current : "#b79cff";
        inp.onclick = (e) => e.stopPropagation();
        // the clip changes while you move round the colour box, not only when it closes (Eman, 4 Nov)
        let live = false;
        inp.oninput = () => { it.pick(inp.value, live); live = true; };
        inp.onchange = () => { hidePop(); if (!live) it.pick(inp.value); };
        lab.append(inp); row.append(lab);
      }
      pop.append(row);
      continue;
    }
    const b = el("button", "item" + (it.on ? " on" : "") + (it.danger ? " danger" : "") + (it.cta ? " cta" : "") + (it.disabled ? " dim" : ""));
    if (iconed) { const ic = el("span", "mic"), sv = iconOf(it); if (sv) ic.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="square">' + sv + "</svg>"; b.append(ic); }
    if (it.color) { const d = el("span", "dot"); d.style.setProperty("--c", it.color); b.append(d); }
    b.append(document.createTextNode(it.label));
    if (it.meta) b.append(el("span", "meta", it.meta));
    if (it.disabled) { b.title = it.disabled; b.onclick = (e) => { e.stopPropagation(); toast(it.disabled); }; pop.append(b); continue; }   // shown greyed, says why
    b.onclick = (e) => { e.stopPropagation(); hidePop(); it.run(); };
    pop.append(b);
  }
  placePop(anchor, opts.above);
}

// where the last press was: a menu whose button was re-drawn away opens there instead of the corner
document.addEventListener("pointerdown", (e) => { ui.lastPointer = { x: e.clientX, y: e.clientY }; }, true);
function placePop(anchor, above) {
  const pop = $("pop");
  pop.classList.remove("source", "var-box");
  pop.hidden = false;
  const r = anchor && anchor.isConnected ? anchor.getBoundingClientRect() : (ui.lastPointer ? { left: ui.lastPointer.x, right: ui.lastPointer.x, top: ui.lastPointer.y, bottom: ui.lastPointer.y } : anchor.getBoundingClientRect());
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(window.innerWidth - pw - 10, Math.max(10, r.left));
  let top = above || r.bottom + ph + 8 > window.innerHeight ? r.top - ph - 8 : r.bottom + 6;
  pop.style.left = left + "px";
  pop.style.top = Math.max(10, top) + "px";
}

function hidePop() { $("pop").hidden = true; $("pop").classList.remove("source", "var-box"); }

function showRoleMenu(anchor, t) {
  showMenu(anchor, [
    { heading: "This lane is for" },
    ...ROLES.map((r) => ({ label: r.name, color: r.color, on: r.id === t.role, meta: r.sub, run: () => run("setTrackRole", { trackId: t.id, role: r.id }) })),
    { sep: true },
    { label: "Rename\u2026", run: () => {
      const n = document.querySelector(`.row[data-track-id="${t.id}"] .head-name`);
      if (n) inlineEdit(n, t.name, (v) => run("renameTrack", { trackId: t.id, name: v }));
    } },
    { label: "Colour\u2026", color: colorOf(t), run: () => showColorMenu(anchor, t) },
    { label: "Delete lane", danger: true, run: () => run("deleteTrack", { trackId: t.id }) },
  ]);
}

function showColorMenu(anchor, t) {
  showMenu(anchor, [
    { heading: "Lane colour" },
    { label: "Automatic", color: ui.autoColors && ui.autoColors.get(t.id), on: !t.color, run: () => run("setTrackColor", { trackId: t.id, color: "" }) },
    ...LANE_COLORS.map((c, i) => ({ label: COLOR_NAMES[i], color: c, on: t.color === c, run: () => run("setTrackColor", { trackId: t.id, color: c }) })),
  ]);
}

// How a lane was made: hold its dot. Songs Claude made carry a "source" per lane (in
// their session.json): the Splice files, own synths and original stems it came from, plus
// the effects used when it was rendered. Lanes without one say what they hold.
const SOURCE_KINDS = {
  splice: "Splice", synth: "Claude synth", original: "Original", elevenlabs: "ElevenLabs",
  sample: "Sample", recording: "Recorded", mix: "Mix",
};
const HOLD_MS = 450;
ui.heldUntil = 0; // clicks before this time end a hold, so they don't also open the lane menu

function holdForSource(badge, t) {
  let timer = 0, x0 = 0, y0 = 0;
  const cancel = () => { clearTimeout(timer); timer = 0; badge.classList.remove("holding"); };
  badge.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY;
    badge.classList.add("holding");
    const head = badge.closest(".head") || badge;
    const rect = head.getBoundingClientRect(); // the panel opens beside the lane card
    timer = setTimeout(() => {
      timer = 0;
      badge.classList.remove("holding");
      ui.heldUntil = performance.now() + 60000; // until the finger or button lifts
      showSource(rect, t);
    }, HOLD_MS);
  });
  badge.addEventListener("pointermove", (e) => { if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancel(); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) badge.addEventListener(ev, cancel);
  badge.addEventListener("contextmenu", (e) => { if (timer || performance.now() < ui.heldUntil) { e.preventDefault(); e.stopPropagation(); } });
}

window.addEventListener("pointerup", () => { if (ui.heldUntil > performance.now()) ui.heldUntil = performance.now() + 400; }, true);

function sourceOf(t) {
  if (t.source) return t.source;
  const n = t.clips.length;
  if (t.kind === "beat") return { summary: n ? "The beat you loaded into this session." : "No beat loaded yet.", parts: n ? [{ kind: "sample", name: t.clips[0].name }] : [] };
  if (t.kind === "inst") return { summary: `Notes you played or drew, on ${t.instrument || "no instrument yet"}.`, parts: [] };
  return { summary: n ? `${n} clip${n > 1 ? "s" : ""} on this lane. No notes yet on how ${n > 1 ? "they were" : "it was"} made.` : "Nothing on this lane yet.", parts: [] };
}

function showSource(rect, t) {
  const src = sourceOf(t);
  const pop = $("pop");
  pop.replaceChildren();
  pop.classList.add("source");
  const head = el("div", "src-head");
  const dot = el("span", "dot");
  dot.style.setProperty("--c", colorOf(t));
  head.append(dot, el("b", null, t.kind === "beat" ? "Reference" : t.name), el("span", "src-cap", "How it was made"));
  pop.append(head);
  if (src.summary) pop.append(el("div", "src-sum", src.summary));
  if (src.parts && src.parts.length) {
    const list = el("div", "src-parts");
    for (const p of src.parts) {
      const row = el("div", "src-part");
      row.append(el("span", "src-kind k-" + (SOURCE_KINDS[p.kind] ? p.kind : "sample"), SOURCE_KINDS[p.kind] || p.kind));
      const txt = el("div", "src-txt");
      txt.append(el("div", "src-name", p.name));
      if (p.note) txt.append(el("div", "src-note", p.note));
      row.append(txt);
      list.append(row);
    }
    pop.append(list);
  }
  if (src.fx && src.fx.length) {
    pop.append(el("div", "label", "Effects"));
    const fx = el("div", "src-fx");
    for (const f of src.fx) fx.append(el("span", null, f));
    pop.append(fx);
  }
  if (src.made) pop.append(el("div", "src-made", src.made));
  pop.hidden = false;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.max(10, Math.min(window.innerWidth - pw - 10, rect.right + 10)) + "px";
  pop.style.top = Math.max(10, Math.min(window.innerHeight - ph - 10, rect.top)) + "px";
}

// Opens a TOY MACHINE lane's synth. A brand-new lane has no clip yet, and in the browser the synth
// rides on its clips: make a 4-bar MIDI clip at the marker's bar first, so the window always opens.
async function openLaneSynth(trackId) {
  const synthOf = (t) => t && [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins || [])].find((x) => x.instrument || /toy machine/i.test(x.name || ""));
  let p = synthOf(ui.state.tracks.find((x) => x.id === trackId));
  if (!p) {
    const pos = (ui.transport && ui.transport.position) || 0;
    const r = await run("newMidiClip", { trackId, start: Math.floor(pos / secPerBar() + 1e-6) * secPerBar(), bars: NEW_PATTERN_BARS() });
    if (!r || !r.ok) return;
    const fresh = await booth("getState", {});
    if (fresh && fresh.tracks) ui.state = fresh;
    p = synthOf(ui.state.tracks.find((x) => x.id === trackId));
  }
  if (p) openPluginWindow(p); else toast("TOY MACHINE didn't load on this lane. Try picking it again from the lane's dot.", true);
}

// Instruments: the built-in synth plus any VST3 / AU instruments found on this Mac.
// Instruments that aren't KILLTOY's own (4OSC, Serum, scanned VST3/AU) are parked for now (Eman, 2026-10-28).
// Flip this back on to show them and "Find my plugins" in the + Instrument menu again.
const SHOW_OTHER_INSTRUMENTS = false;
const isOwnPlugin = (p) => p.group === "KILLTOY";

async function showInstrumentMenu(anchor, track) {
  const instruments = (await loadPlugins()).filter((p) => p.instrument && (SHOW_OTHER_INSTRUMENTS || isOwnPlugin(p)));
  const items = [{ heading: track ? "Instrument for this lane" : "New instrument lane" }];
  for (const p of instruments.slice(0, 30)) {
    items.push({
      label: p.name, meta: p.group || "", on: !!track && track.instrument === p.name,
      run: () => track ? run("setInstrument", { trackId: track.id, key: p.key }).then(() => { if (/toy machine/i.test(p.name)) openLaneSynth(track.id); })
                       : run("newInstrumentLane", { key: p.key }).then((r) => {
                           if (!(r && r.ok)) return;
                           if (r.trackId) selectTrack(r.trackId);
                           // TOY MACHINE opens straight away: its landscape, presets and keyboard
                           if (/toy machine/i.test(p.name)) return openLaneSynth(r.trackId);
                           if (/toy drums|killdrum/i.test(p.name)) { // a 4-bar clip with a starter beat, open in the piano roll
                             const pos = (ui.transport && ui.transport.position) || 0;
                             return run("newMidiClip", { trackId: r.trackId, start: Math.floor(pos / secPerBar() + 1e-6) * secPerBar(), bars: NEW_PATTERN_BARS() })
                               .then((c) => { if (c && c.ok) { ui.selectedClip = c.clipId; ui.openRollFor = c.clipId; render(); } });
                           }
                           toast("Instrument lane added. Double-click it to draw notes, or play your MIDI keyboard.");
                         }),
    });
  }
  if (SHOW_OTHER_INSTRUMENTS || track) items.push({ sep: true });
  if (SHOW_OTHER_INSTRUMENTS) items.push({ label: ui.state.scanningPlugins ? "Looking for plugins\u2026" : "Find my plugins (VST3 / AU)", meta: instruments.length > 1 ? "" : "Serum, Kontakt\u2026", run: findPlugins });
  if (track) {
    items.push({ label: "Rename\u2026", run: () => {
      const n = document.querySelector(`.row[data-track-id="${track.id}"] .head-name`);
      if (n) inlineEdit(n, track.name, (v) => run("renameTrack", { trackId: track.id, name: v }));
    } });
    items.push({ label: "Delete lane", danger: true, run: () => run("deleteTrack", { trackId: track.id }) });
  }
  showMenu(anchor, items);
}

function showSectionMenu(anchor, i) {
  const sec = ui.state.sections[i];
  const last = i === ui.state.sections.length - 1;
  showMenu(anchor, [
    { label: "Loop this part", meta: "click", run: () => loopSection(i) },
    { label: "Rename", meta: "double-click", run: () => {
      const lbl = anchor.querySelector(".lbl");
      inlineEdit(lbl, sec.name, (v) => editSections((l) => (l[i].name = v)));
    } },
    { label: "Record a double here", meta: "new lane + loop", run: () => recordHere(sec, "double") },
    { label: "Record a harmony here", run: () => recordHere(sec, "harmony") },
    { label: "Record adlibs here", run: () => recordHere(sec, "adlib") },
    { sep: true },
    { label: "Split at playhead", run: splitSectionAtPlayhead },
    ...(last ? [] : [{ label: "Join with next", run: () => editSections((l) => l.splice(i + 1, 1)) }]),
    ...(i === 0 ? [] : [{ label: "Join with previous", run: () => editSections((l) => l.splice(i, 1)) }]),
    { label: "Delete section", danger: true, run: () => editSections((l) => l.splice(i, 1)) },
    { sep: true },
    { label: "Loop the whole song", run: () => run("setLoopRange", { start: 0, end: songLength() }) },
    { label: "Clear all sections", danger: true, run: () => run("setSections", { sections: [] }).then(() => toast("Sections cleared. Cmd+Z brings them back.")) },
  ]);
}

function showTakeMenu(anchor, c) {
  const comp = compOf(c), comped = comp.some((x) => x.take !== comp[0].take);
  showMenu(anchor, [
    { heading: "Takes" },
    ...Array.from({ length: c.takes }, (_, i) => ({
      label: takeName(c, i), on: !comped && i === c.take, meta: !comped && i === c.take ? "default" : "",
      run: () => run("setClipTake", { clipId: c.id, index: i }),
    })),
    { sep: true },
    { label: ui.openTakes.has(c.id) ? "Close the take folder" : "Open the take folder", meta: "to comp", run: () => toggleTakes(c.id) },
    ...(comped ? [{ label: "Flatten comp", meta: "one clean clip", run: () => run("flattenComp", { clipId: c.id }).then((r) => r && r.ok && toast("Flattened: the comp is one clip now. Cmd+Z brings the takes back.")) }] : []),
    { label: "Remove the unused ones", meta: "keeps the default", run: () => run("removeUnusedTakes", { clipId: c.id }).then((r) => r && r.ok && toast("Kept the one that's playing. Cmd+Z brings the others back.")) },
  ]);
}

// ---------------------------------------------------------------------------
// Take folders and comping, like Logic's Quick Swipe Comping. A clip recorded over a
// loop has one take per pass. Its comp is a list of { start, end, take } pieces (seconds
// from the clip start); no comp means the whole clip plays one take.
const TAKE_H = 38;
const compOf = (c) => (c.comp && c.comp.length ? c.comp : [{ start: 0, end: c.length, take: c.take }]);

function toggleTakes(clipId) {
  if (ui.openTakes.has(clipId)) ui.openTakes.delete(clipId);
  else { ui.openTakes.add(clipId); selectClip(clipId); }
  render();
}

// Put [a, b] of take `take` into the comp; neighbours are trimmed, equal neighbours merge.
function compWith(c, a, b, take) {
  const out = [];
  for (const x of compOf(c)) {
    if (x.end <= a || x.start >= b) out.push({ ...x });
    else {
      if (x.start < a) out.push({ ...x, end: a });
      if (x.end > b) out.push({ ...x, start: b });
    }
  }
  out.push({ start: a, end: b, take });
  out.sort((p, q) => p.start - q.start);
  const merged = [];
  for (const x of out) {
    const last = merged[merged.length - 1];
    if (last && last.take === x.take && Math.abs(last.end - x.start) < 1e-6) last.end = x.end;
    else if (x.end - x.start > 1e-6) merged.push(x);
  }
  return merged;
}

function renderTakeStrips(lane, c, color) {
  const comp = compOf(c);
  for (let i = 0; i < takeCount(c); i++) {
    const strip = el("div", "take-strip");
    strip.dataset.clipId = c.id;
    strip.dataset.take = i;
    strip.style.left = toX(c.start) + "px";
    strip.style.width = Math.max(4, toX(c.length)) + "px";
    strip.style.top = `calc(var(--row-h) - 4px + ${i * TAKE_H}px)`;
    strip.style.setProperty("--c", color);
    for (const x of comp.filter((x) => x.take === i)) {
      const on = el("div", "take-on");
      on.style.left = toX(x.start) + "px";
      on.style.width = toX(x.end - x.start) + "px";
      strip.append(on);
    }
    if (i === c.take) strip.classList.add("default");
    if (c.audition === i) strip.classList.add("listening");
    const canvas = el("canvas");
    strip.append(canvas, el("span", "take-name", takeName(c, i)));
    strip.title = takeTitle(c, i);
    if (c.kind === "midi") drawNotes(canvas, { ...c, notes: i === c.take ? c.notes : (c.takeNotes && c.takeNotes[i]) || [] }, color);
    else drawWave(canvas, c, color, false, i);
    if (c.kind === "midi") { strip.addEventListener("mousedown", (e) => { e.stopPropagation(); if (e.button === 0) run("setClipTake", { clipId: c.id, index: i }); }); lane.append(strip); continue; }
    if (!(c.takes > 1)) { lane.append(strip); continue; } // just the original, while a variation loads
    strip.title += " \u00b7 Drag across a part to comp it in. Click to use this whole one.";
    strip.addEventListener("mousedown", (e) => swipeComp(e, c, i, strip));
    lane.append(strip);
  }
}

function swipeComp(e, c, take, strip) {
  if (e.button !== 0) return;
  e.stopPropagation();
  hidePop();
  const left = strip.getBoundingClientRect().left; // read before selectClip redraws the strips
  if (ui.selectedClip !== c.id) selectClip(c.id);
  const at = (ev) => Math.min(c.length, Math.max(0, snap(c.start + toSec(ev.clientX - left)) - c.start));
  const x0 = e.clientX, a0 = at(e);
  const box = el("div", "take-swipe");
  const fresh = document.querySelector(`.take-strip[data-clip-id="${c.id}"][data-take="${take}"]`);
  (fresh || strip).append(box);
  const show = (ev) => {
    const a = Math.min(a0, at(ev)), b = Math.max(a0, at(ev));
    box.style.left = toX(a) + "px";
    box.style.width = toX(b - a) + "px";
  };
  const onMove = (ev) => show(ev);
  const onUp = (ev) => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    box.remove();
    if (Math.abs(ev.clientX - x0) < 4) return run("setClipTake", { clipId: c.id, index: take });
    const a = Math.min(a0, at(ev)), b = Math.max(a0, at(ev));
    if (b - a < 0.01) return;
    run("setClipComp", { clipId: c.id, comp: compWith(c, a, b, take) });
  };
  show(e);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function showSessionMenu(anchor) {
  const s = ui.state;
  const making = (s.projects || []).filter((p) => p.making && !(s.sessions || []).includes(p.name));
  showMenu(anchor, [
    ...(s.projects && s.projects.length ? [{ label: "All projects", meta: "P", run: () => showHome(true) }, { sep: true }] : []),
    { heading: s.projects ? "Projects" : "Sessions" },
    ...(s.sessions || []).slice(0, 12).map((n) => ({ label: n, on: n === s.session, run: () => n !== s.session && run("openSession", { name: n }) })),
    ...making.map((p) => ({ label: p.name, meta: "being made", run: () => toast(`${p.name} is still being made. It opens here as soon as it's ready.`) })),
    { sep: true },
    { label: s.projects ? "New project" : "New session", run: () => run("newSession") },
    ...(s.browserSave ? [{ label: "Rename project", meta: "double-click the name", run: renameProject }] : []),
    { label: "Load a beat\u2026", meta: "replaces the reference", run: () => run("browseForBeat") },
    // The browser playground keeps sessions in the browser; these carry one to the app and back.
    ...(s.browserSave ? [
      { sep: true },
      { label: "Export session.json", meta: "for the Mac app", run: () => run("exportSession").then((r) => r && r.ok && toast(r.message)) },
      { label: "Import session.json\u2026", meta: "exported here", run: importSessionFile },
    ] : []),
  ]);
}

function importSessionFile() {
  const pick = el("input");
  pick.type = "file";
  pick.accept = ".json,application/json";
  pick.onchange = async () => {
    const f = pick.files && pick.files[0];
    if (!f) return;
    const r = await run("importSession", { text: await f.text() });
    if (r && r.ok) toast(r.message);
  };
  pick.click();
}

async function loadPlugins() {
  if (!ui.plugins || ui.pluginsFor !== ui.state.pluginCount) {
    ui.plugins = (await booth("listPlugins")) || [];
    ui.pluginsFor = ui.state.pluginCount;
  }
  return ui.plugins;
}

function findPlugins() {
  run("scanPlugins").then((r) => r && r.ok && toast("Looking for your VST3 and Audio Unit plugins. This can take a minute the first time."));
}

async function showAddDevice(anchor) {
  const effects = (await loadPlugins()).filter((p) => !p.instrument);
  const pop = $("pop");
  pop.replaceChildren();
  const input = el("input");
  input.placeholder = "Search: Drive, Delay, Auto-Tune\u2026";
  const list = el("div");
  pop.append(input, list);

  const fill = () => {
    const q = input.value.trim().toLowerCase();
    list.replaceChildren();
    const hit = (p) => p.name.toLowerCase().includes(q) || toyName({ type: p.key, name: p.name }).toLowerCase().includes(q) || (p.group || "").toLowerCase().includes(q) || (FX_SEARCH[p.name] || "").includes(q);
    // KILLTOY's own effects first: "auto-tune" shows TUNR above a third-party Auto-Tune.
    const own = (p) => (q && FX_SEARCH[p.name] ? 0 : 1);
    const matches = effects.filter((p) => !q || hit(p)).sort((a, b) => own(a) - own(b)).slice(0, 40);
    matches.forEach((p, i) => {
      const b = el("button", "item" + (i === 0 ? " hl" : ""));
      const d = el("span", "dot"); d.style.setProperty("--c", deviceColor({ type: p.key, name: p.name }));
      b.append(d, document.createTextNode(toyName({ type: p.key, name: p.name })), el("span", "meta", p.group || ""));
      b.onclick = (e) => { e.stopPropagation(); hidePop(); addDevice(p.key); };
      list.append(b);
    });
    if (!matches.length) list.append(el("div", "label", "Nothing found."));
    const scan = el("button", "item", ui.state.scanningPlugins ? "Looking for plugins\u2026" : "Find my plugins (VST3 / AU)");
    scan.append(el("span", "meta", ui.state.pluginCount ? `${ui.state.pluginCount} found` : ""));
    scan.onclick = (e) => { e.stopPropagation(); hidePop(); findPlugins(); };
    list.append(scan);
  };

  input.oninput = fill;
  input.onkeydown = (e) => {
    if (e.key === "Enter") list.querySelector(".item")?.click();
    if (e.key === "Escape") hidePop();
  };
  input.onclick = (e) => e.stopPropagation();
  fill();
  placePop(anchor, true);
  input.focus();
}

function addDevice(key) {
  const clip = selectedRackClip();
  if (!clip) return;
  const r = run("addPlugin", { ...fxTarget(clip), key });
  if (r && r.then) r.then((x) => { if (x && !x.error) fxRecentNote(key); });
}

// KILLTOY 2 FX bar (Eman, 11 Nov 00:00): no Tune/Align/Clean/Gate/Stems/Send to AI row; ADD EFFECT is a tall thin
// card on the left; once you've added any effect, a column left of it lists the ones you use most / last, in every
// project (saved in this browser). Click one to add it. KT2_FXBAR_OLD = the old bar.
// the old 5-effects-per-host limit: the desktop app and KILLTOY 1 keep it, KILLTOY 2 has none (KT2_FX_LIMIT5 = old)
function fxLimit5() { return !document.documentElement.classList.contains("kt2") || !!window.KT2_FX_LIMIT5; }
function fxOf(n) { return fxLimit5() ? `${n} of 5 effects` : `${n} effect${n === 1 ? "" : "s"}`; }
const fxBarNew = () => document.documentElement.classList.contains("kt2") && !window.KT2_FXBAR_OLD;
const FX_RECENT_KEY = "kt2.fxRecent";
function fxRecentLoad() { try { const m = JSON.parse(localStorage.getItem(FX_RECENT_KEY) || "{}"); return m && typeof m === "object" ? m : {}; } catch (e) { return {}; } }
function fxRecentNote(key) {
  const m = fxRecentLoad(), r = m[key] || { n: 0, t: 0 };
  const p = (ui.plugins || []).find((x) => x.key === key);
  r.n++; r.t = Date.now(); if (p) r.name = p.name; m[key] = r;
  try { localStorage.setItem(FX_RECENT_KEY, JSON.stringify(m)); } catch (e) {}
  if (fxBarNew()) buildFxSide(selectedRackClip());
}
// used often counts, used lately counts more (a use 3 days ago is worth about a third of one today)
function fxRecentList(max = 12) {
  const now = Date.now();
  return Object.entries(fxRecentLoad()).filter(([k, r]) => r && r.n > 0)
    .map(([key, r]) => ({ key, name: r.name || key.replace(/^(builtin|plugin):/, ""), score: Math.log2(1 + r.n) + 3 * Math.exp(-(now - (r.t || 0)) / (3 * 864e5)) }))
    .sort((a, b) => b.score - a.score).slice(0, max);
}
// GROUP / SEND panel (Eman, 11 Nov 00:54): the right part of the FX strip, always there. Every bus in the project is a
// row; the ones this sound isn't in look switched off, the power button puts it in. GROUP = the sound goes through
// the bus (one fader + effects for all of them); SEND = a copy goes to it, added on top, with a how-much amount.
// Flipping GROUP/SEND never changes the bus's effects. Click a name to see its effects. KT2_BUS_OFF = no panel.
function buildBusPanel(clip) {
  const main = document.querySelector("#rack .rack-main");
  if (!main) return;
  let box = $("k2bus");
  const rets = ui.state && ui.state.returns;
  if (!fxBarNew() || window.KT2_BUS_OFF || !rets || !clip) { if (box) box.remove(); return; }
  if (!box) { box = el("div", "k2bus"); box.id = "k2bus"; }
  if (box.parentNode !== main || main.lastElementChild !== box) main.append(box);
  const lane = clip.track && !clip.master && !clip.ret && clip.track.kind !== "return" ? clip.track : null;
  box.classList.toggle("k2bb-on", !window.KT2_BUS_LIST);
  if (!window.KT2_BUS_LIST) return buildBusBoxes(box, rets, lane);
  const head = el("div", "k2bus-head");
  head.append(el("span", null, "GROUP / SEND"));
  const add = el("button", "k2bus-new", "+ NEW");
  add.onclick = (e) => { e.stopPropagation(); showMenu(add, [
    { label: "GROUP", meta: "sounds go through it", run: () => run("newBus", { mode: "group" }).then((r) => r && r.id && lane && run("setBusMember", { trackId: lane.id, id: r.id, on: true })) },
    { label: "SEND", meta: "a copy goes to it", run: () => run("newBus", { mode: "send" }).then((r) => r && r.id && lane && run("setBusMember", { trackId: lane.id, id: r.id, on: true })) },
  ]); };
  head.append(add);
  const list = el("div", "k2bus-list");
  for (const r of rets) {
    const k = r.id.slice(6), mode = r.mode || "send", amt = lane ? (lane.sends && lane.sends[k]) || 0 : 0, on = amt > 0;
    const row = el("div", "k2bus-row" + (lane && !on ? " out" : "") + (ui.selectedTrack === r.id && !ui.selectedClip ? " sel" : ""));
    row.dataset.bus = r.id;
    row.style.setProperty("--c", killtoyReturns.colorFor(r.id));
    if (lane) {
      const pw = el("button", "k2bus-pw" + (on ? " on" : ""));
      pw.title = on ? "Take this sound out" : "Put this sound in";
      pw.onclick = (e) => { e.stopPropagation(); run("setBusMember", { trackId: lane.id, id: r.id, on: !on }); };
      row.append(pw);
    }
    const name = el("button", "k2bus-name", r.name);
    name.title = "Click: its effects. Double-click: rename";
    name.onclick = (e) => { e.stopPropagation(); selectTrack(r.id); };
    name.ondblclick = (e) => { e.stopPropagation(); inlineEdit(name, r.name, (v) => run("renameBus", { id: r.id, name: v })); };
    const sw = el("div", "k2bus-sw");
    for (const m of ["group", "send"]) {
      const b = el("button", mode === m ? "on" : "", m.toUpperCase());
      b.onclick = (e) => { e.stopPropagation(); if (mode !== m) run("setBusMode", { id: r.id, mode: m }); };
      sw.append(b);
    }
    row.append(name, sw);
    if (lane && on && mode === "send") {   // PRE: taken before the sound's fader (the fader won't change it)
      const pre = !!(lane.sendsPre && lane.sendsPre[k]);
      const pb = el("button", "k2bus-pre" + (pre ? " on" : ""), "PRE");
      pb.title = pre ? "Before the fader: turning the sound down doesn't change this send. Click for after." : "After the fader (normal). Click for before the fader.";
      pb.onclick = (e) => { e.stopPropagation(); run("setSendPre", { trackId: lane.id, send: k, pre: !pre }); };
      row.append(pb);
    }
    if (lane && on && mode === "send") {   // how much of this sound goes there: drag up/down, double-click = 50%
      const a = el("div", "k2bus-amt", Math.round(amt * 100) + "%");
      a.title = "How much goes to it. Drag up or down";
      a.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setSend", { trackId: lane.id, send: k, amount: 0.5 }); });
      a.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const y0 = e.clientY; let x = amt, sent = false;
        liveDrag(e, (ev) => {
          x = Math.round(Math.max(0.01, Math.min(1, amt + (y0 - ev.clientY) / 120)) * 100) / 100;
          a.textContent = Math.round(x * 100) + "%";
          return () => { run("setSend", { trackId: lane.id, send: k, amount: x, drag: sent }); sent = true; };
        }, (ev, none, pending) => { if (pending) pending(); });
      });
      row.append(a);
    }
    row.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showMenu(atMouse(e), [
      { heading: r.name },
      { label: "Rename", run: () => inlineEdit(name, r.name, (v) => run("renameBus", { id: r.id, name: v })) },
      { label: "Delete", run: () => { if (ui.selectedTrack === r.id) ui.selectedTrack = null; run("deleteBus", { id: r.id }); } },
    ]); });
    list.append(row);
  }
  box.replaceChildren(head, list);
}

// BUS BOXES (Eman, 11 Nov 02:11; KT2_BUS_LIST = the plain list before): every GROUP / SEND is a full-height box
// like a little effects rack, side by side, sliding sideways. GROUP / SEND toggle on top, its effects inside (drag
// an effect card onto a box, or + inside it), the picked sound's switch and amount at the bottom, and a link
// count: press it and the sounds in that bus fly out of the timeline into one view. + BUS opens a picker like
// ADD EFFECT; dropping an effect on it makes a new bus around that effect. New buses name themselves.
const BUS_NAMES = {
  verb: ["BIG ROOM", "CATHEDRAL", "HAZE"], space: ["BIG ROOM", "THE VOID", "HAZE"], echo: ["ECHO CHAMBER", "TAPE ECHO", "BOUNCE"], delay: ["ECHO CHAMBER", "TAPE ECHO", "BOUNCE"],
  crush: ["DIRT BUS", "BITCRUSHER"], drive: ["HEAT", "BURN"], loud: ["SMASH", "CRUSH CREW"], clip: ["SMASH"], squash: ["GLUE", "SQUEEZE"], comp: ["GLUE", "SQUEEZE"],
  texture: ["GRAIN CLOUD", "DUST"], chop: ["CHOP SHOP"], pump: ["PUMP ROOM"], tune: ["ROBOT CHOIR"], eq: ["SHAPE"],
};
const LANE_NAMES = [[/kick|808|bass|sub/i, "LOW END"], [/drum|snare|hat|clap|perc|killdrum/i, "DRUM CULT"], [/lead|vox|vocal|double|adlib|harm|back/i, "VOX GANG"], [/synth|toy|pad|key|chord|arp/i, "SYNTH PACK"]];
function busAutoName(mode, fxName, laneName) {
  const taken = new Set(((ui.state && ui.state.returns) || []).map((r) => r.name));
  const pick = (list) => list.find((n) => !taken.has(n)) || list[0] + " " + (taken.size + 1);
  if (fxName) { const k = Object.keys(BUS_NAMES).find((x) => fxName.toLowerCase().includes(x)); if (k) return pick(BUS_NAMES[k]); return pick([fxName.replace(/^Toy/, "").toUpperCase() + (mode === "group" ? " GROUP" : " SEND")]); }
  if (laneName) { const hit = LANE_NAMES.find(([re]) => re.test(laneName)); if (hit) return pick([hit[1], hit[1] + " II"]); }
  return pick(mode === "group" ? ["THE GANG", "CREW", "SQUAD"] : ["AFTERGLOW", "GHOST", "MIRAGE"]);
}
const pluginKey = (p) => { const hit = (ui.plugins || []).find((x) => x.key === "builtin:" + p.type || x.key === p.type || x.name === p.name); return hit ? hit.key : "builtin:" + p.type; };
// copy an effect (with its knob settings) onto a bus; no bus id = make a new one around it
async function busCopyEffect(p, rid, lane) {
  if (!rid) {
    const mode = /verb|space|echo|delay|texture/i.test(p.name + p.type) ? "send" : "group";
    const r = await run("newBus", { mode, name: busAutoName(mode, toyName(p)) });
    if (!r || !r.id) return;
    rid = r.id;
    if (lane) await run("setBusMember", { trackId: lane.id, id: rid, on: true });
  }
  const r = await run("addPlugin", { trackId: rid, key: pluginKey(p) });
  const bus = r && !r.error && ui.state.returns.find((x) => x.id === rid), np = bus && bus.plugins[bus.plugins.length - 1];
  if (np) for (const q of p.params) if (np.params.some((x) => x.id === q.id)) await run("setParam", { pluginId: np.id, paramId: q.id, value: q.value });
  if (window.fxRecentNote) fxRecentNote(pluginKey(p));
  toast(`${toyName(p)} copied onto ${(ui.state.returns.find((x) => x.id === rid) || {}).name || "the bus"}.`);
}
// effect cards dragged by their name bar: light up the bus box under the pointer, drop = copy it there
function busDropAt(x, y) { const n = document.elementFromPoint(x, y); return n && n.closest ? n.closest("#k2bus .k2bb, #k2bus .k2bb-add") : null; }
function busDragHover(x, y) { document.querySelectorAll("#k2bus .drop").forEach((n) => n.classList.remove("drop")); const b = busDropAt(x, y); if (b) b.classList.add("drop"); return b; }
function buildBusBoxes(box, rets, lane) {
  const sc = box.querySelector(".k2bb-row"), keep = sc ? sc.scrollLeft : 0;
  const row = el("div", "k2bb-row");
  const k = (r) => r.id.slice(6);
  for (const r of rets) {
    const mode = r.mode || "send", amt = lane ? (lane.sends && lane.sends[k(r)]) || 0 : 0, on = amt > 0;
    const members = ui.state.tracks.filter((t) => t.sends && t.sends[k(r)] > 0);
    const b = el("div", "k2bb" + (lane && !on ? " out" : "") + (r.muted ? " muted" : "") + (ui.selectedTrack === r.id && !ui.selectedClip ? " sel" : ""));
    b.dataset.bus = r.id;
    b.style.setProperty("--c", killtoyReturns.colorFor(r.id));
    // top: name + GROUP / SEND
    const top = el("div", "k2bb-top");
    const name = el("button", "k2bb-name", r.name);
    name.title = "Click: open it in the rack. Double-click: rename";
    name.onclick = (e) => { e.stopPropagation(); selectTrack(r.id); };
    name.ondblclick = (e) => { e.stopPropagation(); inlineEdit(name, r.name, (v) => run("renameBus", { id: r.id, name: v.toUpperCase() })); };
    const sw = el("div", "k2bb-sw");
    for (const m of ["group", "send"]) {
      const t = el("button", mode === m ? "on" : "", m.toUpperCase());
      t.title = m === "group" ? "GROUP: the sounds go through it (one fader, its effects change them)" : "SEND: a copy goes to it, added on top (each sound has a how-much amount)";
      t.onclick = (e) => { e.stopPropagation(); if (mode !== m) run("setBusMode", { id: r.id, mode: m }); };
      sw.append(t);
    }
    top.append(name, sw);
    // middle: its effects
    const fx = el("div", "k2bb-fx");
    for (const p of (r.plugins || []).filter((q) => !q.instrument)) {
      const c = el("div", "k2bb-card" + (p.enabled ? "" : " off"));
      c.style.setProperty("--dc", deviceColor(p));
      const pw = el("button", "k2bb-cpw"); pw.title = p.enabled ? "Bypass" : "Turn on"; pw.onclick = (e) => { e.stopPropagation(); run("togglePlugin", { pluginId: p.id }); };
      const nm = el("span", null, toyName(p)); nm.title = "Click: its knobs in the rack";
      c.onclick = (e) => { e.stopPropagation(); selectTrack(r.id); };
      const x = el("button", "k2bb-cx", "\u00d7"); x.title = "Remove"; x.onclick = (e) => { e.stopPropagation(); run("removePlugin", { pluginId: p.id }); };
      c.append(pw, nm, x);
      fx.append(c);
    }
    const addfx = el("button", "k2bb-addfx", "+ EFFECT");
    addfx.title = "Add an effect to this bus (or drag an effect card here)";
    addfx.onclick = (e) => { e.stopPropagation(); if (window.KT2Pick && !window.KT2_OLD_FXMENU) KT2Pick.fx({ onPick: (key) => run("addPlugin", { trackId: r.id, key }).then((x) => x && !x.error && fxRecentNote(key)) }); else { selectTrack(r.id); } };
    fx.append(addfx);
    // bottom: links + this sound's switch / amount
    const bot = el("div", "k2bb-bot");
    const links = el("button", "k2bb-links" + (members.length ? "" : " none"));
    links.innerHTML = '<svg viewBox="0 0 16 16"><path d="M6.5 9.5l3-3M5 7.5L3.6 8.9a2.5 2.5 0 003.5 3.5L8.5 11M11 8.5l1.4-1.4a2.5 2.5 0 00-3.5-3.5L7.5 5"/></svg><b>' + members.length + "</b>";
    links.title = members.length ? `${members.length} sound${members.length > 1 ? "s" : ""} in it. Click to see them` : "No sounds in it yet";
    links.onclick = (e) => {   // who's in it right now (the box may be a moment older than the state)
      e.stopPropagation();
      const now = ui.state.tracks.filter((t) => t.sends && t.sends[k(r)] > 0), rr = ui.state.returns.find((x) => x.id === r.id) || r;
      if (now.length) busLinksView(rr, now, b);
    };
    bot.append(links);
    if (lane) {
      if (on && mode === "send") {
        const pre = !!(lane.sendsPre && lane.sendsPre[k(r)]);
        const pb = el("button", "k2bb-pre" + (pre ? " on" : ""), "PRE");
        pb.title = pre ? "Before the fader. Click for after" : "After the fader (normal). Click for before the fader";
        pb.onclick = (e) => { e.stopPropagation(); run("setSendPre", { trackId: lane.id, send: k(r), pre: !pre }); };
        const a = el("div", "k2bb-amt", Math.round(amt * 100) + "%");
        a.title = "How much of " + lane.name + " goes to it. Drag up or down, double-click = 50%";
        a.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setSend", { trackId: lane.id, send: k(r), amount: 0.5 }); });
        a.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          const y0 = e.clientY; let v = amt, sent = false;
          liveDrag(e, (ev) => { v = Math.round(Math.max(0.01, Math.min(1, amt + (y0 - ev.clientY) / 120)) * 100) / 100; a.textContent = Math.round(v * 100) + "%";
            return () => { run("setSend", { trackId: lane.id, send: k(r), amount: v, drag: sent }); sent = true; }; }, (ev, none, pending) => { if (pending) pending(); });
        });
        bot.append(pb, a);
      }
      const act = el("button", "k2bb-act" + (on ? " on" : ""), on ? "ON" : "ACTIVATE");
      act.title = on ? `Take ${lane.name} out` : `Put ${lane.name} in`;
      act.onclick = (e) => { e.stopPropagation(); run("setBusMember", { trackId: lane.id, id: r.id, on: !on }); };
      bot.append(act);
    }
    b.append(top, fx, bot);
    b.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showMenu(atMouse(e), [{ heading: r.name },
      { label: "Rename", run: () => inlineEdit(name, r.name, (v) => run("renameBus", { id: r.id, name: v.toUpperCase() })) },
      { label: r.muted ? "Unmute" : "Mute", run: () => run("toggleReturnMute", { id: r.id }) },
      { label: "Delete", danger: true, run: () => { if (ui.selectedTrack === r.id) ui.selectedTrack = null; run("deleteBus", { id: r.id }); } }]); });
    // recent-column effects dragged in (HTML5 drag)
    b.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/kt-fx")) { e.preventDefault(); b.classList.add("drop"); } });
    b.addEventListener("dragleave", () => b.classList.remove("drop"));
    b.addEventListener("drop", (e) => { b.classList.remove("drop"); const key = e.dataTransfer.getData("text/kt-fx"); if (key) { e.preventDefault(); run("addPlugin", { trackId: r.id, key }); } });
    row.append(b);
  }
  const add = el("button", "k2bb-add");
  add.innerHTML = "<b>+</b>BUS";
  add.title = "A new GROUP or SEND (or drop an effect here to make one around it)";
  add.onclick = (e) => { e.stopPropagation(); busPicker(lane); };
  add.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/kt-fx")) { e.preventDefault(); add.classList.add("drop"); } });
  add.addEventListener("dragleave", () => add.classList.remove("drop"));
  add.addEventListener("drop", (e) => { add.classList.remove("drop"); const key = e.dataTransfer.getData("text/kt-fx"); const pl = (ui.plugins || []).find((x) => x.key === key); if (pl) { e.preventDefault(); busCopyEffect({ name: pl.name, type: key.replace(/^builtin:/, ""), params: [] }, null, lane); } });
  row.append(add);
  box.replaceChildren(row);
  row.scrollLeft = keep;
  if (!row.dataset.wheel) { row.dataset.wheel = 1; row.addEventListener("wheel", (e) => { if (row.scrollWidth > row.clientWidth + 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); }
}
// + BUS: two big tiles on the frosted page, like the effect picker
function busPicker(lane) {
  const o = el("div", "k2ov k2bpick");
  const close = () => { o.classList.add("bye"); setTimeout(() => o.remove(), 160); removeEventListener("keydown", esc, true); };
  const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  addEventListener("keydown", esc, true);
  o.onclick = (e) => { if (e.target === o) close(); };
  const wrap = el("div", "k2bpick-tiles");
  for (const [m, title, line, svg] of [
    ["group", "GROUP", "The sounds go through it. One fader and one set of effects for all of them.", '<svg viewBox="0 0 40 40"><path d="M6 8h10M6 16h10M6 24h10M6 32h10M16 8l8 12M16 16l8 4M16 24l8-4M16 32l8-12M24 20h10"/></svg>'],
    ["send", "SEND", "A copy goes to it, added on top. Each sound picks how much.", '<svg viewBox="0 0 40 40"><path d="M6 20h28M18 20v-10h16M18 10l4-4M18 10l4 4"/></svg>']]) {
    const t = el("button", "k2bpick-tile");
    t.dataset.mode = m;
    t.innerHTML = svg + "<b>" + title + "</b><span>" + line + "</span>";
    t.onclick = async (e) => {
      e.stopPropagation(); close();
      const r = await run("newBus", { mode: m, name: busAutoName(m, null, lane && lane.name) });
      if (r && r.id && lane) await run("setBusMember", { trackId: lane.id, id: r.id, on: true });
    };
    wrap.append(t);
  }
  o.append(el("div", "k2bpick-head", "NEW BUS"), wrap);
  document.body.append(o);
  requestAnimationFrame(() => o.classList.add("in"));
}
// the link count: the page goes dark, the sounds in this bus fly out of the timeline into one field
function busLinksView(r, members, fromBox) {
  const o = el("div", "k2ov k2blinks");
  o.style.setProperty("--c", killtoyReturns.colorFor(r.id));
  const close = () => { o.classList.add("bye"); setTimeout(() => o.remove(), 200); removeEventListener("keydown", esc, true); };
  const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  addEventListener("keydown", esc, true);
  o.onclick = (e) => { if (e.target === o || e.target.classList.contains("k2blinks-field")) close(); };
  const head = el("div", "k2blinks-head");
  head.append(el("b", null, r.name), el("span", null, ((r.mode || "send") === "group" ? "GROUP \u00b7 " : "SEND \u00b7 ") + members.length + (members.length > 1 ? " sounds" : " sound")));
  const field = el("div", "k2blinks-field");
  const tiles = members.map((t) => {
    const tile = el("div", "k2bl-tile");
    tile.style.setProperty("--tc", colorOf(t));
    const lenAll = Math.max(1, ...t.clips.map((c) => c.start + c.length));
    const strip = el("div", "k2bl-strip");
    for (const c of t.clips) { const i = el("i"); i.style.left = (c.start / lenAll) * 100 + "%"; i.style.width = Math.max(1, (c.length / lenAll) * 100) + "%"; strip.append(i); }
    const amt = (t.sends && t.sends[r.id.slice(6)]) || 0;
    const nm = el("div", "k2bl-name", t.name);
    const meta = el("div", "k2bl-meta", (r.mode || "send") === "group" ? t.clips.length + " clip" + (t.clips.length === 1 ? "" : "s") : Math.round(amt * 100) + "% \u00b7 " + t.clips.length + " clip" + (t.clips.length === 1 ? "" : "s"));
    const out = el("button", "k2bl-out", "\u00d7"); out.title = "Take it out of " + r.name;
    out.onclick = (e) => { e.stopPropagation(); run("setBusMember", { trackId: t.id, id: r.id, on: false }); tile.classList.add("gone"); };
    tile.onclick = (e) => { e.stopPropagation(); close(); if (t.clips[0]) { ui.selectedClip = t.clips[0].id; render(); } };
    tile.append(nm, meta, strip, out);
    field.append(tile);
    return [t, tile];
  });
  o.append(head, field);
  document.body.append(o);
  requestAnimationFrame(() => {
    o.classList.add("in");
    // each sound flies from where its clips are on the timeline (or the bus box) into its tile
    tiles.forEach(([t, tile], i) => {
      const src = t.clips.map((c) => document.querySelector(`#rows .clip[data-clip-id="${c.id}"]`)).find((n) => n && n.offsetParent) || document.querySelector(`#rows .row[data-track-id="${t.id}"]`) || fromBox;
      const a = src.getBoundingClientRect(), z = tile.getBoundingClientRect();
      if (!a.width || !z.width) return;
      const ghost = el("div", "k2bl-ghost");
      ghost.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;--tc:${colorOf(t)}`;
      document.body.append(ghost);
      tile.style.opacity = "0";
      ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${z.left - a.left}px, ${z.top - a.top}px) scale(${z.width / a.width}, ${z.height / a.height})`, opacity: 1 }],
        { duration: 420 + i * 60, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards", delay: i * 40 }).onfinish = () => { ghost.remove(); tile.style.opacity = ""; tile.classList.add("land"); };
    });
  });
}

function buildFxSide(clip) {
  const main = document.querySelector("#rack .rack-main");
  if (!main) return;
  let side = $("k2fxside");
  document.documentElement.classList.toggle("k2-fxbar", fxBarNew());
  if (!fxBarNew()) { if (side) side.remove(); return; }
  const cards = $("cards");
  if (!cards.dataset.wheel) {   // a mouse wheel scrolls the cards sideways when they don't all fit
    cards.dataset.wheel = "1";
    cards.addEventListener("wheel", (e) => {
      if (!document.documentElement.classList.contains("k2-fxbar") || cards.scrollWidth <= cards.clientWidth + 1 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.target.closest && e.target.closest(".knob, canvas")) return;   // knobs and pictures keep their own wheel
      cards.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false });
  }
  if (!side) { side = el("div", "k2fxside"); side.id = "k2fxside"; main.insertBefore(side, $("cards")); }
  side.replaceChildren();
  side.hidden = !clip;
  // SLIM FX TAB (Eman, 16 Nov 02:47): no CHAIN column, no used-effects list; the effect cards start at the left
  // edge and ADD EFFECT sits right after the last effect. KT2_FX_CHAINCOL_SHOW = both columns + ADD EFFECT on the left.
  const slim = !window.KT2_FX_CHAINCOL_SHOW;
  document.documentElement.classList.toggle("k2-fxslim", slim);
  for (const old of cards.querySelectorAll(":scope > .k2-fxadd-end")) old.remove();
  if (!clip) return;
  if (slim) {
    side.hidden = true;
    const add = el("button", "card add k2-fxadd k2-fxadd-tall k2-fxadd-end");
    add.innerHTML = "<b>+</b>ADD EFFECT";
    add.onclick = (e) => { e.stopPropagation(); showAddDevice(add); };
    cards.append(add);
    return;
  }
  const recent = fxRecentList();
  if (recent.length) {
    const col = el("div", "k2fxrecent");
    for (const r of recent) {
      const b = el("button", "k2fxr");
      b.style.setProperty("--c", deviceColor({ type: r.key, name: r.name }));
      b.textContent = toyName({ type: r.key, name: r.name });
      b.title = "Add " + b.textContent;
      b.onclick = (e) => { e.stopPropagation(); addDevice(r.key); };
      b.draggable = true;   // drag it onto a bus box
      b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/kt-fx", r.key); e.dataTransfer.effectAllowed = "copy"; });
      col.append(b);
    }
    side.append(col);
  }
  const add = el("button", "card add k2-fxadd k2-fxadd-tall");
  add.innerHTML = "<b>+</b>ADD EFFECT";
  add.onclick = (e) => { e.stopPropagation(); showAddDevice(add); };
  side.append(add);
}

function inlineEdit(node, value, done) {
  const input = el("input");
  input.value = value;
  const old = [...node.childNodes];
  node.replaceChildren(input);
  input.focus();
  input.select();
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    node.replaceChildren(...old);
    if (save && v && v !== value) done(v);
  };
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  };
  input.onblur = () => finish(true);
  input.onmousedown = input.onclick = (e) => e.stopPropagation();
}

function promptChainName(anchor) {
  const clip = selectedRackClip();
  if (!clip || !clip.plugins.length) return toast("Add effects to a clip first.");
  const pop = $("pop");
  pop.replaceChildren();
  const input = el("input");
  input.placeholder = "Name this preset, then Enter";
  input.onclick = (e) => e.stopPropagation();
  input.onkeydown = (e) => {
    if (e.key === "Escape") hidePop();
    if (e.key !== "Enter" || !input.value.trim()) return;
    const name = input.value.trim();
    hidePop();
    run("saveChain", { ...fxTarget(clip), name }).then((r) => r && r.ok && toast(`Saved "${name}". It's one click on any clip now.`));
  };
  pop.append(input);
  placePop(anchor, true);
  input.focus();
}

// ---------------------------------------------------------------------------
// Transport
// Writes text / a tooltip only when it is different from what is there (see renderTransport). KT2_IDLE_WRITES_OLD = always write.
function setText(node, text) { if (node && (window.KT2_IDLE_WRITES_OLD || node.textContent !== text)) node.textContent = text; }
function setTitle(node, text) { if (node && (window.KT2_IDLE_WRITES_OLD || node.title !== text)) node.title = text; }
function renderTransport() {
  const t = ui.transport;
  // layout reads first (writing the playhead and then reading the scroll box forced a layout
  // of the whole song on every tick)
  const scroll = $("scroll"), visible = scroll ? scroll.clientWidth - HEAD_W : 0, sl = scroll ? scroll.scrollLeft : 0;
  $("btn-play").classList.toggle("on", t.playing);
  $("btn-rec").classList.toggle("on", t.recording);
  $("btn-loop").classList.toggle("on", t.looping);
  document.body.classList.toggle("recording", t.recording);

  const armed = ui.state && ui.state.tracks.find((tr) => tr.armed);
  // Deep debug 16 Nov: these three readouts were rewritten on every transport tick, also while stopped. Each rewrite
  // swaps the text node, which woke every "watch the whole page" observer (tour, explain, tabs...) about 30 times a
  // second with nothing happening. They are now written only when the words change. KT2_IDLE_WRITES_OLD = old.
  setText($("rec-target"), ui.state && !ui.state.hasInput ? "No mic found" : armed ? "Mic \u2192 " + armed.name : "No lane armed");
  setText($("pos-bars"), fmtBars(t.position));
  setText($("pos-time"), fmtTime(t.position));

  const x = toX(t.position);
  $("playhead").style.left = rulerLeft() + x + "px";
  $("ruler-head").style.left = x + "px";
  if (ui.state) renderOverlays();

  if (t.playing && !(window.KillToyArrange && !KillToyArrange.following())) { // Follow (Cmd+Shift+F, ui/arrange.js)
    if (scroll && (x > sl + visible - 80 || x < sl))
      scroll.scrollLeft = Math.max(0, x - 120);
  }

  updateMeter(t.input);
  updateMasterMeter(t.master);
  // Speed pass 27 Nov: the transport ticks 30 times a second even when stopped, and every tick redrew the whole open
  // piano roll (the biggest idle cost with a pattern window open). Edits redraw it themselves, so while stopped and the
  // marker is still it is now redrawn only every 8th tick (as a safety net). KT2_ROLL_TICK_OLD = every tick.
  const rollTick = window.KT2_ROLL_TICK_OLD || t.playing || t.position !== ui.rollTickPos || ++ui.rollTickN % 8 === 0;
  ui.rollTickPos = t.position;
  if (rollTick && ui.roll && !ui.roll.drag) drawRoll();
  if (rollTick && window.TmMidi && !$("iw-tmidi").hidden) TmMidi.draw();
}

function updateMeter(db) {
  const m = ui.meter;
  const now = performance.now();
  db = typeof db === "number" ? db : -100;
  m.level = Math.max(db, m.level - 1.6);
  if (db >= m.peak || now - m.peakHold > 1200) { m.peak = Math.max(db, m.level); m.peakHold = now; }
  const pct = (v) => Math.max(0, Math.min(1, (v + 60) / 60)) * 100;
  $("meter-fill").style.width = pct(m.level) + "%";
  $("meter-peak").style.left = pct(m.peak) + "%";
  $("meter-peak").style.background = m.peak > -3 ? "var(--rec)" : "";
}

// ---------------------------------------------------------------------------
// Clip interaction: select, drag to move (snaps to 1/16, hold Alt for free), scissors
function selectClip(id) {
  ui.selectedClip = id;
  ui.extraClips.clear();
  if (id || ui.selectedTrack) {
    ui.selectedTrack = null;
    document.querySelectorAll(".row.selected").forEach((n) => n.classList.remove("selected"));
  }
  document.querySelectorAll(".clip").forEach((n) => n.classList.toggle("selected", isSel(n.dataset.clipId)));
  if (window.KT2_SEL_REBUILD_OLD) ui.laneSig = "";   // the selection is part of the lane check, so render() redraws what changed
  render();
}

// Clicking a lane card picks the whole lane: the rack shows the lane's effects.
// (No lane rebuild, so double-click-to-rename on the name keeps working.)
function selectTrack(id) {
  ui.selectedClip = null;
  ui.selectedTrack = id;
  document.querySelectorAll(".clip.selected").forEach((n) => n.classList.remove("selected"));
  document.querySelectorAll(".row").forEach((n) => n.classList.toggle("selected", n.dataset.trackId === id));
  renderRack();
}

function onClipMouseDown(e, c, t, node) {
  if (e.button !== 0) return;
  e.stopPropagation();
  hidePop();
  const offsetX = e.clientX - node.getBoundingClientRect().left;

  if (c.kind === "midi" && e.detail === 2) {
    selectClip(c.id);
    openRoll(c);
    return;
  }
  // KILLTOY 2: double-click any audio clip opens the audio editor (Eman, 4 Nov); TUNR is a button in it
  if (window.KT2AudioEdit && c.kind !== "midi" && e.detail === 2) {
    selectClip(c.id);
    // a Shift-dragged pattern opens its rhythm menu; the audio editor is in that menu (Eman 12 Nov 00:37, KT2_RHYTHM_ICON_SHOW = old)
    const fc = findClip(c.id);
    if (fc && fc.rhythm && window.KT2Rhythm && !window.KT2_RHYTHM_ICON_SHOW && !window.KT2_RHYTHM_OFF) { if (KT2Rhythm.state.id !== c.id) KT2Rhythm.open(c.id); return; }
    KT2AudioEdit.open(findClip(c.id));
    return;
  }
  // Double-click a vocal clip: the Tune editor (like Ableton opening a clip's detail).
  if (t.kind === "take" && e.detail === 2) {
    selectClip(c.id);
    openTune(findClip(c.id));
    return;
  }
  // Shift- or Cmd-click adds a clip to the selection (or takes it out).
  if ((e.shiftKey || e.metaKey || e.ctrlKey) && t.kind !== "beat") {
    if (!ui.selectedClip) selectClip(c.id);
    else if (c.id === ui.selectedClip) { const [next] = ui.extraClips; ui.extraClips.delete(next); ui.selectedClip = next || null; }
    else if (ui.extraClips.has(c.id)) ui.extraClips.delete(c.id);
    else ui.extraClips.add(c.id);
    ui.selectedTrack = null;
    ui.laneSig = ""; render();
    return;
  }

  // The beat: click to select it and see its effects (it doesn't move).
  if (t.kind === "beat") {
    selectClip(c.id);
    return;
  }

  if (ui.cutMode) {
    run("splitClip", { clipId: c.id, time: cutTime(c, offsetX, e) });
    return;
  }

  // Clicking the one picked clip again (without moving it) lets go of it (Eman, 31 Oct)
  const wasOnly = ui.selectedClip === c.id && !ui.extraClips.size;
  // Clicking one of several picked clips keeps them all, so they move together.
  const group = isSel(c.id) && ui.extraClips.size ? selectedIds().map(findClip).filter((x) => x && x.track.kind !== "beat") : null;
  if (!group && ui.selectedClip !== c.id) {
    ui.selectedClip = c.id;
    ui.extraClips.clear();
    ui.selectedTrack = null;
    document.querySelectorAll(".row.selected").forEach((n) => n.classList.remove("selected"));
    document.querySelectorAll(".clip").forEach((n) => n.classList.toggle("selected", n.dataset.clipId === c.id));
    renderRack();
  }

  const startX = e.clientX;
  const startY = e.clientY;
  // the view can scroll during the drag (edge scroll, a trackpad): count it, so the clip stays under the mouse
  const sc0 = $("scroll"), sl0 = sc0 ? sc0.scrollLeft : 0;
  const scrollDx = () => (window.KT2_DRAG_SCROLL_OLD || !sc0 ? 0 : sc0.scrollLeft - sl0);
  let lastEv = null, edger = null, cancelled = false;
  // B1 (Eman, 7 Nov: "patterns jump up a row randomly", reported ~10x): the row a clip goes to is the
  // row under the clip's MIDDLE, not under the mouse. Grabbing a clip near its top edge and moving it
  // sideways with a few px of hand wobble used to put it one row up. KT2_ROW_BY_MOUSE = the old way.
  const grabR = node.getBoundingClientRect(), grabOff = startY - grabR.top - grabR.height / 2;
  const rowY = (ev) => (window.KT2_ROW_BY_MOUSE ? ev.clientY : ev.clientY - grabOff);
  let moved = false;
  let targetRow = null;
  let lastStart = null;
  let lastX = null, dir = 0, still = 0, lastRaw = null, freeKey = false, lastGlideX = null, lastShown = null;

  const spd = speedMeter();
  // the press is the speed meter's first point, so the very first move of a fast throw already counts as fast
  // (it used to read 0 = slow and eased the clip to a grid spot behind the hand). KT2_DRAG_SPEED0_OLD = old.
  if (!window.KT2_DRAG_SPEED0_OLD) spd.feed(e);
  let lastJ = c.start, lastTarget, lastDr = 0;
  const juiceStep = (at) => { if (!window.KT2Juice || at == null || Math.abs(at - lastJ) < 1e-6) return; KT2Juice.step("move", Math.sign(at - lastJ)); lastJ = at; };
  // the clip's element can be rebuilt mid-drag (a render from the transport, a resize, the
  // recorder starting): keep following the live one, or the sound ticks while the picture stays put
  // (Eman's V2k recording, take 1)
  const live = () => {
    if (node.isConnected) return node;
    const n = document.querySelector(`.clip[data-clip-id="${c.id}"]`);
    if (n) { node = n; if (moved) node.classList.add("dragging", "selected"); }
    return node;
  };
  const onMove = (ev) => {
    // the button came up where we couldn't hear it (outside the page's frame): end the drag right here,
    // or the clip kept following a mouse with no button down (KT2_DRAG_LOST_OLD = it followed)
    if (moved && ev.isTrusted && ev.buttons === 0 && ev.type === "mousemove" && !window.KT2_DRAG_LOST_OLD) return onUp(ev);
    live();
    lastEv = ev;
    const dx = ev.clientX - startX + scrollDx();
    spd.feed(ev);
    if (!moved && Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
    moved = true;
    if (!edger && !window.KT2_DRAG_SCROLL_OLD) edger = dragEdgeScroll(() => lastEv && { x: lastEv.clientX, y: lastEv.clientY }, () => lastEv && onMove(lastEv));
    if (edger) edger.poke();
    node.classList.add("dragging");
    // The clip follows the mouse exactly (smooth); a faint box shows the grid spot it will land on,
    // and letting go snaps it there (Eman, 31 Oct). Cmd: free (Alt copies).
    // Smart landing (Eman, 31 Oct): while moving, the guide shows the next grid spot AHEAD in the
    // direction you're going (coarser when fast); slow down or hold still and it takes the nearest
    // spot on the finest grid you can see, because that's probably where you want it.
    // a group stops as one when its earliest clip reaches the song start (night test 9 Nov: each clip stopped on its own
    // at 0 and the group came apart). KT2_GROUP_CLAMP_OLD = each clip clamps alone
    const raw = Math.max(group && !window.KT2_GROUP_CLAMP_OLD ? c.start - Math.min(...group.map((g) => g.start)) : 0, c.start + dx / ui.pxPerSec);
    if (lastX != null && Math.abs(ev.clientX - lastX) >= 1) dir = Math.sign(ev.clientX - lastX);
    lastX = ev.clientX; lastRaw = raw; freeKey = ev.metaKey || ev.ctrlKey;
    const slow = spd.v < 0.12;
    let start = freeKey ? raw : snapGrid(raw, slow ? 0 : spd.v, slow ? 0 : dir);
    // KILLTOY 2 (Eman, 4 Nov): speed decides the snap. A fast throw glides with the mouse and only
    // ticks lightly as it travels; slowing down lets the grid pull it in, and the spot it lands on
    // is always the nearest one to where you are, never one ahead.
    let glideM = 1;
    if (window.KT2Juice && !freeKey && !ui.snapOff) {
      const near = snapGrid(raw);
      // Eman, 5 Nov 02:00 (asked before, V2x take 1): moving at any real speed it sits EXACTLY
      // under the mouse, no pull to the grid at all; only a slow push (under ~90 px/s) or holding
      // still lets the grid take it. Was: a pull that grew from 620 px/s down, so normal moves snapped.
      glideM = spd.v < 0.09 ? 1 : 0;
      lastStart = near;
      start = glideM ? near : raw;
      if (glideM <= 0.85) {
        const gx = Math.round(ev.clientX / 22);
        if (gx !== lastGlideX) { if (lastGlideX != null) KT2Juice.step("glide", Math.sign(gx - lastGlideX)); lastGlideX = gx; }
        lastJ = near;   // no detent tick for spots it flew past
      }
    } else lastStart = start;
    clearTimeout(still);
    // holding still snaps to the grid spot nearest to where the clip is SHOWN, not to the raw mouse
    // spot: halfway between two bars those differ, and the clip jumped a bar away (V2k take 3)
    if (!freeKey) still = setTimeout(() => { if (lastRaw == null) return; lastStart = window.KT2Juice ? snapGrid(lastShown != null ? lastShown : lastRaw) : snapGrid(lastRaw, 0, 0); glideM = 1; landGuide(lastStart); if (window.KT2Juice) { node.classList.remove("k2-glide"); node.style.left = toX(lastStart) + "px"; juiceStep(lastStart); } }, 140);
    node.classList.toggle("k2-copying", ev.altKey);
    showCopyGhosts(ev.altKey && t.kind !== "beat" ? (group || [c]) : null);
    // KILLTOY 2 V2 (Eman, 4 Nov): the clip itself steps to where it will land (no grey box), one soft tick per step
    lastShown = window.KT2Juice ? start : raw;
    node.classList.toggle("k2-glide", !glideM);   // gliding: no easing on its position, so it sits right under the mouse
    node.style.left = toX(lastShown) + "px";
    if (glideM > 0.85) juiceStep(start);
    landGuide(glideM > 0.85 ? lastStart : null);
    if (group) { // everything picked moves by the same amount; on KILLTOY 2 they also move up/down rows together
      const d = raw - c.start, dS = start - c.start;
      const prevHome = groupRowList.indexOf(node.closest(".row")), prevRow = prevHome >= 0 ? groupRowList[prevHome + groupRows] : null;
      groupRows = 0;
      if (window.KT2 && KT2.freeRows && KT2.freeRows()) {
        // the grid's empty rows take a picked group too, a new lane is made there for it like for one clip
        // (Eman 15 Nov: several picked patterns stayed stuck on their row). KT2_GROUP_GHOST_OLD = only rows with a lane
        const ghostOk = !window.KT2_GROUP_GHOST_OLD && t.kind !== "beat";
        const rows = [...document.querySelectorAll("#rows > .row")].filter((r) => r.offsetParent && (ghostOk || !r.classList.contains("k2-ghost")));
        const ok = (r) => r && r.dataset.kind !== "beat" && !r.classList.contains("master");
        const cy = rowY(ev), oldEdge = window.KT2_DRAG_EDGE_OLD;
        const home = rows.indexOf(node.closest(".row"));
        const under = oldEdge ? rows.findIndex((r) => { const q = r.getBoundingClientRect(); return cy >= q.top && cy < q.bottom; })
          : rows.indexOf(dragRowAt(cy, (r) => rows.includes(r), prevRow));
        let dr = under >= 0 && home >= 0 ? under - home : 0;
        const fits = (d) => group.every((g) => { const n = document.querySelector(`.clip[data-clip-id="${g.id}"]`); return n && ok(rows[rows.indexOf(n.closest(".row")) + d]); });
        // past the top/bottom (or onto the beat) the group goes as far as it can, instead of jumping back home
        if (oldEdge) { if (dr && !fits(dr)) dr = 0; } else while (dr && !fits(dr)) dr -= Math.sign(dr);
        if (window.KT2Juice && dr !== lastDr) { KT2Juice.step("row", Math.sign(dr - lastDr)); lastDr = dr; }
        groupRows = dr; groupRowList = rows;
      }
      for (const g of group) {
        const n = document.querySelector(`.clip[data-clip-id="${g.id}"]`);
        if (!n) continue;
        n.classList.add("dragging"); n.classList.toggle("k2-glide", !glideM);
        if (g.id !== c.id) n.style.left = toX(Math.max(0, g.start + (window.KT2Juice ? dS : d))) + "px";
        const hr = n.closest(".row"), to = groupRows ? groupRowList[groupRowList.indexOf(hr) + groupRows] : null;
        n.style.transform = to ? `translateY(${to.getBoundingClientRect().top - hr.getBoundingClientRect().top}px)` : "";
        n.style.zIndex = to ? "20" : "";
        if (g.id !== c.id) groupGuide(g, n, Math.max(0, g.start + dS));
      }
      landGuide(glideM > 0.85 ? lastStart : null);
      return;
    }

    // the row under the mouse by height (the dragged clip itself sits in its old row, so don't ask the element under it)
    const cy = rowY(ev);
    document.querySelectorAll(".row.drop-target").forEach((n) => n.classList.remove("drop-target"));
    // KILLTOY 2's PRODUCE grid: any empty row takes it too (a lane is made for it there)
    // KILLTOY 2's PLAYGROUND has no channels (Eman, 31 Oct): any clip can go on any row (not the beat's)
    const freeRows = document.documentElement.classList.contains("kt2") && !document.documentElement.classList.contains("k2-rec") && t.kind !== "beat";
    const okRow = (r) => (freeRows && r.dataset.kind !== "beat" && !r.classList.contains("master")) || r.dataset.kind === (c.kind === "midi" ? "inst" : "take") || (r.classList.contains("k2-ghost") && t.kind !== "beat");
    if (window.KT2_DRAG_EDGE_OLD) {
      const rowEl = [...document.querySelectorAll("#rows > .row")].find((r) => { if (!r.offsetParent) return false; const q = r.getBoundingClientRect(); return cy >= q.top && cy < q.bottom; })
        || document.elementsFromPoint(ev.clientX, cy).find((n) => n.classList?.contains("row"));
      targetRow = rowEl && okRow(rowEl) ? rowEl : null;
    } else targetRow = dragRowAt(cy, okRow, targetRow);
    if (targetRow && targetRow.dataset.trackId !== t.id) targetRow.classList.add("drop-target");
    if (window.KT2Juice && (targetRow || null) !== lastTarget) { if (lastTarget !== undefined) KT2Juice.step("row", 1); lastTarget = targetRow || null; }
    // the clip follows the mouse up and down to the row it will land on
    const home = node.closest(".row");
    node.style.transform = targetRow && home && targetRow !== home ? `translateY(${targetRow.getBoundingClientRect().top - home.getBoundingClientRect().top}px)` : "";
    landGuide(glideM > 0.85 ? lastStart : null);
    node.style.zIndex = targetRow && targetRow !== home ? "20" : "";
  };

  // where the dragged clip will land (snapped), shown while it follows the mouse freely
  let guide = null, groupRows = 0, groupRowList = [];
  const guides = new Map();   // the other picked clips get their own landing box too (Eman, 31 Oct)
  const groupGuide = (g, n, at) => {
    let gd = guides.get(g.id);
    if (!gd) { gd = el("div", "land-guide"); gd.style.pointerEvents = "none"; guides.set(g.id, gd); }
    if (gd.parentNode !== n.parentNode) n.parentNode.insertBefore(gd, n);
    gd.style.left = toX(at) + "px"; gd.style.width = n.offsetWidth + "px"; gd.style.top = n.offsetTop + "px"; gd.style.height = n.offsetHeight + "px";
    gd.style.transform = n.style.transform;
    gd.hidden = Math.abs(toX(at) - parseFloat(n.style.left || 0)) < 1.5;
  };
  const landGuide = (at) => {
    if (at == null) { if (guide) guide.remove(); guide = null; return; }
    if (!guide) { guide = el("div", "land-guide"); guide.style.pointerEvents = "none"; }
    if (guide.parentNode !== node.parentNode) node.parentNode.insertBefore(guide, node);
    guide.style.left = toX(at) + "px";
    guide.style.width = node.offsetWidth + "px";
    guide.style.top = node.offsetTop + "px";
    guide.style.height = node.offsetHeight + "px";
    guide.style.transform = node.style.transform;
    guide.hidden = Math.abs(toX(at) - parseFloat(node.style.left || 0)) < 1.5;
  };
  // Alt held: the original stays visible where it was while the copy follows the mouse
  let ghosts = null;
  const showCopyGhosts = (list) => {
    if (!list) { if (ghosts) { ghosts.forEach((n) => n.remove()); ghosts = null; } return; }
    if (ghosts) return;
    ghosts = [];
    for (const g of list) {
      const n = document.querySelector(`.clip[data-clip-id="${g.id}"]`);
      if (!n) continue;
      const k = n.cloneNode(true);
      k.classList.remove("dragging", "k2-copying", "selected");
      k.classList.add("copy-ghost"); k.removeAttribute("data-clip-id");
      k.style.left = toX(g.start) + "px"; k.style.pointerEvents = "none";
      const a = n.querySelectorAll("canvas"), b = k.querySelectorAll("canvas");   // canvases don't clone their pixels
      a.forEach((cv, i) => { try { b[i].getContext("2d").drawImage(cv, 0, 0); } catch (err) {} });
      n.parentNode.insertBefore(k, n);
      ghosts.push(k);
    }
  };

  const onUp = (ev) => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("keydown", onKey, true);
    if (edger) edger.stop();
    live();
    clearTimeout(still); lastRaw = null;
    document.querySelectorAll(".clip.k2-glide").forEach((n) => n.classList.remove("k2-glide"));   // the landing eases again
    landGuide(null);
    guides.forEach((gd) => gd.remove()); guides.clear();
    const dropGhosts = () => showCopyGhosts(null);
    if (!ev.altKey) dropGhosts(); else setTimeout(dropGhosts, 600);   // kept until the real copy is drawn
    document.querySelectorAll(".row.drop-target").forEach((n) => n.classList.remove("drop-target"));
    if (!moved) { if (group) selectClip(c.id); else if (wasOnly) selectClip(null); else { ui.laneSig = ""; render(); } return; }
    if (cancelled) { ui.laneSig = ""; render(); return; }
    // the row-follow lift (translateY) is only for the drag: once the move is in, every dragged clip sits in its
    // new row with no offset left over (Eman, 6 Nov 23:30: a fast drag up left the pattern floating above the grid)
    const unLift = () => { for (const id of [c.id, ...(group || []).map((g) => g.id)]) { const n = document.querySelector(`.clip[data-clip-id="${id}"]`); if (n) { n.style.transform = ""; n.style.zIndex = ""; } } };
    const fin = (pr) => Promise.resolve(pr).finally(() => { unLift(); requestAnimationFrame(unLift); });
    let start = lastStart != null ? lastStart : c.start + (ev.clientX - startX + scrollDx()) / ui.pxPerSec;   // where it was shown
    if (window.KT2Juice && lastShown != null && !ui.snapOff) start = snapGrid(lastShown);   // the spot nearest to where you saw it
    if (ev.metaKey || ev.ctrlKey) start = c.start + (ev.clientX - startX + scrollDx()) / ui.pxPerSec;
    // Alt-drag copies (Eman, 31 Oct): the copy lands where you let go, the original stays
    if (ev.altKey && t.kind !== "beat") {
      const src = group || [c], d = Math.max(0, start) - c.start;
      const to = !group && targetRow ? targetRow.dataset.trackId : null, toNew = !group && targetRow && targetRow.classList.contains("k2-ghost");
      return fin(run("duplicateClips", { clipIds: src.map((g) => g.id) }).then((r) => {
        if (!r || !r.clipIds || !r.clipIds.length) return;
        const pick = () => { ui.selectedClip = r.clipIds[0]; ui.extraClips = new Set(r.clipIds.slice(1)); render(); };
        // each copy sits right after its original: original start = copy start - length
        const moves = r.clipIds.map((id) => { const k = findClip(id); return k && { clipId: id, start: Math.max(0, k.start - k.length + d) }; }).filter(Boolean);
        if (toNew && moves.length === 1) return run("moveClipToNewLane", { clipId: moves[0].clipId, start: moves[0].start, ...(window.KT2 && KT2.ghostSpot ? KT2.ghostSpot(targetRow) : {}) }).then(pick);
        // KILLTOY 2: a copy only changes the row it shows on. It stays the same pattern with the same
        // sound and colour, never a different channel (Eman, 4 Nov: Alt-drag turned the copy purple)
        if (window.KT2 && KT2.freeRows && KT2.freeRows()) {
          const rowOf = (g, i) => {
            if (!group) return to || g.row || g.track.id;
            const n = document.querySelector(`.clip[data-clip-id="${g.id}"]`), hr = n && n.closest(".row");
            const tr = groupRows && hr ? groupRowList[groupRowList.indexOf(hr) + groupRows] : hr;
            return (tr && tr.dataset.trackId) || g.row || g.track.id;
          };
          return run("setClipRow", { moves: moves.map((m, i) => ({ ...m, row: rowOf(src[i] || src[0], i) })) }).then(pick);
        }
        if (to && moves.length === 1) return run("moveClip", { clipId: moves[0].clipId, start: moves[0].start, trackId: to }).then(pick);
        return run("moveClips", { moves }).then(pick);
      }));
    }
    if (group) {
      const d = Math.max(window.KT2_GROUP_CLAMP_OLD ? 0 : c.start - Math.min(...group.map((g) => g.start)), start) - c.start;
      if (window.KT2 && KT2.freeRows && KT2.freeRows()) {   // KILLTOY 2: the picked clips change rows together, keep their own sound
        const ghostTo = new Map();   // empty grid row -> the picked clips landing there
        const moves = group.map((g) => {
          const n = document.querySelector(`.clip[data-clip-id="${g.id}"]`), hr = n && n.closest(".row");
          const to = groupRows && hr ? groupRowList[groupRowList.indexOf(hr) + groupRows] : hr;
          const m = { clipId: g.id, start: Math.max(0, g.start + d), row: (to && to.dataset.trackId) || g.row || g.track.id };
          if (to && to.classList.contains("k2-ghost") && !window.KT2_GROUP_GHOST_OLD) { if (!ghostTo.has(to)) ghostTo.set(to, []); ghostTo.get(to).push(m); m.ghost = true; }
          return m;
        });
        if (!ghostTo.size) return fin(run("setClipRow", { moves }));
        // the ones on lane rows first, then each empty row (top to bottom) gets a new lane from its first clip and
        // the others show on it; one undo step (later steps drag: true). Each new lane uses up its empty row, so the
        // rows below it in the same gap count from there.
        return fin((async () => {
          let first = true;
          const step = (cmd, a) => { const r = run(cmd, first ? a : { ...a, drag: true }); first = false; return r; };
          const plain = moves.filter((m) => !m.ghost);
          if (plain.length) await step("setClipRow", { moves: plain });
          const used = new Map();
          const order = [...ghostTo.keys()].sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
          for (const gr of order) {
            const spot = window.KT2 && KT2.ghostSpot ? KT2.ghostSpot(gr) : {}, key = spot.before || "";
            const gi = +gr.dataset.gapI || 0, sh = used.get(key) || 0;
            used.set(key, gi + 1);
            const [m0, ...rest] = ghostTo.get(gr);
            const r = await step("moveClipToNewLane", { clipId: m0.clipId, start: m0.start, ...spot, gap: Math.max(0, gi - sh) });
            const nid = r && r.trackId;
            if (rest.length) await step("setClipRow", { moves: rest.map((m) => ({ clipId: m.clipId, start: m.start, row: nid || m.row })) });
          }
        })());
      }
      return fin(run("moveClips", { moves: group.map((g) => ({ clipId: g.id, start: Math.max(0, g.start + d), trackId: g.track.id })) }));
    }
    if (targetRow && targetRow.classList.contains("k2-ghost")) return fin(run("moveClipToNewLane", { clipId: c.id, start: Math.max(0, start), ...(window.KT2 && KT2.ghostSpot ? KT2.ghostSpot(targetRow) : {}) }));
    // KILLTOY 2: the clip only changes the row it shows on; it keeps its own sound and colour
    if (window.KT2 && KT2.freeRows && KT2.freeRows()) {
      const home = node.closest(".row"), to = targetRow ? targetRow.dataset.trackId : home && home.dataset.trackId;
      return fin(run("setClipRow", { clipId: c.id, start: Math.max(0, start), row: to || t.id }));
    }
    fin(run("moveClip", { clipId: c.id, start: Math.max(0, start), trackId: targetRow ? targetRow.dataset.trackId : t.id }));
  };

  // Escape while dragging puts everything back where it was (KT2_DRAG_ESC_OLD = Escape does nothing to the drag)
  const onKey = (ev) => {
    if (ev.key !== "Escape" || !moved || window.KT2_DRAG_ESC_OLD) return;
    ev.preventDefault(); ev.stopPropagation();
    cancelled = true;
    for (const id of [c.id, ...(group || []).map((g) => g.id)]) { const n = document.querySelector(`.clip[data-clip-id="${id}"]`); if (n) { n.style.transform = ""; n.style.zIndex = ""; n.classList.remove("dragging", "k2-copying"); } }
    onUp({ altKey: false, metaKey: false, ctrlKey: false, clientX: startX, clientY: startY });
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  window.addEventListener("keydown", onKey, true);
}

function applyChain(name) {
  const clip = selectedRackClip();
  if (!clip || clip.kind === "midi") return toast("Select a vocal clip, a lane or the beat first.");
  run("applyChain", { ...fxTarget(clip), name }).then((r) => r && r.ok && toast(`${name} on ${clip.name}`));
}

function splitAtPlayhead() {
  const clip = ui.selectedClip && findClip(ui.selectedClip);
  if (!clip) return toast("Select a clip first.");
  run("splitClip", { clipId: clip.id, time: ui.transport.position });
}

function setCutMode(on) {
  ui.cutMode = on;
  $("tool-cut").classList.toggle("on", on);
  document.body.classList.toggle("cut-mode", on);
}

// How far in you can zoom (Eman, 6 Nov 22:58: "zoom a lot more", down to single samples). The whole
// song has to stay under the browser's widest page (~33 million px), so a short song zooms deeper.
// KT2_ZOOM_OLD = the old stop at 400 px a second.
function zoomMax() {
  if (window.KT2_ZOOM_OLD) return 400;
  return Math.max(400, Math.min(240000, 3.0e7 / Math.max(10, songLength() + 16 * secPerBeat())));
}

// Zooms around a point on screen (the pointer, or the middle). While zooming, everything
// is just moved and stretched (fast and smooth); the waveforms redraw sharp right after.
function zoomAt(factor, clientX) {
  const scroll = $("scroll");
  const rect = scroll.getBoundingClientRect();
  const visible = scroll.clientWidth - HEAD_W;
  const px = clientX == null ? visible / 2 : Math.min(visible, Math.max(0, clientX - rect.left - HEAD_W));
  // KT2 leaves a little room before bar 1 (#inner's margin): count it, or every zoom step slid the song
  // under the mouse by that much, and deep zooms lost the spot (bug check, 7 Nov). KT2_ZOOM_LEAD_OLD = old.
  const inner = $("inner"), lead = window.KT2_ZOOM_LEAD_OLD || !inner ? 0 : parseFloat(getComputedStyle(inner).marginLeft) || 0;
  const anchorSec = (scroll.scrollLeft + px - lead) / ui.pxPerSec;
  const next = Math.min(zoomMax(), Math.max(3, ui.pxPerSec * factor));
  if (Math.abs(next - ui.pxPerSec) < 1e-6) return;
  ui.fitted = false;
  ui.pxPerSec = next;
  relayoutTimeline();
  scroll.scrollLeft = Math.max(0, anchorSec * ui.pxPerSec - px + lead);
  clearTimeout(ui.zoomTimer);
  ui.zoomTimer = setTimeout(() => { ui.laneSig = ""; render(); }, 160);
}

// Scrolling near the right edge grows the timeline by another screen.
$("scroll").addEventListener("scroll", () => {
  const sc = $("scroll");
  if (ui.state && sc.scrollLeft + sc.clientWidth > HEAD_W + parseFloat($("inner").style.width || "0") - (sc.clientWidth - HEAD_W) / 2) relayoutTimeline();
}, { passive: true });

function relayoutTimeline() {
  if (!ui.state) return;
  const width = timelineWidth();
  $("inner").style.width = HEAD_W + width + "px";
  $("timeline-top").style.width = width + "px";
  setGrid();
  document.querySelectorAll(".lane").forEach((l) => (l.style.width = width + "px"));
  document.querySelectorAll(".clip").forEach((n) => {
    const c = findClip(n.dataset.clipId);
    if (!c) return;
    n.style.left = toX(c.start) + "px";
    n.style.width = Math.max(4, toX(c.length)) + "px";
  });
  document.querySelectorAll(".take-strip").forEach((n) => {
    const c = findClip(n.dataset.clipId);
    if (c) { n.style.left = toX(c.start) + "px"; n.style.width = Math.max(4, toX(c.length)) + "px"; }
  });
  renderSections(width);
  renderRuler(width);
  renderTransport();
}

// ---------------------------------------------------------------------------
// Vocal tools: Tune, Align, Clean, Gate, Stems, Send to AI. Slow ones run as jobs
// in the app and show up in the corner with a progress bar.
const TOOLS = [
  { id: "tune",  label: "Tune",  color: "#e4ff3a", tip: "Pitch editor: see every note, drag it, or snap the take to the key" },
  { id: "align", label: "Align", color: "#3dd6f5", tip: "Line this take up with the Lead Vox timing (for doubles + stacks)" },
  { id: "clean", label: "Clean", color: "#b79cff", tip: "AI noise removal: hiss, hum, room and headphone bleed" },
  { id: "gate",  label: "Gate",  color: "#8b5cf6", tip: "Add the Vocal Gate: silences the gaps between phrases" },
  { id: "stems", label: "Stems", color: "#ff4fb8", tip: "Split into vocals, drums, bass and music (the beat, if no vocal clip is picked)" },
  { id: "ai",    label: "Send to AI",    color: "#ffb547", tip: "Send this clip to ACE-Step: restyle it, or make new parts from a prompt" },
  { id: "notes", label: "Edit notes",    color: INST_COLOR, tip: "Open the piano roll for this MIDI clip (or double-click the clip)" },
];

function renderTools(clip) {
  const box = $("vtools");
  if (!box.childElementCount) {
    for (const t of TOOLS) {
      const b = el("button", "vtool");
      b.dataset.tool = t.id;
      b.style.setProperty("--tc", t.color);
      b.textContent = t.label;
      b.title = t.tip;
      b.onclick = (e) => { e.stopPropagation(); runTool(t.id, b); };
      box.append(b);
    }
  }
  // Vocal tools work on vocal clips; Stems and Send to AI also take the beat. A MIDI clip
  // gets its note editor instead.
  const beat = beatClip();
  const kind = !clip || clip.lane ? "none" : clip.kind === "midi" ? "midi" : clip.track.kind === "beat" ? "beat" : "vocal";
  box.querySelectorAll(".vtool").forEach((b) => {
    const t = b.dataset.tool;
    b.hidden = (kind === "midi") !== (t === "notes");
    b.disabled = t === "stems" ? !(kind === "vocal" || kind === "beat" || beat)
               : t === "ai" ? !(kind === "vocal" || kind === "beat")
               : t === "notes" ? kind !== "midi"
               : kind !== "vocal";
  });
}

const beatClip = () => {
  const t = ui.state && ui.state.tracks.find((x) => x.kind === "beat");
  return t && t.clips[0] ? { ...t.clips[0], track: t } : null;
};

function needsAiTools(what) {
  const ai = ui.state.ai || {};
  if (ai.installed) return false;
  showMenu($("logo"), [
    { heading: `${what} uses the AI tools` },
    ai.installing ? { label: "Installing now\u2026", meta: "see corner", run: () => {} }
                  : { label: "Install AI tools", meta: "~1 GB, once", cta: true, run: installAiTools },
  ]);
  return true;
}

function installVoiceTools() {
  run("installVoiceTools").then((r) => r && r.ok && toast("Installing the voice changer (about 3 GB). It takes a while the first time; keep KILLTOY open."));
}

function installAiTools() {
  run("installAiTools").then((r) => r && r.ok && toast("Installing the AI tools. This takes a few minutes the first time."));
}

function runTool(id, anchor) {
  const clip = selectedTakeClip();
  switch (id) {
    case "notes": { const m = selectedRackClip(); return m && m.kind === "midi" && openRoll(m); }
    case "tune": return clip && openTune(clip);
    case "gate": return clip && run("addPlugin", { clipId: clip.id, key: "builtin:purpgate" }).then((r) => r && r.ok && toast("Vocal Gate added. Turn Threshold up until the gaps go quiet."));
    case "align": {
      if (!clip) return;
      const lead = ui.state.tracks.find((t) => t.role === "lead" && t.id !== clip.track.id);
      if (!lead) return toast(clip.track.role === "lead" ? "This is the lead. Pick a double or harmony to line up with it."
                                                         : "Align follows a Lead Vox lane. Record or import the lead first.");
      return showMenu(anchor, [
        { heading: `LINE UP WITH ${lead.name.toUpperCase()}` },
        { label: "Tight", meta: "every word", run: () => run("align", { clipId: clip.id, guideTrackId: lead.id, strength: 1 }) },
        { label: "Natural", meta: "keeps some feel", run: () => run("align", { clipId: clip.id, guideTrackId: lead.id, strength: 0.7 }) },
      ], { above: true });
    }
    case "clean": {
      if (!clip || needsAiTools("Clean")) return;
      return showMenu(anchor, [
        { heading: "REMOVE NOISE" },
        { label: "Light", meta: "keeps the air", run: () => run("cleanVocal", { clipId: clip.id, strength: 0.3 }) },
        { label: "Medium", run: () => run("cleanVocal", { clipId: clip.id, strength: 0.6 }) },
        { label: "Strong", meta: "noisy room", run: () => run("cleanVocal", { clipId: clip.id, strength: 0.9 }) },
      ], { above: true });
    }
    case "stems": {
      if (needsAiTools("Stems")) return;
      const target = clip || beatClip();
      if (!target) return;
      return run("splitStems", { clipId: target.id }).then((r) => r && r.ok && toast(`Splitting ${target.name}. Stems arrive as muted lanes: solo one to hear it.`));
    }
    case "ai": { const r = selectedRackClip(); return showAiForm(anchor, clip || (r && !r.lane && r.track.kind === "beat" ? r : null)); }
  }
}

function showAiForm(anchor, clip) {
  const ai = (ui.state && ui.state.ai) || {};
  const pop = $("pop");
  pop.replaceChildren();
  const form = el("div", "ai-form");
  form.onclick = (e) => e.stopPropagation();
  let mode = clip ? "cover" : "music";

  const title = el("div", "label", clip ? `Send "${clip.name}" to AI` : "Make something new with AI");
  const seg = el("div", "seg");
  const bCover = el("button", "pill", "Restyle this clip");
  const bNew = el("button", "pill", "New part");
  const setMode = (m) => { mode = m; bCover.classList.toggle("on", m === "cover"); bNew.classList.toggle("on", m === "music"); };
  bCover.disabled = !clip;
  bCover.onclick = () => setMode("cover");
  bNew.onclick = () => setMode("music");
  seg.append(bCover, bNew);
  seg.className = "seg";

  const prompt = el("textarea");
  prompt.placeholder = "Describe it: \"airy female harmony, R&B\", \"gritty male double\"\u2026";
  const lyrics = el("textarea");
  lyrics.placeholder = "Lyrics (optional)";
  const send = el("button", "pill go", "Send");
  const where = el("div", "label", `ACE-Step at ${(ai.aceStepUrl || "").replace(/^https?:\/\//, "")}  \u00b7  change it in the logo menu`);
  send.onclick = () => {
    const target = clip || beatClip();
    if (!target) return toast("Load a beat first.");
    hidePop();
    run("sendToAI", { clipId: target.id, mode, prompt: prompt.value, lyrics: lyrics.value, strength: 0.6 })
      .then((r) => r && r.ok && toast("Sent. The result comes back on its own lane, on the same bar."));
  };
  [prompt, lyrics].forEach((t) => (t.onkeydown = (e) => e.stopPropagation()));
  form.append(title, seg, prompt, lyrics, send, where);
  pop.append(form);
  setMode(mode);
  placePop(anchor, true);
  prompt.focus();
}

function promptAceStepUrl() {
  const pop = $("pop");
  pop.replaceChildren();
  const input = el("input");
  input.value = (ui.state.ai && ui.state.ai.aceStepUrl) || "http://127.0.0.1:8001";
  input.onclick = (e) => e.stopPropagation();
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") hidePop();
    if (e.key !== "Enter") return;
    hidePop();
    run("setAiSettings", { aceStepUrl: input.value.trim() }).then((r) => r && r.ok && toast("Saved the ACE-Step address."));
  };
  pop.append(el("div", "label", "ACE-Step address (Enter to save)"), input);
  placePop($("logo"));
  input.focus();
  input.select();
}

// The loading screen while a project opens: its name and how many sounds have arrived. It
// lifts once the sounds are in (or after 15 s, or on Skip); the rest keeps loading in the corner.
function showVeil(name) {
  clearTimeout(ui.veil && ui.veil.timer);
  ui.veil = { opened: false, timer: setTimeout(hideVeil, 15000) };
  $("veil-name").textContent = name || "Loading";
  $("veil-stage").textContent = "Opening\u2026";
  $("veil-fill").style.width = "4%";
  $("veil").hidden = false;
}
function hideVeil() {
  if (ui.veil) clearTimeout(ui.veil.timer);
  ui.veil = null;
  $("veil").hidden = true;
}
function updateVeil() {
  const v = ui.veil;
  if (!v) return;
  const job = ((ui.state && ui.state.jobs) || []).find((j) => j.loading);
  if (ui.state && v.opened && ui.state.session) $("veil-name").textContent = ui.state.session;
  if (job) {
    v.sawJob = true;
    $("veil-stage").textContent = "Loading sounds \u00b7 " + job.stage;
    $("veil-fill").style.width = Math.max(4, Math.round(job.progress * 100)) + "%";
  } else if (v.opened) { $("veil-fill").style.width = "100%"; setTimeout(hideVeil, v.sawJob ? 150 : 0); }
}

// Stem split running on a clip (Eman, 10 Nov): no card in the corner. The clip keeps its real wave and
// still plays; on top of it the part that's done gets a light dark tint, a soft glowing edge pulses
// where the split is, and a small tag names the model and how far it is ("ROFORMER 41%").
// Nothing here takes clicks. Clips are rebuilt on every render, so this runs each time (cheap).
function clipGhosts(jobs) {
  if (!document.getElementById("k2-sghost-css")) {
    const s = document.createElement("style"); s.id = "k2-sghost-css";
    s.textContent = `
.k2-sghost{position:absolute;left:0;right:0;bottom:0;pointer-events:none;z-index:3;overflow:hidden}
.k2-sghost-fill{position:absolute;left:0;top:0;bottom:0;background:rgba(14,10,28,.3);transition:width .4s linear}
.k2-sghost-fill::after{content:"";position:absolute;right:-10px;top:0;bottom:0;width:20px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:k2ghost 1.4s ease-in-out infinite}
.k2-sghost-tag{position:absolute;left:6px;bottom:4px;padding:2px 6px;background:rgba(14,12,20,.78);color:#ecebf2;font:600 9px var(--font,Inter,sans-serif);letter-spacing:.12em;white-space:nowrap;animation:k2ghost 1.4s ease-in-out infinite}
@keyframes k2ghost{0%,100%{opacity:.45}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.k2-sghost-fill::after,.k2-sghost-tag{animation:none}.k2-sghost-fill{transition:none}}`;
    document.head.appendChild(s);
  }
  const want = new Map(jobs.map((j) => [j.clipId, j]));
  document.querySelectorAll(".k2-sghost").forEach((g) => { if (!want.has(g.dataset.clipId) || !g.parentNode.isConnected) g.remove(); });
  for (const [id, j] of want) {
    for (const clip of document.querySelectorAll(".clip")) {
      if (clip.dataset.clipId !== id) continue;
      let g = clip.querySelector(":scope > .k2-sghost");
      if (!g) {
        g = el("div", "k2-sghost"); g.dataset.clipId = id;
        g.append(el("div", "k2-sghost-fill"), el("span", "k2-sghost-tag"));
        clip.append(g);
      }
      // over the wave only (under the clip's name bar)
      const cv = clip.querySelector("canvas");
      g.style.top = (cv ? cv.offsetTop : 0) + "px";
      const pc = Math.max(0, Math.min(1, j.progress || 0));
      g.firstChild.style.width = Math.round(pc * 1000) / 10 + "%";
      g.lastChild.textContent = ((j.engine || "Splitting") + " " + Math.round(pc * 100) + "%").toUpperCase();
    }
  }
}

function renderJobs() {
  const box = $("jobs");
  updateVeil();
  const all = (ui.state && ui.state.jobs) || [];
  // a job tied to a clip (stem split) shows on the clip itself; only a failure gets a card
  const jobs = all.filter((j) => j.kind !== "variation" && (!j.clipId || j.failed)); // variations load in their lane
  updateVariationProgress();
  ui.ghostJobs = all.filter((j) => j.clipId && !j.finished);
  const sig = JSON.stringify(jobs);
  if (sig === ui.jobsSig) return;
  ui.jobsSig = sig;
  box.replaceChildren(...jobs.map((j) => {
    const n = el("div", "job" + (j.failed ? " failed" : j.finished ? " done" : ""));
    const top = el("div", "job-top");
    top.append(el("span", null, j.label), el("span", null, j.failed ? "Failed" : j.finished ? "Done" : Math.round(j.progress * 100) + "%"));
    const bar = el("div", "job-bar");
    const fill = el("div");
    fill.style.width = Math.round((j.finished ? 1 : j.progress) * 100) + "%";
    bar.append(fill);
    n.append(top, el("div", "job-stage", j.finished ? j.message : j.stage), bar);
    return n;
  }));
}

// ---------------------------------------------------------------------------
// Piano roll for MIDI clips. Notes are in beats from the clip start. Every finished
// edit sends the clip's whole note list to the engine (one undo step each).
const ROLL_KEYS = 46;
const ROLL_ROW = 15;

function openRoll(c) {
  const fc = findClip(c.id);
  if (fc) openLaneWindow({ t: fc.track, clip: fc, view: "midi" });
}
const closeRoll = () => closeLaneWindow();

function setRollClip(c) {
  if (ui.roll && ui.roll.clipId === c.id) return;
  const pitches = (c.notes || []).map((n) => n.pitch);
  const centre = pitches.length ? Math.round((Math.min(...pitches) + Math.max(...pitches)) / 2) : 60;
  ui.roll = { clipId: c.id, notes: (c.notes || []).map((n) => ({ ...n })), top: centre + 14, grid: Number($("roll-grid").value),
              lastLen: 1, drag: null, pending: 0 };
}

function refreshRoll() {
  const r = ui.roll;
  const c = r && findClip(r.clipId);
  // A lane with no MIDI clip (or whose clip was just deleted) shows a hint instead of the roll.
  $("roll-canvas").hidden = !c;
  $("roll-empty").hidden = !!c;
  for (const id of ["roll-bars", "roll-grid", "roll-play", "roll-clear", "roll-quant", "roll-fold", "roll-tools"]) $(id).disabled = !c;
  if (!c) { ui.roll = null; $("roll-name").textContent = "Notes"; $("roll-sub").textContent = ""; return; }
  if (!r.drag && !r.pending) {
    const fresh = (c.notes || []).map((n) => ({ ...n }));
    if (window.MidiTools) MidiTools.keepSel(r, fresh); // the selection follows the fresh copies
    r.notes = fresh;
  }
  $("roll-name").textContent = c.name;
  $("roll-sub").textContent = `bar ${fmtBars(c.start)}`;
  const bars = String(Math.max(1, Math.round((c.beats || 16) / 4)));
  if ([...$("roll-bars").options].some((o) => o.value === bars)) $("roll-bars").value = bars;
  drawRoll();
}

function rollGeometry() {
  const cv = $("roll-canvas");
  const c = findClip(ui.roll.clipId);
  const W = cv.clientWidth, H = cv.clientHeight;
  const beats = Math.max(0.25, (c && c.beats) || 16);
  return { cv, c, W, H, beats, pxPerBeat: (W - ROLL_KEYS) / beats, rows: Math.ceil(H / ROLL_ROW) };
}

const isBlackKey = (p) => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
// Row i of the roll (from the top) to its pitch and back; miditools.js folds the rows to the
// song's scale (Fold). A pitch that isn't shown gives row -1.
const rollPitchAt = (i) => window.MidiTools ? MidiTools.pitchAt(ui.roll, i) : ui.roll.top - i;
const rollRowOf = (p) => window.MidiTools ? MidiTools.rowOf(ui.roll, p) : ui.roll.top - p;

function drawRoll() {
  const r = ui.roll;
  if (!r) return;
  const { cv, c, W, H, beats, pxPerBeat, rows } = rollGeometry();
  if (!W || !H || !c) return;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  g.font = "10px " + cssVar("--font");
  const ink3 = cssVar("--ink-3"), line = cssVar("--line"), line2 = cssVar("--line-2");

  // Rows: black keys a little darker, a line under every C.
  for (let i = 0; i < rows; i++) {
    const pitch = rollPitchAt(i), y = i * ROLL_ROW;
    if (pitch < 0) break;
    if (isBlackKey(pitch)) { g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(ROLL_KEYS, y, W - ROLL_KEYS, ROLL_ROW); }
    g.fillStyle = isBlackKey(pitch) ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.08)";
    g.fillRect(0, y, ROLL_KEYS - 6, ROLL_ROW - 1);
    if (window.MidiTools) MidiTools.paintRow(g, pitch, y, W, ROLL_KEYS, ROLL_ROW); // the song's scale
    if (pitch % 12 === 0) {
      g.fillStyle = line2;
      g.fillRect(0, y + ROLL_ROW - 1, W, 1);
      g.fillStyle = ink3;
      g.fillText("C" + (Math.floor(pitch / 12) - 1), 6, y + ROLL_ROW - 4);
    }
  }

  // Grid: steps faint, beats stronger, bars strongest.
  for (let b = 0; b <= beats + 1e-6; b += r.grid) {
    const x = ROLL_KEYS + b * pxPerBeat;
    const isBar = Math.abs(b / 4 - Math.round(b / 4)) < 1e-6, isBeat = Math.abs(b - Math.round(b)) < 1e-6;
    g.fillStyle = isBar ? line2 : isBeat ? line : "rgba(255,255,255,0.025)";
    g.fillRect(Math.round(x), 0, 1, H);
    if (isBar) { g.fillStyle = ink3; g.fillText(String(Math.round(b / 4) + 1), x + 4, 11); }
  }

  // Notes (slide notes in acid yellow; dragging one shows it white)
  for (const n of r.notes) {
    const row = rollRowOf(n.pitch);
    if (row < 0 || row >= rows) continue;
    const x = ROLL_KEYS + n.start * pxPerBeat, w = Math.max(3, n.length * pxPerBeat - 1);
    g.fillStyle = r.drag && r.drag.note === n ? (n.slide ? "#fff" : cssVar("--acid")) : n.slide ? cssVar("--acid") : INST_COLOR;
    g.globalAlpha = 0.55 + 0.45 * (n.velocity || 100) / 127;
    g.fillRect(x, row * ROLL_ROW + 1, w, ROLL_ROW - 2);
    g.globalAlpha = 1;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(x + w - 3, row * ROLL_ROW + 3, 2, ROLL_ROW - 6);
    if (r.sel && r.sel.has(n)) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.strokeRect(x + 0.75, row * ROLL_ROW + 1.75, w - 1.5, ROLL_ROW - 3.5); }
  }
  if (window.MidiTools) MidiTools.paintBox(g); // Shift-drag selection box

  // Slides: a curve over the overlap, from the note underneath to the slide note.
  for (const s of rollSlides(r.notes)) {
    const x0 = ROLL_KEYS + s.note.start * pxPerBeat, x1 = x0 + s.beats * pxPerBeat;
    const y0 = (rollRowOf(s.from.pitch) + 0.5) * ROLL_ROW, y1 = (rollRowOf(s.note.pitch) + 0.5) * ROLL_ROW;
    g.save();
    g.strokeStyle = cssVar("--acid"); g.lineWidth = 2; g.lineCap = "round";
    g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + (x1 - x0) * 0.5, y0, x0 + (x1 - x0) * 0.5, y1, x1, y1); g.stroke();
    g.globalAlpha = 0.16; g.lineTo(x1, y0); g.closePath(); g.fillStyle = cssVar("--acid"); g.fill();
    g.globalAlpha = 1; g.fillStyle = cssVar("--acid");
    g.beginPath(); g.arc(x0, y0, 3, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // Playhead, when it's inside this clip.
  const pos = ui.transport.position - c.start;
  if (pos >= 0 && pos <= c.length) {
    g.fillStyle = cssVar("--acid");
    g.fillRect(ROLL_KEYS + (pos / secPerBeat()) * pxPerBeat, 0, 1, H);
  }
}

// Which slide notes glide from which note (same rule as the TOY MACHINE engine's planSlides in
// toy-machine.js): the latest note still sounding when the slide note starts (nearest pitch on a tie);
// it glides over the overlap.
function rollSlides(notes) {
  const out = [], gone = new Set(), end = new Map(notes.map((n) => [n, n.start + n.length]));
  for (const s of [...notes].sort((a, b) => a.start - b.start)) {
    if (!s.slide) continue;
    let p = null;
    for (const q of notes) if (q !== s && !gone.has(q) && q.start < s.start && end.get(q) > s.start
      && (!p || q.start > p.start || (q.start === p.start && Math.abs(q.pitch - s.pitch) < Math.abs(p.pitch - s.pitch)))) p = q;
    if (!p) continue;
    out.push({ note: s, from: p, beats: Math.min(end.get(p), end.get(s)) - s.start });
    end.set(s, Math.max(end.get(p), end.get(s)));
    gone.add(p);
  }
  return out;
}

function rollHit(e) {
  const r = ui.roll;
  const { cv, pxPerBeat } = rollGeometry();
  const rect = cv.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const beat = (x - ROLL_KEYS) / pxPerBeat;
  const pitch = rollPitchAt(Math.floor(y / ROLL_ROW));
  const note = r.notes.find((n) => n.pitch === pitch && beat >= n.start && beat <= n.start + n.length);
  const nearEnd = note && (ROLL_KEYS + (note.start + note.length) * pxPerBeat) - x < 7;
  return { x, beat, pitch, note, nearEnd };
}

function commitRoll() {
  const r = ui.roll;
  if (!r) return;
  r.pending++;
  run("setMidiNotes", { clipId: r.clipId, notes: r.notes.map(({ pitch, start, length, velocity, slide, group }) => ({ pitch, start, length, velocity: velocity || 100, ...(slide ? { slide: true } : {}), ...(group ? { group } : {}) })) })
    .finally(() => { if (ui.roll) ui.roll.pending = Math.max(0, ui.roll.pending - 1); });
}

// FL Studio-style preview: pressing a note (or a key on the left) sounds it through the
// lane's instrument, dragging it up or down sounds each new pitch, letting go stops it.
let rollHeard = null;
function rollPreview(pitch, velocity) {
  if (!ui.roll || rollHeard === pitch) return;
  rollHeard = pitch;
  booth("previewNote", { clipId: ui.roll.clipId, pitch, velocity: velocity || 100 });
}
function rollPreviewOff() {
  if (rollHeard == null) return;
  rollHeard = null;
  booth("previewNoteOff", {});
}

$("roll-canvas").addEventListener("mousedown", (e) => {
  const r = ui.roll;
  if (!r) return;
  const { beats } = rollGeometry();
  const h = rollHit(e);
  if (h.pitch < 0 || h.pitch > 127) return;
  if (h.x < ROLL_KEYS) { // the keyboard: hold a key to hear it
    if (e.button !== 0) return;
    rollPreview(h.pitch);
    const up = () => { window.removeEventListener("mouseup", up); rollPreviewOff(); };
    window.addEventListener("mouseup", up);
    return;
  }
  if (e.button === 0 && window.MidiTools && MidiTools.mouseDown(e, h)) return; // Shift: select
  if (e.button === 2) {
    if (h.note) { r.notes.splice(r.notes.indexOf(h.note), 1); drawRoll(); commitRoll(); }
    return;
  }
  if (e.button !== 0) return;
  const step = r.grid;
  let mode, note = h.note, grab = 0;
  if (note) {
    mode = h.nearEnd ? "resize" : "move";
    grab = h.beat - note.start;
  } else {
    const start = Math.max(0, Math.min(beats - step, Math.floor(h.beat / step) * step));
    note = { pitch: h.pitch, start, length: Math.min(r.lastLen, beats - start), velocity: 100 };
    r.notes.push(note);
    mode = "draw";
  }
  const before = JSON.stringify(note);
  // The selected notes move together (a note picked outside the selection becomes the selection).
  const others = window.MidiTools ? MidiTools.grab(r, note, mode) : [];
  const start0 = note.start, pitch0 = note.pitch;
  r.drag = { note, mode };
  drawRoll();
  rollPreview(note.pitch, note.velocity);

  const onMove = (ev) => {
    const m = rollHit(ev);
    if (mode === "move") {
      note.start = Math.max(0, Math.min(beats - note.length, Math.round((m.beat - grab) / step) * step));
      note.pitch = Math.max(0, Math.min(127, m.pitch));
      for (const o of others) {
        o.n.start = Math.max(0, Math.min(beats - o.n.length, o.start + note.start - start0));
        o.n.pitch = Math.max(0, Math.min(127, o.pitch + note.pitch - pitch0));
      }
      rollPreview(note.pitch, note.velocity);
    } else {
      const end = Math.max(note.start + step, Math.min(beats, Math.ceil(m.beat / step) * step));
      note.length = end - note.start;
    }
    drawRoll();
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    r.drag = null;
    rollPreviewOff();
    if (mode !== "move") r.lastLen = note.length;
    drawRoll();
    if (mode === "draw" || JSON.stringify(note) !== before) commitRoll();
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
});

$("roll-canvas").addEventListener("mousemove", (e) => {
  if (!ui.roll || ui.roll.drag) return;
  const h = rollHit(e);
  $("roll-canvas").style.cursor = h.note ? (h.nearEnd ? "ew-resize" : "move") : "crosshair";
});
// Double-click a note: Slide (FL Studio-style: glides from the note it overlaps, over the
// overlap) or Delete. Right-click still deletes straight away.
$("roll-canvas").addEventListener("dblclick", (e) => {
  const r = ui.roll;
  const h = r && rollHit(e);
  if (!h || !h.note) return;
  const n = h.note, trial = { ...n, slide: true };
  const overlaps = rollSlides([...r.notes.filter((x) => x !== n), trial]).some((s) => s.note === trial);
  showMenu(atMouse(e), [
    { heading: "NOTE" },
    { label: n.slide ? "Slide \u2713" : "Slide", meta: overlaps ? "" : "overlap a note",
      run: () => { if (n.slide) delete n.slide; else n.slide = true; drawRoll(); commitRoll();
                   if (n.slide && !overlaps) toast("Slide is on. Drag the note so it starts over another note: it glides for as long as they overlap."); } },
    { label: "Delete", run: () => { r.notes.splice(r.notes.indexOf(n), 1); drawRoll(); commitRoll(); } },
  ]);
});
$("roll-canvas").addEventListener("contextmenu", (e) => e.preventDefault());
$("roll-canvas").addEventListener("wheel", (e) => {
  if (!ui.roll) return;
  e.preventDefault();
  ui.roll.top = Math.max(24, Math.min(127, ui.roll.top + (e.deltaY < 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(e.deltaY) / 30))));
  drawRoll();
}, { passive: false });
$("roll-grid").onchange = () => { if (ui.roll) { ui.roll.grid = Number($("roll-grid").value); drawRoll(); } };
$("roll-bars").onchange = () => ui.roll && run("setClipLength", { clipId: ui.roll.clipId, beats: Number($("roll-bars").value) * 4 });
$("roll-clear").onclick = () => { if (ui.roll) { ui.roll.notes = []; drawRoll(); commitRoll(); } };
$("roll-play").onclick = () => {
  const c = ui.roll && findClip(ui.roll.clipId);
  if (!c) return;
  if (ui.transport.playing) return run("togglePlay");
  run("setPosition", { time: c.start }).then(() => run("togglePlay"));
};
new ResizeObserver(() => drawRoll()).observe($("roll-canvas"));

// ---------------------------------------------------------------------------
// A MIDI lane's window: MIDI (the piano roll) and the lane's instrument (TOY MACHINE,
// KILLTOY Synth, or a plugin) as two tabs of one window, with Split between them to see
// both side by side. Double-clicking a MIDI clip opens it on MIDI; opening the synth
// (lane card, rack, menu) opens it on the synth. Left in Split, it opens in Split next time.
let iw = null; // { trackId, pluginId, view, single, inst: "tm" | "panel" | null, instFor, native }

const laneInstrument = (t, c) =>
  (c && (c.plugins || []).find((x) => x.instrument)) || (t.plugins || []).find((x) => x.instrument)
  || t.clips.flatMap((k) => k.plugins || []).find((x) => x.instrument) || null;

// The lane's MIDI clip to edit: the selected one, else the one under the playhead, else the first.
function laneMidiClip(t) {
  const midi = t.clips.filter((c) => c.kind === "midi").sort((a, b) => a.start - b.start);
  const pos = ui.transport.position;
  const c = midi.find((x) => x.id === ui.selectedClip) || midi.find((x) => pos >= x.start && pos < x.start + x.length) || midi[0];
  return c ? findClip(c.id) : null;
}

// A KILLDRUM lane isn't MIDI to the person (Eman, 27 Oct): its window is KILLDRUM only (BEAT | FX inside),
// no MIDI or Split tab, and opening the lane or its clip goes straight there. The notes stay as its data.
const isKillDrumLane = (t) => !!t && (/toy ?drums|killdrum/i.test(t.instrument || "") || t.clips.some((c) => (c.plugins || []).some((p) => p.kit)));

// A TOY MACHINE lane (Eman, 27 Oct): tabs TOY MACHINE | Split | MIDI, it always opens on TOY MACHINE,
// and its MIDI tab is TOY MACHINE's own MIDI view (ui/toymachine-midi.js), not the app's piano roll.
const isToyMachineLane = (t) => !!t && (/toy (machine|keys)/i.test(t.instrument || "") || /toy (machine|keys)/i.test((laneInstrument(t, null) || {}).name || ""));
// MIDI FOR EVERY SYNTH (Eman, 26 Nov: "the midi creator is the midi in the daw, not connected to toy machine specifically"):
// the MIDI tab (dice, sciences, slides, rhythm row, all of it) opens on every instrument lane (KILLTOY Synth, u wanna,
// TOY GTR, BLOB, Serum or any plugin in the app), not only TOY MACHINE / TOY KEYS. KILLDRUM keeps its own BEAT page.
// KT2_MIDI_ANY_OLD = other synths get the old plain piano roll.
const isMidiToolLane = (t) => isToyMachineLane(t) || (!window.KT2_MIDI_ANY_OLD && !!t && !isKillDrumLane(t) && !!window.TmMidi &&
  (t.kind === "inst" || t.role === "inst" || (t.clips || []).some((c) => c.kind === "midi")));

// how long a new MIDI pattern is: 4 bars everywhere
function NEW_PATTERN_BARS() { return 4; }   // KILLTOY 2 too (Eman, 5 Nov 01:56; was 16 there)

function openLaneWindow({ t, clip, plugin, view }) {
  if (!t) return;
  hidePop();
  // a stacked synth (KILLTOY 2) opens in its main lane's window, on its own sound tab
  if (t.layerOf) { const m = ui.state.tracks.find((x) => x.id === t.layerOf); if (m) { plugin = plugin || laneInstrument(t, null); t = m; } }
  if (isKillDrumLane(t)) view = "inst";
  const tm = isToyMachineLane(t);
  // KILLTOY 2 (Eman, 31 Oct): a plugin or MIDI clip opens on SPLIT (notes and sound side by side)
  const k2split = document.documentElement.classList.contains("kt2") && !isKillDrumLane(t);
  // (4 Nov: KILLTOY 2 now opens on the view that was asked for, MIDI from a pattern, the synth from INST;
  // ui/kt2.js remembers each pattern's last view)
  if (tm && !k2split) view = iw && iw.trackId === t.id ? iw.view : "inst";
  if (!view) view = "midi";
  if (!iw || iw.trackId !== t.id) {
    closeLaneWindow();
    iw = { trackId: t.id, pluginId: null, view, single: view, inst: null, instFor: null, native: false };
    // TOY MACHINE comes back on the tab it was left on (CREATE stays CREATE). KT2_CS_KEEP_OLD = always VST
    if (!window.KT2_CS_KEEP_OLD && laneTmModes.get(t.id)) iw.tmMode = laneTmModes.get(t.id);
  }
  const c = clip && clip.kind === "midi" ? findClip(clip.id) : laneMidiClip(t);
  if (c) setRollClip(c);
  else ui.roll = null;
  const p = plugin || (iw.pluginId && findPlugin(iw.pluginId) ? null : laneInstrument(t, c));
  if (p && p.id !== iw.pluginId) { teardownLaneInst(); iw.pluginId = p.id; }
  $("iw").hidden = false;
  refreshLaneWindow();
  setLaneView(ui.laneSplit && !isKillDrumLane(t) && !tm && !k2split ? "split" : view);
}

const laneTmModes = new Map();   // track id -> "create" | "presets" (the TOY MACHINE tab it was left on)
function closeLaneWindow() {
  if (!iw) return;
  if (iw.tmMode) laneTmModes.set(iw.trackId, iw.tmMode);
  if (window.TmMidi) TmMidi.hide();
  teardownLaneInst();
  iw = null;
  ui.roll = null;
  $("iw").hidden = true;
}

function teardownLaneInst() {
  const w = iw;
  if (!w) return;
  unfoldLaneHead();
  if (w.inst === "tm" || w.inst === "tk") { w.inst = null; closeToyMachine(); }
  if (w.inst === "kd") { w.inst = null; closeKillDrum(); }
  if (w.inst === "blob") { w.inst = null; KT2Blob.unmount(); }
  if (plugCardAway()) { ui.plugwin = null; $("plugwin").append(plugCard); }
  $("iw-inst").replaceChildren();
  Object.assign(w, { inst: null, instFor: null, native: false });
}

function setLaneView(v) {
  if (!iw) return;
  iw.view = v;
  if (v !== "split") iw.single = v;
  const t = ui.state && ui.state.tracks.find((x) => x.id === iw.trackId);
  const kdLane = isKillDrumLane(t), tmLane = isToyMachineLane(t);
  if (!kdLane && !tmLane) ui.laneSplit = v === "split";
  $("iw-card").classList.toggle("split", v === "split");
  const midiLane = isMidiToolLane(t);
  $("roll").hidden = v === "inst" || midiLane;
  $("iw-tmidi").hidden = v === "inst" || !midiLane;
  $("iw-inst").hidden = v === "midi";
  if (midiLane && v !== "inst") { showToyMachineMidi(t); laneVoiceFromPick(t); }
  else if (window.TmMidi) TmMidi.hide();
  for (const b of document.querySelectorAll(".iw-tab")) b.classList.toggle("on", b.dataset.view === v);
  if (v !== "midi") showLaneInst();
  if (typeof laneTmMode === "function") laneTmMode();
  foldLaneHead();
  placeLayerRow();
  requestAnimationFrame(drawRoll);
}

// The lane window's header looks like TOY MACHINE's own top bar on every tab: logo, then the
// MIDI | Split | synth tabs, the lane in the middle, Done on the right. On TOY MACHINE's tab the
// synth is the whole window, so the tabs and Done move into its top bar instead (one bar, not
// two); unfoldLaneHead puts them back.
function foldLaneHead() {
  const card = $("iw-card"), pane = $("iw-inst");
  const bar = iw && iw.view === "inst" && pane.querySelector(".tm-top");
  if (!bar) return unfoldLaneHead();
  bar.querySelector(".tm-brand").append(card.querySelector(".iw-tabs"));
  bar.querySelector(".tm-topright").append(card.querySelector(".iw-end"));
  card.classList.add("iw-full");
  placeLayerRow();
}
function unfoldLaneHead() {
  const card = $("iw-card"), head = card.querySelector(".iw-head");
  if (!card.classList.contains("iw-full")) return;
  head.querySelector(".iw-brand").append(card.querySelector(".iw-tabs"));
  head.append(card.querySelector(".iw-end"));
  card.classList.remove("iw-full");
  placeLayerRow();
}

// Fill the synth tab the first time it shows: TOY MACHINE's own window, or the KILLTOY
// knob panel (built-ins, and a plugin's knobs in the app, which also opens its own window).
async function showLaneInst() {
  const w = iw;
  if (w && w.all) { const t = ui.state.tracks.find((x) => x.id === w.trackId); if (w.instFor !== "all") { teardownLaneInst(); } if (t) laneAllView(t); return; }
  if (!w || (w.instFor && w.instFor === w.pluginId)) return;
  const pane = $("iw-inst");
  teardownLaneInst();
  const hit = w.pluginId && findPlugin(w.pluginId);
  const t = !hit && ui.state.tracks.find((x) => x.id === w.trackId);
  if (t && t.kind === "inst" && t.instrument && !t.clips.length && !w.making) {
    // In the browser the synth rides on the lane's MIDI clips, so a fresh lane gets a 4-bar clip
    // first; the state refresh then finds the synth and fills this tab.
    w.making = true;
    const pos = (ui.transport && ui.transport.position) || 0;
    run("newMidiClip", { trackId: t.id, start: Math.floor(pos / secPerBar() + 1e-6) * secPerBar(), bars: NEW_PATTERN_BARS() });
    return pane.append(el("div", "iw-msg", `Loading ${t.instrument}\u2026`));
  }
  if (!hit) return pane.append(el("div", "iw-msg", "This lane has no synth yet. Right-click the lane to pick one."));
  const pid = w.instFor = hit.p.id;
  const wanted = () => iw === w && w.instFor === pid;
  const r = await booth("openPlugin", { pluginId: pid });
  if (!wanted()) return;
  pane.querySelectorAll(".iw-msg").forEach((m) => m.remove());
  if (r && r.panel && !((findPlugin(pid) || hit).p.params || []).length) { // knobs made on open (TOY DRUMS' pad levels)
    const fresh = await booth("getState", {});
    if (!wanted()) return;
    if (fresh && fresh.tracks) ui.state = fresh;
  }
  if (r && r.toyMachine3 && window.openToyMachine3) { w.inst = "tk"; await openToyMachine3(hit.p, pane, wanted); return wanted() && foldLaneHead(); }   // TOY MACHINE V3
  if (r && r.toyMachine2 && window.openToyMachine2) { w.inst = "tk"; await openToyMachine2(hit.p, pane, wanted); return wanted() && foldLaneHead(); }   // TOY MACHINE V2 (ui/tm2-window.js)
  if (r && r.toyGtr && window.openToyGtr) { w.inst = "tk"; await openToyGtr(hit.p, pane, wanted); return wanted() && foldLaneHead(); }   // TOY GTR (ui/toygtr.js)
  if (r && r.toyKeys && window.openToyKeys) { w.inst = "tk"; await openToyKeys(hit.p, pane, wanted); return wanted() && foldLaneHead(); }   // TOY KEYS (ui/toykeys.js)
  if (r && r.toyMachine && r.blobFace && window.KT2Blob && window.BLOB2) { w.inst = "blob"; KT2Blob.mountTM(pane, hit.p, wanted); return wanted() && foldLaneHead(); }
  if (r && r.toyMachine) { w.inst = "tm"; await openToyMachine(hit.p, pane, wanted); if (wanted()) laneTmMode(); return wanted() && foldLaneHead(); }
  if (r && r.killDrum && window.KillDrumUI) { w.inst = "kd"; await openKillDrum(hit.p, pane, wanted); return wanted() && foldLaneHead(); }
  if (r && r.blob && window.KT2Blob) { w.inst = "blob"; KT2Blob.mountIn(pane, hit.p, wanted); return; }
  const p = (findPlugin(pid) || hit).p;
  if (r && (r.panel || (r.ok && p.params && p.params.length))) {
    w.inst = "panel";
    w.native = !r.panel; // the app opened the plugin's own window too
    showPluginPanel(pid, pane);
    return foldLaneHead();
  }
  pane.append(el("div", "iw-msg", (r && r.error) || `${p.name} has no knobs to show here.`));
}

function refreshLaneWindow() {
  const t = iw && ui.state && ui.state.tracks.find((x) => x.id === iw.trackId);
  if (!t) return closeLaneWindow();
  if (!ui.roll || !findClip(ui.roll.clipId)) { const c = laneMidiClip(t); if (c) setRollClip(c); else ui.roll = null; }
  refreshRoll();
  // Follow a swapped instrument (the old one is gone from the lane).
  const kept = iw.pluginId && findPlugin(iw.pluginId);
  if (!kept || (kept.t.id !== t.id && kept.t.layerOf !== t.id)) {
    const p = laneInstrument(t, ui.roll && findClip(ui.roll.clipId));
    const pid = p ? p.id : null;
    if (pid !== iw.pluginId) {
      teardownLaneInst();
      iw.pluginId = pid;
      if (iw.view !== "midi") showLaneInst();
    }
  }
  const p = iw.pluginId && findPlugin(iw.pluginId);
  const name = p ? (p.p.kit ? "KILLDRUM" : p.p.name) : /toy drums/i.test(t.instrument || "") ? "KILLDRUM" : t.instrument || "Synth";
  $("iw-dot").style.setProperty("--c", colorOf(t));
  $("iw-lane").textContent = t.name;
  $("iw-sub").textContent = name !== t.name ? name : "";
  $("iw-tab-inst").textContent = name;
  $("iw-tab-inst").title = `${name}: the lane's synth`;
  const tm = /toy machine/i.test(name), kd = name === "KILLDRUM";
  $("iw-tab-midi").hidden = kd; $("iw-tab-split").hidden = kd;
  if ($("iw-tab-create")) { $("iw-tab-create").hidden = !tm || !window.ToyMachineCreate || !!window.KT2_TM_CREATE_TAB_OLD; laneTmMode(); }
  const tabsEl = document.querySelector("#iw .iw-tabs"); if (tabsEl) tabsEl.hidden = kd; // KILLDRUM's own BEAT | FX are its tabs
  if (kd && iw.view !== "inst") setLaneView("inst");
  if ((tm || /toy keys|toy gtr/i.test(name) || isMidiToolLane(t)) && !$("iw-tmidi").hidden) showToyMachineMidi(t);   // TOY KEYS uses the same MIDI view
  laneSoundTabs(t);
  $("iw-logo").src = tm ? "toymachine-logo.png" : kd ? "killdrum-logo.png" : "logo.png";
  $("iw-logo").alt = tm ? "TOY MACHINE" : kd ? "KILLDRUM" : "KILLTOY";
}

// Stacked synths (KILLTOY 2, Eman 1 Nov): one tab per sound in the window's tab bar, to flip
// between the TOY MACHINEs that play this pattern. The notes stay the same.
function laneSoundTabs(t) {
  const tabs = document.querySelector("#iw .iw-tabs");
  if (!tabs) return;
  if (document.documentElement.classList.contains("kt2")) return laneLayerRow(t);
  let box = tabs.querySelector(".iw-sounds");
  const stack = [t, ...ui.state.tracks.filter((x) => x.layerOf === t.id)];
  if (stack.length < 2) { if (box) box.remove(); return; }
  if (!box) { box = el("span", "iw-sounds"); tabs.append(box); }
  // ALL (Eman, 1 Nov): every synth on the pattern at once, smaller, side by side, all playing
  const all = el("button", "iw-sound iw-sound-all" + (iw.all ? " on" : ""), "ALL");
  all.title = "Every sound on this pattern at once";
  all.onclick = () => { if (!iw || iw.all) return; if (window.TmMidi && TmMidi.setVoice) TmMidi.setVoice(null); /* ALL: the 1 / 2 chips pick whose notes move; the others show faint (Eman, 4 Nov) */ teardownLaneInst(); iw.all = true; if (iw.view === "midi") setLaneView("inst"); else showLaneInst(); refreshLaneWindow(); };
  if (iw.all) laneAllView(t);
  box.replaceChildren(all, ...stack.map((lane, i) => {
    const p = laneInstrument(lane, i ? null : ui.roll && findClip(ui.roll.clipId));
    // TOY 1, TOY 2 (BLOB 1...) after the synth it is (Eman, 4 Nov), with a light that switches it on or off
    const kind = p && /blob/i.test(p.name || "") ? "BLOB" : p && /killdrum|toy ?drums/i.test(p.name || "") ? "DRUM" : "TOY";
    const n = stack.slice(0, i + 1).filter((x, j) => { const q = laneInstrument(x, j ? null : ui.roll && findClip(ui.roll.clipId)); const k = q && /blob/i.test(q.name || "") ? "BLOB" : q && /killdrum|toy ?drums/i.test(q.name || "") ? "DRUM" : "TOY"; return k === kind; }).length;
    const b = el("button", "iw-sound" + (!iw.all && p && p.id === iw.pluginId ? " on" : "") + (lane.muted ? " off" : ""));
    const dot = el("i", "iw-dot");
    dot.title = lane.muted ? "Off: not heard. Click to switch it on" : "On. Click to switch it off (not heard at all)";
    dot.addEventListener("click", (e) => { e.stopPropagation(); run("toggleMute", { trackId: lane.id }); });
    b.append(dot, document.createTextNode(kind + " " + n));
    b.title = lane.name;
    b.style.setProperty("--c", colorOf(lane));
    b.onclick = () => {
      if (window.TmMidi && TmMidi.setVoice) TmMidi.setVoice(i && lane.linked === false ? lane.id : null);   // its notes' colour follows
      if (!iw || !p || (p.id === iw.pluginId && !iw.all)) return;
      teardownLaneInst();
      iw.all = false;
      iw.pluginId = p.id;
      if (iw.view !== "midi") showLaneInst();
      refreshLaneWindow();
    };
    return b;
  }));
}

// KILLTOY 2 (Eman, 4 Nov, idea 07 of the instrument-switcher page): the top tabs are only
// VST | SPLIT | MIDI, and a second row under the top bar holds every instrument on the pattern as
// a small channel: its real name, M, S and its level. Click a channel to open that instrument.
// The row shows on VST and SPLIT, not on MIDI. The old ALL / TOY 1 / TOY 2 tabs are not drawn here
// (laneAllView stays for the INST tab's cards).
const layerNames = new Map();   // pluginId -> TOY MACHINE preset name, read once
// A channel in the stacked-synth row shows the synth's name and its preset (Eman, 4 Nov).
// The preset is asked again each time the row is drawn, so a new pick shows up.
function layerName(lane, p) {
  if (!p) return { synth: lane.instrument || lane.name, preset: "" };
  if (p.kit || /killdrum|toy ?drums/i.test(p.name || "")) return { synth: "KILLDRUM", preset: (p.kit && p.kit.name) || "" };
  if (/toy machine/i.test(p.name || "") && p.id) {
    booth("toyMachineGetPreset", { pluginId: p.id }).then((r) => {
      const nm = (r && r.preset && r.preset.name) || "";
      if (nm === layerNames.get(p.id)) return;
      layerNames.set(p.id, nm);
      const cell = document.querySelector(`#iw .iw-layer[data-pid="${p.id}"] .iw-lpre`);
      if (cell) cell.textContent = nm || "Init";
    }).catch(() => {});
    return { synth: "TOY MACHINE", preset: layerNames.get(p.id) || "Init" };
  }
  return { synth: p.name || lane.name, preset: (p.preset && p.preset.name) || "" };
}
// Delete a synth card (Eman, 10 Nov 21:40): the x in its corner, or Delete / Backspace after clicking
// it. An untouched card (no sound picked or changed, no MIDI of its own) goes at once; otherwise a
// small "Delete it?" box asks first. The pattern's own (first) synth takes the pattern with it.
// KT2_CARD_DELETE_OFF = no x and no Delete key (the old way).
let layerPicked = null;   // the lane whose card was clicked last, while the click stays in the card row
async function deleteLayerCard(lane, main, anchor) {
  if (!lane || !main) return;
  const isMain = lane.id === main.id;
  let info = null;
  try { info = await booth("instrumentTouched", { trackId: lane.id }); } catch (e) { info = null; }
  const known = !!(info && info.ok);
  const p = laneInstrument(lane, null) || laneInstrument(lane, laneMidiClip(lane));
  const synth = layerName(lane, p).synth || "this synth";
  const go = async () => {
    if (window.TmMidi && TmMidi.setVoice && TmMidi._s && TmMidi._s() && TmMidi._s().voice === lane.id) TmMidi.setVoice(null);
    await run("deleteTrack", { trackId: lane.id });
    layerPicked = null;
    if (isMain) closeLaneWindow(); else refreshLaneWindow();
    toast(`${synth} deleted. Cmd+Z brings it back.`);
  };
  // unknown (an engine without the check): ask, to be safe
  if (known && !info.sound && !info.notes && !(isMain && info.layers)) return go();
  const why = [];
  if (!known || info.sound) why.push(known ? "its sound was changed" : "it may hold your sound");
  if (known && info.notes) why.push(isMain ? `the pattern and its ${info.notes} note${info.notes === 1 ? "" : "s"} go too` : `${info.notes} note${info.notes === 1 ? "" : "s"} of its own`);
  if (known && isMain && info.layers) why.push(info.layers === 1 ? "1 stacked synth goes too" : `${info.layers} stacked synths go too`);
  layerAsk = go;
  showMenu(anchor, [
    { heading: `DELETE ${synth.toUpperCase()}?` },
    { label: "Delete", meta: why.join(", "), danger: true, run: () => { layerAsk = null; go(); } },
    { label: "Keep it", meta: "Esc", run: () => { layerAsk = null; } },
  ]);
}
let layerAsk = null;   // the open "Delete it?" box: Enter deletes, Escape keeps
function layerDeleteKey(e) {
  if (window.KT2_CARD_DELETE_OFF || !iw) return false;
  if (layerAsk && !$("pop").hidden) {
    if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); const f = layerAsk; layerAsk = null; hidePop(); f(); return true; }
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); layerAsk = null; hidePop(); return true; }
  }
  if (e.key !== "Delete" && e.key !== "Backspace" || e.metaKey || e.ctrlKey || e.altKey || layerPicked == null) return false;
  const row = document.querySelector("#iw .iw-layers");
  if (!row || row.hidden || !row.isConnected) return false;
  // picked notes in the piano roll (SPLIT) keep Delete for themselves
  try { const S = window.TmMidi && TmMidi._s && TmMidi._s(); if (S && (S.sel || (S.multi && S.multi.length)) && S.pane && !S.pane.hidden && !S.pane.closest("[hidden]")) return false; } catch (er) { /* fine */ }
  const t = ui.state && ui.state.tracks.find((x) => x.id === iw.trackId);
  const lane = t && ui.state.tracks.find((x) => String(x.id) === String(layerPicked) && (x.id === t.id || x.layerOf === t.id));
  if (!lane) return false;
  e.preventDefault(); e.stopImmediatePropagation();
  deleteLayerCard(lane, t, row.querySelector(`.iw-layer[data-lane="${lane.id}"]`) || row);
  return true;
}
window.addEventListener("keydown", (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  layerDeleteKey(e);
}, true);
// a click anywhere outside the card row lets go of the card (Delete is the notes' / clips' again)
window.addEventListener("mousedown", (e) => { if (layerPicked != null && !e.target.closest("#iw .iw-layers, #pop")) layerPicked = null; }, true);
function laneLayerRow(t) {
  const tabs = document.querySelector("#iw .iw-tabs"), old = tabs.querySelector(".iw-sounds");
  if (old) old.remove();
  if (iw.all) { iw.all = false; teardownLaneInst(); if (iw.view !== "midi") showLaneInst(); }
  const stack = [t, ...ui.state.tracks.filter((x) => x.layerOf === t.id)];
  // the order Eman dragged them into (4 Nov); only how they're shown, they all play the same notes
  const orderKey = "kt2.layerOrder." + ((ui.state && ui.state.session) || "") + "|" + t.id;
  let order = [];
  try { order = JSON.parse(localStorage.getItem(orderKey) || "[]") || []; } catch (e) { order = []; }
  const rank = (x) => { const k = order.indexOf(String(x.id)); return k < 0 ? 1e6 + stack.indexOf(x) : k; };
  const shown = stack.slice().sort((a, b) => rank(a) - rank(b));
  const tab = $("iw-tab-inst");
  tab.textContent = "VST";
  if (stack.length > 1) tab.append(el("b", "iw-count", String(stack.length)));
  tab.title = "The instruments on this pattern";
  let row = document.querySelector("#iw .iw-layers");
  // the row shows even with one synth (Eman, 4 Nov): a fold arrow on the left, + on the right to stack another
  if (!row) { row = el("div", "iw-layers"); }
  const clip = ui.roll && findClip(ui.roll.clipId);
  const folded = false;   // the fold arrow is parked (Eman, 4 Nov: not needed here); window.KT2_LAYER_FOLD brings it back
  row.classList.toggle("folded", folded);
  const fold = el("button", "iw-lfold");
  fold.innerHTML = `<svg viewBox="0 0 10 10" width="10" height="10"><path d="${folded ? "M3 2l4 3-4 3" : "M2 3.5l3 3 3-3"}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  fold.title = folded ? "Show the instruments" : "Hide the instruments";
  fold.onclick = (e) => { e.stopPropagation(); try { localStorage.setItem("kt2.layersFolded", folded ? "0" : "1"); } catch (er) { /* fine */ } laneLayerRow(t); };
  const canStack = !isKillDrumLane(t) && clip;
  const plus = el("button", "iw-ladd", "+");
  plus.title = "Stack another instrument on this pattern";
  plus.onclick = async (e) => {
    e.stopPropagation();
    if (!window.KT2_LAYER_ANY_OLD && !(ui.plugins || []).length) ui.plugins = (await booth("listPlugins").catch(() => null)) || [];
    const add = async (key, nm) => {
      // a new synth starts empty, unlinked (Eman, 9 Nov: a new synth is a new part); cutting an existing
      // synth's link still keeps a copy of its notes. KT2_LAYER_NEW_COPY = the old way (linked, same notes)
      const empty = !window.KT2_LAYER_NEW_COPY;
      const r = await run("addSynthLayer", { clipId: clip.id, key, empty });
      if (!(r && r.ok)) return;
      // the new synth is the one picked and shown (Eman, 6 Nov 03:02); KT2_LAYER_ADD_STAY = stay on the old one
      if (r.pluginId && iw && !window.KT2_LAYER_ADD_STAY) {
        if (window.TmMidi && TmMidi.setVoice) TmMidi.setVoice(r.empty && r.trackId ? r.trackId : null);   // MIDI writes the new synth's notes
        teardownLaneInst();
        iw.pluginId = r.pluginId;
        if (iw.view === "midi") setLaneView("inst"); else showLaneInst();
      }
      refreshLaneWindow();
      toast(r.empty ? `${nm} added with its own empty notes. Link it to play the pattern's notes.` : `${nm} stacked on this pattern. It plays the same notes.`);
    };
    const base = [
      { heading: "STACK AN INSTRUMENT" },
      { label: "TOY MACHINE", meta: "presets and macros", run: () => add("builtin:toymachine", "TOY MACHINE") },
      { label: "BLOB", meta: "a sound as a creature", run: () => add("builtin:blob", "BLOB") },
    ];
    // ANY SYNTH STACKS (Eman, 26 Nov): another copy of this lane's own synth first ("several Serums"), then every other
    // instrument. KT2_LAYER_ANY_OLD = TOY MACHINE and BLOB only
    if (!window.KT2_LAYER_ANY_OLD) {
      const own = laneInstrument(t, clip), ownName = own && own.name;
      const list = (ui.plugins || []).filter((x) => x.instrument && !/toy drums|killdrum/i.test(x.name) && !/^builtin:(toymachine|blob|toydrums)$/.test(x.key));
      const mine = ownName && !/toy machine/i.test(ownName) && !(own && own.face === "blob") ? list.find((x) => x.name === ownName) : null;
      if (mine) base.splice(1, 0, { label: "Another " + mine.name, meta: "same synth, its own sound", run: () => add(mine.key, mine.name) });
      for (const x of list) if (x !== mine) base.push({ label: x.name, meta: x.group || "", run: () => add(x.key, x.name) });
    }
    showMenu(plus, base);
  };
  const cells = folded ? [] : shown.map((lane) => {
    const i = stack.indexOf(lane);
    const p = laneInstrument(lane, i ? null : clip);
    const cell = el("div", "iw-layer" + (p && p.id === iw.pluginId ? " on" : "") + (lane.muted ? " off" : ""));
    cell.style.setProperty("--c", colorOf(lane));
    if (p) cell.dataset.pid = p.id;
    const ln = layerName(lane, p);
    cell.title = ln.preset ? `${ln.synth} \u00b7 ${ln.preset}` : ln.synth;
    const nm = el("div", "iw-lname");
    nm.append(el("small", "iw-lsyn", ln.synth), el("span", "iw-lpre", ln.preset || "\u00a0"));
    const m = el("button", "iw-lm" + (lane.muted ? " on" : ""), "M");
    m.title = lane.muted ? "Muted. Click to hear it again" : "Mute";
    m.onclick = (e) => { e.stopPropagation(); run("toggleMute", { trackId: lane.id }); };
    const so = el("button", "iw-ls" + (lane.solo ? " on" : ""), "S");
    so.title = "Solo: hear only this one";
    so.onclick = (e) => { e.stopPropagation(); run("toggleSolo", { trackId: lane.id }); };
    // the level is a small ring on the right (Eman, 4 Nov): drag up/down or sideways, double-click for 0 dB
    const lv = el("div", "iw-llv iw-lknob");
    const ARC = 2 * Math.PI * 9 * 0.8;
    const paintKnob = (db) => {
      const f = volToFrac(db);
      lv.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="9" class="tr" stroke-dasharray="${ARC} 99" /><circle cx="12" cy="12" r="9" class="vl" stroke-dasharray="${Math.max(0.01, f * ARC)} 99" /></svg><b>${Math.round(f * 100)}</b>`;
      lv.title = `Level ${fmtDb(db)} (drag, double-click for 0 dB)`;
    };
    paintKnob(lane.volume || 0);
    lv.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setTrackVolume", { trackId: lane.id, db: 0 }); });
    lv.addEventListener("mousedown", (e) => {
      if (e.detail > 1) return;
      e.stopPropagation();
      const f0 = volToFrac(lane.volume || 0), x0 = e.clientX, y0 = e.clientY;
      let v = lane.volume || 0;
      const at = (ev) => { const f = Math.max(0, Math.min(1, f0 + ((ev.clientX - x0) - (ev.clientY - y0)) / 150)); v = fracToVol(f); paintKnob(v); };
      liveDrag(e, (ev) => { at(ev); return () => run("setTrackVolume", { trackId: lane.id, db: v, drag: true }); },
        (ev, none, pending) => { if (pending) pending(false); });
    });
    const ctl = el("div", "iw-lctl");
    ctl.append(m, so, lv);
    if (window.KT2_LAYER_TAB_OLD) cell.append(nm, ctl);
    else {
      // taller tab (Eman, 6 Nov 01:55): name + preset on the left, M S level and - OCT + on the right
      const oc = el("div", "iw-loct"), ov = lane.oct || 0;
      const ob = (d, txt) => { const b = el("button", "iw-lob", txt); b.title = d < 0 ? "An octave down" : "An octave up";
        b.onclick = (e) => { e.stopPropagation(); run("setLaneOct", { trackId: lane.id, oct: (lane.oct || 0) + d }).then(() => refreshLaneWindow()); }; return b; };
      oc.append(ob(-1, "\u2212"), el("span", "iw-lov" + (ov ? " on" : ""), ov ? "OCT " + (ov > 0 ? "+" : "") + ov : "OCT"), ob(1, "+"));
      const right = el("div", "iw-lright");
      right.append(ctl, oc);
      cell.classList.add("iw-ltall");
      cell.append(nm, right);
    }
    cell.dataset.lane = lane.id;
    if (!window.KT2_LAYER_WAVE_OFF) layerWave(cell, lane, p);   // its live wave behind it (Eman, 26 Nov)
    document.documentElement.classList.toggle("k2-cards26-old", !!window.KT2_CARDS26_OLD);   // SYNTH CARDS 26 (kt2.css)
    document.documentElement.classList.toggle("k2-tmfit-old", !!window.KT2_TMFIT_OLD);   // VST FIT (kt2.css)
    document.documentElement.classList.toggle("k2-tmfont-old", !!window.KT2_TM_FONT_OLD);   // TOY MACHINE mono label font (kt2.css)
    if (!window.KT2_CARD_DELETE_OFF) {
      const x = el("button", "iw-lx", "\u00d7");
      x.title = i ? "Delete this synth (Delete key)" : "Delete this synth and its pattern (Delete key)";
      x.onclick = (e) => { e.stopPropagation(); layerPicked = lane.id; deleteLayerCard(lane, t, x); };
      cell.append(x);
      cell.addEventListener("mousedown", () => { layerPicked = lane.id; });
    }
    // drag a channel along the strip to change the order
    cell.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.closest("button, .iw-llv")) return;
      const x0 = e.clientX;
      let moved = false;
      const mv = (ev) => {
        const dx = ev.clientX - x0;
        if (!moved && Math.abs(dx) < 5) return;
        moved = true; cell.classList.add("drag"); cell.style.transform = `translateX(${dx}px)`;
      };
      const up = (ev) => {
        window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
        if (!moved) return;
        cell.addEventListener("click", (c) => c.stopImmediatePropagation(), { capture: true, once: true });
        const others = [...row.querySelectorAll(".iw-layer")].filter((x) => x !== cell);
        let at = others.length;
        for (let k = 0; k < others.length; k++) { const r = others[k].getBoundingClientRect(); if (ev.clientX < r.left + r.width / 2) { at = k; break; } }
        const ids = others.map((x) => x.dataset.lane);
        ids.splice(at, 0, String(lane.id));
        try { localStorage.setItem(orderKey, JSON.stringify(ids)); } catch (er) { /* this view only */ }
        laneLayerRow(t);
      };
      window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    });
    cell.onclick = () => {
      if (window.TmMidi && TmMidi.setVoice) TmMidi.setVoice(i && lane.linked === false ? lane.id : null);   // its notes' colour follows
      // MIDI page (Eman, 26 Nov): a card picks whose notes the piano roll writes, like 1 2 3 did, and stays on MIDI;
      // VST and SPLIT open on it later. KT2_MIDI_LAYERS_OFF = the row isn't on MIDI
      if (iw && p && iw.view === "midi" && !window.KT2_MIDI_LAYERS_OFF) { if (p.id !== iw.pluginId) { teardownLaneInst(); iw.pluginId = p.id; } laneLayerRow(t); return; }
      if (!iw || !p || p.id === iw.pluginId) return;
      teardownLaneInst();
      iw.pluginId = p.id;
      if (iw.view === "midi") setLaneView("inst"); else showLaneInst();
      refreshLaneWindow();
    };
    return cell;
  });
  // the link between a stacked synth and the pattern's notes, between the tabs like on the INST cards
  // (Eman, 6 Nov 01:55); click cuts or joins it. KT2_LAYER_TAB_OLD = no links
  if (!folded && !window.KT2_LAYER_TAB_OLD) {
    for (let k = cells.length - 1; k > 0; k--) {
      const lane = shown[k], L = shown[k - 1];
      if (!lane.layerOf && !L.layerOf) continue;
      const own = lane.layerOf ? lane : L, linked = own.linked !== false;
      const flip = () => { if (window.KT2Juice) { const S = KT2Juice.sound; const f = linked ? S.unplug : S.plug; if (f) f(); } run("setLayerLinked", { trackId: own.id, linked: !linked }).then(() => { refreshLaneWindow(); if (iw && iw.view === "split") laneVoiceFromPick(t); }); };
      const tip = linked ? "Linked: plays the pattern's notes. Click to give it its own notes" : "Own notes. Click to link it back to the pattern's notes";
      const lk = window.KT2InstLive && KT2InstLive.thread ? KT2InstLive.thread(linked, 34, 40, flip, tip) : el("button", "k2th off");
      lk.classList.add("iw-lk");
      cells.splice(k, 0, lk);
    }
  }
  if (folded) cells.push(el("span", "iw-lfolded", stack.length > 1 ? `${stack.length} instruments` : "1 instrument"));
  row.replaceChildren(...(window.KT2_LAYER_FOLD ? [fold] : []), ...cells, ...(canStack && !folded ? [plus] : []));
  placeLayerRow(row);
}
// WAVE BEHIND THE CARDS (Eman, 26 Nov: "add a waveform visual behind the previews ... so you can see all active synths and
// their waveform underneath in those boxes"): every synth card draws its own sound's wave, live, in its colour, behind
// the name. TOY MACHINE asks its synth's scope (heard on preview notes too), anything else its lane's meter. When it goes
// quiet the last shape stays, faint, so each card keeps showing what it sounds like. KT2_LAYER_WAVE_OFF = no wave
const layerWaves = new Set();
let layerWaveBusy = false, layerWaveRaf = 0;
function layerWave(cell, lane, p) {
  const cv = el("canvas", "iw-lwave");
  cell.prepend(cv);
  const key = "kt2.lwave." + (p ? p.id : lane.id);
  let last = null; try { last = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (e) { last = null; }
  layerWaves.add({ cv, lane, p, key, wave: Array.isArray(last) ? last : null, amp: 0, live: 0, tm: !!p });
  if (!layerWaveRaf) layerWaveRaf = requestAnimationFrame(layerWaveFrame);
}
async function layerWavePoll() {
  if (layerWaveBusy) return;
  layerWaveBusy = true;
  try {
    for (const W of [...layerWaves]) {
      if (!W.cv.isConnected) { layerWaves.delete(W); continue; }
      if (W.cv.closest("[hidden]")) continue;
      let m = null;
      if (W.tm && W.p) m = await booth("toyMachineMeter", { pluginId: W.p.id }).catch(() => null);
      if (!m || !(m.peak > 1e-4)) { const m2 = await booth("laneMeter", { trackId: W.lane.id }).catch(() => null); if (m2 && m2.peak > 1e-4) m = m2; }
      const pk = m && m.peak ? m.peak : 0;
      if (pk > 1e-4 && Array.isArray(m.wave) && m.wave.some((v) => Math.abs(v) > 1e-3)) {
        const mx = Math.max(1e-6, ...m.wave.map((v) => Math.abs(v)));
        W.wave = m.wave.map((v) => v / mx); W.live = Math.min(1, 0.35 + Math.sqrt(pk) * 1.2);
        if (!W.saveAt || Date.now() - W.saveAt > 1500) { W.saveAt = Date.now(); try { sessionStorage.setItem(W.key, JSON.stringify(W.wave.map((v) => Math.round(v * 100) / 100))); } catch (e) { /* fine */ } }
      }
    }
  } finally { layerWaveBusy = false; }
}
let layerWaveT = 0;
function layerWaveFrame(now) {
  layerWaveRaf = 0;
  if (!layerWaves.size || window.KT2_LAYER_WAVE_OFF) return;
  if (now - layerWaveT > 60) { layerWaveT = now; layerWavePoll(); }
  for (const W of layerWaves) {
    const cv = W.cv;
    if (!cv.isConnected) continue;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) continue;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    W.live *= 0.93;   // falls back to the faint resting shape
    const target = W.wave ? Math.max(0.22, W.live) : 0;
    W.amp += (target - W.amp) * 0.25;
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const col = getComputedStyle(cv.parentElement).getPropertyValue("--c").trim() || "#8b6cff";
    const mid = h * 0.56, A = h * 0.36 * W.amp, wv = W.wave || [];
    g.beginPath();
    if (!wv.length) { g.moveTo(0, mid); g.lineTo(w, mid); }
    else for (let i = 0; i <= 96; i++) { const x = (i / 96) * w, f = (i / 96) * (wv.length - 1), k = Math.floor(f), t = f - k, v = (wv[k] || 0) * (1 - t) + (wv[Math.min(wv.length - 1, k + 1)] || 0) * t; if (i) g.lineTo(x, mid - v * A); else g.moveTo(x, mid - v * A); }
    g.lineWidth = 1.4; g.strokeStyle = col; g.globalAlpha = wv.length ? 0.18 + 0.5 * Math.min(1, W.amp) : 0.14; g.stroke();
    if (wv.length) { g.lineTo(w, mid); g.lineTo(0, mid); g.closePath(); g.fillStyle = col; g.globalAlpha = 0.06 + 0.12 * Math.min(1, W.amp); g.fill(); }
    g.globalAlpha = 1;
  }
  layerWaveRaf = requestAnimationFrame(layerWaveFrame);
}
// Under whichever top bar is showing: the window's own header, or the synth's bar when its
// header is folded into it (TOY MACHINE, KILLDRUM). Their grid gets a row for it.
function placeLayerRow(row = document.querySelector("#iw .iw-layers")) {
  document.querySelectorAll("#iw .iw-layered").forEach((x) => x.classList.remove("iw-layered"));
  if (!row) return;
  const card = $("iw-card");
  row.hidden = !iw || (iw.view === "midi" && !!window.KT2_MIDI_LAYERS_OFF);   // on MIDI too (Eman, 26 Nov)
  const bar = card.classList.contains("iw-full") && $("iw-inst").querySelector(".tm-top");
  if (bar) { bar.after(row); bar.parentElement.classList.add("iw-layered"); }
  else card.querySelector(".iw-head").after(row);
}

// The ALL view: INST's cards for every stacked synth (preset < >, macros, OCT, LEVEL, threads),
// drawn again only when the stack itself changes (not while a fader is dragged).
function laneAllView(t) {
  const pane = $("iw-inst"), tabs = window.KT2Tabs;
  if (!iw || !iw.all || !tabs || !tabs.inst) return;
  const stack = [t, ...ui.state.tracks.filter((x) => x.layerOf === t.id)];
  const sig = JSON.stringify(stack.map((x) => [x.id, x.oct || 0, x.linked !== false, (x.plugins || []).map((q) => [q.id, q.enabled])]));
  let box = pane.querySelector(":scope > .iw-all");
  if (box && box.dataset.sig === sig) return;
  pane.replaceChildren();
  box = el("div", "iw-all");
  box.dataset.sig = sig;
  pane.append(box);
  iw.inst = "all"; iw.instFor = "all";
  const c = (ui.roll && findClip(ui.roll.clipId)) || laneMidiClip(t);
  const K = window.KT2, tall = K && K.footTall;
  if (K) K.footTall = false;   // cards here, never the full synth
  try { tabs.inst(box, c); } finally { if (K) K.footTall = tall; }
}

function showToyMachineMidi(t) {
  if (!window.TmMidi) return;
  TmMidi.show($("iw-tmidi"), t.id, ui.roll ? ui.roll.clipId : null);
}

// Every tab opens on the synth picked last (Eman, 9 Nov): synth 2 open in VST -> MIDI writes synth 2's
// notes (chip 2), and a chip picked in MIDI is the synth VST and SPLIT open on. Before, MIDI fell back
// to 1 whenever its view hadn't heard the pick (a new synth, a link cut on the VST row, a first visit).
// Runs on a tab switch (and a link cut in SPLIT), not on every redraw.
// KT2_LAYER_PICK_OLD = the old way.
function laneVoiceFromPick(t) {
  if (window.KT2_LAYER_PICK_OLD || !iw || iw.all || !iw.pluginId || !TmMidi._s || !TmMidi.setVoice) return;
  const S = TmMidi._s();
  if (!S || S.voice === "*") return;
  const got = findPlugin(iw.pluginId);
  const lane = got && got.t;
  if (!lane || (lane.id !== t.id && lane.layerOf !== t.id)) return;
  const want = lane.layerOf === t.id && lane.linked === false ? lane.id : null;   // a linked synth plays the main notes (chip 1-2)
  if ((S.voice || null) !== want) TmMidi.setVoice(want);
}
// A chip picked in MIDI: VST and SPLIT open on that synth too.
window.KT2LanePickVoice = (laneId) => {
  if (window.KT2_LAYER_PICK_OLD || !iw) return;
  const t = ui.state && ui.state.tracks.find((x) => x.id === iw.trackId);
  if (!t) return;
  const lane = laneId ? ui.state.tracks.find((x) => x.id === laneId) : t;
  const p = lane && laneInstrument(lane, lane === t ? ui.roll && findClip(ui.roll.clipId) : null);
  if (!p || p.id === iw.pluginId) return;
  teardownLaneInst();
  iw.all = false;
  iw.pluginId = p.id;
  if (iw.view !== "midi") showLaneInst();
  refreshLaneWindow();
};

for (const b of document.querySelectorAll(".iw-tab"))
  b.onclick = () => {
    if (!iw) return;
    // CREATE SOUND (Eman 11 Nov: a tab next to VST): the same TOY MACHINE window in its create mode
    if (b.dataset.view === "create") { iw.tmMode = "create"; setLaneView(iw.view === "split" ? "split" : "inst"); return laneTmMode(); }
    if (b.dataset.view === "inst") iw.tmMode = "presets";
    setLaneView(b.dataset.view === "split" && iw.view === "split" ? iw.single : b.dataset.view);
    if (b.dataset.view === "inst") laneTmMode();
  };
// The lane window's TOY MACHINE follows the VST / CREATE SOUND tabs. KT2_TM_CREATE_TAB_OLD = the tabs inside TOY MACHINE.
function laneTmMode() {
  const ct = $("iw-tab-create");
  if (!iw || !ct) return;
  const create = iw.tmMode === "create" && !ct.hidden;
  if (tmWin && tmWin.win && typeof tmWin.win.setMode === "function" && iw.inst === "tm") tmWin.win.setMode(create ? "create" : "presets");
  ct.classList.toggle("on", create && iw.view !== "midi");
  if (create && iw.view === "inst") $("iw-tab-inst").classList.remove("on");
}
$("iw-done").onclick = closeLaneWindow;
$("iw").addEventListener("mousedown", (e) => { if (e.target === $("iw")) closeLaneWindow(); });

// ---------------------------------------------------------------------------
// Tune editor: notes as blobs over a piano roll, the sung pitch as a thin line
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

function inKey(midi, key) {
  if (!key || key.tonic == null || key.tonic < 0) return true;
  const pc = (((Math.round(midi) - key.tonic) % 12) + 12) % 12;
  return SCALES[key.minor ? "minor" : "major"].includes(pc);
}

function nearestInKey(midi, key) {
  let best = Math.round(midi), dist = 99;
  for (let n = Math.round(midi) - 2; n <= Math.round(midi) + 2; n++)
    if (inKey(n, key) && Math.abs(n - midi) < dist) { dist = Math.abs(n - midi); best = n; }
  return best;
}

async function openTune(clip) {
  toast("Reading the notes\u2026");
  const r = await run("trackPitch", { clipId: clip.id });
  if (!r || r.error) return;
  if (!r.notes.length) return toast("No sung notes found in this clip.");
  const key = r.key || null;
  // What Tune changes to play the clip (loop + play), put back when it closes.
  const st = ui.state, before = { playing: !!ui.transport.playing, looping: !!ui.transport.looping, loopStart: st.loopStart, loopEnd: st.loopEnd, position: ui.transport.position };
  ui.tune = { clip, key, curve: r.curve, step: r.curveStep, notes: r.notes.map((n) => ({ ...n, target: n.midi })), drag: null, before };
  tuneFit();
  $("tune-name").textContent = `Tune ${clip.name}`;
  $("tune-sub").textContent = key && key.name ? `in ${key.name} \u00b7 ${r.notes.length} notes` : `${r.notes.length} notes \u00b7 no key yet (load a beat)`;
  $("tune-amount").value = 0;
  $("tune-amount-val").textContent = "0%";
  $("tune").hidden = false;
  drawTune();
  // Like Melodyne: loop this clip and play, so every move is heard straight away.
  await run("setLoopRange", { start: clip.start, end: clip.start + clip.length });
  if (!ui.transport.playing) await run("togglePlay");
  tunePlayhead();
}

// The playhead over the note grid, moved on every transport update.
function tunePlayhead() {
  const t = ui.tune, line = $("tune-playhead");
  if (!t) return;
  const sec = ui.transport.position - t.clip.start, g = tuneGeometry();
  const inside = sec >= 0 && sec <= t.clip.length && sec >= g.sec(g.left) && sec <= g.sec(g.w);
  line.hidden = !inside;
  if (inside) line.style.transform = `translateX(${g.x(sec)}px)`;
}

// Hear note moves while it plays: the engine previews the tuning live (nothing is
// written or added to undo until Apply). Sent at most every 120 ms while dragging.
function previewTune(now) {
  const t = ui.tune;
  if (!t) return;
  clearTimeout(t.previewTimer);
  const send = () => {
    if (!ui.tune) return;
    t.lastPreview = Date.now();
    const notes = t.notes.filter((n) => Math.abs(n.target - n.midi) > 0.005).map(({ start, end, midi, target }) => ({ start, end, midi, target }));
    run("previewTune", { clipId: t.clip.id, notes });
  };
  const wait = now ? 0 : Math.max(0, 120 - (Date.now() - (t.lastPreview || 0)));
  if (wait) t.previewTimer = setTimeout(send, wait); else send();
}
// Cancel ends the preview (the clip sounds as before); Apply hands over to "tune",
// which keeps the preview playing until the tuned audio is ready.
function closeTune(apply) {
  const t = ui.tune;
  $("tune").hidden = true;
  ui.tune = null;
  if (t) { clearTimeout(t.previewTimer); if (!apply) run("previewTune", { clipId: t.clip.id, notes: null }); }
  // The loop goes back to what it was, and if the song wasn't playing before, it stops
  // (after Apply it keeps playing, so the tuned take is heard as soon as it's ready).
  const b = t && t.before;
  if (b) {
    const stop = !b.playing && !apply && ui.transport.playing;
    (stop ? run("togglePlay") : Promise.resolve())
      .then(() => (b.loopEnd > b.loopStart ? run("setLoopRange", { start: b.loopStart, end: b.loopEnd }) : null))
      .then(() => (b.looping ? null : run("setLooping", { on: false })))
      .then(() => (stop ? run("setPosition", { time: b.position }) : null));
  }
  return t;
}

// The view: what part of the clip (t0..t0+span seconds) and which rows (lo..hi) the grid shows.
// It starts on the sung notes, big, so what there is to change fills the window (Eman, 31 Oct).
function tuneFit() {
  const t = ui.tune;
  if (!t) return;
  const pitches = t.notes.flatMap((n) => [n.midi, n.target]);
  const lo = Math.floor(Math.min(...pitches)) - 1, hi = Math.ceil(Math.max(...pitches)) + 1;
  const a = Math.min(...t.notes.map((n) => n.start)), b = Math.max(...t.notes.map((n) => n.end));
  const pad = Math.max(0.15, (b - a) * 0.04);
  const t0 = Math.max(0, a - pad), span = Math.max(1, Math.min(t.clip.length, b + pad) - t0);
  t.view = { t0, span, lo, hi };
}
function tuneGeometry() {
  const t = ui.tune, cv = $("tune-canvas");
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  if (!t.view) tuneFit();
  const { t0, span, lo, hi } = t.view, left = 44, pps = (w - left - 10) / span;
  return { w, h, dpr, lo, hi, rowH: h / (hi - lo + 1), x: (s) => left + (s - t0) * pps, sec: (px) => t0 + (px - left) / pps, left };
}
// Zoom: wheel = time around the mouse, sideways = pan, Alt+wheel = rows. Shown as + / - / FIT too.
function tuneZoom(e) {
  const t = ui.tune;
  if (!t) return;
  e.preventDefault();
  const g = tuneGeometry(), v = t.view, r = $("tune-canvas").getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  if (e.altKey) {
    const rows = v.hi - v.lo + 1, want = Math.max(6, Math.min(72, Math.round(rows * (e.deltaY > 0 ? 1.2 : 1 / 1.2))));
    const at = v.lo + (g.h - py) / g.rowH - 0.5, f = (at - v.lo) / rows;
    v.lo = Math.round(at - f * want); v.hi = v.lo + want - 1;
  } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    v.t0 = Math.max(0, Math.min(t.clip.length - v.span, v.t0 + e.deltaX / ((g.w - g.left - 10) / v.span)));
  } else {
    const at = g.sec(px), z = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const span = Math.max(0.25, Math.min(t.clip.length, v.span * z));
    v.t0 = Math.max(0, Math.min(t.clip.length - span, at - (at - v.t0) * (span / v.span)));
    v.span = span;
  }
  drawTune(); tunePlayhead();
}
function tuneZoomBy(z) {
  const t = ui.tune;
  if (!t) return;
  const v = t.view, mid = v.t0 + v.span / 2, span = Math.max(0.25, Math.min(t.clip.length, v.span * z));
  v.t0 = Math.max(0, Math.min(t.clip.length - span, mid - span / 2)); v.span = span;
  drawTune(); tunePlayhead();
}
$("tune-canvas").addEventListener("wheel", tuneZoom, { passive: false });

function drawTune() {
  const t = ui.tune;
  if (!t) return;
  const g = tuneGeometry();
  const ctx = $("tune-canvas").getContext("2d");
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  ctx.clearRect(0, 0, g.w, g.h);
  const yOf = (m) => g.h - (m - g.lo + 0.5) * g.rowH;
  ctx.save(); ctx.beginPath(); ctx.rect(g.left, 0, g.w - g.left, g.h); ctx.clip();

  for (let m = g.lo; m <= g.hi; m++) {
    const y = yOf(m) - g.rowH / 2;
    ctx.fillStyle = inKey(m, t.key) ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.18)";
    ctx.fillRect(g.left, y, g.w - g.left, g.rowH - 1);
    if (m % 12 === 0 || g.rowH > 13) {
      ctx.fillStyle = inKey(m, t.key) ? "rgba(245,243,255,0.55)" : "rgba(245,243,255,0.22)";
      ctx.font = "600 10px ui-monospace, Menlo, monospace";
      ctx.restore(); ctx.fillText(NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1), 6, y + g.rowH / 2 + 3);
      ctx.save(); ctx.beginPath(); ctx.rect(g.left, 0, g.w - g.left, g.h); ctx.clip();
    }
  }

  // The sung pitch line, shifted with each note so it shows the result
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(245,243,255,0.5)";
  ctx.beginPath();
  let pen = false;
  t.curve.forEach((m, i) => {
    const sec = i * t.step;
    if (!m) { pen = false; return; }
    const n = t.notes.find((x) => sec >= x.start && sec < x.end);
    const y = yOf(m + (n ? n.target - n.midi : 0));
    if (pen) ctx.lineTo(g.x(sec), y); else ctx.moveTo(g.x(sec), y);
    pen = true;
  });
  ctx.stroke();

  for (const n of t.notes) {
    const moved = Math.abs(n.target - n.midi) > 0.01;
    const x0 = g.x(n.start), x1 = Math.max(x0 + 4, g.x(n.end));
    const y = yOf(n.target) - g.rowH * 0.42, hgt = g.rowH * 0.84;
    ctx.fillStyle = moved ? "rgba(228,255,58,0.85)" : "rgba(139,92,246,0.75)";
    ctx.beginPath();
    ctx.roundRect(x0, y, x1 - x0, hgt, Math.min(8, hgt / 2));
    ctx.fill();
    if (x1 - x0 > 34 && hgt > 11) {
      const cents = Math.round((n.target - Math.round(n.target)) * 100);
      ctx.fillStyle = moved ? "#111" : "rgba(255,255,255,0.85)";
      ctx.font = "700 10px ui-monospace, Menlo, monospace";
      ctx.fillText(NOTE_NAMES[((Math.round(n.target) % 12) + 12) % 12] + (cents ? (cents > 0 ? " +" : " ") + cents : ""), x0 + 6, y + hgt / 2 + 3.5);
    }
  }
  ctx.restore();
}

function tuneHit(e) {
  const g = tuneGeometry(), r = $("tune-canvas").getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const m = g.lo + (g.h - py) / g.rowH - 0.5;
  return ui.tune.notes.find((n) => px >= g.x(n.start) - 3 && px <= g.x(n.end) + 3 && Math.abs(m - n.target) < 0.7);
}

$("tune-canvas").addEventListener("mousedown", (e) => {
  if (!ui.tune) return;
  const n = tuneHit(e);
  const g = tuneGeometry();
  if (!n) { // empty space: move the playhead there
    const sec = g.sec(e.clientX - $("tune-canvas").getBoundingClientRect().left);
    if (sec >= 0 && sec <= ui.tune.clip.length) run("setPosition", { time: ui.tune.clip.start + sec });
    return;
  }
  ui.tune.drag = { n, y: e.clientY, from: n.target, rowH: g.rowH };
});
window.addEventListener("mousemove", (e) => {
  const d = ui.tune && ui.tune.drag;
  if (!d) return;
  const delta = (d.y - e.clientY) / d.rowH;
  const to = e.altKey ? d.from + delta : Math.round(d.from + delta);
  if (to === d.n.target) return;
  d.n.target = to;
  drawTune();
  previewTune();
});
window.addEventListener("mouseup", () => { if (ui.tune && ui.tune.drag) { ui.tune.drag = null; previewTune(true); } });
$("tune-amount").oninput = (e) => {
  const amt = Number(e.target.value) / 100;
  $("tune-amount-val").textContent = Math.round(amt * 100) + "%";
  for (const n of ui.tune.notes) n.target = n.midi + (nearestInKey(n.midi, ui.tune.key) - n.midi) * amt;
  drawTune();
  previewTune();
};
$("tune-zoom-out").onclick = () => tuneZoomBy(1.3);
$("tune-zoom-in").onclick = () => tuneZoomBy(1 / 1.3);
$("tune-fit").onclick = () => { tuneFit(); drawTune(); tunePlayhead(); };
$("tune-reset").onclick = () => { ui.tune.notes.forEach((n) => (n.target = n.midi)); $("tune-amount").value = 0; $("tune-amount-val").textContent = "0%"; drawTune(); previewTune(true); };
$("tune-cancel").onclick = () => closeTune();
$("tune-apply").onclick = () => {
  const t = ui.tune;
  const moved = t.notes.filter((n) => Math.abs(n.target - n.midi) > 0.005).length;
  closeTune(moved > 0);
  if (!moved) return toast("No notes moved.");
  run("tune", { clipId: t.clip.id, notes: t.notes.map(({ start, end, midi, target }) => ({ start, end, midi, target })) })
    .then((r) => r && r.ok && toast(`Tuning ${moved} notes\u2026 Undo brings the original back.`));
};
window.addEventListener("resize", () => { drawTune(); tunePlayhead(); });

// ---------------------------------------------------------------------------
// Wiring
$("btn-play").onclick = () => run("togglePlay");
$("btn-stop").onclick = () => run("stop");
$("btn-rec").onclick = () => run("toggleRecord");
$("btn-loop").onclick = () => run("setLooping", { on: !ui.transport.looping });
$("btn-click").onclick = () => run("toggleClick");
$("btn-beat-empty").onclick = () => run("browseForBeat");
$("btn-skip-empty").onclick = () => { ui.emptyOff = ui.state.session; render(); };
$("btn-tm-empty").onclick = async () => { // a TOY MACHINE lane with a clip, its window open
  const tm = (await loadPlugins()).find((p) => p.instrument && /toy machine/i.test(p.name));
  const r = await run("newInstrumentLane", tm ? { key: tm.key } : {});
  if (!r || !r.ok) return;
  if (r.trackId) selectTrack(r.trackId);
  openLaneSynth(r.trackId);
};
// The key: pick one by hand, or (with a beat in the song) listen to the beat again.
$("key-chip").onclick = () => {
  const k = ui.state.key || {}, hasBeat = ui.state.tracks.some((t) => t.kind === "beat" && t.clips.length);
  const keyItem = (i, minor) => ({ label: TUNE_KEYS[i] + (minor ? "m" : ""), on: k.tonic === i && !!k.minor === minor, run: () => run("setKey", { tonic: i, minor }) });
  showMenu($("key-chip"), [
    ...(hasBeat ? [{ label: "Find it from the beat", run: () => run("analyzeBeat", { applyTempo: false }).then((r) => r && r.ok && toast("Listening to the beat again\u2026")) }, { sep: true }] : []),
    { heading: "MINOR" }, ...TUNE_KEYS.map((_, i) => keyItem(i, true)),
    { heading: "MAJOR" }, ...TUNE_KEYS.map((_, i) => keyItem(i, false)),
  ]);
};
// ---------------------------------------------------------------------------
// Projects home: every song as a wide banner (like Eman's FRAME app). Hold a banner to
// hear it, let go to stop; a click opens it. state.projects comes from the engine (the
// playground fills it in for now): [{ name, about, versions, bpm, key, length, worked,
// image, making, tag, remake }]. Without projects the home page never shows.
// Two tabs: PROJECTS (Eman's own songs) and REMAKES (remakes of other people's songs,
// remake: true). state.projectsAway lists projects that live in another place (the web
// playground's second page): { name, url, remake, ... }; a click opens that page.
ui.home = false;
ui.homeTab = null;
ui.homeSig = "";
const HOLD_PREVIEW_MS = 220;

function showHome(on) {
  const s = ui.state;
  if (on && !(s && s.projects && s.projects.length)) return;
  if (on) ui.homeTab = null; // pick the tab again (renderHome), unless one is clicked
  ui.home = on;
  $("home").hidden = !on;
  document.body.classList.toggle("at-home", on);
  if (on) {
    hidePop();
    toggleSettings(false);
    if (ui.transport && ui.transport.playing) run("togglePlay");
    ui.homeSig = "";
    renderHome();
  } else {
    stopProjectPreview();
  }
}

const agoText = (iso) => {
  const t = Date.parse(iso || "");
  if (!t) return "\u2014";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "now";
  if (m < 60) return m + "m ago";
  if (m < 60 * 24) return Math.round(m / 60) + "h ago";
  return Math.round(m / 60 / 24) + "d ago";
};
const lengthText = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}` : "\u2014");

// A project that lives on the other page (the KILLTOY Library). Inside claude.ai this page runs
// in a locked-down frame, and a tab opened from it inherits the lock, so claude.ai refuses to
// show it ("claude.ai is blocked"). So: copy the link and open it in a fresh tab by hand.
function openAway(p) {
  const where = p.awayLabel || "the other page";
  if (window.top === window) return window.open(p.url, "_blank", "noopener");
  const box = $("away");
  $("away-title").textContent = `${p.name} is in ${where}`;
  $("away-url").value = p.url;
  box.hidden = false;
  const copy = async () => {
    const f = $("away-url");
    f.focus(); f.select();
    let ok = false;
    try { await navigator.clipboard.writeText(p.url); ok = true; } catch (e) { try { ok = document.execCommand("copy"); } catch (e2) { /* select only */ } }
    $("away-copy").textContent = ok ? "Copied" : "Press \u2318C";
  };
  $("away-copy").textContent = "Copy link";
  $("away-copy").onclick = copy;
  $("away-close").onclick = () => { box.hidden = true; };
  copy();
}

function renderHome() {
  const s = ui.state;
  if (!ui.home || !s || !s.projects) return;
  const sig = JSON.stringify([s.projects, s.projectsAway, s.session, ui.homeTab, Math.floor(Date.now() / 60000)]);
  if (sig === ui.homeSig) return;
  ui.homeSig = sig;
  ui.previewEls = {};

  const all = [...s.projects, ...(s.projectsAway || []).map((p) => ({ ...p, away: true }))];
  const inTab = (tab) => all.filter((p) => !!p.remake === (tab === "remakes"));
  const remakes = inTab("remakes");
  const here = s.projects.find((p) => p.name === s.session);
  if (!ui.homeTab && remakes.length) { // open on the open project's tab; the Ruski test song alone doesn't count as own work
    const own = s.projects.some((p) => !p.remake && p.name !== "Ruski");
    ui.homeTab = here && (here.remake || own) ? (here.remake ? "remakes" : "projects") : own ? "projects" : "remakes";
  }
  const shown = remakes.length ? ui.homeTab : "projects";
  const list = inTab(shown);
  for (const tab of ["projects", "remakes"]) {
    const b = $("home-tab-" + tab);
    b.classList.toggle("on", shown === tab);
    b.querySelector("sup").textContent = inTab(tab).length;
  }
  $("home-tab-remakes").hidden = !remakes.length;
  $("home-tab-projects").hidden = !remakes.length;
  $("home-title-t").textContent = shown === "remakes" ? "REMAKES" : "PROJECTS";
  $("home-count").textContent = `(${list.length})`;
  $("home-back").hidden = !here;
  $("home-back-name").textContent = here ? here.name : "";

  const rows = $("home-rows");
  rows.replaceChildren();
  list.forEach((p, i) => {
    const row = el("div", "hp" + (p.making ? " making" : "") + (p.away ? " away" : "") + (p.name === s.session ? " current" : ""));

    const info = el("div", "hp-info");
    const head = el("div", "hp-cell hp-head");
    head.append(el("span", null, "About"), el("span", "hp-tag", p.making ? "Being made" : p.name === s.session ? "Open" : p.tag || ""));
    const about = el("div", "hp-cell hp-about");
    about.append(el("span", null, p.about || "No notes yet."));
    const big = el("div", "hp-cell hp-big");
    if (p.making) {
      big.append(el("div", "hp-big-l", "Claude is making it"), el("div", "hp-big-n", "\u2026"), el("div", "hp-bar busy"));
    } else {
      const n = el("div", "hp-big-n", String(p.versions || 1));
      n.append(el("small", null, (p.versions || 1) === 1 ? " version" : " versions"));
      big.append(el("div", "hp-big-l", `Lanes \u00b7 ${p.lanes || 0}`), n);
      const bar = el("div", "hp-bar");
      bar.style.setProperty("--f", Math.min(1, (p.versions || 1) / Math.max(p.versions || 1, 10)));
      big.append(bar);
    }
    const stats = el("div", "hp-cell hp-stats");
    for (const [k, v] of [["Tempo", p.bpm ? Math.round(p.bpm) : "\u2014"], ["Key", p.key || "\u2014"], ["Length", lengthText(p.length)], ["Worked", agoText(p.worked)]]) {
      const c = el("div");
      c.append(el("span", null, k), el("b", null, String(v)));
      stats.append(c);
    }
    info.append(head, about, big, stats);

    const ban = el("button", "hp-banner");
    ban.title = p.making ? `${p.name} is still being made` : p.away ? `Click to open ${p.name} in ${p.awayLabel || "its own page"}` : `Hold to listen \u00b7 click to open ${p.name}`;
    const img = el("div", "hp-img");
    if (p.image) img.style.backgroundImage = `url("${p.image}")`;
    const name = el("div", "hp-name");
    name.append(el("span", "hp-num", `[${String(i + 1).padStart(3, "0")}]`), el("span", "hp-title", p.name));
    if (p.making || p.isNew) name.append(el("span", "hp-new", "New"));
    const right = el("div", "hp-right", p.line && !p.making ? p.line : p.making ? "Being made \u00b7 opens when ready" : [p.versions > 1 ? `${p.versions} versions` : "", p.bpm ? `${Math.round(p.bpm)} BPM` : ""].filter(Boolean).join(" \u00b7 "));
    const hint = el("div", "hp-hint");
    hint.append(el("span", "hp-eq"), el("span", "hp-hint-t", p.making ? "Not ready yet" : p.away ? `Opens in ${p.awayLabel || "its own page"} \u2197` : "Hold to listen"));
    for (let k = 0; k < 4; k++) hint.firstChild.append(el("i"));
    const prog = el("div", "hp-prog");
    ban.append(img, el("div", "hp-shade"), name, right, hint, prog);
    if (p.away) ban.onclick = () => openAway(p);
    else holdToPreview(ban, p, prog, hint.lastChild);
    row.append(info, ban);
    rows.append(row);
  });

  const making = $("home-making");
  making.replaceChildren();
  const busy = s.projects.filter((p) => p.making);
  if (!busy.length) making.append(el("div", "home-side-none", "Nothing being made."));
  for (const p of busy) {
    const r = el("div", "home-side-item");
    r.append(el("span", "home-side-dot"), el("b", null, p.name), el("span", null, p.makingNote || "Claude is remaking it with every sound on its own lane."));
    making.append(r);
  }
  requestAnimationFrame(fitHomeTitles);
}

// Project names fill their banner: long ones shrink until they fit instead of being cut off.
function fitHomeTitles() {
  for (const t of document.querySelectorAll(".hp-title")) {
    t.style.fontSize = "";
    const room = t.parentElement.clientWidth, need = t.scrollWidth;
    if (need > room && room > 0) t.style.fontSize = Math.max(26, parseFloat(getComputedStyle(t).fontSize) * (room / need) * 0.97) + "px";
  }
}
window.addEventListener("resize", () => { if (ui.home) fitHomeTitles(); });

// Press and hold: after a moment the project's song plays from its hook; letting go (or
// sliding off) stops it. A quick click opens the project instead.
function holdToPreview(ban, p, prog, label) {
  let timer = 0, playing = false;
  const end = () => {
    clearTimeout(timer); timer = 0;
    if (playing) { playing = false; stopProjectPreview(); }
  };
  ban.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    ban.setPointerCapture && ban.setPointerCapture(e.pointerId);
    ui.previewHeld = false;
    if (p.making) return;
    timer = setTimeout(async () => {
      timer = 0; playing = true; ui.previewHeld = true;
      startProjectPreview(ban, p, prog, label);
    }, HOLD_PREVIEW_MS);
  });
  ban.addEventListener("pointerup", end);
  ban.addEventListener("pointercancel", end);
  ban.addEventListener("lostpointercapture", end);
  ban.addEventListener("contextmenu", (e) => e.preventDefault());
  ban.addEventListener("click", () => {
    if (ui.previewHeld) { ui.previewHeld = false; return; } // that was a hold, not a click
    if (p.making) return toast(`${p.name} is still being made. It opens here as soon as it's ready.`);
    openProject(p.name);
  });
}

async function startProjectPreview(ban, p, prog, label) {
  stopProjectPreview();
  ui.preview = { ban, prog, label, t0: performance.now(), duration: 0 };
  ban.classList.add("previewing");
  label.textContent = "Listening";
  const r = await booth("previewProject", { name: p.name, on: true });
  if (!ui.preview || ui.preview.ban !== ban) return;
  if (!r || r.error) { toast((r && r.error) || "Can't play this one yet.", true); return stopProjectPreview(); }
  ui.preview.duration = r.duration || 30;
  ui.preview.t0 = performance.now();
  const tick = () => {
    const pv = ui.preview;
    if (!pv || pv.ban !== ban) return;
    pv.prog.style.setProperty("--p", Math.min(1, (performance.now() - pv.t0) / 1000 / pv.duration));
    pv.raf = requestAnimationFrame(tick);
  };
  tick();
}

function stopProjectPreview() {
  const pv = ui.preview;
  if (!pv) return;
  ui.preview = null;
  cancelAnimationFrame(pv.raf);
  pv.ban.classList.remove("previewing");
  pv.prog.style.setProperty("--p", 0);
  pv.label.textContent = "Hold to listen";
  booth("previewProject", { on: false });
}

function openProject(name) {
  stopProjectPreview();
  showHome(false);
  if (name !== ui.state.session) run("openSession", { name });
}

// The logo: click for the Projects page (or back to the open project from there),
// right-click for settings (audio, background and the rest).
const hasProjects = () => !!(ui.state && ui.state.projects && ui.state.projects.length);
$("home-logo").onclick = (e) => { e.stopPropagation(); if (!$("home-back").hidden) showHome(false); };
$("home-logo").oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); toggleSettings(); };
$("home-back").onclick = () => showHome(false);
$("home-new").onclick = () => run("newSession").then((r) => r && r.ok && showHome(false));
$("veil-skip").onclick = hideVeil;
for (const b of document.querySelectorAll(".home-tab")) b.onclick = () => { ui.homeTab = b.dataset.tab; renderHome(); };
{
  const bar = document.querySelector(".home-new");
  bar.addEventListener("dragover", (e) => { e.preventDefault(); bar.classList.add("drop"); });
  bar.addEventListener("dragleave", () => bar.classList.remove("drop"));
  bar.addEventListener("drop", (e) => {
    e.preventDefault(); bar.classList.remove("drop");
    run("newSession").then((r) => r && r.ok && (showHome(false), run("browseForBeat")));
  });
}

$("btn-export").onclick = () => run("exportTakes").then((r) => r && r.ok && toast(`Exported ${r.files} lane(s) to Music/PURP/Exports. They all start at bar 1.`));
$("btn-lane").onclick = () => run("newTakeLane");
$("btn-inst").onclick = (e) => { e.stopPropagation(); showInstrumentMenu($("btn-inst"), null); };
$("btn-bypass").onclick = () => { const c = selectedRackClip(); if (c) run("bypassAll", fxTarget(c)); };
$("btn-save-chain").onclick = (e) => { e.stopPropagation(); promptChainName($("btn-save-chain")); };
$("session").onclick = (e) => { e.stopPropagation(); if (e.target.tagName !== "INPUT") showSessionMenu($("session")); };
$("session").ondblclick = (e) => { e.stopPropagation(); hidePop(); renameProject(); };
function renameProject() {
  inlineEdit($("session"), ui.state.session, (v) => run("renameSession", { name: v }).then((r) => r && (r.error || r.message) && toast(r.error || r.message)));
}
$("tool-cut").onclick = () => setCutMode(!ui.cutMode);
$("zoom-fit").onclick = () => fitSong();

$("logo").onclick = (e) => { e.stopPropagation(); if (hasProjects()) showHome(true); else toggleSettings(); };
$("logo").oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); toggleSettings(); };

// A typed tempo stays inside 40..250 like the drag (stress test, 8 Nov: typing 5 made an 8-second clip
// 192 seconds long, and -20 or 1000 went through too). Nonsense or an empty box puts the old tempo back.
// window.KT2_BPM_TYPE_OLD = true: the old way (any number, nonsense = 120).
$("bpm").addEventListener("change", (e) => {
  if (window.KT2_BPM_TYPE_OLD) return run("setBpm", { bpm: parseFloat(e.target.value) || 120 });
  const cur = (ui.state && ui.state.bpm) || 120, v = parseFloat(e.target.value);
  const bpm = isFinite(v) && v > 0 ? Math.max(40, Math.min(250, Math.round(v * 10) / 10)) : cur;
  e.target.value = String(bpm);
  if (Math.abs(bpm - cur) > 1e-6) run("setBpm", { bpm });
});
$("bpm").addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.target.blur();
  // Cmd+Z in the tempo box undoes like everywhere else: half-typed digits are dropped, otherwise
  // the last edit (the tempo you just set) is undone. Cmd+Shift+Z redoes.
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    const typed = Number(e.target.value) !== Number(ui.state.bpm.toFixed(2));
    e.target.value = Number(ui.state.bpm.toFixed(2));
    e.target.blur();
    if (!typed) undoRedo(e.shiftKey);
  }
});

document.addEventListener("click", (e) => {
  if (!$("pop").contains(e.target)) hidePop();
  if (!$("settings").hidden && !$("settings").contains(e.target) && !$("pop").contains(e.target)) toggleSettings(false);
});

$("ruler").addEventListener("mousedown", (e) => { if (e.button === 0) startMarkerDrag(e, $("ruler")); });
$("ruler").addEventListener("dblclick", () => fitSong()); // like Ableton: double-click the ruler to see the whole song
$("sec-auto").onclick = (e) => { e.stopPropagation(); autoSections(); };
$("sec-add").onclick = (e) => { e.stopPropagation(); showAddSection($("sec-add")); };

// Zoom: pinch on the trackpad (or Cmd + scroll) zooms the timeline around the pointer.
// Scrolling up/down over the ruler or the sections zooms too, like FL Studio.
$("scroll").addEventListener("wheel", (e) => {
  const overTop = !!e.target.closest(".timeline-top");
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey ? 0.012 : 0.004)), e.clientX);
  } else if (overTop && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.004), e.clientX);
  }
}, { passive: false });

// Safari-style pinch events (the Mac app's web view sends these for trackpad pinches).
let pinchScale = 1;
$("scroll").addEventListener("gesturestart", (e) => { e.preventDefault(); pinchScale = 1; });
$("scroll").addEventListener("gesturechange", (e) => {
  e.preventDefault();
  zoomAt(e.scale / pinchScale, e.clientX);
  pinchScale = e.scale;
});
$("scroll").addEventListener("gestureend", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (ui.tune && !["Escape", " ", "Enter"].includes(e.key)) return;
  const mod = e.metaKey || e.ctrlKey;
  if (ui.roll && window.MidiTools && MidiTools.onKey(e)) return; // piano roll: select, quantize, transpose...
  if ((ui.roll || iw) && !["Escape", " ", "Enter"].includes(e.key) && !(mod && /^[zZ]$/.test(e.key))) return;

  if (ui.home) { // the home page only knows P / Escape (back to the open project)
    if (!mod && (e.key === "Escape" || e.key === "p" || e.key === "P") && $("home-back").hidden === false) showHome(false);
    return;
  }
  if (!mod && (e.key === "p" || e.key === "P") && ui.state && ui.state.projects && ui.state.projects.length) { showHome(true); return; }
  if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); undoRedo(e.shiftKey); return; }
  if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); run("save").then((r) => r && !r.error && toast(r.message || "Saved")); return; }
  if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomAt(1.3); return; }
  if (mod && (e.key === "-" || e.key === "_")) { e.preventDefault(); zoomAt(1 / 1.3); return; }
  if (mod && e.key === "0") { e.preventDefault(); fitSong(); return; }
  // Cmd+D duplicates the picked patterns (Eman, 7 Nov V4x; Cmd+B still works). KT2_CMD_D_DESELECT = the old "let go of everything" (4 Nov)
  if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); if (window.KT2_CMD_D_DUP || !window.KT2_CMD_D_DESELECT) duplicateSelected(); else { ui.selectedTrack = null; document.querySelectorAll(".row.selected").forEach((n) => n.classList.remove("selected")); selectClip(null); } return; }
  if (mod && e.key.toLowerCase() === "a" && !ui.roll) { // every clip on the picked lane (or every vocal clip)
    e.preventDefault();
    const pool = allClips().filter((c) => c.track.kind !== "beat" && (!ui.selectedTrack || c.track.id === ui.selectedTrack) &&
      (!ui.selectedClip || ui.selectedTrack || c.track.id === findClip(ui.selectedClip)?.track.id));
    if (!pool.length) return;
    ui.selectedClip = pool[0].id; ui.extraClips = new Set(pool.slice(1).map((c) => c.id)); ui.selectedTrack = null;
    ui.laneSig = ""; render();
    return;
  }
  if (mod) return;

  switch (e.key) {
    case " ": e.preventDefault(); run("togglePlay"); break;
    case "Enter": e.preventDefault(); run("stop"); break; // like the Stop button: back to where play started, again = 0:00
    case "r": case "R": run("toggleRecord"); break;
    case "l": case "L": run("setLooping", { on: !ui.transport.looping }); break;
    case "k": case "K": run("toggleClick"); break;
    case "s": case "S": splitAtPlayhead(); break;
    case "c": case "C": setCutMode(!ui.cutMode); break;
    case "n": case "N": run("newTakeLane"); break;
    case "f": case "F": fitSong(); break;
    case "Escape": hidePop(); toggleSettings(false); setCutMode(false); if (ui.plugwin) closePluginPanel(); else if (ui.tune) $("tune-cancel").click(); else if (iw) closeLaneWindow(); else selectClip(null); break;
    case "Backspace": case "Delete": deleteSelected(); break;
    case "+": case "=": zoomAt(1.4); break;
    case "-": zoomAt(1 / 1.4); break;
    default:
      if (/^[1-9]$/.test(e.key) && ui.sortedChains) {
        const ch = ui.sortedChains[Number(e.key) - 1];
        if (ch) applyChain(ch.name);
      }
  }
});

window.addEventListener("resize", () => { if (ui.fitted && ui.state) fitSong(false); ui.laneSig = ""; render(); });

booth.on("state", (s) => { ui.state = s; if (!ui.scrubbing) ui.transport = s.transport; render(); });
booth.on("transport", (t) => {
  // While the marker is being dragged, the screen follows the mouse, not the engine.
  ui.transport = ui.scrubbing ? { ...t, position: ui.transport.position, looping: ui.transport.looping } : t;
  ui.transportAt = performance.now();
  renderTransport();
  tunePlayhead();
  updateAutoReadouts(ui.transport.position || 0);
  updateAutoControls(ui.transport.position || 0);
  updateClipMeters(t.fx);
  feedTuneMeters(t.tune);
});

// SC Clip cards: a short history of the dB shaved off, from the transport event (~30 a second).
function updateClipMeters(fx) {
  if (!fx) return;
  for (const [pid, db] of Object.entries(fx)) {
    if (db < 0) continue;
    let m = ui.clipMeters.get(pid);
    if (!m) ui.clipMeters.set(pid, (m = { hist: new Float32Array(90), pos: 0, hold: 0, at: 0 }));
    m.hist[m.pos] = db;
    m.pos = (m.pos + 1) % m.hist.length;
    // The number holds the biggest recent value for half a second, then follows.
    const now = performance.now();
    if (db >= m.hold || now - m.at > 500) { m.hold = db; m.at = now; }
    const cv = document.querySelector(`.card[data-plugin="${pid}"] .card-screen`);
    const c = cv && selectedRackClip();
    const p = c && c.plugins.find((x) => x.id === pid);
    if (p) drawDevice(cv, p);
  }
}
booth.on("update", onUpdateStatus);

if (!juce) ui.selectedClip = "c2"; // browser preview opens with a chain showing
booth("getState").then((s) => { ui.state = s; ui.transport = s.transport; render(); if (s.projects && s.projects.length) showHome(true); });
booth("updateStatus").then(onUpdateStatus);

// ---------------------------------------------------------------------------
// Logo menu: audio routing (like Ableton's Audio tab), the background, and the rest
// of the settings. The look saves in the app (setLook), so it's there next launch.
// Eman's KILLTOY artworks (from the KILLTOY project in Frame). An old saved look that
// points at a picture no longer here falls back to the first one.
const ARTWORKS = Array.from({ length: 31 }, (_, i) => `bg/KT_UP_${String(i + 1).padStart(2, "0")}.jpg`);
// picker thumbnails follow the 3D remakes on the web app (KT2_BG_3D_OFF = old thumbnails)
// On the published page the thumbnails come from window.KT2_BG3D_BLOBS too ("KT_UP_NN-s.jpg" keys).
const thumbOf = (src) => {
  if (!window.KT2_BG_3D_OFF && document.documentElement.classList.contains("kt2") && /^bg\/KT_UP_\d\d\.jpg$/.test(src)) {
    const n = src.slice(3).replace(/\.jpg$/, "-s.jpg");
    const local = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) || location.protocol === "file:";
    return (!local && (window.KT2_BG3D_BLOBS || {})[n]) || "bg-3d/" + n;
  }
  return src.replace(/\.jpg$/, "-s.jpg");
};

function toggleSettings(force) {
  const box = $("settings");
  const show = force === undefined ? box.hidden : force;
  if (show === !box.hidden) return;
  box.hidden = !show;
  $("logo").classList.toggle("open", show);
  if (!show) return;
  hidePop();
  renderBackgrounds();
  renderMoreSettings();
  $("audio-rows").replaceChildren(el("span", null, "Loading\u2026"));
  booth("getAudioSetup").then(renderAudioRows);
}

function renderAudioRows(a) {
  const box = $("audio-rows");
  box.replaceChildren();
  if (!a || a.error) { box.append(el("div", "set-note", (a && a.error) || "No audio device.")); return; }

  const select = (label, options, value, key, fmt = (v) => v) => {
    const s = el("select");
    const list = options.length ? options : [value || "None"];
    for (const o of list) {
      const opt = el("option", null, fmt(o));
      opt.value = o;
      if (String(o) === String(value)) opt.selected = true;
      s.append(opt);
    }
    s.onchange = () => setAudio({ [key]: typeof value === "number" ? Number(s.value) : s.value });
    box.append(el("span", null, label), s);
  };

  if (a.types.length > 1) select("Driver", a.types, a.type, "type");
  select("Input", a.inputs, a.input, "input");
  select("Mic", a.mics, a.mic, "mic", (m) => m);
  select("Output", a.outputs, a.output, "output");
  if (a.sampleRates.length) select("Sample rate", a.sampleRates, a.sampleRate, "sampleRate", (r) => `${Math.round(r)} Hz`);

  // Buffer length: a slider over the sizes the interface allows.
  const sizes = a.bufferSizes.length ? a.bufferSizes : [a.bufferSize];
  const wrap = el("div", "buf");
  const val = el("b");
  const slider = el("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = sizes.length - 1;
  slider.value = Math.max(0, sizes.indexOf(a.bufferSize));
  const show = () => {
    const n = sizes[Number(slider.value)];
    val.replaceChildren(document.createTextNode(`${n} samples`), el("small", null, `${(1000 * n / (a.sampleRate || 48000)).toFixed(1)} ms`));
  };
  slider.oninput = show;
  slider.onchange = () => setAudio({ bufferSize: sizes[Number(slider.value)] });
  show();
  wrap.append(val, slider);
  box.append(el("span", null, "Buffer"), wrap);
  box.append(el("div", "set-note", "Smaller buffer = less delay in your headphones while recording. Go bigger if you hear clicks."));
}

function setAudio(change) {
  run("setAudioSetup", change).then((r) => {
    if (r && !r.error) renderAudioRows(r);
    setTimeout(() => !$("settings").hidden && booth("getAudioSetup").then(renderAudioRows), 700);
  });
}

function renderBackgrounds() {
  const grid = $("bg-grid");
  grid.replaceChildren();
  const look = currentLook();
  const tile = (cls, title, on, pick) => {
    const b = el("button", "bg-tile " + cls + (on ? " on" : ""));
    b.title = title;
    b.onclick = (e) => { e.stopPropagation(); pick(); };
    grid.append(b);
    return b;
  };

  tile("t-dark", "Dark: clean, no picture", look.mode === "dark", () => saveLook({ ...look, mode: "dark" })).append(el("span", null, "Dark"));
  tile("t-light", "Light", look.mode === "light", () => saveLook({ ...look, mode: "light" })).append(el("span", null, "Light"));
  const color = tile("t-color", "Color: one slider moves the whole gradient", look.mode === "color", () => saveLook({ ...look, mode: "color" }));
  color.style.background = colorLook(look.hue || 0).bg;
  color.append(el("span", null, "Color"));

  for (const src of ARTWORKS) {
    const b = tile("", "Use this picture", look.mode === "image" && look.image === src, () => saveLook({ ...look, mode: "image", image: src }));
    b.style.backgroundImage = `url("${thumbOf(src)}")`;
  }

  const own = (ui.state && ui.state.look && ui.state.look.backgrounds) || [];
  for (const name of own) {
    const src = "user-bg/" + encodeURIComponent(name);
    const b = tile("", name, look.mode === "image" && look.image === "user-bg/" + name, () => saveLook({ ...look, mode: "image", image: "user-bg/" + name }));
    b.style.backgroundImage = `url("${src}")`;
    const x = el("span", "x", "\u2715");
    x.title = "Remove this picture";
    x.onclick = (e) => { e.stopPropagation(); run("removeBackground", { file: name }); };
    b.append(x);
  }

  // Pictures you added on the web app (dropped on the grid or picked with +), kept in this browser.
  if (bgDropOn()) for (const p of ui.webBgs || []) {
    const b = tile("", p.name, look.mode === "image" && look.image === "mybg/" + p.id, () => saveLook({ ...look, mode: "image", image: "mybg/" + p.id }));
    b.style.backgroundImage = `url("${p.url}")`;
    const x = el("span", "x", "\u2715");
    x.title = "Remove this picture";
    x.onclick = (e) => { e.stopPropagation(); removeWebBg(p.id); };
    b.append(x);
  }

  const add = tile("t-add", "Add your own picture (or drop pictures anywhere here)", false, addBackground);
  add.textContent = "+";

  $("color-row").hidden = look.mode !== "color";
  renderLookSliders(look);
  $("color-slider").value = Math.round((look.hue || 0) * 1000);
  $("color-slider").style.setProperty("--hue-track", hueTrack());
}

function addBackground() {
  if (juce) return run("pickBackground");
  $("bg-file").click(); // browser preview: keep it for this page only
}

$("bg-file").onchange = (e) => {
  if (bgDropOn()) { addWebBgs([...(e.target.files || [])]); e.target.value = ""; return; }
  const f = e.target.files[0];
  if (!f) return;
  ui.demoBg = URL.createObjectURL(f);
  saveLook({ ...currentLook(), mode: "image", image: ui.demoBg });
};

// Drag pictures from the desktop straight onto the background grid, anywhere on it, and they join
// the collection (Eman, 12 Nov 00:28). On the web app they're kept in this browser (IndexedDB), so
// they survive a reload and can be picked again later; the newest one dropped becomes the background.
// The + tile adds the same way now (before, a picked picture lasted only until the page reloaded).
// window.KT2_BG_DROP_OLD = true: the old way (no dropping, + keeps it for this page only).
const bgDropOn = () => !window.KT2_BG_DROP_OLD && !juce;
const BGDB = { name: "kt2-backgrounds", store: "pics" };
function bgDb() {
  if (!ui.bgDbP) ui.bgDbP = new Promise((ok, no) => {
    try {
      const r = indexedDB.open(BGDB.name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(BGDB.store, { keyPath: "id" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    } catch (e) { no(e); }
  });
  return ui.bgDbP;
}
function bgTx(mode, fn) {
  return bgDb().then((db) => new Promise((ok, no) => {
    const tx = db.transaction(BGDB.store, mode);
    const out = fn(tx.objectStore(BGDB.store));
    tx.oncomplete = () => ok(out && "result" in out ? out.result : undefined);
    tx.onerror = () => no(tx.error);
  }));
}
function loadWebBgs() {
  if (!bgDropOn() || typeof indexedDB === "undefined") return Promise.resolve();
  return bgTx("readonly", (st) => st.getAll()).then((rows) => {
    for (const p of ui.webBgs || []) URL.revokeObjectURL(p.url);
    ui.webBgs = (rows || []).sort((a, b) => a.at - b.at).map((r) => ({ id: r.id, name: r.name, url: URL.createObjectURL(r.blob) }));
    ui.lookSig = null; applyLook(currentLook()); // a saved "mybg/" look can show now
    if (!$("settings").hidden || document.querySelector("#bg-grid .bg-tile")) renderBackgrounds();
  }).catch(() => { ui.webBgs = ui.webBgs || []; });
}
const isPicture = (f) => f && (/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(f.name || ""));
function addWebBgs(files) {
  const pics = files.filter(isPicture);
  if (!pics.length) { if (files.length) toast("Only pictures can be backgrounds (JPG, PNG, WEBP, GIF)."); return Promise.resolve(); }
  let last = null;
  const rows = pics.map((f, i) => ({ id: Date.now().toString(36) + "-" + i + "-" + Math.random().toString(36).slice(2, 6), name: f.name || "Picture", at: Date.now() + i, blob: f }));
  return bgTx("readwrite", (st) => { for (const r of rows) st.put(r); }).then(() => {
    ui.webBgs = ui.webBgs || [];
    for (const r of rows) { const p = { id: r.id, name: r.name, url: URL.createObjectURL(r.blob) }; ui.webBgs.push(p); last = p; }
    saveLook({ ...currentLook(), mode: "image", image: "mybg/" + last.id });
    toast(rows.length > 1 ? `Added ${rows.length} pictures to your backgrounds.` : "Added to your backgrounds.");
  }).catch(() => {
    // storage blocked (private window): still show it, for this page only
    const p = { id: "tmp-" + Date.now().toString(36), name: pics[0].name, url: URL.createObjectURL(pics[0]) };
    (ui.webBgs = ui.webBgs || []).push(p);
    saveLook({ ...currentLook(), mode: "image", image: "mybg/" + p.id });
    toast("Added for now. This browser won't keep it after a reload.");
  });
}
function removeWebBg(id) {
  const p = (ui.webBgs || []).find((x) => x.id === id);
  ui.webBgs = (ui.webBgs || []).filter((x) => x.id !== id);
  const look = currentLook();
  const done = () => { if (look.mode === "image" && look.image === "mybg/" + id) saveLook({ ...look, mode: "image", image: ARTWORKS[0] }); else renderBackgrounds(); if (p) setTimeout(() => URL.revokeObjectURL(p.url), 1000); };
  bgTx("readwrite", (st) => { st.delete(id); }).then(done, done);
}
window.KT2_bgUrl = (img) => {
  if (!img || !img.startsWith("mybg/")) return img;
  const p = (ui.webBgs || []).find((x) => "mybg/" + x.id === img);
  return p ? p.url : null;
};
{
  const grid = $("bg-grid");
  const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
  let depth = 0;
  grid.addEventListener("dragenter", (e) => { if (!bgDropOn() || !hasFiles(e)) return; e.preventDefault(); depth++; grid.classList.add("drop"); });
  grid.addEventListener("dragover", (e) => { if (!bgDropOn() || !hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; grid.classList.add("drop"); });
  grid.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; grid.classList.remove("drop"); } });
  grid.addEventListener("drop", (e) => {
    if (!bgDropOn() || !hasFiles(e)) return;
    e.preventDefault(); e.stopPropagation(); depth = 0; grid.classList.remove("drop");
    addWebBgs([...(e.dataTransfer.files || [])]);
  });
  loadWebBgs();
}

$("color-slider").oninput = (e) => {
  const look = { ...currentLook(), mode: "color", hue: Number(e.target.value) / 1000 };
  ui.lookLocal = look;
  applyLook(look);
  const t = document.querySelector(".bg-tile.t-color");
  if (t) t.style.background = colorLook(look.hue).bg;
};
$("color-slider").onchange = () => saveLook(ui.lookLocal || currentLook());

// Overlay (black over the picture), blur and grain, for a picture or a colour.
// Real film-grain plates from Eman's Frame grain folder, finest first. They're grey
// (neutral under the overlay blend), so the layer gets a contrast boost to show.
const GRAINS = [
  { id: "k50d", name: "50D", file: "stock_k50d" },
  { id: "k250d", name: "250D", file: "stock_k250d" },
  { id: "1080p", name: "Digital", file: "grain_1080p" },
  { id: "k500t", name: "500T", file: "stock_k500t" },
  { id: "fuji", name: "Fuji 35", file: "fuji_35mm_4k" },
  { id: "dx5222", name: "Double-X", file: "stock_dx5222" },
  { id: "k16", name: "16mm", file: "stock_k16" },
  { id: "k500p", name: "500 Push", file: "stock_k500p" },
];
// The live web app has no grain/ folder (it never fit the publish), so the plates 404'd: grey tiles and
// a Grain slider that showed nothing (Eman, 12 Nov). They live in the artifact's asset store instead,
// like the HD backgrounds. window.KT2_GRAIN_OLD = the old local path only.
const GRAIN_BLOBS = { "stock_k50d": "/_blob/b62269f61d74407ac73c20b2064b40d5", "stock_k250d": "/_blob/b97362aaa85fef870f3fb5d09540cab6", "grain_1080p": "/_blob/876eecef31284dc98b5008561be4e414", "stock_k500t": "/_blob/7b0eb0c2fed981f118500169e04e2dcc", "fuji_35mm_4k": "/_blob/504fd1dc20c3f0ceec36fd4591e96201", "stock_dx5222": "/_blob/062ee1e57bb48b653a29ad1e4c952a25", "stock_k16": "/_blob/08f41b68d807f0dc7aed725cf8f17d08", "stock_k500p": "/_blob/c6aab6b4d7064ac6d7b7e69818872751" };
const grainSrc = (file) => {
  const local = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) || location.protocol === "file:";
  return (!window.KT2_GRAIN_OLD && !local && GRAIN_BLOBS[file]) || `grain/${file}.jpg`;
};
const grainUrl = (g) => `url("${grainSrc(g.file)}")`;
const lookValues = (look) => ({
  overlay: look.overlay != null ? look.overlay : 0.2,
  blur: look.blur || 0,
  bright: look.bright != null ? look.bright : 1,
  grain: look.grain != null ? look.grain : look.mode === "color" ? 0.42 : 0,
  grainType: GRAINS.some((g) => g.id === look.grainType) ? look.grainType : "k250d",
});

function applyBackdrop(look) {
  const v = lookValues(look);
  const on = look.mode === "image" || look.mode === "color";
  $("shade").style.opacity = on ? v.overlay : 0;
  const px = Math.round(v.blur * 48);
  $("bg").style.filter = [px ? `blur(${px}px)` : "", v.bright !== 1 ? `brightness(${v.bright})` : ""].join(" ").trim();
  $("bg").classList.toggle("blurred", px > 0);
  const url = grainUrl(GRAINS.find((g) => g.id === v.grainType));
  for (const [id, o] of [["grain", Math.min(1, v.grain)], ["grain2", Math.max(0, v.grain - 1)]]) {
    $(id).style.backgroundImage = url;
    $(id).style.opacity = on ? o : 0;
  }
}

function renderLookSliders(look) {
  $("look-sliders").hidden = !(look.mode === "image" || look.mode === "color");
  const v = lookValues(look);
  for (const [k, scale] of [["bright", 100], ["overlay", 100], ["blur", 100], ["grain", 100]]) {
    $("look-" + k).value = Math.round(v[k] * scale);
    $("look-" + k + "-v").textContent = Math.round(v[k] * scale) + "%";
  }
  const box = $("grain-types");
  box.replaceChildren();
  for (const g of GRAINS) {
    const b = el("button", g.id === v.grainType ? "on" : "");
    b.style.backgroundImage = grainUrl(g);
    b.title = g.name + " grain";
    b.append(el("span", null, g.name));
    b.onclick = (e) => { e.stopPropagation(); saveLook({ ...currentLook(), grainType: g.id, grain: v.grain || 0.6 }); };
    box.append(b);
  }
}

for (const k of ["bright", "overlay", "blur", "grain"]) {
  $("look-" + k).oninput = (e) => {
    const look = { ...currentLook(), [k]: Number(e.target.value) / 100 };
    ui.lookLocal = look;
    applyBackdrop(look);
    $("look-" + k + "-v").textContent = e.target.value + "%";
  };
  $("look-" + k).onchange = () => saveLook(ui.lookLocal || currentLook());
}

function renderMoreSettings() {
  const box = $("more-rows");
  box.replaceChildren();
  const item = (label, meta, fn, cls = "") => {
    const b = el("button", "set-item " + cls, label);
    if (meta) b.append(el("span", "meta", meta));
    b.onclick = (e) => { e.stopPropagation(); fn(b); };
    box.append(b);
    return b;
  };

  const row = el("div", "set-item");
  row.append(document.createTextNode("Count-in"));
  const seg = el("div", "seg");
  seg.style.marginLeft = "auto";
  for (const [label, bars] of [["Off", 0], ["1 bar", 1], ["2 bars", 2]]) {
    const b = el("button", (ui.state.countIn || 0) === bars ? "on" : "", label);
    b.onclick = (e) => { e.stopPropagation(); run("setCountIn", { bars }).then(renderMoreSettings); };
    seg.append(b);
  }
  row.append(seg);
  box.append(row);

  item(ui.state.scanningPlugins ? "Looking for plugins\u2026" : "Find my plugins\u2026", `VST3 / AU \u00b7 ${ui.state.pluginCount || 0} found`, findPlugins);
  item("Plugin list\u2026", "hide or remove", () => run("managePlugins"));
  item("Show presets folder", "", () => run("revealChains"));
  const ai = ui.state.ai || {};
  if (ai.installed) item("AI tools ready", ((ai.details || {}).device || "").toUpperCase(), () => {});
  else if (ai.installing) item("Installing AI tools\u2026", "see corner", () => {});
  else item("Install AI tools\u2026", "~1 GB, once", installAiTools, "cta");
  if (!window.purpPlayground) {
    if (ai.voiceInstalled) item("Voice changer ready", "Seed-VC", () => {});
    else if (ai.voiceInstalling) item("Installing the voice changer\u2026", "see corner", () => {});
    else item("Install voice changer\u2026", "~3 GB, once \u00b7 woman's voice etc.", installVoiceTools);
  }
  item("ACE-Step address\u2026", "Send to AI", () => { toggleSettings(false); promptAceStepUrl(); });
  if (window.killtoyAssistant) { const k = killtoyAssistant.hasKey(); item("Claude key\u2026", k ? "saved \u00b7 talking avatar" : "for the talking avatar", () => { toggleSettings(false); killtoyAssistant.askForKey(); }); }
  item("Export full mix", "all lanes", () => {
    if (window.purpPlayground) toast("Recording the mix: it plays once from bar 1 to the end. Press Space to stop early.");
    run("exportMix").then((r) => r && (r.ok || r.message) && toast(r.message || "Mix exported to Music/PURP/Exports."));
  });
  item("More audio settings\u2026", "all channels", () => run("audioSettings"));
  const u = updateMenuItem();
  item(u.label, u.meta, () => { toggleSettings(false); u.run(); }, u.on ? "cta" : "");
}

// --- the look
function currentLook() {
  const saved = ui.state && ui.state.look && ui.state.look.look;
  return { mode: "dark", hue: 0, ...(ui.lookLocal || (saved && typeof saved === "object" ? saved : {})) };
}

function saveLook(look) {
  ui.lookLocal = look;
  applyLook(look);
  renderBackgrounds();
  if (!String(look.image || "").startsWith("blob:")) run("setLook", { look });
}

// One slider position -> a whole palette: three hues that travel round the colour wheel
// together, plus the vocal purple following along.
function colorLook(t) {
  const h = (262 + t * 360) % 360;
  const bg = `radial-gradient(90% 80% at 12% 8%, hsl(${(h + 48) % 360}, 88%, 62%) 0%, transparent 60%),` +
             `radial-gradient(80% 90% at 92% 96%, hsl(${(h + 320) % 360}, 82%, 52%) 0%, transparent 62%),` +
             `radial-gradient(60% 60% at 60% 40%, hsl(${(h + 15) % 360}, 70%, 34%) 0%, transparent 70%),` +
             `linear-gradient(140deg, hsl(${h}, 62%, 14%), hsl(${(h + 30) % 360}, 58%, 24%) 55%, hsl(${(h + 70) % 360}, 66%, 30%))`;
  return { bg, accent: `hsl(${(h + 8) % 360}, 88%, 70%)` };
}

function hueTrack() {
  const stops = [];
  for (let i = 0; i <= 12; i++) stops.push(`hsl(${(262 + (i / 12) * 360 + 30) % 360}, 75%, 50%)`);
  return `linear-gradient(90deg, ${stops.join(",")})`;
}

function applyLook(look) {
  if (cssVarCache) cssVarCache.at = 0;
  const sig = JSON.stringify(look);
  if (sig === ui.lookSig) return;
  ui.lookSig = sig;
  const b = document.body;
  for (const m of ["dark", "light", "image", "color"]) b.classList.toggle("look-" + m, look.mode === m);
  const bg = $("bg");
  bg.style.background = "";
  b.style.removeProperty("--purple");
  if (look.mode === "image" && look.image && look.image.startsWith("bg/") && !ARTWORKS.includes(look.image)) look = { ...look, image: ARTWORKS[0] };
  if (look.mode === "image" && look.image) {
    // Web app: the clean 3072 px copies made from Eman's 4K Frame upscales (bg-hd/). The old
    // bg/ copies have the original's film grain baked in, and their JPEG squeeze made it blotchy
    // and pixel-looking even with Grain at 0 (Eman, 11 Nov 23:04). KT2_BG_GRAINY_OLD = old pictures.
    // Published page: the HD copies live in the asset store (the page is at its size cap); localhost: bg-hd/.
    const HD_BLOBS = { "KT_UP_01.jpg": "/_blob/a238116ef65cdfee239b82851625a54b", "KT_UP_02.jpg": "/_blob/2d62477088500d81bdd866dea5fc2928", "KT_UP_03.jpg": "/_blob/38f710f447c815711527ab57f608979b", "KT_UP_04.jpg": "/_blob/d14bf0dda1c34b99a42facafb31eb9da", "KT_UP_05.jpg": "/_blob/458bb6ead8bdd494ba7da19d80df01c6", "KT_UP_06.jpg": "/_blob/ccd6f73fa9ef96b247016c3568b20b33", "KT_UP_07.jpg": "/_blob/7ee7229f2c0cdef30397c5924044124f", "KT_UP_08.jpg": "/_blob/beba93d31bfc18c2dc121921dc2df587", "KT_UP_09.jpg": "/_blob/f789e10e262867cb12748fea0932ab57", "KT_UP_10.jpg": "/_blob/aa8863e11ee5e5532adfc0567265f2d6", "KT_UP_11.jpg": "/_blob/676947af71519cac4f9062b143ab6994", "KT_UP_12.jpg": "/_blob/60d834bb4921c32825d76f0e0265ef18", "KT_UP_13.jpg": "/_blob/6839b39e1bcb4ecb74a12196f173237a", "KT_UP_14.jpg": "/_blob/fbde153a912ba106ce65bca272de6b45", "KT_UP_15.jpg": "/_blob/6acc4119e45a2ee5ecc54d2981c88908", "KT_UP_16.jpg": "/_blob/6d3b7d4ba9bedd2980339febd11c56fb", "KT_UP_17.jpg": "/_blob/07bade573653b224178ede35f8197707", "KT_UP_18.jpg": "/_blob/42b9bb427e9605204e693b8371af1e28", "KT_UP_19.jpg": "/_blob/9d616a8241ade589dd08072634502859", "KT_UP_20.jpg": "/_blob/d05497551a73223e04a7e834178e6279", "KT_UP_21.jpg": "/_blob/3aba7abb430dfe363a367268979b4944", "KT_UP_22.jpg": "/_blob/45f98be9ca64a48688fc68b4b90b4375", "KT_UP_23.jpg": "/_blob/32c1ba9ee2953e5dfc6b03068c61328d", "KT_UP_24.jpg": "/_blob/374514977a69e7f506c33df50fc0adfc", "KT_UP_25.jpg": "/_blob/6db591ce3144bd5e90aab06e99c42d44", "KT_UP_26.jpg": "/_blob/6d68119e9d98a84f6ad664cb5af943d4", "KT_UP_27.jpg": "/_blob/dc193e72e3b584005475581bba5c3ac1", "KT_UP_28.jpg": "/_blob/0b847ac7dc067bc6b4aab070bf482641", "KT_UP_29.jpg": "/_blob/3e989243b095f3e7fb2ee3062b2c54f3", "KT_UP_30.jpg": "/_blob/d0db5024a293ea0888534d3fe5a4d150", "KT_UP_31.jpg": "/_blob/8d999e75f92839935e66c22c6212cf7d" };
    const hdUrl = (img) => { const n = img.slice(3); const local = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) || location.protocol === "file:"; return (!local && HD_BLOBS[n]) || "bg-hd/" + n; };
    // 3D remakes (Eman, 12 Nov 00:55): Seedream 5.5 re-renders of all 31 (sharp 3D, glossy vinyl hair in each
    // character's own colour, bright backgrounds made dark). ui/bg-3d/ locally; BG3D_BLOBS on the published page.
    // KT2_BG_3D_OFF = the clean HD copies above.
    const BG3D_BLOBS = window.KT2_BG3D_BLOBS || {};
    const bg3dUrl = (img) => { const n = img.slice(3); const local = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) || location.protocol === "file:"; return (!local && BG3D_BLOBS[n]) || "bg-3d/" + n; };
    const hd = !window.KT2_BG_GRAINY_OLD && document.documentElement.classList.contains("kt2") && /^bg\/KT_UP_\d\d\.jpg$/.test(look.image);
    const mine = look.image.startsWith("mybg/") ? (window.KT2_bgUrl && window.KT2_bgUrl(look.image)) || "" : null;
    bg.style.backgroundImage = mine === "" ? "" : `url("${mine || (look.image.startsWith("user-bg/") ? "user-bg/" + encodeURIComponent(look.image.slice(8)) : hd ? (window.KT2_BG_3D_OFF ? hdUrl(look.image) : bg3dUrl(look.image)) : look.image)}")`;
  } else if (look.mode === "color") {
    const c = colorLook(look.hue || 0);
    bg.style.background = c.bg;
    b.style.setProperty("--purple", c.accent);
  }
  applyBackdrop(look);
  if (window.KT2BgPos) KT2BgPos.apply();   // dragged picture position (ui/kt2-prefs.js)
  // The Mac title bar takes the page colour, so there's no grey strip above the app.
  requestAnimationFrame(() => {
    const bgc = getComputedStyle(b).getPropertyValue("--bg").trim();
    if (/^#[0-9a-f]{6}$/i.test(bgc)) booth("setWindowColour", { colour: bgc });
  });

  // Waveform + card colours read the theme, so redraw them.
  ui.laneSig = "";
  ui.rackSig = "";
  if (ui.state) render();
}

// ---------------------------------------------------------------------------
// Updates: KILLTOY checks GitHub on launch and every 20 min, downloads new builds in the
// background, then this card offers "Restart to update" (Source/Updater.cpp).
function onUpdateStatus(u) {
  if (!u || u.error) return;
  ui.update = u;
  renderUpdate();

  if (!ui.updateAsked || u.state === "checking" || u.state === "downloading") return;
  ui.updateAsked = false;
  if (u.needsKey) return promptUpdateKey($("logo"));
  if (u.state === "ready") { ui.updateLater = 0; $("toast").hidden = true; renderUpdate(); }
  else toast(u.message, u.state === "failed");
}

function renderUpdate() {
  const u = ui.update;
  const ready = !!u && u.state === "ready";
  $("logo").classList.toggle("has-update", ready);
  const card = $("update-card");
  card.hidden = !ready || ui.updateLater === u.latest;
  if (card.hidden) return;
  $("update-title").textContent = `KILLTOY build ${u.latest} is ready`;
  const lines = (u.notes || "").split("\n").map((l) => l.trim()).filter(Boolean);
  $("update-notes").textContent = lines.length > 8 ? lines.slice(0, 8).join("\n") + "\n\u2026" : lines.join("\n");
  $("update-notes").hidden = !lines.length;
}

function checkForUpdates() {
  ui.updateAsked = true;
  toast("Looking for a new KILLTOY\u2026");
  run("updateCheck").then((u) => { if (u && u.error) ui.updateAsked = false; else if (u) onUpdateStatus(u); });
}

function installUpdate() {
  if (ui.transport.recording) return toast("Stop recording first, then restart to update.");
  run("updateInstall").then((r) => {
    if (!r || !r.ok) return;
    toast(r.installedTo ? "Installing into your Applications folder. Open KILLTOY from there from now on."
                        : "Saving your session and restarting into the new KILLTOY\u2026");
    $("update-card").hidden = true;
  });
}

function updateMenuItem() {
  const u = ui.update || {};
  const meta = u.build ? `build ${u.build}` : "";
  if (u.state === "ready") return { label: `Restart to update (build ${u.latest})`, meta, on: true, run: installUpdate };
  if (u.state === "downloading") return { label: `Downloading update ${Math.round((u.progress || 0) * 100)}%`, meta, run: () => {} };
  if (u.state === "off") return { label: "Check for updates\u2026", meta, run: () => toast(u.message) };
  return { label: "Check for updates\u2026", meta, run: checkForUpdates };
}

function promptUpdateKey(anchor) {
  const pop = $("pop");
  pop.replaceChildren();
  pop.append(el("div", "label", "GitHub key for updates"));
  const input = el("input");
  input.placeholder = "Paste the key, then Enter";
  input.onclick = (e) => e.stopPropagation();
  input.onkeydown = (e) => {
    if (e.key === "Escape") hidePop();
    if (e.key !== "Enter" || !input.value.trim()) return;
    hidePop();
    ui.updateAsked = true;
    run("updateSetKey", { key: input.value.trim() });
  };
  const help = el("button", "item", "Make a key on GitHub");
  help.append(el("span", "meta", "read-only"));
  help.onclick = (e) => { e.stopPropagation(); run("updateOpenKeyPage"); };
  pop.append(input, help);
  placePop(anchor, false);
  input.focus();
}

$("update-go").onclick = installUpdate;
$("update-later").onclick = () => { ui.updateLater = ui.update ? ui.update.latest : 0; renderUpdate(); };

// ---------------------------------------------------------------------------
// Demo backend: lets the UI run in a normal browser for design work.
function createDemoBackend() {
  const listeners = {};
  // Deep debug 16 Nov: one listener that threw used to stop every listener after it AND the command that sent the
  // event (halfway through its work). Each listener now runs on its own; the error is logged and kept in the black
  // box (ui/kt2-errlog.js). KT2_EMIT_RAW = old.
  const emit = (ev, data) => (listeners[ev] || []).forEach((fn) => {
    if (window.KT2_EMIT_RAW) return fn(data);
    try { fn(data); } catch (e) { console.error(e); try { if (window.KT2Errors) KT2Errors.add("listener:" + ev, e && e.message, e && e.stack ? String(e.stack).split("\n")[1] : ""); } catch (e2) { /* fine */ } }
  });
  let uid = 100;
  const id = () => String(++uid);
  const bar = 60 / 130 * 4;
  const prm = (pid, name, value, text) => ({ id: pid, name, value, text, def: value }); // def: where double-click / Reset go back to
  const fx = (name, type, params) => ({ id: id(), name, type, enabled: true, params });
  const PARAMS = {
    "4bandEq": () => [prm("Low-pass gain", "Low-shelf gain", 0.5, "0.0 dB"), prm("Mid gain 1", "Mid gain 1", 0.55, "+1.2 dB"), prm("High-pass gain", "High-shelf gain", 0.68, "+4.0 dB")],
    compressor: () => [prm("threshold", "Threshold", 0.6, "-18.0 dB"), prm("ratio", "Ratio", 0.3, "3.5 : 1"), prm("output gain", "Output gain", 0.5, "0.0 dB")],
    delay: () => [prm("purp:delayTime", "Time", 0.25, "375 ms"), prm("feedback", "Feedback", 0.42, "-12 dB"), prm("mix proportion", "Mix proportion", 0.3, "30%")],
    reverb: () => [prm("room size", "Room Size", 0.6, "60%"), prm("wet level", "Wet Level", 0.24, "24%"), prm("damping", "Damping", 0.5, "50%")],
    airwindows_drive: () => [prm("drive", "Drive", 0.42, "0.42"), prm("highpass", "Highpass", 0.1, "0.10"), prm("outlevel", "Out Level", 0.7, "0.70")],
    airwindows_deess: () => [prm("intense", "Intense", 0.4, "0.40"), prm("max", "Max DS", 0.5, "0.50"), prm("freq", "Freq", 0.5, "0.50")],
    purpgate: () => [prm("threshold", "Threshold", 0.45, "-45 dB"), prm("range", "Range", 0.8, "-40 dB"), prm("release", "Release", 0.3, "120 ms")],
    // KILLTOY's own effects (Source/dsp/fx): same knobs and starting points as the app.
    ktpump: () => [prm("depth", "Depth", 0.7, "70%"), prm("rate", "Rate", 0.5, "1/4"), prm("release", "Release", 0.526, "55%")],
    ktchoppitch: () => [prm("pitch", "Pitch", 0.5, "0.0 st"), prm("formant", "Formant", 0.5, "0.0 st"), prm("mix", "Mix", 1, "100%")],
    ktspace: () => [prm("size", "Size", 0.6, "60%"), prm("decay", "Decay", 0.485, "2.8 s"), prm("mix", "Mix", 0.3, "30%")],
    ktcrush: () => [prm("bits", "Bits", 0.429, "8.0 bits"), prm("rate", "Rate", 0.621, "11.0 kHz"), prm("mix", "Mix", 1, "100%")],
    ktloud: () => [prm("push", "Push", 0.25, "+6.0 dB"), prm("ceiling", "Ceiling", 0.917, "-1.0 dB"), prm("clip", "Clip", 0.4, "40%")],
    ktsnaptune: () => [prm("speed", "Speed", 0.5, "50%"), prm("humanize", "Humanize", 0.25, "25%"), prm("formant", "Formant", 0.5, "0.0 st"),
                       prm("key", "Key", S.key ? S.key.tonic / 11 : 9 / 11, S.key ? TUNE_KEYS[S.key.tonic] : "A"),
                       prm("scale", "Scale", S.key && S.key.minor ? 0.5 : 0, S.key && S.key.minor ? "Minor" : "Major")],
    // Playground-only for now (Web Audio in playground.js); the app's C++ versions come later.
    ktsquash: () => [prm("depth", "Depth", 0.4, "40%"), prm("time", "Time", 0.4, "40%"), prm("output", "Output", 0.5, "+0.0 dB")],
    // MAKE ROOM (MIX page "X WINS", 11 Nov): a dip at one frequency that only moves while the lane it follows plays (a dynamic EQ)
    ktroom: () => [prm("freq", "Freq", 0.5, "632 Hz"), prm("depth", "Depth", 0.5, "-6.0 dB"), prm("release", "Release", 0.3, "150 ms")],
    ktpunch: () => [prm("attack", "Attack", 0.7, "+40%"), prm("sustain", "Sustain", 0.5, "0%"), prm("mix", "Mix", 1, "100%")],
    kttexture: () => [prm("size", "Size", 0.5, "50%"), prm("density", "Density", 0.5, "50%"), prm("mix", "Mix", 0.5, "50%"), prm("mode", "Mode", 0, "Shimmer")],
    ktscclip: () => [prm("drive", "Drive", 0.167, "+4.0 dB"), prm("shape", "Shape", 0.4, "40%"), prm("ceiling", "Ceiling", 0.958, "-1.0 dB")],
    // TOYTUNE (ui/kt2-toytune.js): the card's 3 knobs; the rest lives in its window (p.tt)
    kttoytune: () => [prm("speed", "Speed", 0.5, "20ms"), prm("choir", "Choir", 0, "OFF"), prm("fx", "FX", 1, "100%")],
    kttoyvox: () => [prm("x", "Dark/Bright", 0.5, "0"), prm("y", "Dirt/Space", 0.5, "0"), prm("mix", "Mix", 1, "100%")],
    // KILLCHAIN, the sidechain (ui/killchain.js; web only for now)
    ktside: () => (window.KillChain ? KillChain.params() : []),
    // CORE FX + KILLTIME (ui/kt2-corefx.js, ui/killtime.js; web only for now)
    ...(window.KT2CoreFx ? KT2CoreFx.params() : {}),
  };
  const TYPES = { EQ: "4bandEq", Compressor: "compressor", Delay: "delay", Reverb: "reverb", Drive: "airwindows_drive", DeEss: "airwindows_deess", "Vocal Gate": "purpgate",
                  Pump: "ktpump", "Chop Pitch": "ktchoppitch", Space: "ktspace", Crush: "ktcrush", Loud: "ktloud", Squash: "ktsquash", Punch: "ktpunch", "Make Room": "ktroom", "SC Clip": "ktscclip", "TUNR": "ktsnaptune", TOYTUNE: "kttoytune", "TOY VOX": "kttoyvox", Texture: "kttexture", KILLCHAIN: "ktside",
                  Density: "airwindows_drive", "Tape Delay": "delay", "Low/High Pass": "4bandEq", ...(window.KT2CoreFx ? KT2CoreFx.types() : {}) };
  const make = (name) => { const p = fx(name, TYPES[name] || "vst", (PARAMS[TYPES[name]] || (() => []))()); if (p.type === "kttoytune" && window.KT2ToyTune) p.tt = KT2ToyTune.fresh(S.key); if (p.type === "kttoyvox" && window.KT2ToyVox) p.tv = KT2ToyVox.fresh(S.key); return p; };
  window.KT_FX_PARAMS = PARAMS;   // tests/kt2/fxcheck.js: each effect's knobs and starting values
  // The A/B returns (returns.js): lanes send to them with their A/B knobs (t.sends). Each starts
  // with one effect, all wet: A Space (a reverb) and B Echo (a dotted 1/8 delay at the song's tempo).
  const freshReturns = (bpm) => {
    const wet = (p, pid, value, text) => { const q = p.params.find((x) => x.id === pid); if (q) Object.assign(q, { value, text, def: value }); return p; };
    const echo = make("Delay"), t = (60 / (bpm || 120)) * 0.75;
    wet(echo, "purp:delayTime", t / 1.5, Math.round(t * 1000) + " ms"); wet(echo, "feedback", 0.4, "-9 dB"); wet(echo, "mix proportion", 1, "100%");
    return [{ id: "returnA", name: "A Space", volume: 0, muted: false, plugins: [wet(make("Space"), "mix", 1, "100%")] },
            { id: "returnB", name: "B Echo", volume: 0, muted: false, plugins: [echo] }];
  };

  const S = {
    session: "Ruski", sessionPath: "", bpm: 130, loopStart: 16 * bar, loopEnd: 24 * bar, click: false,
    // The master: every lane plays through its effects, then its fader, then the safety limiter.
    master: { volume: 0, plugins: [] },
    returns: freshReturns(130),
    canUndo: false, canRedo: false, hasInput: true, countIn: 1,
    canAutomate: true, // automation lanes (addAutomation / setAutomation / removeAutomation / showAutomation)
    canArrangeTools: true, // setClipActive / reverseClip / consolidateClips / insertTime / deleteTime (ui/arrange.js)
    canConvert: true, // convertToMidi { clipId, mode: notes | synth | melody | drums | slice }, changeMode { clipId, to: major | minor } (right-click an audio clip)
    canRecreate: true, // recreateSounds { clipId }: split into stems, drums to KILLDRUM, the rest to TOY MACHINEs, one compound
    key: { name: "D#m", relative: "F#", confidence: 0.6, tonic: 3, minor: true, bpmFound: 130 },
    look: { look: null, backgrounds: [] },
    jobs: [], ai: { installed: false, installing: false, aceStepUrl: "http://127.0.0.1:8001" },
    versions: [{ number: 1, current: false }, { number: 2, current: false }, { number: 3, current: true }],
    sessions: ["Ruski", "Late night idea", "Session 1"],
    projects: [
      { name: "Ruski", about: "The test song: your beat and vocal.", versions: 3, lanes: 5, bpm: 130, key: "D#m", length: 214, worked: new Date(Date.now() - 120000).toISOString(), image: "bg/KT_UP_04.jpg", tag: "3 versions" },
      { name: "Late night idea", about: "A loop and a few adlibs.", versions: 1, lanes: 2, bpm: 92, key: "Fm", length: 96, worked: new Date(Date.now() - 8 * 3600000).toISOString(), image: "bg/KT_UP_05.jpg" },
      { name: "Session 1", about: "", versions: 1, lanes: 4, bpm: 120, key: "", length: 0, worked: new Date(Date.now() - 3 * 86400000).toISOString(), image: "bg/KT_UP_11.jpg" },
    ],
    sections: [],
    pluginCount: 3, scanningPlugins: false,
    tracks: [
      { id: "t0", name: "Beat", kind: "beat", role: "beat", armed: false, muted: false, solo: false, clips: [{ id: "c0", name: "Ruski_130bpm_D#m", start: 0, length: 44 * bar, offset: 0, take: 0, takes: 0, plugins: [] }] },
      { id: "t1", name: "Lead Vox", kind: "take", role: "lead", armed: true, muted: false, solo: false, clips: [
        { id: "c1", name: "Lead v1 take 4", start: 8 * bar, length: 8 * bar, offset: 0, take: 0, takes: 0, plugins: [make("DeEss"), make("Compressor"), make("EQ")] },
        { id: "c2", name: "Lead hook", start: 16 * bar, length: 8 * bar, offset: 0, take: 2, takes: 4, plugins: [make("EQ"), make("Compressor"), make("Delay"), make("Reverb")] },
        { id: "c3", name: "Lead v2 comp", start: 24.5 * bar, length: 7 * bar, offset: 0, take: 0, takes: 0, plugins: [] }] },
      { id: "t2", name: "Double", kind: "take", role: "double", armed: false, muted: false, solo: false, clips: [
        { id: "c4", name: "Dbl wide", start: 16 * bar, length: 8 * bar, offset: 0, take: 0, takes: 0, plugins: [] },
        { id: "c5", name: "Dbl v2", start: 32 * bar, length: 6 * bar, offset: 0, take: 0, takes: 0, plugins: [] }] },
      { id: "t3", name: "Adlibs", kind: "take", role: "adlib", armed: false, muted: false, solo: false, clips: [
        { id: "c6", name: "Yeah", start: 14.5 * bar, length: 1.5 * bar, offset: 0, take: 0, takes: 0, plugins: [make("Drive"), make("Delay")] },
        { id: "c7", name: "Adlib runs", start: 21 * bar, length: 2.5 * bar, offset: 0, take: 0, takes: 0, plugins: [] },
        { id: "c8", name: "Hey", start: 37 * bar, length: 1.5 * bar, offset: 0, take: 0, takes: 0, plugins: [] }] },
      { id: "t4", name: "Harmony", kind: "take", role: "harmony", armed: false, muted: false, solo: false, clips: [
        { id: "c9", name: "Harm triad", start: 16 * bar, length: 8 * bar, offset: 0, take: 0, takes: 0, plugins: [] }] },
      { id: "t5", name: "FX Vox", kind: "take", role: "fx", armed: false, muted: false, solo: false, clips: [
        { id: "c10", name: "Riser", start: 14 * bar, length: 2 * bar, offset: 0, take: 0, takes: 0, plugins: [] }] },
      { id: "t6", name: "4OSC Synth", kind: "inst", role: "inst", instrument: "4OSC Synth", armed: false, muted: false, solo: false, clips: [
        { id: "c11", name: "MIDI", kind: "midi", start: 16 * bar, length: 4 * bar, beats: 16, offset: 0, take: 0, takes: 0,
          notes: [[63, 0, 1.5], [66, 1.5, 0.5], [70, 2, 2], [68, 4, 1.5], [66, 5.5, 0.5], [63, 6, 2], [61, 8, 3], [63, 11, 1], [66, 12, 4]]
            .map(([pitch, start, length]) => ({ pitch, start, length, velocity: 100 })),
          plugins: [{ id: "p-osc", name: "4OSC Synth", type: "4osc", enabled: true, instrument: true, params: [] }] }] },
    ],
    chains: [
      { name: "Throw", plugins: "Drive \u2192 Delay", uses: 12 },
      { name: "Dirty Throw", plugins: "Density \u2192 Tape Delay", uses: 4 },
      { name: "Big Verb", plugins: "Low/High Pass \u2192 Reverb", uses: 2 },
      { name: "Clean Vocal", plugins: "DeEss \u2192 Compressor \u2192 EQ", uses: 7 },
    ],
    transport: { position: 18.2 * bar, playing: false, recording: false, looping: false, input: -100 },
  };
  const withEnds = () => {
    const out = JSON.parse(JSON.stringify(S));
    if (out.returns) out.tracks.forEach((t) => (t.sends = { A: 0, B: 0, ...t.sends }));
    const songEnd = Math.max(44 * bar, ...S.tracks.flatMap((t) => t.clips.map((c) => c.start + c.length)));   // the last section runs to the song's end
    // a part with its own length (len, KILLTOY 2: moved parts keep their size) ends there, never past the next one
    out.sections = S.sections.map((x, i) => { const nx = i + 1 < S.sections.length ? S.sections[i + 1].start : Math.max(songEnd, x.start + bar);
      return { ...x, end: x.len > 0 ? Math.min(nx, x.start + x.len) : nx }; });
    return out;
  };
  const plugins = ["Compressor", "EQ", "Delay", "Reverb", "Drive", "Density", "Tape Delay", "DeEss", "Auto-Tune Pro", "Soundtoys EchoBoy", "FabFilter Pro-Q 3"]
    .map((n, i) => ({ key: "k" + i, name: n, group: i > 7 ? "Third-party" : "Built-in" }))
    .concat([{ key: "builtin:purpgate", name: "Vocal Gate", group: "Built-in" },
             ...["TUNR", ...(window.KT2_TOYTUNE_OFF || !window.ToyTuneUI ? [] : ["TOYTUNE"]), ...(window.KT2_TOYVOX_OFF || !window.ToyVoxUI ? [] : ["TOY VOX"]), "Pump", "Chop Pitch", "Space", "Crush", "Loud", "SC Clip", "Texture", "Squash", "Punch", "Make Room", ...(window.KT2_KILLCHAIN_OFF || !window.KillChain ? [] : ["KILLCHAIN"])].map((n) => ({ key: "builtin:" + TYPES[n], name: n, group: "KILLTOY" })),
             ...(window.KT2CoreFx ? KT2CoreFx.pluginList() : []),
             { key: "builtin:4osc", name: "4OSC Synth", group: "Tracktion", instrument: true },
             { key: "k-serum", name: "Serum", group: "Xfer Records", instrument: true }]);
  const clipById = (cid) => S.tracks.flatMap((t) => t.clips).find((c) => c.id === cid);
  const allPlugins = () => [...S.master.plugins, ...(S.returns || []).flatMap((r) => r.plugins), ...S.tracks.flatMap((t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)])];
  // Effects go on a clip ({ clipId }), on a whole lane ({ trackId }), or on the master ({ trackId: "master" }).
  const fxHost = ({ clipId, trackId }) => {
    if (!trackId) return clipById(clipId);
    if (trackId === "master") return S.master;
    if (/^return/.test(trackId)) return (S.returns || []).find((r) => r.id === trackId);
    const t = S.tracks.find((x) => x.id === trackId);
    if (t.kind === "inst" && !(t.plugins && t.plugins.length) && t.clips[0]) return t.clips[0];
    t.plugins = t.plugins || [];
    return t;
  };
  const changed = () => { S.canUndo = true; emit("state", withEnds()); };
  const autoHost = (trackId) => (trackId === "master" ? S.master : S.tracks.find((x) => x.id === trackId));
  // KILLTOY 2: lines shown under a pattern (lane.clips) also show under its copies and cut halves, and a
  // line whose last pattern is deleted goes with it (it kept playing, hidden). KT2_AL_LINK_OFF = old.
  const autoLinkClip = (t, fromId, newId) => {
    if (window.KT2_AL_LINK_OFF) return;
    for (const h of [t, ...S.tracks.filter((x) => x.layerOf === t.id)]) for (const l of h.automation || []) if (l.clips && l.clips.includes(fromId) && !l.clips.includes(newId)) l.clips.push(newId);
  };
  const autoUnlinkClips = (ids) => {
    if (window.KT2_AL_LINK_OFF) return;
    for (const h of S.tracks) {
      if (!h.automation) continue;
      h.automation = h.automation.filter((l) => {
        if (!l.clips || !l.clips.some((x) => ids.includes(x))) return true;
        l.clips = l.clips.filter((x) => !ids.includes(x));
        return l.clips.length > 0;
      });
      if (h.autoFold) h.autoFold = h.autoFold.filter((x) => !ids.includes(x));
    }
  };
  let last = performance.now();

  setInterval(() => {
    const now = performance.now();
    if (pg && pg.tick) { pg.tick(S.transport); last = now; emit("transport", { ...S.transport }); return; }
    if (S.transport.playing) {
      S.transport.position += (now - last) / 1000;
      if (S.transport.looping && S.transport.position > S.loopEnd) S.transport.position = S.loopStart;
    }
    S.transport.input = S.transport.recording || S.transport.playing ? -30 + 22 * Math.abs(Math.sin(now / 180)) * Math.random() : -100;
    // Pretend SC Clip readings, so its card picture moves in the plain browser preview too.
    S.transport.fx = {};
    for (const p of allPlugins())
      if (p.type === "ktscclip") S.transport.fx[p.id] = S.transport.playing && p.enabled ? Math.max(0, (p.params[0].value * 24 - 2) * Math.abs(Math.sin(now / 240)) * Math.random()) : 0;
    // The master's output level and how hard the safety limiter is working ({ peak, gr } in dB).
    S.transport.master = { peak: S.transport.playing ? S.transport.input + 4 + (S.master.volume || 0) : -100, gr: 0 };
    last = now;
    emit("transport", { ...S.transport });
  }, 33);

  // Pretend background jobs: progress for a few seconds, then apply the result.
  const startJob = (label, seconds, done) => {
    const job = { id: id(), label, stage: "Working", progress: 0, finished: false, failed: false, message: "" };
    S.jobs.push(job);
    const t0 = performance.now();
    const tick = setInterval(() => {
      job.progress = Math.min(1, (performance.now() - t0) / (seconds * 1000));
      if (job.progress >= 1) {
        clearInterval(tick);
        job.finished = true;
        job.message = done() || "Done";
        setTimeout(() => { S.jobs = S.jobs.filter((j) => j !== job); changed(); }, 6000);
      }
      changed();
    }, 200);
    changed();
    return { ok: true, jobId: job.id };
  };
  const replaceClip = (clipId, tag) => {
    for (const t of S.tracks) {
      const i = t.clips.findIndex((c) => c.id === clipId);
      if (i >= 0) t.clips[i] = { ...t.clips[i], id: id(), name: t.clips[i].name.replace(/ \(.*\)$/, "") + ` (${tag})` };
    }
  };

  const handlers = {
    getState: () => withEnds(),
    analyzeBeat: () => startJob("Finding key + tempo", 1.5, () => "D#m (same notes as F#)"),
    trackPitch: ({ clipId }) => {
      const c = clipById(clipId);
      const notes = [], curve = [];
      const melody = [63, 63.4, 66, 65.7, 63, 61, 62.6, 63, 66.3, 68, 66, 63.2];
      let t = 0.2;
      melody.forEach((m, i) => { const len = 0.35 + (i % 3) * 0.2; notes.push({ start: t, end: t + len, midi: m }); t += len + 0.12; });
      for (let i = 0; i * 0.02 < c.length; i++) {
        const sec = i * 0.02, n = notes.find((x) => sec >= x.start && sec < x.end);
        curve.push(n ? n.midi + 0.25 * Math.sin(sec * 33) : 0);
      }
      return { ok: true, clipId, notes, curve, curveStep: 0.02, key: S.key };
    },
    tune: ({ clipId }) => startJob("Tune " + clipById(clipId).name, 2, () => { replaceClip(clipId, "tuned"); return "Tuned the notes"; }),
    align: ({ clipId }) => startJob("Align " + clipById(clipId).name, 2.5, () => { replaceClip(clipId, "aligned"); return "Lined up (moved words by up to 64 ms)"; }),
    cleanVocal: ({ clipId }) => startJob("Clean " + clipById(clipId).name, 2, () => { replaceClip(clipId, "clean"); return "Cleaned up the noise"; }),
    splitStems: ({ clipId }) => startJob("Split stems: " + clipById(clipId).name, 4, () => {
      for (const n of ["Vocals", "Drums", "Bass", "Music"])
        S.tracks.push({ id: id(), name: n + " stem", kind: "take", role: "stem", armed: false, muted: true, solo: false,
          clips: [{ id: id(), name: n, start: 0, length: 44 * bar, offset: 0, take: 0, takes: 0, plugins: [] }] });
      return "Split into 4 stems (muted, solo one to hear it)";
    }),
    sendToAI: ({ clipId, prompt }) => {
      if (!prompt || !prompt.trim()) return { error: "Describe what the AI should make, like \"airy female harmony, R&B\"." };
      const c = clipById(clipId);
      return startJob("Send to AI: " + c.name, 4, () => {
        S.tracks.push({ id: id(), name: "AI " + c.name, kind: "take", role: "fx", armed: false, muted: false, solo: false,
          clips: [{ id: id(), name: "AI cover", start: c.start, length: c.length, offset: 0, take: 0, takes: 0, plugins: [] }] });
        return "AI result added on its own lane";
      });
    },
    aiStatus: () => S.ai,
    installVoiceTools: () => { S.ai.voiceInstalling = true; return startJob("Installing the voice changer", 5, () => { S.ai = { ...S.ai, voiceInstalled: true, voiceInstalling: false }; return "Voice changer ready"; }); },
    installAiTools: () => { S.ai.installing = true; return startJob("Installing AI tools", 5, () => { S.ai = { ...S.ai, installed: true, installing: false, details: { device: "mps" } }; return "AI tools ready (mps)"; }); },
    setAiSettings: ({ aceStepUrl }) => { if (aceStepUrl) S.ai.aceStepUrl = aceStepUrl; changed(); },
    setCountIn: ({ bars }) => { S.countIn = bars; changed(); },
    recordDouble: ({ start, role }) => {
      const r = ROLES.find((x) => x.id === role) || ROLES[1];
      S.tracks.forEach((t) => (t.armed = false));
      S.tracks.push({ id: id(), name: r.name + " 2", kind: "take", role: r.id, armed: true, muted: false, solo: false, clips: [] });
      S.transport.position = start; S.transport.recording = true; S.transport.playing = true; S.transport.looping = true;
      changed(); return { ok: true };
    },
    exportMix: () => ({ ok: true, file: "Ruski mix.wav" }),
    getPeaks: ({ clipId, buckets }) => {
      // Fake but audio-like: words and breaths with fast jitter, so detail shows.
      let seed = [...clipId].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 7919;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const beat = clipId === "c0";
      const min = [], max = [], peak = [], rms = [];
      for (let i = 0; i < buckets; i++) {
        const t = i / buckets;
        const words = beat ? 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(t * 176 * Math.PI)), 6)
                           : Math.max(0, Math.sin(t * 38 + (seed % 7))) * (0.5 + 0.5 * Math.abs(Math.sin(t * 9)));
        const env = Math.min(1, words * (0.55 + 0.45 * rnd()) + 0.015);
        const hi = env * (0.6 + 0.4 * rnd()), lo = -env * (0.6 + 0.4 * rnd());
        max.push(hi); min.push(lo); peak.push(Math.max(hi, -lo)); rms.push(env * 0.42);
      }
      return { peak, rms, min, max };
    },
    getAudioSetup: () => ({ ...AUDIO, latencyMs: 1000 * AUDIO.bufferSize / AUDIO.sampleRate }),
    setAudioSetup: (change) => { Object.assign(AUDIO, change); return handlers.getAudioSetup(); },
    setLook: ({ look }) => { S.look.look = look; changed(); },
    pickBackground: () => ({ ok: true }),
    removeBackground: () => ({ ok: true }),
    revealChains: () => ({ ok: true }),
    audioSettings: () => ({ ok: true }),
    // FL Studio-style, like the app: stop goes back to where play started.
    togglePlay: () => {
      if (S.transport.playing) { S.transport.position = S.playStart || 0; } else { S.playStart = S.transport.position; }
      S.transport.playing = !S.transport.playing; S.transport.recording = false;
    },
    stop: () => {
      const target = !S.transport.playing && S.transport.position === S.playStart ? 0 : (S.playStart || 0);
      S.transport.playing = false; S.transport.recording = false; S.transport.position = target; S.playStart = target;
    },
    toggleRecord: () => {
      if (!S.transport.recording) S.playStart = S.transport.position; else S.transport.position = S.playStart || 0;
      S.transport.recording = !S.transport.recording; S.transport.playing = S.transport.recording;
    },
    setLooping: ({ on }) => { S.transport.looping = on; },
    previewTune: () => ({ ok: true }), // the browser preview has no audio; the playground hears it
    setLoopRange: ({ start, end }) => { S.loopStart = start; S.loopEnd = end; S.transport.looping = true; if (!S.transport.playing) S.transport.position = start; changed(); },
    setPosition: ({ time }) => { S.transport.position = time; S.playStart = time; },
    autoSections: () => startJob("Finding the song sections", 1.5, () => {
      S.sections = [["INTRO", 0], ["VERSE 1", 4], ["HOOK", 20], ["VERSE 2", 28], ["OFFBEAT", 36], ["HOOK", 38], ["OUTRO", 46]]
        .map(([name, b]) => ({ name, start: b * bar }));
      return "Placed 7 sections (1 OFFBEAT gap kept separate so the rest lines up).";
    }),
    scanPlugins: () => { S.scanningPlugins = true; return startJob("Finding plugins", 3, () => { S.scanningPlugins = false; S.pluginCount = plugins.length; return `Found ${plugins.length} plugins (2 instruments).`; }); },
    managePlugins: () => ({ ok: true }),
    setWindowColour: () => ({ ok: true }),
    newInstrumentLane: ({ key }) => {
      const p = plugins.find((x) => x.key === key) || plugins.find((x) => x.instrument);
      S.tracks.forEach((t) => (t.armed = false));
      const t = { id: id(), name: p.name, kind: "inst", role: "inst", instrument: p.name, armed: true, muted: false, solo: false, clips: [] };
      S.tracks.push(t); changed(); return { ok: true, trackId: t.id };
    },
    setInstrument: ({ trackId, key }) => {
      const t = S.tracks.find((x) => x.id === trackId), p = plugins.find((x) => x.key === key);
      t.instrument = p.name; t.name = p.name;
      t.clips.forEach((c) => (c.plugins = [{ id: id(), name: p.name, type: "vst", enabled: true, instrument: true, params: [] }, ...c.plugins.filter((x) => !x.instrument)]));
      changed();
    },
    newMidiClip: ({ trackId, start, bars }) => {
      const t = S.tracks.find((x) => x.id === trackId);
      const c = { id: id(), name: "MIDI", kind: "midi", start, length: bars * 4 * 60 / (S.bpm || 130), beats: bars * 4, offset: 0, take: 0, takes: 0, notes: [],
                  plugins: [{ id: id(), name: t.instrument, type: "4osc", enabled: true, instrument: true, params: [] }] };
      t.clips.push(c); changed(); return { ok: true, clipId: c.id };
    },
    // a late save from a closed roll can name a clip that is gone (e.g. right after New project): skip it (sprint 8 Nov)
    setMidiNotes: ({ clipId, notes }) => { const c = clipById(clipId); if (!c) return { ok: false, error: "no such clip" }; c.notes = notes; changed(); },
    // Convert to MIDI: the preview has no audio, so a few made-up notes on a new lane under the clip
    convertToMidi: ({ clipId, mode }) => {
      const src = S.tracks.find((t) => t.clips.some((x) => x.id === clipId)), c = clipById(clipId);
      const drums = mode === "drums" || mode === "slice", name = drums ? "TOY DRUMS" : "TOY MACHINE", start = Math.floor(c.start / bar + 1e-6) * bar;
      const bars = Math.max(1, Math.ceil((c.start + c.length - start) / bar - 1e-6));
      const notes = Array.from({ length: bars * 8 }, (_, i) => drums
        ? { pitch: mode === "slice" ? 36 + (i % 16) : [36, 42, 38, 42][i % 4], start: i / 2, length: 0.25, velocity: 110 }
        : { pitch: [60, 62, 64, 67][i % 4], start: i / 2, length: 0.45, velocity: 100 });
      const t = { id: id(), name: src.name + (drums ? (mode === "slice" ? " slices" : " drums") : mode === "melody" ? " melody" : " MIDI"), kind: "inst", role: "inst", instrument: name, armed: false, muted: false, solo: false,
                  clips: [{ id: id(), name: "MIDI", kind: "midi", start, length: bars * bar, beats: bars * 4, offset: 0, take: 0, takes: 0, notes,
                            plugins: [{ id: id(), name, type: "4osc", enabled: true, instrument: true, params: [] }] }] };
      S.tracks.splice(S.tracks.indexOf(src) + 1, 0, t); changed();
      return { ok: true, trackId: t.id, notes: notes.length, detail: drums ? "kicks, snares, hats" : "" };
    },
    // RECREATE THE SOUNDS needs real audio and the stem splitter (the playground engine has both)
    recreateSounds: () => ({ error: "Recreating needs the song's audio. Try it on the playground page." }),
    changeMode: () => ({ error: "Make it major needs real audio: try it in the playground or the app." }),
    setClipLength: ({ clipId, beats }) => { const c = clipById(clipId); c.beats = beats; c.length = beats * 60 / (S.bpm || 130); changed(); },
    // MIDI clips are counted in beats, so they follow the tempo (where they start and how long
    // they are); audio clips stay where they are.
    setBpm: ({ bpm }) => {
      const k = S.bpm / bpm;
      for (const t of S.tracks) for (const c of t.clips) if (c.kind === "midi") { c.start *= k; c.length = c.beats ? c.beats * 60 / bpm : c.length * k; }
      S.bpm = bpm; changed();
    },
    // The song's key, picked by hand (a new project has no beat to hear it from).
    // scale (optional): an Advanced scale from the key picker, e.g. "dorian" (name then reads "A Dorian")
    setKey: ({ tonic, minor, scale, scaleName }) => {
      const N = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const adv = scale && scale !== "minor" && scale !== "major";
      S.key = tonic == null ? { name: "", relative: "", confidence: 0, tonic: null, minor: false }
        : { name: N[tonic] + (adv ? " " + (scaleName || scale) : minor ? "m" : ""), relative: adv ? "" : minor ? N[(tonic + 3) % 12] : N[(tonic + 9) % 12] + "m", confidence: 1, tonic, minor: !!minor, bpmFound: S.bpm, byHand: true, ...(adv ? { scale } : {}) };
      changed(); return { ok: true, key: S.key.name };
    },
    toggleClick: () => { S.click = !S.click; changed(); },
    listPlugins: () => plugins,
    armTrack: ({ trackId }) => { // clicking the armed lane again disarms it, so no lane records
      const wasOn = S.tracks.some((t) => t.id === trackId && t.armed);
      S.tracks.forEach((t) => (t.armed = !wasOn && t.id === trackId)); changed(); },
    toggleMute: ({ trackId }) => { const t = S.tracks.find((x) => x.id === trackId); t.muted = !t.muted; changed(); },
    toggleSolo: ({ trackId }) => { const t = S.tracks.find((x) => x.id === trackId); t.solo = !t.solo; changed(); },
    setTrackColor: ({ trackId, color }) => { const t = S.tracks.find((x) => x.id === trackId); if (t) { t.color = color || undefined; changed(); } return { ok: !!t }; },
    setTrackRole: ({ trackId, role }) => { const t = S.tracks.find((x) => x.id === trackId); t.role = role; t.name = ROLES.find((r) => r.id === role).name; changed(); },
    renameSession: ({ name }) => { S.session = name; S.sessions = [name, ...(S.sessions || []).filter((x) => x !== name)]; changed(); return { ok: true }; },
    renameTrack: ({ trackId, name }) => { S.tracks.find((x) => x.id === trackId).name = name; changed(); },
    newTakeLane: ({ role: want } = {}) => { // like the app: { role } picks it, else the first role not used yet
      const used = S.tracks.map((t) => t.role);
      const role = ROLES.find((r) => r.id === want) || ROLES.find((r) => !used.includes(r.id)) || ROLES[1];
      S.tracks.forEach((t) => (t.armed = false));
      // KILLTOY 2 (Eman, 31 Oct): the first voice is just "VOX"
      const k2vox = document.documentElement.classList.contains("kt2") && role.id === "lead";
      const t = { id: id(), name: k2vox ? "VOX" : role.name, kind: "take", role: role.id, armed: true, muted: false, solo: false, clips: [] };
      S.tracks.push(t);
      changed();
      return { ok: true, trackId: t.id };
    },
    deleteTrack: ({ trackId }) => {
      S.tracks = S.tracks.filter((t) => t.id !== trackId);
      // Effects that listened to that lane let go of it (stress test 11 Nov: a Pump / KEY card keyed to a deleted lane
      // kept waiting for it and its own lane went silent; KILLCHAIN kept a dead input). KT2_KEY_DELLANE_OLD = old.
      if (!window.KT2_KEY_DELLANE_OLD) for (const p of allPlugins()) {
        if (p.sidechain === trackId) p.sidechain = "";
        if (p.side && Array.isArray(p.side.src) && p.side.src.some((x) => x && x.t === trackId)) p.side = { ...p.side, src: p.side.src.filter((x) => x && x.t !== trackId) };
      }
      changed();
    },
    setSections: ({ sections }) => { S.sections = sections.map((x) => ({ name: x.name.toUpperCase(), start: x.start, ...(x.len > 0 ? { len: x.len } : {}), ...(x.color ? { color: x.color } : {}) })); changed(); },
    newVersion: () => { S.versions.forEach((v) => (v.current = false)); S.versions.push({ number: S.versions.length + 1, current: true }); changed(); return { ok: true, version: S.versions.length }; },
    openVersion: ({ index }) => { S.versions.forEach((v, i) => (v.current = i === index)); changed(); },
    openSession: ({ name }) => { S.session = name; changed(); },
    previewProject: () => ({ ok: true, duration: 20 }), // the playground plays real audio here
    setClipTake: ({ clipId, index }) => { const c = clipById(clipId); c.take = index; c.comp = null; changed(); },
    setClipComp: ({ clipId, comp }) => { clipById(clipId).comp = comp; changed(); return { ok: true }; },
    flattenComp: ({ clipId }) => { const c = clipById(clipId); c.comp = null; c.takes = 0; c.take = 0; c.name = c.name.replace(/ \(.*\)$/, "") + " (comp)"; changed(); return { ok: true }; },
    // Variations (variations.js): a pretend render that lands as another take, the default unchanged.
    makeVariation: ({ clipId, plan }) => {
      const c = clipById(clipId), label = (plan && plan.label) || "Variation";
      const job = { id: id(), kind: "variation", clipId, label: "Variation: " + label, varLabel: label, stage: "Rendering", progress: 0, finished: false, failed: false, message: "" };
      S.jobs.push(job);
      const t0 = performance.now();
      const tick = setInterval(() => {
        job.progress = Math.min(1, (performance.now() - t0) / 3000);
        if (job.progress >= 1) {
          clearInterval(tick);
          if (!c.takeInfo) c.takeInfo = Array.from({ length: Math.max(1, c.takes) }, (_, i) => ({ name: i ? `Take ${i + 1}` : "Original" }));
          c.takeInfo.push({ name: label, why: (plan && plan.why) || "", check: { lagMs: 0, onTime: true } });
          c.takes = c.takeInfo.length;
          job.finished = true; job.message = label + " is ready";
          setTimeout(() => { S.jobs = S.jobs.filter((j) => j !== job); changed(); }, 4000);
        }
        changed();
      }, 150);
      return { ok: true, jobId: job.id };
    },
    auditionTake: ({ clipId, take }) => { const c = clipById(clipId); c.audition = take == null || take === c.take ? null : take; changed(); return { ok: true }; },
    removeUnusedTakes: ({ clipId }) => {
      const c = clipById(clipId);
      if (c.takeInfo) c.takeInfo = [c.takeInfo[c.take]];
      c.takes = 0; c.take = 0; c.comp = null; c.audition = null; changed(); return { ok: true };
    },
    applyChain: (args) => {
      const ch = S.chains.find((c) => c.name === args.name);
      if (!ch) return { error: `There's no preset called "${args.name}".` };
      // A saved preset keeps every knob (and Pump's "Ducks to" lane); the built-in ones are just names.
      fxHost(args).plugins = ch.saved ? ch.saved.map((sv) => {
        const p = make(sv.name);
        for (const q of p.params || []) { const v = sv.params.find((x) => x.id === q.id); if (v) Object.assign(q, v); }
        if (sv.sidechain) p.sidechain = sv.sidechain;
        if (sv.enabled === false) p.enabled = false;
        return p;
      }) : ch.plugins.split(" \u2192 ").map(make);
      ch.uses++; changed(); return { ok: true };
    },
    addPlugin: (args) => {
      const host = fxHost(args), entry = plugins.find((p) => p.key === args.key);
      if (!entry) return { error: "That effect isn't here." };
      if (fxLimit5() && !entry.instrument && host.plugins.filter((p) => !p.instrument).length >= 5) return { error: "That's 5 effects already. Remove one first." };
      host.plugins.push(make(entry.name)); changed(); return { ok: true };
    },
    // Drag a card to a new place in the chain: index = its place among the effects (instruments stay first).
    movePlugin: ({ pluginId, index }) => {
      for (const list of [S.master.plugins, ...(S.returns || []).map((r) => r.plugins), ...S.tracks.flatMap((t) => [t.plugins || [], ...t.clips.map((c) => c.plugins)])]) {
        const from = list.findIndex((p) => p.id === pluginId);
        if (from < 0) continue;
        if (list[from].instrument) return { error: "The instrument stays first." };
        const [p] = list.splice(from, 1);
        const fx = list.filter((x) => !x.instrument), at = Math.max(0, Math.min(fx.length, Math.round(index)));
        list.splice(at < fx.length ? list.indexOf(fx[at]) : list.length, 0, p);
        changed(); return { ok: true };
      }
      return { error: "That effect isn't there any more." };
    },
    removePlugin: ({ pluginId }) => {
      S.master.plugins = S.master.plugins.filter((p) => p.id !== pluginId);
      (S.returns || []).forEach((r) => (r.plugins = r.plugins.filter((p) => p.id !== pluginId)));
      S.tracks.forEach((t) => {
        if (t.plugins) t.plugins = t.plugins.filter((p) => p.id !== pluginId);
        t.clips.forEach((c) => (c.plugins = c.plugins.filter((p) => p.id !== pluginId)));
      });
      changed();
    },
    togglePlugin: ({ pluginId }) => { allPlugins().forEach((p) => { if (p.id === pluginId) p.enabled = !p.enabled; }); changed(); },
    // KILLCHAIN's input: { pluginId, src: [{ t: trackId, c: [clipIds] | null }], name? } or { pluginId, use: name }
    setSideInput: (args) => { if (!window.KillChain) return { error: "KILLCHAIN isn't here." }; const r = KillChain.setInput(S, args); if (r.ok) changed(); return r; },
    setSideGhost: (args) => { if (!window.KillChain || !KillChain.setGhost) return { error: "KILLCHAIN isn't here." }; const r = KillChain.setGhost(S, args); if (r.ok) changed(); return r; },
    // Pump's sidechain: the lane it ducks to ("" = the tempo). A lane can't duck to itself.
    setMacros: (args) => {   // a host's RACK macros (ui: rackCard / macroItems)
      const host = fxHost(args);
      if (!host) return { error: "Nothing to put a rack on." };
      const ids = new Set(host.plugins.map((p) => p.id));
      host.macros = (Array.isArray(args.macros) ? args.macros : []).slice(0, 4).map((m, i) => ({ id: String(m.id || "m" + i), name: String(m.name || "MACRO " + (i + 1)).slice(0, 16),
        value: Math.max(0, Math.min(1, Number(m.value) || 0)), maps: (m.maps || []).filter((x) => ids.has(x.pluginId)).map((x) => ({ pluginId: x.pluginId, paramId: String(x.paramId), lo: Math.max(0, Math.min(1, Number(x.lo) || 0)), hi: Math.max(0, Math.min(1, x.hi == null ? 1 : Number(x.hi))) })) }));
      changed(); return { ok: true };
    },
    setSidechainAmount: ({ pluginId, amount }) => {   // how far a keyed effect fades (sidechain on any effect)
      const p = allPlugins().find((x) => x.id === pluginId);
      if (!p) return { error: "Effect not found." };
      p.scAmt = Math.max(0, Math.min(1, Number(amount) || 0)); changed(); return { ok: true };
    },
    setSidechain: ({ pluginId, trackId }) => {
      const t = S.tracks.find((x) => (x.plugins || []).some((p) => p.id === pluginId) || x.clips.some((c) => c.plugins.some((p) => p.id === pluginId)));
      const p = allPlugins().find((x) => x.id === pluginId);
      if (!p || (p.type !== "ktpump" && !(keyAnyOn(p) || p.type === "ktroom"))) return { error: "Only Pump can follow another lane." };
      if (trackId && !S.tracks.some((x) => x.id === trackId)) return { error: "Lane not found." };
      if (trackId && t && t.id === trackId) return { error: "Pick another lane: a lane can't duck to itself." };
      p.sidechain = trackId || "";
      changed();
    },
    bypassAll: (args) => { const c = fxHost(args); const anyOn = c.plugins.some((p) => p.enabled); c.plugins.forEach((p) => (p.enabled = !anyOn)); changed(); },
    setParam: ({ pluginId, paramId, value }) => {
      const p = allPlugins().find((x) => x.id === pluginId);
      const prmObj = p && p.params.find((x) => x.id === paramId);
      if (!prmObj) return { error: "Unknown knob." };
      prmObj.value = value;
      const own = window.KillToyFx && window.KillToyFx.TYPES[p.type];
      const q = own && own.params.find((x) => x.id === paramId);
      prmObj.text = q ? window.KillToyFx.text(q, window.KillToyFx.fromKnob(q, value))
        : p.type === "ktsnaptune" && paramId === "key" ? TUNE_KEYS[Math.round(value * 11)]
        : p.type === "ktsnaptune" && paramId === "scale" ? TUNE_SCALES[Math.round(value * 2)]
        : paramId === "purp:delayTime" ? Math.round(value * 1500) + " ms" : Math.round(value * 100) + "%";
      changed();
      return { ok: true, text: prmObj.text };
    },
    clearEffects: (args) => { fxHost(args).plugins = []; changed(); },
    splitClip: ({ clipId, time }) => {
      for (const t of S.tracks) {
        const i = t.clips.findIndex((c) => c.id === clipId);
        if (i < 0) continue;
        const c = t.clips[i];
        if (time <= c.start || time >= c.start + c.length) return { error: "Put the playhead inside the clip to cut it." };
        const cut = time - c.start, len = c.length;
        const right = { ...c, id: id(), start: time, length: len - cut, offset: c.offset + cut, plugins: c.plugins.map((p) => ({ ...p, id: id(), autoOf: p.autoOf || p.id })) };
        // each half keeps only its own outer fade, and a comp's pieces stay where they were heard
        right.fadeIn = 0; c.fadeOut = 0;
        if (Array.isArray(c.comp)) {
          right.comp = c.comp.filter((x) => x.end > cut).map((x) => ({ ...x, start: Math.max(0, x.start - cut), end: x.end - cut }));
          c.comp = c.comp.filter((x) => x.start < cut).map((x) => ({ ...x, end: Math.min(cut, x.end) }));
        }
        c.length = cut;
        t.clips.splice(i + 1, 0, right);
        autoLinkClip(t, c.id, right.id);
        // a cut is the same file: the right half keeps the left half's view (waveform peek on/off, automation
        // folded/open). Eman 8 Nov 23:10; KT2_CUT_VIEW_OLD = the right half opens fresh.
        if (!window.KT2_CUT_VIEW_OLD) {
          for (const h of [t, ...S.tracks.filter((x) => x.layerOf === t.id)]) if (h.autoFold && h.autoFold.includes(c.id) && !h.autoFold.includes(right.id)) h.autoFold.push(right.id);
          if (window.KT2Peek && KT2Peek.copy) KT2Peek.copy(c.id, right.id);
        }
      }
      changed(); return { ok: true };
    },
    deleteClip: ({ clipId, clipIds }) => {
      const ids = (clipIds || [clipId]).filter((x) => x !== "c0");
      if (!ids.length) return { error: "The beat stays. Load another one from the session menu." };
      S.tracks.forEach((t) => (t.clips = t.clips.filter((c) => !ids.includes(c.id))));
      autoUnlinkClips(ids);
      changed();
    },
    moveClips: ({ moves }) => {
      const segs = new Map(); // track -> what moved, so its automation goes along (KillToyAuto.carry)
      for (const m of moves) {
        const c = clipById(m.clipId), t = c && S.tracks.find((x) => x.clips.includes(c));
        if (!c || m.clipId === "c0") continue;
        if (!segs.has(t)) segs.set(t, []);
        segs.get(t).push({ from: c.start, to: m.start, len: c.length });
        c.start = m.start;
      }
      for (const [t, list] of segs) window.KillToyAuto.carry(t, list);
      changed();
    },
    // Copies go straight after each clip, on the same lane.
    duplicateClips: ({ clipIds }) => {
      const made = [], algNew = {};
      for (const t of S.tracks) {
        for (const c of [...t.clips]) {
          if (!clipIds.includes(c.id) || t.kind === "beat") continue;
          const copy = structuredClone(c);
          copy.id = id(); copy.start = c.start + c.length;
          if (copy.alg) copy.alg = algNew[c.alg] || (algNew[c.alg] = "g" + id());   // copies of a group are a group of their own
          copy.plugins.forEach((p) => { p.autoOf = p.autoOf || p.id; p.id = id(); });
          t.clips.push(copy); made.push(copy.id);
          autoLinkClip(t, c.id, copy.id);
          window.KillToyAuto.carry(t, [{ from: c.start, to: copy.start, len: c.length }], true);
        }
      }
      changed();
      return { ok: true, clipIds: made };
    },
    // KILLTOY 2 groups (Eman, 9 Nov 00:50): picked clips become one unit. They move together and their
    // automation shows as one long sheet over all of them (ui/kt2-autolane.js). c.alg = the group's id; a cut
    // half stays in its group. Each member gets every line of the group, so taking one out keeps its part.
    groupClips: ({ clipIds }) => {
      const cs = S.tracks.filter((t) => t.kind !== "beat").flatMap((t) => t.clips.filter((c) => clipIds.includes(c.id)).map((c) => ({ c, t })));
      if (cs.length < 2) return { error: "Pick two or more clips to group them." };
      const g = "g" + id();
      for (const { c } of cs) c.alg = g;
      for (const t of new Set(cs.map((x) => x.t))) {
        const mine = cs.filter((x) => x.t === t).map((x) => x.c.id);
        for (const h of [t, ...S.tracks.filter((x) => x.layerOf === t.id)]) for (const l of h.automation || []) {
          if (!l.clips || !l.clips.some((x) => mine.includes(x))) continue;
          for (const cid of mine) if (!l.clips.includes(cid)) l.clips.push(cid);
        }
        if (t.autoFold && mine.some((x) => t.autoFold.includes(x))) t.autoFold = [...new Set(t.autoFold.concat(mine))];
      }
      changed(); return { ok: true, group: g };
    },
    ungroupClips: ({ clipIds }) => {
      let n = 0;
      for (const t of S.tracks) for (const c of t.clips) if (clipIds.includes(c.id) && c.alg) { delete c.alg; n++; }
      changed(); return { ok: true, count: n };
    },
    renameClip: ({ clipId, name }) => { clipById(clipId).name = name; changed(); },
    setClipGain: ({ clipId, db }) => { clipById(clipId).gain = Math.max(-60, Math.min(12, db)); changed(); },
    setTrackVolume: ({ trackId, db }) => { (trackId === "master" ? S.master : /^return/.test(trackId) ? S.returns.find((r) => r.id === trackId) : S.tracks.find((x) => x.id === trackId)).volume = Math.max(-60, Math.min(6, Number.isFinite(+db) ? +db : 0)); changed(); },   // not-a-number never reaches the fader (stress test, 8 Nov)
    // The A/B returns: a lane's send (0..1, after its fader), a return's fader (dB) and mute.
    setSend: ({ trackId, send, amount }) => {
      const t = S.tracks.find((x) => x.id === trackId);
      if (!t || !(S.returns || []).some((r) => r.id === "return" + send)) return { error: "No such lane or return." };
      t.sends = { A: 0, B: 0, ...t.sends, [send]: Math.max(0, Math.min(1, Number(amount) || 0)) }; changed(); return { ok: true };
    },
    setReturnVolume: ({ id: rid, volume }) => {
      const r = (S.returns || []).find((x) => x.id === rid);
      if (!r) return { error: "No such return." };
      r.volume = Math.max(-60, Math.min(6, Number(volume) || 0)); changed(); return { ok: true };
    },
    toggleReturnMute: ({ id: rid }) => {
      const r = (S.returns || []).find((x) => x.id === rid);
      if (!r) return { error: "No such return." };
      r.muted = !r.muted; changed(); return { ok: true };
    },
    setClipFades: ({ clipId, fadeIn, fadeOut }) => { const c = clipById(clipId); c.fadeIn = Math.max(0, fadeIn); c.fadeOut = Math.max(0, fadeOut); changed(); },
    // Trim: moving the left edge moves where the clip starts reading its audio too.
    setClipBounds: ({ clipId, start, length }) => {
      const c = clipById(clipId);
      if (c.kind === "midi") {   // notes stay where they are in the song; the clip just shows more or less of the grid
        const spb = 60 / (S.bpm || 130), db = (Math.max(0, start) - c.start) / spb;
        const shift = (ns) => (ns || []).map((n) => ({ ...n, start: n.start - db })).filter((n) => n.start + n.length > 1e-6)
          .map((n) => (n.start < 0 ? { ...n, length: n.length + n.start, start: 0 } : n));
        c.notes = shift(c.notes);
        if (c.takeNotes) c.takeNotes = c.takeNotes.map(shift);
        c.start = Math.max(0, start); c.length = Math.max(0.05, length); c.beats = c.length / spb;
        changed(); return;
      }
      const d = Math.max(start - c.start, -c.offset);
      c.start += d; c.offset += d; c.length = Math.max(0.05, length);
      if (c.comp) c.comp = c.comp.map((x) => ({ ...x, start: Math.max(0, x.start - d), end: Math.min(c.length, x.end - d) })).filter((x) => x.end > x.start);
      c.fadeIn = Math.min(c.fadeIn || 0, c.length); c.fadeOut = Math.min(c.fadeOut || 0, c.length - c.fadeIn);
      changed();
    },
    moveClip: ({ clipId, start, trackId }) => {
      if (clipId === "c0") return { error: "The beat stays at bar 1." };
      const from = S.tracks.find((t) => t.clips.some((c) => c.id === clipId));
      const c = clipById(clipId);
      const to = S.tracks.find((t) => t.id === trackId);
      if (!to || to === from) window.KillToyAuto.carry(from, [{ from: c.start, to: start, len: c.length }]); // another lane's automation is its own
      c.start = start;
      if (to && to !== from) { from.clips = from.clips.filter((x) => x !== c); to.clips.push(c); }
      changed();
    },
    // Automation lanes (ui/automation.js has the format). One lane per thing that moves.
    // They live on a lane, or on the master (trackId "master").
    // clipId (KILLTOY 2): the pattern the line shows under (lane.clips, ui/kt2-autolane.js); the pattern's stack unfolds.
    addAutomation: ({ trackId, target, value, name, clipId }) => {
      const t = autoHost(trackId);
      if (!t) return { error: "That lane isn't there any more." };
      t.automation = t.automation || [];
      let lane = t.automation.find((l) => window.KillToyAuto.sameTarget(l.target, target) && window.KillToyAuto.fits(l, t));   // a parked line (other instrument) isn't this one
      if (!lane) {
        const v = Math.min(1, Math.max(0, value != null ? value : 0.5));
        lane = { id: id(), target, follow: true, points: [{ t: 0, v }], base: v, ...(name ? { name } : {}) };   // base: where its reset goes back to
        if (target.type === "synth" && t.instrument && !window.KT2_AL_INST_OLD) lane.inst = t.instrument;   // the instrument it belongs to (automation.js fits)
        t.automation.push(lane);
      }
      if (clipId != null) {
        lane.clips = lane.clips || [];
        if (!lane.clips.includes(clipId)) lane.clips.push(clipId);
        for (const h of [t, ...S.tracks.filter((x) => x.id === t.layerOf)]) if (h.autoFold) h.autoFold = h.autoFold.filter((x) => x !== clipId);
      }
      t.autoOpen = true;
      changed();
      return { ok: true, laneId: lane.id };
    },
    setAutomation: ({ trackId, laneId, points, follow, clips }) => {
      const t = autoHost(trackId), lane = t && (t.automation || []).find((l) => l.id === laneId);
      if (!lane) return { error: "That automation lane isn't there any more." };
      if (points) lane.points = window.KillToyAuto.clean(points);
      if (follow != null) lane.follow = !!follow;
      if (Array.isArray(clips)) lane.clips = clips.slice();
      changed();
      return { ok: true };
    },
    // A hand move recorded while the lane is armed and the song plays: written over that stretch
    // of the line (the lane is made if it isn't there yet). points: [{ t: seconds, v }].
    recordAutomation: ({ trackId, target, name, points, clipId }) => {
      const t = autoHost(trackId);
      if (!t || !points || !points.length) return { ok: false };
      t.automation = t.automation || [];
      let lane = t.automation.find((l) => window.KillToyAuto.sameTarget(l.target, target) && window.KillToyAuto.fits(l, t));   // a parked line (other instrument) isn't this one
      if (!lane) { lane = { id: id(), target, follow: true, points: [], ...(name ? { name } : {}) }; t.automation.push(lane); }
      if (clipId != null) { lane.clips = lane.clips || []; if (!lane.clips.includes(clipId)) lane.clips.push(clipId); }   // KILLTOY 2: shows under that pattern
      window.KillToyAuto.record(lane, points);
      t.autoOpen = true;
      changed();
      return { ok: true, laneId: lane.id };
    },
    // A control held by hand: its automation lets go of it until it's let go (the engine side).
    touchAutomation: () => ({ ok: true }),
    removeAutomation: ({ trackId, laneId }) => {
      const t = autoHost(trackId);
      if (!t) return { ok: false };
      t.automation = (t.automation || []).filter((l) => l.id !== laneId);
      changed();
      return { ok: true };
    },
    // KILLTOY 2: a pattern's automation stack folded into its count badge (t.autoFold = clip ids), or open again
    setAutoFold: ({ trackId, clipId, fold }) => {
      const t = autoHost(trackId);
      if (!t) return { ok: false };
      const f = (t.autoFold || []).filter((x) => x !== clipId);
      t.autoFold = fold ? f.concat([clipId]) : f;
      changed();
      return { ok: true };
    },
    showAutomation: ({ trackId, show }) => {
      const t = autoHost(trackId);
      if (t) { t.autoOpen = show == null ? !t.autoOpen : !!show; changed(); }
      return { ok: !!t };
    },
    saveChain: (args) => {
      const c = fxHost(args), name = args.name;
      if (!c.plugins.length) return { error: "There are no effects to save yet." };
      S.chains = S.chains.filter((x) => x.name !== name);
      S.chains.push({ name, plugins: c.plugins.map((p) => p.name).join(" \u2192 "), uses: 0,
        saved: c.plugins.map((p) => ({ name: p.name, enabled: p.enabled !== false, sidechain: p.sidechain,
          params: (p.params || []).map((q) => ({ id: q.id, value: q.value, ...(q.text != null ? { text: q.text } : {}) })) })) });
      changed(); return { ok: true };
    },
    deleteChain: ({ name }) => { S.chains = S.chains.filter((c) => c.name !== name); changed(); },
    exportTakes: () => ({ ok: true, files: S.tracks.length - 1 }),
    browseForBeat: () => ({ error: "In the app this opens a file picker." }),
    updateStatus: () => ({ ...U }),
    updateCheck: () => {
      Object.assign(U, { state: "checking", message: "Looking for a new KILLTOY\u2026" });
      setTimeout(() => {
        Object.assign(U, { state: "ready", latest: U.build + 1, progress: 1, message: `KILLTOY build ${U.build + 1} is ready.`,
          notes: "- Vocal Gate opens faster on quiet breaths\n- Align works on doubles too" });
        emit("update", { ...U });
      }, 900);
      return { ...U };
    },
    updateInstall: () => ({ ok: true }),
    updateSetKey: () => ({ ...U }),
    updateOpenKeyPage: () => ({ ok: true }),

    // Samples (the Splice folder). In the app the engine lists the folder; here the
    // browser hands over the files it was allowed to read.
    getSamples: () => ({ folder: SAMPLES.name, needsReconnect: SAMPLES.reconnect,
                         samples: [...SAMPLES.files].map(([sid, f]) => ({ id: sid, path: f.path })) }),
    setSampleFiles: ({ name, files, add, reconnect }) => {
      if (!add) { SAMPLES.files.clear(); SAMPLES.name = name; }
      SAMPLES.reconnect = !!reconnect;
      const added = (files || []).map((f) => { const sid = "s" + id(); SAMPLES.files.set(sid, f); return { id: sid, path: f.path }; });
      return { ok: true, samples: added };
    },
    // A Library sound (library.js) comes as a url instead of an id.
    previewSample: async ({ id: sid, url, rate }) => {
      const f = !url && SAMPLES.files.get(sid);
      if (!url && !f) return { error: "That sound isn't there any more. Connect the folder again." };
      handlers.stopPreview();
      const me = SAMPLES.token; // stopped (or another sound picked) while it loads: don't start it
      // A Library url may live inside a pack (PG_PACK), which only fetch() can read, so play it from a blob.
      const blob = url ? await fetch(url).then((r) => (r.ok ? r.blob() : null), () => null) : f.file || (await f.getFile());
      if (!blob) return { error: "Couldn't load that sound." };
      if (SAMPLES.token !== me) return { ok: true };
      const a = new Audio(URL.createObjectURL(blob));
      a.preservesPitch = true;
      a.playbackRate = Math.min(4, Math.max(0.25, rate || 1));
      a.onended = () => { if (SAMPLES.audio === a) { SAMPLES.audio = null; emit("previewEnded", {}); } };
      SAMPLES.audio = a;
      a.play().catch(() => {});
      return { ok: true };
    },
    // Piano roll note preview (the playground and the engine play it through the lane's instrument).
    previewNote: () => ({ ok: true }),
    previewNoteOff: () => ({ ok: true }),
    stopPreview: () => {
      SAMPLES.token = (SAMPLES.token || 0) + 1;
      const a = SAMPLES.audio;
      if (!a) return;
      a.pause();
      SAMPLES.audio = null;
      if (a.src.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(a.src), 3000); // after any load still in flight
    },
    addSample: ({ name, trackId, start, bpm: from, laneName, libType, recLane }) => {
      let t = trackId && S.tracks.find((x) => x.id === trackId);
      if (!t) { t = { id: id(), name: laneName || "Samples", kind: "take", role: "fx", armed: false, muted: false, solo: false, clips: [], ...(recLane ? { recLane: true } : {}) }; S.tracks.push(t); }
      if (libType && !t.libType) { t.libType = libType; if (!t.clips.length) t.sub = name; }
      const length = from ? 2 * bar : bar / 2; // the app reads the real length
      const c = { id: id(), name, src: "", start, length, offset: 0, take: 0, takes: 0, plugins: [] };
      t.clips.push(c);
      changed();
      return { ok: true, clipId: c.id, trackId: t.id, length };
    },
    // Change sample (the Library): every clip on the lane plays the new sound, same timing,
    // length and level. The playground (and the app) swap the real audio.
    swapSample: ({ trackId, name, type }) => {
      const t = S.tracks.find((x) => x.id === trackId);
      if (!t || t.kind !== "take") return { error: "Pick a drum lane to change its sound." };
      t.clips.forEach((c) => (c.name = name));
      t.libType = type || t.libType; t.sub = name;
      changed(); return { ok: true, hits: t.clips.length, trackId: t.id };
    },
  };
  const SAMPLES = { name: "", files: new Map(), reconnect: false, audio: null };
  const AUDIO = { types: ["CoreAudio"], type: "CoreAudio", inputs: ["Scarlett 2i2 USB", "MacBook Pro Microphone"],
                  outputs: ["Scarlett 2i2 USB", "MacBook Pro Speakers"], input: "Scarlett 2i2 USB", output: "Scarlett 2i2 USB",
                  mics: ["Input 1", "Input 2"], mic: "Input 1", sampleRate: 48000, sampleRates: [44100, 48000, 96000],
                  bufferSize: 256, bufferSizes: [32, 64, 128, 256, 512, 1024, 2048], running: true };
  const U = { build: 12, version: "0.2.0", state: "upToDate", message: "You have the newest KILLTOY (build 12).",
              latest: 0, notes: "", progress: 0, needsKey: false, hasKey: false };

  // The browser playground (playground/, see its README) plugs real audio in here.
  // In the app this never runs: the app uses the native bridge, not this demo.
  if (window.KillToyArrange) KillToyArrange.demo({ S, handlers, changed, id });
  if (window.KillToyCompound) KillToyCompound.demo({ S, handlers, changed, id });   // KILLTOY 2 compound clips (kt2-compound.js)
  if (window.KillToyRecord) KillToyRecord.demo({ S, handlers, changed, id });   // KILLTOY 2 RECORD page (kt2-record.js)
  if (window.KillToySections) KillToySections.demo({ S, handlers, changed, id });   // KILLTOY 2 song-part blocks (kt2-sections.js)
  if (window.KillToyLink) KillToyLink.demo({ S, handlers, changed, id });   // KILLTOY 2 linked sounds + versions (kt2-link.js)
  if (window.KillToyCompound && KillToyCompound.demo.shifts) KillToyCompound.demo.shifts();   // compound copies keep their start when a PART, time or tempo command slides them
  const pg = window.purpPlayground ? window.purpPlayground({ S, handlers, emit, changed, make, id, bar, freshReturns }) : null;
  if (window.KillToyArrange) KillToyArrange.afterPlayground({ S, handlers });

  const call = async (cmd, args = {}) => {
    const h = handlers[cmd];
    if (!h) return { error: `"${cmd}" only works inside the app.` };
    const r = window.KillToyLink ? KillToyLink.run(cmd, args, h) : h(args);   // linked sound copies stay the same (kt2-link.js)
    return r === undefined ? { ok: true } : r;
  };
  call.on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  return call;
}
