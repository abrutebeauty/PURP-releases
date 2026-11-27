// KT_AUDIO_ALL (Eman, 7 Nov: "there is no sound recorded"): the bug recorder's ears.
// The app makes sound from many AudioContexts (the song engine, TOY MACHINE, SAMPLES, the picker,
// quests, the juice sounds...) and some <audio> elements. The old recorder only heard the song
// engine's master bus, so most of what you hear was missing. This runs before any app code and
// remembers every node that is wired to a speaker output and every <audio>/<video> that plays.
// KT_AUDIO_ALL(cb) hands the recorder one MediaStream per source (now and, through cb, any that
// start later), so it can mix them into the take. Costs nothing until a recording starts.
// Loaded first in app2.html, and by ver.html for older versions. ASCII only.
"use strict";
(function () {
  const AN = window.AudioNode, ADN = window.AudioDestinationNode;
  if (!AN || !ADN || window.KT_AUDIO_ALL) return;
  const ctxs = new Map();          // context -> { links: Map(node -> Set(output)), dest }
  const media = new Set();         // <audio>/<video> elements that have played
  let live = null;                 // the recording's listener, while one runs
  const conn = AN.prototype.connect, disc = AN.prototype.disconnect;
  const entry = (ctx) => {
    let e = ctxs.get(ctx);
    if (!e) { e = { links: new Map(), dest: null }; ctxs.set(ctx, e); }
    return e;
  };
  const tapOf = (ctx) => {
    const e = entry(ctx);
    if (!e.dest) {
      try { e.dest = ctx.createMediaStreamDestination(); } catch (er) { return null; }   // offline contexts can't
      if (live) live(e.dest.stream);
    }
    return e.dest;
  };
  AN.prototype.connect = function (dst, out) {
    const r = conn.apply(this, arguments);
    try {
      if (dst instanceof ADN && !(window.OfflineAudioContext && this.context instanceof OfflineAudioContext)) {
        const e = entry(this.context), o = out | 0;
        if (!e.links.has(this)) e.links.set(this, new Set());
        e.links.get(this).add(o);
        if (live) { const t = tapOf(this.context); if (t) conn.call(this, t, o); }
      }
    } catch (er) { /* never break the app's own wiring */ }
    return r;
  };
  AN.prototype.disconnect = function (dst) {
    const r = disc.apply(this, arguments);
    try {
      const e = ctxs.get(this.context);
      if (e && (arguments.length === 0 || typeof dst === "number" || dst instanceof ADN)) {
        e.links.delete(this);
        if (e.dest && arguments.length) try { disc.call(this, e.dest); } catch (er) { /* wasn't */ }
      }
    } catch (er) { /* fine */ }
    return r;
  };
  const HM = window.HTMLMediaElement;
  if (HM) {
    const play = HM.prototype.play;
    HM.prototype.play = function () { media.add(this); if (live) addMedia(this); return play.apply(this, arguments); };
  }
  let grabbed = new WeakSet();
  const addMedia = (m) => {
    if (grabbed.has(m) || !live) return;
    try {
      const cs = m.captureStream || m.mozCaptureStream; if (!cs) return;
      const s = cs.call(m);
      const go = () => { if (s.getAudioTracks().length && !grabbed.has(m)) { grabbed.add(m); live && live(new MediaStream(s.getAudioTracks())); } };
      go(); s.addEventListener("addtrack", go);
    } catch (er) { /* cross-origin media can't be heard here */ }
  };

  // Start listening: cb(stream) for every source, now and later. Returns { stop }.
  window.KT_AUDIO_ALL = (cb) => {
    live = cb;
    for (const [ctx, e] of ctxs) {
      if (ctx.state === "closed" || !e.links.size) continue;
      const t = tapOf(ctx); if (!t) continue;
      for (const [node, outs] of e.links) for (const o of outs) try { conn.call(node, t, o); } catch (er) { /* gone */ }
    }
    media.forEach(addMedia);
    return {
      stop() {
        live = null; grabbed = new WeakSet();
        for (const [, e] of ctxs) {
          if (!e.dest) continue;
          for (const [node] of e.links) try { disc.call(node, e.dest); } catch (er) { /* wasn't */ }
          e.dest = null;
        }
      },
    };
  };
})();
