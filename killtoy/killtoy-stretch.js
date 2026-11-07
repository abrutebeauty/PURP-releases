// KILLTOY's stretcher in the browser: Signalsmith Stretch (the same one the app uses) and a clean
// band-limited resampler for TAPE, compiled from Source/dsp/StretchWasm.cpp to killtoy-stretch.wasm
// by scripts/build-stretch-wasm.sh (Eman, 6 Nov 22:23).
//   await KillToyStretch.load("killtoy-stretch.wasm");
//   KillToyStretch.ready                                   -> true once loaded
//   KillToyStretch.render(buf, { speed, semitones, formant, make })   -> AudioBuffer
//       speed > 1 = faster (shorter); semitones = key change; formant = keep a voice's character;
//       make(channels, length, sampleRate) makes the output buffer (ctx.createBuffer)
//   KillToyStretch.tape(buf, speed, make)                  -> AudioBuffer (speed and pitch together)
(function () {
  let ex = null, loading = null;
  const stub = () => 0;
  function instantiate(bytes) {
    return WebAssembly.instantiate(bytes, {
      wasi_snapshot_preview1: {
        fd_close: stub, fd_seek: stub, fd_write: stub,
        random_get: (ptr, len) => { const m = new Uint8Array(ex.memory.buffer, ptr, len); for (let i = 0; i < len; i++) m[i] = (Math.random() * 256) | 0; return 0; },
      },
    }).then((r) => { ex = r.instance.exports; if (ex._initialize) ex._initialize(); return true; });
  }
  let lastUrl = null;
  function load(url) {
    if (url) lastUrl = url;
    if (ex) return Promise.resolve(true);
    if (!loading) loading = fetch(url || "killtoy-stretch.wasm").then((r) => { if (!r.ok) throw new Error("no stretch wasm"); return r.arrayBuffer(); }).then(instantiate)
      .catch((e) => { loading = null; console.warn("[KillToyStretch]", e); return false; });
    return loading;
  }
  const f32 = () => new Float32Array(ex.memory.buffer);
  function put(buf) {   // planar copy of an AudioBuffer into wasm memory
    const ch = buf.numberOfChannels, n = buf.length, p = ex.st_alloc(ch * n);
    const m = f32();
    for (let c = 0; c < ch; c++) m.set(buf.getChannelData(c), (p >> 2) + c * n);
    return p;
  }
  function take(p, ch, n, sr, make) {
    const out = make(ch, n, sr), m = f32();
    for (let c = 0; c < ch; c++) out.getChannelData(c).set(m.subarray((p >> 2) + c * n, (p >> 2) + (c + 1) * n));
    return out;
  }
  function render(buf, o) {
    if (!ex) return null;
    const speed = o.speed || 1, semis = o.semitones || 0, ch = buf.numberOfChannels, n = buf.length;
    const outLen = Math.max(1, Math.round(n / speed));
    const inP = put(buf), outP = ex.st_alloc(ch * outLen);
    // long files (over ~3 min of stereo) take the lighter setting so the page stays quick
    const ok = ex.st_render(ch, buf.sampleRate, inP, n, outP, outLen, semis, o.formant ? 1 : 0, n * ch > 48000 * 2 * 180 ? 1 : 0);
    const out = ok ? take(outP, ch, outLen, buf.sampleRate, o.make) : null;
    ex.st_free(inP); ex.st_free(outP);
    return out;
  }
  function tape(buf, speed, make) {
    if (!ex) return null;
    const ch = buf.numberOfChannels, n = buf.length, outLen = Math.max(1, Math.round(n / speed));
    const inP = put(buf), outP = ex.st_alloc(ch * outLen);
    ex.st_tape(ch, inP, n, outP, outLen);
    const out = take(outP, ch, outLen, buf.sampleRate, make);
    ex.st_free(inP); ex.st_free(outP);
    return out;
  }
  // renderAsync: the same render in a Web Worker, so a long sound (a 2-minute vox into a song took ~12 s)
  // never freezes the page (Eman, 7 Nov: "it just freezes for like 5 seconds"). Falls back to render().
  // KT2_STRETCH_SYNC = true = always on the page, like before.
  let wk = null, wkOk = null, wkId = 0;
  const wkWait = new Map();
  function worker() {
    if (wkOk !== null) return wkOk;
    wkOk = (async () => {
      try {
        if (typeof Worker === "undefined" || window.KT2_STRETCH_SYNC) return false;
        const bytes = await (await fetch(lastUrl || "killtoy-stretch.wasm")).arrayBuffer();
        const mod = await WebAssembly.compile(bytes);
        const src = `let ex=null;const stub=()=>0;
onmessage=async(e)=>{const d=e.data;
 if(d.mod){const r=await WebAssembly.instantiate(d.mod,{wasi_snapshot_preview1:{fd_close:stub,fd_seek:stub,fd_write:stub,random_get:(p,l)=>{const m=new Uint8Array(ex.memory.buffer,p,l);for(let i=0;i<l;i++)m[i]=(Math.random()*256)|0;return 0;}}});ex=r.exports||r.instance.exports;if(ex._initialize)ex._initialize();postMessage({ready:1});return;}
 try{const ch=d.chans.length,n=d.chans[0].length,outLen=d.outLen;const inP=ex.st_alloc(ch*n),outP=ex.st_alloc(ch*outLen);
  let m=new Float32Array(ex.memory.buffer);for(let c=0;c<ch;c++)m.set(d.chans[c],(inP>>2)+c*n);
  let ok=1;if(d.tape)ex.st_tape(ch,inP,n,outP,outLen);else ok=ex.st_render(ch,d.sr,inP,n,outP,outLen,d.semis,d.formant?1:0,d.light?1:0);
  m=new Float32Array(ex.memory.buffer);const out=[];if(ok)for(let c=0;c<ch;c++)out.push(m.slice((outP>>2)+c*outLen,(outP>>2)+(c+1)*outLen));
  ex.st_free(inP);ex.st_free(outP);postMessage({id:d.id,out:ok?out:null},ok?out.map(x=>x.buffer):[]);}
 catch(err){postMessage({id:d.id,out:null,err:String(err)});}};`;
        wk = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
        await new Promise((res, rej) => {
          const to = setTimeout(() => rej(new Error("stretch worker timeout")), 8000);
          wk.onmessage = (e) => { if (e.data && e.data.ready) { clearTimeout(to); res(); } };
          wk.onerror = (e) => { clearTimeout(to); rej(e); };
          wk.postMessage({ mod });
        });
        wk.onmessage = (e) => { const w = wkWait.get(e.data.id); if (w) { wkWait.delete(e.data.id); w(e.data); } };
        return true;
      } catch (e) { console.warn("[KillToyStretch] worker off", e); wk = null; return false; }
    })();
    return wkOk;
  }
  async function viaWorker(buf, o, isTape) {
    if (!(await worker())) return isTape ? tape(buf, o.speed, o.make) : render(buf, o);
    const ch = buf.numberOfChannels, n = buf.length, outLen = Math.max(1, Math.round(n / (o.speed || 1)));
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c).slice());
    const id = ++wkId;
    const r = await new Promise((res) => { wkWait.set(id, res); wk.postMessage({ id, chans, sr: buf.sampleRate, outLen, semis: o.semitones || 0, formant: !!o.formant, tape: !!isTape, light: n * ch > 48000 * 2 * 180 }, chans.map((x) => x.buffer)); });
    if (!r.out) return isTape ? tape(buf, o.speed, o.make) : render(buf, o);
    const out = o.make(ch, outLen, buf.sampleRate);
    for (let c = 0; c < ch; c++) out.getChannelData(c).set(r.out[c]);
    return out;
  }
  const renderAsync = (buf, o) => viaWorker(buf, o, false);
  const tapeAsync = (buf, speed, make) => viaWorker(buf, { speed, make }, true);
  window.KillToyStretch = { load, render, tape, renderAsync, tapeAsync, get ready() { return !!ex; } };
})();
