// KILLTOY variations, the browser engine: makes a new version of a clip's audio that keeps
// its timing and key. Used by playground.js for "Make variation" and "Change it..." (the
// Mac app does the same jobs in C++, Source/Variations.cpp). Everything here takes and
// returns AudioBuffers and works offline, a slice at a time, so the song keeps playing.
//
//   renderDsp(buf, dsp)        tone, drive, crush, space, width, formant / octave changes
//   swapHits(buf, swap, opts)  a drum lane with each hit replaced by another sound
//   check(orig, out)           measures timing (ms) and key of the result against the original
//   varyNotes(notes, opts)     a MIDI part with some notes moved, kept in key and on the grid
//
// Keep this file ASCII-only, like ui/.
"use strict";

window.KTVar = (function () {
  const breath = () => new Promise((r) => setTimeout(r, 0));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const dbToLin = (d) => Math.pow(10, d / 20);

  function rng(seed) { // small, repeatable random numbers
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }

  function newBuffer(chans, sr) {
    const ctx = new OfflineAudioContext(chans.length, Math.max(1, chans[0].length), sr);
    const out = ctx.createBuffer(chans.length, Math.max(1, chans[0].length), sr);
    chans.forEach((d, i) => out.getChannelData(i).set(d));
    return out;
  }
  const channels = (buf) => Array.from({ length: buf.numberOfChannels }, (_, i) => new Float32Array(buf.getChannelData(i)));
  function mono(buf) {
    const n = buf.length, y = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) { const x = buf.getChannelData(c); for (let i = 0; i < n; i++) y[i] += x[i] / buf.numberOfChannels; }
    return y;
  }

  // ---------------------------------------------------------------------------
  // FFT (in place, radix 2, twiddles from a table) for the formant shift and the key check.
  const TW = new Map();
  function fft(re, im, inverse) {
    const n = re.length;
    let tw = TW.get(n);
    if (!tw) { tw = { c: new Float64Array(n / 2), s: new Float64Array(n / 2) }; for (let k = 0; k < n / 2; k++) { tw.c[k] = Math.cos((2 * Math.PI * k) / n); tw.s[k] = Math.sin((2 * Math.PI * k) / n); } TW.set(n, tw); }
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    const sg = inverse ? 1 : -1;
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, stride = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const cr = tw.c[k * stride], ci = sg * tw.s[k * stride], a = i + k, b = a + half;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  // ---------------------------------------------------------------------------
  // Pitch by whole octaves, timing kept: 70 ms grains, each read faster or slower.
  // (The grains move the voice's formants with the pitch; formantShift puts them back.)
  function grainShift(x, sr, ratio) {
    const G = Math.round(sr * 0.07), H = G >> 2, y = new Float32Array(x.length), norm = new Float32Array(x.length);
    const win = new Float32Array(G);
    for (let i = 0; i < G; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / G);
    for (let o = -G; o < x.length; o += H) {
      const c = o + G / 2;
      for (let i = 0; i < G; i++) {
        const t = o + i;
        if (t < 0 || t >= x.length) continue;
        const p = c + (i - G / 2) * ratio, k = Math.floor(p), f = p - k;
        y[t] += (k >= 0 && k + 1 < x.length ? x[k] * (1 - f) + x[k + 1] * f : 0) * win[i];
        norm[t] += win[i];
      }
    }
    for (let i = 0; i < y.length; i++) if (norm[i] > 1e-3) y[i] /= norm[i];
    return y;
  }

  // Formant shift, pitch and timing kept: in each 46 ms slice the spectral envelope (the
  // log spectrum smoothed over ~400 Hz) is stretched by `factor` (>1 = smaller, brighter,
  // more "female"; <1 = bigger, darker). One envelope from all channels, applied to each,
  // so the stereo image stays.
  async function formantShift(chans, sr, factor, onProgress) {
    const N = 2048, hop = 1024, half = N / 2, n = chans[0].length, C = chans.length;
    const win = new Float64Array(N); // sqrt-Hann in and out: sums to one at 50% overlap
    for (let i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    const out = chans.map(() => new Float32Array(n));
    const re = chans.map(() => new Float64Array(N)), im = chans.map(() => new Float64Array(N));
    const logm = new Float64Array(half + 1), pre = new Float64Array(half + 2), env = new Float64Array(half + 1), gain = new Float64Array(half + 1);
    const W = Math.max(2, Math.round(200 / (sr / N))); // +-200 Hz of smoothing
    let last = performance.now();
    for (let o = -hop; o < n; o += hop) {
      let energy = 0;
      for (let c = 0; c < C; c++) {
        const x = chans[c], r = re[c], m = im[c];
        for (let i = 0; i < N; i++) { const t = o + i, v = t >= 0 && t < n ? x[t] * win[i] : 0; r[i] = v; m[i] = 0; energy += v * v; }
      }
      if (energy < 1e-10) continue;
      for (let c = 0; c < C; c++) fft(re[c], im[c], false);
      for (let k = 0; k <= half; k++) { let mag = 0; for (let c = 0; c < C; c++) mag += Math.hypot(re[c][k], im[c][k]); logm[k] = Math.log(mag / C + 1e-9); }
      pre[0] = 0;
      for (let k = 0; k <= half; k++) pre[k + 1] = pre[k] + logm[k];
      for (let k = 0; k <= half; k++) { const a = Math.max(0, k - W), b = Math.min(half, k + W); env[k] = (pre[b + 1] - pre[a]) / (b - a + 1); }
      for (let k = 0; k <= half; k++) {
        const src = k / factor, a = Math.floor(src), f = src - a;
        const want = a + 1 <= half ? env[a] * (1 - f) + env[a + 1] * f : env[half] - 4;
        gain[k] = Math.exp(clamp(want - env[k], -3.5, 3.5));
      }
      for (let c = 0; c < C; c++) {
        const r = re[c], m = im[c], y = out[c];
        for (let k = 0; k <= half; k++) {
          r[k] *= gain[k]; m[k] *= gain[k];
          if (k && k < half) { r[N - k] = r[k]; m[N - k] = -m[k]; }
        }
        fft(r, m, true);
        for (let i = 0; i < N; i++) { const t = o + i; if (t >= 0 && t < n) y[t] += r[i] * win[i]; }
      }
      if (performance.now() - last > 14) { if (onProgress) onProgress(o / n); await breath(); last = performance.now(); }
    }
    return out;
  }

  function impulse(ctx, seconds, damp, seed) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds)), ir = ctx.createBuffer(2, len, ctx.sampleRate), r = rng(seed);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) { lp += (r() * 2 - 1 - lp) * (1 - damp * 0.9); d[i] = lp * Math.pow(1 - i / len, 2.4); }
    }
    return ir;
  }

  // Loudness of the parts that aren't silence, so a variation sits at the original's level.
  function activeRms(chans) {
    const n = chans[0].length, B = 2048, blocks = [];
    for (let s = 0; s < n; s += B) {
      let sq = 0, cnt = 0;
      for (const d of chans) for (let i = s; i < Math.min(n, s + B); i++) { sq += d[i] * d[i]; cnt++; }
      blocks.push(Math.sqrt(sq / Math.max(1, cnt)));
    }
    const top = Math.max(...blocks, 1e-9), on = blocks.filter((b) => b > top * 0.05);
    return on.length ? Math.sqrt(on.reduce((a, b) => a + b * b, 0) / on.length) : top;
  }
  function matchLevel(origChans, chans, plusDb) {
    const g = (activeRms(origChans) / Math.max(1e-9, activeRms(chans))) * dbToLin(plusDb || 0);
    let peak = 0;
    for (const d of chans) for (let i = 0; i < d.length; i++) { d[i] *= g; peak = Math.max(peak, Math.abs(d[i])); }
    if (peak > 0.98) for (const d of chans) for (let i = 0; i < d.length; i++) d[i] *= 0.98 / peak;
    return chans;
  }

  // Lines `chans` up with the original to the sample (filters and the compressor can add a
  // few ms of delay). Returns the shift it removed, in samples.
  function lineUp(orig, chans, sr) {
    const lag = measureLag(orig, chans[0], sr, 0.03);
    if (!lag) return 0;
    for (const d of chans) {
      if (lag > 0) { d.copyWithin(0, lag); d.fill(0, d.length - lag); }
      else { d.copyWithin(-lag, 0, d.length + lag); d.fill(0, 0, -lag); }
    }
    return lag;
  }

  // ---------------------------------------------------------------------------
  // dsp: { octave: -1|0|1, formant: semitones, lowcut, highcut (Hz), bass, presence, air (dB),
  //        drive, crush, comp, space, width (0..1, width -1..1), level (dB), seed }
  async function renderDsp(buf, dsp = {}, onProgress = () => {}) {
    const sr = buf.sampleRate, orig = channels(buf);
    let chans = channels(buf);
    const octave = clamp(Math.round(dsp.octave || 0), -2, 2), formant = clamp(dsp.formant || 0, -12, 12);
    if (octave || Math.abs(formant) > 0.05) {
      const ratio = Math.pow(2, octave), factor = Math.pow(2, formant / 12) / ratio;
      if (octave) chans = chans.map((x) => grainShift(x, sr, ratio));
      if (Math.abs(factor - 1) > 0.003) chans = await formantShift(chans, sr, factor, (p) => onProgress(0.05 + 0.6 * p));
    }
    onProgress(0.7);

    const needsGraph = dsp.lowcut || dsp.highcut || dsp.bass || dsp.presence || dsp.air || dsp.drive || dsp.comp || dsp.space;
    if (needsGraph) {
      const off = new OfflineAudioContext(chans.length, chans[0].length, sr);
      const src = off.createBufferSource();
      src.buffer = newBuffer(chans, sr);
      let node = src;
      const biquad = (type, f, gain, q) => { const b = off.createBiquadFilter(); b.type = type; b.frequency.value = f; if (gain != null) b.gain.value = gain; if (q) b.Q.value = q; node.connect(b); node = b; };
      if (dsp.lowcut > 20) biquad("highpass", clamp(dsp.lowcut, 20, 2000), null, 0.707);
      if (dsp.highcut > 0 && dsp.highcut < 20000) biquad("lowpass", clamp(dsp.highcut, 300, 20000), null, 0.707);
      if (dsp.bass) biquad("lowshelf", 150, clamp(dsp.bass, -18, 18));
      if (dsp.presence) biquad("peaking", 3000, clamp(dsp.presence, -18, 18), 0.9);
      if (dsp.air) biquad("highshelf", 9000, clamp(dsp.air, -18, 18));
      if (dsp.drive > 0) {
        const d = clamp(dsp.drive, 0, 1), k = 1 + d * 24, ws = off.createWaveShaper(), curve = new Float32Array(2048);
        for (let i = 0; i < curve.length; i++) { const v = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(k * v + d * 0.15 * v * v) / Math.tanh(k); }
        ws.curve = curve; ws.oversample = "4x";
        const pre = off.createGain(); pre.gain.value = 1;
        node.connect(pre); pre.connect(ws); node = ws;
      }
      if (dsp.comp > 0) {
        const c = off.createDynamicsCompressor(), a = clamp(dsp.comp, 0, 1);
        c.threshold.value = -10 - 26 * a; c.ratio.value = 2 + 8 * a; c.knee.value = 6; c.attack.value = 0.004; c.release.value = 0.12;
        node.connect(c); node = c;
      }
      const out = off.createGain();
      node.connect(out);
      if (dsp.space > 0) {
        const s = clamp(dsp.space, 0, 1), conv = off.createConvolver(), wet = off.createGain(), dry = off.createGain();
        conv.buffer = impulse(off, 1.2 + 2.2 * s, 0.5, dsp.seed || 7);
        wet.gain.value = 0.55 * s; dry.gain.value = 1 - 0.35 * s;
        out.connect(dry); out.connect(conv); conv.connect(wet);
        dry.connect(off.destination); wet.connect(off.destination);
      } else out.connect(off.destination);
      src.start();
      const r = await off.startRendering();
      chans = channels(r);
      lineUp(orig[0], chans, sr);
    }
    onProgress(0.85);

    if (dsp.crush > 0) {
      const a = clamp(dsp.crush, 0, 1), steps = Math.pow(2, 12 - 8 * a), hold = Math.max(1, Math.round(1 + a * 7));
      for (const d of chans) { let held = 0; for (let i = 0; i < d.length; i++) { if (i % hold === 0) held = Math.round(d[i] * steps) / steps; d[i] = held; } }
    }
    if (dsp.width && chans.length === 2) {
      const w = clamp(1 + dsp.width, 0, 2.5), [l, r] = chans;
      for (let i = 0; i < l.length; i++) { const m = (l[i] + r[i]) / 2, s = ((l[i] - r[i]) / 2) * w; l[i] = m + s; r[i] = m - s; }
    }
    matchLevel(orig, chans, dsp.level);
    onProgress(1);
    return newBuffer(chans, sr);
  }

  // ---------------------------------------------------------------------------
  // Drum hits: where each one starts (to the sample) and how loud it is.
  function detectHits(buf, minGap = 0.035) {
    const sr = buf.sampleRate, x = mono(buf), F = Math.max(1, Math.round(sr * 0.002)), n = Math.floor(x.length / F);
    const env = new Float32Array(n);
    let peak = 0;
    for (let f = 0; f < n; f++) { let m = 0; for (let i = f * F; i < (f + 1) * F; i++) m = Math.max(m, Math.abs(x[i])); env[f] = m; peak = Math.max(peak, m); }
    const floor = peak * dbToLin(-36), hits = [];
    let lastHit = -1e9;
    for (let f = 3; f < n; f++) {
      const before = Math.max(env[f - 3], env[f - 2]);
      if (env[f] < floor || env[f] < before * 2.2 || env[f] <= env[f - 1]) continue;
      // Exact start: back up to where this hit first crosses a fifth of its own top.
      let top = 0;
      for (let k = f; k < Math.min(n, f + 20); k++) top = Math.max(top, env[k]);
      let s = f * F;
      while (s > (f - 3) * F && Math.abs(x[s]) > top * 0.2) s--;
      for (let i = s; i < (f + 1) * F; i++) if (Math.abs(x[i]) > top * 0.2) { s = i; break; }
      const t = s / sr;
      if (t - lastHit < minGap) continue;
      hits.push({ t, peak: top });
      lastHit = t;
    }
    return hits;
  }

  function firstCross(d, frac) { let p = 0; for (const v of d) p = Math.max(p, Math.abs(v)); for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) >= p * frac) return i; return 0; }
  function centroid(d, sr) { // rough brightness: zero crossings per second over the first 80 ms
    const n = Math.min(d.length, Math.round(sr * 0.08)); let z = 0;
    for (let i = 1; i < n; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) z++;
    return (z * sr) / Math.max(1, n) / 2;
  }
  function decay(d, sr) { let p = 0, at = 0; for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > p) { p = Math.abs(d[i]); at = i; } let end = at; for (let i = at; i < d.length; i++) if (Math.abs(d[i]) > p * 0.1) end = i; return (end - at) / sr; }

  // Synth drums: used when no sample folder is connected (Samples, key B).
  function synthHit(kind, sr, seed) {
    const r = rng(seed), len = Math.round(sr * ({ kick: 0.5, snare: 0.35, clap: 0.4, hat: 0.09, openhat: 0.4, rim: 0.08, perc: 0.2, tom: 0.45, shaker: 0.12 }[kind] || 0.3));
    const d = new Float32Array(len), noise = () => r() * 2 - 1;
    let lp = 0, hp = 0, prev = 0, phase = 0;
    const tune = 0.85 + r() * 0.3, tail = 0.75 + r() * 0.5;
    for (let i = 0; i < len; i++) {
      const t = i / sr, n = noise();
      let v = 0;
      if (kind === "kick" || kind === "tom") {
        const f0 = (kind === "kick" ? 48 : 110) * tune, f = f0 + (kind === "kick" ? 160 : 140) * Math.exp(-t / 0.035);
        phase += (2 * Math.PI * f) / sr;
        v = Math.sin(phase) * Math.exp(-t / (0.22 * tail)) + (t < 0.004 ? n * 0.4 * (1 - t / 0.004) : 0);
      } else if (kind === "snare" || kind === "rim") {
        phase += (2 * Math.PI * 190 * tune) / sr;
        hp = 0.85 * (hp + n - prev); prev = n;
        v = Math.sin(phase) * Math.exp(-t / 0.05) * (kind === "rim" ? 0.9 : 0.5) + hp * Math.exp(-t / ((kind === "rim" ? 0.015 : 0.11) * tail)) * 0.7;
      } else if (kind === "clap") {
        lp += (n - lp) * 0.35; hp = 0.9 * (hp + lp - prev); prev = lp;
        const bursts = [0, 0.011, 0.023].reduce((a, b) => a + (t >= b ? Math.exp(-(t - b) / 0.006) : 0), 0);
        v = hp * (bursts * 0.5 + Math.exp(-t / (0.12 * tail)) * 0.6);
      } else { // hats, shaker, perc: bright noise
        hp = 0.6 * (hp + n - prev); prev = n;
        const dec = kind === "openhat" ? 0.18 : kind === "shaker" ? 0.04 : kind === "perc" ? 0.06 : 0.022;
        v = hp * Math.exp(-t / (dec * tail)) * (kind === "shaker" ? Math.min(1, t / 0.01) : 1);
      }
      d[i] = v;
    }
    return d;
  }

  // swap: { sound, match: "close"|"different", seed }; opts.candidates = AudioBuffers to choose from.
  async function swapHits(buf, swap = {}, opts = {}) {
    const sr = buf.sampleRate, orig = channels(buf), hits = detectHits(buf, swap.minGap || 0.035);
    if (!hits.length) throw new Error("No hits found in this clip to swap");
    const m = mono(buf), first = Math.round(hits[0].t * sr);
    const origHit = m.subarray(first, Math.min(m.length, first + Math.round(sr * 0.5)));
    const r = rng(swap.seed || 1);
    let sample = null, from = "synth";
    const cands = (opts.candidates || []).filter(Boolean).map((b) => ({ b, d: mono(b) }));
    if (cands.length) {
      const want = { c: centroid(origHit, sr), dec: decay(origHit, sr) };
      const scored = cands.map((x) => ({ ...x, dist: Math.abs(Math.log((centroid(x.d, x.b.sampleRate) + 1) / (want.c + 1))) + Math.abs(Math.log((decay(x.d, x.b.sampleRate) + 0.01) / (want.dec + 0.01))) }));
      scored.sort((a, b) => a.dist - b.dist);
      // "close": one of the nearest few (but not an exact copy); "different": any of the rest.
      const pool = swap.match === "different" ? scored.slice(Math.min(2, scored.length - 1)) : scored.slice(scored.length > 2 && scored[0].dist < 0.02 ? 1 : 0, 4);
      const pick = pool[Math.floor(r() * pool.length)] || scored[0];
      sample = pick.d; from = pick.b.name || "sample";
      if (pick.b.sampleRate !== sr) { // resample to the song's rate
        const ratio = pick.b.sampleRate / sr, out = new Float32Array(Math.floor(sample.length / ratio));
        for (let i = 0; i < out.length; i++) { const p = i * ratio, k = Math.floor(p), f = p - k; out[i] = (sample[k] || 0) * (1 - f) + (sample[k + 1] || 0) * f; }
        sample = out;
      }
    } else sample = synthHit(swap.sound || "perc", sr, swap.seed || 1);
    const lead = firstCross(sample, 0.2);
    let sPeak = 0;
    for (const v of sample) sPeak = Math.max(sPeak, Math.abs(v));
    const out = orig.map((d) => new Float32Array(d.length));
    const choke = /kick|hat|808|tom|rim/.test(swap.sound || "");
    hits.forEach((h, k) => {
      const at = Math.round(h.t * sr) - lead, g = h.peak / Math.max(1e-6, sPeak);
      const next = hits[k + 1] ? Math.round(hits[k + 1].t * sr) - lead : Infinity, fade = Math.round(sr * 0.004);
      for (let i = 0; i < sample.length; i++) {
        const t = at + i;
        if (t < 0) continue;
        if (t >= out[0].length) break;
        let w = 1;
        if (choke && t >= next - fade) { if (t >= next) break; w = (next - t) / fade; }
        for (const d of out) d[t] += sample[i] * g * w;
      }
    });
    matchLevel(orig, out, swap.level);
    return { buf: newBuffer(out, sr), hits: hits.length, from };
  }

  // ---------------------------------------------------------------------------
  // Checks: timing lag (onset envelopes, cross-correlated) and key (chroma, key profiles).
  function onsetEnv(x, sr) {
    const F = Math.max(1, Math.round(sr * 0.001)), n = Math.floor(x.length / F), e = new Float32Array(n);
    let prev = 0;
    for (let f = 0; f < n; f++) { let s = 0; for (let i = f * F; i < (f + 1) * F; i++) s += x[i] * x[i]; const v = Math.log(1e-8 + s); e[f] = Math.max(0, v - prev); prev = v; }
    return { e, F };
  }
  function measureLag(a, b, sr, maxSec) { // in samples; > 0 = b is late
    const A = onsetEnv(a, sr), B = onsetEnv(b, sr), max = Math.round(maxSec * 1000);
    let best = 0, bestV = -Infinity;
    const n = Math.min(A.e.length, B.e.length);
    for (let lag = -max; lag <= max; lag++) {
      let s = 0;
      for (let i = Math.max(0, -lag); i < n - Math.max(0, lag); i++) s += A.e[i] * B.e[i + lag];
      if (s > bestV) { bestV = s; best = lag; }
    }
    // Refine to the sample around the best ms with raw-signal correlation of the loud parts.
    let fine = best * A.F, fineV = -Infinity;
    const step = Math.max(1, Math.floor(a.length / 400000));
    for (let d = fine - A.F; d <= fine + A.F; d++) {
      let s = 0;
      for (let i = Math.max(0, -d); i < Math.min(a.length, b.length - d); i += step) s += a[i] * b[i + d];
      if (s > fineV) { fineV = s; best = d; }
    }
    return best;
  }

  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function chroma(x, sr) {
    const N = 8192, hop = 4096, out = new Float64Array(12), re = new Float64Array(N), im = new Float64Array(N);
    const frames = Math.max(1, Math.floor((x.length - N) / hop)), every = Math.max(1, Math.floor(frames / 500));
    for (let f = 0; f < frames; f += every) {
      for (let i = 0; i < N; i++) { re[i] = x[f * hop + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); im[i] = 0; }
      fft(re, im, false);
      for (let k = 1; k < N / 2; k++) {
        const hz = (k * sr) / N;
        if (hz < 60 || hz > 2000) continue;
        const midi = 69 + 12 * Math.log2(hz / 440), pc = ((Math.round(midi) % 12) + 12) % 12;
        out[pc] += Math.hypot(re[k], im[k]);
      }
    }
    return out;
  }
  function keyOf(ch) {
    const corr = (p, rot) => { let mx = 0, mp = 0; for (let i = 0; i < 12; i++) { mx += ch[i]; mp += p[i]; } mx /= 12; mp /= 12; let s = 0, a = 0, b = 0; for (let i = 0; i < 12; i++) { const u = ch[(i + rot) % 12] - mx, v = p[i] - mp; s += u * v; a += u * u; b += v * v; } return s / Math.sqrt(a * b + 1e-12); };
    let best = { score: -2 };
    for (let t = 0; t < 12; t++) for (const [prof, minor] of [[MAJ, false], [MIN, true]]) { const s = corr(prof, t); if (s > best.score) best = { score: s, tonic: t, minor }; }
    return { tonic: best.tonic, minor: best.minor, name: NAMES[best.tonic] + (best.minor ? "m" : "") };
  }
  const sameNotes = (a, b) => a.tonic === b.tonic && a.minor === b.minor ||
    (a.minor !== b.minor && ((a.minor ? a.tonic + 3 : a.tonic + 9) % 12) === b.tonic);

  function check(origBuf, outBuf, { pitched = true } = {}) {
    const sr = origBuf.sampleRate, a = mono(origBuf), b = mono(outBuf);
    const lagMs = Math.round((measureLag(a, b, sr, 0.06) / sr) * 10000) / 10;
    const res = { lagMs, onTime: Math.abs(lagMs) <= 5 };
    if (pitched) {
      const ka = keyOf(chroma(a, sr)), kb = keyOf(chroma(b, sr));
      Object.assign(res, { keyBefore: ka.name, keyAfter: kb.name, sameKey: sameNotes(ka, kb) });
    }
    return res;
  }

  // ---------------------------------------------------------------------------
  // MIDI: keep every note's start and length; move some to a neighbouring note of the
  // song's scale (or an octave), never the first note of a bar.
  function varyNotes(notes, { key, amount = 0.25, octave = 0, seed = 1, bass = false } = {}) {
    const r = rng(seed), tonic = key && key.tonic != null ? key.tonic : 0, minor = key ? !!key.minor : false;
    const steps = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const inScale = (p) => steps.includes((((p - tonic) % 12) + 12) % 12);
    const neighbour = (p, dir) => { let q = p + dir; while (!inScale(q)) q += dir; return q; };
    return (notes || []).map((n) => {
      let pitch = n.pitch + 12 * octave;
      const barStart = Math.abs(n.start / 4 - Math.round(n.start / 4)) < 1e-6;
      if (!barStart && r() < amount) {
        if (bass && r() < 0.5) pitch += r() < 0.5 ? 12 : -12;
        else pitch = inScale(pitch) ? neighbour(pitch, r() < 0.5 ? 1 : -1) : pitch;
      }
      return { ...n, pitch };
    });
  }

  return { renderDsp, swapHits, synthHit, detectHits, check, varyNotes, measureLag, keyOf, chroma, mono };
})();
