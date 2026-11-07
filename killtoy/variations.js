// KILLTOY variations: right-click any clip or lane for "Make variation" (one click, close to
// the original) or "Change it..." (say what you want: "darker", "a woman's voice", "snare
// instead of clap"). Claude reads the request and picks the route and its settings (the
// plan); the engine's makeVariation command makes it as a new take in the clip's take
// folder. The take that's playing stays the default until "Use" is pressed, so the original
// keeps playing while the new one loads in the row underneath.
//
// Routes: dsp (tone, drive, space, formant / whole octaves), swap (a one-sound drum lane gets
// a new sample on every hit), notes (MIDI parts), ace (ACE-Step remake), voice (voice
// changer), elevenlabs (only when asked for by name). The browser playground runs dsp, swap
// and notes; ace and voice need the Mac app, and their plans carry a "sketch" the browser
// can make meanwhile.
// Keep this file ASCII-only.
"use strict";

const VAR = { planning: new Map() }; // clipId -> label, while Claude is still picking the route

const DRUM_WORDS = { kick: /kick|kck|\bbd\b|bass ?drum/, snare: /snare|snr|\bsd\b/, clap: /clap|clp/, openhat: /open[ _-]?h|\boh\b|open hat/,
  hat: /h(i|ie|igh)?[ _-]?hats?\b|hihat|\bhh\b|\bch\b|closed/, rim: /rim/, tom: /\btoms?\b/, shaker: /shaker|shak/, perc: /perc/ };
const SOUNDS = Object.keys(DRUM_WORDS);

// Which single drum a lane holds ("Kick", "Hi-hats"), or null for vocals, 808s, full kits.
function singleDrum(name) {
  const n = (name || "").toLowerCase();
  if (/drums|kit|break|loop|808|bass/.test(n)) return null;
  const hits = SOUNDS.filter((s) => DRUM_WORDS[s].test(n));
  if (hits.includes("openhat")) return "openhat";
  return hits.length ? hits[0] : null;
}

// ---------------------------------------------------------------------------
// Take folder helpers (used by app.js while drawing the lanes)
function varJobs(c) {
  const jobs = ((ui.state && ui.state.jobs) || []).filter((j) => j.kind === "variation" && j.clipId === c.id && (!j.finished || j.failed));
  if (VAR.planning.has(c.id)) jobs.unshift({ id: "plan-" + c.id, varLabel: VAR.planning.get(c.id), stage: "Claude is picking how", progress: 0.02, planning: true });
  return jobs;
}
const takeCount = (c) => (c.takes > 1 ? c.takes : 1);
const hasFolder = (c) => c.takes > 1 || varJobs(c).length > 0;
const folderRows = (c) => takeCount(c) + varJobs(c).length;
function takeName(c, i) {
  const info = c.takeInfo && c.takeInfo[i];
  return (info && info.name) || (c.takeNames && c.takeNames[i]) || (i === 0 && !(c.takes > 1) ? "Original" : `Take ${i + 1}`);
}
function takeTitle(c, i) {
  const info = c.takeInfo && c.takeInfo[i];
  if (!info || !info.check) return takeName(c, i);
  const ck = info.check, bits = [info.why || ""];
  if (!ck.midi) bits.push(ck.onTime ? `Timing checked: ${ck.lagMs} ms from the original.` : `Timing is ${ck.lagMs} ms off the original.`);
  if (ck.keyAfter) bits.push(ck.sameKey ? `Key checked: ${ck.keyAfter}, same notes as before.` : `Key moved: ${ck.keyBefore} to ${ck.keyAfter}.`);
  return bits.filter(Boolean).join(" ");
}

