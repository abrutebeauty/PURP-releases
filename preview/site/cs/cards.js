/* COREKULT sound cards for OPIUM 2 (Eman 26 Nov). Loaded from top.js. Needs /cs/cards.css */
(function(){
if(window.__ckCards)return;window.__ckCards=1;
var l=document.createElement("link");l.rel="stylesheet";l.href="/cs/cards.css?v=1";document.head.appendChild(l);
/*HELPERS*/
const star=(cx,cy,ax,ay,k=.1)=>{const bx=ax*k,by=ay*k;return `M${cx} ${cy-ay}C${cx+bx} ${cy-by*2} ${cx+bx*2} ${cy-by} ${cx+ax} ${cy}C${cx+bx*2} ${cy+by} ${cx+bx} ${cy+by*2} ${cx} ${cy+ay}C${cx-bx} ${cy+by*2} ${cx-bx*2} ${cy+by} ${cx-ax} ${cy}C${cx-bx*2} ${cy-by} ${cx-bx} ${cy-by*2} ${cx} ${cy-ay}Z`};
const burst=(n,r1,r2,c=16)=>{let p=[];for(let i=0;i<n*2;i++){const a=i/(n*2)*Math.PI*2-Math.PI/2,r=i%2?r2:r1;p.push((c+r*Math.cos(a)).toFixed(1)+" "+(c+r*Math.sin(a)).toFixed(1))}return "M"+p.join("L")+"Z"};
const scallop=(n,r,d,c=16)=>{let s="";for(let i=0;i<=n*8;i++){const a=i/(n*8)*Math.PI*2,rr=r+d*Math.cos(a*n);s+=(i?"L":"M")+(c+rr*Math.cos(a)).toFixed(1)+" "+(c+rr*Math.sin(a)).toFixed(1)}return s+"Z"};
const dots=()=>{let o="";for(let k=1;k<=46;k++){const r=Math.sqrt(k/46)*14.2,a=k*2.39996;o+=`<circle cx="${(16+r*Math.cos(a)).toFixed(2)}" cy="${(16+r*Math.sin(a)).toFixed(2)}" r="${(.45+r*.07).toFixed(2)}"/>`}return o};
const rings=()=>[15,12.6,10.4,8.4,6.6,5,3.6,2.4].map(r=>`<circle cx="16" cy="16" r="${r}"/>`).join("");
/*ICONS*/
const ICONS=[
 /* long sparkle + little one */ `<path d="${star(14,17,12,14.5,.07)}"/><path d="${star(26,6,4,4,.14)}"/>`,
 /* thin sparkle with halo ring */ `<path d="${star(16,16,4.2,15.5,.07)}"/><ellipse cx="16" cy="19" rx="14" ry="3.6"/>`,
 /* circle arrow */ `<path d="M16 3.5A12.5 12.5 0 1 0 28.5 16"/><path d="M12 1.5l5 2-2 5z" transform="translate(5.5 .5)"/>`,
 /* globe in lens */ `<path d="M1 16C6 8.5 11 7 16 7s10 1.5 15 9c-5 7.5-10 9-15 9S6 23.5 1 16z"/><circle cx="16" cy="16" r="6.5"/><ellipse cx="16" cy="16" rx="2.8" ry="6.5"/><path d="M9.5 16h13"/>`,
 /* halftone spiral dots */ `<g stroke-width=".8">${dots()}</g>`,
 /* interlocked quatrefoil */ `<circle cx="11" cy="11" r="8"/><circle cx="21" cy="11" r="8"/><circle cx="11" cy="21" r="8"/><circle cx="21" cy="21" r="8"/>`,
 /* stacked slabs */ `<path d="M3 9l13-6 13 6-13 6z"/><path d="M3 15l13 6 13-6"/><path d="M3 21l13 6 13-6"/>`,
 /* circle with star */ `<circle cx="16" cy="16" r="14.5"/><path d="${star(16,16,11,11,.14)}"/>`,
 /* spiky burst */ `<path d="${burst(14,15.5,8)}"/><circle cx="16" cy="16" r="3"/>`,
 /* grid of small stars */ [4,16,28].flatMap(y=>[4,16,28].map(x=>`<path d="${star(x,y,3.4,3.4,.14)}"/>`)).join(""),
 /* scalloped badge */ `<path d="${scallop(12,12.6,1.9)}"/><circle cx="16" cy="16" r="7.5"/>`,
 /* rosette (two squares + ring) */ `<rect x="6" y="6" width="20" height="20"/><rect x="6" y="6" width="20" height="20" transform="rotate(45 16 16)"/><circle cx="16" cy="16" r="5"/>`,
 /* moire rings */ rings(),
 /* cross sparkle with long tails */ `<path d="${star(16,16,15.5,5,.08)}"/><path d="${star(16,16,5,15.5,.08)}"/><path d="M5 5l4 4M27 5l-4 4M5 27l4-4M27 27l-4-4"/>`
];
/*SHAPES*/
let fs=7;const rnd=()=>{fs=(fs*16807)%2147483647;return fs/2147483647};
const Jt=(a=1.5)=>(rnd()-.5)*a;
const dens=(p,st=60)=>{const o=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],n=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/st));for(let k=0;k<n;k++)o.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n])}return o};
const PL=(p,d=true)=>{const q=(d?dens(p):p).map(a=>[a[0]+Jt(),a[1]+Jt()]);return "M"+q.map(a=>a[0].toFixed(1)+" "+a[1].toFixed(1)).join("L")+"Z"};
const OPEN=p=>"M"+p.map(a=>(a[0]+Jt()).toFixed(1)+" "+(a[1]+Jt()).toFixed(1)).join("L");
const wavy=(x,y,w,h,amp,per,bump)=>{const o=[],f=d=>{const t=Math.sin(d/per*Math.PI*2);return amp*(bump?Math.abs(t):t)};
  for(let d=0;d<=w;d+=4)o.push([x+d,y-f(d)]);for(let d=0;d<=h;d+=4)o.push([x+w+f(d),y+d]);for(let d=0;d<=w;d+=4)o.push([x+w-d,y+h+f(d)]);for(let d=0;d<=h;d+=4)o.push([x-f(d),y+h-d]);return PL(o,false)};
