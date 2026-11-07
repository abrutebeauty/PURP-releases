// KILLTOY 2: the CARDS tab (Eman, 5 Nov). The cards you have unlocked (TOY MACHINE, KILLDRUM) and
// a line of locked ones further up the levels: frosted, a blackletter ? in the middle, the score to
// reach each one and a bar for how close you are. Pressing CARDS folds them out one by one with a
// sound. Click an unlocked card to see it big again (KT2Juice.unlock).
// SCORE: points for making music, counted from the commands (window.run), kept in localStorage
// kt2.score. KT2_CARDS_POINTS(n) adds points by hand (for testing). KT2_NO_CARDS_TAB hides the tab.
// Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  if (!document.documentElement.classList.contains("kt2") || !window.KT2Tabs) return;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const OWNED = [
    { name: "TOY MACHINE", img: "cards/C2_tm.jpg", kind: "SYNTH" },
    { name: "KILLDRUM", img: "cards/C2_kd.jpg", kind: "DRUMS" },
    { name: "TOY KEYS", img: "cards/C2_tk.jpg", kind: "KEYS" },   // 7 Nov: the starter instrument (code-made card; swap for a drawn one)
  ];
  // the locked line: level, score needed, picture
  const LOCKED = [
    { lv: 3, need: 500, img: "cards/kc-lock1.jpg" },
    { lv: 4, need: 1500, img: "cards/kc-lock2.jpg" },
    { lv: 5, need: 3000, img: "cards/kc-lock3.jpg" },
    { lv: 6, need: 6000, img: "cards/kc-lock4.jpg" },
    { lv: 7, need: 10000, img: "cards/kc-lock5.jpg" },
    { lv: 8, need: 20000, img: "cards/kc-lock6.jpg" },
  ];

  // ---------------------------------------------------------------- score
  const POINTS = {
    setMidiNotes: 1, newMidiClip: 5, record: 10, stopRecording: 4, addPlugin: 3, applyChain: 3, setInstrument: 4,
    addSample: 3, duplicateClips: 1, setClipComp: 3, tune: 5, autoSections: 4, addSection: 2, exportMix: 25,
    saveSession: 2, newVersion: 4, setParam: 0.2, setClipFades: 0.5, moveClips: 0.5,
  };
  let score = 0;
  try { score = Math.max(0, parseFloat(localStorage.getItem("kt2.score")) || 0); } catch (e) { /* starts at 0 */ }
  const save = () => { try { localStorage.setItem("kt2.score", String(Math.round(score * 10) / 10)); } catch (e) { /* fine */ } };
  function add(n) {
    if (!(n > 0)) return;
    const before = score;
    score += n; save();
    const got = LOCKED.find((k) => before < k.need && score >= k.need);
    if (got) {
      try { window.KT2Juice && KT2Juice.sound.chime(); } catch (e) { /* quiet */ }
      if (typeof toast === "function") toast(`Level ${got.lv} card unlocked. Open CARDS to see it.`);
    }
    if (window.KT2 && KT2.tab === "cards") paintScore();
  }
  window.KT2_CARDS_POINTS = add;
  if (typeof window.run === "function") {
    const orig = window.run;
    window.run = function (cmd, args) {
      const p = orig.apply(this, arguments);
      const n = POINTS[cmd];
      if (n && !(args && args.drag)) Promise.resolve(p).then((r) => { if (!r || !r.error) add(n); }, () => {});
      return p;
    };
  }

  // ---------------------------------------------------------------- the icon in the top bar
  // (Eman, 7 Nov 01:30: CARDS moves out of the footer's tab list to an icon where the cloud was.)
  // A click opens the cards in the footer (unfolded); a second click goes back to the tab you had.
  if (!window.KT2_CARDS_TAB_OLD) {
    const ib = document.createElement("button");
    ib.className = "k2-bgbtn k2-cardsbtn";
    ib.innerHTML = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="3" y="5" width="9" height="12" rx="1"/><path d="M14 4 L18 5 L15.5 16.5 L13 16"/></svg>';
    let back = "fx";
    const paintBtn = () => {
      const on = !!(window.KT2 && KT2.tab === "cards");
      ib.classList.toggle("on", on);
      ib.title = `CARDS: ${Math.floor(score)} PTS`;
    };
    ib.onclick = (e) => {
      e.stopPropagation();
      const K = window.KT2;
      if (!K || !K.openTab) return;
      if (K.tab === "cards") { K.openTab(back || "fx"); }
      else {
        back = K.tab || "fx";
        if (document.documentElement.classList.contains("k2-folded")) { document.documentElement.classList.remove("k2-folded"); window.dispatchEvent(new Event("resize")); }
        K.openTab("cards");
      }
      paintBtn();
    };
    const readouts = document.querySelector(".readouts");
    if (readouts) readouts.append(ib);
    // keep the light right when another tab is opened
    document.addEventListener("click", () => setTimeout(paintBtn, 0), true);
    paintBtn();
  }

  // ---------------------------------------------------------------- the tab
  const fmt = (n) => Math.floor(n).toLocaleString("en-US").replace(/,/g, " ");
  let live = null;   // the pane's bits to repaint when the score moves
  function paintScore() {
    if (!live || !live.root.isConnected) return;
    const next = LOCKED.find((k) => score < k.need);
    const prev = next ? (LOCKED[LOCKED.indexOf(next) - 1] || { need: 0 }).need : 0;
    live.num.textContent = fmt(score);
    live.next.textContent = next ? `LV ${next.lv} AT ${fmt(next.need)}` : "ALL CARDS";
    live.fill.style.width = (next ? Math.min(1, (score - prev) / (next.need - prev)) * 100 : 100) + "%";
    live.locks.forEach(({ k, node }) => {
      const open = score >= k.need;
      node.classList.toggle("locked", !open);
      node.querySelector(".k2c-pb i").style.width = Math.min(1, score / k.need) * 100 + "%";
    });
  }

  function card(it, i, locked) {
    const n = h("div", "k2c-card" + (locked ? " locked" : " owned"));
    n.style.setProperty("--i", i);
    const face = h("div", "k2c-face");
    const img = h("img"); img.src = it.img; img.alt = ""; img.draggable = false;
    face.append(img, h("i", "k2c-glass"), h("i", "k2c-shine"));
    if (locked) face.append(h("i", "k2c-frost"), h("i", "k2c-q"));
    n.append(face);
    const lab = h("div", "k2c-lab");
    if (locked) {
      lab.append(h("b", null, "LV " + it.lv), h("span", null, fmt(it.need)));
      const pb = h("div", "k2c-pb"); pb.append(h("i")); lab.append(pb);
    } else lab.append(h("b", null, it.name), h("span", null, it.kind));
    n.append(lab);
    // tilt under the mouse, the shine follows
    n.addEventListener("mousemove", (e) => {
      const r = face.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      face.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`;
      face.style.setProperty("--sx", (50 + x * 90) + "%");
    });
    n.addEventListener("mouseleave", () => { face.style.transform = ""; face.style.removeProperty("--sx"); });
    n.addEventListener("mouseenter", () => { try { KT2Juice.sound.tick(i + 2); } catch (e) { /* quiet */ } });
    n.onclick = () => {
      if (n.classList.contains("locked")) {
        try { KT2Juice.sound.nope(); } catch (e) { /* quiet */ }
        n.animate([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 220 });
        return;
      }
      if (!locked && window.KT2Juice && KT2Juice.unlock) KT2Juice.unlock(it.name);
    };
    return n;
  }

  window.KT2Tabs.cards = (pane) => {
    const root = h("div", "k2c");
    const top = h("div", "k2c-top");
    const num = h("b", "k2c-num"), next = h("span", "k2c-next");
    const bar = h("div", "k2c-bar"), fill = h("i");
    bar.append(fill);
    top.append(h("em", null, "SCORE"), num, bar, next);
    const row = h("div", "k2c-row");
    const owned = OWNED.map((it, i) => card(it, i, false));
    const gap = h("div", "k2c-gap");
    const locks = LOCKED.map((k, j) => ({ k, node: card(k, OWNED.length + j, true) }));
    row.append(...owned, gap, ...locks.map((x) => x.node));
    root.append(top, row);
    pane.append(root);
    live = { root, num, next, fill, locks };
    // the cards are as tall as the footer lets them be (name line under each)
    const size = () => { if (!row.isConnected) return ro.disconnect(); root.style.setProperty("--cw", Math.max(36, Math.floor((row.clientHeight - 8 - 30) * 700 / 938)) + "px"); };
    const ro = new ResizeObserver(size); ro.observe(row); size();
    paintScore();
    // the fold-out: every card starts stacked on the first one, face turned away, and deals out to its place
    if (window.KT2_NO_CARDS_FOLD) return;
    const all = [...owned, ...locks.map((x) => x.node)];
    requestAnimationFrame(() => {
      const x0 = all[0].getBoundingClientRect().left;
      try { KT2Juice.sound.whoosh(); } catch (e) { /* quiet */ }
      all.forEach((n, i) => {
        const dx = x0 - n.getBoundingClientRect().left, d = i * 70;
        n.animate([
          { transform: `translateX(${dx}px) rotateY(-100deg) scale(0.7)`, opacity: 0 },
          { transform: `translateX(${dx * 0.15}px) rotateY(12deg) scale(1.04)`, opacity: 1, offset: 0.7 },
          { transform: "translateX(0) rotateY(0) scale(1)", opacity: 1 },
        ], { duration: 520, delay: d, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" });
        setTimeout(() => {
          try { i < OWNED.length ? KT2Juice.sound.tick(i * 2 + 2) : KT2Juice.sound.tick(i - OWNED.length); } catch (e) { /* quiet */ }
        }, d + 320);
      });
      setTimeout(() => { try { KT2Juice.sound.chime(); } catch (e) { /* quiet */ } }, all.length * 70 + 420);
      fill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 700, delay: 200, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" });
    });
  };
})();
