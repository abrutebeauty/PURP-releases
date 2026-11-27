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
const S1 = mode.startsWith('s1-'); const UID = S1 ? 'VST3-Serum-c32f6b61-aaff6c8e' : 'VST3-Serum 2-a59c2861-c441d38e'; const SYN = S1 ? 'Serum' : 'Serum 2';
const T = '.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+';
function jenc(buf) { const bits = buf.length * 8; let s = buf.length + '.'; for (let pos = 0; pos < bits; pos += 6) { let d = 0; for (let b = 0; b < 6; b++) { const p = pos + b; if (p < bits && (buf[p >> 3] >> (p & 7)) & 1) d |= 1 << b; } s += T[d]; } return s; }
const tagSet = (xml, t, buf) => xml.replace(new RegExp('<' + t + '>[^<]*</' + t + '>'), '<' + t + '>' + jenc(buf) + '</' + t + '>');
const wrap = (xml) => { const x = Buffer.from(xml, 'utf8'); const h = Buffer.alloc(8); h.write('VC2!', 0, 'latin1'); h.writeUInt32LE(x.length, 4); return Buffer.concat([h, x]); };
const templateXml = fs.readFileSync(templateFile).subarray(8).toString('utf8');
function stateFor(fxpFile, row) {
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
  const notes = [];
  for (let t = 0; t < ntr && o < b.length; t++) {
    const id = b.toString('latin1', o, o + 4); o += 4; const len = u32(); const end = o + len;
    if (id !== 'MTrk') { o = end; continue; }
    let tick = 0, run = 0; const on = new Map();
    const vlq = () => { let v = 0, c; do { c = b[o++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
    while (o < end) {
      tick += vlq(); let st = b[o];
      if (st & 128) o++; else st = run;
      if (st === 0xff) { o++; const l = vlq(); o += l; continue; }
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
const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const packs = [...new Set(rows.map((r) => r.sitePack || r.pack))];
const made = [];
for (const pack of packs) {
  const list = rows.filter((r) => (r.sitePack || r.pack) === pack);
  const bpms = list.map((r) => r.siteBpm).filter(Boolean); const bpm = bpms.length ? bpms.sort((a, z) => bpms.filter((x) => x === z).length - bpms.filter((x) => x === a).length)[0] : 90;
  let at = 0; const lanes = [];
  for (const r of list) {
    const n = readMidi(r.midi); const lastEnd = n.reduce((m, x) => Math.max(m, x[1] + x[2]), 0);
    const beats = Math.max(4, Math.ceil(lastEnd / 4) * 4);
    lanes.push({ name: r.pattern, role: 'inst', instrument: SYN, vst: { uid: UID, name: SYN, state: stateFor(r.fxp, r) },
      clips: [{ name: r.pattern, start: at, beats, n }], about: `${r.siteBpm || ''} BPM ${r.siteKey || ''}`.trim() });
    at += beats + 4;   // one bar of air between patterns
  }
  const name = `${pack} - SYNTH`; const dir = slug(name);
  const j = { name, bpm, key: list[0].siteKey || 'Dm', lengthBars: Math.ceil(at / 4) + 2, lanes };
  fs.mkdirSync(path.join(outDir, dir), { recursive: true });
  fs.writeFileSync(path.join(outDir, dir, 'session.json'), JSON.stringify(j));
  made.push(dir); console.log('MADE', name, lanes.length, 'lanes,', at, 'beats,', bpm, 'BPM');
}
const idxFile = path.join(outDir, 'index-extra.json');
let idx = []; try { idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')); } catch (e) { /* new */ }
fs.writeFileSync(idxFile, JSON.stringify([...new Set([...idx, ...made])]));
console.log('INDEX', idxFile, JSON.stringify([...new Set([...idx, ...made])]));
