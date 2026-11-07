// KILLTOY 2: the MIX page (third round button in the header, after PRODUCE and RECORD).
// GENERATED: scripts/kt2-mix-build.py puts the design mock's MIX code (mix.js, peaks.js,
// orbit.js, mxp.js) between the two halves of ui/kt2-mix-adapter.js. Edit the adapter or the
// build script, not ui/kt2-mix.js.
//
// The mock draws on its own made-up song; the adapter gives it the real one:
//   MXC   one channel per lane with sound: name, colour, a kind (drums, 808, vox, adlib, music,
//         synth, fx: guessed from the lane's role and name), where it plays, its sound range
//   MSEC  the song parts. The mock thinks in 32 bars, so the song is mapped onto 32 units
//   env   the real waveform of each lane (getPeaks), so the rows and the maps move with the music
//   the playhead is the real one; level, pan, mute and the master style go back to the engine
//   (setTrackVolume, setLanePan, toggleMute, KT2Tabs.applyStyle); EXPORT runs exportMix / exportTakes.
(function () {
if (!document.documentElement.classList.contains("kt2")) return;
const DPR = window.devicePixelRatio || 1;
const ktToast = (m) => (typeof toast === "function" ? toast(m) : console.log(m));

// ---------------------------------------------------------------- the real song in mock terms
const KINDS = {
  wave: { drums: "drums", "808": "bass", vox: "vox", adlib: "vox", music: "chords", synth: "melody", fx: "fx" },
  range: { drums: [[45, 110], [2200, 11000]], "808": [[32, 130]], vox: [[180, 4200]], adlib: [[300, 5200]], music: [[140, 3200]], synth: [[400, 6500]], fx: [[900, 14000]] },
};
function kindOf(t) {
  const n = ((t.name || "") + " " + (t.role || "")).toLowerCase();
  if (t.kind === "beat") return "music";
  if (/808|bass|\bsub\b/.test(n)) return "808";
  if (/drum|kick|snare|hat|perc|killdrum|beat/.test(n)) return "drums";
  if (/adlib|ad-lib/.test(n)) return "adlib";
  if (/vox|vocal|voc\b|lead|double|harm|choir|backs|verse|hook/.test(n)) return "vox";
  if (/\bfx\b|riser|sweep|impact|noise|whoosh/.test(n)) return "fx";
  if (t.kind === "inst" || /synth|pluck|arp|key|piano|pad/.test(n)) return "synth";
  return "music";
}
const kindOfId = (id) => String(id).replace(/_\d+$/, "");
// the mock's per-channel tables are keyed by its ids; look them up by the channel's kind
function mxByKind(o) { return new Proxy(o, { get: (x, k) => (k in x ? x[k] : x[kindOfId(k)] != null ? x[kindOfId(k)] : 0.5) }); }
function mxCat(name) {
  const n = String(name || "").toUpperCase();
  if (/INTRO/.test(n)) return "INTRO";
  if (/OUTRO|END/.test(n)) return "OUTRO";
  if (/HOOK|CHORUS|DROP/.test(n)) return "HOOK";
  return "VERSE";
}
const TRK = new Map();   // channel id -> track id
let SONGLEN = 1;
function mxLen() { return SONGLEN; }
function mxSongName() { return (ui.state && (ui.state.session || ui.state.sessionName)) || "Song"; }
function mxNowT() { const p = (ui.transport && ui.transport.position) || 0; return Math.max(0, Math.min(NT - 1, (p / SONGLEN) * NT)); }

function mxSync() {
  const s = ui.state;
  if (!s) return false;
  const tracks = s.tracks.filter((t) => t.clips && t.clips.length && t.kind !== "master");
  const ends = tracks.flatMap((t) => t.clips.map((c) => c.start + c.length));
  const secs = s.sections || [];
  SONGLEN = Math.max(1, ...ends, ...secs.map((x) => x.end || 0));
  const u = (sec) => Math.max(0, Math.min(32, (sec / SONGLEN) * 32));
  const used = {};
  const list = tracks.slice(0, 12).map((t) => {
    const k = kindOf(t);
    used[k] = (used[k] || 0) + 1;
    const id = used[k] === 1 ? k : k + "_" + used[k];
    TRK.set(id, t.id);
    const play = t.clips.filter((c) => c.active !== false).map((c) => [u(c.start), u(c.start + c.length), t.muted ? 0.4 : 1]);
    const col = (typeof colorOf === "function" ? colorOf(t) : null) || "#a7a4b4";
    return [id, t.name, /^#[0-9a-f]{6}$/i.test(col) ? col : "#a7a4b4", KINDS.wave[k], play, KINDS.range[k]];
  });
  MXC.length = 0; MXC.push(...list);
  MSEC.length = 0;
  if (secs.length) {
    if (secs[0].start > 0.01) MSEC.push(["INTRO", 0, u(secs[0].start), "#3a3a40"]);
    secs.forEach((x) => MSEC.push([x.name, u(x.start), u(x.end), typeof sectionColor === "function" ? (x.color || sectionColor(x.name)) : "#8b5cf0"]));
    MSEC[MSEC.length - 1][2] = 32;
  } else MSEC.push(["SONG", 0, 32, "#8b5cf0"]);
  for (const c of MXC) {
    const t = s.tracks.find((x) => x.id === TRK.get(c[0]));
    const ch = MX.ch[c[0]] || (MX.ch[c[0]] = { lv: 0, pan: 0, clean: 30, glue: 35, space: kindOfId(c[0]) === "vox" ? 25 : kindOfId(c[0]) === "adlib" ? 45 : 15, duck: "" });
    ch.lv = Math.max(-24, Math.min(6, Math.round(t.volume || 0)));
    ch.pan = Math.max(-1, Math.min(1, t.pan || 0));
    MX.mute[c[0]] = !!t.muted;
    SENT[c[0]] = { lv: ch.lv, pan: ch.pan, mute: MX.mute[c[0]] };
  }
  for (const k of Object.keys(MX.ch)) if (!MXC.some((c) => c[0] === k)) delete MX.ch[k];
  if (MX.sel && !MX.ch[MX.sel]) MX.sel = null;
  MX.spot = MX.spot.filter((x) => MX.ch[x.ch]);
  return true;
}

// the real waveform of each channel over the song (ENVN points), from the clips' peaks
const ENVN = 1024, ENV = new Map();
let envFor = "";
async function loadEnv() {
  const sig = JSON.stringify(MXC.map((c) => [c[0], c[4]]));
  if (sig === envFor) return;
  envFor = sig;
  for (const c of MXC) {
    const t = ui.state.tracks.find((x) => x.id === TRK.get(c[0]));
    if (!t) continue;
    const e = new Float32Array(ENVN);
    for (const cl of t.clips) {
      if (cl.active === false) continue;
      const a = Math.floor((cl.start / SONGLEN) * ENVN), b = Math.min(ENVN, Math.ceil(((cl.start + cl.length) / SONGLEN) * ENVN)), n = Math.max(2, b - a);
      let p = null;
      try { p = await booth("getPeaks", { clipId: cl.id, buckets: n }); } catch (_) {}
      if (envFor !== sig) return;
      const pk = p && (p.peak || p.max);
      if (!pk) { for (let i = a; i < b; i++) e[i] = Math.max(e[i], 0.5); continue; }
      for (let i = 0; i < n && a + i < ENVN; i++) e[a + i] = Math.max(e[a + i], Math.abs(pk[Math.min(pk.length - 1, Math.floor((i / n) * pk.length))] || 0));
    }
    let m = 0.0001; for (const v of e) m = Math.max(m, v);
    for (let i = 0; i < ENVN; i++) e[i] /= m;
    ENV.set(c[0], e);
  }
  if (ON) drawMix();
}
function mxEnv(c, W) {
  const e = ENV.get(c[0]);
  if (!e) return null;
  const mx = new Float32Array(W), mn = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const a = Math.floor((x / W) * ENVN), b = Math.max(a + 1, Math.floor(((x + 1) / W) * ENVN));
    let v = 0; for (let i = a; i < b; i++) v = Math.max(v, e[i]);
    mx[x] = v; mn[x] = -v;
  }
  return { mx, mn };
}
// how loud the channel is at mock time t (0..NT): its waveform, smoothed a little
function mxLv(c, t) {
  const e = ENV.get(c[0]);
  if (!e) return 1;
  const a = Math.floor((t / NT) * ENVN), b = Math.min(ENVN, Math.floor(((t + 1) / NT) * ENVN) + 1);
  let v = 0, n = 0; for (let i = a; i < b; i++) { v += e[i]; n++; }
  return Math.min(1, 0.15 + 1.1 * (n ? v / n : 0));
}

// ---------------------------------------------------------------- back to the engine
const SENT = {};
let lastSend = 0;
function pushChanges() {
  if (!ON || !ui.state) return;
  const now = performance.now(), drag = now - lastSend < 900;
  for (const c of MXC) {
    const id = c[0], ch = MX.ch[id], was = SENT[id], trackId = TRK.get(id);
    if (!ch || !was || !trackId) continue;
    if (ch.lv !== was.lv) { was.lv = ch.lv; lastSend = now; run("setTrackVolume", { trackId, db: ch.lv, drag }); }
    if (Math.abs((ch.pan || 0) - was.pan) > 0.005) { was.pan = ch.pan || 0; lastSend = now; run("setLanePan", { trackId, pan: was.pan, drag }); }
    if (!!MX.mute[id] !== was.mute) { was.mute = !!MX.mute[id]; run("toggleMute", { trackId }); }
  }
  if (MX.sty !== SENT.sty && SENT.sty !== undefined && window.KT2Tabs && KT2Tabs.applyStyle) KT2Tabs.applyStyle(MXSTY[MX.sty]);
  SENT.sty = MX.sty;
}
function mxExportGo(E) {
  if (E.busy) return;
  E.busy = 1; mixExport();
  const what = E.what;
  const p = what === "stems" ? run("exportTakes") : run("exportMix");
  // the web version records the song as it plays: the bar follows the playhead
  const prog = setInterval(() => { if (!MX.exp) return clearInterval(prog); const v = Math.max(1, Math.min(99, Math.round(((ui.transport.position || 0) / SONGLEN) * 100))); if (v !== E.busy) { E.busy = v; mixExport(); } }, 400);
  Promise.resolve(p).then((r) => {
    clearInterval(prog);
    MX.exp = null; mixExport();
    if (r && r.error) return ktToast(r.error);
    ktToast(what === "stems" ? `Exported ${(r && r.files) || MXC.length} stems to Music/PURP/Exports.` : (r && r.message) || "Exported the mix to Music/PURP/Exports.");
  });
}


// ======== mock: mix.js ========

// ---------- MIX page (3rd page after PLAYGROUND and RECORD): channels + SPOTLIGHT map on the left, channel or MIX & MASTER on the right ----------
const MXC=[ // id, name, colour, waveform kind, where it plays [bars], sound range [lo,hi Hz] (drums has two)
 ['drums','Drums','#e4ff3a','drums',[[0,4,.5],[4,28,1]],[[45,110],[2200,11000]]],
 ['808','808','#a86bff','bass',[[0,4,.6],[4,12,1],[20,28,1],[28,32,.5]],[[32,130]]],
 ['vox','Lead vox','#4fc3ff','vox',[[4,12,1],[12,20,1],[20,28,1]],[[180,4200]]],
 ['adlib','Adlibs','#3fd6b0','vox',[[13,14,.7],[15,16,.7],[17,18,.6],[21,22,.8],[23,24,.8],[25,26,.7],[27,28,.8]],[[300,5200]]],
 ['music','Music','#ff9de0','chords',[[0,32,.85]],[[140,3200]]],
 ['synth','Lead synth','#9f7bff','melody',[[20,28,.9]],[[400,6500]]],
 ['fx','FX','#ff6f7f','fx',[[3,4,.8],[11,12,.8],[19,20,.8],[27,28,.8]],[[900,14000]]]];
const MSEC=[['INTRO',0,4,'#3fb0f0'],['HOOK',4,12,'#e0559e'],['VERSE',12,20,'#8b5cf0'],['HOOK',20,28,'#e0559e'],['OUTRO',28,32,'#3fd6b0']];
const MX=window.MX={sel:null,reg:null,spot:[],an:0,manual:0,duck808:0,tgt:'spotify',loud:62,sty:1,ref:null,bal:{VOX:0,DRUMS:0,BASS:0,MUSIC:0},ch:{},exp:null,solo:null,mute:{}};
MXC.forEach(c=>MX.ch[c[0]]={lv:c[0]=='music'?-3:0,pan:0,clean:30,glue:35,space:c[0]=='vox'?25:c[0]=='adlib'?45:15,duck:c[0]=='808'?'':''});
const NB=30,NT=128,FLO=Math.log(20),FHI=Math.log(20000),binHz=b=>Math.exp(FLO+(b+.5)/NB*(FHI-FLO));
function mxAct(c,t){const bar=t/4;if(!c[4].length)return 0;let a=0;c[4].forEach(([x0,x1,v])=>{if(bar>=x0&&bar<x1)a=Math.max(a,v)});const sec=MSEC.find(s=>bar>=s[1]&&bar<s[2]);const sl=sec?{INTRO:.7,HOOK:1,VERSE:.85,OUTRO:.65}[mxCat(sec[0])]:1;return a*mxLv(c,t)*sl*(MX.mute[c[0]]?0:1)}
function mxProf(c,b){const f=binHz(b);let p=0;c[5].forEach(([lo,hi])=>{const l=Math.log(f),a=Math.log(lo),z=Math.log(hi),m=(a+z)/2,w=(z-a)/2;p=Math.max(p,Math.max(0,1-Math.pow((l-m)/w,4)))});return p}
function mxSpotAt(t){const bar=t/4;const s=[...MX.spot].reverse().find(s=>bar>=s.a&&bar<s.b);return s?s.ch:null}
function mxE(){const E={};MXC.forEach(c=>{const e=E[c[0]]=[];for(let t=0;t<NT;t++){const a=mxAct(c,t),row=new Float32Array(NB);if(a)for(let b=0;b<NB;b++)row[b]=a*mxProf(c,b);e.push(row)}});
 for(let t=0;t<NT;t++){const s=mxSpotAt(t);if(s){const sc=MXC.find(c=>c[0]==s);MXC.forEach(c=>{if(c[0]==s)return;for(let b=0;b<NB;b++)E[c[0]][t][b]*=1-.8*mxProf(sc,b)*(mxAct(sc,t)>0?1:0)})}
  if(MX.duck808&&E['808'])for(let b=0;b<NB;b++)if(binHz(b)<140)E['808'][t][b]*=.35}
 const clash=[];let n=0;for(let t=0;t<NT;t++){const r=new Uint8Array(NB);for(let b=0;b<NB;b++){let k=0;MXC.forEach(c=>{if(E[c[0]][t][b]>.5)k++});if(k>=2){r[b]=1;n++}}clash.push(r)}
 return {E,clash,n}}
function mxClashGroups(cl){// group clashes into readable items: which pair, where
 const out={};const R=mxE();for(let t=0;t<NT;t++)for(let b=0;b<NB;b++){if(!R.clash[t][b])continue;const who=MXC.filter(c=>R.E[c[0]][t][b]>.5).map(c=>c[0]);for(let i=0;i<who.length;i++)for(let j=i+1;j<who.length;j++){const k=who[i]+'|'+who[j];const o=out[k]=out[k]||{a:who[i],b:who[j],lo:1e9,hi:0,secs:new Set(),n:0};o.n++;o.lo=Math.min(o.lo,binHz(b));o.hi=Math.max(o.hi,binHz(b));const sec=MSEC.find(s=>t/4>=s[1]&&t/4<s[2]);sec&&o.secs.add(sec[0])}}
 return Object.values(out).filter(o=>!cl||o.a==cl||o.b==cl).sort((x,y)=>y.n-x.n)}
const fHz=f=>f>=1000?(f/1000).toFixed(f>=10000?0:1)+' kHz':Math.round(f/10)*10+' Hz';
const mxName=id=>(MXC.find(c=>c[0]==id)||[0,'that sound'])[1];

function mixMarkup(){return `<div class="mixv"><div class="mxl">
 <div class="mxh"><b class="mxt">MIX</b><button class="mxan${MX.an?' done':''}" data-a="an">${MX.an?'ANALYSED · AGAIN':'ANALYSE'}</button><span class="mxsw"><i data-m="0" class="${MX.manual?'':'on'}">SIMPLE</i><i data-m="1" class="${MX.manual?'on':''}">MANUAL</i></span><span class="mxsp"></span><span class="mxcl"></span><button class="mxfix" data-a="fix">FIX CLASHES</button></div>
 <div class="mxru"><span class="mxlab">SECTIONS</span><div class="mxtr">${MSEC.map((s,i)=>`<i data-s="${i}" style="left:${s[1]/32*100}%;width:${(s[2]-s[1])/32*100}%;--sc:${s[3]}">${s[0]}</i>`).join('')}</div></div>
 <div class="mxch">${MXC.map(c=>`<div class="mxr" data-c="${c[0]}" style="--cc:${c[2]}"><div class="mxn"><i class="mxsw2"></i><b>${c[1]}</b><span class="mxbt"><u class="mxst" data-c="${c[0]}" title="Spotlight: make it stand out here">★</u><u class="mxm" data-c="${c[0]}" title="Mute">M</u><u class="mxs" data-c="${c[0]}" title="Solo">S</u></span><em class="mxf"><s></s></em></div><div class="mxw"><canvas></canvas></div></div>`).join('')}</div>
 <div class="mxspec"><div class="mxfl">${[['AIR',12000],['HIGH',5000],['MID',1000],['LOW',150],['SUB',45]].map(([n,f])=>`<i style="top:${(1-(Math.log(f)-FLO)/(FHI-FLO))*100}%">${n}<small>${fHz(f)}</small></i>`).join('')}</div><div class="mxsv"><canvas></canvas><div class="mxspots"></div><div class="mxreg"></div></div></div>
 <div class="mxhint">Drag across the map to pick a part, then press ★ on the sound that should stand out there. Red = two sounds fighting for the same space.</div>
</div><div class="mxi"></div><div class="mxexp"></div></div>`}

function initMix(){}
function bindMix(scr){const v=scr.querySelector('.mixv');
 v.querySelector('.mxan').onclick=()=>mixAnalyse(v);v.querySelector('.mxfix').onclick=()=>{mixFix();ktToast('Fixed the clashes: each part has one sound that stands out, the 808 ducks under the kick')};
 v.querySelectorAll('.mxsw i').forEach(i=>i.onclick=()=>{MX.manual=+i.dataset.m;v.querySelectorAll('.mxsw i').forEach(x=>x.classList.toggle('on',x==i));mixInsp()});
 v.querySelectorAll('.mxtr i').forEach(i=>i.onclick=ev=>{ev.stopPropagation();const s=MSEC[+i.dataset.s];MX.reg=MX.reg&&MX.reg.a==s[1]&&MX.reg.b==s[2]?null:{a:s[1],b:s[2]};drawMix()});
 v.querySelectorAll('.mxr').forEach(r=>r.addEventListener('click',ev=>{if(ev.target.closest('.mxbt,.mxf'))return;ev.stopPropagation();MX.sel=MX.sel==r.dataset.c?null:r.dataset.c;drawMix()}));
 v.querySelectorAll('.mxst').forEach(u=>u.onclick=ev=>{ev.stopPropagation();mixSpot(u.dataset.c)});
 v.querySelectorAll('.mxm').forEach(u=>u.onclick=ev=>{ev.stopPropagation();MX.mute[u.dataset.c]=!MX.mute[u.dataset.c];drawMix()});
 v.querySelectorAll('.mxs').forEach(u=>u.onclick=ev=>{ev.stopPropagation();MX.solo=MX.solo==u.dataset.c?null:u.dataset.c;MXC.forEach(c=>MX.mute[c[0]]=!!MX.solo&&c[0]!=MX.solo);drawMix()});
 v.querySelectorAll('.mxf').forEach(f=>f.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();const id=f.closest('.mxr').dataset.c,r=f.getBoundingClientRect(),set=x=>{MX.ch[id].lv=Math.round(Math.max(-24,Math.min(6,((x-r.left)/r.width)*30-24)));mixFaders();if(MX.sel==id||!MX.sel)mixInsp()};set(ev.clientX);
  const mv=m=>set(m.clientX),up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up)};addEventListener('pointermove',mv);addEventListener('pointerup',up)}));
 const sv=v.querySelector('.mxsv');sv.addEventListener('pointerdown',ev=>{ev.preventDefault();const r=sv.getBoundingClientRect(),bar=x=>Math.max(0,Math.min(32,Math.round((x-r.left)/r.width*32*2)/2)),a=bar(ev.clientX);let moved=0;
  const mv=m=>{const b=bar(m.clientX);if(b!=a){moved=1;MX.reg={a:Math.min(a,b),b:Math.max(a,b)};mixRegion()}},up=m=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);
   if(!moved){const t=Math.floor((m.clientX-r.left)/r.width*NT),b=NB-1-Math.floor((m.clientY-r.top)/r.height*NB),R=mxE();let best=null,bv=.12;MXC.forEach(c=>{const e=R.E[c[0]][t]&&R.E[c[0]][t][b];if(e>bv){bv=e;best=c[0]}});MX.sel=best;if(!best)MX.reg=null}drawMix()};
  addEventListener('pointermove',mv);addEventListener('pointerup',up)});
 v.querySelector('.mxl').addEventListener('click',ev=>{if(ev.target.closest('.mxr,.mxh,.mxru,.mxsv,.mxspec'))return;MX.sel=null;drawMix()});
 addEventListener('keydown',ev=>{if(!scr.classList.contains('mixmode'))return;if(ev.key=='Escape'){if(MX.exp){MX.exp=null;mixExport()}else{MX.reg=null;MX.sel=null;drawMix()}}})}
