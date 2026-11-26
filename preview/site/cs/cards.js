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
function ckShapeFor(k){var g=ckGroup(k);if(g)return CK_SHAPE[g];var h=0,s=String(k||"").toUpperCase();for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return CK_EXTRA[h%CK_EXTRA.length]}
window.CK_CATSHAPE={group:CK_GROUP,shapes:CK_SHAPE,extra:CK_EXTRA,shapeFor:ckShapeFor};

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
  fs=7+(+btn.dataset.ck||0)*13;var fn=ckShapeFor(btn.dataset.ckcat);f.innerHTML='<path d="'+fn(w,h)+'"/>'}
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
  de.classList.add("ck-cards");secs.forEach(ckSection)}finally{ckBusy=0}}
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
