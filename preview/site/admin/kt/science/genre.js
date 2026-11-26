/* GENRE SCIENCE (BACKEND DATA plug-in tab, Eman 9 Nov 2026 12:55): what makes each mood a mood, in music theory.
   Eman's 18 moods (dark 0 to bright 10) + 5 suggested new ones, each with: what makes it (scale, chords, the notes
   that do it, voicing, movement, what to avoid), how the dice checks a roll, and 10 playable examples. Plus blends
   ("villain but playful": the first mood's chords, the second mood's motion), how to analyse a song, and the research.
   Everything comes from ../kt2-mood-dna.js (window.KT2MoodDNA), the same file the dice rolls with, so the page and the
   dice can never disagree. Flag KT2_GENRE_SCIENCE_OFF hides the tab. ASCII only. */
(function () {
  "use strict";
  try { if (window.KT2_GENRE_SCIENCE_OFF || localStorage.getItem("KT2_GENRE_SCIENCE_OFF") === "1") return; } catch (e) { /* storage blocked */ }
  (window.BackendDataTabs = window.BackendDataTabs || []).push({
    id: "genre", label: "GENRE SCIENCE", order: 45,
    render(pane, api) {
      const { h, esc, slide, title, rows, chips } = api;
      const D = window.KT2MoodDNA;
      if (!D) { pane.append(h("p", "lede", "The mood science file (kt2-mood-dna.js) did not load.")); return; }
      const css = document.createElement("style");
      css.textContent = `
        .gs-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 3px; margin-top: 22px; }
        .gs-m { appearance: none; border: 0; text-align: left; cursor: pointer; padding: 12px 12px 10px; background: var(--tile); color: var(--ink); border-top: 5px solid var(--mc); min-height: 64px; display: flex; flex-direction: column; justify-content: space-between; gap: 6px; }
        .gs-m b { font: 600 13px/1 var(--mono); letter-spacing: .1em; }
        .gs-m i { font: 400 10px/1 var(--mono); letter-spacing: .12em; color: var(--ink3); font-style: normal; }
        .gs-m.on { background: var(--ink); color: var(--bg, #111); }
        .gs-m.on i { color: inherit; opacity: .6; }
        .gs-m.new { border-top-style: dashed; }
        .gs-m.core { border-top-width: 9px; }
        .gs-roll rect.mel { fill: #E4FF3A; }
        .gs-top { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
        .gs-topbtn { appearance: none; border: 1px solid #E4FF3A; background: transparent; color: var(--ink); font: 600 11px/1 var(--mono); letter-spacing: .12em; padding: 7px 10px; cursor: pointer; }
        .gs-topbtn.on { background: #E4FF3A; color: #111; }
        .gs-head { display: flex; gap: 18px; align-items: baseline; flex-wrap: wrap; margin-top: 30px; }
        .gs-head h2 { color: var(--ink); }
        .gs-dot { width: 14px; height: 14px; background: var(--mc); display: inline-block; }
        .gs-what { font-size: 18px; line-height: 1.4; max-width: 760px; margin: 12px 0 0; color: var(--ink); }
        .gs-cues { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 3px; margin-top: 20px; }
        .gs-cues div { background: var(--tile); padding: 12px 14px; }
        .gs-cues em { display: block; font: 400 10px/1 var(--mono); letter-spacing: .16em; color: var(--ink3); font-style: normal; margin-bottom: 7px; text-transform: uppercase; }
        .gs-cues span { font-size: 14px; color: var(--ink); }
        .gs-check { margin-top: 14px; padding: 12px 16px; background: var(--tile); border-left: 4px solid var(--acid); font-size: 14px; color: var(--ink); max-width: 900px; }
        .gs-check em { font: 400 10px/1 var(--mono); letter-spacing: .16em; color: var(--ink3); font-style: normal; display: block; margin-bottom: 6px; }
        .gs-roll { display: block; width: 100%; height: 86px; }
        .gs-roll rect { fill: var(--acc); }
        .gs-roll rect.b { fill: var(--ink); }
        .gs-roll line { stroke: var(--rule); }
        .gs-names { font: 500 12px/1.4 var(--mono); letter-spacing: .06em; color: var(--ink); }
        .gs-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px 40px; margin-top: 10px; }
        .gs-two h4 { margin: 18px 0 4px; font: 400 11px/1 var(--mono); letter-spacing: .2em; color: var(--ink2); text-transform: uppercase; }
        .gs-blend { display: grid; grid-template-columns: 1fr; gap: 6px; max-width: 980px; }
        .gs-blend .chips { margin: 4px 0 8px; }
        .gs-blend .chip { padding: 7px 10px; font-size: 10px; }
        .gs-bout { background: var(--tile); padding: 16px 18px; display: grid; gap: 10px; }
        .gs-bout b { font-size: 20px; font-weight: 500; letter-spacing: -.02em; }
        .gs-bout p { margin: 0; font-size: 14px; color: var(--ink2); }
        .gs-btn { appearance: none; border: 1px solid var(--ink3); background: transparent; color: var(--ink); font: 500 11px/1 var(--mono); letter-spacing: .14em; padding: 10px 14px; cursor: pointer; justify-self: start; }
        .gs-btn.on, .gs-btn:hover { background: var(--ink); color: var(--bg, #111); }
        .gs-steps { counter-reset: s; display: grid; gap: 3px; margin-top: 18px; max-width: 900px; }
        .gs-steps div { counter-increment: s; background: var(--tile); padding: 12px 16px 12px 52px; position: relative; font-size: 14px; color: var(--ink); }
        .gs-steps div::before { content: counter(s); position: absolute; left: 16px; top: 10px; font: 500 22px/1 var(--sans); color: var(--acc); }
        .gs-steps div small { display: block; color: var(--ink2); font-size: 13px; margin-top: 3px; }
        .gs-src { margin-top: 18px; font: 400 11px/1.6 var(--mono); letter-spacing: .04em; color: var(--ink2); max-width: 900px; }
        .gs-src a { color: var(--ink2); }
      `;
      pane.append(css);

      // ---- colours: the dice's brightness ramp, pink (dark) -> violet -> blue -> teal -> green -> acid (bright)
      const col = (b) => `hsl(${Math.round(330 - b * 26) % 360} 70% ${b >= 9 ? 62 : 58}%)`;
      const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const TONIC = 0;   // the examples play in C (the page names them in C too)

      // ---- sound: a soft synth, the bass note fuller ------------------------------------------
      const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
      let playing = null;
      // GRIEF's "pad" = the song's sound: very dark (nothing above ~1 kHz), slow fade in, held, no attack.
      // DREAMCORE's "clean" = a soft picked tone that rings out.
      function note(ac, out, midi, t, dur, vel, bass, sound) {
        if (sound === "pad" || sound === "clean") return note2(ac, out, midi, t, dur, vel, bass, sound);
        const g = ac.createGain(), f = ac.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.6;
        const cut = bass ? 700 : 1800 * vel + 500; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(260, cut * 0.4), t + Math.min(0.8, dur));
        for (const [type, det] of bass ? [["triangle", 0], ["sawtooth", 0]] : [["sawtooth", -7], ["sawtooth", 7]]) { const o = ac.createOscillator(); o.type = type; o.frequency.value = hz(midi); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.3); }
        if (bass) { const s = ac.createOscillator(); s.type = "sine"; s.frequency.value = hz(midi); const sg = ac.createGain(); sg.gain.value = 0.8; s.connect(sg).connect(g); s.start(t); s.stop(t + dur + 0.3); }
        f.connect(g); g.connect(out);
        const a = bass ? 0.005 : 0.015, peak = (bass ? 0.2 : 0.085) * vel;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(peak * 0.7, t + a, 0.3);
        g.gain.setValueAtTime(peak * 0.7, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.12);
      }
      function note2(ac, out, midi, t, dur, vel, bass, sound) {
        const pad = sound === "pad", g = ac.createGain(), f = ac.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.4;
        f.frequency.setValueAtTime(pad ? (bass ? 320 : 650 + 250 * vel) : 2400 * vel + 400, t);
        if (!pad) f.frequency.exponentialRampToValueAtTime(700, t + Math.min(1.2, dur));
        const parts = pad ? [["sawtooth", -5, 0.5], ["sawtooth", 5, 0.5], ["sine", 0, 1.2]] : [["triangle", 0, 1], ["sine", 1200, 0.25]];
        for (const [type, det, lv] of parts) { const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.value = hz(midi); o.detune.value = det; og.gain.value = lv; o.connect(og).connect(f); o.start(t); o.stop(t + dur + (pad ? 1.4 : 0.6)); }
        f.connect(g); g.connect(out);
        const peak = (bass ? (pad ? 0.16 : 0.18) : pad ? 0.06 : 0.09) * vel;
        g.gain.setValueAtTime(0, t);
        if (pad) { g.gain.linearRampToValueAtTime(peak, t + 0.45); g.gain.setValueAtTime(peak, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 1.2); }
        else { g.gain.linearRampToValueAtTime(peak, t + 0.006); g.gain.setTargetAtTime(peak * 0.25, t + 0.01, 0.5); g.gain.setValueAtTime(peak * 0.25, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.4); }
      }
      // the rhythms the moods play in: [beat, length, which notes: "all" | "top" | index for broken]
      const RHY = {
        hold: [[0, 3.9, "all"]],
        swell: [[0, 3.9, "all"]],
        march: [[0, 0.8, "all"], [1, 0.5, "top"], [2, 0.8, "all"], [3, 0.5, "top"]],
        stabs: [[0, 0.45, "all"], [1.5, 0.45, "top"], [3, 0.45, "top"]],
        pulse: [[0, 0.4, "all"], [0.5, 0.35, "top"], [1, 0.4, "top"], [1.5, 0.35, "top"], [2, 0.4, "all"], [2.5, 0.35, "top"], [3, 0.4, "top"], [3.5, 0.35, "top"]],
        bounce: [[0, 0.35, "all"], [0.75, 0.3, "top"], [1.5, 0.35, "top"], [2, 0.35, "all"], [2.75, 0.3, "top"], [3.5, 0.35, "top"]],
        off: [[0, 3.9, "bass"], [0.5, 0.4, "top"], [1.5, 0.4, "top"], [2.5, 0.4, "top"], [3.5, 0.4, "top"]],
        broken: [[0, 3.9, "bass"], [0, 0.9, 1], [0.5, 0.9, 2], [1, 0.9, 3], [1.5, 0.9, 2], [2, 0.9, 1], [2.5, 0.9, 2], [3, 0.9, 3], [3.5, 0.9, 4]],
        swing: [[0, 1.5, "all"], [1.66, 0.3, "top"], [2, 1.5, "all"], [3.66, 0.3, "top"]],
      };
      // a mood's 4 chords as notes: [{ pitch, start (beats), length, vel }]
      // a core (GRIEF) can play in its song's key (m.tonic), slower (m.span beats per chord) and with a top line (m.mel)
      const TL = { on: (() => { try { return localStorage.getItem("kt2.gs.top") === "1"; } catch (e) { return false; } })() };
      const tonicOf = (m) => (m.tonic != null ? m.tonic : TONIC), spanOf = (m, B) => (!B && m.span) || 4, beatsOf = (m, ex, B) => ex.c.length * spanOf(m, B);
      function render(m, ex, blendWith) {
        const B = blendWith || null, v = m.v, rhy = RHY[(B || m).rhy] || RHY.hold, out = [], span = spanOf(m, B), T0 = B ? TONIC : tonicOf(m);
        ex.c.forEach((t, i) => {
          const p = D.parse(t);
          let V = D.voice(p.r + T0, D.Q[p.q], v);
          if (B) { const mean = V.reduce((a, x) => a + x, 0) / V.length, target = (B.v.lo + B.v.hi) / 2 - 3; const o = Math.round((target - mean) / 12) * 12; V = V.map((x) => x + o); }
          for (const [b0, len0, which] of rhy) for (let rep = 0; rep < span / 4; rep++) {
            if (span > 4 && which === "all" && rep) continue;   // a long chord is held, not hit again
            const b = b0 + rep * 4, len = span > 4 && which === "all" ? span - 0.1 : len0, at = i * span + b;
            const ps = which === "all" ? V : which === "bass" ? [V[0]] : which === "top" ? V.slice(1) : [V[Math.min(V.length - 1, which)]];
            for (const pitch of ps) out.push({ pitch, start: at, length: len, vel: which === "top" ? 0.75 : 1, bass: pitch === V[0] });
          }
        });
        const mel = !B && m.mel && m.mel[m.ex.indexOf(ex)];
        if (mel) for (const [b, len, st] of mel) out.push({ pitch: 60 + T0 + st, start: b, length: len, vel: 0.8, bass: false, mel: true });
        // TOP LINE on (the yellow button): the dice's own top line for this mood, the same code the dice runs
        else if (TL.on && D.topLine && !B) {
          const chordNs = out.filter((n) => !n.mel).map((n) => ({ pitch: n.pitch, start: n.start, length: n.length, velocity: Math.round(100 * n.vel) }));
          const segs = ex.c.map((t, i) => ({ beat: i * span, len: span, root: D.parse(t).r + T0 }));
          for (const n of D.topLine(chordNs, { mood: m.k, tonic: T0, seed: 7 + m.ex.indexOf(ex), beats: ex.c.length * span, segs })) out.push({ pitch: n.pitch, start: n.start, length: n.length, vel: 0.75, bass: false, mel: true });
        }
        return out;
      }
      function play(m, ex, el, blendWith) {
        if (playing && playing.el === el) { stop(); return; }
        stop();
        const COUT = api.bus ? api.bus(stop) : null, ac = api.audio();
        const bpm = (blendWith || m).bpm || 90, spb = 60 / bpm, t0 = ac.currentTime + 0.08;
        const master = ac.createGain(); master.gain.value = 1; const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
        master.connect(comp).connect(COUT || ac.destination);
        const ns = render(m, ex, blendWith), len = beatsOf(m, ex, blendWith), loops = len > 16 ? 1 : 2, snd = !blendWith && m.sound;
        for (let L = 0; L < loops; L++) for (const n of ns) note(ac, master, n.pitch, t0 + (L * len + n.start) * spb, n.length * spb, n.vel, n.bass, snd);
        if ((blendWith || m).rhy === "swell") for (let k = 0; k < 8; k++) { const t = t0 + k * 4 * spb; master.gain.setValueAtTime(0.15, t); master.gain.linearRampToValueAtTime(1, t + 3 * spb); }
        el.classList.add("on");
        const timer = setTimeout(stop, (loops * len * spb + (snd === "pad" ? 1.6 : 0.4)) * 1000);
        playing = { el, master, ac, out: COUT, timer };
      }
      function stop() {
        if (!playing) return;
        const P = playing; playing = null; clearTimeout(P.timer); P.el.classList.remove("on");
        if (P.out) { api.release(P.out); return; }
        try { P.master.gain.cancelScheduledValues(P.ac.currentTime); P.master.gain.setTargetAtTime(0, P.ac.currentTime, 0.03); setTimeout(() => { try { P.master.disconnect(); } catch (e) { /* gone */ } }, 300); } catch (e) { /* gone */ }
      }
      document.querySelectorAll(".bd-tab").forEach((b) => b.addEventListener("click", stop));

      // a mini piano roll of the 4 chords (one bar each), bass dark, the rest purple
      function rollSvg(m, ex, blendWith) {
        const ns = render(m, ex, blendWith), lo = Math.min(...ns.map((n) => n.pitch)) - 2, hi = Math.max(...ns.map((n) => n.pitch)) + 2, W = 320, H = 86;
        const len = beatsOf(m, ex, blendWith), bar = spanOf(m, blendWith), x = (b) => (b / len) * W, y = (p) => H - ((p - lo) / Math.max(12, hi - lo)) * (H - 4) - 3;
        let s = `<svg class="gs-roll" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`;
        for (let b = bar; b < len; b += bar) s += `<line x1="${x(b)}" x2="${x(b)}" y1="0" y2="${H}"/>`;
        for (const n of ns) s += `<rect class="${n.bass ? "b" : n.mel ? "mel" : ""}" x="${x(n.start).toFixed(1)}" y="${y(n.pitch).toFixed(1)}" width="${Math.max(2, x(n.length) - 1).toFixed(1)}" height="3"/>`;
        return s + "</svg>";
      }
      // chord names with flats, the way theory books write them (Db = bII, not C#)
      const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
      const names = (ex, m) => ex.c.map((t) => { const p = D.parse(t); return FLAT[((m ? tonicOf(m) : TONIC) + p.r) % 12] + D.QN[p.q]; }).join("  \u2013  ");

      // how the dice checks a roll, said in words
      function checkWords(m) {
        const J = m.judge, out = [];
        if (J.need) out.push("must have " + J.need.map((s) => D.SIGN[s]).join(", "));
        if (J.sig) out.push("must have at least one of: " + J.sig.map((s) => D.SIGN[s]).join(", "));
        if (J.minor != null) out.push(`at least ${Math.round(J.minor * 100)}% minor chords`);
        if (J.major != null) out.push(`at least ${Math.round(J.major * 100)}% major chords`);
        if (J.power != null) out.push(`at least ${Math.round(J.power * 100)}% power chords (no 3rd)`);
        if (J.mean) out.push(J.mean[0] ? `average note at or above ${NOTE[J.mean[0] % 12]}${Math.floor(J.mean[0] / 12) - 1}` : `average note at or below ${NOTE[J.mean[1] % 12]}${Math.floor(J.mean[1] / 12) - 1}`);
        if (J.changes) out.push(`only ${J.changes[1]} different chord${J.changes[1] > 1 ? "s" : ""} at most`);
        if (J.span) out.push(`each chord spread over ${J.span}+ semitones`);
        if (J.gap) out.push("a low note far below the rest");
        if (J.long) out.push(`notes held ${J.long}+ beats`);
        if (J.forbid) out.push("never " + J.forbid.map((s) => D.SIGN[s]).join(", "));
        return out.join(" \u00b7 ");
      }

      const CORES = D.CORES || [], ALL = D.MOODS.concat(D.EXTRA, CORES), isNew = (m) => D.EXTRA.includes(m), isCore = (m) => CORES.includes(m);

      // ================================================================ 1. the cover
      let s = slide("s-night", "Backend data", "Genre science");
      s.append(title("h1", "What makes a mood a mood.", `${D.MOODS.length} moods, dark to bright. 10 chords each. Press to hear.`));
      s.append(h("p", "lede", "Each mood has a sound you can name in music theory: its scale, the one or two notes that give it away, how low or wide the chords sit, and how they move. The dice now rolls from this page, and checks every roll against it before you hear it."));
      s.append(h("div", "spacer"));
      s.append(rows([
        ["Moods", String(D.MOODS.length), "your list from 8 Nov, darkest first"],
        ["Playable examples", String(ALL.length * 10), "10 per mood, written for the mood, checked by the same test as the dice"],
        ["Suggested new moods", String(D.EXTRA.length), D.EXTRA.map((m) => m.n).join(" \u00b7 ")],
        ...(CORES.length ? [["From your songs", String(CORES.length), CORES.map((m) => m.n).join(" \u00b7 ") + " (type the word in the dice prompt)"]] : []),
        ["Dice rolls that hit the mood", "26% \u2192 99%", "before vs after, 432 test rolls over 18 moods, 4 scales, ONLY KEY on and off"],
      ]));
      s.append(h("div", "foot", "<span>KILLTOY.studio</span><span>scroll</span>"));
      pane.append(s);

      // ================================================================ 2. the science in 6 lines
      s = slide("s-lilac", "What the research says", "");
      s.style.minHeight = "0";
      s.append(title("h2", "Six facts every mood is built on.", "From music-emotion studies and film-music theory."));
      const facts = h("div", "gs-steps");
      [["Major or minor decides most of happy vs sad.", "In listening tests the mode alone explained about half of how happy or sad music sounded; tempo came next (Eerola, Friberg & Bresin 2013)."],
        ["Scary is about LOW and STRANGE, not just minor.", "For scary music, register (how low) and unusual structure mattered more than major/minor (same study). So villain and demonic sit low and use notes outside the key."],
        ["Single chords already carry a feeling.", "Major = happiest; minor = most sad and most nostalgic; augmented = most tense; diminished = least pleasant; maj7 and m7 = most tender (Lahdelma & Eerola 2016)."],
        ["Villains have their own chord move.", "Two minor chords a major 3rd apart (Cm to Abm) signal evil in film, from Wagner to Star Wars: Scott Murphy calls it minor-8-minor. Harmonic minor's major V and the b2 (Neapolitan) do the same job."],
        ["Wonder has one too.", "Minor i to MAJOR IV (Cm to F) is the film 'fantasy fifth' for magic and wonder (Patrick 2023)."],
        ["People hear about 13 kinds of feeling in music.", "Amusing, annoying, anxious, beautiful, calm, dreamy, energizing, erotic, defiant, joyful, sad, scary, triumphant (Cowen et al. 2020). Your list covers most; sexy, defiant and tender are missing."]].forEach(([a, b]) => facts.append(h("div", "", `${esc(a)}<small>${esc(b)}</small>`)));
      s.append(facts);
      s.append(h("p", "gs-src", 'Sources: <a href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2013.00487/full" target="_blank" rel="noopener">Eerola et al. 2013</a> \u00b7 <a href="https://jyx.jyu.fi/jyx/Record/jyx_123456789_48313" target="_blank" rel="noopener">Lahdelma &amp; Eerola 2016</a> \u00b7 <a href="https://news.ku.edu/news/article/2019/02/13/score-blackkklansman-employs-evil-triad-signal" target="_blank" rel="noopener">Murphy, the evil triad</a> \u00b7 <a href="https://theory.esm.rochester.edu/integral/36-2023/patrick/" target="_blank" rel="noopener">Patrick 2023, fantasy fifth</a> \u00b7 <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6995018" target="_blank" rel="noopener">Cowen et al. 2020</a>'));
      pane.append(s);

      // ================================================================ 3. the moods
      s = slide("s-sky", "The moods", "Tap one");
      s.style.minHeight = "0";
      s.append(title("h2", "Pick a mood.", "Dashed = suggested new mood, not in the dice yet. Thick = built from your songs."));
      const strip = h("div", "gs-strip"), detail = h("div", "");
      let cur = (location.hash.match(/mood=([a-z]+)/) || [])[1] || "villain";
      for (const m of ALL.slice().sort((a, b) => a.b - b.b)) {
        const b = h("button", "gs-m" + (isNew(m) ? " new" : "") + (isCore(m) ? " core" : "") + (m.k === cur ? " on" : ""), `<b>${esc(m.n)}</b><i>${isNew(m) ? "NEW \u00b7 " : isCore(m) ? "YOUR SONGS \u00b7 " : ""}BRIGHT ${m.b}</i>`);
        b.type = "button"; b.style.setProperty("--mc", col(m.b)); b.dataset.k = m.k;
        b.onclick = () => { cur = m.k; strip.querySelectorAll(".gs-m").forEach((x) => x.classList.toggle("on", x === b)); show(); };
        strip.append(b);
      }
      s.append(strip, detail);
      function show() {
        stop();
        const m = D.byKey[cur]; detail.replaceChildren(); detail.style.setProperty("--mc", col(m.b));
        detail.append(h("div", "gs-head", `<span class="gs-dot"></span><h2>${esc(m.n)}<span>${esc(m.feel)}</span></h2>`));
        detail.append(h("p", "gs-what", esc(m.what)));
        if (m.why) detail.append(h("p", "lede", "Why add it: " + esc(m.why)));
        if (m.src) detail.append(h("p", "lede", "Built from: " + esc(m.src)));
        const C = m.cues, cues = h("div", "gs-cues");
        [["Scale", C.mode], ["Chords", C.chords], ["The notes that do it", C.notes], ["Voicing", C.voicing], ["Movement", C.motion], ["Avoid", C.avoid]].forEach(([a, b]) => cues.append(h("div", "", `<em>${a}</em><span>${esc(b)}</span>`)));
        detail.append(cues);
        detail.append(h("div", "gs-check", `<em>HOW THE DICE KNOWS IT'S ${esc(m.n)}</em>${esc(checkWords(m))}. Rolls in ${esc(m.scales.map((x) => x.toUpperCase()).join(" / "))}, around ${m.bpm} BPM.`));
        if (D.TOPS && D.TOPS[m.k]) {
          const [st, rate, why] = D.TOPS[m.k], say = { held: "HELD: one long note per chord, stepping to the next chord's note", moving: "MOVING: about 3 notes a bar, by step, landing on a chord note at each change", pedal: "PEDAL: one note repeated" + (rate >= 2 ? " slowly" : " in quarters") + " while the chords move under it", arp: "ARP: a slow turn of 3 chord notes" + (rate <= 0.5 ? " in 8ths" : rate >= 2 ? " in half notes" : " in quarters") }[st];
          const tb = h("button", "gs-topbtn" + (TL.on ? " on" : ""), "TOP LINE " + (TL.on ? "ON" : "OFF")); tb.type = "button";
          tb.onclick = () => { TL.on = !TL.on; try { localStorage.setItem("kt2.gs.top", TL.on ? "1" : "0"); } catch (e) { /* private window */ } show(); };
          const row = h("div", "gs-check gs-top", `<em>TOP LINE \u00b7 ${esc(st.toUpperCase())}</em>${esc(say)}. From ${esc(why)}. Stays under G5 so a melody on another sound still fits on top.`);
          row.prepend(tb); detail.append(row);
        }
        const grid = h("div", "dgrid");
        for (const ex of m.ex) {
          const card = h("button", "dcard"); card.type = "button";
          card.innerHTML = `<div class="dh"><div><b>${esc(ex.n)}</b></div><span class="play"><svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg></span></div>
            <div class="gs-names">${esc(names(ex, m))}</div>${rollSvg(m, ex)}<p class="about">${esc(ex.why)}</p>`;
          card.onclick = () => play(m, ex, card);
          grid.append(card);
        }
        detail.append(grid);
      }
      show();
      pane.append(s);

      // ================================================================ 3b. top line vs melody (Eman, 9 Nov 22:22)
      s = slide("s-lilac", "Top line vs melody", "From our songs");
      s.style.minHeight = "0";
      s.append(title("h2", "Most song 'melodies' are two different things.", "A TOP LINE rides on the chords. A MELODY leads."));
      s.append(rows([
        ["Songs scanned", "148", "SONG MIDI songs with real notes (the 30 sketches guessed from chord names left out)"],
        ["TOP LINE", "54", "slow, from the chords' own notes, sits ~5 semitones above them: part of the chords"],
        ["MELODY", "94", "~7 notes a bar, leaps of 4+, ~11 semitones above the chords: its own part, its own sound"],
        ["Top line styles", "MOVING 22 \u00b7 PEDAL 23 \u00b7 HELD 5 \u00b7 ARP 4", "MOVING ~3.6 notes a bar by step; PEDAL one note repeated; HELD one long note per chord; ARP a short chord-note cycle"],
        ["By sound", "dark: pedal / moving \u00b7 sad: moving \u00b7 night: moving / arp \u00b7 big: arp / pedal", "44 dark/trap, 30 sad, 6 night/ambient, 7 house/cinematic top lines. Each mood's style is on its card above."],
      ]));
      pane.append(s);

      // ================================================================ 4. blends
      s = slide("s-hero", "Blends", "Mood A but mood B");
      s.style.minHeight = "0";
      s.append(title("h2", "Villain, but playful.", "The first mood picks the chords. The second picks how they move."));
      s.append(h("p", "lede", "Harmony (which chords, which notes) is what makes a mood dark or bright. Rhythm, tempo and register are what make it calm or wild. So a blend takes the chords and their give-away notes from the first mood, and the rhythm, tempo and register from the second. Type both words in the dice prompt, like \"villain but playful\", and the dice does the same."));
      const bl = h("div", "gs-blend"), out = h("div", "gs-bout");
      let A = "villain", B = "playful";
      const opts = D.MOODS.map((m) => [m.k, m.n]);
      const ca = chips(opts, A, (v) => { A = v; blendShow(); }), cb = chips(opts, B, (v) => { B = v; blendShow(); });
      bl.append(h("div", "gs-two", `<h4>A \u00b7 the chords</h4>`), ca, h("div", "gs-two", `<h4>B \u00b7 the motion</h4>`), cb, out);
      function blendShow() {
        stop();
        const a = D.byKey[A], b = D.byKey[B], ex = a.ex[0];
        out.innerHTML = `<b>${esc(a.n)} but ${esc(b.n)}</b>
          <p>Chords from ${esc(a.n)}: ${esc(a.cues.chords)}; the give-away notes: ${esc(a.cues.notes)}.</p>
          <p>Motion from ${esc(b.n)}: ${esc(b.cues.motion)}, ${esc(b.cues.voicing.replace(/^.*?(low|mid|high)/i, "$1"))}, about ${b.bpm} BPM.</p>
          <div class="gs-names">${esc(names(ex))}</div>${A === B ? "" : rollSvg(a, ex, b)}`;
        const pb = h("button", "gs-btn", "PLAY " + esc(a.n) + " + " + esc(b.n)); pb.type = "button"; pb.onclick = () => play(a, ex, pb, A === B ? null : b);
        const pa = h("button", "gs-btn", "PLAY " + esc(a.n) + " ALONE"); pa.type = "button"; pa.onclick = () => play(a, ex, pa);
        const row = h("div", "d-tools"); row.append(pb, pa); out.append(row);
      }
      blendShow();
      s.append(bl);
      pane.append(s);

      // ================================================================ 5. the list: keep, add, merge
      s = slide("s-mist", "Your list", "Keep, add, merge");
      s.style.minHeight = "0";
      s.append(title("h2", "Keep all 18. Add 5. Two are close.", "Suggestions, nothing changed in the dice yet."));
      const two = h("div", "gs-two");
      two.append(h("div", "", `<h4>Add (missing feelings)</h4>${D.EXTRA.map((m) => `<p class="lede" style="margin-top:6px"><b>${esc(m.n)}</b> \u00b7 ${esc(m.why)}</p>`).join("")}`));
      two.append(h("div", "", `<h4>Close to each other</h4>
        <p class="lede" style="margin-top:6px"><b>AMBIENT and MEDITATIVE</b> use the same chords (sus, add9, maj7, few changes). They differ in space and time, not harmony: ambient is wider, longer, with no beat. Keep both or make AMBIENT a SPACE switch on any mood.</p>
        <p class="lede" style="margin-top:6px"><b>MONOTONE</b> is a texture more than a feeling (one chord, numb). It works as its own mood because nothing else asks for no change.</p>
        <p class="lede" style="margin-top:6px"><b>DARK, VILLAIN, DEMONIC</b> are different now: DARK = plain minor, VILLAIN = minor with a sneer note (b2, raised 7th, minor chords a major 3rd apart), DEMONIC = tritones and half steps, very low.</p>`));
      s.append(two);
      pane.append(s);

      // ================================================================ 6. how to analyse a song
      s = slide("s-ink", "How to read a song's mood", "What the dice does, by hand");
      s.style.minHeight = "0";
      s.append(title("h2", "Five questions find the mood.", "The dice asks the same ones after every roll."));
      const st = h("div", "gs-steps");
      [["Is home major or minor?", "Find the chord the loop rests on. Its 3rd (4 or 3 semitones above the root) splits bright from dark."],
        ["Which notes are outside the plain scale?", "A b2 = villain or demonic. A raised 7th over minor = villain. A #4 = psychedelic or dreamy. bVI + bVII in major = heroic. Minor to major IV = wonder."],
        ["How big and how low?", "Count the notes per chord and the average pitch. Power chords low = rage. A low note far below a thin top = lonely. Wide low-to-high = godlike or cinematic."],
        ["How often does it change, and how long do notes ring?", "One chord = monotone or meditative. Long holds = ambient, dreamy. Short fast hits = rage, playful."],
        ["Compare with the moods above.", "The mood whose must-have notes are there and whose never-notes are missing is the answer."]].forEach(([a, b]) => st.append(h("div", "", `${esc(a)}<small>${esc(b)}</small>`)));
      s.append(st);
      s.append(h("p", "gs-src", "Next step if the research isn't enough: run the same five questions over songs you know have a mood (your references, the 736k chord-brain songs) and let the numbers move the rules."));
      pane.append(s);
    },
  });
})();