// The row headers in the lane card, one per take / loading variation, lined up with the strips.
function renderVariationHeads(head, c) {
  const box = el("div", "var-heads");
  const n = takeCount(c), playing = c.audition != null ? c.audition : null;
  for (let i = 0; i < n; i++) {
    const isDefault = i === c.take;
    const r = el("div", "var-head" + (isDefault ? " default" : "") + (playing === i ? " listening" : ""));
    r.style.top = `calc(var(--row-h) - 4px + ${i * TAKE_H}px)`;
    const nm = el("span", "var-name", takeName(c, i));
    nm.title = takeTitle(c, i);
    const info = c.takeInfo && c.takeInfo[i];
    if (info && info.check && !info.check.midi) nm.append(el("i", "var-ok" + (info.check.onTime && info.check.sameKey !== false ? "" : " off"), info.check.onTime && info.check.sameKey !== false ? "\u2713" : "!"));
    r.append(nm);
    if (isDefault) r.append(el("span", "var-tag", "default"));
    else {
      const listen = el("button", "var-btn" + (playing === i ? " on" : ""), playing === i ? "\u25A0" : "\u25B6");
      listen.title = playing === i ? "Back to the default" : "Listen: plays this one in place of the default (press play)";
      listen.onclick = (e) => { e.stopPropagation(); run("auditionTake", { clipId: c.id, take: playing === i ? null : i }).then(() => playing !== i && !ui.transport.playing && booth("togglePlay")); };
      const solo = el("button", "var-btn", "S");
      solo.title = "Solo this one: just this lane, playing this take";
      solo.onclick = async (e) => {
        e.stopPropagation();
        const t = ui.state.tracks.find((x) => x.clips.some((k) => k.id === c.id));
        await run("auditionTake", { clipId: c.id, take: i });
        if (t && !t.solo) await run("toggleSolo", { trackId: t.id });
        if (!ui.transport.playing) booth("togglePlay");
      };
      const use = el("button", "var-btn use", "Use");
      use.title = "Set as default: this one becomes the main sound, the old one stays here underneath";
      use.onclick = (e) => { e.stopPropagation(); run("setClipTake", { clipId: c.id, index: i }).then((r) => r && !r.error && toast(`"${takeName(c, i)}" is the default now. The old one is still in the folder (Cmd+Z undoes).`)); };
      r.append(listen, solo, use);
    }
    box.append(r);
  }
  varJobs(c).forEach((j, k) => {
    const r = el("div", "var-head pending" + (j.failed ? " failed" : ""));
    r.style.top = `calc(var(--row-h) - 4px + ${(n + k) * TAKE_H}px)`;
    r.append(el("span", "var-name", j.varLabel || "Variation"), el("span", "var-tag", j.failed ? "didn't work" : j.planning ? "thinking" : Math.round((j.progress || 0) * 100) + "%"));
    r.dataset.job = j.id;
    r.title = j.failed ? j.message : j.stage || "";
    box.append(r);
  });
  head.append(box);
}

// Loading / failed rows in the lane, under the takes.
function renderPendingStrips(lane, c) {
  const n = takeCount(c);
  varJobs(c).forEach((j, k) => {
    const s = el("div", "take-strip var-pending" + (j.failed ? " failed" : ""));
    s.dataset.job = j.id;
    s.style.left = toX(c.start) + "px";
    s.style.width = Math.max(4, toX(c.length)) + "px";
    s.style.top = `calc(var(--row-h) - 4px + ${(n + k) * TAKE_H}px)`;
    const fill = el("div", "var-fill");
    fill.style.width = Math.round((j.failed ? 1 : j.progress || 0) * 100) + "%";
    s.append(fill, el("span", "take-name", j.failed ? j.message : `${j.varLabel || "Variation"} \u00B7 ${j.stage || "Working"}`));
    lane.append(s);
  });
}

