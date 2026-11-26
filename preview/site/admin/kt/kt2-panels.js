// PANELS (Eman, 15 Nov 00:20): Preferences > Look gets a PANELS block for everything that is the default grey:
// the top bar, the bar-number strip, the footer, the lane windows (synth / KILLDRUM / TOY KEYS / piano roll),
// the plugin and tune windows, Preferences itself, menus, the samples drawer and the mixer.
//   GREY / SOLID / GRADIENT  = each panel's own grey (today), one colour, or a gradient
//   colour wheel             = SOLID: drag the circle. GRADIENT: drag the circles; press an empty spot to add one
//                              (max 6), double-click a circle to remove it (min 2). Angle = hue, distance = colour
//                              strength, and where a circle sits is also where its colour sits on the screen.
//   Shade                    = how bright the colours are (panels stay dark by default)
//   Colour                   = how strong the colours are: 0 grey, 100 as picked, 300 extreme (Eman, 15 Nov; the
//                              same curve as CLIPS > Colour in kt2-clipglass.js)
//   Opacity / Frost / Grain  = see-through, blur of what is behind, film grain
// Saved in localStorage "kt2.panels". No CSS applies until something moves off the default (html.k2-pn), so the
// default is today's look exactly. window.KT2_PANELS_OFF = no PANELS block and the old look always.
// ASCII only.
(function panels() {
  if (window.KT2_PANELS_OFF) return;
  const html = document.documentElement;
  if (!html.classList.contains("kt2")) return;
  const KEY = "kt2.panels";
  const DEF = { mode: "grey", shade: 16, sat: 100, opacity: 100, frost: 0, grain: 0, solid: { x: 0.55, y: -0.35 },
    stops: [{ x: -0.62, y: -0.5 }, { x: 0.7, y: 0.1 }, { x: -0.1, y: 0.72 }] };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const read = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; const v = { ...clone(DEF), ...s }; if (!Array.isArray(v.stops) || v.stops.length < 2) v.stops = clone(DEF.stops); return v; } catch (e) { return clone(DEF); } };
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  let v = read();

  // [selector, its own grey today] (measured on the dark look)
  const PANELS = [
    [".top", "#0d0d0f"], [".toprow", "#111113"], [".rack", "#0c0c0e"],
    [".tune-card", "#1b1b1e"], [".settings.k2-prefs", "#1d1d20"], [".pop", "#26262a"],
    [".samples", "#1d1d1f"], [".mixv", "#121214"],
  ];
  const P = ":root.kt2.k2-pn body";
  const st = document.createElement("style"); st.id = "k2-pn-css";
  st.textContent = PANELS.map(([s, own]) => `${P} ${s} { --pn-own: ${own}; }`).join("\n") + `
${P} :is(${PANELS.map((p) => p[0]).join(", ")}) { background: var(--pn-grain), var(--pn-paint, color-mix(in srgb, var(--pn-own) var(--pn-op), transparent)) !important;
  background-attachment: fixed !important; background-size: var(--pn-size) !important; background-repeat: repeat !important;
  -webkit-backdrop-filter: var(--pn-bf) !important; backdrop-filter: var(--pn-bf) !important; }
${P} .rack .k2-side, ${P} .k2-side { background: transparent !important; }
:root.kt2.k2-pn.k2-pn-match body :is(.top, .toprow) { background: var(--pn-grain), var(--pn-paint-hi) !important; background-attachment: fixed !important; background-size: var(--pn-size) !important; }
:root.kt2.k2-pn.k2-pn-match body .pop { background: var(--pn-paint-menu) !important; }
${P} .k2-topglass { display: none !important; }
.k2-pn-box { display: grid; gap: 10px; margin-top: 22px; }
.k2-pn-h { font: 600 11px var(--font); letter-spacing: 0.14em; color: var(--k2-ink, #e9e6f2); }
.k2-pn-box .look-row input[type=range] { accent-color: var(--acid, #E4FF3A); }
.k2-pn-box .look-row[hidden] { display: none; }
.k2-pn-seg { display: flex; gap: 1px; }
.k2-pn-seg button { flex: 1; padding: 5px 10px; border: 0; border-radius: 0; font: 600 10px var(--font); letter-spacing: 0.12em; color: var(--ink-2, #aaa); background: var(--fill, #262629); cursor: pointer; }
.k2-pn-seg button.on { background: var(--acid, #E4FF3A); color: #17171a; }
.k2-pn-paint { display: flex; gap: 16px; align-items: stretch; }
.k2-pn-paint[hidden] { display: none; }
.k2-pn-wheel { position: relative; flex: none; width: 176px; height: 176px; border-radius: 50%; cursor: crosshair; touch-action: none;
  background: radial-gradient(closest-side, #8a8a8a, rgba(138, 138, 138, 0) 100%), conic-gradient(from 90deg, hsl(0 90% 55%), hsl(60 90% 55%), hsl(120 90% 55%), hsl(180 90% 55%), hsl(240 90% 55%), hsl(300 90% 55%), hsl(360 90% 55%));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12); }
.k2-pn-dot { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; cursor: grab; touch-action: none;
  box-shadow: 0 0 0 2px #fff, 0 2px 8px rgba(0, 0, 0, 0.6); }
.k2-pn-dot.on { box-shadow: 0 0 0 2px var(--acid, #E4FF3A), 0 2px 8px rgba(0, 0, 0, 0.6); }
.k2-pn-dot:active { cursor: grabbing; }
.k2-pn-wheel[hidden] { display: none; }
.k2-pn-prev { height: 176px;  flex: 1; min-width: 60px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }`;
  (document.head || html).append(st);

  // ---- colours: wheel point -> hsl
  const hue = (p) => ((Math.atan2(p.y, p.x) * 180 / Math.PI) + 360) % 360;
  const sat = (p) => Math.min(1, Math.hypot(p.x, p.y));
  const colWheel = (p) => `hsl(${hue(p).toFixed(1)} ${(sat(p) * 90).toFixed(1)}% ${Math.max(28, v.shade)}%)`;   // dots stay visible
  const satK = (x) => (x <= 100 ? x / 100 : 1 + 11 * Math.pow((x - 100) / 200, 1.6));
  const hslA = (c, a, lift) => `hsl(${c.h.toFixed(1)} ${(Math.min(1, c.s * satK(v.sat)) * 100).toFixed(1)}% ${Math.min(90, c.l + (lift || 0)).toFixed(1)}% / ${a})`;
  // the circles to paint with: {x, y} = where on the screen (-1..1), {h, s, l} = the colour
  function paintStops() {
    if (v.mode === "solid") return [{ x: 0, y: 0, h: hue(v.solid), s: sat(v.solid), l: v.shade }];
    if (v.mode === "gradient") return v.stops.map((p) => ({ x: p.x, y: p.y, h: hue(p), s: sat(p), l: v.shade }));
    if (v.mode === "match") { const k = v.shade / DEF.shade; return (match || []).map((c) => ({ ...c, l: Math.max(2, Math.min(70, c.l * k)) })); }
    return [];
  }
  // GRADIENT: a smooth left-to-right blend of every circle, then each circle as a soft blob where it sits
  function paint(a, forPreview, lift) {
    const st = paintStops();
    if (!st.length) return "";
    if (st.length === 1) { const c = hslA(st[0], a, lift); return `linear-gradient(${c}, ${c})`; }
    const srt = st.slice().sort((p, q) => p.x - q.x);   // left-to-right order, evenly spaced: no hard edges
    const lin = `linear-gradient(90deg, ${srt.map((p, i) => `${hslA(p, a, lift)} ${(i / (srt.length - 1) * 100).toFixed(1)}%`).join(", ")})`;
    const blobs = st.map((p) => `radial-gradient(${forPreview ? "60% 60%" : (p.r || "45vw 45vh")} at ${((p.x + 1) * 50).toFixed(1)}% ${((p.y + 1) * 50).toFixed(1)}%, ${hslA(p, a, lift)}, ${hslA(p, 0, lift)})`);
    return blobs.concat(lin).join(", ");
  }
  const grainUrl = (g) => g <= 0 ? "linear-gradient(transparent, transparent)" : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ${(g / 100 * 0.32).toFixed(3)} 0 0 0 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`;

  // ---- MATCH BG (Eman, 15 Nov 00:26): a theme made from the background picture.
  // How it reads the picture: shrink it to 56 px, group the pixels into 6 colour families (k-means), and note
  // how much of the picture each family covers and WHERE it sits (its centre of mass).
  // Where the colours go:
  //  - the 3 biggest families become the panel base: kept in their own hue, toned down (strength <= 55%) and
  //    made dark (8-15% light), each placed where it sits in the picture, so the top bar takes the colours of
  //    the top of the picture, the footer the bottom, the left side the left. Panels feel cut from the picture.
  //  - the most vivid family (strongest colour that covers at least 2%) is the ACCENT: a brighter, stronger
  //    glow (up to 70% strength, 20-26% light) in a smaller blob, so it reads as a highlight, not a wash.
  //  - the top bar and the bar-number strip get the same theme 4% lighter (headers sit above the body);
  //    menus get the main base colour almost solid, so text stays easy to read.
  // Text stays readable: the base never goes above 15% light (white text keeps a contrast of 12:1 or more).
  let match = null, matchFor = "", menuCol = null;
  const rgb2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return { h, s, l: l * 100 }; };
  function themeFrom(fams) {
    // fams: [{ r, g, b, w (0..1 share), x, y (-1..1) }]
    fams = fams.filter((f) => f.w > 0.004).sort((p, q) => q.w - p.w);
    if (!fams.length) return null;
    const out = [];
    const spread = (f) => { let x = f.x * 1.7, y = f.y * 1.7; const d = Math.hypot(x, y); if (d > 0.95) { x *= 0.95 / d; y *= 0.95 / d; } return { x, y }; };
    fams.slice(0, 3).forEach((f, i) => { const c = rgb2hsl(f.r, f.g, f.b); out.push({ ...spread(f), h: c.h, s: Math.min(0.55, c.s * 0.9), l: 8 + Math.min(7, c.l * 0.12) + (i === 0 ? 0 : 1.5) }); });
    const chroma = (f) => { const c = rgb2hsl(f.r, f.g, f.b); return c.s * (1 - Math.abs(c.l - 50) / 50); };
    const viv = fams.filter((f) => f.w >= 0.02).sort((p, q) => chroma(q) - chroma(p))[0];
    if (viv && chroma(viv) > 0.12) { const c = rgb2hsl(viv.r, viv.g, viv.b); out.push({ ...spread(viv), h: c.h, s: Math.min(0.7, c.s), l: 20 + Math.min(6, c.l * 0.08), r: "32vw 34vh" }); }
    const b0 = out[0]; menuCol = { h: b0.h, s: b0.s, l: b0.l + 4 };
    return out;
  }
  function kmeans(px, W, H) {
    const N = px.length / 4, K = 6, cen = [];
    // seeds: spread out (each next seed = the pixel farthest from the ones picked), same result every time
    const dist = (i, c) => { const dr = px[i * 4] - c[0], dg = px[i * 4 + 1] - c[1], db = px[i * 4 + 2] - c[2]; return dr * dr + dg * dg + db * db; };
    let mean = [0, 0, 0]; for (let i = 0; i < N; i++) { mean[0] += px[i * 4]; mean[1] += px[i * 4 + 1]; mean[2] += px[i * 4 + 2]; }
    cen.push(mean.map((m) => m / N));
    while (cen.length < K) { let bi = 0, bd = -1; for (let i = 0; i < N; i += 3) { let d = Infinity; for (const c of cen) d = Math.min(d, dist(i, c)); if (d > bd) { bd = d; bi = i; } } cen.push([px[bi * 4], px[bi * 4 + 1], px[bi * 4 + 2]]); }
    const lab = new Uint8Array(N);
    for (let it = 0; it < 10; it++) {
      const acc = cen.map(() => [0, 0, 0, 0, 0, 0]);
      for (let i = 0; i < N; i++) { let bk = 0, bd = Infinity; for (let k = 0; k < K; k++) { const d = dist(i, cen[k]); if (d < bd) { bd = d; bk = k; } } lab[i] = bk; const a = acc[bk]; a[0] += px[i * 4]; a[1] += px[i * 4 + 1]; a[2] += px[i * 4 + 2]; a[3]++; a[4] += (i % W) / (W - 1) * 2 - 1; a[5] += Math.floor(i / W) / (H - 1) * 2 - 1; }
      acc.forEach((a, k) => { if (a[3]) cen[k] = [a[0] / a[3], a[1] / a[3], a[2] / a[3], a[3] / N, a[4] / a[3], a[5] / a[3]]; else cen[k] = [cen[k][0], cen[k][1], cen[k][2], 0, 0, 0]; });
    }
    return cen.map((c) => ({ r: c[0], g: c[1], b: c[2], w: c[3] || 0, x: c[4] || 0, y: c[5] || 0 }));
  }
  function bgSource() {
    const bg = document.getElementById("bg");
    if (!bg) return null;
    const cs = getComputedStyle(bg);
    const m = /url\("?([^")]+)"?\)/.exec(cs.backgroundImage || "");
    if (m && document.body.classList.contains("look-image")) return { url: m[1] };
    const cols = ((bg.style.background || cs.backgroundImage || "") + " " + cs.backgroundColor).match(/rgba?\([^)]+\)|#[0-9a-f]{6}\b/gi);
    if (document.body.classList.contains("look-color") && cols) return { cols };
    return { cols: [cs.backgroundColor || "#1d1d1f"] };
  }
  function analyse() {
    const src = bgSource();
    if (!src) return;
    const sig = src.url || src.cols.join("|");
    if (sig === matchFor) return;
    matchFor = sig;
    if (src.cols) {
      const fams = src.cols.map((c, i, a) => { const d = document.createElement("canvas").getContext("2d"); d.fillStyle = c; d.fillRect(0, 0, 1, 1); const p = d.getImageData(0, 0, 1, 1).data; return { r: p[0], g: p[1], b: p[2], w: 1 / a.length, x: a.length > 1 ? i / (a.length - 1) * 1.2 - 0.6 : 0, y: a.length > 1 ? (i % 2 ? 0.4 : -0.4) : 0 }; });
      match = themeFrom(fams); apply(); return;
    }
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      if (matchFor !== sig) return;
      try {
        const W = 56, H = Math.max(8, Math.round(56 * img.naturalHeight / Math.max(1, img.naturalWidth)));
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
        match = themeFrom(kmeans(g.getImageData(0, 0, W, H).data, W, H));
      } catch (e) { match = null; }
      apply();
    };
    img.onerror = () => { if (matchFor === sig) { match = null; apply(); } };
    img.src = src.url;
  }

  const isOn = () => v.mode !== "grey" || v.opacity !== DEF.opacity || v.frost !== DEF.frost || v.grain !== DEF.grain;
  function apply() {
    const s = html.style, a = (v.opacity / 100).toFixed(2);
    if (v.mode === "match") analyse();
    html.classList.toggle("k2-pn", isOn());
    html.classList.toggle("k2-pn-match", v.mode === "match" && !!match);
    s.setProperty("--pn-op", v.opacity + "%");
    s.setProperty("--pn-bf", v.frost > 0 ? `blur(${Math.round(v.frost * 0.4)}px)` : "none");   // 100% = 40px
    s.setProperty("--pn-grain", grainUrl(v.grain));
    const pt = paint(a);
    if (pt) s.setProperty("--pn-paint", pt); else s.removeProperty("--pn-paint");
    if (pt && v.mode === "match") {
      s.setProperty("--pn-paint-hi", paint(a, false, 4));
      const mc = { ...menuCol, l: menuCol.l * v.shade / DEF.shade };
      s.setProperty("--pn-paint-menu", `linear-gradient(${hslA(mc, Math.max(0.92, a))}, ${hslA(mc, Math.max(0.92, a))})`);
    } else { s.removeProperty("--pn-paint-hi"); s.removeProperty("--pn-paint-menu"); }
    const n = paintStops().length, layers = n > 1 ? n + 1 : 1;   // the grain tiles, the colour layers fill the window
    s.setProperty("--pn-size", ["160px 160px"].concat(Array(layers).fill("100vw 100vh")).join(", "));
    if (box) paintUi();
    if (window.KT2BgPos) KT2BgPos.apply();   // see-through panels = picture covers the whole window (ui/kt2-prefs.js)
  }

  // ---- the PANELS block in Preferences > Look
  let box = null, wheel = null, prev = null, paintRow = null, sel = 0;
  const inputs = {};
  function slider(parent, k, label, min, max) {
    const lab = document.createElement("label"); lab.className = "look-row";
    const sp = document.createElement("span"); sp.textContent = label;
    const inp = document.createElement("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.value = v[k]; inp.id = "k2-pn-" + k;
    const b = document.createElement("b"); b.textContent = v[k] + "%";
    inp.oninput = () => { v[k] = Number(inp.value); b.textContent = inp.value + "%"; apply(); };
    inp.onchange = write;
    inp.ondblclick = () => { v[k] = DEF[k]; inp.value = DEF[k]; b.textContent = DEF[k] + "%"; apply(); write(); };
    lab.append(sp, inp, b); parent.append(lab);
    inputs[k] = { inp, b, lab };
  }
  function build(pane) {
    box = document.createElement("div"); box.className = "k2-pn-box"; box.id = "k2-pn";
    const h = document.createElement("div"); h.className = "k2-pn-h"; h.textContent = "PANELS"; box.append(h);
    const seg = document.createElement("div"); seg.className = "k2-pn-seg";
    for (const [m, label] of [["grey", "GREY"], ["solid", "SOLID"], ["gradient", "GRADIENT"], ["match", "MATCH BG"]]) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.mode = m;
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); v.mode = m; sel = 0; apply(); write(); };
      seg.append(b);
    }
    box.append(seg);
    paintRow = document.createElement("div"); paintRow.className = "k2-pn-paint";
    wheel = document.createElement("div"); wheel.className = "k2-pn-wheel"; wheel.id = "k2-pn-wheel";
    prev = document.createElement("div"); prev.className = "k2-pn-prev";
    paintRow.append(wheel, prev); box.append(paintRow);
    slider(box, "shade", "Shade", 4, 70);
    slider(box, "sat", "Colour", 0, 300);
    slider(box, "opacity", "Opacity", 0, 100);
    slider(box, "frost", "Frost", 0, 100);
    slider(box, "grain", "Grain", 0, 100);
    pane.append(box);
    wheel.addEventListener("pointerdown", wheelDown);
    paintUi();
  }
  const pts = () => v.mode === "solid" ? [v.solid] : v.stops;
  function paintUi() {
    box.querySelectorAll(".k2-pn-seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === v.mode));
    const colour = v.mode !== "grey";
    paintRow.hidden = !colour; inputs.shade.lab.hidden = !colour; inputs.sat.lab.hidden = !colour;
    for (const k in inputs) { inputs[k].inp.value = v[k]; inputs[k].b.textContent = v[k] + "%"; }
    if (!colour) return;
    wheel.hidden = v.mode === "match";
    prev.style.background = paint(1, true);
    if (v.mode === "match") return;
    const list = pts();
    while (wheel.children.length > list.length) wheel.lastChild.remove();
    while (wheel.children.length < list.length) { const d = document.createElement("div"); d.className = "k2-pn-dot"; wheel.append(d); }
    list.forEach((p, i) => { const d = wheel.children[i]; d.dataset.i = i; d.style.left = ((p.x + 1) * 50) + "%"; d.style.top = ((p.y + 1) * 50) + "%"; d.style.background = colWheel(p); d.classList.toggle("on", v.mode === "gradient" && i === sel); });
  }
  function toWheel(e) {
    const r = wheel.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1;
    const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; }
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  }
  // the click that ends a drag can land outside Preferences, which would close it: eat that one click
  function swallowClick() {
    const eat = (e) => { e.stopPropagation(); e.preventDefault(); done(); };
    const done = () => { document.removeEventListener("click", eat, true); clearTimeout(t); };
    document.addEventListener("click", eat, true);
    const t = setTimeout(done, 400);
  }
  let lastDown = { t: 0, i: -1 };
  function wheelDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const dot = e.target.closest(".k2-pn-dot");
    let i;
    if (dot) {
      i = Number(dot.dataset.i);
      // double-click a circle = remove it (gradient keeps at least 2)
      const now = performance.now();
      if (v.mode === "gradient" && lastDown.i === i && now - lastDown.t < 330 && v.stops.length > 2) {
        v.stops.splice(i, 1); sel = Math.min(sel, v.stops.length - 1); lastDown = { t: 0, i: -1 }; apply(); write(); return;
      }
      lastDown = { t: now, i };
    } else if (v.mode === "gradient") {
      if (v.stops.length >= 6) return;
      v.stops.push(toWheel(e)); i = v.stops.length - 1; lastDown = { t: 0, i: -1 };
    } else { v.solid = toWheel(e); i = 0; }
    sel = i; apply();
    const move = (ev) => { const p = toWheel(ev); if (v.mode === "solid") v.solid = p; else if (v.stops[i]) v.stops[i] = p; apply(); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); write(); swallowClick(); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  apply();
  function start() {
    const pane = document.querySelector('.k2-prefs .k2p-pane[data-pane="look"]');
    if (pane && !box) build(pane);
    // a new background picture or look = a new MATCH BG theme
    const re = () => { if (v.mode === "match") apply(); };
    const bg = document.getElementById("bg");
    if (bg) new MutationObserver(re).observe(bg, { attributes: true, attributeFilter: ["style"] });
    new MutationObserver(re).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.KT2Panels = { get: () => clone(v), set: (o) => { v = { ...v, ...clone(o) }; apply(); write(); }, reset: () => { v = clone(DEF); apply(); write(); } };
})();
