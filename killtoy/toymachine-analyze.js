// TOY MACHINE: "drop a sound". Turns any short audio clip into a playable preset.
//
//   const r = await ToyMachineAnalyze.fromAudioBuffer(audioBuffer, { name: "my pluck" });
//   const r = await ToyMachineAnalyze.fromFile(file, audioContext);   // decode + analyse
//   // r.preset -> a toymachine/1 preset (see PRESET-FORMAT.md), macros already applied
//   // r.sample -> { data: Float32Array (mono, trimmed, DC-free, peak -0.2 dB), sampleRate, root, name }
//   // r.report -> { pitchHz, midi, cents, note, confidence, kind, category, harmonicity, noise,
//   //              envelope, table, blend, loop, pitchDrop, ms, notes: [plain-English lines] }
//   // The host gives r.sample.data to the engine (setSample) for sampler.file "dropped:<name>".
//
// Options: name, onProgress(stage, 0..1), maxSeconds (sample length kept, default 20),
// maxHarmonics (default 256), crossfadeLoop (default true), sustainLoop (default true: set
// sampler.loop only when the engine can loop sampler.loopStart..loopEnd).
//
// What it does: trims silence, finds the pitch (YIN + a harmonic check against octave slips),
// measures the harmonics over time (FFT, interpolated peaks at k*f0, phase-matched signs) and
// rebuilds them as a wavetable that sweeps like the original, measures the noise between the
// harmonics, the envelope, brightness and stereo width, finds a seamless sustain loop, and
// layers the original sample with the rebuilt synth (mostly synth for clean tones, mostly
// sample for phrases, hits and noises). Both layers are loudness-matched, so the
// "Original <-> Synth" macro crossfades without a jump.
//
// Preset layout it writes: ampEnv is a gate (the sample carries its own envelope); the
// rebuilt layer's level follows filterEnv through the mods (mod "filterEnv -> oscA.level",
// "-> noise.level"), so the sample is never enveloped twice. modEnv sweeps the wavetable
// (or does the pitch drop of an 808/kick).
//
// Plain browser JS, no libraries, no build step. Also loads in Node (module.exports).
// Keep this file ASCII-only.
(function (root) {
  "use strict";

  const TAU = Math.PI * 2;
  const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const dbOf = (g) => 20 * Math.log10(Math.max(g, 1e-12));
  const fromDb = (d) => Math.pow(10, d / 20);
  const nextPow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const r3 = (x) => Math.round(x * 1e3) / 1e3;
  const r2 = (x) => Math.round(x * 100) / 100;
  const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
  const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const noteName = (m) => { const n = Math.round(m); return NOTE[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); };
  const tick = () => new Promise((res) => setTimeout(res, 0));
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  // ---------------------------------------------------------------------------------------
  // FFT (in place, radix 2, complex)

  const plans = new Map();
  function plan(n) {
    let p = plans.get(n);
    if (p) return p;
    const bits = Math.round(Math.log2(n));
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }
    const cos = new Float64Array(n >> 1), sin = new Float64Array(n >> 1);
    for (let i = 0; i < n >> 1; i++) { cos[i] = Math.cos(TAU * i / n); sin[i] = -Math.sin(TAU * i / n); }
    p = { rev, cos, sin };
    plans.set(n, p);
    return p;
  }

  function fft(re, im, inverse) {
    const n = re.length, p = plan(n), rev = p.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    const sgn = inverse ? -1 : 1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = p.cos[k], wi = sgn * p.sin[k];
          const a = i + j, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  const hannCache = new Map();
  function hann(n) {
    let w = hannCache.get(n);
    if (w) return w;
    const a = new Float64Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) { a[i] = 0.5 - 0.5 * Math.cos(TAU * i / n); sum += a[i]; }
    w = { w: a, sum };
    hannCache.set(n, w);
    return w;
  }

  // Normalised Hann main-lobe magnitude at a fractional bin offset d (1 at d = 0).
  function hannLobe(d) {
    d = Math.abs(d);
    if (d < 1e-6) return 1;
    if (Math.abs(d - 1) < 1e-6) return 0.5;
    return Math.abs(Math.sin(Math.PI * d) / (Math.PI * d * (1 - d * d)));
  }

  // Zero-phase windowed spectrum centred on sample c. Returns power in P (length N/2+1).
  function spectrumAt(x, c, N, re, im, P) {
    const { w } = hann(N), half = N >> 1, len = x.length;
    for (let i = 0; i < N; i++) {
      const idx = c - half + i;
      re[(i + half) & (N - 1)] = idx >= 0 && idx < len ? x[idx] * w[i] : 0;
      im[i] = 0;
    }
    fft(re, im, false);
    for (let b = 0; b <= half; b++) P[b] = re[b] * re[b] + im[b] * im[b];
  }

  // ---------------------------------------------------------------------------------------
  // Small helpers

  function weightedMedian(vals, wts) {
    const idx = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
    let tot = 0;
    for (const i of idx) tot += wts[i];
    let acc = 0;
    for (const i of idx) { acc += wts[i]; if (acc >= tot / 2) return vals[i]; }
    return vals[idx[idx.length - 1]];
  }

  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  // TOY MACHINE envelope fall shape (same formula as the engine): 1 -> 0 over x = 0..1.
  function fall(x, curve) {
    if (x >= 1) return 0;
    if (x <= 0) return 1;
    const k = curve * 8;
    if (k < 1e-3) return 1 - x;
    const e = Math.exp(-k);
    return (Math.exp(-k * x) - e) / (1 - e);
  }
  function fallInv(y, curve) {   // x where fall(x) = y
    y = clamp(y, 0, 1);
    const k = curve * 8;
    if (k < 1e-3) return 1 - y;
    const e = Math.exp(-k);
    return clamp(-Math.log(y * (1 - e) + e) / k, 0, 1);
  }

  // Decimate by an integer factor with a windowed-sinc lowpass (linear phase, centred).
  function decimate(x, D) {
    if (D <= 1) return Float32Array.from(x);
    const taps = 16 * D + 1, half = taps >> 1, fc = 0.45 / D;
    const h = new Float64Array(taps);
    let hs = 0;
    for (let i = 0; i < taps; i++) {
      const n = i - half;
      const s = n === 0 ? 2 * fc : Math.sin(TAU * fc * n) / (Math.PI * n);
      const bw = 0.42 - 0.5 * Math.cos(TAU * i / (taps - 1)) + 0.08 * Math.cos(2 * TAU * i / (taps - 1));
      h[i] = s * bw; hs += h[i];
    }
    for (let i = 0; i < taps; i++) h[i] /= hs;
    const outLen = Math.floor(x.length / D), y = new Float32Array(outLen), len = x.length;
    for (let o = 0; o < outLen; o++) {
      const c = o * D;
      let acc = 0;
      const i0 = Math.max(0, c - half), i1 = Math.min(len - 1, c + half);
      for (let i = i0; i <= i1; i++) acc += x[i] * h[i - c + half];
      y[o] = acc;
    }
    return y;
  }

  // ---------------------------------------------------------------------------------------
  // 1. Prepare: mono, stereo width, trim, normalise

  function prepare(channels, sr, maxSeconds) {
    const nch = channels.length, n = channels[0].length;
    const mono = new Float32Array(n);
    let m2 = 0, s2 = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let c = 0; c < nch; c++) s += channels[c][i];
      mono[i] = s / nch;
      if (nch >= 2) {
        const mid = 0.5 * (channels[0][i] + channels[1][i]), side = 0.5 * (channels[0][i] - channels[1][i]);
        m2 += mid * mid; s2 += side * side;
      }
    }
    const width = nch >= 2 && m2 > 1e-12 ? Math.sqrt(s2 / m2) : 0;

    // trim on 2 ms block peaks
    const B = Math.max(1, Math.round(sr * 0.002)), nb = Math.ceil(n / B);
    const bp = new Float32Array(nb);
    let pk = 0;
    for (let b = 0; b < nb; b++) {
      let m = 0;
      for (let i = b * B, e = Math.min(n, i + B); i < e; i++) { const a = Math.abs(mono[i]); if (a > m) m = a; }
      bp[b] = m; if (m > pk) pk = m;
    }
    if (pk < 1e-5) return null;
    const onThr = pk * fromDb(-36), floorThr = Math.max(pk * fromDb(-60), 1e-6);
    let b0 = 0;
    while (b0 < nb && bp[b0] < onThr) b0++;
    let back = 0;
    while (b0 > 0 && back < 10 && bp[b0 - 1] > floorThr) { b0--; back++; }
    let b1 = nb - 1;
    while (b1 > b0 && bp[b1] < floorThr) b1--;
    let start = b0 * B, end = Math.min(n, (b1 + 1) * B + Math.round(sr * 0.02));
    const maxLen = Math.round(maxSeconds * sr);
    if (end - start > maxLen) end = start + maxLen;
    const len = Math.max(1, end - start);
    const data = new Float32Array(len);
    // remove DC (an offset would click every time the sample starts or stops), then normalise
    let dc = 0;
    for (let i = 0; i < len; i++) dc += mono[start + i];
    dc /= len;
    let pk2 = 0;
    for (let i = 0; i < len; i++) { const v = mono[start + i] - dc; data[i] = v; if (Math.abs(v) > pk2) pk2 = Math.abs(v); }
    if (pk2 < 1e-5) return null;   // nothing but an offset
    const g = 0.98 / pk2;
    for (let i = 0; i < len; i++) data[i] *= g;
    // short fades so the trimmed edges never click
    const fi = start > 0 ? Math.min(len >> 2, Math.round(sr * 0.001)) : 0;
    for (let i = 0; i < fi; i++) data[i] *= (i + 1) / (fi + 1);
    const fo = Math.min(len >> 2, Math.round(sr * 0.01));
    for (let i = 0; i < fo; i++) data[len - 1 - i] *= (i + 1) / (fo + 1);
    return { data, width, trimStart: start / sr, trimEnd: end / sr, gainDb: dbOf(g), origLen: n / sr };
  }

  // ---------------------------------------------------------------------------------------
  // 2. Pitch track: YIN on a decimated copy, difference function via FFT

  function yinTrack(x, sr) {
    const D = Math.max(1, Math.floor(sr / 16000));
    const y = decimate(x, D), fs = sr / D;
    const fmin = 30, fmax = Math.min(2000, fs / 4);
    const tauMax = Math.ceil(fs / fmin), tauMin = Math.max(2, Math.floor(fs / fmax));
    const W = tauMax;
    const need = W + tauMax + 2;
    let yy = y;
    if (yy.length < need) { yy = new Float32Array(need); yy.set(y); }
    const len = yy.length;
    const cs = new Float64Array(len + 1);
    for (let i = 0; i < len; i++) cs[i + 1] = cs[i] + yy[i] * yy[i];
    const N = nextPow2(W + tauMax + 1);
    const ar = new Float64Array(N), ai = new Float64Array(N), br = new Float64Array(N), bi = new Float64Array(N);
    const last = len - W - tauMax - 1;
    const hop = Math.max(Math.round(fs * 0.005), Math.ceil(Math.max(1, last) / 700));
    const frames = [];
    const dp = new Float64Array(tauMax + 1);
    for (let s = 0; s <= Math.max(0, last); s += hop) {
      ar.fill(0); ai.fill(0); br.fill(0); bi.fill(0);
      for (let j = 0; j < W; j++) ar[j] = yy[s + j];
      for (let j = 0; j < W + tauMax && s + j < len; j++) br[j] = yy[s + j];
      fft(ar, ai, false); fft(br, bi, false);
      for (let k = 0; k < N; k++) {   // conj(A) * B
        const re = ar[k] * br[k] + ai[k] * bi[k], im = ar[k] * bi[k] - ai[k] * br[k];
        br[k] = re; bi[k] = im;
      }
      fft(br, bi, true);
      const e0 = cs[s + W] - cs[s];
      dp[0] = 1;
      let run = 0;
      for (let t = 1; t <= tauMax; t++) {
        const et = cs[s + t + W] - cs[s + t];
        const d = Math.max(0, e0 + et - 2 * br[t]);
        run += d;
        dp[t] = run > 0 ? d * t / run : 1;
      }
      let best = -1;
      for (let t = tauMin; t < tauMax; t++) {
        if (dp[t] < 0.15) {
          while (t + 1 < tauMax && dp[t + 1] < dp[t]) t++;
          best = t; break;
        }
      }
      if (best < 0) {
        let mv = Infinity;
        for (let t = tauMin; t < tauMax; t++) if (dp[t] < mv) { mv = dp[t]; best = t; }
      }
      // octave guard: a clean dip at tau/k means tau was a multiple of the real period
      // (noisy sounds dip almost as deep at 2, 3, 4... periods; take the shortest one)
      const dBest = dp[best];
      for (let k = Math.min(24, Math.floor(best / (tauMin + 1))); k >= 2; k--) {
        const c = best / k;
        let lm = Math.round(c), mv = dp[lm];
        const w = Math.max(1, Math.round(c * 0.03));
        for (let t = Math.max(tauMin, Math.round(c) - w); t <= Math.min(tauMax - 1, Math.round(c) + w); t++) if (dp[t] < mv) { mv = dp[t]; lm = t; }
        if (mv < 0.45 && mv < dBest + 0.06 && dp[lm - 1] >= mv && dp[lm + 1] >= mv) { best = lm; break; }
      }
      let tau = best;
      if (best > 1 && best < tauMax) {
        const a = dp[best - 1], b = dp[best], c = dp[best + 1], den = a - 2 * b + c;
        if (Math.abs(den) > 1e-12) tau = best + clamp(0.5 * (a - c) / den, -0.5, 0.5);
      }
      frames.push({ t: (s + W / 2) * D / sr, f0: fs / tau, ap: clamp(dp[best], 0, 1), rms: Math.sqrt(e0 / W) });
    }
    return frames;
  }

  // The most stable pitched region of the track.
  function stablePitch(frames, dur) {
    let maxRms = 0;
    for (const f of frames) maxRms = Math.max(maxRms, f.rms);
    const live = maxRms * fromDb(-40);
    let totalW = 0;
    for (const f of frames) if (f.rms > live) totalW += f.rms;
    const runs = [];
    let cur = null, gap = 0, prevM = 0;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const voiced = f.rms > live && f.ap < 0.45;
      const m = hzToMidi(f.f0);
      if (voiced && cur && Math.abs(m - prevM) < 0.6) {
        cur.idx.push(i); cur.score += f.rms * (1 - f.ap); cur.mSum += m; cur.n++; prevM = cur.mSum / cur.n; gap = 0;
      } else if (cur && gap < 2) {
        gap++;   // one or two odd frames (an octave slip, a breath) don't end a note
      } else {
        if (cur) runs.push(cur);
        cur = voiced ? { idx: [i], score: f.rms * (1 - f.ap), mSum: m, n: 1 } : null;
        prevM = m; gap = 0;
      }
    }
    if (cur) runs.push(cur);
    let voicedW = 0;
    for (const f of frames) if (f.rms > live && f.ap < 0.45) voicedW += f.rms;
    if (!runs.length) return { f0: 0, conf: 0, stability: 0, voicedFrac: 0, run: null, runs: [] };
    runs.sort((a, b) => b.score - a.score);
    const run = runs[0];
    let runMax = 0;
    for (const i of run.idx) runMax = Math.max(runMax, frames[i].rms);
    // saturating weights: every reasonably loud frame counts the same (a loud attack can't bias it)
    const fs = run.idx.map((i) => frames[i].f0), ws = run.idx.map((i) => Math.min(1, frames[i].rms / (0.25 * runMax)) * (1 - frames[i].ap));
    const aps = run.idx.map((i) => frames[i].ap);
    const f0 = weightedMedian(fs, ws);
    const medAp = weightedMedian(aps, ws);
    const hopT = frames.length > 1 ? frames[1].t - frames[0].t : dur;
    const runDur = run.idx.length * hopT;
    let runW = 0;
    for (const i of run.idx) runW += frames[i].rms;
    // (breathy sounds sit around 0.3 aperiodicity, so that still counts as fairly sure)
    const q = clamp(1 - medAp / 0.6, 0, 1), lenF = clamp(runDur / Math.min(0.08, dur * 0.5 + 1e-3), 0, 1);
    // distinct notes among the strong runs (for spotting a melody / vocal phrase)
    const notes = new Set();
    for (const r of runs) {
      if (r.score < run.score * 0.15) continue;
      notes.add(Math.round(hzToMidi(weightedMedian(r.idx.map((i) => frames[i].f0), r.idx.map((i) => frames[i].rms)))));
    }
    return {
      f0, conf: q * lenF, medAp, stability: totalW > 0 ? runW / totalW : 0, voicedFrac: totalW > 0 ? voicedW / totalW : 0,
      run: { t0: frames[run.idx[0]].t, t1: frames[run.idx[run.idx.length - 1]].t, idx: run.idx }, runs, distinctNotes: notes.size,
    };
  }

  // ---------------------------------------------------------------------------------------
  // 3. Envelope: RMS curve + ADSR fit with the engine's own curve

  function rmsCurve(x, sr, winSec) {
    const hop = Math.max(1, Math.round(sr * Math.max(0.002, x.length / sr / 3000)));
    const win = Math.max(hop, Math.round(sr * winSec)), half = win >> 1;
    const n = Math.ceil(x.length / hop), out = new Float64Array(n);
    const cs = new Float64Array(x.length + 1);
    for (let i = 0; i < x.length; i++) cs[i + 1] = cs[i] + x[i] * x[i];
    for (let j = 0; j < n; j++) {
      const c = j * hop, a = Math.max(0, c - half), b = Math.min(x.length, c + half);
      out[j] = b > a ? Math.sqrt((cs[b] - cs[a]) / (b - a)) : 0;
    }
    return { v: out, dt: hop / sr };
  }

  // Fit d and curve of  s + (1 - s) * fall(t / d, curve)  to a dB curve (rel. peak).
  function fitFall(L, dt, s, dMin, dMax) {
    const pts = [];
    const step = Math.max(1, Math.floor(L.length / 200));
    for (let i = 0; i < L.length; i += step) pts.push([i * dt, L[i]]);
    let best = { d: dMax, curve: 0.5, err: Infinity };
    for (let ci = 0; ci <= 20; ci++) {
      const c = ci / 20;
      for (let di = 0; di <= 60; di++) {
        const d = dMin * Math.pow(dMax / dMin, di / 60);
        let err = 0;
        for (const [t, l] of pts) {
          const m = Math.max(-60, dbOf(s + (1 - s) * fall(t / d, c)));
          const w = 0.15 + Math.max(0, 1 + Math.max(l, m) / 45);   // the loud part matters most
          err += w * (m - l) * (m - l);
        }
        if (err < best.err) best = { d, curve: c, err };
      }
    }
    best.rmsErr = Math.sqrt(best.err / Math.max(1, pts.length));
    return best;
  }

  // corr(t), optional: dB the synth layer gets louder by itself at time t (its wavetable
  // frames differ in loudness); the envelope is fitted to the curve minus that.
  function envelope(x, sr, f0, corr) {
    const period = f0 > 0 ? 1 / f0 : 0;
    const { v, dt } = rmsCurve(x, sr, Math.max(0.01, 2 * period));
    let ip = 0, pk = 0;
    for (let i = 0; i < v.length; i++) if (v[i] > pk) { pk = v[i]; ip = i; }
    const L = Array.from(v, (a, i) => Math.max(-60, dbOf(a / pk) - (corr ? corr(i * dt) : 0)));
    // the "peak" is where it first gets within 1.5 dB of its loudest (a steady sound's
    // loudest wobble can come late)
    for (let i = 0; i < L.length; i++) if (L[i] >= -1.5) { ip = i; break; }
    const dur = x.length / sr, tPeak = ip * dt;
    const after = (lvl) => { for (let i = ip; i < L.length; i++) if (L[i] < lvl) return (i - ip) * dt; return dur - tPeak; };
    const t20 = after(-20), t40 = after(-40);

    // attack: peak follower with a window of about one period (min 1 ms)
    const B = Math.max(1, Math.round(sr * Math.max(0.001, period * 1.2)));
    const bpk = [];
    for (let i = 0; i < Math.min(x.length, Math.round((tPeak + 0.05) * sr) + B); i += Math.max(1, B >> 2)) {
      let m = 0;
      for (let j = i, e = Math.min(x.length, i + B); j < e; j++) { const a = Math.abs(x[j]); if (a > m) m = a; }
      bpk.push([i / sr, m]);
    }
    let apk = 0;
    for (const [, m] of bpk) apk = Math.max(apk, m);
    let t10 = 0, t90 = 0, f10 = false;
    for (const [t, m] of bpk) {
      if (!f10 && m >= 0.1 * apk) { t10 = t; f10 = true; }
      if (m >= 0.9 * apk) { t90 = t; break; }
    }
    let a = (t90 - t10) / 0.8;
    a = a < 0.004 ? clamp(a, 0.0005, 0.004) : a;

    // sustain or not
    const D = dur - tPeak;
    const i0 = Math.min(L.length - 1, Math.round((tPeak + 0.3 * D) / dt)), i1 = Math.min(L.length - 1, Math.round((tPeak + 0.8 * D) / dt));
    let sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0;
    const win = [];
    for (let i = i0; i <= i1; i++) { const t = i * dt; sx += t; sy += L[i]; sxx += t * t; sxy += t * L[i]; cnt++; win.push(L[i]); }
    const slope = cnt > 2 ? (cnt * sxy - sx * sy) / Math.max(1e-9, cnt * sxx - sx * sx) : -100;
    win.sort((p, q) => p - q);
    const med = win.length ? win[win.length >> 1] : -60;
    const sustained = D > 0.3 && slope > -7 && med > -26;

    let s = 0, d, curve, r, tRel = dur, susStart = tPeak, rmsErr;
    if (sustained) {
      s = clamp(fromDb(med), 0.02, 1);
      const sDb = dbOf(s);
      let j = ip;
      while (j < L.length - 1 && L[j] > sDb + 1) j++;
      susStart = j * dt;
      let k = L.length - 1;
      while (k > j && L[k] < sDb - 4) k--;
      tRel = k * dt;
      const dec = L.slice(ip, Math.max(ip + 2, j + 1));
      if (j - ip > 3 && s < 0.9) {
        const f = fitFall(dec, dt, s, 0.005, Math.max(0.02, (j - ip) * dt * 3));
        d = f.d; curve = f.curve; rmsErr = f.rmsErr;
      } else { d = Math.max(0.02, (j - ip) * dt); curve = 0.5; rmsErr = 0; }
      const rel = L.slice(k).map((l) => l - L[k]);
      const relDur = (L.length - 1 - k) * dt;
      if (relDur > 0.02) {
        const f = fitFall(rel, dt, 0, 0.01, Math.max(0.03, relDur * 2));
        r = f.d;
        if (!(j - ip > 3)) curve = f.curve;
      } else r = 0.06;
    } else {
      const dec = L.slice(ip);
      const f = fitFall(dec, dt, 0, 0.01, Math.max(0.05, D * 2.5));
      d = f.d; curve = f.curve; rmsErr = f.rmsErr; r = 0;
    }
    return { a, d, s, r, curve, sustained, tPeak, susStart, tRel, dur, t20, t40, peakRms: pk, curveDb: L, dt, rmsErr };
  }

  // ---------------------------------------------------------------------------------------
  // 4. Harmonics over time

  function harmonicFrameN(sr, f0) { return clamp(nextPow2(Math.ceil(7 * sr / f0)), 2048, 32768); }

  // Measure harmonics 1..nh around k*f0 in a power spectrum. Returns amps (linear, peak
  // amplitude units), phases (cos reference at the frame centre), freqs, and energies.
  function measureHarmonics(P, re, im, N, sr, f0, nh) {
    const df = sr / N, half = N >> 1, sumW = hann(N).sum;
    const amps = new Float64Array(nh), phs = new Float64Array(nh), frq = new Float64Array(nh);
    let harmE = 0;
    const lim = Math.min(half - 3, Math.floor(0.45 * sr / df));
    const mask = new Uint8Array(half + 1);
    for (let k = 1; k <= nh; k++) {
      const fk = k * f0;
      if (fk > 0.45 * sr) break;
      const b = fk / df, rad = Math.max(1, Math.round(0.2 * f0 / df));
      const lo = Math.max(2, Math.floor(b - rad)), hi = Math.min(lim, Math.ceil(b + rad));
      if (hi <= lo) break;
      let m = lo;
      for (let i = lo + 1; i <= hi; i++) if (P[i] > P[m]) m = i;
      const al = Math.log(Math.sqrt(P[m - 1]) + 1e-20), be = Math.log(Math.sqrt(P[m]) + 1e-20), ga = Math.log(Math.sqrt(P[m + 1]) + 1e-20);
      const den = al - 2 * be + ga;
      const p = Math.abs(den) > 1e-12 ? clamp(0.5 * (al - ga) / den, -0.5, 0.5) : 0;
      let A = Math.sqrt(P[m]) / hannLobe(p) * 2 / sumW;
      // valley floor between harmonics
      let vs = 0, vn = 0;
      for (const off of [-0.5, 0.5]) {
        const vb = (fk + off * f0) / df, vr = Math.max(1, Math.round(0.08 * f0 / df));
        for (let i = Math.max(1, Math.round(vb - vr)); i <= Math.min(half, Math.round(vb + vr)); i++) { vs += P[i]; vn++; }
      }
      const vP = vn ? vs / vn : 0;
      const floorA = Math.sqrt(vP) * 2 / sumW;
      A = A > 2.5 * floorA ? Math.sqrt(A * A - floorA * floorA) : 0;
      amps[k - 1] = A;
      phs[k - 1] = Math.atan2(im[m], re[m]);
      frq[k - 1] = (m + p) * df;
      let e = 0;
      for (let i = m - 2; i <= m + 2; i++) { if (i > 0 && i <= half && !mask[i]) { e += P[i]; mask[i] = 1; } }
      harmE += A > 0 ? Math.max(0, e - 5 * vP) : 0;
    }
    return { amps, phs, frq, harmE, mask };
  }

  // Noise between the harmonics: the valley floor half-way between partials (and under the
  // fundamental), minus what a clean partial leaks there (-35 dB of its peak). Returns the
  // noise energy, its mean log2 frequency and 1/3-octave densities.
  function valleyNoise(P, N, sr, f0, amps, leakIn) {
    const df = sr / N, half = N >> 1, sumW = hann(N).sum, sp = f0 / df, leak = leakIn || 3e-4;
    const pk = (k) => (k >= 1 && k <= amps.length ? Math.pow(amps[k - 1] * sumW / 2, 2) : 0);
    const bs = new Float64Array(NB), bn = new Float64Array(NB);
    let e = 0, lf = 0;
    const add = (fc, dens, bins) => {
      if (dens <= 0) return;
      e += dens * bins; lf += dens * bins * Math.log2(fc);
      const bi = Math.floor(3 * Math.log2(fc / 40));
      if (bi >= 0 && bi < NB) { bs[bi] += dens * bins; bn[bi] += bins; }
    };
    // under the fundamental
    if (0.6 * f0 > 50) {
      const b0 = Math.ceil(40 / df), b1 = Math.floor(0.6 * f0 / df);
      let v = 0, n = 0;
      for (let i = b0; i <= b1; i++) { v += P[i]; n++; }
      if (n) add(Math.sqrt(40 * 0.6 * f0), v / n - leak * pk(1), (0.6 * f0 - 40) / df);
    }
    for (let k = 1; (k + 0.5) * f0 < 0.45 * sr; k++) {
      const vb = (k + 0.5) * sp, vr = Math.max(1, Math.round(0.1 * sp));
      let v = 0, n = 0;
      for (let i = Math.max(1, Math.round(vb - vr)); i <= Math.min(half, Math.round(vb + vr)); i++) { v += P[i]; n++; }
      if (!n) continue;
      add((k + 0.5) * f0, v / n - leak * Math.max(pk(k), pk(k + 1)), sp);
    }
    const dens = new Float64Array(NB);
    for (let i = 0; i < NB; i++) dens[i] = bn[i] ? bs[i] / bn[i] : 0;
    return { resE: e, mlf: e > 0 ? lf / e : 10, dens };
  }

  // Power-weighted mean of log2(f) over unmasked bins (for matching noise colour), the
  // unmasked energy, and the total energy, in the band 40 Hz .. 0.45 sr.
  function residualStats(P, N, sr, mask, fLo) {
    const df = sr / N, b0 = Math.max(1, Math.ceil(Math.max(40, fLo || 0) / df)), b1 = Math.min(N >> 1, Math.floor(0.45 * sr / df));
    let tot = 0, res = 0, resLf = 0, used = 0, all = 0;
    const bs = new Float64Array(NB), bn = new Float64Array(NB);
    for (let b = b0; b <= b1; b++) {
      tot += P[b]; all++;
      if (mask && mask[b]) continue;
      res += P[b]; resLf += P[b] * Math.log2(b * df); used++;
      const bi = Math.floor(3 * Math.log2(b * df / 40));
      if (bi >= 0 && bi < NB) { bs[bi] += P[b]; bn[bi]++; }
    }
    const dens = new Float64Array(NB);
    for (let i = 0; i < NB; i++) dens[i] = bn[i] ? bs[i] / bn[i] : 0;   // power per bin (density)
    return { tot, res: used ? res * all / used : 0, mlf: res > 0 ? resLf / res : 10, dens };
  }

  const NB = 28;   // 1/3-octave bands from 40 Hz (band i starts at 40 * 2^(i/3))
  const bandHz = (i) => 40 * Math.pow(2, (i + 0.5) / 3);

  // Power response of the engine's SVF filter (analog prototype) at f.
  function svfPower(type, fc, res, f) {
    if (!type) return 1;
    const w = f / fc, k = 2 - 1.94 * res;
    const stage = (kk) => {
      const den = (1 - w * w) * (1 - w * w) + kk * kk * w * w;
      if (type === "lp12" || type === "lp24") return 1 / den;
      if (type === "hp12" || type === "hp24") return (w * w * w * w) / den;
      if (type === "bp12") return (kk * w) * (kk * w) / den;
      return 1;
    };
    return type === "lp24" || type === "hp24" ? stage(1.41421) * stage(k) : stage(k);
  }
  function colourPower(c, f, sr) {
    if (c === 0) return 1;
    const a = c < 0 ? 1 - Math.exp(-TAU * (200 * Math.pow(100, 1 + c)) / sr) : 1 - Math.exp(-TAU * 8000 * c / sr);
    const w = TAU * f / sr, den = 1 - 2 * (1 - a) * Math.cos(w) + (1 - a) * (1 - a);
    const lp = (a * a) / den;
    if (c < 0) return lp;
    // 1 - H for the high-pass
    const Hre = a * (1 - (1 - a) * Math.cos(w)) / den, Him = -a * (1 - a) * Math.sin(w) / den;
    return (1 - Hre) * (1 - Hre) + Him * Him;
  }
  // Mean log2 frequency (power weighted, flat density) of colour x filter, 40 Hz .. 0.45 sr.
  function chainMlf(c, filt, sr) {
    const n = 400, f1 = 0.45 * sr;
    let tot = 0, lf = 0;
    for (let i = 0; i < n; i++) {
      const f = 40 * Math.pow(f1 / 40, i / (n - 1));
      const p = colourPower(c, f, sr) * (filt ? svfPower(filt.type, Math.min(filt.cutoff, 0.45 * sr), filt.res, f) : 1) * f;
      tot += p; lf += p * Math.log2(f);
    }
    return lf / tot;
  }
  function matchColourChain(mlf, filt, sr) {
    let best = 0, be = Infinity;
    for (let i = -50; i <= 50; i++) {
      const c = i / 50, e = Math.abs(chainMlf(c, filt, sr) - mlf);
      if (e < be) { be = e; best = c; }
    }
    return best;
  }
  // Best colour + filter for a measured noise spectrum (1/3-octave densities). Tries a few
  // filter shapes around the band edges and every colour; the error is the mean dB
  // difference over the bands that matter.
  function fitNoiseShape(dens, sr, fl, fh, forced) {
    let nb = 0, top = 0;
    for (let i = 0; i < NB; i++) if (bandHz(i) < 0.45 * sr) { nb = i + 1; top = Math.max(top, dens[i]); }
    if (top <= 0) return { shape: forced || null, colour: 0 };
    const meas = [];
    for (let i = 0; i < nb; i++) meas.push(Math.max(-50, 10 * Math.log10(dens[i] / top + 1e-12)));
    const cands = [];
    if (forced) cands.push(forced);
    else {
      cands.push(null);
      if (fl > 120) for (const m of [0.6, 0.8, 1, 1.3]) cands.push({ type: "hp24", cutoff: Math.round(fl * m), res: 0.05, env: 0 });
      if (fh < 0.3 * sr) for (const m of [0.7, 1, 1.4]) cands.push({ type: "lp24", cutoff: Math.round(Math.min(20000, fh * m)), res: 0.05, env: 0 });
      if (fl > 120 && fh < 0.3 * sr && fh > fl * 2) cands.push({ type: "bp12", cutoff: Math.round(Math.sqrt(fl * fh)), res: 0.05, env: 0 });
    }
    let best = null;
    for (const sh of cands) {
      const fc = sh ? clamp(sh.cutoff * Math.pow(2, sh.env || 0), 20, 0.45 * sr) : 0;
      for (let ci = -25; ci <= 25; ci++) {
        const c = ci / 25, model = [];
        let mt = -Infinity;
        for (let i = 0; i < nb; i++) {
          const f = bandHz(i), pw = colourPower(c, f, sr) * (sh ? svfPower(sh.type, fc, sh.res, f) : 1);
          const d = 10 * Math.log10(pw + 1e-20);
          model.push(d); mt = Math.max(mt, d);
        }
        // weighted by how loud the band is in either (energy where there is none, or none
        // where there is energy, both count; differences far under the top don't)
        let e = 0, n = 0;
        for (let i = 0; i < nb; i++) {
          const md = Math.max(-50, model[i] - mt), w = Math.pow(10, Math.max(md, meas[i]) / 20);
          e += w * Math.abs(md - meas[i]); n += w;
        }
        e = n ? e / n : 99;
        if (!best || e < best.err) best = { shape: sh, colour: c, err: e };
      }
    }
    return best;
  }

  // RMS of the engine's noise source after colour and filter (same maths as the engine).
  function simNoiseRms(c, filt, sr) {
    const a = c < 0 ? 1 - Math.exp(-TAU * (200 * Math.pow(100, 1 + c)) / sr) : 1 - Math.exp(-TAU * 8000 * c / sr);
    const type = filt ? filt.type : null, stages = type === "lp24" || type === "hp24" ? 2 : 1;
    const fc = filt ? Math.min(filt.cutoff, 0.45 * sr) : 0, g = filt ? Math.tan(Math.PI * fc / sr) : 0, kres = filt ? 2 - 1.94 * filt.res : 0;
    const z1 = [0, 0], z2 = [0, 0];
    let s = 0x2545f491 >>> 0, lp = 0, acc = 0;
    const n = 16384;
    for (let i = 0; i < n + 2048; i++) {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      const wv = ((s >>> 8) / 16777216) * 2 - 1;
      lp += a * (wv - lp);
      let x = c < 0 ? lp : c > 0 ? wv - lp : wv;
      if (type) {
        for (let st = 0; st < stages; st++) {
          const k = stages === 2 && st === 0 ? 1.41421 : kres;
          const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
          const v3 = x - z2[st], v1 = a1 * z1[st] + a2 * v3, v2 = z2[st] + a2 * z1[st] + a3 * v3;
          z1[st] = 2 * v1 - z1[st]; z2[st] = 2 * v2 - z2[st];
          x = type[0] === "l" ? v2 : type[0] === "h" ? x - k * v1 - v2 : type === "bp12" ? v1 * k : x;
        }
      }
      if (i >= 2048) acc += x * x;
    }
    return Math.sqrt(acc / n);
  }

  // Spectral centroid and 85% roll-off of a power spectrum.
  function brightnessOf(P, N, sr) {
    const df = sr / N, b1 = Math.min(N >> 1, Math.floor(0.45 * sr / df));
    let tot = 0, c = 0;
    for (let b = 1; b <= b1; b++) { tot += P[b]; c += P[b] * b * df; }
    if (tot <= 0) return { centroid: 0, rolloff: 0, tot: 0 };
    let acc = 0, ro = b1 * df;
    for (let b = 1; b <= b1; b++) { acc += P[b]; if (acc >= 0.85 * tot) { ro = b * df; break; } }
    return { centroid: c / tot, rolloff: ro, tot };
  }

  // Waveform (one cycle) of a sine-phase harmonic frame: RMS after peak normalisation.
  function frameRmsNorm(amps) {
    const n = 2048;
    let pk = 0, ss = 0;
    const y = new Float64Array(n);
    for (let k = 0; k < amps.length; k++) {
      const a = amps[k];
      if (!a) continue;
      for (let i = 0; i < n; i++) y[i] += a * Math.sin(TAU * (k + 1) * i / n);
    }
    for (let i = 0; i < n; i++) { pk = Math.max(pk, Math.abs(y[i])); ss += y[i] * y[i]; }
    return pk > 0 ? Math.sqrt(ss / n) / pk : 0.7071;
  }

  function stretchFrame(amps, f, signs) {
    const out = new Array(amps.length).fill(0);
    for (let k = 1; k <= amps.length; k++) {
      const pos = k / f;   // harmonic position (1-based) in the source
      let v;
      if (pos <= 1) v = Math.abs(amps[0]);
      else {
        const i = Math.floor(pos), t = pos - i;
        const a = Math.abs(amps[i - 1] || 0), b = Math.abs(amps[i] || 0);
        v = a + (b - a) * t;
      }
      out[k - 1] = v * (signs[k - 1] || 1);
    }
    return out;
  }

  function cleanFrame(amps) {
    let pk = 0;
    for (const a of amps) pk = Math.max(pk, Math.abs(a));
    if (pk <= 0) return [1];
    const out = amps.map((a) => (Math.abs(a / pk) < 1e-4 ? 0 : r4(a / pk)));
    let n = out.length;
    while (n > 1 && out[n - 1] === 0) n--;
    return out.slice(0, n);
  }

  // ---------------------------------------------------------------------------------------
  // 5. Sustain loop: zero crossings with matched slope and matching neighbourhoods

  function findLoop(x, sr, f0, t0, t1) {
    if (t1 - t0 < 0.25) return null;
    const P = f0 > 0 ? sr / f0 : Math.round(sr * 0.01);
    const up = (i) => x[i - 1] < 0 && x[i] >= 0;
    const w = Math.max(16, Math.round(Math.min(2 * P, sr * 0.012)));
    const s0 = Math.round(t0 * sr) + w, e0 = Math.round(t1 * sr) - w - 1;
    if (e0 - s0 < sr * 0.1) return null;
    const score = (s, e) => {
      let d = 0, en = 0;
      for (let j = -w; j < w; j++) { const a = x[s + j], b = x[e + j]; d += (a - b) * (a - b); en += a * a + b * b; }
      return en > 0 ? d / en : 1;
    };
    const ends = [];
    for (let i = e0; i > e0 - 3 * P && i > s0; i--) if (up(i)) ends.push(i);
    const targetLen = Math.min(e0 - s0, Math.round(sr * 2));
    let best = null;
    for (const e of ends.slice(0, 6)) {
      const nPer = Math.max(4, Math.floor(targetLen / P));
      for (let m = nPer; m >= Math.max(2, nPer - 6); m--) {
        const sc = Math.round(e - m * P);
        for (let s = Math.max(s0, Math.round(sc - P / 2)); s <= Math.min(e - Math.round(sr * 0.05), Math.round(sc + P / 2)); s++) {
          if (!up(s)) continue;
          const slopeS = x[s] - x[s - 1], slopeE = x[e] - x[e - 1];
          const slopeErr = Math.abs(slopeS - slopeE) / (Math.abs(slopeS) + Math.abs(slopeE) + 1e-9);
          const sc2 = score(s, e) + 0.1 * slopeErr;
          if (!best || sc2 < best.score) best = { start: s, end: e, score: sc2 };
        }
      }
    }
    if (!best || best.score > 0.25) return null;
    return best;
  }

  function bakeLoopCrossfade(data, sr, loop) {
    const len = loop.end - loop.start;
    const xf = Math.min(Math.round(len * 0.25), Math.round(sr * 0.03), loop.start);
    for (let j = 0; j < xf; j++) {
      const t = (j + 1) / (xf + 1), i = loop.end - xf + j;
      data[i] = data[i] * (1 - t) + data[loop.start - xf + j] * t;
    }
    return xf;
  }

  // ---------------------------------------------------------------------------------------
  // The analysis

  async function analyse(channels, sr, opts) {
    opts = opts || {};
    const T0 = now();
    const progress = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
    const rawName = String(opts.name || "Dropped Sound").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_]+/g, " ").trim();
    const name = (rawName || "Dropped Sound").slice(0, 40);

    progress("trim", 0);
    const prep = prepare(channels, sr, opts.maxSeconds || 20);
    if (!prep) throw new Error("That sound is silent, nothing to analyse.");
    const x = prep.data, dur = x.length / sr;
    const ana = x.length > sr * 12 ? x.subarray(0, Math.round(sr * 12)) : x;   // analyse up to 12 s
    const anaDur = ana.length / sr;
    await tick();

    // ---- pitch
    progress("pitch", 0.15);
    const track = yinTrack(ana, sr);
    const sp = stablePitch(track, anaDur);
    let f0 = sp.f0;
    await tick();

    // ---- refine f0 with harmonic peaks and fix octave errors
    if (f0 > 0 && sp.conf > 0.2) {
      const N = harmonicFrameN(sr, f0 / 2);
      const re = new Float64Array(N), im = new Float64Array(N), P = new Float64Array((N >> 1) + 1);
      const ti = sp.run.idx;
      // loudest frames in the run
      let tmax = 0;
      for (const i of ti) tmax = Math.max(tmax, track[i].rms);
      const loud = ti.filter((i) => track[i].rms > 0.25 * tmax);
      const cand = [];
      for (let q = 0; q < 7; q++) cand.push(loud[Math.min(loud.length - 1, Math.round((q + 0.5) / 7 * (loud.length - 1)))]);
      const ests = [], wts = [];
      let oddHalf = 0, onF = 0;
      const mult = { 2: [0, 0], 3: [0, 0] };   // [energy on multiples of m, energy elsewhere]
      for (const i of cand) {
        const c = Math.round(track[i].t * sr);
        spectrumAt(ana, c, N, re, im, P);
        const h = measureHarmonics(P, re, im, N, sr, f0 / 2, 16);
        for (let k = 1; k <= 16; k++) { const a = h.amps[k - 1] * h.amps[k - 1]; if (k % 2) oddHalf += a; else onF += a; }
        const g = measureHarmonics(P, re, im, N, sr, f0, 24);
        for (let k = 1; k <= 24; k++) {
          const a = g.amps[k - 1] * g.amps[k - 1];
          for (const m of [2, 3]) mult[m][k % m ? 1 : 0] += a;
        }
      }
      if (oddHalf > 0.6 * onF && onF > 0 && f0 / 2 >= 30) f0 /= 2;                       // half-period peaks: real f0 is lower
      else {
        // nearly all the energy on every 2nd / 3rd harmonic: the pitch is really 2x / 3x higher
        for (const m of [3, 2]) if (mult[m][0] > 0 && mult[m][1] < 0.12 * mult[m][0] && f0 * m < 2000) { f0 *= m; break; }
      }
      for (const i of cand) {
        const c = Math.round(track[i].t * sr);
        spectrumAt(ana, c, N, re, im, P);
        const h = measureHarmonics(P, re, im, N, sr, f0, 8);
        for (let k = 1; k <= 8; k++) if (h.amps[k - 1] > 0 && Math.abs(h.frq[k - 1] / k / f0 - 1) < 0.03) { ests.push(h.frq[k - 1] / k); wts.push(h.amps[k - 1] * Math.sqrt(k)); }
      }
      if (ests.length) f0 = weightedMedian(ests, wts);
    }

    // ---- pitch drop at the start (808s, kicks, zaps): the pitch falls into the main note
    let pitchDrop = null;
    if (f0 > 0 && sp.conf >= 0.4 && sp.run && sp.run.t0 < 0.3) {
      let tmx = 0;
      for (const f of track) tmx = Math.max(tmx, f.rms);
      const m0 = hzToMidi(f0);
      const early = track.filter((f) => f.t <= sp.run.t0 + 0.01 && f.ap < 0.35 && f.rms > tmx * 0.05);
      if (early.length >= 2) {
        let d0 = 0;
        for (const f of early.slice(0, 3)) d0 = Math.max(d0, hzToMidi(f.f0) - m0);
        let falling = 0;
        for (let i = 1; i < early.length; i++) if (early[i].f0 <= early[i - 1].f0 * 1.01) falling++;
        if (d0 > 1 && d0 < 48 && falling >= 0.7 * (early.length - 1)) {
          let tEnd = sp.run.t0;
          for (const f of early) if (hzToMidi(f.f0) - m0 < 0.15 * d0) { tEnd = f.t; break; }
          pitchDrop = { semis: r2(d0), time: r3(Math.max(0.005, tEnd - early[0].t)) };
        }
      }
    }

    // ---- envelope
    progress("envelope", 0.3);
    const env = envelope(x, sr, f0 > 0 && sp.conf > 0.3 ? f0 : 0);
    await tick();

    // ---- spectra over time (harmonics if pitched, brightness and noise always)
    progress("harmonics", 0.45);
    const pitchedGuess = f0 > 0 && sp.conf >= 0.4;
    // a melody / phrase: measure each moment at its own pitch
    const moving = pitchedGuess && !pitchDrop && sp.distinctNotes >= 2 && sp.stability < 0.5;
    let minF = f0, maxF = f0;
    if (moving) for (const r of sp.runs) {
      if (r.score < sp.runs[0].score * 0.15) continue;
      const m = weightedMedian(r.idx.map((i) => track[i].f0), r.idx.map((i) => track[i].rms));
      if (m > f0 / 4.1 && m < f0 * 4.1) { minF = Math.min(minF, m); maxF = Math.max(maxF, m); }
    }
    const N = pitchedGuess ? harmonicFrameN(sr, Math.max(30, minF)) : nextPow2(Math.round(sr * 0.046));
    const re = new Float64Array(N), im = new Float64Array(N), P = new Float64Array((N >> 1) + 1);
    const nh = pitchedGuess ? Math.max(1, Math.min(opts.maxHarmonics || 256, Math.floor(0.45 * sr / f0))) : 0;
    const anaEnd = Math.min(anaDur, Math.max(env.tRel + 0.05, env.tPeak + 0.05));
    const hops = clamp(Math.round(anaEnd / 0.01), 8, f0 > 0 && f0 < 70 ? 70 : 110);
    const traj = [];
    for (let j = 0; j < hops; j++) {
      const t = (j / (hops - 1)) * anaEnd;
      const c = Math.round(t * sr);
      spectrumAt(ana, c, N, re, im, P);
      const br = brightnessOf(P, N, sr);
      let lvl = 0;
      { const li = Math.min(env.curveDb.length - 1, Math.round(t / env.dt)); lvl = env.curveDb[li]; }
      const hop = { t, lvl, centroid: br.centroid, rolloff: br.rolloff, tot: br.tot, inDrop: !!(pitchDrop && sp.run && t < sp.run.t0 + 0.01) };
      if (pitchedGuess) {
        // local f0: the YIN track if it agrees with the main pitch (vibrato, small drift), else the main pitch
        let lf = f0;
        let bi = 0, bd = Infinity;
        for (let i = 0; i < track.length; i++) { const d = Math.abs(track[i].t - t); if (d < bd) { bd = d; bi = i; } }
        const tf = track[bi];
        if (tf && tf.ap < 0.3) {
          let cand = tf.f0;
          for (const mul of [0.5, 2]) if (Math.abs(hzToMidi(tf.f0 * mul) - hzToMidi(f0)) < Math.abs(hzToMidi(cand) - hzToMidi(f0))) cand = tf.f0 * mul;
          if (Math.abs(hzToMidi(cand) - hzToMidi(f0)) < 1) lf = cand;
          else if (moving && tf.f0 >= minF * 0.94 && tf.f0 <= maxF * 1.06) lf = tf.f0;
          else if (pitchDrop && sp.run && t <= sp.run.t0 + 0.01 && tf.f0 > f0 && tf.f0 < f0 * 16) lf = tf.f0;
        }
        const h = measureHarmonics(P, re, im, N, sr, lf, nh);
        // a partial that decays fast is spectrally wide (Lorentzian, half-width 1/(2 pi tau)):
        // allow for its skirt half-way to the next harmonic before calling anything noise
        let leak = 3e-4;
        {
          const i0 = Math.max(0, Math.round((t - 0.02) / env.dt)), i1 = Math.min(env.curveDb.length - 1, Math.round((t + 0.02) / env.dt));
          const slope = i1 > i0 ? (env.curveDb[i1] - env.curveDb[i0]) / ((i1 - i0) * env.dt) : 0;   // dB per second
          if (slope < -1) { const g = Math.abs(slope) / 8.686 / TAU; leak = Math.max(leak, Math.min(0.5, 2 * Math.pow(g / (0.5 * lf), 2))); }
        }
        const vn = valleyNoise(P, N, sr, lf, h.amps, leak);
        hop.amps = h.amps; hop.phs = h.phs; hop.harmE = h.harmE; hop.resE = vn.resE; hop.resMlf = vn.mlf; hop.dens = vn.dens;
      } else {
        const rs = residualStats(P, N, sr, null);
        hop.harmE = 0; hop.resE = rs.tot; hop.resMlf = rs.mlf; hop.dens = rs.dens;
      }
      traj.push(hop);
      if (j % 16 === 15) await tick();
    }

    // energy-weighted totals
    let hE = 0, rE = 0, cW = 0, cS = 0;
    for (const h of traj) {
      const w = fromDb(h.lvl);
      if (h.lvl < -40) continue;
      cS += Math.log2(Math.max(20, h.centroid)) * h.tot * w; cW += h.tot * w;
      if (h.inDrop) continue;   // a falling pitch smears the partials; that's not noise
      hE += h.harmE * w; rE += h.resE * w;
    }
    const harmonicity = hE + rE > 0 ? hE / (hE + rE) : 0;
    const centroid = cW > 0 ? Math.pow(2, cS / cW) : 1000;

    // ---- what kind of sound is it
    const pitched = pitchedGuess && harmonicity > 0.3;
    let kind;
    if (!pitched) kind = env.sustained || dur > 1.2 ? "noise" : "percussive";
    else if (!pitchDrop && sp.distinctNotes >= 3 && sp.stability < 0.5) kind = "phrase";
    else if (!pitchDrop && sp.stability < 0.3 && sp.distinctNotes >= 2) kind = "phrase";
    else if (!env.sustained && dur < 0.7 && harmonicity < 0.65) kind = "percussive";   // a tuned hit (kick, tom, zap)
    else if (!env.sustained && env.t40 < 0.6 && f0 < 90 && (pitchDrop || harmonicity < 0.85)) kind = "percussive";   // a kick
    else if (harmonicity >= 0.72) kind = "tonal";
    else if (harmonicity >= 0.42) kind = "breathy";
    else kind = "complex";
    const midiExact = pitched ? hzToMidi(f0) : 60;
    const midi = Math.round(midiExact), cents = pitched ? Math.round((midiExact - midi) * 100) : 0;

    progress("build", 0.75);
    await tick();

    // ---- wavetable frames
    let frames = null, signs = null, evolve = null, oddRatio = 0, brightRatio = 0, nNat = 0;
    if (pitched) {
      // signs from the measured phase relationships at the loudest stable hop
      let ref = 0, rb = -Infinity;
      for (let j = 0; j < traj.length; j++) {
        const inRun = !sp.run || (traj[j].t >= sp.run.t0 - 0.02 && traj[j].t <= sp.run.t1 + 0.02);
        const sc = traj[j].lvl + (inRun ? 0 : -20);
        if (sc > rb) { rb = sc; ref = j; }
      }
      const rh = traj[ref];
      signs = new Array(nh).fill(1);
      const p1 = rh.phs[0] + Math.PI / 2;
      for (let k = 1; k <= nh; k++) {
        const r = rh.phs[k - 1] + Math.PI / 2 - k * p1;
        signs[k - 1] = Math.cos(r) >= 0 ? 1 : -1;
      }
      // spectral progress over time (on hops loud enough to matter)
      const vecs = traj.map((h) => {
        const v = Array.from(h.amps, (a) => Math.sqrt(a));
        let n2 = 0;
        for (const a of v) n2 += a * a;
        n2 = Math.sqrt(n2) || 1;
        return v.map((a) => a / n2);
      });
      const prog = [0];
      for (let j = 1; j < traj.length; j++) {
        let d = 0;
        if (traj[j].lvl > -35 && traj[j - 1].lvl > -35) {
          for (let k = 0; k < nh; k++) { const e = vecs[j][k] - vecs[j - 1][k]; d += e * e; }
          d = Math.sqrt(d) * Math.min(1, fromDb(traj[j].lvl + 20));
        }
        prog.push(prog[j - 1] + d);
      }
      const total = prog[prog.length - 1];
      const avgAmps = (j0, j1, wfun) => {
        const acc = new Float64Array(nh);
        let ws = 0;
        for (let j = j0; j <= j1; j++) {
          const w = wfun(j);
          if (w <= 0) continue;
          let pk = 0;
          for (let k = 0; k < nh; k++) pk = Math.max(pk, traj[j].amps[k]);
          if (pk <= 0) continue;
          for (let k = 0; k < nh; k++) acc[k] += traj[j].amps[k] / pk * w;
          ws += w;
        }
        return ws > 0 ? Array.from(acc, (a) => a / ws) : null;
      };
      const signed = (amps) => amps.map((a, k) => a * signs[k]);
      let nat = [];
      if (pitchDrop || total < 0.12 || traj.length < 6) {
        // static table (a pitch drop needs modEnv, so its table stays still: measured after the drop)
        const tAfter = pitchDrop && sp.run ? sp.run.t0 + 0.01 : -1;
        const a = avgAmps(0, traj.length - 1, (j) => (traj[j].lvl > -30 && traj[j].t >= tAfter ? fromDb(traj[j].lvl) : 0)) || Array.from(rh.amps);
        nat = [a];
        evolve = null;
      } else {
        let jT = prog.length - 1;
        while (jT > 1 && prog[jT - 1] >= 0.97 * total) jT--;
        const T = Math.max(0.03, traj[jT].t);
        // fit the modEnv curve to the progress shape
        let bc = 0.5, be = Infinity;
        for (let ci = 0; ci <= 20; ci++) {
          const c = ci / 20;
          let e = 0;
          for (let j = 0; j <= jT; j++) { const m = 1 - fall(traj[j].t / T, c), d = prog[j] / total - m; e += d * d; }
          if (e < be) { be = e; bc = c; }
        }
        nNat = total < 0.6 ? 4 : total < 1.5 ? 7 : 10;
        const times = [];
        for (let i = 0; i < nNat; i++) times.push(T * fallInv(1 - i / (nNat - 1), bc));
        const spacing = Math.max(0.005, T / nNat);
        for (let i = 0; i < nNat; i++) {
          const ti = times[i], hw = i === 0 ? spacing * 0.3 : spacing * 0.5;
          const a = avgAmps(0, traj.length - 1, (j) => {
            const d = Math.abs(traj[j].t - ti);
            return d <= hw + 1e-9 ? 1 - d / (hw * 1.5 + 1e-9) : 0;
          });
          if (a) nat.push(a);
          else {
            let bj = 0, bd = Infinity;
            for (let j = 0; j < traj.length; j++) { const d = Math.abs(traj[j].t - ti); if (d < bd) { bd = d; bj = j; } }
            let pk = 0; for (const v of traj[bj].amps) pk = Math.max(pk, v);
            nat.push(Array.from(traj[bj].amps, (v) => (pk > 0 ? v / pk : 0)));
          }
        }
        evolve = { T, curve: bc, total, times };
      }
      // character (from the main frame)
      const main = nat[evolve ? Math.min(nat.length - 1, 1) : 0];
      let odd = 0, even = 0, low = 0, high = 0;
      for (let k = 2; k <= Math.min(nh, 20); k++) { const e = main[k - 1] * main[k - 1]; if (k % 2) odd += e; else even += e; }
      for (let k = 1; k <= nh; k++) { const e = main[k - 1] * main[k - 1]; if (k <= 3) low += e; else high += e; }
      oddRatio = odd + even > 0 ? odd / (odd + even) : 0.5;
      brightRatio = low + high > 0 ? high / (low + high) : 0;
      // three extra "morph" frames past the natural ones: the last frame with its formants pushed up
      const lastNat = nat[nat.length - 1];
      const extra = [1.35, 1.8, 2.4].map((f) => stretchFrame(lastNat, f, signs).map(Math.abs));
      frames = nat.concat(extra).map((a) => cleanFrame(signed(a)));
    }

    // ---- brightness change (unpitched sounds use the filter + its envelope for this)
    let early = 0, late = 0, ew = 0, lw = 0;
    for (const h of traj) {
      if (h.lvl < -40 || h.rolloff <= 0) continue;
      const w = fromDb(h.lvl);
      if (h.t <= env.tPeak + 0.25 * (anaEnd - env.tPeak)) { early += Math.log2(h.rolloff) * w; ew += w; }
      else if (h.t >= env.tPeak + 0.5 * (anaEnd - env.tPeak)) { late += Math.log2(h.rolloff) * w; lw += w; }
    }
    const roEarly = ew > 0 ? Math.pow(2, early / ew) : 8000, roLate = lw > 0 ? Math.pow(2, late / lw) : roEarly;
    const darkenOct = Math.log2(roEarly / Math.max(20, roLate));

    // ---- an evolving table changes loudness by itself; fit the synth envelope around that
    let synthEnvFit = env, wrAt = () => 1;
    if (pitched) {
      const wrs = frames.map(frameRmsNorm), F = frames.length, v0 = evolve ? (nNat - 1) / (F - 1) : 0;
      wrAt = (t) => {
        if (!evolve) return wrs[0];
        const pos = v0 * (1 - fall(t / evolve.T, evolve.curve)) * (F - 1), i = Math.min(F - 2, Math.floor(pos)), u = pos - i;
        return wrs[i] + (wrs[i + 1] - wrs[i]) * u;
      };
      if (evolve) {
        const w0 = wrAt(env.tPeak);
        synthEnvFit = envelope(x, sr, f0, (t) => dbOf(wrAt(t) / w0));
      }
    }

    // ---- noise residual: colour, band edges, and the filter that shapes it
    let noiseFrac = 0, noiseCol = 0, noiseRmsUnit = 0.577, shape = null, edges = null, click = false;
    {
      let mS = 0, mW = 0, eAcc = 0, eTot = 0;
      const dens = new Float64Array(NB);
      for (const h of traj) eTot += h.tot * fromDb(h.lvl);
      for (const h of traj) {
        if (h.lvl < -40 || h.inDrop) continue;
        const w = h.resE * fromDb(h.lvl);
        // for unpitched sounds, match the colour of the bright first part of the energy
        eAcc += h.tot * fromDb(h.lvl);
        if (!pitched && eAcc > 0.6 * eTot && mW > 0) continue;
        mS += h.resMlf * w; mW += w;
        if (h.dens) for (let i = 0; i < NB; i++) dens[i] += h.dens[i] * fromDb(h.lvl);
      }
      const mlf = mW > 0 ? mS / mW : 11;
      if (!pitched) {
        // band edges where the density is 15 dB under its plateau
        let top = 0, nb = 0;
        for (let i = 0; i < NB; i++) if (bandHz(i) < 0.45 * sr) { top = Math.max(top, dens[i]); nb = i + 1; }
        let lo = 0, hi = nb - 1;
        if (top > 0) {
          while (lo < nb - 1 && dens[lo] < top * 0.0316) lo++;
          while (hi > lo && dens[hi] < top * 0.0316) hi--;
        }
        const fl = 40 * Math.pow(2, lo / 3), fh = 40 * Math.pow(2, (hi + 1) / 3);   // outer band edges
        edges = { low: Math.round(fl), high: Math.round(fh) };
        // a sound that gets darker keeps a lowpass with an envelope (unless it also has a hard low edge)
        const forced = darkenOct > 1 && fl <= 150 ? { type: "lp12", cutoff: Math.round(clamp(roLate * 1.3, 60, 20000)), res: 0.1, env: r2(clamp(darkenOct, 0, 8)) } : null;
        const fit = fitNoiseShape(dens, sr, fl, fh, forced);
        shape = fit.shape; noiseCol = fit.colour;
      } else noiseCol = matchColourChain(mlf, null, sr);
      // level calibration at the start of the sound (where a filter envelope is fully open)
      const atPeak = shape ? Object.assign({}, shape, { cutoff: clamp(shape.cutoff * Math.pow(2, shape.env || 0), 20, 20000) }) : null;
      noiseRmsUnit = simNoiseRms(noiseCol, atPeak, sr);
      // the synth's noise follows the same envelope as the tone, so use the typical (median)
      // moment, not the average: a short click at the start shouldn't make the whole note hiss
      if (pitched) {
        const rv = [], rw = [];
        for (const h of traj) {
          if (h.lvl < -40 || h.inDrop || h.harmE + h.resE <= 0) continue;
          rv.push(h.resE / (h.harmE + h.resE)); rw.push((h.harmE + h.resE) * fromDb(h.lvl));
        }
        noiseFrac = rv.length ? Math.min(1 - harmonicity, weightedMedian(rv, rw)) : 1 - harmonicity;
        // a kick-style click: most of the noise in the first 40 ms, riding on a pitch drop.
        // Then the noise follows the short pitch-drop envelope (modEnv) instead.
        let eAll = 0, eEarly = 0, hEarly = 0;
        for (const h of traj) {
          const w = fromDb(h.lvl);
          eAll += h.resE * w;
          if (h.t < 0.04) { eEarly += h.resE * w; hEarly += h.harmE * w; }
        }
        if (pitchDrop && eAll > 0 && eEarly > 0.5 * eAll && eEarly + hEarly > 0) { click = true; noiseFrac = eEarly / (eEarly + hEarly); }
      } else noiseFrac = 1;
    }


    // ---- category
    let category;
    if (!pitched || kind === "phrase" || kind === "percussive") category = "FX";
    else if (f0 < 112) category = "Bass";
    else if (env.a > 0.12 || (env.sustained && env.a > 0.04 && dur > 2)) category = "Pads";
    else if (!env.sustained && env.t20 < 0.6) category = "Plucks";
    else if (!env.sustained) category = "Keys";
    else if (env.sustained && env.a < 0.04) category = "Leads";
    else category = "Synths";

    // ---- blend: how much original vs rebuilt
    const synthMix = { tonal: 0.8, breathy: 0.55, complex: 0.25, phrase: 0.15, percussive: 0.2, noise: 0.3 }[kind];
    const origAt = (v) => 1 - Math.pow(v, 1.6), synthAt = (v) => Math.pow(v, 0.6);

    // level matching: the rebuilt layer should be as loud as the sample at the peak
    const S = 0.8;
    // Energy match over the body of the note: the sample's RMS curve against what the synth
    // layer will play (frame loudness x its envelope) at level 1.
    // A phrase (separate notes, gaps) can't be one ADSR: its synth layer just holds the
    // phrase's sound while the key is down, and is level-matched on the loud moments.
    if (kind === "phrase") synthEnvFit = Object.assign({}, env, { sustained: true, s: 0.8, d: 0.25, curve: 0.5 });
    const se0 = synthEnvFit, aSyn = kind === "phrase" ? Math.min(env.a, 0.03) : env.a;
    const envAt = (t) => (t < aSyn ? t / aSyn : t - aSyn < se0.d ? se0.s + (1 - se0.s) * fall((t - aSyn) / se0.d, se0.curve) : se0.s);
    let gain;
    if (kind === "phrase") {
      const rv = [], rw = [];
      for (let i = 0; i < env.curveDb.length; i++) {
        if (env.curveDb[i] < -12) continue;
        const t = i * env.dt;
        rv.push(fromDb(env.curveDb[i]) * env.peakRms / (wrAt(t) * envAt(t) + 1e-9)); rw.push(1);
      }
      rv.sort((p, q) => p - q);
      gain = rv.length ? rv[Math.floor(rv.length * 0.8)] : env.peakRms / 0.7;   // near the loud end
    } else {
      const tW = env.tPeak + clamp(0.5 * (dur - env.tPeak), 0.05, 0.5);
      let eS = 0, eM = 0;
      for (let i = 0; i < env.curveDb.length; i++) {
        const t = i * env.dt;
        if (t > tW) break;
        const a = fromDb(env.curveDb[i]) * env.peakRms, m = wrAt(t) * envAt(t);
        eS += a * a; eM += m * m;
      }
      gain = eM > 0 ? Math.sqrt(eS / eM) : env.peakRms / 0.7;   // level-1 -> matching amplitude
    }
    let oscFull = 0, noiseFull = 0;
    if (pitched) {
      const nf = clamp(noiseFrac, 0, 0.9);
      oscFull = gain * S * Math.sqrt(1 - nf);
      const wr = wrAt(env.tPeak);
      // tuned hits (kicks, toms): the click stays in the sample layer unless it's really noisy
      const nMin = kind === "percussive" && !click ? 0.25 : 0.06;
      noiseFull = noiseFrac > nMin ? gain * wr * S * Math.sqrt(nf) / noiseRmsUnit : 0;
      noiseFull = Math.min(noiseFull, oscFull * wr / noiseRmsUnit);   // never louder than the tone itself
    } else {
      noiseFull = gain * S / noiseRmsUnit;
    }
    let sFull = S;
    // the tone stays at level <= 1; a filtered noise may need more (mod amounts aren't capped
    // at 1 in the engine), up to +12 dB, before the whole preset is turned down to fit
    const over = Math.max(oscFull, noiseFull / 4);
    if (over > 1) { oscFull /= over; noiseFull /= over; sFull /= over; }
    oscFull = r3(oscFull); noiseFull = r3(noiseFull); sFull = r3(sFull);

    // ---- loop
    progress("loop", 0.85);
    let loop = null;
    if (env.sustained && (kind === "tonal" || kind === "breathy" || kind === "noise" || kind === "complex")) {
      // only where both level and timbre have settled
      loop = findLoop(x, sr, pitched ? f0 : 0, Math.max(env.susStart, evolve ? evolve.T : 0), Math.min(env.tRel, dur - 0.02));
    }
    const sampleData = x;   // trimmed, mono, normalised (shared with the analysis)
    let loopXf = 0;
    if (loop && opts.crossfadeLoop !== false) loopXf = bakeLoopCrossfade(sampleData, sr, loop);

    // ---- envelopes
    const R = env.sustained ? clamp(env.r, 0.02, 8) : clamp(pitched ? 0.35 * env.d : env.d, 0.05, 6);
    const se = synthEnvFit;
    const synthEnv = se.sustained
      ? { a: r4(aSyn), d: r4(clamp(se.d, 0.005, 20)), s: r3(se.s), r: r4(clamp(R * 2, 0.02, 16)), curve: r2(se.curve) }
      : { a: r4(aSyn), d: r4(clamp(se.d, 0.01, 30)), s: 0, r: r4(clamp(R * 2, 0.02, 16)), curve: r2(se.curve) };
    const ampEnv = { a: 0.001, d: 0.1, s: 1, r: r4(R), curve: r2(env.curve) };

    // ---- assemble the preset
    const ws = clamp(prep.width, 0, 1);
    const wide = ws > 0.12;
    const mods = [];
    const preset = {
      format: "toymachine/1",
      name,
      genre: "Electronic",
      category,
      tags: ["dropped", kind],
      source: { file: opts.name || null, part: "dropped sound", time: r3(prep.trimStart) + "-" + r3(prep.trimEnd) + " s" },
      notes: "",
      voice: { mode: category === "Bass" ? "mono" : "poly", glide: category === "Bass" ? 0.03 : 0, polyphony: category === "Pads" ? 12 : 8, bend: 2, velocity: 0.6 },
    };

    if (pitched) {
      preset.oscA = {
        on: true, frames, pos: 0, oct: 0, semi: 0, fine: 0, level: 0, pan: 0,
        unison: wide ? { voices: 3, detune: r2(6 + 20 * ws), spread: r2(clamp(ws * 1.6, 0.2, 1)), blend: 0.6 } : { voices: 1, detune: 0, spread: 0, blend: 1 },
        warp: { type: "none", amount: 0 }, phase: 0, randomPhase: 1, filter: true,
      };
    } else {
      preset.oscA = { on: false, wave: "sine", level: 0 };
    }
    preset.oscB = { on: false };
    preset.sub = { on: false };
    preset.noise = {
      on: noiseFull > 0,
      color: r2(noiseCol),
      grain: 0,
      pitch: pitched && kind === "breathy" ? 0.35 : 0,
      level: 0,
      filter: true,
    };
    preset.sampler = {
      on: true, file: "dropped:" + name, root: r2(midiExact), loop: false, start: 0, end: 1, level: 0,
      filter: !shape,   // the original only goes through the filter while it is open
    };
    if (loop) {
      // loopStart/loopEnd (0..1 of the sample) mark a seamless sustain loop; the engine loops
      // that region once playback reaches loopEnd (opts.sustainLoop: false leaves it a one-shot).
      // (full precision: 4 decimals of a 2 s clip would be +-9 samples off the zero crossing)
      preset.sampler.loopStart = Math.round(loop.start / x.length * 1e9) / 1e9;
      preset.sampler.loopEnd = Math.round(loop.end / x.length * 1e9) / 1e9;
      if (opts.sustainLoop !== false) preset.sampler.loop = true;
    }

    // filter: open for rebuilt tones (the frames already carry the brightness);
    // for noises, a lowpass that follows the darkening
    if (shape) {
      preset.filter = { on: true, type: shape.type, cutoff: shape.cutoff, res: shape.res, drive: 0, keytrack: 0, env: shape.env, vel: 0 };
    } else {
      preset.filter = { on: true, type: "lp12", cutoff: 20000, res: 0.05, drive: 0, keytrack: 0, env: 0, vel: 0 };
    }

    preset.ampEnv = ampEnv;
    preset.filterEnv = synthEnv;   // also the rebuilt layer's level envelope (see mods)
    if (evolve) preset.modEnv = { a: 0, d: r4(evolve.T), s: 0, r: r4(Math.max(0.3, R)), curve: r2(evolve.curve) };
    else if (pitchDrop) {
      const c = 0.6;
      preset.modEnv = { a: 0, d: r4(clamp(pitchDrop.time / fallInv(0.15, c), 0.01, 2)), s: 0, r: 0.1, curve: c };
    } else preset.modEnv = { a: 0, d: 0.5, s: 0, r: 0.2, curve: 0.5 };
    preset.lfo1 = { shape: "sine", rate: 5, sync: null, retrig: true, phase: 0 };
    preset.lfo2 = { shape: "smooth", rate: 0.3, sync: null, retrig: false };

    const vSynth = synthMix;
    let modOsc = -1, modNoise = -1, modPos = -1;
    if (pitched) { modOsc = mods.length; mods.push({ src: "filterEnv", dst: "oscA.level", amt: 0 }); }
    if (noiseFull > 0) { modNoise = mods.length; mods.push({ src: click ? "modEnv" : "filterEnv", dst: "noise.level", amt: 0 }); }
    if (evolve) { modPos = mods.length; mods.push({ src: "modEnv", dst: "oscA.pos", amt: 0 }); }
    if (pitchDrop) mods.push({ src: "modEnv", dst: "pitch", amt: r2(pitchDrop.semis) });
    preset.mods = mods;

    preset.fx = [
      { type: "eq", on: true, low: 0, lowFreq: 120, high: 0, highFreq: 5000, peaks: [] },
      { type: "reverb", on: true, size: 0.55, decay: 2.2, damp: 0.5, predelay: 0.012, mix: 0 },
    ];
    if (wide && !(pitched && kind !== "phrase" && kind !== "percussive")) preset.fx.splice(1, 0, { type: "chorus", on: true, rate: 0.6, depth: 0.45, mix: r2(clamp(0.15 + 0.35 * ws, 0.15, 0.5)) });
    preset.out = { level: 0, width: r2(1 + Math.min(0.5, ws * 0.5)) };

    // ---- macros
    const swap = { name: "Original <-> Synth", value: vSynth, targets: [{ param: "sampler.level", from: sFull, to: 0, curve: 1.6 }] };
    if (modOsc >= 0) swap.targets.push({ param: "mod." + modOsc + ".amt", from: 0, to: oscFull, curve: 0.6 });
    if (modNoise >= 0) swap.targets.push({ param: "mod." + modNoise + ".amt", from: 0, to: noiseFull, curve: 0.6 });
    const c0 = preset.filter.cutoff;
    const bright = { name: "Bright", value: 0.5, targets: [
      // geometric centre = the preset's cutoff (above 20 kHz the engine just stays open)
      { param: "filter.cutoff", from: Math.round(Math.max(20, c0 / 24)), to: Math.round(c0 * c0 / Math.max(20, c0 / 24)) },
      { param: "fx.eq.high", from: -6, to: 6 },
    ] };
    let morph;
    if (evolve) {
      // natural frames fill 0..value of the table; past that, the formant-shifted extras.
      // pos(t) = value * (1 - modEnv(t)): at the stored value it sweeps exactly the natural frames
      // Past its stored value Morph also pushes a hard-sync warp in (exactly 0 at the stored
      // value, clamped to 0 below it), so it is audible even on a short pluck.
      const v0 = r4((nNat - 1) / (frames.length - 1)), syncTop = 0.6;
      morph = { name: "Morph", value: v0, targets: [{ param: "oscA.pos", from: 0, to: 1 }, { param: "mod." + modPos + ".amt", from: 0, to: -1 },
        { param: "oscA.warp.amount", from: r4(-syncTop * v0 / (1 - v0)), to: syncTop }] };
      preset.oscA.warp = { type: "sync", amount: 0 };
    } else if (pitched) {
      morph = { name: "Morph", value: 0, targets: [{ param: "oscA.pos", from: 0, to: 1 }] };
    } else {
      morph = { name: "Morph", value: 0, targets: [{ param: "noise.pitch", from: 0, to: 1 }, { param: "filter.res", from: preset.filter.res, to: 0.7 }] };
    }
    const spaceV = category === "Pads" ? 0.32 : kind === "percussive" ? 0.1 : 0.18;
    const space = { name: "Space", value: spaceV, targets: [{ param: "fx.reverb.mix", from: 0, to: 0.5 }, { param: "fx.reverb.size", from: 0.3, to: 0.9 }] };
    preset.macros = [swap, bright, morph, space];
    preset.pads = [{ kind: "macro", x: 0, y: 1 }, { kind: "macro", x: 2, y: 3 }, { kind: "analog", pos: [0, 0.3] }];

    // ---- look
    const hue = Math.round(((275 + 155 * clamp((Math.log2(centroid) - Math.log2(200)) / (Math.log2(6000) - Math.log2(200)), 0, 1)) % 360));
    const style = { tonal: category === "Bass" ? "chrome" : "liquid", breathy: "waves", phrase: "waves", complex: "terrain", percussive: "dots", noise: "grain" }[kind];
    preset.look = { style, hue, hue2: (hue + 150) % 360, seed: hashStr(name + ":" + Math.round(f0) + ":" + Math.round(centroid)) % 100000 };

    // tags
    if (centroid > 2500) preset.tags.push("bright"); else if (centroid < 500) preset.tags.push("dark");
    if (pitched && oddRatio > 0.8) preset.tags.push("hollow");
    if (pitched && brightRatio > 0.5) preset.tags.push("buzzy");
    if (wide) preset.tags.push("wide");
    if (evolve) preset.tags.push("evolving");
    preset.tags.push(category.toLowerCase());

    applyMacros(preset);

    // ---- report
    const oDb = Math.round(dbOf(origAt(vSynth) / Math.max(1e-6, synthAt(vSynth))));   // both layers are loudness-matched at full
    const lines = [];
    const fmtT = (t) => (t < 0.1 ? Math.round(t * 1000) + " ms" : r2(t) + " s");
    if (pitched) {
      const nn = noteName(midiExact), art = /^[AEF]/.test(nn) ? "an " : "a ";
      const tune = Math.abs(cents) >= 5 ? ", " + Math.abs(cents) + " cents " + (cents > 0 ? "sharp" : "flat") + ", so I tuned it" : "";
      const sure = sp.conf > 0.75 ? "" : " (fairly sure, not 100%)";
      lines.push("Found " + art + nn + " (" + Math.round(f0) + " Hz)" + sure + tune + ".");
      let what;
      if (kind === "percussive") what = "It's a hit (drum-like), so it plays mostly as the original sample, tuned so " + noteName(midiExact) + " lands on its key";
      else if (kind === "phrase") what = "It moves between notes (" + sp.distinctNotes + " of them), so it plays mostly as the original sample, tuned so " + noteName(midiExact) + " lands on its key";
      else {
        const ch = oddRatio > 0.8 ? "strong odd harmonics, so I rebuilt it as a hollow wavetable" : brightRatio > 0.5 ? "lots of high harmonics, so I rebuilt it as a bright, buzzy wavetable" : brightRatio < 0.08 ? "very few harmonics, so I rebuilt it as a soft, round wavetable" : "a full set of harmonics, so I rebuilt it as a wavetable";
        what = "It has " + ch + (evolve ? " with " + (frames.length - 3) + " frames that follow how it changes over " + fmtT(evolve.T) : "");
      }
      const layer = oDb > -4 ? "; it plays as an even mix of the rebuilt synth and the original sample." : "; the original sample is layered underneath at " + oDb + " dB.";
      lines.push(what + (kind === "tonal" || kind === "breathy" || kind === "complex" ? layer : "; turn 'Original <-> Synth' right to hear the rebuilt version."));
    } else {
      lines.push("No clear pitch (" + (kind === "percussive" ? "it sounds like a hit or drum" : "it sounds like noise or an effect") + "), so it plays mostly as the original sample, with C4 as its home key.");
      const khz = (f) => (f >= 1000 ? Math.round(f / 100) / 10 + " kHz" : Math.round(f) + " Hz");
      const sh = !shape ? "" : shape.type === "hp24" ? " (" + khz(shape.cutoff) + " and up)" : shape.type === "lp24" ? " (up to " + khz(shape.cutoff) + ")" :
        shape.type === "bp12" ? " (a band around " + khz(shape.cutoff) + ")" : shape.env ? " and a filter that closes like the original" : "";
      lines.push("Underneath is a noise layer with the same colour" + sh + "; 'Morph' tunes that noise to the notes you play.");
    }
    if (pitched && noiseFull > 0 && noiseFrac > 0.12 && kind !== "phrase" && !click) lines.push("About " + Math.round(noiseFrac * 100) + "% of it is " + (kind === "breathy" ? "breath" : "noise") + ", added back with the Grains source" + (preset.noise.pitch > 0 ? ", tuned to the note" : "") + ".");
    const envWords = (env.a > 0.1 ? "slow attack (" + fmtT(env.a) + ")" : "fast attack (" + fmtT(env.a) + ")") +
      (env.sustained ? ", holds at " + Math.round(dbOf(env.s)) + " dB, " + fmtT(R) + " release" : ", fades out over " + fmtT(env.t40) + "");
    lines.push("Shape: " + envWords + ", so it went in " + category + "." + (loop ? " Its steady part (" + r2(loop.start / sr) + "-" + r2(loop.end / sr) + " s) has a clean loop point." : ""));
    if (pitchDrop) lines.push("The pitch drops " + Math.round(pitchDrop.semis) + " semitones at the start; the synth does the same drop" + (click && noiseFull > 0 ? ", with a short noise click on top." : "."));
    if (wide) lines.push(pitched && kind !== "phrase" && kind !== "percussive" ? "It's stereo-wide, so the synth layer uses 3 detuned voices spread left/right." : "It's stereo-wide, so I added a light chorus to spread it out again.");
    const notes = lines.slice(0, 5);
    preset.notes = notes.join(" ");

    const report = {
      pitchHz: pitched ? r2(f0) : 0,
      midi: pitched ? midi : 60,
      cents,
      note: pitched ? noteName(midiExact) : "C4",
      confidence: r2(pitched ? sp.conf : Math.min(sp.conf, 0.39)),
      kind,
      category,
      harmonicity: r2(harmonicity),
      noise: r2(noiseFrac),
      stereoWidth: r2(prep.width),
      duration: r3(dur),
      centroidHz: Math.round(centroid),
      envelope: { a: r4(env.a), d: r4(env.d), s: r3(env.s), r: r4(R), curve: r2(env.curve), sustained: env.sustained },
      table: pitched ? { frames: frames.length, harmonics: nh, evolving: !!evolve, sweep: evolve ? r3(evolve.T) : 0 } : null,
      blend: { synth: vSynth, originalDb: oDb },
      loop: loop ? { start: r4(loop.start / sr), end: r4(loop.end / sr), score: r3(loop.score), crossfade: loopXf } : null,
      pitchDrop,
      trimmed: { start: r3(prep.trimStart), end: r3(prep.trimEnd), of: r3(prep.origLen) },
      ms: Math.round(now() - T0),
      notes,
    };
    progress("done", 1);
    return { preset, sample: { data: sampleData, sampleRate: sr, root: preset.sampler.root, name: preset.sampler.file }, report };
  }

  // ---------------------------------------------------------------------------------------
  // Macro application (mirror of TmParams.h applyMacros), so the preset's written values
  // equal what its macros give at their stored positions.

  function isExpPath(p) {
    return /(cutoff|rate|time|freq|Freq|\.a|\.d|\.r|glide|predelay|decay|attack|release)$/.test(p);
  }
  function macroValue(t, v) {
    const from = t.from ?? 0, to = t.to ?? 1, curve = t.curve > 0 ? t.curve : 1;
    const x = Math.pow(clamp(v, 0, 1), curve);
    if (isExpPath(t.param || "") && from > 0 && to > 0) return from * Math.pow(to / from, x);
    return from + (to - from) * x;
  }
  function resolvePath(preset, path) {
    const parts = path.split(".");
    let obj = preset, i = 0;
    if (parts[0] === "fx" || parts[0] === "mod" || parts[0] === "mods") {
      const list = preset[parts[0] === "fx" ? "fx" : "mods"];
      if (!Array.isArray(list)) return null;
      let item = null;
      if (/^\d+$/.test(parts[1])) item = list[+parts[1]] || null;
      else item = list.find((e) => e && e.type === parts[1]) || null;
      if (!item) return null;
      obj = item; i = 2;
    }
    for (; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null || typeof obj[parts[i]] !== "object") obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    return { obj, key: parts[parts.length - 1] };
  }
  function applyMacros(preset) {
    for (const m of preset.macros || []) {
      for (const t of m.targets || []) {
        const r = resolvePath(preset, t.param || "");
        if (!r) continue;
        let v = macroValue(t, m.value || 0);
        if (t.param === "filter.cutoff") v = clamp(v, 20, 20000);
        if (t.param === "filter.cutoff") v = Math.round(v);
        r.obj[r.key] = typeof r.obj[r.key] === "boolean" ? v >= 0.5 : Math.round(v * 1e4) / 1e4;
      }
    }
    return preset;
  }

  // ---------------------------------------------------------------------------------------
  // Public API

  async function fromAudioBuffer(buffer, opts) {
    if (!buffer || !buffer.numberOfChannels) throw new Error("Not an audio buffer.");
    const ch = [];
    for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) ch.push(buffer.getChannelData(c));
    return analyse(ch, buffer.sampleRate, opts);
  }

  async function fromFile(file, audioContext, opts) {
    const bytes = await file.arrayBuffer();
    let ctx = audioContext;
    if (!ctx) {
      const C = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      ctx = new C(2, 1, 44100);
    }
    const buf = await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(bytes, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    return fromAudioBuffer(buf, Object.assign({ name: file.name }, opts || {}));
  }

  const api = {
    version: 1,
    fromAudioBuffer,
    fromFile,
    fromChannels: (channels, sampleRate, opts) => analyse(channels, sampleRate, opts),
    applyMacros,
    _internal: { yinTrack, stablePitch, envelope, measureHarmonics, valleyNoise, spectrumAt, harmonicFrameN, fall, fallInv, simNoiseRms, fitNoiseShape, findLoop },
  };
  root.ToyMachineAnalyze = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
