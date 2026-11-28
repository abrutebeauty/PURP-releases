# setmidi.py <packId> <json map {slug: midi path}>: replace notes + bpm of built V3 sounds with the given MIDI
import sys, json, gzip, os, mido, re
sys.path.insert(0, "/home/user/v3tools")
pid, mp = sys.argv[1], json.load(open(sys.argv[2])); V = "/home/user/purp-releases/preview/site/admin/v3/" + pid + "/"
def notes_of(path):
    m = mido.MidiFile(path); tpb = m.ticks_per_beat; on = {}; notes = []; bpm = None
    for tr in m.tracks:
        t = 0
        for msg in tr:
            t += msg.time
            if msg.type == "set_tempo" and bpm is None: bpm = round(mido.tempo2bpm(msg.tempo), 2)
            if msg.type == "note_on" and msg.velocity > 0: on.setdefault(msg.note, []).append((t, msg.velocity))
            elif msg.type in ("note_off", "note_on") and on.get(msg.note):
                s, v = on[msg.note].pop(0); notes.append({"pitch": msg.note, "start": round(s / tpb, 4), "length": round(max(1, t - s) / tpb, 4), "velocity": v})
    return sorted(notes, key=lambda n: (n["start"], n["pitch"])), bpm or 120
ix = json.load(open(V + "index.json"))
for slug, path in mp.items():
    f = V + slug + ".json.gz"; d = json.load(gzip.open(f, "rt"))
    d["notes"], b = notes_of(path); d["bpm"] = int(b) if b == int(b) else b
    with gzip.open(f, "wt") as g: json.dump(d, g, separators=(",", ":"))
    ix[slug].update({"bpm": d["bpm"], "n": len(d["notes"]), "midi": True, "src": os.path.basename(path)})
json.dump(ix, open(V + "index.json", "w"), indent=0); print(pid, "set", len(mp))