// Progress moves without redrawing the lanes (called from renderJobs).
function updateVariationProgress() {
  for (const j of (ui.state && ui.state.jobs) || []) {
    if (j.kind !== "variation" || j.finished) continue;
    const pct = Math.round((j.progress || 0) * 100) + "%";
    document.querySelectorAll(`[data-job="${j.id}"]`).forEach((n) => {
      const f = n.querySelector(".var-fill"), tag = n.querySelector(".var-tag"), nm = n.querySelector(".take-name");
      if (f) f.style.width = pct;
      if (tag) tag.textContent = pct;
      if (nm) nm.textContent = `${j.varLabel || "Variation"} \u00B7 ${j.stage || "Working"}`;
    });
  }
}

// Part of the lane signature, so the lanes redraw when a variation starts, lands or fails.
const variationSig = () => [[...VAR.planning.keys()], ((ui.state && ui.state.jobs) || []).filter((j) => j.kind === "variation").map((j) => [j.id, j.finished, j.failed])];

// ---------------------------------------------------------------------------
// Menu items for clipMenu / laneMenu
function variationItems(target) {
  return [
    { label: "Make variation", meta: "close to it", run: () => makeVariation(target, "") },
    { label: "Change it\u2026", meta: "say how", run: () => openChangeBox(target) },
  ];
}

function targetClips(target) {
  const t = target.track || (target.clip && ui.state.tracks.find((x) => x.clips.some((k) => k.id === target.clip.id)));
  const clips = target.clip ? [t.clips.find((k) => k.id === target.clip.id)] : t ? t.clips.slice(0, 16) : [];
  return { track: t, clips: clips.filter(Boolean) };
}

const EXAMPLES = {
  vocal: ["darker", "a woman's voice", "deeper, like a man", "distorted", "lo-fi phone voice", "wider and airy"],
  adlib: ["distorted", "pitched down an octave", "telephone", "huge reverb"],
  chops: ["darker", "up an octave", "crunchier"],
  drums: ["different hi-hat", "snare instead of clap", "harder kick", "darker", "more punch"],
  bass: ["more distorted", "darker", "cleaner sub", "an octave up on some notes"],
  chords: ["darker", "warmer", "lo-fi", "wider"],
  lead: ["darker", "more distorted", "softer", "an octave up"],
  fx: ["darker", "wider", "crushed"],
  mix: ["darker", "lo-fi", "brighter"],
};

function openChangeBox(target) {
  const { track } = targetClips(target);
  const kind = soundKind(track) || "fx";
  const what = target.clip ? target.clip.name : track ? track.name : "this";
  const pop = $("pop");
  pop.replaceChildren();
  pop.append(el("div", "label", "Change " + what));
  const input = el("input", "var-input");
  input.placeholder = "Make this darker, a woman's voice, snare instead of clap\u2026";
  const go = () => { const v = input.value.trim(); if (!v) return input.focus(); hidePop(); makeVariation(target, v); };
  input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") go(); if (e.key === "Escape") hidePop(); });
  const chips = el("div", "var-chips");
  const drum = singleDrum(track && track.name);
  const drumName = drum && drum.replace("openhat", "open hat");
  const swapIdea = drum === "clap" ? "a snare instead of clap" : drum === "snare" ? "a clap instead of snare" : drum === "hat" ? "an open hat instead" : drum === "kick" ? "a harder kick" : "a different sound";
  for (const x of (drum ? ["different " + drumName, swapIdea, "darker", "more punch", "distorted"] : EXAMPLES[kind] || EXAMPLES.fx)) {
    const b = el("button", "var-chip", x);
    b.onclick = (e) => { e.stopPropagation(); input.value = "make this " + x.replace(/^make this /, ""); input.focus(); };
    chips.append(b);
  }
  const row = el("div", "var-actions");
  const ok = el("button", "var-ok-btn", "OK");
  ok.onclick = (e) => { e.stopPropagation(); go(); };
  row.append(el("span", "var-hint", "The original keeps playing while it's made."), ok);
  pop.append(input, chips, row);
  const head = target.clip ? document.querySelector(`.clip[data-clip-id="${target.clip.id}"]`)
                           : document.querySelector(`.row[data-track-id="${track && track.id}"] .head`);
  placePop(head || $("rows"));
  pop.classList.add("var-box");
  setTimeout(() => input.focus(), 0);
}

