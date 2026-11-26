/* COREKULT product top, OPIUM 2 look (Eman 26 Nov): approved on the Crystal Core test page, now on every pack.
   Works on the live top: GET THE PACK button, PICK 3 FOR 2 beside it, 3 slots above, GET THIS PACK list in grey boxes, no top reviews / 100+ box / 3-pack bar. */
(function(){
  /* sound grid look: collage (default, Eman 26 Nov) or the category columns: add ?look=columns (or ?cols=1) to roll back */
  var COLLAGE=!/[?&](look=columns|cols=1)\b/.test(location.search);
  if(COLLAGE)document.documentElement.classList.add("cs-collage");
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
          v=(pv&&pv.__cst)||"#bdbdc6";
          if(pv)this.globalAlpha=1;
        }
      }
      fd.set.call(this,v)}})}
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
  var SZ=["a","a","w","a","b","a","t","a","w","a","a","b","a","t","a","w","a","a"];
  /* type colours (Eman 26 Nov): only these six, similar types share one */
  var PAL={red:"#d42a24",purple:"#8a4dff",pink:"#ff3ea5",green:"#7dff4a",cyan:"#3ad8ff",blue:"#3d6bff"},
      TYPE={bass:"red",lead:"blue",pluck:"green",plucks:"green",pad:"cyan",pads:"cyan",texture:"cyan",fx:"cyan",keys:"pink",arp:"pink",arps:"pink",stab:"pink",chip:"purple",vox:"purple"},
      ORD=["red","blue","green","cyan","pink","purple"];
  function tcol(k){k=(k||"").toLowerCase().trim();return PAL[TYPE[k]||ORD[hash(k)%6]]}
  function hash(s){var h=7;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h}
  function collage(m){
    var redraw=0,W=m.clientWidth,mob=window.innerWidth<=900,N=Math.max(2,Math.floor((W+8)/((mob?112:122)+8)));
    if(!W)return;
    if(m.__csN!==N){m.__csN=N;m.style.setProperty("--csc",N)}
    var pvs=[].slice.call(m.querySelectorAll(".op-cat .pv"));
    pvs.forEach(function(p){var n=(p.querySelector(".nm")||p).textContent||"",h=hash(n);p.__csh=h;
      var t=p.querySelector(".nm .tc"),c=tcol(t?t.textContent:(n.split(" ")[0]));
      if(p.__cst!==c){p.__cst=c;p.style.setProperty("--tc",c);if(p.querySelector("canvas.wf"))redraw=1}});
    pvs.sort(function(a,b){return a.__csh-b.__csh});
    /* pack the cards exactly like the grid does (first free cell), shrink a size that does not fit, then grow cards into any leftover hole so the block ends as one solid box */
    var occ=[],free=function(x,y){return x<N&&!(occ[y]&&occ[y][x])},cards=[];
    var set=function(x,y,w,h,v){for(var j=y;j<y+h;j++){occ[j]=occ[j]||[];for(var i=x;i<x+w;i++)occ[j][i]=v}};
    pvs.forEach(function(p,i){
      var s=SZ[i%SZ.length],w=(s==="w"||s==="b")?2:1,h=(s==="t"||s==="b")?2:1,x=0,y=0;
      outer:for(y=0;;y++)for(x=0;x<N;x++)if(free(x,y))break outer;
      while(w>1&&!free(x+w-1,y))w--;
      while(h>1&&!(function(){for(var i2=0;i2<w;i2++)if(occ[y+h-1]&&occ[y+h-1][x+i2])return true;return false})())break;
      for(var hh=h;hh>1;hh--){var ok=true;for(var j=1;j<hh;j++)for(var i3=0;i3<w;i3++)if(occ[y+j]&&occ[y+j][x+i3])ok=false;if(ok)break;h=hh-1}
      var c={p:p,x:x,y:y,w:w,h:h};set(x,y,w,h,c);cards.push(c)});
    var rows=occ.length,ch=true,guard=0;
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
    if(redraw)setTimeout(function(){window.dispatchEvent(new Event("resize"))},60);
  }
  function start(){
    var pk=document.getElementById("pk");if(!pk)return;
    fix();new MutationObserver(function(){fix()}).observe(pk,{childList:true,subtree:true});
    var rt;window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(function(){var m=document.getElementById("opMag");if(m&&COLLAGE)collage(m)},150)});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
