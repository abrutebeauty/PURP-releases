/* COREKULT shop core: data, cart, 3 for 2, cart dropdown, free samples, sound previews with waveforms.
   Used by the shop page, pack pages and the checkout page. */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CD_VER = "23";
const CD_HIT_CASE = true;   // Eman 19 Nov: tilt/sheen only while the mouse is over the visible case. false = whole card area
const BIG_TITLES = true;   // Eman 19 Nov: bigger pack titles everywhere (html.bigt). false = old sizes
const STALE_RELOAD = true;   // 19 Nov: a tab left open across a deploy reloads itself when you come back to it (old covers/names seen in a stale tab). false = never
document.documentElement.classList.toggle("bigt", BIG_TITLES); document.documentElement.classList.add("bffit");
if (STALE_RELOAD) {
  const mine = (document.querySelector('script[src*="shop.js?v="]') || {}).src || ""; let last = Date.now();
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden || Date.now() - last < 60000 || !mine) return; last = Date.now();
    try { const h = await (await fetch(location.pathname, { cache: "no-store" })).text(); const m = h.match(/shop\.js\?v=\d+/);
      const ed = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (m && !mine.includes(m[0]) && !ed) location.reload(); } catch (e) {}
  });
}
const SONG_GROUP = true;   // 19 Nov: "SONG <song> <type>" sounds get their own "Song sounds" section at the top of the pack page (hidden = admin-only until Eman OKs song titles). false = old grouping   // Eman 19 Nov: all CDs same height (square cases scaled down); bumps the browser cache of /img/cd/*.webp. "" = old behaviour
const TYPE_CHIP = true;   // Eman 20 Nov: every sample tile shows a small type chip (808, LEAD, KICK...) before its name. SONG sounds show their last word (SYNTH). false = no chips
const SEC_ORDER = { "esskid-core-i": ["SONG", "LEAD", "BELL", "ARP", "PLUCK", "KEYS", "PAD", "STAB", "BASS", "808", "FX"] };   // Eman 20 Nov: melodies first, 808s/bass after. Packs not listed keep the old order
const TYPE_KEYS = new Set("808 BASS LEAD BELL ARP PLUCK KEYS PAD STAB FX SYNTH CHORD FLUTE TEXTURE VOX SAW CHIP KICK SNARE CLAP HAT OPEN CRASH PERC LOOP GUITAR CHOIR BRASS ORGAN PIANO STRINGS RIM TOM SHAKER RIDE CYM FILL DRUM".split(" "));
/* CAT_ICONS (Eman 21 Nov 15:11): every category tag has a colour family + its own small icon (same chunky style as the skull), the same on every pack.
   Families: bass red, leads/keys yellow, pads/textures blue, plucks/arps green, FX/vox pink, drums orange, other purple. Admin-made categories live in packs.cats {KEY:{f,i}}. false = old purple tags */
/* CARD_ART test (Eman 21 Nov 15:17): frosted pack art (no text) behind each sound card's waveform. Only packs listed here. {} = off */
const CARD_ART = {};   // Eman 21 Nov 17:11: did not like it, off. Old test: { "crystal-core-i": ["/img/crystal-core-1.jpg", "/img/crystal-core-2-v2.jpg", "/img/crystal-core-drums.jpg", "/img/crystal-core-drums-v3.jpg"] }
/* SEC_OPEN trial (Eman 21 Nov 17:35): packs listed here get stronger section colours, rounded section corners, and no box around each sound: the waveform sits straight on the colour (dark, like a cut-out). [] = off */
const SEC_OPEN = [];   // Eman 21 Nov 20:25: replaced by SEC_CLEAN on Crystal Core I. Old list: ["crystal-core-i"]
/* SEC_CLEAN trial (Eman 21 Nov 20:25): packs listed here get no coloured section background, only the category title in a coloured box;
   sound cards stay default dark with purple waves; no PLAY button. TAP_PLAY on the same packs: tap a sound = play, tap again = stop (pause),
   next tap resumes where it stopped, after the end it starts from the beginning. No click-to-seek. [] = off */
