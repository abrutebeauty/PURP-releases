// Linked sounds, like linked patterns (Eman, 7 Nov 17:06): copies of a sound clip share ONE colour and
// ONE set of settings (effects and their knobs, volume, fades, reverse, tempo/key fit, name). Change one
// and every linked copy changes. MAKE UNIQUE on one clip or a whole selection makes ONE new version of
// the sound with one new colour (10 snares selected = 1 new version, not 10). Every version of a sound is
// listed when you click the clip's title; pick one to move the selected clips over to it.
//
// The data: c.link = the version (shared by its copies; was already used by replaceClipSound/unlinkClip),
// c.fam = the sound it came from (shared by all its versions), c.ver = the version's number (1, 2, ...).
// What a copy keeps for itself: where it is (start, row, lane), its length/offset trim, and its M (mute).
// Old flag: window.KT2_LINK_OLD = copies share only the sound file, like before.
(function () {
  const SHARED = ["name", "color", "gain", "level", "fadeIn", "fadeOut", "reversed", "src", "orig", "fit", "trimmed", "edit"];
  // the sound under the clip changed (fit, reverse render, audio editor): the copies take its length too
  const SOUND = ["src", "edit"];
  // commands that only read, or happen many times a second: no link work
  const SKIP = /^(get|list|preview|laneMeter|toyMachineMeter|toyMachineNote|toyMachineBend|toyMachineWheel|killDrumHit|killDrumPeaks|killDrumGet|killDrumBeatGet|playgroundPeaks|linkedCount|patternCount|soundVersions|guessClip|play|stop|seek|setPosition|transport|record|stopRecording|listenAudio|auditionTake|previewClick|blobGetPatch|undo|redo|newSession|openSession|openVersion|openSong|importSession|save|exportSession|exportMix|newVersion|renameSession)/;
  // these run again on every linked copy, so the sound changes at once while it plays
  const FAN = new Set(["setClipGain", "setClipFades"]);

  let S = null, changed = () => {}, id = () => String(Math.random()).slice(2);
  const off = () => !!window.KT2_LINK_OLD || !document.documentElement.classList.contains("kt2");
  const isSound = (t, c) => t.kind === "take" && c.kind !== "midi" && !(c.takes > 1);
  const linkOf = (c) => c.link || c.src;
  function sounds() {
    const out = [];
    if (S) for (const t of S.tracks) for (const c of t.clips) if (isSound(t, c)) out.push(c);
    return out;
  }
  // every sound clip gets its link written down, so it stays linked after its audio is re-rendered
  function stamp() {
    for (const c of sounds()) {
      if (!c.link && c.src) c.link = c.src;
      if (!c.fam && c.link) c.fam = c.link;
    }
  }
  const plugShape = (ps) => (ps || []).map((p) => p.type + ":" + (p.params || []).length).join("|");
  const plugSig = (ps) => JSON.stringify((ps || []).map((p) => { const { id: _i, autoOf: _a, ...rest } = p; return rest; }));
  const sigOf = (c) => JSON.stringify(SHARED.map((k) => c[k] === undefined ? null : c[k])) + plugSig(c.plugins);
  const clone = (v) => (v === undefined ? undefined : v && typeof v === "object" ? structuredClone(v) : v);
  const clonePlug = (p) => {
    const y = structuredClone(p);
    y.id = id(); delete y.autoOf;
    return y;
  };
  // make `to` the same as `from`, keeping its own place
  function copyOver(from, to) {
    let n = 0;
    const soundMoved = SOUND.some((k) => JSON.stringify(from[k]) !== JSON.stringify(to[k]));
    for (const k of SHARED) {
      if (JSON.stringify(from[k]) === JSON.stringify(to[k])) continue;
      if (from[k] === undefined) delete to[k]; else to[k] = clone(from[k]);
      n++;
    }
    if (soundMoved) { to.length = from.length; to.offset = from.offset || 0; to.takes = 0; to.take = 0; to.takeSrc = null; to.comp = null; }
    if (plugSig(from.plugins) !== plugSig(to.plugins)) {
      const fp = from.plugins || [];
      if (plugShape(fp) === plugShape(to.plugins)) {
        // same effects in the same order: the knobs and switches move, their ids (and automation) stay
        to.plugins.forEach((p, i) => { const { id: _i, autoOf: _a, ...rest } = structuredClone(fp[i]); Object.assign(p, rest); });
      } else to.plugins = fp.map(clonePlug);
      n++;
    }
    return n;
  }
  function groups() {
    const m = new Map();
    for (const c of sounds()) { const l = linkOf(c); if (!l) continue; if (!m.has(l)) m.set(l, []); m.get(l).push(c); }
    return m;
  }
  // after a command: in each link, the copy that changed is copied to the rest
  function mirror(before, hint) {
    let n = 0;
    for (const list of groups().values()) {
      if (list.length < 2) continue;
      const sigs = list.map(sigOf);
      if (sigs.every((s) => s === sigs[0])) continue;
      const src = list.find((c) => hint.includes(c.id) && before.get(c.id) !== sigOf(c))
        || list.find((c) => before.has(c.id) && before.get(c.id) !== sigOf(c))
        || list.find((c) => !before.has(c.id) && hint.includes(c.id));
      if (!src) continue;
      for (const c of list) if (c !== src) n += copyOver(src, c);
    }
    return n;
  }
  // a NEW clip that came out of a command different from its link (an AI render of one copy, Clean, Tune,
  // a KILLDRUM swap on one lane: they put a fresh clip in place and keep the old link): it becomes its own
  // version of the sound. Before this it stayed in the link with another sound, and the next change to any
  // copy copied the old sound back over it (debug pass 7 Nov). Fresh clips with the same sound share one version.
  function splitFresh(before, hint) {
    let n = 0;
    for (const list of groups().values()) {
      const old = list.filter((c) => before.has(c.id)), fresh = list.filter((c) => !before.has(c.id) && !hint.includes(c.id));
      if (!old.length || !fresh.length) continue;
      const oldSigs = new Set(old.map(sigOf)), made = new Map();
      for (const c of fresh) {
        const sg = sigOf(c);
        if (oldSigs.has(sg)) continue;   // a plain copy (duplicate, paste): stays linked
        if (!made.has(sg)) {
          const fam = c.fam || linkOf(c);
          const ver = Math.max(1, ...sounds().filter((x) => (x.fam || linkOf(x)) === fam).map((x) => x.ver || 1)) + 1;
          for (const x of list) if (!x.ver) x.ver = 1;
          made.set(sg, { link: "u" + id(), fam, ver });
        }
        const v = made.get(sg);
        c.link = v.link; c.fam = v.fam; c.ver = v.ver; n++;
      }
    }
    return n;
  }
  const hintOf = (args) => {
    if (!args) return [];
    const out = [];
    if (args.clipId) out.push(args.clipId);
    if (Array.isArray(args.clipIds)) out.push(...args.clipIds);
    if (args.pluginId) for (const c of sounds()) if ((c.plugins || []).some((p) => p.id === args.pluginId)) out.push(c.id);
    return out;
  };
  const findSound = (cid) => { if (S) for (const t of S.tracks) for (const c of t.clips) if (c.id === cid && isSound(t, c)) return c; return null; };
  const mates = (c) => { const l = linkOf(c); return sounds().filter((x) => x !== c && linkOf(x) === l); };
  const restart = () => { if (window.KT2_softRestart) window.KT2_softRestart(); };

  // Every command goes through here (app.js call()).
  function run(cmd, args, h) {
    if (off() || !S || SKIP.test(cmd)) return h(args);
    stamp();
    // a knob on one copy's effect: the same knob on every copy, live
    if (cmd === "setParam" && args && args.pluginId) {
      const r = h(args);
      const own = sounds().find((c) => (c.plugins || []).some((p) => p.id === args.pluginId));
      if (own) {
        const i = own.plugins.findIndex((p) => p.id === args.pluginId);
        for (const m of mates(own)) {
          const q = m.plugins && m.plugins[i];
          if (q && q.type === own.plugins[i].type) h({ ...args, pluginId: q.id, begin: false });
        }
      }
      return r;
    }
    if (FAN.has(cmd) && args && args.clipId) {
      const r = h(args), c = findSound(args.clipId);
      if (c) for (const m of mates(c)) h({ ...args, clipId: m.id, drag: true });   // one undo step for all of them
      return r;
    }
    const before = new Map();
    for (const c of sounds()) before.set(c.id, sigOf(c));
    const post = () => {
      stamp();
      const hint = hintOf(args), split = splitFresh(before, hint);
      if (mirror(before, hint) || split) { changed(); restart(); }
    };
    const r = h(args);
    if (r && typeof r.then === "function") return r.then((v) => { post(); return v; });
    post();
    return r;
  }

  // ---------------------------------------------------------------- the engine half
  function demo(o) {
    S = o.S; changed = o.changed; id = o.id || id;
    const handlers = o.handlers;
    const versionsOf = (fam) => {
      const m = new Map();
      for (const c of sounds()) if ((c.fam || linkOf(c)) === fam) {
        const l = linkOf(c);
        if (!m.has(l)) m.set(l, { link: l, ver: c.ver || 1, color: c.color || null, name: c.name, clipIds: [] });
        m.get(l).clipIds.push(c.id);
      }
      return [...m.values()].sort((a, b) => a.ver - b.ver);
    };
    // MAKE UNIQUE on sounds: every selected clip of one sound becomes ONE new version with one new colour
    handlers.makeUniqueSounds = ({ clipIds, colors }) => {
      stamp();
      const picked = (clipIds || []).map(findSound).filter(Boolean);
      if (!picked.length) return { error: "Pick a sound clip." };
      const fams = new Map();
      for (const c of picked) { const f = c.fam || linkOf(c); if (!fams.has(f)) fams.set(f, []); fams.get(f).push(c); }
      let k = 0;
      const made = [];
      for (const [fam, list] of fams) {
        const all = sounds().filter((x) => (x.fam || linkOf(x)) === fam);
        const ver = Math.max(1, ...all.map((x) => x.ver || 1)) + 1;
        const link = "u" + id(), color = (colors && colors[k++]) || null, lead = list[0];
        for (const c of all) if (!c.ver) c.ver = 1;
        for (const c of list) {
          if (c !== lead) copyOver(lead, c);   // they were the same anyway, unless they came from different versions
          c.link = link; c.fam = fam; c.ver = ver;
          if (color) c.color = color;
          // their effects are their own from now on (fresh ids, so automation and live effects don't cross)
          c.plugins = (c.plugins || []).map((p) => ({ ...clonePlug(p), autoOf: p.autoOf || p.id }));
        }
        made.push({ link, ver, count: list.length });
      }
      changed(); restart();
      return { ok: true, versions: made };
    };
    handlers.makeUniqueSounds.undoable = true;
    // the title's list: every version of the clip's sound
    handlers.soundVersions = ({ clipId }) => {
      stamp();
      const c = findSound(clipId);
      if (!c) return { versions: [] };
      return { versions: versionsOf(c.fam || linkOf(c)), link: linkOf(c) };
    };
    // move clips over to another version of their sound: they take its colour, effects and settings
    handlers.setSoundVersion = ({ clipIds, link }) => {
      stamp();
      const model = sounds().find((x) => linkOf(x) === link && !(clipIds || []).includes(x.id));
      if (!model) return { error: "That version isn't there any more." };
      let n = 0;
      for (const c of (clipIds || []).map(findSound).filter(Boolean)) {
        if ((c.fam || linkOf(c)) !== (model.fam || linkOf(model))) continue;   // only versions of the same sound
        copyOver(model, c);
        if (model.color) c.color = model.color; else delete c.color;
        c.link = link; c.ver = model.ver || 1;
        n++;
      }
      changed(); restart();
      return { ok: n > 0, count: n };
    };
    handlers.setSoundVersion.undoable = true;
  }
  window.KillToyLink = { run, demo };
})();
