/* Crystal Core stack test (Eman 26 Nov): ONE linked 3-track stack on top, coloured categories below with 4 sounds each + SEE ALL lightbox.
   Test page only. csMount(p) is called by crystal-test.html after the normal pack top has rendered. */
(function(){
"use strict";
var COL={LEAD:"#9b6bff",BASS:"#ff3d54",PAD:"#3b82f6",CHIP:"#2ee6a6",PLUCK:"#ffb020",KEYS:"#ff5ac8",ARP:"#22d3ee",STAB:"#ff7a2f",VOX:"#d9a0ff",TEXTURE:"#94a3b8",FX:"#94a3b8"};
var TITLE={LEAD:"Leads",BASS:"Bass",PAD:"Pads",CHIP:"Chips",PLUCK:"Plucks",KEYS:"Keys",ARP:"Arps",STAB:"Stabs",VOX:"Vox",TEXTURE:"Textures",FX:"FX"};
var ORDER=["LEAD","BASS","PAD","CHIP","PLUCK","KEYS","ARP","STAB","VOX","TEXTURE","FX"];
var SUBS={LEAD:["SOFT","SINGING","SHARP"],BASS:["SUB","MID","BITE"],PAD:["DARK","WARM","GLASS"],CHIP:["WARM","BRIGHT","SHARP"],PLUCK:["SOFT","MID","BRIGHT"]};
var STACK=["lead-prism-lantern","pad-opal-spell","bass-ghost-shard"];
var PLAYI='<svg viewBox="0 0 16 16" class="cs-pl"><path d="M4 2l10 6-10 6z"/></svg><svg viewBox="0 0 16 16" class="cs-pa"><path d="M3 2h3.5v12H3zM9.5 2H13v12H9.5z"/></svg>';
var NS=2;                      /* tiles per category on the page */
var NPER=4;
var D=null,byCat={},byFile={},waves=[],mounted=false,io=null;
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return [].slice.call((r||document).querySelectorAll(s))}
function fmt(t){t=Math.max(0,t||0);return Math.floor(t/60)+":"+("0"+Math.floor(t%60)).slice(-2)}
function pauseSite(){try{if(typeof audio!=="undefined"&&audio&&audio.pause)audio.pause()}catch(e){}}

/* ================= satisfying waveform ================= */
function Wave(host,s,col,o){
  o=o||{};this.s=s;this.col=col;this.pitch=o.pitch||5;this.mirror=true;
  var cv=document.createElement("canvas");host.appendChild(cv);this.cv=cv;this.host=host;
  this.prog=0;this.target=0;this.hx=-1;this.blooms=[];this.born=0;this.vis=false;this.dim=false;this.playing=false;this.level=0;this.dirty=true;this.cache={};
  var me=this;host._w=this;
  host.addEventListener("mousemove",function(e){var r=host.getBoundingClientRect();me.hx=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));});
  host.addEventListener("mouseleave",function(){me.hx=-1;me.dirty=true});
  waves.push(this);if(io)io.observe(host);
}
Wave.prototype.bloom=function(x){this.blooms.push({x:x,t0:performance.now()})};
Wave.prototype.setProg=function(p){p=Math.max(0,Math.min(1,p||0));if(Math.abs(p-this.target)>.5)this.prog=p;this.target=p};
Wave.prototype.bars=function(n){
  if(this.cache[n])return this.cache[n];
  var pk=this.s.pk,L=pk.length,a=[];
  for(var i=0;i<n;i++){var s0=Math.floor(i/n*L),s1=Math.max(s0+1,Math.ceil((i+1)/n*L)),m=0;for(var k=s0;k<s1&&k<L;k++)m=Math.max(m,pk[k]);a.push(m/99)}
  return this.cache[n]=a;
};
Wave.prototype.active=function(now){
  return this.vis&&(this.playing||this.hx>=0||this.blooms.length||now-this.born<900||Math.abs(this.target-this.prog)>.0004||this.dirty);
};
Wave.prototype.draw=function(now){
  var cv=this.cv,r=cv.getBoundingClientRect();if(!r.width)return;
  var dpr=Math.min(2,window.devicePixelRatio||1),W=Math.round(r.width*dpr),H=Math.round(r.height*dpr);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;this.cache={}}
  var g=cv.getContext("2d");g.clearRect(0,0,W,H);
  var pitch=this.pitch*dpr,n=Math.max(8,Math.floor(W/pitch)),bw=Math.max(1,pitch*.62),bars=this.bars(n),mid=H/2,col=this.col;
  this.prog+=(this.target-this.prog)*(Math.abs(this.target-this.prog)>.0004?.5:1);
  var p=this.prog,pi=p*n,hx=this.hx,hi=hx>=0?hx*n:-99;
  var live=[];for(var q=0;q<this.blooms.length;q++){var b=this.blooms[q];if(now-b.t0<760)live.push(b)}this.blooms=live;
  var born=now-this.born;
  var heights=new Array(n);
  for(var i=0;i<n;i++){
    var a=Math.max(.05,bars[i]);
    var t=Math.min(1,Math.max(0,(born-i*4)/340)),e=1-Math.pow(1-t,3);e*=1+.12*Math.sin(t*Math.PI);
    var m=e;
    if(hi>-90){var d=i-hi;m*=1+.5*Math.exp(-d*d/14)}
    for(var q2=0;q2<live.length;q2++){var bb=live[q2],age=(now-bb.t0)/760,d2=Math.abs(i-bb.x*n);m*=1+.8*(1-age)*Math.exp(-Math.pow((d2-age*n*.4)/3.5,2))}
    if(this.playing){var d3=i-pi;m*=1+(.18+.7*this.level)*Math.exp(-d3*d3/7)}
    heights[i]=Math.max(2*dpr,a*H*.47*m);
  }
  g.fillStyle=col;
  /* glow behind played bars */
  g.globalAlpha=.2;
  for(var i2=0;i2<n&&i2<pi;i2++){var h2=Math.min(mid,heights[i2]+4*dpr);g.fillRect(i2*pitch-1*dpr,mid-h2,bw+2*dpr,h2*2)}
  for(var i3=0;i3<n;i3++){
    var played=i3<pi,between=hi>-90&&!played&&i3<hi;
    g.globalAlpha=played?1:between?.62:(this.dim?.14:.34);
    var h3=Math.min(mid,heights[i3]);g.fillRect(i3*pitch,mid-h3,bw,h3*2);
  }
  g.globalAlpha=1;
  if(hx>=0){
    var x=hx*W;g.fillStyle="rgba(255,255,255,.55)";g.fillRect(Math.round(x),0,Math.max(1,dpr),H);
    var tx=fmt(hx*(this.s.dur||8)),fs=10*dpr;g.font="600 "+fs+"px 'JetBrains Mono',monospace";var tw=g.measureText(tx).width+10*dpr,px=Math.min(W-tw,Math.max(0,x+6*dpr));
    g.fillStyle="rgba(11,10,14,.88)";g.fillRect(px,4*dpr,tw,fs+8*dpr);g.fillStyle="#ecebf0";g.fillText(tx,px+5*dpr,4*dpr+fs+2*dpr);
  }
  this.dirty=false;
};
function loop(now){
  for(var i=0;i<waves.length;i++){var w=waves[i];if(!w.host.isConnected)continue;if(w.active(now))w.draw(now)}
  stackFrame(now);soloFrame();
  requestAnimationFrame(loop);
}
function initIO(){
  io=new IntersectionObserver(function(es){es.forEach(function(en){var w=en.target._w;if(!w)return;if(en.isIntersecting){if(!w.vis){w.vis=true;if(!w.born)w.born=performance.now()}}else w.vis=false;w.dirty=true})},{rootMargin:"60px"});
}

