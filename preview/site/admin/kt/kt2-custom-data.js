// CUSTOM DATA (Eman, 15 Nov 2026: "just add a button on both MIDI DICE and KILLDRUM that CUSTOM DATA on and off, so i
// easily can switch to a bigger library vs just all my own personal references").
// One square switch per tool, saved per tool:
//   ON  (default) = rolls use only Eman's own references (the analysed songs / MIDI / favorite drums in BACKEND DATA).
//   OFF           = the bigger library comes in too (the collections listed on the UNPERSONAL DATA page).
// It IS the UNPERSONAL DATA page's USE IN APP switches (localStorage kt2.use.<id>, window.KT2Use), grouped per tool, so
// both places always show the same thing and nothing is duplicated:
//   dice     chords (big chord collection), scenes, moods, chordrhythms
//   killdrum drumbrain (drum rhythm collection), drumgrooves (hand-made grooves mixed back in)
// Hand-written genre patterns and the theory rules (picked key wins, STACKED = exact N) work in both modes.
// window.KT2CustomData = { LABEL, off(), isOn(tool), setOn(tool, on), html(tool, cls), wire(btn, tool, after), GROUPS }
// KT2_CUSTOM_DATA_OFF = no button anywhere (as before).
(function () {
  "use strict";
  var W = typeof window !== "undefined" ? window : {};
  var LABEL = "CUSTOM DATA";
  var GROUPS = { dice: ["chords", "scenes", "moods", "chordrhythms"], killdrum: ["drumbrain", "drumgrooves"] };
  var off = function () { return !!W.KT2_CUSTOM_DATA_OFF; };
  var get = function (id) { try { return localStorage.getItem("kt2.use." + id) === "1"; } catch (e) { return false; } };
  // ON while none of the tool's library switches is on
  function isOn(tool) { var g = GROUPS[tool] || []; for (var i = 0; i < g.length; i++) if (get(g[i])) return false; return true; }
  function setOn(tool, on) {
    (GROUPS[tool] || []).forEach(function (id) { try { if (on) localStorage.removeItem("kt2.use." + id); else localStorage.setItem("kt2.use." + id, "1"); } catch (e) { /* private window */ } });
    try { if (W.KT2UseApply) W.KT2UseApply(); else if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("kt2use")); } catch (e) { /* fine */ }
    try { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("kt2customdata", { detail: { tool: tool, on: on } })); } catch (e) { /* fine */ }
  }
  function html(tool, cls) {
    if (off()) return "";
    var on = isOn(tool);
    return '<button type="button" class="kt2-cdata' + (cls ? " " + cls : "") + (on ? " on" : "") + '" data-tool="' + tool + '" role="switch" aria-checked="' + on + '">' + LABEL + "</button>";
  }
  function paint(btn, tool) { var on = isOn(tool); btn.classList.toggle("on", on); btn.setAttribute("aria-checked", String(on)); }
  function wire(btn, tool, after) {
    if (!btn) return;
    addCss(); paint(btn, tool);
    btn.onclick = function (e) { if (e) e.stopPropagation(); setOn(tool, !isOn(tool)); paint(btn, tool); if (after) after(isOn(tool)); };
  }
  var css = ".kt2-cdata{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 9px;border:1px solid rgba(255,255,255,.14);border-radius:0;background:transparent;color:rgba(255,255,255,.6);font:800 10px/1 var(--font, system-ui);letter-spacing:.1em;cursor:pointer;white-space:nowrap}" +
    ".kt2-cdata:hover{color:#fff;border-color:rgba(255,255,255,.3)}" +
    ".kt2-cdata.on{color:#141218;background:#E4FF3A;border-color:transparent}" +
    ".kt2-cdata.on:hover{color:#141218}" +
    ".tmd-simple .kt2-cdata{width:100%;height:30px}";
  function addCss() { if (typeof document === "undefined" || document.getElementById("kt2-cdata-css")) return; var s = document.createElement("style"); s.id = "kt2-cdata-css"; s.textContent = css; document.head.appendChild(s); }
  var API = { LABEL: LABEL, GROUPS: GROUPS, off: off, isOn: isOn, setOn: setOn, html: html, wire: wire, addCss: addCss };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  W.KT2CustomData = API;
})();
