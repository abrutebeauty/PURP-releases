// KILLTOY Library: the drum hits and FX remade from Eman's songs (kicks, snares, claps, hats,
// perc, FX), in the same drawer as Samples. Click a row to hear it, Add puts one hit on a lane
// at the marker, and on a drum lane "Change sample..." swaps every hit on it for the sound
// picked (one undo step, the swapSample command).
// The sounds come from library/INDEX.json next to the page (made by another process, see
// playground/README.md): { version, generated, items: [{ id, name, song, artist, type, file,
// preview, duration_s, pitch_hz, note, bpm, key, tone: [], match: { score }, source }] }.
// Keep this file ASCII-only.
"use strict";

const lib = {
  open: false, loaded: false, loading: null, items: [], q: "", cat: "all", song: "",
  swapTrack: null, // lane id whose sound "Use" replaces
  addTrack: null,  // lane id that Add puts hits on (an empty drum lane's dot)
  playing: null, used: null,
};

const LIB_CATS = [
  ["all", "All"], ["kick", "Kicks"], ["snare", "Snares"], ["clap", "Claps"], ["hat", "Hats"], ["perc", "Perc"], ["fx", "FX"],
];
const LIB_GROUP = { kick: "kick", snare: "snare", clap: "clap", hat_closed: "hat", hat_open: "hat", perc: "perc", fx: "fx" };
const LIB_LANE = { kick: "Kick", snare: "Snare", clap: "Clap", hat_closed: "Hi-hat", hat_open: "Open hat", perc: "Perc", fx: "FX" };
const libGroup = (type) => LIB_GROUP[type] || "fx";

// What kind of drum a lane holds: what it was made from, else its name.
function libLaneType(t) {
  if (!t || t.kind !== "take") return null;
  if (t.libType) return libGroup(t.libType);
  const n = (t.name || "").toLowerCase();
  if (/\bkicks?\b|\bbd\b|\b808 kick/.test(n)) return "kick";
  if (/snare|\bsd\b|\brim/.test(n)) return "snare";
  if (/clap/.test(n)) return "clap";
  if (/hat|\bhh\b|cymbal|\bride\b/.test(n)) return "hat";
  if (/perc|shaker|\btom|conga|bongo|tamb|cowbell|\bsnap/.test(n)) return "perc";
  if (/\bfx\b|noise|riser|impact|sweep|crash|whoosh|uplifter|downlifter/.test(n)) return "fx";
  return null;
}

const libUrl = (s) => "library/" + (s.preview || s.file || "").split("/").map(encodeURIComponent).join("/");
const libShort = (s) => {
  const pre = s.song ? s.song + " - " : "";
  return pre && s.name.toLowerCase().startsWith(pre.toLowerCase()) ? s.name.slice(pre.length) : s.name;
};