/* ================= single-sound player ================= */
var aud=new Audio();aud.preload="auto";var cur=null;
aud.addEventListener("ended",function(){paintPlaying()});
function paintPlaying(){
  $$(".cs2 .pbtn.cs-on,.cslb .pbtn.cs-on").forEach(function(b){b.classList.remove("cs-on")});
  $$(".cs2 .tile,.cslb .lrow").forEach(function(t){t.classList.toggle("sel",!!cur&&+t.dataset.id===cur.id)});
  if(cur&&!aud.paused)$$('.cs2 .pbtn[data-id="'+cur.id+'"],.cslb .pbtn[data-id="'+cur.id+'"]').forEach(function(b){b.classList.add("cs-on")});
}
function soloPlay(s,from){
  stackStop();pauseSite();
  if(!cur||cur.id!==s.id){cur=s;aud.src="/"+s.file;aud.currentTime=0}
  if(from!=null){try{aud.currentTime=from}catch(e){}}
  var p=aud.play();if(p&&p.catch)p.catch(function(){});paintPlaying();
}
function soloToggle(s){
  if(cur&&cur.id===s.id&&!aud.paused){aud.pause();paintPlaying();return}
  if(cur&&cur.id===s.id){soloPlay(s,null);return}
  soloPlay(s,0);
}
function waveClick(w,ev){
  var s=w.s,r=w.host.getBoundingClientRect(),x=Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width));
  w.bloom(x);
  if(!cur||cur.id!==s.id){soloPlay(s,0);return}          /* first click on an unselected sound plays from the start */
  aud.currentTime=x*(aud.duration||s.dur);                 /* selected: jump (paused: only moves the line) */
  w.setProg(x);
}
function soloFrame(){
  var p=cur&&aud.duration?aud.currentTime/aud.duration:0,pl=!!cur&&!aud.paused;
  for(var i=0;i<waves.length;i++){var w=waves[i];if(w.stack||!w.host.isConnected)continue;var mine=cur&&w.s.id===cur.id;w.setProg(mine?p:0);w.playing=mine&&pl;w.level=.35}
  if(cur){$$('.cs2 .tile[data-id="'+cur.id+'"] .el,.cslb .lrow[data-id="'+cur.id+'"] .tm').forEach(function(t){setT(t,fmt(aud.currentTime))})}
}

