// THE DICE ROW (Eman, 8 Nov): press the little arrow next to the dice and a row of visual dials opens
// under the MIDI bar. Every dial shows what it means as a picture, not just a word: how many bars,
// how often the chord changes, the hit pattern, how many notes in each chord, how colourful, whether
// it lands home or hangs, how far from the common choices the dice may stray, pop or alternative,
// and how high it sits.
// Every dial starts on AUTO: the songs behind the prompt's words choose (ui/chord-brain.js auto()),
// and the dial shows what they chose, dimmed. Pick a value to pin it; press AUTO to hand it back.
// The dice reads the row together with the PROMPT box: words pick the songs it learns from, the
// dials shape what it writes.
//
// The dials were chosen from what the chord tools people use agree on (Scaler, Captain Chords, Orb,
// Chordjam, Ableton Live 12's Seed/Rhythm/Stacks, Logic's Session Players): key, length, harmonic
// rhythm (pace), rhythm pattern, voicing size, colour/extensions, tension, randomness, range; plus
// POP <-> ALT, which only a song database can offer.
//
// window.TmDice = { mount(pane, hooks), get(text, part), setPart(pane, part), toggle(pane, on?), isOpen() }
// KT2_DICE_ROW_OLD = no arrow, no row (the dice rolls as before).
(() => {
  const STORE = "kt2.diceRow";
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } };
  const save = (d) => { if (d && d === window.__tmdST) keepOwnerStack(d); try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {} };
  // CHORD SIZE PER TOY MACHINE (Eman, 11 Nov 20:39: "when opening a new Toy machine or new project it will be default 3"):
  // a chord size dragged up belongs to that TOY MACHINE in that project; another one (or a new project) starts on AUTO,
  // which is 3 notes. KT2_DICE_STACK_PER_OLD = one chord size for every TOY MACHINE, as before
  const ownerOn = () => !window.KT2_DICE_STACK_PER_OLD;
  let OWNER = null;   // () => "<project>|<lane>" of the TOY MACHINE open now (hooks.owner)
  function keepOwnerStack(d) {
    if (!ownerOn() || d.owner == null) return;
    const by = d.stackBy || (d.stackBy = {});
    if (d.voices == null && d.colour == null) delete by[d.owner]; else { delete by[d.owner]; by[d.owner] = { v: d.voices, c: d.colour }; }
    const ks = Object.keys(by); if (ks.length > 300) for (const k of ks.slice(0, ks.length - 300)) delete by[k];
  }
  function syncOwner() {
    if (!ownerOn() || !OWNER) return;
    let k = null; try { k = OWNER(); } catch (e) { return; }
    if (k == null || k === ST.owner) return;
    if (ST.owner != null) keepOwnerStack(ST);
    ST.owner = k; const s = (ST.stackBy || {})[k]; ST.voices = s ? s.v : null; ST.colour = s ? s.c : null; save(ST);
  }
  const DIALS = ["bars", "pace", "rhythm", "voices", "colour", "tension", "random", "alt", "range", "dens", "swing", "full"];
  const ST = { open: false, ...load() };   // a dial missing or null = AUTO
  window.__tmdST = ST;
  // what AUTO falls back to when the brain hasn't loaded
  const FALLBACK = { bars: 4, pace: 1, rhythm: 0, voices: 3, colour: 0.3, tension: 0.3, random: 0.3, pop: 0.5, range: 1, dens: 1, swing: 0 };

  // ---- pictures ---------------------------------------------------------------------------------
  const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;
  const rect = (x, y, w, h, f, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${o ? ` fill-opacity="${o}"` : ""}/>`;
  // bars: n blocks in a 44px strip (1 = one wide block, 8 = eight thin)
  const picBars = (n) => { const w = 44, gap = n > 4 ? 1.5 : 2, bw = (w - gap * (n - 1)) / n; let s = ""; for (let i = 0; i < n; i++) s += rect(i * (bw + gap), 2, bw, 10, "currentColor"); return svg(w, 14, s); };
  // pace: how many chords across two bars (1 = one chord over two bars ... 4 = a chord every beat)
  const picPace = (k) => { const segs = [1, 2, 4, 8][k], w = 44, gap = 1.5, bw = (w - gap * (segs - 1)) / segs; let s = rect(0, 11, w, 1, "currentColor", 0.35) + rect(22, 9, 1, 5, "currentColor", 0.5); for (let i = 0; i < segs; i++) s += rect(i * (bw + gap), 2 + (i % 2) * 2, bw, 6, "currentColor"); return svg(w, 14, s); };
  // rhythm: the hits inside one bar (16 slots)
  const RHY = [
    { k: "hold", n: "HOLD", hits: [[0, 16]] },
    { k: "pulse", n: "PULSE", hits: [[0, 3.5], [4, 3.5], [8, 3.5], [12, 3.5]] },
    { k: "stabs", n: "STABS", hits: [[0, 2.5], [6, 2.5], [12, 2.5]] },
    { k: "off", n: "OFF", hits: [[2, 1.6], [6, 1.6], [10, 1.6], [14, 1.6]] },
    { k: "broken", n: "BROKEN", hits: [[0, 1.6, 0], [2, 1.6, 1], [4, 1.6, 2], [6, 1.6, 1], [8, 1.6, 0], [10, 1.6, 1], [12, 1.6, 2], [14, 1.6, 1]] },
  ];
  const picRhy = (r) => { const w = 44, u = w / 16; let s = rect(0, 12, w, 1, "currentColor", 0.35); for (const [a, l, row] of r.hits) s += rect(a * u, row == null ? 3 : 9 - row * 3, l * u, row == null ? 7 : 2.4, "currentColor"); return svg(w, 14, s); };
  const SWING_PIC = (v) => picRhy({ hits: [[0, 1.8], [4, 1.8], [8, 1.8], [12, 1.8], [2 + v * 0.6, 1.2], [6 + v * 0.6, 1.2], [10 + v * 0.6, 1.2], [14 + v * 0.6, 1.2]] });
  // voices: stacked notes
  const picVoices = (n) => { let s = ""; const ys = [12, 9, 6, 3, 0]; for (let i = 0; i < n; i++) s += rect(i % 2 ? 7 : 2, ys[i] + 1, 12, 2.2, "currentColor"); return svg(22, 15, s); };
  // range: a little keyboard with the lit zone
  const picRange = (k) => { let s = ""; for (let i = 0; i < 14; i++) s += rect(i * 3.2, 0, 2.6, 12, "currentColor", 0.22); s += rect([0, 14, 29][k], 0, 15, 12, "currentColor"); return svg(45, 12, s); };
  // density (melody / bass / arp): notes across a bar
  const picDens = (k) => { const n = [2, 4, 8, 16][k], w = 44, step = w / n; let s = rect(0, 12, w, 1, "currentColor", 0.35); for (let i = 0; i < n; i++) s += rect(i * step, 2 + ((i * 5) % 3) * 2.5, Math.max(1.4, step * 0.6), 2.4, "currentColor"); return svg(w, 14, s); };
  // tension: a line that lands (0) or hangs (1)
  const picTension = (t) => { const end = 12 - t * 10; return svg(44, 14, `<path d="M1 12 C 10 12, 12 3, 20 3 S 30 ${6 + t * 2}, 43 ${end}" fill="none" stroke="currentColor" stroke-width="2"/>${rect(0, 12.5, 44, 0.8, "currentColor", 0.35)}`); };
  // random: dice pips 1..6
  const picRandom = (r) => { const n = 1 + Math.round(r * 5), pos = [[7, 7], [3, 3], [11, 11], [11, 3], [3, 11], [3, 7], [11, 7]]; const use = n === 1 ? [pos[0]] : n === 2 ? [pos[1], pos[2]] : n === 3 ? [pos[0], pos[1], pos[2]] : n === 4 ? pos.slice(1, 5) : n === 5 ? pos.slice(0, 5) : pos.slice(1); return svg(14, 14, `<rect x="0.5" y="0.5" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1"/>` + use.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="currentColor"/>`).join("")); };
  // colour: how many notes the chord stacks, as a glowing stack
  const picColour = (c) => { const n = 2 + Math.round(c * 4); let s = ""; for (let i = 0; i < 6; i++) s += rect(i * 7, 0, 5.5, 12, "currentColor", i < n ? 1 : 0.18); return svg(42, 12, s); };
  // pop <-> alt: the chord moves sorted by how common they are; pop lights the common (tall) ones, alt the rare ones
  const picAlt = (a) => { if (a > 1.01) { const ys = [3, 9, 1, 7, 4, 10, 2]; let s = ""; for (let i = 0; i < 7; i++) s += rect(i * 6.2, ys[i] * 0.8, 5, 3.4 + (i % 3) * 1.6, i % 2 ? "#e4ff3a" : "currentColor"); return svg(44, 12, s); }   // EXPERIMENTAL: the bars scattered
    const hs = [12, 10, 8, 6, 4.5, 3, 2]; let s = ""; const lit = a < 0.5 ? (i) => i < 1 + (1 - a * 2) * 3 : (i) => i >= 6 - (a - 0.5) * 2 * 4; for (let i = 0; i < 7; i++) s += rect(i * 6.2, 12 - hs[i], 5, hs[i], "currentColor", lit(i) || Math.abs(a - 0.5) < 0.08 && i >= 2 && i <= 4 ? 1 : 0.2); return svg(44, 12, s); };
  // FULL (Eman, 8 Nov): when locked notes fill the clip the dice can only add to them. Three ways, as pictures:
  // a chord extension (a new note on top), an added tone (a note inside), a voicing (the same notes, spread wider)
  const picFull = (k) => { const blk = (y, o, f) => rect(2, y, 16, 2.4, f || "currentColor", o); const base = blk(12) + blk(8) + blk(4);
    if (k === "ext") return svg(20, 16, base + rect(6, 0, 12, 2.4, "#e4ff3a"));
    if (k === "add") return svg(20, 16, blk(12) + blk(4) + rect(4, 8, 12, 2.4, "#e4ff3a") + rect(2, 8, 2, 2.4, "currentColor", 0.35));
    return svg(20, 16, blk(14) + rect(2, 7, 16, 2.4, "#e4ff3a") + blk(0)); };
  const FULL_ITEMS = [{ v: "ext", n: "EXTENSION", t: "A chord extension: a 7th, 9th or 11th on top" }, { v: "add", n: "ADDED TONE", t: "An added tone: a 6th, 2nd or 4th inside" }, { v: "voice", n: "VOICING", t: "A wider voicing: the root doubled on top or under" }];
  const COLOUR_N = ["PLAIN", "SOFT", "7THS", "9THS", "RICH", "SPICY"];
  const TENSION_N = ["LANDS", "LEANS", "OPEN", "HANGS", "TENSE"];
  const RANDOM_N = ["SAFE", "USUAL", "LOOSE", "WILD", "CHAOS"];
  const ALT_N = ["POP", "RADIO", "MIDDLE", "LEFTFIELD", "RARE", "ALT"];   // 6 steps since 9 Nov (ALTERNATIVE at the far end)
  const SL = { colour: [COLOUR_N, picColour], tension: [TENSION_N, picTension], random: [RANDOM_N, picRandom], alt: [ALT_N, picAlt] };

  // ---- MOOD (Eman, 9 Nov 00:00: the 18 moods, /mnt/project-files/killtoy/kt2/research/moods-17.md) ---------------
  // One card, ordered from the darkest mood to the brightest, so dragging right = brighter. A mood does two things:
  // its words join the prompt's words (the songs behind them pick the chords), and it leans every dial still on AUTO
  // its own way (Rage = power chords low and fast, Dreamy = 5-note chords high and slow). Pinned dials still win.
  // ST.mood = index into MOODS, null = AUTO (the prompt alone). KT2_DICE_MOOD_OFF = no card, no mood.
  // lean: pace 0..3 (2 bars .. beat), rhythm 0..4 (hold pulse stabs off broken), voices 2..5, range 0..2, colour/tension/random/alt 0..1
  const MOODS = [
    { k: "demonic", n: "DEMONIC", b: 0, w: "demonic evil dark horror", feel: "Unholy, inhuman, ritual", lean: { pace: 0, rhythm: 0, voices: 3, range: 0, colour: 0.1, tension: 0.95, random: 0.5, alt: 0.8 } },
    { k: "rage", n: "RAGE", b: 1, w: "aggressive angry metal trap", feel: "Explosive anger, out of control", lean: { pace: 2, rhythm: 1, voices: 2, range: 0, colour: 0, tension: 0.6, random: 0.3 } },
    { k: "villain", n: "VILLAIN", b: 1, w: "villain evil dark", feel: "Evil on purpose: powerful, in control", lean: { pace: 1, rhythm: 2, voices: 3, range: 0, colour: 0.15, tension: 0.7, random: 0.25 } },
    { k: "dark", n: "DARK", b: 2, w: "dark heavy", feel: "Heavy, shadowy, serious", lean: { pace: 0, rhythm: 0, voices: 3, range: 0, colour: 0.1, tension: 0.55 } },
    { k: "unease", n: "UNEASE", b: 2, w: "tense eerie anxious", feel: "Something is wrong, can't relax", lean: { pace: 2, rhythm: 3, voices: 4, range: 1, colour: 0.6, tension: 1, random: 0.7, alt: 0.85 } },
    { k: "sad", n: "SAD", b: 3, w: "sad", feel: "Crying, heavy heart, open grief", lean: { pace: 1, rhythm: 0, voices: 4, range: 1, colour: 0.4, tension: 0.1 } },
    { k: "suspense", n: "SUSPENSE", b: 3, w: "tense suspense cinematic", feel: "Something is about to happen", lean: { pace: 0, rhythm: 1, voices: 3, range: 1, colour: 0.3, tension: 0.9 } },
    { k: "lonely", n: "LONELY", b: 4, w: "lonely sad ambient", feel: "Empty room, missing someone", lean: { pace: 0, rhythm: 0, voices: 3, range: 2, colour: 0.55, tension: 0.4 } },
    { k: "godlike", n: "GODLIKE", b: 4, w: "epic church gospel dark cinematic", feel: "Huge, holy and dangerous at once", lean: { pace: 0, rhythm: 0, voices: 5, range: 1, colour: 0.3, tension: 0.3, alt: 0.3 } },
    { k: "monotone", n: "MONOTONE", b: 5, w: "minimal hypnotic techno", feel: "Nothingness: cold, powerful or numb", lean: { pace: 0, rhythm: 1, voices: 2, range: 1, colour: 0, tension: 0.5, random: 0 } },
    { k: "cinematic", n: "CINEMATIC", b: 5, w: "cinematic epic", feel: "A big scene telling a story", lean: { pace: 0, rhythm: 0, voices: 5, range: 1, colour: 0.4, tension: 0.5 } },
    { k: "psychedelic", n: "PSYCHEDELIC", b: 5, w: "psychedelic dreamy", feel: "Melting, colours shifting", lean: { pace: 1, rhythm: 4, voices: 4, range: 1, colour: 0.7, tension: 0.5, random: 0.7, alt: 0.8 } },
    { k: "ambient", n: "AMBIENT", b: 6, w: "ambient", feel: "A space you sit inside, weightless", lean: { pace: 0, rhythm: 0, voices: 5, range: 1, colour: 0.7, tension: 0.5 } },
    { k: "meditative", n: "MEDITATIVE", b: 6, w: "meditative ambient chill", feel: "Calm, breathing, still but warm", lean: { pace: 0, rhythm: 0, voices: 3, range: 1, colour: 0.5, tension: 0.3, random: 0 } },
    { k: "dreamy", n: "DREAMY", b: 7, w: "dreamy", feel: "Floating, soft focus, half asleep", lean: { pace: 1, rhythm: 0, voices: 5, range: 2, colour: 0.85, tension: 0.55 } },
    { k: "heroic", n: "HEROIC", b: 8, w: "epic heroic triumphant cinematic", feel: "Standing up, marching forward, winning", lean: { pace: 1, rhythm: 1, voices: 3, range: 1, colour: 0.2, tension: 0.2 } },
    { k: "playful", n: "PLAYFUL", b: 9, w: "happy groovy playful", feel: "Cheeky, bouncy, a smile with a wink", lean: { pace: 2, rhythm: 2, voices: 4, range: 2, colour: 0.55, tension: 0.3 } },
    { k: "euphoric", n: "EUPHORIC", b: 10, w: "euphoric happy", feel: "Hands in the air, peak of the night", lean: { pace: 1, rhythm: 1, voices: 5, range: 2, colour: 0.5, tension: 0.15 } },
  ];
  // STYLE card (Eman, 14 Nov): the dark-to-bright MOOD card is gone for now; in its place CLEAN (just the chords) or
  // CHORD TOP LINE (little notes that fill the chords and leave room for a vocal), and BASS (the bass notes an octave
  // under the chords, off by default). KT2_DICE_STYLE_OLD = the MOOD card back, TOP LINE under MORE
  const styleOn = () => !window.KT2_DICE_STYLE_OLD;
  const moodOn = () => !window.KT2_DICE_MOOD_OFF && !styleOn();
  const topOn = () => !window.KT2_TOPLINE_OFF && !!(window.KT2MoodDNA && KT2MoodDNA.topLine);
  const moodNow = () => (moodOn() && ST.mood != null && MOODS[ST.mood] ? MOODS[ST.mood] : null);
  // the words the songs are picked by: the prompt plus the mood's own
  const withMood = (text) => { const m = moodNow(); return m ? ((text || "").trim() + " " + m.w).trim() : (text || ""); };
  // the mood's colour: from near-black red-purple (0) through KILLTOY purple to acid yellow (10)
  const moodCol = (b) => { const t = b / 10, L = [[76, 44, 120], [139, 92, 246], [196, 181, 253], [228, 255, 58]], x = t * 3, i = Math.min(2, Math.floor(x)), f = x - i; return "rgb(" + L[i].map((c, j) => Math.round(c + (L[i + 1][j] - c) * f)).join(",") + ")"; };
  // the card's picture: the dark-to-bright strip with the mood's place lit (AUTO = an empty strip)
  const picMood = (i) => { const w = 88, n = MOODS.length, u = w / n; let s = ""; for (let k = 0; k < n; k++) s += rect(k * u + 0.3, k === i ? 0 : 10, u - 0.6, k === i ? 28 : 12, moodCol(MOODS[k].b), k === i || i == null ? 1 : 0.45); return svg(w, 28, s); };   // tall enough for the two-row MOOD box

  // MOOD DICE + LOCK (Eman's pick from the mood tools page, 9 Nov): a small dice on the MOOD card rolls a new mood
  // (and new chords from it); the lock says whether ROLL keeps the mood (locked, the default: as before) or picks a new
  // one every roll (open). KT2_DICE_MOODDICE_OFF = no buttons
  const moodDiceOn = () => moodOn() && !window.KT2_DICE_MOODDICE_OFF;
  const lockSvg = (open) => `<svg viewBox="0 0 12 14" width="10" height="12" aria-hidden="true"><path d="${open ? "M3 6V4a3 3 0 0 1 6 0" : "M3 6V4a3 3 0 0 1 6 0v2"}" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="1" y="6" width="10" height="7.5" fill="currentColor"/></svg>`;
  const diceSvg = `<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><rect x="0.8" y="0.8" width="12.4" height="12.4" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="4" cy="4" r="1.3" fill="currentColor"/><circle cx="7" cy="7" r="1.3" fill="currentColor"/><circle cx="10" cy="10" r="1.3" fill="currentColor"/></svg>`;
  const moodBtns = () => `<span class="tmd-mbtns"><button type="button" class="tmd-mbtn tmd-mdice" title="Roll a new mood">${diceSvg}</button><button type="button" class="tmd-mbtn tmd-mlock${ST.moodFree ? " open" : ""}" aria-pressed="${!ST.moodFree}" title="${ST.moodFree ? "Open: every ROLL picks a new mood" : "Locked: ROLL keeps this mood"}">${lockSvg(!!ST.moodFree)}</button></span>`;
  // a new mood, never the one there now; near the current one half the time so it feels like a step, not a jump
  const randomMood = () => { const cur = ST.mood; let i; for (let t = 0; t < 20; t++) { i = cur != null && Math.random() < 0.5 ? cur + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3)) : Math.floor(Math.random() * MOODS.length); if (i >= 0 && i < MOODS.length && i !== cur) break; } return Math.max(0, Math.min(MOODS.length - 1, i)); };
  const beforeRoll = () => { if (moodDiceOn() && ST.moodFree) { ST.mood = randomMood(); save(ST); } };

  // ---- resolving AUTO -----------------------------------------------------------------------------
  // the values the dice will use: what Eman pinned, else what the brain picks for this prompt
  function resolve(text, part) {
    const A = window.ChordBrain && ChordBrain.data && ChordBrain.data().profiles ? ChordBrain.auto(withMood(text), part || "chords") : { ...FALLBACK };
    // MOOD DNA (ui/kt2-mood-dna.js): a mood word in the prompt counts like the MOOD card when the card is on AUTO, the
    // mood's own science sets the shape dials, and a second mood word ("villain but playful") gives the motion
    const DNA = window.KT2MoodDNA && KT2MoodDNA.on() ? KT2MoodDNA : null, words = DNA ? DNA.moodsIn(text) : [];
    const M = moodNow() || (DNA && words[0] ? MOODS.find((x) => x.k === words[0]) || (DNA.byKey[words[0]] && DNA.byKey[words[0]].core ? { k: words[0], lean: {} } : null) : null);   // a core (GRIEF, DREAMCORE) is typed, not on the card
    if (M) for (const [d, v] of Object.entries(M.lean)) { if (d === "alt") A.pop = 1 - v; else A[d] = v; }   // the mood leans the AUTO dials
    if (M && DNA && DNA.byKey[M.k]) { Object.assign(A, DNA.byKey[M.k].lean); const b2 = words.find((k) => k !== M.k), B = b2 && DNA.byKey[b2]; if (B) for (const d of ["pace", "rhythm", "range"]) A[d] = B.lean[d]; }
    syncOwner();
    const V = {}, isAuto = {}, SIM = simpleOn(), plain = SIM && !(text || "").trim() && !M;   // no prompt, no mood: the simple start
    for (const d of DIALS) {
      const autoV = d === "alt" ? 1 - (A.pop == null ? 0.5 : A.pop) : A[d];
      isAuto[d] = ST[d] == null || (SIM && GONE.includes(d));
      V[d] = d === "full" ? (isAuto[d] ? null : ST[d]) : isAuto[d] ? (autoV == null ? FALLBACK[d] : autoV) : ST[d];
    }
    if (plain) { if (isAuto.pace) V.pace = 1; if (isAuto.rhythm) V.rhythm = 0; if (isAuto.voices) V.voices = 3; if (isAuto.colour) V.colour = 0; }   // one chord per bar, one hit each, 3 notes (Eman 23:12)
    // 3 NOTES BY DEFAULT (Eman, 11 Nov 20:39: "the chord dice makes 3 notes per chord, not 5"): CHORD SIZE on AUTO is PLAIN
    // whatever the mood or prompt; drag the card up for 7THS / 9THS / SPICY. KT2_DICE_STACK3_OLD = the mood picks the size
    if (SIM && (part || "chords") === "chords" && !window.KT2_DICE_STACK3_OLD && isAuto.voices && isAuto.colour) { V.voices = 3; V.colour = 0; }
    // locked chords there (Eman, 15 Nov): CHORD SIZE on AUTO = their size, so the new chords match and the card says so
    if (SIM && (part || "chords") === "chords" && !window.KT2_DICE_CONT_OFF && isAuto.voices && isAuto.colour && window.KT2LockSize) { const ln = KT2LockSize(); if (ln >= 2) { const st = STACK.find((x) => x.v === Math.min(6, ln)); if (st) { V.voices = st.v; V.colour = st.c; } } }
    // LENGTH: null = each rhythm's own lengths (a prompt on AUTO); the simple start holds (LEGATO)
    isAuto.len = !SIM || ST.len == null; V.len = !SIM ? null : isAuto.len ? (plain ? 3 : null) : ST.len;
    if (SIM && isAuto.len && lensOn() && ST.hits && ST.hitLen) V.len = null;   // own lengths ring as drawn (NOTE ROW too)   // a rhythm from the list rings as in the songs
    V.mood = moodNow() ? ST.mood : null; isAuto.mood = V.mood == null;
    V.stack = stackIdx(V.voices, V.colour); isAuto.stack = isAuto.voices && isAuto.colour;
    if (toolsOn()) { const TA = KT2DiceTools.auto(M && M.k); for (const k of TOOLK) { isAuto[k] = ST[k] == null || (SIM && GONE.includes(k)); V[k] = isAuto[k] ? TA[k] : ST[k]; } }
    // ...and on AUTO no extra notes stacked onto the chord either (OCTAVES doubles, a RUB): the chord stays at its size.
    // Pick them in the OCT menu / under MORE to add them. KT2_DICE_STACK3_OLD = the mood adds them
    if (toolsOn() && SIM && (part || "chords") === "chords" && !window.KT2_DICE_STACK3_OLD) for (const k of window.KT2_DICE_NOBASS_OLD ? ["octaves", "rub"] : ["octaves", "rub", "bass"]) if (isAuto[k]) V[k] = 0;   // no bass note under the chords on AUTO (Eman 23:58)
    return { V, isAuto, A, plain };
  }

  // ---- the row ----------------------------------------------------------------------------------
  const ROWS = new WeakMap();   // pane -> { el, hooks, part }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const AUTO_BTN = (on, lbl) => `<button type="button" class="tmd-chip tmd-auto${on ? " on" : ""}" data-auto="1" aria-pressed="${on}" title="AUTO: the songs behind the prompt choose ${esc(lbl.toLowerCase())}">AUTO</button>`;
  function chips(id, items, cur, auto, lbl, title) {
    return `<div class="tmd-dial${auto ? " is-auto" : ""}" data-dial="${id}" title="${esc(title || "")}"><span class="tmd-lbl">${lbl}</span><div class="tmd-chips">${AUTO_BTN(auto, lbl)}${items.map((it) => { const on = String(it.v) === String(cur); return `<button type="button" data-v="${it.v}" class="tmd-chip${on ? (auto ? " ghost" : " on") : ""}" aria-pressed="${on && !auto}" title="${esc(it.t || it.n)}">${it.pic || ""}<span>${it.n}</span></button>`; }).join("")}</div></div>`;
  }
  function slider(id, val, auto, lbl, title) {
    const [names, pic] = SL[id], i = Math.min(names.length - 1, Math.round(val * (names.length - 1)));
    return `<div class="tmd-dial tmd-sl${auto ? " is-auto" : ""}" data-dial="${id}" title="${esc(title || "")}"><span class="tmd-lbl">${lbl}</span><div class="tmd-slide">${AUTO_BTN(auto, lbl)}<span class="tmd-pic">${pic(val)}</span><input type="range" min="0" max="100" value="${Math.round(val * 100)}" style="--p:${Math.round(val * 100)}%" aria-label="${lbl}"><span class="tmd-val">${names[i]}</span></div></div>`;
  }
  // ---- PICTURE CARDS (Eman, 8 Nov 23:14, picked look 1 of 15) ------------------------------------
  // Every setting is a rounded card: the value big on top, its picture, the name under it. Drag sideways or
  // scroll on a card to change it (the notes there change live with DICE LIVE), tap = next value,
  // double-click = AUTO. The RHYTHM card's 16 dots are the hits of one bar: tap a dot to fill or empty it.
  // FILL on the RHYTHM card stretches each chord to the next hit (no gaps). KT2_DICE_CARDS_OFF = the old chips.
  const OPTS = {
    pace: ["2 BARS", "1 BAR", "HALF", "BEAT"], rhythm: RHY.map((r) => r.n), voices: ["2", "3", "4", "5"], range: window.KT2_DICE_VOICING_OLD ? ["LOW", "MID", "HIGH"] : ["DEEP", "MID", "AIRY"],   // Eman 9 Nov: re-voices the same chords, not octaves
    dens: ["FEW", "SOME", "MANY", "RUNS"], swing: ["STRAIGHT", "SWING", "HEAVY"],
  };
  const OFFS = { voices: 2 };   // voices 2..5 are stored as the number
  // names that say what the card does (Eman, 8 Nov 23:18: "DARK" said nothing)
  const NAMES = { len: "Length", mood: "Mood", stack: "Chord size", pace: "Chord every", rhythm: "Rhythm", voices: "Notes per chord", range: window.KT2_DICE_VOICING_OLD ? "Pitch" : "Voicing", dens: "Notes", swing: "Feel", colour: "Extra notes", tension: "Ending", random: "Surprise", alt: "Common \u2194 Alternative" };
  const CARDV = { pace: ["2 BARS", "BAR", "HALF BAR", "BEAT"], tension: ["LANDS HOME", "ALMOST HOME", "OPEN", "HANGS", "UNRESOLVED"], random: ["NONE", "A LITTLE", "SOME", "A LOT", "CHAOS"], alt: ["POP", "RADIO", "MIDDLE", "LEFTFIELD", "RARE", "ALTERNATIVE", "EXPERIMENTAL"], range: window.KT2_DICE_VOICING_OLD ? ["OCTAVE DOWN", "MIDDLE", "OCTAVE UP"] : ["DEEP", "MID", "AIRY"] };   // Pitch in octaves (Eman, 9 Nov 00:02)
  // CHORD SIZE (Eman, 9 Nov 00:03): "Notes per chord" and "Extra notes" fought each other (9THS with 3 notes lost its colour,
  // PLAIN with 5 notes only doubled), so they are one card now. Each step sets both: how many notes and which ones.
  // KT2_DICE_STACK_OLD = the two old cards
  // STACKED (Eman, 11 Nov 23:58: "instead of PLAIN say 3 stacked, then 4, 5, 6 stacked ... you can also go down to 2"):
  // the card counts the notes in each chord, stacked close on top of each other, nothing added under it.
  // KT2_DICE_STACKN_OLD = POWER / PLAIN / 7THS / 9THS / SPICY
  const STACK = window.KT2_DICE_STACKN_OLD ? [
    { n: "POWER", v: 2, c: 0, t: "Root and fifth only" },
    { n: "PLAIN", v: 3, c: 0, t: "Three-note chords, no colour" },
    { n: "7THS", v: 4, c: 0.45, t: "Four notes: the 7th on top" },
    { n: "9THS", v: 5, c: 0.7, t: "Five notes: the 7th and the 9th" },
    { n: "SPICY", v: 5, c: 1, t: "Five notes, the richest colours: 9ths, 11ths, sus and borrowed chords" },
  ] : [
    { n: "2 STACKED", v: 2, c: 0, t: "Two notes: root and fifth" },
    { n: "3 STACKED", v: 3, c: 0, t: "Three notes: the plain chord" },
    { n: "4 STACKED", v: 4, c: 0.45, t: "Four notes: one more on top (the 7th)" },
    { n: "5 STACKED", v: 5, c: 0.7, t: "Five notes: two more on top (7th and 9th)" },
    { n: "6 STACKED", v: 6, c: 1, t: "Six notes: the fullest stack" },
  ];
  const stackOn = () => !window.KT2_DICE_STACK_OLD;
  const stackIdx = (v, c) => { if (v <= 2) return 0; let best = 1, bd = 9; STACK.forEach((s, i) => { if (!i) return; const d = Math.abs(s.v - v) + Math.abs(s.c - c) * 3; if (d < bd) { bd = d; best = i; } }); return best; };
  const picStack = (i) => { let s = ""; const n = STACK[i].v; if (!window.KT2_DICE_STACKN_OLD) { for (let k = 0; k < n; k++) s += rect(2, 19.5 - k * 3.8, 22, 2.2, "currentColor"); return svg(26, 22, s); } const ys = [12, 9, 6, 3, 0]; for (let k = 0; k < n; k++) s += rect(k % 2 ? 7 : 2, ys[k] + 1, 12, 2.2, i === 4 && k >= 3 ? "#e4ff3a" : "currentColor"); return svg(22, 15, s); };   // a straight stack of n notes
  // ---- SIMPLE PANEL (Eman, 10 Nov 22:49: "too many envelopes inside the chord dice") ---------------------------
  // The main row is MOOD, CHORD EVERY, RHYTHM, LENGTH, CHORD SIZE, VOICING, ROLL. LENGTH is new: how long each hit
  // rings (SHORT, HALF, LONG, LEGATO = every note holds to the next hit, so a fast rhythm stays connected); it replaces
  // the FILL button. Ending, Common/Alt, Bass, Lift, Rub and TOP fold under MORE. Surprise, Spread, Motion and Shape
  // have no card any more and always follow the mood (AUTO). Octaves is a small menu in the top bar.
  // Everything starts on AUTO: the prompt and mood choose; with no prompt and no mood AUTO is the simple start, one
  // chord per bar, held (Eman 22:51). KT2_DICE_SIMPLE_OFF = the old panel.
  const simpleOn = () => !window.KT2_DICE_SIMPLE_OFF && !window.KT2_DICE_CARDS_OFF;
  const LEN_N = ["SHORT", "HALF", "LONG", "LEGATO"];
  const LEN_F = [0.25, 0.5, 0.9, 1];
  const picLen = (i) => { const w = 44, u = w / 4; let s = rect(0, 12, w, 1, "currentColor", 0.35); for (let k = 0; k < 4; k++) s += rect(k * u, 3, Math.max(1.5, u * LEN_F[i] - (i === 3 ? 0 : 0.8)), 7, i === 3 ? "#e4ff3a" : "currentColor"); return svg(w, 14, s); };
  const GONE = ["random", "spread", "motion", "shape"];   // no card in the simple panel: always AUTO (the mood's own pick)
  const MORE = ["tension", "alt", "bass", "lift", "rub"];
  // ---- MOOD TOOLS (Eman, 9 Nov 00:07; ui/kt2-dice-tools.js): a row of 7 small cards under the dice cards (chords) ----
  // BASS, SPREAD, LIFT, RUB, MOTION, SHAPE, OCTAVES. AUTO = the mood's own choice (none without a mood).
  // KT2_DICE_TOOLS_OFF = no row, no changes
  const toolsOn = () => !window.KT2_DICE_TOOLS_OFF && !!window.KT2DiceTools;
  const TOOLK = ["bass", "spread", "lift", "rub", "motion", "shape", "octaves"];
  const TOOL = (d) => (window.KT2DiceTools ? KT2DiceTools.TOOLS.find((t) => t.k === d) : null);
  const isTool = (d) => TOOLK.includes(d) && !!TOOL(d);
  const ACID = "#e4ff3a";
  const TPIC = {
    bass: (i) => { let s = rect(2, 0, 14, 2.2, "currentColor", 0.45) + rect(2, 3.5, 14, 2.2, "currentColor", 0.45) + rect(24, 1, 14, 2.2, "currentColor", 0.45) + rect(24, 4.5, 14, 2.2, "currentColor", 0.45);
      if (i === 1) s += rect(2, 11, 14, 2.4, ACID) + rect(24, 10, 14, 2.4, ACID);
      if (i === 2) for (let k = 0; k < 8; k++) s += rect(k * 5 + 1, k % 2 ? 8 : 11.5, 3.4, 2.4, ACID);
      if (i === 3) s += rect(2, 11, 36, 2.4, ACID);
      if (i === 4) s += rect(2, 11.5, 10, 2.4, ACID) + rect(13, 10, 3, 2.4, ACID) + rect(24, 8.5, 10, 2.4, ACID) + rect(35, 10, 3, 2.4, ACID);
      if (i === 5) s += rect(2, 13.6, 14, 2.4, ACID) + rect(24, 12.6, 14, 2.4, ACID) + rect(0, 9.5, 40, 0.8, "currentColor", 0.3);
      return svg(40, 16, s); },
    spread: (i) => { const ys = [[9, 6.5, 4], [11, 6, 1], [13, 6.5, 0]][i]; return svg(22, 16, ys.map((y, k) => rect(k % 2 ? 7 : 3, y, 12, 2.4, "currentColor")).join("")); },
    lift: (i) => { const lit = [[], [2, 3], [2], [3], [1]][i]; let s = ""; for (let k = 0; k < 4; k++) s += rect(k * 10 + 1, lit.includes(k) ? 1 : 6, 8, lit.includes(k) ? 13 : 8, lit.includes(k) ? ACID : "currentColor", lit.includes(k) ? 1 : 0.45); return svg(40, 15, s); },
    rub: (i) => { let s = rect(3, 12, 14, 2.4, "currentColor") + rect(3, 7, 14, 2.4, "currentColor") + rect(3, 2, 14, 2.4, "currentColor"); if (i === 1) s += rect(7, 5.2, 14, 2.4, ACID); if (i === 2) s += rect(6, 0.6, 14, 1.8, ACID) + rect(8, 3.6, 14, 1.8, ACID); return svg(22, 16, s); },
    motion: (i) => { const pts = [[[2, 7], [14, 7], [26, 7], [38, 7]], [[2, 11], [14, 8], [26, 5], [38, 2]], null][i]; if (!pts) return svg(42, 14, `<path d="M2 11 L14 11 C 20 11, 22 3, 28 3 L40 3" fill="none" stroke="${ACID}" stroke-width="2"/>`); return svg(42, 14, pts.map(([x, y]) => rect(x - 2, y, 8, 2.4, i ? ACID : "currentColor")).join("")); },
    shape: (i) => { let s = ""; for (let k = 0; k < 8; k++) { const x = k / 7, f = [1, 0.25 + 0.75 * x, 1 - 0.75 * x, 0.25 + 0.75 * Math.sin(Math.PI * x)][i], h = 2 + 11 * f; s += rect(k * 5.2, 13 - h, 4, h, i ? ACID : "currentColor", i ? 1 : 0.6); } return svg(42, 13, s); },
    octaves: (i) => { let s = rect(4, 7, 14, 2.4, "currentColor") + rect(4, 4.5, 14, 2.4, "currentColor"); if (i === 1 || i === 3) s += rect(4, 13, 14, 2.4, ACID); if (i === 2 || i === 3) s += rect(4, 0, 14, 2.4, ACID); return svg(22, 16, s); },
  };
  const isSl = (d) => !!SL[d];
  // EXPERIMENTAL (Eman, 15 Nov): a 7th step after ALTERNATIVE on the Common <-> Alternative card, stored as alt 1.2
  // (pop stays 0, the roll adds ui/kt2-dice-exp.js on top). KT2_DICE_EXP_OFF = 6 steps as before
  const expOn = () => !window.KT2_DICE_EXP_OFF && !!window.KT2DiceExp;
  const EXP_V = 1.2;
  const nSteps = (d) => (d === "alt" && expOn() ? ALT_N.length + 1 : d === "len" ? LEN_N.length : isTool(d) ? TOOL(d).v.length : d === "stack" ? STACK.length : d === "mood" ? MOODS.length : isSl(d) ? SL[d][0].length : OPTS[d].length);
  const idxOf = (d, v) => (d === "alt" ? (v > 1.01 ? (expOn() ? ALT_N.length : ALT_N.length - 1) : Math.round(Math.max(0, v) * (ALT_N.length - 1))) : d === "len" ? (v == null ? 2 : v) : d === "stack" || isTool(d) ? v : d === "mood" ? (v == null ? 9 : v) : isSl(d) ? Math.round(v * (nSteps(d) - 1)) : Math.round(v) - (OFFS[d] || 0));   // MOOD from AUTO starts in the middle
  const valOf = (d, i) => (d === "alt" ? (i >= ALT_N.length ? EXP_V : i / (ALT_N.length - 1)) : d === "len" ? i : d === "stack" || d === "mood" || isTool(d) ? i : isSl(d) ? i / (nSteps(d) - 1) : i + (OFFS[d] || 0));
  const presetSteps = (ri) => { const st = new Array(16).fill(0); for (const [a] of RHY[ri].hits) st[Math.floor(a) % 16] = 1; return st; };
  // ---- RHYTHM STEP GRID (Eman, 11 Nov 20:41: "a pattern on how you want the chords played ... you can see them very
  // clearly, randomize it, and press on rhythms to see different rhythms you can select ... like we analyzed all the chord
  // patterns"). The Rhythm card is a 16-step grid like the RHYTHM menu's STEPS: click an empty step to add a hit, click a
  // lit one (or right-click) to take it away, drag a lit step to move it, drag over empty steps to paint. The small dice
  // rolls a rhythm from the songs; the name (or the list button) opens every rhythm we measured: the most common bars of
  // 880 songs (FROM SONGS) and the CHORD SCIENCE patterns (holds, pulses, stabs, broken, strums), only the rhythm, not the
  // chords. ui/kt2-chord-rhythms.js (scripts/science/chords/build_dice_rhythms.py). KT2_DICE_GRID_OFF = the old dots
  // OWN SOURCES (Eman, 12 Nov): that list comes from songs found online, so it is off unless its switch on the
  // UNPERSONAL DATA page is on, or KT2_OWN_SOURCES_OFF
  const gridOn = () => !window.KT2_DICE_GRID_OFF && (window.KT2Use ? KT2Use("chordrhythms") : !!window.KT2_OWN_SOURCES_OFF) && simpleOn();
  const CR = () => ((window.KT2Use ? KT2Use("chordrhythms") : !!window.KT2_OWN_SOURCES_OFF) && window.KT2ChordRhythms) || { groups: [], list: [] };   // OWN SOURCES: empty unless switched on (UNPERSONAL DATA page) or KT2_OWN_SOURCES_OFF
  const crSteps = (r) => r.steps.split("").map((c) => (c === "." ? 0 : 1));
  const crLen = (r) => r.len.map((x) => (x > 0 ? x : null));
  const sameSteps = (a, b) => a && b && a.length === b.length && a.every((x, i) => !!x === !!b[i]);
  function useRhythm(r, name) { ST.hits = crSteps(r); ST.hitLen = crLen(r); ST.rhyName = name || r.name.toUpperCase(); ST.rhyId = r.id; }
  // a rhythm from the songs: the common ones more often, never the one there now; one in three gets a small twist
  function randomRhythm() {
    const L = CR().list.filter((r) => !sameSteps(crSteps(r), ST.hits)); if (!L.length) return false;
    const w = L.map((r) => 0.35 + (r.bars || 0) / 400 + (r.share || 0) * 20); let t = Math.random() * w.reduce((a, b) => a + b, 0), r = L[0];
    for (let i = 0; i < L.length; i++) { t -= w[i]; if (t <= 0) { r = L[i]; break; } }
    useRhythm(r);
    if (Math.random() < 0.34) {   // the twist: one off-beat 16th in or out (the downbeat stays)
      const odd = [1, 3, 5, 7, 9, 11, 13, 15, 2, 6, 10, 14], k = odd[Math.floor(Math.random() * odd.length)];
      if (ST.hits[k]) { if (ST.hits.filter(Boolean).length > 1) { ST.hits[k] = 0; ST.hitLen[k] = null; } } else { ST.hits[k] = 1; ST.hitLen[k] = 1; }
      ST.rhyName += " VAR";
    }
    return true;
  }
  const RLIST_SVG = `<svg viewBox="0 0 12 10" width="11" height="9" aria-hidden="true"><rect x="0" y="0" width="12" height="2" fill="currentColor"/><rect x="0" y="4" width="12" height="2" fill="currentColor"/><rect x="0" y="8" width="12" height="2" fill="currentColor"/></svg>`;
  const stepsHtml = (st) => `<span class="tmd-steps">${st.map((on, k) => `<button type="button" class="tmd-step${on ? " on" : ""}${k % 4 === 0 ? " beat" : ""}" data-step="${k}" aria-pressed="${!!on}" aria-label="16th ${k + 1}"></button>`).join("")}</span>`;
  // ---- NOTE ROW (Eman, 13 Nov 15:07: "put literal midi notes inside it ... so we understand exactly that's how it will be
  // copied into the pattern ... you can remove them, and drag them"; 15:08: quick preset buttons). The Rhythm card is one
  // bar drawn like the piano roll: each hit is a purple note block as long as it will ring, beats 1-4 marked. Click empty =
  // a note (drag to make it longer), drag a note = move, drag its right end = length, click a note or right-click = gone.
  // The preset chips are plain, common chord rhythms (not learned data). KT2_DICE_NOTEROW_OFF = the dots / step grid
  const rowOn = () => !window.KT2_DICE_NOTEROW_OFF && simpleOn();
  const lensOn = () => gridOn() || rowOn();
  // ROW BARS (Eman, 15 Nov 01:15: "should be fully visible like 8 bars default, but you can change here as well to 4 or
  // 16 is max. Then it will loop that rythm"): the note row shows 8 bars by default (4 / 8 / 16 chips), the rhythm is
  // that many bars long and loops over the pattern. A one-bar rhythm (preset, the songs list, an older save) is repeated
  // across the bars. KT2_DICE_ROWBARS_OLD = the one-bar row
  const rbOn = () => rowOn() && !window.KT2_DICE_ROWBARS_OLD;
  const ROWB = [4, 8, 16];
  // BASS ROW (Eman, 15 Nov 01:25: "for the bass should also have that tool you can put out the rhythm like chords do"):
  // in BASS mode the dice panel gets the same note row. It keeps its own rhythm (ST.bassR: hits, hitLen, rhyName,
  // rowBars), so the chords' rhythm stays as it was; the bass roll plays a root on every hit, as long as drawn.
  // On AUTO the row shows the NOTES card's groove (LONG / ROOT+5 / 8THS / 808). KT2_DICE_BASSROW_OFF = no row in BASS
  const bassRowOn = () => rowOn() && !window.KT2_DICE_BASSROW_OFF;
  let RP = ST;   // whose rhythm the note row is showing: ST (chords) or ST.bassR (bass); every entry point sets it
  // RHYTHM ROW ON EVERY PART (Eman, 26 Nov: "I dont see the midi tool to animate the rhythm of pattern in the row"): the
  // bar's light-blue row shows on BASS, MELODY and ARP too, each with its own rhythm (ST.bassR / ST.melR / ST.arpR); a
  // pick or an edit re-times that part's notes onto the hits (toymachine-midi.js rerhythmLine). KT2_TBROW_ALL_OFF = chords only
  const tbAllOn = () => !window.KT2_TBROW_ALL_OFF;
  const LINE_R = { melody: "melR", arp: "arpR" };
  const rsOf = (part) => { if (part === "bass" && bassRowOn()) return (ST.bassR = ST.bassR && typeof ST.bassR === "object" ? ST.bassR : {});
    const k = tbAllOn() && LINE_R[part]; if (k) return (ST[k] = ST[k] && typeof ST[k] === "object" ? ST[k] : {}); return ST; };
  const isB = () => RP !== ST;
  const BASS_PRE = [{ n: "LONG", h: [[0, 16]] }, { n: "ROOT+5", h: [[0, 8], [8, 8]] }, { n: "8THS", h: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]] }, { n: "808", h: [[0, 6], [6, 4], [12, 4]] }];
  // BAR STEPPER (Eman, 15 Nov 05:11: "more ux friendly to add and remove bars"): - N BARS + instead of the 4 / 8 / 16
  // chips, any length 1..16 (a longer row repeats the start, a shorter one cuts). KT2_DICE_BARSTEP_OLD = the 3 chips
  const stepOn = () => rbOn() && !window.KT2_DICE_BARSTEP_OLD;
  const rbOk = (v) => (stepOn() ? v >= 1 && v <= 16 && v === Math.round(v) : ROWB.includes(v));
  // 4 BARS by default (Eman, 15 Nov 05:16). KT2_DICE_ROW8 = 8 bars by default
  // BAR CYCLE (Eman, 16 Nov 02:26: "make it just one button, so if i press on the 2, it becomes 4, if i press again 8,
  // press again 1 ... with 2 being default"): the bar's 4 / 8 buttons become one button that cycles 2 > 4 > 8 > 1 > 2,
  // and a new rhythm row is 2 bars long. KT2_DICE_TBCYCLE_OLD = the 4 / 8 buttons and 4 bars by default
  const cycOn = () => !window.KT2_DICE_TBCYCLE_OLD;
  const CYC = [1, 2, 4, 8];
  const cycNext = (b) => CYC.find((x) => x > b) || CYC[0];
  // CHORD SPEED (Eman 24 Nov, clip 00.55: "this should set how fast the pattern is on the chords ... 1 they should be
  // this long, 2 means double as many ... 4"): the cycle button is a SPEED 1 > 2 > 4 > 8 > 1, not a bar count. The row keeps
  // its length; going faster squeezes the rhythm into 1/N of it and repeats it N times (WHOLE at 2 = halves, at 4 = quarters).
  // Going back slower stretches the first part out again. KT2_DICE_SPEED_OLD = the button sets the row's bars (did nothing
  // you could hear with a WHOLE rhythm)
  const spdOn = () => cycOn() && !window.KT2_DICE_SPEED_OLD;
  const SPD = () => (CYC.includes(RP.rowSpd) ? RP.rowSpd : 1);
  const respeed = (st, ln, f) => {   // st/ln: step arrays of one row; f: new speed / old speed
    const N = st.length, os = new Array(N).fill(0), ol = new Array(N).fill(null), notes = [];
    for (let k = 0; k < N; k++) if (st[k]) notes.push([k, Math.max(1, (ln && ln[k]) || 1)]);
    if (f > 1) { const seg = N / f; for (let o = 0; o < N; o += seg) for (const [a, l] of notes) { const k = Math.round(o + a / f); if (k < N && !os[k]) { os[k] = 1; ol[k] = Math.max(1, Math.round(l / f)); } } }
    else { const g = 1 / f; for (const [a, l] of notes) { if (a * g >= N) continue; const k = Math.round(a * g); if (!os[k]) { os[k] = 1; ol[k] = Math.min(N - k, Math.round(l * g)); } } }
    if (!os.some(Boolean)) { os[0] = 1; ol[0] = N; }
    return { st: os, ln: ol };
  };
  const RB = () => (rbOn() ? (rbOk(RP.rowBars) ? RP.rowBars : stepOn() && !window.KT2_DICE_ROW8 ? (cycOn() ? 2 : 4) : 8) : 1);
  const NS = () => RB() * 16;
  // st/ln stretched to n steps: repeated when shorter, cut when longer
  const tile = (a, n, fill) => { if (!a) return null; if (a.length === n) return a.slice(); const out = new Array(n); for (let i = 0; i < n; i++) out[i] = i < a.length ? a[i] : a.length ? a[i % a.length] : fill; return out; };
  const fitHits = () => { if (RP.hits && rbOn() && RP.hits.length !== NS()) { const n = NS(); RP.hits = tile(RP.hits, n, 0); RP.hitLen = RP.hitLen ? tile(RP.hitLen, n, null) : null; if (!RP.hits.some(Boolean)) RP.hits[0] = 1; } };
  const rbHtml = () => (stepOn() ? `<span class="tmd-nbars tmd-nstep" title="How many bars the rhythm is (it loops)"><button type="button" class="tmd-np tmd-nbar tmd-nsb" data-bars="-"${RB() <= 1 ? " disabled" : ""} aria-label="One bar less">\u2212</button><b class="tmd-nsn">${RB()} BAR${RB() > 1 ? "S" : ""}</b><button type="button" class="tmd-np tmd-nbar tmd-nsb" data-bars="+"${RB() >= 16 ? " disabled" : ""} aria-label="One bar more">+</button></span>` : rbOn() ? `<span class="tmd-nbars" title="How many bars the rhythm is (it loops)">${ROWB.map((b) => `<button type="button" class="tmd-np tmd-nbar${RB() === b ? " on" : ""}" data-bars="${b}">${b} BARS</button>`).join("")}</span>` : "");
  const QPRE_OLD = [
    { id: "whole", n: "WHOLE", h: [[0, 16]] },
    { id: "halves", n: "HALVES", h: [[0, 8], [8, 8]] },
    { id: "quarters", n: "QUARTERS", h: [[0, 4], [4, 4], [8, 4], [12, 4]] },
    { id: "eighths", n: "8THS", h: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]] },
    { id: "offbeat", n: "OFFBEAT", h: [[2, 2], [6, 2], [10, 2], [14, 2]] },
    { id: "332", n: "3-3-2", h: [[0, 6], [6, 6], [12, 4]] },
    { id: "dembow", n: "3-3-2 X2", h: [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]] },
    { id: "charleston", n: "CHARLESTON", h: [[0, 3], [6, 4]] },
    { id: "push", n: "PUSH", h: [[0, 7], [7, 9]] },
    { id: "stabs", n: "STABS", h: [[0, 1], [3, 1], [6, 1], [10, 1], [12, 1]] },
    { id: "bounce", n: "BOUNCE", h: [[0, 2], [3, 1], [6, 2], [8, 2], [11, 1], [14, 2]] },
  ];
  // RHYTHM CATEGORIES (Eman, 15 Nov 05:18): the list from ui/kt2-dice-rhythms.js grouped CLASSIC / ALTERNATIVE /
  // EXPERIMENTAL with a side bar in the dropdown; q.len = steps before it loops (16 = 1 bar, 32 = 2 bars).
  // KT2_DICE_RHYCATS_OFF = the old 11 rhythms, no side bar
  const catsOn = () => !window.KT2_DICE_RHYCATS_OFF && !!(window.KT2DiceRhythms && window.KT2DiceRhythms.list && window.KT2DiceRhythms.list.length);
  const QPRE = catsOn() ? window.KT2DiceRhythms.list : QPRE_OLD;
  const QCATS = catsOn() ? window.KT2DiceRhythms.cats : null;
  const qSteps = (q) => { const n = rowOn() ? NS() : 16, L = q.len || 16, st = new Array(n).fill(0), ln = new Array(n).fill(null); for (let o = 0; o < n; o += L) for (const [a, l] of q.h) if (o + a < n) { st[o + a] = 1; ln[o + a] = l; } return { st, ln }; };
  // the notes as they will be written: [step, length in 16ths]. vlen = the LENGTH card (3 LEGATO = to the next hit)
  function rowNotes(st, ln, vlen) {
    const on = st.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    return on.map((i, k) => { const nx = k + 1 < on.length ? on[k + 1] : st.length, gap = nx - i; let l = ln && ln[i] > 0 ? Math.min(gap, ln[i]) : gap;
      if (vlen === 3) l = gap; else if (vlen != null && vlen < 3) l = Math.max(0.5, gap * [0.25, 0.5, 0.9][vlen]); return [i, l]; });
  }
  // ROW = ROLL (Eman, 15 Nov 14:27: "the light blue bars dont show the same as the actual ones ... two long chords, but on
  // the blue its four"): on AUTO the row showed the rhythm's one-bar picture repeated every bar, while the roll plays
  // ONCE as one hit per chord (a chord every 2 bars on a slow change) and can rotate rhythms or follow heard chords.
  // Now, on AUTO, the row shows the chord hits that are really in the open clip (what the roll wrote), and before any
  // roll ONCE is drawn one hit per chord change. KT2_DICE_ROWSYNC_OLD = the one-bar picture repeated
  // EDIT LIKE MIDI (Eman, 15 Nov 14:30): press a note = move it, press empty = a new note, right-click = gone; the row
  // keeps the grid but nothing stretches by itself: a gap stays a gap (LENGTH / LEGATO no longer stretch drawn notes,
  // in the row or the roll), and dragging a note's end into the next one makes that one shorter.
  // KT2_DICE_ROWEDIT_OLD = tap deletes, drawn notes stretch with LEGATO, a note's end stops at the next one
  const editOn = () => rowOn() && !window.KT2_DICE_ROWEDIT_OLD;
  const syncOn = () => rowOn() && !window.KT2_DICE_ROWSYNC_OLD;
  const clipRow = (n) => {   // the open clip's chord hits over the first n steps: { st, ln } or null
    try {
      const S = window.TmMidi && TmMidi._s && TmMidi._s(); if (!S || !S.clipId || !Array.isArray(S.notes) || S.voice === "*") return null;
      const m = new Map(); for (const x of S.notes) { if (x.muted) continue; const a = Math.round(x.start * 4); if (a < 0 || a >= n || Math.abs(x.start * 4 - a) > 0.05) continue; m.set(a, Math.max(m.get(a) || 0, x.length * 4)); }
      if (!m.size) return null;
      const st = new Array(n).fill(0), ln = new Array(n).fill(null); for (const [a, l] of m) { st[a] = 1; ln[a] = Math.max(1, Math.round(Math.min(l, n - a))); }
      return { st, ln };
    } catch (e) { return null; }
  };
  const SEG = [8, 4, 2, 1];   // PACE: beats per chord (2 BARS, 1 BAR, HALF, BEAT), as the roll uses it
  function rowNow(i, V, pace) {   // what the card shows: the hand-made hits, or the AUTO preset's own notes
    fitHits();
    if (RP.hits) return { st: RP.hits, ln: RP.hitLen, vlen: V && !isB() && !(editOn() && RP.hitLen) ? V.len : null };
    if (syncOn() && (!isB() || tbAllOn())) {
      const n = NS(), c = clipRow(n); if (c) return { ...c, vlen: null };
      const pc = V && V.pace != null ? V.pace : pace;
      if (RHY[i] && RHY[i].k === "hold" && pc != null) { const L = SEG[Math.max(0, Math.min(3, Math.round(pc)))] * 4, st = new Array(n).fill(0), ln = new Array(n).fill(null); for (let o = 0; o < n; o += L) { st[o] = 1; ln[o] = Math.min(L, n - o); } return { st, ln, vlen: null }; }
    }
    const n = NS(), st = new Array(n).fill(0), ln = new Array(n).fill(null); for (let o = 0; o < n; o += 16) for (const [a, l] of (isB() ? bassPre(V).h : RHY[i].hits)) { st[o + Math.floor(a) % 16] = 1; ln[o + Math.floor(a) % 16] = Math.max(1, Math.round(l)); }
    return { st, ln, vlen: null };
  }
  // ROW LOOK (Eman, 15 Nov 01:28: "dont make them this TALL AND FAT, make them the same as the real midis but light blue";
  // "every 4 bars a bit more light grey background"; "for all the different rhythms make it a dropdown like KILLDRUM"):
  // thin light-blue notes like the piano roll, a lighter band behind bars 1-4, 9-12, the presets in one dropdown with
  // a little picture of each. KT2_DICE_ROWLOOK_OLD = the fat purple blocks and the row of chips
  const lookOn = () => !window.KT2_DICE_ROWLOOK_OLD;
  const bandsHtml = (nb) => { if (!lookOn() || nb < 2) return ""; let h = ""; for (let b = 0; b < nb; b += 8) h += `<s class="tmd-nband" style="left:${(b / nb) * 100}%;width:${(Math.min(4, nb - b) / nb) * 100}%"></s>`; return h; };
  // MIDI LOOK (Eman, 15 Nov 05:11: "make these look like the MIDI in their shape"): every hit is its own rounded note
  // block like the piano roll (highlight, velocity dot, a gap between notes), light blue; 4 bars per lane, so 8 bars =
  // 2 lanes and the notes stay big enough to grab. Hover shows where a click adds a note. KT2_DICE_NOTELOOK_OLD = thin line
  const mlOn = () => lookOn() && rbOn() && !window.KT2_DICE_NOTELOOK_OLD;
  const laneOf = (N) => { const nb = N / 16, LB = TBL ? Math.max(1, nb) : Math.min(4, Math.max(1, nb)), LS = LB * 16; return { nb, LB, LS, lanes: Math.ceil(N / LS) }; };   // in the bar: one lane
  const midiRowHtml = (st, ln, vlen) => {
    const N = st.length, { nb, LB, LS, lanes } = laneOf(N), L = [];
    for (let r = 0; r < lanes; r++) {
      let h = `<span class="tmd-nlane${r % 2 ? " odd" : ""}" data-lane="${r}">`;
      for (let b = r * LB; b < Math.min(nb, (r + 1) * LB); b++) h += `<em class="tmd-nb" style="left:${((b - r * LB) / LB) * 100}%">${b + 1}</em>`;
      const used = Math.min(LS, N - r * LS); if (used < LS) h += `<s class="tmd-nlend" style="left:${(used / LS) * 100}%"></s>`;
      L.push(h);
    }
    rowNotes(st, ln, vlen).forEach(([a, l], k) => {
      let s = a, rem = l, part = 0;
      while (rem > 0.01 && s < N) {
        const r = Math.floor(s / LS), off = s - r * LS, w = Math.min(rem, LS - off), last = rem - w <= 0.01;
        const sz = w < 2.5 ? " xs" : w < 4.5 ? " sm" : "";
        L[r] += `<i class="tmd-nn${k === 0 && !part ? " first" : ""}${part ? " cont" : ""}${last ? "" : " goes"}${sz}" data-step="${a}" style="left:${(off / LS) * 100}%;width:calc(${(w / LS) * 100}% - 2px)"><u class="tmd-nn-h"></u><u class="tmd-nn-v"></u>${last ? `<b class="tmd-nn-e"></b>` : ""}</i>`;
        s += w; rem -= w; part++;
      }
    });
    return `<span class="tmd-nrow is-midi" role="group" aria-label="${nb} bar${nb > 1 ? "s" : ""}" style="--lb:${LB};--lanes:${lanes}">${L.map((h) => h + "</span>").join("")}<s class="tmd-nghost" hidden></s></span>`;
  };
  // PLAYHEAD (Eman, 15 Nov 05:15: "when playing make a marker go through inside this box"): while the song plays over the
  // open clip, a yellow line runs through the note row where the rhythm is now (it loops every row length)
  let phRun = false;
  const phTick = () => {
    const row = document.querySelector(".tmd-nrcard .tmd-nrow.is-midi");
    let ph = row && row.querySelector(".tmd-nph"), at = null;
    try {
      const t = typeof ui !== "undefined" && ui && ui.transport, S = window.TmMidi && TmMidi._s && TmMidi._s(), c = row && t && t.playing && S && S.clipId && typeof findClip === "function" ? findClip(S.clipId) : null;
      if (c && typeof secPerBeat === "function") { const b = (t.position - c.start) / secPerBeat(); if (isFinite(b)) at = b * 4; }
    } catch (e) { at = null; }
    if (row) {
      const lanes = row.querySelectorAll(".tmd-nlane"), N = row.querySelectorAll(".tmd-nb").length * 16, { LS } = laneOf(N || 16);
      if (at == null || !N) { if (ph) ph.hidden = true; }
      else {
        const s = ((at % N) + N) % N, r = Math.floor(s / LS), lane = lanes[r];
        if (!ph) { ph = document.createElement("s"); ph.className = "tmd-nph"; }
        if (lane && ph.parentElement !== lane) lane.append(ph);
        ph.hidden = false; ph.style.left = ((s - r * LS) / LS) * 100 + "%"; ph.style.top = "0"; ph.style.bottom = "0";
      }
    }
    if (row && !document.hidden) requestAnimationFrame(phTick); else setTimeout(phTick, 500);   // keeps looking (cheap) so a panel opened later gets it too
  };
  const phStart = () => { if (phRun || !mlOn()) return; phRun = true; requestAnimationFrame(phTick); };
  window.TmDicePh = { start: () => phStart(), running: () => phRun };   // for the tests
  const rowHtml = (st, ln, vlen) => { if (mlOn()) return midiRowHtml(st, ln, vlen); const N = st.length, nb = N / 16, many = nb > 1; return `<span class="tmd-nrow${many ? " is-bars b" + nb : ""}${lookOn() ? " is-thin" : ""}" role="group" aria-label="${many ? nb + " bars" : "One bar"}"${many ? ` style="--nb:${nb}"` : ""}>${bandsHtml(nb)}${(many ? Array.from({ length: nb }, (_, b) => b + 1) : [1, 2, 3, 4]).map((b) => `<em class="tmd-nb" style="left:${((b - 1) / (many ? nb : 4)) * 100}%">${b}</em>`).join("")}${rowNotes(st, ln, vlen).map(([a, l], k) => `<i class="tmd-nn${k === 0 ? " first" : ""}" data-step="${a}" style="left:${(a / N) * 100}%;width:${(l / N) * 100}%"><b class="tmd-nn-e"></b></i>`).join("")}</span>`; };
  const bassPre = (V) => BASS_PRE[Math.max(0, Math.min(3, Math.round(V && V.dens != null ? V.dens : 1)))];
  const preOn = (q) => RP.hits && sameSteps(qSteps(q).st, RP.hits) && q.h.every(([a, l]) => RP.hitLen && RP.hitLen[a] === l);
  const miniHtml = (h, L) => { L = L || 16; const beats = []; for (let b = 0; b < L; b += 4) beats.push(b); return `<span class="tmd-npmini${L > 16 ? " is-long" : ""}">${beats.map((b) => `<s class="${b % 16 === 0 && b ? "bar" : ""}" style="left:${(b / L) * 100}%"></s>`).join("")}${h.map(([a, l]) => `<i style="left:${(a / L) * 100}%;width:calc(${(Math.min(Math.max(1, l), L - a) / L) * 100}% - 1px)"></i>`).join("")}</span>`; };
  const preName = () => { if (!RP.hits) return "AUTO"; const q = QPRE.find(preOn); return q ? q.n : RP.rhyName || "CUSTOM"; };
  const CARET = "\u25BE";
  const preHtml = () => lookOn() ? `<span class="tmd-npre is-dd"><button type="button" class="tmd-npdd" title="All the rhythms"><span class="tmd-npdd-n">${esc(preName())}</span><i>${CARET}</i></button>${rbHtml()}</span>` : preHtml0();
  const preHtml0 = () => `<span class="tmd-npre"><button type="button" class="tmd-np tmd-np-auto${RP.hits ? "" : " on"}" data-pre="">AUTO</button>${QPRE.map((q) => `<button type="button" class="tmd-np${preOn(q) ? " on" : ""}" data-pre="${q.id}">${q.n}</button>`).join("")}${rbHtml()}</span>`;
  function cardPic(d, v) {
    if (d === "len") return picLen(v == null ? 2 : v);
    if (isTool(d)) return TPIC[d] ? TPIC[d](v) : "";
    if (d === "stack") return picStack(v); if (d === "pace") return picPace(v); if (d === "voices") return picVoices(v); if (d === "range") return picRange(v);
    if (d === "dens") return picDens(v); if (d === "swing") return SWING_PIC(v); if (isSl(d)) return SL[d][1](v);
    return "";
  }
  function card(d, V, isAuto) {
    if (d === "style") {
      const top = topOn() && !!ST.top, bass = !!ST.bassNote;
      return `<div class="tmd-card tmd-style" data-dial="style" role="group" aria-label="Chords style">
      <span class="tmd-sty"><button type="button" class="tmd-sb tmd-sclean${top ? "" : " on"}" aria-pressed="${!top}" title="CLEAN: just the chords, one after another">CLEAN</button><button type="button" class="tmd-sb tmd-stop${top ? " on" : ""}" aria-pressed="${top}" title="CHORD TOP LINE: little notes from the chords that make them move, leaving room for a vocal or a melody on top">CHORD TOP LINE</button></span>
      <button type="button" class="tmd-sb tmd-sbass${bass ? " on" : ""}" aria-pressed="${bass}" title="BASS: the bass notes an octave under the chords (the notes only, the sound stays)">BASS</button></div>`;
    }
    if (d === "mood") {   // the MOOD card: the mood's name in its own colour, the dark-to-bright strip under it
      const m = V.mood == null ? null : MOODS[V.mood], name = m ? m.n : "ANY";
      return `<div class="tmd-card tmd-mood${m ? "" : " is-auto"}" data-dial="mood" tabindex="0" role="slider" aria-label="Mood" aria-valuetext="${name}" title="${m ? esc(m.feel) + ". " : ""}Tap to pick a mood, drag sideways for darker or brighter, double-click for AUTO" style="--mood:${m ? moodCol(m.b) : "#c4b5fd"}">
      <span class="tmd-ct"><b class="tmd-cv">${name}</b> <span class="tmd-cn">(Mood)</span>${m ? "" : "<i>AUTO</i>"}</span><span class="tmd-cp">${picMood(m ? V.mood : null)}</span>${moodDiceOn() ? moodBtns() : ""}</div>`;
    }
    const v = V[d], i = Math.max(0, Math.min(nSteps(d) - 1, idxOf(d, v))), name = d === "len" ? LEN_N[i] : d === "rhythm" && i === 0 && simpleOn() ? "ONCE" : isTool(d) ? TOOL(d).v[i] : d === "stack" ? STACK[i].n : CARDV[d] ? CARDV[d][i] : isSl(d) ? SL[d][0][i] : OPTS[d][i];
    let pic = cardPic(d, v), extra = "";
    if (d === "rhythm" && rowOn()) {
      const nm = RP.hits ? (RP.rhyName || "CUSTOM") : isB() ? bassPre(V).n : name, au = (isB() || isAuto[d]) && !RP.hits, r = rowNow(i, V), G = gridOn() && !isB();
      return `<div class="tmd-card tmd-rgrid tmd-nrcard${au ? " is-auto" : ""}" data-dial="rhythm" tabindex="0" role="group" aria-label="Rhythm" aria-valuetext="${esc(nm)}">
      <span class="tmd-ct">${G ? `<button type="button" class="tmd-rname" title="All the rhythms">` : `<span class="tmd-rname0">`}<b class="tmd-cv">${esc(nm)}</b> <span class="tmd-cn">(Rhythm)</span>${au ? "<i>AUTO</i>" : ""}${G ? "</button>" : "</span>"}${preHtml()}${G ? `<span class="tmd-rbtns"><button type="button" class="tmd-mbtn tmd-rdice" title="Roll a rhythm">${diceSvg}</button><button type="button" class="tmd-mbtn tmd-rlist" title="All the rhythms">${RLIST_SVG}</button></span>` : ""}</span><span class="tmd-cp">${rowHtml(r.st, r.ln, r.vlen)}</span></div>`;
    }
    if (d === "rhythm" && gridOn()) {
      const st = ST.hits || presetSteps(i), nm = ST.hits ? (ST.rhyName || "CUSTOM") : name;
      return `<div class="tmd-card tmd-rgrid${isAuto[d] && !ST.hits ? " is-auto" : ""}" data-dial="rhythm" tabindex="0" role="group" aria-label="Rhythm" aria-valuetext="${esc(nm)}">
      <span class="tmd-ct"><button type="button" class="tmd-rname" title="All the rhythms"><b class="tmd-cv">${esc(nm)}</b> <span class="tmd-cn">(Rhythm)</span>${isAuto[d] && !ST.hits ? "<i>AUTO</i>" : ""}</button><span class="tmd-rbtns"><button type="button" class="tmd-mbtn tmd-rdice" title="Roll a rhythm">${diceSvg}</button><button type="button" class="tmd-mbtn tmd-rlist" title="All the rhythms">${RLIST_SVG}</button></span></span><span class="tmd-cp">${stepsHtml(st)}</span></div>`;
    }
    if (d === "rhythm") {
      const st = ST.hits || presetSteps(i);
      pic = `<span class="tmd-dots">${st.map((on, k) => `<button type="button" class="tmd-dot${on ? " on" : ""}${k % 4 === 0 ? " beat" : ""}" data-step="${k}" aria-pressed="${!!on}" title="Tap to ${on ? "empty" : "fill"} this 16th"></button>`).join("")}</span>`;
      extra = simpleOn() ? "" : `<button type="button" class="tmd-fill${ST.fill ? " on" : ""}" aria-pressed="${!!ST.fill}" title="FILL: every chord rings on to the next hit, no gaps">FILL</button>`;
      // TOP LINE (Eman, 9 Nov 22:19): a slow voice on top of the chords in the mood's own style. KT2_TOPLINE_OFF = no button
      if (topOn() && !simpleOn()) extra += `<button type="button" class="tmd-fill tmd-top${ST.top ? " on" : ""}" aria-pressed="${!!ST.top}" title="TOP LINE: a slow voice on top of the chords, from the chords' own notes. Leaves room for a melody above">TOP</button>`;
    }
    const custom = d === "rhythm" && ST.hits;
    return `<div class="tmd-card${isTool(d) ? " tmd-tool" : ""}${isAuto[d] && !custom ? " is-auto" : ""}" data-dial="${d}" tabindex="0" role="slider" aria-label="${NAMES[d] || (TOOL(d) || {}).n}" aria-valuetext="${custom ? "CUSTOM" : name}" title="Drag sideways or scroll to change, double-click for AUTO">
      <span class="tmd-ct"><b class="tmd-cv">${custom ? "CUSTOM" : name}</b> <span class="tmd-cn">(${NAMES[d] || (TOOL(d) || {}).n})</span>${isAuto[d] && !custom ? "<i>AUTO</i>" : ""}</span>${extra}<span class="tmd-cp">${pic}</span></div>`;
  }
  function cardsHtml(pane) {
    const R = ROWS.get(pane), part = R.part || "chords", chordy = part === "chords" || part === "arp";
    const { V, isAuto } = resolve(R.hooks.prompt ? R.hooks.prompt() : "", part);
    const SIM = simpleOn() && part === "chords";
    RP = rsOf(part);
    const inBar = SIM && tbOn(pane);   // RHYTHM IN THE BAR: the row lives in the top bar, not in the cards
    const sty = styleOn() && part === "chords" ? ["style"] : [];
    const list = SIM ? [...sty, ...(moodOn() ? ["mood"] : []), "pace", ...(inBar ? [] : ["rhythm"]), "len", stackOn() ? "stack" : "voices", "range"] : [...sty, ...(moodOn() ? ["mood"] : []), ...(part === "chords" ? ["pace", "rhythm", ...(stackOn() ? ["stack"] : ["voices"]), "range", ...(stackOn() ? [] : ["colour"]), "tension", "random", "alt"]
      : [...(part === "bass" && bassRowOn() && !(tbAllOn() && tbOn(pane)) ? ["rhythm"] : []), ...(chordy ? [stackOn() ? "stack" : "voices"] : []), "dens", "swing", "range", ...(chordy && stackOn() ? [] : ["colour"]), "tension", "random", "alt"])];
    const full = part === "chords" && R.hooks.full && R.hooks.full();
    const L3 = full ? chips("full", FULL_ITEMS.map((it) => ({ ...it, pic: picFull(it.v) })), isAuto.full ? (R.hooks.fullUsed ? R.hooks.fullUsed() : null) : V.full, isAuto.full, "FULL", "The pattern is full of locked notes: the dice adds to them. AUTO tries a different one each roll") : "";
    const LIVE = window.DiceLive && DiceLive.on();
    // the BIG DICE (Eman, 9 Nov 00:47: "make the dice bigger, it disappears; put it inside this menu"): the first tile of
    // the panel rolls; the small dice in the top bar steps aside while the panel is open. KT2_DICE_BIG_OFF = small dice only
    const small = pane.querySelector("#tmm-dice"), big = !window.KT2_DICE_BIG_OFF ? `<button type="button" class="tmd-bigdice${window.KT2PGMatch && !KT2PGMatch.off() && !KT2PGMatch.solo() ? " has-pgm" : ""}" id="tmd-bigdice" title="Roll the dice (Enter in the prompt box)"${small && small.disabled ? " disabled" : ""}>${small ? small.innerHTML : ""}<span>ROLL</span>${window.KT2PGMatch && !KT2PGMatch.solo() ? KT2PGMatch.diceSwitchHtml() : ""}</button>` : "";
    // half-size cards (Eman, 9 Nov 00:00: "all of these can be like half as big"): the big dice on the left, the cards
    // in a grid that fits as many across as the panel has room for. KT2_DICE_CARDS_BIG = the old big cards
    const grid = `<div class="tmd-cgrid">${list.map((d) => card(d, V, isAuto)).join("")}${chatOn() ? chatHtml() : ""}${LIVE ? "" : `<div class="tmd-dial tmd-info" id="tmd-info"></div>`}</div>`;
    // the big dice at the far right (Eman, 9 Nov 00:04). KT2_DICE_BIG_LEFT = back on the left
    // COLLAGE (Eman, 9 Nov 01:38): two rows like a collage, MOOD and ROLL two rows tall, RHYTHM wide, the pictures bigger and
    // centred, no empty space. KT2_DICE_COLLAGE_OFF = the one-row half-size cards
    const collage = !window.KT2_DICE_COLLAGE_OFF && !window.KT2_DICE_CARDS_BIG;
    return `<div class="tmd-cards${big ? " has-big" : ""}${window.KT2_DICE_CARDS_BIG ? " is-bigcards" : ""}${collage ? " is-collage part-" + part : ""}${chatOn() ? " has-chat" : ""}${SIM ? " is-simple" : ""}${SIM && rowOn() ? " is-nrow" : ""}${part === "bass" && bassRowOn() ? " has-brow" : ""}">${window.KT2_DICE_BIG_LEFT ? big + grid : grid + big}</div>${SIM ? moreHtml(V, isAuto) : part === "chords" && toolsOn() ? `<div class="tmd-tools">${TOOLK.filter(isTool).map((d) => card(d, V, isAuto)).join("")}</div>` : ""}${L3 ? `<div class="tmd-line tmd-full">${L3}</div>` : ""}`;
  }
  // MORE (simple panel): the cards that matter less, folded away under one button; TOP LINE sits there too
  function moreHtml(V, isAuto) {
    const cards = MORE.filter((d) => (!isTool(d) ? isSl(d) : toolsOn()));
    const top = topOn() && !styleOn() ? `<button type="button" class="tmd-fill tmd-top tmd-moretop${ST.top ? " on" : ""}" aria-pressed="${!!ST.top}" title="TOP LINE: a slow voice on top of the chords, from the chords' own notes">TOP LINE</button>` : "";
    return `<div class="tmd-more${ST.more ? " open" : ""}"><button type="button" class="tmd-morebtn" aria-expanded="${!!ST.more}">MORE <svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true"><path d="${ST.more ? "M1 5l4-4 4 4" : "M1 1l4 4 4-4"}" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>${ST.more ? `<div class="tmd-tools tmd-moregrid">${cards.map((d) => card(d, V, isAuto)).join("")}${top}</div>` : ""}</div>`;
  }
  // OCTAVES in the top bar (simple panel): a small menu right of the dice arrow, chords only
  function octMenu(pane) {
    const R = ROWS.get(pane), pg = pane.querySelector("#tmm-pg"); if (!R || !pg) return;
    let m = pane.querySelector("#tmd-oct");
    const want = simpleOn() && toolsOn() && (R.part || "chords") === "chords" && isTool("octaves");
    if (!want) { if (m) m.remove(); return; }
    if (!m) {
      m = document.createElement("select"); m.id = "tmd-oct"; m.className = "tmd-oct"; m.title = "Octaves: double the chords' bottom note lower, top note higher, or both";
      m.addEventListener("mousedown", (e) => e.stopPropagation()); m.addEventListener("keydown", (e) => e.stopPropagation());
      m.addEventListener("change", () => { ST.octaves = m.value === "" ? null : +m.value; save(ST); const r = ROWS.get(pane); if (r && r.hooks.live) r.hooks.live("octaves", true); });
      const ar = pane.querySelector("#tmm-darrow"); if (ar) ar.after(m); else pg.append(m);
      if (window.TmMidiRefit && !window.KT2_BAR_ESAVE_OLD) setTimeout(window.TmMidiRefit, 0);   // the bar makes room for it
    }
    m.innerHTML = `<option value="">OCT AUTO</option>` + TOOL("octaves").v.map((n, i) => `<option value="${i}">OCT ${n}</option>`).join("");
    m.value = ST.octaves == null ? "" : String(ST.octaves);
  }
  // a card's value changed by drag / scroll / tap: store it, redraw the card in place, tell DICE LIVE
  function setCard(pane, d, i, final) {
    const R = ROWS.get(pane); if (!R) return;
    i = Math.max(0, Math.min(nSteps(d) - 1, i));
    if (d === "stack") { ST.voices = STACK[i].v; ST.colour = STACK[i].c; } else ST[d] = valOf(d, i);
    if (d === "rhythm") ST.hits = null;   // a preset rhythm replaces a hand-tapped one
    save(ST);
    const el = d === "mood" ? null : R.el.querySelector(`.tmd-card[data-dial="${d}"]`);
    if (d === "mood") { render(pane); fromChip(pane); }   // a mood leans every AUTO card: redraw them all
    else if (el) {   // redraw in place (same element: focus, pointer capture and double-click keep working)
      const { V, isAuto } = resolve(R.hooks.prompt ? R.hooks.prompt() : "", R.part || "chords"); const t = document.createElement("div"); t.innerHTML = card(d, V, isAuto);
      const n = t.firstElementChild; el.className = n.className; el.innerHTML = n.innerHTML; el.setAttribute("aria-valuetext", n.getAttribute("aria-valuetext"));
    }
    if (R.hooks.live) R.hooks.live(d === "stack" ? "voices" : d, !!final);
    if (final && window.KT2Juice && KT2Juice.step) KT2Juice.step("knob", "dice-" + d);
  }
  // the ROLL press (Eman, 9 Nov 00:04: "it distorts and the dice rolls in a satisfying way"): the tile squashes and
  // springs back, the dice tumbles two turns and lands with a bounce (~520 ms; a short pulse with reduced motion)
  function tumble(pane) {
    const t = pane.querySelector("#tmd-bigdice"); if (!t || !t.animate) return;
    const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) { t.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.25)" }, { filter: "brightness(1)" }], { duration: 220 }); return; }
    t.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.14,0.8) skewX(-4deg)", offset: 0.18 }, { transform: "scale(0.9,1.12) skewX(3deg)", offset: 0.42 }, { transform: "scale(1.05,0.96)", offset: 0.68 }, { transform: "scale(1,1)" }], { duration: 520, easing: "cubic-bezier(.3,.7,.3,1)" });
    tumbleIcon(t.querySelector("svg"));
  }
  const tumbleIcon = (svgEl) => { if (!svgEl || !svgEl.animate || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    svgEl.animate([{ transform: "translateY(0) rotate(0deg) scale(1)" }, { transform: "translateY(-9px) rotate(260deg) scale(1.15)", offset: 0.38 }, { transform: "translateY(0) rotate(640deg) scale(0.92)", offset: 0.74 }, { transform: "translateY(-3px) rotate(705deg) scale(1.04)", offset: 0.87 }, { transform: "translateY(0) rotate(720deg) scale(1)" }], { duration: 560, easing: "cubic-bezier(.25,.8,.35,1)" }); };
  function cardEvents(pane, el) {
    const R = () => ROWS.get(pane);
    const cur = (d) => { const r = R(), { V } = resolve(r.hooks.prompt ? r.hooks.prompt() : "", r.part || "chords"); return Math.max(0, Math.min(nSteps(d) - 1, idxOf(d, V[d]))); };
    let drag = null, wheelT = 0, lastDown = null;
    el.addEventListener("pointerdown", (e) => {
      const c = e.target.closest(".tmd-card"); if (!c || c.classList.contains("tmd-style") || e.button !== 0 || e.target.closest(".tmd-dot, .tmd-fill, .tmd-mbtn, .tmd-steps, .tmd-rname, .tmd-nrow, .tmd-npre")) return;
      const now = performance.now(), dbl = lastDown && lastDown.d === c.dataset.dial && now - lastDown.t < 380; lastDown = { d: c.dataset.dial, t: now };
      if (dbl) {   // double-click = AUTO (timed here: a live re-render between the two clicks makes the browser lose the dblclick)
        const d = c.dataset.dial, bR = d === "rhythm" && rsOf(R().part || "chords") !== ST; if (bR) { const o = rsOf(R().part); o.hits = o.hitLen = o.rhyName = null; } else { if (d === "stack") ST.voices = ST.colour = null; else ST[d] = null; if (d === "rhythm") ST.hits = null; } save(ST); drag = null; closeMoodPick();
        if (R().hooks.live) R().hooks.live(d === "stack" ? "voices" : d, true); render(pane); return;
      }
      if (c.classList.contains("tmd-rgrid")) return;   // the grid card doesn't drag or step: a stray click must not wipe the hits
      drag = { d: c.dataset.dial, x: e.clientX, i0: cur(c.dataset.dial), moved: false, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true;
      const i = Math.max(0, Math.min(nSteps(drag.d) - 1, drag.i0 + Math.round(dx / (drag.d === "mood" ? 12 : 22))));
      if (drag.moved && i !== cur(drag.d)) setCard(pane, drag.d, i, false);
    });
    const end = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag; drag = null;
      if (d.moved) { setCard(pane, d.d, cur(d.d), true); return; }
      if (e && e.type === "pointerup" && e.detail < 2) {
        if (d.d === "mood") { setTimeout(() => { if (!lastDown || performance.now() - lastDown.t > 300) moodPick(pane); }, 320); return; }   // tap = the mood list (after the double-click window)
        setCard(pane, d.d, (cur(d.d) + 1) % nSteps(d.d), true);   // tap = next value
      }
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("wheel", (e) => {
      const c = e.target.closest(".tmd-card"); if (!c || c.classList.contains("tmd-rgrid") || c.classList.contains("tmd-style")) return; e.preventDefault();
      const d = c.dataset.dial; setCard(pane, d, cur(d) + ((e.deltaY || e.deltaX) < 0 ? 1 : -1), false); closeMoodPick();
      clearTimeout(wheelT); wheelT = setTimeout(() => { if (R().hooks.live) R().hooks.live(d === "stack" ? "voices" : d, true); }, 260);
    }, { passive: false });
    el.addEventListener("keydown", (e) => {
      const c = e.target.closest(".tmd-card"); if (!c || c.classList.contains("tmd-style")) return; const d = c.dataset.dial;
      if (d === "mood" && (e.key === "Enter" || e.key === " ")) { moodPick(pane); e.preventDefault(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { setCard(pane, d, cur(d) + 1, true); e.preventDefault(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setCard(pane, d, cur(d) - 1, true); e.preventDefault(); }
    });
    gridEvents(pane, el, cur);
    if (!window.KT2_DICE_NOTEROW_OFF) rowEvents(pane, el, cur);
    el.addEventListener("click", (e) => {
      if (e.target.closest(".tmd-rdice")) { if (randomRhythm()) { if (ST.rhythm == null) ST.rhythm = cur("rhythm"); save(ST); if (R().hooks.live) R().hooks.live("hits", true); render(pane); tumbleIcon(pane.querySelector(".tmd-rdice svg")); } return; }
      if (e.target.closest(".tmd-rlist, .tmd-rname")) { rhyPick(pane); return; }
      if (e.target.closest(".tmd-mlock")) { ST.moodFree = !ST.moodFree; save(ST); render(pane); return; }
      if (e.target.closest(".tmd-mdice")) {   // a new mood: the chords there change with it (DICE LIVE), or the dice rolls
        closeMoodPick(); setCard(pane, "mood", randomMood(), true);
        if (!(R().hooks.armed && R().hooks.armed())) { const d = pane.querySelector("#tmm-dice"); if (d && !d.disabled) { const f = ST.moodFree; ST.moodFree = false; try { d.click(); } finally { ST.moodFree = f; } } }
        else tumbleIcon(pane.querySelector(".tmd-mdice svg"));
        return;
      }
      if (e.target.closest(".pgm-sw")) { const sw = e.target.closest(".pgm-sw"), v = !KT2PGMatch.isOn("dice"); KT2PGMatch.setOn("dice", v); sw.classList.toggle("on", v); sw.setAttribute("aria-checked", String(v)); if (!v) { const k = sw.querySelector(".pgm-key"); if (k) k.textContent = ""; } return; }   // PG MATCH switch (over ROLL, or on the tile): never rolls
      if (e.target.closest(".tmd-bigdice")) { const d = pane.querySelector("#tmm-dice"); if (d && !d.disabled) d.click(); return; }   // the roll redraws the panel, then tumbles the new tile (toymachine-midi.js)   // the big dice rolls like the small one
      const dot = e.target.closest(".tmd-dot");
      if (dot) {
        const st = ST.hits ? ST.hits.slice() : presetSteps(cur("rhythm")), k = +dot.dataset.step;
        st[k] = st[k] ? 0 : 1; if (!st.some(Boolean)) st[k] = 1;   // never an empty bar
        ST.hits = st; ST.hitLen = ST.rhyName = null; if (ST.rhythm == null) ST.rhythm = cur("rhythm"); save(ST);
        if (R().hooks.live) R().hooks.live("hits", true); render(pane); return;
      }
      if (e.target.closest(".tmd-sclean, .tmd-stop")) { const t = !!e.target.closest(".tmd-stop"); if (!!ST.top !== t) { ST.top = t; save(ST); if (R().hooks.live) R().hooks.live("top", true); render(pane); } return; }
      if (e.target.closest(".tmd-sbass")) { ST.bassNote = !ST.bassNote; save(ST); if (R().hooks.live) R().hooks.live("top", true); render(pane); return; }
      if (e.target.closest(".tmd-morebtn")) { ST.more = !ST.more; save(ST); render(pane); return; }
      if (e.target.closest(".tmd-top")) { ST.top = !ST.top; save(ST); if (R().hooks.live) R().hooks.live("top", true); render(pane); return; }
      if (e.target.closest(".tmd-fill")) { ST.fill = !ST.fill; save(ST); if (R().hooks.live) R().hooks.live("fill", true); render(pane); }
    });
  }

  // the step grid: add / remove / move / paint, live while dragging (the notes follow when the drag ends)
  function gridEvents(pane, el, cur) {
    const R = () => ROWS.get(pane);
    let g = null;
    const stepAt = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.closest ? t.closest(".tmd-step") : null; };
    const base = () => { const st = ST.hits ? ST.hits.slice() : presetSteps(cur("rhythm")); const ln = ST.hits && ST.hitLen ? ST.hitLen.slice() : new Array(16).fill(null); return { st, ln }; };
    const show = () => { const box = el.querySelector(".tmd-rgrid .tmd-steps"); if (!box) return; box.querySelectorAll(".tmd-step").forEach((b, k) => { b.classList.toggle("on", !!ST.hits[k]); b.setAttribute("aria-pressed", String(!!ST.hits[k])); });
      const cv = el.querySelector(".tmd-rgrid .tmd-cv"); if (cv) cv.textContent = ST.rhyName || "CUSTOM"; const c = el.querySelector(".tmd-rgrid"); if (c) c.classList.remove("is-auto"); const ai = el.querySelector(".tmd-rgrid .tmd-rname i"); if (ai) ai.remove(); };
    const write = (st, ln, named) => { ST.hits = st; ST.hitLen = ln; if (!named) ST.rhyName = null; if (ST.rhythm == null) ST.rhythm = cur("rhythm"); show(); if (g && R().hooks.live) R().hooks.live("hits", false); };   // the chords there follow while dragging
    const done = () => { save(ST); if (R().hooks.live) R().hooks.live("hits", true); render(pane); };
    el.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".tmd-step"); if (!b || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const k = +b.dataset.step, { st, ln } = base();
      if (st[k]) g = { mode: "move", at: k, from: k, moved: false, id: e.pointerId };
      else { st[k] = 1; ln[k] = null; write(st, ln); g = { mode: "paint", id: e.pointerId, moved: true }; }
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
    });
    el.addEventListener("pointermove", (e) => {
      if (!g || e.pointerId !== g.id) return;
      const b = stepAt(e.clientX, e.clientY); if (!b || !el.contains(b)) return;
      const k = +b.dataset.step, { st, ln } = base();
      if (g.mode === "paint") { if (!st[k]) { st[k] = 1; ln[k] = null; write(st, ln); } return; }
      if (k === g.at || st[k]) return;   // move the hit onto an empty step
      st[k] = st[g.at]; ln[k] = ln[g.at]; st[g.at] = 0; ln[g.at] = null; g.at = k; g.moved = true; write(st, ln, true);
    });
    const end = (e) => {
      if (!g || (e && e.pointerId !== g.id)) return;
      const d = g; g = null;
      if (d.mode === "move" && !d.moved) {   // a click on a lit step takes it away (a bar never goes empty)
        if (e && e.type === "pointercancel") return;
        const { st, ln } = base(); if (st.filter(Boolean).length > 1) { st[d.at] = 0; ln[d.at] = null; write(st, ln); } else return;
      }
      done();
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("contextmenu", (e) => {   // right-click = take the hit away
      const b = e.target.closest(".tmd-step"); if (!b) return; e.preventDefault();
      const k = +b.dataset.step, { st, ln } = base(); if (!st[k] || st.filter(Boolean).length < 2) return;
      st[k] = 0; ln[k] = null; write(st, ln); done();
    });
  }

  // the NOTE ROW: add / remove / move / resize note blocks, live while dragging; the preset chips
  function rowEvents(pane, el, cur) {
    const R = () => ROWS.get(pane);
    let g = null;
    const P = () => { RP = rsOf((R() && R().part) || "chords"); };   // BASS ROW: the row edits the bass's own rhythm in BASS mode
    const box = () => el.querySelector(".tmd-nrcard .tmd-nrow");
    const base = () => { P(); const r = rowNow(cur("rhythm"), null, cur("pace")), st = r.st.slice(), ln = new Array(st.length).fill(null); for (const [a, l] of rowNotes(st, r.ln, null)) ln[a] = Math.max(1, Math.round(l)); return { st, ln }; };
    const nextOf = (st, k) => { for (let j = k + 1; j < st.length; j++) if (st[j]) return j; return st.length; };
    const pos = (e) => { const b = box().getBoundingClientRect(), N = NS();
      if (mlOn()) { const { LS, lanes } = laneOf(N), r = Math.max(0, Math.min(lanes - 1, Math.floor(((e.clientY - b.top) / Math.max(1, b.height)) * lanes))), lr = r;
        return Math.max(0, Math.min(N, lr * LS + Math.max(0, Math.min(LS, ((e.clientX - b.left) / Math.max(1, b.width)) * LS)))); }
      return Math.max(0, Math.min(N, ((e.clientX - b.left) / Math.max(1, b.width)) * N)); };
    const paint = () => {
      const b = box(); if (!b) return; const t = document.createElement("div"); t.innerHTML = rowHtml(RP.hits, RP.hitLen, null); b.replaceWith(t.firstElementChild);
      const c = el.querySelector(".tmd-nrcard"); if (!c) return; c.classList.remove("is-auto"); const ai = c.querySelector(".tmd-ct i"); if (ai) ai.remove();
      const cv = c.querySelector(".tmd-cv"); if (cv) cv.textContent = RP.rhyName || "CUSTOM";
      c.querySelectorAll(".tmd-np").forEach((x) => { const q = QPRE.find((y) => y.id === x.dataset.pre); x.classList.toggle("on", q ? !!preOn(q) : !RP.hits); });
      const dn = c.querySelector(".tmd-npdd-n"); if (dn) dn.textContent = preName(); popOn();
    };
    const write = (st, ln, named) => { RP.hits = st; RP.hitLen = ln; if (!named) RP.rhyName = null; if (!isB() && ST.rhythm == null) ST.rhythm = cur("rhythm"); paint(); if (g && R().hooks.live) R().hooks.live("hits", false); };
    const done = () => { save(ST); if (R().hooks.live) R().hooks.live("hits", true); render(pane); };
    const mine = () => !(el.__tbEdit && tbEditOn());   // TOOLBAR ROW EDIT: the bar's own editor (tbEdit) takes the row
    el.addEventListener("pointerdown", (e) => {
      if (!mine()) return;
      const row = e.target.closest(".tmd-nrow"); if (!row || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const { st, ln } = base(), x = pos(e), n = e.target.closest(".tmd-nn");
      if (n) {
        const k = +n.dataset.step, r = n.getBoundingClientRect();
        const ml = mlOn(), lastP = !n.classList.contains("goes");
        const edge = ml ? lastP && (e.target.closest(".tmd-nn-e") || e.clientX > r.right - Math.min(8, Math.max(3, r.width / 3))) : rbOn() && r.width < 21 ? e.clientX > r.right - Math.max(2, r.width / 3) : e.target.closest(".tmd-nn-e") || e.clientX > r.right - 7;   // ROW BARS: small notes keep a grab middle
        g = edge ? { mode: "size", k, id: e.pointerId, moved: false, tap: !editOn(), orig: editOn() ? { st: st.slice(), ln: ln.slice() } : null } : { mode: "move", at: k, from: k, off: Math.floor(x) - k, len: ln[k], moved: false, id: e.pointerId, orig: editOn() ? { st: st.slice(), ln: ln.slice() } : null };
        if (ml) ghost(null);
      } else {
        const k = Math.min(st.length - 1, Math.floor(x)); if (st[k]) return;
        st[k] = 1; ln[k] = Math.min(2, nextOf(st, k) - k);
        // the note before stops where the new one starts
        g = { mode: "size", k, id: e.pointerId, moved: true, made: true }; write(st, ln);
      }
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
    });
    // MIDI LOOK: a faint note under the mouse where a click would add one
    const ghost = (e) => {
      const b = box(), gh = b && b.querySelector(".tmd-nghost"); if (!gh) return;
      if (!e || e.target.closest(".tmd-nn") || !e.target.closest(".tmd-nrow")) { gh.hidden = true; return; }
      P(); const N = NS(), { LS, lanes } = laneOf(N), k = Math.min(N - 1, Math.floor(pos(e))), r = Math.floor(k / LS), base0 = rowNow(cur("rhythm"), null, cur("pace")).st;
      if (base0[k]) { gh.hidden = true; return; }
      let nx = N; for (let j = k + 1; j < N; j++) if (base0[j]) { nx = j; break; }
      const w = Math.min(2, nx - k, LS - (k - r * LS));
      const lane = b.querySelectorAll(".tmd-nlane")[r]; if (!lane) return; if (gh.parentElement !== lane) lane.append(gh);
      gh.hidden = false; gh.style.left = `${((k - r * LS) / LS) * 100}%`; gh.style.width = `calc(${(w / LS) * 100}% - 2px)`; void lanes;
    };
    el.addEventListener("pointerleave", () => { if (mine()) ghost(null); });
    el.addEventListener("pointermove", (e) => {
      if (!mine()) return;
      if (!g && mlOn()) { ghost(e); return; }
      if (!g || e.pointerId !== g.id || !box()) return;
      const x = pos(e), { st, ln } = base();
      if (g.mode === "size" && g.orig) {   // EDIT LIKE MIDI: the end can go into the next note, which gets shorter (its end stays)
        const o = g.orig, s2 = o.st.slice(), l2 = o.ln.slice(), nx = nextOf(s2, g.k), nEnd = nx < s2.length ? nx + (l2[nx] || 1) : s2.length;
        const L = Math.max(1, Math.min((nx < s2.length ? nEnd - 1 : s2.length) - g.k, Math.round(x) - g.k));
        if (nx < s2.length && g.k + L > nx) { const ns = g.k + L; s2[nx] = 0; l2[nx] = null; s2[ns] = 1; l2[ns] = nEnd - ns; }
        l2[g.k] = L;
        if (L !== ln[g.k] || s2.some((v, j) => !!v !== !!st[j])) { g.moved = true; write(s2, l2, false); }
        return;
      }
      if (g.mode === "size") {
        const L = Math.max(1, Math.min(nextOf(st, g.k) - g.k, Math.round(x) - g.k));
        if (L !== ln[g.k]) { ln[g.k] = L; g.moved = true; write(st, ln, !g.made); }
        return;
      }
      const ns = Math.max(0, Math.min(st.length - 1, Math.floor(x) - g.off));
      if (g.orig) {   // EDIT LIKE MIDI: from where the drag started, so notes passed over keep their lengths
        if (ns === g.at || (g.orig.st[ns] && ns !== g.from)) return;
        const s2 = g.orig.st.slice(), l2 = g.orig.ln.slice(); s2[g.from] = 0; l2[g.from] = null; s2[ns] = 1; l2[ns] = g.len; g.at = ns; g.moved = true; write(s2, l2, true); return;
      }
      if (ns === g.at || st[ns]) return;
      st[g.at] = 0; ln[g.at] = null; st[ns] = 1; ln[ns] = g.len; g.at = ns; g.moved = true; write(st, ln, true);
    });
    const end = (e) => {
      if (!g || (e && e.pointerId !== g.id)) return;
      const d = g; g = null;
      if (!editOn() && (d.mode === "move" || (d.tap && mlOn())) && !d.moved) {   // a click on a note takes it away (a bar never goes empty)
        if (e && e.type === "pointercancel") return;
        const { st, ln } = base(); if (st.filter(Boolean).length < 2) return;
        const at = d.mode === "move" ? d.at : d.k; st[at] = 0; ln[at] = null; write(st, ln);
      } else if (!d.moved) return;
      done();
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("contextmenu", (e) => {   // right-click a note = gone
      if (!mine()) return;
      const n = e.target.closest(".tmd-nrcard .tmd-nn"); if (!n) return; e.preventDefault();
      const k = +n.dataset.step, { st, ln } = base(); if (st.filter(Boolean).length < 2) return;
      st[k] = 0; ln[k] = null; write(st, ln); done();
    });
    el.addEventListener("click", (e) => {   // a preset chip: its notes on the row, still editable after
      const b = e.target.closest(".tmd-nrcard .tmd-np"); if (!b) return; e.stopPropagation(); P();
      if (b.dataset.bars) { const v = b.dataset.bars === "-" ? RB() - 1 : b.dataset.bars === "+" ? RB() + 1 : +b.dataset.bars; if (!rbOk(v)) return; RP.rowBars = v; fitHits(); done(); return; }   // 4 / 8 / 16 BARS, or the - / + stepper
      if (applyPre(b.dataset.pre)) done();
    });
    const applyPre = (id) => {
      if (!id) { RP.hits = null; RP.hitLen = RP.rhyName = null; RP.rowSpd = 1; if (!isB()) ST.rhythm = null; return true; }
      const q = QPRE.find((y) => y.id === id); if (!q) return false; const { st, ln } = qSteps(q); RP.hits = st; RP.hitLen = ln; RP.rhyName = q.n;
      if (spdOn() && SPD() > 1) { const x = respeed(st, ln, SPD()); RP.hits = x.st; RP.hitLen = x.ln; }   // a new rhythm plays at the picked speed
      if (!isB() && ST.rhythm == null) ST.rhythm = cur("rhythm"); return true;
    };
    // the RHYTHMS dropdown (ROW LOOK): AUTO + every preset with its picture; a pick puts it on the row and the list stays
    // open so you can go through them (Esc or a click outside closes it)
    let pop = null, popOff = null, popCat = "classic";
    const popClose = () => { if (pop) { pop.remove(); pop = null; } if (popOff) { document.removeEventListener("pointerdown", popOff, true); window.removeEventListener("keydown", popOff, true); popOff = null; } };
    const popOn = () => { if (!pop) return; P(); pop.querySelectorAll(".tmd-nprow").forEach((x) => { const q = QPRE.find((y) => y.id === x.dataset.pre); x.classList.toggle("on", q ? !!preOn(q) : !RP.hits); }); };
    // INLINE LIST (Eman, 15 Nov 05:14-05:20: "like KILLDRUM: when I press it you hear the rhythm and then you press commit,
    // with the 3 buttons"; "make the presets be underneath the visual tool"): the list opens in the column right under the
    // rhythm box. Pressing a rhythm puts it on the row and plays the clip from its start, so you hear it on your chords;
    // COMMIT keeps it (and adds it to HISTORY), closing the list without COMMIT puts the old rhythm back. Listen = play /
    // stop, History = every rhythm you committed here. KT2_DICE_RHYINLINE_OFF = the floating list (a pick keeps at once)
    const inOn = () => !window.KT2_DICE_RHYINLINE_OFF && !!el.closest(".tmd-sidecol");
    let pv = null, ipMode = "list";
    const snapR = () => ({ hits: RP.hits ? RP.hits.slice() : null, hitLen: RP.hitLen ? RP.hitLen.slice() : null, rhyName: RP.rhyName || null, rowBars: RP.rowBars, rowSpd: RP.rowSpd, rhythm: isB() ? undefined : ST.rhythm });
    const putR = (sn) => { RP.hits = sn.hits ? sn.hits.slice() : null; RP.hitLen = sn.hitLen ? sn.hitLen.slice() : null; RP.rhyName = sn.rhyName; RP.rowBars = sn.rowBars; RP.rowSpd = sn.rowSpd; if (!isB() && sn.rhythm !== undefined) ST.rhythm = sn.rhythm; };
    const playing = () => !!(typeof ui !== "undefined" && ui && ui.transport && ui.transport.playing);
    const clipStart = () => { try { const S = window.TmMidi && TmMidi._s && TmMidi._s(), c = S && S.clipId ? findClip(S.clipId) : null; return c ? c.start : null; } catch (e) { return null; } };
    const hear = (on) => { if (typeof run !== "function") return; if (on) { if (playing()) return; const t0 = clipStart(); (t0 != null ? run("setPosition", { time: t0 }) : Promise.resolve()).then(() => (playing() ? null : run("togglePlay"))); if (pv) pv.started = true; } else if (playing()) run("togglePlay"); };
    const histOf = () => (Array.isArray(RP.rhyHist) ? RP.rhyHist : (RP.rhyHist = []));
    const hKey = (h) => JSON.stringify([h.hits, h.hitLen]);
    const ipHead = () => { if (!pop) return; const ear = pop.querySelector(".tmd-ipear"), hb = pop.querySelector(".tmd-iphist"), cm = pop.querySelector(".tmd-ipcommit");
      if (ear) ear.classList.toggle("lit", playing()); if (hb) hb.classList.toggle("lit", ipMode === "hist"); if (cm) cm.disabled = !pv; };
    const ipFill = () => {
      if (!pop) return; const body = pop.querySelector(".tmd-ipbody"); if (!body) return;
      const rowOf = (q) => `<button type="button" class="tmd-nprow" data-pre="${q.id}"${q.t ? ` title="${esc(q.t)}"` : ""}><span>${esc(q.n)}</span>${miniHtml(q.h, q.len)}</button>`;
      if (ipMode === "hist") {
        const H = histOf().slice().reverse(), now = hKey({ hits: RP.hits, hitLen: RP.hitLen });
        body.className = "tmd-ipbody is-hist";
        body.innerHTML = H.length ? H.map((h, k) => { const d = new Date(h.t || 0), tm = isFinite(d) ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
          const hs = []; (h.hits || []).forEach((x, i) => { if (x) hs.push([i % 16, (h.hitLen && h.hitLen[i]) || 2]); });
          return `<button type="button" class="tmd-nprow tmd-iph${hKey(h) === now ? " on" : ""}" data-h="${H.length - 1 - k}"><span>${esc(h.name || "CUSTOM")} <em>${tm}</em></span>${miniHtml(hs.filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i))}</button>`; }).join("")
          : `<div class="tmd-ipnone">Nothing committed yet. Press a rhythm, then COMMIT.</div>`;
      } else if (QCATS) {
        const here = QPRE.find(preOn); if (here && !pv) popCat = here.cat; if (!QCATS.some((c) => c.id === popCat)) popCat = QCATS[0].id;
        body.className = "tmd-ipbody has-cats";
        body.innerHTML = `<div class="tmd-npcats">${QCATS.map((c) => `<button type="button" class="tmd-npcat${c.id === popCat ? " on" : ""}" data-cat="${c.id}">${esc(c.n)}<em>${QPRE.filter((q) => q.cat === c.id).length}</em></button>`).join("")}</div><div class="tmd-nplist">${QCATS.map((c) => `<div class="tmd-npgrp" data-cat="${c.id}"${c.id === popCat ? "" : " hidden"}>${QPRE.filter((q) => q.cat === c.id).map(rowOf).join("")}</div>`).join("")}</div>`;
      } else { body.className = "tmd-ipbody"; body.innerHTML = `<div class="tmd-nplist">${QPRE.map(rowOf).join("")}</div>`; }
      popOn(); if (pv && pv.id) { const t = pop.querySelector(`.tmd-nprow[data-pre="${pv.id}"]`); if (t) t.classList.add("pvon"); }
      ipHead();
    };
    const ipPreview = (apply, id) => { P(); if (!pv) pv = { snap: snapR(), started: false }; pv.id = id; apply(); done(); hear(true); popOn(); pop && pop.querySelectorAll(".tmd-nprow").forEach((x) => x.classList.toggle("pvon", id != null && x.dataset.pre === id)); ipHead(); };
    const ipCommit = () => { if (!pv) return; P(); const H = histOf(); if (!H.length) H.push({ ...pv.snap, name: pv.snap.rhyName || (pv.snap.hits ? "CUSTOM" : "AUTO"), t: Date.now(), first: true });
      if (RP.hits) H.push({ hits: RP.hits.slice(), hitLen: RP.hitLen ? RP.hitLen.slice() : null, rhyName: RP.rhyName, rowBars: RP.rowBars, name: preName(), t: Date.now() });
      if (H.length > 30) H.splice(1, H.length - 30);
      const started = pv.started; pv = null; save(ST); if (started) hear(false); ipClose(true); };
    const ipRevert = () => { if (!pv) return; const sn = pv.snap, started = pv.started; pv = null; P(); putR(sn); done(); if (started) hear(false); };
    const ipClose = (kept) => { if (!kept) ipRevert(); if (pop) { pop.remove(); pop = null; } const R0 = R(); if (R0) R0.ipop = null; ipMode = "list";
      if (popOff) { window.removeEventListener("keydown", popOff, true); popOff = null; } };
    const ipOpen = () => {
      P(); pop = document.createElement("div"); pop.className = "tmd-ipop";
      pop.innerHTML = `<div class="tmd-iphead"><button type="button" class="tmd-nprow tmd-ipauto" data-pre=""><span>AUTO</span><em>${isB() ? "the dice picks the groove" : "the dice picks"}</em></button>`
        + `<button type="button" class="tmd-ipico tmd-ipear" title="Listen: play / stop the clip with this rhythm"><svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="6" width="2" height="4" rx="1"/><rect x="5.5" y="3" width="2" height="10" rx="1"/><rect x="9" y="5" width="2" height="6" rx="1"/><rect x="12.5" y="7" width="2" height="2" rx="1"/></svg></button>`
        + `<button type="button" class="tmd-ipico tmd-iphist" title="History: every rhythm you committed here. Press one to hear it, COMMIT to go back to it"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8"/><path d="M2.4 2.2v2.6h2.6"/><path d="M8 5v3.2l2.2 1.4"/></svg></button>`
        + `<button type="button" class="tmd-ipcommit" title="Keep the rhythm you are hearing. Close the list without it and the old one comes back" disabled>COMMIT</button>`
        + `<button type="button" class="tmd-ipx" title="Close (the old rhythm comes back if you did not COMMIT)" aria-label="Close">\u2715</button></div><div class="tmd-ipbody"></div>`;
      pop.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      pop.addEventListener("click", (ev) => {
        ev.stopPropagation(); const t = ev.target;
        if (t.closest(".tmd-ipx")) return ipClose(false);
        if (t.closest(".tmd-ipcommit")) return ipCommit();
        if (t.closest(".tmd-ipear")) { hear(!playing()); setTimeout(ipHead, 120); return; }
        if (t.closest(".tmd-iphist")) { ipMode = ipMode === "hist" ? "list" : "hist"; ipFill(); return; }
        const c = t.closest(".tmd-npcat"); if (c) { popCat = c.dataset.cat; pop.querySelectorAll(".tmd-npcat").forEach((x) => x.classList.toggle("on", x === c)); pop.querySelectorAll(".tmd-npgrp").forEach((x) => { x.hidden = x.dataset.cat !== popCat; }); return; }
        const hb = t.closest(".tmd-iph"); if (hb) { const h = histOf()[+hb.dataset.h]; if (h) ipPreview(() => putR(h), null); pop.querySelectorAll(".tmd-iph").forEach((x) => x.classList.toggle("pvon", x === hb)); return; }
        const r = t.closest(".tmd-nprow"); if (r) { const id = r.dataset.pre; if (pv && pv.id === id && id) { hear(!playing()); setTimeout(ipHead, 120); return; } ipPreview(() => applyPre(id), id); }
      });
      popOff = (ev) => { if (ev.key === "Escape" && pop) { ev.preventDefault(); ev.stopImmediatePropagation(); ipClose(false); } };
      window.addEventListener("keydown", popOff, true);
      const R0 = R(); if (R0) R0.ipop = pop; ipPlace(pane); ipFill();
    };
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".tmd-nrcard .tmd-npdd"); if (!b) return; e.stopPropagation();
      if (inOn() || (pop && pop.classList.contains("tmd-ipop"))) { if (pop) return ipClose(false); return ipOpen(); }
      if (pop) return popClose();
      P(); const r0 = b.getBoundingClientRect();
      pop = document.createElement("div"); pop.className = "tmd-nppop kt2-pop";
      const autoRow = `<button type="button" class="tmd-nprow" data-pre=""><span>AUTO</span><em>${isB() ? "the dice picks the groove" : "the dice picks"}</em></button>`;
      const rowOf = (q) => `<button type="button" class="tmd-nprow" data-pre="${q.id}"${q.t ? ` title="${esc(q.t)}"` : ""}><span>${esc(q.n)}</span>${miniHtml(q.h, q.len)}</button>`;
      if (QCATS) {   // side bar of categories + the rhythms of the picked one
        const here = QPRE.find(preOn); if (here) popCat = here.cat; if (!QCATS.some((c) => c.id === popCat)) popCat = QCATS[0].id;
        pop.classList.add("has-cats");
        pop.innerHTML = `<div class="tmd-npcats">${QCATS.map((c) => `<button type="button" class="tmd-npcat${c.id === popCat ? " on" : ""}" data-cat="${c.id}">${esc(c.n)}<em>${QPRE.filter((q) => q.cat === c.id).length}</em></button>`).join("")}</div><div class="tmd-nplist">${autoRow}${QCATS.map((c) => `<div class="tmd-npgrp" data-cat="${c.id}"${c.id === popCat ? "" : " hidden"}>${QPRE.filter((q) => q.cat === c.id).map(rowOf).join("")}</div>`).join("")}</div>`;
        pop.addEventListener("click", (ev) => { const t = ev.target.closest(".tmd-npcat"); if (!t) return; ev.stopPropagation(); popCat = t.dataset.cat;
          pop.querySelectorAll(".tmd-npcat").forEach((x) => x.classList.toggle("on", x === t)); pop.querySelectorAll(".tmd-npgrp").forEach((x) => { x.hidden = x.dataset.cat !== popCat; }); const l = pop.querySelector(".tmd-nplist"); if (l) l.scrollTop = 0; });
      } else pop.innerHTML = autoRow + QPRE.map(rowOf).join("");
      pop.style.left = Math.round(r0.left) + "px"; pop.style.top = Math.round(r0.bottom + 4) + "px"; pop.style.maxHeight = Math.max(160, window.innerHeight - r0.bottom - 16) + "px";
      document.body.append(pop); popOn();
      { const pr = pop.getBoundingClientRect(); if (pr.right > window.innerWidth - 8) pop.style.left = Math.max(8, Math.round(window.innerWidth - 8 - pr.width)) + "px"; }
      pop.addEventListener("click", (ev) => { const t = ev.target.closest(".tmd-nprow"); if (!t) return; P(); if (applyPre(t.dataset.pre)) { done(); popOn(); } });
      popOff = (ev) => { if (ev.type === "keydown") { if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); popClose(); } return; } if (pop && !pop.contains(ev.target) && !ev.target.closest(".tmd-npdd")) popClose(); };
      document.addEventListener("pointerdown", popOff, true); window.addEventListener("keydown", popOff, true);
    });
  }

  // the rhythm list: every measured rhythm as a small grid, by group; a tap puts it on the card (the notes follow live)
  // and the list stays open, so you can listen through them; Esc or a click outside closes it
  let rpEl = null, rpOff = null;
  function closeRhyPick() { if (rpEl) { rpEl.remove(); rpEl = null; } if (rpOff) { document.removeEventListener("pointerdown", rpOff, true); document.removeEventListener("keydown", rpOff, true); rpOff = null; } }
  const miniSteps = (st) => `<span class="tmd-rp-g">${st.map((on, k) => `<i class="${on ? "on" : ""}${k % 4 === 0 ? " beat" : ""}"></i>`).join("")}</span>`;
  function rhyPick(pane) {
    const R = ROWS.get(pane), c = R && R.el.querySelector(".tmd-rgrid"); if (!c) return;
    if (rpEl) return closeRhyPick();
    closeMoodPick();
    const D = CR(), here = ST.hits;
    const tile = (r) => { const st = crSteps(r), on = sameSteps(st, here); return `<button type="button" class="tmd-rp${on ? " on" : ""}" data-r="${esc(r.id)}" title="${esc(r.about || (r.bars ? r.bars.toLocaleString() + " bars in the songs" : r.name))}"><span class="tmd-rp-n">${esc(r.name)}</span>${r.bars ? `<span class="tmd-rp-c">${fmt(r.bars)}</span>` : ""}${miniSteps(st)}</button>`; };
    const rows = D.groups.map((g) => { const L = D.list.filter((r) => r.group === g.id); return L.length ? `<div class="tmd-rp-grp"><span class="tmd-rp-h">${esc(g.name)}</span><div class="tmd-rp-tiles">${L.map(tile).join("")}</div></div>` : ""; }).join("");
    rpEl = document.createElement("div"); rpEl.className = "tmd-rhypick"; rpEl.setAttribute("role", "listbox"); rpEl.setAttribute("aria-label", "Rhythms");
    rpEl.innerHTML = `<div class="tmd-rp-top"><button type="button" class="tmd-rp tmd-rp-auto${here ? "" : " on"}" data-r="" title="Back to AUTO">AUTO</button><button type="button" class="tmd-rp tmd-rp-roll" data-roll="1" title="Roll a rhythm">${diceSvg}<span>ROLL</span></button><span class="tmd-rp-src">${fmt(D.bars || 0)} bars \u00b7 880 songs</span></div>${rows}`;
    rpEl.addEventListener("mousedown", (e) => e.stopPropagation());
    rpEl.addEventListener("click", (e) => {
      const b = e.target.closest(".tmd-rp"); if (!b) return;
      if (b.dataset.roll) { if (!randomRhythm()) return; }
      else if (b.dataset.r === "") { ST.hits = null; ST.hitLen = ST.rhyName = null; ST.rhythm = null; }
      else { const r = D.list.find((x) => x.id === b.dataset.r); if (!r) return; useRhythm(r); }
      if (ST.hits && ST.rhythm == null) ST.rhythm = 0;
      save(ST); if (R.hooks.live) R.hooks.live("hits", true); render(pane);
      rpEl.querySelectorAll(".tmd-rp").forEach((t) => t.classList.toggle("on", t.dataset.r === "" ? !ST.hits : !!t.dataset.r && sameSteps(crSteps(D.list.find((x) => x.id === t.dataset.r) || { steps: "" }), ST.hits)));
    });
    document.body.append(rpEl);
    const place = () => { const cc = R.el.querySelector(".tmd-rgrid") || c, b = cc.getBoundingClientRect(), w = rpEl.offsetWidth, h = rpEl.offsetHeight;
      rpEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left)) + "px";
      rpEl.style.top = (b.bottom + 4 + h > innerHeight - 8 ? Math.max(8, b.top - h - 4) : b.bottom + 4) + "px"; };
    place();
    const f = rpEl.querySelector(".tmd-rp.on"); if (f) f.focus({ preventScroll: true });
    rpOff = (e) => { if (e.type === "keydown") { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeRhyPick(); } return; } if (!rpEl.contains(e.target) && !e.target.closest(".tmd-rname, .tmd-rlist")) closeRhyPick(); };
    setTimeout(() => { if (rpOff) { document.addEventListener("pointerdown", rpOff, true); document.addEventListener("keydown", rpOff, true); } }, 0);
  }

  // the mood list: tap the MOOD card and all 18 open under it, darkest to brightest, each in its colour
  let pickEl = null, pickOff = null;
  function closeMoodPick() { if (pickEl) { pickEl.remove(); pickEl = null; } if (pickOff) { document.removeEventListener("pointerdown", pickOff, true); document.removeEventListener("keydown", pickOff, true); pickOff = null; } }
  function moodPick(pane) {
    const R = ROWS.get(pane), c = R && R.el.querySelector('.tmd-card[data-dial="mood"]'); if (!c) return;
    if (pickEl) return closeMoodPick();
    const curI = moodNow() ? ST.mood : null;
    pickEl = document.createElement("div"); pickEl.className = "tmd-moodpick"; pickEl.setAttribute("role", "listbox"); pickEl.setAttribute("aria-label", "Mood");
    pickEl.innerHTML = `<button type="button" class="tmd-mp${curI == null ? " on" : ""}" data-m="" title="The prompt's words alone"><i style="--mood:#c4b5fd"></i>AUTO</button>` +
      MOODS.map((m, i) => `<button type="button" class="tmd-mp${curI === i ? " on" : ""}" data-m="${i}" title="${esc(m.feel)}"><i style="--mood:${moodCol(m.b)}"></i>${m.n}</button>`).join("") +
      `<span class="tmd-mp-ax"><b>DARK</b><b>BRIGHT</b></span>`;
    pickEl.addEventListener("mousedown", (e) => e.stopPropagation());
    pickEl.addEventListener("click", (e) => {
      const b = e.target.closest(".tmd-mp"); if (!b) return;
      closeMoodPick();
      if (b.dataset.m === "") { ST.mood = null; save(ST); render(pane); if (R.hooks.live) R.hooks.live("mood", true); fromChip(pane); }
      else setCard(pane, "mood", +b.dataset.m, true);
      const nc = R.el.querySelector('.tmd-card[data-dial="mood"]'); if (nc) nc.focus({ preventScroll: true });
    });
    document.body.append(pickEl);
    const b = c.getBoundingClientRect(), w = pickEl.offsetWidth, h = pickEl.offsetHeight;
    pickEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left)) + "px";
    pickEl.style.top = (b.bottom + 4 + h > innerHeight - 8 ? Math.max(8, b.top - h - 4) : b.bottom + 4) + "px";
    const f = pickEl.querySelector(".tmd-mp.on"); if (f) f.focus({ preventScroll: true });
    pickOff = (e) => { if (e.type === "keydown") { if (e.key === "Escape") { closeMoodPick(); c.focus(); } return; } if (!pickEl.contains(e.target) && !e.target.closest('.tmd-card[data-dial="mood"]')) closeMoodPick(); };
    setTimeout(() => { if (pickOff) { document.addEventListener("pointerdown", pickOff, true); document.addEventListener("keydown", pickOff, true); } }, 0);
  }
  // ---- THE DICE CHAT (Eman, 9 Nov 01:38) -------------------------------------------------------------------------
  // A box left of ROLL with the history. Plain words change the cards and the chords already there: a mood word,
  // "darker" / "brighter", "last chord darker", "chord 2 brighter", "busier", "simpler", "richer", "higher", "lower",
  // "wider", "lands home", "more tension", "wilder", "more pop", "more alternative", "fill", "auto", "roll", "undo".
  // No AI: the words are read here (free, instant, offline). Anything it doesn't know gets an honest answer.
  // Mockup: https://claude.ai/artifact/1yErBTVZiNgGDvwnrE7F7X. KT2_DICE_CHAT_OFF = no chat box.
  const CHAT = { log: [], hist: [] };   // log: [{ who: "me"|"bot", h }], hist: undo snapshots
  const chatOn = () => !window.KT2_DICE_CHAT_OFF;
  const BYB = MOODS.map((m, i) => i);   // MOODS are already darkest -> brightest
  const NUMW = { first: 0, one: 0, second: 1, two: 1, third: 2, three: 2, fourth: 3, four: 3, fifth: 4, five: 4, sixth: 5, six: 5, seventh: 6, eighth: 7 };
  // CHAT LOOK (Eman, 15 Nov 05:20: "make the chat window look more like a chat window, now you barely understand what
  // it is"): a header with the dice, bubbles (yours right in purple, the dice's left in grey), tap-to-say chips when it
  // is empty, a round input with a send button. KT2_DICE_CHAT2_OFF = the plain box
  const chat2On = () => !window.KT2_DICE_CHAT2_OFF;
  const CHIPS = ["villain", "last chord darker", "busier", "simpler", "undo"];
  function chatHtml() {
    if (chat2On()) {
      const log = CHAT.log.slice(-30).map((m) => `<div class="tmd-cm ${m.who}">${m.h}</div>`).join("")
        || `<div class="tmd-cm bot">Tell me what to change.</div><div class="tmd-cchips">${CHIPS.map((c) => `<button type="button" class="tmd-cchip" data-say="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
      return `<div class="tmd-chat is-c2"><div class="tmd-chat-h"><span class="tmd-chat-av" aria-hidden="true"></span>DICE CHAT</div><div class="tmd-chat-log" id="tmd-chat-log">${log}</div><form class="tmd-chat-f" id="tmd-chat-f"><input id="tmd-chat-in" autocomplete="off" spellcheck="false" placeholder="Message the dice..." aria-label="Tell the dice what to change"><button type="submit" aria-label="Send"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form></div>`;
    }
    const log = CHAT.log.slice(-30).map((m) => `<div class="tmd-cm ${m.who}">${m.h}</div>`).join("") || `<div class="tmd-cm bot dim">villain \u00b7 last chord darker \u00b7 busier \u00b7 undo</div>`;
    return `<div class="tmd-chat"><div class="tmd-chat-log" id="tmd-chat-log">${log}</div><form class="tmd-chat-f" id="tmd-chat-f"><input id="tmd-chat-in" autocomplete="off" spellcheck="false" placeholder="say: last chord darker" aria-label="Tell the dice what to change"><button type="submit" aria-label="Send">\u21b5</button></form></div>`;
  }
  const NAMEOF = (d, R) => { const { V } = resolve(R.hooks.prompt ? R.hooks.prompt() : "", R.part || "chords"); const i = Math.max(0, Math.min(nSteps(d) - 1, idxOf(d, d === "stack" ? V.stack : V[d]))); return d === "stack" ? STACK[i].n : d === "mood" ? (V.mood == null ? "ANY" : MOODS[V.mood].n) : CARDV[d] ? CARDV[d][i] : isSl(d) ? SL[d][0][i] : OPTS[d][i]; };
  function chatSay(pane, text) {
    const R = ROWS.get(pane); if (!R) return;
    let s = " " + text.toLowerCase().replace(/[^a-z0-9\u00e0-\u00ff ]+/g, " ") + " ";
    const said = []; let swap = false, shape = false;
    const snap = () => ({ st: JSON.stringify(ST), notes: R.hooks.notes ? R.hooks.notes() : null });
    // undo: the cards and the notes as they were before the last message
    if (/\b(undo|go back|back|revert|angra|\u00e5ngra)\b/.test(s)) {
      const o = CHAT.hist.pop(); if (!o) return "Nothing to undo yet.";
      const st = JSON.parse(o.st); for (const k of Object.keys(ST)) if (k !== "open") delete ST[k]; Object.assign(ST, st, { open: ST.open }); save(ST);
      render(pane); if (o.notes && R.hooks.setNotes) R.hooks.setNotes(o.notes);
      return "Undone.";
    }
    if (/\b(roll|again|new one|another|reroll|re roll)\b/.test(s) && s.trim().split(/\s+/).length <= 3) { CHAT.hist.push(snap()); if (R.hooks.roll) R.hooks.roll(); return "Rolled."; }
    const before = snap();
    const step = (d, by) => { const { V } = resolve(R.hooks.prompt ? R.hooks.prompt() : "", R.part || "chords"); const cur = Math.max(0, Math.min(nSteps(d) - 1, idxOf(d, d === "stack" ? V.stack : V[d]))), i = Math.max(0, Math.min(nSteps(d) - 1, cur + by)); if (i === cur) return false;
      if (d === "stack") { ST.voices = STACK[i].v; ST.colour = STACK[i].c; } else ST[d] = valOf(d, i); if (d === "rhythm") ST.hits = null;
      if (DiceLive_kind(d) === "swap") swap = true; else shape = true; said.push(`${NAMES[d]} \u2192 <b>${NAMEOF(d, R)}</b>`); return true; };
    const set = (d, i) => { ST[d] = valOf(d, i); if (DiceLive_kind(d) === "swap") swap = true; else shape = true; said.push(`${NAMES[d]} \u2192 <b>${NAMEOF(d, R)}</b>`); };
    const much = /\b(much|lot|way|very|really|super)\b/.test(s) ? 2 : 1;
    // the MOOD TOOLS' words (chords only): matched first and taken out, so "octave up" doesn't also move Voicing
    if (toolsOn() && (R.part || "chords") === "chords") { const got = new Set(); for (const [re, d, i] of TOOL_WORDS) {
      if (!re.test(s)) continue;
      s = s.replace(re, " "); if (got.has(d)) continue; got.add(d);   // the first (most specific) words win: "pedal bass" = PEDAL
      if (ST[d] !== i) { ST[d] = i; shape = true; said.push(`${TOOL(d).n} \u2192 <b>${TOOL(d).v[i]}</b>`); }
    } }
    // a mood word (or a Swedish one the brain knows) picks that mood
    const mood = MOODS.findIndex((m) => new RegExp("\\b" + m.k + "\\b").test(s));
    const dark = /\b(dark|darker|sad|sadder|minor|evil|sinister|moody|gloom|mork|m\u00f6rk|m\u00f6rkare)/.test(s), bright = /\b(bright|brighter|happ|major|light|uplift|hopeful|ljus|ljusare|gladare)/.test(s);
    const dir = dark ? 1 : bright ? -1 : 0;
    const m1 = s.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|last|end|final)\s+(chord|one)\b|\bchord\s+(\d+)\b/);
    if (dir && m1 && R.hooks.chordMood) {   // one chord, the notes there
      const which = m1[1] ? (/last|end|final/.test(m1[1]) ? "last" : NUMW[m1[1]]) : +m1[3] - 1;
      let r = null; for (let k = 0; k < much; k++) { const x = R.hooks.chordMood(which, dir); if (x.err) { if (!r) r = x; break; } r = r && !r.err ? { ...x, before: r.before } : x; }
      if (r.err) return r.err;
      CHAT.hist.push(before);
      return `Chord ${r.n} ${dir > 0 ? "darker" : "brighter"}: ${esc(r.before)} \u2192 <b>${esc(r.after)}</b>`;
    }
    if (mood >= 0 && !m1) { ST.mood = mood; swap = true; said.push(`Mood \u2192 <b>${MOODS[mood].n}</b>`); }
    else if (dir && moodOn()) { const cur = ST.mood == null ? 9 : ST.mood, i = Math.max(0, Math.min(MOODS.length - 1, cur - dir * much * 2)); if (i !== ST.mood) { ST.mood = i; swap = true; said.push(`${dir > 0 ? "Darker" : "Brighter"} \u2192 <b>${MOODS[i].n}</b>`); } }
    const P = R.part || "chords", chords = P === "chords";
    if (/\b(busier|more hits|faster|more energy|bouncier|bouncy|choppier)\b/.test(s)) chords ? step("rhythm", much) : step("dens", much);
    if (/\b(simpler|less busy|calmer|chill|sparse|emptier|slower)\b/.test(s)) { chords ? step("rhythm", -much) : step("dens", -much); if (stackOn() && (chords || P === "arp")) step("stack", -1); }
    if (/\b(jazz|jazzy|richer|colou?rful|fancier|spicier|spicy|more notes|thicker)\b/.test(s)) stackOn() && (chords || P === "arp") ? step("stack", much) : step("colour", much);
    if (/\b(thinner|fewer notes|plainer|plain)\b/.test(s)) stackOn() && (chords || P === "arp") ? step("stack", -much) : step("colour", -much);
    if (/\b(higher|airier|airy|up)\b/.test(s)) step("range", 1);
    if (/\b(lower|deeper|deep|down)\b/.test(s)) step("range", -1);
    if (/\b(wider|bigger|huge|epic|massive|full)\b/.test(s) && stackOn() && (chords || P === "arp")) step("stack", 2);
    if (/\b(resolve|resolves|land|lands|home|finish)\b/.test(s)) set("tension", 0);
    if (/\b(tension|tense|hang|hangs|unresolved|suspense)\b/.test(s) && mood < 0) step("tension", much);
    if (/\b(wilder|wild|weirder|weird|crazy|chaos|surprise)\b/.test(s)) step("random", much);
    if (/\b(safer|normal)\b/.test(s)) step("random", -much);
    if (/\b(pop|poppier|common|radio|mainstream)\b/.test(s)) step("alt", -much * 2);
    if (/\b(alternative|alt|rare|leftfield|underground|experimental)\b/.test(s)) step("alt", much * 2);
    if (chords && /\b(slower chords|longer chords|fewer chords)\b/.test(s)) step("pace", -1);
    if (chords && /\b(faster chords|more chords|quicker chords)\b/.test(s)) step("pace", 1);
    if (chords && topOn() && /\b(top ?line|top voice|topline)\b/.test(s)) { const off = /\b(no|off|without)\b/.test(s); if (ST.top !== !off) { ST.top = !off; shape = true; said.push("TOP LINE \u2192 <b>" + (off ? "OFF" : "ON") + "</b>"); } }
    if (chords && /\b(fill|no gaps|legato|ring)\b/.test(s) && !ST.fill) { ST.fill = true; shape = true; said.push("FILL \u2192 <b>ON</b>"); }
    if (/\b(auto|reset|start over)\b/.test(s)) { for (const d of DIALS.concat(TOOLK)) ST[d] = null; ST.mood = null; ST.hits = null; ST.fill = false; ST.len = null; ST.top = false; swap = true; said.push("every card back to <b>AUTO</b>"); }
    if (!said.length) return null;
    CHAT.hist.push(before); CHAT.hist = CHAT.hist.slice(-40); save(ST);
    render(pane); fromChip(pane);
    if (R.hooks.live) R.hooks.live(swap ? "mood" : "voices", true);   // one live re-roll for the whole message
    return said.join(" \u00b7 ");
  }
  // [words, tool, value]: the specific ones first ("no bass" before "bass")
  const TOOL_WORDS = [
    [/\b(no bass|without bass|bass off|remove the bass)\b/g, "bass", 0], [/\b(pedal|pedal bass|drone bass)\b/g, "bass", 3], [/\b(walking bass|walk the bass|bass walk|walking|walk)\b/g, "bass", 4],
    [/\b(jumpy|jumpy bass|bouncing bass|octave bass)\b/g, "bass", 2], [/\b(far below|sub bass|subby|deep bass|lower bass)\b/g, "bass", 5], [/\b(add (a )?bass|bass ?line|root bass|with bass|more bass|bass)\b/g, "bass", 1],
    [/\b(no lift|no borrowed)\b/g, "lift", 0], [/\b(sudden major|picardy|major ending|end (on|in) major)\b/g, "lift", 3], [/\bdorian\b/g, "lift", 2], [/\blydian\b/g, "lift", 4], [/\b(hero|lift)\b/g, "lift", 1],
    [/\b(no rub|no clash|clean)\b/g, "rub", 0], [/\b(cluster|clusters)\b/g, "rub", 2], [/\b(rub|rubs|clash|clashing|dissonant|dissonance|gritty|grit)\b/g, "rub", 1],
    [/\b(close voicing|closer|tight|tighter)\b/g, "spread", 0], [/\b(wide voicing|spread wide|very wide|wide)\b/g, "spread", 2], [/\b(open voicing|open up|spread out|spread|open)\b/g, "spread", 1],
    [/\b(no slide|no slides|repeat|same notes)\b/g, "motion", 0], [/\b(slide|slides|glide|glides|gliding)\b/g, "motion", 2], [/\b(smooth|smoother|step|steps|voice leading)\b/g, "motion", 1],
    [/\b(swell|swells|swelling)\b/g, "shape", 3], [/\b(build|builds|building|rise|rising|grow|growing|crescendo)\b/g, "shape", 1], [/\b(drop|drops|fade|fades|fading)\b/g, "shape", 2], [/\b(flat|steady)\b/g, "shape", 0],
    [/\b(no octaves|no doubling|no double)\b/g, "octaves", 0], [/\b(octave down|low octave|lower octave|double low)\b/g, "octaves", 1], [/\b(octave up|high octave|higher octave|double high)\b/g, "octaves", 2], [/\b(double|doubled|doubling|octaves)\b/g, "octaves", 3],
  ];
  const DiceLive_kind = (d) => (d === "mood" ? "swap" : window.DiceLive ? DiceLive.kindOf(d === "stack" ? "voices" : d) : "shape");
  function chatEvents(pane, el) {
    el.addEventListener("submit", (e) => {
      const f = e.target.closest("#tmd-chat-f"); if (!f) return; e.preventDefault();
      const inp = f.querySelector("#tmd-chat-in"), t = inp.value.trim(); if (!t) return;
      CHAT.log.push({ who: "me", h: esc(t) });
      let r = null; try { r = chatSay(pane, t); } catch (er) { console.warn("dice chat", er); }
      CHAT.log.push({ who: "bot", h: r == null ? "I don't know that one yet. Try a mood word, darker, brighter, last chord darker, busier, simpler, richer, higher, lower, wilder, pedal, rub, build, undo." : r });
      CHAT.log = CHAT.log.slice(-60);
      const R = ROWS.get(pane); if (R && ST.open) render(pane);
      const ni = R && R.el.querySelector("#tmd-chat-in"); if (ni) { ni.value = ""; ni.focus({ preventScroll: true }); }
      const lg = R && R.el.querySelector("#tmd-chat-log"); if (lg) lg.scrollTop = 1e6;
    });
    el.addEventListener("keydown", (e) => { if (e.target.id === "tmd-chat-in") e.stopPropagation(); });   // typing never reaches the piano roll's keys
    el.addEventListener("click", (e) => {   // CHAT LOOK: a chip says its words
      const c = e.target.closest(".tmd-cchip"); if (!c) return; e.stopPropagation();
      const f = el.querySelector("#tmd-chat-f"), inp = f && f.querySelector("#tmd-chat-in"); if (!inp) return;
      inp.value = c.dataset.say; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }
  function html(pane) {
    const R = ROWS.get(pane), part = R.part || "chords", chordy = part === "chords" || part === "arp";
    const { V, isAuto } = resolve(R.hooks.prompt ? R.hooks.prompt() : "", part);
    const clipBars = R.hooks.bars ? R.hooks.bars() : V.bars;
    const LIVE = window.DiceLive && DiceLive.on();   // DICE LIVE: no LENGTH (the dice fills the pattern), FROM is a chip by the dice
    const L1 = [
      // no LENGTH dial (Eman, 8 Nov 23:24): the dice always fills the whole pattern, so a 64-bar pattern gets 64 bars of chords.
      // KT2_DICE_LENGTH_OLD = the old LENGTH chips (and AUTO resizing the clip) come back
      window.KT2_DICE_LENGTH_OLD ? chips("bars", [1, 2, 4, 8].map((b) => ({ v: b, n: b + (b > 1 ? " BARS" : " BAR"), pic: picBars(b) })), isAuto.bars ? V.bars : clipBars, isAuto.bars, "LENGTH", "How long the clip is (AUTO: as long as the chord loop needs)") : "",
      part === "chords"
        ? chips("pace", [{ v: 0, n: "2 BARS" }, { v: 1, n: "1 BAR" }, { v: 2, n: "HALF" }, { v: 3, n: "BEAT" }].map((it) => ({ ...it, pic: picPace(it.v) })), V.pace, isAuto.pace, "CHANGE", "How often the chord changes")
        : chips("dens", [{ v: 0, n: "FEW" }, { v: 1, n: "SOME" }, { v: 2, n: "MANY" }, { v: 3, n: "RUNS" }].map((it) => ({ ...it, pic: picDens(it.v) })), V.dens, isAuto.dens, "NOTES", "How many notes per bar"),
      part === "chords"
        ? chips("rhythm", RHY.map((r, i) => ({ v: i, n: r.n, pic: picRhy(r) })), V.rhythm, isAuto.rhythm, "RHYTHM", "How each chord is played")
        : chips("swing", [{ v: 0, n: "STRAIGHT" }, { v: 1, n: "SWING" }, { v: 2, n: "HEAVY" }].map((it) => ({ ...it, pic: SWING_PIC(it.v) })), V.swing, isAuto.swing, "FEEL", "Straight or swung"),
      chordy ? chips("voices", [2, 3, 4, 5].map((n) => ({ v: n, n: String(n), pic: picVoices(n), t: ["", "", "Two notes: root and fifth", "Three: a triad", "Four: with the 7th", "Five: with the 9th"][n] })), V.voices, isAuto.voices, "VOICES", "How many notes in each chord (2 to 5: more gets muddy)") : "",
      chips("range", [{ v: 0, n: "LOW" }, { v: 1, n: "MID" }, { v: 2, n: "HIGH" }].map((it) => ({ ...it, pic: picRange(it.v) })), V.range, isAuto.range, "RANGE", "Where on the keyboard it sits"),
    ], L2 = [
      slider("colour", V.colour, isAuto.colour, "COLOUR", "Plain chords to rich ones: 7ths, 9ths, suspensions, borrowed chords"),
      slider("tension", V.tension, isAuto.tension, "TENSION", "Lands back home at the end, or stays hanging"),
      slider("random", V.random, isAuto.random, "RANDOM", "How far from the songs' most common choices the dice may wander"),
      slider("alt", V.alt, isAuto.alt, "POP \u2194 ALT", "Pop: the moves the mainstream songs make. Alt: the moves alternative and experimental songs make, and the rare ones"),
      LIVE ? "" : `<div class="tmd-dial tmd-info" id="tmd-info"></div>`,
    ];
    // a third line only when the clip is full of locked notes (chords): what the dice may add to them
    const full = part === "chords" && R.hooks.full && R.hooks.full();
    const L3 = full ? chips("full", FULL_ITEMS.map((it) => ({ ...it, pic: picFull(it.v) })), isAuto.full ? (R.hooks.fullUsed ? R.hooks.fullUsed() : null) : V.full, isAuto.full, "FULL", "The pattern is full of locked notes: the dice adds to them. AUTO tries a different one each roll") : "";
    // two lines on purpose: the SHAPE (length, change, rhythm, voices, range) and the TASTE (colour, tension, random, pop/alt)
    return `<div class="tmd-line">${L1.join("")}</div><div class="tmd-line">${L2.join("")}</div>${L3 ? `<div class="tmd-line tmd-full">${L3}</div>` : ""}`;
  }
  // INLINE LIST: the open list goes back under the rhythm box after every redraw of the panel
  function ipPlace(pane) {
    const R = ROWS.get(pane), p = R && R.ipop; if (!p) return; const c = R.el.querySelector(".tmd-nrcard"); if (c) { if (c.nextElementSibling !== p) c.after(p); } else p.remove();
  }
  function render(pane) {
    const R = ROWS.get(pane); if (!R) return;
    const CARDS = !window.KT2_DICE_CARDS_OFF;
    const foc = document.activeElement && R.el.contains(document.activeElement) && document.activeElement.closest(".tmd-card");
    const ci = R.el.querySelector("#tmd-chat-in"), chatFoc = ci && document.activeElement === ci, chatTxt = ci ? ci.value : "";
    R.el.innerHTML = CARDS ? cardsHtml(pane) : html(pane);
    if (foc) { const n = R.el.querySelector(`.tmd-card[data-dial="${foc.dataset.dial}"]`); if (n) n.focus({ preventScroll: true }); }
    { const ni = R.el.querySelector("#tmd-chat-in"); if (ni) { ni.value = chatTxt; if (chatFoc) ni.focus({ preventScroll: true }); } const lg = R.el.querySelector("#tmd-chat-log"); if (lg) lg.scrollTop = 1e6; }   // keys keep working after a live redraw
    R.el.classList.toggle("tmd-cardrow", CARDS);
    R.el.hidden = !ST.open;
    R.el.classList.toggle("is-live", !!(R.hooks.armed && R.hooks.armed()));   // the dials will change the notes there now
    fromChip(pane); octMenu(pane);
    const pg = pane.querySelector("#tmm-pg"); if (pg) pg.classList.toggle("tmd-bigopen", !!(ST.open && CARDS && !window.KT2_DICE_BIG_OFF));
    const b = pane.querySelector("#tmm-darrow"); if (b) { b.classList.toggle("on", !!ST.open); b.setAttribute("aria-expanded", String(!!ST.open)); }
    info(pane);
    tbRender(pane);
    sidePlace(pane);
    ipPlace(pane);
    phStart();
    // SIMPLE DICE (Eman, 15 Nov; ui/kt2-dice-simple.js): the cards, chat, MORE, PG MATCH, SLIDE, speed and OCT hide; GENRE and
    // MOOD sit over ROLL. KT2_DICE_SIMPLE_OLD = the full panel
    if (window.KT2DiceSimple) KT2DiceSimple.decorate(R.el, pane);
    if (window.KT2PGMatch && KT2PGMatch.placeDice) KT2PGMatch.placeDice(R.el);   // PG MATCH: its own dot switch right over ROLL
  }
  // RHYTHM IN THE BAR (Eman, 15 Nov 17:16: "add the tool we had, the MIDI ... the remade version less buggy ... so you can
  // select the different rhythms in a dropdown. AND make it fit on the same row"): with SIMPLE DICE on CHORDS, the light-blue
  // rhythm row (real chord hits on AUTO; press a note = move, empty = new, right-click = delete, grid snap, nothing
  // stretches by itself) sits in the TOY MACHINE bar with the RHYTHMS dropdown (CLASSIC / ALTERNATIVE / EXPERIMENTAL).
  // A pick or an edit re-times the chords there at once, and ROLL plays its chords on it. KT2_DICE_TBROW_OFF = not in the bar
  let TBL = false;
  const tbOn = (pane) => rowOn() && mlOn() && !window.KT2_DICE_TBROW_OFF && !!(window.KT2DiceSimple && KT2DiceSimple.on()) && !!pane.querySelector("#tmm-rhy");
  function tbRender(pane) {
    const R = ROWS.get(pane), slot = pane.querySelector("#tmm-rhy"); if (!R || !slot) return;
    const part = R.part || "chords", on = tbOn(pane) && (part === "chords" || tbAllOn()) && !!ST.open && !window.KT2_DICE_CARDS_OFF;
    TBL = on;
    if (slot.hidden === on) { slot.hidden = !on; if (window.TmMidiRefit) setTimeout(window.TmMidiRefit, 0); }
    if (!on) { if (slot.firstChild) slot.innerHTML = ""; return; }
    if (!R.tb) {
      R.tb = slot; slot.addEventListener("mousedown", (e) => e.stopPropagation());
      const cur = (d) => { const r = ROWS.get(pane), { V } = resolve(r.hooks.prompt ? r.hooks.prompt() : "", r.part || "chords"); return Math.max(0, Math.min(nSteps(d) - 1, idxOf(d, V[d]))); };
      rowEvents(pane, slot, cur);
      if (tbEditOn()) { slot.__tbEdit = true; tbEdit(pane, slot, cur); TBP.add(pane); }
    }
    RP = rsOf(part);
    const ed = tbEditOn();
    if (ed && !R.tbDrag) tbFollow(R);
    const { V, isAuto } = resolve(R.hooks.prompt ? R.hooks.prompt() : "", part), i = Math.max(0, Math.min(nSteps("rhythm") - 1, idxOf("rhythm", V.rhythm))), r = rowNow(i, V), au = isAuto.rhythm && !RP.hits;
    const bars = ed && spdOn() ? `<span class="tmd-tbbars" role="group" aria-label="Speed"><button type="button" class="tmd-tbbar tmd-tbcyc tmd-tbspd on" data-tbspd="${cycNext(SPD())}" title="Speed ${SPD()}x">${SPD()}</button></span>`
      : ed && cycOn() ? `<span class="tmd-tbbars" role="group" aria-label="Bars"><button type="button" class="tmd-tbbar tmd-tbcyc on" data-tbbars="${cycNext(RB())}" title="${RB()} bar${RB() > 1 ? "s" : ""}">${RB()}</button></span>`
      : ed ? `<span class="tmd-tbbars" role="group" aria-label="Bars">${[4, 8].map((b) => `<button type="button" class="tmd-tbbar${RB() === b ? " on" : ""}" data-tbbars="${b}" aria-pressed="${RB() === b}" title="${b} bars">${b}</button>`).join("")}</span>` : "";
    slot.innerHTML = `<div class="tmd-card tmd-rgrid tmd-nrcard tmd-tbcard${ed ? " is-tbedit" : ""}${au ? " is-auto" : ""}" data-dial="rhythm" role="group" aria-label="Rhythm"><button type="button" class="tmd-npdd" title="Rhythms"><span class="tmd-npdd-n">${esc(preName())}</span><i>${CARET}</i></button>${bars}<span class="tmd-cp">${ed ? tbRowHtml(tbNotes(r.st, r.ln), r.st.length) : rowHtml(r.st, r.ln, r.vlen)}</span></div>`;
  }
  // TOOLBAR ROW EDIT (Eman, 15 Nov 17:50: "the default should be 4 bars but you can choose 8 as well ... right click removes,
  // click on a midi and you can move it, drag one and the other one becomes smaller just like how the midi works ... click
  // on empty spot to create new one. Test it so it works very cleanly"): the rhythm row in the bar gets its own small
  // editor that works like the piano roll. Notes snap to the piano roll's grid (1/16, 1/8, 1/4) and are never shorter
  // than one grid step; nothing stretches by itself (a gap stays a gap). Press a note and drag = move it (a note it lands
  // on gets shorter, never longer); drag its right end = longer / shorter, pushing into the next note makes that one
  // shorter (its end stays); press an empty spot = a new note one beat long (keep holding and drag to size it);
  // right-click = gone. 4 / 8 next to the row (4 by default), bars 5-8 a little lighter. The row follows the clip: when
  // the chords there change (piano roll edits, a roll) the row shows their hits again. KT2_DICE_TBEDIT_OLD = the v441 row
  const tbEditOn = () => !window.KT2_DICE_TBEDIT_OLD;
  const tbGrid = () => { try { const S = window.TmMidi && TmMidi._s && TmMidi._s(), g = S ? +S.grid : 0; return g > 0 ? Math.max(1, Math.round(g * 4)) : 1; } catch (e) { return 1; } };
  // hits / lengths <-> notes [{ s, l }] in 16th steps, sorted, never overlapping, never shorter than one step
  const tbNotes = (st, ln) => { const n = st.length, on = []; for (let i = 0; i < n; i++) if (st[i]) on.push(i);
    return on.map((a, k) => { const gap = (k + 1 < on.length ? on[k + 1] : n) - a, l = ln && ln[a] > 0 ? Math.round(ln[a]) : gap; return { s: a, l: Math.max(1, Math.min(gap, l)) }; }); };
  const tbArr = (ns, n) => { const st = new Array(n).fill(0), ln = new Array(n).fill(null); for (const x of ns) if (x.s >= 0 && x.s < n && x.l >= 1) { st[x.s] = 1; ln[x.s] = Math.min(x.l, n - x.s); } return { st, ln }; };
  const tbSig = (ns) => ns.map((x) => x.s + "/" + x.l).join(" ");
  // put note a in, the others give way: one that starts before it ends where it starts, one that starts inside it
  // starts where it ends (its end stays); whatever is left shorter than minL goes
  const tbPlace = (others, a, minL) => {
    const out = [], ae = a.s + a.l;
    for (const o of others) { const e = o.s + o.l;
      if (e <= a.s || o.s >= ae) out.push({ s: o.s, l: o.l });
      else if (o.s < a.s) { if (a.s - o.s >= minL) out.push({ s: o.s, l: a.s - o.s }); }
      else if (e - ae >= minL) out.push({ s: ae, l: e - ae });
    }
    out.push({ s: a.s, l: a.l }); return out.sort((x, y) => x.s - y.s);
  };
  const tbRowHtml = (ns, N) => {
    const nb = N / 16; let h = `<span class="tmd-nrow is-midi is-tb" role="group" aria-label="${nb} bars" style="--lb:${nb};--lanes:1"><span class="tmd-nlane" data-lane="0">`;
    if (nb > 4) h += `<s class="tmd-tbband" style="left:${(4 / nb) * 100}%;width:${((nb - 4) / nb) * 100}%"></s>`;
    for (let b = 0; b < nb; b++) h += `<em class="tmd-nb${b % 4 === 0 ? " is-4" : ""}" style="left:${(b / nb) * 100}%">${b + 1}</em>`;
    ns.forEach((x, k) => { const w = x.l / N * 100; h += `<i class="tmd-nn${k === 0 ? " first" : ""}${x.l < 3 ? " xs" : x.l < 5 ? " sm" : ""}" data-step="${x.s}" data-len="${x.l}" style="left:${(x.s / N) * 100}%;width:max(3px, calc(${w}% - 1px))"><u class="tmd-nn-h"></u><b class="tmd-nn-e"></b></i>`; });
    return h + `<s class="tmd-nghost" hidden></s></span></span>`;
  };
  // the clip's hits over the row (only the part the clip covers); null = nothing to follow
  const tbClip = () => { const N = NS(), c = clipRow(N); if (!c) return null; let cn = N;
    try { const S = TmMidi._s(), cl = typeof findClip === "function" && S && S.clipId ? findClip(S.clipId) : null; if (cl && cl.beats > 0) cn = Math.min(N, Math.round(cl.beats * 4)); } catch (e) {}
    return { ns: tbNotes(c.st, c.ln).filter((x) => x.s < cn).map((x) => ({ s: x.s, l: Math.min(x.l, cn - x.s) })), cn }; };
  // ROW = CLIP: when the clip's chords changed since the row last looked (and not by this row), the row takes their hits
  const tbClipSig = (c) => (c ? tbSig(c.ns) + "|" + c.cn : "");
  function tbFollow(R) {
    if (isB() && !tbAllOn()) return; const c = tbClip(), sig = tbClipSig(c);
    if (sig === R.tbSig) return; R.tbSig = sig; if (!c || !c.ns.length || !RP.hits) return;
    fitHits(); const N = NS(), mine = tbNotes(RP.hits, RP.hitLen), keep = mine.filter((x) => x.s >= c.cn), head = mine.filter((x) => x.s < c.cn).map((x) => ({ s: x.s, l: Math.min(x.l, c.cn - x.s) }));
    if (tbSig(head) === tbSig(c.ns)) return;
    const { st, ln } = tbArr(c.ns.concat(keep), N); RP.hits = st; RP.hitLen = ln; RP.rhyName = null; save(ST);
  }
  // the clip changed while nothing redrew the dice (an edit in the piano roll): look again now and then, cheap
  const TBP = new Set();
  setInterval(() => { if (!tbEditOn() || !TBP.size) return; for (const pane of TBP) { if (!pane.isConnected) { TBP.delete(pane); continue; } const R = ROWS.get(pane); if (!R || !R.tb || R.tbDrag || !TBL || R.tb.hidden) continue;
    const prev = RP; RP = rsOf(R.part || "chords"); if (isB() && !tbAllOn()) { RP = prev; continue; } const sig = tbClipSig(tbClip()); RP = prev; if (sig !== R.tbSig) tbRender(pane); } }, 400);
  function tbEdit(pane, el, cur) {
    const R = () => ROWS.get(pane);
    let g = null;
    const P = () => { RP = rsOf((R() && R().part) || "chords"); };
    const row = () => el.querySelector(".tmd-nrow.is-tb");
    const now = () => { P(); const r = rowNow(cur("rhythm"), null, cur("pace")); return tbNotes(r.st, r.ln); };
    const at = (e) => { const b = row().getBoundingClientRect(), N = NS(); return Math.max(0, Math.min(N, ((e.clientX - b.left) / Math.max(1, b.width)) * N)); };
    const paint = (ns) => { const r = row(); if (!r) return; const t = document.createElement("div"); t.innerHTML = tbRowHtml(ns, NS()); r.replaceWith(t.firstElementChild);
      const c = el.querySelector(".tmd-tbcard"); if (c) c.classList.remove("is-auto"); const dn = el.querySelector(".tmd-npdd-n"); if (dn) dn.textContent = preName(); };
    const put = (ns, final) => { P(); const N = NS(), { st, ln } = tbArr(ns, N); RP.hits = st; RP.hitLen = ln; RP.rhyName = null; if (!isB() && ST.rhythm == null) ST.rhythm = cur("rhythm");
      paint(ns); const H = R() && R().hooks; if (H && H.live) H.live("hits", !!final); };
    const finish = () => { save(ST); const r0 = R(); r0.tbDrag = false; P(); r0.tbSig = tbClipSig(tbClip()); render(pane); };   // the clip now holds this edit: not something to follow
    const edgeOf = (n, e) => !!e.target.closest(".tmd-nn-e");   // the grab strip at the right end (the ew-resize cursor shows it)
    el.addEventListener("pointerdown", (e) => {
      if (!tbEditOn() || !row() || !e.target.closest(".tmd-nrow.is-tb") || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const ns = now(), N = NS(), G = tbGrid(), x = at(e), n = e.target.closest(".tmd-nn");
      if (n) {
        const k = ns.findIndex((y) => y.s === +n.dataset.step); if (k < 0) return;
        const a = ns[k], others = ns.filter((_, j) => j !== k);
        g = edgeOf(n, e) ? { mode: "size", a, others, eoff: a.s + a.l - x, id: e.pointerId, last: tbSig(ns) } : { mode: "move", a, others, off: x - a.s, id: e.pointerId, last: tbSig(ns) };
      } else {
        let s = Math.floor(x / G) * G; const inn = ns.find((y) => s >= y.s && s < y.s + y.l); if (inn) s = inn.s + inn.l;
        const nx = ns.find((y) => y.s > s), room = (nx ? nx.s : N) - s; if (s >= N || room < Math.min(G, N - s) || room < 1) return;
        const a = { s, l: Math.min(room, Math.max(G, 4)) }, out = ns.concat([a]).sort((p, q) => p.s - q.s);
        g = { mode: "size", a, others: ns, id: e.pointerId, made: true, last: tbSig(out) }; put(out, false);
      }
      R().tbDrag = true; g.moved = !!g.made; ghost(null);
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
    });
    el.addEventListener("pointermove", (e) => {
      if (!tbEditOn()) return;
      if (!g) { ghost(e); return; }
      if (e.pointerId !== g.id || !row()) return;
      const N = NS(), G = tbGrid(), x = at(e); let out;
      if (g.mode === "move") {
        const l = g.a.l, s = Math.max(0, Math.min(N - l, Math.round((x - g.off) / G) * G));
        out = tbPlace(g.others, { s, l }, Math.min(G, 1e9));
      } else {
        const nx = g.others.find((y) => y.s > g.a.s), cap = nx ? nx.s + nx.l - Math.max(1, Math.min(G, nx.l)) : N;
        const end = Math.max(g.a.s + Math.min(G, N - g.a.s), Math.min(cap, N, Math.round((x + (g.eoff || 0)) / G) * G)), a = { s: g.a.s, l: Math.max(1, end - g.a.s) };
        out = tbPlace(g.others, a, 1);
      }
      const sig = tbSig(out); if (sig === g.last) return;
      g.last = sig; g.moved = true; g.out = out; put(out, false);
    });
    const end = (e) => {
      if (!g || (e && e.pointerId !== g.id)) return;
      const d = g; g = null;
      if (d.moved && d.out) put(d.out, true); else if (d.made) { const H = R().hooks; if (H && H.live) H.live("hits", true); }
      if (d.moved) finish(); else R().tbDrag = false;
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("lostpointercapture", end);
    el.addEventListener("contextmenu", (e) => {   // right-click a note = gone (the last one stays: a rhythm needs a hit)
      if (!tbEditOn() || !e.target.closest(".tmd-nrow.is-tb")) return; e.preventDefault(); e.stopPropagation();
      const n = e.target.closest(".tmd-nn"); if (!n) return; const ns = now(); if (ns.length < 2) return;
      put(ns.filter((y) => y.s !== +n.dataset.step), true); finish();
    });
    el.addEventListener("click", (e) => {   // 4 / 8 BARS: a 4-bar rhythm repeats into 8, 8 cut to 4
      const sb = e.target.closest(".tmd-tbspd");
      if (sb) { e.stopPropagation(); P(); const v = +sb.dataset.tbspd, o = SPD(); if (v === o || !CYC.includes(v)) return; const r = rowNow(cur("rhythm"), null, cur("pace")), x = respeed(r.st, r.ln, v / o);
        RP.hits = x.st; RP.hitLen = x.ln; RP.rowSpd = v; if (!isB() && ST.rhythm == null) ST.rhythm = cur("rhythm"); finish(); return; }
      const b = e.target.closest(".tmd-tbbar"); if (!b) return; e.stopPropagation(); const v = +b.dataset.tbbars; P(); if (v === RB() || !rbOk(v)) return;
      const ns = now(), old = NS(); RP.rowBars = v; const N = NS(), out = [];
      for (let o = 0; o < N; o += old) for (const y of ns) if (o + y.s < N) out.push({ s: o + y.s, l: Math.min(y.l, N - o - y.s) });
      put(out, true); finish();
    });
    // a faint note under the mouse where a press would add one
    const ghost = (e) => {
      const r = row(), gh = r && r.querySelector(".tmd-nghost"); if (!gh) return;
      if (!e || e.target.closest(".tmd-nn") || !e.target.closest(".tmd-nrow.is-tb")) { gh.hidden = true; return; }
      const ns = now(), N = NS(), G = tbGrid(); let s = Math.floor(at(e) / G) * G; const inn = ns.find((y) => s >= y.s && s < y.s + y.l); if (inn) s = inn.s + inn.l;
      const nx = ns.find((y) => y.s > s), room = (nx ? nx.s : N) - s; if (s >= N || room < 1) { gh.hidden = true; return; }
      gh.hidden = false; gh.style.left = `${(s / N) * 100}%`; gh.style.width = `calc(${(Math.min(room, Math.max(G, 4)) / N) * 100}% - 1px)`;
    };
    el.addEventListener("pointerleave", () => { if (!g) ghost(null); });
  }
  // SIDE COLUMN (Eman, 15 Nov 01:19: "take the full menu ... and move them to the side ... then center it all ... so we
  // get more space for the MIDI"): in the big TOY MACHINE window the dice cards sit in a column right of the piano roll,
  // the window grows by that column and stays centred, the roll gets the full height. Not in SPLIT or the footer.
  // KT2_DICE_SIDE_OFF = the cards over the roll
  function sidePlace(pane) {
    const R = ROWS.get(pane); if (!R) return;
    const card = pane.closest("#iw-card"), head = pane.querySelector(".tmm-head");
    const on = !window.KT2_DICE_SIDE_OFF && !!card && !card.classList.contains("split") && !pane.classList.contains("k2t-tmidi") && !!head;
    if (on) { if (R.el.parentElement !== pane) pane.append(R.el); }
    else if (head && R.el.parentElement !== head) head.append(R.el);
    pane.classList.toggle("tmd-sidepane", on); R.el.classList.toggle("tmd-sidecol", on);
    // SIDE CLEAN (Eman, 15 Nov 05:12: "make the roll button be all the way down on the side bar, and clean it up"): STYLE
    // as one row on top, the 4 small cards, RHYTHM, chat, MORE, then ROLL wide at the very bottom (sticks to the bottom
    // while the column scrolls). KT2_DICE_SIDE2_OFF = the ROLL tile top right
    const s2 = on && !window.KT2_DICE_SIDE2_OFF; R.el.classList.toggle("is-side2", s2);
    const bd = R.el.querySelector(".tmd-bigdice"), cards = R.el.querySelector(".tmd-cards");
    if (bd) { if (s2) { if (bd.parentElement !== R.el || bd !== R.el.lastElementChild) R.el.append(bd); } else if (cards && bd.parentElement !== cards) cards.append(bd); }
    if (card) card.classList.toggle("tmd-sidewin", on && !R.el.hidden);
  }
  // what the prompt's words reached in the brain: the words and how many songs stand behind them
  function info(pane, text) {
    const R = ROWS.get(pane), el = R && R.el.querySelector("#tmd-info"); if (!el) return;
    const t = text != null ? text : (R.hooks.prompt ? R.hooks.prompt() : "");
    const lab = `<a class="tmd-lab" href="chord-lab.html" target="_blank" rel="noopener" title="The chord lab: the songs, the findings, the tests">LAB</a>`;
    if (!window.ChordBrain || !t.trim()) { el.innerHTML = `<span class="tmd-lbl">SONGS</span><span class="tmd-songs">${window.ChordBrain ? fmt(ChordBrain.data().songs) + " songs learned " + lab : ""}</span>`; return; }
    const seen = new Set(), d = ChordBrain.describe(withMood(t)).filter((p) => p.n >= 20).sort((a, b) => b.w - a.w).filter((p) => { const k = (p.label || p.id).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    if (!d.length) { el.innerHTML = `<span class="tmd-lbl">SONGS</span><span class="tmd-songs">no known words yet, all ${fmt(ChordBrain.data().songs)} songs ${lab}</span>`; return; }
    el.innerHTML = `<span class="tmd-lbl">FROM</span><span class="tmd-songs">${d.slice(0, 6).map((p) => `<b>${esc(p.label || p.id)}</b> ${fmt(p.n)}`).join(" <i>+</i> ")} ${lab}</span>`;
  }
  const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n || 0);

  // DICE LIVE: the FROM line as a chip right after the dice ("FROM 5"); the words and their song counts show on hover
  function fromChip(pane) {
    const R = ROWS.get(pane); if (!R) return;
    let ch = pane.querySelector("#tmd-from");
    // the chip said which songs the dice learns from ("ALL 234" = all 234 songs, with no words in the prompt). Gone with
    // the PROMPT box (Eman, 15 Nov). KT2_DICE_PROMPT_SHOW = both back
    if (!(window.DiceLive && DiceLive.on()) || !window.KT2_DICE_PROMPT_SHOW) { if (ch) ch.remove(); return; }
    const pg = pane.querySelector("#tmm-pg"); if (!pg) return;
    if (!ch) {
      ch = document.createElement("span"); ch.id = "tmd-from"; ch.className = "tmd-from"; ch.tabIndex = 0;
      ch.innerHTML = '<span class="tmd-from-n"></span><span class="tmd-from-pop" role="tooltip"></span>';
      ch.addEventListener("mousedown", (e) => e.stopPropagation());
      const place = () => { const pop = ch.querySelector(".tmd-from-pop"), b = ch.getBoundingClientRect(); pop.style.top = (b.bottom + 6) + "px"; pop.style.left = Math.max(8, Math.min(innerWidth - 300, b.right - 280)) + "px"; };
      ch.addEventListener("mouseenter", place); ch.addEventListener("focus", place);
      pg.append(ch);
    }
    const F = DiceLive.from(withMood(R.hooks.prompt ? R.hooks.prompt() : ""));
    ch.querySelector(".tmd-from-n").textContent = F.chip;
    const lab = `<a class="tmd-lab" href="chord-lab.html" target="_blank" rel="noopener">LAB</a>`;
    ch.querySelector(".tmd-from-pop").innerHTML = F.items.length ? F.items.slice(0, 6).map((p) => `<b>${esc(p.label)}</b> ${fmt(p.n)}`).join(" <i>+</i> ") + " " + lab : `${fmt(F.songs)} songs ${lab}`;
  }
  function mount(pane, hooks) {
    let R = ROWS.get(pane);
    if (!R) {
      const el = document.createElement("div"); el.className = "tmd-row"; el.id = "tmd-row"; el.hidden = true;
      const head = pane.querySelector(".tmm-head"); (head || pane).append(el);
      R = { el, hooks: hooks || {}, part: "chords" }; ROWS.set(pane, R);
      el.addEventListener("mousedown", (e) => e.stopPropagation());
      if (!window.KT2_DICE_CARDS_OFF) { cardEvents(pane, el); chatEvents(pane, el); }
      el.addEventListener("click", (e) => {
        const b = e.target.closest(".tmd-chip"); if (!b) return;
        const dial = b.closest("[data-dial]").dataset.dial;
        if (b.dataset.auto) { ST[dial] = null; }
        else { const v = dial === "full" ? b.dataset.v : Number(b.dataset.v); ST[dial] = v; if (dial === "bars" && R.hooks.setBars && window.KT2_DICE_LENGTH_OLD) R.hooks.setBars(v); }
        save(ST);
        if (R.hooks.live && dial !== "bars" && dial !== "full") R.hooks.live(dial, true);   // DICE LIVE: reshape the notes there now
        render(pane);
        if (window.KT2Juice && KT2Juice.step) KT2Juice.step("knob", "dice-" + dial);
      });
      el.addEventListener("input", (e) => {
        const r = e.target; if (r.type !== "range") return;
        const d = r.closest(".tmd-dial"), dial = d.dataset.dial, v = r.value / 100;
        ST[dial] = v; save(ST); r.style.setProperty("--p", r.value + "%");
        d.classList.remove("is-auto"); const ab = d.querySelector(".tmd-auto"); if (ab) { ab.classList.remove("on"); ab.setAttribute("aria-pressed", "false"); }
        const [names, pic] = SL[dial];
        d.querySelector(".tmd-val").textContent = names[Math.min(names.length - 1, Math.round(v * (names.length - 1)))];
        d.querySelector(".tmd-pic").innerHTML = pic(v);
        if (R.hooks.live) R.hooks.live(dial, false);   // DICE LIVE: the notes follow while dragging
      });
      el.addEventListener("change", (e) => { const r = e.target; if (r.type !== "range" || !R.hooks.live) return; R.hooks.live(r.closest(".tmd-dial").dataset.dial, true); render(pane); });
      el.addEventListener("wheel", (e) => { if (e.target.type === "range") { e.preventDefault(); e.target.value = +e.target.value + (e.deltaY < 0 ? 4 : -4); e.target.dispatchEvent(new Event("input", { bubbles: true })); } }, { passive: false });
    } else R.hooks = hooks || R.hooks;
    if (R.hooks.owner) OWNER = R.hooks.owner;
    // SIMPLE DICE starts over (Eman, 15 Nov: "start over now with the new data"): once, every card back to AUTO and the
    // panel open, so nothing set on the old cards keeps steering the roll from where it can't be seen
    if (window.KT2DiceSimple && KT2DiceSimple.on() && !ST.simple1) { reset(); ST.simple1 = 1; ST.open = true; save(ST); }
    render(pane);
    return R.el;
  }
  // the dice reads this: every dial resolved (pinned or AUTO), plus which were AUTO and the brain's auto picks
  const get = (text, part) => {
    const { V, isAuto, A, plain } = resolve(text, part);
    const ri = Math.max(0, Math.min(RHY.length - 1, Math.round(V.rhythm)));
    RP = rsOf(part || "chords");
    const drawn = editOn() && !isB() && !!RP.hits && !!RP.hitLen;   // EDIT LIKE MIDI: drawn lengths win over LENGTH / LEGATO
    return { bars: V.bars, pace: V.pace, rhythm: RHY[ri].k, rhythmHits: RHY[ri].hits, voices: V.voices, colour: V.colour, tension: V.tension, random: V.random, pop: Math.max(0, 1 - V.alt), exp: expOn() && V.alt > 1.01, range: V.range, dens: V.dens, swing: V.swing, full: V.full || null, mood: styleOn() ? null : V.mood, moodName: styleOn() || V.mood == null ? null : MOODS[V.mood].k, bassNote: styleOn() && (part || "chords") === "chords" && !!ST.bassNote, hits: RP.hits ? (rbOn() ? tile(RP.hits, NS(), 0) : RP.hits) : null, hitLen: lensOn() && RP.hits && RP.hitLen ? (rbOn() ? tile(RP.hitLen, NS(), null) : RP.hitLen) : null, fill: drawn ? false : simpleOn() && (part || "chords") === "chords" ? V.len === 3 : !!ST.fill, len: drawn ? null : simpleOn() && (part || "chords") === "chords" ? V.len : null, top: topOn() && !!ST.top, auto: plain ? { ...isAuto, pace: false, rhythm: false } : isAuto, brainAuto: A, tools: toolsOn() && (part || "chords") === "chords" ? Object.fromEntries(TOOLK.map((k) => [k, V[k] || 0])) : null };
  };
  const setPart = (pane, part) => { const R = ROWS.get(pane); if (R && R.part !== part) { R.part = part; render(pane); } };
  const toggle = (pane, on) => { ST.open = on == null ? !ST.open : !!on; save(ST); render(pane); };
  const refresh = (pane) => { if (ST.open) render(pane); else { fromChip(pane); octMenu(pane); } };
  const reset = () => { for (const d of DIALS.concat(TOOLK)) ST[d] = null; ST.mood = null; ST.hits = null; ST.hitLen = ST.rhyName = null; ST.fill = false; ST.len = null; ST.top = false; ST.bassNote = false; ST.bassR = null; save(ST); };
  window.TmDice = { mount, get, withMood, MOODS, STACK, tumble, beforeRoll, TOOLK, chat: (pane, t) => chatSay(pane, t), setPart, toggle, refresh, reset, isOpen: () => !!ST.open, info, randomRhythm: (pane) => { if (randomRhythm()) { save(ST); const R = ROWS.get(pane); if (R && R.hooks.live) R.hooks.live("hits", true); if (pane) render(pane); } }, rhythms: () => CR(), state: () => ({ ...ST }), pics: { bars: picBars, pace: picPace, rhythm: picRhy, voices: picVoices, range: picRange, dens: picDens, tension: picTension, random: picRandom, colour: picColour, alt: picAlt }, RHY, names: { COLOUR_N, TENSION_N, RANDOM_N, ALT_N } };
})();

// app2.html#chordlab (the CHORD LAB page embeds the app): boot straight into a TOY MACHINE lane with the
// MIDI roll open and the dice row unfolded, so Eman can prompt and roll without clicking through.
(() => {
  if (typeof location === "undefined" || location.hash !== "#chordlab") return;
  let tries = 0;
  const t0 = Date.now();
  const t = setInterval(async () => {
    if (++tries > 100) return clearInterval(t);
    // let the app boot on its own first (its state arrives after the first getState); 8 s is the cap
    if (!(typeof run === "function" && typeof ui === "object" && typeof openLaneWindow === "function")) return;
    if (Date.now() - t0 < 4000) return;
    clearInterval(t);
    try {
      await run("newSession");
      for (let w = 0; w < 50 && !(ui.state && ui.state.tracks); w++) await new Promise((r) => setTimeout(r, 200));
      try { showHome(false); } catch (e) {}
      const r = await run("newInstrumentLane", { key: "builtin:toymachine" }), id = r && (r.trackId || r.id);
      const m = await run("newMidiClip", { trackId: id, start: 0, bars: 4 });
      ui.selectedClip = m.clipId; if (typeof render === "function") render();
      const tr = ui.state.tracks.find((x) => x.id === id);
      openLaneWindow({ t: tr, clip: tr.clips.find((c) => c.id === m.clipId) });
      let n = 0;
      const g = setInterval(() => {
        document.querySelectorAll(".kc-go").forEach((b) => b.click());
        if (++n >= 6) { clearInterval(g); document.querySelectorAll(".kc-unlock").forEach((e) => e.remove()); const ar = document.querySelector("#tmm-darrow"); if (ar && ar.getAttribute("aria-expanded") !== "true") ar.click(); }
      }, 700);
    } catch (e) { console.warn("chordlab boot", e); }
  }, 400);
})();

// MIDI SCIENCE (Eman, 8 Nov 15:50): a tab on the projects page, next to ALL PROJECTS and QUESTS, that opens the
// CHORD LAB page (chord-lab.html) inside the app: the data, the findings, the tests, TOY MACHINE to try it.
// KT2_MIDI_SCIENCE_OFF = no tab.
(() => {
  if (typeof document === "undefined" || window.KT2_MIDI_SCIENCE_OFF) return;
  let overlay = null;
  const OLD = !!window.KT2_BACKEND_DATA_OLD;
  // 13 Nov 2026 (Eman: "YES move BACKEND DATA to its own app"): BACKEND DATA and DEBUG open the KILLTOY Backend Data
  // artifact in a new tab (the app's file store was full). The comments and sound-lab edits written on the old in-app page
  // travel along once in the link (#import-<hex>, merged there, what is already there wins).
  // KT2_BD_INAPP (window or localStorage "1") = the old in-app overlays.
  const BD_URL = "https://claude.ai/artifact/Cw7mDAu4tWXm48jC2akRNh";
  let INAPP = !!window.KT2_BD_INAPP; try { INAPP = INAPP || localStorage.getItem("KT2_BD_INAPP") === "1"; } catch (e) { /* storage blocked */ }
  const goOut = (hash) => { const a = document.createElement("a"); a.href = BD_URL + (hash ? "#" + hash : ""); a.target = "_blank"; a.rel = "noopener"; document.body.append(a); a.click(); a.remove(); };
  const carry = () => {
    try {
      const n = JSON.parse(localStorage.getItem("kt2.songmidi.notes") || "{}") || {}, l = JSON.parse(localStorage.getItem("kt2.songmidi.lab") || "{}") || {};
      const hasN = Object.keys(n).length > 0, hasL = Object.keys(l).length > 0;
      if (!hasN && !hasL) return "";
      const pack = (o) => { let x = ""; for (const c of new TextEncoder().encode(JSON.stringify(o))) x += c.toString(16).padStart(2, "0"); return x; };
      let hex = pack({ n: n, l: l });
      if (hex.length > 24000) hex = hasN ? pack({ n: n }) : "";
      if (!hex || hex.length > 24000) return "";
      const mark = hex.length + ":" + hex.slice(-24);
      if (localStorage.getItem("kt2.bd.carried") === mark) return "";
      localStorage.setItem("kt2.bd.carried", mark);
      return "import-" + hex;
    } catch (e) { return ""; }
  };
  const open = () => {
    if (!overlay) {
      overlay = document.createElement("div"); overlay.className = "k2-science"; overlay.id = "k2-science";
      // BACKEND DATA (Eman, 8 Nov 23:43): the tab is renamed and opens backend-data.html (MIDI SCIENCE, DRUM PATTERN
      // SCIENCE, CHORD LAB tabs inside). KT2_BACKEND_DATA_OLD = the old MIDI SCIENCE tab straight into chord-lab.html.
      overlay.innerHTML = OLD
        ? `<div class="k2-science-bar"><b>MIDI SCIENCE</b><span>the chord brain behind the dice</span><a href="chord-lab.html" target="_blank" rel="noopener" title="Open in its own tab">OPEN IN TAB</a><button type="button" class="k2-science-x" title="Close">\u00d7</button></div><iframe src="chord-lab.html" title="MIDI SCIENCE"></iframe>`
        : `<div class="k2-science-bar"><button type="button" class="k2-science-logo" title="Back to the main menu"><img src="logo.png" alt="KILLTOY"></button><b>BACKEND DATA</b><span>what the songs behind the dice and KILLDRUM do</span><a href="backend-data.html" target="_blank" rel="noopener" title="Open in its own tab">OPEN IN TAB</a><button type="button" class="k2-science-x" title="Close">\u00d7</button></div><iframe src="backend-data.html" title="BACKEND DATA"></iframe>`;
      document.body.append(overlay);
      overlay.querySelector(".k2-science-x").onclick = close;
      // the KILLTOY logo stays in the corner and goes back to the main menu (Eman, 9 Nov 01:19)
      const lg = overlay.querySelector(".k2-science-logo"); if (lg) lg.onclick = () => { close(); try { if (typeof showHome === "function") showHome(true); } catch (e) {} };
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay && !overlay.hidden) close(); });
    }
    overlay.hidden = false; document.body.classList.add("science-open");
  };
  const close = () => { if (overlay) { overlay.hidden = true; try { const f = overlay.querySelector("iframe"); if (f && f.contentWindow && f.contentWindow.KT2BD_STOP) f.contentWindow.KT2BD_STOP(); } catch (e) {} } document.body.classList.remove("science-open"); const b = document.querySelector(".kq-tabs .k2-science-tab"); if (b) b.classList.remove("on"); };
  const t0 = Date.now();
  const mount = () => {
    let tabs = document.querySelector(".kq-tabs");
    if (!tabs && Date.now() - t0 > 6000) {   // no QUESTS tabs in this build: sit next to the crumb instead
      const crumb = document.querySelector(".home-bar .home-crumb"); if (!crumb) return false;
      tabs = document.createElement("div"); tabs.className = "kq-tabs"; crumb.after(tabs);
    }
    if (!tabs || tabs.querySelector(".k2-science-tab")) return !!tabs;
    const b = document.createElement("button"); b.type = "button"; b.className = "k2-science-tab"; b.textContent = OLD ? "MIDI SCIENCE" : "BACKEND DATA";
    b.onclick = () => { if (!INAPP && !OLD) { goOut(carry()); return; } b.classList.add("on"); open(); };
    tabs.append(b);
    return true;
  };
  if (!mount()) { const t = setInterval(() => { if (mount()) clearInterval(t); }, 500); setTimeout(() => clearInterval(t), 30000); }
  // DEBUG (Eman, 9 Nov 12:58): its own tab right of BACKEND DATA, opening backend-data.html?only=debug in the same
  // kind of overlay. KT2_DEBUG_IN_BD = the old place (a tab inside BACKEND DATA, no tab here).
  let dbg = null;
  const openDbg = () => {
    if (!dbg) {
      dbg = document.createElement("div"); dbg.className = "k2-science"; dbg.id = "k2-debug";
      dbg.innerHTML = `<div class="k2-science-bar"><button type="button" class="k2-science-logo" title="Back to the main menu"><img src="logo.png" alt="KILLTOY"></button><b>DEBUG</b><span>what was tested, fixed, and needs you</span><a href="backend-data.html?only=debug" target="_blank" rel="noopener" title="Open in its own tab">OPEN IN TAB</a><button type="button" class="k2-science-x" title="Close">\u00d7</button></div><iframe src="backend-data.html?only=debug" title="DEBUG"></iframe>`;
      document.body.append(dbg);
      dbg.querySelector(".k2-science-x").onclick = closeDbg;
      dbg.querySelector(".k2-science-logo").onclick = () => { closeDbg(); try { if (typeof showHome === "function") showHome(true); } catch (e) {} };
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dbg && !dbg.hidden) closeDbg(); });
    }
    dbg.hidden = false; document.body.classList.add("science-open");
  };
  const closeDbg = () => {
    if (dbg) { dbg.hidden = true; try { const f = dbg.querySelector("iframe"); if (f && f.contentWindow && f.contentWindow.KT2BD_STOP) f.contentWindow.KT2BD_STOP(); } catch (e) {} }
    document.body.classList.remove("science-open"); const b = document.querySelector(".kq-tabs .k2-debug-tab"); if (b) b.classList.remove("on");
  };
  const mountDbg = () => {
    let inBd = !!window.KT2_DEBUG_IN_BD; try { inBd = inBd || localStorage.getItem("KT2_DEBUG_IN_BD") === "1"; } catch (e) { /* storage blocked */ }
    if (inBd || OLD) return true;
    const tabs = document.querySelector(".kq-tabs"), sci = tabs && tabs.querySelector(".k2-science-tab:not(.k2-debug-tab):not(.k2-unp-tab)");
    if (!sci) return false;
    if (tabs.querySelector(".k2-debug-tab")) return true;
    const b = document.createElement("button"); b.type = "button"; b.className = "k2-science-tab k2-debug-tab"; b.textContent = "DEBUG";
    b.onclick = () => { if (!INAPP) { goOut("only-debug"); return; } b.classList.add("on"); openDbg(); };
    sci.after(b);
    return true;
  };
  if (!mountDbg()) { const t = setInterval(() => { if (mountDbg()) clearInterval(t); }, 500); setTimeout(() => clearInterval(t), 40000); }
  // UNPERSONAL DATA (Eman, 12 Nov 21:48): everything learned from songs found online, kept but off in the app, on one
  // page of its own (backend-data.html?set=unpersonal: its tabs + USE IN APP to switch things back on). The tab sits
  // right of BACKEND DATA. KT2_OWN_SOURCES_OFF = no tab (BACKEND DATA shows everything, as before).
  let unp = null;
  const closeUnp = () => {
    if (unp) { unp.hidden = true; try { const f = unp.querySelector("iframe"); if (f && f.contentWindow && f.contentWindow.KT2BD_STOP) f.contentWindow.KT2BD_STOP(); } catch (e) {} }
    document.body.classList.remove("science-open"); const b = document.querySelector(".kq-tabs .k2-unp-tab"); if (b) b.classList.remove("on");
  };
  const openUnp = () => {
    if (!unp) {
      unp = document.createElement("div"); unp.className = "k2-science"; unp.id = "k2-unpersonal";
      unp.innerHTML = `<div class="k2-science-bar"><button type="button" class="k2-science-logo" title="Back to the main menu"><img src="logo.png" alt="KILLTOY"></button><b>UNPERSONAL DATA</b><a href="backend-data.html?set=unpersonal" target="_blank" rel="noopener" title="Open in its own tab">OPEN IN TAB</a><button type="button" class="k2-science-x" title="Close">\u00d7</button></div><iframe src="backend-data.html?set=unpersonal" title="UNPERSONAL DATA"></iframe>`;
      document.body.append(unp);
      unp.querySelector(".k2-science-x").onclick = closeUnp;
      unp.querySelector(".k2-science-logo").onclick = () => { closeUnp(); try { if (typeof showHome === "function") showHome(true); } catch (e) {} };
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && unp && !unp.hidden) closeUnp(); });
    }
    unp.hidden = false; document.body.classList.add("science-open");
  };
  const mountUnp = () => {
    if (window.KT2_OWN_SOURCES_OFF || OLD) return true;
    const tabs = document.querySelector(".kq-tabs"), sci = tabs && tabs.querySelector(".k2-science-tab:not(.k2-debug-tab):not(.k2-unp-tab)");
    if (!sci) return false;
    if (tabs.querySelector(".k2-unp-tab")) return true;
    const b = document.createElement("button"); b.type = "button"; b.className = "k2-science-tab k2-unp-tab"; b.textContent = "UNPERSONAL DATA";
    b.onclick = () => { b.classList.add("on"); openUnp(); };
    sci.after(b);
    return true;
  };
  if (!mountUnp()) { const t = setInterval(() => { if (mountUnp()) clearInterval(t); }, 500); setTimeout(() => clearInterval(t), 40000); }
  window.KT2Unpersonal = { open: openUnp, close: closeUnp };
  if (/^#unpersonal$/.test(location.hash)) setTimeout(openUnp, 1500);
  window.KT2Debug = { open: openDbg, close: closeDbg };
  if (/^#debug$/.test(location.hash)) setTimeout(openDbg, 1500);
  window.KT2Science = { open, close };
  if (/^#science$/.test(location.hash)) setTimeout(open, 1500);
})();
