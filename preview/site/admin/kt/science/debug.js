/* DEBUG (Eman, 9 Nov 2026): a BACKEND DATA plug-in tab, right of CHORD LAB. Everything the overnight
   debug sprint found, fixed or wants to ask, one section per thread, with screenshots and TRY IT buttons
   that jump to the real thing in the other tabs and press it.
   Data: science/debug-data.json (window.ktData("debug")), built by scripts/science/debug/build_debug_data.py
   from /mnt/project-files/killtoy/debug-night/<thread>/report.json + its JPGs (embedded).
   Item: { title, status: fixed|broken|ok|question, text, image, branch, link, goto: { tab, sel, i, press } }.
   Flag KT2_DEBUG_TAB_OFF hides the tab. ASCII only. */
(function () {
  "use strict";
  try { if (window.KT2_DEBUG_TAB_OFF || localStorage.getItem("KT2_DEBUG_TAB_OFF") === "1") return; } catch (e) { /* storage blocked */ }

  const CSS = `
  .dbg-q { display: grid; gap: 6px; margin-top: 22px; max-width: 900px; }
  .dbg-q div { background: var(--tile); padding: 12px 16px; font: 600 15px/1.35 var(--sans); color: var(--ink); border-left: 4px solid var(--acid); }
  .dbg-q div em { display: block; font: 400 13px/1.45 var(--sans); font-style: normal; color: var(--ink2); margin-top: 4px; }
  .dbg-q div small { display: block; font: 400 10px/1.4 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); margin-top: 4px; }
  .dbg-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 2px; margin-top: 26px; }
  .dbg-sum div { background: var(--tile); padding: 14px 16px; }
  .dbg-sum b { display: block; font: 500 40px/1 var(--sans); letter-spacing: -.03em; }
  .dbg-sum span { font: 400 10px/1 var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--ink2); }
  .dbg-toc { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 18px; }
  .dbg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2px; margin-top: 18px; }
  .dbg-it { background: var(--tile); padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .dbg-it h4 { margin: 0; font: 600 17px/1.2 var(--sans); letter-spacing: -.01em; color: var(--ink); }
  .dbg-it p { margin: 0; font: 400 13px/1.45 var(--sans); color: var(--ink2); }
  .dbg-it img { display: block; width: 100%; height: 170px; object-fit: cover; object-position: top left; cursor: zoom-in; border: 1px solid var(--rule); background: #111; }
  .dbg-st { align-self: flex-start; font: 500 9px/1 var(--mono); letter-spacing: .16em; padding: 4px 6px; border: 1px solid var(--rule); color: var(--ink2); }
  .dbg-st.fixed { border-color: var(--acc); color: var(--acc); }
  .dbg-st.broken { border-color: #ff5a4f; color: #ff5a4f; }
  .dbg-st.question { background: var(--acid); border-color: var(--acid); color: #111; }
  .dbg-it.question { box-shadow: inset 4px 0 0 var(--acid); }
  .dbg-meta { font: 400 10px/1.5 var(--mono); letter-spacing: .08em; color: var(--ink3); word-break: break-all; }
  .dbg-act { display: flex; gap: 4px; flex-wrap: wrap; margin-top: auto; }
  .dbg-act a, .dbg-act button { font: 500 10px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; padding: 8px 10px; border: 1px solid var(--ink3); background: transparent; color: var(--ink); text-decoration: none; cursor: pointer; }
  .dbg-act a:hover, .dbg-act button:hover { background: var(--ink); color: var(--bg, #111); }
  .dbg-lb { position: fixed; inset: 0; z-index: 50; background: rgba(8,8,10,.92); display: grid; place-items: center; padding: 24px; cursor: zoom-out; }
  .dbg-lb img { max-width: 100%; max-height: 100%; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
  .dbg-tbl { margin-top: 22px; }
  .dbg-tbl .chips { margin-bottom: 6px; }
  .dbg-tbl .wrap { max-height: 520px; overflow: auto; background: var(--tile); }
  .dbg-tbl table { width: 100%; border-collapse: collapse; font: 400 12px/1.3 var(--mono); }
  .dbg-tbl th { position: sticky; top: 0; background: var(--tile2, #eee); text-align: left; padding: 8px 10px; font-weight: 500; letter-spacing: .12em; font-size: 10px; text-transform: uppercase; cursor: pointer; color: var(--ink); white-space: nowrap; }
  .dbg-tbl td { padding: 6px 10px; border-top: 1px solid var(--rule); color: var(--ink); }
  .dbg-tbl td.no { color: #ff5a4f; font-weight: 600; }
  .dbg-tbl td.yes { color: var(--acc); }
  .dbg-tbl .n { font: 400 10px/1 var(--mono); letter-spacing: .14em; color: var(--ink2); margin: 8px 0 0; }
  .dbg-demo { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2px; margin-top: 22px; }
  .dbg-demo .dcard { text-align: left; }
  .dbg-roll { display: block; width: 100%; height: auto; background: rgba(0,0,0,.04); }
  .dbg-roll .bar { stroke: var(--rule); }
  .dbg-roll .ctx { fill: var(--ink3); }
  .dbg-roll .mine { fill: var(--acc); }
  .dbg-roll .before { fill: #ff5a4f; }
  .dbg-roll .ph { fill: var(--acid); opacity: 0; }
  .dcard.on .dbg-roll .ph { opacity: .6; }
  .dbg-demo .who { font: 600 15px/1.25 var(--sans); color: var(--ink); }
  .dbg-demo .goal { font: 400 12px/1.45 var(--sans); color: var(--ink2); margin: 6px 0; }
  .dbg-demo .out { font: 500 10px/1.4 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink); }
  .dbg-sw { display: flex; gap: 4px; margin-top: 8px; }
  .dbg-sw button { font: 500 10px/1 var(--mono); letter-spacing: .14em; padding: 7px 10px; border: 1px solid var(--rule); background: transparent; color: var(--ink2); cursor: pointer; }
  .dbg-sw button.on { border-color: var(--ink); color: var(--ink); }
  .dbg-flash { outline: 4px solid var(--acid, #E4FF3A) !important; outline-offset: 3px; transition: outline-color .4s; }
  `;
  const ST = { fixed: "FIXED", broken: "STILL BROKEN", ok: "WORKS", question: "QUESTION" };
  const GRAD = ["s-mist", "s-sky", "s-lilac", "s-sage", "s-peach", "s-ink"];

  function lightbox(src) {
    const d = document.createElement("div"); d.className = "dbg-lb";
    const im = document.createElement("img"); im.src = src; d.append(im);
    d.onclick = () => d.remove(); document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { d.remove(); document.removeEventListener("keydown", k); } });
    document.body.append(d);
  }

  // TRY IT: open the other tab, find the thing, scroll to it, flash it and (if asked) press it
  function go(g) {
    const tab = document.querySelector('.bd-tab[data-tab="' + g.tab + '"]');
    if (!tab) return;
    tab.click();
    let tries = 0;
    const find = () => {
      const pane = document.getElementById("pane-" + g.tab);
      const all = pane ? pane.querySelectorAll(g.sel || ".dcard") : [];
      const el = all[g.i || 0];
      if (!el) { if (tries++ < 40) setTimeout(find, 150); return; }
      el.scrollIntoView({ block: "center" });
      el.classList.add("dbg-flash"); setTimeout(() => el.classList.remove("dbg-flash"), 2600);
      if (g.press) setTimeout(() => el.click(), 350);
    };
    setTimeout(find, 120);
  }

  // a results table: filter by the first text column (group) and by any yes/no column, click a header to sort
  function table(api, T) {
    const { h, esc, chips } = api;
    const cols = T.columns, rows = T.rows.slice();
    const grpCol = cols.find((c) => typeof rows[0][c] === "string");
    const boolCol = cols.find((c) => typeof rows[0][c] === "boolean");
    const box = h("div", "dbg-tbl");
    let grp = "all", bf = "all", sortBy = null, dir = 1;
    const wrap = h("div", "wrap"), note = h("div", "n");
    const draw = () => {
      let L = rows.filter((x) => (grp === "all" || x[grpCol] === grp) && (bf === "all" || String(x[boolCol]) === bf));
      if (sortBy) L = L.slice().sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : a[sortBy] < b[sortBy] ? -1 : 0) * dir);
      const cell = (c, v) => typeof v === "boolean" ? `<td class="${v ? "yes" : "no"}">${v ? "YES" : "NO"}</td>` : `<td>${esc(typeof v === "number" ? (Math.round(v * 100) / 100).toString() : v == null ? "" : String(v))}</td>`;
      wrap.innerHTML = `<table><thead><tr>${cols.map((c) => `<th data-c="${esc(c)}">${esc(c.replace(/_/g, " "))}${sortBy === c ? (dir > 0 ? " \u25b2" : " \u25bc") : ""}</th>`).join("")}</tr></thead><tbody>${L.map((x) => `<tr>${cols.map((c) => cell(c, x[c])).join("")}</tr>`).join("")}</tbody></table>`;
      wrap.querySelectorAll("th").forEach((th) => (th.onclick = () => { const c = th.dataset.c; if (sortBy === c) dir = -dir; else { sortBy = c; dir = 1; } draw(); }));
      note.textContent = L.length + " of " + rows.length + " rows" + (boolCol ? " \u00b7 " + L.filter((x) => x[boolCol] === false).length + " NO" : "");
    };
    if (grpCol) { const gs = [...new Set(rows.map((x) => x[grpCol]))]; box.append(chips([["all", "ALL"]].concat(gs.map((g) => [g, g])), "all", (v) => { grp = v; draw(); })); }
    if (boolCol) box.append(chips([["all", "ANY"], ["true", boolCol.toUpperCase() + " YES"], ["false", boolCol.toUpperCase() + " NO"]], "all", (v) => { bf = v; draw(); }));
    box.append(wrap, note); draw();
    return box;
  }

  // playable rolls: ctx = what was already on the pattern (quiet grey), mine = what the dice wrote (purple),
  // before = the same person before the fixes (red, via the BEFORE / AFTER switch). Plays through api.bus.
  let dPlay = null;
  function dStop() { if (!dPlay) return; const d = dPlay; dPlay = null; cancelAnimationFrame(d.raf); d.card.classList.remove("on"); if (d.g && d.api.release) d.api.release(d.g); }
  function dPlayRoll(api, card, ph, xOf, ctx, notes, bpm, sc, len) {
    if (dPlay && dPlay.card === card) { dStop(); return; }
    dStop();
    const g = api.bus ? api.bus(dStop) : null, ac = api.audio(), out = g || ac.destination, spb = 60 / (bpm || 120), t0 = ac.currentTime + 0.06;
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const voice = (m, st, ln, vel, quiet) => {
      const t = t0 + st * spb, e = t + Math.max(0.06, ln * spb), o = ac.createOscillator(), f = ac.createBiquadFilter(), v = ac.createGain();
      o.type = quiet ? "sine" : "triangle"; o.frequency.value = hz(m);
      f.type = "lowpass"; f.frequency.setValueAtTime(quiet ? 1200 : Math.min(8000, hz(m) * 6), t); f.frequency.exponentialRampToValueAtTime(Math.max(250, hz(m) * 1.5), e);
      const lv = (quiet ? 0.05 : 0.07 + 0.13 * (vel == null ? 0.8 : vel / 127));
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(lv, t + 0.008); v.gain.exponentialRampToValueAtTime(0.0001, e + 0.05);
      o.connect(f); f.connect(v); v.connect(out); o.start(t); o.stop(e + 0.08);
    };
    (ctx || []).forEach(([m, st, ln]) => voice(m, st, ln, 60, true));
    (notes || []).forEach(([m, st, ln, vel]) => voice(m, st, ln, vel, false));
    card.classList.add("on");
    const d = { card, g, api, raf: 0 }; dPlay = d;
    const tick = () => { if (dPlay !== d) return; const b = (ac.currentTime - t0) / spb; if (b > len + 0.3) { dStop(); return; } ph.setAttribute("x", xOf(Math.max(0, b))); d.raf = requestAnimationFrame(tick); };
    d.raf = requestAnimationFrame(tick);
  }
  function demos(api, list) {
    const { h, esc } = api, NS = "http://www.w3.org/2000/svg";
    const grid = h("div", "dbg-demo");
    for (const dm of list) {
      if (!dm || dm.type !== "notes") continue;
      let which = "mine";
      const c = h("button", "dcard"); c.type = "button";
      const all = [].concat(dm.ctx || [], dm.mine || [], dm.before || []);
      const len = Math.max(4, Math.ceil(Math.max(0, ...all.map((n) => n[1] + n[2])) / 4) * 4);
      const lo = Math.min(...all.map((n) => n[0])) - 1, hi = Math.max(...all.map((n) => n[0])) + 1;
      const W = 320, H = 110, xOf = (b) => (W * b / len).toFixed(2), rowH = H / Math.max(12, hi - lo + 1), yOf = (p) => H - (p - lo + 1) * rowH;
      const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "dbg-roll");
      const add = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
      for (let b = 0; b <= len; b += 4) add("line", { x1: xOf(b), x2: xOf(b), y1: 0, y2: H, class: "bar" });
      const layer = document.createElementNS(NS, "g"); svg.append(layer);
      const ph = add("rect", { x: 0, y: 0, width: 2, height: H, class: "ph" });
      const draw = () => {
        layer.replaceChildren();
        const put = (n, cls) => { const e = document.createElementNS(NS, "rect"); e.setAttribute("x", xOf(n[1])); e.setAttribute("y", yOf(n[0]).toFixed(2)); e.setAttribute("width", Math.max(1.2, W * n[2] / len - 0.6).toFixed(2)); e.setAttribute("height", Math.max(1.2, rowH - 0.5).toFixed(2)); e.setAttribute("class", cls); layer.append(e); };
        (dm.ctx || []).forEach((n) => put(n, "ctx"));
        ((which === "before" ? dm.before : dm.mine) || []).forEach((n) => put(n, which === "before" ? "before" : "mine"));
      };
      draw();
      c.append(h("div", "dh", `<div class="who">${esc(dm.who || "")}</div><span class="play"><svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg></span>`));
      c.append(svg);
      if (dm.goal) c.append(h("div", "goal", esc(dm.goal)));
      const outEl = h("div", "out", esc(dm.outcome || "")); c.append(outEl);
      if (dm.before) {
        const sw = h("div", "dbg-sw");
        for (const [k, lab] of [["mine", "AFTER"], ["before", "BEFORE"]]) {
          const b = h("button", k === which ? "on" : "", lab); b.type = "button";
          b.onclick = (e) => { e.stopPropagation(); which = k; sw.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); draw(); dStop(); dPlayRoll(api, c, ph, xOf, dm.ctx, which === "before" ? dm.before : dm.mine, dm.bpm, dm.sc, len); };
          sw.append(b);
        }
        c.append(sw);
      }
      c.onclick = () => dPlayRoll(api, c, ph, xOf, dm.ctx, which === "before" ? dm.before : dm.mine, dm.bpm, dm.sc, len);
      grid.append(c);
    }
    return grid;
  }

  async function render(pane, api) {
    const { h, esc, slide, title, chips } = api;
    if (!document.getElementById("dbg-css")) { const st = document.createElement("style"); st.id = "dbg-css"; st.textContent = CSS; document.head.append(st); }
    let D;
    try { D = window.DEBUG_SCIENCE_DATA || await (await (window.ktData ? window.ktData("debug") : fetch("science/debug-data.json"))).json(); }
    catch (e) { const x = slide("s-mist", "Debug", ""); x.append(title("h2", "Could not load the report.", "science/debug-data.json is missing next to this page.")); pane.append(x); return; }
    const R = D.reports || [], all = R.flatMap((r) => r.items.map((it) => Object.assign({ from: r.title }, it)));
    const count = (s) => all.filter((x) => x.status === s).length;

    // 1. the night in one look
    let s = slide("s-night", "Backend data", "Debug \u00b7 " + (D.built || ""));
    s.append(title("h1", "Tonight's debug.", D.headline || "What was tested, what got fixed, what needs you."));
    const qs = all.filter((x) => x.status === "question");
    if (qs.length) {
      const q = h("div", "dbg-q");
      for (const x of qs) q.append(h("div", "", `\ud83d\udfe1 ${esc(x.title)}${x.text ? `<em>${esc(x.text)}</em>` : ""}<small>${esc(x.from)}</small>`));
      s.append(q);
    }
    s.append(h("div", "dbg-sum", [["fixed", "Fixed"], ["ok", "Works"], ["broken", "Still broken"], ["question", "Need you"]].map(([k, l]) => `<div><b>${count(k)}</b><span>${l}</span></div>`).join("") + `<div><b>${R.length}</b><span>Threads</span></div>`));
    const toc = h("div", "dbg-toc");
    R.forEach((r, i) => { const b = h("button", "chip", esc(r.title)); b.type = "button"; b.onclick = () => { const t = document.getElementById("dbg-r" + i); if (t) t.scrollIntoView({ behavior: "smooth" }); }; toc.append(b); });
    s.append(toc);
    pane.append(s);

    // 2. one slide per thread
    R.forEach((r, ri) => {
      const sec = slide(GRAD[ri % GRAD.length], r.title, (r.items.length) + " findings");
      sec.id = "dbg-r" + ri;
      sec.append(title("h2", r.title + ".", ""));
      if (r.summary) sec.append(h("p", "lede", esc(r.summary)));
      const grid = h("div", "dbg-grid");
      const draw = (f) => {
        grid.replaceChildren();
        for (const it of r.items) {
          if (f !== "all" && it.status !== f) continue;
          const c = h("div", "dbg-it " + (it.status || ""));
          c.append(h("span", "dbg-st " + (it.status || ""), esc(ST[it.status] || (it.status || "").toUpperCase())));
          c.append(h("h4", "", esc(it.title)));
          if (it.image) { const im = document.createElement("img"); im.src = it.image; im.alt = it.title; im.loading = "lazy"; im.onclick = () => lightbox(it.image); c.append(im); }
          if (it.text) c.append(h("p", "", esc(it.text)));
          if (it.branch) c.append(h("div", "dbg-meta", esc(it.branch)));
          const act = h("div", "dbg-act");
          if (it.goto) { const b = h("button", "", esc(it.goto.label || "TRY IT")); b.type = "button"; b.onclick = () => go(it.goto); act.append(b); }
          if (it.link) { const a = h("a", "", esc(it.linkLabel || "OPEN")); a.href = it.link; a.target = "_blank"; a.rel = "noopener"; act.append(a); }
          if (act.children.length) c.append(act);
          grid.append(c);
        }
        if (!grid.children.length) grid.append(h("div", "art-empty", "Nothing here."));
      };
      const have = ["fixed", "ok", "broken", "question"].filter((k) => r.items.some((x) => x.status === k));
      if (have.length > 1) sec.append(chips([["all", "ALL"]].concat(have.map((k) => [k, ST[k]])), "all", draw));
      sec.append(grid); draw("all");
      if (r.table && r.table.rows && r.table.rows.length) sec.append(table(api, r.table));
      if (Array.isArray(r.demo) && r.demo.length) sec.append(demos(api, r.demo));
      pane.append(sec);
    });
  }

  (window.BackendDataTabs = window.BackendDataTabs || []).push({ id: "debug", label: "DEBUG", order: 99, after: "lab", render });
})();
