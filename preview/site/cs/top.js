/* COREKULT product top, OPIUM 2 look (Eman 26 Nov): approved on the Crystal Core test page, now on every pack.
   Works on the live top: GET THE PACK button, PICK 3 FOR 2 beside it, 3 slots above, GET THIS PACK list in grey boxes, no top reviews / 100+ box / 3-pack bar. */
(function(){
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
        var sm=ww.querySelector("small");if(sm&&sm.textContent.trim().toLowerCase()!=="get this pack")sm.textContent="Get this pack";
        ww.querySelectorAll(".wwb").forEach(function(b){[].slice.call(b.childNodes).forEach(function(c){if(c.nodeType===3&&/^\s*Serum 1\s*$/.test(c.textContent))c.textContent="Serum"})});
      }
    }finally{busy=false}
  }
  function start(){
    var pk=document.getElementById("pk");if(!pk)return;
    fix();new MutationObserver(function(){fix()}).observe(pk,{childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
