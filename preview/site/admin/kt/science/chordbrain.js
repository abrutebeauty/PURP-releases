/* CHORD BRAIN (Eman, 9 Nov 2026): CHORD SCIENCE + CHORD LAB merged into one BACKEND DATA tab, in the
   BACKEND DATA look (clean, data first). It replaces the CHORD SCIENCE and CHORD LAB tabs.
   - The CHORD LAB parts (how the dice thinks, the songs, findings, dials, prompt lab, messy prompts, sample
     bank, TOY MACHINE, sources) are built here with the same element ids chord-lab.html has, then
     chord-lab.js runs on them unchanged, so the page and the old CHORD LAB can never drift apart.
   - The CHORD SCIENCE part (41 ways chords are played) is the chords.js plug-in, rendered inside.
   Flag KT2_CHORD_BRAIN_OLD (window or localStorage "1") = the old CHORD SCIENCE + CHORD LAB tabs. */
(function () {
  "use strict";
  try { if (window.KT2_CHORD_BRAIN_OLD || localStorage.getItem("KT2_CHORD_BRAIN_OLD") === "1") return; } catch (e) { /* storage blocked */ }

  const CSS = `
  .cb .slide p { max-width: 820px; }
  .cb h3 { margin: 26px 0 10px; font: 500 11px/1 var(--mono); letter-spacing: .18em; text-transform: uppercase; color: var(--ink2); }
  .cb .small { font-size: 12px; color: var(--ink3); }
  .cb .tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; margin: 22px 0 4px; }
  .cb .tile { background: var(--tile); padding: 14px 16px; min-height: 0; height: auto; aspect-ratio: auto; display: block; }
  .cb .slide > .grid2, .cb .slide > .grid3, .cb .slide > .tbl, .cb .slide > .try, .cb .slide > .bank, .cb .slide > .tiles { margin-top: 18px; }
  .cb #era-chart svg, .cb #era-colour svg { max-width: none !important; }
  .cb .tile .n { font: 500 26px/1 var(--sans); letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
  .cb .tile .l { margin-top: 8px; font: 500 10px/1.2 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); }
  .cb .pipe { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
  .cb .pipe .step { background: var(--tile); padding: 14px 14px 12px; border-top: 2px solid var(--acc); }
  .cb .pipe .step i { display: block; font: 500 10px/1 var(--mono); letter-spacing: .16em; color: var(--acc); font-style: normal; margin-bottom: 8px; }
  .cb .pipe .step b { display: block; font-weight: 500; font-size: 14px; margin-bottom: 4px; }
  .cb .pipe .step span { color: var(--ink2); font-size: 12.5px; line-height: 1.45; }
  .cb .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
  .cb .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
  .cb .card { background: var(--tile); padding: 16px 18px; min-width: 0; }
  .cb .card h3 { margin-top: 0; }
  .cb .bars { display: grid; gap: 5px; }
  .cb .bar { display: grid; grid-template-columns: minmax(80px, 140px) 1fr 52px; align-items: center; gap: 10px; font-size: 12.5px; }
  .cb .bar .k { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cb .bar .t { height: 8px; background: var(--rule); position: relative; }
  .cb .bar .t i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--acc); }
  .cb .bar .t i.b { background: var(--ink3); }
  .cb .bar .v { text-align: right; color: var(--ink2); font: 400 11.5px/1 var(--mono); font-variant-numeric: tabular-nums; }
  .cb .tbl { overflow-x: auto; }
  .cb table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .cb th { text-align: left; padding: 8px 10px 8px 0; font: 500 10px/1.2 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); border-bottom: 1px solid var(--ink3); }
  .cb td { padding: 7px 10px 7px 0; border-bottom: 1px solid var(--rule); vertical-align: top; color: var(--ink2); font-variant-numeric: tabular-nums; }
  .cb td.k { color: var(--ink); font-weight: 500; white-space: nowrap; }
  .cb td .mini { display: inline-block; width: 52px; height: 6px; background: var(--rule); vertical-align: middle; margin-right: 6px; position: relative; }
  .cb td .mini i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--acc); }
  .cb .chip { display: inline-block; padding: 4px 6px; margin: 1px 3px 1px 0; font: 500 10px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--acc); box-shadow: inset 0 0 0 1px var(--acc); }
  .cb .chip.dim { color: var(--ink2); box-shadow: inset 0 0 0 1px var(--rule); }
  .cb .chip.warn { color: #d33; box-shadow: inset 0 0 0 1px #d33; }
  .cb .chords { font: 500 12px/1.35 var(--mono); color: var(--ink); letter-spacing: .02em; }
  .cb .chords .out { color: var(--acc); }
  .cb svg text { fill: var(--ink2); font-family: var(--mono); }
  .cb svg line { stroke: var(--rule); }
  .cb svg.tl text { fill: #111; font-family: var(--sans); }
  .cb .tl { display: block; margin-top: 5px; max-width: 100%; }
  .cb .try { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 4px; }
  .cb .prompt { display: flex; gap: 4px; margin-bottom: 12px; }
  .cb .prompt input, .cb .search { flex: 1; height: 38px; padding: 0 12px; border: 0; border-radius: 0; background: var(--tile2); color: var(--ink); outline: none; box-shadow: inset 0 0 0 1px var(--rule); font: 400 14px var(--sans); width: 100%; box-sizing: border-box; }
  .cb .prompt input:focus, .cb .search:focus { box-shadow: inset 0 0 0 1px var(--acc); }
  .cb .btn { height: 38px; padding: 0 16px; border: 0; border-radius: 0; background: var(--ink); color: var(--bg); font: 500 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; cursor: pointer; }
  .cb .btn.sm { height: 28px; padding: 0 10px; font-size: 10px; }
  .cb .btn.playing { background: var(--acid); color: #111; }
  .cb .dials { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; font-size: 12px; }
  .cb .dials div { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--rule); }
  .cb .dials div span:first-child { font: 500 10px/1.6 var(--mono); letter-spacing: .12em; color: var(--ink2); }
  .cb .dials div span:last-child { font-weight: 500; }
  .cb .rolls { display: grid; gap: 4px; }
  .cb .roll { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 10px 12px; background: var(--tile); }
  .cb .roll.playing { box-shadow: inset 3px 0 0 var(--acid); }
  .cb .examples { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 12px; }
  .cb .examples button { padding: 6px 8px; border: 0; border-radius: 0; background: none; color: var(--ink2); font: 400 12px/1 var(--sans); cursor: pointer; box-shadow: inset 0 0 0 1px var(--rule); }
  .cb .examples button:hover { color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
  .cb .bank { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 4px; }
  .cb .smp { display: grid; gap: 8px; min-width: 0; overflow: hidden; padding: 14px 16px; background: var(--tile); border-top: 2px solid transparent; }
  .cb .smp.playing { border-top-color: var(--acid); }
  .cb .smp .pr { font-weight: 500; font-size: 15px; }
  .cb .smp .meta { display: flex; flex-wrap: wrap; gap: 3px; }
  .cb .smp .set { font-size: 11.5px; color: var(--ink2); }
  .cb .smp .set b { font: 500 10px/1 var(--mono); letter-spacing: .1em; color: var(--ink); }
  .cb .smp .row { display: flex; align-items: center; gap: 8px; }
  .cb .smp canvas { width: 100%; height: 34px; display: block; background: var(--rule); }
  .cb .verdict { display: inline-block; width: 8px; height: 8px; margin-right: 6px; background: #3aa86b; vertical-align: middle; }
  .cb .verdict.w { background: #d9a21b; }
  .cb .verdict.x { background: #d33; }
  .cb .catalog { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 4px; }
  .cb .cat { padding: 10px 12px; background: var(--tile); font-size: 12.5px; }
  .cb .cat .n { display: flex; justify-content: space-between; gap: 8px; font-weight: 500; }
  .cb .cat .n span { color: var(--ink) !important; }
  .cb .cat .n span + span { color: var(--ink3) !important; font: 400 10px/1.6 var(--mono); letter-spacing: .08em; }
  .cb .cat .l { margin-top: 4px; color: var(--ink2); font: 400 10.5px/1.45 var(--mono); }
  .cb .app-wrap { overflow-x: auto; margin-top: 14px; }
  .cb iframe.app { width: 100%; min-width: 1180px; height: 820px; border: 0; background: #0f0f11; display: block; }
  .cb .cb-sci { margin: 0; }
  .cb .cb-sci > .slide:first-of-type { border-top: 1px solid var(--rule); }
  .cb a { color: var(--acc); }
  @media (max-width: 1100px) { .cb .pipe, .cb .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } .cb .grid3 { grid-template-columns: 1fr; } }
  @media (max-width: 900px) { .cb .pipe, .cb .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cb .grid2, .cb .try { grid-template-columns: 1fr; } }
  `;

  const DIALS = [
    ["LENGTH", "1, 2, 4 or 8 bars.", "What the loop needs: 4 bars, 8 when a chord lasts two bars.", "everyone"],
    ["CHANGE", "A chord every 2 bars, 1 bar, half bar or beat.", "The median beats-per-chord of the songs behind the words (Hooktheory).", "Scaler (pace), Live Seed, Logic"],
    ["RHYTHM", "Hold, pulse, stabs, off-beats or broken.", "The styles named: rap / ambient / sad hold, house / punk pulse, funk / reggae stab, folk / guitar break.", "Scaler performances, Captain rhythm, Live Rhythm"],
    ["VOICES", "2 to 5 notes per chord.", "3, or 4 when the songs are colourful enough to need the 7th.", "Live Stacks, Scaler voicing, Chordjam"],
    ["RANGE", "Low, mid or high on the keyboard.", "Mid, unless the words say deep / sub / 808 or high / bright / bells.", "Captain, Orb"],
    ["COLOUR", "Plain triads up to 9ths, sus and borrowed chords.", "The share of extended chords in those songs.", "Scaler, Captain, Orb"],
    ["TENSION", "Lands home at the end, or hangs.", "How often those songs leave the key, plus tense / villain / dark words.", "Orb (tension), Captain (mood)"],
    ["RANDOM", "How far from the common choices the dice may wander.", "Usual; wild for experimental / weird words, safe for pop / simple.", "Live Seed, Chordjam"],
    ["POP / ALT", "Rides the moves every hit makes, or the ones only alternative songs make.", "Pop for pop / 2010s / radio words, alt for indie / experimental / shoegaze, else the middle.", "new, from the data"],
    ["NOTES / FEEL", "For melody, bass, arp: notes per bar and swing.", "Notes per bar of those songs' melodies; swing for jazz / soul / hip hop / lo-fi.", "Captain Melody, Scaler"],
  ];
  const PIPE = [
    ["Words", "The prompt is split into words we know (4,615, English and Swedish, plus near matches)."],
    ["Profiles", "Each word points at song groups: a mood, genre, era or artist. Unknown artists point at the moods they sound like."],
    ["Move table", "Each group knows how its songs move from chord to chord, relative to the key. Groups are mixed by weight."],
    ["The walk", "A loop the songs really use, or a step-by-step walk. RANDOM = temperature, TENSION = pulled home or not, POP/ALT = common or rare moves."],
    ["Colour + voices", "Triads become 7ths, 9ths, sus and borrowed chords as far as COLOUR allows, then voice-led so hands barely move."],
    ["Rhythm", "CHANGE sets how long each chord lasts, RHYTHM how it is played. Melody, bass and arp read the same chords."],
  ];

  const load = (src) => new Promise((res) => { const s = document.createElement("script");
    if (window.CB_INLINE && window.CB_INLINE[src]) { s.textContent = window.CB_INLINE[src]; document.head.append(s); res(); return; }   // published mockup: no files next to the page
    s.src = src; s.onload = res; s.onerror = () => { console.warn("CHORD BRAIN: could not load " + src); res(); }; document.head.append(s); });

  (window.BackendDataTabs = window.BackendDataTabs || []).push({
    id: "brain", label: "CHORD BRAIN", order: 40, replaces: ["chords", "lab"],
    async render(pane, api) {
      const { h, slide, title } = api;
      const st = document.createElement("style"); st.textContent = CSS; pane.append(st);
      const root = h("div", "cb"); pane.append(root);
      const esc = api.esc;

      // 1. how it thinks
      let s = slide("s-hero", "Chord brain", "How the dice picks chords");
      s.append(title("h1", "The chord brain.", "What real songs do, read in the browser."));
      s.append(h("p", "lede", `Type words next to the dice, press it, and TOY MACHINE writes chords the way the songs behind those words do. No AI and no account: a table of what <b id="n-songs">\u2026</b> real songs actually do. Every dial starts on AUTO, so the songs choose it.`));
      s.append(h("div", "tiles", "")); s.lastChild.id = "tiles";
      s.append(h("h3", "", "One roll, step by step"));
      s.append(h("div", "pipe", PIPE.map(([b, t], i) => `<div class="step"><i>${i + 1}</i><b>${esc(b)}</b><span>${esc(t)}</span></div>`).join("")));
      const foot = h("div", ""); foot.id = "foot"; foot.hidden = true; s.append(foot);
      root.append(s);

      // 2. the songs
      s = slide("s-mist", "The songs", "Where the numbers come from");
      s.append(title("h2", "Three open song databases.", "Read song by song, every chord written relative to its key."));
      s.append(h("div", "grid3", `<div class="card"><h3>Songs per source</h3><div class="bars" id="src-bars"></div><p class="small" style="margin-top:10px">Hooktheory is the only one with melodies and checked keys, so melody numbers and chord pace come from it.</p></div><div class="card"><h3>Songs per mood</h3><div class="bars" id="mood-bars"></div></div><div class="card"><h3>Songs per genre</h3><div class="bars" id="genre-bars"></div></div>`));
      s.append(h("div", "grid2", `<div class="card"><h3>Songs per decade</h3><div id="era-chart"></div></div><div class="card"><h3>How a mood is defined</h3><p class="small">A mood is a bundle of words people type, genre tags and artists that carry that feeling. Every mood is a few thousand songs or more.</p><div id="mood-def"></div></div>`));
      s.lastChild.style.marginTop = "4px";
      s.append(h("h3", "", "Every group the dice can learn from"));
      s.append(h("div", "", `<input class="search" id="cat-q" placeholder="Search a mood, genre, era, artist or any word (try: tokyo, regn, skrillex, 80s, church)" aria-label="search the groups"><div class="catalog" id="catalog" style="margin-top:8px"></div><div class="small" id="cat-more" style="margin-top:8px"></div>`));
      root.append(s);

      // 3. findings
      s = slide("s-sky", "Findings", "Which chords, in which order");
      s.append(title("h2", "What the songs do.", "Moves, loops, decades, moods and genres."));
      s.append(h("div", "grid2", `<div class="card"><h3>Most common moves in minor (in C)</h3><div class="bars" id="moves-minor"></div></div><div class="card"><h3>Most common moves in major (in C)</h3><div class="bars" id="moves-major"></div></div><div class="card"><h3>The loops everybody uses (in C)</h3><div class="tbl"><table id="loops-table"></table></div></div><div class="card"><h3>Colour of the decades</h3><div id="era-colour"></div><p class="small" style="margin-top:8px">Share of chords with a 7th or more, and chords borrowed from outside the key. The 1920s to 50s were the colourful years.</p></div>`));
      s.append(h("h3", "", "Mood fingerprints"));
      s.append(h("p", "small", "MINOR = songs in a minor key. COLOUR = chords with 7ths and up. OUT = chords from outside the key. PACE = median beats per chord. NOTES = melody notes per bar. LEAP = melody moves bigger than a step."));
      s.append(h("div", "tbl", `<table id="mood-table"></table>`));
      s.append(h("h3", "", "Genres"));
      s.append(h("div", "tbl", `<table id="genre-table"></table>`));
      root.append(s);

      // 4. how chords are played (CHORD SCIENCE)
      const sci = h("div", "cb-sci"); root.append(sci);
      const cs = (window.BackendDataTabs || []).find((t) => t && t.id === "chords");
      if (cs) { try { cs.render(sci, api); } catch (e) { console.error("CHORD BRAIN: chord science", e); } }

      // 5. dials
      s = slide("s-lilac", "The dials", "What each dial does");
      s.append(title("h2", "Ten dials, all on AUTO.", "Picked from what the chord tools people use agree on."));
      s.append(h("p", "lede", "Scaler 3, Captain Chords, Orb Producer, Chordjam, Ableton Live 12 and Logic's Session Players all land on the same handful. Only a song database can offer POP / ALT, so that one is new."));
      s.append(h("div", "tbl", `<table><tr><th>Dial</th><th>What it does</th><th>What AUTO reads it from</th><th>Who else has it</th></tr>${DIALS.map((d) => `<tr><td class="k">${esc(d[0])}</td><td>${esc(d[1])}</td><td>${esc(d[2])}</td><td>${esc(d[3])}</td></tr>`).join("")}</table>`));
      root.append(s);

      // 6. prompt lab
      s = slide("s-peach", "Prompt lab", "Type anything");
      s.append(title("h2", "Prompt lab.", "What the brain heard, what it leans on, four rolls in C minor."));
      s.append(h("div", "examples", "")); s.lastChild.id = "examples";
      s.append(h("div", "try", `<div><div class="prompt"><input id="try-in" placeholder="fred again and radiohead sad cinematic ambient" aria-label="prompt"><button class="btn" id="try-go" type="button">ROLL</button></div><div id="try-heard" style="margin-bottom:10px"></div><div class="rolls" id="try-rolls"></div></div><div class="card"><h3>Leans on</h3><div class="bars" id="try-from"></div><h3>AUTO picks</h3><div class="dials" id="try-auto"></div></div>`));
      root.append(s);

      // 7. messy prompts
      s = slide("s-sage", "Messy prompts", "40 prompts, easy to nonsense");
      s.append(title("h2", "Messy prompts.", "Run live with fixed seeds, 3 checks each."));
      s.append(h("p", "small", "VARIETY = different loops in 12 rolls (we want 8+). HOME = with TENSION low, the loop has the home chord. STEADY = no chord repeats back to back."));
      s.append(h("div", "tiles", "")); s.lastChild.id = "test-tiles";
      s.append(h("div", "tbl", `<table id="test-table"></table>`));
      root.append(s);

      // 8. sample bank
      s = slide("s-mist", "Sample bank", "Press play");
      s.append(title("h2", "Sample bank.", "One prompt on AUTO per card, played by a clean TOY MACHINE sound."));
      s.append(h("div", "bank", "")); s.lastChild.id = "bank-grid";
      root.append(s);

      // 9. TOY MACHINE
      s = slide("s-lilac", "Try it", "The real thing");
      s.append(title("h2", "Try it in TOY MACHINE.", "A lane with the MIDI roll open and the dice row unfolded."));
      const wrap = h("div", "app-wrap", `<iframe class="app" id="app-frame" title="TOY MACHINE" loading="lazy"></iframe>`); s.append(wrap);
      s.append(h("p", "small", `<a href="app2.html#chordlab" target="_blank">Open it full size</a>`));
      root.append(s);

      // 10. sources
      s = slide("s-mist", "Sources", "Licences");
      s.append(title("h2", "Sources.", ""));
      s.append(h("div", "tbl", `<table><tr><th>Source</th><th>Songs</th><th>What it gives</th><th>Licence</th></tr>
        <tr><td class="k">Chordonomicon v2 (Kantarelis et al., 2024)</td><td>679,807</td><td>Chord progressions from Ultimate Guitar with Spotify genre tags and decade</td><td>CC BY-NC 4.0</td></tr>
        <tr><td class="k">Hooktheory / TheoryTab (via SheetSage, 2022)</td><td>26,175</td><td>Song sections with checked key, chords and melody</td><td>CC BY-NC-SA 3.0</td></tr>
        <tr><td class="k">Lakh MIDI chords (Raffel, 2016)</td><td>31,032</td><td>MIDI songs matched to artist and title</td><td>CC BY-SA 4.0</td></tr>
        <tr><td class="k">POP909 (Wang et al., 2020)</td><td>880</td><td>Piano arrangements: how chords are played (the 41 patterns)</td><td>MIT</td></tr></table>`));
      s.append(h("p", "small", `The songs themselves are never stored, only how they move. <span id="built"></span>`));
      root.append(s);

      // run the CHORD LAB code on these ids (same code as chord-lab.html)
      if (window.CB_DATA && window.ChordBrain) window.ChordBrain.load(window.CB_DATA);
      if (!window.ChordBrain) await load("chord-brain.js");
      if (window.CB_DATA && window.ChordBrain) { window.ChordBrain.load(window.CB_DATA); document.dispatchEvent(new CustomEvent("chordbrain", { detail: { songs: window.CB_DATA.songs } })); }
      if (!window.ToyMachine) await load("toy-machine.js");
      await load("chord-lab.js");
    },
  });
})();
