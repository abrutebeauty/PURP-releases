// EXPERIMENTAL (Eman, 15 Nov 2026: "add one option after alternative in midi called EXPERIMENTAL which is very
// interestingly experimental"). The 7th step of the Common <-> Alternative card on the MIDI DICE. The chords are rolled
// the most alternative way first (pop 0), then every roll picks one move from each of three boxes, so two rolls never
// sound alike:
//   HARMONY: SIDESTEP (every other chord slides up/down the scale), THIRDS (every other chord jumps a third),
//            BACKWARDS (the chord order turned around), ORBIT (each chord a step further from the first)
//   VOICING: 4THS (chords stacked in fourths), CLUSTER (notes squeezed into seconds), WIDE (bass down, notes spread)
//   RHYTHM:  3 OVER 4 (hits every three 16ths across the beat), PUSHED (every other hit a 16th or 8th late),
//            STUTTER (each chord ratchets in), GAPS (some hits cut short, leaving holes)
// plus, some rolls, a low PEDAL note on the key's home note under it all.
// Every note is a note of the picked key (the DICE KEY RULE: the key always wins). KT2_DICE_EXP_OFF = no 7th step.
(function () {
  "use strict";
  const pc = (p) => ((p % 12) + 12) % 12;
  // a seeded random so DICE LIVE replays the same twist for the same roll
  function rng(seed) {
    let s = ((seed == null ? Math.floor(Math.random() * 1e9) : seed) * 2654435761 >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];

  function apply(notes, o) {
    o = o || {};
    const pcs = (o.pcs && o.pcs.length ? o.pcs : [0, 2, 4, 5, 7, 9, 11]).map(pc), tonic = pc(o.tonic || 0), beats = Math.max(1, o.beats || 16);
    const R = rng(o.seed), inKey = new Set(pcs);
    const ladder = []; for (let p = 12; p <= 115; p++) if (inKey.has(pc(p))) ladder.push(p);
    const near = (p) => { let b = 0; for (let i = 1; i < ladder.length; i++) if (Math.abs(ladder[i] - p) < Math.abs(ladder[b] - p)) b = i; return b; };
    const step = (p, k) => ladder[Math.max(0, Math.min(ladder.length - 1, near(p) + k))];
    const snap = (p) => ladder[near(p)];
    const fifthSteps = pcs.length >= 7 ? 3 : 2;   // a 4th in a 7-note scale is 3 steps, in a 5-note scale 2

    // the chords: the hits that start together (locked notes, the top line and the bass note stay as they are)
    const stay = [], G = new Map();
    for (const n of notes) { if (n.locked || n.tl || n.bs) { stay.push(n); continue; } const k = (+n.start).toFixed(3); if (!G.has(k)) G.set(k, []); G.get(k).push(n); }
    let groups = [...G.values()].sort((a, b) => a[0].start - b[0].start).map((g) => ({ start: g[0].start, length: Math.max(...g.map((n) => n.length)), vel: Math.max(...g.map((n) => n.velocity || 100)), ps: g.map((n) => n.pitch).sort((a, b) => a - b), src: (({ id, sel, ...b }) => b)(g[0]) }));
    if (!groups.length) return { notes, said: "" };
    const said = [];

    // ---- HARMONY: what the chords are ----
    const ids = []; let last = null, ci = -1;   // which chord each hit belongs to (repeated hits of one chord share it)
    for (const g of groups) { const id = g.ps.join(","); if (id !== last) { ci++; last = id; } ids.push(ci); }
    const nCh = ci + 1, chordPs = []; groups.forEach((g, i) => { if (!chordPs[ids[i]]) chordPs[ids[i]] = g.ps.slice(); });
    const hm = pick(R, nCh > 1 ? ["sidestep", "thirds", "backwards", "orbit"] : ["sidestep", "thirds", "orbit"]);
    let newCh = chordPs.map((ps) => ps.slice());
    if (hm === "sidestep") { const k = pick(R, [1, -1, 1]); newCh = chordPs.map((ps, i) => (i % 2 ? ps.map((p) => step(p, k)) : ps)); said.push(k > 0 ? "SIDESTEP UP" : "SIDESTEP DOWN"); }
    if (hm === "thirds") { const k = pick(R, [2, -2]); newCh = chordPs.map((ps, i) => (i % 2 ? ps.map((p) => step(p, k)) : ps)); said.push("THIRDS"); }
    if (hm === "backwards") { newCh = chordPs.map((_, i) => chordPs[nCh - 1 - i].slice()); said.push("BACKWARDS"); }
    if (hm === "orbit") { const k = pick(R, [1, -1]); newCh = chordPs.map((ps, i) => ps.map((p) => step(p, (k * i) % 4))); said.push("ORBIT"); }
    // a single chord (one held chord over the clip) still moves: every other hit leans a step away
    if (nCh === 1 && groups.length > 1) groups.forEach((g, i) => { g.ps = i % 2 ? chordPs[0].map((p) => step(p, hm === "thirds" ? 2 : 1)) : chordPs[0].slice(); });
    else groups.forEach((g, i) => { g.ps = newCh[ids[i]].slice(); });

    // ---- VOICING: how the notes stack ----
    const vm = pick(R, ["fourths", "cluster", "wide"]);
    for (const g of groups) {
      const n = g.ps.length, lo = g.ps[0];
      if (vm === "fourths") { const out = [snap(lo)]; for (let i = 1; i < n; i++) out.push(step(out[i - 1], fifthSteps)); g.ps = out; }
      if (vm === "cluster") { let b = snap(lo); while (b < 52) b = step(b, pcs.length); const out = [b]; for (let i = 1; i < n; i++) out.push(step(out[i - 1], 1)); g.ps = out; }
      if (vm === "wide") { const s = g.ps.slice().sort((a, b) => a - b); g.ps = s.map((p, i) => (i === 0 ? (p - 12 >= 31 ? p - 12 : p) : i % 2 ? Math.min(96, p + 12) : p)); }
      g.ps = [...new Set(g.ps.map(snap))].sort((a, b) => a - b);
    }
    said.push({ fourths: "4THS", cluster: "CLUSTER", wide: "WIDE" }[vm]);

    // ---- RHYTHM: when they hit ----
    const rm = pick(R, ["poly3", "pushed", "stutter", "gaps"]);
    const ends = groups.map((g, i) => (i + 1 < groups.length ? groups[i + 1].start : beats));
    let hits = [];
    groups.forEach((g, i) => {
      const span = Math.max(0.25, ends[i] - g.start);
      if (rm === "poly3") { for (let t = 0, k = 0; t < span - 0.1; t += 0.75, k++) hits.push({ ps: g.ps, start: g.start + t, length: Math.min(0.6, span - t), vel: k === 0 ? g.vel : Math.round(g.vel * (k % 2 ? 0.72 : 0.86)), src: g.src }); }
      else if (rm === "pushed") { const off = i % 2 ? pick(R, [0.25, 0.5, 0.75]) : 0, o = Math.min(off, span - 0.25); hits.push({ ps: g.ps, start: g.start + o, length: Math.max(0.25, Math.min(g.length, span) - o), vel: g.vel, src: g.src }); }
      else if (rm === "stutter") { if (span >= 1) { hits.push({ ps: g.ps, start: g.start, length: 0.125, vel: Math.round(g.vel * 0.7), src: g.src }, { ps: g.ps, start: g.start + 0.25, length: 0.125, vel: Math.round(g.vel * 0.8), src: g.src }, { ps: g.ps, start: g.start + 0.5, length: Math.max(0.25, Math.min(g.length, span) - 0.5), vel: g.vel, src: g.src }); } else hits.push({ ps: g.ps, start: g.start, length: Math.min(g.length, span), vel: g.vel, src: g.src }); }
      else { const cut = R() < 0.5; hits.push({ ps: g.ps, start: g.start, length: cut ? Math.max(0.25, Math.min(g.length, span) * 0.35) : Math.min(g.length, span), vel: g.vel, src: g.src }); if (span >= 4 && !cut) hits[hits.length - 1].length = span * 0.6; }
    });
    said.push({ poly3: "3 OVER 4", pushed: "PUSHED", stutter: "STUTTER", gaps: "GAPS" }[rm]);

    // ---- PEDAL: the home note held low under it all (some rolls) ----
    const out = [];
    for (const h of hits) for (const p of h.ps) out.push({ ...h.src, pitch: p, start: +h.start.toFixed(4), length: +Math.max(0.1, h.length).toFixed(4), velocity: Math.max(1, Math.min(127, h.vel)), exp: 1 });
    if (R() < 0.4) {
      const lo = Math.min(...out.map((n) => n.pitch)); let p = lo - 5; while (pc(p) !== tonic) p--; if (p < 24) p += 12;
      if (p < lo) { const blk = beats >= 16 ? 16 : beats; for (let t = 0; t < beats - 1e-6; t += blk) out.push({ ...groups[0].src, pitch: p, start: t, length: Math.min(blk, beats - t), velocity: 78, exp: 1 }); said.push("PEDAL"); }
    }
    return { notes: out.filter((n) => n.start < beats - 1e-6).map((n) => (n.start + n.length > beats ? { ...n, length: beats - n.start } : n)).concat(stay), said: "EXPERIMENTAL: " + said.join(" + ") };
  }

  window.KT2DiceExp = { on: () => !window.KT2_DICE_EXP_OFF, apply };
})();
