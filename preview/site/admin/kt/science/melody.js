/* MELODY SCIENCE (Eman, 9 Nov 2026): a BACKEND DATA tab. 24 named melody types in 4 families, each with a
   drawing, a press-to-hear preview (the icon or a real phrase from the data) and the story behind its name.
   Data: science/melody-data.json, built by scripts/science/melody/build_melody_data.py from real melodies
   (POP909 pop songs + Nottingham folk tunes + any .mid folder you give it). Lakh-based numbers come from
   api.data() (midi-science-data.json). */
(function () {
  "use strict";
  const CSS = `
  .mel-roll { display: block; width: 100%; height: auto; overflow: visible; }
  .mel-roll .n { fill: var(--ink); }
  .mel-roll .n.now { fill: var(--acid); stroke: var(--ink); stroke-width: 1; }
  .mel-roll .home { stroke: var(--ink3); stroke-dasharray: 2 4; }
  .mel-roll .bar { stroke: var(--rule); }
  .mel-pick { display: flex; gap: 4px; flex-wrap: wrap; }
  .mel-pick button { appearance: none; border: 1px solid var(--rule); background: none; color: var(--ink2); font: 400 10px/1 var(--mono); letter-spacing: .12em; padding: 6px 8px; cursor: pointer; text-transform: uppercase; }
  .mel-pick button.on { border-color: var(--ink); color: var(--ink); }
  .mel-share { display: grid; grid-template-columns: 44px 1fr 40px; gap: 8px; align-items: center; font: 400 10px/1 var(--mono); letter-spacing: .12em; color: var(--ink2); }
  .mel-share .t { height: 6px; background: var(--rule); position: relative; }
  .mel-share .t i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ink); border-radius: 0 3px 3px 0; min-width: 2px; }
  .mel-share .t i.f { background: var(--acc); }
  .mel-share b { text-align: right; font-weight: 400; color: var(--ink); font-variant-numeric: tabular-nums; }
  .mel-shapes { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 4px; margin-top: 24px; }
  .mel-shape { background: var(--tile); padding: 14px 16px 16px; display: grid; gap: 10px; }
  .mel-shape b { font-weight: 500; font-size: 15px; letter-spacing: -.01em; }
  .mel-shape svg { display: block; width: 100%; height: 44px; overflow: visible; }
  .mel-shape svg path { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .mel-sci { display: grid; grid-template-columns: 70px 150px 1fr; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--rule); align-items: baseline; }
  .mel-sci .y { font: 400 12px/1 var(--mono); letter-spacing: .1em; color: var(--ink2); }
  .mel-sci .w { font-weight: 500; }
  .mel-sci p { margin: 0; color: var(--ink2); font-size: 14px; }
  .mel-dna { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 4px; margin-top: 22px; }
  .mel-dna .d { background: var(--tile); padding: 14px 16px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .mel-dna .d span { font: 400 11px/1.5 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); }
  .mel-dna .d b { font-weight: 400; font-size: 22px; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  @media (max-width: 720px) { .mel-sci { grid-template-columns: 56px 1fr; } .mel-sci p { grid-column: 1 / -1; } }`;

  const DEG = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];
  const SHAPES = [
    ["arch", "Arch", "M0 36 C 30 36, 50 4, 75 4 S 120 36, 150 36"],
    ["descending", "Descending", "M0 6 L 150 38"],
    ["ascending", "Ascending", "M0 38 L 150 6"],
    ["horizontal-descending", "Flat, then down", "M0 14 L 80 14 L 150 38"],
    ["ascending-horizontal", "Up, then flat", "M0 38 L 70 10 L 150 10"],
    ["horizontal", "Horizontal", "M0 22 L 150 22"],
    ["bowl", "Bowl", "M0 6 C 30 6, 50 38, 75 38 S 120 6, 150 6"],
    ["descending-horizontal", "Down, then flat", "M0 6 L 70 34 L 150 34"],
    ["horizontal-ascending", "Flat, then up", "M0 30 L 80 30 L 150 6"],
  ];

  // ------------------------------------------------------------------ playback (a soft lead, one voice)
  let AC = null, playing = null, OUT = null;
  // New audio (9 Nov): play through api.bus() and never close the shared context; the old way (close it) stays when the bus
  // is missing or flag KT2_BD_AUDIO_OLD is on.
  function ac(api) { if (OUT) return api.audio(); if (!AC) AC = api.audio(); if (AC.state === "suspended") AC.resume(); return AC; }
  function tone(a, t, midi, dur) {
    const o = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    o.type = "triangle"; o.frequency.value = hz; o2.type = "sine"; o2.frequency.value = hz * 2; 
    f.type = "lowpass"; f.frequency.setValueAtTime(Math.min(9000, hz * 6), t); f.frequency.exponentialRampToValueAtTime(Math.max(300, hz * 1.5), t + dur);
    const end = t + Math.max(0.08, dur * 0.92);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.012); g.gain.setValueAtTime(0.32, Math.max(t + 0.012, end - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.04);
    const g2 = a.createGain(); g2.gain.value = 0.12; o2.connect(g2); g2.connect(f);
    o.connect(f); f.connect(g); g.connect(OUT || a.destination);
    o.start(t); o2.start(t); o.stop(end + 0.06); o2.stop(end + 0.06);
  }
  function stop() {
    if (!playing) return;
    cancelAnimationFrame(playing.raf); playing.card.classList.remove("on"); playing.rects.forEach((r) => r.classList.remove("now"));
    if (playing.out) { const o = playing.out; playing = null; OUT = null; o.api.release(o.g); return; }
    if (AC && playing.stopAt > AC.currentTime) { const old = AC; AC = null; if (old.state !== "closed") old.close().catch(() => {}); }
    playing = null;
  }
  function play(api, seq, bpm, card, rects) {
    stop();
    const g = api.bus ? api.bus(stop) : null; OUT = g;
    const a = ac(api), spb = 60 / bpm, t0 = a.currentTime + 0.05, base = 60;
    const len = Math.max(...seq.map((n) => n[0] + n[2]));
    const loops = len <= 4.5 ? 2 : 1, total = len * loops;
    for (let L = 0; L < loops; L++) for (const [on, p, d] of seq) tone(a, t0 + (on + L * len) * spb, base + p, d * spb);
    let last = -1;
    const tick = () => {
      const now = (a.currentTime - t0) / spb;
      if (now >= total + 0.2) { stop(); return; }
      const inLoop = ((now % len) + len) % len;
      let cur = -1; seq.forEach((n, i) => { if (inLoop >= n[0] && inLoop < n[0] + n[2]) cur = i; });
      if (cur !== last) { if (rects[last]) rects[last].classList.remove("now"); if (rects[cur]) rects[cur].classList.add("now"); last = cur; }
      playing.raf = requestAnimationFrame(tick);
    };
    card.classList.add("on");
    playing = { card, raf: 0, stopAt: t0 + total * spb + 0.3, rects, out: g ? { g, api } : null };
    playing.raf = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------ the drawing: a small piano roll
  function roll(api, seq, minor) {
    const W = 300, H = 96, pad = 6;
    const lo = Math.min(0, ...seq.map((n) => n[1])) - 1, hi = Math.max(12, ...seq.map((n) => n[1])) + 1;
    const len = Math.ceil(Math.max(...seq.map((n) => n[0] + n[2])));
    const s = api.svg(W, H); s.setAttribute("class", "mel-roll"); s.removeAttribute("width"); s.removeAttribute("height");
    const x = (b) => pad + (W - 2 * pad) * b / len, rowH = (H - 2 * pad) / (hi - lo), y = (p) => H - pad - (p - lo + 1) * rowH;
    for (let b = 0; b <= len; b += 4) api.add(s, "line", { x1: x(b), x2: x(b), y1: 0, y2: H, class: "bar" });
    for (const p of [0, 12, 24, -12]) if (p >= lo && p <= hi) api.add(s, "line", { x1: 0, x2: W, y1: y(p) + rowH / 2, y2: y(p) + rowH / 2, class: "home" });
    const rects = seq.map(([on, p, d]) => api.add(s, "rect", { x: x(on) + 0.5, y: y(p), width: Math.max(2, x(on + d) - x(on) - 1.5), height: Math.max(2, rowH - 1), class: "n" }));
    return { svg: s, rects };
  }

  // ------------------------------------------------------------------ helpers
  const pc = (v, d) => (v * 100).toFixed(d == null ? 0 : d) + "%";
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  async function render(pane, api) {
    const { h, esc, n0, slide, title, rows, chips, rank, chartBox, svg, add, hover } = api;
    if (!document.getElementById("mel-css")) { const st = document.createElement("style"); st.id = "mel-css"; st.textContent = CSS; document.head.append(st); }
    let M;
    try { M = window.MELODY_SCIENCE_DATA || window.MELODY_DATA || await (await (window.ktData ? window.ktData("melody") : fetch("science/melody-data.json"))).json(); }
    catch (e) { pane.append(slide("s-mist", "Melody science", "")); pane.lastChild.append(title("h2", "Could not load the data.", "science/melody-data.json is missing next to this page.")); return; }
    const D = api.data() || {}, S = M.sources, P = S.pop, F = S.folk, Y = S.yours || { songs: 0 };
    const SRC = ["pop", "folk"].concat(Y.songs ? ["yours"] : []);
    const SRCN = { pop: "POP", folk: "FOLK", yours: "YOURS" };
    const phrases = SRC.reduce((a, s) => a + (S[s].phrases || 0), 0);
    const byFam = {}; for (const t of M.types) (byFam[t.family] = byFam[t.family] || []).push(t);

    // 1. hero
    let s = slide("s-lilac", "Backend data", "Melody science");
    s.append(title("h1", `${M.types.length} melody types.`, "Press one to hear it."));
    s.append(h("p", "lede", "Real melodies cut into phrases, measured on four things (shape, motion, repetition, rhythm feel), and sorted into named types. Each card draws the type, plays it, and tells you where the name comes from. The counts say how often real songs use it."));
    s.append(h("div", "spacer"));
    s.append(rows([
      ["Phrases measured", n0(phrases), `${n0(P.songs)} pop songs \u00b7 ${n0(F.songs)} folk tunes${Y.songs ? ` \u00b7 ${n0(Y.songs)} of yours` : ""}`],
      ["Notes", n0(SRC.reduce((a, x) => a + S[x].notes, 0))],
      ["Named types", String(M.types.length), M.families.map((f) => f.name).join(" \u00b7 ")],
      ["Minor keys", pc(P.minor), `pop \u00b7 folk ${pc(F.minor)}${D.minor && D.minor.mel ? " \u00b7 lakh midi " + pc(D.songs ? 0.5 : 0.5) : ""}`.replace(/ \u00b7 lakh midi .*$/, "")],
    ]));
    s.append(h("div", "foot", "<span>KILLTOY.studio</span><span>scroll</span>"));
    pane.append(s);

    // 2. the 24 cards
    s = slide("s-mist", "The types", "Click a card to play, click again to stop");
    s.style.minHeight = "0";
    s.append(title("h2", "The patterns.", "Dotted line = the key's home note. Purple bar = how much folk uses it, black = pop."));
    let fam = "all", bpm = 104;
    const tools = h("div", "d-tools");
    const fc = chips([["all", "ALL"]].concat(M.families.map((f) => [f.id, f.name])), "all", (v) => { fam = v; draw(); }); fc.style.margin = "0";
    const q = h("input", "art-q"); q.placeholder = "Search: hook, trap, Beethoven, yodel..."; q.setAttribute("aria-label", "search melody types");
    const bc = h("label", "bpm-ctl", `TEMPO <input type="range" min="60" max="180" step="1" value="104"><b>104 BPM</b>`);
    const rng = bc.querySelector("input"), bl = bc.querySelector("b");
    rng.oninput = () => { bpm = +rng.value; bl.textContent = bpm + " BPM"; };
    tools.append(fc, q, bc);
    const grid = h("div", "dgrid");
    s.append(tools, grid);
    const total = {}; for (const x of SRC) total[x] = S[x].phrases || 1;
    const maxShare = Math.max(...M.types.flatMap((t) => SRC.map((x) => t.share[x] || 0)));
    function card(t) {
      const c = h("button", "dcard"); c.type = "button";
      const picks = [{ id: "icon", lab: "THE IDEA", seq: t.icon.notes, minor: t.icon.minor }].concat((t.examples || []).slice(0, 3).map((e, i, arr) => ({ id: "ex" + i, lab: (e.src === "yours" ? "YOURS" : e.src === "folk" ? "FOLK" : "POP") + (arr.filter((z) => z.src === e.src).length > 1 ? " " + (arr.slice(0, i).filter((z) => z.src === e.src).length + 1) : ""), seq: e.notes, minor: e.minor, title: e.title })));
      let cur = picks[0];
      const head = h("div", "dh", `<div><b>${esc(t.name)}</b></div><span class="play"><svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg></span>`);
      const rollHost = h("div"), pick = h("div", "mel-pick"), src = h("div", "meta");
      let R = null;
      const show = () => { rollHost.replaceChildren(); R = roll(api, cur.seq, cur.minor); rollHost.append(R.svg); src.innerHTML = `<span>${cur.minor ? "minor" : "major"}</span><span>${cur.seq.length} notes</span>${cur.title ? `<span>${esc(cur.title)}</span>` : `<span>${esc(t.family === "shapes" ? "the shape" : "the idea")}</span>`}`; };
      for (const p of picks) {
        const b = h("button", p.id === "icon" ? "on" : "", esc(p.lab)); b.type = "button";
        b.onclick = (e) => { e.stopPropagation(); stop(); cur = p; pick.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); show(); play(api, cur.seq, bpm, c, R.rects); };
        pick.append(b);
      }
      show();
      const share = h("div");
      for (const x of SRC) share.append(h("div", "mel-share", `<span>${SRCN[x]}</span><div class="t"><i class="${x === "folk" ? "f" : ""}" style="width:${(100 * (t.share[x] || 0) / maxShare).toFixed(1)}%"></i></div><b>${pc(t.share[x] || 0, 1)}</b>`));
      hover(share, () => `<b>${esc(t.name)}</b>${SRC.map((x) => `${SRCN[x]}: ${n0(t.count[x] || 0)} of ${n0(total[x])} phrases`).join("<br>")}`);
      c.append(head, rollHost, pick, src, share,
        h("p", "about", esc(t.about)),
        h("p", "origin", `<em>THE NAME</em>${esc(t.origin)}`),
        h("div", "meta", `<span>${esc((t.famous || []).slice(0, 4).join(" \u00b7 "))}</span>`));
      c.onclick = () => { if (playing && playing.card === c) { stop(); return; } play(api, cur.seq, bpm, c, R.rects); };
      return c;
    }
    function draw() {
      stop(); grid.replaceChildren();
      const qq = q.value.trim().toLowerCase();
      for (const f of M.families) {
        if (fam !== "all" && fam !== f.id) continue;
        const list = (byFam[f.id] || []).filter((t) => !qq || [t.name, t.about, t.origin, ...(t.famous || [])].join(" ").toLowerCase().includes(qq));
        if (!list.length) continue;
        grid.append(h("div", "groups-h", `${esc(f.name)} \u00b7 ${list.length} \u00b7 ${esc(f.about)}`));
        for (const t of list) grid.append(card(t));
      }
      if (!grid.children.length) grid.append(h("div", "art-empty", "No melody type matches that."));
    }
    q.oninput = draw; draw();
    pane.append(s);

    // 3. the nine shapes (Huron)
    s = slide("s-sky", "The nine shapes", "Huron, 1996");
    s.append(title("h2", "Every phrase has one of nine shapes.", "Start, middle, end: up, down or flat. The arch wins."));
    s.append(h("p", "lede", "Take any phrase, compare where it starts, where its middle sits and where it ends. That gives nine possible journeys. The music scientist David Huron counted them in thousands of folk songs in 1996 and found the arch on top. Our data agrees, in pop and in folk."));
    const shp = h("div", "mel-shapes");
    const shTot = {}; for (const x of SRC) shTot[x] = sum(M.shapes[x] || {}) || 1;
    const shMax = Math.max(...SHAPES.flatMap(([id]) => SRC.map((x) => (M.shapes[x][id] || 0) / shTot[x])));
    for (const [id, nm, d] of SHAPES.slice().sort((a, b) => (M.shapes.pop[b[0]] || 0) - (M.shapes.pop[a[0]] || 0))) {
      const el = h("div", "mel-shape", `<b>${esc(nm)}</b><svg viewBox="0 0 150 44"><path d="${d}"/></svg>`);
      for (const x of SRC) { const v = (M.shapes[x][id] || 0) / shTot[x]; el.append(h("div", "mel-share", `<span>${SRCN[x]}</span><div class="t"><i class="${x === "folk" ? "f" : ""}" style="width:${(100 * v / shMax).toFixed(1)}%"></i></div><b>${pc(v)}</b>`)); }
      hover(el, () => `<b>${esc(nm)}</b>${SRC.map((x) => `${SRCN[x]}: ${n0(M.shapes[x][id] || 0)} phrases`).join("<br>")}`);
      shp.append(el);
    }
    s.append(shp);
    s.append(h("div", "legend", `<span><i style="height:6px"></i>Pop</span><span><i style="background:var(--acc);height:6px"></i>Folk</span>`));
    pane.append(s);

    // 4. step or leap: interval histogram
    s = slide("s-sage", "Step or leap", "Every move from one note to the next");
    const mp = M.means.pop, mf = M.means.folk, lk = D.minor && D.minor.mel;
    s.append(title("h2", "Melodies mostly move by a step.", `${pc(mp.step)} of pop moves are one or two semitones. ${pc(mp.leap)} are leaps.`));
    s.append(chartBox((c, W) => {
      const H = 240, L = 30, B = 34, T = 16, keys = []; for (let i = -12; i <= 12; i++) keys.push(i);
      const g = svg(W, H); c.append(g);
      const tot = {}; for (const x of ["pop", "folk"]) tot[x] = sum(M.intervals[x]) || 1;
      const mx = Math.max(...keys.flatMap((k) => ["pop", "folk"].map((x) => (M.intervals[x][k] || 0) / tot[x])));
      const colW = (W - L - 10) / keys.length, bw = (colW - 6) / 2;
      const yv = (v) => T + (H - T - B) * (1 - v / mx);
      for (const gv of [0.1, 0.2, 0.3]) if (gv < mx) { add(g, "line", { x1: L, x2: W - 10, y1: yv(gv), y2: yv(gv), style: "stroke:var(--rule)" }); add(g, "text", { x: 0, y: yv(gv) + 4 }, pc(gv)); }
      keys.forEach((k, i) => {
        const x0 = L + colW * i + 3;
        ["pop", "folk"].forEach((x, j) => {
          const v = (M.intervals[x][k] || 0) / tot[x], y = yv(v);
          const r = add(g, "rect", { x: x0 + j * (bw + 2), y, width: bw, height: Math.max(0, H - B - y), rx: 0, style: `fill:${j ? "var(--acc)" : "var(--ink)"}` });
          hover(r, () => `<b>${k === 0 ? "Repeat" : (k > 0 ? "Up " : "Down ") + Math.abs(k) + " semitone" + (Math.abs(k) > 1 ? "s" : "")}</b>${x.toUpperCase()}: ${pc(v, 1)} of all moves (${n0(M.intervals[x][k] || 0)})`);
        });
        add(g, "text", { x: x0 + bw + 1, y: H - B + 16, "text-anchor": "middle" }, k === 0 ? "0" : (k > 0 ? "+" : "") + k);
        if (k === -12 || k === 12 || k === 0) add(g, "text", { x: x0 + bw + 1, y: H - B + 30, "text-anchor": "middle", style: "font-size:9px" }, k === 0 ? "SAME NOTE" : "OCTAVE");
      });
      add(g, "text", { x: W - 10, y: 12, "text-anchor": "end", style: "font-size:9px" }, "SEMITONES \u00b7 DOWN \u2190 \u2192 UP");
    }));
    s.append(h("div", "legend", `<span><i style="height:8px"></i>Pop</span><span><i style="background:var(--acc);height:8px"></i>Folk</span>`));
    s.append(rows([
      ["Repeats the same note", pc(mp.rep), `pop \u00b7 folk ${pc(mf.rep)}` + (lk ? ` \u00b7 lakh midi ${pc(lk.rep)}` : "")],
      ["Steps (1\u20132 semitones)", pc(mp.step), `pop \u00b7 folk ${pc(mf.step)}` + (lk ? ` \u00b7 lakh midi ${pc(lk.step)}` : "")],
      ["Leaps (3+)", pc(mp.leap), `pop \u00b7 folk ${pc(mf.leap)}` + (lk ? ` \u00b7 lakh midi ${pc(lk.leap)}` : "")],
      ["On the pentatonic 5", pc(mp.penta), `pop \u00b7 folk ${pc(mf.penta)} \u00b7 the five notes every culture sings`],
    ]));
    pane.append(s);

    // 5. range + phrase length + density
    s = slide("s-peach", "How big a melody is", "Range, length, speed");
    s.append(title("h2", "An octave, two bars, one and a half notes a beat.", "The average phrase."));
    const trio = h("div"); trio.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;margin-top:36px";
    const mini = (label, obj, fmtKey, note) => {
      const box = h("div"); box.append(h("div", "mono", label));
      box.append(chartBox((c, W) => {
        const H = 150, B = 26, T = 8, keys = Object.keys(obj.pop).map(Number).sort((a, b) => a - b);
        const g = svg(W, H); c.append(g);
        const tot = {}; for (const x of ["pop", "folk"]) tot[x] = sum(obj[x]) || 1;
        const mx = Math.max(...keys.flatMap((k) => ["pop", "folk"].map((x) => (obj[x][k] || 0) / tot[x]))) || 1;
        const colW = (W - 4) / keys.length, bw = Math.max(2, (colW - 4) / 2);
        keys.forEach((k, i) => {
          const x0 = 2 + colW * i + 1;
          ["pop", "folk"].forEach((x, j) => {
            const v = (obj[x][k] || 0) / tot[x], y = T + (H - T - B) * (1 - v / mx);
            const r = add(g, "rect", { x: x0 + j * (bw + 2), y, width: bw, height: Math.max(0, H - B - y), style: `fill:${j ? "var(--acc)" : "var(--ink)"}` });
            hover(r, () => `<b>${esc(fmtKey(k, true))}</b>${x.toUpperCase()}: ${pc(v, 1)} of phrases`);
          });
          if (i % Math.ceil(keys.length / 8) === 0) add(g, "text", { x: x0 + bw, y: H - B + 16, "text-anchor": "middle" }, fmtKey(k));
        });
      }));
      box.append(h("p", "note", note));
      return box;
    };
    trio.append(
      mini("RANGE \u00b7 SEMITONES, LOWEST TO HIGHEST NOTE", M.range, (k, long) => long ? (k >= 24 ? "Two octaves or more" : k + " semitones") : (k === 12 ? "8ve" : k === 24 ? "2\u00d7" : String(k)), `Pop phrases span ${mp.range.toFixed(1)} semitones on average, folk ${mf.range.toFixed(1)}${lk ? `, the Lakh MIDI leads ${lk.range.toFixed(1)}` : ""}. The octave (12) is a wall most singers stay under.`),
      mini("PHRASE LENGTH \u00b7 BEATS", M.phraseBeats, (k, long) => long ? (k >= 16 ? "16 beats or more (cut there)" : k + " beats") : String(k), `Two bars (8 beats) is the pop phrase. Folk tunes run longer because they are dance music that breathes in 4-bar lines.`),
      mini("SPEED \u00b7 NOTES PER BEAT", M.density, (k, long) => long ? (k >= 8 ? "8 or more a beat" : k + " notes a beat") : String(k), `Pop sings ${mp.dens.toFixed(1)} notes a beat, folk ${mf.dens.toFixed(1)}${lk ? `, Lakh MIDI leads ${lk.dens.toFixed(1)}` : ""}. Four and up is the Machine Gun.`),
    );
    s.append(trio);
    s.append(h("div", "legend", `<span><i style="height:8px"></i>Pop</span><span><i style="background:var(--acc);height:8px"></i>Folk</span>`));
    pane.append(s);

    // 6. where phrases start and land
    s = slide("s-ink", "Start and landing", "Which note of the key");
    s.append(title("h2", "Phrases take off from the 5th and land on the 1.", "Home is where a melody rests."));
    const degHost = h("div"); let degMode = "lastDegree";
    const drawDeg = () => {
      degHost.replaceChildren();
      const obj = M[degMode];
      const items = DEG.map((nm, i) => ({ i, nm })).sort((a, b) => (obj.pop[b.i] || 0) - (obj.pop[a.i] || 0));
      const tot = {}; for (const x of ["pop", "folk"]) tot[x] = sum(obj[x]) || 1;
      degHost.append(rank(items.slice(0, 8).map((d, k) => ({ label: `Degree ${d.nm}`, sub: ["1", "3", "5"].includes(d.nm) ? "chord tone" : d.nm === "b3" ? "minor 3rd" : "", v: (obj.pop[d.i] || 0) / tot.pop, text: pc((obj.pop[d.i] || 0) / tot.pop) + " \u00b7 " + pc((obj.folk[d.i] || 0) / tot.folk), hi: k === 0,
        tip: () => `<b>Degree ${d.nm}</b>POP: ${pc((obj.pop[d.i] || 0) / tot.pop, 1)}<br>FOLK: ${pc((obj.folk[d.i] || 0) / tot.folk, 1)}` }))));
      degHost.append(h("p", "note", "Bar = pop. The numbers say pop \u00b7 folk. Degrees are relative to the key, so 1 is the key's root (C in C major, A in A minor)."));
    };
    s.append(chips([["lastDegree", "WHERE IT LANDS"], ["firstDegree", "WHERE IT STARTS"]], "lastDegree", (v) => { degMode = v; drawDeg(); }));
    s.append(degHost); drawDeg();
    pane.append(s);

    // 7. hooks: repetition + DNA combos
    s = slide("s-hero", "How a hook is built", "Repetition");
    s.append(title("h2", "Say it again.", `In a pop song, the most repeated phrase opening comes back in ${pc(M.hookRepeat.pop)} of its phrases.`));
    s.append(h("p", "lede", `A hook is not a special melody, it is a melody you heard already. In pop the song's favourite opening covers ${pc(M.hookRepeat.pop)} of all phrases, in folk tunes ${pc(M.hookRepeat.folk)} (they repeat whole strains). The REPEATERS family (Chant, Seesaw, Riff, Stairs, Echo, Pedal) is ${pc(byFam.hooks.reduce((a, t) => a + (t.share.pop || 0), 0))} of pop phrases.`));
    s.append(h("div", "mono", "<br>MELODY DNA: THE MOST COMMON SHAPE \u00d7 MOTION \u00d7 FEEL COMBINATIONS, POP + FOLK"));
    const dna = h("div", "mel-dna");
    const FEEL = { straight: "straight", offbeat: "off-beat", long: "long notes", machinegun: "machine gun" }, MOT = { step: "steps", leap: "leaps", repeat: "repeats", mixed: "mixed" };
    for (const cb of M.combos) dna.append(h("div", "d", `<span>${esc(cb.shape.replace(/-/g, " \u2192 "))}<br>${esc(MOT[cb.motion] || cb.motion)} \u00b7 ${esc(FEEL[cb.feel] || cb.feel)}</span><b>${n0(cb.n)}</b>`));
    s.append(dna);
    s.append(h("p", "note", "<br>\"Mixed\" motion means steps and leaps both under half of the moves. That it tops the list is the finding: real melodies mix. A dice that only walks or only skips sounds like a machine."));
    pane.append(s);

    // 8. the science
    s = slide("s-night", "The science", "Who found what");
    s.append(title("h2", "A thousand years of naming melodies.", "The people behind the names on the cards."));
    const sci = h("div"); sci.style.marginTop = "28px";
    for (const r of M.science) sci.append(h("div", "mel-sci", `<div class="y">${esc(r.year)}</div><div class="w">${esc(r.who)}</div><p>${esc(r.what)}</p>`));
    s.append(sci);
    pane.append(s);

    // 9. sources
    s = slide("s-mist", "Sources and limits", "");
    s.style.minHeight = "0";
    s.append(title("h2", "Where the numbers come from.", "And what is still missing."));
    s.append(rows([
      ["POP", n0(P.songs) + " songs", `POP909 (Wang, Chen et al., ISMIR 2020): the sung melody line of 909 pop songs, ${n0(P.phrases)} phrases`],
      ["FOLK", n0(F.songs) + " tunes", `Nottingham folk tune collection, jigs, reels, hornpipes, waltzes, ${n0(F.phrases)} phrases`],
      ["LAKH", lk ? n0(D.sources && D.sources.lakh || 0) + " songs" : "\u2014", "The chord brain's melody averages (steps, leaps, density, range), same table the dice reads"],
      ["YOURS", Y.songs ? n0(Y.songs) + " files" : "waiting", Y.songs ? `${n0(Y.phrases)} phrases from your reference MIDI` : "Your reference MIDI lives on the Mac. Point the builder at the folder and this column fills in."],
    ]));
    s.append(h("p", "note", "<br>A phrase is cut where the melody rests for a beat, holds a note for three beats, or after sixteen beats. Each phrase gets exactly one type: the most specific device wins (a repeated cell beats a shape), so the shares add up to 100%. Keys are found from the notes themselves (Krumhansl profiles). POP909 is mostly Chinese pop ballads, so hip-hop flows (Chant, Machine Gun) are under-counted until your MIDI is in."));
    pane.append(s);
  }

  (window.BackendDataTabs = window.BackendDataTabs || []).push({ id: "melody", label: "MELODY SCIENCE", order: 50, render });
})();
