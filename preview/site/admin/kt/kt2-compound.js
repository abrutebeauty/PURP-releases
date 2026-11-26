// KILLTOY 2: compound clips (Final Cut's name). Select clips, press G: they become one block
// with a COMPOUND (n) badge. Double-click opens it as its own little playground with a path
// bar on top (click the song name or press Esc to go back). Edits inside change every copy
// of it in the song; "Make unique" splits one copy off so it gets its own edits.
//
// How it is kept: every clip in a compound carries cmp = { def, inst, idx, at, name }.
//   def   which compound it is (all copies share it), inst  this copy,
//   idx   the clip's place inside the compound (the same in every copy),
//   at    where this copy starts on the timeline (seconds).
// The backend half (demo) runs on the playground state before app.js builds its backend, so
// the playground's undo wraps these commands too. After every edit it compares the copies of
// each compound and, when exactly one copy changed, makes the others match it.
// Load before app.js (demo is used by createDemoBackend); the page half starts on
// DOMContentLoaded, after app.js and kt2.js. Keep this file ASCII-only, like ui/.
"use strict";

window.KillToyCompound = (function () {
  // ---------------------------------------------------------------- backend (demo/playground)
  // Per-copy things that don't follow the other copies: the clip's id, where it sits, its
  // compound tag, and whether it is muted (muting one placed copy is a choice about that copy).
  const OWN = new Set(["id", "start", "cmp", "plugins", "active", "row"]);   // row: which row a copy is shown on is its own
  const EDITS = ["setMidiNotes", "setClipGain", "setClipFades", "setClipBounds", "renameClip", "reverseClip", "moveClip", "moveClips",
                 "addPlugin", "removePlugin", "movePlugin", "togglePlugin", "applyChain", "clearEffects", "setParam", "splitClip",
                 "deleteClip", "duplicateClips", "setClipTake", "setClipComp", "flattenComp", "convertToMidi", "consolidateClips"];

  function demo(ctx) {
    const { S, handlers, changed, id } = ctx;
    S.canCompound = true;
    const members = () => {
      const out = [];
      S.tracks.forEach((t, ti) => t.clips.forEach((c) => { if (c.cmp) out.push({ c, t, ti }); }));
      return out;
    };
    const byInst = () => {
      const m = new Map();
      for (const x of members()) {
        if (!m.has(x.c.cmp.inst)) m.set(x.c.cmp.inst, []);
        m.get(x.c.cmp.inst).push(x);
      }
      for (const list of m.values()) list.sort((a, b) => a.c.cmp.idx - b.c.cmp.idx);
      return m;
    };
    const plugSig = (p) => { const o = { ...p }; delete o.id; delete o.autoOf; return o; };
    const memberSig = (x) => {
      const o = { rel: +(x.c.start - x.c.cmp.at).toFixed(4), track: x.t.id };
      for (const k of Object.keys(x.c)) if (!OWN.has(k)) o[k] = x.c[k];
      o.plugins = (x.c.plugins || []).map(plugSig);
      return o;
    };
    const instSig = (list) => JSON.stringify(list.map((x) => [x.c.cmp.idx, memberSig(x)]));

    // Every member of a copy gets its own idx (a split or a copy made inside takes the next one).
    const normalize = (preIds) => {
      let moved = false;
      for (const list of byInst().values()) {
        const seen = new Set();
        let next = Math.max(...list.map((x) => x.c.cmp.idx)) + 1;
        // clips that were there before keep their idx; new ones step aside
        list.sort((a, b) => (preIds.has(a.c.id) ? 0 : 1) - (preIds.has(b.c.id) ? 0 : 1) || a.c.cmp.idx - b.c.cmp.idx);
        for (const x of list) {
          if (seen.has(x.c.cmp.idx)) { x.c.cmp = { ...x.c.cmp, idx: next++ }; moved = true; }
          else x.c.cmp = { ...x.c.cmp };   // never share one tag object (a split copies the clip shallowly)
          seen.add(x.c.cmp.idx);
        }
      }
      return moved;
    };

    // Make copy J look like copy I (same clips, same places relative to its start, same effects).
    const follow = (I, J) => {
      const src = new Map(I.map((x) => [x.c.cmp.idx, x])), dst = new Map(J.map((x) => [x.c.cmp.idx, x]));
      const at = J[0].c.cmp.at, from = I[0].c.cmp.at, inst = J[0].c.cmp.inst;
      for (const [idx, x] of dst) if (!src.has(idx)) x.t.clips = x.t.clips.filter((c) => c !== x.c);
      for (const [idx, s] of src) {
        let d = dst.get(idx);
        if (!d) {
          const c = structuredClone(s.c);
          c.id = id();
          c.plugins = (c.plugins || []).map((p) => ({ ...p, autoOf: p.autoOf || p.id, id: id() }));
          c.active = true;
          s.t.clips.push(c);
          d = { c, t: s.t };
        }
        const c = d.c;
        for (const k of Object.keys(c)) if (!OWN.has(k) && !(k in s.c)) delete c[k];
        for (const k of Object.keys(s.c)) if (!OWN.has(k)) c[k] = structuredClone(s.c[k]);
        c.cmp = { ...s.c.cmp, inst, at };
        c.start = at + (s.c.start - from);
        const sp = s.c.plugins || [], dp = c.plugins || [];
        if (sp.length === dp.length && sp.every((p, i) => p.name === dp[i].name && p.type === dp[i].type)) {
          sp.forEach((p, i) => { for (const k of Object.keys(p)) if (k !== "id" && k !== "autoOf") dp[i][k] = structuredClone(p[k]); });
        } else c.plugins = sp.map((p) => ({ ...structuredClone(p), autoOf: p.autoOf || p.id, id: id() }));
        if (d.t !== s.t) { d.t.clips = d.t.clips.filter((x) => x !== c); s.t.clips.push(c); }
      }
    };

    const snap = () => {
      const m = byInst(), out = new Map();
      for (const [inst, list] of m) out.set(inst, { def: list[0].c.cmp.def, sig: instSig(list), starts: new Map(list.map((x) => [x.c.id, x.c.start])) });
      return out;
    };
    const after = (pre, preIds) => {
      let moved = normalize(preIds);
      const m = byInst();
      // a whole copy moved together: its start moves with it (that isn't an edit inside)
      for (const [inst, list] of m) {
        const p = pre.get(inst);
        if (!p || p.starts.size !== list.length || !list.every((x) => p.starts.has(x.c.id))) continue;
        const ds = list.map((x) => x.c.start - p.starts.get(x.c.id));
        if (Math.abs(ds[0]) > 1e-9 && ds.every((d) => Math.abs(d - ds[0]) < 1e-6)) { list.forEach((x) => (x.c.cmp = { ...x.c.cmp, at: x.c.cmp.at + ds[0] })); moved = true; }
      }
      // per compound: when exactly one copy changed, the others follow it
      const defs = new Map();
      for (const [inst, list] of m) {
        const def = list[0].c.cmp.def;
        if (!defs.has(def)) defs.set(def, []);
        defs.get(def).push({ inst, list, changed: !pre.has(inst) || pre.get(inst).sig !== instSig(list) });
      }
      let synced = false;
      for (const copies of defs.values()) {
        const moved = copies.filter((x) => x.changed && pre.has(x.inst));
        if (moved.length !== 1 || copies.length < 2) continue;
        for (const x of copies) if (x !== moved[0]) follow(moved[0].list, x.list);
        synced = true;
      }
      if (synced || moved) changed();   // the edit already sent the state; send it again with the tags as they are now
    };
    const wrap = (name) => {
      const orig = handlers[name];
      if (!orig) return;
      handlers[name] = (args) => {
        const pre = snap(), preIds = new Set(members().map((x) => x.c.id));
        const r = orig(args);
        if (r && typeof r.then === "function") return r.then((v) => { after(pre, preIds); return v; });
        after(pre, preIds);
        return r;
      };
    };

    // Copies of a whole compound copy (Cmd+B, Duplicate) become a new copy right after it.
    const dup = handlers.duplicateClips;
    if (dup) handlers.duplicateClips = (args) => {
      const src = new Map();
      for (const t of S.tracks) for (const c of t.clips) if (c.cmp && args.clipIds.includes(c.id)) src.set(c.id, c);
      const insts = byInst();
      const r = dup(args);
      if (!r || !r.clipIds) return r;
      const fresh = new Map();   // old copy -> new copy id (only when all of it was copied)
      const all = r.clipIds.map((cid) => { for (const t of S.tracks) { const c = t.clips.find((x) => x.id === cid); if (c) return c; } return null; });
      for (const [inst, list] of insts) if (list.every((x) => src.has(x.c.id))) fresh.set(inst, id());
      for (const c of all) {
        if (!c || !c.cmp || !fresh.has(c.cmp.inst)) continue;
        const list = insts.get(c.cmp.inst), at = list[0].c.cmp.at;
        const span = Math.max(...list.map((x) => x.c.start + x.c.length)) - Math.min(at, ...list.map((x) => x.c.start));
        const orig = list.find((x) => x.c.cmp.idx === c.cmp.idx).c;
        c.start = orig.start + span;
        c.cmp = { ...c.cmp, inst: fresh.get(c.cmp.inst), at: at + span };
      }
      changed();
      return r;
    };
    for (const name of EDITS) wrap(name);
    // Deep debug 16 Nov: commands that slide whole stretches of the song (a PART moved, time put in or cut out, a
    // new tempo) moved a compound copy's clips but not the copy's remembered start. The next edit inside one copy then
    // placed the other copies' clips from the stale start: they jumped, sometimes to before 0:00. After such a
    // command every copy's start now moves as far as its own first clip did. KT2_CMP_REANCHOR_OFF = old.
    // (shifts() is called from app.js once the PART commands exist; playground.js calls shifts(["setBpm"]) around its
    // own tempo command, which is the one that moves the audio clips.)
    const firstOf = () => { const m = new Map(); for (const [inst, list] of byInst()) { const f = list.reduce((a, b) => (b.c.start < a.c.start ? b : a)); m.set(inst, { id: f.c.id, start: f.c.start }); } return m; };
    const reanchor = (pre) => {
      let any = false;
      for (const [inst, list] of byInst()) {
        const p = pre.get(inst), f = p && list.find((x) => x.c.id === p.id);
        if (!f) continue;
        const d = f.c.start - p.start;
        if (Math.abs(d) > 1e-9) { list.forEach((x) => (x.c.cmp = { ...x.c.cmp, at: Math.max(0, x.c.cmp.at + d) })); any = true; }
      }
      // a PART move can cut a long clip in two and carry one piece away: the copy then starts at its earliest piece
      for (const list of byInst().values()) {
        const first = Math.min(...list.map((x) => x.c.start));
        if (first < list[0].c.cmp.at - 1e-9) { list.forEach((x) => (x.c.cmp = { ...x.c.cmp, at: first })); any = true; }
      }
      if (any) changed();
    };
    demo.shifts = (names) => {
      for (const name of names || ["moveSection", "slideSection", "dropSection", "insertSection", "insertTime", "deleteTime"]) {
        const orig = handlers[name];
        if (!orig || orig.cmpShift) continue;
        handlers[name] = (args) => {
          if (window.KT2_CMP_REANCHOR_OFF) return orig(args);
          const pre = firstOf(), preIds = new Set(members().map((x) => x.c.id)), r = orig(args);
          const done = () => { if (normalize(preIds)) changed(); reanchor(pre); };   // (normalize: the two pieces of a cut clip each get their own place in the copy)
          if (r && typeof r.then === "function") return r.then((v) => { done(); return v; });
          done();
          return r;
        };
        handlers[name].cmpShift = true;
      }
    };
    // Inside a compound its start is a wall: a clip dragged further left stops at the copy's start,
    // so the other copies never get clips pushed before theirs (Eman, 5 Nov: a copy at 0:00 had its
    // clip shoved off the start and stacked on the next one). Moving the whole copy is not clamped.
    const mv = handlers.moveClips;
    if (mv) handlers.moveClips = (args) => {
      if (args && Array.isArray(args.moves)) {
        const ids = new Set(args.moves.map((m) => m.clipId)), m = byInst();
        args = { ...args, moves: args.moves.map((x) => {
          const hit = members().find((y) => y.c.id === x.clipId);
          if (!hit) return x;
          const all = (m.get(hit.c.cmp.inst) || []).every((y) => ids.has(y.c.id));
          return !all && x.start < hit.c.cmp.at ? { ...x, start: hit.c.cmp.at } : x;
        }) };
      }
      return mv(args);
    };
    // Deep debug 16 Nov: the same wall for one clip dragged alone (moveClip): it used to pass the copy's start,
    // which the wall above was made to stop. KT2_CMP_WALL1_OFF = old.
    const mv1 = handlers.moveClip;
    if (mv1) handlers.moveClip = (args) => {
      if (args && !window.KT2_CMP_WALL1_OFF && typeof args.start === "number") {
        const hit = members().find((y) => y.c.id === args.clipId);
        if (hit && args.start < hit.c.cmp.at && (byInst().get(hit.c.cmp.inst) || []).length > 1) args = { ...args, start: hit.c.cmp.at };
      }
      return mv1(args);
    };

    const instOf = (clipId) => { for (const x of members()) if (x.c.id === clipId) return x.c.cmp; return null; };
    handlers.makeCompound = ({ clipIds, name }) => {
      const pick = [];
      S.tracks.forEach((t, ti) => t.clips.forEach((c) => { if (clipIds.includes(c.id) && t.kind !== "beat") pick.push({ c, t, ti }); }));
      if (pick.length < 2) return { error: "Pick two or more clips (Shift-click), then press G." };
      pick.sort((a, b) => a.c.start - b.c.start || a.ti - b.ti);
      const def = id(), inst = id(), at = pick[0].c.start;
      const nm = name || pick[0].c.name.replace(/\s*\(.*\)$/, "") + " +" + (pick.length - 1);
      pick.forEach((x, i) => (x.c.cmp = { def, inst, idx: i, at, name: nm }));
      changed();
      return { ok: true, inst, clipIds: pick.map((x) => x.c.id) };
    };
    // A new clip made inside an open compound joins it (and so every copy).
    handlers.joinCompound = ({ clipIds, inst }) => {
      const list = byInst().get(inst);
      if (!list) return { error: "That compound clip is gone." };
      let next = Math.max(...list.map((x) => x.c.cmp.idx)) + 1;
      const tag = list[0].c.cmp;
      for (const t of S.tracks) for (const c of t.clips) if (clipIds.includes(c.id) && !c.cmp) c.cmp = { ...tag, idx: next++ };
      changed();
      return { ok: true };
    };
    wrap("joinCompound");
    // Make unique, FL Studio style (Eman, 31 Oct): this pattern gets its own channel right under the old
    // one, with a full copy of the instrument (preset, kit, synth) and the lane's effects; the notes come
    // along, and edits to either never touch the other.
    const clonePlug = (x) => {
      const y = { ...x, id: id() };
      if (x.params) y.params = x.params.map((q) => ({ ...q }));
      if (x.toy) y.toy = { ...x.toy, preset: x.toy.preset ? JSON.parse(JSON.stringify(x.toy.preset)) : x.toy.preset };
      if (x.kit && typeof x.kit === "object") y.kit = Array.isArray(x.kit) ? x.kit.slice() : { ...x.kit };
      if (x.synth && typeof x.synth === "object") { try { y.synth = JSON.parse(JSON.stringify(x.synth)); } catch (e) { y.synth = { ...x.synth }; } }
      return y;
    };
    // PRODUCE has no channels (Eman, 31 Oct): a clip dragged onto an empty row gets a lane made for it there,
    // a copy of its old lane's setup (instrument, effects), and keeps its own notes and sound.
    // setClipRow { clipId, row, start }: the PLAYGROUND row a clip shows on (Eman, 31 Oct: "you can put
    // anything anywhere, no specific channels"). row = the trackId of the row it sits on; its own lane
    // (sound, effects, colour) stays the same. row = its own lane clears it.
    handlers.setClipRow = ({ clipId, row, start, moves }) => {
      // the automation under the moved patterns goes along, like moveClips (it stayed behind before 8 Nov: KT2_AL_NO_CARRY = old)
      const list = Array.isArray(moves) ? moves : [{ clipId, row, start }];
      const segs = new Map();
      if (!window.KT2_AL_NO_CARRY && window.KillToyAuto) for (const m of list) {
        const t = S.tracks.find((x) => x.clips.some((c) => c.id === m.clipId)), c = t && t.clips.find((x) => x.id === m.clipId);
        if (!c || m.start == null) continue;
        if (!segs.has(t)) segs.set(t, []);
        segs.get(t).push({ from: c.start, to: Math.max(0, m.start), len: c.length });
      }
      const carry = () => { for (const [t, sg] of segs) window.KillToyAuto.carry(t, sg); };
      // several at once (a picked group dragged to other rows): one undo step
      if (Array.isArray(moves)) { for (const m of moves) rowOne(m); carry(); changed(); return { ok: true }; }
      const r = rowOne({ clipId, row, start });
      if (r.ok) { carry(); changed(); }
      return r;
    };
    // A whole copy dragged on the song (to other rows too) moves as a copy: its start goes with it,
    // the other copies stay put (Eman, 5 Nov 21:05: "the compound should not randomly absorb other
    // lanes when I move it"). Inside an open compound (inside: true) a clip changing rows changes
    // that row in every copy, and nothing goes before the compound's bar 1.
    {
      const srow = handlers.setClipRow;
      handlers.setClipRow = (args) => {
        if (args && args.inside) {
          const fix = (m) => { const h = members().find((y) => y.c.id === m.clipId); return h && m.start != null && m.start < h.c.cmp.at ? { ...m, start: h.c.cmp.at } : m; };
          args = Array.isArray(args.moves) ? { ...args, moves: args.moves.map(fix) } : fix(args);
        }
        return srow(args);
      };
      wrap("setClipRow");
      const wrapped = handlers.setClipRow;
      handlers.setClipRow = (args) => {
        const r = wrapped(args);
        if (args && args.inside) {
          const ids = Array.isArray(args.moves) ? args.moves.map((m) => m.clipId) : [args.clipId];
          let n = 0;
          for (const cid of ids) {
            const h = members().find((y) => y.c.id === cid);
            if (!h) continue;
            for (const y of members()) if (y.c !== h.c && y.c.cmp.def === h.c.cmp.def && y.c.cmp.idx === h.c.cmp.idx && y.c.cmp.inst !== h.c.cmp.inst) {
              if (h.c.row) y.c.row = h.c.row; else delete y.c.row;
              n++;
            }
          }
          if (n) changed();
        }
        return r;
      };
    }
    const rowOne = ({ clipId, row, start }) => {
      const t = S.tracks.find((x) => x.clips.some((c) => c.id === clipId)), c = t && t.clips.find((x) => x.id === clipId);
      if (!c) return { error: "That clip isn't there any more." };
      if (start != null) c.start = Math.max(0, start);
      if (!row || row === t.id || !S.tracks.some((x) => x.id === row)) delete c.row; else c.row = row;
      t.clips.sort((x, y) => x.start - y.start);
      return { ok: true };
    };
    // The grid's empty rows are real places (Eman, 4 Nov: a clip dropped three rows down landed
    // right under the last lane). t.gap = empty rows shown above the lane; `before` puts the new
    // lane in another lane's gap.
    const placeLane = (nt, gap, before) => {
      const b = before ? S.tracks.find((x) => x.id === before) : null, g = Math.max(0, Math.floor(+gap || 0));
      delete nt.gap;   // a new lane copied from another must not keep that lane's empty rows (it landed rows too low)
      if (b) {
        nt.gap = Math.min(g, Math.max(0, (b.gap || 0) - 1));
        b.gap = Math.max(0, (b.gap || 0) - nt.gap - 1);
        if (!b.gap) delete b.gap;
        S.tracks.splice(S.tracks.indexOf(b), 0, nt);
      } else { if (g) nt.gap = g; S.tracks.push(nt); }
    };
    handlers.setLaneGap = ({ trackId, gap, before }) => {
      const t = S.tracks.find((x) => x.id === trackId);
      if (!t || t.kind === "beat") return { error: "No such lane." };
      S.tracks.splice(S.tracks.indexOf(t), 1); delete t.gap;
      placeLane(t, gap, before);
      changed(); return { ok: true };
    };
    handlers.moveClipToNewLane = ({ clipId, start, color, gap, before }) => {
      const ti = S.tracks.findIndex((t) => t.clips.some((c) => c.id === clipId));
      if (ti < 0) return { error: "That clip isn't there any more." };
      const t = S.tracks[ti], c = t.clips.find((x) => x.id === clipId);
      if (t.kind === "beat") return { error: "The beat stays on its own row." };
      const base = String(t.name).replace(/ \d+$/, ""), used = new Set(S.tracks.map((x) => x.name));
      let k = 2; while (used.has(`${base} ${k}`)) k++;
      const nt = { ...t, id: id(), name: `${base} ${k}`, armed: false, solo: false, muted: false, clips: [] };
      if (t.plugins) nt.plugins = t.plugins.map(clonePlug);
      delete nt.automation;
      t.clips = t.clips.filter((x) => x.id !== clipId);
      const ownRow = !c.row || c.row === t.id;   // it was showing on its own lane's row
      const startWas = c.start;
      if (start != null) c.start = Math.max(0, start);
      delete c.row;
      if (color && !nt.color) nt.color = color;   // its colour never changes when it moves
      nt.clips.push(c);
      // the automation lines under it go to its new lane (a line only it had moves, one shared with other
      // patterns is copied), shifted with it; they stayed behind, hidden, before 8 Nov (KT2_AL_NO_CARRY = old)
      if (!window.KT2_AL_NO_CARRY && window.KillToyAuto) {
        const was = t.automation || [];
        const mine = was.filter((l) => l.clips && l.clips.includes(clipId));
        if (mine.length) {
          nt.automation = mine.map((l) => {
            const cp = JSON.parse(JSON.stringify(l));
            cp.id = id(); cp.clips = [clipId];
            return cp;
          });
          const shift = c.start - (startWas != null ? startWas : c.start);
          if (shift) for (const l of nt.automation) l.points = l.points.map((p) => ({ t: Math.max(0, p.t + shift), v: p.v }));
          t.automation = was.filter((l) => !(l.clips && l.clips.length === 1 && l.clips[0] === clipId)).map((l) => (l.clips && l.clips.includes(clipId) ? { ...l, clips: l.clips.filter((x) => x !== clipId) } : l));
        }
      }
      placeLane(nt, gap, before);
      // B1 (Eman, 7 Nov: "patterns jump up a row"): an audio lane left empty is hidden on PRODUCE, so every
      // row under it moved up one, the clip just dropped too (it landed one row above where it was let go).
      // Its row stays as an empty grid row instead: the next lane under it gets one more empty row above it.
      if (!window.KT2_EMPTY_LANE_SHIFT && ownRow && t.kind === "take" && !t.clips.length) {
        const i = S.tracks.indexOf(t);
        const nx = S.tracks.slice(i + 1).find((x) => x.kind !== "beat" && !x.layerOf && x.onPlayground !== false && !(x.kind === "take" && !x.clips.length));
        if (nx) { nx.gap = (nx.gap || 0) + 1 + (t.gap || 0); delete t.gap; }
      }
      changed();
      return { ok: true, trackId: nt.id };
    };
    wrap("moveClipToNewLane");   // inside a compound: a clip dropped on an empty row takes its new lane in every copy
    // Linked patterns, like FL Studio: copies of a MIDI clip share their notes, so moving a note
    // in one moves it in all of them, until one is made unique (Eman, 31 Oct). c.pat = the pattern.
    const dupP = handlers.duplicateClips;
    if (dupP) handlers.duplicateClips = (args) => {
      for (const t of S.tracks) for (const c of t.clips) if (c.kind === "midi" && args.clipIds.includes(c.id) && !c.pat) c.pat = c.id;
      return dupP(args);
    };
    // Every way of changing notes keeps the copies mirrored (Eman, 5 Nov 20:52): the piano roll
    // (setMidiNotes) and KILLDRUM's BEAT grid (killDrumBeatSet, which used to change only the copy it
    // was opened on). Whichever copy changed becomes the pattern, and every linked copy takes it.
    const patNotes = () => {
      const m = new Map();
      for (const t of S.tracks) for (const c of t.clips) if (c.kind === "midi" && c.pat) m.set(c.id, JSON.stringify(c.notes || []));
      return m;
    };
    const mirror = (before, hint) => {
      const groups = new Map();
      // a KILLDRUM clip playing one BAR (c.kdBar) keeps its own notes: the beat window fills it (KT2_KD_CLIPBAR_OFF = old)
      for (const t of S.tracks) for (const c of t.clips) if (c.kind === "midi" && c.pat && !(c.kdBar && !window.KT2_KD_CLIPBAR_OFF)) { if (!groups.has(c.pat)) groups.set(c.pat, []); groups.get(c.pat).push(c); }
      let n = 0;
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        const src = list.find((c) => c.id === hint) || list.find((c) => before.get(c.id) !== JSON.stringify(c.notes || []));
        if (!src) continue;
        const want = JSON.stringify(src.notes || []);
        for (const c of list) if (c !== src && JSON.stringify(c.notes || []) !== want) { c.notes = (src.notes || []).map((x) => ({ ...x })); n++; }
      }
      if (n) changed();
    };
    const wrapMirror = (orig) => {
      if (!orig || orig.kjMirror) return orig;
      const w = (args) => {
        const before = patNotes();
        const r = orig(args);
        const hint = args && args.clipId;
        if (r && typeof r.then === "function") return r.then((v) => { mirror(before, hint); return v; });
        mirror(before, hint);
        return r;
      };
      w.kjMirror = true;
      return w;
    };
    // the playground adds KILLDRUM's handlers (and wraps these again) after this runs, so whatever
    // gets put there later is wrapped too
    for (const name of ["setMidiNotes", "killDrumBeatSet"]) {
      let cur = wrapMirror(handlers[name]);
      Object.defineProperty(handlers, name, { configurable: true, enumerable: true, get: () => cur, set: (f) => { cur = wrapMirror(f); } });
    }
    handlers.patternCount = ({ clipId }) => {
      let src = null;
      for (const t of S.tracks) for (const c of t.clips) if (c.id === clipId) src = c;
      if (!src || !src.pat) return { count: src ? 1 : 0 };
      return { count: S.tracks.reduce((a, t) => a + t.clips.filter((c) => c.kind === "midi" && c.pat === src.pat).length, 0) };
    };
    // one undo step: clip colours (empty = follow the channel's colour)
    handlers.setClipColor = ({ clipIds, color }) => {
      let n = 0;
      const pats = new Set();
      for (const t of S.tracks) for (const c of t.clips) if (clipIds.includes(c.id) && c.pat) pats.add(c.pat);   // linked pattern copies share a colour
      for (const t of S.tracks) for (const c of t.clips) if (clipIds.includes(c.id) || (c.pat && pats.has(c.pat))) { if (color) c.color = color; else delete c.color; n++; }
      changed(); return { ok: n > 0 };
    };
    handlers.makeUniqueLane = ({ clipId, color }) => {
      const ti = S.tracks.findIndex((t) => t.clips.some((c) => c.id === clipId));
      if (ti < 0) return { error: "That clip isn't there any more." };
      const t = S.tracks[ti], c = t.clips.find((x) => x.id === clipId);
      if (c.kind !== "midi") return { error: "Make unique works on patterns (MIDI clips)." };
      const base = String(t.name).replace(/ \d+$/, ""), used = new Set(S.tracks.map((x) => x.name));
      let k = 2; while (used.has(`${base} ${k}`)) k++;
      const nt = { ...t, id: id(), name: `${base} ${k}`, armed: false, solo: false, clips: [] };
      if (t.plugins) nt.plugins = t.plugins.map(clonePlug);
      if (t.automation) { try { nt.automation = JSON.parse(JSON.stringify(t.automation)); } catch (e) { delete nt.automation; } }
      const nc = { ...c, id: id(), notes: (c.notes || []).map((n) => ({ ...n })), plugins: (c.plugins || []).map(clonePlug) };
      delete nc.cmp; delete nc.pat;   // its own pattern now
      nc.row = c.row || t.id;          // and it stays exactly where it was (Eman, 31 Oct)
      if (color) { nt.color = color; delete nc.color; }   // a colour nobody else in the song has
      if (c.takeNotes) nc.takeNotes = c.takeNotes.map((l) => (l || []).map((n) => ({ ...n })));
      // the unique copy is identical to before (Eman, 9 Nov 22:18): every stacked synth comes along (they used to
      // stay behind, so only the main synth was left) and every automation line shows under it (the lines were
      // copied but still pointed at the old pattern, so they hid). KT2_UNIQUE_KEEP_OLD = old.
      const keep = !window.KT2_UNIQUE_KEEP_OLD;
      const lanesFor = (src) => (src || []).map((l) => {
        let x; try { x = JSON.parse(JSON.stringify(l)); } catch (e) { return null; }
        if (!keep) return x;
        const inside = (l.points || []).some((q) => q.t > c.start + 1e-4 && q.t < c.start + c.length - 1e-4);
        x.id = id();
        if (l.clips) x.clips = l.clips.includes(c.id) || inside ? [nc.id] : [];
        return x;
      }).filter(Boolean);
      const layers = [];
      if (keep) {
        if (t.automation) nt.automation = lanesFor(t.automation);
        nt.autoFold = (t.autoFold || []).includes(c.id) ? [nc.id] : [];
        const remap = {};
        for (const L of S.tracks.filter((x) => x.layerOf === t.id)) {
          const nl = { ...L, id: id(), layerOf: nt.id, armed: false, solo: false, clips: [] };
          if (L.plugins) nl.plugins = L.plugins.map(clonePlug);
          if (L.automation) nl.automation = lanesFor(L.automation);
          nl.autoFold = (L.autoFold || []).includes(c.id) ? [nc.id] : [];
          remap[L.id] = nl.id;
          layers.push(nl);
        }
        if (c.stack) { nc.stack = {}; for (const [k, ns] of Object.entries(c.stack)) nc.stack[remap[k] || k] = (ns || []).map((n) => ({ ...n })); }
      }
      t.clips = t.clips.filter((x) => x.id !== clipId);
      nt.clips.push(nc);
      // after the old lane's own stacked synths, so they stay with it
      let at = ti + 1;
      while (at < S.tracks.length && S.tracks[at].layerOf === t.id) at++;
      S.tracks.splice(keep ? at : ti + 1, 0, nt, ...layers);
      changed();
      return { ok: true, trackId: nt.id, clipId: nc.id };
    };
    handlers.makeUnique = ({ clipId, color }) => {
      const tag = instOf(clipId);
      if (!tag) return { error: "That clip isn't a compound clip." };
      const def = id(), relink = new Map(), repat = new Map();
      for (const x of members()) if (x.c.cmp.inst === tag.inst) {
        x.c.cmp = { ...x.c.cmp, def };
        // a new colour, so you can see it is its own thing now (Eman, 5 Nov 21:00)
        if (color) x.c.color = color;
        // its patterns leave the other copies' links too (but stay linked to each other)
        if (x.c.kind === "midi" && x.c.pat) { if (!repat.has(x.c.pat)) repat.set(x.c.pat, "p" + id()); x.c.pat = repat.get(x.c.pat); }
        // its sounds leave the old links but stay linked to each other (Eman, 31 Oct)
        if (x.c.kind !== "midi") { const l = x.c.link || x.c.src; if (!relink.has(l)) relink.set(l, "u" + id()); x.c.link = relink.get(l); }
      }
      changed();
      return { ok: true };
    };
    handlers.breakCompound = ({ clipId }) => {
      const tag = instOf(clipId);
      if (!tag) return { error: "That clip isn't a compound clip." };
      const ids = [];
      for (const x of members()) if (x.c.cmp.inst === tag.inst) { delete x.c.cmp; ids.push(x.c.id); }
      changed();
      return { ok: true, clipIds: ids };
    };
    handlers.renameCompound = ({ clipId, name }) => {
      const tag = instOf(clipId);
      if (!tag || !name) return { error: "That clip isn't a compound clip." };
      for (const x of members()) if (x.c.cmp.def === tag.def) x.c.cmp = { ...x.c.cmp, name };
      changed();
      return { ok: true };
    };
  }

  // ---------------------------------------------------------------- the page
  const C = { open: null };   // the copy (inst) that is open, or null on the song
  const groups = () => {
    const m = new Map();
    if (!ui.state) return m;
    ui.state.tracks.forEach((t, ti) => t.clips.forEach((c) => {
      if (!c.cmp) return;
      if (!m.has(c.cmp.inst)) m.set(c.cmp.inst, { inst: c.cmp.inst, def: c.cmp.def, name: c.cmp.name, at: c.cmp.at, members: [] });
      m.get(c.cmp.inst).members.push({ c, t, ti });
    }));
    for (const g of m.values()) {
      g.members.sort((a, b) => a.c.start - b.c.start || a.ti - b.ti);
      g.lead = g.members[0];
      g.start = Math.min(g.at, g.lead.c.start);
      g.end = Math.max(...g.members.map((x) => x.c.start + x.c.length));
      g.copies = 0;
    }
    for (const g of m.values()) g.copies = [...m.values()].filter((x) => x.def === g.def).length;
    return m;
  };
  const groupOf = (clipId) => { for (const g of groups().values()) if (g.members.some((x) => x.c.id === clipId)) return g; return null; };
  // The clips a click on this clip means: the whole compound on the song, just the clip inside one.
  const idsFor = (clipId) => { const g = !C.open && groupOf(clipId); return g ? g.members.map((x) => x.c.id) : [clipId]; };

  function make() {
    if (C.open) return toast("You're inside a compound clip. Go back (Esc) to group clips on the song.");
    const ids = selectedIds().filter((cid) => { const c = findClip(cid); return c && c.track.kind !== "beat"; });
    if (ids.length < 2) return toast("Select two or more clips (Shift-click or drag a box), then press G.");
    if (!ui.state.canCompound) return toast("Compound clips need the newer engine; the Mac app gets them later.");
    run("makeCompound", { clipIds: ids }).then((r) => {
      if (!r || !r.ok) return;
      ui.selectedClip = r.clipIds[0]; ui.extraClips = new Set(r.clipIds.slice(1)); ui.laneSig = ""; render();
      toast("Compound clip made. Double-click it to open it.");
    });
  }

  function open(inst) {
    const g = groups().get(inst);
    if (!g) return;
    C.open = inst;
    // where the song view was, so going back out lands on the same spot (Eman's comment, 6 Nov)
    { const sc0 = $("scroll"); C.back = { x: sc0 ? sc0.scrollLeft : 0, y: sc0 ? sc0.scrollTop : 0, pps: ui.pxPerSec, sel: ui.selectedClip, extra: [...ui.extraClips] }; }
    ui.selectedClip = null; ui.extraClips.clear();
    document.documentElement.classList.add("k2-inside");
    ui.laneSig = ""; render();
    // inside, the compound starts at the left edge: its own bar 1, no song space before it (Eman, 5 Nov 21:10)
    const sc = $("scroll");
    if (sc) sc.scrollLeft = window.KT2_CMP_SONG_BARS ? Math.max(0, toX(g.start) - 40) : Math.max(0, toX(g.start));
    if (!window.KT2_CMP_SONG_BARS && typeof renderRuler === "function") renderRuler($("ruler").scrollWidth || $("ruler").getBoundingClientRect().width);
  }
  // where the open copy starts (seconds), or null on the song
  const openAt = () => { if (!C.open || window.KT2_CMP_SONG_BARS) return null; const g = groups().get(C.open); return g ? g.start : null; };
  function close() {
    if (!C.open) return;
    const inst = C.open;
    C.open = null;
    document.documentElement.classList.remove("k2-inside");
    if (typeof renderRuler === "function") renderRuler($("ruler").scrollWidth || $("ruler").getBoundingClientRect().width);
    const g = groups().get(inst);
    if (g) { ui.selectedClip = g.lead.c.id; ui.extraClips = new Set(g.members.slice(1).map((x) => x.c.id)); }
    const back = !window.KT2_CMP_EXIT_JUMP && C.back; C.back = null;
    if (back && back.pps && ui.pxPerSec !== back.pps) { ui.pxPerSec = back.pps; if (typeof renderRuler === "function") renderRuler($("ruler").scrollWidth || $("ruler").getBoundingClientRect().width); }
    ui.laneSig = ""; render();
    if (back) { const put = () => { const sc = $("scroll"); if (sc) { sc.scrollLeft = back.x; sc.scrollTop = back.y; } }; put(); requestAnimationFrame(put); }
  }

  // ---- drawing a compound block: one thin band per clip inside, in that clip's colour
  const peakCache = new Map();
  async function drawInside(canvas, g) {
    const n = g.members.length, span = g.end - g.start;
    const peaks = await Promise.all(g.members.map(async (x) => {
      if (x.c.kind === "midi") return null;
      const key = `${x.c.id}:${x.c.offset}:${x.c.length}:${x.c.take}:${x.c.reversed ? 1 : 0}`;
      if (!peakCache.has(key)) peakCache.set(key, booth("getPeaks", { clipId: x.c.id, buckets: 256 }).catch(() => null));
      return peakCache.get(key);
    }));
    requestAnimationFrame(() => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      canvas.width = W; canvas.height = H;
      const g2 = canvas.getContext("2d");
      const top = 19 * dpr, bh = (H - top - 2 * dpr) / n;
      g.members.forEach((x, i) => {
        const col = x.c.color || colorOf(x.t);
        const x0 = ((x.c.start - g.start) / span) * W, w = Math.max(2, (x.c.length / span) * W), y0 = top + i * bh;
        // an empty pattern draws nothing at all, so it never looks like a note (Eman, 6 Nov 02:46)
        if (x.c.kind === "midi" && !(x.c.notes || []).length) return;
        g2.fillStyle = hexA(col, 0.16);
        g2.fillRect(x0, y0 + 1, w, bh - 2);
        g2.fillStyle = col;
        const mid = y0 + bh / 2, half = bh / 2 - 2 * dpr;
        if (x.c.kind === "midi") {
          const notes = x.c.notes || [];
          if (!notes.length) return;
          const lo = Math.min(...notes.map((q) => q.pitch)), hi = Math.max(...notes.map((q) => q.pitch)), spb = 60 / ui.state.bpm;
          for (const q of notes) {
            const nx = x0 + ((q.start * spb) / x.c.length) * w, nw = Math.max(1.5 * dpr, ((q.length * spb) / x.c.length) * w);
            const ny = hi === lo ? mid : y0 + bh - 3 * dpr - ((q.pitch - lo) / (hi - lo)) * (bh - 6 * dpr);
            g2.fillRect(nx, ny - dpr, nw, Math.max(1.5 * dpr, 2 * dpr));
          }
          return;
        }
        const p = peaks[i];
        if (!p || !p.peak) { g2.fillRect(x0, mid - 0.5 * dpr, w, dpr); return; }
        const arr = p.max || p.peak, m = arr.length;
        let loud = 0.02;
        for (let k = 0; k < m; k++) loud = Math.max(loud, Math.abs(arr[k]));
        const gain = Math.min(0.95 / loud, 4) * half;
        for (let px = 0; px < w; px++) {
          const v = Math.abs(arr[Math.min(m - 1, Math.floor((px / w) * m))]) * gain;
          g2.fillRect(x0 + px, mid - v, 1, Math.max(dpr * 0.6, v * 2));
        }
      });
    });
  }

  // ---- after app.js (and kt2.js) draw the lanes: fold each copy into one block, or show the open one
  function shape() {
    const gs = groups();
    const html = document.documentElement;
    if (C.open && !gs.has(C.open)) { C.open = null; html.classList.remove("k2-inside"); }
    pathBar(gs);
    if (C.open) {
      const g = gs.get(C.open), keep = new Set(g.members.map((x) => x.c.id)), rowsWith = new Set(g.members.map((x) => (window.KT2_CMP_ONE_LANE ? x.t.id : x.c.row || x.t.id)));
      document.querySelectorAll("#rows .row:not(.k2-ghost)").forEach((row) => { row.style.display = rowsWith.has(row.dataset.trackId) ? "" : "none"; });
      // the empty grid rows stay (it is its own playground); a hidden lane's own gap rows go with it
      document.querySelectorAll("#rows .row.k2-ghost").forEach((row) => { row.style.display = row.dataset.gapOf && !rowsWith.has(row.dataset.gapOf) ? "none" : ""; });
      document.querySelectorAll("#rows .clip").forEach((n) => { if (!keep.has(n.dataset.clipId)) n.style.display = "none"; });
      return;
    }
    document.querySelectorAll("#rows .row").forEach((row) => { if (row.style.display === "none" && !row.classList.contains("master") && !row.dataset.k2off && !row.dataset.k2away) row.style.display = ""; });
    for (const g of gs.values()) {
      for (const x of g.members.slice(1)) { const n = document.querySelector(`#rows .clip[data-clip-id="${x.c.id}"]`); if (n) n.style.display = "none"; }
      const node = document.querySelector(`#rows .clip[data-clip-id="${g.lead.c.id}"]`);
      if (!node) continue;
      block(node, g);
    }
  }
  function block(node, g) {
    node.classList.add("k2-cmp");
    node.classList.remove("midi", "kdclip");
    node.style.left = toX(g.start) + "px";
    node.style.width = Math.max(6, toX(g.end - g.start)) + "px";
    node.title = `${g.name}: ${g.members.length} clips. Double-click to open it.` + (g.copies > 1 ? ` ${g.copies} copies in the song share its insides.` : "");
    node.querySelectorAll(".k2-fade, .k2-vol, .fade-h, .gain-line, .trim, .trim-l, .trim-r, .edge, .comp-cut, .takes-toggle, .tag").forEach((x) => x.remove());
    const nm = node.querySelector(".nm");
    if (nm) nm.textContent = g.name;
    const label = node.querySelector(".clip-label");
    if (label && !label.querySelector(".k2-bdg")) {
      const b = el("span", "k2-bdg");
      b.innerHTML = `COMPOUND <em>(${g.members.length})</em>`;
      label.append(b);
    }
    const dd = node.querySelector(".k2-dd");
    if (dd) {
      const d2 = dd.cloneNode(true);   // drops the clip menu's listeners: this one opens the compound menu
      d2.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
      d2.addEventListener("click", (e) => { e.stopPropagation(); select(g); menu(d2, g); });
      dd.replaceWith(d2);
    }
    const old = node.querySelector("canvas"), cv = el("canvas");
    if (old) old.replaceWith(cv); else node.append(cv);
    drawInside(cv, g);
  }
  function select(g) {
    ui.selectedClip = g.lead.c.id;
    ui.extraClips = new Set(g.members.slice(1).map((x) => x.c.id));
    ui.selectedTrack = null;
  }
  function menu(anchor, g) {
    showMenu(anchor, [
      { heading: `COMPOUND · ${g.members.length} CLIPS` },
      { label: "Open", meta: "double-click", run: () => open(g.inst) },
      { label: "Rename", run: () => {
        const n = document.querySelector(`.clip[data-clip-id="${g.lead.c.id}"] .nm`);
        if (n) inlineEdit(n, g.name, (v) => run("renameCompound", { clipId: g.lead.c.id, name: v }));
      } },
      { label: "Make unique", run: () => run("makeUnique", { clipId: g.lead.c.id, color: window.KT2 && KT2.freshColors ? KT2.freshColors(1)[0] : null }).then((r) => r && r.ok && toast("This copy has its own insides now: edits to it stay here.")),
        disabled: g.copies < 2 },
      { label: "Duplicate after", meta: "Cmd+B", run: () => { select(g); window.KT2 && KT2.copyAfter(); } },
      { label: "Break apart", run: () => run("breakCompound", { clipId: g.lead.c.id }).then((r) => {
        if (r && r.ok) { ui.selectedClip = r.clipIds[0]; ui.extraClips = new Set(r.clipIds.slice(1)); ui.laneSig = ""; render(); }
      }) },
      { sep: true },
      { label: "Delete", meta: "⌫", danger: true, run: () => { ui.extraClips.clear(); run("deleteClip", { clipIds: g.members.map((x) => x.c.id) }); } },
    ]);
  }

  // ---- the thin path bar: SONG · V3 › compound name
  let bar = null;
  function pathBar(gs) {
    if (!C.open) { if (bar) bar.hidden = true; return; }
    const g = gs.get(C.open), s = ui.state;
    if (!bar) {
      bar = el("div", "k2-path");
      document.body.append(bar);
    }
    const ver = (s.versions || []).find((v) => v.current);
    bar.replaceChildren();
    const back = el("button", "k2-path-back");
    back.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M6.5 1.5 3 5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    back.title = "Back to the song (Esc)";
    const root = el("button", "k2-path-root", (s.session || "Song").toUpperCase() + (ver ? " · V" + ver.number : ""));
    root.title = "Back to the song (Esc)";
    back.onclick = root.onclick = (e) => { e.stopPropagation(); close(); };
    const cur = el("b", "k2-path-cur", g.name);
    cur.style.setProperty("--c", g.lead.c.color || colorOf(g.lead.t));
    cur.title = "Double-click to rename";
    cur.ondblclick = () => inlineEdit(cur, g.name, (v) => run("renameCompound", { clipId: g.lead.c.id, name: v }));
    const note = el("small", null, g.copies > 1 ? `${g.copies} copies in the song · edits here change all of them` : "edits here change it everywhere it is used");
    bar.append(back, root, el("span", "k2-path-sep", "›"), cur, note);
    const sc = $("scroll").getBoundingClientRect(), secs = $("sections").getBoundingClientRect();   // covers the section names, keeps the bar numbers
    Object.assign(bar.style, { left: sc.left + "px", width: sc.width + "px", top: sc.top + "px", height: Math.max(26, secs.bottom - sc.top) + "px" });
    bar.hidden = false;
  }

  function start() {
    // edits made inside an open compound say so, so the backend applies row changes to every copy
    { const _run = window.run;
      window.run = run = function (cmd, args) {
        if (C.open && (cmd === "setClipRow") && args) args = { ...args, inside: true };
        return _run.apply(this, [cmd, args]);
      };
    }
    // the ruler counts from the compound's start while it is open, and the view can't scroll before it
    if (typeof renderRuler === "function") {
      const _ruler = renderRuler;
      window.renderRuler = renderRuler = function (width) {
        _ruler.apply(this, arguments);
        const at = openAt();
        if (at == null) return;
        const b0 = Math.round(at / secPerBar() * 1000) / 1000;
        document.querySelectorAll("#ruler .tick").forEach((tk) => {
          const bar = parseFloat(tk.style.left) / toX(secPerBar());
          if (bar < b0 - 1e-3) { tk.style.visibility = "hidden"; return; }
          const lab = tk.firstChild;
          if (lab && lab.nodeType === 3) lab.textContent = String(Math.round(bar - b0) + 1);
          const sm = tk.querySelector("small");
          if (sm) sm.textContent = fmtTime((bar - b0) * secPerBar()).replace(/\.\d$/, "");
        });
      };
    }
    const scEl = $("scroll");
    if (scEl) scEl.addEventListener("scroll", () => {
      const at = openAt();
      if (at != null && scEl.scrollLeft < toX(at) - 0.5) scEl.scrollLeft = toX(at);
    });
    const _render = render;
    let tagSig = "";
    window.render = render = function () {
      // app.js keeps lanes it drew if nothing it knows about changed: a compound tag is new to it
      const sig = ui.state ? JSON.stringify(ui.state.tracks.map((t) => t.clips.map((c) => c.cmp || 0))) : "";
      if (sig !== tagSig) { tagSig = sig; ui.laneSig = ""; }
      // a click on a compound picks all of it, so it moves, copies and deletes as one
      if (!C.open && ui.selectedClip) {
        const g = groupOf(ui.selectedClip);
        if (g) for (const x of g.members) if (x.c.id !== ui.selectedClip) ui.extraClips.add(x.c.id);
      }
      _render.apply(this, arguments);
      shape();
    };
    const _relayout = relayoutTimeline;
    window.relayoutTimeline = relayoutTimeline = function () {
      _relayout.apply(this, arguments);
      if (C.open) return;
      for (const g of groups().values()) {
        const n = document.querySelector(`#rows .clip[data-clip-id="${g.lead.c.id}"]`);
        if (n) { n.style.left = toX(g.start) + "px"; n.style.width = Math.max(6, toX(g.end - g.start)) + "px"; }
      }
    };
    // On a block: one click picks the whole compound (then app.js drags all of it), a double-click opens it.
    document.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || C.open) return;
      const node = e.target.closest && e.target.closest("#rows .clip.k2-cmp");
      if (!node || e.target.closest(".k2-dd")) return;
      const g = groupOf(node.dataset.clipId);
      if (!g) return;
      if (e.detail === 2) { e.stopPropagation(); e.preventDefault(); open(g.inst); return; }
      if (window.KT2 && KT2.tool && KT2.tool !== "select") return;   // delete / mute tools act on all of it themselves
      if (!(e.shiftKey || e.metaKey || e.ctrlKey)) select(g);
    }, true);
    document.addEventListener("contextmenu", (e) => {
      const node = !C.open && e.target.closest && e.target.closest("#rows .clip.k2-cmp");
      if (!node) return;
      const g = groupOf(node.dataset.clipId);
      if (!g) return;
      e.preventDefault(); e.stopPropagation();
      select(g); ui.laneSig = ""; render();
      const n = document.querySelector(`#rows .clip[data-clip-id="${g.lead.c.id}"] .k2-dd`) || node;
      menu(n, g);
    }, true);
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !C.open) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      if (ui.roll || ui.tune || ui.home || !$("pop").hidden) return;
      e.preventDefault(); e.stopImmediatePropagation();
      close();
    }, true);
    window.addEventListener("resize", () => C.open && pathBar(groups()));
    if (ui.state) { ui.laneSig = ""; render(); }
  }
  if (document.documentElement.classList.contains("kt2")) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }

  window.KT2Compound = { make, open, close, idsFor, groupOf, get openInst() { return C.open; } };
  return { demo };
})();
