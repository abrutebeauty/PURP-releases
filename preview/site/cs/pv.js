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
  function esc(x){return String(x).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  var LW=900;
  function mount(){
    LW=Math.min(960,(document.getElementById("pk")||document.body).clientWidth||900);
    if(document.getElementById("csPv")){return}
    var pk=document.getElementById("pk"),top=document.getElementById("pkTop");
    if(!pk||!top||!ready||!document.documentElement.classList.contains("opium2"))return;
    sec=document.createElement("section");sec.className="pks cs-pv";sec.id="csPv";
    sec.innerHTML=
      '<div class="cs-pvstack">'+FRAME+HEAD()+tracks.map(function(t,i){return '<div class="cs-pvr cs-p'+i+'" data-i="'+i+'"><div class="cs-pvw" role="button" aria-label="Play all three together"><canvas></canvas><i class="cs-pvl"></i></div><button class="cs-pvtag" type="button" aria-label="Play only '+esc(t.name)+'"><span class="cs-pvtx">'+drawText(t.kind+' '+t.name,i===1?15:17,{max:i===1?Math.max(120,LW*.17):300,sw:2})+'</span>'+ARROW[i]+'</button></div>'}).join("")+'</div>';
    top.after(sec);
    sec.querySelector(".cs-pvhead").addEventListener("click",panelClick);
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
