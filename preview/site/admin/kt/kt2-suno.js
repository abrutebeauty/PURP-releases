// KILLTOY 2: REIMAGINE SOUND / GENERATE SOUND with SUNO or ACE (Eman, 15 Nov 2026: "integrate it inside KILLTOY now").
// Right-click a clip:
//   REIMAGINE SOUND...  (audio clips) the clip goes to the AI and comes back restyled (Suno "upload & cover" or ACE cover).
//   GENERATE SOUND...   a new part from words, the length of the clip, in the song's tempo and key (Suno create / ACE text2music).
// Both versions come back as new lanes at the clip's bar (version 2 muted). Nothing here holds a key: the page calls the
// "KILLTOY ACE" connector (our Modal server) through the `mcp` capability; the server holds the Suno (Kie.ai) key.
// Suno costs Kie credits (about 12 a run); ACE costs Modal GPU seconds (capped on the server).
// KT2_SUNO_OFF = none of it (no menu entries).
// Parked (15 Nov): published as v444 from the Mac outside git; the box in ui/kt2-ace.js (SUNO / ACE switch,
// MIDI + drum patterns too) replaces it. KT2_SUNO_BOX_OLD = use this box again.
"use strict";

(function () {
  if (window.KT2_SUNO_OFF || (window.KT2Ace && !window.KT2_SUNO_BOX_OLD)) return;
  const SERVER = "KILLTOY ACE";
  const UP_CHUNK = 700000;            // base64 chars per ace_upload call (the call limit is 1 MiB)
  const MAX_SRC = 60;                  // seconds of a clip sent to the AI
  const NOBEAT = "drums, percussion, beat, full band";
  const LS = "kt2.ai";
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  const save = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { /* private window */ } };
  const say = (m, bad) => { try { (window.toast || console.log)(m, !!bad); } catch (e) { console.log(m); } };

  // ---------------------------------------------------------------- the connector
  let mcpP = null;
  // app2.html runs inside index.html's frame: the capability runtime may live on the parent (same as variations.js)
  const host = () => { let c = window.claude; try { if (!(c && c.use) && window.parent !== window) c = window.parent.claude; } catch (e) { /* other origin */ } return c && c.use ? c : null; };
  const mcp = () => (mcpP = mcpP || (host() ? host().use("mcp").catch(() => null) : Promise.resolve(null)));
  function why(e) {
    const c = e && e.code;
    if (c === "server_not_connected" || c === "server_not_found") return `Add the "${SERVER}" connector in claude.ai Settings \u2192 Connectors.`;
    if (c === "needs_reauth") return `Reconnect "${SERVER}" in claude.ai Settings \u2192 Connectors.`;
    if (c === "not_in_manifest" || c === "approval_required" || c === "consent_required") return `Allow "${SERVER}" for KILLTOY when claude.ai asks (or in the page's Permissions menu).`;
    if (c === "selection_required") return `Pick which "${SERVER}" connector to use when claude.ai asks.`;
    if (c === "tool_error") { const r = e.result && e.result.content && e.result.content[0]; return (r && r.text) || e.message || "The AI server said no."; }
    if (c === "server_unavailable" || c === "upstream_error") return "The AI server didn't answer. Try again in a moment.";
    if (c === "not_granted" || c === "capability_disabled" || c === "capability_removed") return "AI sounds only work in the claude.ai KILLTOY page.";
    return (e && e.message) || String(e);
  }
  async function call(tool, input) {
    const m = await mcp();
    if (!m) throw { code: "not_granted" };
    const r = await m.callTool(SERVER, tool, input, { cache: false });
    return r.payload;
  }

  // ---------------------------------------------------------------- audio in / out
  function wav16(samples, rate) {
    const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(samples[i]));
    const g = pk > 0.99 ? 0.99 / pk : 1;
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * g)) * 32767, true);
    return new Uint8Array(buf);
  }
  function b64(bytes) {
    let s = ""; const K = 0x8000;
    for (let i = 0; i < bytes.length; i += K) s += String.fromCharCode.apply(null, bytes.subarray(i, i + K));
    return btoa(s);
  }
  function unb64(s) { const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  async function clipAudio(c) {
    const to = Math.min(c.length, MAX_SRC);
    const r = await run("getClipMono", { clipId: c.id, from: 0, to, rate: 22050 });
    if (!r || !r.samples) throw new Error("This clip's sound isn't loaded yet. Play it once, then try again.");
    return b64(wav16(r.samples, r.rate));
  }
  async function upload(data) {
    const id = "kt" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const parts = []; for (let i = 0; i < data.length; i += UP_CHUNK) parts.push(data.slice(i, i + UP_CHUNK));
    for (let i = 0; i < parts.length; i++) await call("ace_upload", { upload: id, index: i, total: parts.length, data: parts[i] });
    return id;
  }

  // ---------------------------------------------------------------- song facts
  const song = () => {
    const st = (window.ui && ui.state) || {};
    const k = st.key || null, NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const key = k && k.tonic != null ? `${NAMES[k.tonic]} ${k.minor ? "minor" : "major"}` : "";
    return { bpm: Math.round(st.bpm || 120), key };
  };

  // ---------------------------------------------------------------- run one job end to end
  async function go(o, status) {
    const s = song();
    const engine = o.engine, wild = o.wild;   // wild 0 = close to the clip, 1 = free
    let start, poll;
    status("Getting the clip ready\u2026");
    if (engine === "suno") {
      const p = { model: "V6", title: (o.prompt || "KILLTOY").slice(0, 60), instrumental: !o.vocals };
      if (o.mode === "reimagine") {
        p.kind = "cover"; p.style = o.prompt; p.audio_weight = +(0.9 - wild * 0.7).toFixed(2);
        p.src_upload = await upload(await clipAudio(o.clip));
        p.duration = Math.max(10, Math.min(360, Math.round(o.clip.length)));
      } else {
        p.kind = "create"; p.style = `${o.prompt}, ${s.bpm} bpm${s.key ? ", " + s.key : ""}`;
        p.duration = Math.max(10, Math.min(360, Math.round(o.clip ? o.clip.length : 30)));
      }
      if (o.nodrums) p.negative_tags = NOBEAT;
      status("Sending to SUNO\u2026");
      start = await call("suno_start", { params: p });
      poll = "suno_poll";
    } else {
      const p = { prompt: o.prompt + (o.nodrums ? ", no drums, solo instrument" : ""), bpm: s.bpm, key: s.key || undefined, versions: 2 };
      if (o.mode === "reimagine") {
        p.task = "cover"; p.strength = +(1 - wild * 0.8).toFixed(2);
        p.src_upload = await upload(await clipAudio(o.clip));
      } else {
        p.task = "text2music"; p.seconds = Math.max(4, Math.min(60, o.clip ? o.clip.length : 16)); p.thinking = true;
      }
      status("Sending to ACE\u2026");
      start = await call("ace_start", { params: p });
      poll = "ace_poll";
    }
    const job = start.job, t0 = Date.now();
    let m;
    for (;;) {
      await new Promise((r) => setTimeout(r, engine === "suno" ? 4000 : 2500));
      m = await call(poll, { job });
      if (m.status === "done") break;
      if (m.status === "failed") throw new Error(m.error || "The AI job failed.");
      status(`${engine === "suno" ? "SUNO" : "ACE"} is making it\u2026 ${Math.round((Date.now() - t0) / 1000)} s`);
      if (Date.now() - t0 > 8 * 60 * 1000) throw new Error("It took over 8 minutes. Try again.");
    }
    status("Bringing it in\u2026");
    const files = [];
    for (let k = 0; k < Math.min(2, m.outputs.length); k++) {
      const o2 = m.outputs[k];
      let data = "";
      for (let i = 0; i < o2.chunks; i++) data += (await call("ace_download", { job, output: k, index: i })).data;
      const ext = engine === "suno" ? "mp3" : "flac";
      const name = `${engine === "suno" ? "SUNO" : "ACE"} ${k + 1} \u00b7 ${o.prompt.slice(0, 28)}`;
      files.push({ file: new File([unb64(data)], `${name.replace(/[^\w .-]/g, "")}.${ext}`, { type: engine === "suno" ? "audio/mpeg" : "audio/flac" }), path: "AI/" + name, name });
    }
    const reg = await run("setSampleFiles", { name: "AI sounds", files: files.map(({ file, path }) => ({ file, path })), add: true });
    const at = o.clip ? o.clip.start : 0, lanes = [];
    for (let k = 0; k < files.length; k++) {
      const r = await run("addSample", { id: reg.samples[k].id, name: files[k].name, start: at, laneName: files[k].name });
      if (r && r.trackId) lanes.push(r.trackId);
    }
    // version 2 starts muted so they don't play on top of each other
    if (lanes[1]) { try { await run("toggleMute", { trackId: lanes[1] }); } catch (e) { /* older backends */ } }
    return { lanes: lanes.length, credits: m.credits, seconds: Math.round((Date.now() - t0) / 1000) };
  }

  // ---------------------------------------------------------------- the box
  function css() {
    if (document.getElementById("k2ai-css")) return;
    const s = document.createElement("style"); s.id = "k2ai-css";
    s.textContent = `
.k2ai-back{position:fixed;inset:0;z-index:9000;background:rgba(10,10,12,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center}
.k2ai{width:min(460px,calc(100vw - 32px));background:#1c1b20;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 60px rgba(0,0,0,.55);color:#ecebf2;font:500 12px var(--font,Inter,sans-serif);display:flex;flex-direction:column}
.k2ai-h{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07)}
.k2ai-h b{color:#b79cff;font:700 14px var(--font,Inter,sans-serif);letter-spacing:.12em}
.k2ai-x{background:none;border:0;color:#a9a5b6;font-size:18px;line-height:1;cursor:pointer}
.k2ai-b{display:flex;flex-direction:column;gap:12px;padding:14px 16px}
.k2ai-seg{display:flex;border:1px solid rgba(255,255,255,.12);align-self:flex-start}
.k2ai-seg button{background:none;border:0;color:#6f6b7c;font:700 11px var(--font,Inter,sans-serif);letter-spacing:.16em;padding:8px 14px;cursor:pointer}
.k2ai-seg button.on{background:#b79cff;color:#15140f}
.k2ai textarea{background:#26242c;border:1px solid #3a3744;color:#ecebf2;font:13px/1.4 var(--font,Inter,sans-serif);padding:10px 12px;min-height:64px;resize:vertical}
.k2ai-sl{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font:600 11px var(--font,Inter,sans-serif);letter-spacing:.12em;color:#a9a5b6}
.k2ai-sl input{accent-color:#b79cff;width:100%}
.k2ai-row{display:flex;gap:8px;flex-wrap:wrap}
.k2ai-tog{display:flex;align-items:center;gap:8px;background:none;border:1px solid rgba(255,255,255,.12);color:#a9a5b6;font:700 11px var(--font,Inter,sans-serif);letter-spacing:.14em;padding:7px 10px;cursor:pointer}
.k2ai-tog s{width:26px;height:14px;background:#3a3744;position:relative;text-decoration:none}
.k2ai-tog s::after{content:"";position:absolute;top:2px;left:2px;width:10px;height:10px;background:#6f6b7c}
.k2ai-tog.on{color:#E4FF3A;border-color:#E4FF3A}
.k2ai-tog.on s{background:#E4FF3A}.k2ai-tog.on s::after{left:14px;background:#15140f}
.k2ai-f{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-top:1px solid rgba(255,255,255,.07)}
.k2ai-st{font:500 11px var(--font,Inter,sans-serif);letter-spacing:.08em;color:#a9a5b6;flex:1;min-width:0}
.k2ai-st.bad{color:#ff7a7a}
.k2ai-go{background:#E4FF3A;color:#15140f;border:0;font:800 12px var(--font,Inter,sans-serif);letter-spacing:.16em;padding:11px 18px;cursor:pointer}
.k2ai-go:disabled{opacity:.4;cursor:default}
.k2ai-clip{font:500 11px var(--font,Inter,sans-serif);color:#6f6b7c;letter-spacing:.06em}
.k2ai button:focus-visible,.k2ai textarea:focus-visible,.k2ai input:focus-visible{outline:2px solid #b79cff;outline-offset:1px}`;
    document.head.appendChild(s);
  }

  function open(mode, clip) {
    css();
    const prev = load();
    const st = { engine: prev.engine || "suno", wild: prev.wild != null ? prev.wild : 0.3, nodrums: prev.nodrums != null ? prev.nodrums : mode === "reimagine", vocals: false };
    const back = document.createElement("div"); back.className = "k2ai-back";
    const box = document.createElement("div"); box.className = "k2ai"; box.setAttribute("role", "dialog"); back.append(box);
    box.innerHTML = `
      <div class="k2ai-h"><b>${mode === "reimagine" ? "REIMAGINE SOUND" : "GENERATE SOUND"}</b><button class="k2ai-x" aria-label="Close">&times;</button></div>
      <div class="k2ai-b">
        <div class="k2ai-seg" role="group" aria-label="Engine"><button data-e="suno">SUNO</button><button data-e="ace">ACE</button></div>
        <textarea id="k2ai-prompt" placeholder="${mode === "reimagine" ? "solo trumpet, warm, jazzy, live room" : "dark witch house beat, haunted synths, 808"}"></textarea>
        ${mode === "reimagine" ? `<label class="k2ai-sl">CLOSE<input id="k2ai-wild" type="range" min="0" max="1" step="0.05">WILD</label>` : ""}
        <div class="k2ai-row">
          <button class="k2ai-tog" data-t="nodrums"><s></s>NO DRUMS</button>
          <button class="k2ai-tog" data-t="vocals"><s></s>VOCALS</button>
        </div>
        <div class="k2ai-clip"></div>
      </div>
      <div class="k2ai-f"><span class="k2ai-st"></span><button class="k2ai-go">${mode === "reimagine" ? "REIMAGINE" : "GENERATE"}</button></div>`;
    const $q = (s) => box.querySelector(s);
    const prompt = $q("#k2ai-prompt"), stEl = $q(".k2ai-st"), goB = $q(".k2ai-go"), wildEl = $q("#k2ai-wild");
    prompt.value = (prev.prompts && prev.prompts[mode]) || "";
    if (wildEl) { wildEl.value = st.wild; wildEl.oninput = () => (st.wild = +wildEl.value); }
    const s = song();
    $q(".k2ai-clip").textContent = (clip ? `on ${clip.name || "clip"} \u00b7 ` : "") + `${s.bpm} BPM${s.key ? " \u00b7 " + s.key : ""}`;
    const sync = () => {
      box.querySelectorAll(".k2ai-seg button").forEach((b) => b.classList.toggle("on", b.dataset.e === st.engine));
      box.querySelectorAll(".k2ai-tog").forEach((b) => b.classList.toggle("on", !!st[b.dataset.t]));
      $q('[data-t="vocals"]').hidden = st.engine === "ace";
      stEl.classList.remove("bad");
      if (!stEl.dataset.busy) stEl.textContent = st.engine === "suno" ? "SUNO \u00b7 about 12 Kie credits a run" : "ACE \u00b7 a few cents of GPU";
    };
    box.querySelectorAll(".k2ai-seg button").forEach((b) => (b.onclick = () => { st.engine = b.dataset.e; sync(); }));
    box.querySelectorAll(".k2ai-tog").forEach((b) => (b.onclick = () => { st[b.dataset.t] = !st[b.dataset.t]; sync(); }));
    const close = () => { back.remove(); document.removeEventListener("keydown", key, true); };
    const key = (e) => { if (e.key === "Escape" && !stEl.dataset.busy) { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", key, true);
    prompt.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) goB.click(); };
    $q(".k2ai-x").onclick = close;
    back.onclick = (e) => { if (e.target === back && !stEl.dataset.busy) close(); };
    goB.onclick = async () => {
      const text = prompt.value.trim();
      if (!text) { stEl.textContent = "Write what it should sound like first."; stEl.classList.add("bad"); prompt.focus(); return; }
      const p = load(); p.engine = st.engine; p.wild = st.wild; p.nodrums = st.nodrums; p.prompts = { ...(p.prompts || {}), [mode]: text }; save(p);
      goB.disabled = true; stEl.dataset.busy = "1";
      const status = (m) => { stEl.textContent = m; };
      try {
        const r = await go({ mode, engine: st.engine, prompt: text, wild: st.wild, nodrums: st.nodrums, vocals: st.vocals, clip }, status);
        delete stEl.dataset.busy; close();
        say(`${st.engine === "suno" ? "SUNO" : "ACE"}: ${r.lanes} new lane${r.lanes === 1 ? "" : "s"} at the clip's bar (version 2 muted). ${r.seconds} s${r.credits ? ` \u00b7 ${r.credits} credits` : ""}`);
      } catch (e) {
        delete stEl.dataset.busy; goB.disabled = false;
        stEl.textContent = why(e); stEl.classList.add("bad");
        console.warn("[kt2-suno]", e);
      }
    };
    document.body.append(back); sync(); prompt.focus();
  }

  // ---------------------------------------------------------------- the clip menu
  function hook() {
    const A = window.KillToyArrange;
    if (!A || A._k2ai) return !!A;
    const inner = A.clipItems;
    A.clipItems = function (c, t, ids) {
      const base = inner ? inner.apply(this, arguments) : [];
      try {
        const audio = c && c.kind !== "midi" && !(t && t.kind === "beat" && false);
        return [...base, { sep: true },
          ...(audio && ids.length === 1 ? [{ label: "REIMAGINE SOUND\u2026", meta: "SUNO / ACE", run: () => open("reimagine", c) }] : []),
          ...(ids.length === 1 ? [{ label: "GENERATE SOUND\u2026", meta: "new part here", run: () => open("generate", c) }] : [])];
      } catch (e) { console.warn("[kt2-suno] menu", e); return base; }
    };
    A._k2ai = true;
    return true;
  }
  if (!hook()) document.addEventListener("DOMContentLoaded", hook);
  window.KT2AI = { open, go };
})();
