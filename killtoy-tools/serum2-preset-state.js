// Turns a Serum 2 .SerumPreset into a Serum 2 plugin state (what killtoy-host setState takes), and tests it (silent).
//   node serum2-preset-state.js make  <template.state> <file.SerumPreset> <out.state>
//   node serum2-preset-state.js probe <host> <hostdata> <template.state> <file.SerumPreset>...
// A plugin state is "VC2!" + XML with two parts (IComponent = "processor", IEditController = "controller"), each
// XferJson: "XferJson\0" + u64 meta length + meta JSON (hash = md5 of the zstd bytes) + u32 CBOR length + u32 2 + zstd(CBOR).
// A .SerumPreset holds both parts' keys in one CBOR map, so we split it by the template's key sets, copying raw CBOR bytes.
const fs = require('fs'); const path = require('path'); const zlib = require('zlib'); const crypto = require('crypto');
const T = '.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+';
function jdec(s) { const dot = s.indexOf('.'); const n = parseInt(s.slice(0, dot), 10); const out = Buffer.alloc(n); let pos = 0;
  for (const ch of s.slice(dot + 1)) { const d = T.indexOf(ch); if (d < 0) continue; for (let b = 0; b < 6; b++, pos++) { if (pos >= n * 8) break; if (d & (1 << b)) out[pos >> 3] |= 1 << (pos & 7); } } return out; }
