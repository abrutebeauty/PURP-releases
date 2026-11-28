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
      if (!isPreset(p)) { out.push(p); return; }
      var c = byId["card-" + p.id], art = c && c.cover ? c.cover : HAS.indexOf(p.id) >= 0 ? "/img/cd/card-" + p.id + ".webp" : null;
      out.push(art && !/\/card-/.test(String(p.cover || "")) ? Object.assign({}, p, { cover: art, look: "card", cdCover: p.cover }) : art ? Object.assign({}, p, { look: "card" }) : p);
    });
    return Object.assign({}, d, { products: out });
  }
  var orig = window.applyShop;
  window.applyShop = function (d) { return orig(merge(d)); };
  window.ckCardMerge = merge;
  if (window.__CKD) { try { window.applyShop(window.__CKD); document.dispatchEvent(new Event("ck-cur")); } catch (e) {} }   // shop.js already drew once
})();