const SHAPES={
 1:{ /* block / cut / wave / arch */
  bass:(x,y,w,h)=>{const s=18;return PL([[x+s,y],[x+w,y],[x+w,y+h-s],[x+w-s,y+h-s],[x+w-s,y+h],[x,y+h],[x,y+s],[x+s,y+s]])},
  synth:(x,y,w,h)=>PL([[x,y],[x+w-34,y],[x+w,y+34],[x+w,y+h],[x+34,y+h],[x,y+h-34]]),
  pad:(x,y,w,h)=>wavy(x,y,w,h,4,38,false),
  keys:(x,y,w,h)=>{const o=[];for(let t=0;t<=1.001;t+=.02){const u=2*t-1;o.push([x+t*w,y+26*(1-Math.sqrt(Math.max(0,1-u*u)))])}
    o.push([x+w,y+h]);[.66,.34].forEach(q=>{const cx=x+w*q;o.push([cx+14,y+h],[cx+14,y+h-12],[cx-14,y+h-12],[cx-14,y+h])});o.push([x,y+h]);return PL(o,false)}},
 2:{ /* chamfer / sawtooth / scallop / ticket */
  bass:(x,y,w,h)=>{const c=24;return PL([[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+h-c],[x+w-c,y+h],[x+c,y+h],[x,y+h-c],[x,y+c]])},
  synth:(x,y,w,h)=>{const n=Math.round(w/22),o=[];for(let k=0;k<=n;k++)o.push([x+k*w/n,y+(k%2?-8:0)]);for(let k=n;k>=0;k--)o.push([x+k*w/n,y+h+(k%2?8:0)]);return PL(o,false)},
  pad:(x,y,w,h)=>wavy(x,y,w,h,8,56,true),
  keys:(x,y,w,h)=>{const o=[[x,y],[x+w,y]];for(let a=-90;a<=90;a+=10){const r=a*Math.PI/180;o.push([x+w-Math.cos(r)*0-(-0),y])}o.length=2;
    o.push([x+w,y+h/2-18]);for(let a=-90;a<=90;a+=12){const r=a*Math.PI/180;o.push([x+w-Math.cos(r)*18,y+h/2+Math.sin(r)*18])}o.push([x+w,y+h],[x,y+h],[x,y+h/2+18]);for(let a=90;a>=-90;a-=12){const r=a*Math.PI/180;o.push([x+Math.cos(r)*18,y+h/2+Math.sin(r)*18])}return PL(o,false)}},
 3:{ /* open brackets */
  bass:(x,y,w,h)=>[0,6].map(i=>{const L=36,a=x+i,b=y+i,c=x+w-i,d=y+h-i;return OPEN([[a,b+L],[a,b],[a+L,b]])+OPEN([[c-L,b],[c,b],[c,b+L]])+OPEN([[a,d-L],[a,d],[a+L,d]])+OPEN([[c-L,d],[c,d],[c,d-L]])}).join(""),
  synth:(x,y,w,h)=>OPEN([[x,y],[x+w,y]])+OPEN([[x,y+h],[x+w,y+h]])+[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([a,b])=>PL([[a-8,b],[a,b-8],[a+8,b],[a,b+8]],false)).join(""),
  pad:(x,y,w,h)=>"M"+(x+22)+" "+y+"Q"+(x-14)+" "+(y+h/2)+" "+(x+22)+" "+(y+h)+"M"+(x+w-22)+" "+y+"Q"+(x+w+14)+" "+(y+h/2)+" "+(x+w-22)+" "+(y+h),
  keys:(x,y,w,h)=>{let d=OPEN([[x,y],[x+w,y]])+OPEN([[x,y+h],[x+w,y+h]]);for(let k=0;k<=w;k+=26){d+="M"+(x+k)+" "+(y+h)+"v-16"}for(let k=0;k<=w;k+=26){d+="M"+(x+k)+" "+y+"v10"}return d}}
};


