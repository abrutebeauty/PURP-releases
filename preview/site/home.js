/* COREKULT shop page: all packs. Click a pack to open its own page. Needs shop.js. */
/* CARDS_CHIP (Eman 21 Nov): a CARDS filter chip that shows only the trading-card look products (look:"card"). false = no chip */
const CARDS_CHIP = true;
const RECENT_CHIP = true;   // Eman 22 Nov: admin-only RECENT chip, every pack in one grid with the last edited (p.edited, stamped by the worker on save) on top. false = no chip
const SEARCH_BAR = true;    // Eman 22 Nov: search box on the right of the filter chips, two chip rows tall; filters cards by pack name, genre, blurb and sound names. false = no search
/* FREE_BARE (Eman 21 Nov): free sample packs show the bare disc (no case, with wear) from img/cdbare. false = disc in case (img/cdfree) */
const FREE_BARE = true;
$("#yr").textContent = new Date().getFullYear();

function render() {
  if ($("#bnLab")) $("#bnLab").textContent = `The bundle · all ${PRODUCTS.length} packs`;
  // collage: up to 10 covers; open spots show packs that are on the way (marked SOON)
  const SOON = ["img/soon-fakemink.jpg", "img/soon-leancore.jpg", "img/soon-esskid-serum.jpg", "img/soon-witchcore.jpg", "img/soon-esskid-drums.jpg", "img/soon-fakemink-drums.jpg", "img/soon-leancore-drums.jpg"];
  const N = 12;   // 4 x 3 collage that fills the hero beside the logo (Eman 18 Nov)
  const tiles = PRODUCTS.slice(0, N).map((p) => `<i><img src="${esc(abs(p.cover))}" alt="" loading="lazy" decoding="async"></i>`).concat(SOON.slice(0, Math.max(0, N - PRODUCTS.length)).map((u) => `<i class="soon"><img src="/${u}?v=2" alt="" loading="lazy" decoding="async"><small>Soon</small></i>`));
  if ($("#bcG")) $("#bcG").innerHTML = tiles.join("");
  if ($("#mbN")) $("#mbN").textContent = `All ${PRODUCTS.length} packs in one`;
  if ($("#mbCov")) $("#mbCov").innerHTML = PRODUCTS.slice(0, 3).map((p) => `<img src="${esc(abs(p.cover))}" alt="" loading="lazy" decoding="async">`).join("");
  document.body.classList.toggle("bf-old", BUNDLE_FLOW_OLD);
  if (!BUNDLE_FLOW_OLD) document.querySelectorAll(".bflow").forEach(BF_PILE ? bpile : bflow);
  if (BF_PILE && typeof BUNDLE10 !== "undefined" && BUNDLE10) { if ($("#mbN")) $("#mbN").textContent = `Pick 10 packs · save ${show(BUNDLE_OFF)}`; const me = document.querySelector(".mbund em"); if (me) me.textContent = `${show(BUNDLE_OFF)} off`; if ($("#mbCov")) $("#mbCov").innerHTML = bundleMix().slice(0, 3).map((id) => byId(id)).filter(Boolean).map((p) => `<img src="${esc(abs(p.cover))}" alt="" loading="lazy" decoding="async">`).join(""); }
  $("#stats").innerHTML = `<div><b>${PRODUCTS.length}</b>Packs</div><div><b>450+</b>Serum presets</div>${BF_PILE && typeof BUNDLE10 !== "undefined" && BUNDLE10 ? `<div><b>${show(BUNDLE_OFF)}</b>Off 10 packs</div>` : `<div><b>50%</b>The bundle</div>`}`;
  const FS = FREE_CARDS ? PRODUCTS.filter((p) => hasFree(p) && (typeof FREE_ONE === "undefined" || !FREE_ONE || isFreeHost(p))) : [];
  const chips = [["all", "All", PRODUCTS.length + FS.length], ...(FS.length ? [["free", "Free", FS.length]] : []), ...WORLDS.map((w) => [w.id, w.name, PRODUCTS.filter((p) => p.world === w.id).length]), ["drums", "Drums", PRODUCTS.filter((p) => p.type === "drums").length], ...(CARDS_CHIP && PRODUCTS.some((p) => p.look === "card") ? [["cards", "Cards", PRODUCTS.filter((p) => p.look === "card").length]] : [])];
  if (RECENT_CHIP && typeof ADMIN !== "undefined" && ADMIN) chips.splice(FS.length ? 2 : 1, 0, ["recent", "Recent", PRODUCTS.filter((p) => p.edited).length]);
  const chipHTML = chips.map(([id, n, c]) => `<button class="ch${id === "all" ? " on" : ""}" data-f="${id}">${esc(n)}<span class="n">${c}</span></button>`).join("");
  $("#chips").innerHTML = SEARCH_BAR ? `<div class="chs">${chipHTML}</div><label class="srch"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l4 4"/></svg><input id="srchIn" type="search" placeholder="SEARCH" autocomplete="off" spellcheck="false"></label>` : chipHTML;
  if (SEARCH_BAR) { const wn = Object.fromEntries(WORLDS.map((w) => [w.id, w.name])); SRCH_IX = {}; SRCH_IX2 = {}; PRODUCTS.forEach((p) => { SRCH_IX[p.id] = [p.name, wn[p.world], p.type, p.look].join(" ").toLowerCase(); SRCH_IX2[p.id] = [SRCH_IX[p.id], p.sub, p.stamp, p.blurb, ...(p.sounds || []).map((x) => x.name)].join(" ").toLowerCase(); }); }
  $("#worlds").classList.add("allg");
  $("#worlds").innerHTML = WORLDS.map((w) => {
    const ps = PRODUCTS.filter((p) => p.world === w.id);
    return `<section class="world" id="${w.id}" data-world="${w.id}">
      <div class="wh"><h2 class="${w.font === "sans" ? "sans" : w.font === "it" ? "it" : ""}">${esc(w.name)}</h2><span class="vibe">${esc(w.vibe)}</span></div>
      <div class="grid">${ps.map(card).join("")}${FREE_CARDS ? ps.filter((p) => FS.includes(p)).map(freeCard).join("") : ""}</div></section>`;
  }).join("");
}
/* ---------- 3D stacked bundle (Eman 18 Nov: "stacked", "a bit in 3d", "you can scroll them") ----------
   Real covers only, loops round forever. Wheel, drag, swipe, arrows and keys all move it.
   CD art later: give a pack  "cd": "img/cd-<id>.png"  in products.json and the stack uses it instead of the cover. */
