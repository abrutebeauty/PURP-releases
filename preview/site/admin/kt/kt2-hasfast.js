// KILLTOY speed pass (27 Nov 2026): the ":has()" style rules made the whole app slow.
//
// Measured with 100 patterns: while the style sheets hold any "A:has(B)" rule, every element added,
// removed or re-classed anywhere makes the browser re-check the WHOLE page's styles (about 9-18 ms each
// time here, several times per redraw). One full redraw took 29 ms with them and 3 ms without them, and a
// pattern drag paid it on every mouse move.
//
// This file keeps every rule's look exactly the same, but takes the ":has()" out of the style engine:
// each "A:has(B)" in a rule becomes a plain class ".khs-N", and this script puts that class on exactly the
// elements that match "A:has(B)" (asked once with querySelectorAll, which is cheap), again after every DOM
// change (batched into one pass, before the next paint, so nothing flickers).
// Rules whose :has() reads :hover or :focus stay as they are (rare, and they need the live state).
//
// window.KT2_HAS_OLD = the old way (the original rules, nothing rewritten). KT2Has.stats() = what it did.
(function () {
  "use strict";
  if (window.KT2_HAS_OLD || !window.MutationObserver || !CSS.supports || !CSS.supports("selector(:has(a))")) return;
  const queries = new Map();   // "A:has(B)" -> { cls, sel, live:Set<Element> }
  const attrs = new Set(["class", "hidden", "id"]);
  let checked = false, rules = 0, skipped = 0, passes = 0, passMs = 0, n = 0;

  // the text of the :has( ... ) starting at i (index of ':'), and where it ends
  function hasArg(s, i) {
    let d = 0, j = i + 5;
    for (; j < s.length; j++) { const ch = s[j]; if (ch === "(") d++; else if (ch === ")") { if (d === 0) break; d--; } }
    return { arg: s.slice(i + 5, j), end: j + 1 };
  }
  // the compound selector in front of position i ("div.a#b[x]" ...), skipping an unclosed ":not(" / ":is(" right before it
  function compoundBefore(s, i) {
    let j = i, d = 0;
    while (j > 0) {
      const ch = s[j - 1];
      if (ch === ")") d++;
      else if (ch === "(") { if (d === 0) break; d--; }
      else if (d === 0 && (ch === " " || ch === ">" || ch === "+" || ch === "~" || ch === ",")) break;
      j--;
    }
    let base = s.slice(j, i);
    // ".x:not(:has(y))": j stopped at "(" of ":not(" -> the compound is what is in front of ":not("
    if (j > 0 && s[j - 1] === "(") {
      const k = s.lastIndexOf(":", j - 1);
      const outer = compoundBefore(s, k);
      return outer.replace(/:(not|is|where)\($/, "");
    }
    return base;
  }
  function rewrite(sel) {
    let out = "", i = 0, changed = false;
    while (true) {
      const k = sel.indexOf(":has(", i);
      if (k < 0) { out += sel.slice(i); break; }
      const { arg, end } = hasArg(sel, k);
      if (/:hover|:focus|:active|:has\(/.test(arg)) return null;   // live states: keep the rule as it is
      const base = compoundBefore(sel, k).replace(/:(not|is|where)\($/, "");
      // the element the :has() belongs to: its compound, with any other :has() in it left out
      const subject = (base.replace(/:has\([^)]*\)/g, "").replace(/::?[a-z-]+$/i, "") || "*") + ":has(" + arg + ")";
      try { document.querySelector(subject); } catch (e) { return null; }
      let q = queries.get(subject);
      if (!q) {
        // the names this query depends on: a class/attribute change elsewhere can't change its answer
        const tokens = new Set((subject.match(/[.#][\w-]+|\[[\w-]+/g) || []).map((x) => x[0] === "[" ? "[" + x.slice(1).toLowerCase() : x.slice(1)));
        q = { cls: "khs-" + (n++), sel: subject, live: new Set(), tokens };
        queries.set(subject, q);
      }
      if (/:checked/.test(arg)) checked = true;
      (arg.match(/\[([a-z-]+)/gi) || []).forEach((a) => attrs.add(a.slice(1).toLowerCase()));
      out += sel.slice(i, k) + "." + q.cls;
      i = end; changed = true;
    }
    return changed ? out : null;
  }
  function walk(list) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
      const s = r.selectorText;
      if (!s || s.indexOf(":has(") < 0) continue;
      const parts = splitList(s), outParts = [];
      let ok = true;
      for (const p of parts) {
        if (p.indexOf(":has(") < 0) { outParts.push(p); continue; }
        const w = rewrite(p);
        if (w == null) { ok = false; break; }
        outParts.push(w);
      }
      if (!ok) { skipped++; continue; }
      const next = outParts.join(", ");
      try { r.selectorText = next; } catch (e) { skipped++; continue; }
      orig.push([r, s]);
      if (r.selectorText.indexOf(":has(") >= 0) { skipped++; continue; }
      rules++;
    }
  }
  function splitList(s) {   // a selector list split on top-level commas
    const out = []; let d = 0, st = 0;
    for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === "(") d++; else if (ch === ")") d--; else if (ch === "," && d === 0) { out.push(s.slice(st, i).trim()); st = i + 1; } }
    out.push(s.slice(st).trim());
    return out;
  }
  const done = new WeakSet(), orig = [];
  function scanSheets() {
    let any = false;
    for (const sh of document.styleSheets) {
      if (done.has(sh)) continue;
      let list; try { list = sh.cssRules; } catch (e) { done.add(sh); continue; }   // another site's sheet (fonts)
      if (!list) continue;
      done.add(sh); walk(list); any = true;
    }
    return any;
  }
  function apply(only) {
    const t0 = performance.now();
    for (const q of only || queries.values()) {
      let now;
      try { now = document.querySelectorAll(q.sel); } catch (e) { continue; }
      const next = new Set(now);
      for (const e of q.live) if (!next.has(e)) e.classList.remove(q.cls);
      for (const e of next) if (!q.live.has(e)) e.classList.add(q.cls);
      q.live = next;
    }
    passes++; passMs += performance.now() - t0;
  }
  let mo = null;
  const run = () => { apply(); if (mo) mo.takeRecords(); };
  function start() {
    scanSheets(); apply();
    if (mo) return;
    // at most one pass per frame, in the frame's animation step (before its styles and paint, so no flicker)
    let queued = false;
    // which queries a change can affect: elements added/removed = all of them; a class flip = only the
    // queries that name one of the flipped classes (a drag flips "dragging" etc. on every move)
    let all = false; const dirty = new Set();
    const frame = () => { queued = false; const list = all ? null : [...dirty]; all = false; dirty.clear(); if (!list || list.length) apply(list); if (mo) mo.takeRecords(); };
    const mark = (tok) => { for (const q of queries.values()) if (q.tokens.has(tok)) dirty.add(q); };
    mo = new MutationObserver((recs) => {
      let sheetsNew = false;
      for (const r of recs) {
        if (all) break;
        if (r.type === "childList") {
          for (const a of r.addedNodes) if (a.nodeName === "STYLE" || a.nodeName === "LINK") {   // scripts add their own sheets: rewrite those too
            sheetsNew = true;
            if (a.nodeName === "LINK") a.addEventListener("load", () => { scanSheets(); run(); }, { once: true });
          }
          if ([...r.addedNodes, ...r.removedNodes].some((x) => x.nodeType === 1)) all = true;
        } else if (r.attributeName === "class") {
          const was = new Set((r.oldValue || "").split(/\s+/)), now = r.target.classList;
          for (const c of now) if (!was.has(c) && !c.startsWith("khs-")) mark(c);
          for (const c of was) if (c && !now.contains(c) && !c.startsWith("khs-")) mark(c);
        } else if (r.attributeName === "id") all = true;
        else mark("[" + r.attributeName);
      }
      if (sheetsNew) { scanSheets(); all = true; }   // new rules apply right away
      if ((all || dirty.size) && !queued) { queued = true; requestAnimationFrame(frame); }
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: [...attrs] });
    if (checked) { document.addEventListener("change", run, true); document.addEventListener("input", run, true); document.addEventListener("click", () => queueMicrotask(run), true); }
  }
  window.KT2Has = { stats: () => ({ rules, skipped, queries: queries.size, passes, msPerPass: passes ? +(passMs / passes).toFixed(2) : 0 }), refresh: () => { scanSheets(); apply(); }, list: () => [...queries.keys()],
    // tests: put the original rules back (and stop), to compare the look with and without
    undo: () => { if (mo) mo.disconnect(); mo = null; for (const [r, s] of orig) r.selectorText = s; for (const q of queries.values()) for (const e of q.live) e.classList.remove(q.cls); } };
  start();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { scanSheets(); apply(); });
  window.addEventListener("load", () => { scanSheets(); apply(); });
})();
