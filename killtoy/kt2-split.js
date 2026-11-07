// KILLTOY 2: a stem splitter that runs in the browser, for RECREATE THE SOUNDS.
// The Mac app splits with Demucs (the AI tools); the web page can't download those models, so
// this splits by sound instead (harmonic/percussive separation, Fitzgerald 2010): in a
// spectrogram, drums are short vertical lines (every pitch at once) and notes are long
// horizontal ones. A median across time keeps the notes, a median across pitch keeps the hits,
// and soft masks share each bit of sound between them. The notes are then cut at 160 Hz into
// bass and music. Vocals stay in "music": this is for turning a song into KILLDRUM and TOY
// MACHINE parts, not for clean acapellas.
//   KT2Split.split(audioBuffer, { onProgress }) -> { sampleRate, drums, bass, music } (mono Float32Arrays)
// Works at 22050 Hz mono (what the note finder uses too). Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  const SR = 22050, N = 1024, HOP = 256, BINS = N / 2 + 1, KT = 17, KF = 17, BASS_HZ = 160;
  const pause = () => new Promise((r) => setTimeout(r, 0));

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a), h = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < h; k++) {
          const p = i + k, q = p + h, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
          re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
          const nc = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nc;
        }
      }
    }
  }

  // mono at 22050 Hz
  function prepare(buf) {
    const n = buf.length, chs = buf.numberOfChannels, mono = new Float32Array(n);
    for (let c = 0; c < chs; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / chs; }
    const ratio = buf.sampleRate / SR;
    if (Math.abs(ratio - 1) < 1e-6) return mono;
    const m = Math.floor(n / ratio), out = new Float32Array(m);
    for (let i = 0; i < m; i++) {   // average over the source samples this one covers (a simple low-pass), then pick
      const a = i * ratio, z = Math.min(n, a + ratio);
      let s = 0, k = 0;
      for (let j = Math.floor(a); j < z; j++) { s += mono[j]; k++; }
      out[i] = k ? s / k : 0;
    }
    return out;
  }

  // median of k values of an array, step apart (k small: insertion sort)
  function median(src, start, step, k, tmp) {
    for (let i = 0; i < k; i++) {
      const v = src[start + i * step];
      let j = i - 1;
      while (j >= 0 && tmp[j] > v) { tmp[j + 1] = tmp[j]; j--; }
      tmp[j + 1] = v;
    }
    return tmp[k >> 1];
  }

  async function split(buf, opt = {}) {
    const prog = opt.onProgress || (() => {});
    const x = prepare(buf), len = x.length, frames = Math.max(1, Math.ceil(len / HOP) + 1);
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    const re = new Float32Array(N), im = new Float32Array(N);
    const frameIn = (f) => {
      const a = f * HOP - N / 2;
      for (let i = 0; i < N; i++) { const j = a + i; re[i] = j >= 0 && j < len ? x[j] * win[i] : 0; im[i] = 0; }
      fft(re, im);
    };
    // 1. magnitudes
    const mag = new Float32Array(frames * BINS);
    for (let f = 0; f < frames; f++) {
      frameIn(f);
      for (let b = 0; b < BINS; b++) mag[f * BINS + b] = Math.hypot(re[b], im[b]);
      if (f % 2000 === 0) { prog(0.05 + 0.15 * (f / frames)); await pause(); }
    }
    // 2. harmonic = median across time, percussive = median across pitch
    const H = new Float32Array(frames * BINS), P = new Float32Array(frames * BINS);
    const tmp = new Float32Array(Math.max(KT, KF)), col = new Float32Array(frames + KT);
    const ht = KT >> 1, hf = KF >> 1;
    for (let b = 0; b < BINS; b++) {
      for (let f = 0; f < frames + KT - 1; f++) { const g = Math.min(frames - 1, Math.max(0, f - ht)); col[f] = mag[g * BINS + b]; }
      for (let f = 0; f < frames; f++) H[f * BINS + b] = median(col, f, 1, KT, tmp);
      if (b % 64 === 0) { prog(0.2 + 0.25 * (b / BINS)); await pause(); }
    }
    const row = new Float32Array(BINS + KF);
    for (let f = 0; f < frames; f++) {
      for (let b = 0; b < BINS + KF - 1; b++) { const g = Math.min(BINS - 1, Math.max(0, b - hf)); row[b] = mag[f * BINS + g]; }
      for (let b = 0; b < BINS; b++) P[f * BINS + b] = median(row, b, 1, KF, tmp);
      if (f % 2000 === 0) { prog(0.45 + 0.25 * (f / frames)); await pause(); }
    }
    // 3. soft masks, back to sound (overlap-add); notes below BASS_HZ go to bass
    const outD = new Float32Array(len + N), outB = new Float32Array(len + N), outM = new Float32Array(len + N), norm = new Float32Array(len + N);
    const cut = Math.round((BASS_HZ / SR) * N);
    const rD = new Float32Array(N), iD = new Float32Array(N), rB = new Float32Array(N), iB = new Float32Array(N), rM = new Float32Array(N), iM = new Float32Array(N);
    const inv = (r, i) => { for (let k = 0; k < N; k++) i[k] = -i[k]; fft(r, i); for (let k = 0; k < N; k++) r[k] /= N; };
    for (let f = 0; f < frames; f++) {
      frameIn(f);
      for (let b = 0; b < BINS; b++) {
        const h = H[f * BINS + b], p = P[f * BINS + b], h2 = h * h, p2 = p * p, s = h2 + p2 + 1e-12;
        const mp = p2 / s, mh = h2 / s;
        const toBass = b <= cut, k2 = b === 0 || b === N / 2 ? -1 : N - b;
        const set = (R, I, m) => { R[b] = re[b] * m; I[b] = im[b] * m; if (k2 > 0) { R[k2] = re[k2] * m; I[k2] = im[k2] * m; } };
        set(rD, iD, mp);
        set(rB, iB, toBass ? mh : 0);
        set(rM, iM, toBass ? 0 : mh);
      }
      inv(rD, iD); inv(rB, iB); inv(rM, iM);
      const a = f * HOP - N / 2;
      for (let i = 0; i < N; i++) {
        const j = a + i;
        if (j < 0 || j >= len) continue;
        outD[j] += rD[i] * win[i]; outB[j] += rB[i] * win[i]; outM[j] += rM[i] * win[i]; norm[j] += win[i] * win[i];
      }
      if (f % 2000 === 0) { prog(0.7 + 0.3 * (f / frames)); await pause(); }
    }
    for (let j = 0; j < len; j++) { const w = norm[j] > 1e-6 ? 1 / norm[j] : 0; outD[j] *= w; outB[j] *= w; outM[j] *= w; }
    prog(1);
    return { sampleRate: SR, drums: outD.subarray(0, len), bass: outB.subarray(0, len), music: outM.subarray(0, len) };
  }

  const api = { split, prepare };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.KT2Split = api;
})();
