// KILLTOY 2: the stem pick box. Every "Split into stems" opens it first: pick VOCALS / DRUMS /
// BASS / MUSIC, open one (the arrow) to pick its parts, see the rough wait, press SPLIT.
// It wraps the global run(): splitStems without `pick` opens the box; SPLIT calls run again with
// { clipId, pick }. pick = { vocals: [..], drums: [..], bass: ["bass"], music: [..] }, each list the
// parts asked for ([] = that stem not wanted; the stem's own name = the whole stem, not split up).
// Parts inside a stem only show when their model is on the page (StemSplitRof.hasDetail(kind)).
// KT2_STEMPICK_OFF = the old way (split straight away, all stems).
"use strict";

(function () {
  if (window.KT2_STEMPICK_OFF) return;
  const GROUPS = [
    { id: "vocals", name: "VOCALS", parts: [["lead", "LEAD"], ["backing", "BACKING / ADLIBS"]], detail: "vocals" },
    { id: "drums", name: "DRUMS", parts: [["kick", "KICK"], ["snare", "SNARE"], ["hh", "HATS"], ["toms", "TOMS"], ["cymbals", "CYMBALS"]], detail: "drums" },
    { id: "bass", name: "BASS", parts: [] },
    { id: "music", name: "MUSIC", parts: [["guitar", "GUITAR"], ["piano", "PIANO"], ["other", "SYNTHS / TEXTURE"]], detail: "music" },
  ];
  const KEY = "kt2.stempick";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* fine */ } };

  function css() {
    if (document.getElementById("k2sp-css")) return;
    const s = document.createElement("style"); s.id = "k2sp-css";
    s.textContent = `
.k2sp-back{position:fixed;inset:0;z-index:9000;background:rgba(10,10,12,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center}
.k2sp{width:min(440px,calc(100vw - 32px));background:#232326;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 60px rgba(0,0,0,.55);color:var(--k2-ink,#ecebf2);font:500 12px var(--font,Inter,sans-serif)}
.k2sp-h{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07);letter-spacing:.14em;font-size:11px;color:var(--k2-ink2,#a9a5b6)}
.k2sp-h b{color:var(--k2-ink,#ecebf2);font-weight:600;letter-spacing:.04em;font-size:13px;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.k2sp-x{background:none;border:0;color:var(--k2-ink2,#a9a5b6);font-size:18px;line-height:1;cursor:pointer;padding:0 2px}
.k2sp-list{display:flex;flex-direction:column}
.k2sp-row{border-bottom:1px solid rgba(255,255,255,.05)}
.k2sp-main{display:flex;align-items:stretch;height:48px}
.k2sp-tog{flex:1;display:flex;align-items:center;gap:12px;padding:0 16px;background:none;border:0;color:var(--k2-ink2,#a9a5b6);font:600 12px var(--font,Inter,sans-serif);letter-spacing:.16em;cursor:pointer;text-align:left}
.k2sp-tog i{width:14px;height:14px;border:1.5px solid currentColor;flex:none;position:relative}
.k2sp-row.on .k2sp-tog{color:var(--k2-ink,#ecebf2)}
.k2sp-row.on .k2sp-tog i{background:var(--k2-sel,#7c5cf0);border-color:var(--k2-sel,#7c5cf0)}
.k2sp-row.on .k2sp-tog i::after{content:"";position:absolute;left:3.5px;top:0.5px;width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.k2sp-tog small{margin-left:auto;font:500 10px var(--font,Inter,sans-serif);letter-spacing:.12em;color:var(--k2-ink3,#6f6b7c)}
.k2sp-open{width:48px;background:none;border:0;border-left:1px solid rgba(255,255,255,.05);color:var(--k2-ink2,#a9a5b6);cursor:pointer;font-size:12px;transition:transform .15s}
.k2sp-row.open .k2sp-open span{display:inline-block;transform:rotate(90deg)}
.k2sp-parts{display:none;flex-wrap:wrap;gap:6px;padding:0 16px 14px 42px}
.k2sp-row.open .k2sp-parts{display:flex}
.k2sp-chip{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--k2-ink2,#a9a5b6);font:600 10px var(--font,Inter,sans-serif);letter-spacing:.12em;padding:7px 10px;cursor:pointer}
.k2sp-chip.on{border-color:var(--k2-sel,#7c5cf0);color:var(--k2-ink,#ecebf2);background:rgba(124,92,240,.22)}
.k2sp-f{display:flex;align-items:center;justify-content:space-between;padding:14px 16px}
.k2sp-t{font:500 11px var(--font,Inter,sans-serif);letter-spacing:.12em;color:var(--k2-ink2,#a9a5b6)}
.k2sp-go{background:var(--k2-sel,#7c5cf0);border:0;color:#fff;font:700 12px var(--font,Inter,sans-serif);letter-spacing:.18em;padding:11px 22px;cursor:pointer}
.k2sp-go:disabled{opacity:.35;cursor:default}
.k2sp button:focus-visible{outline:2px solid var(--k2-sel,#7c5cf0);outline-offset:-2px}
@media (prefers-reduced-motion:reduce){.k2sp-open{transition:none}}`;
    document.head.appendChild(s);
  }

  function clipOf(id) {
    try { const st = typeof ui !== "undefined" && ui && ui.state; for (const t of (st && st.tracks) || []) for (const c of t.clips || []) if (c.id === id) return c; } catch (e) { /* fine */ }
    return null;
  }

  // shows the box; resolves with the pick, or null when closed
  async function ask(clip) {
    css();
    const R = window.StemSplitRof;
    const rof = !!(R && await R.available().catch(() => false));
    const hasDetail = (g) => g.detail === "music" ? rof : !!(rof && R.hasDetail && R.hasDetail(g.detail));
    const prev = load() || {};
    const st = {}; for (const g of GROUPS) {
      const p = prev[g.id];
      st[g.id] = { on: p ? !!p.on : true, open: !!(p && p.open && hasDetail(g)), parts: new Set((p && p.parts) || g.parts.map((x) => x[0])) };
    }
    const seconds = (clip && clip.length) || 180;
    return new Promise((resolve) => {
      const back = document.createElement("div"); back.className = "k2sp-back";
      const box = document.createElement("div"); box.className = "k2sp"; box.setAttribute("role", "dialog"); back.append(box);
      const head = document.createElement("div"); head.className = "k2sp-h";
      head.innerHTML = `<span>SPLIT</span><b></b><button class="k2sp-x" aria-label="Close">&times;</button>`;
      head.querySelector("b").textContent = (clip && clip.name) || "";
      const list = document.createElement("div"); list.className = "k2sp-list";
      const foot = document.createElement("div"); foot.className = "k2sp-f";
      const time = document.createElement("span"); time.className = "k2sp-t";
      const go = document.createElement("button"); go.className = "k2sp-go"; go.textContent = "SPLIT";
      foot.append(time, go); box.append(head, list, foot);
      const update = () => {
        const n = GROUPS.filter((g) => st[g.id].on).reduce((k, g) => k + (g.id === "music" && st.music.open ? st.music.parts.size : 1), 0);
        go.disabled = n === 0;
        let min = R && R.estimate ? R.estimate(seconds, Math.min(6, Math.max(1, n))) : 0;
        for (const g of GROUPS) if (g.detail !== "music" && st[g.id].on && st[g.id].open && hasDetail(g) && R.estimateDetail) min += R.estimateDetail(g.detail, seconds);
        time.textContent = min ? `~${min} MIN` : "";
        if (!rof) time.textContent = "";
      };
      for (const g of GROUPS) {
        const s = st[g.id], row = document.createElement("div"); row.className = "k2sp-row";
        const main = document.createElement("div"); main.className = "k2sp-main";
        const tog = document.createElement("button"); tog.className = "k2sp-tog"; tog.innerHTML = `<i></i>${g.name}<small></small>`;
        main.append(tog);
        const parts = document.createElement("div"); parts.className = "k2sp-parts";
        const sync = () => {
          row.classList.toggle("on", s.on); row.classList.toggle("open", s.open);
          tog.querySelector("small").textContent = s.open && s.on ? `${s.parts.size} PARTS` : "";
          parts.querySelectorAll(".k2sp-chip").forEach((c) => c.classList.toggle("on", s.parts.has(c.dataset.p)));
          update();
        };
        tog.onclick = () => { s.on = !s.on; sync(); };
        if (g.parts.length && hasDetail(g)) {
          const op = document.createElement("button"); op.className = "k2sp-open"; op.setAttribute("aria-label", "Pick parts"); op.innerHTML = "<span>&#9656;</span>";
          op.onclick = () => { s.open = !s.open; if (s.open) s.on = true; sync(); };
          main.append(op);
          for (const [p, label] of g.parts) {
            const c = document.createElement("button"); c.className = "k2sp-chip"; c.dataset.p = p; c.textContent = label;
            c.onclick = () => { if (s.parts.has(p)) { if (s.parts.size > 1) s.parts.delete(p); } else s.parts.add(p); sync(); };
            parts.append(c);
          }
        }
        row.append(main, parts); list.append(row); sync();
      }
      const close = (v) => {
        back.remove(); document.removeEventListener("keydown", key, true);
        if (v) save(Object.fromEntries(GROUPS.map((g) => [g.id, { on: st[g.id].on, open: st[g.id].open, parts: [...st[g.id].parts] }])));
        resolve(v);
      };
      const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(null); } else if (e.key === "Enter" && !go.disabled) { e.preventDefault(); e.stopPropagation(); go.click(); } };
      document.addEventListener("keydown", key, true);
      back.onclick = (e) => { if (e.target === back) close(null); };
      head.querySelector(".k2sp-x").onclick = () => close(null);
      go.onclick = () => {
        const pick = {};
        for (const g of GROUPS) {
          const s = st[g.id];
          pick[g.id] = !s.on ? [] : (s.open && g.parts.length ? [...s.parts] : [g.id]);
        }
        close(pick);
      };
      document.body.append(back); go.focus();
    });
  }

  function wrap() {
    if (typeof run !== "function" || run._stempick) return;
    const inner = run;
    const wrapped = async function (cmd, args) {
      if (cmd === "splitStems" && args && args.clipId && !args.pick) {
        const pick = await ask(clipOf(args.clipId));
        if (!pick) return { ok: false, cancelled: true };
        return wrapped.call(this, cmd, { ...args, pick });
      }
      return inner.apply(this, arguments);
    };
    wrapped._stempick = true;
    for (const k of Object.keys(inner)) wrapped[k] = inner[k];
    window.run = run = wrapped;   // eslint-disable-line no-global-assign
  }
  // after kt2-juice.js has wrapped run (it does so on DOMContentLoaded + 0 ms), so the box shows first
  const init = () => setTimeout(wrap, 50);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.KT2StemPick = { ask };
})();