function mixSpot(id){const a=MX.reg?MX.reg.a:0,b=MX.reg?MX.reg.b:32;const ex=MX.spot.find(s=>s.a==a&&s.b==b&&s.ch==id);MX.spot=MX.spot.filter(s=>!(s.a<b&&s.b>a&&s.a>=a&&s.b<=b));if(!ex)MX.spot.push({a,b,ch:id});
 MX.sel=id;drawMix();ktToast(ex?`Spotlight off`:`${mxName(id)} stands out ${MX.reg?`in bars ${a+1}–${b}`:'in the whole song'}. The sounds in its way step back only where they overlap`)}
function mixFix(){MX.spot=[{a:0,b:4,ch:'music'},{a:4,b:12,ch:'vox'},{a:12,b:20,ch:'vox'},{a:20,b:28,ch:'vox'},{a:28,b:32,ch:'music'}];MX.duck808=1;drawMix()}
function mixAnalyse(v){const b=v.querySelector('.mxan');b.classList.add('busy');b.textContent='LISTENING…';setTimeout(()=>{MX.an=1;mixFix();MX.loud=68;b.classList.remove('busy');b.classList.add('done');b.textContent='ANALYSED · AGAIN';drawMix();ktToast('Listened to the whole song: levels set, clashes fixed, master set to HEAT at -9 LUFS')},1500)}

// ---------- drawing ----------
function drawMix(){const v=document.querySelector('#s0 .mixv');if(!v)return;
 v.querySelectorAll('.mxr').forEach(r=>{const id=r.dataset.c;r.classList.toggle('sel',MX.sel==id);r.classList.toggle('mut',!!MX.mute[id]);r.querySelector('.mxs').classList.toggle('on',MX.solo==id);r.querySelector('.mxm').classList.toggle('on',!!MX.mute[id]);r.querySelector('.mxst').classList.toggle('on',MX.spot.some(s=>s.ch==id))});
 v.classList.toggle('hsel',!!MX.sel);mixFaders();
 v.querySelectorAll('.mxr').forEach(r=>{const c=MXC.find(x=>x[0]==r.dataset.c),cv=r.querySelector('canvas'),W=cv.clientWidth*DPR,H=cv.clientHeight*DPR;if(!W)return;cv.width=W;cv.height=H;const g=cv.getContext('2d');
  let e;try{e=mxEnv(c,W)}catch(_){e=null}const pres=new Float32Array(W);for(let x=0;x<W;x++)pres[x]=mxAct(c,x/W*NT);
  g.fillStyle=c[2];g.shadowColor=c[2];g.shadowBlur=4*DPR;for(let x=0;x<W;x++){if(!pres[x])continue;const a=e?Math.max(e.mx[x],-e.mn[x]):.5;const h=Math.max(1,a*pres[x]*H*.44);g.globalAlpha=MX.mute[c[0]]?.25:.9;g.fillRect(x,H/2-h,1,h*2)}g.globalAlpha=1;g.shadowBlur=0});
 const R=mxE(),cv=v.querySelector('.mxsv canvas'),W=cv.clientWidth*DPR,H=cv.clientHeight*DPR;cv.width=W;cv.height=H;const g=cv.getContext('2d');g.fillStyle='#121214';g.fillRect(0,0,W,H);
 MSEC.forEach(s=>{g.fillStyle='rgba(255,255,255,.035)';g.fillRect(s[1]/32*W,0,1,H)});for(let i=1;i<6;i++){g.fillStyle='rgba(255,255,255,.04)';g.fillRect(0,i/6*H,W,1)}
 if(W&&H){const cw=W/NT,bh=H/NB,off=document.createElement('canvas');off.width=W;off.height=H;const g0=g;{const g=off.getContext('2d');g.globalCompositeOperation='lighter';
 MXC.forEach(c=>{const E=R.E[c[0]],dim=MX.sel&&MX.sel!=c[0];for(let t=0;t<NT;t++)for(let b=0;b<NB;b++){const e=E[t][b];if(e<.04)continue;g.globalAlpha=Math.min(.75,e*.62)*(dim?.28:1);g.fillStyle=c[2];g.fillRect(t*cw,H-(b+1)*bh,cw+.5,bh+.5)}});
 g.globalCompositeOperation='source-over';g.globalAlpha=1;}g.filter=`blur(${1.6*DPR}px)`;g.drawImage(off,0,0);
 {const c2=document.createElement('canvas');c2.width=W;c2.height=H;const q=c2.getContext('2d');for(let t=0;t<NT;t++)for(let b=0;b<NB;b++)if(R.clash[t][b]){q.fillStyle='rgba(255,59,78,.48)';q.fillRect(t*cw,H-(b+1)*bh,cw+.5,bh+.5)}g.filter=`blur(${1.5*DPR}px)`;g.drawImage(c2,0,0)}g.filter='none';}
 if(MX.sel){const c=MXC.find(x=>x[0]==MX.sel);g.strokeStyle='#fff';g.lineWidth=1.5*DPR;g.setLineDash([4*DPR,3*DPR]);c[5].forEach(([lo,hi])=>{const y0=H-(Math.log(hi)-FLO)/(FHI-FLO)*H,y1=H-(Math.log(lo)-FLO)/(FHI-FLO)*H;g.strokeRect(1,y0,W-2,y1-y0)});g.setLineDash([])}
 const n=R.n,cl=v.querySelector('.mxcl');cl.innerHTML=n?`<i></i>${mxClashGroups().length} clashes`:'<i class="ok"></i>no clashes';cl.classList.toggle('ok',!n);
 v.querySelector('.mxspots').innerHTML=MX.spot.map(s=>{const c=MXC.find(x=>x[0]==s.ch);return `<i style="left:${s.a/32*100}%;width:${(s.b-s.a)/32*100}%;--cc:${c[2]}">★ ${c[1]}</i>`}).join('')+(MX.duck808?'<i class="dk" style="left:0;width:100%">808 ducks under the kick</i>':'');
 mixRegion();mixInsp();mixExport()}
function mixRegion(){const v=document.querySelector('#s0 .mixv');if(!v)return;const r=v.querySelector('.mxreg');r.style.display=MX.reg?'block':'none';if(MX.reg){r.style.left=MX.reg.a/32*100+'%';r.style.width=(MX.reg.b-MX.reg.a)/32*100+'%';r.dataset.t=`bars ${MX.reg.a+1}–${MX.reg.b}`}
 v.querySelectorAll('.mxtr i').forEach(i=>{const s=MSEC[+i.dataset.s];i.classList.toggle('on',!!MX.reg&&MX.reg.a==s[1]&&MX.reg.b==s[2])});
 v.querySelector('.mxsp').textContent=MX.reg?`PICKED: bars ${MX.reg.a+1}–${MX.reg.b} · press ★ on a sound`:''}
function mixFaders(){document.querySelectorAll('#s0 .mxr').forEach(r=>{const l=MX.ch[r.dataset.c].lv;r.querySelector('.mxf s').style.width=((l+24)/30*100)+'%';r.querySelector('.mxf').dataset.v=(l>0?'+':'')+l+' dB'})}

// ---------- loudness model (mock): short-term LUFS per half bar ----------
function mxLufs(){const base={INTRO:-17,HOOK:-12.4,VERSE:-14.2,OUTRO:-17.5},bal=MX.bal,lv=Object.values(MX.ch).reduce((a,c)=>a+c.lv,0)/MXC.length;const push=(MX.loud/100)*7.5,pts=[];
 for(let i=0;i<64;i++){const bar=i/2,s=MSEC.find(z=>bar>=z[1]&&bar<z[2]),wig=Math.sin(i*1.7)*.6+Math.sin(i*.43)*.4;let m=base[mxCat(s?s[0]:'VERSE')]+wig+lv*.5+(bal.VOX+bal.DRUMS+bal.BASS+bal.MUSIC)*.12;const mast=m+push-(Math.max(0,m+push+8))*.55;pts.push([m,mast])}
 const I=a=>10*Math.log10(a.reduce((x,v)=>x+Math.pow(10,v/10),0)/a.length);return {pts,mix:I(pts.map(p=>p[0])),mast:I(pts.map(p=>p[1])),tp:MX.loud>80?-0.3:-1.0,lra:Math.max(...pts.map(p=>p[1]))-Math.min(...pts.map(p=>p[1]))}}
const TGT={spotify:['SPOTIFY',-14],apple:['APPLE',-16],youtube:['YOUTUBE',-14],club:['CLUB',-8],sc:['SOUNDCLOUD',-9]};
const MXSTY=['EVEN','HEAT','GLASS','CASSETTE','VAST','FILM','SLAM'];
// one small moody glyph per master style (line art, drawn in currentColor)
const MXSYM=[
 '<path d="M2 14h32"/><path d="M5 14V8M10 14V7M15 14V8M20 14V7M25 14V8M30 14V7" opacity=".55"/><path d="M2 7.5h32" stroke-dasharray="1.5 2.5" opacity=".5"/>',
 '<path d="M2 15c4 0 5-9 8-9s4 9 8 9 5-11 8-11 4 11 8 11" /><path d="M2 18h32" opacity=".35"/><circle cx="26" cy="4" r="1.3" class="f"/>',
 '<path d="M18 2l7 7-7 9-7-9z"/><path d="M11 9h14M18 2v16M14.5 9 18 18l3.5-9" opacity=".45"/><path d="M29 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" class="f"/>',
 '<rect x="3" y="3" width="30" height="14" rx="2"/><circle cx="12" cy="10" r="3.2"/><circle cx="24" cy="10" r="3.2"/><path d="M12 13.2h12" opacity=".5"/><circle cx="12" cy="10" r=".9" class="f"/><circle cx="24" cy="10" r=".9" class="f"/>',
 '<path d="M18 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M11 4a9 9 0 0 0 0 12M25 4a9 9 0 0 1 0 12" opacity=".7"/><path d="M6 1.5a14 14 0 0 0 0 17M30 1.5a14 14 0 0 1 0 17" opacity=".35"/>',
 '<rect x="5" y="2" width="26" height="16"/><path d="M5 5.5h26M5 14.5h26" opacity=".5"/><path d="M9 3.6h2M15 3.6h2M21 3.6h2M27 3.6h2M9 16.4h2M15 16.4h2M21 16.4h2M27 16.4h2"/><circle cx="14" cy="10" r=".7" class="f"/><circle cx="20" cy="9" r=".5" class="f"/><circle cx="23" cy="11" r=".7" class="f"/><circle cx="17" cy="11.5" r=".4" class="f"/>',
 '<path d="M2 4h32M2 16h32" opacity=".45"/><path d="M3 10h2l1-6h3l1 12h3l1-12h3l1 12h3l1-12h3l1 12h3l1-6h2"/>'];
const MXSD=['clean and balanced, nothing sticks out','warm, thick, pushed like hot tape','bright and airy, clear top end','soft, a bit worn, gentle wobble','wide and deep, big space','dark, grainy, nostalgic','loud and in your face, hits the wall'];

// ---------- right side: nothing picked = MIX & MASTER, a channel = its sound ----------
function mixInsp(){const p=document.querySelector('#s0 .mixv .mxi');if(!p)return;MX.sel?chanInsp(p,MX.sel):masterInsp(p)}
function bars(defs){return defs.map(([k,l,val,pct,bi,hint])=>`<div class="mxb${bi?' bi':''}" data-k="${k}" title="${hint||''}"><u style="${bi?`left:${pct<50?pct:50}%;width:${Math.abs(pct-50)}%`:`width:${pct}%`}"></u><b>${l}</b><em>${val}</em></div>`).join('')}
function dragBars(p,fn){p.querySelectorAll('.mxb').forEach(b=>b.addEventListener('pointerdown',ev=>{ev.preventDefault();const r=b.getBoundingClientRect(),set=x=>fn(b.dataset.k,Math.max(0,Math.min(100,(x-r.left)/r.width*100)));set(ev.clientX);
 const mv=m=>set(m.clientX),up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);drawMix()};addEventListener('pointermove',mv);addEventListener('pointerup',up)}))}
function masterInsp(p){const L=mxLufs(),tg=TGT[MX.tgt],diff=L.mast-tg[1];
 const verdict=Math.abs(diff)<1?`Right on ${tg[0].toLowerCase()} loudness.`:diff>0?`${diff.toFixed(1)} dB louder than ${tg[0].toLowerCase()} plays songs, so they'll turn it down by that much. Still fine for rap, it just won't sound louder there.`:`${(-diff).toFixed(1)} dB quieter than ${tg[0].toLowerCase()} plays songs. Push LOUDNESS up.`;
 p.innerHTML=`<div class="mih"><b>MIX &amp; MASTER</b><small>nothing picked = the whole song</small><button class="mxex" data-a="exp"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 1v7M3 5l3 3 3-3M1 10.5h10"/></svg>EXPORT</button></div>
 <div class="mlu"><div class="mlb"><span class="mln">${L.mast.toFixed(1)}</span><span class="mlu2">LUFS<small>integrated</small></span><span class="mls"><i>MIX <b>${L.mix.toFixed(1)}</b></i><i>TRUE PEAK <b>${L.tp.toFixed(1)}</b> dB</i><i>RANGE <b>${L.lra.toFixed(0)}</b> LU</i></span></div>
  <canvas class="mlc"></canvas><div class="mlt">${Object.entries(TGT).map(([k,t])=>`<i data-t="${k}" class="${k==MX.tgt?'on':''}">${t[0]} <small>${t[1]}</small></i>`).join('')}</div><p class="mlv">${verdict}</p></div>
 ${MX.manual?`<div class="mman"><div class="msub">MASTER CHAIN</div>${[['EQ','tilt +0.8 dB · low shelf +1.2 dB @ 90 Hz · cut 2 dB @ 320 Hz'],['DYNAMICS','3 bands · 2.1 : 1 · glue on the mids'],['WIDTH','lows mono below 120 Hz · highs 112%'],['CLIPPER','soft · shaves 1.8 dB of peaks'],['LIMITER',`ceiling ${L.tp.toFixed(1)} dB · ${(MX.loud/100*7.5).toFixed(1)} dB pushed`]].map(([n,d])=>`<div class="mmod"><b>${n}</b><span>${d}</span><i class="tg2 on"></i></div>`).join('')}<div class="msub">HEAR IT AS</div><div class="mlt2">${['STUDIO','SPOTIFY','YOUTUBE','PHONE SPEAKER','CAR'].map((x,i)=>`<i class="${i?'':'on'}">${x}</i>`).join('')}</div></div>`:
 `<div class="mtb"><div class="msub">SOUND <small>your song (yellow) inside the range songs like it sit in</small></div><canvas class="mtc"></canvas></div>
 <div class="mrow2"><div class="mref"><div class="msub">REFERENCE</div>${MX.ref?`<div class="mrf on"><b>${MX.ref}</b><small>matching sound and loudness</small><i data-a="unref">×</i></div>`:`<div class="mrf"><b>Drop a song you like</b><small>or pick one of yours</small></div>`}<div class="mrp">${['LUCIFÖR V13','Ruski V2','u wanna V9'].map(x=>`<i data-r="${x}" class="${MX.ref==x?'on':''}">${x}</i>`).join('')}</div></div>
 <div class="mbal"><div class="msub">BALANCE <small>inside the finished song</small></div>${bars(Object.entries(MX.bal).map(([k,v])=>[k,k,(v>0?'+':'')+v.toFixed(1)+' dB',50+v/6*50,1,'Turn this part up or down in the finished song']))}</div></div>
 <div class="msty"><div class="msub">STYLE</div><div class="msr msy">${MXSTY.map((s,i)=>`<i data-s="${i}" class="${MX.sty==i?'on':''}" title="${MXSD[i]}"><svg viewBox="0 0 36 20" width="36" height="20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${MXSYM[i]}</svg><b>${s}</b></i>`).join('')}</div><div class="msyd">${MXSD[MX.sty]||''}</div>${bars([['loud','LOUDNESS',`${L.mast.toFixed(1)} LUFS`,MX.loud,0,'How hard the master pushes']])}</div>`}`;
 const c=p.querySelector('.mlc'),W=c.clientWidth*DPR,H=c.clientHeight*DPR;c.width=W;c.height=H;const g=c.getContext('2d'),y=v=>H-(v+24)/22*H;
 MSEC.forEach(s=>{g.fillStyle=s[3]+'22';g.fillRect(s[1]/32*W,0,(s[2]-s[1])/32*W,H)});
 g.fillStyle='rgba(228,255,58,.10)';g.fillRect(0,y(tg[1]+1),W,y(tg[1]-1)-y(tg[1]+1));g.strokeStyle='rgba(228,255,58,.7)';g.setLineDash([5*DPR,4*DPR]);g.beginPath();g.moveTo(0,y(tg[1]));g.lineTo(W,y(tg[1]));g.stroke();g.setLineDash([]);
 g.fillStyle='rgba(228,255,58,.9)';g.font=`600 ${9*DPR}px Inter`;g.fillText(`${tg[0]} ${tg[1]}`,6*DPR,y(tg[1])-4*DPR);
 const line=(k,col,w,glow)=>{g.strokeStyle=col;g.lineWidth=w*DPR;g.shadowColor=col;g.shadowBlur=glow*DPR;g.beginPath();L.pts.forEach((pt,i)=>{const x=i/63*W;i?g.lineTo(x,y(pt[k])):g.moveTo(x,y(pt[k]))});g.stroke();g.shadowBlur=0};
 line(0,'rgba(255,255,255,.3)',1.2,0);line(1,'#ecebf2',2,8);
 [-6,-12,-18].forEach(v=>{g.fillStyle='rgba(255,255,255,.35)';g.fillText(v,W-22*DPR,y(v)+3*DPR)});
 p.querySelectorAll('.mlt i').forEach(i=>i.onclick=()=>{MX.tgt=i.dataset.t;mixInsp()});
 p.querySelector('.mxex').onclick=()=>{MX.exp={what:'master',fmt:'WAV 24-bit',tgt:MX.tgt};mixExport()};
 const t=p.querySelector('.mtc');if(t){const W2=t.clientWidth*DPR,H2=t.clientHeight*DPR;t.width=W2;t.height=H2;const q=t.getContext('2d'),N=60,yy=v=>H2/2-v*H2*.36;q.fillStyle='rgba(255,255,255,.07)';q.beginPath();
  for(let i=0;i<=N;i++)q.lineTo(i/N*W2,yy(.5+Math.sin(i/N*3)*.08));for(let i=N;i>=0;i--)q.lineTo(i/N*W2,yy(-.5-Math.sin(i/N*3)*.08));q.fill();
  const fixAmt=MX.an?.25:1,cur=i=>{const f=i/N;return (Math.exp(-Math.pow((f-.1)/.08,2))*.85+Math.exp(-Math.pow((f-.45)/.1,2))*-.35+Math.exp(-Math.pow((f-.8)/.08,2))*.6)*fixAmt+(MX.bal.BASS/6)*Math.exp(-Math.pow((f-.12)/.1,2))+(MX.bal.VOX/6)*Math.exp(-Math.pow((f-.5)/.12,2))*.8+(MX.sty==2?.25*f:MX.sty==1?.2*(1-f):0)};
  q.strokeStyle='#e4ff3a';q.shadowColor='#e4ff3a';q.shadowBlur=6*DPR;q.lineWidth=2*DPR;q.beginPath();for(let i=0;i<=N;i++){const x=i/N*W2;i?q.lineTo(x,yy(cur(i))):q.moveTo(x,yy(cur(i)))}q.stroke();q.shadowBlur=0;
  q.fillStyle='rgba(255,255,255,.4)';q.font=`600 ${8.5*DPR}px Inter`;[['LOW',.06],['MID',.47],['HIGH',.86]].forEach(([s,x])=>q.fillText(s,x*W2,H2-4*DPR));
  if(!MX.an){q.fillStyle='rgba(255,90,100,.9)';q.fillText('too much low end · scooped mids · sharp highs',8*DPR,12*DPR)}}
 p.querySelectorAll('.mrp i').forEach(i=>i.onclick=()=>{MX.ref=MX.ref==i.dataset.r?null:i.dataset.r;mixInsp();MX.ref&&ktToast(`Matching to ${MX.ref}: its sound curve and loudness are the new target`)});const ur=p.querySelector('[data-a="unref"]');ur&&(ur.onclick=()=>{MX.ref=null;mixInsp()});
 p.querySelectorAll('.msr i').forEach(i=>i.onclick=()=>{MX.sty=+i.dataset.s;mixInsp()});
 dragBars(p,(k,v)=>{if(k=='loud')MX.loud=Math.round(v);else MX.bal[k]=Math.round((v/50-1)*6*2)/2;mixInsp()})}
