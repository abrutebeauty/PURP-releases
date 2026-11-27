// KILLTOY 2: BLOB in the big instrument window (mock v91). A BLOB lane's INST view shows the
// BLOB window (ui/blob.js, made by the BLOB thread) instead of a knob panel. The sound plays in
// the engine (playground.js playBlobLane, patch on the lane's plugin as p.blob); the window
// gets its own engine for its keys and LISTEN (purpBlobHost.engine) and sends each finished
// paint back with blobSetPatch (one undo step each). The computer keys play it here, like
// TOY MACHINE's window (a s d f ... = C4 up), and don't reach the timeline's shortcuts.
// Keep this file ASCII-only, like ui/.
"use strict";

window.KT2Blob = (function () {
  const KEYS = "awsedftgyhujkolp;";
  let cur = null;   // { pid, host, ui, engine, held }

  function mountIn(pane, p, wanted = () => true) {
    unmount();
    if (!window.BLOB || !window.BlobEngine) { pane.append(el("div", "iw-msg", "BLOB didn't load on this page.")); return; }
    const host = el("div", "k2-blob");
    pane.append(host);
    const me = { pid: p.id, host, ui: null, engine: null, held: new Set() };
    cur = me;
    booth("blobGetPatch", { pluginId: p.id }).then((r) => {
      if (cur !== me || !wanted()) return;
      if (!r || !r.patch) { host.append(el("div", "iw-msg", (r && r.error) || "No BLOB here.")); return; }
      me.ui = BLOB.mount(host, {
        patch: r.patch,
        keys: false,
        logo: "blob-logo.png",
        makeEngine: () => (me.engine = window.purpBlobHost && window.purpBlobHost.engine(p.id)),
        onChange: (patch) => run("blobSetPatch", { pluginId: p.id, patch })
      });
    });
  }

  // BLOB step 1 (design map v2): a BLOB lane is a TOY MACHINE lane (p.face = "blob") and this
  // window is its face (ui/blob2.js). The sound is the lane's own TOY MACHINE engine, through the
  // same commands as TOY MACHINE's window; a new preset is one undo step (toyMachineSetPreset).
  function mountTM(pane, p, wanted = () => true) {
    unmount();
    const host = el("div", "k2-blob");
    pane.append(host);
    const me = { pid: p.id, host, ui: null, engine: null, held: new Set(), tm: true, index: [] };
    cur = me;
    const send = (cmd, args) => booth(cmd, { pluginId: p.id, ...args });
    let lastMeter = { peak: 0 }, lastAt = 0, asking = false;
    const meterTimer = setInterval(async () => {
      if (asking) return;   // a slow answer: don't pile up questions
      asking = true;
      try { const m = await send("toyMachineMeter", {}); if (m && m.ok !== false) { lastMeter = m; lastAt = performance.now(); } } finally { asking = false; }
    }, 50);
    me.stop = () => clearInterval(meterTimer);
    Promise.all([send("toyMachineGetPreset", {}), booth("toyMachinePresets", {})]).then(([got, ix]) => {
      if (cur !== me || !wanted()) return;
      if (!got || !got.preset) { host.append(el("div", "iw-msg", (got && got.error) || "No BLOB here.")); return; }
      const index = me.index = (ix && ix.presets) || [];
      const pr = got.preset, hit = pr.name && index.find((x) => x.name === pr.name && (!pr.category || x.category === pr.category));
      me.ui = BLOB2.mount(host, {
        preset: /^plain saw$|^init$/i.test(pr.name || "") && !hit ? null : pr,
        presetId: hit ? hit.id : null,
        loadIndex: () => index,
        loadPreset: async (id) => { const e = index.find((x) => x.id === id); const r = await run("toyMachineLoadPreset", { id, file: e && e.file }); return r && r.preset; },
        onChange: ({ preset, step }) => run("toyMachineSetPreset", { preset: preset || BlobLook.INIT, pluginId: p.id, step }),
        keys: false,
        logo: "blob-logo.png",
        engine: {
          setPreset() { /* the lane's engine gets it through onChange (one undo step) */ },
          noteOn: (pitch, velocity) => send("toyMachineNote", { pitch, velocity, on: true }),
          noteOff: (pitch) => send("toyMachineNote", { pitch, on: false }),
          meter: () => (performance.now() - lastAt < 200 ? lastMeter : { peak: 0 })   // the last answer holds between answers (no 20 Hz flutter)
        }
      });
    });
  }

  function unmount() {
    const me = cur;
    cur = null;
    if (!me) return;
    if (me.stop) me.stop();
    try { if (me.ui) me.ui.destroy(); } catch (e) { /* gone */ }
    if (me.engine) me.engine.close();
    me.host.remove();
  }

  // undo / redo can bring back an older paint: show it
  async function refresh() {
    const me = cur;
    if (!me || !me.ui) return;
    if (me.tm) {
      const got = await booth("toyMachineGetPreset", { pluginId: me.pid });
      // an undo somewhere else in the song gives back the same sound: leave the pucks where they are
      if (cur === me && got && got.preset && JSON.stringify(got.preset) === JSON.stringify(me.ui.edited() || me.ui.preset)) return;
      if (cur === me && got && got.preset) {
        // find it in the list again, so < > carry on from there
        const pr = got.preset, hit = pr.name && me.index.find((x) => x.name === pr.name && (!pr.category || x.category === pr.category));
        me.ui.setPreset(pr, hit ? hit.id : null);
      }
      return;
    }
    const r = await booth("blobGetPatch", { pluginId: me.pid });
    if (cur === me && r && r.patch) me.ui.setPatch(r.patch);
  }
  const origRun = window.run;
  if (typeof origRun === "function") {
    window.run = async (cmd, args) => {
      const res = await origRun(cmd, args);
      if (cur && /^(undo|redo)$/.test(cmd)) refresh();
      return res;
    };
  }

  const live = () => cur && cur.ui && cur.host.isConnected && cur.host.offsetParent && !document.querySelector(".kae");   // not under the audio editor box
  const typing = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  window.addEventListener("keydown", (e) => {
    if (!live() || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = KEYS.indexOf(e.key.toLowerCase());
    // other letters belong to the window too: the song's shortcuts (B = samples...) would act behind it
    if (i < 0) { if (/^[a-z]$/i.test(e.key) && !(cur.tm && e.key.toLowerCase() === "g")) e.stopImmediatePropagation(); return; }
    if (cur.tm && e.key.toLowerCase() === "g") return;   // G is BLOB's grab hand (ui/blob2.js)
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat || cur.held.has(i)) return;
    cur.held.add(i);
    cur.ui.noteOn(60 + i);
  }, true);
  window.addEventListener("keyup", (e) => {
    if (!cur || !cur.ui) return;
    const i = KEYS.indexOf(e.key.toLowerCase());
    if (i < 0 || !cur.held.has(i)) return;
    cur.held.delete(i);
    cur.ui.noteOff(60 + i);
    e.stopImmediatePropagation();
  }, true);

  document.head.insertAdjacentHTML("beforeend", `<style>
.k2-blob{position:relative;width:100%;height:100%;min-height:460px}
/* the app's Samples drawer is also .samples: keep BLOB's list in its column */
.k2-blob .samples{position:static;width:auto;z-index:auto;background:none;border:0;box-shadow:none;animation:none}
</style>`);
  return { mountIn, mountTM, unmount, refresh };
})();