/* ================= stack engine ================= */
var ctx=null,tracks=[],stk={playing:false,t0:0,off:0,solo:-1,loaded:false,loading:false,dur:8.0457};
function stackLoad(){
  if(stk.loaded||stk.loading)return Promise.resolve();
  stk.loading=true;var AC=window.AudioContext||window.webkitAudioContext;ctx=ctx||new AC();
  return Promise.all(tracks.map(function(t){return fetch("/"+t.s.file).then(function(r){return r.arrayBuffer()}).then(function(b){return new Promise(function(ok,no){ctx.decodeAudioData(b,ok,no)})}).then(function(buf){t.buf=buf;stk.dur=buf.duration})})).then(function(){stk.loaded=true;stk.loading=false}).catch(function(){stk.loading=false});
}
function stackStart(off){
  tracks.forEach(function(t){
    if(t.src){try{t.src.stop()}catch(e){}}
    var s=ctx.createBufferSource();s.buffer=t.buf;s.loop=true;
    if(!t.gain){t.gain=ctx.createGain();t.an=ctx.createAnalyser();t.an.fftSize=512;t.an.smoothingTimeConstant=.6;t.gain.connect(t.an);t.an.connect(ctx.destination)}
    s.connect(t.gain);s.start(0,off%stk.dur);t.src=s;
  });
  stk.t0=ctx.currentTime-off;stk.playing=true;applySolo();paintStackPlay();
}
function stackPause(){
  if(!stk.playing)return;
  stk.off=(ctx.currentTime-stk.t0)%stk.dur;
  tracks.forEach(function(t){if(t.src){try{t.src.stop()}catch(e){}t.src=null}});
  stk.playing=false;paintStackPlay();
}
function stackStop(){if(stk.playing)stackPause()}
function stackToggle(){
  if(stk.playing){stackPause();return}
  if(cur&&!aud.paused){aud.pause();paintPlaying()}
  pauseSite();
  stackLoad().then(function(){if(!stk.loaded)return;if(ctx.state==="suspended")ctx.resume();stackStart(stk.off||0)});
}
function stackSeek(x){stk.off=x*stk.dur;if(stk.playing&&stk.loaded)stackStart(stk.off)}
function setSolo(i,force){
  stk.solo=(!force&&stk.solo===i)?-1:i;applySolo();
  if(!stk.playing)stackToggle();
}
function applySolo(){
  tracks.forEach(function(t,i){
    var on=stk.solo<0||stk.solo===i;
    if(t.gain)t.gain.gain.setTargetAtTime(on?1:0,ctx.currentTime,.015);
    t.dim=!on;t.wave.dim=!on;t.wave.dirty=true;
    t.row.classList.toggle("dim",!on);t.row.classList.toggle("solo",stk.solo===i);
    setT($(".cs-st",t.row),stk.solo===i?"SOLO":(on?"":"PAUSED"));
    $(".cs-st",t.row).style.display=(stk.solo===i||!on)?"inline":"none";
  });
  var a=$("#csChipStack"),b=$("#csChipSolo");if(a){a.classList.toggle("cs-on",stk.solo<0);b.classList.toggle("cs-on",stk.solo>=0)}
}
function paintStackPlay(){var b=$("#csPlay");if(b)b.classList.toggle("cs-on",stk.playing)}
var tb=new Uint8Array(512);
function stackFrame(){
  if(!tracks.length||!$("#csPh"))return;
  var pos=stk.playing?((ctx.currentTime-stk.t0)%stk.dur):stk.off,prog=pos/stk.dur;
  $("#csPh").style.transform="translateX("+(prog*$("#csPhw").clientWidth)+"px)";
  setT($("#csTime"),fmt(pos)+" / "+fmt(stk.dur));
  tracks.forEach(function(t){
    var lv=0;
    if(stk.playing&&t.an&&!t.dim){t.an.getByteTimeDomainData(tb);var sum=0;for(var k=0;k<512;k++){var v=(tb[k]-128)/128;sum+=v*v}lv=Math.min(1,Math.sqrt(sum/512)*5)}
    t.wave.level+=(lv-t.wave.level)*.25;t.wave.playing=stk.playing&&!t.dim;t.wave.setProg(prog);
  });
}

