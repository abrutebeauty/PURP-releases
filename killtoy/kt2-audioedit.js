// KILLTOY 2: the audio editor, round 2 (Eman, 6 Nov 23:12, design page "One editor, four looks").
// Double-click an audio clip. One sound per editor. The waveform IS the editor:
//  - SONG MAP on top, always: the whole clip, its parts, the yellow box = what you see. Drag the box
//    to move, its edges to zoom, click to jump. Edits leave marks (lilac = moved, red = stretched/cut).
//  - MOVE look (home): beat blocks, bar numbers in the sound, white hit dots. Drag across the sound
//    (snaps), a CUT button shows under it. CUT = the part turns lilac, its own piece. THEN drag it
//    anywhere: it lifts out, the gap closes, a yellow slot opens where it lands, the rest slides
//    aside live. Shift = replace, Alt = copy. Delete = take it out and close the gap.
//  - STRETCH look: grab a white hit dot and pull. Yellow pins, the sound stretches like rubber
//    between the pins on each side, red = stretched hard. Double-click a pin to drop it.
//  - CUT look: zoom in until about a beat fills the screen. A fixed yellow line in the middle, bar -
//    beat - ms on top; swipe/drag to slide the sound under it, a magnet pulls it onto hits. B cuts.
//  The look follows what you grab and how far you zoom; the MOVE / STRETCH / CUT chips lock one.
//  Snap follows the zoom: bars, beats, hits, then free (single samples).
//  The beat grid comes from DEEP LISTEN (listenAudio in the engine): it follows tempo drift and
//  counts through breaks. The clip is a list of pieces of the original (editAudio), so the file is
//  never touched and RESET always gets it back. KT2_AE_OLD = true opens the editor from before.
(function () {
  if (!document.documentElement.classList.contains("kt2")) return;
  const ACID = "#e4ff3a", LILAC = "#c9a8ff", RED = "#ff3355", BG = "#121215", PANEL = "#18181c", PANEL2 = "#1f1f25";
  const MONO = '"Martian Mono", ui-monospace, Menlo, monospace', DISP = "Unbounded, Inter, sans-serif";
  const PM = "kt2.aePlayMode";
  const pmode = () => { try { return localStorage.getItem(PM) === "track" ? "track" : "loop"; } catch (e) { return "loop"; } };
  const E = { c: null, box: null };
  let UID = 1;
  const spb = () => 60 / ((ui.state && ui.state.bpm) || 120);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
  const now = () => performance.now();

  // ---------------------------------------------------------------- pieces
  // { id, from, len, dur, at, semi, warp:[[s,d]...] } seconds. from/len = the original audio it takes,
  // at/dur = where it sits in the clip and how long it plays. warp pins: s into its audio plays at d.
  const durOf = (p) => (p.dur > 0 ? p.dur : p.len);
  const endOf = (ps) => Math.max(0, ...ps.map((p) => p.at + durOf(p)));
  const clone = (ps) => ps.map((p) => ({ ...p, warp: p.warp ? p.warp.map((w) => w.slice()) : undefined }));
  const pinsOf = (p) => [[0, 0], ...(p.warp || []).slice().sort((a, b) => a[1] - b[1]), [p.len, durOf(p)]];
  function srcAt(p, d) {   // seconds into the piece (as it plays) -> seconds into its audio
    if (!p.warp && Math.abs(durOf(p) - p.len) < 1e-6) return d;
    const P = pinsOf(p);
    for (let i = 0; i < P.length - 1; i++) if (d <= P[i + 1][1] || i === P.length - 2) { const [s0, d0] = P[i], [s1, d1] = P[i + 1]; return d1 - d0 < 1e-9 ? s0 : s0 + ((d - d0) / (d1 - d0)) * (s1 - s0); }
    return d;
  }
  function dspAt(p, s) {   // the other way
    if (!p.warp && Math.abs(durOf(p) - p.len) < 1e-6) return s;
    const P = pinsOf(p);
    for (let i = 0; i < P.length - 1; i++) if (s <= P[i + 1][0] || i === P.length - 2) { const [s0, d0] = P[i], [s1, d1] = P[i + 1]; return s1 - s0 < 1e-9 ? d0 : d0 + ((s - s0) / (s1 - s0)) * (d1 - d0); }
    return s;
  }
  // split one piece at d seconds into it (pins go with their side)
  function splitPiece(p, d) {
    const s = srcAt(p, d), D = durOf(p);
    const a = { ...p, id: p.id, len: s, dur: d, warp: undefined }, b = { ...p, id: UID++, from: p.from + s, len: p.len - s, dur: D - d, at: p.at + d, warp: undefined };
    const wa = [], wb = [];
    for (const [ws, wd] of p.warp || []) { if (wd < d - 1e-4) wa.push([ws, wd]); else if (wd > d + 1e-4) wb.push([ws - s, wd - d]); }
    if (wa.length) a.warp = wa; if (wb.length) b.warp = wb;
    for (const q of [a, b]) if (!q.warp && Math.abs(q.dur - q.len) < 1e-6) delete q.dur;
    return [a, b];
  }
  function cutAtT(ps, t) {   // cut whatever piece covers clip time t
    const out = [];
    for (const p of ps) {
      if (t > p.at + 0.004 && t < p.at + durOf(p) - 0.004) out.push(...splitPiece(p, t - p.at));
      else out.push({ ...p });
    }
    return out;
  }
  const sortP = (ps) => ps.sort((a, b) => a.at - b.at);
  // ripple: take the block [a,b) out and close the gap
  function closeGap(ps, a, b) { const L = b - a; return ps.map((p) => (p.at >= b - 1e-6 ? { ...p, at: p.at - L } : p)); }
  // the arrangement while (or after) moving the block of piece ids to T
  function arrange(ps, ids, T, how) {
    const blk = ps.filter((p) => ids.has(p.id)), rest = ps.filter((p) => !ids.has(p.id));
    if (!blk.length) return null;
    const ga = Math.min(...blk.map((p) => p.at)), gb = Math.max(...blk.map((p) => p.at + durOf(p))), L = gb - ga;
    let base = how === "copy" || how === "over" ? rest.map((p) => ({ ...p })) : closeGap(rest, ga, gb);
    if (how === "copy") base = ps.map((p) => ({ ...p }));
    let out;
    if (how === "over") {   // replace what is there, nothing moves
      out = [];
      for (const p of cutAtT(cutAtT(base, T), T + L)) if (!(p.at >= T - 1e-6 && p.at + durOf(p) <= T + L + 1e-6)) out.push(p);
    } else {
      out = cutAtT(base, T).map((p) => (p.at >= T - 1e-6 ? { ...p, at: p.at + L } : p));
    }
    const moved = blk.map((p) => ({ ...p, id: how === "copy" ? UID++ : p.id, at: T + (p.at - ga) }));
    out.push(...moved);
    return { ps: sortP(out), moved: new Set(moved.map((p) => p.id)), ga, gb, L };
  }

  // ---------------------------------------------------------------- the grid (deep listen)
  // In clip time: every beat of every piece, bars counted in the order you hear them.
  function grid() {
    if (E.gridV === E.ver) return E.grid;
    const A = E.an, beats = [], hits = [];
    if (A && A.beats && A.beats.length) {
      for (const p of E.pieces) {
        A.beats.forEach((b, i) => { if (b >= p.from - 1e-6 && b < p.from + p.len - 1e-6) beats.push({ t: p.at + dspAt(p, b - p.from), down: ((i - A.down) % 4 + 4) % 4 === 0, conf: A.conf[i] || 0, src: b }); });
        for (const h of A.hits) if (h.t >= p.from - 1e-6 && h.t < p.from + p.len - 1e-6) hits.push({ t: p.at + dspAt(p, h.t - p.from), s: h.s, pid: p.id, src: h.t });
      }
    } else {   // still listening: the song's grid
      const b = spb(), off = ((-E.c.start % b) + b) % b;
      for (let t = off; t < Math.max(endOf(E.pieces), E.origLen) + b; t += b) beats.push({ t, down: Math.round((E.c.start + t) / b) % 4 === 0, conf: 0.5 });
    }
    beats.sort((a, b) => a.t - b.t); hits.sort((a, b) => a.t - b.t);
    // bar numbers in the order you hear them; a beat that lands on top of another (a cut joint) is dropped
    const clean = []; for (const x of beats) { const l = clean[clean.length - 1]; if (l && x.t - l.t < 0.05) continue; clean.push(x); }
    let bar = 0, seen = false; for (const x of clean) { if (x.down) { bar++; seen = true; } x.bar = seen ? bar : 0; }
    E.grid = { beats: clean, hits }; E.gridV = E.ver;
    return E.grid;
  }
  const beatLen = () => { const g = grid().beats; if (g.length < 3) return spb(); const k = Math.min(g.length - 1, 16); return (g[k].t - g[0].t) / k; };
  function pxPerBeat() { return beatLen() / secPerPx(); }
  function snapLevel() { const pb = pxPerBeat(); return pb < 14 ? "BAR" : pb < 90 ? "BEAT" : pb < 1100 ? "HIT" : "FREE"; }
  function nearest(arr, t) { let lo = 0, hi = arr.length - 1; if (hi < 0) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] < t) lo = m; else hi = m; } return Math.abs(arr[lo] - t) <= Math.abs(arr[hi] - t) ? arr[lo] : arr[hi]; }
  function snapT(t, level) {
    level = level || snapLevel();
    if (level === "FREE") return t;
    const G = grid(), end = endOf(E.pieces);
    const edges = [0, end, ...E.pieces.map((p) => p.at)];
    if (level === "BAR") return nearest([...G.beats.filter((b) => b.down).map((b) => b.t), ...edges].sort((a, b) => a - b), t);
    const bt = G.beats.map((b) => b.t);
    if (level === "BEAT") return nearest([...bt, ...edges].sort((a, b) => a - b), t);
    // HIT: a hit within a 16th wins, else the 16th grid between the beats
    const bl = beatLen(), h = nearest(G.hits.map((x) => x.t), t);
    if (h != null && Math.abs(h - t) < bl / 4) return h;
    let lo = 0; while (lo < bt.length - 1 && bt[lo + 1] <= t) lo++;
    const a = bt[lo] != null ? bt[lo] : 0, b = bt[lo + 1] != null ? bt[lo + 1] : a + bl, q = (b - a) / 4;
    return a + Math.round((t - a) / q) * q;
  }
  function barSpan(t) {   // the bar around t
    const d = grid().beats.filter((b) => b.down).map((b) => b.t);
    let a = 0, b = endOf(E.pieces);
    for (const x of d) { if (x <= t + 1e-6) a = x; else { b = x; break; } }
    return { a, b };
  }

  // ---------------------------------------------------------------- song parts (from the bars)
  function findSections() {
    const A = E.an, ov = E.ov; if (!A || !ov || !A.beats.length) return [];
    const downs = A.beats.filter((_, i) => ((i - A.down) % 4 + 4) % 4 === 0);
    if (downs.length < 2) return [];
    const lvl = [];
    for (let i = 0; i < downs.length; i++) {
      const a = downs[i], b = downs[i + 1] || E.origLen, ia = Math.floor((a / E.origLen) * ov.n), ib = Math.max(ia + 1, Math.floor((b / E.origLen) * ov.n));
      let s = 0; for (let k = ia; k < ib && k < ov.n; k++) s += ov.rms[k]; lvl.push(s / (ib - ia));
    }
    const top = Math.max(1e-6, ...lvl), starts = [0];
    for (let b = 1; b < lvl.length; b++) {   // a part starts where the level steps, on a 4-bar line or after a break of 2+ bars
      const prev = lvl.slice(Math.max(0, b - 4), b).reduce((x, y) => x + y, 0) / Math.min(4, b), next = lvl.slice(b, b + 4).reduce((x, y) => x + y, 0) / Math.max(1, Math.min(4, lvl.length - b));
      const jump = Math.abs(next - prev) / top;
      if ((b % 4 === 0 && jump > 0.14) || (jump > 0.3 && b - starts[starts.length - 1] >= 2)) starts.push(b);
    }
    const parts = starts.map((b, i) => { const e = starts[i + 1] || lvl.length, m = lvl.slice(b, e).reduce((x, y) => x + y, 0) / Math.max(1, e - b); return { at: downs[b], end: downs[e] || E.origLen, lvl: m / top, bars: e - b }; });
    parts.forEach((p, i) => { p.name = i === 0 && p.lvl < 0.55 ? "INTRO" : i === parts.length - 1 && p.lvl < 0.55 && parts.length > 2 ? "OUTRO" : p.lvl > 0.8 ? "HOOK" : p.lvl < 0.45 ? "BREAK" : "VERSE"; });
    return parts;
  }
  function sectionsShown() {   // the parts, where they sit now
    const out = [];
    for (const p of E.pieces) for (const s of E.secs) {
      const a = Math.max(s.at, p.from), b = Math.min(s.end, p.from + p.len); if (b <= a + 1e-6) continue;
      const x = { n: s.name, a: p.at + dspAt(p, a - p.from), b: p.at + dspAt(p, b - p.from) };
      const l = out[out.length - 1]; if (l && l.n === x.n && Math.abs(l.b - x.a) < 0.02) l.b = x.b; else out.push(x);
    }
    return out.sort((a, b) => a.a - b.a);
  }

  // ---------------------------------------------------------------- history + engine
  function commit(ps, sound) {
    E.hist.push(clone(E.pieces)); E.fut.length = 0;
    E.pieces = sortP(ps); E.ver++; send(); bar(); dirty();
    if (sound && window.KT2Juice && KT2Juice.sound && KT2Juice.sound[sound]) KT2Juice.sound[sound]();
  }
  function undo() { if (!E.hist.length) return; E.fut.push(clone(E.pieces)); E.pieces = E.hist.pop(); afterJump(); }
  function redo() { if (!E.fut.length) return; E.hist.push(clone(E.pieces)); E.pieces = E.fut.pop(); afterJump(); }
  function afterJump() { E.ver++; E.loose.clear(); E.sel = null; E.ghost = null; send(); bar(); dirty(); }
  const isOrig = (ps) => ps.length === 1 && !ps[0].from && !ps[0].at && !ps[0].semi && !ps[0].warp && !ps[0].dur && Math.abs(ps[0].len - E.origLen) < 1e-3;
  function reset() {
    if (isOrig(E.pieces)) return;
    E.hist.push(clone(E.pieces)); E.fut.length = 0;
    E.pieces = [{ id: UID++, from: 0, len: E.origLen, at: 0, semi: 0 }]; afterJump();
    toast("Back to the original.");
  }
  let sendT = 0;
  function send() {
    clearTimeout(sendT);
    sendT = setTimeout(() => {
      const ps = E.pieces.filter((p) => durOf(p) > 0.003).map((p) => ({ from: p.from, len: p.len, at: p.at, semi: p.semi || 0, ...(p.dur && Math.abs(p.dur - p.len) > 1e-4 ? { dur: p.dur } : {}), ...(p.warp && p.warp.length ? { warp: p.warp } : {}) }));
      if (!E.c) return;
      if (isOrig(E.pieces)) run("editAudio", { clipId: E.c.id, reset: true });
      else run("editAudio", { clipId: E.c.id, pieces: ps }).then((r) => { if (r && r.error) toast(r.error); });
    }, 80);
  }

  // ---------------------------------------------------------------- the view (zoom / pan, smooth)
  const LAY = { L: 14, R: 14, MAP: [8, 46], SEC: [54, 72], RUL: [74, 96], PIN: 96, WAV0: 102, BOT: 40 };
  function W() { return E.cv ? E.cv.clientWidth : 1000; }
  function H() { return E.cv ? E.cv.clientHeight : 400; }
  const span = () => E.v.b - E.v.a;
  const secPerPx = () => span() / Math.max(1, W() - LAY.L - LAY.R);
  const X = (t) => LAY.L + ((t - E.v.a) / span()) * (W() - LAY.L - LAY.R);
  const T = (x) => E.v.a + ((x - LAY.L) / (W() - LAY.L - LAY.R)) * span();
  const fullView = () => { const e = Math.max(endOf(E.pieces), 0.5); return { a: -e * 0.01, b: e * 1.01 }; };
  function limit(v) {
    const e = Math.max(endOf(E.pieces), 0.5), minS = 48 / 44100 * 4, maxS = e * 1.2;
    let s = clamp(v.b - v.a, minS, maxS), c = (v.a + v.b) / 2;
    c = clamp(c, -s * 0.45, e + s * 0.45 - (s > e ? 0 : 0));
    if (s >= e) c = clamp(c, e / 2 - (s - e) / 2, e / 2 + (s - e) / 2);
    return { a: c - s / 2, b: c + s / 2 };
  }
  function zoomAt(f, x) {   // f > 1 = closer
    const t = E.look === "CUT" && !E.lock ? (E.vt.a + E.vt.b) / 2 : E.vt.a + ((x - LAY.L) / (W() - LAY.L - LAY.R)) * (E.vt.b - E.vt.a);
    const k = (x - LAY.L) / (W() - LAY.L - LAY.R), s = (E.vt.b - E.vt.a) / f;
    const c = E.look === "CUT" && !E.lock ? t : t - k * s + s / 2;
    E.vt = limit({ a: c - s / 2, b: c + s / 2 }); dirty();
  }
  function panBy(dt) { E.vt = limit({ a: E.vt.a + dt, b: E.vt.b + dt }); dirty(); }
  function viewTo(v, snap) { E.vt = limit(v); if (snap) E.v = { ...E.vt }; dirty(); }

  // ---------------------------------------------------------------- the waveform data
  // overview: the original in ~256-sample blocks; close-up: getWaveDetail of the original per piece
  function overview(c) {
    const n = clamp(Math.ceil(E.origLen * 172), 2000, 60000);
    return booth("getPeaks", { clipId: c.id, buckets: n, orig: true }).then((p) => {
      if (!p || E.c !== c) return;
      const mx = p.max || p.peak, mn = p.min || p.peak.map((v) => -v);
      let loud = 0.05; for (let i = 0; i < mx.length; i++) loud = Math.max(loud, mx[i], -mn[i]);
      E.ov = { max: mx, min: mn, rms: p.rms || p.peak, n: mx.length, loud };
      if (E.an) E.secs = findSections();
      E.ver++; dirty();
    });
  }
  function wantDetail() {
    if (!E.ov || E.detBusy) return;
    const bucket = E.origLen / E.ov.n, spp = secPerPx();
    if (spp > bucket * 0.8) return;
    const w = W() - LAY.L - LAY.R;
    for (const p of E.pieces) {
      const a = Math.max(p.at, E.v.a), b = Math.min(p.at + durOf(p), E.v.b); if (b <= a) continue;
      const s0 = p.from + srcAt(p, a - p.at), s1 = p.from + srcAt(p, b - p.at);
      const pad = (s1 - s0) * 0.25, from = Math.max(0, s0 - pad), to = Math.min(E.origLen, s1 + pad);
      const have = E.det.get(p.id);
      const cols = Math.ceil(((to - from) / (s1 - s0 || 1e-9)) * ((b - a) / span()) * w);
      if (have && have.from <= s0 + 1e-6 && have.to >= s1 - 1e-6 && Math.abs(have.res - (to - from) / cols) / have.res < 0.6) continue;
      E.detBusy = true;
      const c = E.c, key = p.id;
      booth("getWaveDetail", { clipId: c.id, from, to, cols: Math.max(16, Math.min(8000, cols)), orig: true }).then((d) => {
        E.detBusy = false;
        if (!d || E.c !== c) return;
        E.det.set(key, { from, to, res: (to - from) / Math.max(16, cols), ...d }); dirty();
      }).catch(() => { E.detBusy = false; });
      return;
    }
  }

  // ---------------------------------------------------------------- open / close
  async function open(c) {
    if (window.KT2_AE_OLD && window.KT2AudioEditOld) return KT2AudioEditOld.open(c);
    if (!c || c.kind === "midi") return;
    close();
    Object.assign(E, { c, hist: [], fut: [], ver: 1, gridV: 0, an: null, ov: null, det: new Map(), detBusy: false, secs: [], sel: null, loose: new Set(), ghost: null,
      drag: null, hover: null, lock: null, held: null, look: "MOVE", loop: null, solo: false, anim: new Map(), fade: new Map(), fx: [], warpLive: null, magnetT: 0, lastIn: 0 });
    E.origLen = c.edit ? c.edit.orig.length : c.length;
    E.pieces = c.edit ? c.edit.pieces.map((p) => ({ ...p, id: UID++, warp: p.warp ? p.warp.map((w) => w.slice()) : undefined })) : [{ id: UID++, from: 0, len: c.length, at: 0, semi: 0 }];
    let col = (typeof colorOf === "function" && c.track ? colorOf(c.track) : null) || "#9aa0ff";
    if (/^var\(/.test(col)) col = getComputedStyle(document.documentElement).getPropertyValue(col.slice(4, -1).trim()).trim() || "#9aa0ff";
    E.col = col;
    const ob = (c.orig && c.orig.bpm) || c.bpm || 0, sb = Math.round((ui.state && ui.state.bpm) || 120);
    const box = document.createElement("div");
    box.className = "kae2";
    box.innerHTML = `<div class="kae2-win" role="dialog" aria-label="Audio editor">
      <div class="kae2-top">
        <i class="kae2-sw" style="background:${col}"></i><b class="kae2-nm"></b>
        <span class="kae2-chip kae2-bpm">${ob ? Math.round(ob) : sb} <small>BPM</small></span>
        <span class="kae2-chip kae2-listen"><small>LISTENING</small><i></i></span>
        <span class="kae2-read"></span>
        <span class="kae2-sp"></span>
        <div class="kae2-looks" role="group" aria-label="Look"><button data-l="MOVE">MOVE</button><button data-l="STRETCH">STRETCH</button><button data-l="CUT">CUT</button></div>
        <div class="kae2-seg"><button data-m="loop">LOOP</button><button data-m="track">TRACK</button></div>
        <button data-a="play" class="kae2-play" title="Play / stop (Space)"><svg viewBox="0 0 16 16" width="13" height="13"><path d="M4.5 3.2v9.6L12.5 8z"/></svg></button>
        <button data-a="undo" title="Undo (Cmd+Z)">${svg('<path d="M5 3L2 6l3 3"/><path d="M2 6h8a4 4 0 0 1 0 8H7"/>')}</button>
        <button data-a="redo" title="Redo (Shift+Cmd+Z)">${svg('<path d="M11 3l3 3-3 3"/><path d="M14 6H6a4 4 0 0 0 0 8h3"/>')}</button>
        <button data-a="reset" title="Back to the original">RESET</button>
        <button data-a="tune" title="Open TUNR">TUNR</button>
        <button data-a="close" class="kae2-x" title="Close (Esc)">x</button>
      </div>
      <div class="kae2-stage"><canvas></canvas>
        <button class="kae2-cut" hidden>${svg('<circle cx="4" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><path d="M5.5 10.5L12 2M10.5 10.5L4 2"/>')}CUT</button>
        <div class="kae2-piece" hidden><button data-t="-1" title="Down a semitone">-</button><em></em><button data-t="1" title="Up a semitone">+</button><button data-t="del" title="Take it out (Delete)">${svg('<path d="M3 4h10M6 4V2h4v2M4.5 4l.7 10h5.6l.7-10"/>')}</button></div>
      </div>
    </div>`;
    box.querySelector(".kae2-nm").textContent = c.name;
    document.body.append(box);
    E.box = box; E.cv = box.querySelector("canvas"); E.cutBtn = box.querySelector(".kae2-cut"); E.pieceBar = box.querySelector(".kae2-piece");
    box.addEventListener("mousedown", (e) => { if (e.target === box) close(); });
    box.querySelectorAll(".kae2-seg button").forEach((b) => b.addEventListener("click", async (e) => {
      e.stopPropagation(); if (b.dataset.m === pmode()) return;
      const was = E.solo || playing(); if (was) await stop();
      try { localStorage.setItem(PM, b.dataset.m); } catch (err) { /* fine */ }
      bar(); if (was) play();
    }));
    box.querySelectorAll(".kae2-looks button").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); E.lock = E.lock === b.dataset.l ? null : b.dataset.l; bar(); dirty(); }));
    box.querySelectorAll(".kae2-top button[data-a]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(); const a = b.dataset.a;
      if (a === "play") toggle(); else if (a === "close") close(); else if (a === "undo") undo(); else if (a === "redo") redo(); else if (a === "reset") reset();
      else if (a === "tune") { const cc = findClip(E.c.id); close(); if (cc && typeof openTune === "function") openTune(cc); }
    }));
    E.cutBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    E.cutBtn.addEventListener("click", (e) => { e.stopPropagation(); doCut(); });
    E.pieceBar.addEventListener("mousedown", (e) => e.stopPropagation());
    E.pieceBar.querySelectorAll("button").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); b.dataset.t === "del" ? removeLoose() : transpose(+b.dataset.t); }));
    bindStage(box.querySelector(".kae2-stage"));
    if (box.animate) box.querySelector(".kae2-win").animate([{ opacity: 0, transform: "translateY(10px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: "cubic-bezier(.2,.9,.3,1)" });
    if (window.KT2Juice && KT2Juice.sound && KT2Juice.sound.open) KT2Juice.sound.open();
    E.v = fullView(); E.vt = { ...E.v };
    bar(); loop();
    overview(c);
    booth("listenAudio", { clipId: c.id }).then((r) => {
      if (E.c !== c) return;
      if (r && !r.error && r.beats && r.beats.length) { E.an = r; if (E.ov) E.secs = findSections(); E.ver++; }
      const lc = E.box.querySelector(".kae2-listen");
      if (lc) { lc.classList.add("done"); lc.innerHTML = r && r.bpm ? `<small>LISTENED</small> ${r.bpm % 1 ? r.bpm.toFixed(1) : r.bpm}` : "<small>NO STEADY BEAT</small>"; }
      bar(); dirty();
    });
  }
  function close() {
    if (!E.box) return;
    cancelAnimationFrame(E.raf);
    if (E.onResize) { removeEventListener("resize", E.onResize); E.onResize = null; }
    if (E.solo) { E.solo = false; booth("laneSolo", { on: false }); }
    E.box.remove(); E.box = null; E.c = null; E.drag = null; E.cv = null;
  }
  const svg = (inner) => `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square">${inner}</svg>`;

  // ---------------------------------------------------------------- playing
  const playing = () => !!(ui.transport && ui.transport.playing);
  async function play() {
    if (!E.c) return;
    const lp = E.loop || (E.sel ? { a: E.sel.a, b: E.sel.b } : null) || { a: 0, b: endOf(E.pieces) };
    if (pmode() === "loop") { const r = await booth("laneSolo", { trackId: E.c.track && E.c.track.id, clipId: E.c.id, from: lp.a, to: lp.b }); E.solo = !!(r && r.ok); }
    else { if (E.solo) { E.solo = false; await booth("laneSolo", { on: false }); } await run("setPosition", { time: E.c.start + lp.a }); if (!playing()) await run("togglePlay"); }
    bar(); dirty();
  }
  async function stop() { if (E.solo) { E.solo = false; await booth("laneSolo", { on: false }); } else if (playing()) await run("togglePlay"); bar(); dirty(); }
  const toggle = () => (E.solo || playing() ? stop() : play());

  // ---------------------------------------------------------------- actions
  function doCut() {   // the selection becomes its own lilac piece(s)
    if (!E.sel) return;
    const { a, b } = E.sel;
    let ps = cutAtT(cutAtT(E.pieces, a), b);
    const ids = new Set(ps.filter((p) => p.at >= a - 1e-6 && p.at + durOf(p) <= b + 1e-6).map((p) => p.id));
    if (!ids.size) return;
    E.sel = null; E.ghost = null;
    commit(ps, "land");
    E.loose = ids; E.fx.push({ kind: "flash", a, b, t0: now() });
    for (const id of ids) E.fade.delete(id);
    bar(); dirty();
  }
  function cutHere(t) {   // B: cut at t (no selection)
    const ps = cutAtT(E.pieces, t);
    if (ps.length === E.pieces.length) return;
    commit(ps, "land"); E.fx.push({ kind: "line", t, t0: now() });
  }
  function looseSpan() { const bl = E.pieces.filter((p) => E.loose.has(p.id)); if (!bl.length) return null; return { a: Math.min(...bl.map((p) => p.at)), b: Math.max(...bl.map((p) => p.at + durOf(p))) }; }
  function removeLoose() {
    let sp = looseSpan(), ps;
    if (sp) ps = E.pieces.filter((p) => !E.loose.has(p.id));
    else if (E.sel) { sp = E.sel; ps = cutAtT(cutAtT(E.pieces, sp.a), sp.b).filter((p) => !(p.at >= sp.a - 1e-6 && p.at + durOf(p) <= sp.b + 1e-6)); }
    else return;
    if (!ps.length) return toast("That's all of it. RESET brings it back.");
    E.clipboard = E.pieces.filter((p) => p.at >= sp.a - 1e-6 && p.at + durOf(p) <= sp.b + 1e-6).map((p) => ({ ...p }));
    commit(closeGap(ps, sp.a, sp.b), "poof");
    E.fx.push({ kind: "close", t: sp.a, t0: now() });
    E.loose.clear(); E.sel = null; bar();
  }
  function copyLoose() {
    const sp = looseSpan() || E.sel; if (!sp) return;
    E.clipboard = cutAtT(cutAtT(E.pieces, sp.a), sp.b).filter((p) => p.at >= sp.a - 1e-6 && p.at + durOf(p) <= sp.b + 1e-6).map((p) => ({ ...p }));
    toast("Copied.");
  }
  function paste() {
    if (!E.clipboard || !E.clipboard.length) return;
    const pos = ui.transport ? clamp(ui.transport.position - E.c.start, 0, endOf(E.pieces)) : 0, T0 = snapT(pos, "BEAT");
    const ga = Math.min(...E.clipboard.map((p) => p.at)), L = Math.max(...E.clipboard.map((p) => p.at + durOf(p))) - ga;
    const base = cutAtT(E.pieces, T0).map((p) => (p.at >= T0 - 1e-6 ? { ...p, at: p.at + L } : p));
    const add = E.clipboard.map((p) => ({ ...p, id: UID++, at: T0 + (p.at - ga) }));
    commit([...base, ...add], "land"); E.loose = new Set(add.map((p) => p.id)); bar();
  }
  function transpose(d) {
    if (!E.loose.size) return;
    commit(E.pieces.map((p) => (E.loose.has(p.id) ? { ...p, semi: clamp((p.semi || 0) + d, -12, 12) } : p)));
    if (window.KT2Juice && KT2Juice.step) KT2Juice.step("knob", d);
  }

  // ---------------------------------------------------------------- top bar + floating buttons
  function bar() {
    if (!E.box) return;
    const q = (s) => E.box.querySelector(s);
    q('[data-a="undo"]').disabled = !E.hist.length; q('[data-a="redo"]').disabled = !E.fut.length; q('[data-a="reset"]').disabled = isOrig(E.pieces);
    E.box.querySelectorAll(".kae2-seg button").forEach((b) => b.classList.toggle("on", b.dataset.m === pmode()));
    E.box.querySelectorAll(".kae2-looks button").forEach((b) => { b.classList.toggle("on", b.dataset.l === E.look); b.classList.toggle("lock", b.dataset.l === E.lock); b.dataset.k = b.dataset.l.toLowerCase(); });
    q(".kae2-play").classList.toggle("on", E.solo || playing());
    const ls = E.pieceBar;
    if (E.loose.size && !E.drag) {
      const bl = E.pieces.filter((p) => E.loose.has(p.id)), semi = bl[0] ? bl[0].semi || 0 : 0;
      ls.querySelector("em").textContent = (semi > 0 ? "+" : "") + semi;
    }
  }
  function placeFloating() {
    if (!E.box) return;
    const wb = H() - LAY.BOT;
    const showCut = !!E.sel && !E.drag && !E.loose.size;
    E.cutBtn.hidden = !showCut;
    if (showCut) { const x = clamp((X(E.sel.a) + X(E.sel.b)) / 2, LAY.L + 50, W() - LAY.R - 50); E.cutBtn.style.left = x + "px"; E.cutBtn.style.top = wb + 6 + "px"; }
    const sp = looseSpan(), showP = !!sp && !E.drag;
    E.pieceBar.hidden = !showP;
    if (showP) { const x = clamp((X(sp.a) + X(sp.b)) / 2, LAY.L + 70, W() - LAY.R - 70); E.pieceBar.style.left = x + "px"; E.pieceBar.style.top = wb + 6 + "px"; }
  }

  // ---------------------------------------------------------------- the frame loop (draws only when something changed)
  function dirty() { E.need = true; }
  function loop() {
    cancelAnimationFrame(E.raf);
    const go = () => {
      if (!E.box) return;
      E.raf = requestAnimationFrame(go);
      // the view glides to where it's going
      const dv = Math.abs(E.vt.a - E.v.a) + Math.abs(E.vt.b - E.v.b), sv = span();
      if (dv > sv * 1e-4) { const k = 0.32; E.v = { a: lerp(E.v.a, E.vt.a, k), b: lerp(E.v.b, E.vt.b, k) }; E.need = true; }
      else if (dv > 0) { E.v = { ...E.vt }; E.need = true; }
      // pieces slide to their places
      const tgt = targets(); let moving = false;
      for (const [id, at] of tgt) { const cur = E.anim.has(id) ? E.anim.get(id) : at; const nx = Math.abs(cur - at) < sv * 2e-4 ? at : lerp(cur, at, 0.28); if (nx !== cur) moving = true; E.anim.set(id, nx); }
      for (const id of [...E.anim.keys()]) if (!tgt.has(id)) E.anim.delete(id);
      if (moving) E.need = true;
      if (E.fx.length || E.fade.size || playing() || E.solo || E.drag || now() - (E.lookT || 0) < 260) E.need = true;
      // CUT look: the magnet pulls the line onto a hit once you stop moving
      if (lookNow() === "CUT" && !E.drag && now() - E.lastIn > 160 && !E.magnetT) magnet();
      lookUpdate();
      if (E.need) { E.need = false; paint(); placeFloating(); wantDetail(); }
    };
    E.raf = requestAnimationFrame(go);
  }
  function magnet() {
    const c = (E.vt.a + E.vt.b) / 2, h = nearest(grid().hits.map((x) => x.t), c);
    E.magnetT = 1;
    if (h == null) return;
    const px = Math.abs(h - c) / secPerPx();
    if (px > 1 && px < 40) { panBy(h - c); E.fx.push({ kind: "magnet", t: h, t0: now(), d: (h - c) * 1000 }); }
  }
  function lookNow() {
    if (E.held) return E.held;
    if (E.lock) return E.lock;
    if (E.drag && E.drag.kind === "warp") return "STRETCH";
    return beatLen() / span() > 0.62 ? "CUT" : "MOVE";
  }
  function lookUpdate() { const l = lookNow(); if (l !== E.look) { E.look = l; E.lookT = now(); bar(); dirty(); } }
  // where every piece wants to be right now (dragging = the preview)
  function targets() {
    const m = new Map();
    const ps = E.drag && E.drag.kind === "move" && E.drag.prev ? E.drag.prev.ps : E.pieces;
    for (const p of ps) m.set(p.id, p.at);
    return m;
  }
  const shown = () => (E.drag && E.drag.kind === "move" && E.drag.prev ? E.drag.prev.ps : E.drag && E.drag.kind === "warp" ? E.drag.ps : E.pieces);
  const atOf = (p) => (E.anim.has(p.id) ? E.anim.get(p.id) : p.at);

  // ---------------------------------------------------------------- drawing
  function paint() {
    const cv = E.cv; if (!cv) return;
    const w = W(), h = H(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    const look = E.look, lookK = ease((now() - (E.lookT || 0)) / 220);
    const y0 = LAY.WAV0, y1 = h - LAY.BOT, L = LAY.L, R = w - LAY.R;
    const G = grid(), pb = pxPerBeat(), ps = shown();
    drawMap(g, w);
    // parts row
    g.save(); g.beginPath(); g.rect(L, LAY.SEC[0], R - L, LAY.SEC[1] - LAY.SEC[0]); g.clip();
    E.secRects = [];
    for (const s of sectionsShown()) {
      const xa = X(s.a), xb = X(s.b); if (xb < L || xa > R) continue;
      const x = Math.max(L, xa); g.fillStyle = PANEL2; g.fillRect(x, LAY.SEC[0], Math.min(R, xb) - x - 2, LAY.SEC[1] - LAY.SEC[0]);
      g.fillStyle = s.n === "BREAK" ? RED : ACID; g.fillRect(x, LAY.SEC[0], 2, LAY.SEC[1] - LAY.SEC[0]);
      txt(g, s.n, x + 8, LAY.SEC[0] + 9.5, 8.5, "#ececf1");
      E.secRects.push({ a: s.a, b: s.b, xa, xb });
    }
    g.restore();
    // ruler: bar numbers from the listened grid
    g.fillStyle = PANEL; g.fillRect(L, LAY.RUL[0], R - L, LAY.RUL[1] - LAY.RUL[0]);
    g.save(); g.beginPath(); g.rect(L, LAY.RUL[0], R - L, LAY.RUL[1] - LAY.RUL[0] + 6); g.clip();
    const every = pb * 4 > 36 ? 1 : pb * 16 > 36 ? 4 : 16;
    for (const b of G.beats) {
      const x = Math.round(X(b.t)) + 0.5; if (x < L - 2 || x > R + 2) continue;
      if (b.down || pb > 10) { g.fillStyle = b.down ? "#5a5a66" : "#3c3c46"; const hh = b.down ? 22 : 9; g.fillRect(x, LAY.RUL[1] - hh, 1, hh); }
      if (b.down && b.bar && (b.bar - 1) % every === 0) txt(g, String(b.bar), x + 4, LAY.RUL[0] + 8, 9, "#b8b8c4");
      else if (!b.down && pb > 110) { const bi = G.beats.indexOf(b); let k = 0; for (let j = bi; j >= 0 && !G.beats[j].down; j--) k++; txt(g, `${b.bar || 0}.${k + 1}`, x + 4, LAY.RUL[0] + 8, 8, "#7d7d89"); }
      // 16ths when close
      if (pb > 260) { const nb = G.beats[G.beats.indexOf(b) + 1]; if (nb) for (let k = 1; k < 4; k++) { const xx = Math.round(X(b.t + ((nb.t - b.t) * k) / 4)) + 0.5; g.fillStyle = "#33333b"; g.fillRect(xx, LAY.RUL[1] - 5, 1, 5); } }
    }
    if (E.loop) { const la = X(E.loop.a), lb = X(E.loop.b); g.fillStyle = "rgba(228,255,58,.85)"; g.fillRect(la, LAY.RUL[0], lb - la, 3); g.fillStyle = "rgba(228,255,58,.10)"; g.fillRect(la, LAY.RUL[0] + 3, lb - la, LAY.RUL[1] - LAY.RUL[0] - 3); }
    if (secPerPx() * 44100 < 1.2) txt(g, `1 px = ${(secPerPx() * 1000).toFixed(3)} ms`, R - 6, LAY.RUL[0] + 8, 8, "#9aa0ff", "right");
    g.restore();
    // wave area
    g.fillStyle = PANEL; g.fillRect(L, y0, R - L, y1 - y0);
    // grid lines behind
    for (const b of G.beats) { const x = Math.round(X(b.t)) + 0.5; if (x < L || x > R) continue; if (!b.down && pb < 10) continue; g.fillStyle = b.down ? "rgba(236,236,241,.16)" : "rgba(236,236,241,.07)"; g.fillRect(x, y0, 1, y1 - y0); }
    // drop slot / ghost under the pieces
    const D = E.drag;
    if (D && D.kind === "move" && D.prev && D.moved) {
      const sa = X(D.T), sb = X(D.T + D.prev.L), bad = barOdd(D.prev.L);
      g.save(); g.fillStyle = bad ? "rgba(255,51,85,.10)" : "rgba(228,255,58,.08)"; g.fillRect(sa, y0, sb - sa, y1 - y0);
      g.shadowColor = bad ? RED : ACID; g.shadowBlur = 16; g.strokeStyle = bad ? RED : ACID; g.lineWidth = 2; g.strokeRect(sa + 1, y0 + 1, sb - sa - 2, y1 - y0 - 2); g.restore();
      tag(g, bad ? "DROP - " + bad : "DROP HERE", sa + 6, y1 - 20, bad ? RED : ACID, "#111");
    }
    // the pieces
    const loud = E.ov ? E.ov.loud : 1, mid = (y0 + y1) / 2, hh = (y1 - y0) / 2 - 8;
    for (const p of ps) {
      if (D && D.kind === "move" && D.prev && D.moved && D.prev.moved.has(p.id) && D.how !== "copy") continue;   // drawn at the hand
      drawPiece(g, p, atOf(p), y0, y1, mid, hh, loud, look, lookK);
    }
    if (D && D.kind === "move" && D.prev && D.moved && D.how === "copy") for (const p of D.prev.ps) if (D.prev.moved.has(p.id)) continue;
    // beat blocks + bar numbers inside the sound (MOVE look)
    if (look === "MOVE" && pb > 7) {
      g.globalAlpha = lookK;
      for (const b of G.beats) { const x = X(b.t); if (x < L || x > R) continue; g.fillStyle = PANEL; g.fillRect(x - (b.down ? 1.5 : 0.6), y0, b.down ? 3 : 1.2, y1 - y0); }
      if (pb * 4 > 50) { g.save(); g.beginPath(); g.rect(L, y0, R - L, y1 - y0); g.clip(); for (const b of G.beats) if (b.down && b.bar) { const x = X(b.t); if (x > L - 60 && x < R) { g.font = `800 15px ${DISP}`; g.fillStyle = "rgba(15,15,18,.55)"; g.textBaseline = "top"; g.fillText(String(b.bar), x + 7, y0 + 10); } } g.restore(); }
      g.globalAlpha = 1;
    }
    // edit joints (thin cut lines)
    for (let i = 1; i < ps.length; i++) { const a = ps[i - 1], b = ps[i]; if (Math.abs(a.at + durOf(a) - b.at) < 1e-4 && Math.abs(a.from + a.len - b.from) < 1e-4 && !a.semi && !b.semi) continue; const x = X(atOf(b)); if (x < L || x > R) continue; g.fillStyle = BG; g.fillRect(x - 1.5, y0, 3, y1 - y0); g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 5, y0 + 4); g.lineTo(x, y0 + 10); g.lineTo(x + 5, y0 + 4); g.stroke(); }
    // hit dots
    if (pb > 16 && look !== "CUT") { for (const x0 of G.hits) { const x = X(x0.t); if (x < L || x > R) continue; const hov = E.hover && E.hover.hit && Math.abs(E.hover.hit.t - x0.t) < 1e-6; g.fillStyle = hov ? ACID : "#fff"; g.beginPath(); g.arc(x, y0 + 9, hov ? 4.5 : 1.6 + 2.2 * x0.s, 0, 7); g.fill(); } }
    // stretch pins (always faint, bright in STRETCH)
    for (const p of ps) for (const [, d] of p.warp || []) { const x = X(atOf(p) + d); if (x < L || x > R) continue; const big = look === "STRETCH"; const live = D && D.kind === "warp" && D.pid === p.id && Math.abs(D.d - d) < 1e-6; pin(g, x, LAY.PIN, big ? 6 : 4, live); if (big) { g.fillStyle = live ? ACID : "rgba(228,255,58,.45)"; g.fillRect(Math.round(x), y0, live ? 1.5 : 1, y1 - y0); } }
    if (D && D.kind === "warp") { // the hit you hold: was here (dashed) + the stretch amounts
      const p = D.ps.find((q) => q.id === D.pid);
      if (p) {
        const xo = X(atOf(p) + D.d0); g.save(); g.setLineDash([3, 4]); g.strokeStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.moveTo(xo + 0.5, y0); g.lineTo(xo + 0.5, y1); g.stroke(); g.restore();
        const P = pinsOf(p);
        for (let i = 0; i < P.length - 1; i++) { const [s0, d0] = P[i], [s1, d1] = P[i + 1]; if (d1 <= D.lo - 1e-6 || d0 >= D.hi + 1e-6) continue; const r = (s1 - s0) / Math.max(1e-6, d1 - d0); if (Math.abs(r - 1) < 0.01) continue; const cx = clamp(X(atOf(p) + (d0 + d1) / 2), L + 40, R - 40); tag(g, `x${(1 / r).toFixed(2)} ${r < 1 ? "STRETCH" : "SQUASH"}`, cx - 44, y1 - 22, BG, mix(E.col, RED, 0.85)); }
      }
    }
    // selection
    if (E.sel) { const xa = X(E.sel.a), xb = X(E.sel.b); g.fillStyle = "rgba(228,255,58,.12)"; g.fillRect(xa, y0, xb - xa, y1 - y0); g.strokeStyle = ACID; g.lineWidth = 2; g.strokeRect(xa + 1, y0 + 1, xb - xa - 2, y1 - y0 - 2); const bars = selBars(E.sel); if (bars && xb - xa > 60) tag(g, bars, xa + 5, y0 + 5, ACID, "#111"); }
    // ghost: where a moved part came from
    if (E.ghost) { const xa = X(E.ghost.a), xb = X(E.ghost.b); g.save(); g.setLineDash([5, 4]); g.strokeStyle = "rgba(236,236,241,.55)"; g.lineWidth = 1.3; g.strokeRect(xa + 0.5, y0 + 3.5, xb - xa - 1, y1 - y0 - 7); g.restore(); if (xb - xa > 40) txt(g, "FROM", xa + 6, y1 - 12, 8, "rgba(236,236,241,.7)"); }
    // the lifted block at the hand
    if (D && D.kind === "move" && D.prev && D.moved) {
      const lift = ease((now() - D.liftT) / 160) * 22, blk = D.prev.ps.filter((p) => D.prev.moved.has(p.id)), off = D.handT - D.grab;
      g.save(); g.shadowColor = "rgba(0,0,0,.85)"; g.shadowBlur = 24; g.fillStyle = PANEL2; g.fillRect(X(off), y0 - lift, X(off + D.prev.L) - X(off), y1 - y0); g.restore();
      for (const p of blk) drawPiece(g, { ...p }, off + (p.at - D.T), y0 - lift, y1 - lift, mid - lift, hh, loud, look, 1, LILAC);
      g.strokeStyle = ACID; g.lineWidth = 1.5; g.strokeRect(X(off) + 0.5, y0 - lift + 0.5, X(off + D.prev.L) - X(off) - 1, y1 - y0 - 1);
    }
    // effects: the cut flash, a cut line, the gap closing
    E.fx = E.fx.filter((f) => now() - f.t0 < 600);
    for (const f of E.fx) {
      const k = (now() - f.t0) / 600;
      if (f.kind === "flash") { g.fillStyle = `rgba(201,168,255,${0.45 * (1 - k)})`; g.fillRect(X(f.a), y0, X(f.b) - X(f.a), y1 - y0); }
      if (f.kind === "line" || f.kind === "close") { g.save(); g.globalAlpha = 1 - k; g.shadowColor = ACID; g.shadowBlur = 24; g.fillStyle = ACID; g.fillRect(X(f.t) - 2, y0 - 6, 4, y1 - y0 + 12); g.restore(); }
    }
    // the playhead
    if (ui.transport) { const t = ui.transport.position - E.c.start; const x = Math.round(X(t)); if (x >= L && x <= R) { g.fillStyle = "#fff"; g.fillRect(x - 0.5, LAY.RUL[0], 1.5, y1 - LAY.RUL[0]); } }
    // CUT look: the tape head
    if (look === "CUT") {
      const cx = Math.round((L + R) / 2), c = (E.v.a + E.v.b) / 2;
      g.globalAlpha = lookK;
      g.save(); g.shadowColor = ACID; g.shadowBlur = 14; g.fillStyle = ACID; g.fillRect(cx - 1, y0 - 6, 2, y1 - y0 + 12);
      g.beginPath(); g.moveTo(cx - 7, y0 - 10); g.lineTo(cx + 7, y0 - 10); g.lineTo(cx, y0); g.fill(); g.beginPath(); g.moveTo(cx - 7, y1 + 10); g.lineTo(cx + 7, y1 + 10); g.lineTo(cx, y1); g.fill(); g.restore();
      const mg = E.fx.find((f) => f.kind === "magnet"); if (mg) tag(g, `MAGNET ${Math.abs(mg.d).toFixed(1)} ms`, cx + 8, y0 + 8, BG, ACID);
      tag(g, "B - CUT HERE", cx + 8, y1 - 22, ACID, "#111");
      // scrub strip
      const jy = y1 + 8, jh = LAY.BOT - 14; g.fillStyle = "#141418"; g.fillRect(L, jy, R - L, jh);
      const bl = beatLen(), st = (bl / 16) * Math.max(1, Math.pow(2, Math.round(Math.log2(12 / (bl / 16 / secPerPx())))));
      for (let t = Math.ceil(E.v.a / st) * st; t <= E.v.b; t += st) { const x = X(t), d = Math.abs(x - cx) / ((R - L) / 2), a = Math.max(0, 1 - d * d); g.fillStyle = `rgba(236,236,241,${0.08 + 0.55 * a})`; const th = (Math.round(t / st) % 4 === 0 ? 18 : 9) * (0.5 + 0.5 * a); g.fillRect(x, jy + jh / 2 - th / 2, 1.3, th); }
      g.globalAlpha = 1;
      // the readout up top
      const r = E.box.querySelector(".kae2-read"); if (r) r.textContent = readout(c);
    } else { const r = E.box.querySelector(".kae2-read"); if (r && r.textContent) r.textContent = ""; }
    // STRETCH legend
    if (look === "STRETCH") { const gx = L, gy = y1 + 12, gw = 200; const gr = g.createLinearGradient(gx, 0, gx + gw, 0); gr.addColorStop(0, RED); gr.addColorStop(0.5, E.col); gr.addColorStop(1, RED); g.fillStyle = gr; g.fillRect(gx, gy, gw, 4); txt(g, "SQUASH", gx, gy + 14, 7.5, "#7d7d89"); txt(g, "UNTOUCHED", gx + gw / 2, gy + 14, 7.5, "#7d7d89", "center"); txt(g, "STRETCH", gx + gw, gy + 14, 7.5, "#7d7d89", "right"); }
    // snap chip
    { const s = "SNAP - " + snapLevel(), wd = tw(g, s, 8.5) + 26, x = R - wd, y = y1 + 9; g.fillStyle = "rgba(15,15,18,.9)"; g.fillRect(x, y, wd, 20); g.strokeStyle = "#2b2b33"; g.strokeRect(x + 0.5, y + 0.5, wd - 1, 19); g.fillStyle = ACID; g.fillRect(x + 8, y + 7, 6, 6); txt(g, s, x + 19, y + 10.5, 8.5, "#ececf1"); }
    if (!E.ov) txt(g, "LOADING THE SOUND...", (L + R) / 2, mid, 10, "#7d7d89", "center");
  }
  function readout(c) {
    const G = grid().beats; let i = 0; while (i < G.length - 1 && G[i + 1].t <= c) i++;
    const b = G[i]; if (!b) return "";
    let k = 0; for (let j = i; j >= 0 && !G[j].down; j--) k++;
    const nb = G[i + 1], q = nb ? (nb.t - b.t) / 4 : beatLen() / 4, six = Math.floor((c - b.t) / q), ms = (c - (b.t + six * q)) * 1000;
    return `BAR ${b.bar || 0} - BEAT ${k + 1} - ${six + 1}/16 - ${ms >= 0 ? "+" : ""}${ms.toFixed(1)} ms`;
  }
  function barOdd(L) { const bl = beatLen() * 4, r = L / bl, f = r - Math.floor(r + 1e-3); if (f < 0.02 || f > 0.98) return ""; const n = Math.round(f * 4); return n === 2 ? "+1/2 BAR" : n ? `+${n}/4 BAR` : ""; }
  function selBars(s) { const bl = beatLen(), n = (s.b - s.a) / bl; if (n < 0.3) return `${((s.b - s.a) * 1000).toFixed(0)} ms`; const bars = n / 4; return Math.abs(bars - Math.round(bars)) < 0.03 && bars >= 1 ? `${Math.round(bars)} BAR${Math.round(bars) > 1 ? "S" : ""}` : `${Math.round(n * 4) / 4} BEAT${n > 1 ? "S" : ""}`; }
  function drawPiece(g, p, at, y0, y1, mid, hh, loud, look, lookK, force) {
    const D = durOf(p), xa = X(at), xb = X(at + D), L = LAY.L, R = W() - LAY.R;
    if (xb < L || xa > R) return;
    const ca = Math.max(L, Math.floor(xa)), cb = Math.min(R, Math.ceil(xb));
    const fadeK = E.fade.has(p.id) ? clamp(1 - (now() - E.fade.get(p.id)) / 2500, 0, 1) : 0;
    if (fadeK === 0 && E.fade.has(p.id)) E.fade.delete(p.id);
    const isLoose = E.loose.has(p.id);
    let base = force || (isLoose ? LILAC : fadeK > 0 ? mix(E.col, LILAC, fadeK) : E.col);
    if (p.semi && !force && !isLoose) base = "#9b6bff";
    // heat: how hard each stretched part is bent
    const P = p.warp || Math.abs(D - p.len) > 1e-6 ? pinsOf(p) : null;
    const heatAt = (d) => { if (!P) return 0; for (let i = 0; i < P.length - 1; i++) if (d <= P[i + 1][1] || i === P.length - 2) { const r = (P[i + 1][0] - P[i][0]) / Math.max(1e-6, P[i + 1][1] - P[i][1]); return Math.min(1, Math.abs(Math.log2(r)) / Math.log2(1.45)); } return 0; };
    const heatW = look === "STRETCH" ? 1 : 0.35;
    if (P && look === "STRETCH") for (let i = 0; i < P.length - 1; i++) { const k = heatAt((P[i][1] + P[i + 1][1]) / 2); if (k < 0.02) continue; const a = Math.max(L, X(at + P[i][1])), b = Math.min(R, X(at + P[i + 1][1])); g.fillStyle = mix(E.col, RED, k); g.globalAlpha = 0.13; g.fillRect(a, y0, b - a, y1 - y0); g.globalAlpha = 1; }
    if (isLoose || force) { g.fillStyle = "rgba(201,168,255,.07)"; g.fillRect(ca, y0, cb - ca, y1 - y0); }
    if (!E.ov) return;
    const ov = E.ov, det = E.det.get(p.id), spp = secPerPx();
    const colAt = (d) => (P ? mix(base, RED, heatAt(d) * heatW) : base);
    // samples: a line (and dots when they're far apart)
    if (det && det.samples && !p.semi) {
      const sr = 1 / det.dt, s0 = p.from + srcAt(p, (ca - xa) * spp), s1 = p.from + srcAt(p, (cb - xa) * spp);
      const i0 = Math.max(0, Math.floor((s0 - det.t0) * sr) - 1), i1 = Math.min(det.samples.length - 1, Math.ceil((s1 - det.t0) * sr) + 1);
      if (i1 > i0 && det.t0 <= s0 + det.dt * 2 && det.t0 + det.samples.length * det.dt >= s1 - det.dt * 2) {
        const xs = (i) => X(at + dspAt(p, det.t0 + i * det.dt - p.from)), ys = (i) => mid - (det.samples[i] / loud) * hh;
        g.save(); g.beginPath(); g.rect(ca, y0, cb - ca, y1 - y0); g.clip();
        g.strokeStyle = "#44444e"; g.lineWidth = 1; g.beginPath(); g.moveTo(ca, mid); g.lineTo(cb, mid); g.stroke();
        g.strokeStyle = colAt((ca + cb) / 2 * spp); g.lineWidth = 1.6; g.beginPath();
        for (let i = i0; i <= i1; i++) { i === i0 ? g.moveTo(xs(i), ys(i)) : g.lineTo(xs(i), ys(i)); } g.stroke();
        const pxs = det.dt / spp;
        if (pxs > 5) { g.fillStyle = colAt(0); for (let i = i0; i <= i1; i++) { const x = xs(i), y = ys(i); g.globalAlpha = 0.35; g.fillRect(x - 0.5, Math.min(mid, y), 1, Math.abs(y - mid)); g.globalAlpha = 1; g.beginPath(); g.arc(x, y, pxs > 14 ? 3 : 2.2, 0, 7); g.fill(); } }
        g.restore(); return;
      }
    }
    for (let x = ca; x < cb; x++) {
      const d0 = (x - xa) * spp, d1 = d0 + spp, s0 = p.from + srcAt(p, Math.max(0, d0)), s1 = p.from + srcAt(p, Math.min(D, d1));
      let hi = 0, lo = 0, rm = 0;
      if (det && det.min && s0 >= det.from && s1 <= det.to) {
        const n = det.min.length, i0 = Math.floor(((s0 - det.from) / (det.to - det.from)) * n), i1 = Math.max(i0 + 1, Math.floor(((s1 - det.from) / (det.to - det.from)) * n));
        for (let i = i0; i < i1 && i < n; i++) { if (det.max[i] > hi) hi = det.max[i]; if (det.min[i] < lo) lo = det.min[i]; }
      } else {
        const i0 = Math.floor((s0 / E.origLen) * ov.n), i1 = Math.max(i0 + 1, Math.floor((s1 / E.origLen) * ov.n));
        for (let i = Math.max(0, i0); i < i1 && i < ov.n; i++) { if (ov.max[i] > hi) hi = ov.max[i]; if (ov.min[i] < lo) lo = ov.min[i]; rm += ov.rms[i]; }
        rm /= Math.max(1, Math.min(i1, ov.n) - Math.max(0, i0));
      }
      // peaks a shade darker, the body (rms) in full colour, so loud mastered beats still show their hits
      const cl = colAt(d0), top = (hi / loud) * hh, bot = (-lo / loud) * hh;
      g.fillStyle = rm ? mix(cl, PANEL, 0.42) : cl; g.fillRect(x, mid - top, 1.05, Math.max(1, top + bot));
      if (rm) { const r = Math.min(top, bot + 0.001, (rm / loud) * hh * 1.1); g.fillStyle = cl; g.fillRect(x, mid - r, 1.05, Math.max(1, r * 2)); }
    }
    if (p.semi && xb - xa > 26) { const t = `(${p.semi > 0 ? "+" : ""}${p.semi})`; tag(g, t, Math.min(xb, R) - tw(g, t, 9) - 16, y1 - 22, "#9b6bff", "#fff"); }
    if (isLoose && !force) { g.strokeStyle = LILAC; g.lineWidth = 1.5; g.strokeRect(Math.max(L, xa) + 0.75, y0 + 0.75, Math.min(R, xb) - Math.max(L, xa) - 1.5, y1 - y0 - 1.5); }
  }
  function drawMap(g, w) {
    const L = LAY.L, R = w - LAY.R, [ya, yb] = LAY.MAP, ps = E.pieces, end = Math.max(endOf(ps), 0.5);
    const mx = (t) => L + (t / end) * (R - L);
    g.fillStyle = "#141418"; g.fillRect(L, ya, R - L, yb - ya);
    for (const s of sectionsShown()) { if (s.n !== "BREAK") continue; g.fillStyle = "rgba(255,51,85,.16)"; g.fillRect(mx(s.a), ya, mx(s.b) - mx(s.a), yb - ya); }
    if (E.ov) {
      const ov = E.ov, mid = (ya + yb) / 2 + 3, hh = (yb - ya) / 2 - 6;
      for (const p of ps) {
        const xa = mx(p.at), xb = mx(p.at + durOf(p)), col = E.loose.has(p.id) || E.fade.has(p.id) ? LILAC : "#6f74c9";
        g.fillStyle = col;
        for (let x = Math.floor(xa); x < xb; x++) {
          const d0 = ((x - xa) / (xb - xa)) * durOf(p), d1 = ((x + 1 - xa) / (xb - xa)) * durOf(p), s0 = p.from + srcAt(p, d0), s1 = p.from + srcAt(p, Math.min(durOf(p), d1));
          let hi = 0; for (let i = Math.floor((s0 / E.origLen) * ov.n); i < Math.max(Math.floor((s0 / E.origLen) * ov.n) + 1, Math.floor((s1 / E.origLen) * ov.n)) && i < ov.n; i++) hi = Math.max(hi, ov.max[i], -ov.min[i]);
          const a = (hi / ov.loud) * hh; g.fillRect(x, mid - a, 1, Math.max(1, a * 2));
        }
        if (p.warp) { g.fillStyle = "rgba(255,51,85,.3)"; g.fillRect(xa, ya, xb - xa, yb - ya); }
      }
      for (let i = 1; i < ps.length; i++) { const a = ps[i - 1], b = ps[i]; if (Math.abs(a.from + a.len - b.from) < 1e-4 && Math.abs(a.at + durOf(a) - b.at) < 1e-4) continue; g.fillStyle = RED; g.fillRect(mx(b.at) - 1, ya - 2, 2, yb - ya + 4); }
    }
    for (const s of sectionsShown()) txt(g, s.n, mx(s.a) + 4, ya + 6, 7, s.n === "BREAK" ? RED : "#7d7d89");
    const va = clamp(mx(E.v.a), L, R), vb = clamp(mx(E.v.b), L, R), vw = Math.max(3, vb - va);
    g.fillStyle = "rgba(228,255,58,.08)"; g.fillRect(va, ya, vw, yb - ya); g.strokeStyle = ACID; g.lineWidth = 1.5; g.strokeRect(va + 0.5, ya + 0.5, vw - 1, yb - ya - 1);
    if (ui.transport) { const x = mx(ui.transport.position - E.c.start); if (x >= L && x <= R) { g.fillStyle = "#fff"; g.fillRect(x, ya, 1, yb - ya); } }
    E.mapX = { mx, end, L, R };
  }
  function pin(g, x, y, s, live) { g.save(); if (live) { g.shadowColor = ACID; g.shadowBlur = 12; } g.fillStyle = live ? ACID : "rgba(228,255,58,.85)"; g.beginPath(); g.moveTo(x - s, y - s - 4); g.lineTo(x + s, y - s - 4); g.lineTo(x + s, y - 4); g.lineTo(x, y + 2); g.lineTo(x - s, y - 4); g.closePath(); g.fill(); g.restore(); }
  function txt(g, s, x, y, size, col, align) { g.font = `700 ${size}px ${MONO}`; g.fillStyle = col; g.textAlign = align || "left"; g.textBaseline = "middle"; g.fillText(s, x, y); g.textAlign = "left"; }
  function tw(g, s, size) { g.font = `700 ${size}px ${MONO}`; return g.measureText(s).width; }
  function tag(g, s, x, y, bg, fg) { const w = tw(g, s, 8) + 12; g.fillStyle = bg; g.fillRect(x, y, w, 16); if (bg === BG) { g.strokeStyle = fg; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, 15); } txt(g, s, x + 6, y + 8.5, 8, fg); }
  const hexRGB = (c) => { if (/^#/.test(c)) { const h = c.length === 4 ? c.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : c; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); } const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : [154, 160, 255]; };
  const mixCache = new Map();
  function mix(a, b, k) { k = Math.round(clamp(k, 0, 1) * 32) / 32; if (k === 0) return a; const key = a + b + k; let v = mixCache.get(key); if (!v) { const A = hexRGB(a), B = hexRGB(b); v = `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * k)).join(",")})`; if (mixCache.size > 500) mixCache.clear(); mixCache.set(key, v); } return v; }

  // ---------------------------------------------------------------- the hand
  function bindStage(st) {
    const at = (e) => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const pieceAt = (t) => E.pieces.find((p) => t >= p.at && t < p.at + durOf(p));
    const hitNear = (m) => { if (pxPerBeat() < 16 || lookNow() === "CUT") return null; const t = T(m.x), r = 8 * secPerPx(); let best = null; for (const h of grid().hits) { const d = Math.abs(h.t - t); if (d < r && (!best || d < Math.abs(best.t - t))) best = h; } return best; };
    const pinNear = (m) => { const t = T(m.x), r = 7 * secPerPx(); for (const p of E.pieces) for (const w of p.warp || []) if (Math.abs(p.at + w[1] - t) < r) return { p, w }; return null; };
    const inWave = (m) => m.y >= LAY.WAV0 - 6 && m.y <= H() - LAY.BOT;
    st.addEventListener("mousemove", (e) => {
      if (E.drag) return;
      const m = at(e); let cur = "default", hit = null;
      if (m.y < LAY.MAP[1] + 2) cur = "grab";
      else if (m.y < LAY.SEC[1]) cur = "pointer";
      else if (m.y < LAY.WAV0 - 6) cur = pinNear(m) ? "ew-resize" : "text";
      else if (inWave(m)) {
        const t = T(m.x), p = pieceAt(t);
        hit = (m.y < LAY.WAV0 + 22 || lookNow() === "STRETCH") ? hitNear(m) : null;
        if (pinNear(m) && m.y < LAY.WAV0 + 22) cur = "ew-resize";
        else if (hit) cur = "ew-resize";
        else if (lookNow() === "CUT") cur = "grab";
        else if (p && E.loose.has(p.id)) cur = "grab";
        else cur = "crosshair";
      }
      st.style.cursor = cur;
      const was = E.hover && E.hover.hit; E.hover = { t: T(m.x), hit };
      if (was !== hit) dirty();
    });
    st.addEventListener("mouseleave", () => { E.hover = null; dirty(); });
    st.addEventListener("dblclick", (e) => {
      const m = at(e);
      const pn = m.y < LAY.WAV0 + 22 ? pinNear(m) : null;
      if (pn) { commit(E.pieces.map((p) => (p.id === pn.p.id ? { ...p, warp: (p.warp || []).filter((w) => w !== pn.w) } : p)).map((p) => (p.warp && !p.warp.length ? { ...p, warp: undefined } : p))); return; }
      if (inWave(m) && lookNow() === "MOVE") { const s = barSpan(T(m.x)); E.sel = s; E.loose.clear(); bar(); dirty(); }
    });
    st.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || !E.c) return;
      const m = at(e); E.lastIn = now(); E.magnetT = 0;
      // the song map
      if (m.y < LAY.MAP[1] + 2 && E.mapX) { e.preventDefault(); mapDrag(e, m); return; }
      // the parts row: select that part
      if (m.y < LAY.SEC[1] + 1) { const r = (E.secRects || []).find((q) => m.x >= q.xa && m.x <= q.xb); if (r) { E.sel = { a: r.a, b: r.b }; E.loose.clear(); E.ghost = null; bar(); dirty(); } return; }
      // the ruler: drag = loop, click = move the playhead (a pin there: stretch it)
      if (m.y < LAY.WAV0 - 6) { const pn = pinNear(m); if (pn) { e.preventDefault(); warpDrag(e, pn.p, pn.w[1], pn.w); return; } e.preventDefault(); rulerDrag(e, m); return; }
      if (!inWave(m)) return;
      e.preventDefault();
      const t = T(m.x), p = pieceAt(t), look = lookNow();
      // a stretch pin or a hit dot: STRETCH
      const pn = m.y < LAY.WAV0 + 22 ? pinNear(m) : null;
      if (pn) { warpDrag(e, pn.p, pn.w[1], pn.w); return; }
      const h = (m.y < LAY.WAV0 + 22 || look === "STRETCH") ? hitNear(m) : null;
      if (h || look === "STRETCH") { const hh = h || nearest(grid().hits.map((x) => x.t), t); const pp = pieceAt(h ? h.t : hh); if (pp && hh != null) { warpDrag(e, pp, (h ? h.t : hh) - pp.at, null); return; } }
      // CUT look: drag slides the sound under the line; a click picks the piece
      if (look === "CUT") { scrubDrag(e, m, p); return; }
      // a lilac piece: pick it up
      if (p && E.loose.has(p.id)) { moveDrag(e, m, p); return; }
      // anything else: select (snaps)
      selectDrag(e, m);
    });
    // zoom: pinch / Cmd++scroll / plain scroll up-down; sideways swipe moves
    st.addEventListener("wheel", (e) => {
      e.preventDefault(); E.lastIn = now(); E.magnetT = 0;
      const m = at(e);
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) { panBy(e.deltaX * secPerPx()); return; }
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) { panBy(e.deltaY * secPerPx()); return; }
      const k = e.ctrlKey && !e.metaKey ? 0.012 : e.deltaMode === 1 ? 0.05 : 0.0025;
      zoomAt(Math.exp(-e.deltaY * k), m.x);
    }, { passive: false });
    let pinch = 1;
    st.addEventListener("gesturestart", (e) => { e.preventDefault(); pinch = 1; });
    st.addEventListener("gesturechange", (e) => { e.preventDefault(); E.lastIn = now(); E.magnetT = 0; zoomAt(e.scale / pinch, at(e).x); pinch = e.scale; });
    st.addEventListener("gestureend", (e) => e.preventDefault());
    E.onResize = () => dirty(); addEventListener("resize", E.onResize);
  }
  function drag(onMove, onUp) {
    const mv = (ev) => { E.lastIn = now(); onMove(ev); dirty(); };
    const up = (ev) => { removeEventListener("mousemove", mv); removeEventListener("mouseup", up); onUp(ev); dirty(); };
    addEventListener("mousemove", mv); addEventListener("mouseup", up);
  }
  const stageX = (ev) => ev.clientX - E.cv.getBoundingClientRect().left;
  function selectDrag(e, m) {
    const t0 = T(m.x), a0 = snapT(t0), x0 = e.clientX; let moved = false;
    E.loose.clear(); E.ghost = null; bar();
    drag((ev) => {
      if (!moved && Math.abs(ev.clientX - x0) < 4) return;
      moved = true;
      const t = clamp(T(stageX(ev)), 0, endOf(E.pieces)), b0 = snapT(t);
      E.sel = b0 === a0 ? null : { a: Math.min(a0, b0), b: Math.max(a0, b0) };
      autoScroll(ev);
    }, () => {
      if (!moved) { E.sel = null; if (e.detail < 2) run("setPosition", { time: E.c.start + clamp(snapT(t0), 0, endOf(E.pieces)) }); }
      else if (E.sel && window.KT2Juice && KT2Juice.step) KT2Juice.step("move", 1);
      bar();
    });
  }
  function autoScroll(ev) { const x = stageX(ev), L = LAY.L, R = W() - LAY.R; if (x < L + 20) panBy(-span() * 0.02); else if (x > R - 20) panBy(span() * 0.02); }
  function moveDrag(e, m, p) {
    const ids = new Set(E.loose), sp = looseSpan(), x0 = e.clientX, grab = T(m.x) - sp.a;
    const D = E.drag = { kind: "move", ids, grab, handT: T(m.x), T: sp.a, prev: null, moved: false, how: "move", sp, liftT: now() };
    let lastT = null;
    drag((ev) => {
      if (!D.moved && Math.abs(ev.clientX - x0) < 4) return;
      if (!D.moved) { D.moved = true; D.liftT = now(); E.cv.style.cursor = "grabbing"; if (window.KT2Juice && KT2Juice.sound && KT2Juice.sound.lift) KT2Juice.sound.lift(); }
      D.how = ev.altKey ? "copy" : ev.shiftKey ? "over" : "move";
      D.handT = T(stageX(ev));
      // where it lands, in the arrangement with its gap already closed
      const closed = D.how === "move" ? closeGap(E.pieces.filter((q) => !ids.has(q.id)), sp.a, sp.b) : E.pieces.filter((q) => !ids.has(q.id));
      const old = E.pieces; E.pieces = closed; E.ver++;
      let tt = snapT(clamp(D.handT - grab, 0, endOf(closed)));
      E.pieces = old; E.ver++;
      D.T = tt;
      const base = E.pieces;
      D.prev = arrange(base, ids, tt, D.how);
      if (lastT !== tt) { lastT = tt; if (window.KT2Juice && KT2Juice.step) KT2Juice.step("move", 1); }
      autoScroll(ev);
    }, () => {
      E.drag = null; E.cv.style.cursor = "";
      if (!D.moved || !D.prev) { bar(); return; }
      // keep the slide going from where they are on screen
      const r = D.prev;
      commit(r.ps, "land");
      E.ghost = D.how === "move" ? { a: sp.a, b: sp.b } : null;
      E.loose = new Set(r.moved);
      for (const id of r.moved) { E.fade.set(id, now() + 1500); E.anim.set(id, D.handT - D.grab + (r.ps.find((q) => q.id === id).at - D.T)); }
      bar();
    });
  }
  function warpDrag(e, p0, dAt, existing) {
    // the pin you hold (a new one on the hit, or one already there) and the two that hold still on each side
    const p = E.pieces.find((q) => q.id === p0.id); if (!p) return;
    const Dd = durOf(p), sHit = existing ? existing[0] : srcAt(p, dAt);
    const pins = (p.warp || []).filter((w) => w !== existing && Math.abs(w[1] - dAt) > 1e-4);
    const bl = beatLen(), Gb = grid().beats.map((b) => b.t - p.at);
    const leftPin = Math.max(0, ...pins.filter((w) => w[1] < dAt).map((w) => w[1])), rightPin = Math.min(Dd, ...pins.filter((w) => w[1] > dAt).map((w) => w[1]));
    let lo = leftPin, hi = rightPin;
    const pb = Gb.filter((d) => d < dAt - bl * 0.6 && d > leftPin + 1e-3), nb = Gb.filter((d) => d > dAt + bl * 0.6 && d < rightPin - 1e-3);
    const extra = [];
    if (pb.length) { lo = pb[pb.length - 1]; extra.push([srcAt(p, lo), lo]); }
    if (nb.length) { hi = nb[0]; extra.push([srcAt(p, hi), hi]); }
    const D = E.drag = { kind: "warp", pid: p.id, d: dAt, d0: dAt, lo, hi, ps: E.pieces, moved: false };
    const x0 = e.clientX; E.cv.style.cursor = "ew-resize";
    const build = (d) => E.pieces.map((q) => (q.id === p.id ? { ...q, warp: [...pins, ...extra, [sHit, d]].sort((a, b) => a[1] - b[1]) } : q));
    drag((ev) => {
      if (!D.moved && Math.abs(ev.clientX - x0) < 3) return;
      D.moved = true;
      const t = T(stageX(ev)) - p.at, gap = (hi - lo) * 0.12;
      let d = ev.metaKey ? t : snapPin(p.at + t) - p.at;
      d = clamp(d, lo + gap, hi - gap);
      if (d !== D.d) { D.d = d; if (window.KT2Juice && KT2Juice.step) KT2Juice.step("move", 1); }
      D.ps = build(d); E.ver++;
    }, () => {
      E.drag = null; E.cv.style.cursor = ""; E.ver++;
      if (D.moved && Math.abs(D.d - D.d0) > 1e-4) commit(build(D.d), "land");
      else if (!existing && !D.moved) { /* a click on a hit: nothing */ }
    });
  }
  function snapPin(t) {   // stretch pins: 1/8 beats, 1/16 up close
    const lv = snapLevel(); if (lv === "FREE") return t;
    const bt = grid().beats.map((b) => b.t), bl = beatLen(); let lo = 0; while (lo < bt.length - 1 && bt[lo + 1] <= t) lo++;
    const a = bt[lo] != null ? bt[lo] : 0, b = bt[lo + 1] != null ? bt[lo + 1] : a + bl, q = (b - a) / (lv === "HIT" ? 4 : 2);
    return a + Math.round((t - a) / q) * q;
  }
  function scrubDrag(e, m, p) {
    const x0 = e.clientX, v0 = { ...E.vt }; let moved = false;
    drag((ev) => { if (!moved && Math.abs(ev.clientX - x0) < 3) return; moved = true; const dt = -(ev.clientX - x0) * secPerPx(); E.vt = limit({ a: v0.a + dt, b: v0.b + dt }); E.magnetT = 0; },
      () => { if (!moved) { E.sel = null; if (p) { E.loose = new Set([p.id]); } else E.loose.clear(); bar(); } E.lastIn = now(); E.magnetT = 0; });
  }
  function rulerDrag(e, m) {
    const a0 = snapT(T(m.x)); let moved = false;
    drag((ev) => { const tt = snapT(T(stageX(ev))); if (!moved && Math.abs(ev.clientX - e.clientX) < 4) return; moved = true; E.loop = tt === a0 ? null : { a: Math.min(a0, tt), b: Math.max(a0, tt) }; },
      () => { if (moved) { if (E.solo && playing()) play(); return; } if (e.detail === 2) { E.loop = null; return; } run("setPosition", { time: E.c.start + Math.max(0, T(m.x)) }).then(() => { if (E.solo && playing()) play(); }); });
  }
  function mapDrag(e, m) {
    const { mx, end, L, R } = E.mapX, tOf = (x) => ((x - L) / (R - L)) * end;
    const va = mx(E.vt.a), vb = mx(E.vt.b), edge = Math.abs(m.x - va) < 6 ? "a" : Math.abs(m.x - vb) < 6 ? "b" : m.x > va && m.x < vb ? "move" : "jump";
    const v0 = { ...E.vt }, t0 = tOf(m.x);
    if (edge === "jump") { const s = v0.b - v0.a; viewTo({ a: t0 - s / 2, b: t0 + s / 2 }); }
    const v1 = { ...E.vt };
    drag((ev) => {
      const t = tOf(stageX(ev));
      if (edge === "a") viewTo({ a: Math.min(t, v1.b - 0.01), b: v1.b }, true);
      else if (edge === "b") viewTo({ a: v1.a, b: Math.max(t, v1.a + 0.01) }, true);
      else { const d = t - t0; viewTo({ a: v1.a + d, b: v1.b + d }, true); }
    }, () => {});
  }

  // ---------------------------------------------------------------- keys (run before the app's)
  const onKey = (e) => {
    if (window.__kaeKeyOld) window.__kaeKeyOld(e);
    if (!E.box || e.__kae2) return;
    e.__kae2 = 1;
    const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.type === "keyup") { if ((k === "w" || k === "c") && E.held) { E.held = null; bar(); dirty(); } return; }
    if (k === "escape") { eat(); if (E.drag) return; if (E.sel || E.loose.size || E.ghost) { E.sel = null; E.loose.clear(); E.ghost = null; bar(); dirty(); return; } close(); return; }
    if (mod && k === "z") { eat(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === "x") { eat(); removeLoose(); return; }
    if (mod && k === "c") { eat(); copyLoose(); return; }
    if (mod && k === "v") { eat(); paste(); return; }
    if (mod && (k === "=" || k === "+")) { eat(); zoomAt(1.6, W() / 2); return; }
    if (mod && (k === "-" || k === "_")) { eat(); zoomAt(1 / 1.6, W() / 2); return; }
    if (mod && k === "0") { eat(); viewTo(fullView()); return; }
    if (mod || /input|textarea/i.test((e.target && e.target.tagName) || "")) return;
    if (k === " ") { if (!e.repeat) toggle(); }
    else if (k === "b") { if (E.sel) doCut(); else if (lookNow() === "CUT") cutHere((E.v.a + E.v.b) / 2); else if (E.hover) cutHere(snapT(E.hover.t)); }
    else if (k === "delete" || k === "backspace") removeLoose();
    else if (k === "arrowup" || k === "arrowdown") transpose(k === "arrowup" ? 1 : -1);
    else if (k === "arrowleft" || k === "arrowright") panBy((k === "arrowleft" ? -1 : 1) * span() * 0.15);
    else if (k === "w") { if (!e.repeat) { E.held = "STRETCH"; bar(); dirty(); } }
    else if (k === "c") { if (!e.repeat) { E.held = "CUT"; bar(); dirty(); } }
    else if (k === "z") { const s = E.sel || looseSpan(); if (s) { const pad = (s.b - s.a) * 0.15; viewTo({ a: s.a - pad, b: s.b + pad }); } }
    else if (k === "=" || k === "+") zoomAt(1.6, W() / 2);
    else if (k === "-") zoomAt(1 / 1.6, W() / 2);
    else if (k === "0") viewTo(fullView());
    else { if (!/^(shift|alt|meta|control)$/.test(k)) e.stopImmediatePropagation(); return; }
    eat();
  };
  window.__kaeKey = onKey;
  addEventListener("keydown", onKey, true);
  addEventListener("keyup", onKey, true);

  const css = document.createElement("style");
  css.textContent = `
.kae2 { position: fixed; inset: 0; z-index: 8000; display: grid; place-items: center; background: rgba(8, 8, 10, 0.55); }
.kae2-win { width: min(1320px, 95vw); height: min(640px, 80vh); display: flex; flex-direction: column; background: #17171b; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 30px 80px rgba(0,0,0,.6); }
.kae2-top { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-bottom: 1px solid rgba(255,255,255,.06); flex: none; }
.kae2-sw { width: 12px; height: 12px; flex: none; }
.kae2-nm { font: 800 13px ${DISP}; letter-spacing: .04em; color: #fff; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 6px; }
.kae2-chip { font: 700 11px Inter, sans-serif; color: #fff; padding: 5px 9px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); white-space: nowrap; }
.kae2-chip small { font: 600 7.5px ${MONO}; letter-spacing: .14em; color: rgba(255,255,255,.5); }
.kae2-listen { display: inline-flex; gap: 6px; align-items: center; }
.kae2-listen i { width: 6px; height: 6px; background: ${ACID}; animation: kae2-p 0.9s infinite alternate; }
.kae2-listen.done small { color: ${ACID}; }
@keyframes kae2-p { from { opacity: .2 } to { opacity: 1 } }
.kae2-read { font: 700 11px ${MONO}; letter-spacing: .12em; color: ${ACID}; white-space: nowrap; margin-left: 10px; }
.kae2-sp { flex: 1; }
.kae2-looks, .kae2-seg { display: flex; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
.kae2-top .kae2-looks button, .kae2-top .kae2-seg button { background: none; padding: 0 11px; color: rgba(255,255,255,.5); }
.kae2-top .kae2-looks button.on { color: #141218; }
.kae2-top .kae2-looks button.on[data-k="move"] { background: #9aa0ff; }
.kae2-top .kae2-looks button.on[data-k="stretch"] { background: ${RED}; }
.kae2-top .kae2-looks button.on[data-k="cut"] { background: ${ACID}; }
.kae2-top .kae2-looks button.lock { box-shadow: inset 0 -2px 0 #fff; }
.kae2-top .kae2-seg button.on { background: ${ACID}; color: #141218; }
.kae2-top .kae2-play { width: 30px; padding: 0; justify-content: center; color: ${ACID}; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); background: none; }
.kae2-play svg { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; }
.kae2-top .kae2-play.on { background: ${ACID}; color: #141218; }
.kae2-play.on svg path { d: path("M4 4h8v8H4z"); fill: currentColor; }
.kae2-top button { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 0; border-radius: 0; background: rgba(255,255,255,.06); color: #ecebf2; font: 700 8.5px ${MONO}; letter-spacing: .14em; cursor: pointer; }
.kae2-top button:hover:not(:disabled) { background: rgba(255,255,255,.12); }
.kae2-top .kae2-looks button:hover:not(.on), .kae2-top .kae2-seg button:hover:not(.on) { background: rgba(255,255,255,.08); color: #fff; }
.kae2-top button:disabled { opacity: .3; cursor: default; }
.kae2-top .kae2-x { font-size: 16px; padding: 0 10px; background: transparent; }
.kae2-stage { flex: 1; position: relative; min-height: 0; user-select: none; }
.kae2-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.kae2-cut { position: absolute; transform: translateX(-50%); height: 26px; padding: 0 14px; border: 0; border-radius: 0; background: ${ACID}; color: #141218; font: 700 10px ${MONO}; letter-spacing: .16em; display: inline-flex; gap: 7px; align-items: center; cursor: pointer; box-shadow: 0 0 18px rgba(228,255,58,.45); animation: kae2-in .16s cubic-bezier(.2,.9,.3,1.3); }
.kae2-cut:hover { filter: brightness(1.08); } .kae2-cut:active { transform: translateX(-50%) scale(.96); }
.kae2-piece { position: absolute; transform: translateX(-50%); display: flex; gap: 2px; align-items: center; background: #1f1f25; box-shadow: inset 0 0 0 1px ${LILAC}; padding: 2px; animation: kae2-in .16s cubic-bezier(.2,.9,.3,1.3); }
.kae2-piece button { width: 26px; height: 22px; border: 0; border-radius: 0; background: rgba(255,255,255,.07); color: #fff; font: 700 13px Inter, sans-serif; cursor: pointer; display: inline-grid; place-items: center; }
.kae2-piece button:hover { background: rgba(255,255,255,.14); }
.kae2-piece em { font: 800 11px ${DISP}; font-style: normal; min-width: 30px; text-align: center; color: ${LILAC}; }
@keyframes kae2-in { from { opacity: 0; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }
@media (max-width: 900px) { .kae2-read { display: none; } .kae2-listen { display: none; } }
`;
  document.head.append(css);
  window.KT2AudioEdit = { open, close, _E: E, _arrange: arrange, _cutAtT: cutAtT, _split: splitPiece, _srcAt: srcAt, _dspAt: dspAt };
})();
