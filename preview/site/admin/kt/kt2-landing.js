// The published artifact is at its size cap, so the landing films live in its asset store (/_blob); a local
// playground build (localhost) uses the files in ui/landing/.
const LAND_BLOBS = { "landing4/vamp.webp": "/_blob/5030e28cf5a68e3f275d9f11871787f8", "landing4/bun.webp": "/_blob/2374a843fc2d811265febed02c917c64", "landing4/creature.webp": "/_blob/7d7dc8ee11187bad2d81ffc62636b944", "landing4/kit-dollhouse.webp": "/_blob/c18bf526a7b60a0921e17702ed3b4b5a", "landing4/kit-candycane.webp": "/_blob/fca8399b4c349766dbc67af5ee10b9d4", "landing4/kit-raws.webp": "/_blob/706948c7a03819c315a4d80e019e2aa4", "landing4/kit-insomnia.webp": "/_blob/2346e3ae0f4ffd219e97e7bb8866b209", "landing4/kit-slumber.webp": "/_blob/2ea7392d2a351415f6763db0bb53ec37", "landing4/kit-meltdown.webp": "/_blob/0d0c4b3dec020cc797373794964347ab", "landing4/kit-sawtooth.webp": "/_blob/b969f78d70570eda9a452805ee0c923c", "landing4/kit-digijunky.webp": "/_blob/67d2045045d0602de43cd210a724c51f", "landing4/logo.png": "/_blob/68231b40a826f4dad40a17b4d810fbfc", "landing3/daw0.webp": "/_blob/bb5c35d4f488ef84c32b2832cfa86c2c", "landing3/daw1.webp": "/_blob/4d1ec11e36676787d2af51c3797ca735", "landing3/daw2.webp": "/_blob/1ea7f25e20df7e6e75c8dcaa75772ef6", "landing3/daw3.webp": "/_blob/ef968d0994dcf927e7439025a1da592f", "landing3/daw4.webp": "/_blob/7a47363f7cdd638dd2d3d93531c238a7", "landing3/daw5.webp": "/_blob/cb202128ace8ae06bbdd67aee85f5cc6", "landing3/tm.webp": "/_blob/58a4d1b314e7a424e870622c6cbe2434", "landing3/vamp.webp": "/_blob/4c60036cca3efefbb27f8dea4df2d4d7", "landing3/bun.webp": "/_blob/eb3cb05ced8deee064cad1f7559c4400", "landing3/creature.webp": "/_blob/d3971932d1d4609c6f73cc08652b8c67", "landing/hero.webm": "/_blob/a458627f5510f1489781f954b1ad3e88", "landing/hero.jpg": "/_blob/d8ede516241a3292c8ad810756fec6c6", "landing/pg-dice.jpg": "/_blob/308d3aa6ecdd25a2070b480df160e737", "landing/pg-dice.webm": "/_blob/b10f3fbb433bd0be2ddf237695582f8c", "landing/pg-drop.jpg": "/_blob/3aed43e9cac3c8d9ed9811764ba13e99", "landing/pg-drop.webm": "/_blob/0d216d131b518cdd756f251cb48f8fdf", "landing/pg-play.jpg": "/_blob/0426033927687597e3c5567ea9529b15", "landing/pg-play.webm": "/_blob/51c903381aa6c9a03b581c1e8df9885b" };
const LAND = (p) => (/^(localhost|127\.0\.0\.1|)$/.test(location.hostname) || location.protocol === "file:" ? p : (LAND_BLOBS[p] || p));
// KILLTOY 2: the LANDING PAGE tab (Eman, 9 Nov 2026 23:05). How someone from outside meets KILLTOY:
// the brand, the faces, what the tools can do, and you can play every part of it right there.
// Plan: https://claude.ai/artifact/WvhcHkUuvBcaBHr4ZtknV4 ("a toy box for making music"; Eman 23:38: not only dark music, and the top shows the DAW itself).
// It is a tab BEFORE "All projects" on the projects page and opens a full-screen scroll page:
//   1 opening face + one line        2 TRY IT: the prompt synth (words -> a TOY MACHINE sound)
//   3 the playground (screen loops)   4 TOY MACHINE (3D card + 8 sounds)   5 KILLDRUM (3D card + step grid)
//   6 MIDI (the dice brain + .mid)    7 the ease (DROP / ROLL / BOUNCE)    8 free + what you can win   9 end
// Sounds come from the real engines in the app (ToyMachine.render, KillDrumLib + its previews, ChordBrain).
// Flags: KT2_LANDING_OFF = no tab. Address #landing opens it. Keep this file ASCII-only, like ui/.
"use strict";

