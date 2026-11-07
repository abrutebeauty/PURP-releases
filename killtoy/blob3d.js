/* BLOB 3D: one creature drawn by raymarching a distance field in WebGL (BLOB design map, page 7-9).
   Keep this file ASCII-only, like ui/.
   Look parameters (all 0..1 unless noted):
     shape:  tear, cube, cluster, petals, ribbons, crystal, lumps
     spikes: spk (count 0..64), spkLen (up to 1.6), spkRand, spkSoft, heat, antenna (thin shafts with round tips), sockets
     skin:   gloss, glass, rim, frost
     bristles (fur is gone, Eman 31 Oct): briLen, briThick (thick short spines), beads + beadCol (dots)
     extra shapes: lobes (a body of joined lumps), coral (brain ridges), bubbly (bubbles all over), pastel (4-colour blotches)
     colour: c1, c2 (hex), marble, dark, iri (rainbow film)
     light:  lamp (inside), lampCol
     detail: grain (sugar-frost skin, default 0.6), trans (light through it), bump, bumpSize (skin detail), ao (crevice shadow), tipCol + tipMix
     motion: speed (how fast the skin churns), live: { level, swell, flash } from the sound
   BLOB3D.create(canvas) -> { draw(look, {t, yaw, pitch, dist, level, swell, flash}), ok } */
