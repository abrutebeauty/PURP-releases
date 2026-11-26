// KILLTOY browser playground: real audio for the demo backend in ui/app.js.
// Loaded only by the playground page (never by the app). It swaps the demo's fake
// transport, waveforms and effects for a real test song played with Web Audio, so the
// UI can be tried and redesigned in a browser. The ui/ files stay exactly as shipped.
// Keep this file ASCII-only, like ui/.
"use strict";

// AIFF / AIFC (Eman's Logic bounces and many Splice packs): Chrome's decoder can't read them, so a dropped
// .aif failed with "Couldn't read ... Try a WAV or MP3" (stress test, 8 Nov). When the browser can't decode a
// file that is an AIFF, read its PCM here (8/16/24/32-bit ints big or little endian, 32/64-bit floats).
// Every decode in the page goes through this (lanes, TOY MACHINE drop zone, KILLDRUM, samples).
// window.KT_AIFF_OFF = true: the browser's decoder only.
(function aiffDecode() {
  const B = window.BaseAudioContext || window.AudioContext;
  if (!B || !B.prototype.decodeAudioData || B.prototype.decodeAudioData.__aiff) return;
  const orig = B.prototype.decodeAudioData;
  const str = (v, o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  const ext80 = (v, o) => { // 80-bit IEEE extended (the sample rate)
    const e = v.getUint16(o) & 0x7fff, hi = v.getUint32(o + 2), lo = v.getUint32(o + 6);
    return (hi * Math.pow(2, -31) + lo * Math.pow(2, -63)) * Math.pow(2, e - 16383);
  };
  function parse(ctx, ab) {
    const v = new DataView(ab);
    if (ab.byteLength < 12 || str(v, 0) !== "FORM" || !/^AIF[FC]$/.test(str(v, 8))) return null;
    let ch = 0, frames = 0, bits = 0, rate = 0, comp = "NONE", data = -1, dataLen = 0;
    for (let o = 12; o + 8 <= ab.byteLength;) {
      const id = str(v, o), len = v.getUint32(o + 4), body = o + 8;
      if (id === "COMM") { ch = v.getInt16(body); frames = v.getUint32(body + 2); bits = v.getInt16(body + 6); rate = ext80(v, body + 8); if (len >= 22) comp = str(v, body + 18); }
      else if (id === "SSND") { data = body + 8 + v.getUint32(body); dataLen = Math.min(len - 8 - v.getUint32(body), ab.byteLength - data); }
      o = body + len + (len & 1);
    }
    if (!ch || !rate || data < 0) return null;
    const c = comp.toLowerCase(), le = c === "sowt", fl = c === "fl32" || c === "fl64";
    if (!(c === "none" || c === "twos" || le || fl)) return null;   // compressed AIFC (ima4, ulaw...): give up
    const bps = fl ? (c === "fl64" ? 8 : 4) : Math.ceil(bits / 8), n = Math.min(frames, Math.floor(dataLen / (bps * ch)));
    if (!n || bps < 1 || bps > 8) return null;
    const out = ctx.createBuffer(ch, n, rate), chans = [];
    for (let k = 0; k < ch; k++) chans.push(out.getChannelData(k));
    const sc = Math.pow(2, bps * 8 - 1);
    for (let i = 0, o = data; i < n; i++) for (let k = 0; k < ch; k++, o += bps) {
      let x;
      if (fl) x = bps === 8 ? v.getFloat64(o, false) : v.getFloat32(o, false);
      else if (bps === 1) x = v.getInt8(o) / sc;
      else if (bps === 2) x = v.getInt16(o, le) / sc;
      else if (bps === 3) { const b0 = v.getUint8(o), b1 = v.getUint8(o + 1), b2 = v.getUint8(o + 2); let u = le ? b0 | (b1 << 8) | (b2 << 16) : (b0 << 16) | (b1 << 8) | b2; if (u & 0x800000) u -= 0x1000000; x = u / sc; }
      else x = v.getInt32(o, le) / sc;
      chans[k][i] = x;
    }
    return out;
  }
  const patched = function (ab, ok, bad) {
    const self = this;
    let copy = null;
    try { if (!window.KT_AIFF_OFF && ab && ab.byteLength >= 12) { const v = new DataView(ab); if (str(v, 0) === "FORM") copy = ab.slice(0); } } catch (e) { /* detached */ }
    const p = orig.call(this, ab).catch((err) => {
      const buf = copy && parse(self, copy);
      if (buf) return buf;
      throw err;
    });
    if (ok || bad) p.then((b) => ok && ok(b), (e) => bad && bad(e));
    return p;
  };
  patched.__aiff = true;
  B.prototype.decodeAudioData = patched;
  window.KT_parseAiff = parse;
})();

window.purpPlayground = function ({ S, handlers, emit, changed, make, id, bar, freshReturns }) {
  const SONG = window.PURP_PLAYGROUND_SONG || {
    name: "Ruski", bpm: 130,
    files: { beat: "audio/beat.mp3", vocals: "audio/vocals.mp3" },
  };
  let ctx = new (window.AudioContext || window.webkitAudioContext)();   // let: WAVE PEEK points the instruments at an offline context for a moment
  const buffers = {};
  // The master: every lane sums into "master", goes through the master's effect cards (wired by
  // wireMaster while playing), its fader (masterOut), then the safety limiter, always last.
  const master = ctx.createGain();
  const masterOut = ctx.createGain();
  master.connect(masterOut);
  const meter = ctx.createAnalyser();
  meter.fftSize = 1024;
  masterOut.connect(meter);
  // A safety limiter at the very end: stems summed without the mix's mastering can go over.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -0.3; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.15;
  // SAFETY BUS (Eman, 11 Nov: "some sounds skip the master limiter"): the metronome, the sound previews and the SAMPLES
  // tab used to go straight to the speakers, so a click (volume up to 300%) or a 0 dB one-shot on top of a song already
  // at -0.3 dB went over 0 and cracked. They now join right before the safety limiter: not moved by the master fader
  // or AUTO, but caught by the limiter and the ceiling like the song. KT2_SAFETY_BUS_OFF = old (straight out).
  const sideBus = ctx.createGain();
  sideBus.connect(limiter);
  const sideOut = (c) => (c && c !== ctx) || window.KT2_SAFETY_BUS_OFF ? (c || ctx).destination : sideBus;
  window.KT_SIDE_OUT = sideOut;
  // MASTER AUTO (Eman, 11 Nov): one more gain between the fader and the limiter. With AUTO on (the KILLTOY 2 top-bar
  // meter turns it on, S.master.auto !== false) it keeps the loudest peaks of the song at about -1 dB going into the
  // limiter: as loud as possible, but the limiter only shaves, so nothing cracks. It turns down fast and comes back
  // up slowly, and holds still while stopped. Off (or KT2_MASTER_AUTO_OFF, or no top-bar meter) = 0 dB, the old path.
  const autoGain = ctx.createGain();
  meter.connect(autoGain);
  autoGain.connect(limiter);
  const MAUTO = { hold: 0.5, db: 0, over: 0, TARGET: -1, MAX: 9, MIN: -18, UP_DB_S: 0.4 };
  const autoOn = () => !!(window.KT2_MASTER_AUTO && !window.KT2_MASTER_AUTO_OFF && S.master && S.master.auto !== false);
  {
    // stereo peaks (an analyser alone mixes L+R down to one): before AUTO (what AUTO listens to) and after it (what the
    // limiter gets: over 0 dB there = MAUTO.over, how much the limiter has to shave, shown as "+x dB OVER")
    const pair = (src) => { const sp = ctx.createChannelSplitter(2); src.connect(sp); return [0, 1].map((ch) => { const a = ctx.createAnalyser(); a.fftSize = 2048; sp.connect(a, ch); return a; }); };
    const pre = pair(meter), post = pair(autoGain), buf = new Float32Array(2048);
    const peakOf = (ans) => { let pk = 0; for (const a of ans) { a.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) { const v = buf[i] < 0 ? -buf[i] : buf[i]; if (v > pk) pk = v; } } return pk; };
    let last = performance.now(), overAt = 0;
    setInterval(() => {
      const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now;
      if (!autoOn() && MAUTO.db !== 0) { MAUTO.db = 0; autoGain.gain.setTargetAtTime(1, ctx.currentTime, 0.05); }
      if (!S.transport.playing) { if (now - overAt > 2500) MAUTO.over = 0; return; }
      const op = peakOf(post), odb = op > 1e-5 ? 20 * Math.log10(op) : -100;
      if (odb > 0.05 && odb >= MAUTO.over) { MAUTO.over = Math.round(odb * 10) / 10; overAt = now; }
      else if (now - overAt > 2500) MAUTO.over = odb > 0.05 ? Math.round(odb * 10) / 10 : 0;
      if (!autoOn()) return;
      const pk = peakOf(pre);
      if (pk > MAUTO.hold) MAUTO.hold = pk;
      else MAUTO.hold = Math.max(0.002, MAUTO.hold * Math.pow(10, -MAUTO.UP_DB_S * dt / 20));
      const want = Math.max(MAUTO.MIN, Math.min(MAUTO.MAX, MAUTO.TARGET - 20 * Math.log10(MAUTO.hold)));
      const down = want < MAUTO.db;
      MAUTO.db = want;
      autoGain.gain.setTargetAtTime(Math.pow(10, want / 20), ctx.currentTime, down ? 0.02 : 0.4);
    }, 40);
  }
  // The compressor lets the first 2 ms of a hard hit through, so a plain ceiling at -0.3 dB
  // catches what it misses (drums and stacked drop-zone sounds went to +0.5 dB without it).
  const ceiling = ctx.createWaveShaper(), CEIL = 0.966, curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.max(-CEIL, Math.min(CEIL, i / 2048 - 1));
  ceiling.curve = curve; ceiling.oversample = "none";
  limiter.connect(ceiling);
  let bounceJob = null; // a quiet bounce for the PROJECTS page (bounceMix)
  const outMeter = ctx.createAnalyser(); // what reaches the speakers (the master strip's meter)
  outMeter.fftSize = 1024;
  ceiling.connect(outMeter);
  outMeter.connect(ctx.destination);
  // the bug recorder under the window (shell.html) records what you hear: the same signal as the speakers
  window.KT_AUDIO_TAP = () => {
    const d = ctx.createMediaStreamDestination();
    ceiling.connect(d);
    return { stream: d.stream, stop: () => { try { ceiling.disconnect(d); } catch (e) { /* gone */ } } };
  };
  const meterBuf = new Float32Array(meter.fftSize);
  // KILLTOY 2 RECORD page: everything that isn't a voice (the PLAYGROUND) sums here first, so the
  // RECORD page can show its waveform and turn it down or mute it while you sing (Eman, 31 Oct).
  const pgIn = ctx.createGain(), pgGain = ctx.createGain();
  pgIn.connect(pgGain); pgGain.connect(master);
  const PG_BUCKET = 0.05;
  const PG = { peaks: [], sig: "", last: -1 };
  const pgTap = ctx.createScriptProcessor(4096, 2, 1), pgHush = ctx.createGain();
  pgHush.gain.value = 0;
  pgIn.connect(pgTap); pgTap.connect(pgHush); pgHush.connect(ctx.destination);
  pgTap.onaudioprocess = (e) => {
    if (!S.transport.playing) return;
    const n = e.inputBuffer.length, sr = ctx.sampleRate;
    const t0 = startPos + (e.playbackTime - startCtx) - n / sr;
    if (t0 + n / sr < startPos - 0.01) return;   // still the silence before playback started
    const L = e.inputBuffer.getChannelData(0), R = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : L;
    // a bucket split across two chunks keeps the louder half (PG.last = the bucket the last chunk ended in)
    const put = (b, pk) => { if (b < 0) return; PG.peaks[b] = b === PG.last ? Math.max(PG.peaks[b] || 0, pk) : pk; PG.last = b; };
    let b = -1, pk = 0;
    for (let i = 0; i < n; i += 4) {
      const bi = Math.floor((t0 + i / sr) / PG_BUCKET);
      if (bi !== b) { put(b, pk); b = bi; pk = 0; }
      const v = Math.max(Math.abs(L[i]), Math.abs(R[i]));
      if (v > pk) pk = v;
    }
    put(b, pk);
  };
  window.purpPlaygroundDebug = { ctx, master, masterOut, autoGain, MAUTO, limiter, outMeter, buffers, S, voices: () => ({ trackGains, clipVoices }), undoDepth: () => [undoStack.length, redoStack.length] }; // for the automated check pass
  // UI SOUNDS IN KEY (Eman, 7 Nov 23:43): every UI sound with a pitch (button notes, coins, the
  // unlock chime, metronome beeps...) is moved to the root of the project key, so it always sits in
  // the song. Each sound moves by less than half an octave, so it keeps its timbre and register.
  // Clicks, noise, random data blips and plain sweeps stay as they were. No key = old pitches.
  // KT2_SFX_KEY_OLD = true puts every sound back on its old pitch.
  window.KT2Key = (function () {
    const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
    const key = () => { if (window.KT2_SFX_KEY_OLD) return null; const k = S.key; return k && k.tonic != null && k.tonic >= 0 ? { pc: k.tonic % 12, minor: !!k.minor } : null; };
    const hzOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
    // the ratio that moves a sound written around refHz onto the key's root (nearest one, -6..+5 semitones)
    const ratio = (refHz) => {
      const k = key(); if (!k || !(refHz > 0)) return 1;
      const m = 69 + 12 * Math.log2(refHz / 440);
      let r = k.pc + 12 * Math.round((m - k.pc) / 12);
      if (r - m >= 6) r -= 12; if (m - r > 6) r += 12;
      return hzOf(r) / refHz;
    };
    // the key's root near refHz plus semitones (the same frequency the sound had when there is no key)
    const root = (refHz, semis) => refHz * ratio(refHz) * Math.pow(2, (semis || 0) / 12);
    // degree i of the scale (or of a list of semitone steps) from the root near refHz, wrapping up octaves
    const degree = (refHz, i, steps) => { const st = steps || (key() && key().minor ? MIN : MAJ), n = st.length; return root(refHz, st[((i % n) + n) % n] + 12 * Math.floor(i / n)); };
    // the nearest root or fifth: for single short beeps that only need to sit in the key
    const snap = (f) => {
      const k = key(); if (!k || !(f > 0)) return f;
      const m = 69 + 12 * Math.log2(f / 440); let best = m, d = 99;
      for (let o = -1; o <= 10; o++) for (const s of [0, 7]) { const c = k.pc + s + 12 * o; if (Math.abs(c - m) < d) { d = Math.abs(c - m); best = c; } }
      return hzOf(best);
    };
    // info(): the project key in one clean shape (ui/keyconvert.js rootOf): { tonic, name, scale, minor, steps, rootMidi }
    const info = () => (window.KeyConvert ? window.KeyConvert.rootOf(S.key) : null);
    return { key, ratio, root, degree, snap, info, on: () => !!key(), minor: () => !!(key() && key().minor) };
  })();
  const freshMaster = () => ({ volume: 0, plugins: [] });
  S.master = S.master || freshMaster();
  // The A/B returns (ui/returns.js): each lane's sends (after its fader) -> the return's input ->
  // its effect cards (wired by wireReturns while playing) -> its fader and mute -> the master.
  const returnsOf = (bpm) => (freshReturns ? freshReturns(bpm) : []);
  if (!S.returns) S.returns = returnsOf(S.bpm);
  const retBus = new Map();   // "returnA" -> { input, out, chain }
  // GROUP / SEND buses (Eman, 11 Nov; KT2_BUS_OFF = only the fixed A/B sends): more returns, returnC..returnZ,
  // made with newBus. A bus with mode "group" takes the whole sound of the lanes that are in it (instead of the
  // master), one fader + effects for all of them; mode "send" (or none: A and B) is a return: a copy at each
  // lane's own amount, added on top. Membership is the lane's sends[letter] (> 0 = in it), so flipping the
  // switch keeps who's in it and never touches the bus's effects.
  function ensureBus(rid) {
    let b = retBus.get(rid);
    if (!b) { const input = ctx.createGain(), out = ctx.createGain(); input.connect(out); out.connect(master); b = { input, out, chain: [], to: master }; retBus.set(rid, b); }
    return b;
  }
  for (const rid of ["returnA", "returnB"]) ensureBus(rid);
  const busLetter = (rid) => String(rid).slice(6);
  const busIsGroup = (r) => r && r.mode === "group" && !window.KT2_BUS_OFF;
  window.purpPlaygroundDebug.returns = retBus;

  // ---------------------------------------------------------------------------
  // The test session: the beat plus lead, double and adlib clips cut from the vocal.
  const B = (n) => n * bar;
  const clip = (name, src, startBar, bars, extra = {}) => ({
    id: id(), name, src, start: B(startBar), length: B(bars), offset: B(startBar), take: 0, takes: 0, plugins: [], ...extra,
  });
  const lane = (name, role, clips, armed = false) => ({ id: id(), name, kind: "take", role, armed, muted: false, solo: false, clips });
  const SONG_BARS = 116;
  function buildRuski() {
    S.session = SONG.name;
    S.master = freshMaster();
    S.returns = returnsOf(SONG.bpm);
    S.bpm = SONG.bpm;
    S.key = { name: "D#m", relative: "F#", confidence: 0.8, tonic: 3, minor: true, bpmFound: SONG.bpm };
    S.sections = [
      { name: "INTRO", start: 0 }, { name: "VERSE 1", start: B(20) }, { name: "HOOK", start: B(36) },
      { name: "BREAK", start: B(46) }, { name: "VERSE 2", start: B(50) }, { name: "BRIDGE", start: B(68) },
      { name: "HOOK", start: B(76) }, { name: "OUTRO", start: B(86) },
    ];
    const lead = [
      clip("Lead intro", "vocals", 0, 20), clip("Lead verse 1", "vocals", 20, 16, { plugins: [make("DeEss"), make("Compressor"), make("EQ")] }),
      clip("Lead hook", "vocals", 36, 10, { take: 2, takes: 4,
        takeSrc: [{ src: "vocals", offset: B(76), gain: 0.9 }, { src: "vocals", offset: B(36), gain: 0.7 },
                  { src: "vocals", offset: B(36), gain: 1 }, { src: "vocals", offset: B(76), gain: 1.1 }], plugins: [make("EQ"), make("Compressor"), make("Delay"), make("Reverb")] }),
      clip("Lead verse 2", "vocals", 50, 18), clip("Lead bridge", "vocals", 68, 8), clip("Lead hook 2", "vocals", 76, 10),
      clip("Lead outro", "vocals", 86, 29.5),
    ];
    const dbl = [
      clip("Dbl hook", "vocals", 36, 10, { delay: 0.022, pan: -0.7, level: 0.55 }),
      clip("Dbl hook 2", "vocals", 76, 10, { delay: 0.022, pan: -0.7, level: 0.55 }),
    ];
    const adl = [
      clip("Throw", "vocals", 44, 2, { pan: 0.5, level: 0.6, plugins: [make("Drive"), make("Delay")] }),
      clip("Throw 2", "vocals", 84, 2, { pan: 0.5, level: 0.6, plugins: [make("Drive"), make("Delay")] }),
    ];
    S.tracks = [
      { id: "t0", name: "Beat", kind: "beat", role: "beat", armed: false, muted: false, solo: false,
        clips: [{ id: "c0", name: SONG.name + "_" + SONG.bpm + "bpm_D#m", src: "beat", start: 0, length: B(SONG_BARS), offset: 0, take: 0, takes: 0, plugins: [] }] },
      lane("Lead Vox", "lead", lead, true), lane("Double", "double", dbl), lane("Adlibs", "adlib", adl), lane("Harmony", "harmony", []),
    ];
    const yours = { kind: "original", name: "Your Ruski vocal", note: "From your OCT 17 RUSKI stems" };
    const live = "The effects on these clips are live: click a clip to see and change them.";
    S.tracks[0].source = { summary: "Your own Ruski beat, the test song of this playground.", parts: [{ kind: "original", name: "Ruski beat", note: "From your OCT 17 RUSKI stems (130 BPM, D#m)" }] };
    S.tracks[1].source = { summary: "Your Ruski vocal, cut into clips by section. The hook has 4 takes to comp.", parts: [yours], fx: [live] };
    S.tracks[2].source = { summary: "A double of the hook: the same vocal, 22 ms later, panned left.", parts: [yours], fx: ["22 ms delay", "Panned left", "-5 dB"] };
    S.tracks[3].source = { summary: "Two throws from your vocal at the ends of the hooks.", parts: [yours], fx: [live] };
    S.loopStart = B(36);
    S.loopEnd = B(46);
    S.transport = { position: 0, playing: false, recording: false, looping: false, input: -100 };
    S.playStart = 0;
    S.versions = [{ number: 1, current: true }];
  }
  // Record (R) starts off when a project opens. Only a lane left armed in that project last
  // time comes back armed (remembered per project in this browser).
  let armMemory = {};
  try { armMemory = JSON.parse(localStorage.getItem("ktArmed") || "{}") || {}; } catch (e) {}
  const armKey = () => (curSong && (curSong.group || curSong.name)) || SONG.name;
  function applyArm() {
    const name = armMemory[armKey()];
    // Deep debug 16 Nov: two lanes with the same name both came back armed after opening a project (only one lane
    // may record). The one that was armed when it was saved wins, else the first with that name.
    // window.KT2_ARM_NAME_OLD = true: every lane with the name, as before.
    if (window.KT2_ARM_NAME_OLD || !name) { S.tracks.forEach((t) => (t.armed = !!name && t.name === name)); return; }
    const same = S.tracks.filter((t) => t.name === name), one = same.find((t) => t.armed) || same[0];
    S.tracks.forEach((t) => (t.armed = t === one));
  }
  function rememberArm() {
    const t = S.tracks.find((x) => x.armed);
    if (t) armMemory[armKey()] = t.name; else delete armMemory[armKey()];
    try { localStorage.setItem("ktArmed", JSON.stringify(armMemory)); } catch (e) {}
  }
  buildRuski();
  S.ai.installed = true; // the AI tools are simulated here, so nothing to install

  // Your look (background, overlay, blur, grain) and count-in stay in this browser, so
  // they survive reloads and new playground versions, like settings.json in the app.
  const KEEP = "killtoy.playground.settings";
  try {
    const kept = JSON.parse(localStorage.getItem(KEEP) || "{}");
    if (kept.look) S.look.look = kept.look;
    if (kept.countIn != null) S.countIn = kept.countIn;
    if (kept.clickSound) S.clickSound = kept.clickSound;
    if (kept.clickPattern) S.clickPattern = kept.clickPattern;
    if (kept.clickVol != null) S.clickVol = kept.clickVol;
  } catch (e) { /* storage blocked: start fresh */ }
  const keepSettings = () => {
    try { localStorage.setItem(KEEP, JSON.stringify({ look: S.look.look, countIn: S.countIn, clickSound: S.clickSound, clickPattern: S.clickPattern, clickVol: S.clickVol })); } catch (e) { /* ignore */ }
  };
  for (const name of ["setLook", "setCountIn"]) {
    const orig = handlers[name];
    handlers[name] = (args) => { const r = orig(args); keepSettings(); return r; };
  }

  // One download per file, shared by everyone waiting for it. Opening another song stops the
  // downloads it doesn't need (stopLoads), and a file that lands while the song plays joins in
  // at once (lateStart), so play never waits for the whole song.
  // At most 3 downloads at a time, most wanted first (prio: lower comes sooner), so the first
  // lanes are heard in a second or two instead of everything arriving together at the end.
  const pending = {}, stoppers = {}, waiting = [];
  let active = 0;
  const slot = (prio, signal) => new Promise((go, fail) => {
    const w = { prio, go: () => { active++; go(); } };
    signal.addEventListener("abort", () => { const i = waiting.indexOf(w); if (i >= 0) { waiting.splice(i, 1); fail(new DOMException("stopped", "AbortError")); } });
    if (active < 3) w.go(); else { waiting.push(w); waiting.sort((a, b) => a.prio - b.prio); }
  });
  const freeSlot = () => { active--; const w = waiting.shift(); if (w) w.go(); };
  const fetchAudio = (k, url, prio = 5) => {
    if (buffers[k]) return Promise.resolve(buffers[k]);
    if (pending[k]) return pending[k];
    const stop = (stoppers[k] = new AbortController());
    const p = (pending[k] = slot(prio, stop.signal).then(() => fetch(url, { signal: stop.signal })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url + ": " + r.status))))
      .finally(freeSlot))
      .then((d) => ctx.decodeAudioData(d))
      .then((b) => { if (pending[k] === p) { delete pending[k]; delete stoppers[k]; } buffers[k] = b; lateStart(k); return b; },
            (e) => { if (pending[k] === p) { delete pending[k]; delete stoppers[k]; } throw e; }));
    return p;
  };
  const stopLoads = (keep) => {
    for (const k of Object.keys(pending)) if (!keep.has(k)) { stoppers[k].abort(); delete pending[k]; delete stoppers[k]; }
  };
  // "Loading sounds 3 of 8" in the jobs corner while a song's audio comes in. Never fails the
  // song: a file that can't load just stays silent (and says so in the console).
  function loadingCard(list) {
    const left = list.filter((x) => x instanceof Promise);
    if (!left.length) return Promise.resolve();
    const j = { id: id(), label: "Loading sounds", stage: `0 of ${left.length}`, progress: 0, finished: false, failed: false, message: "", loading: true };
    let done = 0;
    S.jobs = S.jobs.filter((x) => !x.loading).concat(j);
    changed();
    return Promise.all(left.map((p) => p.catch((e) => { if (e.name !== "AbortError") console.error("Song audio failed to load", e); })
      .then(() => { done++; j.progress = done / left.length; j.stage = `${done} of ${left.length}`; changed(); })))
      .then(() => { S.jobs = S.jobs.filter((x) => x !== j); changed(); });
  }
  const loadRuski = () => Promise.all(Object.entries(SONG.files).map(([k, url]) => fetchAudio(k, url))).then(() => {
    const beat = S.tracks[0].clips[0];
    beat.length = buffers.beat.duration;
    changed();
  }).catch((e) => console.error("Playground audio failed to load", e));
  let loaded = null; // set below, once we know which song opens first
  let curSong = null; // the song (version) that is open, for loading its muted lanes later
  applyArm();

  // More songs for the session menu (scripts/playground.sh PG_SONGS): audio/songs/<slug>/
  // has session.json and one mp3 per file. Lanes that are already inside the beat
  // (drums, bass, keys, fx) start muted, and their audio loads when you unmute or solo one.
  const SONGS = [{ name: SONG.name, build: buildRuski, load: loadRuski }];
  const GROUPS = new Map(); // group name -> its songs, in index.json order
  let META = { versions: {}, projects: [] }; // versions made with "+" and projects made here (see Saving, below)
  const SESSION_JSON = {};
  // Every song file's buffer key. A decoded 3-minute stereo stem is ~60 MB, so going through a
  // few projects used to pile up gigabytes; opening a song lets go of the other songs' audio.
  const SONG_FILES = new Set(Object.keys(SONG.files));
  function forgetOtherSongs(song) {
    const keep = new Set(song.files ? song.files.map((f) => f.key) : Object.keys(SONG.files));
    for (const k of Object.keys(buffers)) if (SONG_FILES.has(k) && !keep.has(k) && !pending[k]) delete buffers[k];
  }  // song folder -> its session.json (a lane's "clipsFrom" reads another version's notes)
  const slug = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function keyFrom(text) {
    const m = /^([A-G])([#b]?)\s*(major|maj|minor|min|m)?\b/i.exec(String(text || "").trim());
    if (!m) return { name: "?", relative: "", confidence: 0, tonic: null, minor: false };
    const flats = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
    const root = flats[m[1].toUpperCase() + m[2]] || m[1].toUpperCase() + m[2];
    const tonic = NOTES.indexOf(root), minor = /^m(in)?/i.test(m[3] || "") && !/^maj/i.test(m[3] || "");
    const rel = NOTES[(tonic + (minor ? 3 : 9)) % 12] + (minor ? "" : "m");
    return { name: root + (minor ? "m" : ""), relative: rel, confidence: 0.9, tonic, minor };
  }
  // Effects a lane starts with, switched ON, as cards in the bottom strip. A lane in
  // session.json can list them ("fx": [{ "name": "Drive", "knobs": { "drive": 0.4 } }]):
  // a sound Claude makes arrives dry plus its shaping effects as cards, so they can be
  // turned off or swapped. MIX_FX adds ones the mix needs to match its reference.
  const MIX_FX = [
    // u wanna (V9, and V10 which reuses its sounds): the rebuilt square lead measured
    // more dynamic (loudness range 15.9 vs 11.0 dB) and far darker (4 kHz+ vs mids
    // -31.6 vs -14.7 dB) than the lead in the original, which is OTT'd hard.
    { song: /u wanna/i, lane: /^lead\b(?!\s*vo)/i, fx: [{ name: "Squash", knobs: { depth: 0.45, time: 0.35 },
      why: "On because the original's lead is squashed bright (OTT); ours measured darker and less even." }] },
  ];
  function startFx(j, l) {
    const m = MIX_FX.find((x) => x.song.test(j.name) && x.lane.test(l.name));
    return (l.fx || (m && m.fx) || []).map((f) => {
      const p = make(f.name);
      for (const [pid, v] of Object.entries(f.knobs || {})) {
        const q = p.params.find((x) => x.id === pid);
        if (q) { q.value = v; q.text = knobText(p, pid, v) || q.text; }
      }
      if (f.why) p.why = f.why;
      return p;
    });
  }
  // Effect cards from session.json: [{ type, name, enabled, params: { id: knob 0..1 }, why }].
  // A known effect starts from its own knobs (names, readouts), then takes the saved values.
  function fxFromJson(list) {
    return (Array.isArray(list) ? list : []).filter((e) => e && (e.name || e.type)).map((e) => {
      let p = make(e.name || e.type);
      if (e.type && p.type !== e.type) p = { id: p.id, name: e.name || e.type, type: e.type, enabled: true, params: [] };
      p.enabled = e.enabled !== false;
      for (const [pid, v] of Object.entries(e.params || {})) {
        let q = p.params.find((x) => x.id === pid);
        if (!q) p.params.push((q = { id: pid, name: pid, value: 0 }));
        q.value = Math.max(0, Math.min(1, Number(v) || 0));
        q.text = knobText(p, pid, q.value) || q.text;
      }
      if (e.why) p.why = e.why;
      return p;
    });
  }
  // session.json "master": { volume_db, effects: [...] } (the safety limiter is always added last).
  // session.json "returns": [{ id: "returnA", name, volume_db, muted, effects }] (missing = the two fresh ones).
  const returnsFromJson = (rs, bpm) => {
    const one = (r, x) => ({ ...r, name: x.name || r.name, volume: Math.max(-60, Math.min(6, Number(x.volume_db) || 0)), muted: !!x.muted, plugins: fxFromJson(x.effects), ...(x.mode === "group" || x.mode === "send" ? { mode: x.mode } : {}) });
    const base = returnsOf(bpm).map((r) => { const x = (rs || []).find((q) => q.id === r.id); return x ? one(r, x) : r; });
    const more = (rs || []).filter((x) => /^return[C-Z]$/.test(x.id || "") && !base.some((r) => r.id === x.id)).map((x) => one({ id: x.id, name: x.id, volume: 0, muted: false, plugins: [] }, x));
    return [...base, ...more];
  };
  const masterFromJson = (m) => ({ volume: Math.max(-60, Math.min(6, Number(m && (m.volume_db != null ? m.volume_db : m.volume)) || 0)),
    plugins: fxFromJson(m && m.effects), ...(m && m.auto === false ? { auto: false } : {}) });

  // ---------------------------------------------------------------------------
  // Projects (the home page): every song or group of versions is one project. A song's
  // session.json can carry "about" and "image"; PROJECT_INFO fills in the ones made
  // before that. MAKING lists projects another Claude thread builds: until "done" they show
  // as a banner that can't open yet, and turn real once a song with that name or group
  // is in audio/songs/.
  const PROJECT_RENAMES = { Lowkey: "Z-Duo" }; // Eman renamed Lowkey to Z-Duo (26 Oct)
  const PROJECT_INFO = {
    "Z-Duo": { about: "Reyn's Lowkey vocal, remade ten ways, from Fred again to liquid DnB and the u wanna sound.", image: "bg/KT_UP_05.jpg" },
    Ruski: { about: "Your Ruski beat and vocal. The test song KILLTOY was built on.", image: "bg/KT_UP_04.jpg", worked: "2026-10-25T12:00:00Z" },
    "LUCIF\u00d6R": { about: "Eman's LUCIF\u00d6R rebuilt part by part: the original vocal, a new harmony layer, Splice drums on the original hits, every synth as editable MIDI.",
                    image: "bg/KT_UP_12.jpg", line: "140 BPM \u00b7 A minor \u00b7 remake V13 + new harmony layer" },
    "888GENESIS": { about: "Eman's 888GENESIS rebuilt layer by layer: every sound on its own lane, the synths as editable MIDI.", image: "bg/KT_UP_07.jpg" },
    "2 Ahead": { about: "A full remake of 2 AHEAD, every sound on its own lane, ready to edit.", image: "bg/KT_UP_11.jpg" },
  };
  const MAKING = [{ name: "2 Ahead", since: "2026-10-26T02:27:00Z", done: "2026-10-26T03:24:00Z" },
                  { name: "888GENESIS", since: "2026-10-26T04:30:00Z", done: "2026-10-26T05:45:00Z" },
                  { name: "LUCIF\u00d6R", since: "2026-10-26T05:00:00Z", done: "2026-10-26T06:12:00Z" }];
  let worked = {};
  try { worked = JSON.parse(localStorage.getItem("ktWorked") || "{}") || {}; } catch (e) {}
  const markWorked = (name) => { worked[name] = new Date().toISOString(); try { localStorage.setItem("ktWorked", JSON.stringify(worked)); } catch (e) {} };
  const hookOf = (sections, br) => {
    const h = (sections || []).find((x) => /hook|drop|chorus/i.test(x.name));
    return h ? (h.start != null ? h.start : h.startBar * br) : null;
  };
  // What a project plays when its banner is held: the newest version's full mix, from the hook.
  function previewOf(entry) {
    if (entry.made) return { urls: [], start: 0 };
    if (entry.build === buildRuski) {
      const br = (60 / SONG.bpm) * 4;
      return { urls: Object.values(SONG.files), start: 36 * br };
    }
    const members = entry.group ? GROUPS.get(entry.group) : [entry];
    const newest = [...members].reverse().find((m) => m.json.preview) || members[members.length - 1], j = newest.json, br = (60 / (j.bpm || 120)) * 4;
    // session.json "preview": a full mix of the remake (when "reference" is the original song)
    const url = j.preview ? newest.urlOf(j.preview) : newest.files[0].url; // files[0] = the reference
    return { urls: [url], start: hookOf(j.sections, br) || 0 };
  }
  function projectOf(entry) {
    const mine = META.versions[entry.name] || [];
    if (entry.build === buildRuski) {
      return { name: SONG.name, versions: 1 + mine.length, lanes: 4, bpm: SONG.bpm, key: "D#m", length: SONG_BARS * (60 / SONG.bpm) * 4,
               versionList: [{ label: "V1", urls: Object.values(SONG.files) }], laneNames: Object.keys(SONG.files), fileCount: Object.keys(SONG.files).length };
    }
    if (entry.made) { const cur = S.session === entry.name, mm = META.projects.find((x) => x.name === entry.name) || {};
      return { name: entry.name, made: true, versions: 1 + mine.length, lanes: cur ? S.tracks.length : 2, bpm: cur ? S.bpm : 120, key: cur && S.key ? S.key.name || "" : "", length: 0,
               about: "Your own project, kept in this browser.", created: mm.made || null, versionList: [],
               sections: cur ? (S.sections || []).map((x) => ({ name: x.name, t: x.start || 0, color: x.color || null })) : [],
               laneNames: cur ? S.tracks.map((t) => [t.name, t.role, t.instrument].filter(Boolean).join(" ")) : [] }; }
    const members = entry.group ? GROUPS.get(entry.group) : [entry];
    const newest = members[members.length - 1], j = newest.json;
    const about = members.map((m) => m.json.about).filter(Boolean).pop(), image = members.map((m) => m.json.image).filter(Boolean).pop();
    // for the KILLTOY 2 projects page: every version's mix, the parts, the lane names (search + waveform)
    const br = (60 / (j.bpm || 120)) * 4;
    const mixOf = (m) => (m.json.preview ? m.urlOf(m.json.preview) : m.files[0] && m.files[0].url);
    const versionList = members.map((m, i) => ({ label: m.label || "V" + (i + 1), urls: [mixOf(m)].filter(Boolean) }));
    const sections = (j.sections || []).map((x) => ({ name: x.name, t: x.start != null ? x.start : (x.startBar || 0) * br, color: x.color || null }));
    const laneNames = [...new Set(members.flatMap((m) => (m.json.lanes || []).map((l) => [l.name, l.role, l.instrument, l.preset].filter(Boolean).join(" "))))];
    return { name: entry.name, versions: members.length + mine.length, lanes: (j.lanes || []).length + 1, bpm: j.bpm, key: keyFrom(j.key).name,
             length: (j.lengthBars || 100) * (60 / (j.bpm || 120)) * 4, about, image,
             tag: members.length > 1 ? "Newest: " + newest.label : "", remake: members.some((m) => m.json.remake),
             versionList, sections, laneNames, fileCount: (newest.files || []).length, words: members.map((m) => m.json.lyrics || m.json.transcript || "").filter(Boolean).join(" ") };
  }
  function updateProjects() {
    const real = SONGS.map((x) => {
      const p = projectOf(x), info = PROJECT_INFO[p.name] || {};
      const was = MAKING.find((m) => m.name === p.name); // just finished: NEW until it's opened
      return { ...p, about: info.about || p.about, image: p.image || info.image || "bg/KT_UP_0" + (1 + (p.name.length % 9)) + ".jpg",
               line: info.line, worked: worked[p.name] || info.worked || (was && was.done) || "2026-10-26T01:50:00Z", isNew: !!was && !worked[p.name] };
    });
    const making = MAKING.filter((m) => !m.done && !SONGS.some((x) => x.name === m.name)).map((m) => ({
      name: m.name, making: true, about: (PROJECT_INFO[m.name] || {}).about, image: (PROJECT_INFO[m.name] || {}).image, worked: m.since }));
    // quest songs live in their quest (QUESTS tab), not in ALL PROJECTS (Eman, 7 Nov); KT2_QUEST_IN_PROJECTS = old
    const questSong = (nm) => !window.KT2_QUEST_IN_PROJECTS && META.projects.some((m) => m.name === nm && m.quest != null);
    S.projects = [...making, ...real.filter((x) => !questSong(x.name)).sort((a, b) => Date.parse(b.worked) - Date.parse(a.worked))];
  }

  // Hold-to-listen on the home page: plain <audio> elements, so it starts at once without
  // decoding the whole song first.
  let preview = null;
  function stopPreviewAudio() {
    if (!preview) return;
    const els = preview.els;
    preview = null;
    const t0 = performance.now();
    const fade = () => {
      const k = Math.max(0, 1 - (performance.now() - t0) / 120);
      els.forEach((a) => (a.volume = k * 0.9));
      if (k > 0) requestAnimationFrame(fade); else els.forEach((a) => { a.pause(); a.src = ""; });
    };
    fade();
  }
  handlers.previewProject = ({ name, on }) => {
    stopPreviewAudio();
    if (!on) return { ok: true };
    const entry = SONGS.find((x) => x.name === name);
    if (!entry) return { error: `${name} isn't ready to play yet.` };
    if (S.transport.playing) halt();
    const pv = previewOf(entry);
    if (!pv.urls.length) return { error: `${name} has no sound to play yet.` };
    const me = { els: pv.urls.map((u) => new Audio(u)) };
    preview = me;
    return Promise.all(me.els.map((a) => new Promise((res) => {
      a.preload = "auto"; a.volume = 0;
      a.addEventListener("loadedmetadata", () => { a.currentTime = Math.min(pv.start, Math.max(0, a.duration - 20)); res(a.duration); }, { once: true });
      a.addEventListener("error", () => res(0), { once: true });
    }))).then((durs) => {
      if (preview !== me) return { ok: true };
      const t0 = performance.now();
      me.els.forEach((a) => a.play().catch(() => {}));
      const fadeIn = () => { if (preview !== me) return; const k = Math.min(1, (performance.now() - t0) / 150); me.els.forEach((a) => (a.volume = k * 0.9)); if (k < 1) requestAnimationFrame(fadeIn); };
      fadeIn();
      return { ok: true, duration: Math.max(1, Math.max(...durs) - me.els[0].currentTime) };
    });
  };
  handlers.newSession = () => ({ warning: "New projects are made by asking Claude in chat for now (like 2 Ahead). In the app this starts an empty one." });

  function songFromJson(dir, j, into) { // into: fill this song object (a head turning into its full song)
    // A song made only of stems (no "reference"): its preview mix sits on the Beat lane, muted,
    // so the stems are what you hear and the timeline still has its full-song picture.
    if (!j.reference && j.preview) j = { ...j, reference: j.preview, referenceMuted: true };
    // "../<other version folder>/audio/x.mp3" points at a file another version of the song already
    // holds, so versions share the vocal and the reference instead of each carrying a copy.
    const dirOf = (file) => { const m = /^\.\.\/([^/]+)\//.exec(file); return m ? slug(m[1]) : dir; };
    const urlOf = (file) => `audio/songs/${dirOf(file)}/${slug(file.split("/").pop().replace(/\.[^.]+$/, ""))}.mp3`;
    const keyOf = (file) => dirOf(file) + "/" + slug(file.split("/").pop().replace(/\.[^.]+$/, ""));
    const inBeat = (l) => /drum|bass|piano|string|keys|synth|pad|fx|texture|perc|music/i.test(l.name) && !/vox|vocal|chop/i.test(l.name);
    const isMuted = (l) => (l.muted != null ? !!l.muted : inBeat(l)); // session.json can say "muted"
    const group = j.group ? PROJECT_RENAMES[j.group] || j.group : null;
    const song = Object.assign(into || {}, { name: j.name, json: j, group, label: j.label || j.name, open: !!j.open, urlOf });
    song.build = () => {
      const bpm = j.bpm || 120, br = (60 / bpm) * 4, len = (j.lengthBars || 100) * br;
      const key = keyFrom(j.key);
      S.session = song.group || j.name;
      S.master = masterFromJson(j.master);
      S.returns = returnsFromJson(j.returns, bpm);
      if (j.master && j.master.automation && window.KillToyAuto) { S.master.automation = window.KillToyAuto.fromJson(j.master.automation, S.master, 60 / bpm, id); S.master.autoOpen = !!j.master.automationOpen; }
      S.bpm = bpm;
      S.key = { ...key, bpmFound: bpm };
      S.sections = (j.sections || []).map((x) => ({ name: x.name, start: x.start != null ? x.start : x.startBar * br }));
      // "referenceMuted": the stems play and the full mix waits muted, so what you hear
      // matches the M buttons (the mix already holds every stem).
      const refMuted = !!j.referenceMuted;
      S.tracks = [{ id: id(), name: "Beat", kind: "beat", role: "beat", armed: false, muted: refMuted, solo: false, source: j.referenceSource,
        clips: [{ id: id(), name: `${j.name.split(" (")[0]}_${bpm}bpm_${key.name}`, src: keyOf(j.reference), start: 0, length: len,
                  offset: 0, take: 0, takes: 0, plugins: [], lazy: refMuted }] }];
      // A lane's effect cards from session.json: "effects": [{ type, name, enabled, params: { id: knob 0..1 } }].
      // On a MIDI lane they go on each clip after its instrument, like an effect added to the lane in the app.
      const laneFx = (l) => (l.effects || []).map((e) => ({ id: id(), name: e.name || e.type, type: e.type, enabled: e.enabled !== false,
        params: Object.entries(e.params || {}).map(([pid, v]) => ({ id: pid, name: pid, value: Number(v) })) }));
      let armed = false;
      // a lane's "automation" (ui/automation.js), read once its clips and effect cards exist
      const autoFromJson = (l, t) => {
        if (l.sends) { t.sends = { A: 0, B: 0 }; for (const [k, v] of Object.entries(l.sends)) if (/^[A-Z]$/.test(k)) t.sends[k] = Math.max(0, Math.min(1, Number(v) || 0)); }   // its sends ride along here (A/B, and the GROUP / SEND buses C..Z)
        if (l.sendsPre) { t.sendsPre = {}; for (const [k, v] of Object.entries(l.sendsPre)) if (/^[A-Z]$/.test(k) && v) t.sendsPre[k] = true; }
        if (!l.automation || !window.KillToyAuto) return;
        t.automation = window.KillToyAuto.fromJson(l.automation, t, 60 / bpm, id);
        t.autoOpen = !!l.automationOpen;
      };
      for (const l of j.lanes || []) {
        // A MIDI lane: { name, role, instrument, clips: [{ start, beats, notes: [{ pitch, start, length, velocity }] }] },
        // all in beats (note starts from the clip's start). "notes" alone = one clip over the whole song.
        if (l.clips || l.notes || l.clipsFrom) {
          // "clipsFrom": "../<other version folder>" = the same notes as that version's lane of the same name
          // (versions that only change the sound don't repeat thousands of notes).
          const from = l.clipsFrom && SESSION_JSON[slug(l.clipsFrom.replace(/^\.\.\//, "").replace(/\/$/, ""))];
          const fromLane = from && (from.lanes || []).find((x) => x.name === (l.clipsLane || l.name));
          const spb = 60 / bpm, parts = l.clips || (fromLane && fromLane.clips) || [{ start: 0, beats: (j.lengthBars || 100) * 4, notes: l.notes || [] }];
          S.tracks.push({ id: id(), name: l.name, lane: (j.lanes || []).indexOf(l), kind: "inst", role: l.role || "inst", instrument: l.instrument, armed: false, muted: !!l.muted, solo: false, source: l.source,
            clips: parts.map((x) => ({ id: id(), name: x.name || l.name, kind: "midi", start: x.start * spb, length: x.beats * spb, beats: x.beats, offset: 0, take: 0, takes: 0,
                      delay: l.delay || 0, lowShelf: x.lowShelf || 0, notes: x.notes.map((n) => ({ ...n })),
                      plugins: [{ id: id(), name: l.instrument, type: "vst", enabled: true, instrument: true, params: [], ...(l.synth ? { synth: l.synth } : {}),
                                 ...(/toy machine/i.test(l.instrument || "") ? { toy: { id: l.preset || (l.toyPreset && l.toyPreset.basedOn) || null, preset: l.toyPreset ? JSON.parse(JSON.stringify(l.toyPreset)) : null, song: 1 } } : {}),
                                 ...(/toy keys/i.test(l.instrument || "") && window.ToyKeys ? { toy: { preset: l.toyPreset ? JSON.parse(JSON.stringify(l.toyPreset)) : ToyKeys.preset(l.preset) || ToyKeys.preset(ToyKeys.DEFAULT) } } : {}),
                                 // TOY GTR (13 Nov): { "instrument": "TOY GTR", "preset": "Chorus Clean" } or an inline "toyPreset"
                                 ...(/toy gtr/i.test(l.instrument || "") && window.ToyGtr ? { toy: { preset: l.toyPreset ? JSON.parse(JSON.stringify(l.toyPreset)) : ToyGtr.preset(l.preset) || ToyGtr.preset(ToyGtr.DEFAULT) } } : {}),
                                 ...(l.kit ? { kit: Object.fromEntries(Object.entries(l.kit).map(([p, f]) => [p, keyOf(f.file || f)])),
                                              kitGain: Object.fromEntries(Object.entries(l.kit).map(([p, f]) => [p, Math.pow(10, (f.gain_db || 0) / 20)])),
                                              kitName: Object.fromEntries(Object.entries(l.kit).map(([p, f]) => [p, f.name || String(f.file || f).split("/").pop().replace(/\.[^.]+$/, "").replace(/^kit[ _-]*/i, "")])), choke: l.choke || [] } : {}) }, ...laneFx(l)] })) });
          // Every clip of a TOY MACHINE lane shares one preset object, so an edit reaches them all.
          { const tps = S.tracks[S.tracks.length - 1].clips.flatMap((c) => c.plugins).filter(isTM);
            if (tps.length && l.preset && !l.toyPreset && !/toy keys|toy gtr/i.test(l.instrument || "")) tmFetchPreset(l.preset).catch((e) => console.warn(e.message));
            tps.forEach((q) => (q.toy = tps[0].toy)); }
          S.tracks[S.tracks.length - 1].clips.forEach((c) => c.plugins.forEach(uwEnsure));
          autoFromJson(l, S.tracks[S.tracks.length - 1]);
          continue;
        }
        const muted = isMuted(l), arm = !inBeat(l) && !armed;
        armed = armed || arm;
        // "sub" is the lane's short subtitle, "source" how it was made (hold the lane's dot)
        S.tracks.push({ id: id(), name: l.name, lane: (j.lanes || []).indexOf(l), kind: "take", role: l.role || "fx", armed: arm, muted, solo: false, sub: l.sub, source: l.source, plugins: [...startFx(j, l), ...laneFx(l)],
          clips: [{ id: id(), name: l.name, src: keyOf(l.file), start: 0, length: len, offset: 0, take: 0, takes: 0, plugins: [], lazy: muted }] });
        autoFromJson(l, S.tracks[S.tracks.length - 1]);
      }
      if (!armed) S.tracks.push({ id: id(), name: document.documentElement.classList.contains("kt2") ? "VOX" : "Lead Vox", kind: "take", role: "lead", armed: true, muted: false, solo: false, clips: [] });
      const drop = (j.sections || []).find((x) => /drop|hook|chorus/i.test(x.name)) || (j.sections || [])[1];
      S.loopStart = drop ? (drop.start != null ? drop.start : drop.startBar * br) : 0;
      S.loopEnd = drop ? (drop.end != null ? drop.end : drop.endBar * br) : 8 * br;
      S.transport = { position: 0, playing: false, recording: false, looping: false, input: -100 };
      S.playStart = 0;
      // A song in a group (session.json "group") is one version of that session: every
      // member shows as a named pill in the versions row.
      const members = song.group ? GROUPS.get(song.group) : [song];
      S.versions = members.map((m, i) => ({ number: i + 1, name: song.group ? m.label : undefined, current: m === song }));
    };
    // TOY DRUMS kits: their one-shots (in the song's audio/ folder) load with the song.
    const kitFiles = [...new Set((j.lanes || []).flatMap((l) => (l.kit ? Object.values(l.kit).map((f) => f.file || f) : [])))];
    song.files = [j.reference, ...(j.lanes || []).filter((l) => l.file).map((l) => l.file), ...kitFiles].map((f) => ({ key: keyOf(f), url: urlOf(f),
      lazy: f === j.reference ? !!j.referenceMuted : (j.lanes || []).some((l) => l.file === f && isMuted(l)) }));
    song.files.forEach((f) => SONG_FILES.add(f.key));
    song.pathOf = Object.fromEntries([j.reference, ...(j.lanes || []).map((l) => l.file)].filter(Boolean).map((f) => [keyOf(f), f])); // buffer key -> its file in session.json (Export)
    song.load = () => {
      const files = song.files.filter((f) => !f.lazy);
      stopLoads(new Set(song.files.map((f) => f.key)));
      // kits (tiny) first, then the voice, then drums, then everything else
      const prio = (f) => (/\/kit-/.test(f.key) ? 0 : /vocal|vox|lead/i.test(f.key) ? 1 : /kick|snare|drum|hat|clap|808|bass/i.test(f.key) ? 2 : f.key === keyOf(j.reference) ? 4 : 3);
      return loadingCard(files.map((f) => fetchAudio(f.key, f.url, prio(f)))).then(() => {
      if (curSong !== song) return; // another song was opened while this one loaded
      // Whole-song clips get the audio's real length, unless they were trimmed meanwhile (or before a reload).
      const full = (j.lengthBars || 100) * (60 / (j.bpm || 120)) * 4;
      const beat = S.tracks[0].clips[0], first = buffers[beat.src] ? beat : S.tracks.flatMap((t) => t.clips).find((c) => buffers[c.src]);
      if (first) S.tracks.forEach((t) => t.clips.forEach((c) => { if (c.start === 0 && Math.abs(c.length - full) < 1e-6 && c.kind !== "midi") c.length = buffers[first.src].duration; }));
      changed();
      });
    };
    return song;
  }
  // Lanes muted at the start load their audio the first time they can be heard.
  function loadHeard() {
    const need = S.tracks.filter((t) => audible(t)).flatMap((t) => t.clips).filter((c) => c.lazy && !buffers[c.src]);
    if (!need.length) return;
    const song = curSong;
    Promise.all(need.map((c) => { const f = song && song.files.find((x) => x.key === c.src); return f ? fetchAudio(f.key, f.url) : null; }))
      .then(() => { changed(); restartIfPlaying(); }).catch(() => {});
  }
  // Advanced MIDI (Eman, 7 Nov): a note's pitch line and wobble, as saved in the 7th slot of a compact note
  function noteExpr(n) {
    const out = {};
    if (Array.isArray(n.bend) && n.bend.length) out.bend = n.bend.map((p) => [+(+p[0]).toFixed(4), +(+p[1]).toFixed(3), ...(p[2] && p[2] !== 1 ? [+(+p[2]).toFixed(2)] : [])]);
    if (n.wob && n.wob.d > 0) out.wob = { d: +(+n.wob.d).toFixed(3), r: +(+(n.wob.r || 2)).toFixed(3), ...(n.wob.f ? { f: +(+n.wob.f).toFixed(3) } : {}), ...(n.wob.sh ? { sh: n.wob.sh } : {}), ...(Array.isArray(n.wob.e) && n.wob.e.length ? { e: n.wob.e.map((p) => [+(+p[0]).toFixed(3), +(+p[1]).toFixed(3)]) } : {}) };
    return Object.keys(out).length ? out : null;
  }
  // Compact notes: a clip may carry "n": [[pitch, start, length, velocity], ...] instead of "notes".
  function expandNotes(o) {
    if (Array.isArray(o)) { o.forEach(expandNotes); return o; }
    if (!o || typeof o !== "object") return o;
    if (Array.isArray(o.n) && !o.notes && (!o.n.length || Array.isArray(o.n[0]))) {
      o.notes = o.n.map(([pitch, start, length, velocity, slide, fl, x]) => ({ pitch, start, length, velocity, ...(slide ? { slide: true } : {}), ...(slide > 1 ? { slideFrom: slide } : {}), ...(fl & 1 ? { locked: true } : {}), ...(fl & 32 && slide > 1 ? { slideHand: true } : {}), ...(fl & 2 ? { pull: true, pullAt: ((fl >> 2) & 7 || 2) / 4 } : {}), ...(x && typeof x === "object" ? x : {}) })); // 6th = flags: 1 locked, 2 pull up (+ quarters of the bend << 2) // 5th = slide (FL-style glide): 1, or the pitch it glides from // 7th = Advanced MIDI { bend, wob }
      delete o.n;
    }
    for (const k in o) if (o[k] && typeof o[k] === "object") expandNotes(o[k]);
    return o;
  }
  // A packed build (PG_PACK) has heads.json: every session without its notes, which is all the
  // home page needs. A song's full session.json (its pack) is fetched when it's opened (fullSong).
  const fullJson = (d) => fetch(`audio/songs/${d}/session.json`).then((r) => r.json()).then((j) => (SESSION_JSON[d] = expandNotes(j)));
  const songOf = (d, j, partial, into) => Object.assign(songFromJson(d, j, into), { dir: d, partial });
  fetch("audio/songs/index.json").then((r) => (r.ok ? r.json() : []))
    .then((dirs) => fetch("audio/songs/heads.json").then((r) => (r.ok ? r.json() : null), () => null).then((heads) => Promise.all(dirs.map((d) =>
      Promise.resolve().then(() => (heads && heads[d] ? songOf(d, heads[d], true) : fullJson(d).then((j) => songOf(d, j, false))))
        .catch((e) => { console.error("Song " + d + " couldn't load", e); return null; })))))  // one broken song never hides the rest
    .then((list) => {
      for (const song of list.filter(Boolean)) {
        if (!song.group) { SONGS.push(song); continue; }
        if (!GROUPS.has(song.group)) { GROUPS.set(song.group, []); SONGS.push({ name: song.group, group: song.group }); }
        GROUPS.get(song.group).push(song);
      }
      S.sessions = SONGS.map((x) => x.name);
      updateProjects();
      changed();
    })
    .catch(() => {})
    // Projects that live on the other web page (the main page <-> the KILLTOY Library):
    // scripts/playground.sh PG_AWAY writes audio/songs/away.json; they open that page.
    .then(() => fetch("audio/songs/away.json")).then((r) => (r && r.ok ? r.json() : null))
    .then((a) => {
      if (!a) return;
      S.projectsAway = a.projects.map((p) => ({ ...p, name: PROJECT_RENAMES[p.name] || p.name }))
        .filter((p) => !SONGS.some((x) => x.name === p.name))
        .map((p) => { const info = PROJECT_INFO[p.name] || {};
          return { ...p, key: keyFrom(p.key).name, url: a.url, awayLabel: a.label, about: info.about || p.about, line: info.line,
                   image: p.image || info.image || "bg/KT_UP_0" + (1 + (p.name.length % 9)) + ".jpg" }; });
      changed();
    })
    .catch(() => {})
    .then(() => { // a song marked "open" in its session.json opens first, else Ruski
      if (curSong || opening) return; // a project was already clicked on the home page while this loaded: keep it
      // The project and version that were open last time come back after a reload.
      return metaReady.then(() => {
        if (curSong || opening) return;
        const last = lastOpen(), song = last && songBuilt(last);
        if (song && song.build) return openSong(song, { ver: last.ver ? userVersions(song).find((v) => v.key === last.ver) : null });
        const first = [...GROUPS.values()].flat().concat(SONGS).find((x) => x.open);
        return openSong(first || SONGS[0]);
      });
    });
  S.sessions = [SONG.name];
  updateProjects();
  // A group's name means the group (it opens its "open" version): versions of a remade song
  // all carry the song's name, so a version is opened by passing the song itself.
  const songNamed = (name) => SONGS.find((x) => x.group && x.name === name) || [...GROUPS.values()].flat().find((x) => x.name === name) || SONGS.find((x) => x.name === name);
  // A real song (version) by what was remembered ({ song, dir }): a group can have the same name as one of its versions.
  const songBuilt = (m) => { const all = [...GROUPS.values()].flat().concat(SONGS).filter((x) => x.build);
    return (m.dir && all.find((x) => x.dir === m.dir)) || all.find((x) => x.name === m.song) || null; };
  // Turns a song (and the other versions in its group, which share one pack) from its head into
  // the full song, keeping the same objects so the versions row and the projects list stay put.
  async function fullSong(song) {
    if (!song.partial) return;
    const members = song.group ? GROUPS.get(song.group) : [song];
    await Promise.all(members.filter((m) => m.partial).map((m) => fullJson(m.dir).then((j) => songOf(m.dir, j, false, m))));
    // a lane may borrow its notes from a version outside the group ("clipsFrom")
    const from = members.flatMap((m) => (m.json.lanes || []).map((l) => l.clipsFrom)).filter(Boolean)
      .map((x) => slug(x.replace(/^\.\.\//, "").replace(/\/$/, ""))).filter((d) => !SESSION_JSON[d]);
    await Promise.all([...new Set(from)].map((d) => fullJson(d).catch(() => {})));
  }
  let opening = 0;
  // opts.ver: a version made with "+" (its own saved edits, on top of this song's files).
  async function openSong(name, opts = {}) {
    MAUTO.hold = 0.5;   // MASTER AUTO starts each song from a safe level
    let song = typeof name === "object" ? name : songNamed(name);
    if (song && !song.build && song.group) song = GROUPS.get(song.group).find((m) => m.open) || GROUPS.get(song.group)[0];
    if (!song) return { error: `"${name}" isn't in this playground.` };
    saveNow().catch(() => {}); // the version you're leaving keeps its edits (a failed save says so itself; it must not also throw here)
    const me = ++opening;
    if (song.partial) {
      S.jobs = S.jobs.filter((x) => !x.loading).concat({ id: id(), label: "Opening", stage: "notes", progress: 0.02, finished: false, failed: false, message: "", loading: true });
      changed();
      try { await fullSong(song); } catch (e) { S.jobs = S.jobs.filter((x) => !x.loading); changed(); return { error: `Couldn't open ${song.label || song.name}.` }; }
      if (me !== opening) return { ok: true }; // another song was picked meanwhile
    }
    const ver = opts.ver || null;
    const saved = await readSaved(ver ? ver.key : "song:" + song.name); // its edits from last time, with any audio made here
    if (me !== opening) return { ok: true };
    if (S.transport.playing) halt();
    stopVoices();
    undoStack.length = 0; redoStack.length = 0;
    S.jobs = [];
    S.tempo = []; S.tempoOpen = false; S.tempoMin = false; S.tempoMode = "curve";   // TEMPO lane: each song has its own (applySaved brings it back)
    song.build();
    curSong = song; curVer = ver;
    S.rhythmKeep = {};
    if (saved) applySaved(saved);
    if (saved && loopKeepOn()) { try { healLoops(); } catch (e) { console.warn("LOOP KEEP", e); } }
    S.versions = versionRow();
    rememberOpen();
    forgetOtherSongs(song);
    applyArm();
    loaded = song.load(); // starts the downloads; the song opens (and plays) while they come in
    if (saved) { needSources(); loadHeard(); }
    updateProjects();
    changed();
    loaded.then(() => (saved ? null : restoreVariations())).then(changed, (e) => { console.warn("A sound of this song didn't load", e); changed(); });
    // LOOP KEEP: loop clips whose sound was still loading are looked at again once it is in
    if (saved && loopKeepOn()) for (const ms of [1500, 6000, 15000]) setTimeout(() => { if (me !== opening) return; try { if (healLoops()) changed(); } catch (e) { console.warn("LOOP KEEP", e); } }, ms);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Waveforms from the real samples.
  const fakePeaks = handlers.getPeaks;
  const findClip = (cid) => S.tracks.flatMap((t) => t.clips).find((c) => c.id === cid);
  // Takes: a clip from loop recording has c.takeSrc, one { src, offset, gain } per pass,
  // and maybe a comp ([{ start, end, take }] from the clip start).
  const takeOf = (c, take) => (c.takeSrc && c.takeSrc[take]) || { src: c.src, offset: c.offset, gain: c.level };
  const piecesOf = (c, take) => (take != null ? [{ start: 0, end: c.length, take }]
    : c.takeSrc && c.comp && c.comp.length ? c.comp : [{ start: 0, end: c.length, take: c.take }]);

  // Each file is read once into blocks of 256 samples (lowest, highest, energy), so a redraw
  // only walks the blocks instead of every sample: zooming and loading stay smooth.
  // A 3-minute stereo file is ~16M samples, so the scan runs in slices of ~1M with a pause
  // between them: the screen and the transport keep moving while a song's waveforms come in.
  const BLOCK = 256, SLICE = 4096, blockCache = new WeakMap();
  function blocksOf(buf) {
    let m = blockCache.get(buf);
    if (m) return m;
    m = (async () => {
      const n = Math.ceil(buf.length / BLOCK), chans = [];
      for (let ch = 0; ch < buf.numberOfChannels; ch++) chans.push(buf.getChannelData(ch));
      const out = { lo: new Float32Array(n), hi: new Float32Array(n), sq: new Float32Array(n) };
      const nc = chans.length, c0 = chans[0], c1 = nc === 2 ? chans[1] : null, len = buf.length;
      for (let s0 = 0; s0 < n; s0 += SLICE) {
        if (s0) await new Promise((go) => setTimeout(go, 0));
        for (let b = s0, bEnd = Math.min(n, s0 + SLICE); b < bEnd; b++) {
          let lo = 0, hi = 0, sq = 0;
          for (let i = b * BLOCK, e = Math.min(len, i + BLOCK); i < e; i++) {
            const v = c1 ? (c0[i] + c1[i]) * 0.5 : nc === 1 ? c0[i] : chans.reduce((a, d) => a + d[i], 0) / nc;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
            sq += v * v;
          }
          out.lo[b] = lo; out.hi[b] = hi; out.sq[b] = sq;
        }
      }
      return out;
    })();
    blockCache.set(buf, m);
    return m;
  }

  handlers.getPeaks = async ({ clipId, buckets, take, orig }) => {
    let c = findClip(clipId); // each clip's picture waits only for its own file
    if (c && orig && c.edit) c = { ...c, ...c.edit.orig, edit: null };   // the audio editor draws the original
    const src = c && takeOf(c, take != null ? take : c.take).src;
    if (c && !buffers[src]) { // a muted lane loads lazily: fetch it for its picture anyway
      const song = curSong, f = song && song.files && song.files.find((x) => x.key === src);
      if (f && f.lazy) await Promise.resolve(loaded).catch(() => {}); // after the lanes you hear
      if (f && curSong === song) await fetchAudio(f.key, f.url).catch(() => {});
    }
    if (!c || !buffers[src]) return fakePeaks({ clipId, buckets });
    const pieces = piecesOf(c, take);
    const blocks = new Map();
    for (const x of pieces) { const b = buffers[takeOf(c, x.take).src]; if (b && !blocks.has(b)) blocks.set(b, await blocksOf(b)); }
    const min = [], max = [], peak = [], rms = [];
    for (let b = 0; b < buckets; b++) {
      const t0 = (b * c.length) / buckets, t1 = ((b + 1) * c.length) / buckets;
      const piece = pieces.find((x) => t0 >= x.start - 1e-9 && t0 < x.end) || pieces[pieces.length - 1];
      const ts = takeOf(c, piece.take), buf = buffers[ts.src];
      let lo = 0, hi = 0, sq = 0, cnt = 0;
      const m = buf && (blocks.get(buf) || blockCache.get(buf));
      if (m && m.lo) {   // (a picture still being worked out after a quick swap of the sound: skip it this time)
        const g = ts.gain || 1;
        const a = Math.max(0, Math.floor(((ts.offset + t0) * buf.sampleRate) / BLOCK));
        const z = Math.min(m.lo.length, Math.max(a + 1, Math.floor(((ts.offset + t1) * buf.sampleRate) / BLOCK)));
        for (let i = a; i < z; i++) {
          if (m.lo[i] < lo) lo = m.lo[i];
          if (m.hi[i] > hi) hi = m.hi[i];
          sq += m.sq[i]; cnt += BLOCK;
        }
        lo *= g; hi *= g; sq *= g * g;
      }
      min.push(lo); max.push(hi); peak.push(Math.max(hi, -lo)); rms.push(cnt ? Math.sqrt(sq / cnt) : 0);
    }
    return { peak, rms, min, max };
  };

  // Close-up waveform (Eman, 6 Nov 19:06: "better resolution when zooming in close"): the raw
  // samples of one stretch of a clip, from..to seconds from the clip start. cols columns of
  // min/max, or, when there are fewer samples than about two per column, the samples themselves
  // (mono) so the picture can be drawn as one clean line.
  handlers.getWaveDetail = async ({ clipId, from, to, cols, orig }) => {
    let c = findClip(clipId);
    if (c && orig && c.edit) c = { ...c, ...c.edit.orig, edit: null };   // the audio editor draws the original
    if (!c || c.reversed || !(to > from) || !(cols > 0)) return null;
    const pieces = piecesOf(c);
    const at = (t) => { const pc = pieces.find((x) => t >= x.start - 1e-9 && t < x.end) || pieces[pieces.length - 1]; const ts = takeOf(c, pc.take); return { ts, buf: buffers[ts.src] }; };
    const first = at(from);
    if (!first.buf) return null;
    const sr = first.buf.sampleRate, n = Math.ceil((to - from) * sr);
    const read = (t) => {   // one sample (loudest channel, keeps its sign) at clip time t
      const { ts, buf } = at(t); if (!buf) return 0;
      const i = Math.floor((ts.offset + t) * buf.sampleRate); if (i < 0 || i >= buf.length) return 0;
      let v = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++) { const x = buf.getChannelData(ch)[i]; if (Math.abs(x) > Math.abs(v)) v = x; }
      return v * (ts.gain || 1);
    };
    if (n <= cols * 2) {
      const t0 = Math.floor(from * sr) / sr, m = Math.min(200000, Math.ceil((to - t0) * sr) + 2), samples = new Float32Array(m);
      for (let i = 0; i < m; i++) samples[i] = read(t0 + i / sr);
      return { samples, t0, dt: 1 / sr };
    }
    const min = new Float32Array(cols), max = new Float32Array(cols), step = Math.max(1, Math.floor(n / cols / 64));   // at most ~64 reads per column
    for (let k = 0; k < cols; k++) {
      const a = from + ((to - from) * k) / cols, z = from + ((to - from) * (k + 1)) / cols;
      const { ts, buf } = at(a); if (!buf) continue;
      const g = ts.gain || 1, i0 = Math.max(0, Math.floor((ts.offset + a) * buf.sampleRate)), i1 = Math.min(buf.length, Math.ceil((ts.offset + z) * buf.sampleRate));
      let lo = 0, hi = 0;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = i0; i < i1; i += step) { const x = d[i]; if (x < lo) lo = x; if (x > hi) hi = x; } }
      min[k] = lo * g; max[k] = hi * g;
    }
    return { min, max };
  };

  // PG MATCH (Eman, 15 Nov): the dice listens to the sound clips over its pattern. One stretch of a clip
  // (from..to seconds from the clip start) as mono samples at a low rate (default 11025), with the clip gain,
  // takes and comp pieces as they play. Silence where the sound isn't loaded yet.
  handlers.getClipMono = async ({ clipId, from, to, rate }) => {
    const c = findClip(clipId);
    if (!c || c.reversed || !(to > from)) return null;
    const pieces = piecesOf(c);
    const at = (t) => { const p = pieces.find((x) => t >= x.start - 1e-9 && t < x.end) || pieces[pieces.length - 1]; const ts = takeOf(c, p.take); return { ts, buf: buffers[ts.src] || null }; };
    for (const p of pieces) { const ts = takeOf(c, p.take); if (ts && ts.src && !buffers[ts.src]) await bufferFor(ts.src); }
    const sr = Math.max(2000, Math.min(22050, rate || 11025)), n = Math.min(sr * 120, Math.ceil((to - from) * sr)), out = new Float32Array(n);
    let any = false;
    for (let i = 0; i < n; i++) {
      const t = from + i / sr, { ts, buf } = at(t); if (!buf) continue;
      const k = buf.sampleRate / sr, i0 = Math.floor((ts.offset + t) * buf.sampleRate), w = Math.max(1, Math.floor(k));
      if (i0 < 0 || i0 >= buf.length) continue;
      let v = 0; const nc = buf.numberOfChannels;
      for (let ch = 0; ch < nc; ch++) { const d = buf.getChannelData(ch); for (let j = 0; j < w && i0 + j < buf.length; j++) v += d[i0 + j]; }
      out[i] = (v / (nc * w)) * (ts.gain || 1); any = true;
    }
    return any ? { samples: out, rate: sr } : null;
  };

  // ---------------------------------------------------------------------------
  // Effects: each clip effect becomes a small Web Audio chain whose knobs work live.
  const dB = (v) => Math.pow(10, v / 20);
  const param = (p, pid, def) => { const x = p.params.find((q) => q.id === pid); return x ? x.value : def; };
  // FAST PLAY (16 Nov): the same reverb (same size, same damp) reuses its impulse instead of making seconds of new
  // noise at every play. The last 16 are kept. window.KT2_IR_CACHE_OFF = true: a new one every time, as before.
  const irCache = new Map();
  function impulse(seconds, damp) {
    if (window.KT2_IR_CACHE_OFF) return impulseNew(seconds, damp);
    const k = ctx.sampleRate + ":" + seconds.toFixed(4) + ":" + (+damp).toFixed(4);
    let ir = irCache.get(k);
    if (ir) { irCache.delete(k); irCache.set(k, ir); return ir; }
    ir = impulseNew(seconds, damp);
    irCache.set(k, ir);
    if (irCache.size > 16) irCache.delete(irCache.keys().next().value);
    return ir;
  }
  function impulseNew(seconds, damp) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        lp += (w - lp) * (1 - damp * 0.9);
        d[i] = lp * Math.pow(1 - i / len, 2.2);
      }
    }
    return ir;
  }
  function shaper(amount) {
    const k = 1 + amount * 30, curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
    return curve;
  }

  const BUILD = {
    // MAKE ROOM (MIX page "X WINS"): a bell cut at freq that dips only while the lane it follows
    // (p.sidechain) plays in that range: the key goes through a band-pass at the same frequency,
    // its level opens the cut up to Depth, and it lets go over Release.
    ktroom: (p) => {
      const bell = ctx.createBiquadFilter();
      bell.type = "peaking"; bell.Q.value = 1.1; bell.gain.value = 0;
      const st = { f: 632, depth: 6, rel: 0.15, sp: null, bp: null };
      const hz = (v) => 60 * Math.pow(200, v);   // 60 Hz .. 12 kHz
      const set = (pid, v) => {
        if (pid === "freq") { st.f = hz(v); bell.frequency.value = st.f; if (st.bp) st.bp.frequency.value = st.f; return st.f >= 1000 ? (st.f / 1000).toFixed(1) + " kHz" : Math.round(st.f) + " Hz"; }
        if (pid === "depth") { st.depth = v * 12; return "-" + st.depth.toFixed(1) + " dB"; }
        if (pid === "release") { st.rel = 0.03 + v * 0.4; return Math.round(st.rel * 1000) + " ms"; }
      };
      bell.frequency.value = st.f;
      const key = (node) => {
        st.bp = ctx.createBiquadFilter(); st.bp.type = "bandpass"; st.bp.frequency.value = st.f; st.bp.Q.value = 1.1;
        st.sp = ctx.createScriptProcessor(1024, 2, 1);
        const hush = ctx.createGain(); hush.gain.value = 0;
        node.connect(st.bp); st.bp.connect(st.sp); st.sp.connect(hush); hush.connect(ctx.destination);
        let cur = 0;
        st.sp.onaudioprocess = (e) => {
          const ib = e.inputBuffer; let sum = 0, n = 0;
          for (let c = 0; c < ib.numberOfChannels; c++) { const d = ib.getChannelData(c); for (let i = 0; i < d.length; i += 2) { sum += d[i] * d[i]; n++; } }
          const db = 10 * Math.log10(Math.max(1e-10, sum / Math.max(1, n)));
          const want = -st.depth * Math.max(0, Math.min(1, (db + 42) / 24));   // quiet key: no dip; loud key: full depth
          bell.gain.setTargetAtTime(want, ctx.currentTime, want < cur ? 0.008 : st.rel / 3);
          cur = want;
        };
      };
      const close = () => { if (st.sp) { st.sp.onaudioprocess = null; try { st.sp.disconnect(); st.bp.disconnect(); } catch (e) { /* gone */ } } };
      return { input: bell, output: bell, set, key, close };
    },
    "4bandEq": (p) => {
      const lo = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter();
      lo.type = "lowshelf"; lo.frequency.value = 180;
      mid.type = "peaking"; mid.frequency.value = 1600; mid.Q.value = 0.9;
      hi.type = "highshelf"; hi.frequency.value = 8000;
      lo.connect(mid); mid.connect(hi);
      const set = (pid, v) => {
        const gain = (v - 0.5) * 24;
        if (/^Low/.test(pid)) lo.gain.value = gain;
        else if (/^Mid/.test(pid)) mid.gain.value = gain;
        else if (/^High/.test(pid)) hi.gain.value = gain;
        return (gain >= 0 ? "+" : "") + gain.toFixed(1) + " dB";
      };
      return { input: lo, output: hi, set };
    },
    compressor: (p) => {
      const c = ctx.createDynamicsCompressor(), out = ctx.createGain();
      c.knee.value = 6; c.attack.value = 0.005; c.release.value = 0.12;
      c.connect(out);
      const set = (pid, v) => {
        if (pid === "threshold") { c.threshold.value = -(1 - v) * 45; return c.threshold.value.toFixed(1) + " dB"; }
        if (pid === "ratio") { c.ratio.value = 1 + v * 8.3; return c.ratio.value.toFixed(1) + " : 1"; }
        if (pid === "output gain") { const g = (v - 0.5) * 24; out.gain.value = dB(g); return (g >= 0 ? "+" : "") + g.toFixed(1) + " dB"; }
      };
      return { input: c, output: out, set };
    },
    delay: (p) => {
      const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
      const d = ctx.createDelay(2), fb = ctx.createGain(), tone = ctx.createBiquadFilter();
      tone.type = "lowpass"; tone.frequency.value = 4500;
      input.connect(dry); dry.connect(output);
      input.connect(d); d.connect(tone); tone.connect(fb); fb.connect(d); tone.connect(wet); wet.connect(output);
      const set = (pid, v) => {
        if (pid === "purp:delayTime") { d.delayTime.value = Math.max(0.01, v * 1.5); return Math.round(v * 1500) + " ms"; }
        if (pid === "feedback") { fb.gain.value = v * 0.85; return v > 0 ? Math.round(20 * Math.log10(v * 0.85)) + " dB" : "off"; }
        if (pid === "mix proportion") { wet.gain.value = v; dry.gain.value = v >= 0.995 ? 0 : 1 - v * 0.5; return Math.round(v * 100) + "%"; }   // 100% = all echo (a return's B Echo)
      };
      if (!p.params.length) { set("purp:delayTime", (60 / S.bpm) * 0.75 / 1.5); set("feedback", 0.4); set("mix proportion", 0.35); }
      return { input, output, set };
    },
    reverb: (p) => {
      const input = ctx.createGain(), output = ctx.createGain(), wet = ctx.createGain(), conv = ctx.createConvolver();
      input.connect(output); input.connect(conv); conv.connect(wet); wet.connect(output);
      let size = param(p, "room size", 0.6), damp = param(p, "damping", 0.5);
      let built = null, laterT = 0;
      const rebuild = () => { built = [size, damp]; conv.buffer = impulse(0.4 + size * 4, damp); };
      // An automation line on Size or Damping moves 40 times a second, and each move made a new 0.4-4.4 s
      // impulse (up to 400k random samples): the page stuttered (9 Nov overnight test). Now a move rebuilds
      // at most every 120 ms, and only when it changed by a step you can hear. KT_VERB_REBUILD_OLD = every move.
      const soon = () => {
        if (window.KT_VERB_REBUILD_OLD) return rebuild();
        if (built && Math.abs(built[0] - size) < 0.02 && Math.abs(built[1] - damp) < 0.02) return;
        if (!laterT) laterT = setTimeout(() => { laterT = 0; rebuild(); }, built ? 120 : 0);
      };
      rebuild();
      const set = (pid, v) => {
        if (pid === "room size") { size = v; soon(); }
        else if (pid === "damping") { damp = v; soon(); }
        else if (pid === "wet level") wet.gain.value = v * 1.4;
        return Math.round(v * 100) + "%";
      };
      return { input, output, set };
    },
    airwindows_drive: (p) => {
      const hp = ctx.createBiquadFilter(), ws = ctx.createWaveShaper(), out = ctx.createGain();
      hp.type = "highpass"; hp.frequency.value = 20; ws.oversample = "2x";
      hp.connect(ws); ws.connect(out);
      const set = (pid, v) => {
        if (pid === "drive") ws.curve = shaper(v);
        else if (pid === "highpass") hp.frequency.value = 20 + v * v * 1200;
        else if (pid === "outlevel") out.gain.value = v * 1.4;
        return v.toFixed(2);
      };
      if (!p.params.length) { set("drive", 0.5); set("outlevel", 0.7); }
      return { input: hp, output: out, set };
    },
    airwindows_deess: (p) => {
      const f = ctx.createBiquadFilter();
      f.type = "peaking"; f.frequency.value = 6500; f.Q.value = 1.4;
      let intense = 0.4, max = 0.5;
      const apply = () => (f.gain.value = -intense * max * 24);
      const set = (pid, v) => {
        if (pid === "intense") intense = v; else if (pid === "max") max = v; else if (pid === "freq") f.frequency.value = 4000 + v * 5000;
        apply(); return v.toFixed(2);
      };
      return { input: f, output: f, set };
    },
  };
  // Vocal Gate: a small AudioWorklet (the browser's own audio thread).
  const gateCode = `registerProcessor("purp-gate", class extends AudioWorkletProcessor {
    static get parameterDescriptors() { return [{ name: "thr", defaultValue: -45 }, { name: "range", defaultValue: -40 }, { name: "rel", defaultValue: 0.12 }]; }
    constructor() { super(); this.env = 0; this.g = 1; this.hold = 0; }
    process(ins, outs, p) {
      const x = ins[0], y = outs[0];
      if (!x || !x.length) return true;
      const thr = Math.pow(10, p.thr[0] / 20), floor = Math.pow(10, p.range[0] / 20);
      const rel = Math.exp(-1 / (p.rel[0] * sampleRate)), att = Math.exp(-1 / (0.001 * sampleRate));
      for (let i = 0; i < x[0].length; i++) {
        let v = 0; for (const ch of x) v = Math.max(v, Math.abs(ch[i]));
        this.env = v > this.env ? v : this.env * 0.9995;
        if (this.env > thr) this.hold = sampleRate * 0.03;
        const open = this.hold-- > 0;
        this.g = open ? att * this.g + (1 - att) : rel * this.g + (1 - rel) * floor;
        for (let c = 0; c < y.length; c++) y[c][i] = x[Math.min(c, x.length - 1)][i] * this.g; // a mono input feeds both sides
      }
      return true;
    }
  });`;
  const gateReady = ctx.audioWorklet
    ? ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([gateCode], { type: "application/javascript" }))).then(() => true, () => false)
    : Promise.resolve(false);
  let gateOk = false;
  gateReady.then((ok) => (gateOk = ok));
  BUILD.purpgate = (p) => {
    if (!gateOk) return passthrough();
    const node = new AudioWorkletNode(ctx, "purp-gate", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
    const set = (pid, v) => {
      if (pid === "threshold") { const d = -80 + v * 78; node.parameters.get("thr").value = d; return Math.round(d) + " dB"; }
      if (pid === "range") { const d = -v * 50; node.parameters.get("range").value = d; return Math.round(d) + " dB"; }
      if (pid === "release") { const s = 0.02 + v * 0.333; node.parameters.get("rel").value = s; return Math.round(s * 1000) + " ms"; }
    };
    return { input: node, output: node, set };
  };

  // Squash: OTT-style 3-band compression. Low / mid / high are split (120 Hz, 2.5 kHz),
  // each band squashed hard with make-up gain so quiet detail comes up and peaks come
  // down, the highs a little brighter, then blended with the dry sound by Depth. The
  // output is trimmed as Depth goes up, so turning it on doesn't jump in level much.
  // Checked on the V9 lead at Depth 45%: loudness range 15.9 -> 12.4 dB, 4 kHz+ vs
  // mids -31.5 -> -13.2 dB, level about +2 dB (the original's lead: 11.0 dB, -14.7 dB).
  BUILD.ktsquash = () => {
    const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
    input.connect(dry); dry.connect(output); wet.connect(output);
    const filt = (type, f) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = 0.707; return b; };
    const chain = (...nodes) => { for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]); return nodes; };
    const bands = [
      [filt("lowpass", 120), filt("lowpass", 120)],
      [filt("highpass", 120), filt("highpass", 120), filt("lowpass", 2500), filt("lowpass", 2500)],
      [filt("highpass", 2500), filt("highpass", 2500)],
    ].map((fs, i) => {
      const comp = ctx.createDynamicsCompressor(), up = ctx.createGain();
      comp.threshold.value = -50; comp.knee.value = 8; comp.ratio.value = 10;
      up.gain.value = dB(14 + [0, 0, 3][i]);
      chain(input, ...fs, comp, up, wet);
      return { comp, up };
    });
    let time = 0.4, depth = 0.4, out = 0;
    const level = () => (output.gain.value = dB(out - depth * 25));
    const apply = () => bands.forEach((b) => { b.comp.attack.value = 0.001 + time * 0.02; b.comp.release.value = 0.04 + time * 0.3; });
    apply();
    const set = (pid, v) => {
      if (pid === "depth") { depth = v; wet.gain.value = v; dry.gain.value = 1 - v; level(); return Math.round(v * 100) + "%"; }
      if (pid === "time") { time = v; apply(); return Math.round(v * 100) + "%"; }
      if (pid === "output") { out = (v - 0.5) * 24; level(); return (out >= 0 ? "+" : "") + out.toFixed(1) + " dB"; }
    };
    set("depth", 0.4);
    return { input, output, set };
  };
  // Punch: a transient shaper. Compares a fast and a slow loudness follower: where the
  // fast one is ahead, that's the hit (Attack turns it up or down); the rest is the tail
  // (Sustain).
  const punchCode = `registerProcessor("kt-punch", class extends AudioWorkletProcessor {
    static get parameterDescriptors() { return [{ name: "att", defaultValue: 0.4 }, { name: "sus", defaultValue: 0 }, { name: "mix", defaultValue: 1 }]; }
    constructor() { super(); this.f = 0; this.s = 0; }
    process(ins, outs, p) {
      const x = ins[0], y = outs[0];
      if (!x || !x.length) return true;
      const a = p.att[0], su = p.sus[0], mix = p.mix[0];
      const fa = Math.exp(-1 / (0.0008 * sampleRate)), fr = Math.exp(-1 / (0.03 * sampleRate));
      const sa = Math.exp(-1 / (0.025 * sampleRate)), sr = Math.exp(-1 / (0.25 * sampleRate));
      for (let i = 0; i < x[0].length; i++) {
        let v = 0; for (const ch of x) v = Math.max(v, Math.abs(ch[i]));
        this.f = v > this.f ? fa * this.f + (1 - fa) * v : fr * this.f + (1 - fr) * v;
        this.s = v > this.s ? sa * this.s + (1 - sa) * v : sr * this.s + (1 - sr) * v;
        const tr = Math.max(0, this.f - this.s) / (this.f + 1e-6);
        let g = (1 + a * 2.5 * tr) * (1 + su * 0.8 * (1 - tr));
        g = Math.max(0.1, Math.min(4, g));
        const k = 1 - mix + mix * g;
        for (let c = 0; c < y.length; c++) y[c][i] = x[Math.min(c, x.length - 1)][i] * k; // a mono input feeds both sides
      }
      return true;
    }
  });`;
  let punchOk = false;
  if (ctx.audioWorklet) ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([punchCode], { type: "application/javascript" }))).then(() => (punchOk = true), () => {});
  BUILD.ktpunch = () => {
    if (!punchOk) return passthrough();
    const node = new AudioWorkletNode(ctx, "kt-punch", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
    const pct = (v) => { const x = Math.round((v - 0.5) * 200); return (x > 0 ? "+" : "") + x + "%"; };
    const set = (pid, v) => {
      if (pid === "attack") { node.parameters.get("att").value = (v - 0.5) * 2; return pct(v); }
      if (pid === "sustain") { node.parameters.get("sus").value = (v - 0.5) * 2; return pct(v); }
      if (pid === "mix") { node.parameters.get("mix").value = v; return Math.round(v * 100) + "%"; }
    };
    return { input: node, output: node, set };
  };

  const passthrough = () => { const g = ctx.createGain(); return { input: g, output: g, set: () => null }; };

  // KILLTOY's own effects (Pump, Chop Pitch, Space, Crush, Loud, SC Clip): the app's own C++,
  // compiled to WebAssembly (killtoy-fx.js + killtoy-fx.wasm), so they sound like the app.
  let ktfx = null;
  if (window.KillToyFx && ctx.audioWorklet)
    if (window.KillToyStretch) KillToyStretch.load("killtoy-stretch.wasm");   // the real stretcher for BPM / key changes
    window.KillToyFx.load(ctx, "killtoy-fx.wasm").then((f) => (ktfx = f), (e) => console.warn("KILLTOY effects did not load", e));
  // Pump follows the song: where the playhead is right now, and the tempo.
  const songNow = () => ({ bpm: S.bpm, songAt: position(), playing: true });
  for (const type of ["ktpump", "ktchoppitch", "ktspace", "ktcrush", "ktloud", "ktscclip", "ktsnaptune", "kttexture"])
    BUILD[type] = () => (ktfx ? ktfx.create(type, { getTransport: songNow }) : passthrough());
  // TOYTUNE (16 Nov): the vocal tool. Its own engine (playground/toytune-engine.js + toytune.wasm, the same C++ as the
  // VST3/AU); its whole setup lives on the card as p.tt (ui/toytune.js state). MIDI follow hears an instrument lane's
  // notes and PG MATCH the chords every instrument lane plays (ttFeeds). KT2_TOYTUNE_OFF = not offered, plays dry.
  let ttEng = null;
  if (window.ToyTuneEngine && ctx.audioWorklet && !window.KT2_TOYTUNE_OFF)
    window.ToyTuneEngine.load(ctx, "toytune.wasm").then((e) => (ttEng = e), (e) => console.warn("TOYTUNE did not load", e));
  function ttFeeds(p) {
    const tt = p.tt || {}, spb = 60 / S.bpm, notes = [], chords = [];
    const inst = S.tracks.filter((t) => t.kind === "inst" && !t.clips.some((c) => (c.plugins || []).some((q) => q.instrument && q.kit)));
    const lane = inst.find((t) => t.id === tt.midiLane) || inst.find((t) => !t.muted) || null;
    const songNotes = (t) => {
      const out = [];
      for (const c0 of tempoClips(t)) {
        if (c0.kind !== "midi" || c0.active === false) continue;
        const c = midiView(c0), end = c.start + c.length;
        for (const n of c.notes || []) {
          if (n.muted) continue;
          const a = c.start + n.start * spb + (c.delay || 0), b = Math.min(end, a + Math.max(0.03, (n.length || 0.25) * spb));
          if (a >= c.start - 1e-6 && a < end) out.push([a, b, n.pitch]);
        }
      }
      return out;
    };
    if (lane) notes.push(...songNotes(lane));
    // chords: every instrument lane's notes, per half bar
    const all = inst.filter((t) => !t.muted).flatMap(songNotes), step = spb * 2;
    if (all.length) {
      const end = Math.max(...all.map((n) => n[1]));
      for (let a = 0; a < end; a += step) {
        let m = 0;
        for (const n of all) if (n[0] < a + step && n[1] > a) m |= 1 << (((n[2] % 12) + 12) % 12);
        if (m) chords.push([a, a + step, m]);
      }
    }
    return { notes, chords, lane: lane && lane.id };
  }
  window.purpPlaygroundDebug.ttFeeds = ttFeeds;
  BUILD.kttoytune = (p) => {
    if (!ttEng || !window.KT2ToyTune) return passthrough();
    if (!p.tt) p.tt = KT2ToyTune.fresh();
    const n = ttEng.create({ values: KT2ToyTune.values(p.tt), getTransport: songNow });
    const f = ttFeeds(p);
    n.setNotes(f.notes); n.setChords(f.chords);
    const set0 = n.set;
    n.set = (pid, v) => KT2ToyTune.cardSet(p, n, pid, v) || set0(pid, v);
    n.refeed = () => { const g = ttFeeds(p); n.setNotes(g.notes); n.setChords(g.chords); return g; };
    return n;
  };
  // TOY VOX (24 Nov): the vocal FX on every recording, muted (= card power off) until turned on. Its setup is p.tv
  // (ui/toyvox.js state). KT2_TOYVOX_OFF = not offered, plays dry.
  let tvEng = null;
  if (window.ToyVoxEngine && ctx.audioWorklet && !window.KT2_TOYVOX_OFF)
    window.ToyVoxEngine.load(ctx, "toyvox.wasm").then((e) => (tvEng = e), (e) => console.warn("TOY VOX did not load", e));
  BUILD.kttoyvox = (p) => {
    if (!tvEng || !window.KT2ToyVox) return passthrough();
    if (!p.tv) p.tv = KT2ToyVox.fresh(S.key);
    const n = tvEng.create({ values: KT2ToyVox.values(p.tv), getTransport: songNow });
    const set0 = n.set;
    n.set = (pid, v) => KT2ToyVox.cardSet(p, { set: set0 }, pid, v) || set0(pid, v);   // (the card has a "mix" too: no loop)
    return n;
  };
  // KILLCHAIN (ui/killchain.js): the sidechain. Its inputs are wired at the end of startVoices (sideWire).
  if (window.KillChain) KillChain.load(ctx);
  BUILD.ktside = (p) => (window.KillChain ? KillChain.create(ctx, p, () => ({ bpm: S.bpm, origin: startCtx - startPos })) : passthrough());
  const fxNodes = new Map(); // pluginId -> chain node, for live knobs
  window.purpPlaygroundDebug.fxNodes = fxNodes;   // tests: a keyed card's keyWet gain
  // CORE FX + KILLTIME (ui/kt2-corefx.js, ui/killtime.js): EQ, comp, filter, mod, drive, de-ess, utility, the creative delay
  if (window.KT2CoreFx) KT2CoreFx.install(BUILD, ctx, () => ({ bpm: S.bpm }));
  window.purpPlaygroundDebug.BUILD = BUILD;   // tests (tests/kt2/fxcheck.js): build any effect on its own and measure it

  const keyed = []; // [pump fx, lane id] waiting for that lane to exist, while voices start
  // SIDECHAIN ON ANY EFFECT: an effect with no key of its own gets one. While the key lane plays, the card
  // crossfades from its effect to the dry sound (by p.scAmt, default 70%), then back. KT2_KEYANY_OFF = only Pump.
  function keyAny(fx, p) {
    const input = ctx.createGain(), output = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain();
    dry.gain.value = 0;
    input.connect(fx.input); fx.output.connect(wet); wet.connect(output); input.connect(dry); dry.connect(output);
    let sp = null;
    const key = (node) => {
      sp = ctx.createScriptProcessor(1024, 2, 1);
      const hush = ctx.createGain(); hush.gain.value = 0;
      node.connect(sp); sp.connect(hush); hush.connect(ctx.destination);
      let cur = 0;
      sp.onaudioprocess = (e) => {
        const ib = e.inputBuffer; let sum = 0, n = 0;
        for (let c = 0; c < ib.numberOfChannels; c++) { const d = ib.getChannelData(c); for (let i = 0; i < d.length; i += 2) { sum += d[i] * d[i]; n++; } }
        const db = 10 * Math.log10(Math.max(1e-10, sum / Math.max(1, n)));
        const amt = p.scAmt != null ? p.scAmt : 0.7, want = amt * Math.max(0, Math.min(1, (db + 42) / 24));
        const tc = want > cur ? 0.008 : 0.06;
        wet.gain.setTargetAtTime(1 - want, ctx.currentTime, tc); dry.gain.setTargetAtTime(want, ctx.currentTime, tc);
        cur = want;
      };
    };
    const close = () => { if (sp) { sp.onaudioprocess = null; try { sp.disconnect(); } catch (e) { /* gone */ } } if (fx.close) fx.close(); };
    return { ...fx, input, output, key, close, keyWet: wet };
  }
  function buildEffect(p) {
    let fx = (BUILD[p.type] || passthrough)(p);
    if (p.sidechain && !fx.key && p.type !== "ktside" && !window.KT2_KEYANY_OFF && document.documentElement.classList.contains("kt2")) fx = keyAny(fx, p);
    for (const q of p.params) { const t = fx.set(q.id, q.value); if (t) q.text = t; }
    fxNodes.set(p.id, fx);
    if (p.sidechain && fx.key) keyed.push([fx, p.sidechain]);
    if (p.type === "ktside" && p.side && fx.addKey) { if (sideRun) sideWire(fx, p, sideRun); else sideKeyed.push([fx, p]); }
    return fx;
  }
  // KILLCHAIN inputs: each picked lane's sound (after its effects, before its fader and mute) goes into
  // the effect's key input through a gate that is open only while a picked clip plays (whole lane: always).
  const sideKeyed = [];   // [fx, plugin] built during startVoices, wired once every lane's tap exists
  let sideRun = null;     // { taps, pos, when } of the run that is playing (for effects built later)
  function sideHost(pid) {
    for (const t of S.tracks) if ((t.plugins || []).some((p) => p.id === pid) || t.clips.some((c) => c.plugins.some((p) => p.id === pid))) return t;
    return null;
  }
  // lane -> lanes it listens to (KILLCHAIN + Pump), to never wire a loop (a loop would go silent)
  function keyEdges() {
    const e = new Map();
    const add = (a, b) => { if (!e.has(a)) e.set(a, new Set()); e.get(a).add(b); };
    for (const t of S.tracks) for (const p of [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)]) {
      if (!p.enabled) continue;
      if (p.type === "ktside" && p.side) for (const s of sideSrc(p, t)) add(t.id, s.t);
      if (p.sidechain) add(t.id, p.sidechain);
    }
    return e;
  }
  function reaches(e, from, to, seen = new Set()) {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    for (const n of e.get(from) || []) if (reaches(e, n, to, seen)) return true;
    return false;
  }
  // the input right now: every copy of the picked patterns / sounds (ui/killchain.js expand; KT2_KCHN_PAT_OLD = only the clips clicked)
  const sideSrc = (p, host) => (window.KillChain && KillChain.expand ? KillChain.expand(S, p.side.src, host && host.id) : (p.side.src || []));
  // GHOST (ui/killchain.js): on = muted lanes and muted (turned off) patterns push it down too; off = only what you
  // hear. KT2_KCHN_GHOST_OFF = old (a muted lane pushes it down, a muted pattern never does).
  const kGhostOff = () => !!window.KT2_KCHN_GHOST_OFF;
  const kGhost = (p) => !kGhostOff() && !!(p && p.ghost);
  function sideWire(fx, p, run) {
    const host = sideHost(p.id), edges = keyEdges(), ghost = kGhost(p);
    for (const s of sideSrc(p, host)) {
      const tap = run.taps.get(s.t);
      if (!tap || (host && s.t === host.id)) continue;
      const lane = S.tracks.find((x) => x.id === s.t);
      // a muted lane only counts with GHOST on (a silent key, so it doesn't fall back to ducking on every beat)
      if (!ghost && !kGhostOff() && lane && lane.muted) { const g0 = ctx.createGain(); g0.gain.value = 0; fx.addKey(g0, false); continue; }
      // the input lane listens (through any chain) to this lane: skip it, or the two would go silent
      if (host) { const e2 = new Map(edges); e2.set(host.id, new Set([...(edges.get(host.id) || [])].filter((x) => x !== s.t)));
                  if (reaches(e2, s.t, host.id)) continue; }
      const gate = ctx.createGain();
      if (s.c && s.c.length) {
        const t = S.tracks.find((x) => x.id === s.t);
        gate.gain.value = 0;
        for (const c of (t ? t.clips : []).filter((x) => s.c.includes(x.id) && (ghost || x.active !== false))) {
          const a = c.start - run.pos, b = c.start + c.length - run.pos;
          if (b <= 0) continue;
          if (a <= 0) gate.gain.setValueAtTime(1, Math.max(ctx.currentTime, run.when));
          else gate.gain.setValueAtTime(1, run.when + a);
          gate.gain.setValueAtTime(0, run.when + b);
        }
      }
      tap.connect(gate);
      const gIn = ghost && run.ghost && run.ghost.get(s.t);   // the lane's muted audio clips, heard only by GHOST KILLCHAINs
      if (gIn) gIn.connect(gate);
      // A PATTERN as the input (Eman, 15 Nov: "check the KILLCHAIN so it works when i connect a pattern"): a full
      // drum beat (hats on every 1/16) kept the level detector from ever seeing the kicks, so it hardly ducked.
      // Now a MIDI input ducks on its own notes, right on time: KILLDRUM on its kick + 808 pads (every hit when
      // the pattern has none), any other pattern on every note. Its sound still feeds the picture.
      // Audio inputs keep listening. KT2_KCHN_NOTES_OFF = old (always listen to the sound).
      const hits = !window.KT2_KCHN_NOTES_OFF && fx.addHits ? sideHits(s, run, ghost) : null;
      if (hits) { fx.addKey(gate, false); fx.addHits(hits); } else fx.addKey(gate);
      // GHOST: a muted pattern makes no sound, so its notes draw the grey bars instead (Eman, 16 Nov: "show the
      // waveform even if the input is muted if the ghost is activated"). KT2_KCHN_GHOST_BARS_OFF = no bars.
      if (ghost && fx.addBlips && !window.KT2_KCHN_GHOST_BARS_OFF && !window.KT2_KCHN_NOTES_OFF) { const bl = sideHits(s, run, "only"); if (bl) fx.addBlips(bl); }
    }
  }
  // the song times (as ctx times of this run) a MIDI input's picked patterns hit; null = not a pattern input
  // ghost: muted (turned off) patterns count too; ghost "only": just the muted ones (the picture's bars for them)
  function sideHits(s, run, ghost) {
    const t = S.tracks.find((x) => x.id === s.t);
    if (!t) return null;
    const clips = tempoClips(t).filter((c) => (!s.c || !s.c.length || s.c.includes(c.id)) && (ghost === "only" ? c.active === false : ghost || c.active !== false));
    if (!clips.length || clips.some((c) => c.kind !== "midi")) return null;
    const spb = 60 / S.bpm, isKit = (c) => c.plugins.some((p) => p.instrument && p.kit);
    const all = [], kicks = [];
    for (const c0 of clips) {
      const c = midiView(c0), end = c.start + c.length, kit = isKit(c0);
      for (const n of c.notes || []) {
        if (n.muted) continue;
        const a = c.start + n.start * spb + (c.delay || 0);
        if (a < c.start - 1e-6 || a >= end - 1e-6 || a < run.pos - 1e-4) continue;
        const at = run.when + (a - run.pos);
        all.push(at);
        if (kit && (n.pitch === 36 || n.pitch === 35)) kicks.push(at);
      }
    }
    const pick = (kicks.length ? kicks : all).sort((x, y) => x - y), out = [];
    for (const x of pick) if (!out.length || x - out[out.length - 1] > 0.03) out.push(x);   // a chord = one hit
    return out;
  }

  // ---------------------------------------------------------------------------
  // Transport: clips are scheduled as buffer sources from the play position.
  let voices = [];
  // MIDI clips that start later are only built a moment before they're heard, so a song with
  // 40 TOY MACHINE clips runs a few synths at a time instead of 40 (each one costs the audio
  // thread even when it's silent), and pressing play doesn't build the whole song at once.
  let laterTimers = [];
  const BUILD_AHEAD = 2; // seconds before a clip's start
  const clipVoices = new Map(); // clipId -> { input, srcs }: lets one clip's audio be swapped while playing
  const laneIns = new Map();    // trackId -> the lane's input while playing (for clips whose audio lands late)
  const trackGains = new Map();
  // an instrument lane's own pan (the INST card's PAN, 6 Nov): after its fader; voice lanes pan each clip instead
  const trackPans = new Map();
  const lanePanOf = (t) => ((t.plugins || []).some((p) => p.instrument) ? Math.max(-1, Math.min(1, Number(t.pan) || 0)) : 0);
  const autoGains = new Map();  // trackId -> the gain its volume automation moves (between its effects and its fader)
  const sendGains = new Map();  // trackId -> { A, B }: its sends, after its fader, into the returns
  let startCtx = 0, startPos = 0, clickNext = 0;

  const dbToLin = (db) => (db <= -60 ? 0 : Math.pow(10, db / 20));
  const anySolo = () => S.tracks.some((t) => t.solo);
  // SOLO (KILLDRUM / TOY MACHINE): one lane loops on its own; the rest of the song is silent until it ends
  let laneSolo = null; // { trackId, clipId, notes (what that clip plays instead, or null), prev: transport state to restore }
  // a pattern looping on its own still plays every synth stacked on it (Eman, 4 Nov), unless one is switched off
  const soloRoot = () => { const t = S.tracks.find((x) => x.id === laneSolo.trackId); return (t && t.layerOf) || laneSolo.trackId; };
  // looping one pattern: its stack plays, and an S inside the stack still picks just those synths (Eman, 6 Nov 02:52)
  const inSolo = (t) => t.id === soloRoot() || t.layerOf === soloRoot();
  const audible = (t) => (laneSolo ? inSolo(t) && !t.muted && (!S.tracks.some((x) => x.solo && inSolo(x)) || t.solo) : !t.muted && (!anySolo() || t.solo));
  // MIX page BALANCE (setBalance): the group (bus) a lane plays through and that group's level.
  // Same guess as the MIX page (ui/kt2-mix.js kindOf); t.bus overrides it. A stacked synth follows its main lane.
  function mixBusOf(t) {
    const m = (t.layerOf && S.tracks.find((x) => x.id === t.layerOf)) || t;
    if (m.bus) return m.bus;
    const n = ((m.name || "") + " " + (m.role || "")).toLowerCase();
    if (m.kind === "beat") return "MUSIC";
    if (/808|bass|\bsub\b/.test(n)) return "BASS";
    if (/drum|kick|snare|hat|perc|killdrum|beat/.test(n)) return "DRUMS";
    if (/adlib|ad-lib|vox|vocal|voc\b|lead|double|harm|choir|backs|verse|hook/.test(n)) return "VOX";
    return "MUSIC";
  }
  function mixBusGain(t) {
    const b = S.master && S.master.balance;
    if (!b || window.KT2_MIX_WIRE_OFF) return 1;
    return dbToLin(b[mixBusOf(t)] || 0);
  }
  function updateTrackGains() {
    if (!(S.master && volAuto(S.master) && S.transport.playing)) masterOut.gain.setTargetAtTime(dbToLin((S.master && S.master.volume) || 0), ctx.currentTime, 0.01);   // automated: the ticker moves it
    for (const t of S.tracks) {
      const g = trackGains.get(t.id);
      if (g) g.gain.setTargetAtTime(audible(t) ? (volAuto(t) ? 1 : dbToLin(t.volume || 0)) * mixBusGain(t) : 0, ctx.currentTime, 0.01);
      const tp = trackPans.get(t.id);
      if (tp) tp.pan.setTargetAtTime(lanePanOf(t), ctx.currentTime, 0.01);
      const sg = sendGains.get(t.id);
      if (sg) for (const k of Object.keys(sg)) sg[k].gain.setTargetAtTime((t.sends && t.sends[k]) || 0, ctx.currentTime, 0.01);
      if (sg && sg._pre) sg._pre.gain.setTargetAtTime(audible(t) ? 1 : 0, ctx.currentTime, 0.01);
    }
    for (const r of S.returns || []) { const b = retBus.get(r.id); if (b) b.out.gain.setTargetAtTime(r.muted ? 0 : dbToLin(r.volume || 0), ctx.currentTime, 0.01); }
  }
  // A loop wrap is booked ahead (startCtx in the future): until then the old run's clock counts.
  let wrapPrev = null;
  const position = () => {
    if (!S.transport.playing) return S.transport.position;
    if (wrapPrev && ctx.currentTime < startCtx) return tempoAfter(wrapPrev.pos, ctx.currentTime - wrapPrev.ctx);
    return tempoAfter(startPos, ctx.currentTime - startCtx);
  };

  // ---------------------------------------------------------------------------
  // TEMPO lane (Eman, 11 Nov): the tempo can change inside a song. S.tempo = [{ beat, bpm }]: from that
  // beat (counted from the song's start) the song plays at bpm, until the next point. Before the first
  // point it plays at S.bpm (the BPM box). The grid stays in bars, like a DAW's beat ruler: song time
  // (seconds at S.bpm) is what clips, notes, parts and automation are stored in, and only playback runs
  // faster or slower. Each run maps song time x to heard time W(x). MIDI plays its notes at the new
  // speed; sounds are rendered stretched (same pitch) to fit, one-shots just move to their beat.
  // Recording and SOLO play at the BPM box tempo for now. window.KT2_TEMPO_OFF = old (points ignored).
  let runMap = null;   // the tempo map of the run that's playing (null = one tempo)
  const tempoPoints = () => (window.KT2_TEMPO_OFF || !Array.isArray(S.tempo) ? [] : S.tempo)
    .filter((q) => q && q.beat > 0 && q.bpm >= 20 && q.bpm <= 400).sort((a, b) => a.beat - b.beat);
  // [{ x: song seconds, w: heard seconds, k: heard seconds per song second }], first at 0
  // RAMPS (Eman, 15 Nov: "make the tempo not be hard cuts, make it like smooth"): the tempo glides from
  // one point to the next (the first glide starts at the song start, at the BPM box tempo). A point's
  // `curve` (-1..1) bends the glide that ends at it: above 0 it stays near the old tempo and speeds up
  // late, below 0 it moves early and settles. `step: true` = the old hard jump at that point. A glide is
  // cut into 1/16-beat pieces, each with its exact average speed, so everything that reads the map
  // (playhead, metronome, MIDI, sounds, loops) follows it. window.KT2_TEMPO_RAMP_OFF = old (all steps).
  const tempoShape = (u, c) => Math.pow(Math.max(0, Math.min(1, u)), Math.pow(6, Math.max(-1, Math.min(1, +c || 0))));
  const tempoRampOn = () => !window.KT2_TEMPO_RAMP_OFF && S.tempoMode !== "step";
  function tempoSegs() {
    const pts = tempoPoints(), spb = 60 / S.bpm, out = [{ x: 0, w: 0, k: 1 }];
    const push = (x, k) => {
      const L = out[out.length - 1];
      if (x <= L.x + 1e-9) { L.k = k; return; }
      if (Math.abs(k - L.k) < 1e-9) return;
      out.push({ x, w: L.w + (x - L.x) * L.k, k });
    };
    let pb = 0, pv = S.bpm;
    for (const q of pts) {
      const cv = +q.curve || 0;
      // bent all the way: a hard jump at the end (+1) or right at the start (-1) of the glide
      if (tempoRampOn() && !q.step && cv <= -0.99 && q.beat > pb + 1e-6) push(pb * spb, S.bpm / q.bpm);
      else if (tempoRampOn() && !q.step && cv < 0.99 && Math.abs(q.bpm - pv) > 1e-6 && q.beat > pb + 1e-6) {
        const n = Math.max(1, Math.ceil((q.beat - pb) * 16)), db = (q.beat - pb) / n;
        for (let i = 0; i < n; i++) {
          // the average of S.bpm / bpm over the piece (Simpson), so the heard time adds up exactly
          const f = (u) => S.bpm / (pv + (q.bpm - pv) * tempoShape(u, q.curve));
          const u0 = i / n, u1 = (i + 1) / n;
          push((pb + i * db) * spb, (f(u0) + 4 * f((u0 + u1) / 2) + f(u1)) / 6);
        }
      }
      push(q.beat * spb, S.bpm / q.bpm);
      pb = q.beat; pv = q.bpm;
    }
    return out.length > 1 || Math.abs(out[0].k - 1) > 1e-9 ? out : null;
  }
  // the map can hold thousands of pieces with ramps: look up by halving
  const segIdx = (M, key, v) => { let lo = 0, hi = M.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (M[m][key] <= v + 1e-9) lo = m; else hi = m - 1; } return lo; };
  const segAt = (M, x) => M[segIdx(M, "x", x)];
  const tempoW = (M, x) => { const s = segAt(M, x); return s.w + (x - s.x) * s.k; };
  const tempoX = (M, w) => { const s = M[segIdx(M, "w", w)]; return s.x + (w - s.w) / s.k; };
  const tempoActive = () => !window.KT2_TEMPO_OFF && !S.transport.recording && !laneSolo && tempoPoints().length > 0;
  // where the song is dt heard seconds after song time p0, on the run's map
  const tempoAfter = (p0, dt) => (runMap ? tempoX(runMap, tempoW(runMap, p0) + dt) : p0 + dt);
  // heard seconds from song time a to b
  const tempoSpan = (a, b) => (runMap ? tempoW(runMap, b) - tempoW(runMap, a) : b - a);
  window.KT2Tempo = { segs: tempoSegs, points: tempoPoints, heard: (x) => { const M = tempoSegs(); return M ? tempoW(M, x) : x; },
                      bpmAt: (x) => { const M = tempoSegs(); return M ? S.bpm / segAt(M, x).k : S.bpm; }, run: () => runMap, shape: tempoShape,
                      // for tests: the copies a run from song time p0 would hand the players, and the rendered sounds
                      viewAt: (p0, trackId) => { const was = [runMap, startPos], t = S.tracks.find((x) => x.id === trackId); runMap = tempoSegs(); startPos = p0; try { return t ? tempoClips(t) : null; } finally { [runMap, startPos] = was; } },
                      bufs: () => tempoBufs };
  // A run starting at song time p0 plays everything on a straight clock ("y", heard seconds after p0
  // plus p0), so each clip is handed to the players as a copy with y times: nothing else has to know.
  const tempoY = (x) => startPos + tempoW(runMap, x) - tempoW(runMap, startPos);
  function tempoClips(t) {
    if (!runMap) return t.clips;
    const out = [];
    for (const c of t.clips) { const v = c.kind === "midi" ? tempoMidi(c) : tempoAudio(t, c); if (v) out.push(v); }
    return out;
  }
  function tempoNotes(c, y0, notes) {
    if (!Array.isArray(notes)) return notes;
    const spb = 60 / S.bpm;
    return notes.map((n) => {
      const a = c.start + n.start * spb, b = a + n.length * spb, ya = tempoY(a), yb = tempoY(b);
      return { ...n, start: (ya - y0) / spb, length: Math.max(1e-4, (yb - ya) / spb) };
    });
  }
  function tempoMidi(c) {
    const y0 = tempoY(c.start), y1 = tempoY(c.start + c.length), spb = 60 / S.bpm;
    const v = { ...c, start: y0, length: y1 - y0, notes: tempoNotes(c, y0, c.notes) };
    if (c.beats) v.beats = v.length / spb;
    if (Array.isArray(c.takeNotes)) v.takeNotes = c.takeNotes.map((ns) => tempoNotes(c, y0, ns));
    else if (c.takeNotes && typeof c.takeNotes === "object") v.takeNotes = Object.fromEntries(Object.entries(c.takeNotes).map(([k, ns]) => [k, tempoNotes(c, y0, ns)]));
    if (c.stack) v.stack = Object.fromEntries(Object.entries(c.stack).map(([k, ns]) => [k, tempoNotes(c, y0, ns)]));
    if (c.fadeIn) v.fadeIn = tempoY(c.start + c.fadeIn) - y0;
    if (c.fadeOut) v.fadeOut = y1 - tempoY(c.start + c.length - c.fadeOut);
    return v;
  }
  // a sound: rendered at each part's tempo (made once per sound and map, in the background; the clip
  // joins the song when its render lands). A one-shot keeps its own sound and only moves.
  const tempoBufs = new Map();   // key -> { buf, job }
  function tempoKeyOf(c) {
    const a = c.start, b = c.start + c.length, cuts = runMap.filter((q) => q.x > a + 1e-6 && q.x < b - 1e-6).map((q) => [(q.x - a).toFixed(4), q.k.toFixed(5)]);
    return ["tempo", c.src, c.offset || 0, c.length.toFixed(4), c.take || 0, c.reversed ? 1 : 0, JSON.stringify(c.comp || null), JSON.stringify(c.takeSrc || null), segAt(runMap, a).k.toFixed(5), cuts.length, tempoHash(JSON.stringify(cuts))].join("|");
  }
  const tempoHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  function tempoFlat(c) {   // what the clip plays, as one buffer of its own length (takes, comp, reverse, level baked in)
    const pieces = piecesOf(c, c.audition != null ? c.audition : undefined);
    const first = buffers[takeOf(c, pieces[0].take).src];
    if (!first) return null;
    const sr = first.sampleRate, ch = first.numberOfChannels, n = Math.max(1, Math.round(c.length * sr));
    const out = ctx.createBuffer(ch, n, sr);
    for (const x of pieces) {
      const ts0 = takeOf(c, x.take), raw = buffers[ts0.src];
      if (!raw) continue;
      const buf = c.reversed ? reversedOf(raw) : raw, off = c.reversed ? Math.max(0, buf.duration - (ts0.offset || 0) - c.length) : ts0.offset || 0, g = ts0.gain || 1;
      const i0 = Math.round(x.start * sr), i1 = Math.min(n, Math.round(x.end * sr)), j0 = Math.round((off + x.start) * buf.sampleRate);
      for (let k = 0; k < ch; k++) {
        const src = buf.getChannelData(Math.min(k, buf.numberOfChannels - 1)), dst = out.getChannelData(k);
        for (let i = i0, j = j0; i < i1 && j < src.length; i++, j++) dst[i] = src[j] * g;
      }
    }
    return out;
  }
  const tempoSlice = (buf, a, b) => {
    const sr = buf.sampleRate, i0 = Math.max(0, Math.round(a * sr)), i1 = Math.min(buf.length, Math.round(b * sr)), n = Math.max(1, i1 - i0);
    const out = ctx.createBuffer(buf.numberOfChannels, n, sr);
    for (let k = 0; k < buf.numberOfChannels; k++) out.getChannelData(k).set(buf.getChannelData(k).subarray(i0, i0 + n));
    return out;
  };
  async function tempoRender(c, M) {
    const flat = tempoFlat(c);
    if (!flat) return null;
    if (isOneShot(flat) || (c.fit && c.fit.mode === "hit")) return { hit: true };
    const a = c.start, b = c.start + c.length, parts = [];
    // a glide is many tiny pieces: they are stretched a beat at a time (each with its exact heard
    // length), so the stretcher gets whole chunks to work on and the hits still land on time
    const spans = [], beat = 60 / S.bpm;
    for (let i = 0; i < M.length; i++) {
      const lo = Math.max(a, M[i].x), hi = Math.min(b, i + 1 < M.length ? M[i + 1].x : Infinity);
      if (hi - lo < 1e-4) continue;
      const L = spans[spans.length - 1], ramp = !window.KT2_TEMPO_RAMP_OFF && hi - lo < beat / 8;
      if (L && L.ramp && ramp && L.hi - L.lo < beat - 1e-6) { L.hi = hi; L.w += (hi - lo) * M[i].k; }
      else spans.push({ lo, hi, w: (hi - lo) * M[i].k, ramp });
    }
    for (const sp of spans) {
      const piece = tempoSlice(flat, sp.lo - a, sp.hi - a), rate = (sp.hi - sp.lo) / sp.w;
      parts.push(Math.abs(rate - 1) < 1e-4 ? piece : (await stretchTo(piece, rate)) || piece);
    }
    const sr = flat.sampleRate, ch = flat.numberOfChannels, n = parts.reduce((s, x) => s + x.length, 0), out = ctx.createBuffer(ch, Math.max(1, n), sr);
    let at = 0;
    for (const x of parts) {
      for (let k = 0; k < ch; k++) out.getChannelData(k).set(x.getChannelData(Math.min(k, x.numberOfChannels - 1)).subarray(0, Math.min(x.length, n - at)), at);
      at += x.length;
    }
    return { buf: out };
  }
  function tempoAudio(t, c) {
    const y0 = tempoY(c.start), y1 = tempoY(c.start + c.length);
    const a = c.start, b = c.start + c.length;
    // the same speed all the way (no point inside, and the song plays at the BPM box tempo there): it only moves
    const same = !runMap.some((q) => q.x > a + 1e-6 && q.x < b - 1e-6) && Math.abs(segAt(runMap, a).k - 1) < 1e-9;
    if (same || !buffers[takeOf(c, c.take).src]) return { ...c, start: y0 };
    const key = tempoKeyOf(c);
    let e = tempoBufs.get(key);
    if (!e) {
      const M = runMap;
      e = { buf: null, hit: false, job: null };
      tempoBufs.set(key, e);
      if (tempoBufs.size > 60) tempoBufs.delete(tempoBufs.keys().next().value);
      e.job = tempoRender(c, M).then((r) => {
        if (!r) { tempoBufs.delete(key); return; }
        if (r.hit) e.hit = true; else { e.buf = r.buf; buffers[key] = r.buf; }
        if (S.transport.playing && runMap) softRestart();   // it joins the song now
      }).catch((err) => { console.warn("[tempo]", err); tempoBufs.delete(key); });
      return null;
    }
    if (e.hit) return { ...c, start: y0 };
    if (!e.buf) return null;   // still rendering
    const fi = c.fadeIn ? tempoY(a + c.fadeIn) - y0 : 0, fo = c.fadeOut ? y1 - tempoY(b - c.fadeOut) : 0;
    return { ...c, start: y0, length: Math.min(y1 - y0, e.buf.duration), src: key, offset: 0, take: 0, takes: 0, takeSrc: null, comp: null, audition: null, reversed: false, level: 1, fadeIn: fi, fadeOut: fo };
  }
  // after the tempo map changes: the sounds start rendering right away, so play has them
  function tempoWarm() {
    if (!tempoActive()) return;
    const was = runMap, wasPos = startPos;
    runMap = tempoSegs(); if (!S.transport.playing) startPos = 0;
    try { for (const t of S.tracks) for (const c of t.clips) if (c.kind !== "midi" && c.active !== false) tempoAudio(t, c); }
    finally { if (!S.transport.playing) { runMap = was; startPos = wasPos; } }
  }
  handlers.setTempoMap = ({ points } = {}) => {
    if (!Array.isArray(points)) return { error: "No tempo points." };
    const spb = 60 / S.bpm, end = 2000;
    const clean = points.map((q) => {
      const o = { beat: Math.round((+q.beat || 0) * 1000) / 1000, bpm: Math.round(Math.max(40, Math.min(250, +q.bpm || S.bpm)) * 10) / 10 };
      const cv = Math.round(Math.max(-1, Math.min(1, +q.curve || 0)) * 100) / 100;
      if (cv) o.curve = cv;
      if (q.step) o.step = true;
      return o;
    })
      .filter((q) => q.beat > 0 && q.beat < end && isFinite(q.bpm)).sort((a, b) => a.beat - b.beat)
      .filter((q, i, arr) => i === arr.length - 1 || arr[i + 1].beat - q.beat > 1e-6);
    S.tempo = clean;
    changed(); tempoWarm(); softRestart();
    return { ok: true, points: clean, seconds: spb };
  };
  // STEP / CURVE switch next to TEMPO (Eman, 15 Nov): STEP = hard jumps at every point, CURVE = glides
  handlers.setTempoMode = ({ mode } = {}) => {
    if (mode !== "step" && mode !== "curve") return { error: "Pick STEP or CURVE." };
    S.tempoMode = mode; changed(); tempoWarm(); softRestart();
    return { ok: true, mode };
  };
  handlers.setTempoOpen = ({ open } = {}) => { S.tempoOpen = !!open; changed(); return { ok: true, open: S.tempoOpen }; };
  // TEMPO lane folded to its name row (Eman, 16 Nov): saved with the song
  handlers.setTempoMin = ({ min } = {}) => { S.tempoMin = !!min; changed(); return { ok: true, min: S.tempoMin }; };
  // the song clock on the audio clock, for things that play in time (SAMPLES tab, ui/kt2-samples.js)
  window.purpPlaygroundDebug.songPos = position;

  // ---------------------------------------------------------------------------
  // Automation (lanes drawn under a track; the model is ui/automation.js). A ticker moves
  // what's automated about 40 times a second: the lane's volume (a gain before its fader),
  // effect knobs (the live effect's set()), and TOY MACHINE's Cutoff/Release (hidden macros
  // added to the engine's copy of the preset, see tmInject). Stopped, the values at the marker apply.
  const AUTO = window.KillToyAuto;
  const autoOf = (t) => (t.automation || []).filter((l) => l.points && l.points.length && (!AUTO.fits || AUTO.fits(l, t)));   // a parked line (made on another instrument) doesn't play
  function volAuto(t) { return autoOf(t).find((l) => l.target.type === "volume") || null; }
  const autoVolGain = (lane, at) => dbToLin(AUTO.fracToVol(AUTO.valueAt(lane, at)));
  let autoSent = new WeakMap(); // live effect -> { paramId: last value sent }, so unchanged values aren't sent again
  // Controls held by hand right now (touchAutomation): their lines let go of them until let go.
  const autoHeld = new Set();
  const heldKey = (trackId, target) => trackId + "|" + JSON.stringify([target.type, target.pluginId || null, target.paramId || null, target.param || null]);
  function autoTick() {
    if (!AUTO) return;
    const playing = S.transport.playing, at = position() + (playing ? 0.012 : 0);
    for (const t of [...S.tracks, ...(S.master ? [S.master] : [])]) {
      const lanes = autoOf(t), tid = t === S.master ? "master" : t.id;
      if (!lanes.length) continue;
      for (const lane of lanes) {
        const v = AUTO.valueAt(lane, at), tg = lane.target, held = autoHeld.has(heldKey(tid, tg));
        if (tg.type === "volume") {
          // the master's line moves its fader gain (only while playing; stopped, the fader is what you set)
          const g = t === S.master ? masterOut : autoGains.get(t.id), still = t === S.master && !playing;
          if (g) g.gain.setTargetAtTime(held || still ? dbToLin(t.volume || 0) : autoVolGain(lane, at), ctx.currentTime, 0.008); // held: the fader you're moving
        } else if (held) {
          continue;
        } else if (tg.type === "fx") {
          for (const p of AUTO.plugins(t)) {
            if (!AUTO.isPlugin(p, tg.pluginId)) continue;
            const fx = fxNodes.get(p.id);
            if (!fx) continue;
            const sent = autoSent.get(fx) || {};
            if (sent[tg.paramId] === v) continue;
            sent[tg.paramId] = v; autoSent.set(fx, sent);
            fx.set(tg.paramId, v);
          }
        } else if (tg.type === "synth") {
          for (const sy of tmSynths(t)) tmAutoSet(sy, tg.param, v);
        }
      }
    }
  }
  setInterval(autoTick, 25);
  // TOY MACHINE: the engine's copy of the preset gets one hidden macro per automated field,
  // last in the list so it wins over the preset's own macros. Each runs linearly over FIELD_RANGE
  // (the engine's macro is linear unless both ends are above 0 on a time/frequency path; ours start at 0 or below), so its value is fieldN().
  function tmInject(laneId, preset) {
    const t = S.tracks.find((x) => x.id === laneId), lanes = t ? autoOf(t).filter((l) => l.target.type === "synth" && AUTO.SYNTH[l.target.param] && !autoHeld.has(heldKey(t.id, l.target))) : [];
    if (!lanes.length || !preset) return { preset, idx: null };
    const p = JSON.parse(JSON.stringify(preset)), idx = {};
    p.macros = p.macros || [];
    const at = position();
    for (const l of lanes) {
      const fields = AUTO.SYNTH[l.target.param].fields(AUTO.valueAt(l, at), preset);
      idx[l.target.param] = fields.map(([path, val]) => {
        p.macros.push({ name: "~auto " + path, value: AUTO.fieldN(path, val), targets: [{ param: path, from: AUTO.FIELD_RANGE[path][0], to: AUTO.FIELD_RANGE[path][1] }] });
        return p.macros.length - 1;
      });
      if (l.target.param === "filter.cutoff") p.filter = { ...(p.filter || {}), on: true };
    }
    return { preset: p, idx };
  }
  // Every live engine of a lane goes through this, so window edits keep the automation in.
  function tmWrap(laneId, s, preset) {
    if (!s.__autoWrapped) {
      const orig = s.setPreset;
      s.__autoWrapped = true;
      s.setPreset = (pr) => { s.__autoBase = pr; const r = tmInject(laneId, pr); s.__autoIdx = r.idx; s.__autoLast = {}; s.__padPos = {}; orig(r.preset); };
    }
    if (preset && autoOf(S.tracks.find((x) => x.id === laneId) || {}).some((l) => l.target.type === "synth")) s.setPreset(preset);
    else if (preset) { s.__autoBase = preset; s.__autoIdx = null; }
  }
  function tmAutoSet(s, param, v) {
    const last = s.__autoLast || (s.__autoLast = {});
    if (last[param] === v) return;
    // a macro: moved like its ring; an effect point: moved on the disc (the other axis from the preset or its own line)
    let m = /^macro\.(\d+)$/.exec(param);
    if (m) { last[param] = v; s.setMacro(+m[1], v); return; }
    m = /^pad\.(\d+)\.(?:([a-z]+)\.)?([xy])$/.exec(param);
    if (m) {
      const k = +m[1], pd = s.__autoBase && s.__autoBase.pads && s.__autoBase.pads[k];
      if (!pd || pd.kind === "macro") return;
      // only the kind of point the line was made on (older lines without a kind never drive an arp or gate)
      if (m[2] ? m[2] !== pd.kind : pd.kind === "arp" || pd.kind === "gate") return;
      last[param] = v;
      const pos = (s.__padPos || (s.__padPos = {}))[k] || (s.__padPos[k] = (pd.pos || [0, 0.5]).slice());
      pos[m[3] === "x" ? 0 : 1] = v;
      s.setPad(k, pos[0], pos[1]);
      return;
    }
    const idx = s.__autoIdx && s.__autoIdx[param];
    if (!idx) return;
    last[param] = v;
    AUTO.SYNTH[param].fields(v, s.__autoBase).forEach(([path, val], k) => idx[k] != null && s.setMacro(idx[k], AUTO.fieldN(path, val)));
  }
  // Added or removed synth automation: the lane's engines get their preset again, with or without it.
  function tmAutoRefresh(trackId) {
    const t = S.tracks.find((x) => x.id === trackId);
    if (!t) return;
    for (const sy of tmSynths(t)) if (sy.__autoBase) sy.setPreset(sy.__autoBase);
  }
  handlers.touchAutomation = ({ trackId, target, on }) => {
    const k = heldKey(trackId, target);
    if (on) autoHeld.add(k); else { autoHeld.delete(k); autoSent = new WeakMap(); }
    if (target.type === "synth") {   // the synth's lines let go of (or take back) what's held
      const t = S.tracks.find((x) => x.id === trackId);
      for (const sy of t ? tmSynths(t) : []) { if (sy.__autoBase) sy.setPreset(sy.__autoBase); }
    }
    if (!on) updateTrackGains();
    return { ok: true };
  };
  for (const name of ["addAutomation", "removeAutomation", "setAutomation", "recordAutomation"]) {
    const orig = handlers[name];
    handlers[name] = (args) => { const r = orig(args); if (args && args.trackId) tmAutoRefresh(args.trackId); updateTrackGains(); return r; };
  }

  const kdPreviews = new Map(); // KILLDRUM pad clicks still ringing (pluginId:pitch -> hit)
  function stopVoices() {
    sideRun = null;
    for (const fn of window.KillDrumStopHooks || []) { try { fn(); } catch (e) { console.error(e); } }
    for (const h of kdPreviews.values()) kdCut(h, ctx.currentTime); kdPreviews.clear();
    for (const v of voices) { try { v.stop(); } catch (e) { /* already stopped */ } v.disconnect(); }
    voices = [];
    laterTimers.forEach(clearTimeout); laterTimers = [];
    clipVoices.clear();
    laneIns.clear();
    for (const g of trackGains.values()) g.disconnect();
    trackGains.clear();
    for (const g of autoGains.values()) g.disconnect();
    autoGains.clear();
    for (const sg of sendGains.values()) { sg.A.disconnect(); sg.B.disconnect(); }
    sendGains.clear();
    for (const fx of new Set(fxNodes.values())) if (fx.close) fx.close();   // stops worklet effects for good (a lane's shared chain is listed once per clip)
    fxNodes.clear();
    wireMaster(false);
  }
  // The master's effect cards, in order, between the lanes' sum and the master fader. They are
  // built with the lanes when play starts; stopped, the sum goes straight to the fader.
  let masterChain = [];
  let mixLoudTap = null;   // the MIX page's LUFS meter listens to the lanes' sum here (KT_LOUD)
  function wireMaster(withFx) {
    master.disconnect();
    if (mixLoudTap) master.connect(mixLoudTap);
    for (const fx of masterChain) { try { fx.output.disconnect(); } catch (e) { /* gone */ } }
    masterChain = [];
    let n = master;
    if (withFx) for (const p of (S.master && S.master.plugins) || []) {
      if (!p.enabled || p.instrument) continue;
      const fx = buildEffect(p);
      n.connect(fx.input); n = fx.output;
      masterChain.push(fx);
    }
    n.connect(masterOut);
    wireReturns(withFx);
  }
  // Each return's effect cards, between its input and its fader (same as the master's).
  function wireReturns(withFx) {
    for (const r of S.returns || []) ensureBus(r.id);
    for (const [rid, b] of [...retBus]) if (!/^return[AB]$/.test(rid) && !(S.returns || []).some((r) => r.id === rid)) { try { b.out.disconnect(); } catch (e) {} retBus.delete(rid); }
    for (const [rid, b] of retBus) {
      b.input.disconnect();
      for (const fx of b.chain) { try { fx.output.disconnect(); } catch (e) { /* gone */ } }
      b.chain = [];
      let n = b.input;
      const r = (S.returns || []).find((x) => x.id === rid);
      if (withFx) for (const p of (r && r.plugins) || []) {
        if (!p.enabled || p.instrument) continue;
        const fx = buildEffect(p);
        n.connect(fx.input); n = fx.output;
        b.chain.push(fx);
      }
      n.connect(b.out);
    }
  }

  // TUNR hears a few cycles of the voice before it answers, so its sound comes out
  // about 28 ms late. Clips that go through it start that much earlier (like the app does).
  const fxLead = (list) => (list || []).reduce((a, p) => {
    if (p.enabled && p.type === "kttoytune" && window.ToyTuneEngine && ttEng) {
      const pr = (p.tt && p.tt.prefs) || {};
      return a + ToyTuneEngine.latency(ctx.sampleRate, ["HIGH", "MID", "LOW", "BASS"].indexOf(pr.voice || "MID"), pr.mode === "STUDIO" ? 1 : 0);
    }
    if (p.enabled && p.type === "kttoyvox" && window.ToyVoxEngine && tvEng) return a + ToyVoxEngine.latency(ctx.sampleRate, window.KT2ToyVox ? KT2ToyVox.values(p.tv) : null);
    const T = p.enabled && window.KillToyFx && window.KillToyFx.TYPES[p.type];
    return a + (T && T.latency ? T.latency(ctx.sampleRate) : 0);
  }, 0);

  // A seamless rebuild (Eman, 1 Nov: copying, moving, adding effects while it plays must not
  // glitch): the old sound keeps playing while the new one is built, the song clock carries on
  // (no jump back), the new one starts on that clock and the old one fades out over 30 ms.
  // TOY MACHINE engines keep their sounding notes and only change their queues.
  let softMode = false;
  function retireVoices() {
    const old = { voices, timers: laterTimers, gains: [...trackGains.values()], autos: [...autoGains.values()],
                  sends: [...sendGains.values()], fx: new Set(fxNodes.values()) };
    voices = []; laterTimers = [];
    old.timers.forEach(clearTimeout);
    clipVoices.clear(); laneIns.clear(); trackGains.clear(); autoGains.clear(); sendGains.clear(); fxNodes.clear();
    return old;
  }
  function fadeRetired(old, at) {
    for (const g of [...old.gains, ...old.sends.map((sg) => sg._pre).filter(Boolean)]) { try { g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(g.gain.value, at); g.gain.linearRampToValueAtTime(0, at + 0.03); } catch (e) { /* gone */ } }
    setTimeout(() => {
      for (const v of old.voices) { try { v.stop(); } catch (e) { /* already stopped */ } try { v.disconnect(); } catch (e) { /* gone */ } }
      for (const g of [...old.gains, ...old.autos]) g.disconnect();
      for (const sg of old.sends) { for (const g of Object.values(sg)) g.disconnect(); if (sg._pre) sg._pre.disconnect(); }
      for (const fx of old.fx) if (fx.close) fx.close();
    }, Math.max(0, (at + 0.08 - ctx.currentTime) * 1000));
  }
  function startVoices(pos, soft, at) {
    const old = soft ? retireVoices() : (stopVoices(), null);
    softMode = !!soft;
    keyed.length = 0; sideKeyed.length = 0; sideRun = null;
    wireMaster(true);
    const taps = new Map();
    // GHOST: lanes a GHOST KILLCHAIN listens to; their muted audio clips play into a silent input only it hears
    const ghostLanes = new Set(), ghostIns = new Map();
    if (!kGhostOff()) for (const t of S.tracks) for (const p of [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins || [])])
      if (p.type === "ktside" && p.enabled !== false && p.side && kGhost(p)) for (const s of sideSrc(p, t)) ghostLanes.add(s.t);
    const lead = Math.max(0, ...S.tracks.flatMap((t) => t.clips.map((c) => fxLead(c.plugins) + fxLead(t.plugins))));
    let when = ctx.currentTime + 0.03 + lead;
    wrapPrev = null;
    if (at != null) {
      // a booked loop wrap: start exactly when the old run reaches the loop end, so every pass
      // is the same length (before, each wrap came 30-70 ms late and the loop drifted)
      if (at >= ctx.currentTime + 0.005 + lead) { wrapPrev = { ctx: startCtx, pos: startPos }; when = at; }
      else pos += when - at;
      if (old) fadeRetired(old, when);
    } else if (old) { pos += when - ctx.currentTime; fadeRetired(old, when); }   // the song has moved on by then
    startCtx = when; startPos = pos;
    runMap = tempoActive() ? tempoSegs() : null;   // TEMPO lane: this run's map
    pgCheck(); updatePgGain();
    clickNext = Math.ceil(pos / clickStepLen() - 1e-6);
    // each bus plays into the master; a GROUP holding only PRODUCE sounds plays into the PLAYGROUND bus instead,
    // so RECORD's PLAYGROUND volume and mute still reach them
    for (const r of S.returns || []) {
      const b = ensureBus(r.id), mem = busIsGroup(r) ? S.tracks.filter((t) => ((t.sends && t.sends[busLetter(r.id)]) || 0) > 0) : [];
      const to = mem.length && !mem.some((t) => pgVoice(t)) ? pgIn : master;
      if (b.to !== to) { try { b.out.disconnect(); } catch (e) {} b.out.connect(to); b.to = to; }
    }
    for (const t of S.tracks) {
      const tg = ctx.createGain();
      tg.gain.value = audible(t) ? (volAuto(t) ? 1 : dbToLin(t.volume || 0)) * mixBusGain(t) : 0;
      const tp = ctx.createStereoPanner();
      tp.pan.value = lanePanOf(t);
      // a lane in a GROUP bus goes into that bus instead of the master (the first group it's in)
      const grp = (S.returns || []).find((r) => busIsGroup(r) && ((t.sends && t.sends[busLetter(r.id)]) || 0) > 0);
      tg.connect(tp); tp.connect(grp ? ensureBus(grp.id).input : pgVoice(t) ? master : pgIn);
      trackGains.set(t.id, tg); trackPans.set(t.id, tp);
      // volume automation: its own gain before the fader (the line replaces the fader while it's there)
      const ag = ctx.createGain();
      const va = volAuto(t);
      ag.gain.value = va ? autoVolGain(va, pos) : 1;
      ag.connect(tg);
      autoGains.set(t.id, ag);
      // its sends, after the fader (so mute and solo silence them too). PRE-FADER sends (t.sendsPre[letter], Eman's
      // list 11 Nov; KT2_BUS_OFF = none) take the sound before the fader: the fader doesn't change them, mute still does
      if (S.returns) {
        const sg = {};
        let pm = null;
        for (const r of S.returns) {
          if (busIsGroup(r)) continue;
          const k = busLetter(r.id); sg[k] = ctx.createGain(); sg[k].gain.value = (t.sends && t.sends[k]) || 0;
          if (t.sendsPre && t.sendsPre[k] && !window.KT2_BUS_OFF) {
            if (!pm) { pm = ctx.createGain(); pm.gain.value = audible(t) ? 1 : 0; ag.connect(pm); }
            pm.connect(sg[k]);
          } else tg.connect(sg[k]);
          sg[k].connect(ensureBus(r.id).input);
        }
        if (pm) Object.defineProperty(sg, "_pre", { value: pm, enumerable: false });
        sendGains.set(t.id, sg);
      }
      // The lane's own effects: every clip on it goes through these, after its clip effects.
      const laneIn = ctx.createGain();
      let ln = laneIn;
      // KILLCHAIN ON STACKED SYNTHS (Eman, 26 Nov: "i dont hear it working"): a stacked synth is a lane of its own, so a
      // KILLCHAIN on the main synth (its pattern or its lane) ducked only synth 1 and synth 2 kept playing over it. Each
      // stacked synth now gets its own copy of the main synth's KILLCHAINs (same settings and input, no picture), first
      // in its chain. KT2_KCHN_LAYERS_OFF = only the synth it sits on ducks.
      if (t.layerOf && !window.KT2_KCHN_LAYERS_OFF && window.KillChain) {
        const m = S.tracks.find((x) => x.id === t.layerOf), seen = new Set();
        for (const p of m ? [...(m.plugins || []), ...m.clips.filter((c) => c.kind === "midi").flatMap((c) => c.plugins)] : []) {
          if (p.type !== "ktside" || !p.enabled || !p.side || seen.has(p.id)) continue;
          seen.add(p.id);
          const fx = BUILD.ktside(p);
          if (!fx.addKey) continue;
          if (fx.input && fx.input.port) fx.input.port.onmessage = null;   // the card's picture stays the main synth's
          for (const q of p.params) fx.set(q.id, q.value);
          fxNodes.set(p.id + ":L" + t.id, fx);
          ln.connect(fx.input); ln = fx.output;
          if (sideRun) sideWire(fx, p, sideRun); else sideKeyed.push([fx, p]);
        }
      }
      for (const p of t.plugins || []) {
        if (!p.enabled || p.instrument) continue;
        const fx = buildEffect(p);
        ln.connect(fx.input); ln = fx.output;
      }
      ln.connect(ag);
      taps.set(t.id, ln);   // what a Pump on another lane hears when it follows this one
      laneIns.set(t.id, laneIn);
      const tmClips = [], blobClips = [];
      for (const c of tempoClips(t)) {
        if (c.active === false && c.kind !== "midi" && ghostLanes.has(t.id) && c.start + c.length > pos && buffers[takeOf(c, c.take).src]) {
          let gIn = ghostIns.get(t.id);
          if (!gIn) { gIn = ctx.createGain(); ghostIns.set(t.id, gIn); }
          startClip(t, c, pos, when, gIn, (c.delay || 0) - fxLead(c.plugins) - fxLead(t.plugins));
          continue;
        }
        if (c.active === false) continue;   // turned off (0)
        const delay = (c.delay || 0) - fxLead(c.plugins) - fxLead(t.plugins);
        if (c.kind === "midi") {
          if (c.start + c.length <= pos && !(laneSolo && laneSolo.clipId === c.id && (laneSolo.notes || laneSolo.tile) && S.loopEnd > pos)) continue; // SOLO may run past the clip
          if (c.plugins.some(isTM)) { tmClips.push(c); continue; }   // one engine for the lane (playTMLane)
          if (c.plugins.some(isBLOB)) { blobClips.push(c); continue; }   // BLOB: one engine for the lane too (playBlobLane)
          const wait = (when + (c.start - pos) - BUILD_AHEAD - ctx.currentTime) * 1000;
          if (wait <= 0) playMidi(c, pos, when, laneIn);
          else laterTimers.push(setTimeout(() => playMidi(c, pos, when, laneIn), wait)); // its notes are still ahead, on the same clock
          continue;
        }
        if (c.start + c.length <= pos || !buffers[takeOf(c, c.take).src]) continue;
        startClip(t, c, pos, when, laneIn, delay);
      }
      // a STACKED synth (Eman, 1 Nov): this lane has no patterns of its own; it plays its main
      // lane's patterns with its own TOY MACHINE, octave, effects and fader, all at the same time
      if (t.layerOf) {
        const m = S.tracks.find((x) => x.id === t.layerOf), L = tmPlugins(t)[0];
        if (m && L && L.enabled !== false) for (const c of tempoClips(m)) {
          // threaded (default): the main pattern's notes; thread cut: its own notes in this pattern (c.stack)
          const own = t.linked === false;
          // (Eman, 16 Nov: a synth added next to KILLDRUM has its own notes, so it plays on a drum pattern too;
          // a threaded one still needs a TOY MACHINE pattern. KT2_KD_NOSTACK_OLD = only on TOY MACHINE patterns)
          if (c.kind !== "midi" || c.active === false || (!c.plugins.some(isTM) && !(own && !window.KT2_KD_NOSTACK_OLD)) || c.start + c.length <= pos) continue;
          tmClips.push({ ...c, plugins: [L], gain: 0, fadeIn: 0, fadeOut: 0, _oct: t.oct || 0,
                         ...(own ? { notes: (c.stack && c.stack[t.id]) || [], takeNotes: undefined, _stack: t.id } : {}) });
        }
      }
      if (tmClips.length) playTMLane(t, tmClips, pos, when, laneIn);
      if (blobClips.length) playBlobLane(t, blobClips, pos, when, laneIn);
    }
    // Pumps that follow a lane: plug that lane's sound (after its effects, before its fader
    // and mute, so a muted ghost kick still works) into the Pump's sidechain input.
    for (const [fx, id] of keyed) if (taps.has(id)) fx.key(taps.get(id));
    sideRun = { taps, pos, when, ghost: ghostIns };
    for (const [fx, p] of sideKeyed) sideWire(fx, p, sideRun);
    sideKeyed.length = 0;
  }
  // One audio clip's voice: its volume, fades, pan and effects into its lane.
  function startClip(t, c, pos, when, laneIn, delay) {
    // input = the clip's volume (its gain line), then its fades, pan and effects.
    const input = ctx.createGain(), fade = ctx.createGain();
    input.gain.value = dbToLin(c.gain || 0);
    input.connect(fade);
    scheduleFades(fade, c, pos, when + delay);
    let node = fade;
    if (c.pan) { const pn = ctx.createStereoPanner(); pn.pan.value = c.pan; node.connect(pn); node = pn; }
    for (const p of c.plugins) {
      if (!p.enabled) continue;
      const fx = buildEffect(p);
      node.connect(fx.input); node = fx.output;
    }
    node.connect(laneIn);
    const cv = { input, srcs: [] };
    clipVoices.set(c.id, cv);
    // The Tune editor's live preview replaces the clip's audio while it is open.
    const pv = tunePreview.get(c.id);
    if (pv && pv.buf) { playPreview(c, pv.buf, pos, when, cv); return; }
    // Each comp piece plays its own take, with a 10 ms crossfade where takes meet.
    const pieces = piecesOf(c, c.audition != null ? c.audition : undefined), X = 0.01; // a take being listened to plays whole
    pieces.forEach((x, k) => {
      const ts0 = takeOf(c, x.take), buf = c.reversed ? reversedOf(buffers[ts0.src]) : buffers[ts0.src];
      // reversed: clip time x reads the source at offset + length - x, so the reversed copy starts at duration - offset - length
      const ts = c.reversed && buf ? { ...ts0, offset: Math.max(0, buf.duration - (ts0.offset || 0) - c.length) } : ts0;
      const a = c.start + x.start - (k ? X : 0), b = c.start + x.end + (k < pieces.length - 1 ? X : 0);
      if (!buf || b <= pos) return;
      const from = Math.max(a, pos);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain(), at = when + (from - pos) + delay, endAt = when + (b - pos) + delay, gain = ts.gain || 1;
      if (k && from === a) { g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 2 * X); }
      else g.gain.setValueAtTime(gain, at);
      if (k < pieces.length - 1) { g.gain.setValueAtTime(gain, Math.max(at, endAt - 2 * X)); g.gain.linearRampToValueAtTime(0, endAt); }
      src.connect(g); g.connect(input);
      src.start(at, Math.max(0, ts.offset + (from - c.start)), b - from);
      voices.push(src); cv.srcs.push(src);
    });
  }
  // Reverse (ui/arrange.js): a backwards copy of a file's audio, made once.
  const reversedBufs = new WeakMap();
  function reversedOf(buf) {
    if (!buf) return buf;
    let r = reversedBufs.get(buf);
    if (!r) {
      r = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) r.getChannelData(ch).set(buf.getChannelData(ch).slice().reverse());
      reversedBufs.set(buf, r);
    }
    return r;
  }
  // A file that finishes downloading while the song plays: its clips start right where the song is.
  function lateStart(k) {
    if (!S.transport.playing || !laneIns.size) return;
    const x = position() + 0.05, when = ctx.currentTime + 0.05, pos = runMap ? tempoY(x) : x;   // TEMPO lane: the run's straight clock
    for (const t of S.tracks) for (const c of tempoClips(t)) {
      if (c.kind === "midi" || c.active === false || clipVoices.has(c.id) || c.start + c.length <= pos || !laneIns.has(t.id)) continue;
      if (!piecesOf(c, c.audition != null ? c.audition : undefined).some((x) => takeOf(c, x.take).src === k) || !buffers[takeOf(c, c.take).src]) continue;
      startClip(t, c, pos, when, laneIns.get(t.id), (c.delay || 0) - fxLead(c.plugins) - fxLead(t.plugins));
    }
  }

  // A MIDI clip's volume dot and fades (KILLTOY 2, Eman 31 Oct): its notes play softer by the
  // clip gain and by the fade level where each note starts. Returns a copy only when needed.
  function midiLevel(c) {
    if (!c.notes) return c;
    // muted notes (out of key while ONLY KEY is on, Eman 31 Oct) stay in the clip but never play
    if (c.notes.some((n) => n.muted)) c = { ...c, notes: c.notes.filter((n) => !n.muted) };
    return c;   // the clip's volume and fades are a real gain ramp on its sound now (midiLevelNode), not velocity
  }
  // A MIDI clip's volume dot and fades on its own sound (Eman, 31 Oct: "the fade down didn't work"):
  // velocity alone barely changes a synth, so the clip's chain gets a gain with the fade ramps on it.
  function midiLevelNode(c, input, pos, when) {
    if (!c.gain && !c.fadeIn && !c.fadeOut) return input;
    const g = ctx.createGain(), f = ctx.createGain();
    g.gain.value = dbToLin(c.gain || 0);
    scheduleFades(f, c, pos, when);
    f.connect(g); g.connect(input);
    return f;
  }
  // Fade in/out as gain ramps, from song time `pos` (heard at ctx time `when`).
  function scheduleFades(node, c, pos, when) {
    const fi = c.fadeIn || 0, fo = c.fadeOut || 0, a = c.start, b = c.start + c.length;
    if (!fi && !fo) return;
    const T = (s) => when + (s - pos), from = Math.max(pos, a);
    const lvl = (s) => Math.max(0, Math.min(1, fi > 0 ? (s - a) / fi : 1, fo > 0 ? (b - s) / fo : 1));
    node.gain.setValueAtTime(lvl(from), T(from));
    if (fi > 0 && a + fi > from) node.gain.linearRampToValueAtTime(lvl(a + fi), T(a + fi));
    if (fo > 0) {
      if (b - fo > from) node.gain.setValueAtTime(lvl(b - fo), T(b - fo));
      node.gain.linearRampToValueAtTime(0, T(b));
    }
  }

  // Plays a clip from one finished buffer (the tuning preview), from song time `pos`.
  function playPreview(c, buf, pos, when, cv, fade = 0) {
    const from = Math.max(c.start, pos), end = c.start + Math.min(c.length, buf.duration);
    if (end <= from) return;
    const src = ctx.createBufferSource(), g = ctx.createGain(), at = when + (from - pos) + (c.delay || 0);
    src.buffer = buf;
    if (fade) { g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + fade); }
    src.connect(g); g.connect(cv.input);
    src.start(at, from - c.start, end - from);
    voices.push(src); cv.srcs.push(src);
  }

  // Tune editor live preview: moved notes are pitch-shifted on their own (cached per note),
  // spliced into the clip's audio, and only that clip's sound is swapped while it plays.
  const tunePreview = new Map(); // clipId -> { base, buf, cache }
  function tuneRegions(p, notes) {
    const base = p.base, sr = base.sampleRate, out = ctx.createBuffer(base.numberOfChannels, base.length, sr);
    for (let ch = 0; ch < base.numberOfChannels; ch++) out.getChannelData(ch).set(base.getChannelData(ch));
    const F = Math.floor(0.012 * sr);
    for (const n of notes) {
      const ratio = Math.pow(2, (n.target - n.midi) / 12);
      const a = Math.max(0, Math.floor((n.start - 0.03) * sr)), z = Math.min(base.length, Math.floor((n.end + 0.03) * sr));
      if (z - a < 2 * F) continue;
      const k = a + "|" + z + "|" + ratio.toFixed(5);
      let sh = p.cache.get(k);
      if (!sh) {
        const sub = ctx.createBuffer(base.numberOfChannels, z - a, sr);
        for (let ch = 0; ch < base.numberOfChannels; ch++) sub.getChannelData(ch).set(base.getChannelData(ch).subarray(a, z));
        sh = shiftPitch(sub, () => ratio);
        if (p.cache.size > 300) p.cache.clear();
        p.cache.set(k, sh);
      }
      for (let ch = 0; ch < base.numberOfChannels; ch++) {
        const y = out.getChannelData(ch), x = sh.getChannelData(ch);
        for (let i = 0; i < z - a; i++) {
          const w = Math.min(1, i / F, (z - a - 1 - i) / F);
          y[a + i] = y[a + i] * (1 - w) + x[i] * w;
        }
      }
    }
    return out;
  }
  handlers.previewTune = ({ clipId, notes }) => {
    const c = findClip(clipId);
    if (!c) return { ok: false };
    let p = tunePreview.get(clipId);
    if (!notes) { tunePreview.delete(clipId); if (!p) return { ok: true }; }
    else {
      if (!p) { p = { base: segment(c), cache: new Map() }; tunePreview.set(clipId, p); }
      p.buf = notes.length ? tuneRegions(p, notes) : p.base;
    }
    const cv = clipVoices.get(clipId);
    if (S.transport.playing && cv) { // swap just this clip's sound, with a tiny fade
      const when = ctx.currentTime + 0.01, pos = position() + 0.01;
      for (const v of cv.srcs) { try { v.stop(when + 0.008); } catch (e) { /* already stopped */ } }
      cv.srcs = [];
      if (notes) playPreview(c, p.buf, pos, when, cv, 0.008);
      else restartIfPlaying();
    }
    return { ok: true };
  };

  // u wanna instruments (V9): browser copies of the numpy synths in u-wanna/scripts/build.py,
  // so the 808 and Lead lanes can be edited as notes and still sound like the rendered layers.
  // Both are additive tones from the overtones measured on the original (harm.json), played as
  // PeriodicWaves, through the same effects Pedalboard ran (JUCE filters and Freeverb, matched
  // sample for sample). The 808 is one voice: a note that overlaps the one before it slides
  // there, a note that only touches it retriggers. The lead is one voice made wide with a
  // delayed, high-passed side signal (mid/side), like build.py.
  const UW = {
    h808: [1,0.08814,0.09227,0.01221,0.02624,0.01864,0.009541,0.005413,0.007769,0.007635,0.006949,0.002132,0.004858,0.004008,0.001752,0.001123,0.000552,0.0006321,0.0007424,0.0003846,0.001217,0.0005815,0.0004432,0.000352,0.0004764,0.000276,0.0004931,0.0002093,0.0004911,0.0001929,0.0004532,0.0003301,0.0002376,0.0002283,0.0002067,0.0002903,0.0002705,0.0002294,0.0001156,0.0001151],
    lead: {
      61: [0.1102,0.001407,0.01353,0.0003054,0.01067,0.0002456,0.004485,6.651e-05,0.002364,6.707e-05,0.00137,5.496e-05,0.001165,5.424e-05,0.001314,5.714e-05,0.0009917,9.716e-05,0.0008321,6.066e-05,0.0007802,7.825e-05,0.0005936,5.112e-05,0.0003885,4.566e-05,0.0003443,4.063e-05,0.0002778,3.971e-05,0.0002039,6.34e-05,0.000178,3.47e-05,0.0001606,4.298e-05,0.0001342,4.431e-05,0.0001107,4.87e-05,0.0001181,3.538e-05,9.46e-05,3.582e-05,9.524e-05,3.262e-05,6.501e-05,3.009e-05,7.549e-05,7.194e-05,7.194e-05,2.707e-05,1.811e-05,1.893e-05,2.17e-05,2.351e-05,2.164e-05],
      57: [0.1463,0.002893,0.01231,0.0003202,0.007973,0.0002326,0.005854,7.92e-05,0.003804,7.729e-05,0.002108,5.805e-05,0.001127,5.566e-05,0.0009647,5.43e-05,0.001025,9.77e-05,0.0008254,6.115e-05,0.0007686,5.694e-05,0.0007734,7.987e-05,0.0006376,7.709e-05,0.0006535,8.832e-05,0.0004941,6.485e-05,0.0003614,6.323e-05,0.00027,6.767e-05,0.0002121,0.0001663,0.0001576,4.637e-05,0.0001656,4.647e-05,0.000157,4.009e-05,0.0001358,3.498e-05,0.0001128,5.957e-05,0.0001191,4.778e-05,0.0001054,5.396e-05,9.355e-05,3.483e-05,8.551e-05,4.455e-05,8.919e-05,3.576e-05,7.3e-05,3.742e-05,7.356e-05,3.618e-05,5.201e-05,3.844e-05,6.803e-05,6.803e-05,5.622e-05,2.219e-05,1.616e-05,1.502e-05,3.198e-05,3.411e-05,2.466e-05,1.843e-05],
      54: [0.08973,0.004146,0.007498,0.0006932,0.01014,0.0002931,0.008835,0.0001279,0.002967,6.148e-05,0.002388,6.096e-05,0.002061,4.962e-05,0.001437,0.0001081,0.001315,6.449e-05,0.001185,5.649e-05,0.001043,6.785e-05,0.001014,6.463e-05,0.0008335,7.184e-05,0.0008835,8.488e-05,0.0007656,8.508e-05,0.0007499,7.509e-05,0.0005487,7.416e-05,0.0004839,8.783e-05,0.000373,6.461e-05,0.000332,5.94e-05,0.0003048,6.294e-05,0.0002555,5.292e-05,0.0001904,4.667e-05,0.0001408,8.478e-05,0.0001781,4.864e-05,0.0001497,4.702e-05,0.000132,5.272e-05,9.852e-05,6.137e-05,0.0001033,4.623e-05,0.0001099,6.028e-05,9.671e-05,4.104e-05,8.355e-05,8.041e-05,8.041e-05,4.374e-05,9.197e-05,9.197e-05,5.364e-05,6.156e-05,6.033e-05,7.427e-05,7.001e-05,7.001e-05,5.292e-05,6.039e-05,5.979e-05,5.395e-05,1.374e-05,1.695e-05,1.988e-05,2.386e-05,2.398e-05,2.566e-05,2.034e-05,2.104e-05],
    },
    pre808: 0.3249,    // tone peak into the drive at velocity 127 (the bass stem's level)
    gain808: 1.384,   // level after the drive and EQ, matched to the 808 layer
    gainLead: 0.7583, // matched to the Lead layer
  };
  // Their knobs. On the wire every knob is 0..1; "map" turns that into the real value.
  // The defaults are the recipe in build.py, so a fresh lane sounds like the render.
  const lin = (a, b) => ({ to: (v) => a + v * (b - a), from: (x) => (x - a) / (b - a) });
  const expo = (a, b) => ({ to: (v) => a * Math.pow(b / a, v), from: (x) => Math.log(x / a) / Math.log(b / a) });
  const fDb = (x) => (x > 0.05 ? "+" : "") + x.toFixed(1) + " dB", fMs = (x) => Math.round(x * 1000) + " ms";
  const fPct = (x) => Math.round(x * 100) + "%", fTone = (x) => (Math.abs(x) < 0.02 ? "0" : (x > 0 ? "+" : "") + Math.round(x * 100));
  const UW_KNOBS = {
    "808": [
      { id: "tone", name: "Tone", map: lin(-1, 1), def: 0, fmt: fTone },
      { id: "drive", name: "Drive", map: lin(0, 24), def: 4, fmt: fDb },
      { id: "knock", name: "Knock", map: lin(-6, 12), def: 4, fmt: fDb }, // the 560 Hz bump, heard on small speakers
      { id: "slide", name: "Slide", map: expo(0.01, 0.4), def: 0.075, fmt: fMs },
      { id: "attack", name: "Attack", map: expo(0.003, 0.4), def: 0.07, fmt: fMs },
      { id: "release", name: "Release", map: expo(0.005, 0.6), def: 0.02, fmt: fMs },
      { id: "retrig", name: "Retrigger", map: lin(0, 1), def: 0.7, fmt: fPct }, // how far a new hit dips the one before
      { id: "level", name: "Level", map: lin(-24, 12), def: 0, fmt: fDb },
    ],
    lead: [
      { id: "tone", name: "Tone", map: lin(-1, 1), def: 0, fmt: fTone },
      { id: "width", name: "Width", map: lin(0, 1.5), def: 0.85, fmt: fPct },
      { id: "body", name: "Body", map: lin(-6, 12), def: 6, fmt: fDb }, // the 620 Hz bump
      { id: "attack", name: "Attack", map: expo(0.001, 0.1), def: 0.01, fmt: fMs },
      { id: "release", name: "Release", map: expo(0.005, 0.3), def: 0.035, fmt: fMs },
      { id: "reverb", name: "Reverb", map: lin(0, 0.5), def: 0.12, fmt: fPct },
      { id: "level", name: "Level", map: lin(-24, 12), def: 0, fmt: fDb },
    ],
  };
  const uwKindOf = (name) => (/u wanna 808/i.test(name) ? "808" : /u wanna lead/i.test(name) ? "lead" : /killtoy synth/i.test(name) ? "kt" : null);
  // A lane with a KILLTOY Synth recipe ("synth") plays it when its own instrument (e.g. TOY MACHINE) isn't here.
  const uwKind = (c) => { const p = c.plugins.find((x) => x.instrument); return p ? uwKindOf(p.name) || (p.synth && !p.kit ? "kt" : null) : null; };
  const uwParams = (kind) => UW_KNOBS[kind].map((k) => ({ id: "uw:" + k.id, name: k.name, value: k.map.from(k.def), def: k.map.from(k.def), text: k.fmt(k.def) }));
  // Gives a u wanna instrument its knobs (once), wherever it was made.
  function uwEnsure(p) {
    const kind = p && p.instrument ? uwKindOf(p.name) : null;
    if (kind && !(p.params || []).some((x) => x.id.startsWith("uw:"))) p.params = uwParams(kind);
    return kind;
  }
  function uwSettings(c, kind) {
    const p = c.plugins.find((x) => x.instrument), out = {};
    for (const k of UW_KNOBS[kind]) {
      const prm = p && p.params && p.params.find((x) => x.id === "uw:" + k.id);
      out[k.id] = prm ? k.map.to(Number(prm.value)) : k.def;
    }
    return out;
  }
  const uwCache = new Map();
  // Tone tilts the overtones: + brighter, - darker, 0 = as measured.
  function uwWave(key, amps, cut, tilt, normalize = key === "808") {
    const k = key + "|" + cut + "|" + tilt.toFixed(3) + "|" + normalize;
    if (uwCache.has(k)) return uwCache.get(k);
    const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => { if (i + 1 <= cut) im[i + 1] = a * Math.pow(i + 1, tilt); });
    let peak = 1;
    if (normalize) { // the 808's tone is scaled to peak 1 before the drive, like build.py does
      peak = 0;
      for (let i = 0; i < 2048; i++) { const t = (2 * Math.PI * i) / 2048; let v = 0; for (let h = 1; h < im.length; h++) v += im[h] * Math.sin(h * t); peak = Math.max(peak, Math.abs(v)); }
      for (let h = 1; h < im.length; h++) im[h] /= peak;
    }
    const w = ctx.createPeriodicWave(re, im, { disableNormalization: true });
    uwCache.set(k, w);
    return w;
  }
  function uwShaper(db) {
    const key = "tanh" + db.toFixed(2);
    if (uwCache.has(key)) return uwCache.get(key);
    const n = 8192, k = Math.pow(10, db / 20), curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = Math.tanh(k * ((2 * i) / (n - 1) - 1));
    uwCache.set(key, curve);
    return curve;
  }
  // JUCE's filters, as Pedalboard runs them (HighpassFilter, PeakFilter, LowShelfFilter), as IIR filters.
  function juceFilter(type, f, q, db) {
    // FAST PLAY (16 Nov, deep debug): making an IIR filter node costs the browser 3 to 40 ms each, and a song makes
    // dozens every time play is pressed (half a second of frozen screen on LUCIFOR). The peak and the Butterworth
    // high-pass are exactly the browser's own "peaking" and "highpass" biquads (same formulas), which cost 0.03 ms.
    // window.KT2_IIR_OLD = true: IIR nodes for all of them, as before.
    if (!window.KT2_IIR_OLD && (type === "peak" || type === "butterhp")) {
      const n = ctx.createBiquadFilter();
      if (type === "peak") { n.type = "peaking"; n.frequency.value = f; n.Q.value = q; n.gain.value = db; }
      else { n.type = "highpass"; n.frequency.value = f; n.Q.value = 20 * Math.log10(Math.SQRT1_2); }   // Q is in dB here: -3.01 dB = Butterworth
      return n;
    }
    const sr = ctx.sampleRate, w = (2 * Math.PI * f) / sr, A = Math.sqrt(Math.pow(10, db / 20));
    let b, a;
    if (type === "hp1") { const n = 1 / Math.tan((Math.PI * f) / sr); b = [n, -n]; a = [n + 1, 1 - n]; }
    else if (type === "butterhp") { // 2nd-order Butterworth (scipy's butter, used for the lead's side signal)
      const K = Math.tan((Math.PI * f) / sr), r = Math.SQRT2;
      b = [1, -2, 1]; a = [1 + r * K + K * K, 2 * (K * K - 1), 1 - r * K + K * K];
    }
    else if (type === "peak") {
      const al = Math.sin(w) / (q * 2), c2 = -2 * Math.cos(w);
      b = [1 + al * A, c2, 1 - al * A]; a = [1 + al / A, c2, 1 - al / A];
    } else { // lowshelf
      const am = A - 1, ap = A + 1, co = Math.cos(w), beta = (Math.sin(w) * Math.sqrt(A)) / q, amc = am * co;
      b = [A * (ap - amc + beta), A * 2 * (am - ap * co), A * (ap - amc - beta)]; a = [ap + amc + beta, -2 * (am + ap * co), ap + amc - beta];
    }
    const make = () => ctx.createIIRFilter(b.map((x) => x / a[0]), a.map((x) => x / a[0]));
    // FAST PLAY 2 (16 Nov): the filters that must stay IIR nodes (the 1st-order high-pass, the low shelf) are made
    // ahead of time. Every start of playback asks for the same ones, so after a start the same set is made again
    // in the background, one at a time while nothing else happens, and the next start just takes them.
    // A node is only ever used once (it is never taken back). window.KT2_IIR_POOL_OFF = true: made on the spot.
    if (window.KT2_IIR_POOL_OFF) return make();
    const key = type + "|" + f + "|" + q + "|" + db + "|" + sr;
    iirAsked.push({ key, make });
    clearTimeout(iirTimer); iirTimer = setTimeout(iirRefill, 350);
    const have = iirPool.get(key);
    return have && have.length ? have.pop() : make();
  }
  const iirPool = new Map(); let iirAsked = [], iirTimer = 0, iirBusy = false, iirWant = new Map();
  function iirRefill() {
    // what the last start asked for, by kind: have that many of each ready (64 nodes at most in all)
    const want = iirWant = new Map();
    for (const x of iirAsked.slice(-64)) { const w = want.get(x.key) || { n: 0, make: x.make }; w.n++; want.set(x.key, w); }
    iirAsked = [];
    for (const k of [...iirPool.keys()]) if (!want.has(k)) iirPool.delete(k);
    if (iirBusy) return;
    const step = () => {
      const want = iirWant;   // (a newer start may have changed what is wanted while this was going)
      for (const [k, w] of want) {
        const have = iirPool.get(k) || []; if (!iirPool.has(k)) iirPool.set(k, have);
        if (have.length < w.n) { try { have.push(w.make()); } catch (e) { want.delete(k); } (window.requestIdleCallback || setTimeout)(step, { timeout: 500 }); return; }
      }
      iirBusy = false;
    };
    iirBusy = true; (window.requestIdleCallback || setTimeout)(step, { timeout: 500 });
  }
  // Freeverb (JUCE Reverb, as Pedalboard runs it) is linear, so its impulse response is exact.
  function uwReverbIR(room = 0.35, dampIn = 0.5) {
    const key = "ir" + room + "|" + dampIn;
    if (uwCache.has(key)) return uwCache.get(key);
    const sr = ctx.sampleRate, len = Math.floor((1.5 + 3 * room) * sr), ir = ctx.createBuffer(2, len, sr);
    const fb = room * 0.28 + 0.7, damp = dampIn * 0.4, sc = sr / 44100;
    for (let ch = 0; ch < 2; ch++) {
      const sp = ch ? 23 : 0, sum = new Float32Array(len);
      for (const c of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) {
        const L = Math.round((c + sp) * sc), buf = new Float32Array(L);
        let last = 0, k = 0;
        for (let i = 0; i < len; i++) {
          const o = buf[k];
          last = o * (1 - damp) + last * damp;
          buf[k] = (i === 0 ? 1 : 0) + last * fb;
          k = (k + 1) % L; sum[i] += o;
        }
      }
      let x = sum;
      for (const a of [556, 441, 341, 225]) {
        const L = Math.round((a + sp) * sc), buf = new Float32Array(L), y = new Float32Array(len);
        let k = 0;
        for (let i = 0; i < len; i++) { const b = buf[k]; buf[k] = x[i] + b * 0.5; k = (k + 1) % L; y[i] = b - x[i]; }
        x = y;
      }
      // input gain 0.015 on L+R, wet x 3 (the wet level itself goes on a gain after it;
      // the mono downmix in front halves L+R, so x2)
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = x[i] * 0.015 * 3 * 2;
    }
    uwCache.set(key, ir);
    return ir;
  }

  // They can be picked for any instrument lane too.
  const UW_PLUGINS = [{ key: "builtin:uw808", name: "u wanna 808", group: "KILLTOY", instrument: true },
                      { key: "builtin:uwlead", name: "u wanna Lead", group: "KILLTOY", instrument: true },
                      { key: "builtin:ktsynth", name: "KILLTOY Synth", group: "KILLTOY", instrument: true },
                      { key: "builtin:toymachine", name: "TOY MACHINE", group: "KILLTOY", instrument: true },
                      { key: "builtin:toydrums", name: "KILLDRUM", group: "KILLTOY", instrument: true },
                      { key: "builtin:blob", name: "BLOB", group: "KILLTOY", instrument: true },
                      { key: "builtin:toykeys", name: "TOY KEYS", group: "KILLTOY", instrument: true },
                      { key: "builtin:toygtr", name: "TOY GTR", group: "KILLTOY", instrument: true }];   // TOY GTR (13 Nov), KT2_TOYGTR_OFF hides it
  // A TOY DRUMS lane made here (not from a song) plays a starter kit from the Library's remade
  // one-shots, and its first clip starts with a simple beat to change.
  // KILLDRUM's nine pads: kick 36, 808 35, perc 37, snare 38, clap 39, closed hat 42, open hat 46, FX 49, texture 51.
  const LIB_KIT = { 36: ["Kick", "good-lies-kick"], 35: ["808", "glue-kick2"], 37: ["Perc", "kyle-i-found-you-perc"], 38: ["Snare", "chroma-010-brillo-snare"],
                    39: ["Clap", "baby-again-clap"], 42: ["Closed hat", "chroma-001-helium-closed-hat"], 46: ["Open hat", "adore-u-open-hat"],
                    49: ["FX", "blue-hour-noise-swell"], 51: ["Texture", "blue-hour-vinyl-haze"] };
  const libKitKey = (f) => "library/preview/" + f + ".mp3";
  // Eman, 7 Nov: "are they really from the Splice we downloaded? the kicks don't hit at all". The kit
  // above is synth remakes of hits from songs. A new lane now starts on real Splice one-shots from
  // the packs we own (the same ids as KillDrumLib.DEFAULT_PADS, always shipped in killdrum/preview),
  // dry: no low-pass on any pad. window.KD_STARTER_OLD = the old remade kit.
  const REAL_KIT = { 36: ["Kick", "sp-os-nbb-kick-streets-862ed"], 35: ["808", "sp-os-flint-808-clean-c-e3c03"], 37: ["Perc", "sp-decap-dtk11-perc-high-stick-dry-a6c1c"],
                     38: ["Snare", "sp-ss-snare-carry-on-6efd2"], 39: ["Clap", "sp-ts-bpd-clap-group-small-7d6ab"], 42: ["Closed hat", "sp-x10-glo-closed-hat-brother-1685d"],
                     46: ["Open hat", "sp-zen-fth-hi-hat-open-doha-5576c"], 49: ["FX", "sp-91v-sgr-138-fx-one-shot-spinning-scratch-7a816"], 51: ["Texture", "sp-orbit-st-fx-vinyl-crackle-2e178"] };
  const starterKit = () => {
    if (window.KD_STARTER_OLD) return { kit: Object.fromEntries(Object.entries(LIB_KIT).map(([n, [, f]]) => [n, libKitKey(f)])),
                              kitGain: {}, kitName: Object.fromEntries(Object.entries(LIB_KIT).map(([n, [name]]) => [n, name])), choke: [[42, 46]],
                              kitPad: { 35: { decay: 1 }, 49: { decay: 0.5, cutoff: 0.8 }, 51: { decay: 0.4 } }, kitTitle: "Starter kit" };
    return { kit: Object.fromEntries(Object.entries(REAL_KIT).map(([n, [, id]]) => [n, "killdrum/preview/" + id + ".mp3"])),
             kitId: Object.fromEntries(Object.entries(REAL_KIT).map(([n, [, id]]) => [n, id])),
             kitGain: {}, kitName: Object.fromEntries(Object.entries(REAL_KIT).map(([n, [name]]) => [n, name])), choke: [[42, 46]],
             kitPad: { 35: { decay: 1 }, 49: { decay: 0.6 }, 51: { decay: 0.4 } }, kitTitle: "Starter kit" };
  };
  const kitUrls = (p) => [...Object.values(p.kit || {}), ...Object.values(p.kitPad || {}).flatMap((x) => ((x && x.layers) || []).map((l) => l.url || l))];
  const loadKit = (p) => Promise.all(kitUrls(p).filter((k) => /^(library|killdrum)\//.test(k)).map((k) => fetchAudio(k, k).catch(() => null)));
  const starterBeat = (beats) => {
    const n = [];
    for (let b = 0; b < beats; b++) {
      n.push({ pitch: 36, start: b, length: 0.25, velocity: 115 });
      if (b % 2 === 1) n.push({ pitch: 39, start: b, length: 0.25, velocity: 105 });
      n.push({ pitch: 42, start: b + 0.5, length: 0.25, velocity: 80 });
    }
    return n;
  };
  // KILLTOY loudness standard for u wanna 808 (bass -19), u wanna Lead (melody -21) and KILLTOY Synth (chords -23):
  // dB taken off on lanes made here (t.lvl), measured with bounceMix (13.7, 11.0 and 16.3 LUFS before)
  const UW_STANDARD_DB = { "808": -5.3, lead: -10.0, kt: -6.7 };
  const origListPlugins = handlers.listPlugins;
  handlers.listPlugins = () => [...origListPlugins(), ...UW_PLUGINS.filter((x) => x.key !== "builtin:toygtr" || (!window.KT2_TOYGTR_OFF && window.ToyGtr))];
  for (const name of ["newInstrumentLane", "setInstrument"]) {
    const orig = handlers[name];
    handlers[name] = (args) => {
      const p = UW_PLUGINS.find((x) => x.key === args.key);
      if (!p) return orig(args);
      const r = orig({ ...args, key: "builtin:4osc" }); // make the lane as a 4OSC one, then swap in this instrument
      let tkFirst = null;
      const t = S.tracks.find((x) => x.id === (args.trackId || (r && r.trackId)));
      if (t) {
        t.instrument = t.name = p.name;
        t.lvl = 1;   // made under the loudness standard (UW_STANDARD_DB)
        if (p.key === "builtin:blob") t.face = "blob"; else delete t.face;
        t.clips.forEach((c) => c.plugins.forEach((x) => {
          if (!x.instrument) return;
          x.name = p.name; x.params = [];
          if (p.key === "builtin:blob") x.face = "blob"; else delete x.face;   // BLOB plays TOY MACHINE presets (BLOB design map v2)
          if (p.key === "builtin:toydrums") { if (!x.kit) Object.assign(x, starterKit()); loadKit(x); } else { delete x.kit; uwEnsure(x); }
          // TOY KEYS (Eman, 7 Nov): its own preset; swapping away from it gives TOY MACHINE its own sound back.
          // TOY GTR (13 Nov) works the same way with its own presets (keys <-> guitar swaps the preset too).
          const wasKeys = !!(x.toy && window.ToyKeys && ToyKeys.isKeys(x.toy.preset)), wasGtr = !!(x.toy && window.ToyGtr && ToyGtr.isGtr(x.toy.preset));
          if (p.key === "builtin:toykeys") { if (!wasKeys) x.toy = { preset: tkFirst || (tkFirst = ToyKeys.preset(args.preset || ToyKeys.DEFAULT)) }; }
          else if (p.key === "builtin:toygtr" && window.ToyGtr) { if (!wasGtr) x.toy = { preset: tkFirst || (tkFirst = ToyGtr.preset(args.preset || ToyGtr.DEFAULT) || ToyGtr.preset(ToyGtr.DEFAULT)) }; }
          else if (wasKeys || wasGtr) delete x.toy;
        }));
        if (p.key === "builtin:toykeys" || p.key === "builtin:toygtr") { const tps = t.clips.flatMap((c) => c.plugins).filter((x) => x.instrument && x.toy); tps.forEach((q) => (q.toy = tps[0].toy)); }
        for (const [pid, k] of [...tmKeys]) if (k.laneId === t.id) handlers.toyMachineClose({ pluginId: pid });   // its keyboard engine was the old instrument
        changed();
      }
      return r;
    };
  }
  const origNewMidiClip = handlers.newMidiClip;
  handlers.newMidiClip = (args) => {
    const r = origNewMidiClip(args);
    const t = S.tracks.find((x) => x.id === args.trackId), c = t && t.clips[t.clips.length - 1];
    const other = t && t.clips.flatMap((x) => x.plugins).find((x) => x.instrument && x.params && x.params.length && c && !c.plugins.includes(x));
    if (c && t && t.face === "blob") c.plugins.forEach((x) => { if (x.instrument) x.face = "blob"; });   // a BLOB lane's clips play TOY MACHINE
    if (c && t && /toy keys|toy gtr/i.test(t.instrument || "")) {   // a TOY KEYS (or TOY GTR) lane's new pattern plays the lane's sound
      const gtr = /toy gtr/i.test(t.instrument || "") && window.ToyGtr, E = gtr ? window.ToyGtr : window.ToyKeys;
      const had = t.clips.flatMap((x) => x.plugins).find((x) => x.instrument && x.toy && !c.plugins.includes(x));
      c.plugins.forEach((x) => { if (x.instrument) { x.name = gtr ? "TOY GTR" : "TOY KEYS"; x.toy = had ? had.toy : { preset: E.preset(E.DEFAULT) }; } });
    }
    if (c) c.plugins.forEach((x) => { if (uwEnsure(x) && other) { x.params = other.params.map((q) => ({ ...q })); if (other.synth) x.synth = other.synth; } });
    if (c && t && /^(TOY DRUMS|KILLDRUM)$/.test(t.instrument || "")) { // the lane's kit (or the starter kit), and a beat in its first clip
      const inst = c.plugins.find((x) => x.instrument), kitFrom = t.clips.flatMap((x) => x.plugins).find((x) => x.kit && x !== inst);
      if (inst) {
        if (!inst.kit || kitFrom) { Object.assign(inst, kitFrom ? kdCopy(kitFrom) : starterKit()); inst.params = []; }
        loadKit(inst);
        if (t.clips.length === 1 && !(c.notes || []).length) c.notes = starterBeat(c.beats || 16);
      }
    }
    changed();
    return r;
  };
  // A knob on a u wanna instrument sets the whole lane (every clip's copy), and the sound
  // follows while playing.
  let uwRestart = 0;
  function uwSetParam({ pluginId, paramId, value }) {
    const t = S.tracks.find((x) => x.clips.some((c) => c.plugins.some((p) => p.id === pluginId)));
    const p = t && t.clips.flatMap((c) => c.plugins).find((x) => x.id === pluginId);
    const kind = p && uwEnsure(p), k = kind && UW_KNOBS[kind].find((x) => "uw:" + x.id === paramId);
    if (!k) return null;
    const text = k.fmt(k.map.to(value));
    for (const c of t.clips) for (const q of c.plugins) {
      if (q.instrument && q.name === p.name) { uwEnsure(q); const prm = q.params.find((x) => x.id === paramId); prm.value = value; prm.text = text; }
    }
    changed();
    if (S.transport.playing && !uwRestart) uwRestart = setTimeout(() => { uwRestart = 0; restartIfPlaying(); }, 90);
    return { ok: true, text };
  }

  function play808(c, pos, when, input) {
    const s = uwSettings(c, "808"), spb = 60 / S.bpm, T = (x) => when + Math.max(0, x - pos);
    const out = ctx.createGain(), shaper = ctx.createWaveShaper(), hp = juceFilter("hp1", 25), knock = juceFilter("peak", 560, 0.8, s.knock);
    shaper.curve = uwShaper(s.drive);
    out.gain.value = UW.gain808 * Math.pow(10, s.level / 20);
    shaper.connect(hp); hp.connect(knock); knock.connect(out); out.connect(input);
    const notes = (c.notes || []).map((n) => ({ ...n, a: c.start + n.start * spb, b: Math.min(c.start + c.length, c.start + (n.start + n.length) * spb) }))
      .filter((n) => n.b > n.a).sort((x, y) => x.a - y.a);
    // Phrases: notes that touch or overlap share one voice.
    const phrases = [];
    for (const n of notes) {
      const p = phrases[phrases.length - 1];
      if (p && n.a <= p.end + 1e-4) { p.notes.push(n); p.end = Math.max(p.end, n.b); }
      else phrases.push({ notes: [n], end: n.b });
    }
    const wave = uwWave("808", UW.h808, 40, s.tone);
    const lvl = (n) => UW.pre808 * ((n.velocity || 100) / 127);
    for (const ph of phrases) {
      if (ph.end <= pos) continue;
      const base = ph.notes[0].pitch, o = ctx.createOscillator(), g = ctx.createGain();
      o.setPeriodicWave(wave);
      o.frequency.value = 440 * Math.pow(2, (base - 69) / 12);
      o.connect(g); g.connect(shaper);
      g.gain.value = 0;
      ph.notes.forEach((n, i) => {
        const prev = ph.notes[i - 1], cents = (n.pitch - base) * 100;
        if (n.a < pos) { // already sounding when playback starts
          if (n.b > pos || (ph.notes[i + 1] && ph.notes[i + 1].a > pos)) { o.detune.setValueAtTime(cents, when); g.gain.setValueAtTime(lvl(n), when); }
          return;
        }
        const at = T(n.a);
        if (!prev) { g.gain.setValueAtTime(0, at); g.gain.setTargetAtTime(lvl(n), at, s.attack); o.detune.setValueAtTime(cents, at); return; }
        if (n.a < prev.b - 1e-4) o.detune.setTargetAtTime(cents, at, s.slide); // overlap = slide
        else o.detune.setValueAtTime(cents, at);
        g.gain.setTargetAtTime(lvl(prev) * (1 - s.retrig), at, 0.02);
        g.gain.setTargetAtTime(lvl(n), at + 0.05, s.attack);
      });
      g.gain.setTargetAtTime(0, T(ph.end), s.release);
      o.start(T(Math.max(pos, ph.notes[0].a)));
      o.stop(T(ph.end) + Math.max(0.3, 6 * s.release));
      voices.push(o);
    }
  }

  function playLead(c, pos, when, input) {
    const s = uwSettings(c, "lead"), spb = 60 / S.bpm, T = (x) => when + (x - pos);
    // mono voice -> mid/side width -> (low shelf on drum sections) -> body EQ -> reverb
    const mid = ctx.createGain(), side = ctx.createDelay(0.05), sideHp = juceFilter("butterhp", 300), sideG = ctx.createGain(), sideN = ctx.createGain();
    const ms = ctx.createChannelMerger(2);
    side.delayTime.value = 0.011;
    sideG.gain.value = s.width; sideN.gain.value = -s.width;
    mid.connect(ms, 0, 0); mid.connect(ms, 0, 1);
    mid.connect(side); side.connect(sideHp); sideHp.connect(sideG); sideHp.connect(sideN);
    sideG.connect(ms, 0, 0); sideN.connect(ms, 0, 1);
    let node = ms;
    if (c.lowShelf) { const sh = juceFilter("shelf", 450, 0.7, c.lowShelf); node.connect(sh); node = sh; }
    const body = juceFilter("peak", 620, 0.7, s.body);
    node.connect(body);
    const out = ctx.createGain(), dry = ctx.createGain(), mono = ctx.createGain(), rv = ctx.createConvolver(), wet = ctx.createGain();
    out.gain.value = UW.gainLead * Math.pow(10, s.level / 20); dry.gain.value = 0.9 * 2; wet.gain.value = s.reverb;
    mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.channelInterpretation = "speakers";
    rv.normalize = false; rv.buffer = uwReverbIR();
    body.connect(dry); body.connect(mono); mono.connect(rv); rv.connect(wet);
    dry.connect(out); wet.connect(out); out.connect(input);
    const profs = Object.keys(UW.lead).map(Number), atk = s.attack, rel = s.release;
    for (const n of c.notes || []) {
      const a = c.start + n.start * spb + (c.delay || 0), b = Math.min(c.start + c.length, a + n.length * spb);
      if (b <= pos || b <= a) continue;
      const near = profs.reduce((x, y) => (Math.abs(y - n.pitch) < Math.abs(x - n.pitch) ? y : x));
      const f = 440 * Math.pow(2, (n.pitch - 69) / 12), v = (n.velocity || 100) / 127, dur = b - a;
      const env = ctx.createGain(), o = ctx.createOscillator();
      // build.py: linear in over the attack, linear out over the release, ending at the note's end
      if (a >= pos) {
        const k = Math.min(1, dur / (atk + rel)); // a note shorter than attack + release never gets to full level
        env.gain.setValueAtTime(0, T(a));
        env.gain.linearRampToValueAtTime(v * k, T(a + atk * k));
        env.gain.setValueAtTime(v * k, T(b - rel * k));
        env.gain.linearRampToValueAtTime(0, T(b));
      } else { env.gain.setValueAtTime(v, when); env.gain.setValueAtTime(v, Math.max(when, T(b - rel))); env.gain.linearRampToValueAtTime(0, T(b)); }
      o.setPeriodicWave(uwWave("lead" + near, UW.lead[near], Math.floor(16500 / f - 1e-9), s.tone));
      o.frequency.value = f;
      o.connect(env); env.connect(mid);
      o.start(T(Math.max(a, pos))); o.stop(T(b) + 0.02);
      voices.push(o);
    }
  }

  // KILLTOY Synth: one instrument whose sound is a recipe (the lane's "synth" in session.json),
  // so any song's synth parts can be MIDI lanes that sound like their numpy renders. The spec
  // is /mnt/project-files/2-ahead/KILLTOY-Synth-spec.md (and ktsynth.py renders it in numpy).
  // Its knobs scale the recipe; at their defaults it plays the recipe as written.
  const fX = (x) => "x" + x.toFixed(2);
  UW_KNOBS.kt = [
    { id: "tone", name: "Tone", map: lin(-1, 1), def: 0, fmt: fTone },
    { id: "attack", name: "Attack", map: expo(0.25, 4), def: 1, fmt: fX },
    { id: "release", name: "Release", map: expo(0.25, 4), def: 1, fmt: fX },
    { id: "drive", name: "Drive", map: lin(-12, 12), def: 0, fmt: fDb }, // added to the recipe's drive
    { id: "width", name: "Width", map: lin(0, 2), def: 1, fmt: fPct },
    { id: "reverb", name: "Reverb", map: lin(0, 3), def: 1, fmt: fPct },
    { id: "level", name: "Level", map: lin(-24, 12), def: 0, fmt: fDb },
  ];
  // A plain saw-ish pad for a lane that picks KILLTOY Synth without a recipe.
  const KT_DEFAULT = { partials: Array.from({ length: 24 }, (_, i) => 0.3 / (i + 1)), env: { a: 0.01, d: 0.3, s: 0.6, r: 0.15 },
                       unison: { voices: 3, cents: 10, spread: 0.6 }, lowpass: { f: 2500, q: 0.7, env: 0, decay: 0.2 } };
  const ktRecipe = (c) => { const p = c.plugins.find((x) => x.instrument); return (p && p.synth) || KT_DEFAULT; };
  function ktTable(rec, pitch) {
    if (!rec.regions) return { key: "kt" + rec.partials.length + "|" + rec.partials[0], amps: rec.partials };
    const r = rec.regions.find((x) => x.maxPitch >= pitch) || rec.regions[rec.regions.length - 1];
    return { key: "ktr" + r.maxPitch + "|" + r.partials.length + "|" + r.partials[0], amps: r.partials };
  }
  // The gain envelope of one voice as straight lines [time, level] (see the spec). Notes are
  // [{ a, b, v }] in song seconds, sorted; each starts from the level it finds, and the
  // release follows the voice's last end.
  function ktEnvPoints(ns, env) {
    const A = env.a, D = env.d, Sl = env.s, R = env.r, pts = [];
    const shape = (n, L0, t) => { const x = t - n.a; return x < A ? L0 + ((n.v - L0) * x) / A : x < A + D ? n.v + ((n.v * Sl - n.v) * (x - A)) / D : n.v * Sl; };
    let L0 = 0;
    const end = Math.max(...ns.map((n) => n.b));
    ns.forEach((n, i) => {
      const until = i + 1 < ns.length ? ns[i + 1].a : end;
      pts.push([n.a, L0]);
      if (n.a + A < until) pts.push([n.a + A, n.v]);
      if (D > 0 && n.a + A + D < until) pts.push([n.a + A + D, n.v * Sl]);
      L0 = shape(n, L0, until);
      pts.push([until, L0]);
    });
    pts.push([end + R, 0]);
    return pts;
  }
  // Writes those lines onto a gain, from song time pos (heard at ctx time when).
  function ktApplyEnv(param, pts, pos, when) {
    const T = (t) => when + (t - pos);
    let started = false;
    for (let i = 0; i < pts.length; i++) {
      const [t, y] = pts[i];
      if (t < pos) continue;
      if (!started) {
        const p = pts[i - 1], y0 = p ? p[1] + ((y - p[1]) * (pos - p[0])) / (t - p[0] || 1) : y;
        param.setValueAtTime(p ? y0 : y, p ? when : T(t));
        started = true;
        if (!p) continue;
      }
      param.linearRampToValueAtTime(y, T(t));
    }
  }
  // Recipe "duck": the kick sidechain, hits = [[song beat, dB], ...]. At each hit the gain falls in a straight
  // line to -dB over attack sec, then comes back to 1 exponentially (time constant release sec), from
  // whatever level it was at. Same curve as ktsynth.py duck_curve. Scheduled from song time pos (ctx time when).
  function ktDuck(param, duck, spb, delay, pos, when, until) {
    const att = duck.attack != null ? duck.attack : 0.01, rel = duck.release != null ? duck.release : 0.06;
    const T = (t) => when + (t - pos);
    const hits = duck.hits.map(([b, db]) => [b * spb + delay, Math.pow(10, -db / 20)]).sort((x, y) => x[0] - y[0]);
    const at = (seg, t) => { const x = t - seg[0]; return x < att ? seg[1] + ((seg[2] - seg[1]) * x) / att : 1 - (1 - seg[2]) * Math.exp(-(x - att) / rel); };
    let prev = null, started = false;
    param.setValueAtTime(1, when);
    for (let i = 0; i < hits.length; i++) {
      const [t0, lo] = hits[i];
      if (t0 > until) break;
      const seg = [t0, prev ? at(prev, t0) : 1, lo]; prev = seg;
      const next = i + 1 < hits.length ? hits[i + 1][0] : Infinity;
      if (next <= pos) continue;
      if (t0 < pos) { // the playhead starts inside this hit's curve
        const v = at(seg, pos);
        param.setValueAtTime(v, when);
        if (pos < t0 + att) { param.linearRampToValueAtTime(lo, T(t0 + att)); param.setTargetAtTime(1, T(t0 + att), rel); }
        else param.setTargetAtTime(1, when, rel);
      } else {
        param.setValueAtTime(seg[1], T(t0)); param.linearRampToValueAtTime(lo, T(t0 + att)); param.setTargetAtTime(1, T(t0 + att), rel);
      }
      started = true;
    }
    return started;
  }
  function playKT(c, pos, when, input) {
    const rec = ktRecipe(c), k = uwSettings(c, "kt"), spb = 60 / S.bpm, T = (x) => when + Math.max(0, x - pos);
    const env = { a: 0.005, d: 0, s: 1, r: 0.03, ...(rec.env || {}) };
    env.a *= k.attack; env.r *= k.release;
    const uni = rec.unison || { voices: 1, cents: 0, spread: 0 }, nv = Math.max(1, uni.voices | 0);
    const lp = rec.lowpass, cutHz = rec.partialCutHz || 16500;
    // after the notes: pre -> drive -> hp -> peaks -> low shelf -> width -> reverb -> duck -> level
    const sum = ctx.createGain();
    sum.gain.value = rec.pre != null ? rec.pre : 1;
    let node = sum;
    const chain = (n) => { node.connect(n); node = n; };
    if (rec.drive != null || k.drive) { const sh = ctx.createWaveShaper(); sh.curve = uwShaper((rec.drive || 0) + k.drive); chain(sh); }
    if (rec.hp) chain(juceFilter("hp1", rec.hp));
    for (const q of rec.peaks || []) chain(juceFilter("peak", q.f, q.q, q.db));
    if (rec.lowshelf) chain(juceFilter("shelf", rec.lowshelf.f, rec.lowshelf.q, rec.lowshelf.db));
    if (c.lowShelf) chain(juceFilter("shelf", 450, 0.7, c.lowShelf));
    if (rec.width && rec.width.amount * k.width) {
      const w = rec.width, mid = ctx.createGain(), d = ctx.createDelay(0.2), hp = juceFilter("butterhp", w.hpHz || 300), gL = ctx.createGain(), gR = ctx.createGain();
      const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), dl = ctx.createGain(), dr = ctx.createGain();
      mid.channelCount = 1; mid.channelCountMode = "explicit"; mid.channelInterpretation = "speakers"; // (L+R)/2
      d.delayTime.value = (w.delayMs || 0) / 1000; gL.gain.value = w.amount * k.width; gR.gain.value = -w.amount * k.width;
      node.connect(split); split.connect(dl, 0); split.connect(dr, 1); dl.connect(merge, 0, 0); dr.connect(merge, 0, 1);
      node.connect(mid); mid.connect(d); d.connect(hp); hp.connect(gL); hp.connect(gR); gL.connect(merge, 0, 0); gR.connect(merge, 0, 1);
      node = merge;
    }
    const out = ctx.createGain(), dk = ctx.createGain(); // dk: the kick duck (recipe "duck"), after the reverb
    out.gain.value = Math.pow(10, ((rec.level || 0) + k.level) / 20);
    if (rec.reverb) {
      const rv = rec.reverb, dry = ctx.createGain(), wet = ctx.createGain(), mono = ctx.createGain(), conv = ctx.createConvolver();
      dry.gain.value = (rv.dry != null ? rv.dry : 1) * 2; wet.gain.value = (rv.wet || 0) * k.reverb;
      mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.channelInterpretation = "speakers";
      conv.normalize = false; conv.buffer = uwReverbIR(rv.room != null ? rv.room : 0.5, rv.damp != null ? rv.damp : 0.5);
      node.connect(dry); node.connect(mono); mono.connect(conv); conv.connect(wet); dry.connect(dk); wet.connect(dk);
    } else node.connect(dk);
    dk.connect(out);
    out.connect(input);
    if (rec.duck && rec.duck.hits && rec.duck.hits.length) ktDuck(dk.gain, rec.duck, spb, c.delay || 0, pos, when, c.start + c.length + env.r + 3);

    const notes = (c.notes || []).map((n) => {
      const a = c.start + n.start * spb + (c.delay || 0);
      return { ...n, a, b: Math.min(c.start + c.length, a + n.length * spb), v: (n.velocity || 100) / 127 };
    }).filter((n) => n.b > n.a).sort((x, y) => x.a - y.a);
    // One voice = the unison oscillators into their pans, an envelope and (maybe) a lowpass.
    const voice = (first, until, lpStarts) => {
      const merge = ctx.createChannelMerger(2), g = ctx.createGain(), oscs = [];
      g.gain.value = 0;
      merge.connect(g);
      let tail = g;
      if (lp) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = lp.f; f.Q.value = 20 * Math.log10(lp.q || Math.SQRT1_2); // Web Audio wants dB
        for (const t0 of lpStarts) if (lp.env && t0 + 6 * (lp.decay || 0.1) > pos) {
          const at = T(t0), left = t0 < pos ? Math.exp(-(pos - t0) / (lp.decay || 0.1)) : 1;
          f.detune.setValueAtTime(1200 * lp.env * left, at); f.detune.setTargetAtTime(0, at, lp.decay || 0.1);
        }
        g.connect(f); tail = f;
      }
      tail.connect(sum);
      const tb = ktTable(rec, first.pitch);
      for (let i = 0; i < nv; i++) {
        const det = nv > 1 ? -uni.cents + (2 * uni.cents * i) / (nv - 1) : 0, pan = nv > 1 ? (uni.spread || 0) * (-1 + (2 * i) / (nv - 1)) : 0;
        const ff = 440 * Math.pow(2, (first.pitch - 69) / 12 + det / 1200);
        const o = ctx.createOscillator(), gl = ctx.createGain(), gr = ctx.createGain();
        o.setPeriodicWave(uwWave(tb.key, tb.amps, Math.floor(cutHz / ff - 1e-9), k.tone, !!rec.normalizePeak));
        o.frequency.value = ff;
        gl.gain.value = Math.min(1, 1 - pan) / nv; gr.gain.value = Math.min(1, 1 + pan) / nv;
        o.connect(gl); o.connect(gr); gl.connect(merge, 0, 0); gr.connect(merge, 0, 1);
        o.start(T(Math.max(pos, first.a))); o.stop(T(until) + 0.05);
        voices.push(o); oscs.push(o);
      }
      return { g, oscs };
    };
    if (rec.mode === "mono") {
      const phrases = [];
      for (const n of notes) {
        const p = phrases[phrases.length - 1];
        if (p && n.a <= p.end + 1e-4) { p.notes.push(n); p.end = Math.max(p.end, n.b); }
        else phrases.push({ notes: [n], end: n.b });
      }
      for (const ph of phrases) {
        if (ph.end + env.r <= pos) continue;
        const base = ph.notes[0].pitch, v = voice(ph.notes[0], ph.end + env.r, ph.notes.map((n) => n.a));
        ktApplyEnv(v.g.gain, ktEnvPoints(ph.notes, env), pos, when);
        ph.notes.forEach((n, i) => {
          const cents = (n.pitch - base) * 100, prev = ph.notes[i - 1];
          for (const o of v.oscs) {
            if (n.a < pos) { if (!ph.notes[i + 1] || ph.notes[i + 1].a > pos) o.detune.setValueAtTime(cents, when); continue; }
            if (prev && n.a < prev.b - 1e-4) o.detune.setTargetAtTime(cents, T(n.a), rec.slide || 0.075);
            else o.detune.setValueAtTime(cents, T(n.a));
          }
        });
      }
    } else {
      for (const n of notes) {
        if (n.b + env.r <= pos) continue;
        const v = voice(n, n.b + env.r, [n.a]);
        ktApplyEnv(v.g.gain, ktEnvPoints([n], env), pos, when);
      }
    }
  }

  // TOY MACHINE: KILLTOY's own synth (Source/dsp/toymachine, the app's C++ compiled to
  // toy-machine.wasm and run by toy-machine.js in an AudioWorklet). A MIDI lane plays it with a
  // preset: session.json lanes say {"instrument":"TOY MACHINE","preset":"Electronic/Bass/Name"}
  // (a file in toy-machine/presets/) or carry the whole preset inline as "toyPreset".
  // The preset lives on the lane's instrument plugin as p.toy (every clip's copy shares it).
  let tmApi = null;
  const tmReady = window.ToyMachine && ctx.audioWorklet
    ? window.ToyMachine.load(ctx, "toy-machine.wasm").then((a) => (tmApi = a), (e) => console.warn("TOY MACHINE did not load", e)) : null;
  const TM_INIT = { name: "Init", category: "Synths", oscA: { wave: "saw" }, filter: { type: "lp24", cutoff: 8000, res: 0.15 },
    ampEnv: { a: 0.003, d: 0.3, s: 0.8, r: 0.15 },
    macros: [{ name: "Bright", value: 0.7, targets: [{ param: "filter.cutoff", from: 150, to: 18000 }] },
             { name: "Body", value: 0.0, targets: [{ param: "oscB.level", from: 0, to: 0.8 }] },
             { name: "Decay", value: 0.4, targets: [{ param: "ampEnv.d", from: 0.05, to: 2 }] },
             { name: "Space", value: 0.0, targets: [{ param: "fx.reverb.mix", from: 0, to: 0.5 }] }],
    oscB: { on: true, wave: "square", oct: -1, level: 0 }, fx: [{ type: "reverb", mix: 0 }],
    pads: [{ kind: "macro", x: 0, y: 1 }, { kind: "macro", x: 2, y: 3 }], look: { style: "liquid", hue: 275, hue2: 70, seed: 7 } };
  function isTM(p) { return !!p && p.instrument && (/toy machine|toy keys|toy gtr/i.test(p.name) || p.face === "blob"); }   // a BLOB (face "blob") is a TOY MACHINE with a creature for a window
  // TOY KEYS (playground/toy-keys.js) rides on TOY MACHINE's lanes: a preset with engine "toykeys"
  // gets a TOY KEYS engine (same calls), everything else the TOY MACHINE wasm.
  // TOY GTR (playground/toy-gtr.js, 13 Nov) is a web engine the same way (preset engine "toygtr"):
  // isTK = "plays on a web engine (TOY KEYS or TOY GTR)", webEng = which one.
  const webEng = (pr) => (!pr ? null : window.ToyGtr && ToyGtr.isGtr(pr) ? window.ToyGtr : window.ToyKeys && ToyKeys.isKeys(pr) ? window.ToyKeys : null);
  const isTK = (pr) => !!webEng(pr);
  const isTKPlug = (p) => !!p && p.instrument && /toy keys|toy gtr/i.test(p.name || "");
  const plugEng = (p) => (/toy gtr/i.test((p && p.name) || "") && window.ToyGtr ? window.ToyGtr : window.ToyKeys);   // the web engine a TOY KEYS / TOY GTR plugin defaults to
  // which engine an engine object is / a preset wants: "keys", "gtr" or "tm" (a swap between them makes a new engine)
  const engKind = (s) => (s.isToyGtr ? "gtr" : s.isToyKeys ? "keys" : "tm");
  const prKind = (pr) => { const E = webEng(pr); return !E ? "tm" : E === window.ToyGtr ? "gtr" : "keys"; };
  function tmCreate(opts) { const E = webEng(opts.preset); return E ? E.load(ctx).create(opts) : tmApi.create(opts); }
  var tmPresets = tmPresets || new Map();   // (var: lanes are read before this part runs) preset id -> preset object (fetched from toy-machine/presets/)
  let tmIndex = null;
  async function tmFetchPreset(idOrFile) {
    if (!tmPresets) tmPresets = new Map();
    const idp = idOrFile.replace(/\.json$/, "");
    if (tmPresets.has(idp)) return tmPresets.get(idp);
    const r = await fetch("toy-machine/presets/" + idp.split("/").map(encodeURIComponent).join("/") + ".json");
    if (!r.ok) throw new Error("No TOY MACHINE preset " + idp);
    const j = await r.json();
    tmPresets.set(idp, j);
    return j;
  }
  // KILLTOY loudness standard (Eman, 7 Nov; scripts/loudness_standard.py): every library preset is levelled so its
  // role's part at fader 100% lands on bass -19, melody -21, chords -23, pads/fx -24 LUFS. The song remakes were mixed
  // on the old levels, so a lane from a song file plays the level it was mixed with (preset.level.was).
  // window.KT_LEVEL_OLD = the old levels everywhere.
  function levelFor(p, pr) {
    const was = pr && pr.level && pr.level.was;
    if (was != null && (window.KT_LEVEL_OLD || (p.toy && p.toy.song))) pr.out = { ...(pr.out || {}), level: was };
    return pr;
  }
  // The preset a plugin plays: its own copy once loaded or edited, else the library one (fetched on first use).
  function tmPresetOf(p) {
    if (p.toy && p.toy.preset) return p.toy.preset;
    if (isTKPlug(p) && plugEng(p)) { const E = plugEng(p); p.toy = { ...(p.toy || {}), preset: E.preset(E.DEFAULT) }; return p.toy.preset; }
    const idp = p.toy && p.toy.id;
    if (idp && tmPresets.has(idp)) return (p.toy.preset = levelFor(p, JSON.parse(JSON.stringify(tmPresets.get(idp)))));
    if (idp) { tmFetchPreset(idp).then(() => restartIfPlaying(), (e) => console.warn(e.message)); if (p.synth) return null; }
    if (p.synth && !idp) return null;
    p.toy = { ...(p.toy || {}), preset: JSON.parse(JSON.stringify(TM_INIT)) };
    return p.toy.preset;
  }
  const tmPlugins = (t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)].filter(isTM);
  const tmLane = (pid) => S.tracks.find((t) => tmPlugins(t).some((q) => q.id === pid));
  const tmLive = new Map();   // laneId -> live synth nodes, so knob moves are heard at once
  function tmTrack(laneId, s, preset) { if (!tmLive.has(laneId)) tmLive.set(laneId, new Set()); tmLive.get(laneId).add(s); tmWrap(laneId, s, preset); }
  // Every synth that plays a lane right now (song, piano-roll preview, the window's keyboard).
  const tmSynths = (t) => tmLive.get(t.id) || new Set();

  // A preset's own sample (sampler.file, e.g. "samples/808/tm-classic.wav", the sampled 808s):
  // shipped next to the presets in toy-machine/, fetched and decoded once, then given to every
  // engine that plays the preset. A dropped sound ("dropped:...") stays in p.toy.sample as before.
  const tmSampleLoads = new Map(), tmSampleReady = new Map();   // file -> Promise / { data, sampleRate }
  const tmShippedFile = (pr) => { const sm = pr && pr.sampler, f = sm && sm.on && sm.file; return typeof f === "string" && /^samples\//.test(f) ? f : null; };
  function tmLoadSample(file) {
    if (!tmSampleLoads.has(file)) {
      tmSampleLoads.set(file, fetch("toy-machine/" + file.split("/").map(encodeURIComponent).join("/"))
        .then((r) => { if (!r.ok) throw new Error(r.status + " " + file); return r.arrayBuffer(); })
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => {
          const data = new Float32Array(buf.length);
          for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < ch.length; i++) data[i] += ch[i] / buf.numberOfChannels; }
          const smp = { data, sampleRate: buf.sampleRate, file };
          tmSampleReady.set(file, smp);
          return smp;
        })
        .catch((e) => { console.warn("TOY MACHINE couldn't load its sample", e.message); tmSampleLoads.delete(file); return null; }));
    }
    return tmSampleLoads.get(file);
  }
  // Gives engine s the preset's shipped sample: at once when it's loaded, else as soon as it is.
  function tmGiveSample(s, pr) {
    const file = tmShippedFile(pr);
    if (!file || s.tmSampleFile === file) return;
    s.tmSampleFile = file;
    const ready = tmSampleReady.get(file);
    if (ready) { s.setSample(ready); return; }
    tmLoadSample(file).then((smp) => { if (smp && s.tmSampleFile === file) s.setSample(smp); });
  }

  // One TOY MACHINE engine per lane (per distinct clip-effect chain on it, usually just one),
  // kept between plays: every clip's notes go to it, like the app's one synth on the track.
  // (It used to be one engine per clip, made again on every play: 41 at once in Glue.)
  // A reset engine is deterministic, so a reused one sounds exactly like a new one.
  const tmPool = new Map();   // key -> { s, gen, tr, preset, sample, laneId, idle }
  const TM_IDLE_MS = 20000;   // an engine nobody plays for this long is closed
  function tmRelease(key, e) {
    clearTimeout(e.idle);
    e.s.flush("hard"); e.s.close(); if (e.bal) e.bal.disconnect();
    if (tmPool.get(key) === e) tmPool.delete(key);
    const set = tmLive.get(e.laneId); if (set) set.delete(e.s);
  }
  function tmAcquire(key, plug, preset, pos, when, laneId) {
    let e = tmPool.get(key);
    const smp0 = (plug.toy && plug.toy.sample) || null;
    // another lane (or a lane that lost its dropped sound) gets a fresh engine: a sample can't be taken back out
    if (e && ((e.s.dead && !window.KT2_TM_GUARD_OFF) || e.laneId !== laneId || (e.sample && e.sample !== smp0) || engKind(e.s) !== prKind(preset))) { tmRelease(key, e); e = null; }
    if (!e) {
      e = { gen: 0, tr: { pos, when }, preset, sample: null, laneId, idle: 0 };
      e.s = tmCreate({ preset, getTransport: () => ({ bpm: S.bpm, songAt: e.tr.pos + (ctx.currentTime - e.tr.when), playing: e.live !== false }) });
      tmPool.set(key, e);
      tmTrack(laneId, e.s, preset);
    } else {
      clearTimeout(e.idle);
      e.s.flush("hard");
      e.s.output.disconnect();
      e.tr = { pos, when };
      e.live = true;
      e.s.sendTransport();
      if (e.preset !== preset) { e.s.setPreset(preset); e.preset = preset; }
    }
    const smp = plug.toy && plug.toy.sample;
    if (smp && e.sample !== smp) { e.s.setSample(smp); e.sample = smp; e.s.tmSampleFile = null; }
    tmGiveSample(e.s, preset);
    tmSendDrops(e, plug);
    e.gen++;
    return e;
  }

  // Drop zone sounds live next to the preset as p.toy.drops = { slot: { data, sampleRate, id } },
  // and in this browser's IndexedDB by the drop's id (16-bit), so they come back after a reload.
  const DDB = idb("killtoy-drops", ["audio"]);
  const dropLoads = new Map();   // id -> Promise of { data, sampleRate, id } (or null)
  function loadDrop(id) {
    // a TEXTURES library layer ("tex:<id>", KILLTOY 333): shipped as toy-machine/textures/<id>.wav, same for everyone
    if (typeof id === "string" && id.slice(0, 4) === "tex:" && !window.KT2_TM_TEXTURES_OFF) {
      if (!dropLoads.has(id)) dropLoads.set(id, tmLoadSample("textures/" + id.slice(4) + ".wav").then((smp) => smp ? { data: smp.data, sampleRate: smp.sampleRate, id } : (dropLoads.delete(id), null)));
      return dropLoads.get(id);
    }
    if (!dropLoads.has(id)) dropLoads.set(id, DDB.get("audio", id).then((a) => {
      if (!a || !a.q) return null;
      const data = new Float32Array(a.q.length);
      for (let i = 0; i < a.q.length; i++) data[i] = a.q[i] / 32767;
      return { data, sampleRate: a.sr, id };
    }).catch(() => { if (!window.KT2_DROP_RETRY_OFF) dropLoads.delete(id); return null; }));   // a read that failed once is tried again next time (it used to stay "not there" until a reload; deep debug 16 Nov)
    return dropLoads.get(id);
  }
  window.KT2LoadDrop = loadDrop;   // TOY MACHINE's TEXTURES panel previews library textures through this
  function tmSendDrops(e, plug) {
    if (!plug.toy) return;
    const d = plug.toy.drops || (plug.toy.drops = {});
    e.drops = e.drops || {};
    for (const slot in d) if (d[slot] && e.drops[slot] !== d[slot]) { e.s.setDropSample(+slot, d[slot]); e.drops[slot] = d[slot]; }
    const pr = tmPresetOf(plug), items = (pr && pr.drops && Array.isArray(pr.drops.items)) ? pr.drops.items : [];
    for (const it of items) {
      if (!it || !it.id || (d[it.slot] && d[it.slot].id === it.id)) continue;
      loadDrop(it.id).then((smp) => {
        if (!smp || (d[it.slot] && d[it.slot].id === it.id)) return;
        for (const q of tmLane(plug.id) ? tmPlugins(tmLane(plug.id)) : [plug]) { q.toy = q.toy || {}; q.toy.drops = { ...(q.toy.drops || {}), [it.slot]: smp }; }
        e.s.setDropSample(it.slot, smp); e.drops[it.slot] = smp;
        const t = tmLane(plug.id); if (t) for (const s of tmSynths(t)) if (s !== e.s) s.setDropSample(it.slot, smp);
      });
    }
  }

  // A lane's TOY MACHINE clips: clips with the same effects share one engine and one chain.
  function playTMLane(t, clips, pos, when, laneIn) {
    const groups = new Map();
    for (const c0 of clips) {
      const c = octView(midiView(c0), c0._oct != null ? c0._oct : t.oct || 0);
      const sig = JSON.stringify([c.gain || c.fadeIn || c.fadeOut ? c.id : 0, c.plugins.filter((p) => p.enabled && !p.instrument).map((p) => [p.type, p.name, p.sidechain || null, p.params.map((q) => [q.id, q.value])]), c.tone || null]);
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(c);
    }
    let i = 0;
    for (const list of groups.values()) {
      const fxs = [], input = midiLevelNode(list[0], midiChain(list[0], laneIn, fxs), pos, when);   // a clip with its own volume / fades plays on its own chain
      // the other clips' copies of these effects turn the shared chain's knobs
      for (const c of list.slice(1)) c.plugins.filter((p) => p.enabled && !p.instrument).forEach((p, k) => fxs[k] && fxNodes.set(p.id, fxs[k]));
      const key = t.id + ":" + i++, plug = list[0].plugins.find(isTM);
      // like other MIDI clips, the engine joins BUILD_AHEAD seconds before its first note
      const first = Math.min(...list.map((c) => c.start + ((c.notes || []).length ? Math.min(...c.notes.map((n) => n.start)) * (60 / S.bpm) : 0)));
      const wait = (when + (first - pos) - BUILD_AHEAD - ctx.currentTime) * 1000;
      const soft = softMode;
      if (wait <= 0) playTM(list, pos, when, input, plug, key, soft);
      else laterTimers.push(setTimeout(() => playTM(list, pos, when, input, plug, key, soft), wait));
    }
  }

  function tmNotesOf(list, pos, when) {
    const spb = 60 / S.bpm, notes = [];
    for (const c of list) {
      const end = c.start + c.length;
      for (const n of c.notes || []) {
        const a = c.start + n.start * spb + (c.delay || 0), b = Math.min(end, a + n.length * spb);
        if (b <= pos || b <= a) continue;
        notes.push({ pitch: n.pitch, velocity: n.velocity || 100, on: when + Math.max(0, a - pos), off: when + (b - pos), slide: !!n.slide, ...(n.slide && n.slideFrom != null ? { slideFrom: n.slideFrom, ...(n.slideHand ? { slideHand: true } : {}) } : {}), ...(n.pull ? { pull: true, pullAt: n.pullAt || 0.5 } : {}),
          // Advanced MIDI (Eman, 7 Nov): the note's pitch line (beats -> seconds) and wobble (cycles per beat -> Hz)
          ...(Array.isArray(n.bend) && n.bend.length ? { bend: n.bend.map((p) => [p[0] * spb, p[1], p[2] || 1]) } : {}),
          ...(n.wob && n.wob.d > 0 ? { wob: { d: n.wob.d, hz: (n.wob.r || 2) / spb, fade: (n.wob.f || 0) * n.length * spb, sh: n.wob.sh || 0, ...(Array.isArray(n.wob.e) && n.wob.e.length ? { env: n.wob.e.map((p) => [p[0] * n.length * spb, p[1]]) } : {}) } } : {}) });
      }
    }
    return notes;
  }
  // A note added, moved or removed while the song plays (Eman, 31 Oct): only that lane's TOY
  // MACHINE queue changes. Notes already sounding ring on (their note-offs are sent again), a
  // removed or changed one stops, a new one under the playhead starts now, the rest wait their
  // turn. No restart, so the chords don't retrigger. false = this clip isn't on a live engine.
  function tmRequeue(clipId) {
    const now = ctx.currentTime;
    let found = false;
    for (const e of tmPool.values()) {
      if (!e.sched || e.live === false || !e.clipIds || !e.clipIds.includes(clipId)) continue;
      const list = e.clipIds.map((id) => { for (const t of S.tracks) { const c = t.clips.find((x) => x.id === id); if (c) return octView(midiView(e.stackId ? { ...c, notes: (c.stack && c.stack[e.stackId]) || [], takeNotes: undefined } : c), e.oct); } return null; }).filter(Boolean);
      const neu = tmNotesOf(list, e.pos, e.when), old = e.sched;
      const same = (a, b) => a.pitch === b.pitch && Math.abs(a.on - b.on) < 0.002 && Math.abs(a.off - b.off) < 0.002;
      e.s.requeue();
      const sounding = old.filter((n) => n.on <= now && n.off > now);
      for (const n of sounding) if (!neu.some((m) => same(m, n))) e.s.noteOff(n.pitch, now);
      const fresh = [];
      for (const m of neu) {
        if (m.off <= now) continue;
        if (m.on <= now) {
          if (sounding.some((n) => same(m, n))) e.s.noteOff(m.pitch, m.off);   // rings on, ends where it did
          else fresh.push({ ...m, on: now + 0.005 });                           // new under the playhead: now
        } else fresh.push(m);
      }
      e.s.schedule(fresh);
      e.sched = neu;
      found = true;   // stacked synths play the same pattern: every engine that has it takes the edit
    }
    return found;
  }
  // a stacked synth's octave: the same notes, moved by whole octaves
  function octView(c, oct) { return oct ? { ...c, _oct: oct, notes: (c.notes || []).map((n) => ({ ...n, pitch: n.pitch + 12 * oct })) } : c; }

  // TOY MACHINE vs KILLDRUM balance (Eman, 10 Nov: "the synths feel a lot louder than KILLDRUM; chords
  // then KILLDRUM and the drums feel a lot lower"). Measured in this page at 140 BPM, fader 100%: the
  // starter KILLDRUM beat is -17.9 LUFS with its loudest hit at -0.8 dBFS (no room to push drums up), while
  // TOY MACHINE chords landed at -23..-20 LUFS on Keys/Pads and -18..-8 on Leads/Plucks: those were
  // levelled on a single line (scripts/loudness_standard.py) and a chord stacks 5-12 dB on top.
  // Reference mixes put the drums (with the 808) as the loudest part and the chords/music about 6 dB
  // under them (trap/dark), so a lane is trimmed by how many notes it really plays at once:
  // one at a time -> its single-line level (-21 LUFS, the melody standard), triads -> -24.5, 5+ note
  // chords -> -23.5, in between by interpolation. Measurements per library preset: tm-balance.json
  // (scripts/tm_balance.py; [single line, triads, 5-note chords] in LUFS). Bass, FX, TOY KEYS, song
  // remakes' lanes and presets not in the table play as before. window.KT_BAL_OLD = the old levels.
  const TM_BAL_TARGET = [[1, -21], [3, -24.5], [5, -23.5]];
  let tmBal = null;
  fetch("tm-balance.json").then((r) => (r.ok ? r.json() : null)).then((j) => { tmBal = j; }, () => {});
  function tmPoly(notes) {   // how many notes sound at once, on average over the time anything sounds
    const ev = [];
    for (const n of notes) if (n.off > n.on) ev.push([n.on, 1], [n.off, -1]);
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let k = 0, t0 = 0, busy = 0, sum = 0;
    for (const [t, d] of ev) { if (k > 0) { busy += t - t0; sum += k * (t - t0); } k += d; t0 = t; }
    return busy > 0 ? sum / busy : 1;
  }
  function tmBalDb(plug, preset, list) {
    if (window.KT_BAL_OLD || window.KT_LEVEL_OLD || !tmBal || !preset || isTK(preset) || (plug.toy && plug.toy.song)) return 0;
    const m = tmBal[(preset.genre || "Electronic") + "/" + preset.category + "/" + preset.name];
    if (!m) return 0;
    const poly = tmPoly(tmNotesOf(list, 0, 0)), T = TM_BAL_TARGET, M = [[1, m[0]], [3, m[1]], [5, m[2]]];
    const at = (pts) => { if (poly <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (poly <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (poly - x0) / (x1 - x0); } return pts[pts.length - 1][1]; };
    return Math.max(-15, Math.min(3, at(T) - at(M)));
  }
  // the engine's output through its balance trim (one GainNode per pooled engine)
  function tmOutTo(e, input, db) {
    if (!e.bal) e.bal = ctx.createGain();
    e.s.output.disconnect(); e.bal.disconnect();
    e.s.output.connect(e.bal); e.bal.connect(input);
    e.bal.gain.value = Math.pow(10, (db || 0) / 20);
  }
  // key: the pool slot ("preview" = the lane's piano-roll preview engine).
  function playTM(list, pos, when, input, plug, key, soft) {
    const preset = tmPresetOf(plug);
    if (!preset) { list.forEach((c) => playKT(c, pos, when, input)); return; }   // library preset still loading: the KILLTOY Synth recipe stands in
    if (!tmApi) { if (tmReady) tmReady.then(() => restartIfPlaying()); return; }
    const notes = tmNotesOf(list, pos, when);
    if (window.__tmLog) window.__tmLog.push(plug.id + ":" + notes.map((n) => n.pitch).sort((a, b) => a - b).join(","));   // tests: which synth plays which notes
    const lane = tmLane(plug.id), laneId = lane ? lane.id : plug.id;
    const pv = key === "preview" || /^pvk:/.test(key || "");   // a piano-roll preview; pvk:<key> = one held computer key (its own engine, so chords let go one by one)
    const k = key === "preview" ? "pv:" + laneId : /^pvk:/.test(key || "") ? key + ":" + laneId : key;
    const e0 = tmPool.get(k);
    let e;
    if (soft && e0 && e0.live !== false && e0.sched && e0.laneId === laneId && e0.preset === preset && !pv) {
      // a seamless rebuild: this engine plays on; notes already sounding ring on, the queue changes
      e = e0;
      const now = ctx.currentTime, old = e.sched;
      clearTimeout(e.idle);
      tmOutTo(e, input, pv ? 0 : tmBalDb(plug, preset, list));
      e.tr = { pos, when }; e.s.sendTransport();
      e.s.requeue();
      // a loop wrap booked ahead (when is still to come): the old pass plays to the loop's end, so its
      // last notes ring out in full and the ones still to start in that last moment do start (Eman, 6 Nov 02:50)
      const cut = when > now + 0.002 ? when : now;
      const sounding = old.filter((n) => n.on <= now && n.off > now);
      for (const n of sounding) if (!notes.some((m) => m.pitch === n.pitch && m.on <= now + 0.05 && Math.abs(m.off - n.off) < 0.004)) e.s.noteOff(n.pitch, Math.min(n.off, cut));
      const fresh = cut > now ? old.filter((n) => n.on > now && n.on < cut).map((n) => ({ ...n, off: Math.min(n.off, cut) })) : [];
      for (const m of notes) {
        if (m.off <= now) continue;
        const ring = sounding.find((n) => n.pitch === m.pitch && Math.abs(m.off - n.off) < 0.004);
        if (ring) { e.s.noteOff(m.pitch, m.off); continue; }   // still sounding: it rings on and ends where it did
        fresh.push(m.on < now ? { ...m, on: now + 0.005 } : m);
      }
      e.s.schedule(fresh);
      e.gen++;
    } else {
      e = tmAcquire(k, plug, preset, pos, when, laneId);
      tmOutTo(e, input, pv ? 0 : tmBalDb(plug, preset, list));
      e.s.schedule(notes);
    }
    const gen = e.gen;
    if (!pv) Object.assign(e, { sched: notes, clipIds: list.map((c) => c.id), oct: list[0]._oct || 0, stackId: list[0]._stack || null, pos, when });   // tmRequeue edits it live
    // Stand in as a "voice", so stopping the song (or a preview note) ends it. The engine stays
    // for the next play (unless a newer play already took it), and closes after a while unused.
    voices.push({ stop: (at) => { const ms = Math.max(0, ((at || ctx.currentTime) - ctx.currentTime) * 1000);
                                  setTimeout(() => { if (e.gen !== gen || tmPool.get(k) !== e) return;
                                                     e.s.flush("hard"); e.live = false; e.s.sendTransport(); e.idle = setTimeout(() => e.gen === gen && tmRelease(k, e), TM_IDLE_MS); }, ms + 30); },
                  disconnect: () => {} });
    // Once the lane's last note has rung out (reverb, delay), the engine rests until the next play.
    const rel = +(preset && preset.ampEnv && preset.ampEnv.r) || 0; // a long Release rings past the last note
    const last = Math.max(0, ...notes.map((n) => n.off)), TAIL = Math.min(16, Math.max(6, rel + 3));
    if (!pv) laterTimers.push(setTimeout(() => { if (e.gen === gen && tmPool.get(k) === e) { e.s.flush("hard"); e.live = false; e.s.sendTransport(); e.idle = setTimeout(() => e.gen === gen && tmRelease(k, e), TM_IDLE_MS); } },
                                                      (last + TAIL - ctx.currentTime) * 1000));
  }

  // The TOY MACHINE window talks to these (the app has the same commands in BoothEngine).
  const tmFind = (pluginId) => { const t = tmLane(pluginId), p = t && (tmPlugins(t).find((q) => q.id === pluginId) || tmPlugins(t)[0]); return p ? { t, p } : null; };
  handlers.toyMachineGetPreset = ({ pluginId }) => {
    const f = tmFind(pluginId);
    if (!f) return { error: "That TOY MACHINE isn't there any more." };
    const preset = tmPresetOf(f.p) || TM_INIT;
    return { preset: JSON.parse(JSON.stringify(preset)), lane: f.t.name, hasSample: !!(f.p.toy && f.p.toy.sample) };
  };
  handlers.toyMachineSetPreset = ({ pluginId, preset }) => {
    const f = tmFind(pluginId);
    if (!f) return { error: "That TOY MACHINE isn't there any more." };
    const pr = typeof preset === "string" ? JSON.parse(preset) : preset;
    for (const q of tmPlugins(f.t)) q.toy = { ...(q.toy || {}), preset: JSON.parse(JSON.stringify(pr)) };
    for (const s of tmSynths(f.t)) { if (engKind(s) !== prKind(pr)) continue; s.setPreset(pr); tmGiveSample(s, pr); }
    if (isTK(pr)) for (const [pid, k] of [...tmKeys]) if (k.laneId === f.t.id && engKind(k.s) !== prKind(pr)) handlers.toyMachineClose({ pluginId: pid });
    return { ok: true };
  };
  handlers.toyMachineSetMacro = ({ pluginId, index, value }) => {
    const f = tmFind(pluginId);
    if (!f) return { ok: false };
    for (const pr of new Set(tmPlugins(f.t).map(tmPresetOf))) if (pr && pr.macros && pr.macros[index]) pr.macros[index].value = value;
    for (const s of tmSynths(f.t)) s.setMacro(index, value);
    return { ok: true };
  };
  handlers.toyMachineSetPad = ({ pluginId, index, x, y, star }) => {
    const f = tmFind(pluginId);
    if (!f) return { ok: false };
    for (const s of tmSynths(f.t)) { s.setPad(index, x, y); if (star !== undefined && s.setPadStar) s.setPadStar(index, star ? star[0] : -1, star ? star[1] : 0); }
    return { ok: true };
  };
  handlers.toyMachineSetSample = ({ pluginId, data, sampleRate }) => {
    const f = tmFind(pluginId);
    if (!f) return { ok: false };
    const arr = data instanceof Float32Array ? data : new Float32Array((function (s) { if (window.KT2_B64_OLD) return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); var b = atob(s), n = b.length, u = new Uint8Array(n), i; for (i = 0; i < n; i++) u[i] = b.charCodeAt(i); return u; })(data).buffer);
    const sample = { data: arr, sampleRate };
    for (const q of tmPlugins(f.t)) q.toy = { ...(q.toy || {}), sample };
    for (const s of tmSynths(f.t)) s.setSample(sample);
    return { ok: true };
  };
  // the Sampler's sound as a picture (400 peaks, 0..1) for its drop zone
  handlers.toyMachineSamplePeaks = ({ pluginId }) => {
    const f = tmFind(pluginId), q = f && tmPlugins(f.t).find((x) => x.toy && x.toy.sample), smp = q && q.toy.sample;
    if (!smp || !smp.data) return { ok: false };
    const d = smp.data, P = 400, step = d.length / P, pk = new Array(P).fill(0);
    let top = 1e-6;
    for (let i = 0; i < P; i++) { let m = 0; for (let j = Math.floor(i * step), e = Math.floor((i + 1) * step); j < e; j++) m = Math.max(m, Math.abs(d[j])); pk[i] = m; top = Math.max(top, m); }
    return { ok: true, peaks: pk.map((v) => v / top) };
  };
  handlers.toyMachineSetDropSample = ({ pluginId, slot, data, sampleRate, id }) => {
    const f = tmFind(pluginId);
    if (!f) return { ok: false };
    const arr = data instanceof Float32Array ? data : new Float32Array((function (s) { if (window.KT2_B64_OLD) return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); var b = atob(s), n = b.length, u = new Uint8Array(n), i; for (i = 0; i < n; i++) u[i] = b.charCodeAt(i); return u; })(data).buffer);
    const sample = { data: arr, sampleRate, id: id || null };
    if (id) {
      const q = new Int16Array(arr.length);
      for (let i = 0; i < arr.length; i++) q[i] = Math.max(-32767, Math.min(32767, Math.round(arr[i] * 32767)));
      DDB.put("audio", id, { sr: sampleRate, q }).catch((err) => console.warn("Couldn't keep the dropped sound in this browser", err));
      dropLoads.set(id, Promise.resolve(sample));
    }
    for (const q of tmPlugins(f.t)) q.toy = { ...(q.toy || {}), drops: { ...((q.toy && q.toy.drops) || {}), [slot]: sample } };
    for (const s of tmSynths(f.t)) s.setDropSample(slot, sample);
    return { ok: true };
  };
  // The keyboard in the window: a held note on its own synth, through the lane's volume.
  const tmKeys = new Map();   // pluginId -> { s, out }
  // Which synths of a stack sound when you play: the main one plus every linked one, never a muted one,
  // and only the soloed ones when one is soloed (Eman, 6 Nov 22:10). KT2_KEYS_IGNORE_MS = old (mute/solo ignored).
  function stackPlayers(main, only) {
    let list = only ? [only] : [main, ...S.tracks.filter((x) => x.layerOf === main.id && x.linked !== false)];
    if (window.KT2_KEYS_IGNORE_MS) return list;
    const stack = [main, ...S.tracks.filter((x) => x.layerOf === main.id)];
    if (stack.some((x) => x.solo)) list = list.filter((x) => x.solo);
    return list.filter((x) => !x.muted);
  }
  function tmKeyFor(pluginId) {
    const f = tmFind(pluginId);
    if (!f || !tmApi) return null;
    let k = tmKeys.get(pluginId);
    if (k && engKind(k.s) !== prKind(tmPresetOf(f.p))) { handlers.toyMachineClose({ pluginId }); k = null; }   // TOY KEYS / TOY GTR <-> TOY MACHINE swapped
    if (!k) {
      const out = ctx.createGain();
      out.gain.value = dbToLin(f.t.volume || 0);
      out.connect(master);
      const s = tmCreate({ preset: tmPresetOf(f.p) || TM_INIT, getTransport: () => ({ bpm: S.bpm, songAt: position(), playing: S.transport.playing }) });
      if (f.p.toy && f.p.toy.sample) s.setSample(f.p.toy.sample);
      tmGiveSample(s, tmPresetOf(f.p));
      tmSendDrops({ s }, f.p);
      s.output.connect(out);
      k = { s, out };
      tmKeys.set(pluginId, k);
      tmTrack(f.t.id, s, tmPresetOf(f.p) || TM_INIT);
      k.laneId = f.t.id;
    }
    return k;
  }
  // Linked synths play together from either synth's keyboard, each in its own octave (Eman, 6 Nov 22:09).
  // KT2_KEYS_ONE = old (only the synth whose window it is, no octave).
  const tmFan = new Map();   // pluginId:pitch -> [[k, pitch it plays]]
  handlers.toyMachineNote = ({ pluginId, pitch, velocity, on }) => {
    const f = tmFind(pluginId);
    if (!f || !tmApi) return { ok: false };
    ctx.resume();
    const id = pluginId + ":" + pitch;
    if (!on) { for (const [k, q] of tmFan.get(id) || []) k.s.noteOff(q); tmFan.delete(id); return { ok: true }; }
    for (const [k, q] of tmFan.get(id) || []) k.s.noteOff(q);
    let list = [[pluginId, window.KT2_KEYS_ONE ? 0 : f.t.oct || 0]];
    const t = f.t, main = t.layerOf ? S.tracks.find((x) => x.id === t.layerOf) : t;
    if (!window.KT2_KEYS_ONE && main && (t === main || t.linked !== false)) {
      list = stackPlayers(main)
        .map((x) => { const L = x === t ? f.p : tmPlugins(x)[0]; return L && L.enabled !== false ? [L.id, x.oct || 0] : null; }).filter(Boolean);
    } else if (!window.KT2_KEYS_ONE && main && !stackPlayers(main, t).length) list = [];   // a cut synth: muted / not the soloed one
    const fan = [];
    for (const [pid, oct] of list) { const k = tmKeyFor(pid); if (!k) continue; const q = Math.max(0, Math.min(127, pitch + 12 * oct)); k.s.noteOn(q, velocity || 100); fan.push([k, q]); if (window.__pvLog) window.__pvLog.push("key " + pid + "@" + q); }
    tmFan.set(id, fan);
    return { ok: true };
  };
  handlers.toyMachineBend = ({ pluginId, value }) => { const k = tmKeys.get(pluginId); if (k) k.s.bend(value); return { ok: true }; };
  handlers.toyMachineWheel = ({ pluginId, value }) => { const k = tmKeys.get(pluginId); if (k) k.s.wheel(value); return { ok: true }; };
  // The window's landscape moves with the sound: besides the level it gets 8 spectrum bands
  // (0..1, 40 Hz..10 kHz) and 64 points of the waveform (one stable slice, normalised).
  const tmScopes = new WeakMap();
  function tmScope(s) {
    let sc = tmScopes.get(s);
    if (!sc && s.output) {
      const an = ctx.createAnalyser();
      an.fftSize = 2048; an.smoothingTimeConstant = 0.5;
      s.output.connect(an);
      sc = { an, time: new Float32Array(2048), freq: new Float32Array(1024) };
      tmScopes.set(s, sc);
    }
    return sc;
  }
  function tmShape(sc, bands, wave) {
    const { an, time, freq } = sc, hz = ctx.sampleRate / an.fftSize;
    an.getFloatFrequencyData(freq);
    for (let k = 0; k < 8; k++) {
      const lo = Math.max(1, Math.round((40 << k) / hz)), hi = Math.max(lo + 1, Math.round((80 << k) / hz));
      let e = 0;
      for (let i = lo; i < hi && i < freq.length; i++) e += Math.pow(10, freq[i] / 10);
      bands[k] = Math.max(bands[k], Math.min(1, Math.max(0, (10 * Math.log10(e / (hi - lo) + 1e-12) + 90) / 70)));
    }
    an.getFloatTimeDomainData(time);
    let z = 0; // start on a rising zero crossing so the shape holds still for a steady note
    for (let i = 1; i < 1024; i++) if (time[i - 1] <= 0 && time[i] > 0) { z = i; break; }
    let pk = 1e-6;
    for (let i = 0; i < 1024; i++) pk = Math.max(pk, Math.abs(time[z + i]));
    for (let i = 0; i < 64; i++) wave[i] += time[z + i * 16] / pk;
  }
  // one lane's sound after its fader and pan (the INST card's live circle, 6 Nov): { peak, bands[8], wave[64] }
  const laneScopes = new WeakMap();
  handlers.laneMeter = ({ trackId }) => {
    const node = trackPans.get(trackId), bands = new Array(8).fill(0), wave = new Array(64).fill(0);
    if (!node || !S.transport.playing) return { ok: true, peak: 0, bands, wave };
    let sc = laneScopes.get(node);
    if (!sc) { const an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.5; node.connect(an); sc = { an, time: new Float32Array(2048), freq: new Float32Array(1024) }; laneScopes.set(node, sc); }
    sc.an.getFloatTimeDomainData(sc.time);
    let peak = 0; for (let i = 0; i < 2048; i++) peak = Math.max(peak, Math.abs(sc.time[i]));
    if (peak > 1e-4) tmShape(sc, bands, wave);
    return { ok: true, peak, bands, wave };
  };
  handlers.toyMachineMeter = ({ pluginId }) => {
    let peak = 0, n = 0, dice = null, arp = -1;
    const f = tmFind(pluginId), bands = new Array(8).fill(0), wave = new Array(64).fill(0);
    for (const s of f ? tmSynths(f.t) : []) {
      const m = s.meter();
      peak = Math.max(peak, m.peak);
      if (!dice && m.dice) dice = m.dice; // where the dice have moved the points (the window draws them there)
      if (m.arp >= 0) arp = m.arp;   // the ARP page's playhead
      const sc = tmScope(s);
      if (sc) { tmShape(sc, bands, wave); n++; }
    }
    if (n > 1) for (let i = 0; i < 64; i++) wave[i] /= n;
    return { ok: true, peak, l: peak, r: peak, bands, wave, dice, arp };
  };
  // The browser has no preset folder, so saving downloads the preset file.
  handlers.toyMachineSavePreset = ({ preset }) => {
    const name = ((preset && preset.name) || "TOY MACHINE preset").replace(/[^\w \-]+/g, "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" }));
    a.download = name + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return { ok: true };
  };
  handlers.toyMachineClose = ({ pluginId }) => {
    const k = tmKeys.get(pluginId);
    if (k) { k.s.flush("hard"); k.s.close(); k.out.disconnect(); tmKeys.delete(pluginId); const set = tmLive.get(k.laneId); if (set) set.delete(k.s); }
    return { ok: true };
  };
  // One short note with a preset (clicking presets in the browser).
  let tmAud = null;
  handlers.toyMachineAudition = async ({ preset, pitch, pluginId }) => {
    if (!tmApi) return { ok: false };
    ctx.resume();
    const file = tmShippedFile(preset);   // a sampled preset (808s) waits for its sample, once
    if (file && !tmSampleReady.has(file)) await tmLoadSample(file);
    if (tmAud) { const old = tmAud; setTimeout(() => { old.s.flush("hard"); old.s.close(); old.out.disconnect(); }, 60); old.out.gain.setTargetAtTime(0, ctx.currentTime, 0.015); }
    const out = ctx.createGain();
    out.connect(master);
    const s = tmCreate({ preset, getTransport: () => ({ bpm: S.bpm, songAt: 0, playing: false }) });
    const own = pluginId && tmFind(pluginId);   // the lane's dropped sounds play in the preview too
    if (own && own.p.toy) { if (own.p.toy.sample) s.setSample(own.p.toy.sample); tmSendDrops({ s }, own.p); }
    tmGiveSample(s, preset);
    s.output.connect(out);
    const p = pitch || (preset.category === "Bass" ? 36 : preset.category === "Pads" ? 60 : 60);
    const chord = preset.category === "Guitar" && !window.KT2_TOYGTR_OFF ? [p - 12, p - 5, p, p + 3, p + 7] : /Pads|Keys|Synths/.test(preset.category || "") ? [p, p + 3, p + 7] : [p];   // TOY GTR: a strummed minor chord
    const t = ctx.currentTime + 0.02;
    s.schedule(chord.map((q) => ({ pitch: q, velocity: 105, on: t, off: t + 0.9 })));
    const me = (tmAud = { s, out });
    setTimeout(() => { if (tmAud === me) { tmAud = null; s.close(); out.disconnect(); } }, 6000);
    return { ok: true };
  };
  handlers.toyMachinePresets = async () => {
    if (!tmIndex) {
      // Deep debug 16 Nov: one failed download (a network blip when the page opened) used to be remembered as "there
      // are no presets", so the TOY MACHINE preset list stayed empty until a reload. A failed try is now forgotten and
      // the next time the list is asked for it downloads again. KT2_TMINDEX_RETRY_OFF = old.
      try { tmIndex = await (await fetch("toy-machine/presets/index.json")).json(); if (!Array.isArray(tmIndex)) throw new Error("not a list"); }
      catch (e) { tmIndex = window.KT2_TMINDEX_RETRY_OFF ? [] : null; return { presets: [] }; }
      // Deep debug 16 Nov: the first sound picked had to wait for the whole preset pack (8 MB) to download.
      // The pack is now asked for as soon as the list is shown, so the first pick is ready sooner. Nothing is kept
      // from this fetch (the lane's own load keeps the sound). KT2_TM_PREWARM_OFF = old.
      if (!window.KT2_TM_PREWARM_OFF && tmIndex.length) {
        const e0 = tmIndex[0], f0 = String((e0 && (e0.file || e0.id)) || "").replace(/\.json$/, "");
        if (f0) setTimeout(() => { try { fetch("toy-machine/presets/" + f0.split("/").map(encodeURIComponent).join("/") + ".json").then((r) => r.text(), () => null); } catch (e) { /* the pick fetches it then */ } }, 50);
      }
    }
    return { presets: tmIndex };
  };
  handlers.toyMachineLoadPreset = async ({ id: pid, file }) => {
    try { return { preset: JSON.parse(JSON.stringify(await tmFetchPreset(pid || file))) }; } catch (e) { return { error: e.message }; }
  };

  // TOY DRUMS' window: one level knob per pad (-24..+12 dB), set for every clip of the lane.
  const KIT_DB = [-24, 12], kitText = (db) => (db > 0 ? "+" : "") + db.toFixed(1) + " dB";
  function kitEnsure(p) {
    if ((p.params || []).some((x) => x.id.startsWith("kit:"))) return;
    p.params = Object.keys(p.kit).sort((a, b) => a - b).map((pitch) => {
      const db = 20 * Math.log10((p.kitGain && p.kitGain[pitch]) || 1), v = (db - KIT_DB[0]) / (KIT_DB[1] - KIT_DB[0]);
      return { id: "kit:" + pitch, name: (p.kitName && p.kitName[pitch]) || "Pad " + pitch, value: v, def: v, text: kitText(db) };
    });
  }
  function kitSetParam({ pluginId, paramId, value }) {
    if (!/^kit:/.test(paramId)) return null;
    const t = S.tracks.find((x) => x.clips.some((c) => c.plugins.some((q) => q.id === pluginId)));
    if (!t) return null;
    const pitch = paramId.slice(4), db = KIT_DB[0] + value * (KIT_DB[1] - KIT_DB[0]), text = kitText(db);
    for (const c of t.clips) for (const q of c.plugins) if (q.kit) {
      kitEnsure(q);
      q.kitGain = { ...(q.kitGain || {}), [pitch]: Math.pow(10, db / 20) };
      const prm = q.params.find((x) => x.id === paramId); if (prm) { prm.value = value; prm.text = text; }
    }
    changed();
    if (S.transport.playing && !uwRestart) uwRestart = setTimeout(() => { uwRestart = 0; restartIfPlaying(); }, 90);
    return { ok: true, text };
  }

  // KILLDRUM's window (ui/killdrum.js) reads and writes the whole kit of a lane: every clip's
  // copy changes together, like the pad knobs.
  const KD_FIELDS = ["kit", "kitGain", "kitName", "kitPad", "kitId", "kitTitle", "choke", "kitVoid", "kitVibe", "kitBeat"];
  const kdCopy = (p) => JSON.parse(JSON.stringify(Object.fromEntries(KD_FIELDS.filter((k) => p[k] != null).map((k) => [k, p[k]]))));
  const kdFind = (pluginId) => {
    const t = S.tracks.find((x) => x.clips.some((c) => c.plugins.some((q) => q.id === pluginId)));
    const c = t && t.clips.find((x) => x.plugins.some((q) => q.id === pluginId));
    return t && { t, c, p: c.plugins.find((q) => q.id === pluginId) };
  };
  handlers.killDrumGet = ({ pluginId }) => {
    const h = kdFind(pluginId);
    if (!h || !h.p.kit) return { error: "That lane has no KILLDRUM." };
    const used = {};
    for (const c of h.t.clips) for (const n of c.notes || []) used[n.pitch] = (used[n.pitch] || 0) + 1;
    return { ok: true, kit: kdCopy(h.p), lane: h.t.name, used, bpm: S.bpm };
  };
  // One KILLDRUM gesture (ROLL changes sounds and patterns, a pad's dice its sound and its steps) sends a
  // kit write and a beat write a few ms apart: they share one undo step, so Undo / Cmd+Z takes back the whole roll.
  let kdUndoAt = { pid: null, t: -1e9 };
  function kdUndoStep(pluginId) {
    const now = performance.now();
    if (kdUndoAt.pid === pluginId && now - kdUndoAt.t < 400) return;
    kdUndoAt = { pid: pluginId, t: now };
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
  }
  handlers.killDrumSet = async ({ pluginId, kit, undo = true }) => {
    const h = kdFind(pluginId);
    if (!h || !kit) return { error: "That lane has no KILLDRUM." };
    if (undo) kdUndoStep(pluginId);
    // only VOID's settings changed: its chains follow live, so the loop doesn't restart
    const onlyVoid = KD_FIELDS.every((k) => k === "kitVoid" || kit[k] === undefined || JSON.stringify(kit[k]) === JSON.stringify(h.p[k]));
    // (the FX tab's first write turns its chains on: that one needs a restart to be heard)
    const voidFirst = kit.kitVoid && kit.kitVoid.v === 2 && !(h.p.kitVoid && h.p.kitVoid.v === 2);
    for (const c of h.t.clips) for (const q of c.plugins) if (q.kit) {
      for (const k of KD_FIELDS) if (kit[k] !== undefined) q[k] = JSON.parse(JSON.stringify(kit[k]));
      q.params = []; // the pad knobs pick up new names
    }
    await loadKit(h.p);
    changed();
    if (onlyVoid && !voidFirst) return { ok: true };
    if (S.transport.playing && !uwRestart) uwRestart = setTimeout(() => { uwRestart = 0; restartIfPlaying(); }, 90);
    return { ok: true };
  };
  // Hit one pad now (the window's pads, and its sound browser's preview: `url` plays that sound on the pad).
  handlers.killDrumHit = async ({ pluginId, pitch, velocity = 110, url, pad, unique }) => {
    const h = kdFind(pluginId);
    if (!h) return { error: "That lane has no KILLDRUM." };
    ctx.resume();
    const key = url || h.p.kit[pitch];
    if (!key) return { ok: false };
    let buf = buffers[key];
    if (!buf) { try { await fetchAudio(key, key); } catch (e) { return { error: "Couldn't load that sound." }; } buf = buffers[key]; }
    if (!buf) return { ok: false };
    const out = ctx.createGain();
    out.gain.value = dbToLin(h.t.volume || 0);
    out.connect(master);
    const pass = {}, pp = pad || (h.p.kitPad && h.p.kitPad[pitch]), at = ctx.currentTime + 0.025; // room for the audio thread: a hit that starts late would miss its own short decay envelope
    const padIn = kdPadChain(pp, midiChain(h.c, out), { note: Number(pitch), kit: h.p, pass, pos: null, when: null });
    if (unique && typeof unique === "object") { // a unique hit, heard the way it plays in the beat
      const fake = { pitch, velocity, a: 0, u: unique }, chains = { [pitch]: padIn }, last = {};
      kdUniqueHit(fake, unique, buf, pp, h.p, at, () => padIn, chains, last, 0, () => -1, {});
      const pk = pluginId + ":" + pitch;
      if (kdPreviews.has(pk)) kdCut(kdPreviews.get(pk), at);
      kdPreviews.set(pk, last[pitch]);
      setTimeout(() => out.disconnect(), (buf.duration * 4 + 3) * 1000);
      return { ok: true };
    }
    const hit = kdHit(buf, pp, KD_HEAD * (velocity / 127) * ((h.p.kitGain && h.p.kitGain[pitch]) || 1), at, padIn);
    // a pad's new hit cuts its last one (a long texture bed clicked twice doesn't stack), and Stop silences them all
    const pk = pluginId + ":" + pitch;
    if (kdPreviews.has(pk)) kdCut(kdPreviews.get(pk), at);
    kdPreviews.set(pk, hit);
    kdHitHooks({ buf, pad: pp, note: Number(pitch), gain: hit.g.gain.value, at, songAt: null, padIn, hit, kit: h.p, pass });
    if (!url) kdLayers(pp, KD_HEAD * (velocity / 127) * ((h.p.kitGain && h.p.kitGain[pitch]) || 1), at, padIn, 0, "stack");
    setTimeout(() => out.disconnect(), (buf.duration * 4 + 3) * 1000);
    return { ok: true };
  };
  // The peaks of a pad's sound, for its picture.
  handlers.killDrumPeaks = async ({ url, n = 120 }) => {
    let buf = buffers[url];
    if (!buf) { try { await fetchAudio(url, url); } catch (e) { return { error: "no sound" }; } buf = buffers[url]; }
    if (!buf) return { error: "no sound" };
    const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / n)), peaks = [];
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j++) m = Math.max(m, Math.abs(d[j])); peaks.push(Math.round(m * 1000) / 1000); }
    return { ok: true, peaks, duration: buf.duration };
  };
  // A pad sound's own note (Eman, 14 Nov): KILLDRUM's MIDI editor shows real note names from it. Listened to once
  // per sound (ui/kd-root.js), the page keeps the answer. { midi: null } = no clear pitch (a clap, a hat).
  const kdRoots = new Map();
  handlers.killDrumRoot = async ({ url }) => {
    if (!url || !window.KdRoot) return { error: "no sound" };
    if (kdRoots.has(url)) return kdRoots.get(url);
    let buf = buffers[url];
    if (!buf) { try { await fetchAudio(url, url); } catch (e) { return { error: "no sound" }; } buf = buffers[url]; }
    if (!buf) return { error: "no sound" };
    let r; try { r = window.KdRoot.detect(buf.getChannelData(0), buf.sampleRate); } catch (e) { r = { midi: null, conf: 0 }; }
    const out = { ok: true, ...r }; kdRoots.set(url, out); return out;
  };
  // The BEAT tab (ui/killdrum-beat.js): the pattern is the clip's own MIDI notes (so the piano roll
  // and the Mac app see the same beat); the tab's settings (genre, locks, how many, swing) ride on
  // the lane as kitBeat. Set replaces only the pad notes and keeps any other notes in the clip.
  const KD_PAD_NOTES = new Set([35, 36, 37, 38, 39, 42, 46, 49, 51]);
  handlers.killDrumBeatGet = ({ pluginId }) => {
    const h = kdFind(pluginId);
    if (!h || !h.p.kit) return { error: "That lane has no KILLDRUM." };
    return { ok: true, clipId: h.c.id, clipStart: h.c.start, clipLength: h.c.length, beats: Math.round(h.c.length * S.bpm / 60 * 1000) / 1000, bpm: S.bpm,
             notes: (h.c.notes || []).map((n) => ({ ...n })), beat: h.p.kitBeat ? JSON.parse(JSON.stringify(h.p.kitBeat)) : null, ...(h.c.kdBar ? { kdBar: h.c.kdBar } : {}) };
  };
  // The rhythm brain's view of the song (ui/killdrum-rhythms.js, Eman 8 Nov): what the other lanes already do,
  // so the dice can pick a rhythm that fits them. onsets = a 16-step mask of where the chords / melody notes
  // land in a bar (all the MIDI lanes but the drums), density = notes per bar, key / minor from the project key,
  // words = the KILLDRUM vibe + the dice prompt, audio = the audio clips with what they were heard as (bpm, key).
  handlers.killDrumContext = ({ pluginId }) => {
    const h = kdFind(pluginId), spb = 60 / S.bpm, hist = new Array(16).fill(0);
    let notes = 0, bars = 0, lanes = [], audio = [];
    for (const t of S.tracks) {
      if (h && t === h.t) continue;
      for (const c of t.clips) {
        if (c.active === false) continue;
        const p = c.plugins.find((x) => x.instrument);
        if (c.kind === "midi") {
          if (p && p.kit) continue;   // another drum lane: not what the rhythm follows
          const ns = c.notes || []; if (!ns.length) continue;
          const off = c.start / spb;
          for (const n of ns) { const st = Math.round((off + n.start) * 4); hist[((st % 16) + 16) % 16]++; }
          notes += ns.length; bars += Math.max(1, Math.round((c.beats || c.length / spb) / 4));
          lanes.push({ name: t.name, notes: ns.length, beats: c.beats || Math.round(c.length / spb), low: Math.min(...ns.map((n) => n.pitch)), high: Math.max(...ns.map((n) => n.pitch)) });
        } else if (c.src || c.orig) audio.push({ name: c.name || t.name, bpm: (c.orig && c.orig.bpm) || 0, key: (c.orig && c.orig.key) || null, seconds: Math.round(c.length) });
      }
    }
    const peak = Math.max(...hist, 1); let onsets = 0; for (let i = 0; i < 16; i++) if (hist[i] >= peak * 0.3) onsets |= 1 << i;
    const words = [];
    try { const v = h && h.p.kitVibe; if (v) words.push(...String(typeof v === "string" ? v : JSON.stringify(v)).toLowerCase().split(/[^a-z0-9&+-]+/).filter(Boolean)); } catch (e) { /* none */ }
    try { const d = JSON.parse(localStorage.getItem("kt2.dice") || "{}"); if (d.prompt) words.push(...String(d.prompt).toLowerCase().split(/[^a-z0-9&+-]+/).filter(Boolean)); } catch (e) { /* none */ }
    const k = S.key && S.key.tonic != null && S.key.tonic >= 0 ? S.key : null;
    return { ok: true, bpm: S.bpm, key: k ? { pc: k.tonic % 12, minor: !!k.minor, name: k.name || null } : null, minor: k ? !!k.minor : null,
             onsets: notes ? onsets : 0, hist, density: bars ? Math.round(notes / bars * 10) / 10 : null, lanes, audio, words: [...new Set(words)].slice(0, 40),
             has: { chords: lanes.length > 0, audio: audio.length > 0 } };
  };
  // BAR PICK PER PATTERN (Eman, 16 Nov): a KILLDRUM with BAR 1 / BAR 2 / BAR 3 stays one pattern, and each
  // clip can play just one of its BARs (c.kdBar = the BAR's id; none = the whole order, as before). The window
  // sends every BAR's own notes (kitBars) and the order's notes (kitChain); a clip with a BAR plays that BAR
  // repeated over its length. KT2_KD_CLIPBAR_OFF = old (no icon; clips always play the order).
  const kdPadNote = ({ pitch, start, length, velocity, chance, tune, slide, o, u, line, len, bend, wob, ft }) =>
    ({ pitch, start, length, velocity, ...(line > 0 ? { line } : {}), ...(chance != null && chance < 1 ? { chance } : {}), ...(tune ? { tune } : {}), ...(slide ? { slide: 1 } : {}),
       ...(len > 0 ? { len } : {}), ...(Array.isArray(bend) && bend.length ? { bend: bend.map((q) => q.slice()) } : {}), ...(wob && wob.d > 0 ? { wob: { ...wob } } : {}), ...(ft ? { ft } : {}),
       ...(o > 0 ? { o } : {}), ...(u && typeof u === "object" ? { u: JSON.parse(JSON.stringify(u)) } : {}) });
  const kdKitOf = (c) => (c.plugins || []).find((q) => q.kit);
  function kdBarFill(c, q) {   // a clip's pad notes from its BAR (or the order); its other notes stay
    const spb = 60 / S.bpm, total = c.beats || Math.round(c.length / spb * 1000) / 1000 || 4;
    const vers = (q.kitBeat && Array.isArray(q.kitBeat.vers) ? q.kitBeat.vers : []), bars = q.kitBars || {};
    if (c.kdBar && (vers.length < 2 || !vers.some((v) => v.id === c.kdBar) || !Array.isArray(bars[c.kdBar]))) delete c.kdBar;
    let pads = null;
    if (c.kdBar) {
      const v = vers.find((x) => x.id === c.kdBar), L = 4 * (v.bars || 1), src = bars[c.kdBar]; pads = [];
      for (let at = 0; at < total - 1e-6; at += L) for (const n of src) if (n.start < L - 1e-6 && at + n.start < total - 1e-6) pads.push(kdPadNote({ ...n, start: n.start + at }));
    } else if (Array.isArray(q.kitChain)) pads = q.kitChain.map((n) => kdPadNote(n));
    if (!pads) return;
    c.notes = [...(c.notes || []).filter((n) => !KD_PAD_NOTES.has(n.pitch)), ...pads].sort((a, b) => a.start - b.start);
  }
  handlers.killDrumClipBar = ({ clipId, bar }) => {
    let t = null, c = null;
    for (const tt of S.tracks) for (const cc of tt.clips) if (cc.id === clipId) { t = tt; c = cc; }
    const q = c && kdKitOf(c);
    if (!q) return { error: "That clip has no KILLDRUM." };
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    if (bar) c.kdBar = bar; else delete c.kdBar;
    kdBarFill(c, q);
    changed();
    if (S.transport.playing && !uwRestart) uwRestart = setTimeout(() => { uwRestart = 0; restartIfPlaying(); }, 60);
    return { ok: true, bar: c.kdBar || null };
  };
  handlers.killDrumBeatSet = ({ pluginId, notes, beat, bars, undo = true }) => {
    const h = kdFind(pluginId);
    if (!h || !h.p.kit) return { error: "That lane has no KILLDRUM." };
    if (undo) kdUndoStep(pluginId);
    if (!window.KT2_KD_CLIPBAR_OFF && notes && bars && typeof bars === "object") {
      if (beat) for (const c of h.t.clips) for (const q of c.plugins) if (q.kit) q.kitBeat = JSON.parse(JSON.stringify(beat));
      const chain = notes.filter((n) => KD_PAD_NOTES.has(n.pitch)).map((n) => kdPadNote(n));
      for (const c of h.t.clips) for (const q of c.plugins) if (q.kit) { q.kitBars = JSON.parse(JSON.stringify(bars)); q.kitChain = chain.map((n) => ({ ...n })); }
      // this clip and its linked copies take the change; each one plays its own BAR (or the order)
      for (const c of h.t.clips) if (c === h.c || (h.c.pat && c.pat === h.c.pat)) { const q = kdKitOf(c); if (q) kdBarFill(c, q); }
      changed();
      if (S.transport.playing && !uwRestart) uwRestart = setTimeout(() => { uwRestart = 0; restartIfPlaying(); }, 60);
      return { ok: true };
    }
    if (notes) {
      // a step's chance / pitch / glide / fine offset (o) / unique settings (u) ride on its note (BEAT tab extras)
      const pads = notes.filter((n) => KD_PAD_NOTES.has(n.pitch)).map(({ pitch, start, length, velocity, chance, tune, slide, o, u, line, len, bend, wob, ft }) =>
        ({ pitch, start, length, velocity, ...(line > 0 ? { line } : {}), ...(chance != null && chance < 1 ? { chance } : {}), ...(tune ? { tune } : {}), ...(slide ? { slide: 1 } : {}),
           ...(len > 0 ? { len } : {}), ...(Array.isArray(bend) && bend.length ? { bend: bend.map((q) => q.slice()) } : {}), ...(wob && wob.d > 0 ? { wob: { ...wob } } : {}), ...(ft ? { ft } : {}),
           ...(o > 0 ? { o } : {}), ...(u && typeof u === "object" ? { u: JSON.parse(JSON.stringify(u)) } : {}) }));
      h.c.notes = [...(h.c.notes || []).filter((n) => !KD_PAD_NOTES.has(n.pitch)), ...pads].sort((a, b) => a.start - b.start);
    }
    if (beat) for (const c of h.t.clips) for (const q of c.plugins) if (q.kit) q.kitBeat = JSON.parse(JSON.stringify(beat));
    changed();
    if (notes && S.transport.playing && !uwRestart) uwRestart = setTimeout(() => { uwRestart = 0; restartIfPlaying(); }, 60);
    return { ok: true };
  };

  // KILLDRUM (was TOY DRUMS): a MIDI lane whose notes fire one-shots ("kit": { "36": "audio/kick.wav", ... } in
  // session.json). Gain = velocity / 127 x the pad's level; a note in a "choke" group
  // ([[42, 46]] = closed hat cuts the open hat) stops the group's ringing hit.
  // Each pad ("kitPad": { "36": { tune, decay, drive, cutoff, pan, fx: [{ kind, amount }] } }) runs
  // through its own small chain: pitch (playback rate), decay (fade-out), drive, low-pass, pan, effects.
  const kdCurves = new Map();
  function kdCurve(drive) {
    const k = Math.round(drive * 40) / 40;
    if (kdCurves.has(k)) return kdCurves.get(k);
    const a = 1 + k * 30, c = new Float32Array(2048);
    for (let i = 0; i < c.length; i++) { const v = (i / 2047) * 2 - 1; c[i] = Math.tanh(a * v) / Math.tanh(a); }
    kdCurves.set(k, c);
    return c;
  }
  let kdVerb = null;
  function kdVerbIR() {
    if (kdVerb) return kdVerb;
    const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 7;
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 3); } }
    return (kdVerb = ir);
  }
  // A pad's chain: in -> drive -> low-pass -> effects -> pan -> out. -> its input node.
  function kdPadChain(pad, out, hc = {}) {
    pad = pad || {};
    const input = ctx.createGain();
    let node = input;
    if (pad.drive > 0.01) {
      const ws = ctx.createWaveShaper(), comp = ctx.createGain();
      ws.curve = kdCurve(pad.drive); ws.oversample = "2x";
      comp.gain.value = 1 / (1 + pad.drive * 0.8); // louder only a little as it clips
      node.connect(ws); ws.connect(comp); node = comp;
    }
    if (pad.cutoff != null && pad.cutoff < 0.99) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 60 * Math.pow(20000 / 60, pad.cutoff); f.Q.value = 0.8;
      node.connect(f); node = f;
    }
    for (const fx of pad.fx || []) {
      const amt = fx.amount != null ? fx.amount : 0.5, mix = ctx.createGain(), dry = ctx.createGain();
      if (fx.kind === "reverb" || fx.kind === "delay") {
        const wet = ctx.createGain();
        let w;
        if (fx.kind === "reverb") { w = ctx.createConvolver(); w.buffer = kdVerbIR(); wet.gain.value = amt * 0.9; }
        else {
          w = ctx.createDelay(2); w.delayTime.value = (60 / S.bpm) * 0.75;
          const fb = ctx.createGain(), hp = ctx.createBiquadFilter(); fb.gain.value = 0.25 + amt * 0.45; hp.type = "highpass"; hp.frequency.value = 300;
          w.connect(hp); hp.connect(fb); fb.connect(w); wet.gain.value = amt * 0.7;
        }
        node.connect(dry); node.connect(w); w.connect(wet); dry.connect(mix); wet.connect(mix); node = mix;
      } else if (fx.kind === "clip" || fx.kind === "crush") {
        const ws = ctx.createWaveShaper(), c = new Float32Array(4096);
        if (fx.kind === "clip") { const t = 1 - amt * 0.85; for (let i = 0; i < c.length; i++) { const v = ((i / 4095) * 2 - 1) * (1 + amt * 3); c[i] = Math.max(-t, Math.min(t, v)) / t * 0.8; } }
        else { const steps = Math.round(64 / (1 + amt * 20)); for (let i = 0; i < c.length; i++) { const v = (i / 4095) * 2 - 1; c[i] = Math.round(v * steps) / steps; } }
        ws.curve = c; node.connect(ws); node = ws;
      } else if (fx.kind === "lofi") { // old radio: the lows and highs go, a little grit
        const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), ws = ctx.createWaveShaper();
        hp.type = "highpass"; hp.frequency.value = 80 + amt * 520; lp.type = "lowpass"; lp.frequency.value = 9000 - amt * 6800; lp.Q.value = 1.2;
        ws.curve = kdCurve(0.15 + amt * 0.35);
        node.connect(hp); hp.connect(lp); lp.connect(ws); node = ws;
      } else if (fx.kind === "drive") {
        const ws = ctx.createWaveShaper(); ws.curve = kdCurve(0.3 + amt * 0.7); const g = ctx.createGain(); g.gain.value = 0.7;
        node.connect(ws); ws.connect(g); node = g;
      }
    }
    // Other files can add their own stage per pad (the KILLDRUM FX tab): (audioCtx, node, pad, kitPlugin?) -> node
    // hc: { note, kit (the plugin), pass (one object per play), pos, when (song time = pos + (t - when); null for a single hit) }
    for (const hook of window.KillDrumEngineHooks || []) { try { node = hook(ctx, node, pad, { bpm: S.bpm, ...hc }) || node; } catch (e) { console.error(e); } }
    if (pad.pan) { const pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, pad.pan)); node.connect(pn); node = pn; }
    node.connect(out);
    return input;
  }
  // Where a sample's sound starts (seconds): the first sample over 5% of its peak, at most 0.2 s in.
  const kdOnsets = new WeakMap();
  function kdOnset(buf) {
    if (kdOnsets.has(buf)) return kdOnsets.get(buf);
    const d = buf.getChannelData(0), n = Math.min(d.length, Math.floor(buf.sampleRate * 0.2));
    let pk = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    let i = 0; while (i < n && Math.abs(d[i]) < pk * 0.05) i++;
    const t = i >= n ? 0 : i / buf.sampleRate;
    kdOnsets.set(buf, t); return t;
  }
  // One hit: the sample at the pad's pitch, faded out by its decay. -> { src, g }
  // Every pad sound is brought to the same peak (-6 dBFS) before KD_HEAD, wherever it came from: the
  // Splice previews already are, the old remade Library hits peak 4-5 dB hotter. At most +12 dB.
  const kdPeaks = new WeakMap();
  function kdNorm(buf) {
    if (window.KD_LEVEL_OLD) return 1;
    if (kdPeaks.has(buf)) return kdPeaks.get(buf);
    let pk = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; } }
    const g = pk > 1e-4 ? Math.min(4, 0.5 / pk) : 1;
    kdPeaks.set(buf, g); return g;
  }
  function kdHit(buf, pad, gain, at, padIn) {
    pad = pad || {};
    gain *= kdNorm(buf);
    if (pad.gainDb) gain *= Math.pow(10, pad.gainDb / 20);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    const rate = Math.pow(2, (pad.tune || 0) / 12);
    src.playbackRate.value = rate;
    g.gain.setValueAtTime(gain, at);
    const on = kdOnset(buf) / rate, full = buf.duration / rate - on;
    src.connect(g); g.connect(padIn); src.start(at); // start before any stop(): stop() throws on a source not started yet
    if (pad.decay != null && pad.decay < 0.99) {
      // the fade counts from where the sound starts (mp3 previews carry 20-60 ms of silence first)
      const len = Math.max(0.04, full * Math.pow(Math.max(pad.decay, 0.02), 1.5)), t0 = at + on;
      g.gain.setValueAtTime(gain, t0 + len * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0005, t0 + len);
      src.stop(t0 + len + 0.02);
    }
    voices.push(src);
    const endAt = pad.decay != null && pad.decay < 0.99 ? at + on + Math.max(0.04, full * Math.pow(Math.max(pad.decay, 0.02), 1.5)) : at + buf.duration / rate;
    return { src, g, rate, endAt };
  }
  // Kit level (7 Nov, the DAW loudness standard: drums about -17 LUFS at 100% fader). The pad sounds
  // peak at -6 dBFS (kdNorm); x1.6 puts the starter beat at -17.8 LUFS with its loudest hit at
  // -0.8 dBFS (measured in the page, 7 Nov). It was 0.5 (-12 dBFS hits,
  // -29 LUFS beats: the kicks sounded small and thin next to the synths). KD_LEVEL_OLD = old.
  // A pad hit again cuts its own ringing hit (self-choke), so 808s and open hats don't pile up.
  const KD_HEAD = window.KD_LEVEL_OLD ? 0.5 : 1.6;
  // KILLDRUM PUNCH (Eman, 16 Nov: "the kick is so low, even when just 1 kick"). The hits already peak near 0 dB, so
  // a plain boost only made the master limiter/AUTO pull the whole song down. Instead the kit goes +KD_PUNCH_DB into
  // a soft clipper (the trap drum-bus trick): the very tips of the transients are rounded off and the body of the
  // kick/808/snare comes up ~4 dB louder next to the synths. Lane fader, mute and pad effects work as before.
  // KT2_DRUM_PUNCH_OLD = the old level (no boost, no clip).
  const KD_PUNCH_DB = 5, KD_PUNCH_T = 0.55;   // boost; level where the clip starts rounding (out of 1.0)
  let kdPunchCurve = null;
  function kdPunch(input) {
    if (window.KT2_DRUM_PUNCH_OLD) return input;
    if (!kdPunchCurve) {
      // the shaper sees x/2 (so +6 dB of headroom goes in un-clamped): curve[v] = clip(2v). Linear up to T,
      // then a tanh knee that never passes 0.98 (-0.2 dBFS)
      const N = 4097, T = KD_PUNCH_T, R = 0.98 - T;
      kdPunchCurve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = ((i / (N - 1)) * 2 - 1) * 2, a = Math.abs(x);
        kdPunchCurve[i] = Math.sign(x) * (a <= T ? a : T + R * Math.tanh((a - T) / R));
      }
    }
    const pre = ctx.createGain(), ws = ctx.createWaveShaper();
    pre.gain.value = Math.pow(10, KD_PUNCH_DB / 20) / 2;
    ws.curve = kdPunchCurve; ws.oversample = "2x";
    pre.connect(ws); ws.connect(input);
    return pre;
  }
  // a pad's extra lines (BEAT tab, note.line) are voices of their own: a hit only cuts its own line's ringing hit
  const kdVoice = (n) => (n.line ? n.pitch + ":" + n.line : n.pitch);
  function kdCut(prev, at) {
    if (!prev) return;
    prev.g.gain.cancelScheduledValues(at); prev.g.gain.setValueAtTime(prev.g.gain.value, at); prev.g.gain.linearRampToValueAtTime(0, at + 0.006);
    try { prev.src.stop(at + 0.012); } catch (e) { /* done */ }
    if (prev.endAt > at + 0.012) prev.endAt = at + 0.012;
  }
  // Pad layers (kitPad.layers = [{ url, gain, tune, pan }]): "stack" plays them all with the main
  // sound; "turns" (layerMode) plays one per hit, round robin with the main sound. -> the last hit
  // (onHit, if given, hears every layer hit, so the clip's end can fade them all)
  function kdLayers(pp, gain, at, padIn, k, mode, onHit) {
    const ls = (pp && pp.layers) || [];
    if (!ls.length || (pp.layerMode === "turns") !== (mode === "turns")) return null;
    const pick = mode === "turns" ? [ls[(k % (ls.length + 1)) - 1]] : ls;
    let hit = null;
    for (const l of pick) {
      const lb = l && buffers[l.url || l];
      if (!lb) continue;
      let dest = padIn;
      if (l.pan) { const pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, l.pan)); pn.connect(padIn); dest = pn; }
      hit = kdHit(lb, { ...pp, tune: (pp.tune || 0) + (l.tune || 0) }, gain * (l.gain != null ? l.gain : mode === "turns" ? 1 : 0.7), at, dest);
      if (onHit) onHit(hit);
    }
    return hit;
  }
  const kdHitHooks = (info) => { for (const fn of window.KillDrumHitHooks || []) { try { fn(ctx, info); } catch (e) { console.error(e); } } };
  // A note's extras from the BEAT tab: chance (0..1, rolled again every pass), tune (semitones on
  // top of the pad's own) and slide (glide from the pad's ringing hit into this pitch, like an 808).
  const kdGlide = (prev, rate, at, dur) => {
    if (!prev || !prev.src || !prev.src.playbackRate) return false;
    const pr = prev.src.playbackRate;
    pr.cancelScheduledValues(at); pr.setValueAtTime(prev.rate || pr.value, at); pr.exponentialRampToValueAtTime(Math.max(0.05, rate), at + dur);
    prev.rate = rate; return true;
  };
  // KILLDRUM automation (9 Nov overnight test: drum lanes had no lines at all). A line on a drum lane moves one
  // pad's bar or effect, param "kd.<note>.<bar>" (tune decay drive cutoff pan level) or "kd.<note>.fx.<kind>",
  // v = the bar's position 0..1 (ui/killdrum-beat.js). It is read at every hit, so each hit plays the line's value
  // at its own time. A pad whose drive / filter / pan / effects move gets a chain per value (cached per play).
  // KD_AUTO_OFF = lines on drum lanes do nothing (old).
  const KD_BARS = { tune: [-24, 24], decay: [0, 1], drive: [0, 1], cutoff: [0, 1], pan: [-1, 1], level: [-24, 12] };
  function kdAutoLanes(c) {
    if (window.KD_AUTO_OFF || !AUTO) return null;
    const t = S.tracks.find((x) => x.clips.some((y) => y.id === c.id));
    const out = new Map();
    for (const l of t ? autoOf(t) : []) {
      const m = l.target.type === "synth" && /^kd\.(\d+)\.(?:(fx)\.)?([a-z]+)$/.exec(l.target.param || "");
      if (!m || (!m[2] && !KD_BARS[m[3]])) continue;
      if (!out.has(m[1])) out.set(m[1], []);
      out.get(m[1]).push({ fx: !!m[2], k: m[3], l });
    }
    return out.size ? out : null;
  }
  // the pad at song time `at` with its lines on -> { pad, gain (times the pad's own level), key (null: the row's own chain) }
  function kdAutoPad(list, pp, kitGain, at) {
    const pad = { ...(pp || {}), fx: ((pp && pp.fx) || []).map((f) => ({ ...f })) };
    let gain = 1; const key = [];
    for (const a of list) {
      const v = AUTO.valueAt(a.l, at);
      if (a.fx) {
        const f = pad.fx.find((q) => q.kind === a.k);
        if (v <= 0.01) { if (f) pad.fx.splice(pad.fx.indexOf(f), 1); } else if (f) f.amount = v; else pad.fx.push({ kind: a.k, amount: v });
        key.push(a.k + Math.round(v * 64)); continue;
      }
      const [lo, hi] = KD_BARS[a.k], x = lo + (hi - lo) * v;
      if (a.k === "level") gain = Math.pow(10, x / 20) / (kitGain || 1);
      else if (a.k === "tune") pad.tune = Math.round(x);
      else if (a.k === "decay") pad.decay = x;
      else { pad[a.k] = x; key.push(a.k + Math.round(v * 64)); }
    }
    return { pad, gain, key: key.length ? key.join(",") : null };
  }
  // The BEAT tab's row MIDI editor (14 Nov): a note may hold for a set length (len, beats: the hit fades out at its end,
  // longer when slides carry on from it), and carry a pitch line (bend [[beats, semis]]), a wobble (wob { d semis, r per
  // beat, sh 0 sine 1 tri 2 square 3 saw, f fade-in }) and a fine pitch (ft cents). They move the hit's detune, so they add
  // to its tune and to a glide. KD_ROWMIDI_OFF = notes play as before.
  function kdExpr(hit, n, at, spb, endAt) {
    if (window.KD_ROWMIDI_OFF || !hit || !hit.src || !hit.src.detune) return;
    const dt = hit.src.detune, base = n.ft || 0, B = Array.isArray(n.bend) ? n.bend : [];
    try {
      if (B.length) {
        dt.setValueAtTime(base + B[0][1] * 100, at);
        for (let i = 1; i < B.length; i++) dt.linearRampToValueAtTime(base + B[i][1] * 100, at + Math.max(0, B[i][0]) * spb);
      } else if (base) dt.setValueAtTime(base, at);
      const w = n.wob;
      if (w && w.d > 0) {
        const o = ctx.createOscillator(), g = ctx.createGain(), len = Math.max(0.05, (endAt || hit.endAt || at + 1) - at);
        o.type = ["sine", "triangle", "square", "sawtooth"][w.sh | 0] || "sine"; o.frequency.value = Math.max(0.05, (w.r || 4) / spb);
        const depth = Math.min(12, w.d) * 100;
        if (w.f > 0) { g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(depth, at + len * Math.min(1, w.f)); } else g.gain.setValueAtTime(depth, at);
        o.connect(g); g.connect(dt); o.start(at); o.stop(at + len + 0.05);
        voices.push(o);
      }
    } catch (e) { /* an old browser without detune */ }
  }
  // where a held note really ends: its own end, or the end of the slides that glide on from it (same voice)
  function kdHoldEnd(notes, k, spb) {
    const n = notes[k]; let end = n.a + n.len * spb;
    for (let j = k + 1; j < notes.length; j++) {
      const q = notes[j]; if (kdVoice(q) !== kdVoice(n)) continue;
      if (!q.slide || q.a > end + 0.01) break;
      end = Math.max(end, q.a + (q.len > 0 ? q.len : q.length || 0.25) * spb);
    }
    return end;
  }
  function playKit(c, pos, when, input, p) {
    const spb = 60 / S.bpm, ringing = {}, chains = {}, last = {}, turns = {}, rung = []; // rung: every hit of this pass, [pitch, hit]
    const turnOf = (pitch) => turns[pitch] - 1;
    const groupOf = (pitch) => (p.choke || []).findIndex((g) => g.includes(Number(pitch)));
    const padIn = (pitch) => chains[pitch] || (chains[pitch] = kdPadChain(p.kitPad && p.kitPad[pitch], input, { note: Number(pitch), kit: p, pass: chains, pos, when }));
    const solo = !!(laneSolo && laneSolo.clipId === c.id && (laneSolo.notes || laneSolo.tile));
    const src = solo ? (laneSolo.notes || soloTile(c, c.notes)) : c.notes; // SOLO plays the open pattern (or the whole order, or the clip repeated), even past the clip's end
    const clipLen = solo ? Math.max(c.length, S.loopEnd - c.start) : c.length;
    const notes = (src || []).map((n) => ({ ...n, a: c.start + n.start * spb + (c.delay || 0) }))
      .filter((n) => n.a >= pos - 1e-4 && n.a < c.start + clipLen).sort((x, y) => x.a - y.a);
    const kdAuto = kdAutoLanes(c);
    for (const n0 of notes) {
      if (n0.chance != null && n0.chance < 1 && Math.random() >= n0.chance) continue;
      const buf = buffers[p.kit[n0.pitch]];
      const pp0 = p.kitPad && p.kitPad[n0.pitch], n = n0;
      if (n0.slide && last[kdVoice(n0)] && last[kdVoice(n0)].endAt > when + (n0.a - pos)) { // glide the ringing hit, no new hit
        const at = when + (n0.a - pos), rate = Math.pow(2, (((pp0 && pp0.tune) || 0) + (n0.tune || 0)) / 12);
        if (kdGlide(last[kdVoice(n0)], rate, at, Math.min(0.12, Math.max(0.03, (n0.length || 0.25) * spb * 0.5)))) { if (!window.KD_ROWMIDI_OFF && (n0.bend || n0.wob || n0.ft)) kdExpr(last[kdVoice(n0)], n0, at, spb); continue; }
      }
      if (!buf) { if (/^(library|killdrum)\//.test(p.kit[n.pitch] || "")) loadKit(p); continue; } // a saved kit loads on first play
      const at = when + (n.a - pos);
      let pp = p.kitPad && p.kitPad[n.pitch], aG = 1, pin = null;
      const kdA = kdAuto && kdAuto.get(String(n.pitch));
      if (kdA) {
        const r = kdAutoPad(kdA, pp, p.kitGain && p.kitGain[n.pitch], n.a);
        pp = r.pad; aG = r.gain;
        if (r.key) { const ck = n.pitch + "@" + r.key; pin = chains[ck] || (chains[ck] = kdPadChain(pp, input, { note: Number(n.pitch), kit: p, pass: chains, pos, when })); }
      }
      const padInN = (x) => (pin && String(x) === String(n.pitch) ? pin : padIn(x));
      if (!(pp && pp.poly)) kdCut(last[kdVoice(n)], at);
      const k = (turns[n.pitch] = (turns[n.pitch] || 0) + 1) - 1, nl = ((pp && pp.layers) || []).length;
      const u = n.u && typeof n.u === "object" ? n.u : null;
      if (u) { kdUniqueHit(n, u, buf, pp, p, at, padInN, chains, last, pos, groupOf, ringing, aG); continue; }
      if (pp && pp.layerMode === "turns" && nl && k % (nl + 1)) { // round robin: this hit plays a layer instead
        const hitL = kdLayers(pp, KD_HEAD * ((n.velocity || 100) / 127) * ((p.kitGain && p.kitGain[n.pitch]) || 1) * aG, at, padInN(n.pitch), k, "turns", (h) => rung.push([n.pitch, h]));
        if (hitL) last[kdVoice(n)] = hitL;
        continue;
      }
      const ppN = n.tune ? { ...(pp || {}), tune: ((pp && pp.tune) || 0) + n.tune } : pp;
      const hit = kdHit(buf, ppN, KD_HEAD * ((n.velocity || 100) / 127) * ((p.kitGain && p.kitGain[n.pitch]) || 1) * aG, at, padInN(n.pitch));
      last[kdVoice(n)] = hit; rung.push([n.pitch, hit]);
      if (!window.KD_ROWMIDI_OFF && (n.len > 0 || n.bend || n.wob || n.ft)) {
        const holdTo = n.len > 0 ? when + (kdHoldEnd(notes, notes.indexOf(n0), spb) - pos) : 0;
        kdExpr(hit, n, at, spb, holdTo || hit.endAt);
        if (holdTo && hit.endAt > holdTo) kdFadeOut(hit, holdTo, 0.03);
      }
      kdHitHooks({ buf, pad: pp, note: Number(n.pitch), gain: hit.g.gain.value, at, songAt: n.a, padIn: padInN(n.pitch), hit, kit: p, pass: chains });
      kdLayers(pp, KD_HEAD * ((n.velocity || 100) / 127) * ((p.kitGain && p.kitGain[n.pitch]) || 1) * aG, at, padInN(n.pitch), turnOf(n.pitch), "stack", (h) => rung.push([n.pitch, h]));
      const grp = groupOf(n.pitch);
      if (grp >= 0) {
        if (ringing[grp] !== last[kdVoice(n)]) kdCut(ringing[grp], at);
        ringing[grp] = hit;
      }
    }
    // When the MIDI ends, the sound ends (Eman, 27 Oct: a texture bed kept hissing for seconds after the
    // drums stopped). FX and texture pads (long noise beds, risers) fade out at the clip's end; the rest
    // may ring 0.6 s past it (an 808 on the last step), then fade. Every hit, stacked layers and poly hits too.
    const endAt = when + (c.start + clipLen - pos);
    for (const [pitch, h] of rung) {
      const bed = String(pitch) === "49" || String(pitch) === "51", stopAt = endAt + (bed ? 0 : 0.6);
      if (h && h.g && h.endAt > stopAt) kdFadeOut(h, stopAt, bed ? 0.08 : 0.25);
    }
  }
  // A unique hit (BEAT tab, MAKE UNIQUE): its own settings sit on top of the row. Pitch adds, decay
  // shortens, level adds dB; its drive / filter / pan / effects run in a small chain of its own that
  // feeds the row's chain, so the row's knobs and effects still reach it.
  function kdUniqueHit(n, u, buf, pp, p, at, padIn, chains, last, pos, groupOf, ringing, aG = 1) {
    const key = n.pitch + "~" + (u.id || "u");
    const dest = chains[key] || (chains[key] = kdPadChain({ drive: u.drive, cutoff: u.cutoff, pan: u.pan, fx: u.fx }, padIn(n.pitch), {}));
    const d = ((pp && pp.decay != null ? pp.decay : 1)) * (u.decay != null ? u.decay : 1);
    const ppN = { ...(pp || {}), tune: ((pp && pp.tune) || 0) + (n.tune || 0) + (u.tune || 0), decay: d < 0.99 ? d : undefined };
    const g = KD_HEAD * ((n.velocity || 100) / 127) * ((p.kitGain && p.kitGain[n.pitch]) || 1) * aG * Math.pow(10, (u.level || 0) / 20);
    if (!(pp && pp.poly)) kdCut(last[kdVoice(n)], at);
    const hit = kdHit(buf, ppN, g, at, dest);
    last[kdVoice(n)] = hit;
    kdHitHooks({ buf, pad: pp, note: Number(n.pitch), gain: hit.g.gain.value, at, songAt: n.a, padIn: padIn(n.pitch), hit, kit: p, pass: chains });
    if (pp && pp.layerMode !== "turns") kdLayers(pp, g, at, dest, 0, "stack");
    const grp = groupOf(n.pitch);
    if (grp >= 0) { if (ringing[grp] !== hit) kdCut(ringing[grp], at); ringing[grp] = hit; }
  }
  function kdFadeOut(h, at, fade) {
    if (at <= ctx.currentTime) at = ctx.currentTime + 0.01;
    const gp = h.g.gain;
    try { if (gp.cancelAndHoldAtTime) gp.cancelAndHoldAtTime(at); else { gp.cancelScheduledValues(at); gp.setValueAtTime(gp.value, at); } gp.linearRampToValueAtTime(0, at + fade); } catch (e) { /* gone */ }
    try { h.src.stop(at + fade + 0.02); } catch (e) { /* done */ }
    h.endAt = at + fade;
  }

  // Instrument lanes: a small two-oscillator synth stands in for 4OSC / Serum, so the
  // notes from the piano roll are heard; the clip's effects come after it.
  // A variation (take) of a MIDI part plays its notes, and its tone if it has one.
  function midiView(c) {
    let v = c;
    if (c.takeNotes) {
      const k = c.audition != null ? c.audition : c.take;
      v = { ...c, notes: k === c.take ? c.notes : c.takeNotes[k] || c.notes, tone: c.takeTone && c.takeTone[k] };
    }
    // SOLO over more bars than the pattern: the pattern repeats to fill the loop (Eman, 31 Oct)
    if (laneSolo && laneSolo.tile && laneSolo.clipId === c.id) v = { ...v, notes: soloTile(c, v.notes), length: Math.max(c.length, S.loopEnd - c.start) };
    return midiLevel(v);
  }
  function soloTile(c, notes) {
    const beats = c.length / (60 / S.bpm), total = (S.loopEnd - c.start) / (60 / S.bpm), out = [];
    if (!(beats > 0.01)) return notes || [];
    for (let k = 0; k * beats < total - 1e-6; k++)
      for (const n of notes || []) { const st = n.start + k * beats; if (st < total - 1e-6 && n.start < beats - 1e-6) out.push({ ...n, start: st, length: Math.min(n.length, total - st) }); }
    return out;
  }
  // A MIDI clip's effects (after its instrument) and its variation tone, into `out`. -> the chain's input.
  function midiChain(c, out, fxs = []) {
    let node = ctx.createGain();
    const input = node;
    for (const p of c.plugins) {
      if (!p.enabled || p.instrument) continue;
      const fx = buildEffect(p);
      fxs.push(fx);
      node.connect(fx.input); node = fx.output;
    }
    if (c.tone) {
      if (c.tone.highcut > 0) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = c.tone.highcut; node.connect(f); node = f; }
      if (c.tone.drive > 0) {
        const ws = ctx.createWaveShaper(), k = 1 + c.tone.drive * 20, curve = new Float32Array(1024);
        for (let i = 0; i < curve.length; i++) { const v = (i / 1023) * 2 - 1; curve[i] = Math.tanh(k * v) / Math.tanh(k); }
        ws.curve = curve; node.connect(ws); node = ws;
      }
    }
    node.connect(out);
    return input;
  }
  function playMidi(c, pos, when, out, key) {
    const spb = 60 / S.bpm;
    c = midiView(c);
    const input = midiLevelNode(c, midiChain(c, out), pos, when);
    const tmPlug = c.plugins.find(isTM);
    if (tmPlug) return playTM([c], pos, when, input, tmPlug, key || "preview");
    const kit = c.plugins.find((p) => p.instrument && p.kit);
    if (kit) return playKit(c, pos, when, kdPunch(input), kit);
    const uw = uwKind(c);
    if (uw) {
      // the loudness standard for lanes made from now on (songs keep their mix): measured in this app, 140 BPM, 4 bars
      const lane = S.tracks.find((t) => t.clips.some((x) => x.id === c.id)), trim = lane && lane.lvl && !window.KT_LEVEL_OLD ? UW_STANDARD_DB[uw] || 0 : 0;
      let into = input;
      if (trim) { into = ctx.createGain(); into.gain.value = dbToLin(trim); into.connect(input); }
      return uw === "808" ? play808(c, pos, when, into) : uw === "lead" ? playLead(c, pos, when, into) : playKT(c, pos, when, into);
    }
    const serum = c.plugins.some((p) => p.instrument && /serum/i.test(p.name));
    for (const n of c.notes || []) {
      const a = c.start + n.start * spb, b = Math.min(c.start + c.length, a + n.length * spb);
      if (b <= pos) continue;
      const at = when + Math.max(0, a - pos), end = when + (b - pos);
      const f = 440 * Math.pow(2, (n.pitch - 69) / 12), v = 0.12 * ((n.velocity || 100) / 127);
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.Q.value = serum ? 6 : 1;
      lp.frequency.setValueAtTime(f * (serum ? 10 : 6), at); lp.frequency.exponentialRampToValueAtTime(f * 2, end + 0.05);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + 0.008);
      g.gain.setTargetAtTime(v * 0.6, at + 0.01, 0.15); g.gain.setTargetAtTime(0, end, 0.06);
      for (const [type, det] of serum ? [["sawtooth", -9], ["sawtooth", 9]] : [["sawtooth", 0], ["square", -1200]]) {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(at); o.stop(end + 0.4);
        voices.push(o);
      }
      lp.connect(g); g.connect(input);
    }
  }

  // Piano roll preview: one held note through the clip's instrument and effects, at the
  // lane's volume. A new pitch replaces the one sounding; it stops when you let go.
  let heard = null;
  const held = new Map();   // computer-keyboard notes, several at once: key -> sound (Eman, 6 Nov 21:58)
  function previewOff(fade = 0.03, one) {
    if (!one && !heard) return;
    const h = one || heard, t = ctx.currentTime;
    if (!one) heard = null;
    h.out.gain.cancelScheduledValues(t);
    h.out.gain.setValueAtTime(h.out.gain.value, t);
    h.out.gain.linearRampToValueAtTime(0, t + fade);
    for (const o of h.srcs) { try { o.stop(t + fade + 0.01); } catch (e) { /* already stopped */ } }
    voices = voices.filter((v) => !h.srcs.includes(v));
    setTimeout(() => h.out.disconnect(), (fade + 0.3) * 1000);
  }
  handlers.previewNote = ({ clipId, pitch, velocity, key, voice }) => {
    const c = findClip(clipId);
    if (!c || c.kind !== "midi") return { ok: false };
    ctx.resume();
    if (key != null) { if (held.has(key)) previewOff(0.015, held.get(key)); } else previewOff(0.015);
    const t = S.tracks.find((x) => x.clips.includes(c)), hold = 4; // seconds, at most
    const out = ctx.createGain();
    out.gain.value = t ? dbToLin(t.volume || 0) : 1;
    out.connect(master);
    const n0 = voices.length, at = ctx.currentTime + 0.005;
    const one = (cc, oct, into) => (window.__pvLog && window.__pvLog.push((cc.plugins.find(isTM) || {}).id + "@" + (pitch + 12 * (oct || 0))), playMidi({ ...cc, start: 0, length: hold, delay: 0, notes: [{ pitch: Math.max(0, Math.min(127, pitch + 12 * (oct || 0))), start: 0, length: hold / (60 / S.bpm), velocity: velocity || 100 }] }, 0, at, into, key != null ? "pvk:" + key : undefined));
    // Linked synths always play together, each in its own octave (Eman, 6 Nov 22:09): the main synth and
    // every stacked synth still joined to it. Writing a cut synth's own notes plays only that one.
    // KT2_PREVIEW_ONE = old (only the pattern's own synth, no octave).
    const main = t && t.layerOf ? S.tracks.find((x) => x.id === t.layerOf) : t;
    const layer = (x) => { const L = tmPlugins(x)[0]; return L && L.enabled !== false ? L : null; };
    const cut = voice != null && S.tracks.find((x) => x.id === voice && x.layerOf && x.linked === false);
    if (window.KT2_PREVIEW_ONE || !main || !c.plugins.some(isTM)) one(c, 0, out);
    else if (cut && layer(cut)) { out.gain.value = dbToLin(cut.volume || 0); if (stackPlayers(main, cut).length) one({ ...c, plugins: [layer(cut)] }, cut.oct, out); }
    else {
      out.gain.value = 1;
      const lanes = stackPlayers(main).filter((x) => x === main || layer(x));
      for (const x of lanes) {
        const g = ctx.createGain(); g.gain.value = dbToLin(x.volume || 0); g.connect(out);
        if (x === main) one(c, x.oct, g); else one({ ...c, plugins: [layer(x)] }, x.oct, g);
      }
    }
    const srcs = voices.slice(n0);
    const me = { out, srcs };
    if (key != null) { held.set(key, me); setTimeout(() => { if (held.get(key) === me) { held.delete(key); previewOff(0.03, me); } }, hold * 1000); return { ok: true }; }
    heard = me;
    setTimeout(() => { if (heard === me) previewOff(); }, hold * 1000);
    return { ok: true };
  };
  handlers.previewNoteOff = ({ key } = {}) => {
    if (key != null) { const h = held.get(key); if (h) { held.delete(key); previewOff(0.05, h); } return { ok: true }; }
    previewOff(); return { ok: true };
  };

  // "Open its window": built-in instruments and effects open their knob panel right here.
  // Plugins from the Mac (VST3 / AU) only run in the app, so they still say so.
  handlers.openPlugin = ({ pluginId }) => {
    const p = [...S.master.plugins, ...(S.returns || []).flatMap((r) => r.plugins), ...S.tracks.flatMap((t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)])].find((x) => x.id === pluginId);
    if (!p) return { error: "That plugin isn't there any more." };
    if (isTM(p)) return { ok: true, toyMachine: true, blobFace: p.face === "blob", toyKeys: isTKPlug(p) && !/toy gtr/i.test(p.name || "") && !!window.ToyKeys, toyGtr: /toy gtr/i.test(p.name || "") && !!window.ToyGtr };
    if (isBLOB(p)) return window.BlobEngine ? { ok: true, blob: true } : { error: "BLOB didn't load on this page." };
    if (p.type === "kttoytune") return window.ToyTuneUI ? { ok: true, toyTune: true } : { error: "TOYTUNE didn't load on this page." };
    if (p.type === "kttoyvox") return window.ToyVoxUI ? { ok: true, toyVox: true } : { error: "TOY VOX didn't load on this page." };
    // (a KILLDRUM lane's first clip can be asked for before its kit is put in: give it the starter kit)
    if (!p.kit && p.instrument && S.tracks.some((t) => /^(TOY DRUMS|KILLDRUM)$/.test(t.instrument || "") && t.clips.some((c) => c.plugins.includes(p)))) { Object.assign(p, starterKit()); p.params = []; loadKit(p); }
    if (p.kit) { kitEnsure(p); return { ok: true, panel: true, killDrum: true }; }
    uwEnsure(p);
    if (p.params && p.params.length) return { ok: true, panel: true };
    return { error: `${p.name} is a plugin on your Mac, so its own window opens in the KILLTOY app.` };
  };

  // BLOB, the paint-a-sound synth (ui/blob-engine.js, from the BLOB thread). A lane's patch lives
  // on its instrument plugin as p.blob (every clip's copy shares it), like TOY MACHINE's p.toy.
  // Each play makes one engine per lane; the window (ui/kt2-blob.js) gets its own for its keys.
  function isBLOB(p) { return !!p && p.instrument && /^blob$/i.test(p.name || "") && p.face !== "blob"; }   // the first, painted BLOB (old sessions)
  const blobPlugins = (t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)].filter(isBLOB);
  const blobLane = (pid) => S.tracks.find((t) => blobPlugins(t).some((q) => q.id === pid));
  const blobLive = new Map();   // laneId -> engines playing it now, so paint is heard at once
  function blobPatchOf(p) {
    if (!p.blob) p.blob = window.BlobEngine.fromPreset(0);
    return p.blob;
  }
  function playBlobLane(t, clips, pos, when, laneIn) {
    if (!window.BlobEngine) return;
    const plug = clips[0].plugins.find(isBLOB), input = midiChain(midiView(clips[0]), laneIn);
    const e = window.BlobEngine.create({ ctx, patch: blobPatchOf(plug), getBpm: () => S.bpm });
    e.output.connect(input);
    if (!blobLive.has(t.id)) blobLive.set(t.id, new Set());
    blobLive.get(t.id).add(e);
    const spb = 60 / S.bpm, notes = [];
    for (const c0 of clips) {
      const c = midiView(c0), end = c.start + c.length;
      for (const n of c.notes || []) {
        const a = c.start + n.start * spb + (c.delay || 0), b = Math.min(end, a + n.length * spb);
        if (b <= pos || b <= a) continue;
        notes.push({ pitch: n.pitch, velocity: n.velocity || 100, on: when + Math.max(0, a - pos), off: when + (b - pos) });
      }
    }
    e.schedule(notes);
    const done = () => { e.close(); const set = blobLive.get(t.id); if (set) set.delete(e); };
    voices.push({ stop: (at) => setTimeout(() => { e.flush(true); done(); }, Math.max(0, ((at || ctx.currentTime) - ctx.currentTime) * 1000) + 30), disconnect: () => {} });
  }
  const blobFind = (pluginId) => { const t = blobLane(pluginId), p = t && blobPlugins(t).find((q) => q.id === pluginId); return p ? { t, p } : null; };
  handlers.blobGetPatch = ({ pluginId }) => {
    const f = blobFind(pluginId);
    if (!f || !window.BlobEngine) return { error: "That BLOB isn't there any more." };
    return { ok: true, patch: JSON.parse(JSON.stringify(blobPatchOf(f.p))), lane: f.t.name };
  };
  handlers.blobSetPatch = ({ pluginId, patch }) => {
    const f = blobFind(pluginId);
    if (!f) return { error: "That BLOB isn't there any more." };
    const pr = JSON.parse(JSON.stringify(patch));
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;   // each finished paint = one Cmd+Z
    for (const q of blobPlugins(f.t)) q.blob = JSON.parse(JSON.stringify(pr));
    for (const e of blobLive.get(f.t.id) || []) e.setPatch(pr);
    return { ok: true };
  };
  handlers.blobSetPatch.undoable = true;
  // The window's own engine (its keys and LISTEN), into the lane's sound when the song plays, else the master.
  window.purpBlobHost = {
    engine(pluginId) {
      const f = blobFind(pluginId);
      if (!f || !window.BlobEngine) return null;
      ctx.resume();
      const e = window.BlobEngine.create({ ctx, patch: blobPatchOf(f.p), getBpm: () => S.bpm });
      e.output.connect(laneIns.get(f.t.id) || master);
      return e;
    }
  };

  function play(pos) {
    ctx.resume();
    S.transport.position = pos;
    S.transport.playing = true;
    startVoices(S.transport.position); // what has loaded plays now; the rest joins as it lands (lateStart)
  }
  function halt() {
    S.transport.position = position();
    S.transport.playing = false;
    stopVoices();
  }
  const restartIfPlaying = () => { if (S.transport.playing) startVoices(position()); };
  window.KT2_softRestart = () => softRestart();   // kt2-link.js: linked sound copies changed after a command
  // after an edit: a seamless rebuild; a drag's steps wait until the hand rests (one rebuild, not 60)
  let softTimer = 0;
  const softRestart = (drag) => {
    if (!S.transport.playing) return;
    clearTimeout(softTimer);
    const go = () => { softTimer = 0; if (S.transport.playing) { startVoices(position(), true); softMode = false; } };
    if (drag) softTimer = setTimeout(go, 140); else go();
  };
  // SOLO | FULL (Eman, 27 Oct, like FL Studio's pattern / song): SOLO loops one lane's pattern on its own
  // from the clip's start; FULL is the normal song. Ending SOLO puts the loop and marker back.
  function soloStart(t, c, start, end, notes, from) {
    if (laneSolo && laneSolo.clipId === c.id) { // already looping this one: new notes / length, keep going (or jump to `from`)
      laneSolo.notes = notes || null; S.loopStart = start; S.loopEnd = end; S.playStart = start;
      if (S.transport.playing) { const at = from != null ? start + from : position(); startVoices(at >= end || at < start - 1e-3 ? start : at); }
      changed(); return;
    }
    if (laneSolo) soloEnd();
    if (S.transport.playing) halt();
    laneSolo = { trackId: t.id, clipId: c.id, notes: notes || null,
                 prev: { loopStart: S.loopStart, loopEnd: S.loopEnd, looping: !!S.transport.looping, position: S.transport.position, playStart: S.playStart } };
    S.loopStart = start; S.loopEnd = end; S.transport.looping = true; S.playStart = start;
    S.transport.soloLane = { trackId: t.id, clipId: c.id, lo: laneSolo.prev.loopStart, hi: laneSolo.prev.loopEnd, on: laneSolo.prev.looping };   // LOOP: the song view hides its marker and keeps showing its own loop (Eman, 31 Oct)
    updateTrackGains(); play(from != null && start + from < end ? start + from : start); changed();
  }
  function soloEnd() {
    if (!laneSolo) return;
    const p = laneSolo.prev; laneSolo = null; delete S.transport.soloLane;
    if (S.transport.playing) halt();
    S.loopStart = p.loopStart; S.loopEnd = p.loopEnd; S.transport.looping = p.looping; S.transport.position = p.position; S.playStart = p.playStart;
    updateTrackGains(); changed();
  }
  // KILLDRUM: loop the open BAR (notes from the BEAT tab, `beats` long) on its own
  // The kit's sounds load on first play, so a fresh KILLDRUM looped silent until they landed (Eman 14 Nov: "it
  // doesn't work"): wait for them first (2.5 s at most). A newer call while waiting wins. KD_SOLO_NOWAIT = old.
  let kdSoloTok = 0;
  handlers.killDrumSolo = (args) => {
    const tok = ++kdSoloTok;
    const h = args && args.on !== false && kdFind(args.pluginId);
    const miss = h && !window.KD_SOLO_NOWAIT && kitUrls(h.p).some((k) => /^(library|killdrum)\//.test(k) && !buffers[k]);
    if (!miss) return kdSoloNow(args);
    return Promise.race([loadKit(h.p), new Promise((r) => setTimeout(r, 2500))])
      .then(() => (tok === kdSoloTok ? kdSoloNow(args) : { ok: true, solo: !!laneSolo, stale: true }));
  };
  const kdSoloNow = ({ pluginId, on = true, notes, beats, from }) => {
    if (!on) { soloEnd(); return { ok: true, solo: false }; }
    const h = kdFind(pluginId);
    if (!h) return { error: "That lane has no KILLDRUM." };
    const spb = 60 / S.bpm, len = Math.max(0.25, +beats || 4) * spb;
    const pads = Array.isArray(notes) ? notes.filter((n) => KD_PAD_NOTES.has(n.pitch)) : null;
    soloStart(h.t, h.c, h.c.start, h.c.start + len, pads, from != null ? Math.max(0, +from || 0) * spb : null);
    return { ok: true, solo: true, start: h.c.start, end: h.c.start + len };
  };
  const atIn = (at, lo, hi) => (at != null && isFinite(at) && at >= lo - 1e-6 && at < hi - 1e-3 ? Math.max(0, at - lo) : null);
  // any instrument lane (TOY MACHINE): loop the plugin's clip on its own
  // bars: how long the loop is from the clip's start (the lane window's SOLO picker, default 16 bars);
  // without it the loop is the clip itself. clipId picks which of the lane's clips it starts on.
  // at: the marker (song seconds); inside the loop, play starts there instead of at the loop's start (Eman, 8 Nov)
  handlers.laneSolo = ({ pluginId, trackId, clipId, on = true, bars, clipLoop, from, to, at }) => {
    if (!on) { soloEnd(); return { ok: true, solo: false }; }
    let h = pluginId && kdFind(pluginId);
    if (!h && trackId) { const t = S.tracks.find((x) => x.id === trackId); const c = t && (t.clips.find((x) => x.id === clipId) || t.clips[0]); if (c) h = { t, c }; }
    if (!h) return { error: "No clip for that instrument." };
    if (clipId && h.c.id !== clipId) { const c = h.t.clips.find((x) => x.id === clipId); if (c) h = { ...h, c }; }
    // from / to (seconds from the clip's start): loop just that part (the audio editor's loop)
    if (to > from && from >= 0) {
      soloStart(h.t, h.c, h.c.start + from, h.c.start + to, null, atIn(at, h.c.start + from, h.c.start + to));
      if (laneSolo) { laneSolo.clipLoop = false; laneSolo.tile = false; }
      return { ok: true, solo: true, start: h.c.start + from, end: h.c.start + to };
    }
    const len = bars > 0 ? bars * 4 * (60 / S.bpm) : h.c.length;
    soloStart(h.t, h.c, h.c.start, h.c.start + len, null, atIn(at, h.c.start, h.c.start + len));
    if (laneSolo) laneSolo.clipLoop = !!clipLoop;
    if (laneSolo) { laneSolo.tile = len > h.c.length + 1e-3; if (laneSolo.tile && S.transport.playing) startVoices(position()); }
    return { ok: true, solo: true, start: h.c.start, end: h.c.start + len };
  };
  handlers.laneSoloState = () => ({ ok: true, solo: !!laneSolo, trackId: laneSolo ? laneSolo.trackId : null, clipId: laneSolo ? laneSolo.clipId : null, start: laneSolo ? S.loopStart : null, end: laneSolo ? S.loopEnd : null });

  // Recording: the song plays and the microphone is recorded onto the armed lane. Looping
  // while recording works like Logic: every pass round the loop becomes another take in one
  // clip (a take folder), so you can open it and comp the best parts. Without a microphone
  // (none, or the browser said no) it falls back to a pretend take: that stretch of the test vocal.
  let recFrom = null, takeNo = 1, recClip = null;
  // The microphone: chunks land in the pass they were sung in, placed by the song time the
  // singer heard (the output latency is taken off). mic.passes[i] = { key, start, data: [Float32Array] }.
  const mic = { stream: null, node: null, src: null, on: false, passes: [], segs: [], level: -100, failed: false, fill: {}, linger: null };
  const micLat = () => (ctx.outputLatency || ctx.baseLatency || 0) + 0.01;
  const micCode = `registerProcessor("kt-mic", class extends AudioWorkletProcessor {
    constructor() { super(); this.b = new Float32Array(2048); this.n = 0; this.f = 0; }
    process(ins) {
      const x = ins[0] && ins[0][0];
      if (!x) return true;
      if (this.n === 0) this.f = currentFrame;
      this.b.set(x, this.n); this.n += x.length;
      if (this.n >= this.b.length) { this.port.postMessage({ f: this.f, x: this.b }, [this.b.buffer]); this.b = new Float32Array(2048); this.n = 0; }
      return true;
    }
  });`;
  const micWorklet = ctx.audioWorklet && window.AudioWorkletNode
    ? ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([micCode], { type: "application/javascript" }))).then(() => true, () => false)
    : Promise.resolve(false);
  function micStart() {
    mic.on = true; mic.passes = []; mic.segs = []; mic.fill = {}; mic.linger = null;
    if (mic.failed || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return Promise.resolve(false);
    const ready = mic.stream ? Promise.resolve(mic.stream)
      : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    return ready.then((stream) => {
      mic.stream = stream;
      if (mic.node) return true;
      // The mic is read on the audio thread (an AudioWorklet), each block stamped with its exact
      // sample frame. The old ScriptProcessor ran on the page's thread: in a heavy song it lost
      // whole chunks, and takes came out silent or full of holes. It stays as the fallback.
      return micWorklet.then((ok) => {
        if (mic.node) return true;
        mic.src = ctx.createMediaStreamSource(stream);
        const mute = ctx.createGain(); mute.gain.value = 0;
        if (ok) {
          mic.node = new AudioWorkletNode(ctx, "kt-mic", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: "explicit" });
          mic.node.port.onmessage = (e) => micChunk(e.data.x, e.data.f);
        } else {
          mic.node = ctx.createScriptProcessor(4096, 1, 1);
          mic.node.onaudioprocess = (e) => micChunk(e.inputBuffer.getChannelData(0));
        }
        mic.src.connect(mic.node); mic.node.connect(mute); mute.connect(ctx.destination);
        return true;
      });
    }, (e) => { mic.failed = true; console.warn("No microphone:", e && e.message); return false; });
  }
  function micChunk(x, frame) {
    let pk = 0;
    for (let i = 0; i < x.length; i += 8) pk = Math.max(pk, Math.abs(x[i]));
    mic.level = pk > 1e-5 ? 20 * Math.log10(pk) : -100;
    // a stopped take keeps taking in its last audio for a moment: in a heavy song it arrives late
    const linger = !mic.on && mic.linger && ctx.currentTime < mic.linger.until;
    if (linger) { mic.segs = mic.linger.segs; mic.passes = mic.linger.passes; }
    else if (!mic.on || !S.transport.recording || !mic.segs.length) return;
    // Chunks are placed back to back on a sample count, not by the clock when the chunk
    // arrives: that clock jitters, so every 4096-sample chunk landed a few samples off and
    // recordings clicked about 10 times a second. Re-anchor only if it drifts past 40 ms.
    const sr = ctx.sampleRate;
    let t0;
    if (frame != null) t0 = frame / sr - micLat();   // the worklet's exact stamp
    else {
      const est = ctx.currentTime - micLat() - x.length / sr;
      if (!mic.clock || Math.abs(mic.clock.base + mic.clock.n / sr - est) > 0.04) mic.clock = { base: est, n: 0 };
      t0 = mic.clock.base + mic.clock.n / sr;
      mic.clock.n += x.length;
    }
    // which play segment (a loop pass) each sample belongs to: the latest one started before it
    let k = mic.segs.length - 1;
    while (k > 0 && mic.segs[k].ctx > t0) k--;
    for (let i = 0; i < x.length; ) {
      const t = t0 + i / sr;
      while (k + 1 < mic.segs.length && mic.segs[k + 1].ctx <= t) k++;
      const seg = mic.segs[k];
      if (t < seg.ctx) { i++; continue; } // before the first pass started
      const pass = mic.passes[seg.pass] || (mic.passes[seg.pass] = { start: seg.pos, data: [] });
      const nextAt = k + 1 < mic.segs.length ? mic.segs[k + 1].ctx : Infinity;
      const n = Math.min(x.length - i, Math.max(1, Math.ceil((nextAt - t) * sr)));
      const at = Math.round((seg.pos + (t - seg.ctx) - pass.start) * sr);
      const piece = x.slice(i, i + n);
      pass.data.push({ at, x: piece });
      // the take may already be made (the loop wrapped before this audio got here): fill it in
      const f = mic.fill[seg.pass];
      if (f) for (let q = 0; q < piece.length; q++) { const j = at + q; if (j >= 0 && j < f.length) f[j] = piece[q]; }
      i += n;
    }
  }
  const micSeg = (pass) => { if (mic.on) mic.segs.push({ ctx: startCtx, pos: startPos, pass }); };
  // A pass's recording as an audio buffer (a key in buffers), or null without a microphone.
  function micBuffer(pass, length) {
    const p = mic.passes[pass];
    if (!mic.stream || (!p && !mic.on)) return null;
    const sr = ctx.sampleRate, n = Math.max(1, Math.round(length * sr)), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    if (p) for (const c of p.data) for (let i = 0; i < c.x.length; i++) { const j = c.at + i; if (j >= 0 && j < n) d[j] = c.x[i]; }
    mic.fill[pass] = d;   // audio for this pass that comes in later still lands in it
    return keep(buf);
  }
  function micStop() {
    mic.linger = mic.segs.length ? { until: ctx.currentTime + 3, segs: mic.segs, passes: mic.passes } : null;
    mic.on = false; mic.segs = []; mic.passes = [];
    setTimeout(() => { if (!mic.on) mic.fill = {}; }, 3200);
  }
  // The pretend take needs the test vocal loaded (another song may be open).
  const pretendReady = () => { if (!buffers.vocals) fetchAudio("vocals", SONG.files.vocals).catch(() => null); };
  const vocalLen = () => (buffers.vocals ? buffers.vocals.duration : 0);
  function passSource(n) { // pass n of the pretend take: a different stretch of the test vocal
    const len = S.loopEnd - S.loopStart, room = Math.max(bar, vocalLen() - len);
    const off = n === 0 ? recFrom : Math.floor(((recFrom + n * 8 * bar) % room) / bar) * bar;
    return { src: "vocals", offset: off, gain: [1, 0.8, 1.1, 0.9][n % 4] };
  }
  // A new take covers [a, b) of the lane: audio clips under it keep what's before and after
  // (like recording over part of a clip in any DAW), instead of the whole clip going.
  function carveOut(lane, a, b) {
    const out = [];
    for (const c of lane.clips) {
      const end = c.start + c.length;
      if (c.kind === "midi" || end <= a || c.start >= b) { out.push(c); continue; }
      if (c.start < a) {
        const cut = a - c.start, left = { ...structuredClone(c), length: cut, fadeOut: 0 };
        if (Array.isArray(left.comp)) left.comp = left.comp.filter((x) => x.start < cut).map((x) => ({ ...x, end: Math.min(cut, x.end) }));
        out.push(left);
      }
      if (end > b) {
        const cut = b - c.start, right = { ...structuredClone(c), id: c.start < a ? id() : c.id, start: b, length: end - b, offset: (c.offset || 0) + cut, fadeIn: 0 };
        if (right.takeSrc) right.takeSrc.forEach((x) => (x.offset = (x.offset || 0) + cut));
        if (Array.isArray(right.comp)) right.comp = right.comp.filter((x) => x.end > cut).map((x) => ({ ...x, start: Math.max(0, x.start - cut), end: x.end - cut }));
        if (c.start < a) right.plugins = (right.plugins || []).map((p) => ({ ...p, id: id(), autoOf: p.autoOf || p.id }));
        out.push(right);
      }
    }
    lane.clips = out;
  }
  // Eman, 24 Nov: every new recording gets TOY VOX, muted. KT2_TOYVOX_AUTO_OFF = no effects, as before.
  const recFx = (lane) => (!window.KT2_TOYVOX_AUTO_OFF && window.KT2ToyVox && window.ToyVoxUI && lane && lane.kind !== "inst" ? [KT2ToyVox.plugin(id, S.key)] : []);
  function addPass() { // called when the loop wraps while recording
    const lane = S.tracks.find((t) => t.armed);
    if (!lane) return;
    let c = recClip && lane.clips.find((x) => x.id === recClip);
    if (!c) {
      carveOut(lane, S.loopStart, S.loopEnd);
      c = { id: id(), name: "Take " + takeNo++, src: "vocals", start: S.loopStart, length: S.loopEnd - S.loopStart,
            offset: recFrom, take: 0, takes: 0, plugins: recFx(lane), takeSrc: [] };
      lane.clips.push(c);
      recClip = c.id;
    }
    const real = micBuffer(c.takeSrc.length, c.length);
    c.takeSrc.push(real ? { src: real, offset: 0, gain: 1 } : passSource(c.takeSrc.length));
    c.takes = c.takeSrc.length > 1 ? c.takeSrc.length : 0;
    c.take = c.takeSrc.length - 1;
    c.comp = null;
    Object.assign(c, { src: c.takeSrc[c.take].src, offset: c.takeSrc[c.take].offset });
    changed();
  }
  function finishTake() {
    if (recFrom == null) return;
    const to = position();
    const lane = S.tracks.find((t) => t.armed);
    if (recClip) { // loop recording: keep the last pass if it got past halfway
      if (S.transport.looping && to - S.loopStart > (S.loopEnd - S.loopStart) / 2) addPass();
    } else if (lane && to - recFrom > 0.5) {
      carveOut(lane, recFrom, to);
      const real = micBuffer(0, to - recFrom);
      lane.clips.push({ id: id(), name: "Take " + takeNo++, src: real || "vocals", start: recFrom, length: to - recFrom, offset: real ? 0 : recFrom, take: 0, takes: 0, plugins: recFx(lane) });
    }
    micStop();
    recFrom = null; recClip = null;
    S.transport.recording = false;
    changed();
  }

  const origRecordDouble = handlers.recordDouble;
  Object.assign(handlers, {
    // FL Studio-style, like the app: stopping goes back to where play was pressed,
    // and Stop again goes to 0:00.
    togglePlay: () => {
      if (laneSolo && laneSolo.clipLoop) {   // a clip's own loop (KILLTOY 2): Space pauses, and plays it again from the clip's start (Eman, 4 Nov)
        if (S.transport.playing) { halt(); S.transport.position = S.loopStart; } else play(S.loopStart);
        changed(); return;
      }
      if (laneSolo) { soloEnd(); return; } // the song's play button ends SOLO
      finishTake();
      if (S.transport.playing) { halt(); S.transport.position = S.playStart || 0; }
      else { S.playStart = S.transport.position; play(S.transport.position); }
    },
    stop: () => {
      if (laneSolo) { soloEnd(); return; }
      finishTake();
      const target = !S.transport.playing && S.transport.position === S.playStart ? 0 : (S.playStart || 0);
      halt(); S.transport.position = target; S.playStart = target;
    },
    toggleRecord: () => {
      if (S.transport.recording) { finishTake(); halt(); return; }
      if (!S.tracks.some((t) => t.armed)) { // Record with no lane armed: arm the vocal lane (or make one)
        const t = S.tracks.find((x) => x.kind === "take" && /lead|vox|vocal/i.test(x.role + " " + x.name)) || S.tracks.find((x) => x.kind === "take");
        if (t) t.armed = true;
        else S.tracks.push({ id: id(), name: document.documentElement.classList.contains("kt2") ? "VOX" : "Lead Vox", kind: "take", role: "lead", armed: true, muted: false, solo: false, clips: [] });
        rememberArm();
      }
      const pos = S.transport.looping ? S.loopStart : position();
      undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0; // one Cmd+Z takes the take away
      S.transport.recording = true;
      recFrom = pos;
      micStart().then((ok) => { if (!ok) pretendReady(); });
      // Count-in: the song plays that many bars before the marker (as far back as the song
      // goes), and the take only starts at the marker.
      const lead = S.transport.looping ? 0 : Math.min(pos, (S.countIn || 0) * 4 * (60 / S.bpm));
      play(pos - lead);
      if (mic.on) mic.segs.push({ ctx: startCtx + lead, pos, pass: 0 });
    },
    recordDouble: (args) => {
      undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
      const r = origRecordDouble(args);
      S.transport.playing = false;
      recFrom = args.start;
      S.transport.recording = true;
      micStart().then((ok) => { if (!ok) pretendReady(); });
      play(args.start);
      micSeg(0);
      return r;
    },
    setPosition: ({ time }) => { S.transport.position = time; S.playStart = time; if (S.transport.playing) startVoices(time); },
    // cue points (Eman, 31 Oct): while playing, the jump waits for the next beat so it stays in time.
    // Pressed just after a beat (within 90 ms, a human is always a little late) it goes at once, as if on that beat.
    cueJump: ({ time }) => {
      time = Math.max(0, +time || 0);
      if (!S.transport.playing) { S.transport.position = time; S.playStart = time; return { ok: true, at: "now" }; }
      const spb = 60 / S.bpm, now = position(), beat = Math.floor(now / spb + 1e-6) * spb, late = now - beat;
      const go = (t) => { if (!S.transport.playing) return; S.transport.position = t; startVoices(t); changed(); };
      if (late < 0.09) { go(time + late); return { ok: true, at: "now" }; }
      clearTimeout(handlers.cueJump.t);
      handlers.cueJump.t = setTimeout(() => go(time), Math.max(0, (beat + spb - now) * 1000 - 4));
      return { ok: true, at: "beat" };
    },
    setLoopRange: ({ start, end }) => {
      S.loopStart = start; S.loopEnd = end; S.transport.looping = true;
      if (!S.transport.playing) S.transport.position = start; else startVoices(start);
      changed();
    },
    toggleMute: ({ trackId }) => { const t = S.tracks.find((x) => x.id === trackId); t.muted = !t.muted; updateTrackGains(); changed(); },
    toggleSolo: ({ trackId }) => { // soloing also unmutes, like the app, so a muted stem can be heard
      const t = S.tracks.find((x) => x.id === trackId); t.solo = !t.solo; if (t.solo) t.muted = false; updateTrackGains(); changed(); },
    // Export full mix: the browser has no offline render of every lane's instruments and cards,
    // so it plays the song from bar 1 to its last clip (plus a 2 s tail) and records what reaches
    // the speakers, after the master and its limiter. Stopping early keeps what was recorded.
    // KILLTOY 2 PROJECTS page: a quiet bounce of the open project for its card, so a project made
    // here can be heard there even when it's just a few chords (Eman, 1 Nov). It plays the song
    // from bar 1 with the speakers cut off and records what comes out of the ceiling, at most
    // maxSec. { sigOnly } only answers what is open and a signature of its contents, so the
    // page re-bounces only after something changed. bounceStop ends one early (keeps nothing).
    bounceMix: ({ sigOnly, maxSec = 180 } = {}) => new Promise((done) => {
      const live = S.tracks.filter((t) => !t.muted);
      const ends = live.flatMap((t) => t.clips.map((c) => c.start + c.length));
      const sigText = JSON.stringify([S.bpm, live.map((t) => [t.id, t.volume, t.instrument || "", (t.plugins || []).map((x) => [x.type || x.key || x.name, x.enabled, x.params]),
        t.clips.map((c) => [c.id, c.start, c.length, c.gain, c.offset, c.src || c.file || c.link || "", (c.notes || []).map((n) => [n.pitch, n.start, n.length, n.muted ? 1 : 0])])])]);
      let h = 0; for (let k = 0; k < sigText.length; k++) h = (h * 31 + sigText.charCodeAt(k)) | 0;
      const sig = sigText.length + ":" + h;
      if (sigOnly) { done({ ok: true, name: S.session, sig, empty: !ends.length }); return; }
      if (!ends.length) { done({ ok: false, empty: true, name: S.session }); return; }
      if (S.transport.playing || bounceJob) { done({ ok: false, busy: true }); return; }
      const name = S.session, total = Math.min(maxSec, Math.max(...ends) + 1.5), chunks = [[], []];
      const tap = ctx.createScriptProcessor(4096, 2, 2), hush = ctx.createGain();
      hush.gain.value = 0;
      let got = 0, finished = false;
      const finish = (keep) => {
        if (finished) return; finished = true; bounceJob = null;
        clearInterval(watch);
        try { ceiling.disconnect(tap); } catch (e) { /* gone */ } tap.disconnect(); hush.disconnect(); sideBus.gain.value = 1;
        if (S.transport.playing) halt();
        try { outMeter.connect(ctx.destination); } catch (e) { /* already */ }
        S.transport.looping = wasLooping; S.transport.position = 0; changed();
        if (!keep || !got) { done({ ok: false, stopped: true, name }); return; }
        const n = Math.min(got, Math.round(total * ctx.sampleRate)), view = new DataView(new ArrayBuffer(44 + n * 4));
        const str = (o, t) => [...t].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
        str(0, "RIFF"); view.setUint32(4, 36 + n * 4, true); str(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
        view.setUint16(22, 2, true); view.setUint32(24, ctx.sampleRate, true); view.setUint32(28, ctx.sampleRate * 4, true);
        view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, n * 4, true);
        let o = 44, i = 0;
        for (let k = 0; k < chunks[0].length && i < n; k++) for (let j = 0; j < chunks[0][k].length && i < n; j++, i++)
          for (const ch of chunks) { view.setInt16(o, Math.max(-1, Math.min(1, ch[k][j])) * 32767, true); o += 2; }
        done({ ok: true, name, sig, seconds: n / ctx.sampleRate, wav: new Blob([view], { type: "audio/wav" }) });
      };
      tap.onaudioprocess = (e) => {
        if (finished || !S.transport.playing) return;
        for (let c = 0; c < 2; c++) chunks[c].push(new Float32Array(e.inputBuffer.getChannelData(Math.min(c, e.inputBuffer.numberOfChannels - 1))));
        got += e.inputBuffer.length;
        if (bounceJob) bounceJob.progress = Math.min(1, got / (total * ctx.sampleRate));
        if (got >= total * ctx.sampleRate) finish(true);
      };
      try { outMeter.disconnect(ctx.destination); } catch (e) { /* not connected */ }
      ceiling.connect(tap); tap.connect(hush); hush.connect(ctx.destination); sideBus.gain.value = 0;   // the metronome and previews stay out of the file
      const wasLooping = S.transport.looping;
      bounceJob = { name, progress: 0, stop: () => finish(false) };
      S.transport.looping = false; S.playStart = 0; play(0); changed();
      const watch = setInterval(() => { if (!S.transport.playing && got > 0) finish(true); }, 250);
    }),
    // FILES on the projects page (Eman, 1 Nov): how many different things the song is made of.
    // One sound used 20 times is 1 file, a pattern and its linked copies are 1 file, two patterns
    // made unique are 2, a compound clip (all its copies) is 1.
    fileCount: () => {
      const seen = new Set();
      for (const t of S.tracks) for (const c of t.clips) {
        if (c.cmp) seen.add("cmp:" + c.cmp.def);
        else if (c.kind === "midi") seen.add("pat:" + (c.pat || c.id));
        else if (c.link || c.src) seen.add("src:" + (c.link || c.src));
      }
      return { name: S.session, files: seen.size };
    },
    bounceStop: () => { if (bounceJob) bounceJob.stop(); return { ok: true }; },
    bounceProgress: () => (bounceJob ? { name: bounceJob.name, progress: bounceJob.progress } : null),
    exportMix: () => new Promise((done) => {
      const ends = S.tracks.filter((t) => !t.muted).flatMap((t) => t.clips.map((c) => c.start + c.length));
      if (!ends.length) { done({ ok: false, message: "Nothing to export yet: the lanes are empty." }); return; }
      const total = Math.max(...ends) + 2, chunks = [[], []];
      const tap = ctx.createScriptProcessor(4096, 2, 2), hush = ctx.createGain();
      hush.gain.value = 0;
      let got = 0, finished = false;
      const finish = () => {
        if (finished) return; finished = true;
        clearInterval(watch); try { ceiling.disconnect(tap); } catch (e) { /* gone */ } tap.disconnect(); hush.disconnect(); sideBus.gain.value = 1;
        if (S.transport.playing) halt();
        S.transport.looping = wasLooping; S.transport.position = 0; changed();
        const n = Math.min(got, Math.round(total * ctx.sampleRate)), view = new DataView(new ArrayBuffer(44 + n * 4));
        const str = (o, t) => [...t].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
        str(0, "RIFF"); view.setUint32(4, 36 + n * 4, true); str(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
        view.setUint16(22, 2, true); view.setUint32(24, ctx.sampleRate, true); view.setUint32(28, ctx.sampleRate * 4, true);
        view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, n * 4, true);
        let o = 44, i = 0;
        for (let k = 0; k < chunks[0].length && i < n; k++) for (let j = 0; j < chunks[0][k].length && i < n; j++, i++)
          for (const ch of chunks) { view.setInt16(o, Math.max(-1, Math.min(1, ch[k][j])) * 32767, true); o += 2; }
        const name = `${S.session}${curVer ? " " + curVer.label : ""} mix.wav`.replace(/[\/\\:]/g, "-");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
        a.download = name;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        done({ ok: true, file: name, seconds: n / ctx.sampleRate, message: `Downloaded ${name} (${Math.round(n / ctx.sampleRate)} s).` });
      };
      tap.onaudioprocess = (e) => {
        if (finished || !S.transport.playing) return;
        for (let c = 0; c < 2; c++) chunks[c].push(new Float32Array(e.inputBuffer.getChannelData(Math.min(c, e.inputBuffer.numberOfChannels - 1))));
        got += e.inputBuffer.length;
        if (got >= total * ctx.sampleRate) finish();
      };
      // after the -0.3 dB ceiling, like the speakers (it tapped before it, so exports could go over)
      ceiling.connect(tap); tap.connect(hush); hush.connect(ctx.destination); sideBus.gain.value = 0;   // the metronome and previews stay out of the file
      const wasLooping = S.transport.looping;
      if (S.transport.playing) halt();
      S.transport.looping = false; S.playStart = 0; play(0); changed();
      const watch = setInterval(() => { if (!S.transport.playing && got > 0) finish(); }, 250);
    }),
    flattenComp: ({ clipId }) => {
      const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
      if (!c) return { ok: false };
      swapClip(clipId, segment(c), "comp");
      changed(); restartIfPlaying();
      return { ok: true };
    },
  });

  // A project opens on the version you were on last time.
  handlers.openSession = ({ name }) => metaReady.then(() => {
    const last = lastOpen(name), song = last && songBuilt(last);
    return song && song.build && projectOf_(song) === name ? openSong(song, { ver: last.ver ? userVersions(song).find((v) => v.key === last.ver) : null }) : openSong(name);
  }).then((r) => { if (r && r.ok) { markWorked(S.session); updateProjects(); changed(); } return r; });
  // In a grouped session (Lowkey), each version pill is a whole different arrangement.
  for (const name of ["armTrack", "newTakeLane", "newInstrumentLane", "renameTrack", "deleteTrack"]) {
    const orig = handlers[name];
    if (orig) handlers[name] = (args) => Promise.resolve(orig(args)).then((r) => { rememberArm(); return r; });
  }
  // The versions row: the song's own versions (a group's members), then the ones made with "+".
  handlers.openVersion = (args) => {
    const members = membersOf(curSong), mine = userVersions(curSong);
    const target = args.index < members.length ? { song: members[args.index], ver: null }
      : mine[args.index - members.length] ? { song: songBuilt({ song: mine[args.index - members.length].base, dir: mine[args.index - members.length].baseDir }) || curSong, ver: mine[args.index - members.length] } : null;
    if (!target) return { error: "That version isn't here any more." };
    // keeps playing from the same bar, to compare versions
    const was = S.transport.playing, bar = position() * S.bpm, start = S.playStart * S.bpm;
    return openSong(target.song, { ver: target.ver }).then((r) => {
      if (was) { S.transport.position = bar / S.bpm; S.playStart = start / S.bpm; S.transport.looping = false; play(S.transport.position); changed(); }
      return r;
    });
  };

  // Volume changes are heard at once, without restarting playback.
  const origClipGain = handlers.setClipGain, origTrackVol = handlers.setTrackVolume;
  handlers.setClipGain = (args) => {
    const r = origClipGain(args);
    const cv = clipVoices.get(args.clipId), c = findClip(args.clipId);
    if (cv && c) cv.input.gain.setTargetAtTime(dbToLin(c.gain || 0), ctx.currentTime, 0.015);
    return r;
  };
  handlers.setTrackVolume = (args) => {
    // moving the master fader by hand takes the master out of AUTO (the top-bar meter folds AUTO's level into it first)
    if (args && args.trackId === "master" && !args.drag && S.master && S.master.auto !== false && window.KT2_MASTER_AUTO) S.master.auto = false;
    const r = origTrackVol(args); updateTrackGains(); return r;
  };
  // AUTO on/off for the master (KILLTOY 2 top-bar meter). Off: { on: false, volume } sets the fader in the same step,
  // so leaving AUTO keeps today's loudness (volume = fader + what AUTO was adding). One undo step.
  handlers.setMasterAuto = (args) => {
    if (!S.master) return { ok: false };
    S.master.auto = !!(args && args.on);
    if (!S.master.auto && args && args.volume != null) S.master.volume = Math.max(-60, Math.min(6, Number(args.volume) || 0));
    if (S.master.auto) MAUTO.hold = Math.max(MAUTO.hold, 0.3);   // come back in gently, never with a jump up
    // AUTO RESET (Eman, 12 Nov): going back to AUTO also puts the hand fader back to 0 dB in the same undo step. Before,
    // a fader dragged down to -20 stayed at -20 under AUTO (AUTO adds at most +9 dB, rising 0.4 dB/s), so the A lit up
    // and the line jumped back, but the song stayed quiet. KT2_AUTO_RESET_OLD = keep the fader where it was.
    if (S.master.auto && !window.KT2_AUTO_RESET_OLD) S.master.volume = 0;
    updateTrackGains();
    changed();
    changed();
    return { ok: true, auto: S.master.auto };
  };
  handlers.getMasterAuto = () => ({ ok: true, on: autoOn(), db: MAUTO.db });

  // ---- the PLAYGROUND line on RECORD (KILLTOY 2): what's produced, as one grey waveform
  function pgVoice(t) { return !!(window.KT2isVoice && window.KT2isVoice(t)); }
  function pgSig() {
    return JSON.stringify([S.bpm, S.tracks.filter((t) => !pgVoice(t)).map((t) => [t.id, t.muted, t.volume, (t.plugins || []).length,
      t.clips.map((c) => [c.start, c.length, c.offset, c.src, c.take, c.gain, c.active, c.plugins.length, c.notes ? c.notes.length : 0])])]);
  }
  function pgCheck() { const s = pgSig(); if (s !== PG.sig) { PG.sig = s; PG.peaks = []; PG.stat = null; } }
  function updatePgGain() {
    const m = S.pgMix || {};
    pgGain.gain.setTargetAtTime(m.active ? (m.muted ? 0 : dbToLin(m.volume || 0)) : 1, ctx.currentTime, 0.01);
  }
  // Before anything has played: a quick picture from the audio clips alone (MIDI shows after one play).
  function pgStatic() {
    if (PG.stat) return PG.stat;
    const out = [];
    for (const t of S.tracks) {
      if (pgVoice(t) || t.muted) continue;
      const tv = dbToLin(t.volume || 0);
      for (const c of t.clips) {
        if (c.kind === "midi" || c.active === false) continue;
        const tk = takeOf(c, c.take), buf = buffers[tk.src];
        if (!buf) continue;
        const d = buf.getChannelData(0), sr = buf.sampleRate, g = dbToLin(c.gain || 0) * tv;
        const b0 = Math.floor(c.start / PG_BUCKET), b1 = Math.ceil((c.start + c.length) / PG_BUCKET);
        for (let b = b0; b < b1; b++) {
          const a = Math.floor(((b * PG_BUCKET - c.start) + (tk.offset || 0)) * sr), z = a + Math.floor(PG_BUCKET * sr);
          let pk = 0;
          for (let i = Math.max(0, a); i < Math.min(d.length, z); i += 8) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
          out[b] = Math.min(1, (out[b] || 0) + pk * g);
        }
      }
    }
    return (PG.stat = out);
  }
  handlers.playgroundPeaks = () => {
    pgCheck();
    const st = pgStatic(), n = Math.max(PG.peaks.length, st.length), peaks = new Array(n);
    let heard = 0;
    for (let i = 0; i < n; i++) {
      const v = PG.peaks[i];
      if (v !== undefined) heard++;
      peaks[i] = Math.round(Math.min(1, v !== undefined ? v : st[i] || 0) * 1000) / 1000;
    }
    return { bucket: PG_BUCKET, peaks, heard, playing: !!S.transport.playing };
  };

  // ---- WAVE PEEK (Eman, 8 Nov): a MIDI clip, or the whole PLAYGROUND on RECORD, shown as its real
  // waveform without bouncing anything. peekSketch answers at once from the notes (timing, velocity,
  // the synth's attack / release); peekRender then plays the same instruments silently on an
  // OfflineAudioContext (faster than real time, on the audio thread, so the page never freezes) and
  // hands back the peaks. No clip is made and nothing is saved. Unchanged since last time = the
  // remembered picture at once. Effects are left out (the instruments' own sound only).
  // args: { clipId } or { playground: true }, bucket (seconds), onProgress({ done, peaks }).
  // window.KT_PEEK_OFF = true: neither runs (RECORD's grey line + the old toast come back).
  const PEEK = { cache: new Map(), jobs: new Map(), log: [] };
  window.KT_PEEK_LOG = PEEK.log;   // [{ what, seconds, ms, x }]: how fast each render was
  // half the usual rate: half the work, and the peaks are the same (correlation 0.9999 against 44.1 kHz on a
  // TOY MACHINE clip, 8 Nov). window.KT_PEEK_SR = 44100 for full rate.
  const peekRate = () => window.KT_PEEK_SR || 22050;
  const peekTap = `registerProcessor("kt-peek-tap", class extends AudioWorkletProcessor {
    constructor(o) { super(); this.B = o.processorOptions.bucket; this.n = 0; this.pk = 0; this.out = []; this.f = 0; }
    process(ins, outs) {
      const x = ins[0] || [], y = outs[0][0], L = x[0], R = x[1] || L, m = y.length;
      for (let i = 0; i < m; i++) {
        const v = L ? Math.max(Math.abs(L[i]), Math.abs(R[i])) : 0;
        y[i] = v; if (v > this.pk) this.pk = v;
        if (++this.n >= this.B) { this.out.push(this.pk); this.pk = 0; this.n = 0; }
      }
      this.f += m;
      if (this.out.length >= 24) { this.port.postMessage({ p: this.out, f: this.f }); this.out = []; }
      return true;
    }
  });`;
  const peekTapUrl = URL.createObjectURL(new Blob([peekTap], { type: "application/javascript" }));
  const peekJson = (v) => JSON.stringify(v, (k, x) => (x instanceof Float32Array || x instanceof ArrayBuffer ? "pcm" + (x.length || x.byteLength) : x));
  const peekHash = (s) => { let h = 0; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0; return s.length + ":" + h; };
  // What one peek plays: [{ t, c }] (a stacked synth's copies of its main lane's patterns too), from T0 to T1.
  function peekTargets({ clipId, playground }) {
    if (playground) {
      const list = [];
      for (const t of S.tracks) {
        if (pgVoice(t) || t.muted) continue;
        for (const c of t.clips) if (c.active !== false) list.push({ t, c });
        if (t.layerOf) {
          const m = S.tracks.find((x) => x.id === t.layerOf), L = tmPlugins(t)[0];
          if (m && L && L.enabled !== false) for (const c of m.clips) {
            const own = t.linked === false;
            if (c.kind !== "midi" || c.active === false || (!c.plugins.some(isTM) && !(own && !window.KT2_KD_NOSTACK_OLD))) continue;
            list.push({ t, c: { ...c, plugins: [L], gain: 0, fadeIn: 0, fadeOut: 0, _oct: t.oct || 0, ...(own ? { notes: (c.stack && c.stack[t.id]) || [], takeNotes: undefined } : {}) } });
          }
        }
      }
      const end = Math.max(0, ...list.map((x) => x.c.start + x.c.length));
      return { key: "pg", list, T0: 0, T1: Math.min(600, end + 3), lane: true };
    }
    const t = trackOf(clipId), c0 = t && t.clips.find((x) => x.id === clipId);
    if (!c0 || c0.kind !== "midi") return null;
    // the clip as it sounds at 100%: its volume dot and fades are drawn on top, like an audio clip's
    return { key: "clip:" + clipId, list: [{ t, c: { ...c0, gain: 0, fadeIn: 0, fadeOut: 0 } }], T0: c0.start, T1: c0.start + c0.length + 0.02, lane: false };
  }
  function peekSig(T) {
    return peekHash(peekJson([S.bpm, T.T0, T.T1, T.list.map(({ t, c }) => [t.id, T.lane ? [t.volume, t.pan] : 0, t.oct || 0, c.id, c.start, c.length, c.gain, c.fadeIn, c.fadeOut, c.offset, c.take, c.reversed, c.delay,
      c.kind === "midi" ? [midiView(c).notes, c.plugins.filter((p) => p.instrument && p.enabled !== false).map((p) => [p.name, isTM(p) ? tmPresetOf(p) : null, p.kit, p.kitPad, p.kitGain, p.blob, p.toy && p.toy.sample, p.toy && p.toy.drops])]
                        : [takeOf(c, c.take).src, !!buffers[takeOf(c, c.take).src], c.comp, c.takeSrc, c.pan]])]));
  }
  // The instant picture: every note as its envelope (attack, decay to sustain, release after it ends),
  // louder with velocity; notes at the same time add up like voices do (square root of the sum of squares).
  function peekEnv(c) {
    const tm = c.plugins.find(isTM), pr = tm && tmPresetOf(tm), e = pr && pr.ampEnv;
    if (c.plugins.some((p) => p.instrument && p.kit)) return { a: 0.002, d: 0.16, s: 0, r: 0.05, lvl: 0.9 };
    if (e) return { a: +e.a || 0.003, d: +e.d || 0.3, s: e.s != null ? +e.s : 0.8, r: +e.r || 0.15, lvl: 0.8 };
    return { a: 0.008, d: 0.3, s: 0.6, r: 0.15, lvl: 0.7 };
  }
  function peekSketchOf(T, bucket) {
    const n = Math.max(1, Math.ceil((T.T1 - T.T0) / bucket)), sq = new Float32Array(n), spb = 60 / S.bpm;
    const add = (b, v) => { if (b >= 0 && b < n) sq[b] += v * v; };
    for (const { t, c } of T.list) {
      const tv = T.lane ? dbToLin(t.volume || 0) : 1;
      if (c.kind === "midi") {
        const v = midiView(c), env = peekEnv(c), g = dbToLin(c.gain || 0) * tv, end = c.start + c.length;
        for (const nt of v.notes || []) {
          const a = c.start + nt.start * spb, b = Math.min(end, a + nt.length * spb);
          if (b <= a) continue;
          const vel = (nt.velocity || 100) / 127, z = b + env.r;
          for (let k = Math.max(0, Math.floor((a - T.T0) / bucket)); k * bucket + T.T0 < z && k < n; k++) {
            const s = k * bucket + T.T0 + bucket / 2 - a;
            let lv = s < env.a ? s / env.a : env.s + (1 - env.s) * Math.exp(-(s - env.a) / Math.max(0.01, env.d / 3));
            if (k * bucket + T.T0 > b) { const held = lv; lv = held * Math.exp(-(k * bucket + T.T0 - b) / Math.max(0.01, env.r / 3)); }
            add(k, Math.max(0, lv) * vel * env.lvl * g);
          }
        }
      } else if (T.lane) {
        const tk = takeOf(c, c.take), buf = buffers[tk.src];
        if (!buf) continue;
        const d = buf.getChannelData(0), sr = buf.sampleRate, g = dbToLin(c.gain || 0) * tv;
        for (let k = Math.max(0, Math.floor((c.start - T.T0) / bucket)); k * bucket + T.T0 < c.start + c.length && k < n; k++) {
          const i0 = Math.floor((k * bucket + T.T0 - c.start + (tk.offset || 0)) * sr), i1 = i0 + Math.floor(bucket * sr);
          let pk = 0;
          for (let i = Math.max(0, i0); i < Math.min(d.length, i1); i += 8) { const x = Math.abs(d[i]); if (x > pk) pk = x; }
          add(k, pk * g);
        }
      }
    }
    const peaks = new Array(n);
    for (let k = 0; k < n; k++) peaks[k] = Math.round(Math.min(1, Math.sqrt(sq[k])) * 1000) / 1000;
    return peaks;
  }
  handlers.peekSketch = (args = {}) => {
    const T = peekTargets(args);
    if (!T) return { ok: false };
    const bucket = Math.max(0.002, +args.bucket || 0.02);
    return { ok: true, start: T.T0, seconds: T.T1 - T.T0, bucket, peaks: peekSketchOf(T, bucket), empty: !T.list.length };
  };
  // An audio clip on the offline context: its comp pieces, volume and fades (no effects).
  function peekAudio(c, T0, out) {
    const input = ctx.createGain(), fade = ctx.createGain();
    input.gain.value = dbToLin(c.gain || 0);
    input.connect(fade);
    scheduleFades(fade, c, T0, 0);
    let node = fade;
    if (c.pan) { const pn = ctx.createStereoPanner(); pn.pan.value = c.pan; node.connect(pn); node = pn; }
    node.connect(out);
    const pieces = piecesOf(c), delay = c.delay || 0;
    pieces.forEach((x) => {
      const ts0 = takeOf(c, x.take), buf = c.reversed ? reversedOf(buffers[ts0.src]) : buffers[ts0.src];
      if (!buf) return;
      const off = c.reversed ? Math.max(0, buf.duration - (ts0.offset || 0) - c.length) : ts0.offset || 0;
      const a = c.start + x.start, b = c.start + x.end;
      if (b <= T0) return;
      const from = Math.max(a, T0), src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; g.gain.value = ts0.gain || 1;
      src.connect(g); g.connect(input);
      src.start(Math.max(0, from - T0 + delay), Math.max(0, off + (from - c.start)), b - from);
    });
  }
  // A lane's TOY MACHINE patterns on the offline context: its own engine, the notes handed over before
  // the first block (an offline context can't wait for messages), its sample and drop sounds too.
  function peekTM(api, t, list, T0, out) {
    const groups = new Map();
    for (const c of list) { const k = c.gain || c.fadeIn || c.fadeOut ? c.id : 0; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
    for (const g of groups.values()) {
      const plug = g[0].plugins.find(isTM), preset = tmPresetOf(plug);
      const input = midiLevelNode(g[0], out, T0, 0);
      if (!preset) { g.forEach((c) => playKT(midiView(c), T0, 0, input)); continue; }
      const notes = tmNotesOf(g.map((c0) => octView(midiView(c0), c0._oct != null ? c0._oct : t.oct || 0)), T0, 0);
      if (!notes.length) continue;
      if (isTK(preset)) { const s = webEng(preset).load(ctx).create({ preset, notes }); s.output.connect(input); continue; }
      const firstList = [], smp = (plug.toy && plug.toy.sample) || tmSampleReady.get(tmShippedFile(preset));
      if (smp && smp.data) firstList.push({ sample: { data: smp.data, sampleRate: smp.sampleRate } });
      const drops = (plug.toy && plug.toy.drops) || {};
      for (const slot in drops) if (drops[slot] && drops[slot].data) firstList.push({ drop: { slot: +slot, data: drops[slot].data, sampleRate: drops[slot].sampleRate } });
      const s = api.create({ preset, notes, firstList, getTransport: () => ({ bpm: S.bpm, songAt: T0, playing: true }) });
      const bal = input.context.createGain(); bal.gain.value = Math.pow(10, tmBalDb(plug, preset, g.map((c0) => midiView(c0))) / 20);   // the balance trim (tmBalDb)
      s.output.connect(bal); bal.connect(input);
    }
  }
  function peekBlob(t, list, T0, out) {
    if (!window.BlobEngine) return;
    const plug = list[0].plugins.find(isBLOB), spb = 60 / S.bpm, notes = [];
    const e = window.BlobEngine.create({ ctx, patch: blobPatchOf(plug), getBpm: () => S.bpm });
    e.output.connect(out);
    for (const c0 of list) {
      const c = midiView(c0), end = c.start + c.length;
      for (const n of c.notes || []) {
        const a = c.start + n.start * spb + (c.delay || 0), b = Math.min(end, a + n.length * spb);
        if (b > T0 && b > a) notes.push({ pitch: n.pitch, velocity: n.velocity || 100, on: Math.max(0, a - T0), off: b - T0 });
      }
    }
    e.schedule(notes);
  }
  async function peekRun(T, sig, bucket, onProgress) {
    const PEEK_SR = peekRate(T), t0 = performance.now(), N = Math.max(128, Math.ceil((T.T1 - T.T0) * PEEK_SR)), nb = Math.ceil(N / Math.round(bucket * PEEK_SR));
    const off = new OfflineAudioContext(1, N, PEEK_SR);
    // what it needs first: the engines in this context, the presets, their shipped samples
    const needTM = T.list.some(({ c }) => c.kind === "midi" && c.plugins.some(isTM));
    await off.audioWorklet.addModule(peekTapUrl);
    const api = needTM && window.ToyMachine ? await window.ToyMachine.load(off, "toy-machine.wasm").catch(() => null) : null;
    for (const { c } of T.list) for (const p of c.plugins || []) {
      if (!isTM(p)) continue;
      if (p.toy && p.toy.id && !p.toy.preset && !tmPresets.has(p.toy.id.replace(/\.json$/, ""))) await tmFetchPreset(p.toy.id).catch(() => null);
      const pr = tmPresetOf(p), f = tmShippedFile(pr);
      if (f && !tmSampleReady.get(f)) await tmLoadSample(f);
    }
    const tap = new AudioWorkletNode(off, "kt-peek-tap", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: "explicit", processorOptions: { bucket: Math.round(bucket * PEEK_SR) } });
    const bus = off.createGain();
    bus.connect(tap); tap.connect(off.destination);
    const partial = [];
    tap.port.onmessage = (m) => { for (const v of m.data.p) partial.push(Math.round(Math.min(1, v) * 1000) / 1000); if (onProgress) try { onProgress({ done: Math.min(1, m.data.f / N), peaks: partial, start: T.T0, bucket, seconds: T.T1 - T.T0 }); } catch (e) { /* the page's drawing */ } };
    // build the graph with the same instrument code the song plays with, pointed at the offline context
    const byLane = new Map(), failed = [];
    for (const it of T.list) { if (!byLane.has(it.t)) byLane.set(it.t, []); byLane.get(it.t).push(it.c); }
    const saved = { ctx, voices, laterTimers, laneSolo, keyed: keyed.length };
    ctx = off; voices = []; laterTimers = []; laneSolo = null;
    try {
      for (const [t, clips] of byLane) {
        const tg = ctx.createGain();
        tg.gain.value = T.lane ? dbToLin(t.volume || 0) : 1;
        let node = tg;
        if (T.lane && lanePanOf(t)) { const tp = ctx.createStereoPanner(); tp.pan.value = lanePanOf(t); tg.connect(tp); node = tp; }
        node.connect(bus);
        const tms = [], blobs = [];
        for (const c of clips) {
          try {
            if (c.kind !== "midi") { peekAudio(c, T.T0, tg); continue; }
            if (c.plugins.some(isTM)) { tms.push(c); continue; }
            if (c.plugins.some(isBLOB)) { blobs.push(c); continue; }
            playMidi({ ...c, plugins: c.plugins.filter((p) => p.instrument) }, T.T0, 0, tg);   // KILLDRUM, the 808 / lead recipes, the stand-in synth
          } catch (e) { failed.push(c.id); console.warn("WAVE PEEK skipped a clip", e); }
        }
        try { if (tms.length && api) peekTM(api, t, tms, T.T0, tg); } catch (e) { failed.push(...tms.map((c) => c.id)); console.warn("WAVE PEEK: TOY MACHINE", e); }
        try { if (blobs.length) peekBlob(t, blobs, T.T0, tg); } catch (e) { failed.push(...blobs.map((c) => c.id)); }
      }
    } finally {
      laterTimers.forEach(clearTimeout);
      ctx = saved.ctx; voices = saved.voices; laterTimers = saved.laterTimers; laneSolo = saved.laneSolo; keyed.length = saved.keyed;
    }
    const buf = await off.startRendering();
    const d = buf.getChannelData(0), B = Math.round(bucket * PEEK_SR), peaks = new Array(nb);
    for (let k = 0; k < nb; k++) { let pk = 0; for (let i = k * B, z = Math.min(d.length, i + B); i < z; i++) if (d[i] > pk) pk = d[i]; peaks[k] = Math.round(Math.min(1, pk) * 1000) / 1000; }
    const ms = Math.round(performance.now() - t0), seconds = T.T1 - T.T0;
    PEEK.log.push({ what: T.key, seconds: Math.round(seconds * 10) / 10, ms, x: Math.round((seconds * 1000 / Math.max(1, ms)) * 10) / 10 });
    if (PEEK.log.length > 50) PEEK.log.shift();
    return { ok: true, start: T.T0, seconds, bucket, peaks, ms, sig, failed };
  }
  handlers.peekRender = (args = {}) => {
    if (window.KT_PEEK_OFF || !window.OfflineAudioContext) return { ok: false, off: true };
    const T = peekTargets(args);
    if (!T) return { ok: false };
    const bucket = Math.max(0.002, +args.bucket || 0.02), sig = peekSig(T) + "@" + bucket + "@" + peekRate(T);
    const hit = PEEK.cache.get(T.key);
    if (hit && hit.sig === sig) return { ...hit.res, cached: true };
    if (!T.list.length) return { ok: true, start: T.T0, seconds: 0, bucket, peaks: [], ms: 0, sig, empty: true };
    const job = PEEK.jobs.get(T.key);
    // one render per clip at a time: an edit during one waits for it, then renders the newest state
    if (job) return job.sig === sig ? (args.onProgress && job.listeners.push(args.onProgress), job.p) : job.p.then(() => handlers.peekRender(args), () => handlers.peekRender(args));
    const listeners = args.onProgress ? [args.onProgress] : [];
    const p = peekRun(T, sig, bucket, (x) => listeners.forEach((fn) => fn(x))).then((res) => {
      PEEK.jobs.delete(T.key);
      PEEK.cache.set(T.key, { sig, res });
      if (PEEK.cache.size > 80) PEEK.cache.delete(PEEK.cache.keys().next().value);
      return res;
    }, (e) => { PEEK.jobs.delete(T.key); console.warn("WAVE PEEK failed", e); return { ok: false, error: String(e && e.message || e) }; });
    PEEK.jobs.set(T.key, { sig, p, listeners });
    return p;
  };
  // ---- ACE SOUND (Eman, 15 Nov): REIMAGINE SOUND / GENERATE SOUND (ui/kt2-ace.js) send audio to ACE-Step.
  // aceRender plays clips silently on an OfflineAudioContext with the same instrument code as WAVE PEEK, but in
  // stereo at full rate, and hands back a 16-bit WAV: { clipId } = one clip on its own, dry (a MIDI or drum
  // pattern as its instrument plays it, an audio clip as it sounds); { from, to, skipClipId } = everything that
  // plays over that stretch (PG MATCH backing, lane volumes and pans in), minus the pattern itself.
  // aceInsert puts the results back: one AUDIO clip on a new lane right under the source, same start and length,
  // each extra version a take; the source clip is switched off (not deleted). One undo step.
  function aceWav(buf) {
    const n = buf.length, nc = 2, view = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, t) => { for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i)); };
    str(0, "RIFF"); view.setUint32(4, 36 + n * 4, true); str(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, nc, true); view.setUint32(24, buf.sampleRate, true); view.setUint32(28, buf.sampleRate * 4, true);
    view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, n * 4, true);
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    let o = 44, pk = 0;
    for (let i = 0; i < n; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
    const g = pk > 0.99 ? 0.99 / pk : 1;
    for (let i = 0; i < n; i++) { view.setInt16(o, Math.max(-1, Math.min(1, L[i] * g)) * 32767, true); view.setInt16(o + 2, Math.max(-1, Math.min(1, R[i] * g)) * 32767, true); o += 4; }
    return { wav: new Blob([view], { type: "audio/wav" }), peak: pk, seconds: n / buf.sampleRate };
  }
  handlers.aceRender = async ({ clipId, from, to, skipClipId, rate } = {}) => {
    if (!window.OfflineAudioContext) return { error: "This browser can't render audio." };
    let T;
    if (clipId) {
      const t = trackOf(clipId), c0 = t && t.clips.find((x) => x.id === clipId);
      if (!c0) return { error: "That clip isn't there any more." };
      if (c0.kind !== "midi") { for (const x of piecesOf(c0)) { const ts = takeOf(c0, x.take); if (ts && ts.src && !buffers[ts.src]) await bufferFor(ts.src); } }
      T = { list: [{ t, c: { ...c0, fadeIn: 0, fadeOut: 0 } }], T0: c0.start, T1: c0.start + c0.length, lane: false };
    } else {
      const P = peekTargets({ playground: true });
      const list = P.list.filter(({ c }) => c.id !== skipClipId && c.start < to && c.start + c.length > from);
      for (const { c } of list) if (c.kind !== "midi") for (const x of piecesOf(c)) { const ts = takeOf(c, x.take); if (ts && ts.src && !buffers[ts.src]) await bufferFor(ts.src); }
      T = { list, T0: from, T1: to, lane: true };
    }
    const SR = rate || 44100, N = Math.max(128, Math.ceil((T.T1 - T.T0) * SR));
    if (!T.list.length) return { ok: true, empty: true, seconds: T.T1 - T.T0 };
    const off = new OfflineAudioContext(2, N, SR);
    const needTM = T.list.some(({ c }) => c.kind === "midi" && c.plugins.some(isTM));
    const api = needTM && window.ToyMachine ? await window.ToyMachine.load(off, "toy-machine.wasm").catch(() => null) : null;
    for (const { c } of T.list) for (const p of c.plugins || []) {
      if (!isTM(p)) continue;
      if (p.toy && p.toy.id && !p.toy.preset && !tmPresets.has(p.toy.id.replace(/\.json$/, ""))) await tmFetchPreset(p.toy.id).catch(() => null);
      const pr = tmPresetOf(p), f = tmShippedFile(pr);
      if (f && !tmSampleReady.get(f)) await tmLoadSample(f);
    }
    const bus = off.createGain();
    bus.connect(off.destination);
    const byLane = new Map(), failed = [];
    for (const it of T.list) { if (!byLane.has(it.t)) byLane.set(it.t, []); byLane.get(it.t).push(it.c); }
    const saved = { ctx, voices, laterTimers, laneSolo, keyed: keyed.length };
    ctx = off; voices = []; laterTimers = []; laneSolo = null;
    try {
      for (const [t, clips] of byLane) {
        const tg = ctx.createGain();
        tg.gain.value = T.lane ? dbToLin(t.volume || 0) : 1;
        let node = tg;
        if (T.lane && lanePanOf(t)) { const tp = ctx.createStereoPanner(); tp.pan.value = lanePanOf(t); tg.connect(tp); node = tp; }
        node.connect(bus);
        const tms = [], blobs = [];
        for (const c of clips) {
          try {
            if (c.kind !== "midi") { peekAudio(c, T.T0, tg); continue; }
            if (c.plugins.some(isTM)) { tms.push(c); continue; }
            if (c.plugins.some(isBLOB)) { blobs.push(c); continue; }
            playMidi({ ...c, plugins: c.plugins.filter((p) => p.instrument) }, T.T0, 0, tg);
          } catch (e) { failed.push(c.id); console.warn("ACE render skipped a clip", e); }
        }
        try { if (tms.length && api) peekTM(api, t, tms, T.T0, tg); } catch (e) { failed.push(...tms.map((c) => c.id)); }
        try { if (blobs.length) peekBlob(t, blobs, T.T0, tg); } catch (e) { failed.push(...blobs.map((c) => c.id)); }
      }
    } finally {
      laterTimers.forEach(clearTimeout);
      ctx = saved.ctx; voices = saved.voices; laterTimers = saved.laterTimers; laneSolo = saved.laneSolo; keyed.length = saved.keyed;
    }
    const buf = await off.startRendering();
    const w = aceWav(buf);
    return { ok: true, ...w, silent: w.peak < 1e-4, failed };
  };
  handlers.aceInsert = async ({ clipId, wavs, name, info, keepSource }) => {
    const t0 = trackOf(clipId), c0 = t0 && t0.clips.find((x) => x.id === clipId);
    if (!c0) return { error: "The clip changed while this was being made." };
    const bufs = [];
    for (const w of wavs || []) { try { bufs.push(await ctx.decodeAudioData(w instanceof ArrayBuffer ? w.slice(0) : await w.arrayBuffer())); } catch (e) { /* skip a broken one */ } }
    if (!bufs.length) return { error: "The sound that came back couldn't be read." };
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const nm = (name || c0.name || "ACE").slice(0, 40);
    const t = { id: id(), name: nm, kind: "take", role: "fx", armed: false, muted: false, solo: false, clips: [] };
    S.tracks.splice(S.tracks.indexOf(t0) + 1, 0, t);
    const len = Math.min(c0.length, bufs[0].duration);
    const c = { id: id(), name: nm, src: keep(bufs[0]), start: c0.start, length: len, offset: 0, take: 0, takes: 0, plugins: startFx({ name: "" }, { fx: [] }), level: 1, ace: info || null };
    if (bufs.length > 1) {
      ensureTakes(c);
      c.takeInfo = [{ name: nm + " 1", route: "ace", prompt: (info && info.prompt) || "" }];
      bufs.slice(1).forEach((b, k) => { c.takeSrc.push({ src: keep(b), offset: 0, gain: 1 }); c.takeInfo.push({ name: nm + " " + (k + 2), route: "ace", prompt: (info && info.prompt) || "" }); });
      c.takes = c.takeSrc.length;
    }
    t.clips.push(c);
    if (!keepSource) c0.active = false;
    updateTrackGains(); changed(); restartIfPlaying();
    return { ok: true, clipId: c.id, trackId: t.id, versions: bufs.length };
  };

  // { active: on the RECORD page, volume (dB), muted }: only heard while RECORD is open
  handlers.setPlaygroundMix = (a) => {
    S.pgMix = { ...(S.pgMix || {}), ...a };
    updatePgGain();
    return { ok: true, mix: S.pgMix };
  };
  // Trim can't reach past the recorded audio; takes and comps move with the left edge.
  const origBounds = handlers.setClipBounds;
  handlers.setClipBounds = (args) => {
    const c = findClip(args.clipId);
    if (!c) return { ok: false };
    if (c.kind === "midi") return origBounds(args);
    const d = Math.max(args.start - c.start, -c.offset);
    const room = Math.min(...(c.takeSrc ? c.takeSrc.map((x) => x.offset) : [c.offset])) + d;
    const dd = room < 0 ? d - room : d;
    const src = buffers[takeOf(c, c.take).src];
    const length = args.length;   // past the end of the file is just silence (Eman, 31 Oct: "even if it leaves empty space")
    if (c.takeSrc) c.takeSrc = c.takeSrc.map((x) => ({ ...x, offset: x.offset + dd }));
    return origBounds({ ...args, start: c.start + dd, length });
  };
  for (const name of ["toggleMute", "toggleSolo"]) {
    const orig = handlers[name];
    handlers[name] = (args) => { const r = orig(args); loadHeard(); return r; };
  }
  // Sends and return faders are heard at once too.
  for (const name of ["setSend", "setReturnVolume", "toggleReturnMute", "setLanePan"]) {
    const orig = handlers[name];
    if (!orig) continue;
    handlers[name] = (args) => {
      const r = orig(args); updateTrackGains();
      // a send to a GROUP bus moves the lane in or out of it: that's new wiring
      if (name === "setSend" && S.transport.playing && busIsGroup((S.returns || []).find((x) => x.id === "return" + (args && args.send)))) softRestart();
      return r;
    };
  }

  // GROUP / SEND buses: commands (the FX strip's right-hand panel, kt2-buses.js)
  const busOf = (rid) => (S.returns || []).find((r) => r.id === rid);
  const busRewire = () => { if (S.transport.playing) softRestart(); else updateTrackGains(); };
  handlers.newBus = ({ mode, name } = {}) => {
    S.returns = S.returns || [];
    const used = new Set(S.returns.map((r) => r.id)), L = [..."CDEFGHIJKLMNOPQRSTUVWXYZ"].find((c) => !used.has("return" + c));
    if (!L) return { error: "That's 24 buses already." };
    const m = mode === "send" ? "send" : "group";
    const n = String(name || (m === "group" ? "GROUP " : "SEND ") + (S.returns.filter((r) => (r.mode || "send") === m).length + 1)).slice(0, 40);
    S.returns.push({ id: "return" + L, name: n, volume: 0, muted: false, plugins: [], mode: m });
    changed(); busRewire(); return { ok: true, id: "return" + L };
  };
  handlers.setBusMode = ({ id: rid, mode }) => {
    const r = busOf(rid);
    if (!r) return { error: "No such bus." };
    r.mode = mode === "group" ? "group" : "send";   // only the routing: its effects stay exactly as they are
    if (r.mode === "group") for (const t of S.tracks) if (t.sends && t.sends[busLetter(rid)] > 0) t.sends = { ...t.sends, [busLetter(rid)]: 1 };
    changed(); busRewire(); return { ok: true };
  };
  handlers.setBusMember = ({ trackId, id: rid, on, amount }) => {
    const t = S.tracks.find((x) => x.id === trackId), r = busOf(rid);
    if (!t || !r) return { error: "No such lane or bus." };
    const k = busLetter(rid), sends = { A: 0, B: 0, ...t.sends };
    if (!on) sends[k] = 0;
    else if (r.mode === "group") { sends[k] = 1; for (const o of S.returns) if (o !== r && o.mode === "group") sends[busLetter(o.id)] = 0; }   // a sound goes through one group
    else sends[k] = amount != null ? Math.max(0, Math.min(1, Number(amount) || 0)) : sends[k] > 0 ? sends[k] : 0.5;
    t.sends = sends; changed(); busRewire(); return { ok: true };
  };
  handlers.setSendPre = ({ trackId, send, pre }) => {   // a send taken before the lane's fader (PRE) or after it (POST)
    const t = S.tracks.find((x) => x.id === trackId);
    if (!t || !busOf("return" + send)) return { error: "No such lane or send." };
    t.sendsPre = { ...t.sendsPre, [send]: !!pre };
    if (!pre) delete t.sendsPre[send];
    changed(); busRewire(); return { ok: true };
  };
  handlers.setBusFold = ({ id: rid, folded }) => {   // a GROUP shown as a folder on RECORD: open or folded
    const r = busOf(rid);
    if (!r) return { error: "No such bus." };
    r.folded = !!folded; changed(); return { ok: true };
  };
  handlers.renameBus = ({ id: rid, name }) => {
    const r = busOf(rid);
    if (!r || !String(name || "").trim()) return { error: "No such bus." };
    r.name = String(name).trim().slice(0, 40); changed(); return { ok: true };
  };
  handlers.deleteBus = ({ id: rid }) => {
    const r = busOf(rid);
    if (!r) return { error: "No such bus." };
    S.returns = S.returns.filter((x) => x !== r);
    const k = busLetter(rid);
    for (const t of S.tracks) if (t.sends && k in t.sends) { const s2 = { ...t.sends }; delete s2[k]; t.sends = s2; }
    for (const t of S.tracks) if (t.sendsPre && k in t.sendsPre) { const p2 = { ...t.sendsPre }; delete p2[k]; t.sendsPre = p2; }
    changed(); busRewire(); return { ok: true };
  };

  // ---------------------------------------------------------------------------
  // MIX PAGE WIRING (Eman, 11 Nov: "wire them so they work"). The MIX page's knobs used to only
  // draw; now each one is a real part of the sound. window.KT2_MIX_WIRE_OFF = the old picture-only page.
  //   BALANCE  setBalance { group: VOX|DRUMS|BASS|MUSIC, db }: a bus fader. Every lane belongs to one
  //            group (t.bus, or guessed from its name/role like the MIX page does); its fader is
  //            multiplied by its group's level (mixBusGain), saved in S.master.balance.
  //   CLEAN    setMixKnob { trackId, knob: "clean", value: 0..100 }: a real EQ card on the lane
  //            (cuts low rumble and mud, a little air on top). 0 takes the card away.
  //   GLUE     knob "glue": a real Compressor card on the lane (lower threshold, more ratio).
  //   SPACE    knob "space": the lane's A send (Space reverb return) and half as much B (Echo).
  //   DUCK     knob "duck", target: trackId | "": a real Pump card keyed to that lane (sidechain).
  //   The cards carry mixKnob (which knob made them) and mixAmt (its 0..100), so the page reads them
  //   back; they are ordinary cards in the rack: switch them off, change them, delete them.
  //   HEAR IT AS  setMonitor { mode }: a listening filter after the meters, never in exports.
  //   LUFS     window.KT_LOUD: the real loudness, measured while the song plays (K-weighted, 100 ms blocks).
  const MIX_GROUPS = ["VOX", "DRUMS", "BASS", "MUSIC"];
  handlers.setBalance = ({ group, db }) => {
    if (!MIX_GROUPS.includes(group)) return { error: "No such group." };
    S.master.balance = { VOX: 0, DRUMS: 0, BASS: 0, MUSIC: 0, ...(S.master.balance || {}), [group]: Math.max(-12, Math.min(12, Number(db) || 0)) };
    updateTrackGains(); changed(); return { ok: true };
  };
  // REFERENCE: a song Eman likes, analysed on the MIX page ({ name, lufs, bands: dB per MIX_BANDS band }),
  // saved with the song; null takes it away.
  handlers.setMixReference = ({ ref }) => {
    S.master.reference = ref && Array.isArray(ref.bands) ? { name: String(ref.name || "Reference").slice(0, 80), lufs: Number(ref.lufs), bands: ref.bands.map((x) => (x == null || !Number.isFinite(+x) ? null : +(+x).toFixed(2))) } : null;
    changed(); return { ok: true };
  };
  handlers.setTrackBus = ({ trackId, bus }) => {
    const t = S.tracks.find((x) => x.id === trackId);
    if (!t) return { error: "Lane not found." };
    if (bus && !MIX_GROUPS.includes(bus)) return { error: "No such group." };
    t.bus = bus || undefined; updateTrackGains(); changed(); return { ok: true };
  };
  const eqText = (v) => { const g = (v - 0.5) * 24; return (g >= 0 ? "+" : "") + g.toFixed(1) + " dB"; };
  const mixKnobSet = {
    clean: (p, k, t) => {   // k 0..1: low shelf down to -7 dB (an 808/bass keeps its low end: only -1.5), mids -2, air +2.5
      const low = mixBusOf(t) === "BASS" ? 0.5 - k * 0.06 : 0.5 - k * 0.3, mid = 0.5 - k * 0.08, hi = 0.5 + k * 0.1;
      return [["Low-pass gain", low, eqText(low)], ["Mid gain 1", mid, eqText(mid)], ["High-pass gain", hi, eqText(hi)]];
    },
    glue: (p, k) => {   // threshold -6 .. -30 dB, ratio 1.5 .. 4.5, make-up gain 0 .. +5 dB
      const thr = -(6 + k * 24), ratio = 1.5 + k * 3, mk = k * 5;
      return [["threshold", 1 - -thr / 45, thr.toFixed(1) + " dB"], ["ratio", (ratio - 1) / 8.3, ratio.toFixed(1) + " : 1"], ["output gain", 0.5 + mk / 24, "+" + mk.toFixed(1) + " dB"]];
    },
  };
  handlers.setMixKnob = function ({ trackId, knob, value, target }) {
    const t = S.tracks.find((x) => x.id === trackId);
    if (!t) return { error: "Lane not found." };
    t.plugins = t.plugins || [];
    const amt = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    let rebuild = false;
    const tagged = (k) => t.plugins.find((p) => p.mixKnob === k);
    const drop = (k) => { const p = tagged(k); if (p) { t.plugins = t.plugins.filter((x) => x !== p); rebuild = true; } };
    const put = (k, name) => {
      let p = tagged(k);
      if (p) return p;
      if ((typeof fxLimit5 !== "function" || fxLimit5()) && t.plugins.filter((x) => !x.instrument).length >= 5) return null;
      p = make(name); p.mixKnob = k; t.plugins.push(p); rebuild = true;
      return p;
    };
    let err = null;
    if (knob === "clean" || knob === "glue") {
      if (!amt) drop(knob);
      else {
        const p = put(knob, knob === "clean" ? "EQ" : "Compressor");
        if (!p) err = "That lane has 5 effects already. Remove one in the rack first.";
        else {
          p.mixAmt = amt; p.enabled = true;
          for (const [id, v, text] of mixKnobSet[knob](p, amt / 100, t)) {
            const q = p.params.find((x) => x.id === id);
            if (q) { q.value = v; q.text = text; }
            const live = fxNodes.get(p.id);
            if (live && !rebuild) live.set(id, v);
          }
        }
      }
    } else if (knob === "space") {
      t.sends = { A: 0, B: 0, ...t.sends, A: (amt / 100) * 0.6, B: (amt / 100) * 0.3 };
      updateTrackGains();
    } else if (knob === "room") {
      // X WINS: this lane steps back at freq while the winner (target) plays; one card per winner.
      const k = "room:" + target, to = S.tracks.find((x) => x.id === target);
      if (!to || to.id === t.id || !amt) drop(k);
      else {
        const p = put(k, "Make Room");
        if (!p) err = "That lane has 5 effects already. Remove one in the rack first.";
        else {
          p.sidechain = to.id; p.enabled = true; p.mixAmt = amt;
          const v = Math.max(0, Math.min(1, Math.log(Math.max(60, Math.min(12000, Number(arguments[0].freq) || 632)) / 60) / Math.log(200)));
          const q = p.params.find((x) => x.id === "freq");
          if (q) { q.value = v; const f = 60 * Math.pow(200, v); q.text = f >= 1000 ? (f / 1000).toFixed(1) + " kHz" : Math.round(f) + " Hz"; }
          rebuild = true;
        }
      }
      // the other way round can't be true at the same time
      const back = S.tracks.find((x) => x.id === target);
      if (back && amt) { const b = (back.plugins || []).find((x) => x.mixKnob === "room:" + t.id); if (b) { back.plugins = back.plugins.filter((x) => x !== b); rebuild = true; } }
    } else if (knob === "duck") {
      const to = target && S.tracks.find((x) => x.id === target);
      if (!to || to.id === t.id) drop("duck");
      else {
        const p = put("duck", "Pump");
        if (!p) err = "That lane has 5 effects already. Remove one in the rack first.";
        else { if (p.sidechain !== to.id) rebuild = true; p.sidechain = to.id; p.enabled = true; p.mixAmt = 100; }
      }
    } else return { error: "Unknown knob." };
    if (rebuild && S.transport.playing) softRestart();
    changed();
    return err ? { error: err } : { ok: true };
  };
  // HEAR IT AS: studio (off), spotify / youtube (turned down to -14 LUFS like they do; needs a measured
  // song), phone (tiny mono speaker), car (big low end, dull top). After the meters and the export tap.
  let monitor = { mode: "studio", nodes: [] };
  handlers.setMonitor = ({ mode }) => {
    if (!["studio", "spotify", "youtube", "phone", "car"].includes(mode)) return { error: "Unknown." };
    if (bounceJob) return { error: "Busy recording." };
    try { outMeter.disconnect(); } catch (e) { /* not connected */ }
    for (const n of monitor.nodes) { try { n.disconnect(); } catch (e) { /* gone */ } }
    monitor = { mode, nodes: [] };
    if (mode === "studio") { outMeter.connect(ctx.destination); return { ok: true, mode }; }
    const chain = [];
    const bq = (type, f, gain, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (gain != null) b.gain.value = gain; if (q != null) b.Q.value = q; chain.push(b); return b; };
    const g = ctx.createGain(); chain.push(g);
    if (mode === "phone") {
      g.channelCount = 1; g.channelCountMode = "explicit"; g.channelInterpretation = "speakers";   // one tiny speaker
      bq("highpass", 380, null, 0.9); bq("highpass", 380, null, 0.7); bq("peaking", 1800, 5, 1.2); bq("lowpass", 7500, null, 0.7);
      g.gain.value = 0.8;
    } else if (mode === "car") {
      bq("lowshelf", 90, 6); bq("peaking", 300, 1.5, 0.8); bq("highshelf", 6000, -4);
      g.gain.value = 0.75;
    } else {
      const L = window.KT_LOUD && window.KT_LOUD.summary();
      const over = L && Number.isFinite(L.mast) ? Math.max(0, L.mast + 14) : 0;   // they only turn loud songs down
      g.gain.value = Math.pow(10, -over / 20);
    }
    let n = outMeter;
    for (const x of chain) { n.connect(x); n = x; }
    n.connect(ctx.destination);
    monitor.nodes = chain;
    return { ok: true, mode };
  };
  // LUFS, measured: two K-weighted taps (the mix before the master, and what leaves the safety
  // limiter), 4096-sample blocks stored by song time, so the MIX page can draw the real curve.
  (function loudMeter() {
    const kw = (from) => {
      const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter();
      a.type = "highshelf"; a.frequency.value = 1500; a.gain.value = 4;
      b.type = "highpass"; b.frequency.value = 38; b.Q.value = -6.02;
      if (from) from.connect(a);
      a.connect(b); return [a, b];
    };
    const merge = ctx.createChannelMerger(6), sp = ctx.createScriptProcessor(4096, 6, 1), hush = ctx.createGain();
    hush.gain.value = 0;
    const [mixIn, mixK] = kw(null), [, mastK] = kw(ceiling);
    mixLoudTap = mixIn; master.connect(mixIn);   // wireMaster reconnects it after each rebuild
    const split = (node, at) => { const sp2 = ctx.createChannelSplitter(2); node.connect(sp2); sp2.connect(merge, 0, at); sp2.connect(merge, 1, at + 1); };
    split(mixK, 0); split(mastK, 2); split(ceiling, 4);
    merge.connect(sp); sp.connect(hush); hush.connect(ctx.destination);
    // the long-term sound (SOUND curve): average power per log band, 20 Hz .. 20 kHz, of what leaves the limiter
    const an = ctx.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; ceiling.connect(an);
    const NB = 91, fbuf = new Float32Array(an.frequencyBinCount), spec = new Float64Array(NB), specN = new Float64Array(NB);
    let specFrames = 0;
    const bandOf = new Int16Array(an.frequencyBinCount).map((_, i) => { const f = (i * ctx.sampleRate) / an.fftSize; return f < 20 || f > 20000 ? -1 : Math.min(NB - 1, Math.round((Math.log(f / 20) / Math.log(1000)) * (NB - 1))); });
    const blocks = new Map();   // block index (song time / 0.1 s) -> [mix mean square, master mean square, master peak]
    let peakAll = 0;
    const ms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return s / a.length; };
    sp.onaudioprocess = (e) => {
      if (!S.transport.playing || laneSolo || anySolo() || bounceJob) return;
      const ib = e.inputBuffer, at = position() - ib.duration;
      if (at < 0) return;
      const m = ms(ib.getChannelData(0)) + ms(ib.getChannelData(1)), M = ms(ib.getChannelData(2)) + ms(ib.getChannelData(3));
      let pk = 0; for (const c of [4, 5]) { const d = ib.getChannelData(c); for (let i = 0; i < d.length; i += 4) pk = Math.max(pk, Math.abs(d[i])); }
      blocks.set(Math.round(at / 0.1), [m, M, pk]);
      if (M > 1e-7) {
        an.getFloatFrequencyData(fbuf);
        for (let i = 1; i < fbuf.length; i++) { const b = bandOf[i]; if (b >= 0 && Number.isFinite(fbuf[i])) { spec[b] += Math.pow(10, fbuf[i] / 10); specN[b]++; } }
        specFrames++;
      }
      peakAll = Math.max(peakAll, pk);
    };
    const lufs = (msq) => -0.691 + 10 * Math.log10(Math.max(1e-12, msq));
    // gated integrated loudness (EBU R128: -70 absolute, then -10 relative) over 400 ms windows
    const integ = (list) => {
      const abs = list.filter((x) => lufs(x) > -70);
      if (!abs.length) return NaN;
      const rel = lufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 10, g = abs.filter((x) => lufs(x) > rel);
      return lufs(g.reduce((a, b) => a + b, 0) / Math.max(1, g.length));
    };
    window.KT_LOUD = {
      clear: () => { blocks.clear(); peakAll = 0; spec.fill(0); specN.fill(0); specFrames = 0; },
      // the SOUND curve: dB per band (91 log bands, 20 Hz .. 20 kHz), null until about 3 s were heard
      spectrum: () => (specFrames < 30 ? null : Array.from(spec, (v, i) => (specN[i] ? 10 * Math.log10(v / specN[i]) : null))),
      count: () => blocks.size,
      // pts: n points over [0, len] seconds as [mix LUFS, master LUFS] (short-term, 3 s), null where unheard
      summary: (len, n = 64) => {
        if (blocks.size < 8) return null;
        const keys = [...blocks.keys()].sort((a, b) => a - b), win = (k, w) => { const out = []; for (let i = k - w; i <= k + w; i++) { const b = blocks.get(i); if (b) out.push(b); } return out; };
        const w4 = keys.map((k) => win(k, 2)).filter((x) => x.length >= 3);
        const mixI = integ(w4.map((x) => x.reduce((a, b) => a + b[0], 0) / x.length)), mastI = integ(w4.map((x) => x.reduce((a, b) => a + b[1], 0) / x.length));
        const st = keys.map((k) => win(k, 15)).filter((x) => x.length >= 10).map((x) => lufs(x.reduce((a, b) => a + b[1], 0) / x.length)).filter((v) => v > -70).sort((a, b) => a - b);
        const lra = st.length > 4 ? st[Math.floor(st.length * 0.95) - 1] - st[Math.floor(st.length * 0.1)] : 0;
        let pts = null;
        if (len) {
          pts = [];
          for (let i = 0; i < n; i++) {
            const k = Math.round(((i + 0.5) / n) * len / 0.1), x = win(k, 15);
            pts.push(x.length >= 4 ? [lufs(x.reduce((a, b) => a + b[0], 0) / x.length), lufs(x.reduce((a, b) => a + b[1], 0) / x.length)] : null);
          }
        }
        return { mix: mixI, mast: mastI, tp: 20 * Math.log10(Math.max(1e-6, peakAll)), lra, pts, heard: blocks.size * 0.1 };
      },
    };
  })();

  // STACKED SYNTHS (Eman, 1 Nov): several synths on one pattern, all playing the same notes at
  // the same time. Each extra synth is a lane of its own (layerOf = the main lane) with no
  // patterns: it plays the main lane's patterns with its own TOY MACHINE, octave (oct), effects
  // and fader, so the mixer has a volume for each. Every lane's oct moves what it plays.
  // empty (Eman, 9 Nov): the new synth starts unlinked with no notes of its own (a new part, not the same melody);
  // without it, the old way: linked, playing the pattern's notes.
  handlers.addSynthLayer = ({ clipId, trackId, key, empty }) => {
    let main = trackId ? S.tracks.find((t) => t.id === trackId) : S.tracks.find((t) => t.clips.some((c) => c.id === clipId));
    if (main && main.layerOf) main = S.tracks.find((t) => t.id === main.layerOf) || main;
    if (!main) return { error: "Pick a MIDI pattern first." };
    const blob = key === "builtin:blob", mine = S.tracks.filter((t) => t.layerOf === main.id);
    const plug = { id: id(), name: "TOY MACHINE", type: "vst", enabled: true, instrument: true, params: [], ...(blob ? { face: "blob" } : {}) };
    const COLS = window.KT2_RED_CLIPS_OLD ? ["#4f8cff", "#2fd4e8", "#ff5fa8", "#7dff5a", "#ff3b4e", "#e4ff3a"] : ["#4f8cff", "#2fd4e8", "#ff5fa8", "#7dff5a", "#b07cff", "#5eead4"], used = new Set(mine.map((x) => x.color));
    const L = { id: id(), name: `${main.name} \u00b7 ${mine.length + 2}`, kind: "inst", role: main.role || "inst", instrument: blob ? "BLOB" : "TOY MACHINE",
                layerOf: main.id, oct: 0, linked: true, armed: false, muted: false, solo: false, volume: 0, clips: [], plugins: [plug],
                color: COLS.find((x) => !used.has(x)) || COLS[mine.length % COLS.length], ...(blob ? { face: "blob" } : {}) };
    const at = S.tracks.indexOf(mine.length ? mine[mine.length - 1] : main) + 1;
    S.tracks.splice(at, 0, L);
    if (empty) { L.linked = false; for (const c of main.clips) if (c.kind === "midi") c.stack = { ...(c.stack || {}), [L.id]: [] }; }
    changed();
    return { ok: true, trackId: L.id, pluginId: plug.id, empty: !!empty };
  };
  // a pattern made by double-clicking the playground has no synth yet: it shows ADD INSTRUMENT until
  // one is picked (Eman, 5 Nov 01:45). Picking one (setInstrument) clears it.
  handlers.setNoInstrument = ({ trackId, on }) => {
    const t = S.tracks.find((x) => x.id === trackId);
    if (!t) return { error: "No such row." };
    if (on) t.noInst = true; else delete t.noInst;
    changed();
    return { ok: true };
  };
  { const origSet = handlers.setInstrument;
    handlers.setInstrument = (args) => { const t = S.tracks.find((x) => x.id === args.trackId); if (t) delete t.noInst; return origSet(args); }; }
  // a sound picked another way (a TOY MACHINE preset or knob, a stacked synth) also counts as picked (Eman, 10 Nov 21:11)
  { const origPre = handlers.toyMachineSetPreset;
    handlers.toyMachineSetPreset = (args) => { const f = tmFind(args.pluginId); if (f && f.t && f.t.noInst) delete f.t.noInst; return origPre(args); };
    const origLayer = handlers.addSynthLayer;
    handlers.addSynthLayer = (args) => { const t = S.tracks.find((x) => x.id === args.trackId); if (t && t.noInst) delete t.noInst; return origLayer(args); }; }
  // the thread between a stacked synth and its pattern: on (default) = the same notes; cut = its
  // own notes in every pattern (c.stack[laneId]), starting as a copy so nothing changes when cut
  handlers.setLayerLinked = ({ trackId, linked }) => {
    const t = S.tracks.find((x) => x.id === trackId), m = t && S.tracks.find((x) => x.id === t.layerOf);
    if (!m) return { error: "That synth isn't stacked on a pattern." };
    t.linked = !!linked;
    if (!linked) for (const c of m.clips) if (c.kind === "midi") { c.stack = c.stack || {}; if (!c.stack[t.id] || (!window.KT2_LAYER_NEW_COPY && !c.stack[t.id].length)) c.stack[t.id] = (c.notes || []).map((n) => ({ ...n })); }   // a synth that never got notes of its own (added empty, then linked) takes a copy when cut again (Eman, 9 Nov)
    changed();
    return { ok: true, linked: t.linked };
  };
  // a cut-thread synth's own notes in one pattern (linked copies of the pattern take them too)
  handlers.setStackNotes = ({ clipId, layerId, notes }) => {
    let src = null;
    for (const t of S.tracks) for (const c of t.clips) if (c.id === clipId) src = c;
    if (!src) return { error: "That pattern isn't there any more." };
    for (const t of S.tracks) for (const c of t.clips) if (c === src || (src.pat && c.pat === src.pat)) { c.stack = { ...(c.stack || {}), [layerId]: (notes || []).map((n) => ({ ...n })) }; }
    changed();
    if (S.transport.playing && !tmRequeue(clipId)) restartIfPlaying();
    return { ok: true };
  };
  // VERSIONS (Eman, 15 Nov): several ideas for one MIDI clip, all kept inside the clip:
  // c.versions = { list: [{ id, name, notes, stack }], active }. The active one's notes are the clip's own notes;
  // switching saves them into its entry and puts the other's notes in, all as one undo step (linked copies too).
  // PER SYNTH (Eman, 15 Nov): `layer` = a stacked synth's id: its versions go in c.versionsBy[layer], the main
  // synth's c.versions is left alone (and its notes, unless given).
  handlers.setClipVersions = ({ clipId, versions, notes, stack, layer }) => {
    let src = null;
    for (const t of S.tracks) for (const c of t.clips) if (c.id === clipId) src = c;
    if (!src) return { error: "That pattern isn't there any more." };
    const copy = (ns) => (ns || []).map((n) => ({ ...n }));
    for (const t of S.tracks) for (const c of t.clips) if (c === src || (src.pat && c.pat === src.pat)) {
      if (layer) { c.versionsBy = { ...(c.versionsBy || {}) }; if (versions) c.versionsBy[layer] = structuredClone(versions); else delete c.versionsBy[layer]; }
      else if (versions) c.versions = structuredClone(versions); else delete c.versions;
      if (notes) c.notes = copy(notes);
      if (stack) c.stack = { ...(c.stack || {}), ...Object.fromEntries(Object.entries(stack).map(([k, ns]) => [k, copy(ns)])) };
    }
    changed();
    if ((notes || stack) && S.transport.playing && !tmRequeue(clipId)) restartIfPlaying();
    return { ok: true };
  };
  handlers.setLaneOct = ({ trackId, oct }) => {
    const t = S.tracks.find((x) => x.id === trackId);
    if (!t) return { error: "That lane isn't there any more." };
    t.oct = Math.max(-4, Math.min(4, Math.round(oct) || 0));
    changed();
    return { ok: true, oct: t.oct };
  };
  { // a lane's stacked synths go with it
    const orig = handlers.deleteTrack;
    handlers.deleteTrack = (args) => { const r = orig(args); const gone = (args && args.trackId); if (gone) S.tracks = S.tracks.filter((t) => t.layerOf !== gone); return r; };
  }
  // Before a synth card's x / Delete (Eman, 10 Nov 21:40): would deleting this lane lose work?
  // sound = a preset picked, a knob moved, a sample or an effect added; notes = MIDI that goes with it
  // (a stacked synth: its own notes; the pattern's main synth: every pattern on the row).
  handlers.instrumentTouched = ({ trackId }) => {
    const t = S.tracks.find((x) => x.id === trackId);
    if (!t) return { error: "That synth isn't there any more." };
    const main = t.layerOf ? S.tracks.find((x) => x.id === t.layerOf) : null;
    let notes = 0;
    if (main) { for (const c of main.clips) if (c.stack && c.stack[t.id]) notes += c.stack[t.id].length; }
    else { const mine = new Set(S.tracks.filter((x) => x.layerOf === t.id).map((x) => String(x.id)));
      for (const c of t.clips) notes += c.kind === "midi" ? (c.notes || []).length + Object.entries(c.stack || {}).reduce((a, [k, n]) => a + (mine.has(String(k)) ? (n || []).length : 0), 0) : 1; }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    let sound = false;
    for (const p of [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins || [])]) {
      if (!p.instrument) { sound = true; continue; }   // an effect on it
      if (p.toy && (p.toy.id || p.toy.sample)) sound = true;
      if (p.toy && p.toy.preset && !same(p.toy.preset, isTKPlug(p) && plugEng(p) ? plugEng(p).preset(plugEng(p).DEFAULT) : TM_INIT)) sound = true;
      if (p.blob && window.BlobEngine && !same(p.blob, window.BlobEngine.fromPreset(0))) sound = true;
      if (p.kit) sound = true;
    }
    return { ok: true, sound, notes, layers: main ? 0 : S.tracks.filter((x) => x.layerOf === t.id).length };
  };

  // The audio editor (KILLTOY 2, Eman 4 Nov): a clip cut into pieces and rearranged on the beat.
  // pieces: [{ from, len, at, semi }] in seconds: `from` in the original audio (from the clip's first
  // sample), `at` from the clip start, `semi` = transposed by that many semitones (tempo kept).
  // The pieces are rendered to one file and the clip plays that; the original is kept, so
  // { reset: true } puts it back. getState shows c.edit = { pieces, length } while it's edited.
  const editSeq = {};
  handlers.editAudio = async ({ clipId, pieces, reset }) => {
    const seq = (editSeq[clipId] = (editSeq[clipId] || 0) + 1);   // a newer edit started while this one was stretching: drop this one
    const t = trackOf(clipId);
    if (!t) return { error: "That clip isn't there any more." };
    const i = t.clips.findIndex((c) => c.id === clipId), c = t.clips[i];
    const o = c.edit ? c.edit.orig : { src: c.src, offset: c.offset || 0, length: c.length, level: c.level, takeSrc: c.takeSrc || null, take: c.take || 0, comp: c.comp || null };
    if (reset || !pieces || !pieces.length) {
      if (!c.edit) return { ok: true };
      const { edit, ...rest } = c;
      t.clips[i] = { ...rest, src: o.src, offset: o.offset, length: o.length, level: o.level, takeSrc: o.takeSrc, take: o.take, comp: o.comp };
      changed(); restartIfPlaying(); return { ok: true, reset: true };
    }
    const ts = o.takeSrc && o.takeSrc[o.take] ? o.takeSrc[o.take] : { src: o.src, offset: o.offset, gain: o.level };
    const buf = buffers[ts.src];
    if (!buf) return { error: "The audio isn't loaded yet. Try again in a second." };
    const dOf = (p) => (p.dur > 0 ? +p.dur : +p.len);   // how long it plays (stretch pins can make it differ from len, the audio it takes)
    const sr = buf.sampleRate, nch = buf.numberOfChannels, total = Math.max(...pieces.map((p) => p.at + dOf(p)));
    const out = ctx.createBuffer(nch, Math.max(1, Math.ceil(total * sr)), sr), F = Math.round(0.004 * sr);
    for (const p of pieces) {
      const a = Math.max(0, Math.round(((ts.offset || 0) + p.from) * sr)), n = Math.min(Math.round(p.len * sr), buf.length - a);
      if (n <= 0) continue;
      let part = ctx.createBuffer(nch, n, sr);
      for (let ch = 0; ch < nch; ch++) part.getChannelData(ch).set(buf.getChannelData(ch).subarray(a, a + n));
      if (p.semi) { const r = Math.pow(2, p.semi / 12); part = shiftPitch(part, () => r); }
      // stretch pins (the editor's STRETCH look): [[s, d], ...] = the moment s seconds into the piece's
      // audio plays d seconds into the piece. Between two pins the audio is stretched to fit (Signalsmith
      // when it's loaded); the piece's two ends stay where they are (it plays for `dur`, default len).
      const D = dOf(p), pins = (p.warp || []).filter((w) => w[0] > 0.001 && w[0] < p.len - 0.001 && w[1] > 0.001 && w[1] < D - 0.001).sort((a, b) => a[1] - b[1]);
      const chunks = [];
      if (!pins.length && Math.abs(D - p.len) < 0.0005) chunks.push({ buf: part, at: Math.round(p.at * sr), inA: false, inB: false });
      else {
        const all = [[0, 0], ...pins, [p.len, D]];
        for (let j = 0; j < all.length - 1; j++) {
          const [s0, d0] = all[j], [s1, d1] = all[j + 1], a0 = Math.round(s0 * sr), a1 = Math.min(part.length, Math.round(s1 * sr));
          if (a1 - a0 < 2 || d1 - d0 < 0.001) continue;
          let ch = ctx.createBuffer(nch, a1 - a0, sr);
          for (let q = 0; q < nch; q++) ch.getChannelData(q).set(part.getChannelData(q).subarray(a0, a1));
          const speed = (s1 - s0) / (d1 - d0);
          if (Math.abs(speed - 1) > 0.002) ch = await stretchTo(ch, speed);
          chunks.push({ buf: ch, at: Math.round((p.at + d0) * sr), want: Math.round((d1 - d0) * sr), inA: j > 0, inB: j < all.length - 2 });
        }
      }
      const F2 = Math.max(1, Math.round(0.0015 * sr));
      for (const k0 of chunks) {
        const m = Math.min(k0.buf.length, k0.want || k0.buf.length), fa = k0.inA ? F2 : F, fb = k0.inB ? F2 : F;
        for (let ch = 0; ch < nch; ch++) {
          const x = k0.buf.getChannelData(Math.min(ch, k0.buf.numberOfChannels - 1)), y = out.getChannelData(ch);
          for (let k = 0; k < m && k0.at + k < y.length; k++) { const fd = Math.min(1, k / fa, (m - 1 - k) / fb); y[k0.at + k] += x[k] * fd * (ts.gain || 1); }
        }
      }
    }
    if (editSeq[clipId] !== seq) return { ok: true, stale: true };
    const i2 = t.clips.findIndex((x) => x.id === clipId);
    if (i2 < 0) return { error: "That clip isn't there any more." };
    t.clips[i2] = { ...t.clips[i2], src: keep(out), offset: 0, length: total, level: 1, takeSrc: null, take: 0, comp: null,
                   edit: { orig: o, pieces: pieces.map((p) => ({ from: +p.from, len: +p.len, at: +p.at, semi: p.semi | 0, ...(Math.abs(dOf(p) - p.len) > 0.0005 ? { dur: dOf(p) } : {}), ...(p.warp && p.warp.length ? { warp: p.warp.map((w) => [+w[0], +w[1]]) } : {}) })), length: total } };
    changed(); restartIfPlaying();
    return { ok: true, clipId };
  };
  const editAudioNow = handlers.editAudio;   // without its own undo step (fitClip plays an edit again inside a BPM / key change)
  // DEEP LISTEN for the audio editor (Eman, 6 Nov 22:32): "really get to know the audio". Every hit,
  // and the beat followed through the whole clip like a drummer would: it bends with tempo drift, and
  // through a break with no drums it keeps counting at the same speed and locks back in when the hits
  // return (dynamic-programming beat tracker, Ellis 2007). Then the bar line: the beat phase whose
  // beats carry the most low end (kicks). Times are seconds in the clip's ORIGINAL audio (like
  // editAudio's `from`). conf = how sure each beat is (0 = counted through silence).
  const listenCache = new Map();
  // Where the sound starts in a clip's file (Eman, 10 Nov 23:36): the first moment louder than 48 dB under
  // the file's peak, and every later start after half a second or more of quiet (not every drum hit: inside
  // the music the grid stays in charge). The left trim edge snaps to these
  // while SNAP is on, so a quiet bit the import left in front (a creative gap) is one drag away from gone.
  // Answers timeline seconds (where each start sits now), so the UI can magnet to them. Max 64.
  const soundCache = new WeakMap();
  handlers.soundStarts = async ({ clipId }) => {
    const c = findClip(clipId);
    if (!c || c.kind === "midi" || c.reversed || (c.takeSrc && c.comp && c.comp.length)) return { starts: [] };
    const ts = takeOf(c, c.take), buf = buffers[ts.src];
    if (!buf) return { starts: [] };
    let src = soundCache.get(buf);
    if (!src) {
      const m = await blocksOf(buf), nb = m.lo.length, sr = buf.sampleRate;
      let peak = 0; for (let i = 0; i < nb; i++) peak = Math.max(peak, m.hi[i], -m.lo[i]);
      src = [];
      if (peak >= 1e-4) {
        const thr = Math.max(peak * Math.pow(10, -48 / 20), Math.pow(10, -70 / 20)), quietB = Math.ceil(0.5 * sr / BLOCK);
        const chs = []; for (let ch = 0; ch < buf.numberOfChannels; ch++) chs.push(buf.getChannelData(ch));
        let quiet = quietB;   // the file's start counts as after quiet
        for (let b = 0; b < nb && src.length < 64; b++) {
          const loud = Math.max(m.hi[b], -m.lo[b]) > thr;
          if (!loud) { quiet++; continue; }
          if (quiet >= quietB) {   // down to the sample: the first one over the line in this block, 1 ms kept before it
            let at = b * BLOCK;
            find: for (let i = b * BLOCK, e = Math.min(buf.length, i + BLOCK); i < e; i++) for (const x of chs) if (Math.abs(x[i]) > thr) { at = i; break find; }
            src.push(Math.max(0, at - Math.round(sr * 0.001)) / sr);
          }
          quiet = 0;
        }
      }
      soundCache.set(buf, src);
    }
    return { starts: src.map((t) => c.start + (t - (ts.offset || 0))).filter((t) => t < c.start + c.length - 0.01) };
  };
  handlers.listenAudio = async ({ clipId }) => {
    const c0 = findClip(clipId);
    if (!c0) return { error: "That clip isn't there any more." };
    const c = c0.edit ? { ...c0, ...c0.edit.orig, edit: null } : c0;
    const ts = takeOf(c, c.take), buf = buffers[ts.src];
    if (!buf) return { error: "The audio isn't loaded yet." };
    const key = ts.src + "|" + (ts.offset || 0) + "|" + c.length;
    if (listenCache.has(key)) return listenCache.get(key);
    const sr = buf.sampleRate, a = Math.max(0, Math.round((ts.offset || 0) * sr)), n = Math.max(0, Math.min(buf.length - a, Math.round(c.length * sr)));
    if (n < sr) return { bpm: 0, beats: [], conf: [], down: 0, hits: [] };
    const mono = new Float32Array(n);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) mono[i] += d[a + i] / buf.numberOfChannels; }
    await new Promise((go) => setTimeout(go, 0));
    let raw = [];
    try { raw = window.killtoyConvert ? killtoyConvert.onsets(mono, sr, { minGap: 0.045 }) : []; } catch (e) { raw = []; }
    let top = 1e-9; for (const h of raw) top = Math.max(top, h.strength || 0);
    const hits = raw.map((h) => ({ t: h.at, s: Math.min(1, (h.strength || 0) / top) }));
    await new Promise((go) => setTimeout(go, 0));
    // tempo: listened, kept near the song's tempo (no half / double mix-ups)
    let bpm = 0;
    { const tb = ctx.createBuffer(1, n, sr); tb.copyToChannel(mono, 0); bpm = guessTempo(tb); }
    const song = S.bpm || 120;
    if (!bpm) bpm = (c0.orig && c0.orig.bpm) || song;
    for (const f of [2, 0.5]) if (Math.abs(bpm * f - song) < Math.abs(bpm - song) * 0.6) bpm *= f;
    // onset strength at 200 frames a second, softened
    const fps = 200, N = Math.ceil((n / sr) * fps) + 1, env = new Float32Array(N);
    const K = [0.15, 0.45, 0.8, 1, 0.8, 0.45, 0.15];
    for (const h of hits) { const i = Math.round(h.t * fps); for (let k = -3; k <= 3; k++) if (i + k >= 0 && i + k < N) env[i + k] += h.s * K[k + 3]; }
    let mu = 0, sd = 0; for (let i = 0; i < N; i++) mu += env[i]; mu /= N; for (let i = 0; i < N; i++) sd += (env[i] - mu) ** 2; sd = Math.sqrt(sd / N) || 1;
    for (let i = 0; i < N; i++) env[i] /= sd;
    const P = (60 / bpm) * fps, lo = Math.round(P * 0.66), hi = Math.round(P * 1.5), score = new Float32Array(N), back = new Int32Array(N).fill(-1);
    for (let t = 0; t < N; t++) {
      let best = 0, bi = -1;
      for (let d = lo; d <= hi && t - d >= 0; d++) { const v = score[t - d] - 100 * Math.log(d / P) ** 2; if (bi < 0 || v > best) { best = v; bi = t - d; } }
      score[t] = env[t] + (bi >= 0 ? Math.max(0, best) : 0); back[t] = bi >= 0 && best > 0 ? bi : -1;
    }
    let end = N - 1, bs = -1e9; for (let t = Math.max(0, N - Math.ceil(P)); t < N; t++) if (score[t] > bs) { bs = score[t]; end = t; }
    const fr = []; for (let t = end; t >= 0; t = back[t]) { fr.push(t); if (back[t] < 0) break; }
    fr.reverse();
    let beats = fr.map((f) => f / fps);
    // count on before the first and after the last (an intro / tail with nothing on the beat)
    const step = 60 / bpm, dur = n / sr;
    if (beats.length) { while (beats[0] - step > -0.02) beats.unshift(Math.max(0, beats[0] - step)); while (beats[beats.length - 1] + step < dur - 0.02) beats.push(beats[beats.length - 1] + step); }
    else for (let t = 0; t < dur; t += step) beats.push(t);
    // each beat onto its hit (within 35 ms), and how sure it is
    const conf = beats.map(() => 0);
    let hi2 = 0;
    beats = beats.map((b, i) => {
      while (hi2 < hits.length && hits[hi2].t < b - 0.035) hi2++;
      let best = null; for (let j = hi2; j < hits.length && hits[j].t <= b + 0.035; j++) if (!best || hits[j].s > best.s) best = hits[j];
      if (best) { conf[i] = Math.min(1, 0.35 + best.s); return best.t; }
      return b;
    });
    // the bar line: the phase whose beats carry the most low end
    const lp = new Float32Array(n); { let y = 0; const k = 1 - Math.exp(-2 * Math.PI * 150 / sr); for (let i = 0; i < n; i++) { y += k * (mono[i] - y); lp[i] = y; } }
    const lowAt = (t) => { const i = Math.round(t * sr), w = Math.round(0.06 * sr); let e1 = 0, e0 = 0; for (let j = 0; j < w; j++) { const x = lp[i + j] || 0, z = lp[i - w + j] || 0; e1 += x * x; e0 += z * z; } return Math.max(0, e1 - e0); };
    const ph = [0, 0, 0, 0]; beats.forEach((b, i) => { ph[i % 4] += lowAt(b) + conf[i] * 1e-6; });
    let down = 0; for (let k = 1; k < 4; k++) if (ph[k] > ph[down]) down = k;
    // a sound that starts right on a strong hit starts on bar 1 (Eman, 11 Nov 00:25: bar 1 sat a beat late). KT2_AE_DOWN_OLD = low end only
    if (!window.KT2_AE_DOWN_OLD && beats.length && beats[0] < 0.05 && conf[0] >= 0.85) down = 0;
    const r = { bpm: Math.round(bpm * 100) / 100, beats, conf, down, hits };
    listenCache.set(key, r);
    return r;
  };
  // Edits that change what plays: rebuild the audio from where the playhead is.
  for (const name of ["applyChain", "addPlugin", "removePlugin", "movePlugin", "togglePlugin", "setSidechain", "setSidechainAmount", "bypassAll", "clearEffects",
                      "splitClip", "deleteClip", "moveClip", "deleteTrack", "setClipTake", "setClipComp", "openVersion", "setMidiNotes", "newMidiClip",
                      "moveClips", "duplicateClips", "setClipBounds", "setClipFades",
                      "setClipActive", "reverseClip", "consolidateClips", "insertTime", "deleteTime", "joinCompound", "setLanePan", "layerTakes", "compAB", "moveTrack", "moveSection", "slideSection", "dropSection", "insertSection", "makeUniqueLane", "moveClipToNewLane", "setClipColor", "setClipRow", "addSynthLayer", "setNoInstrument", "setLaneOct", "setLayerLinked", "setSideInput", "setSideGhost"]) {
    const orig = handlers[name];
    if (!orig) continue;   // (these only exist on the KILLTOY 2 page)
    if (name === "setMidiNotes") {
      handlers[name] = (args) => {
        const playing = S.transport.playing, before = new Map();
        if (playing) for (const t of S.tracks) for (const c of t.clips) if (c.kind === "midi") before.set(c.id, JSON.stringify([c.notes, c.start, c.length]));
        const r = orig(args);
        if (!playing) return r;
        const edited = [];
        for (const t of S.tracks) for (const c of t.clips) if (c.kind === "midi" && before.get(c.id) !== JSON.stringify([c.notes, c.start, c.length])) edited.push(c);
        // all on live TOY MACHINE engines: just change their queues (the rest of the song plays on untouched)
        if (edited.length && edited.every((c) => c.plugins.some(isTM) && tmRequeue(c.id))) return r;
        softRestart();
        return r;
      };
      continue;
    }
    handlers[name] = (args) => { const r = orig(args); softRestart(args && args.drag); return r; };
  }
  // GHOST off: a muted lane doesn't push a KILLCHAIN down, so muting / soloing a KILLCHAIN input while it plays
  // rebuilds the sound (other lanes' mutes stay instant). KT2_KCHN_GHOST_OFF = old (mute never rebuilds).
  for (const name of ["toggleMute", "toggleSolo"]) {
    const orig = handlers[name];
    if (!orig) continue;
    handlers[name] = (args) => {
      const id = args && args.trackId;
      const feeds = !kGhostOff() && S.transport.playing && S.tracks.some((t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins || [])]
        .some((p) => p.type === "ktside" && p.enabled !== false && p.side && !kGhost(p) && sideSrc(p, t).some((x) => x.t === id)));
      const r = orig(args);
      if (feeds) softRestart();
      return r;
    };
  }

  // Undo/redo (Cmd+Z): a snapshot of the lanes, sections and tempo before each edit.
  const undoStack = [], redoStack = [];
  // (TOY MACHINE's dropped sounds are big and never change once made, so every snapshot shares
  // them instead of copying the audio 50 times)
  const snapshot = () => {
    const held = new Map();
    for (const t of S.tracks) for (const q of tmPlugins(t)) if (q.toy && (q.toy.drops || q.toy.sample)) { held.set(q.id, { drops: q.toy.drops, sample: q.toy.sample }); q.toy.drops = undefined; q.toy.sample = undefined; }
    let snap;
    try { snap = structuredClone({ tracks: S.tracks, sections: S.sections, cues: S.cues || {}, bpm: S.bpm, key: S.key, master: S.master, returns: S.returns, tempo: S.tempo || [], tempoMode: S.tempoMode || "curve" }); }
    finally {
      const put = (tracks) => { for (const t of tracks) for (const q of tmPlugins(t)) { const h = held.get(q.id); if (h) { if (h.drops) q.toy.drops = h.drops; else delete q.toy.drops; if (h.sample) q.toy.sample = h.sample; else delete q.toy.sample; } } };
      put(S.tracks);
      if (snap) put(snap.tracks);
    }
    return snap;
  };
  const UNDO_NOOP = new Set(["addAutomation", "setNoInstrument", "setLayerLinked", "setBusFold", "setBalance", "setSendPre", "moveClips", "moveClip", "setTrackVolume", "setClipGain", "setReturnVolume", "movePlugin", "moveTrack", "setClipRow", "setClipActive", "moveSection", "setClipColor", "renameClip", "setLanePan", "setLaneOct", "setLaneGap", "setCue", "setTempoMode", "setTempoMap", "setClipBounds", "setTrackBus", "setBusMember", "setSend", "setBusMode", "renameBus"]);
  let noopPopped = null;
  const undoSig = (snap) => JSON.stringify(snap, (k, v) => (k === "drops" || k === "sample" ? undefined : v));
  for (const name of ["applyChain", "addPlugin", "removePlugin", "movePlugin", "clearEffects", "splitClip", "deleteClip", "moveClip",
                      "deleteTrack", "setClipTake", "setClipComp", "flattenComp", "moveClips", "duplicateClips", "setClipBounds",
                      "setClipFades", "renameClip", "setClipGain", "setTrackVolume", "setMasterAuto", "setSend", "newBus", "setBusMode", "setBusMember", "setBusFold", "setSendPre", "setMacros", "renameBus", "deleteBus", "setBalance", "setTrackBus", "setMixKnob", "setMixReference", "setReturnVolume", "toggleReturnMute", "addAutomation", "setAutomation", "removeAutomation", "recordAutomation",
                      "setClipActive", "reverseClip", "consolidateClips", "insertTime", "deleteTime", "editAudio",
                      "makeCompound", "joinCompound", "makeUnique", "breakCompound", "renameCompound", "setLanePan", "layerTakes", "compAB", "moveTrack", "moveSection", "slideSection", "dropSection", "insertSection", "makeUniqueLane", "makeUniqueSounds", "setSoundVersion", "moveClipToNewLane", "setClipColor", "setClipRow", "setCue", "addSynthLayer", "setNoInstrument", "setLaneOct", "setLayerLinked", "setStackNotes", "setLaneGap", "setSideInput", "setSideGhost", "setTempoMap", "setTempoMode"]) {
    const orig = handlers[name];
    if (!orig) continue;   // (the compound and record commands only exist on the KILLTOY 2 page)
    handlers[name] = (args) => { // a drag's later steps ({ drag: true }) belong to its first undo step
      // Deep debug 16 Nov: a command that answers with an error ("Nothing to move.") changed nothing, yet it left a
      // Cmd+Z step, so the next Cmd+Z seemed to do nothing. That empty step is taken back. KT2_UNDO_ERRPOP_OFF = old.
      if (args && args.drag) {
        // a drag whose first step changed nothing (so its step was taken back below) gets that step back now
        if (noopPopped && noopPopped.name === name && noopPopped.depth === undoStack.length) { undoStack.push(noopPopped.snap); if (undoStack.length > 50) undoStack.shift(); }
        noopPopped = null;
        return orig(args);
      }
      noopPopped = null;
      const mine = snapshot();
      undoStack.push(mine); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
      const r = orig(args);
      if (r && r.error && typeof r.then !== "function" && !window.KT2_UNDO_ERRPOP_OFF && undoStack[undoStack.length - 1] === mine) undoStack.pop();
      // Same for an edit that changes nothing (a lane dropped back where it was, the same key picked again):
      // no Cmd+Z step for it. Only for the commands below, which never touch sample data. KT2_UNDO_NOOP_OFF = old.
      else if (UNDO_NOOP.has(name) && !(r && typeof r.then === "function") && !window.KT2_UNDO_NOOP_OFF && undoStack[undoStack.length - 1] === mine) {
        try { if (undoSig(snapshot()) === undoSig(mine)) { undoStack.pop(); noopPopped = { name, snap: mine, depth: undoStack.length }; } } catch (e) { /* keep the step */ }
      }
      return r;
    };
    handlers[name].undoable = true;
  }
  // TEMPO lane: inserting or deleting time moves the tempo points after it too
  for (const name of ["insertTime", "deleteTime"]) {
    const orig = handlers[name];
    if (!orig || window.KT2_TEMPO_OFF) continue;
    handlers[name] = (args) => {
      const r = orig(args), spb = 60 / S.bpm, at = (+(args && args.at) || 0) / spb, n = (+(args && args.seconds) || 0) / spb;
      if (Array.isArray(S.tempo) && S.tempo.length && n > 0 && !(r && r.error)) {
        if (name === "insertTime") S.tempo = S.tempo.map((q) => (q.beat >= at - 1e-6 ? { ...q, beat: q.beat + n } : q));
        else S.tempo = S.tempo.filter((q) => q.beat < at - 1e-6 || q.beat >= at + n - 1e-6).map((q) => (q.beat >= at + n - 1e-6 ? { ...q, beat: q.beat - n } : q)).filter((q) => q.beat > 0);
        if (!window.KT2_TEMPO_SECTIONS_OLD) changed();   // the TEMPO lane redraws its moved dots now (they stayed put on screen until the next edit)
      }
      return r;
    };
    handlers[name].undoable = true;
  }
  const restore = (from, to) => {
    if (!from.length) return { ok: false };
    to.push(snapshot());
    const snap = from.pop();
    S.tracks = snap.tracks; S.sections = snap.sections; S.cues = snap.cues || {}; S.bpm = snap.bpm; S.tempo = snap.tempo || []; if (snap.tempoMode) S.tempoMode = snap.tempoMode; if (snap.key) S.key = snap.key; S.master = snap.master || freshMaster(); S.returns = snap.returns || returnsOf(S.bpm);
    S.tracks.forEach((t) => tmAutoRefresh(t.id)); // TOY MACHINE automation may have come or gone
    // TOY MACHINE: the playing synths take the restored sound (drop zone sounds come back from
    // their saved copies); the open window reloads it (app.js, on toyRestored).
    for (const t of S.tracks) {
      const q = tmPlugins(t)[0], pr = q && tmPresetOf(q);
      if (pr) for (const s of tmSynths(t)) { s.setPreset(pr); tmGiveSample(s, pr); tmSendDrops({ s }, q); }
    }
    updateTrackGains(); changed(); restartIfPlaying();
    return { ok: true, toyRestored: true };
  };
  // TOY MACHINE sends the whole preset on every knob move: one undo step per settled change
  // (calls less than half a second apart, on the same synth, belong to the same step).
  let tmUndoAt = 0, tmUndoPid = null, tmUndoStep = null, tmRestoreAt = -1e9;
  for (const name of ["toyMachineSetPreset", "toyMachineSetMacro", "toyMachineSetDropSample", "toyMachineSetSample"]) {
    const orig = handlers[name];
    if (!orig) continue;
    handlers[name] = (args) => {
      const now = performance.now(), pid = args && args.pluginId, step = args && args.step;
      // windows that know where a drag starts send a step id (BLOB): one undo step per id; otherwise group by time
      const fresh = step ? step !== tmUndoStep || pid !== tmUndoPid : now - tmUndoAt > 500 || pid !== tmUndoPid;
      tmUndoStep = step || null;
      // Redo (9 Nov triple check): right after Cmd+Z / Cmd+Shift+Z the open synth window reloads the restored sound and,
      // when it fills in its default points, sends it straight back. That echo was taken as a new edit, which wiped
      // the redo list, so Cmd+Shift+Z did nothing after "Start with a synth". The echo is now part of the undo itself.
      // KT2_REDO_ECHO_OLD = old
      if (fresh && !step && now - tmRestoreAt < 600 && !window.KT2_REDO_ECHO_OLD) { tmUndoAt = -1e9; tmUndoStep = null; return orig(args); }
      if (fresh) { undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0; }
      tmUndoAt = now; tmUndoPid = pid;
      return orig(args);
    };
    handlers[name].undoable = true;
  }
  handlers.undo = () => { kdUndoAt.t = -1e9; tmUndoAt = -1e9; tmUndoStep = null; tmRestoreAt = performance.now(); return restore(undoStack, redoStack); };
  // Quests (V5p, Eman: pressing the guide goes back one step so you can make it again): a copy of the song at the start
  // of each quest step, and a way back to one (the going back is itself one Cmd+Z step). Kept in memory only.
  const questSnaps = new Map();
  handlers.questSnap = ({ key } = {}) => { if (key == null) return { error: "no key" }; questSnaps.set(String(key), { session: S.session, snap: snapshot() }); return { ok: true }; };
  handlers.questRestore = ({ key } = {}) => {
    const q = questSnaps.get(String(key));
    if (!q || q.session !== S.session) return { error: "no copy for that step" };
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const r = restore([q.snap], []);
    questSnaps.set(String(key), { session: S.session, snap: snapshot() });   // the copy went live: keep a fresh one
    return r;
  };
  handlers.questSnapsClear = () => { questSnaps.clear(); return { ok: true }; };
  handlers.redo = () => { kdUndoAt.t = -1e9; tmUndoAt = -1e9; tmUndoStep = null; tmRestoreAt = performance.now(); return restore(redoStack, undoStack); };

  // The readout for a knob that isn't playing right now. KILLTOY's own effects work it out
  // without starting an audio node.
  function knobText(p, pid, v) {
    if (p.type === "ktside" && window.KillChain) return KillChain.text(pid, v);
    const T = window.KillToyFx && window.KillToyFx.TYPES[p.type];
    if (!T) return (BUILD[p.type] || passthrough)(p).set(pid, v);
    const q = T.params.find((x) => x.id === pid);
    return q && window.KillToyFx.text(q, window.KillToyFx.fromKnob(q, v));
  }

  // Knobs change the sound live, with real units on the readout.
  const origSetParam = handlers.setParam;
  // TOYTUNE's window: its whole setup ({ pluginId, tt }); the playing sound follows at once. { save: true } = a Cmd+Z step
  // (the window sends one when a drag or click ends), the steps in between only change the sound.
  let ttUndo = null;   // the song before the TOYTUNE drag that is going on
  handlers.setToyTune = ({ pluginId, tt, save }) => {
    const p = [...S.master.plugins, ...(S.returns || []).flatMap((r) => r.plugins), ...S.tracks.flatMap((t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)])].find((x) => x.id === pluginId);
    if (!p || p.type !== "kttoytune") return { error: "That TOYTUNE isn't there any more." };
    // Deep debug 16 Nov: a change in the TOYTUNE window made no Cmd+Z step, so Cmd+Z after turning a TOYTUNE knob
    // took away the step before it (often the whole TOYTUNE). Now the song as it was before the first move of a
    // drag is remembered, and becomes the Cmd+Z step when the drag ends ({ save: true }), if anything changed.
    // window.KT2_TT_UNDO_OFF = true: no step, as before.
    if (!window.KT2_TT_UNDO_OFF) {
      if (!ttUndo || ttUndo.id !== pluginId) ttUndo = { id: pluginId, snap: snapshot(), was: JSON.stringify(p.tt || null) };
      if (save) {
        if (ttUndo.was !== JSON.stringify(tt)) { undoStack.push(ttUndo.snap); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0; }
        ttUndo = null;
      }
    }
    p.tt = JSON.parse(JSON.stringify(tt));
    if (window.KT2ToyTune) KT2ToyTune.syncCard(p);
    const fx = fxNodes.get(pluginId);
    if (fx && fx.setAll && window.KT2ToyTune) fx.setAll(KT2ToyTune.values(p.tt));
    if (fx && fx.refeed) fx.refeed();
    if (save) changed();
    return { ok: true };
  };
  // TOY VOX's window: its whole setup ({ pluginId, tv }), same undo pattern as TOYTUNE. { enabled } = the ON/MUTED switch,
  // which is the card's own power (togglePlugin), so a muted TOY VOX costs nothing.
  let tvUndo = null;
  handlers.setToyVox = ({ pluginId, tv, save, enabled }) => {
    const p = [...S.master.plugins, ...(S.returns || []).flatMap((r) => r.plugins), ...S.tracks.flatMap((t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)])].find((x) => x.id === pluginId);
    if (!p || p.type !== "kttoyvox") return { error: "That TOY VOX isn't there any more." };
    if (!tvUndo || tvUndo.id !== pluginId) tvUndo = { id: pluginId, snap: snapshot(), was: JSON.stringify(p.tv || null) };
    if (save && enabled == null) {
      if (tvUndo.was !== JSON.stringify(tv)) { undoStack.push(tvUndo.snap); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0; }
      tvUndo = null;
    }
    const t = JSON.parse(JSON.stringify(tv));
    delete t.on;
    const lat0 = fxLead([p]);
    p.tv = t;
    // LIVE tune / CHOIR change TOY VOX's delay: the clips start earlier or later, so the sound is rebuilt
    if (fxLead([p]) !== lat0 && S.transport.playing && enabled == null) { softRestart(); if (save) changed(); return { ok: true }; }
    if (window.KT2ToyVox) KT2ToyVox.syncCard(p);
    if (enabled != null && !!p.enabled !== !!enabled) { tvUndo = null; handlers.togglePlugin({ pluginId }); return { ok: true }; }
    const fx = fxNodes.get(pluginId);
    if (fx && fx.setAll && window.KT2ToyVox) fx.setAll(KT2ToyVox.values(p.tv));
    if (save) changed();
    return { ok: true };
  };
  handlers.toyVoxMeter = ({ pluginId }) => { const fx = fxNodes.get(pluginId); return fx && fx.tvMeter ? { ok: true, ...fx.tvMeter } : { ok: false }; };
  handlers.toyTuneMeter = ({ pluginId }) => { const fx = fxNodes.get(pluginId); return fx && fx.ttMeter ? { ok: true, ...fx.ttMeter } : { ok: false }; };
  handlers.toyTuneLive = ({ pluginId, pitch, on }) => { const fx = fxNodes.get(pluginId); if (fx && fx.live) fx.live(pitch, on); return { ok: !!fx }; };
  handlers.toyTuneLanes = ({ pluginId }) => {
    const inst = S.tracks.filter((t) => t.kind === "inst" && !t.clips.some((c) => (c.plugins || []).some((q) => q.instrument && q.kit)));
    const p = S.tracks.flatMap((t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)]).find((x) => x.id === pluginId);
    const f = p ? ttFeeds(p) : { lane: null };
    return { ok: true, lanes: inst.map((t) => ({ id: t.id, name: t.name })), lane: f.lane };
  };
  handlers.setParam = (args) => {
    const uw = uwSetParam(args) || kitSetParam(args);
    if (uw) return uw;
    // Stress test 16 Nov: a knob took any number (5, -3, not a number) from a command and kept it, so the card and the
    // sound could end up outside the knob. Knobs are 0..1: out of range is pulled in, not a number is refused.
    // window.KT2_PARAM_CLAMP_OFF = true: any value goes in, as before.
    if (!window.KT2_PARAM_CLAMP_OFF && args) {
      const v = typeof args.value === "number" ? args.value : NaN;
      if (!isFinite(v)) return { error: "That knob value is not a number." };
      if (v < 0 || v > 1) args = Object.assign({}, args, { value: Math.min(1, Math.max(0, v)) });
    }
    const r = origSetParam(args);
    const fx = fxNodes.get(args.pluginId);
    const p = [...S.master.plugins, ...(S.returns || []).flatMap((r) => r.plugins), ...S.tracks.flatMap((t) => [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins)])].find((x) => x.id === args.pluginId);
    const prm = p && p.params.find((x) => x.id === args.paramId);
    const text = fx ? fx.set(args.paramId, args.value) : prm && knobText(p, args.paramId, args.value);
    if (p && p.type === "ktside") for (const [k, f] of fxNodes) if (String(k).startsWith(args.pluginId + ":L")) f.set(args.paramId, args.value);   // its stacked-synth copies
    if (prm && text) { prm.text = text; if (r && r.ok) r.text = text; changed(); }
    return r;
  };

  // ---------------------------------------------------------------------------
  // The AI tools, done for real on the test audio (simpler maths than the app, same idea),
  // so they can be tried: real notes for Tune, real stems, audible Clean / Gate / Align.
  let bufNo = 0;
  const lazy = {};
  function loadExtra(key) { // extra stems + the AI "new part" render, fetched only when needed
    if (buffers[key]) return Promise.resolve(buffers[key]);
    if (!lazy[key]) lazy[key] = fetch("audio/" + key + ".mp3").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((d) => ctx.decodeAudioData(d)).then((b) => (buffers[key] = b)).catch(() => { if (!window.KT2_LAZY_RETRY_OFF) delete lazy[key]; return null; });   // a failed download is tried again next time (deep debug 16 Nov)
    return lazy[key];
  }
  function segment(c) { // the clip's own audio (its comp, if it has one) as a new buffer
    const first = buffers[takeOf(c, c.take).src], sr = first.sampleRate, n = Math.max(1, Math.floor(c.length * sr));
    const chs = Math.max(...piecesOf(c).map((x) => buffers[takeOf(c, x.take).src].numberOfChannels));
    const out = ctx.createBuffer(chs, n, sr), F = Math.floor(0.01 * sr);
    const pieces = piecesOf(c);
    pieces.forEach((x, k) => {
      const ts = takeOf(c, x.take), src = buffers[ts.src], g = ts.gain || 1;
      const a = Math.max(0, Math.floor(x.start * sr) - (k ? F : 0)), z = Math.min(n, Math.floor(x.end * sr) + (k < pieces.length - 1 ? F : 0));
      for (let ch = 0; ch < chs; ch++) {
        const from = src.getChannelData(Math.min(ch, src.numberOfChannels - 1)), y = out.getChannelData(ch), o = Math.floor(ts.offset * sr);
        for (let i = a; i < z; i++) {
          let w = 1;
          if (k && i < a + 2 * F) w = (i - a) / (2 * F);
          if (k < pieces.length - 1 && i > z - 2 * F) w = Math.min(w, (z - i) / (2 * F));
          y[i] += (from[o + i] || 0) * g * w;
        }
      }
    });
    return out;
  }
  const keep = (buf) => { const k = "fx" + ++bufNo; buffers[k] = buf; return k; };
  const trackOf = (cid) => S.tracks.find((t) => t.clips.some((c) => c.id === cid));
  // clips that just got their own new sound (Clean, Tune, a KILLDRUM swap...) leave their linked copies:
  // together they are one new version of the sound (kt2-link.js), so a later change to a copy can't copy
  // the old sound back over them (debug pass 7 Nov)
  function ownVersion(clips) {
    const groups = new Map();
    // one version per old link + new sound (clips that now play different audio can't share a link)
    for (const c of clips) { const k = (c.link || c.src) + "|" + c.src; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
    for (const list of groups.values()) {
      const fam = list[0].fam || list[0].link || list[0].src, all = [];
      for (const t of S.tracks) for (const x of t.clips) if ((x.fam || x.link || x.src) === fam) all.push(x);
      const ver = Math.max(1, ...all.map((x) => x.ver || 1)) + 1, link = "u" + id();
      for (const x of all) if (!x.ver) x.ver = 1;
      for (const c of list) { c.link = link; c.fam = fam; c.ver = ver; }
    }
  }
  function swapClip(cid, buf, tag, extra = {}) {
    const t = trackOf(cid);
    if (!t) return;
    const i = t.clips.findIndex((c) => c.id === cid), c = t.clips[i];
    t.clips[i] = { ...c, id: id(), src: buf ? keep(buf) : c.src, offset: buf ? 0 : c.offset,
                   ...(buf ? { takeSrc: null, takes: 0, take: 0, comp: null, level: 1 } : {}),
                   name: c.name.replace(/ \(.*\)$/, "") + ` (${tag})`, ...extra };
    if (!window.KT2_LINK_OLD) ownVersion([t.clips[i]]);
  }
  const addLane = (name, role, clips, muted = false) => {
    S.tracks.push({ id: id(), name, kind: "take", role, armed: false, muted, solo: false, clips });
  };

  // A job that shows progress for about `seconds` while the work runs, then applies it.
  function job(label, seconds, work) {
    const j = { id: id(), label, stage: "Working", progress: 0, finished: false, failed: false, message: "" };
    S.jobs.push(j);
    const t0 = performance.now();
    let result = null, failed = null;
    setTimeout(() => Promise.resolve().then(work).then((r) => (result = r || "Done"), (e) => (failed = String(e))), 60);
    const tick = setInterval(() => {
      const timeUp = performance.now() - t0 >= seconds * 1000;
      j.progress = Math.min(result || failed ? 1 : 0.96, (performance.now() - t0) / (seconds * 1000));
      if (timeUp && (result || failed)) {
        clearInterval(tick);
        j.progress = 1; j.finished = true; j.failed = !!failed; j.message = failed || result;
        restartIfPlaying();
        setTimeout(() => { S.jobs = S.jobs.filter((x) => x !== j); changed(); }, 6000);
      }
      changed();
    }, 150);
    changed();
    return { ok: true, jobId: j.id };
  }

  // Pitch: YIN on a 11 kHz copy, one value every 20 ms, then grouped into notes.
  function readPitch(buf) {
    const d = 4, sr = buf.sampleRate / d, src = buf.getChannelData(0);
    const n = Math.floor(src.length / d), x = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < d; k++) v += src[i * d + k]; x[i] = v / d; }
    const W = 512, hop = Math.round(sr * 0.02), tMin = Math.floor(sr / 900), tMax = Math.ceil(sr / 75);
    const curve = [], df = new Float32Array(tMax + 1);
    let loud = 0;
    for (let i = 0; i < n; i++) loud = Math.max(loud, Math.abs(x[i]));
    for (let f = 0; f * hop + W + tMax < n; f++) {
      const o = f * hop;
      let e = 0;
      for (let i = 0; i < W; i++) e += x[o + i] * x[o + i];
      if (Math.sqrt(e / W) < loud * 0.04) { curve.push(0); continue; }
      let run = 0, best = 0;
      for (let tau = 1; tau <= tMax; tau++) {
        let s2 = 0;
        for (let i = 0; i < W; i++) { const q = x[o + i] - x[o + i + tau]; s2 += q * q; }
        run += s2;
        df[tau] = run ? (s2 * tau) / run : 1;
        if (tau >= tMin && !best && df[tau] < 0.15) {
          while (tau + 1 <= tMax) { // walk to the bottom of this dip
            let s3 = 0;
            for (let i = 0; i < W; i++) { const q = x[o + i] - x[o + i + tau + 1]; s3 += q * q; }
            const next = ((s3) * (tau + 1)) / (run + s3);
            if (next >= df[tau]) break;
            run += s3; tau++; df[tau] = next;
          }
          best = tau;
          break;
        }
      }
      curve.push(best ? 69 + 12 * Math.log2(sr / best / 440) : 0);
    }
    const notes = [];
    let start = -1, vals = [];
    const flush = (end) => {
      if (start >= 0 && end - start >= 5) {
        const m = vals.slice().sort((a, b) => a - b)[vals.length >> 1];
        notes.push({ start: start * 0.02, end: end * 0.02, midi: m });
      }
      start = -1; vals = [];
    };
    curve.forEach((m, i) => {
      if (!m) return flush(i);
      if (start >= 0 && Math.abs(m - vals[vals.length - 1]) > 0.8) flush(i);
      if (start < 0) start = i;
      vals.push(m);
    });
    flush(curve.length);
    return { curve, notes };
  }

  // Pitch shift that keeps the timing: 70 ms grains, each read at a different speed.
  // ratioAt(sec) gives the speed (1 = untouched) at each moment.
  function shiftPitch(buf, ratioAt, grain = 0.07) {
    const sr = buf.sampleRate, G = Math.round(sr * grain), H = G >> 2;
    const out = ctx.createBuffer(buf.numberOfChannels, buf.length, sr);
    const win = new Float32Array(G);
    for (let i = 0; i < G; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / G);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const x = buf.getChannelData(ch), y = out.getChannelData(ch), norm = new Float32Array(buf.length);
      for (let o = -G; o < x.length; o += H) {
        const r = ratioAt((o + G / 2) / sr);
        const c = o + G / 2;
        for (let i = 0; i < G; i++) {
          const t = o + i;
          if (t < 0 || t >= x.length) continue;
          const p = c + (i - G / 2) * r, k = Math.floor(p), f = p - k;
          const v = k >= 0 && k + 1 < x.length ? x[k] * (1 - f) + x[k + 1] * f : 0;
          y[t] += v * win[i]; norm[t] += win[i];
        }
      }
      for (let i = 0; i < y.length; i++) if (norm[i] > 1e-3) y[i] /= norm[i];
    }
    return out;
  }

  function cleanBuffer(buf, strength) {
    const sr = buf.sampleRate, out = ctx.createBuffer(buf.numberOfChannels, buf.length, sr);
    const a = Math.exp(-1 / (0.004 * sr)), rel = Math.exp(-1 / (0.12 * sr));
    const hpA = Math.exp((-2 * Math.PI * 90) / sr);
    let peak = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) for (const v of buf.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
    const thr = peak * Math.pow(10, -32 / 20);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const x = buf.getChannelData(ch), y = out.getChannelData(ch);
      let env = 0, hpY = 0, hpX = 0, g = 1;
      for (let i = 0; i < x.length; i++) {
        hpY = hpA * (hpY + x[i] - hpX); hpX = x[i]; // rumble out
        const v = Math.abs(hpY);
        env = v > env ? a * env + (1 - a) * v : rel * env + (1 - rel) * v;
        const below = env < thr ? Math.min(1, (20 * Math.log10(thr / Math.max(env, 1e-6))) / 24) : 0;
        const target = Math.pow(10, (-below * 42 * strength) / 20);
        g += (target - g) * (target < g ? 0.0008 : 0.004);
        y[i] = hpY * g;
      }
    }
    return out;
  }

  Object.assign(handlers, {
    trackPitch: async ({ clipId }) => {
      await loaded;
      const c = findClip(clipId);
      if (!c || !buffers[c.src]) return { ok: true, clipId, notes: [], curve: [], curveStep: 0.02, key: S.key };
      const { curve, notes } = readPitch(segment(c));
      return { ok: true, clipId, notes, curve, curveStep: 0.02, key: S.key };
    },
    tune: ({ clipId, notes }) => {
      const c = findClip(clipId);
      return job("Tune " + c.name, 2.5, () => {
        const moves = (notes || []).filter((n) => Math.abs((n.target ?? n.midi) - n.midi) > 0.02);
        tunePreview.delete(clipId);
        if (!moves.length) { swapClip(clipId, null, "tuned"); return "Nothing to move: every note was already on target"; }
        const ratioAt = (t) => { const n = moves.find((m) => t >= m.start && t < m.end); return n ? Math.pow(2, (n.target - n.midi) / 12) : 1; };
        swapClip(clipId, shiftPitch(segment(c), ratioAt), "tuned");
        return `Tuned ${moves.length} note${moves.length > 1 ? "s" : ""}`;
      });
    },
    align: ({ clipId, strength = 1 }) => {
      const c = findClip(clipId);
      return job("Align " + c.name, 2.5, () => {
        const was = c.delay || 0;
        swapClip(clipId, null, "aligned", { delay: was * (1 - strength) });
        return was ? `Lined up with the lead (moved it ${Math.round(was * strength * 1000)} ms)` : "Already tight with the lead";
      });
    },
    cleanVocal: ({ clipId, strength = 0.6 }) => {
      const c = findClip(clipId);
      return job("Clean " + c.name, 3, () => { swapClip(clipId, cleanBuffer(segment(c), strength), "clean"); return "Cleaned: rumble and the noise between words are down"; });
    },
    splitStems: ({ clipId, pick }) => {
      const c = findClip(clipId);
      const isBeat = trackOf(clipId).kind === "beat";
      // any sound: the real splitter (BS-RoFormer in ui/stemsplit-rof.js, else Demucs in
      // ui/stemsplit.js); the ready-made demo stems only without either
      if (window.StemSplit || window.StemSplitRof) return splitForReal(c, pick);
      return job("Split stems: " + c.name, 6, async () => {
        const part = (name, src, level) => ({ id: id(), name, src, start: c.start, length: c.length, offset: c.offset, take: 0, takes: 0, plugins: [], level });
        if (!isBeat) { addLane("Vocals stem", "stem", [part("Vocals", c.src, c.level)], true); return "Only vocals in this clip: added as a muted lane"; }
        const got = [];
        for (const [key, name] of [["drums", "Drums"], ["bass", "Bass"], ["music", "Music"]]) {
          if (!(await loadExtra(key))) continue;
          addLane(name + " stem", "stem", [part(name, key)], !!window.KT2_STEMS_MUTED);
          got.push(name.toLowerCase());
        }
        if (!got.length) throw new Error("The stem files aren't in this playground build");
        if (!window.KT2_STEMS_MUTED) { c.active = false; changed(); }
        return window.KT2_STEMS_MUTED ? `Split into ${got.length} stems (${got.join(", ")}). Muted: solo one to hear it` : `Split into ${got.length} stems (${got.join(", ")}). They play now; the original is muted`;
      });
    },
    sendToAI: ({ clipId, mode, prompt }) => {
      if (!prompt || !prompt.trim()) return { error: "Describe what the AI should make, like \"airy female harmony, R&B\"." };
      const c = findClip(clipId);
      const isBeat = trackOf(clipId).kind === "beat";
      return job("Send to AI: " + c.name, 8, async () => {
        if (mode === "cover" && !isBeat) {
          addLane("AI " + c.name, "harmony", [{ id: id(), name: "AI: " + prompt.slice(0, 24), src: keep(shiftPitch(segment(c), () => Math.pow(2, 3 / 12))),
            start: c.start, length: c.length, offset: 0, take: 0, takes: 0, plugins: [], level: 0.7, pan: 0.3 }]);
          return "AI result added on its own lane, same bar";
        }
        const mel = await loadExtra("melody");
        if (!mel) throw new Error("The AI test part isn't in this playground build");
        const loop = B(16), from = B(52);
        const at = c.start < from ? from + ((((c.start - from) % loop) + loop) % loop) : c.start;
        addLane("AI new part", "fx", [{ id: id(), name: "AI: " + prompt.slice(0, 24), src: "melody", start: c.start,
          length: Math.min(c.length, mel.duration - at), offset: at, take: 0, takes: 0, plugins: [], level: 0.8 }]);
        return "New part added on its own lane, same bar";
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Samples: sounds from the connected folder (Splice) become real clips. Loops with a
  // BPM in their name are stretched to the song tempo, keeping their pitch.
  const sampleFiles = new Map();
  window.purpSampleFile = (sid) => sampleFiles.get(sid) || null;   // kt2-samplelist.js draws waveforms from it (local file, read in the page)
  const origSetSampleFiles = handlers.setSampleFiles;
  handlers.setSampleFiles = (args) => {
    const r = origSetSampleFiles(args);
    if (!args.add) sampleFiles.clear();
    r.samples.forEach((x, i) => sampleFiles.set(x.id, args.files[i]));
    return r;
  };
  // Signalsmith Stretch in the browser (killtoy-stretch.js): speed and key in one clean pass, like the app.
  // KT2_STRETCH_OLD = true = the old in-page stand-in (resample + grain overlap) (Eman, 6 Nov 22:23)
  const proMake = (ch, n, sr) => ctx.createBuffer(ch, n, sr);
  async function proReady() { if (window.KT2_STRETCH_OLD || !window.KillToyStretch) return false; return KillToyStretch.ready || (await KillToyStretch.load("killtoy-stretch.wasm")); }
  async function proRender(buf, speed, semis, formant) {
    if (!(await proReady())) return null;
    try { const o = { speed, semitones: semis || 0, formant: !!formant, make: proMake }; return KillToyStretch.renderAsync ? await KillToyStretch.renderAsync(buf, o) : KillToyStretch.render(buf, o); } catch (e) { console.warn("stretch", e); return null; }
  }
  async function stretchTo(buf, rate, grain) { // rate > 1 = faster; same pitch (grain: shorter for voices)
    const pro = await proRender(buf, rate, 0, !!grain);
    if (pro) return pro;
    const off = new OfflineAudioContext(buf.numberOfChannels, Math.ceil(buf.length / rate), buf.sampleRate);
    const src = off.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    src.connect(off.destination); src.start();
    return shiftPitch(await off.startRendering(), () => 1 / rate, grain);
  }
  // LEADING SILENCE (Eman, 6 Nov 22:45): exports and MP3s often carry a little empty space before the
  // music (MP3 encoders ~25-50 ms, some masters more). On import we cut only the part that pushes the
  // hits off the beat grid, never a musical rest:
  //  1. the first sound = the first moment louder than 48 dB under the file's peak (1 ms kept before it)
  //  2. with a steady beat (BPM from the name, or listened for) and >= 6 hits that sit on a 1/16 grid,
  //     the silence is split into whole 1/16 steps (a rest: kept) and the leftover that makes every hit
  //     late (cut). So 25 ms in front of hits that are all 25 ms late goes; one beat of rest stays.
  //  3. no steady beat: only a gap of 60 ms or less is cut (encoder padding size); longer is a choice.
  //  Nothing over 2 bars is touched. KT2_TRIM_OFF = true turns it off.
  function leadTrim(buf, bpm) {
    const sr = buf.sampleRate, n = buf.length, chs = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    let peak = 0; for (const x of chs) for (let i = 0; i < n; i++) { const v = Math.abs(x[i]); if (v > peak) peak = v; }
    if (peak < 1e-4) return null;
    const thr = Math.max(peak * Math.pow(10, -48 / 20), Math.pow(10, -70 / 20));
    let first = n;
    for (const x of chs) for (let i = 0; i < Math.min(n, first); i++) if (Math.abs(x[i]) > thr) { first = i; break; }
    const lead = Math.max(0, first - Math.round(sr * 0.001)) / sr;
    if (lead < 0.003 || first >= n) return null;
    const out = { lead, cut: 0, why: "" };
    const g = bpm ? 60 / bpm / 4 : 0;
    if (g && lead > 8 * 4 * g) return out;   // over 2 bars of nothing: an intro, leave it
    let hits = [];
    if (g && window.killtoyConvert) {
      const cut30 = Math.min(n, first + sr * 30), mono = new Float32Array(cut30 - first);
      for (const x of chs) for (let i = first; i < cut30; i++) mono[i - first] += x[i] / chs.length;
      try { hits = killtoyConvert.onsets(mono, sr, { minGap: 0.06 }).map((h) => h.at + lead); } catch (e) { hits = []; }
    }
    if (g && hits.length >= 6) {
      let cx = 0, cy = 0;
      for (const t of hits) { const a = 2 * Math.PI * ((t % g) / g); cx += Math.cos(a); cy += Math.sin(a); }
      const R = Math.hypot(cx, cy) / hits.length;
      if (R > 0.55) {   // the hits really sit on a 1/16 grid
        const phase = ((Math.atan2(cy, cx) / (2 * Math.PI)) * g + g) % g;
        const rest = Math.max(0, Math.round((lead - phase) / g)) * g;   // whole 1/16 steps of rest: musical, kept
        const cut = lead - rest;
        if (cut >= 0.003 && cut < g) { out.cut = cut; out.why = "grid"; }
        out.R = R; out.phase = phase;
        return out;
      }
    }
    if (lead <= 0.06) { out.cut = lead; out.why = "pad"; }
    return out;
  }
  function cutStart(buf, sec) {   // the sound from sec on, with a 2 ms fade-in
    const sr = buf.sampleRate, from = Math.round(sec * sr), len = Math.max(1, buf.length - from), out = ctx.createBuffer(buf.numberOfChannels, len, sr), F = Math.round(sr * 0.002);
    for (let c = 0; c < buf.numberOfChannels; c++) { const y = out.getChannelData(c); y.set(buf.getChannelData(c).subarray(from, from + len)); for (let i = 0; i < F && i < len; i++) y[i] *= i / F; }
    return out;
  }
  // put the cut silence back (the toast's PUT BACK)
  handlers.restoreLead = async ({ clipId }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c || !c.trimmed) return { error: "Nothing was trimmed on that clip." };
    if (!buffers[c.trimmed.src]) { delete c.trimmed; return { error: "The cut part isn't kept after a reload. Drop the file in again with the trim off." }; }
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const tr = c.trimmed; delete c.trimmed;
    if (c.orig) c.orig.src = tr.src;
    if (c.orig && c.fit && (c.fit.tempo || c.fit.key || c.fit.bpm || c.fit.keyTo)) await fitClip(c, c.fit);
    else { c.src = tr.src; c.offset = 0; const b = buffers[tr.src]; if (b) c.length = b.duration; }
    changed(); restartIfPlaying();
    return { ok: true };
  };
  handlers.restoreLead.undoable = true;
  function trimToast(c, ms) {
    if (typeof window.toast !== "function") return;
    setTimeout(() => {
      toast(`Cut ${ms} ms of empty space before the first sound, so the hits land on the grid.`);
      const el = document.getElementById("toast"); if (!el) return;
      const b = document.createElement("button"); b.className = "toast-act"; b.textContent = "PUT BACK";
      b.onclick = (e) => { e.stopPropagation(); el.hidden = true; run("restoreLead", { clipId: c.id }); };
      el.append(" ", b);
    }, 60);
  }

  // "fx": the effects that shape the sound, put on its clip switched on (see startFx).
  // A Library sound comes as a url (library/preview/...); its buffer is kept under "lib:<url>".
  const libBuffer = (url) => fetchAudio("lib:" + url, url);
  // One-shots from the SAMPLES kits / Library (Eman, 12 Nov: "samples play a lot lower than chords"): the kit
  // previews are peak-normalised quiet files (about -6..-10 dBFS), and as a clip they played at 1.0, while
  // KILLDRUM plays the very same file at kdNorm x KD_HEAD (+5..6 dB at velocity 100). Now a one-shot dropped in as a
  // clip plays exactly as loud as that sound on a KILLDRUM pad. Kept in c.level (the clip's own level, so the
  // waveform, rhythm clips, export and saving all follow; the clip gain box stays at 0). KT2_SAMPLE_LEVEL_OLD = 1.0.
  const oneShotLevel = (buf, gainDb) => window.KT2_SAMPLE_LEVEL_OLD || !buf ? 1
    : kdNorm(buf) * KD_HEAD * (100 / 127) * Math.pow(10, (gainDb || 0) / 20);
  window.purpPlaygroundOneShotLevel = oneShotLevel;   // tests
  handlers.addSample = async ({ id: sid, url, name, trackId, start, bpm: from, origBpm, key: sKey, fx, laneName, libType, recLane, listen, fitSong, oneShot, gainDb }) => {
    const f = !url && sampleFiles.get(sid);
    if (!url && !f) return { error: "That sound isn't there any more. Connect the folder again." };
    let buf, src = null;
    try {
      if (url) { buf = await libBuffer(url); src = "lib:" + url; }
      else buf = await ctx.decodeAudioData(await (f.file || (await f.getFile())).arrayBuffer());
    } catch (e) { return { error: `Couldn't read ${name}. Try a WAV or MP3.` }; }
    undoStack.push(snapshot()); redoStack.length = 0;
    // a dropped file: cut the empty space that pushes its hits off the grid (leadTrim above)
    let trimmed = null;
    if (!url && !window.KT2_TRIM_OFF) {
      const nb = from || origBpm || nameBpmKey(name).bpm || (listen ? guessTempo(buf) : 0);
      let lt = leadTrim(buf, nb);
      // the name's BPM can be wrong: when its grid doesn't fit the hits, try the tempo heard by ear
      if (lt && lt.R == null && nb) { const nb2 = guessTempo(buf); if (nb2 && Math.abs(nb2 - nb) > 1) { const l2 = leadTrim(buf, nb2); if (l2 && l2.R != null) { lt = l2; lt.bpm2 = nb2; } } }
      if (window.__trimLog) window.__trimLog.push({ name, bpm: nb, ...(lt || {}) });
      if (lt && lt.cut) { trimmed = { ms: Math.round(lt.cut * 1000), src: keep(buf) }; buf = cutStart(buf, lt.cut); }
    }
    const rate = from ? S.bpm / from : 1, raw = buf, rawSrc = src;
    let stretched = false;
    if (Math.abs(rate - 1) > 0.004 && rate > 0.5 && rate < 2) { buf = await stretchTo(buf, rate); src = null; stretched = true; }
    // what it was before it was fitted to the song (the ORIGINAL | SONG switches, mock v83)
    let ob = from || origBpm || 0, okey = musicKeyOf(sKey);
    if (listen && !window.KT2_CLIPKEY_OFF) { if (!ob) ob = guessTempo(raw); if (!okey) okey = guessKey(raw); }   // a dropped file: its name didn't say, so listen
    const orig = ob || okey ? { bpm: ob, key: okey, src: stretched ? rawSrc || keep(raw) : null } : null;
    let t = trackId && S.tracks.find((x) => x.id === trackId);
    if (!t) { t = { id: id(), name: laneName || "Samples", kind: "take", role: "fx", armed: false, muted: false, solo: false, clips: [], ...(recLane ? { recLane: true } : {}) }; S.tracks.push(t); }
    if (libType && !t.libType) { t.libType = libType; if (!t.clips.length) t.sub = name; }
    const c = { id: id(), name, src: src || keep(buf), start, length: buf.duration, offset: 0, take: 0, takes: 0, plugins: startFx({ name: "" }, { fx: fx || [] }), level: oneShot && !stretched ? oneShotLevel(buf, gainDb) : 1 };
    if (orig) { if (!orig.src) orig.src = c.src; c.orig = orig; c.fit = { tempo: stretched, key: false }; }
    if (trimmed) { c.trimmed = trimmed; trimToast(c, trimmed.ms); }
    t.clips.push(c);
    if (fitSong && c.orig && !window.KT2_CLIPKEY_OFF) await fitClip(c, { tempo: !!c.orig.bpm, key: !!c.orig.key });   // into a song: it follows the song (A on)
    updateTrackGains(); changed(); restartIfPlaying();
    return { ok: true, clipId: c.id, trackId: t.id, length: c.length, bpm: ob || 0, key: okey ? okey.name : null };
  };

  // ORIGINAL | SONG (mock v83, Eman 31 Oct: "see the original vs the matched ... I can select the
  // original one, and it stays selected"). c.orig = { bpm, key: {pc, minor, name}, src: the sound as it
  // came in }; c.fit = { tempo, key } says which of the two plays the song's setting. Each change
  // renders again from the original, so switching back and forth never piles up artefacts.
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function musicKeyOf(k) {
    if (!k) return null;
    if (typeof k === "object" && k.pc != null) return { pc: k.pc, minor: !!k.minor, name: NOTE_NAMES[k.pc] + (k.minor ? "m" : ""), ...(k.scale && k.scale !== "minor" && k.scale !== "major" ? { scale: k.scale } : {}) };
    const m = String(k).trim().match(/^([A-Ga-g])([#b]?)\s*(m|min|minor|maj|major)?$/i);
    if (!m) return null;
    let pc = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
    if (m[2] === "#") pc++; if (m[2] === "b") pc--;
    pc = (pc + 12) % 12;
    const minor = !!m[3] && /^m(in(or)?)?$/i.test(m[3]);
    return { pc, minor, name: NOTE_NAMES[pc] + (minor ? "m" : "") };
  }
  // semitones that move a clip in key k to the song's key (to the relative key when major/minor differ)
  function keyShift(k) {
    const sk = S.key; if (!k || !sk || sk.tonic == null) return 0;
    if (window.KeyConvert) return window.KeyConvert.audioShift(k, sk);
    const target = k.minor === !!sk.minor ? sk.tonic : (k.minor ? sk.tonic + 9 : sk.tonic + 3);
    return (((target - k.pc) % 12) + 18) % 12 - 6;
  }
  async function bufferFor(k) {
    if (!k) return null;
    if (buffers[k]) return buffers[k];
    if (k.startsWith("lib:")) return fetchAudio(k, k.slice(4)).catch(() => null);
    const f = curSong && curSong.files && curSong.files.find((x) => x.key === k);
    return f ? fetchAudio(f.key, f.url).catch(() => null) : null;
  }
  handlers.setClipFit = async ({ clipId, tempo, key }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c || t.kind !== "take") return { error: "Pick a sound clip." };
    const o = c.orig || (c.orig = { bpm: 0, key: null, src: takeOf(c, c.take).src });
    const f = c.fit || (c.fit = { tempo: false, key: false });
    const want = { tempo: tempo == null ? f.tempo : !!tempo, key: key == null ? f.key : !!key };
    const raw = await bufferFor(o.src);
    if (!raw) return { error: "That sound isn't loaded yet. Try again in a second." };
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const rate = want.tempo && o.bpm ? S.bpm / o.bpm : 1, semis = want.key ? keyShift(o.key) : 0;
    let buf = raw;
    const warp = Math.abs(rate - 1) > 0.004 && rate > 0.5 && rate < 2;
    let mode = want.mode || "auto";
    if (warp && mode === "auto") mode = autoMode(raw);
    if (await proReady() && !window.KT2_WARP_OLD && (mode === "full" || mode === "solo" || !warp)) {
      // one clean pass for tempo and key together (Solo keeps a voice's character when the key moves)
      if (warp || semis) buf = (await proRender(raw, warp ? rate : 1, semis, mode === "solo")) || raw;
    } else {
      if (warp) buf = window.KT2_WARP_OLD ? await stretchTo(buf, rate) : await warpTo(buf, rate, mode);
      if (semis) buf = (await proRender(buf, 1, semis, mode === "solo")) || shiftPitch(buf, () => Math.pow(2, semis / 12));
    }
    const cur = buffers[c.src], frac = cur ? Math.min(1, c.length / Math.max(0.01, cur.duration - (c.offset || 0))) : 1;
    c.src = buf === raw ? o.src : keep(buf);
    c.offset = 0; c.takes = 0; c.take = 0; c.takeSrc = null; c.comp = null;
    c.length = Math.max(0.05, buf.duration * frac);
    c.fit = want;
    changed(); restartIfPlaying();
    return { ok: true, rate, semis };
  };
  handlers.setClipFit.undoable = true;

  // ---------------------------------------------------------------------------
  // BPM + KEY on every clip, each with an A (auto) switch (Eman, 6 Nov 15:22). A on = the clip
  // follows the project's tempo / key (and keeps following when the project changes); A off = it
  // plays its own: the original, or any BPM / key picked in the clip's dropdown.
  // Audio: c.fit = { tempo, key, bpm, keyTo } (bpm / keyTo = picked by hand while A is off), rendered
  // from c.orig.src each time. MIDI: the notes themselves move (c.mk = { bpm, key: the tempo and key
  // the notes are written in now, ob / okey: what they came in as }), drum lanes have no key.
  // A sound's tempo and key are guessed by listening when its name doesn't say.
  // (kept per sound: one dropped file was mixed down ~10 times, 2.4 s of a frozen page on a 2-minute vox)
  const monoCache = new WeakMap();
  function monoOf(buf) {
    if (monoCache.has(buf)) return monoCache.get(buf);
    const n = buf.length, out = new Float32Array(n), k = 1 / buf.numberOfChannels;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const x = buf.getChannelData(ch); for (let i = 0; i < n; i++) out[i] += x[i] * k; }
    monoCache.set(buf, out);
    return out;
  }
  function guessTempo(buf) {   // onset strength, then the tempo whose beat, 2, 3, 4 and 8 beats all line up (85..170)
    if (buf.duration < 3) return 0;   // a one-shot has no tempo
    const sr = buf.sampleRate, all = monoOf(buf), x = all.length > sr * 60 ? all.subarray(0, sr * 60) : all;
    const hop = Math.round(sr / 200), n = Math.floor(x.length / hop), raw = new Float32Array(n), env = new Float32Array(n);
    let lp = 0, prev = 0, mu = 0;
    for (let i = 0; i < n; i++) {
      let e = 0, h = 0;
      for (let j = i * hop; j < (i + 1) * hop; j++) { lp += 0.15 * (x[j] - lp); e += lp * lp; h += (x[j] - lp) * (x[j] - lp); }
      const v = Math.log(1e-6 + e) + 0.6 * Math.log(1e-6 + h);
      raw[i] = Math.max(0, v - prev); prev = v;
    }
    for (let i = 0; i < n; i++) { env[i] = ((raw[i - 2] || 0) + 2 * (raw[i - 1] || 0) + 3 * raw[i] + 2 * (raw[i + 1] || 0) + (raw[i + 2] || 0)) / 9; mu += env[i]; }   // softened, so the comb doesn't land between spikes
    mu /= n; for (let i = 0; i < n; i++) env[i] -= mu;
    const ac = (L) => { const l0 = Math.floor(L), fr = L - l0; let a = 0; for (let i = 0; i + l0 + 1 < n; i++) a += env[i] * (env[i + l0] * (1 - fr) + env[i + l0 + 1] * fr); return a / (n - L); };
    const fps = sr / hop, sc = (b) => { const L = (60 / b) * fps; let s = 0; for (const k of [1, 2, 4, 8]) if (L * k < n / 2) s += ac(L * k); return s; };
    let best = 0, bs = -1e9;
    for (let b = 85; b < 170; b += 0.25) { const s = sc(b); if (s > bs) { bs = s; best = b; } }
    for (let b = best - 0.3; b <= best + 0.3; b += 0.05) { const s = sc(b); if (s > bs) { bs = s; best = b; } }
    if (!(bs > 0) || best <= 85.1) return 0;   // no steady beat
    return Math.abs(best - Math.round(best)) < 0.4 ? Math.round(best) : Math.round(best * 10) / 10;
  }
  // BPM and key from a name like "beat_140bpm_F#m" or "Loop 92 BPM Am"
  function nameBpmKey(nm) {
    nm = String(nm || "");
    const b = nm.match(/(\d{2,3}(?:\.\d)?)\s*-?\s*bpm/i), k = nm.match(/(?:^|[\s_\-\[(])([A-G][#b]?)\s*(m(?:in(?:or)?)?|maj(?:or)?)?(?=$|[\s_\-\])])/);
    return { bpm: b ? +b[1] : 0, key: k ? musicKeyOf(k[1] + (k[2] && /^m(in)?/i.test(k[2]) && !/^maj/i.test(k[2]) ? "m" : "")) : null };
  }
  function guessKey(buf) {
    if (!window.KTVar) return null;
    try {
      const sr = buf.sampleRate, x = monoOf(buf), cut = x.length > sr * 90 ? x.subarray(0, sr * 90) : x;
      const k = KTVar.keyOf(KTVar.chroma(cut, sr));
      return musicKeyOf({ pc: k.tonic, minor: k.minor });
    } catch (e) { return null; }
  }
  // semitones from key a to key b (to b's relative when major / minor differ), the nearest way
  function shiftBetween(a, b) {
    if (!a || !b || b.pc == null) return 0;
    if (window.KeyConvert) return window.KeyConvert.audioShift(a, b);   // the same maths, from the shared key module
    const target = a.minor === !!b.minor ? b.pc : (a.minor ? b.pc + 9 : b.pc + 3);
    return (((target - a.pc) % 12) + 18) % 12 - 6;
  }
  const songKeyOf = () => (S.key && S.key.tonic != null ? { pc: S.key.tonic, minor: !!S.key.minor, name: NOTE_NAMES[S.key.tonic] + (S.key.minor ? "m" : ""), ...(S.key.scale ? { scale: S.key.scale } : {}) } : null);
  // ---- warp modes (Eman, 6 Nov 16:14): how a clip's tempo change is made. Auto picks one.
  //   full = stretch, keep pitch (the old way) · tape = faster/slower with the pitch · slice = every hit moved,
  //   untouched (gaps / cut tails) · slicestretch = hits moved, their tails stretched to fill · solo = stretch
  //   tuned for voices and single tones (shorter grains) · texture = tiny grains for a lo-fi smear
  const WARP_MODES = ["auto", "full", "tape", "slice", "slicestretch", "solo", "texture"];
  const hitsCache = new WeakMap();
  function hitsOf(buf) {
    const cv = window.killtoyConvert; if (!cv) return [];
    if (hitsCache.has(buf)) return hitsCache.get(buf).slice();
    try { const h = cv.onsets(monoOf(buf), buf.sampleRate, { minGap: 0.06 }).map((h) => h.at); hitsCache.set(buf, h); return h.slice(); } catch (e) { return []; }
  }
  // a one-shot (a kick, a snare, one hit or a short chop): never stretched, never re-pitched, just put
  // on its beat (Eman, 7 Nov 17:16: "for kicks and snares they don't stretch ... keep the pitch they have")
  function isOneShot(buf) {
    if (!buf) return false;
    if (buf.duration < 0.6) return true;
    if (buf.duration >= 2.5) return false;
    return hitsOf(buf).length <= 2;
  }
  function autoMode(buf) {   // one hit = placed as it is; lots of sharp hits = drums; otherwise a steady sound
    if (!window.KT2_AUTO_STRETCH_HITS && isOneShot(buf)) return "hit";
    // judged on the first 30 s (the whole of a 2-minute sound took ~3 s of a frozen page); KT2_AUTOMODE_FULL = all of it
    const cv = window.killtoyConvert, lim = buf.sampleRate * 30;
    if (!window.KT2_AUTOMODE_FULL && cv && buf.length > lim * 1.2 && !hitsCache.has(buf)) {
      let n = 0; try { n = cv.onsets(monoOf(buf).subarray(0, lim), buf.sampleRate, { minGap: 0.06 }).length; } catch (e) {}
      return n / 30 > 1.2 ? "slicestretch" : "full";
    }
    const hits = hitsOf(buf), per = hits.length / Math.max(1, buf.duration);
    return per > 1.2 ? "slicestretch" : "full";
  }
  function emptyLike(buf, len) { return ctx.createBuffer(buf.numberOfChannels, Math.max(1, Math.round(len)), buf.sampleRate); }
  function tapeTo(buf, rate) {   // resample: pitch goes with the tempo
    const out = emptyLike(buf, buf.length / rate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const x = buf.getChannelData(ch), y = out.getChannelData(ch);
      for (let i = 0; i < y.length; i++) { const p = i * rate, k = Math.floor(p), f = p - k; y[i] = k + 1 < x.length ? x[k] * (1 - f) + x[k + 1] * f : 0; }
    }
    return out;
  }
  function sliceTo(buf, rate, stretched) {   // every hit moves to its new spot; stretched = the stretched sound fills the gaps
    const sr = buf.sampleRate, hits = hitsOf(buf);
    const out = stretched ? stretched : emptyLike(buf, buf.length / rate), fade = Math.round(sr * 0.004), keepT = Math.round(sr * 0.035);
    if (!hits.length || hits[0] > 0.02) hits.unshift(0);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const x = buf.getChannelData(ch), y = out.getChannelData(ch);
      for (let h = 0; h < hits.length; h++) {
        const a = Math.round(hits[h] * sr), b = h + 1 < hits.length ? Math.round(hits[h + 1] * sr) : x.length;
        const to = Math.round(a / rate), room = (h + 1 < hits.length ? Math.round(b / rate) : y.length) - to;
        // slice: the piece as it is, cut where the next one starts. slice stretch: only the hit itself
        // (its first 35 ms) is laid over the stretched sound, which then carries the tail
        const len = stretched ? Math.min(keepT, b - a, room) : Math.min(b - a, room);
        for (let i = 0; i < len && to + i < y.length; i++) {
          const g = Math.min(1, (len - i) / fade, stretched ? i / fade + 0.0001 : 1);
          y[to + i] = stretched ? y[to + i] * (1 - g) + x[a + i] * g : x[a + i] * g;
        }
      }
    }
    return out;
  }
  function textureTo(buf, rate) {   // short random grains from where the sound would be, with tiny gaps
    const sr = buf.sampleRate, out = emptyLike(buf, buf.length / rate);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let o = 0; o < out.length;) {
      const G = Math.round(sr * (0.025 + rnd() * 0.035)), src = Math.round(o * rate + (rnd() - 0.5) * sr * 0.03), amp = 0.75 + rnd() * 0.35;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const x = buf.getChannelData(ch), y = out.getChannelData(ch);
        for (let i = 0; i < G && o + i < y.length; i++) { const k = src + i; if (k < 0 || k >= x.length) continue; y[o + i] += x[k] * amp * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / G)); }
      }
      o += Math.round(G * (0.55 + rnd() * 0.25));
    }
    return out;
  }
  async function warpTo(buf, rate, mode) {
    if (mode === "auto" || !WARP_MODES.includes(mode)) mode = autoMode(buf);
    if (mode === "hit") return buf;
    if (mode === "tape") return (await proReady()) ? (KillToyStretch.tapeAsync ? await KillToyStretch.tapeAsync(buf, rate, proMake) : KillToyStretch.tape(buf, rate, proMake)) : tapeTo(buf, rate);
    if (mode === "slice") return sliceTo(buf, rate, null);
    if (mode === "slicestretch") return sliceTo(buf, rate, await stretchTo(buf, rate));
    if (mode === "texture") return textureTo(buf, rate);
    if (mode === "solo") return stretchTo(buf, rate, 0.035);
    return stretchTo(buf, rate);
  }
  // render an audio clip from its original for c.fit (no undo step: callers take it)
  // the clip's original sound; when it's gone (an old save) the clip's own sound becomes the
  // original and is listened to again, so clicking BPM / key never ends in an error
  async function origRaw(c) {
    let raw = c.orig && c.orig.src ? await bufferFor(c.orig.src) : null;
    if (raw || window.KT2_ORIG_STRICT) return raw;
    const src = takeOf(c, c.take).src;
    raw = await bufferFor(src);
    for (let i = 0; !raw && i < 20; i++) { await new Promise((r) => setTimeout(r, 250)); raw = await bufferFor(src); }   // still decoding
    if (!raw) return null;
    const nk = nameBpmKey(c.name);
    c.orig = { bpm: nk.bpm || guessTempo(raw), key: nk.key || guessKey(raw), src };
    c.fit = { tempo: false, key: false, mode: c.fit && c.fit.mode };
    c.offset = c.offset || 0;
    return raw;
  }
  let fitCache = null;   // set while one tempo / key change renders every clip
  async function fitClip(c, want) {
    if (!c.orig) return { error: "Nothing to change: it plays as it is." };
    const raw = await origRaw(c);
    if (!raw) return { error: "Couldn't find this sound's audio. Drop the file in again." };
    const o = c.orig;
    const tb = want.tempo ? S.bpm : want.bpm || o.bpm, rate = o.bpm && tb ? tb / o.bpm : 1;
    const kt = want.key ? songKeyOf() : want.keyTo || o.key, semis = o.key && kt ? shiftBetween(o.key, kt) : 0;
    let buf = raw;
    let warp = Math.abs(rate - 1) > 0.004 && rate > 0.5 && rate < 2;
    let mode = want.mode || "auto";
    if (warp && mode === "auto") mode = autoMode(raw);
    if (mode === "hit") warp = false;   // a one-shot keeps its own sound: only where it starts follows the tempo
    // the same sound at the same tempo / key / mode renders once (linked copies, ten kicks on one lane)
    const rk = fitCache && [o.src, warp ? rate.toFixed(5) : 1, semis, warp ? mode : "-"].join("|"), hitK = rk && fitCache.get(rk);
    if (hitK && buffers[hitK]) buf = buffers[hitK];
    else if (await proReady() && !window.KT2_WARP_OLD && (mode === "full" || mode === "solo" || !warp)) {
      // one clean pass for tempo and key together (Solo keeps a voice's character when the key moves)
      if (warp || semis) buf = (await proRender(raw, warp ? rate : 1, semis, mode === "solo")) || raw;
    } else {
      if (warp) buf = window.KT2_WARP_OLD ? await stretchTo(buf, rate) : await warpTo(buf, rate, mode);
      if (semis) buf = (await proRender(buf, 1, semis, mode === "solo")) || shiftPitch(buf, () => Math.pow(2, semis / 12));
    }
    // an edited clip (the audio editor's pieces, c.edit): the pieces point into the audio the edit was
    // made on, so the new tempo / key is rendered first and the same edit is played on top of it again,
    // its times scaled to the new tempo. Before, the clip went back to the whole sound but kept the
    // edit's pieces: deleted parts came back and the pattern got too long (KT2_FIT_DROPS_EDIT = old).
    const ed = c.edit && !window.KT2_FIT_DROPS_EDIT ? c.edit : null, edBuf = ed ? buffers[ed.orig.src] : null;
    const cur = ed && edBuf ? edBuf : buffers[c.src], curOff = ed && edBuf ? ed.orig.offset || 0 : c.offset || 0, curLen = ed && edBuf ? ed.orig.length : c.length;
    const frac = cur ? Math.min(1, curLen / Math.max(0.01, cur.duration - curOff)) : 1;
    c.src = buf === raw ? o.src : hitK && buffers[hitK] === buf ? hitK : keep(buf);
    if (rk && c.src !== o.src) fitCache.set(rk, c.src);
    c.takes = 0; c.take = 0; c.takeSrc = null; c.comp = null;
    if (cur && !ed && !window.KT2_FIT_OFFSET_OLD) {
      // a clip trimmed at its start keeps playing the same part of the sound: its trim and length move with the tempo
      const sk = buf.duration / Math.max(0.01, cur.duration);
      c.offset = Math.min(Math.max(0, buf.duration - 0.05), curOff * sk);
      c.length = Math.max(0.05, Math.min(buf.duration - c.offset, curLen * sk));
    } else { c.offset = 0; c.length = Math.max(0.05, buf.duration * frac); }
    c.fit = { tempo: !!want.tempo, key: !!want.key, bpm: want.bpm || null, keyTo: want.keyTo || null, mode: want.mode || "auto", ...(want.own ? { own: true } : {}) };
    if (ed && edBuf) {
      const k = buf.duration / Math.max(0.01, edBuf.duration), sc = (x) => +x * k;
      c.offset = curOff * k;
      const orig = { src: c.src, offset: c.offset, length: Math.max(0.05, curLen * k), level: ed.orig.level, takeSrc: null, take: 0, comp: null };
      const pieces = ed.pieces.map((p) => ({ from: sc(p.from), len: sc(p.len), at: sc(p.at), semi: p.semi | 0, ...(p.dur ? { dur: sc(p.dur) } : {}), ...(p.warp && p.warp.length ? { warp: p.warp.map((w) => [sc(w[0]), sc(w[1])]) } : {}) }));
      c.edit = { ...ed, orig };   // a new object: the undo snapshot still holds the old one
      const r = await editAudioNow({ clipId: c.id, pieces });
      if (r && r.error) return r;
    }
    return { ok: true, rate, semis };
  }
  const isDrumLane = (t) => /^(TOY DRUMS|KILLDRUM)$/i.test(t.instrument || "") || t.role === "drums";
  function midiState(t, c) {
    if (!c.mk) {
      let key = songKeyOf();
      if (!key && (c.notes || []).length && window.KTVar) {   // no song key yet: guess from the notes
        const ch = new Float64Array(12); for (const n of c.notes) ch[((n.pitch % 12) + 12) % 12] += n.length || 0.25;
        const k = KTVar.keyOf(ch); key = musicKeyOf({ pc: k.tonic, minor: k.minor });
      }
      c.mk = { bpm: S.bpm, key: isDrumLane(t) ? null : key, ob: S.bpm, okey: isDrumLane(t) ? null : key, tempo: true, keyAuto: true };
    }
    return c.mk;
  }
  // move a MIDI clip's notes from one tempo / key to another
  function retempoMidi(c, from, to) {
    const f = from / to; if (Math.abs(f - 1) < 1e-4) return;
    for (const n of c.notes || []) { n.start *= f; n.length *= f; }
    if (c.beats) c.beats *= f;
    c.length = c.beats ? c.beats * 60 / S.bpm : c.length * f;
  }
  // KT2_REKEY_OLD = old: every note moved by one plain shift to the key's relative (A minor into F# major
  // landed in D# minor, so Am stayed a minor chord). New (Eman, 8 Nov): convertClipKey below.
  const newRekey = () => !window.KT2_REKEY_OLD && !!window.KeyConvert;
  function rekeyMidi(c, from, to) {
    if (newRekey()) return convertClipKey(c, from, to);
    const s = shiftBetween(from, to); if (!s) return;
    for (const n of c.notes || []) n.pitch = Math.max(0, Math.min(127, n.pitch + s));
  }
  // the key a MIDI clip lands in after rekeyMidi: the target itself (new), or the old relative-key label
  const rekeyedKey = (from, to) => (newRekey() ? musicKeyOf({ pc: to.pc != null ? to.pc : to.tonic, minor: !!to.minor, scale: to.scale })
    : musicKeyOf({ pc: (from.pc + shiftBetween(from, to) + 12) % 12, minor: from.minor }));
  // Move one MIDI clip from one key to another with the shared converter (ui/keyconvert.js): every note
  // keeps its scale degree, notes outside the old scale keep their colour, one shift for the whole clip
  // (its takes and stacked sounds too, so they stay lined up). Drum lanes in a stack stay put.
  // A clip remembers the pitches it was converted from, so A minor -> F# major -> A minor gives back
  // exactly the notes it started with, until its notes are edited.
  const pitchSig = (c) => JSON.stringify([(c.notes || []).map((n) => n.pitch), Object.entries(c.stack || {}).map(([k, ns]) => [k, (ns || []).map((n) => n.pitch)])]);
  function convertClipKey(c, from, to) {
    const KC = window.KeyConvert; if (!KC || !from || !to) return 0;
    const fk = KC.parseKey(from), tk = KC.parseKey(to); if (!fk || !tk) return 0;
    if (fk.tonic === tk.tonic && fk.scale === tk.scale) return 0;
    const kd = (id) => { const lt = S.tracks.find((x) => x.id === id); return lt && isDrumLane(lt); };
    // start from the remembered pitches when nothing was edited since the last conversion
    let src = { key: fk, notes: (c.notes || []).map((n) => n.pitch), stack: {} };
    for (const [id, ns] of Object.entries(c.stack || {})) if (!kd(id)) src.stack[id] = (ns || []).map((n) => n.pitch);
    if (c.ksrc && c.ksrc.sig === pitchSig(c) && c.ksrc.notes.length === (c.notes || []).length) src = c.ksrc;
    const groups = {}; for (const [id, ps] of Object.entries(src.stack)) if (c.stack && c.stack[id] && c.stack[id].length === ps.length) groups[id] = ps.map((p) => ({ pitch: p }));
    const takes = {}; if (c.takeNotes) for (const k of Object.keys(c.takeNotes)) if (c.takeNotes[k] && c.takeNotes[k] !== c.notes) takes["take:" + k] = c.takeNotes[k].map((n) => ({ pitch: n.pitch }));
    const r = KC.convertNotes(src.notes.map((p) => ({ pitch: p })), src.key, tk, { ...groups, ...takes });
    let moved = 0;
    const put = (list, res) => { (list || []).forEach((n, i) => { const p = res[i].pitch; if (p !== n.pitch) moved++; n.pitch = p; }); };
    put(c.notes, r.notes);
    for (const id of Object.keys(groups)) put(c.stack[id], r.groups[id]);
    if (c.takeNotes) for (const k of Object.keys(c.takeNotes)) if (r.groups["take:" + k]) put(c.takeNotes[k], r.groups["take:" + k]);
    c.ksrc = { ...src, sig: pitchSig(c) };
    return moved;
  }
  window.KT2_convertClipKey = convertClipKey;
  // the MIDI tab's root / scale picked by hand: that pattern (and its linked copies) moves to the new key
  // { clipId, from: "Am" | {tonic, scale}, to: "F#" | {tonic, scale} }  -> { ok, moved }
  handlers.convertClipKey = ({ clipId, from, to }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c || c.kind !== "midi") return { error: "Pick a MIDI pattern." };
    if (!window.KeyConvert) return { error: "Key converter missing." };
    const tk = window.KeyConvert.parseKey(to); if (!tk || !window.KeyConvert.parseKey(from)) return { error: "Unknown key." };
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    let moved = 0;
    for (const tr of S.tracks) for (const x of tr.clips) if (x === c || (c.pat && x.pat === c.pat)) {
      moved += convertClipKey(x, from, to);
      if (x.mk && x.mk.key) x.mk.key = musicKeyOf({ pc: tk.tonic, minor: window.KeyConvert.isMinor(tk), scale: tk.scale });
    }
    changed(); restartIfPlaying();
    return { ok: true, moved };
  };
  handlers.convertClipKey.undoable = true;
  function applyMidiFit(t, c, want) {
    const m = midiState(t, c);
    const tb = want.tempo ? S.bpm : want.bpm || m.ob;
    retempoMidi(c, m.bpm, tb); m.bpm = tb; m.tempo = !!want.tempo; m.bpmTo = want.bpm || null;
    if (m.key) {
      const kt = want.key ? songKeyOf() || m.key : want.keyTo || m.okey;
      if (kt) { rekeyMidi(c, m.key, kt); m.key = rekeyedKey(m.key, kt); }
      m.keyAuto = !!want.key; m.keyTo = want.keyTo || null;
    }
  }
  // { clipId, tempo?: bool (A), key?: bool (A), bpm?: number (picked, turns A off), keyTo?: "F#m" (picked, turns A off) }
  handlers.setClipBpmKey = async ({ clipId, tempo, key, bpm, keyTo, mode }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c) return { error: "Pick a clip." };
    const kTo = keyTo ? musicKeyOf(keyTo) : null;
    if (c.kind === "midi") {
      const m = midiState(t, c);
      const want = { tempo: bpm ? false : tempo == null ? m.tempo : !!tempo, key: kTo ? false : key == null ? m.keyAuto : !!key,
                     bpm: bpm || (tempo === false ? null : tempo == null ? m.bpmTo : null), keyTo: kTo || (key === false ? null : key == null ? m.keyTo : null) };
      undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
      applyMidiFit(t, c, want);
      changed(); restartIfPlaying();
      return { ok: true };
    }
    if (t.kind !== "take" && t.kind !== "beat") return { error: "Pick a sound clip." };
    if (!c.orig || !c.orig.src) {   // a clip from before, or its original got lost: listen to it once
      if (!(await origRaw(c))) return { error: "Couldn't find this sound's audio. Drop the file in again." };
    }
    const f = c.fit || { tempo: false, key: false };
    const want = { tempo: bpm ? false : tempo == null ? !!f.tempo : !!tempo, key: kTo ? false : key == null ? !!f.key : !!key,
                   bpm: bpm || (tempo == null ? f.bpm : null), keyTo: kTo || (key == null ? f.keyTo : null), mode: WARP_MODES.includes(mode) ? mode : f.mode || "auto" };
    // A switched off by hand (or a BPM picked): the clip keeps its own tempo when the song's changes
    want.own = !want.tempo && (tempo === false || !!bpm || (tempo == null && !!f.own));
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const r = await fitClip(c, want);
    if (r.error) { undoStack.pop(); return r; }
    changed(); restartIfPlaying();
    return r;
  };
  handlers.setClipBpmKey.undoable = true;
  // what a clip's BPM / key chips show (getState carries c.bk)
  function bkOf(t, c) {
    if (t.kind === "bus" || c.master) return null;
    if (c.kind === "midi") {
      const m = c.mk;
      return { midi: true, bpm: m ? m.bpm : S.bpm, ob: m ? m.ob : S.bpm, tempo: m ? m.tempo : true,
               key: isDrumLane(t) ? null : (m && m.key ? m.key.name : (songKeyOf() || {}).name || null), okey: m && m.okey ? m.okey.name : null, keyAuto: m ? m.keyAuto : true, drums: isDrumLane(t) };
    }
    const o = c.orig, f = c.fit || {};
    if (!o) return { bpm: null, key: null, tempo: false, keyAuto: false, unknown: true };
    const kt = f.key ? songKeyOf() : f.keyTo || o.key;
    // the key it plays in, named the way the project / pick is named (Eman, 10 Nov: a G major clip in an Am
    // project said "C"; the notes were already right, C major = A minor's notes, so it now says "Am").
    // KT2_CLIPKEY_OWNMODE = old: keep the clip's own major/minor in the name
    const keyNow = !o.key ? null : !kt ? o.key.name
      : !window.KT2_CLIPKEY_OWNMODE && kt.pc != null ? NOTE_NAMES[((kt.pc % 12) + 12) % 12] + (kt.minor ? "m" : "")
      : NOTE_NAMES[(o.key.pc + shiftBetween(o.key, kt) + 12) % 12] + (o.key.minor ? "m" : "");
    return { bpm: o.bpm ? (f.tempo ? S.bpm : f.bpm || o.bpm) : null, ob: o.bpm || null, tempo: !!f.tempo,
             key: keyNow, okey: o.key ? o.key.name : null, keyAuto: !!f.key, mode: f.mode || "auto",
             ...(window.KT2_FIXTEMPO_OFF ? {} : { drift: driftOf(c), fixed: o.unfixed ? { lo: o.fixedFrom[0], hi: o.fixedFrom[1] } : null }) };
  }
  // ---- FIX TEMPO (Eman, warp spec 4 Nov + 11 Nov 01:36): a beat that drags or rushes (a live drummer, an old
  // record, a beat bounced off tape) shows the tempo range it moves through on its BPM chip, e.g.
  // "126.34-127.54". FIX straightens it to one steady tempo: the nearest whole number or the average.
  // The straightened sound becomes the clip's original (c.orig.src, c.orig.steady), so following the
  // project's tempo, the warp modes and the key all work on it as before. c.orig.unfixed = the sound as it
  // was (PUT BACK, and Ctrl+Z). KT2_FIXTEMPO_OFF = old: no range, no FIX.
  const driftCache = new Map();   // original's buffer key -> drift | null (steady / no beat) | "busy"
  let driftQ = Promise.resolve();
  function driftOf(c) {
    const o = c.orig;
    if (!o || !o.src || !o.bpm || o.steady) return null;
    if (o.drift) return o.drift;
    if (driftCache.has(o.src)) { const d = driftCache.get(o.src); return d && d.lo ? { lo: d.lo, hi: d.hi, avg: d.avg, near: d.near } : null; }
    driftCache.set(o.src, "busy");
    const src = o.src, bpm = o.bpm;
    driftQ = driftQ.then(() => new Promise((go) => setTimeout(go, 400))).then(async () => {   // one at a time, after the page settles
      let d = null;
      try { const raw = buffers[src] || (await bufferFor(src)); if (raw) d = measureDrift(raw, bpm); } catch (e) { d = null; }
      driftCache.set(src, d);
      if (!d) return;
      // the range goes on the clip's original (so the lanes draw it again, and it's saved with the project)
      const sum = { lo: d.lo, hi: d.hi, avg: d.avg, near: d.near };
      for (const t of S.tracks) for (const x of t.clips) if (x.orig && x.orig.src === src && !x.orig.steady) x.orig = { ...x.orig, drift: sum };
      changed();
    });
    return null;
  }
  // the beat followed through the sound (the same tracker as DEEP LISTEN), then its tempo bar by bar
  function measureDrift(buf, bpm) {
    const sr = buf.sampleRate, dur = buf.duration;
    if (dur < 12 || dur > 600 || isOneShot(buf) || !window.killtoyConvert) return null;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    const mono = monoOf(buf);
    let raw = [];
    try { raw = killtoyConvert.onsets(mono, sr, { minGap: 0.045 }); } catch (e) { return null; }
    if (raw.length < 24) return null;
    let top = 1e-9; for (const h of raw) top = Math.max(top, h.strength || 0);
    const hits = raw.map((h) => ({ t: h.at, s: Math.min(1, (h.strength || 0) / top) }));
    const fps = 200, N = Math.ceil(dur * fps) + 1, env = new Float32Array(N), K = [0.15, 0.45, 0.8, 1, 0.8, 0.45, 0.15];
    for (const h of hits) { const i = Math.round(h.t * fps); for (let k = -3; k <= 3; k++) if (i + k >= 0 && i + k < N) env[i + k] += h.s * K[k + 3]; }
    let mu = 0, sd = 0; for (let i = 0; i < N; i++) mu += env[i]; mu /= N; for (let i = 0; i < N; i++) sd += (env[i] - mu) ** 2; sd = Math.sqrt(sd / N) || 1;
    for (let i = 0; i < N; i++) env[i] /= sd;
    const P = (60 / bpm) * fps, lo = Math.round(P * 0.8), hi = Math.round(P * 1.25), score = new Float32Array(N), back = new Int32Array(N).fill(-1);
    for (let t = 0; t < N; t++) {
      let best = 0, bi = -1;
      for (let d = lo; d <= hi && t - d >= 0; d++) { const v = score[t - d] - 100 * Math.log(d / P) ** 2; if (bi < 0 || v > best) { best = v; bi = t - d; } }
      score[t] = env[t] + (bi >= 0 ? Math.max(0, best) : 0); back[t] = bi >= 0 && best > 0 ? bi : -1;
    }
    let end = N - 1, bs = -1e9; for (let t = Math.max(0, N - Math.ceil(P)); t < N; t++) if (score[t] > bs) { bs = score[t]; end = t; }
    const fr = []; for (let t = end; t >= 0; t = back[t]) { fr.push(t); if (back[t] < 0) break; }
    fr.reverse();
    if (fr.length < 32) return null;
    // each beat onto its hit (within 30 ms); beats with no hit (a break) are counted, not trusted
    const conf = [];
    let h0 = 0;
    const beats = fr.map((f) => {
      const b = f / fps;
      while (h0 < hits.length && hits[h0].t < b - 0.03) h0++;
      let best = null; for (let j = h0; j < hits.length && hits[j].t <= b + 0.03; j++) if (!best || hits[j].s > best.s) best = hits[j];
      conf.push(best ? 1 : 0);
      return best ? best.t : b;
    });
    // a straight line through the trusted beats: time = a + i * period (least squares)
    const fit = (i0, i1) => {
      let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let i = i0; i < i1; i++) if (conf[i]) { n++; sx += i; sy += beats[i]; sxx += i * i; sxy += i * beats[i]; }
      if (n < (i1 - i0) * 0.6 || n < 12) return null;
      const per = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      return { per, a: (sy - per * sx) / n };
    };
    const all = fit(0, beats.length);
    if (!all || !(all.per > 0)) return null;
    // how far the beats wander from one steady tempo (the 90th percentile, so one odd hit doesn't count)
    const dev = []; for (let i = 0; i < beats.length; i++) if (conf[i]) dev.push(Math.abs(beats[i] - (all.a + i * all.per)));
    dev.sort((a, b) => a - b);
    const dev90 = dev[Math.floor(dev.length * 0.9)] || 0;
    // the tempo 8 bars at a time, moving 2 bars each step
    const W = 32, local = [];
    for (let i = 0; i + W <= beats.length; i += 8) { const f = fit(i, i + W); if (f && f.per > 0) local.push(60 / f.per); }
    if (local.length < 2) return null;
    const avg = 60 / all.per, lo2 = Math.min(...local), hi2 = Math.max(...local);
    if (window.KT2_FIXTEMPO_WHY) console.log("drift", { lo2, hi2, avg, dev90, n: beats.length, trusted: conf.filter(Boolean).length, local });
    if (hi2 - lo2 < (window.KT2_FIXTEMPO_MIN || 0.3) || dev90 < 0.01 || hi2 - lo2 > avg * 0.12) return null;   // steady (or no clear beat)
    const r2 = (x) => Math.round(x * 100) / 100;
    return { lo: r2(lo2), hi: r2(hi2), avg: Math.round(avg * 10) / 10, near: Math.round(avg), dev: r2(dev90 * 1000), beats, conf };
  }
  // the sound with every 4th trusted beat moved onto one steady grid, stretched in between
  async function straighten(raw, d, target) {
    const sr = raw.sampleRate, nch = raw.numberOfChannels, spb = 60 / target, b = d.beats, len = raw.duration;
    const pins = [[0, 0]];
    const base = b[0];
    for (let i = 0; i < b.length; i += 4) if (d.conf[i] || i === 0) { const s = b[i], t = base + i * spb; if (s > pins[pins.length - 1][0] + 0.05 && t > pins[pins.length - 1][1] + 0.05) pins.push([s, t]); }
    const L = pins[pins.length - 1], Lp = pins.length > 2 ? pins[pins.length - 2] : [0, 0];
    const tailK = L[1] - Lp[1] > 0 && L[0] - Lp[0] > 0 ? (L[1] - Lp[1]) / (L[0] - Lp[0]) : 1;
    pins.push([len, L[1] + (len - L[0]) * tailK]);
    const total = pins[pins.length - 1][1], out = ctx.createBuffer(nch, Math.max(1, Math.ceil(total * sr)), sr), F2 = Math.max(1, Math.round(0.0015 * sr));
    for (let j = 0; j < pins.length - 1; j++) {
      const [s0, d0] = pins[j], [s1, d1] = pins[j + 1], a0 = Math.round(s0 * sr), a1 = Math.min(raw.length, Math.round(s1 * sr));
      if (a1 - a0 < 2 || d1 - d0 < 0.001) continue;
      let ch = ctx.createBuffer(nch, a1 - a0, sr);
      for (let q = 0; q < nch; q++) ch.getChannelData(q).set(raw.getChannelData(q).subarray(a0, a1));
      const speed = (s1 - s0) / (d1 - d0);
      if (Math.abs(speed - 1) > 0.0005) ch = await stretchTo(ch, speed);
      const at = Math.round(d0 * sr), m = Math.min(ch.length, Math.round((d1 - d0) * sr)), fa = j > 0 ? F2 : 1, fb = j < pins.length - 2 ? F2 : 1;
      for (let q = 0; q < nch; q++) {
        const x = ch.getChannelData(Math.min(q, ch.numberOfChannels - 1)), y = out.getChannelData(q);
        for (let k = 0; k < m && at + k < y.length; k++) y[at + k] += x[k] * Math.min(1, k / fa, (m - 1 - k) / fb);
      }
      if (j % 8 === 7) await new Promise((go) => setTimeout(go, 0));   // keep the page alive on a long song
    }
    return out;
  }
  // { clipId, bpm? (default: the nearest whole number) } straightens; { clipId, back: true } puts it back
  handlers.fixClipTempo = async ({ clipId, bpm, back }) => {
    if (window.KT2_FIXTEMPO_OFF) return { error: "FIX is turned off." };
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c || c.kind === "midi" || !c.orig) return { error: "Pick a sound clip." };
    const o = c.orig, f = c.fit || {};
    const want = { tempo: !!f.tempo, key: !!f.key, bpm: f.bpm || null, keyTo: f.keyTo || null, mode: f.mode || "auto", ...(f.own ? { own: true } : {}) };
    if (back) {
      if (!o.unfixed) return { ok: true };
      if (!(buffers[o.unfixed.src] || (await bufferFor(o.unfixed.src)))) return { error: "The old timing isn't here any more. Undo (Ctrl+Z) can still bring it back." };
      undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
      c.orig = o.unfixed;
      if (want.bpm && Math.abs(want.bpm - o.bpm) < 0.05) want.bpm = null;
      const r = await fitClip(c, want);
      if (r.error) { undoStack.pop(); c.orig = o; return r; }
      changed(); restartIfPlaying();
      return { ok: true, back: true };
    }
    let d = driftCache.get(o.src);
    if ((!d || !d.lo) && o.drift) {   // a reloaded project: listen again
      const raw0 = buffers[o.src] || (await bufferFor(o.src));
      d = raw0 ? measureDrift(raw0, o.bpm) : null; driftCache.set(o.src, d);
    }
    if (!d || !d.lo) return { error: "This sound already keeps one steady tempo." };
    const target = Math.round((+bpm || d.near) * 100) / 100;
    if (!(target > 40 && target < 250)) return { error: "Pick a tempo between 40 and 250." };
    const raw = buffers[o.src] || (await bufferFor(o.src));
    if (!raw) return { error: "Couldn't find this sound's audio. Drop the file in again." };
    const out = await straighten(raw, d, target);
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const nsrc = keep(out);
    driftCache.set(nsrc, null);
    const { drift: _dr, ...o2 } = o;
    c.orig = { ...o2, bpm: target, src: nsrc, steady: true, unfixed: o, fixedFrom: [d.lo, d.hi] };
    if (want.bpm && Math.abs(want.bpm - o.bpm) < 0.05) want.bpm = null;   // it played at its own tempo: it now plays at the steady one
    const r = await fitClip(c, want);
    if (r.error) { undoStack.pop(); c.orig = o; return r; }
    changed(); restartIfPlaying();
    return { ok: true, bpm: target, was: [d.lo, d.hi] };
  };
  handlers.fixClipTempo.undoable = true;
  window.KT2_driftOf = (clipId) => { const c = findClip(clipId); return c && c.orig ? driftCache.get(c.orig.src) || null : null; };
  window.KT2_bkOf = bkOf; window.KT2_guessTempo = guessTempo; window.KT2_autoModeOf = autoMode;
  // the project's tempo / key changes: every clip with A on follows
  async function followSong(what) {
    for (const t of S.tracks) for (const c of t.clips) {
      if (c.kind === "midi") {
        const m = c.mk; if (!m) continue;
        if (what === "tempo") {   // the app keeps notes in beats, so a clip with its own tempo is moved back to it
          if (!m.tempo) { m.bpm = m.bpmTo || m.ob; const f = S.bpm / (followSong.lastBpm || S.bpm); if (Math.abs(f - 1) > 1e-4) { for (const n of c.notes || []) { n.start *= f; n.length *= f; } if (c.beats) c.beats *= f; c.length = c.beats ? c.beats * 60 / S.bpm : c.length; } }
          else m.bpm = S.bpm;
        } else if (m.keyAuto && m.key && songKeyOf()) { const sk = songKeyOf(); rekeyMidi(c, m.key, sk); m.key = rekeyedKey(m.key, sk); }
        continue;
      }
      if (what === "tempo" && !window.KT2_BPM_MOVE_OLD) { if (followTempo.list && followTempo.list.has(c)) await fitClip(c, c.fit); continue; }
      const f = c.fit; if (!c.orig || !f) continue;
      if ((what === "tempo" && f.tempo && c.orig.bpm) || (what === "key" && f.key && c.orig.key)) await fitClip(c, f);
    }
    changed(); restartIfPlaying();
  }
  // ---- a BPM change keeps everything on its bar and beat (Eman, 7 Nov 17:18). Before, only MIDI moved:
  // sound clips stayed at their old seconds and fell off the grid (window.KT2_BPM_MOVE_OLD = that).
  // Every sound clip's start moves with the tempo, and so do the song's parts, the loop and automation.
  // What happens to the sound itself is up to the clip:
  //   - a one-shot (kick, snare, one hit): as it is, same length and pitch, just on its beat
  //   - a loop that was playing in time with the song: follows the tempo (Auto warp picks Slice Stretch for
  //     drum loops, Full for the rest; the pitch only moves when Tape is picked by hand)
  //   - a clip whose BPM switch (A) was turned off by hand, or a BPM picked for it: keeps its own tempo
  const BARS = [0.5, 1, 2, 4, 8, 16, 32, 64];
  // the tempo a sound is in, when it's a loop cut to whole bars at the song's tempo (or its name says)
  function loopTempo(c, buf, songBpm) {
    const nb = nameBpmKey(c.name).bpm;
    if (nb) return nb;
    const beats = (buf.duration * songBpm) / 60;
    for (const b of BARS) if (Math.abs(beats - b * 4) / (b * 4) < 0.012) return Math.round(((b * 4 * 60) / buf.duration) * 100) / 100;
    return 0;
  }
  const near = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / b < 0.03;
  function followTempo(oldBpm, newBpm) {
    const k = oldBpm / newBpm, list = new Set();
    if (!(k > 0) || Math.abs(k - 1) < 1e-6) return list;
    const sc = (x) => (x == null ? x : x * k);
    for (const t of S.tracks) {
      for (const c of t.clips) {
        if (c.kind === "midi" || c.master) continue;   // MIDI moves in app.js (it counts in beats)
        c.start = Math.max(0, c.start * k);
        if (t.kind !== "take" && t.kind !== "beat") continue;
        if (c.takes > 1) continue;   // takes and comps: moved, the audio left as it is
        const f = c.fit || {}, buf = buffers[c.src], raw = c.orig && c.orig.src ? buffers[c.orig.src] : buf;
        if (f.tempo && c.orig && c.orig.bpm) { list.add(c); continue; }   // A on: follows
        if (f.own || f.bpm || t.kind === "beat" || c.edit || !raw) continue;
        if (isOneShot(raw)) continue;   // a hit: it's on its beat, that's all it needs
        // a loop that was in time with the song: it follows from now on (A on)
        const ob = c.orig && c.orig.bpm ? c.orig.bpm : loopTempo(c, raw, oldBpm);
        if (!near(ob, oldBpm) && !near(ob * 2, oldBpm) && !near(ob / 2, oldBpm)) continue;
        if (!c.orig) c.orig = { bpm: ob, key: nameBpmKey(c.name).key, src: c.src };
        else if (!c.orig.bpm) c.orig.bpm = ob;
        c.fit = { tempo: true, key: !!f.key, bpm: null, keyTo: f.keyTo || null, mode: f.mode || "auto" };
        list.add(c);
      }
      for (const l of t.automation || []) for (const pt of l.points || []) pt.t = sc(pt.t);
    }
    for (const l of (S.master && S.master.automation) || []) for (const pt of l.points || []) pt.t = sc(pt.t);
    for (const x of S.sections || []) { x.start = sc(x.start); if (x.len) x.len = sc(x.len); }
    if (S.loopStart != null) S.loopStart = sc(S.loopStart);
    if (S.loopEnd != null) S.loopEnd = sc(S.loopEnd);
    if (S.playStart != null) S.playStart = sc(S.playStart);
    if (S.transport && S.transport.position != null) S.transport.position = sc(S.transport.position);
    return list;
  }
  // KILLDRUM pads whose MIDI was made into a melody move with the song key; untouched pads (just the sound's own
  // note) stay (Eman, 14 Nov; ui/killdrum-beat.js followKey). The clip's notes carry the pitch as tune.
  function kdFollowKey() {
    const KB = window.KillDrumBeat; if (!KB || !KB.followKey || window.KD_KEYFOLLOW_OFF) return;
    const tonic = S.key && S.key.tonic != null && S.key.tonic >= 0 ? S.key.tonic : 0;
    for (const t of S.tracks) for (const c of t.clips) for (const q of c.plugins || []) {
      if (!q.kit || !q.kitBeat || !q.kitBeat.mel) continue;
      const moved = KB.followKey(q.kitBeat, tonic);
      for (const slot of Object.keys(moved)) {
        const pitch = KB.NOTE_OF[slot], d = moved[slot];
        for (const n of c.notes || []) if (n.pitch === pitch) { const v = Math.max(-24, Math.min(24, (n.tune || 0) + d)); if (v) n.tune = v; else delete n.tune; }
      }
    }
  }
  const _setBpm = handlers.setBpm, _setKey = handlers.setKey;
  let bpmQueue = Promise.resolve();
  handlers.setBpm = (args) => {
    // every way in (typed box, chat, tap tempo) stays inside 40..250 and a real number (stress test, 8 Nov)
    if (!window.KT2_BPM_TYPE_OLD) { const v = Number(args && args.bpm); if (!isFinite(v) || v <= 0) return { error: "That tempo is not a number." }; args = { ...args, bpm: Math.max(40, Math.min(250, v)) }; }
    const old = S.bpm;
    followSong.lastBpm = old;
    const r = _setBpm(args);
    if (window.KT2_BPM_MOVE_OLD) { followSong("tempo"); return r; }
    const list = followTempo(old, S.bpm);
    changed();
    // the sounds render one change at a time, in order (a fast run of BPM clicks can't mix them up);
    // the command answers once every clip has its new sound, so a test or a next step sees it done
    const job = bpmQueue.then(async () => {
      followTempo.list = list; fitCache = new Map();
      try { await followSong("tempo"); } finally { followTempo.list = null; fitCache = null; }
    });
    bpmQueue = job.catch(() => {});
    return job.then(() => r === undefined ? { ok: true, bpm: S.bpm } : r);
  };
  handlers.setKey = (args) => {
    if (!window.KT2_CLIPKEY_OFF && window.KT2_CLIPKEY_MIDI) for (const t of S.tracks) for (const c of t.clips) if (c.kind === "midi" && (c.notes || []).length) midiState(t, c);   // note what key they're in now
    const r = _setKey(args);
    if (!(args && args.keep)) followSong("key");   // keep: the key changes, every sound stays as it is (Eman, 7 Nov)
    if (!(args && args.keep)) kdFollowKey();
    return r;
  };
  // ---- a new song key with everything moved to it (Eman, 7 Nov 23:46): every MIDI note goes to the same
  // step of the new key's scale (A minor chords become the same chords in F# minor, or in F# major), the
  // nearest way up or down; notes outside the old scale keep their distance to the step under them.
  // Drum lanes stay as they are. Sound clips that follow the key (their KEY switch on) change with it.
  const scaleSteps = (k) => {
    const SC = window.KT_SCALES || {}, name = k.scale || (k.minor ? "minor" : "major");
    return (SC[name] && SC[name].steps) || (k.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]);
  };
  function keyMover(from, to) {
    const a = scaleSteps(from), b = scaleSteps(to), d = ((((to.tonic - from.tonic) % 12) + 18) % 12) - 6;
    return (p) => {
      const rel = (((p - from.tonic) % 12) + 12) % 12, base = p - rel;
      let i = a.length - 1; while (i > 0 && a[i] > rel) i--;
      return Math.max(0, Math.min(127, base + d + b[i] + (rel - a[i])));
    };
  }
  const keySet = handlers.setKey;   // the one before the undo wrap: convertKey is one undo step
  handlers.convertKey = (args) => {
    const old = S.key && S.key.tonic != null ? { tonic: S.key.tonic, minor: !!S.key.minor, scale: S.key.scale } : null;
    const to = { tonic: args.tonic, minor: !!args.minor, scale: args.scale };
    let moved = 0;
    if (old && to.tonic != null) {
      if (!window.KT2_CONVERT_OLD && window.KeyConvert) {
        for (const t of S.tracks) for (const c of t.clips) {
          if (c.kind !== "midi") continue;
          if (isDrumLane(t)) {   // a drum pattern can still hold stacked synth sounds
            if (c.stack) { const keep = c.notes, tk = c.takeNotes; c.notes = []; c.takeNotes = null; moved += convertClipKey(c, old, to); c.notes = keep; c.takeNotes = tk; }
            continue;
          }
          moved += convertClipKey(c, old, to);
          if (c.mk && c.mk.key) c.mk.key = musicKeyOf({ pc: to.tonic, minor: to.minor, scale: to.scale });
        }
      } else {
      const mv = keyMover(old, to), drum = (t) => isDrumLane(t);
      const moveList = (list) => { for (const n of list || []) { const p = mv(n.pitch); if (p !== n.pitch) moved++; n.pitch = p; } };
      for (const t of S.tracks) for (const c of t.clips) {
        if (c.kind !== "midi") continue;
        if (!drum(t)) {
          moveList(c.notes);
          if (c.takeNotes) for (const k of Object.keys(c.takeNotes)) if (c.takeNotes[k] !== c.notes) moveList(c.takeNotes[k]);
        }
        if (c.stack) for (const id of Object.keys(c.stack)) { const lt = S.tracks.find((x) => x.id === id); if (!lt || !drum(lt)) moveList(c.stack[id]); }
        if (c.mk && c.mk.key && !drum(t)) c.mk.key = musicKeyOf({ pc: to.tonic, minor: to.minor });
      }
      }
    }
    const r = keySet({ tonic: args.tonic, minor: args.minor, ...(args.scale ? { scale: args.scale, scaleName: args.scaleName } : {}) });
    changed(); restartIfPlaying();
    return { ...(r || { ok: true }), moved };
  };
  // a dropped sound: its tempo and key (from the name, else by listening)
  handlers.guessClipBpmKey = async ({ clipId }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c || !c.orig) return { bpm: 0, key: null };
    return { bpm: c.orig.bpm || 0, key: c.orig.key ? c.orig.key.name : null };
  };

  // Linked sounds (FL Studio style, Eman 31 Oct): copies of a sound stay linked until one is made
  // unique. Dropping a new sound on a clip swaps it in every linked copy (same link, anywhere).
  // The link is c.link, or the audio itself (c.src) for clips that never had one.
  const linkOf = (c) => c.link || c.src;
  handlers.replaceClipSound = async ({ clipId, id: sid, url, name, oneShot, gainDb }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c || t.kind !== "take") return { error: "Drop the sound on an audio clip." };
    const f = !url && sampleFiles.get(sid);
    if (!url && !f) return { error: "That sound isn't there any more." };
    let buf, src = null;
    try {
      if (url) { buf = await libBuffer(url); src = "lib:" + url; }
      else buf = await ctx.decodeAudioData(await (f.file || (await f.getFile())).arrayBuffer());
    } catch (e) { return { error: `Couldn't read ${name}. Try a WAV or MP3.` }; }
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const key = src || keep(buf), link = c.takes > 1 ? null : linkOf(c);
    const lvl = oneShot && !window.KT2_SAMPLE_LEVEL_OLD ? oneShotLevel(buf, gainDb) : null;   // a kit sound: KILLDRUM's level (above)
    let n = 0;
    for (const tt of S.tracks) for (const x of tt.clips) {
      if (x !== c && (!link || x.takes > 1 || linkOf(x) !== link)) continue;
      if (x.rhythm) {   // a rhythm clip: the new sound goes onto every hit (kt2-rhythm.js)
        Object.assign(x.rhythm, { src: key, offset: 0, hitLen: buf.duration, gain: lvl != null ? lvl : 1 });
        if (name) x.name = name;
        if (link) x.link = link;
        rhythmRender(x); n++;
        continue;
      }
      const old = buffers[takeOf(x, x.take).src];
      const whole = !old || Math.abs(x.length - (old.duration - (x.offset || 0))) < 0.02;   // played the whole sound
      Object.assign(x, { src: key, offset: 0, name: name || x.name, takes: 0, take: 0, takeSrc: null, comp: null, lazy: false, ...(lvl != null ? { level: lvl } : {}) });
      if (whole || x.length > buf.duration) x.length = buf.duration;
      if (link) x.link = link;   // stay linked to each other after the swap
      n++;
    }
    updateTrackGains(); changed(); restartIfPlaying();
    return { ok: true, count: n };
  };
  handlers.replaceClipSound.undoable = true;

  // RHYTHM CLIPS (Eman, 11 Nov 01:37): Shift+drag a one-shot's right edge and the clip becomes an empty
  // pattern-like container with the hit inside; pick a rhythm (ui/kt2-rhythm.js) and the hit is copied onto
  // every step of it. c.rhythm = { src, offset, hitLen, gain (the one-shot as it came in), hits: [ticks, 24 per
  // beat, from the clip start], startAt (tick: hits before it stay silent), parts, role }. The clip itself
  // plays ONE rendered file (c.src), so playing, export, waveform, copies and saving all work as for any sound.
  // KT2_RHYTHM_OFF = none of it (the UI never sends it).
  const R_PPQ = 24;
  function rhythmRender(c) {
    const r = c.rhythm, src = r && buffers[r.src];
    if (!src) return false;
    const sr = src.sampleRate, n = Math.max(1, Math.round(c.length * sr)), chs = src.numberOfChannels;
    const out = ctx.createBuffer(chs, n, sr), tick = 60 / (S.bpm || 120) / R_PPQ;
    const a0 = Math.max(0, Math.round((r.offset || 0) * sr)), hl = Math.max(1, Math.round(r.hitLen * sr)), g = r.gain == null ? 1 : r.gain, F = Math.round(0.004 * sr);
    // each hit cuts the one before (like a drum machine's "cut itself"): a long sound (an 808, a pad hit) on 1/4 or
    // 1/32 no longer piles up into a clipping wall (stress test, 11 Nov). KT2_RHYTHM_STACK_OLD = they overlap.
    const choke = !window.KT2_RHYTHM_STACK_OLD;
    const ats = (r.hits || []).filter((h) => h >= (r.startAt || 0)).map((h) => Math.round(h * tick * sr)).filter((at) => at >= 0 && at < n).sort((x, y) => x - y);
    for (let k = 0; k < ats.length; k++) {
      const at = ats[k];
      if (choke && ats[k + 1] === at) continue;
      const room = choke && k + 1 < ats.length ? ats[k + 1] - at : n - at;
      const len = Math.min(hl, room, src.length - a0);
      if (len <= 0) continue;
      const cut = len < hl;   // stopped by the clip's end or the next hit: a tiny fade, no click
      for (let ch = 0; ch < chs; ch++) {
        const x = src.getChannelData(ch), y = out.getChannelData(ch);
        for (let i = 0; i < len; i++) y[at + i] += x[a0 + i] * g * (cut && i > len - F ? (len - i) / F : 1);
      }
    }
    Object.assign(c, { src: keep(out), offset: 0, takes: 0, take: 0, takeSrc: null, comp: null, level: 1, reversed: false, lazy: false });
    keepRhythm(c);
    return true;
  }
  // a rhythm clip that was trimmed from the left or split keeps its hits lined up with what you see
  function rhythmTidy() {
    for (const t of S.tracks) for (const c of t.clips) {
      const r = c.rhythm;
      if (!r) continue;
      const off = c.offset || 0, cur = buffers[c.src];
      if (off < 1e-6 && cur && Math.abs(cur.duration - c.length) < 1e-3) continue;
      if (off > 1e-6) {
        const d = Math.round(off / (60 / (S.bpm || 120) / R_PPQ));
        r.hits = (r.hits || []).map((h) => h - d).filter((h) => h >= 0);
        r.startAt = Math.max(0, (r.startAt || 0) - d);
        r.parts = (r.parts || []).map((p) => ({ ...p, a: p.a - d, b: p.b - d })).filter((p) => p.b > 0).map((p) => ({ ...p, a: Math.max(0, p.a) }));
      }
      rhythmRender(c);
    }
  }
  // LOOP KEEP (Eman, 16 Nov 02:58): a Shift-dragged loop clip came back after a reload with no V cuts and no rhythm
  // menu: its c.rhythm (the hits the cuts are drawn from) was gone while its rendered loop audio was still there.
  // 1. every rendered loop is also written down by its audio (S.rhythmKeep[src] = the rhythm), saved with the project,
  //    so a clip that lost c.rhythm gets it back exactly on load;
  // 2. a loop clip with no record (made before this) is recognised from its audio: the same hit, copied sample for
  //    sample onto the beat grid at least 3 times, each one cut clean (silent just before). The hits come back from
  //    where the copies are, and the first copy becomes the one-shot.
  // KT2_LOOP_KEEP_OFF = old (nothing kept, nothing healed).
  function loopKeepOn() { return !window.KT2_LOOP_KEEP_OFF; }
  function keepRhythm(c) {
    if (!loopKeepOn() || !c || !c.rhythm || c.src == null) return;
    if (!S.rhythmKeep) S.rhythmKeep = {};
    S.rhythmKeep[c.src] = structuredClone(c.rhythm);
  }
  // only what the clips still play is kept (copies, undo and versions share the same rendered audio)
  function pruneKeep() {
    if (!S.rhythmKeep) return;
    const used = new Set();
    for (const t of S.tracks) for (const c of t.clips) { used.add(c.src); if (c.edit && c.edit.orig) used.add(c.edit.orig.src); }
    for (const k of Object.keys(S.rhythmKeep)) if (!used.has(k)) delete S.rhythmKeep[k];
  }
  // where a copy of the hit starts, in ticks from the clip start (null = not a loop clip)
  function findLoopHits(buf, lenSec) {
    const sr = buf.sampleRate, tick = 60 / (S.bpm || 120) / R_PPQ, step = tick * sr;
    const n = Math.min(buf.length, Math.round(lenSec * sr)), T = Math.floor(n / step);
    if (T < 3 || n < 2048 || lenSec > 600) return null;
    const x = buf.getChannelData(0), y = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
    const at = (i) => (y ? (x[i] + y[i]) * 0.5 : x[i]);
    let peak = 0;
    for (let i = 0; i < n; i += 4) peak = Math.max(peak, Math.abs(at(i)));
    if (peak < 1e-3) return null;
    const thr = peak * 0.02, W = Math.min(1024, Math.floor(step * 0.9)), PRE = 48;
    let s0 = -1;
    for (let i = 0; i < n; i++) if (Math.abs(at(i)) > thr) { s0 = i; break; }
    if (s0 < 0) return null;
    const k0 = Math.floor(s0 / step + 1e-9), p0 = Math.round(k0 * step);
    if (p0 + W >= n) return null;
    const ref = new Float32Array(W);
    let er = 0;
    for (let i = 0; i < W; i++) { ref[i] = at(p0 + i); er += ref[i] * ref[i]; }
    if (er < 1e-6) return null;
    const hits = [k0];
    for (let k = k0 + 1; k <= T; k++) {
      const p = Math.round(k * step);
      if (p + W > n) break;
      let e = 0, xy = 0, pre = 0, post = 0;
      for (let i = 0; i < W; i++) { const v = at(p + i); e += v * v; xy += v * ref[i]; if (i < 256) post += v * v; }
      if (e < er * 0.25 || e > er * 4) continue;
      if (xy / Math.sqrt(e * er) < 0.98) continue;
      for (let i = Math.max(0, p - PRE); i < p; i++) { const v = at(i); pre += v * v; }
      if (pre / PRE > 0.3 * (post / 256)) continue;   // the sound before it runs on into it: not a clean new copy
      hits.push(k);
    }
    return hits.length >= 3 ? hits : null;
  }
  const isLoopCand = (t, c) => t && t.kind === "take" && c && c.kind !== "midi" && !c.rhythm && !(c.takes > 1) && !(c.comp && c.comp.length) && !c.reversed && !c.edit;
  function healLoops() {
    if (!loopKeepOn() || window.KT2_RHYTHM_OFF) return 0;
    let n = 0;
    const bar = R_PPQ * 4;
    for (const t of S.tracks) for (const c of t.clips) {
      if (!isLoopCand(t, c)) continue;
      const kept = S.rhythmKeep && S.rhythmKeep[c.src];
      if (kept && Array.isArray(kept.hits)) { c.rhythm = structuredClone(kept); n++; continue; }
      if (c.loopChecked === c.src) continue;   // looked at already: not a loop clip
      const buf = buffers[c.src];
      if (!buf) continue;   // not loaded yet: looked at again later
      if ((c.offset || 0) > 1e-4 || Math.abs(buf.duration - c.length) > 0.02) { c.loopChecked = c.src; continue; }   // a render is exactly the clip
      const hits = findLoopHits(buf, c.length);
      if (!hits) { c.loopChecked = c.src; continue; }
      const tick = 60 / (S.bpm || 120) / R_PPQ, sr = buf.sampleRate;
      // the one-shot: a linked copy of the same sound that still plays it, else the first copy in the loop itself
      const mate = t.clips.concat(...S.tracks.filter((u) => u !== t).map((u) => u.clips)).find((m) => m !== c && !m.rhythm && m.kind !== "midi" && m.link && m.link === c.link && buffers[takeOf(m, m.take).src]);
      let one;
      if (mate) { const ts = takeOf(mate, mate.take); one = { src: ts.src, offset: ts.offset || 0, hitLen: mate.length, gain: ts.gain == null ? 1 : ts.gain }; }
      else {
        const a = Math.round(hits[0] * tick * sr), b = Math.min(buf.length, Math.round((hits[1] - hits[0] > 0 ? hits[1] : hits[0] + bar) * tick * sr));
        const ob = ctx.createBuffer(buf.numberOfChannels, Math.max(1, b - a), sr);
        for (let ch = 0; ch < buf.numberOfChannels; ch++) ob.getChannelData(ch).set(buf.getChannelData(ch).subarray(a, b));
        one = { src: keep(ob), offset: 0, hitLen: ob.duration, gain: 1 };
      }
      const T = Math.max(1, Math.round(c.length / tick)), set = new Set(hits);
      const period = [24, 48, 96, 192, 384].find((P) => P < T && hits.every((h) => h + P >= T || set.has(h + P)) && hits.some((h) => h + P < T)) || T;
      c.rhythm = { ...one, hits, startAt: 0, parts: [{ a: 0, b: T, id: "kept", period }], healed: true };
      c.loopChecked = null; delete c.loopChecked;
      n++;
    }
    if (n) for (const t of S.tracks) for (const c of t.clips) keepRhythm(c);
    return n;
  }
  handlers.setClipRhythm = async ({ clipId, rhythm, length, drag }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c || c.kind === "midi" || t.kind === "beat") return { error: "Pick a sound clip." };
    if (!c.rhythm && rhythm && (c.takes > 1 || (c.comp && c.comp.length))) return { error: "Flatten the takes first, then stretch it into a rhythm." };
    const base = c.rhythm || (() => { const ts = takeOf(c, c.take); return { src: ts.src, offset: ts.offset || 0, hitLen: c.length, gain: ts.gain == null ? 1 : ts.gain }; })();
    if (!buffers[base.src]) {   // a kit sound not decoded yet
      if (typeof base.src === "string" && base.src.startsWith("lib:")) await fetchAudio(base.src, base.src.slice(4)).catch(() => {});
      if (!buffers[base.src]) return { error: "The sound isn't loaded yet. Try again in a second." };
    }
    if (!drag) { undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0; }
    if (rhythm === null) {   // back to the one hit
      if (c.rhythm) { Object.assign(c, { src: base.src, offset: base.offset, length: base.hitLen, level: base.gain }); delete c.rhythm; }
    } else {
      c.rhythm = { ...base, hits: [0], startAt: 0, parts: [], ...(c.rhythm || {}), ...(rhythm || {}), src: base.src, offset: base.offset, hitLen: base.hitLen, gain: base.gain };
      if (length > 0.01) c.length = length;
      c.fadeIn = 0; c.fadeOut = 0;
      rhythmRender(c);
    }
    // it stays linked to the one-shot's copies (same colour, effects, volume) until MAKE UNIQUE (Eman, 11 Nov 02:51)
    // looping just this clip (its LOOP / the rhythm menu's LOOP) and it got longer or shorter: the loop follows
    // (it kept the old end before; stress test 11 Nov). KT2_RHYTHM_FIX_OLD = old.
    if (!window.KT2_RHYTHM_FIX_OLD && laneSolo && laneSolo.clipLoop && laneSolo.clipId === c.id && Math.abs(S.loopEnd - (c.start + c.length)) > 1e-6) {
      updateTrackGains(); handlers.laneSolo({ trackId: t.id, clipId: c.id, clipLoop: true });
      return { ok: true, rhythm: c.rhythm || null, length: c.length };
    }
    updateTrackGains(); changed(); restartIfPlaying();
    return { ok: true, rhythm: c.rhythm || null, length: c.length };
  };
  handlers.setClipRhythm.undoable = true;
  for (const name of ["setClipBounds", "splitClip"]) {
    const orig = handlers[name];
    if (!orig) continue;
    handlers[name] = (args) => {
      const r = orig(args);
      if (S.tracks.some((t) => t.clips.some((c) => c.rhythm))) { rhythmTidy(); restartIfPlaying(); }
      return r;
    };
  }
  {   // a new tempo: the hits move to the new beat, the sound itself is not stretched (like a drum machine)
    const orig = handlers.setBpm;
    handlers.setBpm = async (args) => {
      const r = await orig(args);
      let any = false;
      for (const t of S.tracks) for (const c of t.clips) if (c.rhythm) { rhythmRender(c); any = true; }
      if (any) { changed(); restartIfPlaying(); }
      return r;
    };
  }
  // compound copies keep their remembered start when a new tempo slides their clips (kt2-compound.js, KT2_CMP_REANCHOR_OFF = old)
  if (window.KillToyCompound && KillToyCompound.demo.shifts) KillToyCompound.demo.shifts(["setBpm"]);
  // Make unique on a sound: it leaves its links (its own copy from now on)
  handlers.unlinkClip = ({ clipId }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c) return { error: "That clip isn't there any more." };
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    c.link = "u" + id();
    changed();
    return { ok: true };
  };
  handlers.unlinkClip.undoable = true;
  handlers.linkedCount = ({ clipId }) => {
    const t = trackOf(clipId), c = t && t.clips.find((x) => x.id === clipId);
    if (!c) return { count: 0 };
    const l = linkOf(c);
    return { count: S.tracks.reduce((a, tt) => a + tt.clips.filter((x) => linkOf(x) === l).length, 0) };
  };

  // Change sample: every hit on a lane gets the new sound, at the same times, lengths and
  // levels. A short clip is one hit, so its audio is just swapped. A long clip (a rendered
  // drum stem, like the Kick lane of a remake) has its hits found in the audio, and the new
  // sound is played at each one, as loud as the hit it replaces (the next hit cuts it off,
  // like a drum machine, except FX which ring out). One undo step.
  const HIT_CLIP_S = 2.5; // clips up to this long are single hits
  function findHits(buf, from, length) {
    const sr = buf.sampleRate, hop = Math.max(64, Math.round(sr * 0.0025)), a = Math.floor(from * sr);
    const n = Math.max(0, Math.min(buf.length - a, Math.floor(length * sr)));
    const chs = [...Array(buf.numberOfChannels)].map((_, i) => buf.getChannelData(i));
    const frames = Math.floor(n / hop), env = new Float32Array(frames);
    let top = 0;
    for (let f = 0; f < frames; f++) {
      let pk = 0;
      for (let i = a + f * hop, z = i + hop; i < z; i++) for (const ch of chs) { const v = Math.abs(ch[i]); if (v > pk) pk = v; }
      env[f] = pk; if (pk > top) top = pk;
    }
    if (top < 1e-4) return [];
    const floor = top * 0.03, gap = Math.round(0.045 * sr / hop), look = Math.round(0.03 * sr / hop);
    const hits = [];
    let slow = 0, last = -1e9;
    for (let f = 0; f < frames; f++) {
      const e = env[f];
      if (e > floor && e > slow * 1.8 + top * 0.01 && f - last >= gap) {
        let pk = 0;
        for (let k = f; k < Math.min(frames, f + look); k++) pk = Math.max(pk, env[k]);
        let s0 = f; // back up to where the hit starts rising
        while (s0 > 0 && f - s0 < 4 && env[s0 - 1] > pk * 0.1 && env[s0 - 1] < env[s0]) s0--;
        hits.push({ at: (s0 * hop) / sr, peak: pk });
        last = f;
        slow = pk;
      }
      slow = Math.max(e, slow * 0.985); // the follower falls about 13 dB in 100 ms
    }
    return hits;
  }
  const peakOf = (buf) => { let pk = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); } return pk || 1; };
  function renderHits(hits, sample, length, ring) {
    const sr = sample.sampleRate, n = Math.max(1, Math.ceil(length * sr)), chs = Math.max(1, sample.numberOfChannels);
    const out = ctx.createBuffer(chs, n, sr), sp = peakOf(sample), fade = Math.round(0.004 * sr);
    hits.forEach((h, k) => {
      const g = h.peak / sp, s0 = Math.round(h.at * sr);
      const stop = ring || k === hits.length - 1 ? n : Math.round(hits[k + 1].at * sr);
      const len = Math.min(sample.length, stop - s0 + (ring ? 0 : fade), n - s0);
      for (let c = 0; c < chs; c++) {
        const x = sample.getChannelData(Math.min(c, sample.numberOfChannels - 1)), y = out.getChannelData(c);
        for (let i = 0; i < len; i++) {
          const w = !ring && s0 + i > stop - fade ? Math.max(0, (stop - s0 - i) / fade) : 1;
          y[s0 + i] += x[i] * g * w;
        }
      }
    });
    return out;
  }
  // On a TOY DRUMS lane the sound goes onto the pad of its kind (the kick onto the kick pad),
  // in every clip's kit; the notes stay. The pad's file is the Library path, so it reloads.
  const KIT_PADS = { kick: [36, 35], snare: [38, 40], clap: [39], hat_closed: [42, 44], hat_open: [46], perc: [37, 41, 43, 45, 47, 48, 50], fx: [49, 51, 57] };
  const KIT_WORDS = { kick: /kick|\bbd\b|808/i, snare: /snare|\brim|\bsd\b/i, clap: /clap|snap/i, hat_closed: /^(?!.*open).*(hat|\bhh\b)/i,
                      hat_open: /open/i, perc: /perc|tom|conga|bongo|shaker|tamb|cowbell|wood/i, fx: /fx|crash|ride|cymbal|riser|impact/i };
  const kitPlugins = (t) => t.clips.flatMap((c) => c.plugins || []).filter((q) => q.kit);
  async function swapKitPad(t, { url, name, type, pitch }) {
    const kits = kitPlugins(t), kit = kits[0].kit, names = kits[0].kitName || {};
    // of the pads of that kind (by name, else by the usual drum note), the one played most
    const used = (p) => t.clips.reduce((a, c) => a + (c.notes || []).filter((n) => String(n.pitch) === p).length, 0);
    const most = (ps) => ps.sort((a, b) => used(b) - used(a))[0];
    const pad = pitch != null && kit[pitch] ? String(pitch)
      : most(Object.keys(kit).filter((p) => KIT_WORDS[type] && KIT_WORDS[type].test(names[p] || ""))) || most((KIT_PADS[type] || []).map(String).filter((p) => kit[p]));
    if (!pad) return { error: `${t.name} has no ${String(type || "matching").replace("_", " ")} pad for that sound.` };
    try { await fetchAudio(url, url); } catch (e) { return { error: `Couldn't load ${name}.` }; }
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const was = names[pad] || "Pad " + pad;
    for (const q of kits) {
      q.kit = { ...q.kit, [pad]: url }; q.kitName = { ...(q.kitName || {}), [pad]: name }; q.kitLib = { ...(q.kitLib || {}), [pad]: true };
      q.params = []; // the window's pad knobs pick up the new name
    }
    const hits = used(pad);
    changed(); restartIfPlaying();
    return { ok: true, hits, trackId: t.id, pad: Number(pad), padName: was };
  }
  handlers.swapSample = async ({ trackId, url, name, type, pitch }) => {
    const t = S.tracks.find((x) => x.id === trackId);
    if (t && t.kind === "inst" && kitPlugins(t).length) return swapKitPad(t, { url, name, type, pitch });
    if (!t || t.kind !== "take") return { error: "Pick a drum lane to change its sound." };
    if (!t.clips.length) return { error: `${t.name} has no hits to change yet.` };
    let sample;
    try { sample = await libBuffer(url); } catch (e) { return { error: `Couldn't load ${name}.` }; }
    // A muted stem lane may not have loaded its audio yet.
    await Promise.all(t.clips.filter((c) => !buffers[takeOf(c, c.take).src]).map((c) => {
      const f = curSong && curSong.files && curSong.files.find((x) => x.key === c.src);
      return f ? fetchAudio(f.key, f.url).catch(() => null) : null;
    }));
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    const key = "lib:" + url, ring = type === "fx" || type === "hat_open";
    let hits = 0;
    t.clips = t.clips.map((c) => {
      const ts = takeOf(c, c.take), buf = buffers[ts.src];
      const base = { ...c, id: id(), name, offset: 0, takeSrc: null, takes: 0, take: 0, comp: null, lazy: false };
      // a hit that plays its whole sound gets the new sound's whole length; a trimmed one stays trimmed
      if (c.length <= HIT_CLIP_S || !buf) { hits++; return { ...base, src: key, length: buf && Math.abs(c.length - (buf.duration - ts.offset)) < 0.01 ? sample.duration : c.length }; }
      const found = findHits(buf, ts.offset, c.length);
      hits += found.length;
      // keep the stem's level: the hits are rebuilt as loud as they were, so the clip level stays
      return { ...base, src: keep(renderHits(found, sample, c.length, ring)), name: `${t.name} (${name})` };
    });
    if (!window.KT2_LINK_OLD) ownVersion(t.clips.filter((c) => c.kind !== "midi"));
    t.libType = type || t.libType;
    t.sub = name;
    updateTrackGains(); changed(); restartIfPlaying();
    return { ok: true, hits, trackId: t.id };
  };
  handlers.swapSample.undoable = true;

  // Convert (right-click an audio clip), like Ableton's: the clip's audio is read and a new
  // lane under it plays it as MIDI, lined up to the same bar. One undo step.
  //  notes: Basic Pitch (ui/basicpitch.js) hears every note, chords too, onto a TOY MACHINE lane
  //         on its default sound.
  //  synth: the same notes, plus the sound: the notes are split by register (bass, chords, top
  //         line), and each part gets its own TOY MACHINE that learned its sound from the
  //         cleanest note of that part in the clip (ui/toymachine-analyze.js).
  //  melody: one voice only, the older quick pitch tracker (ui/convert.js).
  //  drums: its hits on TOY DRUMS' kick/snare/hat pads;
  //  slice: the clip cut at its hits, one piece per TOY DRUMS pad, played in order.
  handlers.convertToMidi = async ({ clipId, mode, onProgress }) => {
    const K = window.killtoyConvert, src = trackOf(clipId), c = src && src.clips.find((x) => x.id === clipId);
    if (!K || !c || c.kind === "midi") return { error: "Right-click an audio clip to convert it." };
    await Promise.all(piecesOf(c).map((x) => takeOf(c, x.take).src).filter((k) => !buffers[k]).map((k) => {
      const f = curSong && curSong.files && curSong.files.find((y) => y.key === k);
      return f ? fetchAudio(f.key, f.url).catch(() => null) : loadExtra(k);
    }));
    if (piecesOf(c).some((x) => !buffers[takeOf(c, x.take).src])) return { error: "That clip's audio hasn't loaded yet. Try again in a moment." };
    const buf = segment(c), spb = 60 / S.bpm, bar = spb * 4;
    // each lane to make: { notes: [{ at, len, pitch, velocity }], key, name, clipName, sound? }
    let lanes = [], kit = null, detail = "";
    if (mode === "notes" || mode === "synth") {
      if (!window.BasicPitch) return { error: "The note finder (basicpitch.js) isn't loaded." };
      let found;
      try { found = await window.BasicPitch.transcribe(buf, { onProgress }); }
      catch (e) { console.warn("[convert] Basic Pitch", e); return { error: "Couldn't run the note finder: " + ((e && e.message) || e) }; }
      const asNotes = (list) => list.map((n) => ({ at: n.start, len: n.end - n.start, pitch: n.pitch, velocity: n.velocity }));
      if (mode === "notes") lanes = [{ notes: asNotes(found), key: "builtin:toymachine", name: src.name + " MIDI", clipName: src.name + " (MIDI)" }];
      else {
        const parts = window.BasicPitch.splitParts(found), NAMES = { low: "bass", mid: "chords", high: "top" };
        for (const k of ["high", "mid", "low"]) if (parts[k].length) {
          lanes.push({ notes: asNotes(parts[k]), key: "builtin:toymachine", name: `${src.name} ${NAMES[k]}`, clipName: `${src.name} (${NAMES[k]})`,
                       sound: window.BasicPitch.cleanestNote(parts[k], found) });
        }
        detail = lanes.map((l) => l.name.slice(src.name.length + 1)).join(", ");
      }
    } else if (mode === "melody") {
      lanes = [{ notes: K.melody(buf).map((n) => ({ at: n.start, len: n.end - n.start, pitch: n.pitch, velocity: n.velocity })), key: "builtin:toymachine", name: src.name + " melody", clipName: src.name + " (melody)" }];
    } else if (mode === "drums") {
      const PAD = { kick: 36, snare: 38, hat: 42 }, count = { kick: 0, snare: 0, hat: 0 };
      const notes = K.drums(buf).map((h) => { count[h.kind]++; return { at: h.at, len: 0.1, pitch: PAD[h.kind], velocity: h.velocity }; });
      detail = Object.entries(count).filter(([, v]) => v).map(([k, v]) => `${v} ${k}${v > 1 ? "s" : ""}`).join(", ");
      lanes = [{ notes, key: "builtin:toydrums", name: src.name + " drums", clipName: src.name + " (drums)" }];
    } else if (mode === "slice") {
      const sr = buf.sampleRate, fade = Math.round(0.003 * sr), notes = [];
      kit = { kit: {}, kitName: {}, kitGain: {}, choke: [] };
      K.slices(buf, 16).forEach((s, i) => {
        const a = Math.round(s.start * sr), z = Math.min(buf.length, Math.round(s.end * sr)), n = Math.max(1, z - a);
        const piece = ctx.createBuffer(buf.numberOfChannels, n, sr);
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          const x = buf.getChannelData(ch), y = piece.getChannelData(ch);
          for (let k = 0; k < n; k++) y[k] = x[a + k] * Math.min(1, (n - k) / fade); // a tiny fade-out, no click at the cut
        }
        kit.kit[36 + i] = keep(piece); kit.kitName[36 + i] = "Slice " + (i + 1);
        notes.push({ at: s.start, len: s.end - s.start, pitch: 36 + i, velocity: 127 });
      });
      lanes = [{ notes, key: "builtin:toydrums", name: src.name + " slices", clipName: src.name + " (slices)" }];
    } else return { error: "Unknown convert mode." };
    const total = lanes.reduce((n, l) => n + l.notes.length, 0);
    if (!total) return { error: mode === "melody" ? "No clear notes found in that clip (it works best on one voice: a vocal, a bass, a lead)."
      : mode === "notes" || mode === "synth" ? "No clear notes found in that clip." : "No hits found in that clip." };
    lanes.forEach((L) => { if (kit) L.kit = kit; L.from = buf; });
    const before = snapshot(), depth = undoStack.length;
    const made = await makeMidiLanes(c, src, lanes);
    undoStack.length = Math.min(undoStack.length, depth); undoStack.push(before); redoStack.length = 0;
    if (!made) { restore(undoStack, []); return { error: "Couldn't make the new lane." }; }   // back to before, nothing to redo
    updateTrackGains(); changed(); restartIfPlaying();
    return { ok: true, trackId: made[0].trackId, clipId: made[0].clipId, pluginId: made[0].pluginId, lanes: made, notes: total, detail };
  };
  // New MIDI lanes under the clip's lane, lined up to the clip's bar, one per entry of `lanes`:
  //   { notes: [{ at, len, pitch, velocity }] (seconds from the clip start), key, name, clipName,
  //     kit? (a KILLDRUM kit for the lane), sound? + from? (TOY MACHINE learns its sound from that note of `from`) }
  // The caller makes this one undo step. Returns [{ trackId, clipId, pluginId, name, notes }] or null.
  async function makeMidiLanes(c, under, lanes) {
    const spb = 60 / S.bpm, bar = spb * 4;
    const start = Math.floor(c.start / bar + 1e-6) * bar, bars = Math.max(1, Math.ceil((c.start + c.length - start) / bar - 1e-6));
    const lead = (c.start - start) / spb, made = [];
    for (const L of lanes) {
      const lane = await handlers.newInstrumentLane({ key: L.key });
      const t = lane && S.tracks.find((x) => x.id === lane.trackId);
      const r = t && await handlers.newMidiClip({ trackId: t.id, start, bars });
      const mc = r && t.clips.find((x) => x.id === r.clipId);
      if (!mc) return null;
      mc.notes = L.notes.map((n) => ({ pitch: n.pitch, start: +(lead + n.at / spb).toFixed(4), length: Math.max(0.0625, +(n.len / spb).toFixed(4)), velocity: n.velocity }));
      mc.name = L.clipName;
      t.name = L.name;
      if (L.kit) for (const q of t.clips.flatMap((x) => x.plugins)) if (q.instrument) { Object.assign(q, JSON.parse(JSON.stringify(L.kit))); q.params = []; }
      // the new lanes sit right under the clip's lane, top line first
      S.tracks.splice(S.tracks.indexOf(t), 1); S.tracks.splice(S.tracks.indexOf(under) + 1, 0, t); under = t;
      const plug = t.clips.flatMap((x) => x.plugins).find((q) => q.instrument);
      if (L.sound && plug) await learnSound(L.from, L.sound, plug, L.name).catch((e) => console.warn("[convert] sound", e));
      made.push({ trackId: t.id, clipId: mc.id, pluginId: plug && plug.id, name: L.name, notes: L.notes.length, track: t });
    }
    return made;
  }
  // Make it major / minor (right-click an audio clip): Basic Pitch finds the notes, and
  // ui/notemove.js lifts the 3rds, 6ths and 7ths out of the real audio and puts them back a
  // semitone up (or down), on the same root. The clip stays your recording; Cmd+Z undoes it.
  handlers.changeMode = async ({ clipId, to, onProgress }) => {
    const src = trackOf(clipId), c = src && src.clips.find((x) => x.id === clipId);
    if (!c || c.kind === "midi") return { error: "Right-click an audio clip to change it." };
    if (!window.BasicPitch || !window.NoteMove) return { error: "The note tools aren't loaded." };
    await Promise.all(piecesOf(c).map((x) => takeOf(c, x.take).src).filter((k) => !buffers[k]).map((k) => {
      const f = curSong && curSong.files && curSong.files.find((y) => y.key === k);
      return f ? fetchAudio(f.key, f.url).catch(() => null) : loadExtra(k);
    }));
    if (piecesOf(c).some((x) => !buffers[takeOf(c, x.take).src])) return { error: "That clip's audio hasn't loaded yet. Try again in a moment." };
    const buf = segment(c);
    let notes;
    try { notes = await window.BasicPitch.transcribe(buf, { onProgress: (p) => onProgress && onProgress(p * 0.5) }); }
    catch (e) { return { error: "Couldn't run the note finder: " + ((e && e.message) || e) }; }
    if (!notes.length) return { error: "No clear notes found in that clip (drums can't change key)." };
    // the song's key, unless the clip's own notes clearly say another (a loop from elsewhere)
    const own = window.NoteMove.findKey(notes), song = S.key && S.key.tonic != null ? S.key : null;
    const tonic = song && window.NoteMove.keyScore(notes, song.tonic, to === "major") > own.score - 0.15 ? song.tonic : own.tonic;
    const moves = to === "minor" ? window.NoteMove.toMinor(tonic) : window.NoteMove.toMajor(tonic);
    const count = notes.filter((q) => moves(q)).length;
    if (!count) return { error: to === "minor" ? "Nothing to move: it already sounds minor." : "Nothing to move: it already sounds major." };
    const r = window.NoteMove.render(buf, notes, moves, { onProgress: (p) => onProgress && onProgress(0.5 + p * 0.5) });
    const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    r.channels.forEach((y, ch) => out.getChannelData(ch).set(y));
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    swapClip(clipId, out, to === "minor" ? "minor" : "major");
    changed(); restartIfPlaying();
    const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return { ok: true, moved: count, notes: notes.length, root: NAMES[tonic] };
  };
  handlers.changeMode.undoable = true;

  // TOY MACHINE learns a sound from one note of the clip: that stretch is cut out (a little
  // before its start for the attack, a short fade at the end) and analysed into a preset.
  async function learnSound(buf, note, plug, name) {
    const A = window.ToyMachineAnalyze;
    if (!A) return;
    const sr = buf.sampleRate, a = Math.max(0, Math.round((note.start - 0.01) * sr)), z = Math.min(buf.length, Math.round(Math.min(note.end, note.start + 2) * sr));
    const n = z - a, fade = Math.min(n >> 2, Math.round(0.02 * sr));
    if (n < sr * 0.05) return;
    const piece = ctx.createBuffer(buf.numberOfChannels, n, sr);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const x = buf.getChannelData(ch), y = piece.getChannelData(ch);
      for (let k = 0; k < n; k++) y[k] = x[a + k] * Math.min(1, (n - k) / fade);
    }
    const res = await A.fromAudioBuffer(piece, { name });
    if (!res || !res.preset) return;
    res.preset.name = name;
    if (res.sample) handlers.toyMachineSetSample({ pluginId: plug.id, data: res.sample.data, sampleRate: res.sample.sampleRate });
    handlers.toyMachineSetPreset({ pluginId: plug.id, preset: res.preset });
  }
  handlers.convertToMidi.undoable = true;

  // ---------------------------------------------------------------------------
  // Real stem splitting (ui/stemsplit.js: Demucs v4 in the browser) and RECREATE THE SOUNDS.
  // A job card with real progress (the split takes a few minutes for a whole song).
  // clipId: the job shows on that clip (a ghost wave filling darker, ui/app.js renderJobs) instead of
  // a card in the corner; only a failure still gets the card (Eman, 10 Nov). KT2_SPLIT_CARD = the card.
  // The clip keeps its wave and still plays while it splits.
  function liveJob(label, clipId) {
    const j = { id: id(), label, stage: "Starting", progress: 0, finished: false, failed: false, message: "" };
    if (clipId && !window.KT2_SPLIT_CARD) j.clipId = clipId;
    S.jobs.push(j); changed();
    return {
      engine(name) { if (j.engine !== name) { j.engine = name; changed(); } },   // which model, shown on the clip
      set(stage, progress) { j.stage = stage; j.progress = Math.max(j.progress, Math.min(0.99, progress)); changed(); },
      end(message, failed = false) {
        Object.assign(j, { progress: 1, finished: true, failed, message });
        changed();
        setTimeout(() => { S.jobs = S.jobs.filter((x) => x !== j); changed(); }, failed ? 12000 : 8000);
      },
    };
  }
  async function clipAudio(c) {
    await Promise.all(piecesOf(c).map((x) => takeOf(c, x.take).src).filter((k) => !buffers[k]).map((k) => {
      const f = curSong && curSong.files && curSong.files.find((y) => y.key === k);
      return f ? fetchAudio(f.key, f.url).catch(() => null) : loadExtra(k);
    }));
    if (piecesOf(c).some((x) => !buffers[takeOf(c, x.take).src])) return null;
    return segment(c);
  }
  const clipKey = (c) => JSON.stringify([piecesOf(c).map((x) => [takeOf(c, x.take).src, x.start, x.end]), takeOf(c, c.take).offset, c.length]);
  const rmsOf = (b) => { let e = 0, n = 0; for (let ch = 0; ch < b.numberOfChannels; ch++) { const x = b.getChannelData(ch); for (let i = 0; i < x.length; i += 4) { e += x[i] * x[i]; n++; } } return Math.sqrt(e / Math.max(1, n)); };
  // the split with its progress on a job card: loading the model is the first 5%, splitting up to `upTo`
  async function splitWithJob(c, buf, jb, upTo, want = null, mode = null) {
    // BS-RoFormer first (the cleanest, Eman 7 Nov; needs the model files + a graphics chip);
    // `want` = the RoFormer stems to make (bass, drums, other, vocals, guitar, piano), null = all.
    // mode "fast" (the pick box's FAST, Eman 11 Nov) = the RoFormer in one pass (about 2.3x quicker),
    // "quality" = two passes blended (the default).
    // MEDIUM = the Mini BS-RoFormer V2.5 (Eman 11 Nov: tested, kept FAST as the big one in one pass,
    // "for now add as a medium option"): four stems (vocals, drums, bass, other = all the instruments),
    // so only when the pick doesn't want guitar or piano on their own; otherwise it runs as FAST.
    const M = window.StemSplitRof, music = (want || []).filter((w) => ROF_MUSIC.includes(w));
    if (mode === "medium" && M && M.hasMini && !miniDown && (music.length === 0 || music.length === ROF_MUSIC.length) && await M.available().catch(() => false) && M.hasMini()) {
      try {
        let t0 = 0;
        if (jb.engine) jb.engine("Mini RoFormer");
        const st = await M.splitMini(buf, { key: clipKey(c), onProgress: (p) => {
          if (p.stage === "split" && !p.done) t0 = performance.now();
          const left = p.stage === "split" && p.done && p.done < p.total ? Math.round((performance.now() - t0) / p.done * (p.total - p.done) / 1000) : 0;
          const leftTxt = left ? `, about ${left < 90 ? left + " s" : Math.round(left / 60) + " min"} left` : "";
          if (p.stage === "split") jb.set(`Splitting (medium, ${p.done} of ${p.total}${p.backend === "webgpu" ? ", on the graphics chip" : ""}${leftTxt})`, 0.08 + (upTo - 0.08) * p.done / p.total);
          else if (p.stage === "model") jb.set(`Loading the medium splitter (first time only, ${p.done} of ${p.total})`, 0.01 + 0.05 * (p.done / p.total));
          else jb.set("Starting the medium splitter", 0.06);
        } });
        st.mini = true;
        return st;
      } catch (e) { console.warn("[stemsplit] Mini RoFormer didn't work here, using the big one in one pass:", e); miniDown = true; }
    }
    if (mode === "medium") mode = "fast";
    if (window.StemSplitRof && !rofDown && await window.StemSplitRof.available().catch(() => false)) {
      try {
        let t0 = 0;
        if (jb.engine) jb.engine("RoFormer");
        const st = await window.StemSplitRof.split(buf, { stems: want, key: clipKey(c), overlap: mode === "fast" ? 1 : 0, onProgress: (p) => {
          // time left from how long the windows so far took on this computer
          if (p.stage === "split" && !p.done) t0 = performance.now();
          const left = p.stage === "split" && p.done && p.done < p.total ? Math.round((performance.now() - t0) / p.done * (p.total - p.done) / 1000) : 0;
          const leftTxt = left ? `, about ${left < 90 ? left + " s" : Math.round(left / 60) + " min"} left` : "";
          if (p.stage === "split") jb.set(`Splitting with RoFormer (${p.done} of ${p.total}${p.backend === "webgpu" ? ", on the graphics chip" : ""}${leftTxt})`, 0.08 + (upTo - 0.08) * p.done / p.total);
          else if (p.stage === "model") jb.set(`Loading the RoFormer splitter (first time only, ${p.done} of ${p.total})`, 0.01 + 0.05 * (p.done / p.total));
          else jb.set("Starting the RoFormer splitter", 0.06);
        } });
        st.rof = true;
        // callers that know only the four Demucs stems get guitar + piano inside "other"
        if (!want) {
          const o = st.other, add = [st.guitar, st.piano].filter(Boolean);
          if (o) for (let ch = 0; ch < o.numberOfChannels; ch++) { const d = o.getChannelData(ch); for (const b of add) { const x = b.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] += x[i]; } }
        }
        return st;
      } catch (e) { console.warn("[stemsplit] RoFormer didn't work here, trying Demucs:", e); rofDown = true; }
    }
    if (window.StemSplit && !stemSplitDown) {
      try {
        if (jb.engine) jb.engine("Demucs");
        return await window.StemSplit.split(buf, { key: clipKey(c), onProgress: (p) => {
          if (p.stage === "split") jb.set(`Splitting into drums, bass, music and vocals (${p.done} of ${p.total}${p.backend === "webgpu" ? ", on the graphics chip" : ""})`, 0.05 + (upTo - 0.05) * p.done / p.total);
          else jb.set(p.stage === "model" || p.stage === "engine" ? "Loading the stem splitter (first time only)" : "Starting the stem splitter", 0.02);
        } });
      } catch (e) {
        console.warn("[stemsplit] Demucs isn't available here:", e); stemSplitDown = true;
      }
    }
    // No Demucs on this page (its model files aren't published, or the browser can't run them): the
    // sound-based split (ui/kt2-split.js, drums / bass / music; vocals stay in the music).
    if (!window.KT2Split) throw new Error("The stem splitter isn't on this page.");
    if (jb.engine) jb.engine("by sound");
    jb.set("Splitting by sound: drums, bass, music (no vocal stem here)", 0.05);
    const st = await window.KT2Split.split(buf, { onProgress: (f) => jb.set("Splitting by sound: drums, bass, music (no vocal stem here)", 0.05 + (upTo - 0.05) * f) });
    const mk = (arr) => { const b = ctx.createBuffer(1, arr.length, st.sampleRate); b.getChannelData(0).set(arr); return b; };
    return { drums: mk(st.drums), bass: mk(st.bass), other: mk(st.music), vocals: ctx.createBuffer(1, 1, st.sampleRate), bySound: true };
  }
  let stemSplitDown = false;   // Demucs failed once on this page (no model files): don't try again
  let rofDown = false;         // the same for RoFormer
  let miniDown = false;        // the same for the Mini RoFormer (MEDIUM)

  // KILLDRUM pads cut from the drum stem: the strongest hits of each kind, lined up and averaged
  // (what's left of the other sounds cancels out, the drum stays), so the pads sound like the song.
  function drumPadFrom(buf, hits, seconds) {
    const sr = buf.sampleRate, n = Math.round(seconds * sr), pre = Math.round(0.004 * sr);
    const top = hits.slice().sort((a, b) => b.velocity - a.velocity).slice(0, 16);
    if (!top.length) return null;
    const mono = buf.getChannelData(0), chs = buf.numberOfChannels;
    const startOf = (h) => Math.max(0, Math.round(h.at * sr) - pre);
    // line each hit up with the strongest one (+-4 ms, on the first 25 ms)
    const ref = startOf(top[0]), look = Math.round(0.025 * sr), slack = Math.round(0.004 * sr);
    const out = ctx.createBuffer(chs, n, sr);
    let used = 0;
    for (const h of top) {
      let at = startOf(h), best = at, bv = -Infinity;
      for (let d = -slack; d <= slack; d += 2) {
        let v = 0;
        for (let i = 0; i < look; i += 2) v += (mono[ref + i] || 0) * (mono[at + d + i] || 0);
        if (v > bv) { bv = v; best = at + d; }
      }
      at = Math.max(0, best);
      if (at + n > buf.length) continue;
      let peak = 1e-6;
      for (let i = 0; i < look * 2; i++) peak = Math.max(peak, Math.abs(mono[at + i]));
      for (let ch = 0; ch < chs; ch++) { const x = buf.getChannelData(ch), y = out.getChannelData(ch); for (let i = 0; i < n; i++) y[i] += x[at + i] / peak; }
      used++;
    }
    if (!used) return null;
    let peak = 1e-6;
    for (let ch = 0; ch < chs; ch++) for (const v of out.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
    const fade = Math.round(n * 0.3);
    for (let ch = 0; ch < chs; ch++) { const y = out.getChannelData(ch); for (let i = 0; i < n; i++) y[i] = y[i] / peak * 0.9 * Math.min(1, (n - i) / fade); }
    return out;
  }
  // A bass line plays one note at a time: where notes overlap keep the lowest (the rest are overtones).
  function lowestLine(notes) {
    const list = notes.slice().sort((a, b) => a.start - b.start || a.pitch - b.pitch), out = [];
    for (const q of list) {
      const under = list.find((o) => o !== q && o.pitch < q.pitch && o.start < q.end && o.end > q.start && Math.min(o.end, q.end) - Math.max(o.start, q.start) > 0.5 * (q.end - q.start));
      if (!under) out.push(q);
    }
    return out;
  }

  // RECREATE THE SOUNDS (the MIDI pill on a sound): the clip is split into stems, the drums become a
  // KILLDRUM lane whose pads are cut from the song's own drums, the bass and the rest become TOY
  // MACHINEs that learned their sound from the stems, the vocal stays as audio, and all of it is one
  // compound clip where the original was (the original is switched off, not deleted). One undo step.
  handlers.recreateSounds = async ({ clipId }) => {
    const src = trackOf(clipId), c = src && src.clips.find((x) => x.id === clipId);
    if (!c || c.kind === "midi") return { error: "Pick a sound (an audio clip) to recreate." };
    if (!window.BasicPitch || !window.killtoyConvert) return { error: "The note finder isn't loaded on this page." };
    const buf = await clipAudio(c);
    if (!buf) return { error: "That clip's audio hasn't loaded yet. Try again in a moment." };
    const base = c.name.replace(/\.(wav|mp3|aif+|flac|m4a)$/i, "").replace(/\s*\(.*\)$/, "");
    const jb = liveJob("Recreate " + base);
    try {
      const stems = await splitWithJob(c, buf, jb, 0.75);
      // a stem more than ~32 dB under the song is empty (a vocal needs -28 dB: quieter is the other parts' spill)
      const loud = rmsOf(buf) || 1, has = (b, min = 0.025) => rmsOf(b) / loud > min;
      const asNotes = (list) => list.map((n) => ({ at: n.start, len: n.end - n.start, pitch: n.pitch, velocity: n.velocity }));
      const lanes = [], found = [];
      if (has(stems.other)) {
        jb.set("Listening for the chords and melodies", 0.78);
        const notes = await window.BasicPitch.transcribe(stems.other);
        const parts = window.BasicPitch.splitParts(notes, { low: 0 });
        for (const [k, nm] of [["high", "top line"], ["mid", "chords"]]) if (parts[k].length >= 3) {
          lanes.push({ notes: asNotes(parts[k]), key: "builtin:toymachine", name: `${base} ${nm}`, clipName: `${base} (${nm})`, from: stems.other,
                       sound: window.BasicPitch.cleanestNote(parts[k], notes) });
          found.push(nm);
        }
      }
      if (has(stems.bass)) {
        jb.set("Listening for the bass line", 0.86);
        const notes = lowestLine((await window.BasicPitch.transcribe(stems.bass)).filter((q) => q.pitch < 64));
        if (notes.length >= 3) {
          lanes.push({ notes: asNotes(notes), key: "builtin:toymachine", name: `${base} bass`, clipName: `${base} (bass)`, from: stems.bass,
                       sound: window.BasicPitch.cleanestNote(notes, notes) });
          found.push("bass");
        }
      }
      if (has(stems.drums)) {
        jb.set("Finding the drum hits", 0.92);
        const hits = (window.killtoyConvert.drumsByBand || window.killtoyConvert.drums)(stems.drums);
        if (hits.length >= 4) {
          const PAD = { kick: 36, snare: 38, hat: 42 }, LEN = { kick: 0.5, snare: 0.4, hat: 0.15 }, NAME = { kick: "Kick", snare: "Snare", hat: "Closed hat" };
          const kit = starterKit(), count = {};
          for (const kind of Object.keys(PAD)) {
            const mine = hits.filter((h) => h.kind === kind);
            count[kind] = mine.length;
            const pad = mine.length >= 2 && drumPadFrom(stems.drums, mine, LEN[kind]);
            if (pad) { kit.kit[PAD[kind]] = keep(pad); kit.kitName[PAD[kind]] = `${NAME[kind]} (from ${base})`; }
          }
          kit.kitTitle = `${base} drums`;
          lanes.unshift({ notes: hits.map((h) => ({ at: h.at, len: 0.1, pitch: PAD[h.kind], velocity: h.velocity })), key: "builtin:toydrums",
                          name: `${base} drums`, clipName: `${base} (drums)`, kit });
          found.unshift("drums (" + Object.entries(count).filter(([, v]) => v).map(([k, v]) => `${v} ${k}${v > 1 ? "s" : ""}`).join(", ") + ")");
        }
      }
      const vocal = has(stems.vocals, 0.04);
      if (!lanes.length && !vocal) { jb.end("Nothing clear to recreate in that clip", true); return { error: "Couldn't find drums or notes in that clip." }; }
      jb.set("Building the compound clip", 0.96);
      const before = snapshot(), depth = undoStack.length;
      const made = (await makeMidiLanes(c, src, lanes)) || [];
      const ids = made.map((m) => m.clipId);
      if (vocal) {
        const vc = { id: id(), name: `${base} (vocals)`, src: keep(stems.vocals), start: c.start, length: c.length, offset: 0, take: 0, takes: 0, plugins: [], level: 1 };
        const vt = { id: id(), name: `${base} vocals`, kind: "take", role: "lead", armed: false, muted: false, solo: false, clips: [vc] };
        const after = made.length ? made[made.length - 1].track : src;
        S.tracks.splice(S.tracks.indexOf(after) + 1, 0, vt);
        ids.push(vc.id); found.push("vocals");
      }
      c.active = false;   // the original stays where it was, switched off (turn it back on to compare)
      let inst = null;
      if (handlers.makeCompound && ids.length > 1) { const r = handlers.makeCompound({ clipIds: ids, name: `${base} (recreated)` }); inst = r && r.inst; }
      undoStack.length = Math.min(undoStack.length, depth); undoStack.push(before); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
      updateTrackGains(); changed(); restartIfPlaying();
      const msg = `Recreated: ${found.join(", ")}`;
      jb.end(msg);
      const first = made[0] || {};
      return { ok: true, message: msg, found, inst, clipIds: ids, trackId: first.trackId, clipId: first.clipId || ids[0], pluginId: first.pluginId,
               lanes: made.map(({ track, ...m }) => m), backend: window.StemSplit.backend };
    } catch (e) {
      console.warn("[recreate]", e);
      jb.end("Couldn't recreate: " + ((e && e.message) || e), true);
      return { error: "Couldn't recreate the sounds: " + ((e && e.message) || e) };
    }
  };
  handlers.recreateSounds.undoable = true;

  // "Split into stems" on any sound: four lanes under it (drums, bass, music, vocals), lined up
  // with the clip; they play and the original is muted (KT2_STEMS_MUTED = old: stems muted, solo one). Stems that came out silent are left out. One undo step.
  // pick (from the stem pick box, ui/kt2-stempick.js): { vocals: [..], drums: [..], bass: [..], music: [..] },
  // each the parts wanted ([] = not wanted, [name] = the whole stem). No pick = all four whole stems.
  const ROF_MUSIC = ["guitar", "piano", "other"];
  function splitForReal(c, pick) {
    pick = pick || { vocals: ["vocals"], drums: ["drums"], bass: ["bass"], music: ["music"] };
    (async () => {
      const jb = liveJob("Split stems: " + c.name, c.id);
      try {
        const buf = await clipAudio(c);
        if (!buf) throw new Error("the clip's audio hasn't loaded yet");
        // what the RoFormer has to make for this pick
        const want = [];
        if (pick.vocals.length) want.push("vocals");
        if (pick.drums.length) want.push("drums");
        if (pick.bass.length) want.push("bass");
        if (pick.music.length) for (const m of (pick.music[0] === "music" ? ROF_MUSIC : pick.music)) want.push(m);
        const R = window.StemSplitRof;
        const partsOf = (g, whole) => pick[g].length && pick[g][0] !== whole ? pick[g] : null;
        const detail = { drums: partsOf("drums", "drums"), vocals: partsOf("vocals", "vocals") };
        const needDetail = R && R.hasDetail && Object.entries(detail).some(([k, v]) => v && R.hasDetail(k));
        const stems = await splitWithJob(c, buf, jb, needDetail ? 0.7 : 0.98, want, pick.mode || null);
        // parts inside a stem (drum kit pieces, lead vs backing), only after a RoFormer split
        const parts = {};
        if ((stems.rof || stems.mini) && needDetail) {
          for (const [kind, names] of Object.entries(detail)) {
            if (!names || !R.hasDetail(kind) || !stems[kind]) continue;
            const from = kind === "drums" ? 0.7 : 0.88, span = kind === "drums" ? 0.18 : 0.1;
            jb.set(kind === "drums" ? "Splitting the drum kit" : "Splitting lead and backing vocals", from);
            try {
              parts[kind] = await R.splitDetail(kind, stems[kind], { onProgress: (p) => { if (p.stage === "detail" && p.total) jb.set(kind === "drums" ? "Splitting the drum kit" : "Splitting lead and backing vocals", from + span * p.done / p.total); } });
            } catch (e) { console.warn("[stems] " + kind + " parts", e); }
          }
        }
        // the lanes to add, in order: [name, buffer]
        const sum = (bufs) => {
          bufs = bufs.filter(Boolean); if (!bufs.length) return null; if (bufs.length === 1) return bufs[0];
          const o = ctx.createBuffer(bufs[0].numberOfChannels, bufs[0].length, bufs[0].sampleRate);
          for (let ch = 0; ch < o.numberOfChannels; ch++) { const d = o.getChannelData(ch); for (const b of bufs) { const s = b.getChannelData(Math.min(ch, b.numberOfChannels - 1)); for (let i = 0; i < d.length && i < s.length; i++) d[i] += s[i]; } }
          return o;
        };
        const lanes = [];
        // lanes from parts are kept even when quiet-ish (a hat is far under the whole song)
        const PART = { lead: "Lead vox", backing: "Backing vox", kick: "Kick", snare: "Snare", hh: "Hats", toms: "Toms", cymbals: "Cymbals" };
        const fromParts = (kind) => {
          const p = parts[kind]; if (!p) return false;
          for (const n of detail[kind]) lanes.push([PART[n], n === "cymbals" ? sum([p.ride, p.crash]) : p[n], true]);
          return true;
        };
        if (pick.vocals.length && !fromParts("vocals")) lanes.push(["Vocals", stems.vocals]);
        if (pick.drums.length && !fromParts("drums")) lanes.push(["Drums", stems.drums]);
        if (pick.bass.length) lanes.push(["Bass", stems.bass]);
        if (pick.music.length) {
          if (!stems.rof || pick.music[0] === "music") lanes.push([window.KT2_STEMPICK_OLD ? "Music" : "Instruments", stems.rof ? sum(ROF_MUSIC.map((k) => stems[k])) : stems.other]);
          else for (const m of pick.music) lanes.push([{ guitar: "Guitar", piano: "Piano", other: window.KT2_STEMPICK_OLD ? "Synths" : "Synths & other" }[m], stems[m]]);
        }
        const loud = rmsOf(buf) || 1, got = [], quiet = [];
        undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
        let at = S.tracks.indexOf(trackOf(c.id));
        // what the original plays with that its cut-out sound doesn't hold: its nudge (Align), level,
        // fades, pan and reverse, so the stems sit and sound where the original did (7 Nov stem test)
        const carry = {};
        for (const k of ["delay", "gain", "fadeIn", "fadeOut", "pan", "reversed"]) if (c[k]) carry[k] = c[k];
        for (const [name, b, part] of lanes) {
          if (!b || rmsOf(b) / loud < (part ? 0.004 : 0.02)) { if (b || part) quiet.push(name.toLowerCase()); continue; }
          const t = { id: id(), name: name + " stem", kind: "take", role: "stem", armed: false, muted: !!window.KT2_STEMS_MUTED, solo: false,
                      clips: [{ id: id(), name: `${name} (${c.name.replace(/\s*\(.*\)$/, "")})`, src: keep(b), start: c.start, length: c.length, offset: 0, take: 0, takes: 0, plugins: [], level: 1, ...carry }] };
          S.tracks.splice(++at, 0, t);
          got.push(name.toLowerCase());
        }
        // the stems play and the original goes quiet (Eman, 6 Nov 23:43); KT2_STEMS_MUTED = the old way (stems muted)
        if (!window.KT2_STEMS_MUTED && got.length) c.active = false;
        updateTrackGains(); changed();
        const how = stems.rof ? " with RoFormer" : stems.bySound ? " by sound" : "";
        // a part that was picked but is (almost) silent in this song gets no lane: say so, so it isn't
        // just missing (7 Nov stem test: on trap songs the kick sits inside the 808, so the drum kit has no kick)
        const none = quiet.length ? ` Nothing heard for ${quiet.join(", ")}${quiet.includes("kick") && got.includes("bass") ? " (the kick is probably inside the bass here)" : ""}.` : "";
        jb.end((window.KT2_STEMS_MUTED ? `Split${how} into ${got.length} stems (${got.join(", ")}). Muted: solo one to hear it` : `Split${how} into ${got.length} stems (${got.join(", ")}). They play now; the original is muted`) + (none ? "." + none : ""));
      } catch (e) {
        console.warn("[stems]", e);
        jb.end("Couldn't split: " + ((e && e.message) || e), true);
      }
    })();
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Called by the demo backend 30 times a second instead of its fake clock.
  function tick(tr) {
    if (tr.playing) {
      let pos = position();
      // book the wrap ahead, sample-exact (not while recording: takes need the old path)
      if (tr.looping && S.loopEnd > S.loopStart && !tr.recording && ctx.currentTime >= startCtx && pos < S.loopEnd) {
        const endAt = startCtx + tempoSpan(startPos, S.loopEnd), ahead = endAt - ctx.currentTime;
        if (ahead > 0 && ahead < 0.25) { startVoices(S.loopStart, true, endAt); pos = position(); }
      }
      if (tr.looping && pos >= S.loopEnd && S.loopEnd > S.loopStart) {
        if (tr.recording && recFrom != null) addPass();
        pos = S.loopStart;
        startVoices(pos);
        if (tr.recording && recFrom != null) micSeg(mic.segs.length ? mic.segs[mic.segs.length - 1].pass + 1 : 0);
      }
      // play keeps going past the last clip (Eman, 31 Oct: "play anywhere, even if it's just quiet"); Stop ends it
      tr.position = pos;
      if (S.click) scheduleClicks();
      meter.getFloatTimeDomainData(meterBuf);
      let pk = 0;
      for (let i = 0; i < meterBuf.length; i++) pk = Math.max(pk, Math.abs(meterBuf[i]));
      tr.input = mic.on && mic.stream ? mic.level : pk > 1e-5 ? 20 * Math.log10(pk) : -100;
      outMeter.getFloatTimeDomainData(meterBuf);
      pk = 0;
      for (let i = 0; i < meterBuf.length; i++) pk = Math.max(pk, Math.abs(meterBuf[i]));
      tr.master = { peak: pk > 1e-5 ? 20 * Math.log10(pk) : -100, gr: Math.max(0, -limiter.reduction) };
    } else { tr.input = -100; tr.master = { peak: -100, gr: 0 }; }
    // Live card pictures (SC Clip's reduction), the same shape the app sends: { pluginId: dB }.
    tr.fx = {};
    for (const [pid, fx] of fxNodes) if (fx.meter) tr.fx[pid] = tr.playing ? fx.meter() : 0;
    // TUNR's live pitch line: the sung note and the corrected one, from its worklet.
    tr.tune = [];
    for (const [pid, fx] of fxNodes) if (fx.pitch && ctx.currentTime - fx.pitch.at < 0.3) tr.tune.push({ id: pid, in: fx.pitch.in, out: fx.pitch.out });
  }

  // The metronome's sounds (Eman, 6 Nov 02:56): a soft muffled hit by default, not a sharp high tick;
  // the list next to the clock picks another. The first beat of a bar is a little stronger.
  // Classic tick first and the default (Eman, 11 Nov 00:32); KT2_METRO_TICK_OLD = true brings back Muffled first + default
  const CLICK_SOUNDS = window.KT2_METRO_TICK_OLD ? ["muffled", "wood", "rim", "soft", "shaker", "thump", "tick", "clave", "sidestick", "hat", "pop"]
    : ["tick", "muffled", "wood", "rim", "soft", "shaker", "thump", "clave", "sidestick", "hat", "pop"];
  let noiseBuf = null;
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.25), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };
  let clickDest = null, previewBus = null;   // a preview plays through its own bus, so the next one can cut it off
  function clickVoice(kind, at, accent, lvl = 1) {
    const vol = S.clickVol == null ? 1 : Math.max(0, Math.min(3, S.clickVol));   // the menu's VOLUME, 100% .. 300% (Eman, 6 Nov 16:26)
    const out = ctx.createGain(); out.gain.value = (accent ? 1 : 0.72) * 0.9 * lvl * vol; out.connect(clickDest || sideOut());
    const env = (g, peak, a, d) => { g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0008, at + a + d); };
    // in key (Eman, 7 Nov): the first beat of the bar lands on the key's root, the other beats a fourth
    // under it (the key's fifth), the same shape the clicks had before; the groove beeps go to the nearest
    // root or fifth; the noise in a click stays as it is. KT2_SFX_KEY_OLD = the old pitches
    const KK = window.KT2Key && window.KT2Key.on() ? window.KT2Key : null;
    const ACC = { tick: 1600, wood: 1250, rim: 820, soft: 880, thump: 140, clave: 2500, sidestick: 520, pop: 900, muffled: 420 }[kind];
    const osc = (type, f0, f1, peak, a, d, dest) => { const o = ctx.createOscillator(), g = ctx.createGain(); if (KK) { const t0 = !ACC ? KK.snap(f0) : accent ? KK.root(f0) : KK.root(ACC) * Math.pow(2, -5 / 12); if (f1) f1 *= t0 / f0; f0 = t0; } o.type = type; o.frequency.setValueAtTime(f0, at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + d); env(g, peak, a, d); o.connect(g); g.connect(dest || out); o.start(at); o.stop(at + a + d + 0.03); };
    const nz = (ftype, f, q, peak, a, d) => { const b = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = noise(); fl.type = ftype; fl.frequency.value = f; fl.Q.value = q; env(g, peak, a, d); b.connect(fl); fl.connect(g); g.connect(out); b.start(at); b.stop(at + a + d + 0.03); };
    if (kind === "tick") { osc("sine", accent ? 1600 : 1100, 0, 0.3, 0.001, 0.05); return; }
    if (kind === "wood") { osc("triangle", accent ? 1250 : 980, accent ? 1000 : 800, 0.32, 0.001, 0.07); nz("bandpass", accent ? 2400 : 1900, 4, 0.12, 0.001, 0.025); return; }
    if (kind === "rim") { osc("square", accent ? 820 : 700, 0, 0.06, 0.001, 0.03); nz("bandpass", 3200, 2.5, 0.22, 0.001, 0.04); return; }
    if (kind === "soft") { osc("sine", accent ? 880 : 660, 0, 0.16, 0.006, 0.12); return; }
    if (kind === "shaker") { nz("highpass", 5200, 0.7, accent ? 0.32 : 0.22, 0.012, 0.07); return; }
    if (kind === "thump") { osc("sine", accent ? 140 : 120, 52, 0.75, 0.002, 0.16); return; }
    if (kind === "clave") { osc("sine", accent ? 2500 : 2100, 0, 0.26, 0.001, 0.045); return; }
    if (kind === "sidestick") { osc("triangle", accent ? 520 : 440, 300, 0.25, 0.001, 0.04); nz("bandpass", 1700, 3, 0.22, 0.001, 0.05); return; }
    if (kind === "hat") { nz("highpass", 7000, 0.8, accent ? 0.34 : 0.24, 0.001, 0.035); return; }
    if (kind === "pop") { osc("sine", accent ? 900 : 700, accent ? 500 : 400, 0.32, 0.002, 0.05); return; }
    // the rhythm templates' quiet extras: a closed hat and a soft snare, there only for reference
    // the groove rows (Eman, 6 Nov 16:25): no snare, and the hat is an electronic beep with a hat's shortness.
    // KT2_METRO_OLDGROOVE = the noise hat and snare
    if (kind === "_hat" && window.KT2_METRO_OLDGROOVE) { nz("highpass", 8000, 0.7, 0.13, 0.001, 0.03); return; }
    if (kind === "_snare" && window.KT2_METRO_OLDGROOVE) { osc("triangle", 210, 160, 0.09, 0.001, 0.07); nz("bandpass", 2200, 0.8, 0.12, 0.001, 0.11); return; }
    if (kind === "_hat") { osc("square", 5600, 0, 0.035, 0.0005, 0.016); osc("sine", 8400, 0, 0.03, 0.0005, 0.012); nz("highpass", 9000, 0.7, 0.025, 0.0005, 0.012); return; }
    if (kind === "_snare") { osc("sine", 900, 620, 0.22, 0.001, 0.06); osc("triangle", 1800, 1240, 0.05, 0.001, 0.035); return; }   // a low "bip" where the snare was
    // muffled: a felt-wrapped knock, a low body with a little air, all behind a soft low-pass
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = accent ? 1500 : 1100; lp.Q.value = 0.5; lp.connect(out);
    osc("sine", accent ? 420 : 340, accent ? 230 : 190, 0.55, 0.003, 0.09, lp);
    { const b = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = noise(); fl.type = "bandpass"; fl.frequency.value = 900; fl.Q.value = 1.2; env(g, 0.18, 0.002, 0.03); b.connect(fl); fl.connect(g); g.connect(lp); b.start(at); b.stop(at + 0.06); }
  }
  const clickSound = () => (CLICK_SOUNDS.includes(S.clickSound) ? S.clickSound : CLICK_SOUNDS[0]);

  // RHYTHMS (Eman, 6 Nov 15:10): a bar of steps; c = the click (A = the stronger one), h = a quiet
  // hat, s = a quiet snare. The simple ones first, then a few with a groove.
  // beats = how many beats the steps cover (4 = one 4/4 bar; 8 = two bars; 3 = a 3/4 bar)
  const CLICK_PATTERNS = [
    { id: "quarter", name: "Quarters", group: "basic", steps: 16, c: "A...x...x...x..." },
    { id: "eighth", name: "Eighths", group: "basic", steps: 16, c: "A.o.x.o.x.o.x.o." },
    { id: "sixteen", name: "Sixteenths", group: "basic", steps: 16, c: "Aoooxoooxoooxooo" },
    { id: "half", name: "Halves", group: "basic", steps: 16, c: "A.......x......." },
    { id: "bar", name: "Bar only", group: "basic", steps: 16, c: "A..............." },
    { id: "back", name: "2 and 4", group: "basic", steps: 16, c: "....x.......x..." },
    { id: "trip", name: "Triplets", group: "basic", steps: 12, c: "Aooxooxooxoo" },
    { id: "shuffle", name: "Shuffle / swing", group: "theory", steps: 12, c: "A.ox.ox.ox.o" },
    { id: "waltz", name: "Waltz 3/4", group: "theory", beats: 3, steps: 3, c: "Axx" },
    { id: "six8", name: "6/8", group: "theory", beats: 3, steps: 6, c: "AooXoo".replace("X", "x") },
    { id: "tresillo", name: "Tresillo 3-3-2", group: "theory", steps: 16, c: "A..x..x.A..x..x." },
    { id: "habanera", name: "Habanera", group: "theory", steps: 8, c: "A..xx.x." },
    { id: "son32", name: "Son clave 3-2", group: "theory", beats: 8, steps: 16, c: "A..x..x...x.x..." },
    { id: "rumba32", name: "Rumba clave 3-2", group: "theory", beats: 8, steps: 16, c: "A..x...x..x.x..." },
    { id: "bossa", name: "Bossa nova", group: "theory", beats: 8, steps: 16, c: "A..x..x...x..x.." },
    { id: "hats8", name: "Hat eighths", group: "groove", steps: 16, c: "A...x...x...x...", h: "..x...x...x...x." },
    { id: "hats16", name: "Hat sixteenths", group: "groove", steps: 16, c: "A...x...x...x...", h: ".xxx.xxx.xxx.xxx" },
    { id: "house", name: "House", group: "groove", steps: 16, c: "A...x...x...x...", h: "..x...x...x...x.", s: "....x.......x..." },
    { id: "boombap", name: "Boom bap", group: "groove", steps: 16, c: "A.......x.x.....", h: "x.x.x.x.x.x.x.x.", s: "....x.......x..." },
    { id: "trap", name: "Trap half-time", group: "groove", steps: 16, c: "A...............", h: "x.x.x.x.x.x.xxxx", s: "........x......." },
    { id: "dembow", name: "Dembow", group: "groove", steps: 16, c: "A..x..x.A..x..x.", s: "...x..x....x..x." },
    { id: "garage", name: "2-step", group: "groove", steps: 16, c: "A.........x.....", h: "..x...x...x...x.", s: "....x.......x..." },
  ];
  const clickPattern = () => CLICK_PATTERNS.find((p) => p.id === S.clickPattern) || CLICK_PATTERNS[0];
  const clickStepLen = (P = clickPattern()) => ((P.beats || 4) * 60 / S.bpm) / P.steps;
  function playStep(P, k, at, sound) {
    const i = ((k % P.steps) + P.steps) % P.steps, c = P.c[i];
    if (c && c !== ".") clickVoice(sound, at, c === "A", c === "o" ? 0.5 : 1);
    if (P.h && P.h[i] === "x") clickVoice("_hat", at, false);
    if (P.s && P.s[i] === "x") clickVoice("_snare", at, false);
  }
  function scheduleClicks() {
    const P = clickPattern(), len = clickStepLen(), snd = clickSound();
    // Deep debug 16 Nov: this loop only stopped on "the next click is in the future". With a tempo that isn't a number
    // (a broken imported file) that never becomes true, and the whole page froze. It now also stops on a time that
    // isn't a number, and after 2000 clicks in one go (coming back to a sleeping tab). KT2_CLICK_GUARD_OFF = old.
    const safe = !window.KT2_CLICK_GUARD_OFF;
    let turns = 0;
    while (true) {
      const at = startCtx + tempoSpan(startPos, clickNext * len);
      if (safe && (!isFinite(at) || ++turns > 2000)) break;
      if (at > ctx.currentTime + 0.12) break;
      if (at >= ctx.currentTime - 0.01) playStep(P, clickNext, at, snd);
      clickNext++;
    }
  }
  handlers.setClickSound = ({ sound }) => { if (!CLICK_SOUNDS.includes(sound)) return { error: "No such sound." }; S.clickSound = sound; keepSettings(); changed(); return { ok: true, sound }; };
  // a bar of the rhythm with the sound (one only: a short preview while hovering)
  handlers.previewClick = ({ sound, pattern }) => {
    if (ctx.state === "suspended") ctx.resume();
    const P = CLICK_PATTERNS.find((p) => p.id === pattern) || clickPattern(), k = CLICK_SOUNDS.includes(sound) ? sound : clickSound();
    const len = clickStepLen(P), n = (P.beats || 4) < 4 ? P.steps * 2 : P.steps;
    let t0 = ctx.currentTime + 0.03, k0 = 0;
    // while the song plays (Eman, 6 Nov 16:29): the metronome itself already plays the new pick in time, so no
    // extra bar; with the metronome off, the bar starts on the song's grid where the marker is, never on its own
    if (S.transport.playing && !window.KT2_METRO_FREEPREVIEW) {
      if (S.click) return { ok: true, seconds: 0, live: true };
      const pos = tempoAfter(startPos, Math.max(0, ctx.currentTime - startCtx) + 0.03);
      k0 = Math.ceil(pos / len - 1e-6); t0 = startCtx + tempoSpan(startPos, k0 * len);
    }
    // a new preview silences the one still playing, right away (Eman, 6 Nov 16:21)
    if (previewBus) { const old = previewBus; old.gain.cancelScheduledValues(ctx.currentTime); old.gain.setValueAtTime(old.gain.value, ctx.currentTime); old.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.008); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 60); }
    previewBus = ctx.createGain(); previewBus.connect(sideOut()); clickDest = previewBus;
    try { for (let i = 0; i < n; i++) playStep(P, k0 + i, t0 + i * len, k); } finally { clickDest = null; }
    return { ok: true, seconds: n * len };
  };
  handlers.setClickPattern = ({ pattern }) => { if (!CLICK_PATTERNS.some((p) => p.id === pattern)) return { error: "No such rhythm." }; S.clickPattern = pattern; if (S.transport.playing) clickNext = Math.ceil(tempoAfter(startPos, Math.max(0, ctx.currentTime - startCtx)) / clickStepLen() - 1e-6); keepSettings(); changed(); return { ok: true, pattern }; };
  handlers.getClickSounds = () => ({ sounds: CLICK_SOUNDS, sound: clickSound(), on: !!S.click, patterns: CLICK_PATTERNS, pattern: clickPattern().id, volume: S.clickVol == null ? 1 : S.clickVol });
  handlers.setClickVolume = ({ volume }) => { S.clickVol = Math.max(0, Math.min(3, +volume || 0)); keepSettings(); return { ok: true, volume: S.clickVol }; };

  // ---------------------------------------------------------------------------
  // Variations ("Make variation" / "Change it..." on a clip or lane). ui/variations.js plans
  // each one (Claude picks the route); this runs the routes a browser can do with
  // variations-engine.js and drops the result into the clip's take folder as a new take.
  // The take that's playing doesn't change, so the original keeps playing until Eman picks
  // "Set as default". Routes that need the Mac app (ACE-Step, the voice changer,
  // ElevenLabs) say so; if the plan has a browser sketch, that's made instead and labelled.
  const APP_ONLY = { ace: "ACE-Step", voice: "the voice changer (Seed-VC)", elevenlabs: "ElevenLabs" };
  async function sampleBuffers(ids) {
    const out = [];
    for (const sid of (ids || []).slice(0, 12)) {
      const f = sampleFiles.get(sid);
      if (!f) continue;
      try { const b = await ctx.decodeAudioData(await (f.file || (await f.getFile())).arrayBuffer()); b.name = (f.path || "").split("/").pop(); out.push(b); }
      catch (e) { /* not audio: skip it */ }
    }
    return out;
  }
  function ensureTakes(c) { // a plain clip becomes a take folder with the original as take 1
    if (c.kind === "midi") {
      if (!c.takeNotes) { c.takeNotes = [c.notes || []]; c.takeTone = [null]; c.take = 0; }
    } else if (!c.takeSrc) { c.takeSrc = [{ src: c.src, offset: c.offset, gain: c.level }]; c.take = 0; c.comp = null; }
    if (!c.takeInfo) c.takeInfo = [{ name: "Original" }];
  }
  handlers.makeVariation = ({ clipId, plan }) => {
    const c0 = findClip(clipId);
    if (!c0) return { error: "That clip isn't there any more." };
    plan = plan || {};
    const isMidi = c0.kind === "midi";
    if (!isMidi && !buffers[takeOf(c0, c0.take).src]) return { error: "This clip's audio is still loading. Try again in a second." };
    const label = (plan.label || "Variation").slice(0, 28);
    const j = { id: id(), kind: "variation", clipId, label: "Variation: " + label, varLabel: label, route: plan.route || "dsp",
                stage: "Starting", progress: 0, finished: false, failed: false, message: "" };
    S.jobs.push(j);
    changed();
    const step = (p, stage) => { j.progress = Math.max(j.progress, Math.min(0.97, p)); if (stage) j.stage = stage; changed(); };
    (async () => {
      await new Promise((r) => setTimeout(r, 30));
      let note = plan.why || "", route = plan.route || "dsp", name = label, sketch = false;
      if (isMidi) {
        if (route !== "notes" && route !== "dsp") note = `Notes changed in the browser (${APP_ONLY[route] || route} works on audio, in the Mac app).`;
        const notes = window.KTVar.varyNotes(c0.notes, { key: S.key, seed: plan.seed || Date.now(), bass: uwKind(c0) === "808" || /808|bass|sub/i.test(c0.name),
          ...(plan.notes || {}) });
        step(0.9, "Writing notes");
        return { notes, tone: (plan.notes && plan.notes.tone) || null, note, name, check: { lagMs: 0, onTime: true, sameKey: true, keyBefore: "", keyAfter: "", midi: true } };
      }
      const base = segment(c0);
      let out;
      if (APP_ONLY[route]) {
        if (!plan.sketch) throw new Error(`Needs the Mac app: ${APP_ONLY[route]} doesn't run in the browser`);
        step(0.05, "Browser sketch");
        out = await window.KTVar.renderDsp(base, { seed: plan.seed, ...plan.sketch }, (p) => step(0.05 + 0.8 * p));
        name = label + " (sketch)"; sketch = true;
        note = `Browser sketch. The real one uses ${APP_ONLY[route]} in the Mac app.` + (plan.why ? " " + plan.why : "");
      } else if (route === "swap") {
        step(0.05, "Finding hits");
        const cands = await sampleBuffers(plan.swap && plan.swap.ids);
        step(0.3, cands.length ? "Placing the new sound" : "Making a new sound");
        const r = await window.KTVar.swapHits(base, { seed: plan.seed, ...(plan.swap || {}) }, { candidates: cands });
        out = r.buf;
        note = (r.from === "synth" ? `New ${(plan.swap && plan.swap.sound) || "sound"} made in the browser (connect your Splice folder with B for real samples)`
                                   : `Swapped to ${r.from}`) + `, on all ${r.hits} hits, same velocity.` + (plan.why ? " " + plan.why : "");
      } else {
        step(0.05, "Rendering");
        out = await window.KTVar.renderDsp(base, { seed: plan.seed, ...(plan.dsp || {}) }, (p) => step(0.05 + 0.8 * p));
      }
      step(0.92, "Checking timing and key");
      const check = window.KTVar.check(base, out, { pitched: plan.pitched !== false && !/drum|kick|snare|clap|hat|perc/i.test(plan.kind || "") });
      return { buf: out, note, name, check, sketch };
    })().then((r) => {
      const c = findClip(clipId);
      if (!c) throw new Error("The clip changed while this was being made");
      undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
      ensureTakes(c);
      if (c.kind === "midi") { c.takeNotes.push(r.notes); c.takeTone.push(r.tone || null); c.takes = c.takeNotes.length; }
      else { c.takeSrc.push({ src: keep(r.buf), offset: 0, gain: 1 }); c.takes = c.takeSrc.length; }
      // Its shaping arrives as effect cards, switched on, on this take only: the original's
      // cards plus the new ones. They play when this take plays (Listen or Use).
      const cards = r.sketch ? plan.sketchFx : plan.fx;
      if (cards && cards.length) {
        c.takeFx = c.takeFx || [];
        const from = c.fxTake != null && c.fxTake !== c.take ? c.takeFx[c.take] || c.baseFx || [] : c.plugins;
        c.takeFx[c.takes - 1] = [...cloneFx(from), ...startFx({ name: "" }, { fx: cards })];
        r.note = (r.note ? r.note + " " : "") + "Effect cards on: " + cards.map((x) => x.name).join(", ") + " (switch them off in the rack).";
      }
      c.takeInfo.push({ name: r.name, route: plan.route || "dsp", why: r.note, check: r.check, prompt: plan.prompt || "" });
      j.finished = true; j.progress = 1; j.newTake = c.takes - 1;
      const ck = r.check;
      j.message = `${r.name} is ready` + (ck.midi ? "" : ` (${ck.onTime ? "on time" : "off by " + ck.lagMs + " ms"}${ck.sameKey === undefined ? "" : ck.sameKey ? ", same key" : ", key moved"})`);
    }, (e) => { j.finished = true; j.failed = true; j.progress = 1; j.message = (e && e.message) || String(e); })
      .finally(() => { changed(); setTimeout(() => { S.jobs = S.jobs.filter((x) => x !== j); changed(); }, j.failed ? 9000 : 4000); });
    return { ok: true, jobId: j.id };
  };
  // Listen to one take in place of the default while playing (null = back to the default).
  handlers.auditionTake = ({ clipId, take }) => {
    const c = findClip(clipId);
    if (!c) return { ok: false };
    c.audition = take == null || take === c.take ? null : take;
    showTakeFx(c, c.audition != null ? c.audition : c.take);
    restartIfPlaying();
    changed();
    return { ok: true };
  };
  // Picking a take: MIDI clips swap their notes too; listening stops.
  const pickTake = handlers.setClipTake;
  handlers.setClipTake = (args) => {
    const c = findClip(args.clipId);
    if (c && c.takeNotes) c.takeNotes[c.take] = c.notes; // keep note edits made to the take that was playing
    if (c) showTakeFx(c, c.take); // the cards go back to the take they belong to first
    const r = pickTake(args);
    if (c) { c.audition = null; if (c.takeNotes) c.notes = c.takeNotes[c.take]; showTakeFx(c, c.take); }
    restartIfPlaying();
    changed();
    return r;
  };
  // Listening is never part of the undo history: undo / redo end it.
  for (const name of ["undo", "redo"]) {
    const orig = handlers[name];
    handlers[name] = (args) => { const r = orig(args); S.tracks.forEach((t) => t.clips.forEach((c) => { c.audition = null; showTakeFx(c, c.take); })); restartIfPlaying(); changed(); return r; };
  }
  // Keep the take that's playing (and any a comp uses); drop the rest.
  handlers.removeUnusedTakes = ({ clipId }) => {
    const c = findClip(clipId);
    if (!c || !(c.takes > 1)) return { ok: true };
    undoStack.push(snapshot()); redoStack.length = 0;
    if (c.takeNotes) c.takeNotes[c.take] = c.notes;
    c.audition = null; showTakeFx(c, c.take);
    const used = new Set(piecesOf(c).map((x) => x.take));
    const keepIdx = [...Array(c.takes).keys()].filter((i) => used.has(i)), map = new Map(keepIdx.map((i, k) => [i, k]));
    const pick = (arr) => arr && keepIdx.map((i) => arr[i]);
    c.takeSrc = pick(c.takeSrc); c.takeNotes = pick(c.takeNotes); c.takeTone = pick(c.takeTone); c.takeInfo = pick(c.takeInfo); c.takeFx = pick(c.takeFx);
    if (c.comp) c.comp = c.comp.map((x) => ({ ...x, take: map.get(x.take) }));
    c.take = map.get(c.take) || 0; c.audition = null; if (c.fxTake != null) c.fxTake = c.take;
    c.takes = keepIdx.length > 1 ? keepIdx.length : 0;
    if (!c.takes) { if (c.takeSrc) Object.assign(c, { src: c.takeSrc[0].src, offset: c.takeSrc[0].offset, level: c.takeSrc[0].gain }); c.takeSrc = null; c.takeNotes = null; c.takeTone = null; c.takeInfo = null;
                    c.takeFx = null; c.baseFx = null; c.fxTake = null; }
    changed();
    return { ok: true };
  };

  // Effect cards per take: a variation's take can carry its own cards (c.takeFx[take]); the
  // takes without one share c.baseFx. c.plugins is always the list of the take that plays
  // (or is being listened to), so the rack and the audio follow it; c.fxTake says whose it is.
  const cloneFx = (list) => (list || []).map((p) => ({ ...structuredClone(p), id: id() }));
  function showTakeFx(c, take) {
    if (!c.takeFx || !c.takeFx.some(Boolean)) return;
    const cur = c.fxTake != null ? c.fxTake : c.take;
    if (cur === take) return;
    if (c.takeFx[cur]) c.takeFx[cur] = c.plugins; else c.baseFx = c.plugins;
    c.plugins = c.takeFx[take] || c.baseFx || [];
    c.fxTake = take;
  }

  // Variations survive a reload: each clip with a take folder is kept in this browser's
  // IndexedDB (never in the artifact), its new audio as 16-bit, keyed by song, lane, clip.
  function idb(name, stores) {
    let dbp = null;
    // Deep debug 16 Nov: the browser's store was opened once and that one connection was kept for good. If opening
    // failed once, or the browser closed the connection later (it does that when storage is under pressure or another
    // tab upgrades), every save and load after it failed until the page was reloaded. A failed or closed connection is
    // now forgotten, so the next save opens a fresh one (and a save that hits a closed one tries once more).
    // KT2_IDB_REOPEN_OFF = old (one connection, kept even when broken).
    const fresh = () => !window.KT2_IDB_REOPEN_OFF;
    const open = () => dbp || (dbp = new Promise((ok, no) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => stores.forEach((x) => r.result.createObjectStore(x));
      r.onsuccess = () => {
        const db = r.result;
        if (fresh()) {
          const mine = dbp, drop = () => { if (dbp === mine) dbp = null; };
          db.onclose = drop;
          db.onversionchange = () => { drop(); try { db.close(); } catch (e) { /* already closed */ } };
        }
        ok(db);
      };
      r.onerror = () => { if (fresh()) dbp = null; no(r.error); };
    }));
    const call = (store, mode, fn, again) => open().then((db) => new Promise((ok, no) => {
      const tx = db.transaction(store, mode), req = fn(tx.objectStore(store));
      tx.oncomplete = () => ok(req && req.result); tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error);
    })).catch((e) => {
      if (!again && fresh() && e && e.name === "InvalidStateError") { dbp = null; return call(store, mode, fn, true); }   // the connection was closed under us
      throw e;
    });
    return {
      get: (store, key) => call(store, "readonly", (o) => o.get(key)),
      put: (store, key, v) => call(store, "readwrite", (o) => o.put(v, key)),
      del: (store, key) => call(store, "readwrite", (o) => o.delete(key)),
      keys: (store) => call(store, "readonly", (o) => o.getAllKeys()),
      all: (store) => call(store, "readonly", (o) => o.getAll()),
    };
  }
  const VDB = idb("killtoy-variations", ["clips", "audio"]);
  const songKey = () => (curSong && curSong.name) || SONG.name;
  const clipKeyOf = (t, c) => `${songKey()}|${t.name}|${c.name}|${t.clips.filter((x) => x.name === c.name).indexOf(c)}`;
  function toStored(buf) {
    const chans = [];
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch), q = new Int16Array(d.length);
      for (let i = 0; i < d.length; i++) q[i] = Math.max(-32767, Math.min(32767, Math.round(d[i] * 32767)));
      chans.push(q);
    }
    return { sr: buf.sampleRate, chans };
  }
  function fromStored(a) {
    const buf = ctx.createBuffer(a.chans.length, a.chans[0].length, a.sr);
    a.chans.forEach((q, ch) => { const d = buf.getChannelData(ch); for (let i = 0; i < q.length; i++) d[i] = q[i] / 32767; });
    return buf;
  }
  const savedSig = new Map();
  let saveTimer = null, saving = false;
  function recordOf(c) {
    showTakeFx(c, c.take);   // store the cards with the take they belong to
    return { takes: c.takes, take: c.take, takeInfo: c.takeInfo, takeNotes: c.takeNotes || null, takeTone: c.takeTone || null, notes: c.notes || null,
      takeFx: c.takeFx || null, baseFx: c.baseFx || null, fxTake: c.fxTake != null ? c.fxTake : null, plugins: c.plugins, comp: c.comp || null,
      takeSrc: c.takeSrc ? c.takeSrc.map((x) => ({ offset: x.offset, gain: x.gain, ...(x.store ? { store: x.store } : { src: x.src }) })) : null };
  }
  async function saveVariations() {
    if (saving) return scheduleSave();
    saving = true;
    try {
      for (const t of S.tracks) for (const c of t.clips) {
        const key = clipKeyOf(t, c);
        if (!c.takeInfo && !savedSig.has(key)) continue;
        if (c.audition != null) continue;          // save once listening ends
        if (c.takeSrc) for (const x of c.takeSrc) {
          if (x.store || !/^fx\d+$/.test(x.src) || !buffers[x.src]) continue;
          x.store = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          await VDB.put("audio", x.store, toStored(buffers[x.src]));
        }
        const rec = c.takeInfo ? recordOf(c) : null, sig = JSON.stringify(rec);
        if (savedSig.get(key) === sig) continue;
        if (rec) await VDB.put("clips", key, rec); else await VDB.del("clips", key);
        if (rec) savedSig.set(key, sig); else savedSig.delete(key);
      }
    } catch (e) { console.warn("Couldn't keep the variations in this browser", e); }
    saving = false;
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveVariations, 1500); }
  async function restoreVariations() {
    savedSig.clear();
    try {
      const prefix = songKey() + "|", keys = (await VDB.keys("clips")).filter((k) => String(k).startsWith(prefix));
      if (!keys.length) return;
      let n = 0;
      for (const t of S.tracks) for (const c of t.clips) {
        const key = clipKeyOf(t, c);
        if (!keys.includes(key)) continue;
        const rec = await VDB.get("clips", key);
        if (!rec || !rec.takeInfo) continue;
        let srcs = null;
        if (rec.takeSrc) {
          srcs = [];
          for (const x of rec.takeSrc) {
            if (x.src) { srcs.push({ src: x.src, offset: x.offset, gain: x.gain }); continue; }
            const a = await VDB.get("audio", x.store);
            if (!a) { srcs = null; break; }
            srcs.push({ src: keep(fromStored(a)), offset: x.offset, gain: x.gain, store: x.store });
          }
          if (!srcs) continue; // its audio went missing: leave the clip as the song has it
          const first = srcs[0];
          if (first && !buffers[first.src]) { const f = curSong && curSong.files && curSong.files.find((y) => y.key === first.src); if (f) await fetchAudio(f.key, f.url).catch(() => {}); }
        }
        Object.assign(c, { takes: rec.takes, take: rec.take, takeInfo: rec.takeInfo, takeSrc: srcs, comp: rec.comp, takeFx: rec.takeFx, baseFx: rec.baseFx, fxTake: rec.fxTake,
                           plugins: rec.plugins || c.plugins, audition: null });
        if (rec.takeNotes) Object.assign(c, { takeNotes: rec.takeNotes, takeTone: rec.takeTone, notes: rec.notes || rec.takeNotes[rec.take] });
        savedSig.set(key, JSON.stringify(recordOf(c)));
        n++;
      }
      if (n) { changed(); if (typeof toast === "function") toast(`Brought back the variations on ${n} clip${n > 1 ? "s" : ""}.`); }
    } catch (e) { console.warn("Couldn't read the kept variations", e); }
  }
  for (const name of ["makeVariation", "setClipTake", "removeUnusedTakes", "auditionTake", "undo", "redo", "togglePlugin", "setParam", "addPlugin", "removePlugin",
                      "clearEffects", "bypassAll", "applyChain", "deleteClip"]) {
    const orig = handlers[name];
    if (!orig) continue;
    const wrapped = (args) => { const r = orig(args); scheduleSave(); return r; };
    if (orig.undoable) wrapped.undoable = true;
    handlers[name] = wrapped;
  }
  const finishedJob = (j) => j.kind === "variation" && j.finished;
  setInterval(() => { if (S.jobs.some(finishedJob)) scheduleSave(); }, 2000);

  // The rest of the edits the app can undo (lane buttons, sections, tempo, the AI tools),
  // wrapped last so they cover the playground's own versions of these commands.
  for (const name of ["setSections", "autoSections", "newTakeLane", "newInstrumentLane", "deleteTrack", "toggleMute", "toggleSolo",
                      "renameTrack", "setTrackRole", "setTrackColor", "setBpm", "setKey", "convertKey", "togglePlugin", "bypassAll", "newMidiClip", "setMidiNotes", "setClipVersions",
                      "tune", "align", "cleanVocal", "splitStems", "sendToAI", "setSidechain", "setSidechainAmount", "setParam", "setClipLength", "setInstrument", "recordDouble"]) {
    const orig = handlers[name];
    if (!orig || orig.undoable) continue;
    handlers[name] = (args) => {
      // A knob or picture drag is one undo step: only its first value ({ begin: true }) counts.
      if (name === "setParam" && !(args && args.begin)) return orig(args);
      const mine = snapshot();
      undoStack.push(mine); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
      const r = orig(args);
      // (deep debug 16 Nov, as above: no Cmd+Z step for an edit that failed or, for these few, changed nothing)
      if (r && typeof r.then === "function") {
        // setBpm answers later (it re-stretches loops): the same tempo typed again leaves no Cmd+Z step either
        if (name === "setBpm" && !window.KT2_UNDO_NOOP_OFF) r.then(() => { try { if (undoStack[undoStack.length - 1] === mine && undoSig(snapshot()) === undoSig(mine)) undoStack.pop(); } catch (e) { /* keep the step */ } }, () => {});
        return r;
      }
      if (undoStack[undoStack.length - 1] !== mine) return r;
      if (r && r.error) { if (!window.KT2_UNDO_ERRPOP_OFF) undoStack.pop(); }
      else if ((name === "setKey" || name === "setBpm" || name === "renameTrack" || name === "setTrackColor" || name === "setTrackRole" || name === "setSidechain") && !window.KT2_UNDO_NOOP_OFF) {
        try { if (undoSig(snapshot()) === undoSig(mine)) undoStack.pop(); } catch (e) { /* keep the step */ }
      }
      return r;
    };
    handlers[name].undoable = true;
  }

  // ---------------------------------------------------------------------------
  // Saving. Every version of every project keeps its edits in this browser (IndexedDB
  // "killtoy-sessions", never in the artifact): lanes, clips, effects, notes, sections, tempo and
  // loop. It saves a moment after each edit, on Cmd+S, and when you open another project or
  // version, so a reload or coming back finds it as you left it. Audio made here (Tune, Clean,
  // variations, samples from your folder) is kept next to it as 16-bit. Versions made with "+"
  // are copies kept the same way. Export writes it all as a session.json for the Mac app.
  const SDB = idb("killtoy-sessions", ["sessions", "audio", "meta"]);
  let curVer = null;          // the "+" version that's open (null: the song's own version)
  let dirty = false, sessionTimer = 0, savingNow = Promise.resolve();
  let saveWarned = false;   // the "couldn't save" message shows once per run of failures
  const lastSig = new Map();  // session key -> what was saved last (skips saves that change nothing)
  const audioId = new WeakMap(); // AudioBuffer -> its id in the "audio" store (stored once)
  const audioKey = new Map();    // that id -> its buffer key here (read back once)
  const sessionKey = () => (curVer ? curVer.key : "song:" + songKey());
  const projectOf_ = (song) => (song && (song.group || song.name)) || SONG.name;
  const membersOf = (song) => (song && song.group ? GROUPS.get(song.group) : [song || SONGS[0]]);
  const metaReady = SDB.get("meta", "all").then((m) => { if (m) META = { versions: m.versions || {}, projects: m.projects || [] }; }, () => {})
    .then(() => {
      // quest songs made before 7 Nov 18:30 were plain projects (NIGHT SHIFT, NEON RUN, VILLAIN...): they move to the quests
      // side, kept but off ALL PROJECTS (Eman). window.KT2_QUEST_IN_PROJECTS shows them again.
      let moved = false;
      for (const p of META.projects) if (p.quest == null && /^(NIGHT SHIFT|NEON RUN|VILLAIN)( \d+)?$/.test(p.name)) { p.quest = "old"; moved = true; }
      if (moved) saveMeta();
      addMadeProjects(); updateProjects(); changed();
    });
  const saveMeta = () => SDB.put("meta", "all", META).catch((e) => console.warn("Couldn't save the version list", e));
  const userVersions = (song) => META.versions[projectOf_(song)] || [];
  function versionRow() {
    const members = membersOf(curSong);
    return [...members.map((m, i) => ({ number: i + 1, name: curSong.group ? m.label : undefined, current: !curVer && m === curSong })),
            ...userVersions(curSong).map((v) => ({ number: v.n, name: v.label, current: !!curVer && curVer.key === v.key }))];
  }
  // What was open last ({ song, ver }): overall (for a reload), or in one project.
  const lastOpen = (project) => {
    try { const m = JSON.parse(localStorage.getItem("ktLastOpen") || "null"); return m && (project ? (m.projects || {})[project] : m.last) || null; } catch (e) { return null; }
  };
  function rememberOpen() {
    try {
      const m = JSON.parse(localStorage.getItem("ktLastOpen") || "null") || {};
      m.last = { song: curSong ? curSong.name : SONG.name, dir: (curSong && curSong.dir) || null, ver: curVer ? curVer.key : null };
      m.projects = { ...(m.projects || {}), [projectOf_(curSong)]: m.last };
      localStorage.setItem("ktLastOpen", JSON.stringify(m));
    } catch (e) { /* storage blocked */ }
  }

  // What gets saved: a copy of the session, with no listening going on.
  function capture() {
    const rec = structuredClone({ v: 1, song: curSong ? curSong.name : SONG.name, project: projectOf_(curSong), version: curVer ? curVer.label : null,
      tracks: S.tracks, master: S.master, returns: S.returns, sections: S.sections, cues: S.cues || {}, bpm: S.bpm, tempo: S.tempo || [], tempoOpen: !!S.tempoOpen, tempoMin: !!S.tempoMin, tempoMode: S.tempoMode || "curve", key: S.key, loopStart: S.loopStart, loopEnd: S.loopEnd, looping: !!S.transport.looping, ...(loopKeepOn() && S.rhythmKeep ? (pruneKeep(), { rhythmKeep: S.rhythmKeep }) : {}) });
    // a take being listened to is saved as the take that's picked, with that take's effect cards
    rec.tracks.forEach((t) => t.clips.forEach((c) => { c.audition = null; showTakeFx(c, c.take); }));
    return rec;
  }
  // Buffer keys made here ("fx12") point at a stored copy instead ("store:<id>").
  const madeHere = (src) => typeof src === "string" && /^fx\d+$/.test(src);
  function eachSrc(rec, fn) {
    for (const t of rec.tracks) for (const c of t.clips) {
      if (c.src != null) c.src = fn(c.src);
      if (c.orig && c.orig.src != null && !window.KT2_ORIG_UNSAVED) c.orig.src = fn(c.orig.src);   // the sound as it came in (BPM / key chips)
      if (c.orig && c.orig.unfixed && c.orig.unfixed.src != null && !window.KT2_ORIG_UNSAVED) c.orig.unfixed.src = fn(c.orig.unfixed.src);   // before FIX tempo
      if (c.takeSrc) c.takeSrc.forEach((x) => { x.src = fn(x.src); delete x.store; });
      if (c.rhythm && c.rhythm.src != null) c.rhythm.src = fn(c.rhythm.src);   // a rhythm clip's one-shot (kt2-rhythm.js)
    }
    if (rec.rhythmKeep && typeof rec.rhythmKeep === "object") {   // LOOP KEEP: the loops written down by their audio
      const o = {};
      for (const [k, r] of Object.entries(rec.rhythmKeep)) { if (!r || typeof r !== "object") continue; if (r.src != null) r.src = fn(r.src); o[fn(k)] = r; }
      rec.rhythmKeep = o;
    }
  }
  async function persist(rec, key) {
    const made = new Set();
    eachSrc(rec, (src) => { if (madeHere(src) && buffers[src]) made.add(src); return src; });
    for (const src of made) {
      const buf = buffers[src];
      if (!audioId.has(buf)) {
        const aid = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await SDB.put("audio", aid, toStored(buf));
        audioId.set(buf, aid); audioKey.set(aid, src);
      }
    }
    eachSrc(rec, (src) => (madeHere(src) && buffers[src] ? "store:" + audioId.get(buffers[src]) : src));
    rec.savedAt = new Date().toISOString();
    const sig = JSON.stringify({ ...rec, savedAt: 0 });
    if (lastSig.get(key) === sig) return false;
    await SDB.put("sessions", key, rec);
    lastSig.set(key, sig);
    return true;
  }
  // Saves the open version now (if anything changed). Returns once it's in the browser's store.
  function saveNow() {
    clearTimeout(sessionTimer);
    if (!dirty) return savingNow;
    dirty = false;
    const rec = capture(), key = sessionKey();
    inFlight++;
    // One failed save used to stop every later save until a reload: the failed promise stayed at the head of the
    // chain, so persist() was skipped from then on (audit 12 Nov). Each save now starts clean. KT2_SAVE_CHAIN_OLD = old.
    const prev = window.KT2_SAVE_CHAIN_OLD ? savingNow : savingNow.catch(() => {});
    savingNow = prev.then(() => persist(rec, key)).then(() => { inFlight--; saveWarned = false; if (!dirty && !inFlight) dropStash(key); cleanAudioSoon(); }, (e) => {
      inFlight--; dirty = true; console.warn("Couldn't save", e);
      // A failed automatic save used to be silent (audit 12 Nov): say it once, and try again in a few seconds.
      // KT2_SAVE_WARN_OFF = old (console only, no retry).
      if (!window.KT2_SAVE_WARN_OFF) {
        if (!saveWarned && typeof toast === "function") { saveWarned = true; toast("Couldn't save in this browser. Trying again.", true); }
        clearTimeout(sessionTimer); sessionTimer = setTimeout(() => saveNow().catch(() => {}), 5000);
      }
      throw e;
    });
    return savingNow;
  }
  function markDirty() { dirty = true; clearTimeout(sessionTimer); sessionTimer = setTimeout(() => saveNow().catch(() => {}), 800); }
  // Leaving the page (8 Nov stress test): the save above is cut off when the page goes away, so an edit in the
  // last second before a reload, a close or a Version switch was lost. A copy now also goes to localStorage at
  // once (that one can't be cut off); the next load uses it when it's newer than the saved one.
  // Skipped when new audio made here isn't stored yet (it can't go to localStorage). KT2_SAVE_STASH_OFF = old.
  const STASH = "ktSaveStash";
  let inFlight = 0;
  function stashNow() {
    if (window.KT2_SAVE_STASH_OFF || (!dirty && !inFlight)) return;
    try {
      const rec = capture();
      let ok = true;
      eachSrc(rec, (src) => { if (!madeHere(src)) return src; const a = buffers[src] && audioId.get(buffers[src]); if (!a) ok = false; return a ? "store:" + a : src; });
      if (!ok) return;
      rec.savedAt = new Date().toISOString();
      localStorage.setItem(STASH, JSON.stringify({ key: sessionKey(), at: Date.now(), rec }));
    } catch (e) { /* too big or storage blocked: the normal save still tries */ }
  }
  function readStash(key) {
    try { const m = JSON.parse(localStorage.getItem(STASH) || "null"); return m && m.key === key && m.rec && m.rec.tracks ? m : null; } catch (e) { return null; }
  }
  const dropStash = (key) => { try { if (readStash(key)) localStorage.removeItem(STASH); } catch (e) { /* ignore */ } };
  window.addEventListener("pagehide", () => { stashNow(); saveNow().catch(() => {}); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { stashNow(); saveNow().catch(() => {}); } });

  // Reads a saved version and brings its audio back into memory (before the song is rebuilt).
  async function readSaved(key) {
    try {
      await metaReady;
      let rec = await SDB.get("sessions", key);
      const st = !window.KT2_SAVE_STASH_OFF && readStash(key);
      if (st && (!rec || !rec.tracks || st.at > Date.parse(rec.savedAt || 0))) {
        rec = st.rec;   // the copy made as the page went away is newer: use it and store it properly soon
        setTimeout(() => { if (sessionKey() === key) markDirty(); }, 1500);
      } else if (st) dropStash(key);
      if (!rec || !rec.tracks) return null;
      checkRec(rec);
      // saves from before V4b kept the original as "fx12", a key that means another sound after a reload
      for (const t of rec.tracks) for (const c of t.clips) if (c.orig && madeHere(c.orig.src)) c.orig.src = null;
      const ids = new Set();
      eachSrc(rec, (src) => { if (typeof src === "string" && src.startsWith("store:")) ids.add(src.slice(6)); return src; });
      for (const aid of ids) {
        if (audioKey.has(aid) && buffers[audioKey.get(aid)]) continue;
        const a = await SDB.get("audio", aid);
        if (!a) continue;
        const buf = fromStored(a), k = keep(buf);
        audioId.set(buf, aid); audioKey.set(aid, k);
      }
      eachSrc(rec, (src) => (typeof src === "string" && src.startsWith("store:") ? (audioKey.get(src.slice(6)) || "missing:" + src.slice(6)) : src));
      lastSig.set(key, null);
      return rec;
    } catch (e) { console.warn("Couldn't read the saved session", e); return null; }
  }
  // Deep debug 16 Nov: a saved or imported file is not trusted blindly. A tempo that isn't a real number (or a tempo
  // point without one) made every time in the song "not a number" (nothing played, the clock froze), and a lane or clip
  // that isn't there (null) stopped the whole file from opening. Bad values are left out so the rest still opens.
  // KT2_LOAD_CHECK_OFF = old (the file is used as it is).
  function checkRec(rec) {
    if (window.KT2_LOAD_CHECK_OFF || !rec) return rec;
    const num = (v) => typeof v === "number" && isFinite(v);
    if (!num(rec.bpm) || rec.bpm <= 0) { const v = typeof rec.bpm === "string" ? parseFloat(rec.bpm) : NaN; if (num(v) && v > 0) rec.bpm = v; else delete rec.bpm; }
    if (num(rec.bpm)) rec.bpm = Math.max(20, Math.min(400, rec.bpm));
    if (rec.tempo != null) rec.tempo = (Array.isArray(rec.tempo) ? rec.tempo : []).filter((q) => q && num(q.beat) && q.beat >= 0 && num(q.bpm) && q.bpm > 0);
    if (rec.sections != null && !Array.isArray(rec.sections)) rec.sections = [];
    if (Array.isArray(rec.sections)) rec.sections = rec.sections.filter((x) => x && num(x.start));
    rec.tracks = (Array.isArray(rec.tracks) ? rec.tracks : []).filter((t) => t && typeof t === "object");
    for (const t of rec.tracks) t.clips = (Array.isArray(t.clips) ? t.clips : []).filter((c) => c && typeof c === "object");
    if (!num(rec.loopStart) || !num(rec.loopEnd)) { delete rec.loopStart; delete rec.loopEnd; }
    return rec;
  }
  function applySaved(rec) {
    S.tracks = rec.tracks;
    S.rhythmKeep = loopKeepOn() && rec.rhythmKeep && typeof rec.rhythmKeep === "object" ? rec.rhythmKeep : {};
    if (rec.master) S.master = rec.master;   // older saves (before the master) keep the song's own
    if (rec.returns) S.returns = rec.returns;   // and before the returns, the song's own
    S.sections = rec.sections || []; S.cues = rec.cues || {}; S.bpm = rec.bpm || S.bpm; if (rec.key) S.key = rec.key; S.tempo = Array.isArray(rec.tempo) ? rec.tempo : []; S.tempoOpen = !!rec.tempoOpen; S.tempoMin = !!rec.tempoMin;
    // TEMPO STEP / CURVE: a song saved before the switch keeps its hard steps, so it sounds the same
    S.tempoMode = rec.tempoMode === "step" || rec.tempoMode === "curve" ? rec.tempoMode : S.tempo.length ? "step" : "curve";
    if (rec.loopEnd > rec.loopStart) { S.loopStart = rec.loopStart; S.loopEnd = rec.loopEnd; }
    S.transport.looping = !!rec.looping;
    // ids made after this must not repeat the saved ones
    let top = 0;
    JSON.stringify([rec.tracks, rec.master, rec.returns], (k, v) => { if (k === "id" && /^\d+$/.test(v)) top = Math.max(top, +v); return v; });
    while (+id() <= top);
    updateTrackGains();
  }
  // Sounds a saved version uses that the song doesn't load by itself (Library sounds, extra stems).
  function needSources() {
    for (const t of S.tracks) for (const c of t.clips) for (const q of c.plugins || []) if (q.kit) loadKit(q); // KILLDRUM samples, so the first Play is heard
    const keys = new Set();
    for (const t of S.tracks) for (const c of t.clips) { keys.add(c.src); (c.takeSrc || []).forEach((x) => keys.add(x.src)); if (c.rhythm) keys.add(c.rhythm.src); }
    for (const k of keys) {
      if (!k || buffers[k]) continue;
      if (k.startsWith("lib:")) fetchAudio(k, k.slice(4)).then(() => { changed(); }, () => {});
      else if (["drums", "bass", "music", "melody"].includes(k)) loadExtra(k).then(() => changed());
    }
  }
  // Audio no saved version uses any more is deleted (a while after saving, at most once a minute).
  let cleanTimer = 0, cleanedAt = 0;
  function cleanAudioSoon() {
    if (cleanTimer) return;
    cleanTimer = setTimeout(async () => {
      cleanTimer = 0;
      if (Date.now() - cleanedAt < 60000 && !window.KT2_AUDIO_CLEAN_NOW) return;
      // Deep debug 16 Nov, two ways this lost a recording for good:
      // 1. delete a clip made here (a take, Tune, a dropped sound), wait, then Cmd+Z: the clean-up had deleted its stored
      //    audio but the page still believed it was stored, so the next save pointed at audio that was gone and the clip
      //    came back silent after a reload. Deleted audio is now also forgotten here, so the next save stores it again.
      // 2. a save that was under way while the clean-up ran could point at audio the clean-up was deleting. The clean-up
      //    now waits its turn while a save is running, and stops as soon as one starts.
      // KT2_AUDIO_CLEAN_OLD = old.
      const careful = !window.KT2_AUDIO_CLEAN_OLD;
      if (careful && inFlight) { cleanAudioSoon(); return; }
      cleanedAt = Date.now();
      try {
        const used = new Set();
        for (const rec of await SDB.all("sessions")) eachSrc(rec, (src) => { if (typeof src === "string" && src.startsWith("store:")) used.add(src.slice(6)); return src; });
        for (const aid of await SDB.keys("audio")) if (!used.has(aid)) {
          if (careful) {
            if (inFlight) { cleanedAt = 0; cleanAudioSoon(); break; }
            const k = audioKey.get(aid), buf = k && buffers[k];
            if (buf && audioId.get(buf) === aid) audioId.delete(buf);   // before the delete is sent: a save starting now stores it again
            audioKey.delete(aid);
          }
          await SDB.del("audio", aid); audioKey.delete(aid);
        }
      } catch (e) { /* next time */ }
    }, window.KT2_AUDIO_CLEAN_NOW ? 50 : 5000);
  }

  // Cmd+S: saved right now, and says where.
  handlers.save = () => saveNow().then(() => ({ ok: true, message: `Saved ${S.session}${curVer ? " " + curVer.label : ""} in this browser.` }),
    () => ({ error: "Couldn't save in this browser (its storage is full or blocked)." }));
  S.browserSave = true; // the session menu offers Export / Import (the app saves to its own files instead)

  // "+": a new version, a copy of the open one, added after the others. The others stay as they are.
  handlers.newVersion = async () => {
    dirty = true;
    await saveNow().catch(() => {});
    const project = projectOf_(curSong), list = META.versions[project] = META.versions[project] || [];
    const names = versionRow().map((v) => v.name || "V" + v.number);
    const n = Math.max(versionRow().length, ...names.map((x) => parseInt((/^V(\d+)/i.exec(x) || [])[1] || 0, 10))) + 1;
    const ver = { n, label: "V" + n, base: curSong ? curSong.name : SONG.name, baseDir: (curSong && curSong.dir) || null, key: `ver:${project}:${Date.now().toString(36)}`, made: new Date().toISOString(), from: curVer ? curVer.label : (curSong && curSong.label) || "V1" };
    list.push(ver);
    await saveMeta();
    curVer = ver;
    inFlight++;   // (counts as a save under way, so the audio clean-up keeps its hands off: see cleanAudioSoon)
    try { await persist(capture(), ver.key); } catch (e) { return { error: "Couldn't keep the new version in this browser." }; } finally { inFlight--; }
    S.versions = versionRow();
    rememberOpen(); updateProjects(); changed();
    return { ok: true, version: n };
  };

  // "+ New project": an empty project (no beat yet) that keeps itself like the others. Drop sounds
  // in from the Library or your folder, or add an instrument lane.
  function emptySong(name) {
    return { name, made: true, build: () => {
      S.session = name; S.master = freshMaster(); S.returns = returnsOf(120); S.bpm = 120;
      // A new project starts in C major, so the in-key note lanes show from the start; press the
      // key and pick none to turn it off (Eman, 8 Nov). KT2_KEY_DEFAULT_OLD = true -> no key (old).
      S.key = window.KT2_KEY_DEFAULT_OLD ? { name: "", relative: "", confidence: 0, tonic: null, minor: false }
        : { name: "C", relative: "Am", confidence: 1, tonic: 0, minor: false, bpmFound: 120, byHand: true };
      S.sections = []; S.cues = {};
      // No empty Reference or Lead Vox lane: + Lane / + Instrument add what the song needs.
      S.tracks = [{ id: id(), name: "Beat", kind: "beat", role: "beat", armed: false, muted: false, solo: false, hideEmpty: true, clips: [] }];
      S.loopStart = 0; S.loopEnd = 8 * (60 / 120) * 4;
      S.transport = { position: 0, playing: false, recording: false, looping: false, input: -100 };
      S.playStart = 0; S.versions = [{ number: 1, current: true }];
    }, load: () => Promise.resolve(), files: [] };
  }
  function addMadeProjects() {
    for (const p of META.projects) if (!SONGS.some((x) => x.name === p.name)) SONGS.push(emptySong(p.name));
    S.sessions = SONGS.map((x) => x.name);
  }
  handlers.newSession = async () => {
    await metaReady;
    let n = META.projects.length + 1;
    while (SONGS.some((x) => x.name === "New project " + n)) n++;
    const name = "New project " + n;
    META.projects.push({ name, made: new Date().toISOString() });
    await saveMeta();
    addMadeProjects();
    const r = await openSong(name);
    if (r && r.ok) { markWorked(name); dirty = true; await saveNow().catch(() => {}); updateProjects(); changed(); }
    return r;
  };

  // A quest's own song: one per quest, kept in this browser like a project but shown only in its quest.
  // Starting a quest (again) wipes that quest's last song and opens an empty one under the same name.
  handlers.questSession = async ({ quest, name }) => {
    await metaReady;
    quest = Number(quest) || 1;
    name = String(name || ("QUEST " + quest)).trim().replace(/[\/\\:]/g, "-");
    const clash = META.projects.find((p) => p.name === name && p.quest !== quest) || (SONGS.some((x) => x.name === name && !x.made) ? {} : null);
    if (clash) return { error: `There's already a project called ${name}.` };
    await saveNow().catch(() => {});
    for (const e of META.projects.filter((p) => p.quest === quest)) {
      await SDB.del("sessions", "song:" + e.name).catch(() => {});
      for (const v of META.versions[e.name] || []) await SDB.del("sessions", v.key).catch(() => {});
      delete META.versions[e.name]; lastSig.delete("song:" + e.name);
      const k = SONGS.findIndex((x) => x.name === e.name && x.made); if (k >= 0) SONGS.splice(k, 1);
    }
    META.projects = META.projects.filter((p) => p.quest !== quest);
    META.projects.push({ name, made: new Date().toISOString(), quest });
    await saveMeta();
    if (curSong && curSong.name === name) curSong = null;
    addMadeProjects();
    const r = await openSong(name);
    if (r && r.ok) { dirty = true; await saveNow().catch(() => {}); updateProjects(); changed(); }
    return r;
  };

  // Rename a project made here with "+ New project": its saved session, its "+" versions and the
  // "last open" memory move to the new name. (Song projects keep the names they came with.)
  handlers.renameSession = async ({ name }) => {
    await metaReady;
    name = String(name || "").trim().replace(/[\/\\:]/g, "-");
    const old = curSong && curSong.name, entry = old && META.projects.find((p) => p.name === old);
    if (!entry) return { error: "Only projects made here with New project can be renamed." };
    if (!name || name === old) return { ok: true };
    if (SONGS.some((x) => x.name === name)) return { error: `There's already a project called ${name}.` };
    await saveNow().catch(() => {});
    const rec = await SDB.get("sessions", "song:" + old).catch(() => null);
    if (rec) { rec.song = name; rec.project = name; await SDB.put("sessions", "song:" + name, rec); await SDB.del("sessions", "song:" + old); }
    for (const v of META.versions[old] || []) {
      v.base = name;
      const r = await SDB.get("sessions", v.key).catch(() => null);
      if (r) { r.song = name; r.project = name; await SDB.put("sessions", v.key, r); }
    }
    if (META.versions[old]) { META.versions[name] = META.versions[old]; delete META.versions[old]; }
    entry.name = name;
    await saveMeta();
    lastSig.delete("song:" + old);
    if (worked[old]) { worked[name] = worked[old]; delete worked[old]; try { localStorage.setItem("ktWorked", JSON.stringify(worked)); } catch (e) {} }
    try {
      const m = JSON.parse(localStorage.getItem("ktLastOpen") || "null") || {};
      if (m.projects) delete m.projects[old];
      localStorage.setItem("ktLastOpen", JSON.stringify(m));
    } catch (e) { /* storage blocked */ }
    const fresh = emptySong(name), i = SONGS.indexOf(curSong);
    SONGS[i] = fresh; curSong = fresh;
    S.session = name; S.sessions = SONGS.map((x) => x.name);
    rememberOpen(); updateProjects(); changed();
    return { ok: true, message: `Renamed to ${name}.` };
  };

  // Delete a project made here with "New project" (Eman, 12 Nov: an x in the corner of the project; it asks first only
  // when there is work in it). Without { force } a project with work answers { confirm: true } and nothing is removed.
  // The songs that came with the page can't be deleted. Its saved session, "+" versions and memories go; audio only it
  // used is cleaned up by cleanAudioSoon. KT2_PROJECT_DELETE_OFF = no delete (old).
  const hasWork = (rec) => !!rec && Array.isArray(rec.tracks) && (rec.tracks.length > 1 || rec.tracks.some((t) => (t.clips || []).length) || (rec.sections || []).length > 0);
  handlers.deleteSession = async ({ name, force } = {}) => {
    if (window.KT2_PROJECT_DELETE_OFF) return { error: "Deleting projects is off." };
    await metaReady;
    name = String(name || "");
    const entry = META.projects.find((p) => p.name === name && p.quest == null);
    if (!entry) return { error: "Only projects made here with New project can be deleted." };
    const open = !!curSong && curSong.name === name;
    if (open) await saveNow().catch(() => {});
    const vers = META.versions[name] || [];
    if (!force) {
      let work = vers.length > 0 || (open && hasWork({ tracks: S.tracks, sections: S.sections }));
      if (!work) work = hasWork(await SDB.get("sessions", "song:" + name).catch(() => null));
      if (work) return { confirm: true, name, versions: vers.length };
    }
    if (open) { clearTimeout(sessionTimer); dirty = false; if (S.transport.playing) halt(); }
    await SDB.del("sessions", "song:" + name).catch(() => {});
    for (const v of vers) { await SDB.del("sessions", v.key).catch(() => {}); lastSig.delete(v.key); }
    delete META.versions[name]; lastSig.delete("song:" + name);
    META.projects = META.projects.filter((p) => p !== entry);
    await saveMeta();
    const k = SONGS.findIndex((x) => x.name === name && x.made); if (k >= 0) SONGS.splice(k, 1);
    if (worked[name]) { delete worked[name]; try { localStorage.setItem("ktWorked", JSON.stringify(worked)); } catch (e) { /* storage blocked */ } }
    try {
      const m = JSON.parse(localStorage.getItem("ktLastOpen") || "null") || {};
      if (m.projects) delete m.projects[name];
      if (m.last && m.last.song === name) delete m.last;
      localStorage.setItem("ktLastOpen", JSON.stringify(m));
      dropStash("song:" + name);
    } catch (e) { /* storage blocked */ }
    S.sessions = SONGS.map((x) => x.name);
    if (open) { curSong = null; curVer = null; dirty = false; await openSong(SONGS[0]); clearTimeout(sessionTimer); dirty = false; }
    cleanAudioSoon(); updateProjects(); changed();
    return { ok: true, deleted: name, wasOpen: open };
  };

  // Export: the open version as a session.json the Mac app can import (its lanes, clips with their
  // times, volumes, fades and effects, MIDI notes, sections). The exact session rides along under
  // "playground", so Import here brings it back as it was. Audio made in the browser stays here.
  function fxOut(list) {
    return (list || []).filter((p) => !p.instrument).map((p) => ({ type: p.type, name: p.name, enabled: p.enabled !== false,
      params: Object.fromEntries((p.params || []).map((q) => [q.id, q.value])), ...(p.sidechain ? { sidechain: p.sidechain } : {}), ...(p.side ? { side: p.side } : {}), ...(p.ghost ? { ghost: true } : {}), ...(p.beat ? { beat: p.beat } : {}) }));
  }
  handlers.exportSession = () => {
    const rec = capture(), song = curSong || SONGS[0], j = song.json || {}, spb = 60 / S.bpm;
    const pathOf = (src) => (song.pathOf && song.pathOf[src]) || (SONG.files[src] ? SONG.files[src].replace(/^audio\//, "audio/") : src && src.startsWith("lib:") ? src.slice(4) : null);
    const left = [];
    const out = { ...j, name: j.name || S.session, bpm: S.bpm, key: (S.key && S.key.name) || j.key, label: curVer ? curVer.label : j.label,
      exported: new Date().toISOString(), exportedFrom: "KILLTOY playground" };
    delete out.open;
    // TEMPO lane: tempo changes as [{ beat, bpm }] (beats from the song's start; before the first, bpm above)
    if (Array.isArray(S.tempo) && S.tempo.length) out.tempoMap = S.tempo.map((q) => ({ beat: q.beat, bpm: q.bpm, ...(q.curve ? { curve: q.curve } : {}), ...(q.step ? { step: true } : {}) })), out.tempoMode = S.tempoMode || "curve";
    const beat = S.tracks[0];
    if (beat && beat.clips[0]) { out.reference = pathOf(beat.clips[0].src) || out.reference; out.referenceMuted = !!beat.muted; }
    out.sections = S.sections.map((x) => ({ name: x.name, start: +x.start.toFixed(4), startBar: +(x.start / (spb * 4)).toFixed(4) }));
    // The master: its effect cards in order, then its fader. The safety limiter (-0.3 dB) always follows.
    out.master = { volume_db: +((S.master && S.master.volume) || 0).toFixed(2), effects: fxOut(S.master && S.master.plugins), limiter: { ceiling_db: -0.3 }, ...(S.master && S.master.auto === false ? { auto: false } : {}) };
    if (S.master && (S.master.automation || []).length) { out.master.automation = AUTO.toJson(S.master, spb); if (S.master.autoOpen) out.master.automationOpen = true; }
    // The A/B returns: lanes send to them ("sends" on each lane), each plays its effects, then its fader, into the master.
    out.returns = (S.returns || []).map((r) => ({ id: r.id, name: r.name, volume_db: +(r.volume || 0).toFixed(2), muted: !!r.muted, ...(r.mode ? { mode: r.mode } : {}), effects: fxOut(r.plugins) }));
    out.lanes = S.tracks.slice(1).map((t) => {
      // the lane it came from: by where it was loaded from, so a renamed lane keeps its synth and file
      const orig = (t.lane != null ? (j.lanes || [])[t.lane] : (j.lanes || []).find((l) => l.name === t.name)) || {};
      const lane = { name: t.name, role: t.role, muted: !!t.muted, ...(t.solo ? { solo: true } : {}), ...(t.volume ? { volume_db: t.volume } : {}), ...(t.color ? { color: t.color } : {}),
        ...(t.sub ? { sub: t.sub } : {}), ...(t.source ? { source: t.source } : {}), effects: fxOut(t.plugins),
        ...(t.sends && Object.values(t.sends).some((v) => v > 0) ? { sends: Object.fromEntries(Object.entries(t.sends).filter(([k, v]) => v > 0 || k === "A" || k === "B")) } : {}),
        ...(t.sendsPre && Object.keys(t.sendsPre).length ? { sendsPre: { ...t.sendsPre } } : {}) };
      // automation lanes (format in ui/automation.js): times in beats, v = the control's 0..1 position
      if ((t.automation || []).length) { lane.automation = AUTO.toJson(t, spb); if (t.autoOpen) lane.automationOpen = true; }
      if (t.kind === "inst") {
        const inst = [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins || [])].find((p) => p.instrument) || {};
        for (const k of ["instrument", "preset", "synth", "kit", "choke", "delay"]) if (orig[k] != null) lane[k] = orig[k];
        // a stacked synth: plays the patterns of the lane it is stacked on, moved by oct octaves
        if (t.layerOf) lane.stackedOn = (S.tracks.find((x) => x.id === t.layerOf) || {}).name || null;
        if (t.oct) lane.oct = t.oct;
        lane.instrument = t.instrument || inst.name || lane.instrument;
        if (inst.toy && inst.toy.preset) lane.toyPreset = inst.toy.preset;
        // A kit made or changed here (KILLDRUM) goes out as its current files: the window can swap any pad.
        if (inst.kit && (!lane.kit || inst.kitPad || inst.kitTitle)) {
          lane.kit = Object.fromEntries(Object.entries(inst.kit).map(([pitch, k]) => [pitch, { file: k, ...(inst.kitName && inst.kitName[pitch] ? { name: inst.kitName[pitch] } : {}) }]));
          if (inst.choke && inst.choke.length) lane.choke = inst.choke;
        }
        // pads changed from the Library go out as their Library files
        if (lane.kit && inst.kitLib) lane.kit = { ...lane.kit, ...Object.fromEntries(Object.keys(inst.kitLib).map((p) => [p, { file: decodeURI(inst.kit[p]), name: inst.kitName[p] }])) };
        // TOY DRUMS levels turned in its window
        if (lane.kit && inst.kitGain) lane.kit = Object.fromEntries(Object.entries(lane.kit).map(([pitch, f]) => {
          const g = inst.kitGain[pitch], o = typeof f === "string" ? { file: f } : { ...f };
          if (g > 0) o.gain_db = +(20 * Math.log10(g)).toFixed(2);
          return [pitch, o];
        }));
        // KILLDRUM's pad settings (pitch, decay, drive, filter, pan, effect chips, layers), name, vibe, BEAT and FX state
        if (inst.kitPad) lane.pads = inst.kitPad;
        if (inst.kitTitle) lane.kitTitle = inst.kitTitle;
        if (inst.kitVibe) lane.kitVibe = inst.kitVibe;
        if (inst.kitBeat) lane.kitBeat = inst.kitBeat;
        if (inst.kitVoid) lane.kitFx = inst.kitVoid;
        lane.clips = t.clips.filter((c) => c.kind === "midi").map((c) => ({ name: c.name, start: +(c.start / spb).toFixed(4), beats: c.beats || +(c.length / spb).toFixed(4),
          n: (c.notes || []).map((n) => { const x = noteExpr(n), row = [n.pitch, +n.start.toFixed(4), +n.length.toFixed(4), n.velocity == null ? 100 : n.velocity, ...(n.slide || n.locked || n.pull || x ? [n.slide ? (n.slideFrom > 1 ? n.slideFrom : 1) : 0] : []), ...(n.locked || n.pull || (n.slideHand && n.slideFrom > 1) || x ? [(n.locked ? 1 : 0) | (n.pull ? 2 | (Math.round((n.pullAt || 0.5) * 4) << 2) : 0) | (n.slideHand && n.slideFrom > 1 ? 32 : 0)] : [])]; if (x) row.push(x); return row; }), effects: fxOut(c.plugins) }));
        return lane;
      }
      const files = t.clips.map((c) => pathOf(c.takeSrc ? c.takeSrc[c.take].src : c.src));
      lane.file = orig.file || files.find(Boolean) || null;
      lane.audioClips = t.clips.map((c, i) => {
        const ts = c.takeSrc ? c.takeSrc[c.take] : { src: c.src, offset: c.offset, gain: c.level };
        if (!files[i]) left.push(`${t.name}: ${c.name}`);
        return { name: c.name, file: files[i], start: +c.start.toFixed(4), offset: +(ts.offset || 0).toFixed(4), length: +c.length.toFixed(4),
          ...(c.gain ? { gain_db: c.gain } : {}), ...(ts.gain != null && ts.gain !== 1 ? { level: ts.gain } : {}), ...(c.pan ? { pan: c.pan } : {}), ...(c.delay ? { delay: c.delay } : {}),
          ...(c.fadeIn ? { fadeIn: +c.fadeIn.toFixed(4) } : {}), ...(c.fadeOut ? { fadeOut: +c.fadeOut.toFixed(4) } : {}),
          ...(c.takes > 1 ? { takes: c.takes, take: c.take } : {}), effects: fxOut(c.plugins), ...(files[i] ? {} : { madeInBrowser: true }) };
      });
      return lane;
    });
    out.playground = rec;
    const text = JSON.stringify(out, null, 1);
    const name = `${S.session}${curVer ? " " + curVer.label : ""} session.json`.replace(/[\/\\:]/g, "-");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return { ok: true, file: name, left: left.length,
      message: `Downloaded ${name}.` + (left.length ? ` ${left.length} clip${left.length > 1 ? "s" : ""} made here (Tune, variations…) stay in this browser.` : "") };
  };
  // Import: a session.json exported here goes back onto the open version (one undo step).
  handlers.importSession = ({ text }) => {
    let j;
    try { j = JSON.parse(text); } catch (e) { return { error: "That file isn't a session.json." }; }
    const rec = j && j.playground;
    if (!rec || !rec.tracks) return { error: "That session.json wasn't exported from the KILLTOY playground, so there's nothing to bring back here." };
    checkRec(rec);
    if (rec.project !== projectOf_(curSong)) return { error: `That file is ${rec.project}${rec.version ? " " + rec.version : ""}. Open ${rec.project} first, then import it.` };
    undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    eachSrc(rec, (src) => (madeHere(src) ? "missing:" + src : src)); // audio made in another browser session isn't here
    applySaved(rec);
    needSources(); loadHeard(); restartIfPlaying(); markDirty(); changed();
    return { ok: true, message: `Brought back ${rec.project}${rec.version ? " " + rec.version : ""} from the file.` };
  };

  // Every command that changes the session saves it a moment later. These don't.
  const NOT_EDITS = new Set(["getState", "guessClipBpmKey", "getPeaks", "previewProject", "previewTune", "previewNote", "previewNoteOff", "previewSample", "stopPreview", "listPlugins",
    "aiStatus", "getAudioSetup", "setAudioSetup", "togglePlay", "stop", "setPosition", "setLook", "pickBackground", "removeBackground", "revealChains",
    "audioSettings", "updateStatus", "updateCheck", "updateInstall", "updateSetKey", "updateOpenKeyPage", "getSamples", "setSampleFiles", "toyMachineMeter", "laneMeter",
    "toyMachineNote", "toyMachineBend", "toyMachineWheel", "toyMachineAudition", "toyMachinePresets", "toyMachineGetPreset", "instrumentTouched", "auditionTake", "trackPitch",
    "openSession", "openVersion", "newVersion", "newSession", "renameSession", "deleteSession", "save", "exportSession", "importSession", "exportMix", "exportTakes", "browseForBeat",
    "scanPlugins", "managePlugins", "setWindowColour", "openPlugin", "setCountIn", "setAiSettings", "installVoiceTools", "installAiTools", "toggleClick", "setClickSound", "previewClick", "getClickSounds", "setClickPattern", "setClickVolume",
    "analyzeBeat", "toyMachineClose", "toyMachineSavePreset", "touchAutomation", "killDrumGet", "killDrumHit", "killDrumPeaks", "killDrumRoot", "killDrumBeatGet", "killDrumSolo", "laneSolo", "laneSoloState", "toyMachineSamplePeaks", "patternCount", "playgroundPeaks", "peekSketch", "peekRender", "setPlaygroundMix", "bounceMix", "bounceStop", "bounceProgress", "fileCount"]);
  for (const name of Object.keys(handlers)) {
    if (NOT_EDITS.has(name)) continue;
    const orig = handlers[name];
    const wrapped = (args) => { const r = orig(args); markDirty(); if (r && typeof r.then === "function") r.then(markDirty, () => {}); return r; };
    if (orig.undoable) wrapped.undoable = true;
    handlers[name] = wrapped;
  }
  // Jobs (Tune, Clean, variations, stems…) change the session when they finish.
  const seenDone = new Set();
  setInterval(() => { for (const j of S.jobs) if (j.finished && !seenDone.has(j.id)) { seenDone.add(j.id); markDirty(); } }, 1000);

  return { tick };
};
