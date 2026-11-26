// KILLDRUM FX tab: Output Portal for drums. Every pad is a dot inside the chosen effect's circle;
// a dot's distance from the centre is how hard the effect hits that pad, X and Y are the effect's
// two axes. Left: the pads (switch = this pad goes through FX). Middle: effect picker, the circle
// (KdFx.Portal, ui/killdrum-fx-canvas.js), A/B. Right: the picked dot's preset and knobs.
// The state is the lane's kitVoid (v 2, see ui/killdrum-fx-core.js); the sound runs in
// ui/killdrum-fx-host.js. Eman's spec: DRUM_PORTAL_SPEC_V1.md (sections 3-6 and 9).
(function () {
  "use strict";
  const KdFx = (window.KdFx = window.KdFx || {});
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const lerp = (a, b, t) => a + (b - a) * t;
  const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
  const pct = (v) => Math.round(clamp(v) * 100) + "%";
  const hz = (f) => (KdFx.fmt && KdFx.fmt.hz ? KdFx.fmt.hz(f) : Math.round(f) + " Hz");
  const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const DICE = svg('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>');
  const LEFT = svg('<path d="M14.5 6l-6 6 6 6"/>'), RIGHT = svg('<path d="M9.5 6l6 6-6 6"/>');

  // The 30 effects of the spec, in its groups. Registered ones are clickable; the rest show as
  // "coming" so Eman sees the whole menu. Matched by num, then by name.
  const CATALOG = [
    ["GRANULAR & TIME", [1, "GRAIN CLOUD"], [2, "GRAIN FREEZE"], [3, "STUTTER"], [4, "TAPE STOP"], [5, "REVERSE ECHO"], [6, "SLICE SHUFFLE"]],
    ["DELAY PORTALS", [7, "PITCH DELAY"], [8, "DIFFUSE DELAY"], [9, "RESONATOR"], [10, "FLANGER"]],
    ["SPECTRAL & FILTER", [11, "SPECTRAL FREEZE"], [12, "BIN CRUSH"], [13, "FORMANT"], [14, "ACID FILTER"], [15, "PHASER"]],
    ["DISTORTION", [16, "BITCRUSH"], [17, "WAVEFOLD"], [18, "TAPE DRIVE"], [19, "RING MOD"]],
    ["DYNAMICS & MOVEMENT", [20, "TRANSIENT"], [21, "PUMP"], [22, "GATE SEQUENCER"], [23, "ORBIT"]],
    ["REVERB PORTALS", [24, "SHIMMER"], [25, "GATED VERB"], [26, "CONVOLUTION"], [27, "INFINITE VERB"]],
    ["GLITCH & CHAOS", [28, "CHANCE ENGINE"], [29, "LO-FI"], [30, "MORPH"]],
  ];
  const regFor = (n, name) => KdFx.effects.find((e) => e.num === n) || KdFx.effects.find((e) => String(e.name || "").toUpperCase() === name) || null;

  // knob angles: 0 = up, clockwise, -135..135
  const pt = (a, r) => { const t = (a * Math.PI) / 180; return [50 + r * Math.sin(t), 50 - r * Math.cos(t)]; };
  function arcPath(a0, a1, r = 42) {
    if (a1 - a0 < 0.5) return "";
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  const cutFmt = (v) => (Math.abs(v) < 0.02 ? "OFF" : v < 0 ? "LP " + hz(20000 * Math.pow(60 / 20000, -v)) : "HP " + hz(20 * Math.pow(12000 / 20, v)));

  function mount(pane, ctx) {
    const root = pane.closest(".kd-root") || pane;
    const sel = new Set();             // picked dots (notes). In SYNC the merged dot is what the panel edits.
    let kv = null, saved = "", visible = true, raf = 0, lastT = null, alive = true;
    let names = {}, has = {};
    let drag = null, rec = null, recKey = false, hover = false;
    let menu = null;                   // "fx" | "preset" | null
    let wetT = 0;
    const flashes = new Map();         // note -> time the row flash ends

    // ---------------------------------------------------------------- state
    function load(v) {
      const k = v && v.v === 2 ? clone(v) : KdFx.defaultFx();
      if (!k.pw) { k.on = false; k.pw = 1; } // an older save that switched itself on starts off
      if (!k.fx) k.fx = {};
      if (!k.effect && KdFx.effects[0]) k.effect = KdFx.effects[0].id;
      if (KdFx.byId[k.effect]) KdFx.space(k, k.effect);
      return k;
    }
    const desc = () => KdFx.byId[kv.effect] || null;
    const space = () => (desc() ? KdFx.space(kv, kv.effect) : null);
    const dotOf = (t) => { const s = space(); return !s ? null : t === "sync" ? s.syncDot : s.dots[t]; };
    // what the panel edits: the merged dot in SYNC, else the picked dots (first = the one shown)
    const targets = () => (kv.sync ? ["sync"] : [...sel]);
    const voices = () => { const a = KdFx.VOICES.filter((v) => has[v.note]); return a.length ? a : KdFx.VOICES; };
    const kindOf = (t) => (t === "sync" ? "all" : (KdFx.voiceByNote[t] || {}).kind || "all");
    const labelOf = (t) => (t === "sync" ? "ALL" : (KdFx.voiceByNote[t] || {}).label || String(t));
    function readKit(e) {
      names = (e && e.kitName) || {}; has = {};
      for (const n of Object.keys((e && e.kit) || {})) has[n] = true;
    }

    // hear it now; save it as one undo step at the end of a gesture
    function live() { if (KdFx.host && KdFx.host.update) try { KdFx.host.update(ctx.pluginId, clone(kv)); } catch (e) { console.error(e); } }
    function persist(undo = true) {
      saved = JSON.stringify(kv);
      try { ctx.setKit({ ...ctx.getKit(), kitVoid: JSON.parse(saved) }, undo); } catch (e) { console.error(e); }
    }
    function change(rebuild = true) { live(); persist(true); if (rebuild) drawAll(); else refresh(); }

    readKit(ctx.getKit());
    const first = ctx.getKit().kitVoid;
    kv = load(first);
    saved = first ? JSON.stringify(first) : "";
    // nothing saved yet: store the starting constellation (no undo step) so the engine plays what the tab shows
    if (!first && kv.effect) persist(false);
    live();

    // ---------------------------------------------------------------- frame
    pane.replaceChildren();
    const wrap = h("div", "kd-warp kdf");
    const left = h("div", "kd-plist kdf-pads");
    const mid = h("div", "kdf-mid");
    const side = h("div", "kd-detail kdf-side");
    wrap.append(left, mid, side);
    pane.append(wrap);

    // middle: picker, circle, bar (readout + A/B)
    const pick = h("div", "kdf-pick");
    const pickRow = h("div", "kdf-pickrow");
    const prevFx = h("button", "kd-ibtn kdf-arrow"); prevFx.innerHTML = LEFT; prevFx.title = "Previous effect";
    const nextFx = h("button", "kd-ibtn kdf-arrow"); nextFx.innerHTML = RIGHT; nextFx.title = "Next effect";
    const fxName = h("button", "kd-worldname kdf-fxname"); fxName.title = "All effects";
    pickRow.append(prevFx, fxName, nextFx);
    const fxCap = h("div", "kdf-caption");
    pick.append(pickRow, fxCap);
    const stage = h("div", "kdf-stage");
    const circle = h("div", "kdf-circle");
    stage.append(circle);
    const grid = h("div", "kdf-fxgrid"); grid.hidden = true;
    const bar = h("div", "kdf-bar");
    const xyread = h("div", "kd-xyread kdf-read");
    const ab = h("div", "kdf-ab");
    bar.append(xyread, ab);
    mid.append(pick, stage, bar, grid);

    // ---------------------------------------------------------------- the portal
    let portal = null;
    const view = () => {
      const d = desc(), s = space(), vs = voices();
      const beat = KdFx.host && KdFx.host.beat ? KdFx.host.beat() : null;
      const dots = [];
      if (s) for (const v of vs) {
        const dot = s.dots[v.note];
        if (!dot) continue;
        let liveAt = null;
        if (beat != null && (dot.motion || (kv.gravity && kv.gravity !== "off"))) {
          const p = KdFx.dotAt(dot, beat, kv.gravity, kv.seed, KdFx.grav(kv), v.note);
          if (Math.abs(p.x - dot.x) > 1e-4 || Math.abs(p.y - dot.y) > 1e-4) liveAt = p;
        }
        const recNow = rec && rec.t === v.note;
        dots.push({ note: v.note, label: v.label, color: v.color, x: dot.x, y: dot.y, wet: num(dot.wet, 0.5), on: dot.on !== false,
                    sel: sel.has(v.note), dim: sel.size > 0 && !sel.has(v.note), live: liveAt,
                    trail: recNow ? rec.path : dot.motion && dot.motion.path ? dot.motion.path : null, rec: !!recNow });
      }
      let syncDot = null;
      if (kv.sync && s && s.syncDot) {
        const sd = s.syncDot;
        syncDot = { x: sd.x, y: sd.y, wet: num(sd.wet, 0.5), trail: rec && rec.t === "sync" ? rec.path : sd.motion ? sd.motion.path : null };
        if (beat != null && (sd.motion || (kv.gravity && kv.gravity !== "off"))) syncDot.live = KdFx.dotAt(sd, beat, kv.gravity, kv.seed, KdFx.grav(kv), "sync");
      }
      return {
        effect: d ? { id: d.id, name: d.name, axes: d.axes, group: d.group } : null,
        dots, sync: !!kv.sync, syncDot,
        syncColors: kv.sync && s ? vs.filter((v) => s.dots[v.note] && s.dots[v.note].on !== false).map((v) => v.color) : [],
        now: KdFx.now ? KdFx.now() : null, on: KdFx.isOn(kv),
      };
    };
    function makePortal() {
      if (portal || !KdFx.Portal || !KdFx.Portal.create) return;
      circle.replaceChildren();
      try {
        portal = KdFx.Portal.create(circle, { get: view, onPick, onMove, onWet, onHome });
      } catch (e) { console.error(e); portal = null; }
      if (!portal) circle.append(h("div", "kdf-noportal", "The circle didn't load."));
    }
    // the canvas file loads before this one; if it is late, keep looking for a few seconds
    makePortal();
    if (!portal) { circle.append(h("div", "kdf-noportal", "Loading the circle…")); let n = 0; const iv = setInterval(() => { makePortal(); if (portal || ++n > 40 || !alive) clearInterval(iv); }, 250); }

    function onPick(note, o = {}) {
      closeMenu();
      if (note == null) { if (!o.shift) sel.clear(); }
      else if (kv.sync || note === "sync") { /* one merged dot: the panel already edits it */ }
      else if (o.shift) { if (sel.has(note)) sel.delete(note); else sel.add(note); }
      // a click on a dot of the picked group keeps the group, so it can be dragged as one
      else if (!(sel.has(note) && sel.size > 1)) { sel.clear(); sel.add(note); }
      drawAll();
    }
    // drag a dot (or the picked group, same delta); Alt-drag the merged dot in SYNC = move the whole
    // constellation underneath; R held = record the path for a bar
    function onMove(t, x, y, o = {}) {
      const s = space();
      if (!s) return;
      if (o.phase === "start" || !drag) {
        if (t !== "sync" && !kv.sync && !sel.has(t)) { sel.clear(); sel.add(t); drawAll(); }
        const group = t === "sync" ? ["sync", ...(o.alt ? voices().map((v) => v.note) : [])] : [...new Set([t, ...sel])];
        const start = new Map();
        for (const g of group) { const d = dotOf(g); if (d) start.set(g, KdFx.xyToDisc(d.x, d.y)); }
        drag = { t, start };
      }
      const d0 = drag.start.get(drag.t) || KdFx.xyToDisc(x, y), p = KdFx.xyToDisc(x, y), du = p.u - d0.u, dv = p.v - d0.v;
      for (const [g, st] of drag.start) {
        const d = dotOf(g);
        if (!d) continue;
        if (g === drag.t) { d.x = clamp(x); d.y = clamp(y); continue; }
        const q = KdFx.discToXY(st.u + du, st.v + dv);
        d.x = q.x; d.y = q.y;
      }
      if (!rec && (o.rec || recKey) && o.phase !== "end") recStart(drag.t);
      if (rec) recPush(x, y);
      live();
      refresh();
      if (o.phase === "end") { if (rec) recEnd(); drag = null; persist(true); drawAll(); }
    }
    function onWet(t, wet) {
      const d = dotOf(t);
      if (!d) return;
      d.wet = clamp(wet);
      live(); refresh();
      clearTimeout(wetT); wetT = setTimeout(() => persist(true), 400); // a scroll has no "end": save when it settles
    }
    function onHome(t) {
      const d = dotOf(t);
      if (!d) return;
      d.x = 0.5; d.y = 0.5;
      change(false);
    }

    // ---------------------------------------------------------------- motion record (R + drag)
    const beatNow = () => (KdFx.host && KdFx.host.beat ? KdFx.host.beat() : null);
    const barSec = () => (4 * 60) / ((KdFx.host && KdFx.host.bpm && KdFx.host.bpm()) || 120);
    function recStart(t) { rec = { t, t0: performance.now(), b0: beatNow(), raw: [], path: [] }; refresh(); }
    function recPush(x, y) {
      const b = beatNow(), el = (performance.now() - rec.t0) / 1000;
      rec.raw.push([b, el, x, y]); rec.path.push([x, y]);
      const bars = rec.b0 != null && b != null ? (b - rec.b0) / 4 : el / barSec();
      if (bars >= 1) recEnd();
    }
    // 64 points over one bar: in time with the song when it was playing (index 0 = the bar's
    // downbeat, as KdFx.dotAt reads it), else the gesture stretched over the bar
    function recEnd() {
      const r = rec; rec = null;
      if (!r || r.raw.length < 4) return;
      const d = dotOf(r.t);
      if (!d) return;
      const playing = r.raw.every((p) => p[0] != null), T = Math.max(1e-3, r.raw[r.raw.length - 1][1]);
      const pts = r.raw.map((p) => [playing ? (((p[0] % 4) + 4) % 4) / 4 : (p[1] / T) * 0.999, p[2], p[3]]).sort((a, b) => a[0] - b[0]);
      let moved = 0;
      for (const p of pts) moved = Math.max(moved, Math.hypot(p[1] - pts[0][1], p[2] - pts[0][2]));
      if (moved < 0.02) return; // a click with R held, not a path
      const at = (ph) => {
        let i = pts.findIndex((p) => p[0] > ph);
        if (i < 0) i = pts.length;
        const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i % pts.length];
        let span = b[0] - a[0], off = ph - a[0];
        if (span <= 0) span += 1; if (off < 0) off += 1;
        const u = span > 0 ? clamp(off / span) : 0;
        return [+(lerp(a[1], b[1], u)).toFixed(4), +(lerp(a[2], b[2], u)).toFixed(4)];
      };
      const path = [];
      for (let k = 0; k < 64; k++) path.push(at(k / 64));
      d.motion = { bars: 1, path };
      ctx.say && ctx.say(`Recorded a 1-bar path for ${labelOf(r.t).toLowerCase()}. It loops with the song.`);
    }

    // ---------------------------------------------------------------- dice, presets, effect, A/B
    function dice() {
      if (!desc() || !space()) return;
      KdFx.rollDots(kv, kv.sync ? ["sync"] : sel.size ? [...sel] : voices().map((v) => v.note));
      change();
      diceBtn.classList.remove("kdf-rolled"); void diceBtn.offsetWidth; diceBtn.classList.add("kdf-rolled");
    }
    // presets of this effect, the voice's own first
    function presetList(t) {
      const ps = (desc() && desc().presets) || [], k = kindOf(t);
      return [...ps.filter((p) => p.voice === k), ...ps.filter((p) => p.voice !== k)];
    }
    function applyPreset(p) {
      const d = desc(), s = space();
      if (!d || !s || !p) return;
      for (const t of targets()) {
        const nd = KdFx.dotFromPreset(d, p, dotOf(t));
        if (t === "sync") s.syncDot = nd; else s.dots[t] = nd;
      }
      closeMenu();
      change();
    }
    function stepPreset(dir) {
      const t = targets()[0];
      if (t == null) return;
      const list = presetList(t), cur = dotOf(t);
      if (!list.length) return;
      const i = list.findIndex((p) => p.name === (cur && cur.preset));
      applyPreset(list[(i + dir + list.length * 2) % list.length]);
    }
    function setEffect(id) {
      if (!KdFx.byId[id] || id === kv.effect) { closeMenu(); return; }
      const old = space(), fresh = !kv.fx[id];
      kv.effect = id;
      const s = KdFx.space(kv, id);
      // the pad switches on the left are the kit's routing: a new effect starts with the same ones
      if (fresh && old) for (const v of KdFx.VOICES) if (old.dots[v.note] && s.dots[v.note]) s.dots[v.note].on = old.dots[v.note].on !== false;
      closeMenu();
      change();
      ctx.say && ctx.say(`${KdFx.byId[id].name}: ${KdFx.byId[id].caption || ""}`);
    }
    // FX on/off. The first time it goes on, the effect is one that fits the beat's style; every pad's
    // dot starts where that effect's preset for its kind of sound puts it, and can be dragged from there.
    const FIT = { trap: "stutter", rage: "bitcrush", drill: "pitch-delay", jersey: "stutter", lofi: "lo-fi", boombap: "tape-drive",
      house: "pump", techno: "gate-sequencer", crystal: "bitcrush", dnb: "reverse-echo" };
    function power(on) {
      kv.on = !!on; kv.pw = 1;
      if (on && !kv.fitted) {
        kv.fitted = 1;
        let genre = ""; try { genre = (window.killDrumBeat && window.killDrumBeat.style && window.killDrumBeat.style()) || ((ctx.getKit() || {}).kitBeat || {}).genre || ""; } catch (e) { /* none */ }
        const KP = window.KillDrumPatterns, id = FIT[genre] || (KP && KP.baseOf ? FIT[KP.baseOf(genre)] : null);   // a new genre: its parent's effect
        if (id && KdFx.byId[id] && id !== kv.effect) { setEffect(id); return; } // setEffect saves
      }
      change();
      ctx.say && ctx.say(on ? `FX on: ${(desc() || {}).name || ""}. Drag the dots; the middle is dry.` : "FX off: the beat plays dry.");
    }
    function stepEffect(dir) {
      const list = KdFx.effects;
      if (!list.length) return;
      const i = list.findIndex((e) => e.id === kv.effect);
      setEffect(list[(i + dir + list.length) % list.length].id);
    }
    const abOf = () => { const s = space(); if (!s) return null; if (!s.ab) s.ab = { a: null, b: null, mix: 0 }; return s.ab; };
    function abSave(slot, btn) {
      const s = space(), A = abOf();
      if (!s) return;
      A[slot] = { dots: clone(s.dots), syncDot: clone(s.syncDot) };
      A.mix = slot === "a" ? 0 : 1; // the fader shows where the dots are now
      persist(true);
      drawAB();
      const b = ab.querySelector(`[data-slot="${slot}"]`) || btn;
      if (b) { b.classList.remove("kdf-saved"); void b.offsetWidth; b.classList.add("kdf-saved"); }
    }
    function mixDot(A, B, m, cur) {
      const d = clone(m < 0.5 ? A : B);
      for (const k of ["x", "y", "wet", "strength", "drive", "cutoff", "res"]) d[k] = lerp(num(A[k], num(B[k])), num(B[k], num(A[k])), m);
      d.dials = d.dials || {};
      for (const id of Object.keys({ ...(A.dials || {}), ...(B.dials || {}) })) {
        const a = num((A.dials || {})[id], num((B.dials || {})[id], 0.5)), b = num((B.dials || {})[id], a);
        d.dials[id] = lerp(a, b, m);
      }
      if (cur) d.on = cur.on !== false; // the pad switches stay as they are
      return d;
    }
    function abMix(m) {
      const s = space(), A = abOf();
      if (!s || !A || !A.a || !A.b) return;
      A.mix = clamp(m);
      for (const v of KdFx.VOICES) { const a = A.a.dots[v.note], b = A.b.dots[v.note]; if (a && b) s.dots[v.note] = mixDot(a, b, A.mix, s.dots[v.note]); }
      if (A.a.syncDot && A.b.syncDot) s.syncDot = mixDot(A.a.syncDot, A.b.syncDot, A.mix, s.syncDot);
    }

    // ---------------------------------------------------------------- left: the pads
    const rows = new Map();
    function drawPads() {
      left.replaceChildren();
      const s = space();
      const head = h("div", "kd-plist-h");
      const allOn = !!s && voices().every((v) => s.dots[v.note] && s.dots[v.note].on !== false);
      const all = h("button", "kd-send" + (allOn ? " kd-on" : ""));
      all.title = allOn ? "Take every pad out of FX" : "Send every pad into FX";
      all.onclick = () => { if (!s) return; for (const v of KdFx.VOICES) if (s.dots[v.note]) s.dots[v.note].on = !allOn; change(); };
      head.append(h("span", "kd-label", "Into FX"), all);
      left.append(head);
      rows.clear();
      for (const v of KdFx.VOICES) {
        const dot = s && s.dots[v.note], on = !!dot && dot.on !== false, snd = has[v.note];
        const row = h("div", "kd-prow kdf-row" + (!kv.sync && sel.has(v.note) ? " kd-sel" : "") + (on ? "" : " kdf-off") + (snd ? "" : " kd-muted"));
        row.style.setProperty("--c", v.color);
        const chip = h("div", "kd-ppic kdf-chip"), face = h("canvas", "kdf-face"); chip.append(face, h("i"));
        if (snd && ctx.drawPad) requestAnimationFrame(() => { face.width = (face.clientWidth || 40) * 2; face.height = (face.clientHeight || 40) * 2; ctx.drawPad(face, v.note, false); });
        const meta = h("div", "kd-pmeta");
        meta.append(h("div", "kd-pname", v.label), h("div", "kd-psnd", snd ? names[v.note] || "Sound" : "Empty"));
        const sw = h("button", "kd-send" + (on ? " kd-on" : ""));
        sw.title = on ? "Take this pad out of FX" : "Send this pad into FX";
        sw.onclick = (e) => { e.stopPropagation(); if (!dot) return; dot.on = !on; change(); };
        row.append(chip, meta, sw);
        row.onclick = (e) => {
          if (!kv.sync) {
            if (e.shiftKey) { if (sel.has(v.note)) sel.delete(v.note); else sel.add(v.note); }
            else { sel.clear(); sel.add(v.note); }
          }
          // play it (through the effect) unless the song is running anyway
          if (snd && beatNow() == null && ctx.hit) ctx.hit(v.note, 110);
          closeMenu(); drawAll();
        };
        rows.set(v.note, row);
        left.append(row);
      }
    }

    // ---------------------------------------------------------------- middle: picker + readout + A/B
    const drops = new Map(); // effect id -> cleanup fn (or true: hooked for good)
    function hookDrop(d) {
      for (const [id, off] of drops) if (id !== (d && d.id) && typeof off === "function") { try { off(); } catch (e) { /* gone */ } drops.delete(id); }
      if (d && typeof d.dropTarget === "function" && !drops.has(d.id)) {
        let off = true;
        try { off = d.dropTarget(circle, () => (KdFx.audioCtx ? KdFx.audioCtx() : null)) || true; } catch (e) { console.error(e); }
        drops.set(d.id, off);
      }
    }
    function drawPick() {
      const d = desc();
      hookDrop(d);
      fxName.textContent = d ? d.name : kv.effect ? "NOT LOADED" : "NO EFFECTS YET";
      fxCap.textContent = d ? d.caption || "" : kv.effect ? "This effect isn't in this build yet." : "Effects show up here as they load.";
      prevFx.disabled = nextFx.disabled = KdFx.effects.length < 2;
      if (menu === "fx") drawGrid();
      grid.hidden = menu !== "fx";
      fxName.classList.toggle("kdf-open", menu === "fx");
    }
    function drawGrid() {
      grid.replaceChildren();
      const used = new Set();
      const btn = (e, n, name) => {
        const b = h("button", "kdf-fxbtn" + (e && e.id === kv.effect ? " kd-on" : "") + (e ? "" : " kdf-coming"));
        b.append(h("span", "kdf-num", String(n || "").padStart(2, "0")), h("span", "kdf-fxn", e ? e.name : name));
        if (e) { b.title = e.caption || e.name; b.onclick = () => setEffect(e.id); used.add(e.id); } else { b.title = "Coming soon"; b.append(h("em", null, "soon")); }
        return b;
      };
      for (const [group, ...items] of CATALOG) {
        const g = h("div", "kdf-grp");
        g.append(h("div", "kd-label", group));
        for (const [n, name] of items) g.append(btn(regFor(n, name), n, name));
        grid.append(g);
      }
      const extra = KdFx.effects.filter((e) => !used.has(e.id));
      if (extra.length) { const g = h("div", "kdf-grp"); g.append(h("div", "kd-label", "More")); for (const e of extra) g.append(btn(e, e.num, e.name)); grid.append(g); }
    }
    function drawRead() {
      const d = desc(), t = targets()[0], dot = t != null ? dotOf(t) : null;
      xyread.replaceChildren();
      if (rec) { xyread.append(h("span", "kdf-rec", "● REC"), h("span", "kdf-hint", "Recording 1 bar of motion")); return; }
      if (!dot || !d) {
        xyread.append(h("span", "kdf-hint", kv.sync ? "Drag the dot. Alt-drag moves the whole shape." : "Click a dot  ·  Shift-click more  ·  S sync  ·  D dice  ·  hold R + drag to record"));
        return;
      }
      const ax = d.axes || { x: "X", y: "Y" };
      // an effect can say what its axes mean in real units ("1/8.", "+5 st"); else 0..100
      const st = KdFx.params ? KdFx.params(kv, dot, null, (KdFx.host && KdFx.host.bpm && KdFx.host.bpm()) || 120) : dot;
      const say = (fn, v) => { if (typeof fn === "function") try { const r = fn(v, st); if (r != null && r !== "") return String(r); } catch (e) { /* fall back */ } return String(Math.round(v * 100)); };
      xyread.append(h("span", "kd-label kdf-ax", ax.x || "X"), h("b", null, say(d.fmtX, dot.x)),
                    h("span", "kd-label kdf-ay", ax.y || "Y"), h("b", null, say(d.fmtY, dot.y)));
    }
    let xf = null;
    function drawAB() {
      ab.replaceChildren();
      const A = abOf();
      if (!A) return;
      const mk = (slot) => {
        const b = h("button", "kdf-abbtn" + (A[slot] ? " kdf-has" : ""), slot.toUpperCase());
        b.dataset.slot = slot;
        b.title = A[slot] ? `Save the dots as ${slot.toUpperCase()} again (overwrites)` : `Save the dots as ${slot.toUpperCase()}`;
        b.onclick = () => abSave(slot, b);
        return b;
      };
      xf = h("div", "kdf-xf" + (A.a && A.b ? "" : " kdf-dis"));
      xf.title = A.a && A.b ? "Morph between A and B" : "Save an A and a B first";
      const knobEl = h("i");
      xf.append(knobEl);
      const place = () => (knobEl.style.left = `calc(${clamp(num(A.mix))} * (100% - 12px))`);
      place();
      xf.onpointerdown = (e) => {
        if (!(A.a && A.b)) return;
        e.preventDefault(); xf.setPointerCapture(e.pointerId);
        const at = (ev) => { const r = xf.getBoundingClientRect(); abMix((ev.clientX - r.left - 6) / Math.max(1, r.width - 12)); place(); live(); refresh(); };
        at(e);
        xf.onpointermove = at;
        xf.onpointerup = () => { xf.onpointermove = xf.onpointerup = null; persist(true); drawAll(); };
      };
      ab.append(h("span", "kd-label", "Snap"), mk("a"), xf, mk("b"));
    }

    // ---------------------------------------------------------------- right: the panel
    let refreshers = [];
    const refresh = () => { for (const f of refreshers) f(); drawRead(); };
    // A knob: drag up/down (Shift = fine), double-click = back to default, the value shows while dragging.
    function knob(o) {
      const w = h("div", "kdf-kn" + (o.big ? " kdf-big" : ""));
      const k = h("div", "kd-knob2 kdf-knob" + (o.big ? "" : " kdf-small"));
      k.style.setProperty("--kc", o.color || "var(--tm-acid)");
      k.innerHTML = '<svg viewBox="0 0 100 100"><path class="kdf-arc0"/><path class="kdf-arc1"/></svg><div class="kd-cap"></div><div class="kdf-rot"><i></i></div>';
      const tip = h("div", "kdf-tip"); tip.hidden = true;
      k.append(tip);
      const val = h("div", "kdf-val");
      w.append(k, h("div", "kd-label", o.label), val);
      const [arc0, arc1] = k.querySelectorAll("path"), rot = k.querySelector(".kdf-rot");
      arc0.setAttribute("d", arcPath(-135, 135));
      const range = o.max - o.min;
      const upd = () => {
        const v = num(o.get(), o.def), n = clamp((v - o.min) / range), a = -135 + 270 * n;
        arc1.setAttribute("d", o.mid ? arcPath(Math.min(0, a), Math.max(0, a)) : arcPath(-135, a));
        rot.style.transform = `rotate(${a}deg)`;
        val.textContent = tip.textContent = o.fmt(v);
      };
      k.onpointerdown = (e) => {
        if (e.button) return;
        e.preventDefault(); k.setPointerCapture(e.pointerId);
        let y0 = e.clientY, v = num(o.get(), o.def);
        tip.hidden = false; k.classList.add("kdf-drag");
        k.onpointermove = (ev) => {
          v = clamp(v + ((y0 - ev.clientY) / (ev.shiftKey ? 900 : 180)) * range, o.min, o.max); y0 = ev.clientY;
          if (o.mid && Math.abs(v) < range * 0.015) v = 0; // the centre (off) clicks in
          o.set(v); upd();
        };
        k.onpointerup = () => { k.onpointermove = k.onpointerup = null; tip.hidden = true; k.classList.remove("kdf-drag"); o.done(); };
      };
      k.ondblclick = () => { o.set(o.def); upd(); o.done(); };
      upd();
      refreshers.push(upd);
      return w;
    }
    // set a field on every edited dot; heard at once, saved when the gesture ends
    const setAll = (fn) => { for (const t of targets()) { const d = dotOf(t); if (d) fn(d); } live(); };
    const done = () => { persist(true); refresh(); };

    let diceBtn = h("button");
    function drawSide() {
      refreshers = [];
      side.replaceChildren();
      const d = desc(), ts = targets(), t = ts[0], dot = t != null ? dotOf(t) : null;

      // top: SYNC, dice, FX on/off
      const top = h("div", "kdf-top");
      const sync = h("button", "kdf-sync" + (kv.sync ? " kd-on" : ""), "SYNC");
      sync.title = "One dot for every pad (S). Off: they spring back to where they were.";
      sync.onclick = () => toggleSync();
      diceBtn = h("button", "kdf-icon kdf-dice"); diceBtn.innerHTML = DICE;
      diceBtn.title = sel.size && !kv.sync ? "Roll the picked dots: new spots, new presets (D)" : "Roll every dot: new spots, new presets (D)";
      diceBtn.onclick = () => dice();
      const pw = h("label", "kdf-power");
      const pwSw = h("button", "kd-send" + (KdFx.isOn(kv) ? " kd-on" : ""));
      pwSw.title = KdFx.isOn(kv) ? "Turn FX off: the beat plays dry" : "Turn FX on";
      pwSw.onclick = () => power(!KdFx.isOn(kv));
      pw.append(h("span", "kd-label", "FX"), pwSw);
      top.append(sync, diceBtn, h("span", "kdf-sp"), pw);
      side.append(top);

      if (!d) { side.append(empty("No effect yet", "Effects show up here as soon as they load.")); side.append(kitWide()); return; }
      if (!dot) { side.append(empty("Pick a dot", "Click a dot in the circle or a pad on the left. Shift-click picks a few that move together.")); side.append(kitWide()); return; }

      // who + preset browser
      const who = h("div", "kdf-who");
      const chips = h("span", "kdf-chips");
      for (const x of kv.sync ? voices().filter((v) => (dotOf(v.note) || {}).on !== false).map((v) => v.note) : ts) {
        const c = h("i"); c.style.background = (KdFx.voiceByNote[x] || {}).color || "#fff"; chips.append(c);
      }
      who.append(chips, h("span", "kdf-whoname", kv.sync ? "ALL PADS (SYNC)" : ts.map(labelOf).join(" + ")));
      side.append(who);
      const pr = h("div", "kdf-preset");
      const pl = h("button", "kd-ibtn kdf-arrow"); pl.innerHTML = LEFT; pl.title = "Previous preset"; pl.onclick = () => stepPreset(-1);
      const pn = h("button", "kdf-pname" + (menu === "preset" ? " kdf-open" : ""), dot.preset || "Custom"); pn.title = "All presets of " + d.name;
      pn.onclick = () => { menu = menu === "preset" ? null : "preset"; drawSide(); };
      const pr2 = h("button", "kd-ibtn kdf-arrow"); pr2.innerHTML = RIGHT; pr2.title = "Next preset"; pr2.onclick = () => stepPreset(1);
      pr.append(pl, pn, pr2);
      side.append(pr);
      if (menu === "preset") {
        const box = h("div", "kdf-plist");
        const k = kindOf(t);
        for (const p of presetList(t)) {
          const r = h("button", "kdf-prow" + (p.name === dot.preset ? " kd-on" : ""));
          r.append(h("span", null, p.name), h("em", null, p.voice === k ? "for " + labelOf(t).toLowerCase() : p.voice || ""));
          r.onclick = () => applyPreset(p);
          box.append(r);
        }
        if (!box.children.length) box.append(h("div", "kd-none", "This effect has no presets yet."));
        side.append(box);
      }

      // STRENGTH between the effect's two dials
      const main = h("div", "kdf-main");
      const dial = (i) => {
        const dd = d.dials[i];
        if (!dd) return h("div", "kdf-kn kdf-blank");
        return knob({ label: dd.name || dd.id, min: 0, max: 1, def: dd.def != null ? dd.def : 0.5, color: "var(--kd-lilac)",
          get: () => num((dotOf(targets()[0]) || {}).dials && dotOf(targets()[0]).dials[dd.id], dd.def != null ? dd.def : 0.5),
          set: (v) => setAll((x) => { x.dials = x.dials || {}; x.dials[dd.id] = v; }), done,
          fmt: (v) => { try { return dd.fmt ? dd.fmt(v) : pct(v); } catch (e) { return pct(v); } } });
      };
      main.append(dial(0), knob({ big: true, label: "Strength", min: 0, max: 2, def: 1, get: () => num((dotOf(targets()[0]) || {}).strength, 1),
        set: (v) => setAll((x) => (x.strength = v)), done, fmt: (v) => Math.round(v * 100) + "%" }), dial(1));
      side.append(main);

      // DRIVE, CUTOFF (centre off, left LP, right HP), RES
      const tone = h("div", "kdf-tone");
      tone.append(
        knob({ label: "Drive", min: 0, max: 1, def: 0, get: () => num((dotOf(targets()[0]) || {}).drive, 0), set: (v) => setAll((x) => (x.drive = v)), done,
               fmt: (v) => (v < 0.005 ? "0 dB" : "+" + (v * 24).toFixed(1) + " dB") }),
        knob({ label: "Cutoff", min: -1, max: 1, def: 0, mid: true, color: "#fff", get: () => num((dotOf(targets()[0]) || {}).cutoff, 0), set: (v) => setAll((x) => (x.cutoff = v)), done, fmt: cutFmt }),
        knob({ label: "Res", min: 0, max: 1, def: 0.2, color: "var(--kd-lilac)", get: () => num((dotOf(targets()[0]) || {}).res, 0.2), set: (v) => setAll((x) => (x.res = v)), done, fmt: pct }));
      side.append(tone);

      // the effect's toggles: on/off = switch, a choice = segments
      if (d.toggles.length) {
        const tg = h("div", "kdf-toggles");
        for (const tt of d.toggles) {
          const cur = (dot.toggles || {})[tt.id];
          const row = h("div", "kdf-tg" + (tt.options && tt.options.length > 3 ? " kdf-tgwide" : ""));
          row.append(h("span", "kd-label", tt.name || tt.id));
          if (tt.options) {
            const seg = h("div", "kd-seg");
            tt.options.forEach((name, i) => {
              const b = h("button", (num(cur, tt.def || 0) === i ? "kd-on" : ""), name);
              b.onclick = () => { setAll((x) => { x.toggles = x.toggles || {}; x.toggles[tt.id] = i; }); change(); };
              seg.append(b);
            });
            row.append(seg);
          } else {
            const on = cur != null ? !!cur : !!tt.def;
            const sw = h("button", "kd-send" + (on ? " kd-on" : ""));
            sw.onclick = () => { setAll((x) => { x.toggles = x.toggles || {}; x.toggles[tt.id] = !on; }); change(); };
            row.append(sw);
          }
          tg.append(row);
        }
        side.append(tg);
      }

      // DRY / WET (= the dot's size)
      const wl = h("div", "kdf-wetl");
      const wv = h("b");
      wl.append(h("span", "kd-label", "Dry"), wv, h("span", "kd-label", "Wet"));
      const wet = h("div", "kd-wet kdf-wet");
      const fill = h("div", "kdf-wetfill"), hand = h("i");
      wet.append(fill, hand);
      const wupd = () => { const v = clamp(num((dotOf(targets()[0]) || {}).wet, 0.5)); hand.style.left = `calc(6px + ${v} * (100% - 12px))`; fill.style.width = v * 100 + "%"; wv.textContent = pct(v); };
      wet.onpointerdown = (e) => {
        e.preventDefault(); wet.setPointerCapture(e.pointerId);
        const at = (ev) => { const r = wet.getBoundingClientRect(), v = clamp((ev.clientX - r.left - 6) / Math.max(1, r.width - 12)); setAll((x) => (x.wet = v)); wupd(); };
        at(e);
        wet.onpointermove = at;
        wet.onpointerup = () => { wet.onpointermove = wet.onpointerup = null; done(); };
      };
      wet.ondblclick = () => { setAll((x) => (x.wet = 0.5)); wupd(); done(); };
      refreshers.push(wupd); wupd();
      const wbox = h("div", "kdf-wetbox");
      wbox.append(wl, wet);
      side.append(wbox);

      // motion: shows when the dot has a recorded path
      if (dot.motion && dot.motion.path) {
        const m = h("div", "kdf-motion");
        const x = h("button", "kdf-mx", "×"); x.title = "Clear the recorded motion";
        x.onclick = () => { setAll((y) => (y.motion = null)); change(); };
        m.append(h("span", "kd-label", "Motion"), h("span", "kdf-mv", (dot.motion.bars || 1) + " bar loop"), x);
        side.append(m);
      }

      // IN / OUT meters
      const met = h("div", "kdf-meters");
      for (const k of ["in", "out"]) {
        const r = h("div", "kdf-meter");
        r.dataset.k = k;
        r.append(h("span", "kd-label", k), h("div", "kdf-mbar", null), h("b", null, "–"));
        r.children[1].append(h("i"));
        met.append(r);
      }
      side.append(met);
      side.append(kitWide(true));
    }
    function empty(title, text) {
      const e = h("div", "kdf-empty");
      e.append(h("b", null, title), h("p", null, text));
      return e;
    }
    // kit-wide: gravity (+ the keys when nothing is picked)
    function kitWide(small) {
      const box = h("div", "kdf-kit" + (small ? " kdf-kitsmall" : ""));
      const g = h("div", "kdf-tg");
      g.append(h("span", "kd-label", "Gravity"));
      const seg = h("div", "kd-seg");
      for (const [id, name] of [["off", "Off"], ["drift", "Drift"], ["orbit", "Orbit"]]) {
        const b = h("button", (kv.gravity || "off") === id ? "kd-on" : "", name);
        b.title = id === "drift" ? "Dots breathe in to the centre and back out (8 bars)" : id === "orbit" ? "Dots circle the centre (4 bars a turn)" : "Dots stay where you put them";
        b.onclick = () => { kv.gravity = id; change(); };
        seg.append(b);
      }
      g.append(seg);
      box.append(g);
      // Speed / Amount / Random under it (Eman, 28 Oct): drag left/right, double-click resets
      if ((kv.gravity || "off") !== "off") {
        const gs = h("div", "kdf-grav"), G = KdFx.grav(kv);
        const SL = [
          { k: "speed", label: "Speed", def: 1, to: (v) => Math.pow(16, v) / 4, from: (x) => Math.log(x * 4) / Math.log(16), fmt: (x) => (x < 1 ? x.toFixed(2).replace(/0$/, "") : x.toFixed(x < 2 ? 2 : 1).replace(/\.?0+$/, "")) + "\u00d7", tip: "How fast the dots move (1\u00d7 = drift 8 bars, orbit 4 bars a turn)" },
          { k: "amount", label: "Amount", def: 1, to: (v) => v, from: (x) => x, fmt: (x) => Math.round(x * 100) + "%", tip: kv.gravity === "orbit" ? "How far round they go (100% = full circles, less = swing back and forth)" : "How far in to the centre they breathe" },
          { k: "rand", label: "Random", def: 0, to: (v) => v, from: (x) => x, fmt: (x) => Math.round(x * 100) + "%", tip: "Each pad its own speed and start, so they stop moving together" },
        ];
        for (const sl of SL) {
          const el2 = h("div", "kd-bar kdf-gbar"); el2.title = sl.tip + ". Double-click resets";
          el2.append(h("span", null, sl.label), h("b", null, ""));
          const paint = () => { const x = KdFx.grav(kv)[sl.k]; el2.style.setProperty("--v", Math.max(0, Math.min(1, sl.from(x))).toFixed(3)); el2.querySelector("b").textContent = sl.fmt(x); };
          let d = null;
          el2.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.preventDefault(); el2.setPointerCapture(e.pointerId); d = { x: e.clientX, v0: sl.from(KdFx.grav(kv)[sl.k]), w: Math.max(80, el2.clientWidth) }; el2.classList.add("kd-drag"); });
          el2.addEventListener("pointermove", (e) => { if (!d) return; const v = Math.max(0, Math.min(1, d.v0 + (e.clientX - d.x) / d.w)); kv.grav = Object.assign(KdFx.grav(kv), { [sl.k]: +sl.to(v).toFixed(3) }); paint(); live(); });
          const up = () => { if (!d) return; d = null; el2.classList.remove("kd-drag"); persist(true); };
          el2.addEventListener("pointerup", up); el2.addEventListener("pointercancel", up);
          el2.addEventListener("dblclick", () => { kv.grav = Object.assign(KdFx.grav(kv), { [sl.k]: sl.def }); paint(); live(); persist(true); });
          paint(); gs.append(el2);
        }
        box.append(gs);
      }
      if (!small) {
        const keys = h("div", "kdf-keys");
        for (const [k, t] of [["S", "Sync: one dot for every pad"], ["D", "Dice: new spots and presets"], ["R", "Hold + drag a dot: record its motion"], ["Alt", "Drag in sync: move the whole shape"], ["Esc", "Let go of the dots"]]) keys.append(h("kbd", null, k), h("span", null, t));
        box.append(keys);
      }
      return box;
    }

    function toggleSync() {
      kv.sync = !kv.sync;
      if (kv.sync) ctx.say && ctx.say("SYNC: every pad shares one dot. Turn it off and they spring back.");
      change();
    }
    function closeMenu() { if (menu) { menu = null; drawPick(); if (desc()) drawSide(); } }
    // while FX is off, the circle says so and has one big switch
    const offCard = h("div", "kdf-offcard");
    offCard.append(h("div", "kdf-offtitle", "FX is off"), h("div", "kdf-offsub", "The beat plays the plain sounds."));
    const offBtn = h("button", "kdf-offbtn", "Turn FX on"); offBtn.onclick = () => power(true);
    offCard.append(offBtn); stage.append(offCard);
    function drawOff() { const on = KdFx.isOn(kv); offCard.hidden = on; stage.classList.toggle("kdf-isoff", !on); }
    function drawAll() { drawPads(); drawPick(); drawSide(); drawAB(); drawRead(); drawOff(); }

    prevFx.onclick = () => stepEffect(-1);
    nextFx.onclick = () => stepEffect(1);
    fxName.onclick = () => { menu = menu === "fx" ? null : "fx"; drawPick(); };
    grid.onclick = (e) => { if (e.target === grid) closeMenu(); };

    // ---------------------------------------------------------------- live loop: row flashes, meters
    function frame() {
      raf = 0;
      if (!visible || !alive) return;
      const now = KdFx.now ? KdFx.now() : null, ms = performance.now();
      if (now != null) {
        if (lastT == null) lastT = now;
        const ev = KdFx.events || [];
        for (let i = Math.max(0, ev.length - 200); i < ev.length; i++) {
          const e = ev[i];
          if (e && e.kind === "hit" && e.t > lastT && e.t <= now) flashes.set(Number(e.note), ms + 150);
        }
        lastT = now;
      }
      for (const [note, row] of rows) {
        const on = (flashes.get(note) || 0) > ms;
        if (on !== row.classList.contains("kd-hit")) row.classList.toggle("kd-hit", on);
      }
      const mets = side.querySelectorAll(".kdf-meter");
      if (mets.length) {
        const ts = kv.sync ? voices().map((v) => v.note) : targets();
        let m = null;
        if (KdFx.host && KdFx.host.meter) for (const t of ts) {
          const x = KdFx.host.meter(t);
          if (x && (!m || x.outDb > m.outDb)) m = x;
        }
        for (const r of mets) {
          const db = m ? num(m[r.dataset.k + "Db"], -90) : -90;
          r.children[1].firstChild.style.width = clamp((db + 60) / 66) * 100 + "%";
          r.children[2].textContent = db > -60 ? (db > 0 ? "+" : "") + db.toFixed(0) : "–";
        }
      }
      raf = requestAnimationFrame(frame);
    }
    const loop = () => { if (!raf && visible && alive) raf = requestAnimationFrame(frame); };

    // ---------------------------------------------------------------- keys (only while this tab is up)
    const shown = () => visible && alive && !pane.hidden && pane.isConnected && pane.offsetParent !== null;
    const typing = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== "range" || el.isContentEditable);
    function onKey(e) {
      if (!shown() || typing(e.target) || e.metaKey || e.ctrlKey) return;
      // only when the window has focus or the mouse is over the tab (R is Record in the app)
      if (!root.contains(document.activeElement) && !hover) return;
      const k = e.key.toLowerCase();
      let used = true;
      if (k === "s" && !e.repeat) toggleSync();
      else if (k === "d" && !e.repeat) dice();
      else if (k === "r") { if (!recKey) { recKey = true; KdFx.recKey = true; } }
      else if (e.key === "Escape" && (sel.size || menu)) { sel.clear(); menu = null; drawAll(); }
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    }
    function onKeyUp(e) {
      if (e.key.toLowerCase() === "r" && recKey) { recKey = false; KdFx.recKey = false; if (shown()) { e.preventDefault(); e.stopPropagation(); } }
    }
    const onBlur = () => { recKey = false; KdFx.recKey = false; };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    pane.addEventListener("pointerenter", () => (hover = true));
    pane.addEventListener("pointerleave", () => (hover = false));
    // clicks on the canvas keep the keys here (the window takes focus, not the page)
    pane.addEventListener("pointerdown", () => { if (!typing(document.activeElement) && root !== pane && root.focus) root.focus({ preventScroll: true }); }, true);

    // effects that load later show up at once
    const offReg = KdFx.onRegister ? KdFx.onRegister(() => {
      if (!alive) return;
      if (!kv.effect || !KdFx.byId[kv.effect] && !kv.fx[kv.effect]) {
        const first = KdFx.effects[0];
        if (first && !kv.effect) { kv.effect = first.id; KdFx.space(kv, first.id); live(); persist(false); }
      } else if (KdFx.byId[kv.effect]) KdFx.space(kv, kv.effect);
      drawAll();
    }) : null;

    drawAll();
    loop();

    return {
      show() { visible = true; lastT = null; if (portal && portal.resume) portal.resume(); drawAll(); loop(); },
      hide() { visible = false; recKey = false; menu = null; if (raf) cancelAnimationFrame(raf); raf = 0; if (portal && portal.pause) portal.pause(); },
      kitChanged(e) {
        readKit(e);
        const s = e && e.kitVoid ? JSON.stringify(e.kitVoid) : "";
        // our own saves come back here too; only a different FX state (undo, another tab) reloads
        if (s !== saved && !drag) { kv = load(e && e.kitVoid); saved = s; live(); }
        if (visible) drawAll();
      },
      destroy() {
        alive = false; visible = false;
        if (raf) cancelAnimationFrame(raf);
        clearTimeout(wetT);
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("keyup", onKeyUp, true);
        window.removeEventListener("blur", onBlur);
        if (offReg) offReg();
        hookDrop(null);
        if (portal && portal.destroy) try { portal.destroy(); } catch (e) { /* gone */ }
        portal = null;
      },
      // for tests and the assistant: the live state
      state: () => kv, select: (notes) => { sel.clear(); for (const n of [].concat(notes || [])) sel.add(n); drawAll(); },
    };
  }

  window.KillDrumTabs = window.KillDrumTabs || [];
  window.KillDrumTabs.push({ id: "fx", label: "FX", order: 2, mount });
})();
