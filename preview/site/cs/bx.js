/* COREKULT sound boxes (Eman 26 Nov): audio-reactive animation boxes instead of waveforms, one style per sound type, built from his refs.
   window.csBox = { draw, pick, reader, idle }. With window.CS_BOX set it also replaces the sound-card waves of a pack page. */
(function(){
  function hash(i,j,k){var h=(i*374761393+j*668265263+k*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295}
  function sm(t){return t*t*(3-2*t)}
  function lr(a,b,t){return a+(b-a)*t}
  function cl(v){return v<0?0:v>1?1:v}
  function vn(x,y,z){var xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=sm(x-xi),yf=sm(y-yi),zf=sm(z-zi);
    return lr(lr(lr(hash(xi,yi,zi),hash(xi+1,yi,zi),xf),lr(hash(xi,yi+1,zi),hash(xi+1,yi+1,zi),xf),yf),lr(lr(hash(xi,yi,zi+1),hash(xi+1,yi,zi+1),xf),lr(hash(xi,yi+1,zi+1),hash(xi+1,yi+1,zi+1),xf),yf),zf)}
  function fbm(x,y,z){return vn(x,y,z)*.55+vn(x*2,y*2,z*1.3)*.3+vn(x*4,y*4,z*1.7)*.15}
  var B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(function(v){return v/16});
  function lo(st,w,h){if(!st.lo||st.lo.width!==w||st.lo.height!==h){var c=document.createElement("canvas");c.width=w;c.height=h;st.lo=c;st.lg=c.getContext("2d");st.img=st.lg.createImageData(w,h)}return st.img.data}
  function blit(st,g,W,H,smooth){g.imageSmoothingEnabled=!!smooth;st.lg.putImageData(st.img,0,0);g.drawImage(st.lo,0,0,W,H)}
  function ramp(P,f){f=cl(f)*(P.length-1);var i=Math.min(P.length-2,Math.floor(f)),k=f-i;return[lr(P[i][0],P[i+1][0],k),lr(P[i][1],P[i+1][1],k),lr(P[i][2],P[i+1][2],k)]}
  /* ---- 1 terrain: green dot matrix (soft pads) ---- */
  function terrain(st,g,W,H,t,a){
    g.fillStyle="#040806";g.fillRect(0,0,W,H);
    var n=40,c=W/n,ny=Math.round(H/c);
    for(var j=0;j<ny;j++)for(var i=0;i<n;i++){
      var f=fbm(i*.11+t*.1,j*.11,t*.14),d=Math.hypot(i-n/2,j-ny/2)/n;
      f+=.4*a.bass*Math.sin(d*13-t*5)*(1-d)+.22*a.mid*Math.sin(i*.35+t*3+j*.1);
      f=cl((f-.3)*1.7);var x=i*c+c/2,y=j*c+c/2,r=c*(.12+.3*f),hh=c*(.35+f*1.1),col;
      if(f>.74&&hash(i,j,Math.floor(t*2))>.8)col="rgb(176,98,48)";
      else{var k=Math.min(1,f*1.25);col="rgb("+Math.round(lr(10,170,k*k))+","+Math.round(lr(48,236,k))+","+Math.round(lr(40,176,k))+")"}
      g.fillStyle=col;if(f<.55)g.fillRect(x-r,y-r,r*2,r*2);else g.fillRect(x-r*.7,y-hh*.28,r*1.4,hh*.56)}
  }
  /* ---- 2 crowd: white motion-blur bokeh (heavy bass) ---- */
  var grain=document.createElement("canvas");grain.width=grain.height=96;(function(){var g=grain.getContext("2d"),d=g.createImageData(96,96);for(var i=0;i<d.data.length;i+=4){var v=Math.random()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}g.putImageData(d,0,0)})();
  function crowd(st,g,W,H,t,a){
    if(!st.bl){st.bl=[];for(var q=0;q<70;q++)st.bl.push({x:Math.random()*W,y:Math.random()*H,r:(.04+Math.random()*.1)*W,b:q%3,ph:Math.random()*6});g.fillStyle="#000";g.fillRect(0,0,W,H)}
    g.globalCompositeOperation="source-over";g.fillStyle="rgba(0,0,0,"+(.42-a.lvl*.06)+")";g.fillRect(0,0,W,H);
    var ang=-.42+Math.sin(t*.3)*.12,sp=(1+a.lvl*9+a.beat*5)*W/360,ca=Math.cos(ang),sa=Math.sin(ang);
    g.globalCompositeOperation="lighter";
    st.bl.forEach(function(p){
      p.x+=ca*sp*(.6+p.r/(W*.1));p.y+=sa*sp*(.6+p.r/(W*.1));
      var m=p.r*3;if(p.x>W+m)p.x=-m;if(p.x<-m)p.x=W+m;if(p.y>H+m)p.y=-m;if(p.y<-m)p.y=H+m;
      var band=p.b===0?a.bass:p.b===1?a.mid:a.hi,al=.14+band*.6*(.5+.5*Math.sin(t*2+p.ph)),r=p.r*(.8+band*.5);
      var gr=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r);gr.addColorStop(0,"rgba(255,255,255,"+Math.min(1,al)+")");gr.addColorStop(.55,"rgba(230,230,230,"+al*.45+")");gr.addColorStop(1,"rgba(0,0,0,0)");
      g.fillStyle=gr;g.save();g.translate(p.x,p.y);g.rotate(ang);g.scale(1+sp*.06,.75);g.translate(-p.x,-p.y);g.fillRect(p.x-r*2.5,p.y-r*2.5,r*5,r*5);g.restore()});
    g.globalCompositeOperation="source-over";g.globalAlpha=.2;g.fillStyle=g.createPattern(grain,"repeat");g.save();g.translate(Math.floor(Math.random()*96),Math.floor(Math.random()*96));g.fillRect(-96,-96,W+192,H+192);g.restore();g.globalAlpha=1}
  /* ---- 3 contour liquid (keys) ---- */
  var MS={1:[3,0],2:[0,1],3:[3,1],4:[1,2],5:[3,0,1,2],6:[0,2],7:[3,2],8:[2,3],9:[0,2],10:[0,3,1,2],11:[1,2],12:[1,3],13:[0,1],14:[3,0]};
  function contour(st,g,W,H,t,a){
    g.fillStyle="#020202";g.fillRect(0,0,W,H);
    var n=48,c=W/n,ny=Math.round(H/c),F=[],i,j;
    for(j=0;j<=ny;j++){F[j]=[];for(i=0;i<=n;i++){var f=fbm(i*.085+t*.09,j*.085,t*.12+a.lvl*.8);f+=.2*a.bass*Math.sin((i+j)*.25-t*4)+.15*a.mid*Math.sin(i*.5+t*3);F[j][i]=f}}
    g.lineWidth=1;
    [.4,.47,.54,.61].forEach(function(th,li){
      g.strokeStyle="rgba(228,236,226,"+(.5+.12*li+a.lvl*.3)+")";g.beginPath();
      for(j=0;j<ny;j++)for(i=0;i<n;i++){
        var va=F[j][i],b=F[j][i+1],cc=F[j+1][i+1],d=F[j+1][i],k=(va>th?1:0)|(b>th?2:0)|(cc>th?4:0)|(d>th?8:0),e=MS[k];if(!e)continue;
        var P=function(ed){var x=i,y=j;if(ed===0){x+=(th-va)/(b-va)}else if(ed===1){x+=1;y+=(th-b)/(cc-b)}else if(ed===2){x+=(th-d)/(cc-d);y+=1}else{y+=(th-va)/(d-va)}return[x*c,y*c]};
        for(var s=0;s<e.length;s+=2){var p0=P(e[s]),p1=P(e[s+1]);g.moveTo(p0[0],p0[1]);g.lineTo(p1[0],p1[1])}}
      g.stroke()});
    g.fillStyle="rgba(240,245,238,.9)";
    for(j=0;j<ny;j++)for(i=0;i<n;i++){var v=F[j][i];if(Math.abs(v-.5)<.02+a.hi*.05&&hash(i,j,Math.floor(t*4))>.5)g.fillRect(i*c,j*c,Math.max(1.5,c*.3),Math.max(1.5,c*.3))}
  }
  /* ---- 4 zebra: rainbow glitch stripes (harsh bass / stabs) ---- */
  function zebra(st,g,W,H,t,a){
    var w=Math.round(W/3),h=Math.round(H/3),d=lo(st,w,h),i=0,sh=[],x,y;
    for(y=0;y<h;y++){var band=Math.floor(y/(3+((hash(y>>2,1,3)*6)|0))),r=hash(band,Math.floor(t*6),7);sh[y]=r>.8?(r-.5)*(4+a.beat*50+a.lvl*14):0}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      var xx=x+sh[y],wx=fbm(xx*.03+t*.15,y*.03,t*.2),wy=fbm(xx*.025+9,y*.035,t*.18+3);
      var ph=y*.55+(wx*9+wy*4)*(1+a.bass*1.8)+Math.sin(xx*.11+t*3)*a.mid*3;
      var R=Math.sin(ph)>.1-a.lvl*.12,G=Math.sin(ph+.9+a.hi*1.6)>.15,B=Math.sin(ph+1.9)>-.1;
      var sp=hash(x,y,Math.floor(t*10))>.985;
      d[i++]=sp?255:R?250:34;d[i++]=sp?255:G?240:22;d[i++]=sp?255:B?255:96;d[i++]=255}
    blit(st,g,W,H,false)}
  /* ---- 5 melt: purple dithered pixel melt (pads / vox) ---- */
  var PM=[[10,6,18],[62,16,80],[150,40,122],[192,150,222],[244,232,252]];
  function melt(st,g,W,H,t,a){
    var w=Math.round(W/3),h=Math.round(H/3),d=lo(st,w,h),i=0,ys=[],dr=[],x,y;
    for(x=0;x<w;x++){ys[x]=h*(.2+.5*vn(x*.12,t*.25,5))+a.lvl*h*.12*Math.sin(x*.7+t*8);dr[x]=hash(x,Math.floor(t*2),9)>.5?.06:.5}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      var yy=y>ys[x]?ys[x]+(y-ys[x])*dr[x]/(1+a.lvl*2.5):y;
      var f=fbm(x*.05+t*.05,yy*.05,t*.1+a.bass*.5)*1.5-.28+(hash(x>>1,0,1)-.5)*.1+(B4[(y&3)*4+(x&3)]-.5)*.32;
      var k=Math.max(0,Math.min(4,Math.round(cl(f)*4))),c=PM[k];
      d[i++]=c[0];d[i++]=c[1];d[i++]=c[2];d[i++]=255}
    blit(st,g,W,H,false)}
  /* ---- 6 vhs: chroma glitch with tracking tears (fx / stabs / vox) ---- */
  function vhs(st,g,W,H,t,a){
    var w=Math.round(W/3),h=Math.round(H/3),d=lo(st,w,h),x,y,base=st.vb&&st.vb.length===w*h*3?st.vb:(st.vb=new Float32Array(w*h*3)),i;
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      var f=fbm(x*.045+t*.08,y*.045,t*.1+a.bass*.4),m=cl((f-.48)*5),h2=vn(x*.03+4,y*.03,t*.07),c;
      if(h2<.4)c=[70,110,255];else if(h2<.62)c=[236,70,170];else c=[255,150,100];
      var lg=.5+a.lvl*.9+vn(x*.1,y*.1,t)*.4;i=(y*w+x)*3;base[i]=c[0]*m*lg;base[i+1]=c[1]*m*lg;base[i+2]=c[2]*m*lg}
    i=0;
    for(y=0;y<h;y++){
      var bn=Math.floor(y/(2+((hash(y>>3,2,2)*7)|0))),r=hash(bn,Math.floor(t*7),3),dx=r>.86?Math.round((r-.5)*(6+a.beat*34+a.lvl*10)):0,sm2=r>.9?8:0;
      for(x=0;x<w;x++){
        var sx=Math.max(0,Math.min(w-1,x-dx)),R=0,G=0,B=0;
        for(var k=0;k<=sm2;k++){var xx=Math.max(0,sx-k),j=(y*w+xx)*3;if(base[j]>R)R=base[j];if(base[j+1]>G)G=base[j+1];if(base[j+2]>B)B=base[j+2]}
        var jr=(y*w+Math.max(0,sx-1))*3,jb=(y*w+Math.min(w-1,sx+1))*3,sc=(y&1)?.82:1,nz=hash(x,y,Math.floor(t*12))>.992?200:0;
        d[i++]=Math.max(nz,Math.max(R*.6,base[jr]))*sc;d[i++]=Math.max(nz,G*.8)*sc;d[i++]=Math.max(nz,Math.max(B*.6,base[jb]))*sc;d[i++]=255}}
    blit(st,g,W,H,true)}
  /* ---- 7 dashes: blue CRT dashes with rainbow sparks (plucks / arps) ---- */
  function dashes(st,g,W,H,t,a){
    g.globalCompositeOperation="source-over";g.fillStyle="#02060d";g.fillRect(0,0,W,H);
    g.globalCompositeOperation="lighter";
    for(var q=0;q<3;q++){var cx=W*(.3+.4*vn(q*3,t*.12,1)),cy=H*(.3+.4*vn(q*3,t*.12,7)),r=W*(.35+a.bass*.3),gr=g.createRadialGradient(cx,cy,0,cx,cy,r);gr.addColorStop(0,"rgba(20,110,220,"+(.35+a.lvl*.3)+")");gr.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=gr;g.fillRect(0,0,W,H)}
    var cols=34,c=W/cols,rows=Math.round(H/(c*.7));
    for(var j=0;j<rows;j++)for(var i=0;i<cols;i++){
      var f=fbm(i*.09+t*.1,j*.08,t*.12),thr=.52-a.lvl*.14-a.beat*.08;
      if(f>thr){var len=c*(.4+(f-thr)*5+a.hi*1.2),x=i*c,y=j*c*.7;g.fillStyle="rgba("+Math.round(60+f*160)+","+Math.round(170+f*80)+",255,"+(.45+f*.5)+")";g.fillRect(x,y,Math.min(len,c*1.6),Math.max(1,c*.16))}
      if(hash(i,j,Math.floor(t*5))>.985-a.beat*.02){g.fillStyle="hsl("+Math.floor(hash(i,j,3)*360)+",90%,65%)";g.fillRect(i*c,j*c*.7,Math.max(1.5,c*.22),Math.max(1.5,c*.22))}}
    g.globalCompositeOperation="source-over"}
  /* ---- 8 ledgrid: bright blue LED mosaic with inset panels (chip / lead) ---- */
  function ledgrid(st,g,W,H,t,a){
    g.fillStyle="#02030c";g.fillRect(0,0,W,H);
    var n=26,c=W/n,ny=Math.round(H/c),P=[[10,16,90],[30,50,215],[110,130,255],[215,222,255]];
    for(var j=0;j<ny;j++)for(var i=0;i<n;i++){
      var f=fbm(i*.09+t*.08,j*.09,t*.1)*1.2-.12+a.lvl*.35*Math.sin(i*.3+j*.2+t*4);
      var col=ramp(P,f);g.fillStyle="rgb("+(col[0]|0)+","+(col[1]|0)+","+(col[2]|0)+")";g.fillRect(i*c+.6,j*c+.6,c-1.2,c-1.2)}
    for(var q=0;q<2;q++){var bw=W*(.3+a.bass*.25),bh=H*(.22+a.mid*.2),bx=(W-bw)*vn(q*5,t*.2,2),by=(H-bh)*vn(q*5,t*.2,9);
      for(var j2=Math.floor(by/c);j2<(by+bh)/c;j2++)for(var i2=Math.floor(bx/c);i2<(bx+bw)/c;i2++){
        var f2=fbm(i2*.07+q*9,j2*.07,t*.1+q)*1.3,col2=ramp(P,f2+.15);g.fillStyle="rgb("+(col2[0]|0)+","+(col2[1]|0)+","+(col2[2]|0)+")";g.fillRect(i2*c+.6,j2*c+.6,c-1.2,c-1.2)}
      g.strokeStyle="rgba(190,150,255,.8)";g.lineWidth=1;g.strokeRect(bx,by,bw,bh)}
  }
  /* ---- 9 slit: vertical-streak blue slit-scan with tears (leads / fx) ---- */
  function slit(st,g,W,H,t,a){
    var w=Math.round(W/2.5),h=Math.round(H/2.5),d=lo(st,w,h),i=0,x,y,P=[[2,4,22],[10,30,120],[70,100,235],[170,190,255],[225,232,255]];
    var sh=[];for(y=0;y<h;y++){var bn=Math.floor(y/(4+((hash(y>>3,5,5)*16)|0))),r=hash(bn,Math.floor(t*5),5);sh[y]=r>.84?(r-.5)*(8+a.beat*50+a.lvl*18):0}
    for(y=0;y<h;y++){var saw=((y*.9)%6)-3;
      for(x=0;x<w;x++){
        var xx=x+sh[y],ux=xx/w,face=sm(cl(1-Math.abs(ux-.55)*2.5)),str=vn(xx*.35,t*.3,2)*.6+vn(xx*.9,0,7)*.4,
            edge=Math.abs(ux-.55)>.28?saw*(.5+a.lvl*1.4):0,s2=xx+edge,v=face*(.55+str*.55+a.lvl*.35)+(1-face)*vn(s2*.5,y*.015,t*.2)*.35;
        var c=ramp(P,v);
        if(y>h*.32&&y<h*.42&&ux>.25&&ux<.38&&vn(xx*.3,y*.3,t)>.5){c=[60,240,170]}
        d[i++]=c[0];d[i++]=c[1];d[i++]=c[2];d[i++]=255}}
    blit(st,g,W,H,true)}
  /* ---- 10/11 dots: dithered LED dot screens, blue and red/blue (chip / lead / vox) ---- */
  function dots(pal){return function(st,g,W,H,t,a){
    g.fillStyle="#020208";g.fillRect(0,0,W,H);
    var n=36,c=W/n,ny=Math.round(H/c),PB=[[8,8,50],[40,40,200],[130,130,255],[220,215,255]],PR=[[40,6,40],[200,20,90],[255,60,110],[255,200,230]];
    for(var j=0;j<ny;j++)for(var i=0;i<n;i++){
      var f=fbm(i*.07+t*.07,j*.07,t*.09)*1.3-.15+a.lvl*.3*Math.sin(i*.25-t*3)+(a.beat*.25)*Math.exp(-Math.hypot(i-n/2,j-ny/2)/8);
      f=cl(f);var col=pal==="rb"?(i/n<.34+.1*Math.sin(t*.4+j*.1)?ramp(PB,f):ramp(PR,f)):ramp(PB,f+.05*Math.sin(j*.5));
      g.fillStyle="rgb("+(col[0]|0)+","+(col[1]|0)+","+(col[2]|0)+")";g.beginPath();g.arc(i*c+c/2,j*c+c/2,c*(.2+f*.3),0,6.283);g.fill();
      if(f>.88&&hash(i,j,Math.floor(t*3))>.7){g.fillStyle="#fff";g.fillRect(i*c+c*.35,j*c+c*.35,c*.3,c*.3)}}}}
  /* ---- 12 tiles: mirrored black and white tile grid (keys / arps) ---- */
  function tiles(st,g,W,H,t,a){
    var w=Math.round(W/3),h=Math.round(H/3),d=lo(st,w,h),i=0,x,y,T=Math.max(5,Math.round(w/12)),rs=[];
    for(y=0;y<h;y++){var tr=Math.floor(y/T);rs[tr]=hash(tr,Math.floor(t*4),11)>.9?Math.round((hash(tr,2,2)-.5)*a.beat*T*3):0}
    for(y=0;y<h;y++){var ty=Math.floor(y/T);
      for(x=0;x<w;x++){
        var xx=x+rs[ty],tx=Math.floor(xx/T),lx=((xx%T)+T)%T,ly=y%T,mx=Math.abs((xx/w-.5))*w;
        var f=fbm(mx*.06+t*.07,y*.045+t*.05,t*.1)+a.lvl*.25+.1*Math.sin(tx*2.1+ty*1.3+t*2)*a.mid;
        var v=f>.52?24:(f>.46?110:205);
        if(lx===0||ly===0)v=v*.5+90;
        v+=(hash(x,y,3)-.5)*22;d[i++]=v;d[i++]=v;d[i++]=v;d[i++]=255}}
    blit(st,g,W,H,false)}
  /* ---- 13 cells: blue veins with green speckled cells (textures / arps) ---- */
  function cells(st,g,W,H,t,a){
    var w=Math.round(W/3),h=Math.round(H/3),d=lo(st,w,h),i=0,x,y,K=10,sx=[],sy=[],sr=[];
    for(var k=0;k<K;k++){sx[k]=w*(.5+.45*Math.sin(t*.13+k*2.3+hash(k,1,1)*6));sy[k]=h*(.5+.45*Math.cos(t*.11+k*1.7+hash(k,2,2)*6));sr[k]=w*(.1+.08*hash(k,3,3)+a.bass*.05)}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      var best=1e9,bk=0;for(k=0;k<K;k++){var dd=Math.hypot(x-sx[k],y-sy[k])/sr[k]+vn(x*.1,y*.1,k)*.4;if(dd<best){best=dd;bk=k}}
      var r,gg,b;
      if(best<1){var sp=hash(x,y,Math.floor(t*6)),m=hash(x,y,bk);
        if(sp>.93-a.hi*.05){r=255;gg=255;b=255}
        else if(m>.7){r=235;gg=130;b=40}else if(m>.35){r=190;gg=230;b=60}else{r=40;gg=170;b=60}
        if(sp>.6&&sp<=.93){r*=.7;gg*=.7;b*=.7}}
      else{var wv=Math.abs(Math.sin(x*.28+fbm(x*.05,y*.05+t*.2,t*.15)*9+t*.8)),v=wv<.16+a.lvl*.1;
        if(v){r=60;gg=190;b=255}else{var bl=40+fbm(x*.04,y*.04,t*.1)*120;r=10;gg=20;b=bl+60*a.lvl}}
      d[i++]=r;d[i++]=gg;d[i++]=b;d[i++]=255}
    blit(st,g,W,H,true)}
  var STY={terrain:terrain,crowd:crowd,contour:contour,zebra:zebra,melt:melt,vhs:vhs,dashes:dashes,ledgrid:ledgrid,slit:slit,dots:dots("blue"),dotsrb:dots("rb"),tiles:tiles,cells:cells};
  /* sound type -> two fitting styles (second one chosen by name hash) */
  /* ---- shape lines (the keys style): smooth blobs, rings, waves, or spiky stars/cells, in odd colours ---- */
  var PAL2=[["#E4FF3A","#ff2fa6"],["#22d6ff","#9650ff"],["#ff7a1a","#ffe14a"],["#66ff3a","#22d6ff"],["#ff2fa6","#ffd0f0"],["#f2f2f2","#ff3b3b"],["#9dff00","#00ffd0"],["#c9a0ff","#4d7bff"],["#ff4d4d","#ffb000"],["#00ffd0","#ff2fa6"]];
  function iso(mode){return function(st,g,W,H,t,a,cv){
    var sd=cv&&cv.__seed!=null?cv.__seed:(cv?(cv.__seed=Math.random()):.5);
    if(!st.pal){st.pal=PAL2[Math.floor(hs(sd*53.1)*PAL2.length)];st.nn=hs(sd*7.7);st.cx=hs(sd*11.3)}
    var P=st.pal,sp=mode==="spike"?1:mode==="star"?.7:0;
    g.fillStyle="#020203";g.fillRect(0,0,W,H);
    var n=mode==="spike"||mode==="cells"?64:52,c=W/n,ny=Math.round(H/c),F=[],i,j,N=4+Math.floor(st.nn*7),ph=sd*40;
    for(j=0;j<=ny;j++){F[j]=[];for(i=0;i<=n;i++){var x=i/n,y=j/ny,f;
      if(mode==="blob"){var zs=.075+.16*(.5+.5*Math.cos(t*.32+ph*.05));f=fbm(i*zs+ph+t*.09,j*zs,t*.12+a.lvl*.8);f+=.1*a.bass*Math.sin((i+j)*.25-t*4)}
      else if(mode==="spike"){var r=fbm(i*.1+ph+t*.2,j*.1,t*.25),q=1-Math.abs(2*fbm(i*.21+t*.3,j*.21+ph,t*.2+a.hi)-1);f=.45*r+.55*q*q*(.8+a.bass*.7)}
      else if(mode==="star"){var dx=x-.5-.12*Math.sin(t*.6+ph),dy=y-.5-.12*Math.cos(t*.5+ph),d=Math.sqrt(dx*dx+dy*dy),an=Math.atan2(dy,dx);f=.95-d*1.5+(.1+.2*a.bass+.08*a.hi)*Math.cos(an*N+t*(.8+a.mid*2))*(.5+d*2.2)+(fbm(i*.1+ph,j*.1,t*.1)-.5)*.2}
      else if(mode==="rings"){var dx2=x-.5-.2*Math.sin(t*.4+ph),dy2=y-.5-.2*Math.cos(t*.35+ph),d2=Math.sqrt(dx2*dx2+dy2*dy2);f=.5+.5*Math.sin(d2*(8+st.nn*5)-t*(1.5+a.bass*3)+(fbm(i*.06,j*.06,t*.1)-.5)*4)}
      else if(mode==="cells"){var X=x*(5+st.nn*4)+ph*.1,Y=y*(5+st.nn*4),fx=Math.floor(X),fy=Math.floor(Y),m=9,u,v;for(u=-1;u<=1;u++)for(v=-1;v<=1;v++){var px=fx+u+.5+.45*Math.sin(t*(.5+a.mid)+hash(fx+u,fy+v,1)*6.3),py=fy+v+.5+.45*Math.cos(t*(.6+a.mid)+hash(fx+u,fy+v,2)*6.3),dd=(X-px)*(X-px)+(Y-py)*(Y-py);if(dd<m)m=dd}f=Math.sqrt(m)*1.1}
      else{f=.5+.3*Math.sin(i*.075+Math.sin(j*.045+t*2.2+ph)*1.6+t*1.8)+.2*Math.sin(j*.06-t*(2.2+a.bass*2))}
      F[j][i]=f}}
    g.lineWidth=mode==="rings"?.9:mode==="wave"?1.6:1.2;
    (mode==="rings"?[.5]:mode==="wave"?[.4,.6]:[.38,.46,.54,.62]).forEach(function(th,li){
      g.strokeStyle=li%2?P[1]:P[0];g.globalAlpha=.55+.1*li+a.lvl*.25;g.beginPath();
      for(j=0;j<ny;j++)for(i=0;i<n;i++){
        var va=F[j][i],b=F[j][i+1],cc=F[j+1][i+1],d=F[j+1][i],k=(va>th?1:0)|(b>th?2:0)|(cc>th?4:0)|(d>th?8:0),e=MS[k];if(!e)continue;
        var Q=function(ed){var x=i,y=j;if(ed===0){x+=(th-va)/(b-va)}else if(ed===1){x+=1;y+=(th-b)/(cc-b)}else if(ed===2){x+=(th-d)/(cc-d);y+=1}else{y+=(th-va)/(d-va)}return[x*c,y*c]};
        for(var s=0;s<e.length;s+=2){var p0=Q(e[s]),p1=Q(e[s+1]);g.moveTo(p0[0],p0[1]);g.lineTo(p1[0],p1[1])}}
      g.stroke()});
    g.globalAlpha=1;g.fillStyle=P[1];
    for(j=0;j<ny;j++)for(i=0;i<n;i++){var v2=F[j][i];if(Math.abs(v2-.5)<.015+a.hi*.04&&hash(i,j,Math.floor(t*4))>.55)g.fillRect(i*c,j*c,Math.max(1.5,c*.35),Math.max(1.5,c*.35))}
  }}
  STY.contour=iso("blob");STY.iso_spike=iso("spike");STY.iso_star=iso("star");STY.iso_rings=iso("rings");STY.iso_cells=iso("cells");STY.iso_wave=iso("wave");
  /* ---- photo boxes: your picture at rest, grainy morph to the music when played ---- */
  var PHN=["zebra","melt","vhs","dots","ledgrid","slit","dashes","dotsrb","tiles","cells"],PH={};
  PHN.forEach(function(n){var im=new Image();im.onload=function(){PH[n]=im};im.src="/cs/ref/"+n+".jpg?v=2"});
  function hs(n){var x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)}
  function pinit(st,cv){if(st.init)return;st.init=1;var s=cv.__seed;if(s==null)s=cv.__seed=Math.random();st.s=s;st.img=PHN[Math.floor(hs(s*91.7)*PHN.length)];st.flip=hs(s*13.1)<.5;st.zoom=1.04+hs(s*7.7)*.4;st.px=hs(s*3.3);st.py=hs(s*5.9);st.ph=hs(s*17.3)*6.28;cv.style.filter="hue-rotate("+Math.round((hs(s*29.9)-.5)*70)+"deg)"}
  function psrc(st,w,h){var im=PH[st.img];if(!im)return null;var k=st.img+w+"x"+h;if(st.sk===k)return st.sd;var c=document.createElement("canvas");c.width=w;c.height=h;var x=c.getContext("2d"),sc=Math.max(w/im.width,h/im.height)*st.zoom,dw=im.width*sc,dh=im.height*sc;if(st.flip){x.translate(w,0);x.scale(-1,1)}x.drawImage(im,-(dw-w)*st.px,-(dh-h)*st.py,dw,dh);st.sk=k;st.sd=x.getImageData(0,0,w,h);st.buf=x.createImageData(w,h);st.rk=null;return st.sd}
  function smp(s,w,h,u,v,ch){var x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0,x1=x0+1,y1=y0+1;x0=x0<0?0:x0>=w?w-1:x0;x1=x1<0?0:x1>=w?w-1:x1;y0=y0<0?0:y0>=h?h-1:y0;y1=y1<0?0:y1>=h?h-1:y1;
    var a=s[(y0*w+x0)*4+ch],b=s[(y0*w+x1)*4+ch],c=s[(y1*w+x0)*4+ch],d=s[(y1*w+x1)*4+ch];return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy}
  var FX={
    zebra:{pre:function(c){c.amp=c.k*(4+22*c.bs)},map:function(c,x,y){c.u=x+Math.sin(y*.06+c.t*3+c.ph)*c.amp*(.6+.4*Math.sin(y*.013+c.ph));c.v=y+Math.sin(x*.05+c.t*2)*c.amp*.3;c.ca=c.k*6*c.hi}},
    melt:{pre:function(c){var A=c.cut||(c.cut=new Float32Array(c.w)),fl=Math.floor(c.t*2);for(var x=0;x<c.w;x++)A[x]=c.h*(1-Math.min(.8,c.k*(.3+c.bs*.55)*(.35+hs(x*.17+fl+c.ph))))},map:function(c,x,y){var ct=c.cut[x];c.u=x;c.v=y<ct?y:ct+(y-ct)*.05}},
    vhs:{pre:function(c){c.sd=Math.floor(c.t*12);c.sp=c.k*(2+c.hi*14)},map:function(c,x,y){var b=Math.floor(y/9),sh=hs(b+c.sd*7)<.18*c.k+c.be*.3?(hs(b*3+c.sd)-.5)*50*c.k:0;c.u=x+sh+Math.sin(y*.15+c.t*3)*c.bs*6*c.k;c.v=y;c.ca=c.sp}},
    slit:{pre:function(c){c.cx=c.w*(.5+Math.sin(c.t*.8+c.ph)*.2*Math.min(1,c.k));c.bd=c.w*.5*c.k*c.bs},map:function(c,x,y){var ax=Math.abs(x-c.cx);c.u=(ax<c.bd?c.cx:(x<c.cx?x+c.bd:x-c.bd))+Math.sin(y*.05+c.t*2)*c.k*4;c.v=y+Math.sin(y*.09+c.t*3)*c.hi*4*c.k}},
    dots:{pre:function(c){c.cx=c.w*(.35+.3*hs(c.ph));c.cy=c.h*(.35+.3*hs(c.ph+3));c.f=c.k*(.15+c.bs*.6)*(.7+.3*Math.sin(c.t*6))},map:function(c,x,y){var dx=x-c.cx,dy=y-c.cy,r=Math.sqrt(dx*dx+dy*dy)/(c.w*.5),f=1-c.f*Math.exp(-r*r*3);c.u=c.cx+dx*f;c.v=c.cy+dy*f}},
    dotsrb:{pre:function(c){c.cx=c.w*.5;c.cy=c.h*.5;c.an=c.k*(c.bs+.3)*2*Math.sin(c.t*1.5+c.ph)},map:function(c,x,y){var dx=x-c.cx,dy=y-c.cy,r=Math.sqrt(dx*dx+dy*dy)/(c.w*.5),a=c.an*Math.exp(-r*r*2.2),co=Math.cos(a),si=Math.sin(a);c.u=c.cx+dx*co-dy*si;c.v=c.cy+dx*si+dy*co}},
    ledgrid:{pre:function(c){c.bl=c.k*(.3+c.bs)*30},map:function(c,x,y){c.u=x+Math.sin(y*.04+c.t*2+c.ph)*c.k*6;c.v=y;c.blur=c.bl}},
    tiles:{pre:function(c){c.ww=c.k*c.bs*7},map:function(c,x,y){var X=(x*2)%(2*c.w),Y=(y*2)%(2*c.h);c.u=(X<c.w?X:2*c.w-X)+Math.sin(y*.08+c.t*3)*c.ww;c.v=Y<c.h?Y:2*c.h-Y}},
    cells:{pre:function(c){c.q=c.k},map:function(c,x,y){var q=c.q;c.u=x+Math.sin(y*.05+c.t*1.3+c.ph)*q*14+Math.sin((x+y)*.04+c.t*2)*q*8*c.bs;c.v=y+Math.sin(x*.05+c.t*1.1)*q*14+Math.cos((x-y)*.03+c.t*1.7)*q*6*c.bs}},
    dashes:{pre:function(c){c.sd=Math.floor(c.t*(5+c.k*6))},map:function(c,x,y){var b=Math.floor(y/10);c.u=x+(hs(b*5+c.sd)<.4*c.k+c.be*.4?(hs(b+c.sd*3)-.5)*60*c.k:0);c.v=y;c.ca=c.k*3}}};
  var PC={};
  function photo(n,fb){var F=FX[n];return function(st,g,w,h,t,a,cv){pinit(st,cv);var s=PH[st.img]?psrc(st,w,h):null;if(!s)return fb(st,g,w,h,t,a);
    var play=!!a.play,key=w+"x"+h+st.img;if(!play){if(st.rk===key)return;st.rk=key}else st.rk=null;
    var k=play?Math.min(1.4,.25+a.lvl*1.1):0,c=st.c||(st.c={});c.w=w;c.h=h;c.t=t;c.k=k;c.bs=play?a.bass:0;c.hi=play?a.hi:0;c.be=play?a.beat:0;c.ph=st.ph;c.blur=0;c.ca=0;F.pre(c);
    var D=st.buf,d=D.data,sd=s.data,gr=10+k*30,nb=c.blur>1?4:0;
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){F.map(c,x,y);var o=(y*w+x)*4,r=0,gg=0,b=0,ca=c.ca;
      if(nb){var n2=0;for(var j=-nb/2;j<=nb/2;j++){var uu=c.u+j*c.blur/nb;r+=smp(sd,w,h,uu,c.v,0);gg+=smp(sd,w,h,uu,c.v,1);b+=smp(sd,w,h,uu,c.v,2);n2++}r/=n2;gg/=n2;b/=n2}
      else if(ca>.4){r=smp(sd,w,h,c.u+ca,c.v,0);gg=smp(sd,w,h,c.u,c.v,1);b=smp(sd,w,h,c.u-ca,c.v,2)}
      else{r=smp(sd,w,h,c.u,c.v,0);gg=smp(sd,w,h,c.u,c.v,1);b=smp(sd,w,h,c.u,c.v,2)}
      var nz=(Math.random()-.5)*gr;d[o]=r+nz;d[o+1]=gg+nz;d[o+2]=b+nz;d[o+3]=255}
    g.putImageData(D,0,0)}}
  PHN.forEach(function(n){STY[n]=photo(n,STY[n])});
  /* ---- image boxes: one portrait collage per box; played = cut-out windows of it open, drift, overlap and close ---- */
  var NIMG=29,IMGC={};
  function getImg(i){var k=i%NIMG+1;if(!IMGC[k]){var im=new Image();im.src="/cs/img/p"+(k<10?"0":"")+k+".jpg?v=1";IMGC[k]=im}return IMGC[k]}
  function easeO(x){return 1-Math.pow(1-x,3)}
  function imgR(st,g,W,H,t,a,cv){
    var im=getImg(cv.__img||0);if(!im.complete||!im.naturalWidth){g.fillStyle="#050505";g.fillRect(0,0,W,H);st.rk=null;return}
    if(cv.style.filter)cv.style.filter="";
    var play=!!a.play,key=W+"x"+H+(cv.__img||0);
    if(!play){if(st.rk===key)return;st.rk=key;st.wins=[];st.l0=0;g.drawImage(im,0,0,W,H);return}
    st.rk=null;
    function flash(){var R=[[0,0,1,1]],n=4+Math.floor(Math.random()*4);
      while(R.length<n){var bi=0,ba=0;R.forEach(function(r,i){if(r[2]*r[3]>ba){ba=r[2]*r[3];bi=i}});var r=R.splice(bi,1)[0],f=.3+Math.random()*.4;
        if(r[2]>r[3]){R.push([r[0],r[1],r[2]*f,r[3]],[r[0]+r[2]*f,r[1],r[2]*(1-f),r[3]])}else{R.push([r[0],r[1],r[2],r[3]*f],[r[0],r[1]+r[3]*f,r[2],r[3]*(1-f)])}}
      return {n:1+(Math.random()<.4?1:0),R:R.map(function(r){return {x:r[0],y:r[1],w:r[2],h:r[3],sx:Math.random()*(1-r[2]),sy:Math.random()*(1-r[3])}})}}
    if(a.beat>.3&&t-(st.lb||0)>.14){st.fl=flash();st.lb=t}
    else if(t-(st.ls||0)>.4-a.lvl*.25){st.fl=flash();st.ls=t}
    var iw=im.naturalWidth,ih=im.naturalHeight,f=st.fl;
    if(f&&f.n>0){f.R.forEach(function(r){g.drawImage(im,r.sx*iw,r.sy*ih,r.w*iw,r.h*ih,Math.floor(r.x*W),Math.floor(r.y*H),Math.ceil(r.w*W)+1,Math.ceil(r.h*H)+1)});f.n--}
    else{st.fl=null;g.drawImage(im,0,0,W,H)}
  }
  STY.img=imgR;
  var MAP={bass:["zebra","crowd","iso_spike","melt","iso_star","ledgrid"],lead:["slit","iso_star","vhs","iso_spike","dotsrb","dots"],chip:["ledgrid","iso_cells","cells","tiles","dots"],pluck:["dashes","iso_spike","slit","iso_cells","ledgrid"],pad:["terrain","melt","iso_wave","iso_rings","contour","cells"],keys:["contour","tiles","iso_rings","iso_wave","dots","terrain"],arp:["cells","iso_star","tiles","iso_cells","dotsrb","dashes"],stab:["vhs","iso_spike","dashes","iso_star","zebra"],vox:["melt","iso_wave","dotsrb","contour","vhs"],texture:["terrain","iso_cells","contour","iso_rings","cells"],fx:["vhs","iso_spike","zebra","iso_star","slit"],kick:["zebra","crowd","dots","iso_spike"],snare:["vhs","zebra","dashes","iso_spike"],hat:["dashes","ledgrid","iso_cells"],clap:["vhs","tiles","slit","iso_star"],perc:["tiles","dots","dotsrb","iso_cells"],loop:["crowd","tiles","terrain","cells","iso_rings"],"808":["zebra","crowd","melt","iso_star","iso_spike"]};
  function pick(kind,name){var m=MAP[String(kind||"").toLowerCase()]||["terrain","cells","vhs","dotsrb","tiles"],h=0,s=String(name||"");for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return m[h%m.length]}
  var sts=new WeakMap(),PHS={img:1,zebra:1,melt:1,vhs:1,dots:1,ledgrid:1,slit:1,dashes:1,dotsrb:1,tiles:1,cells:1};
  function draw(cv,style,t,a){var st=sts.get(cv);if(!st){st={};sts.set(cv,st)}var g=cv.__g||(cv.__g=cv.getContext("2d")),f=STY[style]||terrain;var w=cv.width,h=cv.height;if(!a.play&&!PHS[style]){var k=style+w+"x"+h;if(st.stillKey===k)return;st.stillKey=k;if(st.t0==null)st.t0=5+Math.random()*60;t=st.t0}else if(a.play)st.stillKey=null;f(st,g,w,h,t,a,cv)}
  /* ---- audio reading ---- */
  function reader(an){var fd=new Uint8Array(an.frequencyBinCount),pk={b:.2,m:.2,h:.1},A={lvl:.1,bass:.1,mid:.1,hi:.1,beat:0,play:1},pb=0;
    function avg(x,y){var s=0;for(var i=x;i<y;i++)s+=fd[i];return s/(y-x)/255}
    return function(){an.getByteFrequencyData(fd);var b=avg(1,7),m=avg(7,60),h=avg(60,250);
      pk.b=Math.max(pk.b*.996,b,.05);pk.m=Math.max(pk.m*.996,m,.05);pk.h=Math.max(pk.h*.996,h,.04);b/=pk.b;m/=pk.m;h/=pk.h;b=b*b;m*=.9;h*=.9;
      var f=function(k,v){A[k]+=(v-A[k])*(v>A[k]?.55:.1)};f("bass",b);f("mid",m);f("hi",h);f("lvl",(b+m+h)/3*1.15);
      A.beat=Math.max(0,A.beat*.88,(b-pb)>.06?Math.min(1,(b-pb)*5):0);pb=b;return A}}
  var I={lvl:.1,bass:.1,mid:.1,hi:.1,beat:0,play:0};
  function idle(t){I.bass=.1+.06*Math.sin(t*1.3);I.mid=.1+.05*Math.sin(t*.9+1);I.hi=.08+.04*Math.sin(t*1.7+2);I.lvl=(I.bass+I.mid+I.hi)/3*1.6;return I}
  window.csBox={draw:draw,pick:pick,reader:reader,idle:idle,styles:STY,map:MAP};
  /* ---------------- pack page mode ---------------- */
  if(!window.CS_BOX)return;
  var H=document.documentElement;H.classList.add("cs-box");
  var l=document.createElement("link");l.rel="stylesheet";l.href="/cs/bx.css?v=2";(document.head||H).appendChild(l);
  var actx=null,an=null,rd=null,SZ=176;
  function hook(el){if(el.__csb)return;el.__csb=1;
    if(!actx){actx=new(window.AudioContext||window.webkitAudioContext)();an=actx.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=.6;an.connect(actx.destination);rd=reader(an)}
    try{var s=actx.createMediaElementSource(el);s.connect(an)}catch(e){}
    if(actx.state==="suspended")actx.resume()}
  var op=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){try{hook(this)}catch(e){}return op.apply(this,arguments)};
  var boxes=[],vis=new WeakSet(),io=("IntersectionObserver" in window)?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)vis.add(e.target);else vis.delete(e.target)})},{rootMargin:"200px"}):null;
  function scan(){
    document.querySelectorAll("#opMag .op-cat .pv button").forEach(function(b){
      if(b.__csbx)return;var nm=b.querySelector(".nm"),tc=nm&&nm.querySelector(".tc"),kind=(tc?tc.textContent:(nm?nm.textContent:"")).trim().split(/\s+/)[0],name=nm?nm.textContent:"";
      var cv=document.createElement("canvas");cv.className="cs-bxc";cv.width=cv.height=SZ;b.insertBefore(cv,b.firstChild);b.__csbx=1;
      var h=0;for(var q=0;q<name.length;q++)h=(h*31+name.charCodeAt(q))%9973;cv.__img=boxes.length;var o={b:b,cv:cv,style:"img",last:0,off:h*0.37};boxes.push(o);if(io)io.observe(cv);else vis.add(cv)})}
  var mo=null;function arm(){var pk=document.getElementById("pk");if(!pk)return setTimeout(arm,300);scan();var tm;mo=new MutationObserver(function(){clearTimeout(tm);tm=setTimeout(scan,120)});mo.observe(pk,{childList:true,subtree:true})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",arm);else arm();
  function frame(ms){requestAnimationFrame(frame);var t=ms/1000,A=null,id=idle(t);
    boxes.forEach(function(o){
      if(!vis.has(o.cv))return;var on=o.b.classList.contains("on");
      if(!on&&ms-o.last<80)return;if(on&&ms-o.last<16)return;o.last=ms;
      if(on&&rd){A=A||rd()}
      draw(o.cv,o.style,on?t:t+o.off,on&&A?A:idle(t+o.off))})}

  function info(){document.querySelectorAll("#opMag .op-cat").forEach(function(cat){var lt=cat.querySelector(".cs-lt");if(!lt||lt.__csx)return;lt.__csx=1;
    var bp={},ks={},n=0;cat.querySelectorAll(".pv .mt").forEach(function(m){var p=m.textContent.split("\u00b7");var b=parseInt(p[0],10),k=(p[1]||"").trim();n++;if(b)bp[b]=1;if(k)ks[k]=1});
    var bl=Object.keys(bp).map(Number).sort(function(a,b){return a-b}),kl=Object.keys(ks).sort();if(!n)return;
    var dash=lt.querySelector(".cs-dash"),inv=lt.querySelector(".cs-inv");
    function row(t){var s=document.createElement("span");s.className="cs-x";s.textContent=t;return s}
    var a=row("SOUNDS > "+("00"+n).slice(-3)+" \u00a0 PACK TOTAL > "+("00"+document.querySelectorAll("#opMag .op-cat .pv").length).slice(-3)),b=row("BPM > "+(bl.length?bl[0]+(bl.length>1?" - "+bl[bl.length-1]:""):"--")+" \u00a0 KEY > "+(kl.slice(0,3).join(" ")||"--")+(kl.length>3?" +"+(kl.length-3):""));
    var h=cat.querySelector(".op-h"),ob=h&&h.querySelector(".op-box");
    if(h&&ob&&!h.querySelector(".cs-lb")){var nm=ob.textContent.split("\u00b7")[0].trim(),lb=document.createElement("div");lb.className="cs-lb";
      var ch=document.createElement("div");ch.className="cs-lbc";ch.textContent="( "+nm+" \u00b7 "+("00"+n).slice(-3)+" )";lb.appendChild(ch);a.className=b.className="cs-lbr";lb.appendChild(a);lb.appendChild(b);h.insertBefore(lb,h.firstChild)}
    else inv.after(a),a.after(b)})}
  setInterval(info,700);
  requestAnimationFrame(frame);
})();
