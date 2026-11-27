// TOY KEYS: KILLTOY's simple keys instrument (Eman, 7 Nov 2026): grand piano, electric piano,
// Wurli, organ, clav, bells. Clean presets plus a few dirty ones. It's the instrument you own from
// the start (quest 1); TOY MACHINE is the card you win after it.
//
// It plugs into the playground exactly where TOY MACHINE does: a TOY KEYS lane is a TOY MACHINE
// lane whose preset says engine "toykeys", and create() below hands back an object with the same
// calls as ToyMachine's create() (schedule, noteOn/Off, requeue, flush, setPreset, setMacro, meter,
// close...). So the song, the piano-roll previews, the computer keyboard, mute/solo and the meters
// all work the same. The sound is plain Web Audio nodes (works in any AudioContext):
//   grand  = Salamander Grand Piano V3 samples (Alexander Holm, CC-BY 3.0), every minor third,
//            two velocity layers blended (toy-keys/grand.tkp)
//   tine   = jRhodes3d samples, a 1977 Rhodes Mark I (Jeff Learman, CC-BY-SA), two layers (toy-keys/tine.tkp)
//   reed (Wurli), organ (drawbars), clav, bells = synthesized here
// then one chain per engine: DIRT (drive, then bit crush at the top) -> TONE (low-pass) -> tape
// WOBBLE (wow + tremolo) -> SPACE (reverb).
//
//   const TK = ToyKeys.load(ctx);
//   const s = TK.create({ preset });  s.output.connect(dest);  s.noteOn(60, 100, ctx.currentTime);
//   ToyKeys.PRESETS (the list), ToyKeys.preset("Classic EP") (a fresh copy), ToyKeys.DEFAULT
//
// Packs: "TKP1" + uint32 LE json length + json { zones: [{ root, layer, off, len }] } + mp3 bytes.
// window.TOY_KEYS_PACKS = { grand: url, tine: url } moves them (e.g. to the asset store).
(function () {
  "use strict";
  const PACK_URL = { grand: "toy-keys/grand.tkp", tine: "toy-keys/tine.tkp" };
  const packUrl = (n) => (window.TOY_KEYS_PACKS && window.TOY_KEYS_PACKS[n]) || PACK_URL[n];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------------------------------------------------------------- presets
  // macros: 0 TONE, 1 DIRT, 2 SPACE, 3 WOBBLE (0..1). Everything else is the preset's own recipe.
  const M = (tone, dirt, space, wobble) => [{ name: "TONE", value: tone }, { name: "DIRT", value: dirt }, { name: "SPACE", value: space }, { name: "WOBBLE", value: wobble }];
  const P = (name, group, model, macros, extra = {}) => ({ engine: "toykeys", name, category: "Keys", group, model, macros, ...extra });
  const PRESETS = [
    // CLEAN
    P("Studio Grand", "CLEAN", "grand", M(0.88, 0, 0.16, 0), { hue: 270, g0: 1, gain: 0.593 }),
    P("Soft Felt", "CLEAN", "grand", M(0.34, 0, 0.3, 0), { hue: 255, attack: 0.012, layerBias: -0.45, g0: 1.25, gain: 0.818 }),
    P("Classic EP", "CLEAN", "tine", M(0.78, 0.04, 0.14, 0.12), { hue: 285, trem: 4.2, g0: 1, gain: 0.742 }),
    P("Silk EP", "CLEAN", "tine", M(0.5, 0, 0.34, 0.22), { hue: 300, layerBias: -0.5, trem: 3.1, pan: 0.6, g0: 1.15, gain: 0.959 }),
    P("Wurli", "CLEAN", "reed", M(0.72, 0.08, 0.14, 0.25), { hue: 320, trem: 5.4, g0: 1, gain: 0.622 }),
    P("Drawbar Organ", "CLEAN", "organ", M(0.7, 0.06, 0.18, 0.35), { hue: 240, drawbars: [8, 8, 8, 0, 0, 0, 0, 0, 0], perc: 0.5, click: 0.4, leslie: 5.8, g0: 1, gain: 0.678 }),
    P("Clav", "CLEAN", "clav", M(0.82, 0.05, 0.08, 0), { hue: 230, g0: 1, gain: 0.638 }),
    P("Glass Bells", "CLEAN", "bells", M(0.85, 0, 0.42, 0.05), { hue: 200, role: "melody", ratio: 3.5, index: 2.2, decay: 2.6, g0: 1, gain: 0.922 }),
    P("Music Box", "CLEAN", "bells", M(0.9, 0, 0.36, 0), { hue: 190, role: "melody", ratio: 5.0, index: 1.2, decay: 1.4, oct: 1, g0: 0.8, gain: 1.045 }),
    P("Night Keys", "CLEAN", "tine", M(0.36, 0, 0.62, 0.3), { hue: 265, layerBias: -0.3, trem: 2.2, pan: 0.8, attack: 0.02, g0: 1, gain: 0.989 }),
    // MELODY (Eman, 7 Nov): the same instruments voiced for a top line (brighter, drier), levelled as a melody
    P("Piano Lead", "CLEAN", "grand", M(0.95, 0, 0.12, 0), { hue: 275, role: "melody", g0: 1, gain: 0.836 }),
    P("EP Lead", "CLEAN", "tine", M(0.86, 0.05, 0.12, 0.1), { hue: 290, trem: 4.2, role: "melody", g0: 1, gain: 1.333 }),
    P("Wurli Lead", "CLEAN", "reed", M(0.82, 0.1, 0.1, 0.2), { hue: 325, trem: 5.4, role: "melody", g0: 1, gain: 0.98 }),
    // DIRTY
    P("Dusty EP", "DIRTY", "tine", M(0.42, 0.55, 0.22, 0.5), { hue: 0, hiss: 0.6, trem: 3.8, lowcut: 140, g0: 1, gain: 0.56 }),
    P("Tape Piano", "DIRTY", "grand", M(0.48, 0.42, 0.24, 0.62), { hue: 350, hiss: 0.5, lowcut: 110, g0: 1, gain: 0.565 }),
    P("Broken Upright", "DIRTY", "grand", M(0.4, 0.5, 0.12, 0.3), { hue: 340, honky: 14, hiss: 0.3, lowcut: 180, g0: 0.95, gain: 0.456 }),
    P("Lo-Fi Wurli", "DIRTY", "reed", M(0.38, 0.62, 0.2, 0.55), { hue: 10, hiss: 0.7, trem: 5.0, lowcut: 160, g0: 1.5, gain: 0.808 }),
    P("Crushed Organ", "DIRTY", "organ", M(0.52, 0.88, 0.16, 0.4), { hue: 355, drawbars: [6, 8, 4, 6, 0, 3, 0, 0, 2], perc: 0.3, click: 0.6, leslie: 6.6, lowcut: 120, g0: 1, gain: 0.515 }),
  ];
  const DEFAULT = "Studio Grand";
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const presetByName = (n) => { const p = PRESETS.find((x) => x.name.toLowerCase() === String(n || "").toLowerCase()); return p ? copy(p) : null; };
  const isKeys = (p) => !!p && p.engine === "toykeys";

  // ---------------------------------------------------------------- shared per-context things
  const perCtx = new WeakMap();
  const shared = (ctx) => { let s = perCtx.get(ctx); if (!s) perCtx.set(ctx, (s = { packs: new Map(), ready: new Map(), waves: new Map() })); return s; };

  // sample packs: fetched once per page, decoded once per context
  const rawPacks = new Map();
  function fetchPack(name) {
    if (!rawPacks.has(name)) rawPacks.set(name, fetch(packUrl(name)).then((r) => { if (!r.ok) throw new Error("TOY KEYS: no " + name + " pack (" + r.status + ")"); // a pack in the asset store comes as JSON { b: base64 } (the store takes no .tkp files)
      return r.arrayBuffer().then((ab) => (new Uint8Array(ab, 0, 1)[0] === 0x7b ? (function (s) { if (window.KT2_B64_OLD) return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); var b = atob(s), n = b.length, u = new Uint8Array(n), i; for (i = 0; i < n; i++) u[i] = b.charCodeAt(i); return u; })(JSON.parse(new TextDecoder().decode(ab)).b).buffer : ab)); })
      .catch((e) => { rawPacks.delete(name); throw e; }));
    return rawPacks.get(name);
  }
  function loadPack(ctx, name) {
    const S = shared(ctx);
    if (!S.packs.has(name)) {
      S.packs.set(name, fetchPack(name).then(async (buf) => {
        const dv = new DataView(buf), n = dv.getUint32(4, true);
        const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n))), base = 8 + n;
        const zones = await Promise.all(head.zones.map(async (z) => {
          const ab = await ctx.decodeAudioData(buf.slice(base + z.off, base + z.off + z.len));
          return { root: z.root, layer: z.layer, tune: z.tune || 0, buf: trimFront(ctx, ab) };
        }));
        const pack = { zones, layers: [0, 1].map((l) => zones.filter((z) => z.layer === l).sort((a, b) => a.root - b.root)) };
        S.ready.set(name, pack); if (S.failed) S.failed.delete(name);
        return pack;
      }).catch((e) => {
        S.packs.delete(name); console.warn(e.message || e);
        if (!window.TK_PACK_FALLBACK_OLD) {   // remember the failure: next try waits twice as long (2 s .. 30 s)
          S.failed = S.failed || new Map();
          const f = S.failed.get(name) || { wait: 1000, busy: false };
          f.wait = Math.min(30000, f.wait * 2); f.next = ctx.currentTime * 1000 + f.wait; f.busy = false;
          S.failed.set(name, f);
        }
        return null;
      }));
    }
    return S.packs.get(name);
  }
  // mp3 adds a little silence in front: start each sample right at its attack
  function trimFront(ctx, ab) {
    const d0 = ab.getChannelData(0), d1 = ab.numberOfChannels > 1 ? ab.getChannelData(1) : d0;
    let pk = 0; for (let i = 0; i < Math.min(d0.length, ab.sampleRate * 0.3); i++) pk = Math.max(pk, Math.abs(d0[i]), Math.abs(d1[i]));
    let i0 = 0; const th = pk * 0.02;
    while (i0 < d0.length && Math.abs(d0[i0]) < th && Math.abs(d1[i0]) < th) i0++;
    i0 = Math.max(0, i0 - 24);
    if (i0 < 8) return ab;
    const out = ctx.createBuffer(ab.numberOfChannels, ab.length - i0, ab.sampleRate);
    for (let c = 0; c < ab.numberOfChannels; c++) out.getChannelData(c).set(ab.getChannelData(c).subarray(i0));
    return out;
  }
  // KILLTOY loudness standard (scripts/loudness_standard.py, Eman 7 Nov): at fader 100% a preset's chords land on
  // -23 LUFS, and a melody preset (role "melody") playing a top line on -21 LUFS. Each preset's gain was measured
  // to -20 / -18 into the limiter, then STANDARD_DB takes the whole instrument down after it (window.TK_LEVEL_OLD = the old levels).
  const STANDARD_DB = window.TK_LEVEL_OLD ? 0 : -3;
  // each family's level, so every preset sits about as loud as the next (measured on a 4-note chord)
  const TRIM = { grand: 0, tine: -4.5, reed: -10.5, organ: -8, clav: -0.7, bells: -7 };
  const modelPack = (m) => (m === "grand" ? "grand" : m === "tine" ? "tine" : null);

  function wave(ctx, key, make) {
    const S = shared(ctx);
    if (!S.waves.has(key)) { const [re, im] = make(); S.waves.set(key, ctx.createPeriodicWave(re, im, { disableNormalization: false })); }
    return S.waves.get(key);
  }
  function noiseBuf(ctx) {
    const S = shared(ctx);
    if (!S.noise) {
      const n = ctx.sampleRate * 2, b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let y = 0; for (let i = 0; i < n; i++) { y = 0.97 * y + 0.03 * (Math.random() * 2 - 1); d[i] = (Math.random() * 2 - 1) * 0.6 + y * 3; } }
      S.noise = b;
    }
    return S.noise;
  }
  function reverbIR(ctx) {
    const S = shared(ctx);
    if (!S.ir) {
      const sr = ctx.sampleRate, n = Math.round(sr * 2.6), b = ctx.createBuffer(2, n, sr), pre = Math.round(sr * 0.012);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c); let lp = 0;
        for (let i = pre; i < n; i++) {
          const t = (i - pre) / sr, k = 0.35 + 0.6 * Math.exp(-t * 1.4);   // it darkens as it fades
          lp += k * ((Math.random() * 2 - 1) - lp);
          d[i] = lp * Math.exp(-t * 2.6) * (1 - Math.exp(-t * 90));
        }
      }
      S.ir = b;
    }
    return S.ir;
  }
  function driveCurve(dirt) {
    const n = 2048, c = new Float32Array(n), k = 1 + 14 * dirt * dirt, norm = Math.tanh(k);
    const bits = dirt > 0.6 ? 16 - (dirt - 0.6) / 0.4 * 11 : 0, steps = bits ? Math.pow(2, bits - 1) : 0;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      let y = dirt < 0.02 ? x : Math.tanh(k * (x + 0.06 * dirt)) / norm - Math.tanh(k * 0.06 * dirt) / norm;   // a touch of even warmth
      if (steps) y = Math.round(y * steps) / steps;
      c[i] = y;
    }
    return c;
  }

  // ---------------------------------------------------------------- one engine
  function create(ctx, opts = {}) {
    let preset = isKeys(opts.preset) ? copy(opts.preset) : presetByName(DEFAULT);
    const now = () => ctx.currentTime;
    // chain
    const input = ctx.createGain(), pre = ctx.createGain(), shaper = ctx.createWaveShaper(), post = ctx.createGain();
    const lowcut = ctx.createBiquadFilter(), tone = ctx.createBiquadFilter(), shelf = ctx.createBiquadFilter();
    const wowD = ctx.createDelay(0.05), wowLfo = ctx.createOscillator(), wowAmt = ctx.createGain(), flut = ctx.createOscillator(), flutAmt = ctx.createGain();
    const trem = ctx.createGain(), tremLfo = ctx.createOscillator(), tremAmt = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null, panLfo = ctx.createOscillator(), panAmt = ctx.createGain();
    const dry = ctx.createGain(), verb = ctx.createConvolver(), wet = ctx.createGain(), lim = ctx.createDynamicsCompressor(), out = ctx.createGain(), meterA = ctx.createAnalyser();
    // a safety on the way out: piano attacks peak far above their body
    lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 10; lim.attack.value = 0.002; lim.release.value = 0.12;
    const hiss = ctx.createBufferSource(), hissF = ctx.createBiquadFilter(), hissG = ctx.createGain();
    shaper.oversample = "2x";
    lowcut.type = "highpass"; lowcut.Q.value = 0.6;
    tone.type = "lowpass"; tone.Q.value = 0.5;
    shelf.type = "highshelf"; shelf.frequency.value = 6000;
    wowD.delayTime.value = 0.012;
    wowLfo.frequency.value = 0.55; flut.frequency.value = 6.3;
    wowLfo.connect(wowAmt); wowAmt.connect(wowD.delayTime); flut.connect(flutAmt); flutAmt.connect(wowD.delayTime);
    tremLfo.type = "sine"; tremLfo.connect(tremAmt); tremAmt.connect(trem.gain);
    panLfo.connect(panAmt); if (panner) panAmt.connect(panner.pan);
    verb.buffer = reverbIR(ctx);
    hiss.buffer = noiseBuf(ctx); hiss.loop = true; hissF.type = "bandpass"; hissF.frequency.value = 5200; hissF.Q.value = 0.4; hissG.gain.value = 0;
    hiss.connect(hissF); hissF.connect(hissG); hissG.connect(tone);
    input.connect(pre); pre.connect(shaper); shaper.connect(post); post.connect(lowcut); lowcut.connect(tone); tone.connect(shelf); shelf.connect(wowD);
    wowD.connect(trem);
    let tail = trem;
    if (panner) { trem.connect(panner); tail = panner; }
    tail.connect(dry); tail.connect(verb); verb.connect(wet); dry.connect(lim); wet.connect(lim); lim.connect(meterA); meterA.connect(out); out.gain.value = 1.1 * Math.pow(10, STANDARD_DB / 20);   // the meter sits in line, so it is always pulled
    meterA.fftSize = 1024;
    const t0 = now();
    for (const o of [wowLfo, flut, tremLfo, panLfo, hiss]) o.start(t0);
    let mac = [0.8, 0, 0.2, 0];

    function applyFx(at = now(), fast = false) {
      const tau = fast ? 0.005 : 0.03, set = (prm, v) => prm.setTargetAtTime(v, at, tau);
      const [tn, dt, sp, wb] = mac, pr = preset;
      shaper.curve = driveCurve(dt);
      // DIRT adds grit, not loudness: the drive's small-signal gain is taken back off after it
      const pg = 1 + dt * 1.6, k = 1 + 14 * dt * dt, small = dt < 0.02 ? 1 : pg * k / Math.tanh(k);
      set(pre.gain, pg);
      set(post.gain, ((window.TK_LEVEL_OLD ? pr.g0 : pr.gain) || 1) * Math.pow(10, (TRIM[pr.model] || 0) / 20) * Math.pow(10, -Math.min(12, 17 * Math.log10(small)) / 20));
      set(tone.frequency, 500 * Math.pow(36, clamp(tn)));
      set(shelf.gain, (tn - 0.6) * 8);
      set(lowcut.frequency, pr.lowcut || 30);
      set(hissG.gain, (pr.hiss || 0) * (0.004 + 0.02 * dt));
      // WOBBLE: tape wow and flutter, plus the preset's tremolo (EP / Wurli) or leslie (organ)
      set(wowAmt.gain, 0.0032 * wb * wb); set(flutAmt.gain, 0.00035 * wb);
      const tr = pr.leslie || pr.trem || 0, tdepth = tr ? clamp(0.06 + wb * (pr.leslie ? 0.35 : 0.5)) : 0;
      if (tr) set(tremLfo.frequency, tr);
      set(tremAmt.gain, tdepth * 0.5); set(trem.gain, 1 - tdepth * 0.5);
      set(panLfo.frequency, tr ? tr * 0.5 : 0.3);
      set(panAmt.gain, (pr.pan || (pr.leslie ? 0.5 : 0)) * (0.2 + 0.8 * wb) * 0.8);
      set(wet.gain, sp * sp * 1.3);
      set(dry.gain, 1 - sp * 0.35);
    }
    function takePreset(p) {
      preset = isKeys(p) ? copy(p) : preset;
      mac = [0, 1, 2, 3].map((i) => { const m = preset.macros && preset.macros[i]; return clamp(m && m.value != null ? +m.value : [0.8, 0, 0.2, 0][i]); });
      applyFx();
      const pk = modelPack(preset.model);
      if (pk) loadPack(ctx, pk).then(() => { if (pending.length) flushPending(); });
    }

    // ---------------------------------------------------------------- voices
    const voices = [];      // { pitch, on, off, released, nodes:[], detunes:[], rel: GainNode, stop(at) }
    const pending = [];     // notes waiting for a sample pack: { pitch, velocity, on, off }
    let bendCents = 0, wheel = 0;
    const MAXV = 64;
    const velAmp = (v) => Math.pow(clamp(v / 127, 0.05, 1), 1.4);

    function sampleVoice(v, pack, pitch, vel, at) {
      const p = preset, hard = clamp((vel - 52) / 60 + (p.layerBias || 0)), lay = [[0, 1 - hard], [1, hard]];
      const honky = p.honky || 0;
      for (const [li, w] of lay) {
        if (w < 0.03) continue;
        const zs = pack.layers[li]; if (!zs.length) continue;
        let z = zs[0]; for (const q of zs) if (Math.abs(q.root - pitch) < Math.abs(z.root - pitch)) z = q;
        for (const det of honky ? [-honky, honky * 0.7] : [0]) {
          const src = ctx.createBufferSource(), g = ctx.createGain();
          src.buffer = z.buf;
          src.playbackRate.value = Math.pow(2, (pitch - z.root) / 12);
          src.detune.value = det + z.tune + bendCents;
          g.gain.value = w * (honky ? 0.62 : 1);
          src.connect(g); g.connect(v.body);
          src.start(at);
          v.srcs.push(src); v.detunes.push([src.detune, det + z.tune]);
          v.end = Math.max(v.end, at + z.buf.duration / src.playbackRate.value);
        }
      }
    }
    function oscVoice(v, type, pitch, vel, at) {
      const p = preset, f = mtof(pitch), vv = clamp(vel / 127);
      const osc = (w, freq, det = 0) => { const o = ctx.createOscillator(); if (typeof w === "string") o.type = w; else o.setPeriodicWave(w); o.frequency.value = freq; o.detune.value = det + bendCents; o.start(at); v.srcs.push(o); v.detunes.push([o.detune, det]); return o; };
      const env = (g, peak, attack, tau, floor = 0) => { g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack); g.gain.setTargetAtTime(floor * peak, at + attack, tau); };
      const lowness = clamp((84 - pitch) / 48);
      if (type === "reed") {   // Wurli: a reedy wave, it barks when hit hard (the filter opens with velocity)
        const w = wave(ctx, "reed", () => { const N = 24, re = new Float32Array(N), im = new Float32Array(N); for (let h = 1; h < N; h++) im[h] = (h % 2 ? 1 : 0.55) / Math.pow(h, 1.25) * (h === 2 ? 1.3 : 1); return [re, im]; });
        const o = osc(w, f), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        lp.type = "lowpass"; lp.Q.value = 1.2;
        const top = Math.min(16000, f * (3 + 14 * vv * vv)), base = Math.min(12000, f * 2.2);
        lp.frequency.setValueAtTime(top, at); lp.frequency.setTargetAtTime(base, at + 0.005, 0.18);
        env(g, 0.55, 0.004, 0.9 + 2.2 * lowness);
        o.connect(lp); lp.connect(g); g.connect(v.body);
        const s = osc("sine", f * 2); const sg = ctx.createGain(); env(sg, 0.06 * vv, 0.002, 0.08); s.connect(sg); sg.connect(v.body);   // the little tine "tok"
        v.end = at + 12;
      } else if (type === "organ") {   // drawbars: 16' 5 1/3' 8' 4' 2 2/3' 2' 1 3/5' 1 1/3' 1' as harmonics of the 16'
        const db = p.drawbars || [8, 8, 8, 0, 0, 0, 0, 0, 0], H = [1, 3, 2, 4, 6, 8, 10, 12, 16];
        const w = wave(ctx, "org" + db.join(","), () => { const re = new Float32Array(17), im = new Float32Array(17); db.forEach((l, i) => { im[H[i]] += l / 8 * Math.pow(10, -(8 - l) * 3 / 20) * (l ? 1 : 0); }); return [re, im]; });
        const o = osc(w, f / 2), g = ctx.createGain();
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.36, at + 0.006);
        o.connect(g); g.connect(v.body);
        if (p.perc) { const q = osc("sine", f * 2), qg = ctx.createGain(); env(qg, 0.22 * p.perc, 0.001, 0.16); q.connect(qg); qg.connect(v.body); }
        if (p.click) { const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noiseBuf(ctx); hp.type = "highpass"; hp.frequency.value = 2500;
          ng.gain.setValueAtTime(0.12 * p.click, at); ng.gain.setTargetAtTime(0, at + 0.002, 0.004); n.connect(hp); hp.connect(ng); ng.connect(v.body); n.start(at, Math.random()); n.stop(at + 0.05); v.srcs.push(n); }
        v.end = Infinity; v.relTau = 0.012;
      } else if (type === "clav") {   // a plucked string seen from a pickup near the bridge, with a snappy filter
        const w = wave(ctx, "clav", () => { const N = 40, re = new Float32Array(N), im = new Float32Array(N); for (let h = 1; h < N; h++) im[h] = Math.sin(Math.PI * h * 0.13) / h; return [re, im]; });
        const o = osc(w, f), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = "lowpass"; bp.Q.value = 4;
        bp.frequency.setValueAtTime(Math.min(16000, f * (6 + 10 * vv)), at); bp.frequency.setTargetAtTime(Math.min(12000, f * 2.5), at + 0.004, 0.12);
        env(g, 0.5, 0.002, 0.35 + 0.6 * lowness, 0.0);
        o.connect(bp); bp.connect(g); g.connect(v.body);
        v.end = at + 6; v.relTau = 0.01;
      } else {   // bells: two-operator FM, a little inharmonic so it shimmers
        const ratio = p.ratio || 3.5, idx = (p.index || 2) * (0.5 + vv), dec = (p.decay || 2) * (0.5 + lowness);
        const car = osc("sine", f), mod = osc("sine", f * ratio), mg = ctx.createGain(), g = ctx.createGain();
        mg.gain.setValueAtTime(idx * f, at); mg.gain.setTargetAtTime(idx * f * 0.08, at, dec * 0.25);
        mod.connect(mg); mg.connect(car.frequency);
        env(g, 0.42, 0.0015, dec);
        car.connect(g); g.connect(v.body);
        const hi = osc("sine", f * 4.02), hg = ctx.createGain(); env(hg, 0.06 * vv, 0.001, dec * 0.15); hi.connect(hg); hg.connect(v.body);
        v.end = at + dec * 6;
      }
    }
    function startVoiceAs(n, type) {
      const pitch = n.pitch + 12 * (preset.oct || 0), vel = n.velocity || 100, at = Math.max(n.on, now());
      while (voices.length >= MAXV) killVoice(voices[0], at, 0.01);
      const v = { pitch: n.pitch, on: at, off: Infinity, released: false, srcs: [], detunes: [], end: 0, relTau: null };
      v.body = ctx.createGain(); v.rel = ctx.createGain();
      v.body.gain.value = velAmp(vel) * 0.55;   // the stand-in sits about as loud as the piano samples
      v.body.connect(v.rel); v.rel.connect(input);
      oscVoice(v, type, pitch, vel, at);
      voices.push(v);
      if (n.off != null && isFinite(n.off)) release(v, Math.max(n.off, at + 0.005));
      return v;
    }
    function startVoice(n) {
      const pitch = n.pitch + 12 * (preset.oct || 0), vel = n.velocity || 100, at = Math.max(n.on, now());
      const model = preset.model, pk = modelPack(model);
      let pack = null;
      if (pk) { pack = shared(ctx).ready.get(pk); if (!pack) {
        // (bug clip 7, 23 Nov: "after a few dice the sound stopped working") a piano pack that fails to load used to be
        // fetched again for every note, forever, and nothing sounded. Now it waits longer between tries (2 s .. 30 s)
        // and a synth stand-in plays meanwhile. window.TK_PACK_FALLBACK_OLD = the old way.
        const S = shared(ctx), fl = S.failed && S.failed.get(pk);
        if (window.TK_PACK_FALLBACK_OLD || !fl) { pending.push(n); loadPack(ctx, pk).then(() => flushPending()); return null; }
        if (now() * 1000 >= fl.next && !fl.busy) { fl.busy = true; loadPack(ctx, pk).then(() => { fl.busy = false; }); }
        return startVoiceAs(n, "reed");   // an electric-piano-like synth until the samples arrive
      } }
      while (voices.length >= MAXV) killVoice(voices[0], at, 0.01);
      const v = { pitch: n.pitch, on: at, off: Infinity, released: false, srcs: [], detunes: [], end: 0, relTau: null };
      v.body = ctx.createGain(); v.rel = ctx.createGain();
      v.body.gain.value = velAmp(vel) * (pk ? 1.0 : 0.9);
      const atk = preset.attack || 0;
      if (atk) { v.rel.gain.setValueAtTime(0, at); v.rel.gain.linearRampToValueAtTime(1, at + atk); }
      v.body.connect(v.rel); v.rel.connect(input);
      if (pk) sampleVoice(v, pack, pitch, vel, at); else oscVoice(v, model, pitch, vel, at);
      voices.push(v);
      if (n.off != null && isFinite(n.off)) release(v, Math.max(n.off, at + 0.005));
      return v;
    }
    function relTauOf(v) { if (v.relTau) return v.relTau; return preset.model === "grand" ? 0.09 + 0.12 * clamp((72 - v.pitch) / 40) : preset.model === "tine" ? 0.07 : 0.05; }
    function release(v, at) {
      v.off = at; v.released = true;
      const tau = relTauOf(v), g = v.rel.gain;
      g.cancelScheduledValues(at); g.setTargetAtTime(0, at, tau);
      const stopAt = at + tau * 8;
      for (const s of v.srcs) { try { s.stop(Math.min(stopAt, v.end === Infinity ? stopAt : Math.max(stopAt, at))); } catch (e) { /* already */ } }
      v.gone = stopAt;
    }
    function killVoice(v, at = now(), tau = 0.008) {
      const g = v.rel.gain; g.cancelScheduledValues(at); g.setTargetAtTime(0, at, tau);
      for (const s of v.srcs) { try { s.stop(at + tau * 8); } catch (e) { /* already */ } }
      const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1);
      setTimeout(() => { try { v.rel.disconnect(); } catch (e) { /* gone */ } }, Math.max(0, (at - now() + tau * 8) * 1000 + 50));
    }
    function flushPending() {
      const list = pending.splice(0), t = now();
      for (const n of list) if (!(n.off <= t)) startVoice({ ...n, on: Math.max(n.on, t + 0.005) });
    }
    // tidy finished voices now and then
    const sweep = setInterval(() => { const t = now(); for (const v of [...voices]) if ((v.gone && v.gone < t - 0.1) || v.end < t - 0.1) { const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); try { v.rel.disconnect(); } catch (e) { /* gone */ } } }, 1000);

    takePreset(preset);
    applyFx(now(), true);
    if (opts.notes) opts.notes.forEach((n) => startVoice(n));

    const api = {
      output: out,
      isToyKeys: true,
      setPreset(p) { takePreset(typeof p === "string" ? JSON.parse(p) : p); },
      setMacro(i, v) { if (i >= 0 && i < 4) { mac[i] = clamp(+v); applyFx(); } },
      setPad() {}, setPadStar() {}, setSample() {}, setDropSample() {},
      noteOn(pitch, velocity = 100, when) { startVoice({ pitch, velocity, on: when == null ? now() : when, off: Infinity }); },
      noteOff(pitch, when) {
        const at = Math.max(now(), when == null ? now() : when);
        // the voice of this pitch that is (or will be) sounding then and has no end yet
        const v = voices.filter((x) => x.pitch === pitch && !x.released && x.on <= at + 1e-4).pop();
        if (v) release(v, at);
        else { const p = pending.filter((x) => x.pitch === pitch && !(x.off < Infinity)).pop(); if (p) p.off = at; }
      },
      bend(v, when) { bendCents = clamp(+v, -1, 1) * 200; const at = when == null ? now() : when; for (const x of voices) for (const [d, base] of x.detunes) d.setTargetAtTime(base + bendCents, at, 0.01); },
      wheel(v) { wheel = clamp(+v); tremAmt.gain.setTargetAtTime(Math.max(tremAmt.gain.value, wheel * 0.25), now(), 0.05); },
      schedule(notes) { for (const n of notes || []) startVoice({ pitch: n.pitch, velocity: n.velocity || 100, on: n.on, off: n.off }); },
      // drop what hasn't started; what sounds rings on until a note-off comes again
      requeue() {
        const t = now();
        pending.length = 0;
        for (const v of [...voices]) {
          if (v.on > t + 0.002) { killVoice(v, t, 0.003); continue; }
          if (v.released && v.off > t) { v.released = false; v.off = Infinity; const g = v.rel.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value || 1, t); g.setTargetAtTime(1, t, 0.01); v.gone = null; }
        }
      },
      flush(mode = "soft") {
        const t = now();
        pending.length = 0;
        for (const v of [...voices]) killVoice(v, t, mode === "hard" ? 0.005 : 0.03);
        if (mode === "hard") { wet.gain.cancelScheduledValues(t); wet.gain.setValueAtTime(0, t); applyFx(t + 0.25); }
      },
      sendTransport() {},
      meter() {
        const d = new Float32Array(meterA.fftSize); meterA.getFloatTimeDomainData(d);
        let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); pk *= out.gain.value;
        const t = now();
        return { peak: pk, voices: voices.filter((v) => v.on <= t && !(v.gone && v.gone < t)).length, dice: null, arp: -1 };
      },
      close() {
        clearInterval(sweep);
        for (const v of [...voices]) killVoice(v, now(), 0.005);
        for (const o of [wowLfo, flut, tremLfo, panLfo, hiss]) { try { o.stop(); } catch (e) { /* gone */ } }
        setTimeout(() => { try { out.disconnect(); input.disconnect(); } catch (e) { /* gone */ } }, 120);
      },
      preset: () => copy(preset),
    };
    return api;
  }

  const apis = new WeakMap();
  function load(ctx) {
    if (!apis.has(ctx)) apis.set(ctx, { create: (opts) => create(ctx, opts), preload: (name) => { const p = presetByName(name) || (isKeys(name) ? name : null); const pk = p && modelPack(p.model); return pk ? loadPack(ctx, pk) : Promise.resolve(null); } });
    return apis.get(ctx);
  }
  // Start fetching a pack before anyone plays (the window does this when it opens).
  const prefetch = (name) => { const p = presetByName(name); const pk = p && modelPack(p.model); if (pk) fetchPack(pk).catch(() => {}); };

  window.ToyKeys = { load, PRESETS, DEFAULT, preset: presetByName, isKeys, prefetch, version: 1 };
})();
