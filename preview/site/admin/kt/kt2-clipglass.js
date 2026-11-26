// CLIP GLASS (Eman, 13 Nov 03:47): with a background PICTURE, Preferences > Look gets a CLIPS block that
// turns the full-colour MIDI and audio clips (one shared setting) into see-through glass:
//   Fill   = the clip colour's opacity (100% = today's solid clip)
//   Frost  = blur of the picture seen through the clip
//   Grain  = film grain on the clip body
//   Colour = saturation of the clip colour and of the picture seen through it. 0 = grey, 100 = as is, and
//            past 100 it climbs steeply: 200 = about 4.6x, 300 = 12x, extreme (Eman, 15 Nov: 300% barely changed
//            anything). KT2_COLOUR_OLD = the old straight 0-300% on the picture behind only.
//   Edge   = a glow + line round each clip in its own colour
// and a separate WAVE block for the waveform / MIDI notes (Eman 03:48): their own opacity, plus DARK
// (today) or BRIGHT. Only on a picture look; colour/dark looks never change. Saved in localStorage
// "kt2.clipGlass". The defaults are today's look exactly: no CSS applies until a value moves off its
// default (html.k2-cg). window.KT2_CLIPGLASS_OFF = no CLIPS block and the old look always.
(function clipGlass() {
  if (window.KT2_CLIPGLASS_OFF) return;
  const KEY = "kt2.clipGlass";
  // [key, label, min, max, default, unit]
  const SLIDERS = [
    ["fill", "Fill", 0, 100, 100],
    ["frost", "Frost", 0, 100, 0],
    ["grain", "Grain", 0, 100, 0],
    ["sat", "Colour", 0, 300, 100],
    ["edge", "Edge", 0, 100, 0],
  ];
  const WAVE = [["wave", "Opacity", 0, 100, 100]];
  const DEF = { bright: false };
  for (const s of SLIDERS.concat(WAVE)) DEF[s[0]] = s[4];

  // the Colour slider (0..300) -> how much stronger the colour gets; same curve as PANELS > Colour (kt2-panels.js)
  const satK = (x) => (window.KT2_COLOUR_OLD ? x / 100 : x <= 100 ? x / 100 : 1 + 11 * Math.pow((x - 100) / 200, 1.6));
  const read = () => { try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY) || "{}") || {}) }; } catch (e) { return { ...DEF }; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  let v = read();

  const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";
  const C = "html.kt2.k2-cg body.look-image .clip.k2-full";
  const st = document.createElement("style"); st.id = "k2-cg-css";
  st.textContent = `
${C} { --cg-col: var(--c); background: color-mix(in srgb, var(--cg-col) var(--cg-fill), transparent);
  -webkit-backdrop-filter: blur(var(--cg-frost)) saturate(var(--cg-sat)); backdrop-filter: blur(var(--cg-frost)) saturate(var(--cg-sat));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cg-col) var(--cg-edge), transparent), 0 0 var(--cg-glow) color-mix(in srgb, var(--cg-col) var(--cg-edge2), transparent); }
/* stronger colour, same hue: chroma up (capped so it stays a real colour, no hue slide), lightness drawn toward
   the middle where the screen has the most colour room */
@supports (color: oklch(from red l c h)) { ${C} { --cg-col: oklch(from var(--c) calc(l - (l - 0.62) * var(--cg-kl, 0)) min(0.3, calc(c * var(--cg-ck, 1))) h); } }
html:not(.k2-title-flat).kt2.k2-cg body.look-image .clip.k2-full { background: linear-gradient(180deg, transparent 0 17px, rgba(0, 0, 0, 0.14) 17px), color-mix(in srgb, var(--cg-col) var(--cg-fill), transparent); }
${C}.selected { box-shadow: inset 0 0 0 2px #fff, 0 0 var(--cg-glow) color-mix(in srgb, var(--cg-col) var(--cg-edge2), transparent); }
${C}::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: ${NOISE}; background-size: 160px 160px; mix-blend-mode: overlay; opacity: var(--cg-grain); }
${C} canvas { opacity: var(--cg-wave); }
html.kt2.k2-cg.k2-cg-bright body.look-image .clip.k2-full canvas { filter: invert(1); }
html.kt2.k2-cg.k2-cg-bright body.look-image .clip.k2-full .clip-label .nm { color: rgba(255, 255, 255, 0.86); }
html.kt2.k2-cg.k2-cg-bright body.look-image .clip.k2-full :is(.clip-mute.clip-mutep:not(.off), .k2-loopbtn:not(.on), .k2-mp:not(.on)) { color: rgba(255, 255, 255, 0.78); background: rgba(255, 255, 255, 0.14); }
.k2-cg-box { display: grid; gap: 10px; margin-top: 18px; }
.k2-cg-box[hidden] { display: none; }
.k2-cg-h { font: 600 11px var(--font); letter-spacing: 0.14em; color: var(--k2-ink, #e9e6f2); margin-top: 6px; }
.k2-cg-box .look-row input[type=range] { accent-color: var(--acid, #E4FF3A); }
.k2-cg-seg { display: flex; gap: 1px; }
.k2-cg-seg button { flex: 1; padding: 5px 10px; border: 0; border-radius: 0; font: 600 10px var(--font); letter-spacing: 0.12em; color: var(--ink-2, #aaa); background: var(--fill, #262629); cursor: pointer; }
.k2-cg-seg button.on { background: var(--acid, #E4FF3A); color: #17171a; }`;
  (document.head || document.documentElement).append(st);

  function apply() {
    const r = document.documentElement, s = r.style;
    const on = Object.keys(DEF).some((k) => v[k] !== DEF[k]);
    r.classList.toggle("k2-cg", on);
    r.classList.toggle("k2-cg-bright", !!v.bright);
    s.setProperty("--cg-fill", v.fill + "%");
    s.setProperty("--cg-frost", Math.round(v.frost * 0.3 * 10) / 10 + "px");   // 100% = 30px
    s.setProperty("--cg-sat", Math.round(satK(v.sat) * 100) + "%");
    s.setProperty("--cg-ck", window.KT2_COLOUR_OLD ? "1" : satK(v.sat).toFixed(3));   // the clip colour itself
    s.setProperty("--cg-kl", window.KT2_COLOUR_OLD || v.sat <= 100 ? "0" : (0.6 * (1 - 1 / satK(v.sat))).toFixed(3));
    s.setProperty("--cg-grain", String(v.grain / 100 * 0.6));
    s.setProperty("--cg-edge", Math.round(26 + v.edge * 0.74) + "%");             // 0 = today's faint line
    s.setProperty("--cg-edge2", Math.round(v.edge * 0.8) + "%");
    s.setProperty("--cg-glow", Math.round(v.edge * 0.16) + "px");
    s.setProperty("--cg-wave", String(v.wave / 100));
  }
  apply();

  let box = null;
  const inputs = {};
  function row(parent, [k, label, min, max, def]) {
    const lab = document.createElement("label"); lab.className = "look-row";
    const sp = document.createElement("span"); sp.textContent = label;
    const inp = document.createElement("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.value = v[k]; inp.id = "k2-cg-" + k;
    const b = document.createElement("b"); b.textContent = v[k] + "%";
    inp.oninput = () => { v[k] = Number(inp.value); b.textContent = inp.value + "%"; apply(); };
    inp.onchange = () => write(v);
    inp.ondblclick = () => { v[k] = def; inp.value = def; b.textContent = def + "%"; apply(); write(v); };
    lab.append(sp, inp, b); parent.append(lab);
    inputs[k] = { inp, b };
  }
  function build() {
    const host = document.getElementById("look-sliders");
    if (!host || box) return;
    box = document.createElement("div"); box.className = "k2-cg-box"; box.id = "k2-cg";
    const h1 = document.createElement("div"); h1.className = "k2-cg-h"; h1.textContent = "CLIPS"; box.append(h1);
    SLIDERS.forEach((s) => row(box, s));
    const h2 = document.createElement("div"); h2.className = "k2-cg-h"; h2.textContent = "WAVE / NOTES"; box.append(h2);
    WAVE.forEach((s) => row(box, s));
    const seg = document.createElement("div"); seg.className = "k2-cg-seg";
    const mk = (label, bright) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.bright = bright ? "1" : "0";
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); v.bright = bright; apply(); write(v); paintSeg(); };
      return b;
    };
    seg.append(mk("DARK", false), mk("BRIGHT", true));
    box.append(seg);
    host.append(box);
    paintSeg(); sync();
  }
  function paintSeg() { if (box) box.querySelectorAll(".k2-cg-seg button").forEach((b) => b.classList.toggle("on", (b.dataset.bright === "1") === !!v.bright)); }
  // Picture looks only (Eman 03:47): hidden on dark / light / colour looks.
  function sync() { if (box) box.hidden = !document.body.classList.contains("look-image"); }

  function start() {
    build(); sync();
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.KT2ClipGlass = { get: () => ({ ...v }), set: (o) => { v = { ...v, ...o }; apply(); write(v); if (box) { for (const k in inputs) { inputs[k].inp.value = v[k]; inputs[k].b.textContent = v[k] + "%"; } paintSeg(); } }, reset: () => window.KT2ClipGlass.set({ ...DEF }) };
})();
