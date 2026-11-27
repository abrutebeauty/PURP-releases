# Builds admin/v3/<packId>/ for the COREKULT admin editor: one <slug>.json.gz per sound
# ({ name, bpm, key, notes:[{pitch,start,length,velocity}] (beats), preset:{engine:"tm3",name,data} }) + index.json.
# usage: build_pack.py <pack folder (has MIDI/ and ALL FORMATS/)> <packId> <products.json> <out site dir> [renames dir]
# File name per sound = slug of the sound key (file without the sprite end time), same as review.js v3Slug().
import sys, os, re, json, gzip, glob, mido
src, pid, prod, out = sys.argv[1:5]; rdir = sys.argv[5] if len(sys.argv) > 5 else "/mnt/project-files/corekult-site/renames"
OLD = json.load(open(os.path.join(rdir, "restore-old-names.json"))).get(pid, {}) if os.path.isdir(rdir) else {}
NEW = {x["file"]: x.get("new") for x in (json.load(open(os.path.join(rdir, "renames-v1.json"))).get(pid, {}) or {}).get("sounds", [])} if os.path.isdir(rdir) else {}
key_of = lambda f: re.sub(r",[\d.]+$", "", f)
slug_of = lambda f: re.sub(r"[^a-z0-9]+", "-", key_of(f).split("/")[-1].lower()).strip("-")
P = next(p for p in json.load(open(prod))["products"] if p["id"] == pid)
words = lambda s: [re.sub(r"(?<=[a-z]{3})[sz]$", "", w) for w in re.split(r"[^a-z0-9]+", s.lower()) if w]
CAT = {"cc","stab","chip","saw","lead","leads","bass","pad","pads","pluck","plucks","keys","key","bell","bells","synth","synths","fx","arp","808","sub","flute","chord","chords","texture","vox"}
def midi_notes(path):
    m = mido.MidiFile(path); tpb = m.ticks_per_beat; on = {}; notes = []
    for tr in m.tracks:
        t = 0
        for msg in tr:
            t += msg.time
            if msg.type == "note_on" and msg.velocity > 0: on.setdefault(msg.note, []).append((t, msg.velocity))
            elif msg.type in ("note_off", "note_on"):
                if on.get(msg.note): s, v = on[msg.note].pop(0); notes.append({"pitch": msg.note, "start": round(s / tpb, 4), "length": round(max(1, t - s) / tpb, 4), "velocity": v})
    return sorted(notes, key=lambda n: (n["start"], n["pitch"]))
mids = {}
for f in glob.glob(os.path.join(src, "MIDI", "*.mid")):
    m = re.match(r"(.+?) - (\d+) BPM - (.+)\.mid$", os.path.basename(f))
    if m: mids[m.group(1)] = (f, int(m.group(2)), m.group(3))
tms = {os.path.basename(f)[:-11]: f for f in glob.glob(os.path.join(src, "ALL FORMATS", "*", "*", "TOY MACHINE", "*.toymachine"))}
os.makedirs(os.path.join(out, pid), exist_ok=True); os.makedirs(os.path.join(out, "_b"), exist_ok=True)
import hashlib
def blob(v):   # big shared parts (wavetables, the sample) go to admin/v3/_b/<hash>.json.gz once; the sound file keeps {"$b": hash}
    j = json.dumps(v, separators=(",", ":"), sort_keys=True); h = hashlib.sha1(j.encode()).hexdigest()[:16]
    f = os.path.join(out, "_b", h + ".json.gz")
    if not os.path.exists(f):
        with gzip.open(f, "wt") as g: g.write(j)
    return {"$b": h}
def slim(data):
    st = data.get("settings", {})
    if isinstance(st.get("wavetables"), list): st["wavetables"] = [blob(w) for w in st["wavetables"]]
    if st.get("sample"): st["sample"] = blob(st["sample"])
    return data
idx, miss = {}, []
for s in P["sounds"]:
    slug = slug_of(s["file"]); base = os.path.splitext(key_of(s["file"]).split("/")[-1])[0]
    cands = [w for w in [base if "#" not in s["file"] else None, OLD.get(s["file"]), s.get("name")] if w]
    best = None
    for cand in cands:
        cw = words(cand); sw = set(cw); sw2 = set(cw[1:]); swc = sw - CAT or sw
        for name in tms:
            nw = set(words(name)); nwc = nw - CAT or nw
            sc = 200 if nw in (sw, sw2) else 100 if nwc == swc else len(nwc & swc) * 10 - len(nwc ^ swc) * 3
            if sc > 0 and (not best or sc > best[0]): best = (sc, name)
        if best and best[0] >= 100: break
    if not best: miss.append(slug); continue
    name = best[1]; mf = mids.get(name)
    d = {"name": name, "bpm": mf[1] if mf else None, "key": mf[2] if mf else "", "notes": midi_notes(mf[0]) if mf else [],
         "preset": {"engine": "tm3", "name": name, "data": slim(json.load(open(tms[name])))}}
    with gzip.open(os.path.join(out, pid, slug + ".json.gz"), "wt") as g: json.dump(d, g, separators=(",", ":"))
    idx[slug] = {"name": name, "bpm": d["bpm"], "key": d["key"], "n": len(d["notes"]), "midi": bool(mf), "score": best[0], "names": [x for x in {s.get("name"), OLD.get(s["file"]), NEW.get(s["file"])} if x]}
json.dump(idx, open(os.path.join(out, pid, "index.json"), "w"), indent=0)
print(pid, "matched", len(idx), "weak", [k for k, v in idx.items() if v["score"] < 100], "of", len(P["sounds"]), "missing", miss, "no midi", [k for k, v in idx.items() if not v["midi"]])
