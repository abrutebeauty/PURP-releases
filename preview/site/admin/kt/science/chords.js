/* CHORD SCIENCE (BACKEND DATA plug-in tab, 9 Nov 2026). Not WHICH chords: HOW chords are played.
   41 playing patterns in 5 groups (HOLDS, PULSES, STABS, BROKEN, STRUMS & WORLD), each drawn as a
   mini piano roll (one row per chord voice, 16 steps, 12 for 3/4, 6/8 and triplet feels), playable with
   a press on the dice's favourite loop (i bVI bIII bVII), plus where the name comes from.
   The numbers come from POP909 (880 pop piano arrangements, 69,949 bars), measured by
   scripts/science/chords/analyze_pop909.py; data file science/chords-data.json (window.CHORDS_SCIENCE_DATA wins). */
(window.BackendDataTabs = window.BackendDataTabs || []).push({
  id: "chords", label: "CHORD SCIENCE", order: 40,
  render(pane, api) {
    "use strict";
    const { h, esc, n0, pc, slide, title, rows, chips, rank, chartBox, svg, add, hover } = api;
    const css = document.createElement("style");
    css.textContent = `
      .cs-steps .lane { grid-template-columns: 38px 1fr; }
      .cs-steps .cells u.h { background: var(--ink2); opacity: .45; }
      .cs-steps .cells u.c.X { background: var(--acc); }
      .cs-steps .cells u.c.x { background: var(--acc); opacity: .6; }
      .cs-steps .cells u.bass.X, .cs-steps .cells u.bass.x { background: var(--ink); }
      .cs-steps .cells u.bass.h { background: var(--ink2); }
      .cs-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 4px; margin-top: 26px; }
      .cs-g { background: var(--tile2); padding: 18px 18px 16px; min-height: 150px; display: flex; flex-direction: column; justify-content: space-between; }
      .cs-g b { font-weight: 500; font-size: 20px; letter-spacing: -.02em; display: block; }
      .cs-g i { font: 400 11px/1 var(--mono); letter-spacing: .14em; color: var(--ink3); font-style: normal; }
      .cs-g p { margin: 10px 0 0; font-size: 13px; color: var(--ink2); }
      .cs-g .n { font-size: 34px; letter-spacing: -.04em; line-height: 1; margin-top: 8px; font-variant-numeric: tabular-nums; }
      .cs-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 28px 40px; margin-top: 8px; }
      .cs-two h4 { margin: 24px 0 0; font: 400 11px/1 var(--mono); letter-spacing: .2em; color: var(--ink2); text-transform: uppercase; }
      .dcard .cs-ex { font: 400 11px/1.5 var(--mono); letter-spacing: .06em; color: var(--ink3); margin: 0; }
      .dcard .cs-ex b { color: var(--ink2); font-weight: 500; }
    `;
    pane.append(css);

    // ------------------------------------------------------------ audio: a soft chord synth
    // Progression = the dice's favourite minor loop i bVI bIII bVII, in A minor.
    const PROG = [[57, "m"], [53, "M"], [60, "M"], [55, "M"]];
    const VOICE = { bass: (r) => r - 12, root: (r) => r, third: (r, q) => r + (q === "m" ? 3 : 4), fifth: (r) => r + 7, oct: (r) => r + 12, hi: (r, q) => r + 12 + (q === "m" ? 3 : 4), top: (r) => r + 19 };
    const ORDER = ["hi", "top", "oct", "fifth", "third", "root", "bass"];
    const FEEL = { staccato: 0.45, short: 0.85, medium: 1.9, held: 4 };
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let playing = null;
    function note(ac, out, midi, t, dur, vel, isBass) {
      const g = ac.createGain(); g.gain.value = 0;
      const f = ac.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.7;
      const cut = isBass ? 900 : 2400 * vel + 600;
      f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(300, cut * 0.35), t + Math.min(0.6, dur));
      const oscs = [];
      for (const [type, det] of isBass ? [["triangle", 0], ["sawtooth", 0]] : [["sawtooth", -6], ["sawtooth", 6]]) {
        const o = ac.createOscillator(); o.type = type; o.frequency.value = hz(midi); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.25); oscs.push(o);
      }
      if (isBass) { const s = ac.createOscillator(); s.type = "sine"; s.frequency.value = hz(midi - 12); const sg = ac.createGain(); sg.gain.value = 0.7; s.connect(sg).connect(g); s.start(t); s.stop(t + dur + 0.25); }
      f.connect(g); g.connect(out);
      const a = isBass ? 0.004 : 0.012, peak = (isBass ? 0.22 : 0.11) * vel;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(peak * 0.75, t + a, 0.25);
      g.gain.setValueAtTime(peak * 0.75, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.08);
    }
    function play(f, bpm, card) {
      stop(); if (!api.bus) api.stopDrums();
      const COUT = api.bus ? api.bus(stop) : null; // 9 Nov: own bus (one sound at a time across the tabs)
      const ac = api.audio(), G = f.grid, per = G === 12 && f.bpm[1] <= 90 ? 2 : G === 12 && f.id === "waltz" ? 4 : G / 4, bars = f.bars || 1, L = G * bars;
      // per = steps per beat: 16-grid 4; 3/4 waltz 4 (3 beats); 6/8 and triplet feels 3 steps per beat (12/8: 4 beats)
      const stepsPerBeat = G === 12 ? (f.id === "waltz" ? 4 : 3) : 4;
      const stepDur = 60 / bpm / stepsPerBeat, sw = f.swing && G === 16 ? (2 * f.swing - 1) * stepDur : 0;
      const loops = bars === 2 ? 2 : 4, total = L * loops, t0 = ac.currentTime + 0.08;
      const master = ac.createGain(); master.gain.value = 1; const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp).connect(COUT || ac.destination);
      const fl = FEEL[f.feel] || 1;
      for (let loop = 0; loop < loops; loop++) {
        for (let bar = 0; bar < bars; bar++) {
          const [root, q] = PROG[(loop * bars + bar) % PROG.length];
          for (const [voice, str] of f.rows) {
            const row = str.slice(bar * G, bar * G + G);
            for (let s = 0; s < G; s++) {
              const ch = row[s]; if (ch !== "X" && ch !== "x" && ch !== "b") continue;
              let hold = 0; while (s + 1 + hold < G && row[s + 1 + hold] === "-") hold++;
              let next = G - s; for (let k = s + 1; k < G; k++) if ("Xxb".includes(row[k])) { next = k - s; break; }
              const durSteps = hold ? hold + 1 : Math.min(next, voice === "bass" ? Math.max(fl, 1) : fl);
              const i = (loop * bars + bar) * G + s, t = t0 + i * stepDur + (s % 2 ? sw : 0);
              const midi = ch === "b" ? VOICE[voice](root, q) - 5 : VOICE[voice](root, q);
              note(ac, master, midi, t, durSteps * stepDur, ch === "x" ? 0.55 : 1, voice === "bass");
            }
          }
          if (f.duck) for (let b = 0; b < G / stepsPerBeat; b++) { const t = t0 + ((loop * bars + bar) * G + b * stepsPerBeat) * stepDur; master.gain.setValueAtTime(0.12, t); master.gain.linearRampToValueAtTime(1, t + stepDur * stepsPerBeat * 0.7); }
          if (f.swell) { const t = t0 + (loop * bars + bar) * G * stepDur; master.gain.setValueAtTime(0.03, t); master.gain.linearRampToValueAtTime(1, t + G * stepDur * 0.9); master.gain.linearRampToValueAtTime(0.03, t + G * stepDur); }
        }
      }
      const cells = [...card.querySelectorAll(".lane")].map((l) => [...l.querySelectorAll("u")]);
      let raf = 0, last = -1;
      const tick = () => {
        const i = Math.floor((ac.currentTime - t0) / stepDur);
        if (i >= total) { stop(); return; }
        const st = ((i % L) + L) % L;
        if (i >= 0 && st !== last) { cells.forEach((c) => { if (c[last]) c[last].classList.remove("now"); if (c[st]) c[st].classList.add("now"); }); last = st; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      card.classList.add("on");
      playing = { card, raf, master, cells, ac, out: COUT };
    }
    function stop() {
      if (!playing) return;
      cancelAnimationFrame(playing.raf); playing.card.classList.remove("on"); playing.cells.flat().forEach((u) => u.classList.remove("now"));
      if (playing.out) { const o = playing.out; playing = null; api.release(o); return; }
      const { master, ac } = playing; try { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0, ac.currentTime, 0.03); setTimeout(() => { try { master.disconnect(); } catch (e) { /* gone */ } }, 300); } catch (e) { /* context closed */ }
      playing = null;
    }
    document.querySelectorAll(".bd-tab").forEach((b) => b.addEventListener("click", stop));

    // ------------------------------------------------------------ the drawing: one row per voice
    const LABEL = { hi: "HIGH", top: "TOP", oct: "OCT", fifth: "5TH", third: "3RD", root: "ROOT", bass: "BASS" };
    function rowsHtml(f) {
      const G = f.grid, L = G * (f.bars || 1), perBeat = G === 12 ? (f.id === "waltz" ? 4 : 3) : 4;
      const rs = ORDER.filter((v) => f.rows.some((r) => r[0] === v)).map((v) => [v, f.rows.find((r) => r[0] === v)[1]]);
      const chordAt = []; for (let i = 0; i < L; i++) chordAt.push(rs.filter(([v, s]) => v !== "bass" && (s[i] === "X" || s[i] === "x")).length >= 2);
      return `<div class="steps cs-steps">${rs.map(([v, s]) => `<div class="lane"><i>${LABEL[v]}</i><div class="cells" style="grid-template-columns:repeat(${L},1fr)">${[...s].map((ch, i) =>
        `<u class="${v === "bass" ? "bass" : "v"}${ch === "X" ? " X" : ch === "x" || ch === "b" ? " x" : ch === "-" ? " h" : ""}${chordAt[i] && v !== "bass" ? " c" : ""}${i % perBeat === 0 ? " beat" : ""}"></u>`).join("")}</div></div>`).join("")}</div>`;
    }
    const meterOf = (f) => f.grid === 12 ? (f.id === "waltz" ? "3/4" : f.id === "triplets" ? "triplet feel" : "6/8") : (f.bars === 2 ? "2 bars" : "1 bar");
    const mid = (f) => Math.round((f.bpm[0] + f.bpm[1]) / 2);

    // ------------------------------------------------------------ boot: fetch the data then build
    const build = (C) => {
      const F = C.families, GR = C.groups, learnedN = F.filter((f) => f.learned && f.learned.bars > 0).length;
      let s = slide("s-lilac", "Backend data", "Chord science");
      s.append(title("h1", `${F.length} ways to play a chord.`, "Press one to hear it."));
      s.append(h("p", "lede", "Not which chords: how they are played. Held, pumped, stabbed, broken or strummed, and where in the bar the hits land. Each pattern is drawn as a mini piano roll (one row per voice of the chord), plays on the dice's favourite loop (i bVI bIII bVII), and says where its name comes from."));
      s.append(h("div", "spacer"));
      s.append(rows([
        ["Playing patterns", String(F.length), GR.map((g) => g.name).join(" \u00b7 ")],
        ["Pop piano songs measured", n0(C.songs), "POP909, the piano part of each"],
        ["Bars measured", n0(C.bars), `${learnedN} of the ${F.length} patterns seen in the data`],
        ["Different exact bars found", n0(C.coverage.distinct), `${n0(C.coverage.marks["0.5"])} of them make half of all music`],
      ]));
      s.append(h("div", "foot", "<span>KILLTOY.studio</span><span>scroll</span>"));
      pane.append(s);

      // the five groups
      s = slide("s-hero", "The five groups", "What the rhythm is made of"); s.style.minHeight = "0";
      s.append(title("h2", "Every chord pattern does one of five things.", "Hold it, repeat it, stab it, break it, or strum it."));
      const gg = h("div", "cs-groups");
      for (const g of GR) { const list = F.filter((f) => f.group === g.id); const bars = list.reduce((a, f) => a + (f.learned ? f.learned.bars : 0), 0); gg.append(h("div", "cs-g", `<div><i>${esc(g.name)}</i><b class="n">${list.length}</b></div><p>${esc(g.about)}</p><p><i>${bars ? pc(bars / C.bars, 0) + " of pop piano bars" : "not in the piano data"}</i></p>`)); }
      s.append(gg);
      pane.append(s);

      // the names
      s = slide("s-mist", "How the names were picked", ""); s.style.minHeight = "0";
      s.append(title("h2", "Names musicians already use.", "Not invented by us."));
      s.append(h("p", "lede", "Each pattern carries the name pianists, guitarists and producers already call it, so you can search it anywhere: Alberti, Charleston, skank, montuno, Travis, boom-chick. Where a name comes from one person or one record (Freddie Green, Johnny Cash, Robin S, Lil Uzi Vert) the card says so. The note values (quarter, eighth, sixteenth) name the pulses. The counts come from 880 pop piano arrangements, so piano patterns are measured and the guitar, reggae, metal and club ones are hand-written, same as the KILLDRUM underground scenes."));
      pane.append(s);

      // the cards
      s = slide("s-sky", `The ${F.length}`, "Click a card to play, click again to stop"); s.style.minHeight = "0";
      s.append(title("h2", "The patterns.", "Purple = the chord hits. Dark = bass. Light = held."));
      let grp = "all", auto = true, bpm = 110;
      const tools = h("div", "d-tools");
      const gc = chips([["all", "ALL"]].concat(GR.map((g) => [g.id, g.name])), "all", (v) => { grp = v; draw(); }); gc.style.margin = "0";
      const q = h("input", "art-q"); q.placeholder = "Search: reggae, Adele, house, waltz..."; q.setAttribute("aria-label", "search chord patterns");
      const bc = h("label", "bpm-ctl", `TEMPO <input type="range" min="50" max="220" step="1" value="110"><b>OWN</b>`);
      const rng = bc.querySelector("input"), bl = bc.querySelector("b");
      rng.oninput = () => { auto = false; bpm = +rng.value; bl.textContent = bpm + " BPM"; };
      bl.style.cursor = "pointer"; bl.title = "Click for each pattern's own tempo"; bl.onclick = (e) => { e.preventDefault(); auto = true; bl.textContent = "OWN"; };
      tools.append(gc, q, bc);
      const grid = h("div", "dgrid");
      s.append(tools, grid);
      function draw() {
        stop();
        const qq = q.value.trim().toLowerCase();
        grid.replaceChildren();
        for (const g of GR) {
          if (grp !== "all" && grp !== g.id) continue;
          const list = F.filter((f) => f.group === g.id && (!qq || [f.name, f.about, f.origin, ...(f.genres || []), ...(f.moods || []), ...(f.famous || [])].join(" ").toLowerCase().includes(qq)));
          if (!list.length) continue;
          grid.append(h("div", "groups-h", `${esc(g.name)} \u00b7 ${list.length}`));
          for (const f of list) {
            const card = h("button", "dcard"); card.type = "button";
            const L = f.learned, ex = (C.songExamples || {})[f.id];
            card.innerHTML = `<div class="dh"><div><b>${esc(f.name)}</b></div><span class="play"><svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg></span></div>
              ${rowsHtml(f)}
              <div class="meta"><span>${f.bpm[0]}\u2013${f.bpm[1]} BPM</span><span>${meterOf(f)}</span>${f.swing ? `<span>swing ${Math.round(f.swing * 100)}%</span>` : ""}${f.duck ? "<span>ducked</span>" : ""}${f.swell ? "<span>swells</span>" : ""}${L ? `<span>${pc(L.share, L.share < 0.01 ? 1 : 0)} of bars \u00b7 ${n0(L.songs)} songs</span>` : "<span>hand-written</span>"}</div>
              <p class="about">${esc(f.about)}</p>
              <p class="origin"><em>THE NAME</em>${esc(f.origin)}</p>
              <div class="meta"><span>${esc((f.famous || []).slice(0, 4).join(" \u00b7 "))}</span></div>
              ${ex && ex.length ? `<p class="cs-ex">IN THE DATA \u00b7 ${ex.slice(0, 2).map((e) => `<b>${esc(e[0])}</b> ${esc(e[1])} ${e[2]} BPM`).join(" \u00b7 ")}</p>` : ""}`;
            card.onclick = () => { if (playing && playing.card === card) { stop(); return; } play(f, auto ? (L && L.bpm ? L.bpm[1] : mid(f)) : bpm, card); };
            grid.append(card);
          }
        }
        if (!grid.children.length) grid.append(h("div", "art-empty", "No pattern matches that."));
      }
      q.oninput = draw; draw();
      pane.append(s);

      // how many exist: coverage curve
      s = slide("s-ink", "How many exist", "Exact bars vs families");
      const M = C.coverage.marks;
      s.append(title("h2", `${n0(C.coverage.distinct)} different bars. ${n0(M["0.5"])} make half the music.`, `And ${F.length} families explain ${pc(1 - C.unmapped, 0)} of it.`));
      s.append(h("p", "lede", "Count every bar by its exact hit pattern and the long tail is huge: thousands of one-offs. Sort them by how often they come up and the curve shoots up fast and then crawls. The families on this page are the names for the fat part of that curve."));
      s.append(chartBox((c, W) => {
        const left = 50, top = 16, H = 260, bottom = 36, right = 16, g = svg(W, H); c.append(g);
        const pts = C.coverage.curve, maxX = Math.log10(C.coverage.distinct);
        const x = (n) => left + (W - left - right) * Math.log10(Math.max(1, n)) / maxX, y = (v) => top + (H - top - bottom) * (1 - v);
        for (const v of [0.25, 0.5, 0.75, 1]) { add(g, "line", { x1: left, x2: W - right, y1: y(v), y2: y(v), style: "stroke:var(--rule)" }); add(g, "text", { x: left - 8, y: y(v) + 4, "text-anchor": "end" }, pc(v)); }
        for (const n of [1, 10, 100, 1000, 10000]) { if (n > C.coverage.distinct) continue; add(g, "line", { x1: x(n), x2: x(n), y1: top, y2: H - bottom, style: "stroke:var(--rule)" }); add(g, "text", { x: x(n), y: H - 14, "text-anchor": "middle" }, n0(n) + (n === 1 ? " bar" : "")); }
        add(g, "path", { d: pts.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1)).join(" "), style: "fill:none;stroke:var(--acc);stroke-width:2.5;stroke-linejoin:round" });
        for (const th of ["0.25", "0.5", "0.75", "0.9"]) { const n = M[th]; add(g, "circle", { cx: x(n), cy: y(+th), r: 5, style: "fill:var(--acc);stroke:var(--bg, #fff);stroke-width:2" }); add(g, "text", { x: x(n) + 9, y: y(+th) - 8, style: "fill:var(--ink);font-size:12px" }, `${pc(+th)} = ${n0(n)} patterns`); }
        const hit = add(g, "rect", { x: left, y: top, width: W - left - right, height: H - top - bottom, style: "fill:transparent" });
        hover(hit, () => `<b>Coverage</b>x = how many exact patterns (log scale)<br>y = share of all ${n0(C.bars)} bars they cover`);
      }));
      pane.append(s);

      // textures + density
      s = slide("s-sage", "What pop piano does", "Texture of a bar");
      s.append(title("h2", "Pianists break the chord.", "Only one bar in ten is a plain block chord."));
      const tx = C.textures, tmax = Math.max(...tx.map((t) => t[1]));
      s.append(rank(tx.map(([lab, v], i) => ({ label: lab, v, text: pc(v / C.bars, 0), hi: i === 0, tip: () => `<b>${esc(lab)}</b>${n0(v)} bars` })), { max: tmax }));
      const two = h("div", "cs-two");
      const d1 = h("div"); d1.append(h("h4", "", "Hits per bar (any note)"));
      const ob = C.onsetsPerBar.filter((o) => o[0] >= 1 && o[0] <= 16).sort((a, b) => a[0] - b[0]);
      d1.append(rank(ob.map(([k, v]) => ({ label: String(k), v, text: pc(v / C.bars, 0), hi: k === 8, tip: () => `<b>${k} hits in the bar</b>${n0(v)} bars` }))));
      const d2 = h("div"); d2.append(h("h4", "", "Chord hits per bar (two or more notes at once)"));
      const bb = C.blockOnsetsPerBar.filter((o) => o[0] <= 8).sort((a, b) => a[0] - b[0]);
      d2.append(rank(bb.map(([k, v]) => ({ label: String(k), v, text: pc(v / C.bars, 0), hi: k === 4, tip: () => `<b>${k} chord hits</b>${n0(v)} bars` }))));
      two.append(d1, d2); s.append(two);
      s.append(h("p", "lede", "Eight hits a bar is the mode: pop piano thinks in eighth notes. Four full chord hits a bar (one per beat) is the most common chord count, which is why Chord bounce tops the family list."));
      pane.append(s);

      // harmonic rhythm
      s = slide("s-peach", "Harmonic rhythm", "How often the chord changes");
      s.append(title("h2", "Two beats per chord.", "Half of all chords last exactly half a bar."));
      const cl = C.chordLenBeats.slice(0, 5), clT = C.chordLenBeats.reduce((a, c) => a + c[1], 0);
      const beatName = (b) => ({ "1.0": "1 beat", "2.0": "2 beats (half a bar)", "3.0": "3 beats", "4.0": "4 beats (a whole bar)", "6.0": "6 beats", "8.0": "8 beats (two bars)" }[b] || b + " beats");
      s.append(rank(cl.map(([k, v], i) => ({ label: beatName(k), v, text: pc(v / clT, 0), hi: i === 0, tip: () => `<b>${beatName(k)}</b>${n0(v)} chords` }))));
      const cpb = C.chordsPerBar.slice().sort((a, b) => a[0] - b[0]), cpT = cpb.reduce((a, c) => a + c[1], 0);
      const sc = C.sectionChange, scT = sc.reduce((a, c) => a + c[1], 0);
      const two2 = h("div", "cs-two");
      const e1 = h("div"); e1.append(h("h4", "", "Chords per bar"));
      e1.append(rank(cpb.map(([k, v]) => ({ label: k === 0 ? "none (rest)" : k >= 5 ? "5 or more" : String(k), v, text: pc(v / cpT, 0), hi: k === 2, tip: () => `<b>${k} chords in the bar</b>${n0(v)} bars` }))));
      const e2 = h("div"); e2.append(h("h4", "", "Where the chord changes"));
      e2.append(rank(sc.map(([k, v]) => ({ label: k === "downbeat" ? "On beat 1" : "Inside the bar (beat 3, mostly)", v, text: pc(v / scT, 0), hi: k === "downbeat", tip: () => `<b>${k}</b>${n0(v)} chord changes` }))));
      two2.append(e1, e2); s.append(two2);
      s.append(h("p", "lede", "The dice already picks the chords from 736,005 songs. This is the other half: how long each one stays. One chord a bar and two chords a bar are a coin flip; three or more is rare in pop."));
      pane.append(s);

      // voicing science
      s = slide("s-night", "Voicing science", "What is inside one chord hit");
      s.append(title("h2", "Three notes, close together, around middle C.", "And the root is almost always at the bottom."));
      const V = h("div", "cs-two");
      const hs = C.hitSize.slice().sort((a, b) => a[0] - b[0]), hsT = hs.reduce((a, c) => a + c[1], 0);
      const v1 = h("div"); v1.append(h("h4", "", "Notes in one hit")); v1.append(rank(hs.map(([k, v]) => ({ label: k >= 7 ? "7 or more" : String(k), v, text: pc(v / hsT, 0), hi: k === 3, tip: () => `<b>${k} notes at once</b>${n0(v)} chord hits` }))));
      const sp = C.spread.slice().sort((a, b) => a[0] - b[0]).filter((x) => x[0] <= 28), spT = C.spread.reduce((a, c) => a + c[1], 0);
      const v2 = h("div"); v2.append(h("h4", "", "Spread, bottom note to top (semitones)")); v2.append(rank(sp.map(([k, v]) => ({ label: k === 0 ? "0\u20133 (a cluster)" : k === 12 ? "12\u201315 (an octave)" : k === 24 ? "24\u201327 (two octaves)" : `${k}\u2013${k + 3}`, v, text: pc(v / spT, 0), hi: k === 4, tip: () => `<b>${k}\u2013${k + 3} semitones</b>${n0(v)} chord hits` }))));
      const NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"], nm = (m) => NOTE[m % 12] + (Math.floor(m / 12) - 1);
      const rg = C.register.slice().sort((a, b) => a[0] - b[0]).filter((x) => x[0] >= 36 && x[0] <= 78), rgT = C.register.reduce((a, c) => a + c[1], 0);
      const v3 = h("div"); v3.append(h("h4", "", "Register (middle of the hit)")); v3.append(rank(rg.map(([k, v]) => ({ label: `${nm(k)} \u2013 ${nm(k + 5)}`, v, text: pc(v / rgT, 0), hi: k === 54 || k === 60, tip: () => `<b>${nm(k)} to ${nm(k + 5)}</b>${n0(v)} chord hits` }))));
      const iv = C.inversion, ivT = iv.reduce((a, c) => a + c[1], 0), ivName = { root: "Root at the bottom", third: "Third at the bottom (1st inversion)", fifth: "Fifth at the bottom (2nd inversion)", other: "Something else (slash chord)" };
      const v4 = h("div"); v4.append(h("h4", "", "What is the lowest note")); v4.append(rank(iv.map(([k, v]) => ({ label: ivName[k], v, text: pc(v / ivT, 0), hi: k === "root", tip: () => `<b>${ivName[k]}</b>${n0(v)} chord starts` }))));
      const su = C.sustain, suT = su.reduce((a, c) => a + c[1], 0), suName = { staccato: "Staccato (under a 16th)", short: "Short (a 16th to an 8th)", medium: "Medium (up to a beat and a half)", long: "Long (held)" }, suOrder = ["staccato", "short", "medium", "long"];
      const v5 = h("div"); v5.append(h("h4", "", "How long a chord hit rings")); v5.append(rank(suOrder.map((k) => { const v = (su.find((x) => x[0] === k) || [k, 0])[1]; return { label: suName[k], v, text: pc(v / suT, 0), hi: k === "short", tip: () => `<b>${suName[k]}</b>${n0(v)} chord hits` }; })));
      const ad = C.arpDirection, adT = ad.reduce((a, c) => a + c[1], 0), adName = { wave: "Up and down, loose (wave)", pendulum: "Strict up-down (pendulum)", up: "Only up (rolling)", down: "Only down" };
      const v6 = h("div"); v6.append(h("h4", "", "Which way broken chords go")); v6.append(rank(ad.map(([k, v]) => ({ label: adName[k] || k, v, text: pc(v / adT, 0), hi: k === "wave", tip: () => `<b>${adName[k]}</b>${n0(v)} broken bars` }))));
      V.append(v1, v2, v3, v4, v5, v6); s.append(V);
      pane.append(s);

      // what follows what
      s = slide("s-lilac", "What follows what", "Pattern changes inside a song"); s.style.minHeight = "0";
      s.append(title("h2", "Songs switch between two or three patterns.", "A hit-then-roll verse, a bounce chorus."));
      const byId = Object.fromEntries(F.map((f) => [f.id, f])), fp = C.familyPairs.slice(0, 8), fpMax = fp[0][1];
      s.append(rank(fp.map(([[a, b], v], i) => ({ label: `${byId[a] ? byId[a].name : a} \u2192 ${byId[b] ? byId[b].name : b}`, v, text: n0(v), hi: i === 0, tip: () => `<b>${esc(byId[a].name)} then ${esc(byId[b].name)}</b>${n0(v)} times a bar in one pattern was followed by a bar in the other` })), { max: fpMax }));
      pane.append(s);

      // tempo map
      s = slide("s-sky", "Tempo map", "Where each pattern lives");
      s.append(title("h2", "Slow to fast.", "Each bar = the tempo range the pattern lives in. Purple = measured in the piano data."));
      const sorted = F.slice().sort((a, b) => mid(a) - mid(b));
      s.append(chartBox((c, W) => {
        const L = Math.min(190, W * 0.38), rowH = 18, T = 24, H = T + sorted.length * rowH + 6, lo = 40, hi = 250;
        const x = (v) => L + (W - L - 10) * (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo);
        const g = svg(W, H); c.append(g);
        for (const v of [60, 90, 120, 150, 180, 210, 240]) { add(g, "line", { x1: x(v), x2: x(v), y1: T - 6, y2: H, style: "stroke:var(--rule)" }); add(g, "text", { x: x(v), y: 12, "text-anchor": "middle" }, v); }
        sorted.forEach((f, i) => {
          const y = T + rowH * i + rowH / 2, Lr = f.learned && f.learned.bpm;
          add(g, "text", { x: L - 10, y: y + 4, "text-anchor": "end", style: "font-size:11px;fill:var(--ink);letter-spacing:0;font-family:var(--sans)" }, f.name);
          add(g, "rect", { x: x(f.bpm[0]), y: y - 4, width: Math.max(4, x(f.bpm[1]) - x(f.bpm[0])), height: 8, rx: 4, style: `fill:${Lr ? "var(--acc)" : "var(--ink)"}` });
          if (Lr) add(g, "rect", { x: x(Lr[0]), y: y - 2, width: Math.max(3, x(Lr[2]) - x(Lr[0])), height: 4, rx: 2, style: "fill:var(--ink3)" });
          const hit = add(g, "rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, style: "fill:transparent" });
          hover(hit, () => `<b>${esc(f.name)}</b>${f.bpm[0]}\u2013${f.bpm[1]} BPM${Lr ? `<br>in the piano data: ${Lr[0]}\u2013${Lr[2]} BPM, typically ${Lr[1]}` : ""}<br>${esc((f.genres || []).slice(0, 4).join(", "))}`);
        });
      }));
      s.append(h("div", "legend", `<span><i style="background:var(--acc);height:8px"></i>Measured in the piano data</span><span><i style="height:8px"></i>Hand-written range</span><span><i style="background:var(--ink3);height:4px"></i>Where the data actually puts it (10th to 90th percentile)</span>`));
      pane.append(s);

      // method
      s = slide("s-mist", "Method", "Where the numbers come from"); s.style.minHeight = "0";
      s.append(title("h2", "How it was measured.", "So you can argue with it."));
      s.append(h("p", "lede", `POP909 (Wang et al., ISMIR 2020) is 909 pop songs arranged for piano by professionals, with the accompaniment on its own track and every beat and chord labelled. For each of the ${n0(C.songs)} usable songs every 4-beat bar of the piano part was put on a 16-step grid: a step with two or more notes is a chord hit, a lone low note is a bass note, a lone note above it is a broken-chord note. A bar is then one of the ${F.length} families by its texture and where the hits land. ${pc(C.unmapped, 0)} of bars are rests or too sparse to call. The chord lengths come from the chord labels, the voicing numbers from every chord hit (${n0(C.hitSize.reduce((a, c) => a + c[1], 0))} of them). Guitar, reggae, metal and club patterns are not piano patterns, so those cards are hand-written from the standard names and records; the KILLDRUM data (rhythm-brain-data.json) covers their drums. The name origins were checked against Wikipedia, the Ableton sidechain history, freddiegreen.org, Guitar World and the jazz method books.`));
      pane.append(s);
    };
    (window.CHORDS_SCIENCE_DATA ? Promise.resolve(window.CHORDS_SCIENCE_DATA) : (window.ktData ? window.ktData("chords") : fetch("science/chords-data.json")).then((r) => r.json()))
      .then(build)
      .catch((e) => { console.error("CHORD SCIENCE", e); pane.append(h("section", "slide s-mist", "<h2>Could not load the data.<span>science/chords-data.json is missing next to this page.</span></h2>")); });
  }
});
