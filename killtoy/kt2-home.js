// KILLTOY 2 PROJECTS page (Eman, 31 Oct 2026). Every song is a card: cover art (drop a picture on it),
// the title under it like a player, the info (BPM, KEY, PLAYTIME, CREATED, LAST OPEN, STATUS, NOTES),
// the whole song as a waveform with its parts marked, playable, with a QUICK MSTR preview switch
// and its versions as V1 V2 pills. On the left: smart search, sort, and folders you drag projects into.
// Everything Eman adds here (cover, title, status, notes, folders, playtime) is kept in this browser
// (localStorage "kt2.proj"). Replaces app.js's renderHome on the kt2 page only. ASCII only.
(function () {
  if (!document.documentElement.classList.contains("kt2")) return;
  const home = document.getElementById("home");
  if (!home) return;
  home.classList.add("k2home");

  // ---------------------------------------------------------------- what we keep per project
  const KEY = "kt2.proj";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
  let DB = load();
  DB.projects = DB.projects || {};
  DB.folders = DB.folders || [];
  DB.sort = DB.sort || "last";
  // each view keeps its own card size (Eman, 1 Nov); COVERS can go two steps bigger (-1, -2)
  if (DB.zoomG == null) DB.zoomG = DB.zoom || 0;
  const zKey = () => (DB.view === "grid" ? "zoomG" : "zoom");
  const zNow = () => Math.min(2, DB[zKey()] || 0);
  home.dataset.z = zNow();
  home.dataset.view = DB.view || "wave";
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast("This browser is out of room for project info.", true); } };
  const meta = (name) => (DB.projects[name] = DB.projects[name] || {});
  const looks = () => { try { return JSON.parse(localStorage.getItem("kt2.lookByProject") || "{}"); } catch (e) { return {}; } };
  // STATUS (Eman, 1 Nov): a dropdown, NONE by default; your own statuses can be added at the bottom
  const STATUS_BASE = ["Idea", "Writing", "Recording", "Mixing", "Mastering", "Done"];
  const statuses = () => [...STATUS_BASE, ...(DB.statuses || []).filter((x) => !STATUS_BASE.includes(x))];
  const H = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---------------------------------------------------------------- playtime, created, last open
  // Playtime only counts while a project is open AND you're doing something: when the mouse hasn't
  // moved (and no key, click or scroll) for over a minute the clock stops, and it starts again as
  // soon as you move (Eman, 1 Nov). Counted in 5 s steps.
  let lastInput = Date.now(), lastSession = null;
  for (const t of ["pointermove", "pointerdown", "keydown", "wheel"]) window.addEventListener(t, () => { lastInput = Date.now(); }, true);
  setInterval(() => {
    const s = typeof ui !== "undefined" && ui.state;
    if (!s || !s.session) return;
    const m = meta(s.session);
    if (s.session !== lastSession) {
      lastSession = s.session;
      m.lastOpen = new Date().toISOString();
      if (!m.created) m.created = new Date().toISOString();
      save();
    }
    if (!ui.home && !document.hidden && Date.now() - lastInput < 60000) { m.playtime = (m.playtime || 0) + 5; m.lastOpen = new Date().toISOString(); }
    autoTag(s, m);
    if (!ui.home && !window.KT2_NO_SNAP) snapPatterns(s.session, m);
    if (!ui.home) run("fileCount").then((r) => { if (r && r.name === s.session) { meta(r.name).files = r.files; save(); } }, () => {});
    save();
  }, 5000);

  // ---------------------------------------------------------------- auto tags (what the song is)
  // Words the search understands without you typing them anywhere: the key's mood, the tempo's
  // usual styles, what the lanes are (808, vocal, synth...), the instruments and the parts.
  function moodTags(p) {
    const out = [];
    const key = (p.key || "").trim();
    if (/m$|minor/i.test(key)) out.push("minor", "dark", "moody", "sad", "villain");
    else if (key) out.push("major", "bright", "happy", "uplifting");
    const b = Number(p.bpm) || 0;
    if (b) {
      if (b < 90) out.push("slow", "chill", "lofi", "ballad");
      else if (b < 115) out.push("midtempo", "hiphop", "rnb", "boombap");
      else if (b < 133) out.push("house", "dance", "club", "pop");
      else if (b < 155) out.push("trap", "drill", "rage", "hard");
      else out.push("fast", "dnb", "jungle", "hyperpop");
    }
    const lanes = (p.laneNames || []).join(" ").toLowerCase();
    if (/synth|toy ?machine|pad|lead|arp|pluck|4osc|blob|bass/.test(lanes)) out.push("electronic", "synth");
    if (/808/.test(lanes)) out.push("808", "bass", "trap");
    if (/vox|vocal|lead vox|adlib|harmony|double|voice/.test(lanes)) out.push("vocal", "vocals", "singing");
    if (/guitar/.test(lanes)) out.push("guitar");
    if (/piano|keys|rhodes/.test(lanes)) out.push("piano", "keys");
    if (/drum|kick|snare|hat|killdrum/.test(lanes)) out.push("drums");
    return out;
  }
  function autoTag(s, m) {
    const lanes = (s.tracks || []).map((t) => [t.name, t.role, t.instrument, t.kind].filter(Boolean).join(" "));
    const clips = (s.tracks || []).flatMap((t) => (t.clips || []).map((c) => c.name || "")).filter(Boolean);
    m.auto = { lanes: [...new Set(lanes)].slice(0, 60), clips: [...new Set(clips)].slice(0, 80), parts: (s.sections || []).map((x) => x.name),
               key: s.key && s.key.name || "", bpm: s.bpm || 0, at: new Date().toISOString() };
  }

  // ---------------------------------------------------------------- pattern snapshot (Eman, 4 Nov)
  // A song with no background of its own gets a small picture of its playground view (the lanes and
  // their pattern clips), used frosted and grained behind its card. The cover art stays grey.
  let snapAt = 0, snapSig = "";
  function snapPatterns(name, m) {
    const rows = document.getElementById("rows");
    if (!rows || Date.now() - snapAt < 20000) return;
    const R = rows.getBoundingClientRect();
    if (R.width < 40 || R.height < 20) return;
    const clips = [...rows.querySelectorAll(".clip")];
    const sig = clips.length + ":" + clips.map((c) => c.style.left + c.style.width + (c.style.background || c.style.backgroundColor || "")).join("|").length;
    if (sig === snapSig && m.snap) return;
    snapAt = Date.now(); snapSig = sig;
    const W = 320, Hh = Math.max(90, Math.min(220, Math.round(W * R.height / R.width)));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
    const g = cv.getContext("2d"), sx = W / R.width, sy = Hh / R.height;
    g.fillStyle = "#1b1b20"; g.fillRect(0, 0, W, Hh);
    for (const c of clips) {
      const r = c.getBoundingClientRect();
      if (r.right < R.left || r.left > R.right || r.bottom < R.top || r.top > R.bottom) continue;
      const x = (r.left - R.left) * sx, y = (r.top - R.top) * sy, w = Math.max(1, r.width * sx), h = Math.max(1, r.height * sy);
      const cs = getComputedStyle(c);
      g.fillStyle = cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : "#6c4bd8";
      g.fillRect(x, y, w, h);
      for (const k of c.querySelectorAll("canvas")) {
        const q = k.getBoundingClientRect();
        if (!k.width || !k.height || !q.width) continue;
        try { g.drawImage(k, (q.left - R.left) * sx, (q.top - R.top) * sy, q.width * sx, q.height * sy); } catch (e) {}
      }
    }
    try { m.snap = cv.toDataURL("image/jpeg", 0.6); } catch (e) {}
  }

  // ---------------------------------------------------------------- data for one card
  function view(p) {
    const m = meta(p.name), a = m.auto || {};
    const look = looks()[p.name];
    const bg = m.cover || (look && look.mode === "image" && look.image) || null;
    const laneNames = [...new Set([...(p.laneNames || []), ...(a.lanes || [])])];
    const v = {
      p, m, name: p.name, title: m.title || p.name, bpm: p.bpm || a.bpm || 0, key: p.key || a.key || "", bg,
      created: m.created || p.created || p.worked || null, lastOpen: m.lastOpen || p.worked || null, playtime: m.playtime || 0,
      status: m.status || "", notes: m.notes || "", artist: m.artist || "", folder: m.folder || "", versions: (p.versionList && p.versionList.length) ? p.versionList : (MIX[p.name] ? [{ label: "V1", urls: [MIX[p.name].url], key: "kt2.peaks:mix:" + p.name + ":" + MIX[p.name].sig }] : []), sections: p.sections || [],
      laneNames, snap: !bg && m.snap || null, words: [p.words || "", m.words || ""].join(" ").trim(),
    };
    v.tags = [...new Set([...moodTags({ ...p, key: v.key, bpm: v.bpm, laneNames }), ...(m.tags || [])])];
    return v;
  }

  // ---------------------------------------------------------------- smart search
  // Typed words are matched against everything a project knows (title, file name, notes, status,
  // key, BPM, lanes, instruments, parts, clip names, mood tags, words sung in it). Time phrases
  // ("today", "yesterday", "about a week ago", "last month", "3 days ago") narrow it by when it was
  // last open or made. Press Enter to also ask Claude to rank them, for loose questions.
  const DAY = 86400000;
  function timeWindow(q) {
    const now = Date.now();
    const n = (w) => ({ a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2, few: 3 }[w] || Number(w) || 1);
    let m;
    if (/\btoday\b/.test(q)) return { from: now - DAY, to: now, text: /\btoday\b/ };
    if (/\byesterday\b/.test(q)) return { from: now - 2 * DAY, to: now - 0.5 * DAY, text: /\byesterday\b/ };
    if ((m = q.match(/\b(?:about |around |like )?(a|an|one|two|three|four|five|six|couple|few|\d+)(?: of)? (day|week|month)s? ago\b/))) {
      const unit = { day: DAY, week: 7 * DAY, month: 30 * DAY }[m[2]], c = now - n(m[1]) * unit;
      return { from: c - unit * 0.6, to: c + unit * 0.6, text: new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) };
    }
    if ((m = q.match(/\b(this|last|past) (week|month)\b/))) {
      const unit = m[2] === "week" ? 7 * DAY : 30 * DAY;
      return m[1] === "last" ? { from: now - 2 * unit, to: now - unit * 0.5, text: new RegExp(m[0]) } : { from: now - unit, to: now, text: new RegExp(m[0]) };
    }
    if ((m = q.match(/\b(recent|recently|lately|new|newest)\b/))) return { from: now - 7 * DAY, to: now, text: new RegExp("\\b" + m[1] + "\\b"), soft: true };
    if ((m = q.match(/\b(old|older|ages ago)\b/))) return { from: 0, to: now - 14 * DAY, text: new RegExp("\\b" + m[1] + "\\b"), soft: true };
    return null;
  }
  const STOP = new Set("a an the and or with of in on it that this my i me something song project one some kind like about around was is".split(" "));
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9#]+/g, " ").trim();
  const close = (a, b) => { // one letter off is fine for longer words
    if (a === b) return true;
    if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
    return d + (a.length - i) + (b.length - j) <= 1;
  };
  function score(v, q) {
    const tw = timeWindow(q);
    let rest = q;
    if (tw) rest = rest.replace(tw.text, " ");
    const words = norm(rest).split(" ").filter((w) => w && !STOP.has(w));
    const fields = [
      [norm(v.title + " " + v.name), 6], [norm(v.artist), 5], [norm(v.notes), 4], [norm(v.status), 4], [norm(v.tags.join(" ")), 3],
      [norm(v.laneNames.join(" ")), 2], [norm((v.m.auto && v.m.auto.clips || []).join(" ")), 2], [norm(v.sections.map((x) => x.name).join(" ")), 2],
      [norm(v.words), 3], [norm(v.p.about || ""), 1],
    ].map(([t, w]) => [t.split(" "), w]);
    let sc = 0, hit = 0;
    for (const w of words) {
      let best = 0;
      // BPM and key straight: "140", "140bpm", "am", "a minor", "f#m"
      const num = Number(w.replace(/bpm$/, ""));
      if (num >= 40 && num <= 250 && v.bpm) best = Math.max(best, Math.abs(v.bpm - num) <= 2 ? 6 : Math.abs(v.bpm - num) <= 6 ? 3 : 0);
      if (v.key && norm(v.key).replace(" ", "") === w) best = Math.max(best, 6);
      for (const [toks, wt] of fields) {
        for (const t of toks) {
          if (!t) continue;
          if (t === w) { best = Math.max(best, wt); break; }
          if (w.length >= 3 && t.startsWith(w)) best = Math.max(best, wt * 0.8);
          else if (w.length >= 4 && t.includes(w)) best = Math.max(best, wt * 0.7);
          else if (close(t, w)) best = Math.max(best, wt * 0.6);
        }
      }
      if (best) hit++;
      sc += best;
    }
    if (words.length && !hit) sc = -1;
    if (tw) {
      const ts = [v.lastOpen, v.created].map((x) => Date.parse(x || "")).filter(Boolean);
      const inside = ts.some((t) => t >= tw.from && t <= tw.to);
      if (inside) sc += 5; else if (!tw.soft) sc = words.length ? sc * 0.35 - 1 : -1;
      if (!words.length && inside) sc = Math.max(sc, 5);
    }
    return sc;
  }

  // Enter: Claude ranks them too (the page's own Claude, when this viewer allowed it)
  let claudeRank = null;
  async function askClaude(q, list) {
    let sample = null;
    try { sample = window.claude && window.claude.use ? await window.claude.use("sample") : null; } catch (e) { sample = null; }
    if (!sample) return toast("Smart search with Claude isn't available here. The normal search still works.");
    const rows = list.map((v) => ({ name: v.name, title: v.title, artist: v.artist, bpm: v.bpm, key: v.key, status: v.status, notes: v.notes, tags: v.tags.slice(0, 14),
      lanes: v.laneNames.slice(0, 14), parts: v.sections.map((x) => x.name).slice(0, 12), words: v.words.slice(0, 300),
      created: v.created, lastOpen: v.lastOpen, playtimeMin: Math.round(v.playtime / 60) }));
    home.classList.add("k2h-asking");
    try {
      const out = await sample.json([{ role: "user", content:
        `Today is ${new Date().toISOString()}. A music producer is looking for one of their song projects and typed: "${q}".\n` +
        `Here are the projects as JSON:\n${JSON.stringify(rows)}\n` +
        `Return JSON {"order": [project names, best match first, only plausible ones], "why": {"name": "few plain words why"}}.` }], { modelTier: "quick" });
      if (out && Array.isArray(out.order)) { claudeRank = { q, order: out.order, why: out.why || {} }; render(true); }
    } catch (e) {
      toast(e && e.code === "not_granted" ? "Claude search needs your OK in the page's permissions." : "Claude couldn't search right now.");
    } finally { home.classList.remove("k2h-asking"); }
  }

  // ---------------------------------------------------------------- the song player (one at a time)
  // Plain <audio> through Web Audio, so QUICK MSTR can sit in the path: a gentle tilt, glue
  // compression, makeup gain and a ceiling. Preview only, never saved into the project.
  let AC = null, PL = null;
  function graph() {
    if (AC) return AC;
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const inp = AC.createGain(), dry = AC.createGain(), wet = AC.createGain();
    const low = AC.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 90; low.gain.value = 1.5;
    const air = AC.createBiquadFilter(); air.type = "highshelf"; air.frequency.value = 9000; air.gain.value = 2;
    const glue = AC.createDynamicsCompressor(); glue.threshold.value = -20; glue.ratio.value = 2.5; glue.attack.value = 0.02; glue.release.value = 0.2; glue.knee.value = 8;
    const make = AC.createGain(); make.gain.value = 2.2;
    const lim = AC.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08; lim.knee.value = 0;
    inp.connect(dry).connect(AC.destination);
    inp.connect(low).connect(air).connect(glue).connect(make).connect(lim).connect(wet).connect(AC.destination);
    AC.k = { inp, dry, wet };
    setMaster(false);
    return AC;
  }
  function setMaster(on) {
    if (!AC) return;
    const t = AC.currentTime;
    AC.k.dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.03);
    AC.k.wet.gain.setTargetAtTime(on ? 1 : 0, t, 0.03);
  }
  function stopPlayer() {
    if (!PL) return;
    PL.els.forEach((a) => { a.pause(); try { a.src = ""; } catch (e) { /* gone */ } });
    cancelAnimationFrame(PL.raf);
    if (PL.card) PL.card.classList.remove("k2h-playing");
    PL = null;
  }
  async function play(card, v, ver, at) {
    const same = PL && PL.card === card && PL.ver === ver;
    if (same && at == null) { // play/pause toggle
      if (PL.els[0].paused) { PL.els.forEach((a) => a.play().catch(() => {})); card.classList.add("k2h-playing"); }
      else { PL.els.forEach((a) => a.pause()); card.classList.remove("k2h-playing"); }
      return;
    }
    if (same && at != null) { PL.els.forEach((a) => { a.currentTime = at; }); if (PL.els[0].paused) { PL.els.forEach((a) => a.play().catch(() => {})); card.classList.add("k2h-playing"); } return; }
    stopPlayer();
    if (typeof ui !== "undefined" && ui.transport && ui.transport.playing) run("togglePlay");
    const urls = (v.versions[ver] || v.versions[0] || {}).urls || [];
    if (!urls.length) return toast(BOUNCE && BOUNCE.name === v.name ? "Still making the preview, one moment." : "This project has no mix to play yet. Open it to work on it.");
    graph();
    if (AC.state === "suspended") AC.resume();
    const els = urls.map((u) => { const a = new Audio(u); a.crossOrigin = "anonymous"; a.preload = "auto"; AC.createMediaElementSource(a).connect(AC.k.inp); return a; });
    PL = { card, ver, els, raf: 0 };
    const msx = card.querySelector(".k2h-mstr input"); setMaster(!!(msx && msx.checked));
    card.classList.add("k2h-playing");
    if (at != null) els.forEach((a) => a.addEventListener("loadedmetadata", () => { a.currentTime = at; }, { once: true }));
    els.forEach((a) => a.play().catch(() => {}));
    els[0].addEventListener("ended", () => { if (PL && PL.els === els) { card.classList.remove("k2h-playing"); } });
    const head = card.querySelector(".k2h-head"), time = card.querySelector(".k2h-time");
    const tick = () => {
      if (!PL || PL.els !== els) return;
      const a = els[0], d = a.duration || v.p.length || 1;
      head.style.left = (100 * (a.currentTime || 0) / d) + "%";
      time.textContent = clock(a.currentTime || 0) + " / " + clock(d);
      PL.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  const clock = (s) => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };

  // ---------------------------------------------------------------- previews of projects made here
  // A project made in this browser has no mix file, so when you come back to this page the engine
  // quietly plays it once with the speakers off and records it (bounceMix in playground.js). The
  // WAV is kept in this browser (IndexedDB "kt2-mix"), with a signature of what was in the project;
  // it is made again only after something changed (Eman, 1 Nov: "even if its just a few chords").
  const MIX = {};
  let BOUNCE = null;
  const idb = () => new Promise((ok, no) => {
    try {
      const r = indexedDB.open("kt2-mix", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("mix");
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    } catch (e) { no(e); }
  });
  async function mixPut(name, rec) {
    try { const db = await idb(); db.transaction("mix", "readwrite").objectStore("mix").put(rec, name); } catch (e) { /* private window: keep it for now */ }
  }
  async function mixLoad() {
    try {
      const db = await idb();
      await new Promise((ok) => {
        const st = db.transaction("mix").objectStore("mix"), req = st.openCursor();
        req.onsuccess = () => {
          const cur = req.result; if (!cur) return ok();
          const r = cur.value; if (r && r.wav) MIX[cur.key] = { sig: r.sig, seconds: r.seconds, url: URL.createObjectURL(r.wav) };
          cur.continue();
        };
        req.onerror = () => ok();
      });
    } catch (e) { /* none */ }
  }
  mixLoad().then(() => { if (Object.keys(MIX).length && typeof ui !== "undefined" && ui.home) render(true); });
  async function bounceOpen() {
    if (BOUNCE || !(typeof ui !== "undefined" && ui.home)) return;
    const s = await run("bounceMix", { sigOnly: true });
    if (!s || !s.ok || s.empty || !s.name) return;
    const proj = ((ui.state && ui.state.projects) || []).find((p) => p.name === s.name);
    if (!proj || !proj.made) return;                       // the built-in songs have their own mix files
    if (MIX[s.name] && MIX[s.name].sig === s.sig) return;  // nothing changed since the last preview
    BOUNCE = { name: s.name, bar: null };
    render(true);
    const watch = setInterval(async () => {
      const p = await run("bounceProgress");
      if (p && BOUNCE && BOUNCE.bar) BOUNCE.bar.style.width = Math.round(p.progress * 100) + "%";
    }, 400);
    const r = await run("bounceMix", {});
    clearInterval(watch);
    BOUNCE = null;
    if (r && r.ok && r.wav) {
      if (MIX[r.name]) URL.revokeObjectURL(MIX[r.name].url);
      MIX[r.name] = { sig: r.sig, seconds: r.seconds, url: URL.createObjectURL(r.wav) };
      mixPut(r.name, { sig: r.sig, seconds: r.seconds, wav: r.wav });
    }
    if (typeof ui !== "undefined" && ui.home) render(true);
  }

  // ---------------------------------------------------------------- waveforms (decoded once, kept)
  const PEAKS = new Map();
  const peakKey = (urls) => "kt2.peaks:" + urls.join("|");
  async function peaksOf(urls, key) {
    const k = key || peakKey(urls);
    if (PEAKS.has(k)) return PEAKS.get(k);
    const job = (async () => {
      try { const c = JSON.parse(localStorage.getItem(k) || "null"); if (c && c.p) return c; } catch (e) { /* none yet */ }
      const N = 900, sum = new Float32Array(N);
      let dur = 0;
      const ctx = new OfflineAudioContext(1, 1, 44100);
      for (const u of urls) {
        const buf = await ctx.decodeAudioData(await (await fetch(u)).arrayBuffer());
        dur = Math.max(dur, buf.duration);
        const ch = buf.getChannelData(0), step = Math.max(1, Math.floor(ch.length / N));
        for (let i = 0; i < N; i++) { let mx = 0; const o = i * step; for (let j = 0; j < step; j += 4) { const x = Math.abs(ch[o + j] || 0); if (x > mx) mx = x; } sum[i] += mx; }
      }
      let top = 0; for (const x of sum) top = Math.max(top, x);
      const out = { p: Array.from(sum, (x) => Math.round((x / (top || 1)) * 100)), d: dur, t: Math.min(1, Math.round(top * 1000) / 1000) };
      try { localStorage.setItem(k, JSON.stringify(out)); } catch (e) { /* no room: keep it in memory */ }
      return out;
    })();
    PEAKS.set(k, job);
    return job;
  }
  function drawWave(cv, pk, v) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, Hh = cv.clientHeight;
    if (!W || !Hh) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    const mid = Hh / 2;
    if (!pk) { if (v.versions.length) { g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, mid, W, 1); } return; }
    const bars = Math.floor(W / 3), n = pk.p.length;
    // Bars show the real level (headroom left at the top). With QUICK MSTR on, the part it adds
    // is drawn in red on top of the plain bar, so you can see how much louder it gets
    // (Eman, 1 Nov). The curve is a rough picture of the chain: +6.8 dB, squashed near the top.
    const top = pk.t || 0.95, half = Hh / 2 - 2, on = !!(v.m && v.m.mstr);
    const hi = "#ff3b4e";   // the mastering extra is red on every card (Eman, 1 Nov)
    const louder = (x) => Math.min(0.98, Math.tanh(x * 2.2) / Math.tanh(2.2) * 0.98);
    for (let i = 0; i < bars; i++) {
      const a = Math.floor((i / bars) * n), b = Math.max(a + 1, Math.floor(((i + 1) / bars) * n));
      let mx = 0; for (let j = a; j < b; j++) mx = Math.max(mx, pk.p[j]);
      const x = (mx / 100) * top;
      const h = Math.max(1, x * 0.8 * half);
      if (on) {
        const hm = Math.max(h, louder(x) * half);
        g.fillStyle = hi; g.fillRect(i * 3, mid - hm, 2, hm * 2);
      }
      g.fillStyle = on ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.78)";
      g.fillRect(i * 3, mid - h, 2, h * 2);
    }
    // the parts as thin colour lines with their names
    const d = pk.d || v.p.length || 1;
    const cols = ["#a77bff", "#5b8cff", "#3ed6c0", "#ff6fae", "#7fe0ff", "#e86bff", "#ff5a6a"];
    v.sections.forEach((x, i) => {
      const xx = (x.t / d) * W;
      if (!(xx >= 0 && xx < W)) return;
      g.fillStyle = x.color || cols[i % cols.length];
      g.fillRect(Math.round(xx), 0, 1.5, Hh);
      g.font = "700 8.5px 'Martian Mono', monospace";
      g.fillText(String(x.name || "").toUpperCase(), xx + 4, 9);
    });
  }

  // ---------------------------------------------------------------- covers
  function readCover(file, cb) {
    if (!file || !/^image\//.test(file.type)) return toast("Drop a picture (jpg, png, webp) to use as cover art.");
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const S = 360, c = document.createElement("canvas"); c.width = c.height = S;
      const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      c.getContext("2d").drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      URL.revokeObjectURL(url);
      cb(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("That picture couldn't be read.", true); };
    img.src = url;
  }

  // ---------------------------------------------------------------- layout
  home.innerHTML = "";
  const bar = H("div", "home-bar");
  bar.innerHTML = `<button class="logo" id="home-logo" title="Right-click for settings"><img src="logo.png" alt="KILLTOY"></button>
    <span class="home-crumb">All projects</span>
    <button class="home-back" id="home-back" hidden>Back to <b id="home-back-name"></b> &rarr;</button>`;
  const shell = H("div", "k2h-shell");
  const side = H("aside", "k2h-side");
  const main = H("div", "k2h-main");
  shell.append(side, main);
  home.append(bar, shell);
  // hidden bits app.js still writes to
  const ghost = H("div"); ghost.hidden = true;
  ghost.innerHTML = `<span id="home-title-t"></span><span id="home-count"></span><div id="home-rows"></div><div id="home-making"></div>
    <button id="home-tab-projects"><sup></sup></button><button id="home-tab-remakes"><sup></sup></button><button id="home-new"></button><div class="home-new"></div>`;
  home.append(ghost);
  bar.querySelector("#home-logo").onclick = (e) => { e.stopPropagation(); if (!bar.querySelector("#home-back").hidden) showHome(false); };
  bar.querySelector("#home-logo").oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); if (typeof toggleSettings === "function") toggleSettings(); };
  bar.querySelector("#home-back").onclick = () => showHome(false);

  side.innerHTML = `
    <button class="k2h-newp" id="k2h-newp">+ New project</button>
    <div class="k2h-lbl">Sort</div>
    <div class="k2h-sort" id="k2h-sort"></div>
    <div class="k2h-search"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l5 5" stroke="currentColor" stroke-width="2"/></svg>
      <input id="k2h-q" type="search" placeholder="Search anything: a word, 140, Am, about a week ago dark..." autocomplete="off" spellcheck="false"></div>
    <div class="k2h-qhint" id="k2h-qhint">Enter: ask Claude to rank them too</div>
    <div class="k2h-lbl">Folders <button class="k2h-addf" id="k2h-addf" title="New folder">+</button></div>
    <div class="k2h-folders" id="k2h-folders"></div>
    <div class="k2h-tip">Drag a project's cover onto a folder to put it there. Drop a picture on a cover to change it. Double-click a title to rename it.</div>`;
  const qIn = side.querySelector("#k2h-q");
  let Q = "", FOLDER = "all";
  qIn.addEventListener("input", () => { Q = qIn.value; claudeRank = null; render(true); });
  qIn.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && Q.trim()) askClaude(Q.trim(), current.map(view));
    if (e.key === "Escape") { qIn.value = ""; Q = ""; claudeRank = null; render(true); qIn.blur(); }
  });
  const SORTS = [["last", "Last opened"], ["bpm", "BPM"], ["key", "Key"], ["created", "Created"], ["title", "Title A-Z"], ["custom", "Custom"]];
  const sortBox = side.querySelector("#k2h-sort");
  for (const [id, label] of SORTS) {
    const b = H("button", null, label); b.dataset.s = id;
    b.onclick = () => { DB.sort = id; save(); render(true); };
    sortBox.append(b);
  }
  side.querySelector("#k2h-newp").onclick = () => run("newSession").then((r) => r && r.ok && showHome(false));
  side.querySelector("#k2h-addf").onclick = () => {
    const f = { id: "f" + Date.now().toString(36), name: "New folder" };
    DB.folders.push(f); save(); FOLDER = f.id; render(true);
    requestAnimationFrame(() => { const n = side.querySelector(`[data-f="${f.id}"] .k2h-fname`); if (n) rename(n, f); });
  };
  function rename(node, f) {
    node.contentEditable = "true"; node.focus();
    document.getSelection().selectAllChildren(node);
    const done = () => { node.contentEditable = "false"; f.name = node.textContent.trim().slice(0, 40) || f.name; save(); render(true); };
    node.addEventListener("blur", done, { once: true });
    node.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); node.blur(); } if (e.key === "Escape") { node.textContent = f.name; node.blur(); } });
  }

  // ---------------------------------------------------------------- render
  let current = [], sig = "";
  window.renderHome = renderHome = function () {
    const s = ui.state;
    if (!ui.home || !s || !s.projects) return;
    const back = bar.querySelector("#home-back"), here = s.projects.find((p) => p.name === s.session);
    back.hidden = !here; bar.querySelector("#home-back-name").textContent = here ? (meta(here.name).title || here.name) : "";
    current = s.projects.filter((p) => !p.making);
    const nsig = JSON.stringify([current.map((p) => [p.name, p.versions, p.bpm, p.key]), s.session]);
    render(nsig !== sig);
    sig = nsig;
  };

  function sorted(list) {
    const by = DB.sort, t = (x) => Date.parse(x || "") || 0;
    const keyNum = (k) => { const m = /^([A-G])(#|b)?/.exec(k || ""); if (!m) return 99; const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]; return (base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12 + (/m$|minor/i.test(k) ? 0.5 : 0); };
    const f = { last: (a, b) => t(b.lastOpen) - t(a.lastOpen), bpm: (a, b) => (a.bpm || 999) - (b.bpm || 999), key: (a, b) => keyNum(a.key) - keyNum(b.key),
                created: (a, b) => t(b.created) - t(a.created), title: (a, b) => a.title.localeCompare(b.title),
                // CUSTOM (Eman, 1 Nov): the order you dragged them into; new ones go last, newest first
                custom: (a, b) => { const o = DB.order || [], i = o.indexOf(a.name), j = o.indexOf(b.name); return (i < 0 ? 1e6 : i) - (j < 0 ? 1e6 : j) || t(b.lastOpen) - t(a.lastOpen); } }[by] || (() => 0);
    return [...list].sort(f);
  }

  function render(full) {
    if (!ui.home) return;
    for (const b of sortBox.children) b.classList.toggle("on", b.dataset.s === DB.sort);
    let vs = current.map(view);
    // folders
    const fbox = side.querySelector("#k2h-folders");
    fbox.replaceChildren();
    const recentCut = Date.now() - 7 * DAY;
    const groups = [["all", "All projects", vs.length], ["recent", "Recent (7 days)", vs.filter((v) => Date.parse(v.lastOpen || "") > recentCut).length],
      ...statuses().map((st) => ["status:" + st, st, vs.filter((v) => v.status === st).length]).filter((g) => g[2]),
      ...DB.folders.map((f) => [f.id, f.name, vs.filter((v) => v.folder === f.id).length, f])];
    for (const [id, name, n, f] of groups) {
      const b = H("button", "k2h-folder" + (FOLDER === id ? " on" : "") + (f ? " own" : "") + (id.startsWith("status:") ? " st" : ""));
      b.dataset.f = id;
      const nm = H("span", "k2h-fname", name);
      b.append(f ? H("i", "k2h-ficon") : H("i", "k2h-ficon sys"), nm, H("small", null, String(n)));
      b.onclick = () => { if (FOLDER === id || nm.isContentEditable) return; FOLDER = id; render(true); };
      if (f) {
        // drag a folder up or down to put it anywhere in the list (Eman, 1 Nov)
        b.draggable = true;
        b.addEventListener("dragstart", (e) => { if (nm.isContentEditable) { e.preventDefault(); return; } e.dataTransfer.setData("text/x-k2folder", f.id); e.dataTransfer.effectAllowed = "move"; });
        const fSide = (e) => { const r = b.getBoundingClientRect(); return e.clientY > r.top + r.height / 2 ? "after" : "before"; };
        b.addEventListener("dragover", (e) => { if (!e.dataTransfer.types.includes("text/x-k2folder")) return; e.preventDefault(); b.dataset.ins = fSide(e); });
        b.addEventListener("dragleave", () => delete b.dataset.ins);
        b.addEventListener("drop", (e) => {
          const fid = e.dataTransfer.getData("text/x-k2folder"); delete b.dataset.ins;
          if (!fid) return; e.preventDefault(); e.stopPropagation();
          const moving = DB.folders.find((x) => x.id === fid); if (!moving || moving === f) return;
          DB.folders = DB.folders.filter((x) => x !== moving);
          DB.folders.splice(DB.folders.indexOf(f) + (fSide(e) === "after" ? 1 : 0), 0, moving);
          save(); render(true);
        });
        b.ondblclick = (e) => { e.preventDefault(); rename(nm, f); };
        b.oncontextmenu = (e) => {
          e.preventDefault();
          if (b.dataset.sure) { DB.folders = DB.folders.filter((x) => x !== f); for (const k in DB.projects) if (DB.projects[k].folder === f.id) delete DB.projects[k].folder; if (FOLDER === f.id) FOLDER = "all"; save(); render(true); return; }
          b.dataset.sure = "1"; nm.textContent = "Right-click again to delete"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; nm.textContent = f.name; } }, 2200);
        };
        // drop a project here
        b.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/x-k2proj")) { e.preventDefault(); b.classList.add("drop"); } });
        b.addEventListener("dragleave", () => b.classList.remove("drop"));
        b.addEventListener("drop", (e) => { const nmP = e.dataTransfer.getData("text/x-k2proj"); if (!nmP) return; e.preventDefault(); b.classList.remove("drop"); if (nmP) { meta(nmP).folder = f.id; save(); render(true); toast(`Moved to ${f.name}.`); } });
      }
      if (id === "all") {
        b.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/x-k2proj")) { e.preventDefault(); b.classList.add("drop"); } });
        b.addEventListener("dragleave", () => b.classList.remove("drop"));
        b.addEventListener("drop", (e) => { e.preventDefault(); b.classList.remove("drop"); const nmP = e.dataTransfer.getData("text/x-k2proj"); if (nmP) { delete meta(nmP).folder; save(); render(true); } });
      }
      fbox.append(b);
    }
    // which projects
    if (FOLDER === "recent") vs = vs.filter((v) => Date.parse(v.lastOpen || "") > recentCut);
    else if (FOLDER.startsWith("status:")) vs = vs.filter((v) => v.status === FOLDER.slice(7));
    else if (FOLDER !== "all") vs = vs.filter((v) => v.folder === FOLDER);
    const q = Q.trim().toLowerCase();
    main.replaceChildren();
    if (q) {
      let ranked = vs.map((v) => [v, score(v, q)]).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).map(([v]) => v);
      if (claudeRank && claudeRank.q.toLowerCase() === q) {
        const pos = (n) => { const i = claudeRank.order.indexOf(n); return i < 0 ? 999 : i; };
        const named = vs.filter((v) => pos(v.name) < 999);
        ranked = [...named.sort((a, b) => pos(a.name) - pos(b.name)), ...ranked.filter((v) => pos(v.name) === 999)];
      }
      section(claudeRank ? "Claude's best guesses" : "Found", ranked, true);
      if (!ranked.length) main.append(H("div", "k2h-none", "Nothing matches yet. Try a word from the song, a tempo (140), a key (Am), or press Enter to ask Claude."));
    } else if (FOLDER === "all") {
      // RECENT (Eman, 1 Nov): no OPENED section any more. The project you're in is simply the
      // first recent one; the label says when the last one was opened.
      const curName = ui.state && ui.state.session;
      const byOpen = (a, b) => (b.name === curName) - (a.name === curName) || (Date.parse(b.lastOpen || "") || 0) - (Date.parse(a.lastOpen || "") || 0);
      const showRecent = DB.sort === "last" && vs.length > 4;
      const recent = [...vs].sort(byOpen).slice(0, 3);
      const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (!(m >= 0)) return ""; if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago"); return when(iso); };
      const lastTxt = recent[0] && recent[0].lastOpen ? ago(recent[0].lastOpen) : "";
      if (DB.view === "grid") {
        // COVERS: one continuous grid that fills every row; RECENT over the first one
        const flow = showRecent ? [...recent, ...sorted(vs.filter((v) => !recent.includes(v)))] : sorted(vs);
        section("All projects", flow);
        if (showRecent) { const r0 = main.querySelector(".k2h-sec:last-child > .k2h-card"); if (r0) r0.dataset.openedLabel = "RECENT" + (lastTxt ? "  \u00b7  " + lastTxt.toUpperCase() : ""); }
        return;
      }
      const all = sorted(vs);
      if (showRecent) {
        section("Recent", recent);
        if (lastTxt) { const sm = main.querySelector(".k2h-sec:last-child .k2h-sech small"); if (sm) sm.after(H("em", "k2h-when", lastTxt)); }
      }
      for (const f of DB.folders) { const inF = all.filter((v) => v.folder === f.id); if (inF.length) section(f.name, inF, false, f); }
      const loose = all.filter((v) => !v.folder && !(showRecent && recent.includes(v)));
      if (loose.length) section(DB.folders.length ? "Not in a folder" : showRecent ? "Everything else" : "All projects", loose);
    } else {
      const g = groups.find((x) => x[0] === FOLDER);
      section(g ? g[1] : "Projects", sorted(vs));
      if (!vs.length) main.append(H("div", "k2h-none", FOLDER.startsWith("f") ? "Empty folder. Drag a project's cover here from All projects." : "Nothing here yet."));
    }
  }

  // - / + on the first section line: cards get smaller step by step; past the first step two (then
  // three) go on each line. The last size used is kept (Eman, 1 Nov).
  const ZMAX = 3;
  const zMin = () => (DB.view === "grid" ? -2 : 0);
  const zMax = () => 2; // COVERS: smallest step dropped; WAVEFORMS: always one card per line (Eman, 1 Nov)
  const setZoom = (z) => { DB[zKey()] = Math.max(zMin(), Math.min(zMax(), z)); save(); home.dataset.z = zNow(); render(true); };
  function zoomCtl() {
    const z = H("div", "k2h-zoom");
    const minus = H("button", null, "-"), plus = H("button", null, "+"), lvl = H("i");
    minus.title = "Smaller cards (more on each line)"; plus.title = "Bigger cards";
    const cur = zNow();
    for (let i = zMax(); i >= zMin(); i--) lvl.append(H("b", cur <= i ? "on" : null));
    minus.disabled = cur >= zMax(); plus.disabled = cur <= zMin();
    minus.onclick = () => setZoom(cur + 1); plus.onclick = () => setZoom(cur - 1);
    z.append(minus, lvl, plus);
    // WAVEFORMS | COVERS (Eman, 1 Nov): covers = just the art, title, artist and a play button
    const vw = H("div", "k2h-view");
    const wv = H("button", (DB.view || "wave") === "wave" ? "on" : null), sq = H("button", DB.view === "grid" ? "on" : null);
    wv.title = "Waveforms: every project with its info and waveform"; sq.title = "Covers: just the cover art, title and a play button";
    wv.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="butt"/></svg>`;
    sq.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="currentColor"/></svg>`;
    wv.onclick = () => { DB.view = "wave"; save(); home.dataset.view = "wave"; home.dataset.z = zNow(); render(true); };
    sq.onclick = () => { DB.view = "grid"; save(); home.dataset.view = "grid"; home.dataset.z = zNow(); render(true); };
    vw.append(wv, sq);
    const box = H("div", "k2h-ctl"); box.append(vw, z);
    return box;
  }
  function section(name, list, search, folder) {
    if (!list.length) return;
    const sec = H("section", "k2h-sec");
    const h = H("div", "k2h-sech");
    h.append(H("span", null, name), H("small", null, String(list.length)));
    if (!main.querySelector(".k2h-ctl")) h.append(zoomCtl());
    sec.append(h);
    if (folder) { // a folder box takes drops too
      sec.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/x-k2proj")) { e.preventDefault(); sec.classList.add("drop"); } });
      sec.addEventListener("dragleave", (e) => { if (!sec.contains(e.relatedTarget)) sec.classList.remove("drop"); });
      sec.addEventListener("drop", (e) => { e.preventDefault(); sec.classList.remove("drop"); const n = e.dataTransfer.getData("text/x-k2proj"); if (n) { meta(n).folder = folder.id; save(); render(true); } });
    }
    for (const v of list) sec.append(card(v, search));
    main.append(sec);
  }

  const when = (iso) => {
    const t = Date.parse(iso || "");
    if (!t) return "—";
    const d = new Date(t), now = new Date();
    const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return "Today " + hm;
    if (d.toDateString() === new Date(Date.now() - DAY).toDateString()) return "Yesterday " + hm;
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" }) + " " + hm;
  };
  const playtimeText = (s) => (s < 60 ? (s ? "<1 min" : "0 min") : s < 3600 ? Math.round(s / 60) + " min" : (s / 3600).toFixed(s < 36000 ? 1 : 0) + " h");

  function card(v, search) {
    const c = H("article", "k2h-card" + (v.bg ? " pic" : v.snap ? " pic snap" : "") + (v.name === (ui.state && ui.state.session) ? " open" : ""));
    if (v.bg || v.snap) c.style.setProperty("--k2h-bg", `url("${v.bg || v.snap}")`);
    c.dataset.name = v.name;
    // drag a song onto another to put it there: the sort becomes CUSTOM and keeps it (Eman, 1 Nov)
    const cSide = (e) => { const r = c.getBoundingClientRect(); return DB.view === "grid" ? (e.clientX > r.left + r.width / 2 ? "after" : "before") : (e.clientY > r.top + r.height / 2 ? "after" : "before"); };
    c.addEventListener("dragover", (e) => { if (!e.dataTransfer.types.includes("text/x-k2proj") || e.dataTransfer.types.includes("Files")) return; e.preventDefault(); c.dataset.ins = cSide(e); });
    c.addEventListener("dragleave", (e) => { if (!c.contains(e.relatedTarget)) delete c.dataset.ins; });
    c.addEventListener("drop", (e) => {
      const nmP = e.dataTransfer.getData("text/x-k2proj"); const side = cSide(e); delete c.dataset.ins;
      if (!nmP) return; e.preventDefault(); e.stopPropagation();
      if (nmP === v.name) return;
      const shown = [...new Set([...main.querySelectorAll(".k2h-card")].map((x) => x.dataset.name))];
      const order = [...new Set([...shown, ...(DB.order || []), ...current.map((p) => p.name)])].filter((n) => n !== nmP);
      order.splice(order.indexOf(v.name) + (side === "after" ? 1 : 0), 0, nmP);
      DB.order = order; DB.sort = "custom"; save(); render(true);
    });
    // cover + title under it
    const left = H("div", "k2h-left");
    const cov = H("div", "k2h-cover");
    // Eman, 1 Nov: clicking the cover opens the project (cover or not); the small picture button
    // in its corner picks cover art, and a picture can be dropped onto it (or onto the cover)
    cov.title = "Open the project. Drag onto a folder to file it.";
    if (v.bg) cov.style.backgroundImage = `url("${v.bg}")`;
    const picBtn = H("button", "k2h-pic");
    picBtn.title = "Cover art: click to pick a picture, or drop one here";
    picBtn.innerHTML = `<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>`;
    picBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const f = H("input"); f.type = "file"; f.accept = "image/*";
      f.onchange = () => f.files[0] && readCover(f.files[0], (url) => { meta(v.name).cover = url; save(); render(true); });
      f.click();
    });
    picBtn.addEventListener("dblclick", (e) => e.stopPropagation());
    // Eman, 1 Nov: a thin strip under the cover, never over the picture
    picBtn.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); cov.classList.add("drop"); } });
    picBtn.addEventListener("dragleave", () => cov.classList.remove("drop"));
    picBtn.addEventListener("drop", (e) => {
      if (!e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation(); cov.classList.remove("drop");
      readCover(e.dataTransfer.files[0], (url) => { meta(v.name).cover = url; save(); render(true); });
    });
    cov.draggable = true;
    cov.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/x-k2proj", v.name); e.dataTransfer.effectAllowed = "move"; home.classList.add("k2h-dragging"); });
    cov.addEventListener("dragend", () => home.classList.remove("k2h-dragging"));
    cov.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); cov.classList.add("drop"); } });
    cov.addEventListener("dragleave", () => cov.classList.remove("drop"));
    cov.addEventListener("drop", (e) => {
      if (!e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation(); cov.classList.remove("drop");
      readCover(e.dataTransfer.files[0], (url) => { meta(v.name).cover = url; save(); render(true); });
    });
    cov.addEventListener("click", () => { stopPlayer(); openProject(v.name); });
    cov.addEventListener("contextmenu", (e) => { if (!v.m.cover) return; e.preventDefault(); delete meta(v.name).cover; save(); render(true); toast("Cover removed."); });
    const title = H("div", "k2h-title", v.title);
    title.title = "Double-click to rename the song (the project file keeps its name)";
    title.ondblclick = () => {
      title.contentEditable = "true"; title.focus(); document.getSelection().selectAllChildren(title);
      title.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); title.blur(); } }, { once: false });
      title.addEventListener("blur", () => { title.contentEditable = "false"; const t = title.textContent.trim(); if (t && t !== v.name) meta(v.name).title = t.slice(0, 80); else delete meta(v.name).title; save(); render(true); }, { once: true });
    };
    // ARTIST / FEAT: the line under the title, like a player shows it
    const artist = H("input", "k2h-artist");
    artist.placeholder = "Artist / feat.";
    artist.value = v.artist;
    artist.title = "Who it's by, and any features (e.g. Eman feat. Reyn). Search finds it.";
    artist.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") artist.blur(); });
    artist.addEventListener("change", () => { const t = artist.value.trim().slice(0, 80); if (t) meta(v.name).artist = t; else delete meta(v.name).artist; save(); });
    const file = H("div", "k2h-file", v.name + (v.p.remake ? " · remake" : ""));
    cov.append(picBtn); // a little + in the cover's bottom-right corner (Eman, 1 Nov)
    left.append(cov, title, artist, file);

    // right side: info / line / wave / line / buttons
    const right = H("div", "k2h-right");
    const info = H("div", "k2h-info");
    const cell = (k, val, cls) => { const d = H("div", "k2h-cell" + (cls ? " " + cls : "")); d.append(H("span", null, k), H("b", null, val)); return d; };
    info.append(cell("BPM", v.bpm ? String(Math.round(v.bpm)) : "—"), cell("KEY", v.key || "—"), cell("PLAYTIME", playtimeText(v.playtime)),
      cell("FILES", v.m.files != null ? String(v.m.files) : v.p.fileCount ? String(v.p.fileCount) : "—"),
      cell("CREATED", when(v.created)), cell("LAST OPEN", when(v.lastOpen)));
    const st = H("button", "k2h-status" + (v.status ? " s-" + v.status.toLowerCase().replace(/\W+/g, "-") : ""));
    st.title = "Pick a status, or add your own at the bottom (right-click your own to remove it)";
    st.textContent = (v.status || "None") + " \u25be";
    if (!v.status) st.classList.add("s-none");
    const setSt = (x) => { if (x) meta(v.name).status = x; else delete meta(v.name).status; save(); render(true); };
    st.onclick = (e) => {
      e.stopPropagation();
      const had = home.querySelector(".k2h-stmenu"); if (had) { had.remove(); if (had.dataset.for === v.name) return; }
      const menu = H("div", "k2h-stmenu"); menu.dataset.for = v.name;
      const r = st.getBoundingClientRect();
      menu.style.top = r.bottom + 4 + "px"; menu.style.right = Math.max(8, innerWidth - r.right) + "px";
      const item = (label, val) => { const b = H("button", (v.status || "") === val ? "on" : null, label); if (val) b.classList.add("s-" + val.toLowerCase().replace(/\W+/g, "-")); b.onclick = (ev) => { ev.stopPropagation(); menu.remove(); setSt(val); }; return b; };
      menu.append(item("None", ""));
      for (const x of statuses()) {
        const b = item(x, x);
        if ((DB.statuses || []).includes(x)) b.oncontextmenu = (ev) => { ev.preventDefault(); ev.stopPropagation(); DB.statuses = DB.statuses.filter((y) => y !== x); for (const k in DB.projects) if (DB.projects[k].status === x) delete DB.projects[k].status; save(); menu.remove(); render(true); };
        menu.append(b);
      }
      const add = H("input", "k2h-stadd"); add.placeholder = "+ New status";
      add.addEventListener("click", (ev) => ev.stopPropagation());
      add.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Escape") menu.remove();
        if (ev.key !== "Enter") return;
        const t = add.value.trim().slice(0, 24); if (!t) return;
        if (!statuses().includes(t)) DB.statuses = [...(DB.statuses || []), t];
        menu.remove(); setSt(t);
      });
      menu.append(add);
      home.append(menu);
      const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("pointerdown", close, true); } };
      setTimeout(() => document.addEventListener("pointerdown", close, true));
    };
    const stc = H("div", "k2h-cell k2h-stcell"); stc.append(H("span", null, "STATUS"), st);
    info.append(stc);
    const notes = H("input", "k2h-notes");
    notes.placeholder = "+ Add a note";
    notes.value = v.notes;
    notes.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") notes.blur(); });
    notes.addEventListener("change", () => { meta(v.name).notes = notes.value.slice(0, 200); save(); });
    const wave = H("div", "k2h-wave");
    const cv = H("canvas");
    const headLine = H("i", "k2h-head");
    wave.append(cv, headLine);
    const urls = (v.versions[0] || {}).urls || [];
    if (BOUNCE && BOUNCE.name === v.name) {
      const bar = H("span", "k2h-wbounce"); bar.innerHTML = `<b>MAKING A PREVIEW</b><i><s></s></i>`;
      wave.append(bar); BOUNCE.bar = bar.querySelector("s");
    } else if (!urls.length) wave.append(H("span", "k2h-wempty", v.p.made ? "Empty so far. Put something on the playground and it shows up here." : "No mix to show yet."));
    let pk = null;
    const paint = () => drawWave(cv, pk, v);
    if (urls.length) {
      const io = new IntersectionObserver((es) => {
        if (!es.some((x) => x.isIntersecting)) return;
        io.disconnect();
        wave.classList.add("loading");
        peaksOf(urls, (v.versions[0] || {}).key).then((p) => { pk = p; wave.classList.remove("loading"); paint(); time.textContent = clock(p.d || v.p.length); }, () => { wave.classList.remove("loading"); });
      });
      io.observe(wave);
    }
    requestAnimationFrame(paint);
    new ResizeObserver(paint).observe(wave);
    wave.addEventListener("click", (e) => {
      if (!urls.length) return;
      const r = wave.getBoundingClientRect(), d = (pk && pk.d) || v.p.length || 0;
      play(c, v, PL && PL.card === c ? PL.ver : 0, Math.max(0, (e.clientX - r.left) / r.width) * d);
    });
    const btns = H("div", "k2h-btns");
    const pb = H("button", "k2h-b k2h-play");
    pb.innerHTML = `<svg class="pl" viewBox="0 0 24 24" width="12" height="12"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg><svg class="pa" viewBox="0 0 24 24" width="12" height="12"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>`;
    pb.title = "Play / pause the song";
    pb.onclick = () => play(c, v, PL && PL.card === c ? PL.ver : 0);
    const time = H("span", "k2h-time", v.p.length ? clock(v.p.length) : "—");
    const ms = H("label", "k2h-b k2h-mstr");
    ms.title = "QUICK MSTR: hear it louder, roughly how it would sound mastered. Only for listening here, nothing is added to the project.";
    ms.innerHTML = `<input type="checkbox"><i></i><span>QUICK MSTR</span>`;
    const msIn = ms.querySelector("input");
    msIn.checked = !!v.m.mstr;
    msIn.onchange = () => { meta(v.name).mstr = msIn.checked; v.m.mstr = msIn.checked; save(); paint(); if (PL && PL.card === c) setMaster(msIn.checked); };
    const vers = H("div", "k2h-vers");
    // Versions: as many pills as fit on the row (newest kept); the oldest ones go under MORE,
    // so OPEN PROJECT is never pushed to a new line (Eman, 1 Nov).
    let pickVer = 0;
    const more = H("button", "k2h-b k2h-vmorebtn", "MORE");
    more.hidden = true;
    const pills = [];
    const label = (x, i) => x.label || "V" + (i + 1);
    const pick = (i) => {
      pickVer = i;
      pills.forEach((y, k) => y.classList.toggle("on", k === i));
      more.classList.toggle("on", pills[i] && pills[i].hidden);
      more.textContent = pills[i] && pills[i].hidden ? "MORE: " + label(v.versions[i], i) : "MORE";
      play(c, v, i, 0);
    };
    if (v.versions.length > 1) {
      vers.append(more);
      v.versions.forEach((x, i) => {
        const b = H("button", "k2h-b k2h-v" + (i === 0 ? " on" : ""), label(x, i));
        b.title = "Play " + label(x, i);
        b.onclick = () => pick(i);
        pills.push(b); vers.append(b);
      });
      more.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll(".k2h-vpop").forEach((x) => x.remove());
        const pop = H("div", "k2h-vpop");
        pills.forEach((b, i) => {
          if (!b.hidden) return;
          const o = H("button", i === pickVer ? "on" : null, label(v.versions[i], i));
          o.onclick = (ev) => { ev.stopPropagation(); pop.remove(); pick(i); };
          pop.append(o);
        });
        more.append(pop);
        setTimeout(() => document.addEventListener("click", () => pop.remove(), { once: true }), 0);
      };
      const fit = () => {
        pills.forEach((b) => { b.hidden = false; }); more.hidden = true;
        let k = 0;
        while (btns.scrollWidth > btns.clientWidth + 1 && k < pills.length - 1) { pills[k].hidden = true; more.hidden = false; k++; }
        if (!more.hidden && btns.scrollWidth > btns.clientWidth + 1 && k < pills.length) { pills[k].hidden = true; k++; }
        more.classList.toggle("on", !!(pills[pickVer] && pills[pickVer].hidden));
        more.textContent = pills[pickVer] && pills[pickVer].hidden ? "MORE: " + label(v.versions[pickVer], pickVer) : "MORE";
      };
      requestAnimationFrame(fit);
      new ResizeObserver(() => fit()).observe(c);
    }
    if (v.p.versions > v.versions.length && v.p.versions > 1) vers.append(H("span", "k2h-vmore", `+${v.p.versions - v.versions.length} saved here`));
    const isOpen = v.name === (ui.state && ui.state.session);
    const open = H("button", "k2h-b k2h-open");
    open.innerHTML = isOpen ? "CONTINUE" : `<span class="k2h-ol">OPEN PROJECT</span><span class="k2h-os">OPEN</span>`;
    open.title = isOpen ? "Go back into this project, right where you left it" : "Open this project";
    open.onclick = () => { stopPlayer(); openProject(v.name); };
    btns.append(pb, time, ms, vers, H("span", "k2h-gap"), open);
    right.append(info, notes, H("hr"), wave, H("hr"), btns);
    if (search && claudeRank && claudeRank.why && claudeRank.why[v.name]) right.append(H("div", "k2h-why", "Claude: " + claudeRank.why[v.name]));
    c.append(H("div", "k2h-bgl"), left, right);
    // click anywhere on the card opens it, except the numbers, buttons, waveform and text fields (Eman, 1 Nov)
    c.addEventListener("click", (e) => {
      if (DB.view === "grid" || home.querySelector(".k2h-stmenu")) return;
      if (e.target.closest("button, input, select, a, canvas, .k2h-wave, .k2h-info, .k2h-title, .k2h-artist, .k2h-notes, .k2h-vpop, [contenteditable='true']")) return;
      if (getSelection && String(getSelection()).length) return;
      stopPlayer(); openProject(v.name);
    });
    return c;
  }

  // stop the player when leaving the page
  if (typeof showHome === "function") {
    const _showHome = showHome;
    window.showHome = showHome = function (on) {
      if (!on) { stopPlayer(); if (BOUNCE) run("bounceStop"); }
      const r = _showHome(on);
      if (on) {
        run("fileCount").then((f) => { if (f && f.name && meta(f.name).files !== f.files) { meta(f.name).files = f.files; save(); if (ui.home) render(true); } }, () => {});
        setTimeout(bounceOpen, 300);
      }
      return r;
    };
  }
  setTimeout(() => { if (typeof ui !== "undefined" && ui.home) bounceOpen(); }, 1500);
})();