function chanInsp(p,id){const c=MXC.find(x=>x[0]==id),S=MX.ch[id],groups=mxClashGroups(id),spots=MX.spot.filter(s=>s.ch==id);
 p.innerHTML=`<div class="mih" style="--cc:${c[2]}"><i class="mcd"></i><b>${c[1]}</b><small>${c[5].map(([a,b])=>fHz(a)+' – '+fHz(b)).join(' + ')}</small><button class="mxbk" data-a="back">MIX &amp; MASTER</button></div>
 <button class="mspot${spots.length?' on':''}" style="--cc:${c[2]}">★ ${spots.length?`STANDS OUT · ${spots.map(s=>s.a==0&&s.b==32?'whole song':`bars ${s.a+1}–${s.b}`).join(', ')}`:`MAKE IT STAND OUT ${MX.reg?`IN BARS ${MX.reg.a+1}–${MX.reg.b}`:'IN THE WHOLE SONG'}`}</button>
 <div class="msub">SHARES SPACE WITH <small>${groups.length?'who wins where they overlap':'nothing, it has its own space'}</small></div>
 <div class="mcls">${groups.slice(0,4).map(o=>{const other=o.a==id?o.b:o.a,oc=MXC.find(x=>x[0]==other);return `<div class="mcl"><i style="background:${oc[2]}"></i><b>${oc[1]}</b><span>${o.hi/o.lo<1.3?'around '+fHz(o.lo):fHz(o.lo)+' – '+fHz(o.hi)} · ${[...o.secs].join(', ').toLowerCase()}</span><em><u data-w="${id}" data-o="${other}">${c[1].toUpperCase()} WINS</u><u data-w="${other}" data-o="${id}">${oc[1].toUpperCase()} WINS</u></em></div>`}).join('')||'<div class="mcl none">✓ no clashes</div>'}</div>
 ${MX.manual?`<div class="msub">WHERE IT STEPS BACK <small>dynamic EQ, moves only while the winner plays</small></div><canvas class="mdeq"></canvas>
  <div class="mman">${[['EQ','high-pass 80 Hz · −2 dB @ 400 Hz · +1.5 dB @ 3 kHz'],['COMPRESSOR',`3:1 · attack 12 ms · ${(S.glue/10).toFixed(1)} dB squeeze`],['SIDECHAIN',S.duck?`ducks under ${mxName(S.duck)} · 6 dB`:'off'],['SEND',`Space ${S.space}% · Echo 1/8 ${Math.round(S.space/2)}%`]].map(([n,d])=>`<div class="mmod"><b>${n}</b><span>${d}</span><i class="tg2 on"></i></div>`).join('')}</div>`:
 `<div class="mcc">${bars([['lv','LEVEL',(S.lv>0?'+':'')+S.lv+' dB',(S.lv+24)/30*100],['pan','PAN',S.pan==0?'centre':S.pan<0?`L ${-S.pan}`:`R ${S.pan}`,50+S.pan/2,1],['clean','CLEAN','removes mud and rumble',S.clean],['glue','GLUE','evens it out',S.glue],['space','SPACE','room and echo',S.space]])}</div>
 <div class="msub">DUCK UNDER <small>sidechain: dips when this plays</small></div><div class="mdk">${['',...MXC.map(x=>x[0]).filter(x=>x!=id)].map(x=>`<i data-d="${x}" class="${S.duck==x?'on':''}">${x?mxName(x):'NOTHING'}</i>`).join('')}</div>
 <div class="mfx"><i>+ ADD EFFECT</i><small>Pump, Space, Crush, SC Clip, TUNR, Texture</small></div>`}`;
 p.querySelector('.mxbk').onclick=()=>{MX.sel=null;drawMix()};p.querySelector('.mspot').onclick=()=>mixSpot(id);
 p.querySelectorAll('.mcl u').forEach(u=>u.onclick=()=>{const w=u.dataset.w,a=MX.reg?MX.reg.a:0,b=MX.reg?MX.reg.b:32;MX.spot=MX.spot.filter(s=>!(s.a>=a&&s.b<=b&&(s.ch==u.dataset.o||s.ch==w)));MX.spot.push({a,b,ch:w});drawMix();ktToast(`${mxName(w)} wins over ${mxName(u.dataset.o)} ${MX.reg?`in bars ${a+1}–${b}`:''}`)});
 p.querySelectorAll('.mdk i').forEach(i=>i.onclick=()=>{S.duck=i.dataset.d;if(id=='808'&&S.duck=='drums')MX.duck808=1;if(id=='808'&&S.duck!='drums')MX.duck808=0;drawMix()});
 const pf=p.querySelector('.mfx');pf&&(pf.onclick=()=>ktToast('Opens the effect list, same as the FX tab on the playground'));
 dragBars(p,(k,v)=>{if(k=='lv')S.lv=Math.round(v/100*30-24);else if(k=='pan'){S.pan=Math.round((v-50)*2);if(Math.abs(S.pan)<8)S.pan=0}else S[k]=Math.round(v);
  const b=p.querySelector(`.mxb[data-k="${k}"]`),u=b.querySelector('u'),e=b.querySelector('em');if(k=='pan'){const q=50+S.pan/2;u.style.left=(q<50?q:50)+'%';u.style.width=Math.abs(q-50)+'%';e.textContent=S.pan==0?'centre':S.pan<0?`L ${-S.pan}`:`R ${S.pan}`}else{u.style.width=(k=='lv'?(S.lv+24)/30*100:S[k])+'%';if(k=='lv')e.textContent=(S.lv>0?'+':'')+S.lv+' dB'}mixFaders()});
 const dq=p.querySelector('.mdeq');if(dq){const W=dq.clientWidth*DPR,H=dq.clientHeight*DPR;dq.width=W;dq.height=H;const g=dq.getContext('2d');g.fillStyle='#121214';g.fillRect(0,0,W,H);
  const xf=f=>(Math.log(f)-FLO)/(FHI-FLO)*W;g.fillStyle=c[2]+'33';g.beginPath();g.moveTo(0,H);for(let b=0;b<NB;b++)g.lineTo(xf(binHz(b)),H-mxProf(c,b)*H*.7);g.lineTo(W,H);g.fill();
  const winners=[...new Set(MX.spot.map(s=>s.ch))].filter(w=>w!=id);g.strokeStyle='#ecebf2';g.lineWidth=2*DPR;g.beginPath();for(let b=0;b<NB;b++){let cut=0;winners.forEach(w=>{const wc=MXC.find(x=>x[0]==w);cut=Math.max(cut,mxProf(wc,b)*mxProf(c,b))});const yv=H*.35+cut*H*.4;b?g.lineTo(xf(binHz(b)),yv):g.moveTo(0,yv)}g.stroke();
  g.fillStyle='rgba(255,255,255,.4)';g.font=`600 ${8.5*DPR}px Inter`;[100,1000,10000].forEach(f=>g.fillText(fHz(f),xf(f)+3*DPR,H-4*DPR));if(winners.length){g.fillStyle='#ecebf2';g.fillText('dips for: '+winners.map(mxName).join(', '),6*DPR,12*DPR)}}}

// ---------- EXPORT ----------
function mixExport(){const box=document.querySelector('#s0 .mixv .mxexp');if(!box)return;const E=MX.exp;box.classList.toggle('on',!!E);if(!E){box.innerHTML='';return}
 const WH=[['master','FULL SONG','mastered, ready to upload'],['clean','STREAMING COPY',`turned to ${TGT[E.tgt][1]} LUFS`],['stems','STEMS',`one file per channel (${MXC.length})`],['inst','INSTRUMENTAL','no vocals'],['acap','ACAPELLA','vocals only, dry'],['loop','LOOPED PART','the picked bars']];
 const FM=['WAV 24-bit','WAV 16-bit','MP3 320','FLAC','AIFF'];
 box.innerHTML=`<div class="mxe"><div class="mxeh"><b>EXPORT</b><small>${mxSongName()}</small><i data-a="x">×</i></div>
 <div class="msub">WHAT</div><div class="mxeg">${WH.map(([k,t,d])=>`<i data-w="${k}" class="${E.what==k?'on':''}"><b>${t}</b><small>${d}</small></i>`).join('')}</div>
 <div class="msub">FORMAT</div><div class="mlt">${FM.map(f=>`<i data-f="${f}" class="${E.fmt==f?'on':''}">${f}</i>`).join('')}</div>
 <div class="msub">LOUDNESS</div><div class="mlt">${Object.entries(TGT).map(([k,t])=>`<i data-t="${k}" class="${k==E.tgt?'on':''}">${t[0]} <small>${t[1]}</small></i>`).join('')}</div>
 <div class="mxef"><span>${mxSongName()} ${WH.find(w=>w[0]==E.what)[1].toLowerCase()}.${E.fmt.split(' ')[0].toLowerCase()}</span><button data-a="go">${E.busy?'EXPORTING… '+E.busy+'%':'EXPORT'}</button></div></div>`;
 box.querySelector('[data-a="x"]').onclick=()=>{MX.exp=null;mixExport()};box.onclick=ev=>{if(ev.target==box){MX.exp=null;mixExport()}};
 box.querySelectorAll('[data-w]').forEach(i=>i.onclick=()=>{E.what=i.dataset.w;mixExport()});box.querySelectorAll('[data-f]').forEach(i=>i.onclick=()=>{E.fmt=i.dataset.f;mixExport()});box.querySelectorAll('.mxe [data-t]').forEach(i=>i.onclick=()=>{E.tgt=i.dataset.t;mixExport()});
 box.querySelector('[data-a="go"]').onclick=()=>mxExportGo(E)}

document.head.insertAdjacentHTML('beforeend',`<style>
.L4 .mixv{display:none;position:absolute;left:0;right:0;top:52px;bottom:0;z-index:60;background:#1d1d1f;gap:14px;padding:12px 16px 14px;box-sizing:border-box;font-family:var(--f)}
.L4.mixmode .mixv{display:flex}.L4.mixmode .tb .tl,.L4.mixmode .tb .sep{visibility:hidden}
.L4 .mixv *{pointer-events:auto}
.L4 .mxl{flex:0 0 700px;display:flex;flex-direction:column;gap:6px;min-width:0}
.L4 .mxh{height:30px;display:flex;align-items:center;gap:8px}.L4 .mxt{font:800 12px var(--f);letter-spacing:.24em;margin-right:4px}
.L4 .mxan{height:26px;padding:0 14px;background:#e4ff3a;color:#141218;font:800 9.5px var(--f);letter-spacing:.16em;border:0;cursor:pointer}.L4 .mxan.done{background:rgba(255,255,255,.08);color:#ecebf2}.L4 .mxan.busy{background:#7c5cf0;color:#fff;animation:mcvp .6s ease-in-out infinite alternate}
.L4 .mxsw{display:flex;background:rgba(255,255,255,.06)}.L4 .mxsw i{font:700 9px var(--f);font-style:normal;letter-spacing:.14em;padding:6px 10px;color:#8a8696;cursor:pointer}.L4 .mxsw i.on{background:#7c5cf0;color:#fff}
.L4 .mxsp{flex:1;font:500 10px var(--f);color:#e4ff3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.L4 .mxcl{display:flex;align-items:center;gap:6px;font:700 9.5px var(--f);letter-spacing:.1em;color:#ff6f7f}.L4 .mxcl i{width:8px;height:8px;background:#ff3b4e;box-shadow:0 0 6px #ff3b4e}.L4 .mxcl.ok{color:#9fe870}.L4 .mxcl i.ok{background:#9fe870;box-shadow:0 0 6px #9fe870}
.L4 .mxfix{height:26px;padding:0 12px;background:#7c5cf0;color:#fff;font:800 9.5px var(--f);letter-spacing:.14em;border:0;cursor:pointer}
.L4 .mxru{height:18px;display:flex}.L4 .mxlab{width:136px;flex:none;font:700 8.5px var(--f);letter-spacing:.2em;color:#5d596a;display:flex;align-items:center}
.L4 .mxtr{flex:1;position:relative}.L4 .mxtr i{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--sc) 70%,#1d1d1f);font:700 8.5px var(--f);font-style:normal;letter-spacing:.16em;color:#fff;padding-left:6px;display:flex;align-items:center;cursor:pointer;box-sizing:border-box;border-right:2px solid #1d1d1f}.L4 .mxtr i.on{box-shadow:inset 0 0 0 2px #fff}
.L4 .mxch{display:flex;flex-direction:column;gap:2px}
.L4 .mxr{height:42px;display:flex;background:#232326;cursor:pointer}.L4 .mxr:hover{background:#29292d}.L4 .mxr.sel{background:#2d2b35;box-shadow:inset 0 0 0 1px var(--cc)}
.L4 .mixv.hsel .mxr:not(.sel){opacity:.55}.L4 .mxr.mut .mxw{opacity:.3}
.L4 .mxn{width:136px;flex:none;position:relative;display:flex;align-items:center;gap:7px;padding:0 6px 8px 0;box-sizing:border-box}
.L4 .mxsw2{width:3px;align-self:stretch;background:var(--cc);margin-bottom:-8px}.L4 .mxn b{font:500 11.5px var(--f);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.L4 .mxbt{display:flex;gap:2px}.L4 .mxbt u{width:16px;height:16px;display:flex;align-items:center;justify-content:center;text-decoration:none;font:800 8.5px var(--f);color:#8a8696;background:rgba(255,255,255,.06);cursor:pointer}
.L4 .mxbt u:hover{color:#fff}.L4 .mxbt u.mxst.on{background:#e4ff3a;color:#141218}.L4 .mxbt u.mxm.on{background:#ff9a3c;color:#141218}.L4 .mxbt u.mxs.on{background:#4fc3ff;color:#141218}
.L4 .mxf{position:absolute;left:10px;right:6px;bottom:6px;height:4px;background:rgba(255,255,255,.08);cursor:ew-resize}.L4 .mxf:before{content:'';position:absolute;left:0;right:0;top:-5px;bottom:-5px}.L4 .mxf s{position:absolute;left:0;top:0;bottom:0;background:var(--cc);text-decoration:none}
.L4 .mxf:hover:after{content:attr(data-v);position:absolute;right:0;top:-15px;font:600 9px var(--f);font-style:normal;color:#fff}
.L4 .mxw{flex:1;position:relative;background:#18181a}.L4 .mxw canvas{position:absolute;inset:0;width:100%;height:100%}
.L4 .mxspec{flex:1;display:flex;min-height:0}.L4 .mxfl{width:136px;flex:none;position:relative}
.L4 .mxfl i{position:absolute;left:0;transform:translateY(-50%);font:700 8.5px var(--f);font-style:normal;letter-spacing:.16em;color:#6f6b7c;display:flex;gap:6px;align-items:baseline}.L4 .mxfl small{font:400 8.5px var(--f);letter-spacing:0;color:#4d4a58}
.L4 .mxsv{flex:1;position:relative;cursor:crosshair}.L4 .mxsv canvas{position:absolute;inset:0;width:100%;height:100%}
.L4 .mxspots{position:absolute;left:0;right:0;top:0;height:14px;pointer-events:none!important}.L4 .mxspots i{position:absolute;top:0;height:14px;font:700 8px var(--f);font-style:normal;letter-spacing:.06em;color:#141218;background:var(--cc);padding-left:4px;box-sizing:border-box;border-right:2px solid #121214;white-space:nowrap;overflow:hidden;display:flex;align-items:center}
.L4 .mxspots i.dk{top:auto;bottom:0;position:absolute;background:rgba(168,107,255,.25);color:#cdb6ff;height:13px}
.L4 .mxreg{position:absolute;top:0;bottom:0;display:none;box-shadow:inset 0 0 0 1.5px #fff;background:rgba(255,255,255,.05);pointer-events:none!important}.L4 .mxreg:after{content:attr(data-t);position:absolute;right:4px;top:17px;font:700 9px var(--f);color:#fff}
.L4 .mxhint{font:400 10px var(--f);color:#6f6b7c;padding-left:136px}
.L4 .mxi{flex:1;min-width:0;background:#232326;padding:12px 14px;display:flex;flex-direction:column;gap:9px;overflow:auto;box-sizing:border-box}
.L4 .mih{display:flex;align-items:center;gap:8px;min-height:26px}.L4 .mih b{font:800 11.5px var(--f);letter-spacing:.18em}.L4 .mih small{font:400 10px var(--f);color:#6f6b7c;flex:1}
.L4 .mcd{width:10px;height:10px;background:var(--cc)}
.L4 .mxex{height:28px;padding:0 14px;display:flex;align-items:center;gap:7px;background:#e4ff3a;color:#141218;border:0;font:800 10px var(--f);letter-spacing:.16em;cursor:pointer}
.L4 .mxbk{height:24px;padding:0 10px;background:rgba(255,255,255,.07);color:#ecebf2;border:0;font:700 9px var(--f);letter-spacing:.14em;cursor:pointer}
.L4 .mlu{background:#18181a;padding:10px 12px;display:flex;flex-direction:column;gap:7px}
.L4 .mlb{display:flex;align-items:flex-end;gap:10px}.L4 .mln{font:200 46px/0.9 var(--f);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.L4 .mlu2{font:800 11px var(--f);letter-spacing:.2em;display:flex;flex-direction:column;padding-bottom:3px}.L4 .mlu2 small{font:400 9.5px var(--f);letter-spacing:0;color:#6f6b7c}
.L4 .mls{margin-left:auto;display:flex;flex-direction:column;gap:2px;text-align:right}.L4 .mls i{font:600 8.5px var(--f);font-style:normal;letter-spacing:.14em;color:#6f6b7c}.L4 .mls b{font:500 11px var(--f);letter-spacing:0;color:#ecebf2;font-variant-numeric:tabular-nums}
.L4 .mlc{width:100%;height:92px;display:block}
.L4 .mlt,.L4 .mlt2,.L4 .msr,.L4 .mdk,.L4 .mrp{display:flex;flex-wrap:wrap;gap:4px}
.L4 .mlt i,.L4 .mlt2 i,.L4 .msr i,.L4 .mdk i,.L4 .mrp i{font:700 8.5px var(--f);font-style:normal;letter-spacing:.12em;padding:5px 8px;background:rgba(255,255,255,.06);color:#a9a5b6;cursor:pointer}
.L4 .mlt i small{font-weight:500;color:#6f6b7c;margin-left:3px}.L4 .mlt i.on,.L4 .mlt2 i.on,.L4 .msr i.on,.L4 .mdk i.on,.L4 .mrp i.on{background:#7c5cf0;color:#fff}.L4 .mlt i.on small{color:rgba(255,255,255,.75)}
.L4 .mlv{margin:0;font:400 11px/1.4 var(--f);color:#cfcdd8}
.L4 .msub{font:800 8.5px var(--f);letter-spacing:.2em;color:#8a8696;display:flex;gap:8px;align-items:baseline}.L4 .msub small{font:400 9.5px var(--f);letter-spacing:0;color:#5d596a}
.L4 .mtb{display:flex;flex-direction:column;gap:5px}.L4 .mtc{width:100%;height:64px;background:#18181a;display:block}
.L4 .mrow2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.L4 .mref,.L4 .mbal,.L4 .msty{display:flex;flex-direction:column;gap:5px}
.L4 .mrf{height:46px;border:1px dashed rgba(255,255,255,.18);display:flex;flex-direction:column;justify-content:center;padding:0 10px;position:relative}.L4 .mrf b{font:600 11px var(--f)}.L4 .mrf small{font:400 9.5px var(--f);color:#6f6b7c}
.L4 .mrf.on{border:1px solid #e4ff3a;background:rgba(228,255,58,.06)}.L4 .mrf i{position:absolute;right:8px;top:6px;font-style:normal;color:#8a8696;cursor:pointer}
.L4 .mxb{position:relative;height:24px;background:rgba(255,255,255,.05);cursor:ew-resize;display:flex;align-items:center;justify-content:space-between;padding:0 8px;user-select:none}
.L4 .mxb u{position:absolute;left:0;top:0;bottom:0;background:rgba(124,92,240,.55)}.L4 .mxb.bi:after{content:'';position:absolute;left:50%;top:4px;bottom:4px;width:1px;background:rgba(255,255,255,.3)}
.L4 .mxb b,.L4 .mxb em{position:relative;font:700 8.5px var(--f);letter-spacing:.14em;font-style:normal}.L4 .mxb em{font:500 10px var(--f);letter-spacing:0;color:#cfcdd8}
.L4 .msty .mxb u{background:rgba(228,255,58,.35)}
.L4 .msr.msy{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.L4 .msr.msy i{display:flex;flex-direction:column;align-items:center;gap:5px;padding:9px 2px 7px;background:linear-gradient(180deg,#232129,#19181d);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);color:#6f6b7c;transition:color .15s,background .15s}
.L4 .msr.msy i svg{display:block;opacity:.8}.L4 .msr.msy i svg .f{fill:currentColor;stroke:none}
.L4 .msr.msy i b{font:700 8px var(--f);letter-spacing:.14em;color:#8a8696}
.L4 .msr.msy i:hover{color:#b9b4c8}.L4 .msr.msy i:hover b{color:#ecebf2}
.L4 .msr.msy i.on{background:radial-gradient(120% 90% at 50% 0%,rgba(124,92,240,.55),rgba(124,92,240,.12) 70%),#1a1720;box-shadow:inset 0 0 0 1px rgba(159,123,255,.7),0 0 14px rgba(124,92,240,.25);color:#e4ff3a}
.L4 .msr.msy i.on svg{opacity:1;filter:drop-shadow(0 0 4px rgba(228,255,58,.45))}.L4 .msr.msy i.on b{color:#fff}
.L4 .msyd{font:400 10px var(--f);color:#8a8696;font-style:italic;margin:-1px 0 2px}
.L4 .mspot{height:34px;border:1px solid var(--cc);background:transparent;color:#ecebf2;font:800 10px var(--f);letter-spacing:.14em;cursor:pointer;text-align:left;padding:0 12px}.L4 .mspot.on{background:#e4ff3a;border-color:#e4ff3a;color:#141218}
.L4 .mcls{display:flex;flex-direction:column;gap:3px}.L4 .mcl{display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;background:#1b1b1e}.L4 .mcl.none{color:#9fe870;font:600 10.5px var(--f)}
.L4 .mcl>i{width:8px;height:8px}.L4 .mcl b{font:600 11px var(--f);width:72px}.L4 .mcl span{flex:1;font:400 10px var(--f);color:#8a8696;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.L4 .mcl em{display:flex;gap:2px;font-style:normal}.L4 .mcl u{text-decoration:none;font:700 8px var(--f);letter-spacing:.1em;padding:4px 6px;background:rgba(255,255,255,.06);color:#a9a5b6;cursor:pointer;white-space:nowrap}.L4 .mcl u:hover{background:#7c5cf0;color:#fff}
.L4 .mcc{display:grid;grid-template-columns:1fr 1fr;gap:4px}.L4 .mcc .mxb:first-child,.L4 .mcc .mxb:nth-child(2){grid-column:span 1}
.L4 .mfx{height:34px;border:1px dashed rgba(255,255,255,.15);display:flex;align-items:center;gap:10px;padding:0 12px;cursor:pointer}.L4 .mfx i{font:800 9.5px var(--f);font-style:normal;letter-spacing:.14em}.L4 .mfx small{font:400 10px var(--f);color:#6f6b7c}
.L4 .mman{display:flex;flex-direction:column;gap:3px}.L4 .mmod{display:flex;align-items:center;gap:10px;height:30px;padding:0 10px;background:#1b1b1e}.L4 .mmod b{font:800 9px var(--f);letter-spacing:.16em;width:78px}.L4 .mmod span{flex:1;font:400 10px var(--f);color:#a9a5b6}
.L4 .tg2{width:24px;height:12px;border-radius:6px;background:#3a3842;position:relative}.L4 .tg2.on{background:#7c5cf0}.L4 .tg2:after{content:'';position:absolute;top:2px;left:2px;width:8px;height:8px;border-radius:50%;background:#fff}.L4 .tg2.on:after{left:14px}
.L4 .mdeq{width:100%;height:96px;display:block}
.L4 .mxexp{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,10,12,.6);z-index:5}.L4 .mxexp.on{display:flex}
.L4 .mxe{width:560px;background:#26262a;padding:16px 18px;display:flex;flex-direction:column;gap:9px;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.L4 .mxeh{display:flex;align-items:baseline;gap:10px}.L4 .mxeh b{font:800 13px var(--f);letter-spacing:.2em}.L4 .mxeh small{font:500 10px var(--f);color:#6f6b7c;flex:1}.L4 .mxeh i{font-style:normal;font-size:16px;color:#8a8696;cursor:pointer}
.L4 .mxeg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.L4 .mxeg i{font-style:normal;padding:8px 10px;background:rgba(255,255,255,.05);cursor:pointer;display:flex;flex-direction:column;gap:2px}.L4 .mxeg b{font:800 9.5px var(--f);letter-spacing:.12em}.L4 .mxeg small{font:400 9.5px var(--f);color:#8a8696}
.L4 .mxeg i.on{background:#7c5cf0}.L4 .mxeg i.on small{color:rgba(255,255,255,.8)}
.L4 .mxef{display:flex;align-items:center;gap:10px;margin-top:4px}.L4 .mxef span{flex:1;font:400 11px var(--f);color:#a9a5b6}.L4 .mxef button{height:32px;padding:0 20px;background:#e4ff3a;color:#141218;border:0;font:800 10.5px var(--f);letter-spacing:.18em;cursor:pointer}
</style>`);
// ======== mock: peaks.js ========
// ---------- MIX page views: PEAKS (default, the mix as a dotted 3D mountain with a pin per sound) | SPECTROGRAM (heat look, MIX / L-R / WIDTH) ----------
MX.view=MX.view||'spec';   // SPECTROGRAM first and picked from the start (Eman, 4 Nov)
MX.spv=MX.spv||'mix';
// how wide each sound is spread across the speakers (0 = dead centre, 1 = everywhere)
const PKW=mxByKind({drums:.35,'808':.03,vox:.08,adlib:.6,music:.65,synth:.45,fx:.85});
// how spiky its peak is: hits are jagged, the 808 is one smooth dome
const PKS=mxByKind({drums:1,'808':.25,vox:.55,adlib:.7,music:.45,synth:.6,fx:.9});
// which half of the dish the pin stands on, so pins at the same pitch don't sit on top of each other
const PKH=mxByKind({drums:-1,'808':1,vox:1,adlib:-1,music:-1,synth:1,fx:1});
const pkGain=id=>Math.pow(10,MX.ch[id].lv/20);
function pkHash(x,y,s){let h=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return h-Math.floor(h)}
function pkNoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
 const a=pkHash(xi,yi,s),b=pkHash(xi+1,yi,s),c=pkHash(xi,yi+1,s),d=pkHash(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
// per sound, per frequency bin: its level over the picked part (includes spotlight ducking, mutes and faders)
function pkLevels(R){const a=MX.reg?MX.reg.a*4:0,b=MX.reg?MX.reg.b*4:NT,L={};
 MXC.forEach(c=>{const row=new Float32Array(NB),g=pkGain(c[0]);for(let t=a;t<b;t++)for(let k=0;k<NB;k++)row[k]+=R.E[c[0]][t][k];for(let k=0;k<NB;k++)row[k]=row[k]/Math.max(1,b-a)*g;L[c[0]]=row});return L}
const pkBin=(row,r)=>{const f=Math.max(0,Math.min(NB-1.001,r*NB-.5)),i=Math.floor(f),u=f-i;return row[i]*(1-u)+row[Math.min(NB-1,i+1)]*u};
const pkHex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];

