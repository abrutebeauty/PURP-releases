// KILLTOY 2: the black box (deep debug, 16 Nov).
// Until now, when something inside the app threw an error nothing kept it: the action just "did nothing" and the
// reason was gone. This keeps the last 40 errors (script errors and failed promises nobody caught) in this browser,
// so the next bug hunt can read what really happened: KT2Errors.list() / KT2Errors.text() / KT2Errors.clear().
// It shows nothing on screen and changes nothing else. The same error repeating in a loop is counted, not repeated.
// window.KT2_ERRLOG_OFF = off (old: nothing kept).
(function () {
  if (window.KT2_ERRLOG_OFF || window.KT2Errors) return;
  var KEY = "kt2.errlog", MAX = 40, list = [], timer = 0, lastMsg = "", lastAt = 0;
  try { list = JSON.parse(localStorage.getItem(KEY) || "[]"); if (!Array.isArray(list)) list = []; } catch (e) { list = []; }
  function keep() { timer = 0; try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch (e) { /* storage full or blocked: kept in memory only */ } }
  function add(kind, msg, where) {
    try {
      msg = String(msg == null ? "" : msg).slice(0, 300);
      var now = Date.now(), last = list[list.length - 1];
      if (last && msg === lastMsg && now - lastAt < 5000) last.n = (last.n || 1) + 1;
      else list.push({ t: new Date(now).toISOString(), kind: kind, msg: msg, where: String(where || "").slice(0, 200) });
      lastMsg = msg; lastAt = now;
      if (list.length > MAX) list.splice(0, list.length - MAX);
      if (!timer) timer = setTimeout(keep, 1000);
    } catch (e) { /* the black box must never be the thing that breaks */ }
  }
  addEventListener("error", function (e) {
    if (!e || !e.message) return;   // (a picture or sound that didn't load has no message: not a code error)
    // the browser's own "ResizeObserver loop ..." notice is not an error (a size answer came one frame late)
    if (!window.KT2_ERRLOG_RO_SHOW && /^ResizeObserver loop/.test(e.message)) return;
    add("error", e.message, String(e.filename || "").split("/").pop() + ":" + (e.lineno || 0));
  });
  addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason, st = r && r.stack ? String(r.stack).split("\n") : [];
    add("promise", r && r.message ? r.message : r, (st[1] || "").trim().split("/").pop());
  });
  addEventListener("pagehide", function () { if (timer) { clearTimeout(timer); keep(); } });
  window.KT2Errors = {
    list: function () { return list.slice(); },
    text: function () { return list.map(function (x) { return x.t + "  " + x.kind + (x.n ? " x" + x.n : "") + "  " + x.msg + (x.where ? "  @" + x.where : ""); }).join("\n"); },
    clear: function () { list.length = 0; lastMsg = ""; keep(); },
    add: add
  };
})();
