// KILLDRUM FX host: plays the FX tab's effects on the drums in the browser playground.
// playground.js builds one small chain per pad per play pass and calls three hook lists:
//   KillDrumEngineHooks (ctx, node, pad, hc) -> node   per pad chain, after the pad's own knobs
//   KillDrumHitHooks    (ctx, info)                    once per main hit, ahead of time
//   KillDrumStopHooks   ()                             transport stop and every restart (loop wrap)
// For each drum voice ("a dot") the host builds:
//   node -> [delay = effect latency] -> dry ------------------------------------------------> out
//   node -> DRIVE (tanh, 0..24 dB) -> effect instance -> LP -> HP (CUTOFF/RES) -> wet -> guard -> out
// and keeps every chain that is playing, so the tab can move dots while the loop runs
// (KdFx.host.update) without a restart. Effects are other people's code: every call into one is
// wrapped, and a broken effect only loses its wet signal, never the drums.
(function () {
  "use strict";
  const K = window.KdFx;
  if (!K || !K.voiceState) { console.warn("KILLDRUM FX host: load killdrum-fx-core.js first"); return; }
  if (K.host && K.host.installed) return;
  const clamp = K.clamp;

  const R = 32;          // the drive curve covers signal x gain up to +-32 (+24 dB on a hot hit)
  const H = 2;           // drive headroom: 2*tanh(x/2) is clean at 0 dB, a square wave at +24 dB
  const GUARD = 4;       // the wet guard sees +-4: straight up to 1, then bends softly to 2
  const MAX_LAT = 0.25;  // the longest effect latency the dry path follows (seconds)
  const FADE = 0.03;     // crossfade when the effect is swapped live
  const TAIL = 1.6;      // a pass chain's effect fades out over 0.9 s and is let go this long after its last hit ends (song mode):
                         // when the MIDI ends, the effect's tail ends too (Eman, 27 Oct: nothing keeps sounding after the drums)
  const SINGLE = 6;      // a single pad hit's chain lives this long after the hit
  const METER = 1024;    // analyser window: longer than a 60 fps frame, so no hit falls between reads

  const live = new Map();    // pluginId -> Set of chains playing now
  const latest = new Map();  // pluginId -> { kv, base, same }: the tab's newest FX state (may be ahead of the saved kit)
  const kits = new Map();    // pluginId -> the last kit object a hook saw
  const kicks = new Map();   // pluginId -> kick times (audio clock), oldest first
  const kickFns = new Set();
  const warned = new Set();
  const prepped = new WeakMap();
  let lastCtx = null, clock = null, timer = 0, born = 0;

  const warn = (id, e) => { if (warned.has(id)) return; warned.add(id); console.error("KILLDRUM FX " + id + ":", e); };
  const ctxNow = () => lastCtx || (K.audioCtx && K.audioCtx()) || null;
  const nyq = (ctx) => ctx.sampleRate / 2;
  const qDb = (q) => 20 * Math.log10(q); // BiquadFilter's Q is in dB for lowpass/highpass
  const same = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } };

  // ------------------------------------------------------------------ curves (WaveShaper copies them)
  let dCurve = null, gCurve = null;
  function driveCurve() {
    if (dCurve) return dCurve;
    const n = 8193; // odd, so 0 in is exactly 0 out (no DC)
    dCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * R; dCurve[i] = H * Math.tanh(x / H); }
    return dCurve;
  }
  function guardCurve() {
    if (gCurve) return gCurve;
    const n = 4097;
    gCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * GUARD, a = Math.abs(x); gCurve[i] = a < 1 ? x : Math.sign(x) * (1 + Math.tanh(a - 1)); }
    return gCurve;
  }

  // ------------------------------------------------------------------ small helpers
  // instant at build time (the first hit is only ~30 ms away), a 20 ms glide for live moves
  function put(param, v, ctx, instant) {
    if (!param || !isFinite(v)) return;
    const t = ctx.currentTime;
    if (instant) { param.cancelScheduledValues(t); param.setValueAtTime(v, t); } else param.setTargetAtTime(v, t, 0.02);
  }
  function call(slot, fn, arg) {
    if (!slot || slot.dead || typeof slot.inst[fn] !== "function") return;
    try { slot.inst[fn](arg); } catch (e) { warn(slot.desc.id + "." + fn, e); }
  }
  function prep(ctx) {
    if (!ctx || prepped.get(ctx) === K.effects.length) return;
    prepped.set(ctx, K.effects.length);
    try { K.prepare(ctx); } catch (e) { warn("prepare", e); }
  }
  function see(ctx) { lastCtx = ctx; prep(ctx); }
  // run fn once the audio clock passes t (gives up waiting after 3 s if the context is suspended)
  function afterAudio(ctx, t, fn, waited = 0) {
    setTimeout(() => {
      if (ctx.currentTime >= t || waited > 3000 || ctx.state === "closed") fn();
      else afterAudio(ctx, t, fn, waited + 60);
    }, 60);
  }
  const beatAt = (ch, t) => (ch.single ? null : ((ch.pos + (t - ch.when)) * ch.bpm) / 60);
  const beatOf = (ch) => beatAt(ch, ch.ctx.currentTime);
  // when the voice's last hit really ends: the engine shortens it after the hit hook (pad decay, the
  // clip's end fade), so a 15 s texture faded at the clip's end doesn't keep its effect alive 15 s more
  const endOf = (ch) => (ch.lastHit && isFinite(ch.lastHit.endAt) ? Math.min(ch.lastAt, ch.lastHit.endAt) : ch.lastAt);
  // The FX state for a kit: the tab's newest copy wins until the saved copy changes under it
  // (undo, another window); then the saved one wins.
  function kvFor(kit) {
    const L = latest.get(kit.id);
    if (!L) return kit.kitVoid;
    if (L.base === undefined) L.base = kit.kitVoid;
    if (kit.kitVoid === L.base || kit.kitVoid === L.same) return L.kv;
    if (same(kit.kitVoid, L.kv)) { L.same = kit.kitVoid; return L.kv; }
    latest.delete(kit.id);
    return kit.kitVoid;
  }

  // ------------------------------------------------------------------ one voice's chain
  function build(ctx, node, hc, kv) {
    const ch = {
      pid: hc.kit.id, kit: hc.kit, note: hc.note, pass: hc.pass, single: hc.pos == null || hc.when == null,
      ctx, node, bpm: hc.bpm || 120, pos: hc.pos, when: hc.when,
      slot: null, old: [], hits: [], wetOn: false, asleep: false, dead: false, born: ++born, lastAt: ctx.currentTime,
    };
    // standby is just dry -> out (two gains): turning the voice on later attaches the effect live
    ch.dry = ctx.createGain();
    ch.out = ctx.createGain();
    node.connect(ch.dry); ch.dry.connect(ch.out);
    const st = K.voiceState(kv, ch.note);
    if (st) use(ch, st, kv, true);
    let set = live.get(ch.pid);
    if (!set) live.set(ch.pid, (set = new Set()));
    set.add(ch);
    if (ch.single) { ch.dieAt = ctx.currentTime + SINGLE; reap(ch); }
    else clock = { ctx, pos: ch.pos, when: ch.when, bpm: ch.bpm };
    if (!timer) timer = setInterval(tick, 30);
    return ch;
  }
  // DRIVE in front of the effect, CUTOFF/RES and DRY/WET after it (made the first time the voice is on)
  function wetPath(ch) {
    if (ch.post) return;
    const ctx = ch.ctx;
    ch.pre = ctx.createGain(); ch.shaper = ctx.createWaveShaper(); ch.post = ctx.createGain();
    ch.shaper.curve = driveCurve(); ch.shaper.oversample = "none";
    ch.lp = ctx.createBiquadFilter(); ch.lp.type = "lowpass";
    ch.hp = ctx.createBiquadFilter(); ch.hp.type = "highpass";
    ch.lp.frequency.value = nyq(ctx); ch.hp.frequency.value = 10; ch.lp.Q.value = ch.hp.Q.value = qDb(Math.SQRT1_2);
    ch.wet = ctx.createGain(); ch.wet.gain.value = 0;
    ch.guard = ctx.createWaveShaper(); ch.guard.curve = guardCurve(); // a runaway effect can't blow up the mix
    ch.node.connect(ch.pre); ch.pre.connect(ch.shaper); ch.shaper.connect(ch.post);
    ch.lp.connect(ch.hp); ch.hp.connect(ch.wet); ch.wet.connect(ch.guard); ch.guard.connect(ch.out);
  }
  // Make the chain run `st` (create or swap the effect if needed), then set its knobs.
  function use(ch, st, kv, instant) {
    if (!ch.slot || ch.slot.desc !== st.desc) {
      wetPath(ch);
      // a broken effect is tried once per chain, not on every drag move
      if (ch.failed === st.desc || !attach(ch, st, kv, instant)) { ch.failed = st.desc; mix(ch, null, instant); return; }
    } else {
      call(ch.slot, "set", K.params(kv, st.dot, beatOf(ch), ch.bpm, kv.sync ? "sync" : ch.note));
      // an FFT effect's latency follows its FFT SIZE dial
      if (ch.slot && ch.slot.inst) latency(ch, Number(ch.slot.inst.latency) || 0, false);
    }
    mix(ch, st.dot, instant);
  }
  function attach(ch, st, kv, instant) {
    const ctx = ch.ctx, desc = st.desc, v = K.voiceByNote[ch.note] || { slot: "perc", kind: "perc" };
    let inst = null;
    try {
      inst = desc.create(ctx, {
        bpm: ch.bpm, voice: v.slot, kind: v.kind, note: ch.note, pluginId: ch.pid,
        seed: K.hash(kv.seed != null ? kv.seed : 1, ch.note), beatAt: (t) => beatAt(ch, t),
      });
      if (!inst || !inst.input || !inst.output) throw new Error("create() must return { input, output, set, destroy }");
      if (typeof inst.set === "function") inst.set(K.params(kv, st.dot, beatOf(ch), ch.bpm, kv.sync ? "sync" : ch.note));
    } catch (e) {
      warn(desc.id, e);
      if (inst) kill({ desc, inst }, ch);
      return false;
    }
    const slot = { desc, inst, ig: ctx.createGain() }, prev = ch.slot, now = ctx.currentTime;
    try { ch.post.connect(inst.input); inst.output.connect(slot.ig); slot.ig.connect(ch.lp); } catch (e) { warn(desc.id, e); kill(slot, ch); return false; }
    if (prev && !instant) { // crossfade, so a live swap doesn't click
      slot.ig.gain.setValueAtTime(0, now); slot.ig.gain.linearRampToValueAtTime(1, now + FADE);
      prev.ig.gain.cancelScheduledValues(now); prev.ig.gain.setValueAtTime(prev.ig.gain.value, now); prev.ig.gain.linearRampToValueAtTime(0, now + FADE);
      ch.old.push(prev);
      afterAudio(ctx, now + FADE + 0.02, () => { kill(prev, ch); ch.old = ch.old.filter((s) => s !== prev); });
    } else if (prev) kill(prev, ch);
    ch.slot = slot;
    latency(ch, Number(inst.latency) || 0, instant);
    // hits this pass already scheduled reach the new effect too (stutter, tape stop...)
    if (typeof inst.trigger === "function") for (const h of ch.hits) if (h.at > now) call(slot, "trigger", h);
    return true;
  }
  // The dry waits as long as the effect does, so DRY/WET doesn't comb (the delay is added when first needed).
  function latency(ch, sec, instant) {
    sec = clamp(sec, 0, MAX_LAT);
    if (!ch.dly) {
      if (!sec) return;
      ch.dly = ch.ctx.createDelay(MAX_LAT);
      ch.dly.delayTime.value = sec;
      ch.node.connect(ch.dly); ch.dly.connect(ch.dry);
      try { ch.node.disconnect(ch.dry); } catch (e) { /* not connected */ }
      return;
    }
    if (instant) put(ch.dly.delayTime, sec, ch.ctx, true); else ch.dly.delayTime.setTargetAtTime(sec, ch.ctx.currentTime, 0.01);
  }
  // DRIVE, CUTOFF/RES and DRY/WET for a dot (null = the voice is off: all dry, the effect idles)
  function mix(ch, dot, instant) {
    const ctx = ch.ctx, on = !!(dot && ch.slot);
    const w = on ? clamp(dot.wet != null ? dot.wet : 0.5) : 0;
    ch.wetOn = on;
    // between linear and equal power: correlated effects (drive, filters) bump +1.5 dB at 50%,
    // decorrelated ones (reverb, grains) dip 1.5 dB; neither jumps
    put(ch.dry.gain, Math.pow(1 - w, 0.75), ctx, instant);
    if (!ch.post) return;
    if (!on) { put(ch.wet.gain, 0, ctx, instant); return; }
    const d = clamp(dot.drive || 0), g = Math.pow(10, (d * 24) / 20);
    put(ch.pre.gain, g / R, ctx, instant);
    put(ch.post.gain, Math.pow(g, -0.6), ctx, instant); // louder as it clips, but only a little
    const os = d > 0.001 ? "2x" : "none"; // oversampling only costs CPU while there's drive
    if (ch.shaper.oversample !== os) ch.shaper.oversample = os;
    const c = clamp(Number(dot.cutoff) || 0, -1, 1), r = clamp(dot.res != null ? dot.res : 0.2);
    const q = Math.SQRT1_2 + r * (12 - Math.SQRT1_2) * Math.min(1, Math.abs(c) * 10); // RES fades in off the centre
    put(ch.lp.frequency, c < 0 ? 20000 * Math.pow(0.01, -c) : nyq(ctx), ctx, instant);  // 20 kHz .. 200 Hz
    put(ch.hp.frequency, c > 0 ? 20 * Math.pow(200, c) : 10, ctx, instant);           // 20 Hz .. 4 kHz
    put(ch.lp.Q, qDb(c < 0 ? q : Math.SQRT1_2), ctx, instant);
    put(ch.hp.Q, qDb(c > 0 ? q : Math.SQRT1_2), ctx, instant);
    const comp = 1 / (1 + 0.1 * (q - Math.SQRT1_2)); // a screaming resonance shouldn't jump out of the mix
    put(ch.wet.gain, (Math.pow(w, 0.75) * comp) / GUARD, ctx, instant);
  }
  function kill(slot, ch) {
    if (!slot || slot.dead) return;
    slot.dead = true;
    try { if (typeof slot.inst.destroy === "function") slot.inst.destroy(); } catch (e) { warn(slot.desc.id + ".destroy", e); }
    try { if (slot.ig) slot.ig.disconnect(); } catch (e) { /* gone */ }
    try { slot.inst.output.disconnect(); } catch (e) { /* gone */ }
    if (ch && ch.post) try { ch.post.disconnect(slot.inst.input); } catch (e) { /* not connected */ }
  }
  // the pass has played its last hit: free the effect (LFOs, worklets), keep the dry path
  function sleep(ch) {
    ch.asleep = true;
    kill(ch.slot, ch); for (const s of ch.old) kill(s, ch);
    ch.slot = null; ch.old = [];
    mix(ch, null, false);
  }
  function drop(ch) {
    if (ch.dead) return;
    ch.dead = true;
    kill(ch.slot, ch); for (const s of ch.old) kill(s, ch);
    for (const k of ["dly", "dry", "pre", "shaper", "post", "lp", "hp", "wet", "guard", "out", "anIn", "anOut"]) {
      if (ch[k]) try { ch[k].disconnect(); } catch (e) { /* gone */ }
    }
    const set = live.get(ch.pid);
    if (set) { set.delete(ch); if (!set.size) live.delete(ch.pid); }
  }
  // a single pad hit's chain goes a few seconds after its hit has rung out
  function reap(ch) {
    setTimeout(() => {
      if (ch.dead) return;
      if (ch.ctx.currentTime >= ch.dieAt || ch.ctx.state === "closed") drop(ch); else reap(ch);
    }, 1000);
  }

  // ------------------------------------------------------------------ motion, gravity, clean-up (~33 times a second)
  function tick() {
    if (!live.size) { clearInterval(timer); timer = 0; return; }
    for (const set of live.values()) {
      let kv;
      for (const ch of set) {
        if (ch.dead || ch.single || ch.asleep || !ch.slot) continue;
        const end = endOf(ch);
        if (ch.ctx.currentTime > end + TAIL) { sleep(ch); continue; }
        if (!ch.fading && ch.ctx.currentTime > end + TAIL - 1 && ch.wet) {
          ch.fading = true;
          const g = ch.wet.gain, t = ch.ctx.currentTime;
          try { if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); } g.linearRampToValueAtTime(0, t + 0.9); } catch (e) { /* gone */ }
        }
        if (kv === undefined) kv = kvFor(ch.kit);
        const st = K.voiceState(kv, ch.note);
        if (!st || st.desc !== ch.slot.desc) continue;
        const m = st.dot.motion;
        if ((m && m.path && m.path.length > 1) || (kv.gravity && kv.gravity !== "off")) call(ch.slot, "set", K.params(kv, st.dot, beatOf(ch), ch.bpm, kv.sync ? "sync" : ch.note));
      }
    }
  }

  // ------------------------------------------------------------------ hooks
  function engineHook(ctx, node, pad, hc) {
    const kit = hc && hc.kit;
    if (!kit || !node || hc.note == null || !K.voiceByNote[hc.note]) return node;
    const kv = kvFor(kit);
    if (!kv || kv.v !== 2) return node; // this kit has no FX state: no cost at all
    see(ctx);
    kits.set(kit.id, kit);
    try { return build(ctx, node, hc, kv).out; } catch (e) { warn("host", e); return node; }
  }
  function hitHook(ctx, info) {
    if (!info || info.note == null) return;
    see(ctx);
    const pid = info.kit ? info.kit.id : null, at = info.at, gain = info.gain;
    K.emit({ t: at, note: info.note, gain, kind: "hit", pluginId: pid });
    if (info.note === 36) kick(ctx, pid, at, gain);
    const set = pid != null && live.get(pid);
    if (!set) return;
    const src = info.hit && info.hit.src, rate = (src && src.playbackRate && src.playbackRate.value) || 1;
    const dur = info.buf ? info.buf.duration / rate : 1;
    for (const ch of set) {
      if (ch.dead || ch.pass !== info.pass || ch.note !== info.note) continue;
      if (at + dur >= ch.lastAt) ch.lastHit = info.hit;
      ch.lastAt = Math.max(ch.lastAt, at + dur);
      if (ch.fading) { ch.fading = false; const st = K.voiceState(kvFor(ch.kit), ch.note); mix(ch, st && st.dot, false); }
      if (ch.single) ch.dieAt = Math.max(ch.dieAt, at + dur + SINGLE);
      const h = { at, buf: info.buf, gain, rate, beat: info.songAt != null ? (info.songAt * ch.bpm) / 60 : null };
      ch.hits.push(h);
      if (!ch.asleep) call(ch.slot, "trigger", h);
    }
  }
  function kick(ctx, pid, at, gain) {
    let a = kicks.get(pid);
    if (!a) kicks.set(pid, (a = []));
    let i = a.length;
    while (i > 0 && a[i - 1] > at) i--; // a pass schedules in time order; overlapping passes keep it sorted
    a.splice(i, 0, at);
    const old = ctx.currentTime - 2;
    let j = 0;
    while (j < a.length && a[j] < old) j++;
    if (j) a.splice(0, j);
    if (a.length > 4096) a.splice(0, a.length - 4096);
    for (const fn of kickFns) try { fn({ at, gain, pluginId: pid }); } catch (e) { warn("onKick", e); }
  }
  function stopHook() {
    for (const set of [...live.values()]) for (const ch of [...set]) drop(ch);
    live.clear(); kicks.clear(); clock = null;
    if (timer) { clearInterval(timer); timer = 0; }
  }

  // ------------------------------------------------------------------ meters
  const mbuf = new Float32Array(METER);
  function rmsDb(an) {
    an.getFloatTimeDomainData(mbuf);
    let s = 0;
    for (let i = 0; i < mbuf.length; i++) s += mbuf[i] * mbuf[i];
    const r = Math.sqrt(s / mbuf.length);
    return r > 1e-5 && isFinite(r) ? clamp(20 * Math.log10(r), -90, 6) : -90;
  }
  function analysers(ch) { // made on the first read, so voices nobody looks at cost nothing
    if (ch.anIn) return;
    ch.anIn = ch.ctx.createAnalyser(); ch.anIn.fftSize = METER;
    ch.anOut = ch.ctx.createAnalyser(); ch.anOut.fftSize = METER;
    ch.node.connect(ch.anIn); ch.out.connect(ch.anOut);
  }

  // ------------------------------------------------------------------ API
  const host = (K.host = {
    installed: true,
    // apply the tab's FX state to everything playing now: ramps, live effect swaps, no restart
    update(pluginId, kv) {
      if (pluginId == null) return;
      const kit = kits.get(pluginId);
      latest.set(pluginId, { kv, base: kit ? kit.kitVoid : undefined, same: null });
      prep(ctxNow()); // worklets load before the first play
      const set = live.get(pluginId);
      if (!set) return;
      for (const ch of set) {
        if (ch.dead || ch.asleep) continue;
        try {
          const st = kv && kv.v === 2 ? K.voiceState(kv, ch.note) : null;
          if (st) use(ch, st, kv, false); else mix(ch, null, false);
        } catch (e) { warn("update", e); }
      }
    },
    // { inDb, outDb } RMS (-90..+6, a short fall so hits stay readable) for the newest chain of a voice
    meter(note, pluginId) {
      let best = null;
      for (const [pid, set] of live) {
        if (pluginId != null && pid !== pluginId) continue;
        for (const ch of set) if (!ch.dead && ch.note === Number(note) && (!best || ch.born > best.born)) best = ch;
      }
      if (!best) return null;
      try {
        analysers(best);
        const t = performance.now(), dt = best.mt ? (t - best.mt) / 1000 : 1;
        best.mt = t;
        best.mi = Math.max(rmsDb(best.anIn), (best.mi != null ? best.mi : -90) - 30 * dt);
        best.mo = Math.max(rmsDb(best.anOut), (best.mo != null ? best.mo : -90) - 30 * dt);
        return { inDb: best.mi, outDb: best.mo, fx: best.wetOn };
      } catch (e) { warn("meter", e); return null; }
    },
    // the song's beat while it plays (null when stopped)
    beat() { return clock ? ((clock.pos + (clock.ctx.currentTime - clock.when)) * clock.bpm) / 60 : null; },
    // the song's tempo: the playing pass's, else the session's
    bpm() {
      if (clock) return clock.bpm;
      const S = window.purpPlaygroundDebug && window.purpPlaygroundDebug.S;
      return (S && S.bpm) || 120;
    },
    // what's playing, for tests and the console
    chains() {
      const out = [];
      for (const [pid, set] of live) for (const ch of set) out.push({ pluginId: pid, note: ch.note, single: ch.single, effect: ch.slot ? ch.slot.desc.id : null, wet: ch.wetOn, asleep: ch.asleep, hits: ch.hits.length });
      return out;
    },
    stop: stopHook,
  });
  K.now = () => { const c = ctxNow(); return c ? c.currentTime : null; };
  K.onKick = (fn) => (kickFns.add(fn), () => kickFns.delete(fn));
  K.kickTimes = (pluginId) => (kicks.get(pluginId) || []).slice();
  if (K.onRegister) K.onRegister(() => prep(lastCtx)); // a late effect file still gets its worklets

  (window.KillDrumEngineHooks = window.KillDrumEngineHooks || []).push(engineHook);
  (window.KillDrumHitHooks = window.KillDrumHitHooks || []).push(hitHook);
  (window.KillDrumStopHooks = window.KillDrumStopHooks || []).push(stopHook);
  void host;
})();
