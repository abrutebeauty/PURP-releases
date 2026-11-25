/* COREKULT admin SOUND REVIEW (Eman 25 Nov). Admin only: loaded by opium.js once the admin tools (live.js) are up.
   Replaces the cramped vertical strip on every sound card with clear rows above and under the waveform:
   above  = verdict (source, priority 1-5, GOOD, FIX, skull, reference)
   under  = COMMENT, MARK (comment at a time on the waveform), disable, remove, drag
   below  = versions (V1, V2 ... , + upload, IN USE, download) and the comment list.
   Time comments show as blue markers on the waveform. Everything is saved in the packs store as D.review[packId][sound file]
   (never on the sound itself, so customers never get it). The old strip stays in the page, hidden: its buttons are pressed from here,
   so nothing that worked before changes. Turn off: REVIEW_UI = false. */
(function () {
  const REVIEW_UI = true;
  if (!REVIEW_UI || window.__rvLoaded) return; window.__rvLoaded = true;
  const D = window.ADM; if (!D) return;
  const H = document.documentElement; H.classList.add("rvw");
  D.review = D.review || {};
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const P = (id) => D.products.find((p) => p.id === id);
  const kOf = (f) => String(f || "").replace(/,[\d.]+$/, "");
  const inPv = () => H.classList.contains("adm-pv");
  const TRASH_I = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 1.5h5l.5 1.5H14v1.6H2V3h3zM3.2 6h9.6l-.7 8.2c0 .5-.4.8-.9.8H4.8c-.5 0-.9-.3-.9-.8z"/></svg>';
  const SKULL_I = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M8 1.2C4.3 1.2 1.8 3.7 1.8 7c0 1.9.9 3.4 2.3 4.3v2.4c0 .6.4 1 1 1h5.8c.6 0 1-.4 1-1v-2.4c1.4-.9 2.3-2.4 2.3-4.3 0-3.3-2.5-5.8-6.2-5.8ZM5.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8 9.3l-1 1.6h2L8 9.3Z"/></svg>';
  const DL_I = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1.5h2v7l2.6-2.6 1.4 1.4L8 12.4 3 7.3l1.4-1.4L7 8.5zM2 13h12v1.6H2z"/></svg>';
  const OFF_I = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM3.6 8a4.4 4.4 0 0 1 7-3.5L4.5 11.1A4.4 4.4 0 0 1 3.6 8zm8.8 0a4.4 4.4 0 0 1-7 3.5l6.1-6.6a4.4 4.4 0 0 1 .9 3.1z"/></svg>';
  const DRAG_I = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2.5h2.2v2.2H5zm3.8 0H11v2.2H8.8zM5 6.9h2.2v2.2H5zm3.8 0H11v2.2H8.8zM5 11.3h2.2v2.2H5zm3.8 0H11v2.2H8.8z"/></svg>';

  const css = `
  html.rvw .pv button[data-pid] .ad:not(.rvr){display:none!important}
  html.rvw.adm-pv .rvr,html.rvw.adm-pv .rvc,html.rvw.adm-pv .rvov,html.rvw.adm-pv .rvbar,html.rvw.adm-pv .rvpop{display:none!important}
  html.rvw .pv button[data-pid]{display:flex!important;flex-direction:column;align-items:stretch;align-content:normal;gap:6px}
  html.rvw .pv button[data-pid] > *{order:0}
  html.rvw .pv button[data-pid] .nm{order:1}
  html.rvw .pv button[data-pid] .rvt{order:2}
  html.rvw .pv button[data-pid] .rvpr{order:3}
  html.rvw .pv button[data-pid] canvas.wf{order:4;width:100%;flex:none}
  html.rvw .pv button[data-pid] .rvbt{order:5}
  html.rvw .pv button[data-pid] .rvvr{order:6}
  html.rvw .pv button[data-pid] .rvc{order:7}
  html.rvw .pv button[data-pid] .an{order:8}
  html.rvw .pv button[data-pid] .rvr{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0;outline:0;min-width:0;max-width:100%;flex:none}
  html.rvw .pv button[data-pid] .rvr em{font-style:normal}
  .rvb[hidden]{display:none!important}
  .rvb{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;min-width:26px;padding:0 8px;box-sizing:border-box;background:#1f1d27;color:#a29db0;font:800 10px/1 var(--body,Inter,sans-serif);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;user-select:none;white-space:nowrap;flex:none}
  .rvb:active{filter:brightness(1.5)}
  .rvb svg{width:12px;height:12px;fill:currentColor;flex:none}
  .rvb.rvsq{padding:0;width:26px}
  .rvsrc{background:#2a2340;color:#cdbcff}
  .rvsrc.none{background:#1f1d27;color:#6f6a7c}
  .rvpg{display:inline-flex;gap:1px;flex:none}
  .rvpg .rvb{padding:0;width:26px;min-width:26px;height:26px;font-family:var(--mono,"JetBrains Mono",monospace);font-size:11px;letter-spacing:0}
  .pv button[data-tier="1"] .rvpg .rvb[data-n="1"]{background:#E4FF3A;color:#0b0a0e}
  .pv button[data-tier="2"] .rvpg .rvb[data-n="2"]{background:#ff9f43;color:#0b0a0e}
  .pv button[data-tier="3"] .rvpg .rvb[data-n="3"]{background:#4dd4ff;color:#0b0a0e}
  .pv button[data-tier="4"] .rvpg .rvb[data-n="4"]{background:#b197fc;color:#0b0a0e}
  .pv button[data-tier="5"] .rvpg .rvb[data-n="5"]{background:#8a8794;color:#0b0a0e}
  .rvb.rvgd.on{background:#E4FF3A;color:#0b0a0e}
  .pv button.fx .rvb.rvfx,.rvb.rvfx.on{background:#3b82f6;color:#fff}
  .pv button.sku .rvb.rvsk{background:#ff3b4e;color:#0b0a0e}
  .rvb.rvrefb{background:#7ad9ff;color:#0b0a0e}
  .rvb.rvcmb{color:#e9e6f2}
  .rvb.rvcmb.has::after{content:"";width:6px;height:6px;background:#3b82f6;flex:none}
  .rvb.rvmkb{color:#7fb2ff}
  .pv button.off .rvb.rvoffb{background:#ff6b7a;color:#0b0a0e}
  .rvb.rvdelb{color:#ff3b4e}
  .rvb.rvdelb.sure{background:#ff6b7a;color:#0b0a0e}
  .rvb.rvdragb{cursor:grab}
  .rvsp{flex:1 1 0;min-width:0}
  .rvb.rvver{padding:0 10px;font-family:var(--mono,monospace);letter-spacing:.04em}
  .rvb.rvver.sel{background:#8b6cf6;color:#fff}
  .rvb.rvver.use::after{content:"";width:6px;height:6px;border-radius:50%;background:#3ddc84;flex:none}
  .rvb.rvuseb.on{background:#3ddc84;color:#0b0a0e}
  .rvb.rvvnew{color:#cdbcff}
  .rvc{display:flex;flex-direction:column;gap:3px;min-width:0}
  .rvc:empty{display:none}
  .rvci{display:flex;align-items:flex-start;gap:6px;background:#17161d;padding:5px 6px;font:500 12px/1.35 var(--body,Inter,sans-serif);color:#e9e6f2;min-width:0}
  .rvci .rvtm{flex:none;background:#1b2a4a;color:#7fb2ff;font:800 10px/1 var(--mono,monospace);padding:4px 5px;cursor:pointer;letter-spacing:.02em}
  .rvci .rvtm.no{background:#1f1d27;color:#6f6a7c}
  .rvci .rvtx{flex:1;min-width:0;overflow-wrap:anywhere;cursor:text}
  .rvci .rvvt{flex:none;color:#8b6cf6;font:800 9px/1 var(--mono,monospace);padding-top:4px}
  .rvci .rvxx{flex:none;width:18px;height:18px;display:grid;place-items:center;color:#6f6a7c;cursor:pointer;font-size:13px}
  .rvov{position:absolute;pointer-events:none;z-index:3}
  .rvm{position:absolute;top:0;bottom:0;width:11px;margin-left:-5px;pointer-events:auto;cursor:pointer}
  .rvm::before{content:"";position:absolute;left:5px;top:0;bottom:0;width:2px;background:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,.65)}
  .rvm b{position:absolute;left:5px;top:-1px;transform:translateY(-100%);background:#3b82f6;color:#fff;font:800 8px/1 var(--mono,monospace);padding:2px 3px;white-space:nowrap}
  .rvm.fl b{transform:translate(-100%,-100%)}
  .rvm i{display:none;position:absolute;left:5px;bottom:100%;margin-bottom:14px;width:max-content;max-width:190px;background:#0b0a0e;color:#e9e6f2;border:1px solid #3b82f6;padding:5px 7px;font:500 11px/1.35 var(--body,Inter,sans-serif);font-style:normal;z-index:6;pointer-events:none;overflow-wrap:anywhere}
  .rvm:hover i{display:block}
  .rvm.fl i{left:auto;right:5px}
  .rvpop{position:absolute;z-index:100001;display:flex;gap:4px;align-items:center;background:#141219;border:1px solid #8b6cf6;padding:6px;box-shadow:0 10px 30px rgba(0,0,0,.6)}
  .rvpop input{flex:1;min-width:160px;height:28px;box-sizing:border-box;background:#0b0a0e;border:1px solid #3a3446;color:#e9e6f2;padding:0 8px;font:500 12px var(--body,Inter,sans-serif);outline:0;border-radius:0}
  .rvpop input:focus{border-color:#8b6cf6}
  .rvpop .rvb.rvtmb{background:#1b2a4a;color:#7fb2ff;font-family:var(--mono,monospace);letter-spacing:.02em}
  .rvpop .rvb.rvtmb.no{background:#1f1d27;color:#6f6a7c}
  .rvpop .rvb.rvadd{background:#E4FF3A;color:#0b0a0e}
  .rvbar{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:0 0 14px;padding:8px;background:#141219;border:1px solid #2a2340;position:relative}
  .rvbar .rvb{height:30px}
  .rvbar .rvb.on{background:#8b6cf6;color:#fff}
  .rvbar .rvb b{font:800 11px/1 var(--mono,monospace);letter-spacing:0;color:inherit;opacity:.8}
  .rvbar .lb{font:800 10px/1 var(--body,Inter,sans-serif);letter-spacing:.14em;color:#8b6cf6;text-transform:uppercase;margin:0 8px 0 4px}
  html.rvw[data-rvf="unrev"] .pv button[data-pid]:not([data-rvu]),
  html.rvw[data-rvf="good"] .pv button[data-pid]:not([data-rvg]),
  html.rvw[data-rvf="fix"] .pv button[data-pid]:not(.fx),
  html.rvw[data-rvf="cm"] .pv button[data-pid]:not([data-rvc]){display:none!important}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---- data ---- */
  let saveT = 0;
  const toast = (t) => { const e = document.createElement("div"); e.className = "adm-toast"; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 1400); };
  function save() { clearTimeout(saveT); saveT = setTimeout(async () => {
    const r = await fetch("/api/admin/packs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(D) }).catch(() => null);
    toast(r && r.ok ? "Saved · live" : "Not saved"); try { localStorage.removeItem("ck-prod"); localStorage.removeItem("ck-draft"); } catch (e) {} }, 350); }
  const ctx = (b) => { const p = P(b.dataset.pid), s = p && p.sounds[+b.dataset.i]; return s ? { p, s, k: kOf(s.file) } : null; };
  const rec = (b, make) => { const c = ctx(b); if (!c) return null; let o = (D.review[c.p.id] || {})[c.k]; if (!o && make) { (D.review[c.p.id] = D.review[c.p.id] || {})[c.k] = o = {}; } if (o && make) { o.cm = o.cm || []; o.vers = o.vers || []; } return o || null; };
  const verList = (b) => { const c = ctx(b), o = rec(b); return [{ id: "v1", name: "V1", file: c.s.file }].concat(o && o.vers ? o.vers : []); };
  const curV = new Map();   // card key -> selected version id (this visit only)
  const vKey = (b) => b.dataset.pid + "|" + kOf((ctx(b) || { s: {} }).s.file);
  const selV = (b) => curV.get(vKey(b)) || "v1";
  const useV = (b) => { const o = rec(b); return (o && o.inuse) || "v1"; };
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---- time ---- */
  const fmt = (t) => { if (t == null || isNaN(t)) return "0:00.0"; const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); };
  const durs = new Map();
  const spr = (src) => { const m = String(src || "").match(/^(.*)#t=([\d.]+),([\d.]+)$/); return m ? { u: m[1], a: +m[2], b: +m[3] } : { u: src, a: 0, b: null }; };
  function durOf(b) {   // seconds of the sound this card is playing now (resolved promise)
    const src = b.dataset.src, sp = spr(src);
    if (sp.b != null) return Promise.resolve(sp.b - sp.a);
    try { if (typeof curBtn !== "undefined" && curBtn === b && audio.duration && isFinite(audio.duration)) { durs.set(sp.u, audio.duration); return Promise.resolve(audio.duration); } } catch (e) {}
    if (durs.has(sp.u)) return Promise.resolve(durs.get(sp.u));
    return new Promise((res) => { const a = new Audio(); a.preload = "metadata"; const fin = (v) => { durs.set(sp.u, v); res(v); }; a.onloadedmetadata = () => fin(isFinite(a.duration) ? a.duration : 0); a.onerror = () => fin(0); setTimeout(() => res(0), 6000); a.src = sp.u; });
  }
  const playFrac = (b) => { try { if (typeof curBtn !== "undefined" && curBtn === b) return segPos(); } catch (e) {} return null; };
  function seekTo(b, x) {
    const cv = b.querySelector("canvas.wf"); if (!cv) return; const r = cv.getBoundingClientRect();
    b.classList.add("sel");   // selected = a wave click jumps there (site rule)
    window.__rvSynth = true;
    cv.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: r.left + Math.min(0.995, Math.max(0, x)) * r.width, clientY: r.top + r.height / 2 }));
    window.__rvSynth = false;
  }

  /* ---- inject rows ---- */
  const topHTML = () => `<span class="ad rvr rvt"><em class="rvb rvgd" data-rv="good">GOOD</em><em class="rvb rvfx" data-rv="fix">FIX</em><em class="rvb rvsk rvsq" data-rv="skull">${SKULL_I}</em><em class="rvb rvrefb rvsq" data-rv="ref" hidden>◉</em></span><span class="ad rvr rvpr"><span class="rvpg">${[1, 2, 3, 4, 5].map((n) => `<em class="rvb" data-rv="p" data-n="${n}">${n}</em>`).join("")}</span><span class="rvsp"></span><em class="rvb rvsrc" data-rv="src">OWN</em></span>`;
  const botHTML = () => `<span class="ad rvr rvbt"><em class="rvb rvcmb" data-rv="cm">COMMENT</em><em class="rvb rvmkb" data-rv="mk">◆ MARK</em><span class="rvsp"></span><em class="rvb rvoffb rvsq" data-rv="off">${OFF_I}</em><em class="rvb rvdelb rvsq" data-rv="del">${TRASH_I}</em><em class="rvb rvdragb rvsq" data-a="drag">${DRAG_I}</em></span>`;
  const verHTML = () => `<span class="ad rvr rvvr"></span>`;
  function inject(b) {
    if (b.querySelector(".rvr")) return;
    const wf = b.querySelector("canvas.wf"); if (!wf) return;
    b.insertAdjacentHTML("beforeend", topHTML() + botHTML() + verHTML() + `<span class="rvc"></span><span class="rvov"></span>`);
    const key = vKey(b), v = curV.get(key); if (v && v !== "v1") applyVer(b, v, true);
    sync(b);
  }
  function setBool(el, on) { if (el && el.classList.contains("on") !== on) el.classList.toggle("on", on); }
  function sync(b) {
    const c = ctx(b); if (!c) return; const o = rec(b);
    const old = b.querySelector(".ad:not(.rvr)"), srcOld = old && old.querySelector("i.src"), top = b.querySelector(".rvt"); if (!top) return;
    const sv = b.querySelector(".rvsrc"), tx = (srcOld && srcOld.textContent.trim()) || "?"; if (sv.textContent !== tx) sv.textContent = tx; sv.classList.toggle("none", tx === "?");
    const rf = old && old.querySelector("i[data-a=ref]"), rb = b.querySelector(".rvrefb"); if (rb) { rb.hidden = !rf; if (rf) { rb.textContent = rf.textContent; } }
    setBool(b.querySelector(".rvgd"), !!(o && o.good));
    const cm = (o && o.cm) || [], n = cm.length, un = !(o && o.good) && !c.s.fix && !c.s.mark && !n && !c.s.note && !c.s.hidden;
    b.toggleAttribute("data-rvg", !!(o && o.good)); b.toggleAttribute("data-rvc", n > 0); b.toggleAttribute("data-rvu", un);
    const cmb = b.querySelector(".rvcmb"); if (cmb) cmb.classList.toggle("has", n > 0);
    // versions row
    const vs = verList(b), sel = selV(b), inuse = useV(b), vr = b.querySelector(".rvvr"), sig = JSON.stringify([vs.map((x) => x.id + x.name), sel, inuse]);
    if (vr && vr.dataset.sig !== sig) { vr.dataset.sig = sig;
      vr.innerHTML = vs.map((x) => `<em class="rvb rvver${x.id === sel ? " sel" : ""}${x.id === inuse ? " use" : ""}" data-rv="ver" data-v="${esc(x.id)}">${esc(x.name)}</em>`).join("") + `<em class="rvb rvvnew rvsq" data-rv="vnew">+</em><span class="rvsp"></span><em class="rvb rvuseb${sel === inuse ? " on" : ""}" data-rv="use">IN USE</em><em class="rvb rvsq" data-rv="dl">${DL_I}</em>`; }
    // comment list
    const list = b.querySelector(".rvc"), csig = JSON.stringify([cm.map((x) => [x.id, x.txt, x.t, x.v]), sel]);
    if (list && list.dataset.sig !== csig) { list.dataset.sig = csig;
      list.innerHTML = cm.slice().sort((a, z) => (a.x == null ? -1 : a.x) - (z.x == null ? -1 : z.x)).map((x) => `<span class="rvci" data-id="${esc(x.id)}"><em class="rvtm${x.x == null ? " no" : ""}" data-rv="go">${x.x == null ? "—" : fmt(x.t)}</em><span class="rvtx" data-rv="edit">${esc(x.txt)}</span>${x.v && x.v !== "v1" ? `<span class="rvvt">${esc(x.v.toUpperCase())}</span>` : ""}<span class="rvxx" data-rv="rm">×</span></span>`).join(""); }
    paintMarks(b, cm, sel);
  }
  function paintMarks(b, cm, sel) {
    const ov = b.querySelector(".rvov"), cv = b.querySelector("canvas.wf"); if (!ov || !cv) return;
    const L = cv.offsetLeft, T = cv.offsetTop, W = cv.offsetWidth, Hh = cv.offsetHeight;
    const geo = [L, T, W, Hh].join(), sig = JSON.stringify([geo, cm.map((x) => [x.id, x.x, x.t, x.txt, x.v]), sel]);
    if (ov.dataset.sig === sig) return; ov.dataset.sig = sig;
    ov.style.cssText = `left:${L}px;top:${T}px;width:${W}px;height:${Hh}px`;
    ov.innerHTML = cm.filter((x) => x.x != null && (x.v || "v1") === sel).map((x) => `<span class="rvm${x.x > 0.8 ? " fl" : ""}" data-rv="mark" data-id="${esc(x.id)}" style="left:${(x.x * 100).toFixed(2)}%"><b>${fmt(x.t)}</b><i>${esc(x.txt)}</i></span>`).join("");
  }
  const syncAll = () => document.querySelectorAll(".pv button[data-pid]").forEach((b) => { inject(b); sync(b); });
  let raf = 0; const later = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; syncAll(); }); };
  new MutationObserver((ml) => { if (ml.every((m) => m.target.closest && m.target.closest(".rvr,.rvc,.rvov,.rvpop"))) return; later(); }).observe(document.body, { childList: true, subtree: true });
  new ResizeObserver(later).observe(document.body);
  addEventListener("resize", () => { document.querySelectorAll(".rvov").forEach((o) => delete o.dataset.sig); later(); });

  /* ---- versions ---- */
  function applyVer(b, id, quiet) {
    const v = verList(b).find((x) => x.id === id); if (!v) return;
    try { if (typeof curBtn !== "undefined" && curBtn === b) { audio.pause(); stopCur(); } } catch (e) {}
    curV.set(vKey(b), id); b.dataset.src = v.file;
    const redraw = () => { try { drawWave(b, 0); } catch (e) {} };
    try { if (typeof peaks !== "undefined" && !peaks.has(v.file)) getPeaks(v.file).then(redraw).catch(() => {}); else redraw(); } catch (e) {}
    if (!quiet) sync(b);
  }
  const pickAudio = () => new Promise((res) => { const i = document.createElement("input"); i.type = "file"; i.accept = "audio/*"; i.onchange = () => res(i.files[0] || null); i.click(); });
  async function addVersion(b) {
    const f = await pickAudio(); if (!f) return; toast("Uploading…");
    const r = await fetch("/api/admin/upload?name=" + encodeURIComponent(f.name), { method: "POST", headers: { "content-type": f.type || "application/octet-stream" }, body: f }).catch(() => null);
    const d = r && (await r.json().catch(() => ({}))); if (!d || !d.ok) { toast("Upload failed"); return; }
    const o = rec(b, true), n = verList(b).length + 1, id = "v" + n + "-" + uid();
    o.vers.push({ id, name: "V" + n, file: d.url, at: Date.now() }); save(); applyVer(b, id); sync(b);
  }
  function download(b) {
    const v = verList(b).find((x) => x.id === selV(b)); if (!v) return;
    const a = document.createElement("a"); a.href = new URL(spr(v.file).u, location.href).href; a.download = (ctx(b).s.name || "sound").replace(/[^\w ]+/g, "") + " " + v.name + ".mp3"; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---- comment popup ---- */
  let pop = null;
  const closePop = () => { if (pop) { pop.el.remove(); pop = null; } };
  async function openPop(b, o) {   // o: { x, id, txt }  (x = wave position 0..1 or null)
    closePop(); document.querySelectorAll(".adm-note").forEach((e) => e.remove());
    const r = b.getBoundingClientRect(), el = document.createElement("div"); el.className = "rvpop";
    const st = { x: o && o.x != null ? o.x : null, id: o && o.id, t: o && o.t != null ? o.t : null };
    el.innerHTML = `<em class="rvb rvtmb" data-pp="t"></em><input placeholder="Comment" maxlength="400" value="${esc((o && o.txt) || "")}"><em class="rvb rvadd" data-pp="ok">${st.id ? "SAVE" : "ADD"}</em><em class="rvb rvsq" data-pp="x">×</em>`;
    el.style.left = Math.max(8, Math.min(scrollX + innerWidth - 400, scrollX + r.left)) + "px"; el.style.top = scrollY + Math.min(innerHeight - 60, r.bottom + 4) + "px";
    document.body.appendChild(el); pop = { el, b, st };
    const tb = el.querySelector(".rvtmb"), inp = el.querySelector("input");
    const paint = () => { tb.classList.toggle("no", st.x == null); tb.textContent = st.x == null ? "NO TIME" : "◆ " + fmt(st.t); };
    paint(); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
    const dur = await durOf(b); pop.dur = dur;
    if (st.x != null && st.t == null) { st.t = st.x * dur; paint(); }
    el.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-pp]"); if (!t) return; e.stopPropagation(); const k = t.dataset.pp;
      if (k === "x") return closePop();
      if (k === "t") {   // press = re-mark from the playhead; press again when it is already marked and not playing = clear
        const f = playFrac(b); if (f != null) { st.x = f; st.t = f * dur; } else st.x = st.x == null ? 0 : null; if (st.x == null) st.t = null; else if (st.t == null) st.t = st.x * dur; paint(); inp.focus(); return; }
      if (k === "ok") done();
    });
    const done = () => {
      const txt = inp.value.trim(); if (!txt) return closePop();
      const rr = rec(b, true), sv = selV(b);
      if (st.id) { const c = rr.cm.find((x) => x.id === st.id); if (c) { c.txt = txt; c.x = st.x; c.t = st.t; } }
      else rr.cm.push({ id: uid(), x: st.x, t: st.t, txt, v: sv, at: Date.now() });
      save(); closePop(); sync(b);
    };
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") done(); if (e.key === "Escape") closePop(); });
    inp.addEventListener("keyup", (e) => e.stopPropagation());
  }
  document.addEventListener("pointerdown", (e) => { if (pop && !pop.el.contains(e.target)) closePop(); }, true);

  /* ---- clicks ---- */
  const old = (b, sel) => b.querySelector(".ad:not(.rvr) " + sel);
  function setTier(b, n) {
    const m = old(b, "[data-a=mark]"); if (!m) return; const cur = +(b.dataset.tier || 0);
    m.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
    const t = document.querySelector('.adm-tier [data-tset="' + (cur === n ? 0 : n) + '"]'); if (t) t.click(); document.querySelector(".adm-tier")?.remove();
  }
  window.addEventListener("click", async (e) => {
    if (window.__rvSynth || inPv()) return;
    const t = e.target; if (!t.closest) return;
    // shift-click the waveform = comment at that spot
    const cv = t.closest && t.closest(".pv button[data-pid] canvas.wf");
    if (cv && e.shiftKey) { e.preventDefault(); e.stopPropagation(); const b = cv.closest("button[data-pid]"), r = cv.getBoundingClientRect(); openPop(b, { x: Math.min(0.995, Math.max(0, (e.clientX - r.left) / r.width)) }); return; }
    const a = t.closest("[data-rv]"); if (!a) return;
    const b = a.closest("button[data-pid]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const k = a.dataset.rv, c = ctx(b); if (!c) return;
    const after = () => setTimeout(() => { sync(b); }, 0);
    if (k === "src") { const o = old(b, "i.src"); if (o) o.click(); return after(); }
    if (k === "p") { setTier(b, +a.dataset.n); return after(); }
    if (k === "good") { const o = rec(b, true); o.good = !o.good; if (!o.good) delete o.good; if (o.good && c.s.fix) { const f = old(b, "[data-a=fix]"); if (f) f.click(); } save(); return after(); }
    if (k === "fix") { const f = old(b, "[data-a=fix]"); if (f) f.click(); const o = rec(b); if (c.s.fix && o && o.good) { delete o.good; save(); } document.querySelectorAll(".adm-note").forEach((x) => x.remove()); if (c.s.fix && !(o && o.cm && o.cm.length) && !c.s.note) openPop(b); return after(); }
    if (k === "skull") { const o = old(b, "[data-a=skull]"); if (o) o.click(); return after(); }
    if (k === "off") { const o = old(b, "[data-a=off]"); if (o) o.click(); return after(); }
    if (k === "ref") { const o = old(b, "[data-a=ref]"); if (o) o.click(); return; }
    if (k === "del") { if (!a.classList.contains("sure")) { a.classList.add("sure"); a.textContent = "REMOVE?"; setTimeout(() => { a.classList.remove("sure"); a.innerHTML = TRASH_I; }, 2500); return; }
      const o = old(b, "[data-a=del]"); if (o) { o.click(); o.click(); } return; }
    if (k === "cm") return openPop(b);
    if (k === "mk") { const f = playFrac(b); return openPop(b, { x: f == null ? 0 : f }); }
    if (k === "mark" || k === "go") { const id = k === "mark" ? a.dataset.id : a.closest(".rvci").dataset.id, rr = rec(b), cm = rr && rr.cm.find((x) => x.id === id); if (!cm || cm.x == null) return;
      if (cm.v && cm.v !== "v1" && cm.v !== selV(b)) applyVer(b, cm.v); seekTo(b, cm.x); return; }
    if (k === "edit") { const id = a.closest(".rvci").dataset.id, rr = rec(b), cm = rr && rr.cm.find((x) => x.id === id); if (cm) openPop(b, { id: cm.id, x: cm.x, t: cm.t, txt: cm.txt }); return; }
    if (k === "rm") { const id = a.closest(".rvci").dataset.id, rr = rec(b); if (rr) { rr.cm = rr.cm.filter((x) => x.id !== id); save(); toast("Comment removed"); } return after(); }
    if (k === "ver") { applyVer(b, a.dataset.v); return; }
    if (k === "vnew") return addVersion(b);
    if (k === "use") { const o = rec(b, true), v = selV(b); if (o.inuse === v || (!o.inuse && v === "v1")) { delete o.inuse; if (v !== "v1") o.inuse = "v1"; } else o.inuse = v; if (o.inuse === "v1") delete o.inuse; save(); return after(); }
    if (k === "dl") return download(b);
  }, true);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });

  /* ---- filter bar (pack pages): look at one group of sounds at a time ---- */
  function bar() {
    if (document.querySelector(".rvbar")) return; const first = document.querySelector(".pv.big[data-k], .pv[data-k]"); if (!first || !first.querySelector("button[data-pid]")) return;
    const host = first.closest("section") || first; const el = document.createElement("div"); el.className = "rvbar";
    el.innerHTML = `<span class="lb">Review</span>` + [["", "ALL"], ["unrev", "NOT REVIEWED"], ["good", "GOOD"], ["fix", "FIX"], ["cm", "COMMENTS"]].map(([k, l]) => `<em class="rvb" data-rf="${k}">${l} <b data-n="${k}"></b></em>`).join("");
    host.parentElement.insertBefore(el, host);
    el.addEventListener("click", (e) => { const t = e.target.closest("[data-rf]"); if (!t) return; e.preventDefault(); e.stopPropagation(); const k = t.dataset.rf; if (k) H.dataset.rvf = k; else delete H.dataset.rvf; cnt(); });
  }
  function cnt() {
    const el = document.querySelector(".rvbar"); if (!el) return; const bs = [...document.querySelectorAll(".pv button[data-pid]")], f = H.dataset.rvf || "";
    const n = { "": bs.length, unrev: bs.filter((b) => b.hasAttribute("data-rvu")).length, good: bs.filter((b) => b.hasAttribute("data-rvg")).length, fix: bs.filter((b) => b.classList.contains("fx")).length, cm: bs.filter((b) => b.hasAttribute("data-rvc")).length };
    el.querySelectorAll("[data-rf]").forEach((t) => { t.classList.toggle("on", t.dataset.rf === f); t.querySelector("b").textContent = n[t.dataset.rf]; });
  }
  const _sync = syncAll;
  const boot = () => { syncAll(); bar(); cnt(); };
  boot(); setInterval(() => { bar(); cnt(); }, 1200);
  document.addEventListener("click", () => setTimeout(() => { syncAll(); cnt(); }, 30), true);
  setTimeout(boot, 600); setTimeout(boot, 2000);
})();
