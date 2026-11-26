/* BLOB window: paint a sound on a glossy blob. Needs blob-engine.js and blob.css.

   const ui = BLOB.mount(el, { engine, makeEngine, patch, onChange, keys, logo });
     engine      a BlobEngine (from BlobEngine.create), or
     makeEngine  () => engine, called the first time a sound is needed (a page can make its
                 AudioContext there, after a click)
     onChange    (patch) => {}, after every finished edit (save it with the lane)
     keys        false = don't play from the computer keyboard (the host has its own keys)
   ui.getPatch(), ui.setPatch(p), ui.setEngine(e), ui.noteOn(n), ui.noteOff(n), ui.destroy()

   The blob is drawn in WebGL: glossy balls melted together (a raymarched metaball shape),
   each ball carrying a colour. The sound shakes it: lows = a big pulse, mids = a slow wobble,
   highs = a fine ripple, HEAT/CRUSH = spikes. Moving colours travel over it. */
(function () {
  'use strict';
  const B = window.BlobEngine;
  if (!B) { console.error('BLOB: load blob-engine.js first'); return; }
  const { COL, I, OSC, SCOL, MODES, MAXB, isSnd } = B;
  const KIND = { sound: 'SOUND', shape: 'SHAPE', fx: 'EFFECTS' }, KDESC = { sound: 'what makes the tone', shape: 'how each note moves', fx: 'what happens after' };
  const ci = B.ci;
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const KEYMAP = 'awsedftgyhujkolp;';
  const SCALE = [3, 5, 6, 8, 10, 11, 1];   // D# minor, Eman's favourite key: those keys are lit
  // LISTEN: a short loop in D# minor that suits the mode ([note, beat, length])
  const LOOPS = {
    DEFAULT: [[51, 0, 2], [54, 2, 2], [58, 4, 2], [59, 6, 2]],
    SYNTH: [[63, 0, 1], [66, 1, 1], [70, 2, 1], [68, 3, 1], [66, 4, 2], [63, 6, 1], [61, 7, 1]],
    BASS: [[51, 0, 1.5], [51, 2, 0.5], [54, 3, 1], [59, 4, 1.5], [58, 6, 1], [56, 7, 1]],
    PLUCK: [[63, 0, 0.5], [70, 0.5, 0.5], [66, 1, 0.5], [75, 1.5, 0.5], [63, 2, 0.5], [70, 2.5, 0.5], [66, 3, 0.5], [73, 3.5, 0.5], [59, 4, 0.5], [66, 4.5, 0.5], [63, 5, 0.5], [71, 5.5, 0.5], [58, 6, 0.5], [65, 6.5, 0.5], [61, 7, 0.5], [70, 7.5, 0.5]],
    PAD: [[51, 0, 4], [54, 0, 4], [58, 0, 4], [47, 4, 4], [51, 4, 4], [54, 4, 4]],
    KEYS: [[63, 0, 1], [70, 1, 1], [66, 2, 1], [70, 3, 1], [59, 4, 1], [66, 5, 1], [63, 6, 1], [66, 7, 1]]};

  const HTML = `
 <header>
  <img class="logo" alt="BLOB">
  <div class="pre"><button data-r="pp" aria-label="Previous sound">‹</button><b data-r="pn">Saw Circle</b><button data-r="pnx" aria-label="Next sound">›</button></div>
  <button class="hb2" data-r="undo" title="Undo (Ctrl+Z)">UNDO</button>
  <div class="modes" data-r="modes"></div>
  <button class="hbtn" data-r="listen">▶ LISTEN</button>
  <label class="vol">VOL <input data-r="vol" type="range" min="0" max="150" value="100" aria-label="Volume"></label>
 </header>
 <aside class="l">
  <h6>HANDS</h6>
  <div class="tools" data-r="tools"></div>
  <div class="paint" data-r="paint"></div>
  <p class="how">Pick a colour, then drag over the blob. The more of a colour, the stronger it gets. <b>Double-click</b> a blob to dip the whole thing in the colour. Colours with a moving dot also move on the blob.</p>
 </aside>
 <div class="stage" data-r="stage">
  <canvas data-r="gl"></canvas>
  <div class="tags" data-r="tags"></div>
  <div class="hint" data-r="hint"></div>
  <div class="drop">DROP A SOUND · IT BECOMES ITS OWN BLOB</div>
  <div class="toast" data-r="toast"></div>
  <div class="cover" data-r="cover"><button data-r="wake">WAKE THE BLOB</button><small>turns the sound on · then play with A S D F G H J K or the keys below</small></div>
 </div>
 <aside class="r">
  <h6>BLOBS · EACH ONE IS A SYNTH</h6>
  <div class="lays" data-r="lays"></div>
  <button class="addb" data-r="addb">+ BLOB</button>
  <p class="how"><b>Up</b> = an octave higher. <b>Left / right</b> = pan. <b>Scroll</b> on a blob = bigger or smaller.</p>
  <h6 data-r="wh">WHAT IT SOUNDS LIKE</h6>
  <div class="words" data-r="words"></div>
  <h6>ITS SHAPE</h6>
  <div class="meters" data-r="meters"></div>
  <p class="how"><b>Wider</b> = wider and more voices. <b>Taller</b> = brighter. <b>Hanging down</b> = more low end. <b>Deeper</b> = softer start. <b>Bigger</b> = louder and a longer tail.</p>
  <h6>SOUNDS IN THE BLOB</h6>
  <div class="samples" data-r="samples"></div>
  <button class="addsnd" data-r="addsnd"><b>+ DROP A SOUND</b><small>any audio file becomes its own blob and a paint. Paint it on, or move it close, to mix it in.</small></button>
  <input type="file" data-r="file" accept="audio/*" hidden>
 </aside>
 <div class="keys">
  <div class="oct"><span>OCTAVE</span><div><button data-r="om" aria-label="Octave down">−</button><b data-r="ov">4</b><button data-r="op" aria-label="Octave up">+</button></div></div>
  <div class="kb" data-r="kb"></div>
 </div>`;

  // ---------- the WebGL blob ----------
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;uniform vec2 R;uniform vec4 B[${MAXB}];uniform vec3 C[${MAXB}];uniform int N;uniform vec3 ro;uniform vec3 fw;uniform vec3 rt;uniform vec3 up;
uniform float T;uniform float E;uniform float L;uniform float M;uniform float H;uniform float D;uniform float K;
float sm(float a,float b,float k,out float h){h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec4 mp(vec3 p){float d=1e5;vec3 c=vec3(1.);float h;for(int i=0;i<${MAXB};i++){if(i>=N)break;float di=length(p-B[i].xyz)-B[i].w;if(i==0){d=di;c=C[i];}else{d=sm(di,d,K,h);c=mix(c,C[i],h);}}
 float w=sin(p.x*4.+T*1.3)*sin(p.y*3.6-T*1.1)*sin(p.z*4.4+T*.9);
 float m=sin(p.x*7.+T*3.1)*sin(p.y*6.3+T*2.3)*sin(p.z*6.8-T*2.7);
 float r=sin(p.x*17.+T*9.)*sin(p.y*15.-T*11.)*sin(p.z*16.+T*7.);
 float s=pow(abs(sin(p.x*9.+T*2.)*sin(p.y*8.5)*sin(p.z*9.5-T*1.5)),3.);
 d+=w*(.014+L*.11)+m*M*.05+r*H*.026-s*D*.11;return vec4(c,d);}
vec3 nr(vec3 p){vec2 e=vec2(.004,-.004);return normalize(e.xyy*mp(p+e.xyy).w+e.yyx*mp(p+e.yyx).w+e.yxy*mp(p+e.yxy).w+e.xxx*mp(p+e.xxx).w);}
void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;vec3 rd=normalize(fw*1.9+rt*uv.x+up*uv.y);float t=0.;vec4 r;bool hit=false;float md=1e5,tm=0.;vec3 mc=vec3(0.);
 for(int i=0;i<72;i++){r=mp(ro+rd*t);if(r.w<md){md=r.w;mc=r.rgb;tm=t;}if(r.w<.002){hit=true;break;}t+=r.w*.85;if(t>16.)break;}
 vec3 col=vec3(0.);float a=0.;
 // soft edge: a ray that just missed still gets the skin, fading out over about a pixel
 float px=tm*1.6/(1.9*R.y),cov=hit?1.:clamp(1.-md/px,0.,1.);
 if(cov>0.){if(!hit){t=tm;r=mp(ro+rd*t);}vec3 p=ro+rd*t,n=nr(p),l=normalize(vec3(.5,.9,.8)),l2=normalize(vec3(-.8,-.1,.4));vec3 c=r.rgb;
  float df=max(dot(n,l),0.),wr=df*.5+.5,vf=max(dot(n,-rd),0.),fr=pow(1.-vf,3.),sp=pow(max(dot(reflect(rd,n),l),0.),70.),sp2=pow(max(dot(reflect(rd,n),l2),0.),24.),bk=max(dot(n,l2),0.);
  vec3 sss=mix(c,vec3(1.),.3);
  col=c*wr*.9+sss*(n.y*.5+.5)*.16+c*bk*.2;
  vec3 iri=.5+.5*cos(6.283*(fr*.8+n.y*.2+T*.03+vec3(0.,.33,.67)));col+=mix(c,iri,.6)*fr*.75;
  col+=vec3(1.)*sp*.95+vec3(.85,.9,1.)*sp2*.25;col*=1.+E*.3;a=cov;}
 if(cov<1.){float g=exp(-md*7.)*(.16+E*.55),ga=clamp(g*1.4,0.,1.);vec3 gc=ga>.001?mc*g/ga:vec3(0.);col=mix(gc,col,cov);a=cov+ga*(1.-cov);}
 gl_FragColor=vec4(pow(col,vec3(.92)),a);}`;

  function mount(el, opts = {}) {
    opts = { keys: true, ...opts };
    el.classList.add('blob-root'); el.innerHTML = HTML;
    const R = {}; el.querySelectorAll('[data-r]').forEach((n) => { R[n.dataset.r] = n; });
    const logo = el.querySelector('.logo');
    logo.src = opts.logo || BLOB.logo;

    // ---------- state ----------
    const S = { p: B.tidy(opts.patch), active: 0, tool: 'paint', col: 'SQUARE', oct: 4, yaw: 0.5, pitch: 0.22, zoom: 1, dist: 5, tgt: [0, 0, 0],
      energy: 0, lo: 0, mid: 0, hi: 0, t0: performance.now(), preI: 0 };
    let engine = opts.engine || null, dead = false;
    const hist = [], HMAX = 60;
    const synths = () => B.synths(S.p);
    const visible = () => el.isConnected && el.getClientRects().length > 0;
    const grp = (id) => S.p.groups.find((g) => g.id === id);
    const measure = (id) => B.measure(S.p, id);
    const gc = (id) => B.centre(S.p, id);
    // a paint: one of the colours, or "S:<id>" = a dropped sound used as paint
    const paintOf = (k) => {
      if (isSnd(k)) { const g = grp(+k.slice(2)); return { n: g ? String(g.name).toUpperCase().slice(0, 14) : 'SOUND', d: 'your sound', c: SCOL[((g && g.col) || 0) % SCOL.length], key: k, snd: 1 }; }
      const C = COL[ci(k)] || COL[0]; return { ...C, key: C.n };
    };
    const cur = () => paintOf(S.col);
    const nextId = () => Math.max(-1, ...S.p.groups.map((g) => g.id)) + 1;

    function eng() {
      if (!engine && opts.makeEngine) { engine = opts.makeEngine(); if (engine) engine.setPatch(S.p, true); }
      if (engine && engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => { /* closed by the host */ });
      return engine;
    }
    function snapshot() { const { sounds, ...rest } = S.p; return JSON.stringify(rest); }
    // the patch as saved: sound data that no blob uses any more (squished away) stays only for undo
    function outPatch() { const p = B.clone(S.p); for (const k in p.sounds) if (!p.groups.some((g) => g.sound === k)) delete p.sounds[k]; return p; }
    const fixCol = () => { if (isSnd(S.col) && !grp(+S.col.slice(2))) S.col = 'SQUARE'; };   // the sound this paint was is gone
    let lastSnap = snapshot();
    // live = while dragging (sound follows, no undo step, no save)
    function changed(live) {
      if (engine) engine.setPatch(S.p, true);
      renderPaint(); renderLays(); renderRight(); renderSamples();
      if (live) return;
      const now = snapshot();
      if (now !== lastSnap) { hist.push(lastSnap); if (hist.length > HMAX) hist.shift(); lastSnap = now; R.undo.disabled = false; if (opts.onChange) opts.onChange(outPatch()); }
    }
    function undo() {
      const s = hist.pop(); if (!s) return; const sounds = S.p.sounds;
      S.p = B.tidy({ ...JSON.parse(s), sounds }); lastSnap = s; R.undo.disabled = !hist.length;
      if (!grp(S.active) || grp(S.active).kind !== 'synth') S.active = synths()[0].id; fixCol();
      R.pn.textContent = S.p.name; setMode(S.p.mode, 1, 1); changed(1);
      if (opts.onChange) opts.onChange(outPatch());
      toast('Undone');
    }
    function setPatch(p, keepHist) {
      S.p = B.tidy(p); S.active = synths()[0].id; R.pn.textContent = S.p.name; fixCol();
      if (!keepHist) { hist.length = 0; R.undo.disabled = true; }
      lastSnap = snapshot(); setMode(S.p.mode, 1, 1); fitCam(true); changed(1);
    }
    function loadPreset(i) {
      S.preI = ((i % B.PRESETS.length) + B.PRESETS.length) % B.PRESETS.length;
      const np = B.fromPreset(S.preI);
      // dropped sounds stay: they float beside the new blobs
      const keep = S.p.groups.filter((g) => g.kind === 'sound'); let id = nextId() + 100;
      keep.forEach((g) => { const nid = id++; S.p.balls.filter((b) => b.g === g.id).forEach((b) => np.balls.push({ ...b, g: nid })); np.groups.push({ ...g, id: nid }); });
      np.sounds = S.p.sounds; np.level = S.p.level;
      hist.push(lastSnap); R.undo.disabled = false;
      S.p = B.tidy(np); S.active = synths()[0].id; R.pn.textContent = S.p.name; setMode(S.p.mode, 1); fitCam();
      if (isSnd(S.col)) S.col = 'SQUARE';   // the sounds have new ids now
      lastSnap = snapshot(); changed(1); if (opts.onChange) opts.onChange(outPatch());
    }

    // ---------- WebGL ----------
    const cv = R.gl;
    let gl = null; try { gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false }); } catch (e) { gl = null; }
    let PR = null; const U = {};
    function shader(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    if (gl) {
      try {
        PR = gl.createProgram(); gl.attachShader(PR, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(PR, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(PR); gl.useProgram(PR);
        const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const lp = gl.getAttribLocation(PR, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
        ['R', 'B', 'C', 'N', 'ro', 'fw', 'rt', 'up', 'T', 'E', 'L', 'M', 'H', 'D', 'K'].forEach((k) => { U[k] = gl.getUniformLocation(PR, k); });
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } catch (e) { console.error('BLOB shader', e); gl = null; }
    }
    if (!gl) { const d = document.createElement('div'); d.className = 'nogl'; d.textContent = 'This browser has WebGL turned off, so the blob cannot be drawn. The keys still play.'; R.stage.appendChild(d); }

    // the camera looks at the middle of all the blobs and backs off to fit them
    function fitCam(snap) {
      const bs = S.p.balls; if (!bs.length) return;
      let c = [0, 0, 0], V = 0; bs.forEach((b) => { const v = b.r ** 3; c = add(c, b.p, v); V += v; }); c = c.map((x) => x / V);
      let rad = 0; bs.forEach((b) => { rad = Math.max(rad, Math.hypot(...add(b.p, c, -1)) + b.r); });
      S.tgtT = c; S.distT = clamp(rad * 2.7 + 2.6, 5.4, 15);
      if (snap) { S.tgt = c.slice(); S.dist = S.distT; }
    }
    function cam() {
      const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch), d = S.dist * S.zoom;
      const ro = add(S.tgt, [d * sy * cp, d * sp, d * cy * cp]);
      const fw = norm(add(S.tgt, ro, -1)), rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
      return { ro, fw, rt, up };
    }
    let scale = 0.6;
    function sizeGL() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(2, Math.round(r.width * dpr * scale)), h = Math.max(2, Math.round(r.height * dpr * scale));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    }
    function ballCol(b) {
      const g = grp(b.g); if (g && g.kind === 'sound') return hex(SCOL[(g.col || 0) % SCOL.length]);
      let c = hex(paintOf(b.c).c); if (g && g.mute) c = c.map((x) => x * 0.35 + 0.08); return c;
    }
    // moving colours (WOBBLE, PHASER, SHIMMER, ECHO) travel over the blob; where a ball is drawn this frame
    function liveP(b, i, now) {
      const C = COL[ci(b.c)]; if (!C || !C.mv || b.core) return [b.p, b.r];
      const g = grp(b.g); if (!g || g.kind !== 'synth' || g.mute) return [b.p, b.r];
      const c = gc(b.g), sec = now / 1000, act = 0.35 + S.energy * 1.6, v = add(b.p, c, -1);
      if (C.n === 'PHASER' || C.n === 'SHIMMER') {
        const spd = (C.n === 'PHASER' ? 0.55 : 0.9) * act * (i % 2 ? 1 : -1), a = sec * spd, ca = Math.cos(a), sa = Math.sin(a);
        const q = [v[0] * ca - v[2] * sa, v[1] + Math.sin(sec * 1.7 + i) * 0.08 * act, v[0] * sa + v[2] * ca];
        return [add(c, q), b.r * (1 + 0.12 * Math.sin(sec * 3 + i) * act)];
      }
      if (C.n === 'WOBBLE') { const k = 1 + 0.22 * Math.sin(sec * (2.4 + i * 0.3)) * act; return [add(c, v, k), b.r * (1 + 0.15 * Math.cos(sec * 2.4 + i) * act)]; }
      if (C.n === 'ECHO') { const beat = (60 / 130) * 0.75, ph = (sec % beat) / beat; return [add(c, v, 1 + 0.18 * (1 - ph) * act), b.r * (1 + 0.25 * (1 - ph) * S.energy)]; }
      return [b.p, b.r];
    }
    let ft = 16, lastF = performance.now(), raf = 0;
    const tbuf = new Float32Array(1024), fbuf = new Uint8Array(512);
    function frame(now) {
      if (dead) return; raf = requestAnimationFrame(frame);
      const dt = Math.min(100, now - lastF); lastF = now;
      if (!visible()) return;   // hidden: rest
      if (engine) {
        const an = engine.analyser; an.getFloatTimeDomainData(tbuf);
        let s = 0; for (let i = 0; i < tbuf.length; i++) s += tbuf[i] * tbuf[i];
        const rms = Math.sqrt(s / tbuf.length); S.energy += (Math.min(1, rms * 5) - S.energy) * 0.3;
        an.getByteFrequencyData(fbuf); let lo = 0, mid = 0, hi = 0;
        for (let i = 1; i < 12; i++) lo += fbuf[i]; for (let i = 12; i < 60; i++) mid += fbuf[i]; for (let i = 60; i < 300; i++) hi += fbuf[i];
        lo = Math.min(1, lo / 11 / 200); mid = Math.min(1, mid / 48 / 170); hi = Math.min(1, hi / 240 / 120);
        S.lo += (lo - S.lo) * 0.35; S.mid += (mid - S.mid) * 0.3; S.hi += (hi - S.hi) * 0.35;
      } else { S.energy *= 0.9; S.lo *= 0.9; S.mid *= 0.9; S.hi *= 0.9; }
      if (!gl) return;
      sizeGL(); ft = ft * 0.9 + dt * 0.1;
      if (ft > 30 && scale > 0.38) scale -= 0.02; else if (ft < 18 && scale < 0.8) scale += 0.01;
      if (!drag && !held.size && !LT) S.yaw += dt * 0.00006;
      if (S.tgtT) { S.tgt = S.tgt.map((x, i) => x + (S.tgtT[i] - x) * 0.08); S.dist += (S.distT - S.dist) * 0.08; }
      const C = cam(), n = Math.min(MAXB, S.p.balls.length), Bv = new Float32Array(MAXB * 4), Cv = new Float32Array(MAXB * 3);
      S.p.balls.slice(0, n).forEach((b, i) => {
        const [p, r] = liveP(b, i, now), j = S.lo * 0.05 * Math.sin(now / 70 + i * 1.7);
        Bv.set([p[0], p[1] + j, p[2], r * (1 + S.lo * 0.07)], i * 4); Cv.set(ballCol(b), i * 3);
      });
      let heat = 0; synths().forEach((g) => { if (g.mute) return; const m = measure(g.id); if (m) heat = Math.max(heat, m.amt[I.HEAT] + m.amt[I.CRUSH] * 0.6); });
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.R, cv.width, cv.height); gl.uniform4fv(U.B, Bv); gl.uniform3fv(U.C, Cv); gl.uniform1i(U.N, n);
      gl.uniform3fv(U.ro, C.ro); gl.uniform3fv(U.fw, C.fw); gl.uniform3fv(U.rt, C.rt); gl.uniform3fv(U.up, C.up);
      gl.uniform1f(U.T, (now - S.t0) / 1000); gl.uniform1f(U.E, S.energy); gl.uniform1f(U.L, S.lo); gl.uniform1f(U.M, S.mid); gl.uniform1f(U.H, S.hi);
      gl.uniform1f(U.D, Math.min(1, heat) * S.energy * 1.5); gl.uniform1f(U.K, 0.3);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      tagsDraw(C);
    }

    // ---------- picking on the CPU with the same shape ----------
    function sdf(p) {
      let d = 1e5;
      S.p.balls.forEach((b, i) => { const di = Math.hypot(p[0] - b.p[0], p[1] - b.p[1], p[2] - b.p[2]) - b.r; if (i === 0) d = di; else { const h = clamp(0.5 + (0.5 * (d - di)) / 0.3, 0, 1); d = d * (1 - h) + di * h - 0.3 * h * (1 - h); } });
      return d;
    }
    function ray(cx, cy) { const r = cv.getBoundingClientRect(), C = cam(), uvx = (cx - r.left - r.width / 2) / r.height, uvy = -(cy - r.top - r.height / 2) / r.height; return { C, ro: C.ro, rd: norm(add(add(C.fw.map((x) => x * 1.9), C.rt, uvx), C.up, uvy)) }; }
    function pick(cx, cy) {
      const { ro, rd, C } = ray(cx, cy); let t = 0;
      for (let i = 0; i < 90; i++) {
        const p = add(ro, rd, t), d = sdf(p);
        if (d < 0.003) { const e = 0.004, n = norm([sdf(add(p, [e, 0, 0])) - sdf(add(p, [-e, 0, 0])), sdf(add(p, [0, e, 0])) - sdf(add(p, [0, -e, 0])), sdf(add(p, [0, 0, e])) - sdf(add(p, [0, 0, -e]))]); return { p, n, t, C }; }
        t += d * 0.9; if (t > 16) break;
      }
      return null;
    }
    function planePt(cx, cy, P) { const { ro, rd, C } = ray(cx, cy), den = dot(rd, C.fw), t = dot(add(P, ro, -1), C.fw) / den; return add(ro, rd, t); }
    function proj(P, C) { const r = cv.getBoundingClientRect(), v = add(P, C.ro, -1), z = dot(v, C.fw); if (z < 0.1) return null; return [r.width / 2 + (dot(v, C.rt) / z) * 1.9 * r.height, r.height / 2 - (dot(v, C.up) / z) * 1.9 * r.height]; }
    function nearestBall(p) { let bi = 0, bd = 1e9; S.p.balls.forEach((b, i) => { const d = Math.hypot(p[0] - b.p[0], p[1] - b.p[1], p[2] - b.p[2]) - b.r; if (d < bd) { bd = d; bi = i; } }); return S.p.balls[bi]; }
    function setActive(id) { const g = grp(id); if (g && g.kind === 'synth' && S.active !== id) { S.active = id; changed(1); } }

    // ---------- hands ----------
    let drag = null;
    function full() { if (S.p.balls.length >= MAXB) { toast('The blobs are full. SQUISH some bits away first.'); drag = null; return true; } return false; }
    function paintAt(h) {
      const nb = nearestBall(h.p), g = grp(nb.g);
      if (!g || g.kind !== 'synth') { toast('That is a dropped sound. Pick it under YOUR SOUNDS and paint it onto a blob, or MOVE it close.'); drag = null; return; }
      const P = add(h.p, h.n, -0.1), c = cur().key;
      const near = S.p.balls.find((b) => b.g === g.id && !b.core && b.c === c && Math.hypot(...add(P, b.p, -1)) < 0.12);
      if (near) { near.r = Math.min(0.32, near.r + 0.006); changed(1); return; }
      if (full()) return;
      S.p.balls.push({ p: P, r: 0.17, c, g: g.id, core: 0 }); changed(1);
    }
    function squishAt(h) {
      const before = S.p.balls.length;
      S.p.balls = S.p.balls.filter((b) => b.core || Math.hypot(...add(h.p, b.p, -1)) - b.r > 0.12);
      S.p.groups = S.p.groups.filter((g) => g.kind === 'synth' || S.p.balls.some((b) => b.g === g.id));
      S.p.balls = S.p.balls.filter((b) => !isSnd(b.c) || grp(+b.c.slice(2)));
      if (!isSnd(S.col) || grp(+S.col.slice(2))) { /* paint still there */ } else S.col = 'SQUARE';
      if (S.p.balls.length !== before) changed(1);
    }
    function onDown(ev) {
      ev.preventDefault(); cover(0);
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic */ }
      const h = pick(ev.clientX, ev.clientY);
      if (!h || ev.button === 2 || ev.altKey) { drag = { kind: 'orbit', x: ev.clientX, y: ev.clientY, yaw: S.yaw, pitch: S.pitch }; return; }
      const nb = nearestBall(h.p); setActive(nb.g);
      if (S.tool === 'paint') { drag = { kind: 'paint' }; paintAt(h); }
      else if (S.tool === 'smear') drag = { kind: 'smear', from: h.p, c: nb.c, g: nb.g, lastP: h.p, r: clamp(nb.r * 0.5, 0.16, 0.34) };
      else if (S.tool === 'squish') { drag = { kind: 'squish' }; squishAt(h); }
      else if (S.tool === 'move') { const g = nb.g, start = planePt(ev.clientX, ev.clientY, h.p); drag = { kind: 'move', g, start, orig: S.p.balls.filter((b) => b.g === g).map((b) => [b, b.p.slice()]) }; }
    }
    function onMove(ev) {
      if (!drag) { const h = pick(ev.clientX, ev.clientY); cv.style.cursor = h ? (S.tool === 'move' ? 'grab' : 'crosshair') : 'grab'; return; }
      if (drag.kind === 'orbit') { S.yaw = drag.yaw - (ev.clientX - drag.x) * 0.008; S.pitch = clamp(drag.pitch + (ev.clientY - drag.y) * 0.006, -1.2, 1.2); return; }
      if (drag.kind === 'paint') { const h = pick(ev.clientX, ev.clientY); if (h) paintAt(h); return; }
      if (drag.kind === 'squish') { const h = pick(ev.clientX, ev.clientY); if (h) squishAt(h); return; }
      if (drag.kind === 'smear') {
        const P = planePt(ev.clientX, ev.clientY, drag.from), d = Math.hypot(...add(P, drag.lastP, -1));
        if (d > 0.13) { if (full()) return; const tot = Math.hypot(...add(P, drag.from, -1)); S.p.balls.push({ p: P, r: Math.max(0.07, drag.r * (1 - tot * 0.28)), c: drag.c, g: drag.g, core: 0 }); drag.lastP = P; changed(1); }
        return;
      }
      if (drag.kind === 'move') { const P = planePt(ev.clientX, ev.clientY, drag.start), dv = add(P, drag.start, -1); drag.orig.forEach(([b, o]) => { b.p = add(o, dv); }); changed(1); }
    }
    function onUp() { const k = drag && drag.kind; drag = null; if (k && k !== 'orbit') { fitCam(); changed(); } }
    function onDbl(ev) {
      const h = pick(ev.clientX, ev.clientY); if (!h) return;
      const nb = nearestBall(h.p), g = grp(nb.g); if (!g || g.kind !== 'synth') return;
      const core = S.p.balls.find((b) => b.g === g.id && b.core); if (!core) return;
      core.c = cur().key; toast(`${g.name} dipped in ${cur().n}`); changed();
    }
    let wheelT = 0;
    function onWheel(ev) {
      ev.preventDefault(); const h = pick(ev.clientX, ev.clientY), k = ev.deltaY < 0 ? 1.05 : 1 / 1.05;
      if (!h) { S.zoom = clamp(S.zoom / k, 0.6, 1.8); return; }
      const g = nearestBall(h.p).g, gb = S.p.balls.filter((b) => b.g === g), c = gc(g);
      const sz = Math.cbrt(gb.reduce((s, b) => s + b.r ** 3, 0)); if ((k > 1 && sz > 1.5) || (k < 1 && sz < 0.2)) return;
      gb.forEach((b) => { b.p = add(c, add(b.p, c, -1), k); b.r *= k; }); setActive(g); changed(1);
      clearTimeout(wheelT); wheelT = setTimeout(() => { fitCam(); changed(); }, 350);
    }
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('dblclick', onDbl); cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', onWheel, { passive: false });

    function addBlob() {
      if (S.p.balls.length >= MAXB - 1) { toast('The blobs are full. SQUISH some bits away first.'); return; }
      const ss = synths(), k = ss.length; if (k >= 5) { toast('Five blobs is the most for now.'); return; }
      const id = nextId(), num = Math.max(0, ...ss.map((s) => +String(s.name).split(' ')[1] || 0)) + 1;
      S.p.groups.push({ id, kind: 'synth', name: 'BLOB ' + num, mute: 0 });
      const ang = k * 2.1 + 0.6, pos = [Math.cos(ang) * 1.9, (k % 2 ? 1.25 : -1.1), Math.sin(ang) * 0.9];
      S.p.balls.push({ p: pos, r: 0.55, c: ['SQUARE', 'ROUND', 'METAL', 'SAW'][k % 4], g: id, core: 1 });
      S.active = id; fitCam(); changed();
      toast(`BLOB ${num} is a new synth on top. Drag it up for a higher octave.`);
    }
    function removeBlob(id) {
      if (synths().length < 2) return;
      S.p.balls = S.p.balls.filter((b) => b.g !== id); S.p.groups = S.p.groups.filter((g) => g.id !== id);
      if (S.active === id) S.active = synths()[0].id; fitCam(); changed();
    }

    // ---------- floating tags: a name on every blob, one per colour on the blob you're working on ----------
    function oseStr(m) { return OSC.map((i, j) => [COL[i].n, m.ow[j]]).filter((x) => x[1] > 0.08).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n} ${Math.round(v * 100)}`).join(' · '); }
    function tagsDraw(C) {
      const box = R.tags, want = [];
      synths().forEach((g) => {
        const m = measure(g.id); if (!m) return;
        const top = S.p.balls.filter((b) => b.g === g.id).reduce((y, b) => Math.max(y, b.p[1] + b.r), -9);
        const oct = m.oct ? ` · OCT ${m.oct > 0 ? '+' : ''}${m.oct}` : '', pan = Math.abs(m.pan) > 0.12 ? ` · ${m.pan < 0 ? 'L' : 'R'} ${Math.round(Math.abs(m.pan) * 100)}` : '';
        const core = S.p.balls.find((b) => b.g === g.id && b.core) || { c: 'SAW' };
        want.push({ k: 'n' + g.id, p: [m.cx, top + 0.12, m.cz], col: paintOf(core.c).c, t: g.name + (g.mute ? ' (MUTED)' : ''), s: oseStr(m) + oct + pan, cls: 'nm' + (g.id === S.active ? ' on' : '') });
        if (g.id !== S.active) return;
        COL.forEach((cc, i) => {
          const bs = S.p.balls.filter((b) => b.g === g.id && !b.core && ci(b.c) === i); if (!bs.length) return;
          let p = [0, 0, 0], V = 0; bs.forEach((b) => { const v = b.r ** 3; p = add(p, b.p, v); V += v; }); p = p.map((x) => x / V);
          const dv = add(p, [m.cx, m.cy, m.cz], -1), o = dv.some((x) => x) ? norm(dv) : [0, 1, 0];
          want.push({ k: 'c' + g.id + '-' + i, p: add(p, o, 0.18), col: cc.c, t: cc.n, s: Math.round(m.amt[i] * 100) + '%', cls: '' });
        });
      });
      S.p.groups.forEach((g) => {
        if (g.kind !== 'sound') return; if (!S.p.balls.some((b) => b.g === g.id)) return;
        const p = gc(g.id), mo = B.mixOf(S.p, g);
        want.push({ k: 'g' + g.id, p: add(p, [0, 0.45, 0]), col: SCOL[(g.col || 0) % SCOL.length], t: String(g.name).toUpperCase().slice(0, 16), s: mo.w > 0.03 ? 'IN ' + mo.to.name + ' ' + Math.round(Math.min(1, mo.w) * 100) + '%' : 'NOT MIXED IN', cls: '' });
      });
      const have = new Set();
      want.forEach((w) => {
        have.add(w.k); let t = box.querySelector(`[data-k="${w.k}"]`);
        if (!t) { t = document.createElement('div'); t.dataset.k = w.k; t.innerHTML = '<i></i><s></s><b></b>'; box.appendChild(t); }
        t.className = 'tag ' + w.cls; const s = proj(w.p, C); if (!s) { t.style.opacity = 0; return; }
        t.style.opacity = 1; t.style.left = s[0] + 'px'; t.style.top = s[1] + 'px'; t.style.setProperty('--c', w.col);
        const html = `${esc(w.t)}<small>${esc(w.s)}</small>`, b = t.querySelector('b'); if (b.innerHTML !== html) b.innerHTML = html;
      });
      box.querySelectorAll('.tag').forEach((t) => { if (!have.has(t.dataset.k)) t.remove(); });
    }

    // ---------- side panels ----------
    function renderTools() {
      const T = [['paint', 'PAINT', 'add a colour'], ['smear', 'SMEAR', 'pull it out'], ['squish', 'SQUISH', 'rub bits away'], ['move', 'MOVE', 'drag a blob around']];
      R.tools.innerHTML = T.map(([k, n, d]) => `<button data-t="${k}" class="${S.tool === k ? 'on' : ''}"><b>${n}</b><small>${d}</small></button>`).join('');
      R.tools.querySelectorAll('button').forEach((b) => { b.onclick = () => { S.tool = b.dataset.t; renderTools(); renderPaint(); hint(); }; });
    }
    function renderPaint() {
      const m = measure(S.active); let h = '', last = '';
      COL.forEach((c, i) => {
        if (c.k !== last) { last = c.k; h += `<div class="ph6"><h6>${KIND[c.k]}</h6><small>${KDESC[c.k]}</small></div>`; }
        const v = m ? (c.k === 'sound' && OSC.includes(i) ? m.ow[OSC.indexOf(i)] : m.amt[i]) : 0;
        h += `<button data-c="${c.n}" class="${S.col === c.n && S.tool === 'paint' ? 'on' : ''}${c.mv ? ' mv' : ''}" style="--c:${c.c}" title="${c.n}: ${c.d}"><i></i><b>${c.n}</b><em><u style="width:${Math.round(v * 100)}%"></u></em></button>`;
      });
      // dropped sounds are paints too: smear them onto a blob to mix them in
      const snds = S.p.groups.filter((g) => g.kind === 'sound');
      if (snds.length) {
        h += `<div class="ph6"><h6>YOUR SOUNDS</h6><small>paint them in</small></div>`;
        snds.forEach((g) => { const q = paintOf('S:' + g.id), v = m && m.snd[g.id] || 0; h += `<button data-c="${q.key}" class="${S.col === q.key && S.tool === 'paint' ? 'on' : ''}" style="--c:${q.c}" title="${esc(g.name)}: paint it onto a blob"><i></i><b>${esc(q.n)}</b><em><u style="width:${Math.round(v * 100)}%"></u></em></button>`; });
      }
      R.paint.innerHTML = h;
      R.paint.querySelectorAll('button').forEach((b) => { b.onclick = () => { S.col = b.dataset.c; S.tool = 'paint'; renderTools(); renderPaint(); hint(); }; });
    }
    function renderModes() {
      R.modes.innerHTML = Object.keys(MODES).map((k) => `<button data-m="${k}" class="${S.p.mode === k ? 'on' : ''}" title="${MODES[k].d}">${k}</button>`).join('');
      R.modes.querySelectorAll('button').forEach((b) => { b.onclick = () => setMode(b.dataset.m); });
    }
    function setMode(k, quiet, noSave) {
      const was = S.p.mode; S.p.mode = k; S.oct = MODES[k].oct; R.ov.textContent = S.oct; renderModes(); renderKeys();
      if (engine) { if (was !== k) engine.flush(); engine.setPatch(S.p, true); }
      if (!quiet) toast(MODES[k].d);
      if (!noSave && was !== k) changed();
    }
    function renderLays() {
      R.lays.innerHTML = synths().map((g) => {
        const m = measure(g.id), core = S.p.balls.find((b) => b.g === g.id && b.core) || { c: 'SAW' };
        return `<div class="lay${g.id === S.active ? ' on' : ''}" data-g="${g.id}" style="--c:${paintOf(core.c).c}"><i></i><span><b>${esc(g.name)}</b><small>${m ? oseStr(m) + (m.oct ? ' · OCT ' + (m.oct > 0 ? '+' : '') + m.oct : '') : ''}</small></span><button class="m${g.mute ? ' on' : ''}" data-a="m" title="Mute">M</button>${synths().length > 1 ? '<button data-a="x" title="Remove">✕</button>' : ''}</div>`;
      }).join('');
      R.lays.querySelectorAll('.lay').forEach((n) => {
        n.onclick = (e) => {
          const id = +n.dataset.g, a = e.target.dataset && e.target.dataset.a;
          if (a === 'm') { const g = grp(id); g.mute = g.mute ? 0 : 1; changed(); return; }
          if (a === 'x') { removeBlob(id); return; }
          setActive(id);
        };
      });
    }
    function renderRight() {
      const m = measure(S.active); if (!m) return;
      const a = m.amt, w = [], g = grp(S.active), o = m.ow;
      R.wh.textContent = `WHAT ${g.name} SOUNDS LIKE`;
      if (o[0] > 0.5) w.push(['BUZZY', o[0] > 0.8]); if (o[1] > 0.3) w.push(['HOLLOW', o[1] > 0.6]); if (o[2] > 0.3) w.push(['SOFT', o[2] > 0.6]); if (o[3] > 0.3) w.push(['BELL', o[3] > 0.6]);
      if (a[I.AIR] > 0.25) w.push(['BREATHY', 0]);
      if (m.width > 0.35) w.push(['WIDE', m.width > 0.8]); if (m.height > 0.35) w.push(['BRIGHT', m.height > 0.8]); else if (m.height < -0.2) w.push(['DARK', 0]);
      if (a[I.SUB] + m.low > 0.35) w.push(['HEAVY LOW END', a[I.SUB] + m.low > 0.8]);
      if (a[I.SQUELCH] > 0.25) w.push(['SQUELCHY', 0]); if (a[I.SWEEP] > 0.25) w.push(['OPENING UP', 0]); if (a[I.WOBBLE] > 0.25) w.push(['WOBBLING', 0]);
      if (a[I.PLUCK] > 0.25 || S.p.mode === 'PLUCK') w.push(['SNAPPY', a[I.PLUCK] > 0.6]);
      if (a[I.SWELL] > 0.25 || m.depth > 0.35 || S.p.mode === 'PAD') w.push(['SOFT START', 0]);
      if (a[I.HEAT] > 0.25) w.push(['GRITTY', a[I.HEAT] > 0.6]); if (a[I.CRUSH] > 0.25) w.push(['LO-FI', 0]); if (a[I.PHASER] > 0.25) w.push(['SWIRLING', 0]);
      if (a[I.SHIMMER] > 0.25) w.push(['WAVY', 0]); if (a[I.ECHO] > 0.25) w.push(['ECHOING', 0]); if (a[I.SPACE] > 0.25) w.push(['SPACEY', a[I.SPACE] > 0.6]);
      if (m.size > 1.3) w.push(['LOUD', 1]); if (g.mute) w.unshift(['MUTED', 1]);
      S.p.groups.forEach((s) => { if (s.kind === 'sound') { const mo = B.mixOf(S.p, s); if ((mo.to === g && mo.w > 0.3) || (m.snd[s.id] || 0) > 0.1) w.push([String(s.name).toUpperCase().slice(0, 12) + ' INSIDE', 1]); } });
      R.words.innerHTML = w.map(([t, h]) => `<span class="${h ? 'hot' : ''}">${esc(t)}</span>`).join('');
      const mt = [['SIZE', Math.min(1, m.size / 2), m.size.toFixed(2)], ['WIDTH', Math.min(1, m.width / 1.5), Math.round(m.width * 100)], ['HEIGHT', Math.max(0, (m.height + 1) / 2.5), Math.round(m.height * 100)],
        ['LOW', Math.min(1, m.low / 1.5), Math.round(m.low * 100)], ['DEPTH', Math.min(1, m.depth / 1.5), Math.round(m.depth * 100)], ['LUMPS', m.lumps, m.n]];
      R.meters.innerHTML = mt.map(([n, v, t]) => `<div class="meter">${n}<em><u style="width:${Math.round(clamp(v, 0, 1) * 100)}%"></u></em><span>${t}</span></div>`).join('');
    }
    function renderSamples() {
      const G = S.p.groups.filter((g) => g.kind === 'sound');
      R.samples.innerHTML = G.length ? G.map((g) => { const mo = B.mixOf(S.p, g); return `<div class="srow" style="--c:${SCOL[(g.col || 0) % SCOL.length]}"><i></i><b title="${esc(g.name)}">${esc(g.name)}</b><span>${mo.w > 0.03 ? 'IN ' + esc(mo.to.name) : 'OUTSIDE'}</span></div>`; }).join('') : '<p class="how">None yet. Drop a sample, a vocal, anything.</p>';
    }
    function hint() {
      R.hint.textContent = {
        paint: `PAINT ${cur().n} (${cur().d}): drag over a blob. Double-click a blob to dip it all in ${cur().n}. Drag empty space to spin.`,
        smear: 'SMEAR: grab a blob and pull. Sideways = wider, up = brighter, down = more low end, toward you = softer start.',
        squish: 'SQUISH: rub over bits you want gone.',
        move: 'MOVE: drag a blob up for a higher octave, left or right to pan. Drag a dropped sound onto a blob to mix it in.' }[S.tool];
    }
    let tT = 0;
    function toast(t) { R.toast.textContent = t; R.toast.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => R.toast.classList.remove('on'), 2400); }

    // ---------- keys ----------
    const held = new Map();   // note -> true while a key or the mouse holds it
    function noteOn(n, vel = 1) { const e = eng(); if (!e) return; e.noteOn(n, vel); held.set(n, 1); kbLight(n, 1); }
    function noteOff(n) { if (engine) engine.noteOff(n); held.delete(n); kbLight(n, 0); }
    function renderKeys() {
      const kb = R.kb, base = S.oct * 12 + 12, whites = []; let h = '';
      for (let n = base; n < base + 25; n++) if (![1, 3, 6, 8, 10].includes(n % 12)) whites.push(n);
      const W = 100 / whites.length;
      whites.forEach((n) => { h += `<button class="w${SCALE.includes(n % 12) ? ' inkey' : ''}" data-n="${n}" aria-label="Note ${n}"><span>${n % 12 === 0 ? 'C' + (Math.floor(n / 12) - 1) : ''}</span></button>`; });
      kb.innerHTML = h;
      whites.forEach((n, i) => {
        if ([0, 2, 5, 7, 9].includes(n % 12) && n + 1 < base + 25) {
          const b = document.createElement('button'); b.className = 'b' + (SCALE.includes((n + 1) % 12) ? ' inkey' : ''); b.dataset.n = n + 1; b.setAttribute('aria-label', 'Note ' + (n + 1));
          b.style.left = `calc(${(i + 1) * W}% - ${W * 0.32}%)`; b.style.width = W * 0.62 + '%'; kb.appendChild(b);
        }
      });
      kb.querySelectorAll('button').forEach((b) => {
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault(); cover(0); const n = +b.dataset.n; noteOn(n);
          const up = () => { noteOff(n); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
          window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
        });
      });
    }
    function kbLight(n, on) { const b = R.kb.querySelector(`[data-n="${n}"]`); if (b) b.classList.toggle('on', !!on); }
    
    function octave(d) { S.oct = clamp(S.oct + d, 0, 7); R.ov.textContent = S.oct; renderKeys(); }
    const kn = new Map();   // key -> the note it started (the octave may change while it's held)
    function onKey(e) {
      if (!e.key || !visible() || e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && (opts.keys || el.contains(e.target))) {   // in a host with its own keys, only when BLOB has focus
        e.preventDefault(); undo(); return; }
      if (!opts.keys || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z') { octave(-1); return; } if (k === 'x') { octave(1); return; }
      const i = KEYMAP.indexOf(k); if (i < 0 || kn.has(k)) return; cover(0); const n = S.oct * 12 + 12 + i; kn.set(k, n); noteOn(n);
    }
    function onKeyUp(e) { if (!e.key) return; const k = e.key.toLowerCase(); if (!kn.has(k)) return; noteOff(kn.get(k)); kn.delete(k); }
    function allOff() { kn.clear(); [...held.keys()].forEach(noteOff); }   // the window lost focus: no key-up will come
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', allOff);
    R.om.onclick = () => octave(-1); R.op.onclick = () => octave(1);

    // ---------- LISTEN: a loop in D# minor, scheduled ahead on the audio clock ----------
    let LT = null;
    function listen() {
      if (LT) { stopListen(); return; }
      const e = eng(); if (!e) return;
      R.listen.classList.add('on'); R.listen.textContent = '■ STOP';
      const beat = 60 / 130; let t0 = e.ctx.currentTime + 0.08;
      const run = () => {
        const en = engine; if (!en || en.closed) { stopListen(); return; }
        const L = LOOPS[S.p.mode] || LOOPS.DEFAULT, sh = (S.oct - MODES[S.p.mode].oct) * 12;
        if (t0 < en.ctx.currentTime) t0 = en.ctx.currentTime + 0.05;   // the tab slept: start this bar now, not in the past
        en.schedule(L.map(([n, st, len]) => ({ pitch: n + sh, velocity: 108, on: t0 + st * beat, off: t0 + (st + len * 0.92) * beat })));
        L.forEach(([n, st, len]) => {
          const at = (t0 + st * beat - en.ctx.currentTime) * 1000;
          setTimeout(() => { if (LT) kbLight(n + sh, 1); }, at); setTimeout(() => kbLight(n + sh, 0), at + len * beat * 920);
        });
        t0 += 8 * beat; LT = setTimeout(run, (t0 - en.ctx.currentTime - 0.25) * 1000);
      };
      LT = 1; run();
    }
    function stopListen() { clearTimeout(LT); LT = null; if (engine) engine.flush(); R.listen.classList.remove('on'); R.listen.textContent = '▶ LISTEN'; R.kb.querySelectorAll('.on').forEach((b) => b.classList.remove('on')); }

    // ---------- dropping sounds in ----------
    async function addSound(file) {
      const e = eng(); if (!e) return;
      try {
        const buf = await e.ctx.decodeAudioData(await file.arrayBuffer());
        const name = file.name.replace(/\.[^.]+$/, ''), sid = 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
        S.p.sounds[sid] = B.packSound(buf, name);
        const id = nextId(), col = S.p.groups.filter((g) => g.kind === 'sound').length;
        S.p.groups.push({ id, kind: 'sound', name, col, sound: sid });
        // it floats beside the blobs; its lumps follow the loudness of the sound
        // beside the blobs as you see them (right, left, then above), never in front of them
        const C = cam(), side = [[2.6, 0.2], [-2.6, 0.2], [0, 2.2], [2.4, -1.6], [-2.4, -1.6]][(col) % 5];
        const d = buf.getChannelData(0), parts = 4, len = Math.floor(d.length / parts), base = add(add(S.tgt, C.rt, side[0] * (S.distT || 5) / 5.4), C.up, side[1]);
        for (let i = 0; i < parts; i++) {
          let s = 0, k = 0; for (let j = i * len; j < (i + 1) * len; j += 64) { s += d[j] * d[j]; k++; }
          const rms = Math.sqrt(s / Math.max(1, k));
          S.p.balls.push({ p: add(base, [(i - 1.5) * 0.18, Math.sin(i * 2.1) * 0.15, Math.cos(i * 1.3) * 0.12]), r: 0.16 + Math.min(0.22, rms * 1.2), c: 'SAW', g: id, core: 0 });
        }
        fitCam(); changed();
        S.col = 'S:' + id; S.tool = 'paint'; renderTools(); renderPaint(); hint();
        toast(`${name} is a blob now, and a paint. Paint it onto a blob, or MOVE it close to mix it in.`);
        return id;
      } catch (err) { toast('Could not read that file. Try a WAV, MP3 or AIFF.'); return null; }
    }
    const st = R.stage;
    const isAudio = (f) => f && (/^audio\//.test(f.type) || /\.(wav|mp3|aif|aiff|flac|ogg|m4a)$/i.test(f.name));
    ['dragenter', 'dragover'].forEach((t) => st.addEventListener(t, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); st.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach((t) => st.addEventListener(t, (e) => { e.preventDefault(); st.classList.remove('over'); }));
    st.addEventListener('drop', (e) => { const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(isAudio); if (f) { cover(0); addSound(f); } });
    R.addsnd.onclick = () => R.file.click();
    R.file.onchange = (e) => { const f = e.target.files[0]; if (f) { cover(0); addSound(f); } e.target.value = ''; };

    // ---------- start ----------
    function cover(on) { R.cover.hidden = !on; if (!on) eng(); }
    if (engine) R.cover.hidden = true;
    R.wake.onclick = () => { cover(0); noteOn(51); setTimeout(() => noteOff(51), 450); };
    R.listen.onclick = () => { cover(0); listen(); };
    R.vol.value = Math.round((S.p.level == null ? 1 : S.p.level) * 100);
    R.vol.oninput = () => { S.p.level = R.vol.value / 100; changed(1); };
    R.vol.onchange = () => changed();
    R.undo.onclick = undo; R.undo.disabled = true;
    R.pp.onclick = () => loadPreset(S.preI - 1); R.pnx.onclick = () => loadPreset(S.preI + 1); R.addb.onclick = addBlob;
    // narrow windows stack the rails under the stage
    const ro = window.ResizeObserver ? new ResizeObserver(() => el.classList.toggle('narrow', el.clientWidth < 820)) : null;
    if (ro) ro.observe(el); else el.classList.toggle('narrow', el.clientWidth < 820);

    renderTools(); S.active = synths()[0].id; R.pn.textContent = S.p.name; setMode(S.p.mode, 1, 1); fitCam(true); changed(1); hint();
    if (engine) engine.setPatch(S.p, true);
    raf = requestAnimationFrame(frame);

    const api = {
      el, S,
      getPatch: outPatch,
      setPatch: (p) => setPatch(p),
      setEngine: (e) => { engine = e; if (e) { e.setPatch(S.p, true); R.cover.hidden = true; } },
      get engine() { return engine; },
      noteOn, noteOff, listen, stopListen, loadPreset, addBlob, removeBlob, addSound, setMode: (k) => setMode(k), undo,
      setTool: (t) => { S.tool = t; renderTools(); renderPaint(); hint(); },
      setColour: (n) => { S.col = paintOf(n).key; S.tool = 'paint'; renderTools(); renderPaint(); hint(); },
      // for tests: screen point of a world point, and a pick at a screen point
      project: (P) => proj(P, cam()), pickAt: (x, y) => pick(x, y),
      destroy() {
        dead = true; cancelAnimationFrame(raf); stopListen(); allOff(); clearTimeout(wheelT); clearTimeout(tT);
        window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', allOff);
        if (ro) ro.disconnect();
        if (gl) { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); gl = null; }   // browsers allow few GL contexts; give this one back
        el.innerHTML = ''; el.classList.remove('blob-root', 'narrow');
      }
    };
    return api;
  }

  // the logo next to this script (blob-logo.png), so the window works from any page
  const here = document.currentScript && document.currentScript.src;
  const BLOB = window.BLOB = { mount, logo: here ? new URL('blob-logo.png', here).href : 'blob-logo.png', engine: B };
})();
