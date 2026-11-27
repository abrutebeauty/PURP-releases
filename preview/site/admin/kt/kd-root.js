// KILLDRUM: the root note of a one-shot (Eman, 14 Nov). Every pad sound is listened to once, so its MIDI
// editor shows the sound's own note (an 808 in C sits on C, one in F# on F#).
//
//   KdRoot.detect(float32Mono, sampleRate) -> { midi, hz, cents, conf } or { midi: null, conf } for unpitched sounds
//   KdRoot.snap(midiFloat) -> whole note: near C, or anywhere between C and C# (a slightly detuned sample), = C;
//                             only a sound that is clearly another note gets that note.
//
// How: YIN on a ~6 kHz copy, 80 ms frames every 20 ms, the first 60 ms skipped (an 808's pitch drop and a
// kick's click), then the loudness-weighted median of the clean frames. Plain JS, no libraries, ASCII only.
// Loads in Node too (module.exports) for tests/kt2/kdroot-unit.js.
(function (root) {
  "use strict";
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
  const name = (m) => NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);

  function snap(m) {
    if (m == null || !isFinite(m)) return null;
    const pc = ((m % 12) + 12) % 12, dc = pc > 6 ? pc - 12 : pc;   // how far from the nearest C (-6..6)
    if (dc >= -0.4 && dc <= 0.75) return Math.round(m - dc);       // C, or between C and C#: C
    return Math.round(m);
  }

  function detect(data, sr, opt) {
    opt = opt || {};
    if (!data || !data.length || !sr) return { midi: null, conf: 0 };
    const maxSec = opt.maxSeconds || 2.5;
    const D = Math.max(1, Math.floor(sr / 6000)), sr2 = sr / D;
    const n2 = Math.min(Math.floor(data.length / D), Math.floor(maxSec * sr2));
    if (n2 < sr2 * 0.1) return { midi: null, conf: 0 };
    // decimate with a box average (enough of a low-pass for finding a fundamental)
    const x = new Float32Array(n2);
    for (let i = 0; i < n2; i++) { let s = 0; for (let j = 0; j < D; j++) s += data[i * D + j] || 0; x[i] = s / D; }
    let mean = 0; for (let i = 0; i < n2; i++) mean += x[i]; mean /= n2; for (let i = 0; i < n2; i++) x[i] -= mean;
    const fLo = 27, fHi = 1100, tauMax = Math.ceil(sr2 / fLo), tauMin = Math.max(2, Math.floor(sr2 / fHi));
    const W = Math.ceil(tauMax * 1.6), hop = Math.round(sr2 * 0.02), skip = Math.round(sr2 * 0.06);
    if (n2 < W + tauMax + 1) return { midi: null, conf: 0 };
    const frames = [], d = new Float64Array(tauMax + 2);
    let maxRms = 0;
    for (let s = 0; s + W + tauMax < n2; s += hop) {
      let e = 0; for (let i = 0; i < W; i++) e += x[s + i] * x[s + i];
      const rms = Math.sqrt(e / W); frames.push({ s, rms }); if (rms > maxRms) maxRms = rms;
    }
    if (!(maxRms > 1e-5)) return { midi: null, conf: 0 };
    let wAll = 0; const got = [];
    for (const fr of frames) {
      if (fr.rms < maxRms * 0.08) continue;
      const late = fr.s >= skip, wt = fr.rms * (late ? 1 : 0.15);
      wAll += wt;
      // YIN difference + cumulative mean normalised difference
      for (let tau = 1; tau <= tauMax + 1; tau++) { let acc = 0; for (let i = 0; i < W; i++) { const v = x[fr.s + i] - x[fr.s + i + tau]; acc += v * v; } d[tau] = acc; }
      let run = 0; d[0] = 1;
      for (let tau = 1; tau <= tauMax + 1; tau++) { run += d[tau]; d[tau] = run > 0 ? d[tau] * tau / run : 1; }
      let tau = -1;
      for (let t = tauMin; t <= tauMax; t++) if (d[t] < 0.18) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
      if (tau < 0) { let best = tauMin; for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[best]) best = t; if (d[best] < 0.32) tau = best; }
      if (tau < 0) continue;
      const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = a - 2 * b + c, sh = den > 0 ? 0.5 * (a - c) / den : 0;
      const f0 = sr2 / (tau + Math.max(-0.5, Math.min(0.5, sh)));
      got.push({ m: hzToMidi(f0), w: wt * (1 - Math.min(0.9, b)) });
    }
    if (!got.length || !(wAll > 0)) return { midi: null, conf: 0 };
    // weighted median (an 808's tail drifting a little, a click frame, do not pull it)
    got.sort((p, q) => p.m - q.m);
    const tot = got.reduce((s, g) => s + g.w, 0); let acc = 0, med = got[0].m;
    for (const g of got) { acc += g.w; if (acc >= tot / 2) { med = g.m; break; } }
    // agreement: how much of the weight sits within half a semitone of it
    const near = got.reduce((s, g) => s + (Math.abs(g.m - med) < 0.5 || Math.abs(Math.abs(g.m - med) - 12) < 0.5 ? g.w : 0), 0);
    const conf = Math.min(1, (near / wAll) * 1.15);
    if (conf < 0.35) return { midi: null, conf: +conf.toFixed(2), raw: +med.toFixed(2) };
    const midi = snap(med);
    return { midi, name: name(midi), hz: +(440 * Math.pow(2, (med - 69) / 12)).toFixed(2), cents: Math.round((med - Math.round(med)) * 100), raw: +med.toFixed(2), conf: +conf.toFixed(2) };
  }

  const api = { detect, snap, name, NAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KdRoot = api;
})(typeof window !== "undefined" ? window : null);
