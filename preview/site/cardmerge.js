/* CARD_PRODUCT (Eman 28 Nov): every Serum preset pack is ONE product, shown as its trading card (no CD).
   The separate "card-<id>" product is folded into the pack and not listed on its own. Sample/drum packs keep the CD in its case,
   free samples keep the bare CD. Only what the page shows changes: the saved data (and the CD art) stay as they were.
   Loaded right after shop.js. false = the old CD product + separate card product. */
(function () {
  var CARD_PRODUCT = true;
  if (!CARD_PRODUCT || typeof window.applyShop !== "function") return;
  // packs that have trading card art at img/cd/card-<id>.webp
  var HAS = ["2hollcore-i", "2hollcore-ii", "bladecore-i", "bladecore-ii", "crystal-core-i", "crystal-core-ii", "dreamcore-i", "dreamcore-ii", "esskid-core-i", "fakeminkcore-i", "fakeminkcore-ii", "leancore-i", "leancore-ii", "nettcore-ii", "playboi-i", "silentcore-i", "travis-core-i", "travis-core-iii", "witchcore-i", "witchcore-ii"];
  var isPreset = function (p) { return p && (p.type || "serum") === "serum" && !p.freebie && !/^card-/.test(p.id); };
  function merge(d) {
    if (!d || !Array.isArray(d.products)) return d;
    var byId = {}; d.products.forEach(function (p) { byId[p.id] = p; });
    var out = [];
    d.products.forEach(function (p) {
      var m = /^card-(.+)$/.exec(p.id);
      if (m && isPreset(byId[m[1]])) return;   // folded into its pack
      var t = /^card-(.+)-[a-z]$/.exec(p.id); if (CM_FIX && t && byId["card-" + t[1]]) return;   // CM_FIX (Eman 28 Nov): test variants (card-bladecore-ii-b/-c/-d) were showing as extra "bladecore ii" cards
      if (!isPreset(p)) { out.push(p); return; }
      var c = byId["card-" + p.id], art = c && c.cover ? c.cover : HAS.indexOf(p.id) >= 0 ? "/img/cd/card-" + p.id + ".webp" : null;
      out.push(art && !/\/card-/.test(String(p.cover || "")) ? Object.assign({}, p, { cover: art, look: "card", cdCover: p.cover }) : art ? Object.assign({}, p, { look: "card" }) : p);
    });
    return Object.assign({}, d, { products: out });
  }
  var CM_FIX = true;   // Eman 28 Nov: no duplicate test cards, cards smaller with room above + below, eye button saves before anything reloads. false = first version
  if (CM_FIX) {
    var st = document.createElement("style");   // every trading card sits inside the same box as the CDs, with space above and below it
    st.textContent = '.card .cv .pq:has(img[src*="/card-"]){scale:var(--ckcs,.8)}html.opium2 #worlds .card .cv:hover::before{opacity:.5}';   // GLOW_HALF (Eman 28 Nov 02:35): purple glow behind each product at 50%
    document.head.appendChild(st);
    // CARD_H (Eman 28 Nov 02:34): a card is exactly as tall as the CD cases in the grid. Case art fills 451/600 of its image height, card art 586/600.
    var fitCards = function () {
      var cd = [].find.call(document.querySelectorAll(".card .cv .pq img"), function (i) { return /\/img\/cd\/[a-z0-9-]*drums[a-z0-9-]*\.webp/.test(i.getAttribute("src") || "") && i.offsetHeight; });
      var cc = [].find.call(document.querySelectorAll(".card .cv .pq img"), function (i) { return /\/card-/.test(i.getAttribute("src") || "") && i.offsetHeight; });
      if (!cd || !cc) return;
      var cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ckcs")) || 0.8, k = (cd.getBoundingClientRect().height * 451 / 600) / (cc.getBoundingClientRect().height / cur * 586 / 600);   // rendered sizes (CD cases can carry their own scale)
      if (k > 0.4 && k < 2 && Math.abs(k - cur) > 0.004) document.documentElement.style.setProperty("--ckcs", k.toFixed(3));
    };
    var fitSoon = function () { requestAnimationFrame(function () { fitCards(); setTimeout(fitCards, 400); }); };
    addEventListener("resize", fitSoon); try { new MutationObserver(fitSoon).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] }); } catch (e) {} addEventListener("load", fitSoon); document.addEventListener("ck-cur", fitSoon);
    // eye button on home cards: live.js saved and then reloaded 0.7 s later, which cut the save off on a slow connection, so nothing changed.
    // Here the save finishes first, then the card updates in place (no reload).
    var ON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/></svg>';
    var OFF = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z"/><path d="M2 14L14 2"/></svg>';
    var busy = false;
    window.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-cardeye]"); if (!b || !window.ADM) return;
      e.preventDefault(); e.stopPropagation(); if (busy) return;
      var id = b.dataset.cardeye, D = window.ADM, p = (D.products || []).find(function (x) { return x.id === id; }); if (!p) return;
      var was = p.status || "live"; p.status = was === "hidden" ? "live" : "hidden";
      var folded = (D.products || []).find(function (x) { return x.id === "card-" + id; }); if (folded) folded.status = p.status;   // keep the folded card product in step
      busy = true; b.style.opacity = ".4";
      fetch("/api/admin/packs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(D) }).then(function (r) {
        if (!r.ok) throw 0;
        try { localStorage.removeItem("ck-prod"); } catch (er) {}
        var off = p.status === "hidden", c = b.closest(".card");
        if (c) c.classList.toggle("adm-off-card", off);
        b.innerHTML = off ? OFF : ON; b.dataset.st = String(off); b.classList.toggle("off", off);
        tip((p.name || id) + (off ? " hidden" : " is live"));
      }).catch(function () { p.status = was; if (folded) folded.status = was; tip("Not saved"); })
        .then(function () { busy = false; b.style.opacity = ""; });
    }, true);
    var tip = function (t) { var x = document.createElement("div"); x.className = "adm-toast"; x.textContent = t; document.body.appendChild(x); setTimeout(function () { x.remove(); }, 1400); };
  }
  var orig = window.applyShop;
  window.applyShop = function (d) { var r = orig(merge(d)); if (CM_FIX) setTimeout(fitSoon, 50); return r; };
  window.ckCardMerge = merge;
  if (window.__CKD) { try { window.applyShop(window.__CKD); document.dispatchEvent(new Event("ck-cur")); } catch (e) {} }   // shop.js already drew once
})();
