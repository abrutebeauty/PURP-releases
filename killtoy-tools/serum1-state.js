// Serum 1 (VST3) plugin state from an original Serum 1 .fxp, exact (silent).
//   node serum1-state.js probe <host> <hostdata> <file.fxp>...   tries each way, says which one Serum 1 takes
//   node serum1-state.js make <template.state> <file.fxp> <way> <out.state>
// A .fxp is a 60-byte header (CcnK / FPCh / XfsX ...) + Serum's own chunk. A plugin state from killtoy-host is "VC2!" + XML
// whose <IComponent> holds the plugin's own bytes (JUCE base64). Ways: A = chunk only, B = whole .fxp, C = template bytes with
// the chunk swapped in where the template's own chunk starts (same header, length fixed).
const fs = require('fs'); const path = require('path');
const UID = 'VST3-Serum-c32f6b61-aaff6c8e';
const T = '.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+';
function jdec(s) { const dot = s.indexOf('.'); const n = parseInt(s.slice(0, dot), 10); const out = Buffer.alloc(n); let pos = 0;
  for (const ch of s.slice(dot + 1)) { const d = T.indexOf(ch); if (d < 0) continue; for (let b = 0; b < 6; b++, pos++) { if (pos >= n * 8) break; if (d & (1 << b)) out[pos >> 3] |= 1 << (pos & 7); } } return out; }
function jenc(buf) { const bits = buf.length * 8; let s = buf.length + '.'; for (let pos = 0; pos < bits; pos += 6) { let d = 0; for (let b = 0; b < 6; b++) { const p = pos + b; if (p < bits && (buf[p >> 3] >> (p & 7)) & 1) d |= 1 << b; } s += T[d]; } return s; }
function parseState(b) { const xml = b.subarray(8).toString('utf8'); const get = (tag) => { const m = new RegExp('<' + tag + '>([^<]*)</' + tag + '>').exec(xml); return m ? m[1] : null; }; return { xml, comp: get('IComponent'), ctrl: get('IEditController') }; }
const fxpChunk = (fxp) => (fxp.toString('latin1', 0, 4) === 'CcnK' && fxp.toString('latin1', 8, 12) === 'FPCh' ? fxp.subarray(60) : fxp);
// where the template's own chunk starts: same bytes the .fxp chunk starts with (first 4), else first zlib header
function chunkStart(comp, chunk) { let i = comp.indexOf(chunk.subarray(0, 4)); if (i >= 0) return i; for (let k = 0; k < comp.length - 1; k++) if (comp[k] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(comp[k + 1])) return k; return -1; }
function compFor(way, comp0, fxp) {
  const chunk = fxpChunk(fxp);
  if (way === 'A') return chunk;
  if (way === 'B') return fxp;
  const at = chunkStart(comp0, chunk); if (at < 0) return null;
  const head = Buffer.from(comp0.subarray(0, at));
  // fix any 32-bit length in the header that equalled the old chunk length (either byte order)
  const oldLen = comp0.length - at;
  for (let k = 0; k + 4 <= head.length; k++) { if (head.readUInt32LE(k) === oldLen) head.writeUInt32LE(chunk.length, k); else if (head.readUInt32BE(k) === oldLen) head.writeUInt32BE(chunk.length, k); }
  return Buffer.concat([head, chunk]);
}
function makeState(templateBuf, fxpFile, way) {
  const s = parseState(templateBuf); const comp = compFor(way, jdec(s.comp), fs.readFileSync(fxpFile)); if (!comp) throw new Error('way ' + way + ': no chunk start in template');
  const xml = s.xml.replace(/<IComponent>[^<]*<\/IComponent>/, '<IComponent>' + jenc(comp) + '</IComponent>');
  const x = Buffer.from(xml, 'utf8'); const h = Buffer.alloc(8); h.write('VC2!', 0, 'latin1'); h.writeUInt32LE(x.length, 4); return Buffer.concat([h, x]);
}
module.exports = { makeState, UID };
if (require.main === module) {
  const [mode, ...a] = process.argv.slice(2);
  if (mode === 'make') { fs.writeFileSync(a[3], makeState(fs.readFileSync(a[0]), a[1], a[2])); console.log('MADE', a[3]); }
  else if (mode === 'probe') {
    const { spawn } = require('child_process'); const [bin, dataDir, ...files] = a;
    const child = spawn(bin, ['--parent-pid', String(process.pid), '--data-dir', dataDir], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '', started = false; const done = (c) => { try { child.kill(); } catch (e) {} process.exit(c); };
    setTimeout(() => { console.log('TIMEOUT'); done(1); }, 300000);
    child.stdout.on('data', (d) => { buf += d; const m = /KTHOST (\{.*\})/.exec(buf); if (m && !started) { started = true; run(JSON.parse(m[1])); } });
    function run({ port, token }) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/?t=${token}`); let id = 0; const wait = new Map();
      const call = (cmd, x = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, cmd, ...x })); });
      ws.onmessage = (m) => { if (typeof m.data !== 'string') return; const j = JSON.parse(m.data); if (j.id && wait.has(j.id)) { wait.get(j.id)(j); wait.delete(j.id); } };
      ws.onopen = async () => {
        let first = true;
        for (const f of files) for (const way of ['A', 'B', 'C']) {
          const ld = await call('load', { uid: UID, sampleRate: 48000, blockSize: 512 }); if (ld.error) { console.log('LOAD', ld.error); return done(1); }
          const p0 = await call('getParams', { slot: ld.slot }).catch(() => null);
          const st0 = Buffer.from((await call('getState', { slot: ld.slot })).state, 'base64');
          if (first) { first = false; fs.writeFileSync('out/serum1-default.state', st0); const c0 = jdec(parseState(st0).comp);
            console.log('DEFAULT comp bytes', c0.length, 'HEX', c0.subarray(0, 48).toString('hex'), '| ctrl', parseState(st0).ctrl ? jdec(parseState(st0).ctrl).length + ' bytes' : 'none');
            const ck = fxpChunk(fs.readFileSync(f)); console.log('FXP chunk bytes', ck.length, 'HEX', ck.subarray(0, 24).toString('hex'), '| chunk start in default', chunkStart(c0, ck)); }
          let st; try { st = makeState(st0, f, way); } catch (e) { console.log('RESULT', path.basename(f), way, 'skip:', e.message); await call('unload', { slot: ld.slot }).catch(() => null); continue; }
          const sr = await call('setState', { slot: ld.slot, state: st.toString('base64') });
          const p1 = await call('getParams', { slot: ld.slot }).catch(() => null); let diff = -1;
          if (p0 && p1 && p0.params && p1.params) { diff = 0; p0.params.forEach((q, i) => { if (p1.params[i] && Math.abs(p1.params[i].value - q.value) > 1e-4) diff++; }); }
          const back = jdec(parseState(Buffer.from((await call('getState', { slot: ld.slot })).state, 'base64')).comp);
          const ck = fxpChunk(fs.readFileSync(f)); const same = back.indexOf(ck.subarray(0, Math.min(64, ck.length))) >= 0;
          console.log('RESULT', path.basename(f), way, '| setState', sr.error || 'ok', '| params changed', diff, '| state now holds the fxp chunk', same, '| state bytes', back.length);
          await call('unload', { slot: ld.slot }).catch(() => null);
        }
        done(0);
      };
    }
  }
}
