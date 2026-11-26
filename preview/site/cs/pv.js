/* COREKULT product page PREVIEW stack (Eman 26 Nov): 3 sounds of the pack on 3 rows, played together.
   Press a waveform or PREVIEW = all three. Press a name tag = only that sound. OPIUM 2 look only. */
(function(){
  if(window.CS_NOPV)return;
  var PUR="#E4FF3A",PURL="#fbffe6";
  var ctx=null,tracks=[],sec=null,btnEl=null,state={playing:false,solo:-1,t0:0},raf=0,ready=false,srcs=[];
  function pid(){return window.CS_PACK||decodeURIComponent(location.pathname.split("/")[2]||new URLSearchParams(location.search).get("id")||"")}
  function kindOf(s){return String(s.name).split(/\s+/)[0].toUpperCase()}
  function nameOf(s){var w=String(s.name).split(/\s+/);return w.length>1?w.slice(1).join(" "):s.name}
  function absu(u){return !u||/^(https?:|data:|\/)/.test(u)?u:"/"+u}
  /* pick 3: the biggest group of sounds with the same tempo/key, three different kinds when possible (random for now) */
  function pick(list){
    var L=list.filter(function(s){return s&&s.file&&!s.hidden});if(L.length<3)return null;
    var g={};L.forEach(function(s){(g[s.meta||""]=g[s.meta||""]||[]).push(s)});
    var keys=Object.keys(g).sort(function(a,b){
      var ka=new Set(g[a].map(kindOf)).size,kb=new Set(g[b].map(kindOf)).size;
      return (Math.min(kb,3)-Math.min(ka,3))||(g[b].length-g[a].length)});
    var pool=g[keys[0]];if(pool.length<3)pool=L;
    var seed=0,id=pid();for(var i=0;i<id.length;i++)seed=(seed*31+id.charCodeAt(i))%9973;
    var rnd=function(){seed=(seed*16807+11)%2147483647;return seed/2147483647};
    var sh=pool.slice().sort(function(){return rnd()-.5}),out=[],used={};
    sh.forEach(function(s){var k=kindOf(s);if(out.length<3&&!used[k]){used[k]=1;out.push(s)}});
    sh.forEach(function(s){if(out.length<3&&out.indexOf(s)<0)out.push(s)});
    var order=["LEAD","KEYS","PLUCK","ARP","CHIP","PAD","BASS","808"];
    out.sort(function(a,b){var x=order.indexOf(kindOf(a)),y=order.indexOf(kindOf(b));return (x<0?5:x)-(y<0?5:y)});
    return out;
  }
  function peaksOf(s){return s.wd?[].slice.call(s.wd).map(function(c){return parseInt(c,36)/35}):null}
  function fromBuf(buf){
    var d=buf.getChannelData(0),n=240,step=Math.floor(d.length/n)||1,o=[],mx=0;
    for(var i=0;i<n;i++){var m=0;for(var j=i*step;j<Math.min(d.length,(i+1)*step);j+=8){var v=Math.abs(d[j]);if(v>m)m=v}o.push(m);if(m>mx)mx=m}
    return o.map(function(v){return mx?v/mx:0});
  }
  function ac(){if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();return ctx}
  function load(i){
    var t=tracks[i];if(t.buf)return Promise.resolve();if(t.p)return t.p;
    t.p=fetch(t.src).then(function(r){return r.arrayBuffer()}).then(function(b){return new Promise(function(ok,bad){ac().decodeAudioData(b,ok,bad)})}).then(function(buf){t.buf=buf;t.dur=buf.duration;if(!t.pk)t.pk=fromBuf(buf);draw(i,0)});
    return t.p;
  }
  function draw(i,pos){
    var t=tracks[i],cv=t.cv,w=cv.clientWidth,h=cv.clientHeight;if(!w||!h||!t.pk)return;
    var dpr=window.devicePixelRatio||1;if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
    var g=cv.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    var pitch=3,n=Math.floor((w-24)/pitch),x0=12,mid=h/2;
    for(var k=0;k<n;k++){
      var f=k/n,pi=Math.min(t.pk.length-1,Math.floor(f*t.pk.length)),a=Math.max(.06,Math.pow(t.pk[pi],.8))*(h*.42);
      g.fillStyle=(pos>0&&f<pos)?PURL:PUR;g.fillRect(x0+k*pitch,mid-a,2,a*2);
    }
  }
  function stopSrc(){srcs.forEach(function(s){try{s.stop()}catch(e){}});srcs=[]}
  function gains(){
    tracks.forEach(function(t,i){if(t.gain)t.gain.gain.setTargetAtTime(state.solo<0||state.solo===i?1:0,ctx.currentTime,.015)});
  }
  function othersOff(){
    try{if(typeof audio!=="undefined"&&audio&&audio.pause)audio.pause()}catch(e){}
    try{if(typeof stopCur==="function")stopCur()}catch(e){}
    document.querySelectorAll("audio").forEach(function(a){try{a.pause()}catch(e){}});
  }
  function start(solo){
    othersOff();state.solo=solo;paint();
    Promise.all(tracks.map(function(t,i){return load(i)})).then(function(){
      stopSrc();var c=ac();if(c.resume)c.resume();state.t0=c.currentTime+.05;
      tracks.forEach(function(t,i){
        var s=c.createBufferSource();s.buffer=t.buf;s.loop=true;t.gain=c.createGain();t.gain.gain.value=state.solo<0||state.solo===i?1:0;
        s.connect(t.gain);t.gain.connect(c.destination);s.start(state.t0);srcs.push(s);
      });
      state.playing=true;paint();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
    }).catch(function(){state.playing=false;paint()});
  }
  function pause(){stopSrc();state.playing=false;state.solo=-1;cancelAnimationFrame(raf);paint();tracks.forEach(function(t,i){t.line.style.transform="translateX(0)";t.line.style.opacity=0;draw(i,0)})}
  function frame(){
    if(!state.playing)return;
    var el=Math.max(0,ctx.currentTime-state.t0);
    tracks.forEach(function(t,i){
      var pos=t.dur?((el%t.dur)/t.dur):0,w=t.cv.clientWidth;
      t.line.style.opacity=1;t.line.style.transform="translateX("+(12+pos*(w-24))+"px)";
      if(t.vis!==false)draw(i,pos);
    });
    raf=requestAnimationFrame(frame);
  }
  function paint(){
    if(!sec)return;
    sec.classList.toggle("cs-on",state.playing);
    tracks.forEach(function(t,i){
      var solo=state.solo===i;
      t.row.classList.toggle("cs-solo",solo&&state.playing);
      t.row.classList.toggle("cs-dim",state.playing&&state.solo>=0&&!solo);
    });
    if(btnEl)btnEl.firstChild.nodeValue=(state.playing?"❚❚ ":"▶ ")+"Preview";
  }
  function panelClick(){
    if(state.playing&&state.solo<0)pause();
    else if(state.playing){state.solo=-1;gains();paint()}
    else start(-1);
  }
  function tagClick(i){
    if(state.playing&&state.solo===i)pause();
    else if(state.playing){state.solo=i;gains();paint()}
    else start(i);
  }
  /* hand-drawn white arrows, one per sample (top: down-right to the wave start, middle: left to the wave end, bottom: up-left to the wave) */
  var AR='<svg class="cs-pva" viewBox="0 0 72 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">';
  var ARROW=[AR+'<path d="M6 5 C 22 3, 46 12, 62 38 M62 38 L48 35 M62 38 L60 24"/></g></svg>',
             AR+'<path d="M66 26 C 46 12, 26 12, 6 22 M6 22 L19 13 M6 22 L20 29"/></g></svg>',
             AR+'<path d="M64 42 C 40 44, 22 30, 8 8 M8 8 L7 22 M8 8 L20 15"/></g></svg>'];
  function esc(x){return String(x).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function mount(){
    if(document.getElementById("csPv")){return}
    var pk=document.getElementById("pk"),top=document.getElementById("pkTop");
    if(!pk||!top||!ready||!document.documentElement.classList.contains("opium2"))return;
    sec=document.createElement("section");sec.className="pks cs-pv";sec.id="csPv";
    var kinds=tracks.map(function(t){return t.kind}).join(" + ");
    sec.innerHTML='<div class="cs-pvh"><span class="cs-pvs">'+esc(kinds)+' · played together</span><button class="cs-pvb" type="button">▶ Preview</button></div>'+
      '<div class="cs-pvstack">'+tracks.map(function(t,i){return '<div class="cs-pvr cs-p'+i+'" data-i="'+i+'"><div class="cs-pvw" role="button" aria-label="Play all three together"><canvas></canvas><i class="cs-pvl"></i></div><button class="cs-pvtag" type="button" aria-label="Play only '+esc(t.name)+'"><span class="cs-pvk">'+esc(t.kind)+'</span> <span class="cs-pvn">'+esc(t.name)+'</span>'+ARROW[i]+'</button></div>'}).join("")+'</div>';
    top.after(sec);
    btnEl=sec.querySelector(".cs-pvb");btnEl.addEventListener("click",panelClick);
    sec.querySelectorAll(".cs-pvr").forEach(function(r,i){
      var t=tracks[i];t.row=r;t.cv=r.querySelector("canvas");t.line=r.querySelector(".cs-pvl");
      r.querySelector(".cs-pvw").addEventListener("click",panelClick);
      r.querySelector(".cs-pvtag").addEventListener("click",function(){tagClick(i)});
      draw(i,0);
    });
    new ResizeObserver(function(){tracks.forEach(function(t,i){draw(i,0)})}).observe(sec);
    if("IntersectionObserver" in window){
      new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)tracks.forEach(function(t,i){load(i).catch(function(){})});tracks.forEach(function(t){t.vis=e.isIntersecting})})},{rootMargin:"500px"}).observe(sec);
    }
  }
  /* another sound starts elsewhere on the page: ours stops */
  document.addEventListener("play",function(){if(state.playing)pause()},true);
  document.addEventListener("click",function(e){if(state.playing&&e.target.closest&&e.target.closest(".pv button"))pause()},true);
  function init(){
    fetch("/api/products").then(function(r){return r.json()}).then(function(d){
      var P=(d&&d.products)||d||[],p=P.filter(function(x){return x.id===pid()})[0];if(!p||!p.sounds||!p.sounds.length||typeof p.sounds==="number")return;
      var ch=pick(p.sounds);if(!ch)return;
      tracks=ch.map(function(s){return{src:absu(s.file),name:nameOf(s),kind:kindOf(s),pk:peaksOf(s),dur:0}});
      ready=true;mount();
      new MutationObserver(mount).observe(document.getElementById("pk"),{childList:true});
    }).catch(function(){});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
