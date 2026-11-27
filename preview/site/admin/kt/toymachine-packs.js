/* TOY MACHINE: PRESET PACKS library (Eman, 16 Nov 2026).
   The pack button next to "PRESETS  n sounds" turns the whole TOY MACHINE view into a library of
   every preset pack (the KILLTOY kits made from KILLTOY 333, then the older presets' own kits).
   Each pack folds open into its presets: press one = it loads and plays a note (the keyboard below
   stays playable), double-click = load and back to the synth.
   Every preset has a STAR (saved; the star chip shows only the starred ones, nothing jumps while you star)
   and a FIX mark (saved, so a later fix round can read the list: localStorage "tm-pack-marks" and,
   when the page has a shared database, collection "tmmarks").
   Data: toymachine-packs.json (scripts/toymachine/make_packs.py), covers tm-packs/<id>.jpg.
   KT2_TM_PACKS_OFF = no pack button (the drawer as before). Keep this file ASCII-only. */
"use strict";

(function () {
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const SV = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const ICON = {
    packs: SV('<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>'),
    close: SV('<path d="M6 6l12 12M18 6L6 18"/>'),
    star: SV('<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16.2 7 18.9l1.2-5.5L4 9.6l5.6-.6z"/>'),
    dd: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5l5 5 5-5"/></svg>',
  };

  // ---------------------------------------------------------------- data
  let data = null, loading = null;
  function load() {
    if (loading) return loading;
    loading = fetch("toymachine-packs.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j) => { data = (j && Array.isArray(j.packs)) ? j.packs : []; return data; });
    return loading;
  }

  // ---------------------------------------------------------------- STAR / FIX marks
  const KEY = "tm-pack-marks";
  let marks = {};
  try { marks = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { marks = {}; }
  const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch (e) { /* private window */ } };
  // the shared database lives on the host page (app2.html may run inside the shell's frame)
  const host = () => { let w = window; for (let i = 0; i < 6 && w; i++) { try { if (w.claude && w.claude.use) return w.claude; } catch (e) { return null; } if (w === w.parent) break; w = w.parent; } return null; };
  let db = null, dbTried = false;
  async function getDb() {
    if (dbTried) return db;
    dbTried = true;
    try { const c = host(); db = c ? await Promise.race([c.use("db"), new Promise((ok) => setTimeout(() => ok(null), 4000))]) : null; } catch (e) { db = null; }
    if (db) {
      // marks made on another device / earlier come back in
      try {
        const snap = await db.collection("tmmarks").limit(2000).get();
        snap.docs.forEach((d) => { const r = d.data(); if (r && r.id && !marks[r.id]) marks[r.id] = { s: !!r.star, f: !!r.fix, at: r.at || 0 }; });
        saveLocal();
        if (live) live.paint();
      } catch (e) { /* offline: local marks only */ }
    }
    return db;
  }
  const docId = (id) => { let x = 2166136261; for (let i = 0; i < id.length; i++) { x ^= id.charCodeAt(i); x = Math.imul(x, 16777619); } return "p" + (x >>> 0).toString(36) + "-" + id.length; };
  function setMark(e, pack, field, on) {
    const m = marks[e.id] || { s: false, f: false };
    m[field] = on; m.at = Date.now();
    if (!m.s && !m.f) delete marks[e.id]; else marks[e.id] = m;
    saveLocal();
    getDb().then((d) => {
      if (!d) return;
      const doc = d.doc("tmmarks/" + docId(e.id));
      (marks[e.id] ? doc.set({ id: e.id, name: e.name, category: e.category || "", pack: pack.name, star: !!m.s, fix: !!m.f, at: m.at }) : doc.delete()).catch(() => { /* kept locally */ });
    });
  }
  const isStar = (e) => !!(marks[e.id] && marks[e.id].s);
  const isFix = (e) => !!(marks[e.id] && marks[e.id].f);
  window.ToyMachinePackMarks = { list: () => Object.entries(marks).map(([id, m]) => ({ id, star: !!m.s, fix: !!m.f })), fix: () => Object.keys(marks).filter((id) => marks[id].f) };

  // ---------------------------------------------------------------- the library view
  let live = null;
  const S = { filter: "all", open: new Set() };   // filter: all | killtoy | other | star | fix
  try { const s = JSON.parse(localStorage.getItem("tm-packs-view") || "{}"); if (s.filter) S.filter = s.filter; (s.open || []).forEach((x) => S.open.add(x)); } catch (e) { /* fine */ }
  const saveView = () => { try { localStorage.setItem("tm-packs-view", JSON.stringify({ filter: S.filter, open: [...S.open] })); } catch (e) { /* fine */ } };

  /** ctx: { main, index(), load(entry), choose(entry), isCur(entry), close() } */
  function open(ctx) {
    if (live) { live.close(); return; }
    const box = h("div", "tmp-lib");
    const head = h("div", "tmp-head");
    const pb = h("button", "tm-iconbtn tmp-packbtn tm-on");
    pb.innerHTML = ICON.packs; pb.title = "Back to the synth";
    const title = h("div", "tm-btitle", "Preset packs"), count = h("span", "tm-dcount");
    const chips = h("div", "tmp-chips");
    const cl = h("button", "tm-iconbtn"); cl.innerHTML = ICON.close; cl.title = "Close (Esc)";
    head.append(pb, title, count, chips, cl);
    const list = h("div", "tmp-list");
    box.append(head, list);
    ctx.main.append(box);
    ctx.main.classList.add("tmp-on");

    const byId = () => { const m = new Map(); ctx.index().forEach((e) => m.set(e.id, e)); return m; };
    function packsNow() {
      const m = byId(), seen = new Set();
      const out = (data || []).map((p) => { const items = p.ids.map((id) => m.get(id)).filter(Boolean); items.forEach((e) => seen.add(e.id)); return Object.assign({}, p, { items }); });
      const mine = ctx.index().filter((e) => e.mine && !seen.has(e.id));
      if (mine.length) out.unshift({ id: "mine", name: "MINE", what: "your own sounds", items: mine, k333: false });
      return out.filter((p) => p.items.length);
    }
    function drawChips(all) {
      chips.textContent = "";
      const n = (f) => all.reduce((a, p) => a + p.items.filter(f).length, 0);
      [["all", "All", all.length], ["killtoy", "KILLTOY", all.filter((p) => p.k333).length], ["other", "Older", all.filter((p) => !p.k333).length],
        ["star", null, n(isStar)], ["fix", "FIX", n(isFix)]].forEach(([id, label, c]) => {
        const b = h("button", "tm-chip" + (S.filter === id ? " tm-sel" : "") + (id === "star" ? " tmp-chipstar" : ""));
        if (id === "star") { b.innerHTML = ICON.star; b.append(h("span", null, String(c))); b.title = "Starred"; } else b.textContent = id === "fix" ? label + " " + c : label;
        b.onclick = () => { S.filter = S.filter === id && id !== "all" ? "all" : id; saveView(); paint(); };
        chips.append(b);
      });
    }
    function presetRow(e, p) {
      const r = h("div", "tm-brow tmp-row" + (ctx.isCur(e) ? " tm-sel" : ""));
      r.dataset.id = e.id;
      const sb = h("button", "tm-bheart tmp-star" + (isStar(e) ? " tm-on" : ""));
      sb.innerHTML = ICON.star; sb.title = "Star";
      sb.onclick = (ev) => { ev.stopPropagation(); setMark(e, p, "s", !isStar(e)); paint(); };
      const nm = h("div", "tm-bname");
      nm.append(h("span", "tm-bn", e.name), h("span", "tm-bsrc", [e.category, e.key].filter(Boolean).join(" \u00b7 ")));
      const fx = h("button", "tmp-fix" + (isFix(e) ? " tm-on" : ""), "FIX");
      fx.title = "Mark to fix later";
      fx.onclick = (ev) => { ev.stopPropagation(); setMark(e, p, "f", !isFix(e)); paint(); };
      r.append(sb, nm, fx);
      r.onclick = () => { ctx.load(e); list.querySelectorAll(".tmp-row.tm-sel").forEach((x) => x.classList.remove("tm-sel")); r.classList.add("tm-sel"); };
      r.ondblclick = () => { ctx.choose(e); close(); };
      return r;
    }
    function paint() {
      const all = packsNow();
      drawChips(all);
      const top = list.scrollTop;
      list.textContent = "";
      const only = S.filter === "star" ? isStar : S.filter === "fix" ? isFix : null;
      let shown = all.filter((p) => S.filter === "killtoy" ? p.k333 : S.filter === "other" ? !p.k333 : true);
      let sounds = 0;
      let lastK = null;
      shown.forEach((p) => {
        let items = only ? p.items.filter(only) : p.items.slice();
        if (only && !items.length) return;
        sounds += items.length;
        if (S.filter === "all" && p.id !== "mine" && lastK !== p.k333) { list.append(h("div", "tmp-sec", p.k333 ? "KILLTOY" : "Older presets")); lastK = p.k333; }
        const isOpen = !!only || S.open.has(p.id);
        const pk = h("div", "tmp-pack" + (isOpen ? " tmp-open" : ""));
        const row = h("button", "tmp-phead");
        const pic = h("span", "tmp-pic");
        if (p.img) { const im = h("img"); im.src = p.img; im.alt = ""; im.draggable = false; im.onerror = () => im.remove(); pic.append(im); }
        const lab = h("span", "tmp-lab");
        const stars = p.items.filter(isStar).length, fixes = p.items.filter(isFix).length;
        lab.append(h("b", null, p.name), h("small", null, (p.what || "").toUpperCase() + " \u00b7 " + p.items.length));
        const meta = h("span", "tmp-meta");
        if (stars) { const s = h("span", "tmp-mstar"); s.innerHTML = ICON.star; s.append(String(stars)); meta.append(s); }
        if (fixes) meta.append(h("span", "tmp-mfix", "FIX " + fixes));
        const dd = h("span", "tmp-dd"); dd.innerHTML = ICON.dd;
        row.append(pic, lab, meta, dd);
        row.onclick = () => { if (only) return; if (S.open.has(p.id)) S.open.delete(p.id); else S.open.add(p.id); saveView(); paint(); };
        pk.append(row);
        if (isOpen) {
          const grid = h("div", "tmp-items");
          items.forEach((e) => grid.append(presetRow(e, p)));
          pk.append(grid);
        }
        list.append(pk);
      });
      if (!list.children.length) list.append(h("div", "tm-empty", S.filter === "star" ? "No starred sounds yet." : S.filter === "fix" ? "Nothing marked FIX." : "No packs yet."));
      count.textContent = shown.length + (shown.length === 1 ? " pack" : " packs") + " \u00b7 " + sounds + " sounds";
      list.scrollTop = top;
    }
    function key(ev) { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); close(); } }
    function close() {
      if (!live) return;
      window.removeEventListener("keydown", key, true);
      box.remove();
      ctx.main.classList.remove("tmp-on");
      live = null;
      if (ctx.close) ctx.close();
    }
    pb.onclick = close; cl.onclick = close;
    window.addEventListener("keydown", key, true);
    live = { close, paint, sync: () => list.querySelectorAll(".tmp-row").forEach((r) => { const e = ctx.index().find((x) => x.id === r.dataset.id); r.classList.toggle("tm-sel", !!(e && ctx.isCur(e))); }) };
    list.append(h("div", "tm-empty", "Loading the packs..."));
    load().then(() => { if (live && live.paint === paint) { paint(); const s = list.querySelector(".tmp-row.tm-sel"); if (s) s.scrollIntoView({ block: "center" }); } });
    getDb();
  }

  // ---------------------------------------------------------------- looks (twins: the PRESETS drawer rows + chips, the SAMPLES kit cards)
  const css = `
.tm-main.tmp-on > :not(.tmp-lib) { visibility: hidden; }
.tmp-lib { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; min-height: 0; background: var(--tm-bg); animation: tm-fade 0.2s; }
.tmp-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 10px 8px 12px; border-bottom: 1px solid var(--tm-line); }
.tmp-head .tm-dcount { flex: 0 0 auto; }
.tmp-chips { flex: 1; display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; padding-right: 6px; }
.tmp-chips .tm-chip { display: inline-flex; align-items: center; gap: 4px; }
.tmp-chipstar svg { width: 12px; height: 12px; }
.tm-root .tmp-chipstar.tm-sel svg path { fill: currentColor; }
.tmp-packbtn.tm-on, .tm-root .tmp-packbtn.tm-on:hover { color: #111; background: var(--tm-acid); }
.tmp-dbtn svg, .tmp-packbtn svg { width: 15px; height: 15px; }
.tmp-dbtn { width: 26px; height: 26px; margin-left: -4px; }
.tmp-list { flex: 1; min-height: 0; overflow: auto; padding: 8px 12px 12px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }
.tmp-sec { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--tm-ink3); padding: 10px 2px 6px; }
.tmp-pack { border-bottom: 1px solid var(--tm-line); }
.tmp-phead { width: 100%; display: flex; align-items: center; gap: 12px; padding: 7px 6px 7px 2px; text-align: left; border-radius: 8px; }
.tm-root .tmp-phead:hover { background: var(--tm-panel2); }
.tmp-pic { flex: none; width: 46px; height: 46px; position: relative; overflow: hidden; background: #111; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
.tmp-pic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .25s ease; }
.tm-root .tmp-phead:hover .tmp-pic img { transform: scale(1.05); }
.tmp-lab { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tmp-lab b { font-family: var(--tm-display); font-weight: 900; font-stretch: 112%; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tmp-lab small { font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em; color: var(--tm-ink3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tmp-meta { flex: none; display: flex; align-items: center; gap: 8px; font-size: 10.5px; font-weight: 700; color: var(--tm-ink2); font-variant-numeric: tabular-nums; }
.tmp-mstar { display: inline-flex; align-items: center; gap: 3px; color: var(--tm-purple); }
.tmp-mstar svg { width: 11px; height: 11px; }
.tmp-mstar svg path { fill: currentColor; }
.tmp-mfix { color: var(--tm-acid); letter-spacing: 0.08em; }
.tmp-dd { flex: none; width: 11px; height: 11px; color: var(--tm-ink3); transition: transform .15s; }
.tmp-dd svg { width: 11px; height: 11px; display: block; }
.tmp-open .tmp-dd { transform: rotate(180deg); color: var(--tm-ink2); }
.tmp-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 2px 8px; padding: 2px 0 10px 58px; }
.tmp-row { grid-template-columns: 26px minmax(0, 1fr) auto; }
.tmp-star.tm-on { color: var(--tm-purple); }
.tmp-star.tm-on svg path { fill: var(--tm-purple); }
.tmp-fix { height: 18px; padding: 0 5px; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; color: var(--tm-ink3); box-shadow: inset 0 0 0 1px var(--tm-line2); opacity: 0; }
.tm-root .tmp-row:hover .tmp-fix, .tmp-fix.tm-on { opacity: 1; }
.tm-root .tmp-fix:hover { color: #fff; }
.tmp-fix.tm-on, .tm-root .tmp-fix.tm-on:hover { color: #111; background: var(--tm-acid); box-shadow: none; }
`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.append(st);

  window.ToyMachinePacks = { open, load, packs: () => data || [], isOpen: () => !!live, sync: () => { if (live) live.sync(); }, close: () => { if (live) live.close(); }, ICON };
})();
