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
  var MAP={bass:["zebra","crowd"],lead:["slit","dotsrb"],chip:["ledgrid","dots"],pluck:["dashes","ledgrid"],pad:["terrain","melt"],keys:["contour","tiles"],arp:["cells","dashes"],stab:["vhs","zebra"],vox:["melt","vhs"],texture:["terrain","cells"],fx:["vhs","slit"],kick:["zebra","crowd"],snare:["vhs","zebra"],hat:["dashes","ledgrid"],clap:["vhs","tiles"],perc:["tiles","dots"],loop:["crowd","tiles"],"808":["zebra","crowd"]};
  function pick(kind,name){var m=MAP[String(kind||"").toLowerCase()]||["terrain","cells","vhs","dotsrb","tiles"],h=0,s=String(name||"");for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return m[h%m.length]}
  var sts=new WeakMap();
  function draw(cv,style,t,a){var st=sts.get(cv);if(!st){st={};sts.set(cv,st)}var g=cv.__g||(cv.__g=cv.getContext("2d")),f=STY[style]||terrain;f(st,g,cv.width,cv.height,t,a)}
  /* ---- audio reading ---- */
  function reader(an){var fd=new Uint8Array(an.frequencyBinCount),pk={b:.2,m:.2,h:.1},A={lvl:.1,bass:.1,mid:.1,hi:.1,beat:0},pb=0;
    function avg(x,y){var s=0;for(var i=x;i<y;i++)s+=fd[i];return s/(y-x)/255}
    return function(){an.getByteFrequencyData(fd);var b=avg(1,7),m=avg(7,60),h=avg(60,250);
      pk.b=Math.max(pk.b*.996,b,.05);pk.m=Math.max(pk.m*.996,m,.05);pk.h=Math.max(pk.h*.996,h,.04);b/=pk.b;m/=pk.m;h/=pk.h;b=b*b;m*=.9;h*=.9;
      var f=function(k,v){A[k]+=(v-A[k])*(v>A[k]?.55:.1)};f("bass",b);f("mid",m);f("hi",h);f("lvl",(b+m+h)/3*1.15);
      A.beat=Math.max(0,A.beat*.88,(b-pb)>.06?Math.min(1,(b-pb)*5):0);pb=b;return A}}
  var I={lvl:.1,bass:.1,mid:.1,hi:.1,beat:0};
  function idle(t){I.bass=.1+.06*Math.sin(t*1.3);I.mid=.1+.05*Math.sin(t*.9+1);I.hi=.08+.04*Math.sin(t*1.7+2);I.lvl=(I.bass+I.mid+I.hi)/3*1.6;return I}
  window.csBox={draw:draw,pick:pick,reader:reader,idle:idle,styles:STY,map:MAP};
  /* ---------------- pack page mode ---------------- */
  if(!window.CS_BOX)return;
  var H=document.documentElement;H.classList.add("cs-box");
  var l=document.createElement("link");l.rel="stylesheet";l.href="/cs/bx.css?v=1";(document.head||H).appendChild(l);
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
      var h=0;for(var q=0;q<name.length;q++)h=(h*31+name.charCodeAt(q))%9973;var o={b:b,cv:cv,style:pick(kind,name),last:0,off:h*0.37};boxes.push(o);if(io)io.observe(cv);else vis.add(cv)})}
  var mo=null;function arm(){var pk=document.getElementById("pk");if(!pk)return setTimeout(arm,300);scan();var tm;mo=new MutationObserver(function(){clearTimeout(tm);tm=setTimeout(scan,120)});mo.observe(pk,{childList:true,subtree:true})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",arm);else arm();
  function frame(ms){requestAnimationFrame(frame);var t=ms/1000,A=null,id=idle(t);
    boxes.forEach(function(o){
      if(!vis.has(o.cv))return;var on=o.b.classList.contains("on");
      if(!on&&ms-o.last<80)return;if(on&&ms-o.last<16)return;o.last=ms;
      if(on&&rd){A=A||rd()}
      draw(o.cv,o.style,on?t:t+o.off,on&&A?A:idle(t+o.off))})}
  requestAnimationFrame(frame);
})();
