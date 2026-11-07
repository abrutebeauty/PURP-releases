// Return tracks, like Ableton's A and B returns. Every lane has two tiny send knobs on its
// card (A, B; 0 = off). What a lane sends plays through the return's effects (A Space: a
// reverb, B Echo: a tempo delay), then the return's fader and mute, into the master.
// The returns are two slim rows just above the master. Click one to see its effects in the
// rack (same cards as a lane, so the reverb can be swapped for anything).
// Rack commands reach a return as { trackId: "returnA" } / { trackId: "returnB" }.
// Engines without returns (the Mac app, for now) have no state.returns, and nothing shows.
// Keep this file ASCII-only, like the rest of ui/.
"use strict";

(function () {
  const COLORS = { returnA: "#8b5cf6", returnB: "#c084fc" };
  const list = () => (ui.state && ui.state.returns) || null;
  const isReturn = (id) => typeof id === "string" && /^return[AB]$/.test(id);
  const SEND_OF = { returnA: "A", returnB: "B" };

  // A return as a lane-shaped object (what laneFader, colorOf and the rack expect).
  function track(rid) {
    const r = (list() || []).find((x) => x.id === rid);
    if (!r) return null;
    return { id: r.id, kind: "return", role: "return", name: r.name, color: COLORS[r.id], volume: r.volume || 0, muted: !!r.muted,
             plugins: r.plugins || [], clips: [], automation: [] };
  }
  // What the rack shows when a return is picked.
  function rackClip(rid) {
    const t = track(rid);
    return t && { id: t.id, lane: true, ret: true, kind: "lane", name: t.name, plugins: t.plugins, track: t, start: 0, clips: [] };
  }

  // One tiny knob: drag up or down, double-click for off.
  function knob(t, send) {
    const r = (list() || []).find((x) => x.id === "return" + send);
    const v = Math.max(0, Math.min(1, (t.sends && t.sends[send]) || 0));
    const k = el("div", "send-knob" + (v > 0 ? " on" : ""), send);
    const paint = (x) => { k.style.setProperty("--v", (x * 100).toFixed(1) + "%"); k.classList.toggle("on", x > 0); };
    paint(v);
    const tip = (x) => `Send ${send} \u00b7 ${Math.round(x * 100)}%: how much of this lane goes to ${r ? r.name : "return " + send}. Drag up or down, double-click for off.`;
    k.title = tip(v);
    k.addEventListener("dblclick", (e) => { e.stopPropagation(); run("setSend", { trackId: t.id, send, amount: 0 }); });
    k.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const y0 = e.clientY, from = v;
      let x = v, sent = false;
      liveDrag(e, (ev) => {
        x = Math.round(Math.max(0, Math.min(1, from + (y0 - ev.clientY) / 120)) * 100) / 100;
        paint(x); k.title = tip(x);
        return () => { run("setSend", { trackId: t.id, send, amount: x, drag: sent }); sent = true; };
      }, (ev, none, pending) => { if (pending) pending(); });
    });
    return k;
  }
  function sendKnobs(t) {
    if (!list()) return null;
    const box = el("div", "sends");
    box.append(knob(t, "A"), knob(t, "B"));
    return box;
  }

  // The two slim rows above the master.
  function row(r, width, i) {
    const t = track(r.id);
    const row = el("div", "row return" + (ui.selectedTrack === t.id ? " selected" : "") + (t.muted ? " muted" : ""));
    row.style.setProperty("--c", colorOf(t));
    row.style.setProperty("--ret-i", String(i));
    row.dataset.trackId = t.id;
    row.dataset.kind = "return";
    const head = el("div", "head");
    const text = el("div", "head-text");
    const on = t.plugins.filter((p) => !p.instrument);
    const chain = on.map((p) => p.name + (p.enabled ? "" : " (off)")).join(" \u2192 ");
    const name = el("div", "head-name", t.name);
    name.title = `Return ${SEND_OF[t.id]}: lanes send to it with their ${SEND_OF[t.id]} knob. ${on.length ? "Plays through " + chain + "." : "No effects yet."}`;
    text.append(name, laneFader(t));
    const btns = el("div", "head-btns");
    const mute = el("button", "msr m" + (t.muted ? " on" : ""), "M");
    mute.title = "Mute this return";
    mute.onclick = () => run("toggleReturnMute", { id: t.id });
    btns.append(mute);
    head.append(el("div", "dot-btn"), text, btns);
    head.title = "Click to see this return's effects. Right-click for more.";
    const pick = (e) => { if (e.button === 0 && !e.target.closest("button, input, .vol") && ui.selectedTrack !== t.id) selectTrack(t.id); };
    head.addEventListener("mousedown", pick);
    head.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (ui.selectedTrack !== t.id) selectTrack(t.id);
      showMenu(atMouse(e), [
        { heading: "RETURN " + SEND_OF[t.id] },
        { label: "Volume back to 0 dB", meta: fmtDb(t.volume), run: () => run("setReturnVolume", { id: t.id, volume: 0 }) },
        { label: t.muted ? "Unmute" : "Mute", run: () => run("toggleReturnMute", { id: t.id }) },
        ...(on.length ? [{ label: on.every((p) => !p.enabled) ? "Turn the effects back on" : "Bypass the effects", run: () => run("bypassAll", { trackId: t.id }) }] : []),
      ]);
    });
    const lane = el("div", "lane");
    lane.style.width = width + "px";
    lane.addEventListener("mousedown", pick);
    const chips = el("div", "master-chain");
    const senders = ui.state.tracks.filter((x) => x.sends && x.sends[SEND_OF[t.id]] > 0).map((x) => x.kind === "beat" ? "Reference" : x.name);
    chips.append(el("span", "out", senders.length ? senders.join(", ") : "No lane sends here yet"), el("span", "arrow", "\u2192"));
    for (const p of on) {
      const chip = el("span", "chip" + (p.enabled ? "" : " off"), p.name);
      chip.style.setProperty("--dc", deviceColor(p));
      chips.append(chip, el("span", "arrow", "\u2192"));
    }
    chips.append(el("span", "out", "Master"));
    lane.append(chips);
    row.append(head, lane);
    return row;
  }
  function rows(width) {
    const rs = list();
    return rs ? rs.map((r, i) => row(r, width, rs.length - 1 - i)) : [];
  }
  // For the lane-rebuild check: only what the rows and knobs show (not knob turns on the effects).
  const sig = () => list() && [list().map((r) => [r.name, r.volume, r.muted, (r.plugins || []).map((p) => [p.name, p.enabled])]),
    ui.state.tracks.map((t) => t.sends)];

  window.killtoyReturns = { isReturn, track, rackClip, sendKnobs, rows, sig };
  if (ui.state) { ui.laneSig = ""; render(); }   // the first state can land before this file loads
})();