const BUNDLE_FLOW_OLD = false;   // true = old 4x3 collage + phone strip
const BF_FIT = true;
const BF_3D = false;   // Eman 19 Nov 23:56: CDs really slide behind each other (3D depth sorting, no z-index jump at the midpoint). false = z-index layers
const BF_JUMP = true;   // Eman 20 Nov 18:58: back to the ORIGINAL stack, the front CD swaps to the next in one frame (z-index layers). No reflections. false = the 3D depth flip below
const BF_SPREAD = !BF_JUMP;   // Eman 20 Nov 00:07: on a flip the front CD swings out and goes behind, the next comes in front, never cutting through each other. false = straight slide
const BF_DEPTH = !BF_JUMP;   // Eman 20 Nov 00:07: real 3D. The front CD sinks back and slides BEHIND while the next one comes out IN FRONT of it (true depth, no z-index swap, no cut line). Overrides BF_3D/BF_SPREAD. false = previous stack
const BF_SPEED = 2;    // Eman 19 Nov 23:56: stack moves 2x faster (drift, settle, drag). 1 = old speed   // false = old stack (4+ neighbours, faded edges)
const bfArt = (p) => abs(p.cd || p.cover);
/* BF_PILE (Eman 20 Nov 19:55): the hero bundle is a STILL pile of CDs from the 10-pack mix lying on each other. No moving, no reflections.
   Hover = soft purple glow fades in; press = open the bundle. false = the moving stack (bflow) */
