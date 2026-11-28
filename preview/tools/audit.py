# audit.py <packId> [v3dir]: for each site sound, compare demo audio chroma with the V3 json notes (bpm) -> score
import sys, json, gzip, re, os, numpy as np, librosa, subprocess
pid = sys.argv[1]; V = sys.argv[2] if len(sys.argv) > 2 else "/home/user/purp-releases/preview/site/admin/v3"
S = "/mnt/project-files/corekult-site/site/"
P = next(p for p in json.load(open(S + "products.json"))["products"] if p["id"] == pid)
key_of = lambda f: re.sub(r",[\d.]+$", "", f)
slug_of = lambda f: re.sub(r"[^a-z0-9]+", "-", key_of(f).split("/")[-1].lower()).strip("-")
def load(f):
    m = re.match(r"(.+?)#t=([\d.]+),([\d.]+)$", f)
    if m: y, sr = librosa.load(S + m.group(1), sr=22050, offset=float(m.group(2)), duration=float(m.group(3)) - float(m.group(2)))
    else: y, sr = librosa.load(S + f, sr=22050)
    return y, sr
def chroma_notes(notes, bpm, hs, n, shift=0):
    C = np.zeros((12, n)); spb = 60.0 / bpm
    for x in notes:
        a = int(x["start"] * spb / hs); b = max(a + 1, int((x["start"] + x["length"]) * spb / hs))
        if a < n: C[(x["pitch"] + shift) % 12, a:min(b, n)] += 1
    return C
def score(A, hs, notes, bpm):
    best = (-1, 0, 0)
    for st in (1.0, 2.0, 0.5):                      # tempo factor
        for off in range(0, 25, 2):                  # start offset in frames (~0.5 s)
            n = A.shape[1]; M = chroma_notes(notes, bpm * st, hs, n + off)[:, off:]
            act = M.sum(0) > 0
            if act.sum() < 5: continue
            a = A / (np.linalg.norm(A, axis=0) + 1e-9); m = M / (np.linalg.norm(M, axis=0) + 1e-9)
            s = float((a * m).sum(0)[act].mean())
            if s > best[0]: best = (s, st, off)
    return best
out = {}
for s in P["sounds"]:
    slug = slug_of(s["file"]); f = os.path.join(V, pid, slug + ".json.gz")
    if not os.path.exists(f): out[slug] = {"name": s["name"], "status": "no-v3"}; continue
    d = json.load(gzip.open(f, "rt"))
    try: y, sr = load(s["file"])
    except Exception as e: out[slug] = {"name": s["name"], "status": "no-audio"}; continue
    hop = 512; A = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    if not d["notes"] or not d["bpm"]: out[slug] = {"name": s["name"], "status": "no-notes"}; continue
    sc, st, off = score(A, hop / sr, d["notes"], d["bpm"])
    mdur = max(x["start"] + x["length"] for x in d["notes"]) * 60 / d["bpm"]
    out[slug] = {"name": s["name"], "preset": d["name"], "score": round(sc, 3), "tempo": st, "off": off, "audio": round(len(y) / sr, 2), "midi": round(mdur, 2)}
json.dump(out, open(f"/tmp/claude-0/mm/audit-{pid}.json", "w"), indent=0)
sc = [v.get("score", 0) for v in out.values()]
print(pid, "n", len(sc), "good>=.6", sum(x >= .6 for x in sc), "mid .4-.6", sum(.4 <= x < .6 for x in sc), "bad<.4", sum(x < .4 for x in sc))
