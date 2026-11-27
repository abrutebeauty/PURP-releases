// TOY GTR: KILLTOY's guitar (Eman, 13 Nov 2026: "very realistic, real guitar samples, riffs as well as
// single notes, acoustic and electric"). Real recorded guitars, every note with several velocity layers
// and round-robins, played through a small amp / cab / pedal chain made of plain Web Audio nodes.
//
// It plugs in exactly like TOY KEYS (playground/toy-keys.js): a TOY GTR lane is a TOY MACHINE lane whose
// preset has engine "toygtr", and create() hands back the same calls as ToyMachine's create() (schedule,
// noteOn/Off, requeue, flush, setPreset, setMacro, meter, close...).
//
// Samples (all CC0, Karoryfer Lecolds, github.com/sfzinstruments; built by scripts/toygtr_packs.py):
//   acoustic = Shinyguitar archtop, microphone      4 layers x 2 round-robins, every minor third, release + mute noises
//   electric = Shinyguitar archtop, magnetic pickup  same layout
//   solid    = Emilyguitar, Epiphone solid body DI   4 layers x 2 round-robins, release + mute noises (the one for drive)
//   gretsch  = Black And Green, green Gretsch        chromatic: twang (2 layers), staccato x2, hammer-on
//
// Playing (what the MIDI does):
//   velocity      -> which recorded layer (soft picking to hard)
//   slide notes   -> a slide note that starts while another note rings glides that string to its pitch
//                    (overlap = slide time, clamped to a real finger slide), like TOY MACHINE's slides
//   Advanced MIDI -> a note's bend line (semitones) and wobble (vibrato) bend the string
//   RIFF (mono)   -> one string at a time; a note that overlaps the last one is a hammer-on / pull-off
//                    (gretsch has real hammer-on samples; the others play the note without a new pick)
//   PALM          -> "auto": short low notes (under 0.24 s, below A3) are palm-muted (staccato samples + a closing filter);
//                    "on": every note; "off": none
//   STRUM         -> notes of a chord start a few ms apart, low to high (down) or high to low (up)
//   DOUBLE        -> a second take (the other round-robin) hard left/right, like a double-tracked guitar
//
// Chain: input -> low cut -> AMP (drive, 4x oversampled) -> CAB (filters, no impulse files) -> CHORUS ->
//        TREMOLO -> lo-fi (wow + crush + hiss) -> TONE (low-pass) -> SPACE (reverb + slapback) -> limiter.
// Macros (faders): 0 TONE, 1 DRIVE, 2 SPACE, 3 MOTION (chorus / tremolo / vibrato, whichever the preset uses).
//
//   const G = ToyGtr.load(ctx); const s = G.create({ preset }); s.output.connect(dest); s.noteOn(52, 100);
//   ToyGtr.PRESETS, ToyGtr.preset("Chorus Clean"), ToyGtr.DEFAULT, ToyGtr.isGtr(p)
// Packs: same container as TOY KEYS ("TKP1" + json { zones: [{ root, layer, rr, art, off, len }] } + mp3).
// window.TOY_GTR_PACKS = { acoustic: url, electric: url, solid: url, gretsch: url } moves them (asset store).
//
// PRESET FORMAT (simple on purpose, so other tools can write one):
//   { engine: "toygtr", name, group: "ACOUSTIC" | "ELECTRIC" | "DIRTY", model: "acoustic" | "electric" | "solid" | "gretsch",
//     macros: [{ name: "TONE", value }, { name: "DRIVE", value }, { name: "SPACE", value }, { name: "MOTION", value }],  // 0..1
//     amp: "none" | "clean" | "crunch" | "lead" | "fuzz",   cab: "none" | "1x12" | "2x12" | "4x12" | "radio",
//     chorus: 0..1, trem: Hz (0 = off), vib: 0..1,           // how much MOTION moves each
//     slap: 0..1 (slapback echo), hiss: 0..1, wow: 0..1, crush: 0..1, lowcut: Hz, hicut: Hz,
//     strum: ms (0 = off), dbl: 0 | 1, palm: "off" | "auto" | "on", riff: 0 | 1, layerBias: -1..1, hue, gain }
(function () {
  "use strict";
  const PACK_URL = { acoustic: "toy-gtr/acoustic.tgp", electric: "toy-gtr/electric.tgp", solid: "toy-gtr/solid.tgp", gretsch: "toy-gtr/gretsch.tgp" };
  const packUrl = (n) => (window.TOY_GTR_PACKS && window.TOY_GTR_PACKS[n]) || PACK_URL[n];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  // ---------------------------------------------------------------- presets
  const M = (tone, drive, space, motion) => [{ name: "TONE", value: tone }, { name: "DRIVE", value: drive }, { name: "SPACE", value: space }, { name: "MOTION", value: motion }];
  const P = (name, group, model, macros, extra = {}) => ({ engine: "toygtr", name, category: "Guitar", group, model, macros, amp: "none", cab: "none", palm: "off", ...extra });
  const PRESETS = [
    // ACOUSTIC
    P("Acoustic", "ACOUSTIC", "acoustic", M(0.78, 0, 0.18, 0), { hue: 35, strum: 14, gain: 1 }),
    P("Fingerpick", "ACOUSTIC", "acoustic", M(0.6, 0, 0.22, 0), { hue: 28, layerBias: -0.35, gain: 1 }),
    P("Campfire", "ACOUSTIC", "acoustic", M(0.72, 0, 0.14, 0), { hue: 22, strum: 24, dbl: 1, gain: 1 }),
    P("Night Acoustic", "ACOUSTIC", "acoustic", M(0.42, 0, 0.55, 0.25), { hue: 265, layerBias: -0.25, vib: 0.5, strum: 18, gain: 1 }),
    P("Archtop Mic", "ACOUSTIC", "electric", M(0.55, 0, 0.16, 0), { hue: 18, amp: "clean", cab: "1x12", gain: 1 }),
    P("Tape Acoustic", "ACOUSTIC", "acoustic", M(0.44, 0.2, 0.2, 0.5), { hue: 38, wow: 1, hiss: 0.5, lowcut: 140, strum: 16, gain: 1 }),
    // ELECTRIC
    P("Clean Electric", "ELECTRIC", "solid", M(0.7, 0.08, 0.2, 0), { hue: 205, amp: "clean", cab: "2x12", gain: 1 }),
    P("Chorus Clean", "ELECTRIC", "solid", M(0.74, 0.06, 0.32, 0.6), { hue: 190, amp: "clean", cab: "2x12", chorus: 1, gain: 1 }),
    P("Dark Clean", "ELECTRIC", "solid", M(0.36, 0.04, 0.5, 0.35), { hue: 255, amp: "clean", cab: "1x12", chorus: 0.6, gain: 1 }),
    P("Dream Trem", "ELECTRIC", "gretsch", M(0.62, 0.05, 0.6, 0.55), { hue: 280, amp: "clean", cab: "1x12", trem: 5.2, gain: 1 }),
    P("Twang", "ELECTRIC", "gretsch", M(0.82, 0.12, 0.22, 0), { hue: 160, amp: "clean", cab: "1x12", slap: 0.55, gain: 1 }),
    P("Jazz Box", "ELECTRIC", "electric", M(0.32, 0.06, 0.2, 0), { hue: 30, amp: "clean", cab: "1x12", layerBias: -0.2, gain: 1 }),
    P("Riff Clean", "ELECTRIC", "gretsch", M(0.68, 0.1, 0.16, 0), { hue: 140, amp: "clean", cab: "2x12", riff: 1, palm: "auto", gain: 1 }),
    // DIRTY
    P("Crunch", "DIRTY", "solid", M(0.66, 0.42, 0.16, 0), { hue: 15, amp: "crunch", cab: "2x12", palm: "auto", gain: 1 }),
    P("Distorted", "DIRTY", "solid", M(0.62, 0.7, 0.16, 0), { hue: 0, amp: "lead", cab: "4x12", palm: "auto", dbl: 1, lowcut: 90, gain: 1 }),
    P("Heavy Riff", "DIRTY", "gretsch", M(0.56, 0.86, 0.1, 0), { hue: 350, amp: "lead", cab: "4x12", palm: "auto", riff: 1, dbl: 1, lowcut: 100, gain: 1 }),
    P("Fuzz", "DIRTY", "gretsch", M(0.5, 0.75, 0.2, 0), { hue: 330, amp: "fuzz", cab: "2x12", gain: 1 }),
    P("Lead Solo", "DIRTY", "solid", M(0.7, 0.66, 0.34, 0.4), { hue: 300, amp: "lead", cab: "4x12", riff: 1, vib: 0.6, slap: 0.3, gain: 1 }),
    P("Lo-Fi Guitar", "DIRTY", "electric", M(0.4, 0.3, 0.24, 0.55), { hue: 45, amp: "crunch", cab: "radio", wow: 1, hiss: 0.6, crush: 0.35, lowcut: 180, gain: 1 }),
  ];
  // each preset's level (dB) so every sound lands about as loud as TOY KEYS' (measured on a chord, tests/kt2/toygtr-levels.js)
  const LEVEL_DB = {"Acoustic": -11.3, "Fingerpick": -10.4, "Campfire": -8.3, "Night Acoustic": -10.5, "Archtop Mic": -13.3, "Clean Electric": -12.5, "Chorus Clean": -12.5, "Dark Clean": -11.4, "Dream Trem": -8.4, "Twang": -12.0, "Jazz Box": -13.1, "Riff Clean": -11.3, "Crunch": -8.6, "Distorted": -3.2, "Heavy Riff": -3.8, "Fuzz": -2.8, "Lead Solo": -2.8, "Lo-Fi Guitar": -10.5, "Tape Acoustic": -12.0};
  const DEFAULT = "Acoustic";
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const presetByName = (n) => { const p = PRESETS.find((x) => x.name.toLowerCase() === String(n || "").toLowerCase()); return p ? copy(p) : null; };
  const isGtr = (p) => !!p && p.engine === "toygtr";

  // ---------------------------------------------------------------- shared per-context things
  const perCtx = new WeakMap();
  const shared = (ctx) => { let s = perCtx.get(ctx); if (!s) perCtx.set(ctx, (s = { packs: new Map(), ready: new Map() })); return s; };
  const rawPacks = new Map();
  function fetchPack(name) {
    if (!rawPacks.has(name)) rawPacks.set(name, fetch(packUrl(name)).then((r) => { if (!r.ok) throw new Error("TOY GTR: no " + name + " pack (" + r.status + ")");
      // a pack in the asset store comes as JSON { b: base64 } (the store takes no .tgp files)
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
          return { root: z.root, layer: z.layer, rr: z.rr || 0, art: z.art || "o", buf: trimFront(ctx, ab) };
        }));
        const by = (art) => zones.filter((z) => z.art === art);
        const ord = by("o"), nLayers = 1 + Math.max(0, ...ord.map((z) => z.layer));
        const pack = { name, zones, nLayers, ord, stac: by("s"), ham: by("h"), rel: by("r"), noise: by("n"),
          roots: [...new Set(ord.map((z) => z.root))].sort((a, b) => a - b) };
        S.ready.set(name, pack);
        return pack;
      }).catch((e) => { S.packs.delete(name); console.warn(e.message || e); return null; }));
    }
    return S.packs.get(name);
  }
  // mp3 adds a little silence in front: start each sample right at its pick
  function trimFront(ctx, ab) {
    const d0 = ab.getChannelData(0);
    let pk = 0; for (let i = 0; i < Math.min(d0.length, ab.sampleRate * 0.3); i++) pk = Math.max(pk, Math.abs(d0[i]));
    let i0 = 0; const th = pk * 0.02;
    while (i0 < d0.length && Math.abs(d0[i0]) < th) i0++;
    i0 = Math.max(0, i0 - 24);
    if (i0 < 8) return ab;
    const out = ctx.createBuffer(1, ab.length - i0, ab.sampleRate);
    out.getChannelData(0).set(d0.subarray(i0));
    return out;
  }
  function noiseBuf(ctx) {
    const S = shared(ctx);
    if (!S.noise) { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; S.noise = b; }
    return S.noise;
  }
  function reverbIR(ctx) {
    const S = shared(ctx);
    if (!S.ir) {   // a plate-ish room: dense, darkening as it fades
      const sr = ctx.sampleRate, n = Math.round(sr * 2.2), b = ctx.createBuffer(2, n, sr), pre = Math.round(sr * 0.008);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c); let lp = 0;
        for (let i = pre; i < n; i++) { const t = (i - pre) / sr, k = 0.3 + 0.62 * Math.exp(-t * 1.8); lp += k * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-t * 3.0) * (1 - Math.exp(-t * 120)); }
      }
      S.ir = b;
    }
    return S.ir;
  }
  // AMP curves: x in -1..1 (after the pre-gain), out -1..1
  const AMP = {
    none: (x, k) => Math.tanh(k * x) / Math.tanh(k),
    clean: (x, k) => { const y = Math.tanh(k * (x + 0.04)) - Math.tanh(k * 0.04); return y / (Math.tanh(k * 1.04) - Math.tanh(k * 0.04)); },
    crunch: (x, k) => { const a = x >= 0 ? Math.tanh(k * x) : Math.tanh(k * 0.8 * x) * 1.08; return a / Math.tanh(k); },
    lead: (x, k) => { const a = Math.tanh(k * x * 1.6); return Math.sign(a) * Math.pow(Math.abs(a), 0.82); },
    fuzz: (x, k) => { const a = clamp(k * x * 2.4 + 0.12, -1, 1); return (a - 0.12) / 1.12 + 0.18 * Math.abs(x) * (x > 0 ? 1 : -1); },
  };
  function ampCurve(type, drive) {
    const n = 4096, c = new Float32Array(n), f = AMP[type] || AMP.none;
    const k = type === "none" ? 1 + 6 * drive * drive : type === "clean" ? 1 + 5 * drive : type === "crunch" ? 2 + 14 * drive : type === "lead" ? 4 + 36 * drive : 6 + 50 * drive;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = (type === "none" && drive < 0.02) ? x : f(x, k); }
    return c;
  }
  function crushCurve(amount) {
    const n = 4096, c = new Float32Array(n), bits = amount > 0.01 ? 14 - amount * 9 : 0, steps = bits ? Math.pow(2, bits - 1) : 0;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = steps ? Math.round(x * steps) / steps : x; }
    return c;
  }
  // CAB: a speaker cabinet drawn with filters (no impulse files to license or load): [type, freq, Q, gain]
  const CAB = {
    none: [],
    "1x12": [["highpass", 75, 0.7], ["peaking", 110, 1, 2], ["peaking", 1900, 1.2, 3], ["lowpass", 5600, 0.9], ["lowpass", 7600, 0.7]],
    "2x12": [["highpass", 70, 0.7], ["peaking", 120, 1, 3], ["peaking", 750, 1.4, -2.5], ["peaking", 2400, 1.1, 4], ["lowpass", 5000, 1.0], ["lowpass", 6800, 0.7]],
    "4x12": [["highpass", 80, 0.8], ["peaking", 110, 1.1, 4.5], ["peaking", 600, 1.3, -4], ["peaking", 2300, 1.2, 5], ["lowpass", 4400, 1.1], ["lowpass", 5800, 0.8]],
    radio: [["highpass", 320, 0.9], ["peaking", 1500, 1, 6], ["lowpass", 3400, 1.2], ["lowpass", 4000, 0.8]],
  };

  // ---------------------------------------------------------------- one engine
  function create(ctx, opts = {}) {
    let preset = isGtr(opts.preset) ? copy(opts.preset) : presetByName(DEFAULT);
    const now = () => ctx.currentTime;
    const input = ctx.createGain(), busC = input;
    // chain
    const lowcut = ctx.createBiquadFilter(), pre = ctx.createGain(), amp = ctx.createWaveShaper(), post = ctx.createGain();
    const cabIn = ctx.createGain(), cabOut = ctx.createGain();
    const chDry = ctx.createGain(), chWet = ctx.createGain(), chD1 = ctx.createDelay(0.05), chD2 = ctx.createDelay(0.05), chP1 = ctx.createStereoPanner(), chP2 = ctx.createStereoPanner();
    const chLfo = ctx.createOscillator(), chA1 = ctx.createGain(), chA2 = ctx.createGain(), chSum = ctx.createGain();
    const trem = ctx.createGain(), tremLfo = ctx.createOscillator(), tremAmt = ctx.createGain();
    const wowD = ctx.createDelay(0.05), wowLfo = ctx.createOscillator(), wowAmt = ctx.createGain(), crush = ctx.createWaveShaper();
    const tone = ctx.createBiquadFilter(), presence = ctx.createBiquadFilter(), hicut = ctx.createBiquadFilter();
    const dry = ctx.createGain(), verb = ctx.createConvolver(), wet = ctx.createGain();
    const slapD = ctx.createDelay(1), slapF = ctx.createBiquadFilter(), slapG = ctx.createGain(), slapFb = ctx.createGain();
    const lim = ctx.createDynamicsCompressor(), out = ctx.createGain(), meterA = ctx.createAnalyser();
    const hiss = ctx.createBufferSource(), hissF = ctx.createBiquadFilter(), hissG = ctx.createGain();
    lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 10; lim.attack.value = 0.002; lim.release.value = 0.12;
    lowcut.type = "highpass"; lowcut.Q.value = 0.6;
    amp.oversample = "4x"; crush.oversample = "none";
    tone.type = "lowpass"; tone.Q.value = 0.6; presence.type = "peaking"; presence.frequency.value = 3200; presence.Q.value = 0.8; hicut.type = "lowpass"; hicut.Q.value = 0.7;
    chD1.delayTime.value = 0.011; chD2.delayTime.value = 0.017; chP1.pan.value = -0.7; chP2.pan.value = 0.7;
    chLfo.frequency.value = 0.8; chLfo.connect(chA1); chLfo.connect(chA2); chA1.connect(chD1.delayTime); chA2.connect(chD2.delayTime);
    tremLfo.type = "sine"; tremLfo.connect(tremAmt); tremAmt.connect(trem.gain);
    wowD.delayTime.value = 0.012; wowLfo.frequency.value = 0.6; wowLfo.connect(wowAmt); wowAmt.connect(wowD.delayTime);
    slapF.type = "lowpass"; slapF.frequency.value = 3200;
    verb.buffer = reverbIR(ctx);
    hiss.buffer = noiseBuf(ctx); hiss.loop = true; hissF.type = "bandpass"; hissF.frequency.value = 5000; hissF.Q.value = 0.4; hissG.gain.value = 0;
    // wire
    input.connect(lowcut); lowcut.connect(pre); pre.connect(amp); amp.connect(post); post.connect(cabIn);
    let cabNodes = [];
    const wireCab = (type) => {
      try { cabIn.disconnect(); } catch (e) { /* first */ }
      for (const f of cabNodes) { try { f.disconnect(); } catch (e) { /* gone */ } }
      cabNodes = (CAB[type] || []).map(([t, fq, q, g]) => { const f = ctx.createBiquadFilter(); f.type = t; f.frequency.value = fq; f.Q.value = q; if (g != null) f.gain.value = g; return f; });
      let a = cabIn; for (const f of cabNodes) { a.connect(f); a = f; } a.connect(cabOut);
    };
    let cabType = null;
    cabOut.connect(chDry); cabOut.connect(chD1); cabOut.connect(chD2);
    chD1.connect(chP1); chD2.connect(chP2); chP1.connect(chWet); chP2.connect(chWet);
    chDry.connect(chSum); chWet.connect(chSum);
    chSum.connect(trem); trem.connect(wowD); wowD.connect(crush); crush.connect(presence); presence.connect(tone); tone.connect(hicut);
    hiss.connect(hissF); hissF.connect(hissG); hissG.connect(hicut);
    hicut.connect(dry); hicut.connect(verb); hicut.connect(slapD);
    slapD.connect(slapF); slapF.connect(slapG); slapF.connect(slapFb); slapFb.connect(slapD); slapG.connect(lim); slapG.connect(verb);
    verb.connect(wet); dry.connect(lim); wet.connect(lim); lim.connect(meterA); meterA.connect(out);
    meterA.fftSize = 1024;
    const t0 = now();
    for (const o of [chLfo, tremLfo, wowLfo, hiss]) o.start(t0);
    let mac = [0.75, 0, 0.2, 0];

    function applyFx(at = now(), fast = false) {
      const tau = fast ? 0.005 : 0.03, set = (prm, v) => prm.setTargetAtTime(v, at, tau);
      const [tn, dr, sp, mo] = mac, pr = preset, type = pr.amp || "none";
      amp.curve = ampCurve(type, dr);
      if (cabType !== (pr.cab || "none")) { cabType = pr.cab || "none"; wireCab(cabType); }
      // DRIVE adds grit, not loudness: the amp's small-signal gain comes back off after it
      const pg = type === "none" ? 1 + dr : 1 + dr * 2.5;
      const c = ampCurve(type, dr), slope = Math.max(1, (c[2049] - c[2047]) / (2 * 2 / 4095)), comp = Math.pow(10, -Math.min(24, 14 * Math.log10(slope * pg)) / 20);
      set(pre.gain, pg);
      set(post.gain, (pr.gain || 1) * comp * Math.pow(10, (LEVEL_DB[pr.name] || 0) / 20));
      set(lowcut.frequency, pr.lowcut || 40);
      set(tone.frequency, 900 * Math.pow(20, clamp(tn)));
      set(presence.gain, (tn - 0.5) * 7);
      set(hicut.frequency, pr.hicut || 16000);
      // MOTION: chorus / tremolo / vibrato as the preset weights them, plus tape wow on lo-fi ones
      const ch = (pr.chorus || 0) * mo;
      set(chWet.gain, ch * 0.75); set(chDry.gain, 1 - ch * 0.25); set(chA1.gain, 0.0022 * ch); set(chA2.gain, -0.0027 * ch);
      const td = pr.trem ? clamp(mo) * 0.85 : 0;
      if (pr.trem) set(tremLfo.frequency, pr.trem);
      set(tremAmt.gain, td * 0.5); set(trem.gain, 1 - td * 0.5);
      const w = (pr.wow || 0) * (0.3 + 0.7 * mo);
      set(wowAmt.gain, 0.0026 * w * w);
      crush.curve = crushCurve(pr.crush || 0);
      set(hissG.gain, (pr.hiss || 0) * 0.006);
      set(wet.gain, sp * sp * 1.25); set(dry.gain, 1 - sp * 0.3);
      const sl = pr.slap || 0;
      set(slapD.delayTime, 0.11 + 0.05 * (1 - sl)); set(slapG.gain, sl * (0.25 + 0.35 * sp)); set(slapFb.gain, 0.18 * sl);
      vibDepth = (pr.vib || 0) * mo;
      for (const v of voices) setVib(v, at);
    }
    function takePreset(p) {
      preset = isGtr(p) ? copy(p) : preset;
      mac = [0, 1, 2, 3].map((i) => { const m = preset.macros && preset.macros[i]; return clamp(m && m.value != null ? +m.value : [0.75, 0, 0.2, 0][i]); });
      applyFx();
      loadPack(ctx, preset.model || "acoustic").then(() => { if (pending.length) flushPending(); });
    }

    // ---------------------------------------------------------------- voices
    // { pitch, on, off, released, srcs: [AudioBufferSourceNode], amp: GainNode, filt, rate, gone, end }
    const voices = [], pending = [];
    let bendCents = 0, vibDepth = 0, lastStrum = { at: -9, dir: 1 }, lastMono = null;
    const rrCount = new Map();
    const MAXV = 48;
    const velAmp = (v) => Math.pow(clamp(v / 127, 0.05, 1), 1.25);
    const nearest = (list, pitch) => { let z = null; for (const q of list) if (!z || Math.abs(q.root - pitch) < Math.abs(z.root - pitch) || (Math.abs(q.root - pitch) === Math.abs(z.root - pitch) && q.root < z.root)) z = q; return z; };
    function pickZone(pack, list, pitch, layer, salt) {
      if (!list.length) return null;
      const root = nearest(list, pitch).root, here = list.filter((z) => z.root === root);
      let ls = here.filter((z) => z.layer === layer);
      if (!ls.length) { const have = [...new Set(here.map((z) => z.layer))]; const l2 = have.reduce((b, l) => (Math.abs(l - layer) < Math.abs(b - layer) ? l : b), have[0]); ls = here.filter((z) => z.layer === l2); }
      const key = root + ":" + layer + ":" + (list[0] && list[0].art) + ":" + salt, n = (rrCount.get(key) || 0) + 1; rrCount.set(key, n);
      return ls[n % ls.length];
    }
    function setVib(v, at) {
      if (!v.vibG) return;
      v.vibG.gain.setTargetAtTime((v.wob ? v.wob.d * 100 : vibDepth * 22), at, 0.08);
    }
    // the string's pitch: base + pitch-wheel bend + this voice's own line, set on every source of the voice
    function detuneAll(v, cents, at, tau) { for (const [d, base] of v.detunes) { if (tau) d.setTargetAtTime(base + cents, at, tau); else d.setValueAtTime(base + cents, at); } }
    function startVoice(n) {
      const pk = preset.model || "acoustic", pack = shared(ctx).ready.get(pk);
      if (!pack) { pending.push(n); loadPack(ctx, pk).then(() => flushPending()); return null; }
      let at = Math.max(n.on, now());
      const pitch = n.pitch, vel = n.velocity || 100;
      // SLIDE: glide a ringing string to this pitch instead of picking again
      if (n.slide) {
        const ring = voices.filter((x) => !x.slid && x.on < at - 1e-4 && (x.off == null || x.off > at) && !x.killed);
        if (ring.length) {
          const want = n.slideFrom != null ? ring.filter((x) => x.pitch === n.slideFrom) : [];
          const v = (want.length ? want : ring).reduce((b, x) => (x.on > b.on + 0.01 || (Math.abs(x.on - b.on) <= 0.01 && Math.abs(x.pitch - pitch) < Math.abs(b.pitch - pitch)) ? x : b));
          const secs = clamp((Math.min(v.off == null ? Infinity : v.off, n.off == null ? Infinity : n.off) - at) || 0.12, 0.035, 0.32);
          const cents = (pitch - v.pitch) * 100 + v.shift;
          v.shift = cents; v.slid = false;
          for (const [d, base] of v.detunes) { d.setValueAtTime(base + (cents - (pitch - v.pitch) * 100) + bendCents, at); d.linearRampToValueAtTime(base + cents + bendCents, at + secs); }
          v.pitch = pitch;
          v.on2 = at;
          // it rings on to the slide note's end: undo the release it had
          v.released = false; v.off = null; v.gone = null; v.rel.gain.cancelScheduledValues(at); v.rel.gain.setValueAtTime(1, at);
          if (n.off != null && isFinite(n.off)) release(v, Math.max(n.off, at + 0.01));
          expr(v, n, at);
          return v;
        }
      }
      // RIFF: one string at a time; a note that starts while the last still rings is a hammer-on / pull-off
      let legato = false;
      if (preset.riff) {
        const lv = lastMono && voices.includes(lastMono) ? lastMono : null;
        const rings = lv && lv.on < at - 0.005 && (lv.off == null || lv.off > at + 0.01);   // really overlapping (notes that only touch are picked)
        if (rings && Math.abs(lv.pitch - pitch) <= 5 && lv.pitch !== pitch) legato = true;
        if (lv && lv.on < at && (lv.off == null || lv.off > at)) { lv.released = false; release(lv, at + 0.004, 0.012); }
      }
      // PALM: auto = short notes on the low strings
      const len = n.off != null && isFinite(n.off) ? n.off - n.on : Infinity;
      const palm = preset.palm === "on" || (preset.palm === "auto" && len < 0.24 && pitch < 57 && !legato);
      while (voices.length >= MAXV) killVoice(voices[0], at, 0.01);
      const v = { pitch, on: at, off: null, released: false, srcs: [], detunes: [], end: 0, shift: 0, chordAt: n.on, legato };
      v.body = ctx.createGain(); v.rel = ctx.createGain(); v.filt = ctx.createBiquadFilter();
      v.filt.type = "lowpass"; v.filt.Q.value = 0.7; v.filt.frequency.value = 20000;
      const hard = clamp((vel - 20) / 110 + (preset.layerBias || 0) * 0.4), nl = pack.nLayers;
      const layer = Math.min(nl - 1, Math.floor(hard * nl * 0.999));
      // within a layer, a little more velocity = a little louder (the layer already carries most of it)
      v.body.gain.value = velAmp(vel) / velAmp(Math.min(127, ((layer + 1) / nl) * 127)) * (legato ? 0.62 : 1) * (palm ? 1.15 : 1);
      v.body.connect(v.filt); v.filt.connect(v.rel);
      v.rel.connect(busC);
      // vibrato: one slow sine into every source's detune
      v.vib = ctx.createOscillator(); v.vibG = ctx.createGain(); v.vib.frequency.value = 5.2 + Math.random() * 0.6; v.vibG.gain.value = 0;
      v.vib.connect(v.vibG); v.vib.start(at); v.srcs.push(v.vib);
      const list = palm && pack.stac.length ? pack.stac : legato && pack.ham.length ? pack.ham : pack.ord;
      const zoneLayer = list === pack.ord ? layer : 0;
      const play = (z, into, extra = 0, offset = 0) => {
        if (!z) return;
        const src = ctx.createBufferSource();
        src.buffer = z.buf;
        src.playbackRate.value = Math.pow(2, (pitch - z.root) / 12);
        src.detune.value = extra + bendCents;
        src.connect(into);
        v.vibG.connect(src.detune);
        src.start(at, offset);
        v.srcs.push(src); v.detunes.push([src.detune, extra]);
        v.end = Math.max(v.end, at + (z.buf.duration - offset) / src.playbackRate.value);
      };
      // a hammer-on with no recorded hammer: the same note, skipping the pick
      const skip = legato && list === pack.ord ? 0.018 : 0;
      if (!preset.dbl) play(pickZone(pack, list, pitch, zoneLayer, 0), v.body, 0, skip);
      else {
        // DOUBLE: two takes (two round-robins, a few cents apart), hard left and right, like two recorded passes
        for (const [salt, pan, det, late] of [[1, -0.85, -5, 0], [2, 0.85, 6, 0.011]]) {
          const pn = ctx.createStereoPanner(), g = ctx.createGain(); pn.pan.value = pan; g.gain.value = 0.74;
          g.connect(pn); pn.connect(v.body);
          const at0 = at; at += late; play(pickZone(pack, list, pitch, zoneLayer, salt), g, det, skip); at = at0;
        }
      }
      if (palm) {   // the hand on the strings: it closes fast and dark
        v.filt.frequency.setValueAtTime(Math.min(9000, 1400 + (pitch - 40) * 60), at);
        v.filt.frequency.setTargetAtTime(450 + (pitch - 40) * 14, at + 0.008, 0.05);
        v.rel.gain.setValueAtTime(1, at); v.rel.gain.setTargetAtTime(0, at + 0.05, 0.1);
        v.palm = true;
      }
      voices.push(v);
      lastMono = v;
      expr(v, n, at);
      if (n.off != null && isFinite(n.off)) release(v, Math.max(n.off, at + 0.01));
      return v;
    }
    // Advanced MIDI: the note's own bend line (semitones) and wobble
    function expr(v, n, at) {
      if (Array.isArray(n.bend) && n.bend.length) {
        const pts = n.bend.filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).sort((a, b) => a[0] - b[0]);
        for (const [d, base] of v.detunes) {
          const b0 = base + v.shift + bendCents;
          d.setValueAtTime(b0 + pts[0][1] * 100, at + Math.max(0, pts[0][0]));
          for (let i = 1; i < pts.length; i++) d.linearRampToValueAtTime(b0 + pts[i][1] * 100, at + Math.max(0, pts[i][0]));
        }
      }
      if (n.wob && n.wob.d > 0) { v.wob = n.wob; v.vib.frequency.setValueAtTime(n.wob.hz || 5.5, at); v.vibG.gain.setValueAtTime(0, at); v.vibG.gain.linearRampToValueAtTime(n.wob.d * 100, at + Math.max(0.01, n.wob.fade || 0.01)); }
      else setVib(v, at);
    }
    function relTauOf(v) { return v.palm ? 0.02 : preset.amp === "lead" || preset.amp === "fuzz" ? 0.05 : 0.07; }
    function release(v, at, tau) {
      if (v.released) return;
      v.off = at; v.released = true;
      tau = tau || relTauOf(v);
      const g = v.rel.gain;
      if (!v.palm) { g.cancelScheduledValues(at); g.setTargetAtTime(0, at, tau); }
      const stopAt = at + tau * 8 + (v.palm ? 0.4 : 0);
      for (const s of v.srcs) { try { s.stop(stopAt); } catch (e) { /* already */ } }
      v.gone = stopAt;
      // the fingers leaving the string: a quiet squeak / mute from the recordings (long, open notes only)
      const pack = shared(ctx).ready.get(preset.model || "acoustic");
      if (pack && pack.rel.length && !v.palm && tau > 0.03 && at - v.on > 0.18 && !preset.riff) {
        const z = nearest(pack.rel, v.pitch), src = ctx.createBufferSource(), gg = ctx.createGain();
        src.buffer = z.buf; gg.gain.value = 0.35 * (preset.amp === "lead" ? 0.4 : 1);
        src.connect(gg); gg.connect(busC); src.start(at); src.stop(at + z.buf.duration + 0.01);
      }
    }
    function killVoice(v, at = now(), tau = 0.008) {
      v.killed = true;
      { const g = v.rel.gain; g.cancelScheduledValues(at); g.setTargetAtTime(0, at, tau); }
      for (const s of v.srcs) { try { s.stop(at + tau * 8); } catch (e) { /* already */ } }
      const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1);
      setTimeout(() => { try { v.rel.disconnect(); } catch (e) { /* gone */ } }, Math.max(0, (at - now() + tau * 8) * 1000 + 50));
    }
    // STRUM: the notes of a chord (starting within 12 ms) are spread a few ms apart, low to high (down);
    // a chord right after another (under 0.35 s) strums back up, softer
    function planStrum(notes) {
      const list = [...notes].sort((a, b) => a.on - b.on || a.pitch - b.pitch);
      const ms = preset.strum || 0;
      if (!ms) return list;
      const out = [];
      for (let i = 0; i < list.length;) {
        const g = [list[i++]];
        while (i < list.length && list[i].on - g[0].on < 0.012) g.push(list[i++]);
        if (g.length > 1 && !g.some((n) => n.slide)) {
          const t = g[0].on, dir = t - lastStrum.at < 0.35 && t > lastStrum.at ? -lastStrum.dir : 1;
          lastStrum = { at: t, dir };
          (dir > 0 ? g : [...g].reverse()).forEach((n, k) => out.push({ ...n, on: n.on + k * ms / 1000 * (dir > 0 ? 1 : 0.7), velocity: dir > 0 ? n.velocity : Math.round((n.velocity || 100) * 0.85) }));
        } else out.push(...g);
      }
      return out.sort((a, b) => a.on - b.on);
    }
    function flushPending() {
      const list = pending.splice(0), t = now();
      for (const n of list.sort((a, b) => a.on - b.on)) if (!(n.off <= t)) startVoice({ ...n, on: Math.max(n.on, t + 0.005) });
    }
    const sweep = setInterval(() => { const t = now(); for (const v of [...voices]) if ((v.gone && v.gone < t - 0.1) || (v.end && v.end < t - 0.1)) { const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); try { v.rel.disconnect(); } catch (e) { /* gone */ } } }, 1000);

    takePreset(preset);
    applyFx(now(), true);
    if (opts.notes) planStrum(opts.notes).forEach((n) => startVoice(n));

    const api = {
      output: out,
      isToyKeys: true,   // a web engine like TOY KEYS (playground.js keeps it apart from the TOY MACHINE wasm)
      isToyGtr: true,
      setPreset(p) { takePreset(typeof p === "string" ? JSON.parse(p) : p); },
      setMacro(i, v) { if (i >= 0 && i < 4) { mac[i] = clamp(+v); applyFx(); } },
      setPad() {}, setPadStar() {}, setSample() {}, setDropSample() {},
      noteOn(pitch, velocity = 100, when) { startVoice({ pitch, velocity, on: when == null ? now() : when, off: null }); },
      noteOff(pitch, when) {
        const at = Math.max(now(), when == null ? now() : when);
        const v = voices.filter((x) => x.pitch === pitch && !x.released && x.on <= at + 1e-4).pop();
        if (v) release(v, at);
        else { const p = pending.filter((x) => x.pitch === pitch && x.off == null).pop(); if (p) p.off = at; }
      },
      bend(val, when) { bendCents = clamp(+val, -1, 1) * 200; const at = when == null ? now() : when; for (const x of voices) detuneAll(x, x.shift + bendCents, at, 0.01); },
      wheel(val) { vibDepth = Math.max((preset.vib || 0) * mac[3], clamp(+val) * 0.6); for (const v of voices) setVib(v, now()); },
      schedule(notes) { for (const n of planStrum((notes || []).map((n) => ({ ...n, velocity: n.velocity || 100 })))) startVoice(n); },
      requeue() {
        const t = now();
        pending.length = 0;
        for (const v of [...voices]) {
          if (v.on > t + 0.002) { killVoice(v, t, 0.003); continue; }
          if (v.released && v.off > t && !v.palm) { v.released = false; v.off = null; const g = v.rel.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value || 1, t); g.setTargetAtTime(1, t, 0.01); v.gone = null; }
        }
      },
      flush(mode = "soft") {
        const t = now();
        pending.length = 0;
        for (const v of [...voices]) killVoice(v, t, mode === "hard" ? 0.005 : 0.03);
        if (mode === "hard") { for (const g of [wet.gain, slapG.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(0, t); } applyFx(t + 0.25); }
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
        for (const o of [chLfo, tremLfo, wowLfo, hiss]) { try { o.stop(); } catch (e) { /* gone */ } }
        setTimeout(() => { try { out.disconnect(); input.disconnect(); } catch (e) { /* gone */ } }, 120);
      },
      preset: () => copy(preset),
    };
    return api;
  }

  const apis = new WeakMap();
  function load(ctx) {
    if (!apis.has(ctx)) apis.set(ctx, { create: (opts) => create(ctx, opts), preload: (name) => { const p = presetByName(name) || (isGtr(name) ? name : null); return p ? loadPack(ctx, p.model) : Promise.resolve(null); } });
    return apis.get(ctx);
  }
  const prefetch = (name) => { const p = presetByName(name); if (p) fetchPack(p.model).catch(() => {}); };

  window.ToyGtr = { load, PRESETS, DEFAULT, preset: presetByName, isGtr, prefetch, LEVEL_DB, version: 1 };
})();