/* ================= build ================= */
function mkWave(host,s,col,o){var w=new Wave(host,s,col,o);host.addEventListener("click",function(e){waveClick(w,e)});return w}
function buildStack(host){
  var picks=STACK.map(function(k){return byFile["audio/cc1-"+k+".mp3"]});
  var el=document.createElement("div");el.className="stk";
  var rows="";
  picks.forEach(function(s,i){rows+='<div class="tr" data-i="'+i+'" style="--c:'+COL[s.cat]+'"><button class="cs-nm"><span class="t">'+s.cat+'</span><b>'+s.name+'</b><em>'+s.bpm+' · '+s.key+' <u class="cs-st"></u></em></button><div class="cs-wv"></div></div>'});
  el.innerHTML='<div class="cs-sh"><button class="bigplay" id="csPlay" aria-label="Play stack">'+PLAYI+'</button><h3>Crystal Core</h3><span class="cs-tag">Stack</span><span class="sp"></span><div class="chips"><button class="chip cs-on" id="csChipStack"><i></i>Stack</button><button class="chip" id="csChipSolo"><i></i>Solo</button></div><div class="time" id="csTime">0:00 / 0:08</div></div>'+
    '<div class="ruler"><div></div><div class="sc" id="csSc"><span>BAR 1</span><span>BAR 2</span><span>BAR 3</span><span>BAR 4</span></div></div>'+
    '<div class="trk"><div class="cs-grid"><i></i><i></i><i></i><i></i></div>'+rows+'<div class="phw" id="csPhw"><div class="cs-ph" id="csPh"></div></div></div>';
  host.appendChild(el);
  var rowEls=$$(".tr",el);tracks=[];stk.solo=-1;
  picks.forEach(function(s,i){
    var wv=$(".cs-wv",rowEls[i]),w=new Wave(wv,s,COL[s.cat],{pitch:6});w.stack=true;
    tracks.push({s:s,row:rowEls[i],wave:w,dim:false});
    wv.addEventListener("click",function(e){
      var r=wv.getBoundingClientRect(),x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));w.bloom(x);
      stk.off=x*stk.dur;
      if(stk.solo!==i){stk.solo=i;applySolo()}
      if(stk.playing&&stk.loaded)stackStart(stk.off);else stackToggle();   /* press a track: only that one plays, from there */
    });
    $(".cs-nm",rowEls[i]).addEventListener("click",function(){setSolo(i)});
  });
  $("#csPlay").addEventListener("click",stackToggle);
  $("#csChipStack").addEventListener("click",function(){stk.solo=-1;applySolo()});
  $("#csChipSolo").addEventListener("click",function(){if(stk.solo<0)setSolo(0,true)});
  $("#csSc").addEventListener("click",function(e){var r=this.getBoundingClientRect();var x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));tracks.forEach(function(t){t.wave.bloom(x)});stackSeek(x);if(!stk.playing)stk.off=x*stk.dur});
  applySolo();stackLoad();
}
function tileEl(s,col){
  var t=document.createElement("div");t.className="tile";t.dataset.id=s.id;t.style.setProperty("--c",col);t.tabIndex=0;
  t.innerHTML='<div class="l1"><b>'+s.name+'</b><button class="pbtn" data-id="'+s.id+'" aria-label="Play">'+PLAYI+'</button></div><div class="cs-wv"></div><div class="l2"><span>'+s.bpm+' · '+s.key+'</span><span class="el">'+fmt(s.dur)+'</span></div>';
  mkWave($(".cs-wv",t),s,col,{pitch:4.5});
  $(".pbtn",t).addEventListener("click",function(e){e.stopPropagation();soloToggle(s)});
  return t;
}
function pick(list,n){
  var L=list.slice().sort(function(a,b){return a.cen-b.cen});if(L.length<=n)return L;
  var out=[];for(var i=0;i<n;i++)out.push(L[Math.round(i*(L.length-1)/(n-1))]);return out;
}
function buildCats(host){
  ORDER.forEach(function(c){
    var list=byCat[c];if(!list||!list.length)return;
    var col=COL[c],sec=document.createElement("section");sec.className="cs-cat";sec.style.setProperty("--c",col);
    sec.innerHTML='<div class="cs-ch"><span class="nmc"><svg viewBox="0 0 16 16"><path d="M1 6h2v4H1zM5 3h2v10H5zM9 5h2v6H9zM13 7h2v2h-2z"/></svg>'+TITLE[c]+'</span><span class="cs-n">'+list.length+'</span><span class="sp"></span>'+(list.length>NPER?'<button class="cs-seeall" data-cat="'+c+'">See all '+list.length+' <svg width="12" height="9" viewBox="0 0 14 10"><path d="M0 5h12M8 1l4 4-4 4" fill="none" stroke="#ecebf0" stroke-width="2"/></svg></button>':'')+'</div><div class="cs-tiles"></div>';
    var tiles=$(".cs-tiles",sec);pick(list,NPER).forEach(function(s){tiles.appendChild(tileEl(s,col))});
    host.appendChild(sec);
  });
}

