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
        else if(card&&!COLLAGE&&(lv==="#8b6cf6"||lv==="#b8a4ff"))v="#bdbdc6";
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
  function hash(s){var h=7;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h}
  function collage(m){
    var pvs=[].slice.call(m.querySelectorAll(".op-cat .pv"));
    pvs.forEach(function(p){var n=(p.querySelector(".nm")||p).textContent||"",h=hash(n);
      if(p.__csh!==h){p.__csh=h;p.style.order=h%1000}});
    pvs.slice().sort(function(a,b){return (+a.style.order)-(+b.style.order)}).forEach(function(p,i){
      var c="cs-z"+SZ[i%SZ.length];
      if(p.__csz!==c){if(p.__csz)p.classList.remove(p.__csz);p.classList.add(c);p.__csz=c}});
  }
  function start(){
    var pk=document.getElementById("pk");if(!pk)return;
    fix();new MutationObserver(function(){fix()}).observe(pk,{childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