// ---------------------------------------------------------------------------
// Making one
async function makeVariation(target, prompt) {
  const { track, clips } = targetClips(target);
  if (!clips.length) return toast("Nothing on this lane to make a variation of.");
  const kind = soundKind(track) || "fx";
  const placeholder = prompt ? prompt.replace(/^(make )?(this|it) (into )?/i, "").replace(/^(a|an|the) /i, "").slice(0, 24) : "Variation";
  for (const c of clips) { VAR.planning.set(c.id, placeholder); ui.openTakes.add(c.id); }
  ui.laneSig = ""; render();
  let plan;
  try { plan = await planVariation({ prompt, track, clip: clips[0], kind }); }
  catch (e) { plan = rulePlan(prompt, { track, clip: clips[0], kind }); }
  for (const c of clips) VAR.planning.delete(c.id);
  if (plan.route === "elevenlabs" && !confirm("This would use ElevenLabs (it uses your credits, and earlier results came back out of key and time). Go ahead?")) {
    ui.laneSig = ""; render(); return;
  }
  const results = [];
  for (const [k, c] of clips.entries()) results.push(await run("makeVariation", { clipId: c.id, plan: { ...plan, seed: (plan.seed || 1) + k * 7919 } }));
  ui.laneSig = ""; render();
  if (results.some((r) => r && r.ok)) toast(`Making "${plan.label}". The original keeps playing; it shows up underneath when it's ready.`);
  const ai = (ui.state && ui.state.ai) || {};
  if (plan.route === "voice" && !window.purpPlayground && !ai.voiceInstalled && !ai.voiceInstalling && typeof installVoiceTools === "function")
    showMenu($("logo"), [
      { heading: "This one is a sketch. The real voice needs the voice changer" },
      { label: "Install voice changer", meta: "~3 GB, once", cta: true, run: installVoiceTools },
    ]);
  return plan;
}

// ---------------------------------------------------------------------------
// The plan: Claude picks, or simple rules when Claude can't be reached.
let varSample = null;
function getVarSample() {
  if (!varSample) {
    let c = window.claude;
    try { if (!c && window.parent !== window) c = window.parent.claude; } catch (e) { /* other origin */ }
    varSample = c && c.use ? c.use("sample").catch(() => null) : Promise.resolve(null);
  }
  return varSample;
}

const ROUTES = ["dsp", "swap", "notes", "ace", "voice", "elevenlabs"];
const PLAN_RULES = [
  "You plan ONE variation of a sound in KILLTOY, a music app. Pick the best route and its settings. Answer with JSON only.",
  "Routes:",
  "- dsp: changes the same audio. Fields: octave (-1, 0 or 1; whole octaves only), formant (semitones -7..7: + = smaller, younger, more female; - = bigger, deeper, more male; the notes stay), lowcut and highcut (Hz, 0 = off), bass, presence, air (dB, -12..12), drive, crush, comp, space (0..1), width (-1..1), level (dB).",
  "- swap: ONLY for a lane that holds ONE drum sound (kick, snare, clap, hat...): every hit gets another sample, same timing and velocity. Fields: sound (kick|snare|clap|hat|openhat|rim|perc|tom|shaker), query (words to find it, like \"tight trap\"), match (close|different). Never for vocals, 808s, bass or a full drum mix.",
  "- notes: ONLY for MIDI parts: some notes move to neighbouring notes in the key. Fields: amount (0..1 share of notes moved), octave (-1, 0, 1), tone {highcut, drive}.",
  "- ace: ACE-Step AI remakes the audio in a new style (\"make it a guitar\", \"jazzier\", \"sing it differently\"). Fields: prompt (style words), strength (0..1, low = closer to the original). Mac app only.",
  "- voice: a voice changer turns a vocal into another singer (\"a woman's voice\", \"a child\", \"a deep male voice\"). Fields: target (\"female singer\", \"deep male singer\", \"child\"). It copies a reference voice (a Splice vocal or Music/PURP/Voices), keeps the melody and timing, and moves only by whole octaves. Mac app only.",
  "- elevenlabs: only if Eman says ElevenLabs by name.",
  "For ace, voice and elevenlabs ALSO give sketch: a dsp object the browser can make as a rough preview meanwhile (a woman's voice: formant +4, presence +2).",
  "Keep the original's timing and key: never change pitch except by whole octaves, never stretch time.",
  "No request means a CLOSE variation: small moves (formant +-1..2, an EQ tilt of 2-4 dB, a touch of drive or space), or for a one-sound drum lane a swap with match close. Make each one a little different.",
  'Reply exactly: {"label": "1-3 words, shown on the row", "route": "...", "why": "one short plain sentence", "dsp": {}, "swap": {}, "notes": {}, "ace": {}, "voice": {}, "sketch": {}} (leave out what you don\'t use).',
].join("\n");