// ---------- view switch ----------
function pkInit(){const v=document.querySelector('#s0 .mixv');if(!v||v.querySelector('.mxvt'))return;const spec=v.querySelector('.mxspec');
 spec.insertAdjacentHTML('beforebegin',`<div class="mxvt"><span class="mxlab">VIEW</span><span class="mxvtt"><i data-v="spec" title="Time left to right, low to high bottom to top">SPECTROGRAM</i><i data-v="peaks" title="The whole mix as one mountain: drag the pins">PEAKS</i></span><span class="mxspv"><i data-s="mix" title="Everything you hear">MIX</i><i data-s="lr" title="Left speaker on top, right underneath">L / R</i><i data-s="width" title="Only what differs between left and right: what makes it wide">WIDTH</i></span></div>`);
 spec.insertAdjacentHTML('afterend',`<div class="mxpk"><canvas></canvas><div class="pkleg"></div></div>`);
 v.querySelectorAll('.mxvtt i').forEach(i=>i.onclick=()=>{MX.view=i.dataset.v;drawMix()});
 v.querySelectorAll('.mxspv i').forEach(i=>i.onclick=()=>{MX.spv=i.dataset.s;drawMix()});
 pkBind(v.querySelector('.mxpk'))}
(function(){const _dm=drawMix;drawMix=function(){pkInit();const v=document.querySelector('#s0 .mixv');if(!v)return;
 v.classList.toggle('vpeaks',MX.view=='peaks');v.classList.toggle('vspec',MX.view=='spec');v.dataset.spv=MX.spv;_dm.apply(this,arguments);
 v.querySelectorAll('.mxvtt i').forEach(i=>i.classList.toggle('on',i.dataset.v==MX.view));v.querySelectorAll('.mxspv i').forEach(i=>i.classList.toggle('on',i.dataset.s==MX.spv));
 const h=v.querySelector('.mxhint');if(h)h.textContent=MX.view=='peaks'?'Every pin is a sound. Drag it up to bring it forward, down to sit it back, sideways to move it left or right. Middle = deep, edge = bright. Red = two sounds fighting for the same space.':
  MX.spv=='width'?'Only what is different in the left and right speaker. Bright = wide. A bright low end means the bass is wide, which disappears on a phone.':MX.spv=='lr'?'Left speaker on top, right underneath. Mostly the same is normal.':'Drag across the map to pick a part, then press ★ on the sound that should stand out there. White outlines = two sounds fighting for the same space.';
 if(MX.view=='spec')specDraw(v);else requestAnimationFrame(()=>pkDraw())}})();

// ---------- SPECTROGRAM in the heat look ----------
const HEAT=[[0,[0,0,4]],[.13,[27,12,65]],[.28,[74,12,107]],[.42,[120,28,109]],[.55,[165,44,96]],[.67,[207,68,70]],[.78,[237,105,37]],[.88,[251,155,6]],[1,[252,255,164]]];
function heatRGB(v){v=Math.max(0,Math.min(1,v));for(let i=1;i<HEAT.length;i++)if(v<=HEAT[i][0]){const [a,ca]=HEAT[i-1],[b,cb]=HEAT[i],u=(v-a)/(b-a);return [ca[0]+(cb[0]-ca[0])*u,ca[1]+(cb[1]-ca[1])*u,ca[2]+(cb[2]-ca[2])*u]}return HEAT[HEAT.length-1][1]}
function specDraw(v){const R=mxE(),cv=v.querySelector('.mxsv canvas'),W=cv.width,H=cv.height;if(!W)return;const g=cv.getContext('2d');
 const w=Math.round(W/2),hh=Math.round(H/2),off=document.createElement('canvas');off.width=w;off.height=hh;const o=off.getContext('2d'),img=o.createImageData(w,hh),D=img.data;
 const mode=MX.spv,lr=mode=='lr',gap=lr?3:0,ph=lr?Math.floor((hh-gap)/2):hh;
 const ch=MXC.map(c=>({id:c[0],E:R.E[c[0]],g:pkGain(c[0]),wd:Math.min(1,PKW[c[0]]+Math.abs(MX.ch[c[0]].pan)*.7),pan:MX.ch[c[0]].pan,dim:MX.sel&&MX.sel!=c[0]?.35:1}));
 const at=(E,t,b)=>{const ti=Math.min(NT-1,Math.floor(t)),f=Math.max(0,Math.min(NB-1.001,b)),bi=Math.floor(f),u=f-bi;return E[ti][bi]*(1-u)+E[ti][Math.min(NB-1,bi+1)]*u};
 const cell=(x,y,side)=>{const t=x/w*NT,b=(1-y/ph)*NB-.5,fr=t%1;let s=0;
  ch.forEach(c=>{let e=at(c.E,t,b);if(e<.01)return;e*=c.g*c.dim;
   if(c.id=='drums'){const hit=Math.exp(-fr*9)+.6*Math.exp(-((fr+.5)%1)*14);e*=.25+1.1*hit}
   else if(c.id=='vox'||c.id=='synth'||c.id=='adlib'){e*=.65+.5*Math.pow(Math.abs(Math.sin(b*3.1+(c.id=='synth'?1:0))),6)}
   e*=.55+.75*pkNoise(t*2.2,b*.7,c.id.length*3)*(1-b/NB*.3);const nz=pkHash(x,y,side*7+3);
   if(mode=='width')e*=c.wd*(.55+.9*nz);else if(lr){const pg=side<0?1-Math.max(0,c.pan)*.8:1+Math.min(0,c.pan)*.8;e*=pg*(1-c.wd*.35+c.wd*.7*nz)}else e*=.8+.4*nz;
   s+=e});
  return 1-Math.exp(-s*.62)};
 for(let y=0;y<hh;y++){const top=lr&&y>=ph+gap,yy=top?y-ph-gap:y,side=top?1:-1;if(lr&&y>=ph&&y<ph+gap){for(let x=0;x<w;x++){const k=(y*w+x)*4;D[k]=D[k+1]=D[k+2]=26;D[k+3]=255}continue}
  for(let x=0;x<w;x++){const vv=cell(x,yy,lr?side:0),c=heatRGB(vv*.96+pkHash(x,y,9)*.04),k=(y*w+x)*4;D[k]=c[0];D[k+1]=c[1];D[k+2]=c[2];D[k+3]=255}}
 o.putImageData(img,0,0);g.imageSmoothingEnabled=true;g.drawImage(off,0,0,W,H);
 g.fillStyle='rgba(0,0,0,.35)';MSEC.forEach(s=>g.fillRect(s[1]/32*W,0,1*DPR,H));
 if(lr){g.font=`700 ${10*DPR}px Inter,sans-serif`;g.fillStyle='rgba(255,255,255,.85)';g.fillText('L',6*DPR,13*DPR+14*DPR);g.fillText('R',6*DPR,H/2+13*DPR)}
 if(mode=='mix'){const cw=W/NT,bh=H/NB;g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=1*DPR;g.setLineDash([2*DPR,2*DPR]);g.beginPath();
  for(let t=0;t<NT;t++)for(let b=0;b<NB;b++){if(!R.clash[t][b])continue;const x=t*cw,y=H-(b+1)*bh;
   if(b+1>=NB||!R.clash[t][b+1]){g.moveTo(x,y);g.lineTo(x+cw,y)}if(b==0||!R.clash[t][b-1]){g.moveTo(x,y+bh);g.lineTo(x+cw,y+bh)}
   if(t==0||!R.clash[t-1][b]){g.moveTo(x,y);g.lineTo(x,y+bh)}if(t+1>=NT||!R.clash[t+1][b]){g.moveTo(x+cw,y);g.lineTo(x+cw,y+bh)}}g.stroke();g.setLineDash([])}
 if(MX.sel&&!lr){const c=MXC.find(x=>x[0]==MX.sel);g.strokeStyle=c[2];g.lineWidth=1.5*DPR;g.setLineDash([4*DPR,3*DPR]);c[5].forEach(([lo,hi])=>{const y0=H-(Math.log(hi)-FLO)/(FHI-FLO)*H,y1=H-(Math.log(lo)-FLO)/(FHI-FLO)*H;g.strokeRect(1,y0,W-2,y1-y0)});g.setLineDash([])}}

// ---------- PEAKS: the mix as a dotted mountain on a dish ----------
// middle of the dish = deep (sub), edge = bright (air); left/right of the dish = left/right speaker; height = how loud
const PK={pins:[],drag:null,t:0,raf:0};
function pkGeo(W,H){const Rx=Math.min(W*.4,H*.78),Ry=Rx*.42;return {cx:W/2,cy:H*.66,Rx,Ry,Hs:H*.62}}
function pkPinPos(c){const lo=c[5][0][0],hi=c[5][0][1],f=Math.sqrt(lo*hi),r=Math.max(.08,Math.min(.95,(Math.log(f)-FLO)/(FHI-FLO))),p=Math.max(-.95,Math.min(.95,MX.ch[c[0]].pan));return {r,x:r*p,z:PKH[c[0]]*r*Math.sqrt(1-p*p)}}
function pkField(L){// height and colour at a dish point
 const cols={};MXC.forEach(c=>cols[c[0]]=pkHex(c[2]));
 return (x,z,seed)=>{const r=Math.hypot(x,z),pan=r>1e-4?x/r:0;let tot=0,cr=0,cg=0,cb=0,big=0,second=0,who=null;
  MXC.forEach(c=>{const id=c[0];let e=pkBin(L[id],r);if(e<.004)return;const pc=MX.ch[id].pan,wd=PKW[id]+.24;e*=Math.exp(-Math.pow((pan-pc)/wd,2)*.9)*(.25+.75)+(1-Math.exp(-Math.pow((pan-pc)/wd,2)*.9))*e*PKW[id]*.5;
   const sp=PKS[id],n=pkNoise(x*9+seed,z*9,id.length),n2=pkNoise(x*23,z*23+seed,id.length+5);e*=(1-sp*.55)+sp*(Math.pow(n,3)*2.4+n2*.35);
   if(MX.sel&&MX.sel!=id)e*=.45;tot+=e;const k=cols[id];cr+=k[0]*e;cg+=k[1]*e;cb+=k[2]*e;if(e>big){second=big;big=e;who=id}else if(e>second)second=e});
  return {h:tot,c:tot?[cr/tot,cg/tot,cb/tot]:[200,200,210],clash:second>.22&&second>big*.7,who}}}
function pkDraw(){const v=document.querySelector('#s0 .mixv');if(!v||MX.view!='peaks')return;const box=v.querySelector('.mxpk'),cv=box.querySelector('canvas'),W=box.clientWidth*DPR,H=box.clientHeight*DPR;if(!W||!H)return;
 if(cv.width!=W||cv.height!=H){cv.width=W;cv.height=H}const g=cv.getContext('2d'),G=pkGeo(W,H),R=mxE(),L=pkLevels(R),F0=pkField(L);let mh=.05;for(let a=0;a<24;a++)for(let b=0;b<24;b++){const x=-1+2*a/23,z=-1+2*b/23;if(x*x+z*z<=1)mh=Math.max(mh,F0(x,z,0).h)}
 const F=(x,z,sd)=>{const o=F0(x,z,sd);o.h=o.h/mh*.62;return o},play=document.querySelector('#s0 .scr.playing'),tm=PK.t;
 g.fillStyle='#0c0c0e';g.fillRect(0,0,W,H);
 // faint scope grid behind, like a lab readout
 g.fillStyle='rgba(255,255,255,.035)';for(let i=1;i<8;i++)g.fillRect(i/8*W,0,1,H);for(let i=1;i<6;i++)g.fillRect(0,i/6*H,W,1);
 // the dish: rings for SUB LOW MID HIGH AIR and a tick ring
 const P=(x,z,h)=>[G.cx+x*G.Rx,G.cy+z*G.Ry-h*G.Hs];
 g.font=`800 ${10*DPR}px Inter,sans-serif`;g.fillStyle='rgba(255,255,255,.7)';g.textAlign='center';g.fillText('L',G.cx-G.Rx*1.08,G.cy+4*DPR);g.fillText('R',G.cx+G.Rx*1.08,G.cy+4*DPR);
 g.textAlign='left';
 // the dotted mountain, drawn from the back to the front
 const breathe=play?(.92+.08*Math.sin(tm*6.3)):1,N=150;g.globalCompositeOperation='lighter';
 for(let j=0;j<N;j++){const z=-1+2*j/(N-1),half=Math.sqrt(Math.max(0,1-z*z)),M=Math.max(4,Math.round(N*1.25*half));
  for(let i=0;i<M;i++){const jx=(pkHash(i,j,1)-.5)*1.6/N,jz=(pkHash(i,j,2)-.5)*1.6/N,x=-half+2*half*(i+.5)/M+jx,zz=z+jz;if(x*x+zz*zz>1)continue;
   const s=F(x,zz,play?Math.floor(tm*8)*.37:0);let h=s.h*breathe;const [px,py]=P(x,zz,Math.min(.95,h));
   const lum=Math.min(1,.2+h*1.4),a=(.25+.75*Math.min(1,h*2.2))*(.55+.45*pkHash(i,j,3));let c=s.c;c=s.clash?[255,70,85]:[c[0]*.55+235*.45,c[1]*.55+235*.45,c[2]*.55+240*.45];
   g.fillStyle=`rgba(${(c[0]*lum+40*(1-lum))|0},${(c[1]*lum+40*(1-lum))|0},${(c[2]*lum+44*(1-lum))|0},${a.toFixed(3)})`;const sz=(h>.3?1.6:1.2)*DPR;g.fillRect(px,py,sz,sz);
   // a few dots float under the surface so it reads as a solid cloud, not a sheet
   if(h>.12&&pkHash(i,j,4)<.35){const k=pkHash(i,j,5);g.fillStyle=`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${(a*.35).toFixed(3)})`;g.fillRect(px,py+k*(G.cy+zz*G.Ry-py),1*DPR,1*DPR)}}}
 g.globalCompositeOperation='source-over';
 // pins
 PK.pins=[];const hdr=11*DPR,PL=MXC.map(c=>{const p=pkPinPos(c),s=F(p.x,p.z,0),h=Math.min(.95,s.h*breathe),[fx,fy]=P(p.x,p.z,0),[,ty]=P(p.x,p.z,h);return {c,fx,fy,hy:Math.max(16*DPR,Math.min(ty-16*DPR,fy-30*DPR))}});
 // keep heads from sitting on top of each other: push the higher one further up
 for(let it=0;it<12;it++)PL.forEach(A=>PL.forEach(B=>{if(A===B)return;if(Math.abs(A.fx-B.fx)<70*DPR&&Math.abs(A.hy-B.hy)<25*DPR){const up=A.hy<=B.hy?A:B,dn=up===A?B:A;up.hy=Math.max(14*DPR,dn.hy-25*DPR);if(up.hy==14*DPR)dn.hy=up.hy+25*DPR}}));
 PL.forEach(({c,fx,fy,hy})=>{const dim=MX.sel&&MX.sel!=c[0],mute=MX.mute[c[0]];
  g.globalAlpha=dim?.4:1;g.strokeStyle=c[2];g.lineWidth=1.2*DPR;g.beginPath();g.moveTo(fx,fy);g.lineTo(fx,hy+hdr);g.stroke();g.fillStyle=c[2];g.beginPath();g.ellipse(fx,fy,3*DPR,1.3*DPR,0,0,Math.PI*2);g.fill();
  g.beginPath();g.arc(fx,hy,hdr,0,Math.PI*2);g.fillStyle=mute?'#2a2930':c[2];g.fill();if(MX.sel==c[0]){g.strokeStyle='#fff';g.lineWidth=2*DPR;g.stroke()}
  if(MX.spot.some(s=>s.ch==c[0])){g.fillStyle='#141218';g.font=`800 ${11*DPR}px Inter,sans-serif`;g.textAlign='center';g.fillText('★',fx,hy+4*DPR)}else{g.fillStyle=mute?c[2]:'#141218';g.font=`800 ${8.5*DPR}px Inter,sans-serif`;g.textAlign='center';g.fillText(c[1].replace('Lead ','').slice(0,3).toUpperCase(),fx,hy+3*DPR)}
  g.textAlign='left';g.font=`700 ${8.5*DPR}px Inter,sans-serif`;g.fillStyle='rgba(255,255,255,.8)';g.fillText(c[1],fx+hdr+4*DPR,hy-1*DPR);g.fillStyle='rgba(255,255,255,.4)';g.font=`500 ${7.5*DPR}px Inter,sans-serif`;
  const lv=MX.ch[c[0]].lv,pan=MX.ch[c[0]].pan;g.fillText(`${lv>0?'+':''}${lv} dB · ${Math.abs(pan)<.05?'centre':(pan<0?'L ':'R ')+Math.round(Math.abs(pan)*100)}`,fx+hdr+4*DPR,hy+9*DPR);g.globalAlpha=1;
  PK.pins.push({id:c[0],x:fx/DPR,y:hy/DPR})});
 // top-left readout
 const n=mxClashGroups().length;g.font=`700 ${8*DPR}px Inter,sans-serif`;g.fillStyle='rgba(255,255,255,.45)';g.fillText(MX.reg?`BARS ${MX.reg.a+1}–${MX.reg.b}`:'WHOLE SONG',10*DPR,16*DPR);g.fillStyle=n?'#ff5a6a':'#5cf0c8';g.fillText(n?`${n} CLASHES`:'NO CLASHES',10*DPR,28*DPR)}
