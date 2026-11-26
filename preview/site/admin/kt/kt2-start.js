// START SCREEN (Eman, 10 Nov): the "Drop a beat in" popup on a new, empty project is now a KILLTOY start
// screen: logo, a live yellow scope that shows what each choice makes (a synth wave, a drum step row,
// a flat line), ONE big button START WITH A SYNTH, and two small ones: DRUM PATTERN (a KILLDRUM lane with a
// starter beat, open in the roll, same as + Instrument > KILLDRUM) and JUST OPEN. "Load beat" is gone as a
// button; dropping audio on the window still works (quiet hint at the bottom, turns yellow while dragging).
// Enter = start with a synth. The old buttons keep their app.js handlers (moved, not copied); the old card
// is only hidden. KT2_START_OLD = the old popup.
(function () {
  if (window.KT2_START_OLD) return;
  const empty = document.getElementById("empty");
  const oldCard = empty && empty.querySelector(".empty-card");
  const synthBtn = document.getElementById("btn-tm-empty"), skipBtn = document.getElementById("btn-skip-empty");
  if (!empty || !oldCard || !synthBtn || !skipBtn || typeof run !== "function") return;
  document.documentElement.classList.add("k2-start");

  const css = document.createElement("style");
  css.textContent = `
.k2-start #empty { background: radial-gradient(120% 90% at 50% 45%, rgba(10, 10, 12, 0.55), rgba(6, 6, 8, 0.88)); }
.k2-start #empty .empty-card { display: none; }
.k2st { pointer-events: auto; position: relative; width: min(520px, calc(100vw - 32px)); padding: 34px 34px 22px; box-sizing: border-box;
  background: #111113; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.07); text-align: center;
  animation: k2st-in 0.38s cubic-bezier(0.2, 0.9, 0.2, 1.15) both; overflow: hidden; }
@keyframes k2st-in { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
.k2st::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.07; mix-blend-mode: screen;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
.k2st i.k2st-c { position: absolute; width: 12px; height: 12px; border: 0 solid var(--acid, #E4FF3A); pointer-events: none; }
.k2st i.k2st-c.a { left: 10px; top: 10px; border-left-width: 2px; border-top-width: 2px; }
.k2st i.k2st-c.b { right: 10px; top: 10px; border-right-width: 2px; border-top-width: 2px; }
.k2st i.k2st-c.c { left: 10px; bottom: 10px; border-left-width: 2px; border-bottom-width: 2px; }
.k2st i.k2st-c.d { right: 10px; bottom: 10px; border-right-width: 2px; border-bottom-width: 2px; }
.k2st-logo { height: 40px; display: block; margin: 2px auto 0; filter: drop-shadow(0 0 18px rgba(228, 255, 58, 0.12)); animation: k2st-float 4s ease-in-out infinite; }
@keyframes k2st-float { 50% { transform: translateY(-3px) rotate(-1deg); } }
.k2st-scope { display: block; width: 100%; height: 96px; margin: 18px 0 20px; }
.k2st-go { position: relative; display: flex; align-items: center; justify-content: center; gap: 14px; width: 100%; height: 66px; margin: 0;
  padding: 0 22px; border: 0; border-radius: 0; background: var(--acid, #E4FF3A); color: #121014; cursor: pointer;
  font: 800 17px "Unbounded", var(--font, system-ui); letter-spacing: 0.06em; box-shadow: 0 0 0 0 rgba(228, 255, 58, 0.5);
  transition: transform 0.12s, box-shadow 0.25s; }
.k2st-go:hover { transform: translate(-3px, -3px); box-shadow: 6px 6px 0 0 #8b6cff, 0 0 40px rgba(228, 255, 58, 0.25); }
.k2st-go:active { transform: translate(0, 0); box-shadow: 0 0 0 0 #8b6cff; }
.k2st-go svg { width: 22px; height: 22px; flex: none; transition: transform 0.2s; }
.k2st-go:hover svg { transform: translateX(4px); }
.k2st-row { display: flex; gap: 10px; margin-top: 10px; }
.k2st-row button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 9px; height: 42px; margin: 0; padding: 0 12px;
  border: 0; border-radius: 0; background: #1b1b1f; color: #d9d6de; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); cursor: pointer;
  font: 800 10.5px "Unbounded", var(--font, system-ui); letter-spacing: 0.08em; transition: background 0.15s, color 0.15s, box-shadow 0.15s; }
.k2st-row button:hover { background: #222227; color: #fff; box-shadow: inset 0 0 0 1px var(--acid, #E4FF3A); }
.k2st-row button svg { width: 15px; height: 15px; flex: none; }
.k2st-hint { margin-top: 18px; font: 500 11px var(--font, system-ui); letter-spacing: 0.04em; color: #6b6773; transition: color 0.2s; }
.k2st-hint b { font-weight: 600; color: #8c8894; transition: color 0.2s; }
.k2st.drag { box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), inset 0 0 0 2px var(--acid, #E4FF3A); }
.k2st.drag .k2st-hint, .k2st.drag .k2st-hint b { color: var(--acid, #E4FF3A); }
@media (prefers-reduced-motion: reduce) { .k2st, .k2st-logo { animation: none; } }
`;
  // Eman 12 Nov: no purple offset block behind START WITH A SYNTH on hover/hold; while held the button
  // itself just turns purple. KT2_START_GO_OLD = the old offset block.
  if (!window.KT2_START_GO_OLD) css.textContent += `
.k2st-go { transition: background 0.1s, color 0.1s, box-shadow 0.25s; }
.k2st-go:hover { transform: none; box-shadow: 0 0 40px rgba(228, 255, 58, 0.25); }
.k2st-go:active { transform: none; background: #8b6cff; color: #121014; box-shadow: 0 0 40px rgba(139, 108, 255, 0.35); }
`;
  document.head.appendChild(css);

  const ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"><path d="M4 12h14M13 6l6 6-6 6"/></svg>';
  const ICON_GRID = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="4" height="4"/><rect x="6" y="6" width="4" height="4"/><rect x="11" y="1" width="4" height="4"/><rect x="1" y="11" width="4" height="4"/><rect x="11" y="11" width="4" height="4"/></svg>';
  const ICON_OPEN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="12" height="12"/></svg>';

  const card = document.createElement("div");
  card.className = "k2st";
  card.innerHTML = '<i class="k2st-c a"></i><i class="k2st-c b"></i><i class="k2st-c c"></i><i class="k2st-c d"></i>' +
    '<img class="k2st-logo" src="logo.png" alt="KILLTOY"><canvas class="k2st-scope"></canvas><div class="k2st-slot-go"></div>' +
    '<div class="k2st-row"><span class="k2st-slot-pat"></span><span class="k2st-slot-skip"></span></div>' +
    '<div class="k2st-hint">or drop a <b>beat</b> anywhere</div>';
  empty.appendChild(card);

  // The real buttons move in (their app.js onclick stays); new words and icons.
  synthBtn.className = "k2st-go"; synthBtn.innerHTML = "<span>START WITH A SYNTH</span>" + ICON_ARROW; synthBtn.removeAttribute("title");
  skipBtn.className = ""; skipBtn.innerHTML = ICON_OPEN + "<span>JUST OPEN</span>"; skipBtn.removeAttribute("title");
  const patBtn = document.createElement("button");
  patBtn.id = "btn-pat-empty"; patBtn.innerHTML = ICON_GRID + "<span>DRUM PATTERN</span>";
  card.querySelector(".k2st-slot-go").replaceWith(synthBtn);
  card.querySelector(".k2st-slot-pat").replaceWith(patBtn);
  card.querySelector(".k2st-slot-skip").replaceWith(skipBtn);

  // DRUM PATTERN: a KILLDRUM lane with a starter clip, open in the roll (same as + Instrument > KILLDRUM).
  patBtn.onclick = async () => {
    const U = typeof ui !== "undefined" ? ui : null;
    let kd = null;
    try { kd = (await loadPlugins()).find((p) => p.instrument && /killdrum|toy ?drums/i.test(p.name)); } catch (e) {}
    const r = await run("newInstrumentLane", { key: kd ? kd.key : "builtin:toydrums" });
    if (!r || !r.ok) return;
    if (r.trackId && typeof selectTrack === "function") selectTrack(r.trackId);
    const spb = typeof secPerBar === "function" ? secPerBar() : 2;
    const bars = typeof NEW_PATTERN_BARS === "function" ? NEW_PATTERN_BARS() : 4;
    const c = await run("newMidiClip", { trackId: r.trackId, start: 0 * spb, bars });
    if (c && c.ok && U) { U.selectedClip = c.clipId; U.openRollFor = c.clipId; if (typeof render === "function") render(); }
  };

  // Enter = the big button, while the card shows and nothing is being typed.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || empty.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if (a && a.tagName === "BUTTON" && card.contains(a)) return;   // that button handles its own Enter
    e.preventDefault(); synthBtn.click();
  });

  // Dragging a file over the window: the card and the hint light up (the drop itself is app.js's).
  let dragN = 0;
  const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
  window.addEventListener("dragenter", (e) => { if (hasFiles(e)) { dragN++; card.classList.add("drag"); } });
  window.addEventListener("dragleave", () => { if (--dragN <= 0) { dragN = 0; card.classList.remove("drag"); } });
  window.addEventListener("drop", () => { dragN = 0; card.classList.remove("drag"); });

  // ------------------------------------------------------------------ the scope
  // mode: synth (a wobbling saw/sine morph), pattern (16 steps, a beat running), open (a flat line breathing).
  const cv = card.querySelector(".k2st-scope"), g = cv.getContext("2d");
  let mode = "synth", mix = { synth: 1, pattern: 0, open: 0 }, mx = 0.5;
  const hover = (el, m) => { el.addEventListener("pointerenter", () => { mode = m; }); el.addEventListener("pointerleave", () => { mode = "synth"; }); };
  hover(synthBtn, "synth"); hover(patBtn, "pattern"); hover(skipBtn, "open");
  card.addEventListener("pointermove", (e) => { const b = card.getBoundingClientRect(); mx = (e.clientX - b.left) / b.width; });
  const BEAT = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0];    // a little trap kick/clap row
  const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
  const css2 = getComputedStyle(document.documentElement);
  const ACID = (css2.getPropertyValue("--acid") || "").trim() || "#E4FF3A";
  let w = 0, h = 0, dpr = 1;

  function frame(now) {
    requestAnimationFrame(frame);
    if (empty.hidden || !card.isConnected) return;
    const r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    if (Math.round(r.width * dpr) !== w || Math.round(r.height * dpr) !== h) { w = cv.width = Math.round(r.width * dpr); h = cv.height = Math.round(r.height * dpr); }
    if (!w || !h) return;
    for (const k in mix) mix[k] += ((k === mode ? 1 : 0) - mix[k]) * 0.12;
    const t = now / 1000;
    g.clearRect(0, 0, w, h);
    const mid = h / 2;

    // Eman 12 Nov: on DRUM PATTERN the line and the grid fade away and the steps are round dots that
    // light up as the beat plays. KT2_START_DOTS_OLD = the old squares over the flat wave.
    const DOTS = !window.KT2_START_DOTS_OLD, lineA = DOTS ? Math.max(0, 1 - mix.pattern * 1.15) : 1;

    // grid: thin centre line + ticks
    g.globalAlpha = lineA;
    g.fillStyle = "rgba(255,255,255,0.06)";
    g.fillRect(0, Math.round(mid), w, Math.max(1, dpr));
    for (let i = 1; i < 16; i++) g.fillRect(Math.round((i / 16) * w), mid - 3 * dpr, Math.max(1, dpr), 6 * dpr);

    // the wave (synth + open share it; open flattens it)
    const amp = (0.36 * mix.synth + 0.03 * mix.open + 0.1 * mix.pattern) * h;
    const morph = 0.5 + 0.5 * Math.sin(t * 0.7);          // sine <-> saw
    const cyc = 2.2 + 1.4 * mx;                             // the mouse tunes it
    g.beginPath();
    for (let x = 0; x <= w; x += 2 * dpr) {
      const u = x / w, ph = (u * cyc + t * 0.35) % 1;
      const sine = Math.sin(ph * Math.PI * 2), saw = 1 - 2 * ph;
      const wob = 1 + 0.12 * Math.sin(t * 5 + u * 9);
      const env = Math.sin(Math.PI * u);                     // fade at both ends
      const y = mid - (sine * (1 - morph) + saw * morph * 0.85) * amp * wob * env;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.strokeStyle = ACID; g.lineWidth = 2 * dpr; g.lineJoin = "round";
    g.shadowColor = ACID; g.shadowBlur = 14 * dpr * (0.4 + 0.6 * mix.synth);
    g.globalAlpha = (0.25 + 0.75 * Math.max(mix.synth, mix.open)) * lineA;
    if (g.globalAlpha > 0.005) g.stroke();
    g.shadowBlur = 0; g.globalAlpha = 1;

    // the drum steps, fading in on DRUM PATTERN
    if (DOTS && mix.pattern > 0.02) {
      // two rows of round pads (purple = clap/snare on top, acid = kick below); each one flashes and
      // swells when the playhead hits it, then fades back like a lit drum pad.
      const pos = t * 8, step = Math.floor(pos) % 16, frac = pos - Math.floor(pos);
      const sw = w / 16, r0 = Math.min(sw * 0.3, h * 0.13);
      const rows = [{ pat: SNARE, y: mid - r0 * 1.5, col: "#8b6cff" }, { pat: BEAT, y: mid + r0 * 1.5, col: ACID }];
      for (const row of rows) for (let i = 0; i < 16; i++) {
        const cx = (i + 0.5) * sw, on = row.pat[i];
        const since = (step - i + 16) % 16 + frac;            // steps since the playhead passed this pad
        const glow = since < 4 ? Math.pow(1 - since / 4, 2) : 0;
        g.beginPath();
        if (on) {
          const rr = r0 * (0.86 + 0.32 * glow);
          g.globalAlpha = mix.pattern * (0.38 + 0.62 * glow);
          g.fillStyle = row.col; g.shadowColor = row.col; g.shadowBlur = 22 * dpr * glow;
          g.arc(cx, row.y, rr, 0, Math.PI * 2); g.fill();
        } else {
          g.globalAlpha = mix.pattern * (0.1 + 0.25 * (i === step ? 1 - frac : 0));
          g.fillStyle = "#ffffff"; g.shadowBlur = 0;
          g.arc(cx, row.y, r0 * 0.22, 0, Math.PI * 2); g.fill();
        }
      }
      g.shadowBlur = 0; g.globalAlpha = 1;
    } else if (mix.pattern > 0.02) {
      const step = Math.floor(t * 8) % 16, sw = w / 16, s = Math.min(sw * 0.62, h * 0.24);
      for (let i = 0; i < 16; i++) {
        const cx = (i + 0.5) * sw, on = BEAT[i] || SNARE[i], hit = i === step;
        const yy = BEAT[i] ? mid + s * 0.15 : SNARE[i] ? mid - s * 1.15 : mid - s / 2;
        g.globalAlpha = mix.pattern * (on ? (hit ? 1 : 0.75) : hit ? 0.5 : 0.12);
        g.fillStyle = on ? (SNARE[i] ? "#8b6cff" : ACID) : "#ffffff";
        const sz = on ? s * (hit ? 1.12 : 1) : s * 0.32;
        g.fillRect(cx - sz / 2, (on ? yy : mid - sz / 2) - (hit && on ? s * 0.06 : 0), sz, sz);
      }
      g.globalAlpha = 1;
    }
  }
  requestAnimationFrame(frame);
})();
