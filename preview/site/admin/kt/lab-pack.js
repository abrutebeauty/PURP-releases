/* The KILLTOY 2 app serves TOY MACHINE presets and samples one file at a time; on this site they ship as two packs
   (toy-machine/presets.pack.json, samples.pack.json: { path: { t: text } | { b: base64 } }). This hands a request for one
   of those files out of the pack. window.__ktPackHas(path) answers whether a preset exists. */
(() => {
  const orig = window.fetch.bind(window), packs = {};
  const pack = (n) => packs[n] || (packs[n] = orig("toy-machine/" + n + ".pack.json").then((r) => r.json()).catch(() => ({})));
  const ofUrl = (u) => { const s = typeof u === "string" ? u : (u && u.url) || ""; const m = /toy-machine\/(presets|samples)\/[^?#]+/.exec(s); return m && !/index\.json$/.test(m[0]) ? { kind: m[1], key: decodeURIComponent(m[0]) } : null; };
  window.fetch = function (u, o) {
    const w = ofUrl(u); if (!w) return orig(u, o);
    return pack(w.kind).then((P) => {
      const e = P["toy-machine/" + w.key.replace(/^toy-machine\//, "")] || P[w.key];
      if (!e) return new Response("not found", { status: 404 });
      if (e.t != null) return new Response(e.t, { headers: { "content-type": "application/json" } });
      const bin = atob(e.b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      return new Response(a, { headers: { "content-type": "application/octet-stream" } });
    });
  };
  window.__ktPackKeys = () => pack("presets").then((P) => new Set(Object.keys(P)));
})();

/* Each lab opens a clean KILLTOY session (27 Nov): on this site the app only lives inside the admin MIDI editor, and its
   autosave would otherwise add one more lane to the same stored session every time a sound is opened. */
(() => {
  try { for (const n of ["killtoy-sessions", "killtoy-variations"]) indexedDB.deleteDatabase(n); } catch (e) { /* storage blocked */ }
  try { localStorage.removeItem("ktLastOpen"); } catch (e) { /* storage blocked */ }
})();
