// KILLCHAIN (Eman, 11 Nov 2026): the sidechain effect. Put it on a sound, pick what pushes it
// down (click clips or lanes on the grid, drag a box to pick many, OK), and every hit of those
// sounds ducks this one along a curve you shape right on the picture.
//
//   - No input picked: it ducks on every beat (like a classic pump), so it does something at once.
//   - The input is a list of lanes (whole lane) and/or clips (only while that clip plays). The
//     engine taps each lane after its effects, before its fader/mute, so a muted ghost kick works.
//   - Each input gets a name ("KILLDRUM SC"). On another sound, the INPUT list shows every named
//     input in the project: pick one and it's the same sidechain (re-picking it changes them all).
//   - Picture: grey bars = the input's hits since the last trigger, the line = how loud this sound
//     is let through. Grab anywhere and drag: the low part (how much), its right end (hold), the
//     bend (sharp or soft), the end (how long, snaps to note values).
//
// Plugin: { type: "ktside", name: "KILLCHAIN", params: amount length shape sense hold,
//           side: { name, src: [{ t: trackId, c: [clipIds] | null }] } | undefined }
// Commands (ui/app.js demo backend): setSideInput { pluginId, src, name? | use }.
// Engine: KillChain.load(ctx) once, KillChain.create(ctx, clock) per run (playground.js).
// window.KT2_KILLCHAIN_OFF hides it from ADD EFFECT (old behaviour); saved ones still play.
(function () {
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  // ------------------------------------------------------------------ the maths (shared by picture + engine)
  const NOTES = [[1 / 32, "1/32"], [1 / 16, "1/16"], [1 / 8, "1/8"], [3 / 16, "3/16"], [1 / 4, "1/4"], [3 / 8, "3/8"], [1 / 2, "1/2"]];
  const SPAN = 1 / 2;   // the picture shows half a bar
  const M = {
    noteIdx: (v) => Math.round(clamp01(v) * (NOTES.length - 1)),
    lenWhole: (v) => NOTES[M.noteIdx(v)][0],          // fraction of a bar (whole note)
    lenText: (v) => NOTES[M.noteIdx(v)][1],
    floor: (amount) => 1 - clamp01(amount) * 0.98,     // gain at the bottom
    k: (shape) => Math.pow(2, (clamp01(shape) - 0.5) * 3.2),   // >1 soft and long down, <1 sharp snap back
    thrDb: (sense) => -6 - clamp01(sense) * 48,
    hold: (v) => clamp01(v) * 0.6,                     // part of the length that stays fully down
    ATT: 0.0015,                                       // seconds to go down (no click)
    // the gain at x (0..1 of the length), ignoring the tiny attack
    curve(x, P) {
      if (x >= 1) return 1;
      const fl = M.floor(P.amount), h = M.hold(P.hold);
      if (x <= h) return fl;
      const r = (x - h) / Math.max(1e-4, 1 - h), s = r * r * (3 - 2 * r);
      return fl + (1 - fl) * Math.pow(s, M.k(P.shape));
    },
  };
  const DEF = { amount: 0.8, length: 4 / 6, shape: 0.5, sense: 0.5, hold: 0.12 };
  // W/O INPUT (Eman, 17 Nov: "W/O INPUT: sidechain pump driven by a picked rhythm, no input needed, like Kickstart"):
  // with nothing picked, KILLCHAIN ducks on the rhythm chosen here (16 steps a bar) instead of only every beat.
  // Saved on the plugin as p.beat (left out for the old 1/4, so old projects stay byte-identical).
  // window.KT2_KCHN_WO_OLD = old (one "BEAT \u00b7 1/4" entry, every beat).
  const woOld = () => !!window.KT2_KCHN_WO_OLD;
  const RHYTHMS = [
    { id: "1/4", name: "1/4", about: "every beat", steps: "x...x...x...x..." },
    { id: "1/8", name: "1/8", about: "every 8th", steps: "x.x.x.x.x.x.x.x." },
    { id: "1/2", name: "1/2", about: "beats 1 + 3", steps: "x.......x......." },
    { id: "1/16", name: "1/16", about: "every 16th, a tremolo", steps: "xxxxxxxxxxxxxxxx" },
    { id: "OFF", name: "OFFBEAT", about: "the and of every beat", steps: "..x...x...x...x." },
    { id: "DOT", name: "DOTTED", about: "dotted 8ths, 3-3-3-3-4", steps: "x..x..x..x..x..." },
    { id: "HALF", name: "HALF TIME", about: "1, and of 2, 3", steps: "x.....x.x......." },
    { id: "BREAK", name: "BREAKBEAT", about: "a broken kick pattern", steps: "x.........x....." },
    { id: "CLAVE", name: "CLAVE", about: "3-2 clave", steps: "x..x..x...x.x..." },
    { id: "GALLOP", name: "GALLOP", about: "x.xx on every beat", steps: "x.xxx.xxx.xxx.xx" },
  ];
  const beatOf = (p) => { const id = p && p.beat; return RHYTHMS.find((r) => r.id === id) || RHYTHMS[0]; };
  // the hit times inside one bar, in beats (4 beats a bar)
  const beatPat = (p) => { const r = beatOf(p); const out = []; for (let i = 0; i < 16; i++) if (r.steps[i] === "x") out.push(i / 4); return out; };
  const text = (pid, v) => {
    if (pid === "amount") return Math.round(clamp01(v) * 100) + "%";
    if (pid === "length") return M.lenText(v);
    if (pid === "shape") { const x = Math.round((clamp01(v) - 0.5) * 200); return x === 0 ? "S" : x < 0 ? "sharp " + -x : "soft " + x; }
    if (pid === "sense") return Math.round(M.thrDb(v)) + " dB";
    if (pid === "hold") return Math.round(M.hold(v) * 100) + "%";
    return null;
  };
  const params = () => [["amount", "Amount"], ["length", "Length"], ["shape", "Shape"], ["sense", "Sense"], ["hold", "Hold"]]
    .map(([id, name]) => ({ id, name, value: DEF[id], def: DEF[id], text: text(id, DEF[id]) }));
  const valuesOf = (p) => { const o = { ...DEF }; for (const q of (p && p.params) || []) if (q.id in o) o[q.id] = Number(q.value); return o; };

  // ------------------------------------------------------------------ the engine (Web Audio)
  const WORKLET = `
  const ATT = ${M.ATT};
  class KillChain extends AudioWorkletProcessor {
    constructor() {
      super();
      this.P = { floor: 0.2, len: 0.5, hold: 0.07, k: 1, thr: 0.03, spb: 0.5, origin: 0, keyed: false, lenW: 0.25, listen: true };
      this.hits = []; this.hi = 0;   // a pattern input's note times (ctx seconds), sorted
      this.blips = []; this.bi = 0;  // GHOST: muted notes' times; they draw a bar in the picture (there's no sound to show)
      this.ph = 1e9; this.g = 1; this.g0 = 1; this.ef = 0; this.es = 0; this.since = 1e9; this.lastB = null;
      this.bins = new Float32Array(64); this.n = 0; this.alive = true; this.gMin = 1;
      this.port.onmessage = (m) => { const d = m.data; if (d.set) Object.assign(this.P, d.set); if (d.close) this.alive = false;
        if (d.hits) { this.hits = this.hits.concat(d.hits).sort((a, b) => a - b); this.hi = 0; }
        if (d.blips) { this.blips = this.blips.concat(d.blips).sort((a, b) => a - b); this.bi = 0; } };
    }
    gainAt(ph) {
      const P = this.P, L = P.len;
      if (ph < ATT) return this.g0 + (P.floor - this.g0) * (ph / ATT);
      const x = (ph - ATT) / Math.max(1e-4, L - ATT);
      if (x >= 1) return 1;
      if (x <= P.hold) return P.floor;
      const r = (x - P.hold) / Math.max(1e-4, 1 - P.hold), s = r * r * (3 - 2 * r);
      return P.floor + (1 - P.floor) * Math.pow(s, P.k);
    }
    process(ins, outs) {
      const main = ins[0], key = ins[1], out = outs[0], P = this.P, sr = sampleRate;
      const N = out[0].length, dt = 1 / sr;
      const rf = Math.exp(-dt / 0.03), as = 1 - Math.exp(-dt / 0.08);
      const spanS = 2 * P.spb;   // the picture's half bar, in seconds
      const haveKey = P.keyed && key && key.length > 0;
      for (let i = 0; i < N; i++) {
        let x = 0;
        if (haveKey) { for (let c = 0; c < key.length; c++) { const a = Math.abs(key[c][i]); if (a > x) x = a; } }
        else if (main && main.length) { for (let c = 0; c < main.length; c++) { const a = Math.abs(main[c][i]); if (a > x) x = a; } }
        let hit = false;
        if (P.keyed && this.hi < this.hits.length) {
          const now = currentTime + i * dt;
          while (this.hi < this.hits.length && this.hits[this.hi] < now - 0.05) this.hi++;   // already gone
          if (this.hi < this.hits.length && this.hits[this.hi] <= now) { hit = true; this.hi++; }
        }
        if (this.bi < this.blips.length) {
          const now = currentTime + i * dt;
          while (this.bi < this.blips.length && this.blips[this.bi] < now - 0.05) this.bi++;
          if (this.bi < this.blips.length && this.blips[this.bi] <= now) { this.bi++; if (this.ef < 0.6) this.ef = 0.6; }
        }
        if (haveKey) {
          const prevEs = this.es;
          this.ef = x > this.ef ? x : this.ef * rf;
          this.es += (x - this.es) * as;
          if (P.listen && this.ef > P.thr && this.ef > 2.2 * prevEs + 1e-5 && this.since > 0.045) hit = true;
        } else if (!P.keyed && P.pat && P.pat.length) {
          // W/O INPUT: a hit on every step of the picked rhythm (P.pat = beats inside a 4-beat bar)
          const t = currentTime + i * dt - P.origin, bar = 4 * P.spb, bn = Math.floor(t / bar + 1e-9), into = t - bn * bar;
          let k = -1; for (let j = 0; j < P.pat.length; j++) if (P.pat[j] * P.spb <= into + 1e-9) k = j;
          const id = k < 0 ? bn * 64 - 1 : bn * 64 + k;
          if (t >= 0 && id !== this.lastB) {
            const since = k < 0 ? 1e9 : into - P.pat[k] * P.spb;
            if (this.lastB === null && since > 0.005) { if (k >= 0) { this.ph = since; this.g0 = P.floor; } }
            else if (k >= 0) hit = true;
            this.lastB = id;
          }
          this.ef = x > this.ef ? x : this.ef * rf;
        } else if (!P.keyed) {
          const t = currentTime + i * dt - P.origin, b = Math.floor(t / P.spb + 1e-9);
          if (t >= 0 && b !== this.lastB) {
            const into = t - b * P.spb;
            if (this.lastB === null && into > 0.005) { this.ph = into; this.g0 = P.floor; }   // started mid-beat: join the curve where it is
            else hit = true;
            this.lastB = b;
          }
          this.ef = x > this.ef ? x : this.ef * rf;
        }
        if (hit) { this.g0 = this.g; this.ph = 0; this.since = 0; this.bins.fill(0); }
        this.since += dt;
        const g = this.ph < 1e8 ? this.gainAt(this.ph) : 1;
        this.g = g; if (g < this.gMin) this.gMin = g;
        if (this.ph < spanS) { const bi = Math.min(63, Math.floor(this.ph / spanS * 64)); if (this.ef > this.bins[bi]) this.bins[bi] = this.ef; }
        this.ph += dt;
        for (let c = 0; c < out.length; c++) { const s = main && main[c] ? main[c][i] : (main && main[0] ? main[0][i] : 0); out[c][i] = s * g; }
      }
      this.n += N;
      if (this.n >= 1536) { this.n = 0; this.port.postMessage({ bins: Array.from(this.bins), ph: this.ph / spanS, g: this.g, gMin: this.gMin }); this.gMin = 1; }
      return this.alive;
    }
  }
  registerProcessor("killchain", KillChain);`;

  const ready = new WeakMap();   // ctx -> true once the worklet is in
  function load(ctx) {
    if (!ctx || !ctx.audioWorklet || ready.has(ctx)) return Promise.resolve();
    ready.set(ctx, false);
    return ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })))
      .then(() => ready.set(ctx, true), (e) => console.warn("KILLCHAIN did not load", e));
  }
  // clock() -> { bpm, origin: ctx time of song 0:00 }
  function create(ctx, p, clock) {
    if (!ready.get(ctx)) { const g = ctx.createGain(); return { input: g, output: g, set: (pid, v) => text(pid, v), addKey: () => {}, close: () => {} }; }
    const node = new AudioWorkletNode(ctx, "killchain", { numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [2] });
    const vals = valuesOf(p);
    const push = () => {
      const c = clock(), spb = 60 / (c.bpm || 120);
      node.port.postMessage({ set: { floor: M.floor(vals.amount), len: M.lenWhole(vals.length) * 4 * spb, hold: M.hold(vals.hold), k: M.k(vals.shape),
                                     thr: Math.pow(10, M.thrDb(vals.sense) / 20), spb, origin: c.origin,
                                     pat: woOld() || !p || !p.beat || p.beat === "1/4" ? null : beatPat(p) } });
    };
    push();
    node.port.onmessage = (m) => {
      if (!p || !window.FxView) return;
      FxView.live.set(p.id, m.data);
      FxView.redraw(p.id);
    };
    let keys = 0, ears = 0;
    return {
      input: node, output: node,
      set: (pid, v) => { if (pid in vals) { vals[pid] = Number(v); push(); } return text(pid, v); },
      // listen = false: this input's sound only feeds the picture, its hits come from addHits (a pattern's notes)
      addKey: (src, listen = true) => { src.connect(node, 0, 1); if (listen) ears++; keys++; node.port.postMessage({ set: { keyed: true, listen: ears > 0 } }); },
      addHits: (times) => { if (times && times.length) node.port.postMessage({ hits: times }); },
      addBlips: (times) => { if (times && times.length) node.port.postMessage({ blips: times }); },
      close: () => { node.port.postMessage({ close: true }); node.port.onmessage = null; },
    };
  }

  // ------------------------------------------------------------------ names and inputs
  const plugins = (S) => {
    if (!S) return [];
    const out = [];
    for (const t of S.tracks || []) { for (const p of t.plugins || []) out.push([p, t]); for (const c of t.clips || []) for (const p of c.plugins || []) out.push([p, t]); }
    return out.filter(([p]) => p.type === "ktside");
  };
  // every named input in the project: [{ name, src, users }]
  function inputs(S) {
    const by = new Map();
    for (const [p] of plugins(S)) if (p.side && p.side.name) {
      const x = by.get(p.side.name) || { name: p.side.name, src: p.side.src, users: 0 };
      x.users++; by.set(p.side.name, x);
    }
    return [...by.values()];
  }
  // PATTERN INPUT (Eman, 16 Nov: "if i press the green pattern, then all the green patterns will be of reference"):
  // a picked clip stands for its whole pattern / sound. Every linked copy of that pattern (c.pat), that sound
  // (c.link / c.src) or that compound (c.cmp.def) is the input too, on any lane, also copies added later.
  // src entries keep their clip ids (c) plus the picked keys (k). window.KT2_KCHN_PAT_OLD = old (only the clips clicked).
  const patOld = () => !!window.KT2_KCHN_PAT_OLD;
  const keyOf = (c) => (!c ? null : c.cmp && c.cmp.def ? "cmp:" + c.cmp.def : c.kind === "midi" ? "pat:" + (c.pat || c.id)
    : (c.link || c.src) ? "src:" + (c.link || c.src) : "id:" + c.id);
  // the input as it is right now: [{ t, c: [ids] | null }], every copy of the picked patterns included
  function expand(S, src, skip) {
    src = (src || []).filter(Boolean);
    if (patOld() || !S || !S.tracks) return src;
    const lanes = new Set(src.filter((s) => !s.c).map((s) => s.t)), K = new Set(), by = new Map();
    for (const s of src) {
      if (!s.c) continue;
      for (const k of s.k || []) K.add(k);
      const t = S.tracks.find((x) => x.id === s.t);
      for (const c of (t && t.clips) || []) if (s.c.includes(c.id)) K.add(keyOf(c));
      if (!by.has(s.t)) by.set(s.t, new Set());
      for (const id of s.c) by.get(s.t).add(id);
    }
    for (const t of S.tracks) for (const c of t.clips || []) if (K.has(keyOf(c))) {
      if (!by.has(t.id)) by.set(t.id, new Set());
      by.get(t.id).add(c.id);
    }
    const out = [...lanes].map((t) => ({ t, c: null }));
    for (const [t, ids] of by) if (!lanes.has(t) && ids.size) out.push({ t, c: [...ids] });
    return skip ? out.filter((s) => s.t !== skip) : out;
  }
  const hostOf = (S, pluginId) => { const x = plugins(S).find(([p]) => p.id === pluginId); return x ? x[1] : null; };
  // a fresh name from the first picked sound: "KILLDRUM SC", then "KILLDRUM SC 2"...
  function autoName(S, src) {
    const t = src[0] && (S.tracks || []).find((x) => x.id === src[0].t);
    let base = ((t && t.name) || "INPUT").toUpperCase().replace(/\s+/g, " ").trim().slice(0, 14) + " SC";
    const taken = new Set(inputs(S).map((x) => x.name));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(base + " " + n)) return base + " " + n;
  }
  const label = (p) => (p.side && p.side.name ? p.side.name : woOld() ? "BEAT \u00b7 1/4" : "W/O INPUT \u00b7 " + beatOf(p).name);
  // the demo backend's command (ui/app.js): set this KILLCHAIN's input, keep a shared name in step
  function setInput(S, { pluginId, src, name, use, fresh, beat }) {
    const all = plugins(S), me = all.find(([p]) => p.id === pluginId);
    if (!me) return { error: "That KILLCHAIN isn't there any more." };
    const [p, host] = me;
    if (use) {
      const x = inputs(S).find((i) => i.name === use);
      if (!x) return { error: "That input isn't there any more." };
      p.side = { name: x.name, src: JSON.parse(JSON.stringify(x.src)) };
      return { ok: true, name: x.name };
    }
    // Stress test 16 Nov: an input that is not a list broke the command, and the same lane given twice was kept twice.
    // window.KT2_KCHN_SRC_OLD = true: as before.
    if (!window.KT2_KCHN_SRC_OLD && !Array.isArray(src)) src = [];
    let clean = (src || []).filter((s) => s && s.t && s.t !== host.id && (S.tracks || []).some((t) => t.id === s.t))
      .map((s) => { const c = Array.isArray(s.c) && s.c.length ? [...new Set(s.c)] : null;
                    return c && Array.isArray(s.k) && s.k.length ? { t: s.t, c, k: [...new Set(s.k)] } : { t: s.t, c }; });
    if (!window.KT2_KCHN_SRC_OLD) { const seen = new Set(); clean = clean.filter((s) => { const k = JSON.stringify(s); if (seen.has(k)) return false; seen.add(k); return true; }); }
    if (!clean.length) {
      const old = p.side && p.side.name; delete p.side;
      if (!woOld() && beat !== undefined) { if (beat && beat !== "1/4" && RHYTHMS.some((r) => r.id === beat)) p.beat = beat; else delete p.beat; }
      return { ok: true, name: null, was: old, beat: p.beat || "1/4" };
    }
    // fresh (REPLACE): a new name from the new pick unless it's the same sound as before (other users keep the old one)
    const same = p.side && JSON.stringify(expand(S, p.side.src).map((x) => x.t).sort()) === JSON.stringify(expand(S, clean).map((x) => x.t).sort());
    const keep = name || (fresh && !same ? autoName(S, clean) : null) || (p.side && p.side.name) || autoName(S, clean);
    // everyone on the same name follows the new pick (one sidechain, used in many places)
    for (const [q, h] of all) if (q === p || (q.side && q.side.name === keep)) {
      const mine = clean.filter((s) => s.t !== h.id);
      if (mine.length) q.side = { name: keep, src: JSON.parse(JSON.stringify(mine)) };
    }
    return { ok: true, name: keep };
  }

  // ------------------------------------------------------------------ the card picture
  // the card glows while this KILLCHAIN ducks; it goes still ~0.3 s after the last duck (or when play stops)
  const glowT = new WeakMap();
  // Eman, 16 Nov: "the title dont need to react, just the waveform": the card and logo stay still, only the picture
  // shows the ducking. window.KT2_KCHN_GLOW_OLD = the old glowing card + logo.
  function working(d, duck) {
    if (!window.KT2_KCHN_GLOW_OLD) return;
    const card = d.g && d.g.canvas && d.g.canvas.closest(".card");
    if (!card) return;
    clearTimeout(glowT.get(card));
    if (duck > 0) {
      card.classList.add("kchn-working"); card.style.setProperty("--kchn-duck", duck.toFixed(3));
      glowT.set(card, setTimeout(() => { card.classList.remove("kchn-working"); card.style.removeProperty("--kchn-duck"); }, 300));
    } else { card.classList.remove("kchn-working"); card.style.removeProperty("--kchn-duck"); }
  }
  if (window.FxView) FxView.register("killchain", {
    match: /ktside|killchain/i,
    draw(d) {
      const P = {}; for (const id of Object.keys(DEF)) P[id] = d.v(id, DEF[id]);
      const len = M.lenWhole(P.length) / SPAN, X = (u) => d.X(Math.min(1, u)), Y = (g) => d.Y(g * 0.94);
      // beat grid (sixteenths across half a bar), and the bottom line
      const xs = []; for (let i = 1; i < 8; i++) xs.push(d.X(i / 8));
      d.grid(xs, [Y(M.floor(P.amount))]);
      // the input: grey bars of what hit since the last trigger
      // playing: ui.transport (the live clock); ui.state.transport hardly ever says playing, so the live picture never
      // showed (16 Nov). KT2_KCHN_ALIVE_OFF = old check.
      const S0 = st(), T = typeof ui !== "undefined" && ui.transport;
      const L = (S0 && S0.transport && S0.transport.playing) || (!window.KT2_KCHN_ALIVE_OFF && T && T.playing) ? d.live : null;
      if (L && L.bins) {
        const n = L.bins.length, bw = (d.x1 - d.x0) / n;
        d.g.fillStyle = "rgba(200,200,215,0.28)";
        for (let i = 0; i < n; i++) {
          const v = Math.min(1, Math.sqrt(L.bins[i] || 0) * 1.2), hh = v * (d.y0 - d.y1) * 0.9;
          if (hh > 0.5) d.g.fillRect(d.x0 + i * bw + 0.5, (d.y0 + d.y1) / 2 - hh / 2, Math.max(1, bw - 1.5), hh);
        }
      } else {
        // not playing: a sketch of a kick so the picture reads
        d.g.fillStyle = "rgba(200,200,215,0.14)";
        const n = 64, bw = (d.x1 - d.x0) / n;
        for (let i = 0; i < n; i++) { const v = Math.exp(-i / 7) * (0.55 + 0.45 * d.noise(i)), hh = v * (d.y0 - d.y1) * 0.8; d.g.fillRect(d.x0 + i * bw + 0.5, (d.y0 + d.y1) / 2 - hh / 2, Math.max(1, bw - 1.5), hh); }
      }
      // the curve: what gets through
      const pts = [[d.x0, Y(1)], [d.x0 + 1.5, Y(M.floor(P.amount))]];
      for (let px = d.x0 + 2; px <= d.x1; px += 1.5) { const u = (px - d.x0) / (d.x1 - d.x0); pts.push([px, Y(M.curve(u / len, P))]); }
      d.fill(pts, d.y0, 0.14);
      d.line(pts, d.col, 2);
      // where it is right now
      const acid = getComputedStyle(document.documentElement).getPropertyValue("--acid").trim() || "#e4ff3a";
      // WORKING (Eman, 16 Nov: "it should animate showing that its active and working as you play, but only when its
      // working"): while it really pushes the sound down, the curve up to the playhead lights acid, a depth bar
      // on the left drops with the duck and the card + logo glow with it. Still when idle / not ducking.
      // window.KT2_KCHN_ALIVE_OFF = old (only the small dot).
      const duck = L ? 1 - Math.min(L.gMin != null ? L.gMin : 1, L.g != null ? L.g : 1) : 0;
      if (!window.KT2_KCHN_ALIVE_OFF) working(d, L && duck > 0.03 ? duck : 0);
      if (!window.KT2_KCHN_ALIVE_OFF && L && duck > 0.03 && L.ph != null) {
        const upto = Math.min(1, L.ph), lit = pts.filter(([px]) => (px - d.x0) / (d.x1 - d.x0) <= upto);
        if (lit.length > 1) {
          d.g.save(); d.g.shadowColor = acid; d.g.shadowBlur = 6 + 10 * duck;
          d.line(lit, acid, 2.5); d.g.restore();
        }
        const bh = (d.y0 - d.y1) * Math.min(1, duck / 0.98), bx = d.x0 - 1;
        d.g.fillStyle = acid; d.g.globalAlpha = 0.85; d.g.fillRect(bx, d.y1, 3, bh); d.g.globalAlpha = 1;
      }
      if (L && L.ph != null && L.ph < 1) d.dot(X(L.ph), Y(L.g), 3.5, acid);
      d.label(M.lenText(P.length), d.x1, d.y1 + 2, "right");
    },
    handles(d) {
      const P = {}; for (const id of Object.keys(DEF)) P[id] = d.v(id, DEF[id]);
      const ids = {}; for (const id of Object.keys(DEF)) ids[id] = d.id(id);
      const len = M.lenWhole(P.length) / SPAN, Y = (g) => d.Y(g * 0.94), fl = M.floor(P.amount);
      const hx = d.X(len * M.hold(P.hold)), ex = d.X(Math.min(1, len));
      const amountAt = (py) => (1 - Math.min(1, d.V(py) / 0.94)) / 0.98;
      const bendU = M.hold(P.hold) + (1 - M.hold(P.hold)) * 0.5;
      return [
        // the bottom: how much (up/down)
        { x: d.x0 + 4, y: Y(fl), label: () => "amount " + d.t(ids.amount), drag: (px, py) => ({ [ids.amount]: amountAt(py) }) },
        // the end of the bottom: how long it stays down (left/right) and how much (up/down)
        { x: Math.max(d.x0 + 18, hx), y: Y(fl), label: () => "hold " + d.t(ids.hold) + " \u00b7 " + d.t(ids.amount),
          drag: (px, py) => ({ [ids.hold]: ((px - d.x0) / (d.x1 - d.x0)) / Math.max(1e-3, len) / 0.6, [ids.amount]: amountAt(py) }) },
        // the bend: sharp (up) or soft (down)
        { x: d.X(len * bendU), y: Y(M.curve(bendU, P)), label: () => "shape " + d.t(ids.shape),
          drag: (px, py) => { const target = Math.min(0.999, Math.max(0.001, (d.V(py) / 0.94 - fl) / Math.max(0.02, 1 - fl)));
            // solve smoothstep(0.5)^k = target -> k = ln(target)/ln(0.5); shape from k
            const k = Math.log(target) / Math.log(0.5), v = Math.log2(Math.max(1e-3, k)) / 3.2 + 0.5; return { [ids.shape]: v }; } },
        // the end: how long, snapped to note values
        { x: ex, y: Y(1), label: () => "length " + d.t(ids.length),
          drag: (px) => { const w = Math.max(1 / 64, ((px - d.x0) / (d.x1 - d.x0)) * SPAN); let best = 0;
            NOTES.forEach(([n], i) => { if (Math.abs(Math.log(n / w)) < Math.abs(Math.log(NOTES[best][0] / w))) best = i; });
            return { [ids.length]: best / (NOTES.length - 1) }; } },
      ];
    },
  });

  // ------------------------------------------------------------------ the INPUT row on the card
  const st = () => (typeof ui !== "undefined" && ui.state) || null;
  const repickOld = () => !!window.KT2_KCHN_REPICK_OLD;
  let justSet = null;   // { id, t }: the INPUT row flashes right after OK
  function inputRow(clip, p) {
    const row = document.createElement("button");
    row.className = "card-key kchn-in" + (p.side ? "" : " kchn-none") + (justSet && justSet.id === p.id && Date.now() - justSet.t < 1500 ? " kchn-flash" : "");
    row.title = "What pushes it down";
    const a = document.createElement("span"); a.textContent = "INPUT";
    const b = document.createElement("b"); b.textContent = label(p);
    const c = document.createElement("span"); c.className = "caret"; c.textContent = "\u25be";
    row.append(a, b, c);
    row.onclick = (e) => {
      e.stopPropagation();
      const S = st(), mine = p.side && p.side.name;
      const others = inputs(S).filter((x) => x.name !== mine);
      const what = (x) => expand(S, x.src).map((s) => { const t = S.tracks.find((y) => y.id === s.t); return t ? t.name + (s.c ? " \u00b7 " + s.c.length + (s.c.length > 1 ? " clips" : " clip") : "") : "?"; }).join(", ");
      showMenu(row, [
        // REPLACE (Eman, 16 Nov): starts from nothing picked and the input gets the new sound's name, so it's clear it
        // took (PICK AGAIN kept the old picks + old name, so a new kick loop looked like it never went in).
        // KT2_KCHN_REPICK_OLD = PICK AGAIN as before.
        { label: p.side ? (repickOld() ? "PICK AGAIN" : "REPLACE") : "PICK ON THE GRID", meta: "click / drag", run: () => startPick(p, { fresh: !!p.side && !repickOld() }) },
        ...(others.length ? [{ sep: true }, { heading: "SIDECHAINS" }, ...others.map((x) => ({ label: x.name, meta: what(x), run: () => run("setSideInput", { pluginId: p.id, use: x.name }) }))] : []),
        { sep: true },
        ...(woOld() ? [{ label: "BEAT \u00b7 1/4", meta: "no input", on: !p.side, run: () => run("setSideInput", { pluginId: p.id, src: [] }) }]
          : [{ heading: "W/O INPUT" }, ...RHYTHMS.map((r) => ({ label: r.name, meta: r.about, on: !p.side && beatOf(p).id === r.id,
              run: () => Promise.resolve(run("setSideInput", { pluginId: p.id, src: [], beat: r.id })).then(() => {
                // the card is not rebuilt for this, so the INPUT row shows the new rhythm here
                const me = plugins(st()).find(([q]) => q.id === p.id), bb = row.querySelector("b");
                if (me && bb) bb.textContent = label(me[0]);
                row.classList.toggle("kchn-none", !(me && me[0].side));
              }).catch(() => null) }))]),
      ]);
    };
    return row;
  }

  // ------------------------------------------------------------------ SHAPES row (Eman, 16 Nov)
  // "a new menu with the core different shapes, fast click, like graphs": small curve pictures under the big one,
  // one click sets amount / length / shape / hold (sense stays). The INPUT picker moves up into the name bar.
  // window.KT2_KCHN_LAYOUT_OLD = old layout (INPUT row under the name, no shapes row).
  const layoutOld = () => !!window.KT2_KCHN_LAYOUT_OLD;
  const SHAPES = [
    { name: "CLASSIC", v: { amount: 0.8, length: 4 / 6, shape: 0.5, hold: 0.12 } },
    { name: "SNAP", v: { amount: 0.9, length: 2 / 6, shape: 0.2, hold: 0.05 } },
    { name: "PUMP", v: { amount: 1, length: 5 / 6, shape: 0.72, hold: 0.2 } },
    { name: "SOFT", v: { amount: 0.5, length: 4 / 6, shape: 0.85, hold: 0 } },
    { name: "CHOP", v: { amount: 1, length: 3 / 6, shape: 0.05, hold: 1 } },
    { name: "SWELL", v: { amount: 0.9, length: 1, shape: 0.9, hold: 0.05 } },
  ];
  const near = (vals, v) => Object.keys(v).every((k) => Math.abs((vals[k] != null ? vals[k] : DEF[k]) - v[k]) < 0.02);
  function shapeRow(clip, p) {
    const row = document.createElement("div");
    row.className = "kchn-shapes";
    const vals = valuesOf(p);
    for (const sh of SHAPES) {
      const b = document.createElement("button");
      b.className = "kchn-shape" + (near(vals, sh.v) ? " on" : "");
      b.title = sh.name;
      const W = 44, H = 18, NS = "http://www.w3.org/2000/svg";
      const P = { ...DEF, ...sh.v }, len = M.lenWhole(P.length) / SPAN, pts = [];
      for (let i = 0; i <= 40; i++) { const u = i / 40, x = u < len ? M.curve(u / len, P) : 1; pts.push((1 + u * (W - 2)).toFixed(1) + "," + (1 + (1 - x) * (H - 2)).toFixed(1)); }
      const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("aria-hidden", "true");
      const area = document.createElementNS(NS, "polygon"); area.setAttribute("points", `1,${H - 1} ` + pts.join(" ") + ` ${W - 1},${H - 1}`); area.setAttribute("class", "a");
      const line = document.createElementNS(NS, "polyline"); line.setAttribute("points", pts.join(" ")); line.setAttribute("class", "l");
      svg.append(area, line);
      b.append(svg);
      b.onclick = async (e) => {
        e.stopPropagation();
        row.querySelectorAll(".kchn-shape").forEach((x) => x.classList.toggle("on", x === b));
        let first = true;
        for (const [id, value] of Object.entries(sh.v)) { await run("setParam", { pluginId: p.id, paramId: id, value, ...(first ? {} : { drag: true }) }); first = false; }
      };
      row.append(b);
    }
    return row;
  }

  // ------------------------------------------------------------------ GHOST sidechain
  // GHOST (Eman, 16 Nov: "the sidechain will react to muted patterns as well. So i can add a pattern with a kick,
  // mute it, and then select the ghost, and the synth will still trigger on it"). The ghost button next to the logo:
  // grey = only what you hear pushes it down (a muted lane or a muted pattern doesn't), acid = muted ones do too.
  // Saved on the plugin (p.ghost) in the project. window.KT2_KCHN_GHOST_OFF = old (no button; a muted lane still
  // pushes it down, a muted pattern doesn't).
  const ghostOff = () => !!window.KT2_KCHN_GHOST_OFF;
  const ghostOn = (p) => !ghostOff() && !!(p && p.ghost);
  // traced from Eman's second ghost picture (16 Nov, mirrored), the eyes drawn bigger so they show at 18 px
  const GHOST_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="' +
    'M1.0 6.9C1.1 6.5 1.2 6.0 1.2 5.8C1.3 5.5 1.3 5.4 1.5 5.1C1.6 4.8 1.8 4.4 2.0 4.2C2.2 3.9 2.5 3.8 2.7 3.7C2.9 3.5 3.0 3.5' +
    ' 3.2 3.5C3.4 3.5 3.4 3.3 3.9 3.6C4.4 3.8 5.9 4.5 6.4 4.8C7.0 5.0 7.0 4.9 7.2 5.0C7.4 5.0 7.6 5.0 7.8 4.9C8.0 4.9 8.1 4.8' +
    ' 8.3 4.7C8.5 4.6 8.5 4.7 8.8 4.3C9.1 3.9 9.9 2.8 10.2 2.4C10.5 2.0 10.5 1.9 10.7 1.8C10.9 1.6 11.0 1.5 11.2 1.4C11.4 1.3' +
    ' 11.5 1.3 11.7 1.3C12.0 1.3 12.4 1.3 12.7 1.3C13.0 1.4 13.2 1.5 13.4 1.8C13.7 2.0 14.0 2.3 14.2 2.8C14.5 3.3 14.9 4.3 15' +
    '.1 4.6C15.3 5.0 15.3 4.8 15.4 4.9C15.6 5.0 15.7 5.1 15.9 5.1C16.1 5.2 16.3 5.2 16.5 5.2C16.7 5.2 16.6 5.3 17.2 5.1C17.8 ' +
    '4.9 19.5 4.2 20.1 4.0C20.7 3.8 20.5 3.9 20.7 3.9C20.9 3.9 20.9 3.8 21.1 3.9C21.3 4.0 21.6 4.2 21.8 4.4C22.0 4.6 22.2 4.8' +
    ' 22.4 5.1C22.5 5.4 22.6 5.6 22.7 5.9C22.8 6.2 22.9 6.5 22.9 6.9C22.9 7.4 23.0 8.1 23.0 8.6C23.0 9.1 22.9 9.4 22.9 9.8C22' +
    '.8 10.2 22.7 10.6 22.6 11.0C22.4 11.3 22.3 11.7 22.1 12.2C21.9 12.6 21.6 13.2 21.2 13.7C20.9 14.2 20.7 14.5 20.2 15.0C19' +
    '.8 15.5 18.9 16.3 18.5 16.6C18.1 16.9 18.2 16.8 18.0 16.9C17.8 17.0 17.4 17.1 17.2 17.2C17.0 17.2 17.0 17.1 16.9 17.0C16' +
    '.9 16.9 16.7 17.1 16.9 16.7C17.1 16.2 17.8 15.0 18.1 14.3C18.3 13.5 18.5 12.5 18.6 12.1C18.7 11.6 18.6 11.8 18.5 11.7C18' +
    '.5 11.7 18.4 11.6 18.3 11.6C18.2 11.6 18.0 11.6 17.9 11.7C17.7 11.7 17.6 11.8 17.4 12.0C17.2 12.1 16.9 12.3 16.8 12.3C16' +
    '.6 12.4 16.5 12.4 16.4 12.4C16.2 12.3 16.1 12.3 16.0 12.1C15.9 11.9 15.8 11.5 15.7 11.4C15.6 11.2 15.6 11.1 15.5 11.0C15' +
    '.4 10.9 15.2 10.9 15.1 10.9C15.0 10.9 14.9 10.9 14.8 11.1C14.7 11.2 14.7 10.9 14.6 11.7C14.4 12.4 14.2 14.6 14.0 15.7C13' +
    '.7 16.8 13.4 17.6 13.2 18.3C13.0 19.0 12.9 19.2 12.7 19.7C12.5 20.1 12.3 20.5 12.1 20.9C11.8 21.3 11.5 21.7 11.2 22.0C10' +
    '.9 22.3 10.6 22.5 10.4 22.6C10.2 22.7 10.1 22.7 9.9 22.8C9.8 22.8 9.7 22.8 9.6 22.7C9.5 22.7 9.4 22.6 9.4 22.5C9.3 22.4 ' +
    '9.2 22.9 9.3 22.2C9.4 21.5 9.9 19.5 10.0 18.4C10.1 17.2 10.0 16.1 10.0 15.3C10.0 14.4 9.9 13.9 9.8 13.3C9.6 12.7 9.3 11.' +
    '9 9.1 11.5C8.9 11.1 8.8 11.1 8.7 11.0C8.6 10.8 8.4 10.8 8.3 10.9C8.2 10.9 8.2 10.9 8.0 11.1C7.9 11.2 7.7 11.8 7.5 12.0C7' +
    '.4 12.2 7.2 12.2 7.0 12.2C6.9 12.2 6.8 12.2 6.6 12.0C6.4 11.9 5.9 11.5 5.7 11.4C5.5 11.2 5.4 11.3 5.4 11.3C5.3 11.4 5.2 ' +
    '11.3 5.1 11.5C5.1 11.6 5.0 11.8 5.0 12.1C5.0 12.3 5.0 12.6 5.2 13.0C5.3 13.4 5.5 14.1 5.8 14.6C6.0 15.2 6.4 16.0 6.5 16.' +
    '4C6.6 16.7 6.5 16.6 6.4 16.6C6.4 16.7 6.4 16.7 6.2 16.7C6.0 16.6 5.5 16.5 5.3 16.3C5.0 16.2 4.8 16.0 4.6 15.9C4.4 15.7 4' +
    '.3 15.6 4.0 15.3C3.8 15.0 3.3 14.4 3.0 14.0C2.7 13.5 2.3 12.8 2.1 12.4C1.9 12.0 1.9 11.9 1.7 11.4C1.6 11.0 1.3 10.1 1.2 ' +
    '9.5C1.1 8.9 1.0 8.4 1.0 8.0C1.0 7.5 1.0 7.2 1.0 6.9ZM12.3 5.4C12.2 5.3 12.1 5.1 12.1 4.9C12.1 4.8 12.2 4.5 12.3 4.3C12.4' +
    ' 4.1 12.6 3.9 12.7 3.7C12.9 3.5 13.1 3.4 13.3 3.3C13.5 3.2 13.7 3.1 13.9 3.1C14.1 3.1 14.2 3.1 14.3 3.2C14.4 3.3 14.5 3.' +
    '5 14.5 3.6C14.5 3.8 14.4 4.0 14.3 4.2C14.2 4.4 14.1 4.7 13.9 4.8C13.7 5.0 13.5 5.2 13.3 5.3C13.1 5.4 12.9 5.5 12.7 5.5C1' +
    '2.6 5.5 12.4 5.4 12.3 5.4ZM9.6 3.3C9.7 3.2 9.8 3.2 10.0 3.2C10.2 3.2 10.4 3.2 10.6 3.3C10.8 3.4 11.0 3.6 11.2 3.7C11.4 3' +
    '.9 11.6 4.1 11.7 4.3C11.8 4.5 11.9 4.7 11.9 4.9C11.9 5.0 11.9 5.2 11.8 5.3C11.7 5.4 11.5 5.5 11.4 5.5C11.2 5.5 11.0 5.4 ' +
    '10.7 5.3C10.5 5.2 10.3 5.1 10.1 4.9C9.9 4.8 9.8 4.5 9.6 4.4C9.5 4.2 9.5 3.9 9.4 3.8C9.4 3.6 9.5 3.4 9.6 3.3Z' +
    '"/></svg>';
  function ghostBtn(p) {
    const b = document.createElement("button");
    b.className = "kchn-ghost" + (p.ghost ? " on" : "");
    b.innerHTML = GHOST_SVG;
    b.title = p.ghost ? "GHOST on: muted patterns push it down too" : "GHOST: let muted patterns push it down too";
    b.setAttribute("aria-pressed", p.ghost ? "true" : "false");
    b.onclick = (e) => {
      e.stopPropagation();
      const on = !b.classList.contains("on");
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      b.title = on ? "GHOST on: muted patterns push it down too" : "GHOST: let muted patterns push it down too";
      run("setSideGhost", { pluginId: p.id, on });
    };
    b.ondblclick = (e) => e.stopPropagation();
    return b;
  }
  // the demo backend's command (ui/app.js): GHOST on / off for one KILLCHAIN
  function setGhost(S, { pluginId, on }) {
    const me = plugins(S).find(([p]) => p.id === pluginId);
    if (!me) return { error: "That KILLCHAIN isn't there any more." };
    if (on) me[0].ghost = true; else delete me[0].ghost;
    return { ok: true, ghost: !!on };
  }

  // ------------------------------------------------------------------ pick mode on the grid
  let pick = null;   // { pluginId, host, sel: Map(trackId -> Set(clipIds) | "all"), bar, band }
  const rows = () => document.getElementById("rows");
  function startPick(p, opts) {
    const S = st(); if (!S) return;
    endPick();
    const host = hostOf(S, p.id), fresh = !!(opts && opts.fresh);
    const sel = new Map();
    if (!fresh) for (const s of expand(S, p.side && p.side.src, host && host.id)) sel.set(s.t, s.c ? new Set(s.c) : "all");
    const bar = document.createElement("div");
    bar.className = "kchn-bar";
    bar.innerHTML = `<img src="killchain-logo.png" alt="KILLCHAIN"><span class="kchn-what">PICK INPUT</span><b class="kchn-n"></b>` +
      `<button class="kchn-cancel">CANCEL</button><button class="kchn-ok">OK</button>`;
    document.body.append(bar);
    bar.querySelector(".kchn-cancel").onclick = (e) => { e.stopPropagation(); endPick(); };
    bar.querySelector(".kchn-ok").onclick = (e) => { e.stopPropagation(); okPick(); };
    pick = { pluginId: p.id, host: host && host.id, sel, bar, band: null, fresh };
    document.documentElement.classList.add("kchn-picking");
    for (const [t, f] of HOOKS) document.addEventListener(t, f, true);
    paint();
  }
  function endPick() {
    if (!pick) return;
    for (const [t, f] of HOOKS) document.removeEventListener(t, f, true);
    pick.bar.remove(); if (pick.band) pick.band.remove();
    document.querySelectorAll(".kchn-pick, .kchn-host, .kchn-lane").forEach((e) => e.classList.remove("kchn-pick", "kchn-host", "kchn-lane"));
    document.documentElement.classList.remove("kchn-picking");
    pick = null;
  }
  function okPick() {
    if (!pick) return;
    const S = st();
    const src = [...pick.sel].map(([t, c]) => {
      if (c === "all") return { t, c: null };
      const s = { t, c: [...c] }, tr = !patOld() && S && S.tracks.find((x) => x.id === t);
      if (tr) s.k = [...new Set(tr.clips.filter((x) => c.has(x.id)).map(keyOf))];
      return s;
    }).filter((s) => s.c === null || s.c.length);
    const id = pick.pluginId, fresh = pick.fresh;
    endPick();
    // it took (Eman, 16 Nov: "make it clear that you pressed ok with a sound effect"): a little lift + the INPUT flashes
    // acid. KT2_KCHN_OK_OLD = silent.
    if (!window.KT2_KCHN_OK_OLD) { justSet = { id, t: Date.now() }; try { if (window.KT2Juice && KT2Juice.sound && KT2Juice.sound.ok) KT2Juice.sound.ok(); } catch (e) { /* sound off */ } }
    const r = run("setSideInput", { pluginId: id, src, ...(fresh ? { fresh: true } : {}) });
    if (!window.KT2_KCHN_OK_OLD) Promise.resolve(r).then(() => {
      const row = document.querySelector(`#cards .card[data-plugin="${id}"] .kchn-in`), me = plugins(st()).find(([q]) => q.id === id);
      if (!row) return;
      const b = row.querySelector("b"); if (b && me) b.textContent = label(me[0]);
      row.classList.toggle("kchn-none", !(me && me[0].side));
      row.classList.remove("kchn-flash"); void row.offsetWidth; row.classList.add("kchn-flash");
      setTimeout(() => row.classList.remove("kchn-flash"), 1200);
    }).catch(() => null);
  }
  const count = () => {
    let n = 0; const S = st(), K = new Set();
    for (const [t, v] of pick.sel) {
      if (v === "all") { n++; continue; }
      if (patOld() || !S) { n += v.size; continue; }
      const tr = S.tracks.find((x) => x.id === t);
      for (const c of (tr && tr.clips) || []) if (v.has(c.id)) K.add(keyOf(c));
    }
    return n + K.size;   // one pattern = 1, however many copies it has
  };
  // every copy of this clip's pattern / sound (outside the host lane): [[trackId, clipId]]
  function mates(tid, cid) {
    const S = st(), t = S && S.tracks.find((x) => x.id === tid), c = t && t.clips.find((x) => x.id === cid);
    if (patOld() || !c) return [[tid, cid]];
    const k = keyOf(c), out = [];
    for (const tr of S.tracks) if (tr.id !== pick.host) for (const x of tr.clips || []) if (keyOf(x) === k) out.push([tr.id, x.id]);
    return out.length ? out : [[tid, cid]];
  }
  function setClip(tid, cid, on) {
    let v = pick.sel.get(tid);
    if (v === "all") { if (on) return; const t = st().tracks.find((x) => x.id === tid); v = new Set(t.clips.map((c) => c.id)); }
    v = v instanceof Set ? v : new Set();
    if (on) v.add(cid); else v.delete(cid);
    if (v.size) pick.sel.set(tid, v); else pick.sel.delete(tid);
  }
  // A clip can sit on another lane's row (free rows: setClipRow), so the row it shows on is not always its lane.
  // Pick by the clip's real lane (Eman, 16 Nov: a kick loop on another row went in as "NEW PATTERN SC" and did
  // nothing). KT2_KCHN_ROWS_OLD = the row's lane, as before.
  const ownerOf = (cid, rowTid) => {
    if (window.KT2_KCHN_ROWS_OLD) return rowTid;
    const S = st();
    for (const t of (S && S.tracks) || []) if ((t.clips || []).some((c) => c.id === cid)) return t.id;
    return rowTid;
  };
  function paint() {
    if (!pick) return;
    const S = st();
    document.querySelectorAll("#rows .row[data-track-id]").forEach((r) => {
      const tid = r.dataset.trackId, v = pick.sel.get(tid);
      r.classList.toggle("kchn-host", tid === pick.host);
      r.classList.toggle("kchn-lane", v === "all");
      r.querySelectorAll(".clip[data-clip-id]").forEach((c) => { const w = pick.sel.get(ownerOf(c.dataset.clipId, tid));
        c.classList.toggle("kchn-pick", w === "all" || (w instanceof Set && w.has(c.dataset.clipId))); });
    });
    const n = count();
    pick.bar.querySelector(".kchn-n").textContent = n ? String(n) : "";
    pick.bar.querySelector(".kchn-ok").disabled = false;
    if (S) requestAnimationFrame(() => pick && paintSoon());
  }
  let paintT = 0;
  const paintSoon = () => { clearTimeout(paintT); paintT = setTimeout(paint, 250); };   // the grid re-renders: keep the marks on
  function toggleClip(tid, cid) {
    if (!patOld()) {
      const v = pick.sel.get(tid), on = !(v === "all" || (v instanceof Set && v.has(cid)));
      for (const [t, c] of mates(tid, cid)) setClip(t, c, on);
      return;
    }
    let v = pick.sel.get(tid);
    if (v === "all") { const t = st().tracks.find((x) => x.id === tid); v = new Set(t.clips.map((c) => c.id)); }
    v = v instanceof Set ? v : new Set();
    if (v.has(cid)) v.delete(cid); else v.add(cid);
    if (v.size) pick.sel.set(tid, v); else pick.sel.delete(tid);
  }
  function toggleLane(tid) { if (pick.sel.get(tid) === "all") pick.sel.delete(tid); else pick.sel.set(tid, "all"); }
  const eat = (e) => { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); };
  function down(e) {
    if (!pick || e.button !== 0) return;
    if (e.target.closest(".kchn-bar")) return;
    const R = rows();
    if (!R || !R.contains(e.target)) {
      // anywhere else: leave the app alone, except the empty space below the lanes (part of the grid)
      const sc = document.getElementById("scroll");
      if (!sc || !sc.contains(e.target)) return;
    }
    eat(e);
    const clip = e.target.closest(".clip[data-clip-id]"), row = e.target.closest(".row[data-track-id]");
    const tid = row && row.dataset.trackId;
    const x0 = e.clientX, y0 = e.clientY;
    let band = null;
    const move = (ev) => {
      eat(ev);
      if (!band && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      if (!band) { band = pick.band = document.createElement("div"); band.className = "kchn-band"; document.body.append(band); }
      const l = Math.min(x0, ev.clientX), t = Math.min(y0, ev.clientY);
      Object.assign(band.style, { left: l + "px", top: t + "px", width: Math.abs(ev.clientX - x0) + "px", height: Math.abs(ev.clientY - y0) + "px" });
    };
    const up = (ev) => {
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      eat(ev);
      if (!pick) return;
      if (band) {
        const b = band.getBoundingClientRect();
        band.remove(); pick.band = null;
        // every clip the box touches is added (Shift-free: a drag only adds)
        document.querySelectorAll("#rows .row[data-track-id]").forEach((r) => {
          r.querySelectorAll(".clip[data-clip-id]").forEach((c) => {
            const q = c.getBoundingClientRect(), own = ownerOf(c.dataset.clipId, r.dataset.trackId);
            if (own === pick.host) return;
            if (q.right < b.left || q.left > b.right || q.bottom < b.top || q.top > b.bottom) return;
            if (!patOld()) { for (const [t2, c2] of mates(own, c.dataset.clipId)) setClip(t2, c2, true); return; }
            let v = pick.sel.get(own);
            if (v === "all") return;
            v = v instanceof Set ? v : new Set(); v.add(c.dataset.clipId); pick.sel.set(own, v);
          });
        });
      } else if (clip && tid) {
        const own = ownerOf(clip.dataset.clipId, tid);
        if (own !== pick.host) toggleClip(own, clip.dataset.clipId);
      } else if (tid && tid !== pick.host) toggleLane(tid);
      paint();
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
  }
  const swallow = (e) => {
    if (!pick || e.target.closest(".kchn-bar")) return;
    const R = document.getElementById("scroll");
    if (R && R.contains(e.target)) eat(e);
  };
  const key = (e) => {
    if (!pick) return;
    if (e.key === "Escape") { eat(e); endPick(); }
    else if (e.key === "Enter") { eat(e); okPick(); }
  };
  const HOOKS = [["pointerdown", down], ["mousedown", swallow], ["click", swallow], ["dblclick", swallow], ["contextmenu", swallow], ["keydown", key]];

  // styles
  const css = document.createElement("style");
  css.textContent = `
  .kchn-bar { position: fixed; z-index: 9000; left: 50%; top: 64px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
    background: #17171b; border: 1px solid var(--acid, #e4ff3a); padding: 6px 8px 6px 12px; box-shadow: 0 8px 30px rgba(0,0,0,.5); font: 600 11px/1 var(--font, system-ui); letter-spacing: .12em; color: #fff; }
  .kchn-bar img { height: 22px; display: block; }
  .kchn-bar .kchn-n { min-width: 18px; text-align: center; color: #111; background: var(--acid, #e4ff3a); padding: 3px 5px; }
  .kchn-bar .kchn-n:empty { display: none; }
  .kchn-bar button { font: inherit; letter-spacing: inherit; border: 0; padding: 7px 12px; cursor: pointer; background: #2a2a31; color: #ddd; }
  .kchn-bar .kchn-ok { background: var(--acid, #e4ff3a); color: #111; }
  .kchn-picking #rows .clip { cursor: pointer !important; }
  .kchn-picking #rows .row:not(.kchn-host) { cursor: crosshair; }
  .kchn-picking #rows .row.kchn-host { opacity: .35; }
  .kchn-picking #rows .clip.kchn-pick { outline: 2px solid var(--acid, #e4ff3a); outline-offset: -2px; box-shadow: 0 0 14px rgba(228,255,58,.45); }
  .kchn-picking #rows .row.kchn-lane { box-shadow: inset 3px 0 0 var(--acid, #e4ff3a); background: rgba(228,255,58,.05); }
  .kchn-band { position: fixed; z-index: 8999; border: 1px solid var(--acid, #e4ff3a); background: rgba(228,255,58,.08); pointer-events: none; }
  #cards .card.kchn-card, .kt2.k2-fxbar #cards .card.kchn-card:not(.add) { flex: 0 1 400px; width: 400px; min-width: 250px; }
  .card .kchn-logo { height: 24px; margin: -4px 0; display: block; margin-right: auto; filter: drop-shadow(0 0 1px rgba(0,0,0,.6)); }
  .card.kchn-working { box-shadow: inset 0 0 0 1px rgba(228,255,58,calc(.25 + .6 * var(--kchn-duck, 0))), 0 0 calc(6px + 18px * var(--kchn-duck, 0)) rgba(228,255,58,calc(.35 * var(--kchn-duck, 0))); }
  .card.kchn-working .kchn-logo { filter: drop-shadow(0 0 calc(2px + 8px * var(--kchn-duck, 0)) var(--acid, #e4ff3a)); transform: scale(calc(1 + .06 * var(--kchn-duck, 0))); transform-origin: left center; }
  .card .card-head .kchn-in.kchn-top { flex: 0 1 auto; min-width: 0; margin: -3px 0 -3px 6px; padding: 2px 6px; max-width: 55%; }
  .card .card-head .kchn-in.kchn-top b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card .card-head .kchn-in.kchn-top + .card-tag { display: none; }
  .card .kchn-shapes { display: flex; gap: 6px; margin: 6px 0 2px; }
  .card .kchn-shape { flex: 1 1 0; min-width: 0; height: 24px; padding: 2px 3px; border: 0; background: rgba(255,255,255,.05); cursor: pointer; display: block; }
  .card .kchn-shape svg { width: 100%; height: 100%; display: block; }
  .card .kchn-shape .a { fill: rgba(139,92,246,.22); stroke: none; }
  .card .kchn-shape .l { fill: none; stroke: #8b6cf6; stroke-width: 1.6; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .card .kchn-shape:hover { background: rgba(255,255,255,.1); }
  .card .kchn-shape.on { background: rgba(228,255,58,.1); box-shadow: inset 0 0 0 1px rgba(228,255,58,.6); }
  .card .kchn-shape.on .l { stroke: var(--acid, #e4ff3a); }
  .card .kchn-shape.on .a { fill: rgba(228,255,58,.12); }
  .card .card-name.kchn-hasghost { display: flex; align-items: center; gap: 8px; overflow: visible; }
  .card .card-name.kchn-hasghost .kchn-logo { margin-right: 0; }
  .card .kchn-ghost { flex: none; width: 18px; height: 18px; padding: 0; margin: -1px 0; overflow: visible; border: 0; background: none; cursor: pointer; color: #8a8a93; display: block; }
  .card .kchn-ghost svg { width: 100%; height: 100%; display: block; overflow: visible; }
  .card .kchn-ghost:hover { color: #c4c4cc; }
  .card .kchn-ghost.on { color: var(--acid, #e4ff3a); filter: drop-shadow(0 0 2px rgba(228,255,58,.35)); }
  @keyframes kchnFlash { 0% { background: rgba(228,255,58,.55); box-shadow: 0 0 14px rgba(228,255,58,.6); } 100% { background: transparent; box-shadow: none; } }
  .card .card-key.kchn-in.kchn-flash { animation: kchnFlash 1s ease-out; }
  .card .card-key.kchn-in.kchn-flash b { color: var(--acid, #e4ff3a); }
  .card .card-key.kchn-in.kchn-none b { color: var(--ink-3, #888); }
  `;
  document.head.append(css);

  window.KillChain = { RHYTHMS, beatOf, beatPat, M, DEF, NOTES, text, params, valuesOf, load, create, inputs, autoName, label, setInput, keyOf, expand, inputRow, startPick, endPick, okPick, ghostBtn, setGhost, ghostOn, ghostOff, shapeRow, layoutOld, SHAPES,
                       get picking() { return pick; } };
})();
