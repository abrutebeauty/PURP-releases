/* COREKULT product page PREVIEW stack (Eman 26 Nov): 3 sounds of the pack on 3 rows, played together.
   Press a waveform or PREVIEW = all three. Press a name tag = only that sound. OPIUM 2 look only. */
(function(){
  if(window.CS_NOPV)return;
  var PUR="#E4FF3A",PURL="#fbffe6";
  var CARD=!window.CS_NOCARDS&&!/[?&]cards=0\b/.test(location.search);
  var fmtT=function(s){s=Math.max(0,s|0);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
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
    t.p=fetch(t.src).then(function(r){return r.arrayBuffer()}).then(function(b){return new Promise(function(ok,bad){ac().decodeAudioData(b,ok,bad)})}).then(function(buf){t.buf=buf;t.dur=buf.duration;if(!t.pk)t.pk=fromBuf(buf);if(t.tm)t.tm.textContent="0:00 / "+fmtT(t.dur);draw(i,0)});
    return t.p;
  }
  function glitchBox(w,h,pk,name){
    var sd=name.split("").reduce(function(a,c){return (a*31+c.charCodeAt(0))>>>0},7)||1,rn=function(){sd=(sd+0x6D2B79F5)>>>0;var z=sd;z=Math.imul(z^z>>>15,z|1);z^=z+Math.imul(z^z>>>7,z|61);return((z^z>>>14)>>>0)/4294967296};
    var c=document.createElement("canvas");c.width=w;c.height=h;var g=c.getContext("2d"),u=Math.max(1,w/200),mid=h*.5,i,x;
    g.fillStyle="#040404";g.fillRect(0,0,w,h);
    for(i=0;i<110;i++){g.fillStyle="rgba(255,255,255,"+(.03+rn()*.14)+")";var y=rn()*h;g.fillRect(rn()*w*.9,y,(.05+rn()*.5)*w,u*(rn()<.15?2:1))}
    for(i=0;i<16;i++){g.fillStyle="rgba(255,255,255,"+(.04+rn()*.2)+")";g.fillRect(rn()*w,rn()*h*.3,u,h*(.4+rn()*.6))}
    var L=document.createElement("canvas");L.width=w;L.height=h;var l=L.getContext("2d");
    for(x=0;x<w;x+=Math.max(1,u*.8)){var fp=x/w*(pk.length-1),i0=Math.floor(fp),p0=pk[i0],p1=pk[Math.min(pk.length-1,i0+1)],e=Math.min(1,Math.pow(p0+(p1-p0)*(fp-i0),.75)*1.4),
      n=e*h*.42*(.25+.75*Math.pow(rn(),1.6)),d=e*h*.3*(.15+.85*Math.pow(rn(),2));
      l.fillStyle="rgba(255,255,255,"+(.45+rn()*.4)+")";l.fillRect(x,mid-n,u*.9,n);
      l.fillStyle="rgba(255,255,255,"+(.25+rn()*.3)+")";l.fillRect(x,mid,u*.9,d);
      if(rn()<.03){l.fillStyle="rgba(255,255,255,.5)";l.fillRect(x,mid-e*h*.46-rn()*h*.06,u*.8,e*h*.46*2*.9)}}
    /* smear: soft copy (shrink then grow) under the sharp needles */
    var S=document.createElement("canvas");S.width=Math.ceil(w/5);S.height=Math.ceil(h/5);S.getContext("2d").drawImage(L,0,0,S.width,S.height);
    g.globalAlpha=.9;g.imageSmoothingEnabled=true;g.drawImage(S,0,0,w,h);g.globalAlpha=1;g.drawImage(L,0,0);
    /* vertical stretch glitches */
    for(i=0;i<4;i++){var sx=rn()*w*.8,sw=w*(.04+rn()*.1);g.globalAlpha=.35;g.drawImage(c,sx,mid-h*.1,Math.max(2,u*2),h*.2,sx,0,sw,h);g.globalAlpha=1}
    /* centre line, broken */
    for(x=0;x<w;){var ln=(.02+rn()*.12)*w;g.fillStyle="rgba(255,255,255,"+(.5+rn()*.4)+")";g.fillRect(x,mid,ln,Math.max(1,u*.8));x+=ln+rn()*w*.015}
    /* grain */
    var im=g.getImageData(0,0,w,h),d=im.data;for(i=0;i<d.length;i+=4){var nz=(rn()-.5)*46;d[i]=Math.max(0,Math.min(255,d[i]+nz));d[i+1]=Math.max(0,Math.min(255,d[i+1]+nz));d[i+2]=Math.max(0,Math.min(255,d[i+2]+nz))}
    g.putImageData(im,0,0);return c}
  function sRng(sd){return function(){sd=(sd+0x6D2B79F5)>>>0;var z=sd;z=Math.imul(z^z>>>15,z|1);z^=z+Math.imul(z^z>>>7,z|61);return((z^z>>>14)>>>0)/4294967296}}
  function jit(rj,a){return (rj()-.5)*a}
  function frameForm(w,h,form,seed,pass){
    var rn=sRng(seed*977+7),rj=sRng(seed*31+pass*555+3),pts=[],P=18,x0=-P,y0=-P,x1=w+P,y1=h+P,k,e;
    if(form===0){ /* jagged rectangle, a few big spikes */
      var edges=[[x0,y0,x1,y0,0,-1],[x1,y0,x1,y1,1,0],[x1,y1,x0,y1,0,1],[x0,y1,x0,y0,-1,0]];
      pts.push([x0+jit(rj,9),y0+jit(rj,9)]);
      edges.forEach(function(e){var len=Math.hypot(e[2]-e[0],e[3]-e[1]),n=7,sp={},ns=rn()<.5?2:1;for(k=0;k<ns;k++)sp[1+Math.floor(rn()*(n-1))]=16+rn()*20;
        for(k=1;k<=n;k++){var f=k/n,bx=e[0]+(e[2]-e[0])*f,by=e[1]+(e[3]-e[1])*f,ux=(e[2]-e[0])/len,uy=(e[3]-e[1])/len;
          if(sp[k]){var hf=sp[k],wd=9+rn()*9;pts.push([bx-ux*wd+jit(rj,5),by-uy*wd+jit(rj,5)]);pts.push([bx+e[4]*hf+jit(rj,7),by+e[5]*hf+jit(rj,7)]);pts.push([bx+ux*wd+jit(rj,5),by+uy*wd+jit(rj,5)])}
          else pts.push([bx+jit(rj,10),by+jit(rj,10)])}});
    }else if(form===1){ /* burst: round-ish with many short spikes */
      var cx=w/2,cy=h/2,N=15+Math.floor(rn()*4);
      for(k=0;k<N*2;k++){var ang=k/(N*2)*6.283+jit(rj,.12),sp2=k%2?1:0,rr=sp2?1.0:1.0,
        rx=(w/2+P)*(sp2?1.0:1.0),ry=(h/2+P)*1.0,m=Math.pow(Math.abs(Math.cos(ang)),.35)*Math.sign(Math.cos(ang)),n2=Math.pow(Math.abs(Math.sin(ang)),.35)*Math.sign(Math.sin(ang)),
        ext=sp2?(9+rn()*16):jit(rj,6);pts.push([cx+m*rx*1.02+Math.cos(ang)*ext+jit(rj,5),cy+n2*ry*1.02+Math.sin(ang)*ext+jit(rj,5)])}
    }else{ /* tilted torn sheet: slanted, chipped corner, one long spike */
      var cx2=w/2,cy2=h/2,th=-.05+rn()*.1,cs=Math.cos(th),sn=Math.sin(th),loc=[[x0,y0],[x0+w*.35,y0-6],[x0+w*.52,y0-26-rn()*14],[x0+w*.6,y0-4],[x1,y0+4],[x1+10,y0+h*.4],[x1+jit(rj,4),y1-24],[x1-26,y1+8],[x1-w*.4,y1+4],[x1-w*.5,y1+30+rn()*14],[x1-w*.56,y1+2],[x0+14,y1+10],[x0-6,y1-h*.3],[x0-26-rn()*12,y0+h*.45],[x0-4,y0+h*.2]];
      loc.forEach(function(p){var dx=p[0]-cx2,dy=p[1]-cy2;pts.push([cx2+dx*cs-dy*sn+jit(rj,7),cy2+dx*sn+dy*cs+jit(rj,7)])})}
    return pts}
  function ptsPath(p,over){var d="M"+p.map(function(q){return q[0].toFixed(1)+","+q[1].toFixed(1)}).join(" L");if(over)d+=" L"+(p[0][0]+over).toFixed(1)+","+(p[0][1]+over*.6).toFixed(1);return d}
  function spikyFrame(w,h,seed,form){
    var out="",cfg=[[3.2,1,0],[1.8,.85,5],[1.1,.65,-6]];
    cfg.forEach(function(c,pass){out+='<path d="'+ptsPath(frameForm(w,h,form,seed,pass),pass?c[2]:0)+(pass?"":" Z")+'" fill="none" stroke="#d42a24" stroke-width="'+c[0]+'" stroke-linejoin="round" stroke-linecap="round" opacity="'+c[1]+'"'+(pass===2?' stroke-dasharray="46 7 20 11"':'')+'/>'});
    return '<g filter="url(#csRough)">'+out+'</g>'}
  function strokeTo(a,b,c,d,seed){var rn=sRng(seed*13+1),mx=(a+c)/2+(rn()-.5)*60,my=(b+d)/2+(rn()-.5)*60;
    return '<path d="M'+a.toFixed(1)+','+b.toFixed(1)+' Q'+mx.toFixed(1)+','+my.toFixed(1)+' '+c.toFixed(1)+','+d.toFixed(1)+'" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'+
      '<path d="M'+(a+1.5).toFixed(1)+','+(b+1).toFixed(1)+' Q'+(mx+2).toFixed(1)+','+(my-1).toFixed(1)+' '+(c+1).toFixed(1)+','+(d+1.5).toFixed(1)+'" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>'}
  function links(){var st=sec.querySelector(".cs-pvstack");if(!st)return;var rs=[].slice.call(st.querySelectorAll(".cs-pvr")),bx=rs.map(function(r){return {x:r.offsetLeft,y:r.offsetTop,w:r.offsetWidth,h:r.offsetHeight}});if(bx.some(function(b){return !b.w}))return;
    var k=bx.map(function(b){return b.x+","+b.y+","+b.w}).join("|"),L=st.querySelector(".cs-pvk");if(!L){L=document.createElementNS("http://www.w3.org/2000/svg","svg");L.setAttribute("class","cs-pvk");L.setAttribute("style","position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:0");L.innerHTML='<defs><filter id="csRough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="4.5"/></filter></defs><g class="cs-pvkg"></g>';st.insertBefore(L,st.firstChild)}
    if(L.__k===k)return;L.__k=k;var G=L.querySelector(".cs-pvkg"),M=26,
      A=[[bx[0].x+bx[0].w+M,bx[0].y+bx[0].h*.55,bx[1].x-M,bx[1].y+bx[1].h*.3],[bx[1].x+bx[1].w+M,bx[1].y+bx[1].h*.45,bx[2].x-M,bx[2].y+bx[2].h*.62],[bx[0].x+bx[0].w+M,bx[0].y+bx[0].h*.12,bx[2].x-M,bx[2].y+bx[2].h*.1]],o="";
    A.forEach(function(l,i){var rn=sRng(i*71+9),mx=(l[0]+l[2])/2+(rn()-.5)*50,my=(l[1]+l[3])/2+(rn()-.5)*(i===2?-90:70);
      [[2.8,1,0],[1.3,.7,3]].forEach(function(c){o+='<path d="M'+(l[0]+c[2]*.4)+','+(l[1]+c[2]*.3)+' Q'+(mx+c[2])+','+(my-c[2])+' '+(l[2]+c[2]*.3)+','+(l[3]-c[2]*.2)+'" fill="none" stroke="#d42a24" stroke-width="'+c[0]+'" stroke-linecap="round" opacity="'+c[1]+'"/>'});
      [[l[0],l[1]],[l[2],l[3]]].forEach(function(p){o+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="6.5" fill="#d42a24"/><circle cx="'+(p[0]+1)+'" cy="'+(p[1]-1)+'" r="11" fill="none" stroke="#d42a24" stroke-width="1.4" opacity=".7"/>'})});
    G.setAttribute("filter","url(#csRough)");G.innerHTML=o}
  function scribbles(){if(CARD||!window.CS_BOX||!sec)return;links();
    sec.querySelectorAll(".cs-pvr").forEach(function(r,i){var bx=r.querySelector(".cs-pvw");if(!bx)return;var w=bx.clientWidth,h=bx.clientHeight;if(!w||!h)return;
      var o=r.querySelector(".cs-pvo"),s=r.querySelector(".cs-pvs");if(!o){o=document.createElementNS("http://www.w3.org/2000/svg","svg");o.setAttribute("class","cs-pvo");r.insertBefore(o,r.firstChild);s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("class","cs-pvs");r.appendChild(s)}
      var k=w+"x"+h;if(o.__k===k)return;o.__k=k;
      o.setAttribute("style","position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:0");o.innerHTML=spikyFrame(w,h,i+3,i);
      s.setAttribute("style","position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:2");
      var tg=r.querySelector(".cs-pvtag"),tx=tg.offsetLeft,ty=tg.offsetTop,tw=tg.offsetWidth,th=tg.offsetHeight,a,b,c,d;
      if(i===1){a=tx+tw*.4;b=ty+th+4;c=w*.34;d=-P2+4}else{a=tx+tw*.35;b=ty-4;c=w*(i===0?.3:.6);d=h-6}
      if(i===1){/* label above: stroke runs down into the box */a=tx+tw*.4;b=ty+th+4;c=w*.34;d=h*.12}
      s.innerHTML=strokeTo(a,b,c,d,i+1)})}
  var P2=0;
  function draw(i,pos){
    var t=tracks[i],cv=t.cv,w=cv.clientWidth,h=cv.clientHeight;if(!w||!h||!t.pk)return;
    var dpr=window.devicePixelRatio||1;if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
    var g=cv.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    if(CARD){
      var cn=Math.floor(w/3),cm=h/2,cy2=pos>0;
      for(var q=0;q<cn;q++){var ff=q/cn,pj=Math.min(t.pk.length-1,Math.floor(ff*t.pk.length)),aa=Math.max(.05,Math.pow(t.pk[pj],.8))*(h*.46);
        g.fillStyle=(cy2&&ff>=pos)?"#6f6e77":"#ffffff";g.fillRect(q*3,cm-aa,2,aa*2)}
      return}
    if(window.CS_BOX){
      var pw=cv.width,ph=cv.height,gk=pw+"x"+ph+"x"+t.pk.length;
      if(t.gk!==gk){t.gk=gk;t.gl=glitchBox(pw,ph,t.pk,t.name||"x")}
      g.setTransform(1,0,0,1,0,0);g.drawImage(t.gl,0,0);
      var cx=pw*pos;
      if(pos>0){g.fillStyle="rgba(0,0,0,.5)";g.fillRect(cx,0,pw-cx,ph);
        g.fillStyle="#fff";g.fillRect(Math.round(cx),0,Math.max(1,Math.round(pw/160)),ph);
        for(var z=0;z<7;z++){var yy=Math.random()*ph,xx=Math.max(0,cx-Math.random()*pw*.5),ll=Math.random()*pw*.4;g.fillStyle="rgba(255,255,255,"+(.08+Math.random()*.18)+")";g.fillRect(xx,yy,ll,Math.max(1,pw/260))}}
      else{var r=Math.max(10,pw*.07),sx=pw*.07,sy=ph*.9;g.fillStyle="rgba(255,255,255,.9)";g.beginPath();g.moveTo(sx,sy-r);g.lineTo(sx+r*1.5,sy);g.lineTo(sx,sy+r);g.closePath();g.fill()}
      return}
    if(window.csRibbon){
      var N=Math.max(40,Math.floor(w/3)),am=[];
      for(var k=0;k<N;k++){var pi=Math.min(t.pk.length-1,Math.floor(k/N*t.pk.length));am.push(Math.max(.1,Math.pow(t.pk[pi],.8)))}
      window.csRibbon(g,w,h,am,"");
      if(pos>0){g.save();g.beginPath();g.rect(0,0,w*pos,h);g.clip();window.csRibbon(g,w,h,am,"played");g.restore()}
      return}
    var pitch=3,n=Math.floor((w-24)/pitch),x0=12,mid=h/2;
    for(var k2=0;k2<n;k2++){
      var f=k2/n,pi2=Math.min(t.pk.length-1,Math.floor(f*t.pk.length)),a=Math.max(.06,Math.pow(t.pk[pi2],.8))*(h*.42);
      g.fillStyle=(pos>0&&f<pos)?PURL:PUR;g.fillRect(x0+k2*pitch,mid-a,2,a*2);
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
        s.connect(t.gain);t.gain.connect(c.destination);if(window.CS_BOX&&window.csBox){t.an=t.an||c.createAnalyser();t.an.fftSize=1024;t.an.smoothingTimeConstant=.6;t.gain.connect(t.an);t.rd=t.rd||window.csBox.reader(t.an)}s.start(state.t0);srcs.push(s);
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
      t.line.style.opacity=1;t.line.style.transform="translateX("+(CARD?pos*w:12+pos*(w-24))+"px)";if(t.tm)t.tm.textContent=fmtT((el%(t.dur||1)))+" / "+fmtT(t.dur);
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
    if(CARD){sec.classList.toggle("cs-pcon",state.playing);var st=sec.querySelector(".pc-st");if(st)st.textContent="STATUS: > "+(state.playing?(state.solo>=0?"PLAYING 1 OF 3":"PLAYING ALL 3"):"IDLE")}
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
  /* rough hand-drawn red outline behind the stack, with thorns up and down (like the claws behind the CD) */
  var FRAME='<svg class="cs-pvfx" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true"><path d="M72.4,86.4 Q91.7,85.7 107.2,86.8 Q122.8,83.4 142.8,82.5 Q145.2,83.9 144.1,88.0 Q153.4,67.7 164.6,48.4 Q168.8,26.6 174.0,5.9 Q180.5,27.8 182.0,53.9 Q186.3,71.5 196.6,83.9 Q203.0,89.3 204.8,88.9 Q221.1,91.1 238.1,87.9 Q258.1,83.6 273.0,82.5 Q291.8,86.6 307.5,86.7 Q324.2,84.6 338.8,82.2 Q356.2,83.1 376.2,85.8 Q391.1,84.8 409.3,89.0 Q426.8,87.9 443.3,89.4 Q461.2,86.2 475.4,88.4 Q480.5,89.7 480.8,88.6 Q494.6,73.6 503.3,53.9 Q506.8,36.8 505.5,18.9 Q508.7,40.5 517.8,59.2 Q522.7,70.8 531.5,84.8 Q536.3,85.1 539.0,85.1 Q555.1,88.5 572.1,86.7 Q590.5,87.0 607.5,89.2 Q623.3,91.5 642.1,89.4 Q659.5,91.4 677.1,89.9 Q692.7,84.8 710.0,83.3 Q727.8,88.4 745.2,89.7 Q760.3,89.9 779.4,86.6 Q798.4,87.0 812.3,83.7 Q814.2,82.1 812.3,86.4 Q821.8,67.7 829.7,44.7 Q831.4,21.9 838.4,2.0 Q839.1,27.8 842.5,53.4 Q851.1,68.5 860.6,83.9 Q865.9,83.0 867.8,88.2 Q883.8,83.0 905.2,82.4 Q925.7,87.2 950.7,97.3 Q957.3,113.3 958.2,125.0 Q956.5,148.9 959.8,172.9 Q956.8,193.8 956.1,217.0 Q954.2,237.1 954.1,255.5 Q956.1,276.5 957.0,299.2 Q949.7,311.3 946.2,325.4 Q934.2,330.7 926.7,335.2 Q928.2,337.0 927.2,340.2 Q915.0,357.0 907.9,377.7 Q905.5,399.2 904.6,419.5 Q901.4,394.5 894.8,370.9 Q889.0,355.5 879.6,338.6 Q875.1,338.0 871.4,339.0 Q855.5,339.7 839.6,338.1 Q820.6,340.1 802.6,339.8 Q784.8,336.6 767.4,336.4 Q752.9,338.5 737.9,338.2 Q717.0,335.7 701.3,334.1 Q683.4,338.6 666.5,338.6 Q650.9,338.0 630.1,338.9 Q617.3,338.4 599.8,334.5 Q581.4,335.9 565.8,337.7 Q546.7,339.2 532.1,336.8 Q516.1,340.7 498.2,339.9 Q480.9,338.2 460.1,334.5 Q446.5,338.5 430.1,341.7 Q409.4,340.2 393.5,337.7 Q374.6,335.0 361.6,336.6 Q345.5,333.8 326.2,336.5 Q317.4,335.1 313.5,338.6 Q305.4,353.1 292.8,371.5 Q288.1,393.8 289.1,412.1 Q282.5,393.0 280.4,369.8 Q272.9,355.1 263.2,336.3 Q263.2,336.6 257.8,335.9 Q240.8,333.9 220.1,337.5 Q206.3,336.2 189.2,334.8 Q172.4,333.4 152.9,336.7 Q139.0,339.7 122.0,337.5 Q102.4,335.4 88.1,335.4 Q68.0,332.1 47.0,324.9 Q45.9,307.4 47.8,293.7 Q43.0,271.4 41.3,247.7 Q44.3,225.3 44.3,204.1 Q44.9,183.5 47.1,164.0 Q43.1,139.9 40.8,116.7 Q44.8,108.8 53.8,100.9" fill="none" stroke="#B92520" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><path d="M73.7,86.5 Q91.2,87.2 110.5,85.7 Q128.7,88.4 142.0,86.7 Q142.9,88.1 144.7,86.1 Q157.9,69.4 166.8,51.8 Q169.3,27.8 170.4,5.2 Q174.5,31.2 177.5,55.9 Q184.6,70.4 196.8,83.3 Q204.8,88.8 206.9,89.7 Q224.3,87.7 238.9,86.9 Q255.8,85.0 269.9,82.1 Q287.7,84.3 306.2,82.5 Q319.7,84.7 338.1,83.9 Q351.8,85.4 371.2,85.7 Q389.3,85.6 407.6,88.7 Q426.1,87.9 442.1,87.1 Q459.7,89.7 476.0,87.3 Q476.9,83.1 480.8,84.7 Q491.2,73.0 504.0,59.3 Q504.4,38.1 508.4,20.8 Q513.6,40.4 513.9,58.0 Q521.7,73.1 530.2,83.4 Q534.3,85.3 540.6,85.2 Q556.0,84.7 575.1,85.1 Q594.2,89.4 609.7,88.8 Q626.2,85.5 638.0,83.7 Q658.2,83.6 677.5,85.8 Q692.5,85.4 711.9,85.2 Q728.2,88.2 740.4,87.0 Q760.8,88.3 778.7,84.2 Q792.3,82.4 808.5,84.7 Q810.4,84.8 812.9,87.5 Q819.1,66.1 828.7,45.8 Q832.8,22.0 835.4,-1.8 Q840.0,26.0 846.8,49.7 Q856.9,67.4 861.2,85.7 Q861.6,84.0 867.1,87.9 Q886.2,84.8 900.8,87.1 Q925.5,93.8 947.7,99.5 Q949.3,113.8 953.1,124.6 Q954.0,146.0 960.7,171.8 Q957.1,191.2 954.0,216.3 Q955.6,235.3 953.1,257.4 Q954.2,277.4 959.5,302.9 Q953.3,315.6 945.6,328.9 Q935.7,333.4 924.3,336.1 Q929.0,339.3 930.1,337.0 Q920.0,352.9 907.8,372.3 Q904.4,394.4 901.4,420.3 Q894.5,395.7 893.5,371.4 Q887.3,352.6 878.5,337.7 Q874.8,336.9 873.8,337.9 Q856.8,339.5 837.4,340.9 Q820.0,339.6 801.1,335.2 Q785.6,339.6 771.5,340.5 Q754.9,335.6 733.5,335.5 Q720.6,339.9 702.4,341.5 Q681.6,341.3 665.2,341.6 Q651.0,342.7 635.3,338.8 Q616.2,337.2 598.5,334.8 Q582.7,340.0 562.2,341.7 Q548.5,340.5 529.4,339.6 Q513.4,338.3 495.5,340.6 Q480.9,340.4 463.6,336.3 Q446.2,339.4 427.1,339.8 Q408.0,340.2 392.4,335.8 Q379.8,341.2 361.4,340.8 Q344.7,340.3 327.7,336.2 Q320.6,338.7 315.7,336.2 Q305.5,352.6 291.1,370.8 Q286.9,391.2 287.8,412.2 Q283.2,391.5 278.1,367.6 Q271.1,348.9 264.3,335.8 Q261.6,335.8 255.2,341.1 Q241.8,338.2 224.9,339.3 Q206.0,340.7 189.1,338.7 Q168.3,334.4 151.8,334.3 Q134.6,339.1 117.1,341.3 Q104.2,342.6 87.2,341.7 Q68.8,333.2 45.1,324.8 Q47.2,307.6 43.8,295.4 Q41.3,274.3 42.2,253.0 Q39.7,231.0 39.8,206.3 Q43.9,185.5 46.4,164.4 Q48.4,142.2 46.4,119.2 Q48.9,110.1 53.8,102.5" fill="none" stroke="#B92520" stroke-width="1.3" stroke-linejoin="round" opacity=".55" vector-effect="non-scaling-stroke"/></svg>';
  /* "PREVIEW PACK" in messy kid-like white handwriting with a long drawn arrow down to the waves; a drawing, but a press on it plays all three */
  function HEAD(){
    return '<button class="cs-pvhead" type="button" aria-label="Play all three together"><span class="cs-pvht">'+drawText('PREVIEW PACK',30,{wobble:1.1,rot:7,base:1.6,sw:2.6})+'</span>'+
      '<svg class="cs-pvha" viewBox="0 0 110 220" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 C 6 72 10 102 42 108 C 82 114 98 140 86 198 M86 198 L70 174 M86 198 L102 176"/></g></svg></button>';
  }

/* hand-drawn stroke alphabet (thin, wobbly white lines, like the PICK YOUR FREE PACK writing): letters are drawn paths, not a font */
var HG={"A":[[[0,14],[4.5,0],[9,14]],[[2,9],[7,9]]],"B":[[[0,14],[0,0],[5,0],[8,1.5],[8,5],[5,7],[0,7]],[[5,7],[9,8.5],[9,12],[6,14],[0,14]]],"C":[[[9,2.5],[6,0.3],[3,0.5],[0.5,4],[0.5,10],[3,13.5],[6,13.7],[9,11.5]]],"D":[[[0,0],[0,14],[4,14],[8,11.5],[9,7],[8,2.5],[4,0],[0,0]]],"E":[[[9,0],[0,0],[0,14],[9,14]],[[0,7],[6,7]]],"F":[[[9,0],[0,0],[0,14]],[[0,7],[6,7]]],"G":[[[9,2.5],[6,0.3],[3,0.5],[0.5,4],[0.5,10],[3,13.5],[6,13.7],[9,11],[9,8],[5,8]]],"H":[[[0,0],[0,14]],[[9,0],[9,14]],[[0,7],[9,7]]],"I":[[[0,0],[0,14]]],"J":[[[7,0],[7,10],[5.5,13.5],[2.5,13.8],[0.5,11]]],"K":[[[0,0],[0,14]],[[9,0],[0,8]],[[3,6],[9,14]]],"L":[[[0,0],[0,14],[8,14]]],"M":[[[0,14],[0,0],[4.5,9],[9,0],[9,14]]],"N":[[[0,14],[0,0],[9,14],[9,0]]],"O":[[[4.5,0],[1.5,2],[0,7],[1.5,12],[4.5,14],[7.5,12],[9,7],[7.5,2],[4.5,0]]],"P":[[[0,14],[0,0],[5,0],[8,1.5],[8.5,4.5],[7,7],[4,8],[0,8]]],"Q":[[[4.5,0],[1.5,2],[0,7],[1.5,12],[4.5,14],[7.5,12],[9,7],[7.5,2],[4.5,0]],[[5,10],[9.5,14.5]]],"R":[[[0,14],[0,0],[5,0],[8,1.5],[8.5,4.5],[7,7],[4,8],[0,8]],[[4,8],[9,14]]],"S":[[[8.5,2],[6,0.3],[3,0.5],[1,2.5],[1.5,5],[4.5,7],[7.5,9],[8.5,11.5],[6.5,13.6],[3,13.8],[0.5,12]]],"T":[[[0,0],[9,0]],[[4.5,0],[4.5,14]]],"U":[[[0,0],[0,10],[2,13.5],[4.5,14],[7,13.5],[9,10],[9,0]]],"V":[[[0,0],[4.5,14],[9,0]]],"W":[[[0,0],[2.5,14],[4.5,5],[6.5,14],[9,0]]],"X":[[[0,0],[9,14]],[[9,0],[0,14]]],"Y":[[[0,0],[4.5,7]],[[9,0],[4.5,7],[4.5,14]]],"Z":[[[0,0],[9,0],[0,14],[9,14]]],"0":[[[4.5,0],[1.5,2],[0,7],[1.5,12],[4.5,14],[7.5,12],[9,7],[7.5,2],[4.5,0]]],"1":[[[1,3],[4,0],[4,14]]],"2":[[[0.5,3],[3,0.3],[6.5,0.5],[8.5,3.5],[7,7],[0.5,14],[9,14]]],"3":[[[0.5,1],[4,0],[8,1.5],[8,5],[4,7],[8.5,8.5],[8.5,12],[5,14],[0.5,13]]],"4":[[[7,14],[7,0],[0,10],[9.5,10]]],"5":[[[8.5,0],[1.5,0],[1,6.5],[5,6],[8.5,8],[8.5,12],[5,14],[0.5,13]]],"6":[[[8,1],[4,0],[1,4],[0.5,10],[2.5,13.5],[5.5,13.8],[8.5,11],[8,8],[5,6.5],[1.5,8.5]]],"7":[[[0,0],[9,0],[3.5,14]]],"8":[[[4.5,7],[1.5,5.5],[1.5,2],[4.5,0],[7.5,2],[7.5,5.5],[4.5,7]],[[4.5,7],[0.5,9],[0.5,12],[4.5,14],[8.5,12],[8.5,9],[4.5,7]]],"9":[[[1,13],[5,14],[8,10],[8.5,4],[6.5,0.5],[3.5,0.2],[0.5,3],[1,6],[4,7.5],[7.5,5.5]]],"-":[[[0,8],[6,8]]],"'":[[[1,0],[0,4]]],".":[[[0,13.4],[0.3,14]]],",":[[[1,13],[0,16]]],"!":[[[0,0],[0.2,10]],[[0,13.2],[0.2,14]]],"?":[[[0,3],[2,0.3],[6,0.5],[7,3.5],[4,7],[3.5,10]],[[3.5,13.2],[3.7,14]]],"&":[[[9,14],[2,5],[2,1.5],[5,0],[7,2],[2,9],[2,12.5],[5,14],[9,9]]]},HW={"I":0,"1":4,".":0,",":1,"'":1,"!":0,"?":7,"-":6};
function drawText(str,cap,o){
  o=o||{};str=String(str).toUpperCase();var s=cap/14,wob=o.wobble==null?.55:o.wobble,rot=o.rot==null?3:o.rot,base=o.base==null?.6:o.base,sw=o.sw||2.2;
  var seed=0,i;for(i=0;i<str.length;i++)seed=(seed*31+str.charCodeAt(i))%99991;
  var rnd=function(){seed=(seed*16807+13)%2147483647;return seed/2147483647-.5};
  var words=str.split(" "),lines=[[]],cw=0,maxW=(o.max||1e9)/s,adv=function(w){return w+4};
  var wlen=function(w){var t=0;for(var k=0;k<w.length;k++){var g=w[k];t+=adv(HW[g]==null?9:HW[g])}return t};
  words.forEach(function(w){var l=wlen(w);if(cw>0&&cw+l+7>maxW){lines.push([]);cw=0}lines[lines.length-1].push(w);cw+=l+7});
  var out="",y0=0,lh=21,maxLine=0;
  lines.forEach(function(ws,li){
    var x=0;
    ws.forEach(function(w,wi){
      for(var k=0;k<w.length;k++){
        var g=w[k],st=HG[g];if(st){
          var a=rnd()*rot*Math.PI/90,dy=y0+rnd()*2*base,sx=1+rnd()*.12,ca=Math.cos(a),sa=Math.sin(a),
          cx=(HW[g]==null?9:HW[g])/2,cy=7;
          st.forEach(function(p){
            out+="<path d=\"M"+p.map(function(q,qi){
              var px=(q[0]-cx)*sx,py=q[1]-cy,rx=px*ca-py*sa+cx,ry=px*sa+py*ca+cy;
              return (qi?"L":"")+(x+rx+rnd()*wob).toFixed(1)+","+(dy+ry+rnd()*wob).toFixed(1)}).join(" ")+"\"/>"});
        }
        x+=adv(HW[g]==null?9:HW[g]);
      }
      x+=7;
    });
    if(x>maxLine)maxLine=x;y0+=lh;
  });
  var w=Math.max(4,maxLine-7+2)*s,h=(y0-lh+16)*s;
  return '<svg class="cs-hw" width="'+w.toFixed(0)+'" height="'+h.toFixed(0)+'" viewBox="-1 -1 '+(maxLine-7+3)+' '+(y0-lh+17)+'" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round" style="vector-effect:non-scaling-stroke">'+out.replace(/<path /g,'<path vector-effect="non-scaling-stroke" ')+"</g></svg>";
}
  function CARDHTML(){
    var m=(tracks[0]&&tracks[0].meta)||"",mp=m.split("\u00b7"),bpm=parseInt(mp[0],10),ky=(mp[1]||"").trim().toUpperCase();
    var rows=tracks.map(function(t,i){return '<div class="cs-pvr cs-p'+i+'" data-i="'+i+'"><span class="pc-n">0'+(i+1)+'</span><button class="cs-pvtag" type="button" aria-label="Play only '+esc(t.name)+'"><b class="pc-k">'+esc(t.kind.toLowerCase())+'</b><span class="pc-nm">'+esc(t.name.toLowerCase())+'</span></button><div class="cs-pvw" role="button" aria-label="Play all three together"><canvas></canvas><i class="cs-pvl"></i></div><span class="pc-tm">0:00 / 0:00</span></div>'}).join("");
    return '<div class="cs-pvstack"><div class="pc"><svg class="pc-fr" aria-hidden="true"><path/></svg>'+
      '<div class="pc-top"><button class="pc-play" type="button" aria-label="Play all three together"><svg class="pl" viewBox="0 0 14 14"><path d="M2 0v14l11-7z"/></svg><svg class="pa" viewBox="0 0 14 14"><rect x="1" y="0" width="4" height="14"/><rect x="9" y="0" width="4" height="14"/></svg></button>'+
      '<div class="pc-hd"><div class="pc-title">preview pack</div><div class="pc-sub">&gt; '+tracks.map(function(t){return esc(t.kind)}).join(" + ")+(bpm?" &nbsp;/&nbsp; "+bpm+" BPM"+(ky?" / "+esc(ky):""):"")+'</div></div>'+
      '<svg class="pc-ic" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round" stroke-linecap="round"><path d="M16 2C17 11 21 15 30 16C21 17 17 21 16 30C15 21 11 17 2 16C11 15 15 11 16 2Z"/><path d="M26 4C26.3 6.2 27.3 7.2 29.5 7.5C27.3 7.8 26.3 8.8 26 11C25.7 8.8 24.7 7.8 22.5 7.5C24.7 7.2 25.7 6.2 26 4Z"/></svg></div>'+
      '<div class="pc-rows">'+rows+'</div></div></div>'}
  function esc(x){return String(x).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  var LW=900;
  function mount(){
    LW=Math.min(960,(document.getElementById("pk")||document.body).clientWidth||900);
    if(document.getElementById("csPv")){return}
    var pk=document.getElementById("pk"),top=document.getElementById("pkTop");
    if(!pk||!top||!ready||!document.documentElement.classList.contains("opium2"))return;
    sec=document.createElement("section");sec.className="pks cs-pv";sec.id="csPv";
    if(CARD){sec.classList.add("cs-card");sec.innerHTML=CARDHTML();top.after(sec);var pb=sec.querySelector(".pc-play");if(pb)pb.addEventListener("click",panelClick);sec.querySelectorAll(".cs-pvr").forEach(function(r,i){var t=tracks[i];t.row=r;t.cv=r.querySelector("canvas");t.line=r.querySelector(".cs-pvl");t.tm=r.querySelector(".pc-tm");r.querySelector(".cs-pvw").addEventListener("click",panelClick);r.querySelector(".cs-pvtag").addEventListener("click",function(){tagClick(i)});draw(i,0)});
      var cfr=function(){var pc=sec.querySelector(".pc"),f=sec.querySelector(".pc-fr"),S=window.CK_SHP;if(!pc||!f)return;if(!S){setTimeout(cfr,400);return}var w=pc.clientWidth,h=pc.clientHeight;if(!w||!h)return;var sh=S.filter(function(x){return x.n==="sketch double pass"})[0]||S[0];f.innerHTML='<path d="'+sh.f(w,h)+'"/>'};
      new ResizeObserver(function(){tracks.forEach(function(t,i){draw(i,0)});cfr()}).observe(sec);cfr();setTimeout(cfr,600);setTimeout(cfr,1800);
      if("IntersectionObserver" in window){new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)tracks.forEach(function(t,i){load(i).catch(function(){})});tracks.forEach(function(t){t.vis=e.isIntersecting})})},{rootMargin:"500px"}).observe(sec)}
      return}
    sec.innerHTML=
      '<div class="cs-pvstack">'+FRAME+HEAD()+tracks.map(function(t,i){return '<div class="cs-pvr cs-p'+i+'" data-i="'+i+'"><div class="cs-pvw" role="button" aria-label="Play all three together"><canvas></canvas><i class="cs-pvl"></i></div><button class="cs-pvtag" type="button" aria-label="Play only '+esc(t.name)+'"><span class="cs-pvtx">'+drawText(t.kind+' '+t.name,i===1?15:17,{max:i===1?Math.max(120,LW*.17):300,sw:2})+'</span>'+ARROW[i]+'</button></div>'}).join("")+'</div>';
    top.after(sec);
    sec.querySelector(".cs-pvhead").addEventListener("click",panelClick);
    sec.querySelectorAll(".cs-pvr").forEach(function(r,i){
      var t=tracks[i];t.row=r;t.cv=r.querySelector("canvas");t.line=r.querySelector(".cs-pvl");
      r.querySelector(".cs-pvw").addEventListener("click",panelClick);
      r.querySelector(".cs-pvtag").addEventListener("click",function(){if(window.CS_BOX&&!CARD)panelClick();else tagClick(i)});t.tm=r.querySelector(".pc-tm");
      draw(i,0);
    });
    new ResizeObserver(function(){tracks.forEach(function(t,i){draw(i,0)});scribbles()}).observe(sec);scribbles();setTimeout(scribbles,400);setTimeout(scribbles,1500);
    if(window.CS_PVBOXES&&window.csBox&&!window.__csPvLoop){window.__csPvLoop=1;
      (function lp(ms){requestAnimationFrame(lp);var t=ms/1000,id=csBox.idle(t);
        tracks.forEach(function(tr){if(!tr.cv||tr.vis===false)return;var w=Math.round(tr.cv.clientWidth/2),h=Math.round(tr.cv.clientHeight/2);if(!w||!h)return;
          if(tr.cv.width!==w||tr.cv.height!==h){tr.cv.width=w;tr.cv.height=h}
          var a=state.playing&&tr.rd?tr.rd():id;csBox.draw(tr.cv,tr.bs||(tr.bs=csBox.pick(tr.kind,tr.name)),t,a)})})(0)}
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
      tracks=ch.map(function(s){return{src:absu(s.file),name:nameOf(s),kind:kindOf(s),meta:s.meta||"",pk:peaksOf(s),dur:0}});
      ready=true;mount();
      new MutationObserver(mount).observe(document.getElementById("pk"),{childList:true});
    }).catch(function(){});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