(function () {
  if (typeof document === "undefined" || window.KT2_LANDING_OFF) return;
  if (!document.documentElement.classList.contains("kt2")) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const H = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const LINE = window.KT2_LANDING_LINE || "make music like playing with toys.";
  const BG = (n) => "bg/KT_UP_" + String(n).padStart(2, "0") + ".jpg";

  // ------------------------------------------------------------------ styles
  const css = H("style"); css.id = "kl-css";
  css.textContent = `
  .kq-tabs .kl-tab { color: #6b6b78; }
  body.landing-open .k2x-tip, body.landing-open .k2x-ring { display: none !important; }
  .kl { position: fixed; inset: 0; z-index: 9000; background: #0d0d10; color: #e9e7ef; overflow: hidden auto; scroll-behavior: smooth;
    font: 400 14px/1.5 Inter, system-ui, sans-serif; --lv: 0; --acid: #e4ff3a; --pur: #8b6cff; --line: rgba(255,255,255,.12); }
  .kl[hidden] { display: none; }
  .kl * { box-sizing: border-box; }
  .kl ::selection { background: var(--acid); color: #000; }
  .kl-grain { position: fixed; inset: -50%; z-index: 9002; pointer-events: none; opacity: calc(.13 + var(--lv) * .22); mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -.3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    animation: kl-grain 0.9s steps(5) infinite; }
  @keyframes kl-grain { 0% { transform: translate(0,0); } 20% { transform: translate(-3%,2%); } 40% { transform: translate(2%,-4%); } 60% { transform: translate(-4%,-1%); } 80% { transform: translate(3%,3%); } }
  .kl-top { position: sticky; top: 0; z-index: 9001; height: 54px; display: flex; align-items: center; gap: 18px; padding: 0 24px;
    background: linear-gradient(#0d0d10 0%, rgba(13,13,16,.6) 70%, transparent); }
  .kl-top .kl-logo { background: none; border: 0; padding: 0; cursor: pointer; height: 22px; }
  .kl-top .kl-logo img { height: 22px; display: block; }
  .kl-top b { font: 600 11px Inter, sans-serif; letter-spacing: .26em; color: #6b6b78; }
  .kl-top .kl-sp { flex: 1; }
  .kl-top .kl-x { background: none; border: 0; color: #9a98a6; font-size: 22px; line-height: 1; cursor: pointer; padding: 4px 6px; }
  .kl-top .kl-x:hover { color: #fff; }
  .kl section { position: relative; min-height: 100vh; padding: 120px 7vw; display: grid; align-content: center; overflow: hidden; isolation: isolate; }
  .kl-frost { position: absolute; inset: -60px; z-index: -2; background-size: cover; background-position: center; filter: blur(34px) saturate(1.15) brightness(.55);
    transform: scale(calc(1.08 + var(--lv) * .03)); transition: transform .12s; }
  .kl-veil { position: absolute; inset: 0; z-index: -1; background: radial-gradient(120% 90% at 50% 40%, rgba(13,13,16,.25), rgba(13,13,16,.92) 75%), linear-gradient(transparent 70%, #0d0d10); }
  .kl-k { font: 600 11px Inter, sans-serif; letter-spacing: .3em; text-transform: uppercase; color: #8d8a9b; display: flex; gap: 14px; align-items: center; }
  .kl-k i { font-style: normal; color: var(--pur); }
  .kl-h { font: 800 clamp(34px, 5.2vw, 86px)/.95 Unbounded, Inter, sans-serif; letter-spacing: -.02em; margin: 18px 0 22px; text-transform: uppercase; }
  .kl-p { max-width: 520px; color: #a9a6b6; font-size: 15px; }
  .kl-cut { background-size: cover; background-position: center 30%; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
  .kl-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6vw; align-items: center; }
  .kl-rev { opacity: 0; transform: translateY(26px); transition: opacity .9s, transform 1.1s cubic-bezier(.2,.8,.2,1); }
  .kl-rev.in { opacity: 1; transform: none; }
  .kl-btn { display: inline-flex; align-items: center; gap: 10px; height: 40px; padding: 0 18px; border: 1px solid rgba(255,255,255,.35); background: rgba(13,13,16,.4); color: #fff;
    font: 600 11px Inter, sans-serif; letter-spacing: .24em; text-transform: uppercase; cursor: pointer; backdrop-filter: blur(10px); transition: border-color .15s, background .15s, color .15s; }
  .kl-btn:hover { border-color: #fff; }
  .kl-btn.on { border-color: var(--acid); color: var(--acid); }
  .kl-btn.solid { background: var(--acid); color: #0d0d10; border-color: var(--acid); }
  .kl-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .kl-chip { height: 30px; padding: 0 12px; border: 1px solid var(--line); background: rgba(255,255,255,.03); color: #bdbacb; font: 500 12px Inter, sans-serif; letter-spacing: .04em; cursor: pointer; }
  .kl-chip:hover { border-color: rgba(255,255,255,.5); color: #fff; }
  .kl-chip.on { border-color: var(--acid); color: var(--acid); }
  .kl-glass { border: 1px solid var(--line); background: rgba(16,16,20,.55); backdrop-filter: blur(18px) saturate(1.2); }

  /* 1 opening */
  .kl-hero { text-align: center; justify-items: center; align-content: start; padding-top: 96px !important; padding-bottom: 60px !important; }
  .kl-hero .kl-frost { filter: blur(40px) saturate(1.1) brightness(.45); }
  .kl-hero .kl-veil { background: radial-gradient(80% 60% at 50% 30%, rgba(13,13,16,.2), rgba(13,13,16,.9) 75%), linear-gradient(transparent 70%, #0d0d10); }
  .kl-hero .kl-wm { height: clamp(46px, 6vw, 84px); display: block; filter: drop-shadow(0 0 30px rgba(139,108,255,.35)); }
  .kl-hero .kl-line { margin-top: 18px; font: 500 clamp(15px, 1.5vw, 20px) Inter, sans-serif; letter-spacing: .08em; color: #d9d6e4; }
  .kl-hero .kl-tags { display: flex; gap: 22px; justify-content: center; flex-wrap: wrap; margin-top: 16px; font: 600 10px Inter, sans-serif; letter-spacing: .28em; color: #8d8a9b; }
  .kl-hero .kl-tags b { color: var(--acid); font-weight: 700; }
  .kl-stage { width: min(1320px, 100%); margin-top: 44px; perspective: 1800px; }
  .kl-app { position: relative; aspect-ratio: 1440 / 641; transform: rotateX(var(--tilt, 0deg)) scale(calc(1 - var(--tilt-k, 0) * .04)); transform-origin: 50% 0;
    border: 1px solid rgba(255,255,255,.2); background: #17171b; box-shadow: 0 50px 140px rgba(0,0,0,.7), 0 0 0 1px rgba(0,0,0,.6), 0 0 90px rgba(139,108,255,.18); transition: transform .08s linear; }
  .kl-app video, .kl-app img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .kl-call { position: absolute; z-index: 2; pointer-events: none; display: flex; align-items: center; gap: 8px; font: 700 10px Inter, sans-serif; letter-spacing: .26em; color: #fff; white-space: nowrap; }
  .kl-call::before { content: ""; width: 7px; height: 7px; background: var(--acid); box-shadow: 0 0 0 4px rgba(228,255,58,.18); }
  .kl-call span { background: rgba(13,13,16,.78); padding: 5px 8px 4px; backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,.14); }
  .kl-stamp { position: absolute; right: 7vw; top: 96px; transform: rotate(-8deg); border: 2px solid var(--acid); color: var(--acid); padding: 6px 12px 5px; font: 800 18px Unbounded, sans-serif; letter-spacing: .08em; }
  .kl-scroll { position: absolute; bottom: 34px; left: 50%; width: 1px; height: 46px; background: linear-gradient(#fff, transparent); animation: kl-drip 2.4s ease-in-out infinite; }
  @keyframes kl-drip { 0% { transform: scaleY(0); transform-origin: top; } 50% { transform: scaleY(1); transform-origin: top; } 51% { transform-origin: bottom; } 100% { transform: scaleY(0); transform-origin: bottom; } }

  /* banners: a slice of a face that slides as you scroll */
  .kl-band { height: 120px; position: relative; overflow: hidden; display: grid; place-items: center; background-size: 140% auto; background-position: 50% var(--sy, 50%);
    filter: saturate(1.1); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .kl-band::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, #0d0d10, rgba(13,13,16,.15) 25%, rgba(13,13,16,.15) 75%, #0d0d10); }
  .kl-band span { position: relative; font: 800 clamp(22px, 3.4vw, 46px) Unbounded, sans-serif; letter-spacing: .02em; text-transform: uppercase; color: rgba(255,255,255,.92); mix-blend-mode: overlay; white-space: nowrap; }

  /* 2 prompt synth */
  .kl-try { grid-template-columns: minmax(0, 1fr); gap: 26px; }
  .kl-try .kl-box { display: flex; align-items: center; gap: 12px; padding: 0 0 0 18px; height: 64px; max-width: 760px; }
  .kl-try input { flex: 1; min-width: 0; height: 100%; border: 0; background: none; color: #fff; outline: none; font: 500 20px Inter, sans-serif; letter-spacing: .01em; }
  .kl-try input::placeholder { color: #5e5b6c; }
  .kl-try .kl-go { height: 64px; width: 64px; border: 0; border-left: 1px solid var(--line); background: none; color: #fff; cursor: pointer; display: grid; place-items: center; }
  .kl-try .kl-go:hover { background: rgba(255,255,255,.06); }
  .kl-try .kl-go svg { width: 18px; height: 18px; fill: currentColor; }
  .kl-try .kl-go.busy svg { animation: kl-pulse .5s steps(2) infinite; }
  @keyframes kl-pulse { 50% { opacity: .2; } }
  .kl-scape { position: relative; height: 260px; max-width: 1100px; }
  .kl-scape canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .kl-heard { position: absolute; left: 18px; bottom: 14px; font: 600 11px Inter, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #8d8a9b; }
  .kl-heard b { color: #fff; font-weight: 700; }
  .kl-keys { display: flex; gap: 3px; max-width: 760px; }
  .kl-keys button { flex: 1; height: 54px; border: 1px solid var(--line); background: rgba(255,255,255,.04); color: #6b6b78; font: 600 10px Martian Mono, monospace; cursor: pointer; display: grid; align-items: end; padding-bottom: 6px; transition: background .08s; }
  .kl-keys button.blk { background: rgba(0,0,0,.45); }
  .kl-keys button.hit { background: var(--acid); color: #000; border-color: var(--acid); }

  /* 3 playground screens */
  .kl-screen { position: relative; aspect-ratio: 16 / 9; width: 100%; overflow: hidden; border: 1px solid rgba(255,255,255,.18); background: #111; box-shadow: 0 40px 120px rgba(0,0,0,.6); }
  .kl-screen video, .kl-screen img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .kl-screen .kl-cap { position: absolute; left: 14px; bottom: 12px; font: 600 10px Inter, sans-serif; letter-spacing: .26em; color: #fff; background: rgba(13,13,16,.6); padding: 5px 8px; backdrop-filter: blur(6px); }
  .kl-pg-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
  .kl-pg-row .kl-screen { cursor: pointer; opacity: .55; transition: opacity .2s; }
  .kl-pg-row .kl-screen.on, .kl-pg-row .kl-screen:hover { opacity: 1; }

  /* 3D cards */
  .kl-card3d { width: min(330px, 70vw); aspect-ratio: 3 / 4; perspective: 1400px; justify-self: center; cursor: grab; touch-action: none; position: relative; }
  .kl-card3d.grab { cursor: grabbing; }
  .kl-c3 { position: absolute; inset: 0; transform-style: preserve-3d; will-change: transform; }
  .kl-c3 > div { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; }
  .kl-c3 .f, .kl-c3 .b { backface-visibility: hidden; -webkit-backface-visibility: hidden; box-shadow: 0 0 0 1.5px rgba(255,255,255,.3), 0 0 60px rgba(139,108,255,.35); }
  .kl-c3 .f { transform: translateZ(4px); } .kl-c3 .b { transform: rotateY(180deg) translateZ(4px); }
  .kl-c3 img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
  .kl-c3 .s { background: linear-gradient(90deg, #8f86b0, #f4f0ff 40%, #8f86b0); }
  .kl-c3 .holo { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: color-dodge; opacity: .18; background-size: 300% 100%; background-position: var(--hx, 50%) 0;
    background-image: linear-gradient(115deg, transparent 20%, rgba(255,40,200,.55) 32%, rgba(40,255,230,.5) 42%, rgba(228,255,58,.5) 52%, rgba(139,108,255,.55) 62%, transparent 76%); }
  .kl-shadow { position: absolute; left: 50%; bottom: -46px; width: 80%; height: 22px; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.75), transparent); }

  /* 4 TOY MACHINE sounds */
  .kl-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 26px; max-width: 560px; }
  .kl-tile { position: relative; height: 62px; border: 1px solid var(--line); background: rgba(16,16,20,.55); color: #fff; cursor: pointer; text-align: left; padding: 0 14px; overflow: hidden;
    display: grid; align-content: center; gap: 3px; backdrop-filter: blur(10px); }
  .kl-tile b { font: 700 12px Inter, sans-serif; letter-spacing: .12em; text-transform: uppercase; position: relative; }
  .kl-tile span { font: 500 10px Inter, sans-serif; letter-spacing: .22em; color: #7c7989; text-transform: uppercase; position: relative; }
  .kl-tile i { position: absolute; inset: 0 auto 0 0; width: 0; background: rgba(228,255,58,.14); border-right: 1px solid var(--acid); }
  .kl-tile:hover { border-color: rgba(255,255,255,.45); }
  .kl-tile.on { border-color: var(--acid); }

  /* 5 KILLDRUM grid */
  .kl-grid { display: grid; gap: 4px; margin-top: 26px; max-width: 640px; }
  .kl-grid .r { display: grid; grid-template-columns: 74px repeat(16, minmax(0, 1fr)); gap: 3px; align-items: center; }
  .kl-grid .r > b { font: 600 10px Inter, sans-serif; letter-spacing: .22em; color: #8d8a9b; }
  .kl-grid .st { height: 30px; border: 1px solid var(--line); background: rgba(255,255,255,.03); cursor: pointer; padding: 0; }
  .kl-grid .st:nth-of-type(4n+2) { background: rgba(255,255,255,.07); }
  .kl-grid .st.on { background: var(--pur); border-color: var(--pur); }
  .kl-grid .st.now { box-shadow: inset 0 0 0 1px var(--acid); }
  .kl-grid .st.on.now { background: var(--acid); border-color: var(--acid); }
  .kl-drow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 18px; }

  /* 6 MIDI */
  .kl-roll { position: relative; height: 300px; margin-top: 26px; }
  .kl-roll canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .kl-chords { display: flex; gap: 0; margin-top: 10px; }
  .kl-chords span { flex: 1; padding: 8px 10px; border-left: 1px solid var(--line); font: 700 13px Martian Mono, monospace; color: #cfccdb; }
  .kl-chords span.now { color: var(--acid); border-left-color: var(--acid); }
  .kl-count { font: 800 clamp(30px, 4vw, 56px) Unbounded, sans-serif; letter-spacing: -.02em; }
  .kl-count small { display: block; font: 600 11px Inter, sans-serif; letter-spacing: .26em; color: #8d8a9b; margin-top: 6px; }

  /* 7 the ease */
  .kl-ease { background: #0d0d10; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; min-height: 0 !important; padding-top: 80px !important; padding-bottom: 80px !important; }
  .kl-ease .kl-screen { aspect-ratio: 4 / 5; filter: saturate(1.05) brightness(.85); transition: filter .4s, transform .6s cubic-bezier(.2,.8,.2,1); }
  .kl-ease .kl-rev:hover .kl-screen { filter: none; transform: scale(1.015); }
  .kl-ease .kl-n { font: 800 clamp(22px, 2.6vw, 40px) Unbounded, sans-serif; margin-top: 16px; }
  .kl-ease .kl-n i { font-style: normal; color: var(--pur); margin-right: 10px; font-size: .5em; vertical-align: middle; }

  /* 8 free + win */
  .kl-free h2 { margin: 0; font: 800 clamp(80px, 18vw, 300px)/.8 Unbounded, sans-serif; letter-spacing: -.05em; }
  .kl-case { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-top: 50px; }
  .kl-prize { position: relative; aspect-ratio: 3 / 4; overflow: hidden; border: 1px solid var(--line); background: #141418; }
  .kl-prize img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(10px) brightness(.6) saturate(.7); transform: scale(1.15); }
  .kl-prize.got img { filter: none; transform: none; }
  .kl-prize .q { position: absolute; inset: 0; display: grid; place-items: center; font: 800 54px Unbounded, sans-serif; color: rgba(255,255,255,.22); }
  .kl-prize .t { position: absolute; left: 0; right: 0; bottom: 0; padding: 10px; background: linear-gradient(transparent, rgba(0,0,0,.85)); }
  .kl-prize .t b { display: block; font: 700 11px Inter, sans-serif; letter-spacing: .16em; }
  .kl-prize .t span { font: 600 9px Inter, sans-serif; letter-spacing: .22em; color: #8d8a9b; }
  .kl-prize .bar { height: 2px; background: rgba(255,255,255,.12); margin-top: 7px; }
  .kl-prize .bar i { display: block; height: 100%; background: var(--acid); }

  /* 9 end */
  .kl-end { text-align: center; justify-items: center; min-height: 80vh !important; }
  .kl-end img { width: min(420px, 70vw); opacity: .95; }

  @media (max-width: 900px) {
    .kl section { padding: 100px 18px; }
    .kl-two, .kl-ease { grid-template-columns: minmax(0, 1fr); }
    .kl-case { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .kl-pg-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .kl-stamp { top: 70px; right: 18px; }
  }
  @media (prefers-reduced-motion: reduce) { .kl-grain, .kl-scroll { animation: none; } .kl-rev { transition: none; opacity: 1; transform: none; } }
  `;
  document.head.append(css);

  // ------------------------------------------------------------------ Y2K look (Eman, 9 Nov 23:49-23:50)
  // "more playful and y2k", based on a collage poster site: panels that alternate purple and black, a fat blob
  // wordmark with thin orbit lines, starburst stickers, taped screenshots, white label boxes, dotted paths with
  // numbered stops, and a 3D gallery wall of sample kits ("new ones added weekly"). Colours: purple, acid
  // yellow, black, green for some sections and text. KT2_LANDING_CALM = the first, calmer look.
  const Y2K = !!window.KT2_LANDING_Y2K && !window.KT2_LANDING_CALM;
  const V3 = !window.KT2_LANDING_Y2K && !window.KT2_LANDING_CALM;
  const V4 = V3 && !window.KT2_LANDING_V3;   // Landing 4 (cleaner) builds on Landing 3; KT2_LANDING_V3 = the toy box as it was
  if ((Y2K || (V3 && !V4)) && !document.getElementById("kl-y2k-fonts")) {
    const l = H("link"); l.id = "kl-y2k-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Tektur:wght@500;700;900&display=swap";
    document.head.append(l);
  }
  const STAR = (n, col, cls, style) => {
    const pts = []; const N2 = n * 2;
    for (let i = 0; i < N2; i++) { const r = i % 2 ? 18 + (i % 4 === 1 ? 6 : 0) : 50, a = (i / N2) * Math.PI * 2 - Math.PI / 2; pts.push((50 + r * Math.cos(a)).toFixed(1) + "," + (50 + r * Math.sin(a)).toFixed(1)); }
    return `<svg class="y-star ${cls || ""}" style="${style || ""}" viewBox="0 0 100 100"><polygon points="${pts.join(" ")}" fill="${col}"/></svg>`;
  };
  const KITS_WALL = [["dollhouse", "DOLLHOUSE"], ["candycane", "CANDY CANE"], ["raws", "RAWS"], ["insomnia", "INSOMNIA"], ["slumber", "SLUMBER"], ["meltdown", "MELTDOWN"], ["sawtooth", "SAWTOOTH"], ["digijunky", "DIGI JUNKY"]];
  const yCss = H("style"); yCss.id = "kl-y2k-css";
  yCss.textContent = `
  .kl.y2k { --pur: #9b7bff; --pur2: #7d5cff; --ink: #0b0b0e; --grn: #3dff7a; background: #141317; }
  .y2k .kl-top { background: linear-gradient(#141317 0%, rgba(20,19,23,.7) 70%, transparent); }
  .y2k .y-wrap { max-width: 1280px; margin: 0 auto; padding: 0 22px 60px; display: grid; gap: 0; }
  .y2k .y-panel { position: relative; overflow: hidden; padding: 56px 48px; border-left: 1px solid rgba(255,255,255,.08); border-right: 1px solid rgba(255,255,255,.08); }
  .y2k .y-panel.pur { background: var(--pur); color: var(--ink); }
  .y2k .y-panel.blk { background: var(--ink); color: #f2f0f7; }
  .y2k .y-panel.grn { background: var(--grn); color: var(--ink); }
  .y2k .y-panel:first-child { border-top: 1px solid rgba(255,255,255,.12); }
  .y2k .y-mono { font: 600 10px/1.35 "Martian Mono", monospace; letter-spacing: .04em; text-transform: uppercase; }
  .y2k .y-t { font: 900 clamp(26px, 3.4vw, 48px)/.98 Tektur, Inter, sans-serif; text-transform: uppercase; letter-spacing: .01em; margin: 0; }
  .y2k .y-t.xl { font-size: clamp(34px, 5vw, 72px); }
  .y2k .y-acid { color: var(--acid); } .y2k .y-green { color: var(--grn); } .y2k .y-purple { color: var(--pur); }
  .y2k .y-label { display: inline-block; background: #fff; color: var(--ink); padding: 4px 8px 3px; font: 700 clamp(14px, 1.6vw, 22px)/1.05 Tektur, sans-serif; text-transform: uppercase; box-shadow: 3px 3px 0 var(--ink); }
  .y2k .y-label.k { background: var(--ink); color: var(--acid); box-shadow: 3px 3px 0 #fff; }
  .y2k .y-star { position: absolute; z-index: 3; width: 120px; height: 120px; pointer-events: none; animation: y-spin 26s linear infinite; filter: drop-shadow(0 2px 0 rgba(0,0,0,.25)); }
  .y2k .y-star.r { animation-direction: reverse; animation-duration: 34s; }
  @keyframes y-spin { to { transform: rotate(360deg); } }
  .y2k .y-tape { position: relative; background: #fff; padding: 8px; box-shadow: 0 14px 30px rgba(0,0,0,.45); }
  .y2k .y-tape::before { content: ""; position: absolute; z-index: 2; top: -12px; left: 50%; width: 90px; height: 24px; transform: translateX(-50%) rotate(-4deg); background: rgba(240,240,220,.75); box-shadow: 0 1px 2px rgba(0,0,0,.2); }
  .y2k .y-sticker { position: absolute; z-index: 2; border: 6px solid #fff; box-shadow: 0 10px 24px rgba(0,0,0,.4); overflow: hidden; background-size: cover; background-position: center; transition: transform .3s cubic-bezier(.2,1.6,.4,1); }
  .y2k .y-sticker:hover { transform: rotate(0deg) scale(1.06) !important; }
  .y2k .y-btn { display: inline-flex; align-items: center; justify-content: center; gap: 12px; height: 34px; padding: 0 16px; background: var(--ink); color: var(--acid); border: 0; cursor: pointer; font: 700 13px Tektur, sans-serif; letter-spacing: .06em; text-transform: uppercase; }
  .y2k .y-btn:hover { background: var(--acid); color: var(--ink); }
  .y2k .y-btn.acid { background: var(--acid); color: var(--ink); } .y2k .y-btn.acid:hover { background: #fff; }

  /* 1 hero */
  .y2k .y-nav { display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 20px; }
  .y2k .y-nav ul { list-style: none; margin: 0; padding: 0; }
  .y2k .y-head { text-align: right; margin-top: 26px; }
  .y2k .y-blob { position: relative; margin: 6px 0 0; text-align: center; }
  .y2k .y-blob b { display: block; font: 400 clamp(90px, 19vw, 270px)/.82 "Bagel Fat One", Unbounded, sans-serif; letter-spacing: -.045em; color: var(--ink); transform: scaleY(.9); }
  .y2k .y-blob svg.orb { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .y2k .y-blob .y-mono { position: absolute; }
  .y2k .y-four { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 18px; }
  .y2k .y-bar { margin-top: 18px; width: 100%; height: 44px; font-size: 20px; }
  .y2k .y-bar i { font-style: normal; flex: 1; height: 1px; background: currentColor; max-width: 220px; }
  .y2k .y-win { position: relative; margin-top: 34px; border: 2px solid var(--ink); background: var(--ink); box-shadow: 10px 10px 0 var(--ink); }
  .y2k .y-win .y-wbar { height: 28px; display: flex; align-items: center; gap: 8px; padding: 0 10px; background: var(--acid); color: var(--ink); font: 700 12px Tektur, sans-serif; letter-spacing: .08em; }
  .y2k .y-win .y-wbar span { flex: 1; }
  .y2k .y-win .y-wbar i { width: 12px; height: 12px; border: 2px solid var(--ink); }
  .y2k .kl-app { transform: none !important; border: 0; box-shadow: none; }

  /* 2 collage */
  .y2k .y-col { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 46px; align-items: start; }
  .y2k .y-col .y-left { position: relative; min-height: 560px; }
  .y2k .y-col .y-note { position: absolute; z-index: 3; left: 46%; top: 220px; width: 210px; background: #fff; color: var(--ink); padding: 12px; transform: rotate(2deg); box-shadow: 0 10px 20px rgba(0,0,0,.4); }
  .y2k .y-col .y-shot { position: absolute; width: 74%; }
  .y2k .y-col .y-shot img { display: block; width: 100%; }
  .y2k .kl-screen { border: 0; box-shadow: none; }
  .y2k .y-col .kl-main { margin-top: 22px; border: 8px solid #fff; box-shadow: 0 20px 40px rgba(0,0,0,.5); transform: rotate(-1deg); }
  .y2k .y-col .kl-pg-row .kl-screen { border: 3px solid #fff; }
  .y2k .y-col .kl-cap { font-family: Tektur, sans-serif; font-weight: 700; background: var(--acid); color: var(--ink); }

  /* 3 why toys */
  .y2k .y-why { position: relative; min-height: 720px; }
  .y2k .y-why .y-t.xl { position: absolute; top: 0; }
  .y2k .y-why svg.path { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .y2k .y-why .y-stop { position: absolute; z-index: 3; }
  .y2k .y-why .y-stop .y-mono { display: block; margin-top: 8px; max-width: 220px; }
  .y2k .y-why .y-num { position: absolute; z-index: 3; width: 22px; height: 22px; border-radius: 50%; background: var(--ink); color: #fff; font: 700 11px Tektur, sans-serif; display: grid; place-items: center; }
  .y2k .y-why .kl-card3d { position: absolute; width: 210px; z-index: 2; }
  .y2k .y-die { position: absolute; z-index: 2; width: 130px; height: 130px; background: #fff; border: 4px solid var(--ink); box-shadow: 8px 8px 0 var(--ink); display: grid; grid-template-columns: repeat(3, 1fr); padding: 14px; gap: 6px; cursor: pointer; transition: transform .4s cubic-bezier(.2,1.6,.4,1); }
  .y2k .y-die i { border-radius: 50%; background: var(--ink); opacity: 0; } .y2k .y-die i.on { opacity: 1; }
  .y2k .y-die:hover { transform: rotate(12deg) scale(1.05); }

  /* 4 try it on black */
  .y2k .kl-try { min-height: 0; padding: 0; display: grid; gap: 22px; overflow: visible; }
  .y2k .kl-try .kl-box { background: #fff; border: 0; max-width: 820px; box-shadow: 6px 6px 0 var(--acid); }
  .y2k .kl-try input { color: var(--ink); font-family: Tektur, sans-serif; font-weight: 500; }
  .y2k .kl-try input::placeholder { color: #8b8796; }
  .y2k .kl-try .kl-go { background: var(--ink); color: var(--acid); border: 0; }
  .y2k .kl-chip { background: #fff; color: var(--ink); border: 0; font: 700 13px Tektur, sans-serif; text-transform: uppercase; box-shadow: 3px 3px 0 var(--pur); height: 30px; }
  .y2k .kl-chip:hover { background: var(--acid); }
  .y2k .kl-chip.on { background: var(--acid); color: var(--ink); box-shadow: 3px 3px 0 #fff; }
  .y2k .kl-scape { border: 2px solid var(--pur); background: #120f1a; backdrop-filter: none; }
  .y2k .kl-heard { font-family: Tektur, sans-serif; color: var(--grn); letter-spacing: .14em; }
  .y2k .kl-heard b { color: var(--acid); }
  .y2k .kl-keys button { background: #fff; color: var(--ink); border: 2px solid var(--ink); }
  .y2k .kl-keys button.blk { background: var(--ink); color: #777; border-color: #333; }
  .y2k .kl-keys button.hit { background: var(--acid); color: var(--ink); }

  /* 5 instruments on purple */
  .y2k .y-inst { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 34px; align-items: start; }
  .y2k .y-paper { background: #fff; color: var(--ink); padding: 22px; box-shadow: 8px 8px 0 var(--ink); position: relative; }
  .y2k .y-paper.k { background: var(--ink); color: #fff; box-shadow: 8px 8px 0 var(--acid); }
  .y2k .kl-tiles { max-width: none; margin-top: 16px; }
  .y2k .kl-tile { background: var(--ink); border: 0; backdrop-filter: none; height: 56px; }
  .y2k .kl-tile b { font-family: Tektur, sans-serif; color: #fff; }
  .y2k .kl-tile span { color: var(--grn); }
  .y2k .kl-tile.on { outline: 3px solid var(--acid); }
  .y2k .kl-grid { margin-top: 16px; max-width: none; }
  .y2k .kl-grid .r > b { color: var(--grn); font-family: Tektur, sans-serif; }
  .y2k .kl-grid .st { border-color: #2c2a33; background: #1b1a20; }
  .y2k .kl-grid .st:nth-of-type(4n+2) { background: #26242d; }
  .y2k .kl-grid .st.on { background: var(--pur); border-color: var(--pur); }
  .y2k .kl-grid .st.on.now { background: var(--acid); }
  .y2k .kl-btn { border: 0; background: var(--acid); color: var(--ink); font-family: Tektur, sans-serif; font-weight: 700; backdrop-filter: none; height: 34px; }
  .y2k .kl-btn.on { background: var(--grn); color: var(--ink); }
  .y2k .kl-btn.solid { background: var(--acid); }
  .y2k .y-paper.k .kl-chip { box-shadow: 3px 3px 0 var(--pur); }

  /* 6 midi */
  .y2k .kl-roll { border: 2px solid var(--grn); background: #0f1410; backdrop-filter: none; }
  .y2k .kl-chords span { border-left-color: #2f3a31; color: var(--grn); font-family: Tektur, sans-serif; }
  .y2k .kl-chords span.now { color: var(--acid); }

  /* 7 kits gallery wall */
  .y2k .y-gal { position: relative; height: 470px; perspective: 900px; margin-top: 26px; }
  .y2k .y-room { position: absolute; inset: 0; transform-style: preserve-3d; pointer-events: none; }
  .y2k .y-room .y-kit { pointer-events: auto; }
  .y2k .y-wall { position: absolute; top: 40px; height: 360px; background: var(--grn); display: flex; align-items: center; justify-content: space-evenly; transform-style: preserve-3d; box-shadow: inset 0 0 80px rgba(0,0,0,.18); }
  .y2k .y-wall.back { left: 24%; width: 52%; transform: translateZ(-300px); }
  .y2k .y-wall.l { left: 0; width: 34%; transform-origin: right center; transform: translateX(-10%) translateZ(-300px) rotateY(62deg); }
  .y2k .y-wall.r { right: 0; width: 34%; transform-origin: left center; transform: translateX(10%) translateZ(-300px) rotateY(-62deg); }
  .y2k .y-kit { position: relative; width: 26%; aspect-ratio: 1; border: 5px solid #fff; background-size: cover; background-position: center; cursor: pointer; box-shadow: 0 10px 20px rgba(0,0,0,.35); transition: transform .3s cubic-bezier(.2,1.6,.4,1); }
  .y2k .y-wall.l .y-kit, .y2k .y-wall.r .y-kit { width: 40%; }
  .y2k .y-wall.back { padding: 0 6%; }
  .y2k .y-wall.back .y-kit { width: 17%; }
  .y2k .y-kit:hover { transform: translateZ(30px) scale(1.05); }
  .y2k .y-kit.on { border-color: var(--acid); }
  .y2k .y-kit span { position: absolute; left: -5px; right: -5px; bottom: -30px; text-align: center; font: 700 12px Tektur, sans-serif; color: var(--ink); letter-spacing: .06em; }
  .y2k .y-weekly { position: absolute; z-index: 4; right: 3%; top: -10px; width: 190px; height: 190px; display: grid; place-items: center; text-align: center; }
  .y2k .y-weekly .y-star { position: absolute; inset: 0; width: 100%; height: 100%; }
  .y2k .y-weekly b { position: relative; z-index: 5; font: 900 18px/1 Tektur, sans-serif; color: var(--ink); transform: rotate(-10deg); }

  /* 8 free + prizes as room cards */
  .y2k .y-free b.fat { display: block; font: 400 clamp(90px, 17vw, 240px)/.8 "Bagel Fat One", sans-serif; letter-spacing: -.04em; color: var(--ink); }
  .y2k .kl-case { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0; margin-top: 30px; }
  .y2k .kl-prize { border: 3px solid var(--ink); background: #fff; margin-left: -10px; box-shadow: 6px 6px 0 var(--ink); transition: transform .3s cubic-bezier(.2,1.6,.4,1); }
  .y2k .kl-prize:nth-child(odd) { transform: rotate(-3deg); } .y2k .kl-prize:nth-child(even) { transform: rotate(2.5deg) translateY(14px); }
  .y2k .kl-prize:hover { transform: rotate(0) translateY(-8px); z-index: 3; }
  .y2k .kl-prize .t { background: #fff; color: var(--ink); }
  .y2k .kl-prize .t b { font-family: Tektur, sans-serif; font-size: 14px; }
  .y2k .kl-prize .t span { color: var(--pur2); }

  /* 9 end */
  .y2k .y-end { text-align: center; display: grid; justify-items: center; gap: 22px; padding: 90px 48px; }
  .y2k .y-end img { width: min(420px, 70vw); }
  .y2k .y-marq { overflow: hidden; white-space: nowrap; background: var(--acid); color: var(--ink); font: 900 22px Tektur, sans-serif; padding: 8px 0; border-top: 2px solid var(--ink); border-bottom: 2px solid var(--ink); }
  .y2k .y-marq span { display: inline-block; animation: y-marq 26s linear infinite; padding-right: 40px; }
  .y2k .y-marq.g { background: var(--grn); }
  @keyframes y-marq { to { transform: translateX(-50%); } }
  @media (max-width: 900px) {
    .y2k .y-panel { padding: 40px 18px; }
    .y2k .y-col, .y2k .y-inst { grid-template-columns: minmax(0, 1fr); }
    .y2k .y-col .y-left { min-height: 420px; }
    .y2k .y-why { min-height: 980px; }
    .y2k .kl-case { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .y2k .y-four { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .y2k .y-why { min-height: 0; display: flex; flex-wrap: wrap; gap: 18px 12px; padding-top: 70px; }
    .y2k .y-why svg.path, .y2k .y-why .y-num, .y2k .y-why > .y-star { display: none; }
    .y2k .y-why .kl-card3d { position: relative; left: auto !important; right: auto !important; top: auto !important; width: calc(50% - 6px); }
    .y2k .y-why .y-die { position: relative; left: auto !important; top: auto !important; width: 90px; height: 90px; order: 2; }
    .y2k .y-why .y-stop { position: relative; left: auto !important; top: auto !important; width: 100%; order: 3; }
    .y2k .y-gal { height: auto; perspective: none; }
    .y2k .y-room { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px 14px; pointer-events: auto; }
    .y2k .y-wall { position: static; display: contents; transform: none !important; }
    .y2k .y-wall .y-kit, .y2k .y-wall.l .y-kit, .y2k .y-wall.r .y-kit, .y2k .y-wall.back .y-kit { width: 100%; }
    .y2k .y-gal { background: var(--grn); padding: 20px 14px 44px; }
    .y2k .y-weekly { width: 130px; height: 130px; top: 10px; }
    .y2k .y-weekly b { font-size: 13px; }
  }
  @media (prefers-reduced-motion: reduce) { .y2k .y-star, .y2k .y-marq span { animation: none; } }
  `;
  if (Y2K) document.head.append(yCss);

  // ------------------------------------------------------------------ LANDING 3: the toy box (Eman, 11 Nov 2026 22:12)
  // "fully reimagine the landing page": more fun, more childish, more gamer, 3D characters, bubbles, glossy blobs,
  // a goth / Y2K dark edge, slang for 13-20 year olds, and the DAW itself in colour (teen projects on the background
  // pictures from the DAW's own art wall). A creature behind the page reaches out and holds TOY MACHINE.
  // KT2_LANDING_Y2K = the 9 Nov collage page, KT2_LANDING_CALM = the first calm page.
  // Media: ui/landing3/ on localhost, the artifact's asset store (LAND_BLOBS) when published.
  // CHARACTERS ARE TEST PLACEHOLDERS (Eman: "for now you can use these, just as tests"). Swap them in CHARS only.
  const CHARS = { vamp: "landing3/vamp.webp", bun: "landing3/bun.webp", creature: "landing3/creature.webp" };
  const L3 = (f) => LAND(f.indexOf("/") < 0 ? "landing3/" + f : f);
  // six teen projects built in the real DAW (tests/kt2/landing3/teen-projects.js), each on its own background
  const SHOTS = [
    { f: "daw0.webp", name: "3am in my room fr", bpm: 140, bg: 7 },
    { f: "daw1.webp", name: "villain era v4", bpm: 150, bg: 20 },
    { f: "daw2.webp", name: "dreamcore maybe", bpm: 128, bg: 26 },
    { f: "daw3.webp", name: "math test beat", bpm: 145, bg: 12 },
    { f: "daw4.webp", name: "goth summer", bpm: 135, bg: 3 },
    { f: "daw5.webp", name: "for the group chat", bpm: 160, bg: 29 },
  ];
  const BGS = (n) => `bg/KT_UP_${String(n).padStart(2, "0")}-s.jpg`;
  // a puffy 4-point star with eyes (the little "toybits" that float around)
  let bitN = 0;
  const BIT = (c1, c2, cls, style) => {
    const id = "kb" + (bitN++);
    return `<svg class="v-bit ${cls || ""}" style="${style || ""}" viewBox="-10 -10 120 120"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".18" stop-color="${c1}"/><stop offset=".75" stop-color="${c2}"/><stop offset="1" stop-color="#0a0810"/></radialGradient></defs>`
      + `<path d="M50 8 Q60 40 92 50 Q60 60 50 92 Q40 60 8 50 Q40 40 50 8Z" fill="url(#${id})" stroke="url(#${id})" stroke-width="16" stroke-linejoin="round"/>`
      + `<ellipse cx="36" cy="30" rx="10" ry="5" fill="#fff" opacity=".7" transform="rotate(-30 36 30)"/>`
      + `<rect x="38" y="44" width="7" height="12" rx="3.5" fill="#fff"/><rect x="55" y="44" width="7" height="12" rx="3.5" fill="#fff"/><rect x="40" y="48" width="3.5" height="6" rx="1.75" fill="#0a0810"/><rect x="57" y="48" width="3.5" height="6" rx="1.75" fill="#0a0810"/></svg>`;
  };
  // glossy squircle blobs, after the jelly-icon references (our colours: purple, acid, green, ice, black)
  const BLOBS = [
    "radial-gradient(60% 55% at 50% 60%, #e4ff3a 0%, #b6ff4a 30%, #6c3dff 72%, #1a0f33 100%)",
    "radial-gradient(70% 60% at 50% 30%, #0b0910 0%, #2a174f 40%, #8f63ff 80%, #d9ccff 100%)",
    "radial-gradient(65% 65% at 50% 50%, #3dff7a 0%, #1f8f4d 40%, #07140d 85%)",
    "radial-gradient(60% 50% at 50% 55%, #7fe8ff 0%, #6c3dff 55%, #0b0910 100%)",
    "radial-gradient(55% 55% at 50% 50%, #0b0910 0%, #0b0910 35%, #e4ff3a 70%, #3dff7a 100%)",
    "linear-gradient(160deg, #c7b3ff 0%, #6c3dff 45%, #0b0910 100%)",
  ];
  const BLOB = (i, cls, style) => `<i class="v-blob ${cls || ""}" style="--g:${BLOBS[i % BLOBS.length]};${style || ""}"></i>`;
  const BUBS = (n, seed) => Array.from({ length: n }, (_, i) => { const h = (k) => { const x = Math.sin((i + 1) * 127.1 + (seed || 0) * 311.7 + k * 74.7) * 43758.5453; return x - Math.floor(x); }, r = h(0), s = 14 + Math.round(h(1) * 46); return `<i class="v-bub" style="left:${(r * 97).toFixed(1)}%;width:${s}px;height:${s}px;--t:${(10 + h(2) * 12).toFixed(1)}s;--dl:-${(h(3) * 20).toFixed(1)}s"></i>`; }).join("");
  const SPARK = (cls, style) => `<svg class="v-spark ${cls || ""}" style="${style || ""}" viewBox="0 0 100 100"><defs><linearGradient id="vsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#b9b3c9"/><stop offset=".55" stop-color="#5f5874"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path d="M50 0 C54 38 62 46 100 50 C62 54 54 62 50 100 C46 62 38 54 0 50 C38 46 46 38 50 0Z" fill="url(#vsg)"/></svg>`;
  const STK = (t, cls, style) => `<span class="v-stk ${cls || ""}" style="${style || ""}">${t}</span>`;
  const vCss = H("style"); vCss.id = "kl-v3-css";
  vCss.textContent = `
  .kl.v3 { --ink: #0a0810; --ink2: #120e1c; --pur: #8f63ff; --pur2: #6c3dff; --lil: #c7b3ff; --grn: #3dff7a; --ice: #7fe8ff; --mx: 0; --my: 0; background: var(--ink); font-family: Inter, system-ui, sans-serif; overflow-x: hidden; }
  .v3 .kl-top { background: linear-gradient(var(--ink) 0%, rgba(10,8,16,.75) 70%, transparent); }
  .v3 .kl-grain { opacity: .07; }
  .v3 section { position: relative; overflow: hidden; display: block; align-content: start; min-height: 0; isolation: isolate; }
  .v3 .v-in { position: relative; z-index: 3; max-width: 1240px; margin: 0 auto; padding: 0 28px; }
  .v3 .v-h { font: 400 clamp(40px, 6.2vw, 92px)/.92 "Bagel Fat One", Unbounded, sans-serif; letter-spacing: -.01em; margin: 0; color: #fff; }
  .v3 .v-h.s { font-size: clamp(34px, 4.6vw, 66px); }
  .v3 .v-h em { font-style: normal; color: var(--acid); }
  .v3 .v-h .g { color: var(--grn); }
  .v3 .v-p { font: 500 clamp(15px, 1.35vw, 19px)/1.45 Inter, sans-serif; color: #cfc8e6; max-width: 520px; margin: 16px 0 0; }
  .v3 .v-k { display: inline-flex; align-items: center; gap: 8px; font: 700 11px/1 "Martian Mono", monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--acid); margin-bottom: 16px; }
  .v3 .v-k::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: currentColor; box-shadow: 0 0 12px currentColor; }
  .v3 .v-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 58px; padding: 0 30px; border: 0; border-radius: 999px; cursor: pointer; font: 400 19px "Bagel Fat One", sans-serif; letter-spacing: .02em; color: var(--ink);
    background: radial-gradient(120% 140% at 30% 0%, #fbffd0 0%, var(--acid) 38%, #a9c60f 100%); box-shadow: inset 0 -5px 0 rgba(0,0,0,.18), inset 0 3px 0 rgba(255,255,255,.7), 0 10px 30px rgba(228,255,58,.35), 0 0 0 3px var(--ink), 0 0 0 5px rgba(228,255,58,.5); transition: transform .15s; }
  .v3 .v-btn:hover { transform: translateY(-2px) scale(1.03); }
  .v3 .v-btn:active { transform: translateY(1px) scale(.98); }
  .v3 .v-btn.alt { color: #fff; background: radial-gradient(120% 140% at 30% 0%, #e6dcff 0%, var(--pur) 40%, #3a1d99 100%); box-shadow: inset 0 -5px 0 rgba(0,0,0,.25), inset 0 3px 0 rgba(255,255,255,.5), 0 10px 30px rgba(143,99,255,.4), 0 0 0 3px var(--ink), 0 0 0 5px rgba(199,179,255,.5); }
  .v3 .v-chrome { font: 400 clamp(84px, 15vw, 230px)/.85 "Bagel Fat One", sans-serif; letter-spacing: -.02em; margin: 0; position: relative; display: inline-block;
    background: linear-gradient(180deg, #fff 0%, #efe9ff 22%, #a58cff 47%, #2b1863 50%, #6c3dff 62%, #d9ccff 82%, #fff 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
    -webkit-text-stroke: 2px rgba(255,255,255,.55); filter: drop-shadow(0 0 28px rgba(143,99,255,.55)) drop-shadow(0 10px 0 #05040a); }
  .v3 .v-blob { position: absolute; display: block; width: var(--s, 120px); aspect-ratio: 1; border-radius: 34%; background: var(--g); z-index: 1;
    box-shadow: inset 0 0 0 2px rgba(255,255,255,.28), inset 0 14px 26px rgba(255,255,255,.35), inset 0 -18px 30px rgba(0,0,0,.45), 0 24px 60px rgba(0,0,0,.55);
    animation: vbob var(--bt, 7s) ease-in-out infinite; animation-delay: var(--bd, 0s); transform: translate(calc(var(--mx) * var(--d, 10) * 1px), calc(var(--my) * var(--d, 10) * 1px)) rotate(var(--r, 0deg)); }
  .v3 .v-blob::after { content: ""; position: absolute; left: 14%; top: 8%; width: 46%; height: 22%; border-radius: 50%; background: linear-gradient(rgba(255,255,255,.75), rgba(255,255,255,0)); filter: blur(1px); }
  .v3 .v-bit { position: absolute; z-index: 4; width: var(--s, 90px); height: auto; overflow: visible; filter: drop-shadow(0 0 22px var(--glow, rgba(143,99,255,.6))) drop-shadow(0 12px 18px rgba(0,0,0,.5));
    animation: vbob var(--bt, 6s) ease-in-out infinite; animation-delay: var(--bd, 0s); transform: translate(calc(var(--mx) * var(--d, 16) * 1px), calc(var(--my) * var(--d, 16) * 1px)) rotate(var(--r, 0deg)); }
  .v3 .v-spark { position: absolute; z-index: 5; width: var(--s, 40px); animation: vtw 3.2s ease-in-out infinite; animation-delay: var(--bd, 0s); filter: drop-shadow(0 0 8px rgba(255,255,255,.7)); }
  .v3 .v-bub { position: absolute; bottom: -80px; z-index: 2; border-radius: 50%; pointer-events: none; animation: vrise var(--t, 12s) linear infinite; animation-delay: var(--dl, 0s);
    background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.95) 0 6%, rgba(255,255,255,.22) 8% 20%, rgba(199,179,255,.1) 42%, rgba(127,232,255,.28) 62%, rgba(228,255,58,.22) 66%, rgba(255,255,255,.7) 70%, transparent 71%);
    box-shadow: inset 0 0 12px rgba(199,179,255,.35), 0 0 16px rgba(143,99,255,.25); backdrop-filter: brightness(1.25); }
  .v3 .v-stk { position: absolute; z-index: 6; padding: 8px 14px 7px; border-radius: 999px; background: #fff; color: var(--ink); font: 700 12px/1 "Martian Mono", monospace; letter-spacing: .02em; white-space: nowrap;
    box-shadow: 0 0 0 3px var(--ink), 0 8px 18px rgba(0,0,0,.45); transform: rotate(var(--r, -4deg)) translate(calc(var(--mx) * var(--d, 6) * 1px), calc(var(--my) * var(--d, 6) * 1px)); animation: vbob 5s ease-in-out infinite; animation-delay: var(--bd, 0s); }
  .v3 .v-stk.a { background: var(--acid); } .v3 .v-stk.g { background: var(--grn); } .v3 .v-stk.p { background: var(--pur); color: #fff; } .v3 .v-stk.k { background: var(--ink); color: var(--acid); box-shadow: 0 0 0 2px var(--acid), 0 8px 18px rgba(0,0,0,.45); }
  .v3 .v-char { position: absolute; z-index: 6; pointer-events: none; filter: drop-shadow(0 30px 40px rgba(0,0,0,.6)) drop-shadow(0 0 40px rgba(143,99,255,.35));
    transform: translate(calc(var(--mx) * var(--d, 22) * 1px), calc(var(--my) * var(--d, 22) * 1px)); }
  .v3 .v-char img { display: block; width: 100%; animation: vfloat var(--bt, 6s) ease-in-out infinite; animation-delay: var(--bd, 0s); }
  @keyframes vbob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -14px; } }
  @keyframes vfloat { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-18px) rotate(2deg); } }
  @keyframes vtw { 0%, 100% { opacity: .2; scale: .6; } 50% { opacity: 1; scale: 1; } }
  @keyframes vrise { 0% { transform: translateY(0) translateX(0); opacity: 0; } 8% { opacity: 1; } 50% { transform: translateY(-60vh) translateX(18px); } 100% { transform: translateY(-125vh) translateX(-10px); opacity: .2; } }
  @keyframes vmarq { to { transform: translateX(-50%); } }
  @keyframes vhead { 0% { left: 1%; } 100% { left: 96%; } }

  /* 1 HERO: chrome name, the line, the DAW on a picture, the cast floating around it */
  .v3 .v-hero { padding: 26px 0 70px; text-align: center; background:
      radial-gradient(60% 40% at 15% 92%, rgba(108,61,255,.55), transparent 70%), radial-gradient(50% 35% at 88% 80%, rgba(61,255,122,.18), transparent 70%),
      radial-gradient(70% 50% at 50% 0%, #2a174f 0%, transparent 70%), var(--ink); }
  .v3 .v-cloud { position: absolute; z-index: 0; border-radius: 50%; background: radial-gradient(closest-side, rgba(199,179,255,.22), rgba(108,61,255,.08) 60%, transparent); filter: blur(10px); }
  .v3 .v-hero .v-line { font: 400 clamp(26px, 3.6vw, 52px)/1 "Bagel Fat One", sans-serif; color: #fff; margin: 10px 0 0; }
  .v3 .v-hero .v-line em { font-style: normal; color: var(--acid); text-shadow: 0 0 24px rgba(228,255,58,.45); }
  .v3 .v-hero .v-p { margin: 16px auto 0; text-align: center; max-width: 600px; }
  .v3 .v-cta { display: flex; gap: 18px; justify-content: center; margin-top: 30px; flex-wrap: wrap; }
  .v3 .v-stage { position: relative; z-index: 5; width: min(1080px, 92%); margin: 64px auto 0; perspective: 1600px; }
  .v3 .v-win { position: relative; aspect-ratio: 16 / 10; border-radius: 18px; overflow: hidden; background: #000; transform: rotateX(var(--tilt, 0deg)); transform-origin: 50% 100%;
    box-shadow: 0 0 0 2px rgba(255,255,255,.22), 0 0 0 8px rgba(10,8,16,.9), 0 0 0 10px rgba(199,179,255,.35), 0 50px 120px rgba(0,0,0,.7), 0 0 120px rgba(143,99,255,.4); }
  .v3 .v-win img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .7s; }
  .v3 .v-win img.on { opacity: 1; }
  .v3 .v-win::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(115deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 28%); }
  .v3 .v-head { position: absolute; z-index: 2; top: 6.5%; bottom: 21%; width: 2px; background: var(--acid); box-shadow: 0 0 14px var(--acid); animation: vhead 7s linear infinite; }
  .v3 .v-now { position: absolute; z-index: 7; left: -18px; top: -22px; transform: rotate(-3deg); background: var(--ink); color: #fff; border-radius: 14px; padding: 10px 16px; text-align: left; box-shadow: 0 0 0 2px var(--acid), 0 14px 30px rgba(0,0,0,.5); }
  .v3 .v-now small { display: block; font: 700 9px/1 "Martian Mono", monospace; letter-spacing: .16em; color: var(--acid); margin-bottom: 6px; }
  .v3 .v-now b { font: 400 22px/1 "Bagel Fat One", sans-serif; }
  .v3 .v-vibe { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 34px; flex-wrap: wrap; }
  .v3 .v-vibe > span { font: 400 18px "Bagel Fat One", sans-serif; color: #fff; margin-right: 6px; }
  .v3 .v-vibe button { width: 54px; height: 54px; border-radius: 50%; border: 0; padding: 0; cursor: pointer; background-size: cover; background-position: center; box-shadow: 0 0 0 3px var(--ink), 0 0 0 5px rgba(255,255,255,.25); transition: transform .15s, box-shadow .15s; }
  .v3 .v-vibe button:hover { transform: scale(1.1); }
  .v3 .v-vibe button.on { box-shadow: 0 0 0 3px var(--ink), 0 0 0 6px var(--acid), 0 0 24px rgba(228,255,58,.5); transform: scale(1.12); }
  .v3 .v-marq { position: relative; z-index: 8; overflow: hidden; white-space: nowrap; background: var(--acid); color: var(--ink); padding: 12px 0; transform: rotate(-1.2deg) scaleX(1.03); margin: -10px 0; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
  .v3 .v-marq.g { background: var(--grn); transform: rotate(1deg); }
  .v3 .v-marq.k { background: var(--ink); color: var(--acid); box-shadow: 0 0 0 2px var(--acid); }
  .v3 .v-marq span { display: inline-block; font: 400 26px/1 "Bagel Fat One", sans-serif; letter-spacing: .02em; animation: vmarq 26s linear infinite; padding-right: 20px; }

  /* 2 UR PROJECT UR LORE: a fan of projects + their pattern names as stickers */
  .v3 .v-lore { padding: 110px 0 120px; background: radial-gradient(80% 70% at 30% 30%, #a383ff 0%, #6c3dff 45%, #2a1270 100%); }
  .v3 .v-lore .v-in { display: grid; grid-template-columns: minmax(0, 430px) minmax(0, 1fr); gap: 40px; align-items: center; }
  .v3 .v-lore .v-p { color: #f1ecff; }
  .v3 .v-lore .v-k { color: var(--ink); }
  .v3 .v-fan { position: relative; height: 470px; margin-top: 30px; }
  .v3 .v-card { position: absolute; left: 56%; top: 30px; width: 340px; margin-left: -170px; border-radius: 18px; overflow: hidden; background: #fff; transform-origin: 50% 120%;
    transform: translateX(var(--x, 0)) rotate(var(--r)) translateY(var(--y, 0)); transition: transform .35s cubic-bezier(.3,1.6,.5,1); box-shadow: 0 0 0 3px var(--ink), 0 30px 60px rgba(0,0,0,.45); cursor: pointer; }
  .v3 .v-card img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
  .v3 .v-card div { padding: 12px 16px 14px; color: var(--ink); text-align: left; }
  .v3 .v-card b { display: block; font: 400 22px/1 "Bagel Fat One", sans-serif; }
  .v3 .v-card small { font: 700 10px "Martian Mono", monospace; letter-spacing: .1em; color: #6c6880; text-transform: uppercase; }
  .v3 .v-card:hover, .v3 .v-card.up { transform: translateX(var(--x, 0)) rotate(calc(var(--r) * .4)) translateY(-40px) scale(1.06); z-index: 9; }

  /* 3 THE CREATURE: lives behind the page and holds TOY MACHINE out to you */
  .v3 .v-beast { padding: 100px 0 0; min-height: 1080px; background: radial-gradient(60% 60% at 80% 30%, rgba(120,20,30,.28), transparent 70%), radial-gradient(70% 60% at 20% 90%, rgba(108,61,255,.25), transparent 70%), #07060b; }
  .v3 .v-beast .v-in { max-width: 1240px; }
  .v3 .v-beast .v-txt { position: relative; z-index: 6; max-width: 470px; }
  .v3 .v-pow { display: flex; flex-direction: column; gap: 10px; margin-top: 26px; }
  .v3 .v-pow span { align-self: flex-start; padding: 11px 16px 10px; border-radius: 14px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); font: 600 14px/1.2 Inter, sans-serif; color: #fff; backdrop-filter: blur(6px); }
  .v3 .v-pow span b { color: var(--acid); font-weight: 800; }
  .v3 .v-rig { position: absolute; z-index: 2; right: max(-40px, calc(50% - 680px)); top: 70px; width: 840px; transform: translate(calc(var(--mx) * -10px), calc(var(--my) * -6px)); }
  .v3 .v-rig > img { position: absolute; left: 0; top: 0; width: 840px; display: block; -webkit-mask-image: linear-gradient(#000 82%, transparent 100%); mask-image: linear-gradient(#000 82%, transparent 100%); }
  .v3 .v-rig .back { z-index: 1; filter: drop-shadow(0 0 60px rgba(160,30,40,.35)); }
  .v3 .v-rig .front { z-index: 3; clip-path: polygon(0 61%, 47% 61%, 47% 92%, 0 92%); filter: drop-shadow(0 10px 14px rgba(0,0,0,.6)); }
  .v3 .v-rig .eyes { position: absolute; z-index: 4; left: 66%; top: 32%; width: 140px; height: 50px; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,40,40,.55), transparent); filter: blur(8px); animation: veye 3.4s ease-in-out infinite; }
  @keyframes veye { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
  .v3 .v-held { position: absolute; z-index: 2; left: -440px; top: 512px; width: 640px; transform: rotate(-7deg); transform-origin: 100% 0; border-radius: 14px; overflow: hidden;
    box-shadow: 0 0 0 2px rgba(255,255,255,.25), 0 0 0 7px #0b0910, 0 40px 90px rgba(0,0,0,.75), 0 0 80px rgba(143,99,255,.35); animation: vhold 6s ease-in-out infinite; }
  .v3 .v-held img { display: block; width: 100%; }
  @keyframes vhold { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(-5deg) translateY(-6px); } }

  /* 4 TEXT A SYNTH: the prompt box as a message */
  .v3 .v-try { padding: 110px 0 110px; background: radial-gradient(70% 60% at 50% 0%, #2a174f, transparent 70%), radial-gradient(50% 40% at 90% 90%, rgba(127,232,255,.15), transparent 70%), var(--ink2); }
  .v3 .kl-try { min-height: 0; padding: 0; display: block; overflow: visible; }
  .v3 .kl-try .kl-box { margin-top: 30px; max-width: 820px; height: 70px; padding: 0 8px 0 24px; border-radius: 999px; background: #fff; border: 0; box-shadow: 0 0 0 3px var(--ink), 0 0 0 6px var(--pur), 0 20px 50px rgba(143,99,255,.35); }
  .v3 .kl-try input { color: var(--ink); font: 600 18px Inter, sans-serif; }
  .v3 .kl-try input::placeholder { color: #9a94ad; }
  .v3 .kl-try .kl-go { width: 54px; height: 54px; border-radius: 50%; border: 0; background: var(--acid); color: var(--ink); }
  .v3 .kl-try .kl-chips { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 8px; max-width: 900px; }
  .v3 .kl-chip { height: 36px; padding: 0 16px; border-radius: 999px; border: 0; background: rgba(255,255,255,.08); color: #e9e4f7; font: 600 13px Inter, sans-serif; letter-spacing: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); }
  .v3 .kl-chip:hover { background: rgba(255,255,255,.16); color: #fff; }
  .v3 .kl-chip.on { background: var(--acid); color: var(--ink); box-shadow: none; }
  .v3 .kl-scape { margin-top: 30px; max-width: none; height: 280px; border-radius: 22px; overflow: hidden; background: #07060b; box-shadow: 0 0 0 2px rgba(255,255,255,.12), 0 30px 70px rgba(0,0,0,.5); }
  .v3 .kl-heard { left: 22px; bottom: 18px; color: #bdb5d6; letter-spacing: .12em; }
  .v3 .kl-heard b { color: var(--acid); }
  .v3 .kl-keys { margin-top: 14px; max-width: none; gap: 5px; }
  .v3 .kl-keys button { height: 62px; border-radius: 12px; border: 0; background: linear-gradient(#fff, #d9d3ea); color: #6c6880; box-shadow: inset 0 -5px 0 rgba(0,0,0,.12), 0 0 0 2px var(--ink); }
  .v3 .kl-keys button.blk { background: linear-gradient(#2a2438, #0b0910); color: #8d86a3; }
  .v3 .kl-keys button.hit { background: var(--acid); color: var(--ink); }

  /* 5 TOYS: TOY MACHINE card + sounds, KILLDRUM as a pocket pet */
  .v3 .v-toys { padding: 110px 0 120px; background: radial-gradient(70% 60% at 20% 20%, rgba(143,99,255,.25), transparent 70%), var(--ink); }
  .v3 .v-toys .v-in { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px; align-items: start; }
  .v3 .v-toy { position: relative; border-radius: 30px; padding: 40px 36px 40px; min-height: 640px; overflow: hidden; }
  .v3 .v-toy.tm { background: radial-gradient(90% 70% at 30% 10%, #3a1d99 0%, #1a0f33 60%, #0b0910 100%); box-shadow: inset 0 0 0 2px rgba(199,179,255,.25); }
  .v3 .v-toy.kd { background: radial-gradient(90% 70% at 70% 10%, #1f8f4d 0%, #0a2a17 55%, #050b07 100%); box-shadow: inset 0 0 0 2px rgba(61,255,122,.25); }
  .v3 .v-toy .v-h { font-size: clamp(30px, 3.2vw, 46px); }
  .v3 .v-toy .kl-card3d { width: 210px; position: absolute; right: 26px; top: 28px; }
  .v3 .v-toy.tm .v-txt { max-width: 300px; }
  .v3 .kl-tiles { margin-top: 120px; max-width: none; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .v3 .kl-tile { height: 68px; border-radius: 16px; border: 0; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
  .v3 .kl-tile:hover { background: rgba(255,255,255,.12); }
  .v3 .kl-tile.on { box-shadow: inset 0 0 0 2px var(--acid); }
  .v3 .kl-tile i { border-right: 0; background: rgba(228,255,58,.18); }
  .v3 .v-pet { position: relative; margin: 96px auto 0; width: min(520px, 100%); aspect-ratio: 1 / .98; border-radius: 50% 50% 46% 46% / 56% 56% 44% 44%;
    background: radial-gradient(60% 45% at 35% 22%, rgba(255,255,255,.55), transparent 60%), radial-gradient(90% 90% at 50% 60%, #9d7bff 0%, #6c3dff 45%, #2a1270 85%);
    box-shadow: inset 0 -30px 60px rgba(0,0,0,.45), inset 0 10px 30px rgba(255,255,255,.35), 0 0 0 3px rgba(255,255,255,.18), 0 40px 80px rgba(0,0,0,.6), 0 0 90px rgba(143,99,255,.45); }
  .v3 .v-pet::before, .v3 .v-pet::after { content: ""; position: absolute; top: -26px; width: 70px; height: 90px; background: radial-gradient(60% 50% at 40% 35%, #c7b3ff, #6c3dff 70%); clip-path: polygon(50% 0, 100% 100%, 0 100%); }
  .v3 .v-pet::before { left: 16%; transform: rotate(-24deg); } .v3 .v-pet::after { right: 16%; transform: rotate(24deg); }
  .v3 .v-pet .ring { position: absolute; left: 50%; top: -34px; width: 46px; height: 46px; margin-left: -23px; border-radius: 50%; border: 6px solid #d8d4e4; box-shadow: inset 0 0 0 2px rgba(0,0,0,.2); }
  .v3 .v-lcd { position: absolute; left: 11%; right: 11%; top: 20%; border-radius: 22px; padding: 14px 14px 10px; background: linear-gradient(#cfe08a, #a9bf5e); box-shadow: inset 0 0 0 6px #1b1528, inset 0 6px 16px rgba(0,0,0,.35); }
  .v3 .v-lcdt { display: flex; justify-content: space-between; margin-top: 10px; font: 700 10px/1 "Martian Mono", monospace; letter-spacing: .08em; color: #2b3410; text-transform: uppercase; }
  .v3 .v-lcdt b { animation: vblink 1s steps(2) infinite; } @keyframes vblink { 50% { opacity: 0; } }
  .v3 .v-lcd .kl-grid { margin: 0; gap: 3px; max-width: none; }
  .v3 .v-lcd .kl-grid .r { grid-template-columns: 34px repeat(16, minmax(0, 1fr)); gap: 2px; }
  .v3 .v-lcd .kl-grid .r > b { font: 700 8px "Martian Mono", monospace; letter-spacing: 0; color: #2b3410; }
  .v3 .v-lcd .kl-grid .st { height: 22px; border: 0; border-radius: 3px; background: rgba(43,52,16,.12); }
  .v3 .v-lcd .kl-grid .st:nth-of-type(4n+2) { background: rgba(43,52,16,.22); }
  .v3 .v-lcd .kl-grid .st.on { background: #1b1528; }
  .v3 .v-lcd .kl-grid .st.now { box-shadow: inset 0 0 0 2px #1b1528; }
  .v3 .v-lcd .kl-grid .st.on.now { background: #6c3dff; }
  .v3 .v-pet .v-pbtn { position: absolute; bottom: 12%; display: grid; place-items: center; width: 66px; height: 66px; border-radius: 50%; border: 0; cursor: pointer; font: 400 12px "Bagel Fat One", sans-serif; color: var(--ink);
    background: radial-gradient(circle at 35% 30%, #fff, #e4ff3a 40%, #93ab0c); box-shadow: inset 0 -5px 0 rgba(0,0,0,.2), 0 0 0 4px #1b1528, 0 10px 20px rgba(0,0,0,.4); }
  .v3 .v-pet .v-pbtn.l { left: 22%; } .v3 .v-pet .v-pbtn.m { left: 50%; margin-left: -33px; bottom: 7%; } .v3 .v-pet .v-pbtn.r { right: 22%; }
  .v3 .v-pet .v-pbtn.on { background: radial-gradient(circle at 35% 30%, #fff, #3dff7a 40%, #138a3e); }
  .v3 .v-toy.kd .kl-kits { justify-content: center; margin-top: 26px; display: flex; flex-wrap: wrap; gap: 8px; }
  .v3 .v-toy.kd [data-act=drum] { display: none; }

  /* 6 DICE: roll chords, bend them */
  .v3 .v-dice { padding: 110px 0 120px; background: radial-gradient(80% 70% at 70% 20%, #7dffa6 0%, #3dff7a 40%, #12a547 100%); color: var(--ink); }
  .v3 .v-dice .v-h, .v3 .v-dice .v-p { color: var(--ink); }
  .v3 .v-dice .v-k { color: var(--ink); }
  .v3 .v-dice .v-top { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 30px; align-items: center; }
  .v3 .y-die { position: relative; width: 170px; height: 170px; justify-self: center; border-radius: 36px; background: radial-gradient(70% 60% at 30% 25%, #fff, #e9e4f7 55%, #b8b0cf); box-shadow: inset 0 -10px 20px rgba(0,0,0,.18), 0 0 0 4px var(--ink), 14px 18px 0 var(--ink);
    display: grid; grid-template-columns: repeat(3, 1fr); padding: 26px; gap: 10px; cursor: pointer; transform: rotate(-10deg); transition: transform .2s; }
  .v3 .y-die:hover { transform: rotate(6deg) scale(1.06); }
  .v3 .y-die i { border-radius: 50%; background: var(--ink); opacity: 0; } .v3 .y-die i.on { opacity: 1; }
  .v3 .v-dice .kl-drow { margin-top: 34px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .v3 .v-dice .kl-btn { height: 46px; border-radius: 999px; padding: 0 22px; border: 0; background: var(--ink); color: var(--acid); font: 400 16px "Bagel Fat One", sans-serif; letter-spacing: .02em; }
  .v3 .v-dice .kl-btn.solid { background: var(--ink); color: var(--acid); }
  .v3 .v-dice .kl-chip { background: rgba(10,8,16,.12); color: var(--ink); box-shadow: inset 0 0 0 2px rgba(10,8,16,.35); }
  .v3 .v-dice .kl-chip.on { background: var(--ink); color: var(--grn); }
  .v3 .v-dice .kl-roll { margin-top: 22px; height: 300px; border-radius: 22px; overflow: hidden; background: #07120b; box-shadow: 0 0 0 4px var(--ink), 0 30px 60px rgba(0,0,0,.35); }
  .v3 .v-dice .kl-chords span { color: var(--ink); border-left-color: rgba(10,8,16,.3); font-family: "Bagel Fat One", sans-serif; font-weight: 400; font-size: 18px; }
  .v3 .v-dice .kl-chords span.now { color: #fff; border-left-color: var(--ink); text-shadow: 0 0 0 var(--ink), 2px 2px 0 var(--ink); }

  /* 7 KITS: jelly tiles, new ones every week */
  .v3 .v-kits { padding: 110px 0 120px; background: radial-gradient(60% 50% at 50% 0%, #2a174f, transparent 70%), #07060b; }
  .v3 .v-shelf { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 56px 34px; margin-top: 50px; max-width: 980px; }
  .v3 .v-shelf .y-kit { position: relative; aspect-ratio: 1; width: 100%; border: 0; padding: 0; cursor: pointer; border-radius: 30%; background-size: cover; background-position: center;
    box-shadow: inset 0 0 0 3px rgba(255,255,255,.3), inset 0 18px 30px rgba(255,255,255,.3), inset 0 -24px 34px rgba(0,0,0,.5), 0 26px 50px rgba(0,0,0,.6), 0 0 40px var(--kc, rgba(143,99,255,.35));
    animation: vbob 6s ease-in-out infinite; animation-delay: var(--bd, 0s); transition: transform .2s; }
  .v3 .v-shelf .y-kit::after { content: ""; position: absolute; left: 12%; top: 6%; width: 50%; height: 20%; border-radius: 50%; background: linear-gradient(rgba(255,255,255,.7), rgba(255,255,255,0)); }
  .v3 .v-shelf .y-kit:hover { transform: scale(1.06) rotate(-2deg); }
  .v3 .v-shelf .y-kit.on { box-shadow: inset 0 0 0 4px var(--acid), 0 26px 50px rgba(0,0,0,.6), 0 0 50px rgba(228,255,58,.55); }
  .v3 .v-shelf .y-kit span { position: absolute; left: 0; right: 0; bottom: -34px; text-align: center; font: 400 17px "Bagel Fat One", sans-serif; color: #fff; }
  .v3 .v-weekly { position: absolute; right: 6%; top: 70px; z-index: 6; width: 200px; height: 200px; display: grid; place-items: center; text-align: center; transform: rotate(10deg); }
  .v3 .v-weekly .y-star { position: absolute; inset: 0; width: 100%; height: 100%; animation: vspin 30s linear infinite; }
  .v3 .v-weekly b { position: relative; font: 400 21px/1 "Bagel Fat One", sans-serif; color: var(--ink); }
  @keyframes vspin { to { transform: rotate(360deg); } }

  /* 8 IT'S LITERALLY A GAME: quests + what you can win */
  .v3 .v-game { padding: 110px 0 120px; background: radial-gradient(90% 80% at 50% 0%, #a383ff 0%, #6c3dff 45%, #2a1270 100%); }
  .v3 .v-game .v-k { color: var(--acid); }
  .v3 .v-game .kl-case { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; margin-top: 46px; }
  .v3 .v-game .kl-prize { border-radius: 20px; border: 0; background: #0b0910; box-shadow: 0 0 0 3px var(--ink), 0 20px 40px rgba(0,0,0,.4); transform: rotate(var(--r, 0deg)); }
  .v3 .v-game .kl-prize:nth-child(odd) { --r: -3deg; } .v3 .v-game .kl-prize:nth-child(even) { --r: 3deg; }
  .v3 .v-game .kl-prize { transition: transform .3s cubic-bezier(.3,1.6,.5,1); } .v3 .v-game .kl-prize:hover { transform: rotate(0) translateY(-10px) scale(1.04); z-index: 3; }
  .v3 .v-game .kl-prize .t b { font: 400 15px "Bagel Fat One", sans-serif; letter-spacing: .02em; }
  .v3 .v-free { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 50px; }
  .v3 .v-free span { padding: 14px 22px 12px; border-radius: 999px; background: var(--ink); color: #fff; font: 400 22px/1 "Bagel Fat One", sans-serif; box-shadow: 0 0 0 2px rgba(255,255,255,.2); }
  .v3 .v-free span:nth-child(2) { background: var(--acid); color: var(--ink); } .v3 .v-free span:nth-child(3) { background: var(--grn); color: var(--ink); }

  /* 9 END */
  .v3 .v-end { padding: 120px 0 160px; text-align: center; background: radial-gradient(60% 50% at 50% 60%, rgba(108,61,255,.45), transparent 70%), var(--ink); }
  .v3 .v-end .v-chrome { font-size: clamp(70px, 12vw, 180px); }
  .v3 .v-end .v-cta { margin-top: 40px; }

  @media (max-width: 980px) {
    .v3 .v-lore .v-in, .v3 .v-toys .v-in, .v3 .v-dice .v-top { grid-template-columns: minmax(0, 1fr); }
    .v3 .v-fan { height: 400px; }
    .v3 .v-card { width: 250px; margin-left: -125px; --x: 0px !important; }
    .v3 .v-card:nth-child(odd) { --x: 0px; }
    .v3 .v-shelf { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 46px 24px; }
    .v3 .v-game .kl-case { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .v3 .v-beast { min-height: 0; padding-bottom: 40px; }
    .v3 .v-rig { position: relative; right: auto; top: auto; width: 100%; height: 0; padding-bottom: 94%; margin-top: 20px; transform: none; }
    .v3 .v-rig > img { width: 100%; }
    .v3 .v-held { left: -6%; top: 58%; width: 70%; }
    .v3 .v-hero .v-char.big { display: none; }
  }
  @media (max-width: 640px) {
    .v3 .v-toy .kl-card3d { position: relative; right: auto; top: auto; margin: 20px auto 0; }
    .v3 .kl-tiles { margin-top: 20px; }
    .v3 .v-pet { aspect-ratio: auto; height: 380px; }
    .v3 .v-weekly { width: 130px; height: 130px; top: 40px; } .v3 .v-weekly b { font-size: 14px; }
    .v3 .v-now { left: 0; top: -40px; }
    .v3 .v-blob.hm, .v3 .v-bit.hm { display: none; }
    .v3 .v-hero .v-blob, .v3 .v-hero .v-bit { display: none; }
    .v3 .v-pet { height: 440px; }
    .v3 .v-pet .v-pbtn { width: 54px; height: 54px; font-size: 11px; } .v3 .v-pet .v-pbtn.l { left: 9%; } .v3 .v-pet .v-pbtn.r { right: 9%; } .v3 .v-pet .v-pbtn.m { margin-left: -27px; }
    .v3 .v-lcd { left: 8%; right: 8%; } .v3 .v-lcd .kl-grid .r { grid-template-columns: 30px repeat(16, minmax(0, 1fr)); } .v3 .v-lcdt { font-size: 8px; }
    .v3 .v-end { padding-bottom: 250px; } .v3 .v-end .v-char { width: 96px !important; bottom: 14px !important; }
  }
  @media (prefers-reduced-motion: reduce) { .v3 *, .v3 *::before, .v3 *::after { animation: none !important; } }
  `;
  if (V3) document.head.append(vCss);
  const V3MARQ = (txt, cls) => `<div class="v-marq ${cls || ""}"><span>${(txt + " \u2736 ").repeat(8)}</span><span>${(txt + " \u2736 ").repeat(8)}</span></div>`;
  const v3HTML = () => `
    <div class="kl-grain"></div>
    <div class="kl-top"><button type="button" class="kl-logo" title="Back to the main menu"><img src="logo.png" alt="KILLTOY"></button><b>LANDING PAGE</b><span class="kl-sp"></span><button type="button" class="kl-x" title="Close">\u00d7</button></div>

    <section class="v-hero">
      <i class="v-cloud" style="left:-8%;top:30%;width:520px;height:260px"></i><i class="v-cloud" style="right:-6%;top:12%;width:480px;height:240px"></i><i class="v-cloud" style="left:30%;bottom:-6%;width:700px;height:260px"></i>
      ${BLOB(0, "", "--s:150px;left:6%;top:120px;--r:-12deg;--d:-18;--bt:7s")}${BLOB(3, "hm", "--s:96px;right:9%;top:90px;--r:14deg;--d:22;--bt:8s;--bd:-2s")}${BLOB(2, "hm", "--s:74px;left:16%;top:470px;--r:8deg;--d:30;--bd:-3s")}${BLOB(1, "hm", "--s:120px;right:5%;top:430px;--r:-6deg;--d:-24;--bd:-1s")}
      ${BIT("#e4ff3a", "#6c3dff", "", "--s:96px;left:22%;top:70px;--d:26;--r:-14deg;--glow:rgba(228,255,58,.55)")}${BIT("#7fe8ff", "#6c3dff", "hm", "--s:70px;right:22%;top:250px;--d:-20;--r:12deg;--bd:-2s;--glow:rgba(127,232,255,.55)")}${BIT("#3dff7a", "#0b0910", "hm", "--s:62px;left:9%;top:330px;--d:34;--r:20deg;--bd:-4s;--glow:rgba(61,255,122,.5)")}
      ${SPARK("", "--s:46px;left:30%;top:150px")}${SPARK("", "--s:30px;right:30%;top:110px;--bd:-1.2s")}${SPARK("", "--s:36px;right:14%;top:330px;--bd:-2s")}
      ${BUBS(14, 1)}
      <div class="v-in">
        <h1 class="v-chrome">KILLTOY</h1>
        <div class="v-line">play like a kid. <em>cook like a villain.</em></div>
        <p class="v-p">the DAW that feels like a toy box and still goes stupid hard. free, right in ur browser.</p>
        <div class="v-cta"><button type="button" class="v-btn" data-act="open">START COOKING</button><button type="button" class="v-btn alt" data-act="try">TEXT A SYNTH</button></div>
      </div>
      <div class="v-stage">
        <div class="v-win">${SHOTS.map((s, i) => `<img alt="" ${i ? "loading=\"lazy\"" : ""} data-i="${i}" src="${L3(s.f)}"${i ? "" : " class=\"on\""}>`).join("")}<i class="v-head"></i></div>
        <div class="v-now"><small>NOW COOKING</small><b>${SHOTS[0].name}</b></div>
        <div class="v-char big" style="width:250px;left:-150px;bottom:-90px;--d:-30;--bt:6.5s"><img alt="" src="${L3(CHARS.vamp)}"></div>
        <div class="v-char big" style="width:260px;right:-150px;top:-120px;--d:34;--bt:7.5s;--bd:-2s"><img alt="" src="${L3(CHARS.bun)}"></div>
        ${STK("free fr", "a", "right:-30px;bottom:60px;--r:8deg;--d:16")}${STK("no install", "", "left:-40px;top:30%;--r:-8deg;--d:-12;--bd:-1s")}${STK("875 sounds", "g", "right:12%;bottom:-18px;--r:-3deg;--d:10;--bd:-2s")}
      </div>
      <div class="v-in"><div class="v-vibe"><span>pick ur vibe:</span>${SHOTS.map((s, i) => `<button type="button" data-i="${i}" title="${s.name}" style="background-image:url(${BGS(s.bg)})"${i ? "" : " class=\"on\""}></button>`).join("")}</div></div>
    </section>

    ${V3MARQ("PLAY LIKE A KID \u2736 COOK LIKE A VILLAIN \u2736 FREE \u2736 NO INSTALL \u2736 NO CAP")}

    <section class="v-lore">
      ${BIT("#e4ff3a", "#3dff7a", "", "--s:80px;left:4%;top:60px;--d:20;--r:-10deg;--glow:rgba(228,255,58,.6)")}${BLOB(4, "hm", "--s:90px;right:4%;bottom:60px;--d:-20;--r:12deg")}
      <div class="v-in">
        <div class="kl-rev">
          <div class="v-k">ur project, ur lore</div>
          <h2 class="v-h s">name it<br>whatever.<br><em>it's ur world.</em></h2>
          <p class="v-p">"sad piano 4 her". "drums go brrr". "plz work". every pattern gets the name u want. pick a picture off the art wall and the whole DAW changes with it. nobody's beat looks like urs.</p>
        </div>
        <div class="v-fan">
          ${SHOTS.slice(0, 5).map((s, i) => `<div class="v-card" style="--x:${(i - 2) * 78}px;--r:${(i - 2) * 7}deg;--y:${Math.abs(i - 2) * 18}px;z-index:${5 - Math.abs(i - 2)}"><img alt="" loading="lazy" src="${L3(s.f)}"><div><b>${s.name}</b><small>${s.bpm} bpm</small></div></div>`).join("")}
          ${STK("808 villain arc", "a", "left:2%;top:10px;--r:-8deg;--d:14")}${STK("fill lol", "", "right:0;top:40px;--r:6deg;--d:-10;--bd:-1s")}${STK("melody (better)", "g", "left:-2%;bottom:40px;--r:5deg;--d:12;--bd:-2s")}${STK("bells from hell", "k", "right:4%;bottom:10px;--r:-6deg;--d:-14;--bd:-3s")}${STK("plz work", "p", "left:40%;bottom:-6px;--r:3deg;--d:8;--bd:-1.5s")}
        </div>
      </div>
    </section>

    <section class="v-beast">
      ${SPARK("", "--s:34px;left:46%;top:130px;--bd:-1s")}${BUBS(8, 3)}
      <div class="v-in">
        <div class="v-txt kl-rev">
          <div class="v-k">don't let the cute fool u</div>
          <h2 class="v-h s">cute outside.<br><em>lethal inside.</em></h2>
          <p class="v-p">it looks like a toy. under the hood it's a whole studio.</p>
          <div class="v-pow">
            <span><b>875</b> synth sounds + an engine u can actually tweak</span>
            <span>drums, 808s, sample kits <b>and ur own sounds</b></span>
            <span>automation on <b>literally everything</b></span>
            <span>mixer, stems, midi out. <b>the real stuff</b></span>
          </div>
        </div>
      </div>
      <div class="v-rig">
        <img class="back" alt="" src="${L3(CHARS.creature)}">
        <div class="v-held"><img alt="" loading="lazy" src="${L3("tm.webp")}"></div>
        <img class="front" alt="" src="${L3(CHARS.creature)}">
        <i class="eyes"></i>
      </div>
    </section>

    ${V3MARQ("TYPE IT \u2736 HEAR IT \u2736 PLAY IT \u2736 KEEP IT", "g")}

    <section class="v-try">
      ${BIT("#7fe8ff", "#6c3dff", "", "--s:84px;right:7%;top:90px;--d:24;--r:12deg;--glow:rgba(127,232,255,.6)")}${BLOB(5, "hm", "--s:110px;left:-30px;bottom:120px;--d:-16;--r:-10deg")}${BUBS(6, 7)}
      <div class="v-in">
        <div class="kl-try">
          <div class="v-k">01 \u00b7 the prompt synth</div>
          <h2 class="v-h s">text a synth.</h2>
          <p class="v-p">describe a sound like ur texting ur bestie. TOY MACHINE builds it from ur words, then u play it on the keys.</p>
          <div class="kl-box"><input type="text" class="kl-in" placeholder="dark wobbly bass, lowkey evil..." maxlength="120" spellcheck="false"><button type="button" class="kl-go" title="Make it"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z" fill="currentColor"/></svg></button></div>
          <div class="kl-chips">${["dirty 808", "cold glass bell", "dark choir", "dreamy pad", "evil pluck", "rage lead", "warm keys", "wobble bass"].map((w) => `<button type="button" class="kl-chip" data-w="${w}">${w}</button>`).join("")}</div>
          <div class="kl-scape"><canvas></canvas><div class="kl-heard">875 sounds inside TOY MACHINE</div></div>
          <div class="kl-keys"></div>
        </div>
      </div>
    </section>

    <section class="v-toys">
      ${BUBS(6, 11)}
      <div class="v-in">
        <div class="v-toy tm kl-rev">
          <div class="v-txt">
            <div class="v-k">02 \u00b7 toy machine</div>
            <h2 class="v-h">the synth with a whole world inside</h2>
            <p class="v-p" style="font-size:15px">no wall of knobs. a landscape that moves with ur sound. tap one, hear it.</p>
          </div>
          <div class="kl-card3d" data-front="cards/C2_tm.jpg" data-back="cards/C3_tm_back.jpg"></div>
          <div class="kl-tiles"></div>
        </div>
        <div class="v-toy kd kl-rev">
          <div class="v-k" style="color:var(--grn)">03 \u00b7 killdrum</div>
          <h2 class="v-h">drums with <em style="color:var(--grn)">main character</em> energy</h2>
          <div class="v-pet"><i class="ring"></i><div class="v-lcd"><div class="kl-grid"></div><div class="v-lcdt"><span>140 BPM</span><span class="kn">888 GENESIS</span><b>PRESS PLAY</b></div></div>
            <button type="button" class="v-pbtn l" data-act="kit-prev" title="Other kit">KIT</button><button type="button" class="v-pbtn m" data-act="pet-play" title="Play">PLAY</button><button type="button" class="v-pbtn r" data-act="kit-next" title="Other kit">KIT</button>
          </div>
          <div class="kl-drow"><button type="button" class="kl-btn" data-act="drum">PLAY</button><div class="kl-chips kl-kits"></div></div>
        </div>
      </div>
    </section>

    <section class="v-dice">
      ${BLOB(4, "hm", "--s:110px;left:2%;bottom:60px;--d:18;--r:14deg")}${BIT("#e4ff3a", "#6c3dff", "hm", "--s:70px;right:4%;bottom:90px;--d:-16;--r:-10deg;--glow:rgba(10,8,16,.4)")}
      <div class="v-in">
        <div class="v-top">
          <div class="kl-rev">
            <div class="v-k">04 \u00b7 midi</div>
            <h2 class="v-h s">roll chords.<br>bend them.</h2>
            <p class="v-p">pick a mood, roll a start, then move, stretch and flip every note. ur song, not the dice's. save it as midi.</p>
          </div>
          <div class="y-die" data-act="die" title="Roll"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="kl-drow"><button type="button" class="kl-btn solid" data-act="roll">ROLL</button><div class="kl-chips kl-moods">${["villain", "dreamy", "sad", "happy", "euphoric"].map((w, i) => `<button type="button" class="kl-chip${i ? "" : " on"}" data-m="${w}">${w}</button>`).join("")}</div><span style="flex:1"></span><button type="button" class="kl-btn" data-act="mid">SAVE .MID</button></div>
        <div class="kl-roll"><canvas></canvas></div>
        <div class="kl-chords"></div>
      </div>
    </section>

    <section class="v-kits">
      <div class="v-weekly">${STAR(14, "#E4FF3A", "")}<b>NEW KITS<br>EVERY<br>WEEK</b></div>
      ${BUBS(8, 5)}
      <div class="v-in">
        <div class="v-k">05 \u00b7 sample kits</div>
        <h2 class="v-h s">kits that <em>slap.</em></h2>
        <p class="v-p">tap one to hear it. 32 sounds in each, fresh ones drop every week.</p>
        <div class="v-shelf">${KITS_WALL.map(([id, n], i) => `<button type="button" class="y-kit" data-kit="${id}" style="background-image:url(packs/${id}.jpg);--bd:-${(i * 0.7).toFixed(1)}s;--kc:${["rgba(143,99,255,.45)", "rgba(228,255,58,.35)", "rgba(61,255,122,.35)", "rgba(127,232,255,.35)"][i % 4]}"><span>${n.toLowerCase()}</span></button>`).join("")}</div>
      </div>
    </section>

    <section class="v-game">
      ${BIT("#e4ff3a", "#6c3dff", "", "--s:90px;right:6%;top:70px;--d:20;--r:10deg;--glow:rgba(228,255,58,.6)")}${BLOB(2, "hm", "--s:100px;left:3%;bottom:80px;--d:-18;--r:-8deg")}
      <div class="v-in">
        <div class="v-k">06 \u00b7 quests</div>
        <h2 class="v-h s">it's literally<br><em>a game.</em></h2>
        <p class="v-p" style="color:#f1ecff">do quests, make stuff, unlock new synths, fx and kits. the more u cook, the more u get.</p>
        <div class="kl-case"></div>
        <div class="v-free"><span>free</span><span>no card</span><span>no install</span><span>just open it</span></div>
      </div>
    </section>

    <section class="v-end">
      ${BUBS(12, 9)}${BIT("#3dff7a", "#6c3dff", "", "--s:70px;left:14%;top:120px;--d:20;--r:-12deg;--glow:rgba(61,255,122,.6)")}${BIT("#e4ff3a", "#0b0910", "", "--s:60px;right:16%;top:200px;--d:-18;--r:14deg;--bd:-2s;--glow:rgba(228,255,58,.6)")}
      <div class="v-char" style="width:200px;left:max(2%, calc(50% - 560px));bottom:40px;--d:-20;--bt:6s"><img alt="" loading="lazy" src="${L3(CHARS.vamp)}"></div>
      <div class="v-char" style="width:210px;right:max(2%, calc(50% - 560px));bottom:60px;--d:24;--bt:7s;--bd:-3s"><img alt="" loading="lazy" src="${L3(CHARS.bun)}"></div>
      <div class="v-in">
        <h2 class="v-chrome">KILLTOY</h2>
        <div class="v-line" style="font:400 clamp(22px,2.6vw,36px)/1.1 'Bagel Fat One',sans-serif;margin-top:16px">the toy box is open.</div>
        <div class="v-cta"><button type="button" class="v-btn" data-act="open">OPEN THE TOY BOX</button></div>
      </div>
    </section>`;

  // hero: cycle the six projects (each on its own background), the vibe buttons pick one; pointer moves the cast
  function wireV3() {
    const imgs = $$(".v-win img, .v-hbg i", page), dots = $$(".v-vibe button", page), nowB = $(".v-now b", page);
    let cur = 0, hold = 0;
    const pick = (i) => {
      cur = (i + SHOTS.length) % SHOTS.length;
      imgs.forEach((im) => im.classList.toggle("on", +im.dataset.i === cur));
      dots.forEach((d) => d.classList.toggle("on", +d.dataset.i === cur));
      if (nowB) nowB.textContent = SHOTS[cur].name;
    };
    dots.forEach((d) => d.onclick = () => { hold = performance.now() + 12000; pick(+d.dataset.i); });
    clearInterval(page._v3t);
    page._v3t = setInterval(() => { if (page.hidden || performance.now() < hold) return; pick(cur + 1); }, 3800);
    let pend = 0;
    page.addEventListener("pointermove", (e) => {
      if (pend) return;
      pend = requestAnimationFrame(() => { pend = 0; page.style.setProperty("--mx", ((e.clientX / innerWidth) * 2 - 1).toFixed(3)); page.style.setProperty("--my", ((e.clientY / innerHeight) * 2 - 1).toFixed(3)); });
    }, { passive: true });
    // project cards: tap one to lift it
    $$(".v-card", page).forEach((c) => c.onclick = () => { const up = !c.classList.contains("up"); $$(".v-card", page).forEach((x) => x.classList.remove("up")); c.classList.toggle("up", up); });
    // the pocket KILLDRUM: middle button plays, side buttons step through the kits
    const play = $("[data-act=drum]", page), pp = $("[data-act=pet-play]", page);
    if (pp && play) pp.onclick = () => { play.click(); setTimeout(() => pp.classList.toggle("on", play.classList.contains("on")), 60); };
    const step = (d) => { const ch = $$(".kl-kits .kl-chip", page); if (!ch.length) return; const i = ch.findIndex((x) => x.classList.contains("on")); ch[(i + d + ch.length) % ch.length].click(); };
    const kp = $("[data-act=kit-prev]", page), kn = $("[data-act=kit-next]", page), lk = $(".v-lcdt .kn", page), lb = $(".v-lcdt b", page);
    const kits = $(".kl-kits", page);
    if (kits && lk) kits.addEventListener("click", () => setTimeout(() => { const on = $(".kl-kits .kl-chip.on", page); if (on) lk.textContent = on.textContent; }, 30));
    if (pp && lb) pp.addEventListener("click", () => setTimeout(() => { lb.textContent = play.classList.contains("on") || play.textContent === "..." ? "PLAYING" : "PRESS PLAY"; }, 120));
    if (kp) kp.onclick = () => step(-1); if (kn) kn.onclick = () => step(1);
  }
  // ------------------------------------------------------------------ LANDING 4: cleaner (Eman, 11 Nov 2026 22:52)
  // Same toys as Landing 3, cleaner: plain type (Unbounded / Inter / Martian Mono, no bubble font), square buttons
  // (no pills), no fake slang stickers, and every section sits on one of KILLTOY's own background pictures, frosted
  // with grain, instead of gradients. The top page is the picture itself, full bleed, and it changes with the DAW.
  // "name it whatever" became "pick your character": a character sits next to the DAW as an assistant you can talk to
  // (the chrome spark is the default, Eman 22:51 "this guy... could be like your assistant").
  // KT2_LANDING_V3 = Landing 3 (the toy box), KT2_LANDING_Y2K = 9 Nov collage, KT2_LANDING_CALM = the first page.
  const C4 = { vamp: "landing4/vamp.webp", bun: "landing4/bun.webp", creature: "landing4/creature.webp" };   // same placeholders, white fringe trimmed
  const BGF = (n) => `bg/KT_UP_${String(n).padStart(2, "0")}.jpg`;
  const FROST = (n, br, bl) => `<i class="v-bg" style="background-image:url(${BGS(n)});${br != null ? "--br:" + br + ";" : ""}${bl != null ? "--bl:" + bl + "px;" : ""}"></i><i class="v-fz"></i>`;
  const SPARKBIG = () => `<svg class="v-sparkme" viewBox="0 0 100 100"><defs><linearGradient id="vsg4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".42" stop-color="#c9c4d6"/><stop offset=".52" stop-color="#58526a"/><stop offset=".62" stop-color="#d8d3e4"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path d="M50 0 C54 38 62 46 100 50 C62 54 54 62 50 100 C46 62 38 54 0 50 C38 46 46 38 50 0Z" fill="url(#vsg4)"/></svg>`;
  // the cast for the assistant dock (placeholders until the real characters exist)
  const CREW = [
    { id: "spark", name: "SPARK", hi: "hey. I'm SPARK. ask me for anything in your project." },
    { id: "bun", name: "BUN", img: C4.bun, hi: "hi, I'm BUN. tell me what to change and I'll do it." },
    { id: "vamp", name: "VAMP", img: C4.vamp, hi: "VAMP here. want it darker? just say so." },
    { id: "creature", name: "THE THING", img: C4.creature, hi: "...THE THING is listening. what do you need." },
  ];
  // what the assistant answers on the landing page (a demo: it talks about edits you ask for, it never "makes the song")
  const CREW_SAY = [
    [/dark|evil|villain|scary|minor/, "moved the chords to minor and pulled the 808 down an octave. listen."],
    [/drum|beat|hat|kick|snare|808/, "added a hat roll at the end of bar 4. undo if you hate it."],
    [/name|call|title/, "renamed it \u201cvillain era v5\u201d. change it whenever."],
    [/slow|fast|tempo|bpm/, "set it to 140 BPM. everything stays in time."],
    [/sound|synth|bass|pad|bell|lead/, "opened TOY MACHINE on that lane. try the dark presets first."],
    [/help|how|what|start/, "drag a sound onto a lane, then press space. I'm right here."],
  ];
  const v4Css = H("style"); v4Css.id = "kl-v4-css";
  const NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -.25'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
  v4Css.textContent = `
  .kl.v4 { background: #0a0810; }
  .v4 .kl-grain { opacity: .12; }
  .v4 .kl-top { background: linear-gradient(rgba(10,8,16,.85), rgba(10,8,16,0)); }
  /* clean type everywhere */
  .v4 .v-h { font: 800 clamp(38px, 5.4vw, 80px)/.98 "Inter Tight", Inter, sans-serif; letter-spacing: -.04em; }
  .v4 .v-h.s { font-size: clamp(32px, 4.2vw, 62px); }
  .v4 .v-toy .v-h { font-size: clamp(24px, 2.4vw, 34px); letter-spacing: -.03em; }
  .v4 .v-p { color: #ddd7ec; font-weight: 450; }
  .v4 .v-k { font-size: 11px; letter-spacing: .2em; color: var(--acid); }
  .v4 .v-k::before { border-radius: 0; width: 8px; height: 8px; }
  .v4 .v-now b, .v4 .v-shelf .y-kit span, .v4 .v-weekly b, .v4 .v-game .kl-prize .t b, .v4 .v-pet .v-pbtn, .v4 .v-dice .kl-chords span { font-family: "Inter Tight", Inter, sans-serif; font-weight: 700; letter-spacing: -.01em; }
  /* frosted picture behind every section */
  .v4 section { background: #0a0810; }
  .v4 .v-bg { position: absolute; inset: -80px; z-index: -2; background-size: cover; background-position: center; filter: blur(var(--bl, 28px)) saturate(1.45) brightness(var(--br, .42)); transform: scale(1.06); }
  .v4 .v-fz { position: absolute; inset: 0; z-index: -1; pointer-events: none; background: linear-gradient(rgba(10,8,16,.2), rgba(10,8,16,.5)); }
  .v4 .v-fz::after { content: ""; position: absolute; inset: 0; background: ${NOISE}; background-size: 200px 200px; opacity: .16; mix-blend-mode: overlay; }
  /* buttons: square blocks, no pills */
  .v4 .v-btn { height: 56px; padding: 0 30px; border-radius: 12px; font: 700 15px/1 "Inter Tight", Inter, sans-serif; letter-spacing: .01em; color: #0a0810; background: var(--acid); box-shadow: 0 10px 30px rgba(0,0,0,.3); transition: transform .12s, background .12s, box-shadow .12s; }
    box-shadow: 6px 6px 0 var(--pur2); transition: transform .12s, box-shadow .12s; }
  .v4 .v-btn:hover { transform: translateY(-2px); background: #efff7a; box-shadow: 0 14px 34px rgba(228,255,58,.25); }
  .v4 .v-btn:active { transform: translateY(1px) scale(.98); }
  .v4 .v-btn.alt { color: #fff; background: rgba(255,255,255,.08); backdrop-filter: blur(14px) saturate(1.3); -webkit-backdrop-filter: blur(14px) saturate(1.3); box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
  .v4 .v-btn.alt:hover { box-shadow: inset 0 0 0 1px #fff; background: rgba(255,255,255,.14); }
  .v4 .kl-chip { border-radius: 8px; height: 34px; font: 600 12px Inter, sans-serif; letter-spacing: .02em; }
  .v4 .kl-try .kl-box { border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,.5), 0 30px 60px rgba(0,0,0,.4); background: rgba(255,255,255,.92); }
  .v4 .kl-try .kl-go { border-radius: 10px; }
  .v4 .kl-scape, .v4 .v-dice .kl-roll { border-radius: 0; box-shadow: 0 0 0 1px rgba(255,255,255,.18), 0 30px 70px rgba(0,0,0,.5); }
  .v4 .kl-keys button { border-radius: 2px; }
  .v4 .kl-tile { border-radius: 0; }
  .v4 .v-marq { padding: 13px 0; transform: rotate(-1deg) scaleX(1.03); }
  .v4 .v-marq span { font: 800 17px/1 "Inter Tight", Inter, sans-serif; letter-spacing: .06em; }
  .v4 .v-marq.g { transform: rotate(.8deg) scaleX(1.03); }

  /* 1 HERO: the picture is the page */
  .v4 .v-hero { min-height: 100vh; padding: 0; text-align: left; display: flex; flex-direction: column; justify-content: flex-end; background: #0a0810; }
  .v4 .v-hbg { position: absolute; inset: 0; z-index: -2; overflow: hidden; }
  .v4 .v-hbg .v-hpic { position: absolute; display: block; inset: -3%; background-size: cover; background-position: center 30%; transform: translate(calc(var(--mx) * -10px), calc(var(--my) * -8px)) scale(1.04); filter: saturate(1.1); }
  .v4 .v-hero > .v-fz { background: linear-gradient(180deg, rgba(10,8,16,.35) 0%, rgba(10,8,16,0) 30%, rgba(10,8,16,.15) 55%, rgba(10,8,16,.92) 100%), radial-gradient(70% 60% at 0% 100%, rgba(10,8,16,.75), transparent 70%); }
  .v4 .v-hero .v-in { width: 100%; max-width: 1320px; padding: 0 40px 60px; }
  .v4 .v-hero .v-hgrid { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 30px; }
  .v4 .v-wm { display: block; width: min(560px, 74vw); height: auto; filter: drop-shadow(0 6px 30px rgba(0,0,0,.5)); }
  .v4 .v-hero .v-line { font: 800 clamp(30px, 3.8vw, 58px)/1 "Inter Tight", Inter, sans-serif; letter-spacing: -.04em; color: #fff; margin: 22px 0 0; text-shadow: 0 4px 30px rgba(0,0,0,.5); }
  .v4 .v-hero .v-line em { color: var(--acid); text-shadow: 0 0 30px rgba(228,255,58,.35); }
  .v4 .v-hero .v-p { margin: 16px 0 0; text-align: left; max-width: 520px; color: #eee9f8; }
  .v4 .v-hero .v-cta { justify-content: flex-start; margin-top: 30px; }
  .v4 .v-panel { background: rgba(10,8,16,.35); backdrop-filter: blur(18px) saturate(1.3); -webkit-backdrop-filter: blur(18px) saturate(1.3); box-shadow: inset 0 0 0 1px rgba(255,255,255,.22); }
  .v4 .v-vibe { display: block; margin: 0; padding: 16px 18px 18px; }
  .v4 .v-vibe > span { display: block; font: 700 10px/1 "Martian Mono", monospace; letter-spacing: .2em; color: #fff; margin: 0 0 12px; text-transform: uppercase; }
  .v4 .v-vibe > span b { color: var(--acid); font-weight: 700; }
  .v4 .v-vibe .row { display: grid; grid-template-columns: repeat(6, 46px); gap: 8px; }
  .v4 .v-vibe button { width: 46px; height: 46px; border-radius: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); }
  .v4 .v-vibe button:hover { transform: translateY(-2px); }
  .v4 .v-vibe button.on { box-shadow: 0 0 0 2px var(--acid), 0 0 24px rgba(228,255,58,.45); transform: none; }
  .v4 .v-scroll { position: absolute; left: 50%; bottom: 18px; width: 1px; height: 34px; background: linear-gradient(#fff, transparent); opacity: .6; animation: vsc 2s ease-in-out infinite; }
  @keyframes vsc { 0%, 100% { transform: scaleY(.4); transform-origin: top; } 50% { transform: scaleY(1); transform-origin: top; } }

  /* 1b the DAW on its own picture, the cast around it */
  .v4 .v-studio { padding: 110px 0 120px; }
  .v4 .v-studio .v-hd { display: flex; justify-content: space-between; align-items: end; gap: 30px; flex-wrap: wrap; }
  .v4 .v-stage { margin-top: 50px; width: min(1120px, 94%); }
  .v4 .v-win { border-radius: 4px; box-shadow: 0 0 0 1px rgba(255,255,255,.3), 0 60px 120px rgba(0,0,0,.65); transform: none; }
  .v4 .v-now { left: 0; top: -1px; transform: translateY(-100%); border-radius: 0; background: var(--acid); color: #0a0810; padding: 9px 14px 8px; box-shadow: none; }
  .v4 .v-now small { color: #0a0810; opacity: .65; display: inline; margin: 0 10px 0 0; }
  .v4 .v-now b { font-size: 13px; }

  /* the deck: several projects overlapping in 3D; click a side one, drag, or use the arrows */
  .v4 .v-deck { position: relative; z-index: 5; width: min(1240px, 96%); margin: 56px auto 0; perspective: 2000px; perspective-origin: 50% 30%; }
  .v4 .v-deck::before { content: ""; display: block; padding-top: min(46%, 560px); }
  .v4 .v-dk { position: absolute; left: 50%; top: 0; width: min(880px, 72%); aspect-ratio: 16 / 10; padding: 0; border: 0; border-radius: 10px; overflow: hidden; background: #000; cursor: pointer; touch-action: pan-y;
    transform: translateX(-50%) translateX(calc(var(--d, 0) * 38%)) translateZ(calc(var(--a, 0) * -220px)) rotateY(calc(var(--d, 0) * -16deg));
    transition: transform .65s cubic-bezier(.2,.9,.25,1), filter .5s, opacity .5s; filter: brightness(calc(1 - var(--a, 0) * .28)) saturate(calc(1 - var(--a, 0) * .2));
    box-shadow: 0 0 0 1px rgba(255,255,255,.22), 0 50px 100px rgba(0,0,0,.6); }
  .v4 .v-dk img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; user-select: none; }
  .v4 .v-dk.on { cursor: grab; box-shadow: 0 0 0 1px rgba(255,255,255,.4), 0 60px 120px rgba(0,0,0,.7), 0 0 80px rgba(143,99,255,.25); }
  .v4 .v-dk.far { opacity: 0; pointer-events: none; }
  .v4 .v-dk:not(.on):hover { filter: brightness(1); }
  .v4 .v-deck.drag .v-dk { transition: none; }
  .v4 .v-dkbar { position: relative; display: flex; justify-content: center; align-items: center; gap: 18px; margin-top: 30px; }
  .v4 .v-dkb { width: 46px; height: 46px; border-radius: 12px; border: 0; cursor: pointer; color: #fff; font: 400 26px/1 Inter, sans-serif; background: rgba(255,255,255,.1); box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); backdrop-filter: blur(10px); transition: background .15s; }
  .v4 .v-dkb:hover { background: rgba(255,255,255,.2); }
  .v4 .v-dkcap { min-width: 220px; text-align: center; }
  .v4 .v-dkcap b { display: block; font: 800 20px/1.1 "Inter Tight", Inter, sans-serif; letter-spacing: -.02em; color: #fff; }
  .v4 .v-dkcap small { font: 700 10px/1 "Martian Mono", monospace; letter-spacing: .16em; color: var(--acid); }

  /* header creature, holding TOY MACHINE out of the picture */
  .v4 .v-hero { padding-bottom: 70px; }
  .v4 .v-hrig { position: absolute; z-index: 2; right: max(-140px, calc(50% - 860px)); top: 40px; width: 840px; transform: translate(calc(var(--mx) * -10px), calc(var(--my) * -6px)) scale(.86); transform-origin: 100% 0; }
  .v4 .v-hrig .v-held { left: -150px; top: 560px; width: 520px; }
  .v4 .v-tmshot { position: absolute; z-index: 2; right: max(3%, calc(50% - 640px)); top: 110px; width: min(620px, 46%); transform: rotate(-4deg); border-radius: 10px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,.25), 0 50px 100px rgba(0,0,0,.6), 0 0 80px rgba(143,99,255,.3); }
  .v4 .v-tmshot img { display: block; width: 100%; }
  .v4 .v-beast { min-height: 0; padding-bottom: 130px; }

  /* lilac panels with melting edges */
  .v4 section.lil { overflow: visible; z-index: 3; background: transparent; --ink: #0a0810; }
  .v4 .v-lilbg { position: absolute; left: 0; right: 0; top: -90px; bottom: -90px; z-index: -1; pointer-events: none; background: ${NOISE} 0 0 / 200px 200px, #c7b3ff; background-blend-mode: soft-light, normal; }
  .v4 .lil .v-h, .v4 .lil .v-p, .v4 .lil .kl-try .v-p { color: #0a0810; }
  .v4 .lil .v-p { font-weight: 500; }
  .v4 .lil .v-h em { color: #0a0810; background: var(--acid); padding: 0 .1em; -webkit-box-decoration-break: clone; box-decoration-break: clone; text-shadow: none; }
  .v4 .lil .v-k { color: #0a0810; }
  .v4 .v-burst { position: absolute; z-index: 1; pointer-events: none; animation: vspin 40s linear infinite; }
  .v4 .v-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: -6px 0 18px; }
  .v4 .v-tags span { padding: 4px 7px 3px; background: #fff; color: #0a0810; box-shadow: 0 0 0 1px #0a0810; font: 700 10px/1.2 "Martian Mono", monospace; letter-spacing: .04em; text-transform: uppercase; }
  .v4 .v-tags span:nth-child(2) { transform: rotate(-2deg); } .v4 .v-tags span:last-child { background: #0a0810; color: var(--acid); }
  .v4 .lil .v-dkb { background: #0a0810; color: #fff; box-shadow: none; }
  .v4 .lil .v-dkb:hover { background: #2a174f; }
  .v4 .lil .v-dkcap b { color: #0a0810; } .v4 .lil .v-dkcap small { color: #3a1d99; }
  .v4 .lil .kl-try .kl-box { background: #fff; box-shadow: 0 0 0 2px #0a0810, 0 20px 40px rgba(10,8,16,.2); }
  .v4 .lil .kl-chip { background: rgba(10,8,16,.08); color: #0a0810; box-shadow: inset 0 0 0 1px rgba(10,8,16,.45); }
  .v4 .lil .kl-chip:hover { background: rgba(10,8,16,.16); color: #0a0810; }
  .v4 .lil .kl-chip.on { background: #0a0810; color: var(--acid); box-shadow: none; }
  .v4 .lil .kl-scape, .v4 .lil.v-dice .kl-roll { box-shadow: 0 0 0 2px #0a0810, 0 30px 60px rgba(10,8,16,.3); }
  .v4 .v-dice.lil, .v4 .v-dice.lil .v-h, .v4 .v-dice.lil .v-p, .v4 .v-dice.lil .v-k { color: #0a0810; }
  .v4 .v-dice.lil .kl-chip { background: rgba(10,8,16,.08); color: #0a0810; box-shadow: inset 0 0 0 1px rgba(10,8,16,.45); }
  .v4 .v-dice.lil .kl-chip.on { background: #0a0810; color: var(--acid); box-shadow: none; }
  .v4 .v-dice.lil .kl-btn:not(.solid) { background: #0a0810; color: #fff; box-shadow: none; }
  .v4 .v-dice.lil .kl-btn.solid { box-shadow: 0 0 0 2px #0a0810; }
  .v4 .v-dice.lil .kl-chords span { color: #0a0810; border-left-color: rgba(10,8,16,.3); }
  .v4 .v-dice.lil .kl-chords span.now { color: #0a0810; background: var(--acid); border-left-color: #0a0810; }
  .v4 .lil .y-die { box-shadow: inset 0 -10px 20px rgba(0,0,0,.18), 0 0 0 3px #0a0810, 10px 12px 0 #0a0810; }
  .v4 .v-game.lil .kl-prize { box-shadow: 0 0 0 2px #0a0810, 0 20px 40px rgba(10,8,16,.35); }

  /* 2 THE CREW: pick a character, make one, make your world. It sits next to the DAW and you talk to it */
  .v4 .v-cast { padding: 120px 0 130px; }
  .v4 .v-cast .v-in { display: grid; grid-template-columns: minmax(0, 440px) minmax(0, 1fr); gap: 56px; align-items: center; }
  .v4 .v-steps { margin-top: 34px; display: grid; gap: 22px; }
  .v4 .v-step > small { display: flex; gap: 12px; align-items: baseline; font: 700 11px/1 "Martian Mono", monospace; letter-spacing: .16em; color: #fff; text-transform: uppercase; margin-bottom: 10px; }
  .v4 .v-step > small b { color: var(--acid); }
  .v4 .v-picks { display: flex; gap: 8px; flex-wrap: wrap; }
  .v4 .v-pick { position: relative; width: 74px; height: 86px; border: 0; padding: 0; cursor: pointer; overflow: hidden; background: rgba(10,8,16,.4); box-shadow: inset 0 0 0 1px rgba(255,255,255,.22); transition: transform .15s, box-shadow .15s; }
  .v4 .v-pick img { position: absolute; left: 50%; top: 6px; width: 96%; transform: translateX(-50%); }
  .v4 .v-pick[data-c=creature] img { width: 190%; top: -4px; left: 64%; }
  .v4 .v-pick svg { position: absolute; left: 50%; top: 50%; width: 58px; transform: translate(-50%, -58%); filter: drop-shadow(0 0 10px rgba(255,255,255,.6)); }
  .v4 .v-pick span { position: absolute; left: 0; right: 0; bottom: 0; padding: 4px 0 5px; background: rgba(10,8,16,.75); font: 700 8px/1 "Martian Mono", monospace; letter-spacing: .12em; color: #fff; }
  .v4 .v-pick:hover { transform: translateY(-3px); }
  .v4 .v-pick.on { box-shadow: inset 0 0 0 2px var(--acid), 0 0 26px rgba(228,255,58,.35); }
  .v4 .v-pick.on span { background: var(--acid); color: #0a0810; }
  .v4 .v-pick.make { background: transparent; box-shadow: inset 0 0 0 1px rgba(255,255,255,.4); outline: 1px dashed rgba(255,255,255,.35); outline-offset: -7px; }
  .v4 .v-pick.make i { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); font: 300 34px/1 Inter, sans-serif; color: #fff; font-style: normal; }
  .v4 .v-worlds { display: grid; grid-template-columns: repeat(6, 46px); gap: 8px; }
  .v4 .v-worlds button { width: 46px; height: 46px; border: 0; padding: 0; cursor: pointer; background-size: cover; background-position: center; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); transition: transform .15s; }
  .v4 .v-worlds button:hover { transform: translateY(-2px); }
  .v4 .v-worlds button.on { box-shadow: 0 0 0 2px var(--acid); }
  .v4 .v-desk { position: relative; padding-right: 150px; }
  .v4 .v-desk .shot { position: relative; aspect-ratio: 16 / 10; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,.28), 0 50px 100px rgba(0,0,0,.6); }
  .v4 .v-desk .shot img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: translateX(calc(var(--o, 1) * 100%)); transition: transform .55s cubic-bezier(.2,.9,.25,1); }
  .v4 .v-desk .shot img.on { transform: none; }
  .v4 .v-dock { position: absolute; right: 0; top: -70px; bottom: -70px; width: 290px; display: flex; flex-direction: column; z-index: 3; }
  .v4 .v-dock .who { position: relative; height: 150px; flex: none; }
  .v4 .v-dock .who > * { position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%); transition: opacity .3s, transform .4s cubic-bezier(.3,1.5,.5,1); }
  .v4 .v-dock .who img { height: 210px; width: auto; filter: drop-shadow(0 20px 30px rgba(0,0,0,.6)); animation: vfloat 6s ease-in-out infinite; }
  .v4 .v-dock .who img[data-c=creature] { height: 250px; }
  .v4 .v-dock .who .v-sparkme { width: 120px; bottom: 6px; filter: drop-shadow(0 0 22px rgba(255,255,255,.75)) drop-shadow(0 0 60px rgba(199,179,255,.5)); animation: vtwk 4s ease-in-out infinite; }
  @keyframes vtwk { 0%, 100% { transform: translateX(-50%) scale(.92) rotate(0deg); } 50% { transform: translateX(-50%) scale(1.05) rotate(8deg); } }
  .v4 .v-dock .who .off { opacity: 0; transform: translateX(-50%) translateY(30px) scale(.8); pointer-events: none; }
  .v4 .v-dock .box { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .v4 .v-dock .nm { display: flex; justify-content: space-between; align-items: center; padding: 11px 14px 10px; border-bottom: 1px solid rgba(255,255,255,.15); font: 700 10px/1 "Martian Mono", monospace; letter-spacing: .18em; color: #fff; }
  .v4 .v-dock .nm i { width: 7px; height: 7px; background: #3dff7a; box-shadow: 0 0 10px #3dff7a; }
  .v4 .v-dock .log { flex: 1; overflow: hidden auto; padding: 12px 12px 6px; display: flex; flex-direction: column; gap: 8px; scrollbar-width: none; }
  .v4 .v-dock .log p { margin: 0; padding: 9px 11px; max-width: 88%; font: 500 13px/1.35 Inter, sans-serif; color: #fff; background: rgba(255,255,255,.12); animation: vmsg .3s ease-out; }
  .v4 .v-dock .log p.me { align-self: flex-end; background: var(--acid); color: #0a0810; }
  .v4 .v-dock .log p.dots { letter-spacing: .2em; }
  @keyframes vmsg { from { opacity: 0; transform: translateY(8px); } }
  .v4 .v-dock form { display: flex; margin: 8px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.3); }
  .v4 .v-dock input { flex: 1; min-width: 0; height: 40px; border: 0; background: transparent; padding: 0 12px; color: #fff; font: 500 13px Inter, sans-serif; outline: none; }
  .v4 .v-dock input::placeholder { color: rgba(255,255,255,.55); }
  .v4 .v-dock form button { width: 40px; border: 0; background: var(--acid); color: #0a0810; cursor: pointer; font: 700 16px/1 Inter, sans-serif; }
  .v4 .v-asks { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 8px 10px; }
  .v4 .v-asks button { border: 0; padding: 6px 8px; cursor: pointer; background: rgba(255,255,255,.1); color: #fff; font: 600 11px Inter, sans-serif; }
  .v4 .v-asks button:hover { background: rgba(255,255,255,.2); }

  /* 3 the creature section keeps its picture dark */
  .v4 .v-beast { background: #07060b; }
  .v4 .v-pow span { border-radius: 0; background: rgba(10,8,16,.35); border: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); backdrop-filter: blur(10px); }
  .v4 .v-held { border-radius: 4px; }

  /* 4-8: the same toys on frosted pictures */
  .v4 .v-try, .v4 .v-toys, .v4 .v-kits, .v4 .v-game, .v4 .v-dice { background: #0a0810; }
  .v4 .v-toy { border-radius: 0; }
  .v4 .v-toy.tm, .v4 .v-toy.kd { background: rgba(10,8,16,.32); backdrop-filter: blur(20px) saturate(1.3); -webkit-backdrop-filter: blur(20px) saturate(1.3); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .v4 .v-dice, .v4 .v-dice .v-h, .v4 .v-dice .v-p { color: #fff; }
  .v4 .v-dice .v-k { color: var(--acid); }
  .v4 .v-dice .kl-btn { border-radius: 10px; font: 700 12px/1 "Inter Tight", Inter, sans-serif; letter-spacing: .08em; background: var(--acid); color: #0a0810; }
  .v4 .v-dice .kl-btn.solid { background: var(--acid); color: #0a0810; }
  .v4 .v-dice .kl-btn:not(.solid) { background: rgba(255,255,255,.1); color: #fff; box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
  .v4 .v-dice .kl-chip { background: rgba(255,255,255,.08); color: #fff; box-shadow: inset 0 0 0 1px rgba(255,255,255,.3); }
  .v4 .v-dice .kl-chip.on { background: var(--acid); color: #0a0810; box-shadow: none; }
  .v4 .v-dice .kl-chords span { color: #fff; border-left-color: rgba(255,255,255,.25); font-size: 15px; }
  .v4 .v-dice .kl-chords span.now { color: var(--acid); text-shadow: none; border-left-color: var(--acid); }
  .v4 .y-die { border-radius: 26px; box-shadow: inset 0 -10px 20px rgba(0,0,0,.18), 0 30px 60px rgba(0,0,0,.5), 0 0 60px rgba(255,255,255,.15); }
  .v4 .v-shelf .y-kit { border-radius: 4px; }
  .v4 .v-shelf .y-kit span { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; bottom: -30px; }
  .v4 .v-weekly b { font-size: 16px; letter-spacing: -.02em; }
  .v4 .v-game .kl-prize { border-radius: 0; box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 20px 40px rgba(0,0,0,.4); }
  .v4 .v-game .kl-prize .t b { font-size: 12px; }
  .v4 .v-free { gap: 0; margin-top: 46px; }
  .v4 .v-free span, .v4 .v-free span:nth-child(2), .v4 .v-free span:nth-child(3) { padding: 0 18px; border-radius: 0; background: none; color: #fff; box-shadow: none; border-left: 1px solid rgba(255,255,255,.3); font: 700 12px/1 "Martian Mono", monospace; letter-spacing: .18em; text-transform: uppercase; }
  .v4 .v-free span:first-child { padding-left: 0; border-left: 0; color: var(--acid); }

  /* 9 END: back to a picture */
  .v4 .v-end { padding: 150px 0 170px; }
  .v4 .v-end .v-wm { margin: 0 auto; width: min(620px, 80vw); }
  .v4 .v-end .v-line { font: 800 clamp(22px, 2.6vw, 36px)/1.1 "Inter Tight", Inter, sans-serif; letter-spacing: -.03em; color: #fff; margin-top: 20px; }
  .v4 .v-end .v-cta { justify-content: center; }

  @media (max-width: 980px) {
    .v4 .v-hero .v-hgrid, .v4 .v-cast .v-in { grid-template-columns: minmax(0, 1fr); }
    .v4 .v-desk { padding-right: 0; }
    .v4 .v-dock { position: relative; right: auto; top: auto; bottom: auto; width: 100%; height: 420px; margin-top: -40px; }
    .v4 .v-studio .v-char.big, .v4 .v-hrig { display: none; }
    .v4 .v-tmshot { position: relative; right: auto; top: auto; width: 92%; margin: 40px auto 0; }
    .v4 .v-dk { width: 84%; }
    .v4 .v-deck::before { padding-top: 56%; }
  }
  @media (max-width: 640px) {
    .v4 .v-hero .v-in { padding: 0 20px 40px; }
    .v4 .v-vibe .row, .v4 .v-worlds { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    .v4 .v-vibe button, .v4 .v-worlds button { width: 100%; height: auto; aspect-ratio: 1; }
    .v4 .v-pick { width: calc(20% - 7px); min-width: 56px; height: 76px; }
    .v4 .v-free { row-gap: 12px; }
  }
  `;
  if (V4) document.head.append(v4Css);
  if (V4 && !document.getElementById("kl-v4-fonts")) { const l = H("link"); l.id = "kl-v4-fonts"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700;800;900&display=swap"; document.head.append(l); }
  const v4HTML = () => `
    <div class="kl-grain"></div>
    <div class="kl-top"><button type="button" class="kl-logo" title="Back to the main menu"><img src="logo.png" alt="KILLTOY"></button><b>LANDING PAGE</b><span class="kl-sp"></span><button type="button" class="kl-x" title="Close">\u00d7</button></div>

    <section class="v-hero">
      <div class="v-hbg"><b class="v-hpic" style="background-image:url(${BGF(20)})"></b></div><i class="v-fz"></i>
      ${SPARK("", "--s:44px;left:62%;top:22%")}${SPARK("", "--s:26px;right:12%;top:16%;--bd:-1.2s")}${SPARK("", "--s:32px;right:24%;top:48%;--bd:-2s")}
      <div class="v-rig v-hrig">
        <img class="back" alt="" src="${L3(C4.creature)}">
        <div class="v-held"><img alt="" src="${L3("tm.webp")}"></div>
        <img class="front" alt="" src="${L3(C4.creature)}">
        <i class="eyes"></i>
      </div>
      <div class="v-in">
        <div class="v-hgrid">
          <div>
            <img class="v-wm" src="${LAND("landing4/logo.png")}" alt="KILLTOY">
            <div class="v-line">play like a kid.<br><em>cook like a villain.</em></div>
            <p class="v-p">A DAW that feels like a toy and still hits like a studio. Free, right in your browser.</p>
            <div class="v-cta"><button type="button" class="v-btn" data-act="open">START COOKING</button><button type="button" class="v-btn alt" data-act="try">TEXT A SYNTH</button></div>
          </div>
        </div>
      </div>
      <i class="v-scroll"></i>
    </section>


    <section class="v-studio lil">
      <i class="v-lilbg"></i>${STAR(14, "#0a0810", "v-burst", "right:5%;top:40px;width:120px;height:120px")}${BUBS(8, 1)}
      <div class="v-in">
        <div class="v-hd kl-rev">
          <div><div class="v-k">the studio</div><div class="v-tags"><span>beats</span><span>synths</span><span>drums</span><span>vocals : all in one place</span></div><h2 class="v-h s">your whole DAW,<br><em>your colours.</em></h2></div>
          <p class="v-p" style="max-width:420px">Pick a picture off the art wall and the whole DAW changes with it. Beats, synths, drums and vocals in one place.</p>
        </div>
      </div>
      <div class="v-deck">
        ${SHOTS.map((s, i) => `<button type="button" class="v-dk" data-i="${i}" title="${s.name}"><img alt="" draggable="false" ${i > 1 && i < SHOTS.length - 1 ? "loading=\"lazy\" " : ""}src="${L3(s.f)}"></button>`).join("")}
        <div class="v-dkbar"><button type="button" class="v-dkb" data-d="-1" title="Previous">\u2039</button><div class="v-dkcap"><b>${SHOTS[0].name}</b><small>${SHOTS[0].bpm} BPM</small></div><button type="button" class="v-dkb" data-d="1" title="Next">\u203a</button></div>
        <div class="v-char big" style="width:220px;left:-40px;bottom:10px;z-index:20;--d:-30;--bt:6.5s"><img alt="" loading="lazy" src="${L3(C4.vamp)}"></div>
      </div>
    </section>

    <section class="v-cast">
      ${FROST(18, .4)}
      <div class="v-in">
        <div class="kl-rev">
          <div class="v-k">your crew</div>
          <h2 class="v-h s">pick who<br>cooks <em>with you.</em></h2>
          <p class="v-p">A character lives next to your project. Talk to it like a friend in the studio: ask it to change a sound, fix the drums or name the song.</p>
          <div class="v-steps">
            <div class="v-step"><small><b>01</b> select your character</small><div class="v-picks">${CREW.map((c, i) => `<button type="button" class="v-pick${i ? "" : " on"}" data-c="${c.id}" title="${c.name}">${c.img ? `<img alt="" loading="lazy" src="${L3(c.img)}">` : SPARKBIG()}<span>${c.name}</span></button>`).join("")}</div></div>
            <div class="v-step"><small><b>02</b> create your character</small><div class="v-picks"><button type="button" class="v-pick make" data-act="make" title="Make your own"><i>+</i><span>YOUR OWN</span></button></div></div>
            <div class="v-step"><small><b>03</b> create your world</small><div class="v-worlds">${SHOTS.map((s, i) => `<button type="button" data-i="${i}" title="${s.name}" style="background-image:url(${BGS(s.bg)})"${i ? "" : " class=\"on\""}></button>`).join("")}</div></div>
          </div>
        </div>
        <div class="v-desk">
          <div class="shot">${SHOTS.map((s, i) => `<img alt="" loading="lazy" data-i="${i}" src="${L3(s.f)}"${i ? "" : " class=\"on\""}>`).join("")}</div>
          <div class="v-dock">
            <div class="who">${CREW.map((c, i) => c.img ? `<img alt="" loading="lazy" data-c="${c.id}" src="${L3(c.img)}" class="${i ? "off" : ""}">` : SPARKBIG().replace("<svg ", `<svg data-c="${c.id}" `)).join("")}</div>
            <div class="box v-panel">
              <div class="nm"><span class="v-cn">${CREW[0].name}</span><i></i></div>
              <div class="log"><p>${CREW[0].hi}</p></div>
              <div class="v-asks">${["make it darker", "fix the drums", "name my song"].map((a) => `<button type="button">${a}</button>`).join("")}</div>
              <form><input type="text" maxlength="80" placeholder="ask ${CREW[0].name.toLowerCase()}..." spellcheck="false"><button type="submit" title="Send">\u2192</button></form>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="v-beast">
      ${FROST(25, .32)}${SPARK("", "--s:34px;left:46%;top:130px;--bd:-1s")}
      <div class="v-in">
        <div class="v-txt kl-rev">
          <div class="v-k">under the hood</div>
          <h2 class="v-h s">cute outside.<br><em>lethal inside.</em></h2>
          <p class="v-p">It looks like a toy. Underneath it's a whole studio.</p>
          <div class="v-pow">
            <span><b>875</b> synth sounds and an engine you can tweak</span>
            <span>drums, 808s, sample kits <b>and your own sounds</b></span>
            <span>automation on <b>everything</b></span>
            <span>mixer, stems, MIDI out. <b>the real stuff</b></span>
          </div>
        </div>
      </div>
      <div class="v-tmshot kl-rev"><img alt="" loading="lazy" src="${L3("tm.webp")}"></div>
    </section>


    <section class="v-try lil">
      <i class="v-lilbg"></i>${STAR(12, "#e4ff3a", "v-burst", "right:7%;top:60px;width:110px;height:110px")}${BUBS(6, 7)}
      <div class="v-in">
        <div class="kl-try">
          <div class="v-k">01 \u00b7 the prompt synth</div><div class="v-tags"><span>type it</span><span>hear it</span><span>play it on the keys</span></div>
          <h2 class="v-h s">text a synth.</h2>
          <p class="v-p">Describe a sound in your own words. TOY MACHINE builds it, then you play it on the keys.</p>
          <div class="kl-box"><input type="text" class="kl-in" placeholder="dark wobbly bass, a little evil..." maxlength="120" spellcheck="false"><button type="button" class="kl-go" title="Make it"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z" fill="currentColor"/></svg></button></div>
          <div class="kl-chips">${["dirty 808", "cold glass bell", "dark choir", "dreamy pad", "evil pluck", "rage lead", "warm keys", "wobble bass"].map((w) => `<button type="button" class="kl-chip" data-w="${w}">${w}</button>`).join("")}</div>
          <div class="kl-scape"><canvas></canvas><div class="kl-heard">875 sounds inside TOY MACHINE</div></div>
          <div class="kl-keys"></div>
        </div>
      </div>
    </section>

    <section class="v-toys">
      ${FROST(5, .38)}
      <div class="v-in">
        <div class="v-toy tm kl-rev">
          <div class="v-txt">
            <div class="v-k">02 \u00b7 toy machine</div>
            <h2 class="v-h">the synth with a whole world inside</h2>
            <p class="v-p" style="font-size:15px">No wall of knobs. A landscape that moves with your sound. Tap one, hear it.</p>
          </div>
          <div class="kl-card3d" data-front="cards/C2_tm.jpg" data-back="cards/C3_tm_back.jpg"></div>
          <div class="kl-tiles"></div>
        </div>
        <div class="v-toy kd kl-rev">
          <div class="v-k" style="color:var(--grn)">03 \u00b7 killdrum</div>
          <h2 class="v-h">drums that <em style="color:var(--grn)">hit back.</em></h2>
          <div class="v-pet"><i class="ring"></i><div class="v-lcd"><div class="kl-grid"></div><div class="v-lcdt"><span>140 BPM</span><span class="kn">888 GENESIS</span><b>PRESS PLAY</b></div></div>
            <button type="button" class="v-pbtn l" data-act="kit-prev" title="Other kit">KIT</button><button type="button" class="v-pbtn m" data-act="pet-play" title="Play">PLAY</button><button type="button" class="v-pbtn r" data-act="kit-next" title="Other kit">KIT</button>
          </div>
          <div class="kl-drow"><button type="button" class="kl-btn" data-act="drum">PLAY</button><div class="kl-chips kl-kits"></div></div>
        </div>
      </div>
    </section>

    <section class="v-dice lil">
      <i class="v-lilbg"></i>${STAR(14, "#0a0810", "v-burst", "left:44%;top:30px;width:90px;height:90px")}
      <div class="v-in">
        <div class="v-top">
          <div class="kl-rev">
            <div class="v-k">04 \u00b7 midi</div><div class="v-tags"><span>mood</span><span>roll</span><span>bend : your notes</span></div>
            <h2 class="v-h s">roll chords.<br><em>bend them.</em></h2>
            <p class="v-p">Pick a mood, roll a start, then move, stretch and flip every note. Your song, not the dice's. Save it as MIDI.</p>
          </div>
          <div class="y-die" data-act="die" title="Roll"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="kl-drow"><button type="button" class="kl-btn solid" data-act="roll">ROLL</button><div class="kl-chips kl-moods">${["villain", "dreamy", "sad", "happy", "euphoric"].map((w, i) => `<button type="button" class="kl-chip${i ? "" : " on"}" data-m="${w}">${w}</button>`).join("")}</div><span style="flex:1"></span><button type="button" class="kl-btn" data-act="mid">SAVE .MID</button></div>
        <div class="kl-roll"><canvas></canvas></div>
        <div class="kl-chords"></div>
      </div>
    </section>

    <section class="v-kits">
      ${FROST(29, .36)}
      <div class="v-weekly">${STAR(14, "#E4FF3A", "")}<b>NEW KITS<br>EVERY<br>WEEK</b></div>
      <div class="v-in">
        <div class="v-k">05 \u00b7 sample kits</div>
        <h2 class="v-h s">kits that <em>slap.</em></h2>
        <p class="v-p">Tap one to hear it. 32 sounds in each, new ones every week.</p>
        <div class="v-shelf">${KITS_WALL.map(([id, n], i) => `<button type="button" class="y-kit" data-kit="${id}" style="background-image:url(${LAND("landing4/kit-" + id + ".webp")});--bd:-${(i * 0.7).toFixed(1)}s;--kc:${["rgba(143,99,255,.45)", "rgba(228,255,58,.35)", "rgba(61,255,122,.35)", "rgba(127,232,255,.35)"][i % 4]}"><span>${n.toLowerCase()}</span></button>`).join("")}</div>
      </div>
    </section>

    <section class="v-game lil">
      <i class="v-lilbg"></i>${STAR(12, "#0a0810", "v-burst", "right:6%;top:50px;width:130px;height:130px")}
      <div class="v-in">
        <div class="v-k">06 \u00b7 quests</div><div class="v-tags"><span>quests</span><span>new synths</span><span>new effects : weekly</span></div>
        <h2 class="v-h s">win new synths<br><em>every week.</em></h2>
        <p class="v-p">Do quests and win new synths, effects and kits. New ones drop every week.</p>
        <div class="kl-case"></div>
      </div>
    </section>

    <section class="v-end">
      ${FROST(11, .42, 18)}${SPARK("", "--s:40px;left:18%;top:110px")}${SPARK("", "--s:28px;right:20%;top:180px;--bd:-1.5s")}
      <div class="v-char" style="width:190px;left:max(2%, calc(50% - 560px));bottom:40px;--d:-20;--bt:6s"><img alt="" loading="lazy" src="${L3(C4.vamp)}"></div>
      <div class="v-char" style="width:200px;right:max(2%, calc(50% - 560px));bottom:60px;--d:24;--bt:7s;--bd:-3s"><img alt="" loading="lazy" src="${L3(C4.bun)}"></div>
      <div class="v-in">
        <img class="v-wm" src="${LAND("landing4/logo.png")}" alt="KILLTOY">
        <div class="v-line">the toy box is open.</div>
        <div class="v-cta"><button type="button" class="v-btn" data-act="open">OPEN KILLTOY</button></div>
      </div>
    </section>`;

  // a melting edge for the lilac panels: soft lobes along the edge plus a few loose drops, a bit random each time
  const MELT = (seed, flip) => {
    let r = seed * 7919 % 233280 + 1;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    let x = 0, y = 70 + rnd() * 40, d = "M0 160 L0 " + y.toFixed(0), drops = "";
    while (x < 1440) {
      const w = 140 + rnd() * 260, nx = Math.min(1440, x + w), ny = 25 + rnd() * 105, dip = rnd() < .5 ? 5 + rnd() * 25 : 120 + rnd() * 30;
      d += ` C${(x + w * .15).toFixed(0)} ${dip.toFixed(0)} ${(x + w * .85).toFixed(0)} ${dip.toFixed(0)} ${nx.toFixed(0)} ${ny.toFixed(0)}`;
      if (rnd() < .45) drops += `<ellipse cx='${(x + w * rnd()).toFixed(0)}' cy='${(8 + rnd() * 26).toFixed(0)}' rx='${(10 + rnd() * 26).toFixed(0)}' ry='${(8 + rnd() * 14).toFixed(0)}'/>`;
      x = nx; y = ny;
    }
    d += " L1440 160 Z";
    const g = flip ? `<g transform='translate(0 160) scale(1 -1)'><path d='${d}'/>${drops}</g>` : `<path d='${d}'/>${drops}`;
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 160' preserveAspectRatio='none'>${g}</svg>`)}")`;
  };
  const melt = () => $$(".v-lilbg", page).forEach((el, i) => {
    const m = `${MELT(i * 3 + 2, 0)} top / 100% 160px no-repeat, linear-gradient(#000, #000) center / 100% calc(100% - 316px) no-repeat, ${MELT(i * 3 + 5, 1)} bottom / 100% 160px no-repeat`;
    el.style.webkitMask = m; el.style.mask = m;
  });

  // the crew: pick a character (it swaps in the dock), pick a world (the DAW behind it changes), talk to it
  function wireV4() {
    melt();
    const dock = $(".v-dock", page); if (!dock) return;
    const log = $(".log", dock), inp = $("input", dock), cn = $(".v-cn", dock);
    let who = CREW[0];
    const say = (t, me) => { const p = H("p", me ? "me" : ""); p.textContent = t; log.append(p); while (log.children.length > 6) log.firstChild.remove(); log.scrollTop = log.scrollHeight; return p; };
    const answer = (q) => {
      const lo = q.toLowerCase(), hit = CREW_SAY.find(([re]) => re.test(lo));
      const dots = say("...", false); dots.classList.add("dots");
      setTimeout(() => { dots.remove(); say(hit ? hit[1] : "on it. which part: the drums, the chords or the sound?"); }, 650);
    };
    const ask = (q) => { q = (q || "").trim(); if (!q) return; say(q, true); answer(q); };
    $("form", dock).onsubmit = (e) => { e.preventDefault(); ask(inp.value); inp.value = ""; };
    $$(".v-asks button", dock).forEach((b) => b.onclick = () => ask(b.textContent));
    $$(".v-pick[data-c]", page).forEach((b) => b.onclick = () => {
      who = CREW.find((c) => c.id === b.dataset.c) || CREW[0];
      $$(".v-pick[data-c]", page).forEach((x) => x.classList.toggle("on", x === b));
      $$(".who > [data-c]", dock).forEach((x) => x.classList.toggle("off", x.dataset.c !== who.id));
      cn.textContent = who.name; inp.placeholder = "ask " + who.name.toLowerCase() + "...";
      log.innerHTML = ""; say(who.hi);
    });
    const mk = $("[data-act=make]", page);
    if (mk) mk.onclick = () => { say("make your own", true); setTimeout(() => say("soon you can build your own character: the face, the colours, the voice. it stays with you in every project."), 500); };
    const shots = $$(".v-desk .shot img", page), worlds = $$(".v-worlds button", page);
    worlds.forEach((w) => w.onclick = () => {
      const i = +w.dataset.i;
      worlds.forEach((x) => x.classList.toggle("on", x === w));
      shots.forEach((s) => { const k = +s.dataset.i; s.style.setProperty("--o", k < i ? -1 : 1); s.classList.toggle("on", k === i); });
    });
    // the deck of projects
    const deck = $(".v-deck", page);
    if (deck) {
      const cards = $$(".v-dk", deck), n = cards.length, cap = $(".v-dkcap", deck);
      let at = 0;
      const lay = (drag) => cards.forEach((c, i) => {
        let d = i - at; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
        const dd = d + (drag || 0);
        c.style.setProperty("--d", dd.toFixed(3)); c.style.setProperty("--a", Math.abs(dd).toFixed(3));
        c.style.zIndex = 10 - Math.round(Math.abs(dd) * 2);
        c.classList.toggle("on", d === 0); c.classList.toggle("far", Math.abs(d) > 2);
      });
      const go = (i) => { at = (i + n) % n; lay(); cap.innerHTML = `<b>${SHOTS[at].name}</b><small>${SHOTS[at].bpm} BPM</small>`; };
      cards.forEach((c, i) => c.onclick = () => { if (deck._moved) return; if (i !== at) go(i); });
      $$(".v-dkb", deck).forEach((b) => b.onclick = () => go(at + +b.dataset.d));
      let x0 = null;
      deck.addEventListener("pointerdown", (e) => { if (!e.target.closest(".v-dk")) return; x0 = e.clientX; deck._moved = false; });
      addEventListener("pointermove", (e) => { if (x0 == null) return; const dx = e.clientX - x0; if (Math.abs(dx) > 6) { deck._moved = true; deck.classList.add("drag"); lay(-dx / (deck.clientWidth * 0.3)); } });
      addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; deck.classList.remove("drag"); if (deck._moved) { const k = Math.round(-dx / (deck.clientWidth * 0.3)); go(at + (k || (Math.abs(dx) > 40 ? -Math.sign(dx) : 0))); setTimeout(() => { deck._moved = false; }, 0); } });
      lay();
    }
  }

  const MARQ = (txt, g) => `<div class="y-marq${g ? " g" : ""}"><span>${(txt + " \u2736 ").repeat(8)}</span><span>${(txt + " \u2736 ").repeat(8)}</span></div>`;
  const y2kHTML = () => `
    <div class="kl-grain"></div>
    <div class="kl-top"><button type="button" class="kl-logo" title="Back to the main menu"><img src="logo.png" alt="KILLTOY"></button><b>LANDING PAGE</b><span class="kl-sp"></span><button type="button" class="kl-x" title="Close">\u00d7</button></div>
    <div class="y-wrap">

    <section class="y-panel pur y-hero">
      <div class="y-nav">
        <ul class="y-mono"><li>TOY MACHINE</li><li>KILLDRUM</li><li>MIDI + DICE</li><li>SAMPLE KITS</li><li>QUESTS</li></ul>
        <button type="button" class="y-btn" data-act="open">OPEN THE PLAYGROUND</button>
      </div>
      <div class="y-head"><h1 class="y-t xl">make music like<br>playing with toys</h1></div>
      <div class="y-blob">
        <b>KILLTOY</b>
        <svg class="orb" viewBox="0 0 1000 300" preserveAspectRatio="none"><ellipse cx="500" cy="150" rx="470" ry="62" fill="none" stroke="#fff" stroke-width="2" transform="rotate(-6 500 150)"/><ellipse cx="520" cy="160" rx="300" ry="120" fill="none" stroke="#fff" stroke-width="1.5" transform="rotate(14 520 160)"/><path d="M60 230 C 240 120, 420 300, 600 170 S 900 90, 960 140" fill="none" stroke="#fff" stroke-width="1.5"/></svg>
        <span class="y-mono" style="left:12%;top:72%;color:#fff">K</span><span class="y-mono" style="left:33%;top:10%;color:#fff">I</span><span class="y-mono" style="left:58%;top:78%;color:#fff">L</span><span class="y-mono" style="left:79%;top:18%;color:#fff">T</span>
      </div>
      <div class="y-four y-mono"><span>DAW IN YOUR<br>BROWSER</span><span>SYNTHS YOU<br>PLAY LIKE TOYS</span><span>CHORD DICE<br>YOU BEND</span><span>FREE,<br>NO INSTALL</span></div>
      <button type="button" class="y-btn y-bar" data-act="try"><i></i>\u2192 TRY IT FREE \u2190<i></i></button>
      <div class="y-win">
        ${STAR(12, "#E4FF3A", "", "left:-50px;top:-58px;width:140px;height:140px")}
        ${STAR(8, "#3dff7a", "r", "right:-44px;bottom:-50px;width:120px;height:120px")}
        <div class="y-wbar"><span>KILLTOY 2 \u00b7 PLAYGROUND</span><i></i><i></i><i></i></div>
        <div class="kl-app">
          <img alt="KILLTOY playground" src="${LAND("landing/hero.jpg")}" onerror="this.src='${LAND("landing/pg-play.jpg")}'">
          <video muted loop playsinline autoplay preload="auto" poster="${LAND("landing/hero.jpg")}" src="${LAND("landing/hero.webm")}"></video>
          <div class="kl-call" style="left:38%;top:10%"><span>SONG PARTS</span></div>
          <div class="kl-call" style="left:12%;top:20%"><span>PATTERNS</span></div>
          <div class="kl-call" style="left:58%;top:66%"><span>ONE OPEN GRID</span></div>
          <div class="kl-call" style="left:32%;top:44%"><span>DRUMS + 808</span></div>
        </div>
      </div>
    </section>

    ${MARQ("FREE IN YOUR BROWSER \u2736 TOY MACHINE \u2736 KILLDRUM \u2736 MIDI \u2736 SAMPLE KITS")}

    <section class="y-panel blk">
      <div class="y-col">
        <div class="y-left">
          <div class="y-tape y-shot" style="left:0;top:10px;transform:rotate(-4deg)"><img alt="" src="${LAND("landing/pg-dice.jpg")}"></div>
          <div class="y-tape y-shot" style="left:14%;top:300px;transform:rotate(3deg)"><img alt="" src="${LAND("landing/pg-drop.jpg")}"></div>
          <div class="y-sticker" style="right:2%;top:120px;width:150px;height:150px;border-radius:50%;transform:rotate(8deg);background-image:url(${BG(8)})"></div>
          <div class="y-note y-mono">killtoy is a toy box for making music. no channels to set up: drop a sound anywhere and it plays. roll the dice for chords. it is fine if it sounds weird at first. that is the fun part.</div>
          ${STAR(10, "#E4FF3A", "", "left:62%;top:-10px;width:110px;height:110px")}
          ${STAR(7, "#9b7bff", "r", "left:-30px;top:470px;width:90px;height:90px")}
        </div>
        <div>
          <h2 class="y-t xl y-purple">KILLTOY</h2>
          <p class="y-t" style="text-align:right;margin-top:10px">the place where you<br>make music <span class="y-acid">without</span><br>being a pro first</p>
          <div class="kl-screen kl-main"></div>
          <div class="kl-pg-row"></div>
          <p class="y-mono y-green" style="text-align:right;margin-top:16px;font-size:13px">FREE \u00b7 WEB \u00b7 2026</p>
        </div>
      </div>
    </section>

    <section class="y-panel pur">
      <div class="y-why">
        <h2 class="y-t xl" style="left:0">WHY</h2><h2 class="y-t xl" style="right:0">TOYS</h2>
        <svg class="path" viewBox="0 0 1000 720" preserveAspectRatio="none"><path d="M120 250 C 260 160, 380 420, 520 330 S 760 120, 820 260 S 700 600, 460 560 S 160 640, 140 520" fill="none" stroke="#0b0b0e" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"/></svg>
        ${STAR(12, "#E4FF3A", "", "left:30%;top:120px;width:160px;height:160px")}
        ${STAR(9, "#3dff7a", "r", "left:56%;top:470px;width:130px;height:130px")}
        <div class="kl-card3d" style="left:4%;top:120px" data-front="cards/C2_tm.jpg" data-back="cards/C3_tm_back.jpg"></div>
        <div class="kl-card3d" style="right:4%;top:150px" data-front="cards/C2_kd.jpg" data-back="cards/C3_kd_back.jpg"></div>
        <div class="y-die" style="left:40%;top:250px;transform:rotate(-8deg)" data-act="die" title="Roll"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <span class="y-num" style="left:13%;top:62%">1</span><div class="y-stop" style="left:4%;top:66%"><span class="y-label">TOY MACHINE</span><span class="y-mono">: a synth with a landscape, not a wall of knobs. 875 sounds</span></div>
        <span class="y-num" style="left:51%;top:33%">2</span><div class="y-stop" style="left:47%;top:60%"><span class="y-label">THE DICE</span><span class="y-mono">: roll chords in a mood, then bend them your way</span></div>
        <span class="y-num" style="left:81%;top:36%">3</span><div class="y-stop" style="right:4%;top:70%;text-align:right"><span class="y-label">KILLDRUM</span><span class="y-mono" style="margin-left:auto">: real kits, dirty 808s, type a vibe</span></div>
        <span class="y-num" style="left:14%;top:72%;display:none">4</span><div class="y-stop" style="left:24%;top:86%"><span class="y-label k">QUESTS</span><span class="y-mono">: learn by playing, win new synths, fx and kits</span></div>
      </div>
    </section>

    <section class="y-panel blk">
      <div class="kl-try">
        <div><span class="y-mono y-green">01 \u00b7 try it</span><h2 class="y-t xl y-acid" style="margin-top:8px">say a sound.<br><span style="color:#fff">hear it.</span></h2></div>
        <div class="kl-box"><input type="text" class="kl-in" placeholder="dirty 808, cold glass bell, wobbling pad..." maxlength="120" spellcheck="false"><button type="button" class="kl-go" title="Make it"><svg viewBox="0 0 24 24"><path d="M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z"/></svg></button></div>
        <div class="kl-chips">${["dirty 808", "cold glass bell", "dark choir", "dreamy pad", "evil pluck", "rage lead", "warm keys", "wobble bass"].map((w) => `<button type="button" class="kl-chip" data-w="${w}">${w}</button>`).join("")}</div>
        <div class="kl-scape"><canvas></canvas><div class="kl-heard">875 sounds inside TOY MACHINE</div></div>
        <div class="kl-keys"></div>
      </div>
      ${STAR(10, "#9b7bff", "r", "right:3%;top:40px;width:150px;height:150px")}
    </section>

    ${MARQ("TYPE IT \u2736 HEAR IT \u2736 PLAY IT \u2736 KEEP IT", true)}

    <section class="y-panel pur">
      <div class="y-inst">
        <div class="y-paper">
          <span class="y-mono">02 \u00b7 toy machine</span><h2 class="y-t" style="margin-top:6px">the synth you<br>play like a toy</h2>
          <div class="kl-tiles"></div>
        </div>
        <div class="y-paper k">
          <span class="y-mono y-green">03 \u00b7 killdrum</span><h2 class="y-t y-acid" style="margin-top:6px">drums with<br>a bad attitude</h2>
          <div class="kl-grid"></div>
          <div class="kl-drow"><button type="button" class="kl-btn" data-act="drum">PLAY</button><div class="kl-chips kl-kits"></div></div>
        </div>
      </div>
      ${STAR(12, "#E4FF3A", "", "left:44%;top:-40px;width:120px;height:120px")}
    </section>

    <section class="y-panel blk">
      <span class="y-mono y-green">04 \u00b7 midi</span>
      <h2 class="y-t xl" style="margin-top:8px">roll it.<br><span class="y-green">bend it. make it yours.</span></h2>
      <p class="y-mono" style="max-width:520px;margin-top:12px;color:#bbb">pick a mood, roll a starting point, then move, stretch and flip the notes yourself. save them as midi.</p>
      <div class="kl-drow" style="margin-top:22px"><button type="button" class="kl-btn solid" data-act="roll">ROLL</button><div class="kl-chips kl-moods">${["villain", "dreamy", "sad", "happy", "euphoric"].map((w, i) => `<button type="button" class="kl-chip${i ? "" : " on"}" data-m="${w}">${w}</button>`).join("")}</div><span style="flex:1"></span><button type="button" class="kl-btn" data-act="mid">SAVE .MID</button></div>
      <div class="kl-roll"><canvas></canvas></div>
      <div class="kl-chords"></div>
    </section>

    <section class="y-panel pur y-kits">
      <span class="y-mono">05 \u00b7 sample kits</span>
      <h2 class="y-t xl" style="margin-top:8px">gallery of kits</h2>
      <div class="y-weekly">${STAR(14, "#E4FF3A", "")}<b>NEW KITS<br>EVERY<br>WEEK</b></div>
      <div class="y-gal"><div class="y-room">
        <div class="y-wall l">${KITS_WALL.slice(0, 2).map(([id, n]) => `<button type="button" class="y-kit" data-kit="${id}" style="background-image:url(packs/${id}.jpg)"><span>${n}</span></button>`).join("")}</div>
        <div class="y-wall back">${KITS_WALL.slice(2, 6).map(([id, n]) => `<button type="button" class="y-kit" data-kit="${id}" style="background-image:url(packs/${id}.jpg)"><span>${n}</span></button>`).join("")}</div>
        <div class="y-wall r">${KITS_WALL.slice(6).map(([id, n]) => `<button type="button" class="y-kit" data-kit="${id}" style="background-image:url(packs/${id}.jpg)"><span>${n}</span></button>`).join("")}</div>
      </div></div>
      <p class="y-mono" style="text-align:center;margin-top:8px">click a kit to hear it \u00b7 32 sounds in each</p>
    </section>

    <section class="y-panel blk y-free">
      <div style="display:grid;grid-template-columns:auto 1fr;gap:30px;align-items:end">
        <b class="fat" style="color:#E4FF3A">FREE.</b>
        <p class="y-t" style="font-size:clamp(18px,2vw,28px)">the whole playground runs in your browser. <span class="y-green">make music, earn your way</span> to new synths, effects and picked kits.</p>
      </div>
      <div class="kl-case"></div>
    </section>

    ${MARQ("MAKE MUSIC LIKE PLAYING WITH TOYS")}

    <section class="y-panel pur y-end">
      <img src="logo.png" alt="KILLTOY" style="filter:invert(1)">
      <button type="button" class="y-btn y-bar" data-act="open" style="max-width:640px"><i></i>\u2192 OPEN THE PLAYGROUND \u2190<i></i></button>
    </section>
    </div>`;

  // ------------------------------------------------------------------ audio (one context, one level meter)
  let AC = null, OUT = null, AN = null, FREQ = null;
  const ctx = () => {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      OUT = AC.createGain(); OUT.gain.value = 0.9;
      AN = AC.createAnalyser(); AN.fftSize = 2048; AN.smoothingTimeConstant = 0.78; FREQ = new Uint8Array(AN.frequencyBinCount);
      OUT.connect(AN); AN.connect(AC.destination);
    }
    if (AC.state !== "running") AC.resume().catch(() => {});
    return AC;
  };
  let voice = null;   // the one phrase playing (prompt synth, TOY MACHINE tiles, MIDI, opening)
  const stopVoice = () => { if (voice) { try { voice.src.stop(); } catch (e) { /* done */ } if (voice.done) voice.done(); voice = null; } };
  const playBuf = (L, R, onEnd) => {
    const c = ctx(); stopVoice();
    const buf = c.createBuffer(2, L.length, c.sampleRate); buf.copyToChannel(L, 0); buf.copyToChannel(R || L, 1);
    const src = c.createBufferSource(); src.buffer = buf; src.connect(OUT); src.start();
    const v = { src, t0: c.currentTime, dur: buf.duration, done: onEnd };
    src.onended = () => { if (voice === v) { voice = null; if (onEnd) onEnd(); } };
    voice = v; return v;
  };

  // TOY MACHINE: the real engine, offline renders (like the CHORD LAB page)
  let TM = null, IDX = null;
  const tm = async () => { if (!TM) TM = await window.ToyMachine.load(ctx()); return TM; };
  const index = async () => { if (!IDX) { try { IDX = await (await fetch("toy-machine/presets/index.json")).json(); } catch (e) { IDX = []; } } return IDX; };
  const presetCache = {}, sampleCache = {};
  const preset = async (it) => presetCache[it.id] || (presetCache[it.id] = await (await fetch("toy-machine/presets/" + it.file)).json());
  const sampleOf = (pr) => {
    const sm = pr && pr.sampler, f = sm && sm.on !== false && sm.file;
    if (typeof f !== "string" || !/^samples\//.test(f)) return Promise.resolve(null);
    if (!sampleCache[f]) sampleCache[f] = fetch("toy-machine/" + f.split("/").map(encodeURIComponent).join("/"))
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => ctx().decodeAudioData(b))
      .then((buf) => { const data = new Float32Array(buf.length); for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) data[i] += d[i] / buf.numberOfChannels; } return { data, sampleRate: buf.sampleRate }; })
      .catch(() => { delete sampleCache[f]; return null; });
    return sampleCache[f];
  };
  const render = async (it, notes, bpm, beats, own) => {
    const T = await tm(), p = own || await preset(it), sample = await sampleOf(p), spb = 60 / bpm;
    const out = await T.render(p, notes, { bpm, seconds: beats * spb + 1.8, sampleRate: ctx().sampleRate, sample });
    // same loudness for every sound: peak to about -3 dB
    let pk = 0; for (const ch of out) for (let i = 0; i < ch.length; i += 2) pk = Math.max(pk, Math.abs(ch[i]));
    if (pk > 0.001) { const g = Math.min(4, 0.7 / pk); for (const ch of out) for (let i = 0; i < ch.length; i++) ch[i] *= g; }
    return out;
  };

  // the little phrase each kind of sound plays (A minor, 120 BPM): the notes are in beats
  const N = (pitch, start, length, velocity) => ({ pitch, start, length, velocity: velocity || 100 });
  const CH = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];   // Am F C G
  const PHRASE = {
    Bass: () => [N(45, 0, 1.4), N(45, 1.5, 0.4), N(48, 2, 0.9), N(43, 3, 0.9), N(45, 4, 1.4), N(52, 5.5, 0.45), N(50, 6, 1.9)],
    Pads: () => CH.flatMap((c, i) => c.map((p) => N(p, i * 2, 1.95, 90))),
    Keys: () => CH.flatMap((c, i) => c.map((p) => N(p, i * 2, 1.6, 96)).concat([N(c[0] - 12, i * 2, 1.9, 90)])),
    Leads: () => [N(76, 0, 1), N(74, 1, 0.5), N(72, 1.5, 0.5), N(71, 2, 1), N(72, 3, 0.5), N(69, 3.5, 2.4), N(64, 6, 0.5), N(67, 6.5, 1.4)],
    Plucks: () => CH.flatMap((c, i) => [0, 1, 2, 1, 0, 2, 1, 2].map((k, j) => N(c[k] + (j > 3 ? 12 : 0), i * 2 + j * 0.25, 0.22, j % 2 ? 86 : 104))),
    Arps: () => [N(57, 0, 3.9), N(60, 0, 3.9), N(64, 0, 3.9), N(53, 4, 3.9), N(57, 4, 3.9), N(60, 4, 3.9)],
    FX: () => [N(57, 0, 6)],
  };
  PHRASE.Synths = PHRASE.Keys;
  const phraseFor = (it) => (PHRASE[it.category] || PHRASE.Keys)();
  const KEYBASE = { Bass: 36, Pads: 48, Keys: 48, Synths: 48, Leads: 60, Plucks: 60, Arps: 48, FX: 48 };

  // words -> settings (Eman 23:39: "is it creating sounds?"): after the closest preset is picked, the words move
  // TOY MACHINE's own settings, so the sound you hear is shaped by what you typed. A light first version for this
  // page; the SYNTH SOUND SCIENCE thread builds the real one. KT2_LANDING_SHAPE_OFF = plain library picks.
  const SHAPES = [
    { w: ["dark", "darker", "deep", "warm", "muffled", "murky", "moody"], say: "DARKER", f: (p, k) => { cut(p, Math.pow(0.42, k)); eq(p, "high", -4 * k); } },
    { w: ["bright", "airy", "crisp", "shiny", "glass", "glassy", "cold", "icy", "sparkly"], say: "BRIGHTER", f: (p, k) => { cut(p, Math.pow(2.3, k)); eq(p, "high", 3 * k); } },
    { w: ["dirty", "distorted", "distortion", "gritty", "grit", "rage", "evil", "aggressive", "hard", "crunchy", "angry", "nasty"], say: "DIRTY", f: (p, k) => { const d = fx(p, "drive", { mode: "tube", amount: 0, tone: 0.5, mix: 0.6 }); d.amount = Math.min(30, (d.amount || 0) + 14 * k); d.mix = Math.max(d.mix || 0, 0.55); if (p.filter) p.filter.drive = Math.min(12, (p.filter.drive || 0) + 4 * k); } },
    { w: ["clean", "soft", "smooth", "gentle", "pure", "calm"], say: "CLEAN", f: (p) => { (p.fx || []).forEach((x) => { if (x.type === "drive") x.amount = (x.amount || 0) * 0.25; }); env(p, { a: Math.max(0.015, (p.ampEnv && p.ampEnv.a) || 0) }); } },
    { w: ["wide", "huge", "big", "supersaw", "stereo", "massive", "epic"], say: "WIDER", f: (p) => { const o = p.oscA = p.oscA || {}; const u = o.unison = o.unison || {}; u.voices = Math.max(5, u.voices || 1); u.detune = Math.max(22, (u.detune || 0) + 8); u.spread = 1; p.out = Object.assign({}, p.out, { width: 1 }); } },
    { w: ["ambient", "dreamy", "dream", "spacey", "space", "ethereal", "reverb", "wet", "cinematic", "heaven", "heavenly", "sky", "shimmer", "choir"], say: "MORE SPACE", f: (p, k) => { const r = fx(p, "reverb", { size: 0.6, decay: 2.5, damp: 0.4, mix: 0.1 }); r.mix = Math.min(0.6, (r.mix || 0) + 0.22 * k); r.size = Math.max(r.size || 0, 0.8); r.decay = Math.max(r.decay || 0, 4.5); env(p, { r: Math.max(0.9, (p.ampEnv && p.ampEnv.r) || 0) }); } },
    { w: ["echo", "delay", "delayed", "delaying", "repeat", "pingpong"], say: "ECHO", f: (p) => { const d = fx(p, "delay", { time: 0.375, sync: "1/8d", feedback: 0.4, mix: 0.25, pingpong: true, tone: 0.5 }); d.mix = Math.max(d.mix || 0, 0.25); d.feedback = Math.max(d.feedback || 0, 0.4); } },
    { w: ["pluck", "plucky", "short", "staccato", "stab", "punchy", "tight", "snappy"], say: "SHORTER", f: (p) => env(p, { a: 0.002, d: 0.22, s: 0.08, r: 0.12 }) },
    { w: ["slow", "swell", "swelling", "evolving", "fading", "rising", "lush"], say: "SLOW SWELL", f: (p) => env(p, { a: 0.55, s: 0.9, r: 1.6 }) },
    { w: ["sub", "heavy", "low", "fat", "thick", "bassy", "deep"], say: "HEAVIER", f: (p) => { p.sub = Object.assign({ shape: "sine", oct: -1, filter: false }, p.sub, { on: true, level: Math.max(0.55, (p.sub && p.sub.level) || 0) }); } },
    { w: ["detuned", "chorus", "warble", "warbly", "tape", "vintage", "lofi", "dusty", "old"], say: "WARBLE", f: (p) => { const c = fx(p, "chorus", { rate: 0.8, depth: 0.5, mix: 0.3 }); c.mix = Math.max(c.mix || 0, 0.4); c.depth = Math.max(c.depth || 0, 0.6); } },
    { w: ["wobble", "wobbly", "wobbling", "wub", "dubstep", "morph", "morphing", "moving", "pulsing"], say: "WOBBLE", f: (p, k, words) => {
      const sync = /1\/16|16th/.test(words) ? "1/16" : /1\/8|8th/.test(words) ? "1/8" : /1\/2|half/.test(words) ? "1/2" : "1/4";
      p.lfo1 = { shape: "sine", rate: 2, sync, retrig: true, phase: 0 };
      if (!p.filter || p.filter.on === false) p.filter = Object.assign({ type: "lp24", res: 0.3, keytrack: 0.3, env: 0 }, p.filter, { on: true, cutoff: 1400 });
      p.mods = (p.mods || []).filter((m) => !(m.src === "lfo1" && m.dst === "filter.cutoff")).concat([{ src: "lfo1", dst: "filter.cutoff", amt: 2.6 * k }]);
    } },
  ];
  const cut = (p, m) => { p.filter = Object.assign({ type: "lp24", res: 0.2, drive: 0, keytrack: 0.3, env: 0 }, p.filter); if (p.filter.on === false) { p.filter.on = true; p.filter.cutoff = 9000; } p.filter.cutoff = Math.max(140, Math.min(18000, (p.filter.cutoff || 9000) * m)); };
  const eq = (p, band, db) => { const e = fx(p, "eq", { low: 0, lowFreq: 120, high: 0, highFreq: 6000 }); e[band] = Math.max(-12, Math.min(9, (e[band] || 0) + db)); };
  const env = (p, v) => { p.ampEnv = Object.assign({ a: 0.003, d: 0.3, s: 0.8, r: 0.12, curve: 0.5 }, p.ampEnv, v); };
  const fx = (p, type, def) => { p.fx = p.fx || []; let x = p.fx.find((f) => f.type === type); if (!x) { x = Object.assign({ type }, def); p.fx.push(x); } x.on = true; return x; };
  const shapeSound = (p0, text) => {
    const words = String(text || "").toLowerCase(), list = words.split(/[^a-z0-9/]+/).filter(Boolean);
    const k = /\b(very|super|extra|really|crazy|insanely|so)\b/.test(words) ? 1.5 : /\b(slightly|bit|little|kinda|somewhat)\b/.test(words) ? 0.5 : 1;
    const p = JSON.parse(JSON.stringify(p0)), did = [];
    if (window.KT2_LANDING_SHAPE_OFF) return { p, did };
    for (const sh of SHAPES) if (sh.w.some((w) => list.includes(w))) { try { sh.f(p, k, words); did.push(sh.say); } catch (e) { /* skip that move */ } }
    return { p, did };
  };

  // words -> a preset: every word scores against the name, the category and the 30-40 keywords each preset has
  const CAT_WORDS = { Bass: ["bass", "808", "sub", "reese", "low"], Pads: ["pad", "pads", "choir", "atmosphere", "ambient"], Keys: ["keys", "piano", "ep", "rhodes", "organ", "bell", "bells"],
    Leads: ["lead", "leads", "scream", "screamer", "rage"], Plucks: ["pluck", "plucks", "stab"], Arps: ["arp", "arps", "arpeggio", "sequence"], FX: ["fx", "riser", "zap", "laser", "noise"] };
  const pick = async (text, avoid) => {
    const idx = await index(), words = String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    if (!idx.length) return null;
    const scored = idx.map((it) => {
      const kw = it.kw || [], nm = it.name.toLowerCase(); let s = 0;
      for (const w of words) {
        if (nm.split(/\s+/).includes(w)) s += 4; else if (nm.includes(w)) s += 2;
        if (kw.includes(w)) s += 2; else if (kw.some((k) => k.startsWith(w) || w.startsWith(k) && k.length > 3)) s += 0.8;
        if ((CAT_WORDS[it.category] || []).includes(w)) s += 3;
      }
      if ((it.tags || []).includes("factory")) s += 0.3;
      return { it, s: s + Math.random() * 0.6 };
    }).filter((x) => x.it.id !== avoid).sort((a, b) => b.s - a.s);
    return (scored.slice(0, 4)[Math.floor(Math.random() * Math.min(4, scored.length))] || scored[0]).it;
  };

  // ------------------------------------------------------------------ the page
  let page = null, raf = 0;
  const build = () => {
    page = H("div", "kl" + (V4 ? " v3 v4" : V3 ? " v3" : Y2K ? " y2k" : "")); page.id = "kt2-landing"; page.hidden = true;
    page.innerHTML = V4 ? v4HTML() : V3 ? v3HTML() : Y2K ? y2kHTML() : `
    <div class="kl-grain"></div>
    <div class="kl-top"><button type="button" class="kl-logo" title="Back to the main menu"><img src="logo.png" alt="KILLTOY"></button><b>LANDING PAGE</b><span class="kl-sp"></span><button type="button" class="kl-x" title="Close">\u00d7</button></div>

    <section class="kl-hero" data-face="11">
      <div class="kl-frost" style="background-image:url(${BG(11)})"></div><div class="kl-veil"></div>
      <div class="kl-stamp">FREE</div>
      <img class="kl-wm" src="logo.png" alt="KILLTOY">
      <div class="kl-line">${LINE}</div>
      <div class="kl-tags"><span><b>DAW</b> IN YOUR BROWSER</span><span>SYNTHS</span><span>DRUMS</span><span>MIDI</span><span>FREE</span></div>
      <div class="kl-stage"><div class="kl-app">
        <img alt="KILLTOY playground" src="${LAND("landing/hero.jpg")}" onerror="this.src='${LAND("landing/pg-play.jpg")}'">
        <video muted loop playsinline autoplay preload="auto" poster="${LAND("landing/hero.jpg")}" src="${LAND("landing/hero.webm")}"></video>
        <div class="kl-call" style="left:38%;top:10%"><span>SONG PARTS</span></div>
        <div class="kl-call" style="left:12%;top:20%"><span>PATTERNS</span></div>
        <div class="kl-call" style="left:58%;top:66%"><span>ONE OPEN GRID</span></div>
        <div class="kl-call" style="left:32%;top:44%"><span>DRUMS + 808</span></div>
      </div></div>
    </section>

    <div class="kl-band" style="background-image:url(${BG(8)})"><span>a toy box for making music</span></div>

    <section class="kl-try">
      <div class="kl-frost" style="background-image:url(${BG(19)})"></div><div class="kl-veil"></div>
      <div class="kl-rev"><div class="kl-k"><i>01</i>TRY IT</div><div class="kl-h">Say a sound.<br>Hear it.</div></div>
      <div class="kl-box kl-glass kl-rev"><input type="text" class="kl-in" placeholder="dirty 808, cold glass bell, dark choir..." maxlength="80" spellcheck="false"><button type="button" class="kl-go" title="Make it"><svg viewBox="0 0 24 24"><path d="M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z"/></svg></button></div>
      <div class="kl-chips kl-rev">${["dirty 808", "cold glass bell", "dark choir", "dreamy pad", "evil pluck", "rage lead", "warm keys", "laser"].map((w) => `<button type="button" class="kl-chip" data-w="${w}">${w}</button>`).join("")}</div>
      <div class="kl-scape kl-glass kl-rev"><canvas></canvas><div class="kl-heard">875 sounds inside TOY MACHINE</div></div>
      <div class="kl-keys kl-rev"></div>
    </section>

    <section class="kl-pg">
      <div class="kl-frost" style="background-image:url(${BG(4)})"></div><div class="kl-veil"></div>
      <div class="kl-rev"><div class="kl-k"><i>02</i>THE PLAYGROUND</div><div class="kl-h">One open grid.</div><p class="kl-p">No channels to set up. Drop a sound anywhere and it plays. Everything stays in time.</p></div>
      <div class="kl-rev" style="margin-top:34px">
        <div class="kl-screen kl-main"></div>
        <div class="kl-pg-row"></div>
      </div>
    </section>

    <div class="kl-band" style="background-image:url(${BG(26)})"><span>every tool is a toy</span></div>

    <section class="kl-tm">
      <div class="kl-frost" style="background-image:url(${BG(8)})"></div><div class="kl-veil"></div>
      <div class="kl-two">
        <div class="kl-card3d kl-rev" data-front="cards/C2_tm.jpg" data-back="cards/C3_tm_back.jpg"></div>
        <div class="kl-rev"><div class="kl-k"><i>03</i>TOY MACHINE</div><div class="kl-h">The synth<br>you play<br><span class="kl-cut" style="background-image:url(${BG(20)})">like a toy.</span></div>
          <p class="kl-p">A landscape you move instead of a wall of knobs. 875 sounds, from round 808s to glass bells.</p>
          <div class="kl-tiles"></div></div>
      </div>
    </section>

    <section class="kl-kd">
      <div class="kl-frost" style="background-image:url(${BG(13)})"></div><div class="kl-veil"></div>
      <div class="kl-two">
        <div class="kl-rev"><div class="kl-k"><i>04</i>KILLDRUM</div><div class="kl-h">Drums with<br>a bad attitude.</div>
          <p class="kl-p">Real one-shots, dirty 808s. Click the steps, swap the kit.</p>
          <div class="kl-grid"></div>
          <div class="kl-drow"><button type="button" class="kl-btn" data-act="drum">PLAY</button><div class="kl-chips kl-kits"></div></div></div>
        <div class="kl-card3d kl-rev" data-front="cards/C2_kd.jpg" data-back="cards/C3_kd_back.jpg"></div>
      </div>
    </section>

    <div class="kl-band" style="background-image:url(${BG(20)})"><span>roll it. bend it. make it yours.</span></div>

    <section class="kl-midi">
      <div class="kl-frost" style="background-image:url(${BG(20)})"></div><div class="kl-veil"></div>
      <div class="kl-rev"><div class="kl-k"><i>05</i>MIDI</div><div class="kl-h">Roll chords.<br>Bend them your way.</div>
        <p class="kl-p">Pick a mood and roll a starting point. Then move, stretch and flip the notes yourself, and save them as MIDI.</p></div>
      <div class="kl-rev" style="margin-top:28px">
        <div class="kl-drow"><button type="button" class="kl-btn solid" data-act="roll">ROLL</button><div class="kl-chips kl-moods">${["villain", "dreamy", "sad", "dark", "euphoric"].map((w, i) => `<button type="button" class="kl-chip${i ? "" : " on"}" data-m="${w}">${w}</button>`).join("")}</div><span class="kl-sp" style="flex:1"></span><button type="button" class="kl-btn" data-act="mid">SAVE .MID</button></div>
        <div class="kl-roll kl-glass"><canvas></canvas></div>
        <div class="kl-chords"></div>
      </div>
    </section>

    <section class="kl-ease"></section>

    <section class="kl-free">
      <div class="kl-frost" style="background-image:url(${BG(31)})"></div><div class="kl-veil"></div>
      <div class="kl-rev"><div class="kl-k"><i>06</i>FREE</div><h2 class="kl-cut" style="background-image:url(${BG(20)})">FREE.</h2>
        <p class="kl-p" style="margin-top:26px">The whole playground runs in your browser. No install, no card. Make music and you earn your way to new synths, effects and picked kits.</p></div>
      <div class="kl-case kl-rev"></div>
    </section>

    <section class="kl-end">
      <div class="kl-frost" style="background-image:url(${BG(18)})"></div><div class="kl-veil"></div>
      <img src="logo.png" alt="KILLTOY" class="kl-rev">
      <div class="kl-line kl-rev" style="margin:22px 0 34px;letter-spacing:.08em;color:#a9a6b6">${LINE}</div>
      <button type="button" class="kl-btn solid kl-rev" data-act="open">OPEN THE PLAYGROUND</button>
    </section>`;
    document.body.append(page);
    wire();
  };

  // ------------------------------------------------------------------ wiring
  const SCREENS = [
    { cap: "DROP A SOUND", v: LAND("landing/pg-drop.webm"), img: LAND("landing/pg-drop.jpg") },
    { cap: "ROLL THE DICE", v: LAND("landing/pg-dice.webm"), img: LAND("landing/pg-dice.jpg") },
    { cap: "PLAY IT BACK", v: LAND("landing/pg-play.webm"), img: LAND("landing/pg-play.jpg") },
  ];
  const screen = (s, big) => {
    const d = H("div", "kl-screen");
    const im = H("img"); im.src = s.img; im.alt = ""; im.onerror = () => im.remove(); d.append(im);
    if (big) { const v = H("video"); v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = "none"; v.poster = s.img; v.src = s.v; v.onerror = () => v.remove(); d.append(v); }
    d.append(H("div", "kl-cap", s.cap));
    return d;
  };
  const showScreen = (i) => {
    const main = $(".kl-main", page), s = SCREENS[i]; if (!main) return;
    main.replaceWith(Object.assign(screen(s, true), { className: "kl-screen kl-main" }));
    $$(".kl-pg-row .kl-screen", page).forEach((e, k) => e.classList.toggle("on", k === i));
    const v = $(".kl-main video", page); if (v) v.play().catch(() => {});
  };

  function wire() {
    const close = () => hide();
    $(".kl-x", page).onclick = close;
    $(".kl-logo", page).onclick = () => { hide(); try { if (typeof showHome === "function") showHome(true); } catch (e) { /* fine */ } };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && page && !page.hidden) close(); });

    // reveal on scroll + face banners slide
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }), { root: page, threshold: 0.15 });
    $$(".kl-rev", page).forEach((e) => io.observe(e));
    page.addEventListener("scroll", () => {
      const vh = page.clientHeight;
      $$(".kl-band", page).forEach((b) => { const r = b.getBoundingClientRect(); b.style.setProperty("--sy", (20 + 60 * (1 - (r.top + r.height) / (vh + r.height))).toFixed(1) + "%"); });
    }, { passive: true });

    // 1 opening: the app itself playing. If the hero film is missing, the older playback film stands in.
    const hv = $(".kl-app video", page);
    if (hv) hv.addEventListener("error", () => { if (!hv.dataset.fb) { hv.dataset.fb = "1"; hv.src = LAND("landing/pg-play.webm"); hv.play().catch(() => {}); } });
    // the window starts tilted back and straightens as you scroll
    const tilt = () => { const k = Math.max(0, 1 - page.scrollTop / 420); page.style.setProperty("--tilt", (k * 16).toFixed(2) + "deg"); page.style.setProperty("--tilt-k", k.toFixed(3)); };
    page.addEventListener("scroll", tilt, { passive: true }); tilt();

    wirePrompt();
    if ($(".kl-pg-row", page)) $(".kl-pg-row", page).append(...SCREENS.map((s, i) => { const d = screen(s, false); d.onclick = () => showScreen(i); return d; }));
    showScreen(0);
    $$(".kl-card3d", page).forEach(card3d);
    wireTiles();
    wireDrums();
    wireMidi();
    if ($(".kl-ease", page)) wireEase();
    wirePrizes();
    if (Y2K || V3) wireY2k();
    if (V3) wireV3();
    if (V4) wireV4();
    $$("[data-act=open]", page).forEach((b) => b.onclick = () => { hide(); try { if (typeof showHome === "function") showHome(true); } catch (e) { /* fine */ } const all = $(".kq-tabs button:not(.kl-tab)"); if (all) all.click(); });
  }

  // Y2K extras: TRY IT jumps to the prompt box, the big die rolls (and rolls the MIDI dice), the kit wall plays kits
  const PIPS = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
  function wireY2k() {
    const go = (sel) => { const t = $(sel, page); if (t) page.scrollTo({ top: t.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop - 90, behavior: "smooth" }); };
    $$("[data-act=try]", page).forEach((b) => b.onclick = () => { go(".kl-try"); setTimeout(() => { const i = $(".kl-in", page); if (i) i.focus({ preventScroll: true }); }, 600); });
    $$("[data-act=die]", page).forEach((d) => {
      const pips = $$("i", d), show = (n) => pips.forEach((x, k) => x.classList.toggle("on", PIPS[n - 1].includes(k)));
      show(5);
      d.onclick = () => {
        let t = 0; const spin = setInterval(() => { show(1 + Math.floor(Math.random() * 6)); if (++t > 7) { clearInterval(spin); const r = $("[data-act=roll]", page); if (r) r.click(); } }, 70);
      };
    });
    $$(".y-kit[data-kit]", page).forEach((k) => k.onclick = async () => {
      $$(".y-kit", page).forEach((x) => x.classList.toggle("on", x === k));
      stopVoice(); ctx();
      kitId = "pack-" + k.dataset.kit; kitBufs = await loadKit(kitId);
      $$(".kl-kits .kl-chip", page).forEach((x) => x.classList.remove("on"));
      if (drumOn) return;   // the beat above keeps going with the new kit
      const t0 = AC.currentTime + 0.05, st = 60 / 140 / 4;
      [["kick", 0], ["hat_closed", 2], ["snare", 4], ["hat_closed", 6], ["kick", 7], ["808", 8], ["hat_closed", 10], ["snare", 12], ["clap", 12], ["hat_open", 14]].forEach(([slot, i]) => hit(slot, t0 + i * st));
    });
  }

  // 2 the prompt synth --------------------------------------------------------
  let cur = null;   // the preset the prompt picked
  function wirePrompt() {
    const inp = $(".kl-in", page), go = $(".kl-go", page), heard = $(".kl-heard", page);
    const make = async () => {
      const text = inp.value.trim() || "warm";
      go.classList.add("busy");
      try {
        const it = await pick(text, cur && cur.id); if (!it) throw new Error("no presets");
        // Eman 23:44: act like the prompt plugin is already here. When the SYNTH SOUND SCIENCE thread ships
        // ToyMachinePrompt.make(text) -> preset, it is used; until then the closest preset + the word moves stand in.
        let own = null, did = [];
        if (window.ToyMachinePrompt && typeof ToyMachinePrompt.make === "function") { try { own = await ToyMachinePrompt.make(text); } catch (e) { own = null; } }
        if (!own) ({ p: own, did } = shapeSound(await preset(it), text));
        else if (own.prompt && Array.isArray(own.prompt.said)) did = own.prompt.said.filter((w) => !/^NO /.test(w)).slice(0, 4);
        cur = Object.assign({}, it, { own, id: it.id + "|" + text });
        const nm = text.toUpperCase().replace(/[^A-Z0-9 /]+/g, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 3).join(" ") || "NEW SOUND";
        heard.innerHTML = `<b>${esc(nm)}</b> &nbsp; ${(did.length ? did : [it.category.toUpperCase()]).map(esc).join(" \u00b7 ")}`;
        drawKeys();
        const L = await render(it, phraseFor(it), 120, 8, own);
        playBuf(L[0], L[1]);
      } catch (e) { console.warn("landing prompt", e); heard.textContent = "no sound this time, try again"; }
      go.classList.remove("busy");
    };
    go.onclick = make;
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") make(); });
    $$(".kl-try .kl-chip", page).forEach((c) => { c.onclick = () => { inp.value = c.dataset.w; $$(".kl-try .kl-chip", page).forEach((x) => x.classList.toggle("on", x === c)); make(); }; });
    drawKeys();
    const keyMap = "awsedftgyhujk";
    page.addEventListener("keydown", (e) => {
      if (e.target === inp || e.metaKey || e.ctrlKey || e.repeat) return;
      const i = keyMap.indexOf(e.key.toLowerCase()); if (i < 0) return;
      const s = $(".kl-try", page).getBoundingClientRect(); if (s.bottom < 0 || s.top > page.clientHeight) return;
      e.preventDefault(); note(i);
    });
  }
  const noteCache = {};
  async function note(i) {
    const b = $$(".kl-keys button", page)[i]; if (b) { b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 160); }
    try {
      const idx = await index(), it = cur || idx.find((x) => x.name === "Glass FM Keys") || idx[0];
      const pitch = (KEYBASE[it.category] || 48) + i, k = it.id + "|" + pitch;
      const L = noteCache[k] || (noteCache[k] = await render(it, [N(pitch, 0, 0.9, 104)], 120, 2, it.own));
      const c = ctx(), buf = c.createBuffer(2, L[0].length, c.sampleRate); buf.copyToChannel(L[0], 0); buf.copyToChannel(L[1], 1);
      const src = c.createBufferSource(); src.buffer = buf; src.connect(OUT); src.start();
    } catch (e) { console.warn("landing key", e); }
  }
  function drawKeys() {
    const box = $(".kl-keys", page); box.innerHTML = "";
    const blk = [1, 3, 6, 8, 10];
    "AWSEDFTGYHUJK".split("").forEach((ch, i) => { const b = H("button", blk.includes(i % 12) ? "blk" : "", ch); b.type = "button"; b.onpointerdown = () => note(i); box.append(b); });
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // the landscape: mountains made of the sound playing right now
  function drawScape(t) {
    const cv = $(".kl-scape canvas", page); if (!cv) return;
    const w = cv.clientWidth * 2, h = cv.clientHeight * 2; if (cv.width !== w) { cv.width = w; cv.height = h; }
    const g = cv.getContext("2d"); g.clearRect(0, 0, w, h);
    const hue = cur && cur.look ? cur.look.hue : 262, hue2 = cur && cur.look ? cur.look.hue2 : 280;
    const layers = 7;
    for (let l = layers - 1; l >= 0; l--) {
      const y0 = h * (0.42 + l * 0.075), amp = h * (0.18 + l * 0.02);
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const u = x / w, bin = Math.floor(Math.pow(u, 1.7) * 380) + 2 + l * 3, f = FREQ && AN ? FREQ[bin] / 255 : 0;
        const idle = 0.18 * Math.sin(u * 9 + t * 0.0004 + l) + 0.1 * Math.sin(u * 23 - t * 0.0007 + l * 2);
        g.lineTo(x, y0 - amp * (f * 1.1 + idle * 0.5 + 0.12));
      }
      g.lineTo(w, h); g.closePath();
      if (l === 0) { const gr = g.createLinearGradient(0, y0 - amp, 0, h); gr.addColorStop(0, `hsla(${hue2},70%,62%,.42)`); gr.addColorStop(1, "rgba(13,13,16,.2)"); g.fillStyle = gr; }
      else g.fillStyle = `hsla(${l % 2 ? hue : 262},${30 + l * 4}%,${62 - l * 5}%,${0.05 + (layers - l) * 0.018})`;
      g.fill();
      if (l === 0) { g.strokeStyle = "rgba(228,255,58,.85)"; g.lineWidth = 2; g.stroke(); }
    }
    if (voice) {   // the playhead
      const p = Math.min(1, (AC.currentTime - voice.t0) / voice.dur);
      g.fillStyle = "rgba(228,255,58,.9)"; g.fillRect(p * w, 0, 2, h);
    }
  }

  // 3D cards that turn slowly; drag to spin -------------------------------------
  const cards = [];
  function card3d(el) {
    const c = H("div", "kl-c3");
    for (let i = 1; i <= 6; i++) { const s = H("div", "s"); s.style.transform = `translateZ(${4 - i * 1.15}px)`; c.append(s); }
    c.append(Object.assign(H("div", "b", `<img alt="" src="${el.dataset.back}">`)), Object.assign(H("div", "f", `<img alt="" src="${el.dataset.front}"><div class="holo"></div>`)));
    el.append(c, H("div", "kl-shadow"));
    const st = { el, c, ry: cards.length ? 200 : 20, v: 0, drag: null, phase: cards.length * 1.7 };
    el.addEventListener("pointerdown", (e) => { st.drag = { x: e.clientX, t: performance.now() }; el.classList.add("grab"); el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => { if (!st.drag) return; const dx = e.clientX - st.drag.x, now = performance.now(); st.ry += dx * 0.6; st.v = (dx * 0.6) / Math.max(8, now - st.drag.t) * 16; st.drag = { x: e.clientX, t: now }; });
    const up = () => { st.drag = null; el.classList.remove("grab"); };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    cards.push(st);
  }
  function tickCards(t, dt) {
    for (const s of cards) {
      if (!s.drag) { s.ry += 0.012 * dt + s.v; s.v *= 0.94; }
      const rx = 6 * Math.sin(t * 0.0006 + s.phase), y = 8 * Math.sin(t * 0.0009 + s.phase);
      s.c.style.transform = `translateY(${y.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg)`;
      const h = s.c.querySelector(".holo"); if (h) h.style.setProperty("--hx", ((s.ry % 360 + 360) % 360 / 3.6).toFixed(1) + "%");
    }
  }

  // 4 TOY MACHINE: 8 sounds to flick through ---------------------------------------
  const TILE_NAMES = ["Rubber 808", "Night Choir", "Glass FM Keys", "Bicep Bell", "SC Screamer", "Wide Supersaw Pad", "Toy Pluck", "Arp Engine"];
  async function wireTiles() {
    const box = $(".kl-tiles", page), idx = await index();
    const its = TILE_NAMES.map((n) => idx.find((x) => x.name === n)).filter(Boolean);
    for (const it of its) {
      const b = H("button", "kl-tile", `<i></i><b>${esc(it.name)}</b><span>${esc(it.category)}</span>`); b.type = "button";
      b.onclick = async () => {
        if (b.classList.contains("on")) { stopVoice(); return; }
        $$(".kl-tile", page).forEach((x) => x.classList.remove("on")); b.classList.add("on");
        try { const L = await render(it, phraseFor(it), 120, 8); cur = it; drawKeys(); const v = playBuf(L[0], L[1], () => { b.classList.remove("on"); b.querySelector("i").style.width = "0"; }); v.bar = b.querySelector("i"); }
        catch (e) { console.warn("landing tile", e); b.classList.remove("on"); }
      };
      box.append(b);
    }
  }

  // 5 KILLDRUM: a 16-step grid on real kits ------------------------------------------
  const ROWS = [["KICK", "kick"], ["808", "808"], ["SNARE", "snare"], ["CLAP", "clap"], ["HATS", "hat_closed"], ["OPEN", "hat_open"]];
  const PAT = {   // a half-time villain beat at 140
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], "808": [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], clap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    hat_closed: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1], hat_open: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  };
  const KITS = [["genesis-888", "888 GENESIS"], ["opium-night", "OPIUM NIGHT"], ["phonk-drift", "PHONK DRIFT"], ["villain-drill", "VILLAIN DRILL"]];
  let kitBufs = {}, kitId = KITS[0][0], drumOn = false, drumTimer = 0, drumStep = 0, drumNext = 0;
  async function loadKit(id) {
    const lib = window.KillDrumLib; if (!lib) return {};
    await lib.load();
    const k = lib.kits().find((x) => x.id === id) || lib.kits()[0]; if (!k) return {};
    const out = {};
    await Promise.all(ROWS.map(async ([, slot]) => {
      const sid = k.pads[slot] || k.pads[lib.NOTES[slot]], it = sid && lib.item(sid); if (!it || !it.url) return;
      try { const b = await (await fetch(it.url)).arrayBuffer(); out[slot] = { buf: await ctx().decodeAudioData(b), gain: Math.pow(10, (it.gain_db || 0) / 20) }; } catch (e) { /* skip that pad */ }
    }));
    return out;
  }
  function wireDrums() {
    const grid = $(".kl-grid", page);
    for (const [label, slot] of ROWS) {
      const r = H("div", "r"); r.append(H("b", null, label));
      for (let i = 0; i < 16; i++) { const s = H("button", "st" + (PAT[slot][i] ? " on" : "")); s.type = "button"; s.dataset.slot = slot; s.dataset.i = i; s.onclick = () => { PAT[slot][i] ^= 1; s.classList.toggle("on", !!PAT[slot][i]); if (PAT[slot][i] && !drumOn) hit(slot, ctx().currentTime); }; r.append(s); }
      grid.append(r);
    }
    const kits = $(".kl-kits", page);
    KITS.forEach(([id, name], i) => { const c = H("button", "kl-chip" + (i ? "" : " on"), name); c.type = "button"; c.onclick = async () => { kitId = id; $$(".kl-kits .kl-chip", page).forEach((x) => x.classList.toggle("on", x === c)); kitBufs = await loadKit(id); if (!drumOn) hit("kick", ctx().currentTime); }; kits.append(c); });
    $("[data-act=drum]", page).onclick = (e) => toggleDrums(e.currentTarget);
  }
  function hit(slot, at) {
    const k = kitBufs[slot]; if (!k) return;
    const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = k.buf; g.gain.value = k.gain * (slot === "hat_closed" ? 0.55 : 0.9);
    if (slot === "hat_open") { g.gain.setValueAtTime(g.gain.value, at + 0.18); g.gain.linearRampToValueAtTime(0, at + 0.32); }
    s.connect(g); g.connect(OUT); s.start(at);
    if (slot === "808") { g.gain.setValueAtTime(g.gain.value, at + 0.42); g.gain.linearRampToValueAtTime(0, at + 0.5); }   // stops before the next 808
  }
  async function toggleDrums(btn) {
    if (drumOn) { drumOn = false; clearInterval(drumTimer); btn.textContent = "PLAY"; btn.classList.remove("on"); $$(".kl-grid .st.now", page).forEach((x) => x.classList.remove("now")); return; }
    stopVoice(); ctx();
    btn.textContent = "..."; if (!Object.keys(kitBufs).length) kitBufs = await loadKit(kitId);
    drumOn = true; btn.textContent = "STOP"; btn.classList.add("on");
    const sixteenth = 60 / 140 / 4; drumStep = 0; drumNext = AC.currentTime + 0.06;
    clearInterval(drumTimer);
    drumTimer = setInterval(() => {
      while (drumNext < AC.currentTime + 0.12) {
        const i = drumStep % 16, at = drumNext;
        for (const [, slot] of ROWS) if (PAT[slot][i]) hit(slot, at);
        setTimeout(() => { if (!drumOn) return; $$(".kl-grid .st", page).forEach((x) => x.classList.toggle("now", +x.dataset.i === i)); }, Math.max(0, (at - AC.currentTime) * 1000));
        drumStep++; drumNext += sixteenth;
      }
    }, 25);
  }
  const stopDrums = () => { const b = page && $("[data-act=drum]", page); if (drumOn && b) toggleDrums(b); };

  // 6 MIDI: the dice brain -----------------------------------------------------------
  let roll = null;   // { notes, chords: [{name, beat, len}], beats }
  const NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
  function doRoll(mood) {
    const B = window.ChordBrain, tonic = 9;   // A minor
    let segs = null;
    try {
      if (B) {
        const A = B.auto ? B.auto(mood, "chords") : {};
        const r = B.roll({ tonic, scale: "minor", bars: 4, pace: A.pace, colour: A.colour, tension: A.tension, random: A.random, voices: A.voices, pop: A.pop, text: mood, seed: (Math.random() * 1e9) | 0 });
        segs = r && r.segs;
      }
    } catch (e) { console.warn("landing dice", e); }
    if (!segs || !segs.length) segs = [[0, [0, 3, 7]], [8, [0, 4, 7]], [3, [0, 4, 7]], [10, [0, 4, 7]]].map(([r, ivs], i) => ({ beat: i * 4, len: 4, root: (tonic + r) % 12, ivs, name: "" }));
    const notes = [], chords = [];
    for (const g of segs) {
      const root = 48 + ((g.root - 0 + 12) % 12) - (g.root > 7 ? 12 : 0);
      const tones = g.ivs.slice(0, 4).map((x) => root + 12 + x);
      for (let b = g.beat; b < g.beat + g.len - 1e-6; b += 2) tones.forEach((p) => notes.push(N(p, b, 1.85, b === g.beat ? 98 : 84)));
      notes.push(N(root - 12, g.beat, Math.min(g.len, 4) - 0.1, 104));
      chords.push({ name: g.name || (NAMES[(g.root - 9 + 12) % 12] + (g.ivs[1] === 3 ? "m" : "")), beat: g.beat, len: g.len });
    }
    const beats = segs.reduce((a, g) => Math.max(a, g.beat + g.len), 0);
    roll = { notes, chords, beats };
    $(".kl-chords", page).innerHTML = chords.map((c) => `<span style="flex:${c.len}">${esc(c.name)}</span>`).join("");
    return roll;
  }
  function wireMidi() {
    let mood = "villain";
    $$(".kl-moods .kl-chip", page).forEach((c) => { c.onclick = () => { mood = c.dataset.m; $$(".kl-moods .kl-chip", page).forEach((x) => x.classList.toggle("on", x === c)); $("[data-act=roll]", page).click(); }; });
    $("[data-act=roll]", page).onclick = async (e) => {
      const b = e.currentTarget; stopDrums();
      const r = doRoll(mood);
      try {
        const idx = await index(), it = idx.find((x) => x.name === "Tape Warble Keys Pad") || idx.find((x) => x.category === "Keys");
        b.textContent = "...";
        const bpm = 100, L = await render(it, r.notes, bpm, r.beats);
        const v = playBuf(L[0], L[1]); v.roll = { bpm, beats: r.beats };
      } catch (err) { console.warn("landing roll", err); }
      b.textContent = "ROLL";
    };
    $("[data-act=mid]", page).onclick = () => {
      const r = roll || doRoll(mood), bytes = midiFile(r.notes, 100);
      const a = H("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" })); a.download = "KILLTOY dice " + mood + ".mid"; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    doRoll(mood);
  }
  function drawRoll() {
    const cv = $(".kl-roll canvas", page); if (!cv || !roll) return;
    const w = cv.clientWidth * 2, h = cv.clientHeight * 2; if (cv.width !== w) { cv.width = w; cv.height = h; }
    const g = cv.getContext("2d"); g.clearRect(0, 0, w, h);
    const ps = roll.notes.map((n) => n.pitch), lo = Math.min(...ps) - 2, hi = Math.max(...ps) + 2, rowH = h / (hi - lo + 1), bw = w / roll.beats;
    for (let p = lo; p <= hi; p++) if ([1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12)) { g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(0, h - (p - lo + 1) * rowH, w, rowH); }
    for (let b = 0; b <= roll.beats; b++) { g.fillStyle = b % 4 ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.14)"; g.fillRect(b * bw, 0, 1, h); }
    const at = voice && voice.roll ? (AC.currentTime - voice.t0) * voice.roll.bpm / 60 : -1;
    for (const n of roll.notes) {
      const on = at >= n.start && at < n.start + n.length;
      g.fillStyle = on ? "#e4ff3a" : n.pitch < 48 ? "rgba(139,108,255,.95)" : "rgba(190,172,255,.85)";
      g.fillRect(n.start * bw + 1, h - (n.pitch - lo + 1) * rowH + 1, n.length * bw - 2, rowH - 2);
    }
    if (at >= 0 && at <= roll.beats) { g.fillStyle = "#e4ff3a"; g.fillRect(at * bw, 0, 2, h); }
    $$(".kl-chords span", page).forEach((s, i) => { const c = roll.chords[i]; s.classList.toggle("now", !!c && at >= c.beat && at < c.beat + c.len); });
  }
  function midiFile(notes, bpm) {
    const tpq = 480, ev = [];
    for (const n of notes) { ev.push([Math.round(n.start * tpq), 0x90, n.pitch, n.velocity || 100]); ev.push([Math.round((n.start + n.length) * tpq), 0x80, n.pitch, 0]); }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const vl = (v) => { const o = [v & 0x7f]; while ((v >>= 7)) o.unshift((v & 0x7f) | 0x80); return o; };
    const us = Math.round(60000000 / bpm), trk = [0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255];
    let t = 0; for (const [at, st, p, v] of ev) { trk.push(...vl(at - t), st, p, v); t = at; }
    trk.push(0, 0xff, 0x2f, 0);
    const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    return new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (tpq >> 8) & 255, tpq & 255, 0x4d, 0x54, 0x72, 0x6b, ...u32(trk.length), ...trk]);
  }

  // 7 the ease ------------------------------------------------------------------------
  function wireEase() {
    const box = $(".kl-ease", page);
    // three words, three faces: drop a sound, roll the dice, bounce the song
    [["DROP", 4, "a sound anywhere"], ["ROLL", 20, "the dice for chords"], ["BOUNCE", 27, "your song out"]].forEach(([w, face, say], i) => {
      const d = H("div", "kl-rev");
      const s = H("div", "kl-screen kl-face"); s.style.background = `#111 url(${BG(face)}) center/cover`;
      d.append(s, H("div", "kl-n", `<i>0${i + 1}</i>${w}`), H("div", "kl-p", say));
      box.append(d);
    });
    $$(".kl-ease .kl-rev", page).forEach((e) => { const io = new IntersectionObserver((es) => es.forEach((x) => x.isIntersecting && x.target.classList.add("in")), { root: page }); io.observe(e); });
  }

  // 8 free + what you can win (the real quest prizes and the CARDS tab score) ----------------
  const PRIZES = [
    { name: "TOY MACHINE", kind: "SYNTH", img: "cards/C2_tm.jpg", got: true },
    { name: "KILLDRUM", kind: "DRUMS", img: "cards/C2_kd.jpg", got: true },
    { name: "VOID 808", kind: "NEW SYNTH", img: "cards/kc-lock1.jpg", need: 500 },
    { name: "HAUNT FX", kind: "FX PACK", img: "cards/kc-lock2.jpg", need: 1500 },
    { name: "PICKED KIT", kind: "SELECTED KIT", img: "cards/kc-lock3.jpg", need: 3000 },
    { name: "TUNR", kind: "VOCAL FX", img: "cards/kc-lock4.jpg", need: 6000 },
  ];
  function wirePrizes() {
    let score = 0; try { score = Math.max(0, parseFloat(localStorage.getItem("kt2.score")) || 0); } catch (e) { /* 0 */ }
    $(".kl-case", page).append(...PRIZES.map((p) => {
      const d = H("div", "kl-prize" + (p.got ? " got" : ""));
      d.innerHTML = `<img alt="" src="${p.img}">${p.got ? "" : '<div class="q">?</div>'}<div class="t"><b>${p.got ? p.name : "???"}</b><span>${p.got ? p.kind + " \u00b7 YOURS" : p.kind}</span>${p.got ? "" : `<div class="bar"><i style="width:${Math.min(100, (score / p.need) * 100).toFixed(0)}%"></i></div>`}</div>`;
      return d;
    }));
  }

  // ------------------------------------------------------------------ the loop: level meter + pictures
  let last = 0;
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(64, t - (last || t)); last = t;
    if (AN) { AN.getByteFrequencyData(FREQ); let s = 0; for (let i = 2; i < 40; i++) s += FREQ[i]; page.style.setProperty("--lv", Math.min(1, s / 38 / 200).toFixed(3)); }
    drawScape(t); tickCards(t, dt); drawRoll();
    if (voice && voice.bar) voice.bar.style.width = Math.min(100, ((AC.currentTime - voice.t0) / voice.dur) * 100).toFixed(1) + "%";
  };

  // ------------------------------------------------------------------ open / close + the tab
  function show() {
    if (!page) build();
    page.hidden = false; document.body.classList.add("landing-open");
    $$(".kq-tabs button", document).forEach((b) => b.classList.toggle("on", b.classList.contains("kl-tab")));
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    $$(".kl-main video, .kl-app video", page).forEach((v) => v.play().catch(() => {}));
  }
  function hide() {
    if (!page) return;
    page.hidden = true; document.body.classList.remove("landing-open");
    stopVoice(); stopDrums(); cancelAnimationFrame(raf);
    $$(".kl-screen video", page).forEach((v) => v.pause());
    const t = $(".kq-tabs .kl-tab"); if (t) t.classList.remove("on");
    const all = $(".kq-tabs button:not(.kl-tab)"); if (all && !$(".kq-tabs button.on")) all.classList.add("on");
  }
  const mount = () => {
    const tabs = $(".kq-tabs"); if (!tabs) return false;
    if ($(".kl-tab", tabs)) return true;
    const b = H("button", "kl-tab", "Landing page"); b.type = "button";
    b.onclick = show;
    tabs.prepend(b);
    return true;
  };
  if (!mount()) { const t = setInterval(() => { if (mount()) clearInterval(t); }, 400); setTimeout(() => clearInterval(t), 30000); }
  window.KT2Landing = { open: show, close: hide };
  if (/^#landing$/.test(location.hash)) setTimeout(show, 1500);
})();
