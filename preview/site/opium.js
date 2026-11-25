/* OPIUM look (Eman 24 Nov 2026). A second full-site look on top of the normal (OG) one.
   Switch: admin top bar "LOOK  OG | OPIUM", or ?look=opium / ?look=og on any page (remembered in localStorage "ck-look").
   Customers keep OG unless they have the switch set. OPIUM_PUBLIC = true would make OPIUM the default for everyone.
   Everything lives in this file + opium.css + img/op/ + fonts/op-*. Remove the <script src="/opium.js"> line = OG only. */
/* PREVIEW PRICE (Eman 25 Nov): every paid pack shows $24 on the preview only (pages.dev hosts). Never runs on corekult.com. Set PREVIEW_PRICE = 0 to remove. */
(function () {
  const PREVIEW_PRICE = 24;
  try {
    if (!PREVIEW_PRICE || !/\.pages\.dev$/.test(location.hostname) || !window.__ckP) return;
    const fix = (d) => { try { ((d && d.products) || []).forEach((p) => { if (+p.price > 0) { p.price = PREVIEW_PRICE; p.priceUsd = PREVIEW_PRICE; p.priceEur = PREVIEW_PRICE; } }); } catch (e) {} return d; };
    try { if (!sessionStorage.getItem('ck-pp')) { localStorage.removeItem('ck-cur'); sessionStorage.setItem('ck-pp', '1'); } } catch (e) {}   /* a leftover display currency (USD/SEK) made 24 show as ~25.92 or ~270 */
    window.__ckP = window.__ckP.then(fix);
    const f0 = window.fetch; window.fetch = function (u) { const r = f0.apply(this, arguments); return /products\.json/.test(String(u)) ? r.then((res) => res.clone().json().then((d) => new Response(JSON.stringify(fix(d)), { status: 200, headers: { "content-type": "application/json" } }))) : r; };
  } catch (e) {}
})();
(function () {
  const OPIUM_PUBLIC = false;
  let look = OPIUM_PUBLIC ? "opium" : "og";
  try {
    const q = new URLSearchParams(location.search).get("look");
    if (q === "og" || q === "opium" || q === "opium2") localStorage.setItem("ck-look", q);
    look = localStorage.getItem("ck-look") || look;
  } catch (e) {}
  const ON = look === "opium" || look === "opium2";
  const O2 = look === "opium2";   // OPIUM 2 (Eman 24 Nov 19:48): version 9 look + version 6 black film background, ref waveforms, vector logo
  /* OPIUM versions 1-10 (Eman 24 Nov 04:47: "make 10 different versions ... skip the randomness"). ?opv=N or the admin bar V buttons. */
  let OPV = 1;
  try { const q2 = +new URLSearchParams(location.search).get("opv"); if (q2 >= 1 && q2 <= 10) localStorage.setItem("ck-opv", q2); OPV = +localStorage.getItem("ck-opv") || 1; } catch (e) {}
  if (!(OPV >= 1 && OPV <= 10)) OPV = 1;
  if (O2) OPV = 9;
  window.OPIUM = ON;
  const H = document.documentElement;
  if (ON) {
    H.classList.add("opium", "opv-" + OPV); if (O2) H.classList.add("opium2");
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/opium.css?v=6"; document.head.appendChild(l);
  }

  /* ---------- admin switch (in the outlined top line of admin mode) ---------- */
  function admSwitch() {
    const top = document.querySelector(".adm-top"); if (!top || top.querySelector(".op-sw")) return;
    const g = document.createElement("div"); g.className = "mt op-sw";
    g.innerHTML = `<button data-look="og"${ON ? "" : ' class="on"'}>OG</button><button data-look="opium" class="op-b${ON && !O2 ? " on" : ""}">OPIUM</button><button data-look="opium2" class="op-b${O2 ? " on" : ""}">OPIUM 2</button>`;
    top.insertBefore(g, top.children[1] || null);
    if (ON && !O2) { const v = document.createElement("div"); v.className = "mt op-sw op-vs"; v.innerHTML = Array.from({ length: 10 }, (_, i) => `<button data-opv="${i + 1}"${i + 1 === OPV ? ' class="on"' : ""}>${i + 1}</button>`).join(""); g.after(v); }
  }
  new MutationObserver(admSwitch).observe(H, { childList: true, subtree: true });
  // one listener on the page (the admin bar can redraw itself, so a listener on the buttons could get lost)
  document.addEventListener("click", (e) => { const v = e.target.closest && e.target.closest(".op-vs [data-opv]"); if (v) { e.preventDefault(); e.stopPropagation(); try { localStorage.setItem("ck-opv", v.dataset.opv); } catch (x) {} location.reload(); return; } }, true);
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest(".op-sw [data-look]"); if (!b) return; e.preventDefault(); e.stopPropagation(); try { localStorage.setItem("ck-look", b.dataset.look); } catch (x) {} location.reload(); }, true);
  if (!ON) return;

  const IMG = "/img/op/";
  const MJ = Array.from({ length: 12 }, (_, i) => IMG + "mj/m" + String(i).padStart(2, "0") + ".webp");
  const ST = Array.from({ length: 15 }, (_, i) => IMG + "st/s" + String(i).padStart(2, "0") + ".webp");
  const SPK = [[1, "PLAY LOUD"], [2, "OPIUM"], [3, "NO SLEEP"], [4, "STACK IT"]].map(([i, t]) => ({ t, u: IMG + "spk" + i + ".webp" }));   // Eman 24 Nov: no HEAR IT FIRST
  let seed = 7; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = (a) => a[Math.floor(R() * a.length)];
  const glyph = (side, h, red) => O2 ? `<i class="op-gl op-gv${red ? " red" : ""}" style="height:${h}px;width:${Math.round(h * 336 / 912)}px;--g:url(${IMG}glyph-${side}.svg);--go:url(${IMG}glyph-${side}-out.svg)"></i>`   // vector (OPIUM 2)
    : `<img class="op-gl" src="${IMG}glyph${red ? "-red" : ""}-${side}.png" alt="" style="height:${h}px">`;
  const bars = () => `<i class="op-bars"></i>`;
  const barcode = (w, h, s) => { let x = 0, o = ""; seed = s * 97 + 3; while (x < w) { const bw = 1 + Math.floor(R() * 4); if (R() > 0.35) o += `<rect x="${x}" y="0" width="${bw}" height="${h}"/>`; x += bw + 1 + Math.floor(R() * 3); } return `<svg class="op-bc" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${o}</svg>`; };

  /* ---------- waveform: orange worn tile + dark halftone wave (Eman's ref) ---------- */
  let dots = null;
  function dotPat(g) {
    if (!dots) { dots = document.createElement("canvas"); dots.width = dots.height = 5; const d = dots.getContext("2d"); d.fillStyle = "rgba(20,4,0,.32)"; d.beginPath(); d.arc(2.5, 2.5, 1.25, 0, 7); d.fill(); }
    return g.createPattern(dots, "repeat");
  }
  /* OPIUM 2 waveform, copied from Eman's ref: red tile, darker mirrored spiky wave, dithered stipple + halftone grid over all, played part darkened */
  let noiseC = null;
  function noisePat(g) {
    if (!noiseC) { noiseC = document.createElement("canvas"); noiseC.width = noiseC.height = 192; const d = noiseC.getContext("2d"), im = d.createImageData(192, 192); let sd = 99;
      const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      for (let i = 0; i < im.data.length; i += 4) { const v = r(); if (v < 0.30) { im.data[i] = 40; im.data[i + 1] = 6; im.data[i + 2] = 4; im.data[i + 3] = 60 + r() * 70; } else if (v > 0.80) { im.data[i] = 255; im.data[i + 1] = 120; im.data[i + 2] = 90; im.data[i + 3] = 20 + r() * 40; } }
      d.putImageData(im, 0, 0); }
    return g.createPattern(noiseC, "repeat");
  }
  let gridC = null;
  function gridPat(g) {
    if (!gridC) { gridC = document.createElement("canvas"); gridC.width = gridC.height = 4; const d = gridC.getContext("2d"); d.fillStyle = "rgba(30,4,2,.30)"; d.fillRect(1, 1, 2, 2); }
    return g.createPattern(gridC, "repeat");
  }
  function opWave2(btn, ph) {
    const cv = btn.querySelector("canvas.wf"); if (!cv) return false;
    const stack = !!btn.closest(".op-stk");
    const w = peaks.get(btn.dataset.src), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(20, Math.round(cv.clientWidth)), Hh = Math.round(cv.clientHeight); if (!Hh) return true;
    if (cv.width !== W * dpr || cv.height !== Hh * dpr) { cv.width = W * dpr; cv.height = Hh * dpr; }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = stack ? "#d9dc45" : "#c42a20", wv = stack ? "#5d6014" : "#6e1610";
    g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    const n = w ? w.length : 0, mid = Hh / 2, amp = mid * 0.9, step = 3;
    const val = (x) => { if (!w) { const t = x / W; return 0.3 + 0.2 * Math.sin(t * 40) * Math.sin(t * 7); } const i = Math.min(n - 1, Math.floor((x / W) * n)); return Math.pow(Math.max(w[i] || 0, w[Math.min(n - 1, i + 1)] || 0), 1.6) * 0.92 + 0.04; };
    g.beginPath(); g.moveTo(0, mid);
    for (let x = 0; x <= W; x += step) g.lineTo(x, mid - Math.max(1, val(x) * amp));
    for (let x = W; x >= 0; x -= step) g.lineTo(x, mid + Math.max(1, val(x) * amp));
    g.closePath(); g.fillStyle = wv; if (!w) g.globalAlpha = 0.4; g.fill(); g.globalAlpha = 1;
    g.fillStyle = noisePat(g); g.fillRect(0, 0, W, Hh);
    g.fillStyle = gridPat(g); g.fillRect(0, 0, W, Hh);
    if (btn === curBtn && ph != null) { g.fillStyle = "rgba(10,2,1,.55)"; g.fillRect(0, 0, W * ph, Hh); }
    return true;
  }
  function opWave(btn, ph) {
    if (O2) return false;   // OPIUM 2 uses the normal waveforms (opWave2 kept for later)
    const cv = btn.querySelector("canvas.wf"); if (!cv) return false;
    const stack = !!btn.closest(".op-stk"), tile = !!btn.closest(".op-mag, .op-stk, .pkt .madewith");
    if (!tile) return false;
    const w = peaks.get(btn.dataset.src), dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(20, Math.round(cv.clientWidth)), Hh = Math.round(cv.clientHeight); if (!Hh) return true;
    if (cv.width !== W * dpr || cv.height !== Hh * dpr) { cv.width = W * dpr; cv.height = Hh * dpr; }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    const cs = getComputedStyle(H), wv = (cs.getPropertyValue("--opw") || "").trim() || "rgba(38,3,3,.96)", w2 = (cs.getPropertyValue("--opw2") || "").trim(), dt = (cs.getPropertyValue("--opdots") || "").trim() === "1";
    const on = btn === curBtn, mid = Hh / 2, amp = mid * 0.86;
    const n = w ? w.length : 0;
    const col = (x) => { if (!w) { const t = x / W; return 0.25 + 0.2 * Math.sin(t * 40) * Math.sin(t * 7); } const a = (x / W) * n, i = Math.floor(a), f = a - i; return (w[Math.min(n - 1, i)] || 0) * (1 - f) + (w[Math.min(n - 1, i + 1)] || 0) * f; };
    const path = new Path2D(); const st = 1 / dpr;
    for (let x = 0; x < W; x += st) { const hh = Math.max(0.8, col(x) * amp); path.rect(x, mid - hh, st + 0.15, hh * 2); }
    if (on && ph != null) { g.fillStyle = "rgba(0,0,0,.34)"; g.fillRect(0, 0, W * ph, Hh); }
    if (!w) g.globalAlpha = 0.35;
    if (w2 && !stack) { g.save(); g.translate(2, 1.5); g.fillStyle = w2; g.fill(path); g.restore(); }
    g.fillStyle = stack ? "rgba(48,54,8,.95)" : wv; g.fill(path); g.globalAlpha = 1;
    if (dt || stack) { g.fillStyle = dotPat(g); g.fillRect(0, 0, W, Hh); }
    if (on && ph != null) { g.fillStyle = "#f3e9da"; g.fillRect(Math.round(W * ph), 0, 1.5, Hh); }
    return true;
  }
  function wrapDW() {
    const _dw = window.drawWave; if (typeof _dw !== "function" || _dw._op) return;
    const f = function (btn, ph) { if (btn && opWave(btn, ph)) return; return _dw.apply(this, arguments); }; f._op = 1; window.drawWave = f;
  }

  /* ---------- pack page: magazine layout ---------- */
  const NICE = { BASS: "BASS", ARP: "ARPS", LEAD: "LEADS", PAD: "PADS", PLUCK: "PLUCKS", KEYS: "KEYS", CHORD: "CHORDS", BELL: "BELLS", "808": "808S", FX: "FX", SONG: "SONG SOUNDS", LOOP: "LOOPS" };
  const SHOW = O2 ? 8 : 10;   // two rows, then SEE ALL
  function groupsOf(p) {
    const m = new Map();
    p.sounds.forEach((s) => { if (s.hidden && !(typeof ADMIN !== "undefined" && ADMIN)) return; const k = String(s.name).split(/\s+/)[0].toUpperCase(); if (!m.has(k)) m.set(k, []); m.get(k).push(s); });
    const order = (typeof SEC_ORDER !== "undefined" && SEC_ORDER[p.id]) || null;
    return [...m.entries()].sort((a, b) => (order ? (order.indexOf(a[0]) + 99) % 99 - (order.indexOf(b[0]) + 99) % 99 : 0) || b[1].length - a[1].length);
  }
  const shortName = (s) => { const w = String(s.name).trim().split(/\s+/); return w.length > 1 ? w.slice(1).join(" ") : s.name; };
  const one = (s, k) => O2 ? sounds({ sounds: [s] }) : sounds({ sounds: [{ ...s, _k: k, _tc: "", name: shortName(s) }] });   // OPIUM 2 (Eman 20:11): the normal sound cards
  function header(k, n) { return `<div class="op-h">${glyph("l", 46, true)}<i class="op-ln"></i><b class="op-box">${esc(NICE[k] || k)} · ${n}</b><i class="op-ln"></i></div>`; }
  const LAY = ["l7", "r5", "c8", "l5", "r7", "l6", "r6", "c9"];   // magazine spans on a 12-column grid, left / right / centre
  function block(k, list, i) {
    const tiles = list.map((s, j) => `<div class="pv ${O2 ? "big op-u" : "op-t"}${s.top || s.mark ? " star" : ""}${j >= SHOW ? " more" : ""}">${one(s, k)}</div>`).join("");
    const more = list.length > SHOW ? `<button class="op-all" data-opall>SEE ALL ${list.length} ▾</button>` : "";
    return `<section class="op-cat" data-k="${esc(k)}">${header(k, list.length)}<div class="op-grid">${tiles}</div>${more}</section>`;
  }
  function stack(trio, i) {
    if (trio.length < 3) return "";
    const rows = trio.map((x, j) => `<div class="op-sr${j === 1 ? " dk" : ""}"><div class="pv op-sk">${one(x.s, x.k)}</div><span class="op-pill">${esc(shortName(x.s).toUpperCase())} <i>${esc(x.k)}</i></span></div>`).join("");
    return `<section class="op-stk"><div class="op-sth"><b>STACK ${i + 1}</b><span>${trio.map((x) => esc(x.k)).join(" + ")} · PLAYED TOGETHER</span><button class="op-sp" data-opstack>▶ PLAY STACK</button></div>${rows}</section>`;
  }
  function deco(i) {
    seed = 31 + i * 13; const t = R();
    if (t < 0.34) { const s = SPK[i % SPK.length]; return `<img class="op-dec op-spk" src="${s.u}" alt="" style="${R() > 0.5 ? "right" : "left"}:${-4 + R() * 6}%;top:${-40 + R() * 30}px;width:${260 + R() * 160}px;transform:rotate(${-8 + R() * 16}deg)">`; }
    if (t < 0.7) return `<img class="op-dec op-mj" src="${pick(MJ)}" alt="" style="${R() > 0.5 ? "right" : "left"}:${-6 + R() * 8}%;top:${-60 + R() * 40}px;width:${120 + R() * 90}px;transform:rotate(${-20 + R() * 40}deg)">`;
    return `<img class="op-dec op-st" src="${pick(ST)}" alt="" style="${R() > 0.5 ? "right" : "left"}:${-3 + R() * 6}%;top:${-50 + R() * 40}px;width:${80 + R() * 60}px;transform:rotate(${-25 + R() * 50}deg)">`;
  }
  function buildMag() {
    if (typeof ID === "undefined" || typeof byId !== "function") return;
    const p = byId(ID); if (!p || !p.sounds || !p.sounds.length) return;
    const host = document.querySelector("#pkSounds"); if (!host || !host.children.length) return;
    let mag = document.querySelector("#opMag");
    if (mag && mag.dataset.id === p.id && mag.dataset.n == p.sounds.length) return;
    if (!mag) { mag = document.createElement("div"); mag.id = "opMag"; mag.className = "op-mag"; host.closest("section").before(mag); }
    mag.dataset.id = p.id; mag.dataset.n = p.sounds.length;
    const gs = groupsOf(p); seed = p.id.length * 11 + 5;
    // stacks: 3 different kinds, one sound each (Eman will pick the real trios later)
    const kinds = gs.filter(([, l]) => l.length).map(([k, l]) => ({ k, l }));
    const trios = [];
    for (let t = 0; t < 2 && kinds.length >= 3; t++) trios.push([0, 1, 2].map((j) => { const kk = kinds[(t * 3 + j) % kinds.length]; return { k: kk.k, s: kk.l[(t + j) % kk.l.length] }; }));
    let html = `<div class="op-magh"><span>✱</span>${bars()}<b>PREVIEW EVERY SOUND</b><span class="op-f"></span><b>${esc(p.count || "")}</b>${bars()}<span>✱</span></div>`;
    gs.forEach(([k, l], i) => { html += block(k, l, i); if (i === 1 && trios[0]) html += stack(trios[0], 0); if (i === 4 && trios[1]) html += stack(trios[1], 1); });
    if (gs.length <= 4 && trios[1]) html += stack(trios[1], 1);
    html += `<div class="op-magh"><span>✱</span><b>COREKULT ✱ ${esc(p.name.toUpperCase())} ✱ ${esc(p.count || "")}</b><span>✱</span></div>`;
    mag.innerHTML = html;
    if (typeof watchWaves === "function") watchWaves(mag);
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-opall]");
    if (a) { const c = a.closest(".op-cat"); c.classList.toggle("all"); a.textContent = c.classList.contains("all") ? "SHOW LESS ▴" : `SEE ALL ${c.querySelectorAll(".op-t,.op-u").length} ▾`; if (typeof watchWaves === "function") watchWaves(c); fitNames(); return; }
    const sp = e.target.closest("[data-opstack]"); if (sp) { playStack(sp.closest(".op-stk"), sp); }
  });

  /* ---------- stack preview: the 3 sounds play at the same time ---------- */
  let stk = null;
  function stopStack() { if (!stk) return; stk.els.forEach((a) => { try { a.pause(); } catch (e) {} }); cancelAnimationFrame(stk.raf); stk.btns.forEach((b) => drawWave(b)); stk.ui.textContent = "▶ PLAY STACK"; stk.box.classList.remove("on"); stk = null; }
  function playStack(box, ui) {
    if (stk && stk.box === box) { stopStack(); return; }
    stopStack(); try { audio.pause(); if (typeof stopCur === "function") stopCur(); } catch (e) {}
    const btns = [...box.querySelectorAll(".pv button")];
    const els = btns.map((b) => { const m = spr(b.dataset.src), a = new Audio(m.u); a.preload = "auto"; a._a = m.a; a._b = m.b; return a; });
    stk = { box, ui, btns, els, raf: 0 }; ui.textContent = "■ STOP STACK"; box.classList.add("on");
    let ready = 0; const go = () => { if (++ready < els.length || !stk || stk.box !== box) return; els.forEach((a) => { a.currentTime = a._a || 0; a.play().catch(() => {}); }); loop(); };
    els.forEach((a) => { if (a.readyState >= 1) go(); else a.addEventListener("loadedmetadata", go, { once: true }); a.load && a.readyState < 1 && a.load(); });
    function loop() {
      if (!stk || stk.box !== box) return; let alive = 0;
      els.forEach((a, j) => { const L = (a._b || a.duration || 1) - (a._a || 0), f = Math.min(1, Math.max(0, (a.currentTime - (a._a || 0)) / L)); if (a._b && a.currentTime >= a._b - 0.02) a.pause(); if (!a.paused && !a.ended) alive++; const b = btns[j]; const prev = curBtn; curBtn = b; window.drawWave(b, f); curBtn = prev; });
      if (!alive) { stopStack(); return; } stk.raf = requestAnimationFrame(loop);
    }
  }
  document.addEventListener("click", (e) => { if (stk && e.target.closest(".pv button") && !e.target.closest(".op-stk")) stopStack(); }, true);

  /* ---------- pack top: moons + barcode under the buy box, glyphs beside the cover ---------- */
  function decoTop() {
    const pkc0 = document.querySelector(".pkc"); if (pkc0 && !pkc0.querySelector(".op-gw") && pkc0.querySelector("img")) pkc0.insertAdjacentHTML("afterbegin", `<div class="op-gw l">${glyph("l", 300, 1)}</div><div class="op-gw r">${glyph("r", 330, 1)}</div>`);
    const pki = document.querySelector("#pkTop .pki"); if (!pki || pki.querySelector(".op-meta")) return;
    const buy = pki.querySelector(".buy"); if (buy) buy.insertAdjacentHTML("afterend", `<div class="op-meta"><div class="op-moons"><i></i><i></i><i></i><i></i></div><div class="op-prog"><i></i></div>${barcode(300, 40, 9)}</div>`);
    const pkc = document.querySelector("#pkTop .pkc"); if (pkc && !pkc.querySelector(".op-gw")) pkc.insertAdjacentHTML("afterbegin", `<div class="op-gw l">${glyph("l", 300, 1)}</div><div class="op-gw r">${glyph("r", 330, 1)}</div>`);
  }

  /* ---------- home: mood filters instead of one chip per series (Eman 24 Nov "less categories, like OPIUM, AMBIENT") ----------
     Edit MOODS to move a series (world id) to another mood. */
  const MOODS = [
    ["opium", "Opium", ["blade", "esskid", "fakemink"]],
    ["ambient", "Ambient", ["dream", "silent", "lean"]],
    ["glitch", "Glitch", ["crystal", "nett", "holl"]],
    ["haze", "Haze", ["travis", "witch"]],
  ];
  /* goth line icons for the left menu (Eman 24 Nov) */
  const GI = {
    all: '<path d="M12 2v20M6 8h12M12 2l-2 2M12 2l2 2"/>',
    free: '<path d="M12 20s-8-5-8-11a4.500 4.500 0 0 1 8-2.500A4.500 4.500 0 0 1 20 9c0 6-8 11-8 11z"/>',
    opium: '<path d="M12 12c-4-1-6-4-5-7 3 0 5 2 5 5 0-3 2-5 5-5 1 3-1 6-5 7zM12 12c-4 1-6 4-5 7 3 0 5-2 5-5 0 3 2 5 5 5 1-3-1-6-5-7zM12 12h.01M12 19v3"/>',
    ambient: '<path d="M18 14.5A8 8 0 1 1 9.5 6a6.5 6.5 0 0 0 8.5 8.5z"/>',
    glitch: '<path d="M4 4h6v3h3V4h7v6h-3v3h3v7h-6v-3h-3v3H4v-7h3v-3H4zM10 7v3h3V7zM10 13v3h3v-3z"/>',
    haze: '<path d="M8 21c-3-2-3-5 0-7s3-4 0-6 0-5 3-5M14 21c-3-2-3-5 0-7s3-4 0-6M19 20c-2-1-2-3 0-4s2-3 0-4"/>',
    drums: '<path d="M12 3a7 7 0 0 0-7 7c0 2.500 1.200 4 2.500 5V19h9v-4c1.300-1 2.500-2.500 2.500-5a7 7 0 0 0-7-7zM9.500 11h.01M14.500 11h.01M10 19v2M12 19v2M14 19v2M12 13l-1 2h2z"/>',
  };

  const gi = (id) => `<svg class="op-gi" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GI[id] || GI.all}</svg>`;
  function moods() {
    const box = document.querySelector("#chips"); if (!box || !box.querySelector(".ch") || box.querySelector(".op-moods")) return;
    const og = box.querySelector(".chs") || box, cards = [...document.querySelectorAll("#worlds .card")];
    const wOf = (c) => (c.closest(".world") || {}).dataset ? c.closest(".world").dataset.world : "";
    const n = (f) => cards.filter((c) => !c.dataset.fs && f(c)).length;
    const ogN = (f) => { const b = og.querySelector(`.ch[data-f="${f}"] .n`); return b ? b.textContent : ""; };
    const list = [["all", "All", ogN("all")], ...(og.querySelector('.ch[data-f="free"]') ? [["free", "Free", ogN("free")]] : []),
      ...MOODS.map(([id, nm, ws]) => [id, nm, n((c) => ws.includes(wOf(c)) && c.dataset.type !== "drums")]).filter((m) => m[2]),
      ["drums", "Drums", ogN("drums")]];
    og.insertAdjacentHTML("beforebegin", `<div class="op-moods">${list.map(([id, nm, c], i) => `<button class="op-mood${i ? "" : " on"}" data-mood="${id}">${gi(id)}<b>${esc(nm)}</b><span>${c}</span></button>`).join("")}</div>`);
  }
  document.addEventListener("click", (e) => {
    const m = e.target.closest && e.target.closest("[data-mood]"); if (!m) return;
    document.querySelectorAll(".op-mood").forEach((x) => x.classList.toggle("on", x === m));
    const id = m.dataset.mood, mood = MOODS.find((x) => x[0] === id);
    const ogc = document.querySelector(`#chips .ch[data-f="${mood ? "all" : id}"]`); if (ogc) ogc.click();   // free / drums / all = the normal filters
    document.querySelectorAll("#worlds .card").forEach((c) => { const w = c.closest(".world"); c.style.display = mood && (!w || !mood[2].includes(w.dataset.world) || c.dataset.type === "drums" || c.dataset.fs) ? "none" : ""; });
    gutKey = ""; setTimeout(run, 30);
  });

  // typing in search = back to ALL moods, so the search looks through every pack
  document.addEventListener("input", (e) => { if (!e.target || e.target.id !== "srchIn") return;
    document.querySelectorAll("#worlds .card").forEach((c) => { c.style.display = ""; });
    document.querySelectorAll(".op-mood").forEach((x) => x.classList.toggle("on", x.dataset.mood === "all")); }, true);

  /* ---------- every page: no banner; MJ drawings faint in the background, our stickers sometimes overlapping things ---------- */
  function decoAll() {
    moods();   // round 3: no gutter texts, no background drawings, no random stickers
    if (O2) o2Home();
  }
  /* home decorations live in the side gutters (wide screens only), placed next to every ~6th card, so they never cover a product */
  let gutKey = "";
  function gutter(worlds) {
    const home = worlds && worlds.closest(".home"); if (!home) return;
    let lay = home.querySelector(":scope > .op-gut");
    const cards = [...worlds.querySelectorAll(".card")].filter((c) => c.offsetParent);
    const key = cards.length + ":" + home.clientWidth + ":" + (cards[0] ? cards[0].offsetTop : 0);
    if (lay && key === gutKey) return; gutKey = key;
    if (!lay) { lay = document.createElement("div"); lay.className = "op-gut"; home.appendChild(lay); }
    const hr = home.getBoundingClientRect(), wr = worlds.getBoundingClientRect(), gw = wr.left - hr.left;
    if (gw < 150 || !cards.length) { lay.innerHTML = ""; return; }
    let h = "", side = 0; seed = 77;
    for (let i = 3; i < cards.length; i += 6) {
      const r = cards[i].getBoundingClientRect(), top = r.top - hr.top + R() * 120, k = Math.floor(i / 6) % 3, L = side++ % 2 === 0;
      const pos = L ? `left:${Math.max(4, gw - 40 - R() * 60)}px;transform:translateX(-100%) rotate(${-10 + R() * 20}deg);transform-origin:right` : `right:${Math.max(4, gw - 40 - R() * 60)}px;transform:translateX(100%) rotate(${-10 + R() * 20}deg);transform-origin:left`;
      if (k === 0) h += `<img class="op-dec op-spk" src="${SPK[(i / 6 | 0) % SPK.length].u}" alt="" style="top:${top}px;${pos};width:${Math.min(gw - 20, 300)}px">`;
      else if (k === 1) h += `<img class="op-dec op-mj" src="${pick(MJ)}" alt="" style="top:${top}px;${pos};width:${Math.min(gw - 30, 170)}px">`;
      else h += `<img class="op-dec op-st" src="${pick(ST)}" alt="" style="top:${top}px;${pos};width:${Math.min(gw - 40, 120)}px">`;
    }
    lay.innerHTML = h;
  }  /* OPIUM 2 home (Eman 24 Nov 20:08): filters + search in a left sidebar that follows the scroll; banner redrawn in the new style, COREKULT logo kept */
  function o2Home() {
    const bar = document.querySelector("#packs"), worlds = document.querySelector("#worlds");
    if (bar && worlds && !bar.closest(".op-shop")) { const sh = document.createElement("div"); sh.className = "op-shop"; bar.before(sh); sh.append(bar, worlds); }
    const box = document.querySelector("#chips");
    if (box) { const srch = box.querySelector(".srch"), mo = box.querySelector(".op-moods");
      if (mo && !box.querySelector(".op-sbh")) box.insertAdjacentHTML("afterbegin", `<div class="op-sbh"><span>✱</span><b>FILTER</b><i class="op-bars"></i></div>`);
      const sbh = box.querySelector(".op-sbh");
      if (srch && mo && sbh && !(box.firstElementChild === srch && srch.nextElementSibling === sbh && sbh.nextElementSibling === mo)) { box.prepend(srch); srch.after(sbh); sbh.after(mo); } }
    const hero = document.querySelector("header.hero");
    if (hero && !hero.querySelector(".op-hb")) {
      hero.insertAdjacentHTML("afterbegin", `<div class="op-hb t"><span>✱</span><i class="op-bars"></i><b>SERUM PRESETS · DRUM KITS</b><span class="op-f"></span><b>CORE-KULT ® 2026</b><i class="op-bars"></i><span>✱</span></div>`);
      hero.insertAdjacentHTML("beforeend", `<div class="op-hb b"><span>✱</span><b>PREVIEW EVERY SOUND</b><i class="op-bars"></i><span class="op-f"></span><i class="op-bars"></i><b>100% ROYALTY-FREE</b><span>✱</span></div>`);
      const bf = hero.querySelector(".bfD"); if (bf) bf.insertAdjacentHTML("afterbegin", `<div class="op-gw l">${glyph("r", 390, 1)}</div><div class="op-gw r">${glyph("r", 390, 1)}</div>`);
      const bm = hero.querySelector(".bfM"); if (bm) bm.insertAdjacentHTML("afterbegin", `<div class="op-gw l">${glyph("l", 260, 1)}</div><div class="op-gw r">${glyph("r", 280, 1)}</div>`);
    }
  }
  let artKey = "";
  function bgArt() {
    const H2 = document.documentElement.scrollHeight, W = document.documentElement.clientWidth, key = Math.round(H2 / 400) + ":" + W;
    let lay = document.querySelector("body > .op-art"); if (lay && key === artKey) return; artKey = key;
    if (!lay) { lay = document.createElement("div"); lay.className = "op-art"; lay.setAttribute("aria-hidden", "true"); document.body.prepend(lay); }
    seed = 911; let h = "";
    for (let y = 260; y < H2 - 300; y += 520 + R() * 380) {
      const L = R() > 0.5, w = 260 + R() * 260;
      h += `<img src="${pick(MJ)}" alt="" style="top:${y}px;${L ? "left" : "right"}:${-60 + R() * 16}%;width:${w}px;transform:translateX(${L ? 0 : 0}px) rotate(${-25 + R() * 50}deg);opacity:${0.16 + R() * 0.12}">`;
      if (R() > 0.55) h += `<img src="${pick(MJ)}" alt="" style="top:${y + 200 + R() * 200}px;left:${15 + R() * 70}%;width:${320 + R() * 300}px;transform:rotate(${-20 + R() * 40}deg);opacity:${0.08 + R() * 0.06}">`;
    }
    lay.innerHTML = h; lay.style.height = H2 + "px";
  }
  function stickers() {   // a sticker slapped on the corner of some cards / tiles / headers; never in the middle of a cover
    seed = 4242;
    const put = (el, sz) => { if (!el || el.querySelector(":scope > .op-slap")) return; const c = R(), top = c < 0.5, left = R() < 0.5;
      el.insertAdjacentHTML("beforeend", `<img class="op-slap" src="${pick(ST)}" alt="" style="${top ? "top" : "bottom"}:${-sz * 0.38}px;${left ? "left" : "right"}:${-sz * 0.3}px;width:${sz}px;transform:rotate(${-28 + R() * 56}deg)">`); };
    document.querySelectorAll("#worlds .card").forEach((c, i) => { if (i % 5 === 2 || i % 11 === 7) put(c, 70 + (i % 3) * 18); });
    document.querySelectorAll(".op-mag .op-cat").forEach((c, i) => { if (i % 2 === 0) put(c.querySelector(".op-box"), 54); else put(c.querySelector(".op-t.big"), 80); });
    document.querySelectorAll(".op-stk").forEach((c) => put(c.querySelector(".op-sk"), 74));
    put(document.querySelector("#pkTop .buy"), 76);
  }
  function fitNames() {   // long preset names shrink until they fit their tile (never cut off)
    document.querySelectorAll(".op-mag .op-t button .nm, .op-stk .op-pill .nm").forEach((n) => {
      if (!n.offsetWidth) return; n.style.fontSize = ""; let f = parseFloat(getComputedStyle(n).fontSize), i = 0;
      while (n.scrollWidth > n.clientWidth + 1 && f > 9 && i++ < 30) { f -= 1; n.style.fontSize = f + "px"; }
    });
  }
  /* hero stats (Eman 24 Nov): 3rd stat = real SAMPLES count (all drum-kit sounds), all three count up from 0 the first visit only */
  if (O2) setTimeout(() => document.documentElement.classList.add("op-stv"), 3500);   /* safety: never leave the stats hidden */
  function stats() {
    const st = document.querySelector("#stats"); if (!O2 || !st || st.children.length < 3 || typeof PRODUCTS === "undefined" || !PRODUCTS.length || st.children[0].dataset.cu) return;
    let n = 0; PRODUCTS.forEach((p) => { if (p.type === "drums") { const m = String(p.count || "").match(/(\d+)/); n += m ? +m[1] : (p.sounds || []).length; } });
    const d = st.children, tg = [PRODUCTS.length, 450, n], sf = ["", "+", ""]; d[2].innerHTML = "<b>0</b>Samples";
    const seen = false;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches, t0 = performance.now(), T = 3800;
    const fmt = (i, v) => String(Math.round(v)) + sf[i];
    [0, 1, 2].forEach((i) => { d[i].dataset.cu = 1; const b = d[i].querySelector("b"); b.style.fontVariantNumeric = "tabular-nums"; b.textContent = fmt(i, seen || still ? tg[i] : 0); });
    if (seen || still) return;
    const tick = (now) => { const k = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - k, 4); [0, 1, 2].forEach((i) => { const b = d[i].querySelector("b"); if (b) b.textContent = fmt(i, tg[i] * e); }); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  /* cookie bar: put SEE MORE at the end of the text (Eman 24 Nov) */
  function ckBar() { const c = document.querySelector("#consent"), sp = c && c.querySelector(":scope > span"), m = c && c.querySelector(":scope > #cMore"); if (O2 && sp && m) sp.appendChild(m); }
  /* hover sway (Eman 24 Nov): while a CD/card is hovered it slowly sways left and right on its Y axis; the strength eases in and out so there is never a jump */
  const SW = new Map(); let swRaf = 0, swT0 = 0;
  function swTick(now) {
    SW.forEach((st, im) => { st.env += (st.tg - st.env) * 0.07;
      const sh = im.parentElement && im.parentElement.querySelector("canvas.sh"); if (!st.tg && st.env < 0.004) { im.style.transform = ""; if (sh) sh.style.transform = ""; SW.delete(im); return; }
      const t = (now - swT0) / 1000; const tf = `perspective(900px) rotateY(${(Math.sin(t * 1.4) * 9 * st.env).toFixed(2)}deg) rotateX(${(-2 * st.env).toFixed(2)}deg)`; im.style.transform = tf; if (sh) sh.style.transform = tf; });
    swRaf = SW.size ? requestAnimationFrame(swTick) : 0;
  }
  if (O2 && matchMedia("(hover:hover)").matches) {
    const SEL = ".card .cv, #pkTop .pkc, .lnd .pkc", imOf = (el) => el.querySelector(".pq img");
    const go = (el, v) => { const im = imOf(el); if (!im) return; let st = SW.get(im); if (!st) { if (!v) return; st = { env: 0, tg: 0 }; SW.set(im, st); } st.tg = v; if (!swRaf) { swT0 = swT0 || performance.now(); swRaf = requestAnimationFrame(swTick); } };
    document.addEventListener("mouseover", (e) => { const el = e.target.closest && e.target.closest(SEL); if (el && !el.contains(e.relatedTarget)) go(el, 1); });
    document.addEventListener("mouseout", (e) => { const el = e.target.closest && e.target.closest(SEL); if (el && !el.contains(e.relatedTarget)) go(el, 0); });
  }
  /* card titles in normal title case + a grey subline that says what it is (Eman 24 Nov) */
  const TC = (s) => s.toLowerCase().replace(/(^|[\s(\-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bIi\b/g, "II").replace(/\bIii\b/g, "III").replace(/\bIv\b/g, "IV").replace(/\bVi\b/g, "VI");
  function cardText() {
    if (!O2) return;
    document.querySelectorAll("#worlds .card").forEach((c) => {
      const pn = c.querySelector(".pn"), pf = c.querySelector(".pf");
      if (pn) { const w = document.createTreeWalker(pn, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = TC(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; } }
      if (pf && !pf.dataset.what) { const raw = pf.textContent.split(" \u00b7 ")[0].trim(); const s = c.dataset.look === "card" ? "Trading card" : raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/ (i|ii|iii|iv)$/, (m) => m.toUpperCase()) : ""; pf.dataset.what = "1"; if (s && pf.textContent !== s) pf.textContent = s; }
    });
  }
  /* text block = the visible case (Eman 24 Nov): the picture files have transparent padding, so measure the real alpha edges once per image and set the text block to exactly those left/right edges */
  const BB = new Map();
  function alphaBox(im) {
    const key = im.currentSrc || im.src; if (BB.has(key)) return BB.get(key);
    let r = null;
    try { const W = 240, H = Math.max(1, Math.round(W * im.naturalHeight / im.naturalWidth)), c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.drawImage(im, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data; let l = W, rr = -1, tt = H, bb2 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 60) { if (x < l) l = x; if (x > rr) rr = x; if (y < tt) tt = y; if (y > bb2) bb2 = y; }
      if (rr > l) r = [l / W, (rr + 1) / W, tt / H, (bb2 + 1) / H]; } catch (e) {}
    BB.set(key, r); return r;
  }
  let REF = null;
  function alignText() {
    const cards = [...document.querySelectorAll("#worlds .card")].sort((a, b) => (a.dataset.look === "card") - (b.dataset.look === "card"));
    cards.forEach((card) => {
      const im = card.querySelector(".pq img"), cb = card.querySelector(".cb"); if (!im || !cb) return;
      const go = () => { if (!im.naturalWidth || !im.offsetWidth) return; const bb = alphaBox(im); if (!bb) return;
        let x = 0, e = im; while (e && e !== card) { x += e.offsetLeft; e = e.offsetParent; } if (e !== card) return;
        const S = parseFloat(getComputedStyle(im).scale) || 1, cx = x + im.offsetWidth / 2, L = cx + (bb[0] - 0.5) * im.offsetWidth * S, w = (bb[1] - bb[0]) * im.offsetWidth * S;
        if (card.dataset.look === "card") { const rf = REF; if (rf) { const bt = alphaBox(im); if (bt && rf.vis) { const S2 = parseFloat(getComputedStyle(im).scale) || 1, nh = rf.vis / ((bt[3] - bt[2]) * S2); im.style.setProperty("height", nh + "px", "important"); im.style.setProperty("position", "relative"); im.style.setProperty("top", "0px"); let y1 = 0, e3 = im; while (e3 && e3 !== card) { y1 += e3.offsetTop; e3 = e3.offsetParent; } const topNow = y1 + im.offsetHeight / 2 + (bt[2] - 0.5) * im.offsetHeight * S2; im.style.setProperty("top", Math.round((rf.top - topNow) * 10) / 10 + "px"); } cb.style.setProperty("margin-left", rf.L + "px", "important"); cb.style.setProperty("margin-right", "0", "important"); cb.style.setProperty("width", rf.w + "px", "important"); cb.style.setProperty("max-width", "none", "important"); } return; }
        { let y0 = 0, e2 = im; while (e2 && e2 !== card) { y0 += e2.offsetTop; e2 = e2.offsetParent; } const h0 = im.offsetHeight; REF = { L: Math.round(L * 10) / 10, w: Math.round(w * 10) / 10, vis: (bb[3] - bb[2]) * h0 * S, top: y0 + h0 / 2 + (bb[2] - 0.5) * h0 * S }; }
        cb.style.setProperty("margin-left", Math.round(L * 10) / 10 + "px", "important"); cb.style.setProperty("margin-right", "0", "important"); cb.style.setProperty("width", Math.round(w * 10) / 10 + "px", "important"); cb.style.setProperty("max-width", "none", "important"); };
      if (im.complete && im.naturalWidth) go(); else im.addEventListener("load", go, { once: true });
    });
  }
  addEventListener("resize", () => { try { alignText(); } catch (e) {} });
  /* no ghost (Eman 24 Nov): the sweep canvas used to be created on the first mouse move, so it jumped straight to the zoomed size while the picture was still easing = a lagging copy. Create it up front, sized to the picture, so both animate together */
  function prepSheen() {
    document.querySelectorAll(".card .pq, #pkTop .pkc .pq, .lnd .pkc .pq").forEach((q) => {
      const im = q.querySelector("img"); if (!im) return;
      const put = () => { if (!im.offsetWidth) return; let c = q.querySelector("canvas.sh"); if (!c) { c = document.createElement("canvas"); c.className = "sh"; q.appendChild(c); } Object.assign(c.style, { left: im.offsetLeft + "px", top: im.offsetTop + "px", width: im.offsetWidth + "px", height: im.offsetHeight + "px" }); };
      put(); if (!im.complete) im.addEventListener("load", put, { once: true });
    });
  }
  addEventListener("resize", () => { try { prepSheen(); } catch (e) {} });
  /* pack page: 3 for 2 as three slots under the price (Eman 25 Nov): this pack in, an empty slot to fill, a frosted "?" CD that comes free */
  function trio3() {
    const pb = document.querySelector("#pkTop .pbuy"); if (!O2 || !pb || pb.nextElementSibling && pb.nextElementSibling.classList.contains("op-t3")) return;
    const im = document.querySelector("#pkTop .pkc img, #pkTop .pq img"), src = im && (im.currentSrc || im.src); if (!src) return;
    pb.insertAdjacentHTML("afterend", `<div class="op-t3" aria-label="Buy 2, get 1 free"><div class="op-s in"><img src="${src}" alt=""></div><a class="op-s add" href="/#packs"><b>+</b><i>add pack</i></a><a class="op-s fr" href="/#packs" aria-label="Pick free pack"><span class="mb"><i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i><i class="gr"></i></span><span class="fc"><img src="/img/cd/free-knight.webp?v=1" alt=""></span></a><div class="op-pick"><svg viewBox="0 0 190 120" aria-hidden="true"><g fill="none" stroke="#E4FF3A" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(-2.5 24.9 16.8)"><path d="M18.0 27.8 L17.3 5.9 M18.3 6.5 L22.5 6.0 Q26.8 5.4 28.7 7.6 Q30.5 9.8 30.9 11.7 Q31.2 13.6 29.3 16.0 Q27.4 18.4 22.9 17.7 L18.3 17.0"/></g><g transform="rotate(-6.3 41.7 12.0)"><path d="M41.1 1.0 L41.6 21.8 M37.6 2.1 L46.8 2.1 M37.3 21.8 L46.0 23.0"/></g><g transform="rotate(-5.8 61.3 14.9)"><path d="M67.3 5.1 L65.3 4.0 Q63.3 3.0 60.9 3.9 Q58.4 4.8 57.0 9.1 Q55.5 13.4 54.8 17.3 Q54.1 21.3 57.8 24.0 Q61.4 26.6 65.3 25.1 L69.1 23.6"/></g><g transform="rotate(-7.8 78.5 14.3)"><path d="M70.8 4.0 L71.7 24.7 M84.1 2.1 L70.9 16.7 M74.1 13.3 L85.2 24.9"/></g><g transform="rotate(-3.1 107.4 12.5)"><path d="M99.7 1.8 L104.0 8.0 Q108.4 14.2 111.2 8.7 L114.0 3.2 M106.7 13.3 L108.1 23.0"/></g><g transform="rotate(1.8 123.6 15.0)"><path d="M123.2 2.5 L125.4 4.1 Q127.7 5.7 128.9 10.1 Q130.1 14.4 129.1 19.2 Q128.2 23.9 125.8 26.0 Q123.5 28.1 121.3 26.2 Q119.1 24.4 118.6 19.3 Q118.0 14.3 118.0 10.9 Q118.0 7.5 121.6 5.2 L125.3 2.9"/></g><g transform="rotate(4.3 140.6 14.2)"><path d="M133.8 2.9 L133.7 10.4 Q133.5 17.9 135.0 22.3 Q136.5 26.7 139.8 26.5 Q143.0 26.2 144.9 22.8 Q146.9 19.5 147.6 10.9 L148.4 2.2"/></g><g transform="rotate(-1.2 157.2 14.3)"><path d="M151.9 26.0 L150.7 3.7 M150.5 1.7 L154.8 2.2 Q159.2 2.7 160.6 4.1 Q162.0 5.5 162.0 8.8 Q162.1 12.2 159.8 13.4 Q157.6 14.7 154.8 15.0 L152.0 15.3 M156.4 15.2 L163.1 25.0"/></g><g transform="rotate(2.5 33.5 42.8)"><path d="M24.9 53.1 L25.5 43.2 Q26.0 33.4 33.1 33.7 L40.2 34.0 M25.1 42.9 L37.1 43.7"/></g><g transform="rotate(-6.1 53.1 45.3)"><path d="M46.2 57.6 L46.6 33.6 M46.4 34.6 L51.3 34.4 Q56.2 34.1 58.0 35.8 Q59.8 37.4 59.7 39.8 Q59.5 42.1 57.2 44.6 Q54.9 47.0 50.8 46.4 L46.6 45.8 M51.4 46.2 L60.2 56.6"/></g><g transform="rotate(-2.6 72.8 40.0)"><path d="M79.5 29.3 L72.7 29.6 Q65.9 29.9 65.8 40.5 Q65.7 51.0 72.4 50.0 L79.0 49.0 M65.1 40.4 L75.0 39.3"/></g><g transform="rotate(-6.4 92.0 45.1)"><path d="M98.6 33.1 L91.9 33.7 Q85.1 34.4 85.6 45.8 Q86.1 57.3 92.1 56.9 L98.0 56.6 M84.8 44.3 L94.6 45.8"/></g><g transform="rotate(-8.6 121.1 42.5)"><path d="M113.4 53.5 L112.9 30.8 M113.8 31.0 L118.8 31.4 Q123.8 31.8 126.6 33.1 Q129.4 34.4 128.0 36.8 Q126.6 39.2 125.0 40.7 Q123.5 42.2 118.7 42.4 L114.0 42.6"/></g><g transform="rotate(-4.6 138.2 42.0)"><path d="M131.1 54.4 L134.4 42.0 Q137.6 29.6 140.4 41.8 L143.1 54.0 M134.5 46.1 L142.1 46.4"/></g><g transform="rotate(-8.5 155.8 43.3)"><path d="M160.4 34.6 L159.0 32.9 Q157.5 31.2 154.9 32.3 Q152.2 33.4 151.2 37.2 Q150.3 41.1 150.6 45.9 Q150.8 50.7 152.9 53.0 Q155.0 55.3 158.8 53.2 L162.6 51.1"/></g><g transform="rotate(-2.2 173.6 43.3)"><path d="M168.3 31.5 L167.6 55.6 M179.4 32.8 L168.0 45.5 M169.9 42.6 L180.1 55.1"/></g><path d="M52 64 C 44 70, 30 78, 8 92"/><path d="M53.5 65 C 42 73, 27 81, 9 93" stroke-width="1.6"/><path d="M7 92.5 L 21 91"/><path d="M7.5 92 L 12 78"/></g></svg></div><p class="op-n">buy 2, get the 3rd free · mix any packs</p></div>`);
  }

  /* product page: placeholder reviews under ADD TO CART (Eman 25 Nov) */
  function opRev() {
    const ww = document.querySelector("#pkTop .pki .ww"), pf0 = document.querySelector("#pkTop .pki > .pf"); if (O2 && ww && pf0 && pf0.nextElementSibling !== ww) pf0.after(ww);
    const buy = document.querySelector("#pkTop .buy"); if (!O2 || !buy || document.querySelector("#pkTop .op-rv")) return;
    const R = [[5,"@sleepyhalo","these pads sit under my vocals perfectly, no eq needed"],[4,"@nyx.wav","the basses hit hard. a few leads are too bright for me"],[3,"@lowkeyloop","good for the price, wish there were more arps"],[4,"@vxlt","used the plucks on three songs already"],[2,"@mothtape","not really my style, but the sound quality is clean"],[5,"@dreamer404","instant favourite, the chords are so emotional"],[3,"@ghostbpm","solid pack, some presets sound alike"],[4,"@halo.exe","macros are easy to use, tweaked everything fast"],[3,"@cryptid","nice textures, bass was a bit quiet"],[4,"@softcore","great starting point for hyperpop beats"],[2,"@lunar.rx","expected more variety"],[3,"@staticbloom","fun to play with, a few i skipped"]];
    const avg = R.reduce((a, r) => a + r[0], 0) / R.length, st = (n) => `<span class="st" style="--p:${n / 5 * 100}%">★★★★★</span>`;
    buy.insertAdjacentHTML("afterend", `<div class="op-rv"><div class="op-rh">${st(avg)}<b>${avg.toFixed(1)}</b><small>${R.length} reviews</small></div><div class="op-rl">${R.map((r) => `<div class="op-ri"><div class="op-rt">${st(r[0])}<em>${r[1]}</em></div><p>${r[2]}</p></div>`).join("")}</div></div>`);
  }
  /* product page: the back button in the site style (Eman 25 Nov) */
  function backBtn() {
    const a = document.querySelector("a.bigback"); if (!O2 || !a || a.dataset.op) return; a.dataset.op = 1;
    a.innerHTML = '<svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true"><path d="M10 2 L2 10 L10 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"/></svg><span>Back to all packs</span>';
  }
  /* free-pack disc: twinkling glitter sparks that sway with the case (Eman 25 Nov) */
  function glitter() {
    const fc = document.querySelector("#pkTop .op-s.fr .fc"); if (!O2 || !fc || fc.querySelector(".sp")) return;
    const P = [[50.6, 78.9], [27.8, 22.3], [27.5, 77.2], [73.4, 79.2], [21.2, 25.3], [81.9, 79.9], [50.9, 32.9], [74.2, 40.3], [65.8, 33.8], [81.7, 69.4], [37.8, 57.8], [64.6, 20.8], [52.4, 20.8], [83.6, 28.1], [58.2, 24.3], [58.7, 33.8], [45.8, 42.9], [60.7, 51.4], [23.9, 49.2]];   // bright highlight spots on the stickers and the disc, measured from the image
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const h = P.map((p, n) => { const sz = 6 + rnd() * 8, d = (rnd() * 3).toFixed(2), t = (1.8 + rnd() * 2).toFixed(2), c = ["#fff", "#fff", "#dff3ff", "#fffbd0"][n % 4];
      return `<i style="left:${p[0]}%;top:${p[1]}%;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;background:${c};animation-delay:${d}s;animation-duration:${t}s"></i>`; }).join("");
    fc.insertAdjacentHTML("beforeend", '<span class="sp" aria-hidden="true">' + h + "</span>");
  }
  /* product page: works-with sentence above the synth buttons (Eman 25 Nov) */
  function wwText() {
    const ww = document.querySelector("#pkTop .pki .ww"); if (!O2 || !ww || ww.querySelector(".op-wwt")) return;
    const l = ww.querySelector(".wwl"); if (!l) return;
    l.insertAdjacentHTML("beforebegin", '<p class="op-wwt">All packs include presets for Serum, Serum 2, Vital and Ableton Wavetable.</p>');
  }
  /* ===== pack lightbox: "add pack" and "free extra pack" slots (Eman 25 Nov) ===== */
  const LBS = { add: null, fr: null };   // chosen product per slot
  let LB = null, LBA = null;
  const curPid = () => new URLSearchParams(location.search).get("id") || decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
  const lbMuted = () => { try { return localStorage.getItem("ck-mute") === "1"; } catch (e) { return false; } };
  const lbAc = () => { if (lbMuted()) return null; try { LBA = LBA || new (window.AudioContext || window.webkitAudioContext)(); if (LBA.state === "suspended") LBA.resume().catch(() => {}); return LBA; } catch (e) { return null; } };
  function lbTone(f, t0, d, g, type) { const c = lbAc(); if (!c) return; const o = c.createOscillator(), v = c.createGain(), t = c.currentTime + t0; o.type = type || "sine"; o.frequency.value = f; v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.012); v.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(v); v.connect(c.destination); o.start(t); o.stop(t + d + 0.05); }
  const sndTick = () => { lbTone(1480, 0, 0.07, 0.07, "triangle"); lbTone(740, 0, 0.09, 0.05); };
  const sndDone = () => { lbTone(110, 0, 0.35, 0.22); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { lbTone(f, 0.05 + i * 0.07, 0.55, 0.09, "triangle"); lbTone(f * 2, 0.05 + i * 0.07, 0.35, 0.035); }); };
  const lbCats = (p) => { const m = {}; (p.sounds || []).forEach((s) => { const k = String(s.name || "").split(" ")[0].toUpperCase(); m[k] = (m[k] || 0) + 1; }); return m; };
  const lbCos = (a, b) => { let d = 0, na = 0, nb = 0; for (const k in a) { na += a[k] * a[k]; if (b[k]) d += a[k] * b[k]; } for (const k in b) nb += b[k] * b[k]; return na && nb ? d / Math.sqrt(na * nb) : 0; };
  function lbSorted(refs, skip) {
    const rc = refs.map(lbCats);
    return PRODUCTS.filter((p) => !skip.includes(p.id) && p.price > 0 && p.cover && !/\/card-/.test(p.cover)).map((p, n) => {
      const c = lbCats(p); let s = 0;
      refs.forEach((r, i) => { s += (p.world === r.world ? 10 : 0) + (p.type === r.type ? 4 : -3) + lbCos(c, rc[i]) * 6; });
      return [s / refs.length - n * 0.001, p];
    }).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  }
  function lbMix(p) {   // 8 sounds mixed from different categories
    const g = {}; (p.sounds || []).filter((s) => s.file && !s.hidden).forEach((s) => { const k = String(s.name).split(" ")[0].toUpperCase(); (g[k] = g[k] || []).push(s); });
    const keys = Object.keys(g).sort((a, b) => g[b].length - g[a].length), out = []; let r = 0;
    while (out.length < 8 && keys.some((k) => g[k].length > r)) { keys.forEach((k) => { if (out.length < 8 && g[k][r * 2 % Math.max(1, g[k].length)]) out.push(g[k][r * 2 % g[k].length]); }); r++; if (r > 6) break; }
    return out.filter((s, i, a) => a.indexOf(s) === i).slice(0, 8);
  }
  const lbSparks = (n, seed) => { let x = seed; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647; return Array.from({ length: n }, () => { const z = 7 + rnd() * 7; return `<i style="left:${(22 + rnd() * 56).toFixed(0)}%;top:${(22 + rnd() * 56).toFixed(0)}%;width:${z.toFixed(0)}px;height:${z.toFixed(0)}px;animation-delay:${(rnd() * 3).toFixed(2)}s;animation-duration:${(1.8 + rnd() * 1.6).toFixed(2)}s"></i>`; }).join(""); };
  function lbWrite(svg, from) {   // handwriting writes itself, stroke by stroke
    const ps = [...svg.querySelectorAll("path")]; ps.forEach((p, i) => { p.setAttribute("pathLength", "1"); p.style.strokeDasharray = "1"; p.style.strokeDashoffset = "1"; p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 260, delay: (from || 0) + i * 38, fill: "forwards", easing: "ease-out" }); });
    return (from || 0) + ps.length * 38 + 260;
  }
  function lbSet(slotKey, slot, pr, p) {
    LBS[slotKey] = p;
    if (slotKey === "add") {
      const i = slot.querySelector("i"), b = slot.querySelector("b"); let im = slot.querySelector("img");
      slot.classList.toggle("sel", !!p);
      if (p) { if (!im) { im = document.createElement("img"); im.alt = ""; slot.prepend(im); } im.src = abs(p.cover); if (i) i.textContent = String(p.name).toLowerCase(); }
      else { if (im) im.remove(); if (i) i.textContent = "add pack"; if (b) b.textContent = "+"; }
      const t = pr.dataset.op0 || (pr.dataset.op0 = pr.textContent.trim()), m = t.match(/^(\D*?)(\d+(?:[.,]\d+)?)(\D*)$/);
      if (p && m) { const n = parseFloat(m[2].replace(",", ".")), f = (v) => m[1] + (Number.isInteger(v) ? v : v.toFixed(2)) + m[3]; pr.innerHTML = `<s class="op-was">${f(n * 3)}</s><span class="op-now">${f(n * 2)}</span>`; }
      else if (pr.dataset.op0) pr.textContent = pr.dataset.op0;
    } else {
      const im = slot.querySelector(".fc img"), sp = slot.querySelector(".sp"), i = slot.querySelector(".fc") && slot;
      if (im && !im.dataset.o) im.dataset.o = im.getAttribute("src");
      if (im) im.src = p ? abs(p.cover) : im.dataset.o;
      slot.classList.toggle("got", !!p); if (sp) sp.style.display = p ? "none" : "";
      slot.dataset.cap = p ? String(p.name).toLowerCase() : "";
      const pk = document.querySelector("#pkTop .op-pick"); if (pk) pk.style.opacity = p ? 0 : 1;
    }
  }
  function lbCelebrate(key) {
    sndDone();
    if (key !== "add" || LBS.fr) return;
    const svg = document.querySelector("#pkTop .op-pick svg"); if (!svg) return;
    svg.parentNode.style.opacity = 1;
    const ps = [...svg.querySelectorAll("path")], arrow = ps.slice(-4);
    ps.forEach((p) => { p.setAttribute("pathLength", "1"); p.style.strokeDasharray = "1"; p.style.strokeDashoffset = "1"; });
    let tt = 150; ps.slice(0, -4).forEach((p, i) => { p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 240, delay: tt + i * 34, fill: "forwards", easing: "ease-out" }); });
    tt += (ps.length - 4) * 34 + 240;
    arrow.forEach((p, i) => p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 220, delay: tt + i * 90, fill: "forwards", easing: "ease-out" }));
    const g = arrow[0].parentNode; arrow.forEach((p) => { if (p.parentNode === g) {} });
    setTimeout(() => arrow.forEach((p) => p.animate([{ transform: "translate(0,0)" }, { transform: "translate(-7px,6px)" }, { transform: "translate(0,0)" }, { transform: "translate(-7px,6px)" }, { transform: "translate(0,0)" }], { duration: 1500, easing: "ease-in-out" })), tt + 500);
  }
  function lbClose() { if (!LB) return; const el = LB; LB = null; el.classList.add("out"); document.documentElement.classList.remove("op-lbo"); document.removeEventListener("keydown", lbKey); document.querySelectorAll(".op-lb audio").forEach((a) => a.pause()); setTimeout(() => el.remove(), 220); }
  function lbKey(e) { if (e.key === "Escape") lbClose(); }
  function openLB(key, slot, pr) {
    if (LB) return; const mode = key === "fr", cur = byId(curPid()) || PRODUCTS.find((p) => p.id === curPid()); if (!cur) return;
    const other = LBS[mode ? "add" : "fr"], refs = [cur].concat(other ? [other] : []), list = lbSorted(refs, [cur.id].concat(other ? [other.id] : []));
    let pick = LBS[key]; const was = pick, au = new Audio(); let playing = null;
    const el = document.createElement("div"); el.className = "op-lb" + (mode ? " fr" : ""); LB = el;
    const titleSvg = mode ? (() => { const s = document.querySelector("#pkTop .op-pick svg"); if (!s) return ""; const c = s.cloneNode(true); [...c.querySelectorAll("path")].slice(-4).forEach((p) => p.remove()); c.setAttribute("viewBox", "0 0 190 60"); return c.outerHTML; })() : "";
    el.innerHTML = `<div class="lb-p" role="dialog" aria-label="${mode ? "Pick free pack" : "Add pack"}"><div class="lb-h"><b>${mode ? "" : "ADD PACK"}</b><div class="lb-ti">${titleSvg}</div><button class="lb-x" aria-label="Close"></button></div>
      <div class="lb-r"><div class="lb-s"><img src="${abs(cur.cover)}" alt=""></div><div class="lb-s e${mode ? " y" : ""}"><b>+</b></div><button class="lb-d" disabled>DONE</button></div>
      <div class="lb-dd" hidden><button class="lb-dh"><span></span><svg viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z"/></svg></button><div class="lb-dl"></div></div>
      <div class="lb-g">${list.map((p, n) => `<button class="lb-t" data-id="${esc(p.id)}"><span class="lb-c"><img src="${abs(p.cover)}" alt="" loading="lazy" decoding="async">${mode ? `<span class="lb-sp">${lbSparks(4, 11 + n * 7)}</span>` : ""}</span><span class="lb-n"><em>${esc(String(p.name).toLowerCase())}</em><u>${show(p.price)}</u></span><small>${esc(String(p.sub || "").toLowerCase())}</small></button>`).join("")}</div></div>`;
    document.body.appendChild(el); document.documentElement.classList.add("op-lbo"); document.addEventListener("keydown", lbKey);
    if (mode) { const s = el.querySelector(".lb-ti svg"); if (s) lbWrite(s, 120); }
    const E = el.querySelector(".lb-s.e"), D = el.querySelector(".lb-d"), dd = el.querySelector(".lb-dd"), dl = el.querySelector(".lb-dl");
    function paint() {
      el.querySelectorAll(".lb-t").forEach((t) => t.classList.toggle("on", !!pick && t.dataset.id === pick.id));
      E.classList.toggle("f", !!pick); E.innerHTML = pick ? `<img src="${abs(pick.cover)}" alt="">` : "<b>+</b>";
      D.disabled = !pick && !was; D.classList.toggle("rdy", !D.disabled);
      dd.hidden = !pick; if (pick) { dd.querySelector(".lb-dh span").textContent = "PREVIEW · " + String(pick.name).toLowerCase(); dl.innerHTML = lbMix(pick).map((s) => `<button class="lb-sn" data-f="${esc(s.file)}"><svg viewBox="0 0 10 10"><path d="M1 0l9 5-9 5z"/></svg><span>${esc(String(s.name).split(" ").slice(1).join(" ") || s.name)}</span>${tcChip(String(s.name).split(" ")[0].toUpperCase())}<i>${esc(s.meta || "")}</i></button>`).join(""); }
    }
    el.addEventListener("click", (e) => {
      const t = e.target.closest(".lb-t"), sn = e.target.closest(".lb-sn");
      if (e.target === el || e.target.closest(".lb-x")) return lbClose();
      if (e.target.closest(".lb-dh")) { dd.classList.toggle("shut"); return; }
      if (t) { const p = list.find((x) => x.id === t.dataset.id); pick = pick && pick.id === p.id ? null : p; sndTick(); au.pause(); playing = null; dd.classList.remove("shut"); paint(); if (pick) { E.animate([{ transform: "scale(.86)" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(.2,.9,.3,1.3)" }); } return; }
      if (sn) { try { if (typeof audio !== "undefined") audio.pause(); } catch (x) {} const f = abs(sn.dataset.f); el.querySelectorAll(".lb-sn.p").forEach((b) => b.classList.remove("p")); if (playing === f && !au.paused) { au.pause(); playing = null; return; } playing = f; au.src = f; au.play().catch(() => {}); sn.classList.add("p"); au.onended = () => sn.classList.remove("p"); return; }
      if (e.target.closest(".lb-d") && !D.disabled) { lbSet(key, slot, pr, pick); lbClose(); setTimeout(() => lbCelebrate(key), 260); }
    });
    paint(); if (pick) { const t = el.querySelector(".lb-t.on"); if (t) t.scrollIntoView({ block: "nearest" }); }
  }
  function pickTwo() {
    const add = document.querySelector("#pkTop .op-s.add"), fr = document.querySelector("#pkTop .op-s.fr"), pr = document.querySelector("#pkTop .pbuy .price"); if (!O2 || !add || !pr || add.dataset.op) return; add.dataset.op = 1;
    add.addEventListener("click", (e) => { e.preventDefault(); openLB("add", add, pr); });
    if (fr) fr.addEventListener("click", (e) => { e.preventDefault(); openLB("fr", fr, pr); });
  }
  /* product page: back button sits above MORE PACKS, left edge on the rail's left edge (Eman 25 Nov) */
  function placeBack() {
    const a = document.querySelector("a.bigback"); if (!O2 || !a) return;
    const h = [...document.querySelectorAll("h4")].find((e) => /^more packs$/i.test(e.textContent.trim()) && e.getBoundingClientRect().width);
    a.style.translate = ""; a.style.width = "";
    if (!h) return;
    const all = [...h.parentElement.querySelectorAll(".pq img")].slice(0, 8).filter((im) => im.naturalWidth && !/\/card-/.test(im.currentSrc || im.src)); if (all.length < 2) return;
    const x0 = Math.min(...all.map((im) => im.getBoundingClientRect().left)); let L = 1e9, R = -1e9;
    all.forEach((im) => { const bb = alphaBox(im), r = im.getBoundingClientRect(); if (!bb) return; if (r.left - x0 < 40) L = Math.min(L, r.left + bb[0] * r.width); else R = Math.max(R, r.left + bb[1] * r.width); });
    if (L > R) return;
    const ar = a.getBoundingClientRect(); if (!ar.width) return;
    const k = a.offsetWidth ? ar.width / a.offsetWidth : 1;
    a.style.width = ((R - L) / k).toFixed(1) + "px";
    a.style.translate = ((L - a.getBoundingClientRect().left) / k).toFixed(1) + "px 0";
  }
  window.addEventListener("resize", placeBack); [400, 1200, 2500, 4000].forEach((t) => setTimeout(placeBack, t));
  /* product page: tag trading card packs so their art can be smaller (Eman 25 Nov) */
  /* product page: the white COREKULT logo sits over the series label + title column (Eman 25 Nov) */
  function pkLogo() {
    const pki = document.querySelector("#pkTop .pki"), lg = document.querySelector("nav.top .logo img"); if (!O2 || !pki || !lg) return;
    document.documentElement.classList.add("op-pp"); if (pki.querySelector(".op-pl")) return;
    pki.insertAdjacentHTML("afterbegin", `<a class="op-pl" href="/" aria-label="COREKULT home"><img src="${lg.getAttribute("src")}" alt="COREKULT" width="110" height="34"></a>`);
  }
  /* works-with buttons: one button per DAW on drum packs, every button in its own colour; Serum 1 + 2 share one (Eman 25 Nov) */
  function wwDaws() {
    if (!O2) return;
    document.querySelectorAll(".ww .wwl").forEach((l) => {
      const wav = [...l.querySelectorAll(".wwb")].find((b) => /^\s*wav/i.test(b.textContent));
      if (wav && !l.dataset.daw) {
        l.dataset.daw = 1;
        const ic = wav.querySelector("svg").outerHTML, D = [["FL Studio", "#FF8A1F"], ["Ableton Live", "#2DD4BF"], ["Logic Pro", "#C9CAD6"], ["Studio One", "#3B9BFF"], ["Pro Tools", "#8B7CFF"], ["Reaper", "#7BE06A"], ["Cubase", "#FF5A6B"]];
        wav.outerHTML = D.map((d) => `<span class="wwb" data-wc="${d[1]}">${ic}${d[0]}</span>`).join("");
      }
    });
    const C = [[/^serum/i, "#8B6CF6"], [/^vital/i, "#3DDC84"], [/^ableton/i, "#2DD4BF"], [/^midi/i, "#FFB020"]];
    document.querySelectorAll(".ww .wwb").forEach((b) => { if (b.dataset.wc) { b.style.setProperty("--wc", b.dataset.wc); return; } const t = b.textContent.trim(), c = C.find((x) => x[0].test(t)); if (c) { b.dataset.wc = c[1]; b.style.setProperty("--wc", c[1]); } });
  }
  function tcPage() { const t = document.querySelector("#pkTop"), im = t && t.querySelector(".pkc img"); if (t && im) t.classList.toggle("op-tc", /\/card-/.test(im.currentSrc || im.src)); }
  function run() { try { cardText(); ckBar(); stats(); wrapDW(); decoAll(); decoTop(); buildMag(); fitNames(); alignText(); prepSheen(); trio3(); glitter(); wwText(); pickTwo(); opRev(); backBtn(); placeBack(); tcPage(); pkLogo(); wwDaws(); } catch (e) { console.warn("opium", e); } }
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(run, 120); });
  let t = 0; new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 60); }).observe(H, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", run);
})();
