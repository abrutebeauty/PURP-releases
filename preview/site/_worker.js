// COREKULT backend (Cloudflare Pages advanced mode).
// Needs in Cloudflare Pages > corekult > Settings:
//   KV binding  CK         -> KV namespace "corekult"   (pack data, uploads, sales)
//   Secret      ADMIN_KEY  -> Eman's admin key (Eman types it, nobody else)
//   Secret      PAYHIP_KEY -> optional, Payhip API key, to check webhook signatures
// Without CK the shop falls back to the static products.json and admin is read-only.

const JSON_H = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { ...JSON_H, ...h } });
const enc = new TextEncoder();

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function cookie(req, name) {
  const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}
// session cookie = "<expiry>.<hmac(ADMIN_KEY, expiry)>"
const METER_START = 2;
// the meter for one email. WEEK = 7 days. Weekly bars only while the current round is below 4 of 5.
async function meterState(env, req, em) {
  const N = 5, WEEK = 7 * 86400e3;
  const sales = (await env.CK.get("sales", "json")) || [];
  const refunded = new Set(sales.filter((x) => x.type === "refunded").map((x) => x.id));
  const bought = sales.filter((x) => x.type !== "refunded" && !refunded.has(x.id) && x.email === em).reduce((n, x) => n + (x.paidItems || 0), 0);
  const used = Number((await env.CK.get("loyused:" + em)) || 0);
  const leads = (await env.CK.get("leads", "json")) || [], l = leads.find((x) => x.email === em);
  const claimed = !!(l && l.meter !== false);
  const bonus = claimed ? METER_START + (l.weekly || 0) : 0;   // claiming the meter starts it at 2 of 5 (Eman 18 Nov)
  const total = bought + bonus;
  const last = l ? Date.parse(l.weeklyAt || l.meterAt || l.first || 0) || 0 : 0;
  const nextWeekly = claimed ? new Date(last + WEEK).toISOString() : null;
  const capped = total % N >= N - 1;
  // points spent on tools (mastering...) come out of the current 0-1000 cycle; a new cycle starts clean
  const sp = (await env.CK.get("spent:" + em, "json")) || {}, cycle = Math.floor(total / N), spent = sp.cycle === cycle ? sp.pts || 0 : 0;
  const pts = Math.max(0, (total % N) * 200 - spent);
  return { total, used, bought, claimed, capped, nextWeekly, canWeekly: claimed && !capped && Date.now() >= last + WEEK, spent, cycle, pts };
}

async function isAdmin(req, env) {
  if (!env.ADMIN_KEY) return false;
  const c = cookie(req, "ck_admin");
  if (!c) return false;
  const [exp, sig] = c.split(".");
  if (!exp || !sig || +exp < Date.now()) return false;
  return sig === (await hmac(env.ADMIN_KEY, exp));
}