/* ================= lightbox ================= */
var lb={cat:null,sub:"ALL",list:[]};
function groups(cat){
  var L=byCat[cat].slice().sort(function(a,b){return a.cen-b.cen}),nm=SUBS[cat];
  if(!nm||L.length<6)return[{n:"ALL",l:L}];
  var out=[];nm.forEach(function(n,i){out.push({n:n,l:L.slice(Math.round(L.length*i/nm.length),Math.round(L.length*(i+1)/nm.length))})});return out;
}
function ensureLB(){
  var b=$("#csLB");if(b)return b;
  b=document.createElement("div");b.className="cslb";b.id="csLB";
  b.innerHTML='<div class="hd"><div><h3 id="csLbT"></h3><div class="cn" id="csLbC"></div></div><button class="x" id="csLbX" aria-label="Close"><svg viewBox="0 0 16 16"><path d="M2 2l12 12M14 2L2 14"/></svg></button></div><div class="tabs" id="csLbTabs"></div><div class="list" id="csLbList"></div>';
  document.body.appendChild(b);
  $("#csLbX").addEventListener("click",closeLB);
  b.addEventListener("click",function(e){if(e.target===b)closeLB()});
  return b;
}
function openLB(cat){
  var b=ensureLB();lb.cat=cat;lb.sub="ALL";b.style.setProperty("--c",COL[cat]);
  $("#csLbT").textContent=TITLE[cat];$("#csLbC").innerHTML="<b>"+byCat[cat].length+"</b>"+cat+" SOUNDS";
  b.classList.add("open");requestAnimationFrame(function(){b.classList.add("show")});
  document.documentElement.style.overflow="hidden";renderLB();
}
function closeLB(){var b=$("#csLB");if(!b)return;b.classList.remove("show");setTimeout(function(){b.classList.remove("open")},250);document.documentElement.style.overflow="";if(cur&&!aud.paused){aud.pause();paintPlaying()}}
function renderLB(){
  var G=groups(lb.cat),col=COL[lb.cat],tabs=$("#csLbTabs"),list=$("#csLbList");
  waves=waves.filter(function(w){return !w.lb});
  tabs.innerHTML="";
  if(G.length>1)["ALL"].concat(G.map(function(g){return g.n})).forEach(function(n){var c=document.createElement("button");c.className="chip"+(lb.sub===n?" cs-on":"");c.textContent=n;c.addEventListener("click",function(){lb.sub=n;renderLB()});tabs.appendChild(c)});
  list.innerHTML="";lb.list=[];
  G.forEach(function(g){
    if(lb.sub!=="ALL"&&lb.sub!==g.n)return;
    if(G.length>1){var h=document.createElement("div");h.className="gh";h.innerHTML=g.n+"<i></i><span>"+g.l.length+"</span>";list.appendChild(h)}
    var gr=document.createElement("div");gr.className="lg";
    g.l.forEach(function(s){
      lb.list.push(s);
      var r=document.createElement("div");r.className="lrow"+(cur&&cur.id===s.id?" sel":"");r.dataset.id=s.id;
      r.innerHTML='<button class="pbtn'+(cur&&cur.id===s.id&&!aud.paused?" cs-on":"")+'" data-id="'+s.id+'" aria-label="Play">'+PLAYI+'</button><div class="in"><div class="l1"><b>'+s.name+'</b><em>'+s.bpm+' · '+s.key+'</em></div><div class="cs-wv"></div></div><span class="tm">'+fmt(s.dur)+'</span>';
      var w=mkWave($(".cs-wv",r),s,col,{pitch:4.5});w.lb=true;
      $(".pbtn",r).addEventListener("click",function(){soloToggle(s)});
      gr.appendChild(r);
    });
    list.appendChild(gr);
  });
}


