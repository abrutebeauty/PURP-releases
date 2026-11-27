/* BLOB: the paint-a-sound synth. This file is the sound only (no drawing), so the
   KILLTOY playground can play BLOB lanes the same way it plays TOY MACHINE ones.

   A patch is a few soft balls melted together. Each ball has a colour, and every colour is
   part of the sound. Balls belong to a group: a "synth" group is one blob = one synth layer,
   a "sound" group is a dropped audio file that mixes into the nearest synth blob.

     patch = { v: 1, name, mode, level,
               groups: [{ id, kind: "synth" | "sound", name, mute, col, sound }],
               balls:  [{ p: [x, y, z], r, c: "SAW", g: groupId, core: 1 | 0 }],
               sounds: { id: { name, sr, b64 } } }      // 16-bit mono, base64

   The shape of a blob sets the sound: wider = wider (more unison voices), taller = brighter,
   hanging down = more low end, deeper (toward you) = softer start, bigger = louder and a
   longer tail, higher up = an octave higher, left/right = pan.

   const e = BlobEngine.create({ ctx, patch, getBpm });
   e.output.connect(dest);  e.noteOn(60, 1, when);  e.noteOff(60, when);
   e.schedule([{ pitch, velocity, on, off }]);  e.flush();  e.setPatch(p);  e.close();  */
