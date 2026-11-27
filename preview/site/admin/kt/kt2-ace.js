// ACE SOUND (Eman, 15 Nov): two items in every clip's menu, talking to ACE-Step 1.5 on Modal through the
// "KILLTOY ACE" connector (scripts/ace-modal/killtoy_ace.py; the page itself may not fetch servers, so it goes
// through the artifact's `mcp` capability).
//  - REIMAGINE SOUND (audio clips, MIDI patterns, drum patterns): the clip is rendered dry (playground aceRender),
//    sent with the prompt to ACE "cover" (keeps the rhythm and length, changes the sound). CLOSE <-> WILD sets
//    the cover strength (0.75 .. 0.35).
//  - GENERATE SOUND (empty patterns): with PG MATCH on (default), what plays over the pattern is rendered as the
//    backing and ACE "lego" adds one new track that fits it (the copy of the backing is taken out on the server);
//    with PG MATCH off (or nothing under it) it is text2music with the song's BPM and key.
//  The result always comes back as AUDIO: a new lane right under the clip, same start and length, 2 versions as
//  takes; the source clip is switched off, Cmd+Z puts everything back.
// SUNO (Eman, 15 Nov): the box has a SUNO / ACE switch, SUNO by default (it sounded much better in the tests).
//  Suno runs through the Kie.ai reseller on the same connector (tool suno_start, scripts/ace-modal/killtoy_ace.py).
//  REIMAGINE = Suno "upload & cover" of the rendered clip; GENERATE = Suno from words with the song's BPM and key.
//  Suno's negative tags only nudge, so the server also takes the stems it sneaks in (drums, bass) out of the result.
//  KT2_SUNO_OFF = no switch, ACE only (old).
// Flags: KT2_ACE_OFF = no menu items (old). KT2_ACE_COMPLETE = GENERATE uses "complete" instead of "lego".
// KT2_ACE_BEST = REIMAGINE on the slower base model. KT2_ACE_SERVER = connector name (default "KILLTOY ACE").
(function () {
  "use strict";
  if (!document.documentElement.classList.contains("kt2")) return;
  const off = () => !!window.KT2_ACE_OFF;
  const SERVER = () => window.KT2_ACE_SERVER || "KILLTOY ACE";
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const MAX_SEC = 60;
  const CHUNK = 700000;
  const st = () => (typeof ui !== "undefined" && ui && ui.state) || {};
  const say = (m) => { try { toast(m); } catch (e) { console.log(m); } };
  const sunoOk = () => !window.KT2_SUNO_OFF;
  const engine = () => { if (!sunoOk()) return "ace"; try { return localStorage.getItem("kt2.ace.engine") || "suno"; } catch (e) { return "suno"; } };
  const setEngine = (v) => { try { localStorage.setItem("kt2.ace.engine", v); } catch (e) {} };
  const ENG = (e) => (e === "suno" ? "SUNO" : "ACE");
  const call = (cmd, args) => (typeof booth === "function" ? booth(cmd, args) : Promise.resolve(null));

  // ------------------------------------------------------------------ what kind of clip
  const notesOf = (c) => (c && (c.notes || (c.takeNotes && c.takeNotes[c.take || 0]))) || [];
  const isEmpty = (c) => c.kind === "midi" && !notesOf(c).length;
  const isDrums = (c, t) => {
    const ps = [...((t && t.plugins) || []), ...((c && c.plugins) || [])];
    return ps.some((p) => /kill ?drum|drum|kit/i.test((p && (p.name || p.type || p.key)) || "")) || /drum|kit|kick|snare|hat|perc|808/i.test(((t && t.name) || "") + " " + ((c && c.name) || ""));
  };
  const keyText = () => { const k = st().key; return k && k.tonic != null ? NAMES[k.tonic] + (k.minor ? " minor" : " major") : ""; };
  // which ACE track a prompt asks for (lego / complete need one of these names)
  function trackFor(text) {
    const s = (text || "").toLowerCase();
    const map = [[/trumpet|sax|horn|brass|trombone|tuba/, "brass"], [/flute|clarinet|oboe|woodwind|bassoon/, "woodwinds"],
      [/violin|cello|viola|string|orchestra/, "strings"], [/guitar/, "guitar"], [/piano|keys|rhodes|organ|wurl|keyboard/, "keyboard"],
      [/808|bass|sub/, "bass"], [/conga|bongo|shaker|tamb|perc/, "percussion"], [/drum|kick|snare|hat|beat|break/, "drums"],
      [/choir|backing vocal|backing vox|oohs|aahs/, "backing_vocals"], [/vocal|voice|vox|sing/, "vocals"],
      [/riser|sweep|noise|fx|impact|whoosh/, "fx"], [/pad|synth|lead|arp|pluck|bell/, "synth"]];
    for (const [re, tr] of map) if (re.test(s)) return tr;
    return "synth";
  }

  // Suno prompts (suno-engineer rules: describe what you want first, 2-4 negatives max, BPM + key in the style)
  const asks = (text, re) => re.test((text || "").toLowerCase());
  function sunoParams(prompt, drums, o) {
    const bpm = Math.round(st().bpm || 120), key = keyText().replace("#", "#");
    const tail = `${bpm} bpm${key ? ", " + key : ""}`;
    // TOYTUNE STACKS (16 Nov): a vocal in, a vocal back. Keep the voice, drop the rest.
    if (o && o.vocal) return { style: `${prompt}, ${tail}`, negative: "instrumental, drums, bass, music", remove: ["drums", "bass", "other"], vocalOut: true };
    const wantDrums = drums || asks(prompt, /drum|beat|break|perc|kick|snare|hat|groove/);
    const wantBass = asks(prompt, /bass|808|sub/);
    if (wantDrums && drums) return { style: `${prompt}, drum loop, percussion only, ${tail}`, negative: "vocals, melody, bass", remove: wantBass ? ["vocals", "other"] : ["vocals", "other", "bass"] };
    const remove = [];
    if (!wantDrums) remove.push("drums");
    if (!wantBass) remove.push("bass");
    // asked for a voice (16 Nov): Suno must sing, so no "vocals" in the negatives and instrumental off (KT2_SUNO_VOCALASK_OLD = old)
    const wantVox = asks(prompt, /vocal|voice|vox|sing|choir|a cappella|acapella|rap/) && !window.KT2_SUNO_VOCALASK_OLD;
    const neg = [...(wantDrums ? [] : ["drums", "percussion"]), ...(wantBass ? [] : ["bass"]), ...(wantVox ? [] : ["vocals"])].slice(0, 4).join(", ");
    return { style: `${prompt}, solo, unaccompanied, ${tail}`, negative: neg, remove: [...remove, ...(asks(prompt, /vocal|voice|vox|sing|choir/) ? [] : ["vocals"])], ...(wantVox ? { vocalOut: true } : {}) };
  }

  // ------------------------------------------------------------------ connector
  let mcpP = null;
  async function mcp() {
    // app2.html can run inside index.html's frame: the capability runtime may live on the parent (like kt2-suno.js, variations.js)
    // walk up every same-origin frame (shell.html > index.html > app2.html) to the one holding the runtime
    const host = () => { let w = window; for (let i = 0; i < 6 && w; i++) { try { if (w.claude && w.claude.use) return w.claude; } catch (e) { return null; } if (w === w.parent) break; w = w.parent; } return null; };
    if (!mcpP) mcpP = (async () => { const h = host(); if (!h) return null; return await h.use("mcp"); })();
    let m = null;
    try { m = await mcpP; } catch (e) { mcpP = null; throw e; }   // the runtime's own reason (consent, connector...) reaches errText
    if (!m) { mcpP = null; throw Object.assign(new Error("Open KILLTOY in claude.ai to use ACE."), { code: "no_mcp" }); }
    return m;
  }
  const errText = (e) => {
    const c = e && e.code;
    if (c === "server_not_connected" || c === "server_not_found" || c === "selection_required") return `Add the ${SERVER()} connector in claude.ai Settings > Connectors.`;
    if (c === "needs_reauth") return `Reconnect ${SERVER()} in claude.ai Settings > Connectors.`;
    if (c === "not_in_manifest" || c === "approval_required" || c === "not_granted" || c === "consent_required" || c === "capability_disabled") return `Allow ${SERVER()} for KILLTOY to use ACE.`;
    if (c === "server_unavailable") return "ACE didn't answer. Try again in a moment.";
    // SUNO refuses audio it recognises (Splice samples, released songs): say so plainly (KT2_SUNO_CATALOG_MSG_OFF keeps the raw text)
    if (!window.KT2_SUNO_CATALOG_MSG_OFF && /matches an existing recording|in our catalog/i.test((e && e.message) || "")) return "SUNO won't take this audio: it matches a recording it already knows (like a Splice sample). Try your own take.";
    return (e && e.message) || String(e);
  };
  async function tool(name, input, opts) {
    const m = await mcp();
    const r = await m.callTool(SERVER(), name, input, { cache: false, ...(opts || {}) });
    return r.payload !== undefined ? r.payload : r;
  }
  const b64 = (blob) => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1] || ""); fr.onerror = no; fr.readAsDataURL(blob); });
  const unb64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  let fileArgs = null;
  async function sendAudio(params, key, blob, chunked) {
    if (!chunked && fileArgs === null) { try { fileArgs = !!(await (await mcp()).listTools()).fileArgs; } catch (e) { fileArgs = false; } }
    if (!chunked && fileArgs && !window.KT2_ACE_CHUNKS) { params[key] = { $file: { data: blob, name: key + ".wav", type: "audio/wav" } }; return; }
    const s = await b64(blob), id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), n = Math.ceil(s.length / CHUNK);
    for (let i = 0; i < n; i++) await tool("ace_upload", { upload: id, index: i, total: n, data: s.slice(i * CHUNK, (i + 1) * CHUNK) });
    params[key + "_upload"] = id;
  }

  // ------------------------------------------------------------------ the job pill (bottom right)
  let pill = null;
  function status(text, done) {
    if (!pill) { pill = document.createElement("div"); pill.className = "kt2-ace-pill"; document.body.append(pill); }
    pill.textContent = text; pill.classList.toggle("done", !!done); pill.hidden = !text;
    if (done) setTimeout(() => { if (pill && pill.textContent === text) pill.hidden = true; }, 2500);
  }
  const clock = (t0) => { const s = Math.round((Date.now() - t0) / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  // ------------------------------------------------------------------ the run
  const running = new Set();
  async function go(c, t, mode, prompt, o) {
    if (running.has(c.id)) return say("Already working on this clip.");
    running.add(c.id);
    const eng = (o && o.engine) || engine();
    const t0 = Date.now(), verb = (mode === "gen" ? "GENERATING" : "REIMAGINING") + " \u00b7 " + ENG(eng);
    let timer = null;
    const stage = (s) => { clearInterval(timer); const f = () => status(`${verb} \u00b7 ${s} \u00b7 ${clock(t0)}`); f(); timer = setInterval(f, 1000); };
    try {
      const len = Math.min(MAX_SEC, c.length);
      if (c.length > MAX_SEC + 0.01) say(`${ENG(eng)} takes up to ${MAX_SEC} s: the first ${MAX_SEC} s go.`);
      const p = { prompt, bpm: st().bpm || 120, key: keyText(), seconds: len, versions: 2, timesig: "4" };
      let startTool = "ace_start";
      stage("RENDERING");
      if (eng === "suno") {
        startTool = "suno_start";
        const drums = mode === "re" && isDrums(c, t);
        const sp = sunoParams(prompt, drums, o);
        Object.assign(p, sp, { title: prompt.slice(0, 60), task: mode === "re" ? "suno-cover" : "suno-generate", model: "V6", instrumental: !sp.vocalOut });
        delete p.vocalOut;
        // the live server (Mac build, 15 Nov) reads kind / negative_tags / duration; this repo's server reads
        // mode / negative / seconds. Send both so either one works.
        p.negative_tags = p.negative; p.duration = Math.max(10, Math.min(360, Math.round(len)));
        delete p.prompt; delete p.key; delete p.bpm; delete p.timesig;
        if (mode === "re") {
          const r = await call("aceRender", { clipId: c.id });
          if (!r || r.error) throw new Error((r && r.error) || "Couldn't render this clip.");
          if (r.silent) throw new Error("This clip is silent, so there's nothing to reimagine.");
          p.mode = "cover"; p.kind = "cover";
          p.audio_weight = Math.round(((o && o.vocal === "remaster" ? 0.92 : o && o.vocal ? 0.8 : 0.9) - 0.5 * ((o && o.wild) || 0)) * 100) / 100;
          p.style_weight = 0.7;
          stage("SENDING");
          await sendAudio(p, "src", r.wav, true);
        } else {
          p.mode = "generate"; p.kind = "create";
        }
      } else if (mode === "re") {
        const r = await call("aceRender", { clipId: c.id });
        if (!r || r.error) throw new Error((r && r.error) || "Couldn't render this clip.");
        if (r.silent) throw new Error("This clip is silent, so there's nothing to reimagine.");
        p.task = "cover";
        p.strength = Math.round((0.75 - 0.4 * o.wild) * 100) / 100;
        p.prompt = `${prompt}, instrumental, ${isDrums(c, t) ? "drums, percussion loop" : "solo instrument"}`;
        if (window.KT2_ACE_BEST) p.quality = "best";
        stage("SENDING");
        await sendAudio(p, "src", r.wav);
      } else {
        let backing = null;
        if (o.pg) {
          const r = await call("aceRender", { from: c.start, to: c.start + len, skipClipId: c.id });
          if (r && r.ok && !r.empty && !r.silent) backing = r.wav;
        }
        const tr = trackFor(prompt);
        if (backing) {
          p.task = window.KT2_ACE_COMPLETE ? "complete" : "lego";
          p.track = tr;
          p.prompt = `${prompt}, instrumental`;
          stage("SENDING");
          await sendAudio(p, "src", backing);
        } else {
          p.task = "text2music";
          p.prompt = `${prompt}, instrumental, ${tr === "drums" ? "drum loop" : "solo " + tr.replace("_", " ")}`;
        }
      }
      stage("STARTING");
      const { job } = await tool(startTool, { params: p });
      if (!job) throw new Error(ENG(eng) + " didn't start.");
      let meta = null, polls = 0;
      const pollTool = eng === "suno" ? "suno_poll" : "ace_poll";
      while (true) {
        await new Promise((ok) => setTimeout(ok, eng === "suno" ? 4000 : polls < 10 ? 1500 : 2500));
        polls++;
        meta = await tool(pollTool, { job });
        if (meta.status === "done") break;
        if (meta.status === "failed") throw new Error(ENG(eng) + ": " + (meta.error || "failed"));
        stage(eng === "ace" && Date.now() - t0 > 25000 && polls < 40 ? "WARMING UP" : "MAKING");
        if (Date.now() - t0 > 15 * 60 * 1000) throw new Error(ENG(eng) + " took too long.");
      }
      stage("BRINGING BACK");
      const wavs = [];
      for (let k = 0; k < meta.outputs.length; k++) {
        let s = "";
        for (let i = 0; i < meta.outputs[k].chunks; i++) s += (await tool("ace_download", { job, output: k, index: i })).data;
        wavs.push(unb64(s));
      }
      const name = prompt.replace(/\s+/g, " ").trim().slice(0, 24).toUpperCase() || ENG(eng);
      const r = await call("aceInsert", { clipId: c.id, wavs, name, info: { prompt, engine: eng, task: p.task, strength: p.strength, style: p.style, seeds: meta.outputs.map((x) => x.seed) } });
      if (!r || r.error) throw new Error((r && r.error) || "Couldn't place the result.");
      clearInterval(timer);
      status(`${name} \u00b7 ${r.versions} VERSIONS \u00b7 ${clock(t0)}`, true);
      if (typeof render === "function") { ui.laneSig = ""; render(); }
    } catch (e) {
      clearInterval(timer); status("");
      say(errText(e));
      console.warn("ACE", e);
    } finally { running.delete(c.id); }
  }

  // ------------------------------------------------------------------ the prompt box
  const CHIPS = {
    re: ["TRUMPET", "DISTORTED", "STRINGS", "GUITAR", "CHOIR", "LO-FI", "808 GLIDE", "MUSIC BOX"],
    reDrums: ["AFRICAN DRUMS", "DISTORTED", "LIVE KIT", "TRAP", "JERSEY CLUB", "BREAKBEAT", "TRIBAL", "LO-FI"],
    gen: ["DARK PIANO", "808 BASS", "TRUMPET", "STRINGS", "CHOIR", "PLUCK", "PAD", "AFRICAN DRUMS"],
  };
  let box = null;
  function close() { if (box) { box.remove(); box = null; document.removeEventListener("pointerdown", outside, true); } }
  function outside(e) { if (box && !box.contains(e.target)) close(); }
  function open(c, t, mode) {
    close(); addCss();
    const gen = mode === "gen", chips = gen ? CHIPS.gen : isDrums(c, t) ? CHIPS.reDrums : CHIPS.re;
    const pg = window.KT2PGMatch ? KT2PGMatch.isOn("ace") : true;
    box = document.createElement("div");
    box.className = "kt2-ace-box";
    let eng = engine();
    box.innerHTML = `<div class="ka-top"><div class="ka-h">${gen ? "GENERATE SOUND" : "REIMAGINE SOUND"}</div>${sunoOk() ? `<div class="ka-eng"><button data-e="suno">SUNO</button><button data-e="ace">ACE</button></div>` : ""}</div>
      <input class="ka-in" type="text" maxlength="300" spellcheck="false" placeholder="${gen ? "dark piano, sad, reverb" : "turn into a trumpet"}">
      <div class="ka-chips">${chips.map((x) => `<button class="ka-chip">${x}</button>`).join("")}</div>
      ${gen ? `<button class="ka-pg${pg ? " on" : ""}" role="switch" aria-checked="${pg}"><i></i>${window.KT2PGMatch ? KT2PGMatch.LABEL : "PG MATCH"}</button>`
            : `<div class="ka-wild"><span>CLOSE</span><input type="range" min="0" max="1" step="0.05" value="0.5"><span>WILD</span></div>`}
      <button class="ka-go">${gen ? "GENERATE" : "REIMAGINE"}</button>`;
    document.body.append(box);
    const r = (document.querySelector(`.clip[data-clip-id="${c.id}"]`) || document.body).getBoundingClientRect();
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + "px";
    box.style.top = (r.bottom + h + 8 < window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
    const inp = box.querySelector(".ka-in");
    box.querySelectorAll(".ka-chip").forEach((b) => (b.onclick = () => { inp.value = inp.value ? inp.value + ", " + b.textContent.toLowerCase() : b.textContent.toLowerCase(); inp.focus(); }));
    const engs = box.querySelectorAll(".ka-eng button");
    const showEng = () => engs.forEach((b) => b.classList.toggle("on", b.dataset.e === eng));
    engs.forEach((b) => (b.onclick = () => { eng = b.dataset.e; setEngine(eng); showEng(); }));
    showEng();
    const pgb = box.querySelector(".ka-pg");
    if (pgb) pgb.onclick = () => { const v = !pgb.classList.contains("on"); pgb.classList.toggle("on", v); pgb.setAttribute("aria-checked", v); if (window.KT2PGMatch) KT2PGMatch.setOn("ace", v); };
    const fire = () => {
      const text = inp.value.trim();
      if (!text) { inp.focus(); return; }
      const wild = box.querySelector(".ka-wild input");
      const o = { wild: wild ? +wild.value : 0.5, pg: pgb ? pgb.classList.contains("on") : false, engine: eng };
      close();
      go(c, t, mode, text, o);
    };
    box.querySelector(".ka-go").onclick = fire;
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") fire(); if (e.key === "Escape") close(); };
    box.addEventListener("keydown", (e) => e.stopPropagation());
    setTimeout(() => { inp.focus(); document.addEventListener("pointerdown", outside, true); }, 0);
  }

  // ------------------------------------------------------------------ menu
  function menuItems(c, t) {
    if (off() || !c || !t || t.kind === "beat" || c.cmp) return [];
    if (c.kind === "midi" && t.kind !== "inst") return [];
    const gen = isEmpty(c);
    return [{ label: gen ? "Generate sound" : "Reimagine sound", meta: ENG(engine()), run: () => open(c, t, gen ? "gen" : "re") }];
  }

  let cssDone = false;
  function addCss() {
    if (cssDone) return; cssDone = true;
    const s = document.createElement("style");
    s.textContent = `
.kt2-ace-box{position:fixed;z-index:10050;width:300px;padding:10px;background:#1c1b20;border:1px solid #3b3842;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:8px;font:600 11px/1.2 var(--font,system-ui);color:#e9e6ef}
.kt2-ace-box .ka-top{display:flex;align-items:center;justify-content:space-between}
.kt2-ace-box .ka-eng{display:flex}
.kt2-ace-box .ka-eng button{padding:4px 7px;background:#2a2730;border:0;color:#9a94a6;font:800 9px/1 var(--font,system-ui);letter-spacing:.1em;cursor:pointer;border-radius:0}
.kt2-ace-box .ka-eng button.on{background:#b79cff;color:#141218}
.kt2-ace-box .ka-h{font-weight:800;letter-spacing:.12em;font-size:10px;color:#b79cff}
.kt2-ace-box .ka-in{height:30px;padding:0 8px;background:#121115;border:1px solid #3b3842;color:#fff;font:600 12px var(--font,system-ui);outline:none;border-radius:0}
.kt2-ace-box .ka-in:focus{border-color:#b79cff}
.kt2-ace-box .ka-chips{display:flex;flex-wrap:wrap;gap:4px}
.kt2-ace-box .ka-chip{padding:4px 6px;background:#2a2730;border:0;color:#cfc9da;font:700 9px/1 var(--font,system-ui);letter-spacing:.06em;cursor:pointer;border-radius:0}
.kt2-ace-box .ka-chip:hover{background:#3a3445;color:#fff}
.kt2-ace-box .ka-wild{display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:.08em;color:#9a94a6}
.kt2-ace-box .ka-wild input{flex:1;accent-color:#b79cff}
.kt2-ace-box .ka-pg{display:flex;align-items:center;justify-content:center;gap:6px;height:26px;background:#2a2730;border:0;color:#9a94a6;font:800 10px/1 var(--font,system-ui);letter-spacing:.1em;cursor:pointer;border-radius:0}
.kt2-ace-box .ka-pg i{width:8px;height:8px;background:#55505e}
.kt2-ace-box .ka-pg.on{background:#E4FF3A;color:#141218}
.kt2-ace-box .ka-pg.on i{background:#141218}
.kt2-ace-box .ka-go{height:32px;background:#E4FF3A;color:#141218;border:0;font:900 11px/1 var(--font,system-ui);letter-spacing:.14em;cursor:pointer;border-radius:0}
.kt2-ace-box .ka-go:hover{filter:brightness(1.08)}
.kt2-ace-pill{position:fixed;right:14px;bottom:14px;z-index:10040;padding:8px 12px;background:#1c1b20;border:1px solid #b79cff;color:#e9e6ef;font:800 10px/1 var(--font,system-ui);letter-spacing:.1em;pointer-events:none}
.kt2-ace-pill.done{border-color:#E4FF3A;color:#E4FF3A}`;
    document.head.append(s);
  }

  window.KT2Ace = { menuItems, open, go, trackFor, isEmpty, engine, setEngine, _t: { keyText, errText, sunoParams } };
  window.KT2_MENU_ICONS = window.KT2_MENU_ICONS || [];
})();