const SEC_CLEAN = ["crystal-core-i"];
const tapResume = new Map();   // TAP_PLAY: sound src -> where it was paused (0..1)
const DUP_TAG = true;   // Eman 22 Nov: admin-only tag on sounds that exist in 2 packs (e.g. DREAMCORE + LIMINAL), shows the twin's pack + name. false = hidden
const AN_EDIT = true;   // Eman 21 Nov 17:13: double-click a comment bubble to edit it, × removes it. false = read-only bubble
const CAT_ICONS = true;
const SKULL_AFTER = true;   // Eman 21 Nov: the red skull sits after the sound's full name. false = before
const CAT_FAM = {"bass": "#ff5c6c", "lead": "#E4FF3A", "pad": "#4dabf7", "pluck": "#3ddc84", "fx": "#ff6bd5", "drum": "#ff9f43", "other": "#8b6cf6"};
const CAT_ICON = {"speaker": "<path fill-rule=\"evenodd\" d=\"M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z\"/>", "wave": "<path d=\"M1 9.2c1.6-5.6 4-5.6 5.5-.4 1.3 4.6 3.5 4.6 5-.2.5-1.6 1.4-2.8 3.5-2.8v2.6c-.9 0-1.3.5-1.7 1.8-2 6.6-6.6 6.6-8.6-.4-.8-2.8-1.6-2.8-2.4.2L1 9.2Z\"/>", "bolt": "<path d=\"M9.6 1 3 9.2h4.2L6.2 15 13 6.6H8.7L9.6 1Z\"/>", "saw": "<path d=\"M1 13.2 7 4v5.6L13 3v10.2h2V15H1v-1.8Zm2.6-.1H5V9.2l-1.4 3.9Zm5 0H11V8.4l-2.4 2.9v1.8Z\"/>", "knob": "<path fill-rule=\"evenodd\" d=\"M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM7 3.4v4.8h2V3.4H7Z\"/>", "keys": "<path fill-rule=\"evenodd\" d=\"M1 2h14v12H1V2Zm3 1.6v5h1.6v-5H4Zm3.2 0v5h1.6v-5H7.2Zm3.2 0v5H12v-5h-1.6ZM5 10.2V12.4h.6v-2.2H5Zm4.7 0v2.2h.6v-2.2h-.6Z\"/>", "cloud": "<path d=\"M4.4 13.5a3.4 3.4 0 0 1-.5-6.8 4.6 4.6 0 0 1 8.8-.9 3.9 3.9 0 0 1-.6 7.7H4.4Z\"/>", "grain": "<path d=\"M2 2h3v3H2zM7 3h2v2H7zM11 2h3v3h-3zM3 7h2v2H3zM6.5 6.5h3v3h-3zM11 7h2v2h-2zM2 11h3v3H2zM7 11h2v2H7zM11 11h3v3h-3z\"/>", "drone": "<path d=\"M1 3.6c2.3-1.4 4.4-1.4 7 0s4.7 1.4 7 0v2.2c-2.3 1.4-4.4 1.4-7 0s-4.7-1.4-7 0V3.6Zm0 5c2.3-1.4 4.4-1.4 7 0s4.7 1.4 7 0v2.2c-2.3 1.4-4.4 1.4-7 0s-4.7-1.4-7 0V8.6Z\"/>", "mic": "<path fill-rule=\"evenodd\" d=\"M5 1h6v8.2a3 3 0 0 1-6 0V1Zm-2 7h1.6v1.2a3.4 3.4 0 0 0 6.8 0V8H13v1.2a5 5 0 0 1-4.2 4.9V15H7.2v-.9A5 5 0 0 1 3 9.2V8Z\"/>", "bell": "<path d=\"M8 1c.6 0 1 .4 1 1v.6a4.6 4.6 0 0 1 3.6 4.5v3.4L14 12v1.4H2V12l1.4-1.5V7.1A4.6 4.6 0 0 1 7 2.6V2c0-.6.4-1 1-1Zm-2 13.2h4a2 2 0 0 1-4 0Z\"/>", "pick": "<path d=\"M8 1.4c3.8 0 6.6 1.2 6.6 3.6C14.6 9 10.4 14.6 8 14.6S1.4 9 1.4 5C1.4 2.6 4.2 1.4 8 1.4Z\"/>", "stairs": "<path d=\"M1 15v-3.4h3.4V8.2h3.4V4.8h3.4V1.4H15V15H1Z\"/>", "flute": "<path fill-rule=\"evenodd\" d=\"M1 6h14v4H1V6Zm3 1.2v1.6h1.6V7.2H4Zm3.2 0v1.6h1.6V7.2H7.2Zm3.2 0v1.6H12V7.2h-1.6Z\"/>", "burst": "<path d=\"m8 1 1.6 4.2L14 4 11.2 7.6 15 10l-4.4.4L10.8 15 8 11.6 5.2 15l.2-4.6L1 10l3.8-2.4L2 4l4.4 1.2L8 1Z\"/>", "swirl": "<path d=\"M8 1.2a6.8 6.8 0 0 1 6.8 6.8h-2.2A4.6 4.6 0 0 0 8 3.4a3.4 3.4 0 0 0-3.4 3.4A2.2 2.2 0 0 0 6.8 9a1 1 0 0 0 1-1h2.2a3.2 3.2 0 0 1-3.2 3.2 4.4 4.4 0 0 1-4.4-4.4A5.6 5.6 0 0 1 8 1.2Zm6.8 8A6.8 6.8 0 0 1 4 14.2l1.2-1.8a4.6 4.6 0 0 0 7.4-3.2h2.2Z\"/>", "dagger": "<path d=\"M13.6 1 15 2.4l-1 4.4-5.6 5.6-1.4-1.4L3.4 14.6 1.4 12.6 5 9l-1.4-1.4L9.2 2 13.6 1Z\"/>", "pixel": "<path d=\"M2 3h4v2H2zM10 3h4v2h-4zM1 5h14v4H1zM3 9h10v2H3zM5 11h6v2H5zM7 13h2v2H7z\"/>", "note": "<path d=\"M6 2.4 14 1v9.6a2.4 2.4 0 1 1-1.8-2.3V4.4L7.8 5.2v7.4A2.4 2.4 0 1 1 6 10.3V2.4Z\"/>", "drum": "<path fill-rule=\"evenodd\" d=\"M8 1.6c3.6 0 6.6 1.3 6.6 3v6.8c0 1.7-3 3-6.6 3s-6.6-1.3-6.6-3V4.6c0-1.7 3-3 6.6-3Zm0 1.8C5.2 3.4 3.4 4.1 3.4 4.6S5.2 5.8 8 5.8s4.6-.7 4.6-1.2S10.8 3.4 8 3.4Z\"/>", "snare": "<path fill-rule=\"evenodd\" d=\"M1.4 6.4C1.4 5 4.4 4 8 4s6.6 1 6.6 2.4v5.2C14.6 13 11.6 14 8 14s-6.6-1-6.6-2.4V6.4Zm2.2 2.3v2.8l1.6.4V9.1l-1.6-.4Zm3.6.8v2.8h1.6V9.5H7.2Zm3.6-.4v2.8l1.6-.4V8.7l-1.6.4ZM2.6 1l5 3H5.4L1.8 2l.8-1Zm10.8 0 .8 1-3.6 2H8.4l5-3Z\"/>", "hat": "<path d=\"M1 5.2C1 4.2 4.1 3.4 8 3.4s7 .8 7 1.8S11.9 7 8 7 1 6.2 1 5.2Zm0 3.2C1 7.4 4.1 6.6 8 6.6s7 .8 7 1.8-3.1 1.8-7 1.8-7-.8-7-1.8ZM7.2 1h1.6v2.4H7.2V1Zm0 9.4h1.6V15H7.2v-4.6Z\"/>", "cymbal": "<path d=\"M1 6.6C1 5.4 4.1 4.4 8 4.4s7 1 7 2.2S11.9 8.8 8 8.8 1 7.8 1 6.6ZM7.2 1h1.6v3.2H7.2V1Zm0 7.6h1.6V15H7.2V8.6Z\"/>", "clap": "<path d=\"M5.4 1.6 9 4.4 5 12.8c-.6 1.4-2.2 2-3.6 1.4L1 14l4.4-12.4Zm5.2 0L15 14l-.4.2c-1.4.6-3 0-3.6-1.4L8.6 7.6l2-6Z\"/>", "triangle": "<path fill-rule=\"evenodd\" d=\"M8 1.4 15 14H1L8 1.4Zm0 4.4L4.6 12h6.8L8 5.8Z\"/>", "shaker": "<path d=\"M10.2 1.6a3.2 3.2 0 0 1 4.2 4.2L8 12.2l-4.2-4.2 6.4-6.4ZM3 9.2 6.8 13l-2.4 2.4L.6 11.6 3 9.2Z\"/>", "loop": "<path d=\"M8 1.6a6.4 6.4 0 0 1 6.2 4.8H16l-3 3.4-3-3.4h1.8A4.2 4.2 0 0 0 3.8 8H1.6A6.4 6.4 0 0 1 8 1.6Zm-5 4.6L6 9.6H4.2A4.2 4.2 0 0 0 12.2 8h2.2a6.4 6.4 0 0 1-12.6 1.6H0l3-3.4Z\"/>", "dot": "<path d=\"M3 3h10v10H3z\"/>"};
const CAT_DEF = {"808": ["bass", "speaker"], "BASS": ["bass", "wave"], "SUB": ["bass", "speaker"], "REESE": ["bass", "wave"], "LEAD": ["lead", "bolt"], "SAW": ["lead", "saw"], "SYNTH": ["lead", "knob"], "STAB": ["lead", "dagger"], "HOOVER": ["lead", "swirl"], "CHIP": ["lead", "pixel"], "KEYS": ["lead", "keys"], "CHORD": ["lead", "keys"], "PIANO": ["lead", "keys"], "ORGAN": ["lead", "keys"], "BRASS": ["lead", "bolt"], "PAD": ["pad", "cloud"], "TEXTURE": ["pad", "grain"], "DRONE": ["pad", "drone"], "STRINGS": ["pad", "drone"], "PLUCK": ["pluck", "pick"], "ARP": ["pluck", "stairs"], "BELL": ["pluck", "bell"], "CHIME": ["pluck", "bell"], "FLUTE": ["pluck", "flute"], "GUITAR": ["pluck", "pick"], "FX": ["fx", "burst"], "VOX": ["fx", "mic"], "CHOIR": ["fx", "mic"], "FOLEY": ["fx", "grain"], "KICK": ["drum", "drum"], "SNARE": ["drum", "snare"], "HAT": ["drum", "hat"], "OPEN": ["drum", "cymbal"], "CLAP": ["drum", "clap"], "PERC": ["drum", "triangle"], "RIM": ["drum", "snare"], "CRASH": ["drum", "cymbal"], "CYMBAL": ["drum", "cymbal"], "CYM": ["drum", "cymbal"], "RIDE": ["drum", "cymbal"], "SHAKER": ["drum", "shaker"], "ROLL": ["drum", "snare"], "TOM": ["drum", "drum"], "FILL": ["drum", "drum"], "DRUM": ["drum", "drum"], "LOOP": ["other", "loop"], "SONG": ["other", "note"]};
let CAT_X = {};
function catInfo(k) { k = String(k || "").toUpperCase(); const x = CAT_X[k]; if (x && CAT_FAM[x.f]) return [x.f, CAT_ICON[x.i] ? x.i : "dot"]; return CAT_DEF[k] || ["other", "dot"]; }
function tcChip(k) {
  if (!CAT_ICONS) return `<i class="tc">${esc(k)}</i>`;
  const [f, i] = catInfo(k);
  return `<i class="tc ci" style="--cc:${CAT_FAM[f]}"><svg viewBox="0 0 16 16" aria-hidden="true">${CAT_ICON[i]}</svg>${esc(k)}</i>`;
}
function tcOf(name, k) { const w = String(name).trim().split(/\s+/); if (k === "SONG") return w.length > 2 ? w[w.length - 1].toUpperCase() : ""; return w.length > 1 ? k : ""; }
function secRank(pid, top) { const o = SEC_ORDER[pid]; return o ? (k) => { const i = o.indexOf(k); return -(i < 0 ? o.length - 0.5 : i); } : top; }   // bigger = earlier, same as top()
/* free versions (Eman 20 Nov): preset packs read "(Free preset pack)", drum/sample packs "(Free sample pack)" */
const freeLabel = (p) => p && p.type === "drums" ? "Free sample pack" : "Free preset pack";
const abs0 = (u) => (!u || /^(https?:|data:|\/)/.test(u) ? u : "/" + u);
const WD_LAZY = true, wdPack = new Map(), wdJobs = new Map();
const CD_SMALL = true;   // speed (Eman 20 Nov 00:36 "super fast"): grid/stack/cart covers load the 600px copy (img/cd/<id>-600.webp), only the big pack-page cover loads 1200px. false = 1200px everywhere
const abs = (u, big) => { let r = abs0(u); if (!(CD_VER && /^\/?img\/cd\/[^?\/]+\.webp$/.test(r || ""))) return r; if (CD_SMALL && !big && !/-600\.webp$/.test(r)) r = r.replace(/\.webp$/, "-600.webp"); return r + "?v=" + CD_VER; };   // covers/audio work from /pack/... too
const PLAY = '<svg viewBox="0 0 10 10"><path d="M1 0l9 5-9 5z"/></svg>';
const STOP = '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>';
let CREATORS = [], WORLDS = [], PRODUCTS = [], CUR = "EUR", DEALS = { cards: [] };            // CUR = the currency the buyer pays in (EUR or USD)
const money = (n) => new Intl.NumberFormat("en-IE", { style: "currency", currency: CUR, currencyDisplay: "narrowSymbol", minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
/* display currency: the buyer can pick any; checkout still charges in CUR */
let FX = { EUR: 1, USD: 1.08 }, DISP = "";
try { DISP = localStorage.getItem("ck-cur") || ""; } catch (e) {}
const disp = () => (DISP && FX[DISP] ? DISP : CUR);
const conv = (n) => n * (FX[disp()] || 1) / (FX[CUR] || 1);
function fmtIn(v, c, dec) {
  if (c === "EUR" || c === "USD") return new Intl.NumberFormat("en-IE", { style: "currency", currency: c, currencyDisplay: "narrowSymbol", minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
  return new Intl.NumberFormat("en-IE", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v) + " " + c;
}
/* price as shown on the site: in the picked currency, marked ≈ when it is a conversion */
const show = (n) => (disp() === CUR ? money(n) : "≈ " + fmtIn(conv(n), disp(), conv(n) >= 100 || !(conv(n) % 1) ? 0 : 2));
const soundCount = (p) => { const m = String(p.count || "").match(/(\d+)/); return Math.max(1, m ? +m[1] : (p.sounds || []).length); };
const perSound = (p) => { const v = p.price / soundCount(p), c = disp(), x = c === CUR ? v : conv(v); return `${c === CUR ? "" : "≈ "}${fmtIn(x, c, x < 10 ? 2 : 0)} per sound`; };
const CURS = ["EUR", "USD", "GBP", "SEK", "NOK", "DKK", "CHF", "PLN", "CZK", "HUF", "RON", "ISK", "TRY", "CAD", "AUD", "NZD", "JPY", "KRW", "CNY", "HKD", "SGD", "INR", "IDR", "MYR", "PHP", "THB", "BRL", "MXN", "ZAR", "ILS"];
function curUI() {
  const nav = $("nav.top .wrap"); if (!nav) return;
  let w = $("#curW");
  if (!w) {
    w = document.createElement("div"); w.className = "curw"; w.id = "curW";
    const cartw = $(".cartw", nav); cartw ? nav.insertBefore(w, cartw) : nav.insertBefore(w, nav.lastElementChild);
  }
  const list = CURS.filter((c) => FX[c]);
  w.innerHTML = `<button class="nl curb" id="curBtn" aria-label="Currency">${disp()}<svg viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z"/></svg></button>
    <div class="curdd" id="curDd" hidden><div class="curg">${list.map((c) => `<button data-cur="${c}" class="${c === disp() ? "on" : ""}">${c}${c === CUR ? "<i></i>" : ""}</button>`).join("")}</div>
    <small>You pay in ${CUR}</small></div>`;
}
function setCur(c) { DISP = c === CUR ? "" : c; try { DISP ? localStorage.setItem("ck-cur", DISP) : localStorage.removeItem("ck-cur"); } catch (e) {} curUI(); document.dispatchEvent(new Event("ck-cur")); }
let ALLP = [];
const byId = (id) => ALLP.find((p) => p.id === id);
const DRAFT = new URLSearchParams(location.search).has("draft");
const QS = DRAFT ? "?draft=1" : "";
const packUrl = (id) => "/pack/" + encodeURIComponent(id) + QS;

/* ---------- cart (kept in this browser) ---------- */
let cart = [];
try { cart = JSON.parse(localStorage.getItem("ck-cart") || "[]"); } catch (e) { cart = []; }
const saveCart = () => { try { localStorage.setItem("ck-cart", JSON.stringify(cart)); } catch (e) {} };
const inCart = (id) => cart.includes(id);
const subtotal = () => cart.reduce((s, id) => s + (byId(id) ? byId(id).price : 0), 0);
/* 3 for 2: in every group of 3 packs (priced high to low) the cheapest one is free */
/* loyalty: 5 paid packs = 1 free pick. A free pick takes the priciest pack and sits outside 3 for 2, so they never stack */
const LOY_N = 5;
let LOY = { paid: 0, picks: 0 }, usePick = true;
const pickId = () => (LOY.picks > 0 && usePick && cart.length ? cart.filter((id) => byId(id) && !byId(id).freebie).slice().sort((a, b) => byId(b).price - byId(a).price)[0] : null);
const dealCart = () => { const k = pickId(); return cart.filter((id) => byId(id) && !byId(id).freebie && id !== k); };
/* THE BUNDLE (Eman 18 Nov): every pack in the shop in the cart = 50% off all of them, instead of 3 for 2 */
const BUNDLE_PCT = 50;
const GIFT_TOAST = false;
/* PICK10 (Eman 20 Nov 20:00): "PICK 10 PACKS · SAVE $100". Any 10+ packs in the cart = 100 off (same number in EUR and USD), unless 3 for 2 saves more.
   The buyer picks the 10 on /bundle (a map of every CD). defaultMix() is only a spread of covers for the hero pile. BUNDLE10 = false = old "every pack 50%" bundle */
const BUNDLE10 = true, BUNDLE_N = 10, BUNDLE_OFF = 100;
let BMIX_DEF = null;
function defaultMix() {
  const n = Math.min(BUNDLE_N, PRODUCTS.length), ok = (id) => PRODUCTS.some((p) => p.id === id);
  if (Array.isArray(BMIX_DEF)) { const m = [...new Set(BMIX_DEF.filter(ok))]; if (m.length >= n) return m.slice(0, n); }
  const byW = new Map(); PRODUCTS.forEach((p) => { const k = p.world || "x"; if (!byW.has(k)) byW.set(k, []); byW.get(k).push(p); });
  const out = [], W = [...byW.values()]; let i = 0;
  for (let r = 0; out.length < n && r < 30; r++) W.forEach((a) => { if (out.length >= n) return; const left = a.filter((p) => !out.includes(p.id)); if (!left.length) return;
    const want = i % 3 === 2 ? "drums" : "serum", p = left.find((q) => (q.type === "drums") === (want === "drums")) || left[0]; out.push(p.id); i++; });
  return out;
}
const bundleMix = defaultMix;
const pick10 = () => [...new Set((lsGet("ck-p10") || []).filter((id) => PRODUCTS.some((p) => p.id === id)))];
const setPick10 = (a) => lsSet("ck-p10", a);
/* TRIO (Eman 20 Nov): a 3-pack per core series (2 Serum packs + the drum kit), priced with the 3 for 2 deal: pay for 2. TRIO_WORLDS = the series shown (first look: Crystal) */
/* TRIO_ALL (20 Nov): roll out to every series with 3+ packs. false = Crystal only */
const TRIO = true, TRIO_ALL = true, TRIO_WORLDS = ["crystal"];
function trioFor(w) {
  const ps = PRODUCTS.filter((p) => p.world === w && !p.test); if (ps.length < 3) return null;   // test products never go in a 3-pack
  const sr = ps.filter((p) => p.type !== "drums").sort((a, b) => String(b.id).localeCompare(String(a.id))), dr = ps.filter((p) => p.type === "drums").sort((a, b) => String(a.id).localeCompare(String(b.id)));
  let pick = (dr.length ? [...sr.slice(0, 2).reverse(), dr[0]] : sr.slice(0, 3).reverse()).slice(0, 3); if (pick.length < 3 && TRIO_ALL) pick = [...sr.slice().reverse(), ...dr].slice(0, 3); if (pick.length < 3) return null;
  const full = pick.reduce((t, p) => t + p.price, 0), free = Math.min(...pick.map((p) => p.price)), wn = (WORLDS.find((x) => x.id === w) || {}).name || w;
  return { world: w, name: wn, ids: pick.map((p) => p.id), full, price: full - free, free };
}
const trios = () => (TRIO ? (TRIO_ALL ? [...new Set(PRODUCTS.map((p) => p.world).filter(Boolean))] : TRIO_WORLDS).map(trioFor).filter(Boolean) : []);
function threeIds() { const ids = dealCart().sort((a, b) => byId(b).price - byId(a).price); return ids.filter((_, i) => i % 3 === 2); }
const threeVal = () => threeIds().reduce((s, id) => s + byId(id).price, 0);
const bundleOn = () => BUNDLE10 ? dealCart().length >= BUNDLE_N && Math.min(BUNDLE_OFF, dealCart().reduce((s, id) => s + byId(id).price, 0)) >= threeVal() : PRODUCTS.length >= 2 && PRODUCTS.every((p) => cart.includes(p.id));
const bundleFull = () => BUNDLE10 ? Math.max(BUNDLE_N, pick10().length) * 19 : PRODUCTS.reduce((s, p) => s + p.price, 0);
const bundlePrice = () => BUNDLE10 ? bundleFull() - BUNDLE_OFF : Math.round(bundleFull() * (100 - BUNDLE_PCT)) / 100;
const bundleLabel = () => BUNDLE10 ? `Pick 10 · save ${show(BUNDLE_OFF)}` : "Bundle · 50% off";
function freeIds3() { if (bundleOn()) return []; return threeIds(); }
const off3 = () => bundleOn() ? (BUNDLE10 ? Math.min(BUNDLE_OFF, dealCart().reduce((s, id) => s + byId(id).price, 0)) : Math.round(dealCart().reduce((s, id) => s + byId(id).price, 0) * BUNDLE_PCT) / 100) : threeVal();
/* deal card: saved on this browser after a claim; used instead of 3 for 2 only when it saves more */
let CARD = null; try { CARD = JSON.parse(localStorage.getItem("ck-card") || "null"); } catch (e) {}
const cardDef = () => (CARD && (DEALS.cards || []).find((c) => c.id === CARD.tier)) || null;
const cardLive = () => !!(CARD && !CARD.used && CARD.exp > Date.now() && cardDef());
function cardOff() {
  if (!cardLive()) return 0;
  const c = cardDef(), ids = dealCart().sort((a, b) => byId(b).price - byId(a).price), pr = (id) => byId(id).price;
  if (c.kind === "pct") return ids.length ? Math.round(pr(ids[0]) * c.pct) / 100 : 0;
  if (c.kind === "b1g1") return ids.length >= 2 ? pr(ids[1]) : 0;
  if (c.kind === "bundle3") return ids.length >= 3 ? Math.round((pr(ids[0]) + pr(ids[1]) + pr(ids[2])) * c.pct) / 100 : 0;
  return 0;
}
const useCard = () => cardOff() > off3();
function freeIds() { return useCard() ? [] : freeIds3(); }
const dealOff = () => (useCard() ? 0 : off3());
const pickOff = () => (pickId() ? byId(pickId()).price : 0);
const total = () => Math.round((subtotal() - dealOff() - (useCard() ? cardOff() : 0) - pickOff()) * 100) / 100;
const paidCount = () => dealCart().length - freeIds().length;
const dealStep = () => { const n = dealCart().length; return n && n % 3 === 0 ? 3 : n % 3; };
function offerHTML() {
  if (bundleOn()) return BUNDLE10 ? `<big>−${show(BUNDLE_OFF)}</big><b>Pick 10 · ${show(BUNDLE_OFF)} off</b>` : `<big>50%</big><b>The bundle · every pack half price</b>`;
  const k = dealStep(), n = dealCart().length;
  const msg = !n ? "Pick 3 packs · pay for 2" : k === 3 ? "Unlocked · 1 pack free" : k === 2 ? "Add 1 more → it's FREE" : "Add 2 more · 1 pack free";
  return `<big>3=2</big><b>${msg}</b><span class="dots">${[0, 1, 2].map((i) => `<i class="${i < k ? "on" : ""}"></i>`).join("")}</span>`;
}
/* meter preview: how many loyalty slots this order fills (paid packs only) */
function meterLine() {
  const n = paidCount(); if (!n) return "";
  const have = LOY.paid % LOY_N, after = have + n, picks = Math.floor(after / LOY_N);
  return `<div class="mline"><span class="mdots">${[...Array(LOY_N)].map((_, i) => `<i class="${i < have ? "had" : i < Math.min(after, LOY_N) ? "add" : ""}"></i>`).join("")}</span><span>This order gives <b>+${n * 200} PTS</b>${picks ? " · <b>FREE PICK</b> unlocked" : ""}</span></div>`;
}
/* what a pack includes: "ARP · LEAD · PAD · BASS" from its preview names */
function kinds(p) {
  const k = [];
  (p.sounds || []).forEach((s) => { const w = String(s.name).split(/\s+/)[0].toUpperCase(); if (w && !/^\d+$/.test(w) && !k.includes(w)) k.push(w); });
  return k.join(" · ");
}
/* TYPE_CHIP: chip from the grouped type (_tc), or from the name's first word on tiles that show the full name (home cards, cart) */
function tcHTML(s) {
  if (!TYPE_CHIP) return esc(s.name);
  if (s._tc) return `${tcChip(s._tc)}${esc(s.name)}`;
  if (s._tc === "") return esc(s.name);
  const w = String(s.name).trim().split(/\s+/), k = (w[0] || "").toUpperCase();
  if (k === "SONG" && w.length > 2) return `${tcChip(w[w.length - 1].toUpperCase())}${esc(w.slice(1, -1).join(" "))}`;
  if (w.length > 1 && (TYPE_KEYS.has(k) || (CAT_ICONS && CAT_X[k]))) return `${tcChip(k)}${esc(w.slice(1).join(" "))}`;
  return esc(s.name);
}
function sounds(p, max) {
  return (max ? p.sounds.slice(0, max) : p.sounds).map((s) => { if (!peaks.has(abs(s.file))) { if (s.wd) peaks.set(abs(s.file), [...s.wd].map((c) => parseInt(c, 36) / 35)); else if (s.w) peaks.set(abs(s.file), s.w); } return `<button data-src="${esc(abs(s.file))}"${s._k ? ` data-k="${esc(s._k)}"` : ""}${ADMIN && s._pid ? ` data-pid="${esc(s._pid)}" data-i="${s._i}" class="${s.hidden ? "off" : ""}${s.mark ? " mk" : ""}${s.fix ? " fx" : ""}${s.skull ? " sku" : ""}"${TIER && tierOf(s) ? ` data-tier="${tierOf(s)}"` : ""}` : ""}><span class="pl">${PLAY}</span><span class="nm">${ADMIN && s._pid ? `${SKULL_AFTER ? "" : SKULL}${TYPE_CHIP && s._tc ? tcChip(s._tc) : ""}<b class="nmt">${esc(s.name)}</b>${DUP_TAG && s.dup ? `<i class="dup">= ${esc(s.dup)}</i>` : ""}${SKULL_AFTER ? SKULL : ""}<i class="rg" data-a="regen" title="New name">↻</i>` : `${s.skull && !SKULL_AFTER ? SKULL : ""}${tcHTML(s)}${s.skull && SKULL_AFTER ? SKULL : ""}`}</span><span class="mt">${esc(s.meta)}</span><canvas class="wf"></canvas>${ADMIN && s._pid ? `<span class="ad"><i class="src"></i><i data-a="mark" title="${TIER ? "Priority · right-click to pick 1-5" : "Favorite"}">${TIER ? tierOf(s) || 1 : "★"}</i>${ADM_FIX_MARK ? `<i data-a="fix" title="Needs a fix (add a comment with ✎)">FIX</i>` : ""}<i data-a="skull" title="Red skull: distorted / texture">${SKULL_I}</i><i data-a="note" title="Comment">✎</i><i data-a="off" title="${s.hidden ? "Enable" : "Disable"}">⊘</i><i data-a="del" title="Remove">${ADM_TRASH_ICON ? TRASH_I : "×"}</i><i data-a="drag" title="Drag to move">⋮⋮</i></span>${s.note ? `<span class="an">${esc(s.note)}${AN_EDIT ? '<i class="anx" title="Remove">×</i>' : ""}</span>` : ""}` : ""}</button>`; }).join("");
}
/* one pack as a row that drops down to show + play its samples (cart dropdown and checkout) */
const openRows = new Set();
function packRow(p, mode) {
  const free = freeIds().includes(p.id), open = openRows.has(p.id);
  return `<div class="ck${mode === "add" ? " add" : ""}${open ? " open" : ""}" data-id="${p.id}">
    <div class="ckh" data-tg="${p.id}"><img src="${esc(abs(p.cover))}" alt="">
      <div class="cit"><b>${esc(p.name)}<span class="chev">▾</span></b><small>${esc(p.sub)} · ${esc(p.count)}</small><em>${esc(kinds(p))}</em></div>
      <div class="pr">${p.freebie ? `<span class="fr">FREE</span>` : free || p.id === pickId() ? `<span class="was">${show(p.price)}</span><span class="fr">${free ? "FREE" : "FREE PICK"}</span>` : show(p.price)}</div>
      ${mode === "add" ? `<button class="plus" data-add="${p.id}" aria-label="Add">+</button>` : `<button class="x" data-rm="${p.id}" aria-label="Remove">×</button>`}
    </div>
    <div class="ckb"${open ? "" : " hidden"}><p class="pi">${esc(p.blurb)}</p><div class="pv">${sounds(p)}</div></div></div>`;
}
function toggleRow(head) {
  const id = head.dataset.tg, box = head.parentNode;
  openRows.has(id) ? openRows.delete(id) : openRows.add(id);
  box.classList.toggle("open", openRows.has(id)); $(".ckb", box).hidden = !openRows.has(id);
  watchWaves(box);
}

/* ---------- cart dropdown under the cart icon (shop + pack pages) ---------- */
function addToCart(id) { if (!inCart(id)) { cart.push(id); track("cart", id, location.pathname, byId(id) && byId(id).price); } saveCart(); paintCart(); openCart(); }
/* the add-to-cart reaction: the cover flies to the cart, the count bumps, a coin blips (mute respected) */
function flyToCart(from, id) {
  const p = byId(id); if (!p) return;
  const card = from.closest(".card, .pk, .ck, main") || from, img = card.querySelector("img"), src = (img || from).getBoundingClientRect();
  const f = document.createElement("img"); f.src = abs(p.cover); f.className = "fly"; f.alt = "";
  const sz = Math.min(120, src.width || 80); Object.assign(f.style, { left: src.left + (src.width - sz) / 2 + "px", top: src.top + Math.max(0, (src.height - sz) / 2) + "px", width: sz + "px", height: sz + "px" });
  document.body.appendChild(f);
  // target is looked up a frame later: with BOX_HIDE_EMPTY the bundle box only appears once addToCart has run
  requestAnimationFrame(() => { const box = $(".bbox") && $(".bbox").offsetParent ? $(".bbox .bslots") : $("#cartBtn"); if (!box) { f.remove(); return; } const dst = box.getBoundingClientRect(); f.style.transform = `translate(${dst.left + dst.width / 2 - (src.left + src.width / 2)}px,${dst.top + dst.height / 2 - (src.top + Math.max(0, (src.height - sz) / 2) + sz / 2)}px) scale(.2) rotate(-12deg)`; f.style.opacity = ".2"; });
  setTimeout(() => { f.remove(); const n = $("#cartN"); if (n) { n.classList.remove("bump"); void n.offsetWidth; n.classList.add("bump"); } }, 520);
  coin();
}
function coin() { [988, 1319].forEach((f, j) => tone(f, j * 0.07, j ? 0.22 : 0.07, "square", 0.035)); }
function removeFromCart(id) { cart = cart.filter((x) => x !== id); saveCart(); paintCart(); }
function openCart() { if (!$("#cartDd")) return; paintCart(); $("#cartDd").hidden = false; $("#cartBtn").classList.add("open"); }
function closeCart() { if (!$("#cartDd")) return; $("#cartDd").hidden = true; $("#cartBtn").classList.remove("open"); }
function paintCart() {
  sideCart(); mobBar();
  if (!$("#cartN")) return;
  $("#cartN").textContent = cart.length; $("#cartN").hidden = !cart.length;
  document.querySelectorAll("[data-add]:not(.plus)").forEach((b) => {
    const on = inCart(b.dataset.add);
    b.textContent = on ? "In cart" : "Add to cart";
    b.classList.toggle("acid", !on); b.classList.toggle("ghost", on);
  });
  if (!$("#cartDd")) return;
  const items = cart.map(byId), off = dealOff();
  const rest = PRODUCTS.filter((p) => !inCart(p.id));
  $("#cartDd").innerHTML = !items.length ? `<div class="empty">Your cart is empty.</div>` : `
    <div class="cdl">${items.map((p) => packRow(p, "in")).join("")}</div>
    <div class="offer sm">${offerHTML()}</div>
    ${rest.length ? `<div class="cdl">${rest.map((p) => packRow(p, "add")).join("")}</div>` : ""}
    <div class="cft">${meterLine()}${off ? `<div class="row off"><span>${bundleOn() ? bundleLabel() : "3 for 2"}</span><span>−${show(off)}</span></div>` : ""}${pickOff() ? `<div class="row off"><span>Free pick</span><span>−${show(pickOff())}</span></div>` : ""}${useCard() ? `<div class="row off"><span>★ ${esc(cardDef().name)} card</span><span>−${show(cardOff())}</span></div>` : ""}<div class="row tot"><span>Total</span><span>${show(total())}</span></div>
    <a class="btn acid wide" href="/checkout${QS}">Checkout</a></div>`;
  watchWaves($("#cartDd"));
}

/* ---------- free samples drawer ---------- */
function openDrawer(view) {
  document.querySelectorAll(".dv").forEach((v) => v.hidden = v.dataset.v !== view);
  $("#drawer").classList.add("open"); $("#scrim").hidden = false; document.body.classList.add("lock");
}
function closeDrawer() { if (!$("#drawer")) return; $("#drawer").classList.remove("open"); $("#scrim").hidden = true; document.body.classList.remove("lock"); }
function showFree(id) {
  const p = byId(id);
  $("#frName").textContent = p.name;
  $("#frCover").src = abs(p.cover);
  $("#frList").innerHTML = (typeof freePicks === "function" ? freePicks(p) : p.sounds.slice(0, p.freeCount || 5)).map((s) => `<a class="li dl" href="${esc(abs(s.file))}" download><span class="pl">↓</span><span>${esc(s.name)}</span><small>${esc(s.meta || "mp3")}</small></a>`).join("");
  if ($("#frClaim")) $("#frClaim").hidden = true;
  $("#frList").hidden = true; $("#frForm").hidden = false; try { $("#frEmail").value = localStorage.getItem("ck-email") || ""; } catch (e) { $("#frEmail").value = ""; }
  $("#frGo").onclick = () => {
    if (p.payhipFree && window.Payhip) { window.open("https://payhip.com/b/" + p.payhipFree, "_blank"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($("#frEmail").value.trim())) { $("#frEmail").focus(); $("#frEmail").classList.add("bad"); return; }
    const em = $("#frEmail").value.trim();
    try { localStorage.setItem("ck-email", em); } catch (e) {}
    fetch("/api/free", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: em, pack: p.id, drops: !!($("#frDrops") && $("#frDrops").checked) }) })
      .then((r) => r.json()).then(() => loadLoyalty()).catch(() => {});
    $("#frEmail").classList.remove("bad"); $("#frForm").hidden = true; $("#frList").hidden = false;
    if (DEALS.enabled !== false) claimBlock(em); else meterOffer(em, $("#frList"), "after"); track("free", p.id);
  };
  closeCart(); openDrawer("free");
}
/* clicks shared by the shop and pack pages */
function shopClick(e) {
  const t = e.target;
  if (t.closest(".pv button")) return true;
  const add = t.closest("[data-add]"); if (add) { if (inCart(add.dataset.add)) openCart(); else { add.textContent = "In cart"; flyToCart(add, add.dataset.add); addToCart(add.dataset.add); } return true; }
  const rm = t.closest("[data-rm]"); if (rm) { removeFromCart(rm.dataset.rm); return true; }
  const tg = t.closest("[data-tg]"); if (tg) { toggleRow(tg); return true; }
  if (t.closest("#cartBtn")) { $("#cartDd").hidden ? openCart() : closeCart(); return true; }
  if (t.closest("[data-mycard]")) { showCard(CARD, false); return true; }
  if (t.closest("#cardX") || t.closest("#cardLater")) { closeCard(); return true; }
  if (t.closest("#cardMute")) { setMute(!muted()); return true; }
  if (t.closest(".sfxm")) { setMute(!muted()); if (!muted()) ckSfx("button", 1); return true; }
  if (t.closest("[data-weekly]")) { claimWeekly(t.closest("[data-weekly]")); return true; }
  if (t.closest("[data-mute]")) { setMute(!muted()); paintCart(); return true; }
  if (t.closest("#claimEdit")) { $("#frClaim").hidden = true; $("#frList").hidden = true; $("#frForm").hidden = false; $("#frEmail").focus(); return true; }
  if (t.closest("#claimGo")) { claim(); return true; }
  if (t.closest("#cMore")) { $("#cMoreTx").hidden = !$("#cMoreTx").hidden; return true; }
  if (t.closest("[data-cookies]")) { try { localStorage.removeItem("ck-consent"); } catch (er) {} consentBar(); return true; }
  if (t.closest("[data-consent]")) { const c = t.closest("[data-consent]").dataset.consent; if (c === "pick") setConsent($("#cStats").checked, $("#cStats").checked && $("#cRec").checked); else setConsent(c === "yes"); return true; }
  if (t.closest("#curBtn")) { $("#curDd").hidden = !$("#curDd").hidden; return true; }
  const cu = t.closest("[data-cur]"); if (cu) { setCur(cu.dataset.cur); return true; }
  if ($("#curDd") && !t.closest("#curW")) $("#curDd").hidden = true;
  const fr = t.closest("[data-free]"); if (fr) { showFree(fr.dataset.free); return true; }
  if (t.closest("#scrim") || t.closest("[data-close]")) { closeDrawer(); return true; }
  if ($("#cartDd") && !t.closest("#cartDd")) closeCart();
  return false;
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeCart(); } });

