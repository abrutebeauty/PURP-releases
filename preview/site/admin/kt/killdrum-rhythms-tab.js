/* KILLDRUM RHYTHMS tab (Eman, 8 Nov 2026): the core rhythms as a list you can press, like the metronome's
   rhythm picker. The one the beat is in lights up (every roll lands in one). Press one: the sounds stay, the
   patterns move into that rhythm. LOCK keeps every roll in it. EXPERIMENTAL: low = the skeleton, middle =
   how real songs play it, high = two rhythms mixed, max = glitch. Data: ui/killdrum-rhythms.js + the learned
   rhythm-brain-data.json (songs, tempos, artists per rhythm). KD_RHYTHM_OFF = no tab. */
(function () {
  "use strict";
  const K = () => window.KillDrumRhythms || null;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // the dots: one row per pad line (kick, snare, hats), 16 (or 12) slots, big dot = a hit that makes the rhythm
  function dots(r) {
    const rows = [["k", "kr-k"], ["s", "kr-s"], ["h", "kr-h"]];
    const per = r.grid, bars = Math.min(r.bars, 2), out = [];
    for (const [key, cls] of rows) {
      const str = r[key]; if (!str) continue;
      let html = "";
      for (let b = 0; b < bars; b++) {
        if (b) html += `<i class="kr-bar"></i>`;
        for (let i = 0; i < per; i++) {
          const c = str[(b * per + i) % str.length] || ".";
          html += `<i class="${c === "X" ? "kr-big" : c === "x" ? "kr-dot" : "kr-off"}${per === 16 && i % 4 === 0 ? " kr-beat" : per === 12 && i % 3 === 0 ? " kr-beat" : ""}"></i>`;
        }
      }
      out.push(`<div class="kr-row ${cls}">${html}</div>`);
    }
    return out.join("");
  }
  const feelOf = (r) => (r.grid === 12 ? "triplet feel" : r.swing ? "swung" : "4/4");
  const sub = (r) => `${r.bpm[0]}\u2013${r.bpm[1]} \u00b7 ${feelOf(r)}${r.bars > 1 ? " \u00b7 2 bars" : ""}`;


  /* PREVIEW (Eman, 14 Nov 2026: "when you press the rhythms they should play with a default sound, sort of like the
     metronome ... just to decide the rhythm for the generations"). Pressing a card loops that rhythm with plain
     metronome-style clicks on its own little AudioContext: a low blip for the kick row (and the 808 row), a higher
     one for the snare, a soft tick for hats. Big hits ("X") play louder. The kit and its sounds are never touched.
     Press the playing card again, switch tabs, close the window or press PLAY to stop it.
     KT2_KD_RHYTHM_PREVIEW_OFF = silent cards (old behaviour). */
  const Preview = (function () {
    let ac = null, cur = null, timer = 0, noise = null, bus = null;
    const ctxGet = () => {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); }
      if (ac.state === "suspended") ac.resume().catch(() => {});
      if (!bus) { bus = ac.createGain(); bus.connect(ac.destination); }   // every click goes through here (the smoke test listens on it)
      return ac;
    };
    const noiseBuf = (c) => { if (noise) return noise; noise = c.createBuffer(1, Math.round(c.sampleRate * 0.12), c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noise; };
    function blip(c, t, f0, f1, len, vol, type) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(bus); o.start(t); o.stop(t + len + 0.02);
    }
    function tick(c, t, len, vol) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(c); f.type = "highpass"; f.frequency.value = 7000;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + len + 0.02);
    }
    // the sound for one hit: row k = kick (low blip), b = 808/bass line (lower blip), s = snare (high blip), h = hats (tick), p = perc
    function hitAt(c, t, row, big) {
      const v = big ? 1 : 0.55;
      if (row === "k") blip(c, t, 180, 70, 0.09, 0.9 * v);
      else if (row === "b") blip(c, t, 110, 60, 0.12, 0.7 * v);
      else if (row === "s") blip(c, t, 1250, 1000, 0.05, 0.38 * v, "triangle");
      else if (row === "h") tick(c, t, big ? 0.09 : 0.025, 0.16 * v);
      else if (row === "p") blip(c, t, 2200, 2000, 0.03, 0.15 * v);
    }
    const ROWS = ["k", "b", "s", "h", "p"];
    function tempoFor(r) {
      const lo = r.bpm[0], hi = r.bpm[1], song = typeof ui !== "undefined" && ui.state && +ui.state.bpm;
      if (song && song >= lo && song <= hi) return song;   // the song's tempo when it fits the rhythm, else the middle of its range
      return Math.round((lo + hi) / 2);
    }
    function stop() {
      clearInterval(timer); timer = 0;
      if (cur && cur.onStop) try { cur.onStop(); } catch (e) { /* gone */ }
      cur = null;
    }
    // r: a rhythm; tile: its card (playhead + "is it still on screen"); onStop: called once when it stops
    function play(r, tile, onStop) {
      stop();
      const c = ctxGet(); if (!c) return false;
      const per = r.grid || 16, bars = r.bars || 1, n = per * bars, bpm = tempoFor(r);
      const step = 60 / bpm / (per === 12 ? 3 : 4);
      const swing = r.swing ? Math.max(0, Math.min(0.75, r.swing) - 0.5) * 2 * step * 0.66 : 0;
      cols = colsOf(tile, per, Math.min(bars, 2));
      cur = { id: r.id, r, tile, onStop, next: c.currentTime + 0.06, i: 0, step, n, swing, lit: -1 };
      const pump = () => {
        if (!cur) return;
        // gone from the screen (tab switched, window closed) or the song started playing: stop
        if (!tile.isConnected || !tile.offsetParent || (typeof ui !== "undefined" && ui.transport && ui.transport.playing)) { stop(); return; }
        while (cur.next < c.currentTime + 0.12) {
          const i = cur.i, t = cur.next + (i % 2 ? cur.swing : 0);
          for (const row of ROWS) { const str = r[row]; if (!str) continue; const ch = str[i % str.length]; if (ch === "X" || ch === "x") hitAt(c, t, row, ch === "X"); }
          const show = i % (per * Math.min(bars, 2)), delay = Math.max(0, (t - c.currentTime) * 1000);
          setTimeout(() => { if (cur && cur.tile === tile) light(show); }, delay);
          cur.i = (i + 1) % n; cur.next += step;
        }
      };
      pump(); timer = setInterval(pump, 25);
      return true;
    }
    // playhead: the dot columns of the card (each row's dots, bar gaps skipped)
    let cols = null;
    function colsOf(tile, per, bars) {
      const out = [];
      for (const row of tile.querySelectorAll(".kr-row")) { const dots = [...row.querySelectorAll("i:not(.kr-bar)")]; dots.forEach((d, k) => { (out[k] = out[k] || []).push(d); }); }
      return out;
    }
    function light(k) {
      if (!cols || !cur) return;
      if (cur.lit >= 0 && cols[cur.lit]) for (const d of cols[cur.lit]) d.classList.remove("kr-ph");
      if (cols[k]) for (const d of cols[k]) d.classList.add("kr-ph");
      cur.lit = k;
    }
    const clearLight = () => { if (cols) for (const c of cols) if (c) for (const d of c) d.classList.remove("kr-ph"); cols = null; };
    const tap = () => { const c = ctxGet(); if (!c) return null; const a = c.createAnalyser(); a.fftSize = 2048; bus.connect(a); return a; };
    return { play, stop: () => { stop(); clearLight(); }, playing: () => (cur ? cur.id : null), _clear: clearLight, _tap: tap };
  })();
  window.KillDrumPreview = Preview;

  function mount(pane, ctx) {
    const api = () => window.killDrumBeat || null;
    pane.innerHTML = "";
    const root = el("div", "kd-rhythms");
    const head = el("div", "kr-head", `<div class="kr-now"><div class="kd-label">Rhythm</div><div class="kr-name">\u2014</div><div class="kr-about"></div></div>
      <div class="kr-ctrls"><button class="kr-lock" title="Lock: every roll stays in this rhythm"><svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/></svg><span>Lock</span></button>
      <div class="kr-xp" title="Experimental: low = the rhythm's skeleton, middle = how real songs play it, high = two rhythms mixed, max = glitch"><span class="kd-label">Experimental</span><input type="range" min="0" max="100" step="1" value="0"><b>0%</b><em></em></div></div>`);
    const body = el("div", "kr-body");
    const foot = el("div", "kr-foot");
    root.append(head, body, foot); pane.append(root);
    const nameEl = head.querySelector(".kr-name"), aboutEl = head.querySelector(".kr-about"), lockBtn = head.querySelector(".kr-lock"), range = head.querySelector("input"), pctEl = head.querySelector(".kr-xp b"), xpWord = head.querySelector(".kr-xp em");
    const tiles = {};
    function build() {
      Preview.stop(); body.innerHTML = ""; const B = K(); if (!B) { body.append(el("div", "kd-none", "The rhythm brain didn't load.")); return; }
      for (const g of B.GROUPS) {
        const list = B.RHYTHMS.filter((r) => r.group === g.id); if (!list.length) continue;
        body.append(el("div", "kr-group", esc(g.name)));
        const grid = el("div", "kr-grid");
        for (const r of list) {
          const t = el("button", "kr-tile", `<div class="kr-tname">${esc(r.name)}</div><div class="kr-dots">${dots(r)}</div><div class="kr-sub">${esc(sub(r))}</div><div class="kr-tag"></div>`);
          t.dataset.id = r.id; t.title = r.about;
          t.onclick = () => {
            const a = api(); if (a && a.setRhythm) a.setRhythm(r.id);
            if (window.KT2_KD_RHYTHM_PREVIEW_OFF) return;
            // press = hear it with plain clicks (looping); press the playing card again = stop
            if (Preview.playing() === r.id) { Preview.stop(); return; }
            Preview.stop();
            if (Preview.play(r, t, () => { t.classList.remove("kr-play"); Preview._clear(); })) t.classList.add("kr-play");
          };
          t.onmouseenter = () => { if (ctx.say) ctx.say(B.describe(r.id)); };
          grid.append(t); tiles[r.id] = t;
        }
        body.append(grid);
      }
    }
    const XP_WORDS = [[0, "skeleton"], [0.25, "real songs"], [0.55, "mixed"], [0.8, "glitch"]];
    function render() {
      const a = api(), st = a && a.rhythmState ? a.rhythmState() : { rhythm: null, lock: false, xp: 0 }, B = K();
      const r = st.rhythm && B ? B.byId(st.rhythm) : null;
      nameEl.textContent = r ? r.name : "Roll the dice, or press a rhythm";
      aboutEl.textContent = r ? (B.describe(r.id) + (st.mix ? " Mixed with " + (B.byId(st.mix) || {}).name + "." : st.glitch ? " Glitched." : "")) : "";
      lockBtn.classList.toggle("kd-on", !!st.lock); lockBtn.disabled = !r;
      const xp = Math.round((st.xp || 0) * 100); if (document.activeElement !== range) range.value = xp; pctEl.textContent = xp + "%";
      let w = ""; for (const [v, word] of XP_WORDS) if ((st.xp || 0) >= v) w = word; xpWord.textContent = w;
      for (const id in tiles) { const t = tiles[id]; t.classList.toggle("kd-on", id === st.rhythm); t.classList.toggle("kr-mix", id === st.mix); t.querySelector(".kr-tag").textContent = id === st.rhythm ? (st.lock ? "LOCKED" : "NOW") : id === st.mix ? "MIXED IN" : ""; }
      const d = B && B.data(); foot.textContent = d && d.songs ? `Learned from ${d.songs.toLocaleString()} songs (${(d.bars / 1e6).toFixed(1)} million bars): Lakh clean MIDI + Groove MIDI Dataset.` : "";
    }
    lockBtn.onclick = () => { const a = api(); if (a && a.setRhythmLock) a.setRhythmLock(!a.rhythmState().lock); };
    range.oninput = () => { pctEl.textContent = range.value + "%"; const a = api(); if (a && a.setXp) a.setXp(range.value / 100); };
    const onR = () => render(), onData = () => { build(); render(); };
    document.addEventListener("killdrum-rhythm", onR);
    document.addEventListener("rhythmbrain", onData);
    build(); render();
    return { show: render, destroy() { Preview.stop(); document.removeEventListener("killdrum-rhythm", onR); document.removeEventListener("rhythmbrain", onData); } };
  }

  if (!window.KD_RHYTHM_OFF) {
    window.KillDrumTabs = window.KillDrumTabs || [];
    window.KillDrumTabs.push({ id: "rhythms", label: "Rhythms", order: 1, mount });
  }
  window.KillDrumRhythmsTab = { mount, dots };
})();
