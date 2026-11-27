// PG MATCH (Eman, 15 Nov): a switch next to ROLL in the MIDI DICE and in KILLDRUM. When it is on, ROLL first
// listens to what is already in the playground over the same stretch as the pattern clip (vocals, samples,
// melodies, the beat) and the roll is made to fit it.
//  - MIDI DICE: the sound clips are read as chroma (12 note classes) every half beat and turned into "heard"
//    notes, which go to the dice's ears (ui/dice-harmony.js) together with the MIDI lanes the dice already hears.
//    So the chords and bass follow the chord changes under the vocal or sample, section by section. The picked
//    key always wins (DICE KEY RULE); the heard key only shows as a small badge on the switch.
//  - KILLDRUM: the sound clips are read as onsets on the song's 16th grid (the BPM of the song): where the
//    accents fall (low and full band), how swung the off-beats are, how busy it is. The rhythm brain gets those
//    accents, and the rolled kick / 808 move onto the strong low hits nearby.
// KT2_PGMATCH_OFF = no switch anywhere (as before). Name in one place (LABEL) so it is easy to rename.
(function () {
  "use strict";
  const LABEL = "PG MATCH";
  const off = () => !!window.KT2_PGMATCH_OFF;
  const KEY = "kt2.pgmatch";
  let ON = {};
  try { ON = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { ON = {}; }
  // ON BY DEFAULT (Eman, 15 Nov 16:45: "make it automatically on by default"): until the switch is clicked, PG MATCH is on.
  // KT2_PGMATCH_DEFOFF = off until switched on (old)
  const isOn = (kind) => { const k = kind || "dice"; return !off() && (k in ON ? !!ON[k] : !window.KT2_PGMATCH_DEFOFF); };
  // OWN SWITCH (Eman, 15 Nov 16:45: "not on the same button as the dice, it's like a dot you activate"): a dot + PG MATCH
  // just above ROLL, not inside the tile. KT2_PGMATCH_INROLL = the switch at the bottom of the ROLL tile (old)
  const solo = () => !window.KT2_PGMATCH_INROLL;
  // SIMPLE DICE gets PG MATCH too (its loop picker keeps the loop whose chords fit what's heard best).
  // KT2_PGMATCH_SIMPLE_OFF = no PG MATCH while SIMPLE DICE is on (old)
  const simpleBlocked = () => !!(window.KT2_PGMATCH_SIMPLE_OFF && window.KT2DiceSimple && KT2DiceSimple.on());
  const setOn = (kind, v) => { ON[kind || "dice"] = !!v; try { localStorage.setItem(KEY, JSON.stringify(ON)); } catch (e) { /* fine */ } };

  const st = () => { try { return (typeof ui !== "undefined" && ui && ui.state) || (window.ui && window.ui.state) || null; } catch (e) { return null; } };   // ui is a top-level const in app.js
  const bpmNow = () => { const s = st(); return (s && (s.bpm || (s.tempo && s.tempo.bpm))) || 120; };
  const call = async (cmd, args) => { try { return typeof booth === "function" ? await booth(cmd, args) : null; } catch (e) { return null; } };

  // ------------------------------------------------------------------ audio in
  // every sound clip (not muted) that overlaps [t0, t1) seconds, summed into one mono buffer of that stretch
  async function gather(t0, t1, opt) {
    const s = st(), sr = 11025, n = Math.max(1, Math.ceil((t1 - t0) * sr)), mix = new Float32Array(n), names = [];
    if (!s || !s.tracks) return null;
    const solo = s.tracks.some((t) => t.solo);
    for (const t of s.tracks) {
      if (t.kind !== "take" && t.kind !== "beat") continue;
      if (t.muted || (solo && !t.solo)) continue;
      if (opt && opt.skipTrack && t.id === opt.skipTrack) continue;
      for (const c of t.clips || []) {
        if (c.kind === "midi" || c.active === false || c.muted) continue;
        const a = Math.max(t0, c.start), b = Math.min(t1, c.start + c.length);
        if (b - a < 0.05) continue;
        const r = await call("getClipMono", { clipId: c.id, from: a - c.start, to: b - c.start, rate: sr });
        if (!r || !r.samples) continue;
        const o = Math.round((a - t0) * sr), x = r.samples;
        let pk = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > pk) pk = v; }
        if (pk < 1e-4) continue;
        const g = 1 / pk;   // each clip counts the same, however loud it is
        for (let i = 0; i < x.length && o + i < n; i++) mix[o + i] += x[i] * g;
        names.push(c.name || t.name);
      }
    }
    return names.length ? { x: mix, sr, names } : null;
  }

  // ------------------------------------------------------------------ FFT (radix 2, in place)
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  const hann = {};
  const win = (N) => hann[N] || (hann[N] = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))));
  // magnitude spectra, one frame every `hop` samples, centred on the frame time
  function frames(x, N, hop, each) {
    const w = win(N), re = new Float32Array(N), im = new Float32Array(N);
    for (let c = 0; c < x.length; c += hop) {
      for (let i = 0; i < N; i++) { const j = c - N / 2 + i; re[i] = j >= 0 && j < x.length ? x[j] * w[i] : 0; im[i] = 0; }
      fft(re, im);
      const mag = new Float32Array(N / 2);
      for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
      each(c, mag);
    }
  }
  const pcOfBin = (k, N, sr) => { const f = (k * sr) / N; return f > 0 ? Math.round(69 + 12 * Math.log2(f / 440)) : null; };

  // ------------------------------------------------------------------ harmony: chroma -> heard notes
  // slices of half a beat: treble chroma (110..2000 Hz), bass chroma (36..180 Hz), level
  function chroma(A, spb, beats) {
    const sr = A.sr, slice = spb / 2, nS = Math.ceil(beats * 2), T = [], Bs = [], E = new Float32Array(nS);
    for (let i = 0; i < nS; i++) { T.push(new Float32Array(12)); Bs.push(new Float32Array(12)); }
    const mapT = [], mapB = [];
    const N1 = 4096, N2 = 8192;
    for (let k = 1; k < N1 / 2; k++) { const f = (k * sr) / N1; if (f >= 110 && f <= 2000) mapT.push([k, ((pcOfBin(k, N1, sr) % 12) + 12) % 12]); }
    for (let k = 1; k < N2 / 2; k++) { const f = (k * sr) / N2; if (f >= 36 && f <= 180) mapB.push([k, ((pcOfBin(k, N2, sr) % 12) + 12) % 12]); }
    frames(A.x, N1, 512, (c, m) => {
      const s = Math.floor(c / sr / slice); if (s < 0 || s >= nS) return;
      // a peak-picked chroma: a bin counts only when it is louder than its neighbours (harmonics, not smear)
      for (const [k, p] of mapT) if (m[k] > m[k - 1] && m[k] >= m[k + 1]) T[s][p] += Math.sqrt(m[k]);
    });
    frames(A.x, N2, 1024, (c, m) => {
      const s = Math.floor(c / sr / slice); if (s < 0 || s >= nS) return;
      for (const [k, p] of mapB) if (m[k] > m[k - 1] && m[k] >= m[k + 1]) Bs[s][p] += m[k];
    });
    const per = Math.floor(slice * sr);
    for (let s = 0; s < nS; s++) { let q = 0; const a = s * per, b = Math.min(A.x.length, a + per); for (let i = a; i < b; i++) q += A.x[i] * A.x[i]; E[s] = b > a ? Math.sqrt(q / (b - a)) : 0; }
    return { T, B: Bs, E, nS };
  }
  // Krumhansl-Kessler key profiles
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function corr(a, b) { const n = 12, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let x = 0, ya = 0, yb = 0; for (let i = 0; i < n; i++) { x += (a[i] - ma) * (b[i] - mb); ya += (a[i] - ma) ** 2; yb += (b[i] - mb) ** 2; } return ya && yb ? x / Math.sqrt(ya * yb) : 0; }
  function keyOf(sum) {
    let best = null;
    for (let t = 0; t < 12; t++) for (const [prof, minor] of [[MAJ, false], [MIN, true]]) {
      const r = corr(sum, prof.map((_, i) => prof[(i - t + 12) % 12]));
      if (!best || r > best.r) best = { tonic: t, minor, r };
    }
    return best;
  }
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const keyName = (k) => (k ? NAMES[k.tonic] + (k.minor ? "m" : "") : "");

  // the heard notes the dice's ears read: per half beat the strongest note classes (mid register) plus the bass note
  function toNotes(C) {
    const out = [], eMax = Math.max(1e-6, ...C.E), gate = Math.max(2e-3, eMax * 0.12);
    const sum = new Array(12).fill(0);
    for (let s = 0; s < C.nS; s++) {
      if (C.E[s] < gate) continue;
      const t = C.T[s], mx = Math.max(...t);
      if (mx <= 0) continue;
      const lvl = Math.min(1, C.E[s] / eMax);
      const top = [...t.keys()].filter((p) => t[p] >= mx * 0.55).sort((a, b) => t[b] - t[a]).slice(0, 3);
      for (const p of top) { const w = t[p] / mx; sum[p] += w * lvl; out.push({ pitch: 60 + p, start: s * 0.5, length: 0.5, velocity: Math.round(50 + 50 * w * lvl), src: "pg" }); }
      const b = C.B[s], bm = Math.max(...b);
      if (bm > 0) { const p = b.indexOf(bm), tot = b.reduce((q, v) => q + v, 0); if (bm / tot > 0.3) { sum[p] += 0.8 * lvl; out.push({ pitch: 36 + p, start: s * 0.5, length: 0.5, velocity: Math.round(60 + 40 * lvl), src: "pg" }); } }
    }
    // glue the same note across slices into one longer note (the ears weigh notes by how long they ring)
    out.sort((a, b) => a.pitch - b.pitch || a.start - b.start);
    const glued = [];
    for (const n of out) { const l = glued[glued.length - 1]; if (l && l.pitch === n.pitch && Math.abs(l.start + l.length - n.start) < 1e-6) { l.length += n.length; l.velocity = Math.max(l.velocity, n.velocity); } else glued.push({ ...n }); }
    return { notes: glued.sort((a, b) => a.start - b.start || a.pitch - b.pitch), sum };
  }

  // The heard material read as chords of the PICKED key (DICE KEY RULE), every half bar: the in-key triad whose notes
  // ring most in that stretch (root a bit more, the bass note more still), staying put unless another fits clearly
  // better, the home chord (i / I) a touch preferred (tonal-centre rule). A sung line, a sample with bleed or a
  // full beat give clean chords this way where note-by-note reading calls them a mess. Returns notes: a bass root
  // and a mid-register triad per chord, glued while the chord holds. Silent stretches give nothing.
  function harmonize(C, steps, tonic) {
    if (!steps || steps.length < 5) return null;
    const L = steps.length, pcs = (d) => [0, 2, 4].map((x) => (tonic + steps[(d + x) % L] + 12 * Math.floor((d + x) / L)) % 12);
    const tri = []; for (let d = 0; d < L; d++) { const t = pcs(d), iv = [(t[1] - t[0] + 12) % 12, (t[2] - t[0] + 12) % 12]; if (iv[1] === 7) tri.push({ d, t }); }   // real triads only (no dim)
    const eMax = Math.max(1e-6, ...C.E), gate = Math.max(2e-3, eMax * 0.12), W = 4, out = [];
    let prev = null;
    for (let w = 0; w * W < C.nS; w++) {
      const tw = new Array(12).fill(0), bw = new Array(12).fill(0); let e = 0, live = 0;
      for (let s = w * W; s < Math.min(C.nS, (w + 1) * W); s++) { if (C.E[s] < gate) continue; live++; e += C.E[s]; const mx = Math.max(1e-9, ...C.T[s]), bm = Math.max(1e-9, ...C.B[s]); for (let p = 0; p < 12; p++) { tw[p] += C.T[s][p] / mx; bw[p] += C.B[s][p] / bm; } }
      if (!live) { prev = null; continue; }
      const tot = tw.reduce((a, b) => a + b, 0) || 1, btot = bw.reduce((a, b) => a + b, 0) || 1;
      let best = null;
      for (const c of tri) {
        let sc = (tw[c.t[0]] * 1.25 + tw[c.t[1]] + tw[c.t[2]]) / tot + (0.6 * bw[c.t[0]]) / btot + (0.15 * bw[c.t[2]]) / btot;
        if (prev && prev.d === c.d) sc += 0.06;
        if (c.d === 0) sc += 0.03;
        if (!best || sc > best.sc) best = { ...c, sc };
      }
      prev = best;
      const at = w * W * 0.5, len = Math.min(C.nS - w * W, W) * 0.5, vel = Math.round(70 + 30 * Math.min(1, e / live / eMax));
      out.push({ pitch: 36 + best.t[0], start: at, length: len, velocity: vel, src: "pg" });
      for (const p of best.t) out.push({ pitch: 55 + ((p - 7 + 12) % 12), start: at, length: len, velocity: vel - 10, src: "pg" });
    }
    out.sort((a, b) => a.pitch - b.pitch || a.start - b.start);
    const glued = [];
    for (const n of out) { const l = glued[glued.length - 1]; if (l && l.pitch === n.pitch && Math.abs(l.start + l.length - n.start) < 1e-6) l.length += n.length; else glued.push({ ...n }); }
    return glued.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  }

  // ------------------------------------------------------------------ MIDI DICE side
  // cache: the heard notes for one clip position, so DICE LIVE re-plays and re-rolls don't listen again
  const CACHE = new Map();
  let last = null;
  const sigOf = (t0, t1, s) => [t0.toFixed(3), t1.toFixed(3), bpmNow(), ...((s && s.tracks) || []).filter((t) => t.kind === "take" || t.kind === "beat").map((t) => (t.muted ? "m" : "") + t.clips.map((c) => [c.id, c.start.toFixed(3), c.length.toFixed(3), c.take || 0, c.src || "", c.level || 1].join(":")).join(","))].join("|");
  // listen over a pattern clip (c: { id, start, beats } in seconds / beats). Resolves with { notes, key, names } or null.
  async function hearFor(c) {
    const spb = 60 / bpmNow(), beats = Math.max(1, c.beats || 16), t0 = c.start, t1 = c.start + beats * spb;
    const sig = sigOf(t0, t1, st());
    if (CACHE.has(sig)) return (last = CACHE.get(sig));
    const A = await gather(t0, t1);
    let r = null;
    if (A) { const C = chroma(A, spb, beats), h = toNotes(C); r = { C, notes: h.notes, key: h.notes.length ? keyOf(h.sum) : null, names: A.names, beats, inKey: {} }; }
    if (CACHE.size > 12) CACHE.clear();
    CACHE.set(sig, r);
    return (last = r);
  }
  // the heard notes for the dice context of this clip (sync; what hearFor last found for it)
  // sc: the lane's key ({ tonic, scale }): the heard chords are read in it. KT2_PGMATCH_RAW = the raw note classes
  function notesFor(c, sc) {
    if (!isOn("dice")) return [];
    const spb = 60 / bpmNow(), beats = Math.max(1, c.beats || 16), sig = sigOf(c.start, c.start + beats * spb, st());
    const r = CACHE.get(sig);
    if (!r || !r.notes) return [];
    const steps = sc && !window.KT2_PGMATCH_RAW && window.TmMidi && TmMidi.SCALES && TmMidi.SCALES[sc.scale] && TmMidi.SCALES[sc.scale].steps;
    if (steps && r.C) { const k = sc.tonic + ":" + sc.scale; if (!r.inKey[k]) r.inKey[k] = harmonize(r.C, steps, sc.tonic) || r.notes; return r.inKey[k].map((n) => ({ ...n })); }
    return r.notes.map((n) => ({ ...n }));
  }
  // the badge: the key the sound clips sound like; marked when it isn't the picked key (or its relative)
  let BADGE = { text: "", off: false, title: "" };
  function badge(el, sc) {
    const k = last && last.key && last.key.r > 0.45 ? last.key : null;
    let fits = true;
    if (k && sc && sc.tonic != null) {
      const minorLane = /minor|aeolian|dorian|phrygian/i.test(sc.scale || ""), laneRel = minorLane ? (sc.tonic + 3) % 12 : sc.tonic, kRel = k.minor ? (k.tonic + 3) % 12 : k.tonic;
      fits = laneRel === kRel;
    }
    // the badge shows only when the sounds are not in the picked key (or its relative)
    BADGE = { text: k && !fits ? keyName(k) : "", off: !fits, title: k && !fits ? "The sounds are in " + keyName(k) : "" };
    const b = el && el.querySelector(".pgm-key"); if (!b) return;
    b.textContent = BADGE.text; b.classList.toggle("is-off", BADGE.off); b.title = BADGE.title;
  }

  // ------------------------------------------------------------------ KILLDRUM side
  // onsets on the song's 16th grid over [t0, t1): strength per step (folded into one bar), low-band too, swing
  async function grooveFor(t0, t1) {
    const bpm = bpmNow(), spb = 60 / bpm, step = spb / 4;
    const A = await gather(t0, t1);
    if (!A) return null;
    const N = 1024, hop = 128, sr = A.sr, flux = [], low = [], hi = [];
    let prev = null;
    const kLow = Math.ceil((150 * N) / sr), kHi = Math.floor((4000 * N) / sr);
    frames(A.x, N, hop, (c, m) => {
      const lg = m.map((v) => Math.log1p(10 * v));
      if (prev) { let f = 0, fl = 0, fh = 0; for (let k = 1; k < lg.length; k++) { const d = lg[k] - prev[k]; if (d > 0) { f += d; if (k <= kLow) fl += d; if (k >= kHi) fh += d; } } flux.push([c / sr, f, fl, fh]); }
      prev = lg;
    });
    if (!flux.length) return null;
    // peaks over a local mean: the onsets
    const val = (i, j) => flux[i][j];
    const pick = (j) => {
      const ons = [];
      for (let i = 2; i < flux.length - 2; i++) {
        let mean = 0, cnt = 0; for (let q = Math.max(0, i - 8); q <= Math.min(flux.length - 1, i + 8); q++) { mean += val(q, j); cnt++; }
        mean /= cnt;
        if (val(i, j) > mean * 1.5 && val(i, j) >= val(i - 1, j) && val(i, j) >= val(i + 1, j) && val(i, j) > val(i - 2, j) && val(i, j) > val(i + 2, j)) ons.push([flux[i][0], val(i, j)]);
      }
      return ons;
    };
    const all = pick(1), lows = pick(2);
    const bars = Math.max(1, Math.round((t1 - t0) / (spb * 4)));
    const fold = (ons) => { const s = new Array(16).fill(0); for (const [t, v] of ons) { const k = Math.round(t / step); s[((k % 16) + 16) % 16] += v; } const m = Math.max(1e-9, ...s); return s.map((v) => v / m); };
    const S = fold(all), L = fold(lows);
    // swing: how late the odd 16ths land, against straight (0 = straight, 0.6 = heavy)
    let lateSum = 0, lateN = 0;
    for (const [t, v] of all) { const k = Math.round(t / step); if (k % 2 === 1) { const d = (t - k * step) / step; if (d > -0.3 && d < 0.5) { lateSum += d * v; lateN += v; } } }
    const swing = lateN ? Math.max(0, Math.min(0.6, (lateSum / lateN) * 1.6)) : 0;
    let mask = 0, lowMask = 0; for (let i = 0; i < 16; i++) { if (S[i] >= 0.45) mask |= 1 << i; if (L[i] >= 0.5) lowMask |= 1 << i; }
    const density = Math.round((all.length / bars) * 10) / 10;
    // a clear low pattern (a kick or bass hits that repeat every bar): most of the low energy on a few steps
    const Ls = L.slice().sort((a, b) => b - a), lowClear = lows.length >= bars * 2 && Ls.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(1e-9, Ls.reduce((a, b) => a + b, 0)) >= 0.6;
    return { strength: S, low: L, mask, lowMask, lowClear, swing: +swing.toFixed(2), density, names: A.names, bars };
  }
  // move the rolled kick / 808 hits onto the strong low hits of the sound clips (one step either way), and add
  // a kick on the strongest low hit of the bar if nothing is near it. steps: [{ v, r, ... }] x bars*16
  function fitKick(steps, g, avoid) {
    if (!g || !steps || !steps.length || !g.lowMask) return steps;
    const out = steps.map((x) => ({ ...x })), strong = (i) => g.low[i % 16] >= 0.5, nb = out.length / 16;
    for (let i = 0; i < out.length; i++) {
      if (!out[i].v || strong(i)) continue;
      for (const d of [-1, 1]) { const j = i + d; if (j >= 0 && j < out.length && strong(j) && !out[j].v && !(avoid && avoid(j))) { out[j] = { ...out[i] }; out[i] = { v: 0, r: 1 }; break; } }
    }
    // a clear low pattern in the sounds: the kick locks to it (hits away from it go, its strong hits get one)
    const tops = g.lowClear ? [...g.low.keys()].filter((i) => g.low[i] >= 0.7) : [g.low.indexOf(1)].filter((i) => i >= 0);
    if (g.lowClear) for (let i = 0; i < out.length; i++) if (out[i].v && !strong(i)) out[i] = { v: 0, r: 1 };
    const tpl = out.find((x) => x.v) || { v: 100, r: 1 };
    for (const top of tops) for (let b = 0; b < nb; b++) { const j = b * 16 + top; if (avoid && avoid(j)) continue; if (![-1, 0, 1].some((d) => out[j + d] && out[j + d].v)) out[j] = { ...tpl, v: Math.max(90, tpl.v || 0) }; }
    return out;
  }

  // ------------------------------------------------------------------ the switch
  const css = `
.kt2 .pgm-sw{position:absolute;left:3px;right:3px;bottom:3px;display:flex;align-items:center;justify-content:center;gap:4px;height:15px;padding:0 4px;border-radius:3px;font:800 8px/1 var(--font, system-ui);letter-spacing:.08em;color:rgba(20,18,24,.62);background:rgba(20,18,24,.12);cursor:pointer;user-select:none;white-space:nowrap}
.kt2 .pgm-sw:hover{background:rgba(20,18,24,.2)}
.kt2 .pgm-sw.on{color:var(--acid,#e4ff3a);background:#141218}
.kt2 .pgm-sw .pgm-key:empty{display:none}
.kt2 .pgm-sw .pgm-key{font-weight:700;opacity:.8}
.kt2 .pgm-sw .pgm-key.is-off{color:#ff5a4a;opacity:1}
.kt2 .pgm-sw.busy{animation:pgmBusy .6s ease-in-out infinite alternate}
@keyframes pgmBusy{from{opacity:1}to{opacity:.45}}
.kt2 .tmd-bigdice.has-pgm{position:relative;padding-bottom:20px}
.kt2 .kd-pgm{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border:1px solid rgba(255,255,255,.14);border-radius:4px;background:transparent;color:rgba(255,255,255,.6);font:800 10px/1 var(--font, system-ui);letter-spacing:.1em;cursor:pointer;white-space:nowrap}
.kt2 .kd-pgm.on{color:#141218;background:var(--acid,#e4ff3a);border-color:transparent}
.kt2 .pgm-sw.pgm-solo{position:static;flex:none;justify-content:flex-start;gap:8px;height:28px;padding:0 10px;border-radius:0;font-size:10px;letter-spacing:.12em;color:rgba(255,255,255,.55);background:transparent}
.kt2 .pgm-sw.pgm-solo:hover{background:rgba(255,255,255,.06)}
.kt2 .pgm-sw.pgm-solo.on{color:#fff;background:transparent}
.kt2 .pgm-dot{width:10px;height:10px;flex:none;border:1px solid rgba(255,255,255,.4);background:transparent}
.kt2 .on>.pgm-dot{background:var(--acid,#e4ff3a);border-color:var(--acid,#e4ff3a)}
.kt2 .tmd-row.tmd-sidecol.is-side2>.pgm-solo{position:sticky;bottom:64px;z-index:3;width:100%;height:30px;background:#141318}
.kt2 .tmd-cards:not(.is-bigcards):not(.is-simple)>.pgm-solo{align-self:center;writing-mode:vertical-rl;transform:rotate(180deg);height:auto;width:22px;padding:8px 0;justify-content:center}
.kt2 .tmd-row.tmd-simple-on .pgm-sw.pgm-solo{display:flex!important}
.kt2 .kd-pgm.is-dot{border-radius:0;gap:7px}
.kt2 .kd-pgm.is-dot.on{color:#fff;background:transparent;border-color:rgba(255,255,255,.14)}
.kt2 .kd-pgm.busy{animation:pgmBusy .6s ease-in-out infinite alternate}
`;
  function addCss() { if (document.getElementById("kt2-pgmatch-css")) return; const s = document.createElement("style"); s.id = "kt2-pgmatch-css"; s.textContent = css; document.head.appendChild(s); }
  // the small switch at the bottom of the big ROLL tile (a span: the tile is a button). Clicks don't roll.
  function diceSwitchHtml(own) {
    if (off()) return "";
    addCss();
    return `<span class="pgm-sw${own ? " pgm-solo" : ""}${isOn("dice") ? " on" : ""}"${own ? ' id="tmd-pgm"' : ""} role="switch" tabindex="0" aria-checked="${isOn("dice")}" title="${LABEL}: ROLL fits what's already over this pattern">${own ? '<i class="pgm-dot"></i>' : ""}${LABEL}<span class="pgm-key${BADGE.off ? " is-off" : ""}" title="${BADGE.title}">${isOn("dice") ? BADGE.text : ""}</span></span>`;
  }
  // the own switch sits right before the ROLL tile, wherever the tile went (side column bottom, card row)
  function placeDice(rowEl) {
    const old = rowEl && rowEl.querySelector("#tmd-pgm"), big = rowEl && rowEl.querySelector(".tmd-bigdice");
    if (off() || !solo() || simpleBlocked() || !big) { if (old) old.remove(); return; }
    let el = old;
    if (!el) { const t = document.createElement("div"); t.innerHTML = diceSwitchHtml(true); el = t.firstElementChild; }
    // BIG (Eman, 15 Nov 17:10: "make PG MATCH a bigger button ... more satisfying"): a full-width square toggle, acid yellow
    // when on, instead of the dot. KT2_PGMATCH_DOT_OLD = the small dot
    // CHIP (Eman, 16 Nov 02:30: "skip making the pg match yellow, make it smaller, and just like a dot in front of the text when
    // its active"): a small dark square chip like the rest; on = a yellow dot before the name. KT2_PGMATCH_CHIP_OLD = the big yellow button
    const chip = !window.KT2_PGMATCH_DOT_OLD && !window.KT2_PGMATCH_CHIP_OLD;
    el.classList.toggle("pgm-big", !window.KT2_PGMATCH_DOT_OLD && !chip);
    el.classList.toggle("pgm-chip", chip);
    if (el.nextElementSibling !== big) big.parentElement.insertBefore(el, big);
  }
  function busy(el, v) { if (el) el.classList.toggle("busy", !!v); }

  window.KT2PGMatch = { LABEL, off, isOn, setOn, hearFor, notesFor, badge, grooveFor, fitKick, diceSwitchHtml, placeDice, solo, simpleBlocked, busy, addCss, keyName, last: () => last,
    _t: { gather, chroma, toNotes, harmonize, keyOf, fft } };
})();