/* red skull (Eman 19 Nov): heavily distorted / texture-like sounds get a small red skull next to the name, for customers and admin */
const SKULL_P = '<path fill-rule="evenodd" d="M8 1.2C4.3 1.2 1.8 3.7 1.8 7c0 1.9.9 3.4 2.3 4.3v2.4c0 .6.4 1 1 1h5.8c.6 0 1-.4 1-1v-2.4c1.4-.9 2.3-2.4 2.3-4.3 0-3.3-2.5-5.8-6.2-5.8ZM5.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8 9.3l-1 1.6h2L8 9.3Zm-1.6 3v2.4h.9v-2.4h-.9Zm2.3 0v2.4h.9v-2.4h-.9Z"/>';
const SKULL = `<svg class="skl" viewBox="0 0 16 16" aria-label="Distorted" role="img"><title>Distorted / texture</title>${SKULL_P}</svg>`;
const ADM_TRASH_ICON = true;   // Eman 20 Nov: remove = red trash can (was ×). false = ×
const TRASH_I = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1h4l1 1h3v2H2V2h3zM3 5h10l-1 10H4z"/></svg>';
const SKULL_I = `<svg viewBox="0 0 16 16" aria-hidden="true">${SKULL_P}</svg>`;
/* ---------- data ---------- */
/* speed (Eman 18 Nov): the last product list is kept on this device, so pages draw at once and update quietly after */
function applyShop(d) {
    if (WD_LAZY) (d.products || []).forEach((p) => (p.sounds || []).forEach((x) => { if (!x.wd && !x.w && x.file) wdPack.set(abs(x.file), p.id); }));
    let force = ""; try { force = new URLSearchParams(location.search).get("pay") || ""; } catch (e) {}
    CUR = /^(EUR|USD)$/.test(force) ? force : d.pay || d.currency || "EUR";
    ALLP = d.products.filter((p) => ADMIN || (p.status || "live") === "live").map((p) => ({ ...p, priceEur: p.price, price: CUR === "USD" ? Number(p.priceUsd || p.price) : p.price, sounds: ADMIN ? (p.sounds || []).map((s, i) => ({ ...s, _pid: p.id, _i: i })) : (p.sounds || []).filter((s) => !s.hidden) }));
    PRODUCTS = ALLP.filter((p) => !p.freebie);   // the free sampler only comes through the claim toast
    if (CD_TEST) ALLP.forEach((p, i) => { if (!String(p.cover || "").startsWith("/f/")) p.cover = `img/cdtest/${(i % 6) + 1}.${CD_FLOAT ? "webp" : "jpg"}`; });
    document.documentElement.classList.toggle("cdf", CD_FLOAT); document.documentElement.classList.toggle("cds", CD_FLOAT && CD_SHINE); document.documentElement.classList.toggle("cdr", CD_FLOAT && CD_REFLECT); document.documentElement.classList.toggle("cdfl", CD_FLOAT && CD_FLOOR);   // visual test only (Eman 19 Nov): CD mockups on every pack
    DEALS = d.deals || DEALS;
    BMIX_DEF = d.bundleMix || null;
    if (HERO_BG) heroBg(d.heroBg);
    if (LOOK_ON) { LOOK = d.look || {}; applyLook(); }
    if (CAT_ICONS) CAT_X = (window.ADM && window.ADM.cats) || d.cats || {};
    WORLDS = d.worlds.filter((w) => PRODUCTS.some((p) => p.world === w.id));
    cart = cart.filter(byId); saveCart(); curUI();
    if (DRAFT && !document.querySelector("[data-pvbn]")) { const b = document.createElement("div"); b.dataset.pvbn = 1; b.textContent = "PREVIEW · NOT LIVE"; b.style.cssText = "position:fixed;left:0;bottom:0;z-index:90;background:#8b6cf6;color:#0b0a0e;font:800 10px/1 Inter,sans-serif;letter-spacing:.2em;padding:9px 10px"; document.body.appendChild(b); }
    if (PRODUCTS.some((p) => p.payhip || p.payhipFree) && !document.querySelector('script[src*="payhip.js"]')) { const s = document.createElement("script"); s.src = "https://payhip.com/payhip.js"; document.body.appendChild(s); }
}
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const CD_TEST = false;   // Eman 19 Nov: test mockups removed, every pack has its own CD (img/cd/<id>.webp). true = old test images (moved out of the site)
const WAVE_HIT_BOX = true;   // 20 Nov: see the wave click handler. false = only clicks on the canvas itself seek
const SEEK_SURE = true;   // 20 Nov: a wave click only unmutes once playback really sits where you clicked (see sureSeek). false = old seek that some servers/browsers ignore on the 1st click
const WAVE_SEEK_FIRST = false;   // Eman 20 Nov 02:06 (final): the 1st click on a sound ALWAYS plays from the start, wherever you click. Once it is selected, clicks on its wave jump there. true = 1st click starts where you clicked (19 Nov rule)
const CD_REFLECT = false;   // Eman 19 Nov 22:12: no floor reflection under the CDs down the page (hero stack keeps its own)
const CD_FLOOR = false;   // Eman 19 Nov 22:15: mirrored CD under the hero stack. true = bring it back
const CD_TILT_SHEEN = true;
const CD_EASE_BACK = true;   // Eman 19 Nov: when the mouse leaves, the CD glides back instead of snapping. false = snap   // Eman 19 Nov: a light streak moves over the CD when you tilt it with the mouse. false = none   // Eman 19 Nov: floor reflection under every CD (shop.css html.cdr). false = none
const CD_SHINE = false;   // Eman 19 Nov: reflections on the CDs (shop.css .cds). false = no shine
/* PK_FADE (Eman 21 Nov 23:06): pack / free page cover has no box while it loads and fades in once the image is ready. false = old (box until the product list arrives) */
const PK_FADE = true;
if (PK_FADE) { const H = document.documentElement; H.classList.add("pkfade"); const ld = (i) => i.classList.add("ld");
  document.addEventListener("load", (e) => { const t = e.target; if (t && t.tagName === "IMG" && t.closest(".pkc")) ld(t); }, true);
  document.addEventListener("error", (e) => { const t = e.target; if (t && t.tagName === "IMG" && t.closest(".pkc")) setTimeout(() => ld(t), 300); }, true);
  const sweep = () => document.querySelectorAll(".pkc img").forEach((i) => { if (i.complete && i.naturalWidth) ld(i); });
  new MutationObserver(sweep).observe(H, { childList: true, subtree: true }); setTimeout(() => document.querySelectorAll(".pkc img").forEach(ld), 4000); }
