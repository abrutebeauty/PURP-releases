// KILLTOY 2: the stem pick box. Every "Split into stems" opens it first: pick VOCALS / DRUMS /
// BASS / MUSIC, open one (the arrow) to pick its parts, see the rough wait, press SPLIT.
// It wraps the global run(): splitStems without `pick` opens the box; SPLIT calls run again with
// { clipId, pick }. pick = { vocals: [..], drums: [..], bass: ["bass"], music: [..] }, each list the
// parts asked for ([] = that stem not wanted; the stem's own name = the whole stem, not split up).
// Parts inside a stem only show when their model is on the page (StemSplitRof.hasDetail(kind)).
// KT2_STEMPICK_OFF = the old way (split straight away, all stems).
// 10 Nov (Eman): MUSIC is called INSTRUMENTS (everything that isn't vocals, drums or bass: the RoFormer's
// guitar + piano + other, summed). Each row's parts are opt-in: opening the arrow shows what is picked
// now ("ALL VOCALS" lit) and changes nothing. Picking a part turns "ALL" off and only the picked parts
// are made (LEAD alone = no backing lane); taking the last part off goes back to ALL. The row says what
// it will make ("LEAD ONLY", "2 PARTS") even when closed. KT2_STEMPICK_OLD = the box before this.
// 11 Nov (Eman): FAST | QUALITY in the footer, next to the wait. Both are the BS-RoFormer: FAST runs each
// part of the song once (about 2.3x quicker; Lowkey + Babymoma tests: stems 20-34 dB alike), QUALITY twice
// and blends them (cleanest). FAST is the default; the last choice is remembered. Sent as pick.mode
// ("fast" | "medium" | "quality"). KT2_SPLIT_MODE_OFF = no switch (RoFormer as before).
// MEDIUM (Eman 11 Nov, "for now add as a medium option") = Mini-BS-RoFormer V2.5: four stems, quicker
// than FAST but leaves more vocal in the instruments on some songs. Only shown when its model is on the
// page; picking guitar/piano on their own makes it run as FAST. KT2_SPLIT_MEDIUM_OFF = no MEDIUM.
// The bolt next to it (web only, not in the desktop app) opens a line saying the desktop app splits
// 3-5x faster (Eman, 11 Nov). KT2_SPLIT_DESKTOP_OFF = no bolt.
"use strict";