function pkBind(box){box.addEventListener('pointerdown',ev=>{const r=box.getBoundingClientRect(),k=r.width/box.clientWidth,x=(ev.clientX-r.left)/k,y=(ev.clientY-r.top)/k;
  const pin=PK.pins.slice().reverse().find(p=>Math.hypot(p.x-x,p.y-y)<14);if(!pin){MX.sel=null;drawMix();return}ev.preventDefault();
  const S=MX.ch[pin.id],lv0=S.lv,pan0=S.pan,x0=ev.clientX,y0=ev.clientY,G=pkGeo(box.clientWidth,box.clientHeight);let moved=0;
  const mv=m=>{const dx=(m.clientX-x0)/k,dy=(m.clientY-y0)/k;if(!moved&&Math.hypot(dx,dy)<3)return;moved=1;box.classList.add('pkdrag');
   S.lv=Math.round(Math.max(-24,Math.min(6,lv0-dy/5)));S.pan=Math.max(-1,Math.min(1,Math.round((pan0+dx/(G.Rx*.5))*20)/20));mixFaders();pkDraw()};
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);box.classList.remove('pkdrag');MX.sel=pin.id;drawMix();
   if(moved)ktToast(`${mxName(pin.id)}: ${S.lv>0?'+':''}${S.lv} dB, ${Math.abs(S.pan)<.05?'centre':(S.pan<0?'left ':'right ')+Math.round(Math.abs(S.pan)*100)}`)};
  addEventListener('pointermove',mv);addEventListener('pointerup',up)});
 box.addEventListener('pointermove',ev=>{if(PK.drag)return;const r=box.getBoundingClientRect(),k=r.width/box.clientWidth,x=(ev.clientX-r.left)/k,y=(ev.clientY-r.top)/k;box.style.cursor=PK.pins.some(p=>Math.hypot(p.x-x,p.y-y)<14)?'grab':'default'})}
// breathe with the music while playing
(function loop(t){requestAnimationFrame(loop);const v=document.querySelector('#s0 .mixv'),scr=document.querySelector('#s0 .scr');if(!v||!scr||!scr.classList.contains('mixmode')||MX.view!='peaks'||!scr.classList.contains('playing'))return;if(t-PK.raf<70)return;PK.raf=t;PK.t=t/1000;pkDraw()})(0);
addEventListener('resize',()=>{if(MX.view=='peaks')pkDraw()});
document.head.insertAdjacentHTML('beforeend',`<style>
.L4 .mxvt{display:flex;align-items:center;gap:8px;height:22px;flex:none}
.L4 .mxvtt,.L4 .mxspv{display:flex;gap:1px}
.L4 .mxvtt i,.L4 .mxspv i{font:800 8.5px var(--f);font-style:normal;letter-spacing:.16em;color:#8a8696;background:rgba(255,255,255,.05);padding:5px 11px;cursor:pointer}
.L4 .mxvtt i.on{background:#ecebf2;color:#141218}.L4 .mxvtt i:hover:not(.on),.L4 .mxspv i:hover:not(.on){color:#fff}
.L4 .mxspv{margin-left:auto}.L4 .mxspv i{padding:4px 8px;font-size:8px}.L4 .mxspv i.on{background:linear-gradient(90deg,#4a0c6b,#cf4446 60%,#fb9b06);color:#fff}
.L4 .mixv.vpeaks .mxspv{display:none}
.L4 .mxpk{display:none;flex:1;position:relative;min-height:0;margin-left:136px;background:#0c0c0e;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.L4 .mxpk canvas{position:absolute;inset:0;width:100%;height:100%}
.L4 .mixv.vpeaks .mxpk{display:block}.L4 .mixv.vpeaks .mxspec{display:none}
.L4 .mixv.vpeaks .mxch{gap:1px}.L4 .mixv.vpeaks .mxr{height:30px!important;min-height:0}.L4 .mixv.vpeaks .mxr .mxw canvas{opacity:.85}
.L4 .mixv.vspec[data-spv="lr"] .mxfl i{display:none}
.L4 .mxpk.pkdrag{cursor:grabbing!important}
</style>`);
// ---------- SPECTROGRAM, big: the song as a dotted landscape coming toward you (Eman's TouchDesigner reference) ----------
// front row = where the playhead is, rows going back = the next 8 bars; left to right = low to high; height = loud.
// L / R: left speaker on the left half, right on the right half, bass meeting in the middle. The flat heat map sits small underneath.
const SP3={raf:0,last:0};
function sp3T(){return mxNowT()}
function sp3Sampler(R,mode){const ch=MXC.map(c=>({id:c[0],E:R.E[c[0]],g:pkGain(c[0]),wd:Math.min(1,PKW[c[0]]+Math.abs(MX.ch[c[0]].pan)*.7),pan:MX.ch[c[0]].pan}));
 const at=(E,t,b)=>{const tf=Math.max(0,Math.min(NT-1.001,t)),ti=Math.floor(tf),tu=tf-ti,f=Math.max(0,Math.min(NB-1.001,b)),bi=Math.floor(f),u=f-bi,r0=E[ti],r1=E[Math.min(NT-1,ti+1)];
  const a0=r0[bi]*(1-u)+r0[bi+1]*u,a1=r1[bi]*(1-u)+r1[bi+1]*u;return a0*(1-tu)+a1*tu};
 return (t,b,side,sx,sy)=>{let s=0,sel=0,big=0,sec=0;const fr=t%1;
  ch.forEach(c=>{let e=at(c.E,t,b);if(e<.01)return;e*=c.g;
   if(c.id=='drums'){const hit=Math.exp(-fr*9)+.6*Math.exp(-((fr+.5)%1)*14);e*=.2+1.3*hit}
   else if(c.id=='vox'||c.id=='synth'||c.id=='adlib')e*=.6+.55*Math.pow(Math.abs(Math.sin(b*3.1+(c.id=='synth'?1:0))),6);
   e*=.55+.75*pkNoise(t*2.2,b*.7,c.id.length*3);
   if(mode=='width')e*=c.wd*(.5+pkHash(sx,sy,5));else if(side){const pg=side<0?1-Math.max(0,c.pan)*.8:1+Math.min(0,c.pan)*.8;e*=pg*(1-c.wd*.3+c.wd*.6*pkHash(sx,sy,side+9))}
   s+=e;if(MX.sel==c.id)sel+=e;if(e>big){sec=big;big=e}else if(e>sec)sec=e});
  return {v:1-Math.exp(-s*.62),sel:s?sel/s:0,clash:sec>.4&&sec>big*.6}}}
function sp3Draw(){const v=document.querySelector('#s0 .mixv');if(!v||MX.view!='spec')return;const box=v.querySelector('.mxsp3'),cv=box.querySelector('canvas'),W=box.clientWidth*DPR,H=box.clientHeight*DPR;if(!W||!H)return;
 if(cv.width!=W||cv.height!=H){cv.width=W;cv.height=H}const g=cv.getContext('2d'),R=mxE(),mode=MX.spv,S=sp3Sampler(R,mode),t0=sp3T(),win=32,NR=120,lr=mode=='lr';
 g.fillStyle='#08080a';g.fillRect(0,0,W,H);const hor=H*.2,front=H*.88,sc=d=>1/(1+d*1.15),Y=d=>hor+(front-hor)*sc(d)*(1+.0)-(hor*0)*1,X=(xn,d)=>W/2+(xn-.5)*W*1.02*sc(d)*1.0;
 // floor lines + section names on the left
 g.fillStyle='rgba(255,255,255,.05)';for(let k=0;k<=8;k++){const d=k/8;g.fillRect(X(0,d),Y(d),X(1,d)-X(0,d),1*DPR)}
 g.font=`700 ${7.5*DPR}px Inter,sans-serif`;MSEC.forEach(s=>{const d=(s[1]*4-t0)/win;if(d<0||d>1)return;g.fillStyle='rgba(255,255,255,.45)';g.fillText(s[0],X(0,d)-4*DPR-g.measureText(s[0]).width,Y(d)+3*DPR)});
 const sc0=MX.sel?pkHex(MXC.find(c=>c[0]==MX.sel)[2]):null;g.globalCompositeOperation='lighter';
 for(let k=NR-1;k>=0;k--){const d=k/(NR-1),t=t0+d*win;if(t>=NT)continue;const s=sc(d),yb=Y(d),fade=.35+.65*(1-d),M=Math.round(300*Math.max(.5,s));
  for(let i=0;i<M;i++){const jx=(pkHash(i,k,1)-.5)/M;let xn=(i+.5)/M+jx,b,side=0;
   if(lr){side=xn<.5?-1:1;const q=Math.abs(xn-.5)*2;b=q*NB-.5}else b=xn*NB-.5;
   const o=S(t+(pkHash(i,k,2)-.5)*.3,b,side,i,k);let h=Math.pow(o.v,1.35);h*=(.45+1.5*Math.pow(pkNoise(b*1.6,t*2.6,7),2.4))*(.8+.4*pkHash(i,k,3));
   const px=X(xn,d),py=yb-h*H*.62*s,a=Math.min(1,.1+h*1.1)*fade;let c=[232,230,240];if(o.clash&&mode=='mix')c=[255,80,95];else if(sc0&&o.sel>.35)c=[sc0[0]*.8+50,sc0[1]*.8+50,sc0[2]*.8+50];
   g.fillStyle=`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a.toFixed(3)})`;const z=(.9+.7*s)*DPR;g.fillRect(px,py,z,z);
   if(h>.18&&pkHash(i,k,4)<.4){g.fillStyle=`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${(a*.28).toFixed(3)})`;g.fillRect(px,py+pkHash(i,k,6)*(yb-py),1*DPR,1*DPR)}}}
 g.globalCompositeOperation='source-over';
 // labels along the front edge
 g.font=`700 ${7.5*DPR}px Inter,sans-serif`;g.fillStyle='rgba(255,255,255,.4)';
 const fl=[['SUB',45],['LOW',150],['MID',1000],['HIGH',5000],['AIR',12000]];fl.forEach(([n,f])=>{const r=(Math.log(f)-FLO)/(FHI-FLO);(lr?[.5-r/2,.5+r/2]:[r]).forEach(xn=>{g.textAlign='center';g.fillText(n,X(xn,0),front+14*DPR)})});
 if(lr){g.font=`800 ${10*DPR}px Inter,sans-serif`;g.fillStyle='rgba(255,255,255,.75)';g.textAlign='center';g.fillText('L',W*.25,H*.2);g.fillText('R',W*.75,H*.2)}g.textAlign='left';
 g.font=`700 ${8*DPR}px Inter,sans-serif`;g.fillStyle='rgba(255,255,255,.45)';g.fillText(`BAR ${Math.floor(t0/4)+1} → ${Math.min(32,Math.floor(t0/4)+8)}`,10*DPR,16*DPR);
 g.fillStyle='rgba(255,255,255,.3)';g.fillText({mix:'EVERYTHING YOU HEAR',lr:'LEFT  |  RIGHT',width:'ONLY WHAT MAKES IT WIDE'}[mode],10*DPR,28*DPR);
 // window box on the small flat map
 const sv=v.querySelector('.mxsv');let wb=sv.querySelector('.sp3w');if(!wb){sv.insertAdjacentHTML('beforeend','<i class="sp3w"></i>');wb=sv.querySelector('.sp3w')}wb.style.left=(t0/NT*100)+'%';wb.style.width=(Math.min(win,NT-t0)/NT*100)+'%'}
(function(){const _sd=specDraw;specDraw=function(v){_sd(v);requestAnimationFrame(sp3Draw)}})();
(function loop(t){requestAnimationFrame(loop);const scr=document.querySelector('#s0 .scr');if(!scr||!scr.classList.contains('mixmode')||MX.view!='spec'||!scr.classList.contains('playing'))return;if(t-SP3.last<50)return;SP3.last=t;sp3Draw()})(0);
addEventListener('resize',()=>{if(MX.view=='spec')sp3Draw()});
// the flat map gets small, the landscape big
(function(){const _pi=pkInit;pkInit=function(){_pi();const v=document.querySelector('#s0 .mixv');if(!v||v.querySelector('.mxsp3'))return;v.querySelector('.mxspec').insertAdjacentHTML('beforebegin','<div class="mxsp3"><canvas></canvas></div>')}})();
document.head.insertAdjacentHTML('beforeend',`<style>
.L4 .mxsp3{display:none;flex:1;position:relative;min-height:0;margin-left:136px;background:#08080a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.L4 .mxsp3 canvas{position:absolute;inset:0;width:100%;height:100%}
.L4 .mixv.vspec .mxsp3{display:block}.L4 .mixv.vspec .mxspec{flex:0 0 66px}
.L4 .mixv.vspec .mxch{gap:1px}.L4 .mixv.vspec .mxr{height:30px!important;min-height:0}
.L4 .mixv.vspec .mxfl i small{display:none}.L4 .mixv.vspec .mxfl i{font-size:7px}
.L4 .mixv.vspec .mxspots i{height:11px;font-size:7px}
.L4 .sp3w{position:absolute;top:0;bottom:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.8);pointer-events:none!important}
</style>`);

// ======== mock: orbit.js ========
// ---------- MIX page views 3 and 4: ORBIT (every sound is a ring of particles around the mix core, spin it in 3D) and STEREO (a 3D stereo scope: tangled = wide, a flat line = mono) ----------
const OB={yaw:.6,pitch:.42,auto:1,drag:null,last:0,hover:null,tags:[]};
function obInit(){const v=document.querySelector('#s0 .mixv');if(!v||v.querySelector('.mxob'))return;const tt=v.querySelector('.mxvtt');if(!tt)return;
 if(window.KT2_ORBIT_STEREO)tt.querySelector('[data-v="peaks"]').insertAdjacentHTML('afterend',`<i data-v="orbit" title="Every sound as a ring around the mix: spin it, click a ring">ORBIT</i><i data-v="stereo" title="Left and right drawn in 3D: tangled = wide, a thin line = mono">STEREO</i>`);
 tt.querySelectorAll('i').forEach(i=>i.onclick=()=>{MX.view=i.dataset.v;drawMix()});
 v.querySelector('.mxpk').insertAdjacentHTML('afterend',`<div class="mxob"><canvas></canvas><div class="obtags"></div><div class="obread"></div></div>`);obBind(v.querySelector('.mxob'))}
// ORBIT and STEREO are parked (Eman, 4 Nov: "remove these fully"); window.KT2_ORBIT_STEREO = true shows them again
(function(){const _dm=drawMix;drawMix=function(){if(!window.KT2_ORBIT_STEREO&&(MX.view==='orbit'||MX.view==='stereo'))MX.view='spec';const v=document.querySelector('#s0 .mixv');if(v){pkInit();obInit()}
 _dm.apply(this,arguments);if(!v)return;const o=MX.view=='orbit',s=MX.view=='stereo';v.classList.toggle('vorbit',o);v.classList.toggle('vster',s);
 v.querySelectorAll('.mxvtt i').forEach(i=>i.classList.toggle('on',i.dataset.v==MX.view));
 const h=v.querySelector('.mxhint');if(h&&o)h.textContent='Every ring is a sound. Small ring = low, big ring = high. Tilted = panned left or right. Brighter = louder. Drag to spin it, click a ring to open that sound. Red sparks = two sounds fighting.';
 if(h&&s)h.textContent='Left and right speaker drawn in 3D. A thin straight line = mono (same in both). Tangled and round = wide. Click a sound on the left to see only that one.';
 if(o||s){const c=v.querySelector('.mxob canvas');c._clr=1;requestAnimationFrame(t=>obFrame(t,1))}}})();
const obCh=()=>MXC.map(c=>{const p=pkPinPos(c),lo=c[5][0][0],hi=c[5][c[5].length-1][1];return {c,id:c[0],name:c[1],col:c[2],r:p.r,lo,hi,pan:MX.ch[c[0]].pan,g:pkGain(c[0]),wd:PKW[c[0]],lv:MX.ch[c[0]].lv}});
const obRGB=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const obHz=f=>f>=1000?(f/1000).toFixed(f>=10000?0:1)+'k':Math.round(f)+'';
function obProj(p,W,H){// yaw around y, pitch around x, then perspective
 const cy=Math.cos(OB.yaw),sy=Math.sin(OB.yaw),cp=Math.cos(OB.pitch),sp=Math.sin(OB.pitch);let x=p[0]*cy-p[2]*sy,z=p[0]*sy+p[2]*cy,y=p[1];const y2=y*cp-z*sp,z2=y*sp+z*cp;
 const S=Math.min(W*.8,H*1.25)*.3,d=3.2,k=d/(d+z2);return [W/2+x*S*k,H*.52-y2*S*k,k,z2]}
function obPlayT(){const scr=document.querySelector('#s0 .scr');return scr&&scr.classList.contains('playing')?sp3T():(MX.reg?MX.reg.a*4+2:24)}
function obFrame(t,once){const v=document.querySelector('#s0 .mixv');if(!v||(MX.view!='orbit'&&MX.view!='stereo'))return;const box=v.querySelector('.mxob'),cv=box.querySelector('canvas'),W=box.clientWidth*DPR,H=box.clientHeight*DPR;if(!W||!H)return;
 if(cv.width!=W||cv.height!=H){cv.width=W;cv.height=H;cv._clr=1}const g=cv.getContext('2d'),dt=Math.min(.05,OB.last?(t-OB.last)/1000:.016);OB.last=t;if(OB.auto&&!OB.drag){if(MX.view=='orbit')OB.yaw+=dt*.12;else{OB.sw=(OB.sw||0)+dt;OB.yaw=.35*Math.sin(OB.sw*.25);OB.pitch=.25+.15*Math.sin(OB.sw*.17)}}
 const playing=document.querySelector('#s0 .scr.playing'),tm=t/1000,T=obPlayT();
 // trails: fade the last frame instead of clearing it
 g.globalCompositeOperation='source-over';g.fillStyle=cv._clr?'#0b0b0e':MX.view=='orbit'?'rgba(11,11,14,.28)':'rgba(11,11,14,.5)';g.fillRect(0,0,W,H);cv._clr=0;
 const tags=[];if(MX.view=='orbit')obOrbit(g,W,H,tm,T,tags,playing);else obStereo(g,W,H,tm,T,tags);obTags(box,tags)}
