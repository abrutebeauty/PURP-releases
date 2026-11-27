/* VOCAL SCIENCE (Eman, 9 Nov 2026): a BACKEND DATA tab. How vocals build a song, measured from vocal stems:
   song maps (intro / verse / pre / hook / post / bridge / ad-libs per song, in bars), what each part does,
   the vocal "flows" (syllable rhythms on a 16-step grid, press to hear), delivery, structure, range, phrasing.
   Data: science/vocals-data.json, built by scripts/science/vocals/build_vocals_data.py from analyse_vocals.py.
   Flag KT2_VOCAL_SCIENCE_OFF hides the tab.
   12 Nov 2026 (Eman: "analyse the vocal melody as well"): further song sets (data.more, one chip each: the favorites
   clips) and THE SUNG MELODY slide (data.melody: the notes read from each vocal stem; press a card to hear the line).
   KT2_VOCAL_SETS_OLD = only the first two sets, KT2_VOCAL_MELODY_OFF = no melody slide. */
(function () {
  "use strict";
  try { if (window.KT2_VOCAL_SCIENCE_OFF || localStorage.getItem("KT2_VOCAL_SCIENCE_OFF") === "1") return; } catch (e) { /* storage blocked */ }

  const CSS = `
  .vs-legend{display:flex;flex-wrap:wrap;gap:14px 22px;margin:18px 0 10px;font:400 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink2)}
  .vs-legend i{display:inline-block;width:18px;height:10px;vertical-align:-1px;margin-right:8px}
  .vs-hook{background:var(--acc)} .vs-pre{background:color-mix(in srgb,var(--acc) 55%,transparent)} .vs-post{background:color-mix(in srgb,var(--acc) 32%,transparent)}
  .vs-verse{background:color-mix(in srgb,var(--ink) 52%,transparent)}
  .vs-bridge{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--ink) 55%,transparent) 0 3px,transparent 3px 6px)}
  .vs-adlibs{background:radial-gradient(circle,color-mix(in srgb,var(--ink) 70%,transparent) 1.2px,transparent 1.4px) 0 0/6px 6px}
  .vs-intro,.vs-outro,.vs-inst{background:var(--tile)}
  .vs-tools{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin:14px 0 8px}
  .vs-tools .chips{margin:0}
  .vs-count{font:400 11px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--ink2);margin:8px 0 14px}
  .vs-maps{border-top:1px solid var(--rule)}
  .vs-song{display:grid;grid-template-columns:minmax(150px,230px) 1fr 92px;gap:0 18px;align-items:center;padding:10px 0;border-bottom:1px solid var(--rule);cursor:pointer}
  .vs-song:hover{background:var(--tile)}
  .vs-song.open{background:var(--tile2)}
  .vs-song .nm{font-size:14px;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .vs-song .nm small{display:block;font:400 10px/1.5 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .vs-song .n{font:400 11px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);text-align:right;font-variant-numeric:tabular-nums}
  .vs-strip{display:flex;height:22px;gap:2px}
  .vs-strip i{display:block;height:100%;position:relative;min-width:2px;overflow:hidden}
  .vs-strip i b{position:absolute;left:5px;top:5px;font:500 9px/1 var(--mono);letter-spacing:.14em;color:var(--ink);opacity:.85;pointer-events:none}
  .vs-strip i.vs-hook b{color:#fff}
  .vs-detail{grid-column:1/-1;padding:12px 0 18px;cursor:default}
  .vs-detail .rows .row{padding:12px 0 10px}
  .vs-detail .rows .row b{font-size:26px}
  .vs-detail svg text{font:400 10px var(--mono);fill:var(--ink3);letter-spacing:.08em}
  .vs-secs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:14px}
  .vs-sec{padding:10px 12px;background:var(--tile);border-top:3px solid transparent}
  .vs-sec small{display:block;font:400 10px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ink2);margin-bottom:6px}
  .vs-sec b{font-weight:500;font-size:15px;letter-spacing:-.02em}
  .vs-sec p{margin:4px 0 0;font-size:12px;color:var(--ink2);line-height:1.5}
  .vs-parts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:26px}
  .vs-part{background:var(--tile);padding:18px 18px 14px;border-top:4px solid var(--ink)}
  .vs-part h3{margin:0 0 2px;font:500 22px/1 var(--sans);letter-spacing:-.03em}
  .vs-part .sub{font:400 10px/1.5 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin-bottom:14px}
  .vs-part .m{display:grid;grid-template-columns:1fr auto;gap:6px 10px;font-size:12px;color:var(--ink2);align-items:center}
  .vs-part .m b{font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums;text-align:right}
  .vs-part .bar{grid-column:1/-1;height:4px;background:var(--rule);margin:-2px 0 6px}
  .vs-part .bar i{display:block;height:100%;background:var(--acc)}
  .vs-fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-top:22px}
  .vs-flow{text-align:left;background:var(--tile);border:0;padding:16px 16px 14px;cursor:pointer;border-top:4px solid var(--ink3);transition:background .15s}
  .vs-flow:hover{background:var(--tile2)} .vs-flow.on{border-top-color:var(--acc)}
  .vs-flow .fh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px}
  .vs-flow .fh b{font-weight:500;font-size:17px;letter-spacing:-.02em}
  .vs-flow .fh span{font:400 10px/1 var(--mono);letter-spacing:.14em;color:var(--ink3);white-space:nowrap}
  .vs-mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-top:22px}
  .vs-mel{text-align:left;background:var(--tile);border:0;padding:14px 16px 12px;cursor:pointer;border-top:4px solid var(--ink3);transition:background .15s}
  .vs-mel:hover{background:var(--tile2)} .vs-mel.on{border-top-color:var(--acc)}
  .vs-mel b{display:block;font-weight:500;font-size:15px;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .vs-mel small{display:block;font:400 10px/1.6 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:8px}
  .vs-mel svg{display:block;width:100%;height:64px;background:var(--bg,transparent)}
  .vs-mel svg rect{fill:var(--ink)} .vs-mel.on svg rect{fill:var(--acc)} .vs-mel svg line{stroke:var(--rule);stroke-width:.4}
  .vs-cells{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .vs-cells span{background:var(--tile);padding:8px 10px;font:400 11px/1 var(--mono);letter-spacing:.08em;color:var(--ink)}
  .vs-cells span i{font-style:normal;color:var(--ink3);margin-left:8px}
  .vs-steps{display:grid;grid-template-columns:repeat(16,1fr);gap:2px;height:34px;align-items:end}
  .vs-steps u{display:block;background:var(--rule);height:3px;position:relative}
  .vs-steps u.beat::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--ink3)}
  .vs-steps u.on{background:var(--ink)} .vs-steps u.now{background:var(--acc)}
  .vs-flow .about{margin:12px 0 0;font-size:12.5px;color:var(--ink2);line-height:1.5}
  .vs-flow .meta{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:10px;font:400 10px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
  .vs-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:40px;margin-top:20px}
  .vs-two h4{margin:0 0 10px;font:400 11px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--ink2)}
  .vs-hist svg text{font:400 10px var(--mono);fill:var(--ink3);letter-spacing:.08em}
  .vs-note{max-width:720px;color:var(--ink2);font-size:13px;line-height:1.55;margin:26px 0 0}
  @media (max-width:720px){.vs-song{grid-template-columns:1fr 60px}.vs-song .vs-strip{grid-column:1/-1;order:3}.vs-strip i b{display:none}}
  `;
  const SEC = { intro: "Intro", verse: "Verse", pre: "Pre-hook", hook: "Hook", post: "Post-hook", bridge: "Bridge", adlibs: "Ad-libs / chops", inst: "No vocal", outro: "Outro" };
  const CODE = { I: "intro", V: "verse", P: "pre", H: "hook", T: "post", B: "bridge", A: "adlibs", O: "outro", "-": "inst" };
  const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const clean = (name) => String(name || "").replace(/\s*\[[^\]]*\]\s*$/, "").replace(/^\d+_/, "");
  const nn = (m) => m == null ? "\u2013" : NOTE[Math.round(m) % 12] + (Math.floor(Math.round(m) / 12) - 1);

  // ---------------------------------------------------------------- flow playback: a soft "da" per step
  let playing = null;
  function voiceBlip(ac, t, vel, pitchHz) {
    const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(pitchHz, t); o.frequency.linearRampToValueAtTime(pitchHz * 0.985, t + 0.12);
    const f1 = ac.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 720; f1.Q.value = 5;
    const f2 = ac.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1180; f2.Q.value = 7;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * vel, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16 + 0.1 * vel);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(VOUT || ac.destination); o.start(t); o.stop(t + 0.3);
  }
  function click(ac, noise, t, v) {
    const n = noise(ac), f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6000;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(f); f.connect(g); g.connect(VOUT || ac.destination); n.start(t); n.stop(t + 0.05);
  }
  let VOUT = null; // 9 Nov: the flow plays through api.bus(), so a second click (or another tab) really stops the first one
  function playFlow(api, flow, card, bpm) {
    stopFlow();
    VOUT = api.bus ? api.bus(stopFlow) : null;
    const ac = api.audio(), step = 60 / bpm / 4, loops = 4, t0 = ac.currentTime + 0.05;
    const scale = [0, 3, 5, 7, 10, 12]; let si = 0;   // minor pentatonic walk so it sings a little
    for (let i = 0; i < 16 * loops; i++) {
      const st = i % 16, t = t0 + i * step, v = flow.grid[st];
      if (st % 4 === 0) click(ac, api.noise, t, st === 0 ? 0.16 : 0.09);
      if (v >= 0.25) { si = (si + (v >= 0.75 ? 2 : 1)) % scale.length; voiceBlip(ac, t, Math.min(1, v + 0.1), 220 * Math.pow(2, scale[si] / 12)); }
    }
    const cells = [...card.querySelectorAll(".vs-steps u")];
    let raf = 0, last = -1;
    const tick = () => {
      const i = Math.floor((ac.currentTime - t0) / step);
      if (i >= 16 * loops) { stopFlow(); return; }
      const st = ((i % 16) + 16) % 16;
      if (i >= 0 && st !== last) { if (cells[last]) cells[last].classList.remove("now"); cells[st].classList.add("now"); last = st; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); card.classList.add("on");
    playing = { card, raf, cells, out: VOUT, api };
  }
  // a sung line from the data: its notes on a small voice, at the song's own tempo
  function playMel(api, song, card) {
    stopFlow();
    VOUT = api.bus ? api.bus(stopFlow) : null;
    const ac = api.audio(), beat = 60 / (song.bpm || 120), t0 = ac.currentTime + 0.05, roll = song.mel.roll;
    const end = roll.reduce((m, n) => Math.max(m, n[0] + n[2]), 0);
    for (let b = 0; b < end; b++) click(ac, api.noise, t0 + b * beat, b % 4 === 0 ? 0.12 : 0.05);
    for (const n of roll) voiceBlip(ac, t0 + n[0] * beat, 0.9, 440 * Math.pow(2, (n[1] - 69) / 12));
    let raf = 0;
    const tick = () => { if (ac.currentTime - t0 > end * beat + 0.3) { stopFlow(); return; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); card.classList.add("on");
    playing = { card, raf, cells: [], out: VOUT, api };
  }
  function rollSvg(roll) {
    const lo = Math.min.apply(null, roll.map((n) => n[1])) - 1, hi = Math.max.apply(null, roll.map((n) => n[1])) + 1, H = 64, rh = Math.max(2, Math.min(6, H / (hi - lo + 1)));
    const y = (p) => H - (p - lo + 0.5) * (H / (hi - lo + 1)) - rh / 2;
    let o = "";
    for (let b = 0; b <= 16; b += 4) o += `<line x1="${b * 10}" x2="${b * 10}" y1="0" y2="${H}"/>`;
    for (const n of roll) o += `<rect x="${(n[0] * 10).toFixed(1)}" y="${y(n[1]).toFixed(1)}" width="${Math.max(1.5, n[2] * 10 - 0.6).toFixed(1)}" height="${rh.toFixed(1)}"/>`;
    return `<svg viewBox="0 0 160 ${H}" preserveAspectRatio="none" aria-hidden="true">${o}</svg>`;
  }
  function stopFlow() { if (!playing) return; cancelAnimationFrame(playing.raf); playing.card.classList.remove("on"); playing.cells.forEach((u) => u.classList.remove("now")); const o = playing.out, a = playing.api; playing = null; if (o && a && a.release) { if (VOUT === o) VOUT = null; a.release(o); } }

  // ---------------------------------------------------------------- pieces
  function strip(api, song, withLabels) {
    const { h, esc } = api;
    const s = h("div", "vs-strip");
    const total = song.map.reduce((a, m) => a + m[1], 0) || 1;
    for (const [name, bars, cov, pitch, syl, width] of song.map) {
      const i = h("i", "vs-" + name); i.style.flex = `${bars} 0 0`;
      if (withLabels && bars >= 4 && name !== "inst") i.append(h("b", "", esc(({ intro: "IN", verse: "V", pre: "PRE", hook: "HOOK", post: "POST", bridge: "BR", adlibs: "AD", outro: "OUT" })[name] || "")));
      api.hover(i, () => `<b>${esc(SEC[name])}</b>${bars} bars (${Math.round(100 * bars / total)}% of the song)${cov != null && name !== "intro" && name !== "outro" && name !== "inst" ? `<br>voice in ${Math.round(100 * cov)}% of the bar \u00b7 ${syl} syllables a bar${pitch != null ? ` \u00b7 around ${nn(pitch)}` : ""}${width != null ? ` \u00b7 width ${width.toFixed(2)}` : ""}` : ""}`);
      s.append(i);
    }
    return s;
  }

  function songDetail(api, song) {
    const { h, esc, rows, chartBox, svg, add } = api;
    const box = h("div", "vs-detail");
    box.onclick = (e) => e.stopPropagation();
    box.append(rows([
      ["Delivery", song.delivery, song.tuning || ""],
      ["Structure", song.structure_type, song.structure.split(" ").map((c) => SEC[CODE[c]] || c).join(" \u00b7 ")],
      ["Range", song.range_st != null ? `${song.range_st} semitones` : "\u2013", song.lo != null ? `${song.lo_n} to ${song.hi_n}` : ""],
      ["Hook", song.hook_count ? `${song.hook_count}\u00d7 \u00b7 ${Math.round(100 * song.hook_share)}% of the bars` : "no repeated hook", song.first_hook_bar ? `first lands at bar ${song.first_hook_bar}` : ""],
      ["Phrases", song.phrase_beats != null ? `${song.phrase_beats} beats` : "\u2013", "typical phrase before a breath"],
      ["Hook vs verse", song.recipe.join(", "), ""],
    ]));
    // bar strip: voice coverage per bar as thin columns, pitch as a dotted line above
    if (song.strip && song.strip.length) {
      box.append(chartBox((c, W) => {
        const H = 92, pad = 4, n = song.strip.length, w = (W - 2 * pad) / n;
        const g = svg(W, H); c.append(g);
        const ps = song.strip.map((b) => b[1]).filter((p) => p != null);
        const lo = ps.length ? Math.min(...ps) - 1 : 50, hi = ps.length ? Math.max(...ps) + 1 : 80;
        const py = (p) => 8 + (1 - (p - lo) / (hi - lo || 1)) * 40;
        add(g, "line", { x1: pad, x2: W - pad, y1: H - 10, y2: H - 10, style: "stroke:var(--rule)" });
        song.strip.forEach((b, i) => {
          const hh = Math.max(0, b[0]) * 28;
          add(g, "rect", { x: pad + i * w + 0.5, y: H - 10 - hh, width: Math.max(0.8, w - 1), height: hh, style: "fill:var(--ink2)" });
          if (b[1] != null) add(g, "circle", { cx: pad + i * w + w / 2, cy: py(b[1]), r: 1.8, style: "fill:var(--acc)" });
        });
        add(g, "text", { x: pad, y: H - 0 }, "BAR 1");
        add(g, "text", { x: W - pad, y: H - 0, "text-anchor": "end" }, "BAR " + n);
        add(g, "text", { x: pad, y: 10 }, ps.length ? "PITCH " + nn(hi) : "");
        add(g, "text", { x: pad, y: 52 }, ps.length ? nn(lo) : "");
        const hit = add(g, "rect", { x: 0, y: 0, width: W, height: H, style: "fill:transparent" });
        api.hover(hit, () => "Columns = how much of each bar has voice. Purple dots = the sung pitch per bar.");
      }));
    }
    const secs = h("div", "vs-secs");
    let bar = 1;
    for (const [name, bars, cov, pitch, syl, width] of song.map) {
      const d = h("div", "vs-sec"); d.style.borderTopColor = name === "hook" ? "var(--acc)" : name === "verse" ? "var(--ink)" : "var(--rule)";
      d.innerHTML = `<small>${esc(SEC[name])} \u00b7 bar ${bar}</small><b>${bars} bars</b>${cov != null && !["intro", "outro", "inst"].includes(name) ? `<p>${Math.round(100 * cov)}% sung \u00b7 ${syl} syl/bar${pitch != null ? ` \u00b7 ${nn(pitch)}` : ""}</p>` : "<p>no lead vocal</p>"}`;
      secs.append(d); bar += bars;
    }
    box.append(secs);
    return box;
  }

  function hist(api, counts, labels, opts) {
    const { chartBox, svg, add, esc } = api;
    return chartBox((c, W) => {
      const H = 150, L = 6, B = 34, T = 14, n = counts.length, max = Math.max(1, ...counts), gap = 2, w = (W - 2 * L) / n;
      const g = svg(W, H); c.append(g);
      add(g, "line", { x1: L, x2: W - L, y1: H - B, y2: H - B, style: "stroke:var(--rule)" });
      counts.forEach((v, i) => {
        const hh = (H - B - T) * v / max, x = L + i * w + gap / 2;
        const r = add(g, "rect", { x, y: H - B - hh, width: w - gap, height: hh, rx: 3, style: `fill:${opts && opts.hi === i ? "var(--acc)" : "var(--ink)"}` });
        add(g, "text", { x: x + (w - gap) / 2, y: H - B + 14, "text-anchor": "middle" }, labels[i]);
        if (v === max || (opts && opts.hi === i)) add(g, "text", { x: x + (w - gap) / 2, y: H - B - hh - 4, "text-anchor": "middle", style: "fill:var(--ink)" }, v);
        api.hover(r, () => `<b>${esc(labels[i])}</b>${v} ${opts && opts.unit || ""}`);
      });
      if (opts && opts.xlab) add(g, "text", { x: W / 2, y: H - 2, "text-anchor": "middle" }, opts.xlab);
    });
  }

  // ---------------------------------------------------------------- render
  function render(pane, api, D0, which) {
    const { h, esc, n0, pc, slide, title, rows, chips, rank, chartBox, svg, add } = api;
    if (!document.getElementById("vs-css")) { const st = document.createElement("style"); st.id = "vs-css"; st.textContent = CSS; document.head.append(st); }
    const MORE = !window.KT2_VOCAL_SETS_OLD && D0.more ? D0.more : [];
    const mi = /^m\d+$/.test(which || "") ? +which.slice(1) : -1;
    const D = which === "alt" && D0.alt ? D0.alt : mi >= 0 && MORE[mi] ? MORE[mi] : D0;
    stopFlow(); pane.replaceChildren();
    const S = D.songs, secOf = (id) => D.sections.find((s) => s.name === id) || {};
    const hookS = secOf("hook"), verseS = secOf("verse");
    const medHookBar = (() => { const a = S.filter((s) => s.first_hook_bar).map((s) => s.first_hook_bar).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; })();

    // 1. hero
    let s = slide("s-sky", "Backend data", "Vocal science");
    s.append(title("h1", "How a vocal builds a song.", `${D.songs_n} songs, bar by bar.`));
    s.append(h("p", "lede", "Every vocal stem was cut into bars and measured: where the voice is, how many syllables it sings, how high, how wide, and which bars repeat. Repetition finds the hook; the rest falls into verse, pre, post, bridge and ad-libs. Below: the song maps, what each part does, the vocal rhythms (flows), and the shapes songs use."));
    if (D0.alt || MORE.length) {
      const sets = [["main", (D0.label || "YOUR STEMS").toUpperCase()]];
      if (D0.alt) sets.push(["alt", (D0.alt.label || "REFERENCE").toUpperCase()]);
      MORE.forEach((m, i) => sets.push(["m" + i, String(m.label || "MORE").toUpperCase()]));
      const sw = chips(sets, D === D0 ? "main" : which, (v) => render(pane, api, D0, v));
      sw.style.margin = "18px 0 0"; s.append(sw);
    }
    s.append(h("div", "spacer"));
    s.append(rows([
      ["Songs measured", String(D.songs_n), `${n0(D.bars)} bars \u00b7 ${n0(D.sections_n)} vocal sections${D.no_vocal && D.no_vocal.length ? ` \u00b7 ${D.no_vocal.length} stems with no voice set aside` : ""}`],
      ["Voice in the song", pc(D.voice_share), "typical share of the bar that has voice"],
      ["First hook lands", medHookBar ? `bar ${medHookBar}` : "\u2013", "the middle song"],
      ["Vocal range", `${D.range_st} semitones`, `${nn(D.lo)} to ${nn(D.hi)} in the middle song`],
      ["Flows found", String(D.flows.length), "syllable rhythms, like the drum rhythms"],
    ]));
    pane.append(s);

    // 2. song maps
    s = slide("s-mist", "Song maps", "Every song as one strip, click a song to open it");
    s.style.minHeight = "0";
    s.append(title("h2", "The maps.", "Left to right is the song, in bars. Purple is the hook."));
    const leg = h("div", "vs-legend");
    for (const k of ["intro", "verse", "pre", "hook", "post", "bridge", "adlibs", "inst"]) leg.append(h("span", "", `<i class="vs-${k}"></i>${esc(SEC[k])}`));
    s.append(leg);
    let sort = "hook", filt = "all", open = null;
    const tools = h("div", "vs-tools");
    const q = h("input", "art-q"); q.placeholder = "Search a song or artist"; q.setAttribute("aria-label", "search songs");
    const c1 = chips([["hook", "HOOK ARRIVES"], ["voice", "MOST VOICE"], ["range", "WIDEST RANGE"], ["bpm", "TEMPO"], ["az", "A\u2013Z"]], "hook", (v) => { sort = v; draw(); });
    const dels = [...new Set(S.map((x) => x.delivery))];
    const c2 = chips([["all", "ALL"]].concat(dels.map((d) => [d, d.toUpperCase()])), "all", (v) => { filt = v; draw(); });
    tools.append(q, c1, c2);
    const count = h("div", "vs-count"), list = h("div", "vs-maps");
    s.append(tools, count, list);
    function draw() {
      const qq = q.value.trim().toLowerCase();
      const L = S.filter((x) => (filt === "all" || x.delivery === filt) && (!qq || (clean(x.song) + " " + (x.artist || "")).toLowerCase().includes(qq)));
      L.sort(sort === "az" ? (a, b) => clean(a.song).localeCompare(clean(b.song)) : sort === "voice" ? (a, b) => b.voice_share - a.voice_share : sort === "range" ? (a, b) => (b.range_st || 0) - (a.range_st || 0) : sort === "bpm" ? (a, b) => a.bpm - b.bpm : (a, b) => (a.first_hook_bar || 999) - (b.first_hook_bar || 999));
      count.textContent = `${L.length} songs`;
      list.replaceChildren();
      for (const x of L) {
        const row = h("div", "vs-song" + (open === x.song ? " open" : ""));
        row.append(h("div", "nm", `${esc(clean(x.song))}<small>${esc([x.artist, x.genre, x.bpm + " BPM", x.key].filter(Boolean).join(" \u00b7 "))}</small>`));
        row.append(strip(api, x, true));
        row.append(h("div", "n", `${x.first_hook_bar ? "hook @ " + x.first_hook_bar : "no hook"}<br>${Math.round(100 * x.voice_share)}% voice`));
        if (open === x.song) row.append(songDetail(api, x));
        row.onclick = () => { open = open === x.song ? null : x.song; draw(); };
        list.append(row);
      }
      if (!L.length) list.append(h("div", "art-empty", "No song matches that."));
    }
    q.oninput = draw; draw();
    pane.append(s);

    // 3. the parts
    s = slide("s-lilac", "The parts", "What each vocal part does");
    s.style.minHeight = "0";
    s.append(title("h2", "Verse sets it up. Hook pays it off.", "Measured across every section of every song."));
    const parts = h("div", "vs-parts");
    const maxSyl = Math.max(...D.sections.map((x) => x.syl || 0)), maxLen = Math.max(...D.sections.map((x) => x.len || 0));
    for (const p of D.sections) {
      if (["inst"].includes(p.name)) continue;
      const d = h("div", "vs-part"); d.style.borderTopColor = p.name === "hook" ? "var(--acc)" : p.name === "verse" ? "var(--ink)" : "var(--ink3)";
      const m = (lab, v, text, max) => `<span>${lab}</span><b>${text}</b><div class="bar"><i style="width:${Math.round(100 * (v || 0) / (max || 1))}%"></i></div>`;
      d.innerHTML = `<h3>${esc(SEC[p.name])}</h3><div class="sub">${p.n} sections \u00b7 ${pc(p.share)} of all bars</div><div class="m">
        ${m("Typical length", p.len, (p.len || 0) + " bars", maxLen)}
        ${["intro", "outro"].includes(p.name) ? "" : m("Voice in the bar", p.cov, pc(p.cov || 0), 1) + m("Syllables a bar", p.syl, p.syl, maxSyl) + m("Stereo width", p.width, (p.width || 0).toFixed(2), 1) + m("Off-grid syllables", p.sync, pc(p.sync || 0), 1)}
      </div>${p.pitch != null && !["intro", "outro"].includes(p.name) ? `<p class="about" style="margin:10px 0 0;font-size:12px;color:var(--ink2)">Sits around ${nn(p.pitch)}${p.db != null ? ` \u00b7 ${p.db} dB` : ""}</p>` : ""}`;
      api.hover(d, () => `<b>${esc(SEC[p.name])}</b>length in bars: ${p.len_hist[0]} short (\u22644) \u00b7 ${p.len_hist[1]} of 5\u20138 \u00b7 ${p.len_hist[2]} of 9\u201316 \u00b7 ${p.len_hist[3]} longer`);
      parts.append(d);
    }
    s.append(parts);
    const two = h("div", "vs-two");
    const a1 = h("div"); a1.append(h("h4", "", "What the hook does vs the verse"));
    a1.append(rank(D.recipes.slice(0, 9).map(([k, v]) => ({ label: k, v, text: `${v} songs`, hi: k === D.recipes[0][0] }))));
    const a2 = h("div"); a2.append(h("h4", "", "Hook minus verse, averaged"));
    const C = D.contrast;
    a2.append(rows([
      ["Pitch", (C.pitch.mean >= 0 ? "+" : "") + C.pitch.mean.toFixed(1) + " st", `${C.pitch.up} of ${C.pitch.n} hooks go higher`],
      ["Loudness", (C.db.mean >= 0 ? "+" : "") + C.db.mean.toFixed(1) + " dB", `${C.db.up} of ${C.db.n} hooks are louder`],
      ["Syllables a bar", (C.onsets_per_bar.mean >= 0 ? "+" : "") + C.onsets_per_bar.mean.toFixed(1), `${C.onsets_per_bar.up} of ${C.onsets_per_bar.n} hooks are busier`],
      ["Stereo width", (C.width.mean >= 0 ? "+" : "") + C.width.mean.toFixed(2), `${C.width.up} of ${C.width.n} hooks are wider (stacked)`],
    ]));
    two.append(a1, a2);
    s.append(two);
    pane.append(s);

    // 4. flows
    s = slide("s-peach", "Flows", "Click a card to hear it, click again to stop");
    s.style.minHeight = "0";
    s.append(title("h2", `${D.flows.length} vocal flows.`, "Where the syllables land in a bar."));
    s.append(h("p", "lede", "Every voiced section's syllables were counted on a 16-step grid and the grids were clustered, the same way the 36 drum rhythms were found. Tall = a syllable nearly always lands there. Press one: it sings the pattern on a small voice over a click."));
    const ftools = h("div", "vs-tools");
    let fbpm = 130;
    const bc = h("label", "bpm-ctl", `TEMPO <input type="range" min="70" max="180" step="1" value="130"><b>130 BPM</b>`);
    const rng = bc.querySelector("input"), bl = bc.querySelector("b"); rng.oninput = () => { fbpm = +rng.value; bl.textContent = fbpm + " BPM"; };
    ftools.append(bc); s.append(ftools);
    const fg = h("div", "vs-fgrid");
    for (const f of D.flows) {
      const card = h("button", "vs-flow"); card.type = "button";
      card.innerHTML = `<div class="fh"><b>${esc(f.name || `Flow ${f.rank}`)}</b><span>${f.sections} sections</span></div>
        <div class="vs-steps">${f.grid.map((v, i) => `<u class="${v >= 0.5 ? "on" : ""}${i % 4 === 0 ? " beat" : ""}" style="height:${Math.max(3, Math.round(3 + 31 * v))}px"></u>`).join("")}</div>
        <p class="about">${esc(f.about || f.auto)}</p>
        <div class="meta"><span>${f.syllables} syl / bar</span><span>${pc(f.hook_share)} in hooks</span><span>${f.songs.length} songs</span></div>`;
      api.hover(card, () => `<b>${esc(f.name || `Flow ${f.rank}`)}</b>${esc(f.songs.slice(0, 6).map(clean).join(" \u00b7 "))}${f.songs.length > 6 ? ` \u00b7 +${f.songs.length - 6}` : ""}`);
      card.onclick = () => { if (playing && playing.card === card) { stopFlow(); return; } playFlow(api, f, card, fbpm); };
      fg.append(card);
    }
    s.append(fg);
    pane.append(s);

    // 4b. the sung melody (the notes read from the vocal stems)
    const M = !window.KT2_VOCAL_MELODY_OFF && D.melody;
    if (M) {
      s = slide("s-sky", "Melody", "Click a card to hear the line, click again to stop");
      s.style.minHeight = "0";
      s.append(title("h2", "The sung melody.", `${n0(M.notes_n)} notes from ${M.songs_n} songs.`));
      s.append(rows([
        ["A sung phrase", `${M.phrase_notes} notes`, `over ${M.phrase_beats} beats, ${M.phrase_range} semitones wide (the middle phrase)`],
        ["Minor", pc(M.minor_share), "of the songs sing in a minor key"],
        ["Same note again", pc((M.motion.find((x) => x[0] === "repeat") || [0, 0])[1]), "of all moves from one note to the next"],
      ]));
      const m1 = h("div", "vs-two");
      const NAMES = { repeat: "Same note again", step: "Step (1\u20132 semitones)", skip: "Skip (3\u20134)", leap: "Leap (5 or more)" };
      const ma = h("div"); ma.append(h("h4", "", "How the line moves")); ma.append(rank(M.motion.map(([k, v]) => ({ label: NAMES[k] || k, v, text: pc(v), hi: v === Math.max(...M.motion.map((x) => x[1])) }))));
      const mb = h("div"); mb.append(h("h4", "", "Phrase shapes")); mb.append(rank(M.shapes.map(([k, v], i) => ({ label: k, v, text: `${v}`, hi: i === 0 }))));
      m1.append(ma, mb); s.append(m1);
      const m2 = h("div", "vs-two");
      const ia = h("div", "vs-hist"); ia.append(h("h4", "", "Jump from one note to the next"));
      const iv = M.intervals, ivMax = Math.max(...iv.map((x) => x[1]));
      ia.append(hist(api, iv.map((x) => x[1]), iv.map((x) => (x[0] % 2 === 0 ? (x[0] > 0 ? "+" : "") + x[0] : "")), { unit: "moves", xlab: "SEMITONES DOWN / UP", hi: iv.findIndex((x) => x[1] === ivMax) }));
      const ib = h("div", "vs-hist"); ib.append(h("h4", "", "Notes of the scale it sings (1 = home note)"));
      const dg = M.degrees, dgMax = Math.max(...dg.map((x) => x[1]));
      ib.append(hist(api, dg.map((x) => Math.round(x[1] * 100)), dg.map((x) => x[0]), { unit: "% of sung time", xlab: "SCALE STEP", hi: dg.findIndex((x) => x[1] === dgMax) }));
      m2.append(ia, ib); s.append(m2);
      const m3 = h("div", "vs-two");
      const la = h("div", "vs-hist"); la.append(h("h4", "", "Note lengths"));
      la.append(hist(api, M.lengths.map((x) => x[1]), M.lengths.map((x) => x[0]), { unit: "notes" }));
      const lb = h("div"); lb.append(h("h4", "", "Favorite 3-note moves (semitones)"));
      lb.append(h("div", "vs-cells", M.cells.map(([k, v]) => `<span>${esc(k)}<i>${v}</i></span>`).join("")));
      m3.append(la, lb); s.append(m3);
      const mg = h("div", "vs-mgrid");
      S.filter((x) => x.mel && x.mel.roll && x.mel.roll.length >= 6).sort((a, b) => b.mel.roll.length - a.mel.roll.length).slice(0, 24).forEach((x) => {
        const card = h("button", "vs-mel"); card.type = "button";
        card.innerHTML = `<b>${esc(clean(x.song))}</b><small>${esc(x.mel.key)} \u00b7 ${Math.round(x.bpm)} BPM \u00b7 ${nn(x.mel.lo)} to ${nn(x.mel.hi)}${x.mel.shape ? " \u00b7 " + esc(x.mel.shape.split(" (")[0]) : ""}</small>${rollSvg(x.mel.roll)}`;
        card.onclick = () => { if (playing && playing.card === card) { stopFlow(); return; } playMel(api, x, card); };
        mg.append(card);
      });
      s.append(mg);
      s.append(h("p", "vs-note", esc(M.source)));
      pane.append(s);
    }

    // 5. delivery, structure, phrasing, range
    s = slide("s-sage", "Shapes", "Delivery, structure, phrasing, range");
    s.style.minHeight = "0";
    s.append(title("h2", "The shapes songs use.", "How the voice is delivered, how the parts are ordered."));
    const g1 = h("div", "vs-two");
    const d1 = h("div"); d1.append(h("h4", "", "Delivery")); d1.append(rank(D.deliveries.map(([k, v], i) => ({ label: k, v, text: `${v}`, hi: i === 0 }))));
    const d2 = h("div"); d2.append(h("h4", "", "Structure")); d2.append(rank(D.structures.map(([k, v], i) => ({ label: k, v, text: `${v}`, hi: i === 0 }))));
    const d3 = h("div"); d3.append(h("h4", "", "Tuning")); d3.append(rank(D.tunings.map(([k, v], i) => ({ label: k, v, text: `${v}`, hi: i === 0 }))));
    g1.append(d1, d2, d3); s.append(g1);
    const g2 = h("div", "vs-two");
    const p1 = h("div", "vs-hist"); p1.append(h("h4", "", "Phrase length (sung run before a breath), all songs"));
    p1.append(hist(api, D.phrase_hist, D.phrase_bins.map((b) => b.split(" ")[0]), { unit: "phrases", xlab: "BEATS" }));
    const p2 = h("div"); p2.append(h("h4", "", "Where the first hook lands"));
    const pos = D.positions.first_hook || [];
    const bins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; pos.forEach((p) => bins[Math.min(9, Math.floor(p * 10))]++);
    p2.append(hist(api, bins, bins.map((_, i) => `${i * 10}`), { unit: "songs", xlab: "% OF THE SONG" }));
    g2.append(p1, p2); s.append(g2);
    // range strip
    const rh = h("h4", "", "Range per song, lowest to highest sung note"); rh.style.cssText = "margin:34px 0 10px;font:400 11px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--ink2)"; s.append(rh);
    const R = S.filter((x) => x.lo != null && x.hi != null).sort((a, b) => a.med - b.med);
    s.append(chartBox((c, W) => {
      const rowH = 14, L = Math.min(170, W * 0.3), T = 20, H = T + rowH * R.length + 8;
      const lo = Math.floor(Math.min(...R.map((x) => x.lo)) / 12) * 12, hi = Math.ceil(Math.max(...R.map((x) => x.hi)) / 12) * 12;
      const x = (m) => L + (W - L - 8) * (m - lo) / (hi - lo);
      const g = svg(W, H); c.append(g);
      for (let m = lo; m <= hi; m += 12) { add(g, "line", { x1: x(m), x2: x(m), y1: T - 6, y2: H, style: "stroke:var(--rule)" }); add(g, "text", { x: x(m), y: 10, "text-anchor": "middle", style: "font:400 10px var(--mono);fill:var(--ink3)" }, nn(m)); }
      R.forEach((r, i) => {
        const y = T + rowH * i + rowH / 2;
        add(g, "text", { x: L - 10, y: y + 3.5, "text-anchor": "end", style: "font:400 10px var(--sans);fill:var(--ink2)" }, clean(r.song).length > 26 ? clean(r.song).slice(0, 25) + "\u2026" : clean(r.song));
        add(g, "rect", { x: x(r.lo), y: y - 3, width: Math.max(3, x(r.hi) - x(r.lo)), height: 6, rx: 3, style: `fill:${r.delivery === "sung" ? "var(--ink)" : "var(--acc)"}` });
        add(g, "circle", { cx: x(r.med), cy: y, r: 2.4, style: "fill:var(--bg,#fff)" });
        const hit = add(g, "rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, style: "fill:transparent" });
        api.hover(hit, () => `<b>${esc(clean(r.song))}</b>${nn(r.lo)} to ${nn(r.hi)} (${r.range_st} st) \u00b7 centre ${nn(r.med)} \u00b7 ${r.delivery}`);
      });
    }));
    s.append(h("div", "legend", `<span><i style="height:8px"></i>Sung</span><span><i style="background:var(--acc);height:8px"></i>Rap / chopped / spoken</span><span><i style="background:var(--bg);height:8px;border:1px solid var(--rule)"></i>Centre note</span>`));
    if (D.no_vocal && D.no_vocal.length) s.append(h("p", "vs-note", `<b>Set aside, no voice found:</b> ${esc(D.no_vocal.map((x) => x.song.replace(/\s*\[[^\]]*\]\s*$/, "")).join(" \u00b7 "))}`));
    s.append(h("p", "vs-note", esc(D.source) + " Hook = the 4-bar block that comes back most often and loudest; pre and post = recurring blocks that always sit before or after it; bridge = a one-off block late in the song with a different pitch centre; ad-libs = bars with only scattered voice. Stems come from AI separation, so bleed and chops can count as voice."));
    pane.append(s);
  }

  (window.BackendDataTabs = window.BackendDataTabs || []).push({
    id: "vocals", label: "VOCAL SCIENCE", order: 60,
    render(pane, api) {
      const go = (D) => render(pane, api, D);
      if (window.VOCALS_SCIENCE_DATA) { go(window.VOCALS_SCIENCE_DATA); return; }
      (window.ktData ? window.ktData("vocals") : fetch("science/vocals-data.json")).then((r) => r.json()).then(go).catch((e) => {
        pane.append(api.h("section", "slide s-mist", `<h2>Vocal data missing.<span>science/vocals-data.json did not load (${api.esc(e.message)}).</span></h2>`));
      });
    },
  });
})();