async function planVariation({ prompt, track, clip, kind }) {
  const sample = await getVarSample();
  const ctx = planContext({ track, clip, kind });
  if (!sample) return finishPlan(rulePlan(prompt, { track, clip, kind }), ctx, prompt);
  const ask = `${PLAN_RULES}\n\nThe sound: ${JSON.stringify(ctx)}\nEman asked: ${prompt ? JSON.stringify(prompt) : "(nothing: make a close variation)"}\nRandom seed for variety: ${Math.floor(Math.random() * 1e6)}`;
  const got = await sample.json(ask, { modelTier: "quick", cache: false });
  return finishPlan(got, ctx, prompt);
}

function planContext({ track, clip, kind }) {
  const s = ui.state || {};
  return {
    lane: track ? track.name : "", clip: clip ? clip.name : "", kind, isMidi: clip && clip.kind === "midi",
    oneDrum: singleDrum(track && track.name), seconds: clip ? Math.round(clip.length * 10) / 10 : 0,
    bpm: s.bpm, key: s.key && s.key.name, samplesConnected: typeof smp !== "undefined" ? smp.items.length : 0,
    runningIn: window.purpPlayground ? "browser playground (ace and voice can't run here)" : "Mac app",
  };
}

const vnum = (v, a, b, d = 0) => (typeof v === "number" && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
function cleanDsp(d) {
  if (!d || typeof d !== "object") return {};
  return { octave: Math.round(vnum(d.octave, -1, 1)), formant: vnum(d.formant, -7, 7), lowcut: vnum(d.lowcut, 0, 2000), highcut: vnum(d.highcut, 0, 20000),
    bass: vnum(d.bass, -12, 12), presence: vnum(d.presence, -12, 12), air: vnum(d.air, -12, 12), drive: vnum(d.drive, 0, 1), crush: vnum(d.crush, 0, 1),
    comp: vnum(d.comp, 0, 1), space: vnum(d.space, 0, 1), width: vnum(d.width, -1, 1), level: vnum(d.level, -12, 6) };
}

// Checks Claude's plan against what can really happen to this sound, and adds the samples
// a swap can choose from.
function finishPlan(p, ctx, prompt) {
  p = p && typeof p === "object" ? p : {};
  let route = ROUTES.includes(p.route) ? p.route : "dsp";
  if (ctx.isMidi && route !== "notes") { p.notes = { ...(p.notes || {}), tone: (p.notes && p.notes.tone) || (p.dsp ? { highcut: vnum(p.dsp.highcut, 0, 20000), drive: vnum(p.dsp.drive, 0, 1) } : null) }; route = "notes"; }
  if (!ctx.isMidi && route === "notes") route = "dsp";
  if (route === "swap" && !ctx.oneDrum) route = "dsp";
  if (route === "elevenlabs" && !/eleven/i.test(prompt || "")) route = p.sketch ? "voice" : "dsp";
  const plan = { label: String(p.label || (prompt ? prompt.replace(/^(make )?(this|it) (into )?/i, "").replace(/^(a|an|the) /i, "") : "Variation")).slice(0, 28), route, why: String(p.why || "").slice(0, 160),
    prompt: prompt || "", kind: ctx.kind, pitched: !/drums/.test(ctx.kind), seed: Math.floor(Math.random() * 1e6) + 1 };
  plan.label = plan.label.charAt(0).toUpperCase() + plan.label.slice(1);
  if (route === "dsp") {
    plan.dsp = cleanDsp(p.dsp);
    if (!Object.values(plan.dsp).some((v) => v)) plan.dsp = rulePlan(prompt, ctx).dsp || { formant: 1, presence: 2 };
  }
  if (route === "swap") {
    const sound = SOUNDS.includes(p.swap && p.swap.sound) ? p.swap.sound : ctx.oneDrum;
    plan.swap = { sound, query: String((p.swap && p.swap.query) || "").slice(0, 60), match: p.swap && p.swap.match === "different" ? "different" : prompt ? "different" : "close" };
    plan.swap.ids = sampleCandidates(sound, plan.swap.query);
  }
  if (route === "notes") plan.notes = { amount: vnum(p.notes && p.notes.amount, 0, 1, prompt ? 0.35 : 0.2), octave: Math.round(vnum(p.notes && p.notes.octave, -1, 1)), tone: p.notes && p.notes.tone ? cleanDsp(p.notes.tone) : null };
  if (route === "ace") plan.ace = { prompt: String((p.ace && p.ace.prompt) || prompt || "a fresh take, same style").slice(0, 200), strength: vnum(p.ace && p.ace.strength, 0, 1, prompt ? 0.55 : 0.25) };
  if (route === "voice") plan.voice = { target: String((p.voice && p.voice.target) || prompt || "").slice(0, 80) };
  if (["ace", "voice", "elevenlabs"].includes(route)) plan.sketch = p.sketch ? cleanDsp(p.sketch) : rulePlan(prompt, ctx).dsp || null;
  // Only the change itself goes into the new audio; the shaping arrives as effect cards,
  // switched on, so they can be turned off or swapped (the same rule as every sound Claude makes).
  if (plan.dsp) { const s = shapingCards(plan.dsp); plan.dsp = s.raw; plan.fx = s.fx; }
  if (plan.sketch) { const s = shapingCards(plan.sketch); plan.sketch = s.raw; plan.sketchFx = s.fx; }
  if (plan.notes && plan.notes.tone) { plan.fx = shapingCards(plan.notes.tone).fx; plan.notes.tone = null; }
  return plan;
}

// Splits a dsp plan into what must be rendered (octave, formant, width, level) and effect
// cards for the rest: { name, knobs: { paramId: 0..1 }, why }, the knobs as the built-ins read them.
const card01 = (v) => Math.max(0, Math.min(1, Math.round(v * 1000) / 1000));
function shapingCards(d) {
  d = d || {};
  const raw = {}, fx = [];
  for (const k of ["octave", "formant", "width", "level"]) if (d[k]) raw[k] = d[k];
  const low = (d.bass || 0) - (d.lowcut ? Math.min(12, 4 + d.lowcut / 40) : 0);
  const high = (d.air || 0) - (d.highcut ? Math.min(12, 3 + Math.max(0, 12000 - d.highcut) / 1000) : 0);
  const mid = d.presence || 0;
  if (Math.abs(low) > 0.2 || Math.abs(mid) > 0.2 || Math.abs(high) > 0.2) {
    const words = [high < -0.2 ? "darker top" : high > 0.2 ? "more air" : "", low < -0.2 ? "less low end" : low > 0.2 ? "more low end" : "", mid > 0.2 ? "more presence" : mid < -0.2 ? "softer mids" : ""].filter(Boolean);
    fx.push({ name: "EQ", knobs: { "Low-pass gain": card01(0.5 + Math.max(-12, Math.min(12, low)) / 24), "Mid gain 1": card01(0.5 + Math.max(-12, Math.min(12, mid)) / 24),
      "High-pass gain": card01(0.5 + Math.max(-12, Math.min(12, high)) / 24) }, why: "The variation's tone: " + words.join(", ") + "." });
  }
  if (d.comp > 0.05) fx.push({ name: "Compressor", knobs: { threshold: card01(0.6 - 0.35 * d.comp), ratio: card01(0.2 + 0.45 * d.comp) }, why: "Tighter and more even." });
  if (d.drive > 0.03) fx.push({ name: "Drive", knobs: { drive: card01(0.15 + 0.7 * d.drive) }, why: "Grit for the variation." });
  if (d.crush > 0.03) fx.push({ name: "Crush", knobs: { bits: card01((12 - 8 * d.crush - 2) / 14), mix: card01(0.4 + 0.6 * d.crush) }, why: "Lo-fi grit." });
  if (d.space > 0.03) fx.push({ name: "Space", knobs: { mix: card01(0.1 + 0.45 * d.space), size: card01(0.4 + 0.45 * d.space) }, why: "More room around it." });
  return { raw, fx };
}

// Up to 12 one-shots from the connected sample folder that look like `sound`.
function sampleCandidates(sound, query) {
  if (typeof smp === "undefined" || !smp.items.length || !sound) return [];
  const re = DRUM_WORDS[sound], words = (query || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !re.test(w));
  const pool = smp.items.filter((s) => s.kind === "shot" && re.test(s.path.toLowerCase()) && !(sound === "hat" && DRUM_WORDS.openhat.test(s.path.toLowerCase())));
  const scored = pool.map((s) => ({ s, score: words.filter((w) => s.path.toLowerCase().includes(w)).length + Math.random() * 0.9 }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map((x) => x.s.id);
}

// The rules: used when Claude isn't there, and to fill in a plan that came back empty.
function rulePlan(prompt, { track, clip, kind }) {
  const p = (prompt || "").toLowerCase(), drum = singleDrum(track && track.name), isMidi = clip && clip.kind === "midi";
  const label = prompt ? prompt.replace(/^(make )?(this|it) (into )?/i, "").replace(/^(a|an|the) /i, "").slice(0, 24) : "Variation";
  const r = (a, b) => a + Math.random() * (b - a);
  if (isMidi) return { label, route: "notes", notes: { amount: prompt ? 0.35 : 0.2, octave: /octave up|higher/.test(p) ? 1 : /octave down|lower/.test(p) ? -1 : 0,
    tone: /dark/.test(p) ? { highcut: 1800 } : /distort|dirt|grit/.test(p) ? { drive: 0.5 } : null } };
  const swapTo = SOUNDS.find((s) => new RegExp("\\b(a |an )?" + s.replace("openhat", "open ?hat") + "s?\\b( instead)?").test(p) && (/instead|different|another|new|swap|replace/.test(p) || s !== drum));
  if (drum && (!prompt || /different|another|new|swap|replace|instead/.test(p) || swapTo))
    return { label: prompt ? label : "New " + drum, route: "swap", swap: { sound: swapTo || drum, query: p.replace(/different|another|instead of.*|make this|make it|a |an /g, " ").trim(), match: prompt ? "different" : "close" } };
  if (/woman|female|girl|lady/.test(p)) return { label: "Woman's voice", route: "voice", voice: { target: "female singer" }, sketch: { formant: 4, presence: 2, air: 2 } };
  if (/\bman\b|male|deep(er)? voice|guy/.test(p)) return { label: "Deeper voice", route: "voice", voice: { target: "deep male singer" }, sketch: { formant: -3.5, bass: 2 } };
  if (/child|kid/.test(p)) return { label: "Child voice", route: "voice", voice: { target: "child" }, sketch: { formant: 6, lowcut: 180 } };
  if (/guitar|piano|jazz|orchestra|choir|style|sing it/.test(p)) return { label, route: "ace", ace: { prompt, strength: 0.55 }, sketch: { formant: 0.8, presence: 1 } };
  const d = {};
  if (/dark|warm|muffl|mellow/.test(p)) Object.assign(d, { highcut: /very|much/.test(p) ? 2500 : 4500, air: -4, presence: -2, bass: 1.5 });
  if (/bright|crisp|air/.test(p)) Object.assign(d, { air: 5, presence: 2.5, lowcut: 100 });
  if (/distort|dirt|grit|crunch|saturat|aggressive|harder/.test(p)) d.drive = /very|lot|heavy|more/.test(p) ? 0.75 : 0.45;
  if (/lo-?fi|crush|bit|old/.test(p)) Object.assign(d, { crush: 0.45, highcut: 6000, lowcut: 150 });
  if (/phone|telephone|radio|walkie/.test(p)) Object.assign(d, { lowcut: 450, highcut: 3200, drive: 0.3, presence: 4 });
  if (/reverb|space|big|huge|room|hall/.test(p)) d.space = /huge|big|lot/.test(p) ? 0.7 : 0.4;
  if (/wide|stereo/.test(p)) d.width = 0.6;
  if (/narrow|mono/.test(p)) d.width = -0.8;
  if (/punch|tight|compress|smash/.test(p)) d.comp = 0.65;
  if (/octave up|higher|chipmunk/.test(p)) d.octave = 1;
  if (/octave down|lower|pitch(ed)? down/.test(p)) d.octave = -1;
  if (/thin/.test(p)) d.lowcut = 300;
  if (/fat|heav|bass/.test(p)) d.bass = 4;
  if (/soft|gentle|quiet/.test(p)) Object.assign(d, { level: -3, highcut: 7000 });
  if (!Object.keys(d).length) { // no prompt (or nothing we know): a close variation
    if (kind === "vocal" || kind === "adlib" || kind === "chops") Object.assign(d, { formant: r(0.8, 1.6) * (Math.random() < 0.5 ? -1 : 1), presence: r(-2, 2.5), drive: r(0, 0.15) });
    else Object.assign(d, { bass: r(-2.5, 2.5), air: r(-3, 3), drive: r(0.05, 0.25), width: kind === "bass" ? 0 : r(-0.2, 0.3) });
  }
  return { label: prompt ? label : "Variation", route: "dsp", dsp: d, why: prompt ? "" : "A close version: small changes to the tone." };
}

// ---------------------------------------------------------------------------
// The voice assistant: "make a variation of the kick", "make the vocal darker".
function findVariationTarget(name) {
  const n = (name || "").toLowerCase().trim();
  if (!ui.state || !n) return null;
  const tracks = ui.state.tracks;
  const t = tracks.find((x) => x.name.toLowerCase() === n) || tracks.find((x) => x.name.toLowerCase().includes(n))
    || tracks.find((x) => n.includes(x.name.toLowerCase())) || tracks.find((x) => soundKind(x) === n.replace(/s$/, ""))
    || (/vocal|vox|voice/.test(n) ? tracks.find((x) => soundKind(x) === "vocal") : null)
    || (DRUM_WORDS.hat.test(n) ? tracks.find((x) => DRUM_WORDS.hat.test(x.name.toLowerCase())) : null);
  return t ? { track: t } : null;
}
window.ktVariations = {
  async make(name, prompt) {
    const target = findVariationTarget(name) || (ui.selectedClip && findClip(ui.selectedClip) ? { clip: findClip(ui.selectedClip) } : null);
    if (!target) return `I couldn't find "${name}".`;
    const plan = await makeVariation(target, prompt || "");
    return plan ? `Making "${plan.label}" for ${target.track ? target.track.name : target.clip.name}. It loads in the row underneath; the original keeps playing.` : "Nothing to vary there.";
  },
};