(function () {
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `
precision highp float;
uniform vec2 R; uniform vec3 ro; uniform vec3 fw; uniform vec3 rt; uniform vec3 up; uniform float T; uniform float uPh;
uniform vec4 uShape;   // tear cube cluster petals
uniform vec4 uShape2;  // ribbons crystal lumps -
uniform vec4 uSpk;     // count len rand soft
uniform vec4 uSkin;    // gloss glass rim frost
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uLampC;
uniform vec4 uMisc;    // marble dark iri lamp
uniform float uHeat;
uniform vec4 uMove;    // level swell flash speed
uniform vec4 uTip;     // tip colour rgb, how much
uniform vec4 uDet;     // translucency, skin detail, detail size, crevice shadow
#define PI 3.14159265
float hash(float n){return fract(sin(n)*43758.5453);}
vec3 hash3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);float n=dot(i,vec3(1.,57.,113.));
 return mix(mix(mix(hash(n),hash(n+1.),f.x),mix(hash(n+57.),hash(n+58.),f.x),f.y),mix(mix(hash(n+113.),hash(n+114.),f.x),mix(hash(n+170.),hash(n+171.),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float sdRoundCone(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 ba=b-a;float l2=dot(ba,ba);float rr=r1-r2;float a2=l2-rr*rr;float il2=1./l2;
 vec3 pa=p-a;float y=dot(pa,ba);float z=y-l2;vec3 xv=pa*l2-ba*y;float x2=dot(xv,xv);float y2=y*y*l2;float z2=z*z*l2;float k=sign(rr)*rr*rr*x2;
 if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il2-r2; if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il2-r1; return (sqrt(x2*a2*il2)+y*rr)*il2-r1;}
vec3 fib(float i,float n){float phi=i*2.39996323;float z=1.-(2.*i+1.)/n;float r=sqrt(max(0.,1.-z*z));return vec3(cos(phi)*r,z,sin(phi)*r);}
float gTip; // 0 body .. 1 spike tip, set by map()
float gEdge; // near a crystal facet edge
float gBand; // where on the ribbon bands
uniform vec4 uExt;
uniform vec4 uCore;    // colour inside, how much
uniform vec4 uShape3;  // lobes, coral ridges, bubbly, pastel
uniform vec4 uBri;     // bristles (amount), length, thickness, beads (amount)
uniform vec3 uBeadC;
uniform vec4 uSpk2;    // antenna (thin shafts, round tips), sockets (bumps the spikes sit in)
float gBri; float gBead;     // egg stretch, petal thinness, ruffle, -
float cell(vec3 p){vec3 i=floor(p),f=fract(p);float m=8.;for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 g=vec3(float(x),float(y),float(z));vec3 o=hash3(i+g);m=min(m,length(g+o-f));}return m;}
float body(vec3 p){
 gEdge=0.;gBand=0.;
 p/=1.+uMove.y*.12;p.y-=.03*sin(uPh*1.3);
 float d=length(p)-1.;
 if(uShape.x>0.){vec3 q=p;q.y*=1.+.25*uShape.x;q.x-=.25*uShape.x*q.y*q.y;float r=1.-.32*uShape.x*smoothstep(-1.,1.,p.y);d=mix(d,(length(q)-r)*.8,uShape.x);}
 if(uShape.y>0.){vec3 q=abs(p)-vec3(.72);float bx=length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-.26;d=mix(d,bx,uShape.y);}
 if(uShape.z>0.){float c=length(p)-.66;for(int i=0;i<36;i++){vec3 s=fib(float(i),36.)*(.72+.1*hash(float(i)*3.1));c=smin(c,length(p-s)-(.25+.08*hash(float(i))),.09);}d=mix(d,c,uShape.z);}
 if(uShape.w>0.){float a=atan(p.z,p.x);float lobes=pow(.5+.5*cos(a*4.+.4),.3);float rr=length(p.xz);float r=.15+1.05*lobes+.035*uExt.z*sin(a*22.+rr*6.)*smoothstep(.4,1.,rr);vec3 q=p;q.y*=mix(1.6,3.2,uExt.y);q.y-=.35*rr*rr*uExt.y;d=mix(d,(length(q)-r)*mix(.5,.22,uExt.y),uShape.w);}
 if(uShape2.y>0.){float c=-1.,c2=-1.;for(int i=0;i<26;i++){vec3 n=normalize(hash3(vec3(float(i),2.,7.))*2.-1.);float e=dot(p,n)-(.74+.26*hash(float(i)*7.3));if(e>c){c2=c;c=e;}else c2=max(c2,e);}gEdge=uShape2.y*smoothstep(.022,0.,c-c2);d=mix(d,max(c,length(p)-1.15),uShape2.y);}
 if(uShape2.x>0.){float a=atan(p.z,p.x);float ph=p.y*5.+a*2.+sin(p.y*1.7+T*.3)*2.2;float rb=sin(ph);gBand=ph;d-=uShape2.x*.26*smoothstep(-.4,1.,rb);d+=uShape2.x*.1;}
 if(uShape2.z>0.)d+=uShape2.z*.2*(noise(p*1.1+vec3(9.,2.,uPh*.03))-.5)+uShape2.z*.09*(noise(p*2.6+vec3(0.,uPh*.1,0.))-.5);
 if(uShape3.x>0.){vec3 q=p;float l=length(q-vec3(.05,.62,.05))-.6;l=smin(l,length(q-vec3(-.1,-.5,.12))-.66,.35);l=smin(l,length(q-vec3(.42,.05,.3))-.5,.3);l=smin(l,length(q-vec3(-.35,.15,-.3))-.48,.3);d=mix(d,l,uShape3.x);}
 if(uShape3.y>0.){float w=fbm(p*1.7+4.);float rg=smoothstep(-.35,.75,sin(noise(p*3.+w*1.8)*22.+w*5.));d-=uShape3.y*.08*rg;}
 if(uShape3.z>0.){d-=uShape3.z*(.13*smoothstep(.6,.0,cell(p*3.+2.))+.06*smoothstep(.55,.0,cell(p*7.+9.)));}
 if(uMove.x>0.)d+=uMove.x*.07*(noise(p*3.3+vec3(T*1.7,T*1.3,0.))-.5)+uMove.x*.025*sin(p.y*9.+T*14.);
 return d*(1.+uMove.y*.12);}
float map(vec3 p){
 float eg=1.+.45*uExt.x;p.y/=eg;p.xz*=1.+.08*uExt.x*p.y;
 float d=body(p)*min(eg,1.2);gTip=0.;
 gBri=0.;gBead=0.;
 if((uBri.x>0.||uBri.w>0.)&&d<.5){vec3 dn=normalize(p);float pl=length(p);float N=14.;
  vec3 g0=floor(dn*N);float bl=mix(.06,.5,uBri.y);float best=1e3,bb=1e3;float hb=d;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 gc=g0+vec3(float(x),float(y),float(z));vec3 h3=hash3(gc);vec3 cd=normalize(gc+h3);
   float ax=length(dn-cd)*pl;float m=noise(cd*1.8+7.);
   float isB=uBri.w>0.&&uBri.x>0.?step(.5,m):step(.001,uBri.x);
   if(isB>.5){float ln=bl*(.6+.6*h3.x)*smoothstep(.0,.2,abs(m-.5)+.2*step(uBri.w,0.)*1.);float k=clamp(hb/ln,0.,1.);
    float rr=mix(.035,.07,uBri.z)*(1.-k*.85);float sb=max(ax-rr,hb-ln)*.6;if(sb<best){best=sb;gBri=k;}}
   else if(uBri.w>0.&&h3.y<uBri.w*.18){float rb=mix(.045,.075,h3.z);float sb=length(vec2(ax,hb-rb*.7))-rb;if(sb<bb){bb=sb;}}}
  float d0=d;d=smin(d,best,.025);if(bb<d){d=min(d,bb);gBead=1.;gBri=0.;}else if(best>d0-.001&&best>d+.004)gBri=0.;}
 if(uSpk.x>.5&&length(p)<1.25+uSpk.y*1.2){float n=floor(uSpk.x);
  for(int i=0;i<64;i++){if(float(i)>=n)break;float fi=float(i);vec3 dir=fib(fi,n);
   dir=normalize(dir+uSpk.z*.25*(hash3(vec3(fi,1.,3.))-.5));
   float len=uSpk.y*(1.-uSpk.z*.75*hash(fi*1.7));if(len<.02)continue;
   vec3 a=dir*.62,b=dir*(.95+len);float fat=1.+1.6*clamp(1.-n/40.,0.,1.);float r1=mix(.16,.24,uSpk.w)*fat,r2=mix(.008,.11,uSpk.w*uSpk.w);r1=mix(r1,.075,uSpk2.x);r2=mix(r2,.06,uSpk2.x);
   float s=sdRoundCone(p,a,b,r1,r2);
   if(s<d+.2){float t=clamp((dot(p,dir)-.95)/len,0.,1.);gTip=max(gTip,t*smoothstep(.15,-.02,s-d));}
   if(uSpk2.y>0.){float so=length(p-dir*.9)-r1*1.25;d=smin(d,so,.1*uSpk2.y);}
   d=smin(d,s,mix(.05,.16,uSpk.w));}}
 return d;}
vec3 nrm(vec3 p){vec2 e=vec2(.0015,-.0015);return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
// studio around the creature: dark room, a big soft box above, a cool strip on the right
vec3 env(vec3 d){vec3 c=vec3(.03,.028,.036)+vec3(.05,.045,.06)*(d.y*.5+.5);
 c+=vec3(1.,.97,.93)*2.2*smoothstep(.6,.9,d.y)*smoothstep(.35,0.,abs(d.x+.1));
 c+=vec3(.55,.8,1.)*1.6*smoothstep(.72,.95,d.x)*smoothstep(.55,.0,abs(d.y-.15));
 c+=vec3(1.,.55,.85)*1.1*smoothstep(.7,.95,-d.x)*smoothstep(.6,0.,abs(d.y+.05));
 c+=vec3(.9,.6,.4)*.25*smoothstep(-.3,-.9,d.y);
 c+=vec3(1.)*.6*smoothstep(.97,.995,dot(d,normalize(vec3(-.3,.5,.8))));
 return c;}
vec3 film(float x){return .5+.5*cos(6.2831*(x+vec3(0.,.33,.67)));}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*R)/R.y; vec3 rd=normalize(fw*1.25+rt*uv.x+up*uv.y);
 vec3 bg=vec3(.059,.059,.071)*(1.-.25*length(uv));
 float t=0.,d;bool hit=false;float tmax=12.;
 for(int i=0;i<160;i++){vec3 p=ro+rd*t;d=map(p);if(d<.0015){hit=true;break;}t+=d*.7;if(t>tmax)break;}
 vec3 col=bg;float tHit=hit?t:tmax;
 if(hit){vec3 p=ro+rd*t;map(p);float tip=gTip;vec3 n=nrm(p);vec3 v=-rd;
  float gloss=clamp(uSkin.x+uMove.z*.45,0.,1.),glass=uSkin.y,rim=uSkin.z,frost=uSkin.w;
  // frost: fine lumpy normal + sparkles
  if(frost>0.){vec3 q=p*18.;n=normalize(n+frost*.35*(vec3(noise(q),noise(q+11.),noise(q+23.))-.5));}
  float mar=smoothstep(.35,.65,fbm(p*1.6+vec3(3.,1.,uPh*.05)))*uMisc.x;
  vec3 base=mix(uC1,uC2,mar);base*=1.+uMove.z*.25;
  base=mix(base,vec3(1.,.32,.18),smoothstep(.35,1.,tip)*uHeat);
  base*=mix(1.,.22,uMisc.y);
  // skin detail: small bumps and wrinkles bent into the normal
  float bs=mix(5.,26.,uDet.z);
  if(uDet.y>0.){vec3 q=p*bs+vec3(0.,T*.02,0.);float f0=fbm(q);vec2 e=vec2(.02,0.);
   vec3 g=vec3(fbm(q+e.xyy)-f0,fbm(q+e.yxy)-f0,fbm(q+e.yyx)-f0)/.02;n=normalize(n-uDet.y*.06*g*(1.-.6*tip));}
  // spike tips take their own colour
  base=mix(base,uTip.rgb*mix(1.,.22,uMisc.y),smoothstep(.15,.95,tip)*uTip.a);
  if(uShape2.x>0.){vec3 bc=film(gBand*.16+.1);base=mix(base,mix(base,bc*1.1,.6),uShape2.x*uMisc.z*smoothstep(-.2,.6,sin(gBand*.5)));}
  if(uBri.x>0.||uBri.w>0.){map(p);base=mix(base,uTip.rgb*mix(.75,1.15,gBri)*mix(1.,.22,uMisc.y),smoothstep(.05,1.,gBri)*step(.001,gBri));base=mix(base,uBeadC*mix(1.,.22,uMisc.y),gBead);}
  if(uShape3.w>0.){float f1=fbm(p*1.8+21.),f2=fbm(p*2.3+40.);vec3 pc=mix(mix(uC1,uC2,smoothstep(.35,.6,f1)),mix(uTip.rgb,uCore.rgb,smoothstep(.4,.6,f2)),smoothstep(.45,.6,f2*.9+f1*.2));base=mix(base,pc,uShape3.w);}
  // crevices: soft shadow where the body folds in, tinted toward the second colour
  float ao=0.;{float sc=1.;for(int i=1;i<=5;i++){float hh=.04+.09*float(i);ao+=(hh-map(p+n*hh))*sc;sc*=.6;}ao=clamp(1.-ao*2.2*uDet.w,0.,1.);}
  // translucency: how thin the body is just under this spot (light gets through thin parts)
  float thin=0.;{float sc=1.;for(int i=1;i<=4;i++){float hh=.06*float(i);thin+=(hh+map(p-n*hh))*sc;sc*=.6;}thin=clamp(thin*2.,0.,1.);}
  vec3 L=normalize(vec3(.4,.85,.5)),L2=normalize(vec3(-.8,.1,-.4));float ndl=dot(n,L);float nv=clamp(dot(n,v),0.,1.);float fr=pow(1.-nv,4.);
  float wrap=mix(.0,.45,uDet.x);
  vec3 diff=base*(.12+.88*max((ndl+wrap)/(1.+wrap),0.)*mix(1.,max(ndl,0.),.3))*mix(.35,1.,ao);
  diff+=base*vec3(.55,.8,1.)*.18*max(dot(n,normalize(vec3(1.,.1,0.))),0.)*ao+base*vec3(1.,.55,.85)*.14*max(dot(n,vec3(-1.,0.,0.)),0.)*ao;
  // velvet: light gathers at the edges, no hard highlight
  vec3 sheen=mix(base,vec3(1.),.4)*pow(1.-nv,2.5)*(1.-gloss)*.9*ao;
  // gloss: clear coat with a sharp highlight and a reflection of the room
  vec3 r=reflect(rd,n);float sp=mix(6.,300.,gloss);
  float spec=(pow(max(dot(r,L),0.),sp)+.35*pow(max(dot(r,L2),0.),sp*.6))*mix(.05,2.4,gloss*gloss);
  vec3 refl=env(r)*mix(.02,1.,gloss)*(.06+.94*fr)*mix(.4,1.,ao);
  // thickness along the view ray (for glass, light coming through, and the lamp)
  float th=0.;{float s=.02;for(int i=0;i<24;i++){float dd=map(p+rd*s);if(dd>0.)break;s+=max(-dd,.03);}th=s;}
  // light through the slime: saturated, brighter where it's thin and where the room light is behind it
  vec3 deep=pow(base,vec3(1.6))*1.5;
  vec3 trans=deep*(thin*.9+exp(-th*1.4)*1.2*(.5+.5*max(dot(rd,L),0.)+.6*pow(max(dot(rd,-L2),0.),2.)));
  vec3 surf=diff*(1.-.45*uDet.x)+trans*uDet.x+sheen+spec+refl;
  if(glass>0.){vec3 rr=refract(rd,n,.7);vec3 q=p*2.+rr*1.2;float ir=fbm(q);float ir2=fbm(q*2.7+5.);
   float vein=pow(smoothstep(.38,.72,ir),1.5)+.8*pow(smoothstep(.5,.8,ir2),2.);float cau=pow(1.-abs(2.*noise(p*3.5+rr*2.)-1.),6.);
   vec3 neon=mix(uC2,vec3(.2,1.,.9),smoothstep(.5,.8,ir2));vec3 inside=mix(base*.3,neon*1.3,clamp(vein,0.,1.)*.8)+mix(vec3(.3,1.,.9),uC2,.5)*cau*.8;inside+=film(ir*2.+fr)*base*uMisc.z*.8*vein;
   inside+=env(rr)*.35*mix(base,vec3(1.),.3);
   vec3 gl=inside*exp(-th*.25)+env(r)*(.04+fr*.7)+spec+gEdge*mix(uC2,vec3(.6,.9,1.),.5)*.45;
   surf=mix(surf,gl,glass);}
  if(uMisc.z>0.)surf+=film(fr*1.2+n.y*.3+p.x*.2)*fr*uMisc.z*.9;
  surf+=mix(base,vec3(1.),.5)*pow(1.-nv,7.)*rim*2.2;
  if(uCore.a>0.){vec3 cp=ro+rd*dot(-ro,rd);float cc=exp(-dot(cp,cp)*3.)*clamp(th*.8,0.,1.);float wob=fbm(cp*2.5+3.);surf=mix(surf,uCore.rgb*mix(.8,1.3,wob)*(.5+.5*diff.g/max(base.g,.05)),cc*uCore.a*(.4+.6*uDet.x));}
  // a lamp inside: light comes through where the body is thin
  {vec3 cp=ro+rd*dot(-ro,rd);float cd2=dot(cp,cp);float core=exp(-cd2*2.6);float sss=exp(-th*.9);
  vec3 lc=mix(base,uLampC,.5);surf+=lc*uMisc.w*(core*.9+sss*.35+thin*.35)*(.4+.6*uDet.x+.3)+uLampC*uMisc.w*pow(core,4.)*.45;}
  if(frost>0.){vec3 gq=p*mix(38.,70.,frost);float gc=cell(gq);vec3 gh=hash3(floor(gq));float gl2=pow(max(dot(reflect(rd,normalize(gh-.5+n*1.5)),L),0.),40.);surf+=vec3(1.,.97,1.)*smoothstep(.22,.05,gc)*gl2*frost*2.5;}
  // grain: a sugary frosted skin over every blob (Eman's picture 2) that hides the clean 3D look:
  // soft blotches in the colour, a fine powdery noise, and sugar flakes that catch the light, most at the edges
  if(uExt.w>0.){float gw=uExt.w;float nv2=clamp(dot(n,v),0.,1.);
   // powder: crisp per-grain light and dark, strongest where the light rakes across the surface
   vec3 gq=floor(p*230.);float g1=hash(dot(gq,vec3(1.,57.,113.)));float g2=noise(p*90.);
   float rake=.6+.8*(1.-abs(dot(n,L)));
   surf*=1.+gw*(.22*(g1-.5)+.12*(g2-.5))*rake;
   // soft colour blotches and faint growth lines, like the egg's skin
   surf*=1.+gw*.14*(fbm(p*6.+11.)-.5);
   surf*=1.+gw*.05*sin(dot(p,normalize(vec3(.2,1.,.1)))*160.+noise(p*8.)*6.);
   // peach fuzz: a soft pale haze at the edges instead of a hard CG outline
   surf=mix(surf,mix(base,vec3(1.),.55)*(.6+.4*max(dot(n,L),0.)),gw*.35*pow(1.-nv2,2.5));
   // sugar flakes and dark specks
   vec3 fq=p*60.;float fc=cell(fq);vec3 fh=hash3(floor(fq)+7.);
   float flake=smoothstep(.16,.05,fc*(.7+.6*fh.x))*step(.55,fh.y);
   float glint=.3+.7*pow(max(dot(reflect(rd,normalize(n+(fh-.5)*1.4)),L),0.),6.);
   surf+=mix(vec3(1.),mix(base,vec3(1.),.6),.4)*flake*(.35+.65*smoothstep(.75,.15,nv2))*glint*gw*.8;
   float speck=smoothstep(.1,.04,cell(p*34.+5.))*step(.82,hash3(floor(p*34.+5.)).z);surf*=1.-speck*gw*.35;}
  col=surf;}
 col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
 col+=(hash(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))-.5)*.045*uExt.w;col=pow(clamp(col,0.,1.),vec3(.95));
 gl_FragColor=vec4(col,1.);}`;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  function create(cv) {
    const gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: true, alpha: false });
    if (!gl) return { ok: false, draw() {} };
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['R', 'ro', 'fw', 'rt', 'up', 'T', 'uPh', 'uShape', 'uShape2', 'uSpk', 'uSkin', 'uC1', 'uC2', 'uLampC', 'uMisc', 'uHeat', 'uMove', 'uTip', 'uDet', 'uExt', 'uCore', 'uShape3', 'uBri', 'uBeadC', 'uSpk2'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
    return {
      ok: true,
      draw(L, o = {}) {
        const g = (k, d = 0) => (L[k] == null ? d : L[k]);
        const yaw = o.yaw == null ? 0.5 : o.yaw, pitch = o.pitch == null ? 0.25 : o.pitch, dist = o.dist || 4.6;
        const ro = [dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch)];
        const nz = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
        const fw = nz(ro.map((x) => -x)), rt = nz([-fw[2], 0, fw[0]]), up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
        gl.viewport(0, 0, cv.width, cv.height);
        gl.uniform2f(U.R, cv.width, cv.height); gl.uniform3fv(U.ro, ro); gl.uniform3fv(U.fw, fw); gl.uniform3fv(U.rt, rt); gl.uniform3fv(U.up, up); gl.uniform1f(U.T, (o.t || 0) % 3600); gl.uniform1f(U.uPh, o.ph == null ? (o.t || 0) * g('speed', 0.5) : o.ph % 3600);
        gl.uniform4f(U.uShape, g('tear'), g('cube'), g('cluster'), g('petals'));
        gl.uniform4f(U.uShape2, g('ribbons'), g('crystal'), g('lumps'), 0);
        gl.uniform4f(U.uSpk, g('spk'), g('spkLen'), g('spkRand'), g('spkSoft'));
        gl.uniform4f(U.uSkin, g('gloss', 0.5), g('glass'), g('rim'), g('frost'));
        gl.uniform3fv(U.uC1, hex(g('c1', '#ff8fd0'))); gl.uniform3fv(U.uC2, hex(g('c2', '#8f6bff'))); gl.uniform3fv(U.uLampC, hex(g('lampCol', '#ffb070')));
        gl.uniform4f(U.uMisc, g('marble'), g('dark'), g('iri'), g('lamp')); gl.uniform1f(U.uHeat, g('heat'));
        { const tc = hex(g('tipCol', '#ffffff')); gl.uniform4f(U.uTip, tc[0], tc[1], tc[2], g('tipMix')); }
        gl.uniform4f(U.uDet, g('trans', 0.3), g('bump', 0.3), g('bumpSize', 0.5), g('ao', 1));
        gl.uniform4f(U.uExt, g('egg'), g('thin'), g('ruffle'), g('grain', 0.6));
        { const cc = hex(g('coreCol', '#88cc44')); gl.uniform4f(U.uCore, cc[0], cc[1], cc[2], g('core')); }
        gl.uniform4f(U.uShape3, g('lobes'), g('coral'), g('bubbly'), g('pastel'));
        gl.uniform4f(U.uBri, g('bristles'), g('briLen', 0.5), g('briThick', 0.5), g('beads'));
        gl.uniform4f(U.uSpk2, g('antenna'), g('sockets'), 0, 0);
        gl.uniform3fv(U.uBeadC, hex(g('beadCol', '#ff3fae')));
        gl.uniform4f(U.uMove, o.level || 0, o.swell || 0, o.flash || 0, g('speed', 0.5));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      lose() { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
    };
  }
  window.BLOB3D = { create };
})();
