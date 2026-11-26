/* SONG MIDI (Eman, 9 Nov 2026): a BACKEND DATA plug-in tab. Every real MIDI the artist hunts found
   (XXXTENTACION, $uicideboy$, Fred again.., Oneheart, my head is empty, The Blaze), tagged by artist,
   with key, BPM, where the notes came from, the chord in each bar and the busiest 8 bars as a playable loop.
   Data: science/songs-data.json, built by scripts/science/songs/build_song_midi.py from the Mac folder
   research/reference-midi/. Flag KT2_SONG_MIDI_OFF hides the tab.
   12 Nov 2026 (Eman): the songs of Eman's own playlist are in too (group "Your playlist", built by
   scripts/science/songs/build_playlist_songs.py). A card can carry the page its notes are based on (SOURCE) and a short
   clip of the original cut at the same 8 bars (ORIGINAL), to compare by ear. Playlist songs with no notes found are
   listed as red NOT FOUND cards. Flag KT2_SONG_PLAYLIST_OFF = old tab (artist hunts only, no clips, no NOT FOUND).
   13 Nov 2026 (Eman): a card plays at the MIDI file's own tempo (playBpm), the speed of the original; before, a tempo from
   a web page could play it at double or half speed (KT2_SONG_BPM_OLD = old). A guessed tempo shows as "~92 BPM".
   Notes that sat just off the beat are pulled onto the song's own grid by the builder (triplet and swing songs keep
   their feel; video-read songs get their real tempo and beat found first). KT2_SONG_QUANT_OFF plays the timing as found.
   13 Nov (Eman): every card plays the full thing and has CHORDS / BASS / MELODY solo buttons. A song that came as one
   part (a piano transcription) is split by ear rules: lowest notes = bass, the top line = melody, the middle = chords.
   KT2_SONG_SOLO_OFF = old (parts by track only, no solo buttons).
   Under every card is a note field for the mood and feeling, kept in this browser per song (KT2_SONG_NOTES_OFF hides it).
   13 Nov (Eman): every analysed song is one full-width ROW. Left = the original as waveform rows, right = the MIDI as one
   row per layer (vocal melody, melody, arp, chords, bass), same colours both sides, M / S per row, V1 / V2 on the MIDI
   (V1 = the earlier notes of the same song, V2 = the analysed ones), one CHORUS / FULL switch for both sides and a
   comment box under each side. KT2_SONG_ROWS_OLD = the cards as before. */