const BF_PILE = true;
const PILE = [[-36, -10, -10], [34, -12, 8], [-24, 12, -5], [26, 10, 6], [-8, -16, 3], [12, 6, -3], [0, 0, 1]];   // x %, y %, rotate deg; the last one lies on top in the middle
/* HERO_OFFERS (Eman 20 Nov 20:00): the hero pile switches calmly (crossfade every 7 s, pauses on hover) between PICK 10 · SAVE 100 and the 3-packs. false = only the 10 bundle */
const HERO_OFFERS = true;
const PILE3 = [[-30, -6, -8], [28, -8, 7], [0, 6, 1]];
function heroOffers() {
  const o = [{ k: "The bundle", c: "Pick 10 packs", off: `<b>${show(BUNDLE_OFF)}</b><span>OFF</span>`, href: "/bundle", go: "Pick 10 packs", nm: `<b>Pick 10 packs</b><small>Any mix · save ${show(BUNDLE_OFF)}</small>`, ids: bundleMix().slice(0, PILE.length), lay: PILE }];
  if (HERO_OFFERS && typeof trios === "function") trios().slice(0, 1).forEach((t) => { const ids = t.ids.slice(), f = ids.findIndex((id) => byId(id).price === t.free); if (f >= 0) ids.push(ids.splice(f, 1)[0]);
    o.push({ k: "The 3-pack", c: t.name, off: `<b>1</b><span>FREE</span>`, href: "/bundle?trio=" + encodeURIComponent(t.world), go: "Get the 3-pack", nm: `<b>${esc(t.name)} · 3 packs</b><small>Buy 2, get 1 free · ${show(t.price)} <s>${show(t.full)}</s></small>`, ids, lay: PILE3, free: true }); });
  return o.length > 1 ? [o[1]] : o;   // 24 Nov preview (Eman): only the 3-pack slide for now, no rotation
}
function bpile(root) {
  const st = root.querySelector(".bf-st"); if (!st) return; cancelAnimationFrame(root._auto); clearInterval(root._offT);
  root.classList.add("bf-pile"); st.removeAttribute("tabindex"); st.setAttribute("aria-label", "Bundle offers");
  const O = heroOffers(); let k = 0;
  const pileHTML = (o) => { const ps = o.ids.map(byId).filter(Boolean); return `<a class="bf-pl" href="${o.href}" aria-label="${esc(o.c)}">${ps.map((p, i) => { const l = o.lay[o.lay.length - ps.length + i]; return `<span class="bf-pi${o.free && i === ps.length - 1 ? " free" : ""}" style="--x:${l[0]}%;--y:${l[1]}%;--r:${l[2]}deg;z-index:${i + 1}"><img src="${esc(bfArt(p))}" alt="" draggable="false">${o.free && i === ps.length - 1 ? `<em class="bf-fr">Free</em>` : ""}</span>`; }).join("")}</a>`; };
  const show1 = (o, fade) => {
    const set = () => { st.innerHTML = pileHTML(o);
      const kk = root.querySelector(".bf-k"); if (kk) { kk.href = o.href; kk.innerHTML = `${esc(o.k)}<small class="bf-c">${esc(o.c)}</small>`; }
      const of = root.querySelector(".bf-off"); if (of) { of.href = o.href; of.innerHTML = o.off; }
      const go = root.querySelector(".bf-go"); if (go) { go.href = o.href; go.textContent = o.go; }
      const nm = root.querySelector(".bf-nm"); if (nm) nm.innerHTML = o.nm; root.classList.remove("bf-fade"); };
    if (!fade) return set(); root.classList.add("bf-fade"); setTimeout(set, 450);
  };
  show1(O[0], false);
  if (O.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) root._offT = setInterval(() => { if (root.matches(":hover") || document.hidden) return; k = (k + 1) % O.length; show1(O[k], true); }, 7000);
}
function bflow(root) {
  const st = root.querySelector(".bf-st"), ps = PRODUCTS.filter((p) => !p.freebie), n = ps.length; if (!st || !n) return;
  root.querySelector(".bf-c").textContent = `all ${n} packs`;
  st.innerHTML = ps.map((p, i) => `<a class="bf-i${p.cd ? " cd" : ""}" href="/bundle" data-i="${i}" draggable="false"><img src="${esc(bfArt(p))}" alt="${esc(p.name)}" draggable="false"${i > 6 && i < n - 6 ? ' loading="lazy"' : ""}></a>`).join("");
  if (BF_3D && !BF_DEPTH) st.style.transformStyle = "preserve-3d";
  let box3 = st; if (BF_DEPTH) { box3 = document.createElement("div"); box3.className = "bf-3d"; box3.append(...st.children); st.appendChild(box3); root.classList.add("bf-deep"); }
  const items = [...box3.children], nm = root.querySelector(".bf-nm"), cnt = root.querySelector(".bf-n");
  let anc = Math.round(root._pos || 0);   // BF_DEPTH: the CD that was last at the front. While moving away from it, it is the one that sinks behind
  let pos = root._pos || 0, tgt = pos, raf = 0, drag = null, moved = false, idle = 0;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = (d) => ((d % n) + n + n / 2) % n - n / 2;
  function paint() {
    const w = st.clientWidth, sz = items[0].offsetWidth || 200;
    let gap = Math.min(sz * 0.36, w * 0.17), side = 4.6;
    if (BF_FIT) {   // Eman 19 Nov: no fade, every CD fully inside the box. Fewer neighbours + tighter spacing until the outer case fits
      side = 2; const room = w / 2 - 6, half = sz * 0.5 * 0.62;   // a turned case (52deg) shows ~62% of its width
      const need = (k, g) => (k >= 1 ? sz * 0.52 : 0) + Math.max(0, k - 1) * g + half;
      if (need(2, gap) > room) gap = Math.max(sz * 0.1, room - sz * 0.52 - half);
      if (need(2, gap) > room) side = 1;
    }
    if (BF_DEPTH) { while (pos - anc >= 1) anc++; while (anc - pos >= 1) anc--; }
    const dir = Math.sign(pos - anc);   // +1 moving to the next CD, -1 to the previous
    items.forEach((el, i) => {
      const d = wrap(i - pos), a = Math.abs(d), sg = Math.sign(d) || 0, c = Math.min(a, 1);
      const x = sg * (c * sz * 0.52 + Math.max(0, a - 1) * gap + (BF_SPREAD ? Math.sin(Math.PI * c) * sz * 0.38 : 0));   // spread: mid-flip the two CDs swing apart so one passes behind the other with no cut
      if (BF_DEPTH) {   // incoming CD rises toward you, outgoing CD sinks; mid-flip they are a full case-depth apart, so the planes never meet
        const b = Math.sin(Math.PI * c) * (c < 1 ? 1 : 0), inc = sg === dir ? 1 : -1, lift = b * inc * dir * dir;
        const xd = sg * (c * sz * 0.52 + Math.max(0, a - 1) * gap) * (1 - b * 0.18);   // Eman 20 Nov 00:29: stay tight and overlapped mid-flip (deck shuffle), no gap between them
        const z = -Math.min(a, 6) * 110 - c * 60 + lift * sz * 0.2;
        const ry = -sg * c * 52 * (lift > 0 ? 1 - b * 0.3 : 1);
        el.style.transform = `translate(-50%,-50%) translate3d(${xd.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg) scale(${(1 - (lift < 0 ? b * 0.05 : 0)).toFixed(3)})`;
        el.style.zIndex = "";
      } else
      el.style.transform = `translate(-50%,-50%) translateX(${x.toFixed(1)}px) translateZ(${(-Math.min(a, 6) * 110 - c * 60).toFixed(1)}px) rotateY(${(-sg * c * 52).toFixed(1)}deg)`;
      if (!BF_DEPTH) el.style.zIndex = BF_3D ? "" : 200 - Math.round(a * 10);
      el.style.opacity = BF_FIT ? (a > side + 0.5 ? 0 : Math.min(1, side + 0.5 - a) * 2 > 1 ? 1 : Math.min(1, (side + 0.5 - a) * 2)) : a > 4.6 ? 0 : Math.min(1, 4.6 - a);
      if (BF_DEPTH) el.style.setProperty("--dim", (Math.min(a, 3) * 0.17).toFixed(3));   // shade layer, not a filter: a filter on the CD would flatten the 3D and kill the frost
      else el.style.filter = `brightness(${(1 - Math.min(a, 3) * 0.17).toFixed(2)})`;
      el.classList.toggle("on", a < 0.5); el.tabIndex = a < 0.5 ? 0 : -1;
    });
    const k = ((Math.round(pos) % n) + n) % n, p = ps[k];
    nm.innerHTML = `<b>${esc(p.name)}</b><small>${esc(/\d/.test(p.count) ? (p.type === "drums" ? "Drum kit · " : "Serum · ") + p.count : p.type === "drums" ? "Drum kit" : "Serum presets")}</small>`;
    cnt.textContent = `${String(k + 1).padStart(2, "0")} / ${n}`;
    if (window.ckSfx) { const r = Math.round(pos); if (root._lk != null && r !== root._lk && Date.now() - idle < 2600) ckSfx("step", r > root._lk ? 1 : -1); root._lk = r; }   // one detent per CD while someone scrolls (not the slow drift)
    root._pos = pos;
  }
  root._at = (p) => { idle = Date.now() + 864e5; pos = tgt = p; cancelAnimationFrame(raf); raf = 0; paint(); };   // test hook (screenshots of a frozen mid-flip)
  function loop() { const d = tgt - pos; pos = Math.abs(d) < 0.002 ? tgt : pos + d * Math.min(0.5, 0.16 * BF_SPEED); paint(); raf = pos !== tgt ? requestAnimationFrame(loop) : 0; if (!raf && window.ckSfx && Date.now() - idle < 2600 && Number.isInteger(pos)) ckSfx("land"); }
  const go = (t) => { tgt = t; if (!raf) raf = requestAnimationFrame(loop); };
  const poke = () => { idle = Date.now(); };
  root.querySelectorAll(".bf-ar").forEach((b) => b.onclick = () => { poke(); if (window.ckSfx) ckSfx("button", +b.dataset.bf); go(Math.round(tgt) + +b.dataset.bf); });
  const bb = root.querySelector(".bf-bot"); if (bb && window.UI_SFX !== false && !bb.querySelector(".sfxm")) { const m = document.createElement("button"); m.className = "sfxm" + (muted() ? " off" : ""); m.setAttribute("aria-label", "UI sounds on or off"); m.setAttribute("aria-pressed", String(!muted())); m.innerHTML = '<svg viewBox="0 0 16 16"><path d="M2 6h3l4-3v10l-4-3H2z"/><path class="w" d="M11 5.5c1 .8 1 4.2 0 5M12.8 4c2 1.6 2 6.4 0 8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'; const n2 = bb.querySelector(".bf-n"); (n2 ? n2.parentNode.insertBefore(m, n2.nextSibling.nextSibling) : bb.appendChild(m)); }
  st.onkeydown = (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); poke(); go(Math.round(tgt) + (e.key === "ArrowRight" ? 1 : -1)); } };
  let wt = 0;
  st.addEventListener("wheel", (e) => { const v = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!v) return; e.preventDefault(); poke();
    go(tgt + Math.max(-1, Math.min(1, v / 110))); clearTimeout(wt); wt = setTimeout(() => go(Math.round(tgt)), 140); }, { passive: false });
  st.onpointerdown = (e) => { if (e.button) return; drag = { x: e.clientX, p: pos, id: e.pointerId }; moved = false; poke(); };
  st.onpointermove = (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (!moved && Math.abs(dx) > 6) { moved = true; st.setPointerCapture(drag.id); st.classList.add("drag"); }
    if (moved) { pos = tgt = drag.p - dx * BF_SPEED / ((items[0].offsetWidth || 200) * 0.55); cancelAnimationFrame(raf); raf = 0; paint(); } };
  st.onpointerup = st.onpointercancel = () => { if (!drag) return; drag = null; st.classList.remove("drag"); if (moved) go(Math.round(pos)); poke(); };
  st.onclick = (e) => { const a = e.target.closest(".bf-i"); if (!a) return; if (moved) { e.preventDefault(); moved = false; return; }
    const d = wrap(+a.dataset.i - Math.round(pos)); if (Math.round(d)) { e.preventDefault(); poke(); go(Math.round(tgt) + Math.round(d)); } };
  st.onpointerenter = poke;
  // slow drift by itself (Eman 19 Nov: "slowly move by itself"); pauses while someone touches it, picks up again after 2.5 s
  cancelAnimationFrame(root._auto); let last = 0;
  const drift = (t) => { const dt = last ? Math.min(64, t - last) : 0; last = t;
    if (!raf && !drag && Date.now() - idle > 2500 && !document.hidden && root.offsetParent) { pos += dt * 0.00018 * BF_SPEED; tgt = pos; paint(); }
    root._auto = requestAnimationFrame(drift); };
  if (!still) root._auto = requestAnimationFrame(drift);
  if (!root._rs) { root._rs = 1; addEventListener("resize", paint); }
  paint();
}

