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
PFX = set()   # the pack code most preset names start with (WC, DC, N2, TC3), filled once the presets are listed
def pwords(name):
    t = name.split(" ", 1)
    return words(t[1]) if len(t) > 1 and t[0] in PFX else words(name)
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
def tempo_of(path):
    for tr in mido.MidiFile(path).tracks:
        for msg in tr:
            if msg.type == "set_tempo": return round(mido.tempo2bpm(msg.tempo), 2)
    return None
for f in glob.glob(os.path.join(src, "MIDI", "**", "*.mid"), recursive=True):
    m = re.match(r"(.+?) - ([\d.]+) BPM - (.+)\.mid$", os.path.basename(f))
    if m: mids[m.group(1)] = (f, float(m.group(2)), m.group(3))
    else: mids.setdefault(os.path.basename(f)[:-4], (f, tempo_of(f), None))   # "<name>.mid": tempo from the file, key from the site
# kit MIDI (CC PACK): "CC Kit 01 - B Bass - 120 BPM - D#m.mid" is one part of a kit, not one preset.
# A preset with no MIDI of its own gets an unused kit part of its role, same tempo + key as its site demo when one exists.
kits = []
for f in glob.glob(os.path.join(src, "MIDI", "**", "*.mid"), recursive=True):
    m = re.match(r".+? - [A-Z] (\w+) - ([\d.]+) BPM - (.+)\.mid$", os.path.basename(f))
    if m: kits.append((f, m.group(1).lower(), float(m.group(2)), m.group(3)))
ROLE = {"arp": "arp", "lead": "lead", "synth": "lead", "saw": "lead", "pad": "pad", "texture": "pad", "fx": "pad", "bass": "bass", "808": "bass", "sub": "bass",
        "chip": "chip", "keys": "keys", "key": "keys", "bell": "keys", "pluck": "pluck", "stab": "stab", "chord": "stab", "vocal": "vocal", "vox": "vocal", "choir": "vocal"}
kit_used = set()
def kit_for(name, bpm, key):
    role = next((ROLE[w] for w in words(name) if w in ROLE), None)
    pool = [k for k in kits if k[1] == role] or kits
    for ok in (lambda k: k[2] == bpm and k[3] == key, lambda k: k[3] == key, lambda k: True):
        c = [k for k in pool if ok(k) and k[0] not in kit_used] or [k for k in pool if ok(k)]
        if c: kit_used.add(c[0][0]); return c[0]
    return None
num = lambda b: (int(b) if b == int(b) else b) if b else None
tms = {os.path.basename(f)[:-11]: f for f in glob.glob(os.path.join(src, "ALL FORMATS", "**", "TOY MACHINE", "*.toymachine"), recursive=True)}
import collections
_fc = collections.Counter(n.split(" ")[0] for n in tms)
PFX = {w for w, c in _fc.items() if c > len(tms) * 0.4 and not w.isdigit()}
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
idx, miss, used = {}, [], set()
for s in P["sounds"]:
    slug = slug_of(s["file"]); base = os.path.splitext(key_of(s["file"]).split("/")[-1])[0]
    cands = [w for w in [base if "#" not in s["file"] else None, OLD.get(s["file"]), s.get("name")] if w]
    best = None
    for cand in cands:
        cw = words(cand); sw = set(cw); swc = sw - CAT or sw; ms = (sorted(cw), sorted(cw[1:]))
        for name in tms:
            pw = pwords(name); nw = set(pw); nwc = nw - CAT or nw
            sc = 200 if sorted(pw) in ms else 190 if nw in (sw, set(cw[1:])) else 100 if nwc == swc and len(pw) == len(cw) else len(nwc & swc) * 10 - len(nwc ^ swc) * 3
            if name in used and sc >= 100:   # two site sounds with the same name: the second gets the closest unused variant
                alt = [n for n in tms if n not in used and set(pwords(n)) - CAT >= nwc]
                if alt: name, sc = min(alt, key=lambda n: len(set(pwords(n)) ^ nw)), 150
            if sc > 0 and (not best or sc > best[0]): best = (sc, name)
        if best and best[0] >= 100: break
    if not best: miss.append(slug); continue
    name = best[1]; used.add(name); mf = mids.get(name)
    mk = re.match(r"\s*([\d.]+)\s*\u00b7\s*(\S+)", s.get("meta") or "")
    if not mf and kits:
        k = kit_for(name, float(mk.group(1)) if mk else None, mk.group(2) if mk else None)
        if k: mf = (k[0], k[2], k[3])
    d = {"name": name, "bpm": num(mf[1]) if mf and mf[1] else (num(float(mk.group(1))) if mk else None), "key": (mf[2] if mf else None) or (mk.group(2) if mk else ""), "notes": midi_notes(mf[0]) if mf else [],
         "preset": {"engine": "tm3", "name": name, "data": slim(json.load(open(tms[name])))}}
    with gzip.open(os.path.join(out, pid, slug + ".json.gz"), "wt") as g: json.dump(d, g, separators=(",", ":"))
    idx[slug] = {"name": name, "bpm": d["bpm"], "key": d["key"], "n": len(d["notes"]), "midi": bool(mf), "score": best[0], "names": [x for x in {s.get("name"), OLD.get(s["file"]), NEW.get(s["file"])} if x]}
json.dump(idx, open(os.path.join(out, pid, "index.json"), "w"), indent=0)
print(pid, "matched", len(idx), "weak", [k for k, v in idx.items() if v["score"] < 100], "of", len(P["sounds"]), "missing", miss, "no midi", [k for k, v in idx.items() if not v["midi"]])
