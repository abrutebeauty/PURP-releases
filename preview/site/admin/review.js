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
  .rvos{background:#2a2340;color:#cdbcff;min-width:34px}
  .rvom{background:#2a2340;color:#cdbcff;flex:0 1 auto;max-width:130px;min-width:34px;overflow:hidden;text-overflow:ellipsis;justify-content:flex-start;display:inline-block;line-height:28px;padding:0 8px}
  .rvos.none,.rvom.none{background:#1f1d27;color:#6f6a7c}
  .rvos.on,.rvom.on{background:#8b6cf6;color:#fff}
  .rvorg{position:fixed;z-index:100002;width:300px;max-width:calc(100vw - 16px);box-sizing:border-box;background:#141219;border:1px solid #8b6cf6;padding:10px;box-shadow:0 10px 30px rgba(0,0,0,.6);font:500 12px/1.4 var(--body,Inter,sans-serif);color:#e9e6f2;display:flex;flex-direction:column;gap:8px}
  .rvorg .oh{display:flex;align-items:center;gap:6px;font:800 10px/1 var(--body,Inter,sans-serif);letter-spacing:.14em;color:#8b6cf6;text-transform:uppercase}
  .rvorg .oh .on_{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a29db0;letter-spacing:.04em;text-transform:none;font-weight:600}
  .rvorg .ob{display:flex;flex-wrap:wrap;gap:3px}
  .rvorg .rvb{height:26px;padding:0 8px}
  .rvorg .rvb.sel{background:#8b6cf6;color:#fff}
  .rvorg textarea,.rvorg input{width:100%;box-sizing:border-box;background:#0b0a0e;border:1px solid #3a3446;color:#e9e6f2;padding:6px 8px;font:500 12px/1.4 var(--body,Inter,sans-serif);outline:0;border-radius:0;resize:vertical}
  .rvorg input{height:28px;padding:0 8px}
  .rvorg textarea{min-height:64px}
  .rvorg textarea:focus,.rvorg input:focus{border-color:#8b6cf6}
  .rvorg .os{background:#1b1922;padding:8px;color:#e9e6f2;overflow-wrap:anywhere}
  .rvpg{display:inline-flex;gap:1px;flex:none;margin-left:6px}
  .rvpg .rvb{padding:0;width:23px;min-width:23px;height:28px;font-family:var(--mono,"JetBrains Mono",monospace);font-size:11px;letter-spacing:0}
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
  html.rvw .pv button[data-pid] .rvr.rvvr{flex-wrap:nowrap}
  .rvvr .rvspx{flex:0 0 4px}
  .rvlb{position:fixed;inset:0;z-index:100010;background:rgba(5,4,8,.88);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
  .lbx{width:min(1240px,100%);max-height:100%;overflow:auto;background:#0f0e13;border:1px solid #8b6cf6;padding:22px 24px 24px;box-sizing:border-box;color:#ecebf0;font:500 12px/1.4 var(--body,Inter,sans-serif)}
  .lbh{display:flex;align-items:center;gap:14px;margin-bottom:18px}
  .lbc{background:#ecebf0;color:#0e0d12;font:400 10px/1 var(--mono,monospace);letter-spacing:.14em;padding:4px 9px}
  .lbn{font:700 22px/1 Inter,sans-serif;letter-spacing:-.02em;text-transform:lowercase}
  .lbv{color:#8b6cf6;font:800 10px/1 Inter,sans-serif;letter-spacing:.14em}
  .lbw{position:relative;height:300px;background:#0a090d;border:1px solid #2a2733;cursor:pointer}
  .lbw canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .lbov{position:absolute;inset:0;pointer-events:none}
  .lbm{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed #E4FF3A;pointer-events:auto;cursor:pointer}
  .lbm b{position:absolute;top:0;left:0;transform:translateX(-50%);background:#E4FF3A;color:#0b0a0e;font:800 9px/1 var(--mono,monospace);padding:3px 5px;white-space:nowrap}
  .lbph{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 8px rgba(255,255,255,.6);pointer-events:none}
  .lbt{display:flex;align-items:center;gap:12px;margin:14px 0}
  .lbpl{width:84px;height:34px;background:#8b6cf6;color:#fff}
  .lbad{height:34px}
  .lbtm{font:400 11px/1 var(--mono,monospace);letter-spacing:.1em;color:#a5a4ad}
  .lbl{display:flex;flex-direction:column;gap:6px}
  .lbtabs{display:flex;gap:8px;margin:0 0 14px}
  .lbtab{height:30px;padding:0 14px;background:#1b1830;color:#cdbcff}
  .lbtab.on{background:#8b6cf6;color:#fff}
  .lbpane[hidden]{display:none}
  .lbmidi iframe{width:100%;height:min(640px,calc(100vh - 230px));border:1px solid #2a2733;background:#0b0a0e;display:block}
  .lbmidi .lbsv{display:flex;align-items:center;gap:10px;margin:10px 0 0}
  .lbmidi .lbsv .rvb{height:34px;padding:0 16px}
  .lbmidi .lbsv .lbsave{background:#E4FF3A;color:#0b0a0e}
  .lbmidi .lbsv .lbsave.busy{background:#1f1d27;color:#a29db0;pointer-events:none}
  .lbmidi .lbsv .lbst{font:400 11px/1.3 var(--mono,monospace);letter-spacing:.06em;color:#a5a4ad}
  .lbmidi .lbsv .lbst.dirty{color:#ff6b7a}
  .lbmidi .lbsv .lbpn{margin-left:auto;font:800 10px/1 Inter,sans-serif;letter-spacing:.14em;color:#8b6cf6;text-transform:uppercase}
  .lbmidi .lbmn{color:#a5a4ad;font:400 11px/1.4 var(--mono,monospace);margin:8px 0 0;letter-spacing:.04em}
  .lbci{display:flex;align-items:center;gap:8px}
  .lbci input{flex:1;min-width:0;height:32px;box-sizing:border-box;background:#0b0a0e;border:1px solid #3a3446;color:#ecebf0;padding:0 10px;font:500 13px/1 Inter,sans-serif;outline:0;border-radius:0}
  .lbci input:focus{border-color:#8b6cf6}
  .lbci .lbtmb{min-width:64px;height:32px;background:#1b1830;color:#cdbcff}

  .rvb.rvver{padding:0 10px;font-family:var(--mono,monospace);letter-spacing:.04em}
  .rvb.rvver.sel{background:#8b6cf6;color:#fff}
  .rvb.rvver.use{background:#3ddc84;color:#0b0a0e}
  .rvb.rvver.use.sel::after{content:"";width:6px;height:6px;border-radius:50%;background:#0b0a0e;flex:none}
  .rvb.rvuseb.on{background:#3ddc84;color:#0b0a0e}
  .rvb.rvvnew{color:#cdbcff}
  .rvc{display:flex;flex-direction:column;gap:3px;min-width:0}
  .rvc:empty{display:none}
  .rvci{display:flex;align-items:flex-start;gap:6px;background:#2f6fe0;padding:6px;font:500 12px/1.35 var(--body,Inter,sans-serif);color:#fff;min-width:0}
  .rvci .rvtm{flex:none;background:#1a3f8f;color:#fff;font:800 10px/1 var(--mono,monospace);padding:4px 5px;cursor:pointer;letter-spacing:.02em}
  .rvci .rvtx{flex:1;min-width:0;overflow-wrap:anywhere;cursor:text;user-select:text;-webkit-user-select:text;min-height:15px}
  .rvci .rvtx[contenteditable]{outline:1px solid #fff;background:#1a3f8f;padding:0 3px}
  .rvci .rvvt{flex:none;color:#bcd2ff;font:800 9px/1 var(--mono,monospace);padding-top:4px}
  .rvci .rvxx{flex:none;width:18px;height:18px;display:grid;place-items:center;color:#bcd2ff;cursor:pointer;font-size:13px}
  .nmt[contenteditable]{outline:1px solid #8b6cf6!important;background:#0b0a0e;cursor:text;user-select:text;-webkit-user-select:text;min-width:40px}
  .rvov{position:absolute;pointer-events:none;z-index:3}
  .rvph{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 8px rgba(255,255,255,.7);display:none}
  .rvm{position:absolute;top:0;bottom:0;width:11px;margin-left:-5px;pointer-events:auto;cursor:ew-resize}
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
  const verList = (b) => { const c = ctx(b), o = rec(b); return [{ id: "v1", name: "V1", file: b.dataset.rvo || c.s.file }].concat(o && o.vers ? o.vers : []); };
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


  /* ---- transport (Eman 25 Nov): Space pauses where it is and resumes there; a paused sound can be scrubbed by dragging the waveform;
     after the full sound played it stops and the line is back at 0:00. Only while the admin tools are on (not in Preview). ---- */
  let paused = null;   // { b, pf }
  const isTap = () => H.classList.contains("tapplay");
  const playing = (b) => { try { return typeof curBtn !== "undefined" && curBtn === b; } catch (e) { return false; } };
  const tapGet = (b) => { try { return isTap() && typeof tapResume !== "undefined" ? tapResume.get(b.dataset.src) : undefined; } catch (e) { return undefined; } };
  function pos(b) {   // where the line sits while this sound is NOT playing (null = at the start)
    if (playing(b)) return null;
    if (paused && paused.b === b) return paused.pf;
    const t = tapGet(b); return t == null ? null : t;
  }
  function setPaused(b, f) {
    f = Math.min(1, Math.max(0, f)); paused = { b, pf: f };
    try { if (isTap()) { if (f > 0.003) tapResume.set(b.dataset.src, f); else tapResume.delete(b.dataset.src); } } catch (e) {}
    paintPh(b);
  }
  function paintPh(b) {
    const ph = b.querySelector(".rvph"); if (!ph) return; const f = pos(b);
    if (f == null || f <= 0.003) { if (ph.style.display) ph.style.display = ""; return; }
    ph.style.display = "block"; ph.style.left = (f * 100).toFixed(2) + "%";
  }
  function pauseNow(b) { const f = segPos(); audio.pause(); stopCur(); setPaused(b, f); }
  function playFrom(b, f) {
    paused = null; try { if (isTap()) tapResume.set(b.dataset.src, f); } catch (e) {}
    window.__rvSynth = true;
    try {
      if (isTap()) b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      else seekTo(b, f);
    } finally { window.__rvSynth = false; }
    setTimeout(syncAll, 30);
  }
  const jumpTo = (b, x) => { if (playing(b)) sureSeek(x); else setPaused(b, x); };
  ["play", "pause", "ended"].forEach((ev) => audio.addEventListener(ev, () => { if (ev === "play" && !window.__rvSynth) paused = null; setTimeout(syncAll, 30); }));
  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  function spaceTarget() {
    if (typeof curBtn !== "undefined" && curBtn && curBtn.dataset.pid) return curBtn;
    if (typeof curBtn !== "undefined" && curBtn) return null;   // a non-admin sound (top preview): leave Space alone
    if (paused && paused.b.isConnected) return paused.b;
    return document.querySelector(".pv button[data-pid].sel");
  }
  window.addEventListener("keydown", (e) => {
    if (document.querySelector(".rvlb") || (e.code !== "Space" && e.key !== " ") || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || inPv() || typing(e.target) || typing(document.activeElement)) return;
    const b = spaceTarget(); if (!b) return;
    e.preventDefault(); e.stopPropagation(); if (e.repeat) return;
    if (playing(b)) return pauseNow(b);
    const f = pos(b); playFrom(b, f != null && f < 0.995 ? f : 0);
  }, true);
  window.addEventListener("keyup", (e) => { if ((e.code === "Space" || e.key === " ") && !inPv() && !typing(e.target) && spaceTarget()) { e.preventDefault(); e.stopPropagation(); } }, true);
  let sc = null, scT = 0;   // drag the line while paused
  const scMove = (e) => { if (!sc) return; const r = sc.cv.getBoundingClientRect(), f = Math.min(0.995, Math.max(0, (e.clientX - r.left) / r.width)); sc.f = f;
    if (playing(sc.b)) { const L = segLen(); if (L) audio.currentTime = seg.a + f * L; } else setPaused(sc.b, f);   // playing: keep playing from the new spot; paused: stay paused
    e.preventDefault(); };
  window.addEventListener("pointerdown", (e) => {
    if (inPv() || e.button !== 0 || e.shiftKey || window.__rvSynth) return;
    const cv = e.target.closest && e.target.closest(".pv button[data-pid] canvas.wf"); if (!cv) return;
    const b = cv.closest("button[data-pid]"); if (!playing(b) && !(pos(b) != null || b.classList.contains("sel"))) return;
    sc = { b, cv }; scT = Date.now(); e.stopPropagation(); scMove(e);
  }, true);
  window.addEventListener("pointermove", (e) => { if (sc) { scT = Date.now(); scMove(e); } }, true);
  const scEnd = () => { if (sc) { const d = sc; sc = null; scT = Date.now(); if (playing(d.b) && d.f != null) sureSeek(d.f); } };
  window.addEventListener("pointerup", scEnd, true); window.addEventListener("pointercancel", scEnd, true);
  window.addEventListener("click", (e) => { if (!window.__rvSynth && !sc && Date.now() - scT < 350) { e.preventDefault(); e.stopPropagation(); } }, true);   // the click that ends a drag (it may land outside the wave) must never play / pause

  // 26 Nov: pressing play on the card again (not the waveform scrub, not Space) starts from the beginning, also after a Space pause
  window.addEventListener("click", (e) => {
    if (window.__rvSynth || inPv()) return; const t = e.target; if (!t.closest) return;
    const b = t.closest(".pv button[data-pid]"); if (!b || playing(b) || t.closest(".rvr,.rvc,.rvov,canvas.wf,.nm,[data-rv],[data-a]")) return;
    paused = null; try { if (typeof tapResume !== "undefined") tapResume.delete(b.dataset.src); } catch (x) {} paintPh(b);
  }, true);

  /* ---- ORIGINS (Eman 25 Nov): where the sound came from + where the MIDI came from. Base labels live in /admin/origins.json (written from the old pack threads,
     "?" = not recorded); anything Eman edits is saved in D.review[pack][sound].src / .midi and wins over the base. ---- */
  let ORG = {}; fetch("/admin/origins.json?v=1", { cache: "no-cache" }).then((r) => r.ok ? r.json() : {}).then((j) => { ORG = j || {}; syncAll(); }).catch(() => {});
  const SRC_CODES = [["YT", "YouTube tutorial / video"], ["FREE", "Free preset found online"], ["OWN", "Made from scratch"], ["PS", "PresetShare"], ["SPL", "Splice"], ["TECH", "Technique recipe / interview"], ["AI", "Generated sound (ElevenLabs)"], ["?", "Not recorded yet"]];
  const SRC_OLD = { "FREE WWW": "FREE", "FREE P": "FREE", "S": "SPL" };
  const SCI = ["PLAYBOI", "CRYSTAL", "DREAMCORE", "TRAVIS", "OPIUM", "FULL"];
  const oBase = (b) => ORG[(ctx(b) || { k: "" }).k] || {};
  function oSrc(b) {
    const o = rec(b), c = ctx(b); if (o && o.src) return { c: o.src.c || "?", s: o.src.s || "" };
    const st = c && c.s.srcTag; if (st && st !== "?") return { c: SRC_OLD[st] || st, s: "" };
    const m = oBase(b).src; return m ? { c: m.c || "?", s: m.s || "" } : { c: "?", s: "" };
  }
  function oMidi(b) { const o = rec(b); if (o && o.midi && !Array.isArray(o.midi)) return o.midi; return oBase(b).midi || {}; }
  function midiLabel(m) {
    if (!m) return "?"; if (m.none) return "—";
    const p = []; if (m.song) p.push((m.pct === -1 ? "≈ " : (m.pct && m.pct < 100) ? "~" + m.pct + "% " : "1:1 ") + m.song);
    if (m.sci && m.sci.length) p.push(m.sci.join("+") + " SCI");
    if (!p.length && m.own) return "OWN"; return p.length ? p.join(" + ") : "?";
  }
  function midiText(m) {
    if (!m) return ""; if (m.none) return "No MIDI (drum one-shot / no melody)";
    const p = []; if (m.song) p.push(m.pct === -1 ? "Based on " + m.song + " (how much was changed is not recorded)" : (m.pct && m.pct < 100) ? "Based on " + m.song + ", remade about " + m.pct + "%" : "Same as " + m.song + " (1:1)");
    if (m.sci && m.sci.length) p.push("our " + m.sci.join(" + ") + " MIDI science");
    if (!p.length && m.own) return "Our own MIDI, written from scratch"; return p.join(" + ");
  }
  let org = null;
  const closeOrg = () => { if (org) { org.el.remove(); org = null; } };
  function orgRefresh(b) { const vr = b.querySelector(".rvvr"); if (vr) vr.dataset.sig = ""; sync(b); }
  function openOrg(b, kind, anchor) {
    const same = org && org.b === b && org.kind === kind; closeOrg(); if (same) return;
    const el = document.createElement("div"); el.className = "rvorg"; document.body.appendChild(el); org = { el, b, kind };
    ["keydown", "keyup", "keypress"].forEach((n) => el.addEventListener(n, (e) => { e.stopPropagation(); if (n === "keydown" && e.key === "Escape") closeOrg(); }));
    el.addEventListener("input", (e) => orgInput(e));
    drawOrg();
    const r = anchor.getBoundingClientRect(), h = el.offsetHeight; let left = Math.min(r.left, innerWidth - el.offsetWidth - 8), top = r.bottom + 4; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
    el.style.left = Math.max(8, left) + "px"; el.style.top = top + "px";
  }
  function drawOrg() {
    if (!org) return; const { el, b, kind } = org, c = ctx(b); if (!c) return closeOrg(); const nm = c.s.name || "";
    if (kind === "s") {
      const v = oSrc(b), info = SRC_CODES.find((x) => x[0] === v.c);
      el.innerHTML = `<div class="oh">SOUND ORIGIN<span class="on_">${esc(nm)}</span></div>
        <div class="os"><b>${esc(v.c)}</b> · ${esc(info ? info[1] : v.c)}${v.s ? "<br>" + esc(v.s) : ""}</div>
        <div class="ob">${SRC_CODES.map(([k]) => `<em class="rvb${k === v.c ? " sel" : ""}" data-o="sc" data-c="${esc(k)}">${esc(k)}</em>`).join("")}</div>
        <textarea data-o="st" placeholder="where exactly (e.g. playboi carti type bass, youtube)">${esc(v.s)}</textarea>`;
    } else {
      const m = oMidi(b);
      el.innerHTML = `<div class="oh">MIDI ORIGIN<span class="on_">${esc(nm)}</span></div>
        <div class="os">${esc(midiText(m) || "Not recorded yet (?)")}${m.s ? "<br>" + esc(m.s) : ""}</div>
        <input data-o="ms_" placeholder="song (leave empty if none)" value="${esc(m.song || "")}">
        <div class="ob">${[[100, "1:1"], [75, "~75%"], [50, "~50%"], [25, "~25%"]].map(([n, l]) => `<em class="rvb${m.song && (m.pct || 100) === n ? " sel" : ""}" data-o="mp" data-p="${n}">${l}</em>`).join("")}</div>
        <div class="ob">${SCI.map((k) => `<em class="rvb${m.sci && m.sci.includes(k) ? " sel" : ""}" data-o="msci" data-c="${k}">${k}</em>`).join("")}</div>
        <div class="ob"><em class="rvb${m.own && !m.song && !(m.sci || []).length ? " sel" : ""}" data-o="mf" data-f="own">OWN</em><em class="rvb${m.none ? " sel" : ""}" data-o="mf" data-f="none">NO MIDI</em><em class="rvb" data-o="mf" data-f="unk">?</em></div>
        <textarea data-o="mt" placeholder="summary (e.g. based on My Eyes musescore midi, remade ~50%)">${esc(m.s || "")}</textarea>`;
    }
  }
  function orgGet(b, kind) { const o = rec(b, true); if (kind === "s") { if (!o.src) o.src = Object.assign({}, oSrc(b)); return o.src; } if (!o.midi) o.midi = JSON.parse(JSON.stringify(oMidi(b))); if (!o.midi.sci) o.midi.sci = []; return o.midi; }
  function orgClick(e, t) {
    if (!org) return; const a = t.closest("[data-o]"), { b, kind } = org; if (!a) return; if (a.tagName === "TEXTAREA" || a.tagName === "INPUT") return;
    const m = orgGet(b, kind), k = a.dataset.o;
    if (k === "sc") m.c = a.dataset.c;
    else if (k === "mp") { if (!m.song) { drawOrg(); const i = org.el.querySelector("[data-o=ms_]"); if (i) i.focus(); return; } m.pct = +a.dataset.p; m.own = false; m.none = false; }
    else if (k === "msci") { m.sci = m.sci.includes(a.dataset.c) ? m.sci.filter((x) => x !== a.dataset.c) : m.sci.concat(a.dataset.c); m.none = false; m.own = false; }
    else if (k === "mf") { const f = a.dataset.f; m.song = ""; m.pct = 0; m.sci = []; m.own = f === "own"; m.none = f === "none"; }
    save(); orgRefresh(b); drawOrg();
  }
  function orgInput(e) {
    if (!org) return; const t = e.target, k = t.dataset && t.dataset.o; if (!k) return; const { b, kind } = org, m = orgGet(b, kind);
    if (k === "st" || k === "mt") m.s = t.value; else if (k === "ms_") { m.song = t.value; if (m.song) { m.own = false; m.none = false; if (!m.pct) m.pct = 100; } }
    save(); orgRefresh(b);
    const os = org.el.querySelector(".os"); if (os) { if (kind === "s") { const v = oSrc(b), info = SRC_CODES.find((x) => x[0] === v.c); os.innerHTML = `<b>${esc(v.c)}</b> · ${esc(info ? info[1] : v.c)}${v.s ? "<br>" + esc(v.s) : ""}`; } else os.innerHTML = esc(midiText(m) || "Not recorded yet (?)") + (m.s ? "<br>" + esc(m.s) : ""); }
  }
  window.addEventListener("pointerdown", (e) => { if (org && !e.target.closest(".rvorg,.rvos,.rvom")) closeOrg(); }, true);

  /* ---- inject rows ---- */
  const topHTML = () => `<span class="ad rvr rvt"><em class="rvb rvgd" data-rv="good">GOOD</em><em class="rvb rvfx" data-rv="fix">FIX</em><em class="rvb rvsk rvsq" data-rv="skull">${SKULL_I}</em><em class="rvb rvrefb rvsq" data-rv="ref" hidden>◉</em></span>`;
  const pagerHTML = () => `<span class="ad rvr rvpr"><span class="rvpg">${[1, 2, 3, 4, 5].map((n) => `<em class="rvb" data-rv="p" data-n="${n}">${n}</em>`).join("")}</span></span>`;
  const botHTML = () => `<span class="ad rvr rvbt"><em class="rvb rvcmb" data-rv="cm">COMMENT</em><span class="rvsp"></span><em class="rvb rvoffb rvsq" data-rv="off">${OFF_I}</em><em class="rvb rvdelb rvsq" data-rv="del">${TRASH_I}</em><em class="rvb rvdragb rvsq" data-a="drag">${DRAG_I}</em></span>`;
  const verHTML = () => `<span class="ad rvr rvvr"></span>`;
  function inject(b) {
    if (b.querySelector(".rvr")) return;
    if (!b.dataset.rvo) b.dataset.rvo = b.dataset.src;
    const wf = b.querySelector("canvas.wf"); if (!wf) return;
    b.insertAdjacentHTML("beforeend", topHTML() + botHTML() + pagerHTML() + verHTML() + `<span class="rvc"></span><span class="rvov"></span><span class="rvov rvphw"><i class="rvph"></i></span>`);
    const key = vKey(b), v = curV.get(key); if (v && v !== "v1") applyVer(b, v, true);
    sync(b);
  }
  function setBool(el, on) { if (el && el.classList.contains("on") !== on) el.classList.toggle("on", on); }
  function sync(b) {
    const c = ctx(b); if (!c) return; const o = rec(b);
    const old = b.querySelector(".ad:not(.rvr)"), srcOld = old && old.querySelector("i.src"), top = b.querySelector(".rvt"); if (!top) return;
    const rf = old && old.querySelector("i[data-a=ref]"), rb = b.querySelector(".rvrefb"); if (rb) { rb.hidden = !rf; if (rf) { rb.textContent = rf.textContent; } }
    setBool(b.querySelector(".rvgd"), !!(o && o.good));
    const cm = (o && o.cm) || [], n = cm.length, un = !(o && o.good) && !c.s.fix && !c.s.mark && !n && !c.s.note && !c.s.hidden;
    b.toggleAttribute("data-rvg", !!(o && o.good)); b.toggleAttribute("data-rvc", n > 0); b.toggleAttribute("data-rvu", un);
    const cmb = b.querySelector(".rvcmb"); if (cmb) cmb.classList.toggle("has", n > 0);
    // versions row
    const vs = verList(b), sel = selV(b), inuse = useV(b), vr = b.querySelector(".rvvr"), sg = oSrc(b), mg = oMidi(b), sl = sg.c, ml = midiLabel(mg), sig = JSON.stringify([vs.map((x) => x.id + x.name), sel, inuse, sl, ml]);
    if (vr && vr.dataset.sig !== sig) { vr.dataset.sig = sig;
      vr.innerHTML = vs.map((x) => `<em class="rvb rvver${x.id === sel ? " sel" : ""}${x.id === inuse ? " use" : ""}" data-rv="ver" data-v="${esc(x.id)}">${esc(x.name)}</em>`).join("") + `<em class="rvb rvvnew rvsq" data-rv="vnew">+</em><span class="rvsp"></span><em class="rvb rvos${sl === "?" ? " none" : ""}" data-rv="orgs" title="Where the sound came from">${esc(sl)}</em><em class="rvb rvom${ml === "?" ? " none" : ""}" data-rv="orgm" title="Where the MIDI came from">${esc(ml)}</em><em class="rvb rvsq" data-rv="dl">${DL_I}</em>`; }
    // comment list
    const list = b.querySelector(".rvc"), shown = cm.filter((x) => x.txt || x.id === editId), csig = JSON.stringify([shown.map((x) => [x.id, x.txt, x.t, x.x, x.v]), sel]);
    if (list && list.dataset.sig !== csig) { list.dataset.sig = csig;
      list.innerHTML = shown.slice().sort((a, z) => (a.x == null ? -1 : a.x) - (z.x == null ? -1 : z.x)).map((x) => `<span class="rvci" data-id="${esc(x.id)}"><em class="rvtm" data-rv="go">${x.x == null ? "ALL" : fmt(x.t)}</em><span class="rvtx" data-rv="edit">${esc(x.txt)}</span>${x.v && x.v !== "v1" ? `<span class="rvvt">${esc(x.v.toUpperCase())}</span>` : ""}<span class="rvxx" data-rv="rm">×</span></span>`).join(""); }
    paintMarks(b, cm, sel); paintPh(b);
  }
  function paintMarks(b, cm, sel) {
    const ov = b.querySelector(".rvov:not(.rvphw)"), cv = b.querySelector("canvas.wf"); if (!ov || !cv) return;
    const L = cv.offsetLeft, T = cv.offsetTop, W = cv.offsetWidth, Hh = cv.offsetHeight;
    const geo = [L, T, W, Hh].join(), sig = JSON.stringify([geo, cm.map((x) => [x.id, x.x, x.t, x.txt, x.v]), sel]);
    if (ov.dataset.sig === sig) return; ov.dataset.sig = sig;
    b.querySelectorAll(".rvov").forEach((o) => { o.style.cssText = `left:${L}px;top:${T}px;width:${W}px;height:${Hh}px`; });
    ov.innerHTML = cm.filter((x) => x.x != null && x.txt && (x.v || "v1") === sel).map((x) => `<span class="rvm${x.x > 0.8 ? " fl" : ""}" data-rv="mark" data-id="${esc(x.id)}" style="left:${(x.x * 100).toFixed(2)}%"><b>${fmt(x.t)}</b><i>${esc(x.txt)}</i></span>`).join("");
  }
  const syncAll = () => document.querySelectorAll(".pv button[data-pid]").forEach((b) => { inject(b); sync(b); });
  let raf = 0; const later = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; syncAll(); }); };
  new MutationObserver((ml) => { if (ml.every((m) => (m.target.closest && m.target.closest(".rvr,.rvc,.rvov,.rvpop,.rvorg")) || [...m.addedNodes, ...m.removedNodes].every((n) => n.classList && n.classList.contains("rvorg")))) return; later(); }).observe(document.body, { childList: true, subtree: true });
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
        const f = playFrac(b) != null ? playFrac(b) : pos(b); if (f != null) { st.x = f; st.t = f * dur; } else st.x = st.x == null ? 0 : null; if (st.x == null) st.t = null; else if (st.t == null) st.t = st.x * dur; paint(); inp.focus(); return; }
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


  /* ---- comment bubbles (blue, under the clip): new one opens ready to type, double-click a bubble to edit, drag its marker to move it ---- */
  let editId = null, eatT = 0;
  const release = () => { eatT = Date.now(); const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); };
  ["keypress", "keyup"].forEach((t) => window.addEventListener(t, (e) => { if (Date.now() - eatT < 600 && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); } }, true));
  const cmOf = (b, id) => { const r = rec(b); return r && r.cm.find((x) => x.id === id); };
  function newBubble(b, x) {
    const rr = rec(b, true), it = { id: uid(), x: x == null ? null : x, t: null, txt: "", v: selV(b), at: Date.now() };
    rr.cm.push(it); editId = it.id;
    durOf(b).then((d) => { if (it.x != null) it.t = it.x * d; sync(b); startEdit(b, it.id); });
  }
  function startEdit(b, id) {
    const el = b.querySelector('.rvci[data-id="' + id + '"] .rvtx'), it = cmOf(b, id); if (!el || !it) return;
    if (el.isContentEditable) return; const orig = it.txt; editId = id; el.setAttribute("contenteditable", "plaintext-only"); if (!el.isContentEditable) el.setAttribute("contenteditable", "true");
    el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
    let fin = false;
    const done = (ok) => { if (fin) return; fin = true; el.removeAttribute("contenteditable"); editId = null; release(); const v = el.textContent.replace(/\s+/g, " ").trim(), c = cmOf(b, id), rr = rec(b);
      if (c && ok && v) { c.txt = v; save(); } else if (c && (!orig || (ok && !v))) { rr.cm = rr.cm.filter((x) => x.id !== id); save(); }
      b.querySelector(".rvc").dataset.sig = ""; sync(b); };
    el.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); done(true); } else if (e.key === "Escape") { e.preventDefault(); done(false); } });
    el.addEventListener("keyup", (e) => { e.stopPropagation(); if (e.key === " ") e.preventDefault(); });   // a space inside a button would otherwise click the card (play / pause) el.addEventListener("blur", () => done(true));
  }
  window.addEventListener("dblclick", (e) => {
    if (inPv()) return; const tx = e.target.closest && e.target.closest(".rvci .rvtx"); if (!tx) return;
    e.preventDefault(); e.stopPropagation(); const b = tx.closest("button[data-pid]"); startEdit(b, tx.closest(".rvci").dataset.id);
  }, true);
  // rename inline: click the name, type, Enter (no box)
  const shortN = (n) => (String(n).split(/\s+/).length > 1 ? String(n).replace(/^\S+\s+/, "") : String(n));
  function inlineRename(b, el) {
    const c = ctx(b); if (!c || el.isContentEditable) return; const cat = String(c.s.name).split(/\s+/).length > 1 ? String(c.s.name).split(/\s+/)[0] : "", orig = shortN(c.s.name);
    el.setAttribute("contenteditable", "plaintext-only"); if (!el.isContentEditable) el.setAttribute("contenteditable", "true"); el.focus();
    const r = document.createRange(); r.selectNodeContents(el); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
    let fin = false;
    const done = (ok) => { if (fin) return; fin = true; el.removeAttribute("contenteditable"); const v = el.textContent.replace(/\s+/g, " ").trim(); if (ok && v && v !== orig) { c.s.name = (cat ? cat + " " : "") + v; save(); } el.textContent = shortN(c.s.name); release(); };
    el.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); done(true); } else if (e.key === "Escape") { e.preventDefault(); done(false); } });
    el.addEventListener("keyup", (e) => { e.stopPropagation(); if (e.key === " ") e.preventDefault(); });   // a space inside a button would otherwise click the card (play / pause) el.addEventListener("blur", () => done(true));
  }
  // drag a marker to move its comment in time
  let md = null, mdT = 0;
  window.addEventListener("pointerdown", (e) => {
    if (inPv() || e.button !== 0) return; const t = e.target; if (!t.closest) return;
    if (t.closest(".rvc")) { e.stopPropagation(); return; }
    const m = t.closest(".rvm"); if (!m) return; const b = m.closest("button[data-pid]"), cv = b.querySelector("canvas.wf"), c = cmOf(b, m.dataset.id); if (!c) return;
    e.stopPropagation(); md = { b, cv, c, el: m, sx: e.clientX, moved: false, dur: c.x ? c.t / c.x : 0 }; durOf(b).then((d) => { if (md && md.b === b && d) md.dur = d; });
  }, true);
  window.addEventListener("pointermove", (e) => {
    if (!md) return; if (!md.moved && Math.abs(e.clientX - md.sx) < 4) return; md.moved = true; e.preventDefault();
    const r = md.cv.getBoundingClientRect(), x = Math.min(0.995, Math.max(0, (e.clientX - r.left) / r.width)); md.c.x = x; md.c.t = x * (md.dur || 0);
    md.el.style.left = (x * 100).toFixed(2) + "%"; md.el.classList.toggle("fl", x > 0.8); const lb = md.el.querySelector("b"); if (lb) lb.textContent = fmt(md.c.t);
    const ch = md.b.querySelector('.rvci[data-id="' + md.c.id + '"] .rvtm'); if (ch) ch.textContent = fmt(md.c.t);
  }, true);
  const mdEnd = () => { if (!md) return; const d = md; md = null; if (d.moved) { mdT = Date.now(); save(); d.b.querySelector(".rvc").dataset.sig = ""; sync(d.b); } };
  window.addEventListener("pointerup", mdEnd, true); window.addEventListener("pointercancel", mdEnd, true);


  /* right-click (long-press on phone) a version = green = the one in use. One per sound, not always the newest. */
  function markUse(b, id) { const o = rec(b, true); if (id === "v1") delete o.inuse; else o.inuse = id; save(); const vr = b.querySelector(".rvvr"); if (vr) vr.dataset.sig = ""; sync(b); toast("In use: " + ((verList(b).find((x) => x.id === id) || {}).name || "")); }
  window.addEventListener("contextmenu", (e) => { if (inPv()) return; const a = e.target.closest && e.target.closest('[data-rv="ver"]'); if (!a) return; e.preventDefault(); e.stopPropagation(); markUse(a.closest("button[data-pid]"), a.dataset.v); }, true);
  let lpT = 0, lpHit = false;
  window.addEventListener("pointerdown", (e) => { if (inPv() || e.pointerType === "mouse") return; const a = e.target.closest && e.target.closest('[data-rv="ver"]'); if (!a) return; lpHit = false; clearTimeout(lpT); lpT = setTimeout(() => { lpHit = true; markUse(a.closest("button[data-pid]"), a.dataset.v); }, 450); }, true);
  ["pointerup", "pointercancel"].forEach((t) => window.addEventListener(t, () => clearTimeout(lpT), true));
  window.addEventListener("click", (e) => { if (lpHit && e.target.closest && e.target.closest('[data-rv="ver"]')) { lpHit = false; e.preventDefault(); e.stopPropagation(); } }, true);

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
    if (t.closest(".rvorg")) { e.stopPropagation(); return orgClick(e, t); }
    if (org && !t.closest(".rvos,.rvom")) closeOrg();
    if (Date.now() - mdT < 350 && t.closest(".rvm")) { e.preventDefault(); e.stopPropagation(); return; }
    const nmt = t.closest(".pv button[data-pid] .nmt"); if (nmt) { e.preventDefault(); e.stopPropagation(); inlineRename(nmt.closest("button[data-pid]"), nmt); return; }
    if (t.closest(".rvr,.rvc,.rvov") && !t.closest("[data-rv],[data-a]")) { e.preventDefault(); e.stopPropagation(); return; }
    // shift-click the waveform = comment at that spot
    const cv = t.closest && t.closest(".pv button[data-pid] canvas.wf");
    if (cv && e.shiftKey) { e.preventDefault(); e.stopPropagation(); const b = cv.closest("button[data-pid]"), r = cv.getBoundingClientRect(); newBubble(b, Math.min(0.995, Math.max(0, (e.clientX - r.left) / r.width))); return; }
    const a = t.closest("[data-rv]"); if (!a) return;
    const b = a.closest("button[data-pid]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const k = a.dataset.rv, c = ctx(b); if (!c) return;
    const after = () => setTimeout(() => { sync(b); }, 0);
    if (k === "orgs" || k === "orgm") return openOrg(b, k === "orgs" ? "s" : "m", a);
    if (k === "p") { setTier(b, +a.dataset.n); return after(); }
    if (k === "good") { const o = rec(b, true); o.good = !o.good; if (!o.good) delete o.good; if (o.good && c.s.fix) { const f = old(b, "[data-a=fix]"); if (f) f.click(); } save(); return after(); }
    if (k === "fix") { const f = old(b, "[data-a=fix]"); if (f) f.click(); const o = rec(b); if (c.s.fix && o && o.good) { delete o.good; save(); } document.querySelectorAll(".adm-note").forEach((x) => x.remove()); if (c.s.fix && !(o && o.cm && o.cm.length) && !c.s.note) newBubble(b, null); return after(); }
    if (k === "skull") { const o = old(b, "[data-a=skull]"); if (o) o.click(); return after(); }
    if (k === "off") { const o = old(b, "[data-a=off]"); if (o) o.click(); return after(); }
    if (k === "ref") { const o = old(b, "[data-a=ref]"); if (o) o.click(); return; }
    if (k === "del") { if (!a.classList.contains("sure")) { a.classList.add("sure"); a.textContent = "REMOVE?"; setTimeout(() => { a.classList.remove("sure"); a.innerHTML = TRASH_I; }, 2500); return; }
      const o = old(b, "[data-a=del]"); if (o) { o.click(); o.click(); } return; }
    if (k === "cm") { const f = pos(b) != null ? pos(b) : (playing(b) ? segPos() : null); return newBubble(b, f != null && f > 0.015 ? f : null); }
    
    if (k === "mark" || k === "go") { const id = k === "mark" ? a.dataset.id : a.closest(".rvci").dataset.id, rr = rec(b), cm = rr && rr.cm.find((x) => x.id === id); if (!cm || cm.x == null) return;
      if (cm.v && cm.v !== "v1" && cm.v !== selV(b)) applyVer(b, cm.v); jumpTo(b, cm.x); return; }
    if (k === "edit") return;
    if (k === "rm") { const id = a.closest(".rvci").dataset.id, rr = rec(b); if (rr) { rr.cm = rr.cm.filter((x) => x.id !== id); save(); toast("Comment removed"); } return after(); }
    if (k === "ver") { applyVer(b, a.dataset.v); return; }
    if (k === "vnew") return addVersion(b);
    if (k === "use") { const o = rec(b, true), v = selV(b); if (o.inuse === v || (!o.inuse && v === "v1")) { delete o.inuse; if (v !== "v1") o.inuse = "v1"; } else o.inuse = v; if (o.inuse === "v1") delete o.inuse; save(); return after(); }
    if (k === "dl") return download(b);
  }, true);

  /* ---- big lightbox for one sound (Eman 26 Nov): press the code chip of a card in admin mode.
     Big waveform you can click to jump, play / pause, and comments with marked spots (the same comments as on the card). ---- */
  let lb = null;
  /* V3 EDITOR (Eman 27 Nov): the MIDI tab opens the sound's own TOY MACHINE V3 preset + MIDI (admin/v3/<pack>/<sound>.json.gz,
     or the saved V3 state of the version you are on). SAVE renders it and adds it as a new version (V2, V3...), carrying
     { v3: { preset (uploaded .json.gz), notes, bpm } } so the next edit starts from it. Edits that were not saved keep the
     box open on the first close (a second close throws them away). V3_EDIT = false = the old V1 lab with saved notes. */
  const V3_EDIT = true;
  const lbDirty = (L) => !!(L && L.v3 && L.v3.dirty && !L.v3.saving);
  function lbClose(force) { if (!lb) return;
    if (!force && lbDirty(lb)) { if (!lb.v3.warned) { lb.v3.warned = true; toast("Not saved · press SAVE, or close again to throw it away"); const st = lb.el.querySelector(".lbst"); if (st) st.classList.add("dirty"); return; } } if (lb.mw) removeEventListener("message", lb.mw); if (lb.v3 && lb.v3.poll) clearInterval(lb.v3.poll); try { lb.au.pause(); } catch (e) {} cancelAnimationFrame(lb.raf); lb.el.remove(); lb = null; }
  const v3Sig = (p) => { try { return JSON.stringify(p.data && p.data.settings ? Object.assign({}, p.data.settings, { wavetables: 0, sample: 0 }) : p) + "|" + JSON.stringify((p.data && p.data.settings && p.data.settings.wavetables) || "").length; } catch (e) { return ""; } };
  async function readJson(u) {   // plain JSON or gzip bytes (the .json.gz files), whatever the server sends
    const r = await fetch(u); if (!r.ok) throw new Error(r.status); const a = new Uint8Array(await r.arrayBuffer());
    if (a[0] === 0x1f && a[1] === 0x8b) return JSON.parse(await new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
    return JSON.parse(new TextDecoder().decode(a));
  }
  const gzBlob = async (o) => new Response(new Blob([JSON.stringify(o)]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
  const v3Cache = new Map();
  const v3Slug = (f) => String(kOf(f)).split("/").pop().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");   // same as v3_build_pack.py slug_of
  const v3Blobs = new Map();   // shared wavetables / samples: admin/v3/_b/<hash>.json.gz, written as { "$b": hash } in the sound files
  const v3Blob = (h) => { if (!v3Blobs.has(h)) v3Blobs.set(h, readJson("/admin/v3/_b/" + h + ".json.gz").catch((e) => { v3Blobs.delete(h); throw e; })); return v3Blobs.get(h); };
  async function v3Unslim(d) {
    const st = d && d.preset && d.preset.data && d.preset.data.settings; if (!st) return d;
    if (Array.isArray(st.wavetables)) st.wavetables = await Promise.all(st.wavetables.map((w) => (w && w.$b ? v3Blob(w.$b) : w)));
    if (st.sample && st.sample.$b) st.sample = await v3Blob(st.sample.$b);
    return JSON.parse(JSON.stringify(d));   // own copy: blobs are shared between sounds
  }
  async function v3Source(b, v) {   // { bpm, key, notes, preset, from } for this version, or null (no V3 preset for this sound yet)
    const c = ctx(b); if (!c) return null;
    const own = v && v.v3, dir = "/admin/v3/" + c.p.id + "/";
    const get = async (slug) => { const bu = dir + slug + ".json.gz"; if (!v3Cache.has(bu)) { try { v3Cache.set(bu, await v3Unslim(await readJson(bu))); } catch (e) { v3Cache.set(bu, null); } } return v3Cache.get(bu); };
    let base = await get(v3Slug(c.s.file));
    if (!base) {   // the sound's file changed since the pack was built: find it by name in the pack's index
      try { const ix = v3Cache.has(dir) ? v3Cache.get(dir) : await readJson(dir + "index.json"); v3Cache.set(dir, ix); const nm = String(c.s.name || "").toLowerCase();
        const hit = ix && Object.keys(ix).find((k) => (ix[k].names || []).some((x) => String(x).toLowerCase() === nm)); if (hit) base = await get(hit); } catch (e) { v3Cache.set(dir, null); }
    }
    if (own && own.preset) { try { const pr = await readJson(new URL(own.preset, location.href).href); return { bpm: own.bpm || (base && base.bpm), key: own.key || (base && base.key) || "", notes: own.notes || [], preset: pr, from: v.name }; } catch (e) { toast("That version's V3 sound did not load, opening the original"); } }
    return base ? Object.assign({ from: "" }, base) : null;
  }
  function wavOf(chs, sr) {   // 16-bit stereo WAV
    const n = chs[0].length, view = new DataView(new ArrayBuffer(44 + n * 4)), str = (o, t) => { for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i)); };
    str(0, "RIFF"); view.setUint32(4, 36 + n * 4, true); str(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
    view.setUint32(24, sr, true); view.setUint32(28, sr * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, n * 4, true);
    const L = chs[0], R = chs[1] || chs[0]; let o = 44; for (let i = 0; i < n; i++) { view.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); view.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true); o += 4; }
    return new Blob([view], { type: "audio/wav" });
  }
  const rmsOf = (chs) => { let s = 0, n = 0; for (const ch of chs) for (let i = 0; i < ch.length; i++) { s += ch[i] * ch[i]; n++; } return Math.sqrt(s / Math.max(1, n)); };
  async function upload(blob, name) {
    const r = await fetch("/api/admin/upload?name=" + encodeURIComponent(name), { method: "POST", headers: { "content-type": blob.type || "application/octet-stream" }, body: blob }).catch(() => null);
    const d = r && (await r.json().catch(() => ({}))); if (!d || !d.ok) throw new Error("upload failed"); return d.url;
  }
  async function v3Save(L) {   // render what is in the editor, match the loudness of the version it came from, upload, add it as the next version
    if (!L || !L.v3 || L.v3.saving || !L.v3.init) return; const b = L.b, el = L.el, sv = el.querySelector(".lbsave"), st = el.querySelector(".lbst");
    const say = (t, bad) => { if (st) { st.textContent = t; st.classList.toggle("dirty", !!bad); } };
    L.v3.saving = true; if (sv) sv.classList.add("busy");
    try {
      const w = L.v3.f.contentWindow; say("RENDERING…");
      const state = await w.__ktState(), r = await w.__ktRender(2);
      const ac = new (window.AudioContext || window.webkitAudioContext)(), dec = await ac.decodeAudioData(await r.wav.arrayBuffer()); ac.close && ac.close();
      const chs = [dec.getChannelData(0), dec.numberOfChannels > 1 ? dec.getChannelData(1) : dec.getChannelData(0)].map((x) => Float32Array.from(x));
      let g = 1; const ref = L.refRms || 0, now = rmsOf(chs), pk = Math.max(...chs.map((ch) => ch.reduce((m, x) => Math.max(m, Math.abs(x)), 0)));
      if (now > 1e-6) g = ref > 1e-6 ? ref / now : 0.25 / now;   // same loudness as the sound it replaces
      if (pk * g > 0.97) g = 0.97 / pk;
      for (const ch of chs) for (let i = 0; i < ch.length; i++) ch[i] *= g;
      const c = ctx(b), base = String(kOf(c.s.file)).split("/").pop().replace(/\.[a-z0-9]+$/i, ""), n = verList(b).length + 1;
      say("UPLOADING…");
      const fileUrl = await upload(wavOf(chs, dec.sampleRate), base + "-v" + n + ".wav");
      const presetUrl = state.preset ? await upload(await gzBlob(state.preset), base + "-v" + n + "-v3.json.gz") : null;
      const o = rec(b, true), id = "v" + n + "-" + uid();
      o.vers.push({ id, name: "V" + n, file: fileUrl, at: Date.now(), v3: { preset: presetUrl, notes: state.notes, bpm: state.bpm, key: (L.v3.init && L.v3.init.key) || "", from: selV(b) } });
      save(); L.v3.dirty = false; L.v3.saving = false;
      applyVer(b, id); sync(b); toast("Saved as V" + n + " · TOY MACHINE V3");
      lbOpen(b);   // reopen on the new version: its waveform, ready to play and comment
    } catch (e) { L.v3.saving = false; if (sv) sv.classList.remove("busy"); say("NOT SAVED · " + (e && e.message || e), true); }
  }
  async function lbOpen(b) {
    lbClose(true); try { if (typeof audio !== "undefined") audio.pause(); } catch (e) {}
    const c = ctx(b); if (!c) return;
    const v = verList(b).find((x) => x.id === selV(b)) || verList(b)[0], sp = spr(v.file), url = new URL(sp.u, location.href).href;
    const chip = (b.querySelector(".ck-chip") || {}).textContent || "";
    const el = document.createElement("div"); el.className = "rvlb";
    el.innerHTML = `<div class="lbx"><div class="lbh"><b class="lbc">${esc(chip)}</b><span class="lbn">${esc(c.s.name || "")}</span><span class="lbv">${esc(v.name)}</span><span class="rvsp"></span><em class="rvb rvsq" data-lb="x">&times;</em></div>
      <div class="lbtabs"><em class="rvb lbtab on" data-lb="tab" data-tab="wave">WAVEFORM + COMMENTS</em><em class="rvb lbtab" data-lb="tab" data-tab="midi">${V3_EDIT ? "MIDI + TOY MACHINE V3" : "MIDI · TOY MACHINE V1"}</em></div>
      <div class="lbpane" data-pane="wave"><div class="lbw"><canvas></canvas><div class="lbov"></div><i class="lbph"></i></div>
      <div class="lbt"><em class="rvb lbpl" data-lb="play">PLAY</em><span class="lbtm">0:00.0 / 0:00.0</span><span class="rvsp"></span><em class="rvb lbad" data-lb="add">+ COMMENT AT PLAYHEAD</em></div>
      <div class="lbl"></div></div>
      <div class="lbpane lbmidi" data-pane="midi" hidden></div></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("canvas"), au = new Audio(url); au.preload = "auto";
    lb = { el, b, au, dur: 0, a: sp.a || 0, peaks: null, raf: 0 };
    const L = lb;
    const frac = () => (L.dur ? Math.min(1, Math.max(0, (au.currentTime - L.a) / L.dur)) : 0);
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1; if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const f = frac(), mid = h / 2;
      g.fillStyle = "rgba(236,235,240,.12)"; g.fillRect(0, mid, w, 1);
      if (!L.peaks) return;
      const n = Math.min(w, L.peaks.length / 2) | 0;
      for (let x = 0; x < n; x++) { const mn = L.peaks[x * 2], mx = L.peaks[x * 2 + 1]; g.fillStyle = x / n <= f ? "#8b6cf6" : "#ecebf0"; g.fillRect(x, mid - mx * mid * 0.95, 1, Math.max(1, (mx - mn) * mid * 0.95)); }
    };
    const peaksFor = (buf, n) => {
      const ch = buf.getChannelData(0), ch2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null, sr = buf.sampleRate, s0 = Math.floor(L.a * sr), s1 = Math.min(ch.length, Math.floor((L.a + L.dur) * sr)), per = Math.max(1, (s1 - s0) / n), out = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { let mn = 1, mx = -1; const a0 = s0 + Math.floor(i * per), a1 = Math.min(s1, s0 + Math.floor((i + 1) * per)); for (let k = a0; k < a1; k++) { const s = ch2 ? (ch[k] + ch2[k]) / 2 : ch[k]; if (s < mn) mn = s; if (s > mx) mx = s; } if (mn > mx) { mn = 0; mx = 0; } out[i * 2] = mn; out[i * 2 + 1] = mx; }
      return out;
    };
    const cmList = () => { const o = rec(b); return o ? o.cm.filter((x) => (x.v || "v1") === selV(b)) : []; };
    const marks = () => {
      const ov = el.querySelector(".lbov"), ls = el.querySelector(".lbl"), cms = cmList();
      ov.innerHTML = cms.filter((x) => x.x != null && x.txt).map((x) => `<span class="lbm" data-lb="mark" data-id="${esc(x.id)}" style="left:${(x.x * 100).toFixed(2)}%" title="${esc(x.txt)}"><b>${fmt(x.t)}</b></span>`).join("");
      ls.innerHTML = cms.slice().sort((p, q) => (p.x == null ? -1 : p.x) - (q.x == null ? -1 : q.x)).map((x) => `<span class="lbci" data-id="${esc(x.id)}"><em class="rvb lbtmb" data-lb="go">${x.x == null ? "ALL" : fmt(x.t)}</em><input value="${esc(x.txt)}" maxlength="400" placeholder="Comment"><em class="rvb rvsq" data-lb="rm">&times;</em></span>`).join("");
    };
    const tick = () => {
      const f = frac(); el.querySelector(".lbph").style.left = (f * 100).toFixed(3) + "%";
      el.querySelector(".lbtm").textContent = fmt(f * L.dur) + " / " + fmt(L.dur);
      el.querySelector(".lbpl").textContent = au.paused ? "PLAY" : "PAUSE";
      if (L.dur && sp.b != null && au.currentTime >= sp.b) { au.pause(); au.currentTime = L.a; }
      draw(); L.raf = requestAnimationFrame(tick);
    };
    const seek = (f) => { au.currentTime = L.a + Math.min(0.999, Math.max(0, f)) * L.dur; };
    const addAt = (f) => { const rr = rec(b, true), it = { id: uid(), x: f, t: f == null ? null : f * L.dur, txt: "", v: selV(b), at: Date.now() }; rr.cm.push(it); marks(); const inp = el.querySelector('.lbci[data-id="' + it.id + '"] input'); if (inp) inp.focus(); };
    const commit = (id, txt) => { const rr = rec(b), it = rr && rr.cm.find((x) => x.id === id); if (!it) return; txt = txt.trim(); if (!txt) rr.cm = rr.cm.filter((x) => x.id !== id); else it.txt = txt; save(); b.querySelector(".rvc") && (b.querySelector(".rvc").dataset.sig = ""); sync(b); marks(); };
    L.close = lbClose;
    const tab = (n) => {
      el.querySelectorAll(".lbtab").forEach((x) => x.classList.toggle("on", x.dataset.tab === n));
      el.querySelectorAll(".lbpane").forEach((x) => (x.hidden = x.dataset.pane !== n));
      if (n === "wave") return; try { au.pause(); } catch (e) {}
      const host = el.querySelector(".lbmidi"); if (host.firstChild) return;
      const m = /(\d{2,3})\s*[·.,]\s*([A-G][#b]?m?)/.exec(c.s.meta || "") || [], o = rec(b);
      const f = document.createElement("iframe"); f.src = "/admin/kt/lab.html?go=1"; f.allow = "autoplay; midi"; host.appendChild(f);
      const legacy = (o && (Array.isArray(o.midi) ? o.midi : o.notes)) || [];
      if (!V3_EDIT) host.insertAdjacentHTML("beforeend", '<p class="lbmn">Plays through TOY MACHINE V1 on a neutral Init patch (pick any sound in the VST tab). Your notes are saved with this sound.</p>');
      else host.insertAdjacentHTML("beforeend", '<div class="lbsv"><em class="rvb lbsave busy" data-lb="v3save">SAVE AS NEW VERSION</em><span class="lbst">LOADING…</span><span class="lbpn"></span></div>');
      const src = V3_EDIT ? v3Source(b, v) : Promise.resolve(null);
      L.v3 = { f, init: null, dirty: false };
      L.mw = (e) => { const d = e.data; if (!d || e.source !== f.contentWindow) return;
        if (d.kt === "hello" && !L.v3.sent) { L.v3.sent = true; src.then((S) => {
          const init = S ? { kt: "init", bpm: S.bpm || m[1] || 120, key: S.key || m[2] || "", notes: S.notes || [], preset: S.preset || null }
                         : { kt: "init", bpm: m[1] || 120, key: m[2] || "", notes: legacy };
          L.v3.init = init; L.v3.src = S; f.contentWindow.postMessage(init, "*");
          const pn = host.querySelector(".lbpn"); if (pn) pn.textContent = S && S.preset ? "THE PRESET · " + (S.preset.name || "") + (S.from ? " · " + S.from : "") : "NO V3 PRESET YET · INIT";
        }); }
        if (d.kt === "ready") { const sv = host.querySelector(".lbsave"), st = host.querySelector(".lbst"); if (sv) sv.classList.remove("busy"); if (st) st.textContent = "READY"; L.v3.base = JSON.stringify(d.notes || (L.v3.init && L.v3.init.notes) || []); }
        if (d.kt === "error") { const st = host.querySelector(".lbst"); if (st) { st.textContent = "DID NOT LOAD · " + (d.msg || ""); st.classList.add("dirty"); } }
        if (d.kt === "notes") { if (!V3_EDIT) { const rr = rec(b, true); rr.notes = d.notes; save(); return; }
          L.v3.dirty = JSON.stringify(d.notes) !== JSON.stringify((L.v3.init && L.v3.init.notes) || []) || L.v3.dirty; const st = host.querySelector(".lbst"); if (st && L.v3.dirty) st.textContent = "EDITED · NOT SAVED"; } };
      addEventListener("message", L.mw);
      if (V3_EDIT) L.v3.poll = setInterval(async () => {   // sound edits (VST tab) count as edits too
        if (lb !== L) return clearInterval(L.v3.poll); if (L.v3.dirty || !L.v3.init || L.v3.saving) return;
        try { const s2 = await f.contentWindow.__ktState(); if (s2 && s2.preset && L.v3.init.preset && v3Sig(s2.preset) !== v3Sig(L.v3.init.preset)) { L.v3.dirty = true; const st = host.querySelector(".lbst"); if (st) st.textContent = "EDITED · NOT SAVED"; } } catch (e) { /* not ready */ }
      }, 1500);
    };
    el.addEventListener("click", (e) => {
      const t = e.target.closest("[data-lb]"); if (e.target === el) return lbClose();
      const w = e.target.closest(".lbw");
      if (!t && w && !e.target.closest(".lbm")) { const r = cv.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); if (au.paused) au.play().catch(() => {}); return; }
      if (!t) return; const k = t.dataset.lb;
      if (k === "x") return lbClose();
      if (k === "v3save") return v3Save(L);
      if (k === "tab") return tab(t.dataset.tab);
      if (k === "play") { if (au.paused) { if (frac() >= 0.995) seek(0); au.play().catch(() => {}); } else au.pause(); return; }
      if (k === "add") return addAt(L.dur ? frac() : null);
      if (k === "mark" || k === "go") { const id = k === "mark" ? t.dataset.id : t.closest(".lbci").dataset.id, it = cmList().find((x) => x.id === id); if (it && it.x != null) { seek(it.x); if (au.paused) au.play().catch(() => {}); } return; }
      if (k === "rm") { const id = t.closest(".lbci").dataset.id, rr = rec(b); if (rr) { rr.cm = rr.cm.filter((x) => x.id !== id); save(); sync(b); marks(); } }
    });
    el.addEventListener("keydown", (e) => { e.stopPropagation(); const i = e.target.closest && e.target.closest(".lbci input"); if (i) { if (e.key === "Enter") { e.preventDefault(); i.blur(); } else if (e.key === "Escape") { e.preventDefault(); i.value = i.defaultValue; i.blur(); } return; }
      if (e.key === "Escape") lbClose(); else if (e.code === "Space") { e.preventDefault(); el.querySelector(".lbpl").click(); } });
    el.addEventListener("keyup", (e) => { e.stopPropagation(); if (e.code === "Space") e.preventDefault(); });
    el.addEventListener("focusout", (e) => { const i = e.target.closest && e.target.closest(".lbci input"); if (i && lb === L) commit(i.closest(".lbci").dataset.id, i.value); });
    marks(); L.raf = requestAnimationFrame(tick); el.tabIndex = -1; el.focus();
    try { const buf = await (await fetch(url)).arrayBuffer(), ac = new (window.AudioContext || window.webkitAudioContext)(), dec = await ac.decodeAudioData(buf); ac.close && ac.close();
      if (lb !== L) return; L.dur = sp.b != null ? sp.b - L.a : dec.duration; try { const sr = dec.sampleRate, i0 = Math.floor(L.a * sr), i1 = Math.min(dec.length, Math.floor((L.a + L.dur) * sr)); L.refRms = rmsOf([...Array(dec.numberOfChannels)].map((_, k) => dec.getChannelData(k).subarray(i0, i1))); } catch (e) {} L.peaks = peaksFor(dec, Math.max(300, Math.round(cv.clientWidth * (devicePixelRatio || 1) / (devicePixelRatio || 1)))); marks();
    } catch (e) { if (lb === L) { L.dur = L.dur || 0; } }
  }
  window.addEventListener("click", (e) => {
    if (inPv() || !e.target.closest) return; const ch = e.target.closest(".pv button[data-pid] .ck-chip"); if (!ch) return;
    e.preventDefault(); e.stopPropagation(); lbOpen(ch.closest("button[data-pid]"));
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