/* FREE SAMPLE cards (Eman 20 Nov): every pack's free sample shows as its own pack card, under ALL too, plus a FREE chip that shows only them.
   Cover = the blank CD with marker text + stickers (img/cdfree/<id>.webp, frozen v10 blanks); paid packs keep their own (printed) disc.
   Click = the free download / email page /get/<id>. FREE_CARDS = false hides them all again. */
const FREE_CARDS = true;
const hasFree = (p) => !p.freebie && (p.sounds || []).length > 0;
const freeCov = (p) => p.freeCover ? abs(p.freeCover) : "/img/" + (FREE_BARE ? "cdbare" : "cdfree") + "/" + encodeURIComponent(p.id) + (typeof CD_SMALL !== "undefined" && CD_SMALL ? "-600" : "") + ".webp?v=1";
function freeCard(p) {
  const one = typeof FREE_ONE !== "undefined" && FREE_ONE, u = "/get/" + encodeURIComponent(p.id) + QS, n = one ? worldMix(p.world).length : Math.min(p.sample && p.sample.length ? p.sample.length : p.freeCount || 8, p.sounds.length), np = one ? fpPacks(p.world).length : 1;
  return `<article class="card fcard" data-type="${p.type}" data-fs="1" id="f-${p.id}">
    <a class="cv" href="${u}"><span class="pq"><img src="${esc(freeCov(p))}" alt="${esc(one ? freeName(p) : p.name)} free sample cover" loading="lazy" onerror="this.onerror=null;this.src='${esc(abs(p.cover))}'"><i class="gl"></i></span><span class="stamp">${(one ? freeLab(p) : freeLabel(p)).toUpperCase()}</span><span class="badge fbadge">FREE</span></a>
    <div class="cb">
      <a class="ph" href="${u}"><div><div class="pn">${esc(one ? freeName(p) : p.name)} <span class="fsn">(${(one ? freeLab(p) : freeLabel(p)).toUpperCase()})</span></div><div class="pf">${one ? `A taste of all ${np} pack${np > 1 ? "s" : ""}` : esc(p.sub)} · ${n} sounds</div></div><div class="price fpr">FREE<small class="ps">for your email</small></div></a>
      <p class="pi">${one ? `${n} sounds from every ${esc(freeName(p))} pack, synths and drums. Free download.` : `Try ${n} sounds from ${esc(p.name)} before you buy. Free download.`}</p>
      <div class="buy"><a class="btn acid" href="${u}">Get it free</a></div>
    </div></article>`;
}

