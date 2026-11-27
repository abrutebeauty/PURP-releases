// MOOD TOOLS (Eman, 9 Nov 00:07: "what more buttons or tools might serve us instead of the characters, based on the
// words I wrote out"). Seven small cards under the dice cards, taken from the Tools column of Eman's 18 moods
// (/mnt/project-files/killtoy/kt2/research/moods-17.md). Mockup: https://claude.ai/artifact/1yErBTVZiNgGDvwnrE7F7X
//
//   BASS     a bass line under the chords: ROOT, JUMPY (octave bounce), PEDAL (the home note held under everything),
//            WALK (steps into the next chord), FAR BELOW (the root an octave lower still)
//   SPREAD   how far apart the chord's notes sit: CLOSE, OPEN, WIDE
//   LIFT     one borrowed chord that lifts the loop: HERO (bVI and bVII major in bars 3 and 4), DORIAN (IV major),
//            SUDDEN MAJOR (the last chord turns major), LYDIAN (II major)
//   RUB      a note that rubs against the chord: ONE RUB, CLUSTER
//   MOTION   how the chords move: REPEAT, STEP (each note moves to the nearest note of the next chord), SLIDE
//   SHAPE    the loudness over the pattern: FLAT, BUILD, DROP, SWELL
//   OCTAVES  doubling: LOW (the bottom an octave down), HIGH (the top an octave up), BOTH
//
// Every card starts on AUTO: with a MOOD picked, AUTO is that mood's own choice (Villain = a rub and octaves both
// ways, Meditative = a pedal); with no mood every AUTO is the first value, which changes nothing. Pinned cards win.
// They only reshape what the dice rolled (chords lane), after the roll, inside diceCompute, so DICE LIVE keeps them.
// No random numbers in here: the same roll with the same cards always comes out the same.
//
// window.KT2DiceTools = { on(), TOOLS, auto(moodKey), apply(notes, ctx) }
// KT2_DICE_TOOLS_OFF = no cards, no changes. KT2_DICE_TOOLS_NOMOOD = AUTO never follows the mood.
(() => {
  const on = () => !window.KT2_DICE_TOOLS_OFF;
  const TOOLS = [
    { k: "bass", n: "Bass", v: ["NONE", "ROOT", "JUMPY", "PEDAL", "WALK", "FAR BELOW"] },
    { k: "spread", n: "Spread", v: ["CLOSE", "OPEN", "WIDE"] },
    { k: "lift", n: "Lift", v: ["NONE", "HERO", "DORIAN", "SUDDEN MAJOR", "LYDIAN"] },
    { k: "rub", n: "Rub", v: ["NONE", "ONE RUB", "CLUSTER"] },
    { k: "motion", n: "Motion", v: ["REPEAT", "STEP", "SLIDE"] },
    { k: "shape", n: "Shape", v: ["FLAT", "BUILD", "DROP", "SWELL"] },
    { k: "octaves", n: "Octaves", v: ["NONE", "LOW", "HIGH", "BOTH"] },
  ];
  // each mood's own choice (from the mockup's 18 moods): [bass, spread, lift, rub, motion, shape, octaves]
  const MOOD_AUTO = {
    euphoric: [2, 2, 0, 0, 1, 1, 2], playful: [2, 0, 0, 0, 1, 0, 0], heroic: [0, 1, 1, 0, 1, 1, 1], dreamy: [0, 2, 0, 0, 2, 0, 0],
    meditative: [3, 1, 0, 0, 0, 0, 0], ambient: [0, 2, 0, 0, 0, 3, 0], psychedelic: [0, 1, 4, 0, 2, 0, 0], cinematic: [0, 2, 0, 0, 1, 1, 1],
    monotone: [3, 0, 0, 0, 0, 0, 0], godlike: [0, 2, 3, 0, 1, 1, 3], lonely: [5, 2, 0, 0, 1, 0, 0], sad: [0, 1, 0, 0, 1, 0, 0],
    suspense: [3, 0, 0, 1, 0, 1, 0], unease: [0, 0, 0, 2, 2, 0, 0], dark: [0, 0, 0, 0, 1, 0, 1], villain: [0, 0, 0, 1, 1, 0, 3],
    rage: [0, 0, 0, 0, 2, 1, 1], demonic: [3, 0, 0, 2, 2, 3, 1],
    dreamcore: [0, 2, 0, 0, 2, 0, 0], grief: [0, 1, 0, 0, 0, 0, 0], liminal: [0, 1, 0, 0, 0, 0, 0],   // cores from Eman's songs (kt2-mood-dna.js CORES)
  };
  const auto = (moodKey) => { const a = !window.KT2_DICE_TOOLS_NOMOOD && moodKey && MOOD_AUTO[moodKey]; const o = {}; TOOLS.forEach((t, i) => { o[t.k] = a ? a[i] : 0; }); return o; };

  const pc = (x) => ((x % 12) + 12) % 12;
  const near = (from, pcT) => { const d = pc(pcT - from); return d <= 6 ? from + d : from + d - 12; };   // the pitch of class pcT nearest to `from`
  const LOWEST = 24, HIGHEST = 100;
  const key = (n) => n.pitch + "@" + n.start.toFixed(4);
  const dedupe = (ns) => { const seen = new Map(); for (const n of ns) { const k = key(n), o = seen.get(k); if (!o || n.length > o.length) seen.set(k, n); } return [...seen.values()]; };
  // the notes that start at the same time, in time order
  const hits = (ns) => { const m = new Map(); for (const n of ns) { const k = n.start.toFixed(4); if (!m.has(k)) m.set(k, []); m.get(k).push(n); } return [...m.values()].sort((a, b) => a[0].start - b[0].start); };

  // ctx: { tools (resolved indices), sc: { tonic, scale }, beats, segs (the brain's chords: beat, len, root, pcs), slides(notes) }
  function apply(notes, ctx) {
    if (!on() || !notes || !notes.length || !ctx || !ctx.tools) return notes;
    const T = ctx.tools, beats = Math.max(1, ctx.beats || 16), tonic = pc((ctx.sc && ctx.sc.tonic) || 0);
    if (!Object.values(T).some(Boolean)) return notes;   // every card on its first value: the roll as it was
    let ns = notes.map((n) => ({ ...n }));
    const segs = (ctx.segs && ctx.segs.length ? ctx.segs : [{ beat: 0, len: beats, root: tonic }]).map((s) => ({ ...s }));
    const inSeg = (s) => (n) => n.start >= s.beat - 1e-6 && n.start < s.beat + s.len - 1e-6;

    // LIFT: one chord of every 4-bar loop becomes a borrowed major chord, each note to the nearest note of the new chord
    const LIFT = [null, [[2, 8], [3, 10]], [[2, 5]], [[3, 0]], [[1, 2]]][T.lift || 0];
    if (LIFT) {
      for (const [bar, off] of LIFT) {
        const done = new Set();
        for (const s of segs) {
          const b = Math.floor((s.beat % 16) / 4 + 1e-6); if (b !== bar) continue;
          const loop = Math.floor(s.beat / 16 + 1e-6); if (done.has(loop)) continue; done.add(loop);   // the first chord of that bar only
          const r = pc(tonic + off), want = [r, pc(r + 4), pc(r + 7)];
          const G = ns.filter(inSeg(s)); if (!G.length) continue;
          const ups = [...new Set(G.map((n) => n.pitch))].sort((a, b) => a - b), map = new Map(), used = new Set();
          ups.forEach((p, i) => {
            let to = i === 0 ? near(p, r) : null;   // the bottom note becomes the new root
            if (to == null) { const free = want.filter((w) => !used.has(w)), pool = free.length ? free : want; to = pool.map((w) => near(p, w)).sort((a, b) => Math.abs(a - p) - Math.abs(b - p))[0]; }
            used.add(pc(to)); map.set(p, to);
          });
          for (const n of G) n.pitch = map.get(n.pitch);
          s.root = r; s.pcs = want; s.lifted = true;
        }
      }
    }
    // SPREAD: the same notes, further apart (OPEN: the second note up an octave; WIDE: every pair an octave higher)
    if (T.spread) for (const g of hits(ns)) {
      const ps = [...new Set(g.map((n) => n.pitch))].sort((a, b) => a - b); if (ps.length < 3) continue;
      const to = new Map(ps.map((p, i) => [p, T.spread === 1 ? (i === 1 ? p + 12 : p) : p + 12 * Math.floor(i / 2)]));
      if ([...to.values()].some((p) => p > HIGHEST)) continue;
      for (const n of g) n.pitch = to.get(n.pitch);
    }
    // MOTION STEP: each chord's upper notes take the octave nearest the chord before (smooth, no jumps)
    if (T.motion === 1) {
      let prev = null;
      for (const s of segs) {
        const G = ns.filter(inSeg(s)); if (!G.length) continue;
        const ps = [...new Set(G.map((n) => n.pitch))].sort((a, b) => a - b);
        if (prev && ps.length > 1) {
          const lo = ps[0], map = new Map([[lo, lo]]), taken = new Set([lo]);
          for (const p of ps.slice(1)) {
            const opts = [p - 12, p, p + 12].filter((x) => x > lo && x <= HIGHEST && !taken.has(x));
            const best = (opts.length ? opts : [p]).sort((a, b) => Math.min(...prev.map((q) => Math.abs(q - a))) - Math.min(...prev.map((q) => Math.abs(q - b))))[0];
            map.set(p, best); taken.add(best);
          }
          for (const n of G) n.pitch = map.get(n.pitch);
          prev = [...new Set(G.map((n) => n.pitch))].sort((a, b) => a - b).slice(1);
        } else prev = ps.slice(1).length ? ps.slice(1) : ps;
      }
    }
    // RUB: a note a semitone above a chord note (ONE RUB), or two close notes under the top one (CLUSTER)
    // Night test 9 Nov (KT2_DICE_TOOLS_KEY_OLD keeps the old way): with ONLY KEY on, the rub is the next note of the
    // scale (a 2nd), never a note outside the key; and a figure of single notes (BROKEN, arps) gets one rub per chord,
    // not one on every 8th note (that filled the pattern with all 12 notes).
    const keyFix = !window.KT2_DICE_TOOLS_KEY_OLD, scSet = keyFix && ctx.scalePcs && ctx.scalePcs.length ? new Set(ctx.scalePcs.map(pc)) : null;
    const up = (p, d) => { if (!scSet) return p + d; let q = p; for (let i = 0; i < d; i++) { q++; while (!scSet.has(pc(q))) q++; } return q; };
    const down = (p, d) => { if (!scSet) return p - d; let q = p; for (let i = 0; i < d; i++) { q--; while (!scSet.has(pc(q))) q--; } return q; };
    if (T.rub) {
      const add = [], rubbedSeg = new Set();
      for (const g of hits(ns)) {
        const ps = [...new Set(g.map((n) => n.pitch))].sort((a, b) => a - b), src = g.find((n) => n.pitch === ps[ps.length - 1]);
        if (!src) continue;
        if (keyFix && ps.length < 2) {   // a single note: only the first one of each chord gets the rub
          const si = segs.findIndex((s) => src.start >= s.beat - 1e-6 && src.start < s.beat + s.len - 1e-6);
          if (rubbedSeg.has(si)) continue; rubbedSeg.add(si);
        }
        const has = new Set(ps), base = { start: src.start, length: src.length, velocity: Math.max(30, (src.velocity || 100) - 14) };
        if (T.rub === 1) { const at = ps.length >= 3 ? ps[ps.length - 2] : ps[ps.length - 1], to = up(at, 1); if (!has.has(to)) add.push({ ...base, pitch: to }); }
        else { const top = ps[ps.length - 1]; for (const d of [1, 2]) { const to = scSet ? down(top, d) : top - d; if (!has.has(to)) add.push({ ...base, pitch: to }); } }
      }
      ns = ns.concat(add);
    }
    // OCTAVES: the bottom note an octave down, the top an octave up, or both
    if (T.octaves) {
      const add = [];
      for (const g of hits(ns)) {
        const lo = g.reduce((a, n) => (n.pitch < a.pitch ? n : a)), hi = g.reduce((a, n) => (n.pitch > a.pitch ? n : a));
        if (keyFix && g.length < 2) {   // a single note of a figure: one copy (BOTH on every 8th tripled the pattern)
          const to = T.octaves === 2 ? hi.pitch + 12 : lo.pitch - 12;
          if (to >= LOWEST && to <= HIGHEST) add.push({ ...lo, pitch: to, slide: undefined, velocity: Math.max(30, (lo.velocity || 100) - 10) });
          continue;
        }
        if ((T.octaves === 1 || T.octaves === 3) && lo.pitch - 12 >= LOWEST) add.push({ ...lo, pitch: lo.pitch - 12, slide: undefined });
        if ((T.octaves === 2 || T.octaves === 3) && hi.pitch + 12 <= HIGHEST) add.push({ ...hi, pitch: hi.pitch + 12, slide: undefined, velocity: Math.max(30, (hi.velocity || 100) - 10) });
      }
      ns = ns.concat(add);
    }
    // BASS: a line under the chords, from each chord's root
    if (T.bass) {
      const lowest = Math.min(...ns.map((n) => n.pitch));
      const top = T.bass === 5 ? 35 : 47;   // FAR BELOW sits in the octave under
      const bp = (r) => { let p = top - pc(top - r); while (p >= lowest - 4 && p - 12 >= LOWEST) p -= 12; return Math.max(LOWEST, p); };   // under every chord note
      const add = [];
      segs.forEach((s, i) => {
        if (s.beat >= beats - 1e-6) return;
        const len = Math.min(s.len, beats - s.beat), r = s.root == null ? tonic : pc(s.root), p = bp(r), v = 100;
        if (T.bass === 1 || T.bass === 5) add.push({ pitch: p, start: s.beat, length: len, velocity: v });
        else if (T.bass === 3) add.push({ pitch: bp(tonic), start: s.beat, length: len, velocity: v });
        else if (T.bass === 2) for (let b = 0; b < len - 1e-6; b += 0.5) add.push({ pitch: Math.round(b * 2) % 2 ? p + 12 : p, start: s.beat + b, length: Math.min(0.4, len - b), velocity: Math.round(b * 2) % 2 ? 86 : v });
        else if (T.bass === 4) {   // WALK: the root, then on the last beat a step into the next chord's root
          const nx = segs[i + 1] || segs[0], nr = nx.root == null ? tonic : pc(nx.root), np = bp(nr);
          if (len >= 2 && np !== p) { const step = np > p ? np - (np - p > 2 ? 2 : 1) : np + (p - np > 2 ? 2 : 1); add.push({ pitch: p, start: s.beat, length: len - 1, velocity: v }, { pitch: step, start: s.beat + len - 1, length: 1, velocity: 92 }); }
          else add.push({ pitch: p, start: s.beat, length: len, velocity: v });
        }
      });
      ns = ns.concat(add.filter((n) => n.length > 0.05));
    }
    ns = dedupe(ns);
    // MOTION SLIDE: the chords glide into each other (the dice's own slides)
    if (T.motion === 2 && ctx.slides) ns = ctx.slides(ns);
    // SHAPE: louder over the pattern (BUILD), quieter (DROP), up then down (SWELL)
    if (T.shape) {
      const f = [null, (x) => 0.55 + 0.45 * x, (x) => 1 - 0.45 * x, (x) => 0.55 + 0.45 * Math.sin(Math.PI * x)][T.shape];
      ns = ns.map((n) => ({ ...n, velocity: Math.max(20, Math.min(127, Math.round((n.velocity || 100) * f(Math.min(1, n.start / beats))))) }));
    }
    for (const n of ns) { if (n.slide === undefined) delete n.slide; n.pitch = Math.max(0, Math.min(127, n.pitch)); }
    return ns.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  }
  window.KT2DiceTools = { on, TOOLS, MOOD_AUTO, auto, apply };
})();