(function () {
  if (window.KT2_STEMPICK_OFF) return;
  const GROUPS = [
    { id: "vocals", name: "VOCALS", parts: [["lead", "LEAD"], ["backing", "BACKING / ADLIBS"]], detail: "vocals" },
    { id: "drums", name: "DRUMS", parts: [["kick", "KICK"], ["snare", "SNARE"], ["hh", "HATS"], ["toms", "TOMS"], ["cymbals", "CYMBALS"]], detail: "drums" },
    { id: "bass", name: "BASS", parts: [] },
    { id: "music", name: "MUSIC", parts: [["guitar", "GUITAR"], ["piano", "PIANO"], ["other", "SYNTHS / TEXTURE"]], detail: "music" },
  ];
  const NEW = () => !window.KT2_STEMPICK_OLD;
  if (NEW()) { GROUPS[3].name = "INSTRUMENTS"; GROUPS[3].parts[2][1] = "SYNTHS / OTHER"; }
  const KEY = NEW() ? "kt2.stempick2" : "kt2.stempick";
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
.k2sp-l{display:flex;align-items:center;gap:12px}
.k2sp-m{display:flex;border:1px solid rgba(255,255,255,.1)}
.k2sp-mb{background:none;border:0;color:var(--k2-ink3,#6f6b7c);font:600 10px var(--font,Inter,sans-serif);letter-spacing:.14em;padding:8px 10px;cursor:pointer}
.k2sp-mb.on{background:var(--k2-sel,#7c5cf0);color:#fff}
.k2sp-bolt{background:none;border:1px solid rgba(255,255,255,.1);width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--k2-ink2,#a9a5b6);padding:0}
.k2sp-bolt:hover,.k2sp-bolt.on{color:#E4FF3A;border-color:#E4FF3A}
.k2sp-bolt svg{width:13px;height:13px;fill:currentColor}
.k2sp-desk{display:none;padding:0 16px 14px;font:600 10px var(--font,Inter,sans-serif);letter-spacing:.14em;color:#E4FF3A}
.k2sp-desk.on{display:block}
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
      st[g.id] = NEW()
        ? { on: p ? !!p.on : true, open: false, parts: new Set(((p && p.parts) || []).filter((x) => hasDetail(g) && g.parts.some((q) => q[0] === x))) }
        : { on: p ? !!p.on : true, open: !!(p && p.open && hasDetail(g)), parts: new Set((p && p.parts) || g.parts.map((x) => x[0])) };
    }
    const seconds = (clip && clip.length) || 180;
    const twoModes = NEW() && rof && !window.KT2_SPLIT_MODE_OFF;
    const medium = twoModes && !window.KT2_SPLIT_MEDIUM_OFF && !!(R.hasMini && R.hasMini());
    const MODES = [["fast", "FAST"]].concat(medium ? [["medium", "MEDIUM"]] : [], [["quality", "QUALITY"]]);
    let mode = "fast"; try { const v = localStorage.getItem("kt2.splitmode"); if (MODES.some(([m]) => m === v)) mode = v; } catch (e) { /* fine */ }
    const fast = () => twoModes && (mode === "fast" || mode === "medium");
    const syncs = [];
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
      if (twoModes) {
        const left = document.createElement("div"); left.className = "k2sp-l";
        const seg = document.createElement("div"); seg.className = "k2sp-m";
        for (const [m, label] of MODES) {
          const b = document.createElement("button"); b.className = "k2sp-mb"; b.dataset.m = m; b.textContent = label;
          b.onclick = () => { mode = m; try { localStorage.setItem("kt2.splitmode", m); } catch (e) { /* fine */ } seg.querySelectorAll(".k2sp-mb").forEach((x) => x.classList.toggle("on", x.dataset.m === mode)); syncs.forEach((f) => f()); };
          seg.append(b);
        }
        seg.querySelectorAll(".k2sp-mb").forEach((x) => x.classList.toggle("on", x.dataset.m === mode));
        left.append(seg, time); foot.append(left, go);
      } else foot.append(time, go);
      box.append(head, list, foot);
      if (!window.__JUCE__ && !window.KT2_SPLIT_DESKTOP_OFF) {
        const bolt = document.createElement("button"); bolt.className = "k2sp-bolt"; bolt.setAttribute("aria-label", "Split faster");
        bolt.innerHTML = '<svg viewBox="0 0 16 16"><path d="M9.5 0 2 9h5l-1.5 7L14 6.5H9z"/></svg>';
        const desk = document.createElement("div"); desk.className = "k2sp-desk"; desk.textContent = "SPLIT 3-5\u00d7 FASTER IN THE KILLTOY DESKTOP APP";
        bolt.onclick = () => { bolt.classList.toggle("on"); desk.classList.toggle("on"); };
        const left = foot.querySelector(".k2sp-l");
        if (left) left.prepend(bolt); else { const l = document.createElement("div"); l.className = "k2sp-l"; l.append(bolt, time); foot.prepend(l); }
        box.append(desk);
      }
      const update = () => {
        if (NEW()) {
          // stems the RoFormer makes: 1 each for vocals/drums/bass, instruments = guitar+piano+other (3, or the picked ones)
          const n = GROUPS.filter((g) => st[g.id].on).reduce((k, g) => k + (g.id === "music" ? (st.music.parts.size || 3) : 1), 0);
          go.disabled = n === 0;
          let min = R && R.estimate ? R.estimate(seconds, Math.min(6, Math.max(1, n)), fast() ? 1 : 0) : 0;
          // MEDIUM = the Mini RoFormer (four stems in one go, about 0.6x the big one in one pass)
          const ps = st.music.on ? st.music.parts.size : 0;
          if (min && mode === "medium" && medium && (ps === 0 || ps === 3)) min = Math.max(1, Math.round(R.estimate(seconds, 6, 1) * 0.6));
          // parts inside vocals / drums need a second model after the split
          for (const g of GROUPS) if (g.detail !== "music" && st[g.id].on && st[g.id].parts.size && hasDetail(g) && R.estimateDetail) min += R.estimateDetail(g.detail, seconds);
          time.textContent = rof && min ? `~${min} MIN` : "";
          return;
        }
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
          if (NEW()) {
            row.classList.toggle("on", s.on); row.classList.toggle("open", s.open);
            const picked = g.parts.filter((x) => s.parts.has(x[0]));
            tog.querySelector("small").textContent = !s.on || !picked.length ? "" : picked.length === 1 ? `${picked[0][1].split(" /")[0]} ONLY` : `${picked.length} PARTS`;
            parts.querySelectorAll(".k2sp-chip").forEach((c) => c.classList.toggle("on", c.dataset.p === "*" ? !s.parts.size : s.parts.has(c.dataset.p)));
            update(); return;
          }
          row.classList.toggle("on", s.on); row.classList.toggle("open", s.open);
          tog.querySelector("small").textContent = s.open && s.on ? `${s.parts.size} PARTS` : "";
          parts.querySelectorAll(".k2sp-chip").forEach((c) => c.classList.toggle("on", s.parts.has(c.dataset.p)));
          update();
        };
        tog.onclick = () => { s.on = !s.on; sync(); };
        if (g.parts.length && hasDetail(g)) {
          const op = document.createElement("button"); op.className = "k2sp-open"; op.setAttribute("aria-label", "Pick parts"); op.innerHTML = "<span>&#9656;</span>";
          op.onclick = () => { s.open = !s.open; if (s.open && !NEW()) s.on = true; sync(); };
          main.append(op);
          if (NEW()) {
            const all = document.createElement("button"); all.className = "k2sp-chip"; all.dataset.p = "*"; all.textContent = "ALL " + g.name;
            all.onclick = () => { s.parts.clear(); s.on = true; sync(); };
            parts.append(all);
          }
          for (const [p, label] of g.parts) {
            const c = document.createElement("button"); c.className = "k2sp-chip"; c.dataset.p = p; c.textContent = label;
            c.onclick = NEW() ? () => { if (s.parts.has(p)) s.parts.delete(p); else s.parts.add(p); s.on = true; sync(); } : () => { if (s.parts.has(p)) { if (s.parts.size > 1) s.parts.delete(p); } else s.parts.add(p); sync(); };
            parts.append(c);
          }
        }
        row.append(main, parts); list.append(row); syncs.push(sync); sync();
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
          pick[g.id] = !s.on ? [] : NEW() ? (s.parts.size && hasDetail(g) ? g.parts.map((x) => x[0]).filter((x) => s.parts.has(x)) : [g.id])
            : (s.open && g.parts.length ? [...s.parts] : [g.id]);
        }
        if (twoModes) pick.mode = mode;
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
