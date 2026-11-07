// Move notes inside real audio, chords too: "Make it major" and friends. Your own recording
// stays; only the notes that have to change are lifted out and put back a semitone (or more)
// higher or lower.
//
//   const out = NoteMove.render(audioBuffer, notes, moves, { onProgress });
//   // notes: Basic Pitch notes [{ start, end, pitch }] (ui/basicpitch.js)
//   // moves: (note) => semitones (0 = stays)
//   // out: { channels: [Float32Array...], moved, skipped }
//   const k = NoteMove.findKey(notes);              // { tonic 0..11, minor, score } from the notes
//   const f = NoteMove.toMajor(tonic);              // the moves for minor -> major on the same root
//   const g = NoteMove.toMinor(tonic);              // and major -> minor
//
// How: a short-time spectrum (4096 points, hop 1024). For each note that moves, the bins
// around its harmonics (f0, 2f0, ... up to 8 kHz) are taken out of the mix while the note
// sounds, and added back at the new pitch with a phase vocoder (each bin's true frequency,
// times the ratio, keeps its phase running). A harmonic that sits on top of a note that
// stays (common in chords) is left alone, so the staying note isn't dragged along: that's
// the "where possible". One-voice parts come out clean; dense chords can smear a little.
// Plain JS, no libraries. Also loads in Node (module.exports). ASCII only.
(function () {
  "use strict";

  const N = 4096, HOP = 1024, MAX_HZ = 8000;

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const p = i + k, q = p + len / 2;
          const tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
          re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------------------------------------------------------------------------
  // The key from the notes (Krumhansl-Kessler profiles, weighted by how long each note is).
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function keyScore(notes, tonic, minor) { return scorer(notes)(minor ? MIN : MAJ, tonic); }
  function findKey(notes) {
    const corr = scorer(notes);
    let best = { tonic: 0, minor: true, score: -2 };
    for (let t = 0; t < 12; t++) for (const minor of [true, false]) {
      const s = corr(minor ? MIN : MAJ, t);
      if (s > best.score) best = { tonic: t, minor, score: s };
    }
    return best;
  }
  function scorer(notes) {
    const h = new Array(12).fill(0);
    for (const q of notes) h[q.pitch % 12] += Math.min(4, q.end - q.start);
    return (p, t) => {
      const x = h.map((_, i) => h[(i + t) % 12]), mx = x.reduce((a, b) => a + b) / 12, mp = p.reduce((a, b) => a + b) / 12;
      let s = 0, sx = 0, sp = 0;
      for (let i = 0; i < 12; i++) { s += (x[i] - mx) * (p[i] - mp); sx += (x[i] - mx) ** 2; sp += (p[i] - mp) ** 2; }
      return sx && sp ? s / Math.sqrt(sx * sp) : 0;
    };
  }
  // Natural minor -> major on the same root: the 3rd, 6th and 7th go up a semitone.
  function toMajor(tonic) {
    const up = new Set([(tonic + 3) % 12, (tonic + 8) % 12, (tonic + 10) % 12]);
    return (q) => (up.has(q.pitch % 12) ? 1 : 0);
  }

  // ---------------------------------------------------------------------------
  function render(buf, notes, moves, { onProgress } = {}) {
    const sr = buf.sampleRate, chs = buf.numberOfChannels, len = buf.length, bins = N / 2 + 1, binHz = sr / N;
    const frames = Math.ceil((len + N) / HOP) + 1;
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    const norm = 1 / 1.5;   // Hann^2 at 75% overlap sums to 1.5

    // per frame: which bins move where. plan[f] = [{ k, ratio, w }]
    const moving = [], staying = [];
    for (const q of notes) (moves(q) ? moving : staying).push(q);
    const plan = new Array(frames);
    let moved = 0, skipped = 0;
    const mark = new Float32Array(bins), dest = new Float32Array(bins);
    for (let f = 0; f < frames; f++) {
      const t = (f * HOP - N / 2) / sr, pad = (N / 2) / sr;
      const act = moving.filter((q) => q.start - 0.03 < t + pad * 0.5 && q.end + 0.06 > t - pad * 0.5);
      if (!act.length) continue;
      const stay = staying.filter((q) => q.start < t + pad && q.end > t - pad);
      mark.fill(0);
      const list = [];
      for (const q of act) {
        const f0 = hz(q.pitch), ratio = Math.pow(2, moves(q) / 12);
        for (let h = 1; h * f0 < MAX_HZ && h <= 40; h++) {
          const fh = h * f0, wide = Math.max(1.3, (fh * 0.025) / binHz);
          // a harmonic this close to a staying note's harmonic is shared: leave it
          const shared = stay.some((s) => { const g = hz(s.pitch); const n = Math.round(fh / g); return n >= 1 && Math.abs(fh - n * g) < Math.max(1.2 * binHz, fh * 0.012); });
          if (shared) { skipped++; continue; }
          const c = fh / binHz;
          for (let k = Math.max(1, Math.floor(c - wide)); k <= Math.min(bins - 2, Math.ceil(c + wide)); k++) {
            const w = Math.max(0, 1 - Math.pow(Math.abs(k - c) / (wide + 0.5), 4));
            if (w > mark[k]) { if (!mark[k]) list.push(k); mark[k] = w; dest[k] = ratio; }
          }
        }
        moved++;
      }
      plan[f] = list.map((k) => ({ k, w: mark[k], ratio: dest[k] }));
    }

    const out = [];
    for (let ch = 0; ch < chs; ch++) {
      const x = buf.getChannelData(ch), y = new Float32Array(len);
      const lastPhase = new Float32Array(bins), rot = new Float64Array(bins);
      const re = new Float32Array(N), im = new Float32Array(N), ore = new Float32Array(bins), oim = new Float32Array(bins);
      for (let f = 0; f < frames; f++) {
        const o = f * HOP - N / 2;
        for (let i = 0; i < N; i++) { const j = o + i; re[i] = (j >= 0 && j < len ? x[j] : 0) * win[i]; im[i] = 0; }
        fft(re, im);
        const p = plan[f];
        const ph = new Float32Array(bins);
        for (let k = 0; k < bins; k++) ph[k] = Math.atan2(im[k], re[k]);
        if (p) {
          ore.fill(0); oim.fill(0);
          for (const { k, w, ratio } of p) {
            const mag = Math.hypot(re[k], im[k]) * w;
            // true frequency of bin k from the phase change since the last frame
            let d = ph[k] - lastPhase[k] - (2 * Math.PI * HOP * k) / N;
            d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
            const trueBin = k + (d * N) / (2 * Math.PI * HOP), to = trueBin * ratio, kk = k + Math.round(to - trueBin);   // the whole peak moves together
            re[k] *= 1 - w; im[k] *= 1 - w;
            if (kk < 1 || kk >= bins - 1) continue;
            // phase locking: the bin keeps its own phase from the audio (so the bins of one
            // harmonic stay lined up with each other) plus a turn that grows each frame by how
            // much faster the new pitch runs
            rot[k] += (2 * Math.PI * HOP * (to - trueBin)) / N;
            const a = ph[k] + rot[k];
            ore[kk] += mag * Math.cos(a); oim[kk] += mag * Math.sin(a);
          }
          for (let k = 1; k < bins - 1; k++) if (ore[k] || oim[k]) { re[k] += ore[k]; im[k] += oim[k]; }
        } else rot.fill(0);
        lastPhase.set(ph);
        // back to time: mirror the bins, inverse FFT via conj-FFT-conj
        for (let k = 1; k < N / 2; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
        for (let i = 0; i < N; i++) im[i] = -im[i];
        fft(re, im);
        for (let i = 0; i < N; i++) { const j = o + i; if (j >= 0 && j < len) y[j] += (re[i] / N) * win[i] * norm; }
        if (onProgress && (f & 63) === 0) onProgress((ch + f / frames) / chs);
      }
      out.push(y);
    }
    return { channels: out, moved, skipped };
  }

  // And back: major -> natural minor on the same root (3rd, 6th, 7th down a semitone).
  function toMinor(tonic) {
    const down = new Set([(tonic + 4) % 12, (tonic + 9) % 12, (tonic + 11) % 12]);
    return (q) => (down.has(q.pitch % 12) ? -1 : 0);
  }

  const api = { render, findKey, keyScore, toMajor, toMinor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.NoteMove = api;
})();