(function () {
  'use strict';

  // Every colour is part of the sound. SOUND = what makes the tone, SHAPE = how a note moves,
  // EFFECTS = what happens after. mv = the colour moves on the blob while it plays.
  const COL = [
    { n: 'SAW', d: 'bright and buzzy, the start', c: '#ff8fd0', k: 'sound' },
    { n: 'SQUARE', d: 'hollow, video-game', c: '#5ff2bb', k: 'sound' },
    { n: 'ROUND', d: 'soft pure tone', c: '#8fd0ff', k: 'sound' },
    { n: 'METAL', d: 'bells and clangs', c: '#b9a8ff', k: 'sound' },
    { n: 'AIR', d: 'breath and hiss', c: '#e6f0ff', k: 'sound' },
    { n: 'SUB', d: 'deep octave under it', c: '#4b3cff', k: 'sound' },
    { n: 'GLOW', d: 'octave on top', c: '#ffe45c', k: 'sound' },
    { n: 'SWEEP', d: 'filter opens on each note', c: '#9b6bff', k: 'shape' },
    { n: 'SQUELCH', d: 'sharp filter peak', c: '#ff5ce6', k: 'shape' },
    { n: 'PLUCK', d: 'short and snappy', c: '#7dffa8', k: 'shape' },
    { n: 'SWELL', d: 'slow fade in', c: '#ffc79a', k: 'shape' },
    { n: 'WOBBLE', d: 'filter that moves by itself', c: '#c6ff5c', k: 'shape', mv: 1 },
    { n: 'HEAT', d: 'warm distortion', c: '#ff4f6e', k: 'fx' },
    { n: 'CRUSH', d: 'lo-fi bitcrush', c: '#ff9a3c', k: 'fx' },
    { n: 'PHASER', d: 'swirling sweep', c: '#ff4fd8', k: 'fx', mv: 1 },
    { n: 'SHIMMER', d: 'chorus, wide and wavy', c: '#5ce1ff', k: 'fx', mv: 1 },
    { n: 'ECHO', d: 'repeats in time', c: '#c4a4ff', k: 'fx', mv: 1 },
    { n: 'SPACE', d: 'reverb, a room around it', c: '#4f7dff', k: 'fx' }];
  const I = {}; COL.forEach((c, i) => { I[c.n] = i; });
  const OSC = ['SAW', 'SQUARE', 'ROUND', 'METAL'].map((n) => I[n]);
  const SCOL = ['#f0c27a', '#9ef0d0', '#f7a6ff', '#c7f06a', '#ffd0a6', '#a6d8ff'];   // dropped sounds
  const MODES = {
    DEFAULT: { oct: 4, sus: 0.75, dec: 0.4, att: 0, rel: 0, cut: 1, sub: 0, rev: 0, cho: 0, shift: 0, d: 'Anything goes' },
    SYNTH: { oct: 5, sus: 0.8, dec: 0.3, att: 0, rel: 0.05, cut: 1.3, sub: 0, rev: 0, cho: 0.1, shift: 0, d: 'Lead range, a bit brighter' },
    BASS: { oct: 2, sus: 0.9, dec: 0.3, att: 0, rel: 0, cut: 0.35, sub: 0.5, rev: -0.2, cho: 0, shift: -12, mono: 1, d: 'Low, one note at a time' },
    PLUCK: { oct: 4, sus: 0, dec: 0.22, att: 0, rel: 0.05, cut: 1.1, sub: 0, rev: 0.05, cho: 0, shift: 0, env: 0.6, d: 'Short notes that snap' },
    PAD: { oct: 4, sus: 0.9, dec: 0.6, att: 0.6, rel: 1.4, cut: 0.8, sub: 0, rev: 0.35, cho: 0.35, shift: 0, d: 'Slow and wide' },
    KEYS: { oct: 4, sus: 0.25, dec: 0.9, att: 0, rel: 0.3, cut: 1, sub: 0, rev: 0.1, cho: 0.05, shift: 0, d: 'Keys that fade out' }};
  const MAXB = 48;

  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // a ball's colour: a paint name, or "S:<group id>" = a dropped sound used as paint (-1 here)
  const ci = (c) => (typeof c === 'number' ? c : (I[c] != null ? I[c] : (/^S:/.test(c) ? -1 : 0)));
  const isSnd = (c) => typeof c === 'string' && c.slice(0, 2) === 'S:';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- patches ----------
  // Preset balls: [x, y, z, r, colour, blob number]; the first ball of each blob is its core.
  const PRESETS = [
    { n: 'Saw Circle', m: 'DEFAULT', b: [[0, 0, 0, 0.85, 'SAW', 0]] },
    { n: 'Gummy Bass', m: 'BASS', b: [[0, -0.1, 0, 0.8, 'SAW', 0], [0, -0.75, 0, 0.5, 'SUB', 0], [0.1, -1.15, 0.1, 0.32, 'SUB', 0], [0.3, 0.2, 0.4, 0.25, 'HEAT', 0], [-0.35, 0.25, 0.35, 0.22, 'HEAT', 0], [0.5, 0.5, 0.1, 0.22, 'SQUELCH', 0], [-0.5, -0.2, 0.5, 0.2, 'SQUARE', 0]] },
    { n: 'Glass Pluck', m: 'PLUCK', b: [[0, 0, 0, 0.7, 'ROUND', 0], [0, 0.75, 0, 0.38, 'GLOW', 0], [0, 1.15, 0, 0.22, 'GLOW', 0], [0.45, 0.3, 0.3, 0.25, 'PLUCK', 0], [-0.45, 0.25, 0.35, 0.24, 'METAL', 0], [0.2, -0.2, 0.55, 0.22, 'SPACE', 0], [-0.3, -0.3, 0.5, 0.2, 'ECHO', 0]] },
    { n: 'Cloud Pad', m: 'PAD', b: [[-0.8, 0, 0, 0.7, 'SAW', 0], [-1.6, 0.1, 0, 0.42, 'SHIMMER', 0], [-0.9, 0.2, 0.6, 0.4, 'SPACE', 0], [-0.7, -0.3, 0.55, 0.3, 'SWELL', 0], [1.2, 1.3, 0, 0.55, 'ROUND', 1], [1.4, 1.5, 0.4, 0.26, 'AIR', 1], [1, 1.1, 0.45, 0.25, 'SWELL', 1]] },
    { n: 'Rust Lead', m: 'SYNTH', b: [[0, 0, 0, 0.72, 'SAW', 0], [0.5, 0.5, 0.3, 0.3, 'HEAT', 0], [-0.4, 0.55, 0.25, 0.28, 'SQUARE', 0], [0, 0.9, 0, 0.3, 'SWEEP', 0], [0.2, -0.3, 0.6, 0.26, 'WOBBLE', 0], [-0.25, -0.35, 0.55, 0.24, 'ECHO', 0], [-0.5, 0.1, -0.5, 0.26, 'PHASER', 0]] },
    { n: 'Music Box', m: 'KEYS', b: [[0, 0, 0, 0.66, 'METAL', 0], [0, 0.8, 0, 0.32, 'GLOW', 0], [0.3, 0.45, 0.45, 0.24, 'PLUCK', 0], [-0.3, 0.45, 0.45, 0.22, 'ROUND', 0], [0, 0.1, 0.75, 0.24, 'SPACE', 0]] },
    { n: 'Acid Worm', m: 'BASS', b: [[0, 0, 0, 0.75, 'SQUARE', 0], [0.55, 0.35, 0.2, 0.3, 'SQUELCH', 0], [0.85, 0.55, 0.1, 0.22, 'SQUELCH', 0], [-0.5, 0.3, 0.3, 0.28, 'SWEEP', 0], [0, -0.7, 0.2, 0.34, 'SUB', 0], [-0.3, 0.2, -0.5, 0.26, 'CRUSH', 0]] },
    { n: 'Three Blob Stack', m: 'DEFAULT', b: [[0, 0, 0, 0.72, 'SAW', 0], [0.4, 0.3, 0.45, 0.24, 'SHIMMER', 0], [1.5, 1.35, 0, 0.5, 'SQUARE', 1], [1.7, 1.6, 0.3, 0.22, 'PLUCK', 1], [1.3, 1.7, 0.25, 0.2, 'ECHO', 1], [-1.5, -1.3, 0, 0.58, 'ROUND', 2], [-1.6, -1.75, 0.2, 0.3, 'SUB', 2]] }];

  function fromPreset(i) {
    const P = PRESETS[((i % PRESETS.length) + PRESETS.length) % PRESETS.length];
    const groups = [], balls = [], map = {};
    P.b.forEach(([x, y, z, r, c, g]) => {
      let core = 0;
      if (map[g] == null) { map[g] = groups.length; groups.push({ id: groups.length, kind: 'synth', name: 'BLOB ' + (groups.length + 1), mute: 0 }); core = 1; }
      balls.push({ p: [x, y, z], r, c, g: map[g], core });
    });
    return { v: 1, name: P.n, mode: P.m, level: 1, groups, balls, sounds: {} };
  }
  const INIT = () => fromPreset(0);

  // Older or hand-made patches: colour indexes become names, a missing core is added.
  function tidy(p) {
    p = p && p.groups && p.balls ? clone(p) : INIT();
    p.v = 1; p.mode = MODES[p.mode] ? p.mode : 'DEFAULT'; p.sounds = p.sounds || {};
    p.level = p.level == null ? 1 : +p.level;
    const sndOk = (c) => p.groups.some((g) => g.kind === 'sound' && 'S:' + g.id === c && p.balls.some((b) => b.g === g.id));
    p.balls = p.balls.filter((b) => !isSnd(b.c) || sndOk(b.c));   // paint of a sound that's gone goes too
    p.balls.forEach((b) => { if (typeof b.c === 'number') b.c = (COL[b.c] || COL[0]).n; if (!I.hasOwnProperty(b.c) && !isSnd(b.c)) b.c = 'SAW'; });
    p.groups = p.groups.filter((g) => p.balls.some((b) => b.g === g.id));
    if (!p.groups.some((g) => g.kind === 'synth')) { const s = INIT(); const id = Math.max(-1, ...p.groups.map((g) => g.id)) + 1; s.balls[0].g = id; p.groups.push({ ...s.groups[0], id }); p.balls.push(s.balls[0]); }
    p.groups.forEach((g) => { if (g.kind === 'synth' && !p.balls.some((b) => b.g === g.id && b.core)) p.balls.find((b) => b.g === g.id).core = 1; });
    return p;
  }

  // ---------- shape -> sound ----------
  const synths = (p) => p.groups.filter((g) => g.kind === 'synth');
  function centre(p, id) {
    let c = [0, 0, 0], V = 0;
    p.balls.forEach((b) => { if (b.g !== id) return; const v = b.r ** 3; c = add(c, b.p, v); V += v; });
    return V ? c.map((x) => x / V) : [0, 0, 0];
  }
  function measure(p, id) {
    const m = p.balls.filter((b) => b.g === id); if (!m.length) return null;
    const cv = new Array(COL.length).fill(0), sv = {};
    let V = 0, cx = 0, cy = 0, cz = 0;
    m.forEach((b) => { const v = b.r ** 3, k = ci(b.c); V += v; cx += b.p[0] * v; cy += b.p[1] * v; cz += b.p[2] * v; if (k >= 0) cv[k] += v; else sv[b.c.slice(2)] = (sv[b.c.slice(2)] || 0) + v; });
    cx /= V; cy /= V; cz /= V;
    const core = m.find((b) => b.core) || m[0], rc = core.r;
    let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9, zmin = 1e9, zmax = -1e9;
    m.forEach((b) => { xmin = Math.min(xmin, b.p[0] - b.r); xmax = Math.max(xmax, b.p[0] + b.r); ymin = Math.min(ymin, b.p[1] - b.r); ymax = Math.max(ymax, b.p[1] + b.r); zmin = Math.min(zmin, b.p[2] - b.r); zmax = Math.max(zmax, b.p[2] + b.r); });
    const size = Math.cbrt(V) / 0.85, amt = cv.map((v) => Math.min(1, (v / V) * 3.2));
    // the oscillator mix: each sound colour's share (the core counts fully)
    const snd = {}; for (const k in sv) snd[k] = Math.min(1, (sv[k] / V) * 3.2);
    let ow = OSC.map((i) => amt[i]), os = ow.reduce((a, b) => a + b, 0);
    if (os < 0.01) { ow = Object.keys(snd).length ? [0, 0, 0, 0] : [1, 0, 0, 0]; os = 1; }   // dipped in a sound: only the sound
    ow = ow.map((x) => x / os);
    const span = rc * 2;
    return { size, amt, ow, snd, cx, cy, cz,
      oct: clamp(Math.round(cy / 1.1), -2, 2), pan: clamp(cx / 2.4, -1, 1),
      width: clamp((xmax - xmin) / span / 1.25 - 1 + 0.25, 0, 1.5), height: clamp((ymax - cy - rc) / 1.2, -1, 1.5),
      low: clamp((cy - ymin - rc) / 1.1, 0, 1.5), depth: clamp((zmax - zmin) / span / 1.25 - 0.55, 0, 1.5),
      lumps: clamp((m.length - 1) / 14, 0, 1), n: m.length };
  }
  // A dropped sound mixes into the nearest synth blob: closer and bigger = more of it.
  function mixOf(p, g) {
    const gb = p.balls.filter((b) => b.g === g.id); if (!gb.length) return { w: 0, to: null };
    const c = centre(p, g.id); let best = null, bd = 1e9;
    synths(p).forEach((s) => { const d = Math.hypot(...add(centre(p, s.id), c, -1)); if (d < bd) { bd = d; best = s; } });
    const R = Math.cbrt(gb.reduce((s, b) => s + b.r ** 3, 0));
    return { w: clamp((2.6 - bd) / 2, 0, 1) * Math.min(1.3, R / 0.55), to: best };
  }

  // ---------- dropped sounds as 16-bit base64 ----------
  function packSound(buf, name, maxSec = 6) {
    const ch = buf.numberOfChannels, sr0 = buf.sampleRate, step = sr0 > 32000 ? 2 : 1;
    const n = Math.min(buf.length, Math.floor(sr0 * maxSec)), out = new Int16Array(Math.floor(n / step));
    let peak = 1e-6; const mono = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ch; }
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mono[i]));
    const k = Math.min(1 / peak, 4) * 0.9;
    for (let i = 0; i < out.length; i++) { let s = 0; for (let j = 0; j < step; j++) s += mono[i * step + j]; out[i] = clamp(Math.round((s / step) * k * 32767), -32767, 32767); }
    const bytes = new Uint8Array(out.buffer); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { name, sr: sr0 / step, b64: btoa(bin) };
  }
  function unpackSound(ctx, s) {
    const bin = atob(s.b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    const b = ctx.createBuffer(1, Math.max(1, pcm.length), s.sr), d = b.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) d[i] = pcm[i] / 32767;
    return b;
  }

  // ---------- curves ----------
  function curveDrive(k) { const n = 1024, cu = new Float32Array(n), a = 1 + k * 24; for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cu[i] = Math.tanh(a * x) / Math.tanh(a); } return cu; }
  function curveCrush(k) { const n = 1024, cu = new Float32Array(n), st = Math.max(3, Math.round(64 - k * 58)); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cu[i] = Math.round(x * st) / st; } return cu; }
  // output safety: straight up to 0.7, then rounds off, so stacked blobs with HEAT never pass 0 dBFS
  let CLIP = null;
  function curveClip() { if (CLIP) return CLIP; const n = 4096, cu = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x); cu[i] = Math.sign(x) * (a <= 0.7 ? a : 0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3)); } return (CLIP = cu); }
  // reverb tail: decaying noise, the same every time (seeded), so renders don't change
  function irBuf(ctx, sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate); let s = 1234567;
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = ((s / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / n, 2.6); } }
    return b;
  }

  // ---------- the engine ----------
  function create(opts = {}) {
    const c = opts.ctx; if (!c) throw new Error('BlobEngine.create needs { ctx }');
    let patch = tidy(opts.patch), closed = false;
    const getBpm = opts.getBpm || (() => 130);
    const master = c.createGain(), comp = c.createDynamicsCompressor(), clip = c.createWaveShaper(), output = c.createGain();
    comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.15; clip.curve = curveClip();
    master.connect(comp); comp.connect(clip); clip.connect(output);
    const analyser = c.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.6; output.connect(analyser);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
    { let s = 99991; for (let i = 0; i < nd.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; nd[i] = (s / 0x7fffffff) * 2 - 1; } }
    const NOISE = nb;
    let IR = null;
    const buffers = new Map();     // sound id -> AudioBuffer
    const chains = new Map();      // synth group id -> its effect chain

    function bufferOf(id) {
      if (!buffers.has(id) && patch.sounds[id]) { try { buffers.set(id, unpackSound(c, patch.sounds[id])); } catch (e) { buffers.set(id, null); } }
      return buffers.get(id) || null;
    }

    // One chain per blob: drive -> crush -> phaser -> chorus -> echo + reverb -> level
    function makeChain() {
      const A = {};
      A.in = c.createGain(); A.drive = c.createWaveShaper(); A.drive.oversample = '2x';
      A.crushW = c.createGain(); A.crushD = c.createGain(); A.crush = c.createWaveShaper(); A.post = c.createGain();
      A.in.connect(A.drive); A.drive.connect(A.crushD); A.drive.connect(A.crush); A.crush.connect(A.crushW); A.crushD.connect(A.post); A.crushW.connect(A.post);
      // phaser: 4 allpass filters swept by a slow wave, mixed with the dry sound
      A.phW = c.createGain(); A.phD = c.createGain(); A.ph2 = c.createGain(); A.post.connect(A.phD); A.phD.connect(A.ph2);
      A.phL = c.createOscillator(); A.phL.frequency.value = 0.35; A.phG = c.createGain(); A.phG.gain.value = 700; A.phL.connect(A.phG); A.phL.start();
      let last = A.post;
      for (let i = 0; i < 4; i++) { const f = c.createBiquadFilter(); f.type = 'allpass'; f.frequency.value = 500 + i * 350; f.Q.value = 0.7; A.phG.connect(f.frequency); last.connect(f); last = f; }
      last.connect(A.phW); A.phW.connect(A.ph2);
      // chorus: two modulated delays, one per side
      A.choW = c.createGain(); A.dry = c.createGain(); A.ph2.connect(A.dry);
      const merger = c.createChannelMerger(2); A.lfos = [A.phL];
      [0, 1].forEach((i) => { const d = c.createDelay(0.05); d.delayTime.value = 0.012 + i * 0.007; const l = c.createOscillator(); l.frequency.value = 0.5 + i * 0.37; const lg = c.createGain(); lg.gain.value = 0.0035; l.connect(lg); lg.connect(d.delayTime); l.start(); A.lfos.push(l); A.ph2.connect(d); d.connect(merger, 0, i); });
      merger.connect(A.choW); A.sum = c.createGain(); A.dry.connect(A.sum); A.choW.connect(A.sum);
      // echo: a dotted eighth at the song's tempo, with feedback
      A.dl = c.createDelay(2); A.fb = c.createGain(); A.dlW = c.createGain(); A.dlW.gain.value = 0; A.dlF = c.createBiquadFilter(); A.dlF.type = 'lowpass'; A.dlF.frequency.value = 3500;
      A.sum.connect(A.dl); A.dl.connect(A.dlF); A.dlF.connect(A.fb); A.fb.connect(A.dl); A.dlF.connect(A.dlW);
      // reverb: made the first time this blob gets some SPACE
      A.revS = c.createGain(); A.sum.connect(A.revS); A.dlW.connect(A.revS); A.revW = c.createGain(); A.revW.gain.value = 0; A.rev = null;
      A.out = c.createGain(); A.sum.connect(A.out); A.dlW.connect(A.out); A.revW.connect(A.out); A.out.connect(master);
      return A;
    }
    function chainFor(id) { if (!chains.has(id)) chains.set(id, makeChain()); return chains.get(id); }
    function dropChain(id) { const A = chains.get(id); if (!A) return; chains.delete(id); const t = c.currentTime; A.out.gain.setTargetAtTime(0, t, 0.05); setTimeout(() => { try { A.lfos.forEach((l) => l.stop()); A.out.disconnect(); } catch (e) { /* gone */ } }, 1500); }

    function applyFx() {
      const md = MODES[patch.mode], t = c.currentTime, live = synths(patch);
      for (const id of [...chains.keys()]) if (!live.some((g) => g.id === id)) dropChain(id);
      live.forEach((g) => {
        const m = measure(patch, g.id); if (!m) return; const a = m.amt, A = chainFor(g.id);
        // curves only when they change (setPatch runs on every drag frame)
        const dk = Math.round((a[I.HEAT] * 0.9 + m.lumps * 0.1) * 100) / 100, ck = Math.round(a[I.CRUSH] * 100) / 100;
        if (A.dk !== dk) { A.dk = dk; A.drive.curve = curveDrive(dk); } A.in.gain.setTargetAtTime(0.9 / (1 + a[I.HEAT] * 1.6), t, 0.05);
        if (A.ck !== ck) { A.ck = ck; A.crush.curve = curveCrush(ck); } A.crushW.gain.setTargetAtTime(a[I.CRUSH] * 0.9, t, 0.05); A.crushD.gain.setTargetAtTime(1 - a[I.CRUSH] * 0.7, t, 0.05);
        A.phW.gain.setTargetAtTime(a[I.PHASER] * 0.9, t, 0.05); A.phD.gain.setTargetAtTime(1 - a[I.PHASER] * 0.3, t, 0.05); A.phL.frequency.setTargetAtTime(0.2 + a[I.PHASER] * 0.6, t, 0.1);
        const cho = Math.min(1, a[I.SHIMMER] + md.cho + m.width * 0.15); A.choW.gain.setTargetAtTime(cho * 0.8, t, 0.05); A.dry.gain.setTargetAtTime(1 - cho * 0.25, t, 0.05);
        A.dl.delayTime.setTargetAtTime(Math.min(1.9, (60 / clamp(getBpm() || 130, 40, 300)) * 0.75), t, 0.05);
        A.dlW.gain.setTargetAtTime(a[I.ECHO] * 0.55, t, 0.05); A.fb.gain.setTargetAtTime(0.25 + a[I.ECHO] * 0.3, t, 0.05);
        const rv = clamp(a[I.SPACE] * 1.1 + md.rev + m.depth * 0.1, 0, 1.2);
        if (rv > 0.01 && !A.rev) { IR = IR || irBuf(c, 2.6); A.rev = c.createConvolver(); A.rev.buffer = IR; A.revS.connect(A.rev); A.rev.connect(A.revW); }
        A.revW.gain.setTargetAtTime(rv, t, 0.08);
        A.out.gain.setTargetAtTime(g.mute ? 0 : 1, t, 0.03);
      });
      const n = Math.max(1, live.length);   // muting a blob just takes it out, the others stay as loud
      master.gain.setTargetAtTime((0.34 / Math.sqrt(n)) * clamp(patch.level, 0, 2), t, 0.05);
    }

    // A blob's part of one note: oscillators by colour -> filter -> amp -> pan -> the blob's chain.
    function startBlob(g, m, n, vel, t) {
      const md = MODES[patch.mode], a = m.amt, nn = n + m.oct * 12 + (md.shift || 0), f = 440 * Math.pow(2, (nn - 69) / 12);
      const vg = c.createGain(), flt = c.createBiquadFilter(), pan = c.createStereoPanner ? c.createStereoPanner() : null, srcs = [];
      flt.type = 'lowpass'; flt.Q.value = 0.8 + a[I.SQUELCH] * 14;
      const base = clamp(1800 * md.cut * Math.pow(2.6, m.height) * (1 + a[I.GLOW] * 0.4) * (1 - a[I.SQUELCH] * 0.35), 140, 16000);
      const envAmt = a[I.SWEEP] * 5 + a[I.SQUELCH] * 2 + (md.env || 0) * 4;
      const att = 0.004 + m.depth * 0.3 + md.att + a[I.SWELL] * 1.4, dec = md.dec * (1 - a[I.PLUCK] * 0.78) + 0.04;
      const sus = Math.max(0, md.sus * (1 - a[I.PLUCK] * 0.95)), rel = 0.08 + Math.min(1.6, m.size * 0.35) + md.rel + a[I.SWELL] * 0.7;
      const fTop = Math.min(20000, base * (1 + envAmt));
      flt.frequency.setValueAtTime(Math.min(20000, base * (1 + envAmt * 0.1)), t); flt.frequency.linearRampToValueAtTime(fTop, t + att + 0.01);
      flt.frequency.setTargetAtTime(Math.min(20000, base * (1 + envAmt * sus * 0.3)), t + att + 0.01, dec * 0.6);
      if (a[I.WOBBLE] > 0.02) { const l = c.createOscillator(); l.frequency.value = 1.2 + m.lumps * 5; const lg = c.createGain(); lg.gain.value = base * 0.8 * a[I.WOBBLE]; l.connect(lg); lg.connect(flt.frequency); srcs.push(l); }
      const lvl = vel * 0.5 * Math.min(1.5, Math.pow(m.size, 1.3));
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(lvl, t + att); vg.gain.setTargetAtTime(lvl * sus, t + att, dec * 0.5);
      const uni = Math.max(1, Math.min(7, 1 + Math.round(m.width * 5))), spread = 6 + m.width * 28, mix = c.createGain(); mix.connect(flt);
      [['sawtooth', m.ow[0]], ['square', m.ow[1] * 0.7]].forEach(([ty, w]) => {
        if (w < 0.02) return; const g2 = c.createGain(); g2.gain.value = w / Math.sqrt(uni); g2.connect(mix);
        for (let i = 0; i < uni; i++) { const o = c.createOscillator(); o.type = ty; o.frequency.value = f; o.detune.value = uni > 1 ? (i / (uni - 1) - 0.5) * 2 * spread : 0; o.connect(g2); srcs.push(o); }
      });
      if (m.ow[2] > 0.02) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g2 = c.createGain(); g2.gain.value = m.ow[2] * 1.3; o.connect(g2); g2.connect(mix); srcs.push(o); }
      if (m.ow[3] > 0.02) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const mo = c.createOscillator(); mo.frequency.value = f * (2 + m.lumps * 1.5);
        const mg = c.createGain(); mg.gain.setValueAtTime(f * (1 + m.ow[3] * 2.5), t); mg.gain.setTargetAtTime(f * 0.25, t, 0.18); mo.connect(mg); mg.connect(o.frequency);
        const g2 = c.createGain(); g2.gain.value = m.ow[3] * 1.1; o.connect(g2); g2.connect(mix); srcs.push(o, mo);
      }
      if (a[I.AIR] > 0.02) { const s = c.createBufferSource(); s.buffer = NOISE; s.loop = true; s.loopStart = 0; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 4); bp.Q.value = 0.6; const g2 = c.createGain(); g2.gain.value = a[I.AIR] * 0.5; s.connect(bp); bp.connect(g2); g2.connect(flt); srcs.push(s); }
      const subL = Math.min(1.2, a[I.SUB] * 1.1 + m.low * 0.6 + md.sub);
      if (subL > 0.02) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f / 2; const g2 = c.createGain(); g2.gain.value = subL * 0.9; o.connect(g2); g2.connect(vg); srcs.push(o); }
      if (a[I.GLOW] > 0.02) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * 2; const g2 = c.createGain(); g2.gain.value = a[I.GLOW] * 0.25; o.connect(g2); g2.connect(flt); srcs.push(o); }
      // dropped sounds sitting on this blob play at the note's pitch (they count as C4)
      patch.groups.forEach((s) => {
        if (s.kind !== 'sound') return; const mo = mixOf(patch, s); if (mo.w < 0.03 || mo.to !== g) return;
        const buf = bufferOf(s.sound); if (!buf) return;
        const b = c.createBufferSource(); b.buffer = buf; b.playbackRate.value = Math.pow(2, (nn - 60) / 12);
        const sg = c.createGain(); sg.gain.value = mo.w * 0.9; b.connect(sg); sg.connect(flt); srcs.push(b);
      });
      // dropped sounds painted onto this blob
      for (const k in m.snd) {
        const s = patch.groups.find((x) => String(x.id) === k && x.kind === 'sound'), w = m.snd[k], buf = s && w > 0.02 && bufferOf(s.sound); if (!buf) continue;
        const b = c.createBufferSource(); b.buffer = buf; b.playbackRate.value = Math.pow(2, (nn - 60) / 12);
        const sg = c.createGain(); sg.gain.value = w * 0.9; b.connect(sg); sg.connect(flt); srcs.push(b);
      }
      flt.connect(vg);
      const A = chainFor(g.id);
      if (pan) { pan.pan.value = clamp(m.pan + (Math.random() - 0.5) * Math.min(0.6, m.width * 0.4), -1, 1); vg.connect(pan); pan.connect(A.in); } else vg.connect(A.in);
      srcs.forEach((s) => s.start(t));
      return { vg, srcs, rel, t0: t, att, dec, lvl, sus, nodes: [vg, flt, mix, pan] };
    }
    // where the amp envelope is at time t (so a release scheduled ahead starts from the right level)
    function envAt(v, t) {
      const x = t - v.t0; if (x <= 0) return 0; if (x < v.att) return (v.lvl * x) / v.att;
      return v.lvl * v.sus + (v.lvl - v.lvl * v.sus) * Math.exp(-(x - v.att) / Math.max(1e-3, v.dec * 0.5));
    }
    const live = new Set();   // every sounding or scheduled voice, for flush()
    function release(vs, t, fast) {
      vs.forEach((v) => {
        if (v.off != null && v.off <= t) return; v.off = t;
        const r = fast ? 0.02 : v.rel, at = Math.max(t, v.t0), lv = envAt(v, at), G = v.vg.gain;
        // cancel drops the whole attack ramp when the note ends inside it: ramp up to here again, then down
        G.cancelScheduledValues(at); if (at < v.t0 + v.att) G.linearRampToValueAtTime(lv, at); else G.setValueAtTime(lv, at); G.setTargetAtTime(0, at, r / 4);
        const end = at + r * 1.6 + 0.05, free = () => { live.delete(v); v.nodes.forEach((nd) => { try { nd && nd.disconnect(); } catch (e) { /* gone */ } }); };
        v.srcs.forEach((s) => { try { s.stop(end); } catch (e) { /* already stopped */ } });
        const s0 = v.srcs[v.srcs.length - 1];
        if (s0) s0.onended = free; else free();   // nothing sounding (a blob dipped in a missing sound): let it go now
      });
    }
    function start(n, vel, t) {
      const vs = [];
      synths(patch).forEach((g) => { if (g.mute) return; const m = measure(patch, g.id); if (!m) return; const v = startBlob(g, m, n, vel, t); v.n = n; vs.push(v); live.add(v); });
      return vs;
    }

    const held = new Map();   // note -> voices (live playing from keys / MIDI)
    let lastMono = null;
    const api = {
      ctx: c, output, analyser, COL, MODES,
      get patch() { return patch; },
      noteOn(n, vel = 1, when) {
        if (closed) return; const t = Math.max(when || 0, c.currentTime);
        if (MODES[patch.mode].mono) { for (const k of [...held.keys()]) api.noteOff(k, t, true); }
        if (held.has(n)) api.noteOff(n, t, true);
        held.set(n, start(n, vel, t));
      },
      noteOff(n, when, fast) { const vs = held.get(n); if (!vs) return; held.delete(n); release(vs, Math.max(when || 0, c.currentTime), fast); },
      // notes: [{ pitch, velocity (0..127), on, off }] in ctx time
      schedule(notes) {
        if (closed) return;
        const mono = MODES[patch.mode].mono, list = [...notes].sort((a, b) => a.on - b.on);
        list.forEach((nt) => {
          const on = Math.max(nt.on, c.currentTime);
          if (nt.off <= on) return;
          if (mono && lastMono && (lastMono.off == null || lastMono.off > on)) release(lastMono.vs, on, true);
          const vs = start(nt.pitch, (nt.velocity == null ? 100 : nt.velocity) / 127, on);
          release(vs, nt.off);
          if (mono) lastMono = { vs, off: nt.off };
        });
      },
      flush(hard) { const t = c.currentTime; held.clear(); lastMono = null; release([...live], t, !!hard); },
      // trusted = the caller's own live patch object (the BLOB window while dragging): no copy
      setPatch(p, trusted) {
        if (closed) return;   // a closed engine never grows new chains
        const old = patch; patch = trusted ? p : tidy(p);
        for (const id of [...buffers.keys()]) if (!patch.sounds[id]) buffers.delete(id);
        if (old.mode !== patch.mode) api.flush();
        applyFx();
      },
      getPatch() { return clone(patch); },
      refresh() { if (!closed) applyFx(); },
      get closed() { return closed; },
      close() { if (closed) return; api.flush(true); closed = true; for (const id of [...chains.keys()]) dropChain(id); setTimeout(() => { try { output.disconnect(); } catch (e) { /* gone */ } }, 1600); },
      get voices() { return live.size; }
    };
    applyFx();
    return api;
  }

  window.BlobEngine = { create, COL, I, ci, isSnd, OSC, SCOL, MODES, MAXB, PRESETS, fromPreset, INIT, tidy, measure, mixOf, centre, synths, packSound, clone };
})();