/* ---- shape library for the picker (V) ---- */
const PLJ=(p,a)=>"M"+p.map(q=>(q[0]+Jt(a)).toFixed(1)+" "+(q[1]+Jt(a)).toFixed(1)).join("L")+"Z";
const D=fn=>(w,h,o=0)=>PL(fn(w-2*o,h-2*o).map(p=>[p[0]+o,p[1]+o]),false);
const perim=(w,h,fw,fh)=>{const o=[],st=3;
  for(let x=0;x<=w;x+=st)o.push([x,fw(x,w)]);for(let x=0;x<=h;x+=st)o.push([w-fh(x,h),x]);
  for(let x=0;x<=w;x+=st)o.push([w-x,h-fw(x,w)]);for(let x=0;x<=h;x+=st)o.push([fh(x,h),h-x]);return o};
const tri=(x,p,a)=>a*(1-Math.abs(((x%p)/p)*2-1));
const per=(x,L,p)=>L/Math.max(1,Math.round(L/p));
const spikes=(p,a)=>(x,L)=>-tri(x,per(x,L,p),a);
const stampF=(p,r)=>(x,L)=>{const q=per(x,L,p),u=(x%q)/q;return r*Math.abs(Math.sin(u*Math.PI))};
const cloudF=(p,a)=>(x,L)=>{const q=per(x,L,p),u=(x%q)/q;return -a*Math.abs(Math.sin(u*Math.PI))};
const rrP=(w,h,r)=>{r=Math.max(2,Math.min(r,w/2,h/2));const o=[],n=8,c=[[w-r,r,-90],[w-r,h-r,0],[r,h-r,90],[r,r,180]];
  c.forEach(([cx,cy,a0])=>{for(let k=0;k<=n;k++){const a=(a0+90*k/n)*Math.PI/180;o.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}});return dens(o,40)};
const sup=(w,h,n)=>{const o=[];for(let i=0;i<110;i++){const t=i/110*Math.PI*2,c=Math.cos(t),s2=Math.sin(t);o.push([w/2+w/2*Math.sign(c)*Math.pow(Math.abs(c),2/n),h/2+h/2*Math.sign(s2)*Math.pow(Math.abs(s2),2/n)])}return o};
const blobP=(w,h)=>sup(w,h,3.1).map((p,i)=>{const t=i/110*Math.PI*2,k=1+.025*Math.sin(3*t+.8)+.02*Math.sin(5*t+2);return [w/2+(p[0]-w/2)*k,h/2+(p[1]-h/2)*k]});
const tornF=()=>{const ph=rnd()*9;return x=>(Math.sin(x*.9+ph)+Math.sin(x*2.3+1)+Math.sin(x*.37))*2.4+(rnd()-.5)*3.5+4};
const stairs=(w,h)=>{const tl=[[0,30],[10,30],[10,20],[20,20],[20,10],[30,10],[30,0]],r=tl.slice().reverse();
  return dens([...tl,...r.map(p=>[w-p[0],p[1]]).slice(0),...tl.map(p=>[w-p[0],h-p[1]]).reverse().reverse(),...r.map(p=>[p[0],h-p[1]])].filter(Boolean),20)};