function card(p) {
  const u = packUrl(p.id);
  return `<article class="card" data-type="${p.type}"${p.look === "card" ? ` data-look="card"` : ""} id="p-${p.id}">
    <a class="cv" href="${u}"><span class="pq"><img src="${esc(abs(p.cover))}" alt="${esc(p.name)} cover" loading="lazy"><i class="gl"></i></span><span class="stamp">${esc(p.stamp)}</span>${p.isNew ? '<span class="badge">NEW</span>' : ""}</a>
    <div class="cb">
      <a class="ph" href="${u}"><div><div class="pn">${esc(p.name)}</div><div class="pf">${esc(p.sub)} · ${esc(p.count)}</div></div><div class="price">${show(p.price)}<small class="ps">${perSound(p)}</small></div></a>
      <p class="pi">${esc(p.blurb)}</p>
      <div class="buy"><a class="btn" href="${u}">View pack</a><button class="btn acid" data-add="${p.id}">Add to cart</button></div>
    </div></article>`;
}

let SRCH_IX = {}, SRCH_IX2 = {};   // pack name/genre first; blurb + sound names only when no pack name matches
function srchRun() {   // SEARCH_BAR: every word must match; shows hits in one grid, clears back to ALL
  const inp = $("#srchIn"); if (!inp) return; const q = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (q.length) document.querySelectorAll(".ch").forEach((c) => c.classList.toggle("on", c.dataset.f === "all"));
  $("#worlds").classList.add("allg");
  const hit = (ix) => (id) => q.every((k) => (ix[id] || "").includes(k)), IX = Object.keys(SRCH_IX).some(hit(SRCH_IX)) ? SRCH_IX : SRCH_IX2;
  document.querySelectorAll(".world").forEach((w) => { const cards = [...w.querySelectorAll(".card")];
    cards.forEach((c) => { c.style.order = ""; const id = (c.id || "").replace(/^[pf]-/, ""), t = IX[id] || ""; c.hidden = q.length ? !q.every((k) => t.includes(k)) : false; });
    w.hidden = q.length ? !cards.some((c) => !c.hidden) : false; });
  const no = $("#srchNo"); if (no) no.remove();
  if (q.length && !document.querySelector("#worlds .card:not([hidden])")) $("#worlds").insertAdjacentHTML("afterend", `<p id="srchNo" class="srno">NO MATCH</p>`);
}
if (SEARCH_BAR) { document.addEventListener("input", (e) => { if (e.target.id === "srchIn") srchRun(); }); document.addEventListener("keydown", (e) => { if (e.target.id === "srchIn" && e.key === "Escape") { e.target.value = ""; srchRun(); } }); }
document.addEventListener("click", (e) => {
  if (shopClick(e)) return;
  const nl = e.target.closest('a.nl[href^="#"]'), wc = nl && document.querySelector(`.ch[data-f="${nl.getAttribute("href").slice(1)}"]`);
  if (wc) { e.preventDefault(); wc.click(); $("#packs").scrollIntoView({ behavior: "smooth" }); return; }   // nav genre links pick that genre
  const fc = FREE_CARDS && e.target.closest("[data-fchip]"), fch = fc && document.querySelector('.ch[data-f="free"]');
  if (fch) { e.preventDefault(); fch.click(); $("#packs").scrollIntoView({ behavior: "smooth" }); return; }   // hero FREE SAMPLES button shows the free cards
  const ch = e.target.closest(".ch");
  if (ch) {
    document.querySelectorAll(".ch").forEach((c) => c.classList.toggle("on", c === ch));
    const f = ch.dataset.f;
    if (SEARCH_BAR && $("#srchIn") && $("#srchIn").value) { $("#srchIn").value = ""; const no = $("#srchNo"); if (no) no.remove(); }
    $("#worlds").classList.toggle("allg", f === "all" || f === "recent");
    if (RECENT_CHIP) { const rk = PRODUCTS.filter((p) => p.edited).sort((a, b) => b.edited - a.edited).map((p) => p.id);
      document.querySelectorAll("#worlds .card").forEach((c) => { const i = rk.indexOf((c.id || "").replace(/^p-/, "")); c.style.order = f === "recent" ? (c.dataset.fs ? 9999 : i < 0 ? 5000 : i) : ""; }); }
    document.querySelectorAll(".world").forEach((w) => {
      const cards = [...w.querySelectorAll(".card")];
      cards.forEach((c) => c.hidden = f === "recent" ? !!c.dataset.fs : f === "cards" ? c.dataset.look !== "card" : f === "drums" ? c.dataset.type !== "drums" || !!c.dataset.fs : f === "free" ? !c.dataset.fs : false);
      w.hidden = f === "all" || f === "recent" ? false : f === "drums" || f === "free" || f === "cards" ? !cards.some((c) => !c.hidden) : w.dataset.world !== f;
    });
  }
});

document.addEventListener("ck-cur", () => { render(); paintCart(); });
loadShop().then(() => {
  render(); paintCart();
  if (location.hash.startsWith("#pack/")) { location.replace(packUrl(location.hash.slice(6))); return; }
  if (location.hash === "#cart" && cart.length) openCart();
  else if (location.hash.length > 1) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
});
