// BLOB look: what a TOY MACHINE preset looks like as a creature (BLOB design map, pages 3-5 and 11).
// measure(preset, meta) reads 12 numbers from the sound, lookOf() turns them into the renderer's
// look (ui/blob3d.js). Everything is read from the sound, never chosen by hand, so a rough sound
// can't look happy by accident: rough = darker, sweet = more colourful, low = deep hues, high = icy.
// meta is the preset's index entry (its "kw" words help to tell a bell from a vocal).
// Keep this file ASCII-only, like ui/.
"use strict";

window.BlobLook = (function () {
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const num = (x, d) => (typeof x === "number" && isFinite(x) ? x : d);
  const has = (words, re) => words.some((w) => re.test(w));

  // harmonic amplitudes of a built-in table at a position (enough to tell the shapes apart)
  function tableHarmonics(wave, pos) {
    const N = 48, h = new Array(N).fill(0);
    const saw = () => h.map((_, i) => 1 / (i + 1));
    const sq = () => h.map((_, i) => ((i + 1) % 2 ? 1 / (i + 1) : 0));
    const tri = () => h.map((_, i) => ((i + 1) % 2 ? 1 / ((i + 1) * (i + 1)) : 0));
    const sin = () => h.map((_, i) => (i ? 0 : 1));
    const mix = (a, b, k) => a.map((x, i) => lerp(x, b[i], k));
    switch (wave) {
      case "sine": return sin();
      case "triangle": return tri();
      case "saw": case "warm": return saw();
      case "square": case "hollow": return sq();
      case "pwm": return mix(sq(), saw(), clamp(pos));
      case "organ": case "harmonic": return h.map((_, i) => ([0, 1, 2, 3, 5, 7, 11].includes(i) ? 0.8 / Math.sqrt(i + 1) : 0));
      case "formant": case "vocal": return h.map((_, i) => 0.3 / (i + 1) + Math.exp(-Math.pow((i + 1 - 4) / 1.5, 2)) + 0.6 * Math.exp(-Math.pow((i + 1 - 11) / 2.5, 2)));
      case "metal": case "fmbell": return h.map((_, i) => (i % 3 === 0 || i === 6 || i === 13 ? 0.7 : 0.05) / Math.sqrt(i + 1));
      case "growl": case "comb": case "acid": return h.map((_, i) => (0.6 + 0.4 * Math.sin(i * 1.3)) / Math.sqrt(i + 1));
      case "digital": case "chip": return sq().map((x, i) => (i < 8 ? x : x * 0.3));
      case "sinefold": return h.map((_, i) => ((i + 1) % 2 ? 0.8 / Math.sqrt(i + 1) : 0));
      default: { // basic: sine -> triangle -> saw -> square
        const p = clamp(pos) * 3, i = Math.min(2, Math.floor(p)), k = p - i;
        const f = [sin(), tri(), saw(), sq()];
        return mix(f[i], f[i + 1], k);
      }
    }
  }
  function oscHarmonics(o) {
    if (!o) return null;
    if (Array.isArray(o.frames) && o.frames.length) {
      const fr = o.frames[Math.round(clamp(num(o.pos, 0)) * (o.frames.length - 1))] || o.frames[0];
      const m = Math.max(1e-9, ...fr.map(Math.abs));
      return fr.map((x) => Math.abs(x) / m);
    }
    return tableHarmonics(o.wave || "basic", num(o.pos, 0));
  }
  // shape of one spectrum: how many harmonics, where the energy sits, odd-only or not, how jagged
  function spectrum(h) {
    let e = 0, c = 0, odd = 0, upper = 0, count = 0, jag = 0, mean = 0;
    for (let i = 0; i < h.length; i++) {
      const n = i + 1, a = h[i], p = a * a;
      e += p; c += n * p; if (a > 0.04) count++;
      if (n >= 2) { upper += p; if (n % 2) odd += p; }
      if (i > 0 && i < h.length - 1) { jag += Math.abs(a - (h[i - 1] + h[i + 1]) / 2); mean += a; }
    }
    return { count, centroid: e ? c / e : 1, odd: upper > 1e-6 ? odd / upper : 0.5, jag: mean > 1e-6 ? jag / mean : 0 };
  }

  // 12 numbers (0..1) and a family, from the sound
  function measure(pr, meta) {
    pr = pr || {};
    const words = [...((meta && meta.kw) || []), ...((meta && meta.tags) || pr.tags || []), ...String((meta && meta.name) || pr.name || "").toLowerCase().split(/[^a-z0-9]+/)].map((w) => String(w).toLowerCase());
    const cat = String((meta && meta.category) || pr.category || "");
    const A = pr.oscA || {}, B = pr.oscB || {};
    const aOn = A.on !== false, bOn = !!B.on;
    const hA = aOn ? oscHarmonics(A) : null, hB = bOn ? oscHarmonics(B) : null;
    const sA = hA ? spectrum(hA) : { count: 1, centroid: 1, odd: 0.5, jag: 0 }, sB = hB ? spectrum(hB) : null;
    const wave = String(aOn && !A.frames ? A.wave || "basic" : bOn && !B.frames ? B.wave || "" : "");
    const warp = [A.warp, B.warp].map((w) => (w && w.type) || "none");
    const flt = pr.filter || {};
    const fOn = flt.on !== false, ftype = String(flt.type || "lp24");
    const cutoff = fOn ? num(flt.cutoff, 20000) : 20000;
    const amp = pr.ampEnv || {};
    const fxOn = (t) => (pr.fx || []).find((f) => f.type === t && f.on !== false);
    const drive = fxOn("drive"), chorus = fxOn("chorus"), reverb = fxOn("reverb"), delay = fxOn("delay"), phaser = fxOn("phaser"), ott = fxOn("ott");
    const uni = [aOn && A.unison, bOn && B.unison].filter(Boolean);
    const voices = Math.max(1, ...uni.map((u) => num(u.voices, 1)));
    const detune = Math.max(0, ...uni.map((u) => (num(u.voices, 1) > 1 ? num(u.detune, 0) : 0)));
    const spread = Math.max(0, ...uni.map((u) => (num(u.voices, 1) > 1 ? num(u.spread, 0) : 0)));
    const noise = pr.noise && pr.noise.on ? num(pr.noise.level, 0.1) : 0;
    const sub = pr.sub && pr.sub.on ? num(pr.sub.level, 0.6) : 0;
    const oct = aOn ? num(A.oct, 0) : num(B.oct, 0);
    const mods = (pr.mods || []).filter((m) => Math.abs(num(m.amt, 0)) > 0.01);
    const lfoRate = Math.max(0, ...["lfo1", "lfo2"].map((k) => (pr[k] && mods.some((m) => m.src === k) ? num(pr[k].rate, 1) : 0)));

    // brightness: where the energy sits after the filter
    const filtK = /hp/.test(ftype) ? 1 : clamp((Math.log2(cutoff) - Math.log2(150)) / (Math.log2(16000) - Math.log2(150)));
    const specK = clamp((sA.centroid - 1) / 6);
    const brightness = clamp(0.65 * filtK + 0.35 * specK * (0.4 + 0.6 * filtK));
    const density = clamp(Math.log2(voices) / 3.5) * clamp(0.3 + detune / 40);
    const drv = drive ? clamp(num(drive.amount, 0) / 24) * num(drive.mix, 1) : 0;
    const fm = warp.some((w) => w === "fm") ? 1 : 0;
    const wildness = clamp(0.45 * sA.jag + 0.25 * (sB ? Math.abs(sA.centroid - sB.centroid) / 6 : 0) + 0.4 * fm + 0.5 * noise + 0.3 * drv + (detune > 40 ? 0.2 : 0));
    const roughWords = has(words, /^(dark|dirty|grit|gritty|distort|distorted|aggressive|heavy|evil|reese|nasty|growl|dubstep|rage|villain|menacing|harsh|industrial|filthy|metallic|sinister|gnarly)/);
    const sweetWords = has(words, /^(happy|bright|dreamy|sweet|uplifting|major|cute|soft|warm|lush|chill|airy|shimmer|glassy|pretty|euphoric|nostalgic|lo-?fi|calm|mellow|gentle)/);
    const roughness = clamp(0.55 * drv + 0.25 * clamp(num(flt.drive, 0) / 9) + 0.6 * noise + 0.2 * clamp((detune - 20) / 40) + (roughWords ? 0.35 : 0) - (sweetWords ? 0.15 : 0) + (cat === "Bass" ? 0.1 : 0));
    const sweetness = clamp(0.25 + (chorus ? 0.25 * num(chorus.mix, 0.3) * 2 : 0) + (reverb ? 0.2 * num(reverb.mix, 0.2) * 2 : 0) + (sweetWords ? 0.35 : 0) - 0.5 * roughness + (/Plucks|Keys|Pads|Arps/.test(cat) ? 0.1 : 0) - (sA.odd > 0.85 ? 0.05 : 0));
    const atk = num(amp.a, 0.003);
    const hardness = clamp(1 - Math.log10(atk / 0.001) / 3);
    const tail = clamp(num(amp.r, 0.1) / 2 + (reverb ? num(reverb.decay, 2) / 10 * num(reverb.mix, 0.2) * 2 : 0));
    const width = clamp(spread * 0.6 + num((pr.out || {}).width, 1) * 0.2 + (chorus ? 0.2 : 0));
    const reg = { Bass: -1, Pads: 0.1, Keys: 0.25, Synths: 0.2, Leads: 0.5, Plucks: 0.45, Arps: 0.55, FX: 0.4 }[cat];
    const weight = clamp(0.5 - 0.35 * (reg == null ? 0 : reg) - 0.12 * oct + 0.35 * sub);
    const movement = clamp(mods.length * 0.15 + lfoRate / 10 + (phaser ? 0.3 : 0) + (pr.lfo1 && mods.some((m) => m.src === "lfo1" && /cutoff/.test(m.dst || "")) ? 0.2 : 0));
    const space = clamp((reverb ? num(reverb.mix, 0.2) * 1.4 : 0) + (delay ? num(delay.mix, 0.2) : 0));

    // family: what the source is made of
    const fam = {};
    const W = (re) => has(words, re);
    fam.crystal = Math.max(fm * 0.9, /metal|fmbell/.test(wave) ? 1 : 0, W(/^(bell|bells|glass|glassy|metal|metallic|mallet|kalimba|marimba|vibraphone|celesta|chime|chimes|crystal|fm)$/) ? 0.85 : 0);
    fam.petals = Math.max(/formant|vocal/.test(wave) ? 1 : 0, W(/^(vocal|vox|choir|voice|formant|vowel|chant)$/) ? 0.9 : 0);
    fam.ribbons = Math.max(/growl|comb|acid/.test(wave) ? 1 : 0, W(/^(growl|dubstep|acid|riddim|yoi|talking|tearout)$/) ? 0.85 : 0, phaser ? 0.6 : 0);
    fam.cluster = Math.max(/organ|harmonic/.test(wave) ? 1 : 0, W(/^(organ|additive|church|drawbar)$/) ? 0.85 : 0);
    fam.voxel = Math.max(/digital|chip/.test(wave) ? 1 : 0, W(/^(chip|chiptune|8bit|8-bit|bit|bitcrush|gameboy|nes)$/) ? 0.8 : 0);
    fam.sphere = sA.count <= 2 && (!sB || sB.count <= 2) ? 1 : sA.count <= 4 ? 0.5 : 0;
    fam.cube = sA.odd > 0.8 && sA.count > 3 ? 0.7 + 0.3 * sA.odd : 0;
    fam.tear = sA.count > 4 && sA.odd < 0.8 ? 0.6 : 0.2;
    let family = "tear", best = -1;
    for (const k of ["crystal", "petals", "ribbons", "cluster", "voxel", "sphere", "cube", "tear"]) if (fam[k] > best + 0.05) { best = fam[k]; family = k; }

    return {
      family, fam, brightness, density, wildness, roughness, sweetness, hardness, tail, width, weight, movement, space,
      harmonics: sA.count, odd: sA.odd, voices, detune, chorus: chorus ? num(chorus.mix, 0.3) : 0, noise, drive: drv,
      res: fOn ? num(flt.res, 0) : 0, hp: /hp/.test(ftype), bp: /bp/.test(ftype), sub, oscB: bOn ? num(B.level, 0.8) : 0,
      ott: !!ott, glide: num((pr.voice || {}).glide, 0), lfoRate,
      seed: hashStr(String((meta && meta.id) || pr.name || "blob"))
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
    const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
  }

  // the renderer's look from the measurements
  // the empty blob (no sound loaded yet): a calm, soft, glossy blob with a slight saw lean
  const PLAIN = { egg: 0.3, lumps: 0.6, gloss: 0.8, frost: 0.2, trans: 0.75, bump: 0.08, c1: "#e07ad8", c2: "#9b7bff", marble: 0.6, iri: 0.25, lampCol: "#ffc0e0", core: 0.3, coreCol: "#7a4cff", speed: 0.5, wobble: 0.5 };
  function lookOf(pr, meta) {
    if (!pr || pr === INIT) return { look: { ...PLAIN }, m: measure(INIT, null) };
    const m = measure(pr, meta), L = {};
    const f = m.family;
    // CORE: the body shape
    L.tear = f === "tear" ? 0.35 + 0.4 * m.brightness : f === "cube" ? 0.1 : 0.15 * (1 - m.fam.sphere);
    L.cube = f === "cube" ? 0.45 + 0.3 * m.odd : f === "voxel" ? 0.7 : 0;
    L.cluster = f === "cluster" ? 1 : 0;
    L.petals = f === "petals" ? 1 : 0;
    L.ribbons = f === "ribbons" ? 1 : m.fam.ribbons * 0.4;
    L.crystal = f === "crystal" ? 1 : f === "voxel" ? 0.55 : 0;
    L.lumps = clamp(0.2 + 0.4 * (1 - m.hardness) + 0.3 * m.roughness + 0.2 * m.movement);
    // SPIKES: harmonics and bite
    const spikeable = !["cluster", "petals", "ribbons", "sphere"].includes(f) || m.wildness > 0.5;
    const n = spikeable ? Math.round(clamp((m.harmonics - 3) / 30) * (m.odd > 0.8 ? 18 : 36) * (0.4 + 0.6 * m.brightness) + m.wildness * 20) : 0;
    L.spk = n >= 4 ? Math.min(64, n) : 0;
    L.spkLen = clamp(0.06 + 0.55 * m.brightness * (0.5 + 0.5 * m.hardness) + 0.15 * m.wildness, 0, 0.8);
    L.spkRand = clamp(m.wildness * 1.2);
    L.spkSoft = clamp(1 - m.hardness * 0.9);
    L.heat = clamp(m.drive * 1.6);
    // SKIN: the filter
    L.gloss = clamp(0.1 + 0.85 * m.brightness);
    L.glass = m.hp ? 0.8 : f === "crystal" ? 1 : f === "petals" ? 0.35 : 0;
    L.rim = clamp(m.res * 1.3 + (m.bp ? 0.3 : 0) + (m.ott ? 0.2 : 0));
    L.frost = clamp(0.15 + m.noise * 2 + 0.3 * m.roughness);
    // FUR: voices and width
    // VOICES (fur is gone, Eman 31 Oct): many voices grow thick bristles, wide detune makes them
    // longer, very wide sounds grow long round-tipped antennae instead; chorus scatters dots
    const wide = m.voices >= 5 && m.detune >= 10;
    L.bristles = wide && m.detune < 45 ? clamp(0.5 + m.density * 0.6) : 0;
    L.briLen = clamp(0.15 + m.detune / 100 + 0.15 * m.width);
    L.briThick = clamp(0.3 + 0.5 * (1 - m.brightness));
    L.beads = m.chorus > 0.15 ? clamp(0.4 + m.chorus * 1.5) : 0;
    if (wide && m.detune >= 45) { L.spk = Math.max(L.spk, 26); L.spkLen = clamp(0.8 + m.detune / 100, 0, 1.6); L.antenna = 1; L.spkSoft = 1; }
    L.lobes = clamp((m.weight - 0.55) * 2 + (m.sub > 0.3 ? 0.3 : 0));
    L.coral = clamp((m.noise * 2 + m.wildness * 0.4 - 0.15) * (m.roughness > 0.3 ? 1 : 0.6));
    L.bubbly = clamp(m.space * 0.8 - 0.2 + (m.fam.cluster ? 0.3 : 0));
    L.pastel = m.sweetness > 0.7 && m.roughness < 0.2 ? clamp((m.sweetness - 0.7) * 3) : 0;
    L.sockets = L.spk > 20 && m.hardness > 0.8 && m.roughness > 0.3 ? 0.8 : 0;
    // COLOUR: register = hue, rough = dark, sweet = candy
    const hue = lerp(190, 380, m.weight) + (m.seed - 0.5) * 60;   // high = icy cyan, through blue, violet and magenta, to warm coral at the bottom
    const sat = clamp(0.2 + 0.75 * m.sweetness - 0.25 * m.roughness);
    const lig = clamp(0.66 - 0.32 * m.roughness + 0.08 * m.brightness, 0.22, 0.8);
    L.c1 = hsl(hue, sat, lig);
    L.c2 = hsl(hue + (m.sweetness > 0.5 ? 70 : 35) * (m.seed > 0.5 ? 1 : -1), sat * 0.9 + 0.05, lig * (m.oscB ? 0.95 : 1.05));
    L.marble = clamp(0.25 + 0.6 * m.oscB + 0.2 * m.movement);
    L.dark = clamp(m.roughness * 0.55 - 0.1);
    L.iri = clamp(m.chorus * 1.2 + (f === "ribbons" ? 0.7 : 0) + (f === "crystal" ? 0.4 : 0));
    L.lampCol = hsl(hue + 25, 0.85, 0.7);
    // DETAIL (renders v3): light through the body, skin wrinkles, tip colour, an inner core
    L.trans = clamp(0.25 + 0.45 * (1 - m.hardness) + 0.3 * m.space);
    L.bump = clamp(0.08 + 0.7 * m.roughness + 0.6 * m.noise);
    L.bumpSize = clamp(0.5 + 0.4 * m.wildness);
    L.tipCol = m.drive > 0.15 ? hsl(12 + 20 * m.seed, 0.95, 0.6) : hsl(hue + (m.sweetness > 0.5 ? 80 : 40), clamp(sat + 0.15), clamp(lig + 0.12));
    L.tipMix = clamp(0.35 + 0.5 * m.brightness + m.drive);
    L.egg = f === "tear" ? 0.35 + 0.4 * m.brightness : 0;
    L.tear *= f === "tear" ? 0.4 : 1;
    L.core = clamp(m.sub * 0.9 + (m.oscB ? 0.25 : 0));
    L.coreCol = hsl(hue - 40, 0.75, 0.45);
    L.beadCol = hsl(hue + 150, clamp(sat + 0.2), clamp(lig + 0.05));
    // MOTION: how it moves on its own and when played
    L.speed = 0.3 + m.movement * 2 + m.lfoRate * 0.1;
    L.wobble = clamp(1 - m.hardness * 0.85);   // slow attack = jelly that swells, fast = stone
    return { look: L, m };
  }

  // a few plain words for the card under the blob
  function words(m) {
    const w = [];
    w.push({ tear: "saw", cube: "square", sphere: "sine", cluster: "organ", crystal: "bell / FM", petals: "vocal", ribbons: "growl", voxel: "digital" }[m.family]);
    w.push(m.brightness > 0.62 ? "bright" : m.brightness < 0.33 ? "dark" : "mellow");
    if (m.roughness > 0.5) w.push("rough"); else if (m.sweetness > 0.55) w.push("sweet");
    if (m.voices >= 5) w.push("wide");
    if (m.hardness < 0.4) w.push("soft attack"); else if (m.hardness > 0.85) w.push("hard attack");
    if (m.movement > 0.4) w.push("moving");
    return w.filter(Boolean);
  }

  // the empty blob: a plain saw (an empty TOY MACHINE preset is a plain saw)
  const INIT = { format: "toymachine/1", name: "Plain saw", category: "Synths", oscA: { on: true, wave: "saw" }, filter: { on: true, type: "lp24", cutoff: 4500, res: 0.1 }, ampEnv: { a: 0.004, d: 0.3, s: 0.8, r: 0.25 } };

  // slide every number of a look toward another (preset changes melt, they don't jump)
  function blend(a, b, k) {
    const o = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[key], y = b[key];
      if (typeof x === "string" || typeof y === "string") o[key] = mixHex(x || y, y || x, k);
      else { const a1 = num(x, 0), b1 = num(y, 0); o[key] = Math.abs(b1 - a1) < 1e-3 ? b1 : lerp(a1, b1, k); }   // lands exactly, so 'off' really turns off
    }
    return o;
  }
  function mixHex(a, b, k) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return "#" + x.map((v, i) => { let c = Math.round(lerp(v, y[i], k)); if (c === v && v !== y[i]) c += Math.sign(y[i] - v); return c.toString(16).padStart(2, "0"); }).join("");
  }

  return { measure, lookOf, words, blend, INIT, hsl };
})();
