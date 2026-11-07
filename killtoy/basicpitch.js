// Basic Pitch (Spotify, Apache-2.0): audio to MIDI with machine learning. It hears chords too,
// not only one voice, and it's tiny (the model is ~900 KB, runs on the computer, no internet).
// Ported from @spotify/basic-pitch 1.0.1 (inference.ts + toMidi.ts) to plain JS on flat
// typed arrays, so a few minutes of audio turns into notes in seconds instead of minutes.
//
//   const notes = await BasicPitch.transcribe(audioBuffer, { onProgress: (p) => ... });
//   // [{ start, end, pitch, velocity (1..127), amplitude, bends: [semitones per frame] }]
//   const parts = BasicPitch.splitParts(notes);   // { low, mid, high } by register (for "recreate")
//
// TensorFlow.js and the model are loaded the first time it's used: basicpitch-tf.min.js
// (tfjs 3.21.0) and basicpitch-model.js (the model as one script) next to this file.
// Options: onsetThresh (0.5), frameThresh (0.3), minNoteMs (128, as in the Python version), minPitch, maxPitch,
// melodiaTrick (true: also picks up notes whose start it missed).
// Also loads in Node (module.exports), given a tf object: BasicPitch.useTf(require("@tensorflow/tfjs")).
(function () {
  "use strict";

  const SR = 22050, HOP = 256, FPS = Math.floor(SR / HOP);        // 86 frames a second
  const WIN = SR * 2 - HOP;                                        // 43844 samples per model window
  const OVERLAP = 30, HALF = OVERLAP / 2, OVERLAP_SAMPLES = OVERLAP * HOP, STEP = WIN - OVERLAP_SAMPLES;
  const ANNOT_N_FRAMES = FPS * 2;
  const WINDOW_OFFSET = (HOP / SR) * (ANNOT_N_FRAMES - WIN / HOP) + 0.0018;
  const KEYS = 88, MIDI_OFFSET = 21, CONTOUR_BINS = 264, BINS_PER_SEMI = 3;

  let tf = typeof window !== "undefined" ? window.tf : null, model = null, loading = null;
  const base = (() => {
    try { const s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, "") : ""; } catch (e) { return ""; }
  })();

  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Couldn't load " + src));
      document.head.appendChild(s);
    });
  }
  function fromScript(m) {
    const bin = atob(m.weights), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return tf.io.fromMemory({ ...m.spec, weightData: bytes.buffer });
  }
  async function ready(opts = {}) {
    if (model) return model;
    if (!loading) loading = (async () => {
      if (!tf && typeof window !== "undefined") { await loadScript(base + "basicpitch-tf.min.js"); tf = window.tf; }
      if (!tf) throw new Error("TensorFlow.js isn't loaded");
      if (!opts.modelUrl && !window.BASIC_PITCH_MODEL) await loadScript(base + "basicpitch-model.js");
      model = await tf.loadGraphModel(opts.modelUrl || fromScript(window.BASIC_PITCH_MODEL));
      return model;
    })().catch((e) => { loading = null; throw e; });
    return loading;
  }

  // ---------------------------------------------------------------------------
  // Audio in: mono at 22050 Hz. Browsers resample with an OfflineAudioContext (best quality);
  // elsewhere a windowed-sinc resampler.
  function monoOf(buf) {
    const n = buf.length, out = new Float32Array(n), chs = buf.numberOfChannels;
    for (let c = 0; c < chs; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / chs; }
    return out;
  }
  function resample(x, from, to) {
    if (from === to) return x;
    const ratio = to / from, n = Math.floor(x.length * ratio), y = new Float32Array(n), cut = Math.min(1, ratio), A = 16;
    for (let i = 0; i < n; i++) {
      const t = i / ratio, c = Math.floor(t);
      let s = 0;
      for (let k = c - A + 1; k <= c + A; k++) {
        if (k < 0 || k >= x.length) continue;
        const d = t - k, w = 0.5 + 0.5 * Math.cos((Math.PI * d) / A);
        s += x[k] * (d === 0 ? cut : Math.sin(Math.PI * cut * d) / (Math.PI * d)) * w;
      }
      y[i] = s;
    }
    return y;
  }
  async function to22k(buf) {
    if (buf instanceof Float32Array) return buf;
    if (buf.sampleRate === SR && buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
    const OAC = typeof window !== "undefined" && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
    if (OAC) {
      try {
        const oac = new OAC(1, Math.ceil((buf.length * SR) / buf.sampleRate), SR);
        const src = oac.createBufferSource(); src.buffer = buf; src.connect(oac.destination); src.start();
        return (await oac.startRendering()).getChannelData(0).slice();
      } catch (e) { /* falls through to the plain resampler */ }
    }
    return resample(monoOf(buf), buf.sampleRate, SR);
  }

  // ---------------------------------------------------------------------------
  // The model: 2-second windows overlapping by 30 frames; the overlap is trimmed off each side.
  // Returns frames/onsets (n x 88) and contours (n x 264) as flat Float32Arrays.
  async function run(audio, onProgress) {
    const m = await ready();
    const padded = new Float32Array(OVERLAP_SAMPLES / 2 + audio.length);
    padded.set(audio, OVERLAP_SAMPLES / 2);
    const nWin = Math.max(1, Math.ceil(Math.max(0, padded.length - WIN) / STEP) + 1);
    const nOut = Math.floor(audio.length * (FPS / SR));
    const frames = new Float32Array(nOut * KEYS), onsets = new Float32Array(nOut * KEYS), contours = new Float32Array(nOut * CONTOUR_BINS);
    let at = 0;
    for (let w = 0; w < nWin && at < nOut; w++) {
      const chunk = new Float32Array(WIN);
      chunk.set(padded.subarray(w * STEP, Math.min(padded.length, w * STEP + WIN)));
      const input = tf.tensor3d(chunk, [1, WIN, 1]);
      const out = m.execute(input, ["Identity_1", "Identity_2", "Identity"]);   // frames, onsets, contours
      const [fr, on, co] = await Promise.all(out.map((t) => t.data()));
      input.dispose(); out.forEach((t) => t.dispose());
      const per = fr.length / KEYS, keep = per - 2 * HALF, take = Math.min(keep, nOut - at);
      frames.set(fr.subarray(HALF * KEYS, (HALF + take) * KEYS), at * KEYS);
      onsets.set(on.subarray(HALF * KEYS, (HALF + take) * KEYS), at * KEYS);
      contours.set(co.subarray(HALF * CONTOUR_BINS, (HALF + take) * CONTOUR_BINS), at * CONTOUR_BINS);
      at += take;
      if (onProgress) onProgress((w + 1) / nWin);
      await new Promise((r) => setTimeout(r, 0));   // keep the screen moving
    }
    return { n: at, frames, onsets, contours };
  }

  // ---------------------------------------------------------------------------
  // Notes from the model's output (outputToNotesPoly + addPitchBendsToNoteEvents).
  const frameToTime = (f) => (f * HOP) / SR - WINDOW_OFFSET * Math.floor(f / ANNOT_N_FRAMES);

  function notesFrom({ n, frames, onsets, contours }, o = {}) {
    const onsetThresh = o.onsetThresh != null ? o.onsetThresh : 0.5;
    const frameThresh = o.frameThresh != null ? o.frameThresh : 0.3;
    const minLen = Math.max(1, Math.round(((o.minNoteMs != null ? o.minNoteMs : 128) / 1000) * FPS));
    const TOL = 11, lo = o.minPitch != null ? Math.max(0, o.minPitch - MIDI_OFFSET) : 0, hi = o.maxPitch != null ? Math.min(KEYS, o.maxPitch - MIDI_OFFSET + 1) : KEYS;
    if (n < 3) return [];
    const at = (a, f, k) => a[f * KEYS + k];
    for (let f = 0; f < n; f++) for (let k = 0; k < KEYS; k++) if (k < lo || k >= hi) { frames[f * KEYS + k] = 0; onsets[f * KEYS + k] = 0; }

    // inferred onsets: where the frame energy jumps, scaled to the onset output, max with it
    const inf = new Float32Array(n * KEYS);
    let onMax = 0, dMax = 0;
    for (let i = 0; i < n * KEYS; i++) onMax = Math.max(onMax, onsets[i]);
    for (let f = 2; f < n; f++) for (let k = 0; k < KEYS; k++) {
      const v = Math.max(0, Math.min(at(frames, f, k) - at(frames, f - 1, k), at(frames, f, k) - at(frames, f - 2, k)));
      inf[f * KEYS + k] = v; dMax = Math.max(dMax, v);
    }
    for (let i = 0; i < n * KEYS; i++) inf[i] = Math.max(onsets[i], dMax ? (onMax * inf[i]) / dMax : 0);

    // note starts: local peaks over time above the threshold, latest first
    const starts = [];
    for (let f = 0; f < n; f++) for (let k = 0; k < KEYS; k++) {
      const v = inf[f * KEYS + k];
      if (v <= onsetThresh) continue;
      if (f > 0 && !(v > inf[(f - 1) * KEYS + k])) continue;
      if (f < n - 1 && !(v > inf[(f + 1) * KEYS + k])) continue;
      starts.push(f * KEYS + k);
    }
    starts.sort((a, b) => b - a);

    const left = frames.slice(), notes = [];
    const clear = (f, k) => { left[f * KEYS + k] = 0; if (k < KEYS - 1) left[f * KEYS + k + 1] = 0; if (k > 0) left[f * KEYS + k - 1] = 0; };
    const amp = (k, a, z) => { let s = 0; for (let f = a; f < z; f++) s += at(frames, f, k); return s / Math.max(1, z - a); };
    for (const idx of starts) {
      const s = Math.floor(idx / KEYS), k = idx % KEYS;
      if (s >= n - 1) continue;
      let i = s + 1, miss = 0;
      while (i < n - 1 && miss < TOL) { miss = left[i * KEYS + k] < frameThresh ? miss + 1 : 0; i++; }
      i -= miss;
      if (i - s <= minLen) continue;
      for (let f = s; f < i; f++) clear(f, k);
      notes.push({ s, e: i, k, amplitude: amp(k, s, i), strong: onsets[idx] > onsetThresh });
    }

    // "melodia trick": loud energy that no start claimed becomes a note too
    if (o.melodiaTrick !== false) {
      for (let guard = 0; guard < 20000; guard++) {
        let best = -1, bv = frameThresh;
        for (let i = 0; i < n * KEYS; i++) if (left[i] > bv) { bv = left[i]; best = i; }
        if (best < 0) break;
        const mid = Math.floor(best / KEYS), k = best % KEYS;
        left[best] = 0;
        let i = mid + 1, miss = 0;
        while (i < n - 1 && miss < TOL) { miss = left[i * KEYS + k] < frameThresh ? miss + 1 : 0; clear(i, k); i++; }
        const end = i - 1 - miss;
        i = mid - 1; miss = 0;
        while (i > 0 && miss < TOL) { miss = left[i * KEYS + k] < frameThresh ? miss + 1 : 0; clear(i, k); i--; }
        const start = i + 1 + miss;
        if (end - start <= minLen) continue;
        notes.push({ s: start, e: end, k, amplitude: amp(k, start, end) });
      }
    }

    // A held chord note often comes out in two pieces where the model "heard" a new start from
    // a change in the other notes. Join same-pitch pieces that touch, unless the model's own
    // onset output says it was played again.
    if (o.join !== false) {
      notes.sort((a, b) => a.k - b.k || a.s - b.s);
      for (let i = notes.length - 1; i > 0; i--) {
        const a = notes[i - 1], b = notes[i];
        if (a.k === b.k && b.s - a.e <= 3 && !b.strong) { a.amplitude = (a.amplitude * (a.e - a.s) + b.amplitude * (b.e - b.s)) / (b.e - a.s); a.e = Math.max(a.e, b.e); notes.splice(i, 1); }
      }
    }

    // pitch bends: the strongest contour bin near the note, frame by frame, in semitones
    const TOLB = 25, gauss = Array.from({ length: TOLB * 2 + 1 }, (_, i) => Math.exp(-((i - TOLB) ** 2) / 50));
    return notes.map((q) => {
      const pitch = q.k + MIDI_OFFSET;
      const centre = Math.round(12 * BINS_PER_SEMI * Math.log2(440 * 2 ** ((pitch - 69) / 12) / 27.5));
      const bends = [];
      for (let f = q.s; f < q.e; f++) {
        let bi = 0, bv = -1;
        for (let b = Math.max(0, centre - TOLB); b < Math.min(CONTOUR_BINS, centre + TOLB + 1); b++) {
          const v = contours[f * CONTOUR_BINS + b] * gauss[b - centre + TOLB];
          if (v > bv) { bv = v; bi = b; }
        }
        bends.push(+((bi - centre) / BINS_PER_SEMI).toFixed(2));
      }
      const start = frameToTime(q.s), end = frameToTime(q.e);
      return { start, end, pitch, amplitude: q.amplitude, velocity: Math.max(1, Math.min(127, Math.round(127 * q.amplitude))), bends };
    }).sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  }

  async function transcribe(buf, opts = {}) {
    await ready(opts);
    const audio = await to22k(buf);
    const out = await run(audio, opts.onProgress);
    return notesFrom(out, opts);
  }

  // ---------------------------------------------------------------------------
  // For "recreate the sound": the notes in up to three registers, each its own TOY MACHINE.
  // The bass is anything mostly under C3, the top line anything that sits over the chords.
  // A register only becomes a part when it has enough notes to matter.
  function splitParts(notes, { low = 48, high = 72, min = 3 } = {}) {
    const parts = { low: [], mid: [], high: [] };
    for (const q of notes) (q.pitch < low ? parts.low : q.pitch >= high ? parts.high : parts.mid).push(q);
    // too few notes to be their own part: the bass or top line folds into the chords, and a
    // thin chord part into whichever of the other two is bigger
    for (const k of ["low", "high"]) if (parts[k].length < min) { parts.mid.push(...parts[k]); parts[k] = []; }
    if (parts.mid.length < min && (parts.low.length || parts.high.length)) {
      parts[parts.low.length >= parts.high.length ? "low" : "high"].push(...parts.mid); parts.mid = [];
    }
    for (const k of Object.keys(parts)) parts[k].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    return parts;
  }

  // The cleanest stretch of one note in a part: long, loud and with the fewest other notes
  // sounding at the same time. That bit of the clip is what TOY MACHINE learns the sound from.
  function cleanestNote(part, all) {
    let best = null, bs = -Infinity;
    for (const q of part) {
      const len = Math.min(2, q.end - q.start);
      if (len < 0.12) continue;
      const others = all.filter((x) => x !== q && x.start < q.end && x.end > q.start).length;
      const s = len * (0.4 + q.amplitude) / (1 + 1.5 * others);
      if (s > bs) { bs = s; best = q; }
    }
    return best;
  }

  const api = { transcribe, notesFrom, splitParts, cleanestNote, resample, ready, useTf: (t) => { tf = t; }, SR };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.BasicPitch = api;
})();