const CD_FLOAT = true;   // test (Eman 19 Nov): CD floats on the page, no box around it. false = boxed cards again   // false = real pack covers again
const PROD_V = 4;   // 4 (26 Nov) = every visitor's old cached list is skipped once   // 3 = lite list (WD_LAZY)   // bump when packs are added so returning visitors skip their old cached list
/* TIER (Eman 21 Nov 01:22): the ★ on each sound becomes a priority number 1-5 (1 = top, acid). s.mark holds the number; old true = 1. false = old ★ */
const TIER = true, tierOf = (s) => (s && s.mark ? (s.mark === true ? 1 : Math.min(5, Math.max(1, +s.mark || 1))) : 0);
const ADM_FIX_MARK = true;   // Eman 20 Nov: separate FIX mark next to the ★ favorite on every sound in admin. false = only ★
let ADMIN = false;   // admin view of the store (Eman 19 Nov): logged-in admin sees everything + edit tools (adm-live.js)
function loadShop() {
  let src, cached = null;
  const ADM_KEEP = true;   // 20 Nov fix: the admin tools vanished because the panel's draft preview (and any failed check) wiped the "this is the admin device" flag. Now: ?mode=admin always asks, and the flag is only forgotten when the server says "logged out" (401). false = old behaviour
  let admOut = false;
  const admWant = lsGet("ck-adm") || (ADM_KEEP && /[?&]mode=admin\b/.test(location.search));
  const admP = admWant && !DRAFT ? fetch("/api/admin/state", { cache: "no-store" }).then((r) => { if (r.status === 401) admOut = true; return r.ok ? r.json() : null; }).catch(() => null) : Promise.resolve(null);
  if (DRAFT) { try { const d = JSON.parse(localStorage.getItem("ck-draft") || "null"); if (d) src = Promise.resolve(d); } catch (e) {} }
  const EARLY_P = true;   // speed 20 Nov: use the list download the page head already started (window.__ckP). false = fetch here like before
  const fresh = src ? null : (EARLY_P && WD_LAZY && window.__ckP ? window.__ckP : fetch(WD_LAZY ? "/api/products?lite=1" : "/api/products", { cache: "no-store" }).then((r) => { if (!r.ok) throw 0; return r.json(); }))
    .catch(() => fetch("/products.json?v=" + Date.now()).then((r) => r.json()));
  if (!src) { cached = lsGet("ck-prod"); const want = (location.pathname.match(/^\/(?:pack|creator)\/([^/?#]+)/) || [])[1];
    if (cached && fresh && (want && !(cached.products || []).some((p) => p.id === want) && location.pathname.startsWith("/pack/") || lsGet("ck-prod-v") !== PROD_V)) cached = null;   // packs added since the last visit: wait for the fresh list
    src = cached || fresh; if (fresh) fresh.then((d) => { lsSet("ck-prod", d); lsSet("ck-prod-v", PROD_V); }).catch(() => {}); }
  const fxC = lsGet("ck-fx"); if (fxC) FX = fxC;
  const fx = fetch("/api/fx").then((r) => r.json()).then((d) => { if (d && d.rates) { FX = d.rates; lsSet("ck-fx", d.rates); } }).catch(() => {});
  const crC = lsGet("ck-cr"); if (crC) CREATORS = crC;
  const cr = fetch("/creators.json?v=3").then((r) => r.json()).then((j) => { CREATORS = (j && j.creators) || []; lsSet("ck-cr", CREATORS); }).catch(() => {});
  return Promise.all([src, fxC ? null : fx, crC ? null : cr, admP]).then(([d, , , adm]) => {
    if (adm && adm.packs) { ADMIN = true; window.ADM = adm.packs; d = { ...d, worlds: adm.packs.worlds || d.worlds, products: adm.packs.products, look: adm.packs.look || null, cats: adm.packs.cats || null }; cached = null; }
    else if (lsGet("ck-adm") && (!ADM_KEEP || admOut)) lsSet("ck-adm", null);
    if (ADMIN && ADM_KEEP && !lsGet("ck-adm")) lsSet("ck-adm", 1);
    window.__CKD = d; applyShop(d);
    if (ADMIN && !$("#admLive")) { const sc = document.createElement("script"); sc.id = "admLive"; sc.src = "/admin/live.js?v=36"; document.head.appendChild(sc); }
    // a cached list was used: when the fresh one differs, redraw once
    if (cached && fresh) fresh.then((n) => { if (JSON.stringify(n) !== JSON.stringify(cached)) { applyShop(n); document.dispatchEvent(new Event("ck-cur")); } }).catch(() => {});
    CLARITY = d.clarity || "";
    trackVisit(); setTimeout(consentBar, 1200); loadClarity();
    const ft = $("footer .wrap"); if (ft && !$("footer [data-cookies]")) ft.insertAdjacentHTML("beforeend", `<span class="ftl"><a href="/tools/">Tools</a><a href="/privacy">Privacy</a><button class="ckl" data-cookies>Cookies</button></span>`);
    if (ft && DEV_RESET && window.top === window && !$("[data-devreset]")) ft.insertAdjacentHTML("beforeend", `<button class="btn sm devr" data-devreset>Reset · first visit</button><button class="btn sm devr" data-devreset="/get/crystal-core-i?ref=test">Free download</button><button class="btn sm devr" data-phoneview>Phone view</button><a class="btn sm devr" href="/admin">Admin</a>`);
    setTimeout(freeToast, 0);
    const pm = location.pathname.match(/^\/pack\/([^/?#]+)/);
    track("view", pm ? decodeURIComponent(pm[1]) : null, location.pathname);
    if (pm) track("pack", decodeURIComponent(pm[1]));
    if (location.pathname === "/checkout") track("checkout", null, String(cart.length), total());
    try { const qe = new URLSearchParams(location.search).get("e"); if (qe && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(qe)) localStorage.setItem("ck-email", qe.toLowerCase()); } catch (er) {}
    loadLoyalty().then(() => { if (typeof paintCart === "function") paintCart(); if (/[?&]claim=weekly\b/.test(location.search) && LOY.canWeekly) { const b = $("[data-weekly]"); if (b) claimWeekly(b); } }).catch(() => {});
  });
}

/* ---------- waveforms (same look as the KILLTOY review pages) ---------- */
const BARS = 240, peaks = new Map(), pending = new Map();
/* WD_LAZY (speed 20 Nov): the product list comes without waveform strings (444 KB of 696 KB). A pack's waves are fetched once from /api/wd?id=<pack> when its first waveform scrolls into view. false = full list with waves, as before */
function wdFor(src) {
  const id = wdPack.get(src); if (!id) return null;
  if (!wdJobs.has(id)) wdJobs.set(id, fetch("/api/wd?id=" + encodeURIComponent(id)).then((r) => (r.ok ? r.json() : {})).then((m) => { Object.entries(m || {}).forEach(([f, wd]) => { if (wd) peaks.set(abs(f), [...wd].map((c) => parseInt(c, 36) / 35)); }); }).catch(() => {}));
  return wdJobs.get(id).then(() => peaks.get(src) || null);
}
let actx = null;
function getPeaks(src) {
  if (peaks.has(src)) return Promise.resolve(peaks.get(src));
  try { const c = JSON.parse(localStorage.getItem("ck-wf:" + src) || "null"); if (c) { peaks.set(src, c); return Promise.resolve(c); } } catch (e) {}
  if (pending.has(src)) return pending.get(src);
  if (WD_LAZY && wdPack.has(src)) { const j = wdFor(src); pending.set(src, j); return j; }
  if (/#t=/.test(src)) return Promise.resolve(null);   // sprite slices carry their wave in products.json
  const job = fetch(src).then((r) => r.arrayBuffer()).then((buf) => {
    actx = actx || new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
    return new Promise((ok, bad) => actx.decodeAudioData(buf, ok, bad));
  }).then((ab) => {
    const d = ab.getChannelData(0), step = Math.floor(d.length / BARS) || 1, out = [];
    for (let i = 0; i < BARS; i++) { let m = 0; for (let j = i * step, e = Math.min(d.length, j + step); j < e; j += 4) { const v = Math.abs(d[j]); if (v > m) m = v; } out.push(m); }
    const top = Math.max(...out) || 1, w = out.map((v) => Math.round((v / top) * 100) / 100);
    peaks.set(src, w); try { localStorage.setItem("ck-wf:" + src, JSON.stringify(w)); } catch (e) {}
    return w;
  }).catch(() => null);
  pending.set(src, job); return job;
}
function drawWave(btn, ph) {
  const cv = btn.querySelector("canvas.wf"); if (!cv) return;
  const w = peaks.get(btn.dataset.src), dpr = window.devicePixelRatio || 1;
  const W = Math.max(20, Math.round(cv.clientWidth)), H = Math.round(cv.clientHeight); if (!H) return;   // layout size: not squashed by the pop-in animation
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const on = btn === curBtn, mid = H / 2;
  if (!w) {   // still loading: a soft placeholder wave that pulses, swapped for the real one when it arrives
    let h = 0; for (const c of String(btn.dataset.src)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const p = new Path2D(); for (let x = 0; x < W; x += 3) { h = (h * 1103515245 + 12345) >>> 0; const v = 0.25 + ((h >>> 16) % 1000) / 1000 * 0.6, a = Math.max(1, v * (mid - 2) * (0.55 + 0.45 * Math.sin(x / W * Math.PI))); p.rect(x, mid - a, 2, a * 2); }
    g.fillStyle = "#8b6cf6"; g.globalAlpha = .28; g.fill(p); g.globalAlpha = 1; cv.classList.add("ld"); return; }
  if (cv.classList.contains("ld")) { cv.classList.remove("ld"); cv.classList.remove("wvin"); void cv.offsetWidth; cv.style.animationDelay = "0ms"; cv.classList.add("wvin"); }
  // detailed mirrored waveform: one thin line per pixel column
  const n = w.length, step = 1 / dpr * 2;
  const col = (x) => { const a = (x / W) * n, i = Math.floor(a), f = a - i; return (w[Math.min(n - 1, i)] || 0) * (1 - f) + (w[Math.min(n - 1, i + 1)] || 0) * f; };
  const ws = LOOK_ON ? +LOOK.wave || 0 : 0, wc = LOOK_ON ? lookCol(btn, "wave") : "";
  const path = new Path2D(); let stroke = false;
  if (ws === 1) { for (let x = 0; x < W; x += 5) { const h = Math.max(1, col(x + 1.5) * (mid - 1)); path.rect(x, mid - h, 3, h * 2); } }   // BARS
  else if (ws === 2 || ws === 3) {   // SMOOTH (filled) / OUTLINE
    const pts = []; for (let x = 0; x <= W; x += 2) pts.push([x, Math.max(0.8, col(x) * (mid - 1))]);
    path.moveTo(0, mid); pts.forEach(([x, h]) => path.lineTo(x, mid - h)); for (let i = pts.length - 1; i >= 0; i--) path.lineTo(pts[i][0], mid + pts[i][1]); path.closePath(); stroke = ws === 3; }
  else if (ws === 4) { for (let x = 0; x < W; x += 3) { const h = Math.max(1, col(x + 1) * (H - 2)); path.rect(x, H - h, 2, h); } }   // PEAKS (from the floor up)
  else for (let x = 0; x < W; x += step) { const h = Math.max(0.6, col(x) * (mid - 1)); path.rect(x, mid - h, Math.max(0.5, step * 0.62), h * 2); }   // LINES (the original)
  const paint = (c, a) => { g.globalAlpha = a; if (stroke) { g.fillStyle = c; g.globalAlpha = a * 0.16; g.fill(path); g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = 1.2; g.stroke(path); } else { g.fillStyle = c; g.fill(path); } };
  if (LOOK_ON && btn.closest(".mood")) { const mc = wc || "#8b6cf6"; g.save(); g.shadowColor = mc; g.shadowBlur = 8; paint(on && !wc ? "#b8a4ff" : mc, on ? 0.95 : 0.85); g.restore(); }   // top preview: soft glow
  else if (btn.closest("html.secclean #pkAll .psec")) paint(on ? "#b8a4ff" : "#8b6cf6", on ? 0.95 : 0.85);   // SEC_CLEAN: default purple waves
  else if (btn.closest("html.secopen #pkAll .psec")) paint(on ? "#ffffff" : "#0b0a0e", on ? 0.95 : 0.78);   // SEC_OPEN: dark cut-out wave, white while playing
  else paint(wc || (on ? "#b8a4ff" : "#8b6cf6"), on ? 0.95 : 0.85);
  if (on && ph != null) { g.save(); g.beginPath(); g.rect(0, 0, W * ph, H); g.clip(); paint(btn.closest("html.secopen #pkAll .psec") ? "#0b0a0e" : "#e4ff3a", 1); g.restore(); g.fillStyle = "#fff"; g.fillRect(Math.round(W * ph), 0, 1, H); }
  g.globalAlpha = 1;
}
/* top preview (Eman 20 Nov): the best few sounds above the full list. ★ favorites first, then drum loops, then one of each kind in section order */
const PREV_PICK = true;   // false = preview is always automatic (★ first, then a mix)
function topPicks(p, n, rk) {
  const ss = p.sounds.filter((s) => !s.hidden), out = [], seen = new Set(), add = (s) => { if (out.length < n && !seen.has(s)) { seen.add(s); out.push(s); } };
  if (PREV_PICK && Array.isArray(p.prev) && p.prev.length) { p.prev.forEach((f) => { const s = ss.find((x) => x.file === f); if (s) add(s); }); return out; }   // PREV_PICK (Eman 20 Nov): the admin picks the preview sounds by hand
  (TIER ? ss.filter((s) => s.top || s.mark).sort((a, b) => (tierOf(a) || 9) - (tierOf(b) || 9)) : ss.filter((s) => s.top || s.mark)).forEach(add);
  const K = (s) => String(s.name).split(/\s+/)[0].toUpperCase();
  if (p.type === "drums") ss.filter((s) => K(s) === "LOOP").forEach(add);
  const groups = new Map(); ss.forEach((s) => { const k = K(s); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
  const order = [...groups.keys()].sort((a, b) => (rk ? rk(b) - rk(a) : 0));
  for (let r = 0; out.length < n && r < 50; r++) order.forEach((k) => { const g = groups.get(k); if (g[r]) add(g[r]); });
  return out;
}
/* LOOK (Eman 20 Nov): one site-wide look for the sound boxes, set live from the admin (click a section heading).
   LOOK = { wave:0-4, box:0-4, chip:0-4, row:N, rowPh:N, prev:N (top preview, 0 = off), c: { _all:{wave,box,chip}, ARP:{...}, ... } } */
const LOOK_ON = true;   // false = old fixed look, no top preview
const CMP_NOPLAY = true;   // column cards without the play button (CSS .cols .pv .pl hidden). false = old
let LOOK = {};
function lookCol(el, what) { const k = (el.closest("[data-k]") || {}).dataset?.k, c = LOOK.c || {}; return (k && c[k] && c[k][what]) || (c._all && c._all[what]) || ""; }
function applyLook() {
  let st = document.getElementById("ckLook"); if (!st) { st = document.createElement("style"); st.id = "ckLook"; document.head.appendChild(st); }
  const L = LOOK || {}, c = L.c || {}, css = [], cm = (v, p, b) => `color-mix(in srgb,${v} ${p}%,${b || "transparent"})`;
  const vars = (sel, o) => { const v = []; if (o.box) v.push(`--bx:${o.box}`); if (o.chip) v.push(`--chip:${o.chip}`); if (v.length) css.push(`${sel}{${v.join(";")}}`); };
  if (c._all) vars(":root", c._all); Object.keys(c).filter((k) => k !== "_all").forEach((k) => vars(`[data-k="${k}"]`, c[k]));
  const hasBox = Object.values(c).some((o) => o && o.box), hasChip = Object.values(c).some((o) => o && o.chip), B = "var(--bx,#8b6cf6)", C = "var(--chip,#8b6cf6)", T = ".pv.big button,.cols .pv button";
  const bx = +L.box || 0, ch = +L.chip || 0;
  if (bx === 0 && hasBox) css.push(`${T}{border-color:${cm(B, 45)};background:${cm(B, 7, "#121016")}}`);
  if (bx === 1) css.push(`${T}{border-color:transparent;background:${cm(B, 15, "#121016")}}`);
  if (bx === 2) css.push(`${T}{background:transparent;border-color:${cm(B, 70)}}`);
  if (bx === 3) css.push(`${T}{background:#121016;border-color:${cm(B, 55)};box-shadow:0 0 18px -6px ${cm(B, 60)},inset 0 0 26px -14px ${cm(B, 60)}}`);
  if (bx === 4) css.push(`${T}{border-color:transparent;background:linear-gradient(180deg,${cm(B, 17, "#121016")},#0f0d13);box-shadow:inset 3px 0 0 ${B}}`);
  const TC = ".pv .nm .tc";
  if (ch === 0 && hasChip) css.push(`${TC}{background:${cm(C, 20)};border-color:${cm(C, 55)};color:${cm(C, 35, "#fff")}}`);
  if (ch === 1) css.push(`${TC}{background:${C};border-color:${C};color:#0b0a0e}`);
  if (ch === 2) css.push(`${TC}{background:transparent;border-color:${C};color:${C}}`);
  if (ch === 3) css.push(`${TC}{background:none;border-color:transparent;color:${C};padding-left:0}${TC}::before{content:"■";margin-right:5px;font-size:.8em}`);
  if (ch === 4) css.push(`${TC}{background:none;border:0;border-left:3px solid ${C};color:#eee;padding-left:6px}`);
  if (+L.row) css.push(`@media (min-width:1001px){.pv.big:not(.mood){grid-template-columns:repeat(${+L.row},minmax(0,1fr))}.cflt:not(.one) .cols{grid-auto-columns:calc((100% - ${(+L.row - 1) * 10}px) / ${+L.row})}}`);
  if (+L.rowPh) css.push(`@media (max-width:720px){.pv.big:not(.mood){grid-template-columns:repeat(${+L.rowPh},minmax(0,1fr))}.cflt:not(.one) .cols{grid-auto-columns:calc((100% - ${(+L.rowPh - 1) * 6}px) / ${+L.rowPh})}}`);
  st.textContent = css.join("\n");
}
window.ckApplyLook = (l) => { LOOK = l || {}; applyLook(); document.querySelectorAll(".pv button").forEach((b) => drawWave(b, b === curBtn ? segPos() : null)); };

/* waves pop in top-first with a small stagger (Eman 18 Nov: "satisfying" loading) */
const waveIO = "IntersectionObserver" in window ? new IntersectionObserver((es) => { let k = 0;
  es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left).forEach((e) => {
    waveIO.unobserve(e.target);
    const b = e.target, cv = b.querySelector("canvas.wf"), d = Math.min(k++, 12) * 45;
    if (cv && !matchMedia("(prefers-reduced-motion: reduce)").matches) { cv.style.animationDelay = d + "ms"; cv.classList.add("wvin"); }
    drawWave(b); getPeaks(b.dataset.src).then(() => drawWave(b));
  }); }, { rootMargin: "120px" }) : null;
function watchWaves(root = document) {
  root.querySelectorAll(".pv button").forEach((b) => { requestAnimationFrame(() => drawWave(b)); if (waveIO) waveIO.observe(b); else getPeaks(b.dataset.src).then(() => drawWave(b)); });
}
let rsz; addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => document.querySelectorAll(".pv button").forEach((b) => peaks.has(b.dataset.src) && drawWave(b, b === curBtn ? segPos() : null)), 120); });

/* ---------- previews: one sound at a time, tap the wave to jump ---------- */
const audio = new Audio(); audio.preload = "none"; let curBtn = null; const played = new Set();
function stopCur() { pendEnd(); const b = curBtn; if (b) { b.classList.remove("on"); if ($(".pl", b)) $(".pl", b).innerHTML = PLAY; } curBtn = null; if (b) drawWave(b); }
/* sprite previews (18 Nov): one mp3 per pack, each sound is "file.mp3#t=start,end" so the site stays under the 1000-file upload cap */
/* SPRITE_CLIPS (speed 27 Nov): each sprite slice also exists as its own small file audio/sp/<pack>/<start>-<end>.mp3 (100-200 KB),
   so a press downloads only that sound instead of seeking inside an 11-17 MB pack file. If a clip is missing (times changed), it falls back to the sprite. false = old way */
const SPRITE_CLIPS = true, clipBad = new Set();
const spr = (s) => { const m = String(s || "").match(/^(.*)#t=([\d.]+),([\d.]+)$/); if (!m) return { u: s, a: 0, b: null };
  if (SPRITE_CLIPS && /(^|\/)audio\/sp\/[^\/]+\.mp3$/.test(m[1])) { const c = m[1].replace(/\.mp3$/, "/" + m[2] + "-" + m[3] + ".mp3"); if (!clipBad.has(c)) return { u: c, a: 0, b: null, sp: { u: m[1], a: +m[2], b: +m[3] }, src: s }; }
  return { u: m[1], a: +m[2], b: +m[3] }; };
window.ckSpr = spr;
let seg = { a: 0, b: null }, segTok = 0;
const segLen = () => (seg.b != null ? seg.b - seg.a : audio.duration || 0);
const segPos = () => { if (SEEK_SURE && pend) return pend.frac; const L = segLen(); return L ? Math.min(1, Math.max(0, (audio.currentTime - seg.a) / L)) : 0; };
/* 20 Nov (first-click bug, root cause): a seek asked for before the browser can jump in the file is silently dropped,
   so the first click on a sound that isn't loaded yet played from 0:00 even though currentTime had been set. That happens when
   the audio server doesn't answer byte-range requests (the browser can only jump into parts it already downloaded) and in Safari.
   Later clicks worked because by then the file was loaded. Fix: start muted, keep re-seeking on every load/progress event until
   playback REALLY sits at the clicked spot, then unmute. The playhead stays on the clicked spot meanwhile. Max 4 s, then unmute anyway. */
let pend = null, curU = "";
const covers = (r, t) => { for (let i = 0; i < r.length; i++) if (r.start(i) <= t + 0.05 && r.end(i) >= t) return true; return false; };
const PEND_EVS = ["loadedmetadata", "loadeddata", "progress", "canplay", "playing", "timeupdate", "seeked"];
function pendEnd() { const p = pend; if (!p) return; pend = null; PEND_EVS.forEach((e) => audio.removeEventListener(e, p.fix)); clearTimeout(p.to); audio.muted = false; }
const blobs = new Map();   // file url -> in-memory copy (always seekable)
function toBlob(p) {
  p.blob = true; const u = curU;
  (blobs.has(u) ? Promise.resolve(blobs.get(u)) : fetch(u).then((r) => r.blob()).then((b) => { const o = URL.createObjectURL(b); blobs.set(u, o); return o; }))
    .then((o) => { if (pend !== p || curU !== u) return; p.tries = 0; audio.src = o; audio.play().catch(() => {}); }).catch(() => pendEnd());
}
function sureSeek(frac) {   // seek inside the current sound to frac (0..1) and make sure it lands
  pendEnd(); if (!SEEK_SURE) { const L = segLen(); if (L) audio.currentTime = seg.a + frac * L; return; }
  const p = pend = { frac, tries: 0 };
  p.fix = () => {
    if (pend !== p) return;
    const L = segLen(); if (audio.readyState < 1 || !L) return;
    const tg = seg.a + frac * L, ct = audio.currentTime;
    if (ct >= tg - 0.15 && ct <= tg + 0.6 && !audio.seeking) return pendEnd();   // really there: unmute
    if (audio.seeking) return;
    if (p.tries >= 3) { if (!p.blob) toBlob(p); return; }   // the server won't let the browser jump: play it from memory instead
    if (p.tries === 0 || covers(audio.seekable, tg) || covers(audio.buffered, tg)) { p.tries++; audio.currentTime = tg; }
  };
  p.to = setTimeout(pendEnd, 4000);
  audio.muted = true; PEND_EVS.forEach((e) => audio.addEventListener(e, p.fix)); p.fix();
}
function segPlay(src, frac) {
  pendEnd(); seg = spr(src); const want = new URL(seg.u, location.href).href, fresh = curU !== want;
  if (fresh) { curU = want; audio.src = blobs.get(want) || seg.u; }
  if (!SEEK_SURE) {   // old way (before 20 Nov)
    const go = () => { audio.currentTime = seg.a + (frac || 0) * segLen(); };
    if (fresh) { if (seg.a || frac) audio.addEventListener("loadedmetadata", go, { once: true }); } else go();
    return audio.play();
  }
  if (seg.a || frac) sureSeek(frac || 0); else if (!fresh) audio.currentTime = 0;
  return audio.play();
}
function segEnd() { audio.pause(); stopCur(); if (typeof rpOff === "function") rpOff(); }
audio.addEventListener("error", () => { if (!seg.sp || clipBad.has(seg.u)) return; clipBad.add(seg.u); curU = ""; const p = segPlay(seg.src, 0); if (p && p.catch) p.catch(() => {}); });   // SPRITE_CLIPS fallback
/* AUDIO_WARM (speed 27 Nov): start downloading a sound the moment the mouse is over it or a finger touches it (before the click lands),
   and fetch the first few sounds of the page quietly once it has loaded, so the first press plays at once. Never on Data Saver / 2G. false = off */
const AUDIO_WARM = true, warmed = new Set();
function warmSrc(src, low) {
  if (!AUDIO_WARM || !src) return; const u = new URL(spr(src).u, location.href).href; if (warmed.has(u) || u === curU || blobs.has(u)) return; warmed.add(u);
  try { fetch(u, { priority: low ? "low" : "high" }).then((r) => { if (!r.ok) throw 0; return r.blob(); }).then((b) => { if (!blobs.has(u)) blobs.set(u, URL.createObjectURL(b)); }).catch(() => warmed.delete(u)); } catch (e) {}   // kept in memory: the press then plays with no network wait
}
if (AUDIO_WARM) {
  const slow = () => { const c = navigator.connection; return !!(c && (c.saveData || /2g/.test(c.effectiveType || ""))); };
  const onWarm = (e) => { if (slow() && e.type === "pointerover") return; const b = e.target && e.target.closest && e.target.closest(".pv button[data-src], button[data-src].ck-p, [data-src].pvb"); if (b) warmSrc(b.dataset.src); };
  ["pointerover", "pointerdown", "touchstart"].forEach((t) => document.addEventListener(t, onWarm, { passive: true, capture: true }));
  let kicked = false; const kick = (f) => () => { if (kicked) return; kicked = true; f(); };
  const idleWarm = kick(() => {
    if (slow()) return; const c = navigator.connection, n = c && /3g/.test(c.effectiveType || "") ? 2 : 6, vh = innerHeight * 1.5;
    const bs = [...document.querySelectorAll("#pkSounds .pv button[data-src], .pv button[data-src]")].filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.bottom > 0 && (r.top < vh || b.closest("#pkSounds")); }).slice(0, n);
    (window.requestIdleCallback || setTimeout)(() => bs.forEach((b) => warmSrc(b.dataset.src, true)), { timeout: 800 });
  });
  addEventListener("load", () => setTimeout(idleWarm, 600)); setTimeout(idleWarm, 2500);   // whichever comes first: page loaded, or 2.5 s after start (slow networks never reach "load" quickly)
}
audio.addEventListener("timeupdate", () => { if (seg.b != null && audio.currentTime >= seg.b - 0.02) segEnd(); });
function tick() { if (!curBtn) return; if (seg.b != null && audio.currentTime >= seg.b - 0.02) { segEnd(); return; } drawWave(curBtn, segPos()); requestAnimationFrame(tick); }
document.addEventListener("click", (e) => {
  const b = e.target.closest(".pv button"); if (!b) return;
  if (b.closest("html.tapplay .pv")) {   // TAP_PLAY (see SEC_CLEAN)
    if (curBtn === b) { tapPause(); return; }
    if (curBtn && curBtn.closest("html.tapplay .pv")) { const f0 = segPos(); if (f0 > 0.01 && f0 < 0.98) tapResume.set(curBtn.dataset.src, f0); }   // switching sounds keeps where the old one stopped
    const fr = tapResume.get(b.dataset.src); tapResume.delete(b.dataset.src);
    stopCur(); if (typeof rpOff === "function") rpOff(); curBtn = b; b.classList.add("on"); if ($(".pl", b)) $(".pl", b).innerHTML = STOP; played.add(b.dataset.src);
    audio.loop = false; document.querySelectorAll(".pv button.sel").forEach((x) => x !== b && x.classList.remove("sel")); b.classList.add("sel"); segPlay(b.dataset.src, fr != null ? fr : null).then(() => requestAnimationFrame(tick)).catch(stopCur);
    if (!spr(b.dataset.src).b) getPeaks(b.dataset.src).then(() => drawWave(b, 0));
    const pm = location.pathname.match(/^\/pack\/([^/?#]+)/); track("play", pm ? decodeURIComponent(pm[1]) : null, ($(".nm", b) || {}).textContent);
    return;
  }
  // 20 Nov: the click counts as a wave click whenever it lands inside the waveform's box, even if something sits on top of it
  // (playhead, admin/ref icons). Before, only a click whose target WAS the canvas counted, anything else started at 0.
  let cv = e.target.closest("canvas.wf");
  if (!cv && WAVE_HIT_BOX) { const c2 = b.querySelector("canvas.wf"), rr = c2 && c2.getBoundingClientRect(); if (rr && e.clientX >= rr.left && e.clientX <= rr.right && e.clientY >= rr.top - 4 && e.clientY <= rr.bottom + 4) cv = c2; }
  const at = cv ? Math.min(0.99, Math.max(0, (e.clientX - cv.getBoundingClientRect().left) / cv.getBoundingClientRect().width)) : null;
  /* Eman 18 Nov: 1st press plays from the start once (no loop), selects the tile; STOP or a click outside stops; while playing (or once played) the wave seeks */
  const onPl = !!e.target.closest(".pl") || (CMP_NOPLAY && at == null && !!b.closest(".cols"));   // CMP_NOPLAY (Eman 20 Nov): column cards have no play button; a press outside the wave starts / stops
  if (curBtn === b) {
    if (!onPl && at != null && segLen()) { sureSeek(at); return; }
    if (!onPl) return;
    audio.pause(); stopCur(); return;
  }
  const seek = !onPl && at != null && (WAVE_SEEK_FIRST || b.classList.contains("sel")) ? at : null;   // Eman 20 Nov: not selected yet = from the start; already selected (even if stopped) = from where you clicked
  stopCur(); if (typeof rpOff === "function") rpOff(); curBtn = b; b.classList.add("on"); $(".pl", b).innerHTML = STOP; played.add(b.dataset.src);
  audio.loop = false; document.querySelectorAll(".pv button.sel").forEach((x) => x !== b && x.classList.remove("sel")); b.classList.add("sel"); segPlay(b.dataset.src, seek).then(() => requestAnimationFrame(tick)).catch(stopCur);
  if (!spr(b.dataset.src).b) getPeaks(b.dataset.src).then(() => drawWave(b, 0));
  const row = b.closest("[data-id]"), pm = location.pathname.match(/^\/pack\/([^/?#]+)/);
  track("play", row ? row.dataset.id : pm ? decodeURIComponent(pm[1]) : null, ($(".nm", b) || {}).textContent);
});
audio.addEventListener("ended", stopCur);
function tapPause() { const b = curBtn; if (!b) return; const f = segPos(); audio.pause(); if (f > 0.01 && f < 0.98) tapResume.set(b.dataset.src, f); else tapResume.delete(b.dataset.src); stopCur(); }
document.addEventListener("click", (e) => { if (curBtn && !e.composedPath().some((n) => n.matches && n.matches(".pv button, [data-rp]"))) { if (curBtn.closest("html.tapplay .pv")) { tapPause(); return; } audio.pause(); stopCur(); } });
/* side panel: one play button per pack = its best sound (p.best = file, else the first loop, else the first sound) */
const bestSound = (p) => (p.best && p.sounds.find((s) => s.file === p.best)) || p.sounds.find((s) => /^LOOP/i.test(s.name)) || p.sounds[0] || null;
let rpBtn = null;
function rpOff() { if (rpBtn) { rpBtn.classList.remove("on"); rpBtn.innerHTML = PLAY; } rpBtn = null; }
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-rp]"); if (!b) return;
  e.preventDefault();
  if (rpBtn === b) { audio.pause(); rpOff(); return; }
  stopCur(); rpOff(); rpBtn = b; b.classList.add("on"); b.innerHTML = STOP;
  audio.loop = false; segPlay(b.dataset.rp, 0).catch(rpOff);
  track("play", b.dataset.rpid, "side panel");
});
audio.addEventListener("ended", rpOff);
document.addEventListener("click", (e) => { if (e.target.closest(".pv button")) rpOff(); }, true);

/* CD shine: each glare gets its cover as a mask (CD shape only) */
function shineMask() { document.querySelectorAll(".pq, .bf-i").forEach((q) => { const im = q.querySelector("img"); if (!im) return; let g = q.querySelector(".gl"); if (!g) { g = document.createElement("i"); g.className = "gl"; q.appendChild(g); } const u = im.getAttribute("src"); if (u && q.dataset.m !== u) { q.dataset.m = u; q.style.setProperty("--m", `url("${im.src}")`); } }); }
if (CD_SHINE) { let smT = 0; new MutationObserver(() => { clearTimeout(smT); smT = setTimeout(shineMask, 150); }).observe(document.documentElement, { childList: true, subtree: true }); document.addEventListener("DOMContentLoaded", shineMask); }

/* plastic covers lean toward the mouse (desktop) */
if (matchMedia("(hover:hover)").matches) {
  document.addEventListener("pointermove", (e) => {
    let q = e.target.closest && e.target.closest(".pq");
    if (q && CD_HIT_CASE && !onCase(q, e)) q = null;   // Eman 19 Nov: only react when the mouse is ON the CD, not the empty space around it
    document.querySelectorAll(".pq.tl").forEach((x) => { if (x !== q) { const from = x.style.transform; x.classList.remove("tl"); x.style.transform = ""; x.firstElementChild.nextElementSibling.style.backgroundPosition = ""; x.style.removeProperty("--ga");
      if (CD_EASE_BACK && from && x.animate) { const to = getComputedStyle(x).transform; x.animate([{ transform: from }, { transform: to }], { duration: 650, easing: "cubic-bezier(.22,.7,.25,1)" }); } } });   // Eman 19 Nov: glide back, no snap
    if (!q) return;
    const r = q.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    q.classList.add("tl");
    q.style.transform = `perspective(800px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) translateY(-3px)`;
    q.querySelector(".gl").style.backgroundPosition = `${(50 + x * 80).toFixed(1)}% 50%, 0 0`;
    q.style.setProperty("--ga", (x * 140 + y * 60).toFixed(1) + "deg");
    if (CD_TILT_SHEEN) sheen(q, x, y);
  }, { passive: true });
}
/* visible case box of a cover (alpha > 40), cached per image as fractions of the img box */
function caseBox(im) {
  if (im._bbS === im.currentSrc && im._bb) return im._bb;
  if (!im.complete || !im.naturalWidth) return null;
  try { const N = 120, c = document.createElement("canvas"); c.width = N; c.height = N; const g = c.getContext("2d"); g.drawImage(im, 0, 0, N, N); const d = g.getImageData(0, 0, N, N).data;
    let x0 = N, y0 = N, x1 = -1, y1 = -1; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    im._bb = x1 < 0 ? null : [x0 / N, y0 / N, (x1 + 1) / N, (y1 + 1) / N]; im._bbS = im.currentSrc; return im._bb; } catch (err) { return null; }
}
function onCase(q, e) {
  const im = q.querySelector("img"); if (!im) return true; const bb = caseBox(im); if (!bb) return true;
  const r = im.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  return fx >= bb[0] && fx <= bb[2] && fy >= bb[1] && fy <= bb[3];
}
/* tilt sheen: a light band drawn on a canvas and cut to the cover's own shape (no CSS masks, they failed in Safari/Chrome before) */
const SHEEN_REAL = true;   // Eman 22 Nov: reflection covers the whole card/CD (follows object-fit, was stretched = clipped band on tall cards), weaker, and catches the scratches/texture as it moves. false = old bright band
function fitDraw(g, im, W, H) {   // draw im the way CSS shows it (object-fit cover/contain/fill, centred)
  const f = getComputedStyle(im).objectFit, nw = im.naturalWidth, nh = im.naturalHeight;
  if (f !== "cover" && f !== "contain") { g.drawImage(im, 0, 0, W, H); return; }
  const k = (f === "cover" ? Math.max : Math.min)(W / nw, H / nh), w = nw * k, h = nh * k; g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
}
function sheenTex(im, W, H) {   // cached per image + size: fine detail of the cover (scratches, dust, print edges) + faint plastic swirl hairlines
  const key = W + "x" + H + im.currentSrc; if (im._shk === key) return im._sht;
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const t = mk(), gt = t.getContext("2d");
  if ("filter" in gt) {
    const a = mk(), ga = a.getContext("2d"), b = mk(), gb = b.getContext("2d");
    ga.filter = "grayscale(1)"; fitDraw(ga, im, W, H); gb.filter = "grayscale(1) blur(" + Math.max(1.5, W / 260).toFixed(1) + "px)"; fitDraw(gb, im, W, H);
    ga.filter = "none"; ga.globalCompositeOperation = "difference"; ga.drawImage(b, 0, 0);
    gt.filter = "contrast(3.2) brightness(1.7)"; gt.drawImage(a, 0, 0); gt.filter = "none";
  }
  let sd = 0; for (const ch of im.currentSrc) sd = (sd * 31 + ch.charCodeAt(0)) >>> 0; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  gt.globalCompositeOperation = "lighter"; gt.lineCap = "round";
  for (let n = 0; n < 160; n++) { const r = (0.08 + rnd() * 0.5) * Math.min(W, H), a0 = rnd() * 6.283, len = 0.05 + rnd() * 0.35;
    gt.strokeStyle = `rgba(255,255,255,${(0.08 + rnd() * 0.22).toFixed(2)})`; gt.lineWidth = 0.5 + rnd() * 0.7; gt.beginPath(); gt.arc(W / 2, H / 2, r, a0, a0 + len); gt.stroke(); }
  for (let n = 0; n < 26; n++) { const x0 = rnd() * W, y0 = rnd() * H, an = rnd() * 6.283, l = (0.04 + rnd() * 0.22) * Math.min(W, H);
    gt.strokeStyle = `rgba(255,255,255,${(0.12 + rnd() * 0.25).toFixed(2)})`; gt.lineWidth = 0.5 + rnd() * 0.5; gt.beginPath(); gt.moveTo(x0, y0); gt.lineTo(x0 + Math.cos(an) * l, y0 + Math.sin(an) * l); gt.stroke(); }
  im._shk = key; im._sht = t; return t;
}
function sheenReal(q, x, y) {
  const im = q.querySelector("img"); if (!im || !im.complete || !im.naturalWidth) return;
  let c = q.querySelector("canvas.sh"); if (!c) { c = document.createElement("canvas"); c.className = "sh"; q.appendChild(c); }
  const k = Math.min(2, devicePixelRatio || 1), sc = Math.min(1, 900 / Math.max(im.offsetWidth * k, im.offsetHeight * k)), W = Math.round(im.offsetWidth * k * sc), H = Math.round(im.offsetHeight * k * sc); if (!W || !H) return;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  Object.assign(c.style, { left: im.offsetLeft + "px", top: im.offsetTop + "px", width: im.offsetWidth + "px", height: im.offsetHeight + "px" });
  const g = c.getContext("2d"), p = 0.5 + x * 1.3 + y * 0.35, D = Math.hypot(W, H), ux = W / D, uy = H / D;
  const band = (gg, stops) => { const lg = gg.createLinearGradient(0, 0, ux * D, uy * D); lg.addColorStop(0, "rgba(255,255,255,0)"); stops.forEach(([o, a]) => lg.addColorStop(Math.min(1, Math.max(0, p + o)), a)); lg.addColorStop(1, "rgba(255,255,255,0)"); return lg; };
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
  g.fillStyle = band(g, [[-0.34, "rgba(255,255,255,0)"], [-0.14, "rgba(200,190,255,.07)"], [0, "rgba(255,255,255,.26)"], [0.06, "rgba(255,255,255,.12)"], [0.16, "rgba(255,200,240,.09)"], [0.34, "rgba(255,255,255,0)"]]);
  g.fillRect(0, 0, W, H);
  let s = c._s; if (!s || s.width !== W || s.height !== H) { s = c._s = document.createElement("canvas"); s.width = W; s.height = H; }
  const gs = s.getContext("2d"); gs.globalCompositeOperation = "source-over"; gs.clearRect(0, 0, W, H); gs.drawImage(sheenTex(im, W, H), 0, 0);
  gs.globalCompositeOperation = "destination-in"; gs.fillStyle = band(gs, [[-0.24, "rgba(255,255,255,0)"], [-0.08, "rgba(255,255,255,.55)"], [0, "rgba(255,255,255,1)"], [0.1, "rgba(255,255,255,.5)"], [0.26, "rgba(255,255,255,0)"]]); gs.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.75; g.drawImage(s, 0, 0); g.globalAlpha = 1;
  g.globalCompositeOperation = "destination-in"; fitDraw(g, im, W, H);
  c.classList.add("on");
}
function sheen(q, x, y) {
  if (SHEEN_REAL) return sheenReal(q, x, y);

  const im = q.querySelector("img"); if (!im || !im.complete || !im.naturalWidth) return;
  let c = q.querySelector("canvas.sh"); if (!c) { c = document.createElement("canvas"); c.className = "sh"; q.appendChild(c); }
  const k = Math.min(2, devicePixelRatio || 1), W = Math.min(800, Math.round(im.offsetWidth * k)), H = Math.min(800, Math.round(im.offsetHeight * k)); if (!W || !H) return;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  Object.assign(c.style, { left: im.offsetLeft + "px", top: im.offsetTop + "px", width: im.offsetWidth + "px", height: im.offsetHeight + "px" });
  const g = c.getContext("2d"), p = 0.5 + x * 1.3 + y * 0.35;
  g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, W, H);
  const lg = g.createLinearGradient(0, 0, W, H * 0.8);
  const st = (o, a) => lg.addColorStop(Math.min(1, Math.max(0, p + o)), a);
  lg.addColorStop(0, "rgba(255,255,255,0)"); st(-0.3, "rgba(255,255,255,0)"); st(-0.12, "rgba(210,200,255,.3)"); st(0, "rgba(255,255,255,.8)"); st(0.05, "rgba(255,255,255,.3)"); st(0.14, "rgba(255,190,240,.45)"); st(0.3, "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "destination-in"; g.drawImage(im, 0, 0, W, H);
  c.classList.add("on");
}
/* the 3D bundle stack: the front CD gets the same streak, following the mouse over the stack */
if (CD_TILT_SHEEN && matchMedia("(hover:hover)").matches) document.addEventListener("pointermove", (e) => {
  const st = e.target.closest && e.target.closest(".bf-st"); let f = st && st.querySelector(".bf-i.on");
  if (f && CD_HIT_CASE && !onCase(f, e)) f = null;
  document.querySelectorAll(".bf-i canvas.sh.on").forEach((c) => { if (!f || c.parentNode !== f) c.classList.remove("on"); });
  if (!f) return; const r = st.getBoundingClientRect(); sheen(f, (e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
}, { passive: true });

/* ---------- loyalty meter (corner) ---------- */
const myEmail = () => { try { return localStorage.getItem("ck-email") || ""; } catch (e) { return ""; } };
const demoLoy = () => { try { return JSON.parse(localStorage.getItem("ck-loy-demo") || '{"paid":0,"used":0}'); } catch (e) { return { paid: 0, used: 0 }; } };
function loadLoyalty() {
  const em = myEmail(), d = demoLoy();
  const base = em ? fetch("/api/loyalty?email=" + encodeURIComponent(em)).then((r) => r.json()).catch(() => ({ paid: 0, used: 0 })) : Promise.resolve({ paid: 0, used: 0 });
  return base.then((b) => { const paid = (b.paid || 0) + d.paid, used = (b.used || 0) + d.used; LOY = { paid, picks: Math.floor(paid / LOY_N) - used, canWeekly: !!b.canWeekly, nextWeekly: b.nextWeekly || null, claimed: !!b.claimed, spent: b.spent || 0, cycle: b.cycle == null ? -1 : b.cycle }; paintLoy(); return LOY; });
}
const METER_START = 2;   // claiming the meter fills 2 of 5 right away (Eman 18 Nov)
/* points: every bar = 200 PTS, 1000 PTS = a free full pack (same rules as the 5 bars, shown as points) */
const PTS = 200, GOAL = LOY_N * PTS;
// points in the current 0-1000 cycle, minus what was spent on tools (mastering...) in that same cycle
const ptsOf = (bars) => Math.max(0, (bars % LOY_N) * PTS - (typeof LOY !== "undefined" && LOY && LOY.cycle === Math.floor(bars / LOY_N) ? LOY.spent || 0 : 0));
function liquid(pts, big) {   // 5 flat segments, 200 PTS each
  return `<div class="liq${big ? " big" : ""}">${[0, 1, 2, 3, 4].map((i) => `<i class="sgm${pts >= (i + 1) * PTS ? " full" : ""}"><b style="width:${Math.max(0, Math.min(1, (pts - i * PTS) / PTS)) * 100}%"></b></i>`).join("")}</div>`;
}
/* fill segment by segment: each one fills, snaps (tiny bounce + tick), short pause, then the next */
function fillTo(liq, num, from, to, done) {
  const segs = [...liq.querySelectorAll(".sgm")], SEG_MS = 750, PAUSE = 280;
  let cur = from;
  const next = () => {
    if (cur >= to) { if (done) done(); return; }
    const i = Math.floor(cur / PTS), segEnd = Math.min(to, (i + 1) * PTS), seg = segs[i % LOY_N], bar = seg && seg.firstElementChild;
    const a = cur, ms = SEG_MS * (segEnd - a) / PTS, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms), v = Math.round(a + (segEnd - a) * k);
      if (bar) bar.style.width = ((v - i * PTS) / PTS * 100) + "%"; if (num) num.textContent = String(v);
      if (k < 1) requestAnimationFrame(step);
      else { cur = segEnd; if (seg && segEnd % PTS === 0) { seg.classList.remove("snap"); void seg.offsetWidth; seg.classList.add("snap", "full"); tone(1175 + i * 120, 0, 0.07, "square", 0.035); } setTimeout(next, PAUSE); } };
    requestAnimationFrame(step);
  };
  next();
}

function loyHTML(paid, picks) {
  const pts = ptsOf(paid), k = paid % LOY_N, wk = LOY.claimed && k < LOY_N - 1;
  const nx = LOY.nextWeekly ? new Date(LOY.nextWeekly).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";
  return `<div class="loyh"><b>Points</b><span><em class="pn">${pts}</em><small> / ${GOAL}</small></span></div>
    ${liquid(pts)}
    ${cardLive() ? `<button class="loyc" data-mycard style="--cc:${cardDef().color}">★ ${esc(cardDef().name)} · ${esc(cardDef().label)}</button>` : ""}
    ${LOY.canWeekly && wk ? `<button class="btn acid sm loyw2" data-weekly>Collect weekly +${PTS} PTS</button>` : ""}
    <div class="loyt">${picks > 0 ? `<em>★ ${picks} free pack${picks > 1 ? "s" : ""} to pick</em> · ` : ""}${k === LOY_N - 1 ? "Last 200 PTS come with any purchase" : wk && !LOY.canWeekly && nx ? "Next +200 PTS " + esc(nx) : (GOAL - pts) + " more = free full pack"}</div>`;
}
function paintLoy() {
  if (!myEmail() && !LOY.paid) return;
  let el = $("#loy"); if (!el) { el = document.createElement("div"); el.id = "loy"; el.className = "loy"; document.body.appendChild(el); }
  el.innerHTML = loyHTML(LOY.paid, LOY.picks);
}
/* little game sound: coin blips, a chord when a free pack is earned */
function blip(i, big) {
  try {
    const C = blip.c || (blip.c = new (window.AudioContext || window.webkitAudioContext)()), t = C.currentTime;
    const notes = big ? [523, 659, 784, 1047] : [660 + i * 110, 990 + i * 110];
    notes.forEach((f, j) => { const o = C.createOscillator(), g = C.createGain(); o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + j * 0.07); g.gain.exponentialRampToValueAtTime(0.06, t + j * 0.07 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + j * 0.07 + (big ? 0.35 : 0.12));
      o.connect(g).connect(C.destination); o.start(t + j * 0.07); o.stop(t + j * 0.07 + 0.4); });
  } catch (e) {}
}
/* fill the meter one block at a time after a purchase */
function loyGain(n, quiet) {
  const start = LOY.paid; LOY.paid += n;
  let el = $("#loy"); if (!el) { el = document.createElement("div"); el.id = "loy"; el.className = "loy"; document.body.appendChild(el); }
  el.classList.add("big");
  const from = ptsOf(start), wrap = Math.floor((start % LOY_N + n) / LOY_N) > 0, to = wrap ? GOAL : ptsOf(start + n);
  el.innerHTML = loyHTML(start, LOY.picks);
  el.insertAdjacentHTML("beforeend", `<span class="plus">+${n * PTS}</span>`);
  setTimeout(() => {
    fillTo(el.querySelector(".liq"), el.querySelector(".pn"), from, to, () => {
      if (!quiet) blip(1, wrap);
      el.classList.add("land"); setTimeout(() => el.classList.remove("land"), 600);
      if (wrap) { LOY.picks = Math.floor(LOY.paid / LOY_N) - (LOY.used || 0); el.classList.add("win"); el.insertAdjacentHTML("beforeend", `<div class="loyw">1000 PTS · free full pack!</div>`); }
      setTimeout(() => { el.classList.remove("big", "win"); paintLoy(); }, wrap ? 2600 : 1800);
    });
  }, 350);
}

/* ---------- visits (only remembered after a yes) ---------- */
const consent = () => { try { return localStorage.getItem("ck-consent"); } catch (e) { return null; } };
function act() { try { return JSON.parse(localStorage.getItem("ck-act") || "null") || { visits: 0, first: Date.now(), last: 0, secs: 0, viewed: [] }; } catch (e) { return { visits: 0, first: Date.now(), last: 0, secs: 0, viewed: [] }; } }
const saveAct = (a) => { try { localStorage.setItem("ck-act", JSON.stringify(a)); } catch (e) {} };
let GAP = 0;   // days since the visit before this one
function trackVisit() {
  if (consent() !== "yes") return;
  const a = act();
  let fresh = false; try { fresh = !sessionStorage.getItem("ck-s"); sessionStorage.setItem("ck-s", "1"); } catch (e) {}
  if (fresh) { GAP = a.last ? (Date.now() - a.last) / 864e5 : 0; try { sessionStorage.setItem("ck-gap", String(GAP)); } catch (e) {} a.visits++; }
  else { try { GAP = +sessionStorage.getItem("ck-gap") || 0; } catch (e) {} }
  a.last = Date.now();
  const m = location.pathname.match(/^\/pack\/([^/?#]+)/); if (m && !a.viewed.includes(m[1])) a.viewed.push(m[1]);
  saveAct(a);
  setInterval(() => { if (document.visibilityState === "visible") { const b = act(); b.secs += 15; b.last = Date.now(); saveAct(b); } }, 15000);
}
const recOK = () => { try { return consent() === "yes" && localStorage.getItem("ck-rec") !== "0"; } catch (e) { return false; } };
function setConsent(yes, rec) {
  if (rec === undefined) rec = yes;
  try { localStorage.setItem("ck-consent", yes ? "yes" : "no"); localStorage.setItem("ck-rec", rec ? "1" : "0"); if (!yes) ["ck-act", "ck-vid", "ck-ref"].forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  const b = $("#consent"); if (b) b.remove();
  if (yes) { trackVisit(); loadClarity(); track("consent"); }
}
function consentBar() {
  if (consent() || $("#consent")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="consent" id="consent"><span>Can we use cookies for anonymous stats? No names, never sold.</span>
    <div class="cbtns"><button class="btn sm" data-consent="yes">Allow</button><button class="btn sm" data-consent="no">Only necessary</button></div>
    <button class="ckl" id="cMore">See more</button>
    <div class="cmore" id="cMoreTx" hidden>
      <label class="ctg"><input type="checkbox" disabled checked><span><b>Necessary</b> · cart, currency and the email you type, kept in this browser. Always on.</span></label>
      <label class="ctg"><input type="checkbox" id="cStats"><span><b>Stats</b> · a random visitor number, return visits, pages, clicks and sample plays. Stored by COREKULT on Cloudflare in the EU, deleted after 12 months.</span></label>
      <label class="ctg"><input type="checkbox" id="cRec"><span><b>Heatmaps + recordings</b> · clicks, scrolls and screen recordings by Microsoft Clarity, all typing blurred. Recordings kept 30 days, heatmaps 13 months.</span></label>
      <p class="cwhy">Why: to see which packs and sounds people like and make the shop easier to use. Never sold, never used for ads. Change or take back your choice any time with Cookies at the bottom of the page. Questions or delete requests: hello@corekult.com · <a href="/privacy">Privacy</a></p>
      <button class="btn sm" data-consent="pick">Save my choice</button>
    </div></div>`);
}
/* ---------- claim: one click, card spins ---------- */
function claimBlock(em) {
  let b = $("#frClaim");
  if (!b) { b = document.createElement("div"); b.id = "frClaim"; b.className = "claim"; $("#frList").after(b); }
  const has = cardLive();
  b.hidden = false;
  b.setAttribute("data-clarity-mask", "true");
  b.innerHTML = `<small>Is this you?</small><div class="me"><b>${esc(em)}</b><button id="claimEdit" aria-label="Change email">✎</button></div>
    <button class="btn acid wide" id="claimGo">${has ? "Show my card" : "Claim my deal card"}</button>`;
}
function claim() {
  const em = myEmail(); if (!em) return;
  if (cardLive() && CARD.email === em.toLowerCase()) { showCard(CARD, false); return; }
  $("#claimGo").disabled = true;
  fetch("/api/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: em }) })
    .then((r) => r.json()).then((r) => {
      $("#claimGo").disabled = false; if (!r.ok) return;
      track("claim", null, r.card.tier); CARD = r.card; try { localStorage.setItem("ck-card", JSON.stringify(CARD)); } catch (e) {}
      closeDrawer(); showCard(CARD, !r.again); paintLoy(); paintCart();
    }).catch(() => { $("#claimGo").disabled = false; });
}
const muted = () => { try { return localStorage.getItem("ck-mute") === "1"; } catch (e) { return false; } };
/* UI sounds (Eman 19 Nov 23:51), ported from KILLTOY 2's "Juice" sounds (ui/kt2-juice.js): every CD step while you
   scroll/drag the stack is one soft detent tick (same as a snap step of a pattern drag in KILLTOY), a little dry "land"
   when it settles, button notes on the arrows, a glassy pebble on the bundle cover buttons. Tiny synthesized blips, no files.
   Browsers only allow sound after the first click/tap; uses the site's existing sound switch (ck-mute). Flag UI_SFX. */
const UI_SFX = true;
const HERO_BG = true;   // Eman 19 Nov 23:41: a KILLTOY background behind the home hero, picked in admin (instant preview). false = plain hero
function heroBg(u) { const h = document.querySelector(".hero"); if (!h) return; const ok = /^\/img\/bg\/kt\d+\.webp$/.test(u || "");
  document.documentElement.classList.toggle("hbg", ok); if (ok) { h.style.setProperty("--hbg", `url("${u}")`); h.style.setProperty("--hbgm", `url("${u.replace(".webp", "-m.webp")}")`); } else { h.style.removeProperty("--hbg"); h.style.removeProperty("--hbgm"); } }   // -m = 900px copy for phones (hero-bg.css)
window.heroBg = heroBg;
const CREATOR_AT = true;   // Eman 19 Nov 23:43: "@name" + a small verified-style tag (no box) on creators. false = old purple box
if (CREATOR_AT) document.documentElement.classList.add("cat");
window.ckSfx = (function () {
  let ctx = null, out = null;
  const ac = () => { if (!UI_SFX || muted()) return null;
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 0.55;
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -8; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.08; out.connect(lim).connect(ctx.destination); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx && ctx.state === "running" ? ctx : null; };
  function tone(freq, dur, type, gain, slide, delay, lp) { const c = ac(); if (!c) return;
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain || 0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o; if (lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; f.Q.value = 0.4; o.connect(f); node = f; }
    node.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.03); }
  function noise(dur, gain, freq, type, delay) { const c = ac(); if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = type || "lowpass"; f.frequency.value = freq || 1500; g.gain.value = gain || 0.05;
    s.buffer = b; s.connect(f).connect(g).connect(out); s.start(c.currentTime + (delay || 0)); }
  const PENTA = [370, 440, 494, 554, 659, 740, 880, 988, 1109, 1319, 1480, 1760];
  let lastStep = 0, si = 0;
  const S = {
    step: (dir, speed) => { const c = ac(); if (!c || c.currentTime - lastStep < 0.03) return; lastStep = c.currentTime;   // KILLTOY pattern-drag detent
      const f = 300 * (dir < 0 ? 0.96 : 1.03) * (1 + (speed || 0) * 0.25); tone(f, 0.018, "sine", 0.045, f * 0.9, 0, 1300); noise(0.006, 0.01, 700, "lowpass"); },
    land: () => { tone(1250, 0.018, "triangle", 0.03, 1500, 0, 5200); tone(2500, 0.008, "sine", 0.01, null, 0.004, 6000); },
    button: (dir) => { const f = dir < 0 ? 554 : 659; tone(f, 0.05, "triangle", 0.022, null, 0, 3600); },
    press: () => { const f = PENTA[3 + (si++ % 7)] * 2; tone(f, 0.035, "sine", 0.03, f * 0.82, 0, 6400); tone(f * 2.76, 0.012, "triangle", 0.008, null, 0, 9000); noise(0.004, 0.014, 5600, "bandpass"); },
  };
  // first tap/click anywhere unlocks audio (browser rule)
  const unlock = () => { if (!muted()) ac(); removeEventListener("pointerdown", unlock, true); removeEventListener("keydown", unlock, true); };
  addEventListener("pointerdown", unlock, true); addEventListener("keydown", unlock, true);
  return (kind, ...a) => { try { if (S[kind]) S[kind](...a); } catch (e) {} };
})();

function setMute(m) { try { localStorage.setItem("ck-mute", m ? "1" : "0"); } catch (e) {} const b = $("#cardMute"); if (b) b.classList.toggle("off", m); document.querySelectorAll(".sfxm").forEach((x) => { x.classList.toggle("off", m); x.setAttribute("aria-pressed", String(!m)); }); }
function tone(f, at, len, type, vol) {
  if (muted()) return;
  try {
    const C = blip.c || (blip.c = new (window.AudioContext || window.webkitAudioContext)()), t = C.currentTime + at, o = C.createOscillator(), g = C.createGain();
    o.type = type || "square"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(C.destination); o.start(t); o.stop(t + len + 0.05);
  } catch (e) {}
}
const fmtDate = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
function showCard(card, spin) {
  const c = (DEALS.cards || []).find((x) => x.id === card.tier); if (!c) return;
  closeCard();
  document.body.insertAdjacentHTML("beforeend", `<div class="cardov" id="cardOv" data-clarity-mask="true">
    <button class="cardmute${muted() ? " off" : ""}" id="cardMute" aria-label="Sound on or off"><svg viewBox="0 0 16 16"><path d="M2 6h3l4-3v10l-4-3H2z"/><path class="w" d="M11 5.5c1 .8 1 4.2 0 5M12.8 4c2 1.6 2 6.4 0 8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button>
    <button class="x" id="cardX" aria-label="Close">×</button>
    <div class="dstage"><div class="dcard${spin ? " spin" : ""}" id="dCard" style="--cc:${c.color}">
      <div class="dface dback"><img src="/img/logo-white.png?v=2" alt="COREKULT"><i class="gl"></i></div>
      <div class="dface dfront"><span class="drar">${esc(c.name)}</span><span class="dyour">Your card</span><b class="ddeal">${esc(c.label)}</b>
        <span class="dcode">${esc(card.code)}</span><span class="dexp">Use by ${fmtDate(card.exp)}</span><i class="gl"></i></div>
    </div></div>
    <p class="dnote">Your card is based on your activity with this email. Works at checkout with ${esc(card.email || myEmail())}.</p>
    <div class="dbtns"><a class="btn acid" href="/checkout${QS}">Use it now</a><button class="btn" id="cardLater">Later</button></div>
  </div>`);
  document.body.classList.add("lock");
  if (!spin) return;
  // ticks slow down as the card turns, then a chord when it lands
  let t = 0; for (let i = 0; i < 11; i++) { t += 0.06 + i * i * 0.0065; tone(900 - i * 30, t, 0.05, "square", 0.035); }
  [523, 659, 784, 1047, 1319].forEach((f, j) => tone(f, 2.75 + j * 0.06, 0.6, "triangle", 0.06));
  setTimeout(() => { const d = $("#dCard"); if (d) d.classList.add("landed"); }, 2750);
}
function closeCard() { const o = $("#cardOv"); if (o) { o.remove(); document.body.classList.remove("lock"); } }

/* ---------- stats: anonymous counts; visitor id, referral memory and recordings only after cookie OK ---------- */
let CLARITY = "";
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
(function catchRef() {
  let r = ""; try { r = (new URLSearchParams(location.search).get("ref") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40); } catch (e) {}
  if (!r) return;
  try { sessionStorage.setItem("ck-ref", r); } catch (e) {}
  if (consent() === "yes") try { localStorage.setItem("ck-ref", JSON.stringify({ r, ts: Date.now() })); } catch (e) {}
})();
function getRef() {
  try { const s = sessionStorage.getItem("ck-ref"); if (s) return s; } catch (e) {}
  if (consent() !== "yes") return null;
  try { const l = JSON.parse(localStorage.getItem("ck-ref") || "null"); if (l && Date.now() - l.ts < 30 * 864e5) return l.r; } catch (e) {}
  return null;
}
function ids() {
  if (consent() !== "yes") return {};
  let vid = "", sid = "";
  try { vid = localStorage.getItem("ck-vid") || ""; if (!vid) { vid = rid(); localStorage.setItem("ck-vid", vid); } } catch (e) {}
  try { sid = sessionStorage.getItem("ck-sid") || ""; if (!sid) { sid = rid(); sessionStorage.setItem("ck-sid", sid); } } catch (e) {}
  return { vid, sid };
}
let evQ = [], evT = 0;
function track(t, pack, x, val) {
  if (DRAFT) return;
  evQ.push({ t, pack: pack || null, x: x == null ? null : String(x), val: val == null ? null : val });
  clearTimeout(evT); evT = setTimeout(flushEv, 600);
}
function flushEv() {
  if (!evQ.length) return;
  const body = JSON.stringify({ e: evQ.splice(0, 20), ref: getRef(), ...ids() });
  if (!(navigator.sendBeacon && navigator.sendBeacon("/api/ev", new Blob([body], { type: "text/plain" })))) fetch("/api/ev", { method: "POST", body, keepalive: true }).catch(() => {});
  if (evQ.length) flushEv();
}
addEventListener("pagehide", flushEv);
/* Microsoft Clarity heatmaps + recordings: only after OK; inputs are masked by Clarity, private bits marked data-clarity-mask */
function loadClarity() {
  if (!recOK() || !CLARITY || window.clarity) return;
  (function (c, l, a, r, i) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; const t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i; const y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, "clarity", "script", CLARITY);
  window.clarity("consent");
}

/* ---------- free sampler toast: after 10 s on the site, once; CLAIM puts it in the cart at 0 ---------- */
const FREE_ID = "free-sampler";
function freeToast() {
  if (!GIFT_TOAST) return;   // Eman 18 Nov: off for now (it popped up in a random spot); set GIFT_TOAST = true to bring it back
  if (document.body.classList.contains("land") || document.getElementById("bnBar")) return;   // landing pages: no gift popups, the download comes first
  const f = byId(FREE_ID); if (!f || inCart(FREE_ID) || $("#ftoast")) return;
  try { if (localStorage.getItem("ck-free-seen")) return; } catch (e) { return; }
  let t0 = 0; try { t0 = +sessionStorage.getItem("ck-t0") || Date.now(); sessionStorage.setItem("ck-t0", String(t0)); } catch (e) { t0 = Date.now(); }
  setTimeout(() => {
    if (inCart(FREE_ID) || $("#ftoast") || location.pathname === "/checkout") return;
    try { localStorage.setItem("ck-free-seen", "1"); } catch (e) {}
    document.body.insertAdjacentHTML("beforeend", `<div class="ftoast" id="ftoast"><span class="pq"><img src="${esc(abs(f.cover))}" alt=""><i class="gl"></i></span>
      <div><small>Gift</small><b>You got a free sample pack</b><span>${esc(f.count)} · ${money(0)}</span></div>
      <button class="btn acid" data-claimfree>Add free</button><button class="x" data-ftx aria-label="Close">×</button></div>`);
    blipSoft();
  }, Math.max(500, 10000 - (Date.now() - t0)));
}
function blipSoft() { if (consent() === null) return; [880, 1320].forEach((f, j) => tone(f, j * 0.08, 0.15, "triangle", 0.03)); }
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-claimfree]")) { if ($("#ftoast")) $("#ftoast").remove(); try { localStorage.setItem("ck-free-seen", "1"); } catch (er) {} if (!inCart(FREE_ID)) { cart.unshift(FREE_ID); saveCart(); track("free", FREE_ID, "toast"); } paintCart(); openCart(); document.dispatchEvent(new Event("ck-cart")); return; }
  if (e.target.closest("[data-ftx]")) { $("#ftoast").remove(); }
  if (e.target.closest("[data-phoneview]")) {   // DEV ONLY: this page in a phone-sized frame
    if ($("#pvw")) { $("#pvw").remove(); return; }
    document.body.insertAdjacentHTML("beforeend", `<div class="pvw" id="pvw"><div class="ph"><iframe src="${esc(location.href)}" title="Phone view"></iframe></div><button class="btn acid sm pvx" data-phoneview>Close phone view</button></div>`);
  }
  if (e.target.closest("[data-devreset]")) {   // DEV ONLY: see the site like a first visit. Remove before launch (DEV_RESET).
    try { Object.keys(localStorage).filter((k) => k.startsWith("ck-")).forEach((k) => localStorage.removeItem(k)); sessionStorage.clear(); } catch (er) {}
    location.href = e.target.closest("[data-devreset]").dataset.devreset || location.pathname;
  }
});
const DEV_RESET = true;
/* side cart panel on wide screens (home); the pack page has its own */
/* ---------- the bundle box: sticky cart that fills up slot by slot ----------
   All offer words live in LADDER so the deal can be swapped (3 for 2 now; maybe 20/35/50% tiers later). */
const LADDER = {
  size: 3,
  title: "Your bundle",
  msg: (k, n) => !n ? "Pick 3 packs · pay for 2" : k === 3 ? "Unlocked · 1 pack free" : k === 2 ? "Add 1 more → it's FREE" : "Add 2 more · 1 pack free",
  slot: (i) => (i === 2 ? "FREE" : "+"),
};
/* Eman 20 Nov: no bundle box until something is in the cart (BOX_HIDE_EMPTY), and a bigger, clearer box (BOX_V2). false = old behaviour. */
const BOX_HIDE_EMPTY = true, BOX_V2 = true;
let boxSeen = -1, boxWasEmpty = true;
function cartBox() {
  const deal = dealCart(), k = dealStep(), n = deal.length, start = n ? n - k : 0, cur = deal.slice(start, start + LADDER.size);
  const fresh = boxSeen >= 0 && n > boxSeen; boxSeen = n;
  if (BOX_HIDE_EMPTY && !cart.length) { boxWasEmpty = true; return ""; }
  const arrive = boxWasEmpty && boxSeen >= 0 && fresh; boxWasEmpty = false;
  if (BOX_V2) return cartBox2(deal, k, n, cur, fresh, arrive);
  const fs = byId(FREE_ID), hasFs = inCart(FREE_ID);
  const slots = [...Array(LADDER.size)].map((_, i) => { const q = cur[i] && byId(cur[i]);
    return q ? `<a class="bslot on${fresh && i === cur.length - 1 ? " pop" : ""}${freeIds().includes(q.id) ? " fr" : ""}" href="${packUrl(q.id)}" title="${esc(q.name)}"><img src="${esc(abs(q.cover))}" alt="">${freeIds().includes(q.id) ? "<em>FREE</em>" : ""}</a>`
      : `<span class="bslot${i === 2 ? " gift" : ""}">${LADDER.slot(i)}</span>`; }).join("");
  const rows = cart.map(byId).filter(Boolean).map((q) => `<div class="brow"><span>${esc(q.name)}</span><em>${q.freebie || freeIds().includes(q.id) ? "FREE" : q.id === pickId() ? "FREE PICK" : show(q.price)}</em></div>`).join("");
  const save = subtotal() - total();
  return `<div class="bbox${fresh ? " bump" : ""}">
    <div class="bhd"><b>${esc(LADDER.title)}</b><button class="bmute${muted() ? " off" : ""}" data-mute aria-label="Sound on or off" title="Sound"><svg viewBox="0 0 16 16"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path class="w" d="M11 5.5c1 .8 1 4.2 0 5M12.8 4c2 1.6 2 6.4 0 8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button><span>${cart.length}</span></div>
    ${fs ? hasFs ? `<div class="bfree on"><img src="${esc(abs(fs.cover))}" alt=""><span><b>Free sampler</b><small>In your bundle · ${money(0)}</small></span><i>✓</i></div>`
      : `<button class="bfree" data-claimfree><img src="${esc(abs(fs.cover))}" alt=""><span><b>Free sampler</b><small>Yours, tap to add</small></span><i>+</i></button>` : ""}
    <div class="bmsg">${esc(LADDER.msg(k, n))}</div>
    <div class="bslots">${slots}</div>
    ${rows ? `<div class="brows">${rows}</div>${meterLine()}${save > 0 ? `<div class="bsave">You save ${show(save)}</div>` : ""}<a class="btn acid wide" href="/checkout${QS}">Checkout · ${show(total())}</a>` : ""}
  </div>`;
}
/* v2 box: big slots with a label under each, the free slot clearly marked, one plain line on what to do next */
function cartBox2(deal, k, n, cur, fresh, arrive) {
  const fs = byId(FREE_ID), hasFs = inCart(FREE_ID), frees = freeIds();
  const slots = [...Array(LADDER.size)].map((_, i) => { const q = cur[i] && byId(cur[i]), gift = i === LADDER.size - 1;
    const tag = q ? (frees.includes(q.id) ? "FREE" : show(q.price)) : gift ? "Free" : "Pack " + (i + 1);
    const box = q ? `<a class="bs2 on${fresh && i === cur.length - 1 ? " pop" : ""}${gift ? " gift" : ""}" href="${packUrl(q.id)}" title="${esc(q.name)}"><img src="${esc(abs(q.cover))}" alt="">${frees.includes(q.id) ? "<em>FREE</em>" : ""}</a>`
      : gift ? `<span class="bs2 gift"><b>FREE</b><small>on us</small></span>`
      : `<span class="bs2"><b>+</b></span>`;
    return `<div class="bsc${gift ? " g" : ""}">${box}<small class="${q && !frees.includes(q.id) ? "" : gift ? "y" : ""}">${q ? esc(q.name) : tag}</small>${q ? `<i>${tag}</i>` : ""}</div>`; }).join("");
  const rows = cart.map(byId).filter(Boolean).filter((q) => q.id === FREE_ID || !cur.includes(q.id)).map((q) => `<div class="brow"><span>${esc(q.name)}</span><em>${q.freebie || frees.includes(q.id) ? "FREE" : q.id === pickId() ? "FREE PICK" : show(q.price)}</em></div>`).join("");
  const save = subtotal() - total(), left = LADDER.size - k;
  const next = !n ? "Pick 3 packs, pay for 2" : k === LADDER.size ? "Done! 1 pack is free" : left === 1 ? "Add 1 more pack and it's FREE" : `Add ${left} more packs · the 3rd is FREE`;
  return `<div class="bbox v2${fresh ? " bump" : ""}${arrive ? " arrive" : ""}">
    <div class="bhd"><b>${esc(LADDER.title)}</b><button class="bmute${muted() ? " off" : ""}" data-mute aria-label="Sound on or off" title="Sound"><svg viewBox="0 0 16 16"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path class="w" d="M11 5.5c1 .8 1 4.2 0 5M12.8 4c2 1.6 2 6.4 0 8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button><span>${cart.length}</span></div>
    <div class="bmsg2"><small>Pick 3 · pay for 2</small><b>${esc(next)}</b></div>
    <div class="bslots bsl2">${slots}</div>
    ${fs ? hasFs ? `<div class="bfree on"><img src="${esc(abs(fs.cover))}" alt=""><span><b>Free sampler</b><small>In your bundle · ${money(0)}</small></span><i>✓</i></div>`
      : `<button class="bfree" data-claimfree><img src="${esc(abs(fs.cover))}" alt=""><span><b>Free sampler</b><small>A gift, tap to add</small></span><i>+</i></button>` : ""}
    ${rows ? `<div class="brows">${rows}</div>` : ""}${meterLine()}${save > 0 ? `<div class="bsave">You save ${show(save)}</div>` : ""}<a class="btn acid wide bgo" href="/checkout${QS}">Checkout · ${show(total())}</a>
  </div>`;
}
function sideCart() {
  let el = $("#sideCart");
  if (!el) { if (!document.body.classList.contains("home")) return; el = document.createElement("aside"); el.id = "sideCart"; el.className = "sidecart"; document.body.appendChild(el); }
  el.innerHTML = cartBox();
  el.hidden = BOX_HIDE_EMPTY && !cart.length;
}

/* ---------- the meter claim: offered right after a free download, one tap, reuses the email ----------
   Honest: the download never depends on it. Claiming saves the meter to the email (no password).
   The drops box is separate and unticked. */
/* what points buy (Eman 18 Nov). Mastering: set live:true once corekult.com/tools/mastering is up (built in another thread). */
const SPEND = [
  { id: "master", name: "Mastering", cost: 50, url: "/tools/mastering", live: true, ic: '<path d="M2 12h2V6H2zm4 0h2V3H6zm4 0h2V7h-2zm4 0h0" fill="currentColor"/><path d="M1 14h14" stroke="currentColor" stroke-width="1.4"/>' },
  { id: "stems", name: "Stem splitter", cost: 0, url: "", live: false, ic: '<path d="M8 2v4M8 6L3 10v4M8 6l5 4v4M8 6v8" fill="none" stroke="currentColor" stroke-width="1.6"/>' },
  { id: "pack", name: "Free full pack", cost: 1000, url: "/", live: true, ic: '<rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.6"/>' },
];
function spendHTML(have) {
  return `<div class="spd"><small>Use your points on</small><div class="spg">${SPEND.map((x) => {
    const inner = `<svg viewBox="0 0 16 16" aria-hidden="true">${x.ic}</svg><b>${x.name}</b><span>${x.live ? (have >= x.cost && x.cost < GOAL ? `${x.cost} PTS · ${Math.floor(have / x.cost)} with your ${have}` : `${x.cost} PTS`) : x.cost ? `${x.cost} PTS · soon` : "Coming soon"}</span>`;
    return x.live && x.url ? `<a class="spt" href="${x.url}" target="_blank" rel="noopener">${inner}</a>` : `<div class="spt off">${inner}</div>`; }).join("")}</div></div>`;
}
function meterOffer(em, anchor, where, done) {
  if ($("#mOffer")) $("#mOffer").remove();
  const gift = METER_START * PTS;
  const el = document.createElement("div"); el.id = "mOffer"; el.className = "moffer"; el.setAttribute("data-clarity-mask", "true");
  el.innerHTML = `<div class="mot">Points for your free sample</div>
    <div class="mon"><span class="pts"><em id="moPts">0</em><small>/ ${GOAL} PTS</small></span><span class="plus" id="moPlus">+${gift}</span></div>
    ${liquid(0, true)}
    <div class="mol"><b>${GOAL - gift} more = a free full pack you pick</b><span>Every pack you buy also gives +${PTS} PTS</span></div>
    ${spendHTML(gift)}
    <div class="moe"><small>Your account</small><b>${esc(em)}</b></div>
    <label class="optin"><input type="checkbox" id="moDrops"><span>Also email me new drops and free packs (max 2 a month, unsubscribe any time)</span></label>
    <button class="btn acid wide" id="moGo">Join the KULT free</button>
    <div class="mog">+${gift} PTS now · +${PTS} free PTS every week · ${GOAL} PTS = a free full pack</div>
    <span class="nocard"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>No card information needed</span>
    <small class="mof mof1">Creates your free COREKULT account with this email, no password. We'll email you when your weekly points are ready · unsubscribe any time.</small>
    <button class="ckl" id="moNo">No thanks, just the download</button>
    <small class="mof">Weekly points go up to 800; the last 200 come with any purchase. </small>`;
  where === "after" ? anchor.after(el) : anchor.appendChild(el);
  setTimeout(() => {
    el.classList.add("in");
    setTimeout(() => { el.classList.add("go");
      fillTo(el.querySelector(".liq"), $("#moPts"), 0, gift, () => { tone(988, 0, 0.08, "square", 0.04); tone(1319, 0.08, 0.25, "square", 0.04); el.classList.add("land"); burst(el.querySelector(".liq")); }); }, 450);
  }, 30);
  $("#moGo").onclick = () => {
    $("#moGo").disabled = true;
    fetch("/api/free", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: em, meter: true, drops: !!$("#moDrops").checked }) })
      .then((r) => r.json()).then(() => {
        track("claim", null, "meter");
        el.classList.add("saved");
        el.querySelector(".mot").textContent = "Welcome to the KULT ✓";
        el.querySelectorAll(".moe,.optin,.mof,.nocard,.mog").forEach((x) => x.remove());
        $("#moGo").remove(); $("#moNo").remove();
        el.querySelector(".mol span").textContent = "Next +200 PTS next week, or buy any pack to get them now. Works on any device with this email.";
        loadLoyalty(); if (done) done(true);
      })
      .catch(() => { $("#moGo").disabled = false; });
  };
  $("#moNo").onclick = () => { el.remove(); if (done) done(false); };
}
function burst(at) {
  if (!at) return; const r = at.getBoundingClientRect(), fs = [...at.querySelectorAll(".sgm b")].filter((b) => parseFloat(b.style.width) > 0), f = (fs.pop() || at).getBoundingClientRect();
  for (let i = 0; i < 14; i++) { const p = document.createElement("i"); p.className = "spk"; const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
    p.style.left = f.right - r.left + "px"; p.style.top = r.height / 2 + "px"; p.style.setProperty("--x", Math.cos(a) * d + "px"); p.style.setProperty("--y", Math.sin(a) * d + "px"); at.appendChild(p); setTimeout(() => p.remove(), 800); }
}

/* ---------- "works with" row: only what really ships in the pack ----------
   Per pack: p.formats = ["serum1","serum2","midi","wav","vital","ableton"]. Default: preset packs = Serum 1 + 2 (Eman: no MIDI badge), drum kits = WAV.
   Vital / Ableton switch on per pack once converted files exist (add them to p.formats). */
const FORMATS = {
  serum1: { n: "Serum 1", i: '<path d="M1 9c2-6 4-6 6 0s4 6 6 0" fill="none" stroke="currentColor" stroke-width="1.7"/>' },
  serum2: { n: "Serum 2", i: '<path d="M1 9c2-6 4-6 6 0s4 6 6 0" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M14 3v4M16 3v4" stroke="currentColor" stroke-width="1.2"/>' },
  vital: { n: "Vital", url: "https://vital.audio", note: "(free synth)", i: '<path d="M2 3l6 11 6-11" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
  ableton: { n: "Ableton Wavetable", i: '<path d="M2 3v10M5 3v10M8 3v10M11 8h5M11 11h5M11 5h5" stroke="currentColor" stroke-width="1.5"/>' },
  midi: { n: "MIDI", i: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="5" cy="8" r="1" fill="currentColor"/><circle cx="11" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="5" r="1" fill="currentColor"/><circle cx="6" cy="5.8" r=".01"/>' },
  wav: { n: "WAV · any DAW", i: '<path d="M2 8h1M4 5v6M6 3v10M8 6v4M10 2v12M12 5v6M14 8h1" stroke="currentColor" stroke-width="1.4"/>' },
};
// VISUAL_FORMATS: Eman 18 Nov, show Vital + Ableton badges now, before the converted files exist.
// MUST be true before real sales: ship Vital + Ableton files in every preset pack, or set this to false (admin launch list).
const VISUAL_FORMATS = true;
const formatsOf = (p) => { const f = p.formats || (p.type === "drums" ? ["wav"] : ["serum1", "serum2"]); return VISUAL_FORMATS && f.includes("serum1") ? [...new Set([...f, "vital", "ableton"])] : f; };
function worksWith(p, label) {
  const f = formatsOf(p).filter((k) => FORMATS[k]);
  return `<div class="ww"><small>${esc(label || "Works with")}</small><div class="wwl">${f.map((k) => { const F = FORMATS[k], inner = `<svg viewBox="0 0 16 16" aria-hidden="true">${F.i}</svg>${esc(F.n)}${F.note ? ` <i class="wwn">${esc(F.note)}</i>` : ""}`;
    return F.url ? `<a class="wwb wwl2" href="${F.url}" target="_blank" rel="noopener" title="Download ${esc(F.n)} free">${inner}</a>` : `<span class="wwb">${inner}</span>`; }).join("")}</div></div>`;
}

/* VITAL_POP (Eman 20 Nov): the free-synth badge first opens a small card saying it's free for anyone, with the download link inside. false = badge links straight out */
const VITAL_POP = true;
document.addEventListener("click", (e) => {
  if (!VITAL_POP) return;
  const old = document.querySelector(".wwpop"), a = e.target.closest && e.target.closest(".wwb.wwl2");
  if (old && !e.target.closest(".wwpop")) old.remove();
  if (!a || old && old._for === a) return;
  e.preventDefault();
  const name = (a.textContent || "").replace(/\(.*\)/, "").trim(), r = a.getBoundingClientRect(), el = document.createElement("div");
  el.className = "wwpop"; el._for = a;
  el.innerHTML = `<b>${esc(name)} is free</b><p>A free synth anyone can download and use, on Mac, Windows and Linux. No paid synth needed.</p><a class="btn acid" href="${esc(a.href)}" target="_blank" rel="noopener">Get ${esc(name)} free ↗</a>`;
  document.body.appendChild(el);
  const w = el.offsetWidth; el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + "px"; el.style.top = r.bottom + scrollY + 8 + "px";
}, true);

/* ---------- phones + narrow screens: the bundle box as a bar stuck to the bottom ---------- */
let mbSeen = -1;
function mobBar() {
  if (location.pathname === "/checkout" || !document.querySelector("nav.top")) return;
  let el = $("#mobBar");
  if (!el) { el = document.createElement("div"); el.id = "mobBar"; el.className = "mobbar"; document.body.appendChild(el); }
  const deal = dealCart(), k = dealStep(), n = deal.length, start = n ? n - k : 0, cur = deal.slice(start, start + 3);
  const fresh = mbSeen >= 0 && n > mbSeen; mbSeen = n;
  el.hidden = !cart.length && (BOX_HIDE_EMPTY || !location.pathname.startsWith("/pack/"));
  if (BOX_V2) { el.classList.add("v2"); const left = 3 - k;
    el.innerHTML = `<div class="mbm"><b>${esc(!n ? "Pick 3 · pay for 2" : k === 3 ? "Done! 1 pack is free" : left === 1 ? "Add 1 more · it's FREE" : "Add 2 more · 3rd is FREE")}</b><small>${cart.length} in bundle · ${show(total())}</small></div>
    <div class="mbs">${[0, 1, 2].map((i) => { const q = cur[i] && byId(cur[i]); return q ? `<span class="on${fresh && i === cur.length - 1 ? " pop" : ""}${i === 2 ? " gift" : ""}"><img src="${esc(abs(q.cover))}" alt="">${freeIds().includes(q.id) ? "<em>FREE</em>" : ""}</span>` : `<span class="${i === 2 ? "gift" : ""}">${i === 2 ? "FREE" : "+"}</span>`; }).join("")}</div>
    <a class="btn acid" href="/checkout${QS}">Checkout</a>`;
    document.body.classList.toggle("hasmb", !el.hidden); return; }
  el.innerHTML = `<div class="mbs">${[0, 1, 2].map((i) => { const q = cur[i] && byId(cur[i]); return q ? `<span class="on${fresh && i === cur.length - 1 ? " pop" : ""}"><img src="${esc(abs(q.cover))}" alt=""></span>` : `<span class="${i === 2 ? "gift" : ""}">${i === 2 ? "FREE" : "+"}</span>`; }).join("")}</div>
    <div class="mbm"><b>${esc(LADDER.msg(k, n))}</b>${cart.length ? `<small>${cart.length} in cart · ${show(total())}</small>` : `<small>Mix any packs</small>`}</div>
    ${cart.length ? `<a class="btn acid" href="/checkout${QS}">Checkout</a>` : ""}`;
  document.body.classList.toggle("hasmb", !el.hidden);
}

/* weekly bar: one claimable bar a week, up to 4 of 5 (the 5th needs a buy) */
function claimWeekly(btn) {
  const em = myEmail(); if (!em) return; btn.disabled = true;
  fetch("/api/weekly", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: em }) })
    .then((r) => r.json()).then((r) => { LOY.canWeekly = false; if (r.nextWeekly) LOY.nextWeekly = r.nextWeekly; if (r.ok) { track("claim", null, "weekly"); loyGain(1); } else paintLoy(); })
    .catch(() => { btn.disabled = false; });
}

/* ---------- creators (aliases, Eman 18 Nov): one per pack line, I and II share one ---------- */
const creatorOf = (p) => p && (CREATORS.find((c) => (c.packs || []).includes(p.id)) || CREATORS.find((c) => (c.worlds || []).includes(p.world))) || null;
const creatorUrl = (c) => "/creator/" + encodeURIComponent(c.id) + QS;
const AVATAR_ART = false;
const packsOf = (c) => PRODUCTS.filter((p) => creatorOf(p) === c);
function avatarHTML(c, cls) {
  const ini = esc(String(c.name).replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase());
  // Eman 18 Nov: avatar = cover of one of the creator's packs for now (old drawn avatars kept: set AVATAR_ART = true)
  const pk = packsOf(c).find((p) => p.type !== "drums") || packsOf(c)[0], src = AVATAR_ART && c.avatar ? c.avatar : pk ? abs(pk.cover) : c.avatar;
  return `<span class="av ${cls || ""}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<i>${ini}</i></span>`;
}
function creatorStrip(p) {
  const c = creatorOf(p); if (!c) return "";
  return `<a class="mby" href="${creatorUrl(c)}">${avatarHTML(c)}<span><small>Made by</small><b>${CREATOR_AT ? "@" : ""}${esc(c.name)}</b><em>${esc(c.vibe)}</em></span><span class="ccb">COREKULT creator</span></a>`;
}

/* sounds grouped by category (BASS, LEAD...), loops first: pack page + bundle page */
function groupedHTML(list, pid) {
  const NICE = { BASS: "Basslines", ARP: "Arps", LEAD: "Leads", PAD: "Pads", PLUCK: "Plucks", KEYS: "Keys", CHORD: "Chords", BELL: "Bells", FLUTE: "Flutes", "808": "808s", SYNTH: "Synths", FX: "FX", TEXTURE: "Textures", VOX: "Vox", SAW: "Saws", CHIP: "Chip", STAB: "Stabs", KICK: "Kicks", SNARE: "Snares", CLAP: "Claps", HAT: "Hats", OPEN: "Open hats", CRASH: "Crashes", PERC: "Percs", LOOP: "Loops", GUITAR: "Guitars", CHOIR: "Choirs", BRASS: "Brass", ORGAN: "Organs", PIANO: "Pianos", STRINGS: "Strings" };
  const groups = new Map();
  list.forEach((x) => { const k = String(x.name).split(/\s+/)[0].toUpperCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
  if (SONG_GROUP) NICE.SONG = "Song sounds";
  const top = (k) => (SONG_GROUP && k === "SONG" ? 2 : k === "LOOP" ? 1 : 0);   // SONG_GROUP off = old order (loops first)
  const rk = secRank(pid || ((list[0] || {})._pid), top);
  return [...groups].sort((a, b) => rk(b[0]) - rk(a[0])).map(([k, l]) => `<h3 class="sg">${esc(NICE[k] || (k.charAt(0) + k.slice(1).toLowerCase() + "s"))}<span>${l.length}</span></h3>
    <div class="pv big">${sounds({ sounds: l.map((x) => ({ ...x, _tc: tcOf(x.name, k), name: String(x.name).split(/\s+/).length > 1 ? String(x.name).replace(/^\S+\s+/, "") : x.name })) })}</div>`).join("");
}

/* speed: start fetching a pack page (and its cover) the moment a finger or mouse lands on its link */
const pf = new Set();
function prefetchPack(a) {
  const u = a.getAttribute("href"); if (!u || pf.has(u)) return; pf.add(u);
  const l = document.createElement("link"); l.rel = "prefetch"; l.href = u; document.head.appendChild(l);
  const m = u.match(/^\/pack\/([^/?#]+)/), p = m && byId(decodeURIComponent(m[1])); if (p) { const i = new Image(); i.src = abs(p.cover); }
}
["pointerover", "touchstart", "focusin"].forEach((ev) => document.addEventListener(ev, (e) => { const a = e.target.closest && e.target.closest('a[href^="/pack/"]'); if (a) prefetchPack(a); }, { passive: true }));
