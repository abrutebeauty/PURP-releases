// TOY MACHINE V3 window (27 Nov): the real synth screen. Pages OSC, FILTER, ENV, LFO, FX, MACROS + the preset list + a keyboard.
// Every knob sends one preset key to the engine (toyMachineSetParam in playground.js -> tm_set_param in the wasm), so it
// sounds at once and is saved in the lane's preset (undo works like the other synths' knobs).
// Opens at once: the panel and Init Saw are there before the preset packs and the wave pictures load.
// window.KT2_TM3_UI_OLD = true shows the old window (preset list + small keyboard, in tm3-web.js).
// Knob names, ranges and choices come from docs/toymachine3/specs/params.md. ASCII only.
(function () {
  if (window.KT2_TM3_OFF) return;
  const BACK = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='1020' height='760' viewBox='0 0 1020 760'><defs><filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='9'/></filter><filter id='b2'><feGaussianBlur stdDeviation='2.2'/></filter><pattern id='d' width='14' height='14' patternUnits='userSpaceOnUse'><circle cx='7' cy='7' r='3.4' fill='none' stroke='#15141a' stroke-width='1.4'/><circle cx='7' cy='7' r='1.2' fill='#15141a'/></pattern></defs><rect width='1020' height='760' fill='#a9aca7'/><g filter='url(#b)' fill='#8b8e89' opacity='.6'><rect x='-30' y='80' width='170' height='230'/><rect x='820' y='20' width='230' height='150'/><circle cx='930' cy='420' r='90'/><rect x='300' y='560' width='360' height='60'/><rect x='40' y='600' width='120' height='120'/></g><g filter='url(#b2)' opacity='.5'><rect x='640' y='150' width='330' height='220' fill='url(#d)'/><rect x='20' y='380' width='220' height='170' fill='url(#d)'/><circle cx='520' cy='330' r='120' fill='url(#d)'/></g><g filter='url(#b)' fill='none' stroke='#15141a' stroke-width='3' opacity='.4'><rect x='700' y='440' width='240' height='140'/><path d='M60 60H340V150H60Z'/><circle cx='170' cy='500' r='60'/></g><g filter='url(#b2)' fill='#15141a' opacity='.45' font-family='monospace' font-weight='700' font-size='40'><text x='590' y='700' transform='rotate(-90 590 700)'>GRAPHIC TOY TERMINAL</text><text x='40' y='740'>[ VISUALS 003 ]</text></g></svg>");
  const CSS = `
.tm3u { --ink: #15141a; --mid: #3d403c; --milk: #a9aca7; --acid: #E4FF3A; --pur: #8b6cf6; position: relative; display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 14px; background: var(--milk) url("${BACK}") center / cover no-repeat; color: var(--ink); font: 500 11px/1.35 "JetBrains Mono", "Space Mono", ui-monospace, Menlo, monospace; min-height: 100%; box-sizing: border-box; outline: none; user-select: none; outline: 1px solid var(--ink); outline-offset: -5px; }
.tm-host > .tm3u { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(1040px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
.tm3u .hd { display: flex; align-items: stretch; gap: 6px; padding: 6px 6px 0; }
.tm3u .logo { font: 700 11px/1 "JetBrains Mono", monospace; letter-spacing: 0.06em; white-space: nowrap; display: flex; align-items: center; padding: 0 8px; border: 1px solid var(--ink); background: rgba(190,193,188,0.4); }
.tm3u .logo i { font-style: normal; background: var(--acid); padding: 1px 4px; margin-left: 5px; }
.tm3u .nm { flex: 1; min-width: 0; font: 700 26px/1 "Playfair Display", "Bodoni 72", Georgia, "Times New Roman", serif; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 4px; display: flex; align-items: center; gap: 8px; }
.tm3u .nm .dot { display: none; }
.tm3u .b { appearance: none; border: 1px solid var(--ink); border-radius: 0; background: rgba(190,193,188,0.4); color: var(--ink); font: 700 10px "JetBrains Mono", monospace; letter-spacing: 0.08em; padding: 0 10px; cursor: pointer; text-transform: uppercase; white-space: nowrap; }
.tm3u .b::before { content: "[ "; } .tm3u .b::after { content: " ]"; }
.tm3u .b.on { background: var(--ink); color: var(--milk); }
.tm3u .x { width: 28px; padding: 0; text-align: center; } .tm3u .x::before, .tm3u .x::after { content: ""; }
.tm3u .tabs { display: flex; gap: 4px; padding: 0 6px; }
.tm3u .tab { appearance: none; border: 1px solid var(--ink); border-radius: 0; background: rgba(190,193,188,0.35); color: var(--ink); font: 700 10px "JetBrains Mono", monospace; letter-spacing: 0.12em; padding: 7px 16px; cursor: pointer; display: flex; align-items: center; gap: 7px; }
.tm3u .tab.on { background: var(--ink); color: var(--milk); }
.tm3u .tab.on::before { content: ""; width: 6px; height: 6px; background: var(--acid); }
.tm3u .list { position: absolute; z-index: 30; left: 12px; right: 12px; top: 56px; display: flex; flex-direction: column; max-height: 260px; overflow: auto; background: #b9bcb6; border: 1px solid var(--ink); outline: 1px solid var(--ink); outline-offset: -4px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); padding: 4px 0; }
.tm3u .list[hidden] { display: none; }
.tm3u .list .it { appearance: none; border: 0; background: none; color: var(--ink); text-align: left; font: 600 10px "JetBrains Mono", monospace; padding: 5px 10px; cursor: pointer; display: flex; gap: 10px; text-transform: uppercase; }
.tm3u .list .it small { color: var(--mid); font-weight: 500; margin-left: auto; }
.tm3u .list .it.on { background: var(--ink); color: var(--milk); }
.tm3u .list .it.on small { color: var(--acid); }
.tm3u .body { display: grid; gap: 8px; min-height: 0; flex: 1 1 auto; overflow-y: auto; align-content: start; padding: 0 6px; }
.tm3u .body.g4 { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
.tm3u .body.g3 { grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); }
.tm3u .body.g2 { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); }
.tm3u .sp { grid-column: 1 / -1; display: flex; gap: 8px; } .tm3u .sp > * { flex: 1 1 0; min-width: 0; }
.tm3u .pn { background: rgba(190,193,188,0.38); border: 1px solid var(--ink); outline: 1px solid var(--ink); outline-offset: -4px; padding: 8px 9px 9px; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.tm3u .pn.off .ks, .tm3u .pn.off canvas { opacity: 0.4; }
.tm3u .ph { display: flex; align-items: center; gap: 6px; min-height: 16px; }
.tm3u .ph .hat { flex: 1; height: 8px; background: repeating-linear-gradient(0deg, var(--ink) 0 1px, transparent 1px 3px); }
.tm3u .pt { font: 700 10px "JetBrains Mono", monospace; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
.tm3u .tg { appearance: none; border: 1px solid var(--ink); border-radius: 0; background: rgba(190,193,188,0.7); width: 16px; height: 16px; cursor: pointer; position: relative; padding: 0; flex: none; }
.tm3u .tg.on { background: var(--acid); }
.tm3u .tg.on::after { content: "X"; position: absolute; inset: 0; font: 700 10px/14px "JetBrains Mono", monospace; text-align: center; color: var(--ink); }
.tm3u .pc { display: flex; gap: 8px; min-width: 0; flex-wrap: wrap; }
.tm3u canvas.pic { background: rgba(255,255,255,0.45); border: 1px solid var(--ink); flex: none; display: block; }
.tm3u .ks { display: flex; flex-wrap: wrap; gap: 6px 2px; align-items: flex-start; align-content: flex-start; min-width: 0; }
.tm3u .kn { width: 54px; display: flex; flex-direction: column; align-items: center; gap: 0; cursor: ns-resize; touch-action: none; }
.tm3u .kn svg { display: block; }
.tm3u .kn .l { font: 700 8px "JetBrains Mono", monospace; letter-spacing: 0.04em; color: var(--mid); text-transform: uppercase; width: 54px; text-align: center; white-space: nowrap; overflow: hidden; }
.tm3u .kn .v { font: 700 9px "JetBrains Mono", monospace; color: var(--ink); width: 54px; text-align: center; white-space: nowrap; overflow: hidden; height: 12px; }
.tm3u .kn.big svg { width: 84px; height: 84px; }
.tm3u .kn.big, .tm3u .kn.big .l, .tm3u .kn.big .v { width: 110px; }
.tm3u .kn.big .l { font-size: 11px; } .tm3u .kn.big .v { font-size: 12px; }
.tm3u .ch { display: flex; flex-direction: column; gap: 1px; width: 100%; max-width: 150px; }
.tm3u .ch .l { font: 700 8px "JetBrains Mono", monospace; letter-spacing: 0.04em; color: var(--mid); text-transform: uppercase; }
.tm3u select { appearance: none; -webkit-appearance: none; border: 1px solid var(--ink); border-radius: 0; background: rgba(190,193,188,0.6) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0h8L4 5z' fill='#15141a'/%3E%3C/svg%3E") no-repeat right 6px center; color: var(--ink); font: 700 9px "JetBrains Mono", monospace; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 18px 4px 6px; cursor: pointer; width: 100%; }
.tm3u .mc { display: flex; gap: 8px; flex-wrap: wrap; grid-column: 1 / -1; }
.tm3u .mp { flex: 1 1 200px; background: rgba(190,193,188,0.38); border: 1px solid var(--ink); outline: 1px solid var(--ink); outline-offset: -4px; padding: 14px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
.tm3u .mp .dest { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; min-height: 18px; }
.tm3u .mp .dest span { border: 1px dashed var(--ink); color: var(--ink); font: 600 8px "JetBrains Mono", monospace; letter-spacing: 0.04em; padding: 2px 4px; text-transform: uppercase; }
.tm3u .foot { position: sticky; bottom: 0; z-index: 5; display: flex; flex-direction: column; gap: 5px; padding: 6px 0 0; background: linear-gradient(#a9aca700, #a9aca7 12px); margin-top: auto; }
.tm3u .st { display: flex; align-items: center; gap: 14px; padding: 0 6px; font: 700 9px "JetBrains Mono", monospace; min-height: 16px; }
.tm3u .st .sc i { font-style: normal; color: var(--mid); margin-right: 5px; } .tm3u .st .sc b { font-weight: 700; }
.tm3u .st .rule { flex: 1; height: 7px; background: radial-gradient(circle, var(--ink) 1.3px, transparent 1.6px) 0 50% / 8px 7px repeat-x; border-right: 40px solid transparent; position: relative; }
.tm3u .st .rule::after { content: ""; position: absolute; left: 0; right: 0; top: 3px; height: 1px; background: var(--ink); opacity: 0.5; }
.tm3u .ph::before { content: ""; width: 9px; height: 9px; flex: none; background: radial-gradient(circle, var(--ink) 1.1px, transparent 1.4px) 0 0 / 3px 3px; }
.tm3u .chp { display: flex; align-items: center; gap: 5px; font: 700 8px "JetBrains Mono", monospace; letter-spacing: 0.04em; margin-right: 8px; }
.tm3u .kb { position: relative; height: 54px; display: flex; touch-action: none; margin: 0 6px; }
.tm3u .kb .w { flex: 1; background: rgba(190,193,188,0.7); border: 1px solid var(--ink); border-left-width: 0; cursor: pointer; }
.tm3u .kb .w:first-child { border-left-width: 1px; }
.tm3u .kb .w.on, .tm3u .kb .k.on { background: var(--acid); }
.tm3u .kb .k { position: absolute; top: 0; height: 60%; background: var(--ink); cursor: pointer; z-index: 1; }
`;
  const style = () => { if (document.getElementById("tm3u-css")) return; const s = document.createElement("style"); s.id = "tm3u-css"; s.textContent = CSS; document.head.append(s); };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const SVGNS = "http://www.w3.org/2000/svg";

  // ---------- value text ----------
  const TEMPO = ["FREEZE", "32/1", "16/1", "8/1", "4/1", "2/1", "1/1", "1/2", "1/4", "1/8", "1/16", "1/32", "1/64"];
  const SYNC = ["SECONDS", "TEMPO", "DOTTED", "TRIPLET", "KEYTRACK"];
  const MODEL = ["ANALOG", "DIRTY", "LADDER", "DIGITAL", "DIODE", "FORMANT", "COMB", "PHASER"];
  const STYLE = ["12 DB", "24 DB", "NOTCH BLEND", "NOTCH SPREAD", "B/P/N"];
  const WARP = ["NONE", "SYNC", "FORMANT", "QUANTIZE", "BEND", "SQUEEZE", "PULSE", "FM A", "FM B", "FM SAMPLE", "RM A", "RM B", "RM SAMPLE"];
  const MORPH = ["NONE", "VOCODE", "FORMANT SCALE", "HARMONIC STRETCH", "INHARMONIC", "SMEAR", "RANDOM AMPS", "LOW PASS", "HIGH PASS", "PHASE DISPERSE", "SHEPARD", "TIME SKEW"];
  const LFOMODE = ["TRIGGER", "SYNC", "ENVELOPE", "SUSTAIN ENV", "LOOP POINT", "LOOP HOLD"];
  const DISTT = ["SOFT CLIP", "HARD CLIP", "LINEAR FOLD", "SINE FOLD", "BIT CRUSH", "DOWN SAMPLE"];
  const DELAYSTYLE = ["MONO", "STEREO", "PING PONG", "MID PING PONG"];
  const COMPB = ["MULTIBAND", "LOW BAND", "HIGH BAND", "SINGLE BAND"];
  const pct = (v) => Math.round(v * 100) + "%";
  const int = (v) => String(Math.round(v));
  const hz = (m) => { const f = 440 * Math.pow(2, (m - 69) / 12); return f >= 1000 ? (f / 1000).toFixed(1) + "K" : Math.round(f) + "HZ"; };
  const secs = (s) => (s < 0.995 ? Math.round(s * 1000) + "MS" : s.toFixed(s < 10 ? 2 : 1) + "S");
  const sgn = (v, d) => (v > 0 ? "+" : "") + v.toFixed(d == null ? 1 : d);
  const freqSecs = (x) => { const f = Math.pow(2, x); return f >= 1 ? f.toFixed(f < 10 ? 2 : 1) + "HZ" : (1 / f).toFixed(1) + "S"; };

  // ---------- knob tables: [key, label, min, max, default, text(value), step] ----------
  const K = (key, label, min, max, def, fmt, step) => ({ key, label, min, max, def, fmt: fmt || ((v) => v.toFixed(2)), step });
  const C = (key, label, names, def) => ({ key, label, min: 0, max: names.length - 1, def: def || 0, names, choice: true });
  const T = (key, def) => ({ key, def: def || 0, toggle: true });
  const DEF = {}, RNG = {};   // key -> default, for every key the window shows
  const reg = (c) => { DEF[c.key] = c.def; if (c.min != null) RNG[c.key] = [c.min, c.max, c.step || 0]; return c; };
  const oscKnobs = (n) => {
    const p = "osc_" + n + "_";
    return { on: reg(T(p + "on", n === 1 ? 1 : 0)), ks: [
      K(p + "level", "LEVEL", 0, 1, 0.7071, (v) => pct(v * v)), K(p + "pan", "PAN", -1, 1, 0, (v) => (Math.abs(v) < 0.005 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100))),
      K(p + "transpose", "SEMI", -48, 48, 0, (v) => sgn(Math.round(v), 0), 1), K(p + "tune", "TUNE", -1, 1, 0, (v) => sgn(v * 100, 0)),
      K(p + "unison_voices", "UNISON", 1, 16, 1, int, 1), K(p + "unison_detune", "DETUNE", 0, 10, 4.472, (v) => (v * v / 10).toFixed(1)),
      K(p + "unison_blend", "BLEND", 0, 1, 0.8, pct), K(p + "wave_frame", "WAVE POS", 0, 256, 0, int),
      K(p + "distortion_amount", "WARP", 0, 1, 0.5, pct), K(p + "spectral_morph_amount", "MORPH", 0, 1, 0.5, pct),
      K(p + "stereo_spread", "SPREAD", 0, 1, 1, pct), K(p + "random_phase", "RAND PH", 0, 1, 1, pct)].map(reg),
      cs: [C(p + "distortion_type", "WARP TYPE", WARP), C(p + "spectral_morph_type", "MORPH TYPE", MORPH)].map(reg) };
  };
  const filtKnobs = (p) => ({ on: reg(T(p + "on", 0)), cs: [C(p + "model", "MODEL", MODEL), C(p + "style", "STYLE", STYLE)].map(reg), ks: [
    K(p + "cutoff", "CUTOFF", 8, 136, 60, hz), K(p + "resonance", "RESO", 0, 1, 0.5, pct), K(p + "drive", "DRIVE", 0, 20, 0, (v) => v.toFixed(1) + "DB"),
    K(p + "mix", "MIX", 0, 1, 1, pct), K(p + "keytrack", "KEY TRK", -1, 1, 0, (v) => sgn(v * 100, 0) + "%"), K(p + "blend", "BLEND", 0, 2, 0, (v) => v.toFixed(2))].map(reg) });
  const envKnobs = (n) => {
    const p = "env_" + n + "_", t4 = (v) => secs(v * v * v * v);
    return { ks: [K(p + "delay", "DELAY", 0, 1.4142, 0, t4), K(p + "attack", "ATTACK", 0, 2.3784, 0.1495, t4), K(p + "hold", "HOLD", 0, 1.4142, 0, t4), K(p + "decay", "DECAY", 0, 2.3784, 1, t4),
      K(p + "sustain", "SUSTAIN", 0, 1, 1, pct), K(p + "release", "RELEASE", 0, 2.3784, 0.5476, t4),
      K(p + "attack_power", "A CURVE", -20, 20, 0, (v) => sgn(v, 1)), K(p + "decay_power", "D CURVE", -20, 20, -2, (v) => sgn(v, 1)), K(p + "release_power", "R CURVE", -20, 20, -2, (v) => sgn(v, 1))].map(reg) };
  };
  const lfoKnobs = (n) => {
    const p = "lfo_" + n + "_";
    return { cs: [C(p + "sync", "SYNC", SYNC, 1), C(p + "tempo", "TEMPO", TEMPO, 7), C(p + "sync_type", "MODE", LFOMODE)].map(reg), ks: [
      K(p + "frequency", "RATE", -7, 9, 1, freqSecs), K(p + "phase", "PHASE", 0, 1, 0, (v) => Math.round(v * 360) + "\u00b0"), K(p + "fade_time", "FADE IN", 0, 8, 0, (v) => v.toFixed(2) + "S"),
      K(p + "delay_time", "DELAY", 0, 4, 0, (v) => v.toFixed(2) + "S"), K(p + "stereo", "STEREO", -0.5, 0.5, 0, (v) => sgn(v * 200, 0) + "%")].map(reg) };
  };
  const FX = [
    ["DISTORTION", "distortion_on", [C("distortion_type", "TYPE", DISTT)], [K("distortion_drive", "DRIVE", -30, 30, 0, (v) => sgn(v, 1) + "DB"), K("distortion_mix", "MIX", 0, 1, 1, pct), K("distortion_filter_cutoff", "FILTER", 8, 136, 80, hz)]],
    ["CHORUS", "chorus_on", [], [K("chorus_dry_wet", "MIX", 0, 1, 0.5, pct), K("chorus_frequency", "RATE", -6, 3, -3, freqSecs), K("chorus_mod_depth", "DEPTH", 0, 1, 0.5, pct), K("chorus_feedback", "FEEDBACK", -0.95, 0.95, 0.4, (v) => sgn(v * 100, 0) + "%"), K("chorus_voices", "VOICES", 1, 4, 4, int, 1)]],
    ["FLANGER", "flanger_on", [], [K("flanger_dry_wet", "MIX", 0, 0.5, 0.5, (v) => pct(v * 2)), K("flanger_frequency", "RATE", -5, 2, 2, freqSecs), K("flanger_mod_depth", "DEPTH", 0, 1, 0.5, pct), K("flanger_feedback", "FEEDBACK", -1, 1, 0.5, (v) => sgn(v * 100, 0) + "%"), K("flanger_center", "CENTER", 8, 136, 64, hz)]],
    ["PHASER", "phaser_on", [], [K("phaser_dry_wet", "MIX", 0, 1, 1, pct), K("phaser_frequency", "RATE", -5, 2, -3, freqSecs), K("phaser_mod_depth", "DEPTH", 0, 48, 24, (v) => v.toFixed(0)), K("phaser_feedback", "FEEDBACK", 0, 1, 0.5, pct), K("phaser_center", "CENTER", 8, 136, 80, hz)]],
    ["DELAY", "delay_on", [C("delay_style", "STYLE", DELAYSTYLE)], [K("delay_dry_wet", "MIX", 0, 1, 0.3334, pct), K("delay_feedback", "FEEDBACK", -1, 1, 0.5, (v) => sgn(v * 100, 0) + "%"), K("delay_frequency", "TIME", -2, 9, 2, freqSecs), K("delay_filter_cutoff", "FILTER", 8, 136, 60, hz)]],
    ["REVERB", "reverb_on", [], [K("reverb_dry_wet", "MIX", 0, 1, 0.25, pct), K("reverb_decay_time", "DECAY", -6, 6, 0, (v) => secs(Math.pow(2, v))), K("reverb_size", "SIZE", 0, 1, 0.5, pct), K("reverb_delay", "PRE", 0, 0.3, 0, (v) => secs(v)), K("reverb_high_shelf_gain", "HI CUT", -6, 0, -1, (v) => v.toFixed(1) + "DB")]],
    ["COMPRESSOR", "compressor_on", [C("compressor_enabled_bands", "BANDS", COMPB)], [K("compressor_mix", "MIX", 0, 1, 1, pct), K("compressor_attack", "ATTACK", 0, 1, 0.5, pct), K("compressor_release", "RELEASE", 0, 1, 0.5, pct), K("compressor_band_gain", "GAIN", -30, 30, 11.7, (v) => sgn(v, 1) + "DB")]],
    ["EQ", "eq_on", [], [K("eq_low_gain", "LOW", -15, 15, 0, (v) => sgn(v, 1) + "DB"), K("eq_band_gain", "MID", -15, 15, 0, (v) => sgn(v, 1) + "DB"), K("eq_high_gain", "HIGH", -15, 15, 0, (v) => sgn(v, 1) + "DB"), K("eq_band_cutoff", "MID FREQ", 8, 136, 80, hz)]],
    ["FX FILTER", "filter_fx_on", [C("filter_fx_model", "MODEL", MODEL)], [K("filter_fx_cutoff", "CUTOFF", 8, 136, 60, hz), K("filter_fx_resonance", "RESO", 0, 1, 0.5, pct), K("filter_fx_drive", "DRIVE", 0, 20, 0, (v) => v.toFixed(1) + "DB"), K("filter_fx_mix", "MIX", 0, 1, 1, pct)]],
  ];
  for (const [, on, cs, ks] of FX) { reg(T(on, 0)); cs.forEach(reg); ks.forEach(reg); }
  DEF.sample_loop = 1; DEF.sample_keytrack = 0; DEF.sample_bounce = 0;
  const SAMPLE = { on: reg(T("sample_on", 0)), ks: [K("sample_level", "LEVEL", 0, 1, 0.7071, (v) => pct(v * v)), K("sample_pan", "PAN", -1, 1, 0, (v) => sgn(v * 100, 0)), K("sample_transpose", "SEMI", -48, 48, 0, (v) => sgn(Math.round(v), 0), 1), K("sample_tune", "TUNE", -1, 1, 0, (v) => sgn(v * 100, 0))].map(reg) };
  const OUT = [K("polyphony", "VOICES", 1, 32, 8, int, 1), K("voice_transpose", "SEMI", -48, 48, 0, (v) => sgn(Math.round(v), 0), 1), K("voice_tune", "TUNE", -1, 1, 0, (v) => sgn(v * 100, 0)), K("portamento_time", "GLIDE", -10, 4, -10, (v) => (v <= -9.9 ? "OFF" : secs(Math.pow(2, v)))), K("pitch_bend_range", "BEND", 0, 48, 2, int, 1)].map(reg);
  for (let i = 1; i <= 4; i++) reg(K("macro_control_" + i, "", 0, 1, 0));
  const PAGES = ["OSC", "FILTER", "ENV", "LFO", "FX", "MACROS"];

  // ---------- pictures ----------
  const shape = (p, q) => (Math.abs(q) < 0.005 ? p : (Math.exp(q * p) - 1) / (Math.exp(q) - 1));
  function sizeCanvas(cv, w, h) { const r = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); cv.width = w * r; cv.height = h * r; cv.style.width = w + "px"; cv.style.height = h + "px"; const g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, w, h); return g; }
  // ---------- the window ----------
  async function open(p, into, wanted = () => true) {
    const pid = p.id;
    const got = await run("toyMachineGetPreset", { pluginId: pid });
    if (!got || got.error || !wanted()) return;
    if (typeof closeToyMachine === "function") closeToyMachine();
    try { const D = window.purpPlaygroundDebug; if (D && D.ctx) window.TM3Web.load(D.ctx); } catch (e) { /* the engine loads on first sound instead */ }   // start the wasm download now
    style();
    const host = el("div", into ? "iw-tm" : "tm-host");
    if (!into) host.addEventListener("mousedown", (e) => { if (e.target === host) closeToyMachine(); });
    (into || document.body).append(host);
    const root = el("div", "tm3u"); root.tabIndex = 0; host.append(root);
    let preset = got.preset && window.TM3Web.isTm3(got.preset) ? got.preset : window.TM3Web.preset(window.TM3Web.DEFAULT);
    let page = "OSC", step = 0, closed = false;
    try { const s = sessionStorage.getItem("tm3u.page"); if (s && PAGES.includes(s)) page = s; } catch (e) { /* no storage */ }
    const S = () => (preset.data.settings || (preset.data.settings = {}));
    const val = (key) => { const v = S()[key]; return typeof v === "number" ? v : DEF[key] != null ? DEF[key] : 0; };
    const pending = new Map(); let raf = 0;
    const flush = () => { raf = 0; for (const [k, v] of pending) run("toyMachineSetParam", { pluginId: pid, key: k, value: v, step: "tm3k" + step + ":" + k }); pending.clear(); };
    const send = (key, v) => { S()[key] = v; pending.set(key, v); if (!raf) raf = requestAnimationFrame(flush); };

    // header
    const hd = el("div", "hd"), logo = el("div", "logo"); logo.innerHTML = "TOY MACHINE <i>V3</i>";
    const nm = el("div", "nm"); const nmDot = el("span", "dot"), nmTxt = el("span", null, ""); nm.append(nmDot, nmTxt);
    const bPrev = el("button", "b", "Prev"), bNext = el("button", "b", "Next"), bInit = el("button", "b", window.TM3Web.DEFAULT), bList = el("button", "b", "Presets");
    const x = el("button", "b x", "X"); x.setAttribute("aria-label", "Close");
    x.onclick = () => (into ? typeof tmWin !== "undefined" && tmWin && tmWin.pid === pid && closeLaneWindow() : closeToyMachine());
    hd.append(logo, nm, bPrev, bNext, bInit, bList, x);
    const lst = el("div", "list"); lst.hidden = true;
    const tabs = el("div", "tabs"), body = el("div", "body");
    const kb = el("div", "kb");
    const foot = el("div", "foot"), st = el("div", "st");
    foot.append(st, kb);
    root.append(hd, lst, tabs, body, foot);
    const statusUp = () => {
      st.textContent = "";
      const cell = (a, b) => { const c = el("span", "sc"); c.append(el("i", null, "[ " + a + " ]"), el("b", null, b)); return c; };
      const gl = val("portamento_time");
      st.append(cell("1X", "OSC " + [1, 2, 3].filter((n) => val("osc_" + n + "_on") >= 0.5).length), cell("POLY", String(Math.round(val("polyphony")))), cell("GLIDE", gl <= -9.9 ? "OFF" : secs(Math.pow(2, gl))), cell("BEND", "+/-" + Math.round(val("pitch_bend_range"))), cell(".", "V3 16BIT"));
      st.append(el("span", "rule"));
    };

    // presets (load after the window is up)
    let entries = [];
    const showName = () => { nmTxt.textContent = preset.name || window.TM3Web.DEFAULT; lst.querySelectorAll(".it").forEach((b) => b.classList.toggle("on", b.dataset.name === preset.name)); };
    const render = () => { if (closed) return; buildPage(); };
    const setP = async (np) => { preset = np; wcache = {}; showName(); render(); await run("toyMachineSetPreset", { pluginId: pid, preset: np }); };
    const setE = (e) => window.TM3Web.fill(e).then((f) => { if (f.data && wanted()) return setP({ engine: "tm3", name: f.name, data: copy(f.data) }); });
    const idx = () => entries.findIndex((e) => e.name === preset.name);
    const pick = (i) => { if (entries.length) setE(entries[(i + entries.length) % entries.length]); };
    bPrev.onclick = () => pick(idx() - 1); bNext.onclick = () => pick(idx() + 1); bInit.onclick = () => setP(window.TM3Web.preset(window.TM3Web.DEFAULT));
    bList.onclick = () => { lst.hidden = !lst.hidden; bList.classList.toggle("on", !lst.hidden); };
    showName();
    setTimeout(() => window.TM3Web.presets().then((l) => {
      if (closed || !wanted()) return;
      entries = l;
      const fr = document.createDocumentFragment();
      for (const e of l) { const b = el("button", "it", e.name); b.dataset.name = e.name; b.append(el("small", null, e.group || "")); b.onclick = () => { lst.hidden = true; bList.classList.remove("on"); setE(e); }; fr.append(b); }
      lst.append(fr); showName();
    }), 0);

    // controls
    const mkToggle = (c, onChange) => {
      const t = el("button", "tg"); const sync = () => t.classList.toggle("on", val(c.key) >= 0.5); sync();
      t.onclick = () => { step++; send(c.key, val(c.key) >= 0.5 ? 0 : 1); sync(); if (onChange) onChange(); }; return t;
    };
    const mkChoice = (c) => {
      const w = el("div", "ch"), s = document.createElement("select"); w.append(el("div", "l", c.label), s);
      c.names.forEach((n, i) => { const o = document.createElement("option"); o.value = i; o.textContent = n; s.append(o); });
      s.value = String(Math.max(0, Math.min(c.names.length - 1, Math.trunc(val(c.key)))));
      s.onchange = () => { step++; send(c.key, +s.value); redrawPics(); };
      return w;
    };
    const ARC = (a0, a1, r) => { const p = (a) => [22 + r * Math.sin(a), 22 - r * Math.cos(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return "M" + x0.toFixed(2) + " " + y0.toFixed(2) + " A" + r + " " + r + " 0 " + (Math.abs(a1 - a0) > Math.PI ? 1 : 0) + " " + (a1 > a0 ? 1 : 0) + " " + x1.toFixed(2) + " " + y1.toFixed(2); };
    const mkKnob = (c, big, onChange) => {
      const w = el("div", "kn" + (big ? " big" : "")), svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", "0 0 44 44"); svg.setAttribute("width", "44"); svg.setAttribute("height", "44");
      const mk = (tag, a) => { const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
      mk("circle", { cx: 22, cy: 22, r: 14, fill: "rgba(190,193,188,0.6)", stroke: "#15141a", "stroke-width": 1.3 });
      mk("path", { d: ARC(-2.356, 2.356, 18), fill: "none", stroke: "rgba(21,20,26,0.18)", "stroke-width": 3 });
      const arc = mk("path", { fill: "none", stroke: "#15141a", "stroke-width": 3 }), ptr = mk("line", { x1: 22, y1: 22, x2: 22, y2: 11, stroke: "#15141a", "stroke-width": 2 });
      const lab = el("div", "l", c.label), vt = el("div", "v"); w.append(svg, lab, vt);
      const bip = c.min < 0 && c.max > 0 && Math.abs(c.min + c.max) < (c.max - c.min) * 0.01 + 1e-6;
      const norm = (v) => (v - c.min) / (c.max - c.min), a = (n) => -2.356 + n * 4.712;
      const show = () => {
        const v = val(c.key), n = Math.max(0, Math.min(1, norm(v)));
        arc.setAttribute("d", bip ? (Math.abs(n - 0.5) < 0.002 ? "" : ARC(a(0.5), a(n), 18)) : n < 0.002 ? "" : ARC(a(0), a(n), 18));
        const an = a(n); ptr.setAttribute("x2", (22 + 11 * Math.sin(an)).toFixed(2)); ptr.setAttribute("y2", (22 - 11 * Math.cos(an)).toFixed(2));
        vt.textContent = c.fmt(v);
      };
      const set = (n) => { n = Math.max(0, Math.min(1, n)); let v = c.min + n * (c.max - c.min); if (c.step) v = Math.round(v / c.step) * c.step; if (v === val(c.key) && S()[c.key] != null) return; send(c.key, v); show(); redrawPics(); if (onChange) onChange(); };
      let y0 = 0, n0 = 0, drag = false;
      w.addEventListener("pointerdown", (e) => { drag = true; y0 = e.clientY; n0 = norm(val(c.key)); step++; w.setPointerCapture(e.pointerId); e.preventDefault(); });
      w.addEventListener("pointermove", (e) => { if (!drag) return; set(n0 + ((y0 - e.clientY) / (e.shiftKey ? 600 : 150))); });
      const end = () => { drag = false; }; w.addEventListener("pointerup", end); w.addEventListener("pointercancel", end);
      w.addEventListener("dblclick", () => { step++; set(norm(c.def)); });
      w.addEventListener("wheel", (e) => { e.preventDefault(); step++; set(norm(val(c.key)) + (e.deltaY < 0 ? 0.02 : -0.02)); }, { passive: false });
      kshow.set(c.key, show); show(); return w;
    };
    const panel = (title, on, kids, extra) => {
      const pn = el("div", "pn"), ph = el("div", "ph"); ph.append(el("span", "hat"), el("div", "pt", "[ " + title + " ]"), el("span", "hat"));
      const sync = () => pn.classList.toggle("off", !!on && val(on.key) < 0.5);
      if (on) ph.append(mkToggle(on, sync)); sync();
      pn.append(ph); if (extra) pn.append(extra); for (const k of kids) pn.append(k); return pn;
    };
    const knobRow = (list, cs, onChange) => { const r = el("div", "ks"); for (const c of cs || []) r.append(mkChoice(c)); for (const k of list) r.append(mkKnob(k, false, onChange)); return r; };

    let pics = [];
    const redrawPics = () => { for (const f of pics) f(); if (typeof statusUp === "function") statusUp(); };
    // ---------- LCD displays: drawn on canvas, redrawn only on change; dragging on them turns the same knobs ----------
    const INK = "#15141a";
    const kshow = new Map();
    const clamp01 = (n) => Math.max(0, Math.min(1, n));
    const nOf = (key) => { const r = RNG[key]; return r ? (val(key) - r[0]) / (r[1] - r[0]) : 0; };
    const setN = (key, n) => {
      const r = RNG[key]; if (!r) return; n = clamp01(n); let v = r[0] + n * (r[1] - r[0]); if (r[2]) v = Math.round(v / r[2]) * r[2];
      if (v === val(key) && S()[key] != null) return;
      send(key, v); const f = kshow.get(key); if (f) f(); redrawPics();
    };
    let dotPat = null;
    const lcd = (h, draw, drag) => {
      const cv = el("canvas", "lcd"); cv.style.height = h + "px";
      const paint = () => {
        if (closed || !cv.isConnected) return;
        const w = cv.clientWidth; if (!w) { requestAnimationFrame(paint); return; }
        const g = sizeCanvas(cv, w, h);
        g.fillStyle = "#b6b9b3"; g.fillRect(0, 0, w, h);
        if (!dotPat) { const t = document.createElement("canvas"); t.width = t.height = 6; const q = t.getContext("2d"); q.fillStyle = "rgba(21,20,26,0.16)"; q.fillRect(2, 2, 2, 2); dotPat = g.createPattern(t, "repeat"); }
        g.fillStyle = dotPat; g.fillRect(0, 0, w, h);
        g.lineJoin = "round"; draw(g, w, h);
      };
      pics.push(paint); requestAnimationFrame(paint);
      if (drag) {
        let on = false;
        const at = (e, first) => { const r = cv.getBoundingClientRect(); drag(clamp01((e.clientX - r.left) / r.width), (e.clientY - r.top) / h, first, r.width); };
        cv.addEventListener("pointerdown", (e) => { on = true; step++; cv.setPointerCapture(e.pointerId); at(e, true); e.preventDefault(); });
        cv.addEventListener("pointermove", (e) => { if (on) at(e, false); });
        const end = () => { on = false; }; cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
      }
      return cv;
    };
    const handle = (g, x, y) => { g.fillStyle = INK; g.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8); g.fillStyle = "#E4FF3A"; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); };
    const trace = (g, pts, fill, base) => {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      if (fill) { const q = g.getTransform ? null : null; g.save(); g.lineTo(pts[pts.length - 1][0], base); g.lineTo(pts[0][0], base); g.closePath(); g.fillStyle = "rgba(21,20,26,0.14)"; g.fill(); g.restore(); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); }
      g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
    };
    const tag = (g, w, txt) => { g.font = "700 9px 'JetBrains Mono', monospace"; const t = "[ " + txt + " ]", tw = g.measureText(t).width; g.fillStyle = "#b6b9b3"; g.fillRect(w - tw - 9, 1, tw + 8, 15); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(w - tw - 8.5, 1.5, tw + 7, 14); g.fillStyle = INK; g.textAlign = "right"; g.fillText(t, w - 5, 12); g.textAlign = "left"; };
    let wcache = {};
    const framesOf = (n) => {   // the preset's wavetable keyframes, decoded once after the window is up
      if (wcache[n] !== undefined) return wcache[n];
      wcache[n] = null;
      setTimeout(() => {
        try {
          const wt = S().wavetables && S().wavetables[n - 1], comp = wt && wt.groups && wt.groups[0] && wt.groups[0].components && wt.groups[0].components[0], out = [];
          for (const k of (comp && comp.keyframes) || []) if (k.wave_data) { const bin = atob(k.wave_data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); out.push({ pos: +k.position || 0, data: new Float32Array(u.buffer) }); }
          wcache[n] = out.length ? out : null;
        } catch (e) { wcache[n] = null; }
        if (!closed) redrawPics();
      }, 20);
      return null;
    };
    const oscLcd = (n) => {
      const p = "osc_" + n + "_", H = 124, SH = 20;
      return lcd(H, (g, w, h) => {
        const wh = h - SH, fr = framesOf(n), pos = val(p + "wave_frame");
        let best = fr && fr[0]; if (fr) for (const k of fr) if (Math.abs(k.pos - pos) < Math.abs(best.pos - pos)) best = k;
        g.strokeStyle = "rgba(21,20,26,0.3)"; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(0, wh / 2); g.lineTo(w, wh / 2); g.stroke(); g.setLineDash([]);
        const pts = []; for (let i = 0; i < w; i += 2) { const v = best ? best.data[Math.floor((i / w) * best.data.length)] : Math.sin((i / w) * Math.PI * 2); pts.push([i, wh / 2 - Math.max(-1, Math.min(1, v)) * (wh / 2 - 8)]); }
        trace(g, pts, true, wh / 2);
        const on = val(p + "distortion_type") >= 1, wy = 6 + (1 - val(p + "distortion_amount")) * (wh - 14);   // warp: drag up and down
        g.strokeStyle = on ? INK : "rgba(21,20,26,0.35)"; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(0, wy); g.lineTo(w - 10, wy); g.stroke(); g.setLineDash([]); handle(g, w - 6, wy);
        g.fillStyle = INK; g.fillRect(0, wh, w, 1);   // frame strip: drag across frames
        for (const k of fr || [{ pos: 0 }]) g.fillRect(3 + (k.pos / 256) * (w - 6), wh + 3, 1, 8);
        const hx = 3 + nOf(p + "wave_frame") * (w - 6); g.fillRect(hx - 1, wh + 2, 3, SH - 5); g.fillStyle = "#E4FF3A"; g.fillRect(hx, wh + 4, 1, SH - 9);
        tag(g, w, "FRAME " + Math.round(pos));
      }, (nx, ny, first) => { const sy = ny * H; if (first) dragMode = sy >= H - SH ? "f" : "w"; if (dragMode === "f") setN(p + "wave_frame", nx); else setN(p + "distortion_amount", 1 - (sy - 6) / (H - SH - 14)); });
    };
    let dragMode = "";
    const respY = (pre, m, h) => {   // a filter's response at note m: low pass with a peak at the cutoff
      const c = val(pre + "cutoff"), q = 0.55 + val(pre + "resonance") * val(pre + "resonance") * 9, r = Math.pow(2, (m - c) / 12), dbl = val(pre + "style") === 1 ? 2 : 1;
      let mag = Math.pow(1 / Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(r / q, 2)), dbl);
      const db = Math.max(-40, Math.min(20, 20 * Math.log10(mag + 1e-6)));
      return 8 + (20 - db) / 60 * (h - 16);
    };
    const filterDraw = (pre) => (g, w, h) => {
      const pts = []; for (let i = 0; i <= w; i += 2) pts.push([i, respY(pre, 8 + (i / w) * 128, h)]);
      g.strokeStyle = "rgba(21,20,26,0.3)"; g.setLineDash([2, 3]); g.beginPath(); const z = 8 + 20 / 60 * (h - 16); g.moveTo(0, z); g.lineTo(w, z); g.stroke(); g.setLineDash([]);
      trace(g, pts, true, h);
      const cx = nOf(pre + "cutoff") * w; handle(g, cx, respY(pre, val(pre + "cutoff"), h));
      tag(g, w, hz(val(pre + "cutoff")) + " Q" + Math.round(val(pre + "resonance") * 100));
    };
    const filterDrag = (pre, h) => (nx, ny) => { setN(pre + "cutoff", nx); setN(pre + "resonance", 1 - (ny * h - 10) / (h - 30)); };
    const filterLcd = (pre, h) => lcd(h, filterDraw(pre), filterDrag(pre, h));
    const envGeom = (pre, w) => {
      const pad = 8, sA = 0.26 * w, sD = 0.26 * w, sS = 0.12 * w, sR = 0.26 * w, top = 10, base = 0, g_ = (k) => val(pre + k);
      return { pad, sA, sD, sS, sR, xA: pad + (g_("attack") / 2.3784) * sA, xD: pad + sA + (g_("decay") / 2.3784) * sD, xS: pad + sA + sD + sS, xR: pad + sA + sD + sS + (g_("release") / 2.3784) * sR, su: g_("sustain") };
    };
    const envLcd = (n) => {
      const pre = "env_" + n + "_", H = 112, TOP = 12, BOT = 10, ay = (v) => H - BOT - v * (H - BOT - TOP);
      return lcd(H, (g, w) => {
        const e = envGeom(pre, w), pts = [[e.pad, ay(0)]];
        const seg = (x0, x1, y0, y1, q) => { for (let i = 1; i <= 18; i++) { const p = i / 18; pts.push([x0 + (x1 - x0) * p, ay(y0 + (y1 - y0) * shape(p, q))]); } };
        seg(e.pad, e.xA, 0, 1, -val(pre + "attack_power")); seg(e.xA, e.xD, 1, e.su, val(pre + "decay_power")); pts.push([e.xS, ay(e.su)]); seg(e.xS, e.xR, e.su, 0, val(pre + "release_power"));
        trace(g, pts, true, ay(0));
        handle(g, e.xA, ay(1)); handle(g, e.xD, ay(e.su)); handle(g, e.xR, ay(0));
        tag(g, w, "A" + secs(Math.pow(val(pre + "attack"), 4)) + " D" + secs(Math.pow(val(pre + "decay"), 4)) + " S" + Math.round(e.su * 100) + " R" + secs(Math.pow(val(pre + "release"), 4)));
      }, (nx, ny, first, w) => {
        const e = envGeom(pre, w), px = nx * w;
        if (first) { const d = [Math.abs(px - e.xA), Math.abs(px - e.xD), Math.abs(px - e.xR)]; dragMode = "ADR"[d.indexOf(Math.min(...d))]; }
        if (dragMode === "A") setN(pre + "attack", (px - e.pad) / e.sA);
        else if (dragMode === "D") { setN(pre + "decay", (px - e.pad - e.sA) / e.sD); setN(pre + "sustain", (H - BOT - ny * H) / (H - BOT - TOP)); }
        else setN(pre + "release", (px - e.pad - e.sA - e.sD - e.sS) / e.sR);
      });
    };
    const lfoAt = (lfo, u) => {
      const P = lfo && lfo.points && lfo.points.length >= 4 ? lfo.points : [0, 1, 0.5, 0, 1, 1], pw = (lfo && lfo.powers) || [], n = P.length / 2;
      u = ((u % 1) + 1) % 1; let i = 0; while (i + 1 < n && P[(i + 1) * 2] <= u) i++;
      const x0 = P[i * 2], y0 = P[i * 2 + 1], x1 = i + 1 < n ? P[(i + 1) * 2] : 1, y1 = i + 1 < n ? P[(i + 1) * 2 + 1] : P[1];
      const p = x1 > x0 ? (u - x0) / (x1 - x0) : 0; return y0 + (y1 - y0) * (lfo && lfo.smooth ? p : shape(p, pw[i] || 0));
    };
    const lfoLcd = (n) => {
      const p = "lfo_" + n + "_", H = 100;
      return lcd(H, (g, w, h) => {
        const lfo = (S().lfos || [])[n - 1], ph = val(p + "phase"), pts = [];
        g.strokeStyle = "rgba(21,20,26,0.3)"; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); g.setLineDash([]);
        for (let i = 0; i <= w; i += 2) pts.push([i, 10 + lfoAt(lfo, i / w + ph) * (h - 20)]);
        trace(g, pts, false);
        handle(g, nOf(p + "frequency") * (w - 12) + 6, h - 8);
        tag(g, w, val(p + "sync") === 0 ? freqSecs(val(p + "frequency")) : TEMPO[Math.trunc(val(p + "tempo"))] || "");
      }, (nx, ny) => { setN(p + "frequency", nx); setN(p + "phase", ny); });
    };
    let sampPk = undefined;
    const samplePeaks = () => {
      if (sampPk !== undefined) return sampPk;
      sampPk = null;
      setTimeout(() => {
        try {
          const sm = S().sample;
          if (sm && typeof sm.samples === "string" && sm.length > 4 && sm.length < 3e6) {
            const bin = atob(sm.samples), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
            const a = new Int16Array(u.buffer, 0, Math.floor(u.length / 2)), N = 400, pk = [];
            for (let i = 0; i < N; i++) { let lo = 1, hi = -1; const a0 = Math.floor(i * a.length / N), a1 = Math.max(a0 + 1, Math.floor((i + 1) * a.length / N)); for (let k = a0; k < a1 && k < a.length; k++) { const v = a[k] / 32767; if (v < lo) lo = v; if (v > hi) hi = v; } pk.push([lo, hi]); }
            sampPk = { pk, name: String(sm.name || "SAMPLE") };
          }
        } catch (e) { sampPk = null; }
        if (!closed) redrawPics();
      }, 20);
      return null;
    };
    const sampleLcd = () => lcd(96, (g, w, h) => {
      const sp = samplePeaks(), mid = h / 2, lv = val("sample_level");
      if (!sp) { g.fillStyle = INK; g.font = "700 11px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.fillText("[ NO SAMPLE ]", w / 2, mid + 4); g.textAlign = "left"; return; }
      g.fillStyle = INK;
      for (let i = 0; i < w; i += 2) { const q = sp.pk[Math.min(sp.pk.length - 1, Math.floor(i / w * sp.pk.length))], y0 = mid - q[1] * lv * 1.4 * (mid - 8), y1 = mid - q[0] * lv * 1.4 * (mid - 8); g.fillRect(i, y0, 1.5, Math.max(1.5, y1 - y0)); }
      tag(g, w, sp.name.toUpperCase().slice(0, 18));
    }, (nx, ny) => setN("sample_level", 1 - ny));
    const chip = (key, label) => { const w = el("div", "chp"); w.append(mkToggle({ key }), el("span", null, label)); return w; };
    const fxLcd = (name) => {
      const H = 66, v = val;
      const wave = (rate, depth) => (g, w, h) => { const pts = []; for (let i = 0; i <= w; i += 2) pts.push([i, h / 2 - Math.sin((i / w) * Math.PI * 2 * (1 + (v(rate) + 6) / 3)) * depth() * (h / 2 - 8)]); trace(g, pts, false); };
      let d = null, dr = null;
      if (name === "DISTORTION") {
        d = (g, w, h) => { const gain = Math.pow(10, v("distortion_drive") / 20), t = Math.trunc(v("distortion_type")), pts = [];
          for (let i = 0; i <= w; i += 2) { const x = ((i / w) * 2 - 1) * gain; let y;
            if (t === 0) y = Math.tanh(x); else if (t === 1) y = Math.max(-1, Math.min(1, x)); else if (t === 2) { const a = ((x + 1) % 4 + 4) % 4; y = a < 2 ? a - 1 : 3 - a; } else if (t === 3) y = Math.sin(x * 1.57); else y = Math.round(x * 4) / 4;
            pts.push([i, h / 2 - Math.max(-1, Math.min(1, y)) * (h / 2 - 6)]); }
          trace(g, pts, false); };
        dr = (nx, ny) => { setN("distortion_drive", 1 - ny); setN("distortion_mix", nx); };
      } else if (name === "CHORUS" || name === "FLANGER" || name === "PHASER") {
        const k = name.toLowerCase() + "_"; d = wave(k + "frequency", () => v(k + "mod_depth") / (name === "PHASER" ? 48 : 1) * 0.9 + 0.1);
        dr = (nx, ny) => { setN(k + "frequency", nx); setN(k + "mod_depth", 1 - ny); };
      } else if (name === "DELAY") {
        d = (g, w, h) => { const fb = Math.abs(v("delay_feedback")), mix = v("delay_dry_wet"); g.fillStyle = INK; g.fillRect(6, 8, 5, h - 14); let a = mix * 2 > 1 ? 1 : mix * 2; for (let i = 1; i < 12; i++) { a *= Math.max(0.05, fb); const x = 6 + i * ((w - 16) / 11), hh = a * (h - 14); g.fillRect(x, h - 6 - hh, 5, hh); } };
        dr = (nx, ny) => { setN("delay_feedback", 1 - ny * 2 > 0 ? 1 - ny * 2 + 0 : 0); setN("delay_dry_wet", nx); };
        dr = (nx, ny) => { setN("delay_feedback", 0.5 + (1 - ny) / 2); setN("delay_dry_wet", nx); };
      } else if (name === "REVERB") {
        d = (g, w, h) => { const tau = 0.12 + (v("reverb_decay_time") + 6) / 12 * 0.9, amp = 0.25 + v("reverb_dry_wet") * 0.7, pts = []; for (let i = 0; i <= w; i += 2) pts.push([i, h - 5 - amp * (h - 12) * Math.exp(-(i / w) / tau) * (0.85 + 0.15 * Math.sin(i * 0.9))]); trace(g, pts, true, h - 5); };
        dr = (nx, ny) => { setN("reverb_decay_time", nx); setN("reverb_dry_wet", 1 - ny); };
      } else if (name === "COMPRESSOR") {
        d = (g, w, h) => { const a = nOf("compressor_attack"), r = nOf("compressor_release"); g.fillStyle = INK; g.fillRect(6, 14, a * (w - 12), 10); g.fillRect(6, 38, r * (w - 12), 10); };
        dr = (nx, ny) => setN(ny < 0.5 ? "compressor_attack" : "compressor_release", nx);
      } else if (name === "EQ") {
        d = (g, w, h) => { const sg = (x) => 1 / (1 + Math.exp(-x)), pts = []; for (let i = 0; i <= w; i += 2) { const m = 8 + (i / w) * 128, db = v("eq_low_gain") * sg(-(m - v("eq_low_cutoff")) / 8) + v("eq_band_gain") * Math.exp(-Math.pow((m - v("eq_band_cutoff")) / 14, 2)) + v("eq_high_gain") * sg((m - v("eq_high_cutoff")) / 8); pts.push([i, h / 2 - db / 15 * (h / 2 - 6)]); } trace(g, pts, false); };
        dr = (nx, ny) => setN(nx < 0.33 ? "eq_low_gain" : nx < 0.66 ? "eq_band_gain" : "eq_high_gain", 1 - ny);
      } else if (name === "FX FILTER") {
        return lcd(H, filterDraw("filter_fx_"), filterDrag("filter_fx_", H));
      }
      return d ? lcd(H, d, dr) : null;
    };
    function buildPage() {
      pics = []; kshow.clear(); body.textContent = ""; body.className = "body";
      if (page === "OSC") {
        body.classList.add("g4");
        for (let n = 1; n <= 3; n++) {
          const o = oscKnobs(n), ks = el("div", "ks"), cs = el("div", "ks");
          for (const c of o.cs) cs.append(mkChoice(c));
          for (const k of o.ks) ks.append(mkKnob(k, false));
          body.append(panel("OSC " + n, o.on, [cs, ks], oscLcd(n)));
        }
        const chips = el("div", "ks"); chips.append(chip("sample_loop", "LOOP"), chip("sample_keytrack", "KEYTRACK"), chip("sample_bounce", "BOUNCE"));
        body.append(panel("SAMPLE", SAMPLE.on, [chips, knobRow(SAMPLE.ks)], sampleLcd()));
      } else if (page === "FILTER") {
        body.classList.add("g2");
        for (const [t, pre] of [["FILTER 1", "filter_1_"], ["FILTER 2", "filter_2_"]]) { const f = filtKnobs(pre); body.append(panel(t, f.on, [knobRow(f.ks, f.cs)], filterLcd(pre, 130))); }
        body.append(panel("VOICE", null, [knobRow(OUT)]));
      } else if (page === "ENV") {
        body.classList.add("g3");
        for (let n = 1; n <= 3; n++) { const e = envKnobs(n); body.append(panel(n === 1 ? "ENV 1 AMP" : "ENV " + n, null, [knobRow(e.ks)], envLcd(n))); }
      } else if (page === "LFO") {
        body.classList.add("g2");
        for (let n = 1; n <= 4; n++) { const l = lfoKnobs(n), cs = el("div", "ks"); for (const c of l.cs) cs.append(mkChoice(c)); const ks = el("div", "ks"); for (const k of l.ks) ks.append(mkKnob(k, false)); body.append(panel("LFO " + n, null, [cs, ks], lfoLcd(n))); }
      } else if (page === "FX") {
        body.classList.add("g3");
        for (const [t, on, cs, ks] of FX) body.append(panel(t, T(on), [knobRow(ks, cs)], fxLcd(t)));
      } else {
        const mc = el("div", "mc"); mc.style.gridColumn = "1 / -1";
        for (let i = 1; i <= 4; i++) {
          const mp = el("div", "mp"), name = (preset.data["macro" + i] || "MACRO " + i);
          const c = K("macro_control_" + i, name, 0, 1, 0, pct);
          const dest = el("div", "dest"), seen = new Set();
          for (const m of S().modulations || []) if (m && m.source === "macro_control_" + i && m.destination && !seen.has(m.destination) && seen.size < 8) { seen.add(m.destination); dest.append(el("span", null, String(m.destination).replace(/_/g, " "))); }
          mp.append(mkKnob(c, true), dest); mc.append(mp);
        }
        body.append(mc);
      }
    }
    for (const t of PAGES) { const b = el("button", "tab", t); b.dataset.page = t; b.onclick = () => { page = t; try { sessionStorage.setItem("tm3u.page", t); } catch (e) { /* no storage */ } tabs.querySelectorAll(".tab").forEach((q) => q.classList.toggle("on", q === b)); buildPage(); }; b.classList.toggle("on", t === page); tabs.append(b); }
    buildPage();

    // keyboard: two octaves from C3
    const sendNote = (cmd, args) => booth(cmd, { pluginId: pid, ...args });
    const LO = 48, WHITE = [0, 2, 4, 5, 7, 9, 11], whites = [], keyEls = new Map();
    for (let n = LO; n < LO + 25; n++) if (WHITE.includes(n % 12)) whites.push(n);
    whites.forEach((n) => { const w = el("div", "w"); w.dataset.n = n; kb.append(w); keyEls.set(n, w); });
    const ww = 100 / whites.length;
    for (let n = LO; n < LO + 25; n++) if (!WHITE.includes(n % 12)) { const k = el("div", "k"); k.dataset.n = n; const left = whites.indexOf(n - 1); k.style.left = ((left + 1) * ww - ww * 0.3) + "%"; k.style.width = (ww * 0.6) + "%"; kb.append(k); keyEls.set(n, k); }
    let held = null;
    const up = () => { if (held == null) return; sendNote("toyMachineNote", { pitch: held, on: false }); keyEls.get(held).classList.remove("on"); held = null; };
    kb.addEventListener("pointerdown", (e) => { const n = +(e.target.dataset && e.target.dataset.n); if (!n) return; up(); held = n; e.target.classList.add("on"); sendNote("toyMachineNote", { pitch: n, velocity: 100, on: true }); });
    window.addEventListener("pointerup", up);

    statusUp();
    const win = {
      root,
      setPreset: (np) => { if (np && window.TM3Web.isTm3(np)) { preset = np; wcache = {}; showName(); render(); } },   // undo/redo reloads the sound
    };
    tmWin = { pid, host, win, meterTimer: 0 };   // eslint-disable-line no-global-assign
    const obs = new MutationObserver(() => { if (!root.isConnected) { closed = true; window.removeEventListener("pointerup", up); obs.disconnect(); } });
    obs.observe(into || document.body, { childList: true, subtree: true });
    root.focus({ preventScroll: true });
  }
  window.TM3UI = { open, version: 1 };
})();
