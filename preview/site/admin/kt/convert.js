// Convert audio to MIDI, like Ableton's Convert commands (right-click an audio clip):
//  - notes / synth: every note, chords too, by Basic Pitch (ui/basicpitch.js); synth also
//            rebuilds the sound as TOY MACHINEs (the engine does that part)
//  - melody: the notes of a one-voice part (vocal, bass, lead) for a new TOY MACHINE lane
//  - drums:  each hit, sorted into kick / snare / hat, for a new TOY DRUMS lane
//  - slice:  the clip cut at its hits (max 16), each piece on a TOY DRUMS pad, plus a part
//            that plays them in order, so it sounds the same and can be re-programmed
// The analysis runs on the clip's decoded audio (anything with sampleRate, length,
// numberOfChannels and getChannelData, like an AudioBuffer). Times are seconds from the
// clip's start. The engine (playground.js `convertToMidi`) turns them into lanes and notes.
// Also loads in Node (module.exports) so the detectors can be tested on made-up signals.
(function () {
  "use strict";

  // Mono mix of a buffer.
  function mono(buf) {
    const n = buf.length, out = new Float32Array(n), chs = buf.numberOfChannels;
    for (let c = 0; c < chs; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / chs; }
    return out;
  }

  // In-place radix-2 FFT (re, im length = power of two).
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
  const hann = (n) => { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); return w; };

  // ---------------------------------------------------------------------------
  // Hits: spectral flux (how much new sound arrives in each 5.8 ms step, on a log scale so
  // a quiet hat under a loud kick still counts), plus the rise below 300 Hz on its own (a
  // clean sub kick is only a few bins, so it hardly moves the first), then peaks over a
  // moving median.
  function onsets(x, sr, { minGap = 0.05, sens = 1 } = {}) {
    const N = 1024, hop = Math.max(64, Math.round(sr * 0.0058)), w = hann(N), bins = N / 2;
    const frames = Math.max(0, Math.floor((x.length - N) / hop) + 1);
    const flux = new Float32Array(frames), lowF = new Float32Array(frames), rms = new Float32Array(frames), LOW = Math.max(2, Math.round((300 * N) / sr));
    let prev = null, prevLo = new Float32Array(LOW), top = 0;
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let f = 0; f < frames; f++) {
      const o = f * hop;
      let e = 0;
      for (let i = 0; i < N; i++) { const v = x[o + i]; re[i] = v * w[i]; im[i] = 0; e += v * v; }
      rms[f] = Math.sqrt(e / N); if (rms[f] > top) top = rms[f];
      fft(re, im);
      const mag = new Float32Array(bins);
      let s = 0, lo = 0;
      for (let k = 1; k < bins; k++) {
        const m = Math.hypot(re[k], im[k]);
        mag[k] = Math.log1p(1000 * m); if (prev) { const d = mag[k] - prev[k]; if (d > 0) s += d; }
        if (k < LOW) { if (m > prevLo[k]) lo += m - prevLo[k]; prevLo[k] = m; }
      }
      flux[f] = s; lowF[f] = prev ? lo : 0; prev = mag;
    }
    if (top < 1e-4) return [];
    { // the two together, each scaled to its loudest
      let a = 0, b = 0; for (let f = 0; f < frames; f++) { a = Math.max(a, flux[f]); b = Math.max(b, lowF[f]); }
      for (let f = 0; f < frames; f++) flux[f] = flux[f] / (a || 1) + lowF[f] / (b || 1);
    }
    const W = 25, gap = Math.round((minGap * sr) / hop), hits = [];
    let maxF = 0; for (let f = 0; f < frames; f++) maxF = Math.max(maxF, flux[f]);
    let last = -1e9;
    for (let f = 1; f < frames - 1; f++) {
      if (flux[f] < flux[f - 1] || flux[f] < flux[f + 1]) continue;
      const win = Array.from(flux.subarray(Math.max(0, f - W), Math.min(frames, f + W))).sort((a, b) => a - b);
      const med = win[win.length >> 1];
      if (flux[f] < med * 1.5 + maxF * 0.08 / sens) continue;
      // something has to be heard there (not just a change in the noise floor)
      let pk = 0; for (let k = f; k < Math.min(frames, f + 8); k++) pk = Math.max(pk, rms[k]);
      if (pk < top * 0.02) continue;
      // and it has to get louder (a sound dying away can still change colour)
      if (f >= 4 && pk < rms[f - 4] * 1.25) continue;
      if (f - last < gap) { // two peaks close together: keep the stronger
        const h = hits[hits.length - 1];
        if (h && flux[f] > h.strength) { h.at = (f * hop + N / 4) / sr; h.strength = flux[f]; h.peak = pk; last = f; }
        continue;
      }
      // the analysis window is centred late; the sound starts about a quarter window in
      hits.push({ at: Math.max(0, (f * hop + N / 4) / sr), strength: flux[f], peak: pk });
      last = f;
    }
    // move each hit to where its sound starts: the 1 ms step where the level jumps most
    // (a ringing kick before it doesn't count, only the jump does)
    const B = Math.max(8, Math.round(sr * 0.001));
    for (const h of hits) {
      const a = Math.max(0, Math.round((h.at - 0.03) * sr)), nb = Math.floor((Math.min(x.length, Math.round((h.at + 0.03) * sr)) - a) / B);
      const env = new Float32Array(nb);
      for (let b = 0; b < nb; b++) { let pk = 0; for (let i = a + b * B, z = i + B; i < z; i++) pk = Math.max(pk, Math.abs(x[i])); env[b] = pk; }
      let best = -1, jump = 0;
      for (let b = 2; b < nb; b++) { const j = env[b] - Math.max(env[b - 1], env[b - 2]); if (j > jump) { jump = j; best = b; } }
      if (best > 0) h.at = (a + (best - 1) * B) / sr;
    }
    hits.sort((p, q) => p.at - q.at);
    for (let i = hits.length - 1; i > 0; i--) if (hits[i].at - hits[i - 1].at < minGap * 0.6) hits.splice(hits[i].strength > hits[i - 1].strength ? i - 1 : i, 1);
    // a hit right at the start (no step before it to compare with)
    let e0 = 0; for (let i = 0; i < Math.min(x.length, Math.round(0.02 * sr)); i++) e0 = Math.max(e0, Math.abs(x[i]));
    if (e0 > top * 0.5 && (!hits.length || hits[0].at > minGap)) hits.unshift({ at: 0, strength: 1, peak: Math.max(top * 0.5, rms[0]) });
    return hits;
  }

  // Kick / snare / hat, from the first 60 ms of a hit: how much is below 150 Hz, and the
  // spectral centroid (where the sound's "weight" sits).
  function classify(x, sr, at) {
    const N = 4096, a = Math.round(at * sr), len = Math.min(N, Math.round(0.06 * sr));
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < len && a + i < x.length; i++) re[i] = x[a + i] * (0.5 + 0.5 * Math.cos((Math.PI * i) / len));
    fft(re, im);
    let tot = 0, low = 0, high = 0, cen = 0;
    for (let k = 1; k < N / 2; k++) {
      const hz = (k * sr) / N, p = re[k] * re[k] + im[k] * im[k];
      tot += p; cen += hz * p;
      if (hz < 150) low += p;
      if (hz > 5000) high += p;
    }
    if (!tot) return { kind: "snare", lowFrac: 0, highFrac: 0, centroid: 0 };
    const lowFrac = low / tot, highFrac = high / tot, centroid = cen / tot;
    const kind = lowFrac > 0.45 || centroid < 250 ? "kick" : highFrac > 0.5 || centroid > 8000 ? "hat" : "snare";
    return { kind, lowFrac, highFrac, centroid };
  }

  // Drums from a drum stem (RECREATE THE SOUNDS): each part listened for in its own band, so a
  // kick and a hat on the same beat are both found. Kick = below 150 Hz, snare/clap = 300 Hz-3 kHz,
  // hat = above 7 kHz; a band's hit right on a louder hit of another drum is that drum's spill.
  function biquad(x, sr, type, f, q = 0.707) {
    const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  // Hits in one band: where its loudness (5 ms steps) jumps well above what it was just before.
  function bandHits(y, sr, { gap = 0.07, jump = 2.2, floor = 0.04 } = {}) {
    const hop = Math.round(sr * 0.005), n = Math.floor(y.length / hop), env = new Float32Array(n);
    for (let f = 0; f < n; f++) { let e = 0; for (let i = f * hop, z = i + hop; i < z; i++) e += y[i] * y[i]; env[f] = Math.sqrt(e / hop); }
    let top = 0; for (const v of env) top = Math.max(top, v);
    if (top < 1e-4) return [];
    const hits = [];
    let last = -1e9;
    for (let f = 3; f < n - 4; f++) {
      const before = Math.max(env[f - 1], env[f - 2], env[f - 3]) + top * 0.01;
      let pk = 0; for (let k = f; k < f + 4; k++) pk = Math.max(pk, env[k]);
      if (env[f] < before * 1.3 || pk < before * jump || pk < top * floor) continue;
      if ((f - last) * hop / sr < gap) { const h = hits[hits.length - 1]; if (pk > h.peak) { h.peak = pk; } continue; }
      hits.push({ at: f * hop / sr, peak: pk, frame: f });
      last = f;
    }
    return hits.map((h) => ({ ...h, top }));
  }
  function drumsByBand(buf, o = {}) {
    const x = mono(buf), sr = buf.sampleRate;
    const low = biquad(biquad(x, sr, "lp", 150), sr, "lp", 150);
    const mid = biquad(biquad(x, sr, "hp", 300), sr, "lp", 3000);
    const high = biquad(biquad(x, sr, "hp", 7000), sr, "hp", 7000);
    const K = bandHits(low, sr, { gap: 0.09, jump: o.kj || 2.2 }), S = bandHits(mid, sr, { gap: 0.09, jump: o.sj || 2.2 }), H = bandHits(high, sr, { gap: 0.05, jump: o.hj || 2.2 });
    // A band's hit counts when it is a real part of that band (rel = against the band's loudest) and
    // isn't just the spill of a louder hit of another drum at the same moment. Tuned on two songs
    // with known drum parts (u wanna V9: kick/clap/hat F 0.97/1.00/1.00; 2 Ahead, a loud master).
    const near = (list, at) => list.find((h) => Math.abs(h.at - at) < 0.02);
    const rel = (h) => h.peak / h.top;
    const out = [];
    for (const h of K) if (rel(h) >= 0.2) out.push({ at: h.at, kind: "kick", velocity: velOf(h.peak, h.top) });
    for (const h of S) { const k = near(K, h.at); if (rel(h) >= 0.35 && (!k || rel(h) >= rel(k) * 4)) out.push({ at: h.at, kind: "snare", velocity: velOf(h.peak, h.top) }); }
    for (const h of H) { const sn = near(S, h.at); if (rel(h) >= 0.1 && (!sn || rel(h) >= rel(sn) * 0.5)) out.push({ at: h.at, kind: "hat", velocity: velOf(h.peak, h.top) }); }
    return out.sort((a, b) => a.at - b.at);
  }

  const velOf = (peak, top) => Math.max(30, Math.min(127, Math.round(40 + 87 * Math.sqrt(peak / (top || 1)))));

  // Drums -> [{ at, kind, velocity }]
  function drums(buf) {
    const x = mono(buf), sr = buf.sampleRate, hits = onsets(x, sr);
    const top = Math.max(0, ...hits.map((h) => h.peak));
    return hits.map((h) => ({ at: h.at, velocity: velOf(h.peak, top), ...classify(x, sr, h.at) }));
  }

  // Slices -> [{ start, end }] in order, at most `max`, the first from the clip's start so the
  // pieces end to end are the whole clip. Too many hits: the strongest are kept.
  function slices(buf, max = 16) {
    const x = mono(buf), sr = buf.sampleRate, dur = buf.length / sr;
    let hits = onsets(x, sr, { minGap: 0.06 });
    if (hits.length > max) hits = hits.slice().sort((a, b) => b.strength - a.strength).slice(0, max).sort((a, b) => a.at - b.at);
    const starts = hits.map((h) => h.at);
    if (!starts.length || starts[0] > 0.1) { if (starts.length >= max) starts.shift(); starts.unshift(0); } else starts[0] = 0;
    const top = Math.max(0, ...hits.map((h) => h.peak));
    return starts.map((s, i) => {
      const h = hits.find((q) => Math.abs(q.at - s) < 0.03);
      return { start: s, end: i < starts.length - 1 ? starts[i + 1] : dur, velocity: 127, peak: h ? h.peak : top };
    });
  }

  // ---------------------------------------------------------------------------
  // Melody: YIN pitch every 10 ms on an ~11 kHz copy (50..1000 Hz), then notes: a note
  // starts where the voice starts, re-attacks, or moves to another semitone and stays there
  // for 40 ms; it must last at least 60 ms. Pitch = the median, rounded to a semitone.
  function pitchTrack(buf) {
    const src = mono(buf), d = Math.max(1, Math.round(buf.sampleRate / 11025)), sr = buf.sampleRate / d;
    const n = Math.floor(src.length / d), x = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < d; k++) v += src[i * d + k]; x[i] = v / d; }
    const W = Math.round(sr * 0.04), hop = Math.round(sr * 0.01), tMin = Math.floor(sr / 1000), tMax = Math.ceil(sr / 50);
    const df = new Float32Array(tMax + 2), frames = [];
    let loud = 0;
    for (let o = 0; o + W < n; o += hop) { let e = 0; for (let i = 0; i < W; i++) e += x[o + i] * x[o + i]; loud = Math.max(loud, Math.sqrt(e / W)); }
    for (let o = 0; o + W + tMax + 1 < n; o += hop) {
      let e = 0;
      for (let i = 0; i < W; i++) e += x[o + i] * x[o + i];
      const rms = Math.sqrt(e / W);
      if (rms < loud * 0.05) { frames.push({ midi: 0, rms }); continue; }
      let run = 0, best = 0;
      df[0] = 1;
      for (let tau = 1; tau <= tMax + 1; tau++) {
        let s = 0;
        for (let i = 0; i < W; i++) { const q = x[o + i] - x[o + i + tau]; s += q * q; }
        run += s; df[tau] = run ? (s * tau) / run : 1;
      }
      for (let tau = tMin; tau <= tMax; tau++) {
        if (df[tau] < 0.15) { while (tau < tMax && df[tau + 1] < df[tau]) tau++; best = tau; break; }
      }
      if (best) { // parabolic interpolation between lags for a finer period
        const a = df[best - 1], b = df[best], c = df[best + 1], den = a - 2 * b + c;
        const t = den ? best + (0.5 * (a - c)) / den : best;
        frames.push({ midi: 69 + 12 * Math.log2(sr / t / 440), rms });
      } else frames.push({ midi: 0, rms });
    }
    return { frames, hop: 0.01, loud };
  }

  function melody(buf) {
    const { frames, hop, loud } = pitchTrack(buf), notes = [];
    const STAY = 4, MIN = Math.ceil(0.06 / hop);
    let cur = null;
    const flush = (end) => {
      if (cur && end - cur.from >= MIN) {
        const m = cur.vals.slice().sort((a, b) => a - b)[cur.vals.length >> 1];
        notes.push({ start: cur.from * hop, end: end * hop, pitch: Math.round(m), peak: cur.peak });
      }
      cur = null;
    };
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (!f.midi) { flush(i); continue; }
      const semi = Math.round(f.midi);
      // a re-attack: the level jumps up after a dip (a new syllable on the same note)
      const reattack = cur && i >= 3 && f.rms > frames[i - 3].rms * 2.2 && frames[i - 3].rms > 0;
      if (cur && (reattack || Math.abs(f.midi - cur.ref) > 0.6)) {
        // a new pitch has to hold for STAY frames, or it's a slide/wobble inside the note
        let holds = 1;
        while (holds < STAY && i + holds < frames.length && frames[i + holds].midi && Math.abs(Math.round(frames[i + holds].midi) - semi) <= 0) holds++;
        if (reattack || holds >= STAY) { flush(i); }
      }
      if (!cur) cur = { from: i, vals: [], ref: f.midi, peak: 0 };
      cur.vals.push(f.midi);
      cur.ref = cur.vals.slice().sort((a, b) => a - b)[cur.vals.length >> 1];
      cur.peak = Math.max(cur.peak, f.rms);
    }
    flush(frames.length);
    return notes.map((q) => ({ ...q, velocity: velOf(q.peak, loud) }));
  }

  // ---------------------------------------------------------------------------
  // The right-click menu entries for an audio clip (only when the engine has convertToMidi).
  // "Make into MIDI" and "Clone the sound" use Basic Pitch (ui/basicpitch.js), which hears
  // chords too; both open TOY MACHINE when done (open(r)). The older one-voice "melody" mode
  // still works as a command, it's just not in the menu any more.
  const MODES = {
    notes: ["Make into MIDI", "TOY MACHINE plays it", (r) => `Found ${r.notes} notes. TOY MACHINE plays them on a new lane under it. Cmd+Z takes it away.`],
    synth: ["Clone the sound", "the notes and the sound", (r) => `Found ${r.notes} notes and made ${r.lanes.length > 1 ? r.lanes.length + " TOY MACHINEs (" + r.detail + ")" : "a TOY MACHINE"} that sound like it. Cmd+Z takes it away.`],
    drums: ["Make into drums", "kick, snare, hat", (r) => `Found ${r.notes} hits (${r.detail}). They're on a new TOY DRUMS lane under it. Cmd+Z takes it away.`],
    slice: ["Slice to drums", "each hit on a pad", (r) => `Cut into ${r.notes} slices, one per pad on a new TOY DRUMS lane, playing in order. Cmd+Z takes it away.`],
  };
  const SLOW = { notes: "Listening for notes\u2026", synth: "Listening for notes and the sound\u2026" };
  function menuItems(c, run, toast, open, key) {
    // Make it major / minor: the clip's own recording with its 3rds, 6ths and 7ths moved
    // (ui/notemove.js). Offered the other way from the song's key.
    const to = key && key.minor === false ? "minor" : "major";
    const mode = { label: to === "major" ? "Make it major" : "Make it minor", meta: "keeps your sound",
      run: () => {
        toast("Moving the notes\u2026");
        return run("changeMode", { clipId: c.id, to }).then((r) => {
          if (r && r.ok) toast(`Moved ${r.moved} of ${r.notes} notes to ${r.root} ${to}. Cmd+Z puts it back.`);
          else if (r && r.error) toast(r.error);
        });
      } };
    return [mode, ...Object.entries(MODES).map(([mode, [label, meta, done]]) => ({
      label, meta,
      run: () => {
        if (SLOW[mode]) toast(SLOW[mode]);
        return run("convertToMidi", { clipId: c.id, mode }).then((r) => {
          if (r && r.ok) { toast(done(r)); if (open && SLOW[mode]) open(r); }
          else if (r && r.error) toast(r.error);
        });
      },
    }))];
  }

  const api = { mono, fft, onsets, classify, drums, drumsByBand, slices, pitchTrack, melody, menuItems };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.killtoyConvert = api;
})();
