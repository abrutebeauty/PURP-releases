// build-categories.js (sessions thread): same as build-dreamcore.js but ONE PROJECT PER PACK PER CATEGORY, BPM/key from the MIDI when the row has none.
// Builds KILLTOY desktop projects: one project per pack, one Serum 2 lane per preset, one pattern per lane
// (named like the site card) with the preset's MIDI, laid out one after another on the timeline.
//   node build-dreamcore.js <rows.json> <out songs dir> <template.state> <mode>
// rows.json: [{ pack, sitePack, pattern, siteBpm, siteKey, fxp, midi }]
// template.state: a Serum 2 state from killtoy-host getState (VC2! + VST3PluginState XML).
// mode: "s1-A" / "s1-B" / "s1-C" = Serum 1 lanes with the original .fxp, exact (way from serum1-state.js probe). Eman 27 Nov: Serum 1.
// mode: "preset" = each row's serumPreset (.SerumPreset) is turned into a Serum 2 state by serum2-preset-state.js (the way that works).
//   The old modes ("comp-fxp" etc., feeding the Serum 1 .fxp straight in) were tested and Serum 2 ignores them.
const fs = require('fs'); const path = require('path');
const [rowsFile, outDir, templateFile, mode] = process.argv.slice(2);
const S1 = mode.startsWith('s1-') || mode === 'dry'; const UID = S1 ? 'VST3-Serum-c32f6b61-aaff6c8e' : 'VST3-Serum 2-a59c2861-c441d38e'; const SYN = S1 ? 'Serum' : 'Serum 2';
const T = '.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+';
function jenc(buf) { const bits = buf.length * 8; let s = buf.length + '.'; for (let pos = 0; pos < bits; pos += 6) { let d = 0; for (let b = 0; b < 6; b++) { const p = pos + b; if (p < bits && (buf[p >> 3] >> (p & 7)) & 1) d |= 1 << b; } s += T[d]; } return s; }
const tagSet = (xml, t, buf) => xml.replace(new RegExp('<' + t + '>[^<]*</' + t + '>'), '<' + t + '>' + jenc(buf) + '</' + t + '>');
const wrap = (xml) => { const x = Buffer.from(xml, 'utf8'); const h = Buffer.alloc(8); h.write('VC2!', 0, 'latin1'); h.writeUInt32LE(x.length, 4); return Buffer.concat([h, x]); };
const templateXml = mode === 'dry' ? '' : fs.readFileSync(templateFile).subarray(8).toString('utf8');
function stateFor(fxpFile, row) {
  if (mode === 'dry') return '';
  if (S1) return require('./serum1-state.js').makeState(fs.readFileSync(templateFile), fxpFile, mode.slice(3)).toString('base64');
  if (mode === 'preset') return require('./serum2-preset-state.js').makeState(fs.readFileSync(templateFile), row.serumPreset).state.toString('base64');
  const fxp = fs.readFileSync(fxpFile);
  const chunk = fxp.subarray(8, 12).toString('latin1') === 'FPCh' ? fxp.subarray(60) : fxp;
  const [where, what] = mode.split('-');
  return wrap(tagSet(templateXml, where === 'comp' ? 'IComponent' : 'IEditController', what === 'chunk' ? chunk : fxp)).toString('base64');
}
// Standard MIDI file -> notes in beats [pitch, start, length, velocity]
function readMidi(file) {
  const b = fs.readFileSync(file); let o = 0;
  const u32 = () => { const v = b.readUInt32BE(o); o += 4; return v; }, u16 = () => { const v = b.readUInt16BE(o); o += 2; return v; };
  if (b.toString('latin1', 0, 4) !== 'MThd') throw new Error('not a MIDI file: ' + file);
  o = 4; const hl = u32(); u16(); const ntr = u16(); const div = u16(); o = 8 + hl;
  const notes = []; readMidi.tempo = 0;
  for (let t = 0; t < ntr && o < b.length; t++) {
    const id = b.toString('latin1', o, o + 4); o += 4; const len = u32(); const end = o + len;
    if (id !== 'MTrk') { o = end; continue; }
    let tick = 0, run = 0; const on = new Map();
    const vlq = () => { let v = 0, c; do { c = b[o++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
    while (o < end) {
      tick += vlq(); let st = b[o];
      if (st & 128) o++; else st = run;
      if (st === 0xff) { const mt = b[o++]; const l = vlq(); if (mt === 0x51 && l === 3 && !readMidi.tempo) readMidi.tempo = 60000000 / ((b[o] << 16) | (b[o + 1] << 8) | b[o + 2]); o += l; continue; }
      if (st === 0xf0 || st === 0xf7) { const l = vlq(); o += l; continue; }
      run = st; const ty = st & 0xf0; const d1 = b[o++]; const d2 = (ty === 0xc0 || ty === 0xd0) ? 0 : b[o++];
      if (ty === 0x90 && d2 > 0) { on.set(d1, [tick, d2]); }
      else if (ty === 0x80 || (ty === 0x90 && d2 === 0)) { const s = on.get(d1); if (s) { notes.push([d1, s[0] / div, (tick - s[0]) / div, s[1]]); on.delete(d1); } }
    }
    o = end;
  }
  notes.sort((a, z) => a[1] - z[1] || a[0] - z[0]);
  return notes.map(([p, s, l, v]) => [p, +s.toFixed(4), +Math.max(l, 0.01).toFixed(4), v]);
}
const KMAJ = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88], KMIN = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function detectKey(notes) { const h = new Array(12).fill(0); for (const x of notes) h[x[0] % 12] += x[2]; let best = null;
  for (let r = 0; r < 12; r++) for (const [prof, suf] of [[KMAJ, ''], [KMIN, 'm']]) { let sa = 0, sb = 0, sc = 0; const ma = h.reduce((a, z) => a + z, 0) / 12, mp = prof.reduce((a, z) => a + z, 0) / 12;
    for (let i = 0; i < 12; i++) { const a = h[(i + r) % 12] - ma, p = prof[i] - mp; sa += a * p; sb += a * a; sc += p * p; }
    const c = sa / Math.sqrt(sb * sc || 1); if (!best || c > best.c) best = { c, k: NAMES[r] + suf }; }
  return best ? best.k : 'Dm'; }
const mode_ = (a) => a.length ? [...a].sort((x, z) => a.filter((q) => q === z).length - a.filter((q) => q === x).length)[0] : null;
const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const groupOf = (r) => (r.sitePack || r.pack) + ' - ' + (r.catLabel || r.category || 'SYNTH');
const groups = [...new Set(rows.map(groupOf))];
const made = [];
for (const name of groups) {
  const list = rows.filter((r) => groupOf(r) === name);
  let at = 0; const lanes = []; const bpms = [], allNotes = [];
  for (const r of list) {
    const n = readMidi(r.midi); const lastEnd = n.reduce((m, x) => Math.max(m, x[1] + x[2]), 0);
    const rb = r.siteBpm || (readMidi.tempo ? Math.round(readMidi.tempo) : 0); if (rb) bpms.push(rb);
    n.forEach((x) => allNotes.push(x));
    const rk = r.siteKey || detectKey(n);
    const beats = Math.max(4, Math.ceil(lastEnd / 4) * 4);
    lanes.push({ name: r.pattern, role: 'inst', instrument: SYN, vst: { uid: UID, name: SYN, state: stateFor(r.fxp, r) },
      clips: [{ name: r.pattern, start: at, beats, n }], about: `${rb || ''} BPM ${rk}`.trim() });
    at += beats + 4;
  }
  const bpm = mode_(bpms) || 90; const dir = slug(name);
  const j = { name, bpm, key: list[0].siteKey || detectKey(allNotes), lengthBars: Math.ceil(at / 4) + 2, reference: 'no-beat.mp3', referenceMuted: true, lanes };
  fs.mkdirSync(path.join(outDir, dir), { recursive: true });
  fs.writeFileSync(path.join(outDir, dir, 'session.json'), JSON.stringify(j));
  made.push(dir); console.log('MADE', name, lanes.length, 'lanes,', at, 'beats,', bpm, 'BPM', j.key);
}
const idxFile = path.join(outDir, 'index-extra.json');
let idx = []; try { idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')); } catch (e) { /* new */ }
fs.writeFileSync(idxFile, JSON.stringify([...new Set([...idx, ...made])]));
console.log('INDEX', idxFile, JSON.stringify([...new Set([...idx, ...made])]));