function obOrbit(g,W,H,tm,T,tags,playing){const CH=obCh();g.globalCompositeOperation='lighter';
 // the core: a soft white knot that beats with the whole mix
 let tot=0;CH.forEach(c=>tot+=mxAct(c.c,T)*c.g);const core=obProj([0,0,0],W,H),cr=(10+tot*5)*DPR;const rg=g.createRadialGradient(core[0],core[1],0,core[0],core[1],cr*3);rg.addColorStop(0,'rgba(255,255,255,.55)');rg.addColorStop(.3,'rgba(200,190,255,.18)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(core[0]-cr*3,core[1]-cr*3,cr*6,cr*6);
 for(let i=0;i<70;i++){const a=i*2.399+tm*.6,rr=.06+.05*Math.sin(i*1.7+tm*2),p=obProj([Math.cos(a)*rr,Math.sin(i*.9+tm)*rr*.8,Math.sin(a)*rr],W,H);g.fillStyle='rgba(255,255,255,.5)';g.fillRect(p[0],p[1],1.4*DPR,1.4*DPR)}
 tags.push({x:core[0],y:core[1],t:'MIX CORE',s:mxLufs().mast.toFixed(1)+' LUFS',col:'#ffffff',k:'core'});
 const sel=MX.sel;
 CH.forEach((c,ci)=>{const act=mxAct(c.c,T),R=.35+c.r*1.25,tilt=c.pan*.9,inc=.18+ci*.11,N=340,[cr0,cg0,cb0]=obRGB(c.col),dim=sel&&sel!=c.id?.25:1,mute=MX.mute&&MX.mute[c.id];
  const lum=Math.min(1.4,(.25+act*1.1)*c.g)*dim*(mute?.15:1),spread=.02+c.wd*.16,sp=.25+c.r*.5;let top=null;
  for(let i=0;i<N;i++){const h1=pkHash(i,ci,1),h2=pkHash(i,ci,2),h3=pkHash(i,ci,3),a=i/N*Math.PI*2+tm*sp*(1+h3*.4)+h1*.2;
   // a ring that wobbles with the beat; spikes for drums, smooth for the 808
   const kick=act*(playing?.5+.5*Math.sin(tm*Math.PI*2*130/60+ci):.4),wob=1+(h2-.5)*spread*2+kick*.06*PKS[c.id]*Math.sin(a*7+tm*3);
   let x=Math.cos(a)*R*wob,y=(h1-.5)*spread*1.4+Math.sin(a*3+tm)*.03,z=Math.sin(a)*R*wob;
   const y1=y*Math.cos(inc)-z*Math.sin(inc),z1=y*Math.sin(inc)+z*Math.cos(inc);y=y1;z=z1;const x1=x*Math.cos(tilt)-y*Math.sin(tilt),y2=x*Math.sin(tilt)+y*Math.cos(tilt);x=x1;y=y2;
   const p=obProj([x,y,z],W,H),s=(.8+h3*1.4)*p[2]*DPR*(.7+lum*.6),al=Math.min(1,(.18+lum*.55)*(.6+p[2]*.5));g.fillStyle=`rgba(${cr0},${cg0},${cb0},${al})`;g.fillRect(p[0]-s/2,p[1]-s/2,s,s);
   if(i==Math.round(N*ci/CH.length))top=p}
  tags.push({x:top[0],y:top[1],t:c.name.toUpperCase(),s:`${obHz(c.lo)}–${obHz(c.hi)} Hz · ${Math.abs(c.pan)<.05?'C':(c.pan<0?'L':'R')+Math.round(Math.abs(c.pan)*100)} · ${c.lv>0?'+':''}${c.lv.toFixed(1)} dB`,col:c.col,k:c.id,on:sel==c.id,dim:dim<1||mute});
  c._R=R});
 // clashes: two loud rings at almost the same size spark red where they cross
 for(let i=0;i<CH.length;i++)for(let j=i+1;j<CH.length;j++){const a=CH[i],b=CH[j];if(Math.abs(a._R-b._R)>.16)continue;const aa=mxAct(a.c,T)*a.g,bb=mxAct(b.c,T)*b.g;if(aa<.4||bb<.4)continue;
  for(let k=0;k<26;k++){const an=pkHash(k,i,j)*Math.PI*2+tm*.8,rr=(a._R+b._R)/2+(pkHash(k,j,i)-.5)*.08,p=obProj([Math.cos(an)*rr,(pkHash(k,i,7)-.5)*.15,Math.sin(an)*rr],W,H);g.fillStyle=`rgba(255,60,70,${.35+.5*pkHash(k,Math.floor(tm*12),3)})`;g.fillRect(p[0],p[1],2*DPR,2*DPR)}
  const p=obProj([0,(a._R+b._R)/2*.4,-(a._R+b._R)/2],W,H);tags.push({x:p[0],y:p[1],t:'CLASH',s:`${a.name} + ${b.name}`,col:'#ff4a5a',k:'cl'+i+j,warn:1})}
 g.globalCompositeOperation='source-over'}
// a short stretch of the mix, made from each sound's range, level, pan and width (a mock, the app uses the real audio)
function obSignal(T,only){const CH=obCh(),N=2600,L=new Float32Array(N),R=new Float32Array(N),C=new Float32Array(N*3);
 CH.forEach((c,ci)=>{if(only&&only!=c.id)return;if(MX.mute&&MX.mute[c.id])return;const a=mxAct(c.c,T)*c.g;if(a<.01)return;const f=2+Math.round(c.r*11)+ci*.53,ph=c.wd*Math.PI*.9,pl=Math.min(1,1-c.pan),pr=Math.min(1,1+c.pan),[r0,g0,b0]=obRGB(c.col);
  for(let i=0;i<N;i++){const u=i/N*Math.PI*2*5+T*.4,sp=PKS[c.id]>.8?Math.pow(Math.abs(Math.sin(u*f*.5)),6)*1.5:1,dl=a*sp*Math.cos(u*f),dr=a*sp*Math.cos(u*f+ph+Math.sin(u*.7+ci)*c.wd*.8);L[i]+=dl*pl;R[i]+=dr*pr;const w=Math.abs(dl)+Math.abs(dr);C[i*3]+=r0*w;C[i*3+1]+=g0*w;C[i*3+2]+=b0*w}});
 let sl=0,sr=0,slr=0,side=0,mid=0;for(let i=0;i<N;i++){sl+=L[i]*L[i];sr+=R[i]*R[i];slr+=L[i]*R[i];side+=Math.abs(L[i]-R[i]);mid+=Math.abs(L[i]+R[i])}
 return {L,R,C,N,corr:sl&&sr?slr/Math.sqrt(sl*sr):1,width:mid?side/(mid+side):0}}
function obStereo(g,W,H,tm,T,tags){const only=MX.sel,s=obSignal(T,only),bass=obSignal(T,'808'),pk=Math.max(.001,...s.L.map(Math.abs),...s.R.map(Math.abs)),sc=1.05/pk;
 g.globalCompositeOperation='lighter';g.lineWidth=1*DPR;
 // the tangle: x = side (left minus right), y = mid (both together), z = time going back
 const pts=[];for(let i=0;i<s.N;i++){const M=(s.L[i]+s.R[i])/2*sc,Sd=(s.R[i]-s.L[i])/2*sc*1.6,z=Math.sin(i/s.N*Math.PI*10+tm*.5)*.55+(i/s.N-.5)*.5;pts.push(obProj([Sd,M,z],W,H))}
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],w=s.C[i*3]+s.C[i*3+1]+s.C[i*3+2],tint=only&&w?[s.C[i*3]/w*3*255/255,s.C[i*3+1]/w*3,s.C[i*3+2]/w*3]:null;
  const al=.1+.4*b[2]-.12;g.strokeStyle=tint?`rgba(${Math.min(255,tint[0]*.6+90)|0},${Math.min(255,tint[1]*.6+90)|0},${Math.min(255,tint[2]*.6+90)|0},${al})`:`rgba(235,235,245,${al})`;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke()}
 // fixed guides: mono runs straight up the middle, left and right speakers at the sides
 g.globalCompositeOperation='source-over';g.strokeStyle='rgba(255,255,255,.1)';g.setLineDash([2*DPR,5*DPR]);g.beginPath();g.moveTo(W/2,H*.06);g.lineTo(W/2,H*.94);g.moveTo(W*.06,H*.52);g.lineTo(W*.94,H*.52);g.stroke();g.setLineDash([]);
 g.fillStyle='rgba(255,255,255,.4)';g.font=`700 ${9*DPR}px Inter`;g.fillText('MONO',W/2+5*DPR,H*.06+8*DPR);g.fillText('L',W*.04,H*.52+3*DPR);g.fillText('R',W*.95,H*.52+3*DPR);
 const cpt=obProj([0,0,0],W,H),wpt=pts.reduce((m,p)=>Math.abs(p[0]-W/2)>Math.abs(m[0]-W/2)?p:m,pts[0]),bpt=obProj([0,-.75,.6],W,H);
 const corr=s.corr,wd=Math.round(s.width*100),bw=Math.round(bass.width*100);
 tags.push({x:cpt[0],y:cpt[1],t:'PHASE CORE',s:`${corr>=0?'+':''}${corr.toFixed(2)} ${corr<0?'· cancels on a phone':corr>.9?'· almost mono':'· healthy'}`,col:corr<0?'#ff4a5a':'#ffffff',k:'pc',warn:corr<0});
 tags.push({x:wpt[0],y:wpt[1],t:'OUTER WAVE',s:`${wd}% wide`,col:'#ffffff',k:'ow'});
 if(!only)tags.push({x:bpt[0],y:bpt[1],t:'LOW END',s:bw<12?'mono · good':`${bw}% wide · fold it to mono`,col:bw<12?'#e4ff3a':'#ff4a5a',k:'le',warn:bw>=12});
 if(only){const c=MXC.find(x=>x[0]==only);tags.push({x:W*.06,y:H*.12,t:c[1].toUpperCase()+' ONLY',s:'click it again to see the whole mix',col:c[2],k:'only'})}
 const rd=document.querySelector('#s0 .mixv .obread');if(rd)rd.innerHTML=`<span>CORRELATION</span><em><u style="left:${(corr+1)/2*100}%"></u></em><b>${corr>=0?'+':''}${corr.toFixed(2)}</b><span>WIDTH</span><b>${wd}%</b>`}
function obTags(box,tags){const ord=[...tags].sort((a,b)=>a.y-b.y);for(let i=1;i<ord.length;i++)for(let j=0;j<i;j++){const a=ord[j],b=ord[i];if(Math.abs(a.x-b.x)<170*DPR&&b.y-a.y<17*DPR)b.y=a.y+17*DPR}const el=box.querySelector('.obtags'),have=new Set();tags.forEach(t=>{have.add(t.k);let d=el.querySelector(`[data-k="${t.k}"]`);if(!d){d=document.createElement('div');d.dataset.k=t.k;d.innerHTML='<i></i><s></s><b></b>';el.appendChild(d)}
  d.className='obt'+(t.on?' on':'')+(t.dim?' dim':'')+(t.warn?' warn':'');d.style.left=t.x/DPR+'px';d.style.top=t.y/DPR+'px';d.style.setProperty('--c',t.col);const h=`${t.t}<small>${t.s}</small>`,b=d.querySelector('b');if(b.innerHTML!=h)b.innerHTML=h});
 el.querySelectorAll('.obt').forEach(d=>{if(!have.has(d.dataset.k))d.remove()})}
function obBind(box){box.addEventListener('click',ev=>ev.stopPropagation());box.addEventListener('pointerdown',ev=>{const tg=ev.target.closest('.obt');if(tg&&MXC.some(c=>c[0]==tg.dataset.k)){MX.sel=MX.sel==tg.dataset.k?null:tg.dataset.k;drawMix();return}
  OB.drag={x:ev.clientX,y:ev.clientY,yaw:OB.yaw,pitch:OB.pitch,moved:0};box.setPointerCapture(ev.pointerId);box.classList.add('obdrag')});
 box.addEventListener('pointermove',ev=>{const d=OB.drag;if(!d)return;const dx=ev.clientX-d.x,dy=ev.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>3)d.moved=1;OB.yaw=d.yaw+dx*.008;OB.pitch=Math.max(-1.3,Math.min(1.3,d.pitch+dy*.006));OB.auto=0;obFrame(performance.now())});
 const up=()=>{OB.drag=null;box.classList.remove('obdrag')};box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);box.addEventListener('dblclick',()=>{OB.auto=1;OB.yaw=.6;OB.pitch=.42})}
(function loop(t){requestAnimationFrame(loop);const scr=document.querySelector('#s0 .scr');if(!scr||!scr.classList.contains('mixmode')||(MX.view!='orbit'&&MX.view!='stereo'))return;if(t-OB.raf<30)return;OB.raf=t;obFrame(t)})(0);
document.head.insertAdjacentHTML('beforeend',`<style>
.L4 .mxob{display:none;flex:1;position:relative;min-height:0;margin-left:136px;background:#0b0b0e;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);overflow:hidden;cursor:grab;touch-action:none}
.L4 .mxob.obdrag{cursor:grabbing}.L4 .mxob canvas{position:absolute;inset:0;width:100%;height:100%}
.L4 .mixv.vorbit .mxob,.L4 .mixv.vster .mxob{display:block}
.L4 .mixv.vorbit .mxspec,.L4 .mixv.vster .mxspec,.L4 .mixv.vorbit .mxspv,.L4 .mixv.vster .mxspv{display:none}
.L4 .mixv.vorbit .mxch,.L4 .mixv.vster .mxch{gap:1px}.L4 .mixv.vorbit .mxr,.L4 .mixv.vster .mxr{height:30px!important;min-height:0}
.obtags{position:absolute;inset:0;pointer-events:none}
.obt{position:absolute;display:flex;align-items:center;gap:5px;transform:translate(-4px,-50%);white-space:nowrap;pointer-events:auto;cursor:pointer}
.obt i{width:7px;height:7px;border-radius:50%;background:var(--c);box-shadow:0 0 6px var(--c)}
.obt s{width:16px;height:1px;background:rgba(255,255,255,.35)}
.obt b{font:700 8px var(--f,Inter);letter-spacing:.16em;padding:3px 6px;border:1px solid rgba(255,255,255,.3);background:rgba(8,8,10,.6);color:#fff;font-style:normal}
.obt b small{font:500 8px var(--f,Inter);letter-spacing:.04em;color:#8a8696;margin-left:6px}
.obt.on b{border-color:var(--c);color:var(--c)}.obt.dim{opacity:.35}.obt.warn b{border-color:#ff4a5a;color:#ff6b77}
.obt[data-k="core"],.obt[data-k="pc"],.obt[data-k="ow"],.obt[data-k="le"],.obt[data-k="only"],.obt[data-k^="cl"]{pointer-events:none}
.obread{position:absolute;left:10px;bottom:8px;display:none;align-items:center;gap:8px;font:700 8px var(--f,Inter);letter-spacing:.16em;color:#8a8696}
.L4 .mixv.vster .obread{display:flex}.obread b{color:#fff;font-weight:700;letter-spacing:.04em;margin-right:8px}
.obread em{width:120px;height:4px;background:linear-gradient(90deg,#ff4a5a,#3a3a44 45%,#3a3a44 55%,#e4ff3a);position:relative}.obread em u{position:absolute;top:-3px;width:2px;height:10px;background:#fff;transform:translateX(-1px)}
</style>`);

// ======== mock: mxp.js ========
// ---------- MIX & MASTER, reimagined in particles: the loudness river, the sound cloud, and STYLE tiles that each move like the sound they make ----------
const MXP={t0:performance.now(),raf:0};
// each style: its colour and how its particles behave
const MXPS=[
 {c:[205,210,255],c2:[150,160,255]},// EVEN: a calm grid that breathes
 {c:[255,170,60],c2:[255,60,70]},// HEAT: embers rising
 {c:[190,250,255],c2:[255,255,255]},// GLASS: a turning crystal that sparkles
 {c:[240,180,120],c2:[255,120,90]},// CASSETTE: two spinning reels and wobbly tape
 {c:[90,130,255],c2:[180,140,255]},// VAST: rings flying outward
 {c:[225,205,165],c2:[255,240,210]},// FILM: grain, flicker and scratches
 {c:[255,60,90],c2:[228,255,58]}];// SLAM: bars hitting the ceiling
(function(){const _mi=masterInsp;masterInsp=function(p){_mi(p);mxpDress(p)}})();
function mxpDress(p){
 // style tiles become little live canvases
 const sy=p.querySelector('.msy');if(sy){sy.querySelectorAll('i').forEach((i,k)=>{const sv=i.querySelector('svg');if(sv)sv.remove();if(!i.querySelector('canvas'))i.insertAdjacentHTML('afterbegin','<canvas></canvas>');const c=MXPS[k].c;i.style.setProperty('--sc',`rgb(${c.join(',')})`)})}
 mxpFrame(performance.now(),1)}
function mxpCv(c){if(!c)return null;const W=Math.round(c.clientWidth*DPR),H=Math.round(c.clientHeight*DPR);if(!W||!H)return null;if(c.width!=W||c.height!=H){c.width=W;c.height=H}return [c.getContext('2d'),W,H]}
// loudness over the song as a river of dots: each column a stack, the top dot glowing; the target as a dotted acid line
function mxpLoud(c,tm){const r=mxpCv(c);if(!r)return;const [g,W,H]=r,L=mxLufs(),tg=TGT[MX.tgt],y=v=>H-(v+24)/22*H;g.clearRect(0,0,W,H);
 const scr=document.querySelector('#s0 .scr'),pl=scr&&scr.classList.contains('playing')?sp3T()/NT:-1,N=L.pts.length,cw=W/N,dot=Math.max(1.5,cw*.32);
 for(let i=0;i<N;i++){const bar=i/N*32,sec=MSEC.find(s=>bar>=s[1]&&bar<s[2])||MSEC[0],col=sec[3],rr=parseInt(col.slice(1,3),16),gg=parseInt(col.slice(3,5),16),bb=parseInt(col.slice(5,7),16);
  const top=y(L.pts[i][1]),x=i*cw+cw/2,near=pl>=0?Math.max(0,1-Math.abs(i/N-pl)*N/3):0;
  for(let yy=H-dot;yy>top;yy-=dot*1.9){const f=(yy-top)/(H-top),al=(.08+.5*Math.pow(1-f,2.2))*(.8+.2*Math.sin(tm*3+i*.7+yy*.05))+near*.3;g.fillStyle=`rgba(${rr},${gg},${bb},${al})`;g.fillRect(x-dot/2,yy,dot,dot)}
  g.fillStyle=near>.3?'#ff4a4a':'#fff';g.shadowColor=g.fillStyle;g.shadowBlur=6*DPR;g.fillRect(x-dot*.7,top-dot*.7,dot*1.4,dot*1.4);g.shadowBlur=0;
  const my=y(L.pts[i][0]);g.fillStyle='rgba(255,255,255,.28)';g.fillRect(x-.6*DPR,my,1.2*DPR,1.2*DPR)}
 const ty=y(tg[1]);for(let x=0;x<W;x+=6*DPR){g.fillStyle=`rgba(228,255,58,${.5+.4*Math.sin(tm*4-x/(18*DPR))})`;g.fillRect(x,ty-DPR,2*DPR,2*DPR)}
 g.font=`700 ${8.5*DPR}px Inter`;g.fillStyle='#e4ff3a';g.fillText(`${tg[0]} ${tg[1]}`,6*DPR,ty-5*DPR);g.fillStyle='rgba(255,255,255,.35)';[-6,-12,-18].forEach(v=>g.fillText(v,W-20*DPR,y(v)+3*DPR))}
// the sound: a cloud of dots for the range songs like it sit in, the song as a bright drifting swarm; out-of-range spots glow red
function mxpTone(c,tm){const r=mxpCv(c);if(!r)return;const [g,W,H]=r;g.clearRect(0,0,W,H);const N=90,yy=v=>H/2-v*H*.36,fixAmt=MX.an?.25:1;
 const cur=i=>{const f=i/N;return (Math.exp(-Math.pow((f-.1)/.08,2))*.85+Math.exp(-Math.pow((f-.45)/.1,2))*-.35+Math.exp(-Math.pow((f-.8)/.08,2))*.6)*fixAmt+(MX.bal.BASS/6)*Math.exp(-Math.pow((f-.12)/.1,2))+(MX.bal.VOX/6)*Math.exp(-Math.pow((f-.5)/.12,2))*.8+(MX.sty==2?.25*f:MX.sty==1?.2*(1-f):0)};
 for(let i=0;i<=N;i++){const x=i/N*W,band=.5+Math.sin(i/N*3)*.08;for(let k=0;k<7;k++){const v=(k/6*2-1)*band;g.fillStyle=`rgba(255,255,255,${.05+.04*Math.sin(tm*1.5+i*.3+k)})`;g.fillRect(x,yy(v),1.4*DPR,1.4*DPR)}
  const cv=cur(i),out=Math.abs(cv)>band;for(let k=0;k<5;k++){const h=pkHash(i,k,5),jy=(h-.5)*.12+Math.sin(tm*2+i*.4+k*1.3)*.03,jx=(pkHash(k,i,6)-.5)*W/N;const s=(1.2+h*1.4)*DPR;
   g.fillStyle=out?`rgba(255,74,90,${.55+.4*h})`:`rgba(228,255,58,${.45+.5*h})`;g.fillRect(x+jx,yy(cv+jy),s,s)}}
 g.fillStyle='rgba(255,255,255,.4)';g.font=`600 ${8.5*DPR}px Inter`;[['LOW',.04],['MID',.47],['HIGH',.88]].forEach(([s,x])=>g.fillText(s,x*W,H-4*DPR));
 if(!MX.an){g.fillStyle='rgba(255,90,100,.95)';g.fillText('too much low end · scooped mids · sharp highs',8*DPR,12*DPR)}}
