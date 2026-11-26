/* COREKULT product top, OPIUM 2 look (Eman 26 Nov): approved on the Crystal Core test page, now on every pack.
   Works on the live top: GET THE PACK button, PICK 3 FOR 2 beside it, 3 slots above, GET THIS PACK list in grey boxes, no top reviews / 100+ box / 3-pack bar. */
(function(){
  /* sound grid look: collage (default, Eman 26 Nov) or the category columns: add ?look=columns (or ?cols=1) to roll back */
  var COLLAGE=!/[?&](look=columns|cols=1)\b/.test(location.search);
  if(COLLAGE)document.documentElement.classList.add("cs-collage");
  /* sound cards (Eman 26 Nov): clean-test cards on every OPIUM 2 pack. Remove these 2 lines = old grid */
  if(!window.CS_NOCARDS&&!/[?&]cards=0\b/.test(location.search)){var cj=document.createElement("script");cj.src="/cs/cards.js?v=1";document.head.appendChild(cj)}
  /* PREVIEW stack (Eman 26 Nov) loads from here, so pack.html only needs the one top line */
  if(!window.CS_NOPV){var l=document.createElement("link");l.rel="stylesheet";l.href="/cs/pv.css?v=1";document.head.appendChild(l);var s=document.createElement("script");s.src="/cs/pv.js?v=1";document.head.appendChild(s)}
  /* already-played part of a sound card wave: almost white instead of acid yellow (Eman 26 Nov), only on the sound-card canvases in OPIUM 2 */
  try{
    var proto=CanvasRenderingContext2D.prototype,fd=Object.getOwnPropertyDescriptor(proto,"fillStyle");
    if(fd&&fd.set&&!proto.__csRed){proto.__csRed=1;Object.defineProperty(proto,"fillStyle",{configurable:true,enumerable:fd.enumerable,get:fd.get,set:function(v){
      if(typeof v==="string"&&this.canvas&&this.canvas.classList&&this.canvas.classList.contains("wf")&&document.documentElement.classList.contains("opium2")){
        var lv=v.toLowerCase(),card=this.canvas.closest&&this.canvas.closest(".op-cat");
        if(lv==="#e4ff3a")v=card?"#ffffff":"#fbffe6";
        else if(card&&(lv==="#8b6cf6"||lv==="#b8a4ff")){
          var pv=COLLAGE&&this.canvas.closest(".pv");
          v=document.documentElement.classList.contains("ck-cards")?"#8d8c95":((pv&&pv.__cst)||"#bdbdc6");
          if(pv)this.globalAlpha=1;
        }
      }
      fd.set.call(this,v)}})}
  }catch(e){}
  /* morphing light-painted ribbon (Eman 26 Nov refs): the real envelope as a distorted flowing blob, every pixel column a vertical gradient (slit-scan) with the bright core drifting up and down, dark voids, colours white / pale blue / lavender / deep blue (+ rare green), orange + yellow fringe on stepped, spiky edges. Used by the sound cards and the top PREVIEW stack. mode "played" = plain white shape */
  window.csRibbon=function(g,W,H,amps,mode){
    var n=amps.length;if(n<2||!W||!H)return;
    var seed=n*7+Math.round(amps[2]*997),nz=function(i){var s=Math.sin(i*127.1+seed*3.7)*43758.5453;return s-Math.floor(s)};
    var env=[];for(var k=0;k<n;k++){var s=0,c=0;for(var j=k-2;j<=k+2;j++)if(amps[j]!==undefined){var wgt=3-Math.abs(j-k);s+=amps[j]*wgt;c+=wgt}env.push(s/c)}
    var amp=function(x){var f=Math.min(n-1.001,Math.max(0,x/W*(n-1))),i0=Math.floor(f),t=f-i0;return env[i0]*(1-t)+env[i0+1]*t},
        hmax=H/2-3,p1=nz(1)*6.28,p2=nz(2)*6.28,p3=nz(3)*6.28,
        shift=function(x){return Math.sin(x/W*6.28*1.1+p1)*H*.08+Math.sin(x/W*6.28*2.7+p2)*H*.03},
        topY=[],botY=[],hold=0,ht=0,hb=0;
    for(var x=0;x<=W;x++){
      if(hold>0){hold--;topY.push(ht);botY.push(hb);continue}
      var A=Math.max(H*.12,Math.min(hmax,amp(x)*hmax*1.05+hmax*.12)),sh=shift(x)*(1-A/hmax*.5),cy=H/2+sh,
          jt=(nz(x*.31)-.5)*H*.07,jb=(nz(x*.17+4)-.5)*H*.04;
      if(nz(x*.77+2)>.94)jt-=H*(.05+nz(x)*.1);   /* spikes */
      ht=Math.max(1,cy-A+jt);hb=Math.min(H-1,cy+A*(.82+nz(x*.011)*.12)+jb);
      if(nz(x*.45+8)>.9)hold=2+Math.floor(nz(x*3.1)*8);   /* stepped glitch blocks */
      topY.push(ht);botY.push(hb)}
    g.save();
    if(mode==="played"){g.beginPath();g.moveTo(0,topY[0]);for(var x2=1;x2<=W;x2++)g.lineTo(x2,topY[x2]);for(var x3=W;x3>=0;x3--)g.lineTo(x3,botY[x3]);g.closePath();g.fillStyle="#ffffff";g.fill();g.restore();return}
    var PAL=[[[70,100,255],[24,56,255],[8,16,110]],[[226,244,255],[140,200,255],[40,74,208]],[[255,255,255],[244,248,255],[184,196,255]],[[246,222,255],[205,180,255],[100,86,200]],[[170,255,170],[70,230,120],[20,120,150]]];
    var mixc=function(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]};
    var rgb=function(c,j){j=j||1;return "rgb("+Math.max(0,Math.min(255,Math.round(c[0]*j)))+","+Math.max(0,Math.min(255,Math.round(c[1]*j)))+","+Math.max(0,Math.min(255,Math.round(c[2]*j)))+")"};
    try{g.filter="blur(.55px)"}catch(e){}
    for(var x4=0;x4<W;x4++){
      var ph=((x4/W*1.9+.5*Math.sin(x4/W*9+p3)+.3*Math.sin(x4/W*27+p1))%1+1)%1,green=nz(Math.floor(x4/9)*3.1)>.965,
          vd=nz(Math.floor(x4/14)*1.7+3)>.82,
          q=ph*4,qi=Math.floor(q)%4,qf=q-Math.floor(q),t=qf*qf*(3-2*qf),c0=PAL[qi],c1=PAL[(qi+1)%4],jit=.9+nz(x4*.7)*.2,
          y0=topY[x4],y1=botY[x4],m=Math.min(.85,Math.max(.15,.5+Math.sin(x4/W*6.28*1.9+p2)*.32+(nz(x4*.13)-.5)*.1));
      var gr=g.createLinearGradient(0,y0,0,y1);
      for(var s2=0;s2<3;s2++){var cc=mixc(c0[s2],c1[s2],t);if(green)cc=mixc(cc,PAL[4][s2],.85);if(vd&&s2===1)cc=[10,18,80];
        gr.addColorStop(s2===1?m:s2/2,rgb(cc,jit))}
      g.fillStyle=gr;g.fillRect(x4,y0,1.2,y1-y0)}
    try{g.filter="none"}catch(e){}
    var edge=function(Y,col,lw,blur,off){g.beginPath();for(var x5=0;x5<=W;x5++){var yy=Y[x5]+off;x5?g.lineTo(x5,yy):g.moveTo(x5,yy)}g.strokeStyle=col;g.lineWidth=lw;g.shadowColor=col;g.shadowBlur=blur;g.stroke()};
    edge(topY,"rgba(255,70,20,.9)",2.2,7,-.8);edge(topY,"rgba(255,214,70,.95)",1.1,0,.4);
    edge(botY,"rgba(255,90,30,.7)",1.8,6,.8);edge(botY,"rgba(120,160,255,.9)",1,0,-.4);
    g.shadowBlur=0;g.globalAlpha=.5;
    for(var x6=0;x6<W;x6+=2){var rr=nz(x6*.53+5);if(rr>.7){g.fillStyle="rgba(255,255,255,"+(.1+rr*.2)+")";g.fillRect(x6,topY[x6]+2,1,botY[x6]-topY[x6]-4)}}
    g.restore()};
  /* collage waves (Eman 26 Nov): smooth layered shape like the reference graphic instead of thin lines. The site draws one rect per pixel column, so we record those rects and redraw them as a soft mirrored envelope: darker outer, lighter inner, thin centre line */
  try{
    var PR=Path2D.prototype,orect=PR.rect;
    if(!PR.__csRec){PR.__csRec=1;PR.rect=function(x,y,w,h){(this.__r||(this.__r=[])).push(x,y,w,h);return orect.apply(this,arguments)};
      var P3=CanvasRenderingContext2D.prototype,of3=P3.fill;
      var mix=function(hex,t){var m=/^#([0-9a-f]{6})$/i.exec(hex);if(!m)return hex;var n=parseInt(m[1],16),r=n>>16,g=(n>>8)&255,b=n&255;
        return "rgb("+Math.round(r+(255-r)*t)+","+Math.round(g+(255-g)*t)+","+Math.round(b+(255-b)*t)+")"};
      P3.fill=function(p){
        try{var cv=this.canvas,r=p&&p.__r;
          if(COLLAGE&&!document.documentElement.classList.contains("ck-cards")&&r&&r.length>40&&cv&&cv.classList&&cv.classList.contains("wf")&&!cv.classList.contains("ld")&&cv.closest&&cv.closest(".op-cat")&&/^#[0-9a-f]{6}$/i.test(this.fillStyle)){
            var base=this.fillStyle,pts=[],mid=0,STEP=3,last=-9,W=Math.round(cv.clientWidth)||100,H=Math.round(cv.clientHeight)||200;
            for(var i=0;i<r.length;i+=4){var x=r[i];if(x-last<STEP)continue;last=x;mid=r[i+1]+r[i+3]/2;pts.push([x,r[i+3]/2])}
            if(pts.length>3){
              var mx=0;pts.forEach(function(q){if(q[1]>mx)mx=q[1]});
              window.csRibbon(this,W,H,pts.map(function(q){return q[1]/Math.max(1,mx)}),/^#(ffffff|fbffe6)$/i.test(base)?"played":"");
              return}
          }
        }catch(e){}
        return of3.apply(this,arguments)}}
  }catch(e){}
  var busy=false;
  function fix(){
    if(busy||!document.documentElement.classList.contains("opium2"))return;
    var top=document.getElementById("pkTop"),pki=top&&top.querySelector(".pki");if(!pki)return;
    busy=true;
    try{
      var buy=pki.querySelector(".buy");
      if(buy){
        buy.classList.add("cs-buy");
        var add=buy.querySelector(".btn.acid[data-add]");
        if(add&&/add to cart/i.test(add.textContent))add.textContent="Get the pack";
        if(!buy.querySelector(".cs-pick")){
          var pr=pki.querySelector(".pbuy .price"),m=pr&&/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/.exec(pr.textContent.trim());
          var tr=pki.querySelector("a.trio"),a=document.createElement("a");a.className="cs-pick";a.href=tr?tr.getAttribute("href"):"/bundle";
          var h="Pick 3 for 2";
          if(m){var v=parseFloat(m[2].replace(",",".")),f=function(x){return m[1]+(Math.round(x*100)%100?x.toFixed(2):Math.round(x))+m[3]};h+=" <b>"+f(v*2)+"</b> <s>"+f(v*3)+"</s>"}
          a.innerHTML=h;buy.appendChild(a);
        }
      }
      var ww=pki.querySelector(".ww");
      if(ww){
        var wt=ww.querySelector(".op-wwt");
        if(wt&&!wt.querySelector(".cs-q")){
          var q=document.createElement("span");q.className="cs-q";q.tabIndex=0;q.setAttribute("role","button");q.setAttribute("aria-label","About the sounds");
          q.innerHTML='<i>?</i><em role="tooltip">Sounds can vary slightly between synths because of each synth\u2019s nature and capabilities. All sounds in the previews are from Serum.</em>';
          wt.appendChild(q);
        }
        ww.querySelectorAll(".wwb").forEach(function(b){[].slice.call(b.childNodes).forEach(function(c){if(c.nodeType===3&&/^\s*Serum 1\s*$/.test(c.textContent))c.textContent="Serum"})});
      }
    }finally{busy=false}
    cols();
  }
  /* one column per category: set the count, give each category its own colour (taken from its type chip) */
  function cols(){
    var m=document.getElementById("opMag");if(!m)return;
    var cs=m.querySelectorAll(":scope>.op-cat");if(!cs.length)return;
    if(m.style.getPropertyValue("--csn")!==String(cs.length))m.style.setProperty("--csn",cs.length);
    if(COLLAGE)collage(m);
    cs.forEach(function(c){var t=c.querySelector(".tc[style]"),v=t&&/--cc:\s*(#[0-9a-f]{3,8})/i.exec(t.getAttribute("style"));
      if(v&&c.style.getPropertyValue("--cc")!==v[1])c.style.setProperty("--cc",v[1])});
  }
  /* collage: every sound mixed together, a repeating but shuffled mix of card sizes */
  var UNIFORM=true;  /* Eman 26 Nov: skip the mixed-size collage, every card the same size (set false to bring the collage back) */
  var SZ=["a","a","w","a","b","a","t","a","w","a","a","b","a","t","a","w","a","a"];
  /* type colours (Eman 26 Nov): only these six, similar types share one */
  var PAL={red:"#ee2a22",purple:"#9650ff",pink:"#ff2fa6",green:"#66ff3a",cyan:"#22d6ff",blue:"#3366ff"},
      TYPE={bass:"red",lead:"blue",pluck:"green",plucks:"green",pad:"cyan",pads:"cyan",texture:"cyan",fx:"cyan",keys:"pink",arp:"pink",arps:"pink",stab:"pink",chip:"purple",vox:"purple"},
      ORD=["red","blue","green","cyan","pink","purple"];
  function tcol(k){k=(k||"").toLowerCase().trim();return PAL[TYPE[k]||ORD[hash(k)%6]]}
  function hash(s){var h=7;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h}
  /* product-label details (Eman 26 Nov, reference: Human Machine 06 label): big category title + barcode, caution mark, tiny spec text per category, and a label strip at the end of the sounds */
  var CAUT='<svg viewBox="0 0 24 22" width="22" height="20"><path d="M12 2 L22 20 H2 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v6M12 16.5v1.5" stroke="currentColor" stroke-width="2"/></svg>',
      RING='<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
      REC='<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M21 3v6h-6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  function bars(seed){var s="",x=0,h=seed;while(x<92){h=(h*1103515245+12345)>>>0;var w=1+((h>>>16)%3),g=1+((h>>>20)%2);s+='<i style="left:'+x+'px;width:'+w+'px"></i>';x+=w+g}return s}
  function deco(m){
    var cats=m.querySelectorAll(":scope>.op-cat"),tot=cats.length;
    [].forEach.call(cats,function(cat,k){
      var h=cat.querySelector(".op-h");if(!h||h.querySelector(".cs-lab"))return;
      var t=(h.textContent||"").trim(),seed=hash(t+k),n=("0000"+(seed%99999)).slice(-5);
      var d=document.createElement("div");d.className="cs-lab";
      var nm=(t.split(/[\s\u00b7]+/)[0]||"").toUpperCase(),cnt=("00"+(cat.querySelectorAll(".pv").length)).slice(-3);
      d.innerHTML='<div class="cs-lt"><span>/ ENGINEERED FOR SOUND &gt; '+("0"+(k+1)).slice(-2)+' / '+("0"+tot).slice(-2)+'</span>'+
        '<span class="cs-inv">( KOR / '+nm+' / '+cnt+' )</span><span class="cs-dash"></span>'+
        '<span>INPUT VERIFIED &nbsp; OUTPUT '+n+'</span><span>STATUS: &gt; &nbsp; ACTIVE</span></div>'+
        '<div class="cs-lic"><b class="cs-dot"></b><b class="cs-badge">'+("0"+(k+1)).slice(-2)+'</b>'+CAUT+'</div><div class="cs-bar">'+bars(seed)+'</div>';
      h.appendChild(d)});
    if(!m.querySelector(":scope>.cs-foot")){
      var f=document.createElement("div"),seed2=hash(location.pathname);f.className="cs-foot";
      f.innerHTML='<div class="cs-fb"><b>'+CAUT+' CAUTION</b><span>RISK OF LOUD SOUND</span></div><div class="cs-ft">INPUT VERIFIED &nbsp;&nbsp; LOC: FLOOR-7<br>OUTPUT CONFIRMED &nbsp; /<br>QUALITY PASS &nbsp; LOGGED LOCALLY<br>&gt; &nbsp; PRESS ANY CARD TO PLAY</div><div class="cs-ft cs-ft2">SN: <b class="cs-dot"></b> KOR-'+(seed2%9000+1000)+'-ISL <b class="cs-dot"></b> FWD<br>ICES - 00 NMB 003 &nbsp; 2026<br>DOMESTIC / OPERATIONS / COMMAND</div><div class="cs-bar cs-barw">'+bars(seed2)+bars(seed2+7)+'</div>';
      m.appendChild(f)}
  }
  function collage(m){
    deco(m);
    var redraw=0,mob=window.innerWidth<=900;
    [].forEach.call(m.querySelectorAll(":scope>.op-cat"),function(cat){
      var grid=cat.querySelector(".op-grid"),W=grid&&grid.clientWidth;if(!W)return;
      var N=Math.max(2,Math.floor((W+8)/((mob?112:122)+8)));
      if(grid.__csN!==N){grid.__csN=N;grid.style.setProperty("--csc",N)}
      var pvs=[].slice.call(grid.querySelectorAll(".pv")),first=null;
      pvs.forEach(function(p){var n=(p.querySelector(".nm")||p).textContent||"",h=hash(n);p.__csh=h;
        var t=p.querySelector(".nm .tc"),c=tcol(t?t.textContent:(n.split(" ")[0]));if(!first)first=c;
        if(p.__cst!==c){p.__cst=c;p.style.setProperty("--tc",c);if(p.querySelector("canvas.wf"))redraw=1}});
      if(first&&cat.style.getPropertyValue("--tc")!==first)cat.style.setProperty("--tc",first);
      pack(pvs,N)});
    if(redraw)setTimeout(function(){window.dispatchEvent(new Event("resize"))},60);
  }
  function pack(pvs,N){
    pvs.sort(function(a,b){return a.__csh-b.__csh});
    /* pack the cards exactly like the grid does (first free cell), shrink a size that does not fit, then grow cards into any leftover hole so the block ends as one solid box */
    var occ=[],free=function(x,y){return x<N&&!(occ[y]&&occ[y][x])},cards=[];
    var set=function(x,y,w,h,v){for(var j=y;j<y+h;j++){occ[j]=occ[j]||[];for(var i=x;i<x+w;i++)occ[j][i]=v}};
    pvs.forEach(function(p,i){
      var s=UNIFORM?"a":SZ[i%SZ.length],w=(s==="w"||s==="b")?2:1,h=(s==="t"||s==="b")?2:1,x=0,y=0;
      outer:for(y=0;;y++)for(x=0;x<N;x++)if(free(x,y))break outer;
      while(w>1&&!free(x+w-1,y))w--;
      while(h>1&&!(function(){for(var i2=0;i2<w;i2++)if(occ[y+h-1]&&occ[y+h-1][x+i2])return true;return false})())break;
      for(var hh=h;hh>1;hh--){var ok=true;for(var j=1;j<hh;j++)for(var i3=0;i3<w;i3++)if(occ[y+j]&&occ[y+j][x+i3])ok=false;if(ok)break;h=hh-1}
      var c={p:p,x:x,y:y,w:w,h:h};set(x,y,w,h,c);cards.push(c)});
    var rows=occ.length,ch=!UNIFORM,guard=0;
    while(ch&&guard++<200){ch=false;
      for(var yy=0;yy<rows&&!ch;yy++)for(var xx=0;xx<N&&!ch;xx++){
        if(occ[yy]&&occ[yy][xx])continue;
        var L=xx>0&&occ[yy]&&occ[yy][xx-1],U=yy>0&&occ[yy-1]&&occ[yy-1][xx];
        if(L&&L.y===yy||L){var ok2=true;for(var j2=L.y;j2<L.y+L.h;j2++)if(occ[j2]&&occ[j2][xx])ok2=false;
          if(ok2&&L.x+L.w===xx){set(xx,L.y,1,L.h,L);L.w++;ch=true;continue}}
        if(U&&U.y+U.h===yy){var ok3=true;for(var i4=U.x;i4<U.x+U.w;i4++)if(occ[yy]&&occ[yy][i4])ok3=false;
          if(ok3){set(U.x,yy,U.w,1,U);U.h++;ch=true}}
      }}
    cards.forEach(function(c,i){var p=c.p;
      p.style.order=i;
      var g="span "+c.w;if(p.style.gridColumn!==g)p.style.gridColumn=g;
      g="span "+c.h;if(p.style.gridRow!==g)p.style.gridRow=g;
      p.classList.toggle("cs-zl",c.w*c.h>=3)});
  }
  function start(){
    var pk=document.getElementById("pk");if(!pk)return;
    fix();new MutationObserver(function(){fix()}).observe(pk,{childList:true,subtree:true});
    var rt;window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(function(){var m=document.getElementById("opMag");if(m&&COLLAGE)collage(m)},150)});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