const cornerArc=(cx,cy,a0,a1)=>{const o=[];for(let k=0;k<=8;k++){const a=(a0+(a1-a0)*k/8)*Math.PI/180;o.push([cx+14*Math.cos(a),cy+14*Math.sin(a)])}return o};
const coupon=(w,h)=>[[14,0],[w-14,0],...cornerArc(w,0,180,90),[w,h-14],...cornerArc(w,h,270,180),[14,h],...cornerArc(0,h,0,-90),[0,14],...cornerArc(0,0,90,0)];
const ln=(a,b)=>"M"+(a[0]+Jt(2)).toFixed(1)+" "+(a[1]+Jt(2)).toFixed(1)+"L"+(b[0]+Jt(2)).toFixed(1)+" "+(b[1]+Jt(2)).toFixed(1);
const rect=(w,h)=>dens([[0,0],[w,0],[w,h],[0,h]],50);
const SHP=[
 {n:"wavy double",sel:1,f:(w,h)=>SHAPES[1].pad(0,0,w,h)+SHAPES[1].pad(7,7,w-14,h-14)},
 {n:"thorn pillow",sel:1,f:(w,h)=>{const sp=8,c=16,j=()=>(rnd()-.5)*2.6;const P=[[c,0],[w*.35,j()],[w*.7,j()],[w-c,0],[w+sp,-sp],[w,c],[w+j(),h*.35],[w+j(),h*.7],[w,h-c],[w+sp,h+sp],[w-c,h],[w*.65,h+j()],[w*.3,h+j()],[c,h],[-sp,h+sp],[0,h-c],[j(),h*.65],[j(),h*.3],[0,c],[-sp,-sp]];return "M"+P.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")+"Z"}},
 {n:"ticket notches",sel:1,f:(w,h)=>SHAPES[2].keys(0,0,w,h)},
 {n:"zigzag receipt",sel:1,f:(w,h)=>SHAPES[2].synth(0,0,w,h)},
 {n:"cut corners",sel:1,f:(w,h)=>SHAPES[1].synth(0,0,w,h)},
 {n:"notched block",sel:1,f:(w,h)=>SHAPES[1].bass(0,0,w,h)},
 {n:"chamfer octagon",f:(w,h)=>SHAPES[2].bass(0,0,w,h)},
 {n:"spike teeth all round",f:D((w,h)=>perim(w,h,spikes(16,9),spikes(16,9)))},
 {n:"sketch double pass",f:(w,h)=>PLJ(dens([[0,0],[w,0],[w,h],[0,h]],40),3.4)+PLJ(dens([[3,4],[w+2,-1],[w-2,h+3],[-2,h-2]],40),3.4)},
 {n:"rounded",f:D((w,h)=>rrP(w,h,30))},
 {n:"rounded double",f:(w,h)=>D((a,b)=>rrP(a,b,32))(w,h,0)+D((a,b)=>rrP(a,b,22))(w,h,8)},
 {n:"pill",f:D((w,h)=>rrP(w,h,90))},
 {n:"squircle",f:D((w,h)=>sup(w,h,4))},
 {n:"organic blob",f:D(blobP)},
 {n:"torn paper",f:D((w,h)=>{const t=tornF(),u=tornF();return perim(w,h,t,()=>0).map((p,i,a)=>p)})},
 {n:"stamp edge",f:D((w,h)=>perim(w,h,stampF(24,7),stampF(24,7)))},
 {n:"double chamfer",f:(w,h)=>SHAPES[2].bass(0,0,w,h)+SHAPES[2].bass(8,8,w-16,h-16)},
 {n:"pixel stairs",f:D(stairs)},
 {n:"long spike corners",f:D((w,h)=>dens([[14,0],[w-14,0],[w+18,-18],[w,14],[w,h-14],[w+18,h+18],[w-14,h],[14,h],[-18,h+18],[0,h-14],[0,14],[-18,-18]],40))},
 {n:"taped corners",f:(w,h)=>PL(rect(w,h),false)+[[[-6,26],[26,-6],[40,8],[8,40]],[[w+6,h-26],[w-26,h+6],[w-40,h-8],[w-8,h-40]]].map(t=>PL(t,false)).join("")},
 {n:"overshoot lines",f:(w,h)=>ln([-16,2],[w+10,-1])+ln([w-1,-14],[w+3,h+12])+ln([w+14,h-2],[-10,h+2])+ln([2,h+16],[-2,-10])},
 {n:"offset shadow box",f:(w,h)=>PL(rect(w-12,h-12),false)+"M"+[[12,12],[w,12],[w,h],[12,h]].map(p=>p.join(" ")).join("L")+"Z"},
 {n:"speech bubble",f:(w,h)=>PL(rrP(w,h-18,24),false)+ln([34,h-18],[22,h+2])+ln([22,h+2],[64,h-18])},
 {n:"long hexagon",f:D((w,h)=>dens([[34,0],[w-34,0],[w,h/2],[w-34,h],[34,h],[0,h/2]],40))},
 {n:"gravestone double",f:(w,h)=>{const g=(a,b)=>{const o=[];for(let t=0;t<=1.001;t+=.04)o.push([a*t,46*(1-Math.sin(Math.PI*Math.min(1,t)))*(1)+0]);const m=[];for(let t=0;t<=1.001;t+=.04){const u=Math.min(1,t);m.push([a*u,46-46*Math.sin(Math.PI*u)])}return dens([...m,[a,b],[0,b]],40)};return D(g)(w,h,0)+D(g)(w,h,7)}},
 {n:"big cloud bumps",f:D((w,h)=>perim(w,h,cloudF(80,15),cloudF(80,15)))},
 {n:"explosion edge",f:D((w,h)=>{const e=(x,L)=>{const q=per(x,L,17),k=Math.floor(x/q+.001);return -tri(x,q,5+(k*37)%11)};return perim(w,h,e,e)})},
 {n:"dashed rounded",dash:1,f:D((w,h)=>rrP(w,h,26))},
 {n:"triple line",f:(w,h)=>[0,6,12].map(o=>D((a,b)=>rrP(a,b,28-o))(w,h,o)).join("")},
 {n:"coupon corners",f:D(coupon)},
 {n:"price tag",f:D((w,h)=>dens([[0,0],[w-40,0],[w,h/2],[w-40,h],[0,h]],40))}
];

/* ---- GLOBAL category -> shape map (Eman 26 Nov): same category = same shape on every pack and page.
   Lead / chip / pluck / arp / stab all count as "synth". Packs with other categories get their own shape from EXTRA (stable by name). */
var CK_GROUP={LEAD:"synth",LEADS:"synth",CHIP:"synth",PLUCK:"synth",PLUCKS:"synth",ARP:"synth",ARPS:"synth",STAB:"synth",STABS:"synth",SYNTH:"synth",
  BASS:"bass","808":"bass",SUB:"bass",
  PAD:"pad",PADS:"pad",TEXTURE:"pad",TEXTURES:"pad",ATMOS:"pad",
  KEYS:"keys",KEY:"keys",BELL:"keys",BELLS:"keys",PIANO:"keys",CHORD:"keys",CHORDS:"keys",
  VOX:"vox",VOCAL:"vox",VOCALS:"vox",
  FX:"fx",SFX:"fx",RISER:"fx",RISERS:"fx",IMPACT:"fx"};
var CK_SHAPE={
  bass:(w,h)=>SHAPES[1].synth(0,0,w,h),                       /* 05 cut corners */
  synth:(w,h)=>SHAPES[2].synth(0,0,w,h),                      /* 04 zigzag receipt */
  pad:(w,h)=>SHAPES[1].pad(0,0,w,h)+SHAPES[1].pad(7,7,w-14,h-14), /* 01 wavy double */
  keys:(w,h)=>SHAPES[2].keys(0,0,w,h),                        /* 03 ticket notches */
  vox:(w,h)=>{const sp=8,c=16,j=()=>(rnd()-.5)*2.6;const P=[[c,0],[w*.35,j()],[w*.7,j()],[w-c,0],[w+sp,-sp],[w,c],[w+j(),h*.35],[w+j(),h*.7],[w,h-c],[w+sp,h+sp],[w-c,h],[w*.65,h+j()],[w*.3,h+j()],[c,h],[-sp,h+sp],[0,h-c],[j(),h*.65],[j(),h*.3],[0,c],[-sp,-sp]];return "M"+P.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")+"Z"}, /* 02 thorn pillow */
  fx:(w,h)=>SHAPES[1].bass(0,0,w,h)                           /* 06 notched block */
};
var CK_EXTRA=[(w,h)=>SHAPES[2].bass(0,0,w,h),(w,h)=>SHAPES[3].bass(0,0,w,h),(w,h)=>SHAPES[1].keys(0,0,w,h),(w,h)=>SHAPES[3].synth(0,0,w,h)];
function ckGroup(k){k=String(k||"").toUpperCase().trim();return CK_GROUP[k]||CK_GROUP[k.replace(/S$/,"")]||null}
function ckLookObj(){try{if(window.ADM&&window.ADM.look)return window.ADM.look}catch(e){}try{if(typeof LOOK!=="undefined"&&LOOK)return LOOK}catch(e){}try{return (window.__CKD&&window.__CKD.look)||{}}catch(e){}return {}}
function ckGKey(k){return ckGroup(k)||String(k||"").toUpperCase()}
function ckCfg(k){var L=ckLookObj();return (L.ck&&L.ck[ckGKey(k)])||{}}
var CK_DEFIDX={bass:4,synth:3,pad:0,keys:2,vox:1,fx:5};
function ckShapeFor(k){var c=ckCfg(k);if(c.shape!=null&&SHP[c.shape])return SHP[c.shape].f;var g=ckGroup(k);if(g)return CK_SHAPE[g];var h=0,s=String(k||"").toUpperCase();for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return CK_EXTRA[h%CK_EXTRA.length]}
window.CK_SHP=SHP;window.CK_CATSHAPE={group:CK_GROUP,shapes:CK_SHAPE,extra:CK_EXTRA,shapeFor:ckShapeFor};

/* ---- audio: remember the page's player so the cards can show time + status ---- */
var CK_AUDIO=null;try{var op0=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){CK_AUDIO=this;return op0.apply(this,arguments)}}catch(e){}
var ckFmt=function(s){s=Math.max(0,s|0);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
var CK_DUR={};
function ckDur(src,cb){if(CK_DUR[src]!==undefined){cb(CK_DUR[src]);return}
  try{var a=new Audio();a.preload="metadata";a.addEventListener("loadedmetadata",function(){CK_DUR[src]=a.duration||0;cb(CK_DUR[src])});a.addEventListener("error",function(){CK_DUR[src]=0});a.src=src}catch(e){}}

/* ---- build ---- */
var CK_N=0;
function ckPrefix(){var m=location.pathname.match(/^\/pack\/([^/?#]+)/),s=m?decodeURIComponent(m[1]):(window.CS_PACK||new URLSearchParams(location.search).get("id")||"pack");
  var w=String(s).split("-").filter(function(x){return x&&!/^(i{1,3}|iv|v|vi{0,3}|\d+)$/.test(x)});return "CK-"+(w.map(function(x){return x[0]}).join("").toUpperCase().slice(0,3)||"PK")}
function ckFrame(btn){var f=btn.querySelector(".ck-fr");if(!f)return;var w=btn.clientWidth,h=btn.clientHeight;if(!w||!h)return;
  fs=7+(+btn.dataset.ck||0)*13;var c=ckCfg(btn.dataset.ckcat),fn=ckShapeFor(btn.dataset.ckcat),dash=c.shape!=null&&SHP[c.shape]&&SHP[c.shape].dash;f.innerHTML='<path'+(dash?' class="dash"':"")+' d="'+fn(w,h)+'"/>'}
var ckRO=window.ResizeObserver?new ResizeObserver(function(es){es.forEach(function(e){ckFrame(e.target)})}):null;
function ckCard(btn,key,typeTxt){
  if(btn.dataset.ckdone)return;btn.dataset.ckdone=1;var i=CK_N++;btn.dataset.ck=i;btn.dataset.ckcat=key;
  var mt=(btn.querySelector(".mt")||{}).textContent||"",p=mt.split("·"),bpm=parseInt(p[0],10),ky=(p[1]||"").trim().toUpperCase();
  var nm=btn.querySelector(".nm"),pre=typeTxt.toLowerCase()+" - ";
  if(nm){try{var tw=document.createTreeWalker(nm,NodeFilter.SHOW_TEXT),tn;while((tn=tw.nextNode())){if(!tn.nodeValue.trim())continue;var re=new RegExp("^\\s*"+typeTxt.replace(/[^a-z0-9]/gi,"")+"s?\\b\\s*","i");if(re.test(tn.nodeValue)&&!nm.querySelector(".tc"))tn.nodeValue=tn.nodeValue.replace(re,"");break}}catch(e){}nm.setAttribute("data-ck",pre)}
  var fr=document.createElementNS("http://www.w3.org/2000/svg","svg");fr.setAttribute("class","ck-fr");fr.appendChild(document.createElementNS("http://www.w3.org/2000/svg","path"));btn.insertBefore(fr,btn.firstChild);
  var top=document.createElement("span");top.className="ck-top";
  top.innerHTML='<i class="ck-chip">'+ckPrefix()+"-"+String(i+1).padStart(3,"0")+'</i><svg class="ck-ic" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round" stroke-linecap="round">'+ICONS[i%ICONS.length]+'</svg>';
  btn.insertBefore(top,nm||null);
  var meta=document.createElement("span");meta.className="ck-meta";meta.innerHTML="<b>&gt; "+typeTxt+"</b><b>"+(bpm?bpm+" BPM":"")+(bpm&&ky?" / ":"")+ky+"</b>";
  var wf=btn.querySelector("canvas.wf");btn.insertBefore(meta,wf||null);
  var ts=document.createElement("span");ts.className="ck-ts";ts.innerHTML='<i class="ck-tm">0:00 / 0:00</i><i class="ck-st">STATUS: &gt; IDLE</i>';meta.appendChild(ts);
  ckDur(btn.dataset.src,function(d){if(!btn.classList.contains("on"))ts.firstChild.textContent="0:00 / "+ckFmt(d)});
  if(ckRO)ckRO.observe(btn);ckFrame(btn)}
function ckMix(hex,t){var m=/^#([0-9a-f]{6})$/i.exec(hex||"");if(!m)return hex;var n=parseInt(m[1],16),r=n>>16,g=(n>>8)&255,b=n&255,k=[14,13,18];return "#"+[r,g,b].map(function(v,i){return ("0"+Math.round(v*(1-t)+k[i]*t).toString(16)).slice(-2)}).join("")}
function ckApplySec(sec){var c=ckCfg(sec.getAttribute("data-k")||""),ln=c.col||"",tt=c.tcol||"";
  if(ln)sec.style.setProperty("--ck-line",ln);else sec.style.removeProperty("--ck-line");
  if(tt)sec.style.setProperty("--ck-title",tt);else sec.style.removeProperty("--ck-title");
  sec.__ckc=ln||"";sec.__ckcd=ln?ckMix(ln,.3):"";sec.__ckw=+c.wave||0}
var ckSig="";
function ckSigNow(){try{return JSON.stringify(ckLookObj().ck||{})}catch(e){return ""}}
function ckRefresh(){document.querySelectorAll("#opMag .op-cat").forEach(ckApplySec);document.querySelectorAll("#opMag .pv>button[data-ckdone]").forEach(ckFrame);if(typeof window.ckApplyLook==="function")try{window.ckApplyLook(ckLookObj())}catch(e){}}
function ckSection(sec){
  var key=sec.getAttribute("data-k")||"",box=sec.querySelector(".op-box"),nm=(box?box.textContent.split("·")[0]:key).trim(),n=sec.querySelectorAll(".pv>button").length;
  if(!sec.querySelector(".ck-ch")){var h=document.createElement("div");h.className="ck-ch";h.innerHTML="<b>"+nm.toLowerCase()+"</b><span>"+n+" PRESET"+(n===1?"":"S")+"</span>";sec.insertBefore(h,sec.firstChild)}
  var typeTxt=(key||nm).replace(/S$/,"");
  sec.querySelectorAll(".pv>button").forEach(function(b){var tc=b.querySelector(".nm .tc");ckCard(b,key||nm,(tc?tc.textContent:typeTxt).trim()||typeTxt)});
}
var ckBusy=0;
function ckScan(){if(ckBusy)return;ckBusy=1;try{
  var de=document.documentElement;if(!de.classList.contains("opium2")){return}
  var secs=document.querySelectorAll("#opMag .op-cat");if(!secs.length)return;
  de.classList.add("ck-cards");de.classList.toggle("ck-adm",ckAdm());secs.forEach(ckSection);var sg=ckSigNow();if(sg!==ckSig){ckSig=sg;ckRefresh()}}finally{ckBusy=0}}

/* ---- 5 waveform designs per category (called from the canvas fill hook in top.js) ---- */
var CK_WNAMES=["Lines","Bars","Smooth","Outline","Floor peaks"];
window.ckWave=function(g,cv,r,mode,col){
  var W=Math.round(cv.clientWidth)||100,H=Math.round(cv.clientHeight)||40,mid=H/2,pts=[],last=-9;
  for(var i=0;i<r.length;i+=4){var x=r[i];if(x-last<3)continue;last=x;pts.push([x,r[i+3]/2])}
  if(pts.length<4)return false;var mx=1;pts.forEach(function(q){if(q[1]>mx)mx=q[1]});
  g.save();g.fillStyle=col;g.strokeStyle=col;g.globalAlpha=1;
  if(mode===1){for(var a=0;a<pts.length;a+=5/3>1?2:1){var q=pts[a],h=Math.max(1,q[1]);g.fillRect(q[0],mid-h,3,h*2)}}
  else if(mode===2||mode===3){g.beginPath();g.moveTo(0,mid);pts.forEach(function(q){g.lineTo(q[0],mid-Math.max(.8,q[1]))});for(var b=pts.length-1;b>=0;b--)g.lineTo(pts[b][0],mid+Math.max(.8,pts[b][1]));g.closePath();
    if(mode===2)g.fill();else{g.globalAlpha=.14;g.fill();g.globalAlpha=1;g.lineWidth=1.3;g.stroke()}}
  else if(mode===4){for(var c=0;c<pts.length;c+=2){var h2=Math.max(1,Math.min(H-1,pts[c][1]*1.9));g.fillRect(pts[c][0],H-h2,2,h2)}}
  g.restore();return true};

/* ---- admin: press a category title (D admin) to set its shape, colours and waveform for the whole site ---- */
function ckAdm(){return !!window.ADM&&!document.documentElement.classList.contains("adm-pv")}
var ckSaveT=0;
function ckSave(){clearTimeout(ckSaveT);ckSaveT=setTimeout(function(){fetch("/api/admin/packs",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(window.ADM)}).then(function(r){return r&&r.ok}).catch(function(){return false}).then(function(ok){var t=document.createElement("div");t.className="adm-toast";t.textContent=ok?"Saved · live":"Not saved";document.body.appendChild(t);setTimeout(function(){t.remove()},1400);try{localStorage.removeItem("ck-prod");localStorage.removeItem("ck-draft")}catch(e){}})},350)}
function ckSet(k,key,val){var L=window.ADM.look=window.ADM.look||{};L.ck=L.ck||{};var g=ckGKey(k);L.ck[g]=L.ck[g]||{};if(val==null||val==="")delete L.ck[g][key];else L.ck[g][key]=val;if(!Object.keys(L.ck[g]).length)delete L.ck[g];ckSig=ckSigNow();ckRefresh();ckSave()}
function ckEditor(sec){
  var k=sec.getAttribute("data-k")||"",nm=((sec.querySelector(".ck-ch b")||{}).textContent||k),g=ckGKey(k),old=document.querySelector(".ck-ed");if(old)old.remove();
  var c=ckCfg(k),defIdx=CK_DEFIDX[ckGroup(k)],cur=c.shape!=null?c.shape:(defIdx!=null?defIdx:-1);
  var el=document.createElement("div");el.className="ck-ed";
  var thumbs=SHP.map(function(sh,i){fs=99;var d=sh.f(52,34);return '<button data-sh="'+i+'" class="'+(i===cur?"on":"")+'" title="'+(i+1)+" "+sh.n+'"><svg viewBox="-12 -12 76 58"><path'+(sh.dash?' class="dash"':"")+' d="'+d+'"/></svg><i>'+String(i+1).padStart(2,"0")+'</i></button>'}).join("");
  el.innerHTML='<h5><span>'+nm.toUpperCase()+' · whole site</span><button class="x" data-x>×</button></h5>'+
   '<div class="lb">Shape (all '+(ckGroup(k)||nm.toLowerCase())+' sections, every pack)</div><div class="shg">'+thumbs+'</div><div class="row"><button data-sh="-1">Default shape</button></div>'+
   '<div class="lb">Colours</div><div class="cl"><span>Cards + preview</span><input type="color" data-c="col" value="'+(c.col||"#ecebf0")+'"><button data-r="col">Reset</button></div>'+
   '<div class="cl"><span>Category title</span><input type="color" data-c="tcol" value="'+(c.tcol||"#ecebf0")+'"><button data-r="tcol">Reset</button></div>'+
   '<div class="lb">Waveform</div><div class="row">'+CK_WNAMES.map(function(n,i){return '<button data-w="'+i+'" class="'+((+c.wave||0)===i?"on":"")+'">'+n+'</button>'}).join("")+'</div>';
  document.body.appendChild(el);
  el.addEventListener("input",function(e){var i=e.target.closest("[data-c]");if(i)ckSet(k,i.dataset.c,i.value)});
  el.addEventListener("click",function(e){e.stopPropagation();var t=e.target;
    if(t.closest("[data-x]")){el.remove();return}
    var s=t.closest("[data-sh]");if(s){var v=+s.dataset.sh;ckSet(k,"shape",v<0?null:v);el.querySelectorAll(".shg button").forEach(function(b){b.classList.toggle("on",+b.dataset.sh===v)});return}
    var r=t.closest("[data-r]");if(r){ckSet(k,r.dataset.r,null);ckEditor(sec);return}
    var w=t.closest("[data-w]");if(w){var n=+w.dataset.w;ckSet(k,"wave",n||null);el.querySelectorAll("[data-w]").forEach(function(b){b.classList.toggle("on",+b.dataset.w===n)})}})}
document.addEventListener("click",function(e){var h=e.target.closest&&e.target.closest(".ck-ch");if(!h||!ckAdm())return;var sec=h.closest(".op-cat");if(!sec)return;e.preventDefault();e.stopPropagation();ckEditor(sec)},true);
document.addEventListener("keydown",function(e){if(e.key==="Escape"){var o=document.querySelector(".ck-ed");if(o)o.remove()}});

/* time + status for the playing card */
var ckLast=null;
function ckLoop(){var b=document.querySelector("#opMag .pv>button.on"),a=CK_AUDIO;
  if(ckLast&&ckLast!==b){var t0=ckLast.querySelector(".ck-ts");if(t0){t0.lastChild.textContent="STATUS: > IDLE";var d0=CK_DUR[ckLast.dataset.src];t0.firstChild.textContent="0:00 / "+ckFmt(d0||0)}ckLast=null}
  if(b&&a){var ts=b.querySelector(".ck-ts");if(ts){var d=a.duration||CK_DUR[b.dataset.src]||0;ts.firstChild.textContent=ckFmt(a.currentTime)+" / "+ckFmt(d);ts.lastChild.textContent="STATUS: > "+(a.paused?"PAUSED":"PLAYING");ckLast=b}}
  requestAnimationFrame(ckLoop)}
var ckT=0;function ckSoon(){clearTimeout(ckT);ckT=setTimeout(ckScan,120)}
if(window.MutationObserver)new MutationObserver(ckSoon).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
setInterval(ckScan,1500);document.addEventListener("DOMContentLoaded",ckSoon);requestAnimationFrame(ckLoop);

})();