function libLoad() {
  if (lib.loading) return lib.loading;
  lib.loading = fetch("library/INDEX.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .catch(() => ({ items: [] }))
    .then((j) => {
      lib.items = (Array.isArray(j && j.items) ? j.items : []).filter((s) => s && s.id && (s.preview || s.file));
      lib.items.sort((a, b) => (a.song || "").localeCompare(b.song || "") || libShort(a).localeCompare(libShort(b)));
      lib.loaded = true;
      renderLibrary();
      return lib.items;
    });
  return lib.loading;
}

// ---------------------------------------------------------------------------
// The panel
function toggleLibrary(on = !lib.open) {
  if (on && smp.open) toggleSamples(false);
  lib.open = on;
  document.body.classList.toggle("samples-open", on || smp.open);
  $("library").hidden = !on;
  $("tool-library").classList.toggle("on", on);
  if (!on) { libStop(); lib.swapTrack = null; lib.addTrack = null; }
  if (on) { libLoad(); renderLibrary(); }
}

// From a lane: its dot or "Change sample...". A lane with hits swaps them; an empty one gets Add.
function openLibraryForLane(t) {
  const type = libLaneType(t);
  if (smp.open) toggleSamples(false);
  lib.swapTrack = t.clips.length ? t.id : null;
  lib.addTrack = t.clips.length ? null : t.id;
  lib.cat = type || "all";
  lib.song = ""; lib.q = ""; lib.used = null;
  if (!lib.open) toggleLibrary(true); else renderLibrary();
}

function libVisible() {
  const words = lib.q.toLowerCase().split(/\s+/).filter(Boolean);
  return lib.items.filter((s) => (lib.cat === "all" || libGroup(s.type) === lib.cat)
    && (!lib.song || s.song === lib.song)
    && words.every((w) => [s.name, s.song, s.artist, s.type, (s.type || "").replace("_", " "), s.note, s.key, ...(s.tone || [])]
      .filter(Boolean).join(" ").toLowerCase().includes(w)));
}

function renderLibrary() {
  const box = $("library");
  if (!box || box.hidden) return;
  box.replaceChildren();
  const swapLane = lib.swapTrack && ui.state && ui.state.tracks.find((t) => t.id === lib.swapTrack);
  const addLane = lib.addTrack && ui.state && ui.state.tracks.find((t) => t.id === lib.addTrack);
  if (lib.swapTrack && !swapLane) lib.swapTrack = null;

  const head = el("div", "smp-head");
  head.append(el("div", "smp-title", "Library"));
  const close = el("button", "smp-x", "\u00d7");
  close.title = "Close (Y)";
  close.onclick = () => toggleLibrary(false);
  head.append(close);
  box.append(head);

  if (swapLane || addLane) {
    const bar = el("div", "lib-mode");
    bar.append(el("span", null, swapLane ? `Change the sound on ${swapLane.name}` : `Adding to ${addLane.name}`));
    const done = el("button", "link", "Done");
    done.onclick = () => { lib.swapTrack = null; lib.addTrack = null; renderLibrary(); };
    bar.append(done);
    box.append(bar);
  }

  if (lib.loaded && !lib.items.length) {
    const empty = el("div", "smp-empty");
    empty.append(el("div", "smp-big", "Library is empty"),
      el("p", null, "The kicks, snares, hats and FX remade from your songs show up here once they are made."));
    const splice = el("button", "pill", "Open Samples (Splice)");
    splice.onclick = () => toggleSamples(true);
    empty.append(splice);
    box.append(empty);
    return;
  }

  const search = el("input", "smp-search");
  search.id = "lib-search";
  search.placeholder = "Search: kick, adore u, deep, G#\u2026";
  search.value = lib.q;
  search.oninput = () => { lib.q = search.value; libRenderList(); };
  search.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Escape") { search.value = ""; lib.q = ""; libRenderList(); search.blur(); } };

  const chips = el("div", "smp-chips");
  for (const [k, label] of LIB_CATS) {
    const b = el("button", "smp-chip" + (lib.cat === k ? " on" : ""), label);
    b.dataset.cat = k;
    b.onclick = () => { lib.cat = k; renderLibrary(); };
    chips.append(b);
  }
  const splice = el("button", "smp-chip", "Splice");
  splice.title = "Your Splice sounds (B)";
  splice.onclick = () => toggleSamples(true);
  chips.append(splice);

  const songs = [...new Set(lib.items.map((s) => s.song).filter(Boolean))];
  const filters = el("div", "lib-filters");
  if (songs.length > 1) {
    const pick = el("select", "lib-song");
    pick.id = "lib-song";
    pick.append(new Option("Every song", ""), ...songs.map((s) => new Option(s, s)));
    pick.value = lib.song;
    pick.onchange = () => { lib.song = pick.value; libRenderList(); };
    filters.append(pick);
  }

  const list = el("div", "smp-list");
  list.id = "lib-list";
  box.append(search, chips, ...(songs.length > 1 ? [filters] : []), list,
    el("div", "smp-foot", !lib.loaded ? "Loading\u2026" : swapLane ? "Click to hear \u00b7 Use swaps every hit on the lane (Cmd+Z undoes)"
      : "Click to hear \u00b7 Add puts one hit at the marker"));
  libRenderList();
  if (document.activeElement === document.body) search.focus();
}

function libRenderList() {
  const list = $("lib-list");
  if (!list) return;
  list.replaceChildren();
  const shown = libVisible();
  if (!shown.length) { list.append(el("div", "smp-none", lib.loaded ? "Nothing matches. Try fewer words, or All." : "Loading the library\u2026")); return; }
  shown.slice(0, 400).forEach((s) => list.append(libRow(s)));
}

function libRow(s) {
  const row = el("div", "smp-row lib-row" + (lib.playing === s.id ? " playing" : "") + (lib.used === s.id ? " used" : ""));
  row.dataset.id = s.id;
  const play = el("span", "smp-play", lib.playing === s.id ? "\u25a0" : "\u25b6");
  const main = el("div", "lib-main");
  const name = el("div", "lib-name", libShort(s));
  name.title = s.name;
  main.append(name, el("div", "lib-sub", [s.song, s.artist].filter(Boolean).join(" \u00b7 ") || LIB_LANE[s.type] || ""));
  const meta = el("span", "smp-meta");
  const note = s.note || (s.pitch_hz ? Math.round(s.pitch_hz) + " Hz" : "");
  if (note) { const i = el("i", null, note); if (s.pitch_hz) i.title = s.pitch_hz.toFixed(1) + " Hz"; meta.append(i); }
  (s.tone || []).slice(0, 1).forEach((w) => meta.append(el("i", "tone", w)));
  if (s.match && s.match.score != null) {
    const m = el("i", "match", Math.round(s.match.score * 100) + "%");
    m.title = "How close it is to the sound in the original song";
    meta.append(m);
  }
  const dur = el("span", "lib-dur", s.duration_s != null ? (s.duration_s < 10 ? s.duration_s.toFixed(2) : Math.round(s.duration_s)) + "s" : "");
  const add = el("button", "lib-add", lib.swapTrack ? "Use" : "Add");
  const kitLane = lib.swapTrack && ui.state && libIsKit(ui.state.tracks.find((t) => t.id === lib.swapTrack));
  add.title = kitLane ? "Put this sound on the drum pad of its kind" : lib.swapTrack ? "Swap every hit on the lane for this sound" : "Add one hit at the marker";
  add.onclick = (e) => { e.stopPropagation(); lib.swapTrack ? libSwap(lib.swapTrack, s) : libAdd(s); };
  row.append(play, main, meta, dur, add);
  row.onclick = () => libPreview(s);
  return row;
}

// ---------------------------------------------------------------------------
// Hearing, adding, swapping (the same commands the assistant uses)
function libPreview(s) {
  if (lib.playing === s.id) return libStop();
  if (smp.playing) { smp.playing = null; if (typeof renderList === "function") renderList(); }
  lib.playing = s.id;
  run("previewSample", { url: libUrl(s), path: s.file, name: s.name })
    .then((r) => { if (r && r.error) { lib.playing = null; libRenderList(); } });
  libRenderList();
}
function libStop() {
  if (!lib.playing) return;
  lib.playing = null;
  run("stopPreview");
  libRenderList();
}
booth.on("previewEnded", () => { if (lib.playing) { lib.playing = null; libRenderList(); } });

const LIB_VOCAL_ROLES = /^(lead|double|adlib|harmony|backs)$/;
// Where Add puts a hit: the lane picked from its dot, else the selected lane when it is a
// drum or FX lane (never onto a vocal), else a new lane named after the sound's type.
function libTargetLane(s, trackId) {
  const tracks = (ui.state && ui.state.tracks) || [];
  const ok = (t) => t && t.kind === "take" && (!LIB_VOCAL_ROLES.test(t.role) || libLaneType(t));
  const byId = (x) => tracks.find((t) => t.id === x);
  if (trackId && ok(byId(trackId))) return byId(trackId);
  const fits = (t) => !libLaneType(t) || libLaneType(t) === libGroup(s.type); // never a snare onto the Kick lane
  if (lib.addTrack && ok(byId(lib.addTrack)) && fits(byId(lib.addTrack))) return byId(lib.addTrack);
  const sel = byId(ui.selectedTrack);
  if (ok(sel) && fits(sel)) return sel;
  return null;
}

async function libAdd(s, { trackId, start } = {}) {
  libStop();
  const t = libTargetLane(s, trackId);
  const at = start != null ? start : snapBeat(ui.transport.position);
  // Sounds Claude adds arrive dry: no effects on the clip.
  const r = await run("addSample", { url: libUrl(s), path: s.file, name: s.name, trackId: t ? t.id : null, start: Math.max(0, at), bpm: 0, origBpm: s.bpm || 0, key: s.key || null,
                                     laneName: LIB_LANE[s.type] || "Samples", libType: s.type });
  if (!r || r.error) return r;
  if (!t && r.trackId) lib.addTrack = lib.open ? r.trackId : null; // more Adds go on the new lane
  if (r.clipId) { ui.selectedClip = r.clipId; render(); }
  toast(`${s.name} added at bar ${barAt(at)}${t ? " on " + t.name : ""}.`);
  renderLibrary();
  return r;
}

// "Change sample..." is for drum and FX lanes: a vocal lane would lose its whole take to one hit.
// A TOY DRUMS lane swaps one pad: the one of the sound's kind.
const libIsKit = (t) => !!t && t.kind === "inst" && /toy drums|killdrum/i.test(t.instrument || "") && t.clips.length > 0;
const libCanSwap = (t) => libIsKit(t) || (!!t && t.kind === "take" && t.clips.length > 0 && (!LIB_VOCAL_ROLES.test(t.role) || !!libLaneType(t)));

async function libSwap(trackId, s) {
  libStop();
  const t = ui.state && ui.state.tracks.find((x) => x.id === trackId);
  if (!t) return { error: "That lane is gone." };
  if (!libCanSwap(t)) { toast(`${t.name} is a vocal lane, so its sound can't be swapped for a drum hit.`, true); return { error: "Pick a drum or FX lane to change its sound." }; }
  const r = await run("swapSample", { trackId, url: libUrl(s), path: s.file, id: s.id, name: s.name, type: s.type });
  if (!r || r.error) return r;
  lib.used = s.id;
  ui.selectedClip = null; render();
  toast(r.pad != null ? `${t.name}: the ${r.padName} pad now plays ${s.name} (${r.hits} hit${r.hits === 1 ? "" : "s"}). Cmd+Z puts it back.`
                      : `${t.name} now plays ${s.name} (${r.hits} hit${r.hits === 1 ? "" : "s"}). Cmd+Z puts it back.`);
  renderLibrary();
  return r;
}

// The best sound for some words ("glue hat", "kick from adore u"), for the assistant.
async function libFind(words, type) {
  await libLoad();
  const ws = String(words || "").toLowerCase().replace(/\bfrom\b|\bthe\b|\bsound\b|\bsample\b/g, " ").split(/[\s,]+/).filter(Boolean);
  const group = type ? libGroup(type === "hat" || type === "hats" ? "hat_closed" : type.replace(/s$/, "")) : null;
  let best = null, bestScore = -1;
  for (const s of lib.items) {
    if (group && libGroup(s.type) !== group) continue;
    const hay = [s.name, s.song, s.artist, s.type, (s.type || "").replace("_", " "), LIB_LANE[s.type], s.note, ...(s.tone || [])].filter(Boolean).join(" ").toLowerCase();
    // every word that fits counts; a name with no words left over ("Hat" for "glue hat", not "Open hat") wins a tie
    const own = libShort(s).toLowerCase().split(/[\s\-]+/).filter(Boolean);
    const score = ws.filter((w) => hay.includes(w) || hay.includes(w.replace(/s$/, ""))).length
      + (own.every((w) => ws.some((x) => x === w || x.replace(/s$/, "") === w)) ? 0.5 : 0) + (s.match && s.match.score ? s.match.score / 10 : 0);
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return ws.length && bestScore < 1 && !group ? null : best;
}

window.killtoyLibrary = {
  laneType: libLaneType, canSwap: libCanSwap, openForLane: openLibraryForLane, toggle: toggleLibrary,
  load: libLoad, find: libFind, add: libAdd, swap: libSwap, items: () => lib.items,
};

// The Samples drawer gets a way back here, and opening one drawer closes the other.
{
  const openSamples = toggleSamples;
  toggleSamples = function (on = !smp.open) { // eslint-disable-line no-func-assign
    if (on && lib.open) toggleLibrary(false);
    openSamples(on);
    document.body.classList.toggle("samples-open", on || lib.open);
  };
  const drawSamples = renderSamples;
  renderSamples = function () { // eslint-disable-line no-func-assign
    drawSamples();
    const head = document.querySelector("#samples .smp-head");
    if (!head || head.querySelector(".lib-back")) return;
    const back = el("button", "link lib-back", "Library");
    back.title = "Drums and FX from your songs (Y)";
    back.onclick = () => toggleLibrary(true);
    head.insertBefore(back, head.lastChild);
  };
}

// ---------------------------------------------------------------------------
// Wiring
libLoad(); // small; also lets the assistant see what's there
$("tool-library").onclick = (e) => { e.stopPropagation(); toggleLibrary(); };
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === "y" || e.key === "Y") { e.preventDefault(); toggleLibrary(); }
});
