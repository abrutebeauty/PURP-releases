// KILLTOY assistant: talk to the app and it does the work, like talking to a person.
// Loaded after app.js and uses its globals (ui, booth, run, toast, findClip, selectClip...).
// Every action goes through the same booth commands as the buttons, so the screen updates
// live and Cmd+Z undoes what the assistant did.
//
//   ears   - streaming speech-to-text (Web Speech API), English
//   turns  - knows when Eman has finished talking (about half a second after the last word,
//            longer after "and", "the", "um"...), so it never cuts in
//   quick  - clear, undoable commands ("play", "loop the hook", "pull up Serum") run the
//            moment they are heard, before the sentence ends; the rest goes to Claude
//   brain  - Claude with the KILLTOY tools below: the claude.ai artifact's own Claude when
//            running as the playground, otherwise the Anthropic API with Eman's key
//   voice  - speechSynthesis; stops the moment Eman starts talking again
//
// Keep this file ASCII-only, like the rest of ui/.
"use strict";

(function () {
  // -------------------------------------------------------------------------
  // Small helpers
  const A = { live: false, caps: false, mode: "idle", turns: [], busy: null, queue: [], heard: "", reply: "", log: [] };
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const squash = (s) => norm(s).replace(/ /g, "");
  const st = () => ui.state || {};
  const spb = () => 240 / (st().bpm || 120); // seconds per bar
  const toBar = (sec) => Math.round((sec / spb() + 1) * 100) / 100;
  const toSec = (bar) => Math.max(0, (Number(bar) - 1) * spb());
  const fresh = async () => { const s = await booth("getState"); if (s && !s.error) ui.state = s; return ui.state; };
  // The engine's own transport (the screen's copy can lag a frame behind).
  const tr = async () => { const s = await fresh(); return (s && s.transport) || ui.transport; };
  const songEnd = () => Math.max(0, ...(st().tracks || []).flatMap((t) => t.clips.map((c) => c.start + c.length)));

  // Undo steps the assistant's last action made, so "undo that" takes all of it back.
  // The screen's own edits reset the count (see the listeners near the end).
  const UNDOABLE = new Set(["splitClip", "deleteClip", "moveClip", "addPlugin", "removePlugin", "clearEffects", "applyChain", "setClipTake", "deleteTrack"]);
  const UNDOABLE_APP = new Set(["setClipGain", "setTrackVolume", "setClipFades", "duplicateClips", "renameClip", "newTakeLane", "setTrackRole", "renameTrack", "toggleSolo", "toggleMute", "setSections", "setBpm", "togglePlugin", "newInstrumentLane"]);
  let undoSteps = 0, counting = false;

  async function cmd(name, args) {
    if (counting && (UNDOABLE.has(name) || UNDOABLE_APP.has(name) || (window.__JUCE__ && name === "setParam" && args && args.begin))) undoSteps++;
    const r = await booth(name, args || {});
    if (r && r.error) throw new Error(r.error);
    return r || { ok: true };
  }

  function did(text) {
    A.log.push(text);
    renderBubble();
    bump();
  }

  // -------------------------------------------------------------------------
  // Finding things by the words Eman uses
  const ROLE_WORDS = {
    lead: ["lead", "lead vox", "lead vocal", "main", "main vocal", "vocal", "vocals"],
    double: ["double", "doubles", "dub", "dubs", "stack", "stacks"],
    adlib: ["adlib", "adlibs", "ad lib", "ad libs"],
    harmony: ["harmony", "harmonies", "harm"],
    backs: ["backs", "backing", "backing vocals", "backgrounds", "bgv", "bgvs"],
    fx: ["fx", "effects lane", "fx vox", "vocal fx"],
    beat: ["beat", "instrumental", "the beat", "music"],
  };

  function sections() {
    const list = (st().sections || []).slice().sort((a, b) => a.start - b.start);
    return list.map((x, i) => ({ ...x, end: x.end > x.start ? x.end : (list[i + 1] ? list[i + 1].start : Math.max(songEnd(), x.start + 8 * spb())) }));
  }

  const ORDINALS = { first: 1, "1st": 1, one: 1, second: 2, "2nd": 2, two: 2, third: 3, "3rd": 3, three: 3, last: -1, final: -1 };

  function findSection(words) {
    const w = norm(words).replace(/^the /, "");
    if (!w) return null;
    const list = sections();
    let nth = 0, name = w;
    const m = w.match(/^(first|1st|second|2nd|third|3rd|last|final) (.+)$/) || w.match(/^(.+?) (one|two|three)$/);
    if (m) {
      if (ORDINALS[m[1]] !== undefined) { nth = ORDINALS[m[1]]; name = m[2]; } else { nth = ORDINALS[m[2]]; name = m[1]; }
    }
    const key = squash(name).replace(/s$/, "").replace(/^chorus$/, "hook").replace(/^pre(chorus)?$/, "pre");
    const exact = list.filter((x) => squash(x.name) === squash(w));
    if (exact.length) return exact[0];
    const hits = list.filter((x) => squash(x.name).replace(/s$/, "").startsWith(key) || squash(x.name).replace(/\d+$/, "") === key);
    if (!hits.length) return null;
    if (nth === -1) return hits[hits.length - 1];
    if (nth > 0) return hits[nth - 1] || null;
    // "the hook" with no number: the next one from the playhead, else the first.
    const pos = ui.transport.position;
    return hits.find((x) => x.start >= pos - 0.01) || hits[0];
  }

  function findLane(words, { allowBeat = true } = {}) {
    const tracks = st().tracks || [];
    if (words == null || words === "") return null;
    const w = norm(words).replace(/^the /, "");
    const byId = tracks.find((t) => t.id === String(words));
    if (byId) return byId;
    // "master", "the mix", "mix bus": the master strip (effects there go on the whole song)
    if (st().master && (String(words) === "master" || /^(master|master bus|mix bus|mixbus|the mix|mix|whole (song|mix)|main out|stereo out)$/.test(w))) return masterTrack();
    const ok = (t) => allowBeat || t.kind !== "beat";
    let t = tracks.find((x) => ok(x) && norm(x.name) === w);
    if (t) return t;
    for (const [role, list] of Object.entries(ROLE_WORDS))
      if (list.includes(w)) { t = tracks.find((x) => ok(x) && (x.role === role || x.kind === role)); if (t) return t; }
    return tracks.find((x) => ok(x) && (norm(x.name).includes(w) || (w.length > 3 && w.includes(norm(x.name))))) || null;
  }

  function allClips() {
    return (st().tracks || []).flatMap((t) => t.clips.map((c) => ({ ...c, track: t })));
  }

  // A clip by id, by name, "selected", or the one under the playhead (on a lane if given).
  function findClipRef(ref, laneWords, atSec) {
    const clips = allClips();
    const r = ref == null ? "" : String(ref).trim();
    if (r && r !== "selected") {
      const byId = clips.find((c) => c.id === r);
      if (byId) return byId;
      const w = norm(r);
      const byName = clips.find((c) => norm(c.name) === w) || clips.find((c) => norm(c.name).includes(w));
      if (byName) return byName;
    }
    const lane = laneWords ? findLane(laneWords) : null;
    const covers = (c, t) => t >= c.start - 0.01 && t < c.start + c.length;
    if (!r && !lane && ui.selectedClip) { const c = clips.find((x) => x.id === ui.selectedClip); if (c && (atSec == null || covers(c, atSec))) return c; }
    if (r === "selected" && ui.selectedClip) { const c = clips.find((x) => x.id === ui.selectedClip); if (c) return c; }
    const pos = atSec != null ? atSec : ui.transport.position;
    const under = clips.filter((c) => covers(c, pos) && (!lane || c.track.id === lane.id));
    return under.find((c) => c.track.kind === "take") || under.find((c) => c.track.kind !== "beat") || under[0] || null;
  }

  function needClip(ref, lane, atSec) {
    const c = findClipRef(ref, lane, atSec);
    if (!c) throw new Error("No clip there. Say which clip, or select one.");
    return c;
  }

  const FX_ALIASES = {
    verb: "reverb", reverb: "reverb", room: "reverb", hall: "reverb", echo: "delay", delay: "delay", slapback: "delay",
    eq: "eq", equalizer: "eq", equaliser: "eq", comp: "compressor", compressor: "compressor", compression: "compressor",
    distortion: "drive", dist: "drive", saturation: "drive", drive: "drive", overdrive: "drive",
    deesser: "deess", deess: "deess", esses: "deess", gate: "vocal gate", noisegate: "vocal gate",
    autotune: "tunr", tune: "tunr", tuner: "tunr", hardtune: "tunr", tpain: "tunr", pitchcorrection: "tunr",
    snaptune: "tunr", snap: "tunr", tunr: "tunr",
    // KILLTOY's own effects
    pump: "pump", sidechain: "pump", duck: "pump", ducking: "pump", pumping: "pump",
    choppitch: "chop pitch", pitch: "chop pitch", pitchshift: "chop pitch", formant: "chop pitch", formants: "chop pitch", chipmunk: "chop pitch",
    space: "space", bigreverb: "space", lushreverb: "space", spacereverb: "space", cloudseed: "space",
    crush: "crush", bitcrusher: "crush", bitcrush: "crush", crusher: "crush", lofi: "crush", decimator: "crush",
    loud: "loud", limiter: "loud", maximizer: "loud", maximiser: "loud", louder: "loud",
    sc: "sc clip", scclip: "sc clip", clip: "sc clip", clipper: "sc clip", clipping: "sc clip", softclip: "sc clip", softclipper: "sc clip",
    softclipping: "sc clip", standardclip: "sc clip", seeclip: "sc clip", essclip: "sc clip",
  };

  let pluginCache = null;
  async function plugins() {
    if (!pluginCache) { const r = await booth("listPlugins"); pluginCache = Array.isArray(r) ? r : []; setTimeout(() => (pluginCache = null), 30000); }
    return pluginCache;
  }

  function matchPlugin(list, words) {
    const w = squash(words).replace(/^(an?|the)/, "");
    if (!w) return null;
    const alias = squash(FX_ALIASES[w] || "");
    const score = (p) => {
      const n = squash(p.name);
      if (n === w || (alias && n === alias)) return 3;
      if (n.startsWith(w) || (alias && n.startsWith(alias))) return 2;
      if (n.includes(w) || (w.length > 3 && w.includes(n))) return 1;
      return 0;
    };
    let best = null, bestScore = 0;
    for (const p of list) { const s = score(p); if (s > bestScore) { best = p; bestScore = s; } }
    return best;
  }

  function findEffect(clip, words) {
    const list = clip.plugins || [];
    if (!words) return list[list.length - 1] || null;
    const byId = list.find((p) => p.id === String(words));
    if (byId) return byId;
    return matchPlugin(list, words);
  }

  const KNOB_ALIASES = { wet: "mix", amount: "mix", level: "mix", repeats: "feedback", length: "time", size: "room", decay: "room", gain: "gain" };

  function findKnob(p, words) {
    const w = squash(words);
    const alias = squash(KNOB_ALIASES[norm(words)] || "");
    const params = p.params || [];
    return params.find((k) => squash(k.name) === w || squash(k.id) === w)
        || params.find((k) => squash(k.name).includes(w) || (alias && squash(k.name).includes(alias)))
        || (/^(mix|wet|amount)$/.test(norm(words)) && params.find((k) => /mix|wet/i.test(k.name)))
        || null;
  }

  // -------------------------------------------------------------------------
  // The tools Claude can use. Same commands as the buttons.
  const loopRange = async (start, end, play) => {
    await cmd("setLoopRange", { start, end });
    if (play && !(await tr()).playing) { await cmd("setPosition", { time: start }); await cmd("togglePlay"); }
  };

  // Move the marker like the screen does: jumping outside the loop turns looping off.
  async function jumpTo(t) {
    const s = await fresh();
    if (s && s.transport && s.transport.looping && (t < (s.loopStart || 0) - 0.01 || t >= (s.loopEnd || 0) - 0.01)) await cmd("setLooping", { on: false });
    await cmd("setPosition", { time: t });
  }

  async function openPlugin(name) {
    const list = await plugins();
    const p = matchPlugin(list, name);
    if (!p) throw new Error(`I can't find "${name}" in your plugins.`);
    await fresh();
    if (p.instrument) {
      let lane = (st().tracks || []).find((t) => t.kind === "inst" && squash(t.instrument || t.name) === squash(p.name));
      if (!lane) { await cmd("newInstrumentLane", { key: p.key }); await fresh(); lane = (st().tracks || []).filter((t) => t.kind === "inst").pop(); }
      else await cmd("armTrack", { trackId: lane.id });
      const inst = lane && lane.clips.flatMap((c) => c.plugins || []).find((x) => x.instrument);
      if (window.__JUCE__ && inst) await cmd("openPlugin", { pluginId: inst.id });
      else if (!window.__JUCE__) showPluginWindow(p.name);
      return `${p.name} is up${lane && lane.name !== p.name ? " on " + lane.name : ""}.`;
    }
    const clip = findClipRef();
    const fx = clip && findEffect(clip, p.name);
    if (fx && window.__JUCE__) await cmd("openPlugin", { pluginId: fx.id });
    else if (fx) showPluginWindow(p.name);
    else return `${p.name} is an effect. Tell me which clip to put it on.`;
    return `${p.name} is open.`;
  }

  async function addEffect(host, words, knobs) {
    const list = await plugins();
    const p = matchPlugin(list.filter((x) => !x.instrument), words);
    if (!p) throw new Error(`No effect called "${words}".`);
    const target = host.target || { clipId: host.id };
    try { await cmd("addPlugin", { ...target, key: p.key }); }
    catch (e) {
      // An engine without lane effects yet: put it on each of the lane's clips instead.
      if (!target.trackId || !host.lane || !host.lane.clips.length) throw e;
      for (const c of host.lane.clips) await cmd("addPlugin", { clipId: c.id, key: p.key });
      return { name: p.name };
    }
    await fresh();
    const now = target.trackId ? (st().tracks || []).find((t) => t.id === target.trackId) : allClips().find((x) => x.id === target.clipId);
    const fxs = (now && now.plugins) || [];
    const fx = fxs[fxs.length - 1];
    if (fx && knobs) for (const [k, v] of Object.entries(knobs)) await setKnob(fx, k, v, false);
    return fx;
  }

  async function setKnob(fx, knob, percent, ownUndoStep = true) {
    const k = findKnob(fx, knob);
    if (!k) throw new Error(`${fx.name} has no "${knob}" knob. It has ${(fx.params || []).map((x) => x.name).join(", ") || "no knobs here"}.`);
    const value = Math.max(0, Math.min(1, Number(percent) / 100));
    const r = await cmd("setParam", { pluginId: fx.id, paramId: k.id, value, begin: ownUndoStep });
    return `${k.name} ${r.text || Math.round(value * 100) + "%"}`;
  }

  // A delay throw: echo set to the song's tempo, repeats that ring out.
  async function delayThrow(clip) {
    const fx = await addEffect(clip, "delay");
    if (!fx) return;
    const quarterMs = 60000 / (st().bpm || 120);
    for (const k of fx.params || []) {
      if (k.id === "purp:delayTime") await cmd("setParam", { pluginId: fx.id, paramId: k.id, value: Math.min(1, quarterMs / 1500), begin: false });
      else if (/feedback/i.test(k.name)) await cmd("setParam", { pluginId: fx.id, paramId: k.id, value: 0.55, begin: false });
      else if (/mix|wet/i.test(k.name)) await cmd("setParam", { pluginId: fx.id, paramId: k.id, value: 0.45, begin: false });
    }
  }

  // Clip volume: the engine reports a clip's gain in dB as c.gain.
  const gainTo = (c, db, change) => Math.max(-60, Math.min(24, change != null ? (Number(c.gain) || 0) + Number(change) : Number(db) || 0));
  const volWords = (db, change) => change != null ? (change >= 0 ? `up ${change} dB` : `down ${-change} dB`) : `at ${Number(db) || 0} dB`;

  // Where an effect goes: the clip, or the whole lane when only a lane is named.
  function fxHost(clip, lane) {
    if (lane && !clip) {
      const t = findLane(lane);
      if (!t) throw new Error(`No lane called ${lane}.`);
      return { lane: t, name: t.name, plugins: t.plugins || [], target: { trackId: t.id } };
    }
    const c = needClip(clip, lane);
    return { clip: c, name: c.name, plugins: c.plugins || [], target: { clipId: c.id } };
  }

  const where = { type: "string", description: "Section name as shown (e.g. \"HOOK\", \"VERSE 2\", \"second hook\")." };
  const barProp = (d) => ({ type: "number", description: d + " Bars count from 1; decimals allowed (37.5 = halfway through bar 37)." });
  const clipProp = { type: "string", description: "Clip id from the session list, or \"selected\". Leave out for the selected clip, else the clip under the playhead." };
  const laneProp = { type: "string", description: "Lane name or role, e.g. \"Lead Vox\", \"doubles\", \"adlibs\"." };

  const TOOLS = [
    {
      name: "transport",
      description: "Play, stop or record. Play/record can start from a bar or a section. Recording uses the armed lane (or the lane given).",
      schema: { type: "object", properties: { action: { type: "string", enum: ["play", "stop", "record"] }, bar: barProp("Start here."), section: where, lane: laneProp }, required: ["action"] },
      async run({ action, bar, section, lane }) {
        const t0 = await tr();
        if (action === "stop") { if (t0.playing || t0.recording) await cmd(t0.recording ? "toggleRecord" : "togglePlay"); return "Stopped."; }
        let at = null;
        if (section) { const s = findSection(section); if (!s) throw new Error(`No section called ${section}.`); at = s.start; }
        else if (bar != null) at = toSec(bar);
        if (action === "record") {
          if (lane) { const l = findLane(lane, { allowBeat: false }); if (!l) throw new Error(`No lane called ${lane}.`); await cmd("armTrack", { trackId: l.id }); }
          if (t0.playing) await cmd("togglePlay");
          if (at != null) await jumpTo(at);
          await cmd("toggleRecord");
          return "Recording.";
        }
        if (at != null) { if (t0.playing) await cmd("togglePlay"); await jumpTo(at); }
        if (!t0.playing || at != null) await cmd("togglePlay");
        return "Playing" + (at != null ? ` from bar ${toBar(at)}` : "") + ".";
      },
    },
    {
      name: "loop",
      description: "Loop a section or a bar range (and start playing it), or turn looping off.",
      schema: { type: "object", properties: { section: where, from_bar: barProp("Loop start."), to_bar: barProp("Loop end (exclusive)."), off: { type: "boolean" }, play: { type: "boolean", description: "Start playing the loop. Default true." } } },
      async run({ section, from_bar, to_bar, off, play = true }) {
        if (off) { await cmd("setLooping", { on: false }); return "Loop off."; }
        if (section) { const s = findSection(section); if (!s) throw new Error(`No section called ${section}.`); await loopRange(s.start, s.end, play); return `Looping ${s.name}.`; }
        if (from_bar != null) { const a = toSec(from_bar), b = to_bar != null ? toSec(to_bar) : a + 4 * spb(); await loopRange(a, b, play); return `Looping bars ${toBar(a)}-${toBar(b)}.`; }
        await cmd("setLooping", { on: true });
        return "Loop on.";
      },
    },
    {
      name: "go_to",
      description: "Move the playhead to a bar or section without changing play/stop.",
      schema: { type: "object", properties: { bar: barProp("Target."), section: where } },
      async run({ bar, section }) {
        const s = section ? findSection(section) : null;
        if (section && !s) throw new Error(`No section called ${section}.`);
        const t = s ? s.start : toSec(bar || 1);
        await jumpTo(t);
        return `At bar ${toBar(t)}.`;
      },
    },
    {
      name: "song",
      description: "Change tempo (BPM), metronome/click on or off, or count-in bars (0, 1, 2).",
      schema: { type: "object", properties: { bpm: { type: "number" }, metronome: { type: "boolean" }, count_in: { type: "number", enum: [0, 1, 2] } } },
      async run({ bpm, metronome, count_in }) {
        const out = [];
        if (bpm) { await cmd("setBpm", { bpm: Number(bpm) }); out.push(`${bpm} BPM`); }
        if (metronome != null && !!metronome !== !!st().click) { await cmd("toggleClick"); out.push("click " + (metronome ? "on" : "off")); }
        if (count_in != null) { await cmd("setCountIn", { bars: Number(count_in) }); out.push(`count-in ${count_in}`); }
        return out.join(", ") || "Nothing changed.";
      },
    },
    {
      name: "lane",
      description: "Add, change or delete a lane. Change = mute, solo, arm for recording, rename, set its role (lead, double, adlib, harmony, backs, fx), or its volume (the lane's fader, -60 to +6 dB). \"Turn the double down\" = this lane volume. New lanes get armed.",
      schema: { type: "object", properties: {
        action: { type: "string", enum: ["add", "change", "delete"] }, lane: laneProp,
        role: { type: "string", enum: ["lead", "double", "adlib", "harmony", "backs", "fx"] }, name: { type: "string" },
        mute: { type: "boolean" }, solo: { type: "boolean" }, arm: { type: "boolean" },
        volume_db: { type: "number", description: "Set the lane's fader to this many dB (0 = unity)." },
        change_db: { type: "number", description: "Turn the lane up (+) or down (-) by this many dB. \"A bit\" = 2." } }, required: ["action"] },
      async run({ action, lane, role, name, mute, solo, arm, volume_db, change_db }) {
        await fresh();
        if (action === "add") {
          const r = await cmd("newTakeLane", { role: role || "" });
          await fresh();
          const t = (st().tracks || []).find((x) => x.id === r.trackId) || (st().tracks || []).filter((x) => x.kind === "take").pop();
          if (t && role && t.role !== role) await cmd("setTrackRole", { trackId: t.id, role });
          if (t && name) await cmd("renameTrack", { trackId: t.id, name });
          const now = t && (await fresh(), (st().tracks || []).find((x) => x.id === t.id));
          return `Added ${(now && now.name) || name || "a lane"}, armed.`;
        }
        const t = findLane(lane);
        if (!t) throw new Error(`No lane called ${lane}.`);
        if (action === "delete") { await cmd("deleteTrack", { trackId: t.id }); return `Deleted ${t.name}.`; }
        const out = [];
        if (mute != null && !!mute !== !!t.muted) { await cmd("toggleMute", { trackId: t.id }); out.push(mute ? "muted" : "unmuted"); }
        if (solo != null && !!solo !== !!t.solo) { await cmd("toggleSolo", { trackId: t.id }); out.push(solo ? "soloed" : "unsoloed"); }
        if (arm) { await cmd("armTrack", { trackId: t.id }); out.push("armed"); }
        if (role && role !== t.role) { await cmd("setTrackRole", { trackId: t.id, role }); out.push("now " + role); }
        if (name) { await cmd("renameTrack", { trackId: t.id, name }); out.push("renamed " + name); }
        if (volume_db != null || change_db != null) {
          const db = Math.max(-60, Math.min(6, change_db != null ? (Number(t.volume) || 0) + Number(change_db) : Number(volume_db) || 0));
          await cmd("setTrackVolume", { trackId: t.id, db });
          out.push(`volume ${Math.round(db * 10) / 10} dB`);
        }
        return `${t.name}: ${out.join(", ") || "no change"}.`;
      },
    },
    {
      name: "clip",
      description: "Do something to one clip: select it (shows its effects), cut it at a bar, move it (to a bar and/or lane), delete, duplicate (copy right after itself), rename, set its own volume (clip gain, separate from the lane fader), fade it in/out, or pick which take/version plays.",
      schema: { type: "object", properties: {
        action: { type: "string", enum: ["select", "cut", "move", "delete", "duplicate", "rename", "volume", "fade", "take"] }, clip: clipProp, lane: laneProp,
        bar: barProp("Cut point, or where the moved clip should start."), to_lane: laneProp,
        db: { type: "number", description: "For volume: set the clip to this many dB (0 = as recorded)." },
        change_db: { type: "number", description: "For volume: turn it up (+) or down (-) by this many dB. \"A bit\" = 2." },
        take: { type: "number", description: "Take number, from 1." }, name: { type: "string", description: "For rename." },
        fade_in: { type: "number", description: "For fade: fade-in length in beats (0 = none)." }, fade_out: { type: "number", description: "For fade: fade-out length in beats (0 = none)." } }, required: ["action"] },
      async run({ action, clip, lane, bar, to_lane, db, change_db, take, name, fade_in, fade_out }) {
        await fresh();
        const c = needClip(clip, lane, action === "cut" && bar != null ? toSec(bar) : undefined);
        const beat = 60 / (st().bpm || 120);
        switch (action) {
          case "select": selectClip(c.id); return `Selected ${c.name}.`;
          case "cut": { const t = bar != null ? toSec(bar) : ui.transport.position; await cmd("splitClip", { clipId: c.id, time: t }); return `Cut ${c.name} at bar ${toBar(t)}.`; }
          case "move": {
            const to = to_lane ? findLane(to_lane, { allowBeat: false }) : null;
            if (to_lane && !to) throw new Error(`No lane called ${to_lane}.`);
            await cmd("moveClip", { clipId: c.id, start: bar != null ? toSec(bar) : c.start, trackId: to ? to.id : c.track.id });
            return `Moved ${c.name}.`;
          }
          case "delete": await cmd("deleteClip", { clipId: c.id }); return `Deleted ${c.name}.`;
          case "duplicate": await cmd("duplicateClips", { clipIds: [c.id] }); return `Copied ${c.name}.`;
          case "rename": await cmd("renameClip", { clipId: c.id, name: String(name || c.name) }); return `Renamed it ${name}.`;
          case "fade": {
            const fi = fade_in != null ? Number(fade_in) * beat : c.fadeIn || 0, fo = fade_out != null ? Number(fade_out) * beat : c.fadeOut || 0;
            await cmd("setClipFades", { clipId: c.id, fadeIn: Math.min(fi, c.length / 2), fadeOut: Math.min(fo, c.length / 2) });
            return `Faded ${c.name}.`;
          }
          case "volume": await cmd("setClipGain", { clipId: c.id, db: gainTo(c, db, change_db) }); return `${c.name} ${volWords(db, change_db)}.`;
          case "take": await cmd("setClipTake", { clipId: c.id, index: Math.max(0, Number(take) - 1) }); return `Take ${take} on ${c.name}.`;
        }
        throw new Error("Unknown clip action.");
      },
    },
    {
      name: "effect",
      description: "Effects on a clip, or on a whole lane (name the lane and leave clip out, e.g. \"reverb on the adlibs\"): add one (optionally with knob settings), turn a knob (0-100%), remove, bypass on/off, clear all, apply a saved preset/chain, or save the effects as a preset.",
      schema: { type: "object", properties: {
        action: { type: "string", enum: ["add", "knob", "remove", "bypass", "clear", "preset", "save_preset"] }, clip: clipProp, lane: laneProp,
        effect: { type: "string", description: "Effect name, e.g. Delay, Reverb, EQ, Compressor, Drive, DeEss, or KILLTOY's own: Pump (tempo sidechain duck: Depth, Rate, Release), Chop Pitch (pitch + formant: Pitch, Formant, Mix), Space (big lush reverb: Size, Decay, Mix), Crush (bitcrusher: Bits, Rate, Mix), Loud (clipper + limiter: Push, Ceiling, Clip), Squash (OTT-style 3-band compression: Depth, Time, Output), Punch (transient shaper: Attack, Sustain, Mix), SC Clip (soft clipper for any sound: Drive, Shape soft-to-hard, Ceiling), TUNR (live pitch correction like Auto-Tune: Speed, Humanize, Formant; Key and Scale start at the song's key), or a plugin like Auto-Tune." },
        knob: { type: "string" }, percent: { type: "number", description: "0-100, where the knob points." },
        knobs: { type: "object", description: "For add: {knobName: percent}." }, preset: { type: "string", description: "Preset name, or the new name for save_preset." } }, required: ["action"] },
      async run({ action, clip, lane, effect, knob, percent, knobs, preset }) {
        await fresh();
        const c = fxHost(clip, lane);
        if (c.clip && ui.selectedClip !== c.clip.id) selectClip(c.clip.id);
        else if (c.lane && ui.selectedTrack !== c.lane.id && typeof selectTrack === "function") selectTrack(c.lane.id);
        if (action === "add") { const fx = await addEffect(c, effect, knobs); return `${fx ? fx.name : effect} on ${c.name}.`; }
        if (action === "clear") { await cmd("clearEffects", c.target); return `Cleared ${c.name}.`; }
        if (action === "preset") {
          const ch = (st().chains || []).find((x) => squash(x.name) === squash(preset)) || (st().chains || []).find((x) => squash(x.name).includes(squash(preset)));
          if (!ch) throw new Error(`No preset called ${preset}. Presets: ${(st().chains || []).map((x) => x.name).join(", ")}.`);
          await cmd("applyChain", { ...c.target, name: ch.name });
          return `${ch.name} on ${c.name}.`;
        }
        if (action === "save_preset") { await cmd("saveChain", { ...c.target, name: preset || "My preset" }); return `Saved ${preset}.`; }
        const fx = findEffect(c, effect);
        if (!fx) throw new Error(`${c.name} has no ${effect || "effects"}.`);
        if (action === "remove") { await cmd("removePlugin", { pluginId: fx.id }); return `Removed ${fx.name}.`; }
        if (action === "bypass") { await cmd("togglePlugin", { pluginId: fx.id }); return `${fx.name} ${fx.enabled ? "bypassed" : "back on"}.`; }
        if (action === "knob") return await setKnob(fx, knob, percent);
        throw new Error("Unknown effect action.");
      },
    },
    {
      name: "effect_on_part",
      description: "Put an effect on just one word or short part of a vocal: cuts that piece out of the clip and puts the effect on the piece only. Default effect is a delay throw (echo in time, repeats ring out). Use for \"delay throw on that word\", \"reverb on the last word\".",
      schema: { type: "object", properties: {
        clip: clipProp, lane: laneProp, from_bar: barProp("Start of the part. Default: the playhead."), to_bar: barProp("End of the part. Default: half a bar later."),
        effect: { type: "string", description: "\"delay throw\" (default), any effect name, or a preset name like Throw." } } },
      async run({ clip, lane, from_bar, to_bar, effect }) {
        await fresh();
        const c = needClip(clip, lane, from_bar != null ? toSec(from_bar) : undefined);
        const end = c.start + c.length;
        let a = from_bar != null ? toSec(from_bar) : ui.transport.position;
        let b = to_bar != null ? toSec(to_bar) : a + spb() / 2;
        a = Math.max(c.start, a); b = Math.min(end, b);
        if (b - a < 0.05) throw new Error("That part is outside the clip.");
        if (a > c.start + 0.02) await cmd("splitClip", { clipId: c.id, time: a });
        await fresh();
        let piece = allClips().find((x) => x.track.id === c.track.id && Math.abs(x.start - a) < 0.02) || allClips().find((x) => x.id === c.id);
        if (b < end - 0.02) { await cmd("splitClip", { clipId: piece.id, time: b }); await fresh(); piece = allClips().find((x) => x.track.id === c.track.id && Math.abs(x.start - a) < 0.02) || piece; }
        selectClip(piece.id);
        const e = norm(effect || "delay throw");
        const ch = (st().chains || []).find((x) => squash(x.name) === squash(e));
        if (ch) await cmd("applyChain", { clipId: piece.id, name: ch.name });
        else if (/throw|^delay$|echo/.test(e)) await delayThrow(piece);
        else await addEffect(piece, e);
        return `${ch ? ch.name : effect || "Delay throw"} on bars ${toBar(a)}-${toBar(b)} of ${c.track.name}.`;
      },
    },
    {
      name: "open_plugin",
      description: "Pull up / open a plugin window by name, e.g. Serum. Instruments get their own lane (made if needed, then armed).",
      schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      async run({ name }) { return await openPlugin(name); },
    },
    {
      name: "vocal_tool",
      description: "Run a vocal tool on a clip: tune (pitch-correct to the key), clean (remove noise/room), stems (split a mix into vocals/drums/bass/music), align (tighten a double to the lead), or send_to_ai (make an AI version from a prompt). These run in the background.",
      schema: { type: "object", properties: {
        tool: { type: "string", enum: ["tune", "clean", "stems", "align", "send_to_ai"] }, clip: clipProp, lane: laneProp,
        prompt: { type: "string", description: "For send_to_ai: what to make." } }, required: ["tool"] },
      async run({ tool, clip, lane, prompt }) {
        await fresh();
        const c = needClip(clip, lane);
        const lead = (st().tracks || []).find((t) => t.role === "lead");
        const map = { tune: ["tune", {}], clean: ["cleanVocal", {}], stems: ["splitStems", {}], align: ["align", { guideTrackId: lead && lead.id }], send_to_ai: ["sendToAI", { prompt, mode: "cover" }] };
        const [name, extra] = map[tool] || [];
        if (!name) throw new Error("Unknown tool.");
        await cmd(name, { clipId: c.id, ...extra });
        return `${tool.replace(/_/g, " ")} running on ${c.name}.`;
      },
    },
    {
      name: "variation",
      description: "Make a new version of a lane's sound, as a row under it (the original keeps playing until Eman picks Use). No prompt = a close variation (\"make a variation of the kick\"). With a prompt it changes the sound the way asked: \"darker\", \"a woman's voice\", \"distorted\", \"a different hi-hat\", \"a snare instead of the clap\".",
      schema: { type: "object", properties: { lane: laneProp, prompt: { type: "string", description: "How to change it, in Eman's words. Empty for a close variation." } }, required: ["lane"] },
      async run({ lane, prompt }) {
        if (!window.ktVariations) throw new Error("Variations aren't in this build.");
        return await window.ktVariations.make(lane, prompt || "");
      },
    },
    {
      name: "sections",
      description: "Song sections: find them automatically from the beat, or set them as a list of {name, bar}.",
      schema: { type: "object", properties: { action: { type: "string", enum: ["find", "set"] },
        sections: { type: "array", items: { type: "object", properties: { name: { type: "string" }, bar: { type: "number" } } } } }, required: ["action"] },
      async run({ action, sections: list }) {
        if (action === "find") { await cmd("autoSections"); return "Finding sections."; }
        await cmd("setSections", { sections: (list || []).map((x) => ({ name: String(x.name).toUpperCase(), start: toSec(x.bar) })) });
        return `Set ${(list || []).length} sections.`;
      },
    },
    {
      name: "library_sound",
      description: "The Library: drum hits and FX remade from Eman's songs (kicks, snares, claps, hats, perc, FX). add = put one hit on a lane at a bar (a new lane named after the sound unless a lane is given). swap = change the sound of every hit on a drum lane (same timing and levels), e.g. \"swap the hats for the Glue hat\". Name the sound with words (song, type, tone words).",
      schema: { type: "object", properties: {
        action: { type: "string", enum: ["add", "swap"] },
        sound: { type: "string", description: "Words for the sound, e.g. \"adore u kick\", \"glue hat\", \"deep punchy kick\"." },
        type: { type: "string", enum: ["kick", "snare", "clap", "hat", "perc", "fx"], description: "The kind of sound, when known." },
        lane: laneProp, bar: barProp("For add: where the hit goes. Default: the playhead.") }, required: ["action", "sound"] },
      async run({ action, sound, type, lane, bar }) {
        const L = window.killtoyLibrary;
        if (!L) throw new Error("The Library isn't here.");
        await fresh();
        let t = lane ? findLane(lane, { allowBeat: false }) : null;
        if (lane && !t) t = (st().tracks || []).find((x) => L.laneType(x) && L.laneType(x) === L.laneType({ kind: "take", name: lane })) || null;
        if (lane && !t) throw new Error(`No lane called ${lane}.`);
        const s = await L.find(sound, type || (action === "swap" && t ? L.laneType(t) : null));
        if (!s) throw new Error(L.items().length ? `No sound like "${sound}" in the Library.` : "The Library is empty.");
        if (action === "swap") {
          if (!t) throw new Error("Which lane should get the new sound?");
          const r = await L.swap(t.id, s);
          if (!r || r.error) throw new Error((r && r.error) || "Couldn't swap it.");
          return `${t.name} now plays ${s.name}.`;
        }
        const r = await L.add(s, { trackId: t ? t.id : null, start: bar != null ? toSec(bar) : undefined });
        if (!r || r.error) throw new Error((r && r.error) || "Couldn't add it.");
        return `Added ${s.name}.`;
      },
    },
    {
      name: "killdrum",
      description: "KILLDRUM, KILLTOY's drum machine (9 pads: kick, 808, snare, clap, closed hat, open hat, perc, FX, texture; each with Pitch, Decay, Drive, Filter, Pan, Level and Reverb/Delay/Clip/Crush/Drive effects). vibe = build a whole kit from words (\"dark carti 808s, crunchy snares\"). change = a follow-up on the kit (\"make the snare more distorted\", \"swap the clap\", \"add reverb to the clap\", \"808 down 2 semitones\"). roll = random kit (dice). beat = the BEAT tab, where the pattern is made: the style (genre), rolling new sounds and/or patterns for every unlocked pad or for one pad, locking a pad so rolls leave it alone, how many sounds sit on a pad (1-4, stacked together or taking turns), 16 or 32 steps, swing. Examples: \"make a rage beat\" = beat, genre rage (add roll sounds for new sounds too); \"lock the kick and roll the rest\" = beat, pad kick, lock true, roll all; \"new hi-hat pattern\" = beat, pad hat_closed, roll patterns; \"three snares mixed\" = beat, pad snare, how_many 3, mode stack; \"hats that alternate\" = beat, pad hat_closed, how_many 2, mode turns; \"more swing\" = beat, swing 30. beat with no options describes the current beat. Opens the drum lane's KILLDRUM window, making a KILLDRUM lane if there is none. Pass Eman's words through as text.",
      schema: { type: "object", properties: {
        action: { type: "string", enum: ["vibe", "change", "roll", "beat"] },
        text: { type: "string", description: "Eman's words for the kit or the change." },
        lane: laneProp,
        genre: { type: "string", enum: ["trap", "rage", "drill", "jersey", "lofi", "boombap", "house", "techno", "crystal", "dnb"], description: "beat: the style of the patterns." },
        roll: { type: "string", enum: ["all", "sounds", "patterns"], description: "beat: roll new sounds and/or patterns. For the one pad when pad is given (and lock is not), else for every unlocked pad." },
        pad: { type: "string", enum: ["kick", "808", "snare", "clap", "hat_closed", "hat_open", "perc", "fx", "texture"], description: "beat: the pad that roll, lock, how_many and mode are about." },
        lock: { type: "boolean", description: "beat: lock (true) or unlock (false) the pad. A locked pad keeps its sound and pattern when rolling." },
        how_many: { type: "number", description: "beat: how many sounds on the pad, 1-4." },
        mode: { type: "string", enum: ["stack", "turns"], description: "beat: stack = the pad's sounds play together, turns = they alternate hit by hit." },
        steps: { type: "number", enum: [16, 32], description: "beat: 16 steps (one bar) or 32 (two bars)." },
        swing: { type: "number", description: "beat: swing 0-60 (0 straight, 30 a clear bounce)." } }, required: ["action"] },
      async run({ action, text, lane, genre, roll, pad, lock, how_many, mode, steps, swing }) {
        let w = window.killDrumWindow;
        if (!w || lane) {
          await fresh();
          const isKit = (t) => t.kind === "inst" && /toy drums|killdrum/i.test(t.instrument || "");
          let t = lane ? findLane(lane, { allowBeat: false }) : (st().tracks || []).find(isKit);
          if (t && !isKit(t)) throw new Error(`${t.name} isn't a KILLDRUM lane.`);
          if (!t) { await cmd("newInstrumentLane", { key: "builtin:toydrums" }); await fresh(); t = (st().tracks || []).filter(isKit).pop(); }
          if (!t) throw new Error("Couldn't make a KILLDRUM lane.");
          window.killDrumWindow = null;
          openLaneWindow({ t, view: "inst" });
          for (let i = 0; i < 60 && !window.killDrumWindow; i++) await new Promise((r) => setTimeout(r, 100));
          w = window.killDrumWindow;
          if (!w) throw new Error("The KILLDRUM window didn't open.");
        }
        if (action === "beat") {
          if (w.showTab) w.showTab("beat");
          let b = null;
          for (let i = 0; i < 30 && !((b = window.killDrumBeat) && (!b.alive || b.alive())); i++) { b = null; await new Promise((r) => setTimeout(r, 100)); }
          if (!b) throw new Error("The BEAT tab didn't load.");
          if ((lock != null || how_many != null || mode) && !pad) throw new Error("Which pad? (kick, 808, snare, clap, hat_closed, hat_open, perc, fx, texture)");
          const out = [];
          if (genre) out.push(b.genre(genre));
          if (steps) out.push(b.steps(steps));
          if (swing != null) out.push(b.swing(swing));
          if (lock != null) out.push(b.lock(pad, !!lock));
          if (how_many != null || mode) out.push(b.howMany(pad, how_many, mode));
          if (roll) out.push(b.roll(roll, lock == null ? pad : null));   // "lock the kick and roll the rest": the roll is for the other pads
          if (!out.length) out.push(b.describe());
          return out.filter(Boolean).join(" ");
        }
        if (action === "roll") { w.roll(); return "Rolled a new kit."; }
        const r = await w.prompt(text || "", action === "vibe" ? "vibe" : "follow");
        return (r && r.say) || "Done.";
      },
    },
    {
      name: "history",
      description: "Undo or redo the last change(s), the same as Cmd+Z.",
      schema: { type: "object", properties: { action: { type: "string", enum: ["undo", "redo"] }, steps: { type: "number" } }, required: ["action"] },
      async run({ action, steps = 1 }) {
        await undoLast(action, Number(steps) || 1);
        return action === "undo" ? "Undone." : "Redone.";
      },
    },
    {
      name: "session",
      description: "Save a new version of the session (V2, V3...), export the full mix or the vocal stems as WAV, or find the beat's key and tempo.",
      schema: { type: "object", properties: { action: { type: "string", enum: ["new_version", "export_mix", "export_stems", "find_key"] } }, required: ["action"] },
      async run({ action }) {
        if (action === "new_version") { const r = await cmd("newVersion"); return `Saved V${r.version || ""}.`; }
        if (action === "export_mix") { await cmd("exportMix"); return "Exporting the mix."; }
        if (action === "export_stems") { await cmd("exportTakes"); return "Exported the stems."; }
        if (action === "find_key") { await cmd("analyzeBeat", { applyTempo: true }); return "Finding the key and tempo."; }
        throw new Error("Unknown session action.");
      },
    },
  ];

  // "Undo" right after the assistant did something takes back the whole thing (a delay throw is
  // two cuts and an effect); otherwise one step, like Cmd+Z.
  async function undoLast(action, steps) {
    const n = action === "undo" && steps === 1 && lastAct.steps > 0 ? lastAct.steps : Math.min(20, Math.max(1, steps));
    lastAct.steps = 0;
    for (let i = 0; i < n; i++) await booth(action);
  }
  const lastAct = { steps: 0 };

  async function counted(fn) {
    if (counting) return await fn(); // nested (a tool inside a turn): one total
    counting = true; undoSteps = 0;
    try { return await fn(); }
    finally { counting = false; if (undoSteps) lastAct.steps = undoSteps; }
  }

  async function runTool(name, input) {
    const t = TOOLS.find((x) => x.name === name);
    if (!t) throw new Error("Unknown tool " + name);
    setMode("acting");
    const out = name === "history" ? await t.run(input || {}) : await counted(() => t.run(input || {}));
    did(out);
    return out;
  }

  // -------------------------------------------------------------------------
  // What Claude sees each turn: the session in a few lines.
  function snapshot() {
    const s = st();
    const tr = ui.transport;
    const secs = sections();
    const at = secs.find((x) => tr.position >= x.start && tr.position < x.end);
    const lines = [];
    lines.push(`Session "${s.session || "?"}", ${s.bpm || 120} BPM${s.key && s.key.name ? ", key " + s.key.name : ""}. Song ends bar ${toBar(songEnd())}.`);
    lines.push(`Playhead bar ${toBar(tr.position)}${at ? " (" + at.name + ")" : ""}, ${tr.recording ? "recording" : tr.playing ? "playing" : "stopped"}, loop ${tr.looping ? "on bars " + toBar(s.loopStart || 0) + "-" + toBar(s.loopEnd || 0) : "off"}${s.click ? ", click on" : ""}.`);
    if (secs.length) lines.push("Sections: " + secs.map((x) => `${x.name} ${toBar(x.start)}-${toBar(x.end)}`).join(", ") + ".");
    else lines.push("No sections yet.");
    if (s.master) lines.push(`Master (lane "master": effects there go on the whole song, then a fixed safety limiter): vol ${Math.round((s.master.volume || 0) * 10) / 10} dB, fx ${
      s.master.plugins.map((p) => p.name + (p.enabled === false ? " (off)" : "")).join("+") || "none"}.`);
    lines.push("Lanes:");
    for (const t of s.tracks || []) {
      const flags = [t.role, t.volume && `vol ${Math.round(t.volume * 10) / 10} dB`, t.armed && "armed", t.muted && "muted", t.solo && "solo", t.instrument && "instrument " + t.instrument,
        (t.plugins || []).length && "lane fx " + t.plugins.map((p) => p.name + (p.enabled === false ? " (off)" : "")).join("+")].filter(Boolean).join(", ");
      const clips = t.clips.slice(0, 14).map((c) => {
        const fx = (c.plugins || []).map((p) => p.name + (p.enabled === false ? " (off)" : "")).join("+");
        return `${c.id} "${c.name}" bars ${toBar(c.start)}-${toBar(c.start + c.length)}${c.gain ? `, gain ${Math.round(c.gain * 10) / 10} dB` : ""}${c.takes > 1 ? `, take ${c.take + 1}/${c.takes}` : ""}${fx ? ", fx " + fx : ""}`;
      });
      lines.push(`- ${t.name} [${flags}]: ${clips.join("; ") || "empty"}${t.clips.length > 14 ? `; +${t.clips.length - 14} more` : ""}`);
    }
    const sel = ui.selectedClip && allClips().find((c) => c.id === ui.selectedClip);
    if (sel) {
      lines.push(`Selected clip: ${sel.id} "${sel.name}" on ${sel.track.name}.`);
      for (const p of sel.plugins || [])
        if ((p.params || []).length) lines.push(`  ${p.name}: ` + p.params.map((k) => `${k.name} ${Math.round(k.value * 100)}% (${k.text})`).join(", "));
    } else lines.push("No clip selected.");
    if ((s.chains || []).length) lines.push("Presets: " + s.chains.map((c) => `${c.name} (${c.plugins})`).join(", ") + ".");
    const libItems = window.killtoyLibrary ? window.killtoyLibrary.items() : [];
    if (libItems.length) lines.push(`Library: ${libItems.length} sounds from ${[...new Set(libItems.map((x) => x.song).filter(Boolean))].join(", ")} (use library_sound).`);
    if (pluginCache) lines.push("Plugins: " + pluginCache.map((p) => p.name + (p.instrument ? " (instrument)" : "")).join(", ") + ".");
    const jobs = (s.jobs || []).filter((j) => !j.finished);
    if (jobs.length) lines.push("Running: " + jobs.map((j) => `${j.label} ${Math.round(j.progress * 100)}%`).join(", ") + ".");
    return lines.join("\n");
  }

  const RULES = [
    "You are the assistant inside KILLTOY, Eman's vocal-recording app. Eman is a producer, not a programmer, and talks to you by voice while working, like talking to an engineer in the studio.",
    "Do what Eman says right away with the tools. Never ask for permission: everything is undoable. Only ask a short question when you truly can't tell what they mean.",
    "Positions are bars, counted from 1. \"That word\", \"this part\", \"here\" mean the selected clip or the spot at the playhead. \"The hook\" with no number means the next hook from the playhead.",
    "Write nothing before or between tool calls. When done, reply with ONE short spoken sentence, casual, at most 12 words, no markdown, no lists, no ids. Often a few words is best (\"Looped the hook.\").",
    "If the words weren't meant for you (singing, lyrics, talking to someone else, a half sentence, noise), call no tools and reply with exactly: -",
    "Some actions may already have been done instantly while Eman was talking; they're listed. Don't do them again.",
    "KILLTOY's own effects: Pump = sidechain pumping in time (\"make it pump\", \"duck it\"), Chop Pitch = pitch a voice up/down or change its character (\"pitch it up an octave\" = Pitch +12 st, knob 100%; 0 st is 50%), Space = big lush reverb, Crush = lo-fi bitcrusher, Loud = make it loud without going over (\"master it\", \"limit it\"). Prefer these when Eman asks for that kind of sound. Squash = OTT-style multiband (\"OTT it\", \"make it brighter and in your face\"), Punch = more or less attack on drums (\"more snap\", \"shorter tail\"). SC Clip = a soft clipper that goes on almost any sound (\"clip it\", \"SC Clip on the bass\", \"stop the drums spiking\", \"make room in the mix\"); a few dB shaves the spikes so the layer sits lower, pushed hard (Drive 50%+, Shape low) it's a gritty distortion for bass and 808s. TUNR = KILLTOY's own Auto-Tune: \"tune the vocal\" = add TUNR to that lane, natural (Speed 50%, Humanize 25%); \"hard tune it\" / \"T-Pain it\" = Speed 100%, Humanize 0%. Formant moves the voice's character (50% = none). The vocal_tool \"tune\" is the note editor for fixing single notes by hand; use TUNR for the sound.",
    "To change a sound that's already there (\"make the vocal darker\", \"a woman's voice\", \"different hi-hat\", \"snare instead of clap\", \"make a variation of the 808\") use the variation tool: the new version loads in a row under the lane and the original keeps playing.",
    "When you add or make a sound (\"add a distorted bass\"), keep the audio itself dry: only what's needed to create the raw sound goes inside it. The effects that shape it (distortion, saturation, compression, sidechain, reverb, delay, clipping) go on its lane with the effect tool, switched on, so Eman can see them in the strip and turn them off or swap them.",
  ].join("\n");

  // -------------------------------------------------------------------------
  // Brains: the claude.ai artifact's Claude (no key needed), or the Anthropic API.
  let samplePromise = null;
  function getSample() {
    if (!samplePromise) {
      let c = window.claude;
      try { if (!c && window.parent !== window) c = window.parent.claude; } catch (e) { /* other origin */ }
      samplePromise = c && c.use ? c.use("sample").catch(() => null) : Promise.resolve(null);
    }
    return samplePromise;
  }

  const KEY_STORE = "killtoy.anthropicKey";
  const MODEL_STORE = "killtoy.model";
  const store = {
    get: (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* private mode */ } },
  };

  async function askSample(sample, userText, signal) {
    const turns = [{ role: "user", content: RULES }, ...A.turns.slice(-8), { role: "user", content: userText }];
    const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.schema,
      execute: async (input, ctx) => { if (ctx && ctx.signal && ctx.signal.aborted) throw new Error("Stopped."); A.busy && (A.busy.acted = true); return await runTool(t.name, input); } }));
    const r = await sample(turns, { tools, modelTier: "quick", signal, onText: () => setMode("thinking") });
    const parts = String(r.text || "").trim().split(/\n\s*\n/);
    return parts[parts.length - 1].trim();
  }

  async function askApi(key, userText, signal) {
    const model = store.get(MODEL_STORE) || "claude-sonnet-5-5";
    const messages = [...A.turns.slice(-8), { role: "user", content: userText }];
    const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema }));
    tools[tools.length - 1].cache_control = { type: "ephemeral" };
    for (let round = 0; round < 8; round++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model, max_tokens: 400, system: RULES, tools, messages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 401 ? "That API key didn't work." : (data.error && data.error.message) || "Claude didn't answer (" + res.status + ").");
      messages.push({ role: "assistant", content: data.content });
      const uses = (data.content || []).filter((b) => b.type === "tool_use");
      if (data.stop_reason !== "tool_use" || !uses.length)
        return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
      if (A.busy) A.busy.acted = true;
      const results = [];
      for (const u of uses) {
        let content, is_error = false;
        try { content = String(await runTool(u.name, u.input)); } catch (e) { content = "Error: " + e.message; is_error = true; }
        results.push({ type: "tool_result", tool_use_id: u.id, content, is_error });
      }
      messages.push({ role: "user", content: results });
    }
    return "Done.";
  }

  async function think(text, doneAlready) {
    const sample = await getSample();
    const key = store.get(KEY_STORE);
    if (!sample && !key) { askForKey(); throw new Error("Paste your Claude key first: logo menu, Claude key."); }
    if (!pluginCache) await plugins().catch(() => null);
    await fresh();
    const userText = `${snapshot()}\n\n${doneAlready.length ? "Already done instantly: " + doneAlready.join(" ") + "\n" : ""}Eman said: "${text}"`;
    const ctl = new AbortController();
    A.busy = { ctl, text, acted: false };
    setMode("thinking");
    try {
      let reply;
      if (sample) {
        try { reply = await askSample(sample, userText, ctl.signal); }
        catch (e) {
          if (e && e.code === "cancelled") throw e;
          if (!key) throw new Error(e && e.code === "not_granted" ? "Allow Claude for this page to use the assistant." : (e && e.message) || "Claude didn't answer.");
          reply = await askApi(key, userText, ctl.signal);
        }
      } else reply = await askApi(key, userText, ctl.signal);
      A.turns.push({ role: "user", content: `Eman said: "${text}"` }, { role: "assistant", content: reply || "-" });
      return reply;
    } finally {
      if (A.busy && A.busy.ctl === ctl) A.busy = null;
    }
  }

  // -------------------------------------------------------------------------
  // Quick lane: clear commands run as soon as they're heard, no waiting for Claude.
  const FILLER = /^(ok(ay)?|yo|hey|uh+|um+|so|now|alright|right|yeah|please|just|can you|could you|let s|lets|go ahead and|and|then)\b\s*/;
  function clean(s) {
    let t = norm(s).replace(/\bplease\b/g, "").trim();
    for (let i = 0; i < 4; i++) t = t.replace(FILLER, "").trim();
    return t;
  }

  let quickVerb = ""; // "mute the double and the adlibs": the second part reuses "mute"
  async function quick(clause) {
    const c = clean(clause);
    if (!c) return null;
    let m;
    if ((m = /^(make|give me|do|try) (me )?(a|another|one more|a new) variation (of|on|for) (the )?(.+)$/.exec(c)) && window.ktVariations) {
      return await window.ktVariations.make(m[6], "");
    }
    if (/^(play|play it|play that|start|start it|go|run it|run it back|(play it |play |take it |start |start it )?from the (top|beginning|start))$/.test(c)) {
      let t = await tr();
      if (/top|beginning|start$|run it back/.test(c) && c !== "start") { if (t.playing) await cmd("togglePlay"); await jumpTo(0); t = { playing: false }; }
      if (!t.playing) await cmd("togglePlay");
      return "Playing.";
    }
    if (/^(stop|pause|stop it|stop playing|cut it|kill it)$/.test(c)) {
      stopVoice();
      const t = await tr();
      if (t.playing || t.recording) await cmd(t.recording ? "toggleRecord" : "togglePlay");
      return "Stopped.";
    }
    if (/^(go |jump |skip )?back to the (top|start|beginning)$|^(go|jump|skip) to the (top|start|beginning)$/.test(c)) { await jumpTo(0); return "Top."; }
    if (/^(undo|undo that|take that back|never mind|nevermind)$/.test(c)) { await undoLast("undo", 1); return "Undone."; }
    if (/^(redo|redo that)$/.test(c)) { await cmd("redo"); return "Redone."; }
    if (/^(loop off|stop (the )?loop(ing)?|turn (the )?loop off|no loop)$/.test(c)) { await cmd("setLooping", { on: false }); return "Loop off."; }
    if (/^(the )?(click|metronome) (on|off)$|^(turn|switch|put) (on|off) (the )?(click|metronome)$|^(turn|switch|put) (the )?(click|metronome) (on|off)$/.test(c)) {
      const on = /\bon\b/.test(c);
      if (on !== !!st().click) await cmd("toggleClick");
      return "Click " + (on ? "on." : "off.");
    }
    if ((m = c.match(/^(play it from|play from|start from|go back to|go to|jump to|take me to|skip to|loop|play)( the)? (.+)$/))) {
      const bar = /^bar (\d+(?:\.\d+)?)$/.exec(m[3]);
      const s = bar ? (m[1] === "loop" ? null : { name: "Bar " + bar[1], start: toSec(bar[1]) }) : findSection(m[3]);
      if (s) {
        if (m[1] === "loop") { await loopRange(s.start, s.end, true); return `Looping ${s.name}.`; }
        const playing = (await tr()).playing;
        if (playing) await cmd("togglePlay");
        await jumpTo(s.start);
        if (/play|start/.test(m[1]) || playing) await cmd("togglePlay");
        return `${s.name}.`;
      }
    }
    if ((m = c.match(/^(mute|unmute|solo|unsolo)( the)? (.+)$/))) {
      const t = findLane(m[3]);
      if (t) {
        const want = !m[1].startsWith("un");
        if (/mute/.test(m[1]) && want !== !!t.muted) await cmd("toggleMute", { trackId: t.id });
        if (/solo/.test(m[1]) && want !== !!t.solo) await cmd("toggleSolo", { trackId: t.id });
        quickVerb = m[1];
        return `${m[1][0].toUpperCase() + m[1].slice(1)}d ${t.name}.`.replace("Solod", "Soloed").replace("Unsolod", "Unsoloed");
      }
    }
    if ((m = c.match(/^(pull up|bring up|open( up)?|load( up)?|show me|give me)( the| a| an| my)? (.+)$/))) {
      const name = m[m.length - 1].replace(/ (plugin|synth|window)$/, "");
      const list = await plugins();
      const p = matchPlugin(list, name);
      if (p && (squash(p.name).startsWith(squash(name)) || squash(name).startsWith(squash(p.name)))) return await openPlugin(p.name);
    }
    // SC Clip by name: "clip it", "SC Clip on the bass", "clip the drums", "put a clipper on the 808".
    if ((m = c.match(/^(?:soft )?clip (it|that|this|the (.+))$|^(?:put |add |throw |slap |stick )?(?:an? |the )?(?:s ?c|see|ess) ?clip(?:per)?(?: (?:on|to) (?:it|that|this|the (.+)|(.+)))?$|^(?:put |add |throw |slap |stick )(?:an? |the )?(?:soft )?clipper(?: (?:on|to) (?:it|that|this|the (.+)|(.+)))?$/))) {
      const laneWords = m[2] || m[3] || m[4] || m[5] || m[6];
      const t = laneWords && findLane(laneWords);
      if (laneWords && !t) return null;   // not a lane we know: leave it to the full assistant
      await fresh();
      let host;
      const lane = t || (!ui.selectedClip && ui.selectedTrack && findLane(ui.selectedTrack));   // "clip it" with a lane picked
      try { host = lane ? { lane, name: lane.name, plugins: lane.plugins || [], target: { trackId: lane.id } } : fxHost(); } catch (e) { return null; }
      if (host.plugins.filter((p) => !p.instrument).length >= 5) return null;
      const fx = await addEffect(host, "SC Clip");
      return `${fx ? fx.name : "SC Clip"} on ${host.name}.`;
    }
    // "Tune the vocal", "hard tune it", "auto-tune the adlibs": TUNR on that lane (or the
    // selected clip), natural or robotic. If it's already there, only the feel changes.
    if ((m = c.match(/^(?:put |add )?(hard |robot |natural |soft |light )?(?:auto ?tune|snap tune|tunr|tuner|tune|t ?pain)(?: on)?(?: (it|that|this|the (.+?)))?( hard| natural| robotic| soft)?$/))) {
      const hard = /hard|robot/.test((m[1] || "") + (m[4] || "")) || /t ?pain/.test(c);
      await fresh();
      const laneWords = m[3] && !/^(clip|vocal clip|word|part)$/.test(m[3]) ? m[3] : null;
      if (laneWords && !findLane(laneWords)) return null;   // "tune the vocal in the hook": Claude works it out
      // No lane named: the picked clip or lane, else the lead vocal.
      const sel = !laneWords && selectedRackClip();
      const host = laneWords ? fxHost(null, laneWords)
        : sel && sel.track && sel.track.kind !== "beat" ? { lane: sel.lane ? sel.track : null, name: sel.name, plugins: sel.plugins || [], target: fxTarget(sel) }
        : fxHost(null, "lead");
      const feel = hard ? { speed: 100, humanize: 0 } : { speed: 50, humanize: 25 };
      const have = (host.plugins || []).find((p) => p.type === "ktsnaptune");
      if (have) { for (const [k, v] of Object.entries(feel)) await setKnob(have, k, v, false); }
      else await addEffect(host, "tunr", feel);
      return `${hard ? "Hard tune" : "Tuned"} on ${host.name}.`;
    }
    if (/^(record|start recording|let s record|lets record|record me|punch in)$/.test(c)) { if (!(await tr()).recording) await cmd("toggleRecord"); return "Recording."; }
    return null;
  }

  // -------------------------------------------------------------------------
  // One utterance from first word to end of turn.
  const T = { text: "", finals: "", interim: "", lastAt: 0, lastFinal: false, fired: new Set(), done: [], timer: 0, ptt: false };
  // Endings that mean more is coming. Fillers and "the/and/to..." wait long; "on", "that",
  // "this" often end a sentence ("turn the click on", "loop that"), so they wait less.
  const CONTINUE = /\b(and|then|the|a|an|to|with|of|for|from|so|but|or|um+|uh+|er|like|maybe|also|my|your|put|add|make|can you|could you|is|at)$/;
  const MAYBE_MORE = /\b(on|that|this|it|in|up|down|off)$/;
  const SEP = /\s*(?:,|\.|\band then\b|\bthen\b|\band also\b|\band\b|\balso\b)\s*/;

  function resetTurn() {
    T.text = T.finals = T.interim = ""; T.fired = new Set(); T.done = []; T.lastFinal = false; T.verb = ""; T.quietScan = false;
  }

  // Run quick commands for every finished clause ("pull up serum and ..." fires on "and").
  async function scanClauses(final) {
    const clauses = T.text.split(SEP).map((x) => x.trim()).filter(Boolean);
    const endsOpen = !final && !SEP.test(T.text.slice(-6));
    for (let i = 0; i < clauses.length; i++) {
      const last = i === clauses.length - 1;
      if (last && endsOpen && Date.now() - T.lastAt < 350) continue; // still being said
      const key = clean(clauses[i]);
      if (!key || T.fired.has(key)) continue;
      T.fired.add(key);
      // A bare lane name right after "mute ..."/"solo ..." gets the same verb.
      const text = T.verb && key.split(" ").length <= 3 && !/^(loop|play|go|stop|open|pull|bring|turn|put|add|make|record|cut|undo|redo|click|un)/.test(key) && findLane(key) ? T.verb + " " + key : clauses[i];
      quickVerb = "";
      try {
        const out = /^(undo|redo)/.test(key) || /never ?mind|take that back/.test(key) ? await quick(text) : await counted(() => quick(text));
        T.verb = out ? quickVerb : "";
        if (out) { T.done.push(out); T.quickKeys = (T.quickKeys || new Set()).add(key); did(out); }
      } catch (e) { did(e.message); }
    }
  }

  function onSpeech(finals, interim) {
    if (!T.text) { A.log = []; A.reply = ""; } // a new turn starts with a clean bubble
    T.finals = finals; T.interim = interim; T.text = (finals + " " + interim).trim();
    T.lastAt = Date.now(); T.lastFinal = !interim; T.quietScan = false;
    A.heard = T.text;
    if (speaking()) stopVoice(); // Eman talks: the voice stops (its own echo never gets here)
    if (A.mode !== "thinking" && A.mode !== "acting" && A.mode !== "speaking") setMode("listening");
    renderBubble();
    scanClauses(!interim); // a final result means the last clause is complete
    clearTimeout(T.timer);
    if (!T.ptt) T.timer = setTimeout(checkEnd, 120);
  }

  function checkEnd() {
    if (!T.text) return;
    const quiet = Date.now() - T.lastAt;
    const t = norm(T.text);
    // A short pause is enough to run a clear quick command that is still only a partial result.
    if (quiet >= 350 && !T.quietScan) { T.quietScan = true; scanClauses(false); }
    const wait = CONTINUE.test(t) ? 1600 : MAYBE_MORE.test(t) ? (T.lastFinal ? 800 : 1000) : T.lastFinal ? 450 : 750;
    if (quiet >= wait) endTurn();
    else T.timer = setTimeout(checkEnd, 80);
  }

  async function endTurn(typed) {
    clearTimeout(T.timer);
    if (typed != null) { resetTurn(); T.text = typed; T.lastAt = 0; A.heard = typed; A.log = []; A.reply = ""; }
    const text = T.text.trim();
    if (!text) return;
    await scanClauses(true);
    const done = T.done.slice();
    const keys = T.quickKeys || new Set();
    const rest = text.split(SEP).map(clean).filter((x) => x && !keys.has(x) && !/^(and|then|wait|hold on|ok|okay|thanks|thank you)$/.test(x));
    resetTurn(); T.quickKeys = null;
    ears.consume(); // the next turn starts after these words
    if (!rest.length) { setMode(A.live ? "listening" : "idle"); return; }

    // Still working on the last thing? Merge if nothing was done yet, else queue.
    if (A.busy) {
      if (!A.busy.acted) { A.busy.ctl.abort(); A.queue.push({ text: A.busy.text + " " + text, done }); return; }
      A.queue.push({ text, done });
      return;
    }
    await handle(text, done);
  }

  async function handle(text, done) {
    A.reply = "";
    try {
      const reply = await counted(() => think(text, done));
      // Eman already talking again: show the answer, don't say it over them.
      if (reply && reply !== "-" && !A.queue.length) { A.reply = reply; if (T.text) setMode("listening"); else say(reply); }
      else setMode(A.live ? "listening" : "idle");
    } catch (e) {
      if (!(e && (e.code === "cancelled" || e.name === "AbortError"))) { A.reply = (e && e.message) || "Something went wrong."; if (!T.text) say(A.reply); }
    }
    renderBubble();
    const next = A.queue.shift();
    if (next) await handle(next.text, next.done);
  }

  // -------------------------------------------------------------------------
  // Ears: streaming speech-to-text.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // One recognition session runs for as long as the mic is on (no restarts between turns,
  // so no words are lost). Each turn starts after the results the last turn used (rec.base).
  // Words that are only the assistant's own voice coming back through the speakers are
  // dropped (rec.echo), so they neither stop the voice nor become a turn.
  const ears = {
    rec: null, on: false, blocked: false, live: new Set(),
    start() {
      if (!SR || this.blocked) return false;
      if (this.rec) return true;
      const rec = new SR();
      rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.base = 0; rec.len = 0; rec.echo = new Set(); rec.waiters = []; rec.cut = null; rec.lastText = "";
      rec.onresult = (e) => {
        rec.len = e.results.length;
        const lastR = e.results[e.results.length - 1];
        rec.lastText = lastR && !lastR.isFinal ? lastR[0].transcript : "";
        let finals = "", interim = "";
        for (let i = rec.base; i < e.results.length; i++) {
          const r = e.results[i];
          let t = r[0].transcript;
          // The words of this result that an earlier turn already used.
          if (rec.cut && rec.cut.i === i) t = t.split(/\s+/).filter(Boolean).slice(rec.cut.words).join(" ");
          if (!t.trim()) continue;
          if (rec.echo.has(i)) continue;
          if (isEcho(t)) { if (r.isFinal) rec.echo.add(i); continue; }
          if (r.isFinal) finals += t + " "; else interim += t;
        }
        if (ui.transport.recording) { rec.base = rec.len; return; } // singing a take isn't talking to me
        if (!finals.trim() && !interim.trim()) return;
        onSpeech(finals.trim(), interim.trim());
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          this.blocked = true; setLive(false);
          toast("The microphone is blocked here. Type to the assistant instead, or press Fn twice to dictate.", true);
        }
      };
      rec.onend = () => {
        this.live.delete(rec);
        rec.waiters.forEach((f) => f());
        if (this.rec === rec) this.rec = null;
        if (this.on && !this.blocked) setTimeout(() => this.on && this.start(), 60);
      };
      try { rec.start(); this.rec = rec; this.live.add(rec); return true; } catch (e) { this.rec = null; return false; }
    },
    // Stops listening. Resolves once the last words are in (the final result comes after stop()).
    stop() {
      this.on = false;
      const rec = this.rec;
      this.rec = null;
      if (!rec) return Promise.resolve();
      return new Promise((done) => {
        rec.waiters.push(done);
        setTimeout(done, 1500); // never hang on a session that doesn't end
        try { rec.stop(); } catch (e) { done(); }
      });
    },
    // The turn used everything heard so far. A result still in progress keeps its index (more
    // words can join it), so only the words beyond the used ones count next time.
    consume() {
      for (const rec of this.live) {
        const words = rec.lastText.split(/\s+/).filter(Boolean).length;
        if (words) { rec.base = rec.len - 1; rec.cut = { i: rec.len - 1, words }; } else { rec.base = rec.len; rec.cut = null; }
      }
    },
  };

  // The assistant hearing itself: nothing but words it is saying (or just said).
  function isEcho(text) {
    if (!speaking() && Date.now() - spokeAt > 1200) return false;
    const words = norm(text).split(" ").filter(Boolean);
    const fresh2 = words.filter((w) => !spokenWords.has(w));
    if (fresh2.some((w) => /^(stop|wait|no|nope|hold|hey|quiet|shh+|enough|shut)$/.test(w))) return false;
    return fresh2.length < 2;
  }

  function setLive(on) {
    A.live = on && !!SR && !ears.blocked;
    let stopped = Promise.resolve();
    if (A.live) { ears.on = true; ears.start(); } else stopped = ears.stop();
    $av.classList.toggle("live", A.live);
    setMode(A.live ? "listening" : "idle");
    renderBubble();
    return stopped;
  }

  // -------------------------------------------------------------------------
  // Voice: speechSynthesis, cut short the moment Eman talks.
  let voice = null, spokenWords = new Set();
  function pickVoice() {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const en = vs.filter((v) => /^en(-|_|$)/i.test(v.lang));
    const pref = ["Samantha (Enhanced)", "Ava (Premium)", "Zoe (Premium)", "Evan (Enhanced)", "Samantha", "Google US English", "Microsoft Aria Online (Natural) - English (United States)", "Daniel"];
    voice = pref.map((n) => en.find((v) => v.name === n)).find(Boolean) || en.find((v) => /natural|premium|enhanced/i.test(v.name)) || en[0] || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  const speaking = () => A.mode === "speaking";
  let spokeAt = 0; // when the voice last stopped, for telling its echo from Eman

  function say(text) {
    renderBubble();
    if (!window.speechSynthesis || !text) { setMode(A.live ? "listening" : "idle"); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\bKILLTOY\b/g, "kill toy"));
    if (voice) u.voice = voice;
    u.rate = 1.07; u.pitch = 1.0;
    spokenWords = new Set(norm(text).split(" "));
    u.onboundary = () => bump(true);
    u.onend = u.onerror = () => { spokeAt = Date.now(); if (A.mode === "speaking") setMode(A.live ? "listening" : "idle"); };
    setMode("speaking");
    speechSynthesis.speak(u);
  }

  function stopVoice() {
    if (A.mode === "speaking") spokeAt = Date.now();
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (A.mode === "speaking") setMode(A.live ? "listening" : "idle");
  }

  // -------------------------------------------------------------------------
  // Avatar + bubble
  const CSS = `
  .kt-ai { position: fixed; right: 22px; bottom: 22px; z-index: 60; display: flex; align-items: flex-end; gap: 10px; pointer-events: none; font: 12.5px/1.4 var(--font); }
  .kt-ai > * { pointer-events: auto; }
  .kt-av { width: 58px; height: 58px; border-radius: 19px; border: 0; padding: 0; cursor: pointer; position: relative; flex: none;
    background: radial-gradient(120% 90% at 30% 20%, #a77bff 0%, #8b5cf6 45%, #5b2fd0 100%);
    box-shadow: 0 10px 30px rgba(0,0,0,.45), inset 0 -4px 10px rgba(0,0,0,.25), inset 0 2px 4px rgba(255,255,255,.25);
    transition: transform .35s var(--ease), box-shadow .3s; animation: ktBob 4.6s ease-in-out infinite; }
  .kt-av:hover { transform: translateY(-2px) scale(1.04); }
  .kt-av:focus-visible { outline: 2px solid var(--acid); outline-offset: 3px; }
  .kt-av .ring { position: absolute; inset: -6px; border-radius: 24px; border: 2px solid var(--acid); opacity: 0; transition: opacity .25s; }
  .kt-av.live .ring { opacity: .35; }
  .kt-av.listening.live .ring { animation: ktRing 1.6s ease-out infinite; }
  .kt-av .eyes { position: absolute; left: 0; right: 0; top: 19px; display: flex; justify-content: center; gap: 12px; transition: transform .3s var(--ease); }
  .kt-av .eye { width: 9px; height: 13px; border-radius: 6px; background: var(--acid); box-shadow: 0 0 10px rgba(228,255,58,.6); animation: ktBlink 5.2s infinite; transition: height .2s, width .2s, border-radius .2s; }
  .kt-av .mouth { position: absolute; left: 50%; bottom: 12px; width: 14px; height: 3px; margin-left: -7px; border-radius: 3px; background: rgba(20,10,40,.75); transition: height .08s, width .2s; }
  .kt-av.listening .eye { height: 15px; width: 10px; }
  .kt-av.thinking .eyes { transform: translate(5px, -3px); }
  .kt-av.thinking .eye { height: 7px; border-radius: 4px; animation: none; }
  .kt-av.thinking .dots { opacity: 1; }
  .kt-av .dots { position: absolute; top: -9px; right: -6px; display: flex; gap: 3px; opacity: 0; transition: opacity .2s; }
  .kt-av .dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--acid); animation: ktDot 1s infinite; }
  .kt-av .dots i:nth-child(2) { animation-delay: .15s; } .kt-av .dots i:nth-child(3) { animation-delay: .3s; }
  .kt-av.speaking .mouth { width: 16px; margin-left: -8px; }
  .kt-av.acting { animation: ktNod .45s var(--ease); }
  .kt-av.bump { transform: scale(1.07); }
  .kt-bub { max-width: 330px; min-width: 0; background: var(--pop); color: var(--ink); border-radius: 14px; padding: 9px 12px; box-shadow: var(--shadow);
    border: 1px solid var(--line-2); display: none; flex-direction: column; gap: 5px; }
  .kt-ai.open .kt-bub { display: flex; }
  .kt-bub .heard { color: var(--ink-2); font-style: italic; }
  .kt-bub .heard:empty, .kt-bub .reply:empty, .kt-bub .acts:empty { display: none; }
  .kt-bub .acts { display: flex; flex-wrap: wrap; gap: 4px; }
  .kt-bub .acts span { background: rgba(228,255,58,.12); color: var(--acid); border-radius: 999px; padding: 1px 8px; font-size: 11.5px; }
  .kt-bub .reply { font-weight: 500; }
  .kt-bub .row { display: flex; gap: 6px; align-items: center; }
  .kt-bub input { flex: 1; min-width: 0; font: inherit; color: var(--ink); background: var(--fill); border: 1px solid var(--line-2); border-radius: 8px; padding: 5px 8px; outline: none; }
  .kt-bub input:focus { border-color: var(--acid); }
  .kt-bub .tip { color: var(--ink-3); font-size: 11px; }
  .kt-bub button { font: inherit; color: var(--ink-2); background: transparent; border: 1px solid var(--line-2); border-radius: 8px; padding: 4px 8px; cursor: pointer; }
  .kt-bub button.on { color: #111; background: var(--acid); border-color: var(--acid); }
  .kt-plug { position: fixed; z-index: 70; left: 50%; top: 46%; width: 620px; max-width: calc(100vw - 40px); transform: translate(-50%, -50%);
    background: linear-gradient(#2a2d36, #1b1d23); border-radius: 12px; box-shadow: 0 30px 90px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08); overflow: hidden; }
  .kt-plug .bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #111318; color: var(--ink-2); font-weight: 600; letter-spacing: .04em; }
  .kt-plug .bar button { background: none; border: 0; color: var(--ink-2); font-size: 15px; cursor: pointer; }
  .kt-plug .body { padding: 20px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }
  .kt-plug .knob { aspect-ratio: 1; border-radius: 50%; background: conic-gradient(#38bdf8 var(--v), #2b2f3a 0); position: relative; }
  .kt-plug .knob::after { content: ""; position: absolute; inset: 18%; border-radius: 50%; background: #1b1d23; }
  .kt-plug .lbl { text-align: center; color: var(--ink-3); font-size: 10.5px; margin-top: 4px; }
  .kt-plug .wave { grid-column: span 3; height: 70px; border-radius: 8px; background: #0f1115; position: relative; overflow: hidden; }
  .kt-plug .wave::after { content: ""; position: absolute; inset: 10px; background: repeating-linear-gradient(90deg, transparent 0 6px, rgba(56,189,248,.5) 6px 8px); clip-path: polygon(0 50%, 10% 10%, 20% 80%, 35% 20%, 50% 70%, 65% 15%, 80% 85%, 100% 50%, 100% 100%, 0 100%); }
  .kt-plug .note { grid-column: span 6; color: var(--ink-3); font-size: 11px; text-align: center; }
  @keyframes ktBob { 0%,100% { translate: 0 0; } 50% { translate: 0 -3px; } }
  @keyframes ktBlink { 0%, 94%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.1); } }
  @keyframes ktRing { 0% { transform: scale(.92); opacity: .55; } 100% { transform: scale(1.18); opacity: 0; } }
  @keyframes ktDot { 0%, 100% { transform: translateY(0); opacity: .5; } 50% { transform: translateY(-4px); opacity: 1; } }
  @keyframes ktNod { 0% { translate: 0 0; } 40% { translate: 0 4px; } 100% { translate: 0 0; } }
  @media (prefers-reduced-motion: reduce) { .kt-av, .kt-av .eye, .kt-av .ring, .kt-av .dots i { animation: none !important; } }
  `;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  const $root = document.createElement("div");
  $root.className = "kt-ai";
  $root.innerHTML = `
    <div class="kt-bub" role="log" aria-live="polite">
      <div class="heard"></div>
      <div class="acts"></div>
      <div class="reply"></div>
      <div class="row"><input type="text" placeholder="Type, or just talk\u2026" aria-label="Tell the assistant"><button class="mic" title="Hands-free: listens until you turn it off">Mic</button></div>
      <div class="tip"></div>
    </div>
    <button class="kt-av idle" aria-label="Assistant: press Caps Lock or click to talk" title="Caps Lock = talk"><span class="ring"></span><span class="dots"><i></i><i></i><i></i></span><span class="eyes"><span class="eye"></span><span class="eye"></span></span><span class="mouth"></span></button>`;
  document.body.append($root);
  const $av = $root.querySelector(".kt-av");
  // Sit just above the effects rack, so nothing in it is covered.
  const place = () => { const r = document.querySelector(".rack"); $root.style.bottom = (r && r.offsetHeight ? r.offsetHeight + 14 : 22) + "px"; };
  place();
  window.addEventListener("resize", place);
  if (window.ResizeObserver && document.querySelector(".rack")) new ResizeObserver(place).observe(document.querySelector(".rack"));
  const $input = $root.querySelector("input");
  const $mic = $root.querySelector(".mic");
  const $tip = $root.querySelector(".tip");

  function setMode(m) {
    A.mode = m;
    $av.classList.remove("idle", "listening", "thinking", "speaking", "acting");
    $av.classList.add(m);
    if (window.ktAvatar) window.ktAvatar.mode(m, A.live); // the 3D character (avatar.js)
    if (m === "acting") { void $av.offsetWidth; setTimeout(() => A.mode === "acting" && setMode(A.busy ? "thinking" : A.live ? "listening" : "idle"), 450); }
  }

  let bumpTimer;
  function bump(mouth) {
    if (mouth) {
      if (window.ktAvatar) window.ktAvatar.word();
      const mo = $av.querySelector(".mouth");
      mo.style.height = 3 + Math.round(Math.random() * 7) + "px";
      clearTimeout(bumpTimer);
      bumpTimer = setTimeout(() => (mo.style.height = ""), 140);
      return;
    }
    $av.classList.add("bump");
    setTimeout(() => $av.classList.remove("bump"), 160);
  }

  function renderBubble() {
    $root.querySelector(".heard").textContent = A.heard ? "\u201c" + A.heard + "\u201d" : "";
    const acts = $root.querySelector(".acts");
    acts.replaceChildren(...A.log.slice(-4).map((t) => { const s = document.createElement("span"); s.textContent = "\u2713 " + t; return s; }));
    $root.querySelector(".reply").textContent = A.reply;
    $mic.classList.toggle("on", A.live);
    $mic.hidden = !SR || ears.blocked;
    $tip.textContent = !SR || ears.blocked ? "No mic here: type, or press Fn twice to dictate."
      : A.live ? (A.caps ? "Listening. Caps Lock off to stop." : "Listening. Click me to stop.")
      : "Caps Lock on to talk, off to stop. Or click me.";
  }

  function openBubble(on) {
    $root.classList.toggle("open", on);
    if (on) renderBubble();
  }

  $av.onclick = (e) => {
    e.stopPropagation();
    const opening = !$root.classList.contains("open");
    openBubble(true);
    if (SR && !ears.blocked) setLive(opening ? true : !A.live);
    else $input.focus();
    if (!opening && !A.live) setTimeout(() => !A.live && openBubble(false), 1500);
    getSample(); // warms up the claude.ai connection
  };
  $mic.onclick = (e) => { e.stopPropagation(); setLive(!A.live); };
  $root.addEventListener("click", (e) => e.stopPropagation());
  $input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && $input.value.trim()) { endTurn($input.value.trim()); $input.value = ""; }
    if (e.key === "Escape") { $input.blur(); openBubble(false); }
  });

  // Caps Lock is the talk key: Caps Lock on = the mic is on (the key's light shows it), off =
  // the mic is off and whatever was just said is sent right away. macOS only reports Caps Lock
  // as on/off, never as held, so it works as a switch everywhere. Holding T also works.
  let capsSeen = false;
  function setCaps(on) {
    if (on === A.caps) return;
    A.caps = on;
    openBubble(true);
    if (on) { stopVoice(); setLive(true); return; }
    // Mic off: wait for the last words (they arrive just after the mic stops), then send.
    setLive(false).then(() => {
      if (T.text) endTurn();
      else setTimeout(() => !A.live && !A.busy && openBubble(false), 2500);
    });
  }
  const capsKey = (e) => {
    if (e.key !== "CapsLock" || !e.getModifierState) return;
    capsSeen = true;
    if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.target !== $input) return;
    if (!SR || ears.blocked) { openBubble(true); $input.focus(); return; }
    setCaps(e.getModifierState("CapsLock"));
  };
  window.addEventListener("keydown", capsKey);
  window.addEventListener("keyup", capsKey);
  // Caps Lock switched while the window wasn't listening: catch up on the next key or click.
  const capsSync = (e) => { if (capsSeen && e.key !== "CapsLock" && e.getModifierState && SR && !ears.blocked) setCaps(e.getModifierState("CapsLock")); };
  window.addEventListener("keydown", capsSync, true);
  window.addEventListener("mousedown", capsSync, true);

  // Hold T to talk (push-to-talk): ends the turn the moment T is let go.
  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || (e.key !== "t" && e.key !== "T")) return;
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (!SR || ears.blocked) { openBubble(true); $input.focus(); e.preventDefault(); return; }
    T.ptt = true; openBubble(true); stopVoice();
    if (!A.live) { ears.on = true; ears.start(); }
    setMode("listening");
  });
  window.addEventListener("keyup", (e) => {
    if (!T.ptt || (e.key !== "t" && e.key !== "T")) return;
    T.ptt = false;
    // Let the last words land, then send.
    if (!A.live) setTimeout(() => ears.stop().then(() => endTurn()), 250);
    else setTimeout(endTurn, 350);
  });

  // A pretend plugin window for the playground (the app opens the real one).
  function showPluginWindow(name) {
    document.querySelectorAll(".kt-plug").forEach((n) => n.remove());
    const w = document.createElement("div");
    w.className = "kt-plug";
    const knobs = ["Osc A", "Osc B", "Filter", "Res", "Drive", "Env", "Attack", "Decay", "Sustain", "Release", "LFO", "Master"];
    w.innerHTML = `<div class="bar"><span></span><button aria-label="Close">\u2715</button></div>
      <div class="body"><div class="wave"></div><div class="wave"></div>${knobs.map((k) => `<div><div class="knob" style="--v:${20 + Math.round(Math.random() * 60)}%"></div><div class="lbl">${k}</div></div>`).join("")}
      <div class="note">Pretend window in the playground. In the app this is the real plugin.</div></div>`;
    w.querySelector(".bar span").textContent = name.toUpperCase();
    w.querySelector("button").onclick = () => w.remove();
    document.body.append(w);
  }

  // The logo menu's "Claude key..." row (app.js renderMoreSettings). The key stays in this
  // browser/app only. In the claude.ai playground no key is needed: the page uses claude.ai's Claude.
  function askForKey() {
    const pop = $("pop");
    pop.replaceChildren();
    const input = el("input");
    input.type = "password";
    input.placeholder = "sk-ant-...";
    input.value = store.get(KEY_STORE);
    input.onclick = (e) => e.stopPropagation();
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Escape") hidePop();
      if (e.key !== "Enter") return;
      hidePop();
      store.set(KEY_STORE, input.value.trim());
      toast(input.value.trim() ? "Saved your Claude key on this computer." : "Removed the Claude key.");
    };
    pop.append(el("div", "label", "Anthropic API key from console.anthropic.com (Enter to save)"), input);
    placePop($("logo"));
    input.focus();
  }

  // Eman clicking or typing in the app means the next "undo" is about that, not the assistant.
  const manual = (e) => { if (!(e.target instanceof Node && $root.contains(e.target)) && e.key !== "CapsLock" && e.key !== "t" && e.key !== "T") lastAct.steps = 0; };
  window.addEventListener("mousedown", manual, true);
  window.addEventListener("keydown", manual, true);

  // Recording stops the ears hearing the take; they come back after.
  booth.on("transport", (t) => {
    if (t.recording && ears.rec) { ears.wasOn = A.live; ears.stop(); }
    else if (!t.recording && ears.wasOn && !ears.rec) { ears.wasOn = false; ears.on = true; ears.start(); }
  });

  renderBubble();
  window.killtoyAssistant = { hasKey: () => !!store.get(KEY_STORE), askForKey, tools: TOOLS, runTool, snapshot, quick: (s) => quick(s), say: endTurn, A, onSpeech, setLive };
})();