// the style tiles: on = full speed and full colour, off = slow and dim, hover wakes it up
function mxpStyle(i,k,tm){const r=mxpCv(i.querySelector('canvas'));if(!r)return;const [g,W,H]=r,on=i.classList.contains('on'),hv=i.matches(':hover'),sp=on||hv?1:.35,al=on?1:hv?.8:.42,S=MXPS[k],t=tm*sp+k*10;
 const col=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a*al})`,d=DPR*1.6,cx=W/2,cy=H/2;g.clearRect(0,0,W,H);
 if(k==0){const nx=16,ny=6;for(let a=0;a<nx;a++)for(let b=0;b<ny;b++){const x=(a+.5)/nx*W,y=(b+.5)/ny*H,w=.5+.5*Math.sin(t*2-a*.45);g.fillStyle=col(b==Math.floor(ny/2)?S.c2:S.c,.25+.6*w*(1-Math.abs(b-ny/2+.5)/ny));g.fillRect(x-d/2,y-d/2+Math.sin(t*2-a*.45)*1.5*DPR,d,d)}}
 else if(k==1){for(let n=0;n<46;n++){const h=pkHash(n,1,1),life=(t*(.35+h*.4)+h)%1,x=W*(.1+.8*pkHash(n,1,2))+Math.sin(life*9+n)*4*DPR,y=H*(1.05-life*1.1),c=life<.35?[255,235,150]:life<.7?S.c:S.c2;g.fillStyle=col(c,(1-life)*.95);const s=d*(1.3-life*.6);g.fillRect(x,y,s,s)}
  g.fillStyle=col(S.c2,.5);for(let x=0;x<W;x+=3*DPR)g.fillRect(x,H-2*DPR-Math.abs(Math.sin(x*.05+t*3))*3*DPR,d*.8,d*.8)}
 else if(k==2){const pts=[[0,-1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,1.1,0]],ed=[[0,1],[0,2],[0,3],[0,4],[5,1],[5,2],[5,3],[5,4],[1,2],[2,3],[3,4],[4,1]],a=t*.8,R=H*.36;
  const P=pts.map(([x,y,z])=>{const X=x*Math.cos(a)-z*Math.sin(a),Z=x*Math.sin(a)+z*Math.cos(a);return [cx+X*R,cy+y*R*.95+Z*R*.15,Z]});
  ed.forEach(([u,v])=>{for(let s=0;s<=10;s++){const f=s/10,x=P[u][0]+(P[v][0]-P[u][0])*f,y=P[u][1]+(P[v][1]-P[u][1])*f,z=P[u][2]+(P[v][2]-P[u][2])*f;g.fillStyle=col(S.c,.35+.4*(z+1)/2);g.fillRect(x-d/3,y-d/3,d*.7,d*.7)}});
  for(let n=0;n<5;n++){const h=pkHash(n,Math.floor(t*2),3),x=W*(.15+.7*pkHash(n,2,Math.floor(t*2))),y=H*(.15+.7*h),tw=Math.max(0,Math.sin(t*6+n*2));g.fillStyle=col(S.c2,tw);g.fillRect(x-d/2,y-d*2,d,d*4);g.fillRect(x-d*2,y-d/2,d*4,d)}}
 else if(k==3){const R=H*.28,wob=1+.08*Math.sin(t*1.3);[[cx-W*.2,1],[cx+W*.2,-1]].forEach(([x0,dir])=>{for(let n=0;n<20;n++){const a=n/20*Math.PI*2+t*2.4*wob*dir;g.fillStyle=col(S.c,.7);g.fillRect(x0+Math.cos(a)*R-d/2,cy+Math.sin(a)*R-d/2,d,d)}
   for(let n=0;n<3;n++){const a=n/3*Math.PI*2+t*2.4*wob*dir;for(let s=1;s<5;s++){g.fillStyle=col(S.c2,.6);g.fillRect(x0+Math.cos(a)*R*s/5-d/3,cy+Math.sin(a)*R*s/5-d/3,d*.7,d*.7)}}});
  for(let x=cx-W*.2;x<cx+W*.2;x+=3*DPR){g.fillStyle=col(S.c,.45);g.fillRect(x,cy+R+2*DPR+Math.sin(x*.08+t*4)*1.5*DPR,d*.7,d*.7)}}
 else if(k==4){for(let ring=0;ring<4;ring++){const f=(t*.35+ring/4)%1,R=f*Math.max(W,H)*.6,n=Math.round(10+f*40);for(let m=0;m<n;m++){const a=m/n*Math.PI*2+ring;g.fillStyle=col(ring%2?S.c:S.c2,(1-f)*.9);g.fillRect(cx+Math.cos(a)*R-d/2,cy+Math.sin(a)*R*.55-d/2,d,d)}}
  g.fillStyle=col([255,255,255],.9);g.fillRect(cx-d,cy-d,d*2,d*2)}
 else if(k==5){const fr=Math.floor(t*14);for(let n=0;n<70;n++){const h=pkHash(n,fr,5);g.fillStyle=col(h>.9?S.c2:S.c,.15+.6*pkHash(fr,n,6));g.fillRect(pkHash(n,fr,7)*W,pkHash(fr,n,8)*H,d*.8,d*.8)}
  for(let x=4*DPR;x<W;x+=9*DPR){g.fillStyle=col(S.c,.5);g.fillRect(x,2*DPR,4*DPR,3*DPR);g.fillRect(x,H-5*DPR,4*DPR,3*DPR)}
  if(pkHash(fr,9,9)>.6){const x=pkHash(fr,3,3)*W;g.fillStyle=col(S.c2,.5);for(let y=0;y<H;y+=2*DPR)g.fillRect(x+Math.sin(y)*DPR,y,DPR,DPR)}}
 else if(k==6){const n=14,cl=H*.18;g.fillStyle=col(S.c2,.9);for(let x=0;x<W;x+=3*DPR)g.fillRect(x,cl-DPR,d*.8,d*.8);
  for(let b=0;b<n;b++){const x=(b+.5)/n*W,want=(.35+.75*Math.abs(Math.sin(t*3.2+b*.9)))*H,top=Math.max(cl+d,H-want),hit=H-want<cl;for(let y=H-d;y>top;y-=d*1.6){g.fillStyle=col(hit&&y<top+d*3?S.c2:S.c,.35+.6*(1-(y-top)/(H-top)));g.fillRect(x-d/2,y,d,d)}
   if(hit){g.fillStyle=col(S.c2,.9);g.fillRect(x-d,cl+DPR,d*2,d*.8)}}}}
function mxpFrame(t,force){const p=document.querySelector('#s0 .mixv .mxi');if(!p||!p.offsetParent)return;const tm=(t-MXP.t0)/1000;
 mxpLoud(p.querySelector('.mlc'),tm);mxpTone(p.querySelector('.mtc'),tm);p.querySelectorAll('.msy i').forEach((i,k)=>mxpStyle(i,k,tm))}
(function loop(t){requestAnimationFrame(loop);const scr=document.querySelector('#s0 .scr');if(!scr||!scr.classList.contains('mixmode')||MX.sel)return;if(t-MXP.raf<33)return;MXP.raf=t;mxpFrame(t)})(0);
document.head.insertAdjacentHTML('beforeend',`<style>
.mlu{background:#0e0e11!important}.mlc{height:104px!important}.mtc{height:74px!important;background:#0e0e11!important}
.msr.msy{grid-template-columns:repeat(7,1fr)!important;gap:5px!important}
.msr.msy i{position:relative;padding:0!important;height:78px;justify-content:flex-end!important;background:#0e0e11!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)!important;overflow:hidden;transition:box-shadow .2s,transform .15s!important}
.msr.msy i canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.msr.msy i b{position:relative;z-index:1;padding:0 0 7px;font-size:8px!important;color:#8a8696!important;text-shadow:0 1px 6px #000}
.msr.msy i:hover{transform:translateY(-1px)}.msr.msy i:hover b{color:#fff!important}
.msr.msy i.on{background:radial-gradient(90% 80% at 50% 40%,color-mix(in srgb,var(--sc) 22%,transparent),#0e0e11 75%)!important;box-shadow:inset 0 0 0 1px var(--sc),0 0 18px color-mix(in srgb,var(--sc) 40%,transparent)!important}
.msr.msy i.on b{color:#fff!important}
.msyd{font-style:normal!important;color:#bdb9c9!important;font-size:10.5px!important}
.msty .mxb u,.mbal .mxb u{background:radial-gradient(circle,currentColor 1.2px,transparent 1.7px) 0 50%/5px 5px!important;opacity:.95}
.msty .mxb u{color:#e4ff3a}.msty .mxb b,.mbal .mxb b{text-shadow:0 0 4px #000,0 0 8px #000;position:relative}.mbal .mxb u{color:#9f7bff}
</style>`);



// ---------------------------------------------------------------- SPACE (Eman, 4 Nov: the PEAKS pins, redone)
// The mix seen from above, like a stage in front of you. Every sound is a square: sideways is left
// and right, closer to YOU is louder, further back is quieter. A red line joins two sounds that
// fight for the same notes; it fades as you pull them apart. The old dotted mountain stays behind
// window.KT2_OLD_PEAKS = true.
if (!window.KT2_OLD_PEAKS) {
  const ST = { tiles: [], key: "", fights: [], hover: null, drag: null };
  const BANDS = [[20, 60], [60, 250], [250, 2000], [2000, 8000], [8000, 20000]];
  const LV_HI = 6, LV_LO = -24;
  const stGeo = (W, H) => {
    const top = 46 * DPR, bot = H - 44 * DPR, side = 54 * DPR, wF = W - 2 * side;
    return { cx: W / 2, yF: bot, yB: top, wF, wB: wF * 0.6 };
  };
  const stY = (G, d) => G.yF + (G.yB - G.yF) * d;
  const stHW = (G, d) => (G.wF + (G.wB - G.wF) * d) / 2;
  const stD = (lv) => Math.max(0, Math.min(1, (LV_HI - lv) / (LV_HI - LV_LO)));
  const stFont = (w, px, mono) => `${w} ${px * DPR}px ${mono ? '"Martian Mono", ui-monospace, Menlo, monospace' : 'Inter, "Helvetica Neue", sans-serif'}`;
  const panTxt = (p) => (Math.abs(p) < 0.05 ? "C" : (p < 0 ? "L" : "R") + Math.round(Math.abs(p) * 100));
  const lvTxt = (l) => (l > 0 ? "+" : "") + l + " dB";
  // two sounds that share notes fight less the further apart they stand
  function stFights() {
    const key = JSON.stringify([MXC.map((c) => c[0]), MX.mute, MX.spot, MX.duck808]);
    if (key !== ST.key) { ST.key = key; ST.groups = mxClashGroups(); }
    return ST.groups.filter((g) => MX.ch[g.a] && MX.ch[g.b]).map((g) => {
      const A = MX.ch[g.a], B = MX.ch[g.b];
      const sep = Math.min(1, Math.abs(A.pan - B.pan) / 0.55 + Math.abs(A.lv - B.lv) / 10);
      return { ...g, heat: 1 - sep };
    }).filter((f) => f.heat > 0.02);
  }
  function stLayout(G) {
    const T = MXC.map((c, i) => {
      const ch = MX.ch[c[0]], d = stD(ch.lv), s = (30 - 8 * d) * DPR;
      const tx = G.cx + Math.max(-1, Math.min(1, ch.pan)) * stHW(G, d), ty = stY(G, d);
      return { id: c[0], c, d, s, tx, ty, x: tx + (i - (MXC.length - 1) / 2) * 0.01, y: ty };
    });
    // keep squares from covering each other: push neighbours sideways (the leader line shows the real spot)
    const gapX = 12 * DPR, gapY = 22 * DPR;
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
        const a = T[i], b = T[j], need = Math.max((a.s + b.s) / 2 + gapX, 62 * DPR), dx = b.x - a.x;
        if (Math.abs(dx) >= need || Math.abs(b.y - a.y) >= (a.s + b.s) / 2 + gapY) continue;
        const push = (need - Math.abs(dx)) / 2 + 0.1, dir = dx >= 0 ? 1 : -1;
        if (ST.drag && ST.drag.id === a.id) b.x += 2 * push * dir;
        else if (ST.drag && ST.drag.id === b.id) a.x -= 2 * push * dir;
        else { a.x -= push * dir; b.x += push * dir; }
        moved = true;
      }
      if (!moved) break;
    }
    const W2 = G.cx * 2;
    T.forEach((t) => { t.x = Math.max(t.s / 2 + 4 * DPR, Math.min(W2 - t.s / 2 - 4 * DPR, t.x)); });
    return T;
  }
  pkDraw = function () {
    const v = document.querySelector("#s0 .mixv");
    if (!v || MX.view !== "peaks") return;
    const box = v.querySelector(".mxpk"), cv = box.querySelector("canvas"), W = box.clientWidth * DPR, H = box.clientHeight * DPR;
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext("2d"), G = stGeo(W, H), playing = !!document.querySelector("#s0 .scr.playing"), tNow = mxNowT();
    g.fillStyle = "#0f0f12"; g.fillRect(0, 0, W, H);
    // the floor: darker at the back
    const P = (pan, d) => [G.cx + pan * stHW(G, d), stY(G, d)];
    const fl = g.createLinearGradient(0, G.yB, 0, G.yF);
    fl.addColorStop(0, "rgba(255,255,255,0.015)"); fl.addColorStop(1, "rgba(255,255,255,0.05)");
    g.fillStyle = fl; g.beginPath();
    [[-1, 0], [1, 0], [1, 1], [-1, 1]].forEach(([p, d], i) => { const [x, y] = P(p, d); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.fill();
    // level lines (right edge says how loud), pan lines converging to the back
    g.lineWidth = 1;
    for (let lv = LV_HI; lv >= LV_LO; lv -= 6) {
      const d = stD(lv), [x0, y] = P(-1, d), [x1] = P(1, d);
      g.strokeStyle = lv === 0 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
      g.beginPath(); g.moveTo(x0, y + 0.5); g.lineTo(x1, y + 0.5); g.stroke();
      g.font = stFont(600, 8, true); g.fillStyle = lv === 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)"; g.textAlign = "left";
      g.fillText(lv > 0 ? "+" + lv : String(lv), x1 + 8 * DPR, y + 3 * DPR);
    }
    [-1, -0.5, 0, 0.5, 1].forEach((p) => {
      const [x0, y0] = P(p, 0), [x1, y1] = P(p, 1);
      g.strokeStyle = p === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)";
      if (p === 0) g.setLineDash([3 * DPR, 4 * DPR]);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
    });
    // edge labels
    g.font = stFont(800, 12, false); g.fillStyle = "rgba(255,255,255,0.75)"; g.textAlign = "center";
    const [lx, ly] = P(-1, 0), [rx] = P(1, 0);
    g.fillText("L", lx - 16 * DPR, ly + 4 * DPR); g.fillText("R", rx + 16 * DPR, ly + 4 * DPR);
    g.font = stFont(600, 8, true); g.fillStyle = "rgba(255,255,255,0.3)";
    g.fillText("BACK \u00b7 QUIETER", G.cx, G.yB - 10 * DPR);
    // you, the listener
    g.fillStyle = "#e4ff3a"; g.beginPath();
    g.moveTo(G.cx, G.yF + 14 * DPR); g.lineTo(G.cx - 6 * DPR, G.yF + 24 * DPR); g.lineTo(G.cx + 6 * DPR, G.yF + 24 * DPR); g.closePath(); g.fill();
    g.font = stFont(700, 8, true); g.fillStyle = "rgba(228,255,58,0.8)"; g.fillText("YOU", G.cx, G.yF + 36 * DPR);

    const T = stLayout(G), byId = {}; T.forEach((t) => { byId[t.id] = t; });
    const fights = stFights(); ST.fights = fights;
    const hot = {}; fights.forEach((f) => { hot[f.a] = Math.max(hot[f.a] || 0, f.heat); hot[f.b] = Math.max(hot[f.b] || 0, f.heat); });
    const focus = MX.sel || ST.hover;
    // fight lines under the squares: brighter and thicker the closer the two stand
    const tags = [];
    fights.forEach((f) => {
      const A = byId[f.a], B = byId[f.b];
      if (!A || !B) return;
      const on = !focus || focus === f.a || focus === f.b;
      const al = (0.25 + 0.7 * f.heat) * (on ? 1 : 0.25);
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const bow = Math.min(40 * DPR, 10 * DPR + len * 0.18), cx = mx + (-dy / len) * bow * (dx >= 0 ? -1 : 1), cy = my - Math.abs(dx / len) * bow;
      g.strokeStyle = `rgba(255,59,78,${al.toFixed(3)})`; g.lineWidth = (1 + 2.2 * f.heat) * DPR;
      if (f.heat < 0.5) g.setLineDash([4 * DPR, 4 * DPR]);
      g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(cx, cy, B.x, B.y); g.stroke(); g.setLineDash([]);
      if (on && focus) tags.push({ x: 0.25 * A.x + 0.5 * cx + 0.25 * B.x, y: 0.25 * A.y + 0.5 * cy + 0.25 * B.y, t: fHz(f.lo) + "\u2013" + fHz(f.hi), heat: f.heat });
    });
    // the squares, back ones first
    T.slice().sort((a, b) => b.d - a.d).forEach((t) => {
      const id = t.id, c = t.c, ch = MX.ch[id], mute = MX.mute[id], s = t.s, x0 = t.x - s / 2, y0 = t.y - s / 2;
      const dim = focus && focus !== id && !fights.some((f) => (f.a === focus && f.b === id) || (f.b === focus && f.a === id));
      g.globalAlpha = dim ? 0.35 : 1;
      // how wide it spreads across the speakers, drawn at its real spot
      const wd = Math.min(0.6, (PKW[id] || 0.3) * 0.45), hw = stHW(G, t.d);
      g.strokeStyle = c[2]; g.globalAlpha *= 0.3; g.lineWidth = 2 * DPR;
      g.beginPath(); g.moveTo(t.tx - wd * hw, t.ty + s / 2 + 5 * DPR); g.lineTo(t.tx + wd * hw, t.ty + s / 2 + 5 * DPR); g.stroke();
      g.globalAlpha = dim ? 0.35 : 1;
      // pushed aside by a neighbour: a thin leader back to its real spot
      if (Math.hypot(t.x - t.tx, t.y - t.ty) > 6 * DPR) {
        g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 1 * DPR;
        g.beginPath(); g.moveTo(t.x, t.y + s / 2); g.lineTo(t.tx, t.ty); g.stroke();
        g.fillStyle = c[2]; g.fillRect(t.tx - 2 * DPR, t.ty - 2 * DPR, 4 * DPR, 4 * DPR);
      }
      g.fillStyle = mute ? "#26252b" : c[2]; g.fillRect(x0, y0, s, s);
      if (mute) { g.strokeStyle = c[2]; g.lineWidth = 1.5 * DPR; g.strokeRect(x0 + 0.75 * DPR, y0 + 0.75 * DPR, s - 1.5 * DPR, s - 1.5 * DPR); }
      // playing: a level bar inside the square
      if (playing && !mute) {
        const a = Math.min(1, mxAct(c, tNow));
        g.fillStyle = "rgba(20,18,24,0.35)"; g.fillRect(x0, y0, s, s * (1 - a));
      }
      if ((hot[id] || 0) > 0.5) { g.strokeStyle = "#ff3b4e"; g.lineWidth = 2 * DPR; g.strokeRect(x0 - 2 * DPR, y0 - 2 * DPR, s + 4 * DPR, s + 4 * DPR); }
      if (MX.sel === id) { g.strokeStyle = "#fff"; g.lineWidth = 2 * DPR; g.strokeRect(x0 - 3 * DPR, y0 - 3 * DPR, s + 6 * DPR, s + 6 * DPR); }
      g.fillStyle = mute ? c[2] : "#141218"; g.font = `800 ${Math.round(s / DPR * 0.3)}px Unbounded, Inter, sans-serif`; g.textAlign = "center";
      g.fillText(MX.spot.some((x) => x.ch === id) ? "\u2605" : c[1].replace(/^Lead /, "").slice(0, 3).toUpperCase(), t.x, t.y + s * 0.11);
      // where it sits in pitch: SUB LOW MID HIGH AIR, bottom to top
      const r = c[5];
      BANDS.forEach(([lo, hi], k) => {
        const lit = r.some(([a, b]) => a < hi && b > lo);
        g.fillStyle = lit ? c[2] : "rgba(255,255,255,0.1)";
        g.fillRect(x0 + s + 3 * DPR, y0 + s - (k + 1) * (s / 5) + 1 * DPR, 3 * DPR, s / 5 - 2 * DPR);
      });
      // name, and the numbers when it is the one you look at
      g.font = stFont(700, 9, false); g.fillStyle = "rgba(255,255,255,0.85)";
      let nm = c[1]; const room = 56 * DPR;
      while (nm.length > 3 && g.measureText(nm).width > room) nm = nm.slice(0, -1);
      if (nm !== c[1]) nm = nm.slice(0, -1) + "\u2026";
      g.fillText(nm, t.x, y0 + s + 18 * DPR);
      if (focus === id || ST.drag && ST.drag.id === id) {
        g.font = stFont(600, 8, true); g.fillStyle = "rgba(255,255,255,0.55)";
        g.fillText(lvTxt(ch.lv) + " \u00b7 " + panTxt(ch.pan), t.x, y0 + s + 29 * DPR);
      }
      g.globalAlpha = 1;
    });
    // what the two are fighting over
    g.font = stFont(700, 8, true); g.textAlign = "center";
    tags.forEach((tg) => {
      const w = g.measureText(tg.t).width + 10 * DPR, h = 14 * DPR;
      g.fillStyle = "#ff3b4e"; g.fillRect(tg.x - w / 2, tg.y - h / 2, w, h);
      g.fillStyle = "#141218"; g.fillText(tg.t, tg.x, tg.y + 3 * DPR);
    });
    // top-left readout
    const n = fights.filter((f) => f.heat > 0.5).length, soft = fights.length - n;
    g.textAlign = "left"; g.font = stFont(700, 8, true); g.fillStyle = "rgba(255,255,255,0.4)";
    g.fillText(MX.reg ? `BARS ${MX.reg.a + 1}\u2013${MX.reg.b}` : "WHOLE SONG", 12 * DPR, 18 * DPR);
    g.font = stFont(800, 9, false);
    g.fillStyle = n ? "#ff3b4e" : soft ? "rgba(255,255,255,0.6)" : "#e4ff3a";
    g.fillText(n ? `${n} FIGHT${n > 1 ? "S" : ""}` + (soft ? ` \u00b7 ${soft} EASED` : "") : soft ? `${soft} EASED` : "NO FIGHTS", 12 * DPR, 31 * DPR);
    ST.tiles = T.map((t) => ({ id: t.id, x: t.x / DPR, y: t.y / DPR, s: t.s / DPR }));
    ST.G = { yF: G.yF / DPR, yB: G.yB / DPR, hw: (d) => stHW(G, d) / DPR };
  };
  const hit = (x, y) => ST.tiles.slice().reverse().find((t) => Math.abs(t.x - x) <= t.s / 2 + 4 && Math.abs(t.y - y) <= t.s / 2 + 4);
  pkBind = function (box) {
    // one button: put every sound in a sensible place
    box.insertAdjacentHTML("beforeend", '<button class="stauto" title="Kick, 808 and lead vocal in the middle, everything else spread to the sides and set back a little">AUTO SPACE</button>');
    box.querySelector(".stauto").onclick = (ev) => { ev.stopPropagation(); stAuto(); };
    const pt = (ev) => { const r = box.getBoundingClientRect(), k = r.width / box.clientWidth; return [(ev.clientX - r.left) / k, (ev.clientY - r.top) / k, k]; };
    box.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest(".stauto")) return;
      const [x, y, k] = pt(ev), t = hit(x, y);
      if (!t) { if (MX.sel) { MX.sel = null; drawMix(); } return; }
      ev.preventDefault();
      const S = MX.ch[t.id], lv0 = S.lv, pan0 = S.pan, x0 = ev.clientX, y0 = ev.clientY, span = ST.G.yF - ST.G.yB;
      let moved = false;
      const mv = (m) => {
        const dx = (m.clientX - x0) / k, dy = (m.clientY - y0) / k;
        if (!moved && Math.hypot(dx, dy) < 3) return;
        if (!moved) { moved = true; ST.drag = { id: t.id }; box.classList.add("pkdrag"); }
        S.lv = Math.round(Math.max(LV_LO, Math.min(LV_HI, lv0 + (dy / span) * (LV_HI - LV_LO))));
        let p = pan0 + dx / ST.G.hw(stD(S.lv));
        p = Math.max(-1, Math.min(1, Math.round(p * 20) / 20));
        S.pan = Math.abs(p) < 0.06 ? 0 : p;
        mixFaders(); pkDraw();
      };
      const up = () => {
        removeEventListener("pointermove", mv); removeEventListener("pointerup", up);
        box.classList.remove("pkdrag"); ST.drag = null;
        if (moved) { MX.sel = t.id; drawMix(); ktToast(`${mxName(t.id)}: ${lvTxt(S.lv)}, ${Math.abs(S.pan) < 0.05 ? "centre" : (S.pan < 0 ? "left " : "right ") + Math.round(Math.abs(S.pan) * 100)}`); }
        else { MX.sel = MX.sel === t.id ? null : t.id; drawMix(); }
      };
      addEventListener("pointermove", mv); addEventListener("pointerup", up);
    });
    box.addEventListener("dblclick", (ev) => {
      const [x, y] = pt(ev), t = hit(x, y);
      if (!t) return;
      MX.ch[t.id].pan = 0; MX.ch[t.id].lv = 0; mixFaders(); drawMix(); ktToast(`${mxName(t.id)}: back to the middle, 0 dB`);
    });
    box.addEventListener("pointermove", (ev) => {
      if (ST.drag) return;
      const [x, y] = pt(ev), t = hit(x, y), id = t ? t.id : null;
      box.style.cursor = t ? "grab" : "default";
      if (id !== ST.hover) { ST.hover = id; pkDraw(); }
    });
    box.addEventListener("pointerleave", () => { if (ST.hover && !ST.drag) { ST.hover = null; pkDraw(); } });
  };
  // AUTO SPACE: the low end and the lead vocal stay in the middle; the rest takes turns left and right
  const AUTO = { drums: [0.2, 0], "808": [0, 0], vox: [0, 0], adlib: [0.45, -3], music: [0.3, -3], synth: [0.3, -2], fx: [0.6, -5] };
  function stAuto() {
    const seen = {};
    MXC.forEach((c) => {
      const k = kindOfId(c[0]), a = AUTO[k] || [0.3, -3], i = seen[k] = (seen[k] || 0) + 1, ch = MX.ch[c[0]];
      const leadVox = k === "vox" && i === 1;
      if (k === "drums" && i === 1) { ch.pan = 0; return; }
      let pan = a[0] ? a[0] * (i % 2 ? -1 : 1) * (1 + 0.25 * Math.floor((i - 1) / 2)) : 0;
      if (k === "vox" && !leadVox) pan = (i % 2 ? 1 : -1) * 0.3;
      ch.pan = Math.max(-1, Math.min(1, Math.round(pan * 20) / 20));
      ch.lv = leadVox || !a[1] ? Math.max(ch.lv, k === "vox" && !leadVox ? -3 : ch.lv) : Math.min(ch.lv, a[1]);
      if (k === "vox" && !leadVox) ch.lv = Math.min(ch.lv, -3);
    });
    mixFaders(); drawMix();
    ktToast("Spaced out: kick, 808 and lead vocal in the middle, the rest spread to the sides and set back a little");
  }
  // the tab says SPACE, and the hint says how it works
  const _dm2 = drawMix;
  drawMix = function () {
    _dm2.apply(this, arguments);
    const v = document.querySelector("#s0 .mixv");
    if (!v) return;
    const tab = v.querySelector('.mxvtt i[data-v="peaks"]');
    if (tab && tab.textContent !== "SPACE") { tab.textContent = "SPACE"; tab.title = "Every sound on a stage in front of you: drag it left, right, closer or further back"; }
    const h = v.querySelector(".mxhint");
    if (h && MX.view === "peaks") h.textContent = "Drag a sound: sideways = left / right, down = closer and louder, up = further back. A red line = two sounds fighting for the same notes: pull them apart. Double-click = back to the middle.";
  };
  document.head.insertAdjacentHTML("beforeend", `<style>
.L4 .mxpk .pkleg{display:none}
.L4 .mxpk .stauto{position:absolute;top:10px;right:10px;z-index:2;font:800 8.5px/1 var(--f, Inter, sans-serif);letter-spacing:.16em;color:#141218;background:#e4ff3a;border:0;border-radius:0;padding:7px 11px;cursor:pointer}
.L4 .mxpk .stauto:hover{filter:brightness(1.1)}
.L4 .mixv.vpeaks .mxpk{background:#0f0f12}
</style>`);
}

// ---------------------------------------------------------------- MIX & MASTER, redone (Eman, 4 Nov)
// Calm panels; loudness as a smooth layered purple wave; the sound as a ridgeline of songs like it
// with your song in yellow and pins on what's off; the styles as white line icons.
// The old particle look stays behind window.KT2_OLD_MASTER = true.
if (!window.KT2_OLD_MASTER) {
  const MS = { sig: "", t: 0 };
  // white line icons, 40 x 40, drawn in currentColor
  const MSICON = [
    // EVEN: an even grid of dots
    [0, 1, 2, 3].map((a) => [0, 1, 2, 3].map((b) => `<circle cx="${8 + a * 8}" cy="${8 + b * 8}" r="2.2"/>`).join("")).join(""),
    // HEAT: a burst
    '<circle cx="20" cy="20" r="3.4"/>' + [...Array(12)].map((_, i) => { const a = i / 12 * Math.PI * 2, r0 = 7, r1 = i % 2 ? 13 : 17; return `<path d="M${(20 + Math.cos(a) * r0).toFixed(1)} ${(20 + Math.sin(a) * r0).toFixed(1)}L${(20 + Math.cos(a) * r1).toFixed(1)} ${(20 + Math.sin(a) * r1).toFixed(1)}"/>`; }).join(""),
    // GLASS: a cube inside a circle
    '<circle cx="20" cy="20" r="16"/><path d="M20 9l9.5 5.5v11L20 31l-9.5-5.5v-11z"/><path d="M10.5 14.5L20 20l9.5-5.5M20 20v11"/>',
    // CASSETTE: two reels in a shell
    '<rect x="4" y="9" width="32" height="22"/><circle cx="13" cy="19" r="4.5"/><circle cx="27" cy="19" r="4.5"/><path d="M13 23.5h14M10 31l3-5h14l3 5"/>',
    // VAST: a centre pushing out four ways
    '<circle cx="20" cy="20" r="3"/><path d="M20 4v13M20 23v13M4 20h13M23 20h13"/><path d="M16.5 7.5L20 4l3.5 3.5M16.5 32.5L20 36l3.5-3.5M7.5 16.5L4 20l3.5 3.5M32.5 16.5L36 20l-3.5 3.5"/>',
    // FILM: a lens in a frame
    '<rect x="5" y="5" width="30" height="30"/><circle cx="20" cy="20" r="10"/><path d="M20 15v10M15 20h10"/>',
    // SLAM: an arrow into a wall
    '<path d="M33 5v30"/><path d="M5 20h22M20 12l8 8-8 8"/><path d="M36.5 11v18" opacity=".5"/>',
  ];
  const ICO = (i) => `<svg viewBox="0 0 40 40" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square">${MSICON[i]}</svg>`;
  mxpDress = function (p) {
    const sy = p.querySelector(".msy");
    if (sy) sy.querySelectorAll("i").forEach((i, k) => {
      const sv = i.querySelector("svg"); if (sv) sv.remove();
      const cv = i.querySelector("canvas"); if (cv) cv.remove();
      if (!i.querySelector(".msic")) i.insertAdjacentHTML("afterbegin", `<span class="msno">0${k + 1}</span><span class="msic">${ICO(k)}</span>`);
    });
    MS.sig = ""; mxpFrame(performance.now(), 1);
  };
  const curve = (pts) => (g, join) => { // smooth line through pts with quadratic midpoints
    if (join) g.lineTo(pts[0][0], pts[0][1]); else g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]);
  };
  const smooth = (a, r) => a.map((_, i) => { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const v = a[i + k]; if (v != null) { s += v; n++; } } return s / n; });
  // loudness: the song as a mirrored wave, three layers (master, mix, the steady core)
  mxpLoud = function (c) {
    const r = mxpCv(c); if (!r) return;
    const [g, W, H] = r, L = mxLufs(), tg = TGT[MX.tgt], cy = H / 2, amp = (v) => Math.max(0.02, Math.min(1, (v + 30) / 24)) * (H / 2 - 8 * DPR);
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,0.04)";
    MSEC.forEach((s) => { if (s[1] > 0) g.fillRect(s[1] / 32 * W, 0, 1 * DPR, H); });
    // the real song: every lane's level over time, added up; the master number sets how tall it stands
    const N = 160, xs = (i) => (i / (N - 1)) * W, raw = [];
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * (NT - 1), a = Math.floor((i / N) * ENVN), b = Math.max(a + 1, Math.floor(((i + 1) / N) * ENVN));
      let s = 0;
      MXC.forEach((ch) => {
        if (MX.mute[ch[0]]) return;
        const e = ENV.get(ch[0]), gn = Math.pow(10, MX.ch[ch[0]].lv / 20);
        if (!e) { s += mxAct(ch, t) * gn; return; }
        let m = 0; for (let k = a; k < b; k++) m = Math.max(m, e[k]);
        s += m * gn;
      });
      raw.push(s);
    }
    const mx = Math.max(0.001, ...raw), push = 0.55 + 0.45 * (MX.loud / 100);
    const mn = Math.min(...raw), env = raw.map((v) => 0.16 + 0.84 * Math.pow((v - mn) / Math.max(0.001, mx - mn), 1.6));
    const layer = (vals, k, fill) => {
      const top = vals.map((v, i) => [xs(i), cy - v * k]), bot = vals.map((v, i) => [xs(i), cy + v * k]).reverse();
      g.beginPath(); curve(top)(g); curve(bot)(g, true); g.closePath(); g.fillStyle = fill; g.fill();
    };
    const hMax = amp(L.mast);
    // the master squeezes the loud parts up toward the top: more LOUDNESS = flatter, taller
    const mastE = env.map((v) => Math.pow(v, 1 - 0.5 * push) * hMax);
    layer(smooth(mastE, 2), 1, "rgba(110,64,220,0.55)");
    layer(smooth(env.map((v) => v * hMax), 3), 0.72, "rgba(146,98,255,0.78)");
    layer(smooth(mastE, 6), 0.36, "rgba(200,176,255,0.92)");
    g.fillStyle = "rgba(236,232,255,0.55)"; g.fillRect(0, cy - 0.5 * DPR, W, 1 * DPR);
    // the platform's level, mirrored
    const ta = amp(tg[1]);
    g.strokeStyle = "rgba(228,255,58,0.75)"; g.lineWidth = 1 * DPR; g.setLineDash([4 * DPR, 4 * DPR]);
    g.beginPath(); g.moveTo(0, cy - ta); g.lineTo(W, cy - ta); g.moveTo(0, cy + ta); g.lineTo(W, cy + ta); g.stroke(); g.setLineDash([]);
    g.font = `700 ${8 * DPR}px "Martian Mono", ui-monospace, monospace`; g.fillStyle = "#e4ff3a"; g.textAlign = "left";
    g.fillText(`${tg[0]} ${tg[1]}`, 6 * DPR, cy - ta - 5 * DPR);
    // the marker while playing: a thin red line and a ring on the centre
    const scr = document.querySelector("#s0 .scr");
    if (scr && scr.classList.contains("playing")) {
      const x = (mxNowT() / NT) * W;
      g.fillStyle = "rgba(255,59,78,0.85)"; g.fillRect(x - 0.5 * DPR, 0, 1 * DPR, H);
      g.strokeStyle = "#fff"; g.lineWidth = 1.5 * DPR; g.fillStyle = "rgba(255,255,255,0.25)";
      g.beginPath(); g.arc(x, cy, 7 * DPR, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  };
  // the sound: dashed ridgelines = songs like yours; yellow = yours; a pin on each spot that's off
  const ISSUE = [[0.32, "TOO MUCH LOW", "THIN LOW END"], [0.68, "MUDDY MIDS", "SCOOPED MIDS"], [1.01, "SHARP HIGHS", "DULL TOP"]];
  mxpTone = function (c) {
    const r = mxpCv(c); if (!r) return;
    const [g, W, H] = r, N = 90, fixAmt = MX.an ? 0.25 : 1, base = H - 30 * DPR, top = 26 * DPR, hh = base - top;
    const cur = (i) => { const f = i / N; return (Math.exp(-Math.pow((f - 0.1) / 0.08, 2)) * 0.85 + Math.exp(-Math.pow((f - 0.45) / 0.1, 2)) * -0.35 + Math.exp(-Math.pow((f - 0.8) / 0.08, 2)) * 0.6) * fixAmt + (MX.bal.BASS / 6) * Math.exp(-Math.pow((f - 0.12) / 0.1, 2)) + (MX.bal.VOX / 6) * Math.exp(-Math.pow((f - 0.5) / 0.12, 2)) * 0.8 + (MX.sty == 2 ? 0.25 * f : MX.sty == 1 ? 0.2 * (1 - f) : 0); };
    // the typical shape: a gentle tilt; each reference song wanders around it
    const shape = (f) => 0.55 - 0.18 * f + 0.06 * Math.sin(f * 7);
    const Y = (v) => base - Math.max(0, Math.min(1, v)) * hh;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = "rgba(236,235,242,0.32)"; g.lineWidth = 1 * DPR; g.setLineDash([2 * DPR, 3 * DPR]);
    for (let k = 0; k < 13; k++) {
      const pts = [];
      for (let i = 0; i <= N; i += 2) {
        const f = i / N, wob = (pkNoise(f * 6, k * 1.7, 3) - 0.5) * 0.32 + (k - 6) * 0.012;
        pts.push([f * W + (k - 6) * 1.2 * DPR, Y(shape(f) + wob)]);
      }
      g.beginPath(); curve(pts)(g); g.stroke();
    }
    g.setLineDash([]);
    const mine = []; for (let i = 0; i <= N; i++) mine.push([(i / N) * W, Y(shape(i / N) + cur(i) * 0.32)]);
    g.strokeStyle = "#e4ff3a"; g.lineWidth = 2 * DPR; g.beginPath(); curve(mine)(g); g.stroke();
    // axis
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.2 * DPR;
    g.beginPath(); g.moveTo(0, base + 8 * DPR); g.lineTo(W, base + 8 * DPR); g.stroke();
    for (let k = 0; k <= 12; k++) { const x = (k / 12) * (W - 1); g.beginPath(); g.moveTo(x, base + 8 * DPR); g.lineTo(x, base + (k % 4 ? 5 : 2) * DPR); g.stroke(); }
    // pins: the worst spot in each of low, mid, high when it's well off
    let from = 0, n = 0;
    const pins = [];
    ISSUE.forEach(([to, up, down]) => {
      let best = -1, bv = 0;
      for (let i = Math.round(from * N); i <= Math.min(N, Math.round(to * N)); i++) { const v = cur(i); if (Math.abs(v) > Math.abs(bv)) { bv = v; best = i; } }
      from = to;
      if (best >= 0 && Math.abs(bv) > 0.3) pins.push({ i: best, txt: bv > 0 ? up : down });
    });
    g.textAlign = "center";
    pins.forEach((p) => {
      n++;
      const x = (p.i / N) * W, y = mine[p.i][1], hz = Math.exp(Math.log(20) + (p.i / N) * (Math.log(20000) - Math.log(20)));
      g.strokeStyle = "#e4ff3a"; g.lineWidth = 1 * DPR; g.setLineDash([2 * DPR, 2 * DPR]);
      g.beginPath(); g.moveTo(x, y - 8 * DPR); g.lineTo(x, base + 8 * DPR); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#e4ff3a"; g.beginPath(); g.arc(x, base + 8 * DPR, 2.2 * DPR, 0, Math.PI * 2); g.fill();
      g.lineWidth = 2 * DPR; g.fillStyle = "#18181b"; g.beginPath(); g.arc(x, y - 14 * DPR, 5 * DPR, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = "#fff"; g.font = `700 ${8 * DPR}px "Martian Mono", ui-monospace, monospace`; g.fillText(String(n), x, y - 23 * DPR);
      g.fillStyle = "#e4ff3a"; g.font = `700 ${7.5 * DPR}px "Martian Mono", ui-monospace, monospace`;
      const lx = Math.max(40 * DPR, Math.min(W - 40 * DPR, x));
      g.fillText(p.txt, lx, base + 21 * DPR);
      g.fillStyle = "rgba(255,255,255,0.45)"; g.fillText(fHz(hz), lx, base + 29 * DPR);
    });
    if (!pins.length) { g.fillStyle = "rgba(255,255,255,0.6)"; g.font = `700 ${7.5 * DPR}px "Martian Mono", ui-monospace, monospace`; g.fillText("SITS RIGHT IN THE RANGE", W / 2, base + 22 * DPR); }
    g.textAlign = "left"; g.fillStyle = "rgba(255,255,255,0.4)"; g.font = `600 ${7.5 * DPR}px "Martian Mono", ui-monospace, monospace`;
    g.fillText("20 Hz", 0, top - 12 * DPR); g.textAlign = "right"; g.fillText("20 kHz", W, top - 12 * DPR);
  };
  mxpStyle = function () {};
  mxpFrame = function (t, force) {
    const p = document.querySelector("#s0 .mixv .mxi"); if (!p || !p.offsetParent) return;
    const scr = document.querySelector("#s0 .scr"), playing = scr && scr.classList.contains("playing");
    const sig = JSON.stringify([MX.tgt, MX.loud, MX.bal, MX.sty, MX.an, MXC.length, p.clientWidth, Object.values(MX.ch).map((c) => c.lv)]);
    if (!force && !playing && sig === MS.sig) return;
    if (sig !== MS.sig || force) { MS.sig = sig; mxpTone(p.querySelector(".mtc")); }
    mxpLoud(p.querySelector(".mlc"));
  };
  document.head.insertAdjacentHTML("beforeend", `<style>
.L4 .mxi{background:#141417!important;gap:10px!important}
.L4 .mxi .mlu,.L4 .mxi .mtb,.L4 .mxi .mref,.L4 .mxi .mbal,.L4 .mxi .msty{background:#1c1c20!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);padding:12px 14px!important;gap:9px!important}
.L4 .mxi .mlc{height:118px!important;background:transparent!important}
.L4 .mxi .mtc{height:150px!important;background:transparent!important}
.L4 .mxi .msub{font-family:"Martian Mono",ui-monospace,monospace!important;font-size:8px!important;letter-spacing:.16em!important;color:#a9a5b6!important}
.L4 .mxi .mlt{gap:0!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);align-self:flex-start}
.L4 .mxi .mlt i{background:transparent!important;padding:6px 10px!important;font-family:"Martian Mono",ui-monospace,monospace!important;font-size:8px!important;color:#8a8696!important}
.L4 .mxi .mlt i.on{background:#ecebf2!important;color:#141218!important}.L4 .mxi .mlt i.on small{color:#555!important}
.L4 .mxi .mlv{color:#a9a5b6;font-size:11px;margin:0}
.L4 .mxi .mxb{height:34px!important;background:#222226!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07);padding:0 12px!important}
.L4 .mxi .mxb u{top:auto!important;height:2px!important;background:#9f7bff!important;opacity:1!important}
.L4 .mxi .msty .mxb u{background:#e4ff3a!important}
.L4 .mxi .mxb b{font:500 11px var(--f)!important;letter-spacing:0!important;color:#8a8696!important;text-transform:capitalize;text-shadow:none!important}
.L4 .mxi .mxb em{font:700 11px var(--f)!important;color:#fff!important}
.L4 .mxi .mrf{border-color:rgba(255,255,255,.14)!important;background:#222226}
.L4 .mxi .mrp i{background:transparent!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);font-family:"Martian Mono",ui-monospace,monospace!important;font-size:8px!important}
.L4 .mxi .mrp i.on{background:#ecebf2!important;color:#141218!important}
.msr.msy{grid-template-columns:repeat(7,1fr)!important;gap:6px!important}
.msr.msy i{position:relative;height:86px!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:8px;background:#0b0b0d!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)!important;color:#fff!important;transform:none!important;overflow:hidden}
.msr.msy i::before,.msr.msy i::after{display:none!important}.msr.msy i .msic svg{width:30px!important;height:30px!important}.msr.msy i .msic svg *{fill:none!important}.msr.msy i .msic{display:block;line-height:0;color:#fff;opacity:.7;transition:opacity .15s}
.msr.msy i .msno{position:absolute;left:6px;top:5px;font:600 7px "Martian Mono",ui-monospace,monospace;color:rgba(255,255,255,.35);letter-spacing:.08em}
.msr.msy i b{padding:0!important;font:700 7.5px "Martian Mono",ui-monospace,monospace!important;letter-spacing:.14em!important;color:rgba(255,255,255,.6)!important;text-shadow:none!important}
.msr.msy i:hover .msic{opacity:1}.msr.msy i:hover b{color:#fff!important}
.L4 .msr.msy i.on,.msr.msy i.on{background:#0b0b0d!important;box-shadow:inset 0 0 0 1.5px #e4ff3a!important}.msr.msy i.on svg{filter:none!important}.msr.msy i.on .msic{opacity:1}.msr.msy i.on b,.msr.msy i.on .msno{color:#e4ff3a!important}
.msyd{font:500 10.5px var(--f);color:#a9a5b6}
</style>`);
}

// ---------------------------------------------------------------- the page
// The mock looks for "#s0 .scr": that is this overlay, under the header.
let ON = false, scr = null, sig = "";
function mount() {
  if (scr) return scr;
  const s0 = document.createElement("div");
  s0.id = "s0";
  s0.hidden = true;
  s0.innerHTML = '<div class="scr L4" id="k2mx"></div>';
  document.body.append(s0);
  scr = s0.firstChild;
  return scr;
}
function rebuild() {
  const old = scr.querySelector(".mixv");
  if (old) old.remove();
  scr.insertAdjacentHTML("beforeend", mixMarkup());
  bindMix(scr);
}
function show(on) {
  mount();
  ON = !!on;
  scr.parentElement.hidden = !ON;
  scr.classList.toggle("mixmode", ON);
  document.documentElement.classList.toggle("k2-mix", ON);
  if (!ON) return;
  if (!mxSync()) return;
  sig = stateSig();
  rebuild();
  drawMix();
  loadEnv();
}
const stateSig = () => (ui.state ? JSON.stringify(ui.state.tracks.map((t) => [t.id, t.name, t.volume, t.pan, t.muted, t.clips.map((c) => [c.start, c.length])]).concat([ui.state.sections])) : "");
// the engine changed something (Undo, another page): redraw with the real values
setInterval(() => {
  if (!ON || !ui.state) return;
  pushChanges();
  const now = stateSig();
  if (now !== sig && performance.now() - lastSend > 1200) {
    const keep = MXC.map((c) => c[0]).join();
    sig = now; mxSync();
    if (MXC.map((c) => c[0]).join() !== keep) rebuild();
    drawMix(); loadEnv();
  }
}, 150);
(function tick() {
  requestAnimationFrame(tick);
  if (scr) scr.classList.toggle("playing", ON && !!(ui.transport && ui.transport.playing));
})();
window.addEventListener("keydown", (e) => {
  if (!ON || e.key !== "Escape" || e.target.closest("input,textarea,[contenteditable]")) return;
  if (MX.exp) { MX.exp = null; mixExport(); }
  else if (MX.sel) { MX.sel = null; drawMix(); }
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
window.addEventListener("resize", () => ON && drawMix());
document.head.insertAdjacentHTML("beforeend", `<style>
#s0{position:fixed;inset:0;z-index:30;pointer-events:none}
#s0[hidden]{display:none}
#k2mx{position:absolute;inset:0;--f:Inter,"Helvetica Neue",Helvetica,Arial,sans-serif;--m:Inter,sans-serif;--d:Inter,sans-serif;color:#ecebf2}
#k2mx .mixv{pointer-events:auto;top:var(--k2-head,52px)}
#k2mx .mxch{overflow-y:auto;max-height:46vh}
#k2mx .msty .msr.msy{width:100%;box-sizing:border-box;grid-auto-rows:78px;min-height:78px}
#k2mx .mxf:after{pointer-events:none}
#k2mx .mxi > *{flex-shrink:0}
.kt2.k2-mix .rack,.kt2.k2-mix .kt-ai{visibility:hidden}
</style>`);
window.KT2Mix = { show, get on() { return ON; }, sync: () => { mxSync(); drawMix(); } };
})();
