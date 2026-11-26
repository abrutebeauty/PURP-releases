/* TOY MACHINE: the synth window (UI only). KILLTOY's own synth, laid out like
   Minimal Audio "Current": a live landscape disc with draggable circles that move the
   macros, a source stack, a pill keyboard, plus normal Engine / Effects pages and a
   preset browser. Plain JS, no build step, no libraries. Everything is scoped under
   .tm- classes. The audio engine lives elsewhere and is reached only through `api`.

   window.ToyMachineUI = { open(host, opts), withDefaults(p), applyMacros(p) }
   Preset format: /mnt/project-files/toy-machine/PRESET-FORMAT.md
   ASCII only. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- helpers
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = (n) => NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(cls, html, title) {
    const b = el("button", cls);
    b.type = "button";
    if (html) b.innerHTML = html;
    if (title) b.title = title;
    return b;
  }

  const SV = (body, extra = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
  const ICON = {
    play: SV('<circle cx="12" cy="12" r="9"/><circle cx="14.5" cy="9.5" r="1.6" fill="currentColor"/><circle cx="9" cy="14" r="1" fill="currentColor"/>'),
    engine: SV('<path d="M3 16h4V8h6v8h4V8h4"/>'),
    effects: SV('<path d="M6 4v16M12 4v16M18 4v16"/><circle cx="6" cy="14" r="2" fill="currentColor"/><circle cx="12" cy="8" r="2" fill="currentColor"/><circle cx="18" cy="15" r="2" fill="currentColor"/>'),
    left: SV('<path d="M15 5l-7 7 7 7"/>'),
    right: SV('<path d="M9 5l7 7-7 7"/>'),
    save: SV('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
    close: SV('<path d="M6 6l12 12M18 6L6 18"/>'),
    heart: SV('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"/>'),
    shuffle: SV('<path d="M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.6 0 2.8-1.2 3.9-2.8M13.6 9.8C14.7 8.2 15.9 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/>'),
    power: SV('<path d="M12 4v7"/><path d="M7.5 7.2a6.5 6.5 0 1 0 9 0"/>'),
    sine: SV('<path d="M2 12c2.5-7 5.5-7 8 0s5.5 7 8 0 3-3 4-3"/>'),
    square: SV('<path d="M3 16V8h7v8h7V8h4"/>'),
    grains: SV('<circle cx="6" cy="8" r="1.3" fill="currentColor"/><circle cx="12" cy="6" r="1.6" fill="currentColor"/><circle cx="17" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1.6" fill="currentColor"/><circle cx="7" cy="18" r="1.3" fill="currentColor"/><circle cx="18" cy="18" r="1" fill="currentColor"/>'),
    tape: SV('<rect x="3" y="6" width="18" height="12"/><circle cx="8.5" cy="12" r="2.2"/><circle cx="15.5" cy="12" r="2.2"/><path d="M8.5 14.2h7"/>'),
    sub: SV('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>'),
    sampler: SV('<path d="M4 9v6M7 6v12M10 10v4M13 4v16M16 8v8M19 11v2"/>'),
    plus: SV('<path d="M12 5v14M5 12h14"/>'),
    look: SV('<circle cx="12" cy="12" r="8.5"/><path d="M5 15c3-1 4-5 7-5s4 4 7 3"/>'),
    grip: SV('<circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/>'),
    search: SV('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
    layers: SV('<path d="M3 8c2.5-2.5 4.5 2.5 7 0s4.5 2.5 7 0 2.5-1 4 0"/><path d="M3 13c2.5-2.5 4.5 2.5 7 0s4.5 2.5 7 0 2.5-1 4 0" opacity=".7"/><path d="M3 18c2.5-2.5 4.5 2.5 7 0s4.5 2.5 7 0 2.5-1 4 0" opacity=".4"/>'),
    drop: SV('<circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8" stroke-dasharray="2.5 3"/><circle cx="5" cy="6" r="1.5" fill="currentColor"/><circle cx="19" cy="17" r="1.5" fill="currentColor"/>'),
    arp: SV('<path d="M3 19h4v-4h4v-4h4V7h4V3"/><circle cx="5" cy="19" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/><circle cx="13" cy="11" r="1.3" fill="currentColor"/><circle cx="17" cy="7" r="1.3" fill="currentColor"/>'),
    star: SV('<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16.2 7 18.9l1.2-5.5L4 9.6l5.6-.6z"/>'),
  };

  // ---------------------------------------------------------------- point kinds (the landscape forces)
  const ARP_RATES = ["1/4", "1/8", "1/8t", "1/16", "1/16t", "1/32"];
  const ARP_HZ = [2, 4, 6, 8, 12, 16]; // at 120 bpm, for the picture only
  const ARP_PATTERNS = ["up", "up/down", "oct jumps", "random"];
  const DRIVE_CHAR = ["soft", "tube", "fold", "rectify"];
  const GATE_RATES = ["1/4", "1/8", "1/16", "1/32"];
  const pctS = (v) => Math.round(v * 100) + "%";
  const arpRate = (x) => (x < 0.1 ? -1 : Math.min(5, Math.floor(((x - 0.1) / 0.9) * 6)));
  const KINDS = {
    macro: { label: "Macro", color: "#f4f4f6", glyph: "M", desc: "Moves two macros" },
    clip: { label: "Clip", color: "#ff3b4e", glyph: "CLIP", desc: "Push into the SC Clip clipper. Up = harder wall", drop: [0.45, 0.6],
      read: (x, y) => [x < 0.01 ? "off" : "+" + Math.round(x * 36) + " dB", (y < 0.5 ? "soft " : "hard ") + pctS(y)] },
    drive: { label: "Drive", color: "#ff8a2a", glyph: "DRV", desc: "Drive amount. Up = soft, tube, fold, rectify", drop: [0.4, 0.3],
      read: (x, y) => [x < 0.01 ? "off" : "+" + Math.round(x * 30) + " dB", DRIVE_CHAR[Math.min(3, Math.floor(y * 4))]] },
    analog: { label: "Analog", color: "#f2c48d", glyph: "ANA", desc: "Drift (pitch wander) and tape warmth", drop: [0.4, 0.5],
      read: (x, y) => ["drift " + Math.round(x * 25) + " ct", "warm " + pctS(y)] },
    tape: { label: "Tape", color: "#e0925a", glyph: "TAPE", desc: "Tape recorder: wobble (right: wow and flutter, the pitch sways) and age (up: saturation, a duller top, hiss)", drop: [0.3, 0.25],
      read: (x, y) => [x < 0.01 ? "steady" : "wow \u00b1" + Math.round(x * 40) + " ct", y < 0.01 ? "new tape" : "age " + pctS(y)] },
    arp: { label: "Arp", color: "#38f5c2", glyph: "ARP", desc: "Arpeggiator rate and pattern", drop: [0.5, 0.2],
      read: (x, y) => { const r = arpRate(x); return [r < 0 ? "off" : ARP_RATES[r], ARP_PATTERNS[Math.min(3, Math.floor(y * 4))]]; } },
    filter: { label: "Filter", color: "#4fb2ff", glyph: "FLT", desc: "Cutoff and resonance around the preset (centre = no change)", drop: [0.5, 0.5],
      read: (x, y) => [((x - 0.5) * 8 >= 0 ? "+" : "") + ((x - 0.5) * 8).toFixed(1) + " oct", "res " + ((y - 0.5) >= 0 ? "+" : "") + Math.round((y - 0.5) * 100) + "%"] },
    motion: { label: "Motion", color: "#b88cff", glyph: "MOV", desc: "Wobble rate and depth", drop: [0.35, 0.45],
      read: (x, y) => { const hz = 0.1 * Math.pow(160, x); return [(hz < 10 ? hz.toFixed(1) : Math.round(hz)) + " Hz", "depth " + pctS(y)]; } },
    space: { label: "Space", color: "#9fe3ff", glyph: "SPC", desc: "Reverb (right) and echo (up)", drop: [0.45, 0.35],
      read: (x, y) => ["verb " + pctS(x), "echo " + pctS(y)] },
    crush: { label: "Crush", color: "#e4ff3a", glyph: "BIT", desc: "Bit depth (right) and sample rate (up)", drop: [0.35, 0.3],
      read: (x, y) => [x < 0.01 ? "off" : Math.round(16 - 13 * x) + " bit", y < 0.01 ? "44.1 kHz" : fmt.hz(44100 * Math.pow(1500 / 44100, y))] },
    gate: { label: "Gate", color: "#ff5ad1", glyph: "GATE", desc: "Trance gate rate and depth", drop: [0.4, 0.55],
      read: (x, y) => [GATE_RATES[Math.min(3, Math.floor(x * 4))], "depth " + pctS(y)] },
  };
  // Each sound starts with its core points ON: 3 force points that suit it (picked per preset by
  // listening through the library, and by category for the rest) plus one macro point. The other
  // points stay on the ring greyed out with no centre dot, until a click turns them on.
  // Tape is core only on muffled / lo-fi / ambient / sad sounds.
  const CORE_RULE = { bass: ["filter", "drive", "clip"], leads: ["filter", "drive", "space"], plucks: ["filter", "space", "tape"], pads: ["space", "motion", "tape"],
                      keys: ["space", "tape", "filter"], arps: ["arp", "filter", "space"], fx: ["space", "motion", "crush"], synths: ["filter", "space", "motion"] };
  const CORE_NO_TAPE = { plucks: "motion", pads: "filter", keys: "motion" }; // what replaces Tape on a sound without the tape vibe
  const CORE_TAPE_VIBE = /lo-?fi|ambient|ambiant|sad|muffled|snow|dust|tape|cassette|vintage|vhs|haze|dream|lonely/i;
  // Presets whose core differs from their category's ("Category/Name": "kind kind kind").
  const CORE_PRESET = {"Bass/Aware":"filter clip motion","Bass/Beer":"filter clip motion","Bass/Deep":"filter clip motion","Bass/Edge rousing":"filter clip motion","Bass/Electric Pickup nice":"filter clip motion","Bass/Free":"filter clip motion","Bass/FutureBreacks 9":"filter clip motion","Bass/Guitar Ransom":"filter clip motion","Bass/Sub fly":"filter clip motion","Bass/Swipe":"filter clip motion","Bass/Uht wob":"filter clip motion","Bass/Villa":"filter clip motion","Bass/Whale Sub":"filter clip motion","Keys/Afterlife":"space tape drive","Keys/Boederline":"space motion filter","Keys/Bright":"space motion filter","Keys/Cave":"space motion filter","Keys/Chord humanized":"space motion filter","Keys/Dakar":"space motion filter","Keys/Demon fight":"space motion drive","Keys/Electric piano Keys":"space motion filter","Keys/Faith":"space motion filter","Keys/Glide":"space motion filter","Keys/Good gracious":"space motion filter","Keys/Jennifer":"space motion drive","Keys/Keypad":"space motion filter","Keys/Lofi sinusoid":"space tape drive","Keys/Magic":"space motion filter","Keys/Melancholy":"space motion drive","Keys/Mouse":"space motion filter","Keys/Organism":"space motion drive","Keys/OrgansVibes 1":"space motion filter","Keys/Piano":"space motion filter","Keys/SO FS1 Keys - Electric Piano":"space motion filter","Keys/Shine":"space motion filter","Keys/Soft":"space motion filter","Keys/Sparkly":"space motion drive","Keys/Squared uplifting":"space motion drive","Keys/Squarevelous":"space motion drive","Keys/Supersaw detuned":"space motion filter","Keys/Thugg":"space motion drive","Keys/Tragedy":"space motion filter","Keys/Tranquil":"space motion filter","Keys/Wallet sine":"space motion filter","Keys/Weave":"space motion filter","Leads/Ambient sine":"filter motion space","Leads/Analogue Tech":"filter motion space","Leads/Bee":"filter motion space","Leads/Boss":"filter motion space","Leads/Clouds":"filter motion space","Leads/Comfort":"filter motion space","Leads/Cream":"filter motion space","Leads/Famous":"filter motion space","Leads/Fly":"filter motion space","Leads/LD_sine_arp [Spinnin]":"filter motion arp","Leads/Luwi":"filter motion space","Leads/Okla":"filter motion space","Leads/Race":"filter motion space","Leads/Sine whistle":"filter motion space","Leads/Soft Focus":"filter motion space","Leads/Strings necklace":"filter motion space","Leads/Surrender fat":"filter motion space","Leads/Talkbox voxy":"filter motion space","Leads/Vitamin":"filter motion space","Leads/WARPING KEYS":"filter motion space","Pads/Ambiant Lonely":"space motion arp","Pads/Chord":"space motion arp","Pads/Deep":"space motion filter","Pads/Ghosts":"space motion filter","Pads/Monoish Darkwave Pad":"space motion filter","Pads/Mouse":"space motion filter","Pads/Night":"space motion filter","Pads/Pad beautiful serum":"space motion filter","Pads/Prophet":"space motion filter","Pads/Road":"space motion filter","Pads/Water":"space motion filter","Pads/Without you":"space motion filter","Plucks/ChildishArp":"filter space arp","Plucks/Cozy":"filter space motion","Plucks/Dwntmploungev1 plck martini":"filter space arp","Plucks/Festival":"filter space motion","Plucks/Grid":"filter space motion","Plucks/Home":"filter space arp","Plucks/Just me":"filter space drive","Plucks/Kimono":"filter space arp","Plucks/Loop Arp Pluck Serum 02":"filter space arp","Plucks/Prince":"filter space motion","Plucks/Progressive 2":"filter space motion","Plucks/Square":"filter space motion","Plucks/Tornado":"filter space drive","Plucks/Zomby":"filter space motion","Arps/Arp 2":"arp filter drive","Bass/2Hollis":"filter clip motion","Bass/Acid":"filter clip motion","Bass/Atmo":"filter clip motion","Bass/Castles":"filter clip motion","Bass/Hardreese":"filter clip motion","Bass/House 2":"filter clip motion","Bass/House":"filter clip motion","Bass/Mini":"filter clip motion","Bass/Random":"filter clip motion","Bass/Simplereese":"filter clip motion","FX/Digitalstars":"space motion drive","Keys/Dark Rave":"space motion filter","Leads/8Bit":"filter motion space","Leads/Dust":"filter motion space","Leads/Electra":"filter motion space","Leads/Night":"filter motion space","Leads/Square":"filter motion space","Leads/Swell":"filter motion space","Leads/Voxlead 1":"filter motion space","Leads/Voxlead 2":"filter motion space","Leads/Voxlead 3":"filter motion space","Leads/Voxlead 4":"filter motion space","Leads/Voxlead 5":"filter motion space","Leads/Woooo":"filter motion space","Pads/Angels 2":"space motion filter","Plucks/Beyond":"filter space motion","Plucks/Ember":"filter space motion","Plucks/Hide":"filter space motion","Synths/Witch 2":"filter space drive","Bass/Cold Room Bass":"filter tape clip","Bass/Deep Fog Bass":"filter tape clip","Bass/Grey Sub":"filter tape clip","Bass/Hush Bass":"filter tape clip","Bass/Lake Bottom":"filter tape clip","Bass/Night Drive Bass":"filter tape clip","Bass/Slow Heart":"filter tape clip","Bass/Snow Sub":"filter tape clip","Bass/Soft Weight":"filter tape clip","Bass/Under Ice":"filter tape clip","Bass/Velvet Low":"filter tape clip","Pads/Glacier Air":"space motion drive","Pads/Low Clouds":"space motion drive","Pads/Night Bus":"space motion drive","Pads/Soft Static":"space motion drive","Pads/Tape Dream":"space motion drive","Plucks/Old Polaroid":"filter space drive","Plucks/Wet Ink":"filter space drive"};
  const NEUTRAL_POS = { clip: [0, 0.5], drive: [0, 0.3], analog: [0, 0], tape: [0, 0], arp: [0, 0.2], filter: [0.5, 0.5], motion: [0.35, 0], space: [0, 0], crush: [0, 0], gate: [0.4, 0] };
  const CORE_VERSION = 2;
  function padIsSilent(q) {
    const [x, y] = Array.isArray(q.pos) ? q.pos.map(Number) : [0, 0.5];
    switch (q.kind) {
      case "clip": case "drive": case "crush": return x < 0.01;
      case "motion": case "gate": return y < 0.01;
      case "arp": return x < 0.1;
      case "filter": return Math.abs(x - 0.5) < 0.01 && Math.abs(y - 0.5) < 0.01;
      case "tape": case "analog": case "space": return x < 0.01 && y < 0.01;
      default: return false;
    }
  }
  function coreKinds(p) {
    const cat = /808/.test(p.name || "") ? "bass" : String(p.category || "").toLowerCase();
    const rule = CORE_RULE[cat];
    if (!rule) return null;
    const own = CORE_PRESET[(p.category || "") + "/" + (p.name || "")];
    if (own) return { on: own.split(" "), offer: rule };
    const vibe = CORE_TAPE_VIBE.test([p.name, (p.tags || []).join(" "), p.genre].join(" "));
    return { on: rule.map((k) => (k === "tape" && !vibe ? CORE_NO_TAPE[cat] : k)), offer: rule };
  }
  // Which macro point stays on: the one whose macros do the least of what the core points do.
  const MACRO_DOES = [[/space|echo|room|verb|delay|wet/i, "space"], [/move|wobble|vibrato|lfo|mod/i, "motion"], [/bright|tone|cutoff|filter|open|reso/i, "filter"],
                      [/grit|dirt|drive|fold|distort|sat/i, "drive"], [/crush|bit/i, "crush"]];
  // The red explosion point (SC CLIP) is on every sound (Eman, 27 Oct): added where it's missing, never
  // left switched off. It rests at no clipping, so it only changes the sound once it's dragged.
  function ensureClipPoint(p) {
    if (!p || typeof p !== "object") return false;
    if (!Array.isArray(p.pads) || !p.pads.length) p.pads = clone(DEFAULTS.pads);
    const has = p.pads.find((q) => q && q.kind === "clip");
    if (has) { if (!has.off) return false; delete has.off; return true; }
    const pt = { kind: "clip", pos: NEUTRAL_POS.clip.slice(), core: true };
    if (p.pads.length >= MAX_PADS) { // full ring: it takes the place of a point that is off and silent
      const k = p.pads.findIndex((q) => q && q.kind !== "macro" && q.off && padIsSilent(q));
      if (k < 0) return false;
      p.pads[k] = pt;
    } else p.pads.push(pt);
    return true;
  }
  function addCorePoints(p) { const a = addCorePoints0(p), b = ensureClipPoint(p); return a || b; }
  function addCorePoints0(p) {
    if (!p || typeof p !== "object" || p.coreV === CORE_VERSION) return false;
    const ck = coreKinds(p);
    if (!ck) return false;
    p.coreV = CORE_VERSION; delete p.coreDone;
    let pads = Array.isArray(p.pads) ? p.pads : (p.pads = [{ kind: "macro", x: 0, y: 1 }, { kind: "macro", x: 2, y: 3 }]);
    // points that aren't core and do nothing where they sit go; one that shapes the sound stays (off)
    pads = p.pads = pads.filter((q) => q.kind === "macro" || ck.on.includes(q.kind) || ck.offer.includes(q.kind) || !padIsSilent(q));
    for (const kind of ck.on.concat(ck.offer)) {
      if (pads.length >= MAX_PADS) break;
      if (!pads.some((q) => q.kind === kind)) pads.push({ kind, pos: NEUTRAL_POS[kind].slice(), core: true });
    }
    const macros = Array.isArray(p.macros) ? p.macros : [];
    const overlap = (q) => [q.x, q.y].reduce((n, i) => { const nm = (macros[i] && macros[i].name) || ""; return n + (MACRO_DOES.some(([re, k]) => re.test(nm) && ck.on.includes(k)) ? 1 : 0); }, 0);
    const mpads = pads.filter((q) => q.kind === "macro");
    const keep = mpads.reduce((best, q) => (best == null || overlap(q) < overlap(best) ? q : best), null);
    for (const q of pads) {
      const on = q.kind === "macro" ? q === keep : ck.on.includes(q.kind);
      if (on) delete q.off; else q.off = true;
    }
    return true;
  }
  const KIND_ORDER = ["macro", "clip", "drive", "analog", "tape", "arp", "filter", "motion", "space", "crush", "gate"];
  const KIND_ICON = {
    macro: SV('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'),
    clip: SV('<path d="M3 15c2-1 3-7 5-7h8c2 0 3 6 5 7" /><path d="M6 8h12" stroke-dasharray="2 2"/>'),
    drive: SV('<path d="M3 14c3 0 3-6 6-6s3 8 6 8 3-6 6-6"/>'),
    analog: SV('<rect x="4" y="7" width="16" height="10" rx="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>'),
    tape: SV('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="11" r="2.3"/><circle cx="15.5" cy="11" r="2.3"/><path d="M8.5 13.3h7M7 18l1.5-2.5h7L17 18"/>'),
    arp: SV('<path d="M4 18h3v-3h3v-3h3V9h3V6h3"/>'),
    filter: SV('<path d="M3 9h8c3 0 4 1 5 3s2 6 5 6"/>'),
    motion: SV('<path d="M3 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/>'),
    space: SV('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5" opacity=".6"/><circle cx="12" cy="12" r="10" opacity=".3"/>'),
    crush: SV('<path d="M3 17h4v-4h4V9h4V6h3v4h3"/>'),
    gate: SV('<path d="M3 16V8h3v8h3V8h3v8h3V8h3v8h3"/>'),
  };

  // ---------------------------------------------------------------- preset defaults
  const OSC_DEF = (on) => ({
    on, wave: "basic", pos: 0, oct: 0, semi: 0, fine: 0, level: 0.8, pan: 0,
    unison: { voices: 1, detune: 0, spread: 0, blend: 1 },
    warp: { type: "none", amount: 0 }, phase: 0, randomPhase: 1, filter: true,
  });
  const ENV = (a, d, s, r) => ({ a, d, s, r, curve: 0.5, aCurve: 0 });
  const LFO_DEF = () => ({ shape: "sine", rate: 1, sync: null, retrig: false, phase: 0 });
  const MACRO_DEF = (i) => ({ name: "Macro " + (i + 1), value: 0, targets: [] });
  const TARGET_DEF = { param: "filter.cutoff", from: 0, to: 1, curve: 1 };
  const MOD_DEF = { src: "lfo1", dst: "filter.cutoff", amt: 0 };
  const PEAK_DEF = { f: 1000, q: 1, db: 0 };
  const DEFAULTS = {
    format: "toymachine/1", name: "Init", genre: "Electronic", category: "Synths", tags: [],
    voice: { mode: "poly", glide: 0, polyphony: 8, bend: 2, velocity: 0.7 },
    oscA: OSC_DEF(true), oscB: OSC_DEF(false),
    sub: { on: false, shape: "sine", oct: -1, level: 0.5, filter: false },
    noise: { on: false, color: 0, grain: 0, pitch: 0, level: 0.3, filter: true, type: "grains" },
    drift: { on: false, amount: 0.25, type: "drift" },
    sampler: { on: false, file: null, root: 60, loop: false, start: 0, end: 1, level: 0.7, filter: true },
    filter: { on: true, type: "lp24", cutoff: 20000, res: 0.1, drive: 0, keytrack: 0, env: 0, vel: 0 },
    ampEnv: ENV(0.003, 0.1, 1, 0.08), filterEnv: ENV(0.001, 0.3, 0, 0.2), modEnv: ENV(0, 0.5, 0, 0.2),
    lfo1: LFO_DEF(), lfo2: LFO_DEF(),
    mods: [], fx: [],
    out: { level: 0, width: 1, pan: 0 },
    macros: [0, 1, 2, 3].map(MACRO_DEF),
    pads: [{ x: 0, y: 1 }, { x: 2, y: 3 }],
    look: { style: "liquid", hue: 275, hue2: 70, seed: 1 },
  };
  const FX_DEFAULTS = {
    drive: { mode: "soft", amount: 0, tone: 0.5, mix: 1 },
    crush: { bits: 16, rate: 44100, mix: 1 },
    chorus: { rate: 0.8, depth: 0.5, mix: 0.3, voices: 1 },
    phaser: { rate: 0.3, depth: 0.6, feedback: 0.4, mix: 0.5 },
    delay: { time: 0.375, sync: null, feedback: 0.35, mix: 0.2, pingpong: false, tone: 0.5 },
    reverb: { size: 0.5, decay: 2.0, damp: 0.5, predelay: 0.01, mix: 0.2, mod: 0 },
    ott: { depth: 0.5, time: 0.5, up: 1, down: 1 },
    comp: { threshold: -18, ratio: 4, attack: 0.005, release: 0.1, makeup: 0 },
    eq: { low: 0, lowFreq: 120, high: 0, highFreq: 6000, peaks: [] },
    width: { amount: 1, bassMono: 0 },
    clip: { drive: 0, shape: 40, ceiling: -1 },
    texture: { mode: "cloud", size: 0.12, density: 20, pitch: 0, spray: 0.3, position: 0.5, shape: 0.5, reverse: 0, pitchRandom: 0, spread: 0.5, freeze: false, feedback: 0.2, tone: 0.5, drive: 0, space: 0.3, mix: 0.4 },
  };
  const FX_NAMES = { drive: "Drive", crush: "Crush", chorus: "Chorus", phaser: "Phaser", delay: "Delay", reverb: "Reverb", ott: "OTT", comp: "Compressor", eq: "EQ", width: "Width", clip: "SC Clip", texture: "Texture" };
  // Texture: the engine starts from the mode's own settings; fields written in the preset override them.
  const TEX_MODE_VALUES = {"shimmer":{"size":0.18,"density":24,"pitch":12,"pitchRandom":7,"position":0.01,"spray":0.02,"shape":0,"reverse":0,"spread":0.8,"feedback":0.35,"tone":0.6,"drive":0,"space":0.7,"mix":0.5},"stutter":{"size":0.09,"density":8,"pitch":0,"pitchRandom":0,"position":0,"spray":0,"shape":0.55,"reverse":0,"spread":0.2,"feedback":0,"tone":0.5,"drive":3.6,"space":0.05,"mix":0.5},"cloud":{"size":0.35,"density":40,"pitch":0,"pitchRandom":0.15,"position":0.067,"spray":0.3,"shape":0,"reverse":0,"spread":1,"feedback":0.2,"tone":0.375,"drive":0,"space":0.5,"mix":0.5},"reverseBloom":{"size":0.3,"density":14,"pitch":0,"pitchRandom":0.08,"position":0.05,"spray":0.1,"shape":0,"reverse":1,"spread":0.7,"feedback":0.3,"tone":0.5,"drive":0,"space":0.55,"mix":0.5},"glitchSpray":{"size":0.04,"density":30,"pitch":0,"pitchRandom":7,"position":0.017,"spray":0.45,"shape":0.75,"reverse":0.35,"spread":1,"feedback":0.1,"tone":0.55,"drive":6,"space":0.1,"mix":0.5},"octaveRumble":{"size":0.22,"density":22,"pitch":-12,"pitchRandom":0,"position":0,"spray":0.015,"shape":0,"reverse":0,"spread":0.3,"feedback":0.15,"tone":0.3,"drive":8.4,"space":0.2,"mix":0.5},"freezePad":{"size":0.4,"density":30,"pitch":0,"pitchRandom":0.06,"position":0.083,"spray":0.2,"shape":0,"reverse":0,"spread":1,"feedback":0,"tone":0.45,"drive":0,"space":0.6,"mix":0.5},"crushedGrains":{"size":0.07,"density":35,"pitch":0,"pitchRandom":0,"position":0,"spray":0.06,"shape":1,"reverse":0.2,"spread":0.6,"feedback":0.25,"tone":0.65,"drive":19.2,"space":0.1,"mix":0.5}};
  const texModeDefaults = (mode) => Object.assign({}, FX_DEFAULTS.texture, TEX_MODE_VALUES[mode] || TEX_MODE_VALUES.cloud, { mode: TEX_MODE_VALUES[mode] ? mode : "cloud" });
  // The Grains row's types and the Tape row's characters (engine: GrainType / DriftType in TmParams.h).
  // window.KT2_TM_TAPE_OFF = the old side stack (Osc A and Osc B apart, Grains opens the Engine page, no Tape row).
  // Whispers (Eman 10 Nov): a looping bed of almost inaudible, strange synthesised voices
  // (Source/dsp/toymachine/TmWhispers.h). window.KT2_TM_WHISPERS_OFF = the menu without it.
  const GRAIN_TYPES = [["grains", "Grains"], ["morph", "Morph"], ["pixel", "Pixel"], ["fuzz", "Fuzz"], ["shred", "Shred"], ["rip", "Rip"]]
    .concat(typeof window !== "undefined" && window.KT2_TM_WHISPERS_OFF ? [] : [["whispers", "Whispers"]]);
  const GRAIN_KNOBS = { grains: ["Color", "Grain", "Pitch"], morph: ["Drive", "Speed", "Depth"], pixel: ["Drive", "Bits", "Rate"], fuzz: ["Drive", "Rasp", "Bias"], shred: ["Drive", "Chop", "Flip"], rip: ["Drive", "Wobble", "Ratio"], whispers: ["Voice", "Loop", "Weird"] };
  const TAPE_TYPES_OLD = [["drift", "Drift"], ["cassette", "Cassette"], ["vinyl", "Warped Vinyl"], ["dual", "Dual Deck"], ["melt", "Melt"], ["warble", "Warble"]];
  // The default tape style is called "Tape" in the menu, so the row reads "Tape" until you pick
  // another style, then shows that style's name (Eman 10 Nov). window.KT2_TM_TAPE_NAME_OLD = "Drift".
  const tapeTypes = () => (typeof window !== "undefined" && window.KT2_TM_TAPE_NAME_OLD) ? TAPE_TYPES_OLD
    : [["drift", "Tape"]].concat(TAPE_TYPES_OLD.slice(1));
  const tapeSide = () => !(typeof window !== "undefined" && window.KT2_TM_TAPE_OFF);
  const TEX_MODES = [["shimmer", "Shimmer"], ["stutter", "Stutter"], ["cloud", "Cloud"], ["reverseBloom", "Reverse Bloom"], ["glitchSpray", "Glitch Spray"], ["octaveRumble", "Octave Rumble"], ["freezePad", "Freeze Pad"], ["crushedGrains", "Crushed Grains"]];
  const FX_TYPES = Object.keys(FX_DEFAULTS);
  const MAX_FX = 8, MAX_MACROS = 16;   // 8 until 11 Nov; CREATE SOUND word balls use 2 each
  const CATEGORIES = ["Bass", "Synths", "Leads", "Plucks", "Pads", "Keys", "Arps", "FX"];
  const WAVES = ["basic", "saw", "square", "triangle", "sine", "pwm", "harmonic", "vocal", "metal", "digital", "organ", "hollow", "growl",
    "warm", "sinefold", "fmbell", "formant", "chip", "acid", "comb"];
  const SYNCS = ["4/1", "2/1", "1/1", "1/2", "1/4", "1/8", "1/16", "1/32"];
  const SYNC_OPTS = [[null, "Free"]].concat(...SYNCS.map((s) => [[s, s], [s + "d", s + " dot"], [s + "t", s + " trip"]]));
  const MOD_SRCS = ["lfo1", "lfo2", "filterEnv", "modEnv", "ampEnv", "velocity", "note", "modwheel", "aftertouch", "random"];
  const MOD_SRC_NAMES = { lfo1: "LFO 1", lfo2: "LFO 2", filterEnv: "Filter env", modEnv: "Mod env", ampEnv: "Amp env", velocity: "Velocity", note: "Note", modwheel: "Mod wheel", aftertouch: "Aftertouch", random: "Random" };
  const MOD_DSTS = ["pitch", "oscA.pitch", "oscB.pitch", "oscA.pos", "oscB.pos", "oscA.level", "oscB.level", "sub.level", "noise.level", "sampler.level", "oscA.pan", "oscB.pan", "oscA.warp", "oscB.warp", "oscA.detune", "oscB.detune", "filter.cutoff", "filter.res", "amp", "pan"];
  const DST_NAMES = { pitch: "Pitch", amp: "Amp", pan: "Pan", "filter.cutoff": "Cutoff", "filter.res": "Resonance" };
  const dstName = (d) => DST_NAMES[d] || d.replace("oscA.", "Osc A ").replace("oscB.", "Osc B ").replace("sub.", "Sub ").replace("noise.", "Grains ").replace("sampler.", "Sampler ");
  const STYLES = ["liquid", "dots", "waves", "chrome", "grain", "terrain"];

  function merge(def, val) {
    if (val === undefined || val === null && def !== null && isObj(def)) return clone(def);
    if (isObj(def)) {
      if (!isObj(val)) return clone(def);
      const out = {};
      for (const k in val) out[k] = clone(val[k]);
      for (const k in def) out[k] = merge(def[k], val[k]);
      return out;
    }
    if (typeof def === "number" && typeof val !== "number") return def;
    return clone(val);
  }
  const arr = (v) => (Array.isArray(v) ? v : []);
  const MAX_PADS = 8;
  function padWithDefaults(pd) {
    const kind = KINDS[pd.kind] ? pd.kind : "macro";
    if (kind === "macro") return Object.assign({}, pd, { kind, x: clamp(pd.x | 0, 0, MAX_MACROS - 1), y: clamp(pd.y | 0, 0, MAX_MACROS - 1) });
    const pos = Array.isArray(pd.pos) ? [clamp(+pd.pos[0] || 0), clamp(pd.pos[1] == null ? 0.5 : +pd.pos[1])] : [0, 0.5];
    return Object.assign({}, pd, { kind, pos });
  }

  function fxWithDefaults(f) {
    if (!isObj(f)) f = { type: "drive" };
    const base = Object.assign({ type: f.type, on: true }, clone(f.type === "texture" ? texModeDefaults(f.mode) : FX_DEFAULTS[f.type] || {}));
    const out = merge(base, f);
    if (f.type === "eq") out.peaks = arr(f.peaks).map((pk) => merge(PEAK_DEF, pk));
    return out;
  }

  /** A complete copy of a preset: every missing field filled from the format's defaults.
      The argument is not changed. */
  function withDefaults(p) {
    p = isObj(p) ? p : {};
    const out = merge(DEFAULTS, p);
    out.oscB = merge(OSC_DEF(false), p.oscB);
    out.fx = arr(p.fx).map(fxWithDefaults);
    out.mods = arr(p.mods).map((m) => merge(MOD_DEF, m));
    const macros = Array.isArray(p.macros) ? p.macros : DEFAULTS.macros;
    out.macros = macros.slice(0, MAX_MACROS).map((m, i) => {
      const mm = merge(MACRO_DEF(i), m);
      mm.targets = arr(isObj(m) ? m.targets : null).map((t) => merge(TARGET_DEF, t));
      mm.value = clamp(+mm.value || 0);
      return mm;
    });
    const pads = Array.isArray(p.pads) && p.pads.length ? p.pads : DEFAULTS.pads;
    out.pads = pads.filter(isObj).slice(0, MAX_PADS).map(padWithDefaults);
    if (!out.pads.length) out.pads = clone(DEFAULTS.pads).map(padWithDefaults);
    let need = 0;
    out.pads.forEach((pd) => { if (pd.kind === "macro") need = Math.max(need, pd.x + 1, pd.y + 1); });
    while (out.macros.length < need) out.macros.push(MACRO_DEF(out.macros.length));
    if (STYLES.indexOf(out.look.style) < 0) out.look.style = "liquid";
    return out;
  }

  // ---------------------------------------------------------------- paths and macros
  function parsePath(p) {
    if (Array.isArray(p)) return p;
    return String(p).split(".").map((k) => (/^\d+$/.test(k) ? +k : k));
  }
  function getIn(o, path) {
    for (const k of parsePath(path)) { if (o == null) return undefined; o = o[k]; }
    return o;
  }
  /** Sets root[path] = value, creating objects on the way. When `mirror` (the complete
      preset) is given, missing array items are copied from it, so indices stay aligned. */
  function setIn(root, path, value, mirror) {
    path = parsePath(path);
    let o = root, m = mirror;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      const mk = m != null ? m[k] : undefined;
      if (o[k] == null || typeof o[k] !== "object") o[k] = Array.isArray(mk) || typeof path[i + 1] === "number" ? [] : {};
      if (Array.isArray(o[k]) && typeof path[i + 1] === "number") {
        const a = o[k];
        while (a.length <= path[i + 1]) a.push(mk && mk[a.length] !== undefined ? clone(mk[a.length]) : {});
      }
      o = o[k];
      m = mk;
    }
    o[path[path.length - 1]] = value;
  }
  /** A macro target's `param` (dotted, with fx.<type> / fx.<i> / mod.<i>) to a real path. */
  function resolveParam(p, param) {
    const parts = parsePath(param);
    if (!parts.length) return null;
    if (parts[0] === "fx") {
      const fx = arr(p.fx);
      const i = typeof parts[1] === "number" ? parts[1] : fx.findIndex((f) => f && f.type === parts[1]);
      if (i < 0 || !fx[i]) return null;
      return ["fx", i].concat(parts.slice(2));
    }
    if (parts[0] === "mod" || parts[0] === "mods") {
      if (!arr(p.mods)[parts[1]]) return null;
      return ["mods", parts[1]].concat(parts.slice(2));
    }
    return parts;
  }
  const EXP_LAST = { cutoff: 1, rate: 1, time: 1, a: 1, d: 1, r: 1 };
  const INT_LAST = { voices: 1, oct: 1, semi: 1, bits: 1, polyphony: 1, bend: 1 };
  function isExpPath(path) {
    const last = String(path[path.length - 1]);
    return !!EXP_LAST[last] || (path[0] === "fx" && (/freq$/i.test(last) || (path[2] === "peaks" && last === "f")));
  }
  function targetValue(path, t, v) {
    const c = t.curve == null ? 1 : +t.curve;
    const x = Math.pow(clamp(+v || 0), c > 0 ? c : 1);
    const from = +t.from || 0, to = +t.to || 0;
    let out = isExpPath(path) && from > 0 && to > 0 ? from * Math.pow(to / from, x) : from + (to - from) * x;
    if (INT_LAST[path[path.length - 1]]) out = Math.round(out);
    return out;
  }
  function applyMacro(p, m, sink) {
    if (!m) return;
    for (const t of arr(m.targets)) {
      if (!t || !t.param) continue;
      const path = resolveParam(p, t.param);
      if (!path) continue;
      const val = targetValue(path, t, m.value || 0);
      setIn(p, path, val);
      if (sink) sink(path, val);
    }
  }
  /** Writes every macro's targets into the preset (in place) and returns it. */
  function applyMacros(p) {
    if (!p || !Array.isArray(p.macros)) return p;
    p.macros.forEach((m) => applyMacro(p, m));
    return p;
  }

  // ---------------------------------------------------------------- value formats and ranges
  const sgn = (v, eps) => (v > eps ? "+" : "");
  const fmt = {
    pct: (v) => Math.round(v * 100) + "%",
    bpct: (v) => sgn(v, 0.005) + Math.round(v * 100) + "%",
    hz: (v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + " kHz" : (v < 10 ? v.toFixed(2) : Math.round(v)) + " Hz"),
    s: (v) => (v < 1 ? (v < 0.01 ? (v * 1000).toFixed(1) : Math.round(v * 1000)) + " ms" : v.toFixed(2) + " s"),
    db: (v) => sgn(v, 0.05) + v.toFixed(1) + " dB",
    st: (v) => sgn(v, 0) + Math.round(v) + " st",
    stf: (v) => sgn(v, 0.005) + v.toFixed(1) + " st",
    ct: (v) => sgn(v, 0) + Math.round(v) + " ct",
    oct: (v) => sgn(v, 0) + Math.round(v) + " oct",
    octf: (v) => sgn(v, 0.005) + v.toFixed(2) + " oct",
    int: (v) => String(Math.round(v)),
    x2: (v) => v.toFixed(2),
    ratio: (v) => v.toFixed(1) + ":1",
    pan: (v) => (Math.abs(v) < 0.01 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100)),
    note: (v) => noteName(Math.round(v)),
    bits: (v) => Math.round(v) + " bit",
    voices: (v) => Math.round(v) + (Math.round(v) === 1 ? " voice" : " voices"),
  };
  const R = {
    pct: { min: 0, max: 1, fmt: fmt.pct },
    bip: { min: -1, max: 1, fmt: fmt.bpct, bi: true },
    pan: { min: -1, max: 1, fmt: fmt.pan, bi: true },
    hz: { min: 20, max: 20000, scale: "log", fmt: fmt.hz },
    env: { min: 0, max: 10, scale: "pow", fmt: fmt.s },
    lfo: { min: 0.01, max: 40, scale: "log", fmt: fmt.hz },
    octs: { min: -8, max: 8, fmt: fmt.octf, bi: true },
    dbIn: { min: 0, max: 36, fmt: fmt.db },
  };
  const META = [
    [/^filter\.cutoff$/, R.hz], [/^filter\.res$/, R.pct], [/^filter\.drive$/, R.dbIn], [/^filter\.(env|vel)$/, R.octs], [/^filter\.keytrack$/, R.pct],
    [/^osc[AB]\.pos$/, R.pct], [/^osc[AB]\.oct$/, { min: -3, max: 3, step: 1, fmt: fmt.oct, bi: true }],
    [/^osc[AB]\.semi$/, { min: -24, max: 24, step: 1, fmt: fmt.st, bi: true }], [/^osc[AB]\.fine$/, { min: -100, max: 100, fmt: fmt.ct, bi: true }],
    [/^osc[AB]\.pan$/, R.pan], [/^osc[AB]\.phase$/, R.pct], [/^osc[AB]\.randomPhase$/, R.pct],
    [/^osc[AB]\.unison\.voices$/, { min: 1, max: 16, step: 1, fmt: fmt.int }], [/^osc[AB]\.unison\.detune$/, { min: 0, max: 100, fmt: fmt.ct }],
    [/^osc[AB]\.unison\.(spread|blend)$/, R.pct], [/^osc[AB]\.warp\.amount$/, R.pct],
    [/^noise\.color$/, R.bip], [/^noise\.(grain|pitch)$/, R.pct],
    [/^sampler\.root$/, { min: 0, max: 127, step: 1, fmt: fmt.note }], [/^sampler\.(start|end)$/, R.pct],
    [/\.level$/, R.pct],
    [/Env\.[adr]$/, R.env], [/Env\.(s|curve|aCurve)$/, R.pct],
    [/^lfo\d\.rate$/, R.lfo], [/^lfo\d\.phase$/, R.pct],
    [/^voice\.glide$/, { min: 0, max: 2, scale: "pow", fmt: fmt.s }], [/^voice\.polyphony$/, { min: 1, max: 16, step: 1, fmt: fmt.int }],
    [/^voice\.bend$/, { min: 0, max: 24, step: 1, fmt: fmt.st }], [/^voice\.velocity$/, R.pct],
    [/^out\.width$/, { min: 0, max: 2, fmt: fmt.pct }],
  ];
  const OUT_LEVEL = { min: -36, max: 6, fmt: fmt.db };
  const FX_META = {
    drive: { amount: R.dbIn, tone: R.pct, mix: R.pct },
    crush: { bits: { min: 1, max: 16, step: 1, fmt: fmt.bits }, rate: { min: 500, max: 44100, scale: "log", fmt: fmt.hz }, mix: R.pct },
    chorus: { rate: { min: 0.05, max: 10, scale: "log", fmt: fmt.hz }, depth: R.pct, mix: R.pct, voices: { min: 1, max: 4, step: 1, fmt: fmt.int } },
    phaser: { rate: { min: 0.02, max: 10, scale: "log", fmt: fmt.hz }, depth: R.pct, feedback: { min: 0, max: 0.95, fmt: fmt.pct }, mix: R.pct },
    delay: { time: { min: 0.01, max: 2, scale: "log", fmt: fmt.s }, feedback: { min: 0, max: 0.98, fmt: fmt.pct }, mix: R.pct, tone: R.pct },
    reverb: { size: R.pct, decay: { min: 0.1, max: 20, scale: "log", fmt: fmt.s }, damp: R.pct, predelay: { min: 0, max: 0.25, fmt: fmt.s }, mix: R.pct, mod: R.pct },
    ott: { depth: R.pct, time: R.pct, up: R.pct, down: R.pct },
    comp: { threshold: { min: -60, max: 0, fmt: fmt.db }, ratio: { min: 1, max: 20, scale: "log", fmt: fmt.ratio }, attack: { min: 0.0001, max: 0.2, scale: "log", fmt: fmt.s }, release: { min: 0.01, max: 2, scale: "log", fmt: fmt.s }, makeup: { min: 0, max: 24, fmt: fmt.db } },
    eq: { low: { min: -18, max: 18, fmt: fmt.db, bi: true }, lowFreq: { min: 20, max: 1000, scale: "log", fmt: fmt.hz }, high: { min: -18, max: 18, fmt: fmt.db, bi: true }, highFreq: { min: 1000, max: 20000, scale: "log", fmt: fmt.hz } },
    width: { amount: { min: 0, max: 2, fmt: fmt.pct }, bassMono: { min: 0, max: 500, fmt: (v) => (v < 1 ? "Off" : fmt.hz(v)) } },
    clip: { drive: { min: 0, max: 24, fmt: fmt.db }, shape: { min: 0, max: 100, fmt: (v) => Math.round(v) + "%" }, ceiling: { min: -24, max: 0, fmt: fmt.db } },
    texture: {
      size: { min: 0.005, max: 0.5, scale: "log", fmt: fmt.s }, density: { min: 1, max: 200, scale: "log", fmt: (v) => (v < 10 ? v.toFixed(1) : Math.round(v)) + " /s" },
      pitch: { min: -24, max: 24, step: 1, fmt: fmt.st, bi: true }, spray: R.pct, position: R.pct, shape: R.pct, reverse: R.pct,
      pitchRandom: { min: 0, max: 12, fmt: fmt.stf }, spread: R.pct, feedback: { min: 0, max: 0.95, fmt: fmt.pct }, tone: R.pct,
      drive: { min: 0, max: 24, fmt: fmt.db }, space: R.pct, mix: R.pct,
    },
  };
  const PEAK_META = { f: R.hz, q: { min: 0.1, max: 12, scale: "log", fmt: fmt.x2 }, db: { min: -18, max: 18, fmt: fmt.db, bi: true } };
  function modAmtMeta(dst) {
    if (/pitch$/.test(dst)) return { min: -48, max: 48, fmt: fmt.stf, bi: true };
    if (dst === "filter.cutoff") return R.octs;
    if (/detune$/.test(dst)) return { min: -100, max: 100, fmt: fmt.ct, bi: true };
    if (/warp$/.test(dst)) return { min: -1, max: 1, fmt: fmt.x2, bi: true };
    return R.bip;
  }
  const FALLBACK = { min: 0, max: 1, fmt: fmt.x2 };

  function toN(s, v) {
    if (typeof v !== "number" || !isFinite(v)) v = s.min;
    if (s.scale === "log") return clamp(Math.log(Math.max(v, s.min) / s.min) / Math.log(s.max / s.min));
    if (s.scale === "pow") return Math.pow(clamp((v - s.min) / (s.max - s.min)), 1 / 3);
    return clamp((v - s.min) / (s.max - s.min));
  }
  function fromN(s, n) {
    n = clamp(n);
    let v;
    if (s.scale === "log") v = s.min * Math.pow(s.max / s.min, n);
    else if (s.scale === "pow") v = s.min + (s.max - s.min) * n * n * n;
    else v = s.min + (s.max - s.min) * n;
    if (s.step) v = Math.round(v / s.step) * s.step;
    else v = +v.toPrecision(5);
    return v;
  }

  // ---------------------------------------------------------------- wavetables (for the drawn preview)
  const TABLE_FRAMES = { basic: 4, saw: 1, square: 1, triangle: 1, sine: 1, pwm: 8, harmonic: 8, vocal: 5, metal: 6, digital: 8, organ: 6, hollow: 6, growl: 8,
    warm: 8, sinefold: 8, fmbell: 8, formant: 13, chip: 5, acid: 8, comb: 8 };
  const N_PTS = 128;
  function synth(h) {
    const out = new Float32Array(N_PTS);
    for (let n = 1; n <= h.length; n++) {
      const a = h[n - 1];
      if (!a) continue;
      for (let i = 0; i < N_PTS; i++) out[i] += a * Math.sin((2 * Math.PI * n * i) / N_PTS);
    }
    return out;
  }
  function harmonics(f, N) { const h = []; for (let n = 1; n <= N; n++) h.push(f(n)); return h; }
  const H = {
    sine: () => [1],
    saw: () => harmonics((n) => (n % 2 ? 1 : -1) / n, 40),
    square: () => harmonics((n) => (n % 2 ? 1 / n : 0), 40),
    triangle: () => harmonics((n) => (n % 2 ? ((n - 1) / 2) % 2 ? -1 / (n * n) : 1 / (n * n) : 0), 40),
  };
  const VOWELS = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870]];
  function frameSamples(wave, k, nF, custom) {
    if (custom) return synth(custom[k] || [1]);
    switch (wave) {
      case "basic": return synth([H.sine, H.triangle, H.saw, H.square][k]());
      case "saw": case "square": case "triangle": case "sine": return synth(H[wave]());
      case "pwm": {
        const w = 0.5 - (k / (nF - 1)) * 0.46, out = new Float32Array(N_PTS);
        for (let i = 0; i < N_PTS; i++) out[i] = i / N_PTS < w ? 1 : -1;
        return out;
      }
      case "harmonic": { const c = [1, 2, 3, 5, 8, 12, 20, 32][k]; return synth(harmonics((n) => (n <= c ? 1 / n : 0), 32)); }
      case "vocal": { const [f1, f2] = VOWELS[k]; return synth(harmonics((n) => Math.exp(-Math.pow((n * 110 - f1) / 130, 2)) + 0.7 * Math.exp(-Math.pow((n * 110 - f2) / 200, 2)) + 0.04 / n, 30)); }
      case "metal": return synth(harmonics((n) => (n % 2 ? (0.4 + 0.6 * Math.abs(Math.sin(n * 7.3 + k * 2.1))) / Math.pow(n, 1.1 - k * 0.12) : 0.05 / n), 31));
      case "digital": {
        const steps = [32, 16, 12, 8, 6, 5, 4, 3][k], out = new Float32Array(N_PTS);
        for (let i = 0; i < N_PTS; i++) { const p = i / N_PTS; const v = 0.6 * Math.sin(2 * Math.PI * p) + 0.4 * (2 * p - 1); out[i] = Math.round(v * steps) / steps; }
        return out;
      }
      case "organ": {
        const bars = [[1, 0, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0], [1, 0.5, 1, 0, 0, 0], [1, 1, 1, 1, 0, 0], [0.6, 1, 0.5, 0.8, 0.6, 0], [1, 0.8, 0.6, 0.8, 0.5, 0.6]][k];
        const h = new Array(8).fill(0);
        [1, 2, 3, 4, 6, 8].forEach((n, i) => { h[n - 1] = bars[i]; });
        return synth(h);
      }
      case "hollow": { const c = [1, 3, 5, 9, 15, 25][k]; return synth(harmonics((n) => (n % 2 && n <= c ? 1 / n : 0), 25)); }
      case "growl": { const fc = 2 + k * 3.5; return synth(harmonics((n) => ((n % 2 ? 1 : -1) / n) * (0.25 + 2.2 * Math.exp(-Math.pow((n - fc) / 2.5, 2))), 40)); }
      // the 2026-10-27 tables (pictures only; the engine builds the real ones, TmWavetable.h)
      case "warm": { const c = 64 * Math.pow(3 / 64, k / 7); return synth(harmonics((n) => 1 / n / Math.sqrt(1 + Math.pow(n / c, 4)), 40)); }
      case "sinefold": { const g = 1 + k, out = new Float32Array(N_PTS); for (let i = 0; i < N_PTS; i++) out[i] = Math.sin(0.5 * Math.PI * g * Math.sin(2 * Math.PI * i / N_PTS)); return out; }
      case "fmbell": { const ix = 6 * k / 7, out = new Float32Array(N_PTS); for (let i = 0; i < N_PTS; i++) { const t = i / N_PTS; out[i] = Math.sin(2 * Math.PI * t + ix * Math.sin(4 * Math.PI * t)); } return out; }
      case "formant": { const v = VOWELS[Math.min(4, Math.round(k / 3))]; return synth(harmonics((n) => Math.exp(-Math.pow((n * 130 - v[0]) / 130, 2)) + 0.7 * Math.exp(-Math.pow((n * 130 - v[1]) / 200, 2)) + 0.04 / n, 30)); }
      case "chip": {
        const out = new Float32Array(N_PTS);
        for (let i = 0; i < N_PTS; i++) {
          const t = i / N_PTS;
          out[i] = k < 3 ? (t < [0.5, 0.25, 0.125][k] ? 1 : -1) : k === 3 ? Math.round((1 - 4 * Math.abs(t - 0.5)) * 7.5) / 7.5 : Math.round((1 - 2 * t) * 3.5) / 3.5;
        }
        return out;
      }
      case "acid": { const c = 2 * Math.pow(24, k / 7); return synth(harmonics((n) => { const x = n / c; return Math.min(8, 1 / Math.hypot(1 - x * x, x / 6)) / n / (1 + x * x); }, 40)); }
      case "comb": { const c = 2 + 10 * k / 7; return synth(harmonics((n) => (0.15 + 0.85 * Math.abs(Math.cos(Math.PI * n / c))) / n, 40)); }
      default: return synth([1]);
    }
  }
  const tableCache = new Map();
  function tableFrames(osc) {
    const custom = Array.isArray(osc.frames) && osc.frames.length ? osc.frames : null;
    const key = custom ? "c:" + JSON.stringify(custom) : osc.wave;
    if (tableCache.has(key)) return tableCache.get(key);
    const nF = custom ? custom.length : TABLE_FRAMES[osc.wave] || 1;
    const frames = [];
    for (let k = 0; k < nF; k++) {
      const f = frameSamples(osc.wave, k, nF, custom);
      let pk = 0;
      for (const v of f) pk = Math.max(pk, Math.abs(v));
      if (pk > 0) for (let i = 0; i < f.length; i++) f[i] /= pk;
      frames.push(f);
    }
    if (tableCache.size > 40) tableCache.clear();
    tableCache.set(key, frames);
    return frames;
  }
  function frameAt(frames, pos) {
    if (frames.length === 1) return frames[0];
    const x = clamp(pos) * (frames.length - 1), i = Math.min(frames.length - 2, Math.floor(x)), t = x - i;
    const a = frames[i], b = frames[i + 1], out = new Float32Array(N_PTS);
    for (let j = 0; j < N_PTS; j++) out[j] = a[j] + (b[j] - a[j]) * t;
    return out;
  }
  function warpSample(f, phase, warp) {
    const amt = warp ? +warp.amount || 0 : 0, type = warp ? warp.type : "none";
    let p = phase;
    if (type === "sync") p = (p * (1 + amt * 15)) % 1;
    else if (type === "bend") p = Math.pow(p, Math.pow(2, -amt * 2));
    else if (type === "pwm") { const w = 1 - amt * 0.9; if (p > w) return 0; p = p / w; }
    else if (type === "fm") p = (((p + amt * 0.25 * Math.sin(2 * Math.PI * p * 2)) % 1) + 1) % 1;
    const x = p * N_PTS, i = Math.floor(x) % N_PTS, t = x - Math.floor(x);
    let v = f[i] + (f[(i + 1) % N_PTS] - f[i]) * t;
    if (type === "fold") v = Math.sin(v * (1 + amt * 4) * Math.PI / 2);
    return v;
  }

  // ---------------------------------------------------------------- drawing helpers
  function prepCanvas(c) {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    return { ctx, w: r.width, h: r.height };
  }
  const ACID = "#e4ff3a", PURPLE = "#8b5cf6";
  function arcPath(cx, cy, r, a0, a1) {
    const rad = (a) => ((a - 90) * Math.PI) / 180;
    const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0));
    const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  function filterMag(type, f, fc, res) {
    const w = f / fc, Q = 0.55 + res * 2 + res * res * 14;
    const re = 1 - w * w, im = w / Q, den = Math.hypot(re, im);
    const lp = 1 / den, hp = (w * w) / den, bp = im / den;
    switch (type) {
      case "lp12": return lp;
      case "lp24": case "ladder": return lp * lp;
      case "hp12": return hp;
      case "hp24": return hp * hp;
      case "bp12": return bp;
      case "notch": return Math.abs(re) / den;
      case "peak": return (1 + w * w) / den;
      default: return 1;
    }
  }
  function envShape(e, s01) {
    // returns points [x, y] in 0..1 for an ADSR drawing
    const sx = (t) => Math.sqrt(Math.max(0, t) / 10);
    const A = 0.04 + sx(e.a) * 0.9, D = 0.04 + sx(e.d) * 0.9, S = 0.35, Rl = 0.04 + sx(e.r) * 0.9;
    const tot = A + D + S + Rl, k = 1 + e.curve * 5, pts = [[0, 0]];
    for (let i = 1; i <= 16; i++) pts.push([(A * i) / 16 / tot, i / 16]);
    for (let i = 1; i <= 24; i++) { const t = i / 24; pts.push([(A + D * t) / tot, e.s + (1 - e.s) * Math.pow(1 - t, k)]); }
    pts.push([(A + D + S) / tot, e.s]);
    for (let i = 1; i <= 24; i++) { const t = i / 24; pts.push([(A + D + S + Rl * t) / tot, e.s * Math.pow(1 - t, k)]); }
    return pts;
  }
  function lfoValue(shape, p, seed) {
    const ph = ((p % 1) + 1) % 1;
    switch (shape) {
      case "triangle": return 1 - 4 * Math.abs(ph - 0.5);
      case "saw": return 1 - 2 * ph;
      case "ramp": return 2 * ph - 1;
      case "square": return ph < 0.5 ? 1 : -1;
      case "random": { const k = Math.floor(p * 4); return Math.sin(k * 91.7 + seed) * 0.9; }
      case "smooth": { const x = p * 4, k = Math.floor(x), t = x - k, a = Math.sin(k * 91.7 + seed) * 0.9, b = Math.sin((k + 1) * 91.7 + seed) * 0.9, u = t * t * (3 - 2 * t); return a + (b - a) * u; }
      default: return Math.sin(2 * Math.PI * ph);
    }
  }

  // ---------------------------------------------------------------- the landscape
  function makeNoise(seed) {
    let s = (Math.imul(seed | 0, 2654435761 | 0) >>> 0) || 1;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const perm = []; for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    const p = new Uint8Array(512), val = new Float32Array(256);
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    for (let i = 0; i < 256; i++) val[i] = rnd();
    const n = function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = val[p[X + p[Y]]], b = val[p[X + 1 + p[Y]]], c = val[p[X + p[Y + 1]]], d = val[p[X + 1 + p[Y + 1]]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    n.rnd = rnd;
    return n;
  }
  function hslRgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360; s = clamp(s / 100); l = clamp(l / 100);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  function buildLut(stops) {
    const lut = new Uint8ClampedArray(256 * 3);
    const cols = stops.map((s) => [s[0], hslRgb(s[1], s[2], s[3])]);
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      let j = 0;
      while (j < cols.length - 2 && x > cols[j + 1][0]) j++;
      const [x0, c0] = cols[j], [x1, c1] = cols[j + 1];
      const t = clamp((x - x0) / (x1 - x0 || 1));
      for (let k = 0; k < 3; k++) lut[i * 3 + k] = c0[k] + (c1[k] - c0[k]) * t;
    }
    return lut;
  }

  // ---------------------------------------------------------------- image looks
  // Eman's reference images, shrunk into one greyscale atlas (5 x 4 tiles of 256 px). Each look
  // samples its tiles through the landscape warp, moves them its own way and colours them with
  // the sound's hues. Clean sound = the clean image; drive folds it into contour bands, clip
  // makes it hard black and white, crush turns it into halftone dots; past ~60% contrast and
  // colour climb. "classic" is the procedural landscape (look.style).
  const LOOKS_SRC = "toymachine-looks.jpg", LOOK_COLS = 5;
  const LOOK_FAMILIES = {
    chrome: { label: "Chrome", tiles: [1, 2, 3], move: "ripple", hues: [215, 70], sat: 0.35 },
    eyes: { label: "Eyes", tiles: [4, 5], move: "swirl", hues: [275, 70], sat: 1 },
    skulls: { label: "Skulls", tiles: [6], move: "drift", hues: [262, 48], sat: 0.9 },
    castle: { label: "Castle", tiles: [7], move: "drift", hues: [168, 70], sat: 0.8 },
    filigree: { label: "Filigree", tiles: [8], move: "drift", hues: [292, 180], sat: 1 },
    moire: { label: "Moiré", tiles: [9, 10], move: "melt", hues: [238, 300], sat: 0.9 },
    marble: { label: "Marble", tiles: [11, 12], move: "swirl", hues: [275, 32], sat: 1 },
    rings: { label: "Rings", tiles: [14, 13], move: "spin", hues: [70, 275], sat: 0.9 },
    cells: { label: "Cells", tiles: [15], move: "melt", hues: [325, 70], sat: 1 },
    blobs: { label: "Blobs", tiles: [16, 17, 19], move: "melt", hues: [285, 190], sat: 1 },
    grid: { label: "Grid", tiles: [0], move: "mosaic", hues: [275, 70], sat: 0.12 },
    stars: { label: "Stars", tiles: [18], move: "drift", hues: [250, 58], sat: 1 },
  };
  const LOOK_ORDER = Object.keys(LOOK_FAMILIES);
  const LOOK_INVERT = { 13: 1, 16: 1, 19: 1 }; // light-paper images, flipped so the disc stays dark
  // which looks each kind of sound picks from (one per preset, by its name)
  const CAT_LOOKS = {
    Bass: ["skulls", "cells", "chrome"], Pads: ["marble", "blobs", "castle"], Plucks: ["grid", "stars", "moire"],
    Arps: ["rings", "moire", "grid"], Leads: ["chrome", "eyes", "filigree"], Keys: ["castle", "marble", "eyes"],
    FX: ["filigree", "cells", "stars"], Texture: ["filigree", "cells", "stars"], Synths: ["blobs", "chrome", "rings"],
  };
  function strHash(str) { let h = 2166136261; str = String(str || ""); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /** The image look a preset shows: look.family, or "auto" (unset) = one of its category's looks; null = classic. */
  function lookFamily(look, meta) {
    const f = look && look.family;
    if (f === "classic") return null;
    if (LOOK_FAMILIES[f]) return f;
    return "own"; // unset / "own" / old "auto": the preset's own picture (look.image)
  }
  /** The category's look (what "auto" used to mean; still used for the fallback picture). */
  function categoryFamily(meta) {
    const list = CAT_LOOKS[(meta && meta.category) || ""] || CAT_LOOKS.Synths;
    return list[strHash(meta && meta.name) % list.length];
  }

  // ---- every preset's own picture: look.image = { set, n, tone, hue, zoom, ox, oy, mirror }
  //   set "char": ui/toymachine-chars.jpg (6 x 320 px tiles, built by scripts/build_toymachine_chars.py).
  //     No faces (Eman 2026-10-27: a character's face looks bad when it distorts): of its numbered
  //     tiles only CHAR_KEPT are still in the picture (three dark blurred characters Eman kept and
  //     the sigils), packed in that order; any other stored character or doll is ignored and the
  //     preset gets an abstract picture.
  //     "ref": a tile of the reference atlas above; "bit": a pixel-art symbol drawn here (no file).
  //   tone "own" (the picture's own colours, lightly tinted), "duo" (two-colour from hue), "neon"
  //     (colour channels turned). scripts/assign_toymachine_looks.py gives each library preset a
  //     different one; a preset without one gets a picture from its name and category.
  const CHARS_SRC = "toymachine-chars.jpg", CHAR_COLS = 6;
  const CHAR_KEPT = [5, 13, 24, 66, 67, 68, 69, 70, 71, 72];
  const charAt = (n) => CHAR_KEPT.indexOf(n | 0);
  const BIT_SPRITES = {"cross":[384,384,384,2016,384,6552,16380,6552,384,384,384,384,384,960,384,0],"star":[256,256,256,896,896,1984,65528,16352,3968,3456,6336,4160,8224,0,0,0],"sparkle":[256,256,896,896,1984,16376,65535,16376,1984,896,896,256,256,0,4,14],"heart":[0,15420,32382,65535,65535,65535,32766,16380,8184,4080,2016,960,384,0,0,0],"demon":[16386,24582,12300,14364,8184,16380,32766,29646,24966,29646,32766,15420,7608,2640,2016,0],"angel":[2016,2064,2016,0,960,51171,59367,63471,63903,31134,15324,7128,960,2016,1632,0],"eye":[0,0,2016,6168,8580,17346,34785,34785,17346,8580,6168,2016,0,0,0,0],"ghost":[0,2016,8184,16380,32766,29646,24966,29646,32766,32766,32766,32766,28278,17442,0,0],"moon":[0,960,3840,7680,15360,14336,30720,30720,30720,30720,14336,15360,7680,3840,960,0],"bolt":[120,240,480,960,1920,4088,8176,480,960,1920,3840,7168,12288,16384,0,0],"invader":[0,4112,2080,8176,14296,32764,24564,20500,3168,0,0,0,0,0,0,0],"dagger":[384,384,384,384,384,384,384,384,4080,4080,384,384,960,960,384,0],"bat":[0,0,576,960,34785,53235,61431,65535,63471,50115,33153,0,0,0,0,0],"flame":[256,768,896,1920,4000,4080,8176,16376,16120,15480,14392,15480,8176,4064,0,0],"diamond":[384,960,2016,4080,8184,16380,32766,16380,8184,4080,2016,960,384,0,0,0]};
  const BIT_ORDER = Object.keys(BIT_SPRITES);
  const REF_FAMILY = {};
  for (const f in LOOK_FAMILIES) LOOK_FAMILIES[f].tiles.forEach((k) => { REF_FAMILY[k] = f; });
  const DARK_WORDS = /distort|rage|dirty|dark|villain|witch|goth|evil|aggress|menac|sinister|horror|grit|heavy|carti|phonk|grim|nasty|crunch|crush|driven|hard|industrial/i;
  const BIT_WORDS = /8-?bit|chip|bitcrush|crushed|pixel|retro game|gameboy|nes\b|square lead/i; // the mashed pixel art is only for these
  const SOFT_WORDS = /ambient|airy|dream|muffled|blue hour|soft|ethereal|lo-?fi|sad|emotional|gentle|calm|mellow|chill|sweet|angel|lush|underwater|smooth/i;
  function lookImage(look, meta) {
    const im = look && look.image;
    if (im && (im.set === "ref" || im.set === "bit")) return im;
    if (im && im.set === "char" && charAt(im.n) >= 0) return im;
    // no stored picture (or a face that was taken out): pick an abstract one from the name (the
    // same every time), by mood and category
    meta = meta || {};
    const h = strHash(meta.name || ""), words = [meta.name, meta.category].concat(meta.tags || []).join(" ");
    const dark = DARK_WORDS.test(words);
    const hues = [275, 70, 190, 320, 160, 240, 30, 300], hue = hues[(h >>> 4) % hues.length], mirror = !!((h >>> 8) & 1);
    if (dark && h % 3 === 0) return { set: "char", n: CHAR_KEPT[h % CHAR_KEPT.length], tone: "duo", hue, zoom: 1, ox: 0, oy: 0, mirror };
    if (BIT_WORDS.test(words)) return { set: "bit", n: h % BIT_ORDER.length, tone: "duo", hue, zoom: 1, ox: 0, oy: 0, mirror };
    const fams = dark ? ["skulls", "cells", "filigree", "castle"] : CAT_LOOKS[meta.category] || CAT_LOOKS.Synths, tl = LOOK_FAMILIES[fams[(h >>> 12) % fams.length]].tiles;
    return { set: "ref", n: tl[(h >>> 16) % tl.length], tone: "duo", hue, zoom: 1, ox: 0, oy: 0, mirror };
  }
  let CHARS = null, charsState = 0;
  const charsWaiters = [];
  function loadChars(cb) {
    if (CHARS) { if (cb) cb(); return; }
    if (cb) charsWaiters.push(cb);
    if (charsState) return;
    charsState = 1;
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
        const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height;
        const R = new Uint8Array(n), G = new Uint8Array(n), B = new Uint8Array(n);
        for (let i = 0; i < n; i++) { R[i] = d[i * 4]; G[i] = d[i * 4 + 1]; B[i] = d[i * 4 + 2]; }
        CHARS = { w: c.width, T: c.width / CHAR_COLS, R, G, B };
        charsState = 2;
        charsWaiters.splice(0).forEach((f) => f());
      } catch (e) { charsState = 3; }
    };
    im.onerror = () => { charsState = 3; };
    im.src = CHARS_SRC;
  }
  const CS = [0, 0, 0];
  // one character tile, bilinear, mirrored at the edges -> CS (0..1 each)
  function charSample(tile, x, y) {
    const A = CHARS, T = A.T, T2 = 2 * T;
    x %= T2; if (x < 0) x += T2; if (x >= T) x = T2 - x - 1e-3;
    y %= T2; if (y < 0) y += T2; if (y >= T) y = T2 - y - 1e-3;
    if (x > T - 1.001) x = T - 1.001; if (y > T - 1.001) y = T - 1.001;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, w = A.w;
    tile = charAt(tile);
    const i = (((tile / CHAR_COLS) | 0) * T + y0) * w + (tile % CHAR_COLS) * T + x0;
    for (let c = 0; c < 3; c++) {
      const p = c === 0 ? A.R : c === 1 ? A.G : A.B;
      const a = p[i] + (p[i + 1] - p[i]) * fx, b = p[i + w] + (p[i + w + 1] - p[i + w]) * fx;
      CS[c] = (a + (b - a) * fy) / 255;
    }
  }
  // pixel-art symbols, mashed (Eman: abstract, distorted, for sounds that feel bitcrushed): three
  // symbols at different sizes XOR-ed over each other, rows of blocks shoved sideways and smeared,
  // a coarse dither around them. Built once per tile, from its number.
  const BIT_T = 160, bitCache = {};
  function bitTile(n) {
    n = Math.abs(n | 0) % BIT_ORDER.length;
    if (bitCache[n]) return bitCache[n];
    const L = BIT_ORDER.length, A = BIT_SPRITES[BIT_ORDER[n]], B = BIT_SPRITES[BIT_ORDER[(n + 5) % L]], C = BIT_SPRITES[BIT_ORDER[(n + 11) % L]];
    const on = (rows, x, y, cell, ox, oy) => {
      const cx = Math.floor((x - ox) / cell), cy = Math.floor((y - oy) / cell);
      return !!(cx >= 0 && cx < 16 && cy >= 0 && cy < 16 && (rows[cy] >> (15 - cx)) & 1);
    };
    const hs = (k) => { const v = Math.sin((k + n * 17.3) * 91.7) * 43758.5453; return v - Math.floor(v); };
    const px = new Float32Array(BIT_T * BIT_T);
    for (let y = 0; y < BIT_T; y++) {
      const band = (y / 6) | 0, shove = hs(band) > 0.62 ? Math.round((hs(band + 40) - 0.5) * 48 / 4) * 4 : 0;
      const smear = hs(band + 80) > 0.85;
      for (let x = 0; x < BIT_T; x++) {
        const X = ((smear ? x - (x % 24) : x) + shove + BIT_T) % BIT_T;
        const a = on(A, X, y, 8, 16 + Math.round(hs(1) * 12), 10 + Math.round(hs(2) * 16));
        const b2 = on(B, X, y, 5, 70 + Math.round(hs(3) * 30), 70 + Math.round(hs(4) * 30));
        const c = on(C, X % 48, y % 48, 3, 0, 0);
        px[y * BIT_T + x] = a !== b2 ? 0.95 : a && b2 ? 0.45 : c ? 0.22 : (((X >> 2) + (y >> 2)) % 2 ? 0.08 : 0.03);
      }
    }
    return (bitCache[n] = px);
  }
  function bitSample(px, x, y) { // nearest, mirrored: pixel art stays crisp
    const T = BIT_T, T2 = 2 * T;
    x %= T2; if (x < 0) x += T2; if (x >= T) x = T2 - x - 1e-3;
    y %= T2; if (y < 0) y += T2; if (y >= T) y = T2 - y - 1e-3;
    return px[(y | 0) * T + (x | 0)];
  }
  let ATLAS = null, atlasState = 0;
  const atlasWaiters = [];
  function loadAtlas(cb) {
    if (ATLAS) { if (cb) cb(); return; }
    if (cb) atlasWaiters.push(cb);
    if (atlasState) return;
    atlasState = 1;
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
        const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data, px = new Float32Array(c.width * c.height), T = c.width / LOOK_COLS;
        for (let i = 0; i < px.length; i++) {
          const x = i % c.width, y = (i / c.width) | 0, k = ((y / T) | 0) * LOOK_COLS + ((x / T) | 0), l = d[i * 4] / 255;
          px[i] = LOOK_INVERT[k] ? 1 - l : l;
        }
        ATLAS = { w: c.width, px, T };
        atlasState = 2;
        atlasWaiters.splice(0).forEach((f) => f());
      } catch (e) { atlasState = 3; } // a file:// page can't read pixels: stay classic
    };
    im.onerror = () => { atlasState = 3; };
    im.src = LOOKS_SRC;
  }
  // one tile, bilinear, mirrored at the edges so any coordinate is fine
  function atlasSample(tile, x, y) {
    const A = ATLAS, T = A.T, T2 = 2 * T;
    x %= T2; if (x < 0) x += T2; if (x >= T) x = T2 - x - 1e-3;
    y %= T2; if (y < 0) y += T2; if (y >= T) y = T2 - y - 1e-3;
    if (x > T - 1.001) x = T - 1.001; if (y > T - 1.001) y = T - 1.001;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    const i = (((tile / LOOK_COLS) | 0) * T + y0) * A.w + (tile % LOOK_COLS) * T + x0, p = A.px, w = A.w;
    const a = p[i] + (p[i + 1] - p[i]) * fx, b = p[i + w] + (p[i + w + 1] - p[i + w]) * fx;
    return a + (b - a) * fy;
  }

  function Landscape(canvas) {
    const ctx = canvas.getContext("2d");
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    let S = 150, img = null, hbuf = null;
    let look = { style: "liquid", hue: 275, hue2: 70, seed: 1 };
    let fam = null, famT = [0], famMove = "drift", IMG = null;
    let noise = makeNoise(1);
    let t = 7, lutKey = "", L1, L2, frameMs = 8;
    const grain = document.createElement("canvas");
    grain.width = grain.height = 160;
    (() => {
      const g = grain.getContext("2d"), id = g.createImageData(160, 160);
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0);
    })();
    let grainPat = null;

    function fbm(x, y, o) {
      let s = 0, a = 0.5, norm = 0;
      for (let i = 0; i < o; i++) {
        s += a * noise(x, y); norm += a;
        const nx = x * 1.6 - y * 1.2; y = x * 1.2 + y * 1.6; x = nx + 3.1;
        a *= 0.5;
      }
      return s / norm;
    }
    let WX = 0, WY = 0, PADS = [], F = {}, RT = 0;
    // the sound itself: its waveform pushes rings out from the centre (index = radius), its mids
    // twist the field; all zero when nothing plays, so the picture holds still
    let AW = null, AWamp = 0, ATw = 0, AHi = 0;
    const small = document.createElement("canvas");
    const sctx = small.getContext("2d");
    const hash1 = (n) => { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };
    // the colour treatment of the forces (pixel styles): clip / drive / crush / analog / filter
    const PC = [0, 0, 0];
    function postColor(r, g, b) {
      if (F.analog) { const w = F.analog.y; r += 22 * w; g += 6 * w; b -= 18 * w; }
      if (F.tape && F.tape.y > 0.005) { const w = F.tape.y, l = (r + g + b) / 3; r = r + (l * 1.08 + 18 - r) * w * 0.7; g = g + (l * 0.96 + 6 - g) * w * 0.7; b = b + (l * 0.78 - b) * w * 0.7; }
      if (F.drive && F.drive.x > 0.005) {
        const gn = 1 + F.drive.x * 2.6, ch = F.drive.y, l = (r + g + b) / 3;
        r = l + (r - l) * (1 + F.drive.x); g = l + (g - l) * (1 + F.drive.x); b = l + (b - l) * (1 + F.drive.x);
        const sh = (c) => { c = (c / 255) * gn; if (ch > 0.5) c = Math.abs(Math.sin(c * Math.PI * (0.5 + (ch - 0.5) * 2))); else c = Math.tanh(c * 1.2) / Math.tanh(1.2); return c * 255; };
        r = sh(r); g = sh(g); b = sh(b);
      }
      if (F.clip && F.clip.x > 0.005) {
        const gn = 1 + F.clip.x * 2.4, hard = F.clip.y, l = (r + g + b) / 3, sat = 1 + F.clip.x * 1.2;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
        const cl = (c) => { c = Math.max(0, (c / 255) * gn); return (Math.tanh(c) * (1 - hard) + Math.min(c, 1) * hard) * 255; };
        r = cl(r); g = cl(g); b = cl(b);
      }
      if (F.crush && F.crush.x > 0.005) { const L = Math.max(2, Math.round(2 + (1 - F.crush.x) * 22)); r = Math.round((r / 255) * L) / L * 255; g = Math.round((g / 255) * L) / L * 255; b = Math.round((b / 255) * L) / L * 255; }
      PC[0] = r; PC[1] = g; PC[2] = b;
    }
    function warp(u, v) {
      let x = u, y = v;
      for (let k = 0; k < PADS.length; k++) {
        const pd = PADS[k], dx = u - pd.u, dy = v - pd.v, d2 = dx * dx + dy * dy;
        const g = Math.exp(-d2 * pd.fall);
        if (g < 0.002) continue;
        const ang = g * pd.swirl, c = Math.cos(ang), s = Math.sin(ang), sc = 1 - g * pd.pinch;
        x += (dx * c - dy * s) * sc - dx;
        y += (dx * s + dy * c) * sc - dy;
      }
      if (AW && AWamp > 0.001) {
        const r = Math.sqrt(u * u + v * v) + 1e-4, k = (AWamp * AW[Math.min(63, (r * 63) | 0)]) / r;
        x += u * k; y += v * k;
      }
      if (ATw > 0.005) {
        const a = ATw * (1 - Math.min(1, u * u + v * v)), c = Math.cos(a), s2 = Math.sin(a), nx = x * c - y * s2;
        y = x * s2 + y * c; x = nx;
      }
      if (F.motion && F.motion.y > 0.005) {
        const ph = RT * 0.1 * Math.pow(160, F.motion.x) * Math.PI * 2, dp = F.motion.y * 0.13;
        x += dp * Math.sin(y * 5 + ph); y += dp * Math.cos(x * 4 + ph * 0.7);
      }
      if (F.arp && F.arp.rate >= 0) {
        const a = F.arp, dx = u - a.u, dy = v - a.v, d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
        const fr = a.phase, rr = fr * 1.4, amp = Math.exp(-Math.pow((d - rr) * 8, 2)) * 0.09 * (1 - fr);
        x += (dx / d) * amp; y += (dy / d) * amp;
      }
      if (F.clip && F.clip.x > 0.005) {
        const bands = 8 + F.clip.y * 26, q = Math.floor(y * bands + Math.floor(RT * 6) * 0.37);
        const h = hash1(q);
        if (h > 0.55 - F.clip.x * 0.4) x += (hash1(q + 9.1) - 0.5) * F.clip.x * 0.22;
      }
      if (F.drive && F.drive.x > 0.005) x += Math.sin(y * 34 + RT * 3) * F.drive.x * 0.025;
      if (F.tape && F.tape.x > 0.005) { const w = F.tape.x; x += (Math.sin(RT * 0.9) * 0.6 + Math.sin(RT * 2.3 + y * 3) * 0.4) * w * 0.035 + Math.sin(RT * 41 + y * 90) * w * 0.002; y += Math.sin(RT * 0.7 + 1.3) * w * 0.02; }
      WX = x; WY = y;
    }

    function setLook(l, meta) {
      look = Object.assign({ style: "liquid", hue: 275, hue2: 70, seed: 1 }, l || {});
      noise = makeNoise(look.seed | 0);
      lutKey = "";
      fam = lookFamily(look, meta);
      IMG = null;
      if (fam === "own") {
        IMG = lookImage(look, meta);
        famT = [IMG.n | 0];
        if (IMG.set === "ref") { famMove = (LOOK_FAMILIES[REF_FAMILY[IMG.n]] || {}).move || "drift"; loadAtlas(); }
        else { famMove = "hold"; if (IMG.set === "char") loadChars(); }
      } else if (fam) {
        const tl = LOOK_FAMILIES[fam].tiles, k = Math.abs(look.seed | 0) % tl.length;
        famT = tl.slice(k).concat(tl.slice(0, k)); // the preset's own image first, the next one to morph into
        famMove = LOOK_FAMILIES[fam].move;
        loadAtlas();
      }
    }
    // the image looks' colours: a dark grey to purple to tint ramp, and a pushed one
    // (saturated, the acid accent in the highlights) that takes over as distortion climbs
    let famLut = null, famKey = "";
    function famLuts(h1, h2, bright, push, sat) {
      const key = (h1 | 0) + "," + (h2 | 0) + "," + Math.round(bright * 40) + "," + Math.round(push * 30) + "," + sat;
      if (key === famKey) return;
      famKey = key;
      const b = bright;
      const c = sat == null ? 1 : sat;
      const A = buildLut([[0, h1, 14 * c, 3], [0.3, h1, 34 * c, 11 * b], [0.6, h1, 58 * c, 34 * b], [0.82, h1 + 18, 55 * c, 64 * b], [0.94, h2, 75 * c, 80 * b], [1, h2, 50 * c, 94]]);
      const B = buildLut([[0, h1, 60, 2], [0.35, h1, 90, 18 * b], [0.62, h1 + 25, 100, 45 * b], [0.8, h2, 100, 56], [1, h2, 100, 86]]);
      famLut = new Uint8ClampedArray(768);
      for (let i = 0; i < 768; i++) famLut[i] = A[i] + (B[i] - A[i]) * push;
    }

    function luts(h1, h2, bright) {
      const key = look.style + (h1 | 0) + "," + (h2 | 0) + "," + Math.round(bright * 40);
      if (key === lutKey) return;
      lutKey = key;
      const b = bright;
      switch (look.style) {
        case "liquid":
          L1 = buildLut([[0, h1, 35, 2 * b], [0.3, h1, 55, 9 * b], [0.55, h1, 70, 30 * b], [0.78, h1 + 18, 82, 55 * b], [1, h1 + 30, 90, 84 * b]]);
          L2 = buildLut([[0, h2, 90, 18 * b], [0.5, h2, 95, 50 * b], [1, h2 + 10, 100, 82 * b]]);
          break;
        case "chrome":
          L1 = buildLut([[0, h1, 40, 4 * b], [0.35, h1, 60, 18 * b], [0.55, h2, 70, 45 * b], [0.7, h1, 70, 28 * b], [0.9, h1 + 20, 60, 70 * b], [1, h1, 30, 95]]);
          L2 = buildLut([[0, h1, 50, 3], [1, h1, 70, 14 * b]]);
          break;
        case "grain":
          L1 = buildLut([[0, h1, 40, 2], [0.45, h1, 65, 14 * b], [0.75, h1 + 20, 80, 42 * b], [1, h1 + 40, 90, 78 * b]]);
          L2 = buildLut([[0, h2, 90, 0], [0.6, h2, 95, 40 * b], [1, h2, 100, 75 * b]]);
          break;
        case "terrain":
          L1 = buildLut([[0, h1, 50, 4 * b], [0.5, h1, 45, 14 * b], [1, h2, 55, 30 * b]]);
          L2 = buildLut([[0, h1, 70, 45 * b], [1, h2, 90, 70 * b]]);
          break;
        default:
          L1 = buildLut([[0, h1, 50, 8 * b], [0.5, h1, 70, 45 * b], [0.8, (h1 + h2) / 2, 80, 65 * b], [1, h2, 95, 80 * b]]);
          L2 = L1;
      }
    }

    function pixels(st) {
      if (!img || img.width !== S) { off.width = off.height = S; img = octx.createImageData(S, S); hbuf = new Float32Array(S * S); }
      const d = img.data, inv = 1 / S, style = look.style;
      const zoom = st.zoom, turb = st.turb, T = t;
      const blobs = style === "chrome" ? chromeBlobs(st) : null;
      const blk = F.crush ? 1 + Math.round(F.crush.y * S / 18) : 1;
      const post = !!(F.clip || F.drive || F.crush || F.analog || F.tape);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = y * S + x, i4 = i * 4;
          const qx = blk > 1 ? Math.floor(x / blk) * blk + blk / 2 : x + 0.5, qy = blk > 1 ? Math.floor(y / blk) * blk + blk / 2 : y + 0.5;
          const u = qx * inv * 2 - 1, v = 1 - qy * inv * 2;
          if (u * u + v * v > 1.04) { d[i4 + 3] = 0; continue; }
          warp(u, v);
          const px = WX * zoom, py = WY * zoom;
          let r = 0, g = 0, b = 0;
          if (style === "liquid") {
            const qx = fbm(px + T * 0.21, py, 4), qy = fbm(px + 5.2, py + 1.3 - T * 0.17, 4);
            const k = 3.2 * turb;
            const rx = fbm(px + k * qx + 1.7 + T * 0.11, py + k * qy + 9.2, 4), ry = fbm(px + k * qx + 8.3, py + k * qy + 2.8 + T * 0.09, 3);
            const f = fbm(px + k * rx, py + k * ry, 4);
            const fv = clamp((f - 0.22) * 1.9);
            const li = (fv * 255) | 0;
            const w = ss(0.52, 0.72, rx) * ss(0.35, 0.6, f);
            const ai = (clamp((ry - 0.2) * 1.6) * 255) | 0;
            const vein = 1 - 0.7 * ss(0.9, 1, 1 - Math.abs(((f * 7) % 1) - 0.5) * 2) * ss(0.2, 0.6, fv);
            r = (L1[li * 3] * (1 - w) + L2[ai * 3] * w) * vein;
            g = (L1[li * 3 + 1] * (1 - w) + L2[ai * 3 + 1] * w) * vein;
            b = (L1[li * 3 + 2] * (1 - w) + L2[ai * 3 + 2] * w) * vein;
          } else if (style === "grain") {
            const wx = fbm(px * 0.7 + 4, py * 0.7 - T * 0.05, 3) - 0.5, wy = fbm(px * 0.7 - 2, py * 0.7 + 6, 3) - 0.5;
            const f = fbm(px * 0.8 + wx * 2.5 * turb + T * 0.12, py * 0.8 + wy * 2.5 * turb, 5);
            const gg = fbm(px * 1.7 - T * 0.1 + 3 + wx * 3, py * 1.7 + 7 + wy * 3, 4);
            const cl = ss(0.3, 0.78, f), ac = ss(0.5, 0.8, gg) * ss(0.35, 0.7, f);
            const li = (cl * 255) | 0, ai = (ac * 255) | 0;
            r = L1[li * 3] + L2[ai * 3] * ac; g = L1[li * 3 + 1] + L2[ai * 3 + 1] * ac; b = L1[li * 3 + 2] + L2[ai * 3 + 2] * ac;
            const hs = Math.sin(x * 12.9898 + y * 78.233 + (look.seed | 0)) * 43758.5453;
            if (hs - Math.floor(hs) > 0.996) { r += 160; g += 160; b += 170; }
          } else if (style === "terrain") {
            const wx = fbm(px * 0.6 + T * 0.04, py * 0.6, 3) - 0.5;
            hbuf[i] = fbm(px + wx * 1.6 * turb, py + wx * 0.8 * turb + T * 0.02, 5);
            continue;
          } else if (style === "chrome") {
            const F = chromeField(blobs, WX, WY), Fx = chromeField(blobs, WX + 0.02, WY), Fy = chromeField(blobs, WX, WY + 0.02);
            const inside = ss(0.85, 1.25, F);
            let nx = -(Fx - F) * 2.2, ny = -(Fy - F) * 2.2;
            const nl = Math.hypot(nx, ny, 1); nx /= nl; ny /= nl; const nz = 1 / nl;
            const env = clamp(0.5 + ny * 0.48 + nx * 0.18 + (fbm(nx * 2 + T * 0.1, ny * 2, 2) - 0.5) * 0.5 * turb);
            const li = (env * 255) | 0;
            const spec = Math.pow(clamp(nx * -0.35 + ny * 0.55 + nz * 0.76), 28) * 255;
            const bg = (clamp(F * 0.6) * 255) | 0;
            r = (L1[li * 3] + spec) * inside + L2[bg * 3] * (1 - inside);
            g = (L1[li * 3 + 1] + spec) * inside + L2[bg * 3 + 1] * (1 - inside);
            b = (L1[li * 3 + 2] + spec) * inside + L2[bg * 3 + 2] * (1 - inside);
          }
          if (post) { postColor(r, g, b); r = PC[0]; g = PC[1]; b = PC[2]; }
          d[i4] = r; d[i4 + 1] = g; d[i4 + 2] = b; d[i4 + 3] = 255;
        }
      }
      if (style === "terrain") terrainShade(d);
      octx.putImageData(img, 0, 0);
    }
    // how hard the sound is being pushed: the clip / drive / crush points plus the effects chain
    const DMG = { drive: 0, clip: 0, crush: 0, dirt: 0, push: 0 };
    function damage(st) {
      const fx = st.fxDirt || {};
      DMG.drive = Math.max(F.drive ? F.drive.x : 0, fx.drive || 0);
      DMG.clip = Math.max(F.clip ? F.clip.x : 0, fx.clip || 0);
      DMG.crush = Math.max(F.crush ? F.crush.x : 0, fx.crush || 0);
      DMG.dirt = Math.max(DMG.drive, DMG.clip, DMG.crush);
      DMG.push = ss(0.45, 1, DMG.dirt + 0.35 * (DMG.drive + DMG.clip + DMG.crush - DMG.dirt));
    }
    function famPixels(st, h1, h2) {
      if (!img || img.width !== S) { off.width = off.height = S; img = octx.createImageData(S, S); hbuf = new Float32Array(S * S); }
      damage(st);
      // each look has its own two colours; the sound's hue and its seed nudge them
      // (a preset's own picture brings its own hue: the second colour is the acid accent, or purple)
      const F0 = IMG ? { hues: [IMG.hue == null ? 275 : IMG.hue, Math.abs((IMG.hue | 0) - 70) < 40 ? 275 : 70], sat: 1 } : LOOK_FAMILIES[fam];
      const nudge = IMG ? st.hueShift : ((look.hue | 0) - 275) * 0.5 + st.hueShift + ((look.seed | 0) % 7 - 3) * 6;
      famLuts(F0.hues[0] + nudge, F0.hues[1] + nudge * 0.4, st.bright, DMG.push, F0.sat);
      const isChar = !!IMG && IMG.set === "char", isBit = !!IMG && IMG.set === "bit", bp = isBit ? bitTile(IMG.n | 0) : null;
      const d = img.data, inv = 1 / S, T = t, TS = isChar ? CHARS.T : isBit ? BIT_T : ATLAS.T, L = famLut;
      const dr = DMG.drive, cl = DMG.clip, cr = DMG.crush, push = DMG.push, turb = st.turb, mv = famMove;
      // a preset's picture sits still and whole at rest (the macros zoom it only a little)
      const kz = IMG ? TS * 0.5 * (IMG.zoom || 1) * (1.02 + 0.12 * (st.zoom - 1.15)) : TS * 0.5 * (0.62 + 0.28 * st.zoom), t0 = famT[0], t1 = famT[1 % famT.length];
      const cxo = TS * (0.5 + (IMG ? +IMG.ox || 0 : 0)), cyo = TS * (0.5 + (IMG ? +IMG.oy || 0 : 0)), mir = IMG && IMG.mirror ? -1 : 1;
      const morph = !IMG && famT.length > 1 ? clamp(st.morph || 0) * 0.75 : 0;
      const tone2 = IMG ? IMG.tone || (isChar ? "own" : "duo") : "duo", grade = 0.14 + 0.5 * push;
      const gs = isBit ? (x, y) => bitSample(bp, x, y) : (x, y) => atlasSample(t0, x, y);
      const split = ss(0.08, 1, Math.max(cl, cr * 0.6, dr * 0.35)) * 0.03 + (F.analog ? F.analog.x * 0.008 : 0);
      const contrast = 1 + push * 1.8, lift = (st.bright - 1) * (IMG ? 0.06 : 0.18);
      const fold = dr > 0.01 ? Math.PI * (1 + dr * 3) : 0, foldMix = Math.min(1, dr * 1.6);
      const clipW = 0.5 * (1 - cl) + 0.015, clipMix = Math.min(1, cl * 2);
      const cell = 2.2 + cr * 7 * (S / 300), crMix = Math.min(1, cr * 1.4);
      const blk = F.crush ? 1 + Math.round(F.crush.y * S / 18) : 1;
      const bands = 10 + cl * 30, tick = Math.floor(RT * 7);
      const rot = mv === "spin" ? T * 0.07 : 0, cR = Math.cos(rot), sR = Math.sin(rot), breathe = 1 + 0.05 * Math.sin(T * 0.45);
      const tone01 = (l, x, y) => {
        l = (l - 0.5) * contrast + 0.5 + lift;
        if (fold) l += (0.5 - 0.5 * Math.cos(clamp(l) * fold) - l) * foldMix;
        if (clipMix) l += (ss(0.5 - clipW, 0.5 + clipW, l) - l) * clipMix;
        if (crMix) {
          const cx = (x % cell) / cell - 0.5, cy = (y % cell) / cell - 0.5, dd = Math.sqrt(cx * cx + cy * cy) * 1.42;
          l += (ss(dd - 0.12, dd + 0.12, Math.sqrt(clamp(l))) - l) * crMix;
        }
        return clamp(l);
      };
      const tone = (l, x, y) => (tone01(l, x, y) * 255) | 0;
      for (let y = 0; y < S; y++) {
        // clip tears whole rows sideways, a different handful every few frames
        const row = Math.floor(y * inv * bands), hr = hash1(row + tick * 0.37);
        const tear = cl > 0.01 && hr > 0.62 - cl * 0.45 ? (hash1(row * 1.7 + tick) - 0.5) * cl * 0.5 : 0;
        for (let x = 0; x < S; x++) {
          const i4 = (y * S + x) * 4;
          const qx = blk > 1 ? Math.floor(x / blk) * blk + blk / 2 : x + 0.5, qy = blk > 1 ? Math.floor(y / blk) * blk + blk / 2 : y + 0.5;
          const u = qx * inv * 2 - 1, v = 1 - qy * inv * 2;
          if (u * u + v * v > 1.04) { d[i4 + 3] = 0; continue; }
          warp(u, v);
          let X = WX + tear, Y = WY;
          if (AHi > 0.02) X += (hash1(x * 7.13 + y * 13.7 + tick) - 0.5) * 0.014 * AHi;
          if (mv === "ripple") { X += 0.035 * turb * Math.sin(Y * 9 + T * 1.3); Y += 0.05 * turb * Math.sin(X * 5 - T * 0.9); }
          else if (mv === "swirl") {
            const rr = X * X + Y * Y, a = 0.3 * Math.sin(T * 0.11) + 0.9 * turb * Math.exp(-rr * 2.5) * Math.sin(T * 0.19), c = Math.cos(a), s2 = Math.sin(a);
            const nx = X * c - Y * s2; Y = X * s2 + Y * c + T * 0.01; X = nx;
          } else if (mv === "spin") { const nx = (X * cR - Y * sR) * breathe; Y = (X * sR + Y * cR) * breathe; X = nx; }
          else if (mv === "melt") { const nx = X + 0.06 * turb * Math.sin(Y * 3.1 + T * 0.5) + 0.025 * Math.sin(Y * 7 - T * 0.8); Y += 0.06 * turb * Math.cos(X * 2.7 - T * 0.4); X = nx; }
          else if (mv === "hold") {
            // a character: still at rest, the middle twists as the sound and the macros push it
            const rr = X * X + Y * Y, a = (0.25 + 0.6 * (turb - 0.45)) * Math.exp(-rr * 2.2) * Math.sin(T * 0.23);
            if (a) { const c = Math.cos(a), s2 = Math.sin(a), nx = X * c - Y * s2; Y = X * s2 + Y * c; X = nx; }
          } else if (mv === "mosaic") { const rw = Math.floor((Y + 1) * 12); X += (hash1(rw + Math.floor(T * 1.5) * 3.1) - 0.5) * (0.012 + 0.03 * turb); Y += T * 0.004; }
          else { Y -= T * 0.012; X += 0.018 * turb * Math.sin(Y * 4 + T * 0.4); }
          const sx = mir * X * kz + cxo, sy = -Y * kz + cyo;
          if (isChar) {
            let r0, g0, b0;
            charSample(t0, sx, sy); r0 = CS[0]; g0 = CS[1]; b0 = CS[2];
            if (split > 0.002) { const o = split * kz; charSample(t0, sx + o, sy); r0 = CS[0]; charSample(t0, sx - o, sy + o * 0.3); b0 = CS[2]; }
            if (tone2 === "neon") { const k = r0; r0 = g0; g0 = b0; b0 = k; }
            let r1 = tone01(r0, x + 0.5, y), g1 = tone01(g0, x, y), b1 = tone01(b0, x, y + 0.5);
            const lu = 0.3 * r1 + 0.59 * g1 + 0.11 * b1, li = (lu * 255) | 0, gr = tone2 === "duo" ? 1 : grade, sat = 1 + push * 0.9;
            r1 = lu + (r1 - lu) * sat; g1 = lu + (g1 - lu) * sat; b1 = lu + (b1 - lu) * sat;
            let r = r1 * 255 * (1 - gr) + L[li * 3] * gr, g = g1 * 255 * (1 - gr) + L[li * 3 + 1] * gr, b = b1 * 255 * (1 - gr) + L[li * 3 + 2] * gr;
            if (F.analog) { const w = F.analog.y; r += 22 * w; g += 6 * w; b -= 18 * w; }
            d[i4] = r; d[i4 + 1] = g; d[i4 + 2] = b; d[i4 + 3] = 255;
            continue;
          }
          let lg = gs(sx, sy);
          if (morph > 0.02) lg += (atlasSample(t1, sx, sy) - lg) * morph;
          let lr = lg, lb = lg;
          if (split > 0.002) {
            const o = split * kz;
            lr = gs(sx + o, sy); lb = gs(sx - o, sy + o * 0.3);
            if (morph > 0.02) { lr += (atlasSample(t1, sx + o, sy) - lr) * morph; lb += (atlasSample(t1, sx - o, sy + o * 0.3) - lb) * morph; }
          }
          const ig = tone(lg, x, y), ir = split > 0.002 ? tone(lr, x + 0.5, y) : ig, ib = split > 0.002 ? tone(lb, x, y + 0.5) : ig;
          let r = L[ir * 3], g = L[ig * 3 + 1], b = L[ib * 3 + 2];
          if (F.analog) { const w = F.analog.y; r += 22 * w; g += 6 * w; b -= 18 * w; }
          d[i4] = r; d[i4 + 1] = g; d[i4 + 2] = b; d[i4 + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
    }
    function terrainShade(d) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = y * S + x, i4 = i * 4;
        if (d[i4 + 3] === 0 && (x - S / 2) * (x - S / 2) + (y - S / 2) * (y - S / 2) > S * S * 0.26) continue;
        const h = hbuf[i], hx = hbuf[Math.min(i + 1, S * S - 1)] - h, hy = hbuf[Math.min(i + S, S * S - 1)] - h;
        const shade = clamp(0.55 + (hx * -1 + hy * 1) * 22);
        const c = h * 16, fr = Math.abs((c % 1) - 0.5) * 2;
        const slope = Math.hypot(hx, hy) * 16 + 0.0001;
        const line = ss(1 - Math.min(0.5, slope * 1.6), 1, fr);
        const major = Math.round(c) % 5 === 0;
        const li = (clamp(h * 1.25 - 0.1) * 255) | 0;
        let r = L1[li * 3] * (0.4 + shade), g = L1[li * 3 + 1] * (0.4 + shade), b = L1[li * 3 + 2] * (0.4 + shade);
        const lw = line * (major ? 1 : 0.55), li2 = (clamp(h) * 255) | 0;
        r = r * (1 - lw) + L2[li2 * 3] * lw; g = g * (1 - lw) + L2[li2 * 3 + 1] * lw; b = b * (1 - lw) + L2[li2 * 3 + 2] * lw;
        if (F.clip || F.drive || F.crush || F.analog || F.tape) { postColor(r, g, b); r = PC[0]; g = PC[1]; b = PC[2]; }
        d[i4] = r; d[i4 + 1] = g; d[i4 + 2] = b; d[i4 + 3] = 255;
      }
    }
    function chromeBlobs(st) {
      const out = [], n = noise;
      for (let k = 0; k < 6; k++) {
        const ph = k * 1.7 + (look.seed | 0) * 0.37;
        out.push({ x: 0.62 * Math.sin(t * 0.13 * (1 + k * 0.21) + ph), y: 0.62 * Math.cos(t * 0.11 * (1 + k * 0.17) + ph * 1.3), r: 0.16 + 0.12 * n(k * 3.3, 1.7) * st.zoom * 0.7 });
      }
      PADS.forEach((pd) => out.push({ x: pd.u, y: pd.v, r: 0.1 + 0.16 * pd.mx }));
      return out;
    }
    function chromeField(bl, x, y) {
      let F = 0;
      for (let k = 0; k < bl.length; k++) { const b = bl[k], dx = x - b.x, dy = y - b.y; F += (b.r * b.r) / (dx * dx + dy * dy + 0.004); }
      return F;
    }

    function drawDots(W, st, h1, h2) {
      ctx.fillStyle = "#08080a";
      ctx.fillRect(0, 0, W, W);
      const N = Math.round(64 + 10 * st.zoom), cell = W / N, buckets = F.crush && F.crush.x > 0.01 ? Math.max(3, Math.round(10 - F.crush.x * 7)) : 10;
      const gain = 1 + (F.clip ? F.clip.x * 4 : 0) + (F.drive ? F.drive.x * 2 : 0), hard = F.clip ? F.clip.y : 0.3;
      const crushGrid = F.crush && F.crush.y > 0.02 ? cell * (1 + F.crush.y * 4) : 0;
      const paths = []; for (let k = 0; k < buckets; k++) paths.push(new Path2D());
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const u = ((i + 0.5) / N) * 2 - 1, v = 1 - ((j + 0.5) / N) * 2;
          if (u * u + v * v > 1) continue;
          warp(u, v);
          const hh = fbm(WX * st.zoom * 0.9 + t * 0.15, WY * st.zoom * 0.9 - t * 0.08, 4);
          const ph = WY * 22 + hh * 16 * st.turb + Math.sin(WX * 3 + t * 0.3) * 2;
          const bv = 0.5 + 0.5 * Math.sin(ph + t * 0.6);
          const lift = ss(0.25, 0.75, hh);
          let val = clamp(bv * (0.25 + 0.85 * lift));
          if (gain > 1) { const c = val * gain; val = clamp(Math.tanh(c) * (1 - hard) + Math.min(c, 1) * hard); }
          if (val < 0.06) continue;
          const dy = Math.sin(ph) * cell * 0.35 + (WX - u) * W * 0.12;
          const rad = cell * (0.12 + 0.36 * val) * (1 + (gain - 1) * 0.12);
          const k = Math.min(buckets - 1, (val * buckets) | 0);
          let cx = (u + 1) * 0.5 * W + (WX - u) * W * 0.3, cy = (1 - v) * 0.5 * W + dy;
          if (crushGrid) { cx = Math.round(cx / crushGrid) * crushGrid; cy = Math.round(cy / crushGrid) * crushGrid; paths[k].rect(cx - rad, cy - rad, rad * 2, rad * 2); continue; }
          paths[k].moveTo(cx + rad, cy);
          paths[k].arc(cx, cy, rad, 0, Math.PI * 2);
        }
      }
      for (let k = 0; k < buckets; k++) {
        const x = k / (buckets - 1);
        const hue = h1 + (((h2 - h1 + 540) % 360) - 180) * ss(0.55, 1, x) * 0.6;
        const sat = Math.min(100, 55 + 30 * x + (gain - 1) * 15);
        ctx.fillStyle = `hsl(${hue.toFixed(0)} ${sat.toFixed(0)}% ${Math.min(92, 22 + 60 * x * st.bright).toFixed(0)}%)`;
        ctx.fill(paths[k]);
      }
    }

    function drawWaves(W, st, h1, h2) {
      const bgc = `hsl(${h1} 30% 4%)`;
      ctx.fillStyle = bgc;
      ctx.fillRect(0, 0, W, W);
      const lines = 44, pts = F.crush && F.crush.y > 0.02 ? Math.max(10, Math.round(72 - F.crush.y * 60)) : 72;
      const gain = 1 + (F.clip ? F.clip.x * 4 : 0) + (F.drive ? F.drive.x * 2 : 0), hard = F.clip ? F.clip.y : 0.3;
      const crushStep = F.crush && F.crush.x > 0.01 ? 0.004 + F.crush.x * 0.05 : 0;
      const stair = !!(F.crush && F.crush.y > 0.02);
      ctx.lineWidth = Math.max(1, W / 360);
      for (let j = 0; j < lines; j++) {
        const y0 = -0.92 + (j / (lines - 1)) * 1.84;
        const vv = -y0;
        ctx.beginPath();
        const ys = [];
        for (let i = 0; i <= pts; i++) {
          const u = -1 + (2 * i) / pts;
          warp(u, vv);
          const env = Math.pow(clamp(1 - u * u * 0.9), 1.5);
          let hh = (fbm(WX * st.zoom * 1.2 + t * 0.12, WY * 3.2 + j * 0.02, 4) - 0.38) * env * 0.42 * (0.6 + st.turb);
          for (const pd of PADS) { const dx = u - pd.u, dy = vv - pd.v; hh += Math.exp(-(dx * dx + dy * dy) * 7) * (0.06 + 0.22 * pd.my); }
          hh = Math.max(0, hh) + (WY - vv) * 0.5;
          if (gain > 1) { const c = (hh / 0.25) * gain; hh = 0.25 * Math.max(0, Math.tanh(c) * (1 - hard) + Math.min(c, 1) * hard); }
          if (crushStep) hh = Math.round(hh / crushStep) * crushStep;
          ys.push(vv - Math.max(0, hh));
        }
        const lineTo = (i) => { const x = (i / pts) * W, y = (1 - ys[i]) * 0.5 * W; if (!i) ctx.moveTo(x, y); else { if (stair) ctx.lineTo(x, (1 - ys[i - 1]) * 0.5 * W); ctx.lineTo(x, y); } };
        for (let i = 0; i <= pts; i++) lineTo(i);
        ctx.lineTo(W, W); ctx.lineTo(0, W); ctx.closePath();
        ctx.fillStyle = bgc;
        ctx.fill();
        const x = j / (lines - 1);
        const hue = h1 + (((h2 - h1 + 540) % 360) - 180) * ss(0.4, 1, x) * 0.7;
        ctx.strokeStyle = `hsl(${hue.toFixed(0)} ${Math.min(100, 80 + (gain - 1) * 10).toFixed(0)}% ${Math.min(90, 38 + 38 * st.bright * (0.4 + 0.6 * Math.sin(x * Math.PI)) + (gain - 1) * 6).toFixed(0)}%)`;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) lineTo(i);
        ctx.stroke();
      }
    }

    function draw(st, dt) {
      const W = canvas.width;
      if (!W) return;
      const t0 = performance.now();
      const au = st.audio || {}, act = au.act || 0, hit = au.hit || 0;
      // time only runs while the sound plays (or a point is dragged): idle = a still picture
      t += dt * (0.04 + st.speed);
      RT += dt * (0.01 + 0.99 * ss(0.02, 0.3, act));
      AW = au.wave || null; AWamp = 0.06 * act + 0.05 * hit; ATw = 0.45 * (au.mid || 0) * act; AHi = (au.high || 0) * act;
      st = Object.assign({}, st, { zoom: st.zoom * (1 - 0.1 * hit - 0.05 * (au.low || 0) * act), bright: st.bright * (1 + 0.3 * hit) });
      PADS = st.pads;
      F = st.force || {};
      const h1 = look.hue + st.hueShift, h2 = look.hue2 + st.hueShift * 0.6;
      luts(h1, h2, st.bright);
      ctx.save();
      ctx.clearRect(0, 0, W, W);
      ctx.beginPath();
      ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
      ctx.clip();
      const useFam = fam && (!IMG || IMG.set === "ref" ? ATLAS : IMG.set === "char" ? CHARS : true);
      if (useFam) famPixels(st, h1, h2);
      else if (look.style === "dots") drawDots(W, st, h1, h2);
      else if (look.style === "waves") drawWaves(W, st, h1, h2);
      if (useFam || (look.style !== "dots" && look.style !== "waves")) {
        if (!useFam) pixels(st);
        ctx.imageSmoothingEnabled = !(F.crush && F.crush.y > 0.02);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(off, 0, 0, S, S, 0, 0, W, W);
        ctx.imageSmoothingEnabled = true;
        if (useFam || look.style === "grain" || look.style === "liquid" || look.style === "terrain" || F.analog) {
          if (!grainPat) grainPat = ctx.createPattern(grain, "repeat");
          ctx.globalCompositeOperation = "overlay";
          ctx.globalAlpha = Math.min(0.6, (useFam ? 0.16 : look.style === "grain" ? 0.32 : 0.12) + (F.analog ? 0.1 + F.analog.y * 0.3 : 0));
          const gq = Math.floor(RT * 24); // the grain flickers with the sound, rests when idle
          ctx.translate((hash1(gq) * 160) | 0, (hash1(gq + 0.5) * 160) | 0);
          ctx.fillStyle = grainPat;
          ctx.fillRect(-160, -160, W + 320, W + 320);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
      }
      overlays(W, st);
      const vg = ctx.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W / 2);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(0.8, "rgba(0,0,0,0.18)");
      vg.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, W);
      ctx.restore();
      const ms = performance.now() - t0;
      frameMs = frameMs * 0.9 + ms * 0.1;
      // Clean sound = a sharp picture (rendered up to near screen size); the more clip, drive or
      // crush, the coarser it gets on purpose. Slow machines settle lower by frame time.
      const dirt = Math.max(F.clip ? F.clip.x : 0, F.drive ? F.drive.x : 0, F.crush ? F.crush.x : 0, useFam ? DMG.dirt : 0);
      const cap = Math.max(100, Math.round(Math.min(440, W * 0.8) * (1 - 0.72 * Math.min(1, dirt * 1.3))));
      if (S > cap) S = cap;
      else if (frameMs > 22 && S > 90) S = Math.max(90, Math.round(S * 0.9));
      else if (frameMs < 12 && S < cap) S = Math.min(cap, S + Math.max(4, Math.round(S * 0.06)));
    }
    // effects drawn on top of any style
    function overlays(W, st) {
      const P = (u, v) => [((u + 1) / 2) * W, ((1 - v) / 2) * W];
      if (F.space && (F.space.x > 0.01 || F.space.y > 0.01)) {
        // glow / blur: a tiny copy scaled back up, screened on top
        const sw = Math.max(16, Math.round(W / 10));
        small.width = small.height = sw;
        sctx.drawImage(canvas, 0, 0, sw, sw);
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.25 + F.space.x * 0.55;
        ctx.drawImage(small, -W * 0.02, -W * 0.02, W * 1.04, W * 1.04);
        ctx.globalAlpha = F.space.x * 0.5;
        ctx.drawImage(small, -W * 0.08 * F.space.x, -W * 0.08 * F.space.x, W * (1 + 0.16 * F.space.x), W * (1 + 0.16 * F.space.x));
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        // echoes: rings ripple out of every point
        if (F.space.y > 0.01) {
          ctx.lineWidth = Math.max(1, W / 400);
          for (const pd of PADS) {
            const [cx, cy] = P(pd.u, pd.v);
            for (let e = 0; e < 4; e++) {
              const fr = (RT * 0.35 + e / 4) % 1;
              ctx.strokeStyle = `rgba(200,235,255,${(F.space.y * 0.5 * (1 - fr)).toFixed(3)})`;
              ctx.beginPath(); ctx.arc(cx, cy, W * (0.09 + fr * 0.4), 0, Math.PI * 2); ctx.stroke();
            }
          }
        }
      }
      if (F.filter) {
        // resonance: a glowing ring whose size follows the cutoff
        const rz = F.filter.y - 0.5;
        if (rz > 0.02) {
          const rad = W * (0.1 + 0.38 * F.filter.x);
          ctx.strokeStyle = `rgba(150,210,255,${(rz * 1.4).toFixed(3)})`;
          ctx.lineWidth = W * (0.004 + rz * 0.02);
          ctx.shadowColor = "rgba(120,190,255,0.9)"; ctx.shadowBlur = W * 0.03;
          ctx.beginPath(); ctx.arc(W / 2, W / 2, rad, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      if (F.arp && F.arp.rate >= 0) {
        const [cx, cy] = P(F.arp.u, F.arp.v), fr = F.arp.phase;
        ctx.strokeStyle = `rgba(56,245,194,${(0.75 * (1 - fr)).toFixed(3)})`;
        ctx.lineWidth = W * 0.008 * (1 - fr) + 1;
        ctx.beginPath(); ctx.arc(cx, cy, W * (0.05 + fr * 0.7), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(56,245,194,${(0.18 * Math.exp(-fr * 6)).toFixed(3)})`;
        ctx.fillRect(0, 0, W, W);
      }
      if (F.clip && F.clip.x > 0.3) {
        // tears: a few horizontal slices shoved sideways
        const n = Math.round((F.clip.x - 0.3) * 12), seed = Math.floor(RT * 8);
        for (let k = 0; k < n; k++) {
          const y = hash1(seed * 7 + k) * W, h = W * (0.005 + hash1(seed + k * 3) * 0.03), dx = (hash1(seed * 3 + k) - 0.5) * W * 0.12 * F.clip.x;
          ctx.drawImage(canvas, 0, y, W, h, dx, y, W, h);
        }
      }
      if (F.gate && F.gate.y > 0.01) {
        const hz = [2, 4, 8, 16][Math.min(3, Math.floor(F.gate.x * 4))] / 2;
        const fr = (RT * hz) % 1, off = ss(0.45, 0.55, fr) * (1 - ss(0.92, 1, fr));
        ctx.fillStyle = `rgba(0,0,0,${(off * F.gate.y * 0.62).toFixed(3)})`;
        ctx.fillRect(0, 0, W, W);
      }
    }
    return { draw, setLook, get res() { return S; }, get family() { return fam; }, get image() { return IMG; } };
  }

  // ---------------------------------------------------------------- the star
  // The landscape can be a star shaped like the one in the KILLTOY wordmark (traced from
  // favicon.png: edge[i] = its radius at i*2 degrees around its centre of mass, counter-clockwise
  // from the right, 1 = the top tip; the gaps between spikes are filled out a little so the middle
  // circle fits). In a box 0..1: c = its centre (the landscape's centre too), r = the tip radius, ri = the middle circle (where the old
  // circle's edge is) in tip radii. The middle works like the circle; a point dragged past its
  // edge into a spike goes extreme in that spike's flavour (pad.star = [spike, depth]).
  // The star look is parked for now (Eman, 2026-10-30): the Play page is the round circle again
  // and presets lose any spike a point was pushed into. true brings the star back.
  const SHOW_STAR = false;
  const dropStars = (p) => { let n = 0; if (!SHOW_STAR) for (const d of arr(p && p.pads)) if (d && d.star) { delete d.star; n++; } return n > 0; };
const STAR = { c: [0.5, 0.5], r: 0.4969, ri: 0.48,
  edge: [0.630,0.645,0.676,0.735,0.792,0.825,0.847,0.864,0.874,0.879,0.873,0.859,0.844,0.818,0.779,0.754,0.741,0.717,0.672,0.628,0.599,0.572,0.544,0.522,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.544,0.566,0.587,0.611,0.624,0.660,0.728,0.767,0.800,0.866,0.918,0.947,0.973,0.991,0.996,0.985,0.954,0.913,0.873,0.830,0.779,0.741,0.710,0.669,0.635,0.612,0.583,0.554,0.539,0.528,0.521,0.522,0.522,0.520,0.520,0.520,0.523,0.534,0.548,0.568,0.593,0.614,0.661,0.739,0.794,0.833,0.879,0.923,0.955,0.970,0.976,0.968,0.942,0.904,0.852,0.786,0.727,0.682,0.637,0.587,0.555,0.541,0.524,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.522,0.543,0.566,0.605,0.648,0.677,0.695,0.719,0.768,0.839,0.898,0.935,0.958,0.968,0.973,0.975,0.969,0.951,0.920,0.875,0.810,0.737,0.671,0.617,0.575,0.537,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.520,0.543,0.569,0.602,0.642,0.687,0.734,0.789,0.846,0.888,0.918,0.942,0.955,0.955,0.943,0.934,0.927,0.910,0.871,0.811,0.750,0.698,0.660,0.638,0.622,0.594,0.555,0.524,0.520,0.520,0.526,0.535,0.545,0.557,0.567,0.578,0.594,0.608,0.619] };
  const SPIKES = [   // the same five on every preset, clockwise from the top
    { id: "explode", label: "Explode", deg: 90, color: "#ff3b4e", desc: "Red: everything goes into the clipper, hard" },
    { id: "tape", label: "Tape", deg: 18, color: "#c9a7ff", desc: "Played back from a worn, wobbly tape" },
    { id: "crush", label: "Crush", deg: 308, color: "#c9a7ff", desc: "Steppy and gritty, bitcrushed" },
    { id: "wide", label: "Wide", deg: 238, color: "#c9a7ff", desc: "Left and right move apart: huge and moving" },
    { id: "dark", label: "Dark", deg: 162, color: "#c9a7ff", desc: "Deep and muffled, like behind a wall" },
  ];
  SPIKES.forEach((sp) => { sp.a = (sp.deg * Math.PI) / 180; sp.r = STAR.edge[Math.round(sp.deg / 2) % STAR.edge.length]; });
  // spikes that sound too close to what a kind already does (the point stops at the edge there)
  const SPIKE_SKIP = { macro: [0, 1, 2, 3, 4], clip: [0], tape: [1], analog: [1], crush: [2], space: [3] };
  const spikeOk = (kind, s) => s >= 0 && s < SPIKES.length && !(SPIKE_SKIP[kind] || []).includes(s);
  const SPIKE_END = 0.8;   // how far out a point goes: depth 1 sits at this share of the tip
  const STAR_PTS = STAR.edge.map((e, i) => { const a = (i * Math.PI) / 90; return [STAR.c[0] + Math.cos(a) * e * STAR.r, STAR.c[1] - Math.sin(a) * e * STAR.r]; });
  const STAR_CLIP = "polygon(" + STAR_PTS.map(([x, y]) => (x * 100).toFixed(2) + "% " + (y * 100).toFixed(2) + "%").join(",") + ")";
  const STAR_D = "M" + STAR_PTS.map(([x, y]) => (x * 1000).toFixed(1) + " " + (y * 1000).toFixed(1)).join("L") + "Z";
  // one spike's own area: the star's edge within +-34 degrees of its tip, closed along the middle circle
  function spikeD(sp) {
    let d = "";
    const ri = STAR.ri * STAR.r * 1000, cx = STAR.c[0] * 1000, cy = STAR.c[1] * 1000;
    for (let k = -17; k <= 17; k++) {
      const i = ((Math.round(sp.deg / 2) + k) % 180 + 180) % 180, a = (i * Math.PI) / 90;
      const e = Math.max(STAR.edge[i], STAR.ri) * STAR.r * 1000;
      d += (d ? "L" : "M") + (cx + Math.cos(a) * e).toFixed(1) + " " + (cy - Math.sin(a) * e).toFixed(1);
    }
    const a1 = sp.a - (34 * Math.PI) / 180, a0 = sp.a + (34 * Math.PI) / 180;
    d += `L${(cx + Math.cos(a0) * ri).toFixed(1)} ${(cy - Math.sin(a0) * ri).toFixed(1)}A${ri.toFixed(1)} ${ri.toFixed(1)} 0 0 1 ${(cx + Math.cos(a1) * ri).toFixed(1)} ${(cy - Math.sin(a1) * ri).toFixed(1)}Z`;
    return d;
  }

  // square <-> disc (elliptical grid mapping), so every macro pair is reachable
  const PAD_REACH = 0.84;
  function padToDisc(mx, my) {
    const x = mx * 2 - 1, y = my * 2 - 1;
    return [x * Math.sqrt(1 - (y * y) / 2) * PAD_REACH, y * Math.sqrt(1 - (x * x) / 2) * PAD_REACH];
  }
  function discToPad(u, v) {
    u /= PAD_REACH; v /= PAD_REACH;
    const r = Math.hypot(u, v);
    if (r > 1) { u /= r; v /= r; }
    const s2 = 2 * Math.SQRT2, q = (a) => Math.sqrt(Math.max(0, a));
    const uu = u * u, vv = v * v;
    const x = 0.5 * q(2 + uu - vv + s2 * u) - 0.5 * q(2 + uu - vv - s2 * u);
    const y = 0.5 * q(2 - uu + vv + s2 * v) - 0.5 * q(2 - uu + vv - s2 * v);
    return [clamp((x + 1) / 2), clamp((y + 1) / 2)];
  }

  function parseKey(k) {
    const m = /^\s*([A-Ga-g])([#b]?)\s*(m(?!aj)|min(or)?)?/.exec(k || "");
    if (!m) return null;
    return { note: m[1].toUpperCase() + m[2], minor: !!m[3] };
  }

  function defaultFavStore() {
    const KEY = "toymachine.favourites";
    return {
      get() { try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch (e) { return []; } },
      set(names) { try { localStorage.setItem(KEY, JSON.stringify(names)); } catch (e) { /* private window */ } },
    };
  }

  const COMPUTER_KEYS = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14 };

  // ================================================================ the window
  function open(host, opts) {
    opts = opts || {};
    const api = opts.api || {};
    const call = (fn, ...a) => { try { if (typeof api[fn] === "function") return api[fn](...a); } catch (e) { console.warn("[ToyMachine] api." + fn, e); } };
    // Automation (host side: app.js). Params: "macro.<i>", "pad.<k>.x" / "pad.<k>.y", "ampEnv.r", "filter.cutoff".
    // touch(): a hand move (n = 0..1) so the host can record it; end = the drag let go.
    // What the song's automation is doing right now (host: showAutomation), shown instead of the
    // preset's own values while it plays. Display only: the preset isn't changed.
    let autoShow = {};
    // Running dice (host meter: m.dice) move the points live too, so you see what wanders.
    let diceShow = {}, diceSig = "";
    const shown = (param, v) => (autoShow[param] ? autoShow[param].v : diceShow[param] != null ? diceShow[param] : v);
    // Which params have an automation line on the song (host: opts.autoHas): such a point or slider gets a small
    // purple A, and its menu offers Show / Clear automation (Zed call 2, 7 Nov 13:00). TM_AUTO_MARK_OFF = old.
    const autoHas = (params) => { if (window.TM_AUTO_MARK_OFF || typeof opts.autoHas !== "function") return false; try { return !!opts.autoHas(params); } catch (e) { return false; } };
    const touch = (param, n, label, end) => { if (typeof opts.onTouch === "function") try { opts.onTouch({ param, value: clamp(n), label, end: !!end }); } catch (e) { console.warn("[ToyMachine] onTouch", e); } };
    const AXES = { clip: ["amount", "hardness"], drive: ["amount", "character"], analog: ["drift", "warmth"], tape: ["wobble", "age"], arp: ["rate", "pattern"], filter: ["cutoff", "resonance"],
                   motion: ["rate", "depth"], space: ["reverb", "echo"], crush: ["bits", "rate"], gate: ["rate", "depth"] };
    // an effect point's automation names its kind, so a line only ever moves the same kind of point
    // (a Space line never turns into an Arp after flipping presets)
    const padParam = (k, axis) => `pad.${k}.${full.pads[k].kind}.${axis ? "y" : "x"}`;
    const padLabel = (k, axis) => { const pd = full.pads[k]; const ax = AXES[pd.kind] || ["left/right", "up/down"]; return KINDS[pd.kind].label + " " + ax[axis]; };
    // The small "A" next to a control: press it and its automation lane appears under the track.
    function aBtn(get) {
      const b = el("button", "tm-abtn", "A");
      b.title = "Automate this: a line for it appears under the track";
      if (typeof opts.onAutomate !== "function") b.hidden = true;
      // the params it automates, so the host can find this control again (KILLTOY 2's open icon pulses round it)
      try { const i = get(); b.dataset.autoParams = (i.params ? i.params.map((x) => x.param) : [i.param]).join(" "); } catch (e) { /* not ready yet */ }
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.addEventListener("click", (e) => {
        e.stopPropagation(); e.preventDefault(); const info = get();
        // An effect point the window added on open (filter, space, motion, clip: addCorePoints) isn't in the song's
        // preset until something is moved, so its line played into nothing (9 Nov overnight test: every effect-point
        // line was silent on a new TOY MACHINE). The window's preset goes to the song first. TM_AUTO_CORE_OLD = old.
        if (!window.TM_AUTO_CORE_OLD && (info.params || [info]).some((x) => /^pad\./.test(x.param || ""))) flushPreset();
        opts.onAutomate({ ...info, direct: true }, e);
      });
      return b;
    }
    const favStore = opts.favourites && opts.favourites.get ? opts.favourites : defaultFavStore();
    // MY PRESETS (sounds saved from CREATE SOUND, kept in this browser) come first in the list
    const withMine = (list) => (window.ToyMachineCreate && !window.KT2_TM_CREATE_OFF ? ToyMachineCreate.mine.entries() : []).concat((Array.isArray(list) ? list : []).filter((e) => !e.mine));
    let index = withMine(opts.presetIndex);

    let orig = isObj(opts.preset) ? opts.preset : {};
    const coreAdded = [addCorePoints(orig), dropStars(orig)].some(Boolean);
    let full = applyMacros(withDefaults(orig));
    let base = clone(full); // the preset as loaded: where a disabled point goes back to
    // The keyboard's octave: every preset has a home octave (a bass sits low), shown as 0; the
    // +/- offset from it stays when you change sounds (and between windows).
    const octStore = { get() { try { return +localStorage.getItem("tm-oct-offset") || 0; } catch (e) { return 0; } }, set(v) { try { localStorage.setItem("tm-oct-offset", String(v)); } catch (e) { /* private window */ } } };
    let octOff = clamp(octStore.get(), -3, 3);
    let page = "play", closed = false, bound = [], kbBase = 48, held = new Set(), compHeld = new Map();
    kbBase = clamp(homeOctave(full) + 12 * octOff, 12, 96);
    let dragEnergy = 0, activePad = -1, refreshQueued = false, linkQueued = false;
    let browser = null;

    const root = el("div", "tm-root");
    root.tabIndex = 0;
    host.appendChild(root);

    // ------------------------------------------------ editing
    let spTimer = null, spLast = 0;
    function pushPreset() {
      if (spTimer) return;
      const wait = Math.max(0, 33 - (performance.now() - spLast));
      spTimer = setTimeout(() => { spTimer = null; spLast = performance.now(); call("setPreset", orig); }, wait);
    }
    function flushPreset() {
      if (spTimer) { clearTimeout(spTimer); spTimer = null; }
      spLast = performance.now();
      call("setPreset", orig);
    }
    function set(path, value, quiet) {
      path = parsePath(path);
      setIn(full, path, value);
      setIn(orig, path, value, full);
      // a target that is moved by hand while a macro owns it: the macro wins again on next move
      if (!quiet) { pushPreset(); queueRefresh(); }
    }
    /** Both arrays at `path`, with orig's made to mirror full's length. */
    function pair(path) {
      path = parsePath(path);
      const fa = getIn(full, path);
      let oa = getIn(orig, path);
      if (!Array.isArray(oa)) { oa = []; setIn(orig, path, oa, full); oa = getIn(orig, path); }
      while (oa.length < fa.length) oa.push(clone(fa[oa.length]));
      if (oa.length > fa.length) oa.length = fa.length;
      return [fa, oa];
    }
    function setMacro(i, v, fast) {
      const m = full.macros[i];
      if (!m) return;
      v = clamp(v);
      m.value = v;
      setIn(orig, ["macros", i, "value"], v, full);
      applyMacro(full, m, (path, val) => setIn(orig, path, val, full));
      if (fast) call("setMacro", i, v);
      else pushPreset();
      queueRefresh();
    }
    function reapplyMacro(i) {
      applyMacro(full, full.macros[i], (path, val) => setIn(orig, path, val, full));
    }
    function queueRefresh() {
      if (refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => { refreshQueued = false; refresh(); });
    }
    function refresh() {
      if (closed) return;
      for (const f of bound) { try { f(); } catch (e) { console.warn("[ToyMachine] refresh", e); } }
    }
    const bind = (f) => { bound.push(f); f(); return f; };

    // ------------------------------------------------ controls
    function specFor(path) {
      path = parsePath(path);
      if (path[0] === "fx") {
        const f = full.fx[path[1]];
        if (!f) return FALLBACK;
        if (path[2] === "peaks") return PEAK_META[path[4]] || FALLBACK;
        return (FX_META[f.type] && FX_META[f.type][path[2]]) || FALLBACK;
      }
      if (path[0] === "mods") { const m = full.mods[path[1]]; return m ? modAmtMeta(m.dst) : R.bip; }
      if (path[0] === "out" && path[1] === "level") return OUT_LEVEL;
      if (path[2] === "amount" && path[1] === "warp") { const w = getIn(full, [path[0], "warp", "type"]); if (w === "bend") return R.bip; }
      const s = path.join(".");
      for (const [re, sp] of META) if (re.test(s)) return sp;
      return FALLBACK;
    }
    function defaultFor(path) {
      path = parsePath(path);
      if (path[0] === "fx") {
        const f = full.fx[path[1]];
        if (!f) return 0;
        if (path[2] === "peaks") return PEAK_DEF[path[4]];
        if (f.type === "texture") return texModeDefaults(f.mode)[path[2]];
        return getIn(FX_DEFAULTS[f.type] || {}, path.slice(2));
      }
      if (path[0] === "mods") return 0;
      return getIn(DEF_FULL, path);
    }

    /** A round knob bound to a preset path. Drag up/down (Shift fine), scroll, double-click resets. */
    function knob(label, path, spec, extra) {
      path = parsePath(path);
      spec = spec || specFor(path);
      const k = el("div", "tm-knob" + (spec.bi ? " tm-bi" : ""));
      k.title = "Drag up or down (Shift for fine), scroll, double-click to reset";
      k.innerHTML = '<svg viewBox="0 0 44 44"><path class="tm-k-track"/><path class="tm-k-arc"/><line class="tm-k-tick" x1="22" y1="12" x2="22" y2="17"/></svg>';
      const track = k.querySelector(".tm-k-track"), arcEl = k.querySelector(".tm-k-arc"), tick = k.querySelector(".tm-k-tick");
      track.setAttribute("d", arcPath(22, 22, 16, -135, 135));
      const lab = el("div", "tm-k-label", label), val = el("div", "tm-k-value");
      k.append(lab, val);
      let n = 0;
      const update = () => {
        const v = getIn(full, path);
        n = toN(spec, typeof v === "number" ? v : spec.min);
        const a = -135 + 270 * n, a0 = spec.bi ? 0 : -135;
        arcEl.setAttribute("d", Math.abs(a - a0) < 0.5 ? "" : arcPath(22, 22, 16, Math.min(a0, a), Math.max(a0, a)));
        tick.setAttribute("transform", `rotate(${a.toFixed(1)} 22 22)`);
        val.textContent = spec.fmt(typeof v === "number" ? v : spec.min);
        if (extra && extra.dim) k.classList.toggle("tm-dim", !!extra.dim());
      };
      const commit = (nn) => {
        n = clamp(nn);
        set(path, fromN(spec, n), true);
        update();
        pushPreset();
        if (extra && extra.onChange) extra.onChange();
        queueRefresh();
      };
      k.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        root.focus({ preventScroll: true });
        k.setPointerCapture(e.pointerId);
        k.classList.add("tm-active");
        let lastY = e.clientY, acc = n;
        const move = (ev) => {
          acc = clamp(acc + (lastY - ev.clientY) * 0.005 * (ev.shiftKey ? 0.15 : 1));
          lastY = ev.clientY;
          commit(acc);
        };
        const up = () => { k.classList.remove("tm-active"); k.removeEventListener("pointermove", move); k.removeEventListener("pointerup", up); k.removeEventListener("pointercancel", up); flushPreset(); };
        k.addEventListener("pointermove", move);
        k.addEventListener("pointerup", up);
        k.addEventListener("pointercancel", up);
      });
      k.addEventListener("dblclick", () => { const d = defaultFor(path); if (typeof d === "number") commit(toN(spec, d)); });
      k.addEventListener("wheel", (e) => { e.preventDefault(); commit(n - Math.sign(e.deltaY) * (e.shiftKey ? 0.005 : 0.02)); }, { passive: false });
      bind(update);
      return k;
    }

    /** A small value box: drag up/down to change, double-click to type a value. */
    function dragNum(path, spec, onChange) {
      path = parsePath(path);
      const b = el("div", "tm-num");
      b.title = "Drag up or down, double-click to type";
      const fill = el("i"), txt = el("span");
      b.append(fill, txt);
      let n = 0;
      const sp = () => (typeof spec === "function" ? spec() : spec) || specFor(path);
      const update = () => {
        const s = sp(), v = getIn(full, path);
        n = toN(s, typeof v === "number" ? v : 0);
        txt.textContent = s.fmt(typeof v === "number" ? v : 0);
        if (s.bi) { const z = toN(s, 0); fill.style.left = Math.min(z, n) * 100 + "%"; fill.style.width = Math.abs(n - z) * 100 + "%"; }
        else { fill.style.left = "0"; fill.style.width = n * 100 + "%"; }
      };
      const commit = (v) => { set(path, v, true); update(); if (onChange) onChange(); pushPreset(); queueRefresh(); };
      b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || b.querySelector("input")) return;
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        let lastY = e.clientY, acc = n;
        const move = (ev) => { acc = clamp(acc + (lastY - ev.clientY) * 0.005 * (ev.shiftKey ? 0.15 : 1)); lastY = ev.clientY; commit(fromN(sp(), acc)); };
        const up = () => { b.removeEventListener("pointermove", move); b.removeEventListener("pointerup", up); flushPreset(); };
        b.addEventListener("pointermove", move);
        b.addEventListener("pointerup", up);
      });
      b.addEventListener("wheel", (e) => { e.preventDefault(); commit(fromN(sp(), n - Math.sign(e.deltaY) * 0.02)); }, { passive: false });
      b.addEventListener("dblclick", () => {
        const inp = el("input", "tm-num-input");
        inp.value = String(getIn(full, path) ?? 0);
        b.append(inp);
        inp.focus(); inp.select();
        const done = (ok) => { if (ok) { const v = parseFloat(inp.value); if (isFinite(v)) commit(v); } inp.remove(); };
        inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
        inp.addEventListener("blur", () => done(true));
      });
      bind(update);
      return b;
    }

    function select(path, options, onChange, cls) {
      path = parsePath(path);
      const s = el("select", "tm-select" + (cls ? " " + cls : ""));
      for (const o of options) {
        const [v, label] = Array.isArray(o) ? o : [o, o];
        const op = el("option", null, label);
        op.value = JSON.stringify(v);
        s.append(op);
      }
      s.addEventListener("change", () => { set(path, JSON.parse(s.value)); if (onChange) onChange(); flushPreset(); });
      s.addEventListener("keydown", (e) => e.stopPropagation());
      bind(() => { const v = JSON.stringify(getIn(full, path) ?? null); if (s.value !== v) s.value = v; });
      return s;
    }
    function toggle(label, path, onChange) {
      path = parsePath(path);
      const b = btn("tm-toggle", "<i></i><span></span>");
      b.querySelector("span").textContent = label;
      b.addEventListener("click", () => { set(path, !getIn(full, path)); if (onChange) onChange(); flushPreset(); refresh(); });
      bind(() => b.classList.toggle("tm-on", !!getIn(full, path)));
      return b;
    }
    function power(path, onChange) {
      path = parsePath(path);
      const b = btn("tm-power", ICON.power, "On / off");
      b.addEventListener("click", (e) => { e.stopPropagation(); set(path, !getIn(full, path)); if (onChange) onChange(); flushPreset(); refresh(); });
      bind(() => b.classList.toggle("tm-on", !!getIn(full, path)));
      return b;
    }

    // ------------------------------------------------ skeleton
    root.innerHTML = `
      <div class="tm-top">
        <div class="tm-brand"><img class="tm-wordmark tm-logo" src="toymachine-logo.png" alt="TOY MACHINE" draggable="false"><span class="tm-title"></span></div>
        <div class="tm-nav">
          <button type="button" class="tm-iconbtn tm-prev" title="Previous preset">${ICON.left}</button>
          <button type="button" class="tm-presetname" title="Browse presets"></button>
          <button type="button" class="tm-iconbtn tm-next" title="Next preset">${ICON.right}</button>
        </div>
        <div class="tm-topright">
          <button type="button" class="tm-iconbtn tm-heart" title="Favourite">${ICON.heart}</button>
          <button type="button" class="tm-iconbtn tm-rnd" title="Random preset">${ICON.shuffle}</button>
          <button type="button" class="tm-iconbtn tm-save" title="Save preset (.json)">${ICON.save}</button>
          <div class="tm-out" title="Output level (double-click for 0 dB)"><div class="tm-meter"><i class="tm-ml"></i><i class="tm-mr"></i></div><div class="tm-out-thumb"></div></div>
          <button type="button" class="tm-iconbtn tm-closebtn" title="Close">${ICON.close}</button>
        </div>
      </div>
      <div class="tm-main">
        <nav class="tm-rail">
          <button type="button" data-page="play" class="tm-railbtn">${ICON.play}<span>Play</span></button>
          <button type="button" data-page="engine" class="tm-railbtn">${ICON.engine}<span>Engine</span></button>
          <button type="button" data-page="effects" class="tm-railbtn">${ICON.effects}<span>Effects</span></button>
          <button type="button" data-page="texture" class="tm-railbtn">${ICON.grains}<span>Texture</span></button>
          <button type="button" data-page="arp" class="tm-railbtn">${ICON.arp}<span>Arp</span></button>
          <button type="button" data-page="drop" class="tm-railbtn">${ICON.drop}<span>Drop zone</span></button>
          <button type="button" data-page="textures" class="tm-railbtn">${ICON.layers}<span>Textures</span></button>
        </nav>
        <div class="tm-pages">
          <section class="tm-page tm-page-play"></section>
          <section class="tm-page tm-page-engine"></section>
          <section class="tm-page tm-page-effects"></section>
          <section class="tm-page tm-page-texture"></section>
          <section class="tm-page tm-page-arp"></section>
          <section class="tm-page tm-page-drop"></section>
          <section class="tm-page tm-page-textures"></section>
        </div>
      </div>
      <div class="tm-kb"></div>`;
    const $ = (s) => root.querySelector(s);
    // Without the wide display font (Archivo), the CSS draws the wordmark and titles wide by hand.
    function checkWideFont() {
      try {
        const c = document.createElement("canvas").getContext("2d");
        c.font = '900 40px "Archivo", monospace';
        const a = c.measureText("TOY MACHINE").width;
        c.font = "900 40px monospace";
        root.classList.toggle("tm-nowide", Math.abs(a - c.measureText("TOY MACHINE").width) < 0.5);
      } catch (e) { root.classList.add("tm-nowide"); }
    }
    checkWideFont();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!closed) checkWideFont(); });
    const pages = { play: $(".tm-page-play"), engine: $(".tm-page-engine"), effects: $(".tm-page-effects"), texture: $(".tm-page-texture"), arp: $(".tm-page-arp"), drop: $(".tm-page-drop"), textures: $(".tm-page-textures") };
    $(".tm-title").textContent = opts.title ? opts.title : "";
    if (typeof opts.onClose !== "function") $(".tm-closebtn").remove();
    else $(".tm-closebtn").addEventListener("click", () => close());

    root.querySelectorAll(".tm-railbtn").forEach((b) => b.addEventListener("click", () => showPage(b.dataset.page)));
    function showPage(p, focusId) {
      page = p;
      root.querySelectorAll(".tm-railbtn").forEach((b) => b.classList.toggle("tm-sel", b.dataset.page === p));
      for (const k in pages) pages[k].hidden = k !== p;
      root.dataset.page = p;
      refresh();
      if (p === "play") queueLinks();
      if (focusId) {
        const tgt = pages[p].querySelector(`[data-sec="${focusId}"]`);
        if (tgt) {
          tgt.scrollIntoView({ block: "start", behavior: "smooth" });
          tgt.classList.remove("tm-flash"); void tgt.offsetWidth; tgt.classList.add("tm-flash");
        }
      }
    }

    // PRESETS / CREATE SOUND (ui/toymachine-create.js, Eman 10 Nov): the same synth and circle; CREATE SOUND
    // turns the circle into a nest for dropped sounds with a prompt under it. KT2_TM_CREATE_OFF = no tabs.
    let mode = "presets", create = null, modeTabs = null;
    const CREATE_OK = !!(window.ToyMachineCreate && !window.KT2_TM_CREATE_OFF);
    if (CREATE_OK && !opts.hostModeTabs) {
      // the tabs sit on the Play page's top left, above the macros, so the top bar stays as it was
      // (hosts add their own buttons there: KILLTOY 2's VST / SPLIT / MIDI)
      modeTabs = el("div", "tm-modetabs");
      modeTabs.innerHTML = '<button type="button" class="tm-modetab tm-sel" data-mode="presets">PRESETS</button><button type="button" class="tm-modetab" data-mode="create">CREATE SOUND</button>';
      modeTabs.querySelectorAll(".tm-modetab").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
    }
    function setMode(m) {
      mode = m === "create" && CREATE_OK ? "create" : "presets";
      root.querySelectorAll(".tm-modetab").forEach((b) => b.classList.toggle("tm-sel", b.dataset.mode === mode));
      root.classList.toggle("tm-create", mode === "create");
      if (page !== "play") showPage("play");
      sizeDisc(); refresh();
      if (mode === "create" && create) create.activate();
      if (mode === "create") { const i = root.querySelector(".tm-cs-input"); if (i && !(create && create.grown)) setTimeout(() => i.focus(), 0); }
    }
    /** Loose search for CREATE SOUND's seeds: the presets sharing the most words with the prompt. */
    function searchLoose(text, n) {
      const toks = String(text || "").toLowerCase().split(/[^a-z0-9#+]+/).filter((w) => w.length > 2 && !/^(and|with|the|like|that|from|into|sound|very|some|slowly|kind|sort)$/.test(w));
      if (!toks.length) return [];
      return index.filter((e) => !e.mine).map((e) => {
        const t = termsOf(e);
        let sc = 0;
        for (const q of toks) { const al = ALIAS[q]; if (t.words.indexOf(q) >= 0 || (al && t.words.indexOf(al) >= 0)) sc += 2; else if (t.name.indexOf(q) >= 0) sc += 1; }
        return [e, sc + Math.random() * 0.5];
      }).filter((x) => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
    }

    // top bar
    $(".tm-presetname").addEventListener("click", () => (browser ? closeBrowser() : openBrowser()));
    $(".tm-presetname").title = "Browse presets (opens a panel on the right; the ring stays playable)";
    $(".tm-prev").addEventListener("click", () => step(-1));
    $(".tm-heart").addEventListener("click", () => { toggleFav(curEntry()); refresh(); });
    $(".tm-rnd").addEventListener("click", () => { if (index.length) loadEntry(index[(Math.random() * index.length) | 0]); });
    bind(() => { $(".tm-heart").classList.toggle("tm-on", isFav(curEntry())); $(".tm-rnd").disabled = !index.length; });
    $(".tm-next").addEventListener("click", () => step(1));
    $(".tm-save").addEventListener("click", () => {
      if (typeof opts.onSave === "function") { opts.onSave(orig); return; }
      try {
        const blob = new Blob([JSON.stringify(orig, null, 2)], { type: "application/json" });
        const a = el("a");
        a.href = URL.createObjectURL(blob);
        a.download = (full.name || "preset") + ".json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch (e) { console.warn(e); }
    });
    bind(() => { window.setTickerText ? setTickerText($(".tm-presetname"), full.name || "Init") : ($(".tm-presetname").textContent = full.name || "Init"); });
    (function outSlider() {
      const box = $(".tm-out"), thumb = $(".tm-out-thumb");
      bind(() => { thumb.style.left = toN(OUT_LEVEL, full.out.level) * 100 + "%"; box.title = "Output " + fmt.db(full.out.level) + " (double-click for 0 dB)"; });
      const fromX = (x) => { const r = box.getBoundingClientRect(); set(["out", "level"], Math.round(fromN(OUT_LEVEL, (x - r.left) / r.width) * 10) / 10); };
      box.addEventListener("pointerdown", (e) => {
        e.preventDefault(); box.setPointerCapture(e.pointerId); fromX(e.clientX);
        const mv = (ev) => fromX(ev.clientX), up = () => { box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); flushPreset(); };
        box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up);
      });
      box.addEventListener("dblclick", () => { set(["out", "level"], 0); flushPreset(); });
    })();

    // ------------------------------------------------ PLAY page
    let land = null, discEl, padLayer, linkSvg, macroCol, sideEl, stage, discSize = 300, palette = null, dropZone = null, starSvg = null;
    // The star is parked (Eman, 30 Oct: "make it round as it was"): SHOW_STAR brings it back,
    // with a star/circle button remembered per computer.
    let shape = SHOW_STAR ? "star" : "circle";
    try { if (SHOW_STAR && localStorage.getItem("tm-shape") === "circle") shape = "circle"; } catch (e) { /* private window */ }
    let hasPreset = isObj(opts.preset), newPadIdx = -1;
    function renderPlay() {
      const pg = pages.play;
      pg.textContent = "";
      palette = null;
      macroCol = el("div", "tm-macros");
      stage = el("div", "tm-stage");
      sideEl = el("div", "tm-side");
      linkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      linkSvg.setAttribute("class", "tm-links");
      pg.append(macroCol, stage, sideEl, linkSvg);
      if (modeTabs) pg.append(modeTabs);

      const ring = el("div", "tm-discring");
      discEl = el("div", "tm-disc");
      const cv = el("canvas", "tm-land");
      padLayer = el("div", "tm-padlayer");
      starSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      starSvg.setAttribute("class", "tm-starsvg");
      starSvg.setAttribute("viewBox", "0 0 1000 1000");
      const sc = STAR.c.map((v) => v * 1000), sri = STAR.ri * STAR.r * 1000;
      starSvg.innerHTML = SPIKES.map((sp, i) => `<path class="tm-spike" data-s="${i}" style="--sc:${sp.color}" d="${spikeD(sp)}"/>`).join("")
        + `<circle class="tm-star-in" cx="${sc[0].toFixed(1)}" cy="${sc[1].toFixed(1)}" r="${sri.toFixed(1)}"/><path class="tm-star-edge" d="${STAR_D}"/>`
        + SPIKES.map((sp, i) => {
          // the name sits inside the spike, near its tip
          const rr = sp.r * 0.9 * STAR.r * 1000, x = sc[0] + Math.cos(sp.a) * rr, y = sc[1] - Math.sin(sp.a) * rr + 7;
          return `<text class="tm-spike-t" data-s="${i}" style="--sc:${sp.color}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${sp.label.toUpperCase()}</text>`;
        }).join("");
      discEl.append(cv, starSvg, padLayer);
      ring.append(discEl);
      cv.style.clipPath = shape === "star" ? STAR_CLIP : "";
      root.classList.toggle("tm-star", shape === "star");
      const add = btn("tm-addpad", ICON.plus + "<span>Add</span>", "Add a point: a macro pair or a force (clip, drive, arp...)");
      add.addEventListener("click", (e) => { e.stopPropagation(); togglePalette(ring, add); });
      ring.append(add);
      const lookBtn = btn("tm-lookbtn", ICON.look + "<span>Look</span>", "The picture inside the circle: Auto picks one for this kind of sound");
      lookBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleLooks(ring, lookBtn); });
      ring.append(lookBtn);
      const shapeBtn = btn("tm-shapebtn", "", "");
      const shapeShow = () => {
        shapeBtn.innerHTML = shape === "star" ? ICON.star : ICON.sub;
        shapeBtn.title = shape === "star" ? "Star: drag a point past the middle into a spike and it goes extreme in that spike's flavour. Click to compare with the old circle"
          : "Circle (the old way). Click for the star";
      };
      shapeShow();
      shapeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        shape = shape === "star" ? "circle" : "star";
        try { localStorage.setItem("tm-shape", shape); } catch (err) { /* private window */ }
        root.classList.toggle("tm-star", shape === "star");
        cv.style.clipPath = shape === "star" ? STAR_CLIP : "";
        shapeShow(); sizeDisc();
      });
      if (SHOW_STAR) ring.append(shapeBtn);
      dropZone = el("div", "tm-drop");
      dropZone.innerHTML = `<div class="tm-drop-in"><div class="tm-drop-ico">${ICON.sampler}</div><div class="tm-drop-t">Drop any sound</div><div class="tm-drop-s">to make it a synth</div><div class="tm-drop-busy">Listening\u2026</div></div>`;
      ring.append(dropZone);
      dropZone.addEventListener("click", () => {
        const inp = el("input"); inp.type = "file"; inp.accept = "audio/*";
        inp.addEventListener("change", () => { if (inp.files && inp.files[0]) dropSound(inp.files[0]); });
        inp.click();
      });
      stage.append(ring);
      if (create) create.decorate(stage, ring);
      land = Landscape(cv);
      land.setLook(full.look, { category: full.category, name: full.name, tags: full.tags });
      bind(() => { add.disabled = full.pads.length >= MAX_PADS; root.classList.toggle("tm-nopreset", !hasPreset); });

      renderMacroCol();
      renderPads();
      renderSide();
      sizeDisc();
    }
    function usedMacros() { const s = new Set(); full.pads.forEach((p) => { if (p.kind === "macro") { s.add(p.x); s.add(p.y); } }); return [...s]; }
    function freeMacroPair() {
      const used = usedMacros(), free = [];
      for (let i = 0; i < MAX_MACROS && free.length < 2; i++) if (used.indexOf(i) < 0) free.push(i);
      return free.length === 2 ? free : null;
    }
    function padXY(pd) {
      if (pd.kind === "macro") return [full.macros[pd.x] ? shown("macro." + pd.x, full.macros[pd.x].value) : 0, full.macros[pd.y] ? shown("macro." + pd.y, full.macros[pd.y].value) : 0];
      const k = full.pads.indexOf(pd), p = pd.pos || [0, 0.5];
      return [shown(padParam(k, 0), p[0]), shown(padParam(k, 1), p[1])];
    }
    function padReadout(pd) {
      const [x, y] = padXY(pd);
      if (pd.kind === "macro") return [full.macros[pd.x].name + " " + pctS(x), full.macros[pd.y].name + " " + pctS(y)];
      return KINDS[pd.kind].read(x, y);
    }
    /** The spike a point sits in, or null: { s, d } (depth 0..1). */
    function padSpike(pd) {
      const st = pd && pd.star;
      if (!Array.isArray(st) || !spikeOk(pd.kind, +st[0])) return null;
      return { s: +st[0], d: clamp(+st[1] || 0) };
    }
    /** Where a point is drawn, as a share of the landscape box (0..1 from the top left). */
    function padBox(pd) {
      const [u, v] = padToDisc(...padXY(pd));
      if (shape !== "star") return [(u + 1) / 2, (1 - v) / 2];
      const sp = padSpike(pd);
      if (sp) {
        const S = SPIKES[sp.s], rr = (STAR.ri + sp.d * (S.r * SPIKE_END - STAR.ri)) * STAR.r;
        return [STAR.c[0] + Math.cos(S.a) * rr, STAR.c[1] - Math.sin(S.a) * rr];
      }
      const k = (STAR.ri * STAR.r) / PAD_REACH;
      return [STAR.c[0] + u * k, STAR.c[1] - v * k];
    }
    /** A spot in the box -> the point's two values, and its spike when it's past the middle on the star. */
    function boxToPad(bx, by, kind) {
      if (shape !== "star") return { pos: discToPad(bx * 2 - 1, 1 - by * 2), star: null };
      const dx = (bx - STAR.c[0]) / STAR.r, dy = (STAR.c[1] - by) / STAR.r, rho = Math.hypot(dx, dy);
      if (rho > STAR.ri && kind !== "macro") {
        const ang = Math.atan2(dy, dx);
        let best = -1, bd = 9;
        SPIKES.forEach((S, i) => { const d = Math.abs(Math.atan2(Math.sin(ang - S.a), Math.cos(ang - S.a))); if (d < bd) { bd = d; best = i; } });
        if (best >= 0 && bd < 0.45 && spikeOk(kind, best)) {
          const S = SPIKES[best], depth = clamp((rho * Math.cos(bd) - STAR.ri) / (S.r * SPIKE_END - STAR.ri));
          // past the edge the point keeps the values where it left the middle, along the spike
          if (depth > 0.02) return { pos: discToPad(Math.cos(S.a) * PAD_REACH, Math.sin(S.a) * PAD_REACH), star: [best, +depth.toFixed(3)] };
        }
      }
      const k = PAD_REACH / STAR.ri;
      return { pos: discToPad(dx * k, dy * k), star: null };
    }
    function setStar(k, st) {
      const [fp, op] = pair("pads");
      if (!fp[k]) return;
      if (st && SHOW_STAR) { fp[k].star = st.slice(); op[k].star = st.slice(); } else { delete fp[k].star; delete op[k].star; }
    }
    // the spikes light up with the points in them (red for Explode); while a point is held, the
    // ones it can go into show faintly and the others fade
    function paintStar() {
      if (!starSvg) return;
      const depth = SPIKES.map(() => 0);
      full.pads.forEach((pd) => { const sp = !pd.off && padSpike(pd); if (sp) depth[sp.s] = Math.max(depth[sp.s], 0.15 + 0.85 * sp.d); });
      const held = activePad >= 0 && full.pads[activePad] ? full.pads[activePad].kind : null;
      starSvg.querySelectorAll(".tm-spike").forEach((e) => { const i = +e.dataset.s; e.style.setProperty("--d", depth[i].toFixed(3)); e.classList.toggle("tm-can", !!held && spikeOk(held, i)); });
      starSvg.querySelectorAll(".tm-spike-t").forEach((e) => { const i = +e.dataset.s; e.classList.toggle("tm-lit", depth[i] > 0); e.classList.toggle("tm-no", !!held && !spikeOk(held, i)); });
    }
    function sizeDisc() {
      if (!stage || !stage.isConnected) return;
      const r = stage.getBoundingClientRect();
      if (!r.width) return;
      const cg = !!(create && create.grown), refsOut = !!(create && create.refs.length && !cg);
      const below = mode === "create" ? (cg ? 142 : 112) : 0, side = mode === "create" && refsOut ? 150 : 0;
      const D = Math.max(160, Math.floor(Math.min(r.width - 24 - side, r.height - 24 - below)));
      discSize = D;
      stage.style.paddingBottom = below ? below + "px" : "";
      const ring = stage.querySelector(".tm-discring");
      ring.style.width = ring.style.height = D + "px";
      const cv = stage.querySelector("canvas");
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const inner = shape === "star" ? D : D - 2 * Math.round(D * 0.022);
      const px = Math.round(inner * dpr);
      if (cv.width !== px) cv.width = cv.height = px;
      root.style.setProperty("--tm-disc", inner + "px");
      // the points keep their size relative to the middle, so on the star they're a bit smaller
      root.style.setProperty("--tm-dot", Math.round(shape === "star" ? inner * 0.64 : inner) + "px");
      positionPads();
      queueLinks();
      if (create) create.layout(inner);
    }

    // ---- the dice: a macro or a point wanders around its own spot, in the song's pace.
    // preset.dice = { "m<macro>": { amt, speed }, "p<point>": {...} }; the engine host plays it.
    const DICE_STEPS = ["4 bars", "2 bars", "1 bar", "1/2", "1/4", "1/8", "1/16"];
    const diceGet = (key) => (orig.dice && orig.dice[key]) || null;
    function diceSet(key, d) {
      const all = Object.assign({}, orig.dice || {});
      if (d && d.amt > 0.001) all[key] = { amt: +d.amt.toFixed(3), speed: +(d.speed == null ? 0.5 : d.speed).toFixed(3) };
      else delete all[key];
      orig.dice = all;
      // the cutoff's dice needs the filter on (wide open: no change until it moves)
      if (key === "scutoff" && all[key] && full.filter.on === false) { set(["filter", "on"], true, true); set(["filter", "cutoff"], 20000, true); }
      pushPreset(); queueRefresh();
    }
    let dicePop = null;
    function closeDice() { if (dicePop) { dicePop.remove(); dicePop = null; } }
    function diceBtn(key) {
      const b = el("button", "tm-dice");
      b.type = "button";
      b.innerHTML = '<svg viewBox="0 0 24 24"><circle class="tm-dice-ring" cx="12" cy="12" r="10.5"/><path class="tm-dice-arc"/><rect x="6.5" y="6.5" width="11" height="11" rx="2.6"/><circle cx="9.6" cy="9.6" r="1.15" fill="currentColor"/><circle cx="14.4" cy="14.4" r="1.15" fill="currentColor"/><circle cx="12" cy="12" r="1.15" fill="currentColor"/></svg>';
      bind(() => {
        const d = diceGet(key), on = !!(d && d.amt > 0);
        b.classList.toggle("tm-dice-on", on);
        b.querySelector(".tm-dice-arc").setAttribute("d", on ? arcPath(12, 12, 10.5, 0, Math.max(8, d.amt * 359.9)) : "");
        b.style.setProperty("--dice-dur", on ? (0.25 + (1 - d.speed) * 1.6).toFixed(2) + "s" : "0s");
        b.title = on ? `Dice: moves ${Math.round(d.amt * 100)}% every ${DICE_STEPS[Math.round(d.speed * 6)]}. Drag up/down for how much, click for speed` : "Dice: drag up to make it move by itself (in the song's pace); click for speed";
      });
      b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        b.setPointerCapture(e.pointerId);
        const y0 = e.clientY, d0 = diceGet(key) || { amt: 0, speed: 0.5 };
        let moved = false;
        const mv = (ev) => {
          if (!moved && Math.abs(ev.clientY - y0) < 4) return;
          moved = true; closeDice();
          diceSet(key, { amt: clamp(d0.amt + (y0 - ev.clientY) * 0.006), speed: d0.speed });
        };
        const up = () => { b.removeEventListener("pointermove", mv); b.removeEventListener("pointerup", up); if (moved) flushPreset(); else openDice(key, b); };
        b.addEventListener("pointermove", mv); b.addEventListener("pointerup", up);
      });
      return b;
    }
    function openDice(key, anchor) {
      const was = dicePop && dicePop.dataset.key === key;
      closeDice();
      if (was) return;
      const d = Object.assign({ amt: 0.3, speed: 0.5 }, diceGet(key) || {});
      if (!diceGet(key)) diceSet(key, d); // clicking an idle dice switches it on at 30%
      dicePop = el("div", "tm-dicepop"); dicePop.dataset.key = key;
      const r = anchor.getBoundingClientRect(), rr = root.getBoundingClientRect();
      dicePop.style.left = r.left - rr.left + r.width / 2 + "px"; dicePop.style.top = r.bottom - rr.top + 8 + "px";
      const amtRow = el("div", "tm-dp-row"), amtLab = el("span", "tm-dp-lab", "Amount"), amtVal = el("span", "tm-dp-val");
      const amt = el("div", "tm-rel-track"), fill = el("i", "tm-rel-fill"), th = el("b", "tm-rel-thumb");
      amt.append(fill, th);
      let show = () => { const c = diceGet(key) || { amt: 0, speed: d.speed }; fill.style.width = th.style.left = c.amt * 100 + "%"; amtVal.textContent = Math.round(c.amt * 100) + "%"; steps.querySelectorAll("button").forEach((x, i) => x.classList.toggle("tm-on", i === Math.round(c.speed * 6))); };
      const setAmt = (x) => { const b = amt.getBoundingClientRect(), c = diceGet(key) || d; diceSet(key, { amt: clamp((x - b.left) / b.width), speed: c.speed }); show(); };
      amt.addEventListener("pointerdown", (e) => { e.preventDefault(); amt.setPointerCapture(e.pointerId); setAmt(e.clientX); const mv = (ev) => setAmt(ev.clientX), up = () => { amt.removeEventListener("pointermove", mv); amt.removeEventListener("pointerup", up); flushPreset(); }; amt.addEventListener("pointermove", mv); amt.addEventListener("pointerup", up); });
      amtRow.append(amtLab, amtVal);
      const steps = el("div", "tm-dp-steps");
      DICE_STEPS.forEach((lab, i) => { const sb = el("button", null, lab); sb.type = "button"; sb.addEventListener("click", () => { const c = diceGet(key) || d; diceSet(key, { amt: c.amt || 0.3, speed: i / 6 }); flushPreset(); show(); }); steps.append(sb); });
      // a clear ON / OFF switch in the corner (Eman, 31 Oct): off keeps the amount and speed, so on brings them back
      let last = Object.assign({}, diceGet(key) || d);
      const head = el("div", "tm-dp-head"), sw = el("button", "tm-dp-sw"); sw.type = "button";
      const paintSw = () => { const on = !!diceGet(key); sw.classList.toggle("tm-on", on); sw.textContent = on ? "ON" : "OFF"; sw.title = on ? "Switch this dice off: it goes back to its spot" : "Switch it on again"; dicePop.classList.toggle("tm-dp-isoff", !on); };
      sw.addEventListener("click", () => { const c = diceGet(key); if (c) { last = c; diceSet(key, null); } else diceSet(key, last.amt > 0.001 ? last : { amt: 0.3, speed: last.speed }); flushPreset(); paintSw(); show(); });
      head.append(el("div", "tm-dp-h", "Dice"), sw);
      dicePop.append(head, amtRow, amt, el("div", "tm-dp-lab", "Speed (moves every)"), steps);
      root.append(dicePop);
      const _show = show; show = () => { _show(); paintSw(); };
      show();
      const away = (ev) => { if (dicePop && !dicePop.contains(ev.target) && !anchor.contains(ev.target)) { closeDice(); document.removeEventListener("pointerdown", away, true); } };
      setTimeout(() => document.addEventListener("pointerdown", away, true));
    }

    // ---- live pictures under every control (Eman 2026-10-27: "a visual on all of them, like the cutoff").
    // Each point row draws what its force does to the sound; it follows the point on the ring, the
    // automation, and the dice while it wanders. Drag a picture: left/right = the point's x, up/down = y.
    // The sliders' dice (Release, Cutoff, Pan) wander on top of the bar; showDice() puts where
    // each one is right now in diceShow under its own key ("srelease"...): octaves, octaves, pan.
    const SLIDER_DICE = { srelease: 0, scutoff: 1, span: 2 }, SLIDER_DICE_SEED = [1.9, 7.07, 12.24], SLIDER_DICE_SPAN = [1.5, 3, 1];   // same as the worklet's
    const diceNow = (key) => (diceShow[key] != null && diceGet(key) ? diceShow[key] : null);
    const liveViews = new Set();   // { el, draw(), busy() } redrawn every frame while busy
    let graphT = 0;
    function tickViews(dt) {
      graphT += dt * (0.35 + snd.act * 1.4);
      for (const v of liveViews) {
        if (!v.el.isConnected) { liveViews.delete(v); continue; }
        if (v.busy()) v.draw();
      }
    }
    function sizeCanvas(cv, box) {
      const w = box.clientWidth, h = box.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!w || !h) return null;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      return { ctx, w, h };
    }
    const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
    // fn(px) -> -1..1 drawn as a line across the box (y up), step: px per point
    function traceWave(ctx, w, h, fn, step = 1) {
      const mid = h / 2, A = mid - 4, p = new Path2D();
      for (let x = 0; x <= w; x += step) { const y = mid - clamp(fn(x), -1.15, 1.15) * A; x ? p.lineTo(x, y) : p.moveTo(x, y); }
      return p;
    }
    function strokeGlow(ctx, path, col, lw, glow) {
      ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (glow) { ctx.shadowColor = col; ctx.shadowBlur = glow; }
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(path); ctx.restore();
    }
    const TAU = Math.PI * 2;
    const baseWave = (t) => 0.78 * Math.sin(t) + 0.22 * Math.sin(2 * t + 0.6);   // a plain note with a bit of body
    const hash1 = (n) => { const v = Math.sin(n * 91.345 + 17.1) * 43758.5453; return v - Math.floor(v); };
    // paint(ctx, w, h, x, y, c, t): x, y = the point (0..1), c = its colour, t = running time
    const POINT_PIC = {
      // a note pushed into a wall: what gets cut off glows red, soft = rounded shoulders
      clip(ctx, w, h, x, y, c) {
        const g = Math.pow(10, x * 36 / 20 * 0.55), per = w / 2.6, ceil = 0.78, hard = y;
        const raw = (px) => baseWave(px / per * TAU) * 0.62 * g;
        const shape = (v) => { const s = Math.tanh(v / ceil) * ceil, k = clamp(v, -ceil, ceil); return s + (k - s) * hard; };
        const mid = h / 2, A = mid - 4;
        ctx.fillStyle = "rgba(255,59,78,0.22)";
        ctx.beginPath();
        for (let px = 0; px <= w; px++) { const v = raw(px), s = shape(v); if (Math.abs(v) > Math.abs(s) + 0.01) { ctx.rect(px, mid - Math.max(v, s) * A, 1, Math.abs(v - s) * A); } }
        ctx.fill();
        ctx.setLineDash([2, 3]); ctx.strokeStyle = rgba(c, 0.45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, mid - ceil * A); ctx.lineTo(w, mid - ceil * A); ctx.moveTo(0, mid + ceil * A); ctx.lineTo(w, mid + ceil * A); ctx.stroke(); ctx.setLineDash([]);
        strokeGlow(ctx, traceWave(ctx, w, h, (px) => shape(raw(px))), rgba(c, 0.95), 1.6, 3 + x * 10);
      },
      // the note through the drive's own curve: soft and tube round off, fold wraps back on itself,
      // rectify flips the bottom up (an octave up)
      drive(ctx, w, h, x, y, c, t) {
        const g = 1 + x * x * 9, ch = Math.min(3, Math.floor(y * 4)), per = w / 2.2;
        const sh = [(v) => Math.tanh(v), (v) => Math.tanh(v + 0.35) - Math.tanh(0.35) * (1 - Math.abs(Math.tanh(v)) * 0.4), (v) => Math.sin(v * 1.2), (v) => Math.abs(Math.tanh(v)) * 2 - 1][ch];
        const norm = ch === 2 || ch === 3 ? 1 : Math.tanh(g * 0.7) || 1;
        const fn = (px) => sh(baseWave(px / per * TAU + t * 0.6) * 0.7 * g) / (ch < 2 ? norm : 1) * 0.85;
        const mid = h / 2, path = traceWave(ctx, w, h, fn);
        const heat = ctx.createLinearGradient(0, 0, 0, h);
        heat.addColorStop(0, rgba(c, 0.05 + x * 0.25)); heat.addColorStop(0.5, rgba(c, 0)); heat.addColorStop(1, rgba(c, 0.05 + x * 0.25));
        ctx.save(); const fill = new Path2D(path); fill.lineTo(w, mid); fill.lineTo(0, mid); ctx.fillStyle = heat; ctx.fill(fill); ctx.restore();
        strokeGlow(ctx, path, rgba(c, 0.95), 1.5, 2 + x * 9);
      },
      // three copies of the saw drifting apart in pitch; warm rounds the corners off
      analog(ctx, w, h, x, y, c, t) {
        const parts = Math.max(2, Math.round(14 - y * 11)), per = w / 3;
        const saw = (ph) => { let v = 0; for (let k = 1; k <= parts; k++) v += Math.sin(k * ph) / k; return v * 0.55; };
        for (let i = 0; i < 3; i++) {
          const det = (i - 1) * x * 0.09, drift = Math.sin(t * 0.5 + i * 2.1) * x * 0.6;
          strokeGlow(ctx, traceWave(ctx, w, h, (px) => saw(px / per * TAU * (1 + det) + drift) * (0.9 - i * 0.05), 1.5), rgba(c, i === 1 ? 0.95 : 0.35 + x * 0.25), i === 1 ? 1.5 : 1.1, i === 1 ? 2 + y * 6 : 0);
        }
      },
      // the tape: the wave sways in pitch (wow), older tape gets duller, squashed and hissy
      tape(ctx, w, h, x, y, c, t) {
        const per = w / 3.2, dull = Math.max(1, Math.round(6 - y * 5));
        let ph = 0;
        const pts = [];
        for (let px = 0; px <= w; px++) { ph += TAU / per * (1 + x * 0.55 * Math.sin(px / w * TAU * 1.3 + t * 1.2) + x * 0.15 * Math.sin(px / w * TAU * 7 + t * 4)); let v = 0; for (let k = 1; k <= dull; k++) v += Math.sin(k * ph) / (k * k * 0.6 + 0.4); pts.push(Math.tanh(v * (0.8 + y * 1.4)) * 0.85); }
        strokeGlow(ctx, traceWave(ctx, w, h, (px) => pts[Math.min(pts.length - 1, Math.round(px))]), rgba(c, 0.95), 1.5, 3);
        const n = Math.round(y * 70), mid = h / 2;
        ctx.fillStyle = rgba(c, 0.5);
        for (let i = 0; i < n; i++) { const rx = hash1(i + Math.floor(t * 8) * 131) * w, ry = mid + (hash1(i * 3.7 + 9 + Math.floor(t * 8)) - 0.5) * (h - 6); ctx.fillRect(rx, ry, 1, 1); }
      },
      // the notes the arp plays, as blocks: faster = more steps, the pattern sets their heights
      arp(ctx, w, h, x, y, c, t) {
        const r = arpRate(x), mid = h / 2;
        if (r < 0) { ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(c, 0.35); ctx.beginPath(); ctx.moveTo(4, mid); ctx.lineTo(w - 4, mid); ctx.stroke(); ctx.setLineDash([]); return; }
        const steps = [4, 8, 12, 16, 24, 32][r], pat = Math.min(3, Math.floor(y * 4)), sw = (w - 4) / steps;
        const note = (i) => pat === 0 ? i % 4 : pat === 1 ? [0, 1, 2, 3, 2, 1][i % 6] : pat === 2 ? (i % 2 ? 3 : 0) + (i % 4 > 1 ? 0.6 : 0) : Math.floor(hash1(i * 5.3 + 2) * 4);
        const cur = snd.act > 0.03 ? Math.floor(t * steps / 1.6) % steps : -1;
        for (let i = 0; i < steps; i++) {
          const nh = (h - 10) / 4.6, yy = h - 5 - (note(i) + 1) * nh;
          ctx.fillStyle = rgba(c, i === cur ? 1 : 0.6);
          if (i === cur) { ctx.shadowColor = c; ctx.shadowBlur = 8; } else ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(2 + i * sw + 0.5, yy, Math.max(1.5, sw - 1.5), nh * 0.8, 1.5) : ctx.rect(2 + i * sw + 0.5, yy, Math.max(1.5, sw - 1.5), nh * 0.8); ctx.fill();
        }
        ctx.shadowBlur = 0;
      },
      // the filter's curve: left/right moves the cutoff, up adds the resonance peak
      filter(ctx, w, h, x, y, c) {
        const f = full.filter || {}, type = f.type || "lp24", fc0 = clamp(+f.cutoff || 20000, 30, 20000);
        const fc = clamp(fc0 * Math.pow(2, (x - 0.5) * 8), 25, 20000), res = clamp((+f.res || 0) + (y - 0.5), 0, 1);
        const xf = (px) => 20 * Math.pow(1000, px / w), db = (m) => 20 * Math.log10(Math.max(1e-4, m));
        const top = 5, span = h - 8, yOf = (d) => top + clamp((12 - d) / 42, 0, 1) * span;
        const p = new Path2D();
        for (let px = 0; px <= w; px += 1.5) { const yy = yOf(db(filterMag(type, xf(px), fc, res))); px ? p.lineTo(px, yy) : p.moveTo(px, yy); }
        const fill = new Path2D(p); fill.lineTo(w, h); fill.lineTo(0, h);
        const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, rgba(c, 0.3)); gr.addColorStop(1, rgba(c, 0.02));
        ctx.fillStyle = gr; ctx.fill(fill);
        ctx.strokeStyle = rgba(c, 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, yOf(0)); ctx.lineTo(w, yOf(0)); ctx.stroke();
        strokeGlow(ctx, p, rgba(c, 0.95), 1.6, 2 + res * 8);
        const cx = Math.log(fc / 20) / Math.log(1000) * w;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(clamp(cx, 3, w - 3), clamp(yOf(db(filterMag(type, fc, fc, res))), 4, h - 4), 2.6, 0, TAU); ctx.fill();
      },
      // the wobble (the line) and what it does to the note's level (the filled body)
      motion(ctx, w, h, x, y, c, t) {
        const hz = 0.1 * Math.pow(160, x), cyc = clamp(0.6 + Math.log2(hz / 0.1) * 0.55, 0.6, 6), per = w / 14, mid = h / 2;
        const lfo = (px) => Math.sin(px / w * TAU * cyc - t * Math.min(8, hz) * 0.6);
        const env = (px) => 1 - y * 0.5 * (1 - lfo(px));
        ctx.fillStyle = rgba(c, 0.16);
        ctx.beginPath(); ctx.moveTo(0, mid);
        for (let px = 0; px <= w; px += 2) ctx.lineTo(px, mid - env(px) * (mid - 4));
        for (let px = w; px >= 0; px -= 2) ctx.lineTo(px, mid + env(px) * (mid - 4));
        ctx.fill();
        strokeGlow(ctx, traceWave(ctx, w, h, (px) => Math.sin(px / per * TAU) * env(px) * 0.9, 1), rgba(c, 0.55), 1, 0);
        strokeGlow(ctx, traceWave(ctx, w, h, (px) => lfo(px) * (0.15 + y * 0.8), 1.5), rgba(c, 1), 1.7, 6);
      },
      // a hit, then its echoes (up = more of them) and the room's tail (right = longer)
      space(ctx, w, h, x, y, c, t) {
        const mid = h / 2, A = mid - 4, tail = 8 + x * (w - 12);
        // the room: a cloud of reflections fading out (right = a longer room)
        const room = ctx.createLinearGradient(4, 0, 4 + tail, 0);
        room.addColorStop(0, rgba(c, 0.55)); room.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = room;
        for (let px = 5; px < Math.min(w, 5 + tail); px += 1.5) {
          const a = Math.exp(-2.2 * (px - 5) / tail) * (0.25 + 0.75 * hash1(px * 1.7 + Math.floor(t * 6) * 0.37)) * (0.25 + x * 0.75);
          ctx.fillRect(px, mid - a * A, 1, a * A * 2);
        }
        // the echoes: copies of the hit, each quieter (up = more of them, further apart)
        const n = Math.round(y * 7), gap = (w - 12) / (n + 1.2), fb = 0.45 + y * 0.4;
        const dot = (px, a) => { ctx.fillStyle = rgba(c, 0.3 + a * 0.7); ctx.shadowColor = c; ctx.shadowBlur = 6 * a; ctx.fillRect(px - 1.2, mid - a * A, 2.4, a * A * 2); };
        dot(5, 1);
        for (let i = 1; i <= n; i++) dot(5 + i * gap, Math.pow(fb, i));
        ctx.shadowBlur = 0;
        if (n) { ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); for (let i = 0; i <= n; i++) { const px = 5 + i * gap, yy = mid - Math.pow(fb, i) * A; i ? ctx.lineTo(px, yy) : ctx.moveTo(px, yy); } ctx.stroke(); ctx.setLineDash([]); }
      },
      // fewer bits = bigger stairs up and down, a lower rate = wider steps along
      crush(ctx, w, h, x, y, c, t) {
        const per = w / 2.4, bits = 16 - 13 * x, levels = x < 0.01 ? 4096 : Math.max(1.5, Math.pow(2, bits * 0.55 - 1));   // drawn coarser than real so 8 bit already shows
        const hold = 1 + y * y * 16, src = (px) => baseWave(px / per * TAU + t * 0.4) * 0.82;
        strokeGlow(ctx, traceWave(ctx, w, h, src), rgba(c, 0.18), 1, 0);
        const p = new Path2D(), mid = h / 2, A = mid - 4;
        let py = null;
        for (let px = 0; px <= w; px += 1) {
          const sx = Math.floor(px / hold) * hold, v = Math.round(src(sx) * levels) / levels, yy = mid - v * A;
          if (py == null) p.moveTo(px, yy); else { p.lineTo(px, py); p.lineTo(px, yy); }
          py = yy;
        }
        strokeGlow(ctx, p, rgba(c, 0.95), 1.4, 2 + x * 6);
      },
      // the gate chopping the note: faster = more chops, up = deeper
      gate(ctx, w, h, x, y, c, t) {
        const n = [4, 8, 16, 32][Math.min(3, Math.floor(x * 4))], sw = w / n, mid = h / 2, per = w / 18;
        const g = (px) => ((px / sw) % 1 < 0.5 ? 1 : 1 - y);
        const run = snd.act > 0.03 ? Math.floor(t * n / 2) % n : -1;
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = rgba(c, i === run ? 0.5 : 0.16);
          ctx.fillRect(i * sw + 0.5, mid - (mid - 4), sw * 0.5 - 1, (mid - 4) * 2);
        }
        strokeGlow(ctx, traceWave(ctx, w, h, (px) => Math.sin(px / per * TAU) * g(px) * 0.88, 1), rgba(c, 0.95), 1.3, 3);
      },
    };
    // A point's picture under its row. Drag it like the point: left/right and up/down.
    function pointGraph(k) {
      const box = el("div", "tm-fgraph"), cv = el("canvas", "tm-fgraph-cv"), tag = el("span", "tm-fgraph-tag");
      box.append(cv, tag);
      const view = {
        el: box,
        busy: () => snd.act > 0.03,   // the pictures run while the sound plays (the dice redraw them through refresh)
        draw() {
          const pd = full.pads[k];
          if (!pd || pd.kind === "macro") return;
          const s = sizeCanvas(cv, box);
          if (!s) return;
          const paint = POINT_PIC[pd.kind], c = KINDS[pd.kind].color, cur = padXY(pd), rolling = !!diceGet("p" + k) && !pd.off;
          const home = Array.isArray(pd.pos) ? pd.pos : cur, live = rolling ? cur : null;
          if (!paint) return;
          // with the dice on, the point's own spot stays as a faint ghost and the wander draws bright
          if (live) { s.ctx.save(); s.ctx.globalAlpha = 0.28; paint(s.ctx, s.w, s.h, home[0], home[1], c, graphT); s.ctx.restore(); }
          const [x, y] = live || home;
          paint(s.ctx, s.w, s.h, x, y, c, graphT);
          box.classList.toggle("tm-rolling", !!live);
          if (live) tag.textContent = KINDS[pd.kind].read(x, y).join(" · ");
        },
      };
      liveViews.add(view);
      if (window.ResizeObserver) new ResizeObserver(() => view.draw()).observe(box);
      bind(() => { view.draw(); const pd = full.pads[k]; if (pd && !(diceGet("p" + k) && !pd.off)) tag.textContent = ""; });
      box.title = "Drag: left/right and up/down move this point, like dragging it on the circle. Double-click: back to the preset's own spot";
      box.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const pd = full.pads[k];
        if (!pd || pd.off) return;
        e.preventDefault(); box.setPointerCapture(e.pointerId);
        pair("pads");
        const r = box.getBoundingClientRect(), [x0, y0] = Array.isArray(pd.pos) ? pd.pos : padXY(pd), cx = e.clientX, cy = e.clientY;
        activePad = k; box.classList.add("tm-active"); queueLinks();
        const mv = (ev) => {
          const f = ev.shiftKey ? 0.2 : 1;
          const nx = clamp(x0 + (ev.clientX - cx) / r.width * f), ny = clamp(y0 - (ev.clientY - cy) / (r.height * 3) * f);
          set(["pads", k, "pos"], [+nx.toFixed(4), +ny.toFixed(4)], true); call("setPads", orig.pads); queueRefresh();
          touch(padParam(k, 0), nx, padLabel(k, 0)); touch(padParam(k, 1), ny, padLabel(k, 1));
          dragEnergy = Math.min(1.2, dragEnergy + 0.03);
          positionPads();
        };
        const up = () => {
          box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up);
          activePad = -1; box.classList.remove("tm-active"); queueLinks();
          flushPreset(); const [ex, ey] = padXY(full.pads[k]); touch(padParam(k, 0), ex, padLabel(k, 0), true); touch(padParam(k, 1), ey, padLabel(k, 1), true);
        };
        box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
      });
      box.addEventListener("dblclick", () => {
        const pd = full.pads[k];
        if (!pd || pd.off || !NEUTRAL_POS[pd.kind]) return;
        const own = base.pads && base.pads[k] && base.pads[k].kind === pd.kind && Array.isArray(base.pads[k].pos) ? base.pads[k].pos : NEUTRAL_POS[pd.kind];
        set(["pads", k, "pos"], own.slice(), true); setStar(k, base.pads && base.pads[k] && base.pads[k].kind === pd.kind ? base.pads[k].star : null);
        call("setPads", orig.pads); flushPreset(); queueRefresh(); positionPads();
      });
      return box;
    }
    // The macros live in a small drop-down: closed, it shows their values in one line.
    let macrosOpen = false;
    try { macrosOpen = localStorage.getItem("tm.macrosOpen") === "1"; } catch (e) { /* private window */ }

    function renderMacroCol() {
      macroCol.textContent = "";
      // The points' rows scroll on their own when there are many. The macros sit in a drop-down
      // at the top (closed: one line with their values); Release, Cutoff and Pan are on the right.
      const list = el("div", "tm-mlist");
      const fade = () => list.classList.toggle("tm-more", list.scrollTop + list.clientHeight < list.scrollHeight - 4);
      list.addEventListener("scroll", () => { fade(); queueLinks(); }, { passive: true });
      requestAnimationFrame(fade);
      const fold = el("div", "tm-macfold"), foldBody = el("div", "tm-macfold-body");
      const foldHead = btn("tm-macfold-h", '<svg class="tm-macfold-chev" viewBox="0 0 12 12"><path d="M4 2.5l3.5 3.5L4 9.5"/></svg><span class="tm-macfold-t">Macros</span><span class="tm-macfold-sum"></span>', "Show or hide the macros");
      fold.append(foldHead, foldBody);
      const showFold = () => { fold.classList.toggle("tm-open", macrosOpen); foldBody.hidden = !macrosOpen; };
      foldHead.addEventListener("click", () => { macrosOpen = !macrosOpen; try { localStorage.setItem("tm.macrosOpen", macrosOpen ? "1" : "0"); } catch (e) { /* private window */ } showFold(); fade(); queueLinks(); });
      bind(() => {
        const ids = usedMacros().sort((a, b) => a - b).filter((i) => full.macros[i]);
        foldHead.querySelector(".tm-macfold-sum").textContent = ids.map((i) => full.macros[i].name.split(" ")[0] + " " + Math.round(shown("macro." + i, full.macros[i].value) * 100)).join(" · ");
        fold.hidden = !ids.length;
        fold.classList.toggle("tm-rolling", ids.some((i) => diceGet("m" + i)));
      });
      showFold();
      list.append(fold);
      full.pads.forEach((pd, k) => {
        const g = el("div", "tm-mgroup");
        g.dataset.pad = k;
        g.style.setProperty("--kc", KINDS[pd.kind].color);
        if (pd.kind !== "macro") {
          g.classList.add("tm-fgroup");
          const row = el("div", "tm-mrow tm-frow");
          const ic = el("span", "tm-fico");
          ic.innerHTML = KIND_ICON[pd.kind];
          const nm = el("span", "tm-mname", KINDS[pd.kind].label);
          const a = el("span", "tm-fval"), b = el("span", "tm-fval2");
          row.append(ic, nm, a, diceBtn("p" + k), aBtn(() => ({ params: [0, 1].map((ax) => ({ param: padParam(k, ax), label: padLabel(k, ax), value: padXY(full.pads[k])[ax] })) })));
          row.title = KINDS[pd.kind].desc + ". Drag the point on the disc or the picture below; click the point to disable or remove it";
          const pic = pointGraph(k);
          b.className = "tm-fgraph-sub"; pic.append(b);
          g.append(row, pic);
          bind(() => { const p = full.pads[k]; if (!p || p.kind === "macro") return; const r = padReadout(p); a.textContent = r[0]; b.textContent = r[1]; g.classList.toggle("tm-idle", padIsSilent({ kind: p.kind, pos: padXY(p) })); g.classList.toggle("tm-off", !!p.off); });
          list.append(g);
          return;
        }
        [pd.x, pd.y].forEach((mi, axis) => {
          const row = el("div", "tm-mrow");
          const ringI = el("span", "tm-mring");
          ringI.title = "Drag up or down to set " + (axis ? "(circle up/down)" : "(circle left/right)");
          ringI.innerHTML = '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" class="tm-mr-bg"/><path class="tm-mr-arc"/></svg>';
          const name = el("span", "tm-mname");
          const val = el("span", "tm-mval");
          row.append(ringI, name, val, diceBtn("m" + mi), aBtn(() => ({ param: "macro." + mi, label: full.macros[mi].name, value: full.macros[mi].value })));
          g.append(row);
          bind(() => {
            const m = full.macros[mi];
            if (!m) return;
            name.textContent = m.name;
            const mv0 = shown("macro." + mi, m.value);
            val.textContent = Math.round(mv0 * 100) + "%";
            const a = mv0 * 359.9;
            ringI.querySelector(".tm-mr-arc").setAttribute("d", a < 1 ? "" : arcPath(10, 10, 7, 0, a));
            row.classList.toggle("tm-empty", !m.targets.length);
            row.title = m.targets.length ? m.targets.map((t) => t.param).join(", ") : "Not assigned yet: pick targets on the Engine page";
          });
          ringI.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (full.pads[k] && full.pads[k].off) return; // its point is disabled
            ringI.setPointerCapture(e.pointerId);
            let lastY = e.clientY; row.classList.add("tm-active"); activePad = k;
            const mv = (ev) => { const m = full.macros[mi]; setMacro(mi, m.value + (lastY - ev.clientY) * 0.005 * (ev.shiftKey ? 0.15 : 1), true); touch("macro." + mi, full.macros[mi].value, full.macros[mi].name); lastY = ev.clientY; dragEnergy = Math.min(1, dragEnergy + 0.05); positionPads(); };
            const up = () => { touch("macro." + mi, full.macros[mi].value, full.macros[mi].name, true); row.classList.remove("tm-active"); activePad = -1; ringI.removeEventListener("pointermove", mv); ringI.removeEventListener("pointerup", up); flushPreset(); };
            ringI.addEventListener("pointermove", mv); ringI.addEventListener("pointerup", up);
          });
          name.addEventListener("dblclick", () => {
            const inp = el("input", "tm-mname-input");
            inp.value = full.macros[mi].name;
            name.replaceWith(inp);
            inp.focus(); inp.select();
            const done = (ok) => {
              if (inp.parentNode) inp.replaceWith(name);
              if (ok && inp.value.trim()) { set(["macros", mi, "name"], inp.value.trim().slice(0, 24)); flushPreset(); }
            };
            inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
            inp.addEventListener("blur", () => done(true));
          });
        });
        g.classList.toggle("tm-off", !!pd.off);
        foldBody.append(g);
      });
      macroCol.append(list);
    }

    // The two always-there sliders on the Play page. Each reads/writes the preset through
    // get()/put(n) with n = 0..1; right-click asks the host to automate the param (opts.onAutomate).
    // paint(ctx, w, h, n) draws the picture inside the bar (Release: the sound's tail; Cutoff: a wave
    // that grows from small and muffled to big, square and cracking in the red zone).
    // dice (optional): { key, live(offset) -> n }: the slider's own dice, and where its wander puts the bar.
    function playSlider(label, hint, param, get, put, fmtv, def, paint, dice) {
      const g = el("div", "tm-rel");
      g.title = hint + ". Drag, double-click for the preset's own, right-click to automate";
      g.dataset.param = param;
      const head = el("div", "tm-rel-head"), lab = el("span", "tm-rel-label", label), val = el("span", "tm-rel-val");
      head.append(lab, val);
      if (dice) head.append(diceBtn(dice.key));
      head.append(aBtn(() => ({ param, label, value: get() })));
      const track = el("div", "tm-rel-track"), fill = el("i", "tm-rel-fill"), knobEl = el("b", "tm-rel-thumb"), ghost = el("b", "tm-rel-ghost");
      track.append(fill, ghost, knobEl);
      g.append(head, track);
      // with the dice on, a small acid marker rides where the wander has the sound right now
      const liveN = () => { const o = dice ? diceNow(dice.key) : null; return o == null ? null : clamp(dice.live(o)); };
      let redraw = () => {};
      const drawNow = (ctx, cv) => {
        const w = track.clientWidth, h = track.clientHeight, dpr = window.devicePixelRatio || 1;
        if (!w || !h) return;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
        const ln = liveN();
        paint(ctx, w, h, ln == null ? shown(param, get()) : ln);
      };
      const moveGhost = () => { const ln = liveN(); g.classList.toggle("tm-rolling", ln != null); if (ln != null) ghost.style.left = ln * 100 + "%"; };
      if (paint) {
        g.classList.add("tm-rel-pic");
        const cv = el("canvas", "tm-rel-cv"), ctx = cv.getContext("2d");
        track.insertBefore(cv, fill);
        let queued = false;
        redraw = () => {
          if (queued) return; queued = true;
          requestAnimationFrame(() => { queued = false; drawNow(ctx, cv); moveGhost(); });
        };
        if (window.ResizeObserver) new ResizeObserver(redraw).observe(track);
        if (dice) liveViews.add({ el: g, busy: () => diceNow(dice.key) != null || g.classList.contains("tm-rolling"), draw: () => { drawNow(ctx, cv); moveGhost(); } });
      }
      bind(() => { const n = shown(param, get()); fill.style.width = n * 100 + "%"; knobEl.style.left = n * 100 + "%"; val.textContent = (autoShow[param] && autoShow[param].text) || fmtv(); g.classList.toggle("tm-automated", autoHas([param])); redraw(); });
      const from = (x) => { const r = track.getBoundingClientRect(); put(clamp((x - r.left) / r.width)); pushPreset(); queueRefresh(); touch(param, get(), label); };
      track.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); track.setPointerCapture(e.pointerId); from(e.clientX);
        const mv = (ev) => from(ev.clientX), up = () => { track.removeEventListener("pointermove", mv); track.removeEventListener("pointerup", up); flushPreset(); touch(param, get(), label, true); };
        track.addEventListener("pointermove", mv); track.addEventListener("pointerup", up);
      });
      track.addEventListener("dblclick", () => { def(); flushPreset(); queueRefresh(); });
      g.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const info = { param, label, value: get() };
        if (typeof opts.onAutomate === "function") opts.onAutomate(info, e);
        root.dispatchEvent(new CustomEvent("tm-automate", { bubbles: true, detail: info }));
      });
      return g;
    }
    // Release: how long a note keeps ringing after the key is let go (the amp envelope's R).
    function releaseSlider() {
      const spec = specFor(["ampEnv", "r"]);
      return playSlider("Release", "How long the sound rings after you let go of the key", "ampEnv.r",
        () => toN(spec, full.ampEnv.r), (n) => setLinked("ampEnv.r", clamp(fromN(spec, n), 0, 10)),
        () => { const v = full.ampEnv.r; return v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(2) + " s"; },
        () => setLinked("ampEnv.r", base.ampEnv.r), paintRelease,
        { key: "srelease", live: (o) => toN(spec, clamp(full.ampEnv.r * Math.pow(2, o), 0, 10)) });
    }
    // The note as audio: a short held part, then the tail fading over the rest of the bar
    // (longer release = longer tail). Brighter up to the thumb, dim past it.
    function paintRelease(ctx, w, h, n) {
      const mid = h / 2, amp = mid - 3, body = w * 0.16, tail = Math.max(2, n * (w - body));
      const env = (x) => x < body ? Math.min(1, x / (w * 0.025)) * (x < w * 0.05 ? 1 : 0.82 + 0.18 * Math.exp(-(x - w * 0.05) / 12)) : 0.82 * Math.exp(-4.2 * (x - body) / tail);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(183,156,255,0.95)"); grad.addColorStop(Math.min(1, (body + tail) / w), "rgba(139,92,246,0.9)"); grad.addColorStop(1, "rgba(139,92,246,0.25)");
      ctx.beginPath(); ctx.moveTo(0, mid);
      for (let x = 0; x <= w; x++) ctx.lineTo(x, mid - env(x) * amp);
      for (let x = w; x >= 0; x--) ctx.lineTo(x, mid + env(x) * amp);
      ctx.closePath(); ctx.fillStyle = "rgba(139,92,246,0.16)"; ctx.fill();
      ctx.beginPath();
      for (let x = 0; x <= w; x += 1) { const y = mid - Math.sin(x * 0.85) * Math.sin(x * 0.13 + 1) * env(x) * amp; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = grad; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = "rgba(228,255,58,0.85)"; ctx.fillRect(body, mid - amp, 1, amp * 2);
    }
    // Cutoff, Serum-style: muffled on the left, fully open at 85%, and past that the filter's
    // drive comes up so the top end gets strong and saturated. Always on: a preset without the
    // filter gets it switched on, wide open (no change in sound until you move it).
    // (Past CUT_OPEN is the red zone Eman asked for: a line you cross into heavy drive.)
    const CUT_LO = 60, CUT_HI = 20000, CUT_OPEN = 0.85, CUT_DRIVE = 36;
    // The red zone writes filter.push: extra drive that the engine level-holds per voice (the same
    // loudness going in and out of the shaper), so it gets thicker and about to crack without getting
    // louder, on single notes and chords alike. (Older saves raised filter.drive and lowered
    // out.level instead; those still read back as a red-zone position.)
    function cutoffSlider() {
      const baseDrive = () => (base.filter && base.filter.drive) || 0;
      const get = () => {
        const f = full.filter, c = clamp(f.on === false ? CUT_HI : f.cutoff, CUT_LO, CUT_HI);
        if (c >= CUT_HI * 0.999 && (f.push || 0) > 0.01) return CUT_OPEN + (1 - CUT_OPEN) * clamp(f.push / CUT_DRIVE);
        if (c >= CUT_HI * 0.999 && f.drive > baseDrive() + 0.01) return CUT_OPEN + (1 - CUT_OPEN) * clamp((f.drive - baseDrive()) / CUT_DRIVE);
        return CUT_OPEN * Math.log(c / CUT_LO) / Math.log(CUT_HI / CUT_LO);
      };
      const put = (n) => {
        if (full.filter.on === false) { set(["filter", "on"], true, true); set(["filter", "cutoff"], CUT_HI, true); }
        const c = n >= CUT_OPEN ? CUT_HI : CUT_LO * Math.pow(CUT_HI / CUT_LO, n / CUT_OPEN);
        const d = n > CUT_OPEN ? (n - CUT_OPEN) / (1 - CUT_OPEN) * CUT_DRIVE : 0;
        setLinked("filter.cutoff", c);
        setLinked("filter.push", d);
      };
      const g = playSlider("Cutoff", "Filter cutoff: muffled on the left, fully open at the red line, and past it the filter is driven hard", "filter.cutoff", get, put,
        () => { const n = get(), c = full.filter.cutoff; return n > CUT_OPEN + 0.005 ? "DRIVE +" + Math.round((n - CUT_OPEN) / (1 - CUT_OPEN) * CUT_DRIVE) + " dB" : c >= CUT_HI * 0.999 ? "Open" : c >= 1000 ? (c / 1000).toFixed(c >= 10000 ? 0 : 1) + " kHz" : Math.round(c) + " Hz"; },
        () => { put(get() > CUT_OPEN ? CUT_OPEN : get()); setLinked("filter.cutoff", base.filter.cutoff); setLinked("filter.drive", baseDrive()); setLinked("filter.push", (base.filter && base.filter.push) || 0); }, paintCutoff,
        // the dice moves the cutoff (up to 3 octaves each way at 100%; Release 1.5), on top of the bar; a
        // driven filter keeps its red-zone drive while the cutoff wanders below the line
        { key: "scutoff", live: (o) => { const c = clamp(full.filter.cutoff * Math.pow(2, o), CUT_LO, CUT_HI); return c >= CUT_HI * 0.999 ? get() : CUT_OPEN * Math.log(c / CUT_LO) / Math.log(CUT_HI / CUT_LO); } });
      g.classList.add("tm-cut");
      g.style.setProperty("--tm-redline", CUT_OPEN * 100 + "%");
      bind(() => g.classList.toggle("tm-hot", get() > CUT_OPEN + 0.005));
      return g;
    }
    // Left: a small, round, muffled wave. Towards the line it opens up into a bright saw. In the
    // red zone it fills the bar, squares off, turns red and goes blocky (like the ring when it's driven).
    function paintCutoff(ctx, w, h, n) {
      const mid = h / 2, open = Math.min(1, n / CUT_OPEN), hot = n > CUT_OPEN ? (n - CUT_OPEN) / (1 - CUT_OPEN) : 0;
      const amp = (mid - 2) * (0.22 + 0.5 * open + 0.28 * hot), parts = 1 + Math.round(open * open * 9), period = 44 - 26 * open;
      const drv = 1 + hot * 7, norm = Math.tanh(drv), step = hot > 0.02 ? 1 + Math.round(hot * 4) : 1;
      const wave = (x) => {
        let v = 0, t = (x / period) * Math.PI * 2;
        for (let k = 1; k <= parts; k++) v += Math.sin(k * t) / k;
        v *= 0.62;
        return Math.tanh(v * drv) / norm;
      };
      const r = Math.round(139 + (255 - 139) * hot), gr = Math.round(92 - 33 * hot), b = Math.round(246 - 168 * hot);
      const col = (a) => `rgba(${r},${gr},${b},${a})`, xn = n * w;
      // Draw twice: full strength up to the thumb, faint after it.
      const path = new Path2D();
      for (let x = 0, py = mid; x <= w; x += step) {
        let y = wave(x) * amp;
        if (step > 1) y = Math.round(y / step) * step;
        const yy = mid - y;
        if (x) { if (step > 1) path.lineTo(x, py); path.lineTo(x, yy); } else path.moveTo(x, yy);
        py = yy;
      }
      ctx.lineJoin = "round";
      ctx.save(); ctx.beginPath(); ctx.rect(xn, 0, w - xn, h); ctx.clip();
      ctx.strokeStyle = col(0.22); ctx.lineWidth = 1.3; ctx.stroke(path); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, xn, h); ctx.clip();
      if (hot > 0) { ctx.shadowColor = col(0.9); ctx.shadowBlur = 4 + hot * 10; }
      ctx.strokeStyle = col(0.95); ctx.lineWidth = 1.4 + hot * 1.2; ctx.stroke(path); ctx.restore();
    }
    // A macro always wins over the written value (here and in the engine), and most song presets
    // have macros on these params ("Length" on ampEnv.r, "Bright" on filter.cutoff). So a slider
    // moves the macro's range with it: the value lands where you put it and the macro still works
    // around it (times and frequencies scale, everything else shifts).
    function setLinked(param, v) {
      const path = parsePath(param), cur = getIn(full, path), exp = /(cutoff|\.r)$/.test(param), hit = [];
      const k = exp && cur > 1e-4 ? v / cur : 0, d = v - (+cur || 0);
      full.macros.forEach((m, mi) => (m.targets || []).forEach((t, ti) => {
        if (t.param !== param) return;
        const f = exp ? (k ? Math.max(1e-3, t.from * k) : v) : t.from + d, to = exp ? (k ? Math.max(1e-3, t.to * k) : v) : t.to + d;
        set(["macros", mi, "targets", ti, "from"], +f.toFixed(4), true);
        set(["macros", mi, "targets", ti, "to"], +to.toFixed(4), true);
        if (!hit.includes(mi)) hit.push(mi);
      }));
      hit.forEach(reapplyMacro);
      if (!hit.length) set(path, v, true);
    }

    // Pan: where the whole synth sits, left to right (out.pan, -1..1). Snaps to the middle.
    function panSlider() {
      const get = () => clamp(((+full.out.pan || 0) + 1) / 2);
      const put = (n) => { const v = Math.abs(n - 0.5) < 0.025 ? 0 : Math.round((n * 2 - 1) * 100) / 100; setLinked("out.pan", v); };
      const txt = (p) => (Math.abs(p) < 0.005 ? "Centre" : (p < 0 ? "L " : "R ") + Math.round(Math.abs(p) * 100));
      const g = playSlider("Pan", "Where the sound sits, left to right", "out.pan", get, put,
        () => txt(+full.out.pan || 0), () => setLinked("out.pan", +(base.out && base.out.pan) || 0), paintPan,
        { key: "span", live: (o) => clamp(((+full.out.pan || 0) + o + 1) / 2) });
      g.classList.add("tm-pan");
      return g;
    }
    // The left channel above the line, the right one below: each gets louder or quieter as the
    // sound moves (same pan law as the engine), with L and R written at the ends.
    function paintPan(ctx, w, h, n) {
      const p = n * 2 - 1, gl = Math.min(1, 1 - p), gr = Math.min(1, 1 + p), mid = h / 2, A = mid - 3;
      const per = w / 4.5;
      const wave = (px) => Math.abs(Math.sin(px / per * Math.PI * 2) * 0.75 + Math.sin(px / per * Math.PI * 6 + 1) * 0.18);
      const half = (gain, dir) => {
        ctx.beginPath(); ctx.moveTo(0, mid);
        for (let px = 0; px <= w; px += 1.5) ctx.lineTo(px, mid + dir * wave(px) * A * gain);
        ctx.lineTo(w, mid); ctx.closePath();
        ctx.fillStyle = `rgba(139,92,246,${0.12 + 0.4 * gain})`; ctx.fill();
      };
      half(gl, -1); half(gr, 1);
      ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(0, mid - 0.5, w, 1);
      ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(w / 2 - 0.5, 3, 1, h - 6);
      ctx.font = "700 9px system-ui, sans-serif"; ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * gl})`; ctx.fillText("L", 5, mid - A * 0.55);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * gr})`; ctx.textAlign = "right"; ctx.fillText("R", w - 5, mid + A * 0.55); ctx.textAlign = "left";
    }

    // A small picture in the middle of each point so the kinds tell apart at a glance
    // (same 200x200 box, inside the r=20 centre circle).
    const PAD_ICON = {
      clip: '<path d="M90 103a10 10 0 1 1 20 0v5h-20z"/><circle class="tm-if" cx="95.5" cy="101.5" r="2.6"/><circle class="tm-if" cx="104.5" cy="101.5" r="2.6"/><path d="M94 108v4M100 108v4M106 108v4"/>',
      drive: '<path d="M100 88c3 6 9 9 9 16a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 5 3 5 0-5-1-9 2-13z"/>',
      analog: '<path d="M88 104c3-8 6-8 8-2s5 6 7 0 5-8 9-2"/><circle class="tm-if" cx="100" cy="92" r="2"/>',
      tape: '<circle cx="93" cy="100" r="5.5"/><circle cx="107" cy="100" r="5.5"/><circle class="tm-if" cx="93" cy="100" r="1.6"/><circle class="tm-if" cx="107" cy="100" r="1.6"/><path d="M93 105.5h14"/>',
      arp: '<path d="M89 110h6v-6h6v-6h6v-6h5"/>',
      filter: '<path d="M88 96h12c4 0 5-3 7 0s3 10 5 14"/>',
      motion: '<path d="M88 100c2-6 4-6 6 0s4 6 6 0 4-6 6 0 4 6 6 0"/>',
      space: '<circle class="tm-if" cx="95" cy="100" r="2.4"/><path d="M100 94a7 7 0 0 1 0 12M105 90a12 12 0 0 1 0 20"/>',
      crush: '<rect class="tm-if" x="89" y="104" width="6" height="6"/><rect class="tm-if" x="97" y="97" width="6" height="13"/><rect class="tm-if" x="105" y="91" width="6" height="19"/>',
      gate: '<path d="M90 92v16M96.7 92v16M103.3 92v16M110 92v16"/>',
      macro: '<path d="M100 89v22M89 100h22"/><circle class="tm-if" cx="100" cy="100" r="2.6"/>',
    };
    // A macro point draws what its macros do, read from their names (and targets): Bright = a sun,
    // Grit = a flame, Move = a wave, Space = ripples, Width = arrows, Length = an hourglass...
    const MACRO_ICON = [
      [/bright|tone|cutoff|filter|air|open|dark/i, '<circle cx="100" cy="100" r="4.5"/><path d="M100 88v4M100 108v4M88 100h4M108 100h4M91.5 91.5l2.8 2.8M105.7 105.7l2.8 2.8M91.5 108.5l2.8-2.8M105.7 94.3l2.8-2.8"/>'],
      [/grit|drive|dirt|distort|crunch|sat|fuzz|clip|heat/i, PAD_ICON.drive],
      [/move|motion|wobble|lfo|mod|vibrato|wave/i, PAD_ICON.motion],
      [/space|reverb|verb|room|hall|delay|echo|wet/i, PAD_ICON.space],
      [/width|stereo|wide|spread|chorus|detune|unison/i, '<path d="M88 100h24M88 100l4-4M88 100l4 4M112 100l-4-4M112 100l-4 4"/>'],
      [/length|decay|release|sustain|tail|hold/i, '<path d="M92 89h16M92 111h16M94 89c0 7 12 7 12 11s-12 4-12 11M106 89c0 7-12 7-12 11s12 4 12 11"/>'],
      [/body|sub|bass|low|weight|thick|fat/i, '<circle class="tm-if" cx="100" cy="102" r="7"/><path d="M90 91h20"/>'],
      [/attack|punch|snap|pluck|click|transient/i, '<path d="M103 88l-9 13h7l-4 11 10-14h-7z"/>'],
      [/pitch|tune|glide|octave|shift/i, '<path d="M90 110l10-20 10 20M94 103h12"/>'],
      [/noise|grain|texture|air|breath/i, '<circle class="tm-if" cx="92" cy="94" r="1.8"/><circle class="tm-if" cx="104" cy="92" r="1.8"/><circle class="tm-if" cx="98" cy="102" r="1.8"/><circle class="tm-if" cx="109" cy="104" r="1.8"/><circle class="tm-if" cx="92" cy="108" r="1.8"/><circle class="tm-if" cx="104" cy="110" r="1.8"/>'],
    ];
    const MACRO_SPARE = ['<path d="M100 89l11 11-11 11-11-11z"/>', '<path d="M100 89l11 20H89z"/>', '<rect x="91" y="91" width="18" height="18" rx="3"/>'];
    function macroIcon(pd, k) {
      const used = new Set(full.pads.map((q, i) => (q.kind !== "macro" ? PAD_ICON[q.kind] : i < k ? macroIcon(q, i) : null)));
      const words = [pd.x, pd.y].map((i) => full.macros[i]).filter(Boolean).map((m) => m.name + " " + (m.targets || []).map((t) => t.param).join(" "));
      const cands = [];
      for (const w of words) for (const [re, svg] of MACRO_ICON) if (re.test(w) && !cands.includes(svg)) cands.push(svg);
      return cands.find((c) => !used.has(c)) || MACRO_SPARE.find((c) => !used.has(c)) || cands[0] || MACRO_SPARE[0];
    }
    // the rings of each kind, drawn in a 200x200 box centred on the point
    function ringSvg(kind, x, y) {
      const c = (r, extra = "") => `<circle cx="100" cy="100" r="${r}" ${extra}/>`;
      const poly = (r, n, amp, rot = 0) => {
        let d = "";
        for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 + rot, rr = r + (i % 2 ? -amp : amp); d += (i ? "L" : "M") + (100 + rr * Math.cos(a)).toFixed(1) + " " + (100 + rr * Math.sin(a)).toFixed(1); }
        return `<path d="${d}Z"/>`;
      };
      const wob = (r, k, amp) => {
        let d = "";
        for (let i = 0; i <= 72; i++) { const a = (i / 72) * Math.PI * 2, rr = r + amp * Math.sin(a * k); d += (i ? "L" : "M") + (100 + rr * Math.cos(a)).toFixed(1) + " " + (100 + rr * Math.sin(a)).toFixed(1); }
        return `<path d="${d}Z"/>`;
      };
      switch (kind) {
        case "clip": return `<g class="tm-rg">${poly(48, 9 + Math.round(y * 9), 3 + x * 12)}${poly(76, 12 + Math.round(y * 12), 2 + x * 14, 0.2)}</g>${c(20, 'class="tm-rc"')}`;
        case "drive": return `<g class="tm-rg">${c(46, `stroke-width="${3 + x * 12}" class="tm-thick"`)}${c(78)}</g>${c(20, 'class="tm-rc"')}`;
        case "tape": { // two reels that sway (wow) and a worn, broken outer track (age)
          const reel = (cx) => `<circle cx="${cx}" cy="100" r="17"/><path d="M${cx} 85v30M${cx - 13} 92.5l26 15M${cx - 13} 107.5l26-15" opacity=".55"/>`;
          return `<g class="tm-rg"><g class="tm-tape-sway" style="--sway:${(2 + x * 9).toFixed(1)}deg">${reel(76)}${reel(124)}<path d="M76 117h48"/></g>${c(84, `stroke-dasharray="${(30 - y * 22).toFixed(1)} ${(2 + y * 9).toFixed(1)}" opacity=".6"`)}</g>${c(20, 'class="tm-rc"')}`;
        }
        case "analog": return `<g class="tm-rg tm-spin-slow">${wob(48, 5, 2 + x * 6)}${wob(78, 7, 2 + x * 8)}</g>${c(20, 'class="tm-rc"')}`;
        case "arp": return `<g class="tm-rg">${c(48, 'stroke-dasharray="1 9" stroke-linecap="round" stroke-width="4"')}${c(78, 'stroke-dasharray="1 12" stroke-linecap="round" stroke-width="3"')}<circle cx="100" cy="100" r="30" class="tm-pulse"/></g>${c(20, 'class="tm-rc"')}`;
        case "filter": { const sweep = 20 + x * 320; return `<g class="tm-rg">${c(78, 'opacity=".35"')}<path d="${arcPath(100, 100, 78, -sweep / 2, sweep / 2)}" stroke-width="${2 + y * 6}"/>${c(48)}</g>${c(20, 'class="tm-rc"')}`; }
        case "motion": return `<g class="tm-rg"><ellipse class="tm-wobble" cx="100" cy="100" rx="50" ry="40"/><ellipse class="tm-wobble2" cx="100" cy="100" rx="80" ry="68"/></g>${c(20, 'class="tm-rc"')}`;
        case "space": return `<g class="tm-rg tm-glow">${c(40)}${c(58, 'opacity=".6"')}${c(76, 'opacity=".38"')}${c(92, 'opacity=".2"')}</g>${c(20, 'class="tm-rc"')}`;
        case "crush": { const st = 1 + Math.round(x * 3); return `<g class="tm-rg"><rect x="${100 - 46}" y="${100 - 46}" width="92" height="92" rx="${8 - st * 2}"/><rect x="22" y="22" width="156" height="156" rx="${6 - st}" stroke-dasharray="${4 + st * 4} ${2 + st * 2}"/></g><rect class="tm-rc" x="80" y="80" width="40" height="40" rx="6"/>`; }
        case "gate": return `<g class="tm-rg"><g class="tm-spin">${c(48, `stroke-dasharray="${18} ${8 + (1 - y) * 4}" stroke-width="5"`)}</g>${c(78, 'opacity=".5"')}</g>${c(20, 'class="tm-rc"')}`;
        default: return `<g class="tm-rg">${c(76, 'opacity=".55"')}${c(48)}</g>${c(20, 'class="tm-rc"')}`;
      }
    }
    function renderPads() {
      padLayer.textContent = "";
      full.pads.forEach((pd, k) => {
        const p = el("div", "tm-pad tm-k-" + pd.kind);
        p.dataset.pad = k;
        p.style.setProperty("--kc", KINDS[pd.kind].color);
        const svg = el("div", "tm-padsvg");
        const glyph = pd.kind === "macro" ? "" : `<span class="tm-glyph">${KINDS[pd.kind].glyph}</span>`;
        p.innerHTML = `<i class="tm-halo"></i>`;
        p.append(svg);
        p.insertAdjacentHTML("beforeend", `${glyph}<b class="tm-hit"></b><span class="tm-padlabel"></span>`);
        if (k === newPadIdx) { p.classList.add("tm-new"); newPadIdx = -1; }
        // a CREATE SOUND word ball: its word sits on it, always readable; double-click takes it out
        if (pd.ball && pd.word) {
          p.classList.add("tm-ball");
          p.append(el("span", "tm-ballword", pd.word));
          p.addEventListener("dblclick", (e) => { e.stopPropagation(); if (create) create.removeBall(pd.ball); });
        }
        const hit = p.querySelector(".tm-hit"), label = p.querySelector(".tm-padlabel");
        const draw = () => {
          const cur = full.pads[k];
          if (!cur) return;
          const [x, y] = padXY(cur);
          const key = cur.kind + (cur.kind === "macro" ? (full.macros[cur.x] || {}).name + "/" + (full.macros[cur.y] || {}).name : (x * 20 | 0) + "," + (y * 20 | 0));
          if (svg.dataset.key !== key) { svg.dataset.key = key; svg.innerHTML = `<svg viewBox="0 0 200 200">${ringSvg(cur.kind, x, y)}<g class="tm-ico">${cur.kind === "macro" ? macroIcon(cur, k) : PAD_ICON[cur.kind] || ""}</g></svg>`; }
          p.style.setProperty("--x", x.toFixed(3));
          p.style.setProperty("--y", y.toFixed(3));
          if (cur.kind === "arp") { const r = arpRate(x); p.style.setProperty("--dur", r < 0 ? "0s" : (1 / ARP_HZ[r]).toFixed(3) + "s"); p.classList.toggle("tm-still", r < 0); }
          if (cur.kind === "gate") p.style.setProperty("--dur", (0.5 / [2, 4, 8, 16][Math.min(3, Math.floor(x * 4))] * 8).toFixed(2) + "s");
          if (cur.kind === "motion") p.style.setProperty("--dur", (1 / (0.1 * Math.pow(160, x))).toFixed(3) + "s");
          const r = padReadout(cur);
          const sp = shape === "star" ? padSpike(cur) : null;
          label.textContent = (cur.kind === "macro" ? "" : KINDS[cur.kind].label.toUpperCase() + " ") + r[0] + " \u00b7 " + r[1] + (sp ? " \u00b7 " + SPIKES[sp.s].label.toUpperCase() + " " + pctS(sp.d) : "");
          p.classList.toggle("tm-inspike", !!sp);
          p.style.setProperty("--sc", sp ? SPIKES[sp.s].color : "");
          p.classList.toggle("tm-automated", autoHas(padParams(k)));
        };
        bind(draw);
        p.classList.toggle("tm-off", !!pd.off);
        p.title = pd.off ? KINDS[pd.kind].label + " is off. Click to turn it on"
          : (pd.kind === "macro" ? "Drag to move " + full.macros[pd.x].name + " / " + full.macros[pd.y].name : KINDS[pd.kind].label + ": " + KINDS[pd.kind].desc) + ". Click it to disable or remove";
        hit.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          root.focus({ preventScroll: true });
          hit.setPointerCapture(e.pointerId);
          closePalette(); closePadMenu();
          const x0 = e.clientX, y0 = e.clientY;
          if (full.pads[k].off) { // a greyed-out point stays put; a click turns it on
            const up0 = (ev) => { hit.removeEventListener("pointerup", up0); if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) setPadOff(k, false); };
            hit.addEventListener("pointerup", up0);
            return;
          }
          activePad = k; p.classList.add("tm-active");
          const pdNow = full.pads[k];
          if (pdNow.kind !== "macro") pair("pads");
          const r = discEl.getBoundingClientRect();
          const cur = padBox(pdNow);
          const offX = (e.clientX - r.left) / r.width - cur[0], offY = (e.clientY - r.top) / r.height - cur[1];
          paintStar();
          let lx = e.clientX, ly = e.clientY, moved = false;
          const mv = (ev) => {
            if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return; // still a click
            moved = true;
            // (boxToPad keeps the point inside the ring, or the star, however far the mouse goes)
            const hitAt = boxToPad((ev.clientX - r.left) / r.width - offX, (ev.clientY - r.top) / r.height - offY, pdNow.kind);
            const [mx, my] = hitAt.pos;
            if (pdNow.kind === "macro") { setMacro(pdNow.x, mx, true); setMacro(pdNow.y, my, true); touch("macro." + pdNow.x, mx, full.macros[pdNow.x].name); touch("macro." + pdNow.y, my, full.macros[pdNow.y].name); }
            else {
              set(["pads", k, "pos"], [+mx.toFixed(4), +my.toFixed(4)], true); setStar(k, hitAt.star);
              call("setPads", orig.pads); queueRefresh(); touch(padParam(k, 0), mx, padLabel(k, 0)); touch(padParam(k, 1), my, padLabel(k, 1));
            }
            dragEnergy = Math.min(1.2, dragEnergy + Math.hypot(ev.clientX - lx, ev.clientY - ly) / 400);
            lx = ev.clientX; ly = ev.clientY;
            positionPads();
          };
          const up = (ev) => {
            activePad = -1; p.classList.remove("tm-active"); paintStar();
            hit.removeEventListener("pointermove", mv); hit.removeEventListener("pointerup", up); hit.removeEventListener("pointercancel", up);
            if (moved) {
              flushPreset();
              const [ex, ey] = padXY(full.pads[k]);
              if (pdNow.kind === "macro") { touch("macro." + pdNow.x, ex, full.macros[pdNow.x].name, true); touch("macro." + pdNow.y, ey, full.macros[pdNow.y].name, true); }
              else { touch(padParam(k, 0), ex, padLabel(k, 0), true); touch(padParam(k, 1), ey, padLabel(k, 1), true); }
            }
            else if (ev.type === "pointerup") openPadMenu(k);
          };
          hit.addEventListener("pointermove", mv); hit.addEventListener("pointerup", up); hit.addEventListener("pointercancel", up);
        });
        hit.addEventListener("contextmenu", (e) => { e.preventDefault(); openPadMenu(k); });
        hit.addEventListener("pointerenter", () => p.classList.add("tm-hover"));
        hit.addEventListener("pointerleave", () => p.classList.remove("tm-hover"));
        padLayer.append(p);
      });
      positionPads();
    }
    function positionPads() {
      if (!padLayer) return;
      const D = discEl.clientWidth || discSize;
      const placed = [];
      // (points that are on keep their true spot; greyed-out ones make way)
      [...padLayer.querySelectorAll(".tm-pad")].sort((a, b) => !!(full.pads[+a.dataset.pad] || {}).off - !!(full.pads[+b.dataset.pad] || {}).off).forEach((p) => {
        const pd = full.pads[+p.dataset.pad];
        if (!pd) return;
        const [bx, by] = padBox(pd), inSpike = shape === "star" && !!padSpike(pd);
        let px = bx * D, py = by * D;
        // points on the very same spot (new tape and space both sit at their silent corner) are
        // drawn a little apart, towards the middle, so each can be grabbed
        // (each one far enough that their centres never cover each other)
        const gap = D * 0.11;
        for (let n = 0; n < 8 && placed.some(([a, b]) => Math.hypot(a - px, b - py) < gap); n++) {
          const [a, b] = placed.find(([a, b]) => Math.hypot(a - px, b - py) < gap);
          // step straight away from the one it sits on, to just clear it (inwards if they coincide)
          let sx = px - a, sy = py - b, l = Math.hypot(sx, sy);
          if (l < 1) { sx = D / 2 - px; sy = D / 2 - py; l = Math.hypot(sx, sy); if (l < 1) { sx = 0.6; sy = 0.8; l = 1; } }
          px = a + (sx / l) * gap; py = b + (sy / l) * gap;
          // and stay inside the ring (on the star: the middle, unless it's out in a spike)
          if (inSpike) continue;
          const ox = shape === "star" ? STAR.c[0] * D : D / 2, oy = shape === "star" ? STAR.c[1] * D : D / 2;
          const cx = px - ox, cy = py - oy, rr = Math.hypot(cx, cy), lim = shape === "star" ? STAR.ri * STAR.r * D : D * 0.42;
          if (rr > lim) { px = ox + (cx / rr) * lim; py = oy + (cy / rr) * lim; }
        }
        placed.push([px, py]);
        p.style.left = px + "px";
        p.style.top = py + "px";
      });
      paintStar();
      queueLinks();
    }
    function queueLinks() {
      if (linkQueued) return;
      linkQueued = true;
      requestAnimationFrame(() => { linkQueued = false; drawLinks(); });
    }
    function drawLinks() {
      if (!linkSvg || page !== "play") return;
      const pr = pages.play.getBoundingClientRect();
      if (!pr.width) return;
      linkSvg.setAttribute("viewBox", `0 0 ${pr.width} ${pr.height}`);
      let html = "";
      const D = discEl.clientWidth;
      macroCol.querySelectorAll(".tm-mgroup").forEach((g) => {
        const k = +g.dataset.pad, pd = full.pads[k];
        const padEl = padLayer.querySelector(`.tm-pad[data-pad="${k}"]`);
        if (!pd || !padEl) return;
        // a closed macro drop-down: its points link to the drop-down's line
        const shut = pd.kind === "macro" && !g.offsetParent, anchor = shut ? macroCol.querySelector(".tm-macfold-h") : g;
        if (!anchor) return;
        const gr = anchor.getBoundingClientRect(), rows = g.querySelectorAll(".tm-mrow"), lr = (macroCol.querySelector(".tm-mlist") || macroCol).getBoundingClientRect();
        if (gr.bottom < lr.top + 4 || gr.top > lr.bottom - 4) return; // scrolled out of view
        const r1 = (shut ? anchor : pd.kind === "macro" ? rows[0] : g.querySelector(".tm-frow") || g).getBoundingClientRect();
        const y = r1.bottom - pr.top + (pd.kind === "macro" ? 5 : 3), x0 = gr.left - pr.left + 26, x1 = gr.right - pr.left + 6;
        const ppr = padEl.getBoundingClientRect();
        const cx = ppr.left - pr.left, cy = ppr.top - pr.top;
        const rr = D * 0.085, ang = Math.atan2(y - cy, x1 + 40 - cx);
        const ex = cx + Math.cos(ang) * rr, ey = cy + Math.sin(ang) * rr;
        const act = activePad === k ? " tm-link-on" : "";
        html += `<path class="tm-link${act}" style="--kc:${KINDS[pd.kind].color}" d="M${x0.toFixed(1)} ${y.toFixed(1)}H${x1.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}"/>`;
      });
      linkSvg.innerHTML = html;
    }
    function closePalette() { if (palette) { palette.remove(); palette = null; } window.removeEventListener("keydown", escPalette, true); }
    // Escape closes an open palette (Look, Drop a point) instead of the whole synth window
    function escPalette(ev) { if (ev.key === "Escape" && palette) { ev.stopPropagation(); ev.preventDefault(); closePalette(); } }
    const watchEsc = () => window.addEventListener("keydown", escPalette, true);
    // the Look picker: Auto (one of the category's images, by preset name), any image look, or Classic
    function lookThumb(fam) {
      const t = el("span", "tm-lookthumb");
      if (fam && LOOK_FAMILIES[fam]) { const k = LOOK_FAMILIES[fam].tiles[0]; t.style.setProperty("--lh", LOOK_FAMILIES[fam].hues[0]); t.style.backgroundPosition = (k % LOOK_COLS) * 25 + "% " + Math.floor(k / LOOK_COLS) * (100 / 3) + "%"; }
      else t.classList.add("tm-lookthumb-classic");
      return t;
    }
    // the preset's own picture as a thumbnail (the character tile, the symbol, or the reference tile)
    function ownThumb(im) {
      if (im.set === "ref" && REF_FAMILY[im.n]) { const t = lookThumb(REF_FAMILY[im.n]); t.style.setProperty("--lh", im.hue); return t; }
      const t = el("span", "tm-lookthumb tm-lookthumb-own");
      if (im.set === "char" && CHARS) {
        // the crop the circle shows, drawn small from the loaded pictures
        const c = document.createElement("canvas"), N = 48, g = c.getContext("2d"), id = g.createImageData(N, N), T = CHARS.T, z = im.zoom || 1;
        c.width = c.height = N;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          charSample(im.n | 0, T * (0.5 + (im.ox || 0) + (x / N - 0.5) * z), T * (0.5 + (im.oy || 0) + (y / N - 0.5) * z));
          const l = 0.3 * CS[0] + 0.59 * CS[1] + 0.11 * CS[2], i = (y * N + x) * 4, [r, gg, b] = hslRgb(im.hue == null ? 275 : im.hue, 70, 8 + 80 * l);
          id.data[i] = r; id.data[i + 1] = gg; id.data[i + 2] = b; id.data[i + 3] = 255;
        }
        g.putImageData(id, 0, 0);
        t.style.backgroundImage = "url(" + c.toDataURL() + ")"; t.style.backgroundSize = "cover"; t.style.backgroundPosition = "center";
      } else if (im.set === "char") {
        const rows = Math.ceil(CHAR_KEPT.length / CHAR_COLS), k = charAt(im.n);
        t.style.backgroundImage = "url(" + CHARS_SRC + ")";
        t.style.backgroundSize = CHAR_COLS * 100 + "% " + rows * 100 + "%";
        t.style.backgroundPosition = (k % CHAR_COLS) / (CHAR_COLS - 1) * 100 + "% " + Math.floor(k / CHAR_COLS) / (rows - 1) * 100 + "%";
      } else {
        const c = document.createElement("canvas"), N = 80, g = c.getContext("2d"), id = g.createImageData(N, N), bt = bitTile(im.n);
        c.width = c.height = N;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const [r, gg, b] = hslRgb(im.hue == null ? 275 : im.hue, 85, 6 + 70 * bt[(y * 2) * BIT_T + x * 2]), i = (y * N + x) * 4;
          id.data[i] = r; id.data[i + 1] = gg; id.data[i + 2] = b; id.data[i + 3] = 255;
        }
        g.putImageData(id, 0, 0);
        t.style.backgroundImage = "url(" + c.toDataURL() + ")"; t.style.backgroundSize = "cover"; t.style.backgroundPosition = "center"; t.style.imageRendering = "pixelated";
      }
      return t;
    }
    function toggleLooks(ring, anchor) {
      if (palette) { closePalette(); return; }
      const meta = { category: full.category, name: full.name, tags: full.tags };
      const cur = !full.look.family || full.look.family === "auto" ? "own" : full.look.family, ownIm = lookImage(full.look, meta);
      palette = el("div", "tm-palette tm-lookpal");
      palette.append(el("div", "tm-paltitle", "Look inside the circle"));
      const grid = el("div", "tm-lookgrid");
      const chip = (id, label, fam, thumb) => {
        const b = btn("tm-lookchip" + (cur === id ? " tm-on" : ""), "", label);
        b.append(thumb || lookThumb(fam), el("span", "tm-looklabel", label));
        b.addEventListener("click", () => {
          set("look.family", id, true);
          flushPreset();
          land.setLook(full.look, meta);
          closePalette();
        });
        grid.append(b);
      };
      chip("own", "This sound's own", null, ownThumb(ownIm));
      LOOK_ORDER.forEach((f) => chip(f, LOOK_FAMILIES[f].label, f));
      chip("classic", "Classic", null);
      palette.append(grid, el("div", "tm-palhint", "Every sound has its own picture. Turn the points up, or drive, clip and crush, to bend and break it."));
      ring.append(palette); watchEsc();
      const off = (ev) => { if (palette && !palette.contains(ev.target) && !anchor.contains(ev.target)) { closePalette(); document.removeEventListener("pointerdown", off, true); } };
      document.addEventListener("pointerdown", off, true);
    }
    function togglePalette(ring, addBtn) {
      if (palette) { closePalette(); return; }
      palette = el("div", "tm-palette");
      palette.append(el("div", "tm-paltitle", "Drop a point"));
      const grid = el("div", "tm-palgrid");
      KIND_ORDER.forEach((kind) => {
        const b = btn("tm-palchip", KIND_ICON[kind] + "<span></span>", KINDS[kind].desc);
        b.querySelector("span").textContent = KINDS[kind].label;
        b.style.setProperty("--kc", KINDS[kind].color);
        if (kind === "macro" && !freeMacroPair()) b.disabled = true;
        b.addEventListener("click", () => { closePalette(); addPad(kind); });
        grid.append(b);
      });
      palette.append(grid, el("div", "tm-palhint", full.pads.length + " / " + MAX_PADS + " points \u00b7 click a point to disable or remove it"));
      ring.append(palette); watchEsc();
      const off = (ev) => { if (palette && !palette.contains(ev.target) && !addBtn.contains(ev.target)) { closePalette(); document.removeEventListener("pointerdown", off, true); } };
      document.addEventListener("pointerdown", off, true);
    }
    function addPad(kind) {
      if (full.pads.length >= MAX_PADS) return;
      kind = kind || "macro";
      let pd;
      if (kind === "macro") {
        const free = freeMacroPair();
        if (!free) return;
        const [fm, om] = pair("macros");
        while (fm.length <= free[1]) { const m = MACRO_DEF(fm.length); m.value = 0.5; fm.push(m); om.push(clone(m)); }
        pd = { kind: "macro", x: free[0], y: free[1] };
      } else {
        const base = KINDS[kind].drop || [0.4, 0.5];
        const jig = () => (Math.random() - 0.5) * 0.12;
        pd = { kind, pos: [+clamp(base[0] + jig()).toFixed(3), +clamp(base[1] + jig()).toFixed(3)] };
      }
      const [fp, op] = pair("pads");
      fp.push(padWithDefaults(pd)); op.push(clone(pd));
      newPadIdx = fp.length - 1;
      flushPreset();
      rebuild(["play", "engine"]);
    }
    // Click a point: Disable (it goes back to where the preset had it, so the sound is the
    // preset's own, dims and stops moving until enabled again) or Remove.
    let padMenu = null;
    function closePadMenu() { if (padMenu) { padMenu.remove(); padMenu = null; } }
    // a point's two params (its left/right and up/down), as the automation lines name them
    function padParams(k) { const pd = full.pads[k]; if (!pd) return []; return pd.kind === "macro" ? ["macro." + pd.x, "macro." + pd.y] : [padParam(k, 0), padParam(k, 1)]; }
    function openPadMenu(k) {
      closePadMenu();
      const pd = full.pads[k], pEl = padLayer && padLayer.querySelector(`.tm-pad[data-pad="${k}"]`);
      if (!pd || !pEl) return;
      padMenu = el("div", "tm-padmenu");
      padMenu.style.left = pEl.style.left; padMenu.style.top = pEl.style.top;
      const item = (label, fn, cls) => { const b = el("button", "tm-padmenu-i" + (cls ? " " + cls : ""), label); b.type = "button"; b.addEventListener("click", () => { closePadMenu(); fn(); }); padMenu.append(b); };
      // its automation: see it and take it away, or start it (Zed call 2, 7 Nov 13:00: "how do I remove the automation I made")
      if (!window.TM_AUTO_MARK_OFF && !pd.off && typeof opts.onAutomate === "function") {
        const params = padParams(k);
        if (autoHas(params)) {
          if (typeof opts.autoShowLanes === "function") item("Show automation", () => opts.autoShowLanes(params));
          if (typeof opts.autoClear === "function") item("Clear automation", () => { Promise.resolve(opts.autoClear(params)).then(() => queueRefresh()); }, "tm-padmenu-rm");
        } else {
          const [px, py] = padXY(pd);
          const labels = pd.kind === "macro" ? [(full.macros[pd.x] || {}).name, (full.macros[pd.y] || {}).name] : [padLabel(k, 0), padLabel(k, 1)];
          item("Automate", () => (window.TM_AUTO_CORE_OLD || flushPreset(), opts.onAutomate)({ direct: true, params: params.map((param, i) => ({ param, label: labels[i] || param, value: i ? py : px })) }, null));
        }
      }
      if (pd.kind === "tape" && !pd.off) item("Tape settings\u2026", () => openTapeCard(k));
      item(pd.off ? "Enable" : "Disable", () => setPadOff(k, !pd.off));
      if (full.pads.length > 1) item("Remove", () => removePad(k), "tm-padmenu-rm");
      padLayer.append(padMenu);
      const off = (ev) => { if (padMenu && !padMenu.contains(ev.target)) { closePadMenu(); document.removeEventListener("pointerdown", off, true); } };
      setTimeout(() => document.addEventListener("pointerdown", off, true));
    }
    // The tape point's own settings: wow and flutter speed, hiss, stereo (left and right sway
    // apart) and decks (1-3 tape machines stacked, each wobbling its own way). pd.tape in the preset.
    const TAPE_DEF = { wowRate: 0.5, flutterRate: 0.5, hiss: 0.5, stereo: 0, decks: 1 };
    function openTapeCard(k) {
      closePadMenu();
      const pd = full.pads[k], pEl = padLayer && padLayer.querySelector(`.tm-pad[data-pad="${k}"]`);
      if (!pd || !pEl) return;
      const cur = () => Object.assign({}, TAPE_DEF, full.pads[k].tape || {});
      const put = (key, v) => { const [fp, op] = pair("pads"); const t = Object.assign(cur(), { [key]: v }); fp[k].tape = t; op[k].tape = clone(t); pushPreset(); draw(); };
      padMenu = el("div", "tm-padmenu tm-tapecard");
      padMenu.append(el("div", "tm-dp-h", "Tape"));
      const rows = [["wowRate", "Wow speed", (v) => (0.3 + v * 0.7).toFixed(2) + " Hz"], ["flutterRate", "Flutter speed", (v) => (6 + v * 4).toFixed(1) + " Hz"], ["hiss", "Hiss", (v) => Math.round(v * 100) + "%"], ["stereo", "Stereo", (v) => (v < 0.01 ? "mono" : Math.round(v * 100) + "%")]];
      const draws = [];
      for (const [key, lab, f] of rows) {
        const head = el("div", "tm-dp-row"), val = el("span", "tm-dp-val");
        head.append(el("span", "tm-dp-lab", lab), val);
        const tr = el("div", "tm-rel-track"), fill = el("i", "tm-rel-fill"), th = el("b", "tm-rel-thumb");
        tr.append(fill, th);
        const set = (x) => { const b = tr.getBoundingClientRect(); put(key, +clamp((x - b.left) / b.width).toFixed(3)); };
        tr.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); tr.setPointerCapture(e.pointerId); set(e.clientX); const mv = (ev) => set(ev.clientX), up = () => { tr.removeEventListener("pointermove", mv); tr.removeEventListener("pointerup", up); flushPreset(); }; tr.addEventListener("pointermove", mv); tr.addEventListener("pointerup", up); });
        draws.push(() => { const v = cur()[key]; fill.style.width = th.style.left = v * 100 + "%"; val.textContent = f(v); });
        padMenu.append(head, tr);
      }
      const decks = el("div", "tm-dp-steps tm-decks");
      [1, 2, 3].forEach((n) => { const b = el("button", null, n === 1 ? "1 deck" : n + " decks"); b.type = "button"; b.addEventListener("click", () => { put("decks", n); flushPreset(); }); decks.append(b); });
      draws.push(() => decks.querySelectorAll("button").forEach((b, i) => b.classList.toggle("tm-on", cur().decks === i + 1)));
      padMenu.append(el("div", "tm-dp-lab", "Decks (stacked tape machines)"), decks);
      const draw = () => draws.forEach((f) => f());
      draw();
      // Fixed to the screen next to the point, so the ring's round edge never cuts it off.
      root.append(padMenu);
      const pr = pEl.getBoundingClientRect(), mr = padMenu.getBoundingClientRect();
      padMenu.style.left = clamp(pr.right + 10, 8, window.innerWidth - mr.width - 8) + "px";
      padMenu.style.top = clamp(pr.top + pr.height / 2 - mr.height / 2, 8, window.innerHeight - mr.height - 8) + "px";
      const off = (ev) => { if (padMenu && !padMenu.contains(ev.target)) { closePadMenu(); document.removeEventListener("pointerdown", off, true); } };
      setTimeout(() => document.addEventListener("pointerdown", off, true));
    }
    function padHome(pd) {
      const same = (base.pads || []).filter((b) => b.kind === pd.kind && (pd.kind !== "macro" || (b.x === pd.x && b.y === pd.y)));
      return same.length ? same[0] : null;
    }
    function setPadOff(k, offNow) {
      const pd = full.pads[k];
      if (!pd) return;
      const [fp, op] = pair("pads");
      if (offNow) {
        const home = padHome(pd);
        if (pd.kind === "macro") {
          for (const mi of [pd.x, pd.y]) { const bm = base.macros && base.macros[mi]; if (bm && full.macros[mi]) setMacro(mi, bm.value); }
        } else if (home && home.pos) {
          fp[k].pos = home.pos.slice(); op[k].pos = home.pos.slice();
          setStar(k, home.star);
          call("setPads", orig.pads);
        }
        fp[k].off = op[k].off = true;
      } else {
        delete fp[k].off; delete op[k].off;
      }
      flushPreset();
      rebuild(["play"]);
    }
    function removePad(k) {
      if (full.pads.length <= 1) { positionPads(); return; }
      const [fp, op] = pair("pads");
      fp.splice(k, 1); op.splice(k, 1);
      if (orig.dice) { const nd = {}; for (const [key, d] of Object.entries(orig.dice)) { const i = +key.slice(1); if (key[0] !== "p") nd[key] = d; else if (i < k) nd[key] = d; else if (i > k) nd["p" + (i - 1)] = d; } orig.dice = nd; }
      flushPreset();
      rebuild(["play", "engine"]);
    }

    function renderSide() {
      sideEl.textContent = "";
      // (The preset's name is in the top bar; Eman 2026-10-27: the big title only took space.
      // The heart and the random button moved up there too.)
      const sliders = el("div", "tm-relpair");
      sliders.append(releaseSlider(), cutoffSlider(), panSlider());
      const stack = el("div", "tm-sources");
      if (tapeSide()) { renderSideTape(stack, sliders); return; }
      const SRC = [["oscA", "Osc A", "sine"], ["oscB", "Osc B", "square"], ["noise", "Grains", "grains"], ["sub", "Sub", "sub"], ["sampler", "Sampler", "sampler"]];
      SRC.forEach(([key, label, ico], i) => {
        const pill = el("div", "tm-pill");
        pill.style.setProperty("--i", i);
        const pw = power([key, "on"]);
        const nm = btn("tm-pillname", ICON[ico] + "<span></span>", "Open " + label + " on the Engine page");
        nm.querySelector("span").textContent = label;
        nm.addEventListener("click", () => showPage("engine", key));
        const lvl = el("div", "tm-pilllvl");
        lvl.title = label + " level (drag)";
        const fill = el("i");
        lvl.append(fill);
        bind(() => { fill.style.width = clamp(full[key].level) * 100 + "%"; pill.classList.toggle("tm-off", !full[key].on); });
        lvl.addEventListener("pointerdown", (e) => {
          e.preventDefault(); lvl.setPointerCapture(e.pointerId);
          const r = lvl.getBoundingClientRect();
          const f = (x) => set([key, "level"], Math.round(clamp((x - r.left) / r.width) * 100) / 100);
          f(e.clientX);
          const mv = (ev) => f(ev.clientX), up = () => { lvl.removeEventListener("pointermove", mv); lvl.removeEventListener("pointerup", up); flushPreset(); };
          lvl.addEventListener("pointermove", mv); lvl.addEventListener("pointerup", up);
        });
        pill.append(pw, nm, lvl);
        stack.append(pill);
      });
      if (ARPS) {
        const pill = el("div", "tm-pill tm-arppill");
        pill.style.setProperty("--i", SRC.length);
        const pw = btn("tm-power", ICON.power, "ARP on / off");
        pw.addEventListener("click", (e) => { e.stopPropagation(); arpPower(); });
        const nm = btn("tm-pillname", ICON.arp + "<span></span>", "Open the ARP page: patterns, steps, dice");
        nm.addEventListener("click", () => showPage("arp"));
        bind(() => {
          const a = arpOf(), on = arpOn();
          pw.classList.toggle("tm-on", on);
          pill.classList.toggle("tm-off", !on);
          nm.querySelector("span").textContent = on ? a.name || "Arp" : "Arp";
          nm.title = on ? "ARP: " + (a.name || "") + " · " + (a.rate || "1/16") + ". Open the ARP page" : "Open the ARP page: patterns, steps, dice";
        });
        pill.append(pw, nm, arpDice(true));
        stack.append(pill);
      }
      sideEl.append(sliders, stack);
    }

    // The side stack with Osc A + Osc B in one box, a type menu on Grains and the Tape row
    // (Eman 10 Nov). KT2_TM_TAPE_OFF = the stack above.
    // Each row's amount can be automated: an A after the bar (Eman 10 Nov), its line plays through the
    // engine's hidden macros (KillToyAuto.SYNTH "oscA.level" etc.), and the bar follows the line while it plays.
    // KT2_TM_ROW_AUTO_OFF = old (no A on the rows).
    const rowAuto = () => !window.KT2_TM_ROW_AUTO_OFF;
    function lvlBar(path, label) {
      path = parsePath(path);
      const param = path.join("."), auto = rowAuto();
      const lvl = el("div", "tm-pilllvl");
      lvl.title = label + " (drag)";
      const fill = el("i");
      lvl.append(fill);
      bind(() => {
        const v = clamp(getIn(full, path));
        fill.style.width = (auto ? clamp(shown(param, v)) : v) * 100 + "%";
        if (auto) lvl.classList.toggle("tm-automated", autoHas([param]));
      });
      lvl.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation(); lvl.setPointerCapture(e.pointerId);
        const r = lvl.getBoundingClientRect();
        const f = (x) => { const n = Math.round(clamp((x - r.left) / r.width) * 100) / 100; set(path, n); if (auto) touch(param, n, label); };
        f(e.clientX);
        const mv = (ev) => f(ev.clientX), up = () => { lvl.removeEventListener("pointermove", mv); lvl.removeEventListener("pointerup", up); if (auto) touch(param, clamp(getIn(full, path)), label, true); flushPreset(); };
        lvl.addEventListener("pointermove", mv); lvl.addEventListener("pointerup", up);
      });
      if (!auto) return lvl;
      const frag = document.createDocumentFragment();
      frag.append(lvl, aBtn(() => ({ param, label, value: clamp(getIn(full, path)) })));
      return frag;
    }
    function pillMenu(anchor, items, current, onPick) {
      const old = root.querySelector(".tm-menu");
      if (old) { const same = old.dataset.for === anchor.dataset.menu; old.remove(); if (same) return; }
      const menu = el("div", "tm-menu tm-menu1");
      menu.dataset.for = anchor.dataset.menu || "";
      items.forEach(([v, label]) => {
        const it = btn("tm-menuitem" + (v === current ? " tm-cur" : ""), null);
        it.textContent = label;
        it.dataset.v = v;
        it.addEventListener("click", (e) => { e.stopPropagation(); menu.remove(); onPick(v); });
        menu.append(it);
      });
      const r = anchor.getBoundingClientRect(), rr = root.getBoundingClientRect();
      menu.style.top = r.bottom - rr.top + 6 + "px";
      menu.style.right = Math.max(8, rr.right - r.right) + "px";
      root.append(menu);
      const off = (ev) => { if (!menu.contains(ev.target) && !anchor.contains(ev.target)) { menu.remove(); document.removeEventListener("pointerdown", off, true); } };
      document.addEventListener("pointerdown", off, true);
    }
    function renderSideTape(stack, sliders) {
      let i = 0;
      const mkPill = (cls) => { const p = el("div", "tm-pill" + (cls ? " " + cls : "")); p.style.setProperty("--i", i++); stack.append(p); return p; };
      // Osc A + Osc B side by side in one box
      const pair = mkPill("tm-oscpair");
      [["oscA", "Osc A", "OSC A"], ["oscB", "Osc B", "OSC B"]].forEach(([key, label, short], k) => {
        const half = el("div", "tm-oschalf");
        const nm = btn("tm-pillname", "<span></span>", "Open " + label + " on the Engine page");
        nm.querySelector("span").textContent = short;
        nm.addEventListener("click", () => showPage("engine", key));
        half.append(power([key, "on"]), nm, lvlBar([key, "level"], label + " level"));
        bind(() => half.classList.toggle("tm-off", !full[key].on));
        if (k) pair.append(el("i", "tm-oscsep"));
        pair.append(half);
      });
      // a row with a type menu on its name
      const typeRow = (key, rowName, ico, types, levelPath, levelLabel, extraItems) => {
        const pill = mkPill("tm-typepill");
        pill.dataset.row = key;
        const nm = btn("tm-pillname", ICON[ico] + "<span></span><b class=\"tm-caret\"></b>", "Pick a type");
        nm.dataset.menu = key;
        nm.addEventListener("click", (e) => {
          e.stopPropagation();
          pillMenu(nm, types.concat(extraItems || []), full[key].type, (v) => {
            if (v === "@knobs") { showPage("engine", key); return; }
            if (key === "noise" && v === "whispers" && full.noise.type !== "whispers") {
              set(["noise", "filter"], false);   // a texture on top: the synth's filter would swallow it
              set(["noise", "level"], 0.3);
            }
            set([key, "type"], v);
            if (!full[key].on) set([key, "on"], true);
            flushPreset();
            if (key === "noise") rebuild(); else refresh();   // the Engine page's knob names follow the type
          });
        });
        bind(() => {
          const t = types.find((x) => x[0] === full[key].type) || types[0];
          nm.querySelector("span").textContent = t === types[0] ? rowName : t[1];
          pill.classList.toggle("tm-off", !full[key].on);
        });
        pill.append(power([key, "on"]), nm, lvlBar(levelPath, levelLabel));
        return pill;
      };
      typeRow("noise", "Grains", "grains", GRAIN_TYPES, ["noise", "level"], "Grains level", [["@knobs", "Knobs"]]);
      typeRow("drift", "Tape", "tape", tapeTypes(), ["drift", "amount"], "Tape amount", [["@knobs", "Knobs"]]);
      for (const [key, label, ico] of [["sub", "Sub", "sub"], ["sampler", "Sampler", "sampler"]]) {
        const pill = mkPill();
        const nm = btn("tm-pillname", ICON[ico] + "<span></span>", "Open " + label + " on the Engine page");
        nm.querySelector("span").textContent = label;
        nm.addEventListener("click", () => showPage("engine", key));
        bind(() => pill.classList.toggle("tm-off", !full[key].on));
        pill.append(power([key, "on"]), nm, lvlBar([key, "level"], label + " level"));
      }
      if (ARPS) {
        const pill = mkPill("tm-arppill");
        const pw = btn("tm-power", ICON.power, "ARP on / off");
        pw.addEventListener("click", (e) => { e.stopPropagation(); arpPower(); });
        const nm = btn("tm-pillname", ICON.arp + "<span></span>", "Open the ARP page: patterns, steps, dice");
        nm.addEventListener("click", () => showPage("arp"));
        bind(() => {
          const a = arpOf(), on = arpOn();
          pw.classList.toggle("tm-on", on);
          pill.classList.toggle("tm-off", !on);
          nm.querySelector("span").textContent = on ? a.name || "Arp" : "Arp";
        });
        pill.append(pw, nm, arpDice(true));
      }
      sideEl.append(sliders, stack);
    }

    // ------------------------------------------------ keyboard bar
    function renderKb() {
      const kb = $(".tm-kb");
      kb.textContent = "";
      const wheels = el("div", "tm-wheels");
      const mkWheel = (label, spring, fn) => {
        const w = el("div", "tm-wheel");
        const lab = el("div", "tm-wlabel", label);
        const tr = el("div", "tm-wtrack"), th = el("i");
        tr.append(th);
        w.append(lab, tr);
        let v = spring ? 0.5 : 0;
        const draw = () => { th.style.bottom = `calc(${v * 100}% - ${v * 14}px)`; };
        draw();
        tr.addEventListener("pointerdown", (e) => {
          e.preventDefault(); tr.setPointerCapture(e.pointerId);
          const r = tr.getBoundingClientRect();
          const f = (y) => { v = clamp(1 - (y - r.top) / r.height); draw(); fn(v); };
          f(e.clientY);
          const mv = (ev) => f(ev.clientY);
          const up = () => {
            tr.removeEventListener("pointermove", mv); tr.removeEventListener("pointerup", up);
            if (spring) { v = 0.5; draw(); fn(v); }
          };
          tr.addEventListener("pointermove", mv); tr.addEventListener("pointerup", up);
        });
        return { w, lab };
      };
      const pb = mkWheel("PB", true, (v) => call("pitchBend", (v - 0.5) * 2));
      bind(() => { pb.lab.textContent = "PB " + full.voice.bend; });
      const mw = mkWheel("Mod", false, (v) => call("modWheel", v));
      wheels.append(pb.w, el("div", "tm-wsep"), mw.w);

      const keysWrap = el("div", "tm-keyswrap");
      const octs = el("div", "tm-octs");
      const od = btn("tm-octbtn", "\u2212", "Octave down (Z)"), ou = btn("tm-octbtn", "+", "Octave up (X)");
      const ov = el("div", "tm-octval");
      ov.title = "Octaves from this sound's own range (0). Stays when you change sounds; double-click for 0";
      od.addEventListener("click", () => shiftOct(-1));
      ou.addEventListener("click", () => shiftOct(1));
      ov.addEventListener("dblclick", () => shiftOct(-octOff));
      octs.append(ou, ov, od);
      octVal = ov; showOct();
      const keys = el("div", "tm-keys");
      keysWrap.append(octs, keys);
      const keyBox = el("div", "tm-keybox");
      const kn = el("div", "tm-keynote"), km = el("div", "tm-keymode");
      keyBox.append(kn, km);
      bind(() => { const k = parseKey(full.key); kn.textContent = k ? k.note : "\u2013"; km.textContent = k ? (k.minor ? "Minor" : "Major") : "No key"; });
      kb.append(wheels, keysWrap, keyBox);
      buildKeys(keys);
    }
    let keysEl = null;
    function buildKeys(keys) {
      keysEl = keys || keysEl;
      keysEl.textContent = "";
      const whites = el("div", "tm-whites"), blacks = el("div", "tm-blacks");
      keysEl.append(blacks, whites);
      const WHITE = [0, 2, 4, 5, 7, 9, 11];
      let wi = 0;
      const nW = 15;
      for (let n = kbBase; wi < nW; n++) {
        const pc = n % 12;
        if (WHITE.indexOf(pc) >= 0) {
          const k = el("div", "tm-wkey");
          k.dataset.note = n;
          if (pc === 0) k.append(el("span", null, noteName(n)));
          whites.append(k);
          wi++;
        } else {
          const k = el("div", "tm-bkey");
          k.dataset.note = n;
          k.style.left = `calc(${(wi / nW) * 100}%)`;
          blacks.append(k);
        }
      }
      let down = null;
      const noteAt = (e) => { const t = e.target.closest && e.target.closest("[data-note]"); return t ? +t.dataset.note : null; };
      const on = (n) => { if (n == null || down === n) return; if (down != null) noteOff(down); down = n; noteOn(n, 100); };
      keysEl.onpointerdown = (e) => { if (e.button !== 0) return; e.preventDefault(); root.focus({ preventScroll: true }); keysEl.setPointerCapture(e.pointerId); on(noteAt(e)); };
      keysEl.onpointermove = (e) => { if (down == null) return; const t = document.elementFromPoint(e.clientX, e.clientY); const k = t && t.closest && t.closest(".tm-keys [data-note]"); if (k) on(+k.dataset.note); };
      keysEl.onpointerup = keysEl.onpointercancel = () => { if (down != null) noteOff(down); down = null; };
      lightKeys();
    }
    // Where the keyboard starts for this sound: the middle of its demo notes, else by category.
    function homeOctave(p) {
      const dn = p.demo && Array.isArray(p.demo.notes) ? p.demo.notes.map((n) => n.pitch).filter((x) => x > 0).sort((a, b) => a - b) : [];
      if (dn.length) return clamp(Math.floor((dn[dn.length >> 1] - 4) / 12) * 12, 24, 72);
      const c = String(p.category || "") + " " + String(p.name || "");
      if (/bass|808|sub/i.test(c)) return 36;
      if (/lead|pluck|arp|bell|fx/i.test(c)) return 60;
      return 48;
    }
    function noteOn(n, vel) { held.add(n); call("noteOn", n, vel); lightKeys(); soundHit(0.5 + 0.5 * clamp((vel || 100) / 127)); snd.act = Math.max(snd.act, 0.5); }
    function noteOff(n) { held.delete(n); call("noteOff", n); lightKeys(); }
    function lightKeys() { if (keysEl) keysEl.querySelectorAll("[data-note]").forEach((k) => k.classList.toggle("tm-down", held.has(+k.dataset.note))); }
    let octVal = null;
    function showOct() {
      if (!octVal) return;
      octVal.innerHTML = `<b>${octOff > 0 ? "+" + octOff : octOff < 0 ? "\u2212" + -octOff : "0"}</b><span>oct</span>`;
      octVal.classList.toggle("tm-octmoved", octOff !== 0);
    }
    function shiftOct(d) {
      const home = homeOctave(full), next = clamp(octOff + d, -3, 3);
      if (home + 12 * next < 12 || home + 12 * next > 96) return;
      octOff = next; octStore.set(octOff); showOct();
      kbBase = home + 12 * octOff;
      for (const [, n] of compHeld) noteOff(n);
      compHeld.clear();
      buildKeys();
    }

    root.addEventListener("keydown", (e) => {
      if (e.target !== root && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (browser && browserKey(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "z" || k === "x") { e.preventDefault(); if (!e.repeat) shiftOct(k === "z" ? -1 : 1); return; }
      if (k in COMPUTER_KEYS) {
        e.preventDefault(); e.stopPropagation();
        if (e.repeat || compHeld.has(k)) return;
        const n = kbBase + COMPUTER_KEYS[k];
        compHeld.set(k, n);
        noteOn(n, 100);
      }
    });
    root.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (compHeld.has(k)) { e.preventDefault(); noteOff(compHeld.get(k)); compHeld.delete(k); }
    });
    root.addEventListener("blur", () => { for (const [, n] of compHeld) noteOff(n); compHeld.clear(); }, true);
    root.addEventListener("pointerdown", (e) => { if (!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) && !root.contains(document.activeElement)) root.focus({ preventScroll: true }); });

    // ------------------------------------------------ ENGINE page
    function panel(title, sec, powerPath, extraHead) {
      const p = el("div", "tm-panel");
      if (sec) p.dataset.sec = sec;
      const h = el("div", "tm-phead");
      if (powerPath) h.append(power(powerPath, () => refresh()));
      h.append(el("div", "tm-ptitle", title));
      if (extraHead) extraHead.forEach((x) => h.append(x));
      const body = el("div", "tm-pbody");
      p.append(h, body);
      if (powerPath) bind(() => p.classList.toggle("tm-off", !getIn(full, powerPath)));
      return { p, body, h };
    }
    const knobs = (...ks) => { const r = el("div", "tm-knobrow"); ks.forEach((k) => k && r.append(k)); return r; };
    const canvasBox = (cls, draw) => { const c = el("canvas", "tm-cv " + (cls || "")); bind(() => { if (c.isConnected && c.offsetWidth) draw(c); }); return c; };
    const spacer = () => el("div", "tm-grow");

    function oscPanel(key, title) {
      const wsel = select([key, "wave"], WAVES.map((w) => [w, w[0].toUpperCase() + w.slice(1)]), () => { delete full[key].frames; const o = getIn(orig, [key]); if (o) delete o.frames; refresh(); });
      const custom = el("span", "tm-chip", "Measured table");
      bind(() => { const c = Array.isArray(full[key].frames) && full[key].frames.length; custom.hidden = !c; wsel.hidden = !!c; });
      custom.title = "This oscillator plays its own table, measured from the song. Pick a built-in table to replace it.";
      custom.addEventListener("click", () => { custom.hidden = true; wsel.hidden = false; });
      const { p, body } = panel(title, key, [key, "on"], [spacer(), custom, wsel, toggle("Filter", [key, "filter"])]);
      const cv = canvasBox("tm-wt", (c) => drawWavetable(c, full[key]));
      const warpSel = select([key, "warp", "type"], [["none", "No warp"], ["sync", "Sync"], ["bend", "Bend"], ["fold", "Fold"], ["fm", "FM"], ["pwm", "PWM"]], () => rebuild(["engine"]));
      body.append(
        cv,
        knobs(knob("Pos", [key, "pos"]), knob("Oct", [key, "oct"]), knob("Semi", [key, "semi"]), knob("Fine", [key, "fine"]), knob("Level", [key, "level"]), knob("Pan", [key, "pan"])),
        el("div", "tm-sublabel", "Unison \u00b7 Warp"),
        knobs(knob("Voices", [key, "unison", "voices"]), knob("Detune", [key, "unison", "detune"]), knob("Spread", [key, "unison", "spread"]), knob("Blend", [key, "unison", "blend"]),
          (() => { const w = el("div", "tm-warpbox"); w.append(warpSel, knob("Amount", [key, "warp", "amount"], null, { dim: () => full[key].warp.type === "none" })); return w; })())
      );
      return p;
    }
    function drawWavetable(c, osc) {
      const { ctx, w, h } = prepCanvas(c);
      const frames = tableFrames(osc), nF = frames.length;
      const depth = Math.min(10, Math.max(nF, 6));
      const dx = w * 0.16 / depth, dy = h * 0.32 / depth;
      const ww = w * 0.8, amp = h * 0.24, baseY = h * 0.62;
      ctx.lineJoin = "round";
      for (let k = depth - 1; k >= 0; k--) {
        const pos = depth === 1 ? 0 : k / (depth - 1);
        const f = frameAt(frames, pos);
        const ox = 8 + k * dx, oy = baseY - k * dy;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) { const ph = i / 64, x = ox + ph * ww, y = oy - f[Math.floor(ph * (N_PTS - 1))] * amp * 0.75; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = `rgba(160,140,255,${0.08 + 0.1 * (1 - k / depth)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const pos = clamp(osc.pos), f = frameAt(frames, pos);
      const k = pos * (depth - 1), ox = 8 + k * dx, oy = baseY - k * dy;
      ctx.beginPath();
      for (let i = 0; i <= 128; i++) { const ph = i / 128, x = ox + ph * ww, y = oy - warpSample(f, ph * 0.999, osc.warp) * amp * 0.75; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = osc.on ? ACID : "rgba(236,236,238,0.4)";
      ctx.lineWidth = 2;
      ctx.shadowColor = osc.on ? "rgba(228,255,58,0.5)" : "transparent";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(236,236,238,0.36)";
      ctx.font = "10px " + getComputedStyle(root).fontFamily;
      ctx.fillText((Array.isArray(osc.frames) && osc.frames.length ? "custom" : osc.wave).toUpperCase() + "  \u00b7  " + nF + (nF === 1 ? " frame" : " frames"), 8, h - 6);
    }
    function subPanel() {
      const { p, body } = panel("Sub", "sub", ["sub", "on"], [spacer(), toggle("Filter", ["sub", "filter"])]);
      body.append(knobs(
        (() => { const b = el("div", "tm-selcol"); b.append(el("div", "tm-k-label", "Shape"), select(["sub", "shape"], ["sine", "triangle", "square", "saw"].map((s) => [s, s[0].toUpperCase() + s.slice(1)]))); return b; })(),
        (() => { const b = el("div", "tm-selcol"); b.append(el("div", "tm-k-label", "Octave"), select(["sub", "oct"], [[0, "0"], [-1, "-1"], [-2, "-2"]])); return b; })(),
        knob("Level", ["sub", "level"])));
      return p;
    }
    function noisePanel() {
      if (tapeSide()) {
        const tsel = select(["noise", "type"], GRAIN_TYPES, () => rebuild(["engine", "play"]));
        const { p, body } = panel("Grains", "noise", ["noise", "on"], [spacer(), tsel, toggle("Filter", ["noise", "filter"])]);
        const L = GRAIN_KNOBS[full.noise.type] || GRAIN_KNOBS.grains;
        body.append(knobs(knob(L[0], ["noise", "color"]), knob(L[1], ["noise", "grain"]), knob(L[2], ["noise", "pitch"]), knob("Level", ["noise", "level"])));
        return p;
      }
      const { p, body } = panel("Grains", "noise", ["noise", "on"], [spacer(), toggle("Filter", ["noise", "filter"])]);
      body.append(knobs(knob("Color", ["noise", "color"]), knob("Grain", ["noise", "grain"]), knob("Pitch", ["noise", "pitch"]), knob("Level", ["noise", "level"])));
      return p;
    }
    function tapePanel() {
      const tsel = select(["drift", "type"], tapeTypes(), () => rebuild(["play"]));
      const { p, body } = panel("Tape", "drift", ["drift", "on"], [spacer(), tsel]);
      body.append(knobs(knob("Amount", ["drift", "amount"])));
      return p;
    }
    function samplerPanel() {
      const { p, body } = panel("Sampler", "sampler", ["sampler", "on"], [spacer(), toggle("Loop", ["sampler", "loop"]), toggle("Filter", ["sampler", "filter"])]);
      // The drop zone (Eman, 31 Oct): drop any sound on it or click to upload; once loaded it shows
      // the sound, and the two yellow edges cut it down to the part you want (Start / End).
      const zone = el("div", "tm-szone"), cv = el("canvas", "tm-swave"), msg = el("div", "tm-smsg");
      const hA = el("i", "tm-sedge tm-sa"), hB = el("i", "tm-sedge tm-sb"), shA = el("b", "tm-sshade tm-sa"), shB = el("b", "tm-sshade tm-sb");
      zone.append(cv, shA, shB, hA, hB, msg);
      zone.title = "Drop a sound here, or click to upload one. Drag the yellow edges to use just part of it.";
      const peaks = () => (samplePeaks && samplePeaks.file === full.sampler.file ? samplePeaks.p : null);
      function paint() {
        const has = !!full.sampler.file, pk = peaks();
        zone.classList.toggle("tm-sfull", has);
        msg.textContent = has ? String(full.sampler.file).split("/").pop() : "Drop a sound here, or click to upload";
        const a = clamp(+full.sampler.start || 0), b = clamp(full.sampler.end == null ? 1 : +full.sampler.end);
        for (const [n, v] of [[hA, a], [hB, b]]) { n.style.left = v * 100 + "%"; n.hidden = !has; }
        shA.style.width = a * 100 + "%"; shB.style.left = b * 100 + "%"; shB.style.width = (1 - b) * 100 + "%"; shA.hidden = shB.hidden = !has;
        const { ctx, w, h } = prepCanvas(cv);
        if (!pk) return;
        const mid = h / 2;
        for (let x = 0; x < w; x++) {
          const v = pk[Math.min(pk.length - 1, Math.floor((x / w) * pk.length))] || 0, f = x / w;
          ctx.fillStyle = f >= a && f <= b ? "rgba(178,150,255,0.95)" : "rgba(255,255,255,0.18)";
          ctx.fillRect(x, mid - v * (h / 2 - 3), 1, Math.max(1, v * (h - 6)));
        }
      }
      bind(paint);
      new ResizeObserver(() => paint()).observe(zone);
      // the sound that is already on the lane (a saved song): ask the host for its picture once
      if (full.sampler.file && !peaks() && api.getSamplePeaks) Promise.resolve(call("getSamplePeaks")).then((r) => { if (r && r.peaks) { samplePeaks = { file: full.sampler.file, p: r.peaks }; paint(); } });
      // drag an edge
      for (const [n, key] of [[hA, "start"], [hB, "end"]]) n.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        n.setPointerCapture(e.pointerId);
        const mv = (ev) => {
          const r = zone.getBoundingClientRect(), v = clamp((ev.clientX - r.left) / r.width);
          const a = +full.sampler.start || 0, b = full.sampler.end == null ? 1 : +full.sampler.end;
          set(["sampler", key], key === "start" ? Math.min(v, b - 0.01) : Math.max(v, a + 0.01));
          paint();
        };
        const up = () => { n.removeEventListener("pointermove", mv); n.removeEventListener("pointerup", up); flushPreset(); };
        n.addEventListener("pointermove", mv); n.addEventListener("pointerup", up);
      });
      // click to upload, or drop on it
      const take = (f) => f && loadIntoSampler(f).then(paint);
      zone.addEventListener("click", (e) => {
        if (e.target.classList.contains("tm-sedge")) return;
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = "audio/*,.wav,.mp3,.aif,.aiff,.flac,.ogg,.m4a";
        inp.onchange = () => take(inp.files && inp.files[0]);
        inp.click();
      });
      zone.addEventListener("dragover", (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); zone.classList.add("tm-sover"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("tm-sover"));
      zone.addEventListener("drop", (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); e.stopPropagation();
        zone.classList.remove("tm-sover"); root.classList.remove("tm-filedrag"); dragDepth = 0;
        take(e.dataTransfer.files && e.dataTransfer.files[0]);
      });
      body.append(zone, knobs(knob("Root", ["sampler", "root"]), knob("Start", ["sampler", "start"]), knob("End", ["sampler", "end"]), knob("Level", ["sampler", "level"])));
      return p;
    }
    // A sound straight into the Sampler (the rest of the preset stays as it is): decoded to mono,
    // sent to the lane's engine, start/end reset, the Sampler switched on. One undo step.
    async function loadIntoSampler(file) {
      try {
        const buf = await audioCtx().decodeAudioData(await file.arrayBuffer());
        const n = Math.min(buf.length, buf.sampleRate * 30), data = new Float32Array(n);   // up to 30 s
        for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) data[i] += d[i] / buf.numberOfChannels; }
        const name = String(file.name || "Sound");
        call("setSample", { data, sampleRate: buf.sampleRate, name });
        const P = 400, pk = new Array(P).fill(0), step = n / P;
        let top = 1e-6;
        for (let i = 0; i < P; i++) { let m = 0; for (let j = Math.floor(i * step), e = Math.floor((i + 1) * step); j < e; j++) m = Math.max(m, Math.abs(data[j])); pk[i] = m; top = Math.max(top, m); }
        samplePeaks = { file: name, p: pk.map((v) => v / top) };
        set(["sampler", "file"], name, true); set(["sampler", "start"], 0, true); set(["sampler", "end"], 1, true); set(["sampler", "on"], true);
        flushPreset();
      } catch (err) {
        console.warn("[ToyMachine] sampler", err);
        toast("Couldn't read that sound", [String((err && err.message) || err)]);
      }
    }
    function filterPanel() {
      const tsel = select(["filter", "type"], [["lp12", "Low pass 12"], ["lp24", "Low pass 24"], ["ladder", "Ladder 24 (fat)"], ["hp12", "High pass 12"], ["hp24", "High pass 24"], ["bp12", "Band pass"], ["notch", "Notch"], ["peak", "Peak"]]);
      const { p, body } = panel("Filter", "filter", ["filter", "on"], [spacer(), tsel]);
      const cv = canvasBox("tm-fcurve", (c) => drawFilter(c));
      body.append(cv, knobs(knob("Cutoff", ["filter", "cutoff"]), knob("Res", ["filter", "res"]), knob("Drive", ["filter", "drive"]), knob("Key", ["filter", "keytrack"]), knob("Env", ["filter", "env"]), knob("Vel", ["filter", "vel"])));
      return p;
    }
    function drawFilter(c) {
      const { ctx, w, h } = prepCanvas(c);
      const f = full.filter;
      const top = 18, bot = -42, y = (db) => ((top - db) / (top - bot)) * h;
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      [100, 1000, 10000].forEach((hz) => { const x = (Math.log(hz / 20) / Math.log(1000)) * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(0, y(0)); ctx.lineTo(w, y(0)); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const x = (i / 160) * w, hz = 20 * Math.pow(1000, i / 160);
        const db = f.on ? 20 * Math.log10(Math.max(1e-4, filterMag(f.type, hz, f.cutoff, f.res))) : 0;
        const yy = clamp(y(db), 2, h + 2);
        i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(139,92,246,0.45)");
      g.addColorStop(1, "rgba(139,92,246,0)");
      ctx.strokeStyle = f.on ? ACID : "rgba(236,236,238,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
    function voicePanel() {
      const { p, body } = panel("Voice", "voice");
      body.append(
        (() => { const r = el("div", "tm-knobrow"); const b = el("div", "tm-selcol"); b.append(el("div", "tm-k-label", "Mode"), select(["voice", "mode"], [["poly", "Poly"], ["mono", "Mono"], ["legato", "Legato"]])); r.append(b, knob("Glide", ["voice", "glide"]), knob("Voices", ["voice", "polyphony"])); return r; })(),
        knobs(knob("Bend", ["voice", "bend"]), knob("Velocity", ["voice", "velocity"]), knob("Width", ["out", "width"]))
      );
      return p;
    }
    function envPanel(key, title) {
      const { p, body } = panel(title, key);
      const cv = canvasBox("tm-env", (c) => {
        const { ctx, w, h } = prepCanvas(c);
        const pts = envShape(full[key], 0);
        ctx.beginPath();
        pts.forEach(([x, y], i) => { const X = 4 + x * (w - 8), Y = 6 + (1 - y) * (h - 12); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.strokeStyle = ACID; ctx.lineWidth = 2; ctx.stroke();
        ctx.lineTo(w - 4, h); ctx.lineTo(4, h); ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(139,92,246,0.4)"); g.addColorStop(1, "rgba(139,92,246,0)");
        ctx.fillStyle = g; ctx.fill();
      });
      body.append(cv, knobs(knob("A", [key, "a"]), knob("D", [key, "d"]), knob("S", [key, "s"]), knob("R", [key, "r"]), knob("Curve", [key, "curve"]), knob("Rise", [key, "aCurve"])));
      return p;
    }
    function lfoPanel(key, title) {
      const ssel = select([key, "shape"], ["sine", "triangle", "saw", "ramp", "square", "random", "smooth"].map((s) => [s, s[0].toUpperCase() + s.slice(1)]));
      const { p, body } = panel(title, key, null, [spacer(), ssel, toggle("Retrig", [key, "retrig"])]);
      const seed = key === "lfo1" ? 1.3 : 4.1;
      const cv = canvasBox("tm-lfo", (c) => {
        const { ctx, w, h } = prepCanvas(c);
        const l = full[key];
        ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) { const x = (i / 200) * w, v = lfoValue(l.shape, (i / 200) * 2 + (l.phase || 0), seed); const y = h / 2 - v * (h / 2 - 6); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = ACID; ctx.lineWidth = 2; ctx.stroke();
      });
      const sync = el("div", "tm-selcol");
      sync.append(el("div", "tm-k-label", "Sync"), select([key, "sync"], SYNC_OPTS));
      body.append(cv, knobs(sync, knob("Rate", [key, "rate"], null, { dim: () => !!full[key].sync }), knob("Phase", [key, "phase"])));
      return p;
    }
    function modPanel() {
      const add = btn("tm-addbtn", ICON.plus + "<span>Add</span>", "Add a modulation");
      const { p, body } = panel("Modulation", "mods", null, [spacer(), add]);
      add.addEventListener("click", () => { const [fa, oa] = pair("mods"); fa.push(clone(MOD_DEF)); oa.push(clone(MOD_DEF)); fa[fa.length - 1].amt = oa[oa.length - 1].amt = 0.5; flushPreset(); rebuild(["engine"]); });
      if (!full.mods.length) body.append(el("div", "tm-empty", "Nothing modulated yet. Add one to wire an LFO or envelope to a knob."));
      full.mods.forEach((m, i) => {
        const r = el("div", "tm-modrow");
        const x = btn("tm-x", ICON.close, "Remove");
        x.addEventListener("click", () => { const [fa, oa] = pair("mods"); fa.splice(i, 1); oa.splice(i, 1); flushPreset(); rebuild(["engine"]); });
        r.append(
          select(["mods", i, "src"], MOD_SRCS.map((s) => [s, MOD_SRC_NAMES[s]])),
          el("span", "tm-arrow", "\u2192"),
          select(["mods", i, "dst"], MOD_DSTS.map((d) => [d, dstName(d)]), () => refresh()),
          dragNum(["mods", i, "amt"], () => modAmtMeta(full.mods[i].dst)),
          x
        );
        body.append(r);
      });
      return p;
    }
    function paramList() {
      const L = [];
      const add = (path, label) => L.push([path, label]);
      add("filter.cutoff", "Filter cutoff"); add("filter.res", "Filter resonance"); add("filter.drive", "Filter drive"); add("filter.env", "Filter env amount"); add("filter.keytrack", "Filter keytrack");
      ["oscA", "oscB"].forEach((o) => {
        const n = o === "oscA" ? "Osc A" : "Osc B";
        add(o + ".pos", n + " position"); add(o + ".level", n + " level"); add(o + ".pan", n + " pan"); add(o + ".fine", n + " fine"); add(o + ".semi", n + " semi");
        add(o + ".unison.detune", n + " detune"); add(o + ".unison.spread", n + " spread"); add(o + ".unison.blend", n + " blend"); add(o + ".warp.amount", n + " warp");
      });
      add("sub.level", "Sub level"); add("noise.level", "Grains level"); add("noise.color", "Grains color"); add("noise.grain", "Grains grain"); add("noise.pitch", "Grains pitch"); add("sampler.level", "Sampler level");
      if (tapeSide()) add("drift.amount", "Tape amount");
      ["ampEnv", "filterEnv", "modEnv"].forEach((e) => { const n = { ampEnv: "Amp", filterEnv: "Filter", modEnv: "Mod" }[e]; ["a", "d", "s", "r"].forEach((k) => add(e + "." + k, n + " env " + k.toUpperCase())); });
      add("lfo1.rate", "LFO 1 rate"); add("lfo2.rate", "LFO 2 rate"); add("voice.glide", "Glide"); add("out.level", "Output level"); add("out.width", "Output width");
      const seen = {};
      full.fx.forEach((f, i) => {
        const first = !seen[f.type]; seen[f.type] = 1;
        const meta = FX_META[f.type] || {};
        Object.keys(meta).forEach((k) => add("fx." + (first ? f.type : i) + "." + k, FX_NAMES[f.type] + (first ? "" : " " + (i + 1)) + " " + k));
      });
      full.mods.forEach((m, i) => add("mod." + i + ".amt", "Mod " + (i + 1) + " amount (" + MOD_SRC_NAMES[m.src] + " \u2192 " + dstName(m.dst) + ")"));
      return L;
    }
    function macroPanel() {
      const { p, body } = panel("Macros", "macros");
      const grid = el("div", "tm-macrogrid");
      const params = paramList();
      full.macros.forEach((m, i) => {
        const c = el("div", "tm-mcard");
        const head = el("div", "tm-mhead");
        const padIdx = full.pads.findIndex((pd) => pd.kind === "macro" && (pd.x === i || pd.y === i));
        const badge = el("span", "tm-mbadge", String(i + 1));
        badge.title = padIdx >= 0 ? `Circle ${padIdx + 1}, ${full.pads[padIdx].x === i ? "left/right" : "up/down"}` : "Not on a circle";
        if (padIdx < 0) badge.classList.add("tm-dim");
        const nm = el("input", "tm-minput");
        nm.value = m.name;
        nm.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") nm.blur(); });
        nm.addEventListener("change", () => { set(["macros", i, "name"], nm.value.trim() || "Macro " + (i + 1)); flushPreset(); });
        const vbox = el("div", "tm-mvalbox");
        const vb = dragNum(["macros", i, "value"], R.pct);
        vbox.append(vb);
        // the value box moves the macro (so its targets follow)
        vb.addEventListener("pointermove", () => { reapplyMacro(i); queueRefresh(); });
        vb.addEventListener("wheel", () => { reapplyMacro(i); queueRefresh(); });
        head.append(badge, nm, vbox);
        c.append(head);
        m.targets.forEach((t, j) => {
          const r = el("div", "tm-trow");
          const opts2 = params.slice();
          if (!opts2.some((o) => o[0] === t.param)) opts2.unshift([t.param, t.param]);
          const ps = select(["macros", i, "targets", j, "param"], opts2, () => { reapplyMacro(i); flushPreset(); rebuild(["engine"]); }, "tm-tsel");
          const tspec = () => { const path = resolveParam(full, full.macros[i].targets[j].param); return path ? specFor(path) : FALLBACK; };
          const from = dragNum(["macros", i, "targets", j, "from"], tspec, () => reapplyMacro(i));
          const to = dragNum(["macros", i, "targets", j, "to"], tspec, () => reapplyMacro(i));
          const x = btn("tm-x", ICON.close, "Remove target");
          x.addEventListener("click", () => { const [fa, oa] = pair(["macros", i, "targets"]); fa.splice(j, 1); oa.splice(j, 1); flushPreset(); rebuild(["engine", "play"]); });
          r.append(ps, from, el("span", "tm-arrow", "\u2192"), to, x);
          c.append(r);
        });
        const add = btn("tm-addbtn tm-addtarget", ICON.plus + "<span>Target</span>", "Add a parameter this macro moves");
        add.addEventListener("click", () => {
          const [fa, oa] = pair(["macros", i, "targets"]);
          const path = ["filter", "cutoff"];
          const cur = getIn(full, path);
          const t = { param: "filter.cutoff", from: Math.max(20, cur / 4), to: Math.min(20000, cur), curve: 1 };
          if (!(t.from > 0)) { t.from = 200; t.to = 8000; }
          fa.push(clone(t)); oa.push(clone(t));
          flushPreset(); rebuild(["engine", "play"]);
        });
        c.append(add);
        grid.append(c);
      });
      body.append(grid);
      return p;
    }
    function renderEngine() {
      const pg = pages.engine, st = pg.scrollTop;
      pg.textContent = "";
      const g = el("div", "tm-eng");
      const span = (node, n, cls) => { node.style.gridColumn = "span " + n; if (cls) node.classList.add(cls); return node; };
      g.append(
        span(oscPanel("oscA", "Osc A"), 3), span(oscPanel("oscB", "Osc B"), 3),
        span(subPanel(), 2), span(noisePanel(), 2), span(samplerPanel(), 2),
        ...(tapeSide() ? [span(tapePanel(), 2)] : []),
        span(filterPanel(), 4), span(voicePanel(), 2),
        span(envPanel("ampEnv", "Amp env"), 2), span(envPanel("filterEnv", "Filter env"), 2), span(envPanel("modEnv", "Mod env"), 2),
        span(lfoPanel("lfo1", "LFO 1"), 3), span(lfoPanel("lfo2", "LFO 2"), 3),
        span(modPanel(), 6), span(macroPanel(), 6)
      );
      pg.append(g);
      pg.scrollTop = st;
    }

    // ------------------------------------------------ EFFECTS page
    const FX_LAYOUT = {
      drive: [{ sel: "mode", opts: [["soft", "Soft"], ["tube", "Tube"], ["hard", "Hard"], ["fold", "Fold"], ["rectify", "Rectify"]] }, "amount", "tone", "mix"],
      crush: ["bits", "rate", "mix"],
      chorus: ["rate", "depth", "voices", "mix"],
      phaser: ["rate", "depth", "feedback", "mix"],
      delay: [{ sel: "sync", opts: SYNC_OPTS }, "time", "feedback", "tone", "mix", { tog: "pingpong", label: "Ping-pong" }],
      reverb: ["size", "decay", "damp", "predelay", "mod", "mix"],
      ott: ["depth", "time", "up", "down"],
      comp: ["threshold", "ratio", "attack", "release", "makeup"],
      eq: ["low", "lowFreq", "high", "highFreq"],
      width: ["amount", "bassMono"],
      clip: ["drive", "shape", "ceiling"],
      texture: [{ sel: "mode", opts: TEX_MODES }, "size", "density", "mix", { open: "texture" }],
    };
    const FX_LABEL = { size: "Size", density: "Density", shape: "Shape", ceiling: "Ceiling", amount: "Amount", tone: "Tone", mix: "Mix", bits: "Bits", rate: "Rate", depth: "Depth", feedback: "Feedback", time: "Time", decay: "Decay", damp: "Damp", predelay: "Pre-delay", voices: "Voices", mod: "Motion", up: "Up", down: "Down", threshold: "Thresh", ratio: "Ratio", attack: "Attack", release: "Release", makeup: "Makeup", low: "Low", lowFreq: "Low freq", high: "High", highFreq: "High freq", bassMono: "Bass mono" };
    function renderFx() {
      const pg = pages.effects, st = pg.scrollTop;
      pg.textContent = "";
      const wrap = el("div", "tm-fxwrap");
      const head = el("div", "tm-fxhead");
      const addb = btn("tm-addbtn tm-addfx", ICON.plus + "<span>Add effect</span>");
      const count = el("span", "tm-fxcount", full.fx.length + " / " + MAX_FX);
      head.append(el("div", "tm-fxtitle", "Effects"), count, spacer(), addb);
      addb.disabled = full.fx.length >= MAX_FX;
      addb.addEventListener("click", (e) => {
        e.stopPropagation();
        const old = root.querySelector(".tm-menu");
        if (old) { old.remove(); return; }
        const menu = el("div", "tm-menu");
        FX_TYPES.forEach((t) => {
          if (t === "texture" && texIndex() >= 0) return;
          const it = btn("tm-menuitem", null);
          it.textContent = FX_NAMES[t];
          it.addEventListener("click", () => {
            menu.remove();
            const [fa, oa] = pair("fx");
            fa.push(fxWithDefaults({ type: t })); oa.push({ type: t });
            flushPreset(); rebuild(["effects", "engine"]);
            const cards = pages.effects.querySelectorAll(".tm-fxcard");
            const last = cards[cards.length - 1];
            if (last) last.scrollIntoView({ block: "nearest" });
          });
          menu.append(it);
        });
        const r = addb.getBoundingClientRect(), rr = root.getBoundingClientRect();
        menu.style.top = r.bottom - rr.top + 6 + "px";
        menu.style.right = rr.right - r.right + "px";
        root.append(menu);
        const off = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("pointerdown", off, true); } };
        document.addEventListener("pointerdown", off, true);
      });
      wrap.append(head);
      const list = el("div", "tm-fxlist");
      if (!full.fx.length) list.append(el("div", "tm-empty", "No effects. Add drive, delay, reverb and more; they run top to bottom."));
      full.fx.forEach((f, i) => list.append(fxCard(f, i)));
      wrap.append(list);
      pg.append(wrap);
      pg.scrollTop = st;
    }
    function fxCard(f, i) {
      const card = el("div", "tm-fxcard");
      card.dataset.i = i;
      const h = el("div", "tm-fxcardhead");
      const grip = el("span", "tm-grip");
      grip.innerHTML = ICON.grip;
      grip.title = "Drag to reorder";
      const x = btn("tm-x", ICON.close, "Remove effect");
      x.addEventListener("click", () => { const [fa, oa] = pair("fx"); fa.splice(i, 1); oa.splice(i, 1); fixFxTargets(); flushPreset(); rebuild(["effects", "engine"]); });
      h.append(grip, power(["fx", i, "on"]), el("div", "tm-fxname", FX_NAMES[f.type] || f.type), el("span", "tm-fxidx", String(i + 1)), spacer(), x);
      const body = el("div", "tm-knobrow tm-fxknobs");
      (FX_LAYOUT[f.type] || []).forEach((it) => {
        if (typeof it === "string") body.append(knob(FX_LABEL[it] || it, ["fx", i, it], null, it === "time" && f.type === "delay" ? { dim: () => !!full.fx[i].sync } : null));
        else if (it.sel) { const b = el("div", "tm-selcol"); b.append(el("div", "tm-k-label", it.sel === "sync" ? "Sync" : "Mode"), select(["fx", i, it.sel], it.opts, f.type === "texture" ? () => setTexMode(i, full.fx[i].mode) : null)); body.append(b); }
        else if (it.tog) body.append(toggle(it.label, ["fx", i, it.tog]));
        else if (it.open) { const o = btn("tm-addbtn", "<span>Open Texture page</span>"); o.addEventListener("click", () => showPage("texture")); body.append(o); }
      });
      card.append(h, body);
      if (f.type === "eq") {
        const cv = canvasBox("tm-eqcurve", (c) => drawEq(c, full.fx[i]));
        card.insertBefore(cv, body);
        const peaks = el("div", "tm-peaks");
        (f.peaks || []).forEach((pk, j) => {
          const r = el("div", "tm-peakrow");
          const xx = btn("tm-x", ICON.close, "Remove band");
          xx.addEventListener("click", () => { const [fa, oa] = pair(["fx", i, "peaks"]); fa.splice(j, 1); oa.splice(j, 1); flushPreset(); rebuild(["effects"]); });
          r.append(el("span", "tm-k-label", "Band " + (j + 1)), dragNum(["fx", i, "peaks", j, "f"]), dragNum(["fx", i, "peaks", j, "q"]), dragNum(["fx", i, "peaks", j, "db"]), xx);
          peaks.append(r);
        });
        const ab = btn("tm-addbtn", ICON.plus + "<span>Band</span>");
        ab.addEventListener("click", () => { const [fa, oa] = pair(["fx", i, "peaks"]); fa.push(clone(PEAK_DEF)); oa.push(clone(PEAK_DEF)); flushPreset(); rebuild(["effects"]); });
        peaks.append(ab);
        card.append(peaks);
      }
      bind(() => card.classList.toggle("tm-off", !full.fx[i] || !full.fx[i].on));
      grip.addEventListener("pointerdown", (e) => startFxDrag(e, card, i));
      return card;
    }
    function drawEq(c, f) {
      const { ctx, w, h } = prepCanvas(c);
      const y = (db) => h / 2 - (db / 20) * (h / 2 - 4);
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const hz = 20 * Math.pow(1000, i / 160), l2 = Math.log2(hz);
        let db = f.low / (1 + Math.exp((l2 - Math.log2(f.lowFreq)) * 3)) + f.high / (1 + Math.exp(-(l2 - Math.log2(f.highFreq)) * 3));
        (f.peaks || []).forEach((p) => { db += p.db * Math.exp(-Math.pow((l2 - Math.log2(p.f)) * p.q * 1.2, 2)); });
        const X = (i / 160) * w; i ? ctx.lineTo(X, y(db)) : ctx.moveTo(X, y(db));
      }
      ctx.strokeStyle = f.on ? ACID : "rgba(236,236,238,0.4)"; ctx.lineWidth = 2; ctx.stroke();
    }
    function fixFxTargets() { /* targets naming fx by index may now point elsewhere; by type they follow. Nothing to rewrite. */ }
    function startFxDrag(e, card, from) {
      e.preventDefault();
      const list = card.parentNode, cards = [...list.querySelectorAll(".tm-fxcard")];
      const mids = cards.map((c) => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; });
      const y0 = e.clientY;
      let to = from;
      card.classList.add("tm-dragging");
      const mv = (ev) => {
        const dy = ev.clientY - y0;
        card.style.transform = `translateY(${dy}px)`;
        const cy = mids[from] + dy;
        to = 0;
        for (let k = 0; k < mids.length; k++) if (k !== from && cy > mids[k]) to++;
        cards.forEach((c, k) => {
          if (k === from) return;
          let shift = 0;
          if (from < to && k > from && k <= to) shift = -1;
          if (from > to && k < from && k >= to) shift = 1;
          c.style.transform = shift ? `translateY(${shift * (card.offsetHeight + 10)}px)` : "";
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", mv);
        window.removeEventListener("pointerup", up);
        cards.forEach((c) => (c.style.transform = ""));
        card.classList.remove("tm-dragging");
        if (to !== from) {
          const [fa, oa] = pair("fx");
          fa.splice(to, 0, fa.splice(from, 1)[0]);
          oa.splice(to, 0, oa.splice(from, 1)[0]);
          flushPreset();
          rebuild(["effects", "engine"]);
        }
      };
      window.addEventListener("pointermove", mv);
      window.addEventListener("pointerup", up);
    }

    // ------------------------------------------------ TEXTURE page (granular)
    const TEX_FIRST = ["size", "density", "mix"];
    const TEX_REST = ["pitch", "spray", "position", "shape", "reverse", "pitchRandom", "spread", "feedback", "tone", "drive", "space"];
    const TEX_LABEL = { size: "Size", density: "Density", mix: "Mix", pitch: "Pitch", spray: "Spray", position: "Position", shape: "Shape", reverse: "Reverse", pitchRandom: "Pitch rand", spread: "Spread", feedback: "Feedback", tone: "Tone", drive: "Drive", space: "Space" };
    const TEX_ICON = SV('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="8" r="2" fill="currentColor"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.6" fill="currentColor"/><circle cx="19" cy="13" r="2.2" fill="currentColor"/><path d="M3 18h18" opacity=".5"/>');
    const texIndex = () => full.fx.findIndex((f) => f.type === "texture");
    let texCanvas = null, grains = [], texSpawn = 0, texHead = 0;
    function texOn() { const i = texIndex(); return i >= 0 && full.fx[i].on; }
    function addTexture(mode) {
      let i = texIndex();
      if (i < 0) {
        if (full.fx.length >= MAX_FX) { toast("Effects are full", ["Remove an effect on the Effects page to make room for Texture (max " + MAX_FX + ")."]); return -1; }
        const [fa, oa] = pair("fx");
        const o = { type: "texture" };
        if (mode) o.mode = mode;
        fa.push(fxWithDefaults(o)); oa.push(o);
        i = fa.length - 1;
      } else if (!full.fx[i].on) set(["fx", i, "on"], true, true);
      if (mode) setTexMode(i, mode, true);
      flushPreset();
      return i;
    }
    /** Picking a mode drops the per-field overrides (so the mode plays as designed), keeping mix, freeze and on. */
    function setTexMode(i, mode, quiet) {
      const [fa, oa] = pair("fx");
      const o = oa[i] || {}, keep = { type: "texture", mode };
      ["on", "mix", "freeze"].forEach((k) => { if (o[k] !== undefined) keep[k] = o[k]; });
      oa[i] = keep;
      fa[i] = fxWithDefaults(keep);
      if (!quiet) { flushPreset(); rebuild(); }
    }
    function renderTexture() {
      const pg = pages.texture, st = pg.scrollTop;
      pg.textContent = "";
      const i = texIndex(), tx = i >= 0 ? full.fx[i] : fxWithDefaults({ type: "texture" });
      const wrap = el("div", "tm-tex" + (i >= 0 && tx.on ? "" : " tm-texoff"));
      const head = el("div", "tm-texhead");
      const pw = btn("tm-power tm-texpower" + (i >= 0 ? " tm-on" : ""), ICON.power, i >= 0 ? "Remove Texture from the effects" : "Add Texture to the effects");
      pw.addEventListener("click", () => {
        if (texIndex() >= 0) { const [fa, oa] = pair("fx"); const k = texIndex(); fa.splice(k, 1); oa.splice(k, 1); flushPreset(); }
        else addTexture();
        rebuild();
      });
      const ttl = el("div", "tm-textitle");
      ttl.append(el("div", "tm-texname", "TEXTURE"), el("div", "tm-texsub", i >= 0 ? (tx.on ? "Grains on \u00b7 slot " + (i + 1) + " of the effects" : "Bypassed") : "Off \u00b7 switch on or pick a mode"));
      head.append(pw, ttl);
      const chips = el("div", "tm-chips");
      TEX_MODES.forEach(([m, label]) => {
        const c = btn("tm-modechip" + (tx.mode === m && i >= 0 ? " tm-sel" : ""), null, "Mode: " + label);
        c.textContent = label;
        c.addEventListener("click", () => { addTexture(m); rebuild(); });
        chips.append(c);
      });
      const stageT = el("div", "tm-texstage");
      texCanvas = el("canvas", "tm-texcv");
      const xy = el("div", "tm-texxy");
      xy.innerHTML = '<div class="tm-xygrid"></div><div class="tm-xydot"></div><div class="tm-xyl tm-xyx">SIZE</div><div class="tm-xyl tm-xyy">DENSITY</div><div class="tm-xyv"></div>';
      const dot = xy.querySelector(".tm-xydot"), xyv = xy.querySelector(".tm-xyv");
      const M = FX_META.texture;
      bind(() => {
        const k = texIndex(), t = k >= 0 ? full.fx[k] : tx;
        const nx = toN(M.size, t.size), ny = toN(M.density, t.density);
        dot.style.left = nx * 100 + "%"; dot.style.top = (1 - ny) * 100 + "%";
        xyv.textContent = M.size.fmt(t.size) + " \u00b7 " + M.density.fmt(t.density);
      });
      xy.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        let k = texIndex();
        if (k < 0) { k = addTexture(); if (k < 0) return; rebuild(); return; }
        pair("fx");
        xy.setPointerCapture(e.pointerId);
        xy.classList.add("tm-active");
        const r = xy.getBoundingClientRect();
        const f = (ev) => {
          const nx = clamp((ev.clientX - r.left) / r.width), ny = clamp(1 - (ev.clientY - r.top) / r.height);
          set(["fx", k, "size"], fromN(M.size, nx), true);
          set(["fx", k, "density"], fromN(M.density, ny), true);
          pushPreset(); queueRefresh();
        };
        f(e);
        const up = () => { xy.classList.remove("tm-active"); xy.removeEventListener("pointermove", f); xy.removeEventListener("pointerup", up); flushPreset(); };
        xy.addEventListener("pointermove", f); xy.addEventListener("pointerup", up);
      });
      const cvBox = el("div", "tm-texcvbox");
      cvBox.append(texCanvas);
      stageT.append(cvBox, xy);
      const kn = el("div", "tm-knobrow tm-texknobs");
      if (i >= 0) {
        TEX_FIRST.forEach((k) => kn.append(knob(TEX_LABEL[k], ["fx", i, k])));
        kn.append(el("div", "tm-vsep"));
        TEX_REST.forEach((k) => kn.append(knob(TEX_LABEL[k], ["fx", i, k])));
        kn.append(toggle("Freeze", ["fx", i, "freeze"]));
      } else {
        const cta = btn("tm-addbtn tm-texcta", ICON.plus + "<span>Switch Texture on</span>");
        cta.addEventListener("click", () => { addTexture(); rebuild(); });
        kn.append(cta);
      }
      wrap.append(head, chips, stageT, kn);
      pg.append(wrap);
      pg.scrollTop = st;
    }
    function drawTexture(dt) {
      const c = texCanvas;
      if (!c || !c.isConnected) return;
      const r = c.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = r.width, h = r.height;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = texIndex(), on = k >= 0 && full.fx[k].on;
      const t = k >= 0 ? full.fx[k] : fxWithDefaults({ type: "texture" });
      const mode = t.mode, now = performance.now() / 1000;
      // trails: feedback keeps more of the last frame
      ctx.fillStyle = `rgba(16,16,19,${(0.5 - t.feedback * 0.42).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      // the source "waveform" along the timeline
      const mid = h * 0.5;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let x = 0; x < w; x += 3) {
        const a = (0.25 + 0.75 * Math.abs(Math.sin(x * 0.021) * Math.sin(x * 0.0063 + 1.3))) * h * 0.32;
        ctx.fillRect(x, mid - a, 2, a * 2);
      }
      // playhead (frozen = parked at Position)
      const frozen = t.freeze || mode === "freezePad";
      if (!frozen) texHead = (texHead + dt * 0.08) % 1;
      const head = frozen ? t.position : (t.position + texHead * 0.3) % 1;
      ctx.strokeStyle = "rgba(228,255,58,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(head * w, 8); ctx.lineTo(head * w, h - 8); ctx.stroke();
      // spawn grains
      let rate = Math.min(400, t.density * 2.5 + 20) * (on ? 1 : 0.35);
      if (mode === "stutter") rate *= (now * 4) % 1 < 0.35 ? 2.2 : 0.05;
      texSpawn += rate * dt;
      const pitchY = (p) => mid - (clamp(p, -36, 36) / 36) * (h * 0.42);
      while (texSpawn >= 1 && grains.length < 600) {
        texSpawn -= 1;
        let pitch = t.pitch + (Math.random() * 2 - 1) * t.pitchRandom;
        if (mode === "shimmer" && Math.random() < 0.45) pitch += 12 * (Math.random() < 0.3 ? 2 : 1);
        if (mode === "octaveRumble" && Math.random() < 0.6) pitch -= Math.random() < 0.5 ? 12 : 24;
        let x = head + (Math.random() * 2 - 1) * (0.02 + t.spray * 0.6) * Math.random();
        if (mode === "glitchSpray" && Math.random() < 0.4) x = Math.random();
        if (mode === "stutter") x = Math.round(x * 16) / 16;
        const rev = Math.random() < t.reverse || mode === "reverseBloom";
        const life = Math.max(0.12, Math.min(2.4, t.size * (mode === "freezePad" || mode === "cloud" ? 4 : 2.5)));
        grains.push({ x: ((x % 1) + 1) % 1, y: pitchY(pitch) + (Math.random() * 2 - 1) * t.spread * 14, pitch, age: 0, life, rev, sq: mode === "crushedGrains" || mode === "glitchSpray" && Math.random() < 0.5, vy: mode === "shimmer" ? -14 : mode === "octaveRumble" ? 6 : (Math.random() - 0.5) * 6 });
      }
      if (texSpawn > 4) texSpawn = 0;
      const mixA = 0.35 + 0.65 * t.mix;
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(180,150,255,0.7)";
      ctx.shadowBlur = 4 + t.space * 16;
      const keep = [];
      for (const g of grains) {
        g.age += dt;
        if (g.age > g.life) continue;
        keep.push(g);
        const ph = g.age / g.life;
        const env = t.shape < 0.5 ? Math.min(1, Math.min(ph, 1 - ph) * (4 + (0.5 - t.shape) * 40)) : Math.sin(Math.PI * ph);
        const hue = 275 - (clamp(g.pitch, -24, 24) / 24) * 120 + (g.pitch > 12 ? -40 : 0);
        const light = 45 + t.tone * 30 + t.drive * 0.6;
        const sz = 2.5 + Math.sqrt(t.size) * 20 * (0.4 + 0.6 * env);
        const gx = g.x * w + (g.rev ? -1 : 1) * ph * 26 * (mode === "reverseBloom" ? 3 : 1), gy = g.y + g.vy * g.age;
        ctx.fillStyle = `hsla(${hue.toFixed(0)},${Math.min(100, 70 + t.drive * 1.5).toFixed(0)}%,${light.toFixed(0)}%,${(env * mixA * (on ? 1 : 0.4)).toFixed(3)})`;
        if (g.sq) { const q = sz * 0.9; ctx.fillRect(Math.round(gx / 6) * 6 - q / 2, Math.round(gy / 6) * 6 - q / 2, q, q); }
        else { ctx.beginPath(); ctx.arc(gx, gy, sz * (mode === "reverseBloom" ? 0.4 + ph : 1), 0, Math.PI * 2); ctx.fill(); }
        if (g.rev) { ctx.fillRect(gx, gy - 0.5, 18 * env, 1); }
      }
      grains = keep;
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(236,236,238,0.32)";
      ctx.font = "10px " + getComputedStyle(root).fontFamily;
      ctx.fillText("+24 st", 8, 14);
      ctx.fillText("-24 st", 8, h - 8);
      ctx.fillText("TIMELINE \u2192", w - 72, h - 8);
    }

    // ------------------------------------------------ drop a sound
    let sharedCtx = null, analyzing = false, dragDepth = 0;
    function audioCtx() {
      if (opts.audioContext) return opts.audioContext;
      if (api.audioContext) return api.audioContext;
      if (!sharedCtx) { const AC = window.AudioContext || window.webkitAudioContext; sharedCtx = AC ? new AC() : null; }
      return sharedCtx;
    }
    const hasFiles = (e) => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].indexOf("Files") >= 0);
    root.addEventListener("dragenter", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth++;
      if (page !== "play" && page !== "drop") showPage("play");
      root.classList.add("tm-filedrag");
    });
    root.addEventListener("dragover", (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    root.addEventListener("dragleave", (e) => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) root.classList.remove("tm-filedrag"); });
    root.addEventListener("drop", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      root.classList.remove("tm-filedrag");
      if (page === "drop" && dropZonePage) { dropZonePage.addFiles(e.dataTransfer.files); return; }
      if (mode === "create" && create) { create.addFiles(e.dataTransfer.files); return; }
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) dropSound(f);
    });
    var samplePeaks = null;   // { file, p: [0..1] } the Sampler's sound as a picture
    async function dropSound(file) {
      if (analyzing) return;
      const A = window.ToyMachineAnalyze;
      if (!A || typeof A.fromFile !== "function") { toast("Can't read sounds yet", ["The sound analyser (toymachine-analyze.js) isn't loaded in this window."]); return; }
      analyzing = true;
      root.classList.add("tm-analyzing");
      try {
        const res = await A.fromFile(file, audioCtx());
        if (!res || !res.preset) throw new Error("No preset came back");
        if (res.sample) call("setSample", res.sample);
        hasPreset = true;
        if (!res.preset.name) res.preset.name = String(file.name || "Dropped").replace(/\.[^.]+$/, "");
        setPresetInternal(res.preset);
        flushPreset();
        call("audition", res.preset);
        const notes = res.report && Array.isArray(res.report.notes) ? res.report.notes : [];
        toast("Made a synth from " + (file.name || "your sound"), notes.length ? notes.slice(0, 8) : ["Play the keys to hear it, then drag the points."], true);
      } catch (err) {
        console.warn("[ToyMachine] analyze", err);
        toast("Couldn't read that sound", [String((err && err.message) || err)]);
      } finally {
        analyzing = false;
        root.classList.remove("tm-analyzing");
      }
    }
    let toastEl = null, toastTimer = 0;
    function toast(title, lines, good) {
      if (toastEl) toastEl.remove();
      clearTimeout(toastTimer);
      toastEl = el("div", "tm-toast" + (good ? " tm-good" : ""));
      const x = btn("tm-x", ICON.close, "Dismiss");
      x.addEventListener("click", () => { toastEl.remove(); toastEl = null; });
      const hd = el("div", "tm-toasthead");
      hd.append(el("div", "tm-toasttitle", title), x);
      const ul = el("ul");
      (lines || []).forEach((l) => ul.append(el("li", null, String(l))));
      toastEl.append(hd, ul);
      root.append(toastEl);
      toastTimer = setTimeout(() => { if (toastEl) { toastEl.classList.add("tm-out"); setTimeout(() => { if (toastEl) { toastEl.remove(); toastEl = null; } }, 400); } }, 15000);
    }

    // ------------------------------------------------ preset drawer
    // Pushes in from the right (the ring stays playable next to it). Search matches tag words,
    // not only names: index.json entries carry kw[] from make_keywords.py (Splice tags, what
    // the settings do, how the sound measures, synonyms), so "distorted" finds dirty basses,
    // leads and synths alike, and the category chips narrow it to one kind of sound.
    // Favourites are kept by preset id (older ones by name), so two presets that share a name
    // ("Piano" in Keys and in Pads) are hearted on their own.
    // (function declarations and var: the top bar's heart reads these before this point runs)
    function favHas(f, e) { return (e.id && f.indexOf(e.id) >= 0) || f.indexOf(e.name) >= 0; }
    function isFav(e) { return favHas(favStore.get(), e); }
    function toggleFav(e) {
      const f = favStore.get().filter((x) => x !== e.name && x !== e.id);
      if (!favHas(favStore.get(), e)) f.push(e.id || e.name);
      favStore.set(f);
    }
    // The entry that's loaded: by id when we loaded it from the list, else by name + category.
    var curId = null; // eslint-disable-line no-var
    function isCur(e) { return curId ? e.id === curId : e.name === full.name && (!e.category || e.category === full.category); }
    function curEntry() { return index.find(isCur) || { name: full.name }; }
    const srcText = (e) => (e && e.source ? (typeof e.source === "string" ? e.source : [e.source.song, e.source.part].filter(Boolean).join(" · ")) : "");
    function currentIndex() { return index.findIndex(isCur); }
    function step(d) {
      if (!index.length) return;
      // KT2 quest 1: the arrows flip through just the quest's sounds, round and round (Eman, 7 Nov)
      const only = Array.isArray(window.TM_ONLY_PRESETS) && window.TM_ONLY_PRESETS.length ? window.TM_ONLY_PRESETS.map((id) => index.find((e) => e.id === id)).filter(Boolean) : null;
      const list = only && only.length ? only : browser && browser.rows.length ? browser.rows : index;
      let i = list.findIndex(isCur);
      i = i < 0 ? 0 : (i + d + list.length) % list.length;
      loadEntry(list[i]);
    }
    // Preview: one short note when you switch presets. Off = silent switching (per viewer).
    const previewStore = { get() { try { return localStorage.getItem("tm-preview") !== "0"; } catch (e) { return true; } }, set(v) { try { localStorage.setItem("tm-preview", v ? "1" : "0"); } catch (e) { /* private window */ } } };
    let loadSeq = 0;
    async function loadEntry(entry, noAudition) {
      if (!entry || (typeof opts.loadPreset !== "function" && !entry.mine)) return;
      const seq = ++loadSeq;
      let p;
      try { p = entry.mine && window.ToyMachineCreate ? await ToyMachineCreate.mine.load(entry, call) : await opts.loadPreset(entry); } catch (e) { console.warn("[ToyMachine] loadPreset", e); return; }
      if (!p || seq !== loadSeq || closed) return;
      if (!p.name) p.name = entry.name;
      if (!p.category && entry.category) p.category = entry.category;
      if (!p.genre && entry.genre) p.genre = entry.genre;
      // the drop zone's sounds stay when you flip through core sounds
      // (as plain sounds: an ARP / STUTTER / repeat pattern never follows you into the next preset)
      if (orig.drops && Array.isArray(orig.drops.items) && orig.drops.items.length && !p.drops) {
        const dz = Object.assign(clone(orig.drops), { custom: undefined, coreFollows: false });
        dz.items.forEach((it) => { if (it.mode && it.mode !== "synth") { it.mode = "synth"; delete it.modeBefore; } it.rate = 0; it.nudge = 0; });
        p = Object.assign({}, p, { drops: dz });
      }
      hasPreset = true;
      setPresetInternal(p);
      curId = entry.id || null;
      flushPreset();
      if (!noAudition && (previewStore.get() || noAudition === false)) call("audition", p);
      if (browser) browser.sync();
      if (window.ToyMachinePacks) ToyMachinePacks.sync();
    }

    // search words people type that aren't in the index as such
    const ALIAS = { distortion: "distorted", dist: "distorted", distort: "distorted", grit: "gritty", grimy: "dirty", crunch: "crunchy", fuzz: "distorted",
      lofi: "lofi", "lo": "lo-fi", muffle: "muffled", muted: "muffled", filtered: "muffled", warmth: "warm", "808s": "808", subs: "sub", reese: "detuned",
      supersaws: "supersaw", strings: "pad", choir: "vocal", vox: "vocal", plucky: "pluck", bell: "keys", bells: "keys", ep: "keys", rhodes: "keys",
      wobbly: "wobble", vinyl: "lofi", echoes: "echo", verb: "reverby", reverb: "reverby", space: "spacious", spacey: "spacious", huge: "big",
      evil: "evil", scary: "sinister", sad: "sad", chill: "soft", synths: "synth", arps: "arp", leads: "lead", pads: "pad", plucks: "pluck", basses: "bass" };
    const kwCache = new WeakMap();
    function termsOf(e) {
      let t = kwCache.get(e);
      if (t) return t;
      const name = String(e.name || "").toLowerCase();
      const words = new Set([...(e.kw || []), ...(e.tags || []), e.category, e.key, (e.source && e.source.song) || "", (e.source && e.source.pack) || ""]
        .filter(Boolean).map((x) => String(x).toLowerCase()));
      name.split(/[^a-z0-9#+]+/).filter(Boolean).forEach((w) => words.add(w));
      if (e.category) words.add(String(e.category).toLowerCase().replace(/s$/, ""));
      t = { name, words: [...words] };
      kwCache.set(e, t);
      return t;
    }
    /** How well one entry matches the query (0 = not at all). Every word has to match something. */
    function scoreEntry(e, toks, phrase) {
      const t = termsOf(e);
      let total = 0;
      if (phrase.length > 2 && t.name.indexOf(phrase) >= 0) total += 8;
      for (const raw of toks) {
        const cands = [raw, ALIAS[raw], raw.replace(/es$/, ""), raw.replace(/s$/, "")].filter((x, i, a) => x && a.indexOf(x) === i);
        let best = 0;
        for (const q of cands) {
          if (t.name.split(/[^a-z0-9#+]+/).indexOf(q) >= 0) best = Math.max(best, 5);
          else if (t.name.indexOf(q) >= 0 && q.length > 2) best = Math.max(best, 3);
          for (const w of t.words) {
            if (w === q) best = Math.max(best, 4);
            else if (q.length > 2 && (w.startsWith(q) || w.indexOf(" " + q) >= 0)) best = Math.max(best, 2);
            else if (q.length > 3 && w.indexOf(q) >= 0) best = Math.max(best, 1);
          }
        }
        if (!best) return 0;
        total += best;
      }
      return total;
    }
    const catRank = (e) => { const i = CATEGORIES.indexOf(e.category); return i < 0 ? 99 : i; };
    const SUGGEST = ["distorted", "muffled", "dark", "wide", "808", "analog", "tape", "detuned", "short", "ambient"];

    function openBrowser(quiet) {
      if (browser) { if (browser.search) browser.search.focus(); return; }
      const dr = el("aside", "tm-drawer");
      const head = el("div", "tm-dhead");
      const cl = btn("tm-iconbtn", ICON.close, "Close (Esc)");
      head.append(el("div", "tm-btitle", "Presets"));
      // PRESET PACKS (Eman, 16 Nov): the pack button turns the whole view into the library of every
      // preset pack (ui/toymachine-packs.js). KT2_TM_PACKS_OFF = no button, the drawer as before.
      if (window.ToyMachinePacks && !window.KT2_TM_PACKS_OFF) {
        const pk = btn("tm-iconbtn tmp-dbtn", ToyMachinePacks.ICON.packs, "Preset packs");
        pk.addEventListener("click", openPacks);
        head.append(pk);
      }
      head.append(el("span", "tm-dcount"), cl);
      const search = el("input", "tm-search");
      search.type = "search";
      search.placeholder = "Search: distorted, muffled, 808…";
      search.spellcheck = false;
      const sw = el("label", "tm-searchwrap");
      sw.innerHTML = ICON.search;
      sw.append(search);
      const chips = el("div", "tm-chips"), sugg = el("div", "tm-sugg"), list = el("div", "tm-blist");
      const foot = el("div", "tm-dfoot");
      const prev = el("label", "tm-prevsw");
      const pbox = el("input");
      pbox.type = "checkbox";
      pbox.checked = previewStore.get();
      prev.append(pbox, el("i"), el("span", null, "Preview note"));
      prev.title = "Play one short note when you switch presets";
      foot.append(prev);
      dr.append(head, sw, chips, sugg, list, foot);
      $(".tm-main").append(dr);
      const st = (() => { try { return JSON.parse(localStorage.getItem("tm-drawer-state") || "{}"); } catch (e) { return {}; } })();
      // KILLTOY 333 pack chip: all the pack's sounds in one list (flag KT2_TM_333CHIP_OFF hides it)
      const K333 = "333", isK333 = (e) => !!(e.source && e.source.pack === "KILLTOY 333");
      const has333 = !window.KT2_TM_333CHIP_OFF && index.some(isK333);
      const state = { cat: CATEGORIES.indexOf(st.cat) >= 0 || st.cat === "\u2665" || (st.cat === "Mine" && index.some((e) => e.mine)) || (st.cat === K333 && has333) ? st.cat : "All", q: "", sel: -1 };
      browser = { rows: [], sync: () => { drawChips(); drawList(true); }, el: dr, search };
      const saveState = (open) => { try { localStorage.setItem("tm-drawer-state", JSON.stringify({ open, cat: state.cat })); } catch (e) { /* private window */ } };
      saveState(true);
      function drawChips() {
        chips.textContent = "";
        const favs = favStore.get();
        ["All"].concat(index.some((e) => e.mine) ? ["Mine"] : [], has333 ? [K333] : [], CATEGORIES, ["\u2665"]).forEach((c) => {
          const n = c === "All" ? index.length : c === "\u2665" ? index.filter((e) => favHas(favs, e)).length : c === K333 ? index.filter(isK333).length : index.filter((e) => e.category === c).length;
          if (!n && c !== "All" && c !== "♥") return;
          const b = btn("tm-chip" + (state.cat === c ? " tm-sel" : "") + (c === "♥" ? " tm-chipfav" : ""), null, c === "♥" ? "Favourites" : n + " presets");
          if (c === "♥") b.innerHTML = ICON.heart; else b.textContent = c;
          b.addEventListener("click", () => { state.cat = state.cat === c && c !== "All" ? "All" : c; saveState(true); drawChips(); drawList(); });
          chips.append(b);
        });
      }
      function drawSugg() {
        sugg.textContent = "";
        sugg.hidden = !!state.q.trim();
        SUGGEST.forEach((w) => {
          const b = btn("tm-suggw", null, "Search " + w);
          b.textContent = w;
          b.addEventListener("click", () => { search.value = w; state.q = w; drawSugg(); drawList(); search.focus(); });
          sugg.append(b);
        });
      }
      function drawList(keepScroll) {
        const phrase = state.q.trim().toLowerCase(), favs = favStore.get();
        const toks = phrase.split(/[\s,]+/).filter(Boolean);
        let rows = index.filter((e) => state.cat === "All" || (state.cat === "\u2665" ? favHas(favs, e) : state.cat === K333 ? isK333(e) : e.category === state.cat));
        const why = new Map();
        if (toks.length) {
          rows = rows.map((e) => [e, scoreEntry(e, toks, phrase)]).filter((x) => x[1] > 0)
            .sort((a, b) => b[1] - a[1] || catRank(a[0]) - catRank(b[0]) || String(a[0].name).localeCompare(String(b[0].name))).map((x) => x[0]);
          // show which tag words matched under the name
          rows.forEach((e) => {
            const t = termsOf(e);
            const hit = t.words.filter((w) => toks.some((q) => w === q || w === ALIAS[q] || (q.length > 2 && w.startsWith(q)))).slice(0, 3);
            if (hit.length) why.set(e, [e.category].concat(hit).filter(Boolean).join(" \u00b7 "));
          });
        }
        browser.rows = rows;
        state.sel = rows.findIndex(isCur);
        dr.querySelector(".tm-dcount").textContent = rows.length + (rows.length === 1 ? " sound" : " sounds");
        const top = list.scrollTop;
        list.textContent = "";
        if (!rows.length) list.append(el("div", "tm-empty", index.length ? "Nothing matches. Try another word." : "No presets yet."));
        rows.forEach((e, i) => {
          const r = el("div", "tm-brow" + (i === state.sel ? " tm-sel" : ""));
          const hb = btn("tm-bheart" + (favHas(favs, e) ? " tm-on" : ""), ICON.heart, "Favourite");
          hb.addEventListener("click", (ev) => { ev.stopPropagation(); toggleFav(e); drawChips(); drawList(true); refresh(); });
          const nm = el("div", "tm-bname");
          nm.append(el("span", "tm-bn", e.name), el("span", "tm-bsrc", why.get(e) || [e.category, srcText(e)].filter(Boolean).join(" · ")));
          r.append(hb, nm);
          r.addEventListener("click", () => { state.sel = i; list.querySelectorAll(".tm-brow").forEach((x, k) => x.classList.toggle("tm-sel", k === i)); loadEntry(e); });
          list.append(r);
        });
        if (keepScroll) list.scrollTop = top;
        const s = list.querySelector(".tm-sel");
        if (s && !keepScroll) s.scrollIntoView({ block: "nearest" });
      }
      browser.move = (d) => {
        const rows = browser.rows;
        if (!rows.length) return;
        state.sel = state.sel < 0 ? 0 : clamp(state.sel + d, 0, rows.length - 1);
        loadEntry(rows[state.sel]);
        list.querySelectorAll(".tm-brow").forEach((r, i) => r.classList.toggle("tm-sel", i === state.sel));
        const s = list.querySelector(".tm-sel");
        if (s) s.scrollIntoView({ block: "nearest" });
      };
      search.addEventListener("input", () => { state.q = search.value; drawSugg(); drawList(); });
      search.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { browserKey(e); return; }
        if (e.key === "Enter") { e.preventDefault(); search.blur(); root.focus({ preventScroll: true }); return; }
        if (e.key === "Escape") { e.preventDefault(); if (search.value) { search.value = ""; state.q = ""; drawSugg(); drawList(); } else closeBrowser(); return; }
        e.stopPropagation();
      });
      pbox.addEventListener("change", () => previewStore.set(pbox.checked));
      cl.addEventListener("click", closeBrowser);
      root.classList.add("tm-drawer-open");
      $(".tm-presetname").classList.add("tm-on");
      drawChips();
      drawSugg();
      drawList();
      if (!quiet) search.focus({ preventScroll: true });
      setTimeout(() => { if (!closed) { sizeDisc(); refresh(); queueLinks(); } }, 260);
    }
    function openPacks() {
      if (!window.ToyMachinePacks) return;
      ToyMachinePacks.open({
        main: $(".tm-main"), index: () => index, isCur,
        load: (e) => loadEntry(e, false),   // press = load + always play one note
        choose: (e) => { if (!isCur(e)) loadEntry(e, true); },
        close: () => { if (!closed) { root.focus({ preventScroll: true }); setTimeout(() => { if (!closed) { sizeDisc(); refresh(); } }, 60); } },
      });
    }
    /** Keys while the drawer is open: up/down step through the list, Esc closes. Returns true when used. */
    function browserKey(e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); browser.move(e.key === "ArrowDown" ? 1 : -1); return true; }
      if (e.key === "Escape") { e.preventDefault(); closeBrowser(); return true; }
      return false;
    }
    function closeBrowser() {
      if (!browser) return;
      browser.el.remove();
      browser = null;
      root.classList.remove("tm-drawer-open");
      $(".tm-presetname").classList.remove("tm-on");
      try { const s = JSON.parse(localStorage.getItem("tm-drawer-state") || "{}"); s.open = false; localStorage.setItem("tm-drawer-state", JSON.stringify(s)); } catch (e) { /* private window */ }
      root.focus({ preventScroll: true });
      setTimeout(() => { if (!closed) { sizeDisc(); refresh(); queueLinks(); } }, 260);
    }

    // ------------------------------------------------ ARP page (library + dice: ui/toymachine-arps.js; engine: TmArp.h)
    // The pattern lives in the preset ("arp"), so it saves with the preset and the lane, and a
    // preset you flip to brings its own (usually none = off). Only the steps sound, never the held keys.
    const ARPS = window.ToyMachineArps || null;
    const ARP_DEFAULT = { Bass: "Disco Octaves", Pads: "Blue Hour Drift", Plucks: "Snowfall Plucks", Keys: "Up/Down 1 Oct", Leads: "SH-101 Run", Arps: "Berlin School", FX: "Glitch Stack", Synths: "Up 2 Oct" };
    const ARP_FAMS = ["All"].concat(ARPS && ARPS.FAMILIES ? ARPS.FAMILIES : ["Classic", "Famous", "Ambient", "Modular"], ["Mine"]);
    let arpFam = "All", arpPos = -1, arpCols = [], arpRolled = false;
    const arpOf = () => (isObj(full.arp) ? full.arp : null);
    const arpOn = () => !!(arpOf() && full.arp.on);
    function setArp(a, keepPage) {
      if (a) { full.arp = a; orig.arp = clone(a); } else { delete full.arp; delete orig.arp; }
      flushPreset();
      if (!keepPage) renderArp();
      queueRefresh();
    }
    /** Changes the pattern in place (steps editor, sliders): no page rebuild, the engine follows. */
    function arpTouch(f) {
      const a = arpOf();
      if (!a) return;
      f(a);
      orig.arp = clone(a);
      pushPreset();
      drawArpSteps();
      queueRefresh();
    }
    function arpList() {
      if (!ARPS) return [];
      if (arpFam === "Mine") return ARPS.kept.get();
      return arpFam === "All" ? ARPS.PATTERNS : ARPS.PATTERNS.filter((p) => p.family === arpFam);
    }
    function pickArp(p) { arpRolled = false; setArp(ARPS.toPreset(p, true)); }
    function arpFlip(d) {
      const l = arpList();
      if (!l.length) return;
      const a = arpOf();
      let i = a ? l.findIndex((p) => p.name === a.name) : -1;
      i = i < 0 ? (d > 0 ? 0 : l.length - 1) : (i + d + l.length) % l.length;
      pickArp(l[i]);
    }
    function arpPower() {
      const a = arpOf();
      if (a) { a.on = !a.on; setArp(a); return; }
      pickArp(ARPS.find(ARP_DEFAULT[full.category] || "Up 1 Oct") || ARPS.PATTERNS[0]);
    }
    function rollArp(seed, wild) {
      arpRolled = true;
      setArp(ARPS.toPreset(ARPS.roll(seed, wild), true), true);
      renderArpHead();
      drawArpSteps();
    }
    /** The ARP dice: click = a brand-new pattern; drag up/down = wilder / tamer (same roll). */
    function arpDice(small) {
      const b = el("button", "tm-dice tm-arpdice" + (small ? "" : " tm-arpdice-big"));
      b.type = "button";
      b.innerHTML = '<svg viewBox="0 0 24 24"><circle class="tm-dice-ring" cx="12" cy="12" r="10.5"/><path class="tm-dice-arc"/><rect x="6.5" y="6.5" width="11" height="11" rx="2.6"/><circle cx="9.6" cy="9.6" r="1.15" fill="currentColor"/><circle cx="14.4" cy="14.4" r="1.15" fill="currentColor"/><circle cx="12" cy="12" r="1.15" fill="currentColor"/></svg>' + (small ? "" : "<span>Dice</span>");
      bind(() => {
        const a = arpOf(), w = a && a.seed ? (a.wild == null ? 0.5 : a.wild) : 0.5;
        b.querySelector(".tm-dice-arc").setAttribute("d", a && a.seed ? arcPath(12, 12, 10.5, 0, Math.max(8, w * 359.9)) : "");
        b.classList.toggle("tm-dice-on", !!(a && a.seed && a.on));
        b.title = "Dice: click for a brand-new ARP pattern nobody has made before. Drag up for wilder, down for tamer" + (a && a.seed ? ` (now ${Math.round(w * 100)}% wild)` : "");
      });
      b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || !ARPS) return;
        e.preventDefault(); e.stopPropagation();
        b.setPointerCapture(e.pointerId);
        const a0 = arpOf(), y0 = e.clientY;
        const w0 = a0 && a0.seed ? (a0.wild == null ? 0.5 : a0.wild) : 0.5, seed0 = a0 && a0.seed ? a0.seed : ARPS.newSeed();
        let moved = false, lastW = -1;
        const mv = (ev) => {
          if (!moved && Math.abs(ev.clientY - y0) < 4) return;
          moved = true;
          const w = Math.round(clamp(w0 + (y0 - ev.clientY) * 0.005) * 50) / 50;
          if (w !== lastW) { lastW = w; rollArp(seed0, w); }
        };
        const up = () => { b.removeEventListener("pointermove", mv); b.removeEventListener("pointerup", up); if (!moved) rollArp(ARPS.newSeed(), w0); if (page === "arp") renderArp(); else queueRefresh(); };
        b.addEventListener("pointermove", mv); b.addEventListener("pointerup", up);
      });
      return b;
    }

    let arpHeadEl = null, arpStepsEl = null;
    function renderArp() {
      const pg = pages.arp;
      if (!pg) return;
      const st = pg.scrollTop;
      pg.textContent = "";
      arpCols = [];
      const wrap = el("div", "tm-arp");
      if (!ARPS) { wrap.append(el("div", "tm-empty", "The ARP library didn't load.")); pg.append(wrap); return; }
      arpHeadEl = el("div", "tm-arphead");
      arpStepsEl = el("div", "tm-arpsteps");
      wrap.append(arpHeadEl);
      renderArpHead();
      const a = arpOf();
      if (a) {
        wrap.append(arpStepsEl, arpSettings());
        drawArpSteps();
      } else {
        wrap.append(el("div", "tm-arphint", "Pick a pattern below, or roll the dice for one nobody has made before. Then hold a few keys."));
      }
      wrap.append(arpLibrary());
      pg.append(wrap);
      pg.scrollTop = st;
    }
    function renderArpHead() {
      if (!arpHeadEl) return;
      const h = arpHeadEl, a = arpOf();
      h.textContent = "";
      const pw = btn("tm-power tm-texpower" + (a && a.on ? " tm-on" : ""), ICON.power, a && a.on ? "Switch the ARP off (the keys play normally)" : "Switch the ARP on");
      pw.addEventListener("click", arpPower);
      const ttl = el("div", "tm-textitle");
      ttl.append(el("div", "tm-texname", "ARP"), el("div", "tm-texsub", a ? (a.on ? (a.family || "") + (a.family ? " · " : "") + (a.rate || "1/16") : "Off · " + (a.name || "")) : "Off · works with any sound"));
      const nav = el("div", "tm-arpnav");
      const pv = btn("tm-sqbtn", ICON.left, "Previous pattern"), nx = btn("tm-sqbtn", ICON.right, "Next pattern");
      pv.addEventListener("click", () => arpFlip(-1)); nx.addEventListener("click", () => arpFlip(1));
      const nm = el("div", "tm-arpname" + (a && a.on ? "" : " tm-dim"), a ? a.name || "Pattern" : "No pattern");
      nm.title = a ? (ARPS.find(a.name) || {}).about || (a.family === "Dice" ? "Rolled with the dice" : "") : "";
      nav.append(pv, nm, nx);
      h.append(pw, ttl, nav, arpDice(false));
      if (a && a.family === "Dice") {
        const keep = btn("tm-arpkeep", ICON.heart + "<span>Keep</span>", "Keep this pattern in My arps (Mine)");
        keep.addEventListener("click", () => {
          const cur = arpOf();
          ARPS.kept.add({ name: cur.name, family: "Mine", about: "Kept from the dice (seed " + cur.seed + ").", order: cur.order, rate: cur.rate, octaves: cur.octaves, swing: cur.swing, gate: cur.gate, steps: cur.steps, seed: cur.seed, wild: cur.wild });
          cur.family = "Mine"; orig.arp = clone(cur);
          arpRolled = false; arpFam = "Mine";
          toast("Kept: " + cur.name, ["It's in Mine on the ARP page"], true);
          renderArp();
        });
        h.append(keep);
      }
    }

    // the step editor: bars = loudness (drag), click = rest on/off; rows under it for note, octave, hits, slide, chance
    const ARP_ROWS = [
      ["n", "NOTE", "Which held note: 1 = lowest (or first played), past the last it goes an octave up. → = the next one in the run. Click: next, Shift-click: back"],
      ["oct", "OCT", "Octave up or down. Click to change"],
      ["ratchet", "HITS", "Hits inside the step (ratchet). Click to change"],
      ["slide", "SLIDE", "Glides in from the note before (303 style). Click to switch"],
      ["prob", "CHANCE", "How often the step plays. Click to change"],
    ];
    function stepLabel(s, key) {
      if (s.n == null) return key === "n" ? "·" : "";
      switch (key) {
        case "n": return s.n === "next" ? "→" : String(s.n + 1);
        case "oct": return s.oct ? (s.oct > 0 ? "+" : "") + s.oct : "";
        case "ratchet": return s.ratchet > 1 ? s.ratchet + "x" : "";
        case "slide": return s.slide ? "↗" : "";
        case "prob": return s.prob != null && s.prob < 1 ? Math.round(s.prob * 100) + "" : "";
      }
      return "";
    }
    function cycleStep(s, key, back) {
      const d = back ? -1 : 1, wrap = (v, list) => list[(list.indexOf(v) + d + list.length) % list.length];
      if (s.n == null) { s.n = 0; delete s.gate; return; }
      if (key === "n") { const list = ["next", 0, 1, 2, 3, 4, 5, 6, 7]; s.n = wrap(list.indexOf(s.n) < 0 ? 0 : s.n, list); }
      else if (key === "oct") { s.oct = wrap(s.oct || 0, [0, 1, 2, -1]); if (!s.oct) delete s.oct; }
      else if (key === "ratchet") { s.ratchet = wrap(s.ratchet || 1, [1, 2, 3, 4]); if (s.ratchet === 1) delete s.ratchet; }
      else if (key === "slide") { if (s.slide) delete s.slide; else s.slide = true; }
      else if (key === "prob") { s.prob = wrap(s.prob == null ? 1 : s.prob, [1, 0.75, 0.5, 0.25]); if (s.prob === 1) delete s.prob; }
    }
    function drawArpSteps() {
      const a = arpOf(), box = arpStepsEl;
      if (!a || !box) return;
      box.textContent = "";
      box.classList.toggle("tm-off", !a.on);
      arpCols = [];
      const steps = a.steps || [];
      box.style.setProperty("--n", steps.length);
      const labels = el("div", "tm-arplabels");
      labels.append(el("div", "tm-arpbarlabel", "LOUD"));
      ARP_ROWS.forEach(([, l, tip]) => { const d = el("div", null, l); d.title = tip; labels.append(d); });
      const grid = el("div", "tm-arpgrid");
      steps.forEach((s, i) => {
        const col = el("div", "tm-arpcol");
        const bar = el("div", "tm-arpbar" + (s.n == null ? " tm-rest" : "") + (s.vel >= 0.95 ? " tm-acc" : ""));
        const fill = el("i");
        if (s.n != null) {
          fill.style.height = Math.round((s.vel == null ? 0.8 : s.vel) * 100) + "%";
          if (s.ratchet > 1) fill.style.setProperty("--r", s.ratchet);
          if (s.prob != null && s.prob < 1) fill.style.opacity = (0.35 + 0.65 * s.prob).toFixed(2);
          const g = Math.min(1, (s.gate == null ? 0.6 : s.gate) * (a.gate || 1));
          fill.style.width = Math.round(30 + 70 * g) + "%";
          if (s.oct) col.dataset.oct = s.oct > 0 ? "up" : "down";
        }
        bar.append(fill);
        bar.title = s.n == null ? "Rest: click to play a note here" : "Drag up/down for loudness, click for a rest. Gate " + Math.round((s.gate == null ? 0.6 : s.gate) * 100) + "%";
        bar.addEventListener("pointerdown", (e) => arpBarDrag(e, i, bar));
        col.append(bar);
        ARP_ROWS.forEach(([key]) => {
          const c = btn("tm-arpcell", null);
          c.textContent = stepLabel(s, key);
          c.addEventListener("click", (e) => { arpTouch((x) => cycleStep(x.steps[i], key, e.shiftKey)); });
          c.addEventListener("contextmenu", (e) => { e.preventDefault(); arpTouch((x) => cycleStep(x.steps[i], key, true)); });
          col.append(c);
        });
        if (i % 4 === 0) col.classList.add("tm-beat");
        grid.append(col);
        arpCols.push(col);
      });
      const lenBox = el("div", "tm-arplen");
      const minus = btn("tm-octbtn", "−", "One step shorter"), plus = btn("tm-octbtn", "+", "One step longer");
      minus.addEventListener("click", () => arpTouch((x) => { if (x.steps.length > 1) x.steps.pop(); }));
      plus.addEventListener("click", () => arpTouch((x) => { if (x.steps.length < 32) x.steps.push(clone(x.steps[x.steps.length % Math.max(1, x.steps.length - 1)] || { n: "next" })); }));
      lenBox.append(plus, el("div", "tm-octval", String(steps.length)), minus);
      lenBox.title = "Steps in the pattern";
      box.append(labels, grid, lenBox);
      showArpPos();
    }
    function arpBarDrag(e, i, bar) {
      if (e.button !== 0) return;
      e.preventDefault();
      const a = arpOf();
      if (!a) return;
      bar.setPointerCapture(e.pointerId);
      const r = bar.getBoundingClientRect(), y0 = e.clientY;
      let moved = false;
      const velAt = (y) => Math.round(clamp(1 - (y - r.top) / r.height, 0.05, 1) * 20) / 20;
      const mv = (ev) => {
        if (!moved && Math.abs(ev.clientY - y0) < 3) return;
        moved = true;
        const s = a.steps[i];
        if (s.n == null) { s.n = 0; delete s.gate; }
        s.vel = velAt(ev.clientY);
        orig.arp = clone(a); pushPreset();
        const f = bar.querySelector("i");
        bar.classList.remove("tm-rest");
        f.style.height = Math.round(s.vel * 100) + "%";
        bar.classList.toggle("tm-acc", s.vel >= 0.95);
      };
      const up = () => {
        bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up);
        if (!moved) arpTouch((x) => { const s = x.steps[i]; if (s.n == null) { x.steps[i] = { n: i > 0 && x.steps[i - 1].n != null ? x.steps[i - 1].n : 0 }; } else x.steps[i] = { n: null }; });
        else { flushPreset(); drawArpSteps(); }
      };
      bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up);
    }
    function showArpPos() {
      arpCols.forEach((c, i) => c.classList.toggle("tm-now", i === arpPos));
    }
    function arpSettings() {
      const box = el("div", "tm-arpset");
      // rate
      const rate = el("div", "tm-chips tm-arprates");
      ARPS.RATES.forEach(([r]) => {
        const c = btn("tm-modechip tm-arpchip", null, "Step length " + r + (r.endsWith("t") ? " (triplet)" : r.endsWith("d") ? " (dotted)" : ""));
        c.textContent = r;
        c.addEventListener("click", () => arpTouch((x) => { x.rate = r; }));
        bind(() => { const a = arpOf(); c.classList.toggle("tm-sel", !!a && a.rate === r); });
        rate.append(c);
      });
      // order + octaves
      const ord = el("select", "tm-select tm-arporder");
      ord.title = "How the held notes line up";
      ARPS.ORDERS.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; ord.append(o); });
      ord.addEventListener("change", () => arpTouch((x) => { x.order = ord.value; }));
      ord.addEventListener("keydown", (e) => e.stopPropagation());
      bind(() => { const a = arpOf(); if (a && ord.value !== (a.order || "up")) ord.value = a.order || "up"; });
      const oct = el("div", "tm-dzseg tm-arpoct");
      oct.title = "Octaves the run climbs (for → steps)";
      [1, 2, 3, 4].forEach((n) => {
        const b = btn("", String(n), n + (n > 1 ? " octaves" : " octave") + " for the run");
        b.addEventListener("click", () => arpTouch((x) => { x.octaves = n; }));
        bind(() => { const a = arpOf(); b.classList.toggle("tm-sel", !!a && (a.octaves || 1) === n); });
        oct.append(b);
      });
      const num = (label, key, lo, hi, def, tip) => {
        const w = el("label", "tm-arpnum");
        w.title = tip;
        const spec = { min: lo, max: hi, fmt: (v) => Math.round(v * 100) + "%" };
        w.append(el("span", null, label), dragNum(["arp", key], spec, () => { orig.arp = clone(full.arp); drawArpSteps(); }));
        w.addEventListener("dblclick", (e) => { if (e.target === w || e.target.tagName === "SPAN" && e.target.parentNode === w) arpTouch((x) => { x[key] = def; }); });
        return w;
      };
      const row = el("div", "tm-arprow");
      const octW = el("label", "tm-arpnum");
      octW.append(el("span", null, "OCT"), oct);
      row.append(ord, octW, num("GATE", "gate", 0.1, 2, 1, "How long every note rings (drag)"), num("SWING", "swing", 0, 1, 0, "Every second step comes later (drag)"));
      box.append(rate, row);
      return box;
    }
    function arpPic(p) {
      const pic = el("div", "tm-arppic");
      let steps = p.steps || [];
      if (steps.length && steps.every((s) => s.n === "next")) { const run = ARPS.runOf(p.order, p.octaves), top = Math.max(1, ...run); steps = run.map((n) => ({ n: (n * 7.5) / top, ratchet: steps[0].ratchet })); }
      steps.slice(0, 16).forEach((s) => {
        const c = el("i");
        if (s.n == null) c.className = "tm-rest";
        else {
          const n = s.n === "next" ? 1.5 : s.n;
          c.style.setProperty("--h", clamp(0.25 + (n + 3 * (s.oct || 0)) / 10, 0.12, 1).toFixed(2));
          if (s.ratchet > 1) c.className = "tm-rat";
        }
        pic.append(c);
      });
      return pic;
    }
    function arpLibrary() {
      const box = el("div", "tm-arplib");
      const tabs = el("div", "tm-chips tm-arpfams");
      ARP_FAMS.forEach((f) => {
        const n = f === "All" ? ARPS.PATTERNS.length : f === "Mine" ? ARPS.kept.get().length : ARPS.PATTERNS.filter((p) => p.family === f).length;
        const c = btn("tm-modechip" + (arpFam === f ? " tm-sel" : ""), null, f === "Mine" ? "Dice patterns you kept" : f + " patterns");
        c.innerHTML = `${f}<span class="tm-tcount">${n}</span>`;
        c.addEventListener("click", () => { arpFam = f; renderArp(); });
        tabs.append(c);
      });
      const grid = el("div", "tm-arpcards");
      const a = arpOf(), list = arpList();
      if (!list.length) grid.append(el("div", "tm-empty", arpFam === "Mine" ? "Roll the dice and press Keep: your patterns land here." : "Nothing here."));
      list.forEach((p) => {
        const card = btn("tm-arpcard" + (a && a.name === p.name ? " tm-sel" : ""), null, p.about || p.name);
        card.append(el("span", "tm-arpcn", p.name), arpPic(p), el("span", "tm-arpcr", (p.rate || "1/16") + (arpFam === "All" ? " · " + p.family : "")));
        card.addEventListener("click", () => pickArp(p));
        if (arpFam === "Mine") {
          const x = el("span", "tm-arpdel", "×");
          x.title = "Remove from Mine";
          x.addEventListener("click", (e) => { e.stopPropagation(); ARPS.kept.remove(p.name); renderArp(); });
          card.append(x);
        }
        grid.append(card);
      });
      box.append(tabs, grid);
      return box;
    }

    // ------------------------------------------------ DROP ZONE page (ui/toymachine-dropzone.js)
    const dropZonePage = window.ToyMachineDropZone ? window.ToyMachineDropZone.mount(pages.drop, {
      get: () => ({ full, orig }),
      push: pushPreset,
      flush: flushPreset,
      setPreset: (p) => { hasPreset = true; setPresetInternal(p); flushPreset(); },
      call, toast, audioCtx,
      Landscape, look: () => full.look,
      bpm: () => { const b = +call("getBpm"); return b > 20 && b < 400 ? b : 120; },
    }) : null;
    if (!dropZonePage) root.querySelector('.tm-railbtn[data-page="drop"]').remove();

    // ------------------------------------------------ TEXTURES page (ui/toymachine-textures.js, KILLTOY 333)
    const texturesPage = window.ToyMachineTextures && !window.KT2_TM_TEXTURES_OFF ? window.ToyMachineTextures.mount(pages.textures, {
      get: () => ({ full, orig }), push: pushPreset, flush: flushPreset, call, toast, audioCtx,
    }) : null;
    if (!texturesPage) root.querySelector('.tm-railbtn[data-page="textures"]').remove();

    // ------------------------------------------------ build / rebuild
    function rebuild() {
      bound = [];
      topBinds();
      renderPlay();
      renderEngine();
      renderFx();
      renderTexture();
      renderArp();
      if (dropZonePage) dropZonePage.render();
      if (texturesPage) { texturesPage.render(); if (!window.KT2LoadDrop) texturesPage.send(); }
      renderKb();
      refresh();
      queueLinks();
    }
    function topBinds() {
      bind(() => { window.setTickerText ? setTickerText($(".tm-presetname"), full.name || "Init") : ($(".tm-presetname").textContent = full.name || "Init"); });
      const box = $(".tm-out"), thumb = $(".tm-out-thumb");
      bind(() => { thumb.style.left = toN(OUT_LEVEL, full.out.level) * 100 + "%"; box.title = "Output " + fmt.db(full.out.level) + " (double-click for 0 dB)"; });
      bind(() => { root.style.setProperty("--tm-hue", full.look.hue); root.style.setProperty("--tm-hue2", full.look.hue2); });
      bind(() => { const r = root.querySelector('.tm-railbtn[data-page="arp"]'); if (r) r.classList.toggle("tm-live", arpOn()); });
    }

    function setPresetInternal(p) {
      orig = isObj(p) ? p : {};
      curId = null;
      const added = [addCorePoints(orig), dropStars(orig)].some(Boolean);
      full = applyMacros(withDefaults(orig));
      base = clone(full);
      if (added) flushPreset(); // the engine gets the new (silent) points too
      kbBase = clamp(homeOctave(full) + 12 * octOff, 12, 96);
      for (const n of [...held]) noteOff(n);
      compHeld.clear();
      rebuild();
    }

    // ------------------------------------------------ animation
    let raf = 0, lastFrame = 0, lastMeter = 0;
    function loop(ts) {
      raf = requestAnimationFrame(loop);
      if (closed || document.hidden || !root.isConnected) return;
      const dt = Math.min(0.1, (ts - (lastFrame || ts)) / 1000);
      if (ts - lastFrame < 32) return;
      lastFrame = ts;
      if (ts - lastMeter > 50) { lastMeter = ts; meter(); }
      if (page === "texture" && visible) { drawTexture(dt); return; }
      if (page === "drop" && visible) { if (dropZonePage) dropZonePage.draw(dt); return; }
      if (page !== "play" || !land || !visible) return;
      listen(dt);
      tickViews(dt);
      const m = full.macros.map((x) => x.value);
      const avg = m.length ? m.reduce((a, b) => a + b, 0) / m.length : 0.5;
      const force = {};
      const now = performance.now() / 1000;
      const pads = full.pads.map((pd, k) => {
        const [mx, my] = padXY(pd), [bx, by] = padBox(pd), u = bx * 2 - 1, v = 1 - by * 2;
        const isMacro = pd.kind === "macro";
        if (!isMacro) {
          const f = { x: mx, y: my, u, v };
          // the arp ring goes out once per note / arp step that really sounds, never on its own
          if (pd.kind === "arp") { f.rate = arpRate(mx); f.phase = f.rate < 0 ? 1 : clamp((now - snd.lastHit) * 2.5); }
          force[pd.kind] = f;
        }
        // a preset's own picture stays whole at rest: its points only bend it as they're turned up
        // (or dragged); the other looks keep the full swirl
        const pk = land.image ? 0.08 + 0.92 * ss(0.15, 1, Math.max(mx, my)) : 1;
        return { u, v, mx, my, fall: isMacro ? 7 - 3 * my : 9, swirl: (k % 2 ? -1 : 1) * ((isMacro ? 0.5 + 1.6 * mx : 0.35) * pk + (activePad === k ? dragEnergy * 1.5 : 0)), pinch: (isMacro ? 0.15 + 0.35 * my : 0.1) * pk };
      });
      const mp = pads.filter((p, k) => full.pads[k].kind === "macro");
      const p0 = mp[0] || { mx: 0.5, my: 0.5 }, p1 = mp[1] || p0;
      let bright = 0.82 + 0.38 * p0.my, hueShift = (p0.mx - 0.5) * 50;
      if (force.filter) bright *= Math.pow(2, (force.filter.x - 0.5) * 1.4);
      if (force.analog) hueShift += Math.sin(now * 0.35) * force.analog.x * 30 + force.analog.y * 8;
      if (force.clip) hueShift += 0;
      land.draw({
        pads,
        force,
        fxDirt: fxDirt(),
        morph: p0.mx,
        zoom: 1.15 + 0.7 * p1.my,
        turb: 0.45 + 0.9 * avg + 0.5 * p1.mx + dragEnergy * 0.4 + (force.clip ? force.clip.x * 0.6 : 0),
        hueShift,
        bright: clamp(bright, 0.3, 1.7),
        speed: dragEnergy * 3 + snd.act * (0.7 + (force.motion ? force.motion.y * 0.5 : 0)) + snd.hit * 0.6,
        audio: snd,
      }, dt);
      dragEnergy *= 0.94;
    }
    // how much the effects chain itself distorts, 0..1 each (the image looks follow it too)
    function fxDirt() {
      const o = { drive: clamp((full.filter.drive || 0) / 24), clip: 0, crush: 0 };
      for (const f of full.fx) {
        if (!f || f.on === false) continue;
        const mix = f.mix == null ? 1 : clamp(+f.mix || 0);
        if (f.type === "drive") o.drive = Math.max(o.drive, clamp((+f.amount || 0) / 30) * mix);
        else if (f.type === "clip") o.clip = Math.max(o.clip, clamp((+f.drive || 0) / 20));
        else if (f.type === "crush") o.crush = Math.max(o.crush, clamp(Math.max((16 - (+f.bits || 16)) / 12, Math.log(44100 / Math.max(500, +f.rate || 44100)) / Math.log(30))) * mix);
      }
      return o;
    }
    // Listening: the engine's meter (level, and in the playground 8 bands + 64 waveform points)
    // becomes act (how much is sounding, 0..1), hit (a decaying kick on every note / arp step)
    // and the band levels the landscape moves with.
    const snd = { act: 0, hit: 0, lastHit: -9, lvl: 0, slow: 0, low: 0, mid: 0, high: 0, wave: null, prev: null };
    function soundHit(amt) { snd.hit = Math.max(snd.hit, amt); snd.lastHit = performance.now() / 1000; }
    // Where the running dice have the points right now. The engine's own positions when the host
    // sends them (m.dice); otherwise worked out here the same way (smooth random steps paced by
    // the tempo), so the points wander even while nothing plays.
    const DICE_BEATS = [16, 8, 4, 2, 1, 0.5, 0.25];
    function diceNoise(beat, rate, seed, salt) {
      const ph = beat / rate + 0.15 * Math.sin(beat / rate * 0.37 + seed), k = Math.floor(ph), f = ph - k;
      const h = (n) => { const v = Math.sin(n * 12.9898 + seed * 78.233 + salt * 37.719) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
      return h(k) + (h(k + 1) - h(k)) * f * f * (3 - 2 * f);
    }
    function showDice() {
      const ds = {}, dice = orig.dice || {};
      let live = snd.dice && performance.now() - (snd.diceAt || 0) < 400 ? snd.dice : null;
      if (!live && Object.keys(dice).length) {
        const bpm = +call("getBpm") || 120, beat = performance.now() / 1000 * bpm / 60;
        live = [];
        for (const [key, d] of Object.entries(dice)) {
          if (!d || !(d.amt > 0)) continue;
          const i = +key.slice(1), rate = DICE_BEATS[Math.round(clamp(d.speed == null ? 0.5 : d.speed) * 6)], seed = i * 7.31 + (key[0] === "p" ? 3.3 : 0), off = (salt) => d.amt * 0.5 * diceNoise(beat, rate, seed, salt);
          if (key[0] === "m" && full.macros[i]) live.push(["m", i, clamp(full.macros[i].value + off(0))]);
          else if (key[0] === "p" && full.pads[i] && full.pads[i].kind !== "macro") {
            const q = full.pads[i].pos || [0, 0.5], kd = full.pads[i].kind;
            let x = clamp(q[0] + off(0)), y = clamp(q[1] + off(1));
            if (kd === "arp") x = q[0] < 0.1 ? q[0] : Math.max(0.1, x);   // as the engine host: the dice never turns a rhythm on or off
            if (kd === "gate") y = q[1] <= 0.001 ? q[1] : Math.max(0.002, y);
            live.push(["p", i, x, y]);
          }
          else if (SLIDER_DICE[key] != null) { const j = SLIDER_DICE[key]; live.push(["s", j, d.amt * 0.5 * diceNoise(beat, rate, SLIDER_DICE_SEED[j], 0) * 2 * SLIDER_DICE_SPAN[j]]); }
        }
      }
      if (live) for (const [t, i, x, y] of live) {
        if (t === "m") ds["macro." + i] = x;
        else if (t === "s") { const key = Object.keys(SLIDER_DICE).find((q) => SLIDER_DICE[q] === i); if (key) ds[key] = x; }
        else if (full.pads[i] && !full.pads[i].off) { ds[padParam(i, 0)] = x; ds[padParam(i, 1)] = y; }
      }
      const sig = Object.entries(ds).map(([k, v]) => k + (v * 400 | 0)).join();
      if (sig !== diceSig) { diceSig = sig; diceShow = ds; positionPads(); queueRefresh(); }
    }
    function listen(dt) {
      let m = null;
      try { m = typeof api.meter === "function" ? api.meter() : null; } catch (e) { m = null; }
      if (m && m !== snd.prev) {
        snd.prev = m;
        const pk = m.peak != null ? m.peak : Math.max(m.l || 0, m.r || 0);
        const lvl = clamp((20 * Math.log10(Math.max(1e-5, pk)) + 54) / 48);
        if (lvl > 0.2 && lvl > snd.slow + 0.1) soundHit(Math.min(1, 0.4 + (lvl - snd.slow) * 3));
        snd.slow += (lvl - snd.slow) * 0.3;
        snd.lvl = lvl;
        const b = Array.isArray(m.bands) && m.bands.length >= 8 ? m.bands : null, av = (i, j) => (b ? (b.slice(i, j).reduce((a, c) => a + c, 0) / (j - i)) : lvl * 0.7);
        snd.low += (av(0, 3) - snd.low) * 0.5; snd.mid += (av(3, 6) - snd.mid) * 0.5; snd.high += (av(6, 8) - snd.high) * 0.5;
        snd.wave = Array.isArray(m.wave) && m.wave.length >= 64 ? m.wave : null;
        snd.dice = Array.isArray(m.dice) ? m.dice : null;
        snd.diceAt = performance.now();
      }
      showDice();
      snd.act = Math.max(snd.lvl, snd.act * Math.exp(-dt / 0.4));
      if (snd.act < 0.01) snd.act = 0;
      snd.hit *= Math.exp(-dt * 6);
      root.classList.toggle("tm-quiet", snd.act < 0.03 && snd.hit < 0.03);
    }
    let visible = true;
    const io = typeof IntersectionObserver === "function" ? new IntersectionObserver((ents) => { visible = ents.some((e) => e.isIntersecting); }) : null;
    if (io) io.observe(root);
    function meter() {
      const ml = root.querySelector(".tm-ml"), mr = root.querySelector(".tm-mr");
      let v = null;
      try { v = typeof api.meter === "function" ? api.meter() : null; } catch (e) { v = null; }
      const tod = (x) => clamp((20 * Math.log10(Math.max(1e-5, x || 0)) + 48) / 54);
      ml.style.width = (v ? tod(v.l) * 100 : 0) + "%";
      const ap = v && typeof v.arp === "number" && arpOn() ? v.arp : -1;
      if (ap !== arpPos) { arpPos = ap; if (page === "arp") showArpPos(); }
      mr.style.width = (v ? tod(v.r) * 100 : 0) + "%";
    }

    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { sizeDisc(); refresh(); }) : null;
    function onWinResize() { sizeDisc(); refresh(); }
    window.addEventListener("resize", onWinResize);

    function close() {
      if (closed) return;
      closed = true;
      if (window.ToyMachinePacks) ToyMachinePacks.close();
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      window.removeEventListener("resize", onWinResize);
      for (const n of [...held]) noteOff(n);
      if (spTimer) flushPreset();
      root.remove();
      if (typeof opts.onClose === "function") { try { opts.onClose(); } catch (e) { console.warn(e); } }
    }

    // CREATE SOUND
    if (CREATE_OK) create = ToyMachineCreate.mount({
      root, call, toast, audioCtx,
      search: searchLoose,
      loadPreset: async (e) => (typeof opts.loadPreset === "function" ? opts.loadPreset(e) : null),
      setPreset: (p) => { hasPreset = true; macrosOpen = true; setPresetInternal(p); flushPreset(); },   // the word tools open
      getPreset: () => orig,
      // LIVE TEXTURES (12 Nov): the nest is kept per synth window; dropped sounds change the sound that's on
      key: opts.createKey || opts.title || "tm",
      setLive: (p) => { hasPreset = true; const keepId = curId; setPresetInternal(p); curId = keepId; flushPreset(); },
      setParam: (path, value) => set(path, value),
      toPresets: () => { if (typeof opts.onModeRequest === "function") opts.onModeRequest("presets"); else setMode("presets"); },
      relayout: () => requestAnimationFrame(() => { sizeDisc(); refresh(); }),
      // word balls change the sound that's on now (a preset or a grown one): no new preset, live
      addBall: (word) => {
        const P = window.ToyMachinePrompt;
        if (!P || !P.addWord) return null;
        const p = clone(orig), r = P.addWord(p, word);
        hasPreset = true; macrosOpen = true;
        const keepId = curId;
        setPresetInternal(p); curId = keepId; flushPreset();
        newPadIdx = -1;
        return r;
      },
      removeBall: (id) => { const P = window.ToyMachinePrompt; if (!P || !P.removeBall) return; const p = clone(orig); P.removeBall(p, id); const keepId = curId; setPresetInternal(p); curId = keepId; flushPreset(); },
      bpm: () => { const b = +call("getBpm"); return b > 20 && b < 400 ? b : 120; },
      // the real engine, offline (playground/toy-machine.js), for levelling and the ears
      renderer: async () => {
        if (typeof opts.renderer === "function") { try { return await opts.renderer(); } catch (e) { return null; } }
        if (!window.ToyMachine || typeof window.ToyMachine.load !== "function") return null;
        try { return await window.ToyMachine.load(audioCtx(), window.TM_WASM_URL || "toy-machine.wasm"); } catch (e) { return null; }
      },
      saved: (e) => { index = withMine(index); curId = e.id; if (browser) browser.sync(); refresh(); },
    });

    // initial build
    rebuild();
    showPage("play");
    // the drawer comes back open if you left it open
    try { if (JSON.parse(localStorage.getItem("tm-drawer-state") || "{}").open) openBrowser(true); } catch (e) { /* private window */ }
    if (ro) { ro.observe(root); }
    requestAnimationFrame(() => { sizeDisc(); refresh(); });
    raf = requestAnimationFrame(loop);
    // when the stage is laid out, size the disc again
    if (ro) ro.observe(pages.play);

    return {
      element: root,
      setPreset(p) { hasPreset = isObj(p); setPresetInternal(p); },
      setPresetIndex(list) { index = withMine(list); if (browser) browser.sync(); refresh(); },
      setMode,
      /** { param: { v: 0..1, text? } } from the host's automation lines; {} = back to the preset's own. */
      showAutomation(map) {
        const next = map || {}, sig = JSON.stringify(next);
        if (sig === JSON.stringify(autoShow)) return;
        autoShow = next;
        positionPads(); queueRefresh();
      },
      // the song's automation lines changed (one added, cleared): the A marks follow
      autoChanged() { queueRefresh(); },
      showPage,
      close,
      get preset() { return orig; },
    };
  }

  const DEF_FULL = withDefaults({});

  // Landscape: the circle's picture on any canvas (the INST card's live picture box, ui/kt2-instlive.js)
  window.ToyMachineUI = { open, withDefaults, applyMacros, resolveParam, Landscape, version: 1 };
})();