/* ================= new top (Eman 26 Nov): shorter right column, plain-text synths, $24, PICK 3 FOR 2 ================= */
/* per-frame text: only touch the page when the text changed, and edit the text node itself (no child-list churn, which would starve the look script) */
function setT(el,txt){if(!el)return;var n=el.firstChild;if(n&&n.nodeType===3&&el.childNodes.length===1){if(n.nodeValue!==txt)n.nodeValue=txt}else if(el.textContent!==txt)el.textContent=txt}
var IC={
 serum:'<svg viewBox="0 0 16 16"><path d="M1 8c2-6 4-6 6 0s4 6 6 0" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
 serum2:'<svg viewBox="0 0 16 16"><path d="M1 9c2-6 4-6 6 0s4 6 6 0" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12.5 2v2.5M15 2v2.5" stroke="currentColor" stroke-width="1.2"/></svg>',
 vital:'<svg viewBox="0 0 16 16"><path d="M2 3l6 10 6-10" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
 wt:'<svg viewBox="0 0 16 16"><path d="M2 3v10M5 3v10M8 3v10M11 6h4M11 9h4M11 12h4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'};
/* test page only: price shown as $24 and the sound list replaced by the stack. The shared top (buttons, boxes) is cs/top.js */
function patchTop(p){
  var top=document.getElementById("pkTop");if(!top||top.dataset.cs)return;top.dataset.cs="1";
  var st=document.createElement("style");st.textContent="#review,#opMag{display:none!important}html.opium #pkSounds{display:block!important}";document.head.appendChild(st);
  var busy=false;
  function fix(){
    if(busy)return;busy=true;
    try{
      var pki=top.querySelector(".pki");if(!pki)return;
      var price=pki.querySelector(".pbuy .price");if(price&&price.textContent.trim()!=="$24")price.textContent="$24";
      var ps=pki.querySelector(".pbuy .ps");if(ps&&ps.textContent.indexOf("$")<0)ps.textContent="$0.24 per sound";
    }finally{busy=false}
  }
  fix();
  new MutationObserver(function(){fix()}).observe(top,{childList:true,subtree:true});
  var i=document.createElement("i");i.hidden=true;document.getElementById("pk").appendChild(i);setTimeout(function(){i.remove();fix()},120);
}
function buildTopOLD(p){
  var pk=document.getElementById("pk");if(!pk||document.getElementById("csTop"))return;
  var t=document.createElement("div");t.id="csTop";t.className="cstop";
  t.innerHTML='<div class="cstc"><img class="cl l" src="/img/op/glyph-l-out.svg" alt=""><img class="cl r" src="/img/op/glyph-r-out.svg" alt=""><img class="cscd" src="/img/cs/case-fang.webp" alt="Crystal Core CD" width="520" height="520"></div>'+
   '<div class="cstr"><a class="cslogo" href="/" aria-label="COREKULT home"><img src="/img/logo-white-s.webp?v=1" alt="COREKULT" width="110" height="34"></a>'+
   '<div class="cseye">Crystal Core</div><h1>Crystal Core</h1><div class="cssub">Serum preset pack · 100+ presets</div>'+
   '<div class="csprice">$24</div>'+
   '<div class="csbuy"><button class="csadd" id="csAdd">Add to cart</button><a class="cspick" href="/bundle?trio=crystal">Pick 3 for 2 <b>$48</b> <s>$72</s></a>'+
   '<span class="cshand">pick your<br>free pack<svg width="54" height="30" viewBox="0 0 70 40"><path d="M66 6C50 6 24 12 8 34M8 34l1-13M8 34l13-6" fill="none" stroke="#E4FF3A" stroke-width="3.2" stroke-linecap="round"/></svg></span></div>'+
   '<div class="csget"><div class="cslab">Get the pack</div><p>All packs include presets for Serum, Serum 2, Vital and Ableton Wavetable.</p>'+
   '<ul><li class="s1">'+IC.serum+'Serum</li><li class="s2">'+IC.serum2+'Serum 2</li><li class="v">'+IC.vital+'Vital <small>(free synth)</small></li><li class="w">'+IC.wt+'Ableton Wavetable</li></ul></div></div>';
  pk.insertBefore(t,document.getElementById("pkTop"));
  var st=document.createElement("style");st.textContent="#review,#opMag,#pkTop .op-rv,#pkTop .rvs,#pkTop #pkStars,#pkTop .tiles,#pkTop a.trio{display:none!important}html.opium #pkSounds{display:block!important}";document.head.appendChild(st);
  document.getElementById("csAdd").addEventListener("click",function(){
    try{if(typeof addToCart==="function"){addToCart(p&&p.id||"crystal-core-i");return}}catch(e){}
    try{var c=JSON.parse(localStorage.getItem("ck-cart")||"[]");if(c.indexOf("crystal-core-i")<0)c.push("crystal-core-i");localStorage.setItem("ck-cart",JSON.stringify(c))}catch(e){}
    this.textContent="Added ✓";
  });
}

