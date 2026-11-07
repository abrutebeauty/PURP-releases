// KILLTOY 2: the RECORD page (the red dot in the header switch). The same song, cleaned down
// to recording vocals: the beat on top (grey), then the voice lanes with a channel column
// (name, M S R, volume, pan), their take folders open (swipe across a take to comp it in),
// COMP | LAYER and A/B on lanes with takes, a count-in "1 2 3 4" before recording, and the
// rack showing the armed lane's chain (one click adds TUNR -> VOX STACK -> SPACE).
//   COMP   the takes stay in one folder; you swipe the best parts into one comp
//   LAYER  every take gets its own lane, all playing together (stacks), each with its own pan
//   A/B    two comps per clip to compare: switching keeps what you did on the other one
// The engine half (demo) adds setLanePan, layerTakes, compAB and moveTrack to the playground
// backend, so it loads before app.js; the page half starts on DOMContentLoaded.
// Keep this file ASCII-only, like ui/.
"use strict";

window.KillToyRecord = (function () {
  // ---------------------------------------------------------------- backend (demo/playground)
  function demo(ctx) {
    const { S, handlers, changed, id } = ctx;
    S.canRecordPage = true;
    const lane = (trackId) => S.tracks.find((t) => t.id === trackId);
    const where = (clipId) => { for (const t of S.tracks) { const c = t.clips.find((x) => x.id === clipId); if (c) return { t, c }; } return null; };
    // A voice lane's pan: every clip on it (the playground pans each clip as it starts).
    handlers.setLanePan = ({ trackId, pan }) => {
      const t = lane(trackId);
      if (!t) return { error: "That lane is gone." };
      t.pan = Math.max(-1, Math.min(1, Number(pan) || 0));
      for (const c of t.clips) { if (t.pan) c.pan = t.pan; else delete c.pan; }
      changed();
      return { ok: true };
    };
    // The channel's PRODUCE switch (Eman, 31 Oct): off = the lane stays on the RECORD page only.
    handlers.setTrackOnPlayground = ({ trackId, on }) => {
      const t = lane(trackId);
      if (!t) return { error: "That lane is gone." };
      if (on === false) t.onPlayground = false; else delete t.onPlayground;
      changed();
      return { ok: true };
    };
    // LAYER: every take but the one playing gets its own lane right under this one.
    handlers.layerTakes = ({ clipId }) => {
      const w = where(clipId);
      if (!w || !(w.c.takes > 1)) return { error: "That clip has no takes to layer." };
      const { t, c } = w;
      let at = S.tracks.indexOf(t) + 1, n = 0;
      const made = [];
      for (let k = 0; k < c.takes; k++) {
        if (k === c.take) continue;
        const info = c.takeInfo && c.takeInfo[k];
        const nm = (info && info.name) || (c.takeNames && c.takeNames[k]) || `Take ${k + 1}`;
        const copy = structuredClone(c);
        copy.id = id();
        copy.name = `${c.name.replace(/\s*\(.*\)$/, "")} ${nm}`;
        copy.takes = 0; copy.take = 0; copy.comp = null; delete copy.ab; delete copy.audition; delete copy.cmp;
        if (c.takeSrc) copy.takeSrc = [structuredClone(c.takeSrc[k])];
        if (c.takeInfo) copy.takeInfo = [structuredClone(c.takeInfo[k])];
        if (c.takeNames) copy.takeNames = [c.takeNames[k]];
        if (c.takeNotes) { copy.notes = structuredClone(c.takeNotes[k] || []); delete copy.takeNotes; }
        delete copy.pat;   // a take of its own, not a linked copy
        copy.plugins = (c.plugins || []).map((p) => ({ ...structuredClone(p), autoOf: p.autoOf || p.id, id: id() }));
        const pan = (n % 2 ? 1 : -1) * Math.min(0.6, 0.3 + 0.15 * Math.floor(n / 2));
        copy.pan = pan;
        const nt = { id: id(), name: `${t.name} ${nm}`, kind: "take", role: t.role === "lead" ? "double" : t.role, armed: false, muted: false, solo: false,
                     pan, clips: [copy], plugins: (t.plugins || []).map((p) => ({ ...structuredClone(p), id: id() })) };
        S.tracks.splice(at++, 0, nt);
        made.push(nt.id); n++;
      }
      // the folder keeps only the take that plays (the others live on their lanes now)
      c.comp = null;
      changed();
      return { ok: true, trackIds: made };
    };
    // A/B: two comps per clip. Switching stores the comp you leave and loads the other one.
    handlers.compAB = ({ clipId, slot }) => {
      const w = where(clipId);
      if (!w || !(w.c.takes > 1)) return { error: "A/B compares comps of a clip with takes." };
      const c = w.c, ab = c.ab || { on: "A" };
      if (slot === ab.on) return { ok: true };
      const now = { comp: c.comp ? structuredClone(c.comp) : null, take: c.take };
      ab[ab.on] = now;
      const next = ab[slot] || now;
      c.comp = next.comp ? structuredClone(next.comp) : null; c.take = next.take;
      ab.on = slot;
      c.ab = ab;
      changed();
      return { ok: true };
    };
    // Lanes in a new order: drag a lane by its channel card.
    handlers.moveTrack = ({ trackId, index }) => {
      const t = lane(trackId);
      if (!t || t.kind === "beat") return { error: "That lane can't move." };
      const from = S.tracks.indexOf(t);
      S.tracks.splice(from, 1);
      const beatFirst = S.tracks[0] && S.tracks[0].kind === "beat" ? 1 : 0;
      S.tracks.splice(Math.max(beatFirst, Math.min(S.tracks.length, Math.round(index))), 0, t);
      changed();
      return { ok: true };
    };
  }

  // ---------------------------------------------------------------- the page
  const R = { on: false, keepOpen: null };
  const html = document.documentElement;
  const VOX = /lead|vox|vocal|voc\b|adlib|ad-lib|double|dbl|harm|backs|choir|verse|hook|take/i;
  // a sample dropped on PRODUCE (role fx, not added on RECORD, no takes) is a plain sound, not a voice (Eman, 31 Oct)
  const plainSample = (t) => (t.role === "fx" || t.role === "stem") && !t.recLane && !t.clips.some((c) => c.takes > 1);
  const isVoice = (t) => t.kind === "take" && !plainSample(t) && (t.armed || ["lead", "double", "adlib", "backs"].includes(t.role) || VOX.test(t.name) || t.clips.some((c) => c.takes > 1));
  const voices = () => (ui.state ? ui.state.tracks.filter(isVoice) : []);
  window.KT2isVoice = isVoice;   // the engine routes everything else into the PLAYGROUND bus
  const armed = () => ui.state && ui.state.tracks.find((t) => t.armed);
  const folderClip = (t) => t.clips.find((c) => c.takes > 1 && c.id === ui.selectedClip) || t.clips.find((c) => c.takes > 1 && ui.openTakes.has(c.id)) || t.clips.find((c) => c.takes > 1);

  function show(on) {
    if (on === R.on) return;
    R.on = on;
    if (on) {
      R.keepOpen = new Set(ui.openTakes);
      for (const t of voices()) for (const c of t.clips) if (c.takes > 1) ui.openTakes.add(c.id);
      const a = armed();
      if (!a || !isVoice(a)) {
        const v = voices()[0];
        if (v) run("armTrack", { trackId: v.id });
        // a fresh project: a Lead Vox lane is there and armed the moment RECORD opens (Eman, 31 Oct)
        else run("newTakeLane", { role: "lead" }).then((r) => { if (r && r.trackId) { ui.selectedTrack = r.trackId; ui.laneSig = ""; render(); } });
      }
      const pick = armed() || voices()[0];
      if (pick) { ui.selectedClip = null; ui.extraClips.clear(); ui.selectedTrack = pick.id; }
    } else if (R.keepOpen) {
      ui.openTakes = R.keepOpen;
      R.keepOpen = null;
    }
    html.classList.toggle("k2-rec", on);
    run("setPlaygroundMix", { active: on }).then((r) => { if (r && r.mix) PGL.mix = r.mix; }, () => {});
    clearInterval(PGL.timer);
    if (on) PGL.timer = setInterval(() => { if (ui.transport && ui.transport.playing) pgFetch(); }, 500);
    ui.laneSig = "";
    render();
    window.dispatchEvent(new Event("resize"));   // the timeline starts further right now: app.js measures it again
  }

  // ---- header: rec tools instead of the edit tools, and the voice pill
  let rtools = null, pill = null;
  function header() {
    if (!rtools) {
      rtools = el("div", "kt-tools k2-rtools");
      const mk = (cls, inner, tip, fn) => { const b = el("button", "kt-tool " + cls); b.innerHTML = inner + `<span class="tip">${tip}</span>`; b.onclick = fn; rtools.append(b); return b; };
      mk("loop", '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9a6 6 0 0 1 10.5-4M16 11a6 6 0 0 1-10.5 4"/><path d="M14.8 1.8v3.6h-3.6M5.2 18.2v-3.6h3.6"/></svg>',
        "Loop record: every pass is a new take", () => {
          const s = ui.state;
          if (ui.transport.looping) return run("setLooping", { on: false });
          if (s.loopEnd > s.loopStart) return run("setLooping", { on: true });
          const bar = secPerBar(), at = Math.floor(ui.transport.position / bar) * bar;
          run("setLoopRange", { start: at, end: at + 4 * bar });
        });
      mk("punch", '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 4H3v12h2M15 4h2v12h-2"/><circle cx="10" cy="10" r="2.2" fill="currentColor" stroke="none"/></svg>',
        "Punch in: record only inside the loop", () => {
          const s = ui.state;
          if (!(s.loopEnd > s.loopStart)) return toast("Drag on the loop strip (under the section names) to mark where to punch in.");
          run("setLooping", { on: true }).then(() => toast("Punch in: recording starts at the loop start and every pass becomes a take."));
        });
      mk("count", "<b>1 2 3</b>", "Count-in before recording (click: off, 1 bar, 2 bars)", () => {
        const n = ((ui.state.countIn || 0) + 1) % 3;
        run("setCountIn", { bars: n }).then(() => toast(n ? `Count-in: ${n} bar${n > 1 ? "s" : ""} before the take starts.` : "Count-in off: recording starts right away."));
      });
      mk("monitor", '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3.5 13v-2.5a6.5 6.5 0 0 1 13 0V13"/><rect x="2.5" y="12" width="4" height="5.5" rx="1.5"/><rect x="13.5" y="12" width="4" height="5.5" rx="1.5"/></svg>',
        "Hear yourself while recording", () => {
          if (ui.state.canMonitor) return run("setMonitor", { on: !ui.state.monitor });
          toast("Monitoring works in the Mac app. In the browser use your headphones' own monitoring.");
        });
      mk("takes", '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3.5" width="14" height="13" rx="1.5"/><path d="M3 8h14M3 12h14M8 3.5v13"/></svg>',
        "Open or close every take folder", () => {
          const all = voices().flatMap((t) => t.clips.filter((c) => c.takes > 1).map((c) => c.id));
          if (!all.length) return toast("No takes yet. Loop record (or record over the same part) to make some.");
          const open = all.every((x) => ui.openTakes.has(x));
          all.forEach((x) => (open ? ui.openTakes.delete(x) : ui.openTakes.add(x)));
          ui.laneSig = ""; render();
        });
      // the voice picker sits under the header, over the lane cards (Eman, 31 Oct), not in the header
      pill = el("div", "k2-voice k2-voice-below");
      document.body.append(pill);
      const tools = document.querySelector(".kt-tools:not(.k2-rtools)");
      (tools || document.querySelector(".top-left")).after(rtools);
    }
    const s = ui.state;
    rtools.querySelector(".loop").classList.toggle("on", !!ui.transport.looping);
    rtools.querySelector(".count").classList.toggle("on", (s.countIn || 0) > 0);
    rtools.querySelector(".count b").textContent = (s.countIn || 0) > 1 ? "1 2 3 4" : "1 2 3";
    rtools.querySelector(".monitor").classList.toggle("on", !!s.monitor);
    const a = armed();
    pill.replaceChildren();
    const short = (n) => { const w = String(n).replace(/[_-]+/g, " ").trim().split(/\s+/); let o = w[0] || ""; for (const x of w.slice(1)) { if ((o + " " + x).length > 16) break; o += " " + x; } return o.length > 16 ? o.slice(0, 15) + "\u2026" : o; };
    const name = el("button", "k2-voice-name", a ? short(a.name).toUpperCase() : "PICK A VOICE");
    if (a) name.dataset.full = a.name;
    name.style.setProperty("--c", a ? colorOf(a) : "#888");
    name.title = (a ? a.name + ": " : "") + "the lane that records. Click to pick another.";
    name.onclick = (e) => {
      e.stopPropagation();
      showMenu(name, [{ heading: "RECORD INTO" }, ...voices().map((t) => ({ label: t.name, color: colorOf(t), meta: t.armed ? "armed" : "", run: () => !t.armed && run("armTrack", { trackId: t.id }) }))]);
    };
    const add = el("button", "k2-voice-add", "+");
    add.title = "A new voice lane (Double, Adlibs, Harmony...)";
    add.onclick = (e) => { e.stopPropagation(); run("newTakeLane").then((r) => { if (r && r.trackId) { ui.selectedTrack = r.trackId; ui.laneSig = ""; render(); } }); };
    pill.append(name, add);
    // under the header, over the lane cards' column
    const top = document.querySelector(".top"), rows = document.getElementById("rows");
    const hb = top ? top.getBoundingClientRect().bottom : 60;
    const card = rows && rows.querySelector(".row:not(.master) .lane-head, .row:not(.master) .head");
    const w = card ? card.getBoundingClientRect().width : 330;
    pill.style.top = hb + 10 + "px"; pill.style.left = "12px"; pill.style.maxWidth = Math.max(180, w - 12) + "px";
  }

  // ---- the lanes: only the beat and the voices; channel cards with pan, COMP | LAYER, A/B
  // ---- the PLAYGROUND line: everything made on PRODUCE as one grey wave on top, with its own
  // volume and mute for singing over (Eman, 31 Oct). The beat is part of it, so no Reference row here.
  const PGL = { peaks: null, bucket: 0.05, heard: 0, mix: { volume: 0, muted: false }, timer: 0, busy: false };
  function pgFetch() {
    if (PGL.busy) return;
    PGL.busy = true;
    run("playgroundPeaks").then((r) => {
      PGL.busy = false;
      if (!r || !r.peaks) return;
      PGL.peaks = r.peaks; PGL.bucket = r.bucket; PGL.heard = r.heard;
      pgDraw();
    }, () => { PGL.busy = false; });
  }
  function pgDraw() {
    const row = document.querySelector("#rows .k2-pgrow");
    if (!row) return;
    const cv = row.querySelector("canvas"), lane = row.querySelector(".lane");
    const w = lane.offsetWidth, h = lane.offsetHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.min(16000, Math.round(w * dpr)), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext("2d");
    g.clearRect(0, 0, W, H);
    const P = PGL.peaks || [], sx = W / Math.max(1, w), mid = H / 2;
    g.fillStyle = PGL.mix.muted ? "rgba(150,150,156,0.35)" : "#9a9aa0";
    let any = false;
    for (let x = 0; x < W; x++) {
      const s0 = toSec(x / sx), s1 = toSec((x + 1) / sx);
      let pk = 0;
      for (let b = Math.floor(s0 / PGL.bucket); b <= Math.floor(s1 / PGL.bucket); b++) if (P[b] > pk) pk = P[b];
      if (pk < 0.004) continue;
      any = true;
      const a = Math.max(0.5 * dpr, Math.sqrt(pk) * (mid - 3 * dpr));
      g.fillRect(x, mid - a, 1, a * 2);
    }
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.fillRect(0, mid, W, Math.max(1, dpr | 0));
    const hint = row.querySelector(".k2-pghint");
    if (hint) hint.hidden = any;
  }
  function pgRow() {
    const rows = document.getElementById("rows");
    if (!rows) return;
    let row = rows.querySelector(".k2-pgrow");
    const w = timelineWidth();
    if (!row) {
      row = el("div", "row beat k2-pgrow");
      row.dataset.kind = "playground";
      row.style.setProperty("--c", "#9a9aa0");
      const head = el("div", "head");
      const dot = el("div", "dot-btn");
      const text = el("div", "head-text");
      const name = el("div", "head-name", "PLAYGROUND");
      const sub = el("div", "head-sub", "Everything from PRODUCE");
      const f = el("div", "vol"), fill = el("i");
      f.append(fill);
      f.title = "PLAYGROUND volume while you record. Drag, or double-click for 0 dB.";
      const paint = () => { fill.style.width = volToFrac(PGL.mix.volume || 0) * 100 + "%"; };
      const send = (a) => run("setPlaygroundMix", a).then((r) => { if (r && r.mix) PGL.mix = r.mix; paint(); pgDraw(); mute.classList.toggle("on", !!PGL.mix.muted); }, () => {});
      f.addEventListener("dblclick", (e) => { e.stopPropagation(); send({ volume: 0 }); });
      f.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const r = f.getBoundingClientRect();
        const at = (ev) => {
          const v = Math.round(fracToVol(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width))) * 10) / 10;
          PGL.mix.volume = v; paint(); sub.textContent = "Volume " + fmtDb(v);
          send({ volume: v });
        };
        at(e);
        const mv = (ev) => at(ev);
        const up = () => { removeEventListener("mousemove", mv); removeEventListener("mouseup", up); sub.textContent = "Everything from PRODUCE"; };
        addEventListener("mousemove", mv); addEventListener("mouseup", up);
      });
      text.append(name, sub, f);
      const btns = el("div", "head-btns");
      const mute = el("button", "msr m", "M");
      mute.title = "Mute the PLAYGROUND (only here on RECORD)";
      mute.onclick = (e) => { e.stopPropagation(); send({ muted: !PGL.mix.muted }); };
      btns.append(mute);
      head.append(dot, text, btns);
      head.title = "Everything you made on PRODUCE, mixed. Its volume and mute only count on RECORD.";
      const lane = el("div", "lane");
      const cv = document.createElement("canvas");
      const hint = el("div", "k2-pghint", "Press play once to draw your PRODUCE beat here");
      lane.append(cv, hint);
      lane.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        moveMarker(toSec(e.offsetX), true);
      });
      row.append(head, lane);
      paint();
      mute.classList.toggle("on", !!PGL.mix.muted);
    }
    if (rows.firstElementChild !== row) rows.prepend(row);
    row.querySelector(".lane").style.width = w + "px";
    pgDraw();
    pgFetch();
  }

  function lanes() {
    const keep = new Set(voices().map((t) => t.id));
    document.querySelectorAll("#rows .row").forEach((row) => {
      const kind = row.dataset.kind, id = row.dataset.trackId;
      if (row.classList.contains("master") || kind === "playground") return;
      if (kind === "beat") { row.style.display = "none"; return; }   // the PLAYGROUND line holds the beat now
      if (!keep.has(id)) row.style.display = "none";
    });
    pgRow();
    for (const t of voices()) {
      const row = document.querySelector(`#rows .row[data-track-id="${t.id}"]`);
      if (!row) continue;
      const head = row.querySelector(".head");
      if (!head || head.querySelector(".k2-rh")) continue;
      const box = el("div", "k2-rh");
      box.append(panSlider(t));
      const fc = folderClip(t);
      if (fc) {
        const sw = el("div", "k2-seg");
        const comp = el("button", "on", "COMP"), layer = el("button", null, "LAYER");
        comp.title = "Takes stay in one folder: swipe across a take to comp it in";
        layer.title = "Every take on its own lane, all playing together (stacks). Cmd+Z undoes.";
        comp.onclick = (e) => { e.stopPropagation(); toast("COMP: swipe across a take under the clip to use that part."); };
        layer.onclick = (e) => { e.stopPropagation(); run("layerTakes", { clipId: fc.id }).then((r) => r && r.ok && toast(`${r.trackIds.length} take${r.trackIds.length > 1 ? "s" : ""} on their own lanes now, spread left and right.`)); };
        sw.append(comp, layer);
        const ab = el("div", "k2-seg ab");
        const on = (fc.ab && fc.ab.on) || "A";
        for (const k of ["A", "B"]) {
          const b = el("button", on === k ? "on" : "", k);
          b.title = k === on ? `Comp ${k} (you're on it)` : `Switch to comp ${k}: what you did on ${on} is kept`;
          b.onclick = (e) => { e.stopPropagation(); run("compAB", { clipId: fc.id, slot: k }); };
          ab.append(b);
        }
        box.append(sw, ab);
      }
      // shown on PRODUCE? (on by default; an empty voice lane stays off PRODUCE until it has a take)
      const sw2 = el("button", "k2-onpg" + (t.onPlayground === false ? "" : " on"));
      sw2.innerHTML = "<i></i>PRODUCE";
      sw2.title = t.onPlayground === false ? "Hidden on PRODUCE. Click to show it there." : "Shown on PRODUCE (once it has a take). Click to keep it on RECORD only.";
      sw2.onclick = (e) => { e.stopPropagation(); run("setTrackOnPlayground", { trackId: t.id, on: t.onPlayground === false }); };
      box.append(sw2);
      head.append(box);
      head.addEventListener("mousedown", (e) => laneDrag(e, t, row), true);
    }
  }
  function panSlider(t) {
    const wrap = el("div", "k2-pan");
    const track = el("div", "k2-pan-track"), knob = el("i"), fill = el("b"), lab = el("span");
    track.append(fill, knob);
    wrap.append(track, lab);
    const paint = (p) => {
      const x = 50 + p * 50;
      knob.style.left = x + "%";
      fill.style.left = Math.min(50, x) + "%"; fill.style.width = Math.abs(x - 50) + "%";
      lab.textContent = Math.abs(p) < 0.005 ? "C" : (p < 0 ? "L" : "R") + Math.round(Math.abs(p) * 100);
    };
    paint(t.pan || 0);
    wrap.title = "Pan: drag left or right (snaps to the centre). Double-click for centre.";
    track.addEventListener("mousedown", (e) => {
      e.stopPropagation(); e.preventDefault();
      const r = track.getBoundingClientRect();
      let p = t.pan || 0;
      const at = (ev) => { let v = ((ev.clientX - r.left) / r.width) * 2 - 1; v = Math.max(-1, Math.min(1, v)); return Math.abs(v) < 0.06 ? 0 : v; };
      const move = (ev) => { p = at(ev); paint(p); };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); run("setLanePan", { trackId: t.id, pan: p }); };
      move(e);
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    track.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setLanePan", { trackId: t.id, pan: 0 }); });
    return wrap;
  }
  // Drag a lane's card up or down to put it somewhere else.
  function laneDrag(e, t, row) {
    if (e.button !== 0 || e.target.closest("button, input, .k2-pan, .vol, .var-head, .head-name input")) return;
    const y0 = e.clientY;
    let moved = false, ghost = null, target = null;
    const rows = () => [...document.querySelectorAll("#rows .row:not(.k2-ghost)")].filter((r) => r.style.display !== "none" && !r.classList.contains("master") && r.dataset.kind !== "beat" && r.dataset.kind !== "playground");
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientY - y0) < 6) return;
      if (!moved) { moved = true; row.classList.add("k2-lifting"); ghost = el("div", "k2-drop"); document.body.append(ghost); }
      const list = rows(), y = ev.clientY;
      let idx = list.length;
      for (let i = 0; i < list.length; i++) { const b = list[i].getBoundingClientRect(); if (y < b.top + b.height / 2) { idx = i; break; } }
      target = idx;
      const ref = list[Math.min(idx, list.length - 1)].getBoundingClientRect();
      Object.assign(ghost.style, { left: ref.left + "px", width: ref.width + "px", top: (idx < list.length ? ref.top : ref.bottom) - 1 + "px" });
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      if (!moved) return;
      row.classList.remove("k2-lifting"); ghost.remove();
      const list = rows().map((r) => r.dataset.trackId), from = list.indexOf(t.id);
      if (target == null || target === from || target === from + 1) return;
      // the visible order -> a place in the whole lane list (hidden lanes keep theirs)
      const all = ui.state.tracks.map((x) => x.id).filter((x) => x !== t.id);
      const before = list.filter((x) => x !== t.id)[target > from ? target - 1 : target];
      const index = before ? all.indexOf(before) : all.length;
      run("moveTrack", { trackId: t.id, index });
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  // ---- PRODUCE: the armed voice lane is the recording lane. A striped band with a grip tag:
  // drag the grip up or down to move it between the other rows, double-click it to record.
  function produceLane() {
    const t = ui.state.tracks.find((x) => x.armed && x.kind === "take");
    document.querySelectorAll("#rows .row.k2-recline").forEach((r) => { if (!t || r.dataset.trackId !== t.id) { r.classList.remove("k2-recline"); r.querySelector(".k2-rgrip")?.remove(); } });
    if (!t) return;
    const row = document.querySelector(`#rows .row[data-track-id="${t.id}"]`);
    if (!row) return;
    row.classList.add("k2-recline");
    row.style.setProperty("--rc", colorOf(t));
    let g = row.querySelector(".k2-rgrip");
    if (!g) {
      g = el("div", "k2-rgrip");
      g.append(el("i", "k2-gdots"), el("b"), el("span"));
      g.title = "The recording lane. Drag up or down to move it, double-click to record into it.";
      g.addEventListener("mousedown", (e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); laneDrag(e, t, row); });
      g.addEventListener("dblclick", (e) => { e.stopPropagation(); show(true); });
      row.append(g);
    }
    g.querySelector("span").textContent = t.name.toUpperCase();
  }

  // ---- footer: the input card, and the armed lane's chain with one click for the vocal rack
  function footer() {
    const side = document.querySelector(".k2-side");
    if (!side) return;
    let card = side.querySelector(".k2-input");
    if (!card) {
      card = el("div", "k2-input");
      card.innerHTML = '<div class="k2-in-h"><i></i>INPUT</div><div class="k2-in-mic"></div><div class="k2-in-sub"></div><div class="k2-in-meter"><b></b></div><button class="k2-in-rack"></button>';
      side.prepend(card);
      card.querySelector(".k2-in-rack").onclick = (e) => { e.stopPropagation(); vocalRack(); };
    }
    const a = armed();
    card.querySelector(".k2-in-mic").textContent = (ui.state.mic && ui.state.mic.name) || "Mic 1";
    card.querySelector(".k2-in-sub").textContent = a ? `${a.name} · armed` : "No lane armed";
    const lane = a && ui.state.tracks.find((t) => t.id === a.id);
    const has = lane && (lane.plugins || []).some((p) => /tunr|snaptune/i.test(p.name + " " + (p.type || "")));
    const btn = card.querySelector(".k2-in-rack");
    btn.textContent = has ? "Vocal rack is on" : "+ TUNR → VOX STACK → SPACE";
    btn.disabled = !!has;
    btn.title = "Adds TUNR (pitch), a vocal stack (compressor + de-esser) and SPACE (reverb) to the armed lane";
  }
  async function vocalRack() {
    const a = armed();
    if (!a) return toast("Arm a voice lane first (click its name in the header).");
    const list = await booth("listPlugins");
    const all = (list && (list.plugins || list)) || [];
    const find = (re) => all.find((p) => re.test(p.name) || re.test(p.key));
    const want = [find(/tunr|snaptune/i), find(/^compressor$/i), find(/de-?ess/i), find(/ktspace|^space$/i)].filter(Boolean);
    for (const p of want) await run("addPlugin", { trackId: a.id, key: p.key });
    ui.selectedTrack = a.id; ui.selectedClip = null; ui.laneSig = ""; render();
    toast(`${a.name}: TUNR, vox stack and SPACE are on the lane. Every take you record goes through them.`);
  }
  function meter() {
    const m = document.querySelector(".k2-input .k2-in-meter b");
    if (!m) return;
    const inp = ui.transport && ui.transport.input;
    const lvl = inp && typeof inp === "object" ? inp.level : typeof inp === "number" ? inp : null;
    m.style.width = Math.max(0, Math.min(100, lvl == null ? 0 : (lvl + 60) / 60 * 100)) + "%";
  }

  // ---- count-in: big beats in the middle before the take starts
  let wasRec = false, countBox = null, countTimer = 0;
  function countIn() {
    const bars = (ui.state && ui.state.countIn) || 0;
    if (!bars || ui.transport.looping) return;
    const beats = bars * 4, spb = 60 / ui.state.bpm;
    if (!countBox) { countBox = el("div", "k2-count"); document.body.append(countBox); }
    let i = 0;
    clearInterval(countTimer);
    const tick = () => {
      if (i >= beats || !ui.transport.recording) { clearInterval(countTimer); countBox.hidden = true; return; }
      countBox.hidden = false;
      countBox.replaceChildren(...Array.from({ length: Math.min(4, beats) }, (_, k) => el("b", k === i % 4 ? "on" : k < i % 4 ? "past" : "", String(k + 1))));
      i++;
    };
    tick();
    countTimer = setInterval(tick, spb * 1000);
  }

  function start() {
    const _render = render;
    const seen = new Set();   // take folders already shown once (a new one, like a fresh loop take, opens by itself)
    window.render = render = function () {
      if (R.on && ui.state) for (const t of voices()) for (const c of t.clips) if (c.takes > 1 && !seen.has(c.id)) { seen.add(c.id); ui.openTakes.add(c.id); }
      _render.apply(this, arguments);
      if (ui.state && !R.on) produceLane();
      if (!R.on || !ui.state) return;
      header();
      lanes();
      footer();
    };
    const _renderTransport = renderTransport;
    window.renderTransport = renderTransport = function () {
      _renderTransport.apply(this, arguments);
      const rec = !!(ui.transport && ui.transport.recording);
      if (rec && !wasRec) countIn();
      wasRec = rec;
      if (R.on) { meter(); if (rtools) rtools.querySelector(".loop").classList.toggle("on", !!ui.transport.looping); }
    };
  }
  if (html.classList.contains("kt2")) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }

  window.KT2Record = { show, get on() { return R.on; } };
  return { demo };
})();
