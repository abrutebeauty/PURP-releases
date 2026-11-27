// KILLTIME (Eman, 16 Nov: "make actually one plugin like the Timeless by fabfilter, with a Delay that can really make
// interesting things"). Our own creative delay: the way it behaves is inspired by tape-style creative delays,
// the name, look and code are KILLTOY's own.
//
// What it does: a left and a right echo locked to the song tempo (the right one can sit later for width), echoes
// that bounce side to side (PING PONG), a filter INSIDE the feedback (each repeat gets darker / thinner), drive inside
// the feedback (repeats get dirtier and bloom, and past 100% feedback it sings without blowing up), tape wow and
// flutter (MOD), DIFFUSE (repeats smear into a reverb-like wash), DUCK (echoes get out of the way while you sing).
// Three styles: TAPE (changing the time bends the pitch like a tape machine), DIGITAL (clean, the time jumps) and
// REVERSE (every echo plays backwards). FREEZE holds what's in the delay and loops it forever.
//
// Hooks: kt2-corefx.js loads KillTime.WORKLET with its own audio code and asks KillTime.FX / KillTime.views, so it
// shows in ADD AN EFFECT (SPACE), plays in the playground, and draws a picture you drag. Flag: window.KT2_KILLTIME_OFF
// = not in ADD AN EFFECT (saved projects still play it).
(function () {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const prm = (id, name, value, text) => ({ id, name, value, text, def: value });
  const logMap = (v, lo, hi) => lo * Math.pow(hi / lo, clamp(v, 0, 1));
  const step = (v, n) => Math.round(clamp(v, 0, 1) * (n - 1));
  const pct = (v) => Math.round(v * 100) + "%";
  const fHz = (f) => (f >= 1000 ? (f / 1000).toFixed(f >= 9950 ? 0 : 1) + " kHz" : Math.round(f) + " Hz");
  // note values, shortest first, in beats (a quarter note = 1)
  const NOTES = [[1 / 16, "1/64"], [1 / 12, "1/32 T"], [1 / 8, "1/32"], [1 / 6, "1/16 T"], [1 / 4, "1/16"], [1 / 3, "1/8 T"], [3 / 8, "1/16 D"], [1 / 2, "1/8"],
    [2 / 3, "1/4 T"], [3 / 4, "1/8 D"], [1, "1/4"], [4 / 3, "1/2 T"], [3 / 2, "1/4 D"], [2, "1/2"], [3, "1/2 D"], [4, "1 bar"]];
  const STYLES = ["TAPE", "DIGITAL", "REVERSE"];
  const noteOf = (v) => NOTES[step(v, NOTES.length)];
  const secs = (v, bpm) => noteOf(v)[0] * 60 / (bpm || 120);

  const WORKLET = `registerProcessor("kt-time", class extends AudioWorkletProcessor {
    static get parameterDescriptors() { return [
      { name: "tl", defaultValue: 0.375 }, { name: "tr", defaultValue: 0.375 }, { name: "fb", defaultValue: 0.45 }, { name: "pp", defaultValue: 0.5 },
      { name: "lp", defaultValue: 7000 }, { name: "hp", defaultValue: 120 }, { name: "drive", defaultValue: 0.2 }, { name: "mod", defaultValue: 0.25 },
      { name: "diffuse", defaultValue: 0 }, { name: "duck", defaultValue: 0 }, { name: "mix", defaultValue: 0.3 }, { name: "style", defaultValue: 0 }, { name: "freeze", defaultValue: 0 }]; }
    constructor() {
      super();
      this.N = Math.ceil(sampleRate * 6.4);
      this.b = [new Float32Array(this.N), new Float32Array(this.N)];
      this.w = 0; this.d = [-1, -1]; this.rp = [0, 0];
      this.lpz = [[0, 0, 0, 0], [0, 0, 0, 0]]; this.hpz = [[0, 0, 0, 0], [0, 0, 0, 0]]; this.lk = null; this.hk = null; this.lf = 0; this.hf = 0;
      this.wow = 0; this.fl = 0; this.nz = 0; this.nzs = 0; this.env = 0;
      const k = sampleRate / 44100;
      this.apL = [[Math.round(142 * k), new Float32Array(Math.round(142 * k) + 1), 0], [Math.round(379 * k), new Float32Array(Math.round(379 * k) + 1), 0]];
      this.apR = [[Math.round(157 * k), new Float32Array(Math.round(157 * k) + 1), 0], [Math.round(401 * k), new Float32Array(Math.round(401 * k) + 1), 0]];
      this.fz = 0;
    }
    bq(type, f) { const w = 2 * Math.PI * Math.min(f, sampleRate * 0.45) / sampleRate, cs = Math.cos(w), al = Math.sin(w) / (2 * 0.8), a0 = 1 + al;
      return type ? [(1 + cs) / 2 / a0, -(1 + cs) / a0, (1 + cs) / 2 / a0, -2 * cs / a0, (1 - al) / a0] : [(1 - cs) / 2 / a0, (1 - cs) / a0, (1 - cs) / 2 / a0, -2 * cs / a0, (1 - al) / a0]; }
    run(k, z, x) { const o = k[0] * x + k[1] * z[0] + k[2] * z[1] - k[3] * z[2] - k[4] * z[3]; z[1] = z[0]; z[0] = x; z[3] = z[2]; z[2] = o; return o; }
    read(b, dl) { const N = this.N; dl = Math.max(1, Math.min(N - 4, dl)); const pos = this.w - dl; let i = Math.floor(pos); const f = pos - i; i = ((i % N) + N) % N;
      const y0 = b[(i - 1 + N) % N], y1 = b[i], y2 = b[(i + 1) % N], y3 = b[(i + 2) % N];
      return y1 + 0.5 * f * (y2 - y0 + f * (2 * y0 - 5 * y1 + 4 * y2 - y3 + f * (3 * (y1 - y2) + y3 - y0))); }
    ap(st, x, g) { const [n, buf] = st; const idx = st[2]; const del = buf[idx]; const y = -g * x + del; buf[idx] = x + g * y; st[2] = (idx + 1) % (n + 1); return y; }
    process(ins, outs, P) {
      const x = ins[0], y = outs[0]; if (!y || !y.length) return true;
      const n = y[0].length, sr = sampleRate, N = this.N;
      if (P.lp[0] !== this.lf) { this.lf = P.lp[0]; this.lk = this.bq(0, this.lf); }
      if (P.hp[0] !== this.hf) { this.hf = P.hp[0]; this.hk = this.bq(1, this.hf); }
      const style = Math.round(P.style[0]), fb = P.fb[0], pp = P.pp[0], drive = P.drive[0], mod = P.mod[0], dif = P.diffuse[0] * 0.68, duck = P.duck[0], mix = P.mix[0];
      const frz = P.freeze[0] > 0.5;
      const glide = style === 0 ? Math.exp(-1 / (0.22 * sr)) : Math.exp(-1 / (0.004 * sr));
      const g = 1 + drive * 14, gn = (1 + drive * 0.6) / g;
      const dryG = mix < 0.5 ? 1 : 2 * (1 - mix), wetG = mix < 0.5 ? 2 * mix : 1;
      const ea = Math.exp(-1 / (0.005 * sr)), er = Math.exp(-1 / (0.3 * sr));
      const tgt = [P.tl[0] * sr, P.tr[0] * sr];
      if (style === 2) { tgt[0] = Math.min(tgt[0], N / 2 - 64); tgt[1] = Math.min(tgt[1], N / 2 - 64); }
      for (let c = 0; c < 2; c++) if (this.d[c] < 0) this.d[c] = tgt[c];
      for (let i = 0; i < n; i++) {
        const xl = x && x.length ? x[0][i] : 0, xr = x && x.length ? x[Math.min(1, x.length - 1)][i] : 0;
        // the freeze fades in / out over 20 ms so it never clicks
        this.fz += ((frz ? 1 : 0) - this.fz) * (1 - Math.exp(-1 / (0.02 * sr)));
        // tape wow + flutter + a little drift
        this.wow += 0.55 / sr; if (this.wow > 1) this.wow -= 1;
        this.fl += 6.1 / sr; if (this.fl > 1) this.fl -= 1;
        if (++this.nzs > 64) { this.nzs = 0; this.nz = this.nz * 0.97 + (Math.random() * 2 - 1) * 0.03; }
        const wob = style === 0 ? (Math.sin(2 * Math.PI * this.wow) * 0.0032 + Math.sin(2 * Math.PI * this.fl) * 0.00035 + this.nz * 0.006) : Math.sin(2 * Math.PI * this.wow) * 0.0018;
        const lvl = (Math.abs(xl) + Math.abs(xr)) * 0.5;
        this.env = lvl > this.env ? ea * this.env + (1 - ea) * lvl : er * this.env + (1 - er) * lvl;
        const dk = 1 / (1 + duck * this.env * 14);
        const r = [0, 0];
        for (let c = 0; c < 2; c++) {
          this.d[c] = glide * this.d[c] + (1 - glide) * tgt[c];
          const m = mod * wob * sr * (c ? -0.8 : 1);
          if (style === 2) {
            // two backwards grains, half a length apart, each faded in and out (sin^2 + cos^2 = 1)
            const D = Math.max(64, this.d[c]);
            if (this.rp[c] >= D) this.rp[c] -= D * Math.floor(this.rp[c] / D);
            let s = 0;
            for (let k = 0; k < 2; k++) { const ph = (this.rp[c] + k * D / 2) % D, win = Math.sin(Math.PI * ph / D); s += this.read(this.b[c], 2 * ph + 2 + Math.abs(m)) * win * win; }
            this.rp[c] += 1;
            r[c] = s;
          } else r[c] = this.read(this.b[c], this.d[c] + m);
        }
        // inside the feedback: filters, drive, diffusion, a safety limit
        const o = [0, 0];
        for (let c = 0; c < 2; c++) {
          let v = this.run(this.hk, this.hpz[c], this.run(this.lk, this.lpz[c], r[c]));
          if (drive > 0.001) v = Math.tanh(g * v) * gn;
          if (dif > 0.001) { const st = c ? this.apR : this.apL; v = this.ap(st[1], this.ap(st[0], v, dif), dif); }
          v = Math.abs(v) > 1.2 ? Math.tanh(v / 1.2) * 1.2 : v;
          o[c] = v;
        }
        const fz = this.fz, keep = 1 - fz, f2 = fb * 1.05 * keep;
        const inL = (xl * (1 - pp) + (xl + xr) * 0.5 * pp) * keep, inR = xr * (1 - pp) * keep;
        // frozen: the raw echoes go round untouched (no filter, no drive), so the loop never fades
        const wl = inL + f2 * ((1 - pp) * o[0] + pp * o[1]) + fz * ((1 - pp) * r[0] + pp * r[1]);
        const wr = inR + f2 * ((1 - pp) * o[1] + pp * o[0]) + fz * ((1 - pp) * r[1] + pp * r[0]);
        this.b[0][this.w] = wl; this.b[1][this.w] = wr;
        this.w = (this.w + 1) % N;
        const ol = (o[0] * keep + r[0] * fz) * dk * wetG, orr = (o[1] * keep + r[1] * fz) * dk * wetG;
        y[0][i] = xl * dryG + ol;
        if (y[1]) y[1][i] = xr * dryG + orr;
      }
      return true;
    }
  });`;

  const FX = {
    kttime: {
      name: "KILLTIME", toy: "KILLTIME", cat: "SPACE", color: "#ffb547", knobs: 4, what: "creative delay: tape, reverse, freeze",
      search: "delay echo ping pong tape delay reverse delay freeze timeless echoboy dub creative killtime",
      hidden: () => !!window.KT2_KILLTIME_OFF,
      modes: [{ name: "TAPE", icon: "M8,11 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 M36,11 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 M8,17 H36" }, { name: "DIGITAL" }, { name: "REVERSE" }], modeId: "style",
      toggles: [{ id: "freeze", name: "FREEZE" }],
      params: () => [prm("tone", "Tone", 0.72, "7.0 kHz"), prm("drive", "Drive", 0.2, "20%"), prm("mod", "Mod", 0.25, "25%"), prm("mix", "Mix", 0.3, "30%"),
        prm("time", "Time", 9 / 15, "1/8 D"), prm("feedback", "Feedback", 0.45, "45%"), prm("offset", "Offset", 0, "0%"), prm("pingpong", "Ping pong", 0.5, "50%"),
        prm("lowcut", "Low cut", 0.35, "120 Hz"), prm("diffuse", "Diffuse", 0, "0%"), prm("duck", "Duck", 0, "off"), prm("style", "Style", 0, "TAPE"), prm("freeze", "Freeze", 0, "off")],
      build(ctx, p, env, H) {
        const L = H.lazyNode(ctx, "kt-time", {});
        let time = 9 / 15, offset = 0, bpm = 0;
        const times = () => {
          bpm = (env && env().bpm) || 120;
          const t = secs(time, bpm);
          L.param("tl", t, 0.0001); L.param("tr", Math.min(t * (1 + offset * 0.5), 6), 0.0001);
        };
        const tick = setInterval(() => { const b = (env && env().bpm) || 120; if (b !== bpm) times(); }, 400);
        const set = (pid, v) => {
          if (pid === "time") { time = v; times(); return noteOf(v)[1]; }
          if (pid === "offset") { offset = v; times(); return v < 0.01 ? "0%" : "+" + Math.round(v * 50) + "%"; }
          if (pid === "feedback") { L.param("fb", v); return Math.round(v * 105) + "%"; }
          if (pid === "pingpong") { L.param("pp", v); return pct(v); }
          if (pid === "tone") { const f = logMap(v, 400, 20000); L.param("lp", f, 0.0001); return fHz(f); }
          if (pid === "lowcut") { const f = logMap(v, 20, 2000); L.param("hp", f, 0.0001); return fHz(f); }
          if (pid === "drive") { L.param("drive", v); return pct(v); }
          if (pid === "mod") { L.param("mod", v); return pct(v); }
          if (pid === "diffuse") { L.param("diffuse", v); return pct(v); }
          if (pid === "duck") { L.param("duck", v); return v < 0.01 ? "off" : pct(v); }
          if (pid === "mix") { L.param("mix", v); return pct(v); }
          if (pid === "style") { const s = step(v, 3); L.param("style", s, 0.0001); return STYLES[s]; }
          if (pid === "freeze") { L.param("freeze", v > 0.5 ? 1 : 0, 0.0001); return v > 0.5 ? "on" : "off"; }
        };
        times();
        return { input: L.input, output: L.output, set, close: () => { clearInterval(tick); L.close(); } };
      },
    },
  };

  // The picture: the dry hit, then the echoes on a beat grid. Left echoes go up from the middle line, right ones
  // down; how tall = how loud (feedback), how bright = the tone, REVERSE draws them as backwards swells, FREEZE in acid.
  // Drag the first left echo: left/right = time (snaps to note values), up/down = feedback. The first right echo:
  // left/right = offset. Ping pong, low cut, diffuse and duck are knobs in its window (click the name).
  function views(R) {
    R("kttime", {
      match: /^kttime\b/i,
      geo(d) {
        const bpm = d.bpm || 120, beat = 60 / bpm, t = secs(d.v("time", 0.6), bpm), off = d.v("offset", 0), tr = t * (1 + off * 0.5);
        const span = Math.max(4 * beat, Math.min(16 * beat, t * 6)), mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2 - 3;
        const xOf = (s) => d.x0 + 10 + (s / span) * (d.x1 - d.x0 - 14);
        return { bpm, beat, t, tr, span, mid, amp, xOf, sOf: (x) => ((x - d.x0 - 10) / (d.x1 - d.x0 - 14)) * span };
      },
      draw(d) {
        const G = this.geo(d), fb = d.v("feedback", 0.45) * 1.05, pp = d.v("pingpong", 0.5), tone = d.v("tone", 0.72), style = step(d.v("style", 0), 3), frz = d.v("freeze", 0) > 0.5, mod = d.v("mod", 0.25);
        const xs = []; for (let s = 0; s <= G.span + 1e-6; s += G.beat) xs.push(G.xOf(s));
        d.grid(xs, [G.mid]);
        for (let i = 0, s = 0; s <= G.span + 1e-6; s += G.beat, i++) if (i % 4 === 0) d.label(String(i / 4 + 1), G.xOf(s) + 3, d.y1 + 2, "left", d.ink3, 9);
        const col = frz ? "#e4ff3a" : d.col;
        const bar = (x, h, up, a, k) => {
          h = h > 0.0005 ? clamp((20 * Math.log10(h) + 36) / 36, 0, 1) : 0;   // drawn in dB, so quiet echoes still show
          const y = up ? G.mid - h * G.amp : G.mid + h * G.amp, w = 4;
          const wob = style === 0 ? Math.sin(k * 2.1) * mod * 2.2 : 0;
          if (style === 2) { d.g.beginPath(); d.g.moveTo(x - 9 + wob, G.mid); d.g.lineTo(x + wob, y); d.g.lineTo(x + wob, G.mid); d.g.closePath(); d.g.fillStyle = d.rgba(a * 0.5, col); d.g.fill(); }
          d.g.fillStyle = d.rgba(a, col); d.g.fillRect(x - w / 2 + wob, Math.min(y, G.mid), w, Math.abs(y - G.mid));
        };
        // the dry hit, both sides
        d.g.fillStyle = d.rgba(0.35, "#ffffff"); d.g.fillRect(G.xOf(0) - 1.5, G.mid - G.amp, 3, G.amp * 2);
        // echoes: each side's level, with ping pong moving energy across
        let l = 1 - pp * 0.5, r = 1 - pp, tl = G.t, trr = G.tr;
        for (let k = 1; k < 40; k++) {
          const g = frz ? 0.8 : Math.pow(Math.min(fb, 1.0), k);
          const a = clamp((0.25 + 0.75 * Math.pow(tone, k * 0.6)) * (frz ? 1 : 1), 0.12, 1);
          if (tl <= G.span) bar(G.xOf(tl), Math.min(1, g * l), true, a, k);
          if (trr <= G.span) bar(G.xOf(trr), Math.min(1, g * r), false, a, k + 7);
          const nl = (1 - pp) * l + pp * r, nr = (1 - pp) * r + pp * l; l = nl; r = nr;
          tl += G.t; trr += G.tr;
          if (tl > G.span && trr > G.span) break;
        }
        d.label("L", d.x1, G.mid - G.amp + 9, "right", d.ink3, 9);
        d.label("R", d.x1, G.mid + G.amp - 2, "right", d.ink3, 9);
      },
      handles(d) {
        const G = this.geo(d), fb = d.v("feedback", 0.45), pp = d.v("pingpong", 0.5);
        const near = (s) => { const beats = s / G.beat; let bi = 0; NOTES.forEach(([b], i) => { if (Math.abs(Math.log(b / Math.max(1e-3, beats))) < Math.abs(Math.log(NOTES[bi][0] / Math.max(1e-3, beats)))) bi = i; }); return bi / (NOTES.length - 1); };
        const l0 = 1 - pp * 0.5, r0 = 1 - pp;
        const hdb = (g) => (g > 0.0005 ? clamp((20 * Math.log10(g) + 36) / 36, 0, 1) : 0), gdb = (h) => Math.pow(10, (h * 36 - 36) / 20);
        return [
          { x: G.xOf(G.t), y: G.mid - hdb(Math.min(1, fb * 1.05 * l0)) * G.amp, label: () => d.t("time") + " \u00b7 feedback " + d.t("feedback"),
            drag: (px, py) => { const h = clamp((G.mid - py) / G.amp, 0, 1); return { time: near(Math.max(0.005, G.sOf(px))), feedback: h < 0.02 ? 0 : clamp(gdb(h) / Math.max(0.3, l0) / 1.05, 0, 1) }; } },
          { x: G.xOf(G.tr), y: G.mid + Math.max(0.15, hdb(Math.min(1, fb * 1.05 * r0))) * G.amp, label: () => "right later " + d.t("offset"),
            drag: (px) => { const k = G.sOf(px) / G.t - 1; return { offset: clamp(k / 0.5, 0, 1) }; } },
        ];
      },
    });
  }

  window.KillTime = { WORKLET, FX, views, NOTES, STYLES, secs };
})();