/* EUR for Europe, USD for everyone else (the Nordics too, Eman's call) */
const EURO = new Set("AT BE BG HR CY CZ EE FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES GB CH LI AD MC SM VA AL BA ME MK RS XK MD UA GI IM JE GG FO".split(" "));
const payCurrency = (c) => (EURO.has(String(c).toUpperCase()) ? "EUR" : "USD");
const FX_FALLBACK = { EUR: 1, USD: 1.08, GBP: 0.85, SEK: 11.4, NOK: 11.7, DKK: 7.46, CHF: 0.95, PLN: 4.3, CZK: 25.2, HUF: 395, RON: 4.97, BGN: 1.96, ISK: 150, TRY: 37, CAD: 1.5, AUD: 1.65, NZD: 1.8, JPY: 165, KRW: 1480, CNY: 7.8, HKD: 8.4, SGD: 1.45, INR: 91, IDR: 17300, MYR: 4.9, PHP: 62, THB: 37, BRL: 6.2, MXN: 20, ZAR: 19.5, ILS: 4 };
async function fxRates() {
  const cache = caches.default, key = new Request("https://corekult.com/__fx");
  const hit = await cache.match(key); if (hit) return hit.json();
  let rates = FX_FALLBACK;
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR", { cf: { cacheTtl: 21600 } });
    if (r.ok) { const d = await r.json(); if (d && d.rates) rates = { EUR: 1, ...d.rates }; }
  } catch (e) {}
  await cache.put(key, new Response(JSON.stringify(rates), { headers: { "content-type": "application/json", "cache-control": "max-age=21600" } }));
  return rates;
}
/* ---------- stats (D1 "DB"): anonymous events, visitor id only after cookie OK ---------- */
let dbReady = false;
async function db(env) {
  if (!env.DB) return null;
  if (!dbReady) {
    await env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS ev (ts INTEGER, day TEXT, t TEXT, pack TEXT, x TEXT, ref TEXT, vid TEXT, sid TEXT, country TEXT, dev TEXT, val REAL)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS ev_day ON ev(day)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS ev_ref ON ev(ref)"),
    ]);
    dbReady = true;
  }
  return env.DB;
}
const EV_TYPES = new Set(["view", "pack", "play", "cart", "checkout", "buy", "free", "claim", "consent"]);
const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
const LOOK_ON = true;   // Eman 20 Nov: site-wide sound-box look (colours, wave/box/marker styles, per row, top preview) set from the admin. false = old
async function settings(env) { return (env.CK && (await env.CK.get("settings", "json"))) || {}; }
async function fileDeals(env, req) {
  try { return (await (await env.ASSETS.fetch(new Request(new URL("/products.json", req.url)))).json()).deals || null; } catch (e) { return null; }
}
const GATE_CODE = "stekpanna";
const TEMP_ADMIN_KEY = "stekpanna";   // Eman chose this for now; change it by adding ADMIN_KEY in Cloudflare
async function sha(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function gatePage(next, bad) {
  const e = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>COREKULT</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0a0e;color:#ecebf0;font:14px/1.4 Inter,"Helvetica Neue",Arial,sans-serif;padding:16px}
form{width:min(340px,100%);display:flex;flex-direction:column;gap:10px}h1{font:900 22px/1 Inter,Arial,sans-serif;letter-spacing:.22em;margin:0 0 14px;text-align:center}
input{font:700 14px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;padding:14px;background:#17161d;color:#ecebf0;border:1px solid ${bad ? "#ff4d4d" : "rgba(255,255,255,.1)"};outline:none;text-align:center;border-radius:0}
input:focus{border-color:#8b6cf6}button{font:800 11px/1 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;padding:14px;background:#e4ff3a;color:#0b0a0e;border:0;cursor:pointer}</style></head>
<body><form method="post" action="/__gate"><h1>COREKULT</h1><input type="hidden" name="next" value="${e(next)}"><input name="code" type="password" placeholder="CODE" autocomplete="off" autofocus aria-label="Code"><button>Enter</button></form></body></html>`,
    { status: 401, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
// red skull (Eman 19 Nov): heavily distorted / texture-like sounds. Suggestions in /skulls.json keyed by sound file (sprite end dropped);
// a sound's own skull true/false (admin toggle) always wins.
async function skulls(d, env, req) {
  try {
    const m = (await (await env.ASSETS.fetch(new Request(new URL("/skulls.json", req.url)))).json()).files || {};
    const sk = (u) => String(u || "").replace(/,[\d.]+$/, "");
    d.products.forEach((p) => (p.sounds || []).forEach((s) => { if (s.skull === undefined && m[sk(s.file)]) s.skull = true; }));
  } catch (e) {}
  return d;
}
async function loadPacks(env, req, fast) { return skulls(await loadPacks0(env, req, fast), env, req); }
// fast = true is passed ONLY by the public GET /api/products: its packs read may be served from the KV edge cache for as little as 30 s (the KV minimum; default is 60 s). Admin, SSR and /api/wd reads are unchanged.
async function loadPacks0(env, req, fast) {
  if (env.CK) {
    const d = await env.CK.get("packs", fast ? { type: "json", cacheTtl: 30 } : "json");
    if (d) {   // saved edits win; previews added to products.json later still show up (with their waveforms)
      try {
        const f = await (await env.ASSETS.fetch(new Request(new URL("/products.json", req.url)))).json();
        const fb = Object.fromEntries(f.products.map((p) => [p.id, p]));
        f.products.forEach((q) => { if (!d.products.some((p) => p.id === q.id)) { const fi = d.products.findIndex((p) => p.freebie); if (q.freebie || fi < 0) d.products.push(q); else d.products.splice(fi, 0, q); } });   // packs added to products.json later (and site-made freebies) show up
        d.worlds = d.worlds || []; (f.worlds || []).forEach((w) => { if (!d.worlds.some((x) => x.id === w.id)) d.worlds.push(w); });
        const TRASH_KEEP = true;   // 20 Nov (Eman): removed sounds go to TRASH and must not come back from products.json. false = old behaviour
        const gone = new Set(TRASH_KEEP ? [...(d.trash || []).map((t) => t.sound && t.sound.file), ...(d.gone || [])] : []);
        d.products.forEach((p) => {
          const q = fb[p.id]; if (!q) return;
          if (q.cover && String(p.cover || "").startsWith("img/") && p.cover !== q.cover) p.cover = q.cover;   // site-file covers follow products.json (admin uploads /f/... still win)
          const qs = Object.fromEntries((q.sounds || []).map((s) => [s.file, s]));
          p.sounds = p.sounds || [];
          // 19 Nov: audio facts follow products.json (waveforms re-made after trims; sprite end times moved). Key = file up to the sprite end, so "x.mp3#t=1.2,3.4" still matches "x.mp3#t=1.2,3.1"
          const sk = (u) => String(u || "").replace(/,[\d.]+$/, ""), qk = Object.fromEntries((q.sounds || []).map((s) => [sk(s.file), s]));
          p.sounds.forEach((s) => { const q2 = qs[s.file] || qk[sk(s.file)]; if (!q2) return; if (q2.file !== s.file) s.file = q2.file; if (q2.wd) s.wd = q2.wd; else if (q2.w && !s.w) s.w = q2.w; });
          const have = new Set(p.sounds.map((s) => s.file));
          (q.sounds || []).forEach((s) => { if (!have.has(s.file) && !gone.has(s.file)) p.sounds.push(s); });
        });
      } catch (e) {}
      return d;
    }
  }
  const r = await env.ASSETS.fetch(new Request(new URL("/products.json", req.url)));
  const d = await r.json();
  d.products.forEach((p) => { p.status = p.status || "live"; });
  return d;
}

// 20 Nov (first-click bug): audio previews must answer byte ranges with 206 + Accept-Ranges, or browsers can't jump into a
// sound that isn't downloaded yet and the first wave click plays from 0:00. Pages sometimes answers "bytes=0-" with a plain 200
// and never sends Accept-Ranges. This makes every audio answer rangeable. AUDIO_RANGES = false: hand audio straight to Pages again.
const AUDIO_RANGES = true;
// SPEED_CACHE (speed thread 27 Nov): let browsers keep static files instead of re-asking the server on every click.
// Images/audio with ?v= keep 1 day, other images/audio 5 min (then refreshed in the background), fonts and cut audio clips 1 year.
// JS, CSS, pages and the API are untouched (still re-checked every time), so code changes show at once. false = old behaviour (always re-ask)
const SPEED_CACHE = true;
const CK_CD_VER = "23";   // keep in step with CD_VER in shop.js (pack + bundle preloads use it)
function speedCache(req, r) {
  if (!SPEED_CACHE || req.method !== "GET" || !r || (r.status !== 200 && r.status !== 206)) return r;
  const u = new URL(req.url), p = u.pathname, ct = r.headers.get("content-type") || "";
  if (/text\/html|json/.test(ct) || p.startsWith("/admin") || p.startsWith("/api/")) return r;
  let cc = "";
  if (/^\/fonts\/.+\.woff2?$/.test(p) || /^\/audio\/sp\/[^/]+\/[\d.]+-[\d.]+\.mp3$/.test(p)) cc = "public, max-age=31536000, immutable";
  else if (/\.(webp|avif|jpe?g|png|svg|gif|mp3|wav|ogg|m4a|ico)$/i.test(p)) cc = u.searchParams.has("v") ? "public, max-age=86400, stale-while-revalidate=604800" : "public, max-age=300, stale-while-revalidate=86400";
  if (!cc) return r;
  const h = new Headers(r.headers); h.set("cache-control", cc);
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}
async function audioRange(req, env) {
  const r = await env.ASSETS.fetch(req), rg = req.headers.get("range"), m = rg && /^bytes=(\d*)-(\d*)$/.exec(rg.trim());
  if (r.status !== 200 || !m || (m[1] === "" && m[2] === "")) { const h = new Headers(r.headers); if (r.status === 200 || r.status === 206) h.set("accept-ranges", "bytes"); return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h }); }
  const buf = await r.arrayBuffer(), n = buf.byteLength;
  let a, b; if (m[1] === "") { a = Math.max(0, n - +m[2]); b = n - 1; } else { a = +m[1]; b = m[2] === "" ? n - 1 : Math.min(n - 1, +m[2]); }
  if (a >= n || a > b) return new Response(null, { status: 416, headers: { "content-range": `bytes */${n}`, "accept-ranges": "bytes" } });
  const h = new Headers(r.headers); h.set("accept-ranges", "bytes"); h.set("content-range", `bytes ${a}-${b}/${n}`); h.set("content-length", String(b - a + 1)); h.delete("content-encoding");
  return new Response(buf.slice(a, b + 1), { status: 206, headers: h });
}
// GUARDLOOK-BEGIN (26 Nov): server-side guard for the admin save. look (incl. look.ck, look.ckShapes) and cats are only
// replaced by a save that sends the header X-Look-Edit: 1. Any other save (old admin pages holding a stale copy) keeps what is stored.
const GUARD_FIELDS = ["look", "cats"];
function stableJson(v) {
  if (v === undefined) return "undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableJson(v[k])).join(",") + "}";
}
// returns { merged: {look, cats}, kept: a real incoming change was dropped, changed: stored value differs from what will be saved }
function guardLook(stored, incoming, hasLookEditHeader) {
  const s = stored && typeof stored === "object" ? stored : {}, inc = incoming && typeof incoming === "object" ? incoming : {};
  const merged = {}; let kept = false, changed = false;
  GUARD_FIELDS.forEach((f) => {
    const sv = s[f] == null ? undefined : s[f], iv = inc[f] == null ? undefined : inc[f];
    let out;
    if (iv === undefined) out = sv;                 // incoming omits it: keep what is stored
    else if (sv === undefined) out = iv;            // nothing stored yet: accept incoming
    else if (hasLookEditHeader) out = iv;           // sanctioned look edit
    else { out = sv; if (stableJson(iv) !== stableJson(sv)) kept = true; }   // no header: stored wins, flag it if a real difference was dropped
    merged[f] = out;
    if (stableJson(out) !== stableJson(sv)) changed = true;
  });
  return { merged, kept, changed };
}
// GUARDLOOK-END
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (!env.ADMIN_KEY) env = { ...env, ADMIN_KEY: TEMP_ADMIN_KEY };   // temporary (Eman 19 Nov): a Cloudflare secret ADMIN_KEY replaces this

    // ---------- private preview gate (Eman 19 Nov): the whole site asks for a code. Turn off: GATE_CODE = "" ----------
    if (GATE_CODE && p !== "/api/payhip") {
      const tok = "g" + (await sha(GATE_CODE + ":corekult-gate")).slice(0, 32);
      const has = (req.headers.get("cookie") || "").split(/;\s*/).includes("ck_gate=" + tok);
      if (p === "/__gate" && req.method === "POST") {
        const f = await req.formData().catch(() => null), code = String((f && f.get("code")) || "").trim().toLowerCase();
        let next = String((f && f.get("next")) || "/"); if (!next.startsWith("/") || next.startsWith("//")) next = "/";
        if (code === GATE_CODE) return new Response(null, { status: 303, headers: { location: next, "set-cookie": `ck_gate=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}` } });
        return gatePage(next, true);
      }
      if (!has) {
        if (p.startsWith("/api/")) return json({ ok: false, error: "gate" }, 401);
        if (p === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
        return gatePage(p + url.search, false);
      }
    }

    // ---------- public ----------
    if (p === "/api/wd") {   // WD_LAZY (speed 20 Nov): waveform strings for one pack, { file: wd }
      const id = String(url.searchParams.get("id") || ""), d = await loadPacks(env, req);
      const x = d.products.find((q) => q.id === id && (q.status || "live") === "live"), out = {};
      if (x) (x.sounds || []).forEach((s) => { if (!s.hidden && s.wd) out[s.file] = s.wd; });
      return new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
    }
    if (p === "/api/products") {
      const d = await loadPacks(env, req, true);
      const products = d.products.filter((x) => (x.status || "live") === "live")
        .map(({ notes, reviewUrl, status, cdDesign, prevHist, ...x }) => ({ ...x, sounds: (x.sounds || []).filter((s) => !s.hidden).map(({ mark, note, srcTag, skull, fix, ...s }) => { if (skull) s = { ...s, skull: true }; if (mark && LOOK_ON) s = { ...s, top: true }; return s; }) }));   // LOOK_ON (Eman 20 Nov): ★ favorites lead the top preview
      if (url.searchParams.get("lite") === "1") products.forEach((x) => { x.sounds = x.sounds.map(({ wd, ...s }) => s); });   // WD_LAZY (speed 20 Nov): waves come from /api/wd per pack
      const country = (req.cf && req.cf.country) || req.headers.get("cf-ipcountry") || "";
      const st = await settings(env);
      return json({ currency: d.currency, pay: payCurrency(country), country, worlds: d.worlds, heroBg: d.heroBg || "", look: LOOK_ON ? d.look || null : null, cats: d.cats || null, bundleMix: d.bundleMix || null, products, deals: d.deals || (await fileDeals(env, req)), clarity: st.clarityId || "" }, 200, { "cache-control": "no-store, max-age=0", "cdn-cache-control": "no-store", "cloudflare-cdn-cache-control": "no-store" });   // no CDN or dashboard cache rule may keep this
    }
    if (p.startsWith("/f/")) {                       // uploaded covers / previews
      if (!env.CK) return new Response("not found", { status: 404 });
      const o = await env.CK.getWithMetadata("file:" + decodeURIComponent(p.slice(3)), "arrayBuffer");
      if (!o.value) return new Response("not found", { status: 404 });
      return new Response(o.value, { headers: { "content-type": (o.metadata && o.metadata.type) || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (p === "/api/payhip" && req.method === "POST") {   // Payhip webhook: paid / refunded
      if (!env.CK) return json({ ok: false }, 503);
      const b = await req.json().catch(() => null);
      if (!b) return json({ ok: false }, 400);
      if (env.PAYHIP_KEY && b.signature !== (await sha256(env.PAYHIP_KEY))) return json({ ok: false }, 401);
      const sales = (await env.CK.get("sales", "json")) || [];
      const items = Array.isArray(b.items) ? b.items : [{ product_key: b.product_key, product_name: b.product_name, price: b.price }];
      sales.push({
        id: b.id || crypto.randomUUID(), type: b.type || "paid", date: b.date ? new Date(b.date * 1000 || b.date).toISOString() : new Date().toISOString(),
        total: Number(b.price || items.reduce((s, i) => s + Number(i.price || 0), 0)) / 100,   // Payhip sends cents
        currency: b.currency || "EUR", country: b.ip_country || b.country || "", items: items.map((i) => ({ key: i.product_key, name: i.product_name })),
        coupon: b.coupon_code || "", via: b.payment_type || "", email: String(b.email || "").toLowerCase(),
        paidItems: items.filter((i) => Number(i.price || 0) > 0).length,
      });
      await env.CK.put("sales", JSON.stringify(sales));
      return json({ ok: true });
    }

    // ---------- login ----------
    if (p === "/api/login" && req.method === "POST") {
      if (!env.ADMIN_KEY) return json({ ok: false, error: "setup" }, 503);
      const b = await req.json().catch(() => ({}));
      if (typeof b.key !== "string" || (await sha256(b.key)) !== (await sha256(env.ADMIN_KEY))) {
        await new Promise((r) => setTimeout(r, 800));
        return json({ ok: false }, 401);
      }
      const exp = String(Date.now() + 30 * 864e5);
      return json({ ok: true }, 200, { "set-cookie": `ck_admin=${exp}.${await hmac(env.ADMIN_KEY, exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 86400}` });
    }
    if (p === "/api/loyalty") {   // the meter: paid packs + 2 bars for claiming + 1 claimable bar a week (weekly bars stop at 4/5; the 5th needs a buy)
      const em = String(url.searchParams.get("email") || "").trim().toLowerCase();
      if (!env.CK || !em) return json({ paid: 0, used: 0 });
      const st = await meterState(env, req, em);
      return json({ paid: st.total, used: st.used, bought: st.bought, canWeekly: st.canWeekly, nextWeekly: st.nextWeekly, claimed: st.claimed, spent: st.spent, cycle: st.cycle, pts: st.pts });
    }
    if (p === "/api/spend" && req.method === "POST") {   // spend points on a tool; the price lives here, never trusted from the page
      const TOOLS = { master: 50 };
      let b = {}; try { b = await req.json(); } catch (e) {}
      const em = String(b.email || "").trim().toLowerCase(), tool = String(b.tool || ""), cost = TOOLS[tool];
      if (!env.CK || !em || !cost) return json({ ok: false, error: "bad" }, 400);
      const st = await meterState(env, req, em);
      if (!st.claimed) return json({ ok: false, error: "noclaim", pts: 0 }, 409);
      if (st.pts < cost) return json({ ok: false, error: "low", pts: st.pts, cost }, 409);
      const sp = (await env.CK.get("spent:" + em, "json")) || {}, same = sp.cycle === st.cycle;
      const log = (sp.log || []).concat({ tool, cost, ref: String(b.ref || "").slice(0, 80), at: new Date().toISOString() }).slice(-200);
      await env.CK.put("spent:" + em, JSON.stringify({ cycle: st.cycle, pts: (same ? sp.pts || 0 : 0) + cost, log }));
      return json({ ok: true, pts: st.pts - cost, cost });
    }
    if (p === "/api/weekly" && req.method === "POST") {   // claim this week's bar
      let b = {}; try { b = await req.json(); } catch (e) {}
      const em = String(b.email || "").trim().toLowerCase();
      if (!env.CK || !em) return json({ ok: false }, 400);
      const st = await meterState(env, req, em);
      if (!st.canWeekly) return json({ ok: false, error: st.claimed ? (st.capped ? "cap" : "wait") : "noclaim", nextWeekly: st.nextWeekly }, 409);
      const leads = (await env.CK.get("leads", "json")) || [], l = leads.find((x) => x.email === em);
      l.weekly = (l.weekly || 0) + 1; l.weeklyAt = new Date().toISOString();
      await env.CK.put("leads", JSON.stringify(leads));
      const after = await meterState(env, req, em);
      return json({ ok: true, paid: after.total, used: after.used, nextWeekly: after.nextWeekly });
    }
    if (p === "/api/claim" && req.method === "POST") {
      { const dl = (env.CK && ((await env.CK.get("packs", "json")) || {}).deals) || (await fileDeals(env, req)) || {}; if (dl.enabled === false) return json({ ok: false, error: "off" }, 403); }   // deal card is off until Eman approves
      let b = {}; try { b = await req.json(); } catch (e) {}
      const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "email" }, 400);
      const deals = (env.CK && ((await env.CK.get("packs", "json")) || {}).deals) || (await fileDeals(env, req)) || {};
      const cards = deals.cards || [], ids = cards.map((c) => c.id);
      const now = Date.now(), day = 864e5;
      if (env.CK) {
        const old = await env.CK.get("card:" + email, "json");
        if (old && now - old.spun < (deals.cooldownDays || 30) * day) return json({ ok: true, again: true, card: old });
      }
      // tier comes from what this email has done with us (first-party), never from cookies
      let tier = "common";
      if (env.CK) {
        const leads = (await env.CK.get("leads", "json")) || [], l = leads.find((x) => x.email === email) || {};
        const sales = (await env.CK.get("sales", "json")) || [];
        const paid = sales.filter((x) => x.type !== "refunded" && x.email === email).reduce((n, x) => n + (x.paidItems || 0), 0);
        const age = l.first ? (now - Date.parse(l.first)) / day : 0, free = (l.packs || []).length;
        if (paid >= 2 || age >= 30) tier = "legend";
        else if (free >= 3 && paid === 0) tier = "epic";
        else if (free >= 2 || age >= 1) tier = "rare";
      }
      if (!ids.includes(tier)) tier = ids[0];
      const code = "CK-" + [...crypto.getRandomValues(new Uint8Array(6))].map((x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");
      const card = { tier, code, email, spun: now, exp: now + (deals.expiryDays || 7) * day, used: false };
      if (env.CK) await env.CK.put("card:" + email, JSON.stringify(card), { expirationTtl: 60 * 60 * 24 * 90 });
      return json({ ok: true, card });
    }
    if (p === "/api/ev" && req.method === "POST") {
      const D = await db(env); if (!D) return json({ ok: true });
      let b = {}; try { b = JSON.parse(await req.text()); } catch (e) { return json({ ok: false }, 400); }
      const evs = (Array.isArray(b.e) ? b.e : []).filter((x) => x && EV_TYPES.has(x.t)).slice(0, 20);
      if (!evs.length) return json({ ok: true });
      const now = Date.now(), day = new Date(now).toISOString().slice(0, 10), country = (req.cf && req.cf.country) || "";
      const dev = /Mobi|Android|iPhone|iPad/i.test(req.headers.get("user-agent") || "") ? "phone" : "desktop";
      const ins = D.prepare("INSERT INTO ev (ts, day, t, pack, x, ref, vid, sid, country, dev, val) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
      if (Math.random() < 0.01) await D.prepare("DELETE FROM ev WHERE ts < ?").bind(now - 365 * 864e5).run();   // keep 12 months
      await D.batch(evs.map((x) => ins.bind(now, day, x.t, clip(x.pack, 60), clip(x.x, 120), clip(b.ref, 40), clip(b.vid, 40), clip(b.sid, 40), country, dev, Number(x.val) || null)));
      return json({ ok: true });
    }
    if (p.startsWith("/r/")) {   // short tracking link: corekult.com/r/<code>
      const code = decodeURIComponent(p.slice(3)).toLowerCase();
      const links = (env.CK && (await env.CK.get("links", "json"))) || [];
      const l = links.find((x) => x.code === code);
      const to = new URL(l && l.pack ? (l.to === "get" ? "/get/" : "/pack/") + encodeURIComponent(l.pack) : "/", req.url);
      if (l) to.searchParams.set("ref", l.code);
      return Response.redirect(to.toString(), 302);
    }
    if (p === "/api/fx") return json({ base: "EUR", rates: await fxRates() }, 200, { "cache-control": "public, max-age=3600" });
    if (p === "/api/free" && req.method === "POST") {   // free pack for an email: save the email for Eman
      let b = {}; try { b = await req.json(); } catch (e) {}
      const email = String(b.email || "").trim().toLowerCase().slice(0, 200), pack = String(b.pack || "").slice(0, 80);
      let isNew = !env.CK;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "email" }, 400);
      if (env.CK) {
        const leads = (await env.CK.get("leads", "json")) || [];
        let l = leads.find((x) => x.email === email);
        if (!l) { l = { email, packs: [], first: new Date().toISOString(), country: (req.cf && req.cf.country) || "", meter: false }; leads.push(l); isNew = true; }
        if (pack && !l.packs.includes(pack)) l.packs.push(pack);
        if (b.meter === true && !l.meter) { l.meter = true; l.meterAt = new Date().toISOString(); l.weeklyMail = true; }   // joined the KULT: weekly "your points are ready" email was stated by the button
        if (b.drops === true && !l.drops) { l.drops = true; l.dropsAt = new Date().toISOString(); l.dropsSrc = "sampler"; }
        l.last = new Date().toISOString();
        await env.CK.put("leads", JSON.stringify(leads));
      }
      return json({ ok: true, isNew });
    }
    if (p === "/api/optin" && req.method === "POST") {   // ticked "send me drops" (checkout): only ever sets yes, never from a default
      let b = {}; try { b = await req.json(); } catch (e) {}
      const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || b.drops !== true) return json({ ok: false }, 400);
      if (env.CK) {
        const leads = (await env.CK.get("leads", "json")) || [];
        let l = leads.find((x) => x.email === email);
        if (!l) { l = { email, packs: [], first: new Date().toISOString(), country: (req.cf && req.cf.country) || "" }; leads.push(l); }
        if (!l.drops) { l.drops = true; l.dropsAt = new Date().toISOString(); l.dropsSrc = String(b.src || "checkout").slice(0, 20); }
        await env.CK.put("leads", JSON.stringify(leads));
      }
      return json({ ok: true });
    }
    if (p === "/unsub") {   // one-click unsubscribe link for every marketing email: /unsub?e=<email>&t=<hmac>
      const email = String(url.searchParams.get("e") || "").toLowerCase(), t = url.searchParams.get("t") || "";
      const ok = env.ADMIN_KEY && env.CK && t === (await hmac(env.ADMIN_KEY, "unsub:" + email));
      if (ok) { const leads = (await env.CK.get("leads", "json")) || []; const l = leads.find((x) => x.email === email); if (l) { l.drops = false; l.unsubAt = new Date().toISOString(); await env.CK.put("leads", JSON.stringify(leads)); } }
      return new Response(`<!doctype html><meta name=viewport content="width=device-width"><body style="background:#0b0a0e;color:#ecebf0;font:16px system-ui;display:grid;place-items:center;height:90vh;text-align:center"><div><h2>${ok ? "You're unsubscribed." : "Link not valid."}</h2><p>${ok ? "No more drop emails. Your packs and downloads still work." : "Write to hello@corekult.com and we'll take you off."}</p><a style="color:#e4ff3a" href="/">Back to COREKULT</a></div>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (p === "/api/reviews") {   // approved reviews per pack (public)
      const all = (env.CK && (await env.CK.get("reviews", "json"))) || [];
      const pk = url.searchParams.get("pack") || "";
      const ok = all.filter((r) => r.ok && (!pk || r.pack === pk));
      return json({ ok: true, reviews: ok.map(({ pack, stars, text, name, at }) => ({ pack, stars, text, name, at })) });
    }
    if (p === "/api/review" && req.method === "POST") {   // new review: waits for Eman's OK in the admin
      let b = {}; try { b = await req.json(); } catch (e) {}
      const stars = Math.max(1, Math.min(5, Math.round(+b.stars || 0))), pack = String(b.pack || "").slice(0, 80);
      if (!pack || !stars) return json({ ok: false }, 400);
      if (env.CK) {
        const all = (await env.CK.get("reviews", "json")) || [];
        if (all.length > 2000) return json({ ok: false, error: "full" }, 429);
        all.push({ id: crypto.randomUUID().slice(0, 8), pack, stars, text: String(b.text || "").slice(0, 400), name: String(b.name || "").slice(0, 30), email: String(b.email || "").toLowerCase().slice(0, 200), at: new Date().toISOString(), ok: false });
        await env.CK.put("reviews", JSON.stringify(all));
      }
      return json({ ok: true });
    }
    if (p === "/api/logout") return json({ ok: true }, 200, { "set-cookie": "ck_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });

    // ---------- private pages + api ----------
    const priv = p === "/admin" || p.startsWith("/admin/") || p === "/work" || p.startsWith("/work/") || p.startsWith("/api/admin/");
    if (priv) {
      const ok = await isAdmin(req, env);
      if (!ok) {
        if (p.startsWith("/api/")) return json({ ok: false, error: env.ADMIN_KEY ? "login" : "setup" }, 401);
        return Response.redirect(new URL("/login?next=" + encodeURIComponent(p), req.url).toString(), 302);
      }
      if (p === "/api/admin/state") {
        return json({ packs: await loadPacks(env, req), sales: env.CK ? (await env.CK.get("sales", "json")) || [] : [], leads: env.CK ? (await env.CK.get("leads", "json")) || [] : [], storage: !!env.CK, webhook: new URL("/api/payhip", req.url).toString() });
      }
      if (p === "/api/admin/stats") {
        const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
        const from = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
        const D = await db(env);
        const links = (env.CK && (await env.CK.get("links", "json"))) || [];
        const st = await settings(env);
        if (!D) return json({ ok: true, db: false, links, settings: st });
        const q = (sql, ...a) => D.prepare(sql).bind(...a).all().then((r) => r.results);
        const [perDay, totals, visitors, returning, packs, plays, sounds, countries, devs, refs] = await Promise.all([
          q("SELECT day, t, COUNT(*) n FROM ev WHERE day >= ? GROUP BY day, t", from),
          q("SELECT t, COUNT(*) n FROM ev WHERE day >= ? GROUP BY t", from),
          q("SELECT COUNT(DISTINCT vid) n, COUNT(DISTINCT sid) s FROM ev WHERE day >= ? AND vid IS NOT NULL", from),
          q("SELECT COUNT(*) n FROM (SELECT vid FROM ev WHERE day >= ? AND vid IS NOT NULL GROUP BY vid HAVING COUNT(DISTINCT sid) > 1)", from),
          q("SELECT pack, t, COUNT(*) n FROM ev WHERE day >= ? AND pack IS NOT NULL GROUP BY pack, t", from),
          q("SELECT pack, x, COUNT(*) n FROM ev WHERE day >= ? AND t = 'play' GROUP BY pack, x ORDER BY n DESC LIMIT 15", from),
          q("SELECT COUNT(*) n FROM ev WHERE day >= ? AND t = 'play'", from),
          q("SELECT country, COUNT(*) n FROM ev WHERE day >= ? AND t = 'view' GROUP BY country ORDER BY n DESC LIMIT 12", from),
          q("SELECT dev, COUNT(*) n FROM ev WHERE day >= ? AND t = 'view' GROUP BY dev", from),
          q("SELECT ref, t, COUNT(*) n, SUM(val) v FROM ev WHERE day >= ? AND ref IS NOT NULL GROUP BY ref, t", from),
        ]);
        return json({ ok: true, db: true, days, from, perDay, totals, visitors: visitors[0] || {}, returning: (returning[0] || {}).n || 0, packs, plays, sounds, countries, devs, refs, links, settings: st });
      }
      if (p === "/api/admin/reviews") {   // list all, or POST {id, ok} / {id, del}
        const all = (env.CK && (await env.CK.get("reviews", "json"))) || [];
        if (req.method === "POST") { let b = {}; try { b = await req.json(); } catch (e) {} const r = all.find((x) => x.id === b.id); if (r) { if (b.del) all.splice(all.indexOf(r), 1); else r.ok = !!b.ok; } await env.CK.put("reviews", JSON.stringify(all)); }
        return json({ ok: true, reviews: all });
      }
      if (p === "/api/admin/unsublink") {   // build the unsubscribe link for an email (used when sending drops)
        const e = String(url.searchParams.get("e") || "").toLowerCase();
        return json({ ok: true, url: new URL(`/unsub?e=${encodeURIComponent(e)}&t=${await hmac(env.ADMIN_KEY, "unsub:" + e)}`, req.url).toString() });
      }
      if (p === "/api/admin/links" && req.method === "POST") {
        if (!env.CK) return json({ ok: false, error: "storage" }, 503);
        const b = await req.json().catch(() => ({}));
        const links = (await env.CK.get("links", "json")) || [];
        if (b.del) { await env.CK.put("links", JSON.stringify(links.filter((l) => l.code !== b.del))); return json({ ok: true }); }
        const name = String(b.name || "").trim().slice(0, 60); if (!name) return json({ ok: false, error: "name" }, 400);
        let code = (String(b.code || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "link").slice(0, 30), base = code, n = 1;
        while (links.some((l) => l.code === code)) code = base + "-" + ++n;
        const l = { code, name, pack: b.pack ? String(b.pack).slice(0, 80) : "", to: b.to === "get" && b.pack ? "get" : "pack", created: new Date().toISOString() };
        links.push(l); await env.CK.put("links", JSON.stringify(links));
        return json({ ok: true, link: l });
      }
      if (p === "/api/admin/settings" && req.method === "POST") {
        if (!env.CK) return json({ ok: false, error: "storage" }, 503);
        const b = await req.json().catch(() => ({}));
        const st = await settings(env);
        if ("clarityId" in b) st.clarityId = String(b.clarityId || "").replace(/[^a-z0-9]/gi, "").slice(0, 20);
        await env.CK.put("settings", JSON.stringify(st));
        return json({ ok: true, settings: st });
      }
      if (p === "/api/admin/packs" && req.method === "PUT") {
        // 27 Nov (diagnostic): every failure of this route now says what failed (the editor shows only the status, the body is for DevTools)
        if (!env.CK) return json({ ok: false, error: "storage", detail: "CK KV binding is missing in this Pages environment" }, 503);
        const d = await req.json().catch(() => null);
        if (!d || !Array.isArray(d.products) || !Array.isArray(d.worlds)) return json({ ok: false, error: "badbody", detail: "products/worlds missing" }, 400);
        let old;
        try { old = await env.CK.get("packs"); } catch (e) { console.error("kv get packs failed", e); return json({ ok: false, error: "kv", detail: String((e && e.message) || e).slice(0, 200) }, 502); }
        if (old) { try { await env.CK.put("packs:prev", old); } catch (e) { console.error("kv put packs:prev failed", e); } }           // one step undo; a failed backup must not block the save
        // GUARD-HANDLER-BEGIN (26 Nov): look/cats only change when this save carries X-Look-Edit: 1; a stale page can no longer overwrite them
        let guard = null;
        try {
          const storedObj = old ? JSON.parse(old) : null;
          guard = guardLook(storedObj, d, req.headers.get("x-look-edit") === "1");
          GUARD_FIELDS.forEach((f) => { if (guard.merged[f] === undefined) delete d[f]; else d[f] = guard.merged[f]; });
          if (guard.changed && storedObj && (storedObj.look != null || storedObj.cats != null)) {   // keep the previous look/cats for 30 days
            try { await env.CK.put("look:bak:" + new Date().toISOString(), JSON.stringify({ look: storedObj.look, cats: storedObj.cats, at: Date.now() }), { expirationTtl: 2592000 }); } catch (e) { console.error("look backup failed", e); }
          }
        } catch (e) { console.error("look guard failed", e); }
        // GUARD-HANDLER-END
        const EDIT_STAMP = true;   // Eman 22 Nov (RECENT chip): stamp p.edited (ms) on every product whose content changed in this save. false = no stamps
        if (EDIT_STAMP) { try { const o = old ? JSON.parse(old) : { products: [] }, ob = Object.fromEntries((o.products || []).map((p) => [p.id, p])), now = Date.now(), body = (p) => JSON.stringify([p.name, p.sub, p.price, p.priceUsd, p.blurb, p.status, p.stamp, p.isNew, p.look, (p.sounds || []).map((x) => [x.name, x.note || "", !!x.hidden, x.mark || 0, !!x.fix, x.dup || ""])]);   // what Eman edits (not merged-in waveforms/covers)
          d.products.forEach((p) => { const q = ob[p.id]; if (!q || body(q) !== body(p)) p.edited = now; else if (q.edited) p.edited = q.edited; }); } catch (e) {} }
        try { await env.CK.put("packs", JSON.stringify(d)); } catch (e) { console.error("kv put packs failed", e); return json({ ok: false, error: "kv", detail: String((e && e.message) || e).slice(0, 200) }, 502); }
        if (guard && guard.kept) return json({ ok: true, lookKept: true }, 200, { "X-Look-Kept": "1" });   // an incoming look/cats change was dropped (no X-Look-Edit header)
        return json({ ok: true });
      }
      if (p === "/api/admin/undo" && req.method === "POST") {
        if (!env.CK) return json({ ok: false }, 503);
        const prev = await env.CK.get("packs:prev");
        if (!prev) return json({ ok: false }, 404);
        await env.CK.put("packs", prev);
        return json({ ok: true });
      }
      if (p === "/api/admin/upload" && req.method === "POST") {
        if (!env.CK) return json({ ok: false, error: "storage" }, 503);
        const type = req.headers.get("content-type") || "application/octet-stream";
        const raw = (url.searchParams.get("name") || "file").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80);
        const name = Date.now().toString(36) + "-" + raw;
        const buf = await req.arrayBuffer();
        if (buf.byteLength > 20e6) return json({ ok: false, error: "too big" }, 413);
        await env.CK.put("file:" + name, buf, { metadata: { type } });
        return json({ ok: true, url: "/f/" + name });
      }
      if (p.startsWith("/api/")) return json({ ok: false }, 404);
      /* ADM_NOSTORE (20 Nov): admin pages always load fresh, so a tab left open never runs old admin code */
      { const ar = await env.ASSETS.fetch(req); if (!/text\/html/.test(ar.headers.get("content-type") || "")) return ar; const h = new Headers(ar.headers); h.set("cache-control", "no-store"); return new Response(ar.body, { status: ar.status, headers: h }); }
    }
    // pack pages: /pack/<id> all use pack.html
    if (p.startsWith("/pack/")) {
      const r = await env.ASSETS.fetch(new Request(new URL("/pack", req.url), req));
      // PACK_PRELOAD (speed 20 Nov): start the big cover download before shop.js + /api/products arrive. Keep CD_VER in step with shop.js. false = off
      const PACK_PRELOAD = true, CD_VER = CK_CD_VER, id = decodeURIComponent(p.slice(6).split("/")[0] || "");
      if (!PACK_PRELOAD || !/^[a-z0-9-]{1,60}$/.test(id) || !(r.headers.get("content-type") || "").includes("text/html")) return r;
      const PACK_SSR = true, PACK_BAN_SSR = true;   // PACK_BAN_SSR: blurred banner uses the same big cover (already preloaded) so it paints early, not after JS. speed 20 Nov: paint the big cover in the HTML; pack.html keeps this img node. false = off
      return new HTMLRewriter().on("head", { element(e) { e.append(`<link rel="preload" as="image" href="/img/cd/${id}.webp?v=${CD_VER}" fetchpriority="high">`, { html: true }); } })
        .on("#pkTop", { element(e) { if (PACK_SSR) e.setInnerContent(`<div class="pkc"><span class="pq"><img id="pkSsr" src="/img/cd/${id}.webp?v=${CD_VER}" alt="" fetchpriority="high"><i class="gl"></i></span></div>`, { html: true }); } })
        .on("#pkBan i", { element(e) { if (PACK_BAN_SSR) e.setAttribute("style", `background-image:url("/img/cd/${id}.webp?v=${CD_VER}")`); } }).transform(r);
    }
    // free sample landing pages: /get/<id> (links from posts/influencers) all use get.html
    if (p.startsWith("/get/")) return env.ASSETS.fetch(new Request(new URL("/get", req.url), req));
    // creator pages: /creator/<id> all use creator.html
    if (p.startsWith("/creator/")) return env.ASSETS.fetch(new Request(new URL("/creator", req.url), req));
    if (p === "/pack" || p === "/pack.html") return Response.redirect(new URL("/", req.url).toString(), 302);
    // the .html names of private pages are private too
    if (p === "/admin.html" || p === "/work.html") return Response.redirect(new URL(p.replace(".html", ""), req.url).toString(), 302);

    if (AUDIO_RANGES && /\.(mp3|wav|ogg|m4a|flac)$/i.test(p)) return speedCache(req, await audioRange(req, env));
    // BUNDLE_PRELOAD (speed 20 Nov): start the first bundle covers (same -600 files bundle.html shows) before shop.js + /api/products arrive. Keep CD_VER in step with shop.js. false = off
    const BUNDLE_PRELOAD = true;
    if (BUNDLE_PRELOAD && (p === "/bundle" || p === "/bundle.html")) {
      const r = await env.ASSETS.fetch(req);
      if (!(r.headers.get("content-type") || "").includes("text/html")) return r;
      let urls = []; try { urls = ((await loadPacks(env, req)).products || []).filter((x) => (x.status || "live") === "live" && !x.freebie).slice(0, 3).map((x) => String(x.cover || "").replace(/^\//, "")).filter((c) => /^img\/cd\/[a-z0-9-]+\.webp$/.test(c)).map((c) => "/" + c.replace(/\.webp$/, "-600.webp") + "?v=" + CK_CD_VER); } catch (e) {}
      if (!urls.length) return r;
      return new HTMLRewriter().on("head", { element(e) { e.append(urls.map((u, i) => `<link rel="preload" as="image" href="${u}"${i ? "" : ' fetchpriority="high"'}>`).join(""), { html: true }); } }).transform(r);
    }
    // HERO_SSR (speed 20 Nov): the hero background is the home page's biggest paint. Put the picked one in the HTML so it doesn't wait for /api/products. false = off
    const HERO_SSR = true;
    if (HERO_SSR && (p === "/" || p === "/index.html")) {
      const r = await env.ASSETS.fetch(req);
      if (!(r.headers.get("content-type") || "").includes("text/html")) return r;
      let u = ""; try { u = (await loadPacks(env, req)).heroBg || ""; } catch (e) {}
      if (!/^\/img\/bg\/kt\d+\.webp$/.test(u)) return r;
      const m = u.replace(".webp", "-m.webp");
      return new HTMLRewriter()
        .on("html", { element(e) { e.setAttribute("class", ((e.getAttribute("class") || "") + " hbg").trim()); } })
        .on("head", { element(e) { e.append(`<link rel="preload" as="image" href="${m}" media="(max-width:620px)" fetchpriority="high"><link rel="preload" as="image" href="${u}" media="(min-width:621px)" fetchpriority="high">`, { html: true }); } })
        .on("header.hero", { element(e) { e.setAttribute("style", `--hbg:url("${u}");--hbgm:url("${m}")`); } }).transform(r);
    }
    return speedCache(req, await env.ASSETS.fetch(req));
  },
};
