#!/usr/bin/env python3
# Adds two small things to the desktop app's web/playground.js (backup first):
#  1) session.json lanes can carry "vst": { uid, name, state } (a VST/AU synth lane with its sound). KT2_VST_JSON_OFF = old.
#  2) the song list also reads audio/songs/index-extra.json. KT2_INDEX_EXTRA_OFF = old.
#   python3 patch-playground.py /path/to/web/playground.js /path/to/backup.js
import sys, shutil
p, bak = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
A1 = "          S.tracks[S.tracks.length - 1].clips.forEach((c) => c.plugins.forEach(uwEnsure));\n"
N1 = A1 + """          if (l.vst && l.vst.uid && !window.KT2_VST_JSON_OFF) {
            const T = S.tracks[S.tracks.length - 1];
            T.vst = { uid: l.vst.uid, name: l.vst.name || l.instrument, ...(l.vst.state ? { state: l.vst.state } : {}) };
            T.instrument = l.instrument || T.vst.name;
            T.clips.forEach((c) => c.plugins.forEach((q) => { if (q.instrument) { q.name = T.instrument; q.type = "vst"; q.vst = { uid: l.vst.uid }; } }));
          }
"""
A2 = '  fetch("audio/songs/index.json").then((r) => (r.ok ? r.json() : []))\n'
N2 = A2 + """    .then((dirs) => (window.KT2_INDEX_EXTRA_OFF ? dirs : fetch("audio/songs/index-extra.json").then((r) => (r.ok ? r.json() : []), () => []).then((more) => [...dirs, ...(Array.isArray(more) ? more : []).filter((d) => !dirs.includes(d))], () => dirs)))
"""
done = []
for a, n, tag in [(A1, N1, "KT2_VST_JSON_OFF"), (A2, N2, "KT2_INDEX_EXTRA_OFF")]:
    if tag in s: done.append(tag + " already there"); continue
    if s.count(a) != 1: sys.exit("anchor not found once for " + tag + " (count %d)" % s.count(a))
    s = s.replace(a, n); done.append(tag + " added")
shutil.copy2(p, bak)
open(p, "w", encoding="utf-8").write(s)
print("; ".join(done), "| backup", bak)
