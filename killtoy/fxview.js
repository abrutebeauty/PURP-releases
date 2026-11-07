// Effect pictures you can grab. Every effect card in the rack (and the plugin window) draws
// what the effect does to the sound, with handles you drag right on the picture: a delay's
// echoes, a reverb's tail, an EQ curve, a compressor's bend. The knobs under the picture
// still show the numbers and still work.
//
// One view per kind of effect. Other effects plug in the same way:
//
//   FxView.register("scclip", {
//     match: /ktscclip|sc clip/i,               // tested on "type name"
//     draw(d) { ... },                          // paint on d.g (a 2d canvas context)
//     handles(d) { return [{ x, y, label: () => "text", drag: (px, py) => ({ paramId: 0..1 }) }]; },
//     overlay(box, p) { ... },                  // optional: DOM controls over the picture
//   });
//
// d: g, w, h, p (the plugin), col (its colour), x0 x1 (left/right) y0 (bottom) y1 (top) of the
// plot, v(re, def) a knob's 0..1 value, t(re) its text, id(re) its param id, live (whatever
// FxView.live holds for this plugin, e.g. meters), bpm, hot (index of the handle under the
// mouse or being dragged), and drawing helpers line, fill, dot, label, grid.
// The card does the mouse: hover, drag (Shift = fine), undo, readout bubble, double-click to
// reset. FxView.redraw(pluginId) repaints one plugin's pictures (for live meters).
(function () {
  const views = {};
  const order = [];   // registered views with a match, checked before the built-in kinds
  const live = new Map();

  function register(kind, view) {
    views[kind] = view;
    if (view.match && !order.includes(kind)) order.push(kind);
  }

  function viewFor(p) {
    if (!p.params || !p.params.length) return views.other;   // nothing to grab: its own window has the controls
    const n = (p.type + " " + p.name).toLowerCase();
    for (const k of order) if (views[k].match.test(n)) return views[k];
    const kind = typeof deviceKind === "function" ? deviceKind(p) : "other";
    return views[kind] || views.other;
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const rgba = (hex, a) => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || "");
    return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : `rgba(139,92,246,${a})`;
  };
  // Seeded noise, so a picture doesn't shimmer when it redraws.
  const noise = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // The drawing context for one paint.
  function context(cv, p, over) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const col = typeof deviceColor === "function" ? deviceColor(p) : "#8b5cf6";
    const ink3 = css("--ink-3") || "#77778a", ink = css("--ink") || "#eee", lineCol = css("--line") || "rgba(255,255,255,.08)";
    const font = css("--font") || "system-ui";
    const pad = 12;
    const find = (re) => (re ? p.params.find((x) => (typeof re === "string" ? x.id === re : re.test(x.id) || re.test(x.name))) : null);
    const d = {
      g, w, h, p, col, ink, ink3, pad,
      x0: pad, x1: w - pad, y0: h - pad - 4, y1: pad + 6,
      live: live.get(p.id) || null,
      bpm: (typeof ui !== "undefined" && ui.state && ui.state.bpm) || 120,
      hot: cv._fx ? cv._fx.hot : -1,
      prm: find,
      id: (re) => { const x = find(re); return x ? x.id : null; },
      v: (re, def = 0.5) => { const x = find(re); return x ? Number(over && x.id in over ? over[x.id] : x.value) : def; },
      t: (re) => { const x = find(re); return x ? x.text || "" : ""; },
      line(pts, color = col, width = 1.8) {
        if (!pts.length) return;
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokeStyle = color; g.lineWidth = width; g.lineJoin = g.lineCap = "round"; g.stroke();
      },
      fill(pts, base, a = 0.16) {
        if (!pts.length) return;
        const grad = g.createLinearGradient(0, Math.min(...pts.map((q) => q[1])), 0, base);
        grad.addColorStop(0, rgba(col, a * 1.6)); grad.addColorStop(1, rgba(col, a * 0.25));
        g.beginPath(); g.moveTo(pts[0][0], base); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(pts[pts.length - 1][0], base); g.closePath();
        g.fillStyle = grad; g.fill();
      },
      dot(x, y, r = 3, color = col) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = color; g.fill(); },
      label(text, x, y, align = "left", color = ink3, size = 10) {
        g.font = `${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic"; g.fillText(text, x, y);
      },
      grid(xs = [], ys = []) {
        g.strokeStyle = lineCol; g.lineWidth = 1;
        g.beginPath();
        for (const x of xs) { g.moveTo(Math.round(x) + 0.5, d.y1 - 4); g.lineTo(Math.round(x) + 0.5, d.y0); }
        for (const y of ys) { g.moveTo(d.x0, Math.round(y) + 0.5); g.lineTo(d.x1, Math.round(y) + 0.5); }
        g.stroke();
      },
      rgba: (a, c = col) => rgba(c, a),
      noise,
    };
    d.X = (u) => d.x0 + u * (d.x1 - d.x0);          // 0..1 across
    d.Y = (u) => d.y0 - u * (d.y0 - d.y1);          // 0..1 up
    d.U = (x) => clamp01((x - d.x0) / (d.x1 - d.x0));
    d.V = (y) => clamp01((d.y0 - y) / (d.y0 - d.y1));
    return d;
  }

  // Paint one picture. over = values being dragged right now (not yet back from the engine).
  function draw(cv, p, over) {
    if (!cv || !p) return;
    const d = context(cv, p, over || (cv._fx && cv._fx.over));
    if (!d) return;
    const view = viewFor(p);
    view.draw(d);
    const hs = view.handles ? view.handles(d).filter(Boolean) : [];
    if (cv._fx) cv._fx.handles = hs;
    const st = cv._fx;
    hs.forEach((hd, i) => {
      const hot = st && st.hot === i, held = st && st.drag === i;
      const r = held ? 7 : hot ? 6.5 : 5;
      if (hot || held) { d.dot(hd.x, hd.y, r + 6, d.rgba(0.18)); }
      d.g.beginPath(); d.g.arc(hd.x, hd.y, r, 0, Math.PI * 2);
      d.g.fillStyle = held ? (css("--acid") || "#e4ff3a") : d.col; d.g.fill();
      d.g.lineWidth = 2; d.g.strokeStyle = "rgba(0,0,0,0.55)"; d.g.stroke();
    });
    // The readout bubble for the handle being dragged or pointed at.
    const i = st ? (st.drag >= 0 ? st.drag : st.hot) : -1;
    if (i >= 0 && hs[i] && hs[i].label) {
      const text = hs[i].label();
      if (text) {
        const g = d.g;
        g.font = `11px ${css("--font") || "system-ui"}`;
        const tw = g.measureText(text).width + 12, th = 18;
        let bx = hs[i].x - tw / 2, by = hs[i].y - 30;
        if (by < 2) by = hs[i].y + 14;
        bx = Math.max(2, Math.min(d.w - tw - 2, bx));
        g.fillStyle = "rgba(10,10,12,0.82)";
        g.beginPath(); g.roundRect ? g.roundRect(bx, by, tw, th, 4) : g.rect(bx, by, tw, th); g.fill();
        g.fillStyle = d.ink; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(text, bx + 6, by + th / 2 + 0.5);
        g.textBaseline = "alphabetic";
      }
    }
  }

  // Make a canvas grabbable. getP() returns the plugin as it is now; send(paramId, value,
  // first) sets a knob (first = start an undo step); onLive(values) runs while dragging.
  function attach(cv, getP, send, onLive) {
    if (cv._fx) { cv._fx.getP = getP; cv._fx.send = send; cv._fx.onLive = onLive; return; }
    const st = cv._fx = { getP, send, onLive, hot: -1, drag: -1, handles: [], over: null };
    const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const nearest = (x, y, max) => {
      let best = -1, bd = max * max;
      st.handles.forEach((hd, i) => { const dd = (hd.x - x) ** 2 + (hd.y - y) ** 2; if (dd < bd) { bd = dd; best = i; } });
      return best;
    };
    const repaint = () => { const p = st.getP(); if (p) draw(cv, p); };

    cv.addEventListener("pointermove", (e) => {
      if (st.drag >= 0) return;
      const [x, y] = at(e);
      const i = nearest(x, y, 22);
      if (i !== st.hot) { st.hot = i; cv.style.cursor = i >= 0 ? "grab" : "default"; repaint(); }
    });
    cv.addEventListener("pointerleave", () => { if (st.drag < 0 && st.hot >= 0) { st.hot = -1; repaint(); } });

    cv.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const p0 = st.getP();
      if (!p0) return;
      const [x, y] = at(e);
      // Grab the handle under the mouse, or the closest one anywhere on the picture.
      let i = nearest(x, y, 22);
      if (i < 0) i = nearest(x, y, 1e5);
      if (i < 0) return;
      e.preventDefault(); e.stopPropagation();
      cv.setPointerCapture(e.pointerId);
      const hd = st.handles[i];
      st.drag = i; st.hot = i; st.over = {};
      cv.style.cursor = "grabbing";
      cv.classList.add("grabbing");
      if (typeof ui !== "undefined") ui.dragging = cv;
      // The handle keeps its offset from the mouse, so it never jumps on grab.
      const off = [hd.x - x, hd.y - y];
      let last = [x, y], pos = [hd.x, hd.y], first = true;
      const move = (ev) => {
        const [mx, my] = at(ev);
        const k = ev.shiftKey ? 0.25 : 1;
        pos = [pos[0] + (mx - last[0]) * k, pos[1] + (my - last[1]) * k];
        last = [mx, my];
        if (!ev.shiftKey) pos = [mx + off[0], my + off[1]];
        const handle = st.handles[i];
        if (!handle || !handle.drag) return;
        const vals = handle.drag(pos[0], pos[1], ev) || {};
        for (const [pid, v] of Object.entries(vals)) {
          if (pid == null || pid === "null") continue;
          const nv = clamp01(v);
          if (st.over[pid] === nv) continue;
          st.over[pid] = nv;
          st.send(pid, nv, first);
          first = false;
        }
        if (st.onLive) st.onLive(st.over);
        repaint();
      };
      const up = () => {
        cv.removeEventListener("pointermove", move);
        cv.removeEventListener("pointerup", up);
        cv.removeEventListener("pointercancel", up);
        st.drag = -1;
        cv.classList.remove("grabbing");
        cv.style.cursor = st.hot >= 0 ? "grab" : "default";
        if (typeof ui !== "undefined" && ui.dragging === cv) ui.dragging = null;
        // Keep showing the dragged values until the engine's own come back.
        const p = st.getP();
        if (p && st.over) for (const [pid, v] of Object.entries(st.over)) { const q = p.params.find((x) => x.id === pid); if (q) q.value = v; }
        st.over = null;
        repaint();
      };
      cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerup", up);
      cv.addEventListener("pointercancel", up);
    });

    // Double-click a handle: back to where that effect starts.
    cv.addEventListener("dblclick", (e) => {
      const p = st.getP();
      const [x, y] = at(e);
      const i = nearest(x, y, 22);
      if (!p || i < 0 || !st.handles[i].drag) return;
      e.stopPropagation();
      const hd = st.handles[i];
      const touched = Object.keys(hd.drag(hd.x, hd.y) || {});
      let first = true;
      for (const pid of touched) {
        const q = p.params.find((x2) => x2.id === pid);
        if (q && q.def != null) { q.value = q.def; st.send(pid, q.def, first); first = false; }
      }
      repaint();
    });
  }

  function redraw(pluginId) {
    document.querySelectorAll(`canvas[data-fx="${CSS.escape(pluginId)}"]`).forEach((cv) => {
      if (cv._fx && cv._fx.getP) { const p = cv._fx.getP(); if (p) draw(cv, p); }
    });
  }

  // ------------------------------------------------------------------ the built-in pictures
  const pct = (v) => Math.round(v * 100) + "%";

  // Delay: the dry hit, then its echoes on a timeline with the beat grid behind.
  // Left/right = time (snaps to note values), up/down = feedback.
  const NOTE_VALUES = [[1 / 32, "1/32"], [1 / 16, "1/16"], [1 / 12, "1/8 triplet"], [3 / 32, "1/16 dotted"], [1 / 8, "1/8"],
    [1 / 6, "1/4 triplet"], [3 / 16, "1/8 dotted"], [1 / 4, "1/4"], [3 / 8, "1/4 dotted"], [1 / 2, "1/2"]];
  register("delay", {
    draw(d) {
      const ms = d.v(/delayTime|time/i, 0.25) * 1500, fb = d.v(/feedback/i, 0.4), mix = d.v(/mix/i, 0.3);
      const span = 2000, xOf = (t) => d.x0 + 8 + (t / span) * (d.x1 - d.x0 - 8);
      const beatMs = 60000 / d.bpm;
      const xs = [];
      for (let t = 0; t <= span; t += beatMs / 2) xs.push(xOf(t));
      d.grid(xs, []);
      for (let t = 0, i = 0; t <= span; t += beatMs, i++) d.label(i ? String(i + 1) : "1", xOf(t) + 3, d.y1 + 2, "left", d.ink3, 9);
      // The dry sound, then each echo quieter by the feedback.
      const bar = (x, a, alpha) => {
        const top = d.Y(a);
        const grad = d.g.createLinearGradient(0, top, 0, d.y0);
        grad.addColorStop(0, d.rgba(alpha)); grad.addColorStop(1, d.rgba(alpha * 0.25));
        d.g.fillStyle = grad; d.g.fillRect(x - 3, top, 6, d.y0 - top);
        d.g.fillStyle = d.rgba(Math.min(1, alpha + 0.2)); d.g.fillRect(x - 3, top, 6, 2);
      };
      bar(xOf(0), 0.92, 0.35);
      const wet = 0.35 + 0.65 * mix;
      let a = Math.max(0.05, fb) * 0.92;
      for (let k = 1, t = ms; t <= span && a > 0.02 && k < 60; k++, t += ms, a *= 0.85 * fb) bar(xOf(t), a, wet * (k === 1 ? 1 : 0.85));
      d.label("echo every " + Math.round(ms) + " ms", d.x1, d.y0 + 12, "right");
    },
    handles(d) {
      const ms = d.v(/delayTime|time/i, 0.25) * 1500, fb = d.v(/feedback/i, 0.4);
      const span = 2000, xOf = (t) => d.x0 + 8 + (t / span) * (d.x1 - d.x0 - 8), tOf = (x) => ((x - d.x0 - 8) / (d.x1 - d.x0 - 8)) * span;
      const tid = d.id(/delayTime|time/i), fid = d.id(/feedback/i);
      const barMs = (60000 / d.bpm) * 4;
      const noteOf = (t) => NOTE_VALUES.find(([f]) => Math.abs(f * barMs - t) < 3);
      return [{
        x: xOf(ms), y: d.Y(Math.max(0.05, fb) * 0.92),
        label: () => { const n = noteOf(d.v(tid, 0.25) * 1500); return d.t(tid) + (n ? " · " + n[1] : "") + "   feedback " + pct(d.v(fid, 0.4)); },
        drag: (px, py, ev) => {
          let t = Math.max(10, Math.min(1500, tOf(px)));
          // Snap to the nearest note value when it's close (hold Alt to move freely).
          if (!(ev && ev.altKey)) {
            const near = NOTE_VALUES.map(([f]) => f * barMs).filter((x) => x <= 1500)
              .reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), Infinity);
            if (Math.abs(xOf(near) - xOf(t)) < 7) t = near;
          }
          return { [tid]: t / 1500, [fid]: d.V(py) / 0.92 };
        },
      }];
    },
  });

  // Reverb (Space and the built-in Reverb): the room on the left, the tail it leaves.
  register("verb", {
    draw(d) {
      const space = /ktspace|space/i.test(d.p.type + d.p.name);
      const size = d.v(/size/i, 0.6), decay = space ? d.v(/decay/i, 0.45) : size, damp = space ? 0.35 : d.v(/damp/i, 0.5);
      const mix = d.v(/mix|wet/i, 0.3);
      // The room: a box in perspective, bigger with Size.
      const s = 16 + size * 30, rx = d.x0 + 4, ry = d.y0 - s;
      d.g.strokeStyle = d.rgba(0.65); d.g.lineWidth = 1.2;
      d.g.strokeRect(rx, ry, s, s);
      d.g.beginPath(); d.g.moveTo(rx, ry); d.g.lineTo(rx + s * 0.35, ry - s * 0.3); d.g.lineTo(rx + s * 1.35, ry - s * 0.3);
      d.g.lineTo(rx + s, ry); d.g.moveTo(rx + s * 1.35, ry - s * 0.3); d.g.lineTo(rx + s * 1.35, d.y0 - s * 0.3); d.g.lineTo(rx + s, d.y0); d.g.stroke();
      // The tail: a dense fall-off of reflections. Damping darkens the far end.
      const t0 = rx + s * 1.35 + 10, len = (0.12 + 0.88 * decay) * (d.x1 - t0), top = 0.3 + 0.65 * mix;
      for (let x = t0, i = 0; x < d.x1; x += 2, i++) {
        const u = (x - t0) / Math.max(1, len);
        const env = Math.exp(-u * 4.2) * (u < 0.04 ? 0.55 + u * 10 : 1);
        if (env < 0.01) break;
        const hgt = env * top * (0.55 + 0.45 * noise(i));
        d.g.fillStyle = d.rgba((0.25 + 0.6 * env) * (1 - damp * u * 0.8));
        d.g.fillRect(x, d.Y(hgt), 1.4, d.y0 - d.Y(hgt));
      }
      const env = [];
      for (let x = t0; x <= d.x1; x += 3) { const u = (x - t0) / Math.max(1, len); env.push([x, d.Y(Math.exp(-u * 4.2) * top)]); }
      d.line(env, d.col, 1.4);
      d.label(space ? d.t(/decay/i) + " tail" : "room " + pct(size), d.x1, d.y1 + 2, "right");
    },
    handles(d) {
      const space = /ktspace|space/i.test(d.p.type + d.p.name);
      const sid = d.id(/size/i), did = space ? d.id(/decay/i) : null, mid = d.id(/mix|wet/i);
      const size = d.v(sid, 0.6), decay = space ? d.v(did, 0.45) : size, mix = d.v(mid, 0.3);
      const s = 16 + size * 30, rx = d.x0 + 4, t0 = rx + s * 1.35 + 10, len = (0.12 + 0.88 * decay) * (d.x1 - t0);
      const top = 0.3 + 0.65 * mix, at = 0.25, fall = Math.exp(-at * 4.2);
      const hs = [{
        // The room's corner: drag up or out for a bigger room.
        x: rx + s * 1.35, y: d.y0 - s * 1.3,
        label: () => "size " + d.t(sid),
        drag: (px, py) => ({ [sid]: (Math.max((px - rx) / 1.35, (d.y0 - py) / 1.3) - 16) / 30 }),
      }];
      // The tail: up/down = how loud it is, left/right = how long (Space's Decay).
      hs.push({
        x: t0 + len * at, y: d.Y(fall * top),
        label: () => (did ? "decay " + d.t(did) + "   " : "") + "mix " + d.t(mid),
        drag: (px, py) => ({ [mid]: (d.V(py) / fall - 0.3) / 0.65,
                             ...(did ? { [did]: ((px - t0) / at / (d.x1 - t0) - 0.12) / 0.88 } : {}) }),
      });
      return hs;
    },
  });

  // EQ: the curve, a handle on each band. Up/down = gain.
  const BANDS = [[0.12, /low/i, "low"], [0.5, /mid/i, "mid"], [0.88, /high|air/i, "high"]];
  const eqCurve = (d, f) => {
    const db = (re) => (d.v(re, 0.5) - 0.5) * 2;
    return db(BANDS[0][1]) / (1 + Math.exp((f - 0.22) * 14)) + db(BANDS[1][1]) * Math.exp(-((f - 0.5) ** 2) / 0.02)
      + db(BANDS[2][1]) / (1 + Math.exp(-(f - 0.78) * 14));
  };
  register("eq", {
    draw(d) {
      const mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2 - 4;
      d.grid([0.25, 0.5, 0.75].map(d.X), [mid]);
      ["100", "1k", "10k"].forEach((t, i) => d.label(t, d.X([0.18, 0.5, 0.84][i]), d.y0 + 12, "center"));
      const pts = [];
      for (let x = d.x0; x <= d.x1; x += 2) pts.push([x, mid - eqCurve(d, d.U(x)) * amp]);
      d.fill(pts, mid, 0.2);
      d.line(pts, d.col, 2);
    },
    handles(d) {
      const mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2 - 4;
      return BANDS.map(([f, re, name]) => {
        const id = d.id(re);
        if (!id) return null;
        return { x: d.X(f), y: mid - eqCurve(d, f) * amp, label: () => name + " " + d.t(id),
                 drag: (px, py) => ({ [id]: 0.5 + (mid - py) / amp / 2 }) };
      });
    },
  });

  // Compressor: level in -> level out. The knee is the threshold, the slope after it the ratio.
  register("comp", {
    draw(d) {
      const thr = d.v(/thresh/i, 0.6), ratio = 1 + d.v(/ratio/i, 0.3) * 19;
      d.grid([0.25, 0.5, 0.75].map(d.X), [0.25, 0.5, 0.75].map(d.Y));
      d.g.setLineDash([3, 4]); d.line([[d.x0, d.y0], [d.x1, d.y1]], d.ink3, 1); d.g.setLineDash([]);
      const pts = [[d.x0, d.y0], [d.X(thr), d.Y(thr)], [d.x1, d.Y(thr + (1 - thr) / ratio)]];
      d.fill(pts, d.y0, 0.16);
      d.line(pts, d.col, 2);
      // What gets turned down, shaded above the bend.
      d.g.fillStyle = d.rgba(0.1);
      d.g.beginPath(); d.g.moveTo(d.X(thr), d.Y(thr)); d.g.lineTo(d.x1, d.y1); d.g.lineTo(d.x1, d.Y(thr + (1 - thr) / ratio)); d.g.closePath(); d.g.fill();
      d.label("in →", d.x1, d.y0 + 12, "right");
      d.label("out", d.x0, d.y1 + 2);
    },
    handles(d) {
      const tid = d.id(/thresh/i), rid = d.id(/ratio/i);
      const thr = d.v(tid, 0.6), ratio = 1 + d.v(rid, 0.3) * 19;
      const hs = [];
      if (tid) hs.push({ x: d.X(thr), y: d.Y(thr), label: () => "threshold " + d.t(tid), drag: (px) => ({ [tid]: d.U(px) }) });
      if (rid) hs.push({
        x: d.x1, y: d.Y(thr + (1 - thr) / ratio), label: () => "ratio " + d.t(rid),
        // Lower = more squash: from the slope back to the ratio.
        drag: (px, py) => { const k = (d.V(py) - thr) / Math.max(0.02, 1 - thr); return { [rid]: (1 / Math.max(0.05, k) - 1) / 19 }; },
      });
      return hs;
    },
  });

  // Loud: push the level up into a ceiling it never goes over. The knee: left/right = push,
  // up/down = ceiling. Clip (how hard the corner is) stays a knob.
  register("loud", {
    draw(d) {
      const push = d.v(/push/i, 0.25) * 24, ceil = -12 + d.v(/ceiling/i, 0.917) * 12, soft = 1 - d.v(/clip/i, 0.4);
      const dbX = (db) => d.X((db + 30) / 30), dbY = (db) => d.Y((db + 30) / 30);
      d.grid([-24, -18, -12, -6].map(dbX), [-24, -18, -12, -6].map(dbY));
      d.g.setLineDash([3, 4]); d.line([[d.x0, d.y0], [d.x1, d.y1]], d.ink3, 1); d.g.setLineDash([]);
      const pts = [];
      for (let x = d.x0; x <= d.x1; x += 2) {
        const inDb = d.U(x) * 30 - 30 + push;
        const k = 1 + soft * 6;   // soft corner width in dB
        const out = inDb < ceil - k ? inDb : ceil - k + k * Math.tanh((inDb - (ceil - k)) / k);
        pts.push([x, dbY(Math.max(-30, Math.min(0, out)))]);
      }
      d.fill(pts, d.y0, 0.16);
      d.line(pts, d.col, 2);
      d.g.setLineDash([2, 3]); d.line([[d.x0, dbY(ceil)], [d.x1, dbY(ceil)]], css("--acid") || "#e4ff3a", 1); d.g.setLineDash([]);
      d.label("ceiling " + d.t(/ceiling/i), d.x0, dbY(ceil) - 5);
      d.label("in →", d.x1, d.y0 + 12, "right");
    },
    handles(d) {
      const pid = d.id(/push/i), cid = d.id(/ceiling/i);
      const push = d.v(pid, 0.25) * 24, ceil = -12 + d.v(cid, 0.917) * 12;
      const dbX = (db) => d.X((db + 30) / 30), dbY = (db) => d.Y((db + 30) / 30);
      return [{
        x: dbX(Math.max(-30, ceil - push)), y: dbY(ceil),
        label: () => "push " + d.t(pid) + "   ceiling " + d.t(cid),
        drag: (px, py) => {
          const c = Math.min(0, Math.max(-12, d.V(py) * 30 - 30));
          return { [cid]: (c + 12) / 12, [pid]: (c - (d.U(px) * 30 - 30)) / 24 };
        },
      }];
    },
  });

  // SC Clip: the clipping curve with its ceiling, and behind it how much it shaved off lately
  // (FxView.live: { hist, pos, hold }). The knee: left/right = drive, up/down = ceiling.
  register("clip", {
    draw(d) {
      const drive = d.v(/drive/i, 0.17) * 24, shape = d.v(/shape/i, 0.4), ceilV = d.v(/ceiling/i, 0.958);
      const knee = shape >= 0.999 ? 1 : shape * shape * (3 - 2 * shape);   // as in ScClip.h
      const curve = (a) => (a <= knee ? a : 1 - knee < 1e-4 ? 1 : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee)));
      const m = d.live || (typeof ui !== "undefined" && ui.clipMeters && ui.clipMeters.get(d.p.id));
      if (m && m.hist) {
        const n = m.hist.length, bw = (d.x1 - d.x0) / n;
        d.g.fillStyle = d.rgba(0.22);
        for (let i = 0; i < n; i++) {
          const db = m.hist[(m.pos + i) % n];
          if (db > 0.05) d.g.fillRect(d.x0 + i * bw, d.y1, Math.max(1, bw - 0.5), Math.min(1, db / 12) * (d.y0 - d.y1));
        }
      }
      const top = d.Y(0.55 + 0.4 * ceilV), g = Math.pow(10, drive / 20);
      d.grid([], [top]);
      const pts = [];
      for (let x = d.x0; x <= d.x1; x += 2) pts.push([x, d.y0 - curve(d.U(x) * 1.2 * g) * (d.y0 - top)]);
      d.fill(pts, d.y0, 0.14);
      d.line(pts, d.col, 2);
      const now = m ? m.hold || 0 : 0;
      d.label(now > 0.05 ? "−" + now.toFixed(1) + " dB shaved" : "nothing shaved yet", d.x1, d.y1 + 2, "right", now > 0.05 ? d.col : d.ink3);
    },
    handles(d) {
      const did = d.id(/drive/i), cid = d.id(/ceiling/i);
      const g = Math.pow(10, d.v(did, 0.17) * 24 / 20), top = d.Y(0.55 + 0.4 * d.v(cid, 0.958));
      return [{
        x: Math.min(d.x1, d.X(1 / (1.2 * g))), y: top,
        label: () => "drive " + d.t(did) + "   ceiling " + d.t(cid),
        drag: (px, py) => ({ [did]: (20 * Math.log10(1 / (1.2 * Math.max(0.02, d.U(px))))) / 24, [cid]: (d.V(py) - 0.55) / 0.4 }),
      }];
    },
  });

  // Pump: two steps of the duck. The dip's floor = depth, where it's back up = release.
  // With a sidechain lane, each dip starts on that lane's hit instead of the beat.
  register("pump", {
    draw(d) {
      const depth = d.v(/depth/i, 0.7), rel = 0.05 + d.v(/release/i, 0.526) * 0.95, keyed = !!d.p.sidechain;
      const stepW = (d.x1 - d.x0) / 2;
      const gain = (u) => {   // u: 0..2 steps
        const ph = u % 1, att = 0.03;
        if (ph < att) return 1 - depth * (ph / att);
        const q = (ph - att) / Math.max(0.02, rel * (1 - att));
        return 1 - depth * (q >= 1 ? 0 : 0.5 * (1 + Math.cos(q * Math.PI)));
      };
      d.grid([d.x0 + stepW], [d.Y(1 - depth)]);
      // The trigger: a hit on the other lane, or the beat.
      for (let k = 0; k < 2; k++) {
        const x = d.x0 + k * stepW;
        if (keyed) {
          const hits = [];
          for (let i = 0; i < 18; i++) hits.push([x + 2 + i * 1.6, d.y0 - Math.exp(-i / 5) * 18 * (0.6 + 0.4 * noise(i + k * 30))]);
          d.line([[x + 2, d.y0], ...hits], d.ink3, 1.2);
        } else d.dot(x + 3, d.y0 + 1, 2.5, d.ink3);
      }
      const pts = [];
      for (let x = d.x0; x <= d.x1; x += 1.5) pts.push([x, d.Y(gain(((x - d.x0) / stepW)) * 0.95)]);
      d.fill(pts, d.y0, 0.16);
      d.line(pts, d.col, 2);
      const src = keyed && typeof ui !== "undefined" && ui.state ? ui.state.tracks.find((t) => t.id === d.p.sidechain) : null;
      d.label(keyed ? "ducks on " + (src ? src.name : "the lane") + "'s hits" : "ducks on every " + (d.t(/rate/i) || "1/4"), d.x1, d.y0 + 12, "right");
    },
    handles(d) {
      const did = d.id(/depth/i), rid = d.id(/release/i);
      const depth = d.v(did, 0.7), rel = 0.05 + d.v(rid, 0.526) * 0.95, stepW = (d.x1 - d.x0) / 2;
      return [
        { x: d.x0 + stepW * 0.03 + 4, y: d.Y((1 - depth) * 0.95), label: () => "depth " + d.t(did),
          drag: (px, py) => ({ [did]: 1 - d.V(py) / 0.95 }) },
        { x: d.x0 + stepW * (0.03 + rel * 0.97), y: d.Y(0.95), label: () => "release " + d.t(rid),
          drag: (px) => ({ [rid]: (((px - d.x0) / stepW - 0.03) / 0.97 - 0.05) / 0.95 }) },
      ];
    },
  });

  // Gate: the sound's level, open above the line, held down by the range below it.
  register("gate", {
    draw(d) {
      const thr = d.v(/thresh/i, 0.45), range = d.v(/range/i, 0.8);
      const ty = d.Y(thr);
      for (let x = d.x0, i = 0; x < d.x1; x += 3, i++) {
        const env = Math.abs(Math.sin(i / 7.5)) * (0.35 + 0.65 * noise(i));
        const open = env > thr;
        const hh = open ? env : env * (1 - range);
        d.g.fillStyle = open ? d.rgba(0.85) : d.rgba(0.15);
        d.g.fillRect(x, d.Y(hh), 2, d.y0 - d.Y(hh));
        if (!open) { d.g.fillStyle = d.rgba(0.06); d.g.fillRect(x, d.Y(env), 2, d.Y(hh) - d.Y(env)); }
      }
      d.g.setLineDash([3, 3]); d.line([[d.x0, ty], [d.x1, ty]], css("--acid") || "#e4ff3a", 1); d.g.setLineDash([]);
      d.label("opens above", d.x0, ty - 5);
    },
    handles(d) {
      const tid = d.id(/thresh/i), rid = d.id(/range/i);
      const hs = [{ x: d.x1 - 14, y: d.Y(d.v(tid, 0.45)), label: () => "threshold " + d.t(tid), drag: (px, py) => ({ [tid]: d.V(py) }) }];
      if (rid) hs.push({ x: d.x0 + 14, y: d.Y(0.45 * (1 - d.v(rid, 0.8))), label: () => "range " + d.t(rid), drag: (px, py) => ({ [rid]: 1 - d.V(py) / 0.45 }) });
      return hs;
    },
  });

  // Drive: the waveshape, level in -> level out. Up = more drive (the curve squares off).
  const shapeAt = (u, amt) => { const k = 1 + amt * 8; return Math.tanh(u * k) / Math.tanh(k); };
  register("drive", {
    draw(d) {
      const amt = d.v(/drive|density|input/i, 0.4);
      const mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2;
      d.grid([d.X(0.5)], [mid]);
      d.g.setLineDash([3, 4]); d.line([[d.x0, d.y0], [d.x1, d.y1]], d.ink3, 1); d.g.setLineDash([]);
      const pts = [];
      for (let x = d.x0; x <= d.x1; x += 2) pts.push([x, mid - shapeAt(d.U(x) * 2 - 1, amt) * amp]);
      d.fill(pts, mid, 0.14);
      d.line(pts, d.col, 2);
      d.label("in \u2192", d.x1, d.y0 + 12, "right");
    },
    handles(d) {
      const id = d.id(/drive|density|input/i);
      if (!id) return [];
      const mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2, u = 0.22;
      return [{ x: d.X(0.5 + u / 2), y: mid - shapeAt(u, d.v(id, 0.4)) * amp, label: () => "drive " + d.t(id),
        drag: (px, py) => {
          // The drive that puts this point at the mouse's height.
          const want = (mid - py) / amp;
          let lo = 0, hi = 1;
          for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (shapeAt(u, m) < want) lo = m; else hi = m; }
          return { [id]: lo };
        } }];
    },
  });

  // Crush: a wave in steps. Up/down = bits (finer steps), left/right = sample rate.
  register("crush", {
    draw(d) {
      const bits = 2 + d.v(/bits/i, 0.43) * 14, rate = d.v(/rate/i, 0.62);
      const levels = Math.pow(2, bits) / 2, hold = 2 + (1 - rate) * 22;
      const mid = (d.y0 + d.y1) / 2, amp = (d.y0 - d.y1) / 2 * 0.9;
      d.grid([], [mid]);
      const smooth = [], steps = [];
      for (let x = d.x0; x <= d.x1; x += 1) smooth.push([x, mid - Math.sin(d.U(x) * Math.PI * 3) * amp]);
      d.line(smooth, d.ink3, 1);
      for (let x = d.x0; x <= d.x1; x += hold) {
        const s = Math.round(Math.sin(d.U(x) * Math.PI * 3) * levels) / levels;
        steps.push([x, mid - s * amp], [Math.min(d.x1, x + hold), mid - s * amp]);
      }
      d.fill(steps, mid, 0.14);
      d.line(steps, d.col, 2);
    },
    handles(d) {
      const bid = d.id(/bits/i), rid = d.id(/rate/i);
      return [{ x: d.X(d.v(rid, 0.62)), y: d.Y(0.15 + 0.8 * d.v(bid, 0.43)), label: () => d.t(bid) + "   " + d.t(rid),
                drag: (px, py) => ({ [rid]: d.U(px), [bid]: (d.V(py) - 0.15) / 0.8 }) }];
    },
  });

  // De-ess: the dip it cuts in the hiss. Left/right = frequency, down = more.
  register("deess", {
    draw(d) {
      const f = d.v(/freq/i, 0.5), amt = d.v(/intens/i, 0.4), max = d.v(/max/i, 0.5);
      const c = 0.35 + f * 0.55, top = d.Y(0.82);
      d.grid([0.25, 0.5, 0.75].map(d.X), []);
      const pts = [];
      for (let x = d.x0; x <= d.x1; x += 2) pts.push([x, top + amt * (0.4 + max * 0.6) * (d.y0 - top) * 0.9 * Math.exp(-((d.U(x) - c) ** 2) / 0.008)]);
      d.fill(pts, d.y0, 0.14);
      d.line(pts, d.col, 2);
      d.label("s / t", d.X(c), d.y0 + 12, "center");
    },
    handles(d) {
      const fid = d.id(/freq/i), iid = d.id(/intens/i);
      const c = 0.35 + d.v(fid, 0.5) * 0.55, top = d.Y(0.82);
      return [{ x: d.X(c), y: top + d.v(iid, 0.4) * (0.4 + d.v(/max/i, 0.5) * 0.6) * (d.y0 - top) * 0.9,
                label: () => "freq " + d.t(fid) + "   amount " + d.t(iid),
                drag: (px, py) => ({ [fid]: (d.U(px) - 0.35) / 0.55, [iid]: (py - top) / ((0.4 + d.v(/max/i, 0.5) * 0.6) * (d.y0 - top) * 0.9) }) }];
    },
  });

  // Squash: three bands; each one's loud and quiet parts pulled together by Depth.
  register("multi", {
    draw(d) {
      const depth = d.v(/depth/i, 0.4), bw = (d.x1 - d.x0) / 3;
      [[0.92, 0.3], [0.7, 0.18], [0.82, 0.12]].forEach(([hi, lo], i) => {
        const x = d.x0 + i * bw + 8, wdt = bw - 16;
        const nhi = hi + (0.62 - hi) * depth, nlo = lo + (0.5 - lo) * depth;
        d.g.fillStyle = d.rgba(0.08); d.g.fillRect(x, d.Y(hi), wdt, d.Y(lo) - d.Y(hi));
        d.g.fillStyle = d.rgba(0.45); d.g.fillRect(x, d.Y(nhi), wdt, d.Y(nlo) - d.Y(nhi));
        d.g.fillStyle = d.col; d.g.fillRect(x, d.Y(nhi), wdt, 2); d.g.fillRect(x, d.Y(nlo) - 2, wdt, 2);
        d.label(["low", "mid", "high"][i], x + wdt / 2, d.y0 + 12, "center");
      });
    },
    handles(d) {
      const id = d.id(/depth/i), bw = (d.x1 - d.x0) / 3;
      // On the low band's top, which moves the most: down = more squash.
      return [{ x: d.x0 + bw * 0.5, y: d.Y(0.92 - 0.3 * d.v(id, 0.4)), label: () => "depth " + d.t(id),
                drag: (px, py) => ({ [id]: (0.92 - d.V(py)) / 0.3 }) }];
    },
  });

  // Punch: one drum hit's shape. The spike = attack, the tail = sustain.
  const punchEnv = (u, att, sus) => {
    const env = u < 0.04 ? u / 0.04 : Math.exp(-(u - 0.04) * 6);
    const spike = Math.exp(-(u - 0.04) * 40) * (u >= 0.04 ? 1 : u / 0.04);
    return Math.max(0, Math.min(1.25, env * (1 + sus * 0.6 * (1 - spike)) + spike * att * 0.45)) / 1.25;
  };
  register("punch", {
    draw(d) {
      const att = (d.v(/attack/i, 0.7) - 0.5) * 2, sus = (d.v(/sustain/i, 0.4) - 0.5) * 2;
      const before = [], pts = [];
      for (let x = d.x0; x <= d.x1; x += 2) { before.push([x, d.Y(punchEnv(d.U(x), 0, 0))]); pts.push([x, d.Y(punchEnv(d.U(x), att, sus))]); }
      d.g.setLineDash([3, 4]); d.line(before, d.ink3, 1); d.g.setLineDash([]);
      d.fill(pts, d.y0, 0.16);
      d.line(pts, d.col, 2);
    },
    handles(d) {
      const aid = d.id(/attack/i), sid = d.id(/sustain/i);
      const att = (d.v(aid, 0.7) - 0.5) * 2, sus = (d.v(sid, 0.4) - 0.5) * 2;
      return [
        { x: d.X(0.045), y: d.Y(punchEnv(0.045, att, sus)), label: () => "attack " + d.t(aid),
          drag: (px, py) => { const base = punchEnv(0.045, 0, sus), per = punchEnv(0.045, 1, sus) - base; return { [aid]: 0.5 + ((d.V(py) - base) / Math.max(0.01, per)) / 2 }; } },
        { x: d.X(0.3), y: d.Y(punchEnv(0.3, att, sus)), label: () => "sustain " + d.t(sid),
          drag: (px, py) => { const base = punchEnv(0.3, att, 0), per = punchEnv(0.3, att, 1) - base; return { [sid]: 0.5 + ((d.V(py) - base) / Math.max(0.01, per)) / 2 }; } },
      ];
    },
  });

  // Chop Pitch (and other pitch shifters): the note before (dashed) and after, on a semitone
  // ladder. Up/down = pitch, snapping to whole semitones (Alt = free). The small handle on
  // the right is the formant (the voice's character).
  register("tune", {
    draw(d) {
      const pid = d.id(/pitch|semi/i), fid = d.id(/formant/i);
      const st = (d.v(pid, 0.5) - 0.5) * 24, fm = fid ? (d.v(fid, 0.5) - 0.5) * 24 : 0;
      const yOf = (s) => d.Y(0.5 + s / 26);
      for (let s = -12; s <= 12; s++) {
        d.g.fillStyle = s % 12 === 0 ? "rgba(255,255,255,0.10)" : s % 1 === 0 && [1, 3, 6, 8, 10].includes(((s % 12) + 12) % 12) ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.03)";
        d.g.fillRect(d.x0, yOf(s) - 0.5, d.x1 - d.x0, 1);
      }
      d.g.setLineDash([4, 4]); d.line([[d.x0, yOf(0)], [d.x1 * 0.7, yOf(0)]], d.ink3, 1.5); d.g.setLineDash([]);
      const pts = [];
      for (let x = d.x0; x <= d.x1 * 0.7; x += 2) pts.push([x, yOf(st) + Math.sin(x / 9) * 1.2]);
      d.line(pts, d.col, 3);
      if (fid) { d.line([[d.X(0.8), yOf(fm)], [d.x1, yOf(fm)]], d.rgba(0.6), 2); d.label("formant", d.x1, yOf(fm) - 6, "right"); }
      d.label((st > 0.05 ? "+" : "") + st.toFixed(st % 1 ? 1 : 0) + " st", d.x0, d.y1 + 2);
    },
    handles(d) {
      const pid = d.id(/pitch|semi/i), fid = d.id(/formant/i);
      const yOf = (s) => d.Y(0.5 + s / 26), sOf = (y) => (d.V(y) - 0.5) * 26;
      const snap = (s, ev) => (ev && ev.altKey ? s : Math.round(s));
      const hs = [];
      if (pid) hs.push({ x: d.X(0.35), y: yOf((d.v(pid, 0.5) - 0.5) * 24), label: () => "pitch " + d.t(pid),
                         drag: (px, py, ev) => ({ [pid]: 0.5 + snap(Math.max(-12, Math.min(12, sOf(py))), ev) / 24 }) });
      if (fid) hs.push({ x: d.X(0.9), y: yOf((d.v(fid, 0.5) - 0.5) * 24), label: () => "formant " + d.t(fid),
                         drag: (px, py, ev) => ({ [fid]: 0.5 + snap(Math.max(-12, Math.min(12, sOf(py))), ev) / 24 }) });
      return hs;
    },
  });

  // Anything else (plugins from other makers): a bar per knob, each one dragged up/down.
  register("other", {
    draw(d) {
      const ps = d.p.params;
      if (!ps.length) { d.label("its own window has the controls", d.w / 2, d.h / 2 + 3, "center"); return; }
      const bw = (d.x1 - d.x0) / ps.length;
      ps.forEach((q, i) => {
        const v = d.v(q.id, 0.5), x = d.x0 + i * bw + 6, top = d.Y(v);
        d.g.fillStyle = d.rgba(0.08); d.g.fillRect(x, d.y1, bw - 12, d.y0 - d.y1);
        d.g.fillStyle = d.rgba(0.55); d.g.fillRect(x, top, bw - 12, d.y0 - top);
        d.g.fillStyle = d.col; d.g.fillRect(x, top, bw - 12, 2);
      });
    },
    handles(d) {
      const bw = (d.x1 - d.x0) / Math.max(1, d.p.params.length);
      return d.p.params.map((q, i) => ({ x: d.x0 + i * bw + bw / 2, y: d.Y(d.v(q.id, 0.5)), label: () => (q.name || q.id) + " " + d.t(q.id),
                                         drag: (px, py) => ({ [q.id]: d.V(py) }) }));
    },
  });

  window.FxView = { register, views, viewFor, draw, attach, redraw, live };
})();