(function () {
  "use strict";
  try { if (window.KT2_SONG_MIDI_OFF || localStorage.getItem("KT2_SONG_MIDI_OFF") === "1") return; } catch (e) { /* storage blocked */ }
  let PL_OFF = !!window.KT2_SONG_PLAYLIST_OFF;
  try { if (localStorage.getItem("KT2_SONG_PLAYLIST_OFF") === "1") PL_OFF = true; } catch (e) { /* storage blocked */ }
  let SOLO_OFF = !!window.KT2_SONG_SOLO_OFF;
  try { if (localStorage.getItem("KT2_SONG_SOLO_OFF") === "1") SOLO_OFF = true; } catch (e) { /* storage blocked */ }
  // 13 Nov: a real COMMENT box under each card + a running time on the card (KT2_SONG_COMMENT_OLD = the thin strip, no time)
  let CM_OLD = !!window.KT2_SONG_COMMENT_OLD;
  try { if (localStorage.getItem("KT2_SONG_COMMENT_OLD") === "1") CM_OLD = true; } catch (e) { /* storage blocked */ }
  // 13 Nov: FULL on a card = the whole song, scrollable, in its own file loaded on first press (KT2_SONG_FULL_OFF hides it)
  let FULL_OFF = !!window.KT2_SONG_FULL_OFF;
  try { if (localStorage.getItem("KT2_SONG_FULL_OFF") === "1") FULL_OFF = true; } catch (e) { /* storage blocked */ }
  let ROWS_OLD = !!window.KT2_SONG_ROWS_OLD;
  try { if (localStorage.getItem("KT2_SONG_ROWS_OLD") === "1") ROWS_OLD = true; } catch (e) { /* storage blocked */ }
  let LAB_OFF = !!window.KT2_SONG_LAB_OFF;
  try { if (localStorage.getItem("KT2_SONG_LAB_OFF") === "1") LAB_OFF = true; } catch (e) { /* storage blocked */ }
  let FULLP = null;
  const fullGet = (id) => (window.ktData ? window.ktData(id) : fetch("science/" + id + "-data.json")).then((r) => r.json());
  // the whole songs may sit in several files (one upload holds 20 MiB): the first names the rest in "more"
  const fullData = () => FULLP || (FULLP = fullGet("songsfull").then(async (d) => { for (const m of await Promise.all((d.more || []).map(fullGet))) Object.assign(d.songs, m.songs); return d; }).catch((e) => { FULLP = null; throw e; }));
  const mmss = (t) => { t = Math.max(0, Math.floor(t + 1e-6)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
  let BPM_OLD = !!window.KT2_SONG_BPM_OLD, NOTES_OFF = !!window.KT2_SONG_NOTES_OFF;
  try { if (localStorage.getItem("KT2_SONG_BPM_OLD") === "1") BPM_OLD = true; if (localStorage.getItem("KT2_SONG_NOTES_OFF") === "1") NOTES_OFF = true; } catch (e) { /* storage blocked */ }
  // mood notes: one JSON object in localStorage, key = artist|song
  const NOTE_KEY = "kt2.songmidi.notes";
  let NOTES = {};
  try { NOTES = JSON.parse(localStorage.getItem(NOTE_KEY) || "{}") || {}; } catch (e) { NOTES = {}; }
  const noteId = (x) => (x.artist + "|" + x.song).toLowerCase();
  function saveNote(x, v) { saveId(noteId(x), v); }
  function saveId(id, v) {
    v = v.trim();
    if (v) NOTES[id] = v; else delete NOTES[id];
    try { localStorage.setItem(NOTE_KEY, JSON.stringify(NOTES)); } catch (e) { /* storage blocked: kept until the page closes */ }
  }

  const CSS = `
  .sm-roll { display: block; width: 100%; height: auto; }
  .sm-roll .bar { stroke: var(--rule); }
  .sm-roll .n { fill: var(--ink2); }
  .sm-roll .n.lead { fill: var(--ink); }
  .sm-roll .n.bass { fill: var(--acc); }
  .sm-roll .n.vocal { fill: none; stroke: var(--ink); stroke-width: .7; }
  .sm-src.stems { border-color: var(--acid); color: var(--acid); }
  .sm-roll .n.now { fill: var(--acid); stroke: var(--ink); stroke-width: .6; }
  .sm-roll .ph { fill: var(--acid); opacity: 0; }
  .dcard.on .sm-roll .ph { opacity: .45; }
  .sm-ch { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; margin: 6px 0 2px; }
  .sm-ch span { font: 500 10px/1 var(--mono); letter-spacing: .04em; color: var(--ink2); background: var(--tile); padding: 5px 2px; text-align: center; overflow: hidden; white-space: nowrap; }
  .sm-ch span.now { background: var(--acid); color: #111; }
  .sm-src { display: inline-block; font: 500 9px/1 var(--mono); letter-spacing: .14em; padding: 3px 5px; border: 1px solid var(--rule); color: var(--ink2); }
  .sm-src.midi { border-color: var(--acc); color: var(--acc); }
  .sm-src.sketch { opacity: .6; }
  .sm-art { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 2px; margin-top: 18px; }
  .sm-src.none { border-color: #ff3b3b; color: #ff3b3b; }
  .dcard.sm-none { cursor: default; border-color: rgba(255,59,59,.45); }
  .dcard.sm-none:hover { border-color: #ff3b3b; }
  .sm-nf { border: 1px solid #ff3b3b; color: #ff3b3b; font: 600 13px/1 var(--mono); letter-spacing: .22em; padding: 22px 8px; text-align: center; }
  .sm-ab { display: flex; flex-wrap: wrap; gap: 6px; }
  .sm-ab span { font: 500 10px/1 var(--mono); letter-spacing: .14em; padding: 7px 9px; border: 1px solid var(--ink3); color: var(--ink); cursor: pointer; user-select: none; }
  .sm-ab span:hover { border-color: var(--ink); }
  .sm-ab span.on { background: var(--acid); color: #111; border-color: var(--acid); }
  .sm-ab span.weak { border-style: dashed; }
  .sm-ab span.wait { opacity: .5; }
  .sm-ab span.solo.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .sm-ab i { flex: 0 0 8px; }
  .sm-roll .n.mute { opacity: .16; }
  .sm-roll .sl { stroke: var(--acid); stroke-width: 1.1; fill: none; stroke-linecap: square; }
  .sm-roll .sl.mute { opacity: .16; }
  .sm-wrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sm-wrap > .dcard { flex: 1 1 auto; }
  .sm-note { display: block; width: 100%; box-sizing: border-box; resize: none; overflow: hidden; min-height: 34px; border: 1px solid transparent; border-radius: 0; background: var(--tile2); color: var(--ink); font: 400 13px/1.4 var(--sans); padding: 8px 12px; }
  .sm-note::placeholder { font: 500 10px/1.8 var(--mono); letter-spacing: .16em; color: var(--ink3); }
  .sm-note:hover { border-color: var(--ink3); }
  .sm-note:focus { outline: none; border-color: var(--ink); }
  .sm-note.has { border-left: 3px solid var(--acid); }
  .sm-cm { background: var(--tile2); padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .sm-cm > label { font: 500 10px/1 var(--mono); letter-spacing: .16em; color: var(--ink2); display: flex; justify-content: space-between; }
  .sm-cm .sm-note { min-height: 62px; background: var(--bg); border: 1px solid var(--ink3); font-size: 14px; cursor: text; }
  .sm-cm .sm-note::placeholder { font: 400 14px/1.4 var(--sans); letter-spacing: 0; }
  .sm-cm .sm-note.has { border-left: 3px solid var(--acid); }
  .dcard.wait { opacity: .6; }
  .sm-fullbox { overflow-x: auto; overflow-y: hidden; margin: 10px 0 0; scrollbar-width: thin; cursor: pointer; }
  .sm-fullbox .sm-roll { display: block; margin: 0; max-width: none; }
  .sm-ab span.full.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .sm-tms { display: flex; flex-wrap: wrap; gap: 4px; }
  .sm-tms:empty { display: none; }
  .sm-tms button { font: 500 11px/1 var(--mono); letter-spacing: .08em; padding: 6px 8px; border: 1px solid var(--ink3); background: none; color: var(--ink); cursor: pointer; border-radius: 0; }
  .sm-tms button:hover { border-color: var(--acid); color: var(--acid); }
  .dcard .dh span.sm-time { margin-left: auto; align-self: center; font: 500 13px/1 var(--mono); letter-spacing: .06em; color: var(--ink2); padding: 6px 4px; }
  .dcard.on .dh span.sm-time, .dcard .dh span.sm-time.on { color: var(--acid); }
  .sm-art > div { background: var(--tile); padding: 14px 16px; }
  .sm-art b { display: block; font: 600 18px/1.1 var(--sans); }
  .sm-art small { display: block; font: 400 10px/1.5 var(--mono); letter-spacing: .1em; color: var(--ink2); text-transform: uppercase; margin-top: 6px; }
  .sm-art p { font: 400 12px/1.45 var(--sans); color: var(--ink2); margin: 8px 0 0; }
  .sm-art .loop { font: 500 12px/1.4 var(--mono); color: var(--ink); margin-top: 8px; }
  .sm-row { grid-column: 1 / -1; background: var(--tile2); padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .sm-rh { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .sm-rh b { font-weight: 500; font-size: 18px; letter-spacing: -.02em; line-height: 1.05; }
  .sm-rh small { font-size: 11px; opacity: .7; margin-left: 8px; }
  .sm-rh .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font: 400 10px/1.4 var(--mono); letter-spacing: .1em; color: var(--ink2); text-transform: uppercase; align-items: center; }
  .sm-sw { display: inline-flex; margin-left: auto; }
  .sm-sw button, .sm-vt button { font: 500 10px/1 var(--mono); letter-spacing: .14em; padding: 8px 11px; border: 1px solid var(--ink3); background: none; color: var(--ink); cursor: pointer; border-radius: 0; }
  .sm-sw button + button, .sm-vt button + button { border-left: 0; }
  .sm-sw button.on { background: var(--acid); color: #111; border-color: var(--acid); }
  .sm-vt { display: inline-flex; }
  .sm-vt button.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .sm-vt button:disabled { opacity: .35; cursor: default; }
  .sm-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 980px) { .sm-two { grid-template-columns: 1fr; } }
  .sm-side { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .sm-side.wait { opacity: .6; }
  .sm-sh { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 32px; }
  .sm-sh > em { font: 500 10px/1 var(--mono); font-style: normal; letter-spacing: .16em; color: var(--ink2); }
  .sm-pb { width: 30px; height: 30px; flex: 0 0 30px; border: 1px solid var(--ink3); display: grid; place-items: center; background: none; color: var(--ink); cursor: pointer; border-radius: 0; padding: 0; }
  .sm-pb svg { width: 11px; height: 11px; fill: currentColor; pointer-events: none; }
  .sm-pb.on, .sm-side.on .sm-pb.mid { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .sm-pb.wait { opacity: .5; }
  .sm-sh .sm-time { margin-left: auto; font: 500 13px/1 var(--mono); letter-spacing: .06em; color: var(--ink2); padding: 6px 4px; cursor: pointer; }
  .sm-sh .sm-time.on, .sm-side.on .sm-time.mid { color: var(--acid); }
  .sm-lanes { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 0 6px; }
  .sm-heads { display: flex; flex-direction: column; gap: 2px; }
  .sm-hd { height: 44px; display: flex; align-items: center; gap: 3px; border-left: 3px solid var(--k); padding-left: 5px; }
  .sm-hd button { width: 20px; height: 20px; flex: 0 0 20px; padding: 0; font: 600 9px/1 var(--mono); border: 1px solid var(--ink3); background: none; color: var(--ink2); cursor: pointer; border-radius: 0; }
  .sm-hd button.m.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .sm-hd button.s.on { background: var(--acid); color: #111; border-color: var(--acid); }
  .sm-hd span { font: 500 9px/1.15 var(--mono); letter-spacing: .1em; color: var(--k); margin-left: 4px; overflow: hidden; }
  .sm-scroll { overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; cursor: pointer; }
  .sm-inner { position: relative; display: flex; flex-direction: column; gap: 2px; min-width: 100%; }
  .sm-ln { height: 44px; background: color-mix(in srgb, var(--k) 9%, var(--bg)); }
  .sm-ln svg { display: block; width: 100%; height: 100%; }
  .sm-ln .n, .sm-ln .w { fill: var(--k); }
  .sm-ln .n.now { fill: var(--acid); }
  .sm-ln .bar { stroke: var(--rule); vector-effect: non-scaling-stroke; }
  .sm-ln .sl { stroke: var(--acid); stroke-width: 1.2; fill: none; vector-effect: non-scaling-stroke; }
  .sm-ln.off { opacity: .22; }
  .sm-hd.off span { opacity: .4; }
  .sm-phd { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--acid); opacity: 0; pointer-events: none; left: 0; }
  .sm-side.on .sm-phd, .sm-phd.on { opacity: .9; }
  .sm-inner .sm-ch { margin: 2px 0 0; }
  .sm-noau { font: 500 10px/1 var(--mono); letter-spacing: .16em; color: var(--ink3); border: 1px dashed var(--ink3); padding: 26px 8px; text-align: center; }
  .sm-tag { font: 500 9px/1 var(--mono); letter-spacing: .14em; padding: 3px 5px; border: 1px solid var(--rule); color: var(--ink2); }
  .sm-tag.au { border-color: var(--acid); color: var(--acid); }
  .sm-tag.net { border-color: var(--acc); color: var(--acc); }
  .sm-row .sm-ab span { padding: 6px 8px; }
  .sm-lbtn { font: 500 10px/1 var(--mono); letter-spacing: .14em; padding: 8px 11px; border: 1px solid var(--ink3); background: none; color: var(--ink); cursor: pointer; border-radius: 0; }
  .sm-lbtn:hover { border-color: var(--ink); }
  .sm-lbtn:disabled { opacity: .3; cursor: default; }
  .sm-lbtn.vst { border-color: var(--acc); color: var(--acc); }
  .sm-lbtn.vst.on { background: var(--acc); color: #111; }
  .sm-lbtn.wait { opacity: .5; }
  .sm-lab { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--rule); padding-top: 12px; }
  .sm-labbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .sm-labbar .sm-vt button { border-bottom: 3px solid var(--k); }
  .sm-labbar .sm-lbtn:last-child { margin-left: auto; }
  .sm-labtwo { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 980px) { .sm-labtwo { grid-template-columns: 1fr; } }
  .sm-labside { min-width: 0; }
  .sm-edwrap { height: 700px; overflow-y: auto; overflow-x: hidden; background: var(--bg); scrollbar-width: thin; }
  .sm-ed { display: block; width: 100%; touch-action: none; cursor: crosshair; user-select: none; }
  .sm-ed .bk { fill: rgba(255,255,255,.035); }
  .sm-ed line { vector-effect: non-scaling-stroke; }
  .sm-ed .bt { stroke: rgba(255,255,255,.06); } .sm-ed .br { stroke: rgba(255,255,255,.22); } .sm-ed .oc { stroke: rgba(255,255,255,.1); }
  .sm-ed .en { fill: var(--k); opacity: .22; pointer-events: none; }
  .sm-ed .en.own { opacity: 1; pointer-events: auto; cursor: grab; stroke: rgba(0,0,0,.5); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .sm-tmhost { height: 700px; position: relative; overflow: hidden; }
  .sm-tmhost > * { width: 100%; height: 100%; }
  .sm-hd.bad { border-left-color: #ff3b3b; } .sm-hd.bad span { color: #ff3b3b; opacity: 1; }
  .sm-ln.bad { position: relative; background: rgba(255,59,59,.08); outline: 1px solid rgba(255,59,59,.45); outline-offset: -1px; opacity: 1; }
  .sm-ln.bad svg { opacity: .25; }
  .sm-ln.bad em { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font: 500 10px/1 var(--mono); font-style: normal; letter-spacing: .14em; color: #ff3b3b; pointer-events: none; }
  .k-vocals { --k: #ff7ab8; } .k-melody { --k: #5ad1ff; } .k-arp { --k: #ffb14a; } .k-chords { --k: #a58bff; } .k-bass { --k: #6fe39a; } .k-mix { --k: var(--ink2); } .k-drums { --k: #d9d9de; }
  `;

  const SRC = { midi: ["MIDI", "an exact MIDI file"], video: ["VIDEO", "read from a piano or piano-roll video"], tab: ["TAB", "a Songsterr tab made into MIDI"], sketch: ["SKETCH", "built from a chord chart, not real notes"], stems: ["STEMS", "worked out from the song itself: the whole song, on its real beat"] };
  const NONE = ["NOT FOUND", "no notes found online yet"];
  const srcName = (k) => (SRC[k] || NONE)[0];
  const ROLES = ["lead", "chords", "bass", "vocal"];   // vocal: the sung line, only on analysed songs
  // 13 Nov: the analysed songs (group "Analysed songs", src "stems") come with real parts, the whole song and slides (KT2_SONG_STEMS_OFF hides them)
  let STEMS_OFF = !!window.KT2_SONG_STEMS_OFF;
  try { if (localStorage.getItem("KT2_SONG_STEMS_OFF") === "1") STEMS_OFF = true; } catch (e) { /* storage blocked */ }
  const NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const ROMAN = ["I", "bII", "II", "bIII", "III", "IV", "bV", "V", "bVI", "VI", "bVII", "VII"];

  // ------------------------------------------------------------------ playback: lead, chords and bass voices
  let AC = null, playing = null;
  function ac(api) { if (!AC || AC.state === "closed") AC = api.audio(); if (AC.state === "suspended") AC.resume(); return AC; }
  // 13 Nov: sliding notes. A note may carry a 6th value: the pitch it glides in from (1 = from the note before it in the
  // same part), the same idea as the DAW's slide / slideFrom. Drawn as a ramp into the note, played as a glide.
  // KT2_SONG_SLIDE_OFF = plain notes.
  let SLIDE_OFF = !!window.KT2_SONG_SLIDE_OFF;
  try { if (localStorage.getItem("KT2_SONG_SLIDE_OFF") === "1") SLIDE_OFF = true; } catch (e) { /* storage blocked */ }
  function slides(s) {   // per note: the pitch it glides from, or 0
    if (s._slides) return s._slides;
    const N = s.notes, out = new Array(N.length).fill(0);
    if (SLIDE_OFF || !N.some((n) => n[5])) return (s._slides = out);
    const R = roles(s), last = {};
    N.forEach((n, i) => {
      if (n[5] > 1) out[i] = n[5];
      else if (n[5] === 1 && last[R[i]] != null && N[last[R[i]]][2] !== n[2]) out[i] = N[last[R[i]]][2];
      if (last[R[i]] == null || N[last[R[i]]][0] < n[0] || N[last[R[i]]][2] < n[2]) last[R[i]] = i;
    });
    return (s._slides = out);
  }
  function voice(a, out, t, midi, dur, vel, role, from) {
    const hz = 440 * Math.pow(2, (midi - 69) / 12), end = t + Math.max(0.07, Math.min(dur, 3));
    const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    const lvl = (0.06 + 0.16 * vel) * (role === "bass" ? 1.3 : role === "chords" ? 0.55 : role === "vocal" ? 0.75 : 0.9);
    o.type = role === "bass" ? "sine" : role === "chords" ? "sawtooth" : role === "vocal" ? "sine" : "triangle";
    if (from) { o.frequency.setValueAtTime(440 * Math.pow(2, (from - 69) / 12), t); o.frequency.exponentialRampToValueAtTime(hz, t + Math.max(0.03, Math.min(dur * 0.5, 0.14))); }
    else o.frequency.value = hz;
    f.type = "lowpass"; f.frequency.setValueAtTime(role === "chords" ? 1800 : Math.min(8000, hz * 7), t); f.frequency.exponentialRampToValueAtTime(Math.max(250, hz * 1.4), end);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.01); g.gain.exponentialRampToValueAtTime(lvl * 0.5, t + Math.min(0.4, dur)); g.gain.setValueAtTime(lvl * 0.5, Math.max(t + 0.011, end - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.08);
    o.connect(f); f.connect(g); g.connect(out);
    o.start(t); o.stop(end + 0.1);
  }
  // ------------------------------------------------------------------ the original's clip (12 Nov): same 8 bars as the card
  // 13 Nov: analysed songs play each part with its own fitted TOY MACHINE sound (the real synth engine, loaded on the
  // first such play; patches in their own file "songpatch"). Anything missing = the plain preview voices.
  // KT2_SONG_PATCH_OFF = plain voices always.
  let PATCH_OFF = !!window.KT2_SONG_PATCH_OFF;
  try { if (localStorage.getItem("KT2_SONG_PATCH_OFF") === "1") PATCH_OFF = true; } catch (e) { /* storage blocked */ }
  let TMP = null, PATCHP = null;
  const tmEngine = (ctx) => TMP || (TMP = (async () => {
    if (!window.ToyMachine) await new Promise((ok, no) => { const t = document.createElement("script"); t.src = "toy-machine.js"; t.onload = ok; t.onerror = () => no(new Error("toy-machine.js")); document.head.append(t); });
    return window.ToyMachine.load(ctx, "toy-machine.wasm");
  })().catch((e) => { TMP = null; throw e; }));
  const patchData = () => PATCHP || (PATCHP = (window.ktData ? window.ktData("songpatch") : fetch("science/songpatch-data.json")).then((r) => r.json()).catch((e) => { PATCHP = null; throw e; }));
  // a sound may use a texture sample (patch.sampler.file): the samples sit in a few big packs ("remakesamplesN"), loaded
  // when a sound first needs one; the engine gets the decoded sample after every create / setPreset
  const SPK = {}, SBUF = {};
  const smpPack = (i) => SPK[i] || (SPK[i] = (async () => {
    let r = null;
    try { r = await fetch("science/remakesamples" + i + ".json"); if (!r.ok) r = null; } catch (e) { r = null; }
    if (!r && window.ktBlob) r = await window.ktBlob("remakesamples" + i);
    return r.json();
  })().catch((e) => { delete SPK[i]; throw e; }));
  const smpFile = (pr) => (pr && pr.sampler && pr.sampler.on && pr.sampler.file) || null;
  async function giveSample(ctx, syn, pr, idx) {
    const f = smpFile(pr); if (!f) return;
    if (!SBUF[f]) {
      const i = idx && idx[f]; if (!i) return;
      SBUF[f] = (async () => { const e = (await smpPack(i))[f]; if (!e) throw new Error(f); const by = Uint8Array.from(atob(e.b), (c) => c.charCodeAt(0)); const buf = await ctx.decodeAudioData(by.buffer); return { data: buf.getChannelData(0), sampleRate: buf.sampleRate }; })();
      SBUF[f].catch(() => { delete SBUF[f]; });
    }
    try { syn.setSample(await SBUF[f]); } catch (e) { /* plays without its texture */ }
  }
  const partOf = (name) => { const n = (name || "").toLowerCase(); return n.startsWith("bass") ? "bass" : n.startsWith("chord") ? "chords" : n.startsWith("arp") ? "arp" : n.startsWith("main") ? "main" : n.startsWith("vocal") ? "vocal" : null; };
  // one synth per track of the song that has a patch -> { track index: synth }, kept on the song for the next play
  async function synthsFor(api, x) {
    if (PATCH_OFF || !x.patch || !x.patch.length || !api.bus) return null;
    if (x._sy) return x._sy;
    const ctx = api.audio();
    const [TM, P] = await Promise.all([tmEngine(ctx), patchData()]);
    const mine = (P.songs || {})[String(x.n)] || {}, sy = {};
    const jobs = [];
    x.tracks.forEach((t, i) => { const pr = (synthsFor.saved && synthsFor.saved(x, partOf(t.name))) || mine[partOf(t.name)]; if (pr) { try { sy[i] = TM.create({ preset: pr }); jobs.push(giveSample(ctx, sy[i], pr, P.smp)); } catch (e) { /* this part keeps the plain voice */ } } });
    await Promise.all(jobs);
    return (x._sy = sy);
  }
  const PACKS = {};
  let refOn = null;
  function pack(i) {   // one WebM/Opus file holds many clips end to end; a clip is a start time and a length in it
    if (!PACKS[i]) {
      const named = typeof i === "string", name = named ? i : "songref-" + String(i).padStart(2, "0");   // a name = an analysed songs' listen pack (mp4)
      PACKS[i] = (async () => {
        let r = null;
        try { r = await fetch("science/" + name + (named ? ".mp4" : ".webm")); if (!r.ok) r = null; } catch (e) { r = null; }
        if (!r && window.ktBlob) r = await window.ktBlob(name);
        if (!r || !r.ok) throw new Error(name + " missing");
        const b = await r.blob();
        if (named) return URL.createObjectURL(b.type.indexOf("mp4") >= 0 ? b : new Blob([b], { type: "audio/mp4" }));
        return URL.createObjectURL(b.type.indexOf("webm") >= 0 ? b : new Blob([b], { type: "audio/webm" }));
      })();
      PACKS[i].catch(() => { delete PACKS[i]; });
    }
    return PACKS[i];
  }
  // 13 Nov: the original as separate stems (vocals / chords / bass / drums). A pack is JSON holding one small audio file per
  // song and part; a song's clips are decoded when it is first played and start together, so they stay in sync.
  // KT2_SONG_STEMAUDIO_OFF = the one full-mix waveform as before.
  let STEMAU_OFF = !!window.KT2_SONG_STEMAUDIO_OFF;
  try { if (localStorage.getItem("KT2_SONG_STEMAUDIO_OFF") === "1") STEMAU_OFF = true; } catch (e) { /* storage blocked */ }
  let STBIN_OFF = !!window.KT2_SONG_STEMBIN_OFF;
  try { if (localStorage.getItem("KT2_SONG_STEMBIN_OFF") === "1") STBIN_OFF = true; } catch (e) { /* storage blocked */ }
  const STPK = {};
  let STBUF = null, stemOn = null;
  const stemPack = (f) => STPK[f] || (STPK[f] = (async () => {
    let r = null;
    try { r = await fetch("science/" + f + ".json"); if (!r.ok) r = null; } catch (e) { r = null; }
    if (!r && window.ktBlob) r = await window.ktBlob(f);
    return (await r.json()).clips || {};
  })().catch((e) => { delete STPK[f]; throw e; }));
  // 13 Nov late: a binary pack (killtoy-stems/2) is the same small audio files laid end to end in ONE file, no base64: a part
  // then names its place in it (o = first byte, l = bytes). KT2_SONG_STEMBIN_OFF = such songs show the full mix instead.
  const STBIN = {};
  const stemBin = (f) => STBIN[f] || (STBIN[f] = (async () => {
    let r = null;
    for (const ext of [".webm", ".mp4"]) { if (r) break; try { r = await fetch("science/" + f + ext); if (!r.ok) r = null; } catch (e) { r = null; } }
    if (!r && window.ktBlob) r = await window.ktBlob(f);
    if (!r || !r.ok) throw new Error(f + " missing");
    return r.arrayBuffer();
  })().catch((e) => { delete STBIN[f]; throw e; }));
  async function stemBufs(ctx, x) {
    if (STBUF && STBUF.n === x.n) return STBUF.b;
    const b = {};
    if (x.stems.b) {
      await Promise.all(Object.keys(x.stems.parts).map(async (k) => {
        const q = x.stems.parts[k]; if (!q.l) return;
        let a; try { a = await stemBin(k === "drums" && x.stems.fd ? x.stems.fd : x.stems.f); } catch (e) { return; }
        if (q.o + q.l > a.byteLength) return;
        b[k] = await ctx.decodeAudioData(a.slice(q.o, q.o + q.l));
      }));
    } else {
    const [c, cd] = await Promise.all([stemPack(x.stems.f), x.stems.fd ? stemPack(x.stems.fd).catch(() => ({})) : {}]);
    await Promise.all(Object.keys(x.stems.parts).map(async (k) => { const kn = x.stems.k || x.n, t = c[kn + ":" + k] || cd[kn + ":" + k]; if (!t) return; const by = Uint8Array.from(atob(t), (ch) => ch.charCodeAt(0)); b[k] = await ctx.decodeAudioData(by.buffer); }));
    }
    if (!Object.keys(b).length) throw new Error("no stems");
    STBUF = { n: x.n, b };
    return b;
  }
  function stopStem() {
    if (!stemOn) return;
    const s = stemOn; stemOn = null;
    cancelAnimationFrame(s.raf); s.o.btn.classList.remove("on", "wait");
    for (const n of s.src) { try { n.stop(); } catch (e) { /* not started */ } }
    if (s.g) s.api.release(s.g);
    s.o.off();
  }
  // o = { btn, on(part) -> audible?, tick(seconds), off(), miss() }
  async function playStems(api, x, o, from) {
    if (stemOn && stemOn.o.btn === o.btn && from == null) { stopStem(); return; }
    stop(); stopRef();
    const me = stemOn = { o, api, src: [], gains: {}, g: null, raf: 0, x, pos: () => 0 };
    o.btn.classList.add("wait");
    const a = api.audio(); if (a.state === "suspended") a.resume();
    let B;
    try { B = await stemBufs(a, x); } catch (e) { if (stemOn === me) { stopStem(); o.miss(); } return; }
    if (stemOn !== me) return;
    me.g = api.bus ? api.bus(stopStem) : null;
    if (stemOn !== me) stemOn = me;   // bus() cut the previous sound, which may have cleared us
    const d = Math.min(...Object.values(B).map((b) => b.duration)), off = Math.max(0, Math.min(from || 0, d - 0.3)), t0 = a.currentTime + 0.05;
    const sum = a.createDynamicsCompressor(); sum.threshold.value = -8; sum.ratio.value = 6; sum.connect(me.g || a.destination);   // stems added up can go over full level
    for (const k in B) {
      const n = a.createBufferSource(), g = me.gains[k] = a.createGain(); n.buffer = B[k]; g.gain.value = o.on(k) ? 0.6 : 0;
      n.connect(g); g.connect(sum); n.start(t0, off); me.src.push(n);
    }
    me.pos = () => Math.max(0, Math.min(d, a.currentTime - t0 + off));
    const tick = () => { if (stemOn !== me) return; if (me.pos() >= d - 0.02) { stopStem(); return; } o.tick(me.pos(), d); me.raf = requestAnimationFrame(tick); };
    o.btn.classList.remove("wait"); o.btn.classList.add("on");
    me.raf = requestAnimationFrame(tick);
  }
  function stopRef() {
    stopStem();
    if (!refOn) return;
    const r = refOn; refOn = null;
    r.chip.classList.remove("on", "wait");
    if (r.tEl) { r.tEl.classList.remove("on"); r.tEl.textContent = r.t0; }
    clearInterval(r.tm);
    try { if (r.el) { r.el.pause(); r.el.removeAttribute("src"); r.el.load(); } } catch (e) { /* not started */ }
    try { if (r.node) r.node.disconnect(); } catch (e) { /* gone */ }
    if (r.g) r.api.release(r.g);
    if (r.clip && r.clip.off) r.clip.off();
  }
  // clip = { p: pack number or name, s, d, ch } ; ch 0 / 1 = play only the left / right side (analysed songs: left = the original, right = the remake)
  async function playRef(api, x, chip, tEl, from, clip) {
    const C = clip || x.ref;
    if (refOn && refOn.chip === chip && from == null) { stopRef(); return; }
    stop(); stopRef();
    const me = refOn = { chip, api, g: null, el: null, node: null, tm: 0, tEl: tEl || null, t0: tEl ? tEl.textContent : "", x, pos: () => 0, clip: C };
    chip.classList.add("wait");
    const a = api.audio(); if (a.state === "suspended") a.resume();
    try {
      const url = await pack(C.p);
      if (refOn !== me) return;
      const el = me.el = new Audio(); el.preload = "auto"; el.src = url;
      await new Promise((ok, no) => { el.onloadedmetadata = ok; el.onerror = () => no(new Error("clip")); });
      if (refOn !== me) return;
      el.currentTime = C.s + Math.max(0, Math.min(from || 0, C.d - 0.5));
      me.pos = () => Math.max(0, el.currentTime - C.s);
      if (tEl) tEl.classList.add("on");
      me.g = api.bus ? api.bus(stopRef) : null;
      if (refOn !== me) refOn = me;   // bus() cut the previous sound, which may have cleared us
      try {
        me.node = a.createMediaElementSource(el);
        if (C.ch == null) me.node.connect(me.g || a.destination);
        else { const sp = a.createChannelSplitter(2), mg = a.createChannelMerger(2); me.node.connect(sp); sp.connect(mg, C.ch, 0); sp.connect(mg, C.ch, 1); mg.connect(me.g || a.destination); }
      } catch (e) { me.node = null; }
      const end = C.s + C.d;
      me.tm = setInterval(() => { if (refOn !== me) return; if (el.currentTime >= end - 0.02 || el.ended) { stopRef(); return; } if (C.on) C.on(me.pos()); if (tEl) tEl.textContent = mmss(me.pos()) + " / " + mmss(C.d); }, 30);
      await el.play();
      if (refOn !== me) return;
      chip.classList.remove("wait"); chip.classList.add("on");
    } catch (e) { if (refOn === me) { stopRef(); if (C.miss) C.miss(); else chip.textContent = "CLIP MISSING"; } }
  }

  function stop() {   // a song may carry _after(ended): the sound lab uses it to loop and to take its synths back
    const s = playing && playing.song;
    stop0();
    if (s) { const e = !!s._ended; s._ended = false; if (s._after) s._after(e); }
  }
  function stop0() {
    if (!playing) return;
    cancelAnimationFrame(playing.raf); playing.card.classList.remove("on");
    if (playing.sy) for (const k in playing.sy) { try { playing.sy[k].flush("hard"); playing.sy[k].output.disconnect(); } catch (e) { /* gone */ } }
    if (playing.card._time) playing.card._time.textContent = "0:00 / " + mmss(playing.total);
    playing.r.rects.forEach((x) => { if (x) x.classList.remove("now"); }); playing.chips.forEach((x) => x.classList.remove("now"));
    if (playing.bus) { const b = playing.bus; playing = null; b.api.release(b.g); return; }
    if (AC && playing.stopAt > AC.currentTime) { const old = AC; AC = null; if (old.state !== "closed") old.close().catch(() => {}); }
    playing = null;
  }
  function play(api, s, Q, bpm, card, r, chips, from, beats, sy) {
    stop(); stopRef();
    const g = api.bus ? api.bus(stop) : null; // 9 Nov: own bus, one sound at a time across the tabs (KT2_BD_AUDIO_OLD = old)
    const len = beats || 32;
    const a = g ? api.audio() : ac(api), spb = 60 / bpm, t1 = a.currentTime + 0.06, t0 = t1 - Math.max(0, Math.min(from || 0, (len - 0.5) * spb));
    const out = a.createDynamicsCompressor(); out.threshold.value = -16; out.ratio.value = 4; out.connect(g || a.destination);
    const LY = s._lay || null;   // the row layout: one gain per layer row (M / S), instead of the three solo parts
    const parts = {}, R = LY || roles(s), N = s.notes, small = N.length <= 400, SL = slides(s);
    for (const k of LY ? LAYS : ROLES) { parts[k] = a.createGain(); parts[k].gain.value = LY ? (!s._on || s._on(k) ? 1 : 0) : s._solo && s._solo !== k ? 0 : 1; parts[k].connect(out); }
    const trRole = {};   // a synth plays one track; its sound goes through that track's part, so solo still works
    if (sy) { N.forEach((n, i) => { if (!(n[4] in trRole)) trRole[n[4]] = R[i]; }); for (const k in sy) { const lv = a.createGain(); lv.gain.value = 0.55; sy[k].output.connect(lv); lv.connect(parts[trRole[k] || "chords"]); } }
    let next = 0;   // notes are sorted by start: only the next 1.5 seconds are handed to the audio engine at a time (a whole song is thousands)
    const feed = () => {
      const upto = a.currentTime + 1.5;
      for (; next < N.length; next++) {
        const [on, d, p, v] = N[next], t = t0 + on / Q * spb, dur = d / Q * spb;
        if (t > upto) break;
        if (t + dur <= t1 + 0.03) continue;   // started from a time: notes already over are skipped, held ones come in shortened
        const T = Math.max(t, t1), Dn = t < t1 ? t + dur - t1 : dur, fr = t < t1 ? 0 : SL[next], z = sy && sy[N[next][4]];
        if (z) z.schedule([fr ? { pitch: p, velocity: v, on: T, off: T + Dn, from: fr, secs: Math.max(0.03, Math.min(Dn * 0.5, 0.14)) } : { pitch: p, velocity: v, on: T, off: T + Math.max(0.05, Dn - 0.01) }]);
        else voice(a, parts[R[next]], T, p, Dn, v / 127, LY ? LAY_ROLE[R[next]] : R[next], fr);
      }
    };
    feed();
    let lastBar = -1;
    const tick = () => {
      const now = (a.currentTime - t0) / spb;
      if (now >= len + (s._after ? 0 : 0.3)) { s._ended = true; stop(); return; }
      feed();
      const qn = now * Q;
      if (small) N.forEach((n, i) => { if (r.rects[i]) r.rects[i].classList.toggle("now", qn >= n[0] && qn < n[0] + n[1]); });
      const bar = Math.floor(now / 4);
      if (bar !== lastBar) { chips.forEach((c, i) => c.classList.toggle("now", i === bar)); lastBar = bar; }
      r.ph.setAttribute("x", r.x(Math.max(0, now)) - 1);
      if (r.box) {   // the whole song: keep the marker in view
        const px = r.x(Math.max(0, now)) / r.W * r.box.scrollWidth;
        if (px < r.box.scrollLeft || px > r.box.scrollLeft + r.box.clientWidth * 0.9) r.box.scrollLeft = Math.max(0, px - r.box.clientWidth * 0.1);
      }
      if (card._time) card._time.textContent = mmss(Math.min(len, Math.max(0, now)) * spb) + " / " + mmss(len * spb);
      playing.raf = requestAnimationFrame(tick);
    };
    card.classList.add("on");
    playing = { card, r, chips, raf: 0, stopAt: t0 + len * spb + 0.4, bus: g ? { g, api } : null, parts, song: s, a, sy: sy || null, total: len * spb, pos: () => Math.min(len, Math.max(0, (a.currentTime - t0) / spb)) * spb };
    playing.raf = requestAnimationFrame(tick);
  }
  // ------------------------------------------------------------------ the row layout: layers
  const LAYS = ["vocals", "melody", "arp", "chords", "bass"];
  const LAY_ROLE = { vocals: "vocal", melody: "lead", arp: "chords", chords: "chords", bass: "bass" };
  function layersOf(s) {   // which layer row each note sits on
    if (s.src === "stems") { const t = s.tracks.map((tr) => { const p = partOf(tr.name); return p === "main" ? "melody" : p === "vocal" ? "vocals" : p || "chords"; }); return s.notes.map((n) => t[n[4]] || "chords"); }
    const M = { lead: "melody", vocal: "vocals", chords: "chords", bass: "bass" };
    return roles(s).map((r) => M[r] || "chords");
  }
  const role = (s, tr) => (s.tracks[tr] && s.tracks[tr].role) || "lead";
  // which part each note belongs to. Songs with real separate parts keep them. A song that is all one part is split:
  // at every moment the lowest low note is the bass, the top note is the melody, what sits between is the chords.
  function roles(s) {
    if (s._roles) return s._roles;
    let byTrack = s.notes.map((n) => role(s, n[4]));
    let kinds = new Set(byTrack);
    if (SOLO_OFF || kinds.size >= 3 || !s.notes.length || s.src === "stems") return (s._roles = byTrack);
    // notes read from a piano video come as left hand / right hand, not as parts: split those from scratch
    if (s.src === "video" && !window.KT2_SONG_SPLIT_OLD) { byTrack = s.notes.map(() => "lead"); kinds = new Set(["lead"]); }
    if (window.KT2_SONG_SPLIT_OLD) return (s._roles = rolesOld(s, byTrack, kinds));
    // 13 Nov (Eman: "the arp is the chord progression underneath, not the melody"): the melody is the top VOICE, not
    // every top note. Bass = the low notes. Of the rest: when the notes sit in two clear height bands, the upper band is
    // the melody and the lower one (arps, broken chords, pads) is chords. With no clear gap, a note is melody only when
    // nothing above it is sounding and it stays near the height the top line moves at. KT2_SONG_SPLIT_OLD = the old split.
    const N = s.notes, R = byTrack.slice();
    const ps = N.map((n) => n[2]).sort((x, y) => x - y), mid = ps[Math.floor(ps.length / 2)];
    const bassTop = Math.min(55, mid - 5);
    const groups = {};
    N.forEach((n, i) => { (groups[n[0]] = groups[n[0]] || []).push(i); });
    if (!kinds.has("bass")) for (const on in groups) {
      const g = groups[on], lo = g.reduce((m, i) => (N[i][2] < N[m][2] ? i : m), g[0]), p = N[lo][2];
      if (p <= bassTop && (g.length > 1 || p <= bassTop - 3)) R[lo] = "bass";
    }
    if (kinds.has("lead") && kinds.has("chords")) return (s._roles = R);   // real melody and chord parts: only the bass was missing
    const rest = N.map((n, i) => i).filter((i) => R[i] !== "bass");
    if (!rest.length) return (s._roles = R);
    // two height bands? look for the widest empty gap that leaves a real part on both sides
    const hist = {}; rest.forEach((i) => { hist[N[i][2]] = (hist[N[i][2]] || 0) + 1; });
    const pk = Object.keys(hist).map(Number).sort((x, y) => x - y);
    let cut = null, bestGap = 0, below = 0;
    for (let k = 0; k < pk.length - 1; k++) {
      below += hist[pk[k]];
      const gap = pk[k + 1] - pk[k], share = below / rest.length;
      if (gap >= 3 && share >= 0.2 && share <= 0.75 && gap > bestGap) { bestGap = gap; cut = pk[k + 1]; }
    }
    if (cut !== null) {
      // the upper band must move like a line (mostly one note at a time), otherwise it is just the top of the chords
      const up = rest.filter((i) => N[i][2] >= cut), ons = new Set(up.map((i) => N[i][0]));
      if (up.length / ons.size > 1.6) cut = null;
    }
    if (cut !== null) { rest.forEach((i) => { R[i] = N[i][2] >= cut ? "lead" : "chords"; }); return (s._roles = R); }
    // no clear gap: the top line = notes with nothing sounding above them
    const top = rest.filter((i) => !rest.some((j) => j !== i && N[j][2] > N[i][2] && N[j][0] <= N[i][0] && N[j][0] + N[j][1] > N[i][0]));
    const isTop = new Set(top);
    rest.forEach((i) => {
      if (!isTop.has(i)) { R[i] = "chords"; return; }
      const near = top.filter((j) => Math.abs(N[j][0] - N[i][0]) <= 96).map((j) => N[j][2]).sort((x, y) => x - y);
      const q3 = near[Math.floor(near.length * 0.6)];
      R[i] = N[i][2] >= q3 - 7 && N[i][2] >= Math.min(60, mid) ? "lead" : "chords";
    });
    if (!R.includes("chords") && R.filter((r) => r === "lead").length === rest.length && (groups && Object.values(groups).some((g) => g.length > 2))) {
      rest.forEach((i) => { if (!isTop.has(i)) R[i] = "chords"; });
    }
    return (s._roles = R);
  }
  function rolesOld(s, byTrack, kinds) {
    const R = byTrack.slice();
    const groups = {};
    s.notes.forEach((n, i) => { (groups[n[0]] = groups[n[0]] || []).push(i); });
    const ps = s.notes.map((n) => n[2]).sort((a, b) => a - b), mid = ps[Math.floor(ps.length / 2)];
    const bassTop = Math.min(55, mid - 5), melLow = Math.max(60, mid);
    const needBass = !kinds.has("bass"), needLead = !kinds.has("lead") || kinds.size === 1, needCh = !kinds.has("chords");
    for (const on in groups) {
      const g = groups[on].slice().sort((a, b) => s.notes[a][2] - s.notes[b][2]);
      const lo = g[0], hi = g[g.length - 1];
      for (const i of g) {
        if (byTrack[i] === "bass" && !needLead && !needCh) continue;
        const p = s.notes[i][2];
        if (needBass && i === lo && p <= bassTop && (g.length > 1 || p <= bassTop - 3) && byTrack[i] !== "bass") R[i] = "bass";
        else if (byTrack[i] === "bass") R[i] = "bass";
        else if (i === hi && p >= melLow && (needLead || byTrack[i] === "lead")) R[i] = "lead";
        else if (needCh || byTrack[i] === "chords" || kinds.size === 1) R[i] = g.length === 1 && p >= melLow && needLead ? "lead" : "chords";
      }
    }
    return R;
  }
  function setSolo(s, k, r) {   // k = "chords" | "bass" | "lead" | null (everything)
    s._solo = k;
    const R = roles(s);
    r.rects.forEach((e, i) => { e.classList.toggle("mute", !!k && R[i] !== k); if (e._sl) e._sl.classList.toggle("mute", !!k && R[i] !== k); });
    if (playing && playing.song === s && playing.parts) for (const q of ROLES) playing.parts[q].gain.setTargetAtTime(k && k !== q ? 0 : 1, playing.a.currentTime, 0.015);
  }

  // ------------------------------------------------------------------ the drawing: 8 bars of piano roll
  function roll(api, s, Q, bars) {
    bars = bars || 8;
    const W = 300 * bars / 8, H = 92, pad = 4, len = bars * 4 * Q;
    const ps = s.notes.map((n) => n[2]);
    const lo = Math.min(...ps) - 1, hi = Math.max(...ps) + 1;
    const g = api.svg(W, H); g.setAttribute("class", "sm-roll"); g.removeAttribute("width"); g.removeAttribute("height");
    const x = (q) => pad + (W - 2 * pad) * q / len, W0 = W, rowH = (H - 2 * pad) / Math.max(12, hi - lo), y = (p) => H - pad - (p - lo + 1) * rowH;
    for (let b = 0; b <= bars; b++) api.add(g, "line", { x1: x(b * 4 * Q), x2: x(b * 4 * Q), y1: 0, y2: H, class: "bar" });
    const ph = api.add(g, "rect", { x: 0, y: 0, width: 2, height: H, class: "ph" });
    const R = roles(s);
    const rects = s.notes.map(([on, d, p], i) => api.add(g, "rect", { x: x(on), y: y(p), width: Math.max(1.5, x(on + d) - x(on) - 0.5), height: Math.max(1.5, rowH - 0.5), class: "n " + R[i] + (s._solo && s._solo !== R[i] ? " mute" : "") }));
    const SL = slides(s);   // a slide = a ramp from the pitch it leaves into the start of the note
    s.notes.forEach(([on, d, p], i) => {
      if (!SL[i]) return;
      const w = Math.min(x(on + d) - x(on), x(Q / 2) - x(0)), y0 = y(SL[i]) + rowH / 2, y1 = y(p) + rowH / 2;
      const e = api.add(g, "path", { d: `M${(x(on) - w * 0.15).toFixed(1)} ${y0.toFixed(1)} L${(x(on) + w * 0.6).toFixed(1)} ${y1.toFixed(1)}`, class: "sl" + (s._solo && s._solo !== R[i] ? " mute" : "") });
      rects[i]._sl = e;
    });
    return { svg: g, rects, ph, x: (beat) => x(beat * Q), W: W0, beatAt: (px) => Math.max(0, (px - pad) / (W - 2 * pad) * bars * 4) };
  }

  // chord name -> roman numeral in the song's key ("Cm" in "Cm" = i)
  function roman(ch, key) {
    if (!ch || !key) return ch || "\u00b7";
    const pr = (n) => NOTE.indexOf(n.replace(/m$/, "")), kr = pr(key), cr = pr(ch);
    if (kr < 0 || cr < 0) return ch;
    const r = ROMAN[(cr - kr + 12) % 12];
    return ch.endsWith("m") ? r.toLowerCase() : r;
  }

  async function render(pane, api) {
    const { h, esc, n0, slide, title, rows, chips, rank } = api;
    if (!document.getElementById("sm-css")) { const st = document.createElement("style"); st.id = "sm-css"; st.textContent = CSS; document.head.append(st); }
    let D;
    try { D = window.SONGS_SCIENCE_DATA || await (await (window.ktData ? window.ktData("songs") : fetch("science/songs-data.json"))).json(); }
    catch (e) { const x = slide("s-mist", "Song MIDI", ""); x.append(title("h2", "Could not load the data.", "science/songs-data.json is missing next to this page.")); pane.append(x); return; }
    window.SONGS_SCIENCE_DATA = D;
    let QUANT_OFF = !!window.KT2_SONG_QUANT_OFF;
    try { if (localStorage.getItem("KT2_SONG_QUANT_OFF") === "1") QUANT_OFF = true; } catch (e) { /* storage blocked */ }
    if (QUANT_OFF && !D._rawOn) { D._rawOn = true; for (const x of D.songs) if (x.raw) x.notes = x.notes.map((n, i) => [x.raw[i][0], x.raw[i][1], n[2], n[3], n[4]]); }
    const Q = D.q || 12, mine = (x) => x.grp === "Your playlist";
    // 13 Nov: a saved short clip came twice (unfinished and finished form); the unfinished copy is hidden. KT2_SONG_DUPS_SHOW = both.
    let DUPS = !!window.KT2_SONG_DUPS_SHOW;
    try { if (localStorage.getItem("KT2_SONG_DUPS_SHOW") === "1") DUPS = true; } catch (e) { /* storage blocked */ }
    const hid = (x) => (PL_OFF && mine(x)) || (STEMS_OFF && x.src === "stems") || (x.dup && !DUPS);
    const S = D.songs.filter((x) => !hid(x)), AR = D.artists.filter((a) => !(PL_OFF && a.id === "playlist") && !(STEMS_OFF && a.id === "stems"));
    const REAL = S.filter((x) => x.src !== "none"), cnt = (k) => S.filter((x) => x.src === k).length;
    const ST = PL_OFF ? Object.assign({}, D.stats, { songs: REAL.length, midi: cnt("midi"), video: cnt("video"), tab: cnt("tab"), sketch: cnt("sketch"), none: 0 }) : D.stats;
    const inGrp = (x, name) => (x.grp || x.artist) === name;

    // 1. hero
    let s = slide("s-night", "Backend data", "Song MIDI");
    s.append(title("h1", `${REAL.length} songs, real notes.`, ST.none ? "From your artist hunts and your playlist. Press one to hear it." : "From your artist hunts. Press one to hear it."));
    s.append(h("p", "lede", "Every MIDI the hunt threads found on YouTube, Songsterr and free MIDI sites, sorted by artist. Each card plays the busiest 8 bars of the song, shows the chord in every bar and says where the notes came from, so you know how much to trust it."));
    s.append(h("div", "spacer"));
    s.append(rows([
      ["Songs", n0(REAL.length), `${n0(ST.files)} MIDI files, best one per song`],
      ["Artists", String(AR.length), AR.map((a) => a.name).join(" \u00b7 ")],
      ["Exact or video", n0(ST.midi + ST.video), `${ST.midi} exact MIDI \u00b7 ${ST.video} read from videos`],
      ["Tabs / sketches", `${ST.tab} / ${ST.sketch}`, "tabs are note-for-note; sketches are chords only"],
    ].concat(ST.none ? [["Not found", n0(ST.none), "playlist songs with no notes online yet, shown as red cards"]] : [])));
    pane.append(s);

    // 2. per artist: what their songs do
    s = slide("s-ink", "Per artist", "What their songs do");
    s.append(title("h2", "Each artist's fingerprint.", "Minor share, usual tempo and the loop that comes up most, counted in the song's own key."));
    const art = h("div", "sm-art");
    for (const A of AR) {
      const L = REAL.filter((x) => inGrp(x, A.name));
      if (!L.length) continue;
      const minor = L.filter((x) => x.minor).length;
      const bpms = L.map((x) => x.bpm).filter(Boolean).sort((a, b) => a - b);
      const loops = {};
      for (const x of L) { const run = x.chords.filter(Boolean).map((c) => roman(c, x.key)).filter((c, i, a) => i === 0 || c !== a[i - 1]).slice(0, 4); if (run.length >= 2) { const k = run.join(" "); loops[k] = (loops[k] || 0) + 1; } }
      const top = Object.entries(loops).sort((a, b) => b[1] - a[1])[0];
      const moves = {};
      for (const x of L) for (let i = 1; i < 8; i++) { const a = roman(x.chords[i - 1], x.key), b = roman(x.chords[i], x.key); if (x.chords[i - 1] && x.chords[i] && a !== b) moves[a + " \u2192 " + b] = (moves[a + " \u2192 " + b] || 0) + 1; }
      const mv = Object.entries(moves).sort((a, b) => b[1] - a[1]).slice(0, 3).map((m) => m[0]).join(" \u00b7 ");
      art.append(h("div", "", `<b>${esc(A.name)}</b><small>${L.length} songs \u00b7 ${Math.round(100 * minor / L.length)}% minor${bpms.length ? ` \u00b7 ${bpms[Math.floor(bpms.length / 2)]} BPM middle` : ""}</small><small>${esc(A.tags.join(" \u00b7 "))}</small>${top ? `<div class="loop">${esc(top[0])}${top[1] > 1 ? ` <span style="opacity:.6">\u00d7${top[1]}</span>` : ""}</div>` : ""}<p>Favourite moves: ${esc(mv || "\u2014")}</p>`));
    }
    s.append(art);
    pane.append(s);

    // 3. the cards
    s = slide("s-mist", "The songs", "Click a card to play, click again to stop");
    s.style.minHeight = "0";
    s.append(title("h2", "Every song.", ROWS_OLD ? "Purple = bass, dark = melody, grey = chords, outline = vocal. Press a part on a card to hear it alone, FULL for the whole song." : "Analysed songs are one row each: the original on the left, the MIDI on the right. CHORUS / FULL switches both sides."));
    let who = "all", src = "all", auto = true, bpm = 120;
    const NI = S.filter((x) => x.insta).length;   // 13 Nov: the saved short clips, finished to full loops; their own filter chip
    const tools = h("div", "d-tools");
    const ac1 = chips([["all", "ALL"]].concat(AR.map((a) => [a.name, `${a.name.toUpperCase()} ${a.songs}`])), "all", (v) => { who = v; draw(); }); ac1.style.margin = "0";
    const ac2 = chips([["all", "ANY SOURCE"]].concat(Object.entries(SRC).map(([k, v]) => [k, v[0]])).concat(NI ? [["insta", `INSTA ${NI}`]] : []).concat(ST.none ? [["none", `${NONE[0]} ${ST.none}`]] : []), "all", (v) => { src = v; draw(); }); ac2.style.margin = "0";
    const q = h("input", "art-q"); q.placeholder = "Search: Jocelyn, Cm, house, 140..."; q.setAttribute("aria-label", "search songs");
    const bc = h("label", "bpm-ctl", `TEMPO <input type="range" min="60" max="180" step="1" value="120"><b>OWN</b>`);
    const rng = bc.querySelector("input"), bl = bc.querySelector("b");
    rng.oninput = () => { auto = false; bpm = +rng.value; bl.textContent = bpm + " BPM"; };
    bl.style.cursor = "pointer"; bl.title = "Click for each song's own tempo"; bl.onclick = (e) => { e.preventDefault(); auto = true; bl.textContent = "OWN"; };
    tools.append(ac1, ac2, q, bc);
    const grid = h("div", "dgrid");
    s.append(tools, grid);
    function card(x) {   // the card plus, under it, Eman's own note on the mood and feeling
      const c = cardOnly(x);
      if (NOTES_OFF) return c;
      const w = h("div", "sm-wrap"), t = h("textarea", "sm-note");
      t.value = NOTES[noteId(x)] || ""; t.spellcheck = false;
      if (CM_OLD) {
        t.rows = 1; t.placeholder = "MOOD / FEELING"; t.setAttribute("aria-label", "mood and feeling of " + x.song);
        const fit = () => { t.style.height = "auto"; t.style.height = Math.max(34, t.scrollHeight + 2) + "px"; t.classList.toggle("has", !!t.value.trim()); };
        t.oninput = () => { saveNote(x, t.value); fit(); };
        w.append(c, t); requestAnimationFrame(fit);
        return w;
      }
      // the comment box: a labelled field, and every time written in it (0:12) becomes a button that plays from there
      const box = h("div", "sm-cm"), lab = h("label", "", "<span>COMMENT</span>"), tms = h("div", "sm-tms");
      t.rows = 2; t.placeholder = "Write a comment\u2026"; t.setAttribute("aria-label", "comment on " + x.song);
      const times = () => {
        tms.replaceChildren();
        if (!c._seek) return;
        const seen = {};
        (t.value.match(/\b\d{1,2}:[0-5]\d\b/g) || []).forEach((m) => {
          if (seen[m]) return; seen[m] = 1;
          const sec = +m.split(":")[0] * 60 + +m.split(":")[1];
          const b = h("button", "", "\u25b6 " + m); b.type = "button"; b.title = "Play from " + m;
          b.onclick = () => c._seek(sec);
          tms.append(b);
        });
      };
      const fit = () => { t.style.height = "auto"; t.style.height = Math.max(62, t.scrollHeight + 2) + "px"; t.classList.toggle("has", !!t.value.trim()); };
      t.oninput = () => { saveNote(x, t.value); fit(); times(); };
      c._stamp = (sec) => {   // pressing the running time writes it into the comment
        const v = t.value, add = (v && !/\s$/.test(v) ? "\n" : "") + mmss(sec) + " ";
        t.value = v + add; saveNote(x, t.value); fit(); times(); t.focus(); t.setSelectionRange(t.value.length, t.value.length);
      };
      box.append(lab, t, tms); w.append(c, box); requestAnimationFrame(() => { fit(); times(); });
      return w;
    }
    function cardOnly(x) {
      if (x.src === "none") {   // no notes found: listed so Eman sees what is missing
        const d = h("div", "dcard sm-none");
        d.append(h("div", "dh", `<div><b>${esc(x.song)}</b><small style="display:block;opacity:.7;font-size:11px;margin-top:3px">${esc(x.artist)}</small></div>`));
        d.append(h("div", "sm-nf", NONE[0]));
        d.append(h("div", "meta", `<span>NO NOTES ONLINE YET</span>`));
        return d;
      }
      const c = h("button", "dcard"); c.type = "button";
      const r = roll(api, x, Q);
      const V = { s: x, r, beats: 32, full: false };   // what the card shows and plays now: the 8 preview bars, or the whole song (FULL)
      c.append(h("div", "dh", `<div><b>${esc(x.song)}</b><small style="display:block;opacity:.7;font-size:11px;margin-top:3px">${esc(x.artist)}${x.feat ? " & " + esc(x.feat) : ""}</small></div><span class="play"><svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg></span>`));
      const curBpm = () => (auto ? (BPM_OLD ? (x.bpm || x.playBpm || 110) : (x.playBpm || x.bpm || 110)) : bpm);
      let want = 0;
      const go = (song, rr, chipsNow, from) => {   // analysed songs first get their own sounds ready (a moment on the first play), then play
        const me = ++want;
        if (PATCH_OFF || !x.patch || x._sy) { play(api, song, Q, curBpm(), c, rr, chipsNow, from, V.beats, x._sy || null); return; }
        stop(); stopRef(); c.classList.add("wait");
        synthsFor(api, x).catch(() => null).then((sy) => { c.classList.remove("wait"); if (me === want) play(api, song, Q, curBpm(), c, rr, chipsNow, from, V.beats, sy); });
      };
      const idle = () => { if (c._time && !(playing && playing.card === c)) c._time.textContent = "0:00 / " + mmss(V.beats * 60 / curBpm()); };
      let oChip = null;
      if (!CM_OLD) {   // running time; press it to write that time into the comment
        const tm = c._time = h("span", "sm-time", "0:00 / " + mmss(32 * 60 / curBpm()));
        tm.title = "Press to write this time into the comment";
        tm.onclick = (e) => {
          e.stopPropagation(); e.preventDefault();
          const mine = refOn && refOn.x === x ? refOn.pos() : playing && playing.card === c ? playing.pos() : 0;
          if (c._stamp) c._stamp(mine);
        };
        const hd = c.querySelector(".dh"); hd.insertBefore(tm, hd.querySelector(".play"));
        c._seek = (sec) => {   // the original keeps playing if that is what was on, otherwise the notes
          if (refOn && refOn.x === x && refOn.chip) { playRef(api, x, refOn.chip, tm, sec, refOn.clip); return; }
          go(V.s, V.r, V.full ? [] : cs, sec);
        };
      }
      c.append(r.svg);
      const ch = h("div", "sm-ch"); const cs = x.chords.map((k) => h("span", "", esc(k || "\u00b7"))); cs.forEach((e) => ch.append(e)); c.append(ch);
      c.append(h("div", "meta", `<span class="sm-src ${x.src}" title="${esc(SRC[x.src][1])}">${SRC[x.src][0]}</span>${x.insta ? '<span class="sm-src">INSTA</span>' : ""}<span>${esc(x.key)}</span>${x.loose ? '<span title="These notes fit no steady beat well, so the timing is a rough guess">ROUGH TIMING</span>' : ""}<span${x.bpmPage && !BPM_OLD ? ` title="A web page lists ${x.bpmPage} BPM"` : ""}>${x.bpm ? (x.bpmGuess && !BPM_OLD ? "~" : "") + x.bpm + " BPM" : "BPM ?"}</span><span>${x.part ? esc(x.part).toUpperCase() + " \u00b7 " : ""}BARS ${x.from}\u2013${x.from + 7} of ${x.bars}</span>${x.versions > 1 ? `<span>${x.versions} VERSIONS</span>` : ""}`));
      const have = SOLO_OFF ? [] : [["chords", "CHORDS"], ["bass", "BASS"], ["lead", "MELODY"], ["vocal", "VOCAL"]].filter(([k]) => roles(x).includes(k));
      const extra = (!PL_OFF && (x.ref || x.url)) || x.mix || x.hq;
      const ab = h("div", "sm-ab");
      if (have.length > 1) {   // solo one part; press it again for everything
        const btns = have.map(([k, lab]) => {
          const e = h("span", "solo" + (x._solo === k ? " on" : ""), lab); e.title = "Solo the " + lab.toLowerCase() + " (press again for everything)";
          e.onclick = (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const k2 = x._solo === k ? null : k;
            x._solo = k2; setSolo(V.s, k2, V.r); btns.forEach((q, i) => q.classList.toggle("on", have[i][0] === k2));
            if (!(playing && playing.card === c)) c.click();
          };
          return e;
        });
        btns.forEach((e) => ab.append(e));
      }
      if (x.full && !FULL_OFF) {   // the whole song instead of the 8 preview bars: scroll it, press anywhere in it to play from there
        const fb = h("span", "full", "FULL"); fb.title = "Show and play the whole song (press again for the 8-bar preview)";
        let box = null;
        fb.onclick = async (ev) => {
          ev.stopPropagation(); ev.preventDefault();
          if (playing && playing.card === c) stop();
          if (V.full) {   // back to the preview
            box.replaceWith(r.svg); ch.style.display = ""; fb.classList.remove("on");
            V.s = x; V.r = r; V.beats = 32; V.full = false; setSolo(x, x._solo || null, r); idle(); return;
          }
          fb.classList.add("wait");
          let F;
          try { F = (await fullData()).songs[x.full]; } catch (e) { F = null; }
          fb.classList.remove("wait");
          if (!F || !F.n || !F.n.length) { fb.textContent = "NO FULL SONG"; fb.classList.add("weak"); return; }
          const fs = x._fullSong || (x._fullSong = { notes: F.n, tracks: x.tracks, src: x.src, song: x.song });
          fs._solo = x._solo || null;
          const fr = roll(api, fs, Q, F.bars);
          box = h("div", "sm-fullbox"); fr.svg.style.width = (F.bars / 8 * 100) + "%"; box.append(fr.svg); fr.box = box;
          box.onclick = (e) => {   // play from the bar that was pressed
            e.stopPropagation(); e.preventDefault();
            const q = fr.svg.getBoundingClientRect(), beat = Math.floor(fr.beatAt((e.clientX - q.left) / q.width * fr.W) / 4) * 4;
            go(fs, fr, [], beat * 60 / curBpm());
          };
          r.svg.replaceWith(box); ch.style.display = "none"; fb.classList.add("on");
          V.s = fs; V.r = fr; V.beats = F.bars * 4; V.full = true; idle();
          requestAnimationFrame(() => { box.scrollLeft = Math.max(0, fr.x(F.at || 0) / fr.W * box.scrollWidth - 4); });
        };
        ab.append(fb);
      }
      if (extra) {
        if (ab.children.length) ab.append(h("i"));
        if (x.ref) {
          const o = h("span", x.ref.ok ? "" : "weak", "ORIGINAL");
          o.title = x.ref.ok ? "Play the original at the same 8 bars" : "Play the original near these 8 bars (the line-up is a best guess)";
          oChip = o;
          o.onclick = (e) => { e.stopPropagation(); e.preventDefault(); playRef(api, x, o, c._time); };
          ab.append(o);
        }
        if (x.url && /^https:\/\//.test(x.url)) {
          const u = h("span", "", "SOURCE \u2197"); u.title = "Open the page these notes are based on";
          u.onclick = (e) => { e.stopPropagation(); e.preventDefault(); window.open(x.url, "_blank", "noopener"); };
          ab.append(u);
        }
        if (x.conf === "low") ab.append(h("span", "weak", "LOW TRUST"));
        if (x.mix) {   // analysed songs: the same 8 bars from the song itself, and from the remake of it
          [["ORIGINAL", 0, "Play the original at these 8 bars"], ["REMAKE", 1, "Play the remake of these 8 bars"]].forEach(([lab, chn, tip]) => {
            const o = h("span", "", lab); o.title = tip;
            o.onclick = (e) => { e.stopPropagation(); e.preventDefault(); playRef(api, x, o, c._time, null, { p: x.mix.f, s: x.mix.s, d: x.mix.d, ch: chn }); };
            ab.append(o);
          });
        }
        if (x.hq) {   // the whole finished loop, played with the clean sounds and drums
          const o = h("span", "", "HQ"); o.title = "Play the whole loop with the clean sounds";
          o.onclick = (e) => { e.stopPropagation(); e.preventDefault(); playRef(api, x, o, c._time, null, { p: x.hq.f, s: x.hq.s, d: x.hq.d }); };
          ab.append(o);
        }
      }
      if (ab.children.length) c.append(ab);
      c.onclick = () => { if (playing && playing.card === c) { stop(); return; } 
        let from = 0;   // the whole song starts at the bar on the left edge of what is scrolled into view
        if (V.full && V.r.box) from = Math.floor(V.r.beatAt(V.r.box.scrollLeft / V.r.box.scrollWidth * V.r.W + 4) / 4) * 4 * 60 / curBpm();
        go(V.s, V.r, V.full ? [] : cs, from);
      };
      return c;
    }
    // ---------------------------------------------------------------- 13 Nov: one full-width row per analysed song
    const nkey = (x) => (x.artist + "|" + x.song).toLowerCase().replace(/[^a-z0-9|]+/g, "");
    const OLDER = {};   // the earlier notes of a song (from before it was analysed) = its V1
    if (!ROWS_OLD) for (const o of S) if (o.src !== "stems" && o.src !== "none" && o.notes && o.notes.length && !OLDER[nkey(o)]) OLDER[nkey(o)] = o;
    const PLAY = '<svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg>';
    // rows of [M][S] NAME on the left and one lane per row on the right, with one marker over all lanes
    function laneBox(keys, names, bad) {   // bad = { key: why } : parts the song gave no usable notes for, shown red and muted
      bad = bad || {};
      const st = { m: new Set(keys.filter((k) => bad[k])), s: new Set() }, on = (k) => (st.s.size ? st.s.has(k) : !st.m.has(k));
      const el = h("div", "sm-lanes"), heads = h("div", "sm-heads"), scroll = h("div", "sm-scroll"), inner = h("div", "sm-inner"), ph = h("div", "sm-phd");
      const ln = {}, hd = {}, B = { el, scroll, inner, ph, ln, on, change: null };
      const paint = () => { for (const k of keys) { ln[k].classList.toggle("off", !on(k)); hd[k].classList.toggle("off", !on(k)); hd[k]._m.classList.toggle("on", st.m.has(k)); hd[k]._s.classList.toggle("on", st.s.has(k)); } };
      keys.forEach((k, i) => {
        const d = hd[k] = h("div", "sm-hd k-" + k);
        if (keys.length > 1) {
          const m = d._m = h("button", "m", "M"), so = d._s = h("button", "s", "S"); m.type = so.type = "button";
          m.title = "Mute " + names[i].toLowerCase(); so.title = "Solo " + names[i].toLowerCase();
          m.onclick = () => { if (st.m.has(k)) st.m.delete(k); else st.m.add(k); paint(); if (B.change) B.change(); };
          so.onclick = () => { if (st.s.has(k)) st.s.delete(k); else st.s.add(k); paint(); if (B.change) B.change(); };
          d.append(m, so);
        } else d._m = d._s = h("i");
        d.append(h("span", "", esc(names[i])));
        heads.append(d);
        ln[k] = h("div", "sm-ln k-" + k); inner.append(ln[k]);
        if (bad[k]) { d.classList.add("bad"); ln[k].classList.add("bad"); d.title = bad[k]; ln[k].append(h("em", "", esc(String(bad[k]).toUpperCase()))); }
      });
      paint();
      inner.append(ph); scroll.append(inner); el.append(heads, scroll);
      B.at = (ev) => { const q = inner.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - q.left) / q.width)); };
      B.mark = (f) => { ph.style.left = (100 * f) + "%"; };
      B.follow = (f) => { const px = f * scroll.scrollWidth; if (px < scroll.scrollLeft || px > scroll.scrollLeft + scroll.clientWidth * 0.9) scroll.scrollLeft = Math.max(0, px - scroll.clientWidth * 0.1); };
      return B;
    }
    function waveSvg(hex) {   // SoundCloud-style bars from the stored peaks
      const n = hex.length / 2, g = api.svg(n, 40); g.setAttribute("viewBox", `0 0 ${n} 40`); g.setAttribute("preserveAspectRatio", "none"); g.removeAttribute("width"); g.removeAttribute("height");
      let d = "";
      for (let i = 0; i < n; i++) { const v = Math.max(1, parseInt(hex.substr(i * 2, 2), 16) / 255 * 36); d += `M${i + 0.15} ${(20 - v / 2).toFixed(1)}h.7v${v.toFixed(1)}h-.7z`; }
      api.add(g, "path", { d, class: "w" });
      return g;
    }
    function noteSvg(s, idx, bars, SL, rects) {   // one layer's notes over the given bars
      const W = bars * 96, len = bars * 4 * Q, g = api.svg(W, 40); g.setAttribute("viewBox", `0 0 ${W} 40`); g.setAttribute("preserveAspectRatio", "none"); g.removeAttribute("width"); g.removeAttribute("height");
      for (let b = 1; b < bars; b++) api.add(g, "line", { x1: b * 96, x2: b * 96, y1: 0, y2: 40, class: "bar" });
      if (!idx.length) return g;
      let lo = 127, hi = 0; for (const i of idx) { lo = Math.min(lo, s.notes[i][2]); hi = Math.max(hi, s.notes[i][2]); }
      const rh = 36 / Math.max(8, hi - lo + 1), X = (q) => W * q / len, Y = (p) => 38 - (p - lo + 1) * rh - (36 - rh * (hi - lo + 1)) / 2 * (hi - lo + 1 < 8 ? 1 : 0);
      for (const i of idx) {
        const [on, d, p] = s.notes[i];
        rects[i] = api.add(g, "rect", { x: X(on).toFixed(1), y: Y(p).toFixed(1), width: Math.max(1.5, X(d) - 0.6).toFixed(1), height: Math.max(1.5, rh - 0.4).toFixed(1), class: "n" });
        if (SL[i]) { const w = Math.min(X(d), X(Q / 2)); api.add(g, "path", { d: `M${(X(on) - w * 0.15).toFixed(1)} ${(Y(SL[i]) + rh / 2).toFixed(1)} L${(X(on) + w * 0.6).toFixed(1)} ${(Y(p) + rh / 2).toFixed(1)}`, class: "sl" }); }
      }
      return g;
    }
    // a comment box for one side of a row; times written in it become buttons that play that side from there
    function cmBox(id, label, seek) {
      const box = h("div", "sm-cm"), lab = h("label", "", `<span>${label}</span>`), t = h("textarea", "sm-note"), tms = h("div", "sm-tms");
      t.value = NOTES[id] || ""; t.spellcheck = false; t.rows = 2; t.placeholder = "Write a comment\u2026"; t.setAttribute("aria-label", label.toLowerCase());
      const times = () => {
        tms.replaceChildren(); const seen = {};
        (t.value.match(/\b\d{1,2}:[0-5]\d\b/g) || []).forEach((m) => {
          if (seen[m]) return; seen[m] = 1;
          const b = h("button", "", "\u25b6 " + m); b.type = "button"; b.title = "Play from " + m;
          b.onclick = () => seek(+m.split(":")[0] * 60 + +m.split(":")[1]);
          tms.append(b);
        });
      };
      const fit = () => { t.style.height = "auto"; t.style.height = Math.max(62, t.scrollHeight + 2) + "px"; t.classList.toggle("has", !!t.value.trim()); };
      t.oninput = () => { saveId(id, t.value); fit(); times(); };
      box.append(lab, t, tms); requestAnimationFrame(() => { fit(); times(); });
      box._stamp = (sec) => { const v = t.value; t.value = v + (v && !/\s$/.test(v) ? "\n" : "") + mmss(sec) + " "; saveId(id, t.value); fit(); times(); t.focus(); t.setSelectionRange(t.value.length, t.value.length); };
      return box;
    }
    const bpmOf = (x) => (auto ? (BPM_OLD ? (x.bpm || x.playBpm || 110) : (x.playBpm || x.bpm || 110)) : bpm);
    // ---------------------------------------------------------------- 13 Nov: VST = the sound lab under a row
    // Left = a small MIDI editor for the 8 chorus bars, right = a TOY MACHINE that holds this song's sounds, one per part,
    // not linked to each other. Everything changed here is kept per song in this browser only ("kt2.songmidi.lab");
    // nothing is written to the DAW's TOY MACHINE preset list. KT2_SONG_LAB_OFF hides the button.
    const LAB_KEY = "kt2.songmidi.lab";
    let LABS = {};
    try { LABS = JSON.parse(localStorage.getItem(LAB_KEY) || "{}") || {}; } catch (e) { LABS = {}; }
    const labOf = (x) => LABS["n" + x.n] || (LABS["n" + x.n] = {});
    let labT = 0;
    const labSave = () => { clearTimeout(labT); labT = setTimeout(() => { for (const k in LABS) if (!LABS[k].p && !LABS[k].n) delete LABS[k]; try { localStorage.setItem(LAB_KEY, JSON.stringify(LABS)); } catch (e) { /* storage full or blocked: kept until the page closes */ } }, 300); };
    const L2P = { vocals: "vocal", melody: "main", arp: "arp", chords: "chords", bass: "bass" };
    synthsFor.saved = (x, part) => { const sv = LAB_OFF ? null : (LABS["n" + x.n] || {}).p; if (!sv) return null; for (const k in L2P) if (L2P[k] === part && sv[k]) return sv[k]; return null; };
    const labNotes = (x) => {   // a song's own edited chorus notes come back when its row is drawn
      if (LAB_OFF || x._orig) return;
      const sv = (LABS["n" + x.n] || {}).n;
      if (Array.isArray(sv)) { x._orig = x.notes; x.notes = sv.map((n) => n.slice()); delete x._roles; delete x._slides; }
    };
    let TMUI = null, labClose = null;
    const tmUi = () => TMUI || (TMUI = (async () => {
      if (!document.getElementById("sm-tmcss")) { const l = document.createElement("link"); l.id = "sm-tmcss"; l.rel = "stylesheet"; l.href = "toymachine.css"; document.head.append(l); }
      const one = (src, need) => new Promise((ok, no) => { const t = document.createElement("script"); t.src = src; t.onload = ok; t.onerror = () => (need ? no(new Error(src)) : ok()); document.head.append(t); });
      if (!window.ToyMachineUI) { await one("toymachine-arps.js", false); await one("toymachine.js", true); }
      return window.ToyMachineUI;
    })().catch((e) => { TMUI = null; throw e; }));
    // the editor: all layers drawn, the picked one can be changed. Click = new note, drag = move, drag its end = length,
    // double-click = delete. Sixteenth grid.
    function labEditor(x, st, changed, sound) {
      const wrap = h("div", "sm-edwrap"), SN = Q / 4, LEN = 32 * Q, KX = 4;
      let lastLen = Q / 2, seen = null;
      const lay = () => layersOf({ notes: x.notes, tracks: x.tracks, src: x.src });
      function draw() {
        const N = x.notes, LY = lay();
        let lo = 127, hi = 0; for (const n of N) { lo = Math.min(lo, n[2]); hi = Math.max(hi, n[2]); }
        if (!N.length) { lo = 48; hi = 72; }
        lo = Math.max(0, lo - 4); hi = Math.min(127, hi + 4); while (hi - lo < 23) { hi++; if (lo > 0) lo--; }
        const rows = hi - lo + 1, RH = 11, W = LEN * KX, H = rows * RH;
        const g = api.svg(W, H); g.setAttribute("viewBox", `0 0 ${W} ${H}`); g.setAttribute("preserveAspectRatio", "none"); g.removeAttribute("width"); g.removeAttribute("height"); g.style.height = H + "px"; g.setAttribute("class", "sm-ed");
        for (let p = lo; p <= hi; p++) if ([1, 3, 6, 8, 10].includes(p % 12)) api.add(g, "rect", { x: 0, y: (hi - p) * RH, width: W, height: RH, class: "bk" });
        for (let p = lo; p <= hi; p++) if (p % 12 === 0) api.add(g, "line", { x1: 0, x2: W, y1: (hi - p + 1) * RH, y2: (hi - p + 1) * RH, class: "oc" });
        for (let b = 0; b <= 32; b++) api.add(g, "line", { x1: b * Q * KX, x2: b * Q * KX, y1: 0, y2: H, class: b % 4 ? "bt" : "br" });
        const rc = [];
        const order = N.map((n, i) => i).sort((a, b) => (LY[a] === st.part) - (LY[b] === st.part));   // the picked layer on top
        for (const i of order) { const n = N[i]; rc[i] = api.add(g, "rect", { x: n[0] * KX, y: (hi - n[2]) * RH + 0.5, width: Math.max(3, n[1] * KX - 1), height: RH - 1, class: "en k-" + LY[i] + (LY[i] === st.part ? " own" : ""), "data-i": i }); }
        const at = (ev) => { const q = g.getBoundingClientRect(); return { q: (ev.clientX - q.left) / q.width * LEN, p: hi - Math.floor((ev.clientY - q.top) / q.height * rows) }; };
        const snap = (v) => Math.round(v / SN) * SN;
        const put = (i) => { const n = N[i]; rc[i].setAttribute("x", n[0] * KX); rc[i].setAttribute("y", (hi - n[2]) * RH + 0.5); rc[i].setAttribute("width", Math.max(3, n[1] * KX - 1)); };
        const done = () => { lastLen = Math.max(SN, lastLen); N.sort((a, b) => a[0] - b[0] || a[2] - b[2]); changed(); draw(); };
        g.onpointerdown = (ev) => {
          if (ev.button) return;
          const a = at(ev), own = ev.target.classList && ev.target.classList.contains("own");
          let i, mode;
          if (own) { i = +ev.target.getAttribute("data-i"); mode = a.q > N[i][0] + N[i][1] - Math.max(1.5, N[i][1] * 0.25) ? "len" : "move"; }
          else {
            const tr = x.tracks.findIndex((t, k) => layersOf({ notes: [[0, 1, 60, 100, k]], tracks: x.tracks, src: x.src })[0] === st.part);
            if (tr < 0) return;
            const on = Math.max(0, Math.min(LEN - SN, Math.floor(a.q / SN) * SN));
            i = N.push([on, Math.min(lastLen, LEN - on), Math.max(lo, Math.min(hi, a.p)), 100, tr]) - 1;
            rc[i] = api.add(g, "rect", { height: RH - 1, class: "en own k-" + st.part }); put(i); mode = "len"; sound(N[i][2]);
          }
          const n = N[i], n0 = n.slice(), a0 = a;
          g.setPointerCapture(ev.pointerId);
          g.onpointermove = (e2) => {
            const b = at(e2);
            if (mode === "move") { const p = Math.max(lo, Math.min(hi, n0[2] + (b.p - a0.p))); n[0] = Math.max(0, Math.min(LEN - n[1], snap(n0[0] + b.q - a0.q))); if (p !== n[2]) { n[2] = p; sound(p); } }
            else { n[1] = Math.max(SN, Math.min(LEN - n[0], snap(b.q - n[0]))); lastLen = n[1]; }
            put(i);
          };
          g.onpointerup = () => { g.onpointermove = g.onpointerup = null; done(); };
        };
        const del = (ev) => { if (!(ev.target.classList && ev.target.classList.contains("own"))) return; ev.preventDefault(); N.splice(+ev.target.getAttribute("data-i"), 1); done(); };
        g.ondblclick = del; g.oncontextmenu = del;
        wrap.replaceChildren(g);
        if (seen !== st.part) {   // a newly picked part: bring its notes into view
          seen = st.part;
          const mineP = N.filter((n, i) => LY[i] === st.part).map((n) => n[2]);
          if (mineP.length) requestAnimationFrame(() => { wrap.scrollTop = Math.max(0, (hi - (Math.max(...mineP) + Math.min(...mineP)) / 2) * RH - wrap.clientHeight / 2); });
        }
      }
      return { el: wrap, draw };
    }
    // opens the lab under a row; R = what the row gives it: { row, play(from), stopMine(), redraw(), showChorus() }
    async function openLab(x, R, btn) {
      if (labClose) { const same = labClose.x === x; labClose(); if (same) return; }
      btn.classList.add("wait");
      let UI, P, sy;
      try { [UI, P, sy] = await Promise.all([tmUi(), patchData(), synthsFor(api, x)]); } catch (e) { UI = null; }
      btn.classList.remove("wait");
      if (!UI || !sy) { btn.textContent = "VST MISSING"; return; }
      R.showChorus();
      const a = api.audio(), own = (P.songs || {})[String(x.n)] || {}, saved = labOf(x);
      const lyOfTrack = x.tracks.map((t, k) => layersOf({ notes: [[0, 1, 60, 100, k]], tracks: x.tracks, src: x.src })[0]);
      const parts = LAYS.filter((k) => own[L2P[k]] && lyOfTrack.some((l, i) => l === k && sy[i]));
      if (!parts.length) { btn.textContent = "NO SOUNDS"; return; }
      const synths = (k) => lyOfTrack.map((l, i) => (l === k ? sy[i] : null)).filter(Boolean);
      const cur = {}; for (const k of parts) cur[k] = JSON.parse(JSON.stringify((saved.p && saved.p[k]) || own[L2P[k]]));
      const st = { part: parts.includes("melody") ? "melody" : parts[0] };
      let quiet = true, looping = false;
      x._orig0 = x._orig0 || (x._orig || x.notes).map((n) => n.slice());
      const NAME = { vocals: "VOCAL MELODY", melody: "MELODY", arp: "ARP", chords: "CHORDS", bass: "BASS" };
      // the lab hears the synths directly while nothing plays (keys, new notes); a play run takes them over
      const mon = a.createGain(); mon.gain.value = 0.55; mon.connect(a.destination);
      const monOn = () => { for (const k in sy) { try { sy[k].output.connect(mon); } catch (e) { /* gone */ } } };
      const monOff = () => { for (const k in sy) { try { sy[k].output.disconnect(mon); } catch (e) { /* not connected */ } } };
      const el = h("div", "sm-lab"), bar = h("div", "sm-labbar"), tabs = h("div", "sm-vt"), split = h("div", "sm-labtwo"), left = h("div", "sm-labside"), right = h("div", "sm-labside"), host = h("div", "sm-tmhost");
      const pb = h("button", "sm-pb", PLAY); pb.type = "button"; pb.title = "Play the chorus on a loop";
      const rsM = h("button", "sm-lbtn", "RESET MIDI"), rsS = h("button", "sm-lbtn", "RESET SOUND"), cl = h("button", "sm-lbtn", "CLOSE"); rsM.type = rsS.type = cl.type = "button";
      rsM.title = "Put this song's notes back as they were"; rsS.title = "Put this part's sound back as it was";
      const tb = {};
      parts.forEach((k) => { const b = tb[k] = h("button", "k-" + k, NAME[k]); b.type = "button"; b.onclick = () => pick(k); tabs.append(b); });
      bar.append(pb, tabs, rsM, rsS, cl);
      const ed = labEditor(x, st, () => { const was = looping; saved.n = x.notes.map((n) => n.slice()); labSave(); R.redraw(); mark(); if (was) loopOn(); }, (p) => { const s = synths(st.part)[0]; if (s && !looping) { const t = a.currentTime; s.noteOn(p, 100, t); s.noteOff(p, t + 0.25); } });
      left.append(ed.el); right.append(host); split.append(left, right); el.append(bar, split); R.row.append(el);
      const mark = () => { rsM.disabled = !saved.n; rsS.disabled = !(saved.p && saved.p[st.part]); for (const k of parts) tb[k].classList.toggle("on", k === st.part); };
      const keep = (k) => { (saved.p = saved.p || {})[k] = JSON.parse(JSON.stringify(cur[k])); labSave(); mark(); };
      const fav = { v: [], get() { return this.v; }, set(n) { this.v = n; } };
      const win = UI.open(host, {
        preset: cur[st.part], title: x.song,
        presetIndex: parts.map((k) => ({ id: k, name: cur[k].name || NAME[k], genre: "This song", category: NAME[k], file: k, tags: [] })),
        loadPreset: async (e) => JSON.parse(JSON.stringify(cur[e.id] || cur[st.part])),
        favourites: fav,
        onSave: () => keep(st.part),
        api: {
          setPreset: (p) => { for (const s of synths(st.part)) { s.setPreset(p); giveSample(a, s, p, P.smp); } if (quiet) return; cur[st.part] = JSON.parse(JSON.stringify(p)); keep(st.part); },
          setMacro: (i, v) => { const m = cur[st.part].macros; if (m && m[i]) m[i].value = v; for (const s of synths(st.part)) s.setMacro(i, v); keep(st.part); },
          setPads: (pads) => pads.forEach((d, i) => { if (d.kind && d.kind !== "macro" && d.pos) for (const s of synths(st.part)) { s.setPad(i, d.pos[0], d.pos[1]); if (s.setPadStar) s.setPadStar(i, d.star ? d.star[0] : -1, d.star ? d.star[1] : 0); } }),
          setSample: (smp) => { for (const s of synths(st.part)) s.setSample(smp); },
          noteOn: (p, v) => { for (const s of synths(st.part).slice(0, 1)) s.noteOn(p, v); },
          noteOff: (p) => { for (const s of synths(st.part).slice(0, 1)) s.noteOff(p); },
          pitchBend: (v) => { for (const s of synths(st.part)) s.bend(v); },
          modWheel: (v) => { for (const s of synths(st.part)) s.wheel(v); },
          audition: () => {},
          getBpm: () => bpmOf(x),
          meter: () => { const s = synths(st.part)[0], m = s ? s.meter() : { peak: 0 }; return { ok: true, peak: m.peak, l: m.peak, r: m.peak, dice: m.dice || null, arp: m.arp == null ? -1 : m.arp }; },
        },
      });
      quiet = false;
      function pick(k) { st.part = k; quiet = true; try { win.setPreset(JSON.parse(JSON.stringify(cur[k]))); } finally { quiet = false; } ed.draw(); mark(); }
      R.hooks.before = monOff;
      R.hooks.after = (ended) => { if (looping && ended) { R.play(0); return; } looping = false; pb.classList.remove("on"); monOn(); };
      function loopOn() { R.showChorus(); looping = true; pb.classList.add("on"); R.play(0); }
      const loopOff = () => { looping = false; pb.classList.remove("on"); R.stopMine(); monOn(); };
      pb.onclick = () => (looping ? loopOff() : loopOn());
      rsM.onclick = () => { if (!saved.n) return; if (looping) loopOff(); const o = x._orig0; x.notes.splice(0, x.notes.length, ...o.map((n) => n.slice())); delete saved.n; labSave(); R.redraw(); ed.draw(); mark(); };
      rsS.onclick = () => { const k = st.part; if (saved.p) delete saved.p[k]; if (saved.p && !Object.keys(saved.p).length) delete saved.p; cur[k] = JSON.parse(JSON.stringify(own[L2P[k]])); quiet = true; try { win.setPreset(JSON.parse(JSON.stringify(cur[k]))); } finally { quiet = false; } labSave(); mark(); };
      const close = () => { if (looping) loopOff(); monOff(); try { mon.disconnect(); } catch (e) { /* gone */ } try { win.close(); } catch (e) { /* closed */ } el.remove(); btn.classList.remove("on"); R.hooks.before = R.hooks.after = null; labClose = null; };
      cl.onclick = close; close.x = x; labClose = close;
      btn.classList.add("on");
      monOn(); ed.draw(); mark();
      requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
    function rowCard(x) {
      labNotes(x);
      const row = h("div", "sm-row"), o = OLDER[nkey(x)] || null;
      let FULL = false, ver = "v2";
      const head = h("div", "sm-rh");
      head.append(h("div", "", `<b>${esc(x.song)}</b><small>${esc(x.artist)}${x.feat ? " & " + esc(x.feat) : ""}</small>`));
      head.append(h("div", "meta", `${x.insta ? '<span class="sm-src">INSTA</span>' : ""}${x.type ? `<span class="sm-src">${esc(String(x.type).toUpperCase())}</span>` : ""}<span>${esc(x.key)}</span><span>${x.bpm ? x.bpm + " BPM" : "BPM ?"}</span><span>${x.part ? esc(x.part).toUpperCase() + " \u00b7 " : ""}BARS ${x.from}\u2013${x.from + 7} of ${x.bars}</span>`));
      const sw = h("div", "sm-sw"), bC = h("button", "on", "CHORUS"), bF = h("button", "", "FULL"); bC.type = bF.type = "button";
      bC.title = "The main part of the song, on both sides"; bF.title = "The whole song, on both sides";
      sw.append(bC, bF); head.append(sw);
      const two = h("div", "sm-two"), sideA = h("div", "sm-side"), sideM = h("div", "sm-side");
      two.append(sideA, sideM); row.append(head, two);

      // ---- left: the original
      const A = { box: null, clip: null };
      const pbA = h("button", "sm-pb", PLAY); pbA.type = "button"; pbA.title = "Play the original";
      const tA = h("span", "sm-time", "0:00"); tA.title = "Press to write this time into the comment";
      const tagA = h("span", "sm-tag", "");
      const shA = h("div", "sm-sh"); shA.append(pbA, h("em", "", "ORIGINAL"), tagA, tA);
      const bodyA = h("div");
      const playA = (from) => { if (A.stem) { playStems(api, x, A.stem, from); return; } if (!A.clip) return; playRef(api, x, pbA, tA, from, A.clip); };
      const cmA = cmBox(noteId(x) + "|wav", "COMMENT \u00b7 ORIGINAL", (sec) => playA(sec));
      pbA.onclick = () => playA(null);
      tA.onclick = () => cmA._stamp(stemOn && stemOn.o.btn === pbA ? stemOn.pos() : refOn && refOn.chip === pbA ? refOn.pos() : 0);
      sideA.append(shA, bodyA, cmA);
      function drawA() {
        if ((refOn && refOn.chip === pbA) || (stemOn && stemOn.o.btn === pbA)) stopRef();
        A.stem = null;
        const SK = !STEMAU_OFF && x.stems && x.stems.parts && !(x.stems.b && STBIN_OFF) ? ["vocals", "chords", "bass", "drums"].filter((k) => x.stems.parts[k]) : [];
        if (SK.length) {   // the original, one row per stem
          const car = (x.stems.carries || []).filter((k) => k !== "chords").map((k) => k.toUpperCase());
          const nm = { vocals: "VOCALS", chords: ["CHORDS"].concat(car).join(" + "), bass: "BASS", drums: "DRUMS" };
          const B = A.box = laneBox(SK, SK.map((k) => nm[k])), d = x.stems.d;
          for (const k of SK) if (x.stems.parts[k].pk) B.ln[k].append(waveSvg(x.stems.parts[k].pk));
          A.clip = null; pbA.disabled = false; pbA.style.opacity = "";
          tagA.textContent = FULL && !x.insta ? "CHORUS ONLY" : ""; tagA.style.display = tagA.textContent ? "" : "none";
          const idle = "0:00 / " + mmss(d); tA.textContent = idle;
          A.stem = { btn: pbA, on: B.on, tick: (t, dd) => { B.ph.classList.add("on"); B.mark(t / dd); tA.classList.add("on"); tA.textContent = mmss(t) + " / " + mmss(dd); }, off: () => { B.ph.classList.remove("on"); tA.classList.remove("on"); tA.textContent = idle; }, miss: () => { tagA.textContent = "CLIP MISSING"; tagA.style.display = ""; } };
          B.change = () => { if (stemOn && stemOn.o === A.stem) for (const k in stemOn.gains) stemOn.gains[k].gain.setTargetAtTime(B.on(k) ? 0.6 : 0, api.audio().currentTime, 0.015); };
          B.scroll.onclick = (ev) => playA(B.at(ev) * d);
          bodyA.replaceChildren(B.el);
          return;
        }
        const whole = FULL && x.orig, src = whole ? x.orig : x.mix, pk = whole ? x.orig.pk : x.pk;
        tagA.textContent = FULL && !whole && src ? "CHORUS ONLY" : ""; tagA.style.display = tagA.textContent ? "" : "none";
        if (!src) { A.clip = null; A.box = null; pbA.disabled = true; pbA.style.opacity = ".3"; tA.textContent = ""; bodyA.replaceChildren(h("div", "sm-noau", "NO ORIGINAL AUDIO YET")); return; }
        const B = A.box = laneBox(["mix"], ["FULL MIX"]);
        if (pk) B.ln.mix.append(waveSvg(pk));
        A.clip = { p: src.f, s: src.s, d: src.d, ch: whole ? null : 0, on: (t) => { B.ph.classList.add("on"); B.mark(t / src.d); }, off: () => { B.ph.classList.remove("on"); }, miss: () => { tagA.textContent = "CLIP MISSING"; tagA.style.display = ""; } };
        if (whole) A.clip.ch = undefined;
        tA.textContent = "0:00 / " + mmss(src.d);
        B.scroll.onclick = (ev) => playA(B.at(ev) * src.d);
        bodyA.replaceChildren(B.el);
      }

      // ---- right: the MIDI
      const M = { cur: null, want: 0 }, HK = { before: null, after: null };
      const pbM = h("button", "sm-pb mid", PLAY); pbM.type = "button"; pbM.title = "Play the MIDI";
      const vt = h("div", "sm-vt"), b1 = h("button", "", "V1"), b2 = h("button", "on", "V2"); b1.type = b2.type = "button";
      b1.title = o ? "The earlier notes of this song" : "No earlier version of this song"; b2.title = "The notes worked out from the song itself"; b1.disabled = !o;
      vt.append(b1, b2);
      const tagM = h("span", "sm-tag au", "FROM AUDIO"), tagM2 = h("span", "sm-tag", "");
      const tM = sideM._time = h("span", "sm-time mid", "0:00"); tM.title = "Press to write this time into the comment";
      const shM = h("div", "sm-sh"); shM.append(pbM, vt, tagM, tagM2);
      const ab = h("div", "sm-ab");
      if (x.mix) { const e = h("span", "", "REMAKE"); e.title = "Play the remake of the chorus"; e.onclick = () => playRef(api, x, e, null, null, { p: x.mix.f, s: x.mix.s, d: x.mix.d, ch: 1 }); ab.append(e); }
      if (x.hq) { const e = h("span", "", "HQ"); e.title = "Play the whole loop with the clean sounds"; e.onclick = () => playRef(api, x, e, null, null, { p: x.hq.f, s: x.hq.s, d: x.hq.d }); ab.append(e); }
      if (ab.children.length) shM.append(ab);
      if (!LAB_OFF && !PATCH_OFF && x.patch && x.patch.length) {   // the sound lab: MIDI editor + this song's TOY MACHINE sounds
        const vb = h("button", "sm-lbtn vst", "VST"); vb.type = "button"; vb.title = "Open this song's sounds and notes to work on them";
        vb.onclick = () => openLab(x, { row, hooks: HK, play: (f) => playM(f), stopMine: () => { if (mine()) stop(); }, redraw: () => { if (ver === "v2" && !FULL) drawM(); }, showChorus: () => { if (FULL) setFull(false); if (ver !== "v2") { ver = "v2"; drawM(); } } }, vb);
        shM.append(vb);
      }
      shM.append(tM);
      const bodyM = h("div");
      const playM = (from) => {
        const c = M.cur; if (!c) return;
        const me = ++M.want, run = (sy) => { sideM.classList.remove("wait"); if (me !== M.want) return; if (HK.before) HK.before(); c.s._after = HK.after ? (e) => { if (HK.after) HK.after(e); } : null; play(api, c.s, Q, bpmOf(c.of), sideM, c.r, c.cs, from, c.beats, sy); };
        if (c.of !== x || PATCH_OFF || !x.patch) { run(null); return; }
        if (x._sy) { run(x._sy); return; }
        stop(); stopRef(); sideM.classList.add("wait");
        synthsFor(api, x).catch(() => null).then(run);
      };
      const cmM = cmBox(noteId(x), "COMMENT \u00b7 MIDI", (sec) => playM(sec));
      const mine = () => playing && playing.card === sideM;
      pbM.onclick = () => { if (mine()) { stop(); return; } const c = M.cur; let from = 0; if (c && c.full) from = Math.floor(c.box.scroll.scrollLeft / c.box.scroll.scrollWidth * c.beats / 4 + 0.05) * 4 * 60 / bpmOf(c.of); playM(from); };
      tM.onclick = () => cmM._stamp(mine() ? playing.pos() : 0);
      sideM.append(shM, bodyM, cmM);
      async function drawM() {
        if (mine()) stop();
        const of = ver === "v1" && o ? o : x, my = ++M.want;
        b1.classList.toggle("on", of === o); b2.classList.toggle("on", of === x);
        tagM.className = "sm-tag " + (of === x ? "au" : "net"); tagM.textContent = of === x ? "FROM AUDIO" : "FROM INTERNET \u00b7 " + srcName(of.src);
        let notes = of.notes, bars = 8, full = false, at = 0;
        tagM2.textContent = ""; tagM2.style.display = "none";
        if (FULL) {
          let F = null;
          if (of.full && !FULL_OFF) { sideM.classList.add("wait"); try { F = (await fullData()).songs[of.full]; } catch (e) { F = null; } sideM.classList.remove("wait"); if (my !== M.want) return; }
          if (F && F.n && F.n.length) { notes = F.n; bars = F.bars; full = true; at = F.at || 0; }
          else { tagM2.textContent = "CHORUS ONLY"; tagM2.style.display = ""; }
        }
        const s = { notes, tracks: of.tracks, src: of.src, song: of.song };
        if (of.src !== "stems" && !full) { s._roles = roles(of); }
        s._lay = layersOf(s);
        const bad = of === x && x.bad ? x.bad : {};
        const have = LAYS.filter((k) => s._lay.includes(k) || bad[k]), topline = of.src === "stems" && of.tracks.some((t) => /topline/i.test(t.name));
        const name = (k) => (k === "vocals" ? "VOCAL MELODY" : k === "melody" ? "MELODY" : k === "arp" ? (have.includes("chords") ? "ADD CHORDS" : "ARP CHORDS") : k === "chords" ? (topline ? "CHORDS + TOPLINE" : "CHORDS") : "BASS");
        const B = laneBox(have, have.map(name), bad), rects = [], SL = slides(s), beats = bars * 4;
        for (const k of have) B.ln[k].append(noteSvg(s, s._lay.map((q, i) => (q === k ? i : -1)).filter((i) => i >= 0), bars, SL, rects));
        s._on = B.on;
        B.change = () => { if (playing && playing.song === s && playing.parts) for (const k of LAYS) playing.parts[k].gain.setTargetAtTime(B.on(k) ? 1 : 0, playing.a.currentTime, 0.015); };
        let cs = [];
        if (full) B.inner.style.width = (bars / 8 * 100) + "%";
        else { const ch = h("div", "sm-ch"); cs = of.chords.map((k) => h("span", "", esc(k || "\u00b7"))); cs.forEach((e) => ch.append(e)); B.inner.append(ch); }
        const r = { rects, W: 100, x: (beat) => 100 * beat / beats + 1, ph: { setAttribute: (k, v) => { B.ph.style.left = v + "%"; } }, box: full ? B.scroll : null };
        M.cur = { s, of, r, cs, beats, full, box: B };
        B.scroll.onclick = (ev) => playM(Math.floor(B.at(ev) * beats / 4) * 4 * 60 / bpmOf(of));
        tM.textContent = "0:00 / " + mmss(beats * 60 / bpmOf(of));
        bodyM.replaceChildren(B.el);
        if (full) requestAnimationFrame(() => { B.scroll.scrollLeft = Math.max(0, at / beats * B.scroll.scrollWidth - 4); });
      }
      b1.onclick = () => { if (ver !== "v1" && o) { ver = "v1"; drawM(); } };
      b2.onclick = () => { if (ver !== "v2") { ver = "v2"; drawM(); } };
      const setFull = (v) => { if (FULL === v) return; FULL = v; bC.classList.toggle("on", !v); bF.classList.toggle("on", v); drawA(); drawM(); };
      bC.onclick = () => setFull(false); bF.onclick = () => setFull(true);
      drawA(); drawM();
      return row;
    }
    let shown = 0;
    function draw() {
      stop(); stopRef();
      const qq = q.value.trim().toLowerCase();
      grid.replaceChildren();
      const list = S.filter((x) => (who === "all" || inGrp(x, who)) && (src === "all" || x.src === src || (src === "insta" && x.insta)) && (!qq || [x.song, x.artist, x.feat, x.key, x.bpm, srcName(x.src), NOTES[noteId(x)], ...x.tags, ...x.chords].join(" ").toLowerCase().includes(qq)));
      shown = 0;
      const more = () => { for (const x of list.slice(shown, shown + 36)) grid.insertBefore(!ROWS_OLD && x.src === "stems" ? rowCard(x) : card(x), btn); shown += 36; btn.hidden = shown >= list.length; btn.textContent = `SHOW MORE \u00b7 ${list.length - shown} LEFT`; };
      const btn = h("button", "chip"); btn.type = "button"; btn.style.gridColumn = "1 / -1"; btn.onclick = more;
      grid.append(btn); more();
      if (!list.length) grid.append(h("div", "art-empty", "No song matches that."));
    }
    q.oninput = draw; draw();
    pane.append(s);

    // 4. where the notes came from
    s = slide("s-sage", "Trust", "Where the notes came from");
    s.append(title("h2", "How much to trust each card.", "Exact MIDI is the real thing. Video and tab are close. Sketches are chords only."));
    s.append(rank(Object.entries(SRC).concat(ST.none ? [["none", NONE]] : []).map(([k, v]) => ({ label: v[0] + " \u2014 " + v[1], v: ST[k] || 0, text: String(ST[k] || 0), hi: k === "midi" }))));
    pane.append(s);
  }

  (window.BackendDataTabs = window.BackendDataTabs || []).push({ id: "songs", label: "SONG MIDI", order: 55, render });
})();
