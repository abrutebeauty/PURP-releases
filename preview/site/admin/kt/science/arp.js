/* ARP SCIENCE (Eman, 9 Nov 2026): a BACKEND DATA plug-in tab. 40 core arp types in 6 families, drawn as
   mini piano rolls you can press to hear, with where each name comes from; the four axes every arp is made
   of (order, rhythm, range, touch); what classic hardware and DAW arpeggiators offer; and what the 104 arps
   scanned from real songs actually do. Data: science/arp-data.json, built by scripts/science/arp/build_arp_data.js
   from scripts/science/arp/arp-types.json + ui/toymachine-arps-songs.js. Flag KT2_ARP_SCIENCE_OFF hides the tab. */
(function () {
  "use strict";
  try { if (window.KT2_ARP_SCIENCE_OFF || localStorage.getItem("KT2_ARP_SCIENCE_OFF") === "1") return; } catch (e) { /* storage blocked */ }

  const CSS = `
  .arp-roll { display: block; width: 100%; height: auto; }
  .arp-roll .g { fill: var(--rule); opacity: .5; }
  .arp-roll .g.beat { opacity: .9; }
  .arp-roll .n { fill: var(--ink2); }
  .arp-roll .n.acc { fill: var(--ink); }
  .arp-roll .n.root { fill: var(--acc); }
  .arp-roll .n.chord { fill: var(--ink2); }
  .arp-roll .ph { fill: var(--acid); opacity: 0; }
  .dcard.on .arp-roll .ph { opacity: .55; }
  .arp-roll .sl { stroke: var(--ink); stroke-width: 1.5; fill: none; opacity: .7; }
  .arp-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .arp-tags span { font: 400 10px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); border: 1px solid var(--rule); padding: 5px 7px; }
  .arp-axes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 30px; }
  .arp-axis { background: var(--tile2); padding: 18px 20px 20px; }
  .arp-axis small { font: 400 11px/1.35 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); display: block; }
  .arp-axis b { display: block; font-weight: 400; font-size: 28px; letter-spacing: -.03em; margin: 14px 0 6px; }
  .arp-axis p { margin: 0 0 14px; font-size: 13px; color: var(--ink2); }
  .arp-axis .chips { margin: 0; }
  .arp-axis .chip { padding: 7px 10px; }
  .arp-mach { display: grid; grid-template-columns: 220px 60px 1fr; gap: 4px 18px; margin-top: 26px; align-items: start; }
  .arp-mach > div { padding: 12px 0; border-top: 1px solid var(--rule); }
  .arp-mach .nm { font-size: 17px; }
  .arp-mach .nm small { display: block; font: 400 11px/1.4 var(--mono); letter-spacing: .08em; color: var(--ink2); margin-top: 4px; }
  .arp-mach .yr { font: 400 13px/1.6 var(--mono); color: var(--ink2); }
  .arp-grids { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 4px; margin-top: 18px; }
  .arp-grid { background: var(--tile2); padding: 14px 16px; display: grid; gap: 10px; }
  .arp-grid .cells { display: grid; gap: 2px; }
  .arp-grid .cells u { display: block; height: 14px; background: var(--rule); opacity: .55; text-decoration: none; }
  .arp-grid .cells u.beat { opacity: .9; }
  .arp-grid .cells u.x { background: var(--ink); opacity: 1; }
  .arp-grid .cap { display: flex; justify-content: space-between; font: 400 11px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); }
  .arp-grid .cap b { color: var(--ink); font-weight: 400; }
  .arp-songs { margin-top: 18px; border-top: 1px solid var(--rule); }
  .arp-song { display: grid; grid-template-columns: 30px 1fr 150px 110px 120px 2fr; gap: 14px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--rule); cursor: pointer; appearance: none; background: none; border-left: 0; border-right: 0; border-top: 0; width: 100%; text-align: left; color: var(--ink); font: inherit; }
  .arp-song:hover { background: var(--tile); }
  .arp-song.on { background: color-mix(in srgb, var(--tile2) 70%, var(--acc-soft)); }
  .arp-song .play { width: 24px; height: 24px; border: 1px solid var(--ink3); display: grid; place-items: center; }
  .arp-song.on .play { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .arp-song .play svg { width: 9px; height: 9px; fill: currentColor; }
  .arp-song .nm { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .arp-song .nm small { display: block; font: 400 10px/1.3 var(--mono); letter-spacing: .08em; color: var(--ink3); margin-top: 2px; }
  .arp-song .mn { font: 400 10px/1.4 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .arp-song .arp-roll { height: 34px; }
  @media (max-width: 980px) { .arp-axes { grid-template-columns: 1fr 1fr; } .arp-mach { grid-template-columns: 1fr; gap: 0; } .arp-mach .yr { display: none; } .arp-song { grid-template-columns: 30px 1fr 90px; } .arp-song .mn.hide, .arp-song .arp-roll { display: none; } }
  @media (max-width: 520px) { .arp-axes { grid-template-columns: 1fr; } }
  `;

  // ---------------------------------------------------------------- music: steps -> notes
  const HELD = [45, 48, 52, 57];                       // A2 C3 E3 A3: the chord the previews hold (A minor, Eman's key)
  const RATE = { "1/4": 1, "1/8": 2, "1/8t": 3, "1/8d": 4 / 3, "1/16": 4, "1/16t": 6, "1/32": 8 }; // steps per beat
  const midi = (n, oct) => HELD[((n % 4) + 4) % 4] + 12 * Math.floor(n / 4) + 12 * (oct || 0);
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function pool(octaves) { const p = []; for (let o = 0; o < (octaves || 1); o++) for (let i = 0; i < 4; i++) p.push(i + 4 * o); return p; }
  function orderOf(order, octaves, seed) {
    const p = pool(octaves), top = p.length - 1;
    switch (order) {
      case "down": return p.slice().reverse();
      case "updown": return p.concat(p.slice(1, -1).reverse());
      case "downup": { const d = p.slice().reverse(); return d.concat(d.slice(1, -1).reverse()); }
      case "bounce": return p.concat(p.slice().reverse());
      case "converge": { const o = []; for (let i = 0; i <= top / 2; i++) { o.push(p[i]); if (top - i !== i) o.push(p[top - i]); } return o; }
      case "diverge": { const o = []; for (let i = 0; i <= top / 2; i++) { o.push(p[i]); if (top - i !== i) o.push(p[top - i]); } return o.reverse(); }
      case "pinky": { const o = []; for (let i = 0; i < top; i++) o.push(p[i], p[top]); return o; }
      case "thumb": { const o = []; for (let i = 1; i <= top; i++) o.push(p[0], p[i]); return o; }
      case "asplayed": { const o = []; for (let k = 0; k < p.length; k += 4) o.push(p[k], p[k + 2], p[k + 1], p[k + 3]); return o.filter((x) => x != null); }
      case "random": { let s = (seed || Date.now()) >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); const o = p.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
      default: return p;
    }
  }
  // expand a pattern into concrete steps: [{n, oct, gate, vel, ratchet, slide}] with n never "next"
  function expand(p, seed) {
    const st = p.steps || [{ n: "next" }];
    if (!st.some((s) => s.n === "next")) return st.map((s) => Object.assign({}, s));
    const seq = orderOf(p.order, p.octaves, seed); let k = 0;
    const out = [];
    const reps = Math.max(1, Math.ceil(seq.length / st.length));
    for (let r = 0; r < reps; r++) for (const s of st) { if (s.n === "next") out.push(Object.assign({}, s, { n: seq[k++ % seq.length] })); else out.push(Object.assign({}, s)); }
    return out;
  }
  const isChord = (p) => p.order === "chord";

  // ---------------------------------------------------------------- drawing: a mini piano roll
  function roll(api, p, seed) {
    const steps = expand(p, seed), L = steps.length, chord = isChord(p);
    const levels = chord ? [0, 1, 2, 3] : [...new Set(steps.filter((s) => s.n != null).map((s) => s.n + 4 * (s.oct || 0)))].sort((a, b) => a - b);
    const rows = Math.max(levels.length, 1), cw = 100 / L, rh = 9, H = rows * rh, W = 100;
    const g = api.svg(W, H); g.setAttribute("class", "arp-roll"); g.setAttribute("preserveAspectRatio", "none"); g.style.height = (rows * 11) + "px";
    const perBeat = RATE[p.rate] || 4;
    for (let i = 0; i < L; i++) api.add(g, "rect", { x: i * cw + 0.3, y: 0, width: cw - 0.6, height: H, class: "g" + (i % perBeat === 0 ? " beat" : "") });
    const y = (lvl) => (rows - 1 - levels.indexOf(lvl)) * rh;
    let prev = null;
    steps.forEach((s, i) => {
      if (s.n == null) { prev = null; return; }
      const lvl = s.n + 4 * (s.oct || 0), gate = Math.min(L - i, s.gate || 0.6), hits = s.ratchet > 1 ? s.ratchet : 1;
      const cls = "n" + (chord ? " chord" : lvl === 0 ? " root" : (s.vel || 0.75) >= 1 ? " acc" : "");
      if (chord) levels.forEach((l) => api.add(g, "rect", { x: i * cw + 0.6, y: y(l) + 1, width: Math.max(1, gate * cw - 1.2), height: rh - 2, class: cls }));
      else for (let r = 0; r < hits; r++) api.add(g, "rect", { x: i * cw + 0.6 + r * (cw / hits), y: y(lvl) + 1, width: Math.max(0.8, (hits > 1 ? cw / hits : gate * cw) - 1.2), height: rh - 2, class: cls });
      if (s.slide && prev != null && !chord) api.add(g, "path", { d: `M${i * cw - 0.6} ${y(prev) + rh / 2} L${i * cw + 0.6} ${y(lvl) + rh / 2}`, class: "sl" });
      prev = lvl;
    });
    api.add(g, "rect", { x: 0, y: 0, width: cw, height: H, class: "ph" });
    return { svg: g, steps, cw };
  }

  // ---------------------------------------------------------------- sound: a small pluck synth
  let playing = null, AC = null;
  function pluck(ac, t, f, dur, v, fromHz) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), flt = ac.createBiquadFilter(), gn = ac.createGain();
    o.type = "sawtooth"; o2.type = "square";
    if (fromHz) { o.frequency.setValueAtTime(fromHz, t); o.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.09, dur * 0.6)); o2.frequency.setValueAtTime(fromHz / 2, t); o2.frequency.exponentialRampToValueAtTime(f / 2, t + Math.min(0.09, dur * 0.6)); }
    else { o.frequency.value = f; o2.frequency.value = f / 2; }
    flt.type = "lowpass"; flt.Q.value = 2.5;
    flt.frequency.setValueAtTime(Math.min(12000, 900 + 2600 * v + f), t); flt.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), t + Math.max(0.08, dur * 0.8));
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.28 * v, t + 0.004); gn.gain.setValueAtTime(0.28 * v, t + dur * 0.55); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ac.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(flt); o.connect(flt); flt.connect(gn); gn.connect(AOUT || ac.destination);
    o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }
  function play(api, p, bpm, card, rolled) {
    stop(api);
    AOUT = api.bus ? api.bus(() => stop(null)) : null; // 9 Nov: own bus, so stopping really silences the old notes
    const ac = AC = api.audio();
    const steps = rolled.steps, L = steps.length, perBeat = RATE[p.rate] || 4, stepDur = 60 / bpm / perBeat;
    const bars = Math.max(2, Math.min(4, Math.round(32 / Math.max(1, L / perBeat * 4 / 4)))); // about 2-4 bars of music
    const total = Math.max(L, Math.ceil(bars * 4 * perBeat / L) * L), t0 = ac.currentTime + 0.06, chord = isChord(p);
    let prevHz = null;
    for (let i = 0; i < total; i++) {
      const s = steps[i % L], t = t0 + i * stepDur;
      if (s.n == null) { prevHz = null; continue; }
      const v = s.vel == null ? 0.75 : s.vel, gate = s.gate || 0.6, hits = s.ratchet > 1 ? s.ratchet : 1;
      if (chord) { for (const n of [0, 1, 2, 3]) pluck(ac, t, hz(midi(n, 0)), Math.max(0.05, gate * stepDur), v * 0.6); prevHz = null; continue; }
      const f = hz(midi(s.n, s.oct));
      for (let r = 0; r < hits; r++) pluck(ac, t + r * stepDur / hits, f, Math.max(0.05, (hits > 1 ? stepDur / hits * 0.9 : gate * stepDur)), v * (r ? 0.8 : 1), s.slide && prevHz ? prevHz : null);
      prevHz = f;
    }
    const ph = rolled.svg.querySelector(".ph"); let raf = 0, last = -1;
    const tick = () => {
      const i = Math.floor((ac.currentTime - t0) / stepDur);
      if (i >= total) { stop(api); return; }
      const st = ((i % L) + L) % L;
      if (i >= 0 && st !== last) { ph.setAttribute("x", (st * rolled.cw).toFixed(2)); last = st; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    card.classList.add("on");
    playing = { card, raf, stopAt: t0 + total * stepDur, out: AOUT };
  }
  let AOUT = null, API = null;
  function stop(api) {
    if (api) API = api;
    if (api && api.stopDrums && !api.bus) api.stopDrums();
    if (!playing) return;
    cancelAnimationFrame(playing.raf); playing.card.classList.remove("on");
    if (playing.out) { const o = playing.out; playing = null; if (AOUT === o) AOUT = null; if (API && API.release) API.release(o); return; }
    if (AC && playing.stopAt > AC.currentTime) { try { AC.suspend().then(() => AC.resume()); } catch (e) { /* fine */ } }
    playing = null;
  }

  // ---------------------------------------------------------------- the tab
  async function render(pane, api) {
    const { h, esc, n0, pc, slide, title, rows, chips, rank, chartBox, svg, add, hover } = api;
    if (!document.getElementById("arp-science-css")) { const st = document.createElement("style"); st.id = "arp-science-css"; st.textContent = CSS; document.head.append(st); }
    let D;
    try { D = window.ARP_SCIENCE_DATA || await (await (window.ktData ? window.ktData("arp") : fetch("science/arp-data.json"))).json(); }
    catch (e) { pane.append(h("section", "slide s-mist", '<h2>Could not load the arp data.<span>science/arp-data.json is missing next to this page.</span></h2>')); return; }
    // not arps (Eman, 9 Nov 22:38): "Chord trigger" and "Trance gate" hit the whole chord at once, so they leave the tab.
    // KT2_ARP_CHORDTYPES_OLD = keep them
    if (!window.KT2_ARP_CHORDTYPES_OLD) D = { ...D, types: D.types.filter((t) => t.id !== "chord" && t.id !== "trancegate") };
    const T = D.types, G = D.groups, S = D.songs, ST = D.stats, gname = (id) => (G.find((g) => g.id === id) || {}).name || id;
    const mid = (t) => Math.round((t.bpm[0] + t.bpm[1]) / 2);
    // window.KT2_ARP_SCIENCE: lets the app (or a test) ask for a type by id
    window.KT2_ARP_SCIENCE = { types: T, songs: S, expand, orderOf };
    document.querySelectorAll(".bd-tab").forEach((b) => b.addEventListener("click", () => stop(api)));

    // ---- 1. hero
    let s = slide("s-sky", "Backend data", "Arp science");
    s.append(title("h1", `${T.length} arps.`, "Press one to hear it."));
    s.append(h("p", "lede", "Every arpeggio you have ever heard is one of these, or two of them stacked. Each card draws the pattern as a small piano roll on the same A minor chord, says where the name comes from, and tells you what the 104 arps we pulled out of real songs do with it."));
    s.append(h("div", "spacer"));
    s.append(rows([["Core arp types", String(T.length), G.map((g) => g.name).join(" \u00b7 ")], ["Song arps scanned", String(ST.n), `${ST.artists} artists, from the MIDI hunt`], ["Arpeggiators compared", String(D.machines.length), "1978 Jupiter-4 to Ableton Live 12"], ["Axes every arp is made of", "4", "order \u00b7 rhythm \u00b7 range \u00b7 touch"]]));
    pane.append(s);

    // ---- 2. the finding: machines play ladders, songs play figures
    s = slide("s-ink", "The finding", "What real songs do");
    const ladders = ST.machineLadders, free = ST.n - ladders;
    s.append(title("h2", "Machines play ladders. Songs play figures.", `Only ${ladders} of the ${ST.n} song arps are a plain up, down or up/down.`));
    s.append(h("p", "lede", `The other ${free} are shapes a hand would play: a fall that resets (waterfall), a note that keeps coming back (pivot), a cell that repeats, or a free figure that is really a tiny melody. ${pc(ST.rate["1/8"] / ST.n)} run in 8ths, not 16ths. ${pc(ST.rests / ST.n)} have holes and ${pc(ST.long / ST.n)} let notes ring past their step. That is why the arp dice should think in figures, not in hardware modes.`));
    const mot = ST.motif.map((m) => ({ label: m.name, v: m.n, text: `${m.n} \u00b7 ${pc(m.n / ST.n)}`, hi: ["ladder-up", "ladder-down", "arch", "valley"].includes(m.id), tip: () => `<b>${esc(m.name)}</b>${m.n} of ${ST.n} song arps<br>${esc(S.filter((x) => x.motif === m.id).slice(0, 3).map((x) => x.artist + " - " + x.song).join("<br>"))}` }));
    s.append(h("div", "spacer"));
    s.append(rank(mot));
    s.append(h("div", "legend", `<span><i style="background:var(--acc);height:8px"></i>A machine mode could play it</span><span><i style="height:8px"></i>A figure: hands, or a step pattern</span>`));
    pane.append(s);

    // ---- 3. the four axes (also filters the cards)
    let axisPick = {};
    s = slide("s-hero", "The science", "Four axes");
    s.append(title("h2", "Every arp is four choices.", "Pick one on an axis and the cards below filter to it."));
    s.append(h("p", "lede", "Order is which chord note comes next. Rhythm is which steps sound. Range is how far it climbs. Touch is how each note is hit. The 40 cards are the combinations that got a name because somebody made a record out of them."));
    const ax = h("div", "arp-axes");
    for (const a of D.axes) {
      const box = h("div", "arp-axis", `<small>${esc(a.name)}</small><b>${esc(a.q)}</b><p>${a.values.length} answers in the 40</p>`);
      const counts = {}; for (const t of T) counts[t.axes[a.id]] = (counts[t.axes[a.id]] || 0) + 1;
      box.append(chips([["", "ANY"]].concat(a.values.map((v) => [v, `${v.toUpperCase()} ${counts[v] || 0}`])), "", (v) => { if (v) axisPick[a.id] = v; else delete axisPick[a.id]; drawCards(); if (v) cardsSlide.scrollIntoView({ behavior: "smooth", block: "start" }); }));
      ax.append(box);
    }
    s.append(ax);
    pane.append(s);

    // ---- 4. the 40 cards
    const cardsSlide = s = slide("s-mist", `The ${T.length}`, "Click a card to play, click again to stop");
    s.style.minHeight = "0";
    s.append(title("h2", "The patterns.", "Purple = the root. Dark = an accent. Yellow = the step playing right now."));
    let grp = "all", auto = true, bpm = 120;
    const tools = h("div", "d-tools");
    const gc = chips([["all", "ALL"]].concat(G.map((g) => [g.id, g.name])), "all", (v) => { grp = v; drawCards(); }); gc.style.margin = "0";
    const q = h("input", "art-q"); q.placeholder = "Search: trance, Moroder, Carti, Bach, 303..."; q.setAttribute("aria-label", "search arps");
    const bc = h("label", "bpm-ctl", `TEMPO <input type="range" min="60" max="180" step="1" value="120"><b>OWN</b>`);
    const rng = bc.querySelector("input"), bl = bc.querySelector("b");
    rng.oninput = () => { auto = false; bpm = +rng.value; bl.textContent = bpm + " BPM"; };
    bl.style.cursor = "pointer"; bl.title = "Click for each arp's own tempo"; bl.onclick = (e) => { e.preventDefault(); auto = true; bl.textContent = "OWN"; };
    tools.append(gc, q, bc);
    const grid = h("div", "dgrid");
    s.append(tools, grid);
    function card(t) {
      const c = h("button", "dcard"); c.type = "button";
      const L = t.learned || { songs: [] }, seed = 7;
      const r = roll(api, t, seed);
      const head = h("div", "dh", `<div><b>${esc(t.name)}</b></div><span class="play"><svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg></span>`);
      const meta1 = h("div", "meta", `<span>${t.bpm[0]}\u2013${t.bpm[1]} BPM</span><span>${esc(t.rate)}${t.octaves > 1 ? ` \u00b7 ${t.octaves} OCT` : ""}</span><span>${esc(t.axes.order)}</span><span>${esc(t.axes.rhythm)}</span>${L.songs.length ? `<span>${L.songs.length} of the ${ST.n} song arps</span>` : ""}`);
      c.append(head, r.svg, meta1, h("p", "about", esc(t.about)), h("p", "origin", `<em>THE NAME</em>${esc(t.origin)}`));
      const tags = h("div", "arp-tags"); for (const f of (t.famous || []).slice(0, 4)) tags.append(h("span", "", esc(f))); c.append(tags);
      if (L.songs.length) { const m = h("div", "meta", `<span>FROM SONGS \u00b7 ${esc(L.artists.join(" \u00b7 "))}</span>`); c.append(m); }
      c.onclick = () => { if (playing && playing.card === c) { stop(api); return; } const rr = t.order === "random" ? roll(api, t, Date.now()) : r; if (rr !== r) { r.svg.replaceWith(rr.svg); } play(api, t, auto ? mid(t) : bpm, c, rr); if (rr !== r) { Object.assign(r, rr); } };
      return c;
    }
    function drawCards() {
      stop(api);
      const qq = q.value.trim().toLowerCase();
      grid.replaceChildren();
      for (const g of G) {
        if (grp !== "all" && grp !== g.id) continue;
        const list = T.filter((t) => t.group === g.id && Object.entries(axisPick).every(([k, v]) => t.axes[k] === v) && (!qq || [t.name, t.about, t.origin, ...(t.genres || []), ...(t.famous || []), ...Object.values(t.axes)].join(" ").toLowerCase().includes(qq)));
        if (!list.length) continue;
        grid.append(h("div", "groups-h", `${esc(g.name)} \u00b7 ${list.length} <span style="letter-spacing:0;text-transform:none;opacity:.8"> \u2014 ${esc(g.blurb)}</span>`));
        for (const t of list) grid.append(card(t));
      }
      if (!grid.children.length) grid.append(h("div", "art-empty", "No arp matches that."));
    }
    q.oninput = drawCards; drawCards();
    pane.append(s);

    // ---- 5. what the machines offer
    s = slide("s-peach", "The hardware", "What the buttons say");
    s.append(title("h2", "Four buttons in 1978. Eighteen styles today.", "Every arpeggiator since the Jupiter-4 has the same first four; the rest is what each maker added."));
    s.append(h("p", "lede", "Roland's four (up, down, up/down, random) are still the core. Ableton added the pincer moves (converge, diverge) and the finger names (pinky, thumb). Elektron added a transpose table per step and Logic added inversions. Nobody ships the figures real songs use: those live in step patterns, not in mode buttons."));
    const mach = h("div", "arp-mach");
    for (const m of D.machines.slice().sort((a, b) => a.year - b.year)) {
      mach.append(h("div", "nm", `${esc(m.name)}<small>${esc(m.range)} \u00b7 ${esc(m.note)}</small>`), h("div", "yr", String(m.year)));
      const tg = h("div", "arp-tags"); for (const md of m.modes) tg.append(h("span", "", esc(md))); const wrap = h("div"); wrap.append(tg); mach.append(wrap);
    }
    s.append(mach);
    pane.append(s);

    // ---- 6. what the songs do (rates, note counts, rhythm grids)
    s = slide("s-sage", "The 104", "Measured from the song MIDIs");
    s.append(title("h2", "What a song arp is made of.", `${ST.n} arps from ${ST.artists} artists, scanned from Songsterr tabs, free MIDI files and video transcriptions.`));
    const tl = h("div", "tiles");
    const tile = (lab, val, p, hl) => h("div", "tile" + (hl ? " hl" : ""), `<small>${esc(lab)}</small><div><b>${esc(val)}</b><p>${esc(p)}</p></div>`);
    tl.append(tile("Rate", pc(ST.rate["1/8"] / ST.n), `run in 8ths. ${pc((ST.rate["1/16"] || 0) / ST.n)} in 16ths, ${ST.rate["1/32"] || 0} in 32nds.`, true));
    tl.append(tile("Notes used", `${Object.entries(ST.uniq).sort((a, b) => b[1] - a[1])[0][0]}`, `different pitches is the most common. ${pc(((ST.uniq[3] || 0) + (ST.uniq[4] || 0)) / ST.n)} use three or four, never a whole scale.`));
    tl.append(tile("Holes", pc(ST.rests / ST.n), "have at least one silent step. Rests are part of the figure."));
    tl.append(tile("Ringing", pc(ST.long / ST.n), `let a note ring past its step. ${pc(ST.startsRoot / ST.n)} start on the root; ${pc(ST.minor / Math.max(1, ST.keyed))} of the keyed ones are minor.`));
    s.append(tl);
    s.append(h("p", "lede", "The rhythms the song arps use most. A dark cell is a note, a light one a rest; the first cell of every beat is brighter."));
    const gg = h("div", "arp-grids");
    for (const gr of ST.grids) {
      const L = gr.g.length, per = L === 16 || L === 12 ? L / 4 : 2;
      const b = h("div", "arp-grid", `<div class="cap"><span>${L} steps</span><b>${gr.n} arps</b></div><div class="cells" style="grid-template-columns:repeat(${L},1fr)">${[...gr.g].map((ch, i) => `<u class="${ch === "x" ? "x" : ""}${i % per === 0 ? " beat" : ""}"></u>`).join("")}</div>`);
      hover(b, () => `<b>${gr.n} of ${ST.n}</b>${esc(S.filter((x) => x.grid === gr.g).slice(0, 4).map((x) => x.artist + " - " + x.song).join("<br>"))}`);
      gg.append(b);
    }
    s.append(gg);
    pane.append(s);

    // ---- 7. tempo map
    s = slide("s-night", "Tempo map", "Where each arp lives");
    s.append(title("h2", "Slow to fast.", "Each bar = the tempo range the arp is usually heard at. The dot = the middle tempo of the song arps that match it."));
    const sorted = T.slice().sort((a, b) => mid(a) - mid(b));
    s.append(chartBox((c, W) => {
      const Lw = Math.min(170, W * 0.36), rowH = 18, Tp = 24, H = Tp + sorted.length * rowH + 6, lo = 40, hi = 190;
      const x = (v) => Lw + (W - Lw - 10) * (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo);
      const g = svg(W, H); c.append(g);
      for (const v of [60, 80, 100, 120, 140, 160, 180]) { add(g, "line", { x1: x(v), x2: x(v), y1: Tp - 6, y2: H, style: "stroke:var(--rule)" }); add(g, "text", { x: x(v), y: 12, "text-anchor": "middle" }, v); }
      sorted.forEach((t, i) => {
        const y = Tp + rowH * i + rowH / 2;
        add(g, "text", { x: Lw - 10, y: y + 4, "text-anchor": "end", style: "font-size:11px;fill:var(--ink);letter-spacing:0;font-family:var(--sans)" }, t.name);
        add(g, "rect", { x: x(t.bpm[0]), y: y - 4, width: Math.max(4, x(t.bpm[1]) - x(t.bpm[0])), height: 8, rx: 4, style: `fill:${t.group === "scene" || t.group === "bass" ? "var(--acc)" : "var(--ink)"}` });
        if (t.learned && t.learned.bpm) add(g, "circle", { cx: x(t.learned.bpm[1]), cy: y, r: 4.5, style: "fill:var(--acid);stroke:var(--g-night, #0a1020);stroke-width:1.5" });
        const hit = add(g, "rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, style: "fill:transparent" });
        hover(hit, () => `<b>${esc(t.name)}</b>${t.bpm[0]}\u2013${t.bpm[1]} BPM \u00b7 ${esc(gname(t.group))}${t.learned && t.learned.bpm ? `<br>song arps like it: ${t.learned.bpm[0]}\u2013${t.learned.bpm[2]} BPM, middle ${t.learned.bpm[1]}` : ""}<br>${esc((t.genres || []).slice(0, 4).join(", "))}`);
      });
    }));
    s.append(h("div", "legend", `<span><i style="background:var(--acc);height:8px"></i>Scene &amp; bass arps</span><span><i style="height:8px"></i>Machine, classical, rhythm, experimental</span><span><i style="background:var(--acid);height:8px;width:8px;border-radius:50%"></i>Middle tempo of the matching song arps</span>`));
    pane.append(s);

    // ---- 8. the 104 song arps, playable
    s = slide("s-lilac", "From songs", `All ${ST.n}, playable`);
    s.style.minHeight = "0";
    s.append(title("h2", "The 104, one by one.", "Each row plays on the same A minor chord at the song's own tempo. The shape column is the figure it was filed under."));
    const sq = h("input", "art-q"); sq.placeholder = "Search: Yeat, Bon Iver, waterfall, 1/16..."; sq.style.marginTop = "18px"; sq.style.flex = "none"; sq.style.maxWidth = "520px";
    const list = h("div", "arp-songs");
    function drawSongs() {
      stop(api);
      const qq = sq.value.trim().toLowerCase();
      list.replaceChildren();
      let n = 0;
      for (const x of S) {
        const mname = D.motifNames[x.motif] || x.motif;
        if (qq && ![x.artist, x.song, x.name, x.key, x.rate, mname, x.about].join(" ").toLowerCase().includes(qq)) continue;
        n++;
        const b = h("button", "arp-song"); b.type = "button";
        const r = roll(api, x, 1);
        b.innerHTML = `<span class="play"><svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg></span><div class="nm">${esc(x.artist)} \u00b7 ${esc(x.song)}<small>${esc(x.about || "")}</small></div><div class="mn">${esc(mname)}</div><div class="mn hide">${esc(x.key || "")}</div><div class="mn hide">${x.bpm || "?"} BPM \u00b7 ${esc(x.rate)}</div>`;
        b.append(r.svg);
        b.onclick = () => { if (playing && playing.card === b) { stop(api); return; } play(api, x, auto ? (x.bpm || 110) : bpm, b, r); };
        list.append(b);
      }
      if (!n) list.append(h("div", "art-empty", "No song arp matches that."));
    }
    sq.oninput = drawSongs; drawSongs();
    s.append(sq, list);
    pane.append(s);
  }

  (window.BackendDataTabs = window.BackendDataTabs || []).push({ id: "arp", label: "ARP SCIENCE", order: 30, render });
})();