function jenc(buf) { const bits = buf.length * 8; let s = buf.length + '.'; for (let pos = 0; pos < bits; pos += 6) { let d = 0; for (let b = 0; b < 6; b++) { const p = pos + b; if (p < bits && (buf[p >> 3] >> (p & 7)) & 1) d |= 1 << b; } s += T[d]; } return s; }
function unzstd(z, n) {
  if (zlib.zstdDecompressSync) return zlib.zstdDecompressSync(z);
  const r = require('child_process').spawnSync('python3', ['-c', 'import sys,zstandard;sys.stdout.buffer.write(zstandard.ZstdDecompressor().decompress(sys.stdin.buffer.read(),max_output_size=' + (n * 2 + 1024) + '))'], { input: z, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('no zstd: node ' + process.version + ' lacks zlib.zstd and python3 zstandard failed: ' + String(r.stderr).slice(0, 200));
  return r.stdout;
}
function zstd(b) {
  if (zlib.zstdCompressSync) return zlib.zstdCompressSync(b);
  // plain zstd frame with raw (stored) blocks: valid zstd, no library needed
  const parts = [Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0xe0])]; const fcs = Buffer.alloc(8); fcs.writeBigUInt64LE(BigInt(b.length)); parts.push(fcs);
  const MAX = 128 * 1024; let o = 0;
  do { const n = Math.min(MAX, b.length - o); const last = o + n >= b.length ? 1 : 0; const h = last | (0 << 1) | (n << 3);
    parts.push(Buffer.from([h & 255, (h >> 8) & 255, (h >> 16) & 255]), b.subarray(o, o + n)); o += n; } while (o < b.length);
  return Buffer.concat(parts);
}
function readXfer(b) {
  if (b.toString('latin1', 0, 9) !== 'XferJson\0') throw new Error('not XferJson');
  const ml = Number(b.readBigUInt64LE(9)); const metaStr = b.toString('utf8', 17, 17 + ml); const o = 17 + ml;
  const cl = b.readUInt32LE(o), ver = b.readUInt32LE(o + 4); return { metaStr, meta: JSON.parse(metaStr), ver, cbor: unzstd(b.subarray(o + 8), cl) };
}
function writeXfer(metaStr, cbor, ver) {
  const z = zstd(cbor); const hash = crypto.createHash('md5').update(z).digest('hex');
  const m = Buffer.from(metaStr.replace(/"hash":"[0-9a-f]*"/, '"hash":"' + hash + '"'), 'utf8');
  const h = Buffer.alloc(17); h.write('XferJson\0', 0, 'latin1'); h.writeBigUInt64LE(BigInt(m.length), 9);
  const c = Buffer.alloc(8); c.writeUInt32LE(cbor.length, 0); c.writeUInt32LE(ver, 4); return Buffer.concat([h, m, c, z]);
}
// minimal CBOR: top-level map -> { key: raw value bytes }, keeping order
function cborSkip(b, o) {
  const ib = b[o++]; const mt = ib >> 5; let ai = ib & 31; let n = ai;
  if (ai === 24) n = b[o++]; else if (ai === 25) { n = b.readUInt16BE(o); o += 2; } else if (ai === 26) { n = b.readUInt32BE(o); o += 4; } else if (ai === 27) { n = Number(b.readBigUInt64BE(o)); o += 8; }
  if (ai === 31) { // indefinite
    if (mt === 7) return o; while (b[o] !== 0xff) o = cborSkip(b, o); return o + 1; }
  if (mt === 0 || mt === 1 || mt === 7) return o;
  if (mt === 2 || mt === 3) return o + n;
  if (mt === 4) { for (let i = 0; i < n; i++) o = cborSkip(b, o); return o; }
  if (mt === 5) { for (let i = 0; i < 2 * n; i++) o = cborSkip(b, o); return o; }
  if (mt === 6) return cborSkip(b, o);
  throw new Error('cbor ' + mt);
}
function cborHead(mt, n) { if (n < 24) return Buffer.from([(mt << 5) | n]); if (n < 256) return Buffer.from([(mt << 5) | 24, n]); if (n < 65536) { const b = Buffer.alloc(3); b[0] = (mt << 5) | 25; b.writeUInt16BE(n, 1); return b; } const b = Buffer.alloc(5); b[0] = (mt << 5) | 26; b.writeUInt32BE(n, 1); return b; }
const cborText = (s) => { const t = Buffer.from(s, 'utf8'); return Buffer.concat([cborHead(3, t.length), t]); };
function cborMap(b) {
  let o = 0; const ib = b[o++]; if (ib >> 5 !== 5) throw new Error('top is not a map'); let ai = ib & 31, n = ai;
  if (ai === 24) n = b[o++]; else if (ai === 25) { n = b.readUInt16BE(o); o += 2; } else if (ai === 26) { n = b.readUInt32BE(o); o += 4; }
  const out = new Map(); const indef = ai === 31;
  for (let i = 0; indef ? b[o] !== 0xff : i < n; i++) { const k0 = o; o = cborSkip(b, o); const kb = b.subarray(k0, o);
    const v0 = o; o = cborSkip(b, o); out.set(textOf(kb), { kb, vb: b.subarray(v0, o) }); }
  return out;
}
function textOf(kb) { const ai = kb[0] & 31; const s = ai < 24 ? 1 : ai === 24 ? 2 : ai === 25 ? 3 : 5; return kb.subarray(s).toString('utf8'); }
function buildMap(entries) { return Buffer.concat([cborHead(5, entries.length), ...entries.flatMap((e) => [e.kb, e.vb])]); }
// the preset's own version/productVersion go in the CBOR so Serum 2 upgrades older presets itself (S2_TEMPLATE_VERSION=1 keeps the template's)
const KEEP = new Set(['component', 'product', 'url', 'vendor', 'modMatrixLocked', 'scalarCurvesLocked', 'presetHasBeenEdited', ...(process.env.S2_TEMPLATE_VERSION ? ['version', 'productVersion'] : [])]);
function parseState(b) { const xml = b.subarray(8).toString('utf8'); const get = (tag) => { const m = new RegExp('<' + tag + '>([^<]*)</' + tag + '>').exec(xml); return m ? m[1] : null; }; return { xml, comp: get('IComponent'), ctrl: get('IEditController') }; }
function makeState(templateBuf, presetFile) {
  const s = parseState(templateBuf); const pre = readXfer(fs.readFileSync(presetFile)); const pm = cborMap(pre.cbor);
  const name = pre.meta.presetName || path.basename(presetFile).replace(/\.SerumPreset$/i, '');
  const used = new Set(); const fresh = {};
  for (const tag of ['IComponent', 'IEditController']) {
    const part = readXfer(jdec(tag === 'IComponent' ? s.comp : s.ctrl)); const tm = cborMap(part.cbor); const entries = [];
    for (const [k, e] of tm) {
      if (k === 'presetName') { entries.push({ kb: e.kb, vb: cborText(name) }); continue; }
      if (k === 'presetAuthor' && pm.has(k)) { entries.push({ kb: e.kb, vb: pm.get(k).vb }); used.add(k); continue; }
      if (!KEEP.has(k) && pm.has(k)) { entries.push({ kb: e.kb, vb: pm.get(k).vb }); used.add(k); } else entries.push(e);
    }
    let meta = part.metaStr; if (tag === 'IEditController') meta = meta.replace(/"presetName":"[^"]*"/, '"presetName":' + JSON.stringify(name));
    fresh[tag] = writeXfer(meta, buildMap(entries), part.ver);
  }
  const left = [...pm.keys()].filter((k) => !used.has(k) && !KEEP.has(k));
  let xml = s.xml.replace(/<IComponent>[^<]*<\/IComponent>/, '<IComponent>' + jenc(fresh.IComponent) + '</IComponent>').replace(/<IEditController>[^<]*<\/IEditController>/, '<IEditController>' + jenc(fresh.IEditController) + '</IEditController>');
  const x = Buffer.from(xml, 'utf8'); const h = Buffer.alloc(8); h.write('VC2!', 0, 'latin1'); h.writeUInt32LE(x.length, 4);
  return { state: Buffer.concat([h, x]), name, left };
}
module.exports = { makeState };
if (require.main === module) {
  const [mode, ...a] = process.argv.slice(2);
  if (mode === 'make') { const r = makeState(fs.readFileSync(a[0]), a[1]); fs.writeFileSync(a[2], r.state); console.log('MADE', r.name, r.state.length, 'bytes; preset keys not placed:', r.left.join(',') || 'none'); }
  else if (mode === 'probe') {
    const { spawn } = require('child_process'); const [bin, dataDir, tpl, ...files] = a;
    console.log('node', process.version, 'zlib.zstd', !!zlib.zstdCompressSync);
    const child = spawn(bin, ['--parent-pid', String(process.pid), '--data-dir', dataDir], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '', started = false; const done = (c) => { try { child.kill(); } catch (e) {} process.exit(c); };
    setTimeout(() => { console.log('TIMEOUT'); done(1); }, 300000);
    child.stdout.on('data', (d) => { buf += d; const m = /KTHOST (\{.*\})/.exec(buf); if (m && !started) { started = true; run(JSON.parse(m[1])); } });
    function run({ port, token }) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/?t=${token}`); let id = 0; const wait = new Map();
      const call = (cmd, x = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, cmd, ...x })); });
      ws.onmessage = (m) => { if (typeof m.data !== 'string') return; const j = JSON.parse(m.data); if (j.id && wait.has(j.id)) { wait.get(j.id)(j); wait.delete(j.id); } };
      ws.onopen = async () => {
        for (const f of files) {
          const ld = await call('load', { uid: 'VST3-Serum 2-a59c2861-c441d38e', sampleRate: 48000, blockSize: 512 }); if (ld.error) { console.log('LOAD', ld.error); return done(1); }
          const p0 = await call('getParams', { slot: ld.slot }).catch(() => null);
          let r; try { r = makeState(fs.readFileSync(tpl), f); } catch (e) { console.log('MAKE FAIL', path.basename(f), e.message); continue; }
          const sr = await call('setState', { slot: ld.slot, state: r.state.toString('base64') });
          const back = parseState(Buffer.from((await call('getState', { slot: ld.slot })).state, 'base64'));
          let got = '?'; try { got = readXfer(jdec(back.ctrl)).meta.presetName; } catch (e) { got = 'unreadable ' + e.message; }
          const p1 = await call('getParams', { slot: ld.slot }).catch(() => null); let diff = -1;
          if (p0 && p1 && p0.params && p1.params) { diff = 0; p0.params.forEach((q, i) => { if (p1.params[i] && Math.abs(p1.params[i].value - q.value) > 1e-4) diff++; }); }
          console.log('RESULT', path.basename(f), '| setState', sr.error || 'ok', '| presetName now', JSON.stringify(got), '| params changed', diff, '| not placed', r.left.join(',') || 'none');
          await call('unload', { slot: ld.slot }).catch(() => null);
        }
        done(0);
      };
    }
  }
}
