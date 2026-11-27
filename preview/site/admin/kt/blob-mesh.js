/* BLOB MESH: the same creature as ui/blob3d.js, drawn as a real 3D mesh instead of raymarching
   (Eman 31 Oct: the raymarched blob is too heavy, so it ran blurry at low resolution).
   A finely divided sphere (about 330k triangles) is pushed in and out on the graphics card by the
   same look numbers (lumps, cube, crystal, spikes, bristles...), and shaded per pixel with the same
   lighting ideas (velvet, gloss, light through the slime, a lamp inside, the sugar-grain skin).
   It draws at full screen resolution with smooth edges and costs a small part of the raymarcher.
   Same API as BLOB3D:  BLOBMESH.create(canvas) -> { ok, draw(look, {t, ph, yaw, pitch, dist, level, swell, flash}), lose() }
   Keep this file ASCII-only, like ui/. */
(function () {
  const COMMON = `
float hash(float n){return fract(sin(n)*43758.5453);}
vec3 hash3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);float n=dot(i,vec3(1.,57.,113.));
 return mix(mix(mix(hash(n),hash(n+1.),f.x),mix(hash(n+57.),hash(n+58.),f.x),f.y),mix(mix(hash(n+113.),hash(n+114.),f.x),mix(hash(n+170.),hash(n+171.),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
vec3 fib(float i,float n){float phi=i*2.39996323;float z=1.-(2.*i+1.)/n;float r=sqrt(max(0.,1.-z*z));return vec3(cos(phi)*r,z,sin(phi)*r);}
vec2 cell2(vec3 p){vec3 i=floor(p),f=fract(p);float m=8.;float id=0.;for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 g=vec3(float(x),float(y),float(z));vec3 o=hash3(i+g);float d=length(g+o-f);if(d<m){m=d;id=dot(i+g,vec3(1.,57.,113.));}}return vec2(m,id);}
uniform float T; uniform float uPh;
uniform vec4 uShape;   // tear cube cluster petals
uniform vec4 uShape2;  // ribbons crystal lumps -
uniform vec4 uSpk;     // count len rand soft
uniform vec4 uSkin;    // gloss glass rim frost
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uLampC;
uniform vec4 uMisc;    // marble dark iri lamp
uniform float uHeat;
uniform vec4 uMove;    // level swell flash speed
uniform vec4 uTip;     // tip colour, how much
uniform vec4 uDet;     // translucency, skin detail, detail size, crevice shadow
uniform vec4 uExt;     // egg, thin, ruffle, grain
uniform vec4 uCore;
uniform vec4 uShape3;  // lobes coral bubbly pastel
uniform vec4 uBri;     // bristles, length, thickness, beads
uniform vec3 uBeadC;
uniform vec4 uSpk2;    // antenna, sockets
uniform vec4 uLive;    // played: level, spike pump, hit, shimmer
uniform vec4 uRip[6];  // ripples on the skin: where they started (xyz), age in seconds (w; <0 = none)
uniform float uRipA[6]; // their strengths
`;
  const VS = `precision highp float;
attribute vec3 pos;
uniform mat4 uPV;
${COMMON}
varying vec3 vP; varying vec3 vN; varying vec3 vD; varying float vTip; varying float vCav; varying float vBri; varying float vBand;
// the radius of the body in direction d (unit), plus how far up a spike / bristle this spot is
float gBand;
float rad(vec3 d, out float tip, out float bri){
 tip=0.;bri=0.;gBand=0.;
 float r=1.;
 // cube: a rounded box (superellipse), crystal: a cut stone
 if(uShape.y>0.){float n=2.+9.*uShape.y;vec3 a=abs(d);float rc=pow(pow(a.x,n)+pow(a.y,n)+pow(a.z,n),-1./n);r=mix(r,rc*.86,uShape.y);}
 if(uShape2.y>0.){float m=0.;for(int i=0;i<14;i++){vec3 q=normalize(fib(float(i),14.)+.45*(hash3(vec3(float(i),3.,7.))-.5));m=max(m,dot(d,q));}r=mix(r,.82/max(m,.4),uShape2.y);}
 // soft lumps that slowly churn, big lobes, a cluster of bulbs
 if(uShape2.z>0.)r+=uShape2.z*(.22*(fbm(d*1.5+vec3(9.,2.,uPh*.03))-.5)+.08*(noise(d*3.4+vec3(0.,uPh*.1,0.))-.5));
 if(uShape3.x>0.)r+=uShape3.x*.32*(smoothstep(.3,.75,noise(d*1.25+4.))-.4);
 if(uShape.z>0.){vec2 c=cell2(d*2.2+1.);r+=uShape.z*(.3*sqrt(max(0.,1.-c.x*c.x*1.6))-.12);}
 // coral: brain ridges; bubbly: round bubbles all over
 if(uShape3.y>0.){float q=noise(d*2.6+7.)*14.;r+=uShape3.y*.07*(1.-abs(sin(q)))-uShape3.y*.03;}
 if(uShape3.z>0.){vec2 c=cell2(d*5.+2.);float b=sqrt(max(0.,1.-c.x*c.x*3.));r+=uShape3.z*.13*b;}
 // petals and ribbons around the middle
 float an=atan(d.z,d.x);
 if(uShape2.x>0.){float ph=d.y*5.+an*2.+sin(d.y*1.7+T*.3)*2.2;gBand=3.*sin(ph*.5);r-=uShape2.x*.26*smoothstep(-.4,1.,sin(ph));r+=uShape2.x*.1;}
 if(uExt.z>0.)r+=uExt.z*.05*sin(an*14.+d.y*6.)*(1.-abs(d.y));
 // spikes: cones on evenly spread points (antennae are thin and long, sockets are rings at the base)
 if(uSpk.x>.5){float n=floor(uSpk.x);
  for(int i=0;i<64;i++){if(float(i)>=n)break;float fi=float(i);vec3 s=normalize(fib(fi,n)+uSpk.z*.25*(hash3(vec3(fi,1.,3.))-.5));
   float c=dot(d,s);if(c<.8)continue;float ang=acos(min(c,1.));
   float len=uSpk.y*(1.-uSpk.z*.75*hash(fi*1.7));
   // played: every spike breathes in and out on its own beat, hits shoot them out one after another
   len*=max(.15,1.+uLive.y*(.55*sin(T*(5.+3.*hash(fi*3.1))+fi*2.3))+uLive.z*(.35+.7*hash(fi*5.3)));
   float fat=1.+1.4*clamp(1.-n/40.,0.,1.);float w=mix(mix(.08,.22,uSpk.w)*fat,.045,uSpk2.x);
   if(uSpk2.y>0.)r+=uSpk2.y*.07*exp(-pow((ang-w*1.25)/.05,2.));
   if(ang<w){float k=1.-ang/w;float dome=(len+.1*uSpk.w)*sqrt(max(0.,1.-(1.-k)*(1.-k)));float h=mix(len*pow(k,1.25),dome,uSpk.w*uSpk.w);h=mix(h,len*smoothstep(0.,.35,k),uSpk2.x);r+=h;tip=max(tip,h/max(len,.01));}}}
 // bristles: short thick spines, one per cell
 if(uBri.x>0.){vec2 c=cell2(d*14.+5.);float w=mix(.45,.85,uBri.z);if(c.x<w){float k=1.-c.x/w;float h=uBri.x*mix(.06,.5,uBri.y)*(.6+.6*hash(c.y))*smoothstep(0.,1.,k)*k*max(.2,1.+uLive.y*.6*sin(T*9.+hash(c.y)*6.3)+uLive.z*.5);r+=h;bri=k;}}
 if(uBri.w>0.){vec2 c=cell2(d*13.+11.);if(hash(c.y+3.)<uBri.w*.25)r+=.035*sqrt(max(0.,1.-c.x*c.x*9.));}
 // the sound: a swell when held, a shiver with the level
 r*=1.+uMove.y*.06;
 if(uMove.x>0.)r+=uMove.x*(.06*(noise(d*3.3+vec3(T*1.7,T*1.3,0.))-.5)+.02*sin(d.y*9.+T*14.));
 // water: each hit sends a ring of waves running over the skin from where it landed
 for(int i=0;i<6;i++){vec4 rp=uRip[i];if(rp.w<0.)continue;float amp=uRipA[i];
  float ang=acos(clamp(dot(d,rp.xyz),-1.,1.));float x=ang-rp.w*1.9;
  r+=amp*.07*exp(-rp.w*1.3)*sin(x*16.)*exp(-x*x*5.)*(1.-exp(-ang*6.));}
 // and a fine shiver over the whole surface while it sounds, like water on a speaker
 if(uLive.w>0.)r+=uLive.w*(.022*(noise(d*11.+vec3(T*7.,-T*5.,T*6.))-.5)+.009*sin(dot(d,vec3(23.,17.,29.))+T*31.)*sin(dot(d,vec3(-19.,27.,13.))-T*27.));
 return r;}
vec3 shape(vec3 d, out float tip, out float bri){
 vec3 p=d*rad(d,tip,bri);
 // egg and teardrop stretch, petals flatten
 // (the same bends as the raymarcher's, turned round: it squeezes space, this stretches the body)
 if(uShape.w>0.){float a=atan(p.z,p.x);float lob=pow(.5+.5*cos(a*4.+.4),.3);p.xz*=mix(1.,.15+1.05*lob,uShape.w);p.y*=mix(1.,mix(.5,.3,uExt.y),uShape.w);}
 if(uShape.x>0.){p.y/=1.+.25*uShape.x;p*=1.-.32*uShape.x*smoothstep(-1.,1.,p.y);p.x+=.25*uShape.x*p.y*p.y;}
 float eg=1.+.45*uExt.x;p.y*=eg;p.xz/=1.+.08*uExt.x*p.y;
 p.y*=1.-uExt.y*.55*(1.-uShape.w);
 p.y-=.03*sin(uPh*1.3);
 return p;}
void main(){
 vec3 d=normalize(pos);float tip,bri,t2,b2;
 vec3 p=shape(d,tip,bri);float band=gBand;
 vec3 t1=normalize(cross(d,abs(d.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.)));vec3 tb=cross(d,t1);
 float e=.0025;
 vec3 a=shape(normalize(d+t1*e),t2,b2),b=shape(normalize(d+tb*e),t2,b2);
 vec3 n=normalize(cross(a-p,b-p));if(dot(n,p)<0.)n=-n;
 vP=p;vN=n;vD=d;vTip=tip;vBri=bri;vBand=band;
 vCav=length(p)-1.;
 gl_Position=uPV*vec4(p,1.);}`;
  const FS = `precision highp float;
${COMMON}
uniform vec3 ro;
varying vec3 vP; varying vec3 vN; varying vec3 vD; varying float vTip; varying float vCav; varying float vBri; varying float vBand;
vec3 env(vec3 d){vec3 c=vec3(.03,.028,.036)+vec3(.05,.045,.06)*(d.y*.5+.5);
 c+=vec3(1.,.97,.93)*2.2*smoothstep(.6,.9,d.y)*smoothstep(.35,0.,abs(d.x+.1));
 c+=vec3(.55,.8,1.)*1.6*smoothstep(.72,.95,d.x)*smoothstep(.55,.0,abs(d.y-.15));
 c+=vec3(1.,.55,.85)*1.1*smoothstep(.7,.95,-d.x)*smoothstep(.6,0.,abs(d.y+.05));
 c+=vec3(.9,.6,.4)*.25*smoothstep(-.3,-.9,d.y);
 c+=vec3(1.)*.6*smoothstep(.97,.995,dot(d,normalize(vec3(-.3,.5,.8))));
 return c;}
vec3 film(float x){return .5+.5*cos(6.2831*(x+vec3(0.,.33,.67)));}
float cell(vec3 p){return cell2(p).x;}
void main(){
 vec3 p=vP;vec3 n=normalize(vN);vec3 rd=normalize(p-ro);vec3 v=-rd;
 if(dot(n,v)<0.)n=normalize(n+v*(.01-dot(n,v)));
 float tip=vTip;
 float gloss=clamp(uSkin.x+uMove.z*.45,0.,1.),glass=uSkin.y,rim=uSkin.z,frost=uSkin.w;
 if(frost>0.){vec3 q=p*18.;n=normalize(n+frost*.35*(vec3(noise(q),noise(q+11.),noise(q+23.))-.5));}
 float mar=smoothstep(.35,.65,fbm(p*1.6+vec3(3.,1.,uPh*.05)))*uMisc.x;
 vec3 base=mix(uC1,uC2,mar);base*=1.+uMove.z*.25;
 base=mix(base,vec3(1.,.32,.18),smoothstep(.35,1.,tip)*uHeat);
 base*=mix(1.,.22,uMisc.y);
 float bs=mix(5.,26.,uDet.z);
 if(uDet.y>0.){vec3 q=p*bs;float f0=fbm(q);float ee=.02;
  vec3 g=vec3(fbm(q+vec3(ee,0.,0.))-f0,fbm(q+vec3(0.,ee,0.))-f0,fbm(q+vec3(0.,0.,ee))-f0)/ee;n=normalize(n-uDet.y*.06*g*(1.-.6*tip));}
 base=mix(base,uTip.rgb*mix(1.,.22,uMisc.y),smoothstep(.15,.95,tip)*uTip.a);
 if(uShape2.x>0.){vec3 bc=film(vBand*.16+.1);base=mix(base,mix(base,bc*1.1,.6),uShape2.x*uMisc.z*smoothstep(-.2,.6,sin(vBand*.5)));}
 if(uBri.x>0.)base=mix(base,uTip.rgb*mix(.75,1.15,vBri)*mix(1.,.22,uMisc.y),smoothstep(.05,1.,vBri)*uBri.x);
 if(uBri.w>0.){vec2 c=cell2(vD*13.+11.);if(hash(c.y+3.)<uBri.w*.25)base=mix(base,uBeadC*mix(1.,.22,uMisc.y),smoothstep(.36,.3,c.x));}
 if(uShape3.w>0.){float f1=fbm(p*1.8+21.),f2=fbm(p*2.3+40.);vec3 pc=mix(mix(uC1,uC2,smoothstep(.35,.6,f1)),mix(uTip.rgb,uCore.rgb,smoothstep(.4,.6,f2)),smoothstep(.45,.6,f2*.9+f1*.2));base=mix(base,pc,uShape3.w);}
 // crevices: where the body dips in, a soft shadow
 float ao=clamp(1.+min(vCav,0.)*2.4*uDet.w,0.,1.)*mix(1.,.7+.3*smoothstep(0.,.5,tip),uDet.w*step(.01,tip));
 vec3 L=normalize(vec3(.4,.85,.5)),L2=normalize(vec3(-.8,.1,-.4));float ndl=dot(n,L);float nv=clamp(dot(n,v),0.,1.);float fr=pow(1.-nv,4.);
 float wrap=mix(.0,.45,uDet.x);
 vec3 diff=base*(.12+.88*max((ndl+wrap)/(1.+wrap),0.)*mix(1.,max(ndl,0.),.3))*mix(.35,1.,ao);
 diff+=base*vec3(.55,.8,1.)*.18*max(dot(n,normalize(vec3(1.,.1,0.))),0.)*ao+base*vec3(1.,.55,.85)*.14*max(dot(n,vec3(-1.,0.,0.)),0.)*ao;
 vec3 sheen=mix(base,vec3(1.),.4)*pow(1.-nv,2.5)*(1.-gloss)*.9*ao;
 vec3 r=reflect(rd,n);float sp=mix(6.,300.,gloss);
 float spec=(pow(max(dot(r,L),0.),sp)+.35*pow(max(dot(r,L2),0.),sp*.6))*mix(.05,2.4,gloss*gloss);
 vec3 refl=env(r)*mix(.02,1.,gloss)*(.06+.94*fr)*mix(.4,1.,ao);
 // light through the slime: the body is thickest straight through the middle, thin at the edges and on spikes
 float th=mix(2.*nv*length(p),.25,smoothstep(.1,.6,tip));
 float thin=clamp(1.-nv+tip*.6,0.,1.);
 vec3 deep=pow(base,vec3(1.6))*1.5;
 vec3 trans=deep*(thin*.6+exp(-th*1.4)*1.2*(.5+.5*max(dot(rd,L),0.)+.6*pow(max(dot(rd,-L2),0.),2.)));
 vec3 surf=diff*(1.-.45*uDet.x)+trans*uDet.x+sheen+spec+refl;
 if(glass>0.){vec3 rr=refract(rd,n,.7);vec3 q=p*2.+rr*1.2;float ir=fbm(q);float ir2=fbm(q*2.7+5.);
  float vein=pow(smoothstep(.38,.72,ir),1.5)+.8*pow(smoothstep(.5,.8,ir2),2.);float cau=pow(1.-abs(2.*noise(p*3.5+rr*2.)-1.),6.);
  vec3 neon=mix(uC2,vec3(.2,1.,.9),smoothstep(.5,.8,ir2));vec3 inside=mix(base*.3,neon*1.3,clamp(vein,0.,1.)*.8)+mix(vec3(.3,1.,.9),uC2,.5)*cau*.8;inside+=film(ir*2.+fr)*base*uMisc.z*.8*vein;
  inside+=env(rr)*.35*mix(base,vec3(1.),.3);
  vec3 gl=inside*exp(-th*.25)+env(r)*(.04+fr*.7)+spec;
  surf=mix(surf,gl,glass);}
 if(uMisc.z>0.)surf+=film(fr*1.2+n.y*.3+p.x*.2)*fr*uMisc.z*.9;
 surf+=mix(base,vec3(1.),.5)*pow(1.-nv,7.)*rim*2.2;
 // the colour inside and the lamp: seen through the body, brightest straight through the middle
 float core=pow(nv,2.2)*(1.-smoothstep(.2,.8,tip));
 if(uCore.a>0.){float wob=fbm(p*2.5+3.);surf=mix(surf,uCore.rgb*mix(.8,1.3,wob)*(.6+.4*max(ndl,0.)),core*uCore.a*(.4+.6*uDet.x)*.85);}
 {vec3 lc=mix(base,uLampC,.5);float sss=exp(-th*.9);surf+=lc*uMisc.w*(core*.9+sss*.35+thin*.25)*(.7+.6*uDet.x)+uLampC*uMisc.w*pow(core,4.)*.45;}
 if(frost>0.){vec3 gq=p*mix(38.,70.,frost);float gc=cell(gq);vec3 gh=hash3(floor(gq));float gl2=pow(max(dot(reflect(rd,normalize(gh-.5+n*1.5)),L),0.),40.);surf+=vec3(1.,.97,1.)*smoothstep(.22,.05,gc)*gl2*frost*2.5;}
 if(uExt.w>0.){float gw=uExt.w;
  vec3 gq=floor(p*230.);float g1=hash(dot(gq,vec3(1.,57.,113.)));float g2=noise(p*90.);
  float rake=.6+.8*(1.-abs(dot(n,L)));
  surf*=1.+gw*(.22*(g1-.5)+.12*(g2-.5))*rake;
  surf*=1.+gw*.14*(fbm(p*6.+11.)-.5);
  surf*=1.+gw*.05*sin(dot(p,normalize(vec3(.2,1.,.1)))*160.+noise(p*8.)*6.);
  surf=mix(surf,mix(base,vec3(1.),.55)*(.6+.4*max(dot(n,L),0.)),gw*.35*pow(1.-nv,2.5));
  vec3 fq=p*60.;float fc=cell(fq);vec3 fh=hash3(floor(fq)+7.);
  float flake=smoothstep(.16,.05,fc*(.7+.6*fh.x))*step(.55,fh.y);
  float glint=.3+.7*pow(max(dot(reflect(rd,normalize(n+(fh-.5)*1.4)),L),0.),6.);
  surf+=mix(vec3(1.),mix(base,vec3(1.),.6),.4)*flake*(.35+.65*smoothstep(.75,.15,nv))*glint*gw*.8;
  float speck=smoothstep(.1,.04,cell(p*34.+5.))*step(.82,hash3(floor(p*34.+5.)).z);surf*=1.-speck*gw*.35;}
 vec3 col=surf;
 col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
 col+=(hash(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))-.5)*.045*uExt.w;col=pow(clamp(col,0.,1.),vec3(.95));
 gl_FragColor=vec4(col,1.);}`;
  // the background behind it: dark grey with a soft vignette, like the raymarcher
  const BG_VS = 'attribute vec2 p;varying vec2 q;void main(){q=p;gl_Position=vec4(p,.9999,1.);}';
  const BG_FS = 'precision mediump float;varying vec2 q;uniform vec2 R;void main(){vec2 uv=q*.5*vec2(R.x/R.y,1.);vec3 c=vec3(.059,.059,.071)*(1.-.25*length(uv));c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);gl_FragColor=vec4(pow(c,vec3(.95)),1.);}';

  const hex = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) / 255);

  // a sphere made by splitting an icosahedron's triangles `level` times (every point on the unit sphere)
  function icosphere(level) {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let l = 0; l < level; l++) {
      const cache = new Map(), F2 = [];
      const mid = (a, b) => {
        const k = a < b ? a * 1e7 + b : b * 1e7 + a;
        let i = cache.get(k);
        if (i == null) { const m = [0, 1, 2].map((j) => (V[a][j] + V[b][j]) / 2), len = Math.hypot(...m); i = V.length; V.push(m.map((x) => x / len)); cache.set(k, i); }
        return i;
      };
      for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F = F2;
    }
    const pos = new Float32Array(V.length * 3);
    V.forEach((v, i) => pos.set(v, i * 3));
    const idx = new Uint32Array(F.length * 3);
    F.forEach((f, i) => idx.set(f, i * 3));
    return { pos, idx };
  }

  function create(cv, opts = {}) {
    const gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: false });
    if (!gl) return { ok: false, draw() {}, lose() {} };
    const big = gl.getExtension('OES_element_index_uint');
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    const pr = prog(VS, FS), bg = prog(BG_VS, BG_FS);
    // detail: 7 splits = 164k points / 328k triangles (needs 32-bit indices), 6 without them
    const level = opts.detail || (big ? 7 : 6);
    const sp = icosphere(level);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, sp.pos, gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? sp.idx : new Uint16Array(sp.idx), gl.STATIC_DRAW);
    const nIdx = sp.idx.length;
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const NAMES = ['uLive', 'uRip', 'uRipA', 'uPV', 'ro', 'T', 'uPh', 'uShape', 'uShape2', 'uSpk', 'uSkin', 'uC1', 'uC2', 'uLampC', 'uMisc', 'uHeat', 'uMove', 'uTip', 'uDet', 'uExt', 'uCore', 'uShape3', 'uBri', 'uBeadC', 'uSpk2'];
    const U = {}; NAMES.forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
    const aPos = gl.getAttribLocation(pr, 'pos'), aBg = gl.getAttribLocation(bg, 'p'), uR = gl.getUniformLocation(bg, 'R');
    const sub = (a, b) => a.map((x, i) => x - b[i]), nz = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return {
      ok: true, triangles: nIdx / 3,
      draw(L, o = {}) {
        const g = (k, d = 0) => (L[k] == null ? d : L[k]);
        const yaw = o.yaw == null ? 0.5 : o.yaw, pitch = o.pitch == null ? 0.25 : o.pitch, dist = o.dist || 4.6;
        const ro = [dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch)];
        // the same camera as the raymarcher: looking at the middle, focal length 1.25 picture heights
        const fw = nz(sub([0, 0, 0], ro)), rt = nz(cross(fw, [0, 1, 0])), up = cross(rt, fw);
        const W = cv.width, H = cv.height, asp = W / H, f = 1.25 * 2, near = 0.1, far = 30;
        const view = [rt[0], up[0], -fw[0], 0, rt[1], up[1], -fw[1], 0, rt[2], up[2], -fw[2], 0, -dot(rt, ro), -dot(up, ro), dot(fw, ro), 1];
        const proj = [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
        const pv = new Float32Array(16);
        for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += proj[k * 4 + r] * view[c * 4 + k]; pv[c * 4 + r] = s; }
        gl.viewport(0, 0, W, H);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
        gl.useProgram(bg); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.enableVertexAttribArray(aBg); gl.vertexAttribPointer(aBg, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(uR, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(aBg);
        gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
        gl.useProgram(pr);
        gl.uniformMatrix4fv(U.uPV, false, pv); gl.uniform3fv(U.ro, ro);
        gl.uniform1f(U.T, (o.t || 0) % 3600); gl.uniform1f(U.uPh, o.ph == null ? (o.t || 0) * g('speed', 0.5) : o.ph % 3600);
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
        { const lv = o.live || {}; gl.uniform4f(U.uLive, lv.level || 0, lv.pump || 0, lv.hit || 0, lv.shimmer || 0);
          const R6 = new Float32Array(24).fill(0), A = new Float32Array(6);
          for (let i = 0; i < 6; i++) { const q = (o.ripples || [])[i]; if (q) { R6.set([q.d[0], q.d[1], q.d[2], q.age], i * 4); A[i] = q.amp; } else R6[i * 4 + 3] = -1; }
          gl.uniform4fv(U.uRip, R6); gl.uniform1fv(U.uRipA, A); }
        gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.drawElements(gl.TRIANGLES, nIdx, big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
        gl.disableVertexAttribArray(aPos);
      },
      lose() { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
    };
  }
  window.BLOBMESH = { create };
})();
