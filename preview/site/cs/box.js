/* COREKULT sound boxes test (Eman 26 Nov): square boxes, each a different animation driven by the real sound (Web Audio analyser).
   Styles from his 5 refs: 1 dot-matrix terrain, 2 motion-blur crowd, 3 contour liquid, 4 glitching tree, 5 smoke filaments. */
(function(){
  var S=520,box=document.getElementById("bx");
  function hash(i,j,k){var h=(i*374761393+j*668265263+k*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295}
  function sm(t){return t*t*(3-2*t)}
  function lr(a,b,t){return a+(b-a)*t}
  function vn(x,y,z){var xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=sm(x-xi),yf=sm(y-yi),zf=sm(z-zi);
    return lr(lr(lr(hash(xi,yi,zi),hash(xi+1,yi,zi),xf),lr(hash(xi,yi+1,zi),hash(xi+1,yi+1,zi),xf),yf),lr(lr(hash(xi,yi,zi+1),hash(xi+1,yi,zi+1),xf),lr(hash(xi,yi+1,zi+1),hash(xi+1,yi+1,zi+1),xf),yf),zf)}
  function fbm(x,y,z){return vn(x,y,z)*.55+vn(x*2,y*2,z*1.3)*.3+vn(x*4,y*4,z*1.7)*.15}
  var rnd=Math.random;
  /* ---------- audio ---------- */
  var ctx=null,an=null,fd=null,cur=null,A={lvl:.1,bass:.1,mid:.1,hi:.1,beat:0},I={lvl:.1,bass:.1,mid:.1,hi:.1,beat:0},pb=0,PK={b:.2,m:.2,h:.1};window.__bxA=A;
  function ac(){if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();an=ctx.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=.6;an.connect(ctx.destination);fd=new Uint8Array(an.frequencyBinCount)}return ctx}
  function avg(a,b){var s=0;for(var i=a;i<b;i++)s+=fd[i];return s/(b-a)/255}
  function analyse(t){
    I.bass=.1+.06*Math.sin(t*1.3);I.mid=.1+.05*Math.sin(t*.9+1);I.hi=.08+.04*Math.sin(t*1.7+2);I.lvl=(I.bass+I.mid+I.hi)/3*1.6;
    var b,m,h;
    if(cur&&cur.src){an.getByteFrequencyData(fd);b=avg(1,7);m=avg(7,60);h=avg(60,250)}
    else{b=.1+.06*Math.sin(t*1.3);m=.1+.05*Math.sin(t*.9+1);h=.08+.04*Math.sin(t*1.7+2)}
    if(cur&&cur.src){PK.b=Math.max(PK.b*.996,b,.05);PK.m=Math.max(PK.m*.996,m,.05);PK.h=Math.max(PK.h*.996,h,.04);b/=PK.b;m/=PK.m;h/=PK.h;b=b*b;m*=.9;h*=.9}
    var f=function(k,v){A[k]+=(v-A[k])*(v>A[k]?.55:.1)};
    f("bass",b);f("mid",m);f("hi",h);f("lvl",(b+m+h)/3*1.15);
    A.beat=Math.max(0,A.beat*.88,(b-pb)>.06?Math.min(1,(b-pb)*5):0);pb=b}
  /* ---------- 1: dot-matrix terrain (green/teal dots, brown speckle) ---------- */
  function s1(g,t,a){
    g.fillStyle="#040806";g.fillRect(0,0,S,S);
    var n=54,c=S/n;
    for(var j=0;j<n;j++)for(var i=0;i<n;i++){
      var f=fbm(i*.085+t*.1,j*.085,t*.14),d=Math.hypot(i-n/2,j-n/2)/n;
      f+=.4*a.bass*Math.sin(d*13-t*5)*(1-d)+.22*a.mid*Math.sin(i*.35+t*3+j*.1);
      f=Math.max(0,Math.min(1,(f-.3)*1.7));
      var x=i*c+c/2,y=j*c+c/2,r=c*(.12+.3*f),hh=c*(.35+f*1.1);
      var col;
      if(f>.74&&hash(i,j,Math.floor(t*2))>.8)col="rgb(176,98,48)";
      else{var k=Math.min(1,f*1.25);col="rgb("+Math.round(lr(10,170,k*k))+","+Math.round(lr(48,236,k))+","+Math.round(lr(40,176,k))+")"}
      g.fillStyle=col;
      if(f<.55)g.fillRect(x-r,y-r,r*2,r*2);else g.fillRect(x-r*.7,y-hh*.28,r*1.4,hh*.56);
    }
  }
  /* ---------- 2: motion-blur crowd (white bokeh, diagonal smear, grain) ---------- */
  var bl=[];for(var q=0;q<150;q++)bl.push({x:rnd()*S,y:rnd()*S,r:16+rnd()*40,b:q%3,ph:rnd()*6});
  var grain=document.createElement("canvas");grain.width=grain.height=128;(function(){var g=grain.getContext("2d"),d=g.createImageData(128,128);for(var i=0;i<d.data.length;i+=4){var v=rnd()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}g.putImageData(d,0,0)})();
  function s2(g,t,a){
    g.globalCompositeOperation="source-over";g.fillStyle="rgba(0,0,0,"+(.42-a.lvl*.06)+")";g.fillRect(0,0,S,S);
    var ang=-.42+Math.sin(t*.3)*.12,sp=2+a.lvl*20+a.beat*10,ca=Math.cos(ang),sa=Math.sin(ang);
    g.globalCompositeOperation="lighter";
    bl.forEach(function(p){
      p.x+=ca*sp*(.6+p.r/60);p.y+=sa*sp*(.6+p.r/60);
      if(p.x>S+60)p.x=-60;if(p.x<-60)p.x=S+60;if(p.y>S+60)p.y=-60;if(p.y<-60)p.y=S+60;
      var band=p.b===0?a.bass:p.b===1?a.mid:a.hi,al=.14+band*.6*(.5+.5*Math.sin(t*2+p.ph)),r=p.r*(.8+band*.5);
      var gr=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r);gr.addColorStop(0,"rgba(255,255,255,"+Math.min(1,al)+")");gr.addColorStop(.55,"rgba(230,230,230,"+al*.45+")");gr.addColorStop(1,"rgba(0,0,0,0)");
      g.fillStyle=gr;g.save();g.translate(p.x,p.y);g.rotate(ang);g.scale(1+sp*.06,.75);g.translate(-p.x,-p.y);g.fillRect(p.x-r*2.5,p.y-r*2.5,r*5,r*5);g.restore();
      if(band>.5&&p.r>30){g.strokeStyle="rgba(255,255,255,"+band*.7+")";g.lineWidth=1.5;g.beginPath();g.moveTo(p.x-ca*sp*5,p.y-sa*sp*5);g.lineTo(p.x+ca*sp*3,p.y+sa*sp*3);g.stroke()}
    });
    g.globalCompositeOperation="source-over";
    var pat=g.createPattern(grain,"repeat");g.globalAlpha=.22;g.save();g.translate(Math.floor(rnd()*128),Math.floor(rnd()*128));g.fillStyle=pat;g.fillRect(-128,-128,S+256,S+256);g.restore();g.globalAlpha=1;
  }
  /* ---------- 3: contour liquid (marching squares isolines + dots) ---------- */
  var MS={1:[3,0],2:[0,1],3:[3,1],4:[1,2],5:[3,0,1,2],6:[0,2],7:[3,2],8:[2,3],9:[0,2],10:[0,3,1,2],11:[1,2],12:[1,3],13:[0,1],14:[3,0]};
  function s3(g,t,a){
    g.fillStyle="#020202";g.fillRect(0,0,S,S);
    var n=70,c=S/n,F=[],i,j;
    for(j=0;j<=n;j++){F[j]=[];for(i=0;i<=n;i++){
      var f=fbm(i*.06+t*.09,j*.06,t*.12+a.lvl*.8);
      f+=.2*a.bass*Math.sin((i+j)*.25-t*4)+.15*a.mid*Math.sin(i*.5+t*3);
      F[j][i]=f}}
    var levels=[.4,.47,.54,.61];
    g.lineWidth=1;
    levels.forEach(function(th,li){
      g.strokeStyle="rgba(228,236,226,"+(.5+.12*li+a.lvl*.3)+")";g.beginPath();
      for(j=0;j<n;j++)for(i=0;i<n;i++){
        var va=F[j][i],b=F[j][i+1],cc=F[j+1][i+1],d=F[j+1][i],k=(va>th?1:0)|(b>th?2:0)|(cc>th?4:0)|(d>th?8:0),e=MS[k];if(!e)continue;
        var P=function(ed){var x=i,y=j;
          if(ed===0){x+=(th-va)/(b-va)}else if(ed===1){x+=1;y+=(th-b)/(cc-b)}else if(ed===2){x+=(th-d)/(cc-d);y+=1}else{y+=(th-va)/(d-va)}
          return[x*c,y*c]};
        for(var s=0;s<e.length;s+=2){var p0=P(e[s]),p1=P(e[s+1]);g.moveTo(p0[0],p0[1]);g.lineTo(p1[0],p1[1])}
      }g.stroke()});
    g.fillStyle="rgba(240,245,238,.9)";
    for(j=0;j<n;j++)for(i=0;i<n;i++){var v=F[j][i];if(Math.abs(v-.5)<.02+a.hi*.05&&hash(i,j,Math.floor(t*4))>.5)g.fillRect(i*c,j*c,2.5,2.5)}
  }
  /* ---------- 4: glitching tree ---------- */
  var TR={seg:[],leaf:[]},tr=(function(){
    var sd=11,r=function(){sd=(sd*16807+7)%2147483647;return sd/2147483647};
    function br(x,y,a,l,w,d){if(d>7||l<6)return;var x2=x+Math.cos(a)*l,y2=y+Math.sin(a)*l;TR.seg.push([x,y,x2,y2,w]);
      if(d>=4)for(var k=0;k<5;k++)TR.leaf.push([x2+(r()-.5)*70,y2+(r()-.5)*40,r()*6.28]);
      var n=d<2?2:2+(r()>.55?1:0);for(var i=0;i<n;i++)br(x2,y2,a+(r()-.5)*1.1+(i-(n-1)/2)*.45,l*(.7+r()*.08),w*.7,d+1)}
    br(S*.5,S*.84,-Math.PI/2,S*.2,9,0);
    for(var k=0;k<7;k++){var a=Math.PI*(.15+k*.12),x=S*.5,y=S*.82;TR.seg.push([x,y,x+Math.cos(a)*S*(.12+r()*.1)*(k<3?1:-1),y+Math.sin(a)*S*.05,1.5])}
    for(var i=0;i<2600;i++){var a2=r()*6.28,rr=Math.sqrt(r());TR.leaf.push([S*.5+Math.cos(a2)*rr*S*.4,S*.34+Math.sin(a2)*rr*S*.22,r()*6.28])}
  })();
  var T4=document.createElement("canvas");T4.width=T4.height=S;var T4g=T4.getContext("2d"),T4s=document.createElement("canvas");T4s.width=T4s.height=40;var T4sg=T4s.getContext("2d");
  function s4(g,t,a){
    var o=T4g;o.fillStyle="#08090a";o.fillRect(0,0,S,S);
    var gr=o.createRadialGradient(S/2,S*.4,10,S/2,S*.4,S*.55);gr.addColorStop(0,"rgba(255,255,255,.07)");gr.addColorStop(1,"rgba(0,0,0,0)");o.fillStyle=gr;o.fillRect(0,0,S,S);
    o.strokeStyle="#d8dce2";o.lineCap="round";
    TR.seg.forEach(function(s){o.lineWidth=s[4];o.beginPath();o.moveTo(s[0],s[1]);o.lineTo(s[2],s[3]);o.stroke()});
    var sz=2.2+a.bass*3.4;o.shadowColor="#fff";o.shadowBlur=4+a.lvl*10;
    TR.leaf.forEach(function(p,i){var b=.45+.5*Math.sin(t*1.8+p[2]*3+i*.05)*(.4+a.mid),dy=Math.sin(t*2+p[2])*a.lvl*5;
      o.fillStyle="rgba(235,238,242,"+Math.min(1,.35+b*.65)+")";o.fillRect(p[0]+Math.cos(p[2]+t)*a.mid*4,p[1]+dy,sz,sz*(.8+hash(i,1,1)))});
    o.shadowBlur=0;
    g.drawImage(T4,0,0);
    var gl=Math.max(a.beat*1.1,a.lvl*1.0,a.hi*.95)-.6;
    if(gl>0){
      for(var k=0;k<4+gl*16;k++){var sy=rnd()*S,sh=4+rnd()*34,dx=(rnd()-.5)*gl*220;g.fillStyle="#08090a";g.fillRect(0,sy,S,sh);g.drawImage(T4,0,sy,S,sh,dx,sy,S,sh)}
      g.imageSmoothingEnabled=false;
      for(var m=0;m<gl*22;m++){var bx=rnd()*S*.9,by=S*.1+rnd()*S*.55,bw=30+rnd()*90,bh=14+rnd()*40;
        T4sg.clearRect(0,0,40,40);T4sg.drawImage(T4,bx,by,bw,bh,0,0,6,4);g.drawImage(T4s,0,0,6,4,bx,by,bw,bh);
        if(rnd()>.5){g.fillStyle="#08090a";g.fillRect(bx+bw*rnd(),by,bw*.5,bh)}}
      g.imageSmoothingEnabled=true;
    }
  }
  /* ---------- 5: smoke filaments ---------- */
  var PS=[];for(var pi=0;pi<2600;pi++)PS.push({x:S/2,y:S/2,l:0,m:0});
  function s5(g,t,a){
    g.globalCompositeOperation="source-over";g.fillStyle="rgba(0,0,0,"+(.05+a.lvl*.03)+")";g.fillRect(0,0,S,S);
    var cx=S/2+Math.sin(t*.37)*S*.2+Math.sin(t*.91)*S*.07,cy=S/2+Math.cos(t*.29)*S*.2;
    g.globalCompositeOperation="lighter";
    var sp=.5+a.lvl*1.8+a.beat*1.1,al=.24+a.hi*.3+a.beat*.2;
    PS.forEach(function(p){
      if(p.l<=0){var ag=rnd()*6.28,rr=Math.pow(rnd(),1.6)*(60+a.bass*120);p.x=cx+Math.cos(ag)*rr;p.y=cy+Math.sin(ag)*rr;p.l=70+rnd()*140;p.px=p.x;p.py=p.y}
      var an2=fbm(p.x*.0045,p.y*.0045,t*.12)*12.5+Math.atan2(p.y-cy,p.x-cx)*.3;
      p.px=p.x;p.py=p.y;p.x+=Math.cos(an2)*sp;p.y+=Math.sin(an2)*sp;p.l--;
      g.strokeStyle="rgba(255,255,255,"+al*Math.min(1,p.l/30)+")";g.lineWidth=1;g.beginPath();g.moveTo(p.px,p.py);g.lineTo(p.x,p.y);g.stroke()});
    var rg=g.createRadialGradient(cx,cy,0,cx,cy,28+a.bass*60);rg.addColorStop(0,"rgba(255,255,255,"+(.1+a.bass*.3)+")");rg.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=rg;g.fillRect(cx-160,cy-160,320,320);
    g.globalCompositeOperation="source-over";
  }
  var STY=[s1,s2,s3,s4,s5];
  /* ---------- sounds + boxes ---------- */
  function absu(u){return !u||/^(https?:|data:|\/)/.test(u)?u:"/"+u}
  function kindOf(s){return String(s.name).split(/\s+/)[0].toLowerCase()}
  var boxes=[];
  function stop(){if(cur&&cur.src){try{cur.src.stop()}catch(e){}cur.src=null}if(cur)cur.el.classList.remove("on");cur=null;try{an.disconnect()}catch(e){}}
  function play(b){
    var wasCur=cur===b;stop();if(wasCur)return;
    ac();if(ctx.resume)ctx.resume();an.connect(ctx.destination);
    document.querySelectorAll("audio").forEach(function(a){try{a.pause()}catch(e){}});
    var go=function(){var s=ctx.createBufferSource();s.buffer=b.buf;s.loop=true;s.connect(an);s.start();b.src=s;cur=b;b.el.classList.add("on")};
    if(b.buf)go();else fetch(b.url).then(function(r){return r.arrayBuffer()}).then(function(x){return new Promise(function(ok,bad){ac().decodeAudioData(x,ok,bad)})}).then(function(buf){b.buf=buf;go()}).catch(function(){})}
  function build(list){
    var order=["pad","bass","keys","lead","pluck","texture","arp","chip","stab","vox","fx"],used={},pick=[];
    var L=list.filter(function(s){return s&&s.file&&!s.hidden});
    /* five different kinds when possible, tempo-matched is not needed for a test */
    var want=["pad","bass","keys","lead","pluck"];
    want.forEach(function(k){var s=L.filter(function(x){return kindOf(x)===k})[0];if(s&&pick.indexOf(s)<0)pick.push(s)});
    L.forEach(function(s){if(pick.length<5&&pick.indexOf(s)<0)pick.push(s)});
    pick.slice(0,5).forEach(function(s,i){
      var w=String(s.name).split(/\s+/),el=document.createElement("button");el.className="bxi";el.type="button";
      el.innerHTML='<div class="bxc"><canvas width="'+S+'" height="'+S+'"></canvas><i class="bxp"></i></div><div class="bxn"></div>';
      el.querySelector(".bxn").textContent=String(s.name).toLowerCase();
      box.appendChild(el);
      var b={el:el,cv:el.querySelector("canvas"),url:absu(s.file),style:STY[i],g:null,last:0};b.g=b.cv.getContext("2d");
      el.addEventListener("click",function(){play(b)});boxes.push(b)});
    requestAnimationFrame(frame)}
  function frame(ms){
    var t=ms/1000;analyse(t);
    boxes.forEach(function(b){
      var playing=cur===b;if(!playing&&ms-b.last<50)return;b.last=ms;
      b.style(b.g,t,playing?A:I)});
    requestAnimationFrame(frame)}
  fetch("/api/products").then(function(r){return r.json()}).then(function(d){
    var P=(d&&d.products)||d||[],p=P.filter(function(x){return x.id==="crystal-core-i"})[0];
    if(p&&p.sounds&&typeof p.sounds!=="number")build(p.sounds)}).catch(function(){});
})();