/* ================= mount ================= */
window.csMount=function(p){
  var host=document.getElementById("pkSounds");if(!host)return;
  patchTop(p);
  if(mounted){stackStop();if(!aud.paused)aud.pause();cur=null}
  waves=waves.filter(function(w){return w.host.isConnected&&false});
  host.innerHTML="";host.classList.add("cs2");
  function go(){
    D.forEach(function(s){});
    buildStack(host);buildCats(host);paintPlaying();
    if(!mounted){
      mounted=true;requestAnimationFrame(loop);
      document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".cs2 [data-cat]");if(b)openLB(b.dataset.cat)});
      document.addEventListener("keydown",function(e){
        var open=$("#csLB")&&$("#csLB").classList.contains("open");
        if(e.key==="Escape"&&open){closeLB();return}
        if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
        if(open){
          if(e.code==="Space"){e.preventDefault();if(cur)soloToggle(cur);else if(lb.list[0])soloPlay(lb.list[0],0)}
          if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();var i=lb.list.findIndex(function(s){return cur&&s.id===cur.id});i=Math.min(lb.list.length-1,Math.max(0,i+(e.key==="ArrowDown"?1:-1)));soloPlay(lb.list[i],0)}
          if(cur&&(e.key==="ArrowRight"||e.key==="ArrowLeft"))aud.currentTime=Math.max(0,aud.currentTime+(e.key==="ArrowRight"?2:-2));
        }
      });
    }
    window.__cs2={stackToggle:stackToggle,setSolo:setSolo,stk:stk,aud:aud,openLB:openLB};
  }
  if(D)go();else fetch("/cs/sounds.json").then(function(r){return r.json()}).then(function(j){D=j;D.forEach(function(s){(byCat[s.cat]=byCat[s.cat]||[]).push(s);byFile[s.file]=s});initIO();go()});
};
})();
